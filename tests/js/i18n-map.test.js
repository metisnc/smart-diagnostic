/**
 * Chaque fichier JS traduisible du constructeur et du bloc doit figurer dans bin/i18n-map.json,
 * sinon ses textes ne sont pas traduits dans l'admin (fichier JSON de traduction introuvable).
 */
const fs = require( 'fs' );
const path = require( 'path' );

const root = path.resolve( __dirname, '../..' );
const map = JSON.parse(
	fs.readFileSync( path.join( root, 'bin/i18n-map.json' ), 'utf8' )
);

function sources( dir ) {
	return fs
		.readdirSync( path.join( root, dir ), { withFileTypes: true } )
		.flatMap( ( entry ) =>
			entry.isDirectory()
				? sources( `${ dir }/${ entry.name }` )
				: [ `${ dir }/${ entry.name }` ]
		)
		.filter( ( file ) => file.endsWith( '.js' ) );
}

describe( 'bin/i18n-map.json', () => {
	const translatable = [ 'assets/src/builder', 'assets/src/block' ]
		.flatMap( sources )
		.filter( ( file ) =>
			/\b(__|_n|_x)\(/.test(
				fs.readFileSync( path.join( root, file ), 'utf8' )
			)
		);

	it.each( translatable )( '%s is mapped to its build file', ( file ) => {
		expect( map[ file ] ).toMatch( /^build\/.+\.js$/ );
	} );

	it( 'only maps existing files', () => {
		for ( const file of Object.keys( map ) ) {
			expect( fs.existsSync( path.join( root, file ) ) ).toBe( true );
		}
	} );
} );
