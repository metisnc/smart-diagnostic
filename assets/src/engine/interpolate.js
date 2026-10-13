/**
 * Variables de personnalisation dans les textes :
 *   {first_name}       prénom (contact, sinon réponse à l'étape "first_name")
 *   {answer:cle}       réponse (libellé de l'option pour les choix)
 *   {score:axe}        score arrondi
 *   {var:cle}          variable calculée
 *   {contact:champ}    champ du formulaire de capture
 */
import { resolveText } from './text';

const PATTERN =
	/\{(first_name|(answer|score|var|contact):([a-z][a-z0-9_]*))\}/g;

function optionLabel( step, value, lang, fallbackLang ) {
	const option = ( step?.options ?? [] ).find(
		( candidate ) => candidate.value === value
	);
	return option ? resolveText( option.label, lang, fallbackLang ) : value;
}

function displayAnswer( step, value, lang, fallbackLang ) {
	if ( value === null || value === undefined ) {
		return '';
	}
	if ( Array.isArray( value ) ) {
		return value
			.map( ( item ) => optionLabel( step, item, lang, fallbackLang ) )
			.join( ', ' );
	}
	if ( typeof value === 'object' ) {
		return Object.values( value ).join( ', ' );
	}
	return String( optionLabel( step, value, lang, fallbackLang ) );
}

/**
 * @param {string} text             Texte déjà résolu dans la bonne langue.
 * @param {Object} params
 * @param {Object} params.config
 * @param {Object} params.answers
 * @param {Object} [params.contact]
 * @param {Object} [params.scores]
 * @param {Object} [params.vars]
 * @param {string} [params.lang]
 * @return {string} Texte avec variables remplacées.
 */
export function interpolate(
	text,
	{ config, answers, contact = {}, scores = {}, vars = {}, lang }
) {
	if ( ! text || ! text.includes( '{' ) ) {
		return text;
	}
	const fallbackLang = config.i18n?.defaultLanguage;
	const stepsByKey = new Map(
		( config.steps ?? [] ).map( ( step ) => [ step.key, step ] )
	);

	return text.replace( PATTERN, ( match, whole, root, key ) => {
		if ( whole === 'first_name' ) {
			const name = contact.first_name ?? answers.first_name;
			return typeof name === 'string' ? name.trim() : '';
		}
		switch ( root ) {
			case 'answer':
				return displayAnswer(
					stepsByKey.get( key ),
					answers[ key ],
					lang,
					fallbackLang
				);
			case 'score':
				return typeof scores[ key ] === 'number'
					? String( Math.round( scores[ key ] ) )
					: '';
			case 'var':
				return vars[ key ] === undefined || vars[ key ] === null
					? ''
					: String( vars[ key ] );
			case 'contact':
				return contact[ key ] === undefined
					? ''
					: String( contact[ key ] );
		}
		return match;
	} );
}
