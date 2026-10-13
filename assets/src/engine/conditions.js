/**
 * Évaluation des conditions déclaratives (showIf, jumpTo, profils, CTA…).
 * Voir $defs/condition dans schema/diagnostic.schema.json.
 */
import { evaluate, truthy } from './expression';
import { isEmptyValue, looseEquals, toNumber } from './values';

const asArray = ( value ) => ( Array.isArray( value ) ? value : [ value ] );

function compare( op, left, value ) {
	switch ( op ) {
		case 'eq':
			return Array.isArray( left )
				? left.some( ( item ) => looseEquals( item, value ) )
				: looseEquals( left, value );
		case 'neq':
			return ! compare( 'eq', left, value );
		case 'gt':
			return toNumber( left ) > toNumber( value );
		case 'gte':
			return toNumber( left ) >= toNumber( value );
		case 'lt':
			return toNumber( left ) < toNumber( value );
		case 'lte':
			return toNumber( left ) <= toNumber( value );
		case 'between': {
			const [ min, max ] = asArray( value );
			const n = toNumber( left );
			return n >= toNumber( min ) && n <= toNumber( max );
		}
		case 'in':
			return asArray( left ).some( ( item ) =>
				asArray( value ).some( ( candidate ) =>
					looseEquals( item, candidate )
				)
			);
		case 'notIn':
			return ! compare( 'in', left, value );
		case 'contains':
			if ( typeof left === 'string' ) {
				return left.includes( String( value ) );
			}
			return asArray( left ?? [] ).some( ( item ) =>
				looseEquals( item, value )
			);
		case 'notContains':
			return ! compare( 'contains', left, value );
		case 'answered':
			return ! isEmptyValue( left );
		case 'empty':
			return isEmptyValue( left );
	}
	return false;
}

/**
 * @param {Object|undefined}                     condition Condition (absente = vraie).
 * @param {{resolve: function(string): unknown}} context   Contexte d'évaluation.
 * @return {boolean} Résultat.
 */
export function evaluateCondition( condition, context ) {
	// Absente ou vide ({} en JSON) : vraie, comme en PHP.
	if ( ! condition || Object.keys( condition ).length === 0 ) {
		return true;
	}
	if ( Array.isArray( condition.all ) ) {
		return condition.all.every( ( item ) =>
			evaluateCondition( item, context )
		);
	}
	if ( Array.isArray( condition.any ) ) {
		return condition.any.some( ( item ) =>
			evaluateCondition( item, context )
		);
	}
	if ( condition.not ) {
		return ! evaluateCondition( condition.not, context );
	}
	if ( typeof condition.expr === 'string' ) {
		try {
			return truthy( evaluate( condition.expr, context.resolve ) );
		} catch ( error ) {
			// Une expression invalide est bloquée à l'enregistrement ; au pire, la condition est fausse.
			return false;
		}
	}
	if (
		typeof condition.left === 'string' &&
		typeof condition.op === 'string'
	) {
		return compare(
			condition.op,
			context.resolve( condition.left ),
			condition.value
		);
	}
	return false;
}
