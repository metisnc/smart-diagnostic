<?php
/**
 * Marque blanche : nom affiché du plugin dans l'admin.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic;

/**
 * Nom visible, par ordre de priorité : constante SD_BRAND_NAME (wp-config.php),
 * réglage « Nom affiché », filtre `sd_brand_name`. Rien n'est mentionné côté visiteur.
 */
final class Branding {

	public function register(): void {
		add_filter( 'all_plugins', array( $this, 'rename_in_plugin_list' ) );
	}

	/**
	 * Nom personnalisé (constante ou réglage), ou chaîne vide.
	 */
	private static function custom_name(): string {
		if ( defined( 'SD_BRAND_NAME' ) && is_string( SD_BRAND_NAME ) && '' !== SD_BRAND_NAME ) {
			return SD_BRAND_NAME;
		}
		return trim( (string) Settings::get( 'brand_name' ) );
	}

	public static function name(): string {
		$name = self::custom_name();
		if ( '' === $name ) {
			$name = __( 'Smart Diagnostic', 'smart-diagnostic' );
		}

		/**
		 * Nom du plugin affiché dans l'admin (menus, liste des extensions).
		 *
		 * @param string $name Nom par défaut.
		 */
		return (string) apply_filters( 'sd_brand_name', $name );
	}

	/**
	 * Remplace le nom du plugin dans la liste des extensions ; avec une marque
	 * personnalisée, l'auteur et les liens d'origine sont masqués.
	 *
	 * @param array<string, array<string, string>> $plugins Extensions installées.
	 * @return array<string, array<string, string>>
	 */
	public function rename_in_plugin_list( array $plugins ): array {
		$basename = plugin_basename( SMART_DIAGNOSTIC_FILE );
		if ( ! isset( $plugins[ $basename ] ) ) {
			return $plugins;
		}
		$plugins[ $basename ]['Name']  = self::name();
		$plugins[ $basename ]['Title'] = self::name();
		if ( '' !== self::custom_name() ) {
			foreach ( array( 'Author', 'AuthorName', 'AuthorURI', 'PluginURI' ) as $field ) {
				$plugins[ $basename ][ $field ] = '';
			}
		}
		return $plugins;
	}
}
