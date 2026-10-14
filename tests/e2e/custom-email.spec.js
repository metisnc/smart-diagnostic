/**
 * Modèle d'email personnalisé : édition dans le constructeur, aperçu, envoi d'essai,
 * email réel envoyé après une soumission.
 */
const { test, expect } = require( '@playwright/test' );

const API = '/wp-json/smart-diagnostic/v1/';
const LOG = '/?rest_route=/sd-test/v1/log';

test.describe.configure( { mode: 'serial' } );
test.skip(
	! process.env.E2E_ADMIN_USER || ! process.env.E2E_ADMIN_PASSWORD,
	'E2E_ADMIN_USER / E2E_ADMIN_PASSWORD not set'
);

const BODY = [
	'<p>Coucou {first_name} !</p>',
	'<p>Ton profil : {profile}</p>',
	'<p>Ton choix : {answer:q_choice}</p>',
	'{result_button}',
].join( '\n' );

async function openDemo( page ) {
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
	await page
		.getByRole( 'tab', { name: 'Integrations', exact: true } )
		.click();
	return Number( id );
}

const userEmail = ( page ) => page.locator( '.sd-b-email--user' );

test( 'custom visitor email: preview, test send and real email', async ( {
	page,
	request,
} ) => {
	const id = await openDemo( page );

	// Modèle personnalisé : un modèle de départ est proposé, on le remplace.
	await userEmail( page ).getByLabel( 'Custom template' ).check();
	const textarea = userEmail( page ).getByLabel( 'Email body (HTML)' );
	await expect( textarea ).toHaveValue( /\{profile\}/ );
	await textarea.fill( BODY );

	// Insertion d'une variable au curseur.
	await textarea.press( 'End' );
	await userEmail( page )
		.getByRole( 'button', { name: '{scores}', exact: true } )
		.click();
	await expect( textarea ).toHaveValue( /\{result_button\}\{scores\}$/ );

	// Aperçu avec données d'exemple (« Marie », premier profil).
	await userEmail( page ).getByRole( 'button', { name: 'Preview' } ).click();
	const frame = page.frameLocator( '.sd-b-email--user .sd-b-email__frame' );
	await expect( frame.getByText( 'Coucou Marie !' ) ).toBeVisible();
	await expect( frame.getByText( 'Ton profil : Profil 1' ) ).toBeVisible();
	await expect(
		frame.getByRole( 'link', { name: 'View my results' } )
	).toBeVisible();

	// Envoi d'essai vers l'utilisateur connecté.
	await request.delete( LOG );
	await userEmail( page )
		.getByRole( 'button', { name: 'Send me this email' } )
		.click();
	await expect(
		userEmail( page ).locator( '.components-notice' )
	).toContainText( 'Preview sent to' );

	await page.click( '#publish' );
	await expect( page.locator( '#message' ) ).toBeVisible();

	// Vraie soumission : l'email reçu suit le modèle, valeurs du visiteur échappées.
	const { nonce } = await ( await request.get( `${ API }nonce` ) ).json();
	const email = `lea+${ Date.now() }@example.com`;
	const response = await request.post( `${ API }submit`, {
		data: {
			diagnostic_id: id,
			nonce,
			consent: true,
			source_url: new URL( '/diagnostic-test/', page.url() ).toString(),
			contact: { email, first_name: 'Léa' },
			answers: {
				q_choice: 'c',
				q_multi: [ 'one' ],
				q_scale: 2,
				q_current: 10,
				q_target: 20,
			},
		},
	} );
	expect( response.status() ).toBe( 201 );
	const log = await ( await request.get( LOG ) ).json();
	const mails = log.mails.filter( ( m ) => String( m.to ).includes( email ) );
	expect( mails ).toHaveLength( 1 );
	expect( mails[ 0 ].message ).toContain( 'Coucou Léa !' );
	expect( mails[ 0 ].message ).toContain( 'Ton profil : Profil 2' );
	expect( mails[ 0 ].message ).toContain( 'Ton choix : Option C' );
	expect( mails[ 0 ].message ).toMatch( /sd_result=[a-f0-9]{32}/ );
	const preview = log.mails.find( ( m ) =>
		String( m.subject ).startsWith( '[Preview]' )
	);
	expect( preview.message ).toContain( 'Coucou Marie !' );
} );

test( 'back to the default template', async ( { page } ) => {
	await openDemo( page );
	await userEmail( page )
		.getByLabel( 'Default template (built from the results)' )
		.check();
	await expect(
		userEmail( page ).getByLabel( 'Email body (HTML)' )
	).toHaveCount( 0 );
	await page.click( '#publish' );
	await expect( page.locator( '#message' ) ).toBeVisible();
	await page.getByRole( 'tab', { name: 'JSON', exact: true } ).click();
	const json = JSON.parse(
		await page.locator( '.sd-builder__json textarea' ).inputValue()
	);
	expect( json.integrations?.emails?.user?.body ).toBeUndefined();
} );

test( 'the default email reuses the questionnaire appearance', async ( {
	page,
} ) => {
	await openDemo( page );

	// Couleur principale choisie dans l'onglet Apparence (non enregistrée : aperçu seulement).
	await page.getByRole( 'tab', { name: 'Appearance', exact: true } ).click();
	await page
		.locator( '.sd-b-color', { hasText: /^Main colour/ } )
		.locator( 'input[type="color"]' )
		.fill( '#ff5500' );

	await page
		.getByRole( 'tab', { name: 'Integrations', exact: true } )
		.click();
	await userEmail( page ).getByRole( 'button', { name: 'Preview' } ).click();
	const frame = page.frameLocator( '.sd-b-email--user .sd-b-email__frame' );
	const cta = frame.getByRole( 'link', { name: 'Action recommandée' } );
	await expect( cta ).toBeVisible();
	await expect( cta ).toHaveCSS( 'background-color', 'rgb(255, 85, 0)' );
} );
