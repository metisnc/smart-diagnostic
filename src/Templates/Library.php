<?php
/**
 * Bibliothèque de modèles de diagnostics (fichiers JSON en lecture seule).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Templates;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Config\SchemaValidator;
use SmartDiagnostic\Engine\Text;
use SmartDiagnostic\PostType\DiagnosticPostType;

/**
 * Un modèle n'est jamais modifié : « Utiliser ce modèle » crée une copie (brouillon).
 */
final class Library {

	/** Durée moyenne estimée par question, en secondes. */
	private const SECONDS_PER_QUESTION = 20;

	/**
	 * Modèles chargés et validés (cache de la requête).
	 *
	 * @var array<string, array{id: string, title: string, description: string, questions: int, minutes: int, color: string, config: array<string, mixed>, json: string}>|null
	 */
	private ?array $templates = null;

	public function __construct( private ConfigRepository $configs = new ConfigRepository() ) {}

	public static function directory(): string {
		return dirname( __DIR__, 2 ) . '/templates/diagnostics';
	}

	/**
	 * Modèles disponibles, triés par titre. Les modèles invalides sont ignorés.
	 *
	 * @return array<string, array{id: string, title: string, description: string, questions: int, minutes: int, color: string, config: array<string, mixed>, json: string}>
	 */
	public function all(): array {
		if ( null !== $this->templates ) {
			return $this->templates;
		}
		$sources = array();
		foreach ( glob( self::directory() . '/*.json' ) ?: array() as $file ) { // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
			$sources[ basename( $file, '.json' ) ] = array( 'file' => $file );
		}

		/**
		 * Ajoute, remplace ou retire des modèles de diagnostics.
		 *
		 * Chaque entrée, indexée par un identifiant (lettres, chiffres, tirets), fournit
		 * `file` (chemin d'un fichier JSON) ou `config` (tableau ou chaîne JSON). Facultatifs :
		 * `title` et `description` (sinon meta.title / meta.description de la config).
		 *
		 * @param array<string, array<string, mixed>> $sources Modèles.
		 */
		$sources   = (array) apply_filters( 'sd_templates', $sources );
		$validator = new SchemaValidator();
		$templates = array();
		foreach ( $sources as $id => $source ) {
			$id = sanitize_key( (string) $id );
			if ( '' === $id || ! is_array( $source ) ) {
				continue;
			}
			$json   = $this->load( $source );
			$config = json_decode( $json, true );
			if ( ! is_array( $config ) || $validator->validate_json( $json ) ) {
				continue;
			}
			$templates[ $id ] = $this->describe( $id, $source, $config ) + array( 'json' => $json );
		}
		uasort( $templates, static fn( array $a, array $b ): int => strcasecmp( $a['title'], $b['title'] ) );
		$this->templates = $templates;
		return $templates;
	}

	/**
	 * @return array{id: string, title: string, description: string, questions: int, minutes: int, color: string, config: array<string, mixed>, json: string}|null
	 */
	public function get( string $id ): ?array {
		return $this->all()[ $id ] ?? null;
	}

	/**
	 * Crée un diagnostic (brouillon par défaut) à partir d'un modèle.
	 *
	 * @return int|\WP_Error ID du diagnostic créé.
	 */
	public function create( string $id, string $title = '', string $status = 'draft' ): int|\WP_Error {
		$template = $this->get( $id );
		if ( null === $template ) {
			return new \WP_Error( 'sd_unknown_template', __( 'Unknown template.', 'smart-diagnostic' ) );
		}
		$post_id = wp_insert_post(
			array(
				'post_type'   => DiagnosticPostType::NAME,
				'post_status' => $status,
				'post_title'  => '' !== $title ? $title : $template['title'],
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		$errors = $this->configs->save( (int) $post_id, $template['json'] );
		if ( $errors ) {
			wp_delete_post( (int) $post_id, true );
			return new \WP_Error( 'sd_invalid_template', implode( "\n", $errors ) );
		}

		/**
		 * Un diagnostic vient d'être créé depuis un modèle.
		 *
		 * @param int    $post_id ID du diagnostic.
		 * @param string $id      Identifiant du modèle.
		 */
		do_action( 'sd_template_used', (int) $post_id, $id );
		return (int) $post_id;
	}

	/**
	 * JSON brut du modèle (gardé tel quel : un aller-retour en tableau PHP changerait {} en []).
	 *
	 * @param array<string, mixed> $source Entrée du filtre.
	 */
	private function load( array $source ): string {
		$config = $source['config'] ?? null;
		if ( is_array( $config ) ) {
			return (string) wp_json_encode( $config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		}
		if ( is_string( $config ) ) {
			return $config;
		}
		if ( isset( $source['file'] ) && is_string( $source['file'] ) && is_readable( $source['file'] ) ) {
			return (string) file_get_contents( $source['file'] ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		}
		return '';
	}

	/**
	 * @param string               $id     Identifiant du modèle.
	 * @param array<string, mixed> $source Entrée du filtre.
	 * @param array<string, mixed> $config Config du modèle.
	 * @return array{id: string, title: string, description: string, questions: int, minutes: int, color: string, config: array<string, mixed>}
	 */
	private function describe( string $id, array $source, array $config ): array {
		$lang      = function_exists( 'determine_locale' ) ? determine_locale() : '';
		$fallback  = (string) ( $config['i18n']['defaultLanguage'] ?? '' );
		$questions = count( array_filter( (array) ( $config['steps'] ?? array() ), static fn( $step ): bool => is_array( $step ) && 'question' === ( $step['kind'] ?? '' ) ) );
		$title     = wp_strip_all_tags( Text::resolve( $source['title'] ?? $config['meta']['title'] ?? '', $lang, $fallback ) );
		return array(
			'id'          => $id,
			'title'       => '' !== $title ? $title : $id,
			'description' => wp_strip_all_tags( Text::resolve( $source['description'] ?? $config['meta']['description'] ?? '', $lang, $fallback ) ),
			'questions'   => $questions,
			'minutes'     => max( 1, (int) ceil( $questions * self::SECONDS_PER_QUESTION / 60 ) ),
			'color'       => (string) ( $config['ui']['theme']['colors']['primary'] ?? '' ),
			'config'      => $config,
		);
	}
}
