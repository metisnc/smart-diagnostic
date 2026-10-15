/**
 * Onglets « Général » (accueil, parcours, langues) et « Intégrations ».
 */
import { Button, TextControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { I18nText, KeyField, ListEditor, NumberField } from '../fields';
import { uniqueKey } from '../utils';
import { EmailEditor } from '../EmailEditor';

function TextList( { label, items, onChange, languages, addLabel } ) {
	return (
		<ListEditor
			label={ label }
			items={ items ?? [] }
			onChange={ onChange }
			newItem={ () => '' }
			addLabel={ addLabel }
			renderItem={ ( item, update ) => (
				<I18nText
					label={ label }
					value={ item }
					languages={ languages }
					onChange={ ( v ) => update( v ?? '' ) }
				/>
			) }
		/>
	);
}

/**
 * Écran d'accueil : affiché ou non, titre, sous-titre, bénéfices, badges, image, bouton.
 *
 * @param {Object}   props
 * @param {Object}   props.config    Config.
 * @param {Function} props.set       ( path, value ) => void.
 * @param {string[]} props.languages Langues.
 */
export function WelcomeEditor( { config, set, languages } ) {
	const welcome = config.welcome ?? {};
	return (
		<>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Show a welcome screen', 'smart-diagnostic' ) }
				checked={
					Boolean( config.welcome ) && welcome.enabled !== false
				}
				onChange={ ( on ) =>
					set(
						[ 'welcome' ],
						on
							? {
									...welcome,
									enabled: undefined,
									title:
										welcome.title ??
										__(
											'Take the diagnostic',
											'smart-diagnostic'
										),
								}
							: undefined
					)
				}
			/>
			{ config.welcome && welcome.enabled !== false && (
				<>
					<I18nText
						label={ __( 'Title', 'smart-diagnostic' ) }
						value={ welcome.title }
						languages={ languages }
						onChange={ ( v ) => set( [ 'welcome', 'title' ], v ) }
					/>
					<I18nText
						multiline
						label={ __( 'Subtitle', 'smart-diagnostic' ) }
						value={ welcome.subtitle }
						languages={ languages }
						onChange={ ( v ) =>
							set( [ 'welcome', 'subtitle' ], v )
						}
					/>
					<TextList
						label={ __( 'Benefits', 'smart-diagnostic' ) }
						addLabel={ __( 'Add a benefit', 'smart-diagnostic' ) }
						items={ welcome.benefits }
						languages={ languages }
						onChange={ ( v ) =>
							set( [ 'welcome', 'benefits' ], v )
						}
					/>
					<TextList
						label={ __( 'Badges', 'smart-diagnostic' ) }
						addLabel={ __( 'Add a badge', 'smart-diagnostic' ) }
						items={ welcome.badges }
						languages={ languages }
						onChange={ ( v ) => set( [ 'welcome', 'badges' ], v ) }
					/>
					<div className="sd-b-row sd-b-row--end">
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							type="url"
							label={ __(
								'Image (optional)',
								'smart-diagnostic'
							) }
							value={ welcome.image?.url ?? '' }
							onChange={ ( v ) =>
								set(
									[ 'welcome', 'image' ],
									v ? { url: v } : undefined
								)
							}
						/>
						{ window.wp?.media && (
							<Button
								variant="secondary"
								onClick={ () => {
									const frame = window.wp.media( {
										title: __(
											'Choose or upload an image',
											'smart-diagnostic'
										),
										library: { type: 'image' },
										multiple: false,
									} );
									frame.on( 'select', () => {
										const image = frame
											.state()
											.get( 'selection' )
											.first()
											.toJSON();
										set( [ 'welcome', 'image' ], {
											id: image.id,
											url: image.url,
										} );
									} );
									frame.open();
								} }
							>
								{ __( 'Choose an image', 'smart-diagnostic' ) }
							</Button>
						) }
					</div>
					<I18nText
						label={ __( 'Start button', 'smart-diagnostic' ) }
						value={ welcome.startLabel }
						languages={ languages }
						onChange={ ( v ) =>
							set( [ 'welcome', 'startLabel' ], v )
						}
					/>
				</>
			) }
		</>
	);
}

export function GeneralTab( { config, set, languages } ) {
	const flow = config.flow ?? {};
	return (
		<div className="sd-b-tab">
			<h3>{ __( 'Languages', 'smart-diagnostic' ) }</h3>
			<div className="sd-b-row">
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __(
						'Languages (codes separated by commas)',
						'smart-diagnostic'
					) }
					help={ __(
						'Example: fr, en. With several languages, each text gets one field per language.',
						'smart-diagnostic'
					) }
					value={ ( config.i18n?.languages ?? [] ).join( ', ' ) }
					onChange={ ( raw ) => {
						const list = raw
							.split( ',' )
							.map( ( l ) => l.trim() )
							.filter( ( l ) =>
								/^[a-z]{2}(_[A-Z]{2})?$/.test( l )
							);
						set(
							[ 'i18n', 'languages' ],
							list.length ? list : undefined
						);
						if (
							list.length &&
							! list.includes( config.i18n?.defaultLanguage )
						) {
							set( [ 'i18n', 'defaultLanguage' ], list[ 0 ] );
						}
					} }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __(
						'Language selector for visitors',
						'smart-diagnostic'
					) }
					checked={ Boolean( config.i18n?.switcher ) }
					onChange={ ( on ) =>
						set( [ 'i18n', 'switcher' ], on || undefined )
					}
				/>
			</div>
			<I18nText
				label={ __( 'Internal title', 'smart-diagnostic' ) }
				value={ config.meta?.title }
				languages={ languages }
				onChange={ ( v ) => set( [ 'meta', 'title' ], v ) }
			/>

			<h3>{ __( 'Welcome screen', 'smart-diagnostic' ) }</h3>
			<WelcomeEditor
				config={ config }
				set={ set }
				languages={ languages }
			/>

			<h3>{ __( 'Journey', 'smart-diagnostic' ) }</h3>
			<div className="sd-b-grid">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Progress bar', 'smart-diagnostic' ) }
					checked={ flow.progress?.bar !== false }
					onChange={ ( on ) =>
						set(
							[ 'flow', 'progress', 'bar' ],
							on ? undefined : false
						)
					}
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Step counter', 'smart-diagnostic' ) }
					checked={ flow.progress?.counter !== false }
					onChange={ ( on ) =>
						set(
							[ 'flow', 'progress', 'counter' ],
							on ? undefined : false
						)
					}
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Section name', 'smart-diagnostic' ) }
					checked={ flow.progress?.sectionName !== false }
					onChange={ ( on ) =>
						set(
							[ 'flow', 'progress', 'sectionName' ],
							on ? undefined : false
						)
					}
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Back button', 'smart-diagnostic' ) }
					checked={ flow.backButton !== false }
					onChange={ ( on ) =>
						set( [ 'flow', 'backButton' ], on ? undefined : false )
					}
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Save progress', 'smart-diagnostic' ) }
					checked={ flow.saveProgress !== false }
					onChange={ ( on ) =>
						set(
							[ 'flow', 'saveProgress' ],
							on ? undefined : false
						)
					}
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __(
						'Go to the next step after a single choice',
						'smart-diagnostic'
					) }
					checked={ Boolean( flow.autoAdvance ) }
					onChange={ ( on ) =>
						set( [ 'flow', 'autoAdvance' ], on || undefined )
					}
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __(
						'Letters A, B, C… on answers',
						'smart-diagnostic'
					) }
					checked={ Boolean( flow.optionLetters ) }
					onChange={ ( on ) =>
						set( [ 'flow', 'optionLetters' ], on || undefined )
					}
				/>
			</div>

			<ListEditor
				label={ __( 'Encouragement messages', 'smart-diagnostic' ) }
				items={ flow.encouragements ?? [] }
				onChange={ ( v ) => set( [ 'flow', 'encouragements' ], v ) }
				newItem={ () => ( {
					atPercent: 50,
					text: __( 'Halfway there!', 'smart-diagnostic' ),
				} ) }
				addLabel={ __( 'Add a message', 'smart-diagnostic' ) }
				renderItem={ ( item, update ) => (
					<div className="sd-b-row">
						<NumberField
							label={ __(
								'At (% of the journey)',
								'smart-diagnostic'
							) }
							min={ 0 }
							max={ 100 }
							value={ item.atPercent }
							onChange={ ( atPercent ) =>
								update( { ...item, atPercent: atPercent ?? 0 } )
							}
						/>
						<I18nText
							label={ __( 'Message', 'smart-diagnostic' ) }
							value={ item.text }
							languages={ languages }
							onChange={ ( text ) =>
								update( { ...item, text: text ?? '' } )
							}
						/>
					</div>
				) }
			/>

			<h3>{ __( 'Before the results', 'smart-diagnostic' ) }</h3>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __(
					'Loading screen before the results',
					'smart-diagnostic'
				) }
				checked={ Boolean( flow.transition?.enabled ) }
				onChange={ ( on ) =>
					set(
						[ 'flow', 'transition' ],
						on
							? {
									durationMs: 3000,
									steps: [
										__(
											'Analysing your answers…',
											'smart-diagnostic'
										),
									],
									...flow.transition,
									enabled: true,
								}
							: undefined
					)
				}
			/>
			{ flow.transition?.enabled && (
				<>
					<NumberField
						label={ __( 'Duration (ms)', 'smart-diagnostic' ) }
						min={ 0 }
						max={ 15000 }
						value={ flow.transition.durationMs }
						onChange={ ( v ) =>
							set( [ 'flow', 'transition', 'durationMs' ], v )
						}
					/>
					<TextList
						label={ __( 'Messages', 'smart-diagnostic' ) }
						addLabel={ __( 'Add a message', 'smart-diagnostic' ) }
						items={ flow.transition.steps }
						languages={ languages }
						onChange={ ( v ) =>
							set( [ 'flow', 'transition', 'steps' ], v )
						}
					/>
				</>
			) }
		</div>
	);
}

export function IntegrationsTab( { config, set, languages } ) {
	const emails = config.integrations?.emails ?? {};
	return (
		<div className="sd-b-tab">
			<h3>{ __( 'Emails', 'smart-diagnostic' ) }</h3>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __(
					'Send the results to the visitor',
					'smart-diagnostic'
				) }
				checked={ emails.user?.enabled !== false }
				onChange={ ( on ) =>
					set(
						[ 'integrations', 'emails', 'user', 'enabled' ],
						on ? undefined : false
					)
				}
			/>
			<I18nText
				label={ __(
					'Subject of the visitor email',
					'smart-diagnostic'
				) }
				value={ emails.user?.subject }
				languages={ languages }
				onChange={ ( v ) =>
					set( [ 'integrations', 'emails', 'user', 'subject' ], v )
				}
			/>
			<EmailEditor
				kind="user"
				config={ config }
				set={ set }
				languages={ languages }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __(
					'Notify the team of each submission',
					'smart-diagnostic'
				) }
				checked={ emails.admin?.enabled !== false }
				onChange={ ( on ) =>
					set(
						[ 'integrations', 'emails', 'admin', 'enabled' ],
						on ? undefined : false
					)
				}
			/>
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __(
					'Team addresses (separated by commas)',
					'smart-diagnostic'
				) }
				help={ __(
					'Empty: the site administration email.',
					'smart-diagnostic'
				) }
				value={ ( emails.admin?.to ?? [] ).join( ', ' ) }
				onChange={ ( raw ) => {
					const list = raw
						.split( ',' )
						.map( ( e ) => e.trim() )
						.filter( Boolean );
					set(
						[ 'integrations', 'emails', 'admin', 'to' ],
						list.length ? list : undefined
					);
				} }
			/>
			<I18nText
				label={ __( 'Subject of the team email', 'smart-diagnostic' ) }
				value={ emails.admin?.subject }
				languages={ languages }
				onChange={ ( v ) =>
					set( [ 'integrations', 'emails', 'admin', 'subject' ], v )
				}
			/>
			<EmailEditor
				kind="admin"
				config={ config }
				set={ set }
				languages={ languages }
			/>

			<h3>{ __( 'Follow-up email', 'smart-diagnostic' ) }</h3>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __(
					'Send a follow-up email to the visitor a few days later',
					'smart-diagnostic'
				) }
				help={ __(
					'Only to visitors who left their email address.',
					'smart-diagnostic'
				) }
				checked={ Boolean( emails.followUp?.enabled ) }
				onChange={ ( on ) =>
					set(
						[ 'integrations', 'emails', 'followUp', 'enabled' ],
						on || undefined
					)
				}
			/>
			{ emails.followUp?.enabled && (
				<>
					<NumberField
						label={ __(
							'Days after the answer',
							'smart-diagnostic'
						) }
						min={ 1 }
						max={ 60 }
						step={ 1 }
						value={ emails.followUp?.delayDays ?? 3 }
						onChange={ ( days ) =>
							set(
								[
									'integrations',
									'emails',
									'followUp',
									'delayDays',
								],
								days === 3 || days === undefined
									? undefined
									: Math.max(
											1,
											Math.min( 60, Math.round( days ) )
										)
							)
						}
					/>
					<I18nText
						label={ __(
							'Subject of the follow-up email',
							'smart-diagnostic'
						) }
						value={ emails.followUp?.subject }
						languages={ languages }
						onChange={ ( v ) =>
							set(
								[
									'integrations',
									'emails',
									'followUp',
									'subject',
								],
								v
							)
						}
					/>
					<EmailEditor
						kind="followUp"
						config={ config }
						set={ set }
						languages={ languages }
					/>
				</>
			) }

			<ListEditor
				label={ __(
					'Webhooks (CRM, Make, Zapier, n8n…)',
					'smart-diagnostic'
				) }
				items={ config.integrations?.webhooks ?? [] }
				onChange={ ( list ) =>
					set( [ 'integrations', 'webhooks' ], list )
				}
				newItem={ ( items ) => ( {
					key: uniqueKey(
						'webhook',
						items.map( ( i ) => i.key )
					),
					url: 'https://',
					events: [ 'submit' ],
				} ) }
				addLabel={ __( 'Add a webhook', 'smart-diagnostic' ) }
				summary={ ( hook ) => `${ hook.key } → ${ hook.url }` }
				renderItem={ ( hook, update ) => (
					<>
						<KeyField
							value={ hook.key }
							onChange={ ( key ) => update( { ...hook, key } ) }
						/>
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							type="url"
							label={ __( 'URL', 'smart-diagnostic' ) }
							value={ hook.url }
							onChange={ ( url ) => update( { ...hook, url } ) }
						/>
						<div className="sd-b-row">
							{ [
								[
									'submit',
									__( 'On submission', 'smart-diagnostic' ),
								],
								[
									'capture',
									__(
										'When contact details are added after the results',
										'smart-diagnostic'
									),
								],
							].map( ( [ event, label ] ) => (
								<ToggleControl
									__nextHasNoMarginBottom
									key={ event }
									label={ label }
									checked={ (
										hook.events ?? [ 'submit' ]
									).includes( event ) }
									onChange={ ( on ) => {
										const events = new Set(
											hook.events ?? [ 'submit' ]
										);
										if ( on ) {
											events.add( event );
										} else {
											events.delete( event );
										}
										update( {
											...hook,
											events: [ ...events ],
										} );
									} }
								/>
							) ) }
						</div>
						<ListEditor
							label={ __(
								'Field mapping (empty: everything is sent)',
								'smart-diagnostic'
							) }
							items={ Object.entries( hook.mapping ?? {} ).map(
								( [ out, path ] ) => ( { out, path } )
							) }
							onChange={ ( list ) => {
								const next = {
									...hook,
									mapping: list?.length
										? Object.fromEntries(
												list.map( ( i ) => [
													i.out,
													i.path,
												] )
											)
										: undefined,
								};
								if ( ! next.mapping ) {
									delete next.mapping;
								}
								update( next );
							} }
							newItem={ () => ( {
								out: 'email',
								path: 'contact.email',
							} ) }
							addLabel={ __( 'Add a field', 'smart-diagnostic' ) }
							renderItem={ ( item, updateItem ) => (
								<div className="sd-b-row">
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __(
											'Sent as',
											'smart-diagnostic'
										) }
										value={ item.out }
										onChange={ ( out ) =>
											updateItem( { ...item, out } )
										}
									/>
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __(
											'Value',
											'smart-diagnostic'
										) }
										help="contact.email, answer.q1, score.axis_1, var.x, profile, result_url…"
										value={ item.path }
										onChange={ ( path ) =>
											updateItem( { ...item, path } )
										}
									/>
								</div>
							) }
						/>
						<p className="description">
							{ __(
								'The signing secret is entered in the “Webhook secrets” box, after saving.',
								'smart-diagnostic'
							) }
						</p>
					</>
				) }
			/>
		</div>
	);
}
