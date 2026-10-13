<?php
/**
 * Navigation dans le parcours (miroir de assets/src/engine/flow.js).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Le serveur rejoue le parcours à partir des réponses pour savoir quelles étapes comptent.
 */
final class Flow {

	public const RESULTS = 'results';

	/**
	 * @param array<string, mixed> $config Config.
	 * @return list<array<string, mixed>>
	 */
	public static function flow_steps( array $config ): array {
		return array_values(
			array_filter(
				$config['steps'] ?? array(),
				static fn( array $step ): bool => ! ( 'form' === ( $step['kind'] ?? '' ) && 'after_results' === ( $step['placement'] ?? '' ) )
			)
		);
	}

	/**
	 * @param list<array<string, mixed>> $steps Étapes.
	 */
	private static function first_visible_from( array $steps, int $index, Context $context ): string {
		$count = count( $steps );
		for ( $i = $index; $i < $count; $i++ ) {
			if ( Conditions::evaluate( $steps[ $i ]['showIf'] ?? null, $context ) ) {
				return $steps[ $i ]['key'];
			}
		}
		return self::RESULTS;
	}

	/**
	 * @param array<string, mixed> $config Config.
	 */
	public static function first_step_key( array $config, Context $context ): string {
		return self::first_visible_from( self::flow_steps( $config ), 0, $context );
	}

	/**
	 * @param array<string, mixed> $config Config.
	 */
	public static function next_step_key( array $config, string $current_key, Context $context ): string {
		$steps = self::flow_steps( $config );
		$index = self::index_of( $steps, $current_key );
		if ( -1 === $index ) {
			return self::RESULTS;
		}

		$target = self::resolve_jump( $steps[ $index ]['jumpTo'] ?? null, $context );
		if ( self::RESULTS === $target ) {
			return self::RESULTS;
		}
		if ( null !== $target ) {
			$target_index = self::index_of( $steps, $target );
			if ( -1 !== $target_index ) {
				return self::first_visible_from( $steps, $target_index, $context );
			}
		}
		return self::first_visible_from( $steps, $index + 1, $context );
	}

	/**
	 * @param list<array<string, mixed>> $steps Étapes.
	 */
	private static function index_of( array $steps, string $key ): int {
		foreach ( $steps as $i => $step ) {
			if ( $step['key'] === $key ) {
				return $i;
			}
		}
		return -1;
	}

	private static function resolve_jump( mixed $jump_to, Context $context ): ?string {
		if ( is_string( $jump_to ) && '' !== $jump_to ) {
			return $jump_to;
		}
		if ( is_array( $jump_to ) ) {
			foreach ( $jump_to as $rule ) {
				if ( Conditions::evaluate( $rule['if'] ?? null, $context ) ) {
					return $rule['to'];
				}
			}
		}
		return null;
	}

	/**
	 * Rejoue le parcours : clés des étapes traversées.
	 *
	 * @param array<string, mixed>                    $config  Config.
	 * @param array<string, mixed>                    $answers Réponses brutes.
	 * @param callable(array<string, mixed>): Context $context_factory Réponses → contexte.
	 * @return list<string>
	 */
	public static function compute_path( array $config, array $answers, callable $context_factory ): array {
		$path = array();
		$seen = array();
		$key  = self::first_step_key( $config, $context_factory( array() ) );
		while ( self::RESULTS !== $key && ! isset( $seen[ $key ] ) ) {
			$seen[ $key ] = true;
			$path[]       = $key;
			$key          = self::next_step_key( $config, $key, $context_factory( self::answers_on_path( $path, $answers ) ) );
		}
		return $path;
	}

	/**
	 * @param list<string>         $path    Clés parcourues.
	 * @param array<string, mixed> $answers Réponses.
	 * @return array<string, mixed>
	 */
	public static function answers_on_path( array $path, array $answers ): array {
		$result = array();
		foreach ( $path as $key ) {
			if ( array_key_exists( $key, $answers ) ) {
				$result[ $key ] = $answers[ $key ];
			}
		}
		return $result;
	}
}
