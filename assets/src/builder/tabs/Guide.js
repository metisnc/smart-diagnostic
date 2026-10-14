/**
 * Onglet « Guide » : fonctionnement d'un diagnostic expliqué simplement, étapes de création,
 * liste de vérification calculée sur le diagnostic en cours, lexique et questions fréquentes.
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Points de contrôle calculés sur la configuration.
 *
 * @param {Object}  config Config.
 * @param {boolean} valid  Config valide au regard du schéma.
 * @return {Array<{ok: boolean, optional?: boolean, text: string, tab: string}>} Points.
 */
export function checklist( config, valid ) {
	const steps = config.steps ?? [];
	const questions = steps.filter( ( step ) => step.kind === 'question' );
	const form = steps.find( ( step ) => step.kind === 'form' );
	const outcomes = config.outcomes ?? {};
	const hasPoints =
		( config.scoring?.rules ?? [] ).length > 0 ||
		questions.some( ( step ) =>
			( step.options ?? [] ).some(
				( option ) => Object.keys( option.scores ?? {} ).length
			)
		);
	return [
		{
			ok: questions.length >= 3,
			text: __(
				'At least 3 questions in the journey',
				'smart-diagnostic'
			),
			tab: 'steps',
		},
		{
			ok: Boolean(
				form?.fields?.some( ( field ) => field.type === 'email' )
			),
			text: __(
				'A contact form asking for the email (to send the result and collect leads)',
				'smart-diagnostic'
			),
			tab: 'steps',
		},
		{
			ok: ( config.axes ?? [] ).length > 0,
			text: __(
				'At least one theme to score (axis)',
				'smart-diagnostic'
			),
			tab: 'scoring',
		},
		{
			ok: hasPoints,
			text: __( 'Answers that earn points', 'smart-diagnostic' ),
			tab: 'steps',
		},
		{
			ok: ( outcomes.profiles ?? [] ).length > 0,
			text: __( 'Profiles to classify the visitors', 'smart-diagnostic' ),
			tab: 'results',
		},
		{
			ok: ( outcomes.ctas ?? [] ).length > 0,
			text: __(
				'A recommended action (button to book a call, buy, contact you…)',
				'smart-diagnostic'
			),
			tab: 'results',
		},
		{
			ok: Boolean( config.welcome?.title ),
			optional: true,
			text: __(
				'A welcome screen that makes people want to start',
				'smart-diagnostic'
			),
			tab: 'general',
		},
		{
			ok: valid,
			text: __( 'No error in the configuration', 'smart-diagnostic' ),
			tab: 'json',
		},
	];
}

const FLOW = () => [
	{
		title: __( 'Questions', 'smart-diagnostic' ),
		text: __(
			'The visitor answers your questions, one screen at a time.',
			'smart-diagnostic'
		),
		example: __( '“Do you have a website?” → Yes', 'smart-diagnostic' ),
	},
	{
		title: __( 'Points', 'smart-diagnostic' ),
		text: __(
			'Each answer can earn points on one or more themes.',
			'smart-diagnostic'
		),
		example: __( 'Yes = 10 points in “Visibility”', 'smart-diagnostic' ),
	},
	{
		title: __( 'Scores', 'smart-diagnostic' ),
		text: __(
			'Points add up into a score per theme (an “axis”), shown as a chart.',
			'smart-diagnostic'
		),
		example: __( 'Visibility: 70 / 100', 'smart-diagnostic' ),
	},
	{
		title: __( 'Profile', 'smart-diagnostic' ),
		text: __(
			'The scores decide which profile the visitor gets.',
			'smart-diagnostic'
		),
		example: __( 'Score over 60 → “Well on the way”', 'smart-diagnostic' ),
	},
	{
		title: __( 'Result', 'smart-diagnostic' ),
		text: __(
			'A personalised result page, an email, advice and a recommended action.',
			'smart-diagnostic'
		),
		example: __( '“Book a free call” button', 'smart-diagnostic' ),
	},
];

const STEPS = () => [
	{
		tab: 'steps',
		title: __( 'Journey', 'smart-diagnostic' ),
		text: __(
			'Write your questions and choose how people answer: choices, yes / no, scale, slider, amount, text… Group them in sections, add information screens, show a question only in some cases, and end with the contact form (first name, email, consent).',
			'smart-diagnostic'
		),
	},
	{
		tab: 'scoring',
		title: __( 'Calculation', 'smart-diagnostic' ),
		text: __(
			'Create the themes you want to score (for example Visibility, Sales, Organisation). The points of each answer are set in the Journey tab, next to each answer; here you can add extra rules (bonus, cap, count…).',
			'smart-diagnostic'
		),
	},
	{
		tab: 'results',
		title: __( 'Results', 'smart-diagnostic' ),
		text: __(
			'Create the profiles (from the scores), the texts shown according to the answers, the action plan and the recommended action button. Then choose what the result page shows: chart, scores, advice…',
			'smart-diagnostic'
		),
	},
	{
		tab: 'general',
		title: __( 'General', 'smart-diagnostic' ),
		text: __(
			'The welcome screen (title, benefits, start button), the languages, the progress bar, the encouragement messages and the waiting screen before the result.',
			'smart-diagnostic'
		),
	},
	{
		tab: 'design',
		title: __( 'Appearance', 'smart-diagnostic' ),
		text: __(
			'Your colours, fonts, rounded corners and logo. The emails use the same look.',
			'smart-diagnostic'
		),
	},
	{
		tab: 'integrations',
		title: __( 'Integrations', 'smart-diagnostic' ),
		text: __(
			'The email sent to the visitor with the result, the notification to your team, the follow-up email a few days later, and the sending to your CRM or tools (Make, Zapier…).',
			'smart-diagnostic'
		),
	},
	{
		tab: 'test',
		title: __( 'Test', 'smart-diagnostic' ),
		text: __(
			'Answer as a visitor would and check the result: scores, profile, advice. Nothing is saved. Try several typical answers.',
			'smart-diagnostic'
		),
	},
];

const GLOSSARY = () => [
	[
		__( 'Axis', 'smart-diagnostic' ),
		__(
			'A theme you score, for example “Visibility”. The result shows one score per axis.',
			'smart-diagnostic'
		),
	],
	[
		__( 'Points', 'smart-diagnostic' ),
		__(
			'What an answer is worth on an axis. More points = better score.',
			'smart-diagnostic'
		),
	],
	[
		__( 'Profile', 'smart-diagnostic' ),
		__(
			'The category the visitor falls into according to the scores, with its own text.',
			'smart-diagnostic'
		),
	],
	[
		__( 'Recommended action (CTA)', 'smart-diagnostic' ),
		__(
			'The button offered at the end: book a call, see an offer, download a guide…',
			'smart-diagnostic'
		),
	],
	[
		__( 'Section', 'smart-diagnostic' ),
		__(
			'A group of questions, shown in the progress bar.',
			'smart-diagnostic'
		),
	],
	[
		__( 'Condition', 'smart-diagnostic' ),
		__(
			'A rule that shows a question, a text or a profile only in some cases (“if the answer is Yes”).',
			'smart-diagnostic'
		),
	],
	[
		__( 'Jump', 'smart-diagnostic' ),
		__(
			'Goes directly to another question according to the answer.',
			'smart-diagnostic'
		),
	],
	[
		__( 'Key', 'smart-diagnostic' ),
		__(
			'A short technical name (no spaces) used to recognise an item in rules and exports. It is filled in for you.',
			'smart-diagnostic'
		),
	],
];

const FAQ = () => [
	[
		__( 'Where do I see the answers of my visitors?', 'smart-diagnostic' ),
		__(
			'In the Submissions menu: each answer, the contact details, the scores and the profile, with filters and an export for Excel. The Statistics menu shows how many people start, finish or drop out.',
			'smart-diagnostic'
		),
	],
	[
		__( 'How do I put the diagnostic on my site?', 'smart-diagnostic' ),
		__(
			'Publish it, then in any page add the “Diagnostic” block, or paste the shortcode shown in the Insertion box on the right.',
			'smart-diagnostic'
		),
	],
	[
		__(
			'Can I change the diagnostic once it is online?',
			'smart-diagnostic'
		),
		__(
			'Yes. Changes apply as soon as you click Update. Avoid renaming the keys of questions already answered, so that the answers stay readable.',
			'smart-diagnostic'
		),
	],
	[
		__(
			'A message says the configuration has errors.',
			'smart-diagnostic'
		),
		__(
			'The badge at the top shows the number of errors and the list under it says where they are. While there are errors, the previous version stays online: nothing breaks for your visitors.',
			'smart-diagnostic'
		),
	],
	[
		__( 'Does the visitor have to give an email?', 'smart-diagnostic' ),
		__(
			'Only if you want: the contact form is optional and can be placed before or after the result. Without email, the visitor still sees the result on screen.',
			'smart-diagnostic'
		),
	],
];

/**
 * @param {Object}   props
 * @param {Object}   props.config Config.
 * @param {boolean}  props.valid  Config valide.
 * @param {Function} props.goTo   ( tab ) => void : ouvre un onglet.
 */
export function GuideTab( { config, valid, goTo } ) {
	const checks = checklist( config, valid );
	const done = checks.filter( ( check ) => check.ok ).length;
	const templatesUrl = window.sdAdmin?.templatesUrl;

	return (
		<div className="sd-b-tab sd-guide">
			<section className="sd-guide__intro">
				<h3>
					{ __(
						'Create your diagnostic in a few steps',
						'smart-diagnostic'
					) }
				</h3>
				<p>
					{ __(
						'A diagnostic is a short questionnaire that gives each visitor a personalised result: a score, a profile, advice and a recommended action. You collect qualified contacts, and your visitors learn something useful.',
						'smart-diagnostic'
					) }
				</p>
				<div className="sd-guide__start">
					{ templatesUrl && (
						<Button variant="primary" href={ templatesUrl }>
							{ __(
								'Start from a ready-made template',
								'smart-diagnostic'
							) }
						</Button>
					) }
					<Button
						variant="secondary"
						onClick={ () => goTo( 'steps' ) }
					>
						{ __( 'Start from scratch', 'smart-diagnostic' ) }
					</Button>
				</div>
				<p className="description">
					{ __(
						'Tip: a template is the fastest way. You get a complete diagnostic that you only have to adapt.',
						'smart-diagnostic'
					) }
				</p>
			</section>

			<section>
				<h3>{ __( 'How it works', 'smart-diagnostic' ) }</h3>
				<ol className="sd-guide__flow">
					{ FLOW().map( ( item, index ) => (
						<li key={ index } className="sd-guide__flow-item">
							<span className="sd-guide__number">
								{ index + 1 }
							</span>
							<strong>{ item.title }</strong>
							<span>{ item.text }</span>
							<em>{ item.example }</em>
						</li>
					) ) }
				</ol>
			</section>

			<section>
				<h3>
					{ __( 'Your checklist', 'smart-diagnostic' ) }{ ' ' }
					<span className="sd-guide__progress">
						{ done } / { checks.length }
					</span>
				</h3>
				<ul className="sd-guide__checks">
					{ checks.map( ( check, index ) => (
						<li
							key={ index }
							className={ check.ok ? 'is-done' : 'is-todo' }
						>
							<span
								className="sd-guide__check"
								aria-hidden="true"
							>
								{ check.ok ? '✓' : '' }
							</span>
							<span className="sd-guide__check-text">
								{ check.text }
								{ check.optional && (
									<span className="sd-guide__optional">
										{ __(
											'recommended',
											'smart-diagnostic'
										) }
									</span>
								) }
								<span className="screen-reader-text">
									{ check.ok
										? __( 'done', 'smart-diagnostic' )
										: __( 'to do', 'smart-diagnostic' ) }
								</span>
							</span>
							{ ! check.ok && (
								<Button
									variant="link"
									onClick={ () => goTo( check.tab ) }
								>
									{ __( 'Do it', 'smart-diagnostic' ) }
								</Button>
							) }
						</li>
					) ) }
				</ul>
			</section>

			<section>
				<h3>{ __( 'Step by step', 'smart-diagnostic' ) }</h3>
				<ol className="sd-guide__steps">
					{ STEPS().map( ( step, index ) => (
						<li key={ step.tab } className="sd-guide__step">
							<span className="sd-guide__number">
								{ index + 1 }
							</span>
							<div>
								<strong>{ step.title }</strong>
								<p>{ step.text }</p>
							</div>
							<Button
								variant="secondary"
								size="small"
								onClick={ () => goTo( step.tab ) }
							>
								{ __( 'Open', 'smart-diagnostic' ) }
							</Button>
						</li>
					) ) }
					<li className="sd-guide__step">
						<span className="sd-guide__number">
							{ STEPS().length + 1 }
						</span>
						<div>
							<strong>
								{ __( 'Publish', 'smart-diagnostic' ) }
							</strong>
							<p>
								{ __(
									'Give a title at the top of the page, click Publish, then insert the diagnostic in a page with the “Diagnostic” block or the shortcode of the Insertion box.',
									'smart-diagnostic'
								) }
							</p>
						</div>
					</li>
				</ol>
			</section>

			<section>
				<h3>{ __( 'Words to know', 'smart-diagnostic' ) }</h3>
				<dl className="sd-guide__glossary">
					{ GLOSSARY().map( ( [ term, definition ] ) => (
						<div key={ term }>
							<dt>{ term }</dt>
							<dd>{ definition }</dd>
						</div>
					) ) }
				</dl>
			</section>

			<section>
				<h3>{ __( 'Frequent questions', 'smart-diagnostic' ) }</h3>
				{ FAQ().map( ( [ question, answer ] ) => (
					<details key={ question } className="sd-guide__faq">
						<summary>{ question }</summary>
						<p>{ answer }</p>
					</details>
				) ) }
			</section>
		</div>
	);
}
