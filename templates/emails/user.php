<?php
/**
 * Email au visiteur : son résultat (modèle par défaut).
 *
 * Reprend l'apparence du questionnaire (couleurs, polices, arrondis, logo).
 * Remplaçable par le thème : copier ce fichier dans
 * <thème>/smart-diagnostic/emails/user.php.
 *
 * Variable disponible : $sd (voir Mailer::template_data()) — brand, title, first_name,
 * theme { primary, primary_text, background, surface, text, muted, font, heading_font, radius, logo },
 * profile { label, text }, scores [ { label, value, max } ], texts / actions [ { title, body } ],
 * cta { label, url }, result_url, answers, submission, config.
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

		<h1 style="margin:0 0 16px;font-size:22px;font-family:<?php echo esc_attr( $sd_t['heading_font'] ); ?>;"><?php echo esc_html( $sd['title'] ); ?></h1>

		<?php if ( $sd['profile'] ) : ?>
			<div style="margin:0 0 24px;padding:16px;border-left:5px solid <?php echo esc_attr( $sd_t['primary'] ); ?>;background:<?php echo esc_attr( $sd_t['surface'] ); ?>;border-radius:<?php echo esc_attr( $sd_t['radius'] ); ?>;">
				<p style="margin:0 0 8px;font-size:18px;font-weight:bold;font-family:<?php echo esc_attr( $sd_t['heading_font'] ); ?>;color:<?php echo esc_attr( $sd_t['primary'] ); ?>;"><?php echo esc_html( $sd['profile']['label'] ); ?></p>
				<?php echo wp_kses_post( wpautop( $sd['profile']['text'] ) ); ?>
			</div>
		<?php endif; ?>

		<?php if ( $sd['scores'] ) : ?>
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
				<?php foreach ( $sd['scores'] as $sd_score ) : ?>
					<?php $sd_percent = $sd_score['max'] > 0 ? max( 0, min( 100, round( $sd_score['value'] / $sd_score['max'] * 100 ) ) ) : 0; ?>
					<tr><td style="padding:6px 0;">
						<div style="font-size:14px;margin-bottom:4px;"><?php echo esc_html( $sd_score['label'] ); ?> — <strong><?php echo esc_html( $sd_score['value'] . ' / ' . $sd_score['max'] ); ?></strong></div>
						<div style="height:8px;background:<?php echo esc_attr( $sd_t['surface'] ); ?>;border-radius:4px;"><div style="height:8px;width:<?php echo esc_attr( (string) $sd_percent ); ?>%;background:<?php echo esc_attr( $sd_t['primary'] ); ?>;border-radius:4px;"></div></div>
					</td></tr>
				<?php endforeach; ?>
			</table>
		<?php endif; ?>

		<?php foreach ( $sd['texts'] as $sd_item ) : ?>
			<?php if ( $sd_item['title'] ) : ?>
				<h2 style="font-size:16px;margin:0 0 8px;font-family:<?php echo esc_attr( $sd_t['heading_font'] ); ?>;"><?php echo esc_html( $sd_item['title'] ); ?></h2>
			<?php endif; ?>
			<?php echo wp_kses_post( wpautop( $sd_item['body'] ) ); ?>
		<?php endforeach; ?>

		<?php if ( $sd['actions'] ) : ?>
			<ol style="padding-left:20px;">
				<?php foreach ( $sd['actions'] as $sd_item ) : ?>
					<li style="margin-bottom:8px;">
						<?php if ( $sd_item['title'] ) : ?>
							<strong><?php echo esc_html( $sd_item['title'] ); ?></strong><br>
						<?php endif; ?>
						<?php echo wp_kses_post( $sd_item['body'] ); ?>
					</li>
				<?php endforeach; ?>
			</ol>
		<?php endif; ?>

		<?php if ( $sd['cta'] ) : ?>
			<p style="text-align:center;margin:32px 0;">
				<a href="<?php echo esc_url( $sd['cta']['url'] ); ?>" style="display:inline-block;padding:14px 28px;background:<?php echo esc_attr( $sd_t['primary'] ); ?>;color:<?php echo esc_attr( $sd_t['primary_text'] ); ?>;text-decoration:none;border-radius:<?php echo esc_attr( $sd_t['radius'] ); ?>;font-weight:bold;"><?php echo esc_html( $sd['cta']['label'] ); ?></a>
			</p>
		<?php endif; ?>

		<p style="font-size:14px;color:<?php echo esc_attr( $sd_t['muted'] ); ?>;">
			<?php esc_html_e( 'View your results online at any time:', 'smart-diagnostic' ); ?><br>
			<a href="<?php echo esc_url( $sd['result_url'] ); ?>" style="color:<?php echo esc_attr( $sd_t['primary'] ); ?>;"><?php echo esc_html( $sd['result_url'] ); ?></a>
		</p>
	</td></tr>
</table>
</body>
</html>
