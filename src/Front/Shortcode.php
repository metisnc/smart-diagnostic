<?php
/**
 * Shortcode [smart_diagnostic id="..."].
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Front;

final class Shortcode {

	public const TAG = 'smart_diagnostic';

	public function __construct( private Renderer $renderer = new Renderer() ) {}

	public function register(): void {
		add_shortcode( self::TAG, array( $this, 'render' ) );
	}

	/**
	 * @param array<string, string>|string $atts Attributs du shortcode.
	 */
	public function render( array|string $atts ): string {
		$atts = shortcode_atts( array( 'id' => '' ), (array) $atts, self::TAG );
		return $this->renderer->render( (string) $atts['id'] );
	}
}
