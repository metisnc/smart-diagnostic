<?php
/**
 * Point d'entrée du plugin : enregistre les services.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic;

/**
 * Conteneur minimal : instancie et démarre les services une seule fois.
 */
final class Plugin {

	private static ?self $instance = null;

	private bool $booted = false;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function boot(): void {
		if ( $this->booted ) {
			return;
		}
		$this->booted = true;

		load_plugin_textdomain( 'smart-diagnostic', false, dirname( plugin_basename( SMART_DIAGNOSTIC_FILE ) ) . '/languages' );

		/**
		 * Liste des services à démarrer. Chaque service expose une méthode register().
		 *
		 * @param array<class-string> $services Classes de services.
		 */
		$classes = apply_filters(
			'sd_services',
			array(
				Branding::class,
				PostType\DiagnosticPostType::class,
				Front\Renderer::class,
				Front\Shortcode::class,
				Front\Block::class,
				Admin\ConfigEditor::class,
				Admin\SettingsPage::class,
				Rest\SubmitController::class,
			)
		);

		Storage\Schema::maybe_upgrade();
		Cli\Command::register_command();

		foreach ( $classes as $class_name ) {
			$service = new $class_name();
			if ( method_exists( $service, 'register' ) ) {
				$service->register();
			}
		}

		do_action( 'sd_booted', $this );
	}
}
