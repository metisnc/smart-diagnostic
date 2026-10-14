<?php
/**
 * Cadre des emails personnalisés (contenu saisi dans le constructeur).
 *
 * Reprend l'apparence du questionnaire (couleurs, polices, arrondis, logo).
 * Remplaçable par le thème : <thème>/smart-diagnostic/emails/custom.php.
 * Variable disponible : $sd (voir Mailer::template_data()) ; $sd['content'] = corps personnalisé.
 *
 * @package SmartDiagnostic
 */

defined( 'ABSPATH' ) || exit;

$sd_t = $sd['theme'];
?>
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:<?php echo esc_attr( $sd_t['surface'] ); ?>;font-family:<?php echo esc_attr( $sd_t['font'] ); ?>;color:<?php echo esc_attr( $sd_t['text'] ); ?>;line-height:1.5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:<?php echo esc_attr( $sd_t['background'] ); ?>;border-radius:<?php echo esc_attr( $sd_t['radius'] ); ?>;">
	<tr><td style="padding:32px;">
		<?php if ( $sd_t['logo'] ) : ?>
			<p style="margin:0 0 24px;"><img src="<?php echo esc_url( $sd_t['logo'] ); ?>" alt="<?php echo esc_attr( $sd_t['logo_alt'] ); ?>" style="max-height:48px;width:auto;border:0;"></p>
		<?php endif; ?>
		<?php echo $sd['content']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- assaini par CustomEmail::render(). ?>
	</td></tr>
</table>
</body>
</html>
