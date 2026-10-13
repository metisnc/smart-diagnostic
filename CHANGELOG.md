# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- M0 : squelette du plugin (bootstrap, autoload PSR-4, désinstallation, marque blanche).
- JSON Schema v1 de la configuration et exemple neutre `examples/demo.json`.
- Outillage : PHPCS (WPCS), PHPStan niveau 6, PHPUnit, ESLint/Prettier, Jest, Playwright.
- Build front Preact via `@wordpress/scripts`, contrôle du budget de taille.
- Environnement Docker (WordPress, MariaDB, phpMyAdmin, WP-CLI), `.wp-env.json`,
  `bin/setup-local.sh` et `bin/deploy-test.sh`.
- CI GitHub Actions (lint, tests, E2E Docker) et zip de release sur les tags `v*`.
