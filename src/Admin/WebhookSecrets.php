<?php
/**
 * Boîte « Secrets des webhooks » sur l'écran d'édition d'un diagnostic.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Integrations\Webhooks;
use SmartDiagnostic\PostType\DiagnosticPostType;

/**
 * Les secrets HMAC sont saisis ici, jamais dans la config JSON (exportable).
 * Champ laissé vide = secret inchangé.
 */
final class WebhookSecrets {

	private const NONCE_ACTION = 'sd_webhook_secrets';
	private const NONCE_FIELD  = 'sd_webhook_secrets_nonce';
	private const FIELD        = 'sd_webhook_secret';

	public function __construct( private ConfigRepository $configs = new ConfigRepository() ) {}

	public function register(): void {
		add_action( 'add_meta_boxes_' . DiagnosticPostType::NAME, array( $this, 'add_meta_box' ) );
		add_action( 'save_post_' . DiagnosticPostType::NAME, array( $this, 'save' ) );
	}

	public function add_meta_box(): void {
		add_meta_box( 'sd-webhook-secrets', __( 'Webhook secrets', 'smart-diagnostic' ), array( $this, 'render' ), DiagnosticPostType::NAME, 'side' );
	}

	public function render( \WP_Post $post ): void {
		$config   = $this->configs->get_array( $post->ID );
		$webhooks = $config['integrations']['webhooks'] ?? array();
		if ( array() === $webhooks ) {
			echo '<p class="description">' . esc_html__( 'No webhook in the configuration (integrations.webhooks).', 'smart-diagnostic' ) . '</p>';
			return;
		}
		wp_nonce_field( self::NONCE_ACTION, self::NONCE_FIELD );
		echo '<p class="description">' . esc_html__( 'Used to sign requests (X-SD-Signature: sha256=HMAC of the body). Leave empty to keep the current secret.', 'smart-diagnostic' ) . '</p>';
		foreach ( $webhooks as $webhook ) {
			$key = (string) $webhook['key'];
			$set = '' !== Webhooks::secret( $post->ID, $key );
			printf(
				'<p><label for="sd-secret-%1$s"><strong>%1$s</strong> %2$s</label><br><input type="password" id="sd-secret-%1$s" name="%3$s[%1$s]" class="widefat" autocomplete="new-password" placeholder="%4$s" /></p>',
				esc_attr( $key ),
				$set ? '<span class="dashicons dashicons-lock" title="' . esc_attr__( 'Secret set', 'smart-diagnostic' ) . '"></span>' : '',
				esc_attr( self::FIELD ),
				$set ? esc_attr__( '•••••••• (unchanged)', 'smart-diagnostic' ) : ''
			);
		}
	}

	public function save( int $post_id ): void {
		if ( ! isset( $_POST[ self::NONCE_FIELD ], $_POST[ self::FIELD ] ) ) {
			return;
		}
		if ( ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST[ self::NONCE_FIELD ] ) ), self::NONCE_ACTION ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		$posted  = wp_unslash( (array) $_POST[ self::FIELD ] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- nettoyé ci-dessous.
		$secrets = get_post_meta( $post_id, Webhooks::SECRETS_META, true );
		$secrets = is_array( $secrets ) ? $secrets : array();
		foreach ( $posted as $key => $value ) {
			$value = trim( (string) $value );
			if ( '' !== $value ) {
				$secrets[ sanitize_key( (string) $key ) ] = sanitize_text_field( $value );
			}
		}
		update_post_meta( $post_id, Webhooks::SECRETS_META, $secrets );
	}
}
