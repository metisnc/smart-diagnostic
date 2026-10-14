/**
 * Aperçu du questionnaire dans l'admin (Preact, mêmes composants que le site).
 * Exposé au constructeur visuel (React) via window.sdPreview.
 */
import { render } from 'preact';
import { App } from '../front/App';
import '../front/front.scss';
import './admin.scss';

let previewKey = 0;

window.sdPreview = {
	/**
	 * Affiche (ou rafraîchit) l'aperçu d'une config dans un élément.
	 *
	 * @param {HTMLElement} element Conteneur.
	 * @param {Object}      config  Config.
	 */
	render( element, config ) {
		const settings = window.sdAdmin ?? {};
		previewKey++;
		try {
			render(
				<App
					key={ previewKey }
					preview
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
