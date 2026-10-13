<?php
/**
 * API REST de soumission : wp-json/smart-diagnostic/v1/…
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Rest;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Engine\Calculator;
use SmartDiagnostic\Engine\Flow;
use SmartDiagnostic\Security\Captcha;
use SmartDiagnostic\Security\RateLimiter;
use SmartDiagnostic\Settings;
use SmartDiagnostic\Storage\EventRepository;
use SmartDiagnostic\Storage\SubmissionRepository;
use SmartDiagnostic\Submission\Sanitizer;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Le résultat est toujours recalculé côté serveur : rien de ce que calcule le
 * navigateur n'est enregistré tel quel.
 */
final class SubmitController {

	public const NAMESPACE    = 'smart-diagnostic/v1';
	public const NONCE_ACTION = 'sd_submit';
	public const RESULT_PARAM = 'sd_result';

	public function __construct(
		private ConfigRepository $configs = new ConfigRepository(),
		private SubmissionRepository $submissions = new SubmissionRepository(),
		private Sanitizer $sanitizer = new Sanitizer(),
		private RateLimiter $limiter = new RateLimiter(),
		private Captcha $captcha = new Captcha()
	) {}

	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Espace de noms de l'API (marque blanche : filtre sd_rest_namespace).
	 */
	public static function rest_namespace(): string {
		/**
		 * Espace de noms REST, ex. « mon-diagnostic/v1 ».
		 *
		 * @param string $namespace Espace de noms.
		 */
		return (string) apply_filters( 'sd_rest_namespace', self::NAMESPACE );
	}

	public function register_routes(): void {
		register_rest_route(
			self::rest_namespace(),
			'/nonce',
			array(
				'methods'             => 'GET',
				'callback'            => static fn() => new WP_REST_Response( array( 'nonce' => wp_create_nonce( self::NONCE_ACTION ) ) ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::rest_namespace(),
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'submit' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'diagnostic_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'answers'       => array(
						'type'    => 'object',
						'default' => array(),
					),
					'contact'       => array(
						'type'    => 'object',
						'default' => array(),
					),
					'consent'       => array(
						'type'    => 'boolean',
						'default' => false,
					),
					'lang'          => array(
						'type'    => 'string',
						'default' => '',
					),
					'utm'           => array(
						'type'    => 'object',
						'default' => array(),
					),
					'source_url'    => array(
						'type'    => 'string',
						'default' => '',
					),
					'nonce'         => array(
						'type'    => 'string',
						'default' => '',
					),
					'website'       => array(
						'type'    => 'string',
						'default' => '',
					),
					'captcha'       => array(
						'type'    => 'string',
						'default' => '',
					),
					'session'       => array(
						'type'    => 'string',
						'default' => '',
					),
				),
			)
		);

		register_rest_route(
			self::rest_namespace(),
			'/submissions/(?P<token>[a-f0-9]{32})/contact',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_contact' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'contact' => array(
						'type'    => 'object',
						'default' => array(),
					),
					'consent' => array(
						'type'    => 'boolean',
						'default' => false,
					),
					'nonce'   => array(
						'type'    => 'string',
						'default' => '',
					),
					'website' => array(
						'type'    => 'string',
						'default' => '',
					),
				),
			)
		);
	}

	/**
	 * Contrôles communs : pot de miel, nonce, limitation, captcha.
	 *
	 * @return WP_Error|true|null null = robot détecté (réponse factice).
	 */
	private function guard( WP_REST_Request $request, string $bucket, bool $check_captcha ): WP_Error|bool|null {
		if ( '' !== trim( (string) $request['website'] ) ) {
			return null;
		}
		if ( ! wp_verify_nonce( (string) $request['nonce'], self::NONCE_ACTION ) ) {
			return new WP_Error( 'sd_invalid_nonce', __( 'Your session has expired. Please try again.', 'smart-diagnostic' ), array( 'status' => 403 ) );
		}
		if ( ! $this->limiter->hit( RateLimiter::ip_hash() . '|' . $bucket ) ) {
			return new WP_Error( 'sd_rate_limited', __( 'Too many submissions. Please try again later.', 'smart-diagnostic' ), array( 'status' => 429 ) );
		}
		if ( $check_captcha && ! $this->captcha->verify( (string) $request['captcha'] ) ) {
			return new WP_Error( 'sd_captcha', __( 'The anti-spam check failed. Please try again.', 'smart-diagnostic' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * @return array<string, mixed>|null Config en tableaux associatifs.
	 */
	private function config_array( int $diagnostic_id ): ?array {
		if ( 'publish' !== get_post_status( $diagnostic_id ) ) {
			return null;
		}
		$config = $this->configs->get( $diagnostic_id );
		return null === $config ? null : json_decode( (string) wp_json_encode( $config ), true );
	}

	public function submit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$diagnostic_id = (int) $request['diagnostic_id'];

		$guard = $this->guard( $request, 'submit|' . $diagnostic_id, true );
		if ( null === $guard ) {
			return new WP_REST_Response( array( 'ok' => true ), 200 );
		}
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}

		$config = $this->config_array( $diagnostic_id );
		if ( null === $config ) {
			return new WP_Error( 'sd_not_found', __( 'Diagnostic not found.', 'smart-diagnostic' ), array( 'status' => 404 ) );
		}

		$raw_answers = $this->sanitizer->answers( $config, $request['answers'] );
		$path        = Flow::compute_path( $config, $raw_answers, static fn( array $answers ) => new \SmartDiagnostic\Engine\Context( $config, $answers ) );
		$answers     = Flow::answers_on_path( $path, $raw_answers );
		$errors      = $this->sanitizer->validate_answers( $config, $answers, $path );

		$contact_data = $this->sanitizer->contact(
			$this->sanitizer->forms( $config, $path, 'inline' ),
			$request['contact'],
			(bool) $request['consent']
		);
		$errors      += $contact_data['errors'];
		if ( $errors ) {
			return new WP_Error( 'sd_invalid', __( 'Some answers are missing or invalid.', 'smart-diagnostic' ), array( 'status' => 422, 'errors' => $errors ) ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
		}

		$contact = $contact_data['contact'];
		$result  = Calculator::compute( $config, $answers, $contact );
		$consent = (bool) $request['consent'] && '' !== $contact_data['consent_version'];

		$row = $this->submissions->insert(
			array(
				'diagnostic_id'   => $diagnostic_id,
				'email'           => (string) ( $contact['email'] ?? '' ),
				'first_name'      => (string) ( $contact['first_name'] ?? ( is_string( $answers['first_name'] ?? null ) ? $answers['first_name'] : '' ) ),
				'contact'         => $contact,
				'answers'         => $answers,
				'path'            => $result['path'],
				'scores'          => $result['scores'],
				'vars'            => $result['vars'],
				'profile'         => (string) $result['profile'],
				'cta'             => (string) $result['cta'],
				'result'          => $result,
				'consent'         => $consent ? 1 : 0,
				'consent_at'      => $consent ? current_time( 'mysql', true ) : null,
				'consent_version' => $consent ? $contact_data['consent_version'] : '',
				'utm'             => $this->utm( $request['utm'] ),
				'lang'            => substr( sanitize_key( (string) $request['lang'] ), 0, 20 ),
				'source_url'      => $this->source_url( (string) $request['source_url'] ),
				'ip_hash'         => RateLimiter::ip_hash(),
				'config_hash'     => md5( (string) wp_json_encode( $config ) ),
			)
		);
		if ( null === $row ) {
			return new WP_Error( 'sd_storage', __( 'Your answers could not be saved. Please try again.', 'smart-diagnostic' ), array( 'status' => 500 ) );
		}

		/**
		 * Soumission enregistrée (emails, webhooks, analytics…).
		 *
		 * @param array<string, mixed> $row    Soumission.
		 * @param array<string, mixed> $config Config du diagnostic.
		 */
		do_action( 'sd_submission_created', $row, $config );

		// Entonnoir : la soumission est comptée côté serveur (source de vérité).
		$session = (string) $request['session'];
		if ( Settings::get( 'analytics' ) && 1 === preg_match( '/^[a-f0-9]{32}$/', $session ) ) {
			( new EventRepository() )->insert_many( $diagnostic_id, $session, array( array( 'event' => 'submit' ) ) );
			EventsController::announce( 'submit', $diagnostic_id, $session );
		}

		return new WP_REST_Response(
			array(
				'token'  => $row['token'],
				'url'    => self::result_url( $row ),
				'result' => $result,
			),
			201
		);
	}

	public function update_contact( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$row = $this->submissions->find_by_token( (string) $request['token'] );
		if ( null === $row ) {
			return new WP_Error( 'sd_not_found', __( 'Result not found.', 'smart-diagnostic' ), array( 'status' => 404 ) );
		}

		$guard = $this->guard( $request, 'contact|' . $row['id'], false );
		if ( null === $guard ) {
			return new WP_REST_Response( array( 'ok' => true ), 200 );
		}
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}

		$config = $this->config_array( (int) $row['diagnostic_id'] );
		if ( null === $config ) {
			return new WP_Error( 'sd_not_found', __( 'Diagnostic not found.', 'smart-diagnostic' ), array( 'status' => 404 ) );
		}

		$contact_data = $this->sanitizer->contact( $this->sanitizer->forms( $config, array(), 'after_results' ), $request['contact'], (bool) $request['consent'] );
		if ( $contact_data['errors'] ) {
			return new WP_Error( 'sd_invalid', __( 'Some fields are missing or invalid.', 'smart-diagnostic' ), array( 'status' => 422, 'errors' => $contact_data['errors'] ) ); // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
		}

		$contact = array_merge( (array) $row['contact'], $contact_data['contact'] );
		$consent = (bool) $request['consent'] && '' !== $contact_data['consent_version'];
		$update  = array(
			'contact'    => $contact,
			'email'      => (string) ( $contact['email'] ?? $row['email'] ),
			'first_name' => (string) ( $contact['first_name'] ?? $row['first_name'] ),
		);
		if ( $consent ) {
			$update['consent']         = 1;
			$update['consent_at']      = current_time( 'mysql', true );
			$update['consent_version'] = $contact_data['consent_version'];
		}
		$this->submissions->update( (int) $row['id'], $update );

		/**
		 * Contact ajouté après le résultat.
		 *
		 * @param array<string, mixed> $row    Soumission mise à jour.
		 * @param array<string, mixed> $config Config du diagnostic.
		 */
		do_action( 'sd_submission_contact_updated', array_merge( $row, $update ), $config );

		return new WP_REST_Response( array( 'ok' => true ), 200 );
	}

	/**
	 * @return array<string, string>
	 */
	private function utm( mixed $raw ): array {
		$utm = array();
		foreach ( array( 'source', 'medium', 'campaign', 'content', 'term' ) as $key ) {
			if ( is_array( $raw ) && isset( $raw[ $key ] ) && is_scalar( $raw[ $key ] ) ) {
				$utm[ $key ] = mb_substr( sanitize_text_field( (string) $raw[ $key ] ), 0, 190 );
			}
		}
		return $utm;
	}

	/**
	 * Page d'origine, limitée au site courant.
	 */
	private function source_url( string $url ): string {
		$url = remove_query_arg( self::RESULT_PARAM, esc_url_raw( $url ) );
		return (string) wp_validate_redirect( $url, home_url( '/' ) );
	}

	/**
	 * Lien unique de consultation du résultat.
	 *
	 * @param array<string, mixed> $row Soumission.
	 */
	public static function result_url( array $row ): string {
		$base = '' !== ( $row['source_url'] ?? '' ) ? (string) $row['source_url'] : home_url( '/' );
		return add_query_arg( self::RESULT_PARAM, $row['token'], $base );
	}
}
