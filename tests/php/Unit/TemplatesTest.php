<?php
/**
 * Bibliothèque de modèles : modèles livrés valides, filtre sd_templates, description.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Tests\Unit;

use Brain\Monkey;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PHPUnit\Framework\TestCase;
use SmartDiagnostic\Templates\Library;

final class TemplatesTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Functions\stubTranslationFunctions();
		Functions\stubs(
			array(
				'wp_json_encode'    => static fn( $data, $flags = 0 ) => json_encode( $data, $flags ),
				'sanitize_key'      => static fn( $key ) => preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) ),
				'wp_strip_all_tags' => static fn( $text ) => trim( strip_tags( (string) $text ) ),
				'determine_locale'  => 'fr_FR',
			)
		);
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}

	public function test_every_bundled_template_is_listed(): void {
		$files = glob( Library::directory() . '/*.json' );
		$this->assertNotEmpty( $files );
		$this->assertGreaterThanOrEqual( 4, count( $files ) );

		// Un modèle invalide serait ignoré en silence : chaque fichier doit apparaître.
		$all = ( new Library() )->all();
		foreach ( $files as $file ) {
			$id = basename( $file, '.json' );
			$this->assertArrayHasKey( $id, $all, "Template {$id} is invalid." );
			$this->assertNotSame( $id, $all[ $id ]['title'] );
			$this->assertNotSame( '', $all[ $id ]['description'] );
			$this->assertGreaterThan( 0, $all[ $id ]['questions'] );
		}
	}

	public function test_filter_adds_and_removes_templates(): void {
		Filters\expectApplied( 'sd_templates' )->once()->andReturnUsing(
			static function (): array {
				// Les modèles livrés sont retirés, un modèle est ajouté, un modèle invalide est ignoré.
				$sources         = array();
				$sources['mine'] = array(
					'title'  => 'Mon modèle',
					'config' => array(
						'schemaVersion' => 1,
						'meta'          => array( 'description' => array( 'fr' => 'Description FR', 'en' => 'English' ) ), // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
						'ui'            => array( 'theme' => array( 'colors' => array( 'primary' => '#123456' ) ) ),
						'sections'      => array(
							array(
								'key'   => 'main',
								'label' => 'Section',
							),
						),
						'steps'         => array_map(
							static fn( int $i ): array => array(
								'key'     => 'q' . $i,
								'kind'    => 'question',
								'section' => 'main',
								'type'    => 'yes_no',
								'label'   => 'Question ' . $i,
							),
							range( 1, 7 )
						),
					),
				);
				$sources['broken'] = array( 'config' => '{"schemaVersion": "nope"}' );
				return $sources;
			}
		);

		$all = ( new Library() )->all();

		$this->assertSame( array( 'mine' ), array_keys( $all ) );
		$this->assertSame( 'Mon modèle', $all['mine']['title'] );
		$this->assertSame( 'Description FR', $all['mine']['description'] );
		$this->assertSame( 7, $all['mine']['questions'] );
		$this->assertSame( 3, $all['mine']['minutes'] );
		$this->assertSame( '#123456', $all['mine']['color'] );
	}
}
