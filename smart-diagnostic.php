<?php
/**
 * Plugin Name:       Smart Diagnostic
 * Description:       Moteur de questionnaires de diagnostic interactifs, entièrement configurable.
 * Version:           1.4.0
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            metisnc
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       smart-diagnostic
 * Domain Path:       /languages
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

defined( 'ABSPATH' ) || exit;

define( 'SMART_DIAGNOSTIC_VERSION', '1.4.0' );
define( 'SMART_DIAGNOSTIC_FILE', __FILE__ );
define( 'SMART_DIAGNOSTIC_DIR', plugin_dir_path( __FILE__ ) );
define( 'SMART_DIAGNOSTIC_URL', plugin_dir_url( __FILE__ ) );

if ( ! is_readable( SMART_DIAGNOSTIC_DIR . 'vendor/autoload.php' ) || ! is_readable( SMART_DIAGNOSTIC_DIR . 'vendor-prefixed/autoload.php' ) ) {
	add_action(
		'admin_notices',
		static function (): void {
			echo '<div class="notice notice-error"><p>'
				. esc_html__( 'Smart Diagnostic: dependencies are missing. Run "composer install" in the plugin folder.', 'smart-diagnostic' )
				. '</p></div>';
		}
	);
	return;
}

require_once SMART_DIAGNOSTIC_DIR . 'vendor/autoload.php';
require_once SMART_DIAGNOSTIC_DIR . 'vendor-prefixed/autoload.php';

register_activation_hook( __FILE__, array( \SmartDiagnostic\Lifecycle::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( \SmartDiagnostic\Lifecycle::class, 'deactivate' ) );

add_action( 'plugins_loaded', array( \SmartDiagnostic\Plugin::instance(), 'boot' ) );
