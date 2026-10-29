// Webhook бота: отвечает на /start кнопкой, открывающей Mini App.
import { tg, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 200, { ok: true });
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) return send(res, 401, { ok: false });
  const msg = req.body?.message;
  const url = process.env.WEBAPP_URL || `https://${req.headers.host}`;
  if (msg?.text) {
    const chat = msg.chat.id;
    if (msg.text.startsWith('/id')) {
      await tg('sendMessage', { chat_id: chat, text: `ID этого чата: ${chat}\nВаш ID: ${msg.from?.id}` });
    } else {
      await tg('sendMessage', {
        chat_id: chat,
        text: 'NEBULA Gaming, Батуми\n\nСвободные места в реальном времени, бронь за минуту, турниры и акции — всё внутри.',
        reply_markup: { inline_keyboard: [[{ text: 'Открыть NEBULA', web_app: { url } }]] },
      });
    }
  }
  send(res, 200, { ok: true });
}
