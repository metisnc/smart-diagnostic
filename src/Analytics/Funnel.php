<?php
/**
 * Calcul de l'entonnoir à partir des événements groupés par session.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Analytics;

/**
 * Fonction pure (testée unitairement) : aucun accès à la base.
 */
final class Funnel {

	/**
	 * @param list<string>                                            $step_keys Étapes du diagnostic, dans l'ordre.
	 * @param array<string, list<array{event: string, step: string}>> $sessions  Événements par session.
	 * @return array{
	 *     sessions: int,
	 *     started: int,
	 *     captured: int,
	 *     submitted: int,
	 *     completion_rate: float,
	 *     steps: list<array{key: string, reached: int, rate: float}>,
	 *     abandons: array<string, int>
	 * }
	 */
	public static function build( array $step_keys, array $sessions ): array {
		$started   = 0;
		$captured  = 0;
		$submitted = 0;
		$reached   = array_fill_keys( $step_keys, 0 );
		$abandons  = array();

		foreach ( $sessions as $events ) {
			$names = array_column( $events, 'event' );
			$views = array();
			$last  = '';
			foreach ( $events as $event ) {
				if ( 'step_view' === $event['event'] && '' !== $event['step'] ) {
					$views[ $event['step'] ] = true;
					$last                    = $event['step'];
				}
			}
			$has_start = in_array( 'start', $names, true ) || array() !== $views;
			if ( ! $has_start ) {
				continue;
			}
			++$started;
			foreach ( array_keys( $views ) as $key ) {
				if ( isset( $reached[ $key ] ) ) {
					++$reached[ $key ];
				}
			}
			if ( in_array( 'capture', $names, true ) ) {
				++$captured;
			}
			if ( in_array( 'submit', $names, true ) ) {
				++$submitted;
			} else {
				// Dernière étape vue avant l'abandon ('' = abandon sur l'accueil).
				$abandons[ $last ] = ( $abandons[ $last ] ?? 0 ) + 1;
			}
		}

		arsort( $abandons );
		$steps = array();
		foreach ( $reached as $key => $count ) {
			$steps[] = array(
				'key'     => (string) $key,
				'reached' => $count,
				'rate'    => $started > 0 ? $count / $started : 0.0,
			);
		}

		return array(
			'sessions'        => count( $sessions ),
			'started'         => $started,
			'captured'        => $captured,
			'submitted'       => $submitted,
			'completion_rate' => $started > 0 ? $submitted / $started : 0.0,
			'steps'           => $steps,
			'abandons'        => $abandons,
		);
	}
}
