<?php
/**
 * Conditions déclaratives (miroir de assets/src/engine/conditions.js).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Évalue all / any / not / expr et les comparaisons left / op / value.
 */
final class Conditions {

	/**
	 * @param array<string, mixed>|null $condition Condition (absente = vraie).
	 * @param Context                   $context   Contexte.
	 */
	public static function evaluate( ?array $condition, Context $context ): bool {
		if ( null === $condition || array() === $condition ) {
			return true;
		}
		if ( isset( $condition['all'] ) && is_array( $condition['all'] ) ) {
			foreach ( $condition['all'] as $item ) {
				if ( ! self::evaluate( $item, $context ) ) {
					return false;
				}
			}
			return true;
		}
		if ( isset( $condition['any'] ) && is_array( $condition['any'] ) ) {
			foreach ( $condition['any'] as $item ) {
				if ( self::evaluate( $item, $context ) ) {
					return true;
				}
			}
			return false;
		}
		if ( isset( $condition['not'] ) && is_array( $condition['not'] ) ) {
			return ! self::evaluate( $condition['not'], $context );
		}
		if ( isset( $condition['expr'] ) && is_string( $condition['expr'] ) ) {
			try {
				return Values::truthy( Expression::evaluate( $condition['expr'], $context->resolver() ) );
			} catch ( ExpressionError $e ) {
				return false;
			}
		}
		if ( isset( $condition['left'], $condition['op'] ) && is_string( $condition['left'] ) && is_string( $condition['op'] ) ) {
			return self::compare( $condition['op'], $context->resolve( $condition['left'] ), $condition['value'] ?? null );
		}
		return false;
	}

	/**
	 * @return list<mixed>
	 */
	private static function as_list( mixed $value ): array {
		return Values::is_list( $value ) ? $value : array( $value );
	}

	private static function compare( string $op, mixed $left, mixed $value ): bool {
		switch ( $op ) {
			case 'eq':
				if ( Values::is_list( $left ) ) {
					foreach ( $left as $item ) {
						if ( Values::loose_equals( $item, $value ) ) {
							return true;
						}
					}
					return false;
				}
				return Values::loose_equals( $left, $value );
			case 'neq':
				return ! self::compare( 'eq', $left, $value );
			case 'gt':
				return Values::to_number( $left ) > Values::to_number( $value );
			case 'gte':
				return Values::to_number( $left ) >= Values::to_number( $value );
			case 'lt':
				return Values::to_number( $left ) < Values::to_number( $value );
			case 'lte':
				return Values::to_number( $left ) <= Values::to_number( $value );
			case 'between':
				$bounds = self::as_list( $value );
				$n      = Values::to_number( $left );
				return $n >= Values::to_number( $bounds[0] ?? null ) && $n <= Values::to_number( $bounds[1] ?? null );
			case 'in':
				foreach ( self::as_list( $left ) as $item ) {
					foreach ( self::as_list( $value ) as $candidate ) {
						if ( Values::loose_equals( $item, $candidate ) ) {
							return true;
						}
					}
				}
				return false;
			case 'notIn':
				return ! self::compare( 'in', $left, $value );
			case 'contains':
				if ( is_string( $left ) ) {
					return str_contains( $left, Values::to_string( $value ) );
				}
				foreach ( self::as_list( $left ?? array() ) as $item ) {
					if ( Values::loose_equals( $item, $value ) ) {
						return true;
					}
				}
				return false;
			case 'notContains':
				return ! self::compare( 'contains', $left, $value );
			case 'answered':
				return ! Values::is_empty( $left );
			case 'empty':
				return Values::is_empty( $left );
		}
		return false;
	}
}
