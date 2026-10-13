/**
 * Éditeur JSON (phase 1) : coloration, validation en direct contre le schéma, aperçu.
 */
import { render } from 'preact';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { App } from '../front/App';
import '../front/front.scss';
import './admin.scss';

const DEBOUNCE_MS = 400;

function init() {
	const settings = window.sdAdmin;
	const field = document.getElementById( 'sd-config-field' );
	const status = document.getElementById( 'sd-config-status' );
	const preview = document.getElementById( 'sd-config-preview' );
	if ( ! settings || ! field || ! status || ! preview ) {
		return;
	}

	const ajv = new Ajv2020( { allErrors: true, strict: false } );
	addFormats( ajv );
	const validate = ajv.compile( settings.schema );

	let editor = null;
	if ( window.wp?.codeEditor && settings.codeEditor ) {
		editor = window.wp.codeEditor.initialize(
			field,
			settings.codeEditor
		).codemirror;
	}
	const getValue = () => ( editor ? editor.getValue() : field.value );

	let previewKey = 0;
	const showStatus = ( ok, title, lines = [] ) => {
		status.className = `sd-editor__status ${ ok ? 'is-valid' : 'is-invalid' }`;
		status.textContent = '';
		const strong = document.createElement( 'strong' );
		strong.textContent = title;
		status.appendChild( strong );
		if ( lines.length ) {
			const list = document.createElement( 'ul' );
			for ( const line of lines.slice( 0, 20 ) ) {
				const item = document.createElement( 'li' );
				item.textContent = line;
				list.appendChild( item );
			}
			status.appendChild( list );
		}
	};

	const refresh = () => {
		let config;
		try {
			config = JSON.parse( getValue() );
		} catch ( error ) {
			showStatus( false, settings.i18n.invalidJson, [ error.message ] );
			return;
		}
		if ( ! validate( config ) ) {
			showStatus(
				false,
				settings.i18n.invalid,
				validate.errors.map(
					( error ) =>
						`${ error.instancePath || '/' } : ${ error.message }`
				)
			);
			return;
		}
		showStatus( true, settings.i18n.valid );
		previewKey++;
		render(
			<App
				key={ previewKey }
				preview
				payload={ {
					id: 'preview',
					locale: settings.locale,
					strings: settings.strings,
					config,
				} }
			/>,
			preview
		);
	};

	let timer;
	const schedule = () => {
		clearTimeout( timer );
		timer = setTimeout( refresh, DEBOUNCE_MS );
	};
	if ( editor ) {
		editor.on( 'change', () => {
			editor.save();
			schedule();
		} );
	} else {
		field.addEventListener( 'input', schedule );
	}
	refresh();
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
