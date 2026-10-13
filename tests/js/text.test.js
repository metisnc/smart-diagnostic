import { resolveText } from '../../assets/src/engine/text';

describe( 'resolveText', () => {
	it( 'returns plain strings as-is', () => {
		expect( resolveText( 'Bonjour', 'en' ) ).toBe( 'Bonjour' );
	} );

	it( 'picks the requested language', () => {
		expect( resolveText( { fr: 'Bonjour', en: 'Hello' }, 'en' ) ).toBe(
			'Hello'
		);
	} );

	it( 'falls back to the short language code', () => {
		expect( resolveText( { fr: 'Bonjour' }, 'fr_FR' ) ).toBe( 'Bonjour' );
	} );

	it( 'falls back to the default language, then to the first text', () => {
		expect(
			resolveText( { fr: 'Bonjour', en: 'Hello' }, 'de', 'en' )
		).toBe( 'Hello' );
		expect( resolveText( { es: 'Hola' }, 'de', 'en' ) ).toBe( 'Hola' );
	} );

	it( 'returns an empty string for missing text', () => {
		expect( resolveText( undefined, 'fr' ) ).toBe( '' );
		expect( resolveText( {}, 'fr' ) ).toBe( '' );
	} );
} );
