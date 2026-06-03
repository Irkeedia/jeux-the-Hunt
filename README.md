# THE HUNT

Jeu de survie et de poursuite dans l'espace. Tu incarnes une cible traquée par un ou plusieurs prédateurs : fuis le plus longtemps possible à travers des biomes procéduraux, des labyrinthes et des pièges cosmiques.

## Jouer en ligne

Déploie le dossier racine sur [Vercel](https://vercel.com) (site statique). La page d'accueil est `index.html`.

## Contrôles

| Plateforme | Actions |
|------------|---------|
| **Mobile** | Joystick tactile en bas de l'écran |
| **PC souris** | Maintiens clic gauche et vise la direction où fuir |
| **PC clavier** | `Z/Q/S/D`, `W/A/S/D` ou flèches directionnelles |
| **Menu PC** | `Entrée` ou `Espace` pour lancer / relancer |

Au menu, choisis le nombre de prédateurs (1 à 3), puis clique sur **[ FUIR ]**.

## Mécaniques

- **Boost bleu** — accélération temporaire
- **Téléporteur violet** — téléporte ailleurs sur la carte
- **Trou noir** — attire tout ; trop proche = mort
- **Champ vert** — repousse les prédateurs
- **Boue** — ralentit le joueur
- **Bonus** — leurre, invisibilité, vitesse permanente
- **Camping** — rester dans une petite zone déclenche une onde destructrice

## Classement et scores

Le jeu enregistre les **meilleurs scores** (pseudo, temps de survie, distance, nombre de prédateurs).

| Mode | Stockage |
|------|----------|
| **Navigateur** | IndexedDB, une petite base intégrée au navigateur |

**Points** = `temps (s) × 100 + distance`

Le classement ne nécessite pas de serveur : chaque navigateur garde ses records avec IndexedDB. Le pseudo est mémorisé pour éviter de le retaper.

## Structure du projet

```
.
├── index.html
├── css/styles.css
├── js/
│   ├── main.js
│   ├── game.js
│   ├── leaderboard.js  # Classement IndexedDB
│   └── …
├── vercel.json
└── README.md
```

## Développement local

```bash
npx serve .
```

Les scores sont enregistrés par le navigateur via IndexedDB.

## Déploiement Vercel

1. Connecte le dépôt GitHub à Vercel.
2. **Framework Preset** : Other (site statique).
3. **Root Directory** : `.` (racine du repo).
4. **Build Command** : laisser vide.
5. **Output Directory** : `.` ou laisser par défaut.

Vercel sert automatiquement `index.html` à la racine du domaine.

## Licence

Projet personnel — libre d'utilisation pour apprendre et partager.
