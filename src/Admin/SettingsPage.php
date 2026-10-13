<?php
/**
 * Page « Réglages » : anti-spam (captcha, limitation).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\PostType\DiagnosticPostType;
use SmartDiagnostic\Settings;

/**
 * Réglages globaux, via la Settings API de WordPress.
 */
final class SettingsPage {

	private const PAGE  = 'sd-settings';
	private const GROUP = 'sd_settings_group';

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	public function add_page(): void {
		add_submenu_page(
			'edit.php?post_type=' . DiagnosticPostType::NAME,
			__( 'Settings', 'smart-diagnostic' ),
			__( 'Settings', 'smart-diagnostic' ),
			'manage_options',
			self::PAGE,
			array( $this, 'render' )
		);
	}

	public function register_settings(): void {
		register_setting(
			self::GROUP,
			Settings::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => array(),
			)
		);

		add_settings_section( 'sd_antispam', __( 'Anti-spam', 'smart-diagnostic' ), '__return_null', self::PAGE );

		$fields = array(
			'captcha_provider'   => __( 'Captcha', 'smart-diagnostic' ),
			'captcha_site_key'   => __( 'Site key', 'smart-diagnostic' ),
			'captcha_secret_key' => __( 'Secret key', 'smart-diagnostic' ),
			'rate_limit'         => __( 'Max submissions per visitor', 'smart-diagnostic' ),
			'rate_window'        => __( 'Time window (seconds)', 'smart-diagnostic' ),
		);
		add_settings_section( 'sd_privacy', __( 'Privacy (GDPR)', 'smart-diagnostic' ), '__return_null', self::PAGE );
		$sections = array_fill_keys( array_keys( $fields ), 'sd_antispam' );

		$fields['retention_days']   = __( 'Keep submissions for (days)', 'smart-diagnostic' );
		$sections['retention_days'] = 'sd_privacy';

		foreach ( $fields as $key => $label ) {
			add_settings_field(
				$key,
				$label,
				array( $this, 'render_field' ),
				self::PAGE,
				$sections[ $key ],
				array(
					'key'       => $key,
					'label_for' => 'sd-' . $key,
				)
			);
		}
	}

	/**
	 * @param mixed $input Valeurs postées.
	 * @return array<string, mixed>
	 */
	public function sanitize( mixed $input ): array {
		$input = is_array( $input ) ? $input : array();
		return array(
			'captcha_provider'   => in_array( $input['captcha_provider'] ?? '', array( 'turnstile', 'recaptcha' ), true ) ? $input['captcha_provider'] : 'none',
			'captcha_site_key'   => sanitize_text_field( (string) ( $input['captcha_site_key'] ?? '' ) ),
			'captcha_secret_key' => sanitize_text_field( (string) ( $input['captcha_secret_key'] ?? '' ) ),
			'rate_limit'         => max( 1, absint( $input['rate_limit'] ?? 10 ) ),
			'rate_window'        => max( 60, absint( $input['rate_window'] ?? 600 ) ),
			'retention_days'     => absint( $input['retention_days'] ?? 0 ),
		);
	}

	/**
	 * @param array{key: string} $args Arguments du champ.
	 */
	public function render_field( array $args ): void {
		$key   = $args['key'];
		$value = Settings::get( $key );
		$name  = Settings::OPTION . '[' . $key . ']';
		$id    = 'sd-' . $key;

		if ( 'captcha_provider' === $key ) {
			$choices = array(
				'none'      => __( 'None', 'smart-diagnostic' ),
				'turnstile' => 'Cloudflare Turnstile',
				'recaptcha' => 'Google reCAPTCHA v3',
			);
			printf( '<select id="%s" name="%s">', esc_attr( $id ), esc_attr( $name ) );
			foreach ( $choices as $choice => $label ) {
				printf( '<option value="%s" %s>%s</option>', esc_attr( $choice ), selected( $value, $choice, false ), esc_html( $label ) );
			}
			echo '</select>';
			echo '<p class="description">' . esc_html__( 'Active only when both keys are filled in.', 'smart-diagnostic' ) . '</p>';
			return;
		}
		$type = in_array( $key, array( 'rate_limit', 'rate_window', 'retention_days' ), true ) ? 'number' : ( 'captcha_secret_key' === $key ? 'password' : 'text' );
		printf(
			'<input type="%s" id="%s" name="%s" value="%s" class="regular-text" autocomplete="off" />',
			esc_attr( $type ),
			esc_attr( $id ),
			esc_attr( $name ),
			esc_attr( (string) $value )
		);
		if ( 'retention_days' === $key ) {
			echo '<p class="description">' . esc_html__( '0 = keep until deleted. Older submissions are purged daily. Personal data can also be exported or erased from Tools → Export / Erase Personal Data.', 'smart-diagnostic' ) . '</p>';
		}
	}

	public function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		echo '<div class="wrap"><h1>' . esc_html( get_admin_page_title() ) . '</h1><form method="post" action="options.php">';
		settings_fields( self::GROUP );
		do_settings_sections( self::PAGE );
		submit_button();
		echo '</form></div>';
	}
}
