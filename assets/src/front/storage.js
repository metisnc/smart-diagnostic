/**
 * Sauvegarde de la progression dans le navigateur (localStorage).
 * La clé inclut une empreinte des étapes : si le parcours change, l'ancienne
 * sauvegarde est ignorée.
 */

const PREFIX = 'sd:';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function hash( text ) {
	let h = 5381;
	for ( let i = 0; i < text.length; i++ ) {
		h = ( ( h << 5 ) + h + text.charCodeAt( i ) ) | 0; // eslint-disable-line no-bitwise
	}
	return ( h >>> 0 ).toString( 36 ); // eslint-disable-line no-bitwise
}

export function storageKey( id, config ) {
	return `${ PREFIX }${ id }:${ hash( JSON.stringify( config.steps ?? [] ) ) }`;
}

export function loadProgress( key ) {
	try {
		const data = JSON.parse( window.localStorage.getItem( key ) ?? 'null' );
		if ( data && Date.now() - data.savedAt < MAX_AGE_MS ) {
			return data;
		}
	} catch ( error ) {
		// Stockage indisponible (navigation privée…) : pas de reprise.
	}
	return null;
}

export function saveProgress( key, state ) {
	try {
		window.localStorage.setItem(
			key,
			JSON.stringify( { ...state, savedAt: Date.now() } )
		);
	} catch ( error ) {
		// Ignoré : la sauvegarde est un confort, pas une obligation.
	}
}

export function clearProgress( key ) {
	try {
		window.localStorage.removeItem( key );
	} catch ( error ) {
		// Ignoré.
	}
}
