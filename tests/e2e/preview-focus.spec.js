/**
 * Aperçu ciblé : l'étape sélectionnée (Parcours), l'accueil (Général), le résultat
 * (Résultat), et retour au parcours complet.
 */
const { test, expect } = require( '@playwright/test' );

test.skip(
	! process.env.E2E_ADMIN_USER || ! process.env.E2E_ADMIN_PASSWORD,
	'E2E_ADMIN_USER / E2E_ADMIN_PASSWORD not set'
);

const tab = ( page, name ) => page.getByRole( 'tab', { name, exact: true } );

test( 'the preview follows what is being edited', async ( { page } ) => {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.E2E_ADMIN_USER );
	await page.fill( '#user_pass', process.env.E2E_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
	await page.goto( '/diagnostic-test/' );
	const id = await page
		.locator( '[data-sd-diagnostic]' )
		.getAttribute( 'data-sd-diagnostic' );
	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );

	const preview = page.locator( '.sd-builder__preview' );

	// Parcours : l'étape sélectionnée, même sans passer par les précédentes.
	await tab( page, 'Journey' ).click();
	await page
		.locator( '.sd-b-steps__select', { hasText: 'Cochez ce qui' } )
		.click();
	await expect( preview.locator( '.sd-builder__preview-title' ) ).toHaveText(
		'Preview: Step 3'
	);
	await expect( preview.locator( '.sd-step' ) ).toContainText(
		'Cochez ce qui'
	);

	// Modification : l'aperçu de l'étape suit.
	await page
		.getByLabel( 'Question', { exact: true } )
		.fill( 'Cochez ce qui convient' );
	await expect( preview.locator( '.sd-step' ) ).toContainText(
		'Cochez ce qui convient'
	);

	// Tout le parcours : retour à l'accueil.
	await preview.getByRole( 'button', { name: 'Whole journey' } ).click();
	await expect( preview.locator( '.sd-welcome' ) ).toBeVisible();
	await preview.getByRole( 'button', { name: 'This part' } ).click();
	await expect( preview.locator( '.sd-step' ) ).toContainText(
		'Cochez ce qui convient'
	);

	// Général : l'accueil ; Résultat : la page de résultat (réponses d'exemple).
	await tab( page, 'General' ).click();
	await expect( preview.locator( '.sd-welcome' ) ).toBeVisible();
	await tab( page, 'Results' ).click();
	await expect( preview.locator( '.sd-results' ) ).toBeVisible();
} );
