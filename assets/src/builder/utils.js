/**
 * Outils de manipulation immuable de la config.
 */

const isPlainObject = ( value ) =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

const isEmpty = ( value ) =>
	value === undefined ||
	value === '' ||
	( isPlainObject( value ) && Object.keys( value ).length === 0 );

/**
 * Copie de `object` avec `value` au chemin `path`. Une valeur vide (undefined, '' ou
 * objet vide) supprime la clé, pour garder un JSON propre.
 *
 * @param {Object|Array}         object Source.
 * @param {Array<string|number>} path   Chemin.
 * @param {*}                    value  Valeur.
 * @return {Object|Array} Copie modifiée.
 */
export function setIn( object, path, value ) {
	const [ head, ...rest ] = path;
	const source = object ?? ( typeof head === 'number' ? [] : {} );
	const copy = Array.isArray( source ) ? [ ...source ] : { ...source };
	const next = rest.length ? setIn( source[ head ], rest, value ) : value;
	if ( ! Array.isArray( copy ) && isEmpty( next ) ) {
		delete copy[ head ];
	} else {
		copy[ head ] = next;
	}
	return copy;
}

export function getIn( object, path ) {
	return path.reduce(
		( current, key ) =>
			current === null || current === undefined
				? undefined
				: current[ key ],
		object
	);
}

/**
 * Déplace un élément d'une liste.
 *
 * @param {Array}  list Liste.
 * @param {number} from Index de départ.
 * @param {number} to   Index d'arrivée.
 * @return {Array} Nouvelle liste.
 */
export function move( list, from, to ) {
	if ( to < 0 || to >= list.length || from === to ) {
		return list;
	}
	const copy = [ ...list ];
	const [ item ] = copy.splice( from, 1 );
	copy.splice( to, 0, item );
	return copy;
}

/**
 * Clé unique « prefix_n » absente de `existing`.
 *
 * @param {string}   prefix   Préfixe.
 * @param {string[]} existing Clés existantes.
 * @return {string} Clé.
 */
export function uniqueKey( prefix, existing ) {
	let index = existing.length + 1;
	while ( existing.includes( `${ prefix }_${ index }` ) ) {
		index++;
	}
	return `${ prefix }_${ index }`;
}

export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Valeur saisie → valeur JSON : nombre, booléen, ou texte.
 *
 * @param {string} raw Saisie.
 * @return {*} Valeur.
 */
export function parseScalar( raw ) {
	const text = String( raw ).trim();
	if ( text === 'true' ) {
		return true;
	}
	if ( text === 'false' ) {
		return false;
	}
	if ( text !== '' && ! Number.isNaN( Number( text ) ) ) {
		return Number( text );
	}
	return text;
}

export const formatScalar = ( value ) =>
	value === undefined || value === null ? '' : String( value );

/**
 * Nombre saisi, ou undefined si vide (la clé est alors supprimée).
 *
 * @param {string} raw Saisie.
 * @return {number|undefined} Nombre.
 */
export function parseNumber( raw ) {
	if ( raw === '' || raw === null || raw === undefined ) {
		return undefined;
	}
	const n = Number( String( raw ).replace( ',', '.' ) );
	return Number.isFinite( n ) ? n : undefined;
}
