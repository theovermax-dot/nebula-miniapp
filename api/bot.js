// Webhook бота: /start с кнопкой приложения, вход из браузера через «Поделиться номером», /id.
import { runAction } from '../assets/js/core.js';
import { tg, send, hasStorage, loadDB, saveDB } from './_lib.js';
import { WELCOME } from './_texts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 200, { ok: true });
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) return send(res, 401, { ok: false });
  const msg = req.body?.message;
  const url = process.env.WEBAPP_URL || `https://${req.headers.host}`;
  const openBtn = { inline_keyboard: [[{ text: '🎮 Открыть NEBULA Gaming', web_app: { url } }]] };
  try {
    if (!msg) return send(res, 200, { ok: true });
    const chat = msg.chat.id;

    // пользователь поделился номером
    if (msg.contact) {
      if (msg.contact.user_id !== msg.from?.id) {
        await tg('sendMessage', { chat_id: chat, text: 'Нужен ваш собственный номер — нажмите кнопку «📱 Поделиться номером» ниже.' });
      } else if (hasStorage()) {
        const db = await loadDB();
        const r = runAction(db, 'botContact', { chatId: chat, tgId: msg.from.id, phone: msg.contact.phone_number, tgName: [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '), tgUser: msg.from.username }, {});
        await saveDB(db);
        await tg('sendMessage', { chat_id: chat, text: r.ok ? '✅ Номер подтверждён. Вернитесь в браузер — вход выполнится сам.' : '✅ Номер подтверждён. Возвращайтесь в приложение NEBULA.', reply_markup: { remove_keyboard: true } });
      }
      return send(res, 200, { ok: true });
    }

    const text = msg.text || '';
    if (text.startsWith('/start auth_') && hasStorage()) {
      const token = text.slice('/start auth_'.length).trim();
      const db = await loadDB();
      const r = runAction(db, 'botStart', { token, chatId: chat }, {});
      if (r.ok) {
        await saveDB(db);
        await tg('sendMessage', {
          chat_id: chat,
          text: 'Вход в NEBULA Gaming.\n\nНажмите кнопку ниже, чтобы подтвердить номер телефона. Telegram передаст его только клубу — для подтверждения броней.',
          reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
        });
      } else {
        await tg('sendMessage', { chat_id: chat, text: 'Ссылка для входа устарела. Вернитесь в браузер и нажмите «Подтвердить» ещё раз.' });
      }
    } else if (text.startsWith('/id')) {
      await tg('sendMessage', { chat_id: chat, text: `ID этого чата: ${chat}\nВаш ID: ${msg.from?.id}` });
    } else if (text.startsWith('/start') || text.startsWith('/app')) {
      const caption = WELCOME;
      const r = await tg('sendPhoto', { chat_id: chat, photo: `${url}/assets/welcome.jpg`, caption, reply_markup: openBtn });
      if (!r?.ok) await tg('sendMessage', { chat_id: chat, text: caption, reply_markup: openBtn });
    }
  } catch (e) { console.error(e); }
  send(res, 200, { ok: true });
}
