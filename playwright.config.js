/**
 * Tests E2E. Cible par défaut : WordPress local (docker compose).
 *   WP_BASE_URL=http://10.185.10.155 npm run test:e2e
 */
const { defineConfig, devices } = require( '@playwright/test' );

module.exports = defineConfig( {
	testDir: './tests/e2e',
	timeout: 30_000,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [ [ 'github' ], [ 'html', { open: 'never' } ] ] : 'list',
	use: {
		baseURL: process.env.WP_BASE_URL || 'http://localhost:8080',
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'mobile', use: { ...devices[ 'Pixel 7' ] } },
		{ name: 'desktop', use: { ...devices[ 'Desktop Chrome' ] } },
	],
} );
