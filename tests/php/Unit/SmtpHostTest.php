<?php
/**
 * Validation de l'adresse du serveur SMTP.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Settings;

final class SmtpHostTest extends TestCase {

	/**
	 * @return iterable<string, array{string, bool}>
	 */
	public static function hosts(): iterable {
		yield 'office 365' => array( 'smtp.office365.com', true );
		yield 'ovh' => array( 'ssl0.ovh.net', true );
		yield 'nom court (docker)' => array( 'mailpit', true );
		yield 'adresse IP' => array( '192.168.1.20', true );
		yield 'adresse email' => array( 'contact@example.com', false );
		yield 'vide' => array( '', false );
		yield 'avec espace' => array( 'smtp example.com', false );
		yield 'avec protocole' => array( 'https://smtp.example.com', false );
		yield 'avec port' => array( 'smtp.example.com:587', false );
	}

	#[DataProvider( 'hosts' )]
	public function test_host( string $host, bool $valid ): void {
		$this->assertSame( $valid, Settings::valid_smtp_host( $host ) );
	}
}
