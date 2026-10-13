/**
 * Soumission : API REST sécurisée et lien unique de résultat.
 */
const { test, expect } = require( '@playwright/test' );

const PAGE = '/diagnostic-test/';
const API = '/wp-json/smart-diagnostic/v1/';

async function diagnosticId( page ) {
	await page.goto( PAGE );
	return Number(
		await page
			.locator( '[data-sd-diagnostic]' )
			.getAttribute( 'data-sd-diagnostic' )
	);
}

async function nonce( request ) {
	const response = await request.get( `${ API }nonce` );
	return ( await response.json() ).nonce;
}

const validAnswers = {
	first_name: 'Chloé',
	q_choice: 'b',
	q_multi: [ 'one', 'two', 'three' ],
	q_scale: 3,
	q_current: 1000,
	q_target: 1500,
};

test.describe( 'REST API', () => {
	test( 'rejects an invalid nonce', async ( { page, request } ) => {
		const id = await diagnosticId( page );
		const response = await request.post( `${ API }submit`, {
			data: { diagnostic_id: id, answers: validAnswers, nonce: 'bad' },
		} );
		expect( response.status() ).toBe( 403 );
		expect( ( await response.json() ).code ).toBe( 'sd_invalid_nonce' );
	} );

	test( 'silently ignores robots filling the honeypot', async ( {
		page,
		request,
	} ) => {
		const id = await diagnosticId( page );
		const response = await request.post( `${ API }submit`, {
			data: {
				diagnostic_id: id,
				answers: validAnswers,
				nonce: await nonce( request ),
				website: 'http://spam.example',
			},
		} );
		expect( response.status() ).toBe( 200 );
		expect( await response.json() ).toEqual( { ok: true } );
	} );

	test( 'validates answers and consent server-side', async ( {
		page,
		request,
	} ) => {
		const id = await diagnosticId( page );
		const response = await request.post( `${ API }submit`, {
			data: {
				diagnostic_id: id,
				answers: { q_choice: 'b', q_scale: 99 },
				contact: { email: 'chloe@example.com' },
				nonce: await nonce( request ),
			},
		} );
		expect( response.status() ).toBe( 422 );
		const { data } = await response.json();
		expect( data.errors ).toMatchObject( {
			q_multi: 'required',
			q_scale: 'max',
			__consent: 'consentRequired',
		} );
	} );

	test( 'recalculates the result on the server', async ( {
		page,
		request,
	} ) => {
		const id = await diagnosticId( page );
		const response = await request.post( `${ API }submit`, {
			data: {
				diagnostic_id: id,
				answers: validAnswers,
				contact: { email: 'chloe@example.com' },
				consent: true,
				nonce: await nonce( request ),
			},
		} );
		expect( response.status() ).toBe( 201 );
		const body = await response.json();
		expect( body.token ).toMatch( /^[a-f0-9]{32}$/ );
		// B (20/20) + échelle 3 (+25) ; 3 cases cochées (+30) → X 45, Y 50.
		expect( body.result.scores ).toEqual( { axis_x: 45, axis_y: 50 } );
		expect( body.result.vars.gap ).toBe( 500 );

		// Le lien unique affiche le résultat enregistré.
		await page.goto( body.url );
		await expect(
			page.getByRole( 'heading', { name: 'Votre résultat, Chloé' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'row', { name: /Axe X.*45/ } )
		).toBeAttached();
		const robots = await page
			.locator( 'meta[name="robots"]' )
			.getAttribute( 'content' );
		expect( robots ).toContain( 'noindex' );
	} );
} );

test( 'journey ends with a saved result and a working personal link', async ( {
	page,
} ) => {
	await page.goto( PAGE );
	await page.evaluate( () => window.localStorage.clear() );
	await page.reload();
	await page.getByRole( 'button', { name: /^(Start|Commencer)$/ } ).click();
	const next = () =>
		page.getByRole( 'button', { name: /^(Next|Suivant)$/ } ).click();

	await page.getByRole( 'textbox' ).fill( 'Dan' );
	await next();
	await page.getByText( 'Option C', { exact: true } ).click();
	await page.getByText( 'Élément 1' ).click();
	await next();
	await next(); // écran intermédiaire
	await page.getByText( '2', { exact: true } ).click();
	await page.getByRole( 'spinbutton' ).fill( '100' );
	await next();
	await next(); // curseur
	await page.getByLabel( 'Email' ).fill( 'dan@example.com' );
	await page.getByRole( 'checkbox' ).check();
	await page
		.getByRole( 'button', {
			name: /^(See my results|Voir mes résultats)$/,
		} )
		.click();

	await expect(
		page.getByRole( 'heading', { name: 'Votre résultat, Dan' } )
	).toBeVisible( { timeout: 10_000 } );
	const link = page.getByRole( 'textbox', { name: /personal link|lien/i } );
	await expect( link ).toHaveValue( /sd_result=[a-f0-9]{32}/ );

	const url = await link.inputValue();
	const other = await page.context().newPage();
	await other.goto( url );
	await expect(
		other.getByRole( 'heading', { name: 'Votre résultat, Dan' } )
	).toBeVisible();
	// L'adresse email n'est pas exposée dans la page partagée.
	expect( await other.content() ).not.toContain( 'dan@example.com' );
} );
