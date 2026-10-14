<?php
/**
 * Cadre des emails personnalisés (contenu saisi dans le constructeur).
 *
 * Remplaçable par le thème : <thème>/smart-diagnostic/emails/custom.php.
 * Variable disponible : $sd (voir Mailer::template_data()) ; $sd['content'] = corps personnalisé.
 *
 * @package SmartDiagnostic
 */

defined( 'ABSPATH' ) || exit;
?>
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;">
	<tr><td style="padding:32px;">
		<?php echo $sd['content']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- assaini par CustomEmail::render(). ?>
	</td></tr>
</table>
</body>
</html>
