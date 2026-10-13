/**
 * Deux builds :
 *  - front + admin (éditeur JSON) en Preact : le visiteur ne charge pas React ;
 *  - bloc Gutenberg avec la config par défaut (React fourni par WordPress).
 */
const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const DependencyExtractionWebpackPlugin = require( '@wordpress/dependency-extraction-webpack-plugin' );

const REACT_REQUESTS = [ 'react', 'react-dom', 'react/jsx-runtime' ];
// clean: false — les deux builds écrivent dans build/ : aucun ne doit effacer l'autre.
const output = {
	...defaultConfig.output,
	path: path.resolve( __dirname, 'build' ),
	clean: false,
};
// Les deux builds écrivent dans build/ en parallèle : pas de nettoyage automatique.
const basePlugins = defaultConfig.plugins.filter(
	( plugin ) => plugin.constructor.name !== 'CleanWebpackPlugin'
);

const preactConfig = {
	...defaultConfig,
	entry: {
		front: path.resolve( __dirname, 'assets/src/front/index.js' ),
		admin: path.resolve( __dirname, 'assets/src/admin/index.js' ),
	},
	output,
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
		...basePlugins.filter(
			( plugin ) => ! ( plugin instanceof DependencyExtractionWebpackPlugin )
		),
		new DependencyExtractionWebpackPlugin( {
			// false = embarqué dans le bundle (Preact) au lieu de wp.element.
			requestToExternal: ( request ) =>
				REACT_REQUESTS.includes( request ) ? false : undefined,
		} ),
	],
};

const blockConfig = {
	...defaultConfig,
	entry: {
		block: path.resolve( __dirname, 'assets/src/block/index.js' ),
		builder: path.resolve( __dirname, 'assets/src/builder/index.js' ),
	},
	output,
	plugins: basePlugins,
};

module.exports = [ preactConfig, blockConfig ];
