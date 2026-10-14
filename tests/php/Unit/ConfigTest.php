<?php
/**
 * Tests de la validation du schéma et des migrations.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Config\Migrator;
use SmartDiagnostic\Config\SchemaValidator;

final class ConfigTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubTranslationFunctions();
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	private function demo(): string {
		return (string) file_get_contents( dirname( __DIR__, 3 ) . '/tests/fixtures/demo.json' );
	}

	public function test_demo_example_is_valid(): void {
		$this->assertSame( array(), ( new SchemaValidator() )->validate_json( $this->demo() ) );
	}

	public function test_invalid_json_is_reported(): void {
		$errors = ( new SchemaValidator() )->validate_json( '{"schemaVersion": 1,' );
		$this->assertCount( 1, $errors );
		$this->assertStringStartsWith( 'Invalid JSON', $errors[0] );
	}

	public function test_schema_errors_point_to_the_faulty_path(): void {
		$config                    = json_decode( $this->demo() );
		$config->steps[1]->type    = 'not_a_type';
		$config->axes[0]->key      = 'Invalid Key';

		$errors = ( new SchemaValidator() )->validate( $config );

		$this->assertNotEmpty( $errors );
		$this->assertNotEmpty( preg_grep( '#^/steps/1#', $errors ) );
	}

	public function test_missing_required_fields_are_rejected(): void {
		$this->assertNotEmpty( ( new SchemaValidator() )->validate_json( '{"schemaVersion": 1}' ) );
	}

	public function test_migrator_sets_current_version(): void {
		$config = ( new Migrator() )->migrate( (object) array( 'steps' => array() ) );
		$this->assertSame( Migrator::CURRENT_VERSION, $config->schemaVersion );
	}

	public function test_migrator_rejects_newer_versions(): void {
		$this->expectException( \InvalidArgumentException::class );
		( new Migrator() )->migrate( (object) array( 'schemaVersion' => Migrator::CURRENT_VERSION + 1 ) );
	}

	public function test_migrations_run_in_order(): void {
		Filters\expectApplied( 'sd_config_migrations' )->andReturn(
			array(
				0 => static function ( \stdClass $config ): \stdClass {
					$config->trace[] = 'v0→v1';
					return $config;
				},
			)
		);

		$config = ( new Migrator() )->migrate(
			(object) array(
				'schemaVersion' => 0,
				'trace'         => array(),
			)
		);

		$this->assertSame( array( 'v0→v1' ), $config->trace );
		$this->assertSame( 1, $config->schemaVersion );
	}
}
