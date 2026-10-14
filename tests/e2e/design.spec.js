/**
 * Onglet « Apparence » : thèmes prêts à l'emploi, menus (polices, arrondis, largeur),
 * contrôle de lisibilité, logo (médiathèque ou adresse).
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

async function theme( page ) {
	await tab( page, 'JSON' ).click();
	const config = JSON.parse(
		await page.locator( '.sd-builder__json textarea' ).inputValue()
	);
	await tab( page, 'Appearance' ).click();
	return config.ui ?? {};
}

test( 'appearance: themes, menus, readability and logo', async ( { page } ) => {
	await page.goto( '/wp-admin/post-new.php?post_type=sd_diagnostic' );
	await tab( page, 'Appearance' ).click();
	const design = page.locator( '.sd-b-design' );

	// Thème prêt à l'emploi.
	await design.getByRole( 'button', { name: /Nature green/ } ).click();
	expect( ( await theme( page ) ).theme.colors.primary ).toBe( '#047857' );

	// Menus : police, titres, arrondis, largeur.
	await design.getByLabel( 'Text', { exact: true } ).selectOption( {
		label: 'Georgia',
	} );
	await design.getByLabel( 'Corners' ).selectOption( { label: 'Square' } );
	await design
		.getByLabel( 'Width of the questionnaire' )
		.selectOption( { label: 'Full width' } );
	await design.getByLabel( 'Titles' ).selectOption( { label: 'Custom…' } );
	await design
		.locator( '.sd-b-preset', { hasText: 'Titles' } )
		.getByRole( 'textbox' )
		.fill( 'Playfair Display, serif' );
	let ui = await theme( page );
	expect( ui.theme.fontFamily ).toContain( 'Georgia' );
	expect( ui.theme.headingFontFamily ).toBe( 'Playfair Display, serif' );
	expect( ui.theme.radius ).toBe( '0px' );
	expect( ui.theme.maxWidth ).toBe( '100%' );
	await expect( page.locator( '.sd-builder__status' ) ).toContainText(
		'Valid configuration.'
	);

	// Lisibilité : texte des boutons trop proche de la couleur principale.
	await design
		.locator( '.sd-b-color', { hasText: 'Text on main colour' } )
		.locator( 'input[type="color"]' )
		.fill( '#058060' );
	await expect( design.locator( '.components-notice' ) ).toContainText(
		'hard to read'
	);

	// Logo : bouton de la médiathèque, adresse, aperçu, retrait.
	await expect(
		design.getByRole( 'button', { name: 'Choose or upload a logo' } )
	).toBeVisible();
	await design
		.getByLabel( 'Or logo address (https://…)' )
		.fill( 'https://example.com/logo.png' );
	await expect( design.locator( '.sd-b-logo__preview img' ) ).toHaveAttribute(
		'src',
		'https://example.com/logo.png'
	);
	ui = await theme( page );
	expect( ui.logo.url ).toBe( 'https://example.com/logo.png' );
	await design.getByRole( 'button', { name: 'Remove' } ).click();
	await expect( design.locator( '.sd-b-logo__preview img' ) ).toHaveCount(
		0
	);
} );
