import { runAction, publicView, notifyText } from '../assets/js/core.js';
import { loadDB, saveDB, context, hasStorage, send, tg } from './_lib.js';

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!hasStorage()) return send(res, 200, { storage: false });
  const ctx = context(req);
  if (!ctx.uid) return send(res, 401, { error: 'Откройте приложение через Telegram' });
  const { action, payload } = req.body || {};
  try {
    const db = await loadDB();
    const result = runAction(db, action, payload, ctx);

    // уведомления в чат администраторов
    if (result.notify && ADMIN_CHAT_ID && result.notify !== 'broadcast') {
      const text = notifyText(result.notify, result, db);
      if (text) await tg('sendMessage', { chat_id: ADMIN_CHAT_ID, text });
    }
    // клиенту — подтверждение статуса брони
    if (result.notify === 'status' && result.booking?.uid?.startsWith('tg-')) {
      const b = result.booking;
      const words = { confirmed: '✅ Бронь подтверждена', cancelled: '❌ Бронь отменена клубом' }[b.status];
      if (words) await tg('sendMessage', { chat_id: b.uid.slice(3), text: `${words}: ${b.code}, места ${b.seats.join(', ')}` });
    }
    // рассылка подписчикам
    if (result.notify === 'broadcast') {
      let sent = 0;
      for (const sub of Object.values(db.subs)) {
        if (!sub.chatId) continue;
        const r = await tg('sendMessage', { chat_id: sub.chatId, text: result.broadcast.text });
        if (r?.ok) sent++;
      }
      result.broadcast.sent = sent;
    }

    await saveDB(db);
    send(res, 200, { ok: true, result: { ...result, notify: undefined }, view: publicView(db, ctx) });
  } catch (e) {
    send(res, e.user ? 400 : 500, { error: e.user ? e.message : 'Что-то пошло не так. Попробуйте ещё раз' });
  }
}
