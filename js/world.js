import { CELL, MAZE_GRID, TELE_COLORS } from './config.js';
import {
  frameCount,
  generatedCells,
  generatedMazes,
  obstacles,
  specials,
} from './state.js';
import { angleDiff, getBiomeAt, seededRand } from './utils.js';

export function obstacleColliders(o) {
  if (o.type === 'hex' || o.type === 'spiral') return [{ x: o.wx, y: o.wy, r: o.r }];
  if (o.type === 'tube') {
    const cs = [];
    const n = Math.max(2, Math.round(o.len / o.th));
    for (let i = 0; i <= n; i++) {
      const f = i / n - 0.5;
      cs.push({
        x: o.wx + Math.cos(o.rot) * f * o.len,
        y: o.wy + Math.sin(o.rot) * f * o.len,
        r: o.th * 0.6,
      });
    }
    return cs;
  }
  if (o.type === 'bridge') {
    const px = Math.cos(o.rot + Math.PI / 2);
    const py = Math.sin(o.rot + Math.PI / 2);
    return [
      { x: o.wx + px * (o.gap / 2 + o.pr), y: o.wy + py * (o.gap / 2 + o.pr), r: o.pr },
      { x: o.wx - px * (o.gap / 2 + o.pr), y: o.wy - py * (o.gap / 2 + o.pr), r: o.pr },
    ];
  }
  return [];
}

export function circleBlocked(wx, wy, radius) {
  for (const o of obstacles) {
    for (const c of obstacleColliders(o)) {
      const dx = wx - c.x;
      const dy = wy - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < radius + c.r) {
        const nx = d > 0 ? dx / d : 1;
        const ny = d > 0 ? dy / d : 0;
        return { hit: true, nx, ny, push: radius + c.r - d };
      }
    }
  }
  return { hit: false };
}

function generateMaze(cx, cy, seed, biome) {
  const cells = 4;
  const cellSize = 78;
  const wallTh = 18;
  const half = (cells * cellSize) / 2;

  function addWall(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const rot = Math.atan2(y2 - y1, x2 - x1);
    obstacles.push({
      type: 'tube',
      wx: cx - half + mx,
      wy: cy - half + my,
      len,
      th: wallTh,
      rot,
      biome,
      maze: seed,
    });
  }

  for (let i = 0; i <= cells; i++) {
    for (let j = 0; j < cells; j++) {
      if (i > 0 && i < cells && seededRand(seed + i * 3.1, j * 7.7) < 0.55) {
        addWall(j * cellSize, i * cellSize, (j + 1) * cellSize, i * cellSize);
      }
    }
  }
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j <= cells; j++) {
      if (j > 0 && j < cells && seededRand(seed + j * 5.3, i * 2.9) < 0.55) {
        addWall(j * cellSize, i * cellSize, j * cellSize, (i + 1) * cellSize);
      }
    }
  }
  const sides = [
    [0, 0, cells * cellSize, 0],
    [0, cells * cellSize, cells * cellSize, cells * cellSize],
    [0, 0, 0, cells * cellSize],
    [cells * cellSize, 0, cells * cellSize, cells * cellSize],
  ];
  sides.forEach((s, si) => {
    if (seededRand(seed + si * 11, si) < 0.5) return;
    addWall(s[0], s[1], s[2], s[3]);
  });
}

export function ensureGenAround(wx, wy) {
  const ccx = Math.floor(wx / CELL);
  const ccy = Math.floor(wy / CELL);
  const mcx = Math.floor(wx / MAZE_GRID);
  const mcy = Math.floor(wy / MAZE_GRID);

  for (let gx = mcx - 2; gx <= mcx + 2; gx++) {
    for (let gy = mcy - 2; gy <= mcy + 2; gy++) {
      const mkey = `${gx},${gy}`;
      if (generatedMazes.has(mkey)) continue;
      generatedMazes.add(mkey);
      if (seededRand(gx + 50, gy + 50) < 0.28) {
        const ox = gx * MAZE_GRID + MAZE_GRID / 2;
        const oy = gy * MAZE_GRID + MAZE_GRID / 2;
        if (Math.sqrt(ox * ox + oy * oy) < 400) continue;
        const { biome } = getBiomeAt(ox, oy);
        generateMaze(ox, oy, gx * 31.7 + gy * 91.3, biome);
      }
    }
  }

  for (let gx = ccx - 3; gx <= ccx + 3; gx++) {
    for (let gy = ccy - 3; gy <= ccy + 3; gy++) {
      const key = `${gx},${gy}`;
      if (generatedCells.has(key)) continue;
      generatedCells.add(key);
      const r1 = seededRand(gx, gy);
      const ox = gx * CELL + (seededRand(gx + 5, gy) * 0.5 + 0.25) * CELL;
      const oy = gy * CELL + (seededRand(gx, gy + 5) * 0.5 + 0.25) * CELL;
      if (Math.sqrt(ox * ox + oy * oy) < 170) continue;
      const { biome } = getBiomeAt(ox, oy);
      const rot = seededRand(gx + 2, gy + 3) * Math.PI * 2;

      if (r1 < 0.4) {
        const st = seededRand(gx + 11, gy + 7);
        if (st < 0.45) {
          obstacles.push({ type: 'hex', wx: ox, wy: oy, r: 34 + seededRand(gx, gy + 1) * 40, rot, biome });
        } else if (st < 0.7) {
          const len = 120 + seededRand(gx + 1, gy) * 150;
          const th = 24 + seededRand(gx, gy + 2) * 14;
          obstacles.push({ type: 'tube', wx: ox, wy: oy, len, th, rot, biome });
        } else if (st < 0.88) {
          obstacles.push({ type: 'spiral', wx: ox, wy: oy, r: 48 + seededRand(gx + 3, gy) * 38, rot, biome });
        } else {
          const gap = 70 + seededRand(gx, gy + 4) * 40;
          const pr = 28 + seededRand(gx + 4, gy) * 16;
          obstacles.push({ type: 'bridge', wx: ox, wy: oy, gap, pr, rot, biome });
        }
      } else if (r1 < 0.56) {
        specials.push({ type: 'accel', wx: ox, wy: oy, r: 36, rot, phase: seededRand(gx, gy) * 6, biome });
      } else if (r1 < 0.66) {
        const dx2 = (seededRand(gx + 20, gy) * 2 - 1) * 600;
        const dy2 = (seededRand(gx, gy + 20) * 2 - 1) * 600;
        const col = TELE_COLORS[Math.floor(seededRand(gx + 1, gy + 1) * TELE_COLORS.length)];
        specials.push({
          type: 'tele',
          wx: ox,
          wy: oy,
          r: 30,
          destX: ox + dx2,
          destY: oy + dy2,
          col,
          phase: seededRand(gx, gy) * 6,
          cd: 0,
        });
      } else if (r1 < 0.72) {
        specials.push({ type: 'blackhole', wx: ox, wy: oy, r: 26, pull: 140, phase: seededRand(gx, gy) * 6 });
      } else if (r1 < 0.8) {
        specials.push({ type: 'field', wx: ox, wy: oy, r: 64, phase: seededRand(gx, gy) * 6 });
      } else if (r1 < 0.87) {
        specials.push({ type: 'mud', wx: ox, wy: oy, r: 54 + seededRand(gx, gy) * 30, biome });
      } else if (r1 < 0.93) {
        const types = ['decoy', 'invis', 'speed'];
        const bt = types[Math.floor(seededRand(gx + 3, gy + 3) * types.length)];
        specials.push({
          type: 'bonus',
          bonus: bt,
          wx: ox,
          wy: oy,
          r: 16,
          phase: seededRand(gx, gy) * 6,
          taken: false,
        });
      }
    }
  }

  obstacles.splice(
    0,
    obstacles.length,
    ...obstacles.filter((o) => Math.abs(o.wx - wx) < 1800 && Math.abs(o.wy - wy) < 1800)
  );
  specials.splice(
    0,
    specials.length,
    ...specials.filter((o) => Math.abs(o.wx - wx) < 1800 && Math.abs(o.wy - wy) < 1800)
  );

  if (frameCount % 120 === 0) {
    for (const k of generatedCells) {
      const [a, b] = k.split(',').map(Number);
      if (Math.abs(a * CELL - wx) > 2200 || Math.abs(b * CELL - wy) > 2200) generatedCells.delete(k);
    }
    for (const k of generatedMazes) {
      const [a, b] = k.split(',').map(Number);
      if (Math.abs(a * MAZE_GRID - wx) > 2400 || Math.abs(b * MAZE_GRID - wy) > 2400) generatedMazes.delete(k);
    }
  }
}

export function hunterAvoidDir(hx, hy, tx, ty) {
  const toT = Math.atan2(ty - hy, tx - hx);
  const la = 140;
  const fx = hx + Math.cos(toT) * la;
  const fy = hy + Math.sin(toT) * la;
  let best = null;
  let bestDist = Infinity;
  for (const o of obstacles) {
    for (const c of obstacleColliders(o)) {
      const dx = fx - c.x;
      const dy = fy - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < c.r + 33) {
        const hd = Math.sqrt((hx - c.x) ** 2 + (hy - c.y) ** 2);
        if (hd < bestDist) {
          bestDist = hd;
          best = c;
        }
      }
    }
  }
  if (!best) return toT;
  const toObs = Math.atan2(best.y - hy, best.x - hx);
  const left = toObs - Math.PI / 2;
  const right = toObs + Math.PI / 2;
  return Math.abs(angleDiff(left, toT)) < Math.abs(angleDiff(right, toT)) ? left : right;
}
