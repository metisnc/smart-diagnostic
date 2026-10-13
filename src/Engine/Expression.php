<?php
/**
 * Évaluateur d'expressions sûr, sans eval (miroir de assets/src/engine/expression.js).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Engine;

/**
 * Grammaire et sémantique documentées dans expression.js. Toute évolution se fait
 * des deux côtés, avec un cas dans tests/fixtures/parity/expressions.json.
 */
final class Expression {

	private const MAX_LENGTH = 1000;

	private const OPERATORS = array( '==', '!=', '<=', '>=', '&&', '||', '<', '>', '+', '-', '*', '/', '%', '!', '?', ':', '(', ')', ',' );

	private const KEYWORDS = array(
		'and' => '&&',
		'or'  => '||',
		'not' => '!',
	);

	public const FUNCTIONS = array( 'min', 'max', 'abs', 'round', 'floor', 'ceil', 'clamp', 'sum', 'avg', 'count', 'if', 'isAnswered' );

	/**
	 * AST mis en cache par source.
	 *
	 * @var array<string, array<string, mixed>>
	 */
	private static array $cache = array();

	/**
	 * @var list<array{type: string, value?: mixed}>
	 */
	private array $tokens = array();

	private int $pos = 0;

	/**
	 * Évalue une expression.
	 *
	 * @param string                  $source  Expression.
	 * @param callable(string): mixed $resolve Résout un chemin (answer.x…) en valeur.
	 * @throws ExpressionError Expression invalide.
	 */
	public static function evaluate( string $source, callable $resolve ): mixed {
		if ( ! isset( self::$cache[ $source ] ) ) {
			self::$cache[ $source ] = self::parse( $source );
		}
		return self::evaluate_node( self::$cache[ $source ], $resolve );
	}

	/**
	 * @return array<string, mixed> AST.
	 * @throws ExpressionError Expression invalide.
	 */
	public static function parse( string $source ): array {
		$parser         = new self();
		$parser->tokens = self::tokenize( $source );
		$ast            = $parser->expression();
		if ( 'eof' !== $parser->peek()['type'] ) {
			throw new ExpressionError( 'Unexpected token after expression' );
		}
		return $ast;
	}

	/* ------------------------------------------------------------- Lexer */

	/**
	 * @return list<array{type: string, value?: mixed}>
	 * @throws ExpressionError Caractère inattendu.
	 */
	public static function tokenize( string $source ): array {
		if ( strlen( $source ) > self::MAX_LENGTH ) {
			throw new ExpressionError( 'Expression too long' );
		}
		$tokens = array();
		$length = strlen( $source );
		$i      = 0;
		while ( $i < $length ) {
			$ch   = $source[ $i ];
			$next = $source[ $i + 1 ] ?? '';
			if ( ctype_space( $ch ) ) {
				++$i;
				continue;
			}
			if ( ctype_digit( $ch ) || ( '.' === $ch && ctype_digit( $next ) ) ) {
				preg_match( '/\G[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/', $source, $m, 0, $i );
				$tokens[] = array(
					'type'  => 'number',
					'value' => (float) $m[0],
				);
				$i       += strlen( $m[0] );
				continue;
			}
			if ( '"' === $ch || "'" === $ch ) {
				$j     = $i + 1;
				$value = '';
				while ( $j < $length && $source[ $j ] !== $ch ) {
					if ( '\\' === $source[ $j ] && $j + 1 < $length ) {
						++$j;
					}
					$value .= $source[ $j ];
					++$j;
				}
				if ( $j >= $length ) {
					throw new ExpressionError( 'Unterminated string' );
				}
				$tokens[] = array(
					'type'  => 'string',
					'value' => $value,
				);
				$i        = $j + 1;
				continue;
			}
			if ( ctype_alpha( $ch ) || '_' === $ch ) {
				preg_match( '/\G[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/', $source, $m, 0, $i );
				$word = $m[0];
				$i   += strlen( $word );
				if ( isset( self::KEYWORDS[ $word ] ) ) {
					$tokens[] = array(
						'type'  => 'op',
						'value' => self::KEYWORDS[ $word ],
					);
				} elseif ( 'true' === $word || 'false' === $word ) {
					$tokens[] = array(
						'type'  => 'literal',
						'value' => 'true' === $word,
					);
				} elseif ( 'null' === $word ) {
					$tokens[] = array(
						'type'  => 'literal',
						'value' => null,
					);
				} else {
					$tokens[] = array(
						'type'  => 'name',
						'value' => $word,
					);
				}
				continue;
			}
			$op = null;
			foreach ( self::OPERATORS as $candidate ) {
				if ( substr( $source, $i, strlen( $candidate ) ) === $candidate ) {
					$op = $candidate;
					break;
				}
			}
			if ( null === $op ) {
				throw new ExpressionError( sprintf( 'Unexpected character "%s" at %d', $ch, $i ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
			}
			$tokens[] = array(
				'type'  => 'op',
				'value' => $op,
			);
			$i       += strlen( $op );
		}
		$tokens[] = array( 'type' => 'eof' );
		return $tokens;
	}

	/* ------------------------------------------------------------ Parser */

	/**
	 * @return array{type: string, value?: mixed}
	 */
	private function peek(): array {
		return $this->tokens[ $this->pos ];
	}

	private function is_op( string ...$values ): bool {
		$token = $this->peek();
		return 'op' === $token['type'] && in_array( $token['value'], $values, true );
	}

	private function expect_op( string $value ): void {
		if ( ! $this->is_op( $value ) ) {
			throw new ExpressionError( sprintf( 'Expected "%s"', $value ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}
		++$this->pos;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function expression(): array {
		$condition = $this->binary( 'or' );
		if ( $this->is_op( '?' ) ) {
			++$this->pos;
			$then = $this->expression();
			$this->expect_op( ':' );
			$otherwise = $this->expression();
			return array(
				'type'      => 'ternary',
				'condition' => $condition,
				'then'      => $then,
				'otherwise' => $otherwise,
			);
		}
		return $condition;
	}

	private const LEVELS = array(
		'or'       => array( 'and', array( '||' ) ),
		'and'      => array( 'not', array( '&&' ) ),
		'additive' => array( 'term', array( '+', '-' ) ),
		'term'     => array( 'unary', array( '*', '/', '%' ) ),
	);

	/**
	 * @return array<string, mixed>
	 */
	private function binary( string $level ): array {
		[ $next, $ops ] = self::LEVELS[ $level ];
		$left           = $this->level( $next );
		while ( $this->is_op( ...$ops ) ) {
			$op   = $this->tokens[ $this->pos++ ]['value'];
			$left = array(
				'type'  => 'binary',
				'op'    => $op,
				'left'  => $left,
				'right' => $this->level( $next ),
			);
		}
		return $left;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function level( string $name ): array {
		return match ( $name ) {
			'not'   => $this->not(),
			'unary' => $this->unary(),
			default => $this->binary( $name ),
		};
	}

	/**
	 * @return array<string, mixed>
	 */
	private function not(): array {
		if ( $this->is_op( '!' ) ) {
			++$this->pos;
			return array(
				'type'    => 'not',
				'operand' => $this->not(),
			);
		}
		$left = $this->binary( 'additive' );
		if ( $this->is_op( '==', '!=', '<', '<=', '>', '>=' ) ) {
			$op = $this->tokens[ $this->pos++ ]['value'];
			return array(
				'type'  => 'binary',
				'op'    => $op,
				'left'  => $left,
				'right' => $this->binary( 'additive' ),
			);
		}
		return $left;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function unary(): array {
		if ( $this->is_op( '-' ) ) {
			++$this->pos;
			return array(
				'type'    => 'negate',
				'operand' => $this->unary(),
			);
		}
		return $this->primary();
	}

	/**
	 * @return array<string, mixed>
	 * @throws ExpressionError Jeton inattendu ou fonction inconnue.
	 */
	private function primary(): array {
		$token = $this->peek();
		if ( in_array( $token['type'], array( 'number', 'string', 'literal' ), true ) ) {
			++$this->pos;
			return array(
				'type'  => 'literal',
				'value' => $token['value'],
			);
		}
		if ( 'name' === $token['type'] ) {
			++$this->pos;
			if ( $this->is_op( '(' ) ) {
				++$this->pos;
				$args = array();
				if ( ! $this->is_op( ')' ) ) {
					$args[] = $this->expression();
					while ( $this->is_op( ',' ) ) {
						++$this->pos;
						$args[] = $this->expression();
					}
				}
				$this->expect_op( ')' );
				if ( ! in_array( $token['value'], self::FUNCTIONS, true ) ) {
					throw new ExpressionError( sprintf( 'Unknown function "%s"', $token['value'] ) ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
				}
				return array(
					'type' => 'call',
					'name' => $token['value'],
					'args' => $args,
				);
			}
			return array(
				'type' => 'path',
				'path' => $token['value'],
			);
		}
		if ( $this->is_op( '(' ) ) {
			++$this->pos;
			$inner = $this->expression();
			$this->expect_op( ')' );
			return $inner;
		}
		throw new ExpressionError( 'Unexpected end of expression' );
	}

	/* --------------------------------------------------------- Evaluator */

	/**
	 * @param array<string, mixed>    $node    Nœud.
	 * @param callable(string): mixed $resolve Résolution des chemins.
	 * @throws ExpressionError Nœud inconnu.
	 */
	private static function evaluate_node( array $node, callable $resolve ): mixed {
		switch ( $node['type'] ) {
			case 'literal':
				return $node['value'];
			case 'path':
				return $resolve( $node['path'] );
			case 'negate':
				return -Values::to_number( self::evaluate_node( $node['operand'], $resolve ) );
			case 'not':
				return ! Values::truthy( self::evaluate_node( $node['operand'], $resolve ) );
			case 'ternary':
				return Values::truthy( self::evaluate_node( $node['condition'], $resolve ) )
					? self::evaluate_node( $node['then'], $resolve )
					: self::evaluate_node( $node['otherwise'], $resolve );
			case 'call':
				$args = array_map( static fn( array $arg ) => self::evaluate_node( $arg, $resolve ), $node['args'] );
				return self::call( $node['name'], $args );
			case 'binary':
				if ( '&&' === $node['op'] ) {
					return Values::truthy( self::evaluate_node( $node['left'], $resolve ) ) && Values::truthy( self::evaluate_node( $node['right'], $resolve ) );
				}
				if ( '||' === $node['op'] ) {
					return Values::truthy( self::evaluate_node( $node['left'], $resolve ) ) || Values::truthy( self::evaluate_node( $node['right'], $resolve ) );
				}
				$a = self::evaluate_node( $node['left'], $resolve );
				$b = self::evaluate_node( $node['right'], $resolve );
				return self::binary_op( $node['op'], $a, $b );
		}
		throw new ExpressionError( 'Unknown node' );
	}

	private static function binary_op( string $op, mixed $a, mixed $b ): mixed {
		$x = Values::to_number( $a );
		$y = Values::to_number( $b );
		return match ( $op ) {
			'+'     => $x + $y,
			'-'     => $x - $y,
			'*'     => $x * $y,
			'/'     => 0.0 === $y ? 0.0 : $x / $y,
			'%'     => 0.0 === $y ? 0.0 : fmod( $x, $y ),
			'=='    => Values::loose_equals( $a, $b ),
			'!='    => ! Values::loose_equals( $a, $b ),
			'<'     => $x < $y,
			'<='    => $x <= $y,
			'>'     => $x > $y,
			'>='    => $x >= $y,
			default => false,
		};
	}

	/**
	 * Aplatit d'un niveau et convertit en nombres.
	 *
	 * @param list<mixed> $args Arguments.
	 * @return list<float>
	 */
	private static function flatten( array $args ): array {
		$values = array();
		foreach ( $args as $arg ) {
			if ( Values::is_list( $arg ) ) {
				foreach ( $arg as $item ) {
					$values[] = Values::to_number( $item );
				}
			} else {
				$values[] = Values::to_number( $arg );
			}
		}
		return $values;
	}

	/**
	 * @param string      $name Fonction.
	 * @param list<mixed> $args Arguments évalués.
	 */
	private static function call( string $name, array $args ): mixed {
		$arg = static fn( int $i ): mixed => $args[ $i ] ?? null;
		switch ( $name ) {
			case 'min':
			case 'max':
				$values = self::flatten( $args );
				if ( array() === $values ) {
					return 0.0;
				}
				return 'min' === $name ? min( $values ) : max( $values );
			case 'abs':
				return abs( Values::to_number( $arg( 0 ) ) );
			case 'round':
				$decimals = max( 0, min( 10, (int) Values::to_number( $arg( 1 ) ) ) );
				return round( Values::to_number( $arg( 0 ) ), $decimals );
			case 'floor':
				return floor( Values::to_number( $arg( 0 ) ) );
			case 'ceil':
				return ceil( Values::to_number( $arg( 0 ) ) );
			case 'clamp':
				return min( max( Values::to_number( $arg( 0 ) ), Values::to_number( $arg( 1 ) ) ), Values::to_number( $arg( 2 ) ) );
			case 'sum':
				return array_sum( self::flatten( $args ) );
			case 'avg':
				$values = self::flatten( $args );
				return array() === $values ? 0.0 : array_sum( $values ) / count( $values );
			case 'count':
				return Values::is_list( $arg( 0 ) ) ? (float) count( $arg( 0 ) ) : 0.0;
			case 'if':
				return Values::truthy( $arg( 0 ) ) ? $arg( 1 ) : $arg( 2 );
			case 'isAnswered':
				return ! Values::is_empty( $arg( 0 ) );
		}
		return null;
	}
}
