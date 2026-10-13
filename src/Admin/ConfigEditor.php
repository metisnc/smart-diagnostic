<?php
/**
 * Éditeur JSON de la configuration (phase 1), avec validation et aperçu.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Config\SchemaValidator;
use SmartDiagnostic\Front\Strings;
use SmartDiagnostic\PostType\DiagnosticPostType;

/**
 * Une config invalide n'est jamais enregistrée : la dernière version valide reste
 * en ligne, et le JSON saisi est conservé le temps de corriger les erreurs.
 */
final class ConfigEditor {

	public const SCRIPT_HANDLE = 'smart-diagnostic-admin';

	private const NONCE_ACTION = 'sd_save_config';
	private const NONCE_FIELD  = 'sd_config_nonce';
	private const FIELD        = 'sd_config';
	private const DRAFT_TTL    = 10 * MINUTE_IN_SECONDS;

	public function __construct( private ConfigRepository $configs = new ConfigRepository() ) {}

	public function register(): void {
		add_action( 'add_meta_boxes_' . DiagnosticPostType::NAME, array( $this, 'add_meta_box' ) );
		add_action( 'save_post_' . DiagnosticPostType::NAME, array( $this, 'save' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'admin_notices', array( $this, 'errors_notice' ) );
	}

	public function add_meta_box(): void {
		add_meta_box(
			'sd-config',
			__( 'Configuration (JSON)', 'smart-diagnostic' ),
			array( $this, 'render_meta_box' ),
			DiagnosticPostType::NAME,
			'normal',
			'high'
		);
	}

	public function render_meta_box( \WP_Post $post ): void {
		$draft = get_transient( $this->draft_key( $post->ID ) );
		$json  = is_array( $draft ) && isset( $draft['json'] ) ? (string) $draft['json'] : $this->configs->get_raw( $post->ID );
		if ( '' === $json ) {
			$json = $this->starter_config();
		}

		wp_nonce_field( self::NONCE_ACTION, self::NONCE_FIELD );
		?>
		<div class="sd-editor">
			<div class="sd-editor__code">
				<textarea id="sd-config-field" name="<?php echo esc_attr( self::FIELD ); ?>" rows="30" class="large-text code" spellcheck="false"><?php echo esc_textarea( $json ); ?></textarea>
				<div id="sd-config-status" class="sd-editor__status" aria-live="polite"></div>
			</div>
			<div class="sd-editor__preview">
				<h3><?php esc_html_e( 'Live preview', 'smart-diagnostic' ); ?></h3>
				<div id="sd-config-preview" class="sd-editor__preview-frame"></div>
			</div>
		</div>
		<p class="description">
			<?php
			printf(
				/* translators: %s: shortcode. */
				esc_html__( 'Insert this diagnostic with the "Diagnostic" block or the shortcode %s.', 'smart-diagnostic' ),
				'<code>[smart_diagnostic id="' . (int) $post->ID . '"]</code>'
			);
			?>
		</p>
		<?php
	}

	public function save( int $post_id ): void {
		if ( ! isset( $_POST[ self::NONCE_FIELD ], $_POST[ self::FIELD ] ) ) {
			return;
		}
		if ( ! wp_verify_nonce( sanitize_key( wp_unslash( $_POST[ self::NONCE_FIELD ] ) ), self::NONCE_ACTION ) ) {
			return;
		}
		if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || wp_is_post_revision( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		// JSON brut : validé par le schéma, les textes HTML sont filtrés au rendu.
		$json   = wp_unslash( $_POST[ self::FIELD ] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$json   = is_string( $json ) ? $json : '';
		$errors = $this->configs->save( $post_id, $json );

		if ( $errors ) {
			set_transient(
				$this->draft_key( $post_id ),
				array(
					'json'   => $json,
					'errors' => $errors,
				),
				self::DRAFT_TTL
			);
		} else {
			delete_transient( $this->draft_key( $post_id ) );
		}
	}

	public function errors_notice(): void {
		$screen = get_current_screen();
		if ( ! $screen || DiagnosticPostType::NAME !== $screen->post_type || 'post' !== $screen->base ) {
			return;
		}
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$draft   = $post_id ? get_transient( $this->draft_key( $post_id ) ) : false;
		if ( ! is_array( $draft ) || empty( $draft['errors'] ) ) {
			return;
		}
		echo '<div class="notice notice-error"><p><strong>'
			. esc_html__( 'The configuration was not saved: it contains errors. The previous valid version remains online.', 'smart-diagnostic' )
			. '</strong></p><ul>';
		foreach ( array_slice( (array) $draft['errors'], 0, 20 ) as $error ) {
			echo '<li><code>' . esc_html( (string) $error ) . '</code></li>';
		}
		echo '</ul></div>';
	}

	public function enqueue( string $hook ): void {
		$screen = get_current_screen();
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) || ! $screen || DiagnosticPostType::NAME !== $screen->post_type ) {
			return;
		}
		$asset_file = SMART_DIAGNOSTIC_DIR . 'build/admin.asset.php';
		if ( ! is_readable( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;

		$code_editor = wp_enqueue_code_editor( array( 'type' => 'application/json' ) );

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			SMART_DIAGNOSTIC_URL . 'build/admin.js',
			array_merge( $asset['dependencies'], array( 'code-editor' ) ),
			$asset['version'],
			true
		);
		// admin.css inclut aussi les styles du front, pour l'aperçu.
		wp_enqueue_style( self::SCRIPT_HANDLE, SMART_DIAGNOSTIC_URL . 'build/admin.css', array( 'code-editor' ), $asset['version'] );

		$schema = file_get_contents( SchemaValidator::schema_path() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			'window.sdAdmin = ' . wp_json_encode(
				array(
					'schema'     => json_decode( (string) $schema ),
					'strings'    => Strings::defaults(),
					'locale'     => determine_locale(),
					'codeEditor' => $code_editor,
					'i18n'       => array(
						'valid'       => __( 'Valid configuration.', 'smart-diagnostic' ),
						'invalid'     => __( 'Errors:', 'smart-diagnostic' ),
						'invalidJson' => __( 'Invalid JSON:', 'smart-diagnostic' ),
					),
				)
			) . ';',
			'before'
		);
	}

	private function draft_key( int $post_id ): string {
		return 'sd_config_draft_' . $post_id . '_' . get_current_user_id();
	}

	private function starter_config(): string {
		return (string) wp_json_encode(
			array(
				'schemaVersion' => 1,
				'sections'      => array(
					array(
						'key'   => 'main',
						'label' => __( 'Section 1', 'smart-diagnostic' ),
					),
				),
				'steps'         => array(
					array(
						'key'     => 'q1',
						'kind'    => 'question',
						'section' => 'main',
						'type'    => 'single',
						'label'   => __( 'First question', 'smart-diagnostic' ),
						'options' => array(
							array(
								'value' => 'a',
								'label' => __( 'Answer A', 'smart-diagnostic' ),
							),
							array(
								'value' => 'b',
								'label' => __( 'Answer B', 'smart-diagnostic' ),
							),
						),
					),
				),
			),
			JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
		);
	}
}
