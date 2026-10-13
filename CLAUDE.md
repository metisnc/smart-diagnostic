# Consignes projet

- Cahier des charges : `docs/cahier-des-charges.md`. Plan validé : README (milestones).
- Le propriétaire n'est pas développeur : décider les choix techniques soi-même, expliquer en français simple.
- Une branche + une PR par milestone (`m<N>-<sujet>`), commits conventionnels, issues pour le reste à faire.
- Les tests tournent sur la VM de test (accès dans `CLAUDE.local.md`, non versionné) et en CI, le moins possible en local.
- Ne jamais écrire d'identifiants dans un fichier versionné, un commit, une issue ou une PR.
- Moteur : toute règle de calcul existe en JS **et** en PHP ; ajouter une fixture dans `tests/fixtures/parity/` pour chaque cas.
- Hooks publics préfixés `sd_`, namespace PHP `SmartDiagnostic\`, text domain `smart-diagnostic`.
- Avant de pousser : `composer lint && composer analyse && composer test`, `npm run lint && npm test && npm run build`.
