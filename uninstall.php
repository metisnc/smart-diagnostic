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
