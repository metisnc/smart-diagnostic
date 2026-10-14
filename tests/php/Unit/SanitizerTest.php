<?php
/**
 * Nettoyage et validation serveur des soumissions.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Engine\Context;
use SmartDiagnostic\Engine\Flow;
use SmartDiagnostic\Submission\Sanitizer;

final class SanitizerTest extends TestCase {

	/**
	 * @var array<string, mixed>
	 */
	private array $config;

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubs(
			array(
				'sanitize_text_field'     => static fn( $value ) => trim( strip_tags( (string) $value ) ),
				'sanitize_textarea_field' => static fn( $value ) => trim( strip_tags( (string) $value ) ),
				'sanitize_email'          => static fn( $value ) => trim( (string) $value ),
				'is_email'                => static fn( $value ) => false !== filter_var( $value, FILTER_VALIDATE_EMAIL ),
			)
		);
		$this->config = json_decode( (string) file_get_contents( dirname( __DIR__, 3 ) . '/tests/fixtures/demo.json' ), true );
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	public function test_unknown_keys_and_invalid_options_are_dropped(): void {
		$answers = ( new Sanitizer() )->answers(
			$this->config,
			array(
				'first_name' => '<b>Alice</b>',
				'q_choice'   => 'z',
				'q_multi'    => array( 'one', 'evil', 'one', 'two' ),
				'q_scale'    => '4',
				'q_current'  => 'abc',
				'hacker'     => 'x',
			)
		);

		$this->assertSame(
			array(
				'first_name' => 'Alice',
				'q_multi'    => array( 'one', 'two' ),
				'q_scale'    => 4.0,
			),
			$answers
		);
	}

	public function test_booleans_are_kept_for_yes_no(): void {
		$answers = ( new Sanitizer() )->answers( $this->config, array( 'q_follow_up' => false ) );
		$this->assertSame( array( 'q_follow_up' => false ), $answers );
	}

	public function test_required_answers_on_path_are_enforced(): void {
		$sanitizer = new Sanitizer();
		$answers   = $sanitizer->answers( $this->config, array( 'q_choice' => 'b', 'q_scale' => 9 ) ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
		$path      = Flow::compute_path( $this->config, $answers, fn( array $a ) => new Context( $this->config, $a ) );
		$errors    = $sanitizer->validate_answers( $this->config, $answers, $path );

		// q_follow_up est hors chemin (option B) : pas d'erreur pour elle.
		$this->assertArrayNotHasKey( 'q_follow_up', $errors );
		$this->assertSame( 'required', $errors['q_multi'] );
		$this->assertSame( 'max', $errors['q_scale'] );
		$this->assertSame( 'required', $errors['q_current'] );
		$this->assertArrayNotHasKey( 'first_name', $errors );
	}

	public function test_contact_and_consent(): void {
		$sanitizer = new Sanitizer();
		$forms     = $sanitizer->forms( $this->config, array( 'contact' ), 'inline' );

		$missing = $sanitizer->contact( $forms, array( 'email' => 'not-an-email' ), false );
		$this->assertSame( 'invalidEmail', $missing['errors']['email'] );
		$this->assertSame( 'consentRequired', $missing['errors']['__consent'] );

		$ok = $sanitizer->contact( $forms, array( 'email' => 'alice@example.com', 'first_name' => ' Alice ', 'extra' => 'x' ), true ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
		$this->assertSame( array(), $ok['errors'] );
		$this->assertSame( array( 'first_name' => 'Alice', 'email' => 'alice@example.com' ), $ok['contact'] ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
		$this->assertSame( 'demo-1', $ok['consent_version'] );
	}

	public function test_forms_outside_path_are_ignored(): void {
		$this->assertSame( array(), ( new Sanitizer() )->forms( $this->config, array( 'q_choice' ), 'inline' ) );
	}
}
