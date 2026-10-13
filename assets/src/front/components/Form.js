/**
 * Formulaire de capture (étape kind = form). L'envoi au serveur arrive en M3 :
 * ici on collecte et valide les champs et le consentement.
 */
import { RichText } from '../html';
import { Heading } from './Screens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ().-]{6,20}$/;
const INPUT_TYPES = { text: 'text', email: 'email', phone: 'tel' };
const AUTOCOMPLETE = {
	first_name: 'given-name',
	last_name: 'family-name',
	email: 'email',
	phone: 'tel',
	company: 'organization',
};

/**
 * @param {Object} step    Étape formulaire.
 * @param {Object} contact Valeurs saisies.
 * @param {boolean} consent Consentement coché.
 * @return {Object<string, string>} Clé de message d'erreur par champ.
 */
export function validateForm( step, contact, consent ) {
	const errors = {};
	for ( const field of step.fields ?? [] ) {
		const value = contact[ field.key ];
		const empty =
			value === undefined ||
			value === null ||
			value === '' ||
			value === false;
		if ( empty ) {
			if ( field.required ) {
				errors[ field.key ] = 'required';
			}
			continue;
		}
		if (
			field.type === 'email' &&
			! EMAIL.test( String( value ).trim() )
		) {
			errors[ field.key ] = 'invalidEmail';
		}
		if (
			field.type === 'phone' &&
			! PHONE.test( String( value ).trim() )
		) {
			errors[ field.key ] = 'invalidPhone';
		}
	}
	if ( step.consent && step.consent.required !== false && ! consent ) {
		errors.__consent = 'consentRequired';
	}
	return errors;
}

export function FormStep( {
	step,
	contact,
	consent,
	errors,
	onChange,
	onConsent,
	ui,
	idBase,
	headingRef,
} ) {
	const fieldId = ( key ) => `${ idBase }-${ key }`;
	const errorId = ( key ) => `${ idBase }-${ key }-error`;

	const renderControl = ( field ) => {
		const common = {
			id: fieldId( field.key ),
			'aria-invalid': errors[ field.key ] ? 'true' : undefined,
			'aria-describedby': errors[ field.key ]
				? errorId( field.key )
				: undefined,
			required: field.required,
		};
		if ( field.type === 'checkbox' ) {
			return (
				<input
					{ ...common }
					type="checkbox"
					className="sd-checkbox"
					checked={ Boolean( contact[ field.key ] ) }
					onChange={ ( event ) =>
						onChange( field.key, event.target.checked )
					}
				/>
			);
		}
		if ( field.type === 'select' ) {
			return (
				<select
					{ ...common }
					className="sd-input sd-input--select"
					value={ contact[ field.key ] ?? '' }
					onChange={ ( event ) =>
						onChange( field.key, event.target.value )
					}
				>
					<option value="">{ ui.t( 'selectPlaceholder' ) }</option>
					{ ( field.options ?? [] ).map( ( option ) => (
						<option
							key={ String( option.value ) }
							value={ String( option.value ) }
						>
							{ ui.tx( option.label ) }
						</option>
					) ) }
				</select>
			);
		}
		if ( field.type === 'textarea' ) {
			return (
				<textarea
					{ ...common }
					className="sd-input"
					rows={ 3 }
					value={ contact[ field.key ] ?? '' }
					onInput={ ( event ) =>
						onChange( field.key, event.target.value )
					}
				/>
			);
		}
		return (
			<input
				{ ...common }
				type={ INPUT_TYPES[ field.type ] ?? 'text' }
				className="sd-input"
				autoComplete={ AUTOCOMPLETE[ field.key ] ?? 'on' }
				placeholder={ ui.tx( field.placeholder ) }
				value={ contact[ field.key ] ?? '' }
				onInput={ ( event ) =>
					onChange( field.key, event.target.value )
				}
			/>
		);
	};

	return (
		<div className="sd-form">
			<Heading text={ ui.tx( step.title ) } headingRef={ headingRef } />
			{ step.text && (
				<RichText className="sd-lead" html={ ui.tx( step.text ) } />
			) }
			{ ( step.fields ?? [] ).map( ( field ) => (
				<div
					key={ field.key }
					className={ `sd-field sd-field--${ field.type }` }
				>
					{ field.type === 'checkbox' ? (
						<label
							className="sd-checkbox-label"
							htmlFor={ fieldId( field.key ) }
						>
							{ renderControl( field ) }
							<span>{ ui.tx( field.label ) }</span>
						</label>
					) : (
						<>
							<label
								className="sd-label"
								htmlFor={ fieldId( field.key ) }
							>
								{ ui.tx( field.label ) }
								{ field.required && (
									<span aria-hidden="true"> *</span>
								) }
							</label>
							{ renderControl( field ) }
						</>
					) }
					{ errors[ field.key ] && (
						<p className="sd-error" id={ errorId( field.key ) }>
							{ ui.t( errors[ field.key ] ) }
						</p>
					) }
				</div>
			) ) }
			{ step.consent && (
				<div className="sd-field sd-field--consent">
					<label
						className="sd-checkbox-label"
						htmlFor={ fieldId( '__consent' ) }
					>
						<input
							id={ fieldId( '__consent' ) }
							type="checkbox"
							className="sd-checkbox"
							checked={ consent }
							aria-invalid={
								errors.__consent ? 'true' : undefined
							}
							aria-describedby={
								errors.__consent
									? errorId( '__consent' )
									: undefined
							}
							onChange={ ( event ) =>
								onConsent( event.target.checked )
							}
						/>
						<RichText
							as="span"
							html={ ui.tx( step.consent.text ) }
						/>
					</label>
					{ errors.__consent && (
						<p className="sd-error" id={ errorId( '__consent' ) }>
							{ ui.t( errors.__consent ) }
						</p>
					) }
				</div>
			) }
		</div>
	);
}
