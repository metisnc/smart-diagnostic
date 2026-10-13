/**
 * Point d'entrée front : monte une app sur chaque conteneur [data-sd-diagnostic].
 * Le parcours complet arrive en M1 ; M0 valide la chaîne de build Preact.
 */
import { render } from 'preact';
import { App } from './App';

function mountAll() {
	document.querySelectorAll( '[data-sd-diagnostic]' ).forEach( ( el ) => {
		if ( el.dataset.sdMounted ) {
			return;
		}
		el.dataset.sdMounted = '1';
		render( <App id={ el.dataset.sdDiagnostic } />, el );
	} );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', mountAll );
} else {
	mountAll();
}
