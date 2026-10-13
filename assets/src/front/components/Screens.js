/**
 * Écrans hors questions : accueil, reprise, contenu, formulaire, transition, résultat.
 */
import { useEffect, useState } from 'preact/hooks';
import { RichText, safeUrl } from '../html';
import { prefersReducedMotion } from '../motion';

export function Heading( { text, headingRef, id, level = 2 } ) {
	const Tag = `h${ level }`;
	if ( ! text ) {
		return null;
	}
	return (
		<Tag className="sd-title" id={ id } tabIndex={ -1 } ref={ headingRef }>
			{ text }
		</Tag>
	);
}

export function Welcome( { config, ui, onStart, headingRef } ) {
	const welcome = config.welcome ?? {};
	const image = safeUrl( welcome.image?.url );
	return (
		<div className="sd-screen sd-welcome">
			{ welcome.badges?.length > 0 && (
				<ul className="sd-badges">
					{ welcome.badges.map( ( badge, i ) => (
						<li key={ i } className="sd-badge">
							{ ui.tx( badge ) }
						</li>
					) ) }
				</ul>
			) }
			<Heading
				text={ ui.tx( welcome.title ) || ui.tx( config.meta?.title ) }
				headingRef={ headingRef }
			/>
			{ welcome.subtitle && (
				<RichText
					className="sd-lead"
					html={ ui.tx( welcome.subtitle ) }
				/>
			) }
			{ welcome.benefits?.length > 0 && (
				<ul className="sd-benefits">
					{ welcome.benefits.map( ( benefit, i ) => (
						<li key={ i }>{ ui.tx( benefit ) }</li>
					) ) }
				</ul>
			) }
			{ image && (
				<img
					className="sd-welcome__image"
					src={ image }
					alt={ ui.tx( welcome.image.alt ) }
				/>
			) }
			<div className="sd-actions">
				<button
					type="button"
					className="sd-button sd-button--primary"
					onClick={ onStart }
				>
					{ ui.tx( welcome.startLabel ) || ui.t( 'start' ) }
				</button>
			</div>
		</div>
	);
}

export function ResumePrompt( { ui, onResume, onRestart, headingRef } ) {
	return (
		<div className="sd-screen sd-resume">
			<Heading text={ ui.t( 'resumeTitle' ) } headingRef={ headingRef } />
			<p className="sd-lead">{ ui.t( 'resumeText' ) }</p>
			<div className="sd-actions">
				<button
					type="button"
					className="sd-button sd-button--primary"
					onClick={ onResume }
				>
					{ ui.t( 'resume' ) }
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

/**
 * Contenu libre : texte, citation, image, témoignage, encart promo.
 */
export function ContentBody( { content, ui, headingRef } ) {
	const image = safeUrl( content.image?.url );
	const ctaUrl = safeUrl( content.cta?.url );
	const isQuote =
		content.variant === 'quote' || content.variant === 'testimonial';
	return (
		<div className={ `sd-content sd-content--${ content.variant }` }>
			{ content.title && (
				<Heading
					text={ ui.tx( content.title ) }
					headingRef={ headingRef }
				/>
			) }
			{ image && (
				<img
					className="sd-content__image"
					src={ image }
					alt={ ui.tx( content.image.alt ) }
					loading="lazy"
				/>
			) }
			{ isQuote ? (
				<figure className="sd-quote">
					<blockquote
						tabIndex={ content.title ? undefined : -1 }
						ref={ content.title ? undefined : headingRef }
					>
						<RichText html={ ui.tx( content.body ) } />
					</blockquote>
					{ content.author && (
						<figcaption>
							<strong>{ ui.tx( content.author ) }</strong>
							{ content.authorRole && (
								<span>, { ui.tx( content.authorRole ) }</span>
							) }
						</figcaption>
					) }
				</figure>
			) : (
				<div
					tabIndex={ content.title ? undefined : -1 }
					ref={ content.title ? undefined : headingRef }
				>
					<RichText html={ ui.tx( content.body ) } />
				</div>
			) }
			{ ctaUrl && (
				<a
					className="sd-button sd-button--ghost"
					href={ ctaUrl }
					target="_blank"
					rel="noopener noreferrer"
				>
					{ ui.tx( content.cta.label ) }
				</a>
			) }
		</div>
	);
}

/**
 * Écran de transition avant le résultat.
 */
export function Transition( { transition, ui, onDone, headingRef } ) {
	const steps = transition.steps ?? [];
	const reduced = prefersReducedMotion();
	const duration = reduced ? 0 : ( transition.durationMs ?? 3000 );
	const [ index, setIndex ] = useState( 0 );

	useEffect( () => {
		const done = setTimeout( onDone, duration );
		const interval =
			steps.length > 1 && duration > 0
				? setInterval(
						() =>
							setIndex( ( i ) =>
								Math.min( i + 1, steps.length - 1 )
							),
						duration / steps.length
					)
				: null;
		return () => {
			clearTimeout( done );
			if ( interval ) {
				clearInterval( interval );
			}
		};
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div
			className="sd-screen sd-transition"
			role="status"
			aria-live="polite"
		>
			<div className="sd-spinner" aria-hidden="true" />
			<p
				className="sd-transition__text"
				tabIndex={ -1 }
				ref={ headingRef }
			>
				{ steps.length ? ui.tx( steps[ index ] ) : '' }
			</p>
		</div>
	);
}
