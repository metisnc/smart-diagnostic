<?php
/**
 * Tables du plugin (créées / mises à jour via dbDelta, versionnées).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Storage;

/**
 * Pour faire évoluer une table : modifier le SQL ci-dessous et incrémenter VERSION.
 */
final class Schema {

	public const VERSION        = 3;
	public const OPTION_VERSION = 'sd_db_version';

	public static function submissions_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'sd_submissions';
	}

	public static function events_table(): string {
		global $wpdb;
		return $wpdb->prefix . 'sd_events';
	}

	public static function maybe_upgrade(): void {
		if ( (int) get_option( self::OPTION_VERSION ) !== self::VERSION ) {
			self::install();
		}
	}

	public static function install(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table   = self::submissions_table();
		$charset = $wpdb->get_charset_collate();

		// dbDelta : deux espaces avant PRIMARY KEY, une définition par ligne.
		dbDelta(
			"CREATE TABLE {$table} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				diagnostic_id bigint(20) unsigned NOT NULL,
				token char(32) NOT NULL,
				created_at datetime NOT NULL,
				updated_at datetime NOT NULL,
				email varchar(190) NOT NULL DEFAULT '',
				first_name varchar(190) NOT NULL DEFAULT '',
				contact longtext NOT NULL,
				answers longtext NOT NULL,
				path longtext NOT NULL,
				scores longtext NOT NULL,
				vars longtext NOT NULL,
				profile varchar(64) NOT NULL DEFAULT '',
				cta varchar(64) NOT NULL DEFAULT '',
				result longtext NOT NULL,
				consent tinyint(1) NOT NULL DEFAULT 0,
				consent_at datetime NULL DEFAULT NULL,
				consent_version varchar(64) NOT NULL DEFAULT '',
				utm text NOT NULL,
				lang varchar(20) NOT NULL DEFAULT '',
				source_url text NOT NULL,
				ip_hash char(64) NOT NULL DEFAULT '',
				config_hash char(32) NOT NULL DEFAULT '',
				user_email_sent_at datetime NULL DEFAULT NULL,
				webhooks longtext NULL,
				PRIMARY KEY  (id),
				UNIQUE KEY token (token),
				KEY diagnostic_created (diagnostic_id, created_at),
				KEY profile (profile),
				KEY cta (cta),
				KEY email (email)
			) {$charset};"
		);

		// Événements anonymes (aucune donnée personnelle) : entonnoir et abandons.
		$events = self::events_table();
		dbDelta(
			"CREATE TABLE {$events} (
				id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
				diagnostic_id bigint(20) unsigned NOT NULL,
				session char(32) NOT NULL,
				event varchar(20) NOT NULL,
				step varchar(64) NOT NULL DEFAULT '',
				created_at datetime NOT NULL,
				PRIMARY KEY  (id),
				KEY diagnostic_created (diagnostic_id, created_at),
				KEY session (session)
			) {$charset};"
		);

		update_option( self::OPTION_VERSION, self::VERSION, false );
	}
}
