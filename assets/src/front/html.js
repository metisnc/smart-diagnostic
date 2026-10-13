/**
 * Assainissement du HTML des textes riches (liste blanche), côté navigateur.
 * Les auteurs de diagnostics n'ont pas forcément le droit unfiltered_html.
 */

const ALLOWED_TAGS = new Set( [
	'P',
	'BR',
	'STRONG',
	'B',
	'EM',
	'I',
	'U',
	'A',
	'UL',
	'OL',
	'LI',
	'SPAN',
	'H3',
	'H4',
	'BLOCKQUOTE',
	'SMALL',
] );
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;

export function safeUrl( url ) {
	return typeof url === 'string' && SAFE_URL.test( url.trim() )
		? url.trim()
		: undefined;
}

function clean( node, doc ) {
	for ( const child of [ ...node.childNodes ] ) {
		if ( child.nodeType === 3 ) {
			continue;
		}
		if ( child.nodeType !== 1 ) {
			child.remove();
			continue;
		}
		if ( ! ALLOWED_TAGS.has( child.tagName ) ) {
			// Balise interdite : on garde le texte, pas l'élément (sauf script/style, supprimés).
			if (
				[ 'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'TEMPLATE' ].includes(
					child.tagName
				)
			) {
				child.remove();
			} else {
				child.replaceWith( doc.createTextNode( child.textContent ) );
			}
			continue;
		}
		const href =
			child.tagName === 'A'
				? safeUrl( child.getAttribute( 'href' ) )
				: undefined;
		for ( const attr of [ ...child.attributes ] ) {
			child.removeAttribute( attr.name );
		}
		if ( href ) {
			child.setAttribute( 'href', href );
			child.setAttribute( 'rel', 'noopener' );
		}
		clean( child, doc );
	}
}

export function sanitizeHtml( html ) {
	if ( ! html || ! /[<&]/.test( html ) ) {
		return html ?? '';
	}
	const doc = new window.DOMParser().parseFromString(
		`<body>${ html }</body>`,
		'text/html'
	);
	clean( doc.body, doc );
	return doc.body.innerHTML;
}

/**
 * Texte riche rendu en HTML assaini.
 *
 * @param {Object} props
 * @param {string} props.html        Texte riche.
 * @param {string} [props.as]        Élément conteneur.
 * @param {string} [props.className]
 */
export function RichText( { html, as: Tag = 'div', className } ) {
	if ( ! html ) {
		return null;
	}
	// eslint-disable-next-line react/no-danger
	return (
		<Tag
			className={ className }
			dangerouslySetInnerHTML={ { __html: sanitizeHtml( html ) } }
		/>
	);
}
