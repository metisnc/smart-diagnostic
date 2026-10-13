/**
 * M4 : emails, webhook signé, admin « Réponses » (filtre, détail, CSV, suppression).
 * Nécessite les aides de test (SD_TEST_HELPERS=1) : emails capturés, récepteur de webhooks.
 */
const crypto = require( 'crypto' );
const fs = require( 'fs' );
const { test, expect } = require( '@playwright/test' );

const API = '/wp-json/smart-diagnostic/v1/';
const LOG = '/?rest_route=/sd-test/v1/log';

test.describe.configure( { mode: 'serial' } );

const email = `eva+${ Date.now() }@example.com`;
let submission;

test( 'submission sends emails and a signed webhook', async ( {
	page,
	request,
} ) => {
	await request.delete( LOG );
	await page.goto( '/diagnostic-test/' );
	const id = Number(
		await page
			.locator( '[data-sd-diagnostic]' )
			.getAttribute( 'data-sd-diagnostic' )
	);
	// Les intégrations (URL de webhook, emails admin) ne sont jamais envoyées au navigateur.
	expect( await page.content() ).not.toContain( 'sd-test/v1/webhook' );

	const { nonce } = await ( await request.get( `${ API }nonce` ) ).json();
	const response = await request.post( `${ API }submit`, {
		data: {
			diagnostic_id: id,
			answers: {
				q_choice: 'a',
				q_follow_up: true,
				q_multi: [ 'one' ],
				q_scale: 5,
				q_current: 100,
				q_target: 900,
			},
			contact: { email, first_name: 'Eva' },
			consent: true,
			nonce,
			source_url: page.url(),
			utm: { source: 'e2e' },
		},
	} );
	expect( response.status() ).toBe( 201 );
	submission = await response.json();

	const log = await ( await request.get( LOG ) ).json();

	const userMail = log.mails.find( ( mail ) =>
		String( mail.to ).includes( email )
	);
	expect( userMail ).toBeTruthy();
	expect( userMail.message ).toContain( submission.token );
	expect( userMail.message ).toContain( 'Profil' );

	const adminMail = log.mails.find(
		( mail ) => ! String( mail.to ).includes( email )
	);
	expect( adminMail ).toBeTruthy();
	expect( adminMail.message ).toContain( email );

	const hook = log.webhooks.find(
		( entry ) => JSON.parse( entry.body ).contact?.email === email
	);
	expect( hook ).toBeTruthy();
	expect( hook.event ).toBe( 'submit' );
	const expected =
		'sha256=' +
		crypto
			.createHmac( 'sha256', log.secret )
			.update( hook.body )
			.digest( 'hex' );
	expect( hook.signature ).toBe( expected );
	const payload = JSON.parse( hook.body );
	expect( payload.utm ).toEqual( { source: 'e2e' } );
	expect( payload.consent.given ).toBe( true );
	expect( payload.result_url ).toBe( submission.url );
} );

test( 'admin lists, filters, exports and deletes submissions', async ( {
	page,
} ) => {
	test.skip(
		! process.env.WP_ADMIN_USER || ! process.env.WP_ADMIN_PASSWORD,
		'WP_ADMIN_USER / WP_ADMIN_PASSWORD not set'
	);
	page.on( 'dialog', ( dialog ) => dialog.accept() );

	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', process.env.WP_ADMIN_USER );
	await page.fill( '#user_pass', process.env.WP_ADMIN_PASSWORD );
	await page.click( '#wp-submit' );

	const list = `/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-submissions&s=${ encodeURIComponent(
		email
	) }`;
	await page.goto( list );
	const row = page.locator( 'tbody tr', { hasText: email } );
	await expect( row ).toHaveCount( 1 );

	// Filtre par profil : la soumission (X élevé, Y faible) est « profile_low ».
	await page.goto( `${ list }&profile=profile_high` );
	await expect( page.locator( 'tbody tr', { hasText: email } ) ).toHaveCount(
		0
	);
	await page.goto( `${ list }&profile=profile_low` );

	// Détail.
	await row.locator( 'strong a' ).click();
	await expect( page.getByRole( 'cell', { name: 'demo-1' } ) ).toBeVisible();
	await expect(
		page.getByRole( 'cell', { name: 'Option A' } )
	).toBeVisible();
	await expect(
		page.getByRole( 'cell', { name: /delivered/ } )
	).toBeVisible();

	// Export CSV (filtré sur cet email).
	await page.goto( list );
	const [ download ] = await Promise.all( [
		page.waitForEvent( 'download' ),
		page.getByRole( 'link', { name: 'Export CSV' } ).click(),
	] );
	const csv = fs.readFileSync( await download.path(), 'utf8' );
	expect( csv.split( '\n' )[ 0 ] ).toContain( 'answer.q_choice' );
	expect( csv ).toContain( email );
	expect( csv ).toContain( 'Option A' );
	expect(
		csv.match( new RegExp( email.replace( '+', '\\+' ), 'g' ) )
	).toHaveLength( 2 ); // email + contact.email

	// Suppression.
	// Le lien n'apparaît qu'au survol : on suit directement son adresse (nonce inclus).
	const deleteUrl = await page
		.locator( 'tbody tr', { hasText: email } )
		.getByRole( 'link', { name: 'Delete' } )
		.getAttribute( 'href' );
	await page.goto( deleteUrl );
	await expect( page.locator( '.notice-success' ) ).toBeVisible();
	await page.goto( list );
	await expect( page.locator( 'tbody tr', { hasText: email } ) ).toHaveCount(
		0
	);

	// Le lien unique ne fonctionne plus.
	await page.goto( submission.url );
	await expect(
		page.getByRole( 'heading', { name: /Votre résultat/ } )
	).toHaveCount( 0 );
} );
