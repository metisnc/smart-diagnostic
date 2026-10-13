<?php
/**
 * Lecture / écriture de la configuration d'un diagnostic.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Config;

use SmartDiagnostic\PostType\DiagnosticPostType;

/**
 * La config est stockée en JSON brut dans la méta META_KEY du CPT sd_diagnostic.
 */
final class ConfigRepository {

	public const META_KEY = '_sd_config';

	public function __construct(
		private SchemaValidator $validator = new SchemaValidator(),
		private Migrator $migrator = new Migrator()
	) {}

	/**
	 * Config migrée d'un diagnostic, en objets (pour la sortie JSON fidèle).
	 */
	public function get( int $post_id ): ?\stdClass {
		$raw = get_post_meta( $post_id, self::META_KEY, true );
		if ( ! is_string( $raw ) || '' === $raw ) {
			return null;
		}
		$config = json_decode( $raw );
		if ( ! $config instanceof \stdClass ) {
			return null;
		}
		try {
			$config = $this->migrator->migrate( $config );
		} catch ( \InvalidArgumentException $e ) {
			return null;
		}
		/**
		 * Config d'un diagnostic, après migration (front, calcul serveur, intégrations).
		 *
		 * @param \stdClass $config  Config (objets).
		 * @param int       $post_id Diagnostic.
		 */
		/** @var mixed $filtered Une extension peut renvoyer n'importe quoi. */
		$filtered = apply_filters( 'sd_config', $config, $post_id );
		return $filtered instanceof \stdClass ? $filtered : $config;
	}

	/**
	 * Config migrée en tableaux associatifs (format attendu par le moteur PHP).
	 *
	 * @return array<string, mixed>|null
	 */
	public function get_array( int $post_id ): ?array {
		$config = $this->get( $post_id );
		return null === $config ? null : json_decode( (string) wp_json_encode( $config ), true );
	}

	/**
	 * JSON brut stocké (pour l'éditeur).
	 */
	public function get_raw( int $post_id ): string {
		$raw = get_post_meta( $post_id, self::META_KEY, true );
		return is_string( $raw ) ? $raw : '';
	}

	/**
	 * Valide puis enregistre une config.
	 *
	 * @param int    $post_id ID du diagnostic.
	 * @param string $json    Config JSON.
	 * @return list<string> Erreurs ; vide si enregistrée.
	 */
	public function save( int $post_id, string $json ): array {
		$config = json_decode( $json );
		if ( ! $config instanceof \stdClass ) {
			// JSON invalide ou racine qui n'est pas un objet : le validateur produit le message.
			return $this->validator->validate_json( $json );
		}

		try {
			$config = $this->migrator->migrate( $config );
		} catch ( \InvalidArgumentException $e ) {
			return array( $e->getMessage() );
		}

		$errors = $this->validator->validate( $config );
		if ( $errors ) {
			return $errors;
		}

		$normalized = (string) wp_json_encode( $config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		update_post_meta( $post_id, self::META_KEY, wp_slash( $normalized ) );
		return array();
	}

	/**
	 * Trouve un diagnostic par ID numérique ou par slug.
	 */
	public function find_id( string $id_or_slug ): ?int {
		if ( ctype_digit( $id_or_slug ) ) {
			$post = get_post( (int) $id_or_slug );
		} else {
			$post = get_page_by_path( sanitize_title( $id_or_slug ), OBJECT, DiagnosticPostType::NAME );
		}
		return $post instanceof \WP_Post && DiagnosticPostType::NAME === $post->post_type ? $post->ID : null;
	}
}
