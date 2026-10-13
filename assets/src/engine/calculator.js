/**
 * Calcul du résultat : chemin → scores par axe → variables → profil, textes, actions, CTA.
 * Miroir exact de src/Engine/Calculator.php ; toute évolution se fait des deux côtés,
 * avec une fixture dans tests/fixtures/parity/.
 */
import { evaluateCondition } from './conditions';
import { answerValue, createContext } from './context';
import { evaluate } from './expression';
import { answersOnPath, computePath } from './flow';
import { isEmptyValue, isNumeric, toNumber } from './values';

const CHOICE_TYPES = [
	'single',
	'multi',
	'dropdown',
	'image_choice',
	'yes_no',
];

const selectedValues = ( step, answer ) => {
	if ( step.type === 'multi' ) {
		return Array.isArray( answer ) ? answer : [];
	}
	return isEmptyValue( answer ) ? [] : [ answer ];
};

const findOption = ( step, value ) =>
	( step.options ?? [] ).find( ( option ) => option.value === value );

/**
 * Vrai si la réponse est (ou ne contient que) des réponses de sortie (« Je ne sais pas »).
 *
 * @param {Object}  step   Étape.
 * @param {unknown} answer Réponse.
 * @return {boolean} Réponse de sortie.
 */
export function isExitAnswer( step, answer ) {
	const values = selectedValues( step, answer );
	return (
		values.length > 0 &&
		values.every( ( value ) => findOption( step, value )?.exit )
	);
}

/**
 * Points des options pour une réponse de sortie, selon exit.mode.
 *
 * @param {Object} step Étape.
 * @param {Object} exit Réglage de sortie de l'option.
 * @return {Object<string, number>} Points par axe.
 */
function exitPoints( step, exit ) {
	const mode = exit.mode ?? 'ignore';
	if ( mode === 'ignore' ) {
		return {};
	}
	const regular = ( step.options ?? [] ).filter(
		( option ) => ! option.exit
	);
	const axes = new Set(
		regular.flatMap( ( option ) => Object.keys( option.scores ?? {} ) )
	);
	const points = {};
	for ( const axis of axes ) {
		const values = regular.map(
			( option ) => option.scores?.[ axis ] ?? 0
		);
		if ( mode === 'neutral' ) {
			points[ axis ] =
				values.reduce( ( a, b ) => a + b, 0 ) / values.length;
		} else if ( mode === 'min' ) {
			points[ axis ] = Math.min( ...values );
		} else if ( mode === 'fixed' ) {
			points[ axis ] = toNumber( exit.value );
		}
	}
	return points;
}

function pickRange( ranges, value ) {
	return ranges.find(
		( range ) =>
			( range.min === undefined || value >= range.min ) &&
			( range.max === undefined || value < range.max )
	);
}

/**
 * Scores par axe.
 *
 * @param {Object} config  Config.
 * @param {Object} answers Réponses des étapes parcourues.
 * @param {Object} contact Champs de contact.
 * @return {Object<string, number>} Scores.
 */
export function computeScores( config, answers, contact = {} ) {
	const axes = config.axes ?? [];
	const scores = {};
	for ( const axis of axes ) {
		scores[ axis.key ] = axis.base ?? 0;
	}
	const add = ( axis, points ) => {
		if ( axis in scores ) {
			scores[ axis ] += toNumber( points );
		}
	};
	const stepsByKey = new Map(
		( config.steps ?? [] ).map( ( step ) => [ step.key, step ] )
	);

	// 1. Points des options choisies.
	for ( const step of config.steps ?? [] ) {
		if (
			step.kind !== 'question' ||
			! CHOICE_TYPES.includes( step.type )
		) {
			continue;
		}
		for ( const value of selectedValues( step, answers[ step.key ] ) ) {
			const option = findOption( step, value );
			if ( ! option ) {
				continue;
			}
			const points = option.exit
				? exitPoints( step, option.exit )
				: ( option.scores ?? {} );
			for ( const [ axis, axisPoints ] of Object.entries( points ) ) {
				add( axis, axisPoints );
			}
		}
	}

	// 2. Règles, dans l'ordre ; les conditions voient les scores intermédiaires.
	for ( const rule of config.scoring?.rules ?? [] ) {
		if ( ! ( rule.axis in scores ) ) {
			continue;
		}
		const context = createContext( { config, answers, contact, scores } );
		if ( ! evaluateCondition( rule.when, context ) ) {
			continue;
		}
		switch ( rule.type ) {
			case 'range': {
				const step = stepsByKey.get( rule.question );
				const answer = answers[ rule.question ];
				if ( ! step || isExitAnswer( step, answer ) ) {
					break;
				}
				const value = answerValue( step, answer );
				if ( ! isNumeric( value ) ) {
					break;
				}
				const range = pickRange( rule.ranges, Number( value ) );
				if ( range ) {
					add( rule.axis, range.points );
				}
				break;
			}
			case 'count': {
				const step = stepsByKey.get( rule.question );
				if ( ! step ) {
					break;
				}
				const count = selectedValues(
					step,
					answers[ rule.question ]
				).filter(
					( value ) => ! findOption( step, value )?.exit
				).length;
				const range = pickRange( rule.ranges, count );
				if ( range ) {
					add( rule.axis, range.points );
				}
				break;
			}
			case 'condition': {
				const points =
					typeof rule.points === 'string'
						? safeEvaluate( rule.points, context )
						: rule.points;
				add( rule.axis, points );
				break;
			}
			case 'multiplier':
				scores[ rule.axis ] *= toNumber( rule.factor );
				break;
			case 'cap':
				if ( rule.min !== undefined ) {
					scores[ rule.axis ] = Math.max(
						scores[ rule.axis ],
						rule.min
					);
				}
				if ( rule.max !== undefined ) {
					scores[ rule.axis ] = Math.min(
						scores[ rule.axis ],
						rule.max
					);
				}
				break;
		}
	}

	// 3. Clamp final sur [min, max] de chaque axe.
	for ( const axis of axes ) {
		const min = axis.min ?? 0;
		const max = axis.max ?? 100;
		scores[ axis.key ] = Math.min(
			Math.max( scores[ axis.key ], min ),
			max
		);
	}
	return scores;
}

function safeEvaluate( expression, context ) {
	try {
		return evaluate( expression, context.resolve );
	} catch ( error ) {
		return null;
	}
}

/**
 * Variables calculées, dans l'ordre (chacune voit les précédentes).
 *
 * @param {Object} config  Config.
 * @param {Object} answers Réponses.
 * @param {Object} contact Contact.
 * @param {Object} scores  Scores.
 * @return {Object<string, unknown>} Variables.
 */
export function computeVariables( config, answers, contact, scores ) {
	const vars = {};
	for ( const variable of config.variables ?? [] ) {
		const context = createContext( {
			config,
			answers,
			contact,
			scores,
			vars,
		} );
		const value = safeEvaluate( variable.expr, context );
		vars[ variable.key ] =
			typeof value === 'number' && ! Number.isFinite( value )
				? null
				: value;
	}
	return vars;
}

/**
 * Tri stable par priorité décroissante.
 *
 * @param {Object[]} items Éléments.
 * @return {Object[]} Copie triée.
 */
function byPriority( items ) {
	return ( items ?? [] )
		.map( ( item, index ) => ( { item, index } ) )
		.sort(
			( a, b ) =>
				( b.item.priority ?? 0 ) - ( a.item.priority ?? 0 ) ||
				a.index - b.index
		)
		.map( ( entry ) => entry.item );
}

/**
 * Calcul complet à partir des réponses brutes.
 *
 * @param {Object} config     Config.
 * @param {Object} rawAnswers Réponses (toutes, y compris d'étapes contournées).
 * @param {Object} [contact]  Contact.
 * @return {{path: string[], scores: Object, vars: Object, profile: string|null, texts: string[], actions: string[], cta: string|null}} Résultat.
 */
export function computeResult( config, rawAnswers, contact = {} ) {
	const path = computePath( config, rawAnswers, ( answers ) =>
		createContext( { config, answers, contact } )
	);
	const answers = answersOnPath( path, rawAnswers );
	const scores = computeScores( config, answers, contact );
	const vars = computeVariables( config, answers, contact, scores );
	const context = createContext( { config, answers, contact, scores, vars } );
	const matches = ( item ) => evaluateCondition( item.when, context );
	const outcomes = config.outcomes ?? {};

	return {
		path,
		scores,
		vars,
		profile: byPriority( outcomes.profiles ).find( matches )?.key ?? null,
		texts: byPriority( outcomes.texts )
			.filter( matches )
			.map( ( item ) => item.key ),
		actions: byPriority( outcomes.actions )
			.filter( matches )
			.map( ( item ) => item.key ),
		cta: byPriority( outcomes.ctas ).find( matches )?.key ?? null,
	};
}
