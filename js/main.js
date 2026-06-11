import { setHunters, startGame, update } from './game.js';
import { initKeyboard, initMouseControls, makeJoy } from './input.js';
import { getPlayerName, initLeaderboardUI } from './leaderboard.js';
import { drawScene } from './render.js';
import { gameState, gfxLow, joy, resizeCanvas, setGameMode, setGameState, setGfxLow, setJoy, setMapTheme } from './state.js';
import { initUI, showGameplay, showMenu } from './ui.js';

function boot() {
  initKeyboard();
  initMouseControls();

  if (!joy) setJoy(makeJoy('joy-main'));

  const nameMenu = document.getElementById('player-name-menu');
  const nameDead = document.getElementById('player-name');
  const saved = getPlayerName();
  if (saved) {
    if (nameMenu) nameMenu.value = saved;
    if (nameDead) nameDead.value = saved;
  }

  initUI({
    onPlay: () => {
      try {
        if (nameMenu?.value) {
          if (nameDead) nameDead.value = nameMenu.value.trim();
        }
        startGame();
        showGameplay();
      } catch (err) {
        console.error('Impossible de démarrer la partie:', err);
      }
    },
    onHuntersChange: setHunters,
    onModeChange: setGameMode,
    onMapChange: setMapTheme,
    onHome: () => {
      setGameState('menu');
      showMenu();
    },
  });


  initLeaderboardUI();
}

boot();

// Pas de temps FIXE : la simulation tourne toujours à 60 Hz, quelle que soit
// la fréquence de l'écran (60, 90, 120 Hz...). Sans ça, le jeu accélère sur
// les écrans rapides et devient instable. Le rendu, lui, suit l'écran.
const STEP_MS = 1000 / 60;
const MAX_STEPS = 5; // borne anti « rattrapage » après un gros ralenti / pause
let lastT = performance.now();
let acc = 0;

// Surveillance du temps par image (moyenne lissée) pour ajuster la qualité.
let smoothMs = STEP_MS;
let lowStreak = 0;
let highStreak = 0;

function loop(now) {
  requestAnimationFrame(loop);

  let dt = now - lastT;
  lastT = now;
  // On borne les pics anormaux (onglet caché, GC) pour éviter une avance brutale.
  if (dt > 250) dt = 250;
  if (dt < 0) dt = 0;

  // Détection de fréquence pour la qualité (basée sur l'intervalle d'affichage).
  if (dt > 0) smoothMs += (dt - smoothMs) * 0.1;
  if (smoothMs > 22) {
    lowStreak++;
    highStreak = 0;
  } else if (smoothMs < 18) {
    highStreak++;
    lowStreak = 0;
  }
  if (!gfxLow && lowStreak > 30) setGfxLow(true);
  if (gfxLow && highStreak > 150) setGfxLow(false);

  if (gameState === 'playing') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP_MS && steps < MAX_STEPS) {
      update();
      acc -= STEP_MS;
      steps++;
    }
    // Si on a tapé le plafond (machine trop lente), on jette le retard accumulé.
    if (steps === MAX_STEPS) acc = 0;
  } else {
    acc = 0;
  }

  drawScene();
}

window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(loop);

// Service worker : rend le jeu installable et jouable hors-ligne.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('Service worker non enregistré:', err);
    });
  });
}
