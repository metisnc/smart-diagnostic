<?php
/**
 * Activation / désactivation du plugin.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic;

/**
 * Les tables, rôles et tâches planifiées seront ajoutés ici au fil des milestones.
 */
final class Lifecycle {

	public const OPTION_VERSION = 'sd_version';

	public static function activate(): void {
		update_option( self::OPTION_VERSION, SMART_DIAGNOSTIC_VERSION, false );
		flush_rewrite_rules();
	}

	public static function deactivate(): void {
		flush_rewrite_rules();
	}
}
