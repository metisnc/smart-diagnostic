<?php
/**
 * Désinstallation : supprime toutes les données du plugin
 * (diagnostics, soumissions, réglages).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

delete_option( 'sd_version' );
delete_option( 'sd_settings' );
delete_option( 'sd_db_version' );
wp_clear_scheduled_hook( 'sd_purge_submissions' );
wp_unschedule_hook( 'sd_webhook_retry' );

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

// Soumissions.
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}sd_submissions" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}sd_events" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
