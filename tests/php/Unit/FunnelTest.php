<?php
/**
 * Calcul de l'entonnoir.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Analytics\Funnel;

final class FunnelTest extends TestCase {

	private static function view( string $step ): array {
		return array(
			'event' => 'step_view',
			'step'  => $step,
		);
	}

	private static function event( string $name ): array {
		return array(
			'event' => $name,
			'step'  => '',
		);
	}

	public function test_funnel_counts_unique_sessions_per_step(): void {
		$funnel = Funnel::build(
			array( 'q1', 'q2', 'q3' ),
			array(
				// Parcours complet, avec retour arrière sur q1 (compté une fois).
				's1' => array( self::event( 'start' ), self::view( 'q1' ), self::view( 'q2' ), self::view( 'q1' ), self::view( 'q2' ), self::view( 'q3' ), self::event( 'capture' ), self::event( 'submit' ) ),
				// Abandon sur q2.
				's2' => array( self::event( 'start' ), self::view( 'q1' ), self::view( 'q2' ), self::event( 'abandon' ) ),
				// Abandon sur q2 aussi.
				's3' => array( self::event( 'start' ), self::view( 'q1' ), self::view( 'q2' ) ),
				// Abandon avant la première question.
				's4' => array( self::event( 'start' ) ),
				// Session sans démarrage (bruit) : ignorée.
				's5' => array( self::event( 'answer' ) ),
			)
		);

		$this->assertSame( 5, $funnel['sessions'] );
		$this->assertSame( 4, $funnel['started'] );
		$this->assertSame( 1, $funnel['submitted'] );
		$this->assertSame( 1, $funnel['captured'] );
		$this->assertEqualsWithDelta( 0.25, $funnel['completion_rate'], 1e-9 );
		$this->assertSame( array( 3, 3, 1 ), array_column( $funnel['steps'], 'reached' ) );
		$this->assertEqualsWithDelta( 0.75, $funnel['steps'][0]['rate'], 1e-9 );
		$this->assertSame(
			array(
				'q2' => 2,
				''   => 1,
			),
			$funnel['abandons']
		);
	}

	public function test_empty(): void {
		$funnel = Funnel::build( array( 'q1' ), array() );
		$this->assertSame( 0, $funnel['started'] );
		$this->assertSame( 0.0, $funnel['completion_rate'] );
		$this->assertSame( array(), $funnel['abandons'] );
	}
}
