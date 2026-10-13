# Statistiques, langues, marque blanche

## Statistiques (entonnoir)

Chaque passage dans un questionnaire reçoit un **identifiant aléatoire** (pas de cookie,
aucune donnée personnelle). Événements enregistrés : `start`, `step_view` (étape affichée),
`answer`, `capture` (formulaire validé), `submit` (compté par le serveur) et `abandon`
(page quittée en plein parcours).

Menu du plugin → **Statistiques** : par diagnostic et période, nombre de démarrages,
de questionnaires terminés, taux de complétion, contacts collectés, entonnoir étape par
étape, abandons par dernière étape vue, répartition des profils et des CTA.

Désactivation : Réglages → Confidentialité → Statistiques. Les événements suivent la même
durée de conservation que les réponses.

### Brancher GA4, Meta Pixel, GTM…

Côté navigateur, chaque événement :

```js
// 1. événement DOM
document.addEventListener( 'sd:event', ( e ) => {
	// e.detail = { event: 'step_view', diagnosticId: 12, step: 'q_choice' }
	if ( e.detail.event === 'submit' ) fbq( 'track', 'Lead' );
} );

// 2. dataLayer (si présent) : { event: 'sd_step_view', sd_diagnostic: 12, sd_step: 'q_choice' }
```

À la soumission, `sd_submit` contient aussi `sd_profile`.

Côté serveur (Measurement Protocol, Conversions API…) :

```php
add_action( 'sd_event', function ( string $event, array $data ) {
	// $data = [ 'diagnostic_id' => 12, 'session' => '…', 'step' => 'q_choice' ]
}, 10, 2 );
```

## Langues

- Chaque texte de la config peut être traduit : `"label": { "fr": "…", "en": "…" }`.
- `i18n.languages` liste les langues ; `i18n.switcher: true` affiche un sélecteur.
- Langue affichée : celle de **WPML** ou **Polylang** si l'un est actif, sinon la langue du
  site (filtre `sd_current_language`). Repli : langue demandée → langue courte (`fr_FR` →
  `fr`) → `i18n.defaultLanguage` → premier texte disponible.
- Les emails partent dans la langue de la soumission.
- L'interface du plugin (admin et libellés par défaut du questionnaire) est traduite en
  français (`languages/`). Libellés du questionnaire surchargeables par diagnostic via
  `ui.strings`, ou globalement via le filtre `sd_ui_strings`.

## Marque blanche

- **Nom affiché** dans l'admin (menus, liste des extensions) : Réglages → Marque blanche,
  ou constante prioritaire dans `wp-config.php` :
  ```php
  define( 'SD_BRAND_NAME', 'Mon diagnostic' );
  ```
  Avec un nom personnalisé, l'auteur et les liens d'origine disparaissent de la liste des
  extensions. Filtre : `sd_brand_name`.
- **Côté visiteur**, aucune mention du plugin : classes CSS `sd-*`, identifiants de scripts
  neutres (`sd-front`), paramètre de lien `sd_result`, emails sans signature du plugin.
- Pour aller plus loin : renommer le dossier du plugin (les chemins des fichiers changent)
  et l'espace de noms de l'API :
  ```php
  add_filter( 'sd_rest_namespace', fn() => 'mon-diagnostic/v1' );
  ```
