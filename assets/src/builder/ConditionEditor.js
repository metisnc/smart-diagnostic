/**
 * Éditeur de conditions : comparaison simple, groupes ET / OU / NON, ou expression.
 */
import { Button, SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { parse } from '../engine/expression';
import { formatScalar, parseScalar } from './utils';
import { resolveText } from '../engine/text';

const CHOICE_TYPES = [
	'single',
	'multi',
	'dropdown',
	'image_choice',
	'yes_no',
];

function modeOf( condition ) {
	if ( ! condition ) {
		return 'none';
	}
	for ( const mode of [ 'all', 'any', 'not', 'expr' ] ) {
		if ( mode in condition ) {
			return mode;
		}
	}
	return 'compare';
}

/**
 * Chemins proposés pour le côté gauche d'une comparaison.
 *
 * @param {Object} config Config.
 * @return {Array<{value: string, label: string}>} Options.
 */
export function pathOptions( config ) {
	const label = ( text, fallback ) =>
		resolveText( text, '', config.i18n?.defaultLanguage ) || fallback;
	const options = [];
	for ( const step of config.steps ?? [] ) {
		if ( step.kind === 'question' ) {
			options.push( {
				value: `answer.${ step.key }`,
				label: `${ __( 'Answer', 'smart-diagnostic' ) } · ${ label( step.label, step.key ) }`,
			} );
			if ( step.type === 'multi' ) {
				options.push( {
					value: `count.${ step.key }`,
					label: `${ __( 'Number checked', 'smart-diagnostic' ) } · ${ label( step.label, step.key ) }`,
				} );
			}
		}
		if ( step.kind === 'form' ) {
			for ( const field of step.fields ?? [] ) {
				options.push( {
					value: `contact.${ field.key }`,
					label: `${ __( 'Contact', 'smart-diagnostic' ) } · ${ label( field.label, field.key ) }`,
				} );
			}
		}
	}
	for ( const axis of config.axes ?? [] ) {
		options.push( {
			value: `score.${ axis.key }`,
			label: `${ __( 'Score', 'smart-diagnostic' ) } · ${ label( axis.label, axis.key ) }`,
		} );
	}
	for ( const variable of config.variables ?? [] ) {
		options.push( {
			value: `var.${ variable.key }`,
			label: `${ __( 'Variable', 'smart-diagnostic' ) } · ${ label( variable.label, variable.key ) }`,
		} );
	}
	options.push( {
		value: 'weakestAxis',
		label: __( 'Weakest axis', 'smart-diagnostic' ),
	} );
	options.push( {
		value: 'strongestAxis',
		label: __( 'Strongest axis', 'smart-diagnostic' ),
	} );
	return options;
}

const OPERATORS = () => [
	{ value: 'eq', label: __( 'equals', 'smart-diagnostic' ) },
	{ value: 'neq', label: __( 'differs from', 'smart-diagnostic' ) },
	{ value: 'gt', label: '>' },
	{ value: 'gte', label: '≥' },
	{ value: 'lt', label: '<' },
	{ value: 'lte', label: '≤' },
	{ value: 'between', label: __( 'between (min, max)', 'smart-diagnostic' ) },
	{ value: 'in', label: __( 'is one of (a, b, c)', 'smart-diagnostic' ) },
	{ value: 'notIn', label: __( 'is none of (a, b, c)', 'smart-diagnostic' ) },
	{ value: 'contains', label: __( 'contains', 'smart-diagnostic' ) },
	{
		value: 'notContains',
		label: __( 'does not contain', 'smart-diagnostic' ),
	},
	{ value: 'answered', label: __( 'is answered', 'smart-diagnostic' ) },
	{ value: 'empty', label: __( 'is empty', 'smart-diagnostic' ) },
];

function ValueInput( { condition, config, onChange } ) {
	const { left = '', op = 'eq', value } = condition;
	if ( op === 'answered' || op === 'empty' ) {
		return null;
	}
	if ( op === 'in' || op === 'notIn' || op === 'between' ) {
		return (
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __(
					'Values, separated by commas',
					'smart-diagnostic'
				) }
				value={ ( Array.isArray( value ) ? value : [] )
					.map( formatScalar )
					.join( ', ' ) }
				onChange={ ( raw ) =>
					onChange(
						raw
							.split( ',' )
							.map( ( item ) => item.trim() )
							.filter( Boolean )
							.map( parseScalar )
					)
				}
			/>
		);
	}
	// Réponse à choix : liste des options.
	const [ root, key ] = left.split( '.' );
	const step =
		root === 'answer' &&
		( config.steps ?? [] ).find( ( s ) => s.key === key );
	if ( step && CHOICE_TYPES.includes( step.type ) ) {
		const options =
			step.type === 'yes_no' && ! step.options?.length
				? [
						{ value: true, label: __( 'Yes', 'smart-diagnostic' ) },
						{ value: false, label: __( 'No', 'smart-diagnostic' ) },
					]
				: ( step.options ?? [] );
		return (
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Value', 'smart-diagnostic' ) }
				value={ formatScalar( value ) }
				options={ [
					{ value: '', label: '—' },
					...options.map( ( option ) => ( {
						value: formatScalar( option.value ),
						label:
							resolveText(
								option.label,
								'',
								config.i18n?.defaultLanguage
							) || formatScalar( option.value ),
					} ) ),
				] }
				onChange={ ( raw ) => {
					const option = options.find(
						( o ) => formatScalar( o.value ) === raw
					);
					onChange( option ? option.value : undefined );
				} }
			/>
		);
	}
	if ( left === 'weakestAxis' || left === 'strongestAxis' ) {
		return (
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Axis', 'smart-diagnostic' ) }
				value={ formatScalar( value ) }
				options={ [
					{ value: '', label: '—' },
					...( config.axes ?? [] ).map( ( axis ) => ( {
						value: axis.key,
						label: axis.key,
					} ) ),
				] }
				onChange={ ( raw ) => onChange( raw || undefined ) }
			/>
		);
	}
	return (
		<TextControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ __( 'Value', 'smart-diagnostic' ) }
			value={ formatScalar( value ) }
			onChange={ ( raw ) =>
				onChange( raw === '' ? undefined : parseScalar( raw ) )
			}
		/>
	);
}

/**
 * @param {Object}   props
 * @param {Object}   props.value    Condition (ou undefined).
 * @param {Function} props.onChange Nouvelle condition.
 * @param {Object}   props.config   Config (pour proposer les chemins).
 * @param {string}   [props.label]
 * @param {number}   [props.depth]
 */
export function ConditionEditor( {
	value,
	onChange,
	config,
	label,
	depth = 0,
} ) {
	const mode = modeOf( value );
	const modes = [
		{
			value: 'none',
			label: depth
				? __( '—', 'smart-diagnostic' )
				: __( 'Always', 'smart-diagnostic' ),
		},
		{ value: 'compare', label: __( 'Comparison', 'smart-diagnostic' ) },
		{ value: 'all', label: __( 'All of (AND)', 'smart-diagnostic' ) },
		{ value: 'any', label: __( 'Any of (OR)', 'smart-diagnostic' ) },
		{ value: 'not', label: __( 'Not', 'smart-diagnostic' ) },
		{ value: 'expr', label: __( 'Expression', 'smart-diagnostic' ) },
	];
	const switchMode = ( next ) => {
		switch ( next ) {
			case 'compare':
				return onChange( {
					left: pathOptions( config )[ 0 ]?.value ?? 'answer.',
					op: 'eq',
				} );
			case 'all':
			case 'any':
				return onChange( {
					[ next ]: [
						{
							left: pathOptions( config )[ 0 ]?.value ?? '',
							op: 'answered',
						},
					],
				} );
			case 'not':
				return onChange( {
					not: {
						left: pathOptions( config )[ 0 ]?.value ?? '',
						op: 'answered',
					},
				} );
			case 'expr':
				return onChange( { expr: 'true' } );
			default:
				return onChange( undefined );
		}
	};

	let exprError = '';
	if ( mode === 'expr' ) {
		try {
			parse( value.expr );
		} catch ( error ) {
			exprError = error.message;
		}
	}

	return (
		<fieldset
			className={ `sd-b-condition sd-b-condition--depth-${ depth }` }
		>
			{ label && <legend>{ label }</legend> }
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Condition', 'smart-diagnostic' ) }
				hideLabelFromVision
				value={ mode }
				options={ modes }
				onChange={ switchMode }
			/>
			{ mode === 'compare' && (
				<div className="sd-b-row">
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'What', 'smart-diagnostic' ) }
						value={ value.left }
						options={ pathOptions( config ) }
						onChange={ ( left ) =>
							onChange( { ...value, left, value: undefined } )
						}
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Operator', 'smart-diagnostic' ) }
						value={ value.op }
						options={ OPERATORS() }
						onChange={ ( op ) => onChange( { ...value, op } ) }
					/>
					<ValueInput
						condition={ value }
						config={ config }
						onChange={ ( next ) => {
							const copy = { ...value, value: next };
							if ( next === undefined ) {
								delete copy.value;
							}
							onChange( copy );
						} }
					/>
				</div>
			) }
			{ ( mode === 'all' || mode === 'any' ) && (
				<div className="sd-b-condition__group">
					{ value[ mode ].map( ( child, index ) => (
						<div key={ index } className="sd-b-condition__child">
							<ConditionEditor
								value={ child }
								config={ config }
								depth={ depth + 1 }
								onChange={ ( next ) => {
									const list = [ ...value[ mode ] ];
									if ( next === undefined ) {
										list.splice( index, 1 );
									} else {
										list[ index ] = next;
									}
									onChange(
										list.length
											? { [ mode ]: list }
											: undefined
									);
								} }
							/>
						</div>
					) ) }
					<Button
						variant="link"
						onClick={ () =>
							onChange( {
								[ mode ]: [
									...value[ mode ],
									{
										left:
											pathOptions( config )[ 0 ]?.value ??
											'',
										op: 'answered',
									},
								],
							} )
						}
					>
						{ __( 'Add a condition', 'smart-diagnostic' ) }
					</Button>
				</div>
			) }
			{ mode === 'not' && (
				<ConditionEditor
					value={ value.not }
					config={ config }
					depth={ depth + 1 }
					onChange={ ( next ) =>
						onChange( next ? { not: next } : undefined )
					}
				/>
			) }
			{ mode === 'expr' && (
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					className={ exprError ? 'sd-b-invalid' : undefined }
					label={ __( 'Expression', 'smart-diagnostic' ) }
					help={
						exprError ||
						__(
							'Example: score.axis_1 >= 50 and answer.q2 == "yes"',
							'smart-diagnostic'
						)
					}
					value={ value.expr }
					onChange={ ( expr ) => onChange( { expr } ) }
				/>
			) }
		</fieldset>
	);
}
