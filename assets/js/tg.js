// Обёртка над Telegram WebApp API. Вне Telegram всё молча работает как обычный сайт.
export const tg = window.Telegram?.WebApp?.initData !== undefined && window.Telegram.WebApp.platform !== 'unknown' ? window.Telegram.WebApp : null;

export const tgUser = () => tg?.initDataUnsafe?.user || null;

export function initTelegram() {
  if (!tg) { document.documentElement.classList.add('is-web'); return; }
  document.documentElement.classList.add('is-tg');
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#05050F');
    tg.setBackgroundColor?.('#05050F');
    tg.setBottomBarColor?.('#05050F');
    tg.disableVerticalSwipes?.();
  } catch { /* старые клиенты */ }
}

export const haptic = {
  tap() { try { tg?.HapticFeedback?.selectionChanged(); } catch { /* */ } },
  light() { try { tg?.HapticFeedback?.impactOccurred('light'); } catch { /* */ } },
  ok() { try { tg?.HapticFeedback?.notificationOccurred('success'); } catch { /* */ } },
  err() { try { tg?.HapticFeedback?.notificationOccurred('error'); } catch { /* */ } },
  warn() { try { tg?.HapticFeedback?.notificationOccurred('warning'); } catch { /* */ } },
};

let backHandler = null;
export function setBack(fn) {
  if (!tg?.BackButton) return;
  if (backHandler) tg.BackButton.offClick(backHandler);
  backHandler = fn;
  if (fn) { tg.BackButton.onClick(fn); tg.BackButton.show(); } else tg.BackButton.hide();
}

export function openLink(url) {
  if (tg && /^https:\/\/t\.me\//.test(url)) return tg.openTelegramLink(url);
  if (tg) return tg.openLink(url);
  window.open(url, '_blank', 'noopener');
}

export function requestWrite() {
  return new Promise(res => {
    if (!tg?.requestWriteAccess) return res(true);
    try { tg.requestWriteAccess(ok => res(ok)); } catch { res(true); }
  });
}

// Облачное хранилище Telegram: данные привязаны к аккаунту и видны на всех устройствах.
const cloud = () => (tg?.CloudStorage && tg.isVersionAtLeast?.('6.9') ? tg.CloudStorage : null);
export const cloudGet = keys => new Promise(res => {
  const c = cloud(); if (!c) return res({});
  try { c.getItems(keys, (err, vals) => res(err ? {} : (vals || {}))); } catch { res({}); }
  setTimeout(() => res({}), 2500);
});
export const cloudSet = (key, val) => new Promise(res => {
  const c = cloud(); if (!c) return res(false);
  try { c.setItem(key, val, err => res(!err)); } catch { res(false); }
});
export const cloudRemove = keys => new Promise(res => {
  const c = cloud(); if (!c) return res(false);
  try { c.removeItems(keys, err => res(!err)); } catch { res(false); }
});
