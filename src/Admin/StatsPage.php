<?php
/**
 * Tableau de bord « Statistiques » : entonnoir, abandons, profils et CTA.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\Analytics\Funnel;
use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Engine\Text;
use SmartDiagnostic\PostType\DiagnosticPostType;
use SmartDiagnostic\Settings;
use SmartDiagnostic\Storage\EventRepository;
use SmartDiagnostic\Storage\Schema;

/**
 * Rendu HTML/CSS simple (barres), sans librairie de graphiques.
 */
final class StatsPage {

	public const PAGE = 'sd-stats';

	public function __construct(
		private EventRepository $events = new EventRepository(),
		private ConfigRepository $configs = new ConfigRepository()
	) {}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
	}

	public function add_page(): void {
		add_submenu_page(
			'edit.php?post_type=' . DiagnosticPostType::NAME,
			__( 'Statistics', 'smart-diagnostic' ),
			__( 'Statistics', 'smart-diagnostic' ),
			SubmissionsPage::capability(),
			self::PAGE,
			array( $this, 'render' )
		);
	}

	public function render(): void {
		if ( ! current_user_can( SubmissionsPage::capability() ) ) {
			return;
		}
		$diagnostics = get_posts(
			array(
				'post_type'      => DiagnosticPostType::NAME,
				'post_status'    => 'any',
				'posts_per_page' => 100,
				'orderby'        => 'title',
				'order'          => 'ASC',
			)
		);
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- filtres d'affichage.
		$id   = isset( $_GET['diagnostic'] ) ? absint( $_GET['diagnostic'] ) : ( $diagnostics[0]->ID ?? 0 );
		$from = isset( $_GET['from'] ) ? sanitize_text_field( wp_unslash( $_GET['from'] ) ) : '';
		$to   = isset( $_GET['to'] ) ? sanitize_text_field( wp_unslash( $_GET['to'] ) ) : '';
		// phpcs:enable
		$from = 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $from ) ? $from : gmdate( 'Y-m-d', time() - 29 * DAY_IN_SECONDS );
		$to   = 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $to ) ? $to : gmdate( 'Y-m-d' );

		echo '<div class="wrap sd-stats"><h1>' . esc_html__( 'Statistics', 'smart-diagnostic' ) . '</h1>';
		if ( ! Settings::get( 'analytics' ) ) {
			echo '<div class="notice notice-warning"><p>' . esc_html__( 'Statistics are disabled in the settings.', 'smart-diagnostic' ) . '</p></div>';
		}
		$this->filters( $diagnostics, $id, $from, $to );

		if ( 0 === $id ) {
			echo '<p>' . esc_html__( 'No diagnostic yet.', 'smart-diagnostic' ) . '</p></div>';
			return;
		}

		$config = $this->configs->get_array( $id ) ?? array();
		$steps  = array_values( array_filter( $config['steps'] ?? array(), static fn( array $step ): bool => 'after_results' !== ( $step['placement'] ?? '' ) ) );
		$funnel = Funnel::build( array_column( $steps, 'key' ), $this->events->sessions( $id, $from, $to ) );
		$labels = array();
		foreach ( $steps as $step ) {
			$label                  = Text::resolve( $step['label'] ?? $step['title'] ?? '', '', (string) ( $config['i18n']['defaultLanguage'] ?? '' ) );
			$labels[ $step['key'] ] = '' !== $label ? wp_strip_all_tags( $label ) : $step['key'];
		}

		$this->kpis( $funnel );
		$this->funnel( $funnel, $labels );
		$this->abandons( $funnel, $labels );
		$this->distribution( __( 'Profiles', 'smart-diagnostic' ), 'profile', $id, $from, $to, $config['outcomes']['profiles'] ?? array() );
		$this->distribution( __( 'Recommended CTAs', 'smart-diagnostic' ), 'cta', $id, $from, $to, $config['outcomes']['ctas'] ?? array() );
		echo '</div>';
		$this->styles();
	}

	/**
	 * @param list<\WP_Post> $diagnostics Diagnostics.
	 */
	private function filters( array $diagnostics, int $id, string $from, string $to ): void {
		echo '<form method="get" class="sd-stats__filters">';
		printf( '<input type="hidden" name="post_type" value="%s" /><input type="hidden" name="page" value="%s" />', esc_attr( DiagnosticPostType::NAME ), esc_attr( self::PAGE ) );
		echo '<label for="sd-stats-diagnostic">' . esc_html__( 'Diagnostic', 'smart-diagnostic' ) . '</label> <select id="sd-stats-diagnostic" name="diagnostic">';
		foreach ( $diagnostics as $post ) {
			printf( '<option value="%d" %s>%s</option>', (int) $post->ID, selected( $id, $post->ID, false ), esc_html( get_the_title( $post ) ) );
		}
		echo '</select> ';
		printf(
			'<label for="sd-stats-from">%s</label> <input type="date" id="sd-stats-from" name="from" value="%s" /> <label for="sd-stats-to">%s</label> <input type="date" id="sd-stats-to" name="to" value="%s" /> ',
			esc_html__( 'From', 'smart-diagnostic' ),
			esc_attr( $from ),
			esc_html__( 'to', 'smart-diagnostic' ),
			esc_attr( $to )
		);
		submit_button( __( 'Show', 'smart-diagnostic' ), 'secondary', '', false );
		echo '</form>';
	}

	/**
	 * @param array<string, mixed> $funnel Entonnoir.
	 */
	private function kpis( array $funnel ): void {
		$kpis = array(
			'started'    => array( __( 'Started', 'smart-diagnostic' ), number_format_i18n( $funnel['started'] ) ),
			'submitted'  => array( __( 'Completed', 'smart-diagnostic' ), number_format_i18n( $funnel['submitted'] ) ),
			'completion' => array( __( 'Completion rate', 'smart-diagnostic' ), number_format_i18n( $funnel['completion_rate'] * 100, 1 ) . ' %' ),
			'captured'   => array( __( 'Leads captured', 'smart-diagnostic' ), number_format_i18n( $funnel['captured'] ) ),
		);
		echo '<div class="sd-stats__kpis">';
		foreach ( $kpis as $key => [ $label, $value ] ) {
			printf( '<div class="sd-stats__kpi" data-kpi="%s"><span>%s</span><strong>%s</strong></div>', esc_attr( $key ), esc_html( $label ), esc_html( $value ) );
		}
		echo '</div>';
	}

	/**
	 * @param array<string, mixed>  $funnel Entonnoir.
	 * @param array<string, string> $labels Libellés des étapes.
	 */
	private function funnel( array $funnel, array $labels ): void {
		echo '<h2>' . esc_html__( 'Funnel', 'smart-diagnostic' ) . '</h2><table class="widefat striped sd-stats__funnel"><thead><tr><th>' . esc_html__( 'Step', 'smart-diagnostic' ) . '</th><th>' . esc_html__( 'Visitors', 'smart-diagnostic' ) . '</th><th style="width:45%">%</th></tr></thead><tbody>';
		foreach ( $funnel['steps'] as $step ) {
			$this->bar_row( $labels[ $step['key'] ] ?? $step['key'], $step['key'], $step['reached'], $step['rate'] );
		}
		$this->bar_row( __( 'Results', 'smart-diagnostic' ), 'results', $funnel['submitted'], $funnel['completion_rate'] );
		echo '</tbody></table>';
	}

	/**
	 * @param array<string, mixed>  $funnel Entonnoir.
	 * @param array<string, string> $labels Libellés.
	 */
	private function abandons( array $funnel, array $labels ): void {
		echo '<h2>' . esc_html__( 'Drop-offs (last step seen)', 'smart-diagnostic' ) . '</h2>';
		if ( array() === $funnel['abandons'] ) {
			echo '<p>—</p>';
			return;
		}
		echo '<table class="widefat striped" style="max-width:700px"><tbody>';
		foreach ( $funnel['abandons'] as $key => $count ) {
			$label = '' === $key ? __( 'Welcome screen', 'smart-diagnostic' ) : ( $labels[ $key ] ?? $key );
			printf( '<tr><th scope="row">%s</th><td>%s</td></tr>', esc_html( $label ), esc_html( number_format_i18n( $count ) ) );
		}
		echo '</tbody></table>';
	}

	/**
	 * Répartition des profils / CTA parmi les soumissions.
	 *
	 * @param string                     $title  Titre.
	 * @param string                     $column profile | cta.
	 * @param int                        $id     Diagnostic.
	 * @param string                     $from   Début (AAAA-MM-JJ).
	 * @param string                     $to     Fin (AAAA-MM-JJ).
	 * @param list<array<string, mixed>> $items  Profils ou CTA de la config.
	 */
	private function distribution( string $title, string $column, int $id, string $from, string $to, array $items ): void {
		global $wpdb;
		$table  = Schema::submissions_table();
		$rows   = $wpdb->get_results( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$wpdb->prepare(
				"SELECT {$column} AS k, COUNT(*) AS n FROM {$table} WHERE diagnostic_id = %d AND created_at BETWEEN %s AND %s GROUP BY {$column} ORDER BY n DESC", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$id,
				$from . ' 00:00:00',
				$to . ' 23:59:59'
			),
			ARRAY_A
		);
		$total  = array_sum( array_map( 'intval', array_column( (array) $rows, 'n' ) ) );
		$labels = array();
		foreach ( $items as $item ) {
			$labels[ $item['key'] ] = wp_strip_all_tags( Text::resolve( $item['label'] ?? $item['key'] ) );
		}
		echo '<h2>' . esc_html( $title ) . '</h2>';
		if ( 0 === $total ) {
			echo '<p>—</p>';
			return;
		}
		echo '<table class="widefat striped sd-stats__funnel"><tbody>';
		foreach ( (array) $rows as $row ) {
			$key = (string) $row['k'];
			$this->bar_row( '' === $key ? '—' : ( $labels[ $key ] ?? $key ), $key, (int) $row['n'], (int) $row['n'] / $total );
		}
		echo '</tbody></table>';
	}

	private function bar_row( string $label, string $key, int $count, float $rate ): void {
		printf(
			'<tr data-key="%1$s"><th scope="row">%2$s</th><td>%3$s</td><td><div class="sd-stats__bar"><span style="width:%4$s%%"></span></div> %5$s %%</td></tr>',
			esc_attr( $key ),
			esc_html( $label ),
			esc_html( number_format_i18n( $count ) ),
			esc_attr( (string) round( $rate * 100, 1 ) ),
			esc_html( number_format_i18n( $rate * 100, 1 ) )
		);
	}

	private function styles(): void {
		echo '<style>
			.sd-stats__filters{margin:12px 0 20px}
			.sd-stats__kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;max-width:900px;margin-bottom:24px}
			.sd-stats__kpi{background:#fff;border:1px solid #c3c4c7;border-radius:6px;padding:14px 16px}
			.sd-stats__kpi span{display:block;color:#646970}
			.sd-stats__kpi strong{font-size:26px;line-height:1.4}
			.sd-stats__funnel{max-width:900px}
			.sd-stats__bar{display:inline-block;vertical-align:middle;width:70%;height:10px;background:#f0f0f1;border-radius:5px;overflow:hidden}
			.sd-stats__bar span{display:block;height:100%;background:#2271b1}
		</style>';
	}
}
