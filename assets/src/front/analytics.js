/**
 * Événements du parcours : envoyés au serveur (entonnoir) et exposés aux outils
 * de mesure du site.
 *
 * Côté navigateur, chaque événement :
 *   - déclenche `document.dispatchEvent( new CustomEvent( 'sd:event', { detail } ) )` ;
 *   - est poussé dans `window.dataLayer` s'il existe (GTM / GA4) : { event: 'sd_start', … }.
 */

const FLUSH_DELAY_MS = 1500;

/**
 * Identifiant aléatoire d'un passage dans le questionnaire (pas de cookie).
 *
 * @return {string} 32 caractères hexadécimaux.
 */
export function newSession() {
	const bytes = new Uint8Array( 16 );
	window.crypto.getRandomValues( bytes );
	return Array.from( bytes, ( b ) =>
		b.toString( 16 ).padStart( 2, '0' )
	).join( '' );
}

/**
 * @param {Object}  options
 * @param {Object}  options.api          { root, nonce }.
 * @param {number}  options.diagnosticId Diagnostic.
 * @param {boolean} options.enabled      Envoi au serveur activé.
 * @return {{track: Function, flush: Function}} Traqueur.
 */
export function createTracker( { api, diagnosticId, enabled } ) {
	let queue = [];
	let session = null;
	let timer = null;

	const flush = ( beacon = false ) => {
		clearTimeout( timer );
		if ( ! enabled || ! api || ! session || ! queue.length ) {
			queue = [];
			return;
		}
		const body = JSON.stringify( {
			diagnostic_id: diagnosticId,
			session,
			events: queue,
			nonce: api.nonce,
		} );
		queue = [];
		const url = `${ api.root }events`;
		if ( beacon && window.navigator.sendBeacon ) {
			window.navigator.sendBeacon(
				url,
				new window.Blob( [ body ], { type: 'application/json' } )
			);
			return;
		}
		window
			.fetch( url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				keepalive: true,
				body,
			} )
			.catch( () => {} );
	};

	/**
	 * @param {string} event  start | step_view | answer | capture | submit | abandon.
	 * @param {Object} [data] { step, session }.
	 */
	const track = ( event, data = {} ) => {
		if ( data.session ) {
			session = data.session;
		}
		const detail = {
			event,
			diagnosticId,
			step: data.step ?? '',
			...data.extra,
		};
		document.dispatchEvent(
			new window.CustomEvent( 'sd:event', { detail } )
		);
		if ( Array.isArray( window.dataLayer ) ) {
			window.dataLayer.push( {
				event: `sd_${ event }`,
				sd_diagnostic: diagnosticId,
				sd_step: detail.step,
				...data.extra,
			} );
		}
		// La soumission est comptée par le serveur lui-même.
		if ( event !== 'submit' ) {
			queue.push( { event, step: detail.step } );
		}
		if ( event === 'abandon' ) {
			flush( true );
		} else {
			clearTimeout( timer );
			timer = setTimeout( () => flush(), FLUSH_DELAY_MS );
		}
	};

	return { track, flush };
}
