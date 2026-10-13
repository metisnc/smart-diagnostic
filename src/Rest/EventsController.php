<?php
/**
 * Réception des événements du parcours (POST …/events), pour l'entonnoir.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Rest;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Security\RateLimiter;
use SmartDiagnostic\Settings;
use SmartDiagnostic\Storage\EventRepository;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Événements anonymes, envoyés par lots (et via sendBeacon à la fermeture de la page).
 */
final class EventsController {

	private const MAX_EVENTS = 50;
	private const RATE_LIMIT = 600;

	public function __construct(
		private EventRepository $events = new EventRepository(),
		private ConfigRepository $configs = new ConfigRepository(),
		private RateLimiter $limiter = new RateLimiter()
	) {}

	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes(): void {
		register_rest_route(
			SubmitController::rest_namespace(),
			'/events',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'store' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'diagnostic_id' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'session'       => array(
						'type'     => 'string',
						'required' => true,
						'pattern'  => '^[a-f0-9]{32}$',
					),
					'events'        => array(
						'type'     => 'array',
						'required' => true,
					),
					'nonce'         => array(
						'type'    => 'string',
						'default' => '',
					),
				),
			)
		);
	}

	public function store( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		if ( ! Settings::get( 'analytics' ) ) {
			return new WP_REST_Response( array( 'stored' => 0 ), 200 );
		}
		if ( ! wp_verify_nonce( (string) $request['nonce'], SubmitController::NONCE_ACTION ) ) {
			return new WP_Error( 'sd_invalid_nonce', 'Invalid nonce.', array( 'status' => 403 ) );
		}
		if ( ! $this->limiter->hit( RateLimiter::ip_hash() . '|events', self::RATE_LIMIT ) ) {
			return new WP_Error( 'sd_rate_limited', 'Too many events.', array( 'status' => 429 ) );
		}

		$diagnostic_id = (int) $request['diagnostic_id'];
		if ( 'publish' !== get_post_status( $diagnostic_id ) ) {
			return new WP_Error( 'sd_not_found', 'Diagnostic not found.', array( 'status' => 404 ) );
		}
		$config    = $this->configs->get_array( $diagnostic_id ) ?? array();
		$step_keys = array_column( $config['steps'] ?? array(), 'key' );

		$clean = array();
		foreach ( array_slice( (array) $request['events'], 0, self::MAX_EVENTS ) as $event ) {
			$name = is_array( $event ) ? (string) ( $event['event'] ?? '' ) : '';
			$step = is_array( $event ) ? (string) ( $event['step'] ?? '' ) : '';
			// La soumission est enregistrée côté serveur par SubmitController.
			if ( ! in_array( $name, EventRepository::EVENTS, true ) || 'submit' === $name ) {
				continue;
			}
			if ( '' !== $step && ! in_array( $step, $step_keys, true ) ) {
				$step = '';
			}
			$clean[] = array(
				'event' => $name,
				'step'  => $step,
			);
		}

		$session = (string) $request['session'];
		$stored  = $this->events->insert_many( $diagnostic_id, $session, $clean );
		foreach ( $clean as $event ) {
			self::announce( $event['event'], $diagnostic_id, $session, $event['step'] );
		}
		return new WP_REST_Response( array( 'stored' => $stored ), 200 );
	}

	/**
	 * Hook pour brancher GA4 (Measurement Protocol), Meta (Conversions API)…
	 */
	public static function announce( string $event, int $diagnostic_id, string $session, string $step = '' ): void {
		/**
		 * Événement du parcours.
		 *
		 * @param string               $event Nom : start, step_view, answer, capture, submit, abandon.
		 * @param array<string, mixed> $data  diagnostic_id, session, step.
		 */
		do_action(
			'sd_event',
			$event,
			array(
				'diagnostic_id' => $diagnostic_id,
				'session'       => $session,
				'step'          => $step,
			)
		);
	}
}
