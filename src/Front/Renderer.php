<?php
/**
 * Rendu HTML d'un diagnostic (commun au shortcode et au bloc).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Front;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Rest\SubmitController;
use SmartDiagnostic\Settings;
use SmartDiagnostic\Storage\SubmissionRepository;

/**
 * Produit un conteneur que l'app front monte, avec la config embarquée en JSON.
 * Les assets ne sont chargés que lorsqu'un diagnostic est effectivement rendu.
 */
final class Renderer {

	public const SCRIPT_HANDLE = 'smart-diagnostic-front';

	public function __construct(
		private ConfigRepository $configs = new ConfigRepository(),
		private SubmissionRepository $submissions = new SubmissionRepository()
	) {}

	public function register(): void {
		add_action( 'init', array( $this, 'register_assets' ) );
		add_filter( 'wp_robots', array( $this, 'noindex_results' ) );
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
			'api'     => array(
				'root'  => esc_url_raw( rest_url( SubmitController::NAMESPACE . '/' ) ),
				'nonce' => wp_create_nonce( SubmitController::NONCE_ACTION ),
			),
		);
		if ( Settings::captcha_enabled() ) {
			$payload['captcha'] = array(
				'provider' => Settings::get( 'captcha_provider' ),
				'siteKey'  => Settings::get( 'captcha_site_key' ),
			);
		}
		$submission = $this->requested_submission( $post_id );
		if ( null !== $submission ) {
			$payload['submission'] = $submission;
		}

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

	/**
	 * Résultat enregistré demandé via le lien unique (?sd_result=jeton), pour ce diagnostic.
	 *
	 * @return array<string, mixed>|null
	 */
	private function requested_submission( int $post_id ): ?array {
		$token = isset( $_GET[ SubmitController::RESULT_PARAM ] ) ? sanitize_key( wp_unslash( $_GET[ SubmitController::RESULT_PARAM ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- lien public, le jeton fait office de secret.
		if ( '' === $token ) {
			return null;
		}
		$row = $this->submissions->find_by_token( $token );
		if ( null === $row || $row['diagnostic_id'] !== $post_id ) {
			return null;
		}
		// Seules les données utiles à l'affichage sont exposées (pas d'email ni de téléphone).
		return array(
			'token'     => $row['token'],
			'url'       => SubmitController::result_url( $row ),
			'answers'   => $row['answers'],
			'contact'   => array( 'first_name' => $row['first_name'] ),
			'result'    => $row['result'],
			'createdAt' => $row['created_at'],
		);
	}

	/**
	 * Le lien unique ne doit pas être indexé.
	 *
	 * @param array<string, bool|string> $robots Directives.
	 * @return array<string, bool|string>
	 */
	public function noindex_results( array $robots ): array {
		if ( isset( $_GET[ SubmitController::RESULT_PARAM ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$robots['noindex']  = true;
			$robots['nofollow'] = true;
		}
		return $robots;
	}

	private function not_found(): string {
		if ( current_user_can( 'edit_posts' ) ) {
			return '<p class="sd-notice">' . esc_html__( 'Diagnostic not found or not published.', 'smart-diagnostic' ) . '</p>';
		}
		return '';
	}
}
