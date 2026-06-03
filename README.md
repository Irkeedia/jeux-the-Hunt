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

## Classement et scores

Le jeu enregistre les **meilleurs scores** (pseudo, temps de survie, distance, nombre de prédateurs).

| Mode | Stockage |
|------|----------|
| **Production Vercel** | [Upstash Redis](https://vercel.com/marketplace?category=storage&search=redis) (classement partagé) |
| **Sans Redis / dev simple** | Mémoire serveur + secours **localStorage** dans le navigateur |

**Points** = `temps (s) × 100 + distance`

### Activer Redis sur Vercel (recommandé)

1. Dashboard Vercel → ton projet → **Storage** / **Marketplace** → **Upstash Redis**
2. Installe et lie l’intégration au projet (`UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` sont ajoutés)
3. Redéploie le projet

Sans Redis, l’API tourne en mémoire (scores perdus au redémarrage) ; le navigateur garde aussi une copie locale.

## Structure du projet

```
.
├── index.html
├── api/
│   ├── scores.js       # API GET/POST classement
│   └── lib/store.js    # Accès Redis (Upstash)
├── css/styles.css
├── js/
│   ├── main.js
│   ├── game.js
│   ├── leaderboard.js  # UI + appels API
│   └── …
├── package.json
├── vercel.json
└── README.md
```

## Développement local

**Jeu seul** (sans API scores) :

```bash
npx serve .
```

**Jeu + API + KV** (comme en production) :

```bash
npm install
npx vercel dev
```

Le pseudo est mémorisé dans le navigateur (`localStorage`). Les scores utilisent l’API si disponible, sinon le stockage local.

## Déploiement Vercel

1. Connecte le dépôt GitHub à Vercel.
2. **Framework Preset** : Other (site statique).
3. **Root Directory** : `.` (racine du repo).
4. **Build Command** : laisser vide.
5. **Output Directory** : `.` ou laisser par défaut.

Vercel sert automatiquement `index.html` à la racine du domaine.

## Licence

Projet personnel — libre d'utilisation pour apprendre et partager.
