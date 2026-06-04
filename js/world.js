import { CELL, MAZE_GRID, MONSTER_CELL, TELE_COLORS } from './config.js';
import {
  frameCount,
  generatedCells,
  generatedMazes,
  generatedMonsters,
  makeMonster,
  monsters,
  obstacles,
  specials,
} from './state.js';
import { angleDiff, getBiomeAt, seededRand } from './utils.js';

export function obstacleColliders(o) {
  if (o.type === 'hex' || o.type === 'spiral') return [{ x: o.wx, y: o.wy, r: o.r }];
  if (o.type === 'tube' || o.type === 'doorguard') {
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

export function circleBlocked(wx, wy, radius, isEnemy = false) {
  for (const o of obstacles) {
    if (o.enemyOnly && !isEnemy) continue;
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

// Déplacement balayé : on avance par petits pas pour empêcher de traverser
// un mur fin à grande vitesse (tunneling), et on glisse le long des parois.
export function sweptMove(ent, isEnemy = false) {
  const sp = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
  const maxStep = Math.max(2, ent.r * 0.55);
  const steps = Math.min(8, Math.max(1, Math.ceil(sp / maxStep)));
  let last = { hit: false, nx: 0, ny: 0, push: 0 };
  for (let i = 0; i < steps; i++) {
    ent.wx += ent.vx / steps;
    ent.wy += ent.vy / steps;
    const b = circleBlocked(ent.wx, ent.wy, ent.r, isEnemy);
    if (b.hit) {
      ent.wx += b.nx * b.push;
      ent.wy += b.ny * b.push;
      const dot = ent.vx * b.nx + ent.vy * b.ny;
      if (dot < 0) {
        ent.vx -= dot * b.nx;
        ent.vy -= dot * b.ny;
      }
      last = b;
    }
  }
  return last;
}

// Salle-refuge : enceinte fermée avec une seule porte visible. La porte est
// franchissable par le joueur mais bloquée par un « doorguard » qui ne repousse
// que les ennemis (chasseurs et monstres).
function generateSanctuary(cx, cy, seed, biome) {
  const half = 130 + seededRand(seed, 7) * 45;
  const wallTh = 16;
  const doorGap = 74;
  const doorSide = Math.floor(seededRand(seed + 3, seed + 9) * 4);

  function wall(x1, y1, x2, y2) {
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    if (len < 4) return;
    obstacles.push({
      type: 'tube',
      wx: cx + (x1 + x2) / 2,
      wy: cy + (y1 + y2) / 2,
      len,
      th: wallTh,
      rot: Math.atan2(y2 - y1, x2 - x1),
      biome,
      sanctuary: true,
    });
  }

  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];

  edges.forEach((e, ei) => {
    const [a, b] = e;
    if (ei !== doorSide) {
      wall(a[0], a[1], b[0], b[1]);
      return;
    }
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const len = Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const g = doorGap / 2;
    wall(a[0], a[1], mx - ux * g, my - uy * g);
    wall(mx + ux * g, my + uy * g, b[0], b[1]);
    obstacles.push({
      type: 'doorguard',
      wx: cx + mx,
      wy: cy + my,
      len: doorGap,
      th: 30,
      rot: Math.atan2(uy, ux),
      biome,
      enemyOnly: true,
    });
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
        const { biome } = getBiomeAt(ox, oy);
        generateSanctuary(ox, oy, gx * 31.7 + gy * 91.3, biome);
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

  const mccx = Math.floor(wx / MONSTER_CELL);
  const mccy = Math.floor(wy / MONSTER_CELL);
  for (let gx = mccx - 2; gx <= mccx + 2; gx++) {
    for (let gy = mccy - 2; gy <= mccy + 2; gy++) {
      const key = `${gx},${gy}`;
      if (generatedMonsters.has(key)) continue;
      if (seededRand(gx + 300, gy + 700) < 0.5) {
        const ox = gx * MONSTER_CELL + (seededRand(gx + 8, gy) * 0.6 + 0.2) * MONSTER_CELL;
        const oy = gy * MONSTER_CELL + (seededRand(gx, gy + 8) * 0.6 + 0.2) * MONSTER_CELL;
        const d = Math.sqrt((ox - wx) ** 2 + (oy - wy) ** 2);
        // ni sur le joueur, ni trop loin (sinon purgé aussitôt) : on réessaiera
        if (d < 650 || d > 2000) continue;
        const m = makeMonster(ox, oy);
        m.cell = key;
        monsters.push(m);
      }
      generatedMonsters.add(key);
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
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (Math.abs(m.wx - wx) > 2200 || Math.abs(m.wy - wy) > 2200) {
        if (m.cell) generatedMonsters.delete(m.cell);
        monsters.splice(i, 1);
      }
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
