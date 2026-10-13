/**
 * Champs de saisie, un par type de question.
 */
import { useEffect } from 'preact/hooks';
import { answerValue } from '../../engine/context';
import { safeUrl } from '../html';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PERIOD_KEYS = {
	once: 'perOnce',
	day: 'perDay',
	week: 'perWeek',
	month: 'perMonth',
	quarter: 'perQuarter',
	year: 'perYear',
};

function optionsFor( step, ui ) {
	if ( step.type === 'yes_no' && ! step.options?.length ) {
		return [
			{ value: true, label: ui.t( 'yes' ) },
			{ value: false, label: ui.t( 'no' ) },
		];
	}
	return step.options ?? [];
}

function formatMoney( value, currency, locale ) {
	try {
		return new Intl.NumberFormat( locale, {
			style: 'currency',
			currency,
			maximumFractionDigits: 2,
		} ).format( value );
	} catch ( error ) {
		return `${ value } ${ currency }`;
	}
}

function Suffix( { step, ui } ) {
	const parts = [];
	if ( step.currency ) {
		parts.push( step.currency );
	}
	if ( step.unit ) {
		parts.push( ui.tx( step.unit ) );
	}
	if ( step.period && PERIOD_KEYS[ step.period ] ) {
		parts.push( ui.t( PERIOD_KEYS[ step.period ] ) );
	}
	const text = parts.filter( Boolean ).join( ' ' );
	return text ? <span className="sd-input__suffix">{ text }</span> : null;
}

function OptionContent( { option, index, ui } ) {
	const image = safeUrl( option.image?.url );
	return (
		<>
			{ ui.letters && (
				<span className="sd-option__letter" aria-hidden="true">
					{ LETTERS[ index ] }
				</span>
			) }
			{ image && (
				<img
					className="sd-option__image"
					src={ image }
					alt={ ui.tx( option.image.alt ) }
					loading="lazy"
				/>
			) }
			<span className="sd-option__text">
				<span className="sd-option__label">
					{ ui.tx( option.label ) }
				</span>
				{ option.description && (
					<span className="sd-option__description">
						{ ui.tx( option.description ) }
					</span>
				) }
			</span>
		</>
	);
}

function ChoiceGroup( { step, value, onChange, onPick, ui, ids } ) {
	const options = optionsFor( step, ui );
	const multiple = step.type === 'multi';
	let selected = value;
	if ( multiple ) {
		selected = Array.isArray( value ) ? value : [];
	}

	const toggle = ( option ) => {
		if ( ! multiple ) {
			onChange( option.value );
			onPick?.();
			return;
		}
		const isOn = selected.includes( option.value );
		if ( isOn ) {
			onChange( selected.filter( ( item ) => item !== option.value ) );
			return;
		}
		if ( option.exclusive ) {
			onChange( [ option.value ] );
			return;
		}
		const exclusive = new Set(
			options.filter( ( o ) => o.exclusive ).map( ( o ) => o.value )
		);
		onChange( [
			...selected.filter( ( item ) => ! exclusive.has( item ) ),
			option.value,
		] );
	};

	return (
		<div
			className={ `sd-options sd-options--${ step.type }` }
			role={ multiple ? 'group' : 'radiogroup' }
			aria-labelledby={ ids.label }
			aria-describedby={ ids.describedBy }
		>
			{ options.map( ( option, index ) => {
				const checked = multiple
					? selected.includes( option.value )
					: selected === option.value;
				return (
					<label
						key={ String( option.value ) }
						className={ `sd-option${ checked ? ' is-selected' : '' }` }
					>
						<input
							type={ multiple ? 'checkbox' : 'radio' }
							name={ ids.input }
							className="sd-option__input"
							checked={ checked }
							onChange={ () => toggle( option ) }
						/>
						<OptionContent
							option={ option }
							index={ index }
							ui={ ui }
						/>
					</label>
				);
			} ) }
		</div>
	);
}

function Dropdown( { step, value, onChange, ui, ids } ) {
	const options = optionsFor( step, ui );
	const index = options.findIndex( ( option ) => option.value === value );
	return (
		<select
			id={ ids.input }
			className="sd-input sd-input--select"
			aria-labelledby={ ids.label }
			aria-describedby={ ids.describedBy }
			value={ index === -1 ? '' : String( index ) }
			onChange={ ( event ) =>
				onChange(
					event.target.value === ''
						? null
						: options[ Number( event.target.value ) ].value
				)
			}
		>
			<option value="">
				{ ui.tx( step.placeholder ) || ui.t( 'selectPlaceholder' ) }
			</option>
			{ options.map( ( option, i ) => (
				<option key={ String( option.value ) } value={ String( i ) }>
					{ ui.tx( option.label ) }
				</option>
			) ) }
		</select>
	);
}

const parseNumber = ( raw ) => {
	if ( raw === '' ) {
		return null;
	}
	const n = Number( String( raw ).replace( ',', '.' ) );
	return Number.isFinite( n ) ? n : raw;
};

function NumberField( { step, value, onChange, ui, ids } ) {
	const rules = step.validation ?? {};
	return (
		<div className="sd-input-group">
			<input
				id={ ids.input }
				type="number"
				inputMode="decimal"
				className="sd-input"
				aria-labelledby={ ids.label }
				aria-describedby={ ids.describedBy }
				placeholder={ ui.tx( step.placeholder ) }
				min={ rules.min }
				max={ rules.max }
				step={ rules.step ?? 'any' }
				value={ value ?? '' }
				onInput={ ( event ) =>
					onChange( parseNumber( event.target.value ) )
				}
			/>
			<Suffix step={ step } ui={ ui } />
		</div>
	);
}

function MultiAmount( { step, value, onChange, ui, ids } ) {
	const current = value && typeof value === 'object' ? value : {};
	const total = answerValue( step, current );
	return (
		<div
			className="sd-multi-amount"
			role="group"
			aria-labelledby={ ids.label }
			aria-describedby={ ids.describedBy }
		>
			{ ( step.fields ?? [] ).map( ( field ) => {
				const fieldId = `${ ids.input }-${ field.key }`;
				return (
					<div key={ field.key } className="sd-multi-amount__row">
						<label htmlFor={ fieldId }>
							{ ui.tx( field.label ) }
						</label>
						<div className="sd-input-group">
							<input
								id={ fieldId }
								type="number"
								inputMode="decimal"
								className="sd-input"
								min={ step.validation?.min }
								max={ step.validation?.max }
								step={ step.validation?.step ?? 'any' }
								value={ current[ field.key ] ?? '' }
								onInput={ ( event ) =>
									onChange( {
										...current,
										[ field.key ]: parseNumber(
											event.target.value
										),
									} )
								}
							/>
							<Suffix step={ step } ui={ ui } />
						</div>
					</div>
				);
			} ) }
			{ total !== null && (
				<p className="sd-multi-amount__total" aria-live="polite">
					{ ui.t( 'total' ) } :{ ' ' }
					{ step.currency
						? formatMoney( total, step.currency, ui.locale )
						: total }
				</p>
			) }
		</div>
	);
}

function Slider( { step, value, onChange, ui, ids } ) {
	const rules = step.validation ?? {};
	const min = rules.min ?? 0;
	const max = rules.max ?? 100;
	const initial =
		Math.round( ( min + max ) / 2 / ( rules.step ?? 1 ) ) *
		( rules.step ?? 1 );

	useEffect( () => {
		if ( value === undefined || value === null ) {
			onChange( initial );
		}
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const current = value ?? initial;
	return (
		<div className="sd-slider">
			<input
				id={ ids.input }
				type="range"
				className="sd-slider__input"
				aria-labelledby={ ids.label }
				aria-describedby={ ids.describedBy }
				min={ min }
				max={ max }
				step={ rules.step ?? 1 }
				value={ current }
				onInput={ ( event ) =>
					onChange( Number( event.target.value ) )
				}
			/>
			<output className="sd-slider__value" htmlFor={ ids.input }>
				{ step.currency
					? formatMoney( current, step.currency, ui.locale )
					: current }{ ' ' }
				<Suffix step={ { ...step, currency: undefined } } ui={ ui } />
			</output>
		</div>
	);
}

function Scale( { step, value, onChange, onPick, ui, ids } ) {
	const min = step.validation?.min ?? 1;
	const max = step.validation?.max ?? 5;
	const points = [];
	for ( let i = min; i <= max; i++ ) {
		points.push( i );
	}
	return (
		<div className="sd-scale">
			<div
				className="sd-scale__points"
				role="radiogroup"
				aria-labelledby={ ids.label }
				aria-describedby={ ids.describedBy }
			>
				{ points.map( ( point ) => (
					<label
						key={ point }
						className={ `sd-scale__point${ value === point ? ' is-selected' : '' }` }
					>
						<input
							type="radio"
							name={ ids.input }
							className="sd-option__input"
							checked={ value === point }
							onChange={ () => {
								onChange( point );
								onPick?.();
							} }
						/>
						<span>{ point }</span>
					</label>
				) ) }
			</div>
			{ step.scaleLabels && (
				<div className="sd-scale__labels" aria-hidden="true">
					<span>{ ui.tx( step.scaleLabels.min ) }</span>
					<span>{ ui.tx( step.scaleLabels.max ) }</span>
				</div>
			) }
		</div>
	);
}

const TEXT_TYPES = { text: 'text', email: 'email', phone: 'tel', date: 'date' };
const AUTOCOMPLETE = { email: 'email', phone: 'tel', first_name: 'given-name' };

function TextField( { step, value, onChange, ui, ids } ) {
	const common = {
		id: ids.input,
		className: 'sd-input',
		'aria-labelledby': ids.label,
		'aria-describedby': ids.describedBy,
		placeholder: ui.tx( step.placeholder ),
		value: value ?? '',
		onInput: ( event ) => onChange( event.target.value ),
	};
	if ( step.type === 'textarea' ) {
		return (
			<textarea
				{ ...common }
				rows={ 4 }
				maxLength={ step.validation?.maxLength }
			/>
		);
	}
	return (
		<input
			{ ...common }
			type={ TEXT_TYPES[ step.type ] ?? 'text' }
			autoComplete={
				AUTOCOMPLETE[ step.type ] ?? AUTOCOMPLETE[ step.key ] ?? 'off'
			}
			maxLength={ step.validation?.maxLength }
		/>
	);
}

const FIELDS = {
	single: ChoiceGroup,
	multi: ChoiceGroup,
	yes_no: ChoiceGroup,
	image_choice: ChoiceGroup,
	dropdown: Dropdown,
	number: NumberField,
	amount: NumberField,
	multi_amount: MultiAmount,
	slider: Slider,
	scale: Scale,
	text: TextField,
	textarea: TextField,
	email: TextField,
	phone: TextField,
	date: TextField,
};

/**
 * @param {Object}   props
 * @param {Object}   props.step     Étape question.
 * @param {unknown}  props.value    Réponse.
 * @param {Function} props.onChange Nouvelle réponse.
 * @param {Function} [props.onPick] Choix unique effectué (passage automatique).
 * @param {Object}   props.ui       Helpers d'affichage.
 * @param {Object}   props.ids      Identifiants ARIA.
 */
export function QuestionField( props ) {
	const Field = FIELDS[ props.step.type ] ?? TextField;
	return <Field { ...props } />;
}

export const AUTO_ADVANCE_TYPES = [
	'single',
	'yes_no',
	'image_choice',
	'scale',
];
