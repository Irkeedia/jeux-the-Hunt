import { setHunters, startGame, update } from './game.js';
import { initKeyboard } from './input.js';
import { drawScene } from './render.js';
import { gameState, resizeCanvas } from './state.js';

initKeyboard();

window.setHunters = setHunters;
window.startGame = startGame;

function loop() {
  requestAnimationFrame(loop);
  if (gameState === 'playing') update();
  drawScene();
}

window.addEventListener('resize', resizeCanvas);
loop();
