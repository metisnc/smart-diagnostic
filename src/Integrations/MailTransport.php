<?php
/**
 * Envoi effectif des emails du plugin : via WordPress (et donc le plugin SMTP du site),
 * ou via un SMTP dédié configuré dans les réglages.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Integrations;

use SmartDiagnostic\Settings;

/**
 * Le SMTP dédié n'utilise pas wp_mail() : certains plugins SMTP remplacent entièrement
 * wp_mail(), un réglage passé par phpmailer_init serait alors ignoré. Il passe par la
 * copie de PHPMailer fournie avec WordPress et ne concerne que les emails du plugin.
 */
final class MailTransport {

	/**
	 * En-têtes communs : expéditeur et adresse de réponse des réglages.
	 *
	 * @return list<string>
	 */
	public static function headers(): array {
		$settings = Settings::all();
		$headers  = array( 'Content-Type: text/html; charset=UTF-8' );
		$from     = self::from();
		if ( null !== $from ) {
			$headers[] = '' !== $from['name']
				? sprintf( 'From: %s <%s>', self::header_safe( $from['name'] ), $from['email'] )
				: 'From: ' . $from['email'];
		}
		if ( is_email( $settings['mail_reply_to'] ) ) {
			$headers[] = 'Reply-To: ' . $settings['mail_reply_to'];
		}
		/**
		 * En-têtes des emails (ex. Cc, Bcc).
		 *
		 * @param list<string> $headers En-têtes.
		 */
		return array_values( (array) apply_filters( 'sd_email_headers', $headers ) );
	}

	/**
	 * Expéditeur des réglages, ou null (expéditeur par défaut du site / du plugin SMTP).
	 *
	 * @return array{name: string, email: string}|null
	 */
	public static function from(): ?array {
		$settings = Settings::all();
		if ( ! is_email( $settings['mail_from_email'] ) ) {
			return null;
		}
		return array(
			'name'  => $settings['mail_from_name'],
			'email' => $settings['mail_from_email'],
		);
	}

	/**
	 * Supprime les retours à la ligne (injection d'en-têtes).
	 */
	private static function header_safe( string $value ): string {
		return trim( (string) preg_replace( '/[\r\n]+/', ' ', $value ) );
	}

	/**
	 * @param string $to      Destinataire(s), séparés par des virgules.
	 * @param string $subject Objet.
	 * @param string $body    Corps HTML.
	 * @return array{ok: bool, error: string, via: string}
	 */
	public function send( string $to, string $subject, string $body ): array {
		return Settings::smtp_enabled()
			? $this->send_smtp( $to, $subject, $body )
			: $this->send_wordpress( $to, $subject, $body );
	}

	/**
	 * @return array{ok: bool, error: string, via: string}
	 */
	private function send_wordpress( string $to, string $subject, string $body ): array {
		$error  = '';
		$listen = static function ( \WP_Error $failure ) use ( &$error ): void {
			$error = $failure->get_error_message();
		};
		add_action( 'wp_mail_failed', $listen );
		$ok = wp_mail( $to, $subject, $body, self::headers() );
		remove_action( 'wp_mail_failed', $listen );

		return array(
			'ok'    => (bool) $ok,
			'error' => $ok ? '' : ( '' !== $error ? $error : __( 'WordPress could not send the email.', 'smart-diagnostic' ) ),
			'via'   => 'wordpress',
		);
	}

	/**
	 * Réglages du SMTP dédié, au format PHPMailer.
	 *
	 * @return array{host: string, port: int, secure: string, auth: bool, user: string, password: string}
	 */
	public static function smtp_config(): array {
		$settings = Settings::all();
		$secure   = array(
			'tls'  => 'tls',
			'ssl'  => 'ssl',
			'none' => '',
		);
		return array(
			'host'     => $settings['smtp_host'],
			'port'     => $settings['smtp_port'] > 0 ? $settings['smtp_port'] : 587,
			'secure'   => $secure[ $settings['smtp_encryption'] ] ?? 'tls',
			'auth'     => '' !== $settings['smtp_user'],
			'user'     => $settings['smtp_user'],
			'password' => $settings['smtp_password'],
		);
	}

	/**
	 * @return array{ok: bool, error: string, via: string}
	 */
	private function send_smtp( string $to, string $subject, string $body ): array {
		require_once ABSPATH . WPINC . '/PHPMailer/PHPMailer.php';
		require_once ABSPATH . WPINC . '/PHPMailer/SMTP.php';
		require_once ABSPATH . WPINC . '/PHPMailer/Exception.php';

		$config = self::smtp_config();
		$mailer = new \PHPMailer\PHPMailer\PHPMailer( true );
		try {
			$mailer->isSMTP();
			$mailer->Host        = $config['host']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->Port        = $config['port']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->SMTPSecure  = $config['secure']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->SMTPAutoTLS = '' !== $config['secure']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->SMTPAuth    = $config['auth']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			if ( $config['auth'] ) {
				$mailer->Username = $config['user']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
				$mailer->Password = $config['password']; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			}
			$mailer->Timeout = 15; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->CharSet = 'UTF-8'; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->isHTML( true );

			$from = self::from() ?? array(
				'name'  => get_bloginfo( 'name' ),
				'email' => $config['auth'] && is_email( $config['user'] ) ? $config['user'] : (string) get_option( 'admin_email' ),
			);
			$mailer->setFrom( $from['email'], self::header_safe( $from['name'] ), false );
			$reply_to = (string) Settings::get( 'mail_reply_to' );
			if ( is_email( $reply_to ) ) {
				$mailer->addReplyTo( $reply_to );
			}
			foreach ( array_filter( array_map( 'trim', explode( ',', $to ) ) ) as $address ) {
				$mailer->addAddress( $address );
			}
			$mailer->Subject = self::header_safe( $subject ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->Body    = $body; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->AltBody = wp_strip_all_tags( $body ); // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$mailer->send();
			return array(
				'ok'    => true,
				'error' => '',
				'via'   => 'smtp',
			);
		} catch ( \PHPMailer\PHPMailer\Exception $e ) {
			return array(
				'ok'    => false,
				'error' => $e->getMessage(),
				'via'   => 'smtp',
			);
		}
	}
}
