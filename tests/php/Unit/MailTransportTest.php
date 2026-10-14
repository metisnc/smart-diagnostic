<?php
/**
 * En-têtes et configuration SMTP des emails.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Integrations\MailTransport;

final class MailTransportTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\when( 'is_email' )->alias( static fn( $value ) => false !== filter_var( $value, FILTER_VALIDATE_EMAIL ) );
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	/**
	 * @param array<string, mixed> $settings Réglages enregistrés.
	 */
	private function settings( array $settings ): void {
		Functions\when( 'get_option' )->justReturn( $settings );
	}

	public function test_default_headers_leave_the_sender_to_wordpress(): void {
		$this->settings( array() );
		$this->assertSame( array( 'Content-Type: text/html; charset=UTF-8' ), MailTransport::headers() );
		$this->assertNull( MailTransport::from() );
	}

	public function test_sender_and_reply_to(): void {
		$this->settings(
			array(
				'mail_from_name'  => "Équipe\r\nBcc: pirate@example.com",
				'mail_from_email' => 'diagnostic@example.test',
				'mail_reply_to'   => 'ventes@example.test',
			)
		);
		$this->assertSame(
			array(
				'Content-Type: text/html; charset=UTF-8',
				// Les retours à la ligne sont neutralisés : pas d'en-tête injecté.
				'From: Équipe Bcc: pirate@example.com <diagnostic@example.test>',
				'Reply-To: ventes@example.test',
			),
			MailTransport::headers()
		);
	}

	public function test_invalid_addresses_are_ignored(): void {
		$this->settings(
			array(
				'mail_from_email' => 'not-an-email',
				'mail_reply_to'   => 'nope',
			)
		);
		$this->assertSame( array( 'Content-Type: text/html; charset=UTF-8' ), MailTransport::headers() );
	}

	public function test_smtp_config(): void {
		$this->settings(
			array(
				'smtp_enabled'    => true,
				'smtp_host'       => 'smtp.example.test',
				'smtp_port'       => 465,
				'smtp_encryption' => 'ssl',
				'smtp_user'       => 'user@example.test',
				'smtp_password'   => 'secret',
			)
		);
		$this->assertSame(
			array(
				'host'     => 'smtp.example.test',
				'port'     => 465,
				'secure'   => 'ssl',
				'auth'     => true,
				'user'     => 'user@example.test',
				'password' => 'secret',
			),
			MailTransport::smtp_config()
		);
	}

	public function test_smtp_without_credentials_or_encryption(): void {
		$this->settings(
			array(
				'smtp_host'       => 'mailpit',
				'smtp_port'       => 1025,
				'smtp_encryption' => 'none',
			)
		);
		$config = MailTransport::smtp_config();
		$this->assertSame( '', $config['secure'] );
		$this->assertFalse( $config['auth'] );
	}
}
