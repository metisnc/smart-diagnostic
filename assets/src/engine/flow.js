/**
 * Navigation dans le parcours : étapes visibles, sauts, progression.
 */
import { evaluateCondition } from './conditions';

export const RESULTS = 'results';

/**
 * Étapes du parcours (les formulaires affichés sous le résultat en sont exclus).
 *
 * @param {Object} config Config.
 * @return {Object[]} Étapes.
 */
export function flowSteps( config ) {
	return ( config.steps ?? [] ).filter(
		( step ) =>
			! ( step.kind === 'form' && step.placement === 'after_results' )
	);
}

export function isVisible( step, context ) {
	return evaluateCondition( step.showIf, context );
}

/**
 * Première étape visible à partir de l'index donné (inclus).
 *
 * @return {string} Clé d'étape, ou RESULTS.
 */
function firstVisibleFrom( steps, index, context ) {
	for ( let i = index; i < steps.length; i++ ) {
		if ( isVisible( steps[ i ], context ) ) {
			return steps[ i ].key;
		}
	}
	return RESULTS;
}

export function firstStepKey( config, context ) {
	return firstVisibleFrom( flowSteps( config ), 0, context );
}

/**
 * Étape suivante après `currentKey`, en tenant compte de jumpTo et showIf.
 *
 * @return {string} Clé d'étape, ou RESULTS.
 */
export function nextStepKey( config, currentKey, context ) {
	const steps = flowSteps( config );
	const index = steps.findIndex( ( step ) => step.key === currentKey );
	if ( index === -1 ) {
		return RESULTS;
	}

	const target = resolveJump( steps[ index ].jumpTo, context );
	if ( target === RESULTS ) {
		return RESULTS;
	}
	if ( target ) {
		const targetIndex = steps.findIndex( ( step ) => step.key === target );
		// Une cible inconnue est ignorée ; une cible masquée mène à la suivante visible.
		if ( targetIndex !== -1 ) {
			return firstVisibleFrom( steps, targetIndex, context );
		}
	}
	return firstVisibleFrom( steps, index + 1, context );
}

function resolveJump( jumpTo, context ) {
	if ( ! jumpTo ) {
		return null;
	}
	if ( typeof jumpTo === 'string' ) {
		return jumpTo;
	}
	const rule = jumpTo.find( ( candidate ) =>
		evaluateCondition( candidate.if, context )
	);
	return rule ? rule.to : null;
}

/**
 * Progression estimée : étapes déjà parcourues + étapes visibles restantes dans l'ordre.
 *
 * @param {Object}   config     Config.
 * @param {string[]} history    Clés des étapes déjà validées.
 * @param {string}   currentKey Étape affichée.
 * @param {Object}   context    Contexte.
 * @return {{current: number, total: number, percent: number}} Progression.
 */
export function progress( config, history, currentKey, context ) {
	const steps = flowSteps( config );
	const index = steps.findIndex( ( step ) => step.key === currentKey );
	let remaining = 0;
	for ( let i = index + 1; i < steps.length; i++ ) {
		if ( isVisible( steps[ i ], context ) ) {
			remaining++;
		}
	}
	const current = history.length + 1;
	const total = current + remaining;
	return {
		current,
		total,
		percent: Math.round( ( ( current - 1 ) / total ) * 100 ),
	};
}

/**
 * Réponses des seules étapes réellement parcourues (une réponse donnée puis
 * contournée par un retour arrière ne compte plus).
 *
 * @param {string[]} path    Clés parcourues.
 * @param {Object}   answers Réponses.
 * @return {Object} Réponses filtrées.
 */
export function answersOnPath( path, answers ) {
	const result = {};
	for ( const key of path ) {
		if ( key in answers ) {
			result[ key ] = answers[ key ];
		}
	}
	return result;
}
