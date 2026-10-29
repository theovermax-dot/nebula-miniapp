// Однократная настройка бота: откройте /api/setup?pin=ВАШ_ADMIN_PIN после деплоя.
import { tg, send, BOT_TOKEN } from './_lib.js';

export default async function handler(req, res) {
  const pin = process.env.ADMIN_PIN || '2828';
  if (req.query.pin !== pin) return send(res, 401, { error: 'Нужен ?pin=ADMIN_PIN' });
  if (!BOT_TOKEN) return send(res, 400, { error: 'Добавьте BOT_TOKEN в переменные окружения Vercel' });
  const url = process.env.WEBAPP_URL || `https://${req.headers.host}`;
  const out = {};
  out.webhook = await tg('setWebhook', { url: `${url}/api/bot`, secret_token: process.env.WEBHOOK_SECRET || undefined, allowed_updates: ['message'] });
  out.menu = await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'NEBULA', web_app: { url } } });
  out.commands = await tg('setMyCommands', { commands: [{ command: 'start', description: 'Открыть приложение клуба' }, { command: 'id', description: 'Узнать ID чата (для уведомлений)' }] });
  out.description = await tg('setMyShortDescription', { short_description: 'Бронь ПК, турниры и акции NEBULA Gaming в Батуми' });
  send(res, 200, { url, ...out });
}
