<?php
/**
 * Email à l'administrateur : nouvelle soumission.
 *
 * Remplaçable par le thème : <thème>/smart-diagnostic/emails/admin.php.
 * Variable disponible : $sd (voir Mailer::template_data()).
 *
 * @package SmartDiagnostic
 */

defined( 'ABSPATH' ) || exit;
?>
<!doctype html>
<html>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
	<h1 style="font-size:20px;"><?php echo esc_html( get_the_title( (int) $sd['submission']['diagnostic_id'] ) ); ?></h1>
	<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
		<tr><th align="left"><?php esc_html_e( 'First name', 'smart-diagnostic' ); ?></th><td><?php echo esc_html( $sd['first_name'] ); ?></td></tr>
		<tr><th align="left"><?php esc_html_e( 'Email', 'smart-diagnostic' ); ?></th><td><?php echo esc_html( $sd['email'] ); ?></td></tr>
		<?php if ( $sd['profile'] ) : ?>
			<tr><th align="left"><?php esc_html_e( 'Profile', 'smart-diagnostic' ); ?></th><td><?php echo esc_html( $sd['profile']['label'] ); ?></td></tr>
		<?php endif; ?>
		<?php foreach ( $sd['scores'] as $sd_score ) : ?>
			<tr><th align="left"><?php echo esc_html( $sd_score['label'] ); ?></th><td><?php echo esc_html( $sd_score['value'] . ' / ' . $sd_score['max'] ); ?></td></tr>
		<?php endforeach; ?>
	</table>

	<h2 style="font-size:16px;margin-top:24px;"><?php esc_html_e( 'Answers', 'smart-diagnostic' ); ?></h2>
	<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
		<?php foreach ( $sd['answers'] as $sd_answer ) : ?>
			<tr><th align="left" style="border-bottom:1px solid #e5e7eb;"><?php echo esc_html( $sd_answer['label'] ); ?></th><td style="border-bottom:1px solid #e5e7eb;"><?php echo esc_html( $sd_answer['value'] ); ?></td></tr>
		<?php endforeach; ?>
	</table>

	<p style="margin-top:24px;">
		<a href="<?php echo esc_url( $sd['admin_url'] ); ?>"><?php esc_html_e( 'View in the admin', 'smart-diagnostic' ); ?></a>
		· <a href="<?php echo esc_url( $sd['result_url'] ); ?>"><?php esc_html_e( 'View the result page', 'smart-diagnostic' ); ?></a>
	</p>
</body>
</html>
