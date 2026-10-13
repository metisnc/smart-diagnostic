<?php
/**
 * Vérification Turnstile / reCAPTCHA v3 (optionnelle, réglages du plugin).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Security;

use SmartDiagnostic\Settings;

/**
 * Vérifie le jeton auprès du fournisseur.
 */
final class Captcha {

	private const ENDPOINTS = array(
		'turnstile' => 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
		'recaptcha' => 'https://www.google.com/recaptcha/api/siteverify',
	);

	/** Score minimal reCAPTCHA v3. */
	private const RECAPTCHA_MIN_SCORE = 0.5;

	public function verify( string $token ): bool {
		if ( ! Settings::captcha_enabled() ) {
			return true;
		}
		if ( '' === $token ) {
			return false;
		}
		$provider = (string) Settings::get( 'captcha_provider' );
		$response = wp_remote_post(
			self::ENDPOINTS[ $provider ],
			array(
				'timeout' => 8,
				'body'    => array(
					'secret'   => Settings::get( 'captcha_secret_key' ),
					'response' => $token,
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			// Fournisseur injoignable : on ne bloque pas les visiteurs (le rate limiting reste actif).
			return true;
		}
		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) || empty( $body['success'] ) ) {
			return false;
		}
		if ( 'recaptcha' === $provider && isset( $body['score'] ) ) {
			return (float) $body['score'] >= self::RECAPTCHA_MIN_SCORE;
		}
		return true;
	}
}
