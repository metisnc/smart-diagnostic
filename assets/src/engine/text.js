/**
 * Résout un texte multilingue de la config.
 *
 * Un texte est soit une chaîne, soit un objet { langue: texte }.
 * Ordre de repli : langue demandée → langue courte (fr_FR → fr) → langue par défaut → premier texte.
 *
 * @param {string|Object<string,string>|undefined} text           Texte de la config.
 * @param {string}                                 lang           Langue demandée (ex. "fr" ou "fr_FR").
 * @param {string}                                 [fallbackLang] Langue par défaut du diagnostic.
 * @return {string} Texte résolu, ou chaîne vide.
 */
export function resolveText( text, lang, fallbackLang ) {
	if ( typeof text === 'string' ) {
		return text;
	}
	if ( ! text || typeof text !== 'object' ) {
		return '';
	}
	const shortLang = lang ? lang.split( '_' )[ 0 ] : undefined;
	for ( const key of [ lang, shortLang, fallbackLang ] ) {
		if ( key && typeof text[ key ] === 'string' ) {
			return text[ key ];
		}
	}
	const first = Object.values( text ).find(
		( value ) => typeof value === 'string'
	);
	return first ?? '';
}
