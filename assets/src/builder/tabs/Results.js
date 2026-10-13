/**
 * Onglet « Résultats » : mise en page du résultat, profils, textes, plan d'action, CTA.
 */
import {
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { I18nText, KeyField, ListEditor, NumberField } from '../fields';
import { ConditionEditor } from '../ConditionEditor';
import { uniqueKey } from '../utils';
import { resolveText } from '../../engine/text';

const BLOCK_TYPES = () => [
	{ value: 'heading', label: __( 'Heading', 'smart-diagnostic' ) },
	{ value: 'profile', label: __( 'Profile', 'smart-diagnostic' ) },
	{ value: 'scores', label: __( 'Scores (chart)', 'smart-diagnostic' ) },
	{ value: 'texts', label: __( 'Conditional texts', 'smart-diagnostic' ) },
	{
		value: 'variables',
		label: __( 'Calculated values', 'smart-diagnostic' ),
	},
	{ value: 'actions', label: __( 'Action plan', 'smart-diagnostic' ) },
	{
		value: 'cta',
		label: __( 'Recommended call to action', 'smart-diagnostic' ),
	},
	{ value: 'share', label: __( 'Personal link', 'smart-diagnostic' ) },
	{
		value: 'form',
		label: __( 'Form below the results', 'smart-diagnostic' ),
	},
	{ value: 'html', label: __( 'Free text', 'smart-diagnostic' ) },
];

function OutcomeList( { label, items, onChange, config, languages, kind } ) {
	const keys = ( items ?? [] ).map( ( i ) => i.key );
	const isText = kind === 'texts' || kind === 'actions';
	return (
		<ListEditor
			label={ label }
			items={ items ?? [] }
			onChange={ onChange }
			newItem={ () => {
				const key = uniqueKey( kind.replace( /s$/, '' ), keys );
				if ( isText ) {
					return {
						key,
						body: __(
							'Text shown when the condition is met.',
							'smart-diagnostic'
						),
					};
				}
				if ( kind === 'ctas' ) {
					return {
						key,
						label: __( 'Book a call', 'smart-diagnostic' ),
						url: 'https://',
					};
				}
				return { key, label: __( 'New profile', 'smart-diagnostic' ) };
			} }
			addLabel={ __( 'Add', 'smart-diagnostic' ) }
			summary={ ( item ) =>
				`${
					resolveText(
						item.label ?? item.title ?? item.body,
						languages[ 0 ]
					)
						.replace( /<[^>]+>/g, '' )
						.slice( 0, 50 ) || item.key
				}${ item.when ? ' · if…' : '' }${ item.priority ? ` · ${ item.priority }` : '' }`
			}
			renderItem={ ( item, update ) => {
				const patch = ( changes ) => {
					const next = { ...item, ...changes };
					Object.keys( next ).forEach(
						( k ) => next[ k ] === undefined && delete next[ k ]
					);
					update( next );
				};
				return (
					<>
						<div className="sd-b-row">
							<KeyField
								value={ item.key }
								taken={ keys }
								onChange={ ( key ) => patch( { key } ) }
							/>
							<NumberField
								label={ __( 'Priority', 'smart-diagnostic' ) }
								help={ __(
									'Highest first.',
									'smart-diagnostic'
								) }
								value={ item.priority }
								onChange={ ( priority ) =>
									patch( { priority } )
								}
							/>
						</div>
						{ isText ? (
							<I18nText
								label={ __( 'Title', 'smart-diagnostic' ) }
								value={ item.title }
								languages={ languages }
								onChange={ ( title ) => patch( { title } ) }
							/>
						) : (
							<I18nText
								label={ __( 'Name', 'smart-diagnostic' ) }
								value={ item.label }
								languages={ languages }
								onChange={ ( l ) =>
									patch( { label: l ?? '' } )
								}
							/>
						) }
						<I18nText
							multiline
							label={ __(
								'Text (basic HTML allowed)',
								'smart-diagnostic'
							) }
							value={ isText ? item.body : item.text }
							languages={ languages }
							onChange={ ( text ) =>
								patch(
									isText ? { body: text ?? '' } : { text }
								)
							}
						/>
						{ kind === 'profiles' && (
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								type="url"
								label={ __( 'Image URL', 'smart-diagnostic' ) }
								value={ item.image?.url ?? '' }
								onChange={ ( url ) =>
									patch( {
										image: url
											? { ...item.image, url }
											: undefined,
									} )
								}
							/>
						) }
						{ kind === 'ctas' && (
							<>
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									type="url"
									label={ __( 'Link', 'smart-diagnostic' ) }
									value={ item.url ?? '' }
									onChange={ ( url ) => patch( { url } ) }
								/>
								<div className="sd-b-row">
									{ [
										'source',
										'medium',
										'campaign',
										'content',
									].map( ( field ) => (
										<TextControl
											__nextHasNoMarginBottom
											__next40pxDefaultSize
											key={ field }
											label={ `utm_${ field }` }
											value={ item.utm?.[ field ] ?? '' }
											onChange={ ( value ) => {
												const utm = {
													...item.utm,
													[ field ]:
														value || undefined,
												};
												Object.keys( utm ).forEach(
													( k ) =>
														utm[ k ] ===
															undefined &&
														delete utm[ k ]
												);
												patch( {
													utm: Object.keys( utm )
														.length
														? utm
														: undefined,
												} );
											} }
										/>
									) ) }
								</div>
							</>
						) }
						<ConditionEditor
							label={
								kind === 'profiles' || kind === 'ctas'
									? __( 'Assigned if', 'smart-diagnostic' )
									: __( 'Shown if', 'smart-diagnostic' )
							}
							value={ item.when }
							config={ config }
							onChange={ ( when ) => patch( { when } ) }
						/>
					</>
				);
			} }
		/>
	);
}

export function ResultsTab( { config, set, languages } ) {
	const results = config.results ?? {};
	const outcomes = config.outcomes ?? {};
	return (
		<div className="sd-b-tab">
			<I18nText
				label={ __( 'Results title', 'smart-diagnostic' ) }
				help={ __(
					'Variables allowed: {first_name}, {score:axis}…',
					'smart-diagnostic'
				) }
				value={ results.title }
				languages={ languages }
				onChange={ ( v ) => set( [ 'results', 'title' ], v ) }
			/>
			<div className="sd-b-row">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Personal result link', 'smart-diagnostic' ) }
					checked={ results.shareLink !== false }
					onChange={ ( on ) =>
						set(
							[ 'results', 'shareLink' ],
							on ? undefined : false
						)
					}
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Email the results', 'smart-diagnostic' ) }
					checked={ results.emailResult !== false }
					onChange={ ( on ) =>
						set(
							[ 'results', 'emailResult' ],
							on ? undefined : false
						)
					}
				/>
			</div>

			<ListEditor
				label={ __( 'Results page layout', 'smart-diagnostic' ) }
				items={ results.blocks ?? [] }
				onChange={ ( blocks ) =>
					set( [ 'results', 'blocks' ], blocks )
				}
				newItem={ () => ( { type: 'scores', display: 'bars' } ) }
				addLabel={ __( 'Add a block', 'smart-diagnostic' ) }
				summary={ ( block ) =>
					BLOCK_TYPES().find( ( t ) => t.value === block.type )
						?.label ?? block.type
				}
				renderItem={ ( block, update ) => {
					const patch = ( changes ) => {
						const next = { ...block, ...changes };
						Object.keys( next ).forEach(
							( k ) => next[ k ] === undefined && delete next[ k ]
						);
						update( next );
					};
					return (
						<>
							<SelectControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Block', 'smart-diagnostic' ) }
								value={ block.type }
								options={ BLOCK_TYPES() }
								onChange={ ( type ) => update( { type } ) }
							/>
							<I18nText
								label={ __( 'Title', 'smart-diagnostic' ) }
								value={ block.title }
								languages={ languages }
								onChange={ ( title ) => patch( { title } ) }
							/>
							{ block.type === 'scores' && (
								<>
									<SelectControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __(
											'Chart',
											'smart-diagnostic'
										) }
										value={ block.display ?? 'bars' }
										options={ [
											{
												value: 'bars',
												label: __(
													'Bars',
													'smart-diagnostic'
												),
											},
											{
												value: 'radar',
												label: __(
													'Radar (3 axes or more)',
													'smart-diagnostic'
												),
											},
											{
												value: 'gauges',
												label: __(
													'Gauges',
													'smart-diagnostic'
												),
											},
										] }
										onChange={ ( display ) =>
											patch( { display } )
										}
									/>
									<ToggleControl
										__nextHasNoMarginBottom
										label={ __(
											'Show values',
											'smart-diagnostic'
										) }
										checked={ block.showValues !== false }
										onChange={ ( on ) =>
											patch( {
												showValues: on
													? undefined
													: false,
											} )
										}
									/>
								</>
							) }
							{ block.type === 'variables' && (
								<SelectControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'Display',
										'smart-diagnostic'
									) }
									value={ block.chart ?? 'none' }
									options={ [
										{
											value: 'none',
											label: __(
												'Figures',
												'smart-diagnostic'
											),
										},
										{
											value: 'bars',
											label: __(
												'Bars',
												'smart-diagnostic'
											),
										},
										{
											value: 'compare',
											label: __(
												'Comparison',
												'smart-diagnostic'
											),
										},
									] }
									onChange={ ( chart ) =>
										patch( {
											chart:
												chart === 'none'
													? undefined
													: chart,
										} )
									}
								/>
							) }
							{ block.type === 'html' && (
								<I18nText
									multiline
									label={ __(
										'Text (basic HTML allowed)',
										'smart-diagnostic'
									) }
									value={ block.body }
									languages={ languages }
									onChange={ ( body ) => patch( { body } ) }
								/>
							) }
							<ConditionEditor
								label={ __( 'Shown if', 'smart-diagnostic' ) }
								value={ block.showIf }
								config={ config }
								onChange={ ( showIf ) => patch( { showIf } ) }
							/>
						</>
					);
				} }
			/>

			<OutcomeList
				kind="profiles"
				label={ __(
					'Profiles (the first one that matches wins)',
					'smart-diagnostic'
				) }
				items={ outcomes.profiles }
				config={ config }
				languages={ languages }
				onChange={ ( list ) => set( [ 'outcomes', 'profiles' ], list ) }
			/>
			<OutcomeList
				kind="texts"
				label={ __(
					'Conditional texts (all that match are shown)',
					'smart-diagnostic'
				) }
				items={ outcomes.texts }
				config={ config }
				languages={ languages }
				onChange={ ( list ) => set( [ 'outcomes', 'texts' ], list ) }
			/>
			<OutcomeList
				kind="actions"
				label={ __( 'Action plan', 'smart-diagnostic' ) }
				items={ outcomes.actions }
				config={ config }
				languages={ languages }
				onChange={ ( list ) => set( [ 'outcomes', 'actions' ], list ) }
			/>
			<OutcomeList
				kind="ctas"
				label={ __(
					'Calls to action (the first one that matches is recommended)',
					'smart-diagnostic'
				) }
				items={ outcomes.ctas }
				config={ config }
				languages={ languages }
				onChange={ ( list ) => set( [ 'outcomes', 'ctas' ], list ) }
			/>
		</div>
	);
}
