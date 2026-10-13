<?php
/**
 * Migrations de la configuration entre versions du schéma.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Config;

/**
 * Chaque migration transforme une config de la version N vers N+1.
 * Pour faire évoluer le format : incrémenter CURRENT_VERSION, ajouter la
 * migration dans migrations() et le même cas dans les tests.
 */
final class Migrator {

	public const CURRENT_VERSION = 1;

	/**
	 * Amène une config (décodée en objets) à la version courante.
	 *
	 * @param \stdClass $config Config décodée avec json_decode( $json ).
	 * @throws \InvalidArgumentException Si la config vient d'une version plus récente du plugin.
	 */
	public function migrate( \stdClass $config ): \stdClass {
		$version = isset( $config->schemaVersion ) && is_int( $config->schemaVersion ) ? $config->schemaVersion : 1;

		if ( $version > self::CURRENT_VERSION ) {
			throw new \InvalidArgumentException(
				sprintf( 'Configuration schema version %d is newer than supported version %d.', (int) $version, (int) self::CURRENT_VERSION )
			);
		}

		$migrations = $this->migrations();
		while ( $version < self::CURRENT_VERSION ) {
			$config = $migrations[ $version ]( $config );
			++$version;
		}

		$config->schemaVersion = self::CURRENT_VERSION;
		return $config;
	}

	/**
	 * Migrations indexées par version de départ.
	 *
	 * @return array<int, callable(\stdClass): \stdClass>
	 */
	private function migrations(): array {
		/**
		 * Permet d'ajouter des migrations (tests, extensions).
		 *
		 * @param array<int, callable> $migrations Migrations indexées par version de départ.
		 */
		return apply_filters( 'sd_config_migrations', array() );
	}
}
