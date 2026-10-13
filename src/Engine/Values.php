<?php
/**
 * Conversions et comparaisons partagées (miroir de assets/src/engine/values.js).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Règles identiques en JS et en PHP : c'est ce qui garantit la parité des calculs.
 */
final class Values {

	public const NUMERIC = '/^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/';

	public static function is_numeric( mixed $value ): bool {
		if ( is_int( $value ) ) {
			return true;
		}
		if ( is_float( $value ) ) {
			return is_finite( $value );
		}
		return is_string( $value ) && 1 === preg_match( self::NUMERIC, $value );
	}

	public static function to_number( mixed $value ): float {
		if ( is_bool( $value ) ) {
			return $value ? 1.0 : 0.0;
		}
		return self::is_numeric( $value ) ? (float) $value : 0.0;
	}

	public static function is_empty( mixed $value ): bool {
		return null === $value || '' === $value || ( is_array( $value ) && array() === $value );
	}

	/**
	 * '0' est vrai, tableau vide faux (comme en JS dans le moteur).
	 */
	public static function truthy( mixed $value ): bool {
		if ( null === $value || false === $value ) {
			return false;
		}
		if ( is_int( $value ) || is_float( $value ) ) {
			return 0.0 !== (float) $value && ! is_nan( (float) $value );
		}
		if ( is_string( $value ) ) {
			return '' !== $value;
		}
		if ( is_array( $value ) ) {
			return array() !== $value;
		}
		return true;
	}

	/**
	 * Équivalent de String() en JS pour les valeurs scalaires et listes.
	 */
	public static function to_string( mixed $value ): string {
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( null === $value ) {
			return 'null';
		}
		if ( is_float( $value ) && floor( $value ) === $value && abs( $value ) < 1e15 ) {
			return (string) (int) $value;
		}
		if ( is_array( $value ) ) {
			return implode( ',', array_map( array( self::class, 'to_string' ), $value ) );
		}
		return (string) $value;
	}

	public static function loose_equals( mixed $a, mixed $b ): bool {
		if ( null === $a || null === $b ) {
			return $a === $b;
		}
		if ( is_bool( $a ) || is_bool( $b ) ) {
			return self::to_string( $a ) === self::to_string( $b );
		}
		if ( self::is_numeric( $a ) && self::is_numeric( $b ) ) {
			return (float) $a === (float) $b;
		}
		return self::to_string( $a ) === self::to_string( $b );
	}

	/**
	 * Une liste JSON (tableau) par opposition à un objet JSON.
	 */
	public static function is_list( mixed $value ): bool {
		return is_array( $value ) && array_is_list( $value );
	}
}
