/**
 * Graphiques SVG légers : radar, barres, jauges. Chaque graphique est doublé d'un
 * tableau visuellement masqué pour les lecteurs d'écran.
 */

const ratio = ( value, min, max ) => {
	const span = max - min || 1;
	return Math.min( 1, Math.max( 0, ( value - min ) / span ) );
};

function DataTable( { items, caption } ) {
	return (
		<table className="sd-sr-only">
			<caption>{ caption }</caption>
			<tbody>
				{ items.map( ( item ) => (
					<tr key={ item.key }>
						<th scope="row">{ item.label }</th>
						<td>{ item.display }</td>
					</tr>
				) ) }
			</tbody>
		</table>
	);
}

/**
 * @param {Object}   props
 * @param {Object[]} props.items   { key, label, value, min, max, display }
 * @param {string}   props.caption Titre accessible.
 */
export function RadarChart( { items, caption } ) {
	const size = 320;
	const center = size / 2;
	const radius = center - 70;
	const angle = ( i ) => ( Math.PI * 2 * i ) / items.length - Math.PI / 2;
	const point = ( i, r ) => [
		center + Math.cos( angle( i ) ) * r,
		center + Math.sin( angle( i ) ) * r,
	];
	const polygon = ( r ) =>
		items.map( ( _, i ) => point( i, r ).join( ',' ) ).join( ' ' );
	const values = items
		.map( ( item, i ) =>
			point( i, radius * ratio( item.value, item.min, item.max ) ).join(
				','
			)
		)
		.join( ' ' );

	return (
		<figure className="sd-chart sd-chart--radar">
			<svg
				viewBox={ `0 0 ${ size } ${ size }` }
				aria-hidden="true"
				focusable="false"
			>
				{ [ 0.25, 0.5, 0.75, 1 ].map( ( level ) => (
					<polygon
						key={ level }
						className="sd-chart__grid"
						points={ polygon( radius * level ) }
					/>
				) ) }
				{ items.map( ( item, i ) => {
					const [ x, y ] = point( i, radius );
					const [ lx, ly ] = point( i, radius + 18 );
					let anchor = 'middle';
					if ( lx < center - 5 ) {
						anchor = 'end';
					} else if ( lx > center + 5 ) {
						anchor = 'start';
					}
					return (
						<g key={ item.key }>
							<line
								className="sd-chart__grid"
								x1={ center }
								y1={ center }
								x2={ x }
								y2={ y }
							/>
							<text
								className="sd-chart__label"
								x={ lx }
								y={ ly }
								textAnchor={ anchor }
								dominantBaseline="middle"
							>
								{ item.label }
							</text>
						</g>
					);
				} ) }
				<polygon className="sd-chart__area" points={ values } />
				{ items.map( ( item, i ) => {
					const [ x, y ] = point(
						i,
						radius * ratio( item.value, item.min, item.max )
					);
					return (
						<circle
							key={ item.key }
							className="sd-chart__dot"
							cx={ x }
							cy={ y }
							r="4"
						/>
					);
				} ) }
			</svg>
			<DataTable items={ items } caption={ caption } />
		</figure>
	);
}

export function BarChart( { items, caption, showValues = true } ) {
	return (
		<figure className="sd-chart sd-chart--bars">
			<ul className="sd-bars" aria-hidden="true">
				{ items.map( ( item ) => (
					<li key={ item.key } className="sd-bars__item">
						<div className="sd-bars__head">
							<span>{ item.label }</span>
							{ showValues && <strong>{ item.display }</strong> }
						</div>
						<div className="sd-bars__track">
							<div
								className="sd-bars__fill"
								style={ {
									width: `${ ratio( item.value, item.min, item.max ) * 100 }%`,
								} }
							/>
						</div>
					</li>
				) ) }
			</ul>
			<DataTable items={ items } caption={ caption } />
		</figure>
	);
}

function Gauge( { item, showValues } ) {
	const r = 50;
	const length = Math.PI * r;
	const filled = length * ratio( item.value, item.min, item.max );
	return (
		<div className="sd-gauge">
			<svg viewBox="0 0 120 70" aria-hidden="true" focusable="false">
				<path
					className="sd-gauge__track"
					d="M10 60 A50 50 0 0 1 110 60"
					pathLength={ length }
				/>
				<path
					className="sd-gauge__fill"
					d="M10 60 A50 50 0 0 1 110 60"
					pathLength={ length }
					strokeDasharray={ `${ filled } ${ length }` }
				/>
				{ showValues && (
					<text
						className="sd-gauge__value"
						x="60"
						y="56"
						textAnchor="middle"
					>
						{ item.display }
					</text>
				) }
			</svg>
			<span className="sd-gauge__label">{ item.label }</span>
		</div>
	);
}

export function GaugeChart( { items, caption, showValues = true } ) {
	return (
		<figure className="sd-chart sd-chart--gauges">
			<div className="sd-gauges">
				{ items.map( ( item ) => (
					<Gauge
						key={ item.key }
						item={ item }
						showValues={ showValues }
					/>
				) ) }
			</div>
			<DataTable items={ items } caption={ caption } />
		</figure>
	);
}
