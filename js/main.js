import { setHunters, startGame, update } from './game.js';
import { initKeyboard } from './input.js';
import { drawScene } from './render.js';
import { gameState, resizeCanvas } from './state.js';

function initUI() {
  document.getElementById('btn').addEventListener('click', startGame);
  document.querySelectorAll('.hs-btn').forEach((btn) => {
    btn.addEventListener('click', () => setHunters(Number(btn.dataset.n)));
  });
}

initKeyboard();
initUI();

function loop() {
  requestAnimationFrame(loop);
  if (gameState === 'playing') update();
  drawScene();
}

window.addEventListener('resize', resizeCanvas);
loop();
