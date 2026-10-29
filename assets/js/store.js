// Слой данных: сервер (Vercel + Redis), если он подключён, иначе демо-режим в браузере.
import { seedDB, publicView, runAction, demoTick } from './core.js';
import { tg, tgUser } from './tg.js';

const LS_DB = 'nebula:db:v1';
const LS_UID = 'nebula:uid';
const LS_PIN = 'nebula:pin';
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
  listeners: new Set(),
  memDb: null,

  get uid() { const u = tgUser(); return u ? 'tg-' + u.id : 'web-' + webUid(); },
  get isAdmin() { return !!this.view?.isAdmin; },

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach(fn => fn(this.view)); },

  headers() {
    const h = { 'Content-Type': 'application/json', 'x-uid': webUid() };
    if (tg?.initData) h['x-tg-init'] = tg.initData;
    if (this.pin) h['x-admin-pin'] = this.pin;
    return h;
  },

  async init() {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const r = await fetch('/api/state', { headers: this.headers(), signal: ctrl.signal });
      clearTimeout(timer);
      const data = r.ok ? await r.json() : null;
      if (data?.storage) { this.mode = 'remote'; this.view = data.view; this.emit(); return; }
    } catch { /* нет сервера — демо */ }
    this.mode = 'local';
    this.refreshLocal();
  },

  // ---- локальный режим ----
  loadLocal() {
    if (this.memDb) return this.memDb;
    const raw = ls.get(LS_DB);
    let db = null;
    try { db = raw ? JSON.parse(raw) : null; } catch { db = null; }
    if (!db || db.v !== 1) db = seedDB();
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
    this.view = publicView(db, this.ctx());
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
        const result = runAction(db, action, payload, this.ctx());
        if (result.broadcast) result.broadcast.sent = 0;
        this.saveLocal(db);
        this.view = publicView(db, this.ctx());
        this.emit();
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
    if (data.error) throw new Error(data.error);
    this.view = data.view; this.emit();
    return data.result;
  },

  async login(pin) {
    this.pin = pin;
    await this.refresh();
    if (!this.isAdmin) { this.pin = ''; ls.del(LS_PIN); this.refresh(); return false; }
    ls.set(LS_PIN, pin);
    return true;
  },
  logout() { this.pin = ''; ls.del(LS_PIN); this.refresh(); },
  resetDemo() { ls.del(LS_DB); this.memDb = null; this.refreshLocal(); },
};
