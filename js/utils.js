import { BIOMES, BIOME_SIZE, FOREST_BIOMES } from './config.js';
import { mapTheme, particles } from './state.js';

export function seededRand(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function getBiomeAt(wx, wy) {
  const set = mapTheme === 'forest' ? FOREST_BIOMES : BIOMES;
  const bx = Math.floor(wx / BIOME_SIZE);
  const by = Math.floor(wy / BIOME_SIZE);
  const idx = Math.floor(seededRand(bx, by) * set.length);
  return { biome: set[idx], bx, by };
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function explode(wx, wy, count, color) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 4;
    particles.push({
      wx,
      wy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      decay: 0.03 + Math.random() * 0.03,
      r: 1 + Math.random() * 3,
      color,
    });
  }
}
