<?php
/**
 * Calcul du résultat (miroir de assets/src/engine/calculator.js) : source de vérité.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Chemin → scores par axe → variables → profil, textes, actions, CTA.
 */
final class Calculator {

	private const CHOICE_TYPES = array( 'single', 'multi', 'dropdown', 'image_choice', 'yes_no' );

	/**
	 * Calcul complet à partir des réponses brutes.
	 *
	 * @param array<string, mixed> $config      Config (tableaux associatifs).
	 * @param array<string, mixed> $raw_answers Réponses brutes.
	 * @param array<string, mixed> $contact     Contact.
	 * @return array{path: list<string>, scores: array<string, float>, vars: array<string, mixed>, profile: ?string, texts: list<string>, actions: list<string>, cta: ?string}
	 */
	public static function compute( array $config, array $raw_answers, array $contact = array() ): array {
		$path     = Flow::compute_path(
			$config,
			$raw_answers,
			static fn( array $answers ): Context => new Context( $config, $answers, $contact )
		);
		$answers  = Flow::answers_on_path( $path, $raw_answers );
		$scores   = self::compute_scores( $config, $answers, $contact );
		$vars     = self::compute_variables( $config, $answers, $contact, $scores );
		$context  = new Context( $config, $answers, $contact, $scores, $vars );
		$outcomes = $config['outcomes'] ?? array();
		$matches  = static fn( array $item ): bool => Conditions::evaluate( $item['when'] ?? null, $context );

		$profiles = array_values( array_filter( self::by_priority( $outcomes['profiles'] ?? array() ), $matches ) );
		$ctas     = array_values( array_filter( self::by_priority( $outcomes['ctas'] ?? array() ), $matches ) );

		return array(
			'path'    => $path,
			'scores'  => $scores,
			'vars'    => $vars,
			'profile' => $profiles[0]['key'] ?? null,
			'texts'   => self::matching_keys( $outcomes['texts'] ?? array(), $matches ),
			'actions' => self::matching_keys( $outcomes['actions'] ?? array(), $matches ),
			'cta'     => $ctas[0]['key'] ?? null,
		);
	}

	/**
	 * @param array<string, mixed> $step   Étape.
	 * @param mixed                $answer Réponse.
	 * @return list<mixed>
	 */
	private static function selected_values( array $step, mixed $answer ): array {
		if ( 'multi' === ( $step['type'] ?? null ) ) {
			return Values::is_list( $answer ) ? $answer : array();
		}
		return Values::is_empty( $answer ) ? array() : array( $answer );
	}

	/**
	 * @param array<string, mixed> $step  Étape.
	 * @param mixed                $value Valeur.
	 * @return array<string, mixed>|null
	 */
	private static function find_option( array $step, mixed $value ): ?array {
		foreach ( $step['options'] ?? array() as $option ) {
			if ( $option['value'] === $value ) {
				return $option;
			}
		}
		return null;
	}

	/**
	 * Option de sortie (exit présent, même vide : comme `option.exit` en JS).
	 *
	 * @param array<string, mixed> $step  Étape.
	 * @param mixed                $value Valeur choisie.
	 */
	private static function is_exit_option( array $step, mixed $value ): bool {
		$option = self::find_option( $step, $value );
		return null !== $option && isset( $option['exit'] );
	}

	/**
	 * Réponse composée uniquement de réponses de sortie (« Je ne sais pas »).
	 *
	 * @param array<string, mixed> $step   Étape.
	 * @param mixed                $answer Réponse.
	 */
	public static function is_exit_answer( array $step, mixed $answer ): bool {
		$values = self::selected_values( $step, $answer );
		if ( array() === $values ) {
			return false;
		}
		foreach ( $values as $value ) {
			if ( ! self::is_exit_option( $step, $value ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * @param array<string, mixed> $step Étape.
	 * @param array<string, mixed> $exit_setting Réglage de sortie.
	 * @return array<string, float>
	 */
	private static function exit_points( array $step, array $exit_setting ): array {
		$mode = $exit_setting['mode'] ?? 'ignore';
		if ( 'ignore' === $mode ) {
			return array();
		}
		$regular = array_values( array_filter( $step['options'] ?? array(), static fn( array $option ): bool => ! isset( $option['exit'] ) ) );
		$axes    = array();
		foreach ( $regular as $option ) {
			foreach ( array_keys( $option['scores'] ?? array() ) as $axis ) {
				$axes[ $axis ] = true;
			}
		}
		$points = array();
		foreach ( array_keys( $axes ) as $axis ) {
			$values = array_map( static fn( array $option ): float => (float) ( $option['scores'][ $axis ] ?? 0 ), $regular );
			if ( 'neutral' === $mode ) {
				$points[ $axis ] = array_sum( $values ) / count( $values );
			} elseif ( 'min' === $mode ) {
				$points[ $axis ] = min( $values );
			} elseif ( 'fixed' === $mode ) {
				$points[ $axis ] = Values::to_number( $exit_setting['value'] ?? null );
			}
		}
		return $points;
	}

	/**
	 * @param list<array<string, mixed>> $ranges Plages (min inclus, max exclu).
	 * @return array<string, mixed>|null
	 */
	private static function pick_range( array $ranges, float $value ): ?array {
		foreach ( $ranges as $range ) {
			if ( ( ! isset( $range['min'] ) || $value >= $range['min'] ) && ( ! isset( $range['max'] ) || $value < $range['max'] ) ) {
				return $range;
			}
		}
		return null;
	}

	/**
	 * Scores par axe.
	 *
	 * @param array<string, mixed> $config  Config.
	 * @param array<string, mixed> $answers Réponses des étapes parcourues.
	 * @param array<string, mixed> $contact Contact.
	 * @return array<string, float>
	 */
	public static function compute_scores( array $config, array $answers, array $contact = array() ): array {
		$scores = array();
		foreach ( $config['axes'] ?? array() as $axis ) {
			$scores[ $axis['key'] ] = (float) ( $axis['base'] ?? 0 );
		}
		$add          = static function ( string $axis, mixed $points ) use ( &$scores ): void {
			if ( array_key_exists( $axis, $scores ) ) {
				$scores[ $axis ] += Values::to_number( $points );
			}
		};
		$steps_by_key = array();
		foreach ( $config['steps'] ?? array() as $step ) {
			$steps_by_key[ $step['key'] ] = $step;
		}

		// 1. Points des options choisies.
		foreach ( $config['steps'] ?? array() as $step ) {
			if ( 'question' !== ( $step['kind'] ?? null ) || ! in_array( $step['type'] ?? null, self::CHOICE_TYPES, true ) ) {
				continue;
			}
			foreach ( self::selected_values( $step, $answers[ $step['key'] ] ?? null ) as $value ) {
				$option = self::find_option( $step, $value );
				if ( null === $option ) {
					continue;
				}
				$points = isset( $option['exit'] ) ? self::exit_points( $step, $option['exit'] ) : ( $option['scores'] ?? array() );
				foreach ( $points as $axis => $axis_points ) {
					$add( (string) $axis, $axis_points );
				}
			}
		}

		// 2. Règles, dans l'ordre ; les conditions voient les scores intermédiaires.
		foreach ( $config['scoring']['rules'] ?? array() as $rule ) {
			$axis = $rule['axis'] ?? '';
			if ( ! array_key_exists( $axis, $scores ) ) {
				continue;
			}
			$context = new Context( $config, $answers, $contact, $scores );
			if ( ! Conditions::evaluate( $rule['when'] ?? null, $context ) ) {
				continue;
			}
			switch ( $rule['type'] ?? '' ) {
				case 'range':
					$step   = $steps_by_key[ $rule['question'] ?? '' ] ?? null;
					$answer = $answers[ $rule['question'] ?? '' ] ?? null;
					if ( null === $step || self::is_exit_answer( $step, $answer ) ) {
						break;
					}
					$value = Context::answer_value( $step, $answer );
					if ( ! Values::is_numeric( $value ) ) {
						break;
					}
					$range = self::pick_range( $rule['ranges'] ?? array(), (float) $value );
					if ( null !== $range ) {
						$add( $axis, $range['points'] );
					}
					break;
				case 'count':
					$step = $steps_by_key[ $rule['question'] ?? '' ] ?? null;
					if ( null === $step ) {
						break;
					}
					$count = 0;
					foreach ( self::selected_values( $step, $answers[ $rule['question'] ] ?? null ) as $value ) {
						if ( ! self::is_exit_option( $step, $value ) ) {
							++$count;
						}
					}
					$range = self::pick_range( $rule['ranges'] ?? array(), (float) $count );
					if ( null !== $range ) {
						$add( $axis, $range['points'] );
					}
					break;
				case 'condition':
					$points = $rule['points'] ?? 0;
					if ( is_string( $points ) ) {
						$points = self::safe_evaluate( $points, $context );
					}
					$add( $axis, $points );
					break;
				case 'multiplier':
					$scores[ $axis ] *= Values::to_number( $rule['factor'] ?? 1 );
					break;
				case 'cap':
					if ( isset( $rule['min'] ) ) {
						$scores[ $axis ] = max( $scores[ $axis ], (float) $rule['min'] );
					}
					if ( isset( $rule['max'] ) ) {
						$scores[ $axis ] = min( $scores[ $axis ], (float) $rule['max'] );
					}
					break;
			}
		}

		// 3. Clamp final sur [min, max] de chaque axe.
		foreach ( $config['axes'] ?? array() as $axis ) {
			$scores[ $axis['key'] ] = min( max( $scores[ $axis['key'] ], (float) ( $axis['min'] ?? 0 ) ), (float) ( $axis['max'] ?? 100 ) );
		}
		return $scores;
	}

	private static function safe_evaluate( string $expression, Context $context ): mixed {
		try {
			return Expression::evaluate( $expression, $context->resolver() );
		} catch ( ExpressionError $e ) {
			return null;
		}
	}

	/**
	 * Variables calculées, dans l'ordre.
	 *
	 * @param array<string, mixed> $config  Config.
	 * @param array<string, mixed> $answers Réponses.
	 * @param array<string, mixed> $contact Contact.
	 * @param array<string, float> $scores  Scores.
	 * @return array<string, mixed>
	 */
	public static function compute_variables( array $config, array $answers, array $contact, array $scores ): array {
		$vars = array();
		foreach ( $config['variables'] ?? array() as $variable ) {
			$value                    = self::safe_evaluate( (string) $variable['expr'], new Context( $config, $answers, $contact, $scores, $vars ) );
			$vars[ $variable['key'] ] = is_float( $value ) && ! is_finite( $value ) ? null : $value;
		}
		return $vars;
	}

	/**
	 * Tri stable par priorité décroissante.
	 *
	 * @param list<array<string, mixed>> $items Éléments.
	 * @return list<array<string, mixed>>
	 */
	private static function by_priority( array $items ): array {
		usort( $items, static fn( array $a, array $b ): int => ( $b['priority'] ?? 0 ) <=> ( $a['priority'] ?? 0 ) );
		return $items;
	}

	/**
	 * @param list<array<string, mixed>>           $items   Éléments.
	 * @param callable(array<string, mixed>): bool $matches Filtre.
	 * @return list<string>
	 */
	private static function matching_keys( array $items, callable $matches ): array {
		return array_values(
			array_map(
				static fn( array $item ): string => $item['key'],
				array_filter( self::by_priority( $items ), $matches )
			)
		);
	}
}
