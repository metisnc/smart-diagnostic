<?php
/**
 * Connecteur MCP : fonctions du plugin exposées via l'Abilities API de WordPress (6.9+).
 *
 * @package SmartDiagnostic
 */

declare(strict_types=1);

namespace SmartDiagnostic\Mcp;

use SmartDiagnostic\Admin\SubmissionsPage;
use SmartDiagnostic\Analytics\Funnel;
use SmartDiagnostic\Config\ConfigRepository;
use SmartDiagnostic\Config\SchemaValidator;
use SmartDiagnostic\Engine\Calculator;
use SmartDiagnostic\Engine\Text;
use SmartDiagnostic\PostType\DiagnosticPostType;
use SmartDiagnostic\Settings;
use SmartDiagnostic\Storage\EventRepository;
use SmartDiagnostic\Storage\SubmissionRepository;
use SmartDiagnostic\Templates\Library;
use WP_Error;

/**
 * Sécurité :
 * - rien n'est enregistré tant que le connecteur n'est pas activé dans les réglages ;
 * - lecture seule par défaut : les actions de création / modification n'existent qu'en mode écriture ;
 * - chaque action vérifie les droits de l'utilisateur (mot de passe d'application) ;
 * - aucune suppression possible ; chaque action est journalisée (ActionLog).
 */
final class Abilities {

	public const CATEGORY = 'smart-diagnostic';
	public const PREFIX   = 'smart-diagnostic/';

	/** Nombre maximal de réponses renvoyées par un export. */
	private const EXPORT_MAX = 5000;

	public function __construct(
		private ConfigRepository $configs = new ConfigRepository(),
		private SubmissionRepository $submissions = new SubmissionRepository(),
		private EventRepository $events = new EventRepository(),
		private Library $library = new Library()
	) {}

	public function register(): void {
		if ( ! self::available() || ! Settings::get( 'mcp_enabled' ) ) {
			return;
		}
		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}

	/**
	 * Abilities API présente (WordPress 6.9+).
	 */
	public static function available(): bool {
		return function_exists( 'wp_register_ability' ) && function_exists( 'wp_register_ability_category' );
	}

	public function register_category(): void {
		wp_register_ability_category(
			self::CATEGORY,
			array(
				'label'       => __( 'Smart Diagnostic', 'smart-diagnostic' ),
				'description' => __( 'Diagnostics, templates, submissions and statistics.', 'smart-diagnostic' ),
			)
		);
	}

	public function register_abilities(): void {
		foreach ( $this->definitions() as $name => $definition ) {
			if ( $definition['write'] && ! Settings::get( 'mcp_write' ) ) {
				continue;
			}
			wp_register_ability(
				self::PREFIX . $name,
				array(
					'label'               => $definition['label'],
					'description'         => $definition['description'],
					'category'            => self::CATEGORY,
					'input_schema'        => $definition['input'],
					'execute_callback'    => fn( mixed $input = null ) => $this->run( $name, is_array( $input ) ? $input : array() ),
					'permission_callback' => fn( mixed $input = null ): bool => $this->can( $name, is_array( $input ) ? $input : array() ),
					'meta'                => array(
						'show_in_rest' => true,
						'annotations'  => array(
							'readonly'    => ! $definition['write'],
							'destructive' => false,
							'idempotent'  => ! $definition['write'],
						),
						'mcp'          => array(
							'public' => true,
							'type'   => 'tool',
						),
					),
				)
			);
		}
	}

	/**
	 * Noms complets des abilities actives (selon le mode lecture / écriture).
	 *
	 * @return list<string>
	 */
	public function names(): array {
		$names = array();
		foreach ( $this->definitions() as $name => $definition ) {
			if ( ! $definition['write'] || Settings::get( 'mcp_write' ) ) {
				$names[] = self::PREFIX . $name;
			}
		}
		return $names;
	}

	/**
	 * Droit d'exécuter une action : connecteur actif, mode écriture si besoin, capacité WordPress.
	 *
	 * @param string               $name  Action (sans préfixe).
	 * @param array<string, mixed> $input Paramètres.
	 */
	public function can( string $name, array $input ): bool {
		$definition = $this->definitions()[ $name ] ?? null;
		if ( null === $definition || ! Settings::get( 'mcp_enabled' ) || ( $definition['write'] && ! Settings::get( 'mcp_write' ) ) ) {
			return false;
		}
		$id = isset( $input['id'] ) ? $this->configs->find_id( (string) $input['id'] ) : null;
		switch ( $definition['access'] ) {
			case 'submissions':
				return current_user_can( SubmissionsPage::capability() );
			case 'diagnostic':
				return null === $id ? current_user_can( 'edit_posts' ) : current_user_can( 'edit_post', $id );
			default:
				return current_user_can( 'edit_posts' );
		}
	}

	/**
	 * Exécute une action et la journalise.
	 *
	 * @param string               $name  Action (sans préfixe).
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	public function run( string $name, array $input ): array|WP_Error {
		$method = 'do_' . str_replace( '-', '_', $name );
		$result = method_exists( $this, $method ) ? $this->{$method}( $input ) : new WP_Error( 'sd_unknown_ability', __( 'Unknown action.', 'smart-diagnostic' ) );
		ActionLog::record(
			self::PREFIX . $name,
			$input,
			! is_wp_error( $result ),
			is_wp_error( $result ) ? $result->get_error_message() : (string) ( $result['message'] ?? 'ok' )
		);
		return $result;
	}

	/**
	 * Description des actions : libellé, aide pour l'IA, schéma des paramètres, écriture, droits.
	 *
	 * @return array<string, array{label: string, description: string, input: array<string, mixed>, write: bool, access: string}>
	 */
	public function definitions(): array {
		$id       = array(
			'type'        => array( 'integer', 'string' ),
			'description' => __( 'ID or slug of the diagnostic.', 'smart-diagnostic' ),
		);
		$date     = array(
			'type'    => 'string',
			'pattern' => '^\d{4}-\d{2}-\d{2}$',
		);
		$status   = array(
			'type'    => 'string',
			'enum'    => array( 'draft', 'publish' ),
			'default' => 'draft',
		);
		$config   = array(
			'type'        => array( 'object', 'string' ),
			'description' => __( 'Complete diagnostic configuration (JSON object or JSON text), validated against the plugin JSON Schema. Start from get-diagnostic or a template to see the format.', 'smart-diagnostic' ),
		);
		$no_input = array(
			'type'                 => 'object',
			'properties'           => new \stdClass(),
			'additionalProperties' => false,
		);

		return array(
			'list-diagnostics'     => array(
				'label'       => __( 'List the diagnostics', 'smart-diagnostic' ),
				'description' => __( 'Lists the diagnostics (questionnaires) of the site with their ID, title, status and number of questions.', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'search' => array( 'type' => 'string' ),
					),
				),
				'write'       => false,
				'access'      => 'edit',
			),
			'get-diagnostic'       => array(
				'label'       => __( 'Read a diagnostic', 'smart-diagnostic' ),
				'description' => __( 'Returns the complete JSON configuration of a diagnostic: questions, scoring, profiles, results, emails, appearance.', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array( 'id' => $id ),
					'required'   => array( 'id' ),
				),
				'write'       => false,
				'access'      => 'diagnostic',
			),
			'list-templates'       => array(
				'label'       => __( 'List the templates', 'smart-diagnostic' ),
				'description' => __( 'Lists the ready-made diagnostic templates (ID, title, description, number of questions, duration).', 'smart-diagnostic' ),
				'input'       => $no_input,
				'write'       => false,
				'access'      => 'edit',
			),
			'preview-diagnostic'   => array(
				'label'       => __( 'Preview a diagnostic', 'smart-diagnostic' ),
				'description' => __( 'Lists the questions of a diagnostic and, if answers are given (object question key => value), computes the result exactly as for a visitor: path, scores, profile, texts, actions, recommended CTA. Nothing is saved.', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'id'      => $id,
						'answers' => array( 'type' => 'object' ),
						'contact' => array( 'type' => 'object' ),
					),
					'required'   => array( 'id' ),
				),
				'write'       => false,
				'access'      => 'diagnostic',
			),
			'list-submissions'     => array(
				'label'       => __( 'List the submissions', 'smart-diagnostic' ),
				'description' => __( 'Lists the submissions (leads) with contact, profile, scores and answers. Filters: diagnostic, dates (YYYY-MM-DD), profile, search. Contains personal data.', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'diagnostic' => $id,
						'from'       => $date,
						'to'         => $date,
						'profile'    => array( 'type' => 'string' ),
						'search'     => array( 'type' => 'string' ),
						'limit'      => array(
							'type'    => 'integer',
							'minimum' => 1,
							'maximum' => 100,
							'default' => 20,
						),
						'page'       => array(
							'type'    => 'integer',
							'minimum' => 1,
							'default' => 1,
						),
					),
				),
				'write'       => false,
				'access'      => 'submissions',
			),
			'export-submissions'   => array(
				'label'       => __( 'Export the submissions', 'smart-diagnostic' ),
				/* translators: %d: maximum number of rows. */
				'description' => sprintf( __( 'Exports the submissions as CSV (separator ";", same columns as the admin export), at most %d rows. Filters: diagnostic, dates (YYYY-MM-DD).', 'smart-diagnostic' ), self::EXPORT_MAX ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'diagnostic' => $id,
						'from'       => $date,
						'to'         => $date,
					),
				),
				'write'       => false,
				'access'      => 'submissions',
			),
			'get-stats'            => array(
				'label'       => __( 'Statistics of a diagnostic', 'smart-diagnostic' ),
				'description' => __( 'Funnel (sessions, starts, captures, submissions, completion rate, reach and drop-offs per step) and distribution of profiles and CTAs over a period (30 last days by default).', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'id'   => $id,
						'from' => $date,
						'to'   => $date,
					),
					'required'   => array( 'id' ),
				),
				'write'       => false,
				'access'      => 'submissions',
			),
			'create-diagnostic'    => array(
				'label'       => __( 'Create a diagnostic', 'smart-diagnostic' ),
				'description' => __( 'Creates a diagnostic from a complete JSON configuration (validated against the schema; nothing is created if it is invalid, the errors are returned). Draft by default.', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'title'  => array( 'type' => 'string' ),
						'config' => $config,
						'status' => $status,
					),
					'required'   => array( 'title', 'config' ),
				),
				'write'       => true,
				'access'      => 'edit',
			),
			'update-diagnostic'    => array(
				'label'       => __( 'Modify a diagnostic', 'smart-diagnostic' ),
				'description' => __( 'Replaces the configuration (complete JSON, validated against the schema: an invalid configuration is refused and the online version is kept), the title and/or the status of a diagnostic.', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'id'     => $id,
						'title'  => array( 'type' => 'string' ),
						'config' => $config,
						'status' => array(
							'type' => 'string',
							'enum' => array( 'draft', 'publish' ),
						),
					),
					'required'   => array( 'id' ),
				),
				'write'       => true,
				'access'      => 'diagnostic',
			),
			'create-from-template' => array(
				'label'       => __( 'Create a diagnostic from a template', 'smart-diagnostic' ),
				'description' => __( 'Creates a copy of a template (see list-templates), as a draft by default. Then adapt it with get-diagnostic and update-diagnostic.', 'smart-diagnostic' ),
				'input'       => array(
					'type'       => 'object',
					'properties' => array(
						'template' => array( 'type' => 'string' ),
						'title'    => array( 'type' => 'string' ),
						'status'   => $status,
					),
					'required'   => array( 'template' ),
				),
				'write'       => true,
				'access'      => 'edit',
			),
		);
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>
	 */
	private function do_list_diagnostics( array $input ): array {
		$posts = get_posts(
			array(
				'post_type'      => DiagnosticPostType::NAME,
				'post_status'    => array( 'publish', 'draft', 'pending', 'private', 'future' ),
				'posts_per_page' => 100,
				'orderby'        => 'title',
				'order'          => 'ASC',
				's'              => (string) ( $input['search'] ?? '' ),
			)
		);
		$items = array();
		foreach ( $posts as $post ) {
			$config  = $this->configs->get_array( $post->ID ) ?? array();
			$items[] = array(
				'id'        => $post->ID,
				'title'     => $post->post_title,
				'slug'      => $post->post_name,
				'status'    => $post->post_status,
				'modified'  => $post->post_modified_gmt,
				'questions' => count( array_filter( (array) ( $config['steps'] ?? array() ), static fn( $step ): bool => 'question' === ( $step['kind'] ?? '' ) ) ),
				'shortcode' => sprintf( '[smart_diagnostic id="%d"]', $post->ID ),
			);
		}
		return array(
			'diagnostics' => $items,
			/* translators: %d: number of diagnostics. */
			'message'     => sprintf( _n( '%d diagnostic', '%d diagnostics', count( $items ), 'smart-diagnostic' ), count( $items ) ),
		);
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_get_diagnostic( array $input ): array|WP_Error {
		$post = $this->post( $input['id'] ?? '' );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		return array(
			'id'      => $post->ID,
			'title'   => $post->post_title,
			'slug'    => $post->post_name,
			'status'  => $post->post_status,
			'config'  => json_decode( $this->configs->get_raw( $post->ID ) ),
			'message' => $post->post_title,
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private function do_list_templates(): array {
		$items = array_map(
			static fn( array $template ): array => array_intersect_key( $template, array_flip( array( 'id', 'title', 'description', 'questions', 'minutes' ) ) ),
			array_values( $this->library->all() )
		);
		return array(
			'templates' => $items,
			/* translators: %d: number of templates. */
			'message'   => sprintf( _n( '%d template', '%d templates', count( $items ), 'smart-diagnostic' ), count( $items ) ),
		);
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_preview_diagnostic( array $input ): array|WP_Error {
		$post = $this->post( $input['id'] ?? '' );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		$config   = $this->configs->get_array( $post->ID ) ?? array();
		$fallback = (string) ( $config['i18n']['defaultLanguage'] ?? '' );
		$label    = static fn( mixed $text ): string => wp_strip_all_tags( Text::resolve( $text, '', $fallback ) );

		$questions = array();
		foreach ( (array) ( $config['steps'] ?? array() ) as $step ) {
			if ( 'question' !== ( $step['kind'] ?? '' ) ) {
				continue;
			}
			$question = array(
				'key'   => $step['key'],
				'type'  => $step['type'] ?? '',
				'label' => $label( $step['label'] ?? '' ),
			);
			foreach ( (array) ( $step['options'] ?? array() ) as $option ) {
				$question['options'][] = array(
					'value' => $option['value'] ?? '',
					'label' => $label( $option['label'] ?? '' ),
				);
			}
			$questions[] = $question;
		}

		$result = array(
			'id'        => $post->ID,
			'title'     => $post->post_title,
			'questions' => $questions,
			'message'   => $post->post_title,
		);
		if ( ! empty( $input['answers'] ) && is_array( $input['answers'] ) ) {
			$computed = Calculator::compute( $config, $input['answers'], (array) ( $input['contact'] ?? array() ) );
			foreach ( array( 'profiles' => 'profile', 'ctas' => 'cta' ) as $list => $key ) { // phpcs:ignore WordPress.Arrays.ArrayDeclarationSpacing.AssociativeArrayFound
				foreach ( (array) ( $config['outcomes'][ $list ] ?? array() ) as $item ) {
					if ( ( $item['key'] ?? null ) === $computed[ $key ] ) {
						$computed[ $key . '_label' ] = $label( $item['label'] ?? '' );
					}
				}
			}
			$result['result'] = $computed;
		}
		return $result;
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_list_submissions( array $input ): array|WP_Error {
		$filters = $this->submission_filters( $input );
		if ( is_wp_error( $filters ) ) {
			return $filters;
		}
		$found = $this->submissions->query(
			$filters,
			array(
				'per_page' => max( 1, min( 100, (int) ( $input['limit'] ?? 20 ) ) ),
				'page'     => max( 1, (int) ( $input['page'] ?? 1 ) ),
			)
		);
		$items = array();
		foreach ( $found['items'] as $row ) {
			// Ni le jeton du lien de résultat, ni l'empreinte d'adresse IP.
			$items[] = array_intersect_key( $row, array_flip( array( 'id', 'created_at', 'diagnostic_id', 'first_name', 'email', 'contact', 'profile', 'cta', 'scores', 'vars', 'answers', 'lang', 'source_url', 'utm', 'consent_at' ) ) );
		}
		return array(
			'total'       => $found['total'],
			'submissions' => $items,
			/* translators: %d: number of submissions. */
			'message'     => sprintf( _n( '%d submission', '%d submissions', $found['total'], 'smart-diagnostic' ), $found['total'] ),
		);
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_export_submissions( array $input ): array|WP_Error {
		$filters = $this->submission_filters( $input );
		if ( is_wp_error( $filters ) ) {
			return $filters;
		}
		$rows = $this->submissions->query(
			$filters,
			array(
				'per_page' => self::EXPORT_MAX,
				'order'    => 'asc',
			)
		)['items'];
		return array(
			'rows'    => count( $rows ),
			'csv'     => SubmissionsPage::csv( $rows, $this->configs ),
			/* translators: %d: number of rows. */
			'message' => sprintf( _n( '%d row exported', '%d rows exported', count( $rows ), 'smart-diagnostic' ), count( $rows ) ),
		);
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_get_stats( array $input ): array|WP_Error {
		$post = $this->post( $input['id'] ?? '' );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		$to     = self::date( $input['to'] ?? '' ) ?? gmdate( 'Y-m-d' );
		$from   = self::date( $input['from'] ?? '' ) ?? gmdate( 'Y-m-d', time() - 29 * DAY_IN_SECONDS );
		$config = $this->configs->get_array( $post->ID ) ?? array();
		$steps  = array_values( array_filter( (array) ( $config['steps'] ?? array() ), static fn( array $step ): bool => 'after_results' !== ( $step['placement'] ?? '' ) ) );
		$funnel = Funnel::build( array_column( $steps, 'key' ), $this->events->sessions( $post->ID, $from, $to ) );
		return array(
			'id'        => $post->ID,
			'from'      => $from,
			'to'        => $to,
			'analytics' => (bool) Settings::get( 'analytics' ),
			'funnel'    => $funnel,
			'profiles'  => $this->submissions->count_by( 'profile', $post->ID, $from, $to ),
			'ctas'      => $this->submissions->count_by( 'cta', $post->ID, $from, $to ),
			/* translators: 1: number of submissions, 2: start date, 3: end date. */
			'message'   => sprintf( __( '%1$d submissions from %2$s to %3$s', 'smart-diagnostic' ), $funnel['submitted'], $from, $to ),
		);
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_create_diagnostic( array $input ): array|WP_Error {
		$status = $this->status( $input['status'] ?? 'draft' );
		if ( 'publish' === $status && ! current_user_can( 'publish_posts' ) ) {
			return new WP_Error( 'sd_forbidden', __( 'You are not allowed to publish.', 'smart-diagnostic' ) );
		}
		$json = self::json( $input['config'] ?? null );
		// Validation avant création : rien n'est créé si la configuration est invalide.
		$errors = ( new SchemaValidator() )->validate_json( $json );
		if ( $errors ) {
			return self::invalid( $errors );
		}
		$post_id = wp_insert_post(
			array(
				'post_type'   => DiagnosticPostType::NAME,
				'post_status' => $status,
				'post_title'  => sanitize_text_field( (string) ( $input['title'] ?? '' ) ),
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		$errors = $this->configs->save( (int) $post_id, $json );
		if ( $errors ) {
			wp_delete_post( (int) $post_id, true );
			return self::invalid( $errors );
		}
		return $this->saved( (int) $post_id, __( 'Diagnostic created.', 'smart-diagnostic' ) );
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_update_diagnostic( array $input ): array|WP_Error {
		$post = $this->post( $input['id'] ?? '' );
		if ( is_wp_error( $post ) ) {
			return $post;
		}
		$status = isset( $input['status'] ) ? $this->status( $input['status'] ) : null;
		if ( 'publish' === $status && ! current_user_can( 'publish_post', $post->ID ) ) {
			return new WP_Error( 'sd_forbidden', __( 'You are not allowed to publish.', 'smart-diagnostic' ) );
		}
		if ( array_key_exists( 'config', $input ) ) {
			// Config invalide : refusée, la version en ligne est conservée.
			$errors = $this->configs->save( $post->ID, self::json( $input['config'] ) );
			if ( $errors ) {
				return self::invalid( $errors );
			}
		}
		$changes = array();
		if ( isset( $input['title'] ) ) {
			$changes['post_title'] = sanitize_text_field( (string) $input['title'] );
		}
		if ( null !== $status ) {
			$changes['post_status'] = $status;
		}
		if ( $changes ) {
			$updated = wp_update_post( array( 'ID' => $post->ID ) + $changes, true );
			if ( is_wp_error( $updated ) ) {
				return $updated;
			}
		}
		return $this->saved( $post->ID, __( 'Diagnostic updated.', 'smart-diagnostic' ) );
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array<string, mixed>|WP_Error
	 */
	private function do_create_from_template( array $input ): array|WP_Error {
		$status = $this->status( $input['status'] ?? 'draft' );
		if ( 'publish' === $status && ! current_user_can( 'publish_posts' ) ) {
			return new WP_Error( 'sd_forbidden', __( 'You are not allowed to publish.', 'smart-diagnostic' ) );
		}
		$post_id = $this->library->create( sanitize_key( (string) ( $input['template'] ?? '' ) ), sanitize_text_field( (string) ( $input['title'] ?? '' ) ), $status );
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		return $this->saved( $post_id, __( 'Diagnostic created from the template.', 'smart-diagnostic' ) );
	}

	/**
	 * Diagnostic désigné par ID ou slug, si l'utilisateur peut le modifier.
	 */
	private function post( mixed $id ): \WP_Post|WP_Error {
		$post_id = $this->configs->find_id( (string) $id );
		$post    = null === $post_id ? null : get_post( $post_id );
		if ( ! $post instanceof \WP_Post || DiagnosticPostType::NAME !== $post->post_type ) {
			return new WP_Error( 'sd_not_found', __( 'Diagnostic not found.', 'smart-diagnostic' ) );
		}
		if ( ! current_user_can( 'edit_post', $post->ID ) ) {
			return new WP_Error( 'sd_forbidden', __( 'You are not allowed to do this.', 'smart-diagnostic' ) );
		}
		return $post;
	}

	/**
	 * @param array<string, mixed> $input Paramètres.
	 * @return array{diagnostic_id?: int, profile?: string, from?: string, to?: string, search?: string}|WP_Error
	 */
	private function submission_filters( array $input ): array|WP_Error {
		$filters = array();
		if ( isset( $input['diagnostic'] ) && '' !== (string) $input['diagnostic'] ) {
			$id = $this->configs->find_id( (string) $input['diagnostic'] );
			if ( null === $id ) {
				return new WP_Error( 'sd_not_found', __( 'Diagnostic not found.', 'smart-diagnostic' ) );
			}
			$filters['diagnostic_id'] = $id;
		}
		foreach ( array( 'from', 'to' ) as $key ) {
			$date = self::date( $input[ $key ] ?? '' );
			if ( null !== $date ) {
				$filters[ $key ] = $date;
			}
		}
		foreach ( array( 'profile', 'search' ) as $key ) {
			if ( isset( $input[ $key ] ) && '' !== (string) $input[ $key ] ) {
				$filters[ $key ] = sanitize_text_field( (string) $input[ $key ] );
			}
		}
		return $filters;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function saved( int $post_id, string $message ): array {
		return array(
			'id'       => $post_id,
			'status'   => get_post_status( $post_id ),
			'edit_url' => admin_url( 'post.php?post=' . $post_id . '&action=edit' ),
			'message'  => $message,
		);
	}

	private function status( mixed $status ): string {
		return 'publish' === $status ? 'publish' : 'draft';
	}

	private static function date( mixed $value ): ?string {
		return is_string( $value ) && 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : null;
	}

	/**
	 * JSON de la configuration reçue (objet ou texte JSON).
	 */
	private static function json( mixed $config ): string {
		if ( is_string( $config ) ) {
			return $config;
		}
		return is_array( $config ) || is_object( $config ) ? (string) wp_json_encode( $config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) : '';
	}

	/**
	 * @param list<string> $errors Erreurs de validation.
	 */
	private static function invalid( array $errors ): WP_Error {
		return new WP_Error(
			'sd_invalid_config',
			__( 'The configuration is not valid:', 'smart-diagnostic' ) . "\n" . implode( "\n", array_slice( $errors, 0, 30 ) ),
			array( 'errors' => $errors )
		);
	}
}
