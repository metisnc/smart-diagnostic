/**
 * Évaluateur d'expressions sûr (sans eval), miroir de src/Engine/Expression (PHP, M2).
 *
 * Grammaire :
 *   expr       := ternary
 *   ternary    := or ( '?' expr ':' expr )?
 *   or         := and ( ( 'or' | '||' ) and )*
 *   and        := not ( ( 'and' | '&&' ) not )*
 *   not        := ( 'not' | '!' ) not | comparison
 *   comparison := additive ( ( '==' | '!=' | '<' | '<=' | '>' | '>=' ) additive )?
 *   additive   := term ( ( '+' | '-' ) term )*
 *   term       := unary ( ( '*' | '/' | '%' ) unary )*
 *   unary      := '-' unary | primary
 *   primary    := number | string | true | false | null
 *               | path                       (answer.x, score.y, var.z…)
 *               | name '(' args? ')'         (fonction)
 *               | '(' expr ')'
 *
 * Sémantique (identique en PHP) :
 *   - arithmétique : null / non numérique → 0 ; division ou modulo par 0 → 0 ;
 *   - égalité : numérique si les deux côtés sont numériques, sinon comparaison de chaînes ;
 *   - and / or renvoient des booléens.
 */

import { looseEquals, toNumber, isEmptyValue, truthy } from './values';

const MAX_LENGTH = 1000;

export class ExpressionError extends Error {}

/* ------------------------------------------------------------------ Lexer */

const OPERATORS = [
	'==',
	'!=',
	'<=',
	'>=',
	'&&',
	'||',
	'<',
	'>',
	'+',
	'-',
	'*',
	'/',
	'%',
	'!',
	'?',
	':',
	'(',
	')',
	',',
];
const KEYWORDS = { and: '&&', or: '||', not: '!' };

export function tokenize( source ) {
	if ( typeof source !== 'string' ) {
		throw new ExpressionError( 'Expression must be a string' );
	}
	if ( source.length > MAX_LENGTH ) {
		throw new ExpressionError( 'Expression too long' );
	}
	const tokens = [];
	let i = 0;
	while ( i < source.length ) {
		const ch = source[ i ];
		if ( /\s/.test( ch ) ) {
			i++;
			continue;
		}
		if (
			/[0-9]/.test( ch ) ||
			( ch === '.' && /[0-9]/.test( source[ i + 1 ] ) )
		) {
			const match = /^[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?/.exec(
				source.slice( i )
			);
			tokens.push( { type: 'number', value: parseFloat( match[ 0 ] ) } );
			i += match[ 0 ].length;
			continue;
		}
		if ( ch === '"' || ch === "'" ) {
			let j = i + 1;
			let value = '';
			while ( j < source.length && source[ j ] !== ch ) {
				if ( source[ j ] === '\\' && j + 1 < source.length ) {
					j++;
				}
				value += source[ j ];
				j++;
			}
			if ( j >= source.length ) {
				throw new ExpressionError( 'Unterminated string' );
			}
			tokens.push( { type: 'string', value } );
			i = j + 1;
			continue;
		}
		if ( /[A-Za-z_]/.test( ch ) ) {
			const match =
				/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/.exec(
					source.slice( i )
				);
			const word = match[ 0 ];
			i += word.length;
			if ( KEYWORDS[ word ] ) {
				tokens.push( { type: 'op', value: KEYWORDS[ word ] } );
			} else if ( word === 'true' || word === 'false' ) {
				tokens.push( { type: 'literal', value: word === 'true' } );
			} else if ( word === 'null' ) {
				tokens.push( { type: 'literal', value: null } );
			} else {
				tokens.push( { type: 'name', value: word } );
			}
			continue;
		}
		const op = OPERATORS.find( ( candidate ) =>
			source.startsWith( candidate, i )
		);
		if ( ! op ) {
			throw new ExpressionError(
				`Unexpected character "${ ch }" at ${ i }`
			);
		}
		tokens.push( { type: 'op', value: op } );
		i += op.length;
	}
	tokens.push( { type: 'eof' } );
	return tokens;
}

/* ----------------------------------------------------------------- Parser */

export function parse( source ) {
	const tokens = tokenize( source );
	let pos = 0;

	const peek = () => tokens[ pos ];
	const isOp = ( ...values ) =>
		peek().type === 'op' && values.includes( peek().value );
	const expectOp = ( value ) => {
		if ( ! isOp( value ) ) {
			throw new ExpressionError( `Expected "${ value }"` );
		}
		pos++;
	};

	function expression() {
		const condition = or();
		if ( isOp( '?' ) ) {
			pos++;
			const then = expression();
			expectOp( ':' );
			const otherwise = expression();
			return { type: 'ternary', condition, then, otherwise };
		}
		return condition;
	}

	function binaryLevel( next, ops ) {
		return () => {
			let left = next();
			while ( isOp( ...ops ) ) {
				const op = tokens[ pos++ ].value;
				left = { type: 'binary', op, left, right: next() };
			}
			return left;
		};
	}

	function not() {
		if ( isOp( '!' ) ) {
			pos++;
			return { type: 'not', operand: not() };
		}
		return comparison();
	}

	function comparison() {
		const left = additive();
		if ( isOp( '==', '!=', '<', '<=', '>', '>=' ) ) {
			const op = tokens[ pos++ ].value;
			return { type: 'binary', op, left, right: additive() };
		}
		return left;
	}

	function unary() {
		if ( isOp( '-' ) ) {
			pos++;
			return { type: 'negate', operand: unary() };
		}
		return primary();
	}

	function primary() {
		const token = peek();
		if (
			token.type === 'number' ||
			token.type === 'string' ||
			token.type === 'literal'
		) {
			pos++;
			return { type: 'literal', value: token.value };
		}
		if ( token.type === 'name' ) {
			pos++;
			if ( isOp( '(' ) ) {
				pos++;
				const args = [];
				if ( ! isOp( ')' ) ) {
					args.push( expression() );
					while ( isOp( ',' ) ) {
						pos++;
						args.push( expression() );
					}
				}
				expectOp( ')' );
				if (
					! Object.prototype.hasOwnProperty.call(
						FUNCTIONS,
						token.value
					)
				) {
					throw new ExpressionError(
						`Unknown function "${ token.value }"`
					);
				}
				return { type: 'call', name: token.value, args };
			}
			return { type: 'path', path: token.value };
		}
		if ( isOp( '(' ) ) {
			pos++;
			const inner = expression();
			expectOp( ')' );
			return inner;
		}
		throw new ExpressionError( 'Unexpected end of expression' );
	}

	const term = binaryLevel( unary, [ '*', '/', '%' ] );
	const additive = binaryLevel( term, [ '+', '-' ] );
	const and = binaryLevel( not, [ '&&' ] );
	const or = binaryLevel( and, [ '||' ] );

	const ast = expression();
	if ( peek().type !== 'eof' ) {
		throw new ExpressionError( 'Unexpected token after expression' );
	}
	return ast;
}

/* -------------------------------------------------------------- Evaluator */

const flatten = ( args ) => args.flat().map( toNumber );

// Arrondi « au plus loin de zéro » comme PHP round(), via la notation exponentielle
// pour éviter les erreurs binaires (1.005 → 1.01).
function roundHalfAwayFromZero( value, decimals = 0 ) {
	const d = Math.max( 0, Math.min( 10, Math.trunc( toNumber( decimals ) ) ) );
	const n = toNumber( value );
	const abs = Math.abs( n );
	const rounded = String( abs ).includes( 'e' )
		? Math.round( abs * 10 ** d ) / 10 ** d
		: Number( `${ Math.round( Number( `${ abs }e${ d }` ) ) }e-${ d }` );
	return n < 0 ? -rounded : rounded;
}

const extreme =
	( pick ) =>
	( ...args ) => {
		const values = flatten( args );
		return values.length ? pick( ...values ) : 0;
	};

export const FUNCTIONS = {
	min: extreme( Math.min ),
	max: extreme( Math.max ),
	abs: ( x ) => Math.abs( toNumber( x ) ),
	round: roundHalfAwayFromZero,
	floor: ( x ) => Math.floor( toNumber( x ) ),
	ceil: ( x ) => Math.ceil( toNumber( x ) ),
	clamp: ( x, lo, hi ) =>
		Math.min( Math.max( toNumber( x ), toNumber( lo ) ), toNumber( hi ) ),
	sum: ( ...args ) => flatten( args ).reduce( ( a, b ) => a + b, 0 ),
	avg: ( ...args ) => {
		const values = flatten( args );
		return values.length
			? values.reduce( ( a, b ) => a + b, 0 ) / values.length
			: 0;
	},
	count: ( x ) => ( Array.isArray( x ) ? x.length : 0 ),
	if: ( condition, then, otherwise ) =>
		truthy( condition ) ? then : otherwise,
	isAnswered: ( x ) => ! isEmptyValue( x ),
};

export { truthy };

function compare( op, a, b ) {
	switch ( op ) {
		case '==':
			return looseEquals( a, b );
		case '!=':
			return ! looseEquals( a, b );
		case '<':
			return toNumber( a ) < toNumber( b );
		case '<=':
			return toNumber( a ) <= toNumber( b );
		case '>':
			return toNumber( a ) > toNumber( b );
		case '>=':
			return toNumber( a ) >= toNumber( b );
	}
	return false;
}

function evaluateNode( node, resolve ) {
	switch ( node.type ) {
		case 'literal':
			return node.value;
		case 'path':
			return resolve( node.path );
		case 'negate':
			return -toNumber( evaluateNode( node.operand, resolve ) );
		case 'not':
			return ! truthy( evaluateNode( node.operand, resolve ) );
		case 'ternary':
			return truthy( evaluateNode( node.condition, resolve ) )
				? evaluateNode( node.then, resolve )
				: evaluateNode( node.otherwise, resolve );
		case 'call':
			return FUNCTIONS[ node.name ](
				...node.args.map( ( arg ) => evaluateNode( arg, resolve ) )
			);
		case 'binary': {
			if ( node.op === '&&' ) {
				return (
					truthy( evaluateNode( node.left, resolve ) ) &&
					truthy( evaluateNode( node.right, resolve ) )
				);
			}
			if ( node.op === '||' ) {
				return (
					truthy( evaluateNode( node.left, resolve ) ) ||
					truthy( evaluateNode( node.right, resolve ) )
				);
			}
			const a = evaluateNode( node.left, resolve );
			const b = evaluateNode( node.right, resolve );
			switch ( node.op ) {
				case '+':
					return toNumber( a ) + toNumber( b );
				case '-':
					return toNumber( a ) - toNumber( b );
				case '*':
					return toNumber( a ) * toNumber( b );
				case '/':
					return toNumber( b ) === 0
						? 0
						: toNumber( a ) / toNumber( b );
				case '%':
					return toNumber( b ) === 0
						? 0
						: toNumber( a ) % toNumber( b );
				default:
					return compare( node.op, a, b );
			}
		}
	}
	throw new ExpressionError( `Unknown node ${ node.type }` );
}

const cache = new Map();

/**
 * Évalue une expression.
 *
 * @param {string}                    source  Expression.
 * @param {function(string): unknown} resolve Résout un chemin (answer.x…) en valeur.
 * @return {unknown} Résultat.
 */
export function evaluate( source, resolve ) {
	let ast = cache.get( source );
	if ( ! ast ) {
		ast = parse( source );
		cache.set( source, ast );
	}
	return evaluateNode( ast, resolve );
}
