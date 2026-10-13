<?php
/**
 * Liste des réponses (WP_List_Table).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\Storage\SubmissionRepository;

if ( ! class_exists( \WP_List_Table::class ) ) {
	require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

/**
 * Colonnes : date, diagnostic, contact, profil, CTA, consentement.
 */
final class SubmissionsTable extends \WP_List_Table {

	private const PER_PAGE = 20;

	public function __construct( private SubmissionRepository $submissions = new SubmissionRepository() ) {
		parent::__construct(
			array(
				'singular' => 'submission',
				'plural'   => 'submissions',
				'ajax'     => false,
			)
		);
	}

	/**
	 * Filtres courants, lus dans l'URL.
	 *
	 * @return array{diagnostic_id: int, profile: string, cta: string, from: string, to: string, search: string}
	 */
	public static function current_filters(): array {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- filtres d'affichage.
		$date    = static function ( string $key ): string {
			$value = isset( $_GET[ $key ] ) ? sanitize_text_field( wp_unslash( $_GET[ $key ] ) ) : '';
			return 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
		};
		$filters = array(
			'diagnostic_id' => isset( $_GET['diagnostic'] ) ? absint( $_GET['diagnostic'] ) : 0,
			'profile'       => isset( $_GET['profile'] ) ? sanitize_key( wp_unslash( $_GET['profile'] ) ) : '',
			'cta'           => isset( $_GET['cta'] ) ? sanitize_key( wp_unslash( $_GET['cta'] ) ) : '',
			'from'          => $date( 'from' ),
			'to'            => $date( 'to' ),
			'search'        => isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : '',
		);
		// phpcs:enable
		return $filters;
	}

	/**
	 * @return array<string, string>
	 */
	public function get_columns(): array {
		return array(
			'cb'         => '<input type="checkbox" />',
			'created_at' => __( 'Date', 'smart-diagnostic' ),
			'contact'    => __( 'Contact', 'smart-diagnostic' ),
			'diagnostic' => __( 'Diagnostic', 'smart-diagnostic' ),
			'profile'    => __( 'Profile', 'smart-diagnostic' ),
			'cta'        => __( 'CTA', 'smart-diagnostic' ),
			'consent'    => __( 'Consent', 'smart-diagnostic' ),
		);
	}

	/**
	 * @return array<string, array{0: string, 1: bool}>
	 */
	protected function get_sortable_columns(): array {
		return array(
			'created_at' => array( 'created_at', true ),
			'profile'    => array( 'profile', false ),
			'cta'        => array( 'cta', false ),
		);
	}

	/**
	 * @return array<string, string>
	 */
	protected function get_bulk_actions(): array {
		return array( 'delete' => __( 'Delete', 'smart-diagnostic' ) );
	}

	public function prepare_items(): void {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended
		$result = $this->submissions->query(
			self::current_filters(),
			array(
				'orderby'  => isset( $_GET['orderby'] ) ? sanitize_key( wp_unslash( $_GET['orderby'] ) ) : 'created_at',
				'order'    => isset( $_GET['order'] ) ? sanitize_key( wp_unslash( $_GET['order'] ) ) : 'desc',
				'per_page' => self::PER_PAGE,
				'page'     => $this->get_pagenum(),
			)
		);
		// phpcs:enable
		$this->items           = $result['items'];
		$this->_column_headers = array( $this->get_columns(), array(), $this->get_sortable_columns(), 'created_at' );
		$this->set_pagination_args(
			array(
				'total_items' => $result['total'],
				'per_page'    => self::PER_PAGE,
			)
		);
	}

	/**
	 * @param array<string, mixed> $item Soumission.
	 */
	protected function column_cb( $item ): string {
		return sprintf( '<input type="checkbox" name="submission[]" value="%d" />', (int) $item['id'] );
	}

	/**
	 * @param array<string, mixed> $item Soumission.
	 */
	protected function column_created_at( $item ): string {
		$view   = SubmissionsPage::url( array( 'submission' => (int) $item['id'] ) );
		$delete = wp_nonce_url(
			SubmissionsPage::url(
				array(
					'action'       => 'delete',
					'submission[]' => (int) $item['id'],
				)
			),
			'bulk-submissions'
		);
		$date   = get_date_from_gmt( (string) $item['created_at'], get_option( 'date_format' ) . ' H:i' );
		return sprintf( '<strong><a href="%s">%s</a></strong>', esc_url( $view ), esc_html( $date ) )
			. $this->row_actions(
				array(
					'view'   => sprintf( '<a href="%s">%s</a>', esc_url( $view ), esc_html__( 'View', 'smart-diagnostic' ) ),
					'delete' => sprintf(
						'<a href="%s" class="submitdelete" onclick="return confirm(\'%s\');">%s</a>',
						esc_url( $delete ),
						esc_js( __( 'Delete this submission permanently?', 'smart-diagnostic' ) ),
						esc_html__( 'Delete', 'smart-diagnostic' )
					),
				)
			);
	}

	/**
	 * @param array<string, mixed> $item Soumission.
	 */
	protected function column_contact( $item ): string {
		$name  = (string) $item['first_name'];
		$email = (string) $item['email'];
		if ( '' === $name && '' === $email ) {
			return '<span aria-hidden="true">—</span><span class="screen-reader-text">' . esc_html__( 'Anonymous', 'smart-diagnostic' ) . '</span>';
		}
		return esc_html( $name ) . ( '' !== $email ? '<br><a href="mailto:' . esc_attr( $email ) . '">' . esc_html( $email ) . '</a>' : '' );
	}

	/**
	 * @param array<string, mixed> $item Soumission.
	 */
	protected function column_diagnostic( $item ): string {
		return esc_html( get_the_title( (int) $item['diagnostic_id'] ) ?: '#' . (int) $item['diagnostic_id'] ); // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
	}

	/**
	 * @param array<string, mixed> $item Soumission.
	 */
	protected function column_consent( $item ): string {
		return $item['consent']
			? '<span class="dashicons dashicons-yes" aria-hidden="true"></span><span class="screen-reader-text">' . esc_html__( 'Yes', 'smart-diagnostic' ) . '</span> ' . esc_html( (string) $item['consent_version'] )
			: '<span aria-hidden="true">—</span><span class="screen-reader-text">' . esc_html__( 'No', 'smart-diagnostic' ) . '</span>';
	}

	/**
	 * @param array<string, mixed> $item        Soumission.
	 * @param string               $column_name Colonne.
	 */
	protected function column_default( $item, $column_name ): string {
		return esc_html( (string) ( $item[ $column_name ] ?? '' ) );
	}

	/**
	 * Filtres au-dessus de la liste.
	 *
	 * @param string $which top | bottom.
	 */
	protected function extra_tablenav( $which ): void {
		if ( 'top' !== $which ) {
			return;
		}
		$filters     = self::current_filters();
		$diagnostics = get_posts(
			array(
				'post_type'      => 'sd_diagnostic',
				'post_status'    => 'any',
				'posts_per_page' => 100,
				'orderby'        => 'title',
				'order'          => 'ASC',
			)
		);
		echo '<div class="alignleft actions sd-filters">';
		echo '<label class="screen-reader-text" for="sd-filter-diagnostic">' . esc_html__( 'Diagnostic', 'smart-diagnostic' ) . '</label>';
		echo '<select id="sd-filter-diagnostic" name="diagnostic"><option value="0">' . esc_html__( 'All diagnostics', 'smart-diagnostic' ) . '</option>';
		foreach ( $diagnostics as $post ) {
			printf( '<option value="%d" %s>%s</option>', (int) $post->ID, selected( $filters['diagnostic_id'], $post->ID, false ), esc_html( get_the_title( $post ) ) );
		}
		echo '</select>';

		foreach ( array(
			'profile' => __( 'All profiles', 'smart-diagnostic' ),
			'cta'     => __( 'All CTAs', 'smart-diagnostic' ),
		) as $column => $label ) {
			printf( '<label class="screen-reader-text" for="sd-filter-%1$s">%2$s</label><select id="sd-filter-%1$s" name="%1$s"><option value="">%2$s</option>', esc_attr( $column ), esc_html( $label ) );
			foreach ( $this->submissions->distinct( $column, $filters['diagnostic_id'] ) as $value ) {
				printf( '<option value="%1$s" %2$s>%1$s</option>', esc_attr( $value ), selected( $filters[ $column ], $value, false ) );
			}
			echo '</select>';
		}

		printf(
			'<label for="sd-filter-from">%s</label> <input type="date" id="sd-filter-from" name="from" value="%s" /> <label for="sd-filter-to">%s</label> <input type="date" id="sd-filter-to" name="to" value="%s" />',
			esc_html__( 'From', 'smart-diagnostic' ),
			esc_attr( $filters['from'] ),
			esc_html__( 'to', 'smart-diagnostic' ),
			esc_attr( $filters['to'] )
		);
		submit_button( __( 'Filter', 'smart-diagnostic' ), '', 'filter_action', false );
		echo '</div>';
	}

	public function no_items(): void {
		esc_html_e( 'No submissions yet.', 'smart-diagnostic' );
	}
}
