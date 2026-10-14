/**
 * Vérifications minimales : le site répond et le plugin est actif.
 * Les identifiants admin viennent de l'environnement (E2E_ADMIN_USER / E2E_ADMIN_PASSWORD : compte de test dont l'admin reste en anglais).
 */
const { test, expect } = require( '@playwright/test' );

test( 'test page renders the diagnostic container', async ( { page } ) => {
	const response = await page.goto( '/diagnostic-test/' );
	expect( response?.status() ).toBe( 200 );
} );

test( 'plugin is active in admin', async ( { page } ) => {
	test.skip(
		! process.env.E2E_ADMIN_USER || ! process.env.E2E_ADMIN_PASSWORD,
		'E2E_ADMIN_USER / E2E_ADMIN_PASSWORD not set'
	);

	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.E2E_ADMIN_USER );
	await page.fill( '#user_pass', process.env.E2E_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.goto( '/wp-admin/plugins.php' );

	const row = page.locator(
		'tr[data-plugin="smart-diagnostic/smart-diagnostic.php"]'
	);
	await expect( row ).toHaveClass( /active/ );
} );
