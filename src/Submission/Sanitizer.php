<?php
/**
 * Nettoyage et validation serveur des réponses et du contact, selon la config.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Submission;

use SmartDiagnostic\Engine\Context;
use SmartDiagnostic\Engine\Values;

/**
 * Seules les clés connues de la config sont conservées ; chaque valeur est
 * convertie dans le type attendu. La validation reprend validate.js.
 */
final class Sanitizer {

	private const NUMERIC_TYPES = array( 'number', 'amount', 'slider', 'scale' );
	private const CHOICE_TYPES  = array( 'single', 'dropdown', 'image_choice', 'yes_no' );
	private const MAX_TEXT      = 1000;
	private const MAX_TEXTAREA  = 5000;
	private const EMAIL         = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';
	private const PHONE         = '/^\+?[0-9 ().-]{6,20}$/';

	/**
	 * @param array<string, mixed> $config Config.
	 * @param mixed                $raw    Réponses reçues.
	 * @return array<string, mixed>
	 */
	public function answers( array $config, mixed $raw ): array {
		$raw   = is_array( $raw ) ? $raw : array();
		$clean = array();
		foreach ( $config['steps'] ?? array() as $step ) {
			if ( 'question' !== ( $step['kind'] ?? '' ) || ! array_key_exists( $step['key'], $raw ) ) {
				continue;
			}
			$value = $this->answer( $step, $raw[ $step['key'] ] );
			if ( null !== $value ) {
				$clean[ $step['key'] ] = $value;
			}
		}
		return $clean;
	}

	/**
	 * @param array<string, mixed> $step  Étape question.
	 * @param mixed                $value Valeur reçue.
	 */
	private function answer( array $step, mixed $value ): mixed {
		$type = $step['type'] ?? 'text';

		if ( in_array( $type, self::CHOICE_TYPES, true ) ) {
			return $this->option_value( $step, $value );
		}
		if ( 'multi' === $type ) {
			if ( ! Values::is_list( $value ) ) {
				return null;
			}
			$selected = array();
			foreach ( $value as $item ) {
				$option = $this->option_value( $step, $item );
				if ( null !== $option && ! in_array( $option, $selected, true ) ) {
					$selected[] = $option;
				}
			}
			return $selected;
		}
		if ( in_array( $type, self::NUMERIC_TYPES, true ) ) {
			return Values::is_numeric( $value ) ? (float) $value : null;
		}
		if ( 'multi_amount' === $type ) {
			if ( ! is_array( $value ) ) {
				return null;
			}
			$fields = array();
			foreach ( $step['fields'] ?? array() as $field ) {
				$item                    = $value[ $field['key'] ] ?? null;
				$fields[ $field['key'] ] = Values::is_numeric( $item ) ? (float) $item : null;
			}
			return $fields;
		}
		if ( ! is_scalar( $value ) ) {
			return null;
		}
		$value = (string) $value;
		switch ( $type ) {
			case 'textarea':
				return mb_substr( sanitize_textarea_field( $value ), 0, self::MAX_TEXTAREA );
			case 'email':
				return sanitize_email( $value );
			case 'phone':
				return mb_substr( (string) preg_replace( '/[^0-9 +().-]/', '', $value ), 0, 30 );
			case 'date':
				return 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : null;
			default:
				return mb_substr( sanitize_text_field( $value ), 0, self::MAX_TEXT );
		}
	}

	/**
	 * Valeur d'option existante (comparaison stricte), ou null.
	 *
	 * @param array<string, mixed> $step  Étape.
	 * @param mixed                $value Valeur reçue.
	 */
	private function option_value( array $step, mixed $value ): mixed {
		$options = $step['options'] ?? array();
		if ( 'yes_no' === ( $step['type'] ?? '' ) && array() === $options ) {
			$options = array( array( 'value' => true ), array( 'value' => false ) );
		}
		foreach ( $options as $option ) {
			if ( $option['value'] === $value ) {
				return $value;
			}
		}
		return null;
	}

	/**
	 * Erreurs de validation des questions du chemin (clé d'étape → clé de message).
	 *
	 * @param array<string, mixed> $config  Config.
	 * @param array<string, mixed> $answers Réponses nettoyées.
	 * @param list<string>         $path    Étapes parcourues.
	 * @return array<string, string>
	 */
	public function validate_answers( array $config, array $answers, array $path ): array {
		$errors = array();
		foreach ( $config['steps'] ?? array() as $step ) {
			if ( 'question' !== ( $step['kind'] ?? '' ) || ! in_array( $step['key'], $path, true ) ) {
				continue;
			}
			$error = $this->validate_answer( $step, $answers[ $step['key'] ] ?? null );
			if ( null !== $error ) {
				$errors[ $step['key'] ] = $error;
			}
		}
		return $errors;
	}

	/**
	 * Miroir de validateAnswer() (assets/src/engine/validate.js).
	 *
	 * @param array<string, mixed> $step  Étape.
	 * @param mixed                $value Valeur nettoyée.
	 */
	public function validate_answer( array $step, mixed $value ): ?string {
		$rules    = $step['validation'] ?? array();
		$required = ( $step['required'] ?? true ) !== false;
		$type     = $step['type'] ?? 'text';

		$empty = Values::is_empty( $value );
		if ( 'multi_amount' === $type && is_array( $value ) ) {
			$empty = null === Context::answer_value( $step, $value );
		}
		if ( $empty ) {
			return $required ? 'required' : null;
		}

		if ( 'email' === $type && 1 !== preg_match( self::EMAIL, trim( (string) $value ) ) ) {
			return 'invalidEmail';
		}
		if ( 'phone' === $type && 1 !== preg_match( self::PHONE, trim( (string) $value ) ) ) {
			return 'invalidPhone';
		}
		if ( in_array( $type, self::NUMERIC_TYPES, true ) ) {
			return $this->validate_number( (float) $value, $rules );
		}
		if ( 'multi_amount' === $type ) {
			foreach ( (array) $value as $field_value ) {
				if ( null !== $field_value ) {
					$error = $this->validate_number( (float) $field_value, $rules );
					if ( null !== $error ) {
						return $error;
					}
				}
			}
			return null;
		}
		if ( 'multi' === $type ) {
			$count = count( (array) $value );
			if ( isset( $rules['minSelected'] ) && $count < $rules['minSelected'] ) {
				return 'minSelected';
			}
			if ( isset( $rules['maxSelected'] ) && $count > $rules['maxSelected'] ) {
				return 'maxSelected';
			}
			return null;
		}
		if ( is_string( $value ) ) {
			$length = mb_strlen( trim( $value ) );
			if ( isset( $rules['minLength'] ) && $length < $rules['minLength'] ) {
				return 'minLength';
			}
			if ( isset( $rules['maxLength'] ) && $length > $rules['maxLength'] ) {
				return 'maxLength';
			}
			if ( ! empty( $rules['pattern'] ) ) {
				$pattern = '/' . str_replace( '/', '\/', (string) $rules['pattern'] ) . '/u';
				$match   = @preg_match( $pattern, $value ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- motif saisi par l'admin.
				if ( 0 === $match ) {
					return 'pattern';
				}
			}
		}
		return null;
	}

	/**
	 * @param float                $number Valeur.
	 * @param array<string, mixed> $rules  Règles.
	 */
	private function validate_number( float $number, array $rules ): ?string {
		if ( isset( $rules['min'] ) && $number < $rules['min'] ) {
			return 'min';
		}
		if ( isset( $rules['max'] ) && $number > $rules['max'] ) {
			return 'max';
		}
		return null;
	}

	/**
	 * Formulaires concernés : ceux du chemin (inline) ou ceux affichés sous le résultat.
	 *
	 * @param array<string, mixed> $config    Config.
	 * @param list<string>         $path      Chemin.
	 * @param string               $placement inline | after_results.
	 * @return list<array<string, mixed>>
	 */
	public function forms( array $config, array $path, string $placement ): array {
		$forms = array();
		foreach ( $config['steps'] ?? array() as $step ) {
			if ( 'form' !== ( $step['kind'] ?? '' ) ) {
				continue;
			}
			$step_placement = $step['placement'] ?? 'inline';
			if ( $step_placement !== $placement ) {
				continue;
			}
			if ( 'inline' === $placement && ! in_array( $step['key'], $path, true ) ) {
				continue;
			}
			$forms[] = $step;
		}
		return $forms;
	}

	/**
	 * Nettoie le contact et le valide.
	 *
	 * @param list<array<string, mixed>> $forms   Formulaires concernés.
	 * @param mixed                      $raw     Contact reçu.
	 * @param bool                       $consent Consentement coché.
	 * @return array{contact: array<string, mixed>, errors: array<string, string>, consent_version: string}
	 */
	public function contact( array $forms, mixed $raw, bool $consent ): array {
		$raw             = is_array( $raw ) ? $raw : array();
		$contact         = array();
		$errors          = array();
		$consent_version = '';

		foreach ( $forms as $form ) {
			foreach ( $form['fields'] ?? array() as $field ) {
				$key   = $field['key'];
				$value = $this->contact_value( $field, $raw[ $key ] ?? null );
				if ( null !== $value && '' !== $value && false !== $value ) {
					$contact[ $key ] = $value;
				} elseif ( ! empty( $field['required'] ) ) {
					$errors[ $key ] = 'required';
				}
				if ( 'email' === $field['type'] && isset( $contact[ $key ] ) && ! is_email( $contact[ $key ] ) ) {
					$errors[ $key ] = 'invalidEmail';
				}
				if ( 'phone' === $field['type'] && isset( $contact[ $key ] ) && 1 !== preg_match( self::PHONE, (string) $contact[ $key ] ) ) {
					$errors[ $key ] = 'invalidPhone';
				}
			}
			if ( isset( $form['consent'] ) ) {
				$consent_version = (string) ( $form['consent']['version'] ?? '' );
				if ( ( $form['consent']['required'] ?? true ) !== false && ! $consent ) {
					$errors['__consent'] = 'consentRequired';
				}
			}
		}

		return array(
			'contact'         => $contact,
			'errors'          => $errors,
			'consent_version' => $consent_version,
		);
	}

	/**
	 * @param array<string, mixed> $field Champ.
	 * @param mixed                $value Valeur reçue.
	 */
	private function contact_value( array $field, mixed $value ): mixed {
		if ( 'checkbox' === $field['type'] ) {
			return true === $value;
		}
		if ( ! is_scalar( $value ) ) {
			return null;
		}
		$value = (string) $value;
		switch ( $field['type'] ) {
			case 'email':
				return sanitize_email( $value );
			case 'phone':
				return mb_substr( trim( (string) preg_replace( '/[^0-9 +().-]/', '', $value ) ), 0, 30 );
			case 'textarea':
				return mb_substr( sanitize_textarea_field( $value ), 0, self::MAX_TEXTAREA );
			case 'select':
				foreach ( $field['options'] ?? array() as $option ) {
					if ( (string) $option['value'] === $value ) {
						return $value;
					}
				}
				return null;
			default:
				return mb_substr( sanitize_text_field( $value ), 0, self::MAX_TEXT );
		}
	}
}
