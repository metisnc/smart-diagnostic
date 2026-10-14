/**
 * Onglet « Guide » : ouvert pour un nouveau diagnostic, liste de vérification, navigation.
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

const tab = ( page, name ) => page.getByRole( 'tab', { name, exact: true } );

test( 'a new diagnostic opens on the guide, which leads to the right tabs', async ( {
	page,
} ) => {
	await page.goto( '/wp-admin/post-new.php?post_type=sd_diagnostic' );
	await expect( tab( page, 'Guide' ) ).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const guide = page.locator( '.sd-guide' );
	await expect( guide.locator( '.sd-guide__flow-item' ) ).toHaveCount( 5 );

	// Diagnostic de départ : une seule question, pas de formulaire, pas d'axe…
	await expect( guide.locator( '.sd-guide__progress' ) ).toHaveText(
		'1 / 8'
	);
	await expect(
		guide.getByRole( 'link', { name: 'Start from a ready-made template' } )
	).toHaveAttribute( 'href', /page=sd-templates/ );

	// « Faire » ouvre l'onglet concerné.
	await guide
		.locator( '.sd-guide__checks li', { hasText: 'theme to score' } )
		.getByRole( 'button', { name: 'Do it' } )
		.click();
	await expect( tab( page, 'Calculation' ) ).toHaveAttribute(
		'aria-selected',
		'true'
	);

	await tab( page, 'Guide' ).click();
	await page.getByRole( 'button', { name: 'Start from scratch' } ).click();
	await expect( tab( page, 'Journey' ) ).toHaveAttribute(
		'aria-selected',
		'true'
	);
} );

test( 'an existing diagnostic opens on the journey, the checklist is complete', async ( {
	page,
} ) => {
	await page.goto( '/diagnostic-test/' );
	const id = await page
		.locator( '[data-sd-diagnostic]' )
		.getAttribute( 'data-sd-diagnostic' );
	await page.goto( `/wp-admin/post.php?post=${ id }&action=edit` );
	await expect( tab( page, 'Journey' ) ).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await tab( page, 'Guide' ).click();
	await expect( page.locator( '.sd-guide__checks li.is-todo' ) ).toHaveCount(
		0
	);
} );
