// Однократная настройка бота: откройте /api/setup?pin=ВАШ_ADMIN_PIN после деплоя.
import { tg, send, BOT_TOKEN } from './_lib.js';
import { DESCRIPTION, SHORT_DESCRIPTION } from './_texts.js';

export default async function handler(req, res) {
  const pin = process.env.ADMIN_PIN || '2828';
  if (req.query.pin !== pin) return send(res, 401, { error: 'Нужен ?pin=ADMIN_PIN' });
  if (!BOT_TOKEN) return send(res, 400, { error: 'Добавьте BOT_TOKEN в переменные окружения Vercel' });
  const url = process.env.WEBAPP_URL || `https://${req.headers.host}`;
  const out = {};
  out.webhook = await tg('setWebhook', { url: `${url}/api/bot`, secret_token: process.env.WEBHOOK_SECRET || undefined, allowed_updates: ['message'] });
  out.menu = await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'NEBULA', web_app: { url } } });
  out.commands = await tg('setMyCommands', { commands: [{ command: 'start', description: 'Открыть приложение клуба' }, { command: 'id', description: 'Узнать ID чата (для уведомлений)' }] });
  out.short = await tg('setMyShortDescription', { short_description: SHORT_DESCRIPTION });
  out.description = await tg('setMyDescription', { description: DESCRIPTION });
  send(res, 200, { url, ...out });
}
