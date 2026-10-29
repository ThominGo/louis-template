# Studio LT

App web installable pour créer les posts et stories Instagram de Louis Thomson à partir des templates Figma.

- 8 templates (post 4:5 et story 9:16), mise en page en auto layout : lignes et blocs suivent le texte
- Import photo ou vidéo depuis le téléphone, cadrage au doigt et zoom
- Effets : noir et blanc, dégradé orange (intensité et hauteur), contraste
- Export PNG ou vidéo, avec la feuille de partage du téléphone pour enregistrer dans Photos

## Mise en ligne
Settings > Pages > Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.

## Mise à jour
Après chaque modification, change `VERSION` dans `sw.js` pour que les téléphones récupèrent la nouvelle version.

## Ajouter un template
Les templates sont dans `js/templates.js` : une fonction de dessin par template, et une entrée dans `TEMPLATES`.

Police : General Sans (Indian Type Foundry, licence Fontshare).
