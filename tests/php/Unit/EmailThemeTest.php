<?php
/**
 * Apparence des emails tirée de l'apparence du questionnaire.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Integrations\Mailer;

final class EmailThemeTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubs(
			array(
				'wp_strip_all_tags' => static fn( $text ) => trim( strip_tags( (string) $text ) ),
				'home_url'          => static fn( $path = '' ) => 'https://example.test' . $path,
			)
		);
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	public function test_defaults_match_the_questionnaire(): void {
		$theme = Mailer::email_theme( array() );
		$this->assertSame( '#2563eb', $theme['primary'] );
		$this->assertSame( '#ffffff', $theme['primary_text'] );
		$this->assertSame( 'Arial, Helvetica, sans-serif', $theme['font'] );
		$this->assertSame( '12px', $theme['radius'] );
		$this->assertSame( '', $theme['logo'] );
	}

	public function test_questionnaire_appearance_is_reused(): void {
		$theme = Mailer::email_theme(
			array(
				'ui' => array(
					'theme' => array(
						'colors'            => array(
							'primary'     => '#ff5500',
							'primaryText' => '#000000',
							'text'        => '#111111',
						),
						'fontFamily'        => 'Inter, sans-serif',
						'headingFontFamily' => 'Georgia',
						'radius'            => '4px',
					),
					'logo'  => array(
						'url' => '/wp-content/uploads/logo.png',
						'alt' => 'Acme',
					),
				),
			)
		);
		$this->assertSame( '#ff5500', $theme['primary'] );
		$this->assertSame( '#000000', $theme['primary_text'] );
		$this->assertSame( '#111111', $theme['text'] );
		$this->assertSame( 'Inter, sans-serif, Arial, Helvetica, sans-serif', $theme['font'] );
		$this->assertSame( 'Georgia, Arial, Helvetica, sans-serif', $theme['heading_font'] );
		$this->assertSame( '4px', $theme['radius'] );
		// Une image d'email doit avoir une adresse complète.
		$this->assertSame( 'https://example.test/wp-content/uploads/logo.png', $theme['logo'] );
		$this->assertSame( 'Acme', $theme['logo_alt'] );
	}

	public function test_unsafe_values_fall_back_to_defaults(): void {
		$theme = Mailer::email_theme(
			array(
				'ui' => array(
					'theme' => array(
						'colors'     => array( 'primary' => 'red;background:url(x)' ),
						'fontFamily' => 'Inter;} body{display:none',
						'radius'     => '2rem',
					),
					'logo'  => array( 'url' => 'javascript:alert(1)' ),
				),
			)
		);
		$this->assertSame( '#2563eb', $theme['primary'] );
		$this->assertSame( 'Arial, Helvetica, sans-serif', $theme['font'] );
		$this->assertSame( '12px', $theme['radius'] );
		$this->assertSame( '', $theme['logo'] );
	}
}
