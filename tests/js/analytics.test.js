import { createTracker, newSession } from '../../assets/src/front/analytics';

describe( 'analytics tracker', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		window.fetch = jest.fn( () => Promise.resolve( {} ) );
		window.dataLayer = [];
		window.crypto = {
			getRandomValues: ( bytes ) => bytes.fill( 171 ),
		};
	} );

	afterEach( () => {
		jest.useRealTimers();
		delete window.dataLayer;
	} );

	it( 'creates 32-character hexadecimal sessions', () => {
		expect( newSession() ).toMatch( /^[a-f0-9]{32}$/ );
	} );

	it( 'notifies the page and the dataLayer, then sends a batch', () => {
		const listener = jest.fn();
		document.addEventListener( 'sd:event', listener );
		const tracker = createTracker( {
			api: { root: '/api/', nonce: 'n' },
			diagnosticId: 7,
			enabled: true,
		} );

		tracker.track( 'start', { session: 'abc' } );
		tracker.track( 'step_view', { step: 'q1', session: 'abc' } );
		tracker.track( 'submit', { session: 'abc' } );

		expect( listener ).toHaveBeenCalledTimes( 3 );
		expect( listener.mock.calls[ 1 ][ 0 ].detail ).toMatchObject( {
			event: 'step_view',
			step: 'q1',
			diagnosticId: 7,
		} );
		expect( window.dataLayer.map( ( entry ) => entry.event ) ).toEqual( [
			'sd_start',
			'sd_step_view',
			'sd_submit',
		] );

		expect( window.fetch ).not.toHaveBeenCalled();
		jest.runAllTimers();
		expect( window.fetch ).toHaveBeenCalledTimes( 1 );
		const [ url, options ] = window.fetch.mock.calls[ 0 ];
		expect( url ).toBe( '/api/events' );
		// La soumission n'est pas renvoyée : le serveur la compte lui-même.
		expect( JSON.parse( options.body ) ).toEqual( {
			diagnostic_id: 7,
			session: 'abc',
			nonce: 'n',
			events: [
				{ event: 'start', step: '' },
				{ event: 'step_view', step: 'q1' },
			],
		} );
		document.removeEventListener( 'sd:event', listener );
	} );

	it( 'sends nothing to the server when disabled', () => {
		const tracker = createTracker( {
			api: { root: '/api/', nonce: 'n' },
			diagnosticId: 7,
			enabled: false,
		} );
		tracker.track( 'start', { session: 'abc' } );
		jest.runAllTimers();
		expect( window.fetch ).not.toHaveBeenCalled();
		expect( window.dataLayer ).toHaveLength( 1 );
	} );
} );
