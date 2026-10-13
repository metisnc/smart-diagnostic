<?php
/**
 * Langue courante, compatible WPML et Polylang.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic;

/**
 * Les textes multilingues sont dans la config (objets { langue: texte }) ; cette classe
 * dit simplement quelle langue afficher.
 */
final class I18n {

	/**
	 * Code de langue courant : langue WPML / Polylang si active, sinon locale WordPress.
	 */
	public static function current_language(): string {
		$lang = '';
		if ( function_exists( 'pll_current_language' ) ) {
			$lang = (string) pll_current_language( 'slug' );
		}
		if ( '' === $lang && has_filter( 'wpml_current_language' ) ) {
			$lang = (string) apply_filters( 'wpml_current_language', null ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- hook WPML.
		}
		if ( '' === $lang ) {
			$lang = determine_locale();
		}
		/**
		 * Langue utilisée pour afficher un diagnostic (code « fr » ou locale « fr_FR »).
		 *
		 * @param string $lang Langue.
		 */
		return (string) apply_filters( 'sd_current_language', $lang );
	}
}
