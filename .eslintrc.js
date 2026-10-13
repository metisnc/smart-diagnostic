module.exports = {
	root: true,
	extends: [ 'plugin:@wordpress/eslint-plugin/recommended' ],
	settings: {
		react: { version: '18.3' },
	},
	rules: {
		// Les fonctions internes ne sont pas toutes documentées paramètre par paramètre.
		'jsdoc/require-param': 'off',
		// Les options sont des <label> qui englobent leur <input>.
		'jsx-a11y/label-has-associated-control': [ 'error', { assert: 'either' } ],
	},
	overrides: [
		{
			files: [ 'tests/**/*.js' ],
			env: { jest: true },
		},
		{
			files: [ 'tests/e2e/**/*.js', 'playwright.config.js' ],
			rules: {
				'import/no-extraneous-dependencies': 'off',
				'import/no-unresolved': 'off',
			},
		},
	],
};
