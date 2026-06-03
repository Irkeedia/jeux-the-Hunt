import { CAMP_RADIUS, CAMP_WINDOW, HUNTER_BASE_MAXSP } from './config.js';
import { onGameOver, onMenuOpen } from './leaderboard.js';
import { makeJoy } from './input.js';
import { drawScene, updateHUD } from './render.js';
import {
  cam,
  campHistory,
  campTriggers,
  decoy,
  distance,
  elapsed,
  frameCount,
  generatedCells,
  generatedMazes,
  hunterCount,
  hunters,
  joy,
  setGameState,
  setHunterCount,
  setJoy,
  keys,
  makeHunter,
  obstacles,
  particles,
  player,
  powTimer,
  shake,
  shockwaves,
  specials,
  waveWarning,
} from './state.js';
import { explode, getBiomeAt } from './utils.js';
import { circleBlocked, ensureGenAround, hunterAvoidDir } from './world.js';

export function setHunters(n) {
  setHunterCount(n);
  document.querySelectorAll('.hs-btn').forEach((b) => b.classList.toggle('active', +b.dataset.n === n));
}

export function showPow(txt, col) {
  const el = document.getElementById('powerup-tag');
  el.textContent = txt;
  el.style.color = col;
  powTimer = 120;
}

function caught(byWave) {
  if (player.dead) return;
  player.dead = true;
  shake = 28;
  explode(player.wx, player.wy, 44, byWave ? '#ffaa33' : '#ff3344');
  setTimeout(() => {
    setGameState('dead');
    const o = document.getElementById('overlay');
    o.classList.remove('hidden');
    o.classList.add('dead');
    o.querySelector('h1').textContent = byWave ? 'PULVÉRISÉ' : 'ATTRAPÉ';
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    document.getElementById('overlay-msg').innerHTML =
      `TU AS SURVÉCU<br>${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}<br>DISTANCE : ${distance}`;
    document.querySelector('.tip').style.display = 'none';
    document.getElementById('hunter-select').style.display = 'flex';
    document.getElementById('btn').textContent = '[ FUIR ENCORE ]';
    onGameOver({ time: elapsed, distance, hunters: hunterCount });
  }, 800);
}

export function update() {
  if (!joy) return;

  frameCount++;
  elapsed += 1 / 60;
  ensureGenAround(player.wx, player.wy);

  let ix = joy.dx;
  let iy = joy.dy;
  if (keys.ArrowLeft || keys.a) ix -= 1;
  if (keys.ArrowRight || keys.d) ix += 1;
  if (keys.ArrowUp || keys.w) iy -= 1;
  if (keys.ArrowDown || keys.s) iy += 1;
  const mag = Math.sqrt(ix * ix + iy * iy);
  if (mag > 0.15) {
    const dir = Math.atan2(iy, ix);
    player.angle = dir;
    const a = player.ACCEL * Math.min(mag, 1) * (player.inMud ? 0.4 : 1);
    player.vx += Math.cos(dir) * a;
    player.vy += Math.sin(dir) * a;
  }
  const fric = player.FRICTION * (player.inMud ? 0.85 : 1);
  player.vx *= fric;
  player.vy *= fric;
  if (player.boost > 0) player.boost--;
  if (player.invis > 0) player.invis--;
  const pmax = player.MAXSP * (player.boost > 0 ? 2.6 : 1) * (player.inMud ? 0.5 : 1);
  let psp = Math.sqrt(player.vx ** 2 + player.vy ** 2);
  if (psp > pmax) {
    player.vx = (player.vx / psp) * pmax;
    player.vy = (player.vy / psp) * pmax;
  }
  player.wx += player.vx;
  player.wy += player.vy;
  const pb = circleBlocked(player.wx, player.wy, player.r);
  if (pb.hit) {
    player.wx += pb.nx * pb.push;
    player.wy += pb.ny * pb.push;
    const dot = player.vx * pb.nx + player.vy * pb.ny;
    if (dot < 0) {
      player.vx -= dot * pb.nx;
      player.vy -= dot * pb.ny;
    }
  }

  if (player.boost > 0 && frameCount % 2 === 0) {
    particles.push({
      wx: player.wx,
      wy: player.wy,
      vx: -player.vx * 0.3 + (Math.random() - 0.5),
      vy: -player.vy * 0.3 + (Math.random() - 0.5),
      life: 1,
      decay: 0.06,
      r: 3 + Math.random() * 3,
      color: '#5ad6ff',
    });
  }

  player.trail.unshift({ wx: player.wx, wy: player.wy });
  if (player.trail.length > 22) player.trail.pop();
  distance = Math.round(Math.sqrt(player.wx ** 2 + player.wy ** 2) / 10);

  player.inMud = false;
  for (const s of specials) {
    const d = Math.sqrt((player.wx - s.wx) ** 2 + (player.wy - s.wy) ** 2);
    if (s.type === 'accel' && d < s.r && player.boost <= 0) {
      player.boost = 55;
      explode(player.wx, player.wy, 18, '#5ad6ff');
      shake = Math.max(shake, 6);
    } else if (s.type === 'tele' && d < s.r && s.cd <= 0) {
      explode(player.wx, player.wy, 24, s.col);
      player.wx = s.destX;
      player.wy = s.destY;
      cam.x = player.wx;
      cam.y = player.wy;
      s.cd = 60;
      explode(player.wx, player.wy, 24, s.col);
      shake = Math.max(shake, 8);
    } else if (s.type === 'blackhole') {
      if (d < s.pull && d > 1) {
        const f = (1 - d / s.pull) * 0.6;
        player.vx += ((s.wx - player.wx) / d) * f;
        player.vy += ((s.wy - player.wy) / d) * f;
      }
      if (d < s.r * 0.6) caught(false);
    } else if (s.type === 'mud' && d < s.r) {
      player.inMud = true;
    } else if (s.type === 'bonus' && !s.taken && d < s.r + player.r) {
      s.taken = true;
      explode(s.wx, s.wy, 20, '#ffe066');
      if (s.bonus === 'decoy') {
        decoy = { wx: player.wx, wy: player.wy, life: 240 };
        showPow('LEURRE DÉPLOYÉ', '#ffe066');
      } else if (s.bonus === 'invis') {
        player.invis = 240;
        showPow('INVISIBILITÉ', '#aaccff');
      } else if (s.bonus === 'speed') {
        player.baseMAX += 0.6;
        player.MAXSP = player.baseMAX;
        showPow('VITESSE +', '#66ff99');
      }
    }
    if (s.cd > 0) s.cd--;
  }

  campHistory.push({ wx: player.wx, wy: player.wy });
  if (campHistory.length > CAMP_WINDOW) campHistory.shift();
  if (waveWarning <= 0 && campHistory.length >= CAMP_WINDOW) {
    let cx = 0;
    let cy = 0;
    for (const p of campHistory) {
      cx += p.wx;
      cy += p.wy;
    }
    cx /= campHistory.length;
    cy /= campHistory.length;
    let maxR = 0;
    for (const p of campHistory) {
      const dist = Math.sqrt((p.wx - cx) ** 2 + (p.wy - cy) ** 2);
      if (dist > maxR) maxR = dist;
    }
    if (maxR < CAMP_RADIUS) waveWarning = 90;
  }
  if (waveWarning > 0) {
    waveWarning--;
    if (waveWarning === 0) {
      campTriggers++;
      for (const h of hunters) {
        shockwaves.push({ wx: h.wx, wy: h.wy, r: 0, maxR: 520, life: 1, speed: 9 });
      }
      shake = Math.max(shake, 14);
      for (const h of hunters) {
        h.MAXSP = HUNTER_BASE_MAXSP + campTriggers * 0.7;
        h.ACCEL = 0.24 + campTriggers * 0.04;
      }
      campHistory.length = 0;
    }
  }

  shockwaves.forEach((sw) => {
    sw.r += sw.speed;
    if (sw.r > sw.maxR) sw.life -= 0.05;
    if (!player.dead) {
      const pd = Math.sqrt((player.wx - sw.wx) ** 2 + (player.wy - sw.wy) ** 2);
      if (Math.abs(pd - sw.r) < player.r + 14 && sw.life > 0.5) caught(true);
    }
  });
  shockwaves.splice(0, shockwaves.length, ...shockwaves.filter((sw) => sw.life > 0));

  if (decoy) {
    decoy.life--;
    if (decoy.life <= 0) decoy = null;
  }

  let minHd = Infinity;
  for (const hunter of hunters) {
    let tx = player.wx;
    let ty = player.wy;
    if (decoy) {
      tx = decoy.wx;
      ty = decoy.wy;
    } else if (player.invis > 0) {
      tx = hunter.wx + hunter.vx * 20;
      ty = hunter.wy + hunter.vy * 20;
    }

    if (hunter.stun > 0) {
      hunter.stun--;
      hunter.vx *= 0.8;
      hunter.vy *= 0.8;
      hunter.wx += hunter.vx;
      hunter.wy += hunter.vy;
    } else {
      const desiredDir = hunterAvoidDir(hunter.wx, hunter.wy, tx, ty);
      hunter.angle = desiredDir;
      hunter.vx += Math.cos(desiredDir) * hunter.ACCEL;
      hunter.vy += Math.sin(desiredDir) * hunter.ACCEL;

      for (const s of specials) {
        if (s.type !== 'field') continue;
        const dd = Math.sqrt((hunter.wx - s.wx) ** 2 + (hunter.wy - s.wy) ** 2);
        if (dd < s.r && dd > 1) {
          const f = (1 - dd / s.r) * 0.9;
          hunter.vx += ((hunter.wx - s.wx) / dd) * f;
          hunter.vy += ((hunter.wy - s.wy) / dd) * f;
        }
      }
      for (const s of specials) {
        if (s.type !== 'blackhole') continue;
        const dd = Math.sqrt((hunter.wx - s.wx) ** 2 + (hunter.wy - s.wy) ** 2);
        if (dd < s.pull && dd > 1) {
          const f = (1 - dd / s.pull) * 0.5;
          hunter.vx += ((s.wx - hunter.wx) / dd) * f;
          hunter.vy += ((s.wy - hunter.wy) / dd) * f;
        }
        if (dd < s.r * 0.6) {
          hunter.stun = 40;
          explode(hunter.wx, hunter.wy, 10, '#8844ff');
        }
      }

      hunter.vx *= hunter.FRICTION;
      hunter.vy *= hunter.FRICTION;
      let hsp = Math.sqrt(hunter.vx ** 2 + hunter.vy ** 2);
      if (hsp > hunter.MAXSP) {
        hunter.vx = (hunter.vx / hsp) * hunter.MAXSP;
        hunter.vy = (hunter.vy / hsp) * hunter.MAXSP;
      }
      hunter.wx += hunter.vx;
      hunter.wy += hunter.vy;
    }

    for (const other of hunters) {
      if (other === hunter) continue;
      const sdx = hunter.wx - other.wx;
      const sdy = hunter.wy - other.wy;
      const sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
      if (sd < hunter.r * 2.4) {
        const f = (hunter.r * 2.4 - sd) * 0.5;
        hunter.wx += (sdx / sd) * f;
        hunter.wy += (sdy / sd) * f;
      }
    }

    const hb = circleBlocked(hunter.wx, hunter.wy, hunter.r);
    if (hb.hit) {
      hunter.wx += hb.nx * hb.push;
      hunter.wy += hb.ny * hb.push;
      const dot = hunter.vx * hb.nx + hunter.vy * hb.ny;
      hunter.vx -= dot * hb.nx;
      hunter.vy -= dot * hb.ny;
      hunter.vx *= 0.8;
      hunter.vy *= 0.8;
      hunter.vx += -hb.ny * 0.4;
      hunter.vy += hb.nx * 0.4;
    }

    hunter.pulse += 0.15;
    hunter.trail.unshift({ wx: hunter.wx, wy: hunter.wy });
    if (hunter.trail.length > 16) hunter.trail.pop();

    const hd = Math.sqrt((player.wx - hunter.wx) ** 2 + (player.wy - hunter.wy) ** 2);
    if (hd < minHd) minHd = hd;
    if (hd < player.r + hunter.r && player.invis <= 0) caught(false);
  }

  cam.x += (player.wx - cam.x) * 0.12;
  cam.y += (player.wy - cam.y) * 0.12;
  if (shake > 0) shake *= 0.88;

  const danger = Math.max(0, Math.min(1, 1 - (minHd - 60) / 360));
  const db = document.getElementById('danger-bar');
  db.style.background = `rgba(255,50,68,${danger * 0.9})`;
  db.style.height = `${2 + danger * 5}px`;
  if (danger > 0.85 && frameCount % 6 === 0) shake = Math.max(shake, danger * 4);

  particles.forEach((p) => {
    p.wx += p.vx;
    p.wy += p.vy;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= p.decay;
  });
  particles.splice(0, particles.length, ...particles.filter((p) => p.life > 0));

  document.getElementById('biome-tag').textContent = getBiomeAt(player.wx, player.wy).biome.name;

  if (powTimer > 0) {
    powTimer--;
    if (powTimer <= 0) document.getElementById('powerup-tag').textContent = '';
  }

  updateHUD(elapsed, distance);
}

export function startGame() {
  elapsed = 0;
  frameCount = 0;
  distance = 0;
  player.wx = 0;
  player.wy = 0;
  player.vx = 0;
  player.vy = 0;
  player.angle = -Math.PI / 2;
  player.dead = false;
  player.trail = [];
  player.boost = 0;
  player.invis = 0;
  player.inMud = false;
  player.baseMAX = 7.2;
  player.MAXSP = 7.2;
  hunters.length = 0;
  for (let i = 0; i < hunterCount; i++) {
    const h = makeHunter();
    const ang = Math.PI / 2 + (i - (hunterCount - 1) / 2) * 0.7;
    h.wx = Math.cos(ang) * 560;
    h.wy = Math.sin(ang) * 560;
    h.MAXSP = HUNTER_BASE_MAXSP;
    h.ACCEL = 0.24;
    hunters.push(h);
  }
  cam.x = 0;
  cam.y = 0;
  shake = 0;
  particles.length = 0;
  obstacles.length = 0;
  specials.length = 0;
  generatedCells.clear();
  generatedMazes.clear();
  decoy = null;
  campHistory.length = 0;
  waveWarning = 0;
  shockwaves.length = 0;
  campTriggers = 0;
  powTimer = 0;
  document.getElementById('powerup-tag').textContent = '';
  ensureGenAround(0, 0);
  if (!joy) setJoy(makeJoy('joy-main'));
  onMenuOpen();
  const o = document.getElementById('overlay');
  o.classList.add('hidden');
  o.classList.remove('dead');
  document.querySelector('.tip').style.display = '';
  document.getElementById('hunter-select').style.display = 'flex';
  document.getElementById('btn').textContent = '[ FUIR ]';
  o.querySelector('h1').textContent = 'THE HUNT';
  document.getElementById('overlay-msg').innerHTML =
    'QUELQUE CHOSE TE TRAQUE<br>SURVIS LE PLUS LONGTEMPS POSSIBLE';
  document.getElementById('joy-main').style.display = 'flex';
  setGameState('playing');
}
