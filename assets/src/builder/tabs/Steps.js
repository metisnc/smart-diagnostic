/**
 * Onglet « Parcours » : sections et étapes (glisser-déposer), éditeur de l'étape choisie.
 */
import { useState } from '@wordpress/element';
import {
	Button,
	CheckboxControl,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { I18nText, KeyField, ListEditor, NumberField } from '../fields';
import { ConditionEditor } from '../ConditionEditor';
import {
	move,
	uniqueKey,
	formatScalar,
	parseScalar,
	parseNumber,
} from '../utils';
import { resolveText } from '../../engine/text';

const QUESTION_TYPES = () => [
	{ value: 'single', label: __( 'Single choice', 'smart-diagnostic' ) },
	{ value: 'multi', label: __( 'Multiple choice', 'smart-diagnostic' ) },
	{ value: 'dropdown', label: __( 'Dropdown list', 'smart-diagnostic' ) },
	{ value: 'image_choice', label: __( 'Image choice', 'smart-diagnostic' ) },
	{ value: 'yes_no', label: __( 'Yes / No', 'smart-diagnostic' ) },
	{ value: 'scale', label: __( 'Scale (1–N)', 'smart-diagnostic' ) },
	{ value: 'slider', label: __( 'Slider', 'smart-diagnostic' ) },
	{ value: 'number', label: __( 'Number', 'smart-diagnostic' ) },
	{ value: 'amount', label: __( 'Amount', 'smart-diagnostic' ) },
	{
		value: 'multi_amount',
		label: __( 'Several amounts (total)', 'smart-diagnostic' ),
	},
	{ value: 'text', label: __( 'Short text', 'smart-diagnostic' ) },
	{ value: 'textarea', label: __( 'Long text', 'smart-diagnostic' ) },
	{ value: 'email', label: __( 'Email', 'smart-diagnostic' ) },
	{ value: 'phone', label: __( 'Phone', 'smart-diagnostic' ) },
	{ value: 'date', label: __( 'Date', 'smart-diagnostic' ) },
];
const CHOICE_TYPES = [
	'single',
	'multi',
	'dropdown',
	'image_choice',
	'yes_no',
];
const NUMERIC_TYPES = [ 'number', 'amount', 'slider', 'scale', 'multi_amount' ];
const TEXT_TYPES = [ 'text', 'textarea', 'email', 'phone' ];

const KIND_LABELS = () => ( {
	question: __( 'Question', 'smart-diagnostic' ),
	content: __( 'Content', 'smart-diagnostic' ),
	form: __( 'Form', 'smart-diagnostic' ),
} );

function newStep( kind, steps, section ) {
	const key = uniqueKey(
		kind === 'question' ? 'q' : kind,
		steps.map( ( s ) => s.key )
	);
	const base = { key, kind, ...( section ? { section } : {} ) };
	if ( kind === 'question' ) {
		return {
			...base,
			type: 'single',
			label: __( 'New question', 'smart-diagnostic' ),
			options: [
				{ value: 'a', label: __( 'Answer A', 'smart-diagnostic' ) },
				{ value: 'b', label: __( 'Answer B', 'smart-diagnostic' ) },
			],
		};
	}
	if ( kind === 'content' ) {
		return {
			...base,
			variant: 'text',
			body: __( 'Text shown between two questions.', 'smart-diagnostic' ),
		};
	}
	return {
		...base,
		title: __( 'Receive your results', 'smart-diagnostic' ),
		fields: [
			{
				key: 'email',
				type: 'email',
				label: __( 'Email', 'smart-diagnostic' ),
				required: true,
			},
		],
		consent: {
			text: __(
				'I agree to be contacted about my results.',
				'smart-diagnostic'
			),
			version: '1',
		},
	};
}

/**
 * Réponses d'une question à choix, en cartes : libellé (par langue), points par thème,
 * et réglages techniques (valeur, « Je ne sais pas », exclusive) dans « Options avancées ».
 *
 * @param {Object}   props
 * @param {Object}   props.step      Question.
 * @param {Array}    props.axes      Axes (thèmes notés).
 * @param {string[]} props.languages Langues.
 * @param {boolean}  props.advanced  Afficher les réglages techniques.
 * @param {Function} props.onChange  ( options ) => void.
 */
function OptionsEditor( { step, axes, languages, advanced, onChange } ) {
	const options = step.options ?? [];
	const langs = languages.length ? languages : [ '' ];
	const set = ( index, patch ) =>
		onChange(
			options.map( ( option, i ) => {
				if ( i !== index ) {
					return option;
				}
				const next = { ...option, ...patch };
				Object.keys( next ).forEach(
					( k ) => next[ k ] === undefined && delete next[ k ]
				);
				return next;
			} )
		);
	const setLabel = ( index, lang, text ) => {
		const label = options[ index ].label;
		if ( langs.length < 2 ) {
			set( index, { label: text } );
			return;
		}
		const object =
			typeof label === 'object' && label
				? { ...label }
				: { [ langs[ 0 ] ]: label ?? '' };
		object[ lang ] = text;
		set( index, { label: object } );
	};
	const labelOf = ( option, lang ) =>
		typeof option.label === 'object' && option.label
			? ( option.label[ lang ] ?? '' )
			: ( option.label ?? '' );
	const axisName = ( axis ) =>
		resolveText( axis.label, langs[ 0 ] ) || axis.key;

	return (
		<div className="sd-b-answers">
			<p className="sd-b-answers__title">
				{ __( 'Answers', 'smart-diagnostic' ) }
			</p>
			{ axes.length > 0 && (
				<p className="description">
					{ __(
						'For each answer, enter the points it earns on each theme (leave empty for 0).',
						'smart-diagnostic'
					) }
				</p>
			) }
			<ol className="sd-b-answers__list">
				{ options.map( ( option, index ) => (
					<li key={ index } className="sd-b-answer">
						<div className="sd-b-answer__head">
							<span
								className="sd-b-answer__number"
								aria-hidden="true"
							>
								{ index + 1 }
							</span>
							<div className="sd-b-answer__labels">
								{ langs.map( ( lang ) => (
									<label
										key={ lang || 'default' }
										className="sd-b-answer__label"
									>
										{ langs.length > 1 && (
											<span className="sd-b-answer__lang">
												{ lang.toUpperCase() }
											</span>
										) }
										<input
											type="text"
											aria-label={ sprintf(
												/* translators: %d: answer number. */
												__(
													'Answer %d',
													'smart-diagnostic'
												),
												index + 1
											) }
											value={ labelOf( option, lang ) }
											onChange={ ( event ) =>
												setLabel(
													index,
													lang,
													event.target.value
												)
											}
										/>
									</label>
								) ) }
							</div>
							<span className="sd-b-answer__actions">
								<Button
									size="small"
									icon="arrow-up-alt2"
									label={ __(
										'Move up',
										'smart-diagnostic'
									) }
									disabled={ index === 0 }
									onClick={ () =>
										onChange(
											move( options, index, index - 1 )
										)
									}
								/>
								<Button
									size="small"
									icon="arrow-down-alt2"
									label={ __(
										'Move down',
										'smart-diagnostic'
									) }
									disabled={ index === options.length - 1 }
									onClick={ () =>
										onChange(
											move( options, index, index + 1 )
										)
									}
								/>
								<Button
									size="small"
									icon="trash"
									isDestructive
									label={ __( 'Remove', 'smart-diagnostic' ) }
									onClick={ () =>
										onChange(
											options.filter(
												( _, i ) => i !== index
											)
										)
									}
								/>
							</span>
						</div>

						{ axes.length > 0 && ! option.exit && (
							<div className="sd-b-answer__points">
								{ axes.map( ( axis ) => (
									<label
										key={ axis.key }
										className="sd-b-answer__point"
									>
										<span title={ axisName( axis ) }>
											{ axisName( axis ) }
										</span>
										<input
											type="number"
											step="any"
											placeholder="0"
											aria-label={ sprintf(
												/* translators: 1: answer number, 2: theme name. */
												__(
													'Points of answer %1$d for %2$s',
													'smart-diagnostic'
												),
												index + 1,
												axisName( axis )
											) }
											value={
												option.scores?.[ axis.key ] ??
												''
											}
											onChange={ ( event ) => {
												const scores = {
													...option.scores,
												};
												const n = parseNumber(
													event.target.value
												);
												if ( n === undefined ) {
													delete scores[ axis.key ];
												} else {
													scores[ axis.key ] = n;
												}
												set( index, {
													scores: Object.keys(
														scores
													).length
														? scores
														: undefined,
												} );
											} }
										/>
									</label>
								) ) }
							</div>
						) }

						{ advanced && (
							<div className="sd-b-answer__advanced">
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'Internal value',
										'smart-diagnostic'
									) }
									help={ __(
										'Recorded in the answers and the exports.',
										'smart-diagnostic'
									) }
									value={ formatScalar( option.value ) }
									onChange={ ( raw ) =>
										set( index, {
											value: parseScalar( raw ),
										} )
									}
								/>
								<SelectControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'“I don’t know” answer',
										'smart-diagnostic'
									) }
									help={ __(
										'How this answer counts in the score.',
										'smart-diagnostic'
									) }
									value={ option.exit?.mode ?? '' }
									options={ [
										{
											value: '',
											label: __(
												'No (normal answer)',
												'smart-diagnostic'
											),
										},
										{
											value: 'ignore',
											label: __(
												'Yes — counts for nothing',
												'smart-diagnostic'
											),
										},
										{
											value: 'neutral',
											label: __(
												'Yes — average points',
												'smart-diagnostic'
											),
										},
										{
											value: 'min',
											label: __(
												'Yes — minimum points',
												'smart-diagnostic'
											),
										},
										{
											value: 'fixed',
											label: __(
												'Yes — fixed points',
												'smart-diagnostic'
											),
										},
									] }
									onChange={ ( mode ) =>
										set( index, {
											exit: mode
												? {
														mode,
														...( mode === 'fixed'
															? {
																	value:
																		option
																			.exit
																			?.value ??
																		0,
																}
															: {} ),
													}
												: undefined,
										} )
									}
								/>
								{ option.exit?.mode === 'fixed' && (
									<NumberField
										label={ __(
											'Fixed points',
											'smart-diagnostic'
										) }
										value={ option.exit.value ?? 0 }
										onChange={ ( v ) =>
											set( index, {
												exit: {
													mode: 'fixed',
													value: v ?? 0,
												},
											} )
										}
									/>
								) }
								{ step.type === 'multi' && (
									<CheckboxControl
										__nextHasNoMarginBottom
										label={ __(
											'Exclusive (unticks the other answers)',
											'smart-diagnostic'
										) }
										checked={ Boolean( option.exclusive ) }
										onChange={ ( on ) =>
											set( index, {
												exclusive: on || undefined,
											} )
										}
									/>
								) }
							</div>
						) }
						{ option.exit && ! advanced && (
							<p className="description">
								{ __(
									'“I don’t know” answer (see the advanced options).',
									'smart-diagnostic'
								) }
							</p>
						) }
					</li>
				) ) }
			</ol>
			<Button
				variant="secondary"
				icon="plus"
				onClick={ () =>
					onChange( [
						...options,
						{
							value: uniqueKey(
								'option',
								options.map( ( o ) => formatScalar( o.value ) )
							),
							label: __( 'New answer', 'smart-diagnostic' ),
						},
					] )
				}
			>
				{ __( 'Add an answer', 'smart-diagnostic' ) }
			</Button>
			{ step.type === 'image_choice' && (
				<p className="description">
					{ __(
						'Images: edit "image": { "url": … } in the JSON tab.',
						'smart-diagnostic'
					) }
				</p>
			) }
		</div>
	);
}

function QuestionFields( { step, set, config, languages, advanced } ) {
	const rules = step.validation ?? {};
	const setRule = ( key, value ) => set( [ 'validation', key ], value );
	return (
		<>
			<I18nText
				label={ __( 'Question', 'smart-diagnostic' ) }
				value={ step.label }
				languages={ languages }
				onChange={ ( v ) => set( [ 'label' ], v ?? '' ) }
			/>
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Question type', 'smart-diagnostic' ) }
				help={ __( 'How the visitor answers.', 'smart-diagnostic' ) }
				value={ step.type }
				options={ QUESTION_TYPES() }
				onChange={ ( type ) => set( [ 'type' ], type ) }
			/>
			<I18nText
				label={ __( 'Help text', 'smart-diagnostic' ) }
				value={ step.help }
				languages={ languages }
				onChange={ ( v ) => set( [ 'help' ], v ) }
			/>
			{ ( TEXT_TYPES.includes( step.type ) ||
				step.type === 'dropdown' ||
				step.type === 'number' ||
				step.type === 'amount' ) && (
				<I18nText
					label={ __( 'Placeholder', 'smart-diagnostic' ) }
					value={ step.placeholder }
					languages={ languages }
					onChange={ ( v ) => set( [ 'placeholder' ], v ) }
				/>
			) }
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Answer required', 'smart-diagnostic' ) }
				checked={ step.required !== false }
				onChange={ ( on ) =>
					set( [ 'required' ], on ? undefined : false )
				}
			/>
			{ CHOICE_TYPES.includes( step.type ) && (
				<OptionsEditor
					step={ step }
					axes={ config.axes ?? [] }
					languages={ languages }
					advanced={ advanced }
					onChange={ ( options ) => set( [ 'options' ], options ) }
				/>
			) }
			{ step.type === 'multi' && (
				<div className="sd-b-row">
					<NumberField
						label={ __( 'Min. checked', 'smart-diagnostic' ) }
						value={ rules.minSelected }
						min={ 0 }
						onChange={ ( v ) => setRule( 'minSelected', v ) }
					/>
					<NumberField
						label={ __( 'Max. checked', 'smart-diagnostic' ) }
						value={ rules.maxSelected }
						min={ 1 }
						onChange={ ( v ) => setRule( 'maxSelected', v ) }
					/>
				</div>
			) }
			{ NUMERIC_TYPES.includes( step.type ) && (
				<div className="sd-b-row">
					<NumberField
						label={ __( 'Minimum', 'smart-diagnostic' ) }
						value={ rules.min }
						onChange={ ( v ) => setRule( 'min', v ) }
					/>
					<NumberField
						label={ __( 'Maximum', 'smart-diagnostic' ) }
						value={ rules.max }
						onChange={ ( v ) => setRule( 'max', v ) }
					/>
					{ step.type !== 'scale' && (
						<NumberField
							label={ __( 'Step', 'smart-diagnostic' ) }
							value={ rules.step }
							onChange={ ( v ) => setRule( 'step', v ) }
						/>
					) }
				</div>
			) }
			{ ( step.type === 'number' || step.type === 'slider' ) && (
				<I18nText
					label={ __( 'Unit', 'smart-diagnostic' ) }
					value={ step.unit }
					languages={ languages }
					onChange={ ( v ) => set( [ 'unit' ], v ) }
				/>
			) }
			{ ( step.type === 'amount' || step.type === 'multi_amount' ) && (
				<div className="sd-b-row">
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Currency (ISO code)',
							'smart-diagnostic'
						) }
						value={ step.currency ?? '' }
						maxLength={ 3 }
						onChange={ ( v ) =>
							set( [ 'currency' ], v.toUpperCase() || undefined )
						}
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Period', 'smart-diagnostic' ) }
						value={ step.period ?? '' }
						options={ [
							{ value: '', label: '—' },
							{
								value: 'once',
								label: __( 'once', 'smart-diagnostic' ),
							},
							{
								value: 'day',
								label: __( 'per day', 'smart-diagnostic' ),
							},
							{
								value: 'week',
								label: __( 'per week', 'smart-diagnostic' ),
							},
							{
								value: 'month',
								label: __( 'per month', 'smart-diagnostic' ),
							},
							{
								value: 'quarter',
								label: __( 'per quarter', 'smart-diagnostic' ),
							},
							{
								value: 'year',
								label: __( 'per year', 'smart-diagnostic' ),
							},
						] }
						onChange={ ( v ) =>
							set( [ 'period' ], v || undefined )
						}
					/>
				</div>
			) }
			{ step.type === 'multi_amount' && (
				<>
					<ListEditor
						label={ __( 'Amount fields', 'smart-diagnostic' ) }
						items={ step.fields ?? [] }
						onChange={ ( fields ) => set( [ 'fields' ], fields ) }
						newItem={ ( items ) => ( {
							key: uniqueKey(
								'field',
								items.map( ( i ) => i.key )
							),
							label: __( 'Amount', 'smart-diagnostic' ),
						} ) }
						addLabel={ __( 'Add a field', 'smart-diagnostic' ) }
						renderItem={ ( field, update ) => (
							<div className="sd-b-row">
								<KeyField
									value={ field.key }
									onChange={ ( key ) =>
										update( { ...field, key } )
									}
								/>
								<I18nText
									label={ __( 'Label', 'smart-diagnostic' ) }
									value={ field.label }
									languages={ languages }
									onChange={ ( label ) =>
										update( {
											...field,
											label: label ?? '',
										} )
									}
								/>
							</div>
						) }
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Combined value', 'smart-diagnostic' ) }
						value={ step.aggregate ?? 'sum' }
						options={ [
							{
								value: 'sum',
								label: __( 'Sum', 'smart-diagnostic' ),
							},
							{
								value: 'avg',
								label: __( 'Average', 'smart-diagnostic' ),
							},
							{
								value: 'min',
								label: __( 'Minimum', 'smart-diagnostic' ),
							},
							{
								value: 'max',
								label: __( 'Maximum', 'smart-diagnostic' ),
							},
						] }
						onChange={ ( v ) =>
							set( [ 'aggregate' ], v === 'sum' ? undefined : v )
						}
					/>
				</>
			) }
			{ step.type === 'scale' && (
				<div className="sd-b-row">
					<I18nText
						label={ __(
							'Label of the minimum',
							'smart-diagnostic'
						) }
						value={ step.scaleLabels?.min }
						languages={ languages }
						onChange={ ( v ) => set( [ 'scaleLabels', 'min' ], v ) }
					/>
					<I18nText
						label={ __(
							'Label of the maximum',
							'smart-diagnostic'
						) }
						value={ step.scaleLabels?.max }
						languages={ languages }
						onChange={ ( v ) => set( [ 'scaleLabels', 'max' ], v ) }
					/>
				</div>
			) }
			{ TEXT_TYPES.includes( step.type ) && (
				<div className="sd-b-row">
					<NumberField
						label={ __( 'Min. length', 'smart-diagnostic' ) }
						value={ rules.minLength }
						min={ 0 }
						onChange={ ( v ) => setRule( 'minLength', v ) }
					/>
					<NumberField
						label={ __( 'Max. length', 'smart-diagnostic' ) }
						value={ rules.maxLength }
						min={ 1 }
						onChange={ ( v ) => setRule( 'maxLength', v ) }
					/>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Pattern (regex)', 'smart-diagnostic' ) }
						value={ rules.pattern ?? '' }
						onChange={ ( v ) =>
							setRule( 'pattern', v || undefined )
						}
					/>
				</div>
			) }
		</>
	);
}

function ContentFields( { step, set, languages } ) {
	return (
		<>
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Layout', 'smart-diagnostic' ) }
				value={ step.variant }
				options={ [
					{ value: 'text', label: __( 'Text', 'smart-diagnostic' ) },
					{
						value: 'quote',
						label: __( 'Quote', 'smart-diagnostic' ),
					},
					{
						value: 'image',
						label: __( 'Image', 'smart-diagnostic' ),
					},
					{
						value: 'testimonial',
						label: __( 'Testimonial', 'smart-diagnostic' ),
					},
					{
						value: 'promo',
						label: __( 'Promotion', 'smart-diagnostic' ),
					},
				] }
				onChange={ ( v ) => set( [ 'variant' ], v ) }
			/>
			<I18nText
				label={ __( 'Title', 'smart-diagnostic' ) }
				value={ step.title }
				languages={ languages }
				onChange={ ( v ) => set( [ 'title' ], v ) }
			/>
			<I18nText
				multiline
				label={ __( 'Text (basic HTML allowed)', 'smart-diagnostic' ) }
				value={ step.body }
				languages={ languages }
				onChange={ ( v ) => set( [ 'body' ], v ) }
			/>
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				type="url"
				label={ __( 'Image URL', 'smart-diagnostic' ) }
				value={ step.image?.url ?? '' }
				onChange={ ( v ) => set( [ 'image', 'url' ], v || undefined ) }
			/>
			{ ( step.variant === 'quote' ||
				step.variant === 'testimonial' ) && (
				<div className="sd-b-row">
					<I18nText
						label={ __( 'Author', 'smart-diagnostic' ) }
						value={ step.author }
						languages={ languages }
						onChange={ ( v ) => set( [ 'author' ], v ) }
					/>
					<I18nText
						label={ __( 'Author role', 'smart-diagnostic' ) }
						value={ step.authorRole }
						languages={ languages }
						onChange={ ( v ) => set( [ 'authorRole' ], v ) }
					/>
				</div>
			) }
			<div className="sd-b-row">
				<I18nText
					label={ __( 'Button label', 'smart-diagnostic' ) }
					value={ step.cta?.label }
					languages={ languages }
					onChange={ ( v ) => set( [ 'cta', 'label' ], v ) }
				/>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					type="url"
					label={ __( 'Button link', 'smart-diagnostic' ) }
					value={ step.cta?.url ?? '' }
					onChange={ ( v ) =>
						set( [ 'cta', 'url' ], v || undefined )
					}
				/>
			</div>
		</>
	);
}

function FormFields( { step, set, languages } ) {
	return (
		<>
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Position', 'smart-diagnostic' ) }
				value={ step.placement ?? 'inline' }
				options={ [
					{
						value: 'inline',
						label: __(
							'In the journey (before the results)',
							'smart-diagnostic'
						),
					},
					{
						value: 'after_results',
						label: __( 'Below the results', 'smart-diagnostic' ),
					},
				] }
				onChange={ ( v ) =>
					set( [ 'placement' ], v === 'inline' ? undefined : v )
				}
			/>
			<I18nText
				label={ __( 'Title', 'smart-diagnostic' ) }
				value={ step.title }
				languages={ languages }
				onChange={ ( v ) => set( [ 'title' ], v ) }
			/>
			<I18nText
				multiline
				label={ __( 'Text', 'smart-diagnostic' ) }
				value={ step.text }
				languages={ languages }
				onChange={ ( v ) => set( [ 'text' ], v ) }
			/>
			<ListEditor
				label={ __( 'Fields', 'smart-diagnostic' ) }
				items={ step.fields ?? [] }
				onChange={ ( fields ) => set( [ 'fields' ], fields ?? [] ) }
				newItem={ ( items ) => ( {
					key: uniqueKey(
						'field',
						items.map( ( i ) => i.key )
					),
					type: 'text',
					label: __( 'Field', 'smart-diagnostic' ),
				} ) }
				addLabel={ __( 'Add a field', 'smart-diagnostic' ) }
				summary={ ( field ) =>
					`${ resolveText( field.label, languages[ 0 ] ) } (${ field.type })`
				}
				renderItem={ ( field, update ) => (
					<>
						<div className="sd-b-row">
							<KeyField
								value={ field.key }
								onChange={ ( key ) =>
									update( { ...field, key } )
								}
							/>
							<SelectControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Type', 'smart-diagnostic' ) }
								value={ field.type }
								options={ [
									'text',
									'email',
									'phone',
									'select',
									'checkbox',
									'textarea',
								].map( ( t ) => ( { value: t, label: t } ) ) }
								onChange={ ( type ) =>
									update( { ...field, type } )
								}
							/>
						</div>
						<I18nText
							label={ __( 'Label', 'smart-diagnostic' ) }
							value={ field.label }
							languages={ languages }
							onChange={ ( label ) =>
								update( { ...field, label: label ?? '' } )
							}
						/>
						<CheckboxControl
							__nextHasNoMarginBottom
							label={ __( 'Required', 'smart-diagnostic' ) }
							checked={ Boolean( field.required ) }
							onChange={ ( required ) =>
								update( {
									...field,
									required: required || undefined,
								} )
							}
						/>
						<p className="description">
							{ __(
								'Use the keys first_name and email so that emails are personalised and sent.',
								'smart-diagnostic'
							) }
						</p>
					</>
				) }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Consent checkbox (GDPR)', 'smart-diagnostic' ) }
				checked={ Boolean( step.consent ) }
				onChange={ ( on ) =>
					set(
						[ 'consent' ],
						on
							? {
									text: __(
										'I agree to be contacted about my results.',
										'smart-diagnostic'
									),
									version: '1',
								}
							: undefined
					)
				}
			/>
			{ step.consent && (
				<>
					<I18nText
						multiline
						label={ __( 'Consent text', 'smart-diagnostic' ) }
						value={ step.consent.text }
						languages={ languages }
						onChange={ ( v ) =>
							set( [ 'consent', 'text' ], v ?? '' )
						}
					/>
					<div className="sd-b-row">
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Text version', 'smart-diagnostic' ) }
							help={ __(
								'Change it whenever the text changes: it is stored with each consent.',
								'smart-diagnostic'
							) }
							value={ step.consent.version ?? '' }
							onChange={ ( v ) =>
								set( [ 'consent', 'version' ], v )
							}
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Mandatory', 'smart-diagnostic' ) }
							checked={ step.consent.required !== false }
							onChange={ ( on ) =>
								set(
									[ 'consent', 'required' ],
									on ? undefined : false
								)
							}
						/>
					</div>
				</>
			) }
			<I18nText
				label={ __( 'Button label', 'smart-diagnostic' ) }
				value={ step.submitLabel }
				languages={ languages }
				onChange={ ( v ) => set( [ 'submitLabel' ], v ) }
			/>
		</>
	);
}

function JumpEditor( { step, steps, config, onChange } ) {
	// jumpTo : liste de règles, ou simple clé d'étape (saut inconditionnel).
	let rules = [];
	if ( Array.isArray( step.jumpTo ) ) {
		rules = step.jumpTo;
	} else if ( step.jumpTo ) {
		rules = [ { to: step.jumpTo } ];
	}
	const targets = [
		{ value: 'results', label: __( 'Results', 'smart-diagnostic' ) },
		...steps
			.filter( ( s ) => s.key !== step.key )
			.map( ( s ) => ( { value: s.key, label: s.key } ) ),
	];
	return (
		<ListEditor
			label={ __( 'Jumps after this step', 'smart-diagnostic' ) }
			items={ rules }
			onChange={ onChange }
			newItem={ () => ( { to: 'results' } ) }
			addLabel={ __( 'Add a jump', 'smart-diagnostic' ) }
			renderItem={ ( rule, update ) => (
				<>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Go to', 'smart-diagnostic' ) }
						value={ rule.to }
						options={ targets }
						onChange={ ( to ) => update( { ...rule, to } ) }
					/>
					<ConditionEditor
						label={ __( 'If', 'smart-diagnostic' ) }
						value={ rule.if }
						config={ config }
						onChange={ ( condition ) => {
							const next = { ...rule, if: condition };
							if ( ! condition ) {
								delete next.if;
							}
							update( next );
						} }
					/>
				</>
			) }
		/>
	);
}

/**
 * @param {Object}   props
 * @param {Object}   props.config    Config.
 * @param {Function} props.set       ( path, value ) => void.
 * @param {string[]} props.languages Langues.
 */
export function StepsTab( { config, set, languages } ) {
	const steps = config.steps ?? [];
	const sections = config.sections ?? [];
	const [ selected, setSelected ] = useState( steps[ 0 ]?.key ?? null );
	const [ dragged, setDragged ] = useState( null );
	// Réglages techniques (clés, valeurs internes, « Je ne sais pas ») : masqués par défaut.
	const [ advanced, setAdvanced ] = useState( false );
	const index = steps.findIndex( ( s ) => s.key === selected );
	const step = steps[ index ];
	const setStep = ( path, value ) =>
		set( [ 'steps', index, ...path ], value );
	const kinds = KIND_LABELS();
	const titleOf = ( item ) =>
		resolveText( item.label ?? item.title ?? item.body, languages[ 0 ] )
			.replace( /<[^>]+>/g, '' )
			.trim() || item.key;

	const add = ( kind ) => {
		const created = newStep(
			kind,
			steps,
			step?.section ?? sections[ 0 ]?.key
		);
		const position = index >= 0 ? index + 1 : steps.length;
		set(
			[ 'steps' ],
			[
				...steps.slice( 0, position ),
				created,
				...steps.slice( position ),
			]
		);
		setSelected( created.key );
	};

	const duplicate = () => {
		const copy = {
			...structuredClone( step ),
			key: uniqueKey(
				step.key,
				steps.map( ( s ) => s.key )
			),
		};
		set(
			[ 'steps' ],
			[
				...steps.slice( 0, index + 1 ),
				copy,
				...steps.slice( index + 1 ),
			]
		);
		setSelected( copy.key );
	};

	const remove = () => {
		set(
			[ 'steps' ],
			steps.filter( ( _, i ) => i !== index )
		);
		setSelected(
			steps[ index + 1 ]?.key ?? steps[ index - 1 ]?.key ?? null
		);
	};

	return (
		<div className="sd-b-steps">
			<div className="sd-b-steps__list">
				<h3>{ __( 'Steps', 'smart-diagnostic' ) }</h3>
				<ol className="sd-b-steps__items">
					{ steps.map( ( item, i ) => (
						<li
							key={ item.key }
							draggable
							onDragStart={ () => setDragged( i ) }
							onDragOver={ ( event ) => event.preventDefault() }
							onDrop={ () => {
								set( [ 'steps' ], move( steps, dragged, i ) );
								setDragged( null );
							} }
							className={ `sd-b-steps__item${ item.key === selected ? ' is-selected' : '' }${ dragged === i ? ' is-dragged' : '' }` }
						>
							<button
								type="button"
								className="sd-b-steps__select"
								aria-current={
									item.key === selected ? 'step' : undefined
								}
								onClick={ () => setSelected( item.key ) }
							>
								<span className="sd-b-steps__number">
									{ i + 1 }
								</span>
								<span className="sd-b-steps__text">
									<span className="sd-b-steps__label">
										{ titleOf( item ) }
									</span>
									<span className="sd-b-steps__meta">
										<span
											className={ `sd-b-badge sd-b-badge--${ item.kind }` }
										>
											{ kinds[ item.kind ] }
										</span>
										{ item.showIf && (
											<span className="sd-b-badge">
												{ __(
													'Conditional',
													'smart-diagnostic'
												) }
											</span>
										) }
									</span>
								</span>
							</button>
							<span className="sd-b-steps__move">
								<Button
									size="small"
									icon="arrow-up-alt2"
									label={ __(
										'Move up',
										'smart-diagnostic'
									) }
									disabled={ i === 0 }
									onClick={ () =>
										set(
											[ 'steps' ],
											move( steps, i, i - 1 )
										)
									}
								/>
								<Button
									size="small"
									icon="arrow-down-alt2"
									label={ __(
										'Move down',
										'smart-diagnostic'
									) }
									disabled={ i === steps.length - 1 }
									onClick={ () =>
										set(
											[ 'steps' ],
											move( steps, i, i + 1 )
										)
									}
								/>
							</span>
						</li>
					) ) }
				</ol>
				<p className="sd-b-steps__add-title">
					{ __( 'Add after the selected step:', 'smart-diagnostic' ) }
				</p>
				<div className="sd-b-steps__add">
					<Button
						variant="secondary"
						icon="plus"
						onClick={ () => add( 'question' ) }
					>
						{ __( 'Question', 'smart-diagnostic' ) }
					</Button>
					<Button
						variant="secondary"
						icon="plus"
						onClick={ () => add( 'content' ) }
					>
						{ __( 'Content', 'smart-diagnostic' ) }
					</Button>
					<Button
						variant="secondary"
						icon="plus"
						onClick={ () => add( 'form' ) }
					>
						{ __( 'Form', 'smart-diagnostic' ) }
					</Button>
				</div>

				<details className="sd-b-panel sd-b-steps__sections">
					<summary>
						{ sprintf(
							/* translators: %d: number of sections. */
							__( 'Sections (%d)', 'smart-diagnostic' ),
							sections.length
						) }
					</summary>
					<p className="description">
						{ __(
							'Sections group the questions; their name is shown above the progress bar.',
							'smart-diagnostic'
						) }
					</p>
					<ListEditor
						items={ sections }
						onChange={ ( list ) =>
							set( [ 'sections' ], list ?? [] )
						}
						newItem={ ( items ) => ( {
							key: uniqueKey(
								'section',
								items.map( ( i ) => i.key )
							),
							label: __( 'New section', 'smart-diagnostic' ),
						} ) }
						addLabel={ __( 'Add a section', 'smart-diagnostic' ) }
						summary={ ( section ) =>
							resolveText( section.label, languages[ 0 ] ) ||
							section.key
						}
						renderItem={ ( section, update ) => (
							<>
								<I18nText
									label={ __( 'Name', 'smart-diagnostic' ) }
									value={ section.label }
									languages={ languages }
									onChange={ ( label ) =>
										update( {
											...section,
											label: label ?? '',
										} )
									}
								/>
								{ advanced && (
									<KeyField
										value={ section.key }
										taken={ sections.map( ( s ) => s.key ) }
										onChange={ ( key ) =>
											update( { ...section, key } )
										}
									/>
								) }
							</>
						) }
					/>
				</details>
			</div>

			<div className="sd-b-steps__editor">
				{ ! step && (
					<p className="sd-b-steps__empty">
						{ __(
							'Select a step on the left to edit it, or add one.',
							'smart-diagnostic'
						) }
					</p>
				) }
				{ step && (
					<>
						<div className="sd-b-steps__head">
							<h3>
								{ sprintf(
									/* translators: 1: step number, 2: kind of step. */
									__(
										'Step %1$d · %2$s',
										'smart-diagnostic'
									),
									index + 1,
									kinds[ step.kind ]
								) }
							</h3>
							<span className="sd-b-steps__tools">
								<Button
									variant="tertiary"
									icon="admin-page"
									onClick={ duplicate }
								>
									{ __( 'Duplicate', 'smart-diagnostic' ) }
								</Button>
								<Button
									variant="tertiary"
									isDestructive
									icon="trash"
									onClick={ remove }
								>
									{ __( 'Delete', 'smart-diagnostic' ) }
								</Button>
							</span>
						</div>

						{ step.kind === 'question' && (
							<QuestionFields
								step={ step }
								set={ setStep }
								config={ config }
								languages={ languages }
								advanced={ advanced }
							/>
						) }
						{ step.kind === 'content' && (
							<ContentFields
								step={ step }
								set={ setStep }
								languages={ languages }
							/>
						) }
						{ step.kind === 'form' && (
							<FormFields
								step={ step }
								set={ setStep }
								languages={ languages }
							/>
						) }

						{ sections.length > 1 && (
							<SelectControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Section', 'smart-diagnostic' ) }
								value={ step.section ?? '' }
								options={ [
									{ value: '', label: '—' },
									...sections.map( ( s ) => ( {
										value: s.key,
										label:
											resolveText(
												s.label,
												languages[ 0 ]
											) || s.key,
									} ) ),
								] }
								onChange={ ( v ) =>
									setStep( [ 'section' ], v || undefined )
								}
							/>
						) }

						<details
							className="sd-b-panel"
							open={ Boolean(
								step.showIf || step.jumpTo?.length
							) }
						>
							<summary>
								{ __(
									'Logic: show only in some cases, jump to another step',
									'smart-diagnostic'
								) }
							</summary>
							<ConditionEditor
								label={ __(
									'Show this step',
									'smart-diagnostic'
								) }
								value={ step.showIf }
								config={ config }
								onChange={ ( condition ) =>
									setStep( [ 'showIf' ], condition )
								}
							/>
							<JumpEditor
								step={ step }
								steps={ steps }
								config={ config }
								onChange={ ( rules ) =>
									setStep( [ 'jumpTo' ], rules )
								}
							/>
						</details>

						<div className="sd-b-steps__advanced">
							<ToggleControl
								__nextHasNoMarginBottom
								label={ __(
									'Show the advanced options',
									'smart-diagnostic'
								) }
								help={ __(
									'Technical keys and values, “I don’t know” answers.',
									'smart-diagnostic'
								) }
								checked={ advanced }
								onChange={ setAdvanced }
							/>
							{ advanced && (
								<KeyField
									key={ step.key }
									value={ step.key }
									taken={ steps.map( ( s ) => s.key ) }
									onChange={ ( key ) => {
										setStep( [ 'key' ], key );
										setSelected( key );
									} }
								/>
							) }
						</div>
					</>
				) }
			</div>
		</div>
	);
}
