# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).

## [Unreleased]

### Added
- Onglet « Guide » dans le constructeur (ouvert pour un nouveau diagnostic) : fonctionnement
  expliqué simplement avec un exemple, liste de vérification calculée sur le diagnostic,
  étapes avec accès direct aux onglets, lexique, questions fréquentes.
- Onglet « Apparence » repensé : thèmes de couleurs prêts à l'emploi, menus pour les polices
  (texte et titres), les coins et la largeur (avec valeur personnalisée), alerte de lisibilité
  (contraste), logo depuis la médiathèque (choisir ou téléverser) avec aperçu et description.
- Réglages : bouton « i » à côté de chaque réglage, qui explique simplement à quoi il sert.
- Onglet « Parcours » simplifié : étapes numérotées, réponses en cartes avec les points par
  thème (nom du thème au lieu de la clé), libellés dans toutes les langues, logique
  (conditions, sauts) et options avancées (clés, valeurs, « Je ne sais pas ») repliées.

- Aperçu ciblé dans le constructeur : l'étape en cours de modification (Parcours), l'écran
  d'accueil (Général) ou la page de résultat avec des réponses d'exemple (Résultat), avec un
  bouton « Tout le parcours ».

- « Écran d'accueil » en tête de la liste du Parcours (réglages et aperçu), image depuis la
  médiathèque ; un nouveau diagnostic a un écran d'accueil prêt à personnaliser.

### Fixed
- Constructeur : chevauchements et textes illisibles avec le zoom du navigateur ; la mise en
  page suit la place réellement disponible (aperçu déduit).
- Le constructeur ne peut plus se retrouver dans la colonne latérale (panneau fixe sous le
  titre) ; en-tête, onglets et tableau des réponses plus lisibles ; shortcode dans une boîte
  « Insertion ».
- Textes de l'éditeur d'emails non traduits en français (fichier non déclaré pour les
  traductions).

## [1.3.0] - 2026-10-14

### Added
- Bibliothèque de modèles : 5 diagnostics prêts à l'emploi (FR/EN) et écran « Créer depuis
  un modèle » (galerie, aperçu, nombre de questions, durée estimée). « Utiliser ce modèle »
  crée un brouillon modifiable ; le modèle n'est jamais modifié. Filtre `sd_templates`,
  action `sd_template_used`, commandes `wp smart-diagnostic templates` et
  `create-from-template`.
- Éditeur d'emails sans code : blocs (titre, texte, bouton, image, séparateur, espace,
  résultat / profil, scores, textes, plan d'action, recommandation, réponses), menu « Insérer
  une variable », style (logo, couleurs, police), aperçu en direct ordinateur / mobile, envoi
  d'essai, mode JSON des blocs et mode HTML avancé, 3 modèles de départ (résultat visiteur,
  notification équipe, relance). Emails adaptés aux petits écrans.
- Relance du visiteur quelques jours après sa réponse (`integrations.emails.followUp`,
  désactivée par défaut).
- Connecteur MCP facultatif (désactivé par défaut) : fonctions exposées via l'Abilities API
  de WordPress et le MCP Adapter officiel (serveur `/wp-json/smart-diagnostic/mcp`) —
  lister / lire / prévisualiser / créer / modifier des diagnostics, créer depuis un modèle,
  lister / exporter les réponses, statistiques. Lecture seule par défaut, mot de passe
  d'application, droits vérifiés à chaque action, aucune suppression, journal des actions.

### Changed
- Le diagnostic de démonstration devient un fichier de test (`tests/fixtures/demo.json`) ; le
  dossier `examples/` est retiré. `setup-local.sh` n'ajoute du contenu de test qu'avec
  `SD_TEST_HELPERS=1` : un site de travail reste vierge.

## [1.2.0] - 2026-10-14

### Added
- Modèle d'email personnalisé (visiteur et équipe) dans le constructeur : corps HTML avec
  variables ({first_name}, {profile}, {scores}, {cta}, {result_button}…), option « document
  HTML complet », aperçu avec données d'exemple, envoi d'essai.
- Les emails reprennent l'apparence du questionnaire : couleurs, polices, arrondis, logo.

## [1.1.0] - 2026-10-14

### Added
- Réglages → Emails : nom et adresse d'expéditeur, adresse de réponse, bouton « Envoyer un
  email de test », SMTP dédié facultatif (mot de passe possible via `SD_SMTP_PASSWORD`) ;
  statut d'envoi des emails (visiteur, équipe) dans le détail de chaque réponse.
- Environnement de développement : site en français (`WP_LOCALE`), compte `e2e` pour les
  tests, Mailpit pour recevoir les emails de test.

## [1.0.1] - 2026-10-14

### Fixed
- Le zip de la 1.0.0 embarquait aussi la version non préfixée de la librairie `opis`
  (dépendance mal classée dans `composer.lock`) : seule la copie préfixée est désormais
  livrée, et la release vérifie ce point.

## [1.0.0] - 2026-10-14

Première version publique.

### Added
- M6 : constructeur visuel (parcours en glisser-déposer, éditeur de chaque type de question,
  règles de calcul, formules, conditions, résultats, apparence, intégrations), onglet Test
  (simulation des réponses avec le moteur du site), onglet JSON, aperçu en direct ;
  import / export JSON et duplication de diagnostics ; librairie PHP embarquée préfixée
  (Strauss) ; traduction française du constructeur ; tests E2E de l'admin ;
  `docs/hooks.md`.
- M5 : statistiques anonymes (événements start / step_view / answer / capture / submit /
  abandon, table `sd_events`, tableau de bord avec entonnoir, abandons, profils et CTA),
  événement DOM `sd:event`, envoi au `dataLayer`, action PHP `sd_event` ; langue courante
  WPML / Polylang (`sd_current_language`) ; traduction française complète de l'interface ;
  marque blanche : réglage « Nom affiché », auteur masqué, identifiants neutres côté
  visiteur, filtre `sd_rest_namespace`.
- M4 : emails visiteur (résultat + lien) et administrateur, modèles surchargeables par le
  thème (`<thème>/smart-diagnostic/emails/`) ; webhooks signés HMAC (`X-SD-Signature`),
  mapping de champs, réessais (1 min, 5 min, 30 min), secrets hors config ; admin
  « Réponses » (filtres diagnostic / profil / CTA / dates / recherche, détail, export CSV
  protégé contre les formules, suppression) ; RGPD : durée de conservation + purge
  quotidienne, exporteur et effaceur de données personnelles WordPress, texte de politique
  de confidentialité ; filtres `sd_config`, `sd_webhook_secret`, `sd_email_headers`,
  `sd_submissions_capability`.

- M3 : API REST `smart-diagnostic/v1/submit` (nonce renouvelable, pot de miel, limitation
  par visiteur, Turnstile / reCAPTCHA v3 en option, nettoyage et validation serveur,
  recalcul systématique), table `sd_submissions` versionnée (dbDelta), consentement
  horodaté + version, UTM, IP hachée, lien unique de résultat (`?sd_result=…`, non indexé),
  formulaire après résultat, page Réglages (anti-spam), hooks `sd_submission_created`
  et `sd_submission_contact_updated`.
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

### Security
- La section `integrations` de la config (emails admin, URL de webhooks) n'est plus
  transmise au navigateur.
