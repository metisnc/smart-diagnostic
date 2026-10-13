<?php
/**
 * Limitation du nombre de soumissions par visiteur (IP hachée).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Security;

use SmartDiagnostic\Settings;

/**
 * Fenêtre fixe stockée en transient : simple, suffisant contre le spam.
 */
final class RateLimiter {

	/**
	 * Enregistre une tentative ; faux si la limite est dépassée.
	 */
	public function hit( string $bucket ): bool {
		/** Nombre de soumissions autorisées par fenêtre. */
		$limit  = (int) apply_filters( 'sd_rate_limit', Settings::get( 'rate_limit' ) );
		$window = (int) Settings::get( 'rate_window' );
		$key    = 'sd_rl_' . md5( $bucket );

		$state = get_transient( $key );
		if ( ! is_array( $state ) || ( $state['start'] ?? 0 ) + $window < time() ) {
			$state = array(
				'start' => time(),
				'count' => 0,
			);
		}
		++$state['count'];
		set_transient( $key, $state, $window );

		return $state['count'] <= $limit;
	}

	/**
	 * Empreinte non réversible de l'adresse IP (aucune IP en clair n'est stockée).
	 */
	public static function ip_hash(): string {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		return hash_hmac( 'sha256', $ip, wp_salt( 'auth' ) );
	}
}
