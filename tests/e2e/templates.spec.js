/**
 * Bibliothèque de modèles : galerie, aperçu, création d'une copie modifiable.
 */
const { test, expect } = require( '@playwright/test' );

test.skip(
	! process.env.E2E_ADMIN_USER || ! process.env.E2E_ADMIN_PASSWORD,
	'E2E_ADMIN_USER / E2E_ADMIN_PASSWORD not set'
);

test.beforeEach( async ( { page } ) => {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.E2E_ADMIN_USER );
	await page.fill( '#user_pass', process.env.E2E_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
} );

test( 'create a diagnostic from a template', async ( { page } ) => {
	// Accès depuis la liste des diagnostics.
	await page.goto( '/wp-admin/edit.php?post_type=sd_diagnostic' );
	await page
		.getByRole( 'link', { name: 'Create from a template' } )
		.first()
		.click();
	await expect(
		page.getByRole( 'heading', { name: 'Create from a template' } )
	).toBeVisible();

	const cards = page.locator( '.sd-template-card' );
	expect( await cards.count() ).toBeGreaterThanOrEqual( 4 );
	const card = cards.first();
	await expect( card.locator( '.sd-template-card__meta' ) ).toContainText(
		/\d+ questions · about \d+ minutes?/
	);
	const title = (
		await card.locator( '.sd-template-card__title' ).textContent()
	).trim();

	// Aperçu : le questionnaire s'affiche dans une fenêtre, sans rien enregistrer.
	await card.getByRole( 'button', { name: 'Preview' } ).click();
	const dialog = page.locator( '.sd-template-dialog' );
	await expect( dialog ).toBeVisible();
	await expect( dialog.locator( '.sd-welcome' ) ).toBeVisible();
	await dialog.getByRole( 'button', { name: 'Close' } ).click();
	await expect( dialog ).toBeHidden();

	// Copie : brouillon modifiable, avec la configuration du modèle.
	await card.getByRole( 'button', { name: 'Use this template' } ).click();
	await page.waitForURL( /post\.php\?post=\d+&action=edit/ );
	await expect( page.locator( '#title' ) ).toHaveValue( title );
	await expect( page.locator( '#post-status-display' ) ).toContainText(
		'Draft'
	);
	await page.getByRole( 'tab', { name: 'JSON', exact: true } ).click();
	const json = JSON.parse(
		await page.locator( '.sd-builder__json textarea' ).inputValue()
	);
	expect( json.steps.length ).toBeGreaterThan( 3 );

	// Nettoyage : le brouillon créé part à la corbeille.
	page.once( 'dialog', ( d ) => d.accept() );
	await page.locator( '#delete-action a' ).click();
	await page.waitForURL( /edit\.php/ );
} );
