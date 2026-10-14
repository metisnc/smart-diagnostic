<?php
/**
 * Modèle d'email personnalisé (saisi dans le constructeur) : variables et blocs dynamiques.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Integrations;

use SmartDiagnostic\Engine\Text;

/**
 * Le corps saisi est assaini (HTML d'email autorisé), puis les variables sont remplacées :
 * les valeurs saisies par le visiteur sont toujours échappées.
 */
final class CustomEmail {

	/**
	 * Variables proposées dans le constructeur (clé => description).
	 *
	 * @return array<string, string>
	 */
	public static function placeholders(): array {
		return array(
			'{first_name}'    => __( 'First name', 'smart-diagnostic' ),
			'{email}'         => __( 'Email', 'smart-diagnostic' ),
			'{diagnostic}'    => __( 'Name of the diagnostic', 'smart-diagnostic' ),
			'{date}'          => __( 'Date', 'smart-diagnostic' ),
			'{profile}'       => __( 'Profile name', 'smart-diagnostic' ),
			'{profile_text}'  => __( 'Profile text', 'smart-diagnostic' ),
			'{scores}'        => __( 'Scores (bars)', 'smart-diagnostic' ),
			'{texts}'         => __( 'Conditional texts', 'smart-diagnostic' ),
			'{actions}'       => __( 'Action plan', 'smart-diagnostic' ),
			'{cta}'           => __( 'Call-to-action button', 'smart-diagnostic' ),
			'{result_button}' => __( 'Button to the results page', 'smart-diagnostic' ),
			'{result_link}'   => __( 'Address of the results page', 'smart-diagnostic' ),
			'{answers}'       => __( 'Table of the answers', 'smart-diagnostic' ),
			'{score:key}'     => __( 'Score of an axis (key of the axis)', 'smart-diagnostic' ),
			'{answer:key}'    => __( 'Answer to a question (key of the question)', 'smart-diagnostic' ),
			'{var:key}'       => __( 'Calculated value', 'smart-diagnostic' ),
			'{contact:field}' => __( 'Contact field', 'smart-diagnostic' ),
		);
	}

	/**
	 * Balises autorisées dans un corps personnalisé (HTML d'email classique).
	 *
	 * @return array<string, array<string, bool>>
	 */
	private static function allowed_html( bool $full_html ): array {
		$allowed = wp_kses_allowed_html( 'post' );
		foreach ( array( 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'div', 'span', 'p', 'a', 'img', 'h1', 'h2', 'h3', 'center' ) as $tag ) {
			$allowed[ $tag ] = array_merge(
				$allowed[ $tag ] ?? array(),
				array(
					'style'       => true,
					'class'       => true,
					'align'       => true,
					'width'       => true,
					'height'      => true,
					'bgcolor'     => true,
					'cellpadding' => true,
					'cellspacing' => true,
					'border'      => true,
					'role'        => true,
				)
			);
		}
		if ( $full_html ) {
			foreach ( array( 'html', 'head', 'body', 'style', 'title' ) as $tag ) {
				$allowed[ $tag ] = array(
					'style' => true,
					'lang'  => true,
				);
			}
			$allowed['meta'] = array(
				'charset'    => true,
				'name'       => true,
				'content'    => true,
				'http-equiv' => true,
			);
		}
		return $allowed;
	}

	/**
	 * Corps final de l'email personnalisé.
	 *
	 * @param string               $body       Corps saisi (déjà résolu dans la bonne langue).
	 * @param bool                 $full_html  Document complet (sans le cadre du plugin).
	 * @param array<string, mixed> $submission Soumission.
	 * @param array<string, mixed> $config     Config.
	 */
	public static function render( string $body, bool $full_html, array $submission, array $config ): string {
		$data = Mailer::template_data( $submission, $config );

		// 1. HTML saisi assaini (les blocs générés par le plugin sont ajoutés ensuite).
		$html = wp_kses( $body, self::allowed_html( $full_html ) );
		if ( ! $full_html && ! preg_match( '/<(p|div|table|h[1-6]|ul|ol)\b/i', $html ) ) {
			$html = wpautop( $html );
		}

		// 2. Blocs dynamiques.
		$blocks = self::blocks( $data, $submission );
		$html   = (string) preg_replace_callback(
			'/\{(' . implode( '|', array_map( 'preg_quote', array_keys( $blocks ) ) ) . ')\}/',
			static fn( array $m ): string => $blocks[ $m[1] ],
			$html
		);

		// 3. Variables simples (valeurs échappées).
		$html = (string) preg_replace_callback(
			'/\{(first_name|(answer|score|var|contact):[a-z][a-z0-9_]*)\}/',
			static fn( array $m ): string => esc_html( Text::interpolate( $m[0], $config, $submission ) ),
			$html
		);

		if ( $full_html ) {
			return $html;
		}
		$file = Mailer::locate( 'emails/custom.php' );
		if ( null === $file ) {
			return $html;
		}
		$data['content'] = $html;
		ob_start();
		( static function ( string $sd_file, array $sd ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- $sd est utilisé par le modèle.
			include $sd_file;
		} )( $file, $data );
		return (string) ob_get_clean();
	}

	/**
	 * HTML des blocs dynamiques, en styles en ligne (compatibles messageries).
	 *
	 * @param array<string, mixed> $data       Données des modèles (Mailer::template_data()).
	 * @param array<string, mixed> $submission Soumission.
	 * @return array<string, string>
	 */
	private static function blocks( array $data, array $submission ): array {
		$color  = esc_attr( (string) $data['color'] );
		$button = static fn( string $url, string $label ): string => '' === $url ? '' : sprintf(
			'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td style="border-radius:8px;background:%1$s;"><a href="%2$s" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:bold;">%3$s</a></td></tr></table>',
			$color,
			esc_url( $url ),
			esc_html( $label )
		);

		$scores = '';
		foreach ( $data['scores'] as $score ) {
			$percent = $score['max'] > 0 ? max( 0, min( 100, round( $score['value'] / $score['max'] * 100 ) ) ) : 0;
			$scores .= sprintf(
				'<div style="margin:8px 0;"><div style="font-size:14px;margin-bottom:4px;">%1$s — <strong>%2$s</strong></div><div style="height:8px;background:#e5e7eb;border-radius:4px;"><div style="height:8px;width:%3$d%%;background:%4$s;border-radius:4px;"></div></div></div>',
				esc_html( $score['label'] ),
				esc_html( $score['value'] . ' / ' . $score['max'] ),
				(int) $percent,
				$color
			);
		}

		$texts = '';
		foreach ( $data['texts'] as $item ) {
			$texts .= ( '' !== $item['title'] ? '<h3 style="font-size:16px;margin:16px 0 6px;">' . esc_html( $item['title'] ) . '</h3>' : '' ) . wp_kses_post( wpautop( $item['body'] ) );
		}

		$actions = '';
		if ( $data['actions'] ) {
			$actions = '<ol style="padding-left:20px;">';
			foreach ( $data['actions'] as $item ) {
				$actions .= '<li style="margin-bottom:8px;">' . ( '' !== $item['title'] ? '<strong>' . esc_html( $item['title'] ) . '</strong><br>' : '' ) . wp_kses_post( $item['body'] ) . '</li>';
			}
			$actions .= '</ol>';
		}

		$answers = '';
		if ( $data['answers'] ) {
			$answers = '<table role="presentation" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">';
			foreach ( $data['answers'] as $answer ) {
				$answers .= sprintf(
					'<tr><th align="left" style="border-bottom:1px solid #e5e7eb;">%s</th><td style="border-bottom:1px solid #e5e7eb;">%s</td></tr>',
					esc_html( $answer['label'] ),
					esc_html( $answer['value'] )
				);
			}
			$answers .= '</table>';
		}

		$created = (string) ( $submission['created_at'] ?? '' );
		return array(
			'email'         => esc_html( (string) $data['email'] ),
			'diagnostic'    => esc_html( get_the_title( (int) ( $submission['diagnostic_id'] ?? 0 ) ) ),
			'date'          => esc_html( '' !== $created ? get_date_from_gmt( $created, (string) get_option( 'date_format' ) ) : date_i18n( (string) get_option( 'date_format' ) ) ),
			'profile'       => esc_html( (string) ( $data['profile']['label'] ?? '' ) ),
			'profile_text'  => wp_kses_post( wpautop( (string) ( $data['profile']['text'] ?? '' ) ) ),
			'scores'        => $scores,
			'texts'         => $texts,
			'actions'       => $actions,
			'cta'           => null === $data['cta'] ? '' : $button( (string) $data['cta']['url'], (string) $data['cta']['label'] ),
			'result_button' => $button( (string) $data['result_url'], __( 'View my results', 'smart-diagnostic' ) ),
			'result_link'   => esc_url( (string) $data['result_url'] ),
			'answers'       => $answers,
		);
	}
}
