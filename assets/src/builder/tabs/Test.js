/**
 * Onglet « Test » : simuler des réponses et voir le résultat calculé, sans rien enregistrer.
 */
import { useState } from '@wordpress/element';
import {
	Button,
	CheckboxControl,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { computeResult } from '../../engine/calculator';
import { resolveText } from '../../engine/text';
import { formatScalar, parseNumber } from '../utils';

const CHOICE_TYPES = [ 'single', 'dropdown', 'image_choice', 'yes_no' ];

function optionsOf( step ) {
	if ( step.type === 'yes_no' && ! step.options?.length ) {
		return [
			{ value: true, label: __( 'Yes', 'smart-diagnostic' ) },
			{ value: false, label: __( 'No', 'smart-diagnostic' ) },
		];
	}
	return step.options ?? [];
}

function AnswerInput( { step, value, onChange, lang } ) {
	const label =
		resolveText( step.label, lang ).replace( /<[^>]+>/g, '' ) || step.key;
	if ( CHOICE_TYPES.includes( step.type ) ) {
		const options = optionsOf( step );
		return (
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ label }
				value={ value === undefined ? '' : formatScalar( value ) }
				options={ [
					{ value: '', label: '—' },
					...options.map( ( o ) => ( {
						value: formatScalar( o.value ),
						label:
							resolveText( o.label, lang ) ||
							formatScalar( o.value ),
					} ) ),
				] }
				onChange={ ( raw ) =>
					onChange(
						options.find( ( o ) => formatScalar( o.value ) === raw )
							?.value
					)
				}
			/>
		);
	}
	if ( step.type === 'multi' ) {
		const selected = Array.isArray( value ) ? value : [];
		return (
			<fieldset className="sd-b-test__multi">
				<legend>{ label }</legend>
				{ optionsOf( step ).map( ( option ) => (
					<CheckboxControl
						__nextHasNoMarginBottom
						key={ formatScalar( option.value ) }
						label={ resolveText( option.label, lang ) }
						checked={ selected.includes( option.value ) }
						onChange={ ( on ) =>
							onChange(
								on
									? [ ...selected, option.value ]
									: selected.filter(
											( v ) => v !== option.value
										)
							)
						}
					/>
				) ) }
			</fieldset>
		);
	}
	if ( step.type === 'multi_amount' ) {
		const current = value ?? {};
		return (
			<fieldset className="sd-b-test__multi">
				<legend>{ label }</legend>
				{ ( step.fields ?? [] ).map( ( field ) => (
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						key={ field.key }
						type="number"
						label={ resolveText( field.label, lang ) }
						value={ current[ field.key ] ?? '' }
						onChange={ ( raw ) =>
							onChange( {
								...current,
								[ field.key ]: parseNumber( raw ) ?? null,
							} )
						}
					/>
				) ) }
			</fieldset>
		);
	}
	const numeric = [ 'number', 'amount', 'slider', 'scale' ].includes(
		step.type
	);
	return (
		<TextControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			type={ numeric ? 'number' : 'text' }
			label={ label }
			value={ value ?? '' }
			onChange={ ( raw ) =>
				onChange( numeric ? parseNumber( raw ) : raw || undefined )
			}
		/>
	);
}

export function TestTab( { config, languages } ) {
	const [ answers, setAnswers ] = useState( {} );
	const [ contact, setContact ] = useState( {} );
	const lang = languages[ 0 ];
	let result = null;
	let error = '';
	try {
		result = computeResult( config, answers, contact );
	} catch ( e ) {
		error = e.message;
	}
	const steps = config.steps ?? [];
	const label = ( list, key ) => {
		const item = ( list ?? [] ).find( ( i ) => i.key === key );
		return item
			? resolveText( item.label ?? item.title ?? item.body, lang )
					.replace( /<[^>]+>/g, '' )
					.slice( 0, 80 ) || key
			: key;
	};

	return (
		<div className="sd-b-test">
			<div className="sd-b-test__answers">
				<p className="description">
					{ __(
						'Simulate answers: the result below is computed with the same engine as on the site. Nothing is saved.',
						'smart-diagnostic'
					) }
				</p>
				{ steps
					.filter( ( step ) => step.kind === 'question' )
					.map( ( step ) => (
						<div
							key={ step.key }
							className={
								result && ! result.path.includes( step.key )
									? 'sd-b-test__skipped'
									: undefined
							}
						>
							<AnswerInput
								step={ step }
								lang={ lang }
								value={ answers[ step.key ] }
								onChange={ ( value ) =>
									setAnswers( {
										...answers,
										[ step.key ]: value,
									} )
								}
							/>
						</div>
					) ) }
				{ steps
					.filter( ( step ) => step.kind === 'form' )
					.flatMap( ( step ) => step.fields ?? [] )
					.map( ( field ) => (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							key={ field.key }
							label={ `${ __( 'Contact', 'smart-diagnostic' ) } · ${ resolveText( field.label, lang ) }` }
							value={ contact[ field.key ] ?? '' }
							onChange={ ( v ) =>
								setContact( {
									...contact,
									[ field.key ]: v || undefined,
								} )
							}
						/>
					) ) }
				<Button
					variant="secondary"
					onClick={ () => {
						setAnswers( {} );
						setContact( {} );
					} }
				>
					{ __( 'Clear the answers', 'smart-diagnostic' ) }
				</Button>
			</div>
			<div className="sd-b-test__result" aria-live="polite">
				<h3>{ __( 'Computed result', 'smart-diagnostic' ) }</h3>
				{ error && <p className="sd-b-error">{ error }</p> }
				{ result && (
					<table className="widefat striped">
						<tbody>
							<tr>
								<th>
									{ __( 'Steps taken', 'smart-diagnostic' ) }
								</th>
								<td>{ result.path.join( ' → ' ) }</td>
							</tr>
							{ Object.entries( result.scores ).map(
								( [ key, value ] ) => (
									<tr key={ key }>
										<th>{ `${ __( 'Score', 'smart-diagnostic' ) } ${ label( config.axes, key ) }` }</th>
										<td data-score={ key }>
											{ Math.round( value * 100 ) / 100 }
										</td>
									</tr>
								)
							) }
							{ Object.entries( result.vars ).map(
								( [ key, value ] ) => (
									<tr key={ key }>
										<th>{ `var.${ key }` }</th>
										<td>{ formatScalar( value ) }</td>
									</tr>
								)
							) }
							<tr>
								<th>{ __( 'Profile', 'smart-diagnostic' ) }</th>
								<td data-result="profile">
									{ result.profile
										? label(
												config.outcomes?.profiles,
												result.profile
											)
										: '—' }
								</td>
							</tr>
							<tr>
								<th>{ __( 'Texts', 'smart-diagnostic' ) }</th>
								<td>
									{ result.texts
										.map( ( key ) =>
											label( config.outcomes?.texts, key )
										)
										.join( ' · ' ) || '—' }
								</td>
							</tr>
							<tr>
								<th>
									{ __( 'Action plan', 'smart-diagnostic' ) }
								</th>
								<td>
									{ result.actions
										.map( ( key ) =>
											label(
												config.outcomes?.actions,
												key
											)
										)
										.join( ' · ' ) || '—' }
								</td>
							</tr>
							<tr>
								<th>
									{ __(
										'Call to action',
										'smart-diagnostic'
									) }
								</th>
								<td>
									{ result.cta
										? label(
												config.outcomes?.ctas,
												result.cta
											)
										: '—' }
								</td>
							</tr>
						</tbody>
					</table>
				) }
			</div>
		</div>
	);
}
