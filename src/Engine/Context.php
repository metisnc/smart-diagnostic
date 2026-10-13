<?php
/**
 * Contexte d'évaluation (miroir de assets/src/engine/context.js).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Expose réponses, scores, variables et contact sous forme de chemins.
 */
final class Context {

	/**
	 * @var array<string, array<string, mixed>>
	 */
	private array $steps_by_key = array();

	/**
	 * @param array<string, mixed> $config  Config (tableaux associatifs).
	 * @param array<string, mixed> $answers Réponses.
	 * @param array<string, mixed> $contact Contact.
	 * @param array<string, mixed> $scores  Scores.
	 * @param array<string, mixed> $vars    Variables.
	 */
	public function __construct(
		private array $config,
		private array $answers,
		private array $contact = array(),
		private array $scores = array(),
		private array $vars = array()
	) {
		foreach ( $config['steps'] ?? array() as $step ) {
			$this->steps_by_key[ $step['key'] ] = $step;
		}
	}

	/**
	 * Valeur logique d'une réponse : agrégat pour multi_amount.
	 *
	 * @param array<string, mixed>|null $step   Étape.
	 * @param mixed                     $answer Réponse.
	 */
	public static function answer_value( ?array $step, mixed $answer ): mixed {
		if ( null !== $step && 'multi_amount' === ( $step['type'] ?? null ) && is_array( $answer ) ) {
			$values = array_map( 'floatval', array_values( array_filter( $answer, array( Values::class, 'is_numeric' ) ) ) );
			if ( array() === $values ) {
				return null;
			}
			return match ( $step['aggregate'] ?? 'sum' ) {
				'avg'   => array_sum( $values ) / count( $values ),
				'min'   => min( $values ),
				'max'   => max( $values ),
				default => array_sum( $values ),
			};
		}
		return $answer;
	}

	public function resolve( string $path ): mixed {
		if ( 'weakestAxis' === $path ) {
			return $this->axis_extreme( true );
		}
		if ( 'strongestAxis' === $path ) {
			return $this->axis_extreme( false );
		}
		$parts = explode( '.', $path );
		$root  = $parts[0];
		$key   = $parts[1] ?? '';
		$rest  = array_slice( $parts, 2 );

		switch ( $root ) {
			case 'answer':
				$value = array() !== $rest ? ( $this->answers[ $key ] ?? null ) : self::answer_value( $this->steps_by_key[ $key ] ?? null, $this->answers[ $key ] ?? null );
				break;
			case 'count':
				$answer = $this->answers[ $key ] ?? null;
				return Values::is_list( $answer ) ? count( $answer ) : 0;
			case 'score':
				$value = $this->scores[ $key ] ?? null;
				break;
			case 'var':
				$value = $this->vars[ $key ] ?? null;
				break;
			case 'contact':
				$value = $this->contact[ $key ] ?? null;
				break;
			default:
				return null;
		}

		foreach ( $rest as $part ) {
			$value = is_array( $value ) && array_key_exists( $part, $value ) ? $value[ $part ] : null;
		}
		return $value;
	}

	/**
	 * @return callable(string): mixed
	 */
	public function resolver(): callable {
		return array( $this, 'resolve' );
	}

	private function axis_extreme( bool $pick_lowest ): ?string {
		$best       = null;
		$best_ratio = 0.0;
		foreach ( $this->config['axes'] ?? array() as $axis ) {
			$value = $this->scores[ $axis['key'] ] ?? null;
			if ( ! is_int( $value ) && ! is_float( $value ) ) {
				continue;
			}
			$min   = $axis['min'] ?? 0;
			$span  = ( ( $axis['max'] ?? 100 ) - $min ) ?: 1; // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
			$ratio = ( $value - $min ) / $span;
			if ( null === $best || ( $pick_lowest ? $ratio < $best_ratio : $ratio > $best_ratio ) ) {
				$best       = $axis['key'];
				$best_ratio = $ratio;
			}
		}
		return $best;
	}
}
