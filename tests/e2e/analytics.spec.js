/**
 * M5 : événements (dataLayer, CustomEvent), tableau de bord, marque blanche.
 */
const { test, expect } = require( '@playwright/test' );

test.describe.configure( { mode: 'serial' } );

test( 'journey events reach the dataLayer and the funnel', async ( {
	page,
} ) => {
	await page.addInitScript( () => {
		window.dataLayer = [];
		window.sdEvents = [];
		document.addEventListener( 'sd:event', ( event ) =>
			window.sdEvents.push( event.detail.event )
		);
	} );
	await page.goto( '/diagnostic-test/' );
	await page.evaluate( () => window.localStorage.clear() );
	await page.reload();

	// Marque blanche : ni le nom du plugin dans le questionnaire, ni dans les
	// identifiants des scripts (le titre du site de test, lui, peut le contenir).
	const widget = await page
		.locator( '[data-sd-diagnostic]' )
		.evaluate( ( el ) => el.outerHTML );
	expect( widget ).not.toContain( 'Smart Diagnostic' );
	expect( await page.content() ).not.toContain( 'smart-diagnostic-front' );

	// Le lot d'événements part après un court délai.
	const sent = page.waitForResponse(
		( response ) =>
			response.url().includes( '/events' ) && response.status() === 200
	);

	await page.getByRole( 'button', { name: /^(Start|Commencer)$/ } ).click();
	await page.getByRole( 'textbox' ).fill( 'Fred' );
	await page.getByRole( 'button', { name: /^(Next|Suivant)$/ } ).click();
	await page.getByText( 'Option B', { exact: true } ).click();
	await expect(
		page.getByRole( 'heading', { name: "Cochez ce qui s'applique" } )
	).toBeVisible();

	const layer = await page.evaluate( () =>
		window.dataLayer.map( ( entry ) => entry.event )
	);
	expect( layer ).toEqual(
		expect.arrayContaining( [ 'sd_start', 'sd_step_view', 'sd_answer' ] )
	);
	expect( await page.evaluate( () => window.sdEvents ) ).toContain( 'start' );
	await sent;
} );

test( 'statistics dashboard shows the funnel', async ( { page } ) => {
	test.skip(
		! process.env.WP_ADMIN_USER || ! process.env.WP_ADMIN_PASSWORD,
		'WP_ADMIN_USER / WP_ADMIN_PASSWORD not set'
	);
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.WP_ADMIN_USER );
	await page.fill( '#user_pass', process.env.WP_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );

	await page.goto(
		'/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-stats'
	);
	const started = Number(
		(
			await page.locator( '[data-kpi="started"] strong' ).innerText()
		).replace( /\D/g, '' )
	);
	expect( started ).toBeGreaterThan( 0 );
	const choiceRow = page.locator( 'tr[data-key="q_choice"] td' ).first();
	expect(
		Number( ( await choiceRow.innerText() ).replace( /\D/g, '' ) )
	).toBeGreaterThan( 0 );
	await expect( page.locator( 'tr[data-key="results"]' ) ).toBeVisible();
} );
