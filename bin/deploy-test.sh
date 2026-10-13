#!/usr/bin/env bash
# Met à jour la VM de test depuis une branche, puis relance setup-local.sh.
#
#   bin/deploy-test.sh [branche]     (par défaut : branche courante)
#
# À lancer sur la VM, dans le clone du repo. Depuis un poste de dev :
#   ssh vscode@<ip-vm> 'cd ~/smart-diagnostic && bin/deploy-test.sh <branche>'
set -euo pipefail

cd "$(dirname "$0")/.."

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

echo "==> Mise à jour sur la branche ${BRANCH}"
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

bin/setup-local.sh

echo "==> Déployé : $(git log -1 --format='%h %s')"
