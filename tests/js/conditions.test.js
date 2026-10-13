import { evaluateCondition } from '../../assets/src/engine/conditions';
import { createContext } from '../../assets/src/engine/context';

const config = {
	steps: [
		{ key: 'choice', kind: 'question', type: 'single' },
		{ key: 'multi', kind: 'question', type: 'multi' },
		{ key: 'yes', kind: 'question', type: 'yes_no' },
		{
			key: 'amounts',
			kind: 'question',
			type: 'multi_amount',
			aggregate: 'sum',
		},
	],
	axes: [
		{ key: 'x', min: 0, max: 100 },
		{ key: 'y', min: 0, max: 10 },
	],
};
const context = createContext( {
	config,
	answers: {
		choice: 'a',
		multi: [ 'one', 'two' ],
		yes: true,
		amounts: { a: 100, b: 50 },
	},
	contact: { email: 'a@b.co' },
	scores: { x: 30, y: 9 },
} );
const check = ( condition ) => evaluateCondition( condition, context );

describe( 'conditions', () => {
	it( 'is true when absent', () => {
		expect( check( undefined ) ).toBe( true );
	} );

	it.each( [
		[ { left: 'answer.choice', op: 'eq', value: 'a' }, true ],
		[ { left: 'answer.choice', op: 'neq', value: 'a' }, false ],
		[ { left: 'answer.multi', op: 'eq', value: 'two' }, true ],
		[ { left: 'answer.multi', op: 'contains', value: 'one' }, true ],
		[ { left: 'answer.multi', op: 'notContains', value: 'three' }, true ],
		[ { left: 'answer.choice', op: 'in', value: [ 'a', 'b' ] }, true ],
		[ { left: 'answer.multi', op: 'in', value: [ 'two', 'x' ] }, true ],
		[ { left: 'answer.choice', op: 'notIn', value: [ 'b' ] }, true ],
		[ { left: 'answer.yes', op: 'eq', value: true }, true ],
		[ { left: 'answer.yes', op: 'eq', value: false }, false ],
		[ { left: 'answer.amounts', op: 'gte', value: 150 }, true ],
		[
			{ left: 'answer.amounts', op: 'between', value: [ 100, 140 ] },
			false,
		],
		[ { left: 'count.multi', op: 'eq', value: 2 }, true ],
		[ { left: 'score.x', op: 'lt', value: 40 }, true ],
		[ { left: 'contact.email', op: 'answered' }, true ],
		[ { left: 'answer.missing', op: 'empty' }, true ],
		[ { left: 'weakestAxis', op: 'eq', value: 'x' }, true ],
		[ { left: 'strongestAxis', op: 'eq', value: 'y' }, true ],
	] )( '%j → %s', ( condition, expected ) => {
		expect( check( condition ) ).toBe( expected );
	} );

	it( 'combines with all / any / not', () => {
		const a = { left: 'answer.choice', op: 'eq', value: 'a' };
		const b = { left: 'score.x', op: 'gt', value: 50 };
		expect( check( { all: [ a, b ] } ) ).toBe( false );
		expect( check( { any: [ a, b ] } ) ).toBe( true );
		expect( check( { not: b } ) ).toBe( true );
		expect( check( { all: [ a, { any: [ b, { not: b } ] } ] } ) ).toBe(
			true
		);
	} );

	it( 'evaluates expressions, and treats invalid ones as false', () => {
		expect( check( { expr: 'score.x + score.y > 35' } ) ).toBe( true );
		expect( check( { expr: 'score.x +' } ) ).toBe( false );
	} );
} );
