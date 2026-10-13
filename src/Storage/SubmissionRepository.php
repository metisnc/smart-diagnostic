<?php
/**
 * Accès à la table des soumissions.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Storage;

/**
 * Les colonnes JSON (réponses, scores…) sont encodées / décodées ici.
 */
final class SubmissionRepository {

	private const JSON_COLUMNS = array( 'contact', 'answers', 'path', 'scores', 'vars', 'result', 'utm' );

	/**
	 * Enregistre une soumission.
	 *
	 * @param array<string, mixed> $data Colonnes (les valeurs JSON en tableaux PHP).
	 * @return array<string, mixed>|null Ligne enregistrée (avec id et token), ou null en cas d'échec.
	 */
	public function insert( array $data ): ?array {
		global $wpdb;
		$now                = current_time( 'mysql', true );
		$data['token']      = bin2hex( random_bytes( 16 ) );
		$data['created_at'] = $now;
		$data['updated_at'] = $now;

		$ok = $wpdb->insert( Schema::submissions_table(), $this->encode( $data ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
		if ( false === $ok ) {
			return null;
		}
		$data['id'] = (int) $wpdb->insert_id;
		return $data;
	}

	/**
	 * @param int                  $id   Soumission.
	 * @param array<string, mixed> $data Colonnes à modifier.
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;
		$data['updated_at'] = current_time( 'mysql', true );
		return false !== $wpdb->update( Schema::submissions_table(), $this->encode( $data ), array( 'id' => $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function find_by_token( string $token ): ?array {
		global $wpdb;
		if ( 1 !== preg_match( '/^[a-f0-9]{32}$/', $token ) ) {
			return null;
		}
		$table = Schema::submissions_table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE token = %s", $token ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		return is_array( $row ) ? $this->decode( $row ) : null;
	}

	/**
	 * @param array<string, mixed> $data Données.
	 * @return array<string, mixed>
	 */
	private function encode( array $data ): array {
		foreach ( self::JSON_COLUMNS as $column ) {
			if ( array_key_exists( $column, $data ) ) {
				$data[ $column ] = (string) wp_json_encode( $data[ $column ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
			}
		}
		return $data;
	}

	/**
	 * @param array<string, mixed> $row Ligne brute.
	 * @return array<string, mixed>
	 */
	private function decode( array $row ): array {
		foreach ( self::JSON_COLUMNS as $column ) {
			if ( isset( $row[ $column ] ) && is_string( $row[ $column ] ) ) {
				$row[ $column ] = json_decode( $row[ $column ], true );
			}
		}
		$row['id']            = (int) $row['id'];
		$row['diagnostic_id'] = (int) $row['diagnostic_id'];
		$row['consent']       = (bool) $row['consent'];
		return $row;
	}
}
