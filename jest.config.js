const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaultConfig,
	testMatch: [ '<rootDir>/tests/js/**/*.test.js' ],
};
