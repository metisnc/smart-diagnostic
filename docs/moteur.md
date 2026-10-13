# Moteur de calcul

Le même calcul existe en JS (`assets/src/engine/`, aperçu instantané) et en PHP
(`src/Engine/`, source de vérité côté serveur). Les fixtures de `tests/fixtures/parity/`
sont jouées par les deux suites de tests : toute évolution du moteur passe par une fixture.

## Ordre du calcul

1. **Chemin** : le parcours est rejoué à partir des réponses (`showIf`, `jumpTo`).
   Seules les réponses des étapes traversées comptent : une réponse donnée puis
   contournée par un retour arrière est ignorée.
2. **Scores** par axe :
   1. valeur `base` de l'axe (0 par défaut) ;
   2. points des options choisies (`option.scores`) ;
   3. règles de `scoring.rules`, **dans l'ordre**, chacune seulement si son `when` est vrai
      (les conditions voient les scores intermédiaires) ;
   4. plafonnement final entre `min` (0) et `max` (100) de l'axe.
3. **Variables** (`variables[]`), dans l'ordre : chacune peut utiliser les précédentes.
4. **Résultats** : profil et CTA = premier élément dont la condition est vraie, par
   `priority` décroissante puis ordre d'écriture ; textes et actions = tous ceux qui
   correspondent, dans ce même ordre.

## Règles de scoring

| `type`       | Effet |
|--------------|-------|
| `range`      | Points selon la plage où tombe la valeur numérique de `question` (`min` inclus, `max` exclu ; la première plage qui correspond l'emporte). |
| `count`      | Points selon le nombre d'options cochées (réponses de sortie exclues). |
| `condition`  | Ajoute `points` : un nombre, ou une expression (`"count.q2 * 3"`). |
| `multiplier` | Multiplie le score de l'axe par `factor`. |
| `cap`        | Plafond / plancher intermédiaire (`min`, `max`). |

## Réponses de sortie (« Je ne sais pas »)

Une option avec `exit` n'apporte pas ses propres points ; `exit.mode` décide :

| `mode`    | Points ajoutés pour chaque axe noté par les autres options |
|-----------|-------------------------------------------------------------|
| `ignore`  | aucun (par défaut) |
| `neutral` | moyenne des points des autres options |
| `min`     | minimum des points des autres options |
| `fixed`   | `exit.value` |

Une question répondue uniquement par une sortie est ignorée par les règles `range`.

## Expressions

Opérateurs `+ - * / %`, comparaisons `== != < <= > >=`, `and` / `or` / `not`
(ou `&& || !`), ternaire `a ? b : c`, parenthèses.

Chemins : `answer.<clé>` (agrégat pour `multi_amount`, sous-champ via `answer.<clé>.<champ>`),
`count.<clé>`, `score.<axe>`, `var.<clé>`, `contact.<champ>`.

Fonctions : `min`, `max`, `abs`, `round(x, décimales)`, `floor`, `ceil`, `clamp(x, min, max)`,
`sum`, `avg`, `count`, `if(cond, a, b)`, `isAnswered(x)`.

Règles communes JS / PHP :

- une valeur vide ou non numérique vaut 0 dans un calcul ; diviser par 0 donne 0 ;
- `==` compare des nombres si les deux côtés sont numériques, sinon des textes ;
- `'0'` est vrai, une liste vide est fausse ;
- `round` arrondit « au plus loin de zéro » (`round(-1.5) = -2`, `round(1.005, 2) = 1.01`).

## Conditions

```json
{ "all": [ … ] }  { "any": [ … ] }  { "not": { … } }  { "expr": "score.x >= 50" }
{ "left": "answer.q1", "op": "eq", "value": "a" }
```

`left` : un chemin, ou `weakestAxis` / `strongestAxis` (axe le plus faible / fort, en
proportion de son échelle). `op` : `eq`, `neq`, `gt`, `gte`, `lt`, `lte`,
`between` (`value: [min, max]`, bornes incluses), `in`, `notIn`, `contains`,
`notContains`, `answered`, `empty`. Avec une réponse à choix multiples, `eq` est vrai
si l'une des valeurs cochées correspond.
