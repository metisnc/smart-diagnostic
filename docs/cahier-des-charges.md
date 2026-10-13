Contexte & objectif

Tu es un développeur WordPress senior (PHP 8.1+, JS moderne). Tu vas créer un plugin WordPress en marque blanche nommé smart-diagnostic : un moteur de questionnaire de diagnostic interactif (type « lead magnet ») qui mène l'utilisateur, question par question, jusqu'à un rapport personnalisé et un appel à l'action.

Le plugin ne contient aucun contenu métier : ni questions, ni sections, ni axes d'analyse, ni textes de résultat, ni marque. Tout est défini par l'administrateur de chaque site (questions, réponses, parcours, règles de calcul, résultats, design, textes). Le même plugin doit pouvoir servir un diagnostic business, un quiz produit, un audit RH, un test d'éligibilité, etc.

Briques génériques que le moteur doit permettre de composer
Écran d'accueil : titre, accroche, liste de bénéfices, visuel ou aperçu de résultat, bouton de démarrage, badges — tous optionnels et éditables.
Parcours : une étape par écran, mobile-first, regroupée en sections libres (nombre et noms définis par l'admin) avec :
barre de progression, compteur « n / total », nom de section (chacun activable) ;
messages d'encouragement selon l'avancement (éditables) ;
bouton Retour, sauvegarde automatique de la progression et reprise ;
variables de personnalisation dans les textes ({first_name}, {answer:cle}…) ;
écrans intermédiaires libres (texte, citation, image, témoignage, encart promo) ;
cartes insérées automatiquement toutes les N réponses (optionnel) ;
logique conditionnelle / embranchements : afficher, masquer ou sauter des étapes selon les réponses précédentes.
Formulaire de capture (optionnel, position configurable : avant ou après les résultats) : champs définis par l'admin, consentement RGPD.
Écran de transition avant résultat (optionnel, durée et étapes éditables).
Résultat construit à partir de blocs configurables :
scores par axes définis par l'admin (nombre et noms libres), affichés en radar, barres ou jauges ;
profils / niveaux / catégories de résultat attribués par règles ;
textes conditionnels (axe le plus faible ou le plus fort, seuils, combinaisons de réponses) ;
valeurs calculées à partir de formules (ex. projection, total, écart) et graphique optionnel ;
plan d'action / recommandations conditionnelles ;
CTA recommandé choisi par règles, avec UTM ;
envoi du résultat par email et lien unique de consultation.
Exigences techniques
Architecture
Plugin standard : smart-diagnostic/smart-diagnostic.php, namespace PHP SmartDiagnostic\, autoload PSR-4 (Composer), uninstall.php.
Front : bloc Gutenberg + shortcode [smart_diagnostic id="..."] qui montent une app JS (React via @wordpress/scripts, ou Preact/vanilla si plus léger — justifie ton choix). Pas de jQuery.
Plusieurs diagnostics par site : Custom Post Type sd_diagnostic ; config stockée en JSON, validée par un JSON Schema versionné (schema/diagnostic.schema.json) avec migrations entre versions.
Import / export JSON et duplication d'un diagnostic (pour réutiliser un parcours d'un site à l'autre).
Marque blanche : aucune mention du plugin côté visiteur, nom du plugin et du menu admin personnalisables (constante ou filtre), textes de l'interface entièrement traduisibles/surchargeables.
Modèle de configuration (à concevoir de façon générique)
sections[] : key, label (libres).
steps[] : kind = question | content | form.
Types de question : text, textarea, email, phone, single, multi, dropdown, number, amount (devise, période), multi_amount (n champs → agrégat), slider, scale (1–N), yes_no, image_choice, date.
Options avec value, label, image/icône facultative, et valeur de score par axe.
Réponses de sortie (« Je ne sais pas »…) avec traitement configurable.
help, placeholder, required, validation, showIf, jumpTo.
axes[] : key, label, base, min, max (libres).
scoring : moteur de règles déclaratif — points par option, par plage numérique, par nombre d'options cochées, multiplicateurs, plafonds, conditions combinées (ET/OU) ; clamp final.
variables[] : valeurs dérivées via formules sûres (petit évaluateur d'expressions sans eval, ex. answer.target / answer.current), réutilisables dans les textes et règles.
outcomes : profils/niveaux, textes conditionnels, plans d'action, CTA — chacun avec ses conditions.
ui : thème (couleurs, typo, arrondis via CSS custom properties), logo, textes de l'interface, mentions légales.
Multilingue : chaque texte peut avoir plusieurs langues ; sélecteur de langue optionnel ; compatible WPML/Polylang.
Calcul & sécurité
Moteur de scoring en JS (aperçu instantané) et en PHP (source de vérité) sur la même config ; tests de parité sur des fixtures.
Soumission via REST API wp-json/smart-diagnostic/v1/submit : nonce, validation/sanitization selon le schéma, rate limiting, honeypot, Turnstile/reCAPTCHA en option. Recalcul serveur systématique.
Stockage & leads
Table {$wpdb->prefix}sd_submissions (via dbDelta, versionnée) : diagnostic_id, date, champs de contact, réponses, variables, scores, résultat, consentement + version du texte, UTM, langue, IP hashée.
Admin « Réponses » : liste filtrable (diagnostic, date, profil, CTA), détail, export CSV, suppression.
RGPD : consentement horodaté, durée de conservation + purge cron, intégration aux exporteurs/effaceurs de données personnelles WordPress.
Intégrations
Emails utilisateur et admin via wp_mail, templates éditables et surchargeables par le thème.
Webhooks sortants configurables par diagnostic (URL, secret HMAC, mapping de champs) pour CRM / Make / Zapier / n8n, avec réessais.
Événements (démarrage, étape vue, réponse, capture, soumission, abandon + dernière étape) → tableau de bord d'entonnoir ; hooks do_action('sd_event', ...) pour GA4 / Meta Pixel.
Hooks et filtres PHP/JS documentés pour étendre le moteur (types de question, blocs de résultat, intégrations).
Admin / éditeur
Phase 1 : éditeur JSON avec validation en direct et aperçu.
Phase 2 : constructeur visuel — sections et étapes en drag & drop, formulaire par type de question, éditeur de règles de scoring et de conditions, éditeur de résultats, aperçu temps réel, mode test (simuler des réponses et voir le résultat).
Front / UX
Mobile-first, accessible WCAG 2.1 AA, navigation clavier, prefers-reduced-motion.
Option « passage automatique » après un choix unique, lettres A, B, C… sur les options.
Graphiques SVG légers sans grosse librairie.
Assets chargés uniquement là où le bloc est présent ; bundle JS < 100 ko gzip visé.
Résultat imprimable / exportable en PDF (CSS print).
Qualité
PHPCS (WordPress Coding Standards), PHPStan niveau 6+, ESLint/Prettier.
Tests : PHPUnit, Jest, Playwright (parcours complet sur le WordPress local).
GitHub Actions : lint + tests sur push/PR, zip du plugin en artefact sur les tags v*.
README.md (installation, format JSON documenté), CHANGELOG.md, semver.
Environnement local
docker-compose.yml (WordPress + MariaDB + phpMyAdmin + WP-CLI, plugin monté en volume) et .wp-env.json, plus bin/setup-local.sh qui installe WordPress, active le plugin, crée une page de test et importe l'exemple.
Documente aussi dans le README l'installation de Docker et le lancement sur une VM Linux vierge.
VM de test (dédiée au projet)
Adresse IP : 10.185.10.155
Accès SSH : utilisateur vscode — mot de passe fourni hors repo (voir CLAUDE.local.md, non versionné).
Cette VM t'est entièrement dédiée : tu as carte blanche (sudo, installation de paquets, Docker, configuration système, reset complet si besoin).
Tâches attendues sur la VM :
Dès la première connexion, installer une clé SSH et l'utiliser ensuite à la place du mot de passe.
Installer Docker + Docker Compose, Git, PHP CLI, Composer, Node LTS.
Cloner le repo, lancer l'environnement WordPress, rendre le site accessible sur http://10.185.10.155 (admin WP : identifiants générés, stockés dans un .env non versionné sur la VM).
Ajouter un script bin/deploy-test.sh qui met à jour la VM depuis la branche en cours (pull, build, activation du plugin, import de l'exemple) et le lancer à chaque fin de milestone.
Lancer les tests Playwright contre http://10.185.10.155.
Ne jamais écrire les identifiants dans un fichier versionné, un commit, une issue ou une PR. Ajoute CLAUDE.local.md et .env au .gitignore.
Contenu d'exemple

Fournis seulement un petit exemple neutre examples/demo.json (5–8 questions de types variés, 2 sections, 2 axes, 1 condition, 2 profils de résultat, 1 CTA) servant à tester le moteur. Pas de contenu métier réaliste : les vrais questionnaires seront saisis par nous via l'admin ou l'import JSON.

Méthode de travail attendue
Avant de coder : propose l'arborescence du repo, le JSON Schema et le plan des milestones. Attends ma validation.
Une branche + une PR par milestone, commits conventionnels, issues GitHub pour le reste à faire.
À la fin de chaque milestone : résumé, comment tester en local, points ouverts.

Milestones

M0 — Squelette plugin, outillage, CI, Docker / wp-env, README.
M1 — JSON Schema + CPT + bloc/shortcode + parcours front (tous types, progression, retour, sauvegarde, conditions).
M2 — Moteur de règles et de formules JS + PHP, axes, résultats + tests de parité.
M3 — Formulaire de capture, REST sécurisé, stockage, page de résultat, lien unique.
M4 — Emails, webhooks, admin Réponses + export CSV, RGPD.
M5 — Analytics / entonnoir, multilingue, marque blanche.
M6 — Constructeur visuel admin, import/export, E2E Playwright, release.

Commence par l'étape 1.