/**
 * Éditeur d'email : modèle par défaut, éditeur visuel par blocs, JSON des blocs ou HTML avancé.
 * Aperçu en direct (ordinateur / mobile) et envoi d'essai.
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	Notice,
	RadioControl,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { move, setIn } from './utils';

const BLOCK_TYPES = () => [
	[ 'heading', __( 'Heading', 'smart-diagnostic' ) ],
	[ 'text', __( 'Text', 'smart-diagnostic' ) ],
	[ 'button', __( 'Button', 'smart-diagnostic' ) ],
	[ 'image', __( 'Image', 'smart-diagnostic' ) ],
	[ 'divider', __( 'Separator', 'smart-diagnostic' ) ],
	[ 'spacer', __( 'Space', 'smart-diagnostic' ) ],
	[ 'profile', __( 'Result / profile', 'smart-diagnostic' ) ],
	[ 'scores', __( 'Scores', 'smart-diagnostic' ) ],
	[ 'texts', __( 'Personalised texts', 'smart-diagnostic' ) ],
	[ 'actions', __( 'Action plan', 'smart-diagnostic' ) ],
	[ 'cta', __( 'Recommendation / call to action', 'smart-diagnostic' ) ],
	[ 'answers', __( 'Answers table', 'smart-diagnostic' ) ],
];

const DYNAMIC_HELP = () => ( {
	profile: __(
		'Name and description of the profile obtained by the visitor.',
		'smart-diagnostic'
	),
	scores: __( 'One bar per axis, with the score.', 'smart-diagnostic' ),
	texts: __( 'Conditional texts matching the answers.', 'smart-diagnostic' ),
	actions: __(
		'Recommended actions, as a numbered list.',
		'smart-diagnostic'
	),
	cta: __( 'Button of the recommended call to action.', 'smart-diagnostic' ),
	answers: __(
		'All the questions and answers (useful for the team).',
		'smart-diagnostic'
	),
} );

const FONTS = [
	'Arial',
	'Helvetica',
	'Georgia',
	'Tahoma',
	'Trebuchet MS',
	'Verdana',
	'Times New Roman',
];

const STYLE_COLORS = () => [
	[ 'primary', __( 'Main colour (buttons)', 'smart-diagnostic' ) ],
	[ 'text', __( 'Text', 'smart-diagnostic' ) ],
	[ 'background', __( 'Content background', 'smart-diagnostic' ) ],
	[ 'surface', __( 'Background around', 'smart-diagnostic' ) ],
];

const newBlock = ( type ) => {
	switch ( type ) {
		case 'heading':
			return { type, text: __( 'Title', 'smart-diagnostic' ) };
		case 'text':
			return { type, text: '' };
		case 'button':
			return {
				type,
				text: __( 'View my report', 'smart-diagnostic' ),
				url: '{result_link}',
			};
		case 'image':
			return { type, url: '' };
		default:
			return { type };
	}
};

/**
 * Variables proposées : générales, puis une par question et par axe.
 *
 * @param {Object} config Config.
 * @param {string} lang   Langue affichée.
 * @return {Array<{token: string, label: string}>} Variables.
 */
function variables( config, lang ) {
	const label = ( text, fallback ) =>
		( typeof text === 'string'
			? text
			: ( text?.[ lang ] ?? Object.values( text ?? {} )[ 0 ] ) ) ||
		fallback;
	const general = Object.entries( window.sdAdmin?.emailPlaceholders ?? {} )
		.filter( ( [ token ] ) => ! token.includes( ':' ) )
		.map( ( [ token, text ] ) => ( { token, label: text } ) );
	const answers = ( config.steps ?? [] )
		.filter( ( step ) => step.kind === 'question' )
		.map( ( step ) => ( {
			token: `{answer:${ step.key }}`,
			label: label( step.label, step.key ).replace( /<[^>]+>/g, '' ),
		} ) );
	const scores = ( config.axes ?? [] ).map( ( axis ) => ( {
		token: `{score:${ axis.key }}`,
		label: label( axis.label, axis.key ),
	} ) );
	return [
		{
			title: __( 'Visitor and result', 'smart-diagnostic' ),
			items: general,
		},
		{ title: __( 'Answers', 'smart-diagnostic' ), items: answers },
		{ title: __( 'Scores', 'smart-diagnostic' ), items: scores },
	].filter( ( group ) => group.items.length );
}

/**
 * Menu « Insérer une variable ».
 *
 * @param {Object}   props
 * @param {Array}    props.groups   Variables groupées.
 * @param {Function} props.onInsert ( token ) => void.
 */
function VariableMenu( { groups, onInsert } ) {
	return (
		<DropdownMenu
			className="sd-b-email__vars"
			icon="shortcode"
			label={ __( 'Insert a variable', 'smart-diagnostic' ) }
			text={ __( 'Insert a variable', 'smart-diagnostic' ) }
			toggleProps={ { variant: 'secondary', size: 'small' } }
		>
			{ ( { onClose } ) =>
				groups.map( ( group ) => (
					<MenuGroup key={ group.title } label={ group.title }>
						{ group.items.map( ( item ) => (
							<MenuItem
								key={ item.token }
								info={ item.token }
								onClick={ () => {
									onInsert( item.token );
									onClose();
								} }
							>
								{ item.label }
							</MenuItem>
						) ) }
					</MenuGroup>
				) )
			}
		</DropdownMenu>
	);
}

/**
 * Champ texte avec insertion de variables au curseur.
 *
 * @param {Object}   props
 * @param {string}   props.label       Libellé.
 * @param {string}   props.value       Texte.
 * @param {Function} props.onChange    Nouveau texte.
 * @param {Array}    props.groups      Variables.
 * @param {boolean}  [props.multiline]
 * @param {string}   [props.help]
 * @param {boolean}  [props.code]      Saisie de code (HTML, JSON).
 */
function TokenField( {
	label,
	value,
	onChange,
	groups,
	multiline,
	help,
	code,
} ) {
	const ref = useRef( null );
	const [ id ] = useState(
		() => `sd-email-field-${ Math.random().toString( 36 ).slice( 2 ) }`
	);
	const insert = ( token ) => {
		const el = ref.current;
		const start = el ? el.selectionStart : value.length;
		const end = el ? el.selectionEnd : value.length;
		onChange( value.slice( 0, start ) + token + value.slice( end ) );
		window.requestAnimationFrame( () => {
			if ( el ) {
				el.focus();
				el.setSelectionRange(
					start + token.length,
					start + token.length
				);
			}
		} );
	};
	const Tag = multiline ? 'textarea' : 'input';
	let rows;
	if ( multiline ) {
		rows = code ? 14 : 4;
	}
	return (
		<div className="sd-b-email__field">
			<div className="sd-b-email__field-head">
				<label htmlFor={ id }>{ label }</label>
				{ groups && (
					<VariableMenu groups={ groups } onInsert={ insert } />
				) }
			</div>
			<Tag
				id={ id }
				ref={ ref }
				className={ `sd-b-email__input${ code ? ' is-code' : '' }` }
				rows={ rows }
				type={ multiline ? undefined : 'text' }
				spellCheck={ ! code }
				value={ value }
				onChange={ ( event ) => onChange( event.target.value ) }
			/>
			{ help && <p className="description">{ help }</p> }
		</div>
	);
}

/**
 * Bouton « Choisir une image » (médiathèque WordPress, si disponible).
 *
 * @param {Object}   props
 * @param {Function} props.onSelect ( url ) => void.
 */
function MediaButton( { onSelect } ) {
	if ( ! window.wp?.media ) {
		return null;
	}
	return (
		<Button
			variant="secondary"
			size="small"
			onClick={ () => {
				const frame = window.wp.media( {
					title: __( 'Choose an image', 'smart-diagnostic' ),
					library: { type: 'image' },
					multiple: false,
				} );
				frame.on( 'select', () =>
					onSelect(
						frame.state().get( 'selection' ).first().toJSON().url
					)
				);
				frame.open();
			} }
		>
			{ __( 'Choose an image', 'smart-diagnostic' ) }
		</Button>
	);
}

/**
 * Réglages d'un bloc.
 *
 * @param {Object}   props
 * @param {Object}   props.block    Bloc.
 * @param {Function} props.update   ( block ) => void.
 * @param {Function} props.text     ( value ) => texte de la langue affichée.
 * @param {Function} props.withText ( value, text ) => valeur multilingue.
 * @param {Array}    props.groups   Variables.
 */
function BlockSettings( { block, update, text, withText, groups } ) {
	const field = ( key ) => ( next ) =>
		update( { ...block, [ key ]: withText( block[ key ], next ) } );
	const plain = ( key ) => ( next ) =>
		update( { ...block, [ key ]: next === '' ? undefined : next } );
	const align = (
		<SelectControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ __( 'Alignment', 'smart-diagnostic' ) }
			value={ block.align ?? 'left' }
			options={ [
				{ value: 'left', label: __( 'Left', 'smart-diagnostic' ) },
				{ value: 'center', label: __( 'Centre', 'smart-diagnostic' ) },
				{ value: 'right', label: __( 'Right', 'smart-diagnostic' ) },
			] }
			onChange={ ( next ) =>
				update( {
					...block,
					align: next === 'left' ? undefined : next,
				} )
			}
		/>
	);
	const size = ( labels ) => (
		<SelectControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ __( 'Size', 'smart-diagnostic' ) }
			value={ block.size ?? 'medium' }
			options={ [ 'small', 'medium', 'large' ].map( ( value, i ) => ( {
				value,
				label: labels[ i ],
			} ) ) }
			onChange={ ( next ) =>
				update( {
					...block,
					size: next === 'medium' ? undefined : next,
				} )
			}
		/>
	);
	const sizes = [
		__( 'Small', 'smart-diagnostic' ),
		__( 'Medium', 'smart-diagnostic' ),
		__( 'Large', 'smart-diagnostic' ),
	];

	switch ( block.type ) {
		case 'heading':
			return (
				<>
					<TokenField
						label={ __( 'Heading', 'smart-diagnostic' ) }
						value={ text( block.text ) }
						onChange={ field( 'text' ) }
						groups={ groups }
					/>
					<div className="sd-b-grid">
						{ size( sizes ) }
						{ align }
					</div>
				</>
			);
		case 'text':
			return (
				<>
					<TokenField
						multiline
						label={ __( 'Text', 'smart-diagnostic' ) }
						value={ text( block.text ) }
						onChange={ field( 'text' ) }
						groups={ groups }
						help={ __(
							'An empty line starts a new paragraph. **Text between double asterisks** is shown in bold.',
							'smart-diagnostic'
						) }
					/>
					{ align }
				</>
			);
		case 'button':
			return (
				<>
					<TokenField
						label={ __( 'Button label', 'smart-diagnostic' ) }
						value={ text( block.text ) }
						onChange={ field( 'text' ) }
						groups={ groups }
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Link', 'smart-diagnostic' ) }
						value={
							block.url === '{result_link}' ? 'result' : 'url'
						}
						options={ [
							{
								value: 'result',
								label: __(
									'Visitor’s results page',
									'smart-diagnostic'
								),
							},
							{
								value: 'url',
								label: __(
									'Another address',
									'smart-diagnostic'
								),
							},
						] }
						onChange={ ( next ) =>
							update( {
								...block,
								url:
									next === 'result'
										? '{result_link}'
										: 'https://',
							} )
						}
					/>
					{ block.url !== '{result_link}' && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							type="url"
							label={ __( 'Address', 'smart-diagnostic' ) }
							value={ block.url ?? '' }
							onChange={ plain( 'url' ) }
						/>
					) }
					{ align }
				</>
			);
		case 'image':
			return (
				<>
					<div className="sd-b-row">
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							type="url"
							label={ __(
								'Image address (https://…)',
								'smart-diagnostic'
							) }
							value={ block.url ?? '' }
							onChange={ plain( 'url' ) }
						/>
						<MediaButton onSelect={ plain( 'url' ) } />
					</div>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Description (for accessibility)',
							'smart-diagnostic'
						) }
						value={ text( block.alt ) }
						onChange={ field( 'alt' ) }
					/>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						type="url"
						label={ __(
							'Link when clicked (optional)',
							'smart-diagnostic'
						) }
						value={ block.link ?? '' }
						onChange={ plain( 'link' ) }
					/>
					<div className="sd-b-grid">
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							type="number"
							min={ 16 }
							max={ 600 }
							label={ __(
								'Maximum width (pixels)',
								'smart-diagnostic'
							) }
							value={ block.width ?? '' }
							onChange={ ( next ) =>
								update( {
									...block,
									width:
										next === ''
											? undefined
											: Math.max(
													16,
													Math.min(
														600,
														parseInt( next, 10 ) ||
															16
													)
												),
								} )
							}
						/>
						{ align }
					</div>
				</>
			);
		case 'spacer':
			return size( sizes );
		case 'divider':
			return null;
		default:
			return (
				<p className="description">{ DYNAMIC_HELP()[ block.type ] }</p>
			);
	}
}

/**
 * Style de l'email (repris par défaut de l'apparence du questionnaire).
 *
 * @param {Object}   props
 * @param {Object}   props.style    Style.
 * @param {Object}   props.theme    Apparence du questionnaire.
 * @param {Function} props.onChange ( style ) => void.
 */
function StyleSettings( { style, theme, onChange } ) {
	const setKey = ( key, value ) => {
		const next = { ...style, [ key ]: value || undefined };
		Object.keys( next ).forEach(
			( k ) => next[ k ] === undefined && delete next[ k ]
		);
		onChange( Object.keys( next ).length ? next : undefined );
	};
	return (
		<details className="sd-b-email__style">
			<summary>{ __( 'Style', 'smart-diagnostic' ) }</summary>
			<p className="description">
				{ __(
					'By default, the email uses the appearance of the questionnaire.',
					'smart-diagnostic'
				) }
			</p>
			<div className="sd-b-row">
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					type="url"
					label={ __( 'Logo (https://…)', 'smart-diagnostic' ) }
					value={ style.logo ?? '' }
					onChange={ ( next ) => setKey( 'logo', next ) }
				/>
				<MediaButton onSelect={ ( url ) => setKey( 'logo', url ) } />
			</div>
			<div className="sd-b-grid">
				{ STYLE_COLORS().map( ( [ key, label ] ) => (
					<label key={ key } className="sd-b-color">
						<input
							type="color"
							value={
								style[ key ] ??
								theme.colors?.[ key ] ??
								( key === 'text' ? '#1f2937' : '#ffffff' )
							}
							onChange={ ( event ) =>
								setKey( key, event.target.value )
							}
						/>
						<span>{ label }</span>
						{ style[ key ] && (
							<button
								type="button"
								className="button-link"
								onClick={ () => setKey( key, undefined ) }
							>
								{ __( 'Reset', 'smart-diagnostic' ) }
							</button>
						) }
					</label>
				) ) }
			</div>
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Font', 'smart-diagnostic' ) }
				value={ style.fontFamily ?? '' }
				options={ [
					{
						value: '',
						label: __(
							'Same as the questionnaire',
							'smart-diagnostic'
						),
					},
					...FONTS.map( ( font ) => ( {
						value: font,
						label: font,
					} ) ),
				] }
				onChange={ ( next ) => setKey( 'fontFamily', next ) }
			/>
		</details>
	);
}

/**
 * @param {Object}   props
 * @param {string}   props.kind      user | admin | followUp.
 * @param {Object}   props.config    Config.
 * @param {Function} props.set       ( path, value ) => void.
 * @param {string[]} props.languages Langues du diagnostic.
 */
export function EmailEditor( { kind, config, set, languages } ) {
	const settings = config.integrations?.emails?.[ kind ] ?? {};
	const path = [ 'integrations', 'emails', kind ];
	const presets = window.sdAdmin?.emailPresets ?? {};
	const langs = languages.length ? languages : [ '' ];
	const multilingual = langs.length > 1;
	const [ lang, setLang ] = useState( langs[ 0 ] );
	const [ preview, setPreview ] = useState( null );
	const [ device, setDevice ] = useState( 'desktop' );
	const [ status, setStatus ] = useState( null );
	const [ busy, setBusy ] = useState( false );
	const [ json, setJson ] = useState( null );
	const [ jsonMode, setJsonMode ] = useState( false );
	const groups = variables( config, lang );

	let mode = 'default';
	if ( settings.body !== undefined ) {
		mode = 'html';
	} else if ( settings.blocks !== undefined ) {
		mode = 'visual';
	}

	const save = ( next ) => {
		Object.keys( next ).forEach(
			( key ) => next[ key ] === undefined && delete next[ key ]
		);
		set( path, next );
	};

	// Texte de la langue affichée, et mise à jour de cette langue seulement.
	const text = ( value ) => {
		if ( typeof value === 'string' ) {
			return value;
		}
		return value?.[ lang ] ?? '';
	};
	const withText = ( value, next ) => {
		if ( ! multilingual ) {
			return next === '' ? undefined : next;
		}
		const object =
			typeof value === 'string'
				? { [ langs[ 0 ] ]: value }
				: { ...( value ?? {} ) };
		if ( next === '' ) {
			delete object[ lang ];
		} else {
			object[ lang ] = next;
		}
		return Object.keys( object ).length ? object : undefined;
	};

	const blocks = settings.blocks ?? [];
	const setBlocks = ( list ) => save( { ...settings, blocks: list } );
	const updateBlock = ( index ) => ( block ) =>
		setBlocks( blocks.map( ( b, i ) => ( i === index ? block : b ) ) );

	const request = async ( send, override ) => {
		setBusy( true );
		if ( send ) {
			setStatus( null );
		}
		try {
			const response = await apiFetch( {
				path: window.sdAdmin.previewPath,
				method: 'POST',
				data: {
					config: override ?? config,
					kind,
					send,
					lang,
					diagnostic_id: window.sdAdmin.postId,
				},
			} );
			setPreview( response );
			if ( send ) {
				setStatus(
					response.sent
						? {
								type: 'success',
								text: sprintf(
									/* translators: %s: email address. */
									__(
										'Preview sent to %s.',
										'smart-diagnostic'
									),
									response.to
								),
							}
						: { type: 'error', text: response.error }
				);
			}
			setBusy( false );
			return response;
		} catch ( error ) {
			setStatus( { type: 'error', text: error.message } );
			setBusy( false );
			return null;
		}
	};

	// Aperçu en direct : rafraîchi après chaque modification, une fois ouvert.
	const signature = JSON.stringify( [ settings, config.ui, lang ] );
	const live = preview !== null;
	useEffect( () => {
		if ( ! live ) {
			return undefined;
		}
		const timer = window.setTimeout( () => request( false ), 700 );
		return () => window.clearTimeout( timer );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ signature, live ] );

	const changeMode = async ( next ) => {
		setJsonMode( false );
		if ( next === 'default' ) {
			const copy = { ...settings };
			delete copy.body;
			delete copy.fullHtml;
			delete copy.blocks;
			delete copy.style;
			save( copy );
		} else if ( next === 'visual' ) {
			if (
				mode === 'html' &&
				// eslint-disable-next-line no-alert
				! window.confirm(
					__(
						'Back to the visual editor: the changes made in HTML will be lost. Continue?',
						'smart-diagnostic'
					)
				)
			) {
				return;
			}
			const copy = { ...settings };
			delete copy.body;
			delete copy.fullHtml;
			copy.blocks = settings.blocks ?? presets[ kind ]?.blocks ?? [];
			save( copy );
		} else {
			// HTML : on part du rendu des blocs (ou du modèle de départ).
			const draft = {
				...settings,
				blocks: settings.blocks ?? presets[ kind ]?.blocks ?? [],
			};
			delete draft.body;
			const response = await request(
				false,
				setIn( config, path, draft )
			);
			save( {
				...settings,
				body: withText( undefined, response?.source ?? '' ) ?? '',
			} );
		}
	};

	const applyPreset = ( key ) => {
		const preset = presets[ key ];
		if (
			! preset ||
			( blocks.length &&
				// eslint-disable-next-line no-alert
				! window.confirm(
					__(
						'Replace the current blocks with this template?',
						'smart-diagnostic'
					)
				) )
		) {
			return;
		}
		save( {
			...settings,
			blocks: preset.blocks,
			subject: settings.subject ?? preset.subject,
		} );
	};

	const blockLabel = Object.fromEntries( BLOCK_TYPES() );

	return (
		<div className={ `sd-b-email sd-b-email--${ kind }` }>
			<RadioControl
				label={ __( 'Email content', 'smart-diagnostic' ) }
				selected={ mode }
				options={ [
					{
						value: 'default',
						label:
							kind === 'followUp'
								? __(
										'Standard follow-up template',
										'smart-diagnostic'
									)
								: __(
										'Default template (built from the results)',
										'smart-diagnostic'
									),
					},
					{
						value: 'visual',
						label: __( 'Visual editor', 'smart-diagnostic' ),
					},
					{
						value: 'html',
						label: __( 'HTML (advanced)', 'smart-diagnostic' ),
					},
				] }
				onChange={ changeMode }
			/>

			{ multilingual && mode !== 'default' && (
				<SelectControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Language', 'smart-diagnostic' ) }
					value={ lang }
					options={ langs.map( ( code ) => ( {
						value: code,
						label: code.toUpperCase(),
					} ) ) }
					onChange={ setLang }
				/>
			) }

			{ mode === 'visual' && (
				<div className="sd-b-email__visual">
					<div className="sd-b-row">
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __(
								'Start from a template',
								'smart-diagnostic'
							) }
							value=""
							options={ [
								{
									value: '',
									label: __( 'Choose…', 'smart-diagnostic' ),
								},
								...Object.entries( presets ).map(
									( [ key, preset ] ) => ( {
										value: key,
										label: preset.label,
									} )
								),
							] }
							onChange={ applyPreset }
						/>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Edit as JSON', 'smart-diagnostic' ) }
							checked={ jsonMode }
							onChange={ ( on ) => {
								setJsonMode( on );
								setJson(
									on
										? JSON.stringify(
												{
													blocks,
													style: settings.style,
												},
												null,
												2
											)
										: null
								);
							} }
						/>
					</div>

					{ jsonMode ? (
						<JsonBlocks
							value={ json }
							onChange={ ( raw ) => {
								setJson( raw );
								try {
									const parsed = JSON.parse( raw );
									if ( Array.isArray( parsed.blocks ) ) {
										save( {
											...settings,
											blocks: parsed.blocks,
											style: parsed.style,
										} );
										return true;
									}
								} catch ( error ) {
									// JSON en cours de saisie.
								}
								return false;
							} }
						/>
					) : (
						<>
							<StyleSettings
								style={ settings.style ?? {} }
								theme={ config.ui?.theme ?? {} }
								onChange={ ( style ) =>
									save( { ...settings, style } )
								}
							/>
							<ol className="sd-b-email__blocks">
								{ blocks.map( ( block, index ) => (
									<li
										key={ index }
										className="sd-b-email__block"
									>
										<div className="sd-b-email__block-bar">
											<strong>
												{ blockLabel[ block.type ] ??
													block.type }
											</strong>
											<span className="sd-b-list__actions">
												<Button
													size="small"
													icon="arrow-up-alt2"
													label={ __(
														'Move up',
														'smart-diagnostic'
													) }
													disabled={ index === 0 }
													onClick={ () =>
														setBlocks(
															move(
																blocks,
																index,
																index - 1
															)
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
													disabled={
														index ===
														blocks.length - 1
													}
													onClick={ () =>
														setBlocks(
															move(
																blocks,
																index,
																index + 1
															)
														)
													}
												/>
												<Button
													size="small"
													icon="admin-page"
													label={ __(
														'Duplicate',
														'smart-diagnostic'
													) }
													onClick={ () =>
														setBlocks( [
															...blocks.slice(
																0,
																index + 1
															),
															block,
															...blocks.slice(
																index + 1
															),
														] )
													}
												/>
												<Button
													size="small"
													icon="trash"
													isDestructive
													label={ __(
														'Remove',
														'smart-diagnostic'
													) }
													onClick={ () =>
														setBlocks(
															blocks.filter(
																( _, i ) =>
																	i !== index
															)
														)
													}
												/>
											</span>
										</div>
										<BlockSettings
											block={ block }
											update={ updateBlock( index ) }
											text={ text }
											withText={ withText }
											groups={ groups }
										/>
									</li>
								) ) }
							</ol>
							<DropdownMenu
								icon="plus"
								label={ __(
									'Add a block',
									'smart-diagnostic'
								) }
								text={ __( 'Add a block', 'smart-diagnostic' ) }
								toggleProps={ { variant: 'secondary' } }
							>
								{ ( { onClose } ) => (
									<MenuGroup>
										{ BLOCK_TYPES().map(
											( [ type, label ] ) => (
												<MenuItem
													key={ type }
													onClick={ () => {
														setBlocks( [
															...blocks,
															newBlock( type ),
														] );
														onClose();
													} }
												>
													{ label }
												</MenuItem>
											)
										) }
									</MenuGroup>
								) }
							</DropdownMenu>
						</>
					) }
				</div>
			) }

			{ mode === 'html' && (
				<div className="sd-b-email__editor">
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Complete HTML document (without the plugin frame)',
							'smart-diagnostic'
						) }
						help={ __(
							'For an entirely custom layout: <html>, <head>, <style>… are then allowed.',
							'smart-diagnostic'
						) }
						checked={ Boolean( settings.fullHtml ) }
						onChange={ ( on ) =>
							save( { ...settings, fullHtml: on || undefined } )
						}
					/>
					<TokenField
						multiline
						code
						label={ __( 'Email body (HTML)', 'smart-diagnostic' ) }
						value={ text( settings.body ) }
						onChange={ ( next ) =>
							save( {
								...settings,
								body: withText( settings.body, next ) ?? '',
							} )
						}
						groups={ groups }
						help={ __(
							'Variables such as {scores} or {cta} are replaced by the visitor’s results.',
							'smart-diagnostic'
						) }
					/>
				</div>
			) }

			<div className="sd-b-row sd-b-email__actions">
				<Button
					variant="secondary"
					isBusy={ busy }
					disabled={ busy }
					onClick={ () => request( false ) }
				>
					{ __( 'Preview', 'smart-diagnostic' ) }
				</Button>
				<Button
					variant="tertiary"
					isBusy={ busy }
					disabled={ busy }
					onClick={ () => request( true ) }
				>
					{ __( 'Send me this email', 'smart-diagnostic' ) }
				</Button>
			</div>
			{ status && (
				<Notice status={ status.type } isDismissible={ false }>
					{ status.text }
				</Notice>
			) }
			{ preview && (
				<div className="sd-b-email__preview">
					<div className="sd-b-row">
						<p>
							<strong>
								{ __( 'Subject:', 'smart-diagnostic' ) }
							</strong>{ ' ' }
							<span className="sd-b-email__subject">
								{ preview.subject }
							</span>
						</p>
						<div
							className="sd-b-email__devices"
							role="group"
							aria-label={ __( 'Screen', 'smart-diagnostic' ) }
						>
							{ [
								[
									'desktop',
									__( 'Computer', 'smart-diagnostic' ),
								],
								[
									'mobile',
									__( 'Mobile', 'smart-diagnostic' ),
								],
							].map( ( [ value, label ] ) => (
								<Button
									key={ value }
									size="small"
									variant={
										device === value
											? 'primary'
											: 'secondary'
									}
									aria-pressed={ device === value }
									onClick={ () => setDevice( value ) }
								>
									{ label }
								</Button>
							) ) }
						</div>
					</div>
					<iframe
						title={ __( 'Email preview', 'smart-diagnostic' ) }
						className={ `sd-b-email__frame is-${ device }` }
						sandbox=""
						srcDoc={ preview.html }
					/>
					<p className="description">
						{ __(
							'Example data: first profile, mid-scale scores, all texts and actions. The preview follows your changes.',
							'smart-diagnostic'
						) }
					</p>
				</div>
			) }
		</div>
	);
}

/**
 * JSON des blocs (bascule sans perte avec l'éditeur visuel).
 *
 * @param {Object}   props
 * @param {string}   props.value    JSON.
 * @param {Function} props.onChange ( raw ) => bool (JSON valide appliqué).
 */
function JsonBlocks( { value, onChange } ) {
	const [ valid, setValid ] = useState( true );
	return (
		<div className="sd-b-email__json">
			<TokenField
				multiline
				code
				label={ __( 'Blocks and style (JSON)', 'smart-diagnostic' ) }
				value={ value ?? '' }
				onChange={ ( raw ) => setValid( onChange( raw ) ) }
				help={ __(
					'Handy to go fast or to paste content prepared with an AI. Turn the option off to go back to the visual editor.',
					'smart-diagnostic'
				) }
			/>
			{ ! valid && (
				<Notice status="warning" isDismissible={ false }>
					{ __(
						'Invalid JSON: the last valid version is kept.',
						'smart-diagnostic'
					) }
				</Notice>
			) }
		</div>
	);
}
