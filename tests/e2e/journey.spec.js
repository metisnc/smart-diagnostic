/**
 * Parcours complet sur la page de test (tests/fixtures/demo.json, importé par setup-local.sh).
 */
const { test, expect } = require( '@playwright/test' );

const PAGE = '/diagnostic-test/';

async function start( page ) {
	await page.goto( PAGE );
	await page.evaluate( () => window.localStorage.clear() );
	await page.reload();
	await page.getByRole( 'button', { name: /^(Start|Commencer)$/ } ).click();
}

const next = ( page ) =>
	page.getByRole( 'button', { name: /^(Next|Suivant)$/ } ).click();

test( 'complete journey with conditional step, auto-advance and form', async ( {
	page,
} ) => {
	await start( page );

	await expect(
		page.getByRole( 'heading', { name: 'Votre prénom ?' } )
	).toBeFocused();
	await page.getByRole( 'textbox' ).fill( 'Alice' );
	await next( page );

	// Choix unique + passage automatique.
	await page.getByText( 'Option A', { exact: true } ).click();
	await expect(
		page.getByRole( 'heading', { name: "Cochez ce qui s'applique" } )
	).toBeVisible();

	// « Aucun » est exclusif.
	await page.getByText( 'Élément 1' ).click();
	await page.getByText( 'Aucun' ).click();
	await expect(
		page.getByRole( 'checkbox', { name: /Élément 1/ } )
	).not.toBeChecked();
	await page.getByText( 'Élément 2' ).click();
	await next( page );

	// Étape conditionnelle (affichée car « Option A »).
	await expect(
		page.getByRole( 'heading', { name: /seulement si l'option A/ } )
	).toBeVisible();
	await page.getByText( 'Oui', { exact: true } ).click();

	// Écran intermédiaire + encouragement personnalisé.
	await expect(
		page.getByText( 'Écran intermédiaire de démonstration.' )
	).toBeVisible();
	await next( page );

	await expect( page.getByText( 'À mi-chemin, Alice !' ) ).toBeVisible();
	await page.getByText( '4', { exact: true } ).click();

	await expect( page.getByRole( 'spinbutton' ) ).toBeVisible();
	await next( page );
	await expect( page.getByText( /required|obligatoire/i ) ).toBeVisible();
	await page.getByRole( 'spinbutton' ).fill( '1200' );
	await next( page );

	await expect( page.getByRole( 'slider' ) ).toBeVisible();
	await next( page );

	// Formulaire : consentement obligatoire.
	await page.getByLabel( 'Email' ).fill( 'alice@example.com' );
	const submit = page.getByRole( 'button', {
		name: /^(See my results|Voir mes résultats)$/,
	} );
	await submit.click();
	await expect(
		page.getByText( /Please accept to continue|Veuillez accepter/ )
	).toBeVisible();
	await page.getByRole( 'checkbox' ).check();
	await submit.click();

	await expect(
		page.getByRole( 'heading', { name: 'Votre résultat, Alice' } )
	).toBeVisible( { timeout: 10_000 } );

	// Résultat calculé (voir tests/fixtures/parity/demo.json) : X = 75, Y = 15.
	await expect(
		page.getByRole( 'heading', { name: 'Profil 2' } )
	).toBeVisible();
	await expect(
		page.getByRole( 'row', { name: /Axe X.*75/ } )
	).toBeAttached();
	await expect(
		page.getByRole( 'row', { name: /Axe Y.*15/ } )
	).toBeAttached();
	// Écart = cible (curseur par défaut : 5000) - valeur actuelle (1200).
	await expect( page.getByText( /3[,\s\u202f]?800/ ).first() ).toBeVisible();
	const cta = page.getByRole( 'link', { name: 'Action recommandée' } );
	await expect( cta ).toHaveAttribute( 'href', /utm_campaign=demo/ );
} );

test( 'hidden step is skipped and back button works', async ( { page } ) => {
	await start( page );
	await next( page ); // prénom facultatif
	await page.getByText( 'Option B', { exact: true } ).click();
	await page.getByText( 'Élément 3' ).click();
	await next( page );

	// L'étape conditionnelle est sautée.
	await expect(
		page.getByText( 'Écran intermédiaire de démonstration.' )
	).toBeVisible();

	await page.getByRole( 'button', { name: /^(Back|Retour)$/ } ).click();
	await expect(
		page.getByRole( 'checkbox', { name: /Élément 3/ } )
	).toBeChecked();
} );

test( 'progress is saved and can be resumed', async ( { page } ) => {
	await start( page );
	await page.getByRole( 'textbox' ).fill( 'Bob' );
	await next( page );
	await page.getByText( 'Option C', { exact: true } ).click();
	await expect(
		page.getByRole( 'heading', { name: "Cochez ce qui s'applique" } )
	).toBeVisible();

	await page.reload();
	await page
		.getByRole( 'button', { name: /^(Continue|Continuer)$/ } )
		.click();
	await expect(
		page.getByRole( 'heading', { name: "Cochez ce qui s'applique" } )
	).toBeVisible();
} );
