<?php
/**
 * Aperçu et envoi d'essai des emails depuis le constructeur (admin uniquement).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Rest;

use SmartDiagnostic\Integrations\EmailBlocks;
use SmartDiagnostic\Integrations\Mailer;
use SmartDiagnostic\Integrations\MailTransport;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Travaille sur la config en cours d'édition (pas forcément enregistrée), avec une
 * soumission fictive : rien n'est enregistré.
 */
final class EmailPreviewController {

	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes(): void {
		register_rest_route(
			SubmitController::rest_namespace(),
			'/email-preview',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'preview' ),
				'permission_callback' => static fn(): bool => current_user_can( 'edit_posts' ),
				'args'                => array(
					'config'        => array(
						'type'     => 'object',
						'required' => true,
					),
					'kind'          => array(
						'type'    => 'string',
						'enum'    => array( 'user', 'admin', 'followUp' ),
						'default' => 'user',
					),
					'diagnostic_id' => array(
						'type'    => 'integer',
						'default' => 0,
					),
					'lang'          => array(
						'type'    => 'string',
						'default' => '',
					),
					'send'          => array(
						'type'    => 'boolean',
						'default' => false,
					),
				),
			)
		);
	}

	public function preview( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$config = $request['config'];
		if ( ! is_array( $config ) ) {
			return new WP_Error( 'sd_invalid', __( 'Invalid configuration.', 'smart-diagnostic' ), array( 'status' => 400 ) );
		}
		$diagnostic_id = (int) $request['diagnostic_id'];
		if ( $diagnostic_id > 0 && ! current_user_can( 'edit_post', $diagnostic_id ) ) {
			$diagnostic_id = 0;
		}

		$mailer  = new Mailer();
		$email   = $mailer->compose( (string) $request['kind'], Mailer::sample_submission( $config, $diagnostic_id ), $config );
		$payload = array(
			'subject' => $email['subject'],
			'html'    => $email['body'],
			'custom'  => $email['custom'],
		);

		// Passage de l'éditeur visuel au mode HTML : HTML des blocs, variables non remplacées.
		$settings = (array) ( $config['integrations']['emails'][ (string) $request['kind'] ] ?? array() );
		if ( ! empty( $settings['blocks'] ) && is_array( $settings['blocks'] ) ) {
			$lang              = (string) ( $request['lang'] ?? '' );
			$fallback          = (string) ( $config['i18n']['defaultLanguage'] ?? '' );
			$styled            = EmailBlocks::with_style( $config, (array) ( $settings['style'] ?? array() ) );
			$payload['source'] = EmailBlocks::html( array_values( $settings['blocks'] ), '' !== $lang ? $lang : $fallback, $fallback, Mailer::email_theme( $styled ) );
		}

		if ( $request['send'] ) {
			$to = wp_get_current_user()->user_email;
			/* translators: %s: email subject. */
			$result           = ( new MailTransport() )->send( $to, sprintf( __( '[Preview] %s', 'smart-diagnostic' ), $email['subject'] ), $email['body'] );
			$payload['sent']  = $result['ok'];
			$payload['to']    = $to;
			$payload['error'] = $result['error'];
		}
		return new WP_REST_Response( $payload, 200 );
	}
}
