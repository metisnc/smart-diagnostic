<?php
/**
 * Webhooks (mapping), CSV (sécurité des cellules) et textes des emails.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Admin\SubmissionsPage;
use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Engine\Text;
use SmartDiagnostic\Integrations\Webhooks;

final class IntegrationsTest extends TestCase {

	/**
	 * @var array<string, mixed>
	 */
	private array $config;

	/**
	 * @var array<string, mixed>
	 */
	private array $submission;

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubTranslationFunctions();
		Functions\stubs(
			array(
				'wp_json_encode' => static fn( $data, $flags = 0 ) => json_encode( $data, $flags ),
				'add_query_arg'  => static fn( $key, $value, $url ) => $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . $key . '=' . $value,
				'home_url'       => 'https://example.test/',
			)
		);
		$json         = (string) file_get_contents( dirname( __DIR__, 3 ) . '/examples/demo.json' );
		$this->config = json_decode( $json, true );
		Functions\when( 'get_post_meta' )->justReturn( $json );

		$this->submission = array(
			'id'            => 7,
			'diagnostic_id' => 3,
			'token'         => str_repeat( 'a', 32 ),
			'source_url'    => 'https://example.test/diag/',
			'email'         => 'alice@example.com',
			'first_name'    => 'Alice',
			'profile'       => 'profile_low',
			'contact'       => array( 'email' => 'alice@example.com' ),
			'answers'       => array(
				'q_choice' => 'a',
				'q_multi'  => array( 'one', 'two' ),
			),
			'scores'        => array( 'axis_x' => 74.6 ),
			'vars'          => array( 'gap' => 800.0 ),
			'utm'           => array( 'source' => 'newsletter' ),
			'lang'          => 'fr',
		);
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	public function test_webhook_mapping(): void {
		$payload = Webhooks::payload(
			array(
				'key'     => 'crm',
				'mapping' => array(
					'email'   => 'contact.email',
					'choice'  => 'answer.q_choice',
					'score_x' => 'score.axis_x',
					'source'  => 'utm.source',
					'profile' => 'profile',
					'link'    => 'result_url',
					'secret'  => 'ip_hash',
				),
			),
			'submit',
			$this->submission
		);

		$this->assertSame(
			array(
				'email'   => 'alice@example.com',
				'choice'  => 'a',
				'score_x' => 74.6,
				'source'  => 'newsletter',
				'profile' => 'profile_low',
				'link'    => 'https://example.test/diag/?sd_result=' . str_repeat( 'a', 32 ),
				// Les colonnes internes ne sont pas exposées.
				'secret'  => null,
			),
			$payload
		);
	}

	public function test_csv_cells_neutralise_formulas(): void {
		$this->assertSame( "'=HYPERLINK(\"x\")", SubmissionsPage::csv_cell( '=HYPERLINK("x")' ) );
		$this->assertSame( "'@cmd", SubmissionsPage::csv_cell( '@cmd' ) );
		$this->assertSame( '-12.5', SubmissionsPage::csv_cell( '-12.5' ) );
		$this->assertSame( '["a","b"]', SubmissionsPage::csv_cell( array( 'a', 'b' ) ) );
		$this->assertSame( '1', SubmissionsPage::csv_cell( true ) );
	}

	public function test_csv_rows_use_answer_labels(): void {
		$lines = SubmissionsPage::csv_rows( array( $this->submission ), new ConfigRepository() );
		$row   = array_combine( $lines[0], $lines[1] );

		$this->assertSame( 'alice@example.com', $row['email'] );
		$this->assertSame( 'Option A', $row['answer.q_choice'] );
		$this->assertSame( 'Élément 1, Élément 2', $row['answer.q_multi'] );
		$this->assertSame( 74.6, $row['score.axis_x'] );
		$this->assertSame( 'newsletter', $row['utm_source'] );
	}

	public function test_text_interpolation_for_emails(): void {
		$text = Text::interpolate( 'Bonjour {first_name} : {answer:q_choice}, X = {score:axis_x}, écart {var:gap}', $this->config, $this->submission );
		$this->assertSame( 'Bonjour Alice : Option A, X = 75, écart 800', $text );
		$this->assertSame( 'Hello', Text::resolve( array( 'fr' => 'Bonjour', 'en' => 'Hello' ), 'en_US', 'fr' ) ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
	}
}
