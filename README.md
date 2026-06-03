# THE HUNT

Jeu de survie et de poursuite dans l'espace. Tu incarnes une cible traquée par un ou plusieurs prédateurs : fuis le plus longtemps possible à travers des biomes procéduraux, des labyrinthes et des pièges cosmiques.

## Jouer en ligne

Déploie le dossier racine sur [Vercel](https://vercel.com) (site statique). La page d'accueil est `index.html`.

## Contrôles

| Plateforme | Actions |
|------------|---------|
| **Mobile** | Joystick tactile en bas de l'écran |
| **Clavier** | `Z/Q/S/D` ou flèches directionnelles |

Au menu, choisis le nombre de prédateurs (1 à 3), puis clique sur **[ FUIR ]**.

## Mécaniques

- **Boost bleu** — accélération temporaire
- **Téléporteur violet** — téléporte ailleurs sur la carte
- **Trou noir** — attire tout ; trop proche = mort
- **Champ vert** — repousse les prédateurs
- **Boue** — ralentit le joueur
- **Bonus** — leurre, invisibilité, vitesse permanente
- **Camping** — rester dans une petite zone déclenche une onde destructrice

## Structure du projet

```
.
├── index.html          # Point d'entrée (requis pour Vercel)
├── css/
│   └── styles.css      # Interface et HUD
├── js/
│   ├── main.js         # Boucle de jeu et initialisation
│   ├── config.js       # Constantes et biomes
│   ├── state.js        # État global (canvas, joueur, monde)
│   ├── utils.js        # Utilitaires (RNG, biomes, particules)
│   ├── world.js        # Génération procédurale et collisions
│   ├── input.js        # Joystick et clavier
│   ├── game.js         # Logique de jeu (update, mort, démarrage)
│   └── render.js       # Rendu Canvas et bloom
├── vercel.json
└── README.md
```

## Développement local

Aucune installation requise. Sert le projet avec un serveur HTTP local (les modules ES nécessitent HTTP, pas `file://`) :

```bash
npx serve .
# ou
python3 -m http.server 8080
```

Puis ouvre `http://localhost:8080`.

## Déploiement Vercel

1. Connecte le dépôt GitHub à Vercel.
2. **Framework Preset** : Other (site statique).
3. **Root Directory** : `.` (racine du repo).
4. **Build Command** : laisser vide.
5. **Output Directory** : `.` ou laisser par défaut.

Vercel sert automatiquement `index.html` à la racine du domaine.

## Licence

Projet personnel — libre d'utilisation pour apprendre et partager.
