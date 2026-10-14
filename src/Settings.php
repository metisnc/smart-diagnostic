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
	 * @return array{captcha_provider: string, captcha_site_key: string, captcha_secret_key: string, rate_limit: int, rate_window: int, retention_days: int, analytics: bool, brand_name: string, mail_from_name: string, mail_from_email: string, mail_reply_to: string, smtp_enabled: bool, smtp_host: string, smtp_port: int, smtp_encryption: string, smtp_user: string, smtp_password: string}
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
			'mail_from_name'     => (string) ( $saved['mail_from_name'] ?? '' ),
			'mail_from_email'    => (string) ( $saved['mail_from_email'] ?? '' ),
			'mail_reply_to'      => (string) ( $saved['mail_reply_to'] ?? '' ),
			'smtp_enabled'       => (bool) ( $saved['smtp_enabled'] ?? false ),
			'smtp_host'          => (string) ( $saved['smtp_host'] ?? '' ),
			'smtp_port'          => (int) ( $saved['smtp_port'] ?? 587 ),
			'smtp_encryption'    => in_array( $saved['smtp_encryption'] ?? '', array( 'tls', 'ssl', 'none' ), true ) ? $saved['smtp_encryption'] : 'tls',
			'smtp_user'          => (string) ( $saved['smtp_user'] ?? '' ),
			// Prioritaire : constante SD_SMTP_PASSWORD dans wp-config.php (le mot de passe ne va pas en base).
			'smtp_password'      => defined( 'SD_SMTP_PASSWORD' ) ? (string) SD_SMTP_PASSWORD : (string) ( $saved['smtp_password'] ?? '' ),
		);
	}

	public static function get( string $key ): mixed {
		return self::all()[ $key ] ?? null;
	}

	/**
	 * SMTP dédié actif (réglage coché et serveur renseigné).
	 */
	public static function smtp_enabled(): bool {
		$settings = self::all();
		return $settings['smtp_enabled'] && self::valid_smtp_host( $settings['smtp_host'] );
	}

	/**
	 * Adresse de serveur plausible (nom de domaine ou IP), et non une adresse email.
	 */
	public static function valid_smtp_host( string $host ): bool {
		return 1 === preg_match( '/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i', $host );
	}

	/**
	 * Captcha actif seulement si le fournisseur et les deux clés sont renseignés.
	 */
	public static function captcha_enabled(): bool {
		$settings = self::all();
		return 'none' !== $settings['captcha_provider'] && '' !== $settings['captcha_site_key'] && '' !== $settings['captcha_secret_key'];
	}
}
