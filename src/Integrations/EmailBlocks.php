<?php
/**
 * Éditeur visuel des emails : blocs → HTML d'email (tableaux, styles en ligne).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Integrations;

use SmartDiagnostic\Engine\Text;

/**
 * Les blocs produisent un corps HTML avec variables, ensuite traité comme un modèle
 * personnalisé (CustomEmail::render) : assaini, variables remplacées et échappées.
 */
final class EmailBlocks {

	/** Liens de bouton acceptés en plus des adresses http(s) / mailto. */
	private const LINK_TOKENS = array( '{result_link}' );

	/**
	 * Corps HTML (avec variables) des blocs.
	 *
	 * @param list<array<string, mixed>> $blocks   Blocs.
	 * @param string                     $lang     Langue du visiteur.
	 * @param string                     $fallback Langue par défaut du diagnostic.
	 * @param array<string, string>      $theme    Apparence (Mailer::email_theme()).
	 */
	public static function html( array $blocks, string $lang, string $fallback, array $theme ): string {
		$html = '';
		foreach ( $blocks as $block ) {
			if ( is_array( $block ) ) {
				$html .= self::block( $block, $lang, $fallback, $theme ) . "\n";
			}
		}
		return $html;
	}

	/**
	 * Config dont l'apparence est remplacée par le style de l'email (valeurs renseignées seulement).
	 *
	 * @param array<string, mixed> $config Config.
	 * @param array<string, mixed> $style  Style de l'email.
	 * @return array<string, mixed>
	 */
	public static function with_style( array $config, array $style ): array {
		foreach ( array( 'primary', 'background', 'surface', 'text' ) as $key ) {
			if ( ! empty( $style[ $key ] ) ) {
				$config['ui']['theme']['colors'][ $key ] = (string) $style[ $key ];
			}
		}
		if ( ! empty( $style['fontFamily'] ) ) {
			$config['ui']['theme']['fontFamily']        = (string) $style['fontFamily'];
			$config['ui']['theme']['headingFontFamily'] = (string) $style['fontFamily'];
		}
		if ( ! empty( $style['logo'] ) ) {
			$config['ui']['logo']['url'] = (string) $style['logo'];
		}
		return $config;
	}

	/**
	 * Modèles de départ de l'éditeur visuel (résultat, notification équipe, relance).
	 *
	 * @return array<string, array{label: string, kind: string, subject: string, blocks: list<array<string, mixed>>}>
	 */
	public static function presets(): array {
		return array(
			'user'     => array(
				'label'   => __( 'Results for the visitor', 'smart-diagnostic' ),
				'kind'    => 'user',
				'subject' => __( 'Your results', 'smart-diagnostic' ),
				'blocks'  => array(
					array(
						'type' => 'heading',
						'text' => __( 'Hello {first_name},', 'smart-diagnostic' ),
						'size' => 'large',
					),
					array(
						'type' => 'text',
						'text' => __( 'Thank you for taking the diagnostic. Here is your personalised result.', 'smart-diagnostic' ),
					),
					array( 'type' => 'profile' ),
					array( 'type' => 'scores' ),
					array( 'type' => 'texts' ),
					array( 'type' => 'actions' ),
					array( 'type' => 'cta' ),
					array( 'type' => 'divider' ),
					array(
						'type' => 'text',
						'text' => __( 'Your detailed report stays available online:', 'smart-diagnostic' ),
					),
					array(
						'type' => 'button',
						'text' => __( 'View my report', 'smart-diagnostic' ),
						'url'  => '{result_link}',
					),
				),
			),
			'admin'    => array(
				'label'   => __( 'Notification for the team', 'smart-diagnostic' ),
				'kind'    => 'admin',
				'subject' => __( 'New submission: {first_name}', 'smart-diagnostic' ),
				'blocks'  => array(
					array(
						'type' => 'heading',
						'text' => __( 'New submission', 'smart-diagnostic' ),
						'size' => 'medium',
					),
					array(
						'type' => 'text',
						'text' => __( "**{first_name}** ({email}) has completed the diagnostic.\nProfile: **{profile}**", 'smart-diagnostic' ),
					),
					array( 'type' => 'scores' ),
					array( 'type' => 'answers' ),
					array(
						'type' => 'button',
						'text' => __( 'View the report', 'smart-diagnostic' ),
						'url'  => '{result_link}',
					),
				),
			),
			'followUp' => array(
				'label'   => __( 'Follow-up a few days later', 'smart-diagnostic' ),
				'kind'    => 'followUp',
				'subject' => __( '{first_name}, what are your next steps?', 'smart-diagnostic' ),
				'blocks'  => array(
					array(
						'type' => 'heading',
						'text' => __( 'Hello {first_name},', 'smart-diagnostic' ),
						'size' => 'large',
					),
					array(
						'type' => 'text',
						'text' => __( "A few days ago, you took our diagnostic. Your profile: **{profile}**.\n\nHave you started putting the recommendations into practice? Here is a reminder of your action plan.", 'smart-diagnostic' ),
					),
					array( 'type' => 'actions' ),
					array( 'type' => 'cta' ),
					array(
						'type'  => 'button',
						'text'  => __( 'See my results again', 'smart-diagnostic' ),
						'url'   => '{result_link}',
						'align' => 'left',
					),
					array(
						'type' => 'text',
						'text' => __( 'Just reply to this email if you have any questions.', 'smart-diagnostic' ),
					),
				),
			),
		);
	}

	/**
	 * @param array<string, mixed>  $block    Bloc.
	 * @param string                $lang     Langue.
	 * @param string                $fallback Langue par défaut.
	 * @param array<string, string> $theme    Apparence.
	 */
	private static function block( array $block, string $lang, string $fallback, array $theme ): string {
		$text  = Text::resolve( $block['text'] ?? '', $lang, $fallback );
		$align = in_array( $block['align'] ?? '', array( 'left', 'center', 'right' ), true ) ? $block['align'] : 'left';
		$size  = in_array( $block['size'] ?? '', array( 'small', 'medium', 'large' ), true ) ? $block['size'] : 'medium';
		$hfont = esc_attr( $theme['heading_font'] );

		switch ( $block['type'] ?? '' ) {
			case 'heading':
				$sizes = array(
					'small'  => array( 'h3', 17 ),
					'medium' => array( 'h2', 21 ),
					'large'  => array( 'h1', 26 ),
				);

				[ $tag, $px ] = $sizes[ $size ];
				return sprintf( '<%1$s style="margin:0 0 12px;font-family:%2$s;font-size:%3$dpx;line-height:1.3;color:%4$s;text-align:%5$s;">%6$s</%1$s>', $tag, $hfont, $px, esc_attr( $theme['text'] ), $align, esc_html( $text ) );

			case 'text':
				$paragraphs = preg_split( '/\R\s*\R/', trim( $text ) ) ?: array(); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
				$html       = '';
				foreach ( $paragraphs as $paragraph ) {
					$paragraph = nl2br( esc_html( $paragraph ), false );
					$paragraph = (string) preg_replace( '/\*\*(.+?)\*\*/s', '<strong>$1</strong>', $paragraph );
					$html     .= sprintf( '<p style="margin:0 0 14px;text-align:%s;">%s</p>', $align, $paragraph );
				}
				return $html;

			case 'button':
				$url = self::link( (string) ( $block['url'] ?? '' ) );
				if ( '' === $url || '' === $text ) {
					return '';
				}
				return sprintf(
					'<table role="presentation" cellpadding="0" cellspacing="0" align="%6$s" style="margin:16px %7$s;"><tr><td style="border-radius:%4$s;background:%1$s;"><a href="%2$s" style="display:inline-block;padding:14px 28px;color:%5$s;text-decoration:none;font-weight:bold;border-radius:%4$s;">%3$s</a></td></tr></table>',
					esc_attr( $theme['primary'] ),
					$url,
					esc_html( $text ),
					esc_attr( $theme['radius'] ),
					esc_attr( $theme['primary_text'] ),
					$align,
					'center' === $align ? 'auto' : '0'
				);

			case 'image':
				$src = (string) ( $block['url'] ?? '' );
				if ( 1 !== preg_match( '#^https?://#i', $src ) ) {
					return '';
				}
				$width = max( 16, min( 600, (int) ( $block['width'] ?? 536 ) ) );
				$img   = sprintf(
					'<img src="%s" alt="%s" width="%d" style="display:inline-block;width:100%%;max-width:%dpx;height:auto;border:0;">',
					esc_url( $src ),
					esc_attr( wp_strip_all_tags( Text::resolve( $block['alt'] ?? '', $lang, $fallback ) ) ),
					$width,
					$width
				);
				$link  = self::link( (string) ( $block['link'] ?? '' ) );
				if ( '' !== $link ) {
					$img = sprintf( '<a href="%s">%s</a>', $link, $img );
				}
				return sprintf( '<div style="margin:0 0 16px;text-align:%s;">%s</div>', $align, $img );

			case 'divider':
				return sprintf( '<hr style="border:0;border-top:1px solid %s;margin:24px 0;">', esc_attr( $theme['muted'] ) );

			case 'spacer':
				$heights = array(
					'small'  => 12,
					'medium' => 24,
					'large'  => 48,
				);
				return sprintf( '<div style="height:%1$dpx;line-height:%1$dpx;font-size:1px;">&nbsp;</div>', $heights[ $size ] );

			case 'profile':
				return sprintf( '<h2 style="margin:16px 0 8px;font-family:%s;font-size:20px;color:%s;">{profile}</h2>', $hfont, esc_attr( $theme['primary'] ) ) . "\n{profile_text}";

			case 'scores':
			case 'texts':
			case 'actions':
			case 'cta':
			case 'answers':
				return '{' . $block['type'] . '}';
		}
		return '';
	}

	/**
	 * Lien sûr : http(s), mailto, ou variable de lien.
	 */
	private static function link( string $url ): string {
		$url = trim( $url );
		if ( in_array( $url, self::LINK_TOKENS, true ) ) {
			return $url;
		}
		return 1 === preg_match( '#^(https?://|mailto:)#i', $url ) ? esc_url( $url ) : '';
	}
}
