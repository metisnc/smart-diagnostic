<?php
/**
 * Serveur MCP du plugin, via le MCP Adapter officiel de WordPress (plugin « MCP Adapter »).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Mcp;

use SmartDiagnostic\Settings;

/**
 * Point d'accès : /wp-json/smart-diagnostic/mcp (HTTP, authentification par mot de passe
 * d'application WordPress). Chaque action du plugin y est un outil MCP.
 */
final class Server {

	public const ID        = 'smart-diagnostic';
	public const NAMESPACE = 'smart-diagnostic';
	public const ROUTE     = 'mcp';

	/** Classe de transport HTTP du MCP Adapter. */
	private const TRANSPORT = '\\WP\\MCP\\Transport\\HttpTransport';

	public function __construct( private Abilities $abilities = new Abilities() ) {}

	public function register(): void {
		add_action( 'mcp_adapter_init', array( $this, 'create' ) );
	}

	/**
	 * MCP Adapter installé et actif.
	 */
	public static function adapter_active(): bool {
		return class_exists( '\\WP\\MCP\\Core\\McpAdapter' );
	}

	public static function endpoint(): string {
		return rest_url( self::NAMESPACE . '/' . self::ROUTE );
	}

	/**
	 * @param object $adapter Instance de \WP\MCP\Core\McpAdapter.
	 */
	public function create( object $adapter ): void {
		if ( ! Settings::get( 'mcp_enabled' ) || ! Abilities::available() || ! class_exists( self::TRANSPORT ) || ! method_exists( $adapter, 'create_server' ) ) {
			return;
		}
		$adapter->create_server(
			self::ID,
			self::NAMESPACE,
			self::ROUTE,
			__( 'Smart Diagnostic', 'smart-diagnostic' ),
			__( 'Create, modify and analyse the diagnostics of this site.', 'smart-diagnostic' ),
			defined( 'SMART_DIAGNOSTIC_VERSION' ) ? SMART_DIAGNOSTIC_VERSION : '1.0.0',
			array( ltrim( self::TRANSPORT, '\\' ) ),
			null,
			null,
			$this->abilities->names(),
			array(),
			array(),
			array( self::class, 'allowed' )
		);
	}

	/**
	 * Accès au serveur : connecteur actif et utilisateur connecté (mot de passe d'application)
	 * pouvant gérer des diagnostics. Chaque action vérifie ensuite ses propres droits.
	 */
	public static function allowed(): bool {
		return (bool) Settings::get( 'mcp_enabled' ) && is_user_logged_in() && current_user_can( 'edit_posts' );
	}
}
