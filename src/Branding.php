<?php
/**
 * Marque blanche : nom affiché du plugin dans l'admin.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic;

/**
 * Le nom visible se règle par la constante SD_BRAND_NAME (wp-config.php)
 * ou par le filtre `sd_brand_name`. Aucune mention n'est faite côté visiteur.
 */
final class Branding {

	public function register(): void {
		add_filter( 'all_plugins', array( $this, 'rename_in_plugin_list' ) );
	}

	public static function name(): string {
		$name = defined( 'SD_BRAND_NAME' ) && is_string( SD_BRAND_NAME ) && '' !== SD_BRAND_NAME
			? SD_BRAND_NAME
			: __( 'Smart Diagnostic', 'smart-diagnostic' );

		/**
		 * Nom du plugin affiché dans l'admin (menus, liste des extensions).
		 *
		 * @param string $name Nom par défaut.
		 */
		return (string) apply_filters( 'sd_brand_name', $name );
	}

	/**
	 * Remplace le nom du plugin dans la liste des extensions.
	 *
	 * @param array<string, array<string, string>> $plugins Extensions installées.
	 * @return array<string, array<string, string>>
	 */
	public function rename_in_plugin_list( array $plugins ): array {
		$basename = plugin_basename( SMART_DIAGNOSTIC_FILE );
		if ( isset( $plugins[ $basename ] ) ) {
			$plugins[ $basename ]['Name']  = self::name();
			$plugins[ $basename ]['Title'] = self::name();
		}
		return $plugins;
	}
}
