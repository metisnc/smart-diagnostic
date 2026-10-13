# Smart Diagnostic

Plugin WordPress en marque blanche : un moteur de questionnaires de diagnostic interactifs
(type « lead magnet ») qui mène le visiteur, étape par étape, jusqu'à un rapport personnalisé
et un appel à l'action.

Le plugin ne contient **aucun contenu métier** : questions, parcours, règles de calcul, résultats,
design et textes sont définis par l'administrateur de chaque site, sous forme d'une configuration
JSON validée par [`schema/diagnostic.schema.json`](schema/diagnostic.schema.json).

> État : **M0 — squelette**. Voir [le plan des milestones](#milestones).

## Prérequis

- WordPress 6.4+
- PHP 8.1+

## Installation (site WordPress)

Téléchargez le zip de la dernière [release](https://github.com/metisnc/smart-diagnostic/releases)
puis *Extensions → Ajouter → Téléverser*. Le zip contient déjà les dépendances et les assets compilés.

## Développement

### Démarrage rapide (Docker)

Seul Docker est requis : `composer` et `node` sont utilisés via Docker s'ils ne sont pas installés.

```bash
git clone https://github.com/metisnc/smart-diagnostic.git
cd smart-diagnostic
bin/setup-local.sh
```

Le script :

1. crée `.env` avec des mots de passe aléatoires (fichier non versionné) ;
2. installe les dépendances et compile les assets ;
3. démarre WordPress, MariaDB et phpMyAdmin, installe WordPress et active le plugin ;
4. crée la page `/diagnostic-test/` et importe `examples/demo.json` (à partir de M1).

| Service    | Adresse par défaut                       |
|------------|------------------------------------------|
| WordPress  | http://localhost:8080 (admin : `/wp-admin`, identifiants dans `.env`) |
| phpMyAdmin | http://127.0.0.1:8081                    |

Commandes WP-CLI : `docker compose run --rm wpcli wp <commande>`.

Alternative : [`wp-env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/)
(`npx wp-env start`, après `composer install && npm ci && npm run build`).

### Installation sur une VM Linux vierge (Debian / Ubuntu)

```bash
# Docker Engine + plugin Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # puis se déconnecter / reconnecter

sudo apt-get install -y git
git clone https://github.com/metisnc/smart-diagnostic.git ~/smart-diagnostic
cd ~/smart-diagnostic
cp .env.example .env
# Pour exposer le site sur le réseau, dans .env :
#   WP_URL=http://<ip-de-la-vm>  WP_BIND=0.0.0.0  WP_PORT=80
bin/setup-local.sh
```

Mise à jour ultérieure depuis une branche : `bin/deploy-test.sh <branche>`.

### Qualité et tests

| Commande              | Rôle                                          |
|-----------------------|-----------------------------------------------|
| `composer lint`       | PHPCS (WordPress Coding Standards)            |
| `composer analyse`    | PHPStan niveau 6                              |
| `composer test`       | PHPUnit                                       |
| `npm run lint`        | ESLint + Prettier                             |
| `npm test`            | Jest (dont validation des exemples contre le schéma) |
| `npm run build`       | Build des assets (`build/`)                   |
| `npm run size`        | Budget du bundle front (< 100 ko gzip)        |
| `npm run test:e2e`    | Playwright (`WP_BASE_URL=http://… npm run test:e2e`) |

La CI GitHub Actions exécute tout cela sur chaque push et PR, puis un parcours E2E complet
dans Docker. Un tag `v*` produit le zip du plugin en release.

### Choix techniques

- **Front visiteur en Preact** (~4 ko gzip) plutôt que React (~45 ko) : le budget de 100 ko
  reste confortable. L'admin et le bloc Gutenberg utilisent React, déjà chargé par WordPress.
- **Pas d'`eval`** : formules et conditions passent par un petit évaluateur d'expressions
  implémenté à l'identique en JS (aperçu) et en PHP (source de vérité), avec tests de parité.
- **Secrets hors configuration** : clés de webhooks et de captcha restent en base et ne sortent
  jamais à l'export JSON.

## Marque blanche

Le nom affiché dans l'admin se règle dans `wp-config.php` :

```php
define( 'SD_BRAND_NAME', 'Mon diagnostic' );
```

ou par le filtre `sd_brand_name`. Rien n'est mentionné côté visiteur.

## Format de configuration

Documenté par le JSON Schema [`schema/diagnostic.schema.json`](schema/diagnostic.schema.json) ;
exemple minimal : [`examples/demo.json`](examples/demo.json). Une documentation détaillée sera
ajoutée dans `docs/` au fil des milestones.

## Milestones

| | Contenu |
|---|---|
| M0 | Squelette, outillage, CI, Docker / wp-env, VM de test |
| M1 | JSON Schema, CPT, bloc / shortcode, parcours front, évaluateur de conditions JS |
| M2 | Moteur de règles et formules JS + PHP, axes, résultats, tests de parité |
| M3 | Formulaire de capture, REST sécurisé, stockage, page de résultat, lien unique |
| M4 | Emails, webhooks, admin Réponses + CSV, RGPD |
| M5 | Analytics / entonnoir, multilingue, marque blanche |
| M6 | Constructeur visuel, import / export, E2E complets, release 1.0 |

Cahier des charges : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).

## Licence

GPL-2.0-or-later.
