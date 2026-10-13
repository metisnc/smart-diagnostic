#!/usr/bin/env bash
# Installe et configure l'environnement WordPress local (idempotent).
#
#   bin/setup-local.sh
#
# 1. crée .env avec des mots de passe aléatoires s'il n'existe pas ;
# 2. installe les dépendances PHP/JS et compile les assets (via Docker si
#    composer/node ne sont pas installés) ;
# 3. démarre les conteneurs, installe WordPress, active le plugin ;
# 4. crée une page de test et importe examples/demo.json (dès que la
#    commande WP-CLI d'import existe, M1).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

random_secret() {
	# 24 caractères alphanumériques.
	LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 || true
}

# --- 1. .env -----------------------------------------------------------------
if [[ ! -f .env ]]; then
	log "Création de .env (mots de passe aléatoires)"
	cp .env.example .env
	while grep -q 'change-me' .env; do
		sed -i "0,/change-me/s//$(random_secret)/" .env
	done
	chmod 600 .env
fi
set -a
# shellcheck disable=SC1091
source .env
set +a

# --- 2. Dépendances et build ---------------------------------------------------
log "Dépendances PHP"
if command -v composer >/dev/null 2>&1; then
	composer install --no-interaction --prefer-dist
else
	docker run --rm -u "$(id -u):$(id -g)" -v "$ROOT":/app -w /app composer:2 \
		install --no-interaction --prefer-dist
fi

log "Dépendances JS et build"
if command -v npm >/dev/null 2>&1; then
	npm ci --no-audit --no-fund
	npm run build
else
	docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$ROOT":/app -w /app node:22 \
		sh -c "npm ci --no-audit --no-fund && npm run build"
fi

# --- 3. Conteneurs et WordPress ---------------------------------------------------
log "Démarrage des conteneurs"
docker compose up -d --wait db wordpress phpmyadmin

wp() { docker compose run --rm -T wpcli wp "$@"; }

log "Attente de WordPress"
for _ in $(seq 1 30); do
	if wp core version >/dev/null 2>&1; then break; fi
	sleep 2
done

if ! wp core is-installed >/dev/null 2>&1; then
	log "Installation de WordPress"
	wp core install \
		--url="$WP_URL" \
		--title="$WP_TITLE" \
		--admin_user="$WP_ADMIN_USER" \
		--admin_password="$WP_ADMIN_PASSWORD" \
		--admin_email="$WP_ADMIN_EMAIL" \
		--skip-email
	wp rewrite structure '/%postname%/' --hard
else
	wp option update home "$WP_URL" >/dev/null
	wp option update siteurl "$WP_URL" >/dev/null
fi

log "Activation du plugin"
wp plugin activate smart-diagnostic

# --- 4. Contenu de test ------------------------------------------------------------
# Environnement de test : limite de soumissions relevée (les tests E2E soumettent souvent).
if ! wp option get sd_settings >/dev/null 2>&1; then
	wp option add sd_settings '{"rate_limit":1000,"rate_window":600}' --format=json >/dev/null
fi

DIAGNOSTIC_ID=""
if wp help smart-diagnostic import >/dev/null 2>&1; then
	log "Import de examples/demo.json"
	DIAGNOSTIC_ID="$(wp smart-diagnostic import wp-content/plugins/smart-diagnostic/examples/demo.json --slug=demo --porcelain)"
fi

if ! wp post list --post_type=page --name=diagnostic-test --field=ID | grep -q .; then
	log "Création de la page de test"
	wp post create --post_type=page --post_status=publish --post_title='Diagnostic test' \
		--post_name=diagnostic-test --post_content="[smart_diagnostic id=\"${DIAGNOSTIC_ID:-demo}\"]" >/dev/null
fi

log "Prêt : ${WP_URL} (admin : ${WP_URL}/wp-admin, identifiants dans .env)"
