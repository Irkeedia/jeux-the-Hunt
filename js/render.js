import { CAM_Y_OFFSET } from './config.js';
import {
  DPR,
  W,
  H,
  biomeFlash,
  biomeFlashGlow,
  biomeFlashName,
  cam,
  canvas,
  ctx,
  decoy,
  frameCount,
  gfxLow,
  glowCanvas,
  gctx,
  hunters,
  mapTheme,
  monsters,
  obstacles,
  particles,
  player,
  shake,
  shockwaves,
  specials,
  waveWarning,
  worldToScreen as ws,
} from './state.js';
import { getBiomeAt, seededRand } from './utils.js';

const timeEl = document.getElementById('time-val');
const distEl = document.getElementById('dist-val');
let lastTimeText = '';
let lastDistText = '';

export function updateHUD(elapsed, distance) {
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  const t = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (t !== lastTimeText) {
    timeEl.textContent = t;
    lastTimeText = t;
  }
  const d = String(distance);
  if (d !== lastDistText) {
    distEl.textContent = d;
    lastDistText = d;
  }
}

// ---------------------------------------------------------------------------
// Cache de sprites : tout ce qui coûte cher (shadowBlur, dégradés) est dessiné
// UNE seule fois dans un canvas hors-écran, puis réaffiché en un drawImage.
// C'est le cœur de l'optimisation : shadowBlur par frame est ce qui tuait les
// performances sur mobile.
// ---------------------------------------------------------------------------
const spriteCache = new Map();

function getSprite(key, size, draw) {
  // Les sprites sont bakés à la résolution d'affichage (DPR) pour rester nets.
  const scale = DPR > 1.5 ? 2 : 1;
  const k = `${key}|@${scale}`;
  let s = spriteCache.get(k);
  if (s) return s;
  const c = document.createElement('canvas');
  const px = Math.max(2, Math.ceil(size));
  c.width = px * scale;
  c.height = px * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g, px / 2);
  s = { c, half: px / 2, w: px };
  spriteCache.set(k, s);
  if (spriteCache.size > 320) {
    spriteCache.delete(spriteCache.keys().next().value);
  }
  return s;
}

// Halo lumineux générique (dégradé radial pré-rendu, réutilisé partout).
function drawHalo(x, y, radius, rgb, alpha) {
  const key = `halo|${rgb}|${alpha}`;
  const s = getSprite(key, 128, (g, h) => {
    const grad = g.createRadialGradient(h, h, 0, h, h, h);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`);
    grad.addColorStop(0.45, `rgba(${rgb},${alpha * 0.28})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, h * 2, h * 2);
  });
  ctx.drawImage(s.c, x - radius, y - radius, radius * 2, radius * 2);
}

// ---------------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------------
const PAD = 56; // marge pour que le glow ne soit pas coupé dans le sprite

function hexSprite(o) {
  const r = Math.round(o.r / 3) * 3;
  const b = o.biome;
  return getSprite(`hex|${r}|${b.glow}`, r * 2 + PAD, (g, h) => {
    g.translate(h, h);
    g.shadowBlur = 14;
    g.shadowColor = b.glow;
    g.strokeStyle = b.glow;
    g.lineWidth = 2.5;
    g.fillStyle = b.fill;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.globalAlpha = 0.4;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    g.stroke();
  });
}

function tubeSprite(o) {
  const len = Math.round(o.len / 10) * 10;
  const th = Math.round(o.th / 4) * 4;
  const b = o.biome;
  return getSprite(`tube|${len}|${th}|${b.glow}`, len + PAD, (g, h) => {
    g.translate(h, h);
    g.shadowBlur = 14;
    g.shadowColor = b.glow;
    g.strokeStyle = b.glow;
    g.lineWidth = 2.5;
    g.fillStyle = b.fill;
    const hw = len / 2;
    g.beginPath();
    g.moveTo(-hw, -th / 2);
    g.lineTo(hw, -th / 2);
    g.arc(hw, 0, th / 2, -Math.PI / 2, Math.PI / 2);
    g.lineTo(-hw, th / 2);
    g.arc(-hw, 0, th / 2, Math.PI / 2, -Math.PI / 2);
    g.closePath();
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.globalAlpha = 0.35;
    g.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo((i * hw) / 3, -th / 2 + 3);
      g.lineTo((i * hw) / 3, th / 2 - 3);
      g.stroke();
    }
  });
}

function spiralSprite(o) {
  const r = Math.round(o.r / 4) * 4;
  const b = o.biome;
  return getSprite(`spiral|${r}|${b.glow}`, r * 2 + PAD, (g, h) => {
    g.translate(h, h);
    g.shadowBlur = 16;
    g.shadowColor = b.glow;
    g.strokeStyle = b.glow;
    g.lineWidth = 3;
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.15) {
      const rr = r * (a / (Math.PI * 5));
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    g.fillStyle = b.fill;
    g.beginPath();
    g.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });
}

function bridgeSprite(o) {
  const gap = Math.round(o.gap / 6) * 6;
  const pr = Math.round(o.pr / 4) * 4;
  const b = o.biome;
  const ext = gap / 2 + pr * 2;
  return getSprite(`bridge|${gap}|${pr}|${b.glow}`, ext * 2 + PAD, (g, h) => {
    g.translate(h, h);
    g.shadowBlur = 14;
    g.shadowColor = b.glow;
    g.strokeStyle = b.glow;
    g.lineWidth = 2.5;
    g.fillStyle = b.fill;
    const off = gap / 2 + pr;
    [1, -1].forEach((s) => {
      g.beginPath();
      g.arc(0, s * off, pr, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });
    g.shadowBlur = 0;
    g.globalAlpha = 0.3;
    g.setLineDash([5, 5]);
    g.beginPath();
    g.moveTo(0, off - pr);
    g.lineTo(0, -off + pr);
    g.stroke();
    g.setLineDash([]);
  });
}

function rockSprite(o) {
  const r = Math.round(o.r / 3) * 3;
  // variante de forme stable par rocher, mais partagée entre rochers proches
  const v = Math.abs(Math.round(o.wx * 0.013 + o.wy * 0.027)) % 8;
  const b = o.biome;
  return getSprite(`rock|${r}|${v}|${b.glow}`, r * 2.4 + PAD, (g, h) => {
    g.translate(h, h);
    g.shadowBlur = 8;
    g.shadowColor = b.glow;
    g.fillStyle = b.fill;
    g.strokeStyle = b.glow;
    g.lineWidth = 2;
    g.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.78 + seededRand(v * 7 + i, v * 3) * 0.32);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.globalAlpha = 0.2;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(-r * 0.22, -r * 0.22, r * 0.32, 0, Math.PI * 2);
    g.fill();
  });
}

function treeSprite(o) {
  const r = Math.round(o.r / 3) * 3;
  const c = Math.round(o.canopy / 6) * 6;
  const b = o.biome;
  return getSprite(`tree|${r}|${c}|${b.glow}`, c * 2.6 + PAD, (g, h) => {
    g.translate(h, h);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(c * 0.18, c * 0.2, c * 0.78, c * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(46,32,20,0.95)';
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 12;
    g.shadowColor = b.glow;
    g.fillStyle = b.fill;
    g.strokeStyle = b.glow;
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * c * 0.4, Math.sin(a) * c * 0.4, c * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, c * 0.66, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.globalAlpha = 0.18;
    g.fillStyle = '#eaffe0';
    g.beginPath();
    g.arc(-c * 0.2, -c * 0.2, c * 0.28, 0, Math.PI * 2);
    g.fill();
  });
}

function drawObstacle(o) {
  const os = ws(o.wx, o.wy);
  if (os.x < -240 || os.x > W + 240 || os.y < -240 || os.y > H + 240) return;

  if (o.type === 'doorguard') {
    // Porte du refuge : animée, mais peu coûteuse sans shadowBlur.
    const hw = o.len / 2;
    ctx.save();
    ctx.translate(os.x, os.y);
    ctx.rotate(o.rot);
    drawHalo(-hw, 0, 14, '99,220,255', 0.7);
    drawHalo(hw, 0, 14, '99,220,255', 0.7);
    ctx.fillStyle = 'rgba(99,220,255,0.95)';
    [-hw, hw].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 0.22 + Math.sin(frameCount * 0.12) * 0.12;
    ctx.strokeStyle = 'rgba(99,220,255,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 9]);
    ctx.beginPath();
    ctx.moveTo(-hw, 0);
    ctx.lineTo(hw, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  let s;
  let rot = o.rot;
  if (o.type === 'hex') s = hexSprite(o);
  else if (o.type === 'tube') s = tubeSprite(o);
  else if (o.type === 'spiral') {
    s = spiralSprite(o);
    rot = o.rot + frameCount * 0.005;
  } else if (o.type === 'bridge') s = bridgeSprite(o);
  else if (o.type === 'rock') s = rockSprite(o);
  else if (o.type === 'tree') s = treeSprite(o);
  if (!s) return;

  ctx.save();
  ctx.translate(os.x, os.y);
  ctx.rotate(rot);
  ctx.drawImage(s.c, -s.half, -s.half, s.w, s.w);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Monstres
// ---------------------------------------------------------------------------
function monsterSprite(aggro, r) {
  const col = aggro ? '255,70,160' : '150,90,220';
  return getSprite(`mon|${aggro}|${r}`, r * 2.6 + PAD, (g, h) => {
    g.translate(h, h);
    g.shadowBlur = aggro ? 26 : 16;
    g.shadowColor = `rgba(${col},1)`;
    g.fillStyle = `rgba(${col},0.9)`;
    g.strokeStyle = '#fff';
    g.lineWidth = 1.5;
    const spikes = 9;
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i / (spikes * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r * 1.1 : r * 0.62;
      const px = Math.cos(ang) * rr;
      const py = Math.sin(ang) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = aggro ? '#ff2266' : '#3a1a5a';
    g.beginPath();
    g.arc(0, 0, r * 0.17, 0, Math.PI * 2);
    g.fill();
  });
}

function drawMonster(m) {
  const ps = ws(m.wx, m.wy);
  if (ps.x < -140 || ps.x > W + 140 || ps.y < -140 || ps.y > H + 140) return;
  const col = m.aggro ? '255,70,160' : '150,90,220';

  m.trail.forEach((t, i) => {
    const p = ws(t.wx, t.wy);
    ctx.globalAlpha = (1 - i / m.trail.length) * 0.22;
    ctx.fillStyle = `rgba(${col},1)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, m.r * (1 - i / m.trail.length) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (!gfxLow) drawHalo(ps.x, ps.y, m.r * 3, col, 0.5);

  const s = monsterSprite(m.aggro, Math.round(m.r));
  const sc = (1.1 + Math.sin(m.pulse) * 0.12) / 1.1;
  ctx.save();
  ctx.translate(ps.x, ps.y);
  ctx.rotate(m.pulse * 0.3);
  ctx.scale(sc, sc);
  ctx.drawImage(s.c, -s.half, -s.half, s.w, s.w);
  ctx.restore();

  if (m.aggro) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.3) * 0.2;
    ctx.strokeStyle = `rgba(${col},1)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ps.x, ps.y, m.r + 10 + Math.sin(frameCount * 0.2) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Spéciaux (boost, téléporteur, trou noir, champ, boue, bonus)
// ---------------------------------------------------------------------------
function drawSpecial(s) {
  const os = ws(s.wx, s.wy);
  if (os.x < -200 || os.x > W + 200 || os.y < -200 || os.y > H + 200) return;
  ctx.save();
  ctx.translate(os.x, os.y);
  const t = frameCount * 0.1 + (s.phase || 0);

  if (s.type === 'accel') {
    const sp = getSprite(`accel|${s.r}`, s.r * 2 + PAD, (g, h) => {
      g.translate(h, h);
      g.shadowBlur = 20;
      g.shadowColor = '#5ad6ff';
      g.strokeStyle = 'rgba(90,214,255,0.9)';
      g.lineWidth = 3;
      g.fillStyle = 'rgba(90,214,255,0.08)';
      g.beginPath();
      g.arc(0, 0, s.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });
    ctx.drawImage(sp.c, -sp.half, -sp.half, sp.w, sp.w);
    ctx.rotate(s.rot);
    ctx.strokeStyle = 'rgba(90,214,255,0.9)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const ph = (t + i * 0.5) % 2;
      const sc = 0.4 + ph * 0.5;
      ctx.globalAlpha = Math.max(0, 1 - ph * 0.6);
      ctx.beginPath();
      ctx.moveTo(-s.r * 0.5 * sc, s.r * 0.3 * sc);
      ctx.lineTo(0, -s.r * 0.4 * sc);
      ctx.lineTo(s.r * 0.5 * sc, s.r * 0.3 * sc);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (s.type === 'tele') {
    const sp = getSprite(`tele|${s.r}|${s.col}`, s.r * 2 + PAD, (g, h) => {
      g.translate(h, h);
      g.shadowBlur = 22;
      g.shadowColor = s.col;
      g.strokeStyle = s.col;
      g.lineWidth = 3;
      for (let r = 0; r < 3; r++) {
        g.globalAlpha = 0.75 - r * 0.18;
        g.beginPath();
        g.arc(0, 0, s.r - r * 7, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = s.col;
      g.beginPath();
      g.arc(0, 0, 4, 0, Math.PI * 2);
      g.fill();
    });
    ctx.globalAlpha = 0.62 + Math.sin(t) * 0.3;
    ctx.drawImage(sp.c, -sp.half, -sp.half, sp.w, sp.w);
    ctx.globalAlpha = 1;
    const dest = ws(s.destX, s.destY);
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = s.col;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dest.x - os.x, dest.y - os.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  } else if (s.type === 'blackhole') {
    const sp = getSprite(`bh|${s.r}|${s.pull}`, s.pull * 2 + 24, (g, h) => {
      g.translate(h, h);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, s.pull);
      grd.addColorStop(0, 'rgba(120,60,255,0.35)');
      grd.addColorStop(0.5, 'rgba(60,20,120,0.12)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, s.pull, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(160,100,255,0.6)';
      g.lineWidth = 2;
      g.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) {
        const ar = s.r * (a / (Math.PI * 4));
        const px = Math.cos(a) * ar;
        const py = Math.sin(a) * ar;
        if (a === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
      g.fillStyle = '#000';
      g.shadowBlur = 20;
      g.shadowColor = '#7733ff';
      g.beginPath();
      g.arc(0, 0, s.r * 0.55, 0, Math.PI * 2);
      g.fill();
    });
    ctx.rotate(t);
    ctx.drawImage(sp.c, -sp.half, -sp.half, sp.w, sp.w);
  } else if (s.type === 'field') {
    const sp = getSprite(`field|${s.r}`, s.r * 2 + PAD, (g, h) => {
      g.translate(h, h);
      g.shadowBlur = 16;
      g.shadowColor = '#44ff99';
      g.strokeStyle = 'rgba(68,255,153,0.5)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, s.r, 0, Math.PI * 2);
      g.stroke();
      g.shadowBlur = 0;
      g.globalAlpha = 0.05;
      g.fillStyle = '#44ff99';
      g.beginPath();
      g.arc(0, 0, s.r, 0, Math.PI * 2);
      g.fill();
    });
    ctx.globalAlpha = 0.6 + Math.sin(t) * 0.2;
    ctx.drawImage(sp.c, -sp.half, -sp.half, sp.w, sp.w);
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = 'rgba(68,255,153,0.5)';
    ctx.lineWidth = 2;
    ctx.rotate(t * 0.2);
    for (let ring = 1; ring <= 2; ring++) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * s.r * 0.4 * ring;
        const py = Math.sin(a) * s.r * 0.4 * ring;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (s.type === 'mud') {
    const r = Math.round(s.r / 4) * 4;
    const v = Math.abs(Math.round(s.wx * 0.017 + s.wy * 0.031)) % 8;
    const sp = getSprite(`mud|${r}|${v}`, r * 2 + 24, (g, h) => {
      g.translate(h, h);
      g.fillStyle = 'rgba(90,70,40,0.4)';
      g.strokeStyle = 'rgba(140,110,60,0.4)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.globalAlpha = 0.3;
      for (let i = 0; i < 5; i++) {
        const a = seededRand(v + i, v) * Math.PI * 2;
        const rr = seededRand(v, v + i) * r * 0.6;
        g.beginPath();
        g.arc(Math.cos(a) * rr, Math.sin(a) * rr, 4 + seededRand(i, i) * 6, 0, Math.PI * 2);
        g.fill();
      }
    });
    ctx.drawImage(sp.c, -sp.half, -sp.half, sp.w, sp.w);
  } else if (s.type === 'bonus' && !s.taken) {
    const col = s.bonus === 'decoy' ? '#ffe066' : s.bonus === 'invis' ? '#aaccff' : '#66ff99';
    const sp = getSprite(`bonus|${s.r}|${col}`, s.r * 2 + PAD, (g, h) => {
      g.translate(h, h);
      g.shadowBlur = 18;
      g.shadowColor = col;
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? s.r : s.r * 0.45;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.globalAlpha = 0.18;
      g.fillStyle = col;
      g.fill();
      g.globalAlpha = 1;
      g.stroke();
    });
    const bob = Math.sin(t) * 4;
    ctx.drawImage(sp.c, -sp.half, -sp.half + bob, sp.w, sp.w);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Vaisseaux (joueur + chasseurs) : sprite complet avec halo et glow.
// ---------------------------------------------------------------------------
function shipSprite(rgb, glow, r) {
  return getSprite(`ship|${rgb}|${glow}|${r}`, r * 9.2, (g, h) => {
    const halo = g.createRadialGradient(h, h, 0, h, h, r * 4.4);
    halo.addColorStop(0, `rgba(${rgb},0.6)`);
    halo.addColorStop(0.45, `rgba(${rgb},0.16)`);
    halo.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = halo;
    g.fillRect(0, 0, h * 2, h * 2);

    g.translate(h, h);
    g.shadowBlur = glow;
    g.shadowColor = `rgb(${rgb})`;
    g.strokeStyle = `rgb(${rgb})`;
    g.lineWidth = 2.5;
    const s = r;

    const fillGrad = g.createLinearGradient(0, -s * 1.25, 0, s * 1.05);
    fillGrad.addColorStop(0, 'rgba(255,255,255,0.9)');
    fillGrad.addColorStop(0.18, `rgba(${rgb},0.72)`);
    fillGrad.addColorStop(1, `rgba(${rgb},0.18)`);
    g.fillStyle = fillGrad;

    g.beginPath();
    g.moveTo(0, -s * 1.28);
    g.bezierCurveTo(s * 0.95, -s * 0.68, s * 1.08, s * 0.38, s * 0.46, s * 0.86);
    g.bezierCurveTo(s * 0.2, s * 1.06, -s * 0.2, s * 1.06, -s * 0.46, s * 0.86);
    g.bezierCurveTo(-s * 1.08, s * 0.38, -s * 0.95, -s * 0.68, 0, -s * 1.28);
    g.closePath();
    g.fill();
    g.stroke();

    g.shadowBlur = glow * 0.35;
    g.strokeStyle = 'rgba(255,255,255,0.72)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, -s * 0.88);
    g.quadraticCurveTo(s * 0.12, -s * 0.08, 0, s * 0.52);
    g.stroke();

    g.fillStyle = `rgba(${rgb},0.95)`;
    g.shadowBlur = glow * 0.45;
    g.beginPath();
    g.arc(0, -s * 0.12, s * 0.22, 0, Math.PI * 2);
    g.fill();
  });
}

function drawArrow(ent, color, glow) {
  const ps = ws(ent.wx, ent.wy);
  const rgbMatch = color.match(/\d+/g);
  const rgb = rgbMatch ? `${rgbMatch[0]},${rgbMatch[1]},${rgbMatch[2]}` : '255,255,255';
  const s = shipSprite(rgb, glow, Math.round(ent.r));
  ctx.save();
  ctx.translate(ps.x, ps.y);
  ctx.rotate(ent.angle + Math.PI / 2);
  ctx.drawImage(s.c, -s.half, -s.half, s.w, s.w);
  ctx.restore();
}

// Poulpe : ennemis de la forêt (formes simples, pas de shadowBlur).
function drawOctopus(ent, rgb, glow) {
  const ps = ws(ent.wx, ent.wy);
  const r = ent.r;
  if (!gfxLow) drawHalo(ps.x, ps.y, r * 3.4, rgb, 0.42);

  ctx.save();
  ctx.translate(ps.x, ps.y);
  ctx.rotate(ent.angle);

  const tentacles = 7;
  const spread = Math.PI * 1.25;
  for (let i = 0; i < tentacles; i++) {
    const baseA = Math.PI - spread / 2 + (i / (tentacles - 1)) * spread;
    const px = Math.cos(baseA);
    const py = Math.sin(baseA);
    const nx = Math.cos(baseA + Math.PI / 2);
    const ny = Math.sin(baseA + Math.PI / 2);
    let x = px * r * 0.6;
    let y = py * r * 0.6;
    const segs = 6;
    for (let s = 1; s <= segs; s++) {
      const f = s / segs;
      const wig = Math.sin(ent.pulse * 1.8 + i * 0.9 + s * 0.8) * r * 0.5 * f;
      x += px * r * 0.4 + nx * wig * 0.35;
      y += py * r * 0.4 + ny * wig * 0.35;
      const rad = r * 0.36 * (1 - f * 0.78);
      ctx.fillStyle = `rgba(${rgb},${0.9 - f * 0.45})`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = `rgba(${rgb},0.96)`;
  ctx.strokeStyle = 'rgba(18,6,16,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(r * 0.28, 0, r * 1.08, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(r * 0.2, -r * 0.4, r * 0.42, r * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.arc(r * 0.82, s * r * 0.44, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#15000c';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.arc(r * 0.95, s * r * 0.44, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#ff3344';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.arc(r * 0.95, s * r * 0.44, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Fonds (espace / forêt)
// ---------------------------------------------------------------------------
const bgGradCache = new Map();

function bgGradient(bg, fallback) {
  const key = `${bg}|${W}x${H}|${fallback}`;
  let grd = bgGradCache.get(key);
  if (!grd) {
    grd = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.85);
    grd.addColorStop(0, bg);
    grd.addColorStop(1, fallback);
    bgGradCache.set(key, grd);
    if (bgGradCache.size > 24) bgGradCache.delete(bgGradCache.keys().next().value);
  }
  return grd;
}

// Halo de nébuleuse pré-rendu par couleur.
function nebulaSprite(glow, alpha) {
  return getSprite(`neb|${glow}|${alpha}`, 256, (g, h) => {
    const ng = g.createRadialGradient(h, h, 0, h, h, h);
    ng.addColorStop(0, glow.replace(/[\d.]+\)$/, `${alpha})`));
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ng;
    g.fillRect(0, 0, h * 2, h * 2);
  });
}

function drawGrid(gridColor, gs) {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  const yoff = H * CAM_Y_OFFSET;
  const ox = ((-cam.x % gs) + gs) % gs;
  const oy = (((-cam.y + yoff) % gs) + gs) % gs;
  ctx.beginPath();
  for (let x = ox - gs; x < W + gs; x += gs) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = oy - gs; y < H + gs; y += gs) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
}

function drawForestBackground() {
  const c = getBiomeAt(cam.x, cam.y).biome;
  ctx.fillStyle = bgGradient(c.bg, '#02060a');
  ctx.fillRect(-60, -60, W + 120, H + 120);

  const neb = nebulaSprite(c.glow, 0.07);
  for (let i = 0; i < 4; i++) {
    const nx = (((i * 443.3 - cam.x * 0.05) % (W * 1.5)) + W * 1.5) % (W * 1.5) - W * 0.25;
    const ny = (((i * 287.7 - cam.y * 0.05) % (H * 1.5)) + H * 1.5) % (H * 1.5) - H * 0.25;
    ctx.drawImage(neb.c, nx - 320, ny - 320, 640, 640);
  }

  drawGrid(c.grid, 90);

  ctx.fillStyle = c.glow;
  for (let i = 0; i < 42; i++) {
    const sx = (i * 97.13) % W;
    const sy = (i * 61.7) % H;
    const px = (((sx - cam.x * 0.2) % W) + W) % W;
    const py = (((sy - cam.y * 0.2) % H) + H) % H;
    ctx.globalAlpha = 0.25 + 0.35 * Math.sin(frameCount * 0.05 + i);
    ctx.beginPath();
    ctx.arc(px, py, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Les galaxies sont chères (des centaines de cercles) : on les pré-rend une
// fois, puis on les réaffiche en pivotant l'image.
const galaxyCache = new Map();

function getGalaxySprite(seed, baseHue) {
  const key = `${seed}|${baseHue}`;
  const cached = galaxyCache.get(key);
  if (cached) return cached;

  const r = 140 + seededRand(seed, 1) * 120;
  const arms = 2 + Math.floor(seededRand(seed, 2) * 3);
  const pad = 30;
  const size = Math.ceil((r + pad) * 2);
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const g = off.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const core = g.createRadialGradient(cx, cy, 0, cx, cy, r * 0.55);
  core.addColorStop(0, `hsla(${baseHue},80%,75%,0.5)`);
  core.addColorStop(0.3, `hsla(${baseHue},70%,55%,0.18)`);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = core;
  g.beginPath();
  g.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  g.fill();

  for (let a = 0; a < arms; a++) {
    const armOff = (a / arms) * Math.PI * 2;
    for (let i = 0; i < 60; i++) {
      const t = i / 60;
      const ang = armOff + t * 3.2;
      const rad = t * r;
      const spread = (seededRand(seed + a, i) - 0.5) * 22 * t;
      const px = Math.cos(ang) * rad + Math.cos(ang + 1.5) * spread;
      const py = Math.sin(ang) * rad * 0.55 + Math.sin(ang + 1.5) * spread;
      const hue = baseHue + (seededRand(i, a) - 0.5) * 40;
      g.globalAlpha = (1 - t) * 0.5;
      g.fillStyle = `hsl(${hue},75%,${65 + seededRand(i, seed) * 20}%)`;
      const sz = (1 - t) * 2.2 + 0.4;
      g.beginPath();
      g.arc(cx + px, cy + py, sz, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  const sprite = {
    canvas: off,
    half: size / 2,
    tilt: seededRand(seed, 3) * Math.PI,
    dir: seededRand(seed, 4) > 0.5 ? 1 : -1,
  };
  galaxyCache.set(key, sprite);
  if (galaxyCache.size > 96) {
    galaxyCache.delete(galaxyCache.keys().next().value);
  }
  return sprite;
}

function drawGalaxy(gx, gy, seed, baseHue) {
  const sp = getGalaxySprite(seed, baseHue);
  const rot = frameCount * 0.0008 * sp.dir;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(sp.tilt + rot);
  ctx.drawImage(sp.canvas, -sp.half, -sp.half);
  ctx.restore();
}

function drawDeepSpace() {
  const par = 0.45;
  const SP = 1100;
  const cx = cam.x * par;
  const cy = cam.y * par;
  const startX = Math.floor((cx - W) / SP);
  const endX = Math.floor((cx + W) / SP);
  const startY = Math.floor((cy - H) / SP);
  const endY = Math.floor((cy + H) / SP);
  for (let gx = startX - 1; gx <= endX + 1; gx++) {
    for (let gy = startY - 1; gy <= endY + 1; gy++) {
      const seed = gx * 73.1 + gy * 149.7;
      if (seededRand(gx + 100, gy + 100) > 0.45) continue;
      const ox = gx * SP + seededRand(gx, gy) * SP * 0.6;
      const oy = gy * SP + seededRand(gy, gx) * SP * 0.6;
      const sx = ox - cx + W / 2;
      const sy = oy - cy + H / 2;
      if (sx < -300 || sx > W + 300 || sy < -300 || sy > H + 300) continue;
      const hue = [270, 180, 40, 200, 330][Math.floor(seededRand(gx + 7, gy + 7) * 5)];
      drawGalaxy(sx, sy, seed, hue);
    }
  }
}

function drawBackground() {
  if (mapTheme === 'forest') {
    drawForestBackground();
    return;
  }
  const c = getBiomeAt(cam.x, cam.y).biome;
  ctx.fillStyle = bgGradient(c.bg, '#000');
  ctx.fillRect(-60, -60, W + 120, H + 120);
  drawDeepSpace();

  const neb = nebulaSprite(c.glow, 0.05);
  for (let i = 0; i < 3; i++) {
    const nx = ((i * 523.3 - cam.x * 0.04) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
    const ny = ((i * 331.7 - cam.y * 0.04) % (H * 1.5) + H * 1.5) % (H * 1.5) - H * 0.25;
    ctx.drawImage(neb.c, nx - 260, ny - 260, 520, 520);
  }

  drawGrid(c.grid, 80);

  for (let layer = 0; layer < 2; layer++) {
    const par = 0.15 + layer * 0.25;
    const sz = layer ? 2 : 1.2;
    ctx.fillStyle = layer ? '#ffffff' : c.glow;
    for (let i = 0; i < 50; i++) {
      const sx = (i * 97.13 + layer * 40) % W;
      const sy = (i * 61.7 + layer * 70) % H;
      const px = (sx - cam.x * par) % W;
      const py = (sy - cam.y * par) % H;
      const fx = (px + W) % W;
      const fy = (py + H) % H;
      ctx.globalAlpha = (0.1 + (i % 5) * 0.06) * (layer ? 1 : 0.7);
      ctx.fillRect(fx, fy, sz, sz);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Bloom « gratuit » : au lieu d'un vrai flou (ctx.filter, très lent sur
// mobile), on réduit l'image dans un petit canvas puis on la ré-agrandit :
// l'interpolation bilinéaire produit naturellement un flou doux.
// ---------------------------------------------------------------------------
function applyBloom() {
  if (gfxLow) return;
  const gw = glowCanvas.width;
  const gh = glowCanvas.height;
  gctx.globalCompositeOperation = 'source-over';
  gctx.globalAlpha = 1;
  gctx.drawImage(canvas, 0, 0, gw, gh);
  gctx.globalCompositeOperation = 'multiply';
  gctx.fillStyle = '#3f3f3f';
  gctx.fillRect(0, 0, gw, gh);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(glowCanvas, 0, 0, W, H);
  ctx.globalAlpha = 0.3;
  ctx.drawImage(glowCanvas, -W * 0.004, -H * 0.004, W * 1.008, H * 1.008);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Scène
// ---------------------------------------------------------------------------
export function drawScene() {
  ctx.save();
  if (shake > 0.5) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawBackground();
  specials.forEach(drawSpecial);
  obstacles.forEach(drawObstacle);
  monsters.forEach(drawMonster);

  player.trail.forEach((t, i) => {
    const p = ws(t.wx, t.wy);
    const a = (1 - i / player.trail.length) * 0.3;
    const r = player.r * (1 - i / player.trail.length) * 0.6;
    ctx.globalAlpha = a;
    ctx.fillStyle = player.boost > 0 ? '#5ad6ff' : '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  for (const hunter of hunters) {
    const trailCol = hunter.type === 'titan' ? '#ff8a2a' : '#ff3344';
    hunter.trail.forEach((t, i) => {
      const p = ws(t.wx, t.wy);
      const a = (1 - i / hunter.trail.length) * 0.25;
      const r = hunter.r * (1 - i / hunter.trail.length) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = trailCol;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;

  particles.forEach((p) => {
    const ps = ws(p.wx, p.wy);
    ctx.globalAlpha = p.life * 0.85;
    ctx.fillStyle = p.color || '#fff';
    ctx.beginPath();
    ctx.arc(ps.x, ps.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (decoy) {
    const ds = ws(decoy.wx, decoy.wy);
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.3) * 0.2;
    drawHalo(ds.x, ds.y, player.r * 2.6, '255,224,102', 0.55);
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ds.x, ds.y, player.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  shockwaves.forEach((sw) => {
    const c = ws(sw.wx, sw.wy);
    ctx.save();
    ctx.globalAlpha = Math.min(1, sw.life) * 0.45;
    ctx.strokeStyle = '#ffaa33';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(c.x, c.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.min(1, sw.life);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c.x, c.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  if (waveWarning > 0 && Math.floor(waveWarning / 5) % 2 === 0) {
    for (const hunter of hunters) {
      const hsw = ws(hunter.wx, hunter.wy);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffaa33';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hsw.x, hsw.y, hunter.r + 20 + Math.sin(frameCount * 0.4) * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  for (const hunter of hunters) {
    const isTitan = hunter.type === 'titan';
    const hs = ws(hunter.wx, hunter.wy);
    if (hs.x > -160 && hs.x < W + 160 && hs.y > -160 && hs.y < H + 160) {
      const pulseR = hunter.r + 8 + Math.sin(hunter.pulse) * 4;
      ctx.globalAlpha = 0.25 + Math.sin(hunter.pulse) * 0.1;
      drawHalo(hs.x, hs.y, pulseR * 1.9, isTitan ? '255,138,42' : '255,50,68', 0.55);
      ctx.globalAlpha = 1;

      if (mapTheme === 'forest') {
        const octoRgb = hunter.stun > 0 ? '150,100,255' : isTitan ? '255,150,60' : '170,70,210';
        drawOctopus(hunter, octoRgb, isTitan ? 26 : 18);
        continue;
      }

      if (isTitan) {
        const ring = getSprite(`titanring|${hunter.r}`, hunter.r * 2.8 + PAD, (g, h) => {
          g.translate(h, h);
          g.shadowBlur = 18;
          g.shadowColor = '#ff8a2a';
          g.strokeStyle = 'rgba(255,150,60,0.85)';
          g.lineWidth = 3;
          const sp = 10;
          g.beginPath();
          for (let i = 0; i < sp * 2; i++) {
            const ang = (i / (sp * 2)) * Math.PI * 2;
            const rr = i % 2 === 0 ? hunter.r * 1.38 : hunter.r * 0.96;
            const px = Math.cos(ang) * rr;
            const py = Math.sin(ang) * rr;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke();
        });
        ctx.save();
        ctx.translate(hs.x, hs.y);
        ctx.rotate(hunter.pulse * 0.18);
        ctx.drawImage(ring.c, -ring.half, -ring.half, ring.w, ring.w);
        ctx.restore();
      }

      const arrowCol = hunter.stun > 0 ? 'rgb(150,100,255)' : isTitan ? 'rgb(255,138,42)' : 'rgb(255,50,68)';
      drawArrow(hunter, arrowCol, isTitan ? 28 : 22);
    }
  }

  if (!player.dead) {
    ctx.globalAlpha = player.invis > 0 ? 0.4 : 1;
    drawArrow(
      player,
      player.boost > 0 ? 'rgb(90,214,255)' : player.invis > 0 ? 'rgb(170,204,255)' : 'rgb(255,255,255)',
      player.boost > 0 ? 24 : 16
    );
    const ps = ws(player.wx, player.wy);
    ctx.save();
    ctx.translate(ps.x, ps.y);
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(255,170,90,0.9)';
    ctx.beginPath();
    ctx.arc(0, player.r * 0.85, 2.4 + Math.random() * 2 + (player.boost > 0 ? 4 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  for (const hunter of hunters) {
    const hs = ws(hunter.wx, hunter.wy);
    if (hs.x < 0 || hs.x > W || hs.y < 0 || hs.y > H) {
      const a = Math.atan2(hunter.wy - player.wy, hunter.wx - player.wx);
      const margin = 30;
      const ex = W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - margin);
      const ey = H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - margin);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ff3344';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  if (waveWarning > 0 && !player.dead && Math.floor(waveWarning / 8) % 2 === 0) {
    ctx.save();
    ctx.font = '900 22px Orbitron,sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffaa33';
    ctx.fillStyle = '#ffaa33';
    ctx.fillText('⚠ ONDE IMMINENTE — FUIS LOIN', W / 2, 108);
    ctx.restore();
  }

  if (biomeFlash > 0) {
    const t = biomeFlash / 120;
    const pulse = Math.sin(t * Math.PI);
    ctx.save();
    ctx.globalAlpha = pulse * 0.45;
    ctx.fillStyle = biomeFlashGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = pulse * 0.7;
    ctx.strokeStyle = biomeFlashGlow;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, (1 - t) * Math.max(W, H) * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, t * 1.5);
    ctx.shadowBlur = 12;
    ctx.shadowColor = biomeFlashGlow;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '900 13px Orbitron,sans-serif';
    ctx.fillText('▸ NOUVEAU SECTEUR ◂', W / 2, H * 0.4 - 28);
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#fff';
    ctx.font = '900 34px Orbitron,sans-serif';
    ctx.fillText(biomeFlashName, W / 2, H * 0.4 + 10);
    ctx.restore();
  }

  applyBloom();
}
