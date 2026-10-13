<?php
/**
 * Parité PHP ↔ JS : mêmes fixtures que tests/js/parity.test.js.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Engine\Calculator;
use SmartDiagnostic\Engine\Expression;
use SmartDiagnostic\Engine\ExpressionError;

final class ParityTest extends TestCase {

	private const DIR = __DIR__ . '/../../fixtures/parity/';

	/**
	 * @return array<string, mixed>
	 */
	private static function read( string $file ): array {
		return json_decode( (string) file_get_contents( $file ), true, 512, JSON_THROW_ON_ERROR );
	}

	private static function assert_same_value( mixed $expected, mixed $actual, string $label ): void {
		if ( is_int( $expected ) || is_float( $expected ) ) {
			self::assertTrue( is_int( $actual ) || is_float( $actual ), "$label: expected a number" );
			self::assertEqualsWithDelta( (float) $expected, (float) $actual, 1e-9, $label );
		} else {
			self::assertSame( $expected, $actual, $label );
		}
	}

	/**
	 * @return iterable<string, array{string, mixed, array<string, mixed>}>
	 */
	public static function expression_cases(): iterable {
		$fixture = self::read( self::DIR . 'expressions.json' );
		foreach ( $fixture['cases'] as $case ) {
			yield $case['expr'] => array( $case['expr'], $case['expected'], $fixture['values'] );
		}
	}

	/**
	 * @param array<string, mixed> $values Valeurs des chemins.
	 */
	#[DataProvider( 'expression_cases' )]
	public function test_expression( string $expr, mixed $expected, array $values ): void {
		$actual = Expression::evaluate( $expr, static fn( string $key ): mixed => $values[ $key ] ?? null );
		self::assert_same_value( $expected, $actual, $expr );
	}

	/**
	 * @return iterable<string, array{string}>
	 */
	public static function invalid_expressions(): iterable {
		foreach ( self::read( self::DIR . 'expressions.json' )['invalid'] as $expr ) {
			yield '"' . $expr . '"' => array( $expr );
		}
	}

	#[DataProvider( 'invalid_expressions' )]
	public function test_invalid_expression( string $expr ): void {
		$this->expectException( ExpressionError::class );
		Expression::parse( $expr );
	}

	/**
	 * @return iterable<string, array{array<string, mixed>, array<string, mixed>}>
	 */
	public static function scenario_cases(): iterable {
		foreach ( glob( self::DIR . '*.json' ) ?: array() as $file ) {
			if ( 'expressions.json' === basename( $file ) ) {
				continue;
			}
			$fixture = self::read( $file );
			$config  = isset( $fixture['configFile'] ) ? self::read( dirname( __DIR__, 3 ) . '/' . $fixture['configFile'] ) : $fixture['config'];
			foreach ( $fixture['cases'] as $case ) {
				yield basename( $file ) . ' › ' . $case['name'] => array( $config, $case );
			}
		}
	}

	/**
	 * @param array<string, mixed> $config Config.
	 * @param array<string, mixed> $case   Cas.
	 */
	#[DataProvider( 'scenario_cases' )]
	public function test_scenario( array $config, array $case ): void {
		$result   = Calculator::compute( $config, $case['answers'], $case['contact'] ?? array() );
		$expected = $case['expected'];

		self::assertSame( $expected['path'], $result['path'], 'path' );
		self::assertSame( array_keys( $expected['scores'] ), array_keys( $result['scores'] ), 'score keys' );
		foreach ( $expected['scores'] as $key => $value ) {
			self::assert_same_value( $value, $result['scores'][ $key ], "score.$key" );
		}
		self::assertSame( array_keys( $expected['vars'] ), array_keys( $result['vars'] ), 'var keys' );
		foreach ( $expected['vars'] as $key => $value ) {
			self::assert_same_value( $value, $result['vars'][ $key ], "var.$key" );
		}
		self::assertSame( $expected['profile'], $result['profile'], 'profile' );
		self::assertSame( $expected['texts'], $result['texts'], 'texts' );
		self::assertSame( $expected['actions'], $result['actions'], 'actions' );
		self::assertSame( $expected['cta'], $result['cta'], 'cta' );
	}
}
