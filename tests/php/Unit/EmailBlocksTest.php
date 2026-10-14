<?php
/**
 * Éditeur visuel des emails : blocs → HTML, style, modèles de départ, relance planifiée.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Config\SchemaValidator;
use SmartDiagnostic\Integrations\EmailBlocks;
use SmartDiagnostic\Integrations\Mailer;

final class EmailBlocksTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubTranslationFunctions();
		Functions\stubEscapeFunctions();
		Functions\stubs(
			array(
				'wp_strip_all_tags' => static fn( $text ) => trim( strip_tags( (string) $text ) ),
				'home_url'          => static fn( $path = '' ) => 'https://example.test' . $path,
				'is_email'          => static fn( $email ) => false !== filter_var( $email, FILTER_VALIDATE_EMAIL ),
			)
		);
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	/**
	 * @param list<array<string, mixed>> $blocks Blocs.
	 */
	private function html( array $blocks, string $lang = 'fr' ): string {
		return EmailBlocks::html( $blocks, $lang, 'fr', Mailer::email_theme( array() ) );
	}

	public function test_text_blocks_are_escaped_with_paragraphs_and_bold(): void {
		$html = $this->html(
			array(
				array(
					'type' => 'heading',
					'text' => array(
						'fr' => 'Bonjour {first_name} <b>',
						'en' => 'Hello',
					),
					'size' => 'large',
				),
				array(
					'type'  => 'text',
					'text'  => "Ligne **importante**\nsuite\n\nNouveau <script>x</script>",
					'align' => 'center',
				),
			)
		);
		$this->assertStringContainsString( '<h1 ', $html );
		$this->assertStringContainsString( 'Bonjour {first_name} &lt;b&gt;</h1>', $html );
		$this->assertStringContainsString( 'text-align:center;">Ligne <strong>importante</strong><br>', $html );
		$this->assertSame( 2, substr_count( $html, '<p ' ) );
		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringContainsString( 'Hello', $this->html( array( array( 'type' => 'heading', 'text' => array( 'fr' => 'Bonjour', 'en' => 'Hello' ) ) ), 'en' ) ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing
	}

	public function test_links_are_restricted(): void {
		$button = static fn( string $url ): array => array(
			'type' => 'button',
			'text' => 'Go',
			'url'  => $url,
		);
		$this->assertStringContainsString( 'href="{result_link}"', $this->html( array( $button( '{result_link}' ) ) ) );
		$this->assertStringContainsString( 'href="https://example.com/a"', $this->html( array( $button( 'https://example.com/a' ) ) ) );
		$this->assertSame( "\n", $this->html( array( $button( 'javascript:alert(1)' ) ) ) );
		$this->assertSame( "\n", $this->html( array( $button( '{email}' ) ) ) );

		$image = $this->html(
			array(
				array(
					'type'  => 'image',
					'url'   => 'https://example.com/i.png',
					'width' => 900,
					'link'  => 'javascript:x',
				),
			)
		);
		$this->assertStringContainsString( 'max-width:600px', $image );
		$this->assertStringNotContainsString( '<a ', $image );
		$this->assertSame( "\n", $this->html( array( array( 'type' => 'image', 'url' => 'data:image/png;base64,AAA' ) ) ) ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing
	}

	public function test_result_blocks_become_variables(): void {
		$html = $this->html(
			array(
				array( 'type' => 'profile' ),
				array( 'type' => 'scores' ),
				array( 'type' => 'cta' ),
				array( 'type' => 'unknown' ),
			)
		);
		$this->assertStringContainsString( '{profile}</h2>', $html );
		$this->assertStringContainsString( '{profile_text}', $html );
		$this->assertStringContainsString( '{scores}', $html );
		$this->assertStringContainsString( '{cta}', $html );
	}

	public function test_style_overrides_the_questionnaire_appearance(): void {
		$config = EmailBlocks::with_style(
			array( 'ui' => array( 'theme' => array( 'colors' => array( 'primary' => '#111111', 'text' => '#222222' ) ) ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing
			array(
				'primary'    => '#ff5500',
				'fontFamily' => 'Georgia',
				'logo'       => 'https://example.com/logo.png',
			)
		);
		$theme = Mailer::email_theme( $config );
		$this->assertSame( '#ff5500', $theme['primary'] );
		$this->assertSame( '#222222', $theme['text'] );
		$this->assertStringStartsWith( 'Georgia', $theme['heading_font'] );
		$this->assertSame( 'https://example.com/logo.png', $theme['logo'] );
	}

	public function test_presets_are_valid_configurations(): void {
		$presets = EmailBlocks::presets();
		$this->assertSame( array( 'user', 'admin', 'followUp' ), array_keys( $presets ) );

		$config = json_decode( (string) file_get_contents( dirname( __DIR__, 3 ) . '/tests/fixtures/demo.json' ), true );
		foreach ( $presets as $kind => $preset ) {
			$config['integrations']['emails'][ $kind ]['blocks']  = $preset['blocks'];
			$config['integrations']['emails'][ $kind ]['subject'] = $preset['subject'];
		}
		$config['integrations']['emails']['followUp']['enabled']   = true;
		$config['integrations']['emails']['followUp']['delayDays'] = 5;
		$config['integrations']['emails']['user']['style']         = array( 'primary' => '#ff5500' );
		$this->assertSame( array(), ( new SchemaValidator() )->validate_json( (string) json_encode( $config ) ) );
	}

	public function test_follow_up_is_scheduled_once_when_enabled(): void {
		$config     = array( 'integrations' => array( 'emails' => array( 'followUp' => array( 'enabled' => true, 'delayDays' => 5 ) ) ) ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing
		$submission = array(
			'id'    => 42,
			'email' => 'lea@example.com',
		);
		Functions\expect( 'wp_next_scheduled' )->twice()->with( Mailer::FOLLOW_UP_HOOK, array( 42 ) )->andReturn( false, 1234 );
		Functions\expect( 'wp_schedule_single_event' )->once()->andReturnUsing(
			function ( int $at, string $hook, array $args ): bool {
				$this->assertEqualsWithDelta( time() + 5 * 86400, $at, 5 );
				$this->assertSame( Mailer::FOLLOW_UP_HOOK, $hook );
				$this->assertSame( array( 42 ), $args );
				return true;
			}
		);

		$mailer = new Mailer();
		$this->assertTrue( $mailer->schedule_follow_up( $submission, $config ) );
		// Déjà planifiée (email ajouté ensuite sous le résultat) : pas de doublon.
		$this->assertFalse( $mailer->schedule_follow_up( $submission, $config ) );
		// Désactivée, ou sans email : rien.
		$this->assertFalse( $mailer->schedule_follow_up( $submission, array() ) );
		$this->assertFalse( $mailer->schedule_follow_up( array( 'id' => 42 ), $config ) );
	}
}
