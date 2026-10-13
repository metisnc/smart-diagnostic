<?php
/**
 * Validation d'une configuration contre schema/diagnostic.schema.json.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Config;

// Librairie embarquée sous un espace de noms préfixé (Strauss) : pas de conflit avec d'autres plugins.
use SmartDiagnostic\Vendor\Opis\JsonSchema\Errors\ErrorFormatter;
use SmartDiagnostic\Vendor\Opis\JsonSchema\Validator;

/**
 * Valide la config telle que décodée en objets (json_decode sans assoc) :
 * un objet vide `{}` reste un objet, ce qu'un tableau PHP ne garantit pas.
 */
final class SchemaValidator {

	public const SCHEMA_ID = 'https://github.com/metisnc/smart-diagnostic/schema/diagnostic.schema.json';

	private const MAX_ERRORS = 20;

	private ?Validator $validator = null;

	/**
	 * Valide une config JSON brute.
	 *
	 * @param string $json Config JSON.
	 * @return list<string> Erreurs lisibles ("chemin : message"), vide si valide.
	 */
	public function validate_json( string $json ): array {
		$data = json_decode( $json );
		if ( JSON_ERROR_NONE !== json_last_error() ) {
			/* translators: %s: JSON parser error message. */
			return array( sprintf( __( 'Invalid JSON: %s', 'smart-diagnostic' ), json_last_error_msg() ) );
		}
		return $this->validate( $data );
	}

	/**
	 * Valide une config déjà décodée (objets stdClass).
	 *
	 * @param mixed $data Config décodée.
	 * @return list<string>
	 */
	public function validate( mixed $data ): array {
		$result = $this->validator()->validate( $data, self::SCHEMA_ID );
		if ( $result->isValid() ) {
			return array();
		}

		$errors    = array();
		$formatted = ( new ErrorFormatter() )->format( $result->error(), true );
		foreach ( $formatted as $path => $messages ) {
			foreach ( (array) $messages as $message ) {
				$errors[] = ( '' === $path || '/' === $path ? '/' : $path ) . ' : ' . $message;
			}
		}
		return array_values( array_unique( $errors ) );
	}

	private function validator(): Validator {
		if ( null === $this->validator ) {
			$this->validator = new Validator();
			$this->validator->setMaxErrors( self::MAX_ERRORS );
			$this->validator->resolver()->registerFile( self::SCHEMA_ID, self::schema_path() );
		}
		return $this->validator;
	}

	public static function schema_path(): string {
		return SMART_DIAGNOSTIC_DIR . 'schema/diagnostic.schema.json';
	}
}
