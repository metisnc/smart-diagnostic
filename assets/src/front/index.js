/**
 * Point d'entrée front : monte une app sur chaque conteneur [data-sd-diagnostic].
 */
import { render } from 'preact';
import { App } from './App';
import './front.scss';

function mount( el ) {
	if ( el.dataset.sdMounted ) {
		return;
	}
	const script = el.querySelector( 'script.sd-payload' );
	let payload;
	try {
		payload = JSON.parse( script?.textContent ?? '' );
	} catch ( error ) {
		return;
	}
	el.dataset.sdMounted = '1';
	el.textContent = '';
	render( <App payload={ payload } />, el );
}

function mountAll() {
	document.querySelectorAll( '[data-sd-diagnostic]' ).forEach( mount );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', mountAll );
} else {
	mountAll();
}
