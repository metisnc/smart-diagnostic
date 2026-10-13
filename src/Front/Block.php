<?php
/**
 * Bloc Gutenberg « Diagnostic ».
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Front;

final class Block {

	public const EDITOR_HANDLE = 'smart-diagnostic-block-editor';

	public function __construct( private Renderer $renderer = new Renderer() ) {}

	public function register(): void {
		add_action( 'init', array( $this, 'register_block' ) );
	}

	public function register_block(): void {
		$asset_file = SMART_DIAGNOSTIC_DIR . 'build/block.asset.php';
		if ( ! is_readable( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;

		wp_register_script(
			self::EDITOR_HANDLE,
			SMART_DIAGNOSTIC_URL . 'build/block.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);
		wp_set_script_translations( self::EDITOR_HANDLE, 'smart-diagnostic', SMART_DIAGNOSTIC_DIR . 'languages' );

		register_block_type(
			SMART_DIAGNOSTIC_DIR . 'blocks/diagnostic',
			array( 'render_callback' => array( $this, 'render' ) )
		);
	}

	/**
	 * @param array<string, mixed> $attributes Attributs du bloc.
	 */
	public function render( array $attributes ): string {
		$id = isset( $attributes['diagnosticId'] ) ? (int) $attributes['diagnosticId'] : 0;
		if ( $id <= 0 ) {
			return '';
		}
		return sprintf( '<div %s>%s</div>', get_block_wrapper_attributes(), $this->renderer->render( (string) $id ) );
	}
}
