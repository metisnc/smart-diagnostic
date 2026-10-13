<?php
/**
 * Rendu HTML d'un diagnostic (commun au shortcode et au bloc).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Front;

use SmartDiagnostic\Config\ConfigRepository;

/**
 * Produit un conteneur que l'app front monte, avec la config embarquée en JSON.
 * Les assets ne sont chargés que lorsqu'un diagnostic est effectivement rendu.
 */
final class Renderer {

	public const SCRIPT_HANDLE = 'smart-diagnostic-front';

	public function __construct( private ConfigRepository $configs = new ConfigRepository() ) {}

	public function register(): void {
		add_action( 'init', array( $this, 'register_assets' ) );
	}

	public function register_assets(): void {
		$asset_file = SMART_DIAGNOSTIC_DIR . 'build/front.asset.php';
		if ( ! is_readable( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;

		wp_register_script(
			self::SCRIPT_HANDLE,
			SMART_DIAGNOSTIC_URL . 'build/front.js',
			$asset['dependencies'],
			$asset['version'],
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		wp_register_style(
			self::SCRIPT_HANDLE,
			SMART_DIAGNOSTIC_URL . 'build/front.css',
			array(),
			$asset['version']
		);
	}

	/**
	 * HTML d'un diagnostic, ou chaîne vide s'il est introuvable / non publié.
	 *
	 * @param string $id_or_slug ID ou slug du diagnostic.
	 */
	public function render( string $id_or_slug ): string {
		$post_id = $this->configs->find_id( $id_or_slug );
		if ( null === $post_id || ( 'publish' !== get_post_status( $post_id ) && ! current_user_can( 'edit_post', $post_id ) ) ) {
			return $this->not_found();
		}

		$config = $this->configs->get( $post_id );
		if ( null === $config ) {
			return $this->not_found();
		}

		wp_enqueue_script( self::SCRIPT_HANDLE );
		wp_enqueue_style( self::SCRIPT_HANDLE );

		$payload = array(
			'id'      => $post_id,
			'locale'  => determine_locale(),
			'strings' => Strings::defaults(),
			'config'  => $config,
		);

		/**
		 * Données transmises à l'app front.
		 *
		 * @param array<string, mixed> $payload Données.
		 * @param int                  $post_id ID du diagnostic.
		 */
		$payload = apply_filters( 'sd_front_payload', $payload, $post_id );

		return sprintf(
			'<div class="sd-root" data-sd-diagnostic="%1$d"><script type="application/json" class="sd-payload">%2$s</script><noscript>%3$s</noscript></div>',
			(int) $post_id,
			// JSON_HEX_TAG empêche toute sortie du bloc <script> via "</script>".
			wp_json_encode( $payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ),
			esc_html__( 'Please enable JavaScript to take this questionnaire.', 'smart-diagnostic' )
		);
	}

	private function not_found(): string {
		if ( current_user_can( 'edit_posts' ) ) {
			return '<p class="sd-notice">' . esc_html__( 'Diagnostic not found or not published.', 'smart-diagnostic' ) . '</p>';
		}
		return '';
	}
}
