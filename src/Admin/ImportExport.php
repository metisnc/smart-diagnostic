<?php
/**
 * Import / export JSON et duplication des diagnostics.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Config\SchemaValidator;
use SmartDiagnostic\PostType\DiagnosticPostType;

/**
 * L'export contient la config seule : jamais les secrets (webhooks), ni les réponses.
 */
final class ImportExport {

	public const PAGE              = 'sd-import';
	private const EXPORT_ACTION    = 'sd_export_diagnostic';
	private const DUPLICATE_ACTION = 'sd_duplicate_diagnostic';
	private const IMPORT_ACTION    = 'sd_import_diagnostic';
	private const MAX_BYTES        = 2 * MB_IN_BYTES;

	public function __construct( private ConfigRepository $configs = new ConfigRepository() ) {}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_filter( 'post_row_actions', array( $this, 'row_actions' ), 10, 2 );
		add_action( 'admin_post_' . self::EXPORT_ACTION, array( $this, 'export' ) );
		add_action( 'admin_post_' . self::DUPLICATE_ACTION, array( $this, 'duplicate' ) );
		add_action( 'admin_post_' . self::IMPORT_ACTION, array( $this, 'import' ) );
		add_action( 'post_submitbox_misc_actions', array( $this, 'export_link_in_editor' ) );
	}

	public function add_page(): void {
		add_submenu_page(
			'edit.php?post_type=' . DiagnosticPostType::NAME,
			__( 'Import', 'smart-diagnostic' ),
			__( 'Import', 'smart-diagnostic' ),
			'edit_posts',
			self::PAGE,
			array( $this, 'render_import' )
		);
	}

	public static function export_url( int $post_id ): string {
		return wp_nonce_url( admin_url( 'admin-post.php?action=' . self::EXPORT_ACTION . '&post=' . $post_id ), self::EXPORT_ACTION . '_' . $post_id );
	}

	public static function duplicate_url( int $post_id ): string {
		return wp_nonce_url( admin_url( 'admin-post.php?action=' . self::DUPLICATE_ACTION . '&post=' . $post_id ), self::DUPLICATE_ACTION . '_' . $post_id );
	}

	/**
	 * @param array<string, string> $actions Actions de ligne.
	 * @return array<string, string>
	 */
	public function row_actions( array $actions, \WP_Post $post ): array {
		if ( DiagnosticPostType::NAME !== $post->post_type || ! current_user_can( 'edit_post', $post->ID ) ) {
			return $actions;
		}
		$actions['sd_duplicate'] = sprintf( '<a href="%s">%s</a>', esc_url( self::duplicate_url( $post->ID ) ), esc_html__( 'Duplicate', 'smart-diagnostic' ) );
		$actions['sd_export']    = sprintf( '<a href="%s">%s</a>', esc_url( self::export_url( $post->ID ) ), esc_html__( 'Export JSON', 'smart-diagnostic' ) );
		return $actions;
	}

	public function export_link_in_editor( \WP_Post $post ): void {
		if ( DiagnosticPostType::NAME !== $post->post_type || 'auto-draft' === $post->post_status ) {
			return;
		}
		printf(
			'<div class="misc-pub-section"><a href="%s">%s</a> · <a href="%s">%s</a></div>',
			esc_url( self::export_url( $post->ID ) ),
			esc_html__( 'Export JSON', 'smart-diagnostic' ),
			esc_url( self::duplicate_url( $post->ID ) ),
			esc_html__( 'Duplicate', 'smart-diagnostic' )
		);
	}

	private function requested_post(): int {
		return isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- nonce vérifié par l'appelant.
	}

	public function export(): void {
		$post_id = $this->requested_post();
		check_admin_referer( self::EXPORT_ACTION . '_' . $post_id );
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		$json = $this->configs->get_raw( $post_id );
		if ( '' === $json ) {
			wp_die( esc_html__( 'This diagnostic has no configuration yet.', 'smart-diagnostic' ) );
		}
		$name = sanitize_file_name( ( get_post_field( 'post_name', $post_id ) ?: 'diagnostic-' . $post_id ) . '.json' ); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $name . '"' );
		echo $json; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- fichier JSON téléchargé.
		exit;
	}

	public function duplicate(): void {
		$post_id = $this->requested_post();
		check_admin_referer( self::DUPLICATE_ACTION . '_' . $post_id );
		$source = get_post( $post_id );
		if ( ! $source instanceof \WP_Post || DiagnosticPostType::NAME !== $source->post_type || ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		/* translators: %s: title of the duplicated diagnostic. */
		$new_id = $this->create( sprintf( __( '%s (copy)', 'smart-diagnostic' ), $source->post_title ), $this->configs->get_raw( $post_id ) );
		wp_safe_redirect( is_int( $new_id ) ? get_edit_post_link( $new_id, 'url' ) : admin_url( 'edit.php?post_type=' . DiagnosticPostType::NAME ) );
		exit;
	}

	public function import(): void {
		check_admin_referer( self::IMPORT_ACTION );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		$json = isset( $_POST['sd_json'] ) ? trim( (string) wp_unslash( $_POST['sd_json'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- JSON validé par le schéma.
		// phpcs:disable WordPress.Security.ValidatedSanitizedInput -- fichier téléversé, lu puis validé.
		if ( '' === $json && isset( $_FILES['sd_file']['tmp_name'], $_FILES['sd_file']['size'] ) && is_uploaded_file( $_FILES['sd_file']['tmp_name'] ) && $_FILES['sd_file']['size'] <= self::MAX_BYTES ) {
			$json = (string) file_get_contents( $_FILES['sd_file']['tmp_name'] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		}
		// phpcs:enable
		$title = isset( $_POST['sd_title'] ) ? sanitize_text_field( wp_unslash( $_POST['sd_title'] ) ) : '';

		$errors = ( new SchemaValidator() )->validate_json( $json );
		if ( '' === $json ) {
			$errors = array( __( 'Choose a JSON file or paste a configuration.', 'smart-diagnostic' ) );
		}
		if ( $errors ) {
			set_transient( 'sd_import_errors_' . get_current_user_id(), $errors, 5 * MINUTE_IN_SECONDS );
			wp_safe_redirect( admin_url( 'edit.php?post_type=' . DiagnosticPostType::NAME . '&page=' . self::PAGE . '&error=1' ) );
			exit;
		}

		if ( '' === $title ) {
			$config = json_decode( $json, true );
			$meta   = $config['meta']['title'] ?? '';
			$title  = is_array( $meta ) ? (string) reset( $meta ) : (string) $meta;
		}
		$new_id = $this->create( '' !== $title ? $title : __( 'Imported diagnostic', 'smart-diagnostic' ), $json );
		wp_safe_redirect( is_int( $new_id ) ? get_edit_post_link( $new_id, 'url' ) : admin_url( 'edit.php?post_type=' . DiagnosticPostType::NAME ) );
		exit;
	}

	/**
	 * Crée un diagnostic en brouillon avec sa config.
	 *
	 * @return int|null ID créé.
	 */
	private function create( string $title, string $json ): ?int {
		$post_id = wp_insert_post(
			array(
				'post_type'   => DiagnosticPostType::NAME,
				'post_status' => 'draft',
				'post_title'  => $title,
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return null;
		}
		if ( '' !== $json ) {
			$this->configs->save( (int) $post_id, $json );
		}
		return (int) $post_id;
	}

	public function render_import(): void {
		$errors = get_transient( 'sd_import_errors_' . get_current_user_id() );
		delete_transient( 'sd_import_errors_' . get_current_user_id() );

		echo '<div class="wrap"><h1>' . esc_html__( 'Import a diagnostic', 'smart-diagnostic' ) . '</h1>';
		echo '<p>' . esc_html__( 'The imported diagnostic is created as a draft. Webhook secrets are never part of an export: enter them again after importing.', 'smart-diagnostic' ) . '</p>';
		if ( is_array( $errors ) && $errors ) {
			echo '<div class="notice notice-error"><p><strong>' . esc_html__( 'The configuration is not valid:', 'smart-diagnostic' ) . '</strong></p><ul>';
			foreach ( array_slice( $errors, 0, 20 ) as $error ) {
				echo '<li><code>' . esc_html( (string) $error ) . '</code></li>';
			}
			echo '</ul></div>';
		}
		printf( '<form method="post" enctype="multipart/form-data" action="%s">', esc_url( admin_url( 'admin-post.php' ) ) );
		wp_nonce_field( self::IMPORT_ACTION );
		printf( '<input type="hidden" name="action" value="%s" />', esc_attr( self::IMPORT_ACTION ) );
		echo '<table class="form-table" role="presentation"><tbody>';
		printf( '<tr><th scope="row"><label for="sd-import-title">%s</label></th><td><input type="text" id="sd-import-title" name="sd_title" class="regular-text" /><p class="description">%s</p></td></tr>', esc_html__( 'Title', 'smart-diagnostic' ), esc_html__( 'Optional: by default, the title from the configuration.', 'smart-diagnostic' ) );
		printf( '<tr><th scope="row"><label for="sd-import-file">%s</label></th><td><input type="file" id="sd-import-file" name="sd_file" accept=".json,application/json" /></td></tr>', esc_html__( 'JSON file', 'smart-diagnostic' ) );
		printf( '<tr><th scope="row"><label for="sd-import-json">%s</label></th><td><textarea id="sd-import-json" name="sd_json" rows="10" class="large-text code"></textarea></td></tr>', esc_html__( 'Or paste the JSON', 'smart-diagnostic' ) );
		echo '</tbody></table>';
		submit_button( __( 'Import', 'smart-diagnostic' ) );
		echo '</form></div>';
	}
}
