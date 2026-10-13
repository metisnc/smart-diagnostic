import {
	evaluate,
	parse,
	ExpressionError,
} from '../../assets/src/engine/expression';

const values = {
	'answer.current': 1200,
	'answer.target': 2000,
	'answer.name': 'Alice',
	'answer.list': [ 1, 2, 3 ],
	'score.x': 40,
	'answer.empty': null,
};
const resolve = ( path ) => ( path in values ? values[ path ] : null );
const run = ( source ) => evaluate( source, resolve );

describe( 'expression evaluator', () => {
	it.each( [
		[ '1 + 2 * 3', 7 ],
		[ '(1 + 2) * 3', 9 ],
		[ '-2 + 5', 3 ],
		[ '10 % 4', 2 ],
		[ '7 / 2', 3.5 ],
		[ 'answer.target - answer.current', 800 ],
		[ 'answer.target / answer.current * 100', ( 2000 / 1200 ) * 100 ],
		[ '1.5e2', 150 ],
		[ '.5 + .5', 1 ],
	] )( 'computes %s', ( source, expected ) => {
		expect( run( source ) ).toBeCloseTo( expected );
	} );

	it( 'returns 0 when dividing by zero', () => {
		expect( run( '5 / 0' ) ).toBe( 0 );
		expect( run( '5 % 0' ) ).toBe( 0 );
	} );

	it( 'treats null and non-numeric values as 0 in arithmetic', () => {
		expect( run( 'answer.empty + 1' ) ).toBe( 1 );
		expect( run( 'answer.name * 2' ) ).toBe( 0 );
		expect( run( 'unknown.path + 1' ) ).toBe( 1 );
	} );

	it( 'compares numbers and strings', () => {
		expect( run( 'score.x >= 40' ) ).toBe( true );
		expect( run( 'score.x > 40' ) ).toBe( false );
		expect( run( "answer.name == 'Alice'" ) ).toBe( true );
		expect( run( 'answer.name != "Bob"' ) ).toBe( true );
		expect( run( "'40' == score.x" ) ).toBe( true );
	} );

	it( 'supports boolean logic with words and symbols', () => {
		expect( run( 'score.x > 10 and score.x < 50' ) ).toBe( true );
		expect( run( 'score.x > 50 or answer.name == "Alice"' ) ).toBe( true );
		expect( run( 'not (score.x > 10)' ) ).toBe( false );
		expect( run( '!(score.x > 10) || true' ) ).toBe( true );
		expect( run( 'score.x > 10 && false' ) ).toBe( false );
	} );

	it( 'supports the ternary operator', () => {
		expect( run( 'score.x > 30 ? "high" : "low"' ) ).toBe( 'high' );
		expect( run( 'score.x > 50 ? 1 : score.x > 30 ? 2 : 3' ) ).toBe( 2 );
	} );

	it.each( [
		[ 'min(3, 1, 2)', 1 ],
		[ 'max(answer.list)', 3 ],
		[ 'abs(-4)', 4 ],
		[ 'round(2.5)', 3 ],
		[ 'round(-2.5)', -3 ],
		[ 'round(1.005, 2)', 1.01 ],
		[ 'floor(2.7)', 2 ],
		[ 'ceil(2.1)', 3 ],
		[ 'clamp(150, 0, 100)', 100 ],
		[ 'sum(answer.list, 4)', 10 ],
		[ 'avg(answer.list)', 2 ],
		[ 'count(answer.list)', 3 ],
		[ 'if(score.x > 10, 1, 2)', 1 ],
	] )( 'function %s', ( source, expected ) => {
		expect( run( source ) ).toBeCloseTo( expected );
	} );

	it( 'detects answered values', () => {
		expect( run( 'isAnswered(answer.name)' ) ).toBe( true );
		expect( run( 'isAnswered(answer.empty)' ) ).toBe( false );
	} );

	it.each( [ '1 +', '(1 + 2', 'foo(1)', '1 2', '"open', '1 $ 2', '' ] )(
		'rejects invalid expression %p',
		( source ) => {
			expect( () => parse( source ) ).toThrow( ExpressionError );
		}
	);

	it( 'rejects overly long expressions', () => {
		expect( () => parse( '1+'.repeat( 600 ) + '1' ) ).toThrow(
			ExpressionError
		);
	} );

	it( 'never executes JavaScript', () => {
		expect( () =>
			parse( 'constructor.constructor("alert(1)")()' )
		).toThrow( ExpressionError );
		expect( run( 'constructor.constructor' ) ).toBeNull();
	} );
} );
