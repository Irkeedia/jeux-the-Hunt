const API = '/api/scores';
const NAME_KEY = 'the-hunt:player-name';
const LOCAL_KEY = 'the-hunt:local-scores';

let lastRun = null;

export function getPlayerName() {
  return localStorage.getItem(NAME_KEY) || '';
}

export function setPlayerName(name) {
  localStorage.setItem(NAME_KEY, String(name).trim().slice(0, 16));
}

export function computePoints(timeSec, distance) {
  return Math.floor(timeSec) * 100 + Math.max(0, distance);
}

export function setLastRun(stats) {
  lastRun = stats;
}

export function getLastRun() {
  return lastRun;
}

function readLocalScores() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocalScores(rows) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 50)));
}

function addLocalScore(entry) {
  const rows = readLocalScores();
  rows.push(entry);
  rows.sort((a, b) => b.points - a.points);
  writeLocalScores(rows);
  const rank = rows.findIndex((r) => r.id === entry.id) + 1;
  return { rank, total: rows.length, storage: 'local' };
}

function listLocalScores(limit) {
  return readLocalScores()
    .slice()
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatRow(row, index) {
  const time = formatTime(row.time);
  return `${index + 1}. ${row.name} — ${time} · ${row.distance} u. (${row.hunters}×) · ${row.points} pts`;
}

async function fetchRemote(limit) {
  const res = await fetch(`${API}?limit=${limit}`);
  if (!res.ok) throw new Error('API indisponible');
  const data = await res.json();
  return { scores: data.scores || [], storage: data.storage || 'remote' };
}

export async function loadLeaderboard(limit = 10) {
  try {
    return await fetchRemote(limit);
  } catch {
    return { scores: listLocalScores(limit), storage: 'local' };
  }
}

export async function submitScore({ name, time, distance, hunters }) {
  const entry = {
    id: `local-${Date.now()}`,
    name: (name || 'Anonyme').trim().slice(0, 16) || 'Anonyme',
    time,
    distance: Math.floor(distance),
    hunters,
    points: computePoints(time, distance),
    createdAt: new Date().toISOString(),
  };

  setPlayerName(entry.name);

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: entry.name,
        time: entry.time,
        distance: entry.distance,
        hunters: entry.hunters,
      }),
    });
    if (!res.ok) throw new Error('Échec enregistrement');
    const data = await res.json();
    addLocalScore(data.entry || entry);
    return data;
  } catch {
    return addLocalScore(entry);
  }
}

export function renderLeaderboardList(scores, storage) {
  const list = document.getElementById('leaderboard-list');
  const hint = document.getElementById('leaderboard-hint');
  if (!list) return;

  list.innerHTML = '';
  if (!scores.length) {
    list.innerHTML = '<li class="lb-empty">Aucun record — sois le premier.</li>';
  } else {
    scores.forEach((row, i) => {
      const li = document.createElement('li');
      li.textContent = formatRow(row, i);
      list.appendChild(li);
    });
  }

  if (hint) {
    hint.textContent =
      storage === 'redis'
        ? 'Classement en ligne (Redis Vercel)'
        : storage === 'local' || storage === 'memory'
          ? 'Classement local (API non connectée ou dev)'
          : 'Classement';
  }
}

export async function refreshLeaderboard() {
  const { scores, storage } = await loadLeaderboard(10);
  renderLeaderboardList(scores, storage);
}

export function showScoreForm(show) {
  const form = document.getElementById('score-form');
  if (form) form.classList.toggle('hidden', !show);
}

export function initLeaderboardUI() {
  const nameInput = document.getElementById('player-name');
  const saveBtn = document.getElementById('save-score');
  const saved = getPlayerName();
  if (nameInput && saved) nameInput.value = saved;

  saveBtn?.addEventListener('click', async () => {
    const run = getLastRun();
    if (!run) return;
    const name = nameInput?.value?.trim() || 'Anonyme';
    saveBtn.disabled = true;
    saveBtn.textContent = '…';
    const result = await submitScore({
      name,
      time: run.time,
      distance: run.distance,
      hunters: run.hunters,
    });
    saveBtn.textContent = result.rank ? `ENREGISTRÉ (#${result.rank})` : 'ENREGISTRÉ';
    await refreshLeaderboard();
    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'ENREGISTRER LE SCORE';
    }, 1500);
  });

  refreshLeaderboard();
}

export function onGameOver({ time, distance, hunters }) {
  setLastRun({ time, distance, hunters });
  showScoreForm(true);
  const nameInput = document.getElementById('player-name');
  if (nameInput && !nameInput.value) nameInput.value = getPlayerName();
}

export function onMenuOpen() {
  showScoreForm(false);
  refreshLeaderboard();
}
