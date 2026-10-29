// Мелкие UI-помощники: экранирование, иконки, тосты, нижние шторки.
import { setBack, haptic } from './tg.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const money = n => `₾${Math.round(n)}`;

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  seat: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M16 5h3v2a3 3 0 0 1-3 3M8 5H5v2a3 3 0 0 0 3 3"/><path d="M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5 3h3.5l1.5 5-2.2 1.6a12 12 0 0 0 6.6 6.6L16 14l5 1.5V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 21h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.9.8 3 2.5 3 5.2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  send: '<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4 18-7Z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 1-2-2Z" transform="translate(-1 -1)"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.4L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.7 4.4L20 16"/><path d="M20 20v-4h-4"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  maximize: '<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M8 21H4a1 1 0 0 1-1-1v-4M16 21h4a1 1 0 0 0 1-1v-4"/>',
  minimize: '<path d="M8 3v4a1 1 0 0 1-1 1H3M16 3v4a1 1 0 0 0 1 1h4M8 21v-4a1 1 0 0 0-1-1H3M16 21v-4a1 1 0 0 1 1-1h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z"/>',
};
export const icon = (name, size = 20, cls = '') => `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

// ---------- тосты ----------
let toastTimer;
export function toast(msg, kind = 'info') {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.className = 'toast ' + kind;
  el.innerHTML = `${kind === 'ok' ? icon('check', 18) : kind === 'err' ? icon('close', 18) : icon('bell', 18)}<span>${esc(msg)}</span>`;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'err' ? 3600 : 2600);
  if (kind === 'err') haptic.err();
}

// ---------- шторки ----------
const stack = [];
export function sheet({ title = '', body = '', cls = '', onMount, onClose, full = false }) {
  const root = document.createElement('div');
  root.className = 'sheet-root';
  root.innerHTML = `<div class="sheet-backdrop" data-close></div>
    <section class="sheet ${full ? 'sheet-full' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grip" aria-hidden="true"></div>
      ${title ? `<header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Закрыть">${icon('close', 20)}</button></header>` : ''}
      <div class="sheet-body">${body}</div>
    </section>`;
  document.body.appendChild(root);
  document.body.classList.add('has-sheet');
  const api = {
    root, el: $('.sheet', root), body: $('.sheet-body', root),
    set(html) { api.body.innerHTML = html; onMount?.(api); },
    close() {
      if (api.closed) return; api.closed = true;
      root.classList.remove('open');
      const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
      setBack(stack.length ? stack[stack.length - 1].close : (window.__rootBack || null));
      if (!stack.length) document.body.classList.remove('has-sheet');
      setTimeout(() => root.remove(), 320);
      onClose?.();
    },
  };
  root.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
  // свайп вниз по ручке/шапке закрывает
  let y0 = null, dy = 0;
  const drag = $('.sheet', root);
  drag.addEventListener('touchstart', e => { if (e.target.closest('.sheet-grip, .sheet-head') ) { y0 = e.touches[0].clientY; dy = 0; drag.style.transition = 'none'; } }, { passive: true });
  drag.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); drag.style.transform = `translateY(${dy}px)`; }, { passive: true });
  drag.addEventListener('touchend', () => { if (y0 === null) return; drag.style.transition = ''; drag.style.transform = ''; if (dy > 90) api.close(); y0 = null; });
  stack.push(api);
  setBack(api.close);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
  onMount?.(api);
  return api;
}
export const closeAllSheets = () => [...stack].forEach(s => s.close());
export const topSheet = () => stack[stack.length - 1];

export function confirmSheet({ title, text, ok = 'Подтвердить', danger = false }) {
  return new Promise(res => {
    let done = false;
    const s = sheet({
      title,
      body: `<p class="muted lead">${esc(text)}</p><div class="row-btns"><button class="btn btn-ghost" data-no>Отмена</button><button class="btn ${danger ? 'btn-danger' : ''}" data-yes>${esc(ok)}</button></div>`,
      onClose: () => { if (!done) res(false); },
    });
    s.root.addEventListener('click', e => {
      if (e.target.closest('[data-yes]')) { done = true; res(true); s.close(); }
      if (e.target.closest('[data-no]')) { done = true; res(false); s.close(); }
    });
  });
}

// плавный счётчик для крупных чисел
export function countUp(el, to, ms = 700) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) { if (el) el.textContent = to; return; }
  const from = Number(el.dataset.from ?? 0), t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 4);
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export async function busy(btn, fn) {
  if (btn?.disabled) return;
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  try { return await fn(); }
  finally { if (btn) { btn.disabled = false; btn.classList.remove('loading'); } }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') topSheet()?.close(); });
