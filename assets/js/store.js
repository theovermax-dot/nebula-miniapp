// Слой данных: сервер (Vercel + Redis), если он подключён, иначе демо-режим в браузере.
import { seedDB, publicView, runAction, demoTick, migrate } from './core.js?v=1793300130';
import { tg, tgUser, cloudGet, cloudSet, cloudRemove } from './tg.js?v=1793300130';

const LS_DB = 'nebula:db:v1';
const LS_UID = 'nebula:uid';
const LS_PIN = 'nebula:pin';
const LS_SESSION = 'nebula:session';
const LS_AVATAR = 'nebula:avatar';
const DEMO_PIN = '2828';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

function webUid() {
  let id = ls.get(LS_UID);
  if (!id) { id = Math.random().toString(36).slice(2, 10); ls.set(LS_UID, id); }
  return id;
}

export const store = {
  mode: 'local',
  view: null,
  pin: ls.get(LS_PIN) || '',
  session: ls.get(LS_SESSION) || '',
  bot: 'NebulaBatumi_bot',
  listeners: new Set(),
  memDb: null,

  get uid() { const u = tgUser(); return u ? 'tg-' + u.id : (ls.get('nebula:localUid') || 'web-' + webUid()); },
  get isAdmin() { return !!this.view?.isAdmin; },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach(fn => fn(this.view)); },

  headers() {
    const h = { 'Content-Type': 'application/json', 'x-uid': webUid() };
    if (tg?.initData) h['x-tg-init'] = tg.initData;
    if (this.pin) h['x-admin-pin'] = this.pin;
    if (this.session && !tg?.initData) h['x-session'] = this.session;
    return h;
  },

  async init() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const r = await fetch('/api/state', { headers: this.headers(), signal: ctrl.signal });
      clearTimeout(timer);
      const data = r.ok ? await r.json() : null;
      if (data?.storage) {
        this.mode = 'remote'; this.view = data.view; if (data.bot) this.bot = data.bot;
        // профиль из облака Telegram (регистрация до подключения базы) переносим на сервер
        if (tgUser() && !this.view.profile) {
          const c = await cloudGet(['nebula_profile']);
          try {
            const p = c.nebula_profile ? JSON.parse(c.nebula_profile) : null;
            if (p?.phone && p?.name) await this.act('completeProfile', { name: p.name, phone: p.phone, consent: true, via: 'manual' });
          } catch { /* покажем обычный вход */ }
        }
        this.emit(); return;
      }
    } catch { /* нет сервера — демо */ }
    this.mode = 'local';
    await this.restoreFromCloud();
    this.refreshLocal();
    // профиль, созданный до синхронизации, отправляем в облако, чтобы он появился на других устройствах
    if (tgUser() && this.view?.profile) this.syncCloud('setAvatar');
  },

  // Профиль в Telegram CloudStorage — вход сохраняется между телефоном и компьютером
  async restoreFromCloud() {
    if (!tgUser()) return;
    const db = this.loadLocal();
    const uid = this.uid;
    if (db.users?.[uid]?.phone && ls.get(LS_AVATAR)) return;
    const c = await cloudGet(['nebula_profile', 'nebula_avatar']);
    try {
      const p = c.nebula_profile ? JSON.parse(c.nebula_profile) : null;
      if (p?.phone && !db.users?.[uid]?.phone) { db.users = db.users || {}; db.users[uid] = { ...p, verified: true }; this.saveLocal(db); }
    } catch { /* повреждённые данные — игнорируем */ }
    if (c.nebula_avatar && !ls.get(LS_AVATAR)) ls.set(LS_AVATAR, c.nebula_avatar);
  },
  async syncCloud(action) {
    if (!tgUser()) return;
    if (action === 'deleteAccount') return cloudRemove(['nebula_profile', 'nebula_avatar']);
    const p = this.view?.profile;
    if (p) await cloudSet('nebula_profile', JSON.stringify({ name: p.name, phone: p.phone, via: p.via, createdAt: p.createdAt, consentAt: p.consentAt }));
    if (action === 'setAvatar') {
      const a = ls.get(LS_AVATAR) || this.view?.avatar;
      if (!a) return cloudRemove(['nebula_avatar']);
      const small = await shrink(a);
      if (small && small.length < 4000) await cloudSet('nebula_avatar', small); else await cloudRemove(['nebula_avatar']);
    }
  },

  // ---- локальный режим ----
  loadLocal() {
    if (this.memDb) return this.memDb;
    const raw = ls.get(LS_DB);
    let db = null;
    try { db = raw ? JSON.parse(raw) : null; } catch { db = null; }
    if (!db || db.v !== 1) db = seedDB();
    migrate(db);
    this.memDb = db;
    return db;
  },
  saveLocal(db) { this.memDb = db; ls.set(LS_DB, JSON.stringify(db)); },
  ctx() {
    const u = tgUser();
    return {
      uid: this.uid, now: Date.now(), isAdmin: this.pin === DEMO_PIN,
      tgId: u?.id || null, name: u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '', username: u?.username || '',
    };
  },
  refreshLocal() {
    const db = this.loadLocal();
    if (demoTick(db)) this.saveLocal(db); else this.saveLocal(db);
    this.view = publicView(db, { ...this.ctx(), avatar: ls.get(LS_AVATAR) });
    this.emit();
  },

  async refresh() {
    if (this.mode === 'local') return this.refreshLocal();
    try {
      const r = await fetch('/api/state', { headers: this.headers() });
      const data = await r.json();
      if (data.view) { this.view = data.view; this.emit(); }
    } catch { /* офлайн: оставляем последнее состояние */ }
  },

  async act(action, payload = {}) {
    if (this.mode === 'local') {
      const db = this.loadLocal();
      const snapshot = JSON.stringify(db);
      try {
        const ctx = this.ctx();
        if (action === 'setAvatar') {
          if (payload.data) ls.set(LS_AVATAR, payload.data); else ls.del(LS_AVATAR);
          if (db.users?.[ctx.uid]) db.users[ctx.uid].hasAvatar = !!payload.data;
          this.saveLocal(db); this.refreshLocal(); this.syncCloud(action); return {};
        }
        // демо без сервера: номер из Telegram или введённый вручную принимаем как подтверждённый
        if (action === 'completeProfile') { ctx.verifiedPhone = payload.phone; ctx.via = payload.via || 'demo'; }
        const result = runAction(db, action, payload, ctx);
        if (action === 'deleteAccount') ls.del(LS_AVATAR);
        if (result.broadcast) result.broadcast.sent = 0;
        this.saveLocal(db);
        this.view = publicView(db, { ...this.ctx(), avatar: ls.get(LS_AVATAR) });
        this.emit();
        if (['completeProfile', 'updateProfile', 'deleteAccount'].includes(action)) this.syncCloud(action);
        return result;
      } catch (e) {
        this.memDb = JSON.parse(snapshot);
        throw e;
      }
    }
    let data;
    try {
      const r = await fetch('/api/action', { method: 'POST', headers: this.headers(), body: JSON.stringify({ action, payload }) });
      data = await r.json();
    } catch {
      throw new Error('Нет связи с сервером. Проверьте интернет');
    }
    if (data.error) { const e = new Error(data.error); e.retry = !!data.retry; throw e; }
    if (data.result?.session) { this.session = data.result.session; ls.set(LS_SESSION, this.session); }
    if (action === 'deleteAccount') { this.session = ''; ls.del(LS_SESSION); }
    this.view = data.view; this.emit();
    if (['completeProfile', 'updateProfile', 'deleteAccount'].includes(action)) this.syncCloud(action);
    return data.result;
  },

  async login(pin) {
    this.pin = pin;
    await this.refresh();
    if (!this.isAdmin) { this.pin = ''; ls.del(LS_PIN); this.refresh(); return false; }
    ls.set(LS_PIN, pin);
    return true;
  },
  // выход из аккаунта в браузере (в Telegram аккаунт = Telegram)
  logoutUser() { this.session = ''; ls.del(LS_SESSION); ls.del(LS_UID); ls.del(LS_AVATAR); this.refresh(); },
  logout() { this.pin = ''; ls.del(LS_PIN); this.refresh(); },
  resetDemo() { ls.del(LS_DB); this.memDb = null; this.refreshLocal(); },
};

// маленькая копия аватара (64×64) влезает в лимит CloudStorage 4 КБ
function shrink(src) {
  return new Promise(res => {
    if (/^https:/.test(src)) return res(src);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      c.getContext('2d').drawImage(img, 0, 0, 64, 64);
      let out = c.toDataURL('image/jpeg', 0.7);
      if (out.length >= 4000) out = c.toDataURL('image/jpeg', 0.45);
      res(out);
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}
