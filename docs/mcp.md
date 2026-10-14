# Connecteur MCP (assistants IA)

Le connecteur permet à un assistant IA compatible avec le protocole MCP (Claude Desktop,
par exemple) de travailler avec les diagnostics du site. Il est **facultatif et désactivé par
défaut**.

## Ce que l'assistant peut faire

| Action (outil MCP) | Mode | Droit WordPress requis |
|---|---|---|
| `list-diagnostics` — lister les diagnostics | lecture | modifier des articles (`edit_posts`) |
| `get-diagnostic` — lire la configuration complète | lecture | modifier ce diagnostic |
| `list-templates` — lister les modèles | lecture | `edit_posts` |
| `preview-diagnostic` — questions + calcul du résultat pour des réponses données | lecture | modifier ce diagnostic |
| `list-submissions` — lister les réponses (données personnelles) | lecture | accès aux réponses (`manage_options` par défaut, filtre `sd_submissions_capability`) |
| `export-submissions` — export CSV des réponses (5 000 lignes max.) | lecture | accès aux réponses |
| `get-stats` — entonnoir, abandons, profils, CTA | lecture | accès aux réponses |
| `create-diagnostic` — créer depuis une configuration JSON | écriture | `edit_posts` (+ `publish_posts` pour publier) |
| `update-diagnostic` — modifier configuration, titre, statut | écriture | modifier ce diagnostic (+ publier) |
| `create-from-template` — créer une copie d'un modèle | écriture | `edit_posts` |

Sécurité :

- **activation explicite** : *Réglages → Connecteur MCP* ; désactivé, rien n'est exposé ;
- **lecture seule par défaut** : les actions de création / modification n'existent qu'en
  mode « Lecture et écriture » ;
- **authentification** par mot de passe d'application WordPress : l'assistant agit avec les
  droits de l'utilisateur, vérifiés à chaque action ;
- **aucune suppression** possible via MCP ;
- toute configuration est **validée par le schéma** : une configuration invalide est refusée
  (la version en ligne est conservée) et les erreurs sont renvoyées à l'assistant ;
- **journal** des 200 dernières actions (date, utilisateur, action, paramètres résumés,
  résultat), affiché dans les réglages.

Les fonctions sont déclarées via l'**Abilities API** de WordPress (catégorie
`smart-diagnostic`, noms `smart-diagnostic/<action>`) et exposées par le **MCP Adapter**
officiel sur un serveur dédié.

## Installation

Prérequis : WordPress 6.9 ou plus, site en HTTPS (obligatoire pour les mots de passe
d'application).

1. Installer et activer le plugin **MCP Adapter** (dernière version :
   <https://github.com/WordPress/mcp-adapter/releases>, fichier `mcp-adapter.zip`, puis
   *Extensions → Ajouter → Téléverser*).
2. *Diagnostics → Réglages → Connecteur MCP* : cocher **Activer le connecteur MCP**, choisir
   **Lecture seule** (recommandé) ou **Lecture et écriture**, enregistrer. Les deux
   prérequis doivent être cochés ✅ ; l'**adresse de connexion** s'affiche, par exemple
   `https://mon-site.fr/wp-json/smart-diagnostic/mcp`.
3. *Comptes → Profil → Mots de passe d'application* : créer un mot de passe nommé par exemple
   « Claude Desktop » et le copier (il n'est affiché qu'une fois). De préférence pour un
   compte dédié, avec seulement les droits nécessaires.

## Connexion depuis Claude Desktop

Claude Desktop → *Réglages → Développeur → Modifier la configuration* ouvre le fichier
`claude_desktop_config.json`. Ajouter (Node.js doit être installé sur l'ordinateur) :

```json
{
  "mcpServers": {
    "smart-diagnostic": {
      "command": "npx",
      "args": ["-y", "@automattic/mcp-wordpress-remote@latest"],
      "env": {
        "WP_API_URL": "https://mon-site.fr/wp-json/smart-diagnostic/mcp",
        "WP_API_USERNAME": "mon-identifiant",
        "WP_API_PASSWORD": "xxxx xxxx xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

Remplacer l'adresse, l'identifiant et le mot de passe d'application, puis redémarrer Claude
Desktop : les outils « smart-diagnostic » apparaissent dans la liste des connecteurs.

Autre possibilité, si Claude Desktop tourne sur la même machine que le site (WP-CLI
installé) : `"command": "wp"`, `"args": ["--path=/chemin/du/site", "mcp-adapter", "serve",
"--server=smart-diagnostic", "--user=mon-identifiant"]`.

## Exemples de demandes

- « Liste mes diagnostics et dis-moi combien de questions a chacun. »
- « Crée-moi un quiz de 10 questions pour un salon de coiffure à partir du modèle
  *Quiz de recommandation produit* : trois formules (coupe, coupe + soin, forfait
  mariage), ton chaleureux, en français. Laisse-le en brouillon. »
- « Dans le diagnostic *Audit de maturité digitale*, ajoute une question sur l'usage de l'IA
  dans l'entreprise et intègre-la à l'axe *Outils & données*. »
- « Si je réponds “Oui” partout sauf à la question sur les sauvegardes, quel profil
  j'obtiens ? » (aperçu, rien n'est enregistré)
- « Résume les réponses du mois dernier : nombre, profils les plus fréquents, et l'étape où
  les visiteurs abandonnent le plus. »
- « Exporte les réponses d'octobre en CSV. »

Conseil : demander à l'assistant de partir d'un modèle ou d'un diagnostic existant
(`get-diagnostic`) pour qu'il respecte le format, puis de vérifier le résultat avec
`preview-diagnostic` avant de publier.
