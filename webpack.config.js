/**
 * Build front (Preact) : le visiteur ne charge pas React.
 * Les entrées admin (éditeur, bloc) arriveront en M1 avec la config React par défaut.
 */
const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const DependencyExtractionWebpackPlugin = require( '@wordpress/dependency-extraction-webpack-plugin' );

const REACT_REQUESTS = [ 'react', 'react-dom', 'react/jsx-runtime' ];

module.exports = {
	...defaultConfig,
	entry: {
		front: path.resolve( __dirname, 'assets/src/front/index.js' ),
	},
	output: {
		...defaultConfig.output,
		path: path.resolve( __dirname, 'build' ),
	},
	resolve: {
		...defaultConfig.resolve,
		alias: {
			...defaultConfig.resolve?.alias,
			react: 'preact/compat',
			'react-dom': 'preact/compat',
			'react/jsx-runtime': 'preact/jsx-runtime',
		},
	},
	plugins: [
		...defaultConfig.plugins.filter(
			( plugin ) => ! ( plugin instanceof DependencyExtractionWebpackPlugin )
		),
		new DependencyExtractionWebpackPlugin( {
			// false = embarqué dans le bundle (Preact) au lieu de wp.element.
			requestToExternal: ( request ) =>
				REACT_REQUESTS.includes( request ) ? false : undefined,
		} ),
	],
};
