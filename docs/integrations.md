# Emails, webhooks, réponses, RGPD

## Emails

Envoyés à chaque soumission via `wp_mail` (configurez un plugin SMTP sur le site) :

- **visiteur** : son résultat et son lien personnel, si un email valide a été saisi
  (dans le parcours ou dans le formulaire sous le résultat) ; un seul envoi par soumission ;
- **administrateur** : la soumission complète, à `integrations.emails.admin.to`
  (par défaut l'email d'administration du site).

```json
"integrations": {
  "emails": {
    "user":  { "enabled": true, "subject": { "fr": "Votre résultat, {first_name}" } },
    "admin": { "enabled": true, "to": ["ventes@exemple.fr"], "template": "admin" }
  }
}
```

Modèles : `templates/emails/user.php` et `admin.php`. Pour les personnaliser, copiez-les
dans `<thème>/smart-diagnostic/emails/` ; la variable `$sd` donne le profil, les scores,
les textes, le plan d'action, le CTA, le lien du résultat et les réponses.
`template` permet d'utiliser un autre modèle (`emails/<nom>.php`). En-têtes : filtre
`sd_email_headers`.

### Apparence

Les emails (modèles par défaut, cadre et blocs des modèles personnalisés) reprennent
l'apparence du questionnaire (onglet **Apparence**) : couleurs, polices (avec repli sur
Arial / Helvetica, car beaucoup de messageries n'ont pas les polices du site), arrondi des
angles (en `px`) et logo.

### Éditeur d'emails

Constructeur → **Intégrations**, pour l'email au visiteur, à l'équipe et la relance. Trois
modes, au choix :

- **Modèle par défaut** : construit à partir du résultat, sans rien saisir ;
- **Éditeur visuel** (sans code) : une liste de blocs à ajouter, déplacer, dupliquer ou
  supprimer — titre, texte, bouton, image, séparateur, espace, et blocs remplis avec le
  résultat du visiteur : résultat / profil, scores, textes personnalisés, plan d'action,
  recommandation / appel à l'action, tableau des réponses. Le menu **Insérer une variable**
  ajoute le prénom, une réponse, un score… au curseur. **Style** : logo, couleurs, police
  (vide = l'apparence du questionnaire). **Partir d'un modèle** : résultat visiteur,
  notification équipe, relance. **Modifier en JSON** affiche les blocs en JSON (aller vite,
  coller un contenu préparé avec une IA) et revient à l'éditeur visuel sans perte ;
- **HTML (avancé)** : corps HTML libre, pré-rempli avec le rendu des blocs. Revenir à
  l'éditeur visuel abandonne les modifications HTML (les blocs sont conservés).

**Aperçu** (données d'exemple), sur ordinateur ou mobile, mis à jour à chaque modification,
et **M'envoyer cet email**. Les emails sont construits en tableaux avec styles en ligne et
s'adaptent aux petits écrans (compatibles avec les principales messageries).

| Variable | Contenu |
|---|---|
| `{first_name}`, `{email}`, `{diagnostic}`, `{date}` | Prénom, email, nom du diagnostic, date |
| `{profile}`, `{profile_text}` | Nom et texte du profil |
| `{scores}`, `{texts}`, `{actions}`, `{answers}` | Barres de scores, textes conditionnels, plan d'action, tableau des réponses |
| `{cta}`, `{result_button}`, `{result_link}` | Bouton d'appel à l'action, bouton et adresse de la page de résultat |
| `{score:axe}`, `{answer:question}`, `{var:cle}`, `{contact:champ}` | Valeurs ponctuelles |

En mode HTML, le corps est placé dans le cadre du plugin (`templates/emails/custom.php`,
surchargeable) ; l'option « Document HTML complet » le remplace entièrement (`<html>`,
`<head>`, `<style>` autorisés). Le HTML saisi est filtré et les valeurs saisies par les
visiteurs sont toujours échappées.

Format JSON (`integrations.emails.user`, `.admin` ou `.followUp`) :

```json
"user": {
  "subject": "Votre résultat, {first_name}",
  "style": { "primary": "#ff5500", "logo": "https://exemple.fr/logo.png" },
  "blocks": [
    { "type": "heading", "text": "Bonjour {first_name}", "size": "large" },
    { "type": "text", "text": "Merci !\n\nVoici **votre résultat** :" },
    { "type": "profile" },
    { "type": "scores" },
    { "type": "button", "text": "Voir mon rapport", "url": "{result_link}", "align": "center" }
  ]
}
```

Types de blocs : `heading` (`text`, `size`), `text` (`text` ; ligne vide = paragraphe,
`**gras**`), `button` (`text`, `url` : https://, mailto: ou `{result_link}`), `image`
(`url`, `alt`, `link`, `width`), `divider`, `spacer` (`size`), `profile`, `scores`,
`texts`, `actions`, `cta`, `answers` ; `align` : `left`, `center`, `right`. Priorité :
`body` (HTML), puis `blocks`, puis le modèle par défaut.

### Relance

`integrations.emails.followUp` : `{ "enabled": true, "delayDays": 3 }` envoie au visiteur
(s'il a laissé son email) un email quelques jours après sa réponse, par une tâche planifiée
de WordPress (WP-Cron : une tâche cron système est recommandée sur un site peu visité). Sans
contenu, le modèle de départ « relance » est utilisé. Pas d'envoi si la réponse a été
effacée entre-temps ou si la relance a été désactivée. Son statut apparaît dans le détail
de la réponse.

### Réglages → Emails

- **Expéditeur** (nom, adresse) et **adresse de réponse** : vides = l'expéditeur défini par
  WordPress ou par le plugin SMTP. Utiliser une adresse du domaine du site (SPF / DKIM).
- **Mode d'envoi par défaut** : `wp_mail`, donc le plugin SMTP du site (WP Mail SMTP,
  FluentSMTP…) s'il y en a un — rien à configurer de plus.
- **SMTP dédié** (facultatif) : serveur, port, chiffrement (TLS / SSL / aucun),
  identifiant, mot de passe. Il ne concerne que les emails des diagnostics et passe par
  PHPMailer directement (il fonctionne donc même si un plugin SMTP remplace `wp_mail`).
  Mot de passe : de préférence dans `wp-config.php` :
  ```php
  define( 'SD_SMTP_PASSWORD', '…' );
  ```
- **Envoyer un email de test** : même chemin que les vrais emails ; le résultat (ou l'erreur
  du serveur) s'affiche dans la page.
- **Statut d'envoi** : le détail de chaque réponse indique, pour l'email au visiteur et à
  l'équipe, « Envoyé à … le … (mode d'envoi) » ou « Échec … » avec la raison.

En développement, Mailpit (http://127.0.0.1:8025) reçoit tous les emails envoyés par le
SMTP dédié réglé sur `mailpit`, port `1025`, sans chiffrement.

## Webhooks

```json
"integrations": {
  "webhooks": [
    {
      "key": "crm",
      "url": "https://hook.make.com/xxxx",
      "events": ["submit", "capture"],
      "mapping": { "email": "contact.email", "score": "score.axe_1", "profil": "profile", "lien": "result_url" }
    }
  ]
}
```

- `submit` : à la soumission ; `capture` : quand un formulaire sous le résultat est envoyé.
- Sans `mapping`, la soumission complète est envoyée (contact, consentement, réponses,
  scores, variables, profil, CTA, UTM, lien du résultat).
- Chemins du mapping : `contact.*`, `answer.*`, `score.*`, `var.*`, `utm.*`, ou `id`,
  `diagnostic_id`, `token`, `created_at`, `email`, `first_name`, `profile`, `cta`,
  `consent`, `consent_at`, `consent_version`, `lang`, `result_url`.
- **Signature** : le secret se saisit dans la boîte « Secrets des webhooks » du diagnostic
  (jamais dans le JSON). En-tête `X-SD-Signature: sha256=<HMAC-SHA256 du corps>`, plus
  `X-SD-Event`, `X-SD-Delivery` et `X-SD-Timestamp`.
- **Réessais** : en cas d'échec (réseau ou code hors 2xx), nouvel essai après 1 min, 5 min
  puis 30 min (WP-Cron). L'état est visible dans le détail de la réponse.

Vérifier la signature (Node.js) :

```js
const expected = 'sha256=' + crypto.createHmac( 'sha256', SECRET ).update( rawBody ).digest( 'hex' );
```

## Réponses (admin)

Menu du plugin → **Réponses** : filtres par diagnostic, profil, CTA, dates et recherche
(nom / email), détail complet, suppression unitaire ou groupée, **export CSV** des réponses
filtrées (séparateur `;`, UTF-8, libellés des réponses, cellules commençant par `=`, `+`,
`-` ou `@` neutralisées). Capacité requise : `manage_options` (filtre
`sd_submissions_capability`).

## RGPD

- Consentement horodaté avec la version du texte accepté.
- **Durée de conservation** (Réglages → Confidentialité) : les soumissions plus anciennes
  sont supprimées chaque jour ; 0 = conservation jusqu'à suppression.
- **Outils WordPress** → Exporter / Effacer les données personnelles : les soumissions
  liées à l'email sont exportées ou supprimées.
- Un texte est proposé pour la politique de confidentialité (Réglages → Confidentialité).
- L'IP n'est jamais stockée en clair (empreinte HMAC).
