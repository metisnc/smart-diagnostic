<?php
/**
 * Événements anonymes du parcours (démarrage, étape vue, réponse, capture, soumission, abandon).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Storage;

/**
 * Aucune donnée personnelle : un identifiant de session aléatoire, un nom d'événement,
 * une clé d'étape et une date.
 */
final class EventRepository {

	public const EVENTS = array( 'start', 'step_view', 'answer', 'capture', 'submit', 'abandon' );

	/**
	 * @param int                                       $diagnostic_id Diagnostic.
	 * @param string                                    $session       Session.
	 * @param list<array{event: string, step?: string}> $events        Événements.
	 */
	public function insert_many( int $diagnostic_id, string $session, array $events ): int {
		global $wpdb;
		if ( array() === $events ) {
			return 0;
		}
		$now          = current_time( 'mysql', true );
		$placeholders = array();
		$values       = array();
		foreach ( $events as $event ) {
			$placeholders[] = '(%d, %s, %s, %s, %s)';
			array_push( $values, $diagnostic_id, $session, $event['event'], $event['step'] ?? '', $now );
		}
		$table = Schema::events_table();
		$sql   = "INSERT INTO {$table} (diagnostic_id, session, event, step, created_at) VALUES " . implode( ', ', $placeholders );
		return (int) $wpdb->query( $wpdb->prepare( $sql, $values ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery
	}

	/**
	 * Événements d'un diagnostic sur une période, regroupés par session.
	 *
	 * @param int    $diagnostic_id Diagnostic.
	 * @param string $from          AAAA-MM-JJ (inclus).
	 * @param string $to            AAAA-MM-JJ (inclus).
	 * @return array<string, list<array{event: string, step: string}>> Par session, dans l'ordre.
	 */
	public function sessions( int $diagnostic_id, string $from, string $to ): array {
		global $wpdb;
		$table    = Schema::events_table();
		$rows     = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT session, event, step FROM {$table} WHERE diagnostic_id = %d AND created_at BETWEEN %s AND %s ORDER BY id", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$diagnostic_id,
				$from . ' 00:00:00',
				$to . ' 23:59:59'
			),
			ARRAY_A
		);
		$sessions = array();
		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			$sessions[ (string) $row['session'] ][] = array(
				'event' => (string) $row['event'],
				'step'  => (string) $row['step'],
			);
		}
		return $sessions;
	}

	public function delete_before( string $datetime_gmt ): int {
		global $wpdb;
		$table = Schema::events_table();
		return (int) $wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", $datetime_gmt ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
	}
}
