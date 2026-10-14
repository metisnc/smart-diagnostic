<?php
/**
 * Emails : résultat au visiteur, notification à l'administrateur.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Integrations;

use SmartDiagnostic\Branding;
use SmartDiagnostic\Engine\Text;
use SmartDiagnostic\Rest\SubmitController;
use SmartDiagnostic\Storage\SubmissionRepository;

/**
 * Les modèles sont dans templates/emails/ ; un thème peut les remplacer en les
 * copiant dans <thème>/smart-diagnostic/emails/.
 */
final class Mailer {

	public function __construct(
		private SubmissionRepository $submissions = new SubmissionRepository(),
		private MailTransport $transport = new MailTransport()
	) {}

	public function register(): void {
		add_action( 'sd_submission_created', array( $this, 'on_created' ), 10, 2 );
		add_action( 'sd_submission_contact_updated', array( $this, 'on_contact_updated' ), 10, 2 );
	}

	/**
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public function on_created( array $submission, array $config ): void {
		$this->send_user( $submission, $config );
		$this->send_admin( $submission, $config );
	}

	/**
	 * Email ajouté après le résultat : on envoie le résultat s'il ne l'a pas encore été.
	 *
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public function on_contact_updated( array $submission, array $config ): void {
		$this->send_user( $submission, $config );
	}

	/**
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public function send_user( array $submission, array $config ): bool {
		$settings = $config['integrations']['emails']['user'] ?? array();
		$email    = (string) ( $submission['email'] ?? '' );
		if ( false === ( $settings['enabled'] ?? true ) || false === ( $config['results']['emailResult'] ?? true ) ) {
			return false;
		}
		if ( '' === $email || ! is_email( $email ) || ! empty( $submission['user_email_sent_at'] ) ) {
			return false;
		}

		$email_content = $this->compose( 'user', $submission, $config );
		$result        = $this->transport->send( $email, $email_content['subject'], $email_content['body'] );
		$this->record( $submission, 'user', $email, $result );
		return $result['ok'];
	}

	/**
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public function send_admin( array $submission, array $config ): bool {
		$settings = $config['integrations']['emails']['admin'] ?? array();
		if ( false === ( $settings['enabled'] ?? true ) ) {
			return false;
		}
		$recipients = array_values( array_filter( (array) ( $settings['to'] ?? array() ), 'is_email' ) );
		if ( array() === $recipients ) {
			$recipients = array( (string) get_option( 'admin_email' ) );
		}

		$email_content = $this->compose( 'admin', $submission, $config );
		$to            = implode( ',', $recipients );
		$result        = $this->transport->send( $to, $email_content['subject'], $email_content['body'] );
		$this->record( $submission, 'admin', $to, $result );
		return $result['ok'];
	}

	/**
	 * Objet et corps d'un email : modèle personnalisé du diagnostic s'il existe, sinon modèle par défaut.
	 *
	 * @param string               $kind       user | admin.
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 * @return array{subject: string, body: string, custom: bool}
	 */
	public function compose( string $kind, array $submission, array $config ): array {
		$settings = $config['integrations']['emails'][ $kind ] ?? array();
		$subject  = $this->text( $settings['subject'] ?? null, $config, $submission );
		if ( '' === $subject ) {
			$subject = 'user' === $kind
				? __( 'Your results', 'smart-diagnostic' )
				/* translators: 1: diagnostic title, 2: first name or email. */
				: sprintf( __( 'New submission: %1$s (%2$s)', 'smart-diagnostic' ), get_the_title( (int) ( $submission['diagnostic_id'] ?? 0 ) ), $submission['first_name'] ?: $submission['email'] ?: '—' ); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
		}

		$custom = Text::resolve( $settings['body'] ?? null, (string) ( $submission['lang'] ?? '' ), (string) ( $config['i18n']['defaultLanguage'] ?? '' ) );
		if ( '' !== trim( $custom ) ) {
			return array(
				'subject' => $subject,
				'body'    => CustomEmail::render( $custom, ! empty( $settings['fullHtml'] ), $submission, $config ),
				'custom'  => true,
			);
		}
		return array(
			'subject' => $subject,
			'body'    => $this->render( (string) ( $settings['template'] ?? $kind ), $submission, $config ),
			'custom'  => false,
		);
	}

	/**
	 * Soumission fictive pour l'aperçu des emails dans le constructeur : premier profil,
	 * scores à mi-échelle, tous les textes et actions, premier CTA.
	 *
	 * @param array<string, mixed> $config Config.
	 * @return array<string, mixed>
	 */
	public static function sample_submission( array $config, int $diagnostic_id = 0 ): array {
		$scores = array();
		foreach ( $config['axes'] ?? array() as $axis ) {
			$scores[ $axis['key'] ] = ( (float) ( $axis['min'] ?? 0 ) + (float) ( $axis['max'] ?? 100 ) ) / 2;
		}
		$answers = array();
		foreach ( $config['steps'] ?? array() as $step ) {
			if ( 'question' === ( $step['kind'] ?? '' ) && ! empty( $step['options'] ) ) {
				$answers[ $step['key'] ] = 'multi' === ( $step['type'] ?? '' ) ? array( $step['options'][0]['value'] ) : $step['options'][0]['value'];
			}
		}
		$outcomes = $config['outcomes'] ?? array();
		return array(
			'id'            => 0,
			'diagnostic_id' => $diagnostic_id,
			'token'         => str_repeat( '0', 32 ),
			'source_url'    => home_url( '/' ),
			'created_at'    => current_time( 'mysql', true ),
			'first_name'    => __( 'Marie', 'smart-diagnostic' ),
			'email'         => 'marie@example.com',
			'contact'       => array(
				'first_name' => __( 'Marie', 'smart-diagnostic' ),
				'email'      => 'marie@example.com',
			),
			'answers'       => $answers,
			'scores'        => $scores,
			'vars'          => array(),
			'lang'          => (string) ( $config['i18n']['defaultLanguage'] ?? '' ),
			'result'        => array(
				'profile' => $outcomes['profiles'][0]['key'] ?? null,
				'texts'   => array_column( $outcomes['texts'] ?? array(), 'key' ),
				'actions' => array_column( $outcomes['actions'] ?? array(), 'key' ),
				'cta'     => $outcomes['ctas'][0]['key'] ?? null,
			),
		);
	}

	/**
	 * @param mixed                $text       Texte de la config.
	 * @param array<string, mixed> $config     Config.
	 * @param array<string, mixed> $submission Soumission.
	 */
	private function text( mixed $text, array $config, array $submission ): string {
		$resolved = Text::resolve( $text, (string) ( $submission['lang'] ?? '' ), (string) ( $config['i18n']['defaultLanguage'] ?? '' ) );
		return wp_strip_all_tags( Text::interpolate( $resolved, $config, $submission ) );
	}

	/**
	 * Statut d'envoi conservé dans la soumission (visible dans l'admin « Réponses »).
	 *
	 * @param array<string, mixed>                        $submission Soumission.
	 * @param string                                      $kind       user | admin.
	 * @param string                                      $to         Destinataire(s).
	 * @param array{ok: bool, error: string, via: string} $result     Résultat de l'envoi.
	 */
	private function record( array $submission, string $kind, string $to, array $result ): void {
		if ( empty( $submission['id'] ) ) {
			return;
		}
		$now   = current_time( 'mysql', true );
		$fresh = $this->submissions->find( (int) $submission['id'] );
		$state = (array) ( $fresh['emails'] ?? array() );

		$state[ $kind ] = array(
			'status' => $result['ok'] ? 'sent' : 'failed',
			'to'     => $to,
			'via'    => $result['via'],
			'error'  => $result['error'],
			'at'     => $now,
		);
		$update         = array( 'emails' => $state );
		if ( 'user' === $kind && $result['ok'] ) {
			$update['user_email_sent_at'] = $now;
		}
		$this->submissions->update( (int) $submission['id'], $update );
	}

	/**
	 * Email de test (bouton des réglages) : même chemin d'envoi que les vrais emails.
	 *
	 * @return array{ok: bool, error: string, via: string}
	 */
	public function send_test( string $to ): array {
		$body = '<p>' . esc_html__( 'This is a test email. If you are reading it, the emails of your diagnostics will be delivered.', 'smart-diagnostic' ) . '</p>';
		/* translators: %s: plugin name. */
		return $this->transport->send( $to, sprintf( __( '%s: test email', 'smart-diagnostic' ), Branding::name() ), $body );
	}

	/**
	 * Rend un modèle d'email avec ses données.
	 *
	 * @param string               $template   Nom du modèle (user, admin…).
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public function render( string $template, array $submission, array $config ): string {
		$file = self::locate( 'emails/' . sanitize_file_name( $template ) . '.php' )
			?? self::locate( 'emails/user.php' );
		if ( null === $file ) {
			return '';
		}

		$data = self::template_data( $submission, $config );
		ob_start();
		( static function ( string $sd_file, array $sd ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- $sd est utilisé par le modèle.
			include $sd_file;
		} )( $file, $data );
		return (string) ob_get_clean();
	}

	/**
	 * Données exposées aux modèles (variable $sd).
	 *
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 * @return array<string, mixed>
	 */
	public static function template_data( array $submission, array $config ): array {
		$lang     = (string) ( $submission['lang'] ?? '' );
		$fallback = (string) ( $config['i18n']['defaultLanguage'] ?? '' );
		$tx       = static fn( mixed $text ): string => Text::interpolate( Text::resolve( $text, $lang, $fallback ), $config, $submission );
		$find     = static function ( string $outcome_list, ?string $key ) use ( $config ): ?array {
			foreach ( $config['outcomes'][ $outcome_list ] ?? array() as $item ) {
				if ( $item['key'] === $key ) {
					return $item;
				}
			}
			return null;
		};

		$result  = (array) ( $submission['result'] ?? array() );
		$profile = $find( 'profiles', $result['profile'] ?? null );
		$cta     = $find( 'ctas', $result['cta'] ?? null );

		$scores = array();
		foreach ( $config['axes'] ?? array() as $axis ) {
			$scores[] = array(
				'label' => $tx( $axis['label'] ?? $axis['key'] ),
				'value' => round( (float) ( $submission['scores'][ $axis['key'] ] ?? 0 ) ),
				'max'   => $axis['max'] ?? 100,
			);
		}

		$answers = array();
		foreach ( $config['steps'] ?? array() as $step ) {
			if ( 'question' === ( $step['kind'] ?? '' ) && array_key_exists( $step['key'], (array) $submission['answers'] ) ) {
				$answers[] = array(
					'label' => wp_strip_all_tags( $tx( $step['label'] ?? $step['key'] ) ),
					'value' => Text::display_answer( $config, $step['key'], $submission['answers'][ $step['key'] ], $lang, $fallback ),
				);
			}
		}

		$items = static fn( string $outcome_list, array $keys ): array => array_values(
			array_filter(
				array_map(
					static function ( string $key ) use ( $find, $outcome_list, $tx ): ?array {
						$item = $find( $outcome_list, $key );
						return null === $item ? null : array(
							'title' => $tx( $item['title'] ?? '' ),
							'body'  => $tx( $item['body'] ?? '' ),
						);
					},
					$keys
				)
			)
		);

		$theme = self::email_theme( $config );

		return array(
			'brand'      => Branding::name(),
			'color'      => $theme['primary'],
			'theme'      => $theme,
			'title'      => $tx( $config['results']['title'] ?? '' ) ?: __( 'Your results', 'smart-diagnostic' ), // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
			'first_name' => (string) ( $submission['first_name'] ?? '' ),
			'email'      => (string) ( $submission['email'] ?? '' ),
			'profile'    => null === $profile ? null : array(
				'label' => $tx( $profile['label'] ?? '' ),
				'text'  => $tx( $profile['text'] ?? '' ),
			),
			'scores'     => $scores,
			'texts'      => $items( 'texts', (array) ( $result['texts'] ?? array() ) ),
			'actions'    => $items( 'actions', (array) ( $result['actions'] ?? array() ) ),
			'cta'        => null === $cta ? null : array(
				'label' => $tx( $cta['label'] ?? '' ),
				'url'   => self::with_utm( (string) ( $cta['url'] ?? '' ), (array) ( $cta['utm'] ?? array() ) ),
			),
			'result_url' => SubmitController::result_url( $submission ),
			'admin_url'  => admin_url( 'edit.php?post_type=sd_diagnostic&page=sd-submissions&submission=' . (int) ( $submission['id'] ?? 0 ) ),
			'answers'    => $answers,
			'submission' => $submission,
			'config'     => $config,
		);
	}

	/**
	 * Apparence du questionnaire (onglet « Apparence »), validée pour un usage dans les emails.
	 * Mêmes valeurs par défaut que le questionnaire.
	 *
	 * @param array<string, mixed> $config Config.
	 * @return array{primary: string, primary_text: string, background: string, surface: string, text: string, muted: string, font: string, heading_font: string, radius: string, logo: string, logo_alt: string}
	 */
	public static function email_theme( array $config ): array {
		$theme  = (array) ( $config['ui']['theme'] ?? array() );
		$colors = (array) ( $theme['colors'] ?? array() );
		$color  = static function ( string $key, string $fallback ) use ( $colors ): string {
			$value = (string) ( $colors[ $key ] ?? '' );
			return 1 === preg_match( '/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $value ) ? $value : $fallback;
		};
		$font   = static function ( mixed $value, string $fallback ): string {
			$value = trim( (string) $value );
			if ( '' === $value || 1 !== preg_match( '/^[\w\s,\'"-]+$/u', $value ) ) {
				return $fallback;
			}
			// Repli sur des polices standard : beaucoup de messageries n'ont pas les polices du site.
			return $value . ', Arial, Helvetica, sans-serif';
		};
		$radius = (string) ( $theme['radius'] ?? '' );
		$logo   = (string) ( $config['ui']['logo']['url'] ?? '' );
		if ( str_starts_with( $logo, '/' ) && ! str_starts_with( $logo, '//' ) ) {
			$logo = home_url( $logo ); // Une image d'email doit avoir une adresse complète.
		}

		$base = $font( $theme['fontFamily'] ?? '', 'Arial, Helvetica, sans-serif' );
		return array(
			'primary'      => $color( 'primary', '#2563eb' ),
			'primary_text' => $color( 'primaryText', '#ffffff' ),
			'background'   => $color( 'background', '#ffffff' ),
			'surface'      => $color( 'surface', '#f5f7fa' ),
			'text'         => $color( 'text', '#1f2937' ),
			'muted'        => $color( 'muted', '#6b7280' ),
			'font'         => $base,
			'heading_font' => '' !== trim( (string) ( $theme['headingFontFamily'] ?? '' ) ) ? $font( $theme['headingFontFamily'], $base ) : $base,
			// Les messageries gèrent mal les unités relatives : px uniquement.
			'radius'       => 1 === preg_match( '/^\d+(\.\d+)?px$/', $radius ) ? $radius : '12px',
			'logo'         => 1 === preg_match( '#^https?://#i', $logo ) ? $logo : '',
			'logo_alt'     => wp_strip_all_tags( Text::resolve( $config['ui']['logo']['alt'] ?? '' ) ),
		);
	}

	/**
	 * @param string                $url Adresse.
	 * @param array<string, string> $utm UTM.
	 */
	private static function with_utm( string $url, array $utm ): string {
		$args = array();
		foreach ( $utm as $key => $value ) {
			if ( '' !== (string) $value ) {
				$args[ 'utm_' . $key ] = $value;
			}
		}
		return $args ? add_query_arg( array_map( 'rawurlencode', $args ), $url ) : $url;
	}

	/**
	 * Modèle du thème enfant / parent, sinon celui du plugin.
	 */
	public static function locate( string $relative ): ?string {
		$theme = locate_template( 'smart-diagnostic/' . $relative );
		if ( '' !== $theme ) {
			return $theme;
		}
		$file = SMART_DIAGNOSTIC_DIR . 'templates/' . $relative;
		return is_readable( $file ) ? $file : null;
	}
}
