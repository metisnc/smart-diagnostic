import { interpolate } from '../../assets/src/engine/interpolate';
import { validateAnswer } from '../../assets/src/engine/validate';

describe( 'interpolate', () => {
	const config = {
		i18n: { defaultLanguage: 'fr' },
		steps: [
			{
				key: 'color',
				type: 'single',
				options: [ { value: 'r', label: { fr: 'Rouge', en: 'Red' } } ],
			},
		],
	};

	it( 'replaces personalisation variables', () => {
		const text =
			'Bonjour {first_name}, couleur {answer:color}, score {score:x}, écart {var:gap}, {contact:email}';
		expect(
			interpolate( text, {
				config,
				answers: { color: 'r' },
				contact: { first_name: ' Alice ', email: 'a@b.co' },
				scores: { x: 41.6 },
				vars: { gap: 800 },
				lang: 'fr',
			} )
		).toBe( 'Bonjour Alice, couleur Rouge, score 42, écart 800, a@b.co' );
	} );

	it( 'uses the requested language for option labels and blanks unknown values', () => {
		expect(
			interpolate( '{answer:color} {first_name}', {
				config,
				answers: { color: 'r' },
				lang: 'en',
			} )
		).toBe( 'Red ' );
	} );

	it( 'falls back to the first_name answer', () => {
		expect(
			interpolate( 'Hi {first_name}', {
				config,
				answers: { first_name: 'Bob' },
			} )
		).toBe( 'Hi Bob' );
	} );
} );

describe( 'validateAnswer', () => {
	it.each( [
		[ { type: 'text' }, '', 'required' ],
		[ { type: 'text', required: false }, '', null ],
		[ { type: 'email' }, 'nope', 'invalidEmail' ],
		[ { type: 'email' }, 'a@b.co', null ],
		[ { type: 'phone' }, '+33 6 12 34 56 78', null ],
		[ { type: 'phone' }, 'abc', 'invalidPhone' ],
		[ { type: 'number', validation: { min: 0, max: 10 } }, 11, 'max' ],
		[ { type: 'number', validation: { min: 0 } }, -1, 'min' ],
		[ { type: 'number' }, 'x', 'invalidNumber' ],
		[
			{ type: 'multi', validation: { minSelected: 2 } },
			[ 'a' ],
			'minSelected',
		],
		[
			{ type: 'multi', validation: { maxSelected: 1 } },
			[ 'a', 'b' ],
			'maxSelected',
		],
		[ { type: 'multi' }, [], 'required' ],
		[ { type: 'text', validation: { minLength: 3 } }, 'ab', 'minLength' ],
		[
			{ type: 'text', validation: { pattern: '^[A-Z]+$' } },
			'abc',
			'pattern',
		],
		[ { type: 'multi_amount' }, { a: null, b: '' }, 'required' ],
		[
			{ type: 'multi_amount', validation: { max: 100 } },
			{ a: 50, b: 200 },
			'max',
		],
		[ { type: 'yes_no' }, false, null ],
		[ { type: 'scale' }, 0, null ],
	] )( '%j with %j → %s', ( step, value, expected ) => {
		const result = validateAnswer( step, value );
		expect( result ? result.key : null ).toBe( expected );
	} );
} );
