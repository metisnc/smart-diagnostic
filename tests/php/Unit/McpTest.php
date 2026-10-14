<?php
/**
 * Connecteur MCP : activation, lecture seule par défaut, droits, pas de suppression, journal.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Mcp\Abilities;
use SmartDiagnostic\Mcp\ActionLog;

final class McpTest extends TestCase {

	/**
	 * @var array<string, mixed>
	 */
	private array $settings = array();

	/**
	 * @var array<string, bool>
	 */
	private array $caps = array();

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubTranslationFunctions();
		Functions\stubs(
			array(
				'get_option'       => fn( $name, $fallback = false ) => 'sd_settings' === $name ? $this->settings : $fallback,
				'current_user_can' => fn( $cap ) => $this->caps[ $cap ] ?? false,
				'wp_json_encode'   => static fn( $data, $flags = 0 ) => json_encode( $data, $flags ),
			)
		);
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	public function test_off_by_default(): void {
		$this->caps = array(
			'edit_posts'     => true,
			'manage_options' => true,
			'publish_posts'  => true,
		);
		$abilities  = new Abilities();
		foreach ( array_keys( $abilities->definitions() ) as $name ) {
			$this->assertFalse( $abilities->can( $name, array() ), $name );
		}
	}

	public function test_read_only_by_default_once_enabled(): void {
		$this->settings = array( 'mcp_enabled' => true );
		$this->caps     = array(
			'edit_posts'     => true,
			'manage_options' => true,
		);
		$abilities      = new Abilities();

		$this->assertTrue( $abilities->can( 'list-diagnostics', array() ) );
		$this->assertTrue( $abilities->can( 'list-submissions', array() ) );
		$this->assertFalse( $abilities->can( 'create-diagnostic', array() ) );
		$this->assertFalse( $abilities->can( 'create-from-template', array() ) );
		$this->assertNotContains( 'smart-diagnostic/create-diagnostic', $abilities->names() );
		$this->assertContains( 'smart-diagnostic/get-stats', $abilities->names() );

		$this->settings['mcp_write'] = true;
		$this->assertTrue( $abilities->can( 'create-from-template', array() ) );
		$this->assertContains( 'smart-diagnostic/update-diagnostic', $abilities->names() );
	}

	public function test_user_rights_are_checked(): void {
		$this->settings = array(
			'mcp_enabled' => true,
			'mcp_write'   => true,
		);
		// Auteur sans accès aux réponses (capacité manage_options par défaut).
		$this->caps = array( 'edit_posts' => true );
		$abilities  = new Abilities();
		$this->assertTrue( $abilities->can( 'list-diagnostics', array() ) );
		$this->assertFalse( $abilities->can( 'list-submissions', array() ) );
		$this->assertFalse( $abilities->can( 'export-submissions', array() ) );
		$this->assertFalse( $abilities->can( 'get-stats', array() ) );

		// Simple abonné : rien.
		$this->caps = array();
		foreach ( array_keys( $abilities->definitions() ) as $name ) {
			$this->assertFalse( $abilities->can( $name, array() ), $name );
		}
		$this->assertFalse( $abilities->can( 'unknown', array() ) );
	}

	public function test_no_deletion_is_exposed(): void {
		foreach ( array_keys( ( new Abilities() )->definitions() ) as $name ) {
			$this->assertStringNotContainsString( 'delete', $name );
			$this->assertStringNotContainsString( 'remove', $name );
		}
	}

	public function test_log_summarises_parameters(): void {
		$this->assertSame(
			'id=12, status=draft, write=true, config=[29 bytes]',
			ActionLog::summary(
				array(
					'id'     => 12,
					'status' => 'draft',
					'write'  => true,
					'config' => array( 'schemaVersion' => 1, 'x' => 'abc' ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
				)
			)
		);
	}
}
