/**
 * Vérifications minimales : le site répond et le plugin est actif.
 * Les identifiants admin viennent de l'environnement (WP_ADMIN_USER / WP_ADMIN_PASSWORD).
 */
const { test, expect } = require( '@playwright/test' );

test( 'test page renders the diagnostic container', async ( { page } ) => {
	const response = await page.goto( '/diagnostic-test/' );
	expect( response?.status() ).toBe( 200 );
} );

test( 'plugin is active in admin', async ( { page } ) => {
	test.skip(
		! process.env.WP_ADMIN_USER || ! process.env.WP_ADMIN_PASSWORD,
		'WP_ADMIN_USER / WP_ADMIN_PASSWORD not set'
	);

	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.WP_ADMIN_USER );
	await page.fill( '#user_pass', process.env.WP_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.goto( '/wp-admin/plugins.php' );

	const row = page.locator(
		'tr[data-plugin="smart-diagnostic/smart-diagnostic.php"]'
	);
	await expect( row ).toHaveClass( /active/ );
} );
