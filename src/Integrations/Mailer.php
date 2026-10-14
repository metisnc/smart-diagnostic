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

		$subject = $this->text( $settings['subject'] ?? null, $config, $submission )
			?: __( 'Your results', 'smart-diagnostic' ); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
		$body    = $this->render( (string) ( $settings['template'] ?? 'user' ), $submission, $config );
		$result  = $this->transport->send( $email, $subject, $body );
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

		$subject = $this->text( $settings['subject'] ?? null, $config, $submission );
		if ( '' === $subject ) {
			/* translators: 1: diagnostic title, 2: first name or email. */
			$subject = sprintf( __( 'New submission: %1$s (%2$s)', 'smart-diagnostic' ), get_the_title( (int) $submission['diagnostic_id'] ), $submission['first_name'] ?: $submission['email'] ?: '—' ); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
		}
		$body   = $this->render( (string) ( $settings['template'] ?? 'admin' ), $submission, $config );
		$to     = implode( ',', $recipients );
		$result = $this->transport->send( $to, $subject, $body );
		$this->record( $submission, 'admin', $to, $result );
		return $result['ok'];
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

		$color = (string) ( $config['ui']['theme']['colors']['primary'] ?? '' );

		return array(
			'brand'      => Branding::name(),
			'color'      => 1 === preg_match( '/^#[0-9a-f]{3,8}$/i', $color ) ? $color : '#2563eb',
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
