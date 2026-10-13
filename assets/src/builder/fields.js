/**
 * Champs réutilisables du constructeur.
 */
import { useState } from '@wordpress/element';
import { Button, TextControl, TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { KEY_PATTERN, move, parseNumber } from './utils';

/**
 * Texte multilingue : un champ par langue de i18n.languages, sinon un champ simple.
 *
 * @param {Object}   props
 * @param {string}   props.label       Libellé.
 * @param {*}        props.value       Chaîne ou { langue: texte }.
 * @param {Function} props.onChange    Nouvelle valeur.
 * @param {string[]} props.languages   Langues du diagnostic.
 * @param {boolean}  [props.multiline]
 * @param {string}   [props.help]
 */
export function I18nText( {
	label,
	value,
	onChange,
	languages,
	multiline,
	help,
} ) {
	const Control = multiline ? TextareaControl : TextControl;
	const common = {
		__nextHasNoMarginBottom: true,
		__next40pxDefaultSize: true,
	};
	if ( ! languages || languages.length < 2 ) {
		const text =
			typeof value === 'string'
				? value
				: ( Object.values( value ?? {} ).find(
						( v ) => typeof v === 'string'
					) ?? '' );
		return (
			<Control
				{ ...common }
				label={ label }
				help={ help }
				value={ text }
				onChange={ ( next ) =>
					onChange( next === '' ? undefined : next )
				}
			/>
		);
	}
	const object =
		typeof value === 'string'
			? { [ languages[ 0 ] ]: value }
			: ( value ?? {} );
	return (
		<fieldset className="sd-b-i18n">
			<legend>{ label }</legend>
			{ languages.map( ( lang ) => (
				<Control
					{ ...common }
					key={ lang }
					label={ lang.toUpperCase() }
					value={ object[ lang ] ?? '' }
					onChange={ ( next ) => {
						const copy = { ...object };
						if ( next === '' ) {
							delete copy[ lang ];
						} else {
							copy[ lang ] = next;
						}
						onChange(
							Object.keys( copy ).length ? copy : undefined
						);
					} }
				/>
			) ) }
			{ help && <p className="description">{ help }</p> }
		</fieldset>
	);
}

export function NumberField( {
	label,
	value,
	onChange,
	help,
	min,
	max,
	step,
} ) {
	return (
		<TextControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			type="number"
			label={ label }
			help={ help }
			min={ min }
			max={ max }
			step={ step ?? 'any' }
			value={ value ?? '' }
			onChange={ ( next ) => onChange( parseNumber( next ) ) }
		/>
	);
}

/**
 * Clé technique (a-z, 0-9, _) avec contrôle de format et d'unicité.
 *
 * @param {Object}   props
 * @param {string}   props.value    Clé.
 * @param {Function} props.onChange Nouvelle clé.
 * @param {string[]} [props.taken]  Clés déjà utilisées ailleurs.
 * @param {string}   [props.label]
 */
export function KeyField( { value, onChange, taken = [], label } ) {
	const [ draft, setDraft ] = useState( value ?? '' );
	let error = '';
	if ( ! KEY_PATTERN.test( draft ) ) {
		error = __(
			'Lowercase letters, digits and _ only, starting with a letter.',
			'smart-diagnostic'
		);
	} else if ( draft !== value && taken.includes( draft ) ) {
		error = __( 'This key is already used.', 'smart-diagnostic' );
	}
	return (
		<TextControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			className={ error ? 'sd-b-invalid' : undefined }
			label={ label ?? __( 'Key', 'smart-diagnostic' ) }
			help={
				error ||
				__(
					'Technical identifier used in rules and exports.',
					'smart-diagnostic'
				)
			}
			value={ draft }
			onChange={ ( next ) => {
				setDraft( next );
				if (
					KEY_PATTERN.test( next ) &&
					( next === value || ! taken.includes( next ) )
				) {
					onChange( next );
				}
			} }
		/>
	);
}

/**
 * Liste éditable : ajout, suppression, réordonnancement (boutons et glisser-déposer).
 *
 * @param {Object}   props
 * @param {Array}    props.items      Éléments.
 * @param {Function} props.onChange   Nouvelle liste.
 * @param {Function} props.renderItem ( item, update, index ) => élément.
 * @param {Function} props.newItem    ( items ) => nouvel élément.
 * @param {string}   props.addLabel   Libellé du bouton d'ajout.
 * @param {Function} [props.summary]  ( item, index ) => titre replié.
 * @param {string}   [props.label]    Titre de la liste.
 */
export function ListEditor( {
	items = [],
	onChange,
	renderItem,
	newItem,
	addLabel,
	summary,
	label,
} ) {
	const [ open, setOpen ] = useState( null );
	const [ dragged, setDragged ] = useState( null );
	const update = ( index ) => ( item ) => {
		const copy = [ ...items ];
		copy[ index ] = item;
		onChange( copy );
	};
	const remove = ( index ) => {
		const copy = items.filter( ( _, i ) => i !== index );
		onChange( copy.length ? copy : undefined );
	};

	return (
		<fieldset className="sd-b-list">
			{ label && <legend>{ label }</legend> }
			<ol className="sd-b-list__items">
				{ items.map( ( item, index ) => {
					const isOpen = ! summary || open === index;
					return (
						<li
							key={ index }
							className={ `sd-b-list__item${ dragged === index ? ' is-dragged' : '' }` }
							draggable={ Boolean( summary ) }
							onDragStart={ () => setDragged( index ) }
							onDragOver={ ( event ) => event.preventDefault() }
							onDrop={ () => {
								onChange( move( items, dragged, index ) );
								setDragged( null );
							} }
							onDragEnd={ () => setDragged( null ) }
						>
							<div className="sd-b-list__bar">
								{ summary && (
									<Button
										className="sd-b-list__toggle"
										aria-expanded={ isOpen }
										onClick={ () =>
											setOpen( isOpen ? null : index )
										}
									>
										<span
											className="sd-b-list__grip"
											aria-hidden="true"
										>
											⋮⋮
										</span>
										{ summary( item, index ) }
									</Button>
								) }
								<span className="sd-b-list__actions">
									<Button
										size="small"
										icon="arrow-up-alt2"
										label={ __(
											'Move up',
											'smart-diagnostic'
										) }
										disabled={ index === 0 }
										onClick={ () =>
											onChange(
												move( items, index, index - 1 )
											)
										}
									/>
									<Button
										size="small"
										icon="arrow-down-alt2"
										label={ __(
											'Move down',
											'smart-diagnostic'
										) }
										disabled={ index === items.length - 1 }
										onClick={ () =>
											onChange(
												move( items, index, index + 1 )
											)
										}
									/>
									<Button
										size="small"
										icon="trash"
										isDestructive
										label={ __(
											'Remove',
											'smart-diagnostic'
										) }
										onClick={ () => remove( index ) }
									/>
								</span>
							</div>
							{ isOpen && (
								<div className="sd-b-list__body">
									{ renderItem(
										item,
										update( index ),
										index
									) }
								</div>
							) }
						</li>
					);
				} ) }
			</ol>
			<Button
				variant="secondary"
				icon="plus"
				onClick={ () => {
					onChange( [ ...items, newItem( items ) ] );
					setOpen( items.length );
				} }
			>
				{ addLabel }
			</Button>
		</fieldset>
	);
}

/**
 * Plages de points (min inclus, max exclu).
 *
 * @param {Object}   props
 * @param {Array}    props.ranges   Plages.
 * @param {Function} props.onChange Nouvelles plages.
 */
export function RangesEditor( { ranges = [], onChange } ) {
	const set = ( index, field, value ) => {
		const copy = ranges.map( ( range, i ) => {
			if ( i !== index ) {
				return range;
			}
			const next = { ...range };
			if ( value === undefined ) {
				delete next[ field ];
			} else {
				next[ field ] = value;
			}
			return next;
		} );
		onChange( copy );
	};
	return (
		<fieldset className="sd-b-ranges">
			<legend>
				{ __(
					'Ranges (min included, max excluded)',
					'smart-diagnostic'
				) }
			</legend>
			<table className="sd-b-table">
				<thead>
					<tr>
						<th>{ __( 'Min', 'smart-diagnostic' ) }</th>
						<th>{ __( 'Max', 'smart-diagnostic' ) }</th>
						<th>{ __( 'Points', 'smart-diagnostic' ) }</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{ ranges.map( ( range, index ) => (
						<tr key={ index }>
							{ [ 'min', 'max', 'points' ].map( ( field ) => (
								<td key={ field }>
									<input
										type="number"
										step="any"
										aria-label={ field }
										value={ range[ field ] ?? '' }
										onChange={ ( event ) =>
											set(
												index,
												field,
												parseNumber(
													event.target.value
												)
											)
										}
									/>
								</td>
							) ) }
							<td>
								<Button
									size="small"
									icon="trash"
									isDestructive
									label={ __( 'Remove', 'smart-diagnostic' ) }
									onClick={ () =>
										onChange(
											ranges.filter(
												( _, i ) => i !== index
											)
										)
									}
								/>
							</td>
						</tr>
					) ) }
				</tbody>
			</table>
			<Button
				variant="link"
				onClick={ () => onChange( [ ...ranges, { points: 0 } ] ) }
			>
				{ __( 'Add a range', 'smart-diagnostic' ) }
			</Button>
		</fieldset>
	);
}
