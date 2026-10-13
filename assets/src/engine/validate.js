/**
 * Validation d'une réponse selon le type de question et ses règles.
 * Renvoie une clé de message (ui.strings) et ses paramètres, ou null si valide.
 */
import { isEmptyValue } from './values';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ().-]{6,20}$/;
const NUMERIC_TYPES = [ 'number', 'amount', 'slider', 'scale' ];

/**
 * @param {Object}  step  Étape question.
 * @param {unknown} value Réponse.
 * @return {{key: string, params?: Object}|null} Erreur.
 */
export function validateAnswer( step, value ) {
	const rules = step.validation ?? {};
	const required = step.required !== false;

	if (
		isEmptyValue( value ) ||
		( step.type === 'multi_amount' &&
			Object.values( value ?? {} ).every( isEmptyValue ) )
	) {
		return required ? { key: 'required' } : null;
	}

	if ( step.type === 'email' && ! EMAIL.test( String( value ).trim() ) ) {
		return { key: 'invalidEmail' };
	}
	if ( step.type === 'phone' && ! PHONE.test( String( value ).trim() ) ) {
		return { key: 'invalidPhone' };
	}

	if ( NUMERIC_TYPES.includes( step.type ) ) {
		return validateNumber( Number( value ), rules );
	}
	if ( step.type === 'multi_amount' ) {
		for ( const fieldValue of Object.values( value ) ) {
			if ( isEmptyValue( fieldValue ) ) {
				continue;
			}
			const error = validateNumber( Number( fieldValue ), rules );
			if ( error ) {
				return error;
			}
		}
		return null;
	}

	if ( step.type === 'multi' ) {
		const count = Array.isArray( value ) ? value.length : 0;
		if ( rules.minSelected !== undefined && count < rules.minSelected ) {
			return { key: 'minSelected', params: { min: rules.minSelected } };
		}
		if ( rules.maxSelected !== undefined && count > rules.maxSelected ) {
			return { key: 'maxSelected', params: { max: rules.maxSelected } };
		}
		return null;
	}

	if ( typeof value === 'string' ) {
		const length = value.trim().length;
		if ( rules.minLength !== undefined && length < rules.minLength ) {
			return { key: 'minLength', params: { min: rules.minLength } };
		}
		if ( rules.maxLength !== undefined && length > rules.maxLength ) {
			return { key: 'maxLength', params: { max: rules.maxLength } };
		}
		if ( rules.pattern ) {
			try {
				if ( ! new RegExp( rules.pattern, 'u' ).test( value ) ) {
					return { key: 'pattern' };
				}
			} catch ( error ) {
				// Motif invalide dans la config : ignoré plutôt que de bloquer le visiteur.
			}
		}
	}
	return null;
}

function validateNumber( number, rules ) {
	if ( ! Number.isFinite( number ) ) {
		return { key: 'invalidNumber' };
	}
	if ( rules.min !== undefined && number < rules.min ) {
		return { key: 'min', params: { min: rules.min } };
	}
	if ( rules.max !== undefined && number > rules.max ) {
		return { key: 'max', params: { max: rules.max } };
	}
	return null;
}
