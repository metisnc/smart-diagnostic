<?php
/**
 * Réglages globaux du plugin (option sd_settings).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic;

/**
 * Lecture typée des réglages, avec valeurs par défaut.
 */
final class Settings {

	public const OPTION = 'sd_settings';

	/**
	 * @return array{captcha_provider: string, captcha_site_key: string, captcha_secret_key: string, rate_limit: int, rate_window: int, retention_days: int, analytics: bool, brand_name: string}
	 */
	public static function all(): array {
		$saved = get_option( self::OPTION, array() );
		$saved = is_array( $saved ) ? $saved : array();
		return array(
			'captcha_provider'   => in_array( $saved['captcha_provider'] ?? '', array( 'turnstile', 'recaptcha' ), true ) ? $saved['captcha_provider'] : 'none',
			'captcha_site_key'   => (string) ( $saved['captcha_site_key'] ?? '' ),
			'captcha_secret_key' => (string) ( $saved['captcha_secret_key'] ?? '' ),
			'rate_limit'         => max( 1, (int) ( $saved['rate_limit'] ?? 10 ) ),
			'rate_window'        => max( 60, (int) ( $saved['rate_window'] ?? 600 ) ),
			'retention_days'     => max( 0, (int) ( $saved['retention_days'] ?? 0 ) ),
			'analytics'          => (bool) ( $saved['analytics'] ?? true ),
			'brand_name'         => (string) ( $saved['brand_name'] ?? '' ),
		);
	}

	public static function get( string $key ): mixed {
		return self::all()[ $key ] ?? null;
	}

	/**
	 * Captcha actif seulement si le fournisseur et les deux clés sont renseignés.
	 */
	public static function captcha_enabled(): bool {
		$settings = self::all();
		return 'none' !== $settings['captcha_provider'] && '' !== $settings['captcha_site_key'] && '' !== $settings['captcha_secret_key'];
	}
}
