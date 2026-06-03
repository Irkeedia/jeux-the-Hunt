import { CAM_Y_OFFSET, GLOW_SCALE } from './config.js';

export const canvas = document.getElementById('c');
export const ctx = canvas.getContext('2d');
export let W = (canvas.width = window.innerWidth);
export let H = (canvas.height = window.innerHeight);

export const glowCanvas = document.createElement('canvas');
export const gctx = glowCanvas.getContext('2d');

export function resizeGlow() {
  glowCanvas.width = Math.max(1, Math.floor(W * GLOW_SCALE));
  glowCanvas.height = Math.max(1, Math.floor(H * GLOW_SCALE));
}
resizeGlow();

export function resizeCanvas() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  resizeGlow();
}

export let gameState = 'menu';

export function setGameState(value) {
  gameState = value;
}

export function setHunterCount(n) {
  hunterCount = n;
}

export function setJoy(value) {
  joy = value;
}

export let elapsed = 0;
export let frameCount = 0;
export let distance = 0;
export const cam = { x: 0, y: 0 };
export let shake = 0;

export function resetTimers() {
  elapsed = 0;
  frameCount = 0;
  distance = 0;
  shake = 0;
  powTimer = 0;
  waveWarning = 0;
  campTriggers = 0;
}

export function setShake(v) {
  shake = v;
}

export function setPowTimer(v) {
  powTimer = v;
}

export function tickFrame() {
  frameCount++;
  elapsed += 1 / 60;
}

export function setDistance(v) {
  distance = v;
}

export function setDecoy(value) {
  decoy = value;
}

export function setWaveWarning(value) {
  waveWarning = value;
}

export function bumpCampTriggers() {
  campTriggers++;
}

export function clearWorld() {
  hunters.length = 0;
  particles.length = 0;
  obstacles.length = 0;
  specials.length = 0;
  generatedCells.clear();
  generatedMazes.clear();
  decoy = null;
  campHistory.length = 0;
  shockwaves.length = 0;
}

export function resetPlayer() {
  player.wx = 0;
  player.wy = 0;
  player.vx = 0;
  player.vy = 0;
  player.angle = -Math.PI / 2;
  player.dead = false;
  player.trail.length = 0;
  player.boost = 0;
  player.invis = 0;
  player.inMud = false;
  player.baseMAX = 7.2;
  player.MAXSP = 7.2;
  cam.x = 0;
  cam.y = 0;
}

export const player = {
  wx: 0,
  wy: 0,
  vx: 0,
  vy: 0,
  angle: -Math.PI / 2,
  r: 11,
  ACCEL: 0.45,
  FRICTION: 0.91,
  MAXSP: 7.2,
  baseMAX: 7.2,
  boost: 0,
  invis: 0,
  inMud: false,
  dead: false,
  trail: [],
};

export function makeHunter() {
  return {
    wx: 0,
    wy: 560,
    vx: 0,
    vy: 0,
    angle: 0,
    r: 15,
    ACCEL: 0.24,
    FRICTION: 0.965,
    MAXSP: 7.05,
    pulse: Math.random() * 6,
    trail: [],
    stun: 0,
    repel: 0,
  };
}

export let hunters = [];
export let hunterCount = 1;
export let decoy = null;

export let campHistory = [];
export let waveWarning = 0;
export let shockwaves = [];
export let campTriggers = 0;

export let joy = null;
export const keys = {};

export let obstacles = [];
export let specials = [];
export const generatedCells = new Set();
export const generatedMazes = new Set();

export let particles = [];
export let powTimer = 0;

export function worldToScreen(wx, wy) {
  return { x: wx - cam.x + W / 2, y: wy - cam.y + H / 2 + H * CAM_Y_OFFSET };
}
