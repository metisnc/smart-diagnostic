/**
 * Monte le constructeur visuel dans la boîte « Configuration » d'un diagnostic.
 */
import { createRoot } from '@wordpress/element';
import { Builder } from './Builder';
import './builder.scss';

function init() {
	const root = document.getElementById( 'sd-builder' );
	const field = document.getElementById( 'sd-config-field' );
	if ( ! root || ! field || ! window.sdAdmin ) {
		return;
	}
	let initial;
	try {
		initial = JSON.parse( field.value );
	} catch ( error ) {
		// JSON invalide conservé après une erreur d'enregistrement : les onglets partent d'une
		// base vide, le texte d'origine s'ouvre dans l'onglet JSON pour être corrigé.
		initial = { schemaVersion: 1, sections: [], steps: [] };
	}
	createRoot( root ).render(
		<Builder
			initial={ initial }
			initialText={ field.value }
			field={ field }
			schema={ window.sdAdmin.schema }
		/>
	);
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
