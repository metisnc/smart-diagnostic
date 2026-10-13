<?php
/**
 * Désinstallation : supprime les données du plugin.
 *
 * Les tables (sd_submissions, sd_events) et le CPT sd_diagnostic seront
 * ajoutés ici dans les milestones qui les créent.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'sd_version' );

// Diagnostics (CPT sd_diagnostic) et leurs métadonnées.
$smart_diagnostic_ids = get_posts(
	array(
		'post_type'      => 'sd_diagnostic',
		'post_status'    => 'any',
		'posts_per_page' => -1,
		'fields'         => 'ids',
	)
);
foreach ( $smart_diagnostic_ids as $smart_diagnostic_id ) {
	wp_delete_post( (int) $smart_diagnostic_id, true );
}
