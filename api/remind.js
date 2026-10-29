// Напоминания о бронях. Вызывается по расписанию (GitHub Actions) и попутно из /api/state.
// Безопасно вызывать сколько угодно раз: каждая бронь помечается после отправки.
import { dueReminders, clientText } from '../assets/js/core.js';
import { loadDB, saveDB, hasStorage, send, tg } from './_lib.js';

export async function sendReminders(db, url) {
  const due = dueReminders(db);
  if (!due.length) return 0;
  await saveDB(db); // сначала помечаем, чтобы параллельный вызов не задублировал
  const btn = { inline_keyboard: [[{ text: '🎮 Открыть бронь', web_app: { url } }]] };
  let sent = 0;
  for (const b of due) { const r = await tg('sendMessage', { chat_id: b.uid.slice(3), text: clientText('remind', b), reply_markup: btn }); if (r?.ok) sent++; }
  return sent;
}

export default async function handler(req, res) {
  if (!hasStorage()) return send(res, 200, { storage: false });
  const db = await loadDB();
  const sent = await sendReminders(db, process.env.WEBAPP_URL || `https://${req.headers.host}`);
  send(res, 200, { ok: true, sent });
}
