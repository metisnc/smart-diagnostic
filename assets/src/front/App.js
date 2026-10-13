/**
 * App visiteur : accueil → étapes → transition → résultat.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createContext } from '../engine/context';
import {
	answersOnPath,
	firstStepKey,
	nextStepKey,
	progress,
	RESULTS,
} from '../engine/flow';
import { interpolate } from '../engine/interpolate';
import { resolveText } from '../engine/text';
import { validateAnswer } from '../engine/validate';
import { prefersReducedMotion } from './motion';
import {
	clearProgress,
	loadProgress,
	saveProgress,
	storageKey,
} from './storage';
import { themeStyle } from './theme';
import { AUTO_ADVANCE_TYPES, QuestionField } from './components/Question';
import { FormStep, validateForm } from './components/Form';
import {
	ContentBody,
	Heading,
	ResumePrompt,
	Transition,
	Welcome,
} from './components/Screens';
import { Results } from './components/Results';
import { computeResult } from '../engine/calculator';
import { RichText } from './html';

const AUTO_ADVANCE_DELAY = 300;

function pickLanguage( locale, languages, fallback ) {
	const short = ( locale ?? '' ).split( '_' )[ 0 ];
	if ( languages.includes( locale ) ) {
		return locale;
	}
	if ( languages.includes( short ) ) {
		return short;
	}
	return fallback ?? short;
}

function freshState( config, context ) {
	const showWelcome =
		Boolean( config.welcome ) && config.welcome.enabled !== false;
	return {
		screen: showWelcome ? 'welcome' : 'step',
		current: showWelcome ? null : firstStepKey( config, context ),
		history: [],
		answers: {},
		contact: {},
		consent: false,
		answeredCount: 0,
		pendingNext: null,
	};
}

/**
 * @param {Object}  props
 * @param {Object}  props.payload         Données du serveur : { id, locale, strings, config }.
 * @param {boolean} [props.preview=false] Aperçu admin : pas de sauvegarde.
 */
export function App( { payload, preview = false } ) {
	const { id, config, locale } = payload;
	const languages = config.i18n?.languages ?? [];
	const defaultLang = config.i18n?.defaultLanguage ?? languages[ 0 ];
	const [ lang, setLang ] = useState( () =>
		pickLanguage( locale, languages, defaultLang )
	);

	const persist = ! preview && config.flow?.saveProgress !== false;
	const key = storageKey( id, config );
	const emptyContext = useMemo(
		() => createContext( { config, answers: {} } ),
		[ config ]
	);

	const [ state, setState ] = useState( () => {
		const fresh = freshState( config, emptyContext );
		const saved = persist ? loadProgress( key ) : null;
		return saved?.current || saved?.pendingNext
			? { ...fresh, screen: 'resume', saved }
			: fresh;
	} );
	const [ error, setError ] = useState( null );
	const [ formErrors, setFormErrors ] = useState( {} );
	const [ autoAdvance, setAutoAdvance ] = useState( false );

	const headingRef = useRef( null );
	const rootRef = useRef( null );
	const firstRender = useRef( true );

	const { screen, current, history, answers, contact } = state;
	const steps = config.steps ?? [];
	const step = steps.find( ( candidate ) => candidate.key === current );

	const result = useMemo(
		() =>
			screen === 'results' || screen === 'transition'
				? computeResult( config, answers, contact )
				: null,
		[ screen, config, answers, contact ]
	);
	const pathAnswers = answersOnPath(
		result ? result.path : [ ...history, current ].filter( Boolean ),
		answers
	);
	const context = createContext( { config, answers: pathAnswers, contact } );

	const uiStrings = { ...payload.strings };
	for ( const [ stringKey, value ] of Object.entries(
		config.ui?.strings ?? {}
	) ) {
		uiStrings[ stringKey ] = resolveText( value, lang, defaultLang );
	}
	const ui = {
		locale: ( lang ?? locale ?? 'en' ).replace( '_', '-' ),
		letters: Boolean( config.flow?.optionLetters ),
		t: ( stringKey, params = {} ) =>
			( uiStrings[ stringKey ] ?? stringKey ).replace(
				/\{(\w+)\}/g,
				( match, name ) =>
					name in params ? String( params[ name ] ) : match
			),
		tx: ( text ) =>
			interpolate( resolveText( text, lang, defaultLang ), {
				config,
				answers: pathAnswers,
				contact,
				scores: result?.scores,
				vars: result?.vars,
				lang,
			} ),
	};

	/* ------------------------------------------------------------ Effets */

	useEffect( () => {
		if ( persist && ( screen === 'step' || screen === 'interstitial' ) ) {
			const { saved, ...rest } = state; // eslint-disable-line no-unused-vars
			saveProgress( key, rest );
		}
	}, [ state ] ); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect( () => {
		if ( firstRender.current ) {
			firstRender.current = false;
			return;
		}
		const target = headingRef.current ?? rootRef.current;
		target?.focus( { preventScroll: true } );
		const top = rootRef.current?.getBoundingClientRect().top ?? 0;
		if ( top < 0 ) {
			rootRef.current.scrollIntoView( {
				behavior: prefersReducedMotion() ? 'auto' : 'smooth',
				block: 'start',
			} );
		}
	}, [ screen, current ] );

	useEffect( () => {
		if ( ! autoAdvance ) {
			return undefined;
		}
		const timer = setTimeout(
			() => {
				setAutoAdvance( false );
				goNext();
			},
			prefersReducedMotion() ? 0 : AUTO_ADVANCE_DELAY
		);
		return () => clearTimeout( timer );
	}, [ autoAdvance, answers ] ); // eslint-disable-line react-hooks/exhaustive-deps

	/* ----------------------------------------------------------- Actions */

	const update = ( patch ) =>
		setState( ( previous ) => ( { ...previous, ...patch } ) );

	const start = () =>
		update( {
			screen: 'step',
			current: firstStepKey( config, context ),
			history: [],
		} );

	const finish = () => {
		if ( persist ) {
			clearProgress( key );
		}
		update( {
			screen: config.flow?.transition?.enabled ? 'transition' : 'results',
			current: null,
		} );
	};

	const restart = () => {
		if ( persist ) {
			clearProgress( key );
		}
		setError( null );
		setFormErrors( {} );
		setState( freshState( config, emptyContext ) );
	};

	const resume = () => {
		const { saved } = state;
		setState( {
			...freshState( config, emptyContext ),
			...saved,
			screen: saved.screen === 'interstitial' ? 'interstitial' : 'step',
			saved: undefined,
		} );
		if ( saved.lang && languages.includes( saved.lang ) ) {
			setLang( saved.lang );
		}
	};

	function goNext() {
		if ( screen === 'interstitial' ) {
			update( {
				screen: 'step',
				current: state.pendingNext,
				pendingNext: null,
			} );
			return;
		}
		if ( ! step ) {
			return;
		}
		if ( step.kind === 'question' ) {
			const problem = validateAnswer( step, answers[ step.key ] );
			setError( problem );
			if ( problem ) {
				return;
			}
		}
		if ( step.kind === 'form' ) {
			const problems = validateForm( step, contact, state.consent );
			setFormErrors( problems );
			if ( Object.keys( problems ).length ) {
				const first = Object.keys( problems )[ 0 ];
				rootRef.current
					?.querySelector( `[id$="-${ first }"]` )
					?.focus();
				return;
			}
		}

		const next = nextStepKey( config, step.key, context );
		const answeredCount =
			state.answeredCount + ( step.kind === 'question' ? 1 : 0 );
		const every = config.flow?.interstitials?.every;
		const showCard =
			step.kind === 'question' &&
			every &&
			answeredCount % every === 0 &&
			next !== RESULTS;

		setError( null );
		update( {
			history: [ ...history, step.key ],
			answeredCount,
			screen: showCard ? 'interstitial' : 'step',
			current: showCard ? null : next,
			pendingNext: showCard ? next : null,
		} );
		if ( next === RESULTS ) {
			finish();
		}
	}

	const goBack = () => {
		setError( null );
		setFormErrors( {} );
		if ( screen === 'interstitial' ) {
			const previous = history[ history.length - 1 ];
			update( {
				screen: 'step',
				current: previous,
				history: history.slice( 0, -1 ),
				pendingNext: null,
			} );
			return;
		}
		if ( history.length === 0 ) {
			if ( config.welcome && config.welcome.enabled !== false ) {
				update( { screen: 'welcome', current: null } );
			}
			return;
		}
		update( {
			current: history[ history.length - 1 ],
			history: history.slice( 0, -1 ),
		} );
	};

	const setAnswer = ( value ) => {
		setError( null );
		update( { answers: { ...answers, [ current ]: value } } );
	};

	/* ------------------------------------------------------------- Rendu */

	const flow = config.flow ?? {};
	const progressOptions = flow.progress ?? {};
	const canGoBack =
		flow.backButton !== false &&
		( history.length > 0 ||
			screen === 'interstitial' ||
			( config.welcome && config.welcome.enabled !== false ) );

	const renderNav = ( isLast ) => (
		<div className="sd-nav">
			{ canGoBack && (
				<button
					type="button"
					className="sd-button sd-button--ghost"
					onClick={ goBack }
				>
					{ ui.t( 'back' ) }
				</button>
			) }
			<button type="submit" className="sd-button sd-button--primary">
				{ ui.t( isLast ? 'submit' : 'next' ) }
			</button>
		</div>
	);

	const onSubmit = ( event ) => {
		event.preventDefault();
		goNext();
	};

	let body;
	if ( screen === 'resume' ) {
		body = (
			<ResumePrompt
				ui={ ui }
				onResume={ resume }
				onRestart={ restart }
				headingRef={ headingRef }
			/>
		);
	} else if ( screen === 'welcome' ) {
		body = (
			<Welcome
				config={ config }
				ui={ ui }
				onStart={ start }
				headingRef={ headingRef }
			/>
		);
	} else if ( screen === 'transition' ) {
		body = (
			<Transition
				transition={ flow.transition }
				ui={ ui }
				onDone={ () => update( { screen: 'results' } ) }
				headingRef={ headingRef }
			/>
		);
	} else if ( screen === 'results' && result ) {
		body = (
			<Results
				config={ config }
				result={ result }
				answers={ pathAnswers }
				contact={ contact }
				ui={ ui }
				onRestart={ restart }
				headingRef={ headingRef }
			/>
		);
	} else if ( screen === 'interstitial' ) {
		const cards = flow.interstitials.cards;
		const card =
			cards[
				( state.answeredCount / flow.interstitials.every - 1 ) %
					cards.length
			];
		body = (
			<form
				className="sd-screen sd-interstitial"
				onSubmit={ onSubmit }
				noValidate
			>
				<ContentBody
					content={ card }
					ui={ ui }
					headingRef={ headingRef }
				/>
				{ renderNav( false ) }
			</form>
		);
	} else if ( step ) {
		const position = progress( config, history, step.key, context );
		const section = ( config.sections ?? [] ).find(
			( candidate ) => candidate.key === step.section
		);
		const isLast = nextStepKey( config, step.key, context ) === RESULTS;
		const previousPercent = Math.round(
			( Math.max( 0, position.current - 2 ) / position.total ) * 100
		);
		const encouragement = [ ...( flow.encouragements ?? [] ) ]
			.sort( ( a, b ) => b.atPercent - a.atPercent )
			.find(
				( item ) =>
					item.atPercent <= position.percent &&
					item.atPercent > previousPercent &&
					position.current > 1
			);
		const idBase = `sd-${ id }-${ step.key }`;
		const ids = {
			label: `${ idBase }-label`,
			input: `${ idBase }-input`,
			describedBy:
				[
					step.help ? `${ idBase }-help` : '',
					error ? `${ idBase }-error` : '',
				]
					.filter( Boolean )
					.join( ' ' ) || undefined,
		};

		body = (
			<form
				className={ `sd-screen sd-step sd-step--${ step.kind }` }
				onSubmit={ onSubmit }
				noValidate
			>
				{ ( progressOptions.sectionName !== false ||
					progressOptions.counter !== false ) && (
					<div className="sd-progress__meta">
						{ progressOptions.sectionName !== false && section && (
							<span className="sd-progress__section">
								{ ui.tx( section.label ) }
							</span>
						) }
						{ progressOptions.counter !== false && (
							<span className="sd-progress__counter">
								{ ui.t( 'progress', {
									current: position.current,
									total: position.total,
								} ) }
							</span>
						) }
					</div>
				) }
				{ progressOptions.bar !== false && (
					<div
						className="sd-progress"
						role="progressbar"
						aria-valuemin={ 0 }
						aria-valuemax={ 100 }
						aria-valuenow={ position.percent }
						aria-label={ ui.t( 'progress', {
							current: position.current,
							total: position.total,
						} ) }
					>
						<div
							className="sd-progress__bar"
							style={ { width: `${ position.percent }%` } }
						/>
					</div>
				) }
				{ encouragement && (
					<p className="sd-encouragement" role="status">
						{ ui.tx( encouragement.text ) }
					</p>
				) }

				{ step.kind === 'question' && (
					<div className="sd-question">
						<Heading
							text={ ui.tx( step.label ) }
							id={ ids.label }
							headingRef={ headingRef }
						/>
						{ step.help && (
							<p className="sd-help" id={ `${ idBase }-help` }>
								{ ui.tx( step.help ) }
							</p>
						) }
						<QuestionField
							step={ step }
							value={ answers[ step.key ] }
							onChange={ setAnswer }
							onPick={
								flow.autoAdvance &&
								AUTO_ADVANCE_TYPES.includes( step.type )
									? () => setAutoAdvance( true )
									: undefined
							}
							ui={ ui }
							ids={ ids }
						/>
						{ error && (
							<p
								className="sd-error"
								id={ `${ idBase }-error` }
								role="alert"
							>
								{ ui.t( error.key, error.params ) }
							</p>
						) }
					</div>
				) }
				{ step.kind === 'content' && (
					<ContentBody
						content={ step }
						ui={ ui }
						headingRef={ headingRef }
					/>
				) }
				{ step.kind === 'form' && (
					<FormStep
						step={ step }
						contact={ contact }
						consent={ state.consent }
						errors={ formErrors }
						onChange={ ( field, value ) =>
							update( {
								contact: { ...contact, [ field ]: value },
							} )
						}
						onConsent={ ( consent ) => update( { consent } ) }
						ui={ ui }
						idBase={ idBase }
						headingRef={ headingRef }
					/>
				) }
				{ renderNav( isLast ) }
			</form>
		);
	} else {
		// Étape introuvable (config modifiée entre-temps) : on propose de recommencer.
		body = (
			<div className="sd-screen sd-actions">
				<button
					type="button"
					className="sd-button sd-button--primary"
					onClick={ restart }
				>
					{ ui.t( 'restart' ) }
				</button>
			</div>
		);
	}

	const showSwitcher = config.i18n?.switcher && languages.length > 1;
	const logo = config.ui?.logo?.url;

	return (
		<div
			className="sd-app"
			style={ themeStyle( config.ui?.theme ) }
			ref={ rootRef }
			tabIndex={ -1 }
			lang={ lang ? lang.replace( '_', '-' ) : undefined }
		>
			{ ( logo || showSwitcher ) && (
				<div className="sd-header">
					{ logo && /^(https?:)?\//.test( logo ) && (
						<img
							className="sd-logo"
							src={ logo }
							alt={ ui.tx( config.ui.logo.alt ) }
						/>
					) }
					{ showSwitcher && (
						<select
							className="sd-lang"
							aria-label={ ui.t( 'language' ) }
							value={ lang }
							onChange={ ( event ) =>
								setLang( event.target.value )
							}
						>
							{ languages.map( ( code ) => (
								<option key={ code } value={ code }>
									{ code.toUpperCase() }
								</option>
							) ) }
						</select>
					) }
				</div>
			) }
			{ body }
			{ config.ui?.legal && (
				<RichText
					className="sd-legal"
					html={ ui.tx( config.ui.legal ) }
				/>
			) }
		</div>
	);
}
