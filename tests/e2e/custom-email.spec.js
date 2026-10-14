/**
 * Éditeur d'emails : éditeur visuel par blocs, variables, aperçu en direct, envoi d'essai,
 * modes JSON / HTML, relance, email réel envoyé après une soumission.
 */
const { test, expect } = require( '@playwright/test' );

const API = '/wp-json/smart-diagnostic/v1/';
const LOG = '/?rest_route=/sd-test/v1/log';
const RUN_FOLLOW_UPS = '/?rest_route=/sd-test/v1/run-follow-ups';

test.describe.configure( { mode: 'serial' } );
test.skip(
	! process.env.E2E_ADMIN_USER || ! process.env.E2E_ADMIN_PASSWORD,
	'E2E_ADMIN_USER / E2E_ADMIN_PASSWORD not set'
);

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

async function publish( page ) {
	await page.click( '#publish' );
	await expect( page.locator( '#message' ) ).toBeVisible();
}

async function submit( page, request, id, email ) {
	const { nonce } = await ( await request.get( `${ API }nonce` ) ).json();
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
}

const mailsTo = async ( request, email ) =>
	( await ( await request.get( LOG ) ).json() ).mails.filter( ( m ) =>
		String( m.to ).includes( email )
	);

const userEmail = ( page ) => page.locator( '.sd-b-email--user' );

// Ouvre le premier bloc (replié par défaut) et renvoie son champ « Heading ».
async function firstHeading( editor ) {
	const toggle = editor.locator( '.sd-b-email__block-toggle' ).first();
	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
		await toggle.click();
	}
	return editor
		.locator( '.sd-b-email__block' )
		.first()
		.getByLabel( 'Heading' );
}
const frameOf = ( page ) =>
	page.frameLocator( '.sd-b-email--user .sd-b-email__frame' );

test( 'visual editor: blocks, variables, live preview, test send and real email', async ( {
	page,
	request,
} ) => {
	const id = await openDemo( page );
	const editor = userEmail( page );

	// Éditeur visuel (depuis le modèle par défaut) : le modèle de départ « résultat » est proposé.
	await editor
		.getByLabel( 'Default template (built from the results)' )
		.check();
	await editor.getByLabel( 'Visual editor' ).check();
	await expect(
		editor.locator( '.sd-b-email__block' ).first()
	).toContainText( 'Heading' );

	// Nouveau bloc texte, avec une variable insérée depuis le menu.
	await editor.getByRole( 'button', { name: 'Add a block' } ).click();
	await page.getByRole( 'menuitem', { name: 'Text', exact: true } ).click();
	const block = editor.locator( '.sd-b-email__block' ).last();
	const field = block.getByLabel( 'Text', { exact: true } );
	await field.fill( 'Coucou ' );
	await block.getByRole( 'button', { name: 'Insert a variable' } ).click();
	await page.getByRole( 'menuitem', { name: /^First name/ } ).click();
	await expect( field ).toHaveValue( 'Coucou {first_name}' );

	// Aperçu (données d'exemple : « Marie »), sur ordinateur puis mobile.
	await editor.getByRole( 'button', { name: 'Preview' } ).click();
	await expect( frameOf( page ).getByText( 'Coucou Marie' ) ).toBeVisible();
	await expect(
		frameOf( page ).getByRole( 'link', { name: 'View my report' } )
	).toBeVisible();
	await editor.getByRole( 'button', { name: 'Mobile' } ).click();
	await expect( editor.locator( '.sd-b-email__frame' ) ).toHaveClass(
		/is-mobile/
	);

	// Style : la couleur choisie s'applique dans l'aperçu en direct.
	await editor.locator( '.sd-b-email__style summary' ).click();
	await editor
		.locator( '.sd-b-email__style .sd-b-color', {
			hasText: /^Main colour/,
		} )
		.locator( 'input[type="color"]' )
		.fill( '#ff5500' );
	await expect(
		frameOf( page ).getByRole( 'link', { name: 'View my report' } )
	).toHaveCSS( 'color', 'rgb(255, 255, 255)' );
	await expect(
		frameOf( page ).locator( 'td:has(> a:has-text("View my report"))' )
	).toHaveCSS( 'background-color', 'rgb(255, 85, 0)' );

	// Envoi d'essai vers l'utilisateur connecté.
	await request.delete( LOG );
	await editor.getByRole( 'button', { name: 'Send me this email' } ).click();
	await expect( editor.locator( '.components-notice' ) ).toContainText(
		'Preview sent to'
	);
	await publish( page );

	// Vraie soumission : l'email suit les blocs, valeurs du visiteur échappées.
	const email = `lea+${ Date.now() }@example.com`;
	await submit( page, request, id, email );
	const mails = await mailsTo( request, email );
	expect( mails ).toHaveLength( 1 );
	expect( mails[ 0 ].message ).toContain( 'Coucou Léa' );
	expect( mails[ 0 ].message ).toContain( 'Profil 2' );
	expect( mails[ 0 ].message ).toMatch( /sd_result=[a-f0-9]{32}/ );
	expect( mails[ 0 ].message ).toContain( '#ff5500' );
	const log = await ( await request.get( LOG ) ).json();
	const preview = log.mails.find( ( m ) =>
		String( m.subject ).startsWith( '[Preview]' )
	);
	expect( preview.message ).toContain( 'Coucou Marie' );
} );

test( 'JSON and HTML modes, then back to the default template', async ( {
	page,
} ) => {
	await openDemo( page );
	const editor = userEmail( page );

	// JSON des blocs : modification appliquée à l'éditeur visuel.
	await editor.getByLabel( 'Edit as JSON' ).check();
	const json = editor.getByLabel( 'Blocks and style (JSON)' );
	const parsed = JSON.parse( await json.inputValue() );
	expect( parsed.blocks[ 0 ].type ).toBe( 'heading' );
	parsed.blocks[ 0 ].text = 'Titre depuis le JSON';
	await json.fill( JSON.stringify( parsed ) );
	await editor.getByLabel( 'Edit as JSON' ).uncheck();
	await expect( await firstHeading( editor ) ).toHaveValue(
		'Titre depuis le JSON'
	);

	// HTML avancé : on part du rendu des blocs.
	// Conversion par le serveur : le mode change à la réponse.
	await editor.getByLabel( 'HTML (advanced)' ).click();
	await expect( editor.getByLabel( 'HTML (advanced)' ) ).toBeChecked();
	const html = editor.getByLabel( 'Email body (HTML)' );
	await expect( html ).toHaveValue( /Titre depuis le JSON<\/h1>/ );
	await expect( html ).toHaveValue( /\{scores\}/ );

	// Retour à l'éditeur visuel (confirmation) : les blocs sont toujours là.
	page.once( 'dialog', ( dialog ) => dialog.accept() );
	await editor.getByLabel( 'Visual editor' ).click();
	await expect( editor.getByLabel( 'Visual editor' ) ).toBeChecked();
	await expect( await firstHeading( editor ) ).toHaveValue(
		'Titre depuis le JSON'
	);

	await editor
		.getByLabel( 'Default template (built from the results)' )
		.check();
	await expect( editor.locator( '.sd-b-email__block' ) ).toHaveCount( 0 );
	await publish( page );
	await page.getByRole( 'tab', { name: 'JSON', exact: true } ).click();
	const config = JSON.parse(
		await page.locator( '.sd-builder__json textarea' ).inputValue()
	);
	expect( config.integrations?.emails?.user?.blocks ).toBeUndefined();
	expect( config.integrations?.emails?.user?.body ).toBeUndefined();
	expect( config.integrations?.emails?.user?.style ).toBeUndefined();
} );

test( 'follow-up email sent a few days later', async ( { page, request } ) => {
	const id = await openDemo( page );
	await page
		.getByLabel( 'Send a follow-up email to the visitor a few days later' )
		.check();
	await page.getByLabel( 'Days after the answer' ).fill( '7' );
	await expect(
		page
			.locator( '.sd-b-email--followUp' )
			.getByLabel( 'Standard follow-up template' )
	).toBeChecked();
	await publish( page );

	const email = `suivi+${ Date.now() }@example.com`;
	await submit( page, request, id, email );
	// Avant la relance : seul l'email du résultat est parti.
	expect( await mailsTo( request, email ) ).toHaveLength( 1 );
	await request.post( RUN_FOLLOW_UPS );
	const mails = await mailsTo( request, email );
	expect( mails ).toHaveLength( 2 );
	// Objet du modèle de départ (traduit selon la langue du site).
	const followUps = mails.slice( 1 );
	expect( followUps[ 0 ].subject ).toContain( 'Léa' );
	expect( followUps[ 0 ].message ).toContain( 'Profil 2' );

	// Remise en état : relance désactivée.
	await page
		.getByRole( 'tab', { name: 'Integrations', exact: true } )
		.click();
	await page
		.getByLabel( 'Send a follow-up email to the visitor a few days later' )
		.uncheck();
	await publish( page );
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
	const cta = frameOf( page ).getByRole( 'link', {
		name: 'Action recommandée',
	} );
	await expect( cta ).toBeVisible();
	await expect( cta ).toHaveCSS( 'background-color', 'rgb(255, 85, 0)' );
} );
