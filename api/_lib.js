// Общие помощники для serverless-функций Vercel. Файл с "_" не становится роутом.
import crypto from 'node:crypto';
import { seedDB, demoTick, migrate } from '../assets/js/core.js';

const KEY = 'nebula:db:v1';
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const BOT_TOKEN = process.env.BOT_TOKEN || '';
export const hasStorage = () => !!(REDIS_URL && REDIS_TOKEN);

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Redis ' + r.status);
  return (await r.json()).result;
}

// аватары лежат отдельными ключами, чтобы основная запись оставалась маленькой
export const getAvatar = async uid => (uid ? await redis(['GET', 'nebula:avatar:' + uid]) : null);
export const setAvatar = (uid, data) => data ? redis(['SET', 'nebula:avatar:' + uid, data]) : redis(['DEL', 'nebula:avatar:' + uid]);

export async function loadDB() {
  const raw = await redis(['GET', KEY]);
  let db = raw ? JSON.parse(raw) : null;
  if (!db) { db = seedDB(); await saveDB(db); }
  if (migrate(db) | demoTick(db)) await saveDB(db);
  return db;
}
export const saveDB = db => redis(['SET', KEY, JSON.stringify(db)]);

// Подписанная сессия для входа из браузера (после подтверждения номера через бота)
const sessionKey = () => crypto.createHmac('sha256', 'NebulaSession').update(BOT_TOKEN || 'dev').digest();
export function signSession(uid) {
  const body = `${uid}.${Date.now() + 180 * 864e5}`;
  return body + '.' + crypto.createHmac('sha256', sessionKey()).update(body).digest('base64url');
}
function readSession(tok) {
  const m = /^(tg-\d+)\.(\d+)\.([\w-]+)$/.exec(String(tok || ''));
  if (!m || Number(m[2]) < Date.now()) return null;
  const sig = crypto.createHmac('sha256', sessionKey()).update(`${m[1]}.${m[2]}`).digest('base64url');
  return sig === m[3] ? m[1] : null;
}

// Проверка подписи initData из Telegram (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
function checkSigned(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const authDate = Number(params.get('auth_date')) * 1000;
  if (Date.now() - authDate > 7 * 864e5) return null;
  return params;
}
export function verifyInitData(initData) {
  const params = checkSigned(initData);
  try { return params ? JSON.parse(params.get('user') || 'null') : null; } catch { return null; }
}
// Ответ WebApp.requestContact подписан так же, как initData
export function verifyContact(response, tgId) {
  const params = checkSigned(response);
  if (!params) return null;
  try {
    const c = JSON.parse(params.get('contact') || 'null');
    return c && String(c.user_id) === String(tgId) ? c.phone_number : null;
  } catch { return null; }
}

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_PIN = process.env.ADMIN_PIN || '2828';

export function context(req) {
  const tgUser = verifyInitData(req.headers['x-tg-init']);
  const webId = String(req.headers['x-uid'] || '').replace(/[^\w-]/g, '').slice(0, 40);
  const sess = !tgUser && readSession(req.headers['x-session']);
  const uid = tgUser ? 'tg-' + tgUser.id : sess ? sess : (webId ? 'web-' + webId.replace(/^web-/, '') : null);
  const pin = String(req.headers['x-admin-pin'] || '');
  const isAdmin = (tgUser && ADMIN_IDS.includes(String(tgUser.id))) || (pin && pin === ADMIN_PIN);
  return {
    uid, isAdmin: !!isAdmin, now: Date.now(),
    tgId: tgUser?.id || (sess ? Number(sess.slice(3)) : null),
    name: tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') : '',
    username: tgUser?.username || '',
  };
}

export async function tg(method, body) {
  if (!BOT_TOKEN) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return null; }
}

export function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(data);
}
