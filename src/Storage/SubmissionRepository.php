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

	private const JSON_COLUMNS = array( 'contact', 'answers', 'path', 'scores', 'vars', 'result', 'utm', 'webhooks', 'emails' );

	/** Colonnes filtrables / triables dans l'admin. */
	private const ORDERABLE = array( 'id', 'created_at', 'email', 'first_name', 'profile', 'cta' );

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
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;
		$table = Schema::submissions_table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		return is_array( $row ) ? $this->decode( $row ) : null;
	}

	/**
	 * Recherche filtrée et paginée.
	 *
	 * @param array{diagnostic_id?: int, profile?: string, cta?: string, from?: string, to?: string, search?: string, email?: string} $filters Filtres (dates AAAA-MM-JJ, GMT).
	 * @param array{orderby?: string, order?: string, per_page?: int, page?: int}                                                     $args    Tri et pagination (per_page 0 = tout).
	 * @return array{items: list<array<string, mixed>>, total: int}
	 */
	public function query( array $filters = array(), array $args = array() ): array {
		global $wpdb;
		$table              = Schema::submissions_table();
		[ $where, $params ] = $this->where( $filters );

		$orderby  = in_array( $args['orderby'] ?? '', self::ORDERABLE, true ) ? $args['orderby'] : 'created_at';
		$order    = 'ASC' === strtoupper( $args['order'] ?? '' ) ? 'ASC' : 'DESC';
		$per_page = max( 0, (int) ( $args['per_page'] ?? 20 ) );
		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$limit    = $per_page > 0 ? $wpdb->prepare( ' LIMIT %d OFFSET %d', $per_page, ( $page - 1 ) * $per_page ) : '';

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
		$count_sql = "SELECT COUNT(*) FROM {$table} {$where}";
		$total     = (int) $wpdb->get_var( $params ? $wpdb->prepare( $count_sql, $params ) : $count_sql );
		$rows_sql  = "SELECT * FROM {$table} {$where} ORDER BY {$orderby} {$order}, id {$order}";
		$rows      = $wpdb->get_results( ( $params ? $wpdb->prepare( $rows_sql, $params ) : $rows_sql ) . $limit, ARRAY_A );
		// phpcs:enable

		return array(
			'items' => array_map( array( $this, 'decode' ), is_array( $rows ) ? $rows : array() ),
			'total' => $total,
		);
	}

	/**
	 * Valeurs distinctes d'une colonne (pour les filtres de l'admin).
	 *
	 * @return list<string>
	 */
	public function distinct( string $column, int $diagnostic_id = 0 ): array {
		global $wpdb;
		if ( ! in_array( $column, array( 'profile', 'cta' ), true ) ) {
			return array();
		}
		$table = Schema::submissions_table();
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		$values = $diagnostic_id > 0
			? $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT {$column} FROM {$table} WHERE diagnostic_id = %d AND {$column} <> '' ORDER BY {$column}", $diagnostic_id ) )
			: $wpdb->get_col( "SELECT DISTINCT {$column} FROM {$table} WHERE {$column} <> '' ORDER BY {$column}" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		// phpcs:enable
		return array_values( array_map( 'strval', $values ) );
	}

	/**
	 * @param list<int> $ids Soumissions.
	 * @return int Nombre supprimé.
	 */
	public function delete( array $ids ): int {
		global $wpdb;
		$ids = array_values( array_filter( array_map( 'intval', $ids ) ) );
		if ( array() === $ids ) {
			return 0;
		}
		$table        = Schema::submissions_table();
		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		return (int) $wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE id IN ({$placeholders})", $ids ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery
	}

	/**
	 * Supprime les soumissions plus anciennes que la date donnée (GMT).
	 *
	 * @return int Nombre supprimé.
	 */
	public function delete_before( string $datetime_gmt ): int {
		global $wpdb;
		$table = Schema::submissions_table();
		return (int) $wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", $datetime_gmt ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
	}

	/**
	 * @param array<string, mixed> $filters Filtres.
	 * @return array{0: string, 1: list<mixed>}
	 */
	private function where( array $filters ): array {
		global $wpdb;
		$clauses = array();
		$params  = array();
		if ( ! empty( $filters['diagnostic_id'] ) ) {
			$clauses[] = 'diagnostic_id = %d';
			$params[]  = (int) $filters['diagnostic_id'];
		}
		foreach ( array( 'profile', 'cta', 'email' ) as $column ) {
			if ( isset( $filters[ $column ] ) && '' !== $filters[ $column ] ) {
				$clauses[] = "{$column} = %s";
				$params[]  = (string) $filters[ $column ];
			}
		}
		if ( ! empty( $filters['from'] ) ) {
			$clauses[] = 'created_at >= %s';
			$params[]  = $filters['from'] . ' 00:00:00';
		}
		if ( ! empty( $filters['to'] ) ) {
			$clauses[] = 'created_at <= %s';
			$params[]  = $filters['to'] . ' 23:59:59';
		}
		if ( ! empty( $filters['search'] ) ) {
			$like      = '%' . $wpdb->esc_like( (string) $filters['search'] ) . '%';
			$clauses[] = '(email LIKE %s OR first_name LIKE %s)';
			$params[]  = $like;
			$params[]  = $like;
		}
		return array( $clauses ? 'WHERE ' . implode( ' AND ', $clauses ) : '', $params );
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
