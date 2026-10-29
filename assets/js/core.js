// NEBULA Gaming — общая логика. Работает и в браузере (демо-режим), и на сервере (Vercel /api).
// Никаких зависимостей от DOM или Node: только чистые функции над объектом db.

export const TZ_OFFSET = 4 * 3600e3; // Грузия, UTC+4, без перехода на летнее время

export const CLUB = {
  name: 'NEBULA Gaming',
  city: 'Батуми, Аджария',
  phone: '+995 577 54 28 28',
  phoneRaw: '+995577542828',
  map: 'https://maps.app.goo.gl/R3jciNs2ptwSgFb57',
  instagram: 'https://instagram.com/nebula_gaming_batumi/',
  tiktok: 'https://www.tiktok.com/@nebula_gaming_ge',
  facebook: 'https://facebook.com/Nebulagamingcenter/',
  site: 'https://www.nebula-gaming.ge/',
};

export const ZONES = [
  { id: 'ultra', name: 'Ultra', hz: 500, price: [10, 12], seats: [16, 17, 18, 19, 20], tag: 'Флагман',
    specs: { GPU: 'RTX 5070', CPU: 'Ryzen 7 7800X3D', 'Монитор': '500Hz Alienware', 'Мышь': 'Logitech G Pro Superstrike', 'Клавиатура': 'Razer Huntsman V3 Mini', 'Гарнитура': 'HyperX Cloud 3 Wireless' } },
  { id: 'duo', name: 'Duo-комната', short: 'Duo', hz: 500, price: [13, 15], seats: [21, 22], tag: 'Новинка', perSeat: true,
    specs: { 'Комната': 'Приватная, для двоих', GPU: 'RTX 5070', CPU: 'Ryzen 7 7800X3D', 'Монитор': '500Hz Alienware', 'Мышь': 'Logitech G Pro Superstrike', 'Клавиатура': 'Razer Huntsman V3 Mini', 'Гарнитура': 'HyperX Cloud 3 Wireless' } },
  { id: 'pro', name: 'Pro', hz: 360, price: [8, 9], seats: [1, 2, 3, 4, 5],
    specs: { GPU: 'RTX 5070', CPU: 'Ryzen 5 7600X', 'Монитор': '360Hz Alienware', 'Мышь': 'Logitech G Pro Superlight 2', 'Клавиатура': 'Razer Huntsman Mini / TKL', 'Гарнитура': 'HyperX Cloud 2 Wireless' } },
  { id: 'standard', name: 'Standard', hz: 320, price: [6, 7], seats: [6, 7, 8, 9, 10],
    specs: { GPU: 'RTX 3060 / 4060', CPU: 'Intel Core i5-12400', 'Монитор': '320Hz Alienware', 'Мышь': 'Logitech G Pro Superlight', 'Клавиатура': '65% Mechanical', 'Гарнитура': 'G Pro / HyperX Wireless' } },
  { id: 'start', name: 'Start', hz: 240, price: [5, 6], seats: [11, 12, 13, 14, 15],
    specs: { GPU: 'RTX 3060 / 4060', CPU: 'Intel Core i5-12400', 'Монитор': '240Hz Samsung', 'Мышь': 'Logitech G Pro Superlight', 'Клавиатура': '65% Mechanical', 'Гарнитура': 'Razer Wired' } },
];

export const ALL_SEATS = ZONES.flatMap(z => z.seats).sort((a, b) => a - b);
export const zoneOf = seat => ZONES.find(z => z.seats.includes(Number(seat)));
export const zoneById = id => ZONES.find(z => z.id === id);

// Пакеты — цены за одно место [Пн–Чт, Пт–Вс], как на сайте клуба
export const PACKAGES = [
  { id: 'p3', name: 'Пакет на 3 часа', short: '3 часа', window: '08:00 – 19:00', note: 'Любые 3 часа в окне', hours: 3,
    fits: (startMin, hours) => hours === 3 && startMin >= 8 * 60 && startMin + 180 <= 19 * 60,
    prices: { start: [13, 15], standard: [16, 18], pro: [22, 24], ultra: [27, 30], duo: [35, 39] } },
  { id: 'p5', name: 'Пакет на 5 часов', short: '5 часов', window: 'Любое время', note: 'Пять часов игры', hours: 5,
    fits: (startMin, hours) => hours === 5,
    prices: { start: [21, 24], standard: [26, 29], pro: [34, 38], ultra: [43, 48], duo: [56, 62] } },
  { id: 'morning', name: 'Утренний пакет', short: 'Утро', window: '08:00 – 13:00', note: 'Утренний тариф', hours: 5, fixedStart: 8 * 60,
    fits: (startMin, hours) => hours === 5 && startMin === 8 * 60,
    prices: { start: [12, 13], standard: [14, 16], pro: [19, 21], ultra: [24, 26], duo: [31, 34] } },
  { id: 'night', name: 'Ночной пакет', short: 'Ночь', window: '23:00 – 09:00', note: 'Вся ночь', hours: 10, fixedStart: 23 * 60,
    fits: (startMin, hours) => hours === 10 && startMin === 23 * 60,
    prices: { start: [28, 31], standard: [34, 37], pro: [45, 50], ultra: [56, 62], duo: [73, 81] } },
];
export const HZ_ROWS = [['start', '240Hz'], ['standard', '320Hz'], ['pro', '360Hz'], ['ultra', '500Hz'], ['duo', 'Duo 500Hz']];

// ---------- время клуба ----------
export function clubParts(t) {
  const d = new Date(t + TZ_OFFSET);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
}
export const clubEpoch = (y, m, d, h = 0, min = 0) => Date.UTC(y, m, d, h, min) - TZ_OFFSET;
export const dayStart = t => { const p = clubParts(t); return clubEpoch(p.y, p.m, p.d); };
export const pad = n => String(n).padStart(2, '0');
export const fmtTime = t => { const p = clubParts(t); return `${pad(p.h)}:${pad(p.min)}`; };
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MON_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const fmtDay = t => { const p = clubParts(t); return `${WD[p.wd]}, ${p.d} ${MON[p.m]}`; };
export const fmtDayLong = t => { const p = clubParts(t); return `${p.d} ${MON_FULL[p.m]}, ${WD_FULL[p.wd]}`; };
export const wdShort = t => WD[clubParts(t).wd];
export const isWeekend = t => { const wd = clubParts(t).wd; return wd === 5 || wd === 6 || wd === 0; };
export function relDay(t, now = Date.now()) {
  const diff = Math.round((dayStart(t) - dayStart(now)) / 864e5);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  if (diff === -1) return 'Вчера';
  return fmtDay(t);
}
export function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  if (h && mm) return `${h} ч ${mm} мин`;
  if (h) return `${h} ч`;
  return `${mm} мин`;
}
export const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

// ---------- цены ----------
export function quoteSeat(zoneId, start, hours) {
  const z = zoneById(zoneId);
  const we = isWeekend(start) ? 1 : 0;
  const p = clubParts(start);
  const startMin = p.h * 60 + p.min;
  const hourly = z.price[we] * hours;
  let best = { price: hourly, pkg: null };
  for (const pk of PACKAGES) {
    if (pk.fits(startMin, hours)) {
      const price = pk.prices[zoneId][we];
      if (price < best.price) best = { price, pkg: pk.id };
    }
  }
  return { hourly, price: best.price, pkg: best.pkg, weekend: !!we };
}
export function quote(seats, start, hours) {
  let hourly = 0, price = 0; const pkgs = new Set();
  for (const s of seats) {
    const q = quoteSeat(zoneOf(s).id, start, hours);
    hourly += q.hourly; price += q.price; if (q.pkg) pkgs.add(q.pkg);
  }
  const pkg = pkgs.size === 1 ? [...pkgs][0] : null;
  return { hourly, price, saving: hourly - price, pkg, weekend: isWeekend(start) };
}

// Бонусные часы: списываются с первого места по его фактической цене за час (с учётом пакета)
export function bonusDiscount(bonusHours, seats, start, hours) {
  const used = Math.min(bonusHours || 0, hours);
  if (!used || !seats.length) return { used: 0, off: 0 };
  const seatPrice = quoteSeat(zoneOf(seats[0]).id, start, hours).price;
  return { used, off: Math.min(seatPrice, Math.round(seatPrice / hours * used)) };
}

// ---------- занятость ----------
const ACTIVE = new Set(['new', 'confirmed', 'arrived']);
export function intervals(db, now = Date.now()) {
  const out = [];
  for (const b of db.bookings) {
    if (!ACTIVE.has(b.status)) continue;
    const end = b.start + b.hours * 3600e3;
    if (end <= now) continue;
    for (const s of b.seats) out.push({ seat: s, start: b.start, end, kind: 'booking', id: b.id });
  }
  for (const [seat, st] of Object.entries(db.seats || {})) {
    if (st.status === 'busy' && st.until > now) out.push({ seat: Number(seat), start: now - 1, end: st.until, kind: 'session' });
    if (st.status === 'repair') out.push({ seat: Number(seat), start: 0, end: 8.64e15, kind: 'repair' });
  }
  return out;
}
export function seatConflict(iv, seat, start, end) {
  return iv.find(x => x.seat === Number(seat) && x.start < end && start < x.end) || null;
}

export function liveSeats(db, now = Date.now()) {
  const iv = intervals(db, now);
  const out = {};
  for (const seat of ALL_SEATS) {
    const st = db.seats?.[seat] || {};
    let status = 'free', until = null, nextBooking = null;
    if (st.status === 'repair') status = 'repair';
    else if (st.status === 'busy' && st.until > now) { status = 'busy'; until = st.until; }
    const mine = iv.filter(x => x.seat === seat && x.kind === 'booking').sort((a, b) => a.start - b.start);
    const current = mine.find(x => x.start <= now && x.end > now);
    if (status === 'free' && current) { status = 'busy'; until = current.end; }
    const upcoming = mine.find(x => x.start > now && x.start < dayStart(now) + 864e5 + 6 * 3600e3);
    if (upcoming) nextBooking = upcoming.start;
    out[seat] = { status, until, nextBooking };
  }
  return out;
}

// ---------- утилиты ----------
const rid = (n = 8) => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
// код брони — 4 цифры, не повторяется среди действующих броней
const code = db => {
  const used = new Set((db?.bookings || []).filter(b => !['cancelled', 'done', 'noshow'].includes(b.status)).map(b => b.code));
  for (let i = 0; i < 200; i++) { const c = String(1000 + Math.floor(Math.random() * 9000)); if (!used.has(c)) return c; }
  return String(Date.now()).slice(-5);
};
const clean = (s, max = 120) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);
export class UserError extends Error { constructor(msg) { super(msg); this.user = true; } }
const fail = msg => { throw new UserError(msg); };

// ---------- демо-данные ----------
// Обновление демо-данных у тех, кто открыл старую версию
export function migrate(db) {
  if (!db) return false;
  // починка демо-брони с неверной длительностью
  let fixed = false;
  for (const b of db.bookings || []) {
    if (!(Number(b.hours) > 0)) { b.hours = 2; const q = quote(b.seats, b.start, 2); b.price = q.price; b.pkg = q.pkg; fixed = true; }
  }
  if (db.promoV === 6) return fixed;
  // коды броней NB-XXXX → 4 цифры
  for (const b of db.bookings || []) if (String(b.code).startsWith('NB-')) b.code = code(db);
  // демо-акции убраны до подтверждения клубом; акции, созданные в админке, остаются
  db.promos = (db.promos || []).filter(p => !['pr-bday', 'pr-team', 'pr-morning'].includes(p.id));
  db.promoV = 6;
  for (const t of db.tournaments || []) {
    const f = seedDB().tournaments.find(x => x.id === t.id);
    if (t.prizeHours == null) t.prizeHours = f?.prizeHours || 0;
    if (t.prizeComment == null) t.prizeComment = f?.prizeComment || '';
  }
  return true;
}

export function seedDB(now = Date.now()) {
  const today = dayStart(now);
  const p = clubParts(now);
  const at = (dayOffset, h, m = 0) => today + dayOffset * 864e5 + (h * 60 + m) * 60e3;
  const nextWd = wd => { let i = 0; while (clubParts(today + i * 864e5).wd !== wd || i === 0) i++; return i; };
  const db = { v: 1, promoV: 6, demo: true, seats: {}, bookings: [], tournaments: [], promos: [], subs: {}, broadcasts: [], users: {}, auth: {}, createdAt: now, updatedAt: now };
  demoTick(db, now, true);
  db.seats[9] = { status: 'repair', note: 'Замена блока питания' };
  const mk = (seats, start, hours, name, phone, status, user) => {
    const q = quote(seats, start, hours);
    db.bookings.push({ id: rid(), code: code(db), seats, start, hours, pkg: q.pkg, price: q.price, name, phone, tgUser: user || '', uid: 'seed', comment: '', status, createdAt: now - Math.random() * 864e5 });
  };
  const h = p.h + 1;
  mk([21, 22], at(0, Math.min(h + 2, 22)), 3, 'Георгий Беридзе', '+995 555 21 43 87', 'confirmed', 'giorgi_b');
  mk([18], at(0, Math.min(h + 1, 22), 30), 2, 'Лука', '+995 599 10 22 31', 'new', 'luka_aim');
  mk([3, 4, 5], at(0, Math.min(h + 3, 23)), 2, 'Анна Соколова', '+995 571 66 04 19', 'new', 'annsok');
  mk([7], at(1, 10), 3, 'Саба Цинцадзе', '+995 593 48 70 12', 'confirmed', 'saba_ts');
  mk([16, 17], at(1, 19), 5, 'Дмитрий', '+995 557 31 90 08', 'confirmed', 'dimon_cs');
  mk([11, 12, 13, 14, 15], at(1, 13), 3, 'Ника Гогохия', '+995 568 77 12 40', 'new', 'nika_gg');
  mk([1], at(2, 23), 10, 'Ираклий', '+995 591 02 55 63', 'confirmed', '');

  const sat = nextWd(6), fri = nextWd(5);
  db.tournaments = [
    { id: 't-cs', game: 'Counter-Strike 2', title: 'Wingman Cup', format: '2 × 2', teamSize: 2, start: at(sat, 18), entry: 20, entryUnit: 'с команды', prize: 600, prizeNote: '₾400 · ₾150 · ₾50', prizeHours: 10, prizeComment: 'Победители получают кубок и мерч NEBULA.', slots: 16, open: true, hue: 'amber',
      about: 'Формат Wingman, карты Nuke, Inferno, Vertigo. Single elimination, финал — Bo3. Играем на станциях Ultra и Pro.',
      regs: ['Batumi Five', 'Old Boulevard', 'Adjara Aim', 'noscope.ge', 'Sea Breeze', 'Kobuleti Kings', 'Clutch or Kick', 'Rustaveli 2', 'Late Peek'].map((t, i) => ({ id: rid(), team: t, captain: ['@lasha', '@gio_cs', '@tornike', '@noscope', '@mariam', '@dato', '@luka_aim', '@irakli', '@zura'][i], players: [], contact: '', uid: 'seed', createdAt: now - i * 36e5 })) },
    { id: 't-val', game: 'Valorant', title: 'Night Ops 5×5', format: '5 × 5', teamSize: 5, start: at(fri, 21), entry: 50, entryUnit: 'с команды', prize: 1000, prizeNote: '₾700 · ₾300', prizeHours: 0, prizeComment: 'После финала — бесплатная ночь в клубе для команды-победителя.', slots: 8, open: true, hue: 'red',
      about: 'Ночной турнир на 8 команд. Групповой этап Bo1, плей-офф Bo3. После финала — бесплатная ночь в клубе для победителей.',
      regs: ['Phantom Batumi', 'Spike Rush', 'Black Sea Five', 'Ascent Gang'].map((t, i) => ({ id: rid(), team: t, captain: ['@ninja_ge', '@sova', '@ketevan', '@ascent'][i], players: [], contact: '', uid: 'seed', createdAt: now - i * 72e5 })) },
    { id: 't-fc', game: 'EA SPORTS FC 26', title: 'Кубок Аджарии 1×1', format: '1 × 1', teamSize: 1, start: at(sat + 7, 15), entry: 10, entryUnit: 'с игрока', prize: 300, prizeNote: '₾200 · ₾100', prizeHours: 5, prizeComment: '', slots: 32, open: true, hue: 'green',
      about: 'Ultimate-составы запрещены, только клубы. Матчи по 6 минут, ничья — пенальти. Свой геймпад можно принести.',
      regs: ['Гела', 'Nodar10', 'Misha FC', 'Saba', 'Giorgi D.', 'Темур', 'kakha', 'Levan', 'Mate', 'Vako', 'Otar', 'Beka'].map((t, i) => ({ id: rid(), team: t, captain: '', players: [], contact: '', uid: 'seed', createdAt: now - i * 18e5 })) },
  ];
  db.promos = []; // акции клуба пока не утверждены — добавляются в админке
  for (let i = 1; i <= 47; i++) db.subs['seed-' + i] = { name: '', at: now - i * 864e5 / 3, demo: true };
  return db;
}

// В демо-режиме зал «живёт»: игроки приходят и уходят, чтобы карта не пустела.
export function demoTick(db, now = Date.now(), force = false) {
  if (!db.demo) return false;
  if (!force && now - (db.lastTick || 0) < 5 * 60e3) return false;
  db.lastTick = now;
  const live = liveSeats(db, now);
  const busy = ALL_SEATS.filter(s => live[s].status === 'busy').length;
  const target = 8 + Math.floor(Math.random() * 3);
  let changed = false;
  const free = ALL_SEATS.filter(s => live[s].status === 'free' && !(db.seats[s]?.status === 'repair')).sort(() => Math.random() - 0.5);
  for (let i = 0; i < target - busy && i < free.length; i++) {
    const mins = 30 + Math.floor(Math.random() * 16) * 15 + Math.floor(Math.random() * 14);
    db.seats[free[i]] = { status: 'busy', until: now + mins * 60e3 };
    changed = true;
  }
  return changed;
}

// ---------- публичное представление ----------
export function publicView(db, ctx = {}) {
  const now = ctx.now || Date.now();
  const uid = ctx.uid;
  const live = liveSeats(db, now);
  const iv = intervals(db, now).map(({ seat, start, end, kind }) => ({ seat, start, end, kind }));
  const view = {
    now, demo: !!db.demo,
    live,
    occupied: iv,
    tournaments: db.tournaments.map(t => ({
      ...t, regs: undefined, regCount: t.regs.length,
      teams: t.regs.map(r => r.team),
      winners: t.regs.filter(r => r.winner).sort((a, b) => a.winner.place - b.winner.place).map(r => r.team),
      myReg: t.regs.find(r => uid && r.uid === uid) || null,
    })).sort((a, b) => a.start - b.start),
    promos: db.promos.filter(p => p.active || ctx.isAdmin),
    myBookings: db.bookings.filter(b => uid && b.uid === uid).sort((a, b) => b.start - a.start),
    subscribed: !!(uid && db.subs[uid]),
    profile: (uid && db.users?.[uid]) || null,
    avatar: ctx.avatar || null,
    subCount: Object.keys(db.subs).length,
    isAdmin: !!ctx.isAdmin,
  };
  if (ctx.isAdmin) {
    view.bookings = [...db.bookings].sort((a, b) => a.start - b.start);
    view.tournamentsFull = db.tournaments;
    view.broadcasts = db.broadcasts.slice(-10).reverse();
    view.seatsRaw = db.seats;
    view.userCount = Object.keys(db.users || {}).length;
  }
  return view;
}

// ---------- действия ----------
export const actions = {
  createBooking(db, p, ctx) {
    const now = ctx.now || Date.now();
    const seats = [...new Set((p.seats || []).map(Number))].filter(s => ALL_SEATS.includes(s));
    if (!seats.length) fail('Выберите хотя бы одно место');
    if (seats.length > 10) fail('За раз можно забронировать до 10 мест');
    const hours = Number(p.hours);
    if (!(hours >= 1 && hours <= 12)) fail('Длительность — от 1 до 12 часов');
    const start = Number(p.start);
    if (!(start > now - 15 * 60e3)) fail('Это время уже прошло — выберите другое');
    if (start > now + 14 * 864e5) fail('Бронь доступна на 14 дней вперёд');
    const prof = db.users?.[ctx.uid];
    if (!prof?.phone && !ctx.isAdmin) fail('Укажите номер телефона в профиле');
    const name = clean(prof?.name || p.name, 60), phone = clean(prof?.phone || p.phone, 30);
    if (name.length < 2) fail('Как к вам обращаться?');
    if (phone.replace(/\D/g, '').length < 9) fail('Проверьте номер телефона');
    const iv = intervals(db, now), end = start + hours * 3600e3;
    for (const s of seats) {
      const c = seatConflict(iv, s, start, end);
      if (c) fail(c.kind === 'repair' ? `Место ${s} на ремонте` : `Место ${s} уже занято на ${fmtTime(Math.max(c.start, start))}. Выберите другое`);
    }
    const q = quote(seats, start, hours);
    // бонусные часы (например, приз за турнир): списываем по обычному тарифу первого места
    let bonusUsed = 0, bonusOff = 0;
    if (p.useBonus && prof?.bonusHours > 0) {
      ({ used: bonusUsed, off: bonusOff } = bonusDiscount(prof.bonusHours, seats, start, hours));
      prof.bonusHours -= bonusUsed;
    }
    const b = { id: rid(), code: code(db), seats, start, hours, pkg: q.pkg, price: q.price - bonusOff, hourly: q.hourly, bonusUsed, bonusOff, name, phone, verified: !!prof?.verified, tgUser: clean(ctx.username || prof?.tgUser, 40), uid: ctx.uid, comment: clean(p.comment, 200), promo: clean(p.promo, 60), status: 'new', createdAt: now };
    db.bookings.push(b);
    return { booking: b, notify: 'booking' };
  },
  cancelBooking(db, p, ctx) {
    const b = db.bookings.find(x => x.id === p.id);
    if (!b) fail('Бронь не найдена');
    if (b.uid !== ctx.uid && !ctx.isAdmin) fail('Это не ваша бронь');
    if (!['new', 'confirmed'].includes(b.status)) fail('Эту бронь уже нельзя отменить');
    b.status = 'cancelled'; b.cancelledBy = ctx.isAdmin && b.uid !== ctx.uid ? 'admin' : 'client';
    if (b.bonusUsed && db.users?.[b.uid]) { db.users[b.uid].bonusHours = (db.users[b.uid].bonusHours || 0) + b.bonusUsed; b.bonusUsed = 0; }
    return { booking: b, notify: 'cancel' };
  },
  registerTournament(db, p, ctx) {
    const t = db.tournaments.find(x => x.id === p.id);
    if (!t) fail('Турнир не найден');
    if (!t.open) fail('Регистрация закрыта');
    if (t.regs.length >= t.slots) fail('Все места заняты — следите за следующим турниром');
    if (t.regs.find(r => r.uid === ctx.uid)) fail('Вы уже зарегистрированы');
    const team = clean(p.team, 40);
    if (team.length < 2) fail(t.teamSize > 1 ? 'Введите название команды' : 'Введите никнейм');
    if (t.regs.find(r => r.team.toLowerCase() === team.toLowerCase())) fail('Такое название уже занято');
    const contact = clean(p.contact, 40);
    if (contact.replace(/[^\d@a-z_]/gi, '').length < 3) fail('Оставьте телефон или @username для связи');
    const players = (p.players || []).map(x => clean(x, 32)).filter(Boolean).slice(0, 6);
    const reg = { id: rid(), team, captain: clean(p.captain, 40), players, contact, uid: ctx.uid, createdAt: ctx.now || Date.now() };
    t.regs.push(reg);
    return { reg, tournament: t, notify: 'reg' };
  },
  leaveTournament(db, p, ctx) {
    const t = db.tournaments.find(x => x.id === p.id);
    if (!t) fail('Турнир не найден');
    t.regs = t.regs.filter(r => r.uid !== ctx.uid);
    return {};
  },
  subscribe(db, p, ctx) {
    if (!ctx.uid) fail('Нет идентификатора пользователя');
    if (p.on) db.subs[ctx.uid] = { name: clean(ctx.name, 60), chatId: ctx.tgId || null, at: ctx.now || Date.now() };
    else delete db.subs[ctx.uid];
    return { subscribed: !!p.on };
  },

  // ----- профиль и вход -----
  // Номер уже проверен: на сервере — подписью Telegram, в демо — доверяем клиенту.
  completeProfile(db, p, ctx) {
    if (!ctx.uid) fail('Нет идентификатора пользователя');
    const phoneIn = ctx.verifiedPhone || p.phone;
    if (String(phoneIn || '').replace(/\D/g, '').length < 9) fail('Укажите номер телефона');
    if (!p.consent) fail('Нужно согласие с политикой конфиденциальности');
    const name = clean(p.name, 60);
    if (name.length < 2) fail('Как к вам обращаться?');
    db.users = db.users || {};
    const prev = db.users[ctx.uid] || {};
    db.users[ctx.uid] = { ...prev, name, phone: normPhone(phoneIn), verified: true, via: ctx.via || 'manual', tgUser: clean(ctx.username, 40), createdAt: prev.createdAt || ctx.now || Date.now(), consentAt: ctx.now || Date.now() };
    return { profile: db.users[ctx.uid] };
  },
  updateProfile(db, p, ctx) {
    const u = db.users?.[ctx.uid];
    if (!u) fail('Сначала войдите');
    const name = clean(p.name, 60);
    if (name.length < 2) fail('Имя слишком короткое');
    u.name = name;
    if (p.phone !== undefined) {
      if (String(p.phone).replace(/\D/g, '').length < 9) fail('Проверьте номер телефона');
      u.phone = normPhone(p.phone);
    }
    if ('hasAvatar' in p) u.hasAvatar = !!p.hasAvatar;
    return { profile: u };
  },
  // Вход из браузера: токен → бот получает /start auth_<token> → пользователь делится контактом
  authStart(db, p, ctx) {
    db.auth = db.auth || {};
    const now = ctx.now || Date.now();
    for (const [k, a] of Object.entries(db.auth)) if (now - a.at > 20 * 60e3) delete db.auth[k];
    const token = rid(20);
    db.auth[token] = { uid: ctx.uid, name: clean(p.name, 60), at: now };
    return { token };
  },
  authCheck(db, p, ctx) {
    const a = db.auth?.[p.token];
    if (!a) fail('Ссылка устарела — начните заново');
    if (!a.phone) return { done: false };
    const uid = 'tg-' + a.tgId;
    db.users = db.users || {};
    const prev = db.users[uid] || {};
    db.users[uid] = { ...prev, name: prev.name || a.name || a.tgName || 'Гость', phone: normPhone(a.phone), verified: true, via: 'bot', tgUser: a.tgUser || '', createdAt: prev.createdAt || a.at, consentAt: a.at };
    // переносим брони и подписку, сделанные до входа
    if (a.uid && a.uid !== uid) {
      db.bookings.forEach(b => { if (b.uid === a.uid) b.uid = uid; });
      if (db.subs[a.uid]) { db.subs[uid] = { ...db.subs[a.uid], chatId: a.tgId }; delete db.subs[a.uid]; }
    }
    delete db.auth[p.token];
    return { done: true, uid, tgId: a.tgId };
  },
  botStart(db, p) {
    const a = db.auth?.[p.token];
    if (!a) return { ok: false };
    a.chat = p.chatId;
    return { ok: true };
  },
  botContact(db, p) {
    db.phones = db.phones || {};
    db.phones[p.tgId] = { phone: p.phone, at: Date.now() };
    const a = Object.values(db.auth || {}).find(x => x.chat === p.chatId && !x.phone);
    if (!a) return { ok: false };
    Object.assign(a, { phone: p.phone, tgId: p.tgId, tgName: clean(p.tgName, 60), tgUser: clean(p.tgUser, 40) });
    return { ok: true };
  },
  deleteAccount(db, p, ctx) {
    if (!ctx.uid) fail('Нет пользователя');
    delete db.users?.[ctx.uid];
    delete db.subs[ctx.uid];
    db.bookings.forEach(b => { if (b.uid === ctx.uid) { b.name = 'Удалённый пользователь'; b.phone = '—'; b.tgUser = ''; b.comment = ''; b.uid = 'deleted'; if (['new', 'confirmed'].includes(b.status)) b.status = 'cancelled'; } });
    db.tournaments.forEach(t => { t.regs = t.regs.filter(r => r.uid !== ctx.uid); });
    return { deleted: true };
  },

  // ----- админ -----
  setSeat(db, p, ctx) {
    needAdmin(ctx);
    const seat = Number(p.seat);
    if (!ALL_SEATS.includes(seat)) fail('Нет такого места');
    const now = ctx.now || Date.now();
    if (p.status === 'free') delete db.seats[seat];
    else if (p.status === 'repair') db.seats[seat] = { status: 'repair', note: clean(p.note, 80) };
    else if (p.status === 'busy') {
      const until = Number(p.until);
      if (!(until > now)) fail('Время окончания должно быть позже текущего');
      db.seats[seat] = { status: 'busy', until };
    } else fail('Неизвестный статус');
    return {};
  },
  setBookingStatus(db, p, ctx) {
    needAdmin(ctx);
    const b = db.bookings.find(x => x.id === p.id);
    if (!b) fail('Бронь не найдена');
    if (!['new', 'confirmed', 'arrived', 'done', 'cancelled', 'noshow'].includes(p.status)) fail('Неизвестный статус');
    b.status = p.status;
    if (p.status === 'cancelled') { b.cancelledBy = 'admin';
    if (b.bonusUsed && db.users?.[b.uid]) { db.users[b.uid].bonusHours = (db.users[b.uid].bonusHours || 0) + b.bonusUsed; b.bonusUsed = 0; }
    }
    return { booking: b, notify: 'status' };
  },
  saveTournament(db, p, ctx) {
    needAdmin(ctx);
    const data = {
      game: clean(p.game, 40), title: clean(p.title, 60), format: clean(p.format, 20), teamSize: Math.max(1, Math.min(6, Number(p.teamSize) || 1)),
      start: Number(p.start), entry: Math.max(0, Number(p.entry) || 0), entryUnit: Number(p.teamSize) > 1 ? 'с команды' : 'с игрока',
      prize: Math.max(0, Number(p.prize) || 0), prizeNote: clean(p.prizeNote, 60),
      prizeHours: Math.max(0, Math.min(100, Math.round(Number(p.prizeHours) || 0))), prizeComment: clean(p.prizeComment, 200), slots: Math.max(2, Math.min(128, Number(p.slots) || 16)),
      about: clean(p.about, 600), hue: ['amber', 'red', 'green', 'blue'].includes(p.hue) ? p.hue : 'blue',
    };
    if (!data.game || !data.title) fail('Укажите игру и название');
    if (!(data.start > 0)) fail('Укажите дату и время');
    const t = p.id && db.tournaments.find(x => x.id === p.id);
    if (t) Object.assign(t, data);
    else db.tournaments.push({ id: 't-' + rid(5), ...data, open: true, regs: [] });
    return {};
  },
  toggleTournament(db, p, ctx) { needAdmin(ctx); const t = db.tournaments.find(x => x.id === p.id); if (!t) fail('Турнир не найден'); t.open = !t.open; return {}; },
  deleteTournament(db, p, ctx) { needAdmin(ctx); db.tournaments = db.tournaments.filter(x => x.id !== p.id); return {}; },
  adminAddReg(db, p, ctx) {
    needAdmin(ctx);
    const t = db.tournaments.find(x => x.id === p.id);
    if (!t) fail('Турнир не найден');
    if (t.regs.length >= t.slots) fail('Все места заняты');
    const team = clean(p.team, 40);
    if (team.length < 2) fail(t.teamSize > 1 ? 'Введите название команды' : 'Введите никнейм');
    if (t.regs.find(r => r.team.toLowerCase() === team.toLowerCase())) fail('Такое название уже есть в списке');
    const players = (p.players || []).map(x => clean(x, 32)).filter(Boolean).slice(0, 6);
    t.regs.push({ id: rid(), team, captain: clean(p.captain, 40), players, contact: clean(p.contact, 40), uid: 'admin', byAdmin: true, createdAt: ctx.now || Date.now() });
    return {};
  },
  awardWinner(db, p, ctx) {
    needAdmin(ctx);
    const t = db.tournaments.find(x => x.id === p.id);
    if (!t) fail('Турнир не найден');
    const r = t.regs.find(x => x.id === p.regId);
    if (!r) fail('Участник не найден');
    if (r.winner) fail('Этот участник уже награждён');
    const place = Math.max(1, Math.min(3, Number(p.place) || 1));
    const hours = Math.max(0, Math.min(100, Math.round(Number(p.hours) || 0)));
    const u = db.users?.[r.uid];
    if (hours && u) u.bonusHours = (u.bonusHours || 0) + hours;
    r.winner = { place, hours: u ? hours : 0, at: ctx.now || Date.now() };
    return { reg: r, tournament: t, credited: !!(hours && u), notify: 'winner' };
  },
  removeReg(db, p, ctx) { needAdmin(ctx); const t = db.tournaments.find(x => x.id === p.id); if (t) t.regs = t.regs.filter(r => r.id !== p.regId); return {}; },
  savePromo(db, p, ctx) {
    needAdmin(ctx);
    const data = { title: clean(p.title, 60), text: clean(p.text, 300), badge: clean(p.badge, 16) };
    if (!data.title) fail('Добавьте заголовок акции');
    const pr = p.id && db.promos.find(x => x.id === p.id);
    if (pr) Object.assign(pr, data); else db.promos.unshift({ id: 'pr-' + rid(5), ...data, active: true, createdAt: ctx.now || Date.now() });
    return {};
  },
  togglePromo(db, p, ctx) { needAdmin(ctx); const pr = db.promos.find(x => x.id === p.id); if (!pr) fail('Акция не найдена'); pr.active = !pr.active; return {}; },
  deletePromo(db, p, ctx) { needAdmin(ctx); db.promos = db.promos.filter(x => x.id !== p.id); return {}; },
  broadcast(db, p, ctx) {
    needAdmin(ctx);
    const text = clean(p.text, 1000);
    if (text.length < 5) fail('Напишите текст рассылки');
    const rec = { id: rid(), text, at: ctx.now || Date.now(), total: Object.keys(db.subs).length, sent: 0 };
    db.broadcasts.push(rec);
    return { broadcast: rec, notify: 'broadcast' };
  },
  setDemo(db, p, ctx) { needAdmin(ctx); db.demo = !!p.on; return {}; },
  // Сброс к чистым демо-данным: профили гостей и подписки сохраняются, брони и турниры — заново
  resetDemo(db, p, ctx) {
    needAdmin(ctx);
    const keep = { users: db.users || {}, subs: Object.fromEntries(Object.entries(db.subs || {}).filter(([k]) => !k.startsWith('seed-'))) };
    const fresh = seedDB(ctx.now || Date.now());
    for (const k of Object.keys(db)) delete db[k];
    Object.assign(db, fresh);
    db.users = keep.users;
    for (const u of Object.values(db.users)) delete u.bonusHours;
    Object.assign(db.subs, keep.subs);
    return {};
  },
};
export function normPhone(ph) {
  let d = String(ph || '').replace(/[^\d]/g, '');
  if (d.length === 9 && d.startsWith('5')) d = '995' + d; // местный грузинский мобильный
  if (d.length === 12 && d.startsWith('995')) return `+995 ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 11 && (d[0] === '7' || d[0] === '8')) return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  return d ? '+' + d : '';
}
function needAdmin(ctx) { if (!ctx.isAdmin) fail('Нужен доступ администратора'); }

export function runAction(db, name, payload, ctx) {
  const fn = actions[name];
  if (!fn) fail('Неизвестное действие');
  const res = fn(db, payload || {}, ctx);
  db.updatedAt = ctx.now || Date.now();
  return res;
}

// Сообщения клиенту в чат бота (parse_mode: HTML)
const seatLine = b => `🖥 ${b.seats.length > 1 ? 'Места' : 'Место'} ${b.seats.join(', ')} · ${[...new Set(b.seats.map(s => zoneOf(s).short || zoneOf(s).name))].join(', ')}`;
const timeLine = b => `📅 ${relDay(b.start)} · ${fmtTime(b.start)}–${fmtTime(b.start + b.hours * 3600e3)}`;
export function clientText(kind, b) {
  if (kind === 'created') return `🎮 <b>Бронь принята!</b>\n\n${seatLine(b)}\n${timeLine(b)}\n💳 ₾${b.price}, оплата в клубе\n\n🔑 Код брони: <b>${b.code}</b>\nНазови его на ресепшене, и тебя сразу найдут.\n\nАдмин скоро подтвердит бронь, ответ придёт сюда. За час до игры напомню 😉`;
  if (kind === 'remind') return `⏰ <b>Через час игра!</b>\n\n${seatLine(b)}\n${timeLine(b)}\n🔑 Код: <b>${b.code}</b>\n\nМесто держим 15 минут после начала. Если планы поменялись, отмени бронь в приложении, чтобы место досталось другим.`;
  if (kind === 'confirmed') return `✅ <b>Бронь подтверждена</b>\n\n${seatLine(b)}\n${timeLine(b)}\n🔑 Код: <b>${b.code}</b>\n\nЖдём тебя в NEBULA!`;
  if (kind === 'cancelled') return `❌ <b>Клуб отменил бронь ${b.code}</b>\n\n${seatLine(b)}\n${timeLine(b)}\n\nЕсли это ошибка, позвони нам: ${CLUB.phone}`;
  return '';
}
// Брони, о которых пора напомнить: начало через 75 минут или меньше, бронь сделана заранее
export function dueReminders(db, now = Date.now()) {
  const due = db.bookings.filter(b => !b.reminded && ['new', 'confirmed'].includes(b.status) && String(b.uid).startsWith('tg-')
    && b.start > now && b.start - now <= 75 * 60e3 && b.start - (b.createdAt || 0) > 100 * 60e3);
  due.forEach(b => { b.reminded = now; });
  return due;
}

// Текст уведомлений для бота
export function notifyText(kind, res, db) {
  if (kind === 'booking') {
    const b = res.booking;
    return `🎮 Новая бронь ${b.code}\n\nМеста: ${b.seats.join(', ')} (${[...new Set(b.seats.map(s => zoneOf(s).short || zoneOf(s).name))].join(', ')})\nКогда: ${relDay(b.start)} ${fmtTime(b.start)}–${fmtTime(b.start + b.hours * 3600e3)} (${b.hours} ч)\nСумма: ₾${b.price}${b.pkg ? ' · пакет' : ''}${b.promo ? '\nАкция: ' + b.promo : ''}\n\n${b.name} · ${b.phone}${b.tgUser ? ' · @' + b.tgUser : ''}${b.comment ? '\n💬 ' + b.comment : ''}`;
  }
  if (kind === 'cancel') { const b = res.booking; return `❌ Отмена брони ${b.code} — ${b.name}, места ${b.seats.join(', ')}, ${relDay(b.start)} ${fmtTime(b.start)}`; }
  if (kind === 'reg') { const t = res.tournament; return `🏆 Регистрация на «${t.title}» (${t.game})\n${res.reg.team}${res.reg.captain ? ' · ' + res.reg.captain : ''} · ${res.reg.contact}\nЗанято ${t.regs.length} из ${t.slots}`; }
  return '';
}
