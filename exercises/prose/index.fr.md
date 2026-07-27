---
title: "Prose"
description: "La même note, en français, pour exercer le sélecteur de langue et les unités de taille traduites."
date: 2026-07-27
images:
  onDemand: true
---

Cette page existe pour vérifier ce que la version anglaise ne peut pas
vérifier : le sélecteur de langue, les chaînes traduites du pied de page, et
surtout les unités de taille de fichier.

![Une courbe de papier sur un fond uni](images/paper-curves.png "Planche I — Courbes, chargée immédiatement")

## Les unités, et pourquoi elles comptent

Le crochet de lien annonce le poids d'un téléchargement avant que le lecteur ne
le demande. Cette annonce ne sert à rien si elle reste en anglais : un lecteur
qui décide s'il peut se permettre un fichier doit lire `Ko`, pas `KB`.

[Les données d'allocation](allowances.csv) pèsent quelques kilo-octets, et
[un échantillon de 96 pixels](fixtures/swatch.png) quelques centaines d'octets —
les deux seuils sont donc exercés ici. Le séparateur décimal doit être une
virgule, pas un point, ce qui relève de `lang.FormatNumber` et non des chaînes
de traduction.

Le seuil du méga-octet n'est pas couvert : il faudrait un fichier de plus d'un
méga-octet, et `tools/check-exercises.py` refuse justement de publier un tel
fichier.

> La recherche concerne des pays en développement, et il serait impoli de
> consommer toute leur bande passante à cause d'inefficacités du site.

![Un plan de travail éditorial](images/editorial-workspace.png "Planche II — Atelier, différée")

## Ce qui reste à vérifier à l'œil

Le français allonge le texte d'environ quinze pour cent par rapport à
l'anglais. Les titres composés en Instrument Serif jusqu'à 96 pixels sont donc
l'endroit où un débordement apparaîtra en premier, et cette page est faite pour
le rendre visible.
