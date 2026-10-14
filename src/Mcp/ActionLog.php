<?php
/**
 * Journal des actions effectuées via le connecteur MCP.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Mcp;

/**
 * Les 200 dernières actions (option non chargée automatiquement) : date, utilisateur,
 * action, paramètres résumés (jamais de configuration complète), résultat.
 */
final class ActionLog {

	public const OPTION = 'sd_mcp_log';
	private const MAX   = 200;

	/**
	 * @param string               $ability Action (nom de l'ability).
	 * @param array<string, mixed> $input   Paramètres reçus.
	 * @param bool                 $ok      Succès.
	 * @param string               $message Résultat ou erreur, en clair.
	 */
	public static function record( string $ability, array $input, bool $ok, string $message = '' ): void {
		$log   = self::all();
		$log[] = array(
			'at'      => gmdate( 'Y-m-d H:i:s' ),
			'user'    => (int) get_current_user_id(),
			'ability' => $ability,
			'input'   => self::summary( $input ),
			'ok'      => $ok,
			'message' => mb_substr( $message, 0, 300 ),
		);
		update_option( self::OPTION, array_slice( $log, -self::MAX ), false );
	}

	/**
	 * @return list<array{at: string, user: int, ability: string, input: string, ok: bool, message: string}>
	 */
	public static function all(): array {
		$log = get_option( self::OPTION, array() );
		return is_array( $log ) ? array_values( $log ) : array();
	}

	/**
	 * Paramètres résumés : valeurs simples gardées, contenus volumineux réduits à leur taille.
	 *
	 * @param array<string, mixed> $input Paramètres.
	 */
	public static function summary( array $input ): string {
		$parts = array();
		foreach ( $input as $key => $value ) {
			if ( is_scalar( $value ) && mb_strlen( (string) $value ) <= 80 ) {
				$parts[] = $key . '=' . ( is_bool( $value ) ? ( $value ? 'true' : 'false' ) : (string) $value );
			} else {
				$parts[] = $key . '=[' . strlen( (string) wp_json_encode( $value ) ) . ' bytes]';
			}
		}
		return implode( ', ', $parts );
	}
}
