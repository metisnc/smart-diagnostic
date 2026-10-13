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
