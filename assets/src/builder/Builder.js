/**
 * Constructeur visuel : édite la même config JSON que l'onglet JSON (et que l'import / export).
 * La config est recopiée dans le champ caché sd_config, enregistré avec le diagnostic.
 */
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import {
	Button,
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
import { GeneralTab, IntegrationsTab } from './tabs/General';
import { DesignTab } from './tabs/Design';
import { TestTab } from './tabs/Test';
import { GuideTab } from './tabs/Guide';

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
	// Onglet ouvert : changer « key » remonte les onglets sur l'onglet demandé (boutons du guide).
	const [ tabState, setTabState ] = useState( () => {
		let name = window.sdAdmin?.isNew ? 'guide' : 'steps';
		try {
			JSON.parse( initialText );
		} catch ( error ) {
			name = 'json';
		}
		return { key: 0, name };
	} );
	const [ currentTab, setCurrentTab ] = useState( tabState.name );
	const mainRef = useRef( null );
	const goTo = ( name ) => {
		setTabState( ( state ) => ( { key: state.key + 1, name } ) );
		window.requestAnimationFrame( () =>
			mainRef.current?.scrollIntoView( { block: 'start' } )
		);
	};
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

	// Aperçu ciblé : l'étape en cours de modification (Parcours), l'accueil (Général),
	// le résultat (Résultat) ; sinon, ou si on le demande, tout le parcours depuis le début.
	const [ selectedStep, setSelectedStep ] = useState( null );
	const [ previewAll, setPreviewAll ] = useState( false );
	const stepIndex = ( config.steps ?? [] ).findIndex(
		( step ) => step.key === selectedStep
	);
	let focus = null;
	if ( currentTab === 'steps' && selectedStep === '__welcome' ) {
		focus = {
			start: { screen: 'welcome' },
			label: __( 'Welcome screen', 'smart-diagnostic' ),
		};
	} else if ( currentTab === 'steps' && stepIndex >= 0 ) {
		focus = {
			start: { step: selectedStep },
			label: sprintf(
				/* translators: %d: step number. */
				__( 'Step %d', 'smart-diagnostic' ),
				stepIndex + 1
			),
		};
	} else if (
		currentTab === 'general' &&
		config.welcome &&
		config.welcome.enabled !== false
	) {
		focus = {
			start: { screen: 'welcome' },
			label: __( 'Welcome screen', 'smart-diagnostic' ),
		};
	} else if ( currentTab === 'results' ) {
		focus = {
			start: { screen: 'results' },
			label: __( 'Result (example answers)', 'smart-diagnostic' ),
		};
	}
	const start = focus && ! previewAll ? focus.start : null;
	const startKey = JSON.stringify( start );

	useEffect( () => {
		if ( ! showPreview || ! previewRef.current || ! window.sdPreview ) {
			return undefined;
		}
		const timer = setTimeout(
			() =>
				window.sdPreview.render(
					previewRef.current,
					config,
					JSON.parse( startKey )
				),
			PREVIEW_DELAY_MS
		);
		return () => clearTimeout( timer );
		// currentTab : l'aperçu réapparaît en quittant l'onglet « Guide ».
	}, [ config, showPreview, currentTab, startKey ] );

	const tabs = [
		{ name: 'guide', title: __( 'Guide', 'smart-diagnostic' ) },
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
		<div
			className={ `sd-builder${
				showPreview && currentTab !== 'guide' ? ' has-preview' : ''
			}` }
		>
			<div className="sd-builder__header">
				<h2 className="sd-builder__title">
					{ __( 'Diagnostic builder', 'smart-diagnostic' ) }
				</h2>
				<div className="sd-builder__status" aria-live="polite">
					{ jsonError && (
						<span className="sd-builder__badge is-error">
							{ __( 'Invalid JSON', 'smart-diagnostic' ) }
						</span>
					) }
					{ ! jsonError && valid && (
						<span className="sd-builder__badge is-valid">
							{ __( 'Valid configuration.', 'smart-diagnostic' ) }
						</span>
					) }
					{ ! jsonError && ! valid && (
						<span className="sd-builder__badge is-warning">
							{ sprintf(
								/* translators: %d: number of errors. */
								_n(
									'%d error to fix',
									'%d errors to fix',
									errors.length,
									'smart-diagnostic'
								),
								errors.length
							) }
						</span>
					) }
				</div>
				<ToggleControl
					__nextHasNoMarginBottom
					className="sd-builder__preview-toggle"
					label={ __( 'Live preview', 'smart-diagnostic' ) }
					checked={ showPreview }
					onChange={ setShowPreview }
				/>
			</div>
			{ jsonError && (
				<Notice
					className="sd-builder__issues"
					status="error"
					isDismissible={ false }
				>
					{ __( 'Invalid JSON:', 'smart-diagnostic' ) } { jsonError }
				</Notice>
			) }
			{ ! jsonError && ! valid && (
				<Notice
					className="sd-builder__issues"
					status="warning"
					isDismissible={ false }
				>
					<strong>
						{ _n(
							'The configuration will not be saved until this error is fixed:',
							'The configuration will not be saved until these errors are fixed:',
							errors.length,
							'smart-diagnostic'
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
			<div className="sd-builder__main" ref={ mainRef }>
				<TabPanel
					key={ tabState.key }
					className="sd-builder__tabs"
					tabs={ tabs }
					initialTabName={ tabState.name }
					onSelect={ setCurrentTab }
				>
					{ ( tab ) => (
						<div className="sd-builder__panel">
							{ tab.name === 'guide' && (
								<GuideTab
									config={ config }
									valid={ ! jsonError && valid }
									goTo={ goTo }
								/>
							) }
							{ tab.name === 'steps' && (
								<StepsTab
									{ ...props }
									onSelectStep={ setSelectedStep }
								/>
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
				{ /* Pas d'aperçu sur l'onglet « Guide » : place au texte. */ }
				{ showPreview && currentTab !== 'guide' && (
					<aside
						className="sd-builder__preview"
						aria-label={ __( 'Live preview', 'smart-diagnostic' ) }
					>
						<div className="sd-builder__preview-head">
							<p className="sd-builder__preview-title">
								{ focus && ! previewAll
									? sprintf(
											/* translators: %s: what is previewed (step, welcome screen…). */
											__(
												'Preview: %s',
												'smart-diagnostic'
											),
											focus.label
										)
									: __(
											'Preview: whole journey',
											'smart-diagnostic'
										) }
							</p>
							{ focus && (
								<div
									className="sd-builder__preview-mode"
									role="group"
									aria-label={ __(
										'What to preview',
										'smart-diagnostic'
									) }
								>
									<Button
										size="small"
										variant={
											previewAll ? 'secondary' : 'primary'
										}
										aria-pressed={ ! previewAll }
										onClick={ () => setPreviewAll( false ) }
									>
										{ __(
											'This part',
											'smart-diagnostic'
										) }
									</Button>
									<Button
										size="small"
										variant={
											previewAll ? 'primary' : 'secondary'
										}
										aria-pressed={ previewAll }
										onClick={ () => setPreviewAll( true ) }
									>
										{ __(
											'Whole journey',
											'smart-diagnostic'
										) }
									</Button>
								</div>
							) }
						</div>
						<div ref={ previewRef } />
					</aside>
				) }
			</div>
		</div>
	);
}
