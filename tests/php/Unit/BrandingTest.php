<?php
/**
 * Tests de la marque blanche.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Branding;

final class BrandingTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubTranslationFunctions();
		Functions\when( 'plugin_basename' )->justReturn( 'smart-diagnostic/smart-diagnostic.php' );
		Functions\when( 'get_option' )->justReturn( array() );
	}

	public function test_brand_setting_is_used_and_hides_author(): void {
		Functions\when( 'get_option' )->justReturn( array( 'brand_name' => 'Audit Pro' ) );

		$plugins = ( new Branding() )->rename_in_plugin_list(
			array(
				'smart-diagnostic/smart-diagnostic.php' => array(
					'Name'   => 'Smart Diagnostic',
					'Title'  => 'Smart Diagnostic',
					'Author' => 'metisnc',
				),
			)
		);

		$this->assertSame( 'Audit Pro', $plugins['smart-diagnostic/smart-diagnostic.php']['Name'] );
		$this->assertSame( '', $plugins['smart-diagnostic/smart-diagnostic.php']['Author'] );
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	public function test_default_name(): void {
		$this->assertSame( 'Smart Diagnostic', Branding::name() );
	}

	public function test_name_can_be_filtered(): void {
		Filters\expectApplied( 'sd_brand_name' )->once()->andReturn( 'Mon Diagnostic' );

		$this->assertSame( 'Mon Diagnostic', Branding::name() );
	}

	public function test_plugin_list_uses_brand_name(): void {
		Filters\expectApplied( 'sd_brand_name' )->andReturn( 'Audit Express' );

		$plugins = ( new Branding() )->rename_in_plugin_list(
			array(
				'smart-diagnostic/smart-diagnostic.php' => array(
					'Name'  => 'Smart Diagnostic',
					'Title' => 'Smart Diagnostic',
				),
				'other/other.php'                       => array(
					'Name'  => 'Other',
					'Title' => 'Other',
				),
			)
		);

		$this->assertSame( 'Audit Express', $plugins['smart-diagnostic/smart-diagnostic.php']['Name'] );
		$this->assertSame( 'Other', $plugins['other/other.php']['Name'] );
	}
}
