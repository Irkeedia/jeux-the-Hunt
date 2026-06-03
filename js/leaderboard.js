const NAME_KEY = 'the-hunt:player-name';
const DB_NAME = 'the-hunt-db';
const DB_VERSION = 1;
const STORE = 'scores';

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

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('points', 'points');
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function listBrowserScores(limit) {
  const scores = await withStore('readonly', (store) => {
    const rows = [];
    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return;
      rows.push(cursor.value);
      cursor.continue();
    };
    return rows;
  });

  return scores
    .sort((a, b) => b.points - a.points || new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, limit);
}

async function addBrowserScore(entry) {
  await withStore('readwrite', (store) => {
    store.put(entry);
  });
  const rows = await listBrowserScores(50);
  const rank = rows.findIndex((r) => r.id === entry.id) + 1;
  return { rank, total: rows.length, storage: 'browser' };
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatRow(row, index) {
  const time = formatTime(row.time);
  return `${index + 1}. ${row.name} · ${row.points} pts · ${time} · ${row.distance}m · x${row.hunters}`;
}

export async function loadLeaderboard(limit = 10) {
  try {
    return { scores: await listBrowserScores(limit), storage: 'browser' };
  } catch {
    return { scores: [], storage: 'unavailable' };
  }
}

export async function submitScore({ name, time, distance, hunters }) {
  const entry = {
    id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || 'Anonyme').trim().slice(0, 16) || 'Anonyme',
    time,
    distance: Math.floor(distance),
    hunters,
    points: computePoints(time, distance),
    createdAt: new Date().toISOString(),
  };

  setPlayerName(entry.name);

  try {
    return await addBrowserScore(entry);
  } catch {
    return { rank: null, total: 0, storage: 'unavailable' };
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
      storage === 'browser'
        ? 'Sauvegarde dans ce navigateur'
        : 'Sauvegarde indisponible sur ce navigateur';
  }
}

export async function refreshLeaderboard() {
  const { scores, storage } = await loadLeaderboard(10);
  renderLeaderboardList(scores, storage);
}

export function showScoreForm(show) {
  const form = document.getElementById('score-form');
  if (form) form.style.display = show ? 'flex' : 'none';
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
      saveBtn.textContent = 'ENREGISTRER';
    }, 1500);
  });

  refreshLeaderboard();
}

export function onGameOver({ time, distance, hunters }) {
  setLastRun({ time, distance, hunters });
  showScoreForm(true);
  const nameInput = document.getElementById('player-name');
  const nameMenu = document.getElementById('player-name-menu');
  if (nameInput && !nameInput.value) {
    nameInput.value = nameMenu?.value?.trim() || getPlayerName();
  }
  refreshLeaderboard();
}

export function refreshMenuLeaderboard() {
  refreshLeaderboard();
}
