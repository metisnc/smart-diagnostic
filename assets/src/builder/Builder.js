/**
 * Constructeur visuel : édite la même config JSON que l'onglet JSON (et que l'import / export).
 * La config est recopiée dans le champ caché sd_config, enregistré avec le diagnostic.
 */
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import {
	Notice,
	TabPanel,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { setIn } from './utils';
import { StepsTab } from './tabs/Steps';
import { ScoringTab } from './tabs/Scoring';
import { ResultsTab } from './tabs/Results';
import { DesignTab, GeneralTab, IntegrationsTab } from './tabs/General';
import { TestTab } from './tabs/Test';

const PREVIEW_DELAY_MS = 300;

function useValidator( schema ) {
	return useMemo( () => {
		const ajv = new Ajv2020( { allErrors: true, strict: false } );
		addFormats( ajv );
		return ajv.compile( schema );
	}, [ schema ] );
}

/**
 * @param {Object}              props
 * @param {Object}              props.initial     Config initiale (valide, ou base vide).
 * @param {string}              props.initialText JSON tel qu'enregistré (éventuellement invalide).
 * @param {HTMLTextAreaElement} props.field       Champ enregistré avec le diagnostic.
 * @param {Object}              props.schema      JSON Schema.
 */
export function Builder( { initial, initialText, field, schema } ) {
	const [ config, setConfig ] = useState( initial );
	const [ json, setJson ] = useState( initialText );
	const [ jsonError, setJsonError ] = useState( () => {
		try {
			JSON.parse( initialText );
			return '';
		} catch ( error ) {
			return error.message;
		}
	} );
	const [ showPreview, setShowPreview ] = useState( true );
	const previewRef = useRef( null );
	const validate = useValidator( schema );
	const valid = validate( config );
	const errors = valid ? [] : validate.errors;
	const languages = config.i18n?.languages?.length
		? config.i18n.languages
		: [ config.i18n?.defaultLanguage ?? '' ].filter( Boolean );

	const apply = ( next ) => {
		setConfig( next );
		setJson( JSON.stringify( next, null, 2 ) );
		setJsonError( '' );
	};
	const set = ( path, value ) => apply( setIn( config, path, value ) );

	// Le champ enregistré suit toujours l'éditeur (y compris un JSON invalide saisi à la main).
	useEffect( () => {
		field.value = jsonError ? json : JSON.stringify( config, null, 2 );
	}, [ config, json, jsonError, field ] );

	useEffect( () => {
		if ( ! showPreview || ! previewRef.current || ! window.sdPreview ) {
			return undefined;
		}
		const timer = setTimeout(
			() => window.sdPreview.render( previewRef.current, config ),
			PREVIEW_DELAY_MS
		);
		return () => clearTimeout( timer );
	}, [ config, showPreview ] );

	const tabs = [
		{ name: 'steps', title: __( 'Journey', 'smart-diagnostic' ) },
		{ name: 'scoring', title: __( 'Calculation', 'smart-diagnostic' ) },
		{ name: 'results', title: __( 'Results', 'smart-diagnostic' ) },
		{ name: 'general', title: __( 'General', 'smart-diagnostic' ) },
		{ name: 'design', title: __( 'Appearance', 'smart-diagnostic' ) },
		{
			name: 'integrations',
			title: __( 'Integrations', 'smart-diagnostic' ),
		},
		{ name: 'test', title: __( 'Test', 'smart-diagnostic' ) },
		{ name: 'json', title: 'JSON' },
	];
	const props = { config, set, languages };

	return (
		<div className={ `sd-builder${ showPreview ? ' has-preview' : '' }` }>
			<div className="sd-builder__status" aria-live="polite">
				{ jsonError && (
					<Notice status="error" isDismissible={ false }>
						{ __( 'Invalid JSON:', 'smart-diagnostic' ) }{ ' ' }
						{ jsonError }
					</Notice>
				) }
				{ ! jsonError && valid && (
					<Notice status="success" isDismissible={ false }>
						{ __( 'Valid configuration.', 'smart-diagnostic' ) }
					</Notice>
				) }
				{ ! jsonError && ! valid && (
					<Notice status="warning" isDismissible={ false }>
						<strong>
							{ sprintf(
								/* translators: %d: number of errors. */
								_n(
									'%d error: the configuration will not be saved until it is fixed.',
									'%d errors: the configuration will not be saved until they are fixed.',
									errors.length,
									'smart-diagnostic'
								),
								errors.length
							) }
						</strong>
						<ul>
							{ errors.slice( 0, 8 ).map( ( error, i ) => (
								<li key={ i }>
									<code>{ error.instancePath || '/' }</code>{ ' ' }
									{ error.message }
								</li>
							) ) }
						</ul>
					</Notice>
				) }
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Live preview', 'smart-diagnostic' ) }
					checked={ showPreview }
					onChange={ setShowPreview }
				/>
			</div>
			<div className="sd-builder__main">
				<TabPanel
					className="sd-builder__tabs"
					tabs={ tabs }
					initialTabName={ jsonError ? 'json' : 'steps' }
				>
					{ ( tab ) => (
						<div className="sd-builder__panel">
							{ tab.name === 'steps' && (
								<StepsTab { ...props } />
							) }
							{ tab.name === 'scoring' && (
								<ScoringTab { ...props } />
							) }
							{ tab.name === 'results' && (
								<ResultsTab { ...props } />
							) }
							{ tab.name === 'general' && (
								<GeneralTab { ...props } />
							) }
							{ tab.name === 'design' && (
								<DesignTab { ...props } />
							) }
							{ tab.name === 'integrations' && (
								<IntegrationsTab { ...props } />
							) }
							{ tab.name === 'test' && <TestTab { ...props } /> }
							{ tab.name === 'json' && (
								<TextareaControl
									__nextHasNoMarginBottom
									className="sd-builder__json"
									label={ __(
										'Configuration (JSON)',
										'smart-diagnostic'
									) }
									help={ __(
										'Format documented in schema/diagnostic.schema.json. Changes are applied to the other tabs as soon as the JSON is valid.',
										'smart-diagnostic'
									) }
									rows={ 30 }
									spellCheck={ false }
									value={ json }
									onChange={ ( text ) => {
										setJson( text );
										try {
											setConfig( JSON.parse( text ) );
											setJsonError( '' );
										} catch ( error ) {
											setJsonError( error.message );
										}
									} }
								/>
							) }
						</div>
					) }
				</TabPanel>
				{ showPreview && (
					<aside
						className="sd-builder__preview"
						aria-label={ __( 'Live preview', 'smart-diagnostic' ) }
					>
						<div ref={ previewRef } />
					</aside>
				) }
			</div>
		</div>
	);
}
