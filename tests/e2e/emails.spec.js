/**
 * Réglages des emails : expéditeur, adresse de réponse, statut d'envoi, email de test,
 * SMTP dédié (vers Mailpit, le faux serveur d'emails de l'environnement de test).
 */
const { test, expect } = require( '@playwright/test' );

const API = '/wp-json/smart-diagnostic/v1/';
const LOG = '/?rest_route=/sd-test/v1/log';
const SETTINGS = '/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-settings';
const MAILPIT = process.env.MAILPIT_URL || 'http://127.0.0.1:8025';

test.describe.configure( { mode: 'serial' } );
test.skip(
	! process.env.E2E_ADMIN_USER || ! process.env.E2E_ADMIN_PASSWORD,
	'E2E_ADMIN_USER / E2E_ADMIN_PASSWORD not set'
);

async function login( page ) {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.E2E_ADMIN_USER );
	await page.fill( '#user_pass', process.env.E2E_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
}

async function saveSettings( page, values ) {
	await page.goto( SETTINGS );
	for ( const [ label, value ] of Object.entries( values ) ) {
		const field = page.getByLabel( label, { exact: true } );
		if ( typeof value === 'boolean' ) {
			await field.setChecked( value );
		} else if (
			( await field.evaluate( ( el ) => el.tagName ) ) === 'SELECT'
		) {
			await field.selectOption( value );
		} else {
			await field.fill( value );
		}
	}
	await page.locator( '#submit' ).first().click();
	await expect(
		page.locator( '#setting-error-settings_updated' )
	).toBeVisible();
}

async function sendTestEmail( page, to ) {
	await page.goto( SETTINGS );
	await page.fill( '#sd-test-email-to', to );
	await page.getByRole( 'button', { name: 'Send a test email' } ).click();
	return page.locator( '.sd-test-email-result' );
}

test( 'sender, reply-to and delivery status', async ( { page, request } ) => {
	await login( page );
	await saveSettings( page, {
		'Sender name': 'Équipe Diagnostic',
		'Sender address': 'diagnostic@example.test',
		'Reply-to address': 'ventes@example.test',
		'Dedicated SMTP': false,
	} );

	// Une soumission : l'email part via WordPress avec l'expéditeur et la réponse réglés.
	await request.delete( LOG );
	await page.goto( '/diagnostic-test/' );
	const id = Number(
		await page
			.locator( '[data-sd-diagnostic]' )
			.getAttribute( 'data-sd-diagnostic' )
	);
	const email = `hugo+${ Date.now() }@example.com`;
	const { nonce } = await ( await request.get( `${ API }nonce` ) ).json();
	const response = await request.post( `${ API }submit`, {
		data: {
			diagnostic_id: id,
			nonce,
			consent: true,
			source_url: page.url(),
			contact: { email },
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
	const mail = log.mails.find( ( m ) => String( m.to ).includes( email ) );
	expect( mail.headers ).toContain(
		'From: Équipe Diagnostic <diagnostic@example.test>'
	);
	expect( mail.headers ).toContain( 'Reply-To: ventes@example.test' );

	// Statut visible dans le détail de la réponse.
	await page.goto(
		`/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-submissions&s=${ encodeURIComponent(
			email
		) }`
	);
	await page
		.locator( 'tbody tr', { hasText: email } )
		.locator( 'strong a' )
		.click();
	await expect(
		page.getByRole( 'cell', {
			name: new RegExp( `Sent to ${ email.replace( '+', '\\+' ) }` ),
		} )
	).toBeVisible();
	await expect(
		page.getByRole( 'cell', { name: /WordPress \/ SMTP plugin/ } ).first()
	).toBeVisible();

	// Email de test via WordPress.
	const result = await sendTestEmail( page, 'test@example.test' );
	await expect( result ).toContainText(
		'Test email sent to test@example.test'
	);
	await expect( result ).toContainText( 'WordPress / SMTP plugin' );
} );

test( 'dedicated SMTP sends through its own server', async ( {
	page,
	request,
} ) => {
	await login( page );
	await saveSettings( page, {
		'Dedicated SMTP': true,
		'SMTP server': 'mailpit',
		Port: '1025',
		Encryption: 'none',
		Username: '',
	} );

	const to = `smtp+${ Date.now() }@example.test`;
	const result = await sendTestEmail( page, to );
	await expect( result ).toContainText( `Test email sent to ${ to }` );
	await expect( result ).toContainText( 'dedicated SMTP' );

	// Reçu par Mailpit, avec l'expéditeur réglé.
	const search = await request.get(
		`${ MAILPIT }/api/v1/search?query=${ encodeURIComponent( `to:"${ to }"` ) }`
	);
	const { messages } = await search.json();
	expect( messages ).toHaveLength( 1 );
	expect( messages[ 0 ].From.Address ).toBe( 'diagnostic@example.test' );
	expect( messages[ 0 ].ReplyTo[ 0 ].Address ).toBe( 'ventes@example.test' );

	// Serveur injoignable : l'erreur est affichée.
	await saveSettings( page, { 'SMTP server': 'smtp.invalid' } );
	const failure = await sendTestEmail( page, to );
	await expect( failure ).toContainText( 'could not be sent' );

	// Remise à l'état initial pour les autres tests.
	await saveSettings( page, {
		'Dedicated SMTP': false,
		'SMTP server': '',
		'Sender name': '',
		'Sender address': '',
		'Reply-to address': '',
	} );
} );
