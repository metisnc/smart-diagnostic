#!/usr/bin/env bash
# Lance toute la suite de tests sur la VM de test (lint, unitaires, E2E contre le site déployé).
#
#   bin/test-vm.sh
#
# Prérequis : bin/deploy-test.sh déjà exécuté (dépendances installées, site en ligne).
# Les dépendances système de Chromium doivent être installées une fois :
#   sudo npx playwright install-deps chromium
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source .env
set +a

step() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }

step "PHPCS";    composer lint
step "PHPStan";  composer analyse
step "PHPUnit";  composer test
step "ESLint / Prettier"; npm run lint
step "Jest";     npm test
step "Budget du bundle"; npm run size

step "Playwright contre ${WP_URL}"
npx playwright install chromium >/dev/null
WP_BASE_URL="$WP_URL" npx playwright test

step "Tous les tests sont passés"
