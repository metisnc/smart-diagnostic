/**
 * Connecteur MCP : activation, lecture seule par défaut, mode écriture, droits, journal.
 * Le client MCP est simulé en HTTP (JSON-RPC), avec un mot de passe d'application.
 */
const { test, expect } = require( '@playwright/test' );

const ENDPOINT = '/wp-json/smart-diagnostic/mcp';
const PROTOCOL = '2025-06-18';
const SETTINGS = '/wp-admin/edit.php?post_type=sd_diagnostic&page=sd-settings';

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

async function saveMcpSettings( page, { enabled, write } ) {
	await page.goto( SETTINGS );
	await page.getByLabel( 'Enable the MCP connector' ).setChecked( enabled );
	await page
		.getByRole( 'radio', {
			name: write ? /^Read and write/ : /^Read only/,
		} )
		.check();
	await page.click( '#submit' );
	await expect(
		page.locator( '#setting-error-settings_updated' )
	).toBeVisible();
}

/**
 * Client MCP minimal : session ouverte par « initialize », puis appels JSON-RPC.
 *
 * @param {Object} playwright Fixture Playwright.
 * @param {string} baseURL    Adresse du site.
 * @param {string} password   Mot de passe d'application.
 */
async function mcpClient( playwright, baseURL, password ) {
	const auth = Buffer.from(
		`${ process.env.E2E_ADMIN_USER }:${ password }`
	).toString( 'base64' );
	const context = await playwright.request.newContext( {
		baseURL,
		extraHTTPHeaders: {
			Authorization: `Basic ${ auth }`,
			Accept: 'application/json, text/event-stream',
		},
	} );
	let id = 0;
	let session = '';
	const call = async ( method, params = {} ) => {
		const response = await context.post( ENDPOINT, {
			// Après « initialize » : session et version du protocole sur chaque requête.
			headers: session
				? {
						'Mcp-Session-Id': session,
						'MCP-Protocol-Version': PROTOCOL,
					}
				: {},
			data: { jsonrpc: '2.0', id: ++id, method, params },
		} );
		expect( response.status(), await response.text() ).toBeLessThan( 300 );
		session = response.headers()[ 'mcp-session-id' ] ?? session;
		const body = await response.json();
		return body.result ?? body;
	};
	await call( 'initialize', {
		protocolVersion: PROTOCOL,
		capabilities: {},
		clientInfo: { name: 'e2e', version: '1.0.0' },
	} );
	await context.post( ENDPOINT, {
		headers: {
			'Mcp-Session-Id': session,
			'MCP-Protocol-Version': PROTOCOL,
		},
		data: { jsonrpc: '2.0', method: 'notifications/initialized' },
	} );
	const tools = async () =>
		( await call( 'tools/list' ) ).tools.map( ( tool ) => tool.name );
	const tool = async ( name, args = {} ) => {
		const result = await call( 'tools/call', {
			name: `smart-diagnostic-${ name }`,
			arguments: args,
		} );
		const text = result.content?.[ 0 ]?.text ?? '';
		return {
			isError: Boolean( result.isError ),
			text,
			data: result.structuredContent ?? null,
		};
	};
	return { tools, tool, dispose: () => context.dispose() };
}

test( 'MCP connector: off by default, read only, then read and write', async ( {
	page,
	playwright,
	baseURL,
} ) => {
	await login( page );

	// Désactivé par défaut : le serveur MCP n'existe pas.
	await saveMcpSettings( page, { enabled: false, write: false } );
	const anonymous = await playwright.request.newContext( { baseURL } );
	expect( ( await anonymous.post( ENDPOINT, { data: {} } ) ).status() ).toBe(
		404
	);

	// Activation (lecture seule) : prérequis affichés, adresse de connexion.
	await saveMcpSettings( page, { enabled: true, write: false } );
	await expect( page.locator( '.sd-mcp-checks li' ) ).toHaveText( [
		/✅/,
		/✅/,
	] );
	await expect( page.locator( '.sd-mcp-endpoint' ) ).toContainText(
		'/smart-diagnostic/mcp'
	);

	// Sans authentification : refusé.
	expect(
		( await anonymous.post( ENDPOINT, { data: {} } ) ).status()
	).toBeGreaterThanOrEqual( 400 );
	await anonymous.dispose();

	// Mot de passe d'application de l'utilisateur de test (API REST, session admin).
	const nonce = await (
		await page.request.get( '/wp-admin/admin-ajax.php?action=rest-nonce' )
	).text();
	const created = await page.request.post(
		'/wp-json/wp/v2/users/me/application-passwords',
		{
			headers: { 'X-WP-Nonce': nonce },
			data: { name: `mcp-e2e-${ Date.now() }` },
		}
	);
	expect( created.status() ).toBe( 201 );
	const { password, uuid } = await created.json();

	try {
		let client = await mcpClient( playwright, baseURL, password );
		let names = await client.tools();
		expect( names ).toContain( 'smart-diagnostic-list-diagnostics' );
		expect( names ).toContain( 'smart-diagnostic-preview-diagnostic' );
		expect( names ).toContain( 'smart-diagnostic-get-stats' );
		// Lecture seule : ni création, ni modification ; jamais de suppression.
		expect( names.join( ' ' ) ).not.toMatch( /create|update|delete/ );

		const list = await client.tool( 'list-diagnostics' );
		expect( list.isError ).toBe( false );
		const demo = list.data.diagnostics.find( ( d ) => d.slug === 'demo' );
		expect( demo ).toBeTruthy();

		const preview = await client.tool( 'preview-diagnostic', {
			id: 'demo',
			answers: {
				q_choice: 'c',
				q_multi: [ 'one' ],
				q_scale: 2,
				q_current: 10,
				q_target: 20,
			},
		} );
		expect( preview.data.questions.length ).toBeGreaterThan( 3 );
		expect( preview.data.result.profile ).toBe( 'profile_low' );
		expect( preview.data.result.profile_label ).toBe( 'Profil 2' );

		const templates = await client.tool( 'list-templates' );
		expect( templates.data.templates.length ).toBeGreaterThanOrEqual( 4 );
		await client.dispose();

		// Lecture et écriture : création depuis un modèle, modification validée.
		await saveMcpSettings( page, { enabled: true, write: true } );
		client = await mcpClient( playwright, baseURL, password );
		names = await client.tools();
		expect( names ).toContain( 'smart-diagnostic-create-from-template' );
		expect( names ).toContain( 'smart-diagnostic-update-diagnostic' );
		expect( names.join( ' ' ) ).not.toMatch( /delete/ );

		const copy = await client.tool( 'create-from-template', {
			template: 'product-finder',
			title: 'Quiz MCP e2e',
		} );
		expect( copy.isError ).toBe( false );
		expect( copy.data.status ).toBe( 'draft' );

		const invalid = await client.tool( 'update-diagnostic', {
			id: copy.data.id,
			config: { schemaVersion: 1, steps: 'not a list' },
		} );
		expect( invalid.isError ).toBe( true );
		expect( invalid.text ).toContain( 'not valid' );

		const read = await client.tool( 'get-diagnostic', {
			id: copy.data.id,
		} );
		const config = read.data.config;
		config.meta = { ...config.meta, title: 'Titre modifié par MCP' };
		const updated = await client.tool( 'update-diagnostic', {
			id: copy.data.id,
			config,
			title: 'Quiz MCP e2e (modifié)',
		} );
		expect( updated.isError ).toBe( false );
		const reread = await client.tool( 'get-diagnostic', {
			id: copy.data.id,
		} );
		expect( reread.data.title ).toBe( 'Quiz MCP e2e (modifié)' );
		expect( reread.data.config.meta.title ).toBe( 'Titre modifié par MCP' );
		await client.dispose();

		// Journal des actions dans les réglages.
		await page.goto( SETTINGS );
		const log = page.locator( '.sd-mcp-log' );
		await expect( log ).toContainText(
			'smart-diagnostic/create-from-template'
		);
		await expect( log ).toContainText(
			'smart-diagnostic/update-diagnostic'
		);
		await expect( log ).toContainText( 'not valid' );

		// Nettoyage : brouillon créé mis à la corbeille.
		await page.goto(
			`/wp-admin/post.php?post=${ copy.data.id }&action=edit`
		);
		await page.locator( '#delete-action a' ).click();
		await page.waitForURL( /edit\.php/ );
	} finally {
		await page.request.delete(
			`/wp-json/wp/v2/users/me/application-passwords/${ uuid }`,
			{ headers: { 'X-WP-Nonce': nonce } }
		);
		await saveMcpSettings( page, { enabled: false, write: false } );
	}
} );
