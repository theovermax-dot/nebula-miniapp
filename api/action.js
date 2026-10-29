import { runAction, publicView, notifyText } from '../assets/js/core.js';
import { loadDB, saveDB, context, hasStorage, send, tg, verifyContact, signSession, getAvatar, setAvatar } from './_lib.js';

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!hasStorage()) return send(res, 200, { storage: false });
  const ctx = context(req);
  if (!ctx.uid) return send(res, 401, { error: 'Откройте приложение через Telegram' });
  const { action, payload } = req.body || {};
  try {
    // аватар — отдельный ключ, до 120 КБ, только картинка или https-ссылка Telegram
    if (action === 'setAvatar') {
      const data = payload?.data || null;
      if (data && !(/^data:image\/(jpeg|png|webp);base64,/.test(data) && data.length < 120000) && !/^https:\/\/t\.me\/i\/userpic\//.test(data)) return send(res, 400, { error: 'Не подходит формат фото' });
      await setAvatar(ctx.uid, data);
      const db = await loadDB();
      if (db.users?.[ctx.uid]) { db.users[ctx.uid].hasAvatar = !!data; await saveDB(db); }
      return send(res, 200, { ok: true, result: {}, view: publicView(db, { ...ctx, avatar: data }) });
    }
    const db = await loadDB();
    if (action === 'completeProfile') {
      // 1) подписанный ответ requestContact; 2) контакт, который бот получил в чате
      ctx.verifiedPhone = verifyContact(payload?.response, ctx.tgId) || payload?.phone || null;
    }
    const result = runAction(db, action, payload, ctx);
    if (action === 'authCheck' && result.done) { result.session = signSession(result.uid); ctx.uid = result.uid; ctx.tgId = result.tgId; }
    if (action === 'deleteAccount') await setAvatar(ctx.uid, null);

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
    const avatar = action === 'deleteAccount' ? null : await getAvatar(ctx.uid);
    send(res, 200, { ok: true, result: { ...result, notify: undefined }, view: publicView(db, { ...ctx, avatar }) });
  } catch (e) {
    send(res, e.user ? 400 : 500, { error: e.user ? e.message : 'Что-то пошло не так. Попробуйте ещё раз' });
  }
}
