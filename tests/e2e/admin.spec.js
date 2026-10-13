/**
 * M6 : constructeur visuel, mode test, éditeur JSON, import / export / duplication.
 */
const fs = require( 'fs' );
const { test, expect } = require( '@playwright/test' );

test.skip(
	! process.env.WP_ADMIN_USER || ! process.env.WP_ADMIN_PASSWORD,
	'WP_ADMIN_USER / WP_ADMIN_PASSWORD not set'
);

test.beforeEach( async ( { page } ) => {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.WP_ADMIN_USER );
	await page.fill( '#user_pass', process.env.WP_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
} );

const tab = ( page, name ) => page.getByRole( 'tab', { name, exact: true } );

test( 'build a diagnostic visually, test it and save it', async ( {
	page,
} ) => {
	await page.goto( '/wp-admin/post-new.php?post_type=sd_diagnostic' );
	await page.fill( '#title', `Builder e2e ${ Date.now() }` );

	// Étape de départ proposée : on renomme la question.
	await tab( page, 'Journey' ).click();
	await page
		.locator( '.sd-b-steps__select', { hasText: 'First question' } )
		.click();
	await page
		.getByLabel( 'Question', { exact: true } )
		.fill( 'Quelle couleur ?' );

	// Ajout d'une question « Oui / Non ».
	await page
		.locator( '.sd-b-steps__add' )
		.getByRole( 'button', { name: 'Question' } )
		.click();
	await page.getByLabel( 'Question type' ).selectOption( 'yes_no' );
	await page
		.getByLabel( 'Question', { exact: true } )
		.fill( 'Avez-vous un site ?' );

	// L'aperçu suit les modifications.
	await expect( page.locator( '.sd-builder__preview' ) ).toContainText(
		'Quelle couleur ?'
	);
	await expect( page.locator( '.sd-builder__status' ) ).toContainText(
		'Valid configuration.'
	);

	// Un axe et des points sur la première question.
	await tab( page, 'Calculation' ).click();
	await page.getByRole( 'button', { name: 'Add an axis' } ).click();
	await tab( page, 'Journey' ).click();
	await page
		.locator( '.sd-b-steps__select', { hasText: 'Quelle couleur ?' } )
		.click();
	await page.getByLabel( 'axis_1' ).first().fill( '40' );

	// Mode test : le score suit la réponse simulée.
	await tab( page, 'Test' ).click();
	// L'aperçu affiche aussi la question : on cible le formulaire de test.
	await page
		.locator( '.sd-b-test' )
		.getByLabel( 'Quelle couleur ?' )
		.selectOption( { label: 'Answer A' } );
	await expect( page.locator( 'td[data-score="axis_1"]' ) ).toHaveText(
		'40'
	);

	// Enregistrement : la config est bien celle construite.
	await page.click( '#publish' );
	await expect( page.locator( '#message' ) ).toBeVisible();
	await tab( page, 'JSON' ).click();
	const json = JSON.parse(
		await page.locator( '.sd-builder__json textarea' ).inputValue()
	);
	expect( json.steps.map( ( step ) => step.type ) ).toEqual( [
		'single',
		'yes_no',
	] );
	expect( json.steps[ 0 ].options[ 0 ].scores ).toEqual( { axis_1: 40 } );
	expect( json.axes[ 0 ].key ).toBe( 'axis_1' );
} );

test( 'invalid JSON is never saved', async ( { page } ) => {
	await page.goto( '/wp-admin/post-new.php?post_type=sd_diagnostic' );
	await page.fill( '#title', `Invalid e2e ${ Date.now() }` );
	await page.click( '#publish' );
	await expect( page.locator( '#message' ) ).toBeVisible();
	const editUrl = page.url();

	await tab( page, 'JSON' ).click();
	await page
		.locator( '.sd-builder__json textarea' )
		.fill( '{ "schemaVersion": 1, "steps": [' );
	await expect( page.locator( '.sd-builder__status' ) ).toContainText(
		'Invalid JSON'
	);
	await page.click( '#publish' );

	// Refusé : message d'erreur, texte saisi conservé, ancienne config intacte.
	await expect( page.locator( '.notice-error' ) ).toContainText(
		'not saved'
	);
	await expect( page.locator( '.sd-builder__json textarea' ) ).toHaveValue(
		/"steps": \[$/
	);
	const exportLink = page
		.getByRole( 'link', { name: 'Export JSON' } )
		.first();
	const [ download ] = await Promise.all( [
		page.waitForEvent( 'download' ),
		exportLink.click(),
	] );
	const saved = JSON.parse(
		fs.readFileSync( await download.path(), 'utf8' )
	);
	expect( saved.steps[ 0 ].key ).toBe( 'q1' );
	expect( page.url() ).toBe( editUrl );
} );

test( 'export, duplicate and import a diagnostic', async ( { page } ) => {
	await page.goto( '/wp-admin/edit.php?post_type=sd_diagnostic' );
	const row = page
		.locator( 'tr', {
			has: page.locator( 'a.row-title', {
				hasText: 'Diagnostic de démonstration',
			} ),
		} )
		.first();

	// Export.
	const exportUrl = await row
		.getByRole( 'link', { name: 'Export JSON', includeHidden: true } )
		.getAttribute( 'href' );
	const [ download ] = await Promise.all( [
		page.waitForEvent( 'download' ),
		page.evaluate( ( url ) => {
			window.location.href = url;
		}, exportUrl ),
	] );
	const exported = fs.readFileSync( await download.path(), 'utf8' );
	expect(
		JSON.parse( exported ).steps.some( ( step ) => step.key === 'q_choice' )
	).toBe( true );

	// Duplication : un brouillon « (copy) » avec la même config.
	const duplicateUrl = await row
		.getByRole( 'link', { name: 'Duplicate', includeHidden: true } )
		.getAttribute( 'href' );
	await page.goto( duplicateUrl );
	await expect( page.locator( '#title' ) ).toHaveValue( /\(copy\)$/ );
	await tab( page, 'JSON' ).click();
	expect(
		await page.locator( '.sd-builder__json textarea' ).inputValue()
	).toContain( 'q_choice' );

	// Import par copier-coller.
	await page.goto(
		'/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-import'
	);
	const title = `Imported e2e ${ Date.now() }`;
	await page.fill( '#sd-import-title', title );
	await page.fill( '#sd-import-json', exported );
	await page.getByRole( 'button', { name: 'Import' } ).click();
	await expect( page.locator( '#title' ) ).toHaveValue( title );

	// Import invalide : refusé avec le détail des erreurs.
	await page.goto(
		'/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-import'
	);
	await page.fill( '#sd-import-json', '{"schemaVersion":1}' );
	await page.getByRole( 'button', { name: 'Import' } ).click();
	await expect( page.locator( '.notice-error' ) ).toContainText(
		'not valid'
	);
} );
