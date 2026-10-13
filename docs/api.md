# API REST et soumissions

Base : `wp-json/smart-diagnostic/v1/`

## `GET nonce`

Renvoie `{ "nonce": "…" }`. Le front l'utilise pour renouveler un nonce expiré
(page servie depuis un cache) ; il retente alors l'envoi une fois.

## `POST submit`

| Champ           | Type    | Rôle |
|-----------------|---------|------|
| `diagnostic_id` | entier  | Diagnostic publié. |
| `answers`       | objet   | Réponses, par clé d'étape. |
| `contact`       | objet   | Champs des formulaires `inline` du parcours. |
| `consent`       | booléen | Case de consentement cochée. |
| `lang`, `utm`, `source_url` | | Langue, paramètres UTM, page d'origine (même site). |
| `nonce`         | texte   | Nonce `sd_submit`. |
| `website`       | texte   | Pot de miel : doit rester vide. |
| `captcha`       | texte   | Jeton Turnstile / reCAPTCHA si activé. |

Contrôles, dans l'ordre : pot de miel (réponse factice `200 {ok:true}` aux robots),
nonce (`403 sd_invalid_nonce`), limitation par visiteur (`429`), captcha (`403`).
Ensuite le serveur :

1. ne garde que les réponses connues de la config, converties dans le bon type
   (valeur d'option existante, nombre, texte nettoyé…) ;
2. rejoue le parcours et valide les réponses des étapes traversées (`422` + `data.errors`) ;
3. valide le contact et le consentement des formulaires du parcours ;
4. **recalcule le résultat** (`Engine\Calculator`) — rien de ce que calcule le navigateur
   n'est enregistré ;
5. enregistre et répond `201 { token, url, result }`.

## `POST submissions/{token}/contact`

Complète une soumission avec un formulaire placé **sous le résultat**
(`placement: "after_results"`). Mêmes contrôles (sans captcha).

## Lien unique

`url` = page d'origine + `?sd_result=<jeton>` (32 caractères hexadécimaux aléatoires).
La page affiche directement le résultat enregistré ; elle est marquée `noindex` et
n'expose ni email ni téléphone.

## Stockage

Table `{prefix}sd_submissions` (version dans l'option `sd_db_version`) : diagnostic, dates,
email et prénom, contact, réponses, chemin, scores, variables, profil, CTA, résultat,
consentement (horodatage + version du texte), UTM, langue, page d'origine,
empreinte HMAC de l'IP (jamais l'IP en clair), empreinte de la config.

## Hooks

```php
do_action( 'sd_submission_created', array $submission, array $config );
do_action( 'sd_submission_contact_updated', array $submission, array $config );
apply_filters( 'sd_rate_limit', int $limit );
```
