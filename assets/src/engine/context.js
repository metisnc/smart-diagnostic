/**
 * Contexte d'évaluation : expose les réponses, scores, variables et contact
 * sous forme de chemins (answer.x, count.x, score.y, var.z, contact.email…).
 */

/**
 * Valeur « logique » d'une réponse : agrégat pour multi_amount, valeur brute sinon.
 *
 * @param {Object}  step   Étape de la config.
 * @param {unknown} answer Réponse brute.
 */
export function answerValue( step, answer ) {
	if (
		step?.type === 'multi_amount' &&
		answer &&
		typeof answer === 'object'
	) {
		const values = Object.values( answer )
			.map( Number )
			.filter( Number.isFinite );
		if ( values.length === 0 ) {
			return null;
		}
		switch ( step.aggregate ?? 'sum' ) {
			case 'avg':
				return values.reduce( ( a, b ) => a + b, 0 ) / values.length;
			case 'min':
				return Math.min( ...values );
			case 'max':
				return Math.max( ...values );
			default:
				return values.reduce( ( a, b ) => a + b, 0 );
		}
	}
	return answer;
}

/**
 * @param {Object} params
 * @param {Object} params.config    Config du diagnostic.
 * @param {Object} params.answers   Réponses brutes indexées par clé d'étape.
 * @param {Object} [params.contact] Champs de contact.
 * @param {Object} [params.scores]  Scores par axe.
 * @param {Object} [params.vars]    Variables calculées.
 * @return {{resolve: function(string): unknown}} Contexte.
 */
export function createContext( {
	config,
	answers,
	contact = {},
	scores = {},
	vars = {},
} ) {
	const stepsByKey = new Map(
		( config.steps ?? [] ).map( ( step ) => [ step.key, step ] )
	);

	const axisExtreme = ( pickLowest ) => {
		let best = null;
		for ( const axis of config.axes ?? [] ) {
			const value = scores[ axis.key ];
			if ( typeof value !== 'number' ) {
				continue;
			}
			const span = ( axis.max ?? 100 ) - ( axis.min ?? 0 ) || 1;
			const ratio = ( value - ( axis.min ?? 0 ) ) / span;
			if (
				best === null ||
				( pickLowest ? ratio < best.ratio : ratio > best.ratio )
			) {
				best = { key: axis.key, ratio };
			}
		}
		return best?.key ?? null;
	};

	const dig = ( value, parts ) =>
		parts.reduce(
			( current, part ) =>
				current && typeof current === 'object'
					? current[ part ]
					: undefined,
			value
		);

	function resolve( path ) {
		if ( path === 'weakestAxis' ) {
			return axisExtreme( true );
		}
		if ( path === 'strongestAxis' ) {
			return axisExtreme( false );
		}
		const [ root, key, ...rest ] = path.split( '.' );
		let value;
		switch ( root ) {
			case 'answer':
				value = rest.length
					? answers[ key ]
					: answerValue( stepsByKey.get( key ), answers[ key ] );
				break;
			case 'count': {
				const answer = answers[ key ];
				return Array.isArray( answer ) ? answer.length : 0;
			}
			case 'score':
				value = scores[ key ];
				break;
			case 'var':
				value = vars[ key ];
				break;
			case 'contact':
				value = contact[ key ];
				break;
			default:
				return null;
		}
		value = rest.length ? dig( value, rest ) : value;
		return value === undefined ? null : value;
	}

	return { resolve };
}
