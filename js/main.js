import { setHunters, startGame, update } from './game.js';
import { initKeyboard, makeJoy } from './input.js';
import { getPlayerName, initLeaderboardUI } from './leaderboard.js';
import { drawScene } from './render.js';
import { gameState, joy, resizeCanvas, setJoy } from './state.js';
import { initUI, showGameplay } from './ui.js';

function boot() {
  initKeyboard();

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
  });

  document.getElementById('btn-retry')?.addEventListener('click', () => {
    try {
      startGame();
      showGameplay();
    } catch (err) {
      console.error('Impossible de relancer:', err);
    }
  });

  initLeaderboardUI();
}

boot();

function loop() {
  requestAnimationFrame(loop);
  if (gameState === 'playing') update();
  drawScene();
}

window.addEventListener('resize', resizeCanvas);
loop();
