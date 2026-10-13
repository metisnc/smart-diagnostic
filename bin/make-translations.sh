#!/usr/bin/env bash
# Régénère les fichiers de traduction (via le conteneur WP-CLI de docker-compose).
#
#   bin/make-translations.sh pot   # met à jour languages/smart-diagnostic.pot
#   bin/make-translations.sh       # compile les .po en .mo et en JSON (scripts admin)
#
# Après « pot », compléter languages/smart-diagnostic-fr_FR.po (Poedit, Loco…) puis relancer
# sans argument. bin/i18n-map.json relie chaque fichier source JS à son fichier compilé.
set -euo pipefail
cd "$(dirname "$0")/.."

run() { docker compose run --rm -T --user "$(id -u):$(id -g)" wpcli sh -c "cd wp-content/plugins/smart-diagnostic && $1"; }

if [[ "${1:-}" == "pot" ]]; then
	run "wp i18n make-pot . languages/smart-diagnostic.pot --slug=smart-diagnostic --domain=smart-diagnostic --exclude=node_modules,vendor,vendor-prefixed,build,tests,docs --skip-audit"
	run "wp i18n update-po languages/smart-diagnostic.pot languages/"
	exit 0
fi

rm -f languages/*.json
run "wp i18n make-mo languages/ languages/"
run "wp i18n make-json languages/ languages/ --no-purge --use-map=bin/i18n-map.json"
ls -1 languages/
