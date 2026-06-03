import { keys } from './state.js';

export function makeJoy(zoneId) {
  const zone = document.getElementById(zoneId);
  const base = zone.querySelector('.joy-base');
  const knob = zone.querySelector('.joy-knob');
  const st = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0, R: 46 };

  zone.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const r = base.getBoundingClientRect();
      st.active = true;
      st.id = t.identifier;
      st.bx = r.left + r.width / 2;
      st.by = r.top + r.height / 2;
      upd(t.clientX, t.clientY);
    },
    { passive: false }
  );

  zone.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === st.id) upd(t.clientX, t.clientY);
      }
    },
    { passive: false }
  );

  zone.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === st.id) {
          st.active = false;
          st.dx = 0;
          st.dy = 0;
          knob.style.transform = 'translate(-50%, -50%)';
        }
      }
    },
    { passive: false }
  );

  zone.addEventListener('mousedown', (e) => {
    const r = base.getBoundingClientRect();
    st.active = true;
    st.id = -99;
    st.bx = r.left + r.width / 2;
    st.by = r.top + r.height / 2;
    upd(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (st.active && st.id === -99) upd(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', () => {
    if (st.id === -99) {
      st.active = false;
      st.dx = 0;
      st.dy = 0;
      knob.style.transform = 'translate(-50%, -50%)';
    }
  });

  function upd(cx, cy) {
    let dx = cx - st.bx;
    let dy = cy - st.by;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > st.R) {
      dx = (dx / d) * st.R;
      dy = (dy / d) * st.R;
    }
    st.dx = dx / st.R;
    st.dy = dy / st.R;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  return st;
}

export function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });
}
