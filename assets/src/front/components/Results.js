/**
 * Écran de résultat, construit à partir des blocs de config.results.blocks.
 */
import { evaluateCondition } from '../../engine/conditions';
import { createContext } from '../../engine/context';
import { formatValue, withUtm } from '../format';
import { RichText, safeUrl } from '../html';
import { BarChart, GaugeChart, RadarChart } from './Charts';
import { Heading } from './Screens';

const DEFAULT_BLOCKS = [
	{ type: 'profile' },
	{ type: 'scores', display: 'bars' },
	{ type: 'texts' },
	{ type: 'variables' },
	{ type: 'actions' },
	{ type: 'cta' },
];

const byKey = ( items, keys ) =>
	keys
		.map( ( key ) => ( items ?? [] ).find( ( item ) => item.key === key ) )
		.filter( Boolean );

function ProfileBlock( { config, result, ui } ) {
	const profile = byKey( config.outcomes?.profiles, [ result.profile ] )[ 0 ];
	if ( ! profile ) {
		return null;
	}
	const image = safeUrl( profile.image?.url );
	return (
		<section className="sd-block sd-profile">
			{ image && (
				<img
					className="sd-profile__image"
					src={ image }
					alt={ ui.tx( profile.image.alt ) }
				/>
			) }
			<h3 className="sd-profile__label">{ ui.tx( profile.label ) }</h3>
			<RichText
				className="sd-profile__text"
				html={ ui.tx( profile.text ) }
			/>
		</section>
	);
}

function ScoresBlock( { block, config, result, ui } ) {
	const axes = ( config.axes ?? [] ).filter(
		( axis ) => ! block.axes?.length || block.axes.includes( axis.key )
	);
	if ( ! axes.length ) {
		return null;
	}
	const items = axes.map( ( axis ) => {
		const value = result.scores[ axis.key ] ?? 0;
		const max = axis.max ?? 100;
		return {
			key: axis.key,
			label: ui.tx( axis.label ),
			value,
			min: axis.min ?? 0,
			max,
			display: `${ formatValue( value, { decimals: 0 }, ui.locale ) } / ${ max }`,
		};
	} );
	const caption = ui.tx( block.title ) || ui.t( 'scoresTitle' );
	let chart;
	if ( block.display === 'radar' && items.length >= 3 ) {
		chart = <RadarChart items={ items } caption={ caption } />;
	} else if ( block.display === 'gauges' ) {
		chart = (
			<GaugeChart
				items={ items }
				caption={ caption }
				showValues={ block.showValues !== false }
			/>
		);
	} else {
		chart = (
			<BarChart
				items={ items }
				caption={ caption }
				showValues={ block.showValues !== false }
			/>
		);
	}
	return (
		<section className="sd-block sd-scores">
			{ block.title && <h3>{ ui.tx( block.title ) }</h3> }
			{ chart }
		</section>
	);
}

function ListBlock( { block, items, ui, className, ordered = false } ) {
	if ( ! items.length ) {
		return null;
	}
	const List = ordered ? 'ol' : 'div';
	const Item = ordered ? 'li' : 'article';
	return (
		<section className={ `sd-block ${ className }` }>
			{ block.title && <h3>{ ui.tx( block.title ) }</h3> }
			<List className={ `${ className }__list` }>
				{ items.map( ( item ) => (
					<Item key={ item.key } className={ `${ className }__item` }>
						{ item.title && <h4>{ ui.tx( item.title ) }</h4> }
						<RichText html={ ui.tx( item.body ) } />
					</Item>
				) ) }
			</List>
		</section>
	);
}

function VariablesBlock( { block, config, result, ui } ) {
	const variables = ( config.variables ?? [] ).filter(
		( variable ) =>
			! block.keys?.length || block.keys.includes( variable.key )
	);
	if ( ! variables.length ) {
		return null;
	}
	const items = variables.map( ( variable ) => {
		const value = result.vars[ variable.key ];
		const format = {
			...variable.format,
			suffix: ui.tx( variable.format?.suffix ),
		};
		return {
			key: variable.key,
			label: ui.tx( variable.label ) || variable.key,
			value: typeof value === 'number' ? value : 0,
			min: 0,
			display: formatValue( value, format, ui.locale ),
		};
	} );
	const chart = block.chart && block.chart !== 'none';
	const max = Math.max( ...items.map( ( item ) => item.value ), 0 );

	return (
		<section className="sd-block sd-variables">
			{ block.title && <h3>{ ui.tx( block.title ) }</h3> }
			{ chart ? (
				<BarChart
					items={ items.map( ( item ) => ( { ...item, max } ) ) }
					caption={ ui.tx( block.title ) || ui.t( 'resultsTitle' ) }
				/>
			) : (
				<dl className="sd-variables__list">
					{ items.map( ( item ) => (
						<div key={ item.key } className="sd-variables__item">
							<dt>{ item.label }</dt>
							<dd>{ item.display }</dd>
						</div>
					) ) }
				</dl>
			) }
		</section>
	);
}

function CtaBlock( { config, result, ui } ) {
	const cta = byKey( config.outcomes?.ctas, [ result.cta ] )[ 0 ];
	const url = cta && safeUrl( cta.url );
	if ( ! url ) {
		return null;
	}
	return (
		<section className="sd-block sd-cta">
			<RichText className="sd-cta__text" html={ ui.tx( cta.text ) } />
			<a
				className="sd-button sd-button--primary sd-cta__button"
				href={ withUtm( url, cta.utm ) }
			>
				{ ui.tx( cta.label ) }
			</a>
		</section>
	);
}

/**
 * @param {Object}   props
 * @param {Object}   props.config     Config.
 * @param {Object}   props.result     Résultat de computeResult().
 * @param {Object}   props.answers    Réponses (pour les showIf de blocs).
 * @param {Object}   props.contact    Contact.
 * @param {Object}   props.ui         Helpers d'affichage.
 * @param {Function} props.onRestart  Recommencer.
 * @param {Object}   props.headingRef Ref du titre (focus).
 */
export function Results( {
	config,
	result,
	answers,
	contact,
	ui,
	onRestart,
	headingRef,
} ) {
	const blocks = config.results?.blocks?.length
		? config.results.blocks
		: DEFAULT_BLOCKS;
	const context = createContext( {
		config,
		answers,
		contact,
		scores: result.scores,
		vars: result.vars,
	} );

	const renderBlock = ( block, index ) => {
		if ( ! evaluateCondition( block.showIf, context ) ) {
			return null;
		}
		const props = { key: index, block, config, result, ui };
		switch ( block.type ) {
			case 'heading':
				return (
					<h3 key={ index } className="sd-block sd-heading">
						{ ui.tx( block.title ) }
					</h3>
				);
			case 'profile':
				return <ProfileBlock { ...props } />;
			case 'scores':
				return <ScoresBlock { ...props } />;
			case 'texts':
				return (
					<ListBlock
						{ ...props }
						items={ byKey( config.outcomes?.texts, result.texts ) }
						className="sd-texts"
					/>
				);
			case 'actions':
				return (
					<ListBlock
						{ ...props }
						items={ byKey(
							config.outcomes?.actions,
							result.actions
						) }
						className="sd-actions-plan"
						ordered
					/>
				);
			case 'variables':
				return <VariablesBlock { ...props } />;
			case 'cta':
				return <CtaBlock { ...props } />;
			case 'html':
				return (
					<RichText
						key={ index }
						className="sd-block sd-html"
						html={ ui.tx( block.body ) }
					/>
				);
			default:
				// share et form : envoi au serveur (M3).
				return null;
		}
	};

	return (
		<div className="sd-screen sd-results">
			<Heading
				text={
					ui.tx( config.results?.title ) || ui.t( 'resultsTitle' )
				}
				headingRef={ headingRef }
			/>
			{ blocks.map( renderBlock ) }
			<div className="sd-actions sd-results__actions">
				<button
					type="button"
					className="sd-button sd-button--ghost"
					onClick={ () => window.print() }
				>
					{ ui.t( 'print' ) }
				</button>
				<button
					type="button"
					className="sd-button sd-button--ghost"
					onClick={ onRestart }
				>
					{ ui.t( 'restart' ) }
				</button>
			</div>
		</div>
	);
}
