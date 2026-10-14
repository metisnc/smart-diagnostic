# Smart Diagnostic

Plugin WordPress en marque blanche : un moteur de questionnaires de diagnostic interactifs
(type « lead magnet ») qui mène le visiteur, étape par étape, jusqu'à un résultat
personnalisé et un appel à l'action.

Le plugin ne contient **aucun contenu métier** : questions, parcours, règles de calcul,
résultats, design et textes sont définis dans chaque site, avec le **constructeur visuel**
ou en JSON (validé par [`schema/diagnostic.schema.json`](schema/diagnostic.schema.json)).
Le même plugin sert un diagnostic business, un quiz produit, un audit RH, un test
d'éligibilité…

## Fonctionnalités

- **Parcours** mobile-first et accessible : 15 types de questions, sections, progression,
  retour, reprise automatique, questions conditionnelles et sauts, écrans intermédiaires,
  messages d'encouragement, formulaire de capture avec consentement RGPD, écran d'attente.
- **Calcul** : scores par axe, points par réponse, règles (plages, comptage, conditions,
  multiplicateurs, plafonds), réponses « Je ne sais pas », formules, profils, textes
  conditionnels, plan d'action, CTA recommandé avec UTM. Moteur identique en JS (aperçu) et
  en PHP (source de vérité), avec tests de parité.
- **Résultat** : radar, barres ou jauges en SVG, impression / PDF, lien personnel, emails personnalisables sans code
  (éditeur visuel par blocs), relance automatique.
- **Leads** : API REST sécurisée (nonce, anti-robot, limitation, captcha optionnel), admin
  « Réponses » avec filtres et export CSV, emails, webhooks signés (Make, Zapier, n8n, CRM).
- **Statistiques** : entonnoir, abandons, profils, CTA ; événements pour GA4 / GTM / Meta.
- **RGPD** : consentement versionné, conservation limitée, export / effacement WordPress.
- **Multilingue** (WPML, Polylang), interface traduite en français, **marque blanche**.
- **Bibliothèque de modèles** prêts à l'emploi (diagnostic business, recommandation produit,
  éligibilité, maturité digitale, satisfaction client), extensible par filtre.
- **Import / export / duplication** de diagnostics d'un site à l'autre.

## Installation

Prérequis : WordPress 6.4+, PHP 8.1+.

1. Télécharger le zip de la dernière [release](https://github.com/metisnc/smart-diagnostic/releases).
2. *Extensions → Ajouter → Téléverser une extension*, puis activer.
3. Menu du plugin → **Modèles** (partir d'un diagnostic prêt à l'emploi), **Ajouter un
   diagnostic** ou **Importer** un JSON.
4. Insérer le diagnostic avec le bloc **Diagnostic** ou le shortcode
   `[smart_diagnostic id="123"]` (ID ou slug).

Recommandé : un plugin SMTP pour l'envoi des emails, et une tâche cron système si le site a
peu de trafic (réessais des webhooks, purge RGPD).

## Documentation

| Sujet | Document |
|---|---|
| Format JSON | [`schema/diagnostic.schema.json`](schema/diagnostic.schema.json) ; diagnostic de test des suites automatiques : [`tests/fixtures/demo.json`](tests/fixtures/demo.json) |
| Moteur de calcul, expressions, conditions | [`docs/moteur.md`](docs/moteur.md) |
| API REST, soumissions, stockage | [`docs/api.md`](docs/api.md) |
| Emails, webhooks, réponses, RGPD | [`docs/integrations.md`](docs/integrations.md) |
| Statistiques, langues, marque blanche | [`docs/statistiques-langues-marque.md`](docs/statistiques-langues-marque.md) |
| Hooks, filtres, WP-CLI | [`docs/hooks.md`](docs/hooks.md) |
| Cahier des charges | [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) |

## Développement

### Démarrage rapide (Docker)

Seul Docker est requis : `composer` et `node` sont utilisés via Docker s'ils manquent.

```bash
git clone https://github.com/metisnc/smart-diagnostic.git
cd smart-diagnostic
bin/setup-local.sh
```

Le script crée `.env` (mots de passe aléatoires, non versionné), installe les dépendances,
compile les assets, démarre WordPress + MariaDB + phpMyAdmin + Mailpit et active le plugin.
Avec `SD_TEST_HELPERS=1` (environnement des tests automatiques), il importe aussi le
diagnostic de test `tests/fixtures/demo.json`, crée la page `/diagnostic-test/` et un compte
`e2e` ; avec `SD_TEST_HELPERS=0`, le site reste vierge.

| Service    | Adresse par défaut |
|------------|--------------------|
| WordPress  | http://localhost:8080 (admin : `/wp-admin`, identifiants dans `.env`) |
| phpMyAdmin | http://127.0.0.1:8081 |

WP-CLI : `docker compose run --rm wpcli wp <commande>`.
Alternative : `npx wp-env start` (après `composer install && npm ci && npm run build`).

### Sur une VM Linux vierge (Debian / Ubuntu)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"      # puis se reconnecter
sudo apt-get install -y git
git clone https://github.com/metisnc/smart-diagnostic.git ~/smart-diagnostic
cd ~/smart-diagnostic
cp .env.example .env
# Pour exposer le site : WP_URL=http://<ip>  WP_BIND=0.0.0.0  WP_PORT=80
bin/setup-local.sh
```

Mise à jour depuis une branche : `bin/deploy-test.sh <branche>` ; tous les tests :
`bin/test-vm.sh`.

### Qualité et tests

| Commande | Rôle |
|---|---|
| `composer lint` / `composer analyse` / `composer test` | PHPCS (WPCS), PHPStan niveau 6, PHPUnit |
| `npm run lint` / `npm test` | ESLint + Prettier, Jest (dont parité JS ↔ PHP) |
| `npm run build` / `npm run size` | Build ; budget du questionnaire < 100 ko gzip |
| `npm run test:e2e` | Playwright (`WP_BASE_URL=http://… npm run test:e2e`) |
| `bin/make-translations.sh [pot]` | Fichiers de traduction |

La CI GitHub Actions lance tout cela à chaque push / PR, puis un parcours E2E complet dans
Docker. Un tag `v*` publie le zip du plugin en release.

### Choix techniques

- **Questionnaire en Preact** (~22 ko gzip) : le visiteur ne charge pas React. L'admin
  (constructeur, bloc) utilise React et les composants de WordPress.
- **Pas d'`eval`** : formules et conditions passent par un évaluateur dédié, identique en
  JS et en PHP.
- **Librairie PHP embarquée préfixée** (`SmartDiagnostic\Vendor\…`, via Strauss) : pas de
  conflit avec d'autres plugins.
- **Secrets hors configuration** : clés de webhooks et de captcha restent en base, jamais
  dans l'export JSON ni dans la page publique.

## Licence

GPL-2.0-or-later.
