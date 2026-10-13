# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- M2 : moteur de règles et de formules en JS et en PHP (chemin rejoué, scores par axe,
  réponses de sortie, plages, comptage, multiplicateurs, plafonds, variables, profils,
  textes, actions, CTA), tests de parité sur fixtures, écran de résultat (radar, barres,
  jauges en SVG, variables, plan d'action, CTA avec UTM, impression / PDF), `docs/moteur.md`.
- M1 : CPT `sd_diagnostic`, éditeur JSON avec validation et aperçu, bloc et shortcode,
  WP-CLI `import|export|validate`, parcours visiteur complet (Preact).
- M0 : squelette du plugin (bootstrap, autoload PSR-4, désinstallation, marque blanche).
- JSON Schema v1 de la configuration et exemple neutre `examples/demo.json`.
- Outillage : PHPCS (WPCS), PHPStan niveau 6, PHPUnit, ESLint/Prettier, Jest, Playwright.
- Build front Preact via `@wordpress/scripts`, contrôle du budget de taille.
- Environnement Docker (WordPress, MariaDB, phpMyAdmin, WP-CLI), `.wp-env.json`,
  `bin/setup-local.sh` et `bin/deploy-test.sh`.
- CI GitHub Actions (lint, tests, E2E Docker) et zip de release sur les tags `v*`.
