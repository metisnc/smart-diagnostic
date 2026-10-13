/**
 * Jeton anti-spam (Turnstile ou reCAPTCHA v3), chargé seulement au moment de l'envoi.
 */

const SCRIPTS = {
	turnstile:
		'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
	recaptcha: 'https://www.google.com/recaptcha/api.js?render=',
};
const TIMEOUT_MS = 15000;

const loaded = {};

function loadScript( src ) {
	if ( ! loaded[ src ] ) {
		loaded[ src ] = new Promise( ( resolve, reject ) => {
			const script = document.createElement( 'script' );
			script.src = src;
			script.async = true;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild( script );
		} );
	}
	return loaded[ src ];
}

async function turnstileToken( siteKey ) {
	await loadScript( SCRIPTS.turnstile );
	return new Promise( ( resolve, reject ) => {
		const container = document.createElement( 'div' );
		container.className = 'sd-captcha';
		document.body.appendChild( container );
		window.turnstile.render( container, {
			sitekey: siteKey,
			appearance: 'interaction-only',
			callback: ( token ) => {
				resolve( token );
				container.remove();
			},
			'error-callback': () => {
				reject( new Error( 'captcha' ) );
				container.remove();
			},
		} );
	} );
}

async function recaptchaToken( siteKey ) {
	await loadScript( SCRIPTS.recaptcha + encodeURIComponent( siteKey ) );
	return new Promise( ( resolve, reject ) => {
		window.grecaptcha.ready( () =>
			window.grecaptcha
				.execute( siteKey, { action: 'submit' } )
				.then( resolve, reject )
		);
	} );
}

/**
 * @param {{provider: string, siteKey: string}|undefined} captcha Réglages.
 * @return {Promise<string>} Jeton (vide si pas de captcha ou en cas d'échec).
 */
export async function captchaToken( captcha ) {
	if ( ! captcha?.siteKey ) {
		return '';
	}
	const get =
		captcha.provider === 'recaptcha' ? recaptchaToken : turnstileToken;
	try {
		return await Promise.race( [
			get( captcha.siteKey ),
			new Promise( ( resolve ) =>
				setTimeout( () => resolve( '' ), TIMEOUT_MS )
			),
		] );
	} catch ( error ) {
		return '';
	}
}
