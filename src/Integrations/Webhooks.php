<?php
/**
 * Webhooks sortants (CRM, Make, Zapier, n8n…) : signés HMAC, avec réessais.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Integrations;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Rest\SubmitController;
use SmartDiagnostic\Storage\SubmissionRepository;

/**
 * Premier envoi immédiat ; en cas d'échec, réessais planifiés (WP-Cron) avec un
 * délai croissant. L'état de chaque webhook est conservé dans la soumission.
 *
 * Les secrets ne sont pas dans la config JSON (qui s'exporte) mais dans la méta
 * SECRETS_META du diagnostic.
 */
final class Webhooks {

	public const SECRETS_META = '_sd_webhook_secrets';
	public const RETRY_HOOK   = 'sd_webhook_retry';

	/** Délais avant chaque réessai (secondes). */
	private const RETRY_DELAYS = array( 60, 300, 1800 );

	public function __construct(
		private SubmissionRepository $submissions = new SubmissionRepository(),
		private ConfigRepository $configs = new ConfigRepository()
	) {}

	public function register(): void {
		add_action( 'sd_submission_created', array( $this, 'on_created' ), 20, 2 );
		add_action( 'sd_submission_contact_updated', array( $this, 'on_contact_updated' ), 20, 2 );
		add_action( self::RETRY_HOOK, array( $this, 'retry' ), 10, 3 );
	}

	/**
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public function on_created( array $submission, array $config ): void {
		$this->dispatch( 'submit', $submission, $config );
	}

	/**
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public function on_contact_updated( array $submission, array $config ): void {
		$this->dispatch( 'capture', $submission, $config );
	}

	/**
	 * @param string               $event      submit | capture.
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	private function dispatch( string $event, array $submission, array $config ): void {
		foreach ( $config['integrations']['webhooks'] ?? array() as $webhook ) {
			$events = (array) ( $webhook['events'] ?? array( 'submit' ) );
			if ( in_array( $event, $events, true ) ) {
				$this->deliver( $webhook, $event, $submission, 1 );
			}
		}
	}

	/**
	 * Réessai planifié.
	 */
	public function retry( int $submission_id, string $webhook_key, string $event ): void {
		$submission = $this->submissions->find( $submission_id );
		if ( null === $submission ) {
			return;
		}
		$config = $this->configs->get_array( (int) $submission['diagnostic_id'] );
		foreach ( $config['integrations']['webhooks'] ?? array() as $webhook ) {
			if ( $webhook['key'] === $webhook_key ) {
				$attempt = (int) ( $submission['webhooks'][ $webhook_key ]['attempts'] ?? 0 ) + 1;
				$this->deliver( $webhook, $event, $submission, $attempt );
			}
		}
	}

	/**
	 * @param array<string, mixed> $webhook    Réglage du webhook.
	 * @param string               $event      Événement.
	 * @param array<string, mixed> $submission Soumission.
	 * @param int                  $attempt    Tentative (1 = premier envoi).
	 */
	private function deliver( array $webhook, string $event, array $submission, int $attempt ): bool {
		$body    = (string) wp_json_encode( self::payload( $webhook, $event, $submission ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		$secret  = self::secret( (int) $submission['diagnostic_id'], (string) $webhook['key'] );
		$headers = array(
			'Content-Type'   => 'application/json; charset=utf-8',
			'X-SD-Event'     => $event,
			'X-SD-Delivery'  => wp_generate_uuid4(),
			'X-SD-Timestamp' => (string) time(),
		);
		if ( '' !== $secret ) {
			$headers['X-SD-Signature'] = 'sha256=' . hash_hmac( 'sha256', $body, $secret );
		}

		$response = wp_remote_post(
			(string) $webhook['url'],
			array(
				'timeout'     => 8,
				'redirection' => 2,
				'headers'     => $headers,
				'body'        => $body,
			)
		);
		$code     = is_wp_error( $response ) ? 0 : (int) wp_remote_retrieve_response_code( $response );
		$ok       = $code >= 200 && $code < 300;

		// État relu en base : plusieurs webhooks peuvent partir pour la même soumission.
		$fresh                    = empty( $submission['id'] ) ? null : $this->submissions->find( (int) $submission['id'] );
		$state                    = (array) ( $fresh['webhooks'] ?? $submission['webhooks'] ?? array() );
		$state[ $webhook['key'] ] = array(
			'event'    => $event,
			'status'   => $ok ? 'delivered' : ( $attempt <= count( self::RETRY_DELAYS ) ? 'retrying' : 'failed' ),
			'attempts' => $attempt,
			'code'     => $code,
			'error'    => is_wp_error( $response ) ? $response->get_error_message() : '',
			'at'       => current_time( 'mysql', true ),
		);
		if ( ! empty( $submission['id'] ) ) {
			$this->submissions->update( (int) $submission['id'], array( 'webhooks' => $state ) );
		}

		if ( ! $ok && $attempt <= count( self::RETRY_DELAYS ) ) {
			wp_schedule_single_event( time() + self::RETRY_DELAYS[ $attempt - 1 ], self::RETRY_HOOK, array( (int) $submission['id'], (string) $webhook['key'], $event ) );
		}

		/**
		 * Après chaque tentative d'envoi d'un webhook.
		 *
		 * @param bool                 $ok         Succès.
		 * @param array<string, mixed> $webhook    Réglage.
		 * @param array<string, mixed> $submission Soumission.
		 * @param int                  $code       Code HTTP (0 si erreur réseau).
		 */
		do_action( 'sd_webhook_delivered', $ok, $webhook, $submission, $code );
		return $ok;
	}

	/**
	 * Corps envoyé : le mapping s'il est défini, sinon la soumission complète.
	 *
	 * @param array<string, mixed> $webhook    Réglage.
	 * @param string               $event      Événement.
	 * @param array<string, mixed> $submission Soumission.
	 * @return array<string, mixed>
	 */
	public static function payload( array $webhook, string $event, array $submission ): array {
		$mapping = (array) ( $webhook['mapping'] ?? array() );
		if ( array() !== $mapping ) {
			$payload = array();
			foreach ( $mapping as $out => $path ) {
				$payload[ $out ] = self::resolve( $submission, (string) $path );
			}
			return $payload;
		}
		return array(
			'event'         => $event,
			'diagnostic_id' => (int) $submission['diagnostic_id'],
			'diagnostic'    => get_the_title( (int) $submission['diagnostic_id'] ),
			'submission_id' => (int) ( $submission['id'] ?? 0 ),
			'created_at'    => $submission['created_at'] ?? '',
			'result_url'    => SubmitController::result_url( $submission ),
			'contact'       => $submission['contact'] ?? array(),
			'consent'       => array(
				'given'   => (bool) ( $submission['consent'] ?? false ),
				'at'      => $submission['consent_at'] ?? null,
				'version' => $submission['consent_version'] ?? '',
			),
			'answers'       => $submission['answers'] ?? array(),
			'scores'        => $submission['scores'] ?? array(),
			'vars'          => $submission['vars'] ?? array(),
			'profile'       => $submission['profile'] ?? '',
			'cta'           => $submission['cta'] ?? '',
			'utm'           => $submission['utm'] ?? array(),
			'lang'          => $submission['lang'] ?? '',
		);
	}

	/**
	 * Chemin du mapping : contact.email, answer.q1, score.axe, var.x, utm.source,
	 * ou une colonne (profile, cta, token, created_at, lang, result_url…).
	 *
	 * @param array<string, mixed> $submission Soumission.
	 * @param string               $path       Chemin.
	 */
	public static function resolve( array $submission, string $path ): mixed {
		if ( 'result_url' === $path ) {
			return SubmitController::result_url( $submission );
		}
		$parts = explode( '.', $path, 2 );
		$roots = array(
			'contact' => 'contact',
			'answer'  => 'answers',
			'score'   => 'scores',
			'var'     => 'vars',
			'utm'     => 'utm',
		);
		if ( 2 === count( $parts ) && isset( $roots[ $parts[0] ] ) ) {
			return $submission[ $roots[ $parts[0] ] ][ $parts[1] ] ?? null;
		}
		$allowed = array( 'id', 'diagnostic_id', 'token', 'created_at', 'email', 'first_name', 'profile', 'cta', 'consent', 'consent_at', 'consent_version', 'lang' );
		return in_array( $path, $allowed, true ) ? ( $submission[ $path ] ?? null ) : null;
	}

	public static function secret( int $diagnostic_id, string $webhook_key ): string {
		$secrets = get_post_meta( $diagnostic_id, self::SECRETS_META, true );
		$secret  = is_array( $secrets ) && isset( $secrets[ $webhook_key ] ) ? (string) $secrets[ $webhook_key ] : '';
		/**
		 * Secret HMAC d'un webhook (ex. lu depuis une constante de wp-config.php).
		 *
		 * @param string $secret        Secret enregistré.
		 * @param int    $diagnostic_id Diagnostic.
		 * @param string $webhook_key   Clé du webhook.
		 */
		return (string) apply_filters( 'sd_webhook_secret', $secret, $diagnostic_id, $webhook_key );
	}
}
