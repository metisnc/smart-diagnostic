<?php
/**
 * Commandes WP-CLI : wp smart-diagnostic import|export|validate.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Cli;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Config\SchemaValidator;
use SmartDiagnostic\PostType\DiagnosticPostType;
use WP_CLI;

/**
 * Gère les diagnostics en ligne de commande.
 */
final class Command {

	public function __construct( private ConfigRepository $configs = new ConfigRepository() ) {}

	public static function register_command(): void {
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			WP_CLI::add_command( 'smart-diagnostic', self::class );
		}
	}

	/**
	 * Importe un diagnostic depuis un fichier JSON (crée ou met à jour).
	 *
	 * ## OPTIONS
	 *
	 * <file>
	 * : Fichier JSON de configuration.
	 *
	 * [--slug=<slug>]
	 * : Slug du diagnostic. S'il existe déjà, sa configuration est remplacée.
	 *
	 * [--title=<title>]
	 * : Titre (par défaut : meta.title de la config, ou le nom du fichier).
	 *
	 * [--status=<status>]
	 * : Statut du diagnostic.
	 * ---
	 * default: publish
	 * ---
	 *
	 * [--porcelain]
	 * : N'affiche que l'ID du diagnostic.
	 *
	 * ## EXAMPLES
	 *
	 *     wp smart-diagnostic import examples/demo.json --slug=demo
	 *
	 * @param list<string>          $args       Arguments.
	 * @param array<string, string> $assoc_args Options.
	 */
	public function import( array $args, array $assoc_args ): void {
		$file = $args[0];
		if ( ! is_readable( $file ) ) {
			WP_CLI::error( "File not readable: {$file}" );
		}
		$json = (string) file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents

		$errors = ( new SchemaValidator() )->validate_json( $json );
		if ( $errors ) {
			WP_CLI::error( "Invalid configuration:\n" . implode( "\n", $errors ) );
		}

		$slug    = isset( $assoc_args['slug'] ) ? sanitize_title( $assoc_args['slug'] ) : '';
		$post_id = '' !== $slug ? $this->configs->find_id( $slug ) : null;
		$title   = $assoc_args['title'] ?? $this->title_from_config( $json, $file );

		if ( null === $post_id ) {
			$post_id = wp_insert_post(
				array(
					'post_type'   => DiagnosticPostType::NAME,
					'post_status' => $assoc_args['status'] ?? 'publish',
					'post_title'  => $title,
					'post_name'   => $slug,
				),
				true
			);
			if ( is_wp_error( $post_id ) ) {
				WP_CLI::error( $post_id->get_error_message() );
			}
		}

		$errors = $this->configs->save( (int) $post_id, $json );
		if ( $errors ) {
			WP_CLI::error( implode( "\n", $errors ) );
		}

		if ( isset( $assoc_args['porcelain'] ) ) {
			WP_CLI::line( (string) $post_id );
			return;
		}
		WP_CLI::success( "Diagnostic {$post_id} imported." );
	}

	/**
	 * Affiche la configuration JSON d'un diagnostic.
	 *
	 * ## OPTIONS
	 *
	 * <id>
	 * : ID ou slug du diagnostic.
	 *
	 * @param list<string> $args Arguments.
	 */
	public function export( array $args ): void {
		$post_id = $this->configs->find_id( $args[0] );
		$config  = null === $post_id ? null : $this->configs->get( $post_id );
		if ( null === $config ) {
			WP_CLI::error( "Diagnostic not found: {$args[0]}" );
		}
		WP_CLI::line( (string) wp_json_encode( $config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
	}

	/**
	 * Valide un fichier JSON contre le schéma, sans rien importer.
	 *
	 * ## OPTIONS
	 *
	 * <file>
	 * : Fichier JSON.
	 *
	 * @param list<string> $args Arguments.
	 */
	public function validate( array $args ): void {
		$json   = is_readable( $args[0] ) ? (string) file_get_contents( $args[0] ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$errors = ( new SchemaValidator() )->validate_json( $json );
		if ( $errors ) {
			WP_CLI::error( "Invalid configuration:\n" . implode( "\n", $errors ) );
		}
		WP_CLI::success( 'Valid configuration.' );
	}

	private function title_from_config( string $json, string $file ): string {
		$config = json_decode( $json, true );
		$title  = is_array( $config ) ? ( $config['meta']['title'] ?? null ) : null;
		if ( is_array( $title ) ) {
			$title = reset( $title );
		}
		return is_string( $title ) && '' !== $title ? $title : basename( $file, '.json' );
	}
}
