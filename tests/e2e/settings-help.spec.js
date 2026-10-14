/**
 * Réglages : bouton « i » d'explication à côté de chaque réglage.
 */
const { test, expect } = require( '@playwright/test' );

test.skip(
	! process.env.E2E_ADMIN_USER || ! process.env.E2E_ADMIN_PASSWORD,
	'E2E_ADMIN_USER / E2E_ADMIN_PASSWORD not set'
);

test( 'each setting has an explanation', async ( { page } ) => {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.E2E_ADMIN_USER );
	await page.fill( '#user_pass', process.env.E2E_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
	await page.goto(
		'/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-settings'
	);

	// Un bouton par réglage (19), le libellé des champs reste inchangé.
	expect(
		await page.locator( '.sd-help__button' ).count()
	).toBeGreaterThanOrEqual( 18 );
	await expect(
		page.getByLabel( 'SMTP server', { exact: true } )
	).toHaveCount( 1 );

	const button = page.getByRole( 'button', { name: 'About "Secret key"' } );
	const tip = page.locator( '#sd-help-captcha_secret_key' );
	await expect( tip ).toBeHidden();
	await button.click();
	await expect( tip ).toBeVisible();
	await expect( tip ).toContainText( 'Never share it' );
	await page.keyboard.press( 'Escape' );
	await expect( tip ).toBeHidden();
} );
