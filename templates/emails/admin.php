<?php
/**
 * Email à l'administrateur : nouvelle soumission (modèle par défaut).
 *
 * Reprend l'apparence du questionnaire (couleurs, polices, arrondis, logo).
 * Remplaçable par le thème : <thème>/smart-diagnostic/emails/admin.php.
 * Variable disponible : $sd (voir Mailer::template_data()).
 *
 * @package SmartDiagnostic
 */

defined( 'ABSPATH' ) || exit;

$sd_t    = $sd['theme'];
$sd_cell = 'padding:6px 8px;border-bottom:1px solid ' . $sd_t['surface'] . ';';
?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>@media only screen and (max-width:620px){body{padding:8px!important}.sd-email-pad{padding:20px!important}}</style>
</head>
<body style="margin:0;padding:24px;background:<?php echo esc_attr( $sd_t['surface'] ); ?>;font-family:<?php echo esc_attr( $sd_t['font'] ); ?>;color:<?php echo esc_attr( $sd_t['text'] ); ?>;line-height:1.5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:<?php echo esc_attr( $sd_t['background'] ); ?>;border-radius:<?php echo esc_attr( $sd_t['radius'] ); ?>;">
	<tr><td class="sd-email-pad" style="padding:28px;">
		<?php if ( $sd_t['logo'] ) : ?>
			<p style="margin:0 0 20px;"><img src="<?php echo esc_url( $sd_t['logo'] ); ?>" alt="<?php echo esc_attr( $sd_t['logo_alt'] ); ?>" style="max-height:40px;width:auto;border:0;"></p>
		<?php endif; ?>
		<h1 style="margin:0 0 16px;font-size:20px;font-family:<?php echo esc_attr( $sd_t['heading_font'] ); ?>;color:<?php echo esc_attr( $sd_t['primary'] ); ?>;"><?php echo esc_html( get_the_title( (int) $sd['submission']['diagnostic_id'] ) ); ?></h1>

		<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
			<tr><th align="left" style="<?php echo esc_attr( $sd_cell ); ?>"><?php esc_html_e( 'First name', 'smart-diagnostic' ); ?></th><td style="<?php echo esc_attr( $sd_cell ); ?>"><?php echo esc_html( $sd['first_name'] ); ?></td></tr>
			<tr><th align="left" style="<?php echo esc_attr( $sd_cell ); ?>"><?php esc_html_e( 'Email', 'smart-diagnostic' ); ?></th><td style="<?php echo esc_attr( $sd_cell ); ?>"><?php echo esc_html( $sd['email'] ); ?></td></tr>
			<?php if ( $sd['profile'] ) : ?>
				<tr><th align="left" style="<?php echo esc_attr( $sd_cell ); ?>"><?php esc_html_e( 'Profile', 'smart-diagnostic' ); ?></th><td style="<?php echo esc_attr( $sd_cell ); ?>"><strong><?php echo esc_html( $sd['profile']['label'] ); ?></strong></td></tr>
			<?php endif; ?>
			<?php foreach ( $sd['scores'] as $sd_score ) : ?>
				<tr><th align="left" style="<?php echo esc_attr( $sd_cell ); ?>"><?php echo esc_html( $sd_score['label'] ); ?></th><td style="<?php echo esc_attr( $sd_cell ); ?>"><?php echo esc_html( $sd_score['value'] . ' / ' . $sd_score['max'] ); ?></td></tr>
			<?php endforeach; ?>
		</table>

		<h2 style="margin:24px 0 8px;font-size:16px;font-family:<?php echo esc_attr( $sd_t['heading_font'] ); ?>;"><?php esc_html_e( 'Answers', 'smart-diagnostic' ); ?></h2>
		<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;">
			<?php foreach ( $sd['answers'] as $sd_answer ) : ?>
				<tr><th align="left" style="<?php echo esc_attr( $sd_cell ); ?>"><?php echo esc_html( $sd_answer['label'] ); ?></th><td style="<?php echo esc_attr( $sd_cell ); ?>"><?php echo esc_html( $sd_answer['value'] ); ?></td></tr>
			<?php endforeach; ?>
		</table>

		<p style="margin:24px 0 0;">
			<a href="<?php echo esc_url( $sd['admin_url'] ); ?>" style="display:inline-block;padding:10px 18px;background:<?php echo esc_attr( $sd_t['primary'] ); ?>;color:<?php echo esc_attr( $sd_t['primary_text'] ); ?>;text-decoration:none;border-radius:<?php echo esc_attr( $sd_t['radius'] ); ?>;font-weight:bold;"><?php esc_html_e( 'View in the admin', 'smart-diagnostic' ); ?></a>
			&nbsp; <a href="<?php echo esc_url( $sd['result_url'] ); ?>" style="color:<?php echo esc_attr( $sd_t['primary'] ); ?>;"><?php esc_html_e( 'View the result page', 'smart-diagnostic' ); ?></a>
		</p>
	</td></tr>
</table>
</body>
</html>
