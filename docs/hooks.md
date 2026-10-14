# Hooks et filtres

## Actions PHP

| Action | Arguments | Quand |
|---|---|---|
| `sd_booted` | `Plugin $plugin` | Services démarrés. |
| `sd_submission_created` | `array $submission, array $config` | Soumission enregistrée (après recalcul serveur). |
| `sd_submission_contact_updated` | `array $submission, array $config` | Coordonnées ajoutées sous le résultat. |
| `sd_event` | `string $event, array $data` | Événement du parcours : `start`, `step_view`, `answer`, `capture`, `submit`, `abandon` ; `$data` = `diagnostic_id`, `session`, `step`. |
| `sd_webhook_delivered` | `bool $ok, array $webhook, array $submission, int $code` | Après chaque tentative d'envoi d'un webhook. |
| `sd_template_used` | `int $post_id, string $template_id` | Diagnostic créé depuis un modèle. |

## Filtres PHP

| Filtre | Valeur | Rôle |
|---|---|---|
| `sd_services` | `array<class-string>` | Ajouter / retirer des services (classes avec `register()`). |
| `sd_config` | `stdClass $config, int $post_id` | Modifier la config d'un diagnostic à la volée. |
| `sd_config_migrations` | `array<int, callable>` | Migrations de config (index = version de départ). |
| `sd_front_payload` | `array $payload, int $post_id` | Données transmises au questionnaire. |
| `sd_ui_strings` | `array<string, string>` | Libellés par défaut de l'interface visiteur. |
| `sd_current_language` | `string $lang` | Langue d'affichage. |
| `sd_brand_name` | `string $name` | Nom affiché dans l'admin. |
| `sd_rest_namespace` | `string $namespace` | Espace de noms de l'API REST. |
| `sd_rate_limit` | `int $limit` | Soumissions autorisées par visiteur et par fenêtre. |
| `sd_email_headers` | `list<string> $headers` | En-têtes des emails. |
| `sd_webhook_secret` | `string $secret, int $diagnostic_id, string $key` | Secret HMAC d'un webhook (ex. depuis `wp-config.php`). |
| `sd_submissions_capability` | `string $capability` | Capacité pour voir / exporter / supprimer les réponses et les statistiques. |
| `sd_templates` | `array<string, array> $templates` | Modèles de diagnostics proposés (voir ci-dessous). |

## Modèles surchargeables

Copier dans `<thème>/smart-diagnostic/` :

- `emails/user.php` — email du résultat au visiteur ;
- `emails/admin.php` — notification à l'équipe.

Variable `$sd` : voir `Integrations\Mailer::template_data()`.

## Bibliothèque de modèles de diagnostics

Les modèles livrés sont dans `templates/diagnostics/*.json` (un fichier = un modèle,
identifiant = nom du fichier). Un thème ou un plugin ajoute les siens avec le filtre
`sd_templates` ; chaque entrée fournit `file` (chemin d'un JSON) ou `config` (tableau ou
JSON), et facultativement `title` / `description` (sinon `meta.title` /
`meta.description`). Un modèle invalide au regard du schéma n'est pas proposé.

```php
add_filter( 'sd_templates', function ( array $templates ) {
	$templates['mon-audit'] = array( 'file' => __DIR__ . '/diagnostics/mon-audit.json' );
	unset( $templates['product-finder'] ); // Retirer un modèle livré.
	return $templates;
} );
```

« Utiliser ce modèle » crée un brouillon avec une copie de la configuration : le modèle
n'est jamais modifié.

## Côté navigateur

```js
document.addEventListener( 'sd:event', ( event ) => {
	// event.detail = { event, diagnosticId, step, sd_profile? }
} );
```

Si `window.dataLayer` existe, chaque événement y est aussi poussé (`sd_start`,
`sd_step_view`, `sd_answer`, `sd_capture`, `sd_submit`, `sd_abandon`).

## WP-CLI

```bash
wp smart-diagnostic import <fichier.json> [--slug=<slug>] [--title=<titre>] [--status=<statut>] [--porcelain]
wp smart-diagnostic export <id|slug>
wp smart-diagnostic validate <fichier.json>
wp smart-diagnostic templates [--format=table|json|csv|ids]
wp smart-diagnostic create-from-template <modèle> [--title=<titre>] [--status=<statut>] [--porcelain]
```

## Étendre le moteur

Le format de configuration est fermé par le JSON Schema (`additionalProperties: false`) :
un nouveau type de question ou de bloc de résultat se fait dans le code du plugin, en
ajoutant au même moment :

1. le type dans `schema/diagnostic.schema.json` (avec une migration si besoin) ;
2. le rendu dans `assets/src/front/components/` ;
3. la validation dans `assets/src/engine/validate.js` **et** `src/Submission/Sanitizer.php` ;
4. une fixture de parité dans `tests/fixtures/parity/` si le calcul est concerné.
