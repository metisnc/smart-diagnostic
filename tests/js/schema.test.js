/**
 * Le diagnostic de test et les modèles doivent rester valides au regard du JSON Schema.
 */
const fs = require( 'fs' );
const path = require( 'path' );
const Ajv2020 = require( 'ajv/dist/2020' );
const addFormats = require( 'ajv-formats' );

const root = path.resolve( __dirname, '../..' );
const readJson = ( file ) =>
	JSON.parse( fs.readFileSync( path.join( root, file ), 'utf8' ) );

describe( 'diagnostic.schema.json', () => {
	const ajv = new Ajv2020( { allErrors: true, strict: false } );
	addFormats( ajv );
	const validate = ajv.compile( readJson( 'schema/diagnostic.schema.json' ) );

	// Diagnostic de test et modèles livrés avec le plugin.
	const examples = [ 'tests/fixtures', 'templates/diagnostics' ].flatMap(
		( dir ) =>
			fs
				.readdirSync( path.join( root, dir ) )
				.filter( ( file ) => file.endsWith( '.json' ) )
				.map( ( file ) => `${ dir }/${ file }` )
	);

	it.each( examples )( '%s is valid', ( file ) => {
		const valid = validate( readJson( file ) );
		expect( validate.errors ).toBeNull();
		expect( valid ).toBe( true );
	} );

	it( 'rejects an unknown question type', () => {
		const config = readJson( 'tests/fixtures/demo.json' );
		config.steps[ 0 ].type = 'unknown_type';
		expect( validate( config ) ).toBe( false );
	} );
} );
