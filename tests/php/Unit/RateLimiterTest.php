<?php
/**
 * Limitation du nombre de soumissions.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Security\RateLimiter;

final class RateLimiterTest extends TestCase {

	/**
	 * @var array<string, mixed>
	 */
	private array $transients = array();

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\when( 'get_option' )->justReturn(
			array(
				'rate_limit'  => 3,
				'rate_window' => 600,
			)
		);
		Functions\when( 'get_transient' )->alias( fn( string $key ) => $this->transients[ $key ] ?? false );
		Functions\when( 'set_transient' )->alias(
			function ( string $key, $value ): bool {
				$this->transients[ $key ] = $value;
				return true;
			}
		);
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	public function test_blocks_after_the_limit(): void {
		$limiter = new RateLimiter();
		$this->assertTrue( $limiter->hit( 'ip-a' ) );
		$this->assertTrue( $limiter->hit( 'ip-a' ) );
		$this->assertTrue( $limiter->hit( 'ip-a' ) );
		$this->assertFalse( $limiter->hit( 'ip-a' ) );
		// Un autre visiteur n'est pas concerné.
		$this->assertTrue( $limiter->hit( 'ip-b' ) );
	}

	public function test_window_resets(): void {
		$limiter = new RateLimiter();
		for ( $i = 0; $i < 4; $i++ ) {
			$limiter->hit( 'ip-c' );
		}
		$key                                 = 'sd_rl_' . md5( 'ip-c' );
		$this->transients[ $key ]['start'] -= 601;

		$this->assertTrue( $limiter->hit( 'ip-c' ) );
	}
}
