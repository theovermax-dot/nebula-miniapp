import { publicView } from '../assets/js/core.js';
import { loadDB, context, hasStorage, send } from './_lib.js';

export default async function handler(req, res) {
  if (!hasStorage()) return send(res, 200, { storage: false });
  try {
    const ctx = context(req);
    const db = await loadDB();
    send(res, 200, { storage: true, view: publicView(db, ctx), me: { uid: ctx.uid, isAdmin: ctx.isAdmin } });
  } catch (e) {
    send(res, 500, { error: 'Сервер недоступен, попробуйте ещё раз' });
  }
}
