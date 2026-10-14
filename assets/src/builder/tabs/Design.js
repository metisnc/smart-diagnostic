/**
 * Onglet « Apparence » : thèmes prêts à l'emploi, couleurs (avec contrôle de lisibilité),
 * polices, arrondis et largeur par menus, logo depuis la médiathèque, mentions, libellés.
 */
import { useState } from '@wordpress/element';
import {
	Button,
	Notice,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { I18nText, ListEditor } from '../fields';

// Valeurs par défaut du questionnaire (front.scss).
export const DEFAULT_COLORS = {
	primary: '#2563eb',
	primaryText: '#ffffff',
	background: '#ffffff',
	surface: '#f5f7fa',
	text: '#1f2937',
	muted: '#6b7280',
};

const COLORS = () => [
	[ 'primary', __( 'Main colour', 'smart-diagnostic' ) ],
	[ 'primaryText', __( 'Text on main colour', 'smart-diagnostic' ) ],
	[ 'background', __( 'Background', 'smart-diagnostic' ) ],
	[ 'surface', __( 'Panels', 'smart-diagnostic' ) ],
	[ 'text', __( 'Text', 'smart-diagnostic' ) ],
	[ 'muted', __( 'Secondary text', 'smart-diagnostic' ) ],
];

const PALETTES = () => [
	{
		name: __( 'Blue (default)', 'smart-diagnostic' ),
		colors: DEFAULT_COLORS,
	},
	{
		name: __( 'Nature green', 'smart-diagnostic' ),
		colors: {
			primary: '#047857',
			primaryText: '#ffffff',
			background: '#ffffff',
			surface: '#f0fdf4',
			text: '#1c2b22',
			muted: '#5b6b60',
		},
	},
	{
		name: __( 'Violet', 'smart-diagnostic' ),
		colors: {
			primary: '#6d28d9',
			primaryText: '#ffffff',
			background: '#ffffff',
			surface: '#f5f3ff',
			text: '#1e1b4b',
			muted: '#6b7280',
		},
	},
	{
		name: __( 'Warm orange', 'smart-diagnostic' ),
		colors: {
			primary: '#c2410c',
			primaryText: '#ffffff',
			background: '#fffaf5',
			surface: '#fff1e6',
			text: '#292524',
			muted: '#78716c',
		},
	},
	{
		name: __( 'Pink', 'smart-diagnostic' ),
		colors: {
			primary: '#be185d',
			primaryText: '#ffffff',
			background: '#ffffff',
			surface: '#fdf2f8',
			text: '#3f1d2e',
			muted: '#7a5c6a',
		},
	},
	{
		name: __( 'Sober black', 'smart-diagnostic' ),
		colors: {
			primary: '#111827',
			primaryText: '#ffffff',
			background: '#ffffff',
			surface: '#f3f4f6',
			text: '#111827',
			muted: '#6b7280',
		},
	},
	{
		name: __( 'Elegant dark', 'smart-diagnostic' ),
		colors: {
			primary: '#f59e0b',
			primaryText: '#111827',
			background: '#111827',
			surface: '#1f2937',
			text: '#f9fafb',
			muted: '#9ca3af',
		},
	},
];

const FONTS = () => [
	[
		'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
		__( 'Modern (system font)', 'smart-diagnostic' ),
	],
	[ 'Arial, Helvetica, sans-serif', 'Arial / Helvetica' ],
	[ 'Verdana, Geneva, sans-serif', 'Verdana' ],
	[ '"Trebuchet MS", Tahoma, sans-serif', 'Trebuchet MS' ],
	[ 'Georgia, "Times New Roman", serif', 'Georgia' ],
	[ '"Palatino Linotype", Palatino, "Book Antiqua", serif', 'Palatino' ],
	[ '"Times New Roman", Times, serif', 'Times New Roman' ],
	[
		'ui-monospace, Menlo, Consolas, monospace',
		__( 'Monospace', 'smart-diagnostic' ),
	],
];

const RADII = () => [
	[ '0px', __( 'Square', 'smart-diagnostic' ) ],
	[ '4px', __( 'Slightly rounded', 'smart-diagnostic' ) ],
	[ '8px', __( 'Rounded', 'smart-diagnostic' ) ],
	[ '20px', __( 'Very rounded', 'smart-diagnostic' ) ],
	[ '999px', __( 'Pill', 'smart-diagnostic' ) ],
];

const WIDTHS = () => [
	[ '520px', __( 'Narrow (520 px)', 'smart-diagnostic' ) ],
	[ '800px', __( 'Wide (800 px)', 'smart-diagnostic' ) ],
	[ '960px', __( 'Very wide (960 px)', 'smart-diagnostic' ) ],
	[ '100%', __( 'Full width', 'smart-diagnostic' ) ],
];

const CUSTOM = '__custom';

/**
 * Rapport de contraste WCAG entre deux couleurs hexadécimales.
 *
 * @param {string} a Couleur.
 * @param {string} b Couleur.
 * @return {number} Rapport (1 à 21).
 */
export function contrast( a, b ) {
	const luminance = ( hex ) => {
		let value = hex.replace( '#', '' ).slice( 0, 6 );
		if ( value.length === 3 ) {
			value = value
				.split( '' )
				.map( ( c ) => c + c )
				.join( '' );
		}
		const [ r, g, bl ] = [ 0, 2, 4 ].map( ( i ) => {
			const c = parseInt( value.slice( i, i + 2 ), 16 ) / 255;
			return c <= 0.03928 ? c / 12.92 : ( ( c + 0.055 ) / 1.055 ) ** 2.4;
		} );
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const [ light, dark ] = [ luminance( a ), luminance( b ) ].sort(
		( x, y ) => y - x
	);
	return ( light + 0.05 ) / ( dark + 0.05 );
}

/**
 * Menu de valeurs prédéfinies, avec « Par défaut » et « Personnalisé… » (saisie libre).
 *
 * @param {Object}   props
 * @param {string}   props.label        Libellé.
 * @param {string}   props.value        Valeur actuelle (vide = défaut).
 * @param {Array}    props.presets      [ valeur, libellé ].
 * @param {string}   props.defaultLabel Libellé de la valeur par défaut.
 * @param {Function} props.onChange     ( valeur | undefined ) => void.
 * @param {string}   props.customHelp   Aide de la saisie libre.
 * @param {RegExp}   [props.pattern]    Format accepté en saisie libre.
 */
function PresetSelect( {
	label,
	value,
	presets,
	defaultLabel,
	onChange,
	customHelp,
	pattern,
} ) {
	const known = ! value || presets.some( ( [ v ] ) => v === value );
	// Mode « Personnalisé » gardé localement : un champ vide ne casse pas la configuration.
	const [ custom, setCustom ] = useState( ! known );
	const selected = custom ? CUSTOM : ( value ?? '' );
	const invalid = custom && value && pattern && ! pattern.test( value );
	return (
		<div className="sd-b-preset">
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ label }
				value={ selected }
				options={ [
					{ value: '', label: defaultLabel },
					...presets.map( ( [ v, text ] ) => ( {
						value: v,
						label: text,
					} ) ),
					{
						value: CUSTOM,
						label: __( 'Custom…', 'smart-diagnostic' ),
					},
				] }
				onChange={ ( next ) => {
					setCustom( next === CUSTOM );
					if ( next !== CUSTOM ) {
						onChange( next || undefined );
					}
				} }
			/>
			{ selected === CUSTOM && (
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					className={ invalid ? 'sd-b-invalid' : undefined }
					label={ __( 'Custom value', 'smart-diagnostic' ) }
					hideLabelFromVision
					help={ customHelp }
					value={ value ?? '' }
					onChange={ ( next ) => onChange( next || undefined ) }
				/>
			) }
		</div>
	);
}

/**
 * Logo : médiathèque (choisir ou téléverser), adresse, description, aperçu.
 *
 * @param {Object}   props
 * @param {Object}   props.logo      { id, url, alt }.
 * @param {Function} props.onChange  ( logo | undefined ) => void.
 * @param {string[]} props.languages Langues.
 */
function LogoField( { logo, onChange, languages } ) {
	const update = ( patch ) => {
		const next = { ...logo, ...patch };
		Object.keys( next ).forEach(
			( key ) =>
				( next[ key ] === undefined || next[ key ] === '' ) &&
				delete next[ key ]
		);
		onChange( Object.keys( next ).length ? next : undefined );
	};
	const openLibrary = () => {
		const frame = window.wp.media( {
			title: __( 'Choose or upload a logo', 'smart-diagnostic' ),
			button: { text: __( 'Use this logo', 'smart-diagnostic' ) },
			library: { type: 'image' },
			multiple: false,
		} );
		frame.on( 'select', () => {
			const image = frame.state().get( 'selection' ).first().toJSON();
			update( {
				id: image.id,
				url: image.url,
				alt: logo.alt ?? ( image.alt || undefined ),
			} );
		} );
		frame.open();
	};
	return (
		<div className="sd-b-logo">
			<div className="sd-b-logo__preview">
				{ logo.url ? (
					<img src={ logo.url } alt="" />
				) : (
					<span>{ __( 'No logo', 'smart-diagnostic' ) }</span>
				) }
			</div>
			<div className="sd-b-logo__fields">
				<div className="sd-b-logo__buttons">
					{ window.wp?.media && (
						<Button variant="secondary" onClick={ openLibrary }>
							{ logo.url
								? __( 'Replace the logo', 'smart-diagnostic' )
								: __(
										'Choose or upload a logo',
										'smart-diagnostic'
									) }
						</Button>
					) }
					{ logo.url && (
						<Button
							variant="tertiary"
							isDestructive
							onClick={ () =>
								update( {
									id: undefined,
									url: undefined,
								} )
							}
						>
							{ __( 'Remove', 'smart-diagnostic' ) }
						</Button>
					) }
				</div>
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					type="url"
					label={ __(
						'Or logo address (https://…)',
						'smart-diagnostic'
					) }
					value={ logo.url ?? '' }
					onChange={ ( url ) => update( { id: undefined, url } ) }
				/>
				<I18nText
					label={ __(
						'Logo description (for accessibility)',
						'smart-diagnostic'
					) }
					value={ logo.alt }
					languages={ languages }
					onChange={ ( alt ) => update( { alt } ) }
				/>
			</div>
		</div>
	);
}

export function DesignTab( { config, set, languages } ) {
	const theme = config.ui?.theme ?? {};
	const colors = { ...DEFAULT_COLORS, ...( theme.colors ?? {} ) };
	const strings = config.ui?.strings ?? {};
	const setTheme = ( key, value ) =>
		set( [ 'ui', 'theme', key ], value === undefined ? undefined : value );
	const fontStyle = ( font ) => ( font ? { fontFamily: font } : undefined );

	const warnings = [];
	if ( contrast( colors.primary, colors.primaryText ) < 4.5 ) {
		warnings.push(
			__(
				'The text of the buttons is hard to read on the main colour.',
				'smart-diagnostic'
			)
		);
	}
	if ( contrast( colors.text, colors.background ) < 4.5 ) {
		warnings.push(
			__(
				'The text is hard to read on the background.',
				'smart-diagnostic'
			)
		);
	}

	return (
		<div className="sd-b-tab sd-b-design">
			<section className="sd-b-design__section">
				<h3>{ __( 'Ready-made themes', 'smart-diagnostic' ) }</h3>
				<p className="description">
					{ __(
						'One click applies a set of matching colours. You can then adjust each colour below.',
						'smart-diagnostic'
					) }
				</p>
				<div className="sd-b-palettes">
					{ PALETTES().map( ( palette ) => (
						<button
							key={ palette.name }
							type="button"
							className="sd-b-palette"
							onClick={ () =>
								set( [ 'ui', 'theme', 'colors' ], {
									...( theme.colors ?? {} ),
									...palette.colors,
								} )
							}
						>
							<span
								className="sd-b-palette__sample"
								style={ {
									background: palette.colors.background,
									color: palette.colors.text,
								} }
							>
								<span
									className="sd-b-palette__button"
									style={ {
										background: palette.colors.primary,
										color: palette.colors.primaryText,
									} }
								>
									Aa
								</span>
								<span
									className="sd-b-palette__panel"
									style={ {
										background: palette.colors.surface,
									} }
								/>
							</span>
							<span className="sd-b-palette__name">
								{ palette.name }
							</span>
						</button>
					) ) }
				</div>
			</section>

			<section className="sd-b-design__section">
				<h3>{ __( 'Colours', 'smart-diagnostic' ) }</h3>
				<div className="sd-b-grid">
					{ COLORS().map( ( [ key, label ] ) => (
						<label key={ key } className="sd-b-color">
							<input
								type="color"
								value={ colors[ key ] }
								onChange={ ( event ) =>
									set(
										[ 'ui', 'theme', 'colors', key ],
										event.target.value
									)
								}
							/>
							<span>
								{ label }
								<code>{ colors[ key ] }</code>
							</span>
							{ theme.colors?.[ key ] && (
								<button
									type="button"
									className="button-link"
									onClick={ () =>
										set(
											[ 'ui', 'theme', 'colors', key ],
											undefined
										)
									}
								>
									{ __( 'Reset', 'smart-diagnostic' ) }
								</button>
							) }
						</label>
					) ) }
				</div>
				{ warnings.map( ( warning ) => (
					<Notice
						key={ warning }
						status="warning"
						isDismissible={ false }
					>
						{ warning }{ ' ' }
						{ __(
							'Choose colours with more contrast so everyone can read.',
							'smart-diagnostic'
						) }
					</Notice>
				) ) }
			</section>

			<section className="sd-b-design__section">
				<h3>{ __( 'Fonts', 'smart-diagnostic' ) }</h3>
				<div className="sd-b-grid">
					<PresetSelect
						label={ __( 'Text', 'smart-diagnostic' ) }
						value={ theme.fontFamily }
						presets={ FONTS() }
						defaultLabel={ __(
							'Same as my site (theme font)',
							'smart-diagnostic'
						) }
						customHelp={ __(
							'Name of a font loaded by your theme, for example: Montserrat, sans-serif',
							'smart-diagnostic'
						) }
						pattern={ /^[\w\s,'"-]+$/ }
						onChange={ ( v ) => setTheme( 'fontFamily', v ) }
					/>
					<PresetSelect
						label={ __( 'Titles', 'smart-diagnostic' ) }
						value={ theme.headingFontFamily }
						presets={ FONTS() }
						defaultLabel={ __(
							'Same as the text',
							'smart-diagnostic'
						) }
						customHelp={ __(
							'Name of a font loaded by your theme, for example: Playfair Display, serif',
							'smart-diagnostic'
						) }
						pattern={ /^[\w\s,'"-]+$/ }
						onChange={ ( v ) => setTheme( 'headingFontFamily', v ) }
					/>
				</div>
				<div
					className="sd-b-design__font-sample"
					style={ fontStyle( theme.fontFamily ) }
				>
					<strong
						style={ fontStyle(
							theme.headingFontFamily || theme.fontFamily
						) }
					>
						{ __(
							'Is your business visible online?',
							'smart-diagnostic'
						) }
					</strong>
					<span>
						{ __(
							'10 questions, 3 minutes: get your score and a personalised action plan.',
							'smart-diagnostic'
						) }
					</span>
				</div>
			</section>

			<section className="sd-b-design__section">
				<h3>{ __( 'Shapes and layout', 'smart-diagnostic' ) }</h3>
				<div className="sd-b-grid">
					<PresetSelect
						label={ __( 'Corners', 'smart-diagnostic' ) }
						value={ theme.radius }
						presets={ RADII() }
						defaultLabel={ __(
							'Rounded (default, 12 px)',
							'smart-diagnostic'
						) }
						customHelp={ __(
							'In pixels, for example 6px',
							'smart-diagnostic'
						) }
						pattern={ /^[0-9.]+(px|rem|em)$/ }
						onChange={ ( v ) => setTheme( 'radius', v ) }
					/>
					<PresetSelect
						label={ __(
							'Width of the questionnaire',
							'smart-diagnostic'
						) }
						value={ theme.maxWidth }
						presets={ WIDTHS() }
						defaultLabel={ __(
							'Normal (default, 640 px)',
							'smart-diagnostic'
						) }
						customHelp={ __(
							'In pixels or %, for example 720px',
							'smart-diagnostic'
						) }
						pattern={ /^[0-9.]+(px|rem|em|%)$/ }
						onChange={ ( v ) => setTheme( 'maxWidth', v ) }
					/>
				</div>
				<div
					className="sd-b-design__shape-sample"
					style={ {
						borderRadius: theme.radius ? theme.radius : '12px',
						background: colors.primary,
						color: colors.primaryText,
					} }
				>
					{ __( 'See my results', 'smart-diagnostic' ) }
				</div>
			</section>

			<section className="sd-b-design__section">
				<h3>{ __( 'Logo', 'smart-diagnostic' ) }</h3>
				<LogoField
					logo={ config.ui?.logo ?? {} }
					languages={ languages }
					onChange={ ( logo ) => set( [ 'ui', 'logo' ], logo ) }
				/>
			</section>

			<section className="sd-b-design__section">
				<h3>{ __( 'Legal notice', 'smart-diagnostic' ) }</h3>
				<I18nText
					multiline
					label={ __(
						'Legal notice (below the questionnaire)',
						'smart-diagnostic'
					) }
					value={ config.ui?.legal }
					languages={ languages }
					onChange={ ( v ) => set( [ 'ui', 'legal' ], v ) }
				/>
			</section>

			<section className="sd-b-design__section">
				<h3>{ __( 'Interface labels', 'smart-diagnostic' ) }</h3>
				<p className="description">
					{ __(
						'Override the default labels (Next, Back, See my results…) for this diagnostic.',
						'smart-diagnostic'
					) }
				</p>
				<ListEditor
					items={ Object.entries( strings ).map(
						( [ key, value ] ) => ( {
							key,
							value,
						} )
					) }
					onChange={ ( list ) =>
						set(
							[ 'ui', 'strings' ],
							list?.length
								? Object.fromEntries(
										list.map( ( item ) => [
											item.key,
											item.value,
										] )
									)
								: undefined
						)
					}
					newItem={ () => ( { key: 'next', value: '' } ) }
					addLabel={ __( 'Override a label', 'smart-diagnostic' ) }
					renderItem={ ( item, update ) => (
						<div className="sd-b-row">
							<SelectControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Label', 'smart-diagnostic' ) }
								value={ item.key }
								options={ Object.keys(
									window.sdAdmin?.strings ?? {}
								).map( ( key ) => ( {
									value: key,
									label: sprintf(
										'%1$s — %2$s',
										key,
										window.sdAdmin.strings[ key ]
									),
								} ) ) }
								onChange={ ( key ) =>
									update( { ...item, key } )
								}
							/>
							<I18nText
								label={ __( 'Text', 'smart-diagnostic' ) }
								value={ item.value }
								languages={ languages }
								onChange={ ( value ) =>
									update( { ...item, value: value ?? '' } )
								}
							/>
						</div>
					) }
				/>
			</section>
		</div>
	);
}
