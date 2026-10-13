module.exports = {
	root: true,
	extends: [ 'plugin:@wordpress/eslint-plugin/recommended' ],
	settings: {
		react: { version: '18.3' },
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
