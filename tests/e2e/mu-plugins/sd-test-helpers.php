<?php
/**
 * Aides aux tests E2E — installé UNIQUEMENT sur les environnements de test
 * par bin/setup-local.sh (SD_TEST_HELPERS=1). Ne jamais déployer en production.
 *
 * - capture les emails au lieu de les envoyer ;
 * - ajoute au diagnostic « demo » un webhook vers un récepteur local ;
 * - expose le journal : GET/DELETE ?rest_route=/sd-test/v1/log ;
 * - envoie les relances planifiées : POST ?rest_route=/sd-test/v1/run-follow-ups ;
 * - autorise les mots de passe d’application en HTTP (connecteur MCP)
 *
 * @package SmartDiagnostic
 */

defined( 'ABSPATH' ) || exit;

const SD_TEST_SECRET = 'sd-test-secret';

add_filter(
	'pre_wp_mail',
	static function ( $short, array $atts ) {
		$log   = get_option( 'sd_test_mails', array() );
		$log[] = array(
			'to'      => $atts['to'],
			'subject' => $atts['subject'],
			'message' => $atts['message'],
			'headers' => implode( "\n", (array) $atts['headers'] ),
		);
		update_option( 'sd_test_mails', $log, false );
		return true;
	},
	10,
	2
);

add_filter(
	'sd_config',
	static function ( $config, $post_id ) {
		if ( 'demo' !== get_post_field( 'post_name', $post_id ) ) {
			return $config;
		}
		// Ajout du webhook de test, sans écraser le reste des intégrations (emails…).
		$integrations           = isset( $config->integrations ) ? clone $config->integrations : new stdClass();
		$integrations->webhooks = array(
			(object) array(
				'key'    => 'sd_test',
				'url'    => 'http://localhost/?rest_route=/sd-test/v1/webhook',
				'events' => array( 'submit', 'capture' ),
			),
		);
		$config->integrations   = $integrations;
		return $config;
	},
	10,
	2
);

// Mots de passe d'application en HTTP (sinon réservés au HTTPS) : tests du connecteur MCP.
add_filter( 'wp_is_application_passwords_available', '__return_true' );

add_filter(
	'sd_webhook_secret',
	static fn( $secret, $diagnostic_id, $key ) => 'sd_test' === $key ? SD_TEST_SECRET : $secret,
	10,
	3
);

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'sd-test/v1',
			'/webhook',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => static function ( WP_REST_Request $request ) {
					$log   = get_option( 'sd_test_webhooks', array() );
					$log[] = array(
						'event'     => $request->get_header( 'x_sd_event' ),
						'signature' => $request->get_header( 'x_sd_signature' ),
						'body'      => $request->get_body(),
					);
					update_option( 'sd_test_webhooks', $log, false );
					return array( 'ok' => true );
				},
			)
		);
		// Relances planifiées envoyées tout de suite (sans attendre leur date).
		register_rest_route(
			'sd-test/v1',
			'/run-follow-ups',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => static function () {
					$hook = SmartDiagnostic\Integrations\Mailer::FOLLOW_UP_HOOK;
					$ids  = array();
					foreach ( _get_cron_array() as $events ) {
						foreach ( $events[ $hook ] ?? array() as $event ) {
							$ids[] = (int) $event['args'][0];
						}
					}
					foreach ( $ids as $id ) {
						wp_unschedule_event( (int) wp_next_scheduled( $hook, array( $id ) ), $hook, array( $id ) );
						do_action( $hook, $id );
					}
					return array( 'sent' => count( $ids ) );
				},
			)
		);
		register_rest_route(
			'sd-test/v1',
			'/log',
			array(
				array(
					'methods'             => 'GET',
					'permission_callback' => '__return_true',
					'callback'            => static fn() => array(
						'mails'    => get_option( 'sd_test_mails', array() ),
						'webhooks' => get_option( 'sd_test_webhooks', array() ),
						'secret'   => SD_TEST_SECRET,
					),
				),
				array(
					'methods'             => 'DELETE',
					'permission_callback' => '__return_true',
					'callback'            => static function () {
						delete_option( 'sd_test_mails' );
						delete_option( 'sd_test_webhooks' );
						return array( 'ok' => true );
					},
				),
			)
		);
	}
);
