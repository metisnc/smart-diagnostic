/**
 * Aperçu du questionnaire dans l'admin (Preact, mêmes composants que le site).
 * Exposé au constructeur visuel (React) via window.sdPreview.
 */
import { render } from 'preact';
import { App } from '../front/App';
import '../front/front.scss';
import './admin.scss';

let previewKey = 0;

/**
 * Réponses d'exemple (aperçu du résultat) : première réponse des choix, milieu des échelles.
 *
 * @param {Object} config Config.
 * @return {Object} Réponses.
 */
export function sampleAnswers( config ) {
	const answers = {};
	for ( const step of config.steps ?? [] ) {
		if ( step.kind !== 'question' ) {
			continue;
		}
		const rules = step.validation ?? {};
		const first = step.options?.[ 0 ]?.value;
		switch ( step.type ) {
			case 'single':
			case 'dropdown':
			case 'image_choice':
				if ( first !== undefined ) {
					answers[ step.key ] = first;
				}
				break;
			case 'multi':
				if ( first !== undefined ) {
					answers[ step.key ] = [ first ];
				}
				break;
			case 'yes_no':
				answers[ step.key ] = first ?? true;
				break;
			case 'scale':
			case 'slider':
			case 'number':
			case 'amount': {
				const min = rules.min ?? ( step.type === 'scale' ? 1 : 0 );
				const max = rules.max ?? ( step.type === 'scale' ? 5 : 100 );
				answers[ step.key ] = Math.round( ( min + max ) / 2 );
				break;
			}
			default:
				break;
		}
	}
	return answers;
}

window.sdPreview = {
	/**
	 * Affiche (ou rafraîchit) l'aperçu d'une config dans un élément.
	 *
	 * @param {HTMLElement} element Conteneur.
	 * @param {Object}      config  Config.
	 * @param {Object}      [start] Écran de départ : { step }, { screen: 'welcome' } ou
	 *                              { screen: 'results' } (réponses d'exemple).
	 */
	render( element, config, start = null ) {
		const settings = window.sdAdmin ?? {};
		previewKey++;
		try {
			render(
				<App
					key={ previewKey }
					preview
					start={
						start?.screen === 'results'
							? { ...start, answers: sampleAnswers( config ) }
							: start
					}
					payload={ {
						id: 'preview',
						locale: settings.locale,
						strings: settings.strings ?? {},
						config,
					} }
				/>,
				element
			);
		} catch ( error ) {
			// Config incomplète en cours de saisie : l'aperçu reste vide.
			render( null, element );
		}
	},
};

/**
 * Galerie de modèles : aperçu du questionnaire dans une fenêtre.
 */
function initTemplateGallery() {
	const dialog = document.querySelector( '.sd-template-dialog' );
	if ( ! dialog ) {
		return;
	}
	const body = dialog.querySelector( '.sd-template-dialog__body' );
	const close = () => {
		render( null, body );
		dialog.close();
	};
	document.addEventListener( 'click', ( event ) => {
		const button = event.target.closest( '[data-sd-template-preview]' );
		if ( button ) {
			const id = button.dataset.sdTemplatePreview;
			const source = document.getElementById(
				`sd-template-config-${ id }`
			);
			const card = button.closest( '.sd-template-card' );
			dialog.querySelector( 'h2' ).textContent =
				card?.querySelector( '.sd-template-card__title' )
					?.textContent ?? '';
			window.sdPreview.render( body, JSON.parse( source.textContent ) );
			dialog.showModal();
		} else if ( event.target.closest( '[data-sd-template-close]' ) ) {
			close();
		}
	} );
	dialog.addEventListener( 'cancel', () => render( null, body ) );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initTemplateGallery );
} else {
	initTemplateGallery();
}
