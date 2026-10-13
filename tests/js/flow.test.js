import { createContext } from '../../assets/src/engine/context';
import {
	answersOnPath,
	firstStepKey,
	nextStepKey,
	progress,
	RESULTS,
} from '../../assets/src/engine/flow';

const config = {
	steps: [
		{
			key: 'q1',
			kind: 'question',
			type: 'single',
			jumpTo: [
				{
					if: { left: 'answer.q1', op: 'eq', value: 'skip' },
					to: 'q4',
				},
			],
		},
		{
			key: 'q2',
			kind: 'question',
			type: 'text',
			showIf: { left: 'answer.q1', op: 'eq', value: 'a' },
		},
		{ key: 'info', kind: 'content', variant: 'text' },
		{
			key: 'q4',
			kind: 'question',
			type: 'number',
			jumpTo: [
				{
					if: { left: 'answer.q4', op: 'gt', value: 10 },
					to: 'results',
				},
			],
		},
		{ key: 'q5', kind: 'question', type: 'text' },
		{
			key: 'late_form',
			kind: 'form',
			placement: 'after_results',
			fields: [],
		},
	],
};
const ctx = ( answers ) => createContext( { config, answers } );

describe( 'flow', () => {
	it( 'starts at the first visible step', () => {
		expect( firstStepKey( config, ctx( {} ) ) ).toBe( 'q1' );
	} );

	it( 'skips hidden steps', () => {
		expect( nextStepKey( config, 'q1', ctx( { q1: 'b' } ) ) ).toBe(
			'info'
		);
		expect( nextStepKey( config, 'q1', ctx( { q1: 'a' } ) ) ).toBe( 'q2' );
	} );

	it( 'follows conditional jumps', () => {
		expect( nextStepKey( config, 'q1', ctx( { q1: 'skip' } ) ) ).toBe(
			'q4'
		);
		expect( nextStepKey( config, 'q4', ctx( { q4: 20 } ) ) ).toBe(
			RESULTS
		);
		expect( nextStepKey( config, 'q4', ctx( { q4: 5 } ) ) ).toBe( 'q5' );
	} );

	it( 'ends after the last flow step (after_results forms excluded)', () => {
		expect( nextStepKey( config, 'q5', ctx( {} ) ) ).toBe( RESULTS );
	} );

	it( 'estimates progress from the path and remaining visible steps', () => {
		expect( progress( config, [], 'q1', ctx( {} ) ) ).toEqual( {
			current: 1,
			total: 4,
			percent: 0,
		} );
		expect(
			progress( config, [ 'q1' ], 'q2', ctx( { q1: 'a' } ) )
		).toEqual( { current: 2, total: 5, percent: 20 } );
	} );

	it( 'keeps only answers on the travelled path', () => {
		expect(
			answersOnPath( [ 'q1', 'q4' ], { q1: 'skip', q2: 'stale', q4: 3 } )
		).toEqual( { q1: 'skip', q4: 3 } );
	} );
} );
