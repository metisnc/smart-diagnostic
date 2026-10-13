/**
 * Parité JS ↔ PHP : les mêmes fixtures sont jouées par tests/php/Unit/ParityTest.php.
 */
const fs = require( 'fs' );
const path = require( 'path' );
import { computeResult } from '../../assets/src/engine/calculator';
import { evaluate, parse } from '../../assets/src/engine/expression';

const root = path.resolve( __dirname, '../..' );
const fixturesDir = path.join( root, 'tests/fixtures/parity' );
const read = ( file ) => JSON.parse( fs.readFileSync( file, 'utf8' ) );

const expectSame = ( actual, expected ) => {
	if ( typeof expected === 'number' ) {
		expect( typeof actual ).toBe( 'number' );
		expect( actual ).toBeCloseTo( expected, 9 );
	} else {
		expect( actual ).toEqual( expected );
	}
};

describe( 'parity: expressions', () => {
	const fixture = read( path.join( fixturesDir, 'expressions.json' ) );
	const resolve = ( key ) =>
		key in fixture.values ? fixture.values[ key ] : null;

	it.each( fixture.cases )( '$expr', ( { expr, expected } ) => {
		expectSame( evaluate( expr, resolve ), expected );
	} );

	it.each( fixture.invalid )( 'rejects %p', ( expr ) => {
		expect( () => parse( expr ) ).toThrow();
	} );
} );

const scenarioFiles = fs
	.readdirSync( fixturesDir )
	.filter( ( file ) => file !== 'expressions.json' );

describe.each( scenarioFiles )( 'parity: %s', ( file ) => {
	const fixture = read( path.join( fixturesDir, file ) );
	const config = fixture.configFile
		? read( path.join( root, fixture.configFile ) )
		: fixture.config;

	it.each( fixture.cases )( '$name', ( { answers, contact, expected } ) => {
		const result = computeResult( config, answers, contact ?? {} );
		expect( result.path ).toEqual( expected.path );
		expect( Object.keys( result.scores ) ).toEqual(
			Object.keys( expected.scores )
		);
		for ( const [ key, value ] of Object.entries( expected.scores ) ) {
			expectSame( result.scores[ key ], value );
		}
		expect( Object.keys( result.vars ) ).toEqual(
			Object.keys( expected.vars )
		);
		for ( const [ key, value ] of Object.entries( expected.vars ) ) {
			expectSame( result.vars[ key ], value );
		}
		expect( result.profile ).toBe( expected.profile );
		expect( result.texts ).toEqual( expected.texts );
		expect( result.actions ).toEqual( expected.actions );
		expect( result.cta ).toBe( expected.cta );
	} );
} );
