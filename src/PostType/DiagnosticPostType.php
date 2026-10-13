<?php
/**
 * Custom Post Type sd_diagnostic : un diagnostic = un post + sa config JSON.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\PostType;

use SmartDiagnostic\Branding;

final class DiagnosticPostType {

	public const NAME = 'sd_diagnostic';

	public function register(): void {
		add_action( 'init', array( $this, 'register_post_type' ) );
		add_filter( 'manage_' . self::NAME . '_posts_columns', array( $this, 'add_shortcode_column' ) );
		add_action( 'manage_' . self::NAME . '_posts_custom_column', array( $this, 'render_shortcode_column' ), 10, 2 );
	}

	public function register_post_type(): void {
		$brand = Branding::name();

		register_post_type(
			self::NAME,
			array(
				'labels'          => array(
					'name'               => $brand,
					'menu_name'          => $brand,
					'singular_name'      => __( 'Diagnostic', 'smart-diagnostic' ),
					'all_items'          => __( 'Diagnostics', 'smart-diagnostic' ),
					'add_new'            => __( 'Add diagnostic', 'smart-diagnostic' ),
					'add_new_item'       => __( 'Add diagnostic', 'smart-diagnostic' ),
					'edit_item'          => __( 'Edit diagnostic', 'smart-diagnostic' ),
					'new_item'           => __( 'New diagnostic', 'smart-diagnostic' ),
					'search_items'       => __( 'Search diagnostics', 'smart-diagnostic' ),
					'not_found'          => __( 'No diagnostics found.', 'smart-diagnostic' ),
					'not_found_in_trash' => __( 'No diagnostics found in Trash.', 'smart-diagnostic' ),
				),
				'public'          => false,
				'show_ui'         => true,
				'show_in_menu'    => true,
				'show_in_rest'    => true,
				'rest_base'       => 'sd-diagnostics',
				'menu_icon'       => 'dashicons-clipboard',
				'menu_position'   => 26,
				'supports'        => array( 'title', 'revisions' ),
				'capability_type' => 'post',
				'map_meta_cap'    => true,
				'rewrite'         => false,
				'query_var'       => false,
			)
		);
	}

	/**
	 * Ajoute la colonne « Shortcode ».
	 *
	 * @param array<string, string> $columns Colonnes de la liste.
	 * @return array<string, string>
	 */
	public function add_shortcode_column( array $columns ): array {
		$columns['sd_shortcode'] = __( 'Shortcode', 'smart-diagnostic' );
		return $columns;
	}

	public function render_shortcode_column( string $column, int $post_id ): void {
		if ( 'sd_shortcode' === $column ) {
			printf( '<code>[smart_diagnostic id="%d"]</code>', (int) $post_id );
		}
	}
}
