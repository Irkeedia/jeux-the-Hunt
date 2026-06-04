import { CAM_Y_OFFSET } from './config.js';
import {
  W,
  H,
  cam,
  canvas,
  ctx,
  decoy,
  frameCount,
  glowCanvas,
  gctx,
  hunters,
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

export function updateHUD(elapsed, distance) {
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  document.getElementById('time-val').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  document.getElementById('dist-val').textContent = distance;
}

function drawObstacle(o) {
  const os = ws(o.wx, o.wy);
  if (os.x < -200 || os.x > W + 200 || os.y < -200 || os.y > H + 200) return;
  const b = o.biome;
  ctx.save();
  ctx.translate(os.x, os.y);
  ctx.rotate(o.rot);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.type === 'hex') {
    ctx.shadowBlur = 14;
    ctx.shadowColor = b.glow;
    ctx.strokeStyle = b.glow;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = b.fill;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * o.r;
      const py = Math.sin(a) * o.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = b.glow;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, o.r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (o.type === 'tube') {
    ctx.shadowBlur = 14;
    ctx.shadowColor = b.glow;
    ctx.strokeStyle = b.glow;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = b.fill;
    const hw = o.len / 2;
    const th = o.th;
    ctx.beginPath();
    ctx.moveTo(-hw, -th / 2);
    ctx.lineTo(hw, -th / 2);
    ctx.arc(hw, 0, th / 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-hw, th / 2);
    ctx.arc(-hw, 0, th / 2, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = b.glow;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo((i * hw) / 3, -th / 2 + 3);
      ctx.lineTo((i * hw) / 3, th / 2 - 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (o.type === 'spiral') {
    ctx.shadowBlur = 16;
    ctx.shadowColor = b.glow;
    ctx.strokeStyle = b.glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.15) {
      const rr = o.r * (a / (Math.PI * 5));
      const px = Math.cos(a + frameCount * 0.005) * rr;
      const py = Math.sin(a + frameCount * 0.005) * rr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = b.fill;
    ctx.beginPath();
    ctx.arc(0, 0, o.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'bridge') {
    ctx.shadowBlur = 14;
    ctx.shadowColor = b.glow;
    ctx.strokeStyle = b.glow;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = b.fill;
    const off = o.gap / 2 + o.pr;
    [1, -1].forEach((s) => {
      ctx.beginPath();
      ctx.arc(0, s * off, o.pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, off - o.pr);
    ctx.lineTo(0, -off + o.pr);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  } else if (o.type === 'doorguard') {
    // porte du refuge : ouverte pour le joueur, infranchissable pour l'ennemi
    const hw = o.len / 2;
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#63dcff';
    ctx.strokeStyle = 'rgba(99,220,255,0.8)';
    ctx.fillStyle = 'rgba(99,220,255,0.95)';
    ctx.lineWidth = 2;
    [-hw, hw].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 0.22 + Math.sin(frameCount * 0.12) * 0.12;
    ctx.setLineDash([6, 9]);
    ctx.beginPath();
    ctx.moveTo(-hw, 0);
    ctx.lineTo(hw, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
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

  ctx.save();
  ctx.translate(ps.x, ps.y);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, m.r * 3);
  halo.addColorStop(0, `rgba(${col},0.5)`);
  halo.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, m.r * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(m.pulse * 0.3);
  ctx.shadowBlur = m.aggro ? 26 : 16;
  ctx.shadowColor = `rgba(${col},1)`;
  ctx.fillStyle = `rgba(${col},0.9)`;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  const spikes = 9;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? m.r * (1.1 + Math.sin(m.pulse) * 0.12) : m.r * 0.62;
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, m.r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = m.aggro ? '#ff2266' : '#3a1a5a';
  ctx.beginPath();
  ctx.arc(0, 0, m.r * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;

  if (m.aggro) {
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.3) * 0.2;
    ctx.strokeStyle = `rgba(${col},1)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ps.x, ps.y, m.r + 10 + Math.sin(frameCount * 0.2) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawSpecial(s) {
  const os = ws(s.wx, s.wy);
  if (os.x < -200 || os.x > W + 200 || os.y < -200 || os.y > H + 200) return;
  ctx.save();
  ctx.translate(os.x, os.y);
  const t = frameCount * 0.1 + (s.phase || 0);
  if (s.type === 'accel') {
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#5ad6ff';
    ctx.strokeStyle = 'rgba(90,214,255,0.9)';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(90,214,255,0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(s.rot);
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
    ctx.shadowBlur = 22;
    ctx.shadowColor = s.col;
    ctx.strokeStyle = s.col;
    ctx.lineWidth = 3;
    for (let r = 0; r < 3; r++) {
      ctx.globalAlpha = 0.4 + Math.sin(t + r) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, s.r - r * 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.col;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    const dest = ws(s.destX, s.destY);
    ctx.globalAlpha = 0.15;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dest.x - os.x, dest.y - os.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  } else if (s.type === 'blackhole') {
    const rr = s.pull;
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    grd.addColorStop(0, 'rgba(120,60,255,0.35)');
    grd.addColorStop(0.5, 'rgba(60,20,120,0.12)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,100,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const ar = s.r * (a / (Math.PI * 4));
      const px = Math.cos(a + t) * ar;
      const py = Math.sin(a + t) * ar;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#7733ff';
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.type === 'field') {
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#44ff99';
    ctx.strokeStyle = 'rgba(68,255,153,0.5)';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + Math.sin(t) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#44ff99';
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.2;
    for (let ring = 1; ring <= 2; ring++) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.2;
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
    ctx.fillStyle = 'rgba(90,70,40,0.4)';
    ctx.strokeStyle = 'rgba(140,110,60,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 5; i++) {
      const a = seededRand(s.wx + i, s.wy) * Math.PI * 2;
      const rr = seededRand(s.wx, s.wy + i) * s.r * 0.6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 4 + seededRand(i, i) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (s.type === 'bonus' && !s.taken) {
    const col = s.bonus === 'decoy' ? '#ffe066' : s.bonus === 'invis' ? '#aaccff' : '#66ff99';
    ctx.shadowBlur = 18;
    ctx.shadowColor = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    const bob = Math.sin(t) * 4;
    ctx.translate(0, bob);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? s.r : s.r * 0.45;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawArrow(ent, color, glow) {
  const ps = ws(ent.wx, ent.wy);
  const rgbMatch = color.match(/\d+/g);
  const rgb = rgbMatch ? `${rgbMatch[0]},${rgbMatch[1]},${rgbMatch[2]}` : '255,255,255';
  const halo = ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, ent.r * 4.4);
  halo.addColorStop(0, `rgba(${rgb},0.6)`);
  halo.addColorStop(0.45, `rgba(${rgb},0.16)`);
  halo.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ps.x, ps.y, ent.r * 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(ps.x, ps.y);
  ctx.rotate(ent.angle + Math.PI / 2);
  ctx.shadowBlur = glow;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const s = ent.r;

  const fillGrad = ctx.createLinearGradient(0, -s * 1.25, 0, s * 1.05);
  fillGrad.addColorStop(0, `rgba(255,255,255,0.9)`);
  fillGrad.addColorStop(0.18, `rgba(${rgb},0.72)`);
  fillGrad.addColorStop(1, `rgba(${rgb},0.18)`);
  ctx.fillStyle = fillGrad;

  // Forme plus ronde et lisible qu'une simple flèche.
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.28);
  ctx.bezierCurveTo(s * 0.95, -s * 0.68, s * 1.08, s * 0.38, s * 0.46, s * 0.86);
  ctx.bezierCurveTo(s * 0.2, s * 1.06, -s * 0.2, s * 1.06, -s * 0.46, s * 0.86);
  ctx.bezierCurveTo(-s * 1.08, s * 0.38, -s * 0.95, -s * 0.68, 0, -s * 1.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = glow * 0.35;
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.88);
  ctx.quadraticCurveTo(s * 0.12, -s * 0.08, 0, s * 0.52);
  ctx.stroke();

  ctx.fillStyle = `rgba(${rgb},0.95)`;
  ctx.shadowBlur = glow * 0.45;
  ctx.beginPath();
  ctx.arc(0, -s * 0.12, s * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGalaxy(gx, gy, seed, baseHue) {
  const r = 140 + seededRand(seed, 1) * 120;
  const arms = 2 + Math.floor(seededRand(seed, 2) * 3);
  const tilt = seededRand(seed, 3) * Math.PI;
  const rot = frameCount * 0.0008 * (seededRand(seed, 4) > 0.5 ? 1 : -1);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(tilt + rot);
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
  core.addColorStop(0, `hsla(${baseHue},80%,75%,0.5)`);
  core.addColorStop(0.3, `hsla(${baseHue},70%,55%,0.18)`);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
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
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.fillStyle = `hsl(${hue},75%,${65 + seededRand(i, seed) * 20}%)`;
      const sz = (1 - t) * 2.2 + 0.4;
      ctx.beginPath();
      ctx.arc(px, py, sz, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
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
  const c = getBiomeAt(cam.x, cam.y).biome;
  const grd = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.8);
  grd.addColorStop(0, c.bg);
  grd.addColorStop(1, '#000');
  ctx.fillStyle = grd;
  ctx.fillRect(-60, -60, W + 120, H + 120);
  drawDeepSpace();
  for (let i = 0; i < 3; i++) {
    const nx = ((i * 523.3 - cam.x * 0.04) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
    const ny = ((i * 331.7 - cam.y * 0.04) % (H * 1.5) + H * 1.5) % (H * 1.5) - H * 0.25;
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, 260);
    ng.addColorStop(0, c.glow.replace(/[\d.]+\)$/, '0.05)'));
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng;
    ctx.fillRect(nx - 260, ny - 260, 520, 520);
  }
  const gs = 80;
  ctx.strokeStyle = c.grid;
  ctx.lineWidth = 1;
  const yoff = H * CAM_Y_OFFSET;
  const ox = ((-cam.x % gs) + gs) % gs;
  const oy = (((-cam.y + yoff) % gs) + gs) % gs;
  for (let x = ox - gs; x < W + gs; x += gs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = oy - gs; y < H + gs; y += gs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
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

function applyBloom() {
  const gw = glowCanvas.width;
  const gh = glowCanvas.height;
  gctx.clearRect(0, 0, gw, gh);
  gctx.globalCompositeOperation = 'source-over';
  gctx.globalAlpha = 1;
  gctx.drawImage(canvas, 0, 0, gw, gh);
  gctx.globalCompositeOperation = 'multiply';
  gctx.globalAlpha = 1;
  gctx.fillStyle = '#3a3a3a';
  gctx.fillRect(0, 0, gw, gh);
  gctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(8px)';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(glowCanvas, 0, 0, W, H);
  ctx.filter = 'blur(18px)';
  ctx.globalAlpha = 0.7;
  ctx.drawImage(glowCanvas, 0, 0, W, H);
  ctx.filter = 'none';
  ctx.restore();
}

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
    hunter.trail.forEach((t, i) => {
      const p = ws(t.wx, t.wy);
      const a = (1 - i / hunter.trail.length) * 0.25;
      const r = hunter.r * (1 - i / hunter.trail.length) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff3344';
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
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ffe066';
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
    ctx.globalAlpha = Math.min(1, sw.life);
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ffaa33';
    ctx.strokeStyle = '#ffaa33';
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
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#ffaa33';
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
    const hs = ws(hunter.wx, hunter.wy);
    const pulseR = hunter.r + 8 + Math.sin(hunter.pulse) * 4;
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(hunter.pulse) * 0.1;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff3344';
    ctx.fillStyle = 'rgba(255,50,68,0.15)';
    ctx.beginPath();
    ctx.arc(hs.x, hs.y, pulseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawArrow(hunter, hunter.stun > 0 ? 'rgb(150,100,255)' : 'rgb(255,50,68)', 22);
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
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffa050';
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
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff3344';
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

  applyBloom();
}
