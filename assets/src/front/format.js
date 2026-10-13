/**
 * Mise en forme des nombres (variables, scores) selon numberFormat de la config.
 */

/**
 * @param {unknown} value  Valeur.
 * @param {Object}  format { style, decimals, currency, suffix } (suffix déjà résolu).
 * @param {string}  locale Locale BCP 47.
 * @return {string} Valeur affichable.
 */
export function formatValue( value, format = {}, locale = 'en' ) {
	if ( typeof value !== 'number' ) {
		return value === null || value === undefined ? '' : String( value );
	}
	const options = {};
	if ( format.decimals !== undefined ) {
		options.minimumFractionDigits = format.decimals;
		options.maximumFractionDigits = format.decimals;
	} else {
		options.maximumFractionDigits = 2;
	}
	let text;
	try {
		if ( format.style === 'currency' && format.currency ) {
			text = new Intl.NumberFormat( locale, {
				...options,
				style: 'currency',
				currency: format.currency,
			} ).format( value );
		} else if ( format.style === 'percent' ) {
			// La valeur est déjà en pourcentage (ex. 42 → « 42 % »).
			text = new Intl.NumberFormat( locale, {
				...options,
				style: 'percent',
			} ).format( value / 100 );
		} else {
			text = new Intl.NumberFormat( locale, options ).format( value );
		}
	} catch ( error ) {
		text = String( value );
	}
	return format.suffix ? `${ text } ${ format.suffix }` : text;
}

/**
 * Ajoute les paramètres UTM à une URL (sans écraser ceux déjà présents).
 *
 * @param {string} url Adresse.
 * @param {Object} utm { source, medium, campaign, content, term }.
 * @return {string} Adresse complétée.
 */
export function withUtm( url, utm ) {
	if ( ! utm ) {
		return url;
	}
	try {
		const parsed = new URL( url, window.location.href );
		for ( const [ key, value ] of Object.entries( utm ) ) {
			if ( value && ! parsed.searchParams.has( `utm_${ key }` ) ) {
				parsed.searchParams.set( `utm_${ key }`, value );
			}
		}
		return parsed.toString();
	} catch ( error ) {
		return url;
	}
}
