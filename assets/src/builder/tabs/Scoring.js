/**
 * Onglet « Calcul » : axes, règles de scoring, variables (formules).
 */
import { SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
	I18nText,
	KeyField,
	ListEditor,
	NumberField,
	RangesEditor,
} from '../fields';
import { ConditionEditor } from '../ConditionEditor';
import { uniqueKey, parseNumber } from '../utils';
import { parse } from '../../engine/expression';
import { resolveText } from '../../engine/text';

const RULE_TYPES = () => [
	{
		value: 'range',
		label: __( 'Points by value range', 'smart-diagnostic' ),
	},
	{
		value: 'count',
		label: __( 'Points by number of boxes checked', 'smart-diagnostic' ),
	},
	{
		value: 'condition',
		label: __( 'Points if a condition is met', 'smart-diagnostic' ),
	},
	{
		value: 'multiplier',
		label: __( 'Multiply the score', 'smart-diagnostic' ),
	},
	{ value: 'cap', label: __( 'Cap the score', 'smart-diagnostic' ) },
];

function expressionError( source ) {
	if ( ! source ) {
		return '';
	}
	try {
		parse( source );
		return '';
	} catch ( error ) {
		return error.message;
	}
}

export function ScoringTab( { config, set, languages } ) {
	const axes = config.axes ?? [];
	const questions = ( config.steps ?? [] ).filter(
		( s ) => s.kind === 'question'
	);
	const axisOptions = axes.map( ( a ) => ( {
		value: a.key,
		label: resolveText( a.label, languages[ 0 ] ) || a.key,
	} ) );
	const questionOptions = ( types ) =>
		questions
			.filter( ( q ) => ! types || types.includes( q.type ) )
			.map( ( q ) => ( {
				value: q.key,
				label: `${ q.key } · ${ resolveText( q.label, languages[ 0 ] ) }`.slice(
					0,
					70
				),
			} ) );

	return (
		<div className="sd-b-tab">
			<p className="description">
				{ __(
					'Order of calculation: base value of each axis → points of the chosen answers (Journey tab) → rules below, in order → capping between min and max.',
					'smart-diagnostic'
				) }
			</p>
			<ListEditor
				label={ __( 'Axes', 'smart-diagnostic' ) }
				items={ axes }
				onChange={ ( list ) => set( [ 'axes' ], list ) }
				newItem={ ( items ) => ( {
					key: uniqueKey(
						'axis',
						items.map( ( i ) => i.key )
					),
					label: __( 'New axis', 'smart-diagnostic' ),
					min: 0,
					max: 100,
				} ) }
				addLabel={ __( 'Add an axis', 'smart-diagnostic' ) }
				summary={ ( axis ) =>
					`${ resolveText( axis.label, languages[ 0 ] ) || axis.key } (${ axis.min ?? 0 }–${ axis.max ?? 100 })`
				}
				renderItem={ ( axis, update ) => (
					<>
						<KeyField
							value={ axis.key }
							taken={ axes.map( ( a ) => a.key ) }
							onChange={ ( key ) => update( { ...axis, key } ) }
						/>
						<I18nText
							label={ __( 'Name', 'smart-diagnostic' ) }
							value={ axis.label }
							languages={ languages }
							onChange={ ( label ) =>
								update( { ...axis, label: label ?? '' } )
							}
						/>
						<I18nText
							label={ __( 'Description', 'smart-diagnostic' ) }
							value={ axis.description }
							languages={ languages }
							onChange={ ( description ) =>
								update( { ...axis, description } )
							}
						/>
						<div className="sd-b-row">
							<NumberField
								label={ __(
									'Starting value',
									'smart-diagnostic'
								) }
								value={ axis.base }
								onChange={ ( base ) =>
									update( { ...axis, base } )
								}
							/>
							<NumberField
								label={ __( 'Minimum', 'smart-diagnostic' ) }
								value={ axis.min }
								onChange={ ( min ) =>
									update( { ...axis, min } )
								}
							/>
							<NumberField
								label={ __( 'Maximum', 'smart-diagnostic' ) }
								value={ axis.max }
								onChange={ ( max ) =>
									update( { ...axis, max } )
								}
							/>
						</div>
					</>
				) }
			/>

			<ListEditor
				label={ __( 'Scoring rules', 'smart-diagnostic' ) }
				items={ config.scoring?.rules ?? [] }
				onChange={ ( rules ) => set( [ 'scoring', 'rules' ], rules ) }
				newItem={ () => ( {
					type: 'condition',
					axis: axes[ 0 ]?.key ?? '',
					points: 10,
				} ) }
				addLabel={ __( 'Add a rule', 'smart-diagnostic' ) }
				summary={ ( rule ) =>
					`${ RULE_TYPES().find( ( t ) => t.value === rule.type )?.label ?? rule.type } → ${ rule.axis }`
				}
				renderItem={ ( rule, update ) => {
					const patch = ( changes ) => {
						const next = { ...rule, ...changes };
						Object.keys( next ).forEach(
							( k ) => next[ k ] === undefined && delete next[ k ]
						);
						update( next );
					};
					const pointsError =
						typeof rule.points === 'string'
							? expressionError( rule.points )
							: '';
					return (
						<>
							<div className="sd-b-row">
								<SelectControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Rule', 'smart-diagnostic' ) }
									value={ rule.type }
									options={ RULE_TYPES() }
									onChange={ ( type ) =>
										update( {
											type,
											axis: rule.axis,
											...( rule.when
												? { when: rule.when }
												: {} ),
											...( type === 'range' ||
											type === 'count'
												? {
														question:
															questionOptions(
																type === 'count'
																	? [
																			'multi',
																		]
																	: null
															)[ 0 ]?.value ?? '',
														ranges: [
															{ points: 0 },
														],
													}
												: {} ),
											...( type === 'condition'
												? { points: 10 }
												: {} ),
											...( type === 'multiplier'
												? { factor: 1 }
												: {} ),
										} )
									}
								/>
								<SelectControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Axis', 'smart-diagnostic' ) }
									value={ rule.axis }
									options={ axisOptions }
									onChange={ ( axis ) => patch( { axis } ) }
								/>
							</div>
							{ ( rule.type === 'range' ||
								rule.type === 'count' ) && (
								<>
									<SelectControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __(
											'Question',
											'smart-diagnostic'
										) }
										value={ rule.question }
										options={ questionOptions(
											rule.type === 'count'
												? [ 'multi' ]
												: [
														'number',
														'amount',
														'slider',
														'scale',
														'multi_amount',
													]
										) }
										onChange={ ( question ) =>
											patch( { question } )
										}
									/>
									<RangesEditor
										ranges={ rule.ranges }
										onChange={ ( ranges ) =>
											patch( { ranges } )
										}
									/>
								</>
							) }
							{ rule.type === 'condition' && (
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									className={
										pointsError ? 'sd-b-invalid' : undefined
									}
									label={ __(
										'Points (number or formula)',
										'smart-diagnostic'
									) }
									help={
										pointsError ||
										__(
											'Example: 10, or count.q2 * 3',
											'smart-diagnostic'
										)
									}
									value={ String( rule.points ?? '' ) }
									onChange={ ( raw ) => {
										const n = parseNumber( raw );
										patch( {
											points:
												n !== undefined &&
												String( n ) === raw.trim()
													? n
													: raw,
										} );
									} }
								/>
							) }
							{ rule.type === 'multiplier' && (
								<NumberField
									label={ __( 'Factor', 'smart-diagnostic' ) }
									value={ rule.factor }
									onChange={ ( factor ) =>
										patch( { factor: factor ?? 1 } )
									}
								/>
							) }
							{ rule.type === 'cap' && (
								<div className="sd-b-row">
									<NumberField
										label={ __(
											'Floor',
											'smart-diagnostic'
										) }
										value={ rule.min }
										onChange={ ( min ) => patch( { min } ) }
									/>
									<NumberField
										label={ __(
											'Ceiling',
											'smart-diagnostic'
										) }
										value={ rule.max }
										onChange={ ( max ) => patch( { max } ) }
									/>
								</div>
							) }
							<ConditionEditor
								label={ __(
									'Apply only if',
									'smart-diagnostic'
								) }
								value={ rule.when }
								config={ config }
								onChange={ ( when ) => patch( { when } ) }
							/>
						</>
					);
				} }
			/>

			<ListEditor
				label={ __(
					'Calculated values (formulas)',
					'smart-diagnostic'
				) }
				items={ config.variables ?? [] }
				onChange={ ( list ) => set( [ 'variables' ], list ) }
				newItem={ ( items ) => ( {
					key: uniqueKey(
						'value',
						items.map( ( i ) => i.key )
					),
					expr: '0',
				} ) }
				addLabel={ __( 'Add a calculated value', 'smart-diagnostic' ) }
				summary={ ( variable ) =>
					`${ variable.key } = ${ variable.expr }`
				}
				renderItem={ ( variable, update ) => {
					const error = expressionError( variable.expr );
					return (
						<>
							<KeyField
								value={ variable.key }
								taken={ ( config.variables ?? [] ).map(
									( v ) => v.key
								) }
								onChange={ ( key ) =>
									update( { ...variable, key } )
								}
							/>
							<I18nText
								label={ __( 'Label', 'smart-diagnostic' ) }
								value={ variable.label }
								languages={ languages }
								onChange={ ( label ) =>
									update( { ...variable, label } )
								}
							/>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								className={ error ? 'sd-b-invalid' : undefined }
								label={ __( 'Formula', 'smart-diagnostic' ) }
								help={
									error ||
									__(
										'Example: max(0, answer.target - answer.current). Available: answer.*, score.*, var.*, min, max, round, sum, avg, if…',
										'smart-diagnostic'
									)
								}
								value={ variable.expr }
								onChange={ ( expr ) =>
									update( { ...variable, expr } )
								}
							/>
							<div className="sd-b-row">
								<SelectControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'Display',
										'smart-diagnostic'
									) }
									value={ variable.format?.style ?? 'number' }
									options={ [
										{
											value: 'number',
											label: __(
												'Number',
												'smart-diagnostic'
											),
										},
										{
											value: 'currency',
											label: __(
												'Currency',
												'smart-diagnostic'
											),
										},
										{
											value: 'percent',
											label: __(
												'Percentage',
												'smart-diagnostic'
											),
										},
									] }
									onChange={ ( style ) =>
										update( {
											...variable,
											format: {
												...variable.format,
												style,
											},
										} )
									}
								/>
								<NumberField
									label={ __(
										'Decimals',
										'smart-diagnostic'
									) }
									value={ variable.format?.decimals }
									min={ 0 }
									max={ 6 }
									onChange={ ( decimals ) =>
										update( {
											...variable,
											format: {
												...variable.format,
												decimals,
											},
										} )
									}
								/>
								{ variable.format?.style === 'currency' && (
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __(
											'Currency',
											'smart-diagnostic'
										) }
										value={
											variable.format?.currency ?? ''
										}
										maxLength={ 3 }
										onChange={ ( currency ) =>
											update( {
												...variable,
												format: {
													...variable.format,
													currency:
														currency.toUpperCase(),
												},
											} )
										}
									/>
								) }
							</div>
						</>
					);
				} }
			/>
		</div>
	);
}
