/**
 * Règles de conversion et de comparaison partagées par les expressions et les conditions.
 * Elles doivent rester identiques côté PHP (M2).
 */

// Même motif qu'en PHP (Values::NUMERIC) : pas d'hexadécimal ni d'Infinity.
const NUMERIC = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;

export function isNumeric( value ) {
	if ( typeof value === 'number' ) {
		return Number.isFinite( value );
	}
	return typeof value === 'string' && NUMERIC.test( value );
}

/**
 * Vérité d'une valeur, identique en PHP : '0' est vrai, tableau / objet vide est faux.
 *
 * @param {unknown} value Valeur.
 * @return {boolean} Vérité.
 */
export function truthy( value ) {
	if ( value === null || value === undefined || value === false ) {
		return false;
	}
	if ( typeof value === 'number' ) {
		return value !== 0 && ! Number.isNaN( value );
	}
	if ( typeof value === 'string' ) {
		return value !== '';
	}
	if ( typeof value === 'object' ) {
		return ! isEmptyValue( value );
	}
	return true;
}

export function toNumber( value ) {
	if ( typeof value === 'boolean' ) {
		return value ? 1 : 0;
	}
	return isNumeric( value ) ? Number( value ) : 0;
}

export function isEmptyValue( value ) {
	if ( value === null || value === undefined || value === '' ) {
		return true;
	}
	if ( Array.isArray( value ) ) {
		return value.length === 0;
	}
	if ( typeof value === 'object' ) {
		return Object.keys( value ).length === 0;
	}
	return false;
}

export function looseEquals( a, b ) {
	if ( a === null || a === undefined || b === null || b === undefined ) {
		return ( a ?? null ) === ( b ?? null );
	}
	if ( typeof a === 'boolean' || typeof b === 'boolean' ) {
		return String( a ) === String( b );
	}
	if ( isNumeric( a ) && isNumeric( b ) ) {
		return Number( a ) === Number( b );
	}
	return String( a ) === String( b );
}
