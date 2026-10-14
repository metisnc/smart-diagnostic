<?php
/**
 * Admin « Réponses » : liste filtrable, détail, suppression, export CSV.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Admin;

use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Engine\Text;
use SmartDiagnostic\Integrations\Mailer;
use SmartDiagnostic\PostType\DiagnosticPostType;
use SmartDiagnostic\Rest\SubmitController;
use SmartDiagnostic\Storage\SubmissionRepository;

/**
 * Accès réservé à la capacité renvoyée par capability() (filtre sd_submissions_capability).
 */
final class SubmissionsPage {

	public const PAGE           = 'sd-submissions';
	private const EXPORT_ACTION = 'sd_export_csv';

	public function __construct(
		private SubmissionRepository $submissions = new SubmissionRepository(),
		private ConfigRepository $configs = new ConfigRepository()
	) {}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_post_' . self::EXPORT_ACTION, array( $this, 'export_csv' ) );
	}

	public static function capability(): string {
		/**
		 * Capacité requise pour voir, exporter et supprimer les réponses.
		 *
		 * @param string $capability Capacité.
		 */
		return (string) apply_filters( 'sd_submissions_capability', 'manage_options' );
	}

	/**
	 * @param array<string, mixed> $args Paramètres d'URL.
	 */
	public static function url( array $args = array() ): string {
		return add_query_arg(
			array_merge(
				array(
					'post_type' => DiagnosticPostType::NAME,
					'page'      => self::PAGE,
				),
				$args
			),
			admin_url( 'edit.php' )
		);
	}

	public function add_page(): void {
		$hook = add_submenu_page(
			'edit.php?post_type=' . DiagnosticPostType::NAME,
			__( 'Submissions', 'smart-diagnostic' ),
			__( 'Submissions', 'smart-diagnostic' ),
			self::capability(),
			self::PAGE,
			array( $this, 'render' )
		);
		if ( $hook ) {
			add_action( 'load-' . $hook, array( $this, 'handle_actions' ) );
		}
	}

	/**
	 * Suppression (unitaire ou groupée), avant tout affichage.
	 */
	public function handle_actions(): void {
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- nonce vérifié ci-dessous.
		$action = isset( $_REQUEST['action'] ) ? sanitize_key( wp_unslash( $_REQUEST['action'] ) ) : '';
		if ( '-1' === $action || '' === $action ) {
			$action = isset( $_REQUEST['action2'] ) ? sanitize_key( wp_unslash( $_REQUEST['action2'] ) ) : '';
		}
		if ( 'delete' !== $action || empty( $_REQUEST['submission'] ) ) {
			return;
		}
		check_admin_referer( 'bulk-submissions' );
		if ( ! current_user_can( self::capability() ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		$ids = array_map( 'absint', (array) wp_unslash( $_REQUEST['submission'] ) );
		// phpcs:enable
		$deleted = $this->submissions->delete( $ids );
		wp_safe_redirect( self::url( array( 'deleted' => $deleted ) ) );
		exit;
	}

	public function render(): void {
		if ( ! current_user_can( self::capability() ) ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$id = isset( $_GET['submission'] ) && ! is_array( $_GET['submission'] ) ? absint( $_GET['submission'] ) : 0;
		if ( $id > 0 ) {
			$this->render_detail( $id );
			return;
		}

		$table = new SubmissionsTable( $this->submissions );
		$table->prepare_items();
		$export = wp_nonce_url(
			add_query_arg(
				// Valeurs encodées : un « + » dans un email ne doit pas devenir une espace.
				array_merge( array( 'action' => self::EXPORT_ACTION ), array_map( 'rawurlencode', array_map( 'strval', array_filter( $this->filter_args() ) ) ) ),
				admin_url( 'admin-post.php' )
			),
			self::EXPORT_ACTION
		);

		echo '<div class="wrap"><h1 class="wp-heading-inline">' . esc_html__( 'Submissions', 'smart-diagnostic' ) . '</h1>';
		printf( ' <a href="%s" class="page-title-action">%s</a><hr class="wp-header-end">', esc_url( $export ), esc_html__( 'Export CSV', 'smart-diagnostic' ) );
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['deleted'] ) ) {
			/* translators: %d: number of deleted submissions. */
			printf( '<div class="notice notice-success is-dismissible"><p>%s</p></div>', esc_html( sprintf( _n( '%d submission deleted.', '%d submissions deleted.', absint( $_GET['deleted'] ), 'smart-diagnostic' ), absint( $_GET['deleted'] ) ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}
		echo '<form method="get">';
		printf( '<input type="hidden" name="post_type" value="%s" /><input type="hidden" name="page" value="%s" />', esc_attr( DiagnosticPostType::NAME ), esc_attr( self::PAGE ) );
		$table->search_box( __( 'Search name or email', 'smart-diagnostic' ), 'sd-search' );
		$table->display();
		echo '</form></div>';
	}

	/**
	 * Filtres courants, au format des paramètres d'URL.
	 *
	 * @return array<string, int|string>
	 */
	private function filter_args(): array {
		$filters = SubmissionsTable::current_filters();
		return array(
			'diagnostic' => $filters['diagnostic_id'],
			'profile'    => $filters['profile'],
			'cta'        => $filters['cta'],
			'from'       => $filters['from'],
			'to'         => $filters['to'],
			's'          => $filters['search'],
		);
	}

	private function render_detail( int $id ): void {
		$row = $this->submissions->find( $id );
		echo '<div class="wrap sd-submission">';
		printf( '<p><a href="%s">← %s</a></p>', esc_url( self::url() ), esc_html__( 'All submissions', 'smart-diagnostic' ) );
		if ( null === $row ) {
			echo '<p>' . esc_html__( 'Submission not found.', 'smart-diagnostic' ) . '</p></div>';
			return;
		}
		$config = $this->configs->get_array( (int) $row['diagnostic_id'] ) ?? array();
		$data   = Mailer::template_data( $row, $config );

		printf(
			'<h1>%s</h1><p>%s · <a href="%s" target="_blank" rel="noopener">%s</a></p>',
			esc_html( get_the_title( (int) $row['diagnostic_id'] ) ),
			esc_html( get_date_from_gmt( (string) $row['created_at'], get_option( 'date_format' ) . ' H:i' ) ),
			esc_url( SubmitController::result_url( $row ) ),
			esc_html__( 'Result page', 'smart-diagnostic' )
		);

		$this->section( __( 'Contact', 'smart-diagnostic' ), (array) $row['contact'] );
		$this->section(
			__( 'Consent', 'smart-diagnostic' ),
			array(
				__( 'Given', 'smart-diagnostic' )   => $row['consent'] ? __( 'Yes', 'smart-diagnostic' ) : __( 'No', 'smart-diagnostic' ),
				__( 'Date', 'smart-diagnostic' )    => $row['consent_at'] ? get_date_from_gmt( (string) $row['consent_at'], get_option( 'date_format' ) . ' H:i:s' ) : '—',
				__( 'Version', 'smart-diagnostic' ) => $row['consent_version'] ?: '—', // phpcs:ignore Universal.Operators.DisallowShortTernary.Found
			)
		);

		$result = array( __( 'Profile', 'smart-diagnostic' ) => $data['profile']['label'] ?? '—' );
		foreach ( $data['scores'] as $score ) {
			$result[ $score['label'] ] = $score['value'] . ' / ' . $score['max'];
		}
		foreach ( (array) $row['vars'] as $key => $value ) {
			$result[ 'var.' . $key ] = is_scalar( $value ) ? (string) $value : wp_json_encode( $value );
		}
		$result[ __( 'CTA', 'smart-diagnostic' ) ] = $data['cta']['label'] ?? '—';
		$this->section( __( 'Result', 'smart-diagnostic' ), $result );

		$answers = array();
		foreach ( $data['answers'] as $answer ) {
			$answers[ $answer['label'] ] = $answer['value'];
		}
		$this->section( __( 'Answers', 'smart-diagnostic' ), $answers );

		$meta         = array(
			__( 'Language', 'smart-diagnostic' )    => $row['lang'],
			__( 'Source page', 'smart-diagnostic' ) => $row['source_url'],
		);
		$email_labels = array(
			'user'  => __( 'Email to the visitor', 'smart-diagnostic' ),
			'admin' => __( 'Email to the team', 'smart-diagnostic' ),
		);
		foreach ( $email_labels as $kind => $label ) {
			$meta[ $label ] = $this->email_status( (array) ( $row['emails'][ $kind ] ?? array() ) );
		}
		foreach ( (array) $row['utm'] as $key => $value ) {
			$meta[ 'utm_' . $key ] = $value;
		}
		foreach ( (array) ( $row['webhooks'] ?? array() ) as $key => $state ) {
			/* translators: %s: webhook key. */
			$meta[ sprintf( __( 'Webhook %s', 'smart-diagnostic' ), $key ) ] = sprintf( '%s (HTTP %d, %d)', $state['status'] ?? '', (int) ( $state['code'] ?? 0 ), (int) ( $state['attempts'] ?? 0 ) );
		}
		$this->section( __( 'Details', 'smart-diagnostic' ), $meta );

		$delete = wp_nonce_url(
			self::url(
				array(
					'action'       => 'delete',
					'submission[]' => $id,
				)
			),
			'bulk-submissions'
		);
		printf(
			'<p><a href="%s" class="button button-link-delete" onclick="return confirm(\'%s\');">%s</a></p></div>',
			esc_url( $delete ),
			esc_js( __( 'Delete this submission permanently?', 'smart-diagnostic' ) ),
			esc_html__( 'Delete', 'smart-diagnostic' )
		);
	}

	/**
	 * Statut lisible d'un envoi d'email.
	 *
	 * @param array<string, mixed> $state Statut enregistré par Mailer.
	 */
	private function email_status( array $state ): string {
		if ( array() === $state ) {
			return __( 'Not sent', 'smart-diagnostic' );
		}
		$date = get_date_from_gmt( (string) $state['at'], get_option( 'date_format' ) . ' H:i' );
		$via  = 'smtp' === ( $state['via'] ?? '' ) ? __( 'dedicated SMTP', 'smart-diagnostic' ) : __( 'WordPress / SMTP plugin', 'smart-diagnostic' );
		if ( 'sent' === ( $state['status'] ?? '' ) ) {
			/* translators: 1: recipient, 2: date, 3: sending method. */
			return sprintf( __( 'Sent to %1$s on %2$s (%3$s)', 'smart-diagnostic' ), $state['to'] ?? '', $date, $via );
		}
		/* translators: 1: recipient, 2: date, 3: error message. */
		return sprintf( __( 'Failed for %1$s on %2$s: %3$s', 'smart-diagnostic' ), $state['to'] ?? '', $date, $state['error'] ?? '' );
	}

	/**
	 * @param string               $title Titre.
	 * @param array<string, mixed> $rows  Libellé → valeur.
	 */
	private function section( string $title, array $rows ): void {
		echo '<h2>' . esc_html( $title ) . '</h2><table class="widefat striped" style="max-width:900px"><tbody>';
		if ( array() === $rows ) {
			echo '<tr><td>—</td></tr>';
		}
		foreach ( $rows as $label => $value ) {
			if ( is_bool( $value ) ) {
				$value = $value ? __( 'Yes', 'smart-diagnostic' ) : __( 'No', 'smart-diagnostic' );
			}
			printf( '<tr><th scope="row" style="width:35%%">%s</th><td>%s</td></tr>', esc_html( (string) $label ), esc_html( is_scalar( $value ) ? (string) $value : (string) wp_json_encode( $value ) ) );
		}
		echo '</tbody></table>';
	}

	/**
	 * Export CSV des réponses filtrées (séparateur « ; », UTF-8 avec BOM pour Excel).
	 */
	public function export_csv(): void {
		check_admin_referer( self::EXPORT_ACTION );
		if ( ! current_user_can( self::capability() ) ) {
			wp_die( esc_html__( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		$rows = $this->submissions->query( SubmissionsTable::current_filters(), array( 'per_page' => 0, 'order' => 'asc' ) )['items']; // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="submissions-' . gmdate( 'Y-m-d' ) . '.csv"' );

		$out = fopen( 'php://output', 'w' );
		if ( false === $out ) {
			exit;
		}
		fwrite( $out, "\xEF\xBB\xBF" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
		foreach ( self::csv_rows( $rows, $this->configs ) as $line ) {
			fputcsv( $out, array_map( array( self::class, 'csv_cell' ), $line ), ';' );
		}
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		exit;
	}

	/**
	 * En-tête + une ligne par soumission ; les colonnes dynamiques (scores, variables,
	 * réponses, contact, UTM) sont l'union de toutes les soumissions exportées.
	 *
	 * @param list<array<string, mixed>> $rows    Soumissions.
	 * @param ConfigRepository           $configs Configs (libellés des réponses).
	 * @return list<list<mixed>>
	 */
	public static function csv_rows( array $rows, ConfigRepository $configs ): array {
		$fixed   = array( 'id', 'created_at', 'diagnostic_id', 'first_name', 'email', 'profile', 'cta', 'consent', 'consent_at', 'consent_version', 'lang', 'source_url' );
		$dynamic = array(
			'contact' => array(),
			'scores'  => array(),
			'vars'    => array(),
			'answers' => array(),
			'utm'     => array(),
		);
		foreach ( $rows as $row ) {
			foreach ( array_keys( $dynamic ) as $column ) {
				foreach ( array_keys( (array) ( $row[ $column ] ?? array() ) ) as $key ) {
					$dynamic[ $column ][ $key ] = true;
				}
			}
		}
		$prefix = array(
			'contact' => 'contact.',
			'scores'  => 'score.',
			'vars'    => 'var.',
			'answers' => 'answer.',
			'utm'     => 'utm_',
		);

		$header = $fixed;
		foreach ( $dynamic as $column => $keys ) {
			foreach ( array_keys( $keys ) as $key ) {
				$header[] = $prefix[ $column ] . $key;
			}
		}

		$cache = array();
		$lines = array( $header );
		foreach ( $rows as $row ) {
			$diagnostic_id = (int) $row['diagnostic_id'];
			if ( ! array_key_exists( $diagnostic_id, $cache ) ) {
				$cache[ $diagnostic_id ] = $configs->get_array( $diagnostic_id ) ?? array();
			}
			$line = array();
			foreach ( $fixed as $column ) {
				$line[] = is_bool( $row[ $column ] ?? null ) ? (int) $row[ $column ] : ( $row[ $column ] ?? '' );
			}
			foreach ( $dynamic as $column => $keys ) {
				foreach ( array_keys( $keys ) as $key ) {
					$value  = $row[ $column ][ $key ] ?? '';
					$line[] = 'answers' === $column ? Text::display_answer( $cache[ $diagnostic_id ], (string) $key, $value ) : $value;
				}
			}
			$lines[] = $line;
		}
		return $lines;
	}

	/**
	 * Cellule CSV sûre : tableaux en JSON, formules neutralisées (=, +, -, @).
	 */
	public static function csv_cell( mixed $value ): string {
		if ( is_array( $value ) ) {
			$value = (string) wp_json_encode( $value, JSON_UNESCAPED_UNICODE );
		}
		$value = is_bool( $value ) ? ( $value ? '1' : '0' ) : (string) $value;
		if ( '' !== $value && in_array( $value[0], array( '=', '+', '-', '@', "\t", "\r" ), true ) && ! is_numeric( $value ) ) {
			$value = "'" . $value;
		}
		return $value;
	}
}
