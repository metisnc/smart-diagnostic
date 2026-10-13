/**
 * Appels à l'API REST du plugin. Un nonce expiré (page en cache) est renouvelé
 * une fois automatiquement.
 */

async function postJson( url, body ) {
	try {
		const response = await window.fetch( url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify( body ),
		} );
		const data = await response.json().catch( () => ( {} ) );
		return { ok: response.ok, status: response.status, data };
	} catch ( error ) {
		return { ok: false, status: 0, data: {} };
	}
}

async function refreshNonce( api ) {
	try {
		const response = await window.fetch( `${ api.root }nonce`, {
			credentials: 'same-origin',
		} );
		const data = await response.json();
		if ( data?.nonce ) {
			api.nonce = data.nonce;
			return true;
		}
	} catch ( error ) {
		// Ignoré : l'erreur d'origine est renvoyée.
	}
	return false;
}

/**
 * @param {{root: string, nonce: string}} api  Racine de l'API et nonce (modifié si renouvelé).
 * @param {string}                        path Chemin relatif (ex. "submit").
 * @param {Object}                        body Données.
 * @return {Promise<{ok: boolean, status: number, data: Object}>} Réponse.
 */
export async function post( api, path, body ) {
	let response = await postJson( `${ api.root }${ path }`, {
		...body,
		nonce: api.nonce,
	} );
	if (
		response.status === 403 &&
		response.data?.code === 'sd_invalid_nonce' &&
		( await refreshNonce( api ) )
	) {
		response = await postJson( `${ api.root }${ path }`, {
			...body,
			nonce: api.nonce,
		} );
	}
	return response;
}

/**
 * Paramètres UTM présents dans l'adresse de la page.
 *
 * @return {Object<string, string>} UTM.
 */
export function currentUtm() {
	const utm = {};
	const params = new URLSearchParams( window.location.search );
	for ( const key of [ 'source', 'medium', 'campaign', 'content', 'term' ] ) {
		const value = params.get( `utm_${ key }` );
		if ( value ) {
			utm[ key ] = value;
		}
	}
	return utm;
}
