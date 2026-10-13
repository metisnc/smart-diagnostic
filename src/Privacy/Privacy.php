<?php
/**
 * RGPD : durée de conservation (purge quotidienne), export et effacement des
 * données personnelles via les outils WordPress, texte pour la politique de confidentialité.
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Privacy;

use SmartDiagnostic\Branding;
use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Engine\Text;
use SmartDiagnostic\Settings;
use SmartDiagnostic\Storage\SubmissionRepository;

/**
 * Les données d'une personne sont retrouvées par son adresse email.
 */
final class Privacy {

	public const PURGE_HOOK = 'sd_purge_submissions';
	private const PAGE_SIZE = 50;

	public function __construct(
		private SubmissionRepository $submissions = new SubmissionRepository(),
		private ConfigRepository $configs = new ConfigRepository()
	) {}

	public function register(): void {
		add_action( self::PURGE_HOOK, array( $this, 'purge' ) );
		add_action( 'init', array( self::class, 'schedule' ) );
		add_filter( 'wp_privacy_personal_data_exporters', array( $this, 'register_exporter' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( $this, 'register_eraser' ) );
		add_action( 'admin_init', array( $this, 'policy_content' ) );
	}

	public static function schedule(): void {
		if ( ! wp_next_scheduled( self::PURGE_HOOK ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::PURGE_HOOK );
		}
	}

	public static function unschedule(): void {
		wp_clear_scheduled_hook( self::PURGE_HOOK );
	}

	/**
	 * Supprime les soumissions plus anciennes que la durée de conservation.
	 *
	 * @return int Nombre supprimé.
	 */
	public function purge(): int {
		$days = (int) Settings::get( 'retention_days' );
		if ( $days <= 0 ) {
			return 0;
		}
		return $this->submissions->delete_before( gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS ) );
	}

	/**
	 * @param array<string, mixed> $exporters Exporteurs.
	 * @return array<string, mixed>
	 */
	public function register_exporter( array $exporters ): array {
		$exporters['smart-diagnostic'] = array(
			'exporter_friendly_name' => Branding::name(),
			'callback'               => array( $this, 'export' ),
		);
		return $exporters;
	}

	/**
	 * @param array<string, mixed> $erasers Effaceurs.
	 * @return array<string, mixed>
	 */
	public function register_eraser( array $erasers ): array {
		$erasers['smart-diagnostic'] = array(
			'eraser_friendly_name' => Branding::name(),
			'callback'             => array( $this, 'erase' ),
		);
		return $erasers;
	}

	/**
	 * @return array{data: list<array<string, mixed>>, done: bool}
	 */
	public function export( string $email, int $page = 1 ): array {
		$result = $this->submissions->query(
			array( 'email' => $email ),
			array(
				'per_page' => self::PAGE_SIZE,
				'page'     => $page,
			)
		);
		$data   = array();
		foreach ( $result['items'] as $row ) {
			$config = $this->configs->get_array( (int) $row['diagnostic_id'] ) ?? array();
			$items  = array(
				array(
					'name'  => __( 'Diagnostic', 'smart-diagnostic' ),
					'value' => get_the_title( (int) $row['diagnostic_id'] ),
				),
				array(
					'name'  => __( 'Date', 'smart-diagnostic' ),
					'value' => $row['created_at'],
				),
				array(
					'name'  => __( 'Consent', 'smart-diagnostic' ),
					'value' => $row['consent'] ? sprintf( '%s (%s)', (string) $row['consent_at'], (string) $row['consent_version'] ) : __( 'No', 'smart-diagnostic' ),
				),
				array(
					'name'  => __( 'Profile', 'smart-diagnostic' ),
					'value' => $row['profile'],
				),
			);
			foreach ( (array) $row['contact'] as $key => $value ) {
				$items[] = array(
					'name'  => (string) $key,
					'value' => is_scalar( $value ) ? (string) $value : (string) wp_json_encode( $value ),
				);
			}
			foreach ( (array) $row['answers'] as $key => $value ) {
				$items[] = array(
					'name'  => (string) $key,
					'value' => Text::display_answer( $config, (string) $key, $value ),
				);
			}
			$data[] = array(
				'group_id'    => 'smart-diagnostic',
				'group_label' => Branding::name(),
				'item_id'     => 'submission-' . $row['id'],
				'data'        => $items,
			);
		}
		return array(
			'data' => $data,
			'done' => $page * self::PAGE_SIZE >= $result['total'],
		);
	}

	/**
	 * Les soumissions sont supprimées (et non anonymisées) : elles n'ont pas d'intérêt sans la personne.
	 *
	 * @return array{items_removed: bool, items_retained: bool, messages: list<string>, done: bool}
	 */
	public function erase( string $email, int $page = 1 ): array {
		unset( $page ); // Toujours la première page : les lignes supprimées disparaissent.
		$result  = $this->submissions->query(
			array( 'email' => $email ),
			array( 'per_page' => self::PAGE_SIZE )
		);
		$ids     = array_map( static fn( array $row ): int => (int) $row['id'], $result['items'] );
		$deleted = $this->submissions->delete( $ids );
		return array(
			'items_removed'  => $deleted > 0,
			'items_retained' => false,
			'messages'       => array(),
			'done'           => $result['total'] <= self::PAGE_SIZE,
		);
	}

	public function policy_content(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		$days  = (int) Settings::get( 'retention_days' );
		$text  = '<p>' . esc_html__( 'When you take one of our questionnaires, we store your answers, your results and, if you provide them, your contact details, together with the date and version of the consent you gave. Your IP address is never stored in clear text: only a non-reversible fingerprint is kept, to prevent abuse.', 'smart-diagnostic' ) . '</p>';
		$text .= '<p>' . ( $days > 0
			/* translators: %d: number of days. */
			? esc_html( sprintf( __( 'These data are automatically deleted after %d days.', 'smart-diagnostic' ), $days ) )
			: esc_html__( 'These data are kept until you ask us to delete them.', 'smart-diagnostic' ) ) . '</p>';
		wp_add_privacy_policy_content( Branding::name(), wp_kses_post( $text ) );
	}
}
