<?php
/**
 * Page « Réglages » : anti-spam (captcha, limitation).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\PostType\DiagnosticPostType;
use SmartDiagnostic\Integrations\Mailer;
use SmartDiagnostic\Mcp\Abilities;
use SmartDiagnostic\Mcp\ActionLog;
use SmartDiagnostic\Mcp\Server;
use SmartDiagnostic\Settings;

/**
 * Réglages globaux, via la Settings API de WordPress.
 */
final class SettingsPage {

	private const PAGE        = 'sd-settings';
	private const GROUP       = 'sd_settings_group';
	private const TEST_ACTION = 'sd_test_email';

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_post_' . self::TEST_ACTION, array( $this, 'send_test_email' ) );
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
		$fields['analytics']        = __( 'Statistics', 'smart-diagnostic' );
		$sections['analytics']      = 'sd_privacy';

		add_settings_section( 'sd_branding', __( 'White label', 'smart-diagnostic' ), '__return_null', self::PAGE );
		$fields['brand_name']   = __( 'Displayed name', 'smart-diagnostic' );
		$sections['brand_name'] = 'sd_branding';

		add_settings_section( 'sd_emails', __( 'Emails', 'smart-diagnostic' ), array( $this, 'render_emails_intro' ), self::PAGE );
		$email_fields = array(
			'mail_from_name'  => __( 'Sender name', 'smart-diagnostic' ),
			'mail_from_email' => __( 'Sender address', 'smart-diagnostic' ),
			'mail_reply_to'   => __( 'Reply-to address', 'smart-diagnostic' ),
			'smtp_enabled'    => __( 'Dedicated SMTP', 'smart-diagnostic' ),
			'smtp_host'       => __( 'SMTP server', 'smart-diagnostic' ),
			'smtp_port'       => __( 'Port', 'smart-diagnostic' ),
			'smtp_encryption' => __( 'Encryption', 'smart-diagnostic' ),
			'smtp_user'       => __( 'Username', 'smart-diagnostic' ),
			'smtp_password'   => __( 'Password', 'smart-diagnostic' ),
		);
		foreach ( $email_fields as $key => $label ) {
			$fields[ $key ]   = $label;
			$sections[ $key ] = 'sd_emails';
		}

		add_settings_section( 'sd_mcp', __( 'MCP connector (AI assistants)', 'smart-diagnostic' ), array( $this, 'render_mcp_intro' ), self::PAGE );
		$fields['mcp_enabled']   = __( 'MCP connector', 'smart-diagnostic' );
		$sections['mcp_enabled'] = 'sd_mcp';
		$fields['mcp_write']     = __( 'Access', 'smart-diagnostic' );
		$sections['mcp_write']   = 'sd_mcp';

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

		// SMTP dédié : activé seulement avec une adresse de serveur valide (sinon tous les
		// emails des diagnostics échoueraient). Ils partent alors normalement par WordPress.
		$smtp_host = trim( sanitize_text_field( (string) ( $input['smtp_host'] ?? '' ) ) );
		$smtp_on   = ! empty( $input['smtp_enabled'] );
		if ( $smtp_on && ! Settings::valid_smtp_host( $smtp_host ) ) {
			$smtp_on = false;
			add_settings_error(
				Settings::OPTION,
				'sd_smtp_host',
				str_contains( $smtp_host, '@' )
					? __( 'Dedicated SMTP not enabled: the "SMTP server" field contains an email address. Enter the address of the server (for example smtp.office365.com or ssl0.ovh.net); the email address goes in "Username".', 'smart-diagnostic' )
					: __( 'Dedicated SMTP not enabled: enter a valid server address in "SMTP server" (for example smtp.office365.com).', 'smart-diagnostic' ),
				'error'
			);
		}

		return array(
			'captcha_provider'   => in_array( $input['captcha_provider'] ?? '', array( 'turnstile', 'recaptcha' ), true ) ? $input['captcha_provider'] : 'none',
			'captcha_site_key'   => sanitize_text_field( (string) ( $input['captcha_site_key'] ?? '' ) ),
			'captcha_secret_key' => sanitize_text_field( (string) ( $input['captcha_secret_key'] ?? '' ) ),
			'rate_limit'         => max( 1, absint( $input['rate_limit'] ?? 10 ) ),
			'rate_window'        => max( 60, absint( $input['rate_window'] ?? 600 ) ),
			'retention_days'     => absint( $input['retention_days'] ?? 0 ),
			'analytics'          => ! empty( $input['analytics'] ),
			'brand_name'         => sanitize_text_field( (string) ( $input['brand_name'] ?? '' ) ),
			'mail_from_name'     => sanitize_text_field( (string) ( $input['mail_from_name'] ?? '' ) ),
			'mail_from_email'    => sanitize_email( (string) ( $input['mail_from_email'] ?? '' ) ),
			'mail_reply_to'      => sanitize_email( (string) ( $input['mail_reply_to'] ?? '' ) ),
			'smtp_enabled'       => $smtp_on,
			'smtp_host'          => $smtp_host,
			'smtp_port'          => max( 1, absint( $input['smtp_port'] ?? 587 ) ),
			'smtp_encryption'    => in_array( $input['smtp_encryption'] ?? '', array( 'tls', 'ssl', 'none' ), true ) ? $input['smtp_encryption'] : 'tls',
			'smtp_user'          => sanitize_text_field( (string) ( $input['smtp_user'] ?? '' ) ),
			// Champ laissé vide = mot de passe inchangé.
			'smtp_password'      => '' !== (string) ( $input['smtp_password'] ?? '' ) ? (string) $input['smtp_password'] : $this->saved_smtp_password(),
			'mcp_enabled'        => ! empty( $input['mcp_enabled'] ),
			'mcp_write'          => ! empty( $input['mcp_write'] ),
		);
	}

	private function saved_smtp_password(): string {
		$saved = get_option( Settings::OPTION, array() );
		return is_array( $saved ) ? (string) ( $saved['smtp_password'] ?? '' ) : '';
	}

	/**
	 * Connecteur MCP : prérequis, adresse de connexion, aide.
	 */
	public function render_mcp_intro(): void {
		echo '<p>' . esc_html__( 'Lets an AI assistant compatible with MCP (for example Claude Desktop) work with your diagnostics: list, read, preview, create or modify them, read the submissions and statistics. Nothing can be deleted through MCP, and every action is logged below.', 'smart-diagnostic' ) . '</p>';
		$checks = array(
			array( Abilities::available(), __( 'WordPress 6.9 or later (Abilities API)', 'smart-diagnostic' ) ),
			array( Server::adapter_active(), __( 'The "MCP Adapter" plugin is installed and active', 'smart-diagnostic' ) ),
		);
		echo '<ul class="sd-mcp-checks">';
		foreach ( $checks as [ $ok, $label ] ) {
			printf( '<li>%s %s</li>', $ok ? '✅' : '❌', esc_html( $label ) );
		}
		echo '</ul>';
		if ( Settings::get( 'mcp_enabled' ) ) {
			printf(
				'<p>%s <code class="sd-mcp-endpoint">%s</code></p><p>%s</p>',
				esc_html__( 'Connection address:', 'smart-diagnostic' ),
				esc_html( Server::endpoint() ),
				wp_kses(
					sprintf(
						/* translators: %s: link to the user profile. */
						__( 'The assistant connects with your username and an <a href="%s">application password</a> (Users → Profile → Application passwords), with your own rights. See the README for the Claude Desktop configuration.', 'smart-diagnostic' ),
						esc_url( admin_url( 'profile.php#application-passwords-section' ) )
					),
					array( 'a' => array( 'href' => true ) )
				)
			);
		}
	}

	public function render_emails_intro(): void {
		echo '<p>' . esc_html__( 'By default, emails are sent by WordPress, and therefore by the SMTP plugin of the site if there is one. Enable the dedicated SMTP only to send the emails of the diagnostics through another server.', 'smart-diagnostic' ) . '</p>';
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
		if ( 'smtp_encryption' === $key ) {
			$choices = array(
				'tls'  => 'TLS (STARTTLS, port 587)',
				'ssl'  => 'SSL (port 465)',
				'none' => __( 'None', 'smart-diagnostic' ),
			);
			printf( '<select id="%s" name="%s">', esc_attr( $id ), esc_attr( $name ) );
			foreach ( $choices as $choice => $label ) {
				printf( '<option value="%s" %s>%s</option>', esc_attr( $choice ), selected( $value, $choice, false ), esc_html( $label ) );
			}
			echo '</select>';
			return;
		}
		if ( 'smtp_password' === $key ) {
			if ( defined( 'SD_SMTP_PASSWORD' ) ) {
				echo '<p>' . esc_html__( 'Defined by the SD_SMTP_PASSWORD constant (wp-config.php).', 'smart-diagnostic' ) . '</p>';
				return;
			}
			printf(
				'<input type="password" id="%s" name="%s" value="" class="regular-text" autocomplete="new-password" placeholder="%s" /><p class="description">%s</p>',
				esc_attr( $id ),
				esc_attr( $name ),
				'' !== (string) $value ? esc_attr__( '•••••••• (unchanged)', 'smart-diagnostic' ) : '',
				esc_html__( 'Leave empty to keep the current password. More secure: define it in wp-config.php with the SD_SMTP_PASSWORD constant.', 'smart-diagnostic' )
			);
			return;
		}
		if ( 'mcp_enabled' === $key ) {
			printf(
				'<label><input type="checkbox" id="%s" name="%s" value="1" %s /> %s</label>',
				esc_attr( $id ),
				esc_attr( $name ),
				checked( (bool) $value, true, false ),
				esc_html__( 'Enable the MCP connector', 'smart-diagnostic' )
			);
			return;
		}
		if ( 'mcp_write' === $key ) {
			$choices = array(
				'0' => __( 'Read only (recommended): list, read, preview, submissions, statistics', 'smart-diagnostic' ),
				'1' => __( 'Read and write: also create and modify diagnostics (never delete)', 'smart-diagnostic' ),
			);
			foreach ( $choices as $choice => $label ) {
				printf(
					'<label style="display:block;margin-bottom:4px;"><input type="radio" name="%s" value="%s" %s /> %s</label>',
					esc_attr( $name ),
					esc_attr( (string) $choice ),
					checked( (bool) $value, (bool) $choice, false ),
					esc_html( $label )
				);
			}
			return;
		}
		if ( 'smtp_enabled' === $key ) {
			printf(
				'<label><input type="checkbox" id="%s" name="%s" value="1" %s /> %s</label>',
				esc_attr( $id ),
				esc_attr( $name ),
				checked( (bool) $value, true, false ),
				esc_html__( 'Send the emails of the diagnostics through the server below (instead of WordPress / the SMTP plugin).', 'smart-diagnostic' )
			);
			if ( Settings::smtp_enabled() ) {
				$settings = Settings::all();
				/* translators: 1: server, 2: port. */
				printf( '<p class="description sd-smtp-status">%s</p>', esc_html( sprintf( __( 'Active: the emails of the diagnostics are sent through %1$s, port %2$d.', 'smart-diagnostic' ), $settings['smtp_host'], $settings['smtp_port'] ) ) );
			} else {
				printf( '<p class="description sd-smtp-status">%s</p>', esc_html__( 'Not active: the emails are sent by WordPress / the SMTP plugin of the site.', 'smart-diagnostic' ) );
			}
			return;
		}
		if ( 'analytics' === $key ) {
			printf(
				'<label><input type="checkbox" id="%s" name="%s" value="1" %s /> %s</label><p class="description">%s</p>',
				esc_attr( $id ),
				esc_attr( $name ),
				checked( (bool) $value, true, false ),
				esc_html__( 'Record anonymous journey events (funnel, drop-offs).', 'smart-diagnostic' ),
				esc_html__( 'No personal data and no cookie: a random identifier per questionnaire run.', 'smart-diagnostic' )
			);
			return;
		}
		$type = in_array( $key, array( 'rate_limit', 'rate_window', 'retention_days', 'smtp_port' ), true ) ? 'number' : ( 'captcha_secret_key' === $key ? 'password' : 'text' );
		if ( in_array( $key, array( 'mail_from_email', 'mail_reply_to' ), true ) ) {
			$type = 'email';
		}
		printf(
			'<input type="%s" id="%s" name="%s" value="%s" class="regular-text" autocomplete="off" />',
			esc_attr( $type ),
			esc_attr( $id ),
			esc_attr( $name ),
			esc_attr( (string) $value )
		);
		if ( 'mail_from_email' === $key ) {
			echo '<p class="description">' . esc_html__( 'Empty: the sender set by WordPress or by the SMTP plugin. Use an address of your domain, otherwise emails may end up in spam.', 'smart-diagnostic' ) . '</p>';
		}
		if ( 'mail_reply_to' === $key ) {
			echo '<p class="description">' . esc_html__( 'Where replies from visitors go (for example your sales team).', 'smart-diagnostic' ) . '</p>';
		}
		if ( 'brand_name' === $key ) {
			echo '<p class="description">' . esc_html__( 'Replaces the plugin name in the admin menus and plugin list. The SD_BRAND_NAME constant (wp-config.php) takes precedence.', 'smart-diagnostic' ) . '</p>';
		}
		if ( 'retention_days' === $key ) {
			echo '<p class="description">' . esc_html__( '0 = keep until deleted. Older submissions are purged daily. Personal data can also be exported or erased from Tools → Export / Erase Personal Data.', 'smart-diagnostic' ) . '</p>';
		}
	}

	public function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		echo '<div class="wrap"><h1>' . esc_html( get_admin_page_title() ) . '</h1>';
		// Hors des pages « Réglages » de WordPress, le message « Réglages enregistrés » n'est pas automatique.
		settings_errors();
		echo '<form method="post" action="options.php">';
		settings_fields( self::GROUP );
		do_settings_sections( self::PAGE );
		submit_button();
		echo '</form>';
		$this->render_test_form();
		$this->render_mcp_log();
		echo '</div>';
	}

	/**
	 * Journal des actions MCP (les plus récentes d'abord).
	 */
	private function render_mcp_log(): void {
		$log = array_reverse( ActionLog::all() );
		if ( ! $log && ! Settings::get( 'mcp_enabled' ) ) {
			return;
		}
		echo '<hr /><h2>' . esc_html__( 'MCP connector log', 'smart-diagnostic' ) . '</h2>';
		if ( ! $log ) {
			echo '<p>' . esc_html__( 'No action yet.', 'smart-diagnostic' ) . '</p>';
			return;
		}
		echo '<table class="widefat striped sd-mcp-log"><thead><tr>';
		foreach ( array( __( 'Date', 'smart-diagnostic' ), __( 'User', 'smart-diagnostic' ), __( 'Action', 'smart-diagnostic' ), __( 'Parameters', 'smart-diagnostic' ), __( 'Result', 'smart-diagnostic' ) ) as $title ) {
			echo '<th scope="col">' . esc_html( $title ) . '</th>';
		}
		echo '</tr></thead><tbody>';
		foreach ( array_slice( $log, 0, 50 ) as $entry ) {
			$user = get_userdata( $entry['user'] );
			printf(
				'<tr><td>%s</td><td>%s</td><td><code>%s</code></td><td>%s</td><td>%s %s</td></tr>',
				esc_html( get_date_from_gmt( $entry['at'], 'Y-m-d H:i' ) ),
				esc_html( $user ? $user->user_login : '#' . $entry['user'] ),
				esc_html( $entry['ability'] ),
				esc_html( $entry['input'] ),
				$entry['ok'] ? '✅' : '❌',
				esc_html( $entry['message'] )
			);
		}
		echo '</tbody></table>';
	}

	private function render_test_form(): void {
		$key    = 'sd_test_email_' . get_current_user_id();
		$result = get_transient( $key );
		delete_transient( $key );

		echo '<hr /><h2>' . esc_html__( 'Send a test email', 'smart-diagnostic' ) . '</h2>';
		if ( is_array( $result ) ) {
			if ( $result['ok'] ) {
				/* translators: 1: recipient, 2: sending method. */
				$message = sprintf( __( 'Test email sent to %1$s (%2$s). Check the inbox, and the spam folder.', 'smart-diagnostic' ), $result['to'], $result['via_label'] );
			} else {
				/* translators: %s: error message. */
				$message = sprintf( __( 'The test email could not be sent: %s', 'smart-diagnostic' ), $result['error'] );
			}
			printf( '<div class="notice notice-%s inline sd-test-email-result"><p>%s</p></div>', $result['ok'] ? 'success' : 'error', esc_html( $message ) );
		}
		printf( '<form method="post" action="%s">', esc_url( admin_url( 'admin-post.php' ) ) );
		wp_nonce_field( self::TEST_ACTION );
		printf( '<input type="hidden" name="action" value="%s" />', esc_attr( self::TEST_ACTION ) );
		printf(
			'<p><label for="sd-test-email-to">%s</label> <input type="email" id="sd-test-email-to" name="to" value="%s" class="regular-text" required /> ',
			esc_html__( 'Recipient', 'smart-diagnostic' ),
			esc_attr( wp_get_current_user()->user_email )
		);
		submit_button( __( 'Send a test email', 'smart-diagnostic' ), 'secondary', 'submit', false );
		echo '</p><p class="description">' . esc_html__( 'Uses the saved settings: save your changes before testing.', 'smart-diagnostic' ) . '</p></form>';
	}

	public function send_test_email(): void {
		check_admin_referer( self::TEST_ACTION );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		$to = isset( $_POST['to'] ) ? sanitize_email( wp_unslash( $_POST['to'] ) ) : '';
		if ( is_email( $to ) ) {
			$result = ( new Mailer() )->send_test( $to );
		} else {
			$result = array(
				'ok'    => false,
				'error' => __( 'Please enter a valid email address.', 'smart-diagnostic' ),
				'via'   => '',
			);
		}
		$result['to']        = $to;
		$result['via_label'] = 'smtp' === $result['via'] ? __( 'dedicated SMTP', 'smart-diagnostic' ) : __( 'WordPress / SMTP plugin', 'smart-diagnostic' );
		set_transient( 'sd_test_email_' . get_current_user_id(), $result, 5 * MINUTE_IN_SECONDS );
		wp_safe_redirect(
			add_query_arg(
				array(
					'post_type' => DiagnosticPostType::NAME,
					'page'      => self::PAGE,
				),
				admin_url( 'edit.php' )
			)
		);
		exit;
	}
}
