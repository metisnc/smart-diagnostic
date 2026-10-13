/**
 * Conversion de ui.theme en CSS custom properties (--sd-*), avec validation des valeurs.
 */

const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LENGTH = /^[0-9.]+(px|rem|em|%)$/;
const FONT = /^[\w\s,'"-]+$/;

const COLOR_VARS = {
	primary: '--sd-primary',
	primaryText: '--sd-primary-text',
	background: '--sd-bg',
	surface: '--sd-surface',
	text: '--sd-text',
	muted: '--sd-muted',
	success: '--sd-success',
	warning: '--sd-warning',
	danger: '--sd-danger',
};

export function themeStyle( theme = {} ) {
	const style = {};
	for ( const [ key, cssVar ] of Object.entries( COLOR_VARS ) ) {
		const value = theme.colors?.[ key ];
		if ( typeof value === 'string' && COLOR.test( value ) ) {
			style[ cssVar ] = value;
		}
	}
	if (
		typeof theme.fontFamily === 'string' &&
		FONT.test( theme.fontFamily )
	) {
		style[ '--sd-font' ] = theme.fontFamily;
	}
	if (
		typeof theme.headingFontFamily === 'string' &&
		FONT.test( theme.headingFontFamily )
	) {
		style[ '--sd-heading-font' ] = theme.headingFontFamily;
	}
	if ( typeof theme.radius === 'string' && LENGTH.test( theme.radius ) ) {
		style[ '--sd-radius' ] = theme.radius;
	}
	if ( typeof theme.maxWidth === 'string' && LENGTH.test( theme.maxWidth ) ) {
		style[ '--sd-max-width' ] = theme.maxWidth;
	}
	return style;
}
