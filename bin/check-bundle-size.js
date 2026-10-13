#!/usr/bin/env node
/**
 * Vérifie que le bundle front reste sous le budget (100 ko gzip).
 */
const fs = require( 'fs' );
const path = require( 'path' );
const zlib = require( 'zlib' );

const BUDGET_BYTES = 100 * 1024;
const buildDir = path.resolve( __dirname, '..', 'build' );
const files = fs.existsSync( buildDir )
	? fs
			.readdirSync( buildDir )
			.filter( ( f ) => f.startsWith( 'front' ) && /\.(js|css)$/.test( f ) )
	: [];

if ( files.length === 0 ) {
	console.error( 'No front bundle found in build/. Run "npm run build" first.' );
	process.exit( 1 );
}

let total = 0;
for ( const file of files ) {
	const size = zlib.gzipSync( fs.readFileSync( path.join( buildDir, file ) ) ).length;
	total += size;
	console.log( `${ file }: ${ ( size / 1024 ).toFixed( 1 ) } kB gzip` );
}
console.log( `Total: ${ ( total / 1024 ).toFixed( 1 ) } kB gzip (budget ${ BUDGET_BYTES / 1024 } kB)` );

if ( total > BUDGET_BYTES ) {
	console.error( 'Front bundle exceeds budget.' );
	process.exit( 1 );
}
