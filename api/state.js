import { publicView } from '../assets/js/core.js';
import { loadDB, context, hasStorage, send, getAvatar } from './_lib.js';
import { sendReminders } from './remind.js';

export default async function handler(req, res) {
  if (!hasStorage()) return send(res, 200, { storage: false });
  try {
    const ctx = context(req);
    const [db, avatar] = await Promise.all([loadDB(), getAvatar(ctx.uid)]);
    try { await sendReminders(db, process.env.WEBAPP_URL || `https://${req.headers.host}`); } catch { /* напоминания не должны ломать экран */ }
    send(res, 200, { storage: true, bot: process.env.BOT_USERNAME || 'NebulaBatumi_bot', view: publicView(db, { ...ctx, avatar }), me: { uid: ctx.uid, isAdmin: ctx.isAdmin } });
  } catch (e) {
    send(res, 500, { error: 'Сервер недоступен, попробуйте ещё раз' });
  }
}
