/**
 * Modèle d'email personnalisé : éditeur HTML avec variables, aperçu et envoi d'essai.
 */
import { useRef, useState } from '@wordpress/element';
import {
	Button,
	Notice,
	RadioControl,
	SelectControl,
	ToggleControl,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

const STARTERS = {
	user: () =>
		[
			`<h1 style="font-size:22px;margin:0 0 16px;">${ __(
				'Hello {first_name},',
				'smart-diagnostic'
			) }</h1>`,
			`<p>${ __(
				'Thank you for taking the diagnostic. Here are your results:',
				'smart-diagnostic'
			) }</p>`,
			'<h2 style="font-size:18px;">{profile}</h2>',
			'{profile_text}',
			'{scores}',
			'{texts}',
			'{actions}',
			'{cta}',
			`<p>${ __(
				'View your results online at any time:',
				'smart-diagnostic'
			) }</p>`,
			'{result_button}',
		].join( '\n' ),
	admin: () =>
		[
			`<h1 style="font-size:20px;margin:0 0 16px;">${ __(
				'New submission: {first_name} ({email})',
				'smart-diagnostic'
			) }</h1>`,
			'<p><strong>{profile}</strong></p>',
			'{scores}',
			'{answers}',
			'{result_button}',
		].join( '\n' ),
};

/**
 * @param {Object}   props
 * @param {string}   props.kind      user | admin.
 * @param {Object}   props.config    Config.
 * @param {Function} props.set       ( path, value ) => void.
 * @param {string[]} props.languages Langues du diagnostic.
 */
export function EmailTemplateEditor( { kind, config, set, languages } ) {
	const settings = config.integrations?.emails?.[ kind ] ?? {};
	const path = [ 'integrations', 'emails', kind ];
	const body = settings.body;
	const custom = body !== undefined;
	const langs = languages.length ? languages : [ '' ];
	const [ lang, setLang ] = useState( langs[ 0 ] );
	const [ preview, setPreview ] = useState( null );
	const [ status, setStatus ] = useState( null );
	const [ busy, setBusy ] = useState( false );
	const textarea = useRef( null );
	const multilingual = langs.length > 1;

	const valueFor = ( code ) => {
		if ( typeof body === 'string' ) {
			return body;
		}
		return body?.[ code ] ?? '';
	};
	const setBody = ( text ) => {
		if ( ! multilingual ) {
			set( [ ...path, 'body' ], text );
			return;
		}
		const object =
			typeof body === 'string' ? { [ langs[ 0 ] ]: body } : { ...body };
		object[ lang ] = text;
		set( [ ...path, 'body' ], object );
	};

	const insert = ( token ) => {
		const el = textarea.current;
		const current = valueFor( lang );
		const start = el ? el.selectionStart : current.length;
		const end = el ? el.selectionEnd : current.length;
		setBody( current.slice( 0, start ) + token + current.slice( end ) );
		window.requestAnimationFrame( () => {
			if ( el ) {
				el.focus();
				el.setSelectionRange(
					start + token.length,
					start + token.length
				);
			}
		} );
	};

	const request = async ( send ) => {
		setBusy( true );
		setStatus( null );
		try {
			const response = await apiFetch( {
				path: window.sdAdmin.previewPath,
				method: 'POST',
				data: {
					config,
					kind,
					send,
					diagnostic_id: window.sdAdmin.postId,
				},
			} );
			setPreview( response );
			if ( send ) {
				setStatus(
					response.sent
						? {
								type: 'success',
								text: sprintf(
									/* translators: %s: email address. */
									__(
										'Preview sent to %s.',
										'smart-diagnostic'
									),
									response.to
								),
							}
						: { type: 'error', text: response.error }
				);
			}
		} catch ( error ) {
			setStatus( { type: 'error', text: error.message } );
		}
		setBusy( false );
	};

	return (
		<div className={ `sd-b-email sd-b-email--${ kind }` }>
			<RadioControl
				label={ __( 'Email template', 'smart-diagnostic' ) }
				selected={ custom ? 'custom' : 'default' }
				options={ [
					{
						value: 'default',
						label: __(
							'Default template (built from the results)',
							'smart-diagnostic'
						),
					},
					{
						value: 'custom',
						label: __( 'Custom template', 'smart-diagnostic' ),
					},
				] }
				onChange={ ( mode ) => {
					if ( mode === 'default' ) {
						// Une seule mise à jour : deux appels successifs se marcheraient dessus.
						const next = { ...settings };
						delete next.body;
						delete next.fullHtml;
						set( path, next );
					} else {
						set( [ ...path, 'body' ], STARTERS[ kind ]() );
					}
					setPreview( null );
				} }
			/>
			{ custom && (
				<>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __(
							'Complete HTML document (without the plugin frame)',
							'smart-diagnostic'
						) }
						help={ __(
							'For an entirely custom layout: <html>, <head>, <style>… are then allowed.',
							'smart-diagnostic'
						) }
						checked={ Boolean( settings.fullHtml ) }
						onChange={ ( on ) =>
							set( [ ...path, 'fullHtml' ], on || undefined )
						}
					/>
					{ multilingual && (
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Language', 'smart-diagnostic' ) }
							value={ lang }
							options={ langs.map( ( code ) => ( {
								value: code,
								label: code.toUpperCase(),
							} ) ) }
							onChange={ setLang }
						/>
					) }
					<div className="sd-b-email__editor">
						<label
							className="sd-b-email__label"
							htmlFor={ `sd-email-body-${ kind }` }
						>
							{ __( 'Email body (HTML)', 'smart-diagnostic' ) }
						</label>
						<textarea
							id={ `sd-email-body-${ kind }` }
							ref={ textarea }
							className="sd-b-email__textarea"
							rows={ 14 }
							spellCheck={ false }
							value={ valueFor( lang ) }
							onChange={ ( event ) =>
								setBody( event.target.value )
							}
						/>
						<div
							className="sd-b-email__tokens"
							aria-label={ __(
								'Insert a variable',
								'smart-diagnostic'
							) }
						>
							{ Object.entries(
								window.sdAdmin?.emailPlaceholders ?? {}
							).map( ( [ token, label ] ) => (
								<Button
									key={ token }
									size="small"
									variant="secondary"
									title={ label }
									onClick={ () => insert( token ) }
								>
									{ token }
								</Button>
							) ) }
						</div>
						<p className="description">
							{ __(
								'Click a variable to insert it at the cursor. In {score:key}, {answer:key}… replace "key" by the key of the axis or of the question.',
								'smart-diagnostic'
							) }
						</p>
					</div>
				</>
			) }
			<div className="sd-b-row sd-b-email__actions">
				<Button
					variant="secondary"
					isBusy={ busy }
					disabled={ busy }
					onClick={ () => request( false ) }
				>
					{ __( 'Preview', 'smart-diagnostic' ) }
				</Button>
				<Button
					variant="tertiary"
					isBusy={ busy }
					disabled={ busy }
					onClick={ () => request( true ) }
				>
					{ __( 'Send me this email', 'smart-diagnostic' ) }
				</Button>
			</div>
			{ status && (
				<Notice status={ status.type } isDismissible={ false }>
					{ status.text }
				</Notice>
			) }
			{ preview && (
				<div className="sd-b-email__preview">
					<p>
						<strong>
							{ __( 'Subject:', 'smart-diagnostic' ) }
						</strong>{ ' ' }
						<span className="sd-b-email__subject">
							{ preview.subject }
						</span>
					</p>
					<iframe
						title={ __( 'Email preview', 'smart-diagnostic' ) }
						className="sd-b-email__frame"
						sandbox=""
						srcDoc={ preview.html }
					/>
					<p className="description">
						{ __(
							'Example data: first profile, mid-scale scores, all texts and actions.',
							'smart-diagnostic'
						) }
					</p>
				</div>
			) }
		</div>
	);
}
