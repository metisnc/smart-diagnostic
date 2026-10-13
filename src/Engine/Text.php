<?php
/**
 * Textes multilingues et variables de personnalisation côté serveur
 * (miroir de text.js et interpolate.js, pour les emails et l'admin).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Résolution d'un texte { langue: texte } et remplacement de {first_name}, {answer:x}…
 */
final class Text {

	/**
	 * @param mixed  $text     Texte de la config (chaîne ou objet par langue).
	 * @param string $lang     Langue demandée.
	 * @param string $fallback Langue par défaut.
	 */
	public static function resolve( mixed $text, string $lang = '', string $fallback = '' ): string {
		if ( is_string( $text ) ) {
			return $text;
		}
		if ( ! is_array( $text ) || array() === $text ) {
			return '';
		}
		$short = explode( '_', $lang )[0];
		foreach ( array( $lang, $short, $fallback ) as $key ) {
			if ( '' !== $key && isset( $text[ $key ] ) && is_string( $text[ $key ] ) ) {
				return $text[ $key ];
			}
		}
		foreach ( $text as $value ) {
			if ( is_string( $value ) ) {
				return $value;
			}
		}
		return '';
	}

	/**
	 * Remplace les variables à partir d'une soumission enregistrée.
	 *
	 * @param string               $text       Texte résolu.
	 * @param array<string, mixed> $config     Config.
	 * @param array<string, mixed> $submission Soumission (answers, contact, scores, vars, lang).
	 */
	public static function interpolate( string $text, array $config, array $submission ): string {
		if ( ! str_contains( $text, '{' ) ) {
			return $text;
		}
		$lang     = (string) ( $submission['lang'] ?? '' );
		$fallback = (string) ( $config['i18n']['defaultLanguage'] ?? '' );
		$answers  = (array) ( $submission['answers'] ?? array() );
		$contact  = (array) ( $submission['contact'] ?? array() );
		$scores   = (array) ( $submission['scores'] ?? array() );
		$vars     = (array) ( $submission['vars'] ?? array() );

		return (string) preg_replace_callback(
			'/\{(first_name|(answer|score|var|contact):([a-z][a-z0-9_]*))\}/',
			static function ( array $m ) use ( $config, $submission, $answers, $contact, $scores, $vars, $lang, $fallback ): string {
				if ( 'first_name' === $m[1] ) {
					$name = $contact['first_name'] ?? $answers['first_name'] ?? $submission['first_name'] ?? '';
					return is_string( $name ) ? trim( $name ) : '';
				}
				$key = $m[3];
				switch ( $m[2] ) {
					case 'answer':
						return self::display_answer( $config, $key, $answers[ $key ] ?? null, $lang, $fallback );
					case 'score':
						return isset( $scores[ $key ] ) && is_numeric( $scores[ $key ] ) ? (string) round( (float) $scores[ $key ] ) : '';
					case 'var':
						return isset( $vars[ $key ] ) && is_scalar( $vars[ $key ] ) ? Values::to_string( $vars[ $key ] ) : '';
					case 'contact':
						return isset( $contact[ $key ] ) && is_scalar( $contact[ $key ] ) ? (string) $contact[ $key ] : '';
				}
				return $m[0];
			},
			$text
		);
	}

	/**
	 * Réponse affichable : libellé de l'option pour les choix.
	 *
	 * @param array<string, mixed> $config   Config.
	 * @param string               $key      Clé d'étape.
	 * @param mixed                $value    Réponse.
	 * @param string               $lang     Langue.
	 * @param string               $fallback Langue par défaut.
	 */
	public static function display_answer( array $config, string $key, mixed $value, string $lang = '', string $fallback = '' ): string {
		if ( null === $value ) {
			return '';
		}
		$options = array();
		foreach ( $config['steps'] ?? array() as $step ) {
			if ( $step['key'] === $key ) {
				$options = $step['options'] ?? array();
				break;
			}
		}
		$label = static function ( mixed $item ) use ( $options, $lang, $fallback ): string {
			foreach ( $options as $option ) {
				if ( $option['value'] === $item ) {
					return self::resolve( $option['label'] ?? '', $lang, $fallback );
				}
			}
			return is_scalar( $item ) ? Values::to_string( $item ) : '';
		};
		if ( Values::is_list( $value ) ) {
			return implode( ', ', array_map( $label, $value ) );
		}
		if ( is_array( $value ) ) {
			return implode( ', ', array_map( static fn( $item ) => is_scalar( $item ) ? (string) $item : '', $value ) );
		}
		return $label( $value );
	}
}
