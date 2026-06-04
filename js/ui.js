const overlay = () => document.getElementById('overlay');

export function setOverlayMode(mode) {
  const o = overlay();
  if (!o) return;
  o.classList.remove('mode-menu', 'mode-dead');
  if (mode) o.classList.add(mode);
}

export function showMenu() {
  document.body.classList.add('menu-open');
  document.body.classList.remove('playing');
  const o = overlay();
  if (o) o.classList.remove('hidden');
  setOverlayMode('mode-menu');
  document.getElementById('panel-menu')?.classList.remove('hidden');
  document.getElementById('panel-dead')?.classList.add('hidden');
  document.getElementById('hud')?.classList.add('hud-hidden');
  document.getElementById('joy-main').style.display = 'none';
}

export function showDeadScreen({ title, timeText, distance }) {
  document.body.classList.add('menu-open');
  document.body.classList.remove('playing');
  const o = overlay();
  if (o) {
    o.classList.remove('hidden');
    setOverlayMode('mode-dead');
  }
  document.getElementById('panel-menu')?.classList.add('hidden');
  document.getElementById('panel-dead')?.classList.remove('hidden');
  document.getElementById('dead-title').textContent = title;
  document.getElementById('dead-time').textContent = timeText;
  document.getElementById('dead-distance').textContent = String(distance);
  document.getElementById('hud')?.classList.add('hud-hidden');
  document.getElementById('joy-main').style.display = 'none';
}

export function showGameplay() {
  document.body.classList.remove('menu-open');
  document.body.classList.add('playing');
  overlay()?.classList.add('hidden');
  document.getElementById('hud')?.classList.remove('hud-hidden');
  document.getElementById('joy-main').style.display = 'flex';
}

export function initUI({ onPlay, onHuntersChange, onModeChange, onHome }) {
  const playBtn = document.getElementById('btn-play');
  if (playBtn) {
    playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPlay();
    });
  }

  document.querySelectorAll('.hs-btn').forEach((btn) => {
    btn.addEventListener('click', () => onHuntersChange(Number(btn.dataset.n)));
  });

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      onModeChange?.(btn.dataset.mode);
    });
  });

  const homeBtn = document.getElementById('btn-home');
  homeBtn?.addEventListener('click', () => onHome?.());

  const nameMenu = document.getElementById('player-name-menu');
  const nameDead = document.getElementById('player-name');
  if (nameMenu && nameDead) {
    nameMenu.addEventListener('input', () => {
      nameDead.value = nameMenu.value;
    });
  }

  const retryBtn = document.getElementById('btn-retry');
  retryBtn?.addEventListener('click', onPlay);

  window.addEventListener('keydown', (e) => {
    const isLaunchKey = e.code === 'Enter' || e.code === 'Space';
    if (!isLaunchKey || document.body.classList.contains('playing')) return;
    const active = document.activeElement;
    if (active?.tagName === 'INPUT') return;
    e.preventDefault();
    onPlay();
  });

  showMenu();
}
