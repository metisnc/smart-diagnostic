<?php
/**
 * Page « Créer depuis un modèle » : galerie des modèles, aperçu, copie.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\Front\Strings;
use SmartDiagnostic\PostType\DiagnosticPostType;
use SmartDiagnostic\Templates\Library;

/**
 * Galerie : chaque carte affiche titre, description, nombre de questions, durée estimée.
 */
final class TemplatesPage {

	public const PAGE       = 'sd-templates';
	private const ACTION    = 'sd_use_template';
	private const HANDLE    = 'sd-templates';
	private const PARENT    = 'edit.php?post_type=' . DiagnosticPostType::NAME;
	private const NEW_TITLE = 'sd_title';

	public function __construct( private Library $library = new Library() ) {}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_post_' . self::ACTION, array( $this, 'use_template' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public static function url(): string {
		return admin_url( self::PARENT . '&page=' . self::PAGE );
	}

	public function add_page(): void {
		add_submenu_page(
			self::PARENT,
			__( 'Create from a template', 'smart-diagnostic' ),
			__( 'Templates', 'smart-diagnostic' ),
			'edit_posts',
			self::PAGE,
			array( $this, 'render' ),
			2
		);
	}

	/**
	 * Bouton « Créer depuis un modèle » à côté de « Ajouter », en haut de la liste.
	 */
	private function list_button(): void {
		$link = sprintf( '<a href="%s" class="page-title-action">%s</a>', esc_url( self::url() ), esc_html__( 'Create from a template', 'smart-diagnostic' ) );
		wp_add_inline_script(
			'common',
			sprintf( 'document.addEventListener("DOMContentLoaded",function(){var a=document.querySelector(".wrap .page-title-action");if(a){a.insertAdjacentHTML("afterend",%s);}});', wp_json_encode( $link ) )
		);
	}

	public function enqueue( string $hook ): void {
		$screen = get_current_screen();
		if ( 'edit.php' === $hook && $screen && 'edit-' . DiagnosticPostType::NAME === $screen->id ) {
			$this->list_button();
			return;
		}
		if ( ! str_ends_with( $hook, '_page_' . self::PAGE ) ) {
			return;
		}
		$asset_file = SMART_DIAGNOSTIC_DIR . 'build/admin.asset.php';
		if ( ! is_readable( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;
		wp_enqueue_script( self::HANDLE, SMART_DIAGNOSTIC_URL . 'build/admin.js', $asset['dependencies'], $asset['version'], true );
		wp_enqueue_style( self::HANDLE, SMART_DIAGNOSTIC_URL . 'build/admin.css', array(), $asset['version'] );
		wp_add_inline_script(
			self::HANDLE,
			'window.sdAdmin = ' . wp_json_encode(
				array(
					'strings' => Strings::defaults(),
					'locale'  => determine_locale(),
				)
			) . ';',
			'before'
		);
	}

	public function use_template(): void {
		check_admin_referer( self::ACTION );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		$id      = isset( $_POST['template'] ) ? sanitize_key( wp_unslash( $_POST['template'] ) ) : '';
		$title   = isset( $_POST[ self::NEW_TITLE ] ) ? sanitize_text_field( wp_unslash( $_POST[ self::NEW_TITLE ] ) ) : '';
		$post_id = $this->library->create( $id, $title );
		if ( is_wp_error( $post_id ) ) {
			wp_die( esc_html( $post_id->get_error_message() ) );
		}
		wp_safe_redirect( (string) get_edit_post_link( $post_id, 'url' ) );
		exit;
	}

	public function render(): void {
		$templates = $this->library->all();

		echo '<div class="wrap sd-templates"><h1>' . esc_html__( 'Create from a template', 'smart-diagnostic' ) . '</h1>';
		echo '<p>' . esc_html__( 'Pick a ready-made diagnostic: a copy is created as a draft, that you can edit freely. The template itself never changes.', 'smart-diagnostic' ) . '</p>';
		if ( ! $templates ) {
			echo '<p>' . esc_html__( 'No template available.', 'smart-diagnostic' ) . '</p></div>';
			return;
		}

		echo '<div class="sd-templates__grid">';
		foreach ( $templates as $template ) {
			$color = sanitize_hex_color( $template['color'] ) ?: '#2271b1'; // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
			printf( '<article class="sd-template-card" data-sd-template="%s">', esc_attr( $template['id'] ) );
			printf( '<div class="sd-template-card__band" style="background:%s"></div>', esc_attr( $color ) );
			printf( '<h2 class="sd-template-card__title">%s</h2>', esc_html( $template['title'] ) );
			printf( '<p class="sd-template-card__description">%s</p>', esc_html( $template['description'] ) );
			printf(
				'<p class="sd-template-card__meta">%s · %s</p>',
				/* translators: %d: number of questions. */
				esc_html( sprintf( _n( '%d question', '%d questions', $template['questions'], 'smart-diagnostic' ), $template['questions'] ) ),
				/* translators: %d: estimated duration in minutes. */
				esc_html( sprintf( _n( 'about %d minute', 'about %d minutes', $template['minutes'], 'smart-diagnostic' ), $template['minutes'] ) )
			);
			printf( '<form method="post" action="%s" class="sd-template-card__actions">', esc_url( admin_url( 'admin-post.php' ) ) );
			wp_nonce_field( self::ACTION );
			printf( '<input type="hidden" name="action" value="%s" />', esc_attr( self::ACTION ) );
			printf( '<input type="hidden" name="template" value="%s" />', esc_attr( $template['id'] ) );
			printf( '<button type="button" class="button" data-sd-template-preview="%s">%s</button> ', esc_attr( $template['id'] ), esc_html__( 'Preview', 'smart-diagnostic' ) );
			printf( '<button type="submit" class="button button-primary">%s</button>', esc_html__( 'Use this template', 'smart-diagnostic' ) );
			echo '</form>';
			// Config du modèle pour l'aperçu (lu par le script d'aperçu).
			printf( '<script type="application/json" id="sd-template-config-%s">%s</script>', esc_attr( $template['id'] ), wp_json_encode( json_decode( $template['json'] ), JSON_HEX_TAG | JSON_HEX_AMP ) );
			echo '</article>';
		}
		echo '</div>';

		printf(
			'<dialog class="sd-template-dialog" aria-labelledby="sd-template-dialog-title"><div class="sd-template-dialog__header"><h2 id="sd-template-dialog-title"></h2><button type="button" class="button" data-sd-template-close>%s</button></div><div class="sd-template-dialog__body"></div></dialog>',
			esc_html__( 'Close', 'smart-diagnostic' )
		);
		echo '</div>';
	}
}
