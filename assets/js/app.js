import * as C from './core.js?v=1793300072';
import { store } from './store.js?v=1793300072';
import { tg, tgUser, initTelegram, haptic, setBack, openLink, requestWrite } from './tg.js?v=1793300072';
import { esc, $, $$, icon, toast, sheet, confirmSheet, countUp, busy, money, closeAllSheets, topSheet } from './ui.js?v=1793300072';
import { initAdmin } from './admin.js?v=1793300072';
import { initOnboarding, avatarHTML } from './onboarding.js?v=1793300072';

const { ZONES, PACKAGES, ALL_SEATS, CLUB, fmtTime, fmtDay, relDay, pad, clubParts, dayStart } = C;
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } } };

// ---------- состояние интерфейса ----------
const S = {
  tab: 'home',
  admin: false,
  adminTab: 'hall',
  prevTab: null,
  promoZone: 'ultra',
  bk: null,
};
const H = {}; // обработчики data-a

function nextSlotMin(now = Date.now()) {
  const p = clubParts(now);
  return Math.ceil((p.h * 60 + p.min + 10) / 30) * 30;
}
function initBk() {
  const now = Date.now();
  let day = dayStart(now), startMin = nextSlotMin(now);
  if (startMin > 23 * 60 + 30) { day += 864e5; startMin = 12 * 60; }
  S.bk = { day, startMin, hours: 2, seats: new Set() };
}
initBk();
const bkStart = () => S.bk.day + S.bk.startMin * 60e3;
const bkEnd = () => bkStart() + S.bk.hours * 3600e3;
const isToday = t => dayStart(t) === dayStart(Date.now());
const minSlotFor = day => isToday(day) ? nextSlotMin() : 0;
const zoneLabel = z => z.short || z.name;

// ---------- статусы мест ----------
function seatInWindow(v, seat) {
  const start = bkStart(), end = bkEnd();
  const c = C.seatConflict(v.occupied, seat, start, end);
  if (!c) return { cls: 'free', text: 'Свободен', ok: true };
  if (c.kind === 'repair') return { cls: 'repair', text: 'На ремонте' };
  if (c.kind === 'session' || c.start <= start) return { cls: 'busy', text: `до <span class="mono">${fmtTime(c.end)}</span>` };
  return { cls: 'booked', text: `Бронь <span class="mono">${fmtTime(c.start)}</span>` };
}
export function liveState(v, seat) {
  const l = v.live[seat];
  if (l.status === 'repair') return { cls: 'repair', text: 'На ремонте' };
  if (l.status === 'busy') return { cls: 'busy', text: `до <span class="mono">${fmtTime(l.until)}</span>` };
  if (l.nextBooking && l.nextBooking - v.now < 90 * 60e3) return { cls: 'booked', text: `Бронь <span class="mono">${fmtTime(l.nextBooking)}</span>` };
  return { cls: 'free', text: 'Свободен', later: l.nextBooking ? fmtTime(l.nextBooking) : null };
}
const freeCount = v => ALL_SEATS.filter(s => v.live[s].status === 'free').length;

// ---------- каркас ----------
const app = $('#app');
function shell() {
  app.innerHTML = `
    <header class="topbar" id="topbar"></header>
    <main class="screen" id="main"></main>
    <div id="bar"></div>
    <nav class="tabbar" id="tabbar" aria-label="Разделы"></nav>`;
  window.addEventListener('scroll', () => $('#topbar')?.classList.toggle('scrolled', scrollY > 4), { passive: true });
}

const CLIENT_TABS = [['home', 'Клуб', 'home'], ['book', 'Бронь', 'seat'], ['tours', 'Турниры', 'trophy'], ['promos', 'Акции', 'tag'], ['me', 'Профиль', 'user']];
const ADMIN_TABS = [['hall', 'Зал', 'grid'], ['bookings', 'Брони', 'list'], ['tours', 'Турниры', 'trophy'], ['promos', 'Акции', 'tag']];

function renderTop(v) {
  const free = freeCount(v);
  $('#topbar').innerHTML = S.admin
    ? `<div class="wordmark"><b>NEBUL<i>A</i></b><small>GAMING</small></div><span class="admin-flag">${icon('shield', 14)}Админ</span><span class="spacer"></span>${fsBtn()}
       <button class="icon-btn" data-a="adminExit" aria-label="Выйти из админки">${icon('logout', 20)}</button>`
    : `<div class="wordmark" data-a="logoTap"><b>NEBUL<i>A</i></b><small>GAMING</small></div><span class="spacer"></span>${fsBtn()}
       <button class="live-pill" data-a="go" data-tab="book" aria-label="Свободно ${free} из 22"><span class="dot"></span><b>${free}</b>/ 22 свободно</button>`;
}
function renderTabs(v) {
  const tabs = S.admin ? ADMIN_TABS : CLIENT_TABS;
  const cur = S.admin ? S.adminTab : S.tab;
  const pending = S.admin ? (v.bookings || []).filter(b => b.status === 'new' && b.start + b.hours * 3600e3 > v.now).length : 0;
  const mine = !S.admin ? v.myBookings.filter(b => ['new', 'confirmed'].includes(b.status) && b.start + b.hours * 3600e3 > v.now).length : 0;
  const nav = $('#tabbar');
  nav.style.setProperty('--n', tabs.length);
  nav.innerHTML = tabs.map(([id, label, ic]) => {
    const badge = (S.admin && id === 'bookings' && pending) ? `<span class="badge">${pending}</span>` : (!S.admin && id === 'me' && mine) ? `<span class="badge">${mine}</span>` : '';
    return `<button class="tab ${cur === id ? 'on' : ''}" data-a="${S.admin ? 'aTab' : 'go'}" data-tab="${id}" aria-current="${cur === id ? 'page' : 'false'}">${icon(ic, 22)}<span>${label}</span>${badge}</button>`;
  }).join('');
}

// ---------- полный экран (Telegram Desktop / macOS / браузер) ----------
const TG_DESKTOP = ['tdesktop', 'macos', 'weba', 'webk', 'web', 'unigram'];
const fsTgOk = () => !!(tg?.requestFullscreen && tg.isVersionAtLeast?.('8.0'));
const fsTg = () => !!tg && (TG_DESKTOP.includes(tg.platform) || (fsTgOk() && matchMedia('(min-width: 700px)').matches));
const fsWeb = () => !tg && !!document.fullscreenEnabled && matchMedia('(min-width: 900px) and (pointer: fine)').matches;
const isFs = () => tg ? !!tg.isFullscreen : !!document.fullscreenElement;
function fsBtn() {
  if (!fsTg() && !fsWeb()) return '';
  const on = isFs();
  return `<button class="fs-btn" data-a="fsToggle" aria-label="${on ? 'Выйти из полноэкранного режима' : 'Во весь экран'}" title="${on ? 'Свернуть' : 'Во весь экран'}">${icon(on ? 'minimize' : 'maximize', 18)}<span>${on ? 'Свернуть' : 'Во весь экран'}</span></button>`;
}
H.fsToggle = async () => {
  haptic.tap();
  const want = !isFs();
  LS.set('nebula:fs', want ? '1' : '0');
  if (tg && !fsTgOk()) return toast('Обновите Telegram Desktop до последней версии — тогда приложение развернётся на весь экран', 'err');
  try {
    if (tg) want ? tg.requestFullscreen() : tg.exitFullscreen();
    else want ? await document.documentElement.requestFullscreen() : await document.exitFullscreen();
  } catch { toast('Не получилось развернуть окно', 'err'); }
};
function initFullscreen() {
  if (tg) {
    tg.onEvent?.('fullscreenChanged', () => { document.documentElement.classList.toggle('is-fs', !!tg.isFullscreen); render(); });
    tg.onEvent?.('fullscreenFailed', e => { if (e?.error !== 'ALREADY_FULLSCREEN') toast('Полноэкранный режим недоступен в этой версии Telegram', 'err'); });
    if (fsTg() && fsTgOk() && LS.get('nebula:fs') === '1') { try { tg.requestFullscreen(); } catch { /* */ } }
  }
  document.addEventListener('fullscreenchange', () => { document.documentElement.classList.toggle('is-fs', !!document.fullscreenElement); render(); });
}

let lastKey = '';
let adminApi, obApi;
function render() {
  const v = store.view; if (!v) return;
  document.body.classList.toggle('admin', S.admin);
  // первый вход: подтверждение номера
  const needOb = !S.admin && (!v.profile || S.ob.step === 'avatar');
  document.body.classList.toggle('onboarding', needOb);
  if (needOb) {
    const fresh = lastKey !== 'ob:' + S.ob.step;
    $('#topbar').innerHTML = ''; $('#tabbar').innerHTML = ''; $('#bar').innerHTML = '';
    const main = $('#main');
    main.className = 'screen' + (fresh ? ' enter' : '');
    main.innerHTML = obApi.screen(v);
    obApi.after();
    lastKey = 'ob:' + S.ob.step;
    setBack(null);
    return;
  }
  const key = S.admin ? 'a:' + S.adminTab : S.tab + (S.tab === 'book' ? ':' + S.bk.step : '');
  const fresh = key !== lastKey;
  // сохраняем горизонтальные прокрутки
  const keep = {}; $$('[data-keep]').forEach(el => { keep[el.dataset.keep] = el.scrollLeft; });
  renderTop(v); renderTabs(v);
  const main = $('#main');
  let html = '';
  if (S.admin) html = adminApi.screens[S.adminTab](v);
  else html = ({ home, book, tours, promos, me })[S.tab](v);
  const seatStep = !S.admin && S.tab === 'book' && S.bk.step === 'seat';
  main.className = 'screen' + (fresh ? ' enter' : '') + (seatStep ? ' with-bar' : '');
  main.innerHTML = html;
  $('#bar').innerHTML = seatStep ? sumbar(v) : '';
  $$('[data-keep]').forEach(el => { if (!fresh && keep[el.dataset.keep] != null) el.scrollLeft = keep[el.dataset.keep]; });
  if (fresh) { scrollTo(0, 0); afterFresh(); }
  lastKey = key;
  window.__rootBack = seatStep ? () => H.bkToWhen() : (!S.admin && S.tab !== 'home') ? () => go('home') : (S.admin ? () => H.adminExit() : null);
  if (!topSheet()) setBack(window.__rootBack);
}
function afterFresh() {
  const n = $('#heroNum'); if (n) countUp(n, Number(n.dataset.to));
  const t = $('[data-keep="times"] .chip.on'); if (t) t.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function go(tab) { S.tab = tab; haptic.tap(); render(); }

// ---------- КЛУБ (главная) ----------
function home(v) {
  const free = freeCount(v);
  const fromP = Math.min(...ZONES.map(z => z.price[0]));
  const up = (v.myBookings || []).filter(b => ['new', 'confirmed', 'arrived'].includes(b.status) && b.start + b.hours * 3600e3 > v.now).sort((a, b) => a.start - b.start);
  return `<div class="cols"><div class="col">
  ${up.length ? `<section class="sec home-bk"><div class="sec-head"><h2 class="h2">${up.length > 1 ? 'Ваши брони' : 'Ваша бронь'}</h2>${up.length > 1 ? `<button class="link-btn" data-a="go" data-tab="me">Все ${up.length}${icon('chevron', 16)}</button>` : ''}</div>${bookingCard(up[0])}</section>` : ''}
  <section class="hero" aria-label="Свободные места сейчас">
    <div class="hero-top">
      <div>
        <div class="hero-num"><span class="big" id="heroNum" data-to="${free}">${free}</span><span class="of">/ 22</span></div>
        <div class="hero-label">Свободно сейчас</div>
        <div class="hero-upd"><span class="dot"></span><span>обновлено <span class="mono">${fmtTime(v.now)}</span></span></div>
      </div>
    </div>
    <div class="minimap">
      ${ZONES.map(z => `<div class="mm-row"><span class="zl">${zoneLabel(z)}<em>${z.hz}</em></span><div class="mm-seats">${z.seats.map(s => `<span class="mm ${liveState(v, s).cls}" title="Место ${s}">${s}</span>`).join('')}</div></div>`).join('')}
    </div>
    <div class="legend"><span><i style="background:var(--green)"></i>Свободен</span><span><i style="background:#2a2c4a"></i>Занят</span><span><i style="background:var(--amber)"></i>Свободен, но скоро бронь</span><span><i style="background:var(--red)"></i>Ремонт</span></div>
  </section>
  <div style="margin-top:12px"><button class="btn" data-a="go" data-tab="book">${icon('seat', 18)}Забронировать место</button></div>
  <div class="facts">
    <div><b>500<em>Hz</em></b><span>мониторы</span></div>
    <div><b>RTX 5070</b><span>видеокарты</span></div>
    <div><b>₾${fromP}</b><span>от / час</span></div>
  </div>

  </div><div class="col">
  <section class="sec">
    <div class="sec-head"><h2 class="h2">Пакетом выгоднее</h2><button class="link-btn" data-a="go" data-tab="promos">Цены${icon('chevron', 16)}</button></div>
    <div class="hscroll" data-keep="pk">
      ${PACKAGES.map(pk => {
        const min = pk.prices.start[0];
        // максимальная выгода против почасовой оплаты (будни)
        const pct = Math.max(...ZONES.map(z => 1 - pk.prices[z.id][0] / (z.price[0] * pk.hours)));
        const ic = { p3: 'clock', p5: 'zap', morning: 'sun', night: 'moon' }[pk.id];
        const title = { p3: '3 часа', p5: '5 часов', morning: 'Утро', night: 'Ночь' }[pk.id];
        const sub = { p3: 'Любые 3 часа с 08:00 до 19:00', p5: 'Пять часов подряд, в любое время', morning: 'С 08:00 до 13:00, 5 часов', night: 'С 23:00 до 09:00, 10 часов' }[pk.id];
        return `<button class="pk-card pk-${pk.id}" data-a="usePkg" data-pkg="${pk.id}" aria-label="${pk.name}, от ₾${min}">
          <span class="pk-top"><span class="pk-ic">${icon(ic, 18)}</span><span class="pk-save">до −${Math.round(pct * 100)}%</span></span>
          <span class="pk-name">${title}</span>
          <span class="pk-win">${sub}</span>
          <span class="pk-price"><small>от</small>₾${min}<em>/ место</em></span>
          <span class="pk-go">Выбрать${icon('chevron', 15)}</span>
        </button>`;
      }).join('')}
    </div>
  </section>

  <section class="sec">
    <div class="sec-head"><h2 class="h2">Сетапы</h2><span class="dim" style="font-size:13px">Пн–Чт / Пт–Вс</span></div>
    <div class="rows">
      ${ZONES.map(z => `<button class="rowi" data-a="zoneInfo" data-zone="${z.id}">
        <span class="grow"><span class="t">${z.name} <span class="dim" style="font-weight:500">${z.hz}Hz</span></span><span class="s">${z.specs.GPU} · ${z.specs['Монитор']}</span></span>
        <span style="text-align:right"><span class="fig cyan" style="font-size:17px">₾${z.price[0]}</span><span class="dim" style="font-size:13px"> / ${z.price[1]}</span></span>
        ${icon('chevron', 18)}</button>`).join('')}
    </div>
  </section>

  <section class="sec">
    <div class="sec-head"><h2 class="h2">Как добраться</h2></div>
    ${contactsBlock()}
  </section>
  </div></div>
  ${footer()}`;
}
function contactsBlock() {
  return `<div class="rows">
      <button class="rowi" data-a="open" data-url="${CLUB.map}"><span class="ic-wrap">${icon('pin', 20)}</span><span class="grow"><span class="t">${CLUB.name}</span><span class="s">${CLUB.city} · открыть в Google Maps</span></span>${icon('chevron', 18)}</button>
      <a class="rowi" href="tel:${CLUB.phoneRaw}"><span class="ic-wrap">${icon('phone', 20)}</span><span class="grow"><span class="t">${CLUB.phone}</span><span class="s">Позвонить в клуб</span></span>${icon('chevron', 18)}</a>
    </div>
    <div class="socials">
      <a href="${CLUB.instagram}" data-a="open" data-url="${CLUB.instagram}">Instagram</a>
      <a href="${CLUB.tiktok}" data-a="open" data-url="${CLUB.tiktok}">TikTok</a>
      <a href="${CLUB.facebook}" data-a="open" data-url="${CLUB.facebook}">Facebook</a>
    </div>`;
}
const footer = () => `<footer class="foot"><div class="wordmark"><b>NEBUL<i>A</i></b><small>GAMING</small></div>Connect. Play. Win. · Батуми</footer>`;

H.zoneInfo = el => {
  const z = C.zoneById(el.dataset.zone);
  const s = sheet({
    title: `${z.name} · ${z.hz}Hz`,
    body: `<p class="muted lead"><span class="fig cyan" style="font-size:22px">₾${z.price[0]}</span> <span class="dim">/ ₾${z.price[1]} за час${z.perSeat ? ' за место' : ''} · Пн–Чт / Пт–Вс</span></p>
      <dl class="specs">${Object.entries(z.specs).map(([k, val]) => `<dt>${k}</dt><dd>${esc(val)}</dd>`).join('')}</dl>
      <button class="btn" data-a="bookZone" data-zone="${z.id}">Выбрать место в ${zoneLabel(z)}</button>`,
  });
  s.root.dataset.zone = z.id;
};
H.bookZone = el => { closeAllSheets(); S.tab = 'book'; S.bk.step = 'seat'; render(); setTimeout(() => $('#zone-' + el.dataset.zone)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
H.open = (el, e) => { e.preventDefault(); openLink(el.dataset.url); };
H.go = el => { closeAllSheets(); go(el.dataset.tab); };

// ---------- БРОНЬ ----------
function book(v) {
  const min = minSlotFor(S.bk.day);
  if (isToday(S.bk.day) && S.bk.startMin < min) { if (min > 23 * 60 + 30) { S.bk.day += 864e5; S.bk.startMin = 12 * 60; } else S.bk.startMin = min; }
  return S.bk.step === 'seat' ? bookSeat(v) : bookWhen(v);
}
const MON_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
// Шаг 1 — только день, время и часы
function bookWhen(v) {
  const days = Array.from({ length: 7 }, (_, i) => dayStart(Date.now()) + i * 864e5 + 3 * 3600e3).map(dayStart);
  const slots = []; for (let m = Math.max(0, minSlotFor(S.bk.day)); m <= 23 * 60 + 30; m += 30) slots.push(m);
  const start = bkStart(), end = bkEnd();
  const free = ALL_SEATS.filter(s => seatInWindow(v, s).ok).length;
  return `
  <h1 class="h1">Бронь</h1>
  <div class="bw">
    <section class="bw-sec">
      <h2 class="bw-t">Выберите день</h2>
      <div class="hscroll" data-keep="days" role="listbox" aria-label="День">
        ${days.map((d, i) => {
          const p = clubParts(d);
          const lbl = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : C.wdShort(d);
          const disabled = i === 0 && nextSlotMin() > 23 * 60 + 30;
          return `<button class="chip tall ${d === S.bk.day ? 'on' : ''}" data-a="bkDay" data-day="${d}" ${disabled ? 'disabled' : ''}>${lbl}<small>${p.d} ${MON_SHORT[p.m]}</small></button>`;
        }).join('')}
      </div>
    </section>
    <section class="bw-sec">
      <h2 class="bw-t">Время начала</h2>
      <div class="hscroll" data-keep="times" role="listbox" aria-label="Время начала">
        ${slots.map(m => `<button class="chip time ${m === S.bk.startMin ? 'on' : ''}" data-a="bkTime" data-min="${m}">${pad(Math.floor(m / 60))}:${pad(m % 60)}</button>`).join('')}
      </div>
    </section>
    <section class="bw-sec bw-row">
      <div><h2 class="bw-t" style="margin:0">Сколько часов</h2><span class="bw-end">до <span class="mono">${fmtTime(end)}</span>${clubParts(end).d !== clubParts(start).d ? ' следующего дня' : ''}</span></div>
      <div class="stepper">
        <button data-a="bkHours" data-d="-1" ${S.bk.hours <= 1 ? 'disabled' : ''} aria-label="Меньше">${icon('minus', 20)}</button>
        <output aria-live="polite">${S.bk.hours}<small>ч</small></output>
        <button data-a="bkHours" data-d="1" ${S.bk.hours >= 12 ? 'disabled' : ''} aria-label="Больше">${icon('plus', 20)}</button>
      </div>
    </section>
    <button class="btn" data-a="bkToSeat" ${free ? '' : 'disabled'}>${free ? `Выбрать место · свободно ${free}` : 'В это время всё занято'}${free ? icon('chevron', 18) : ''}</button>
  </div>`;
}
// Шаг 2 — карта мест
function bookSeat(v) {
  const start = bkStart();
  return `
  <div class="bk-head">
    <button class="icon-btn" data-a="bkToWhen" aria-label="Назад к выбору времени">${icon('back', 22)}</button>
    <div class="grow"><b>Выберите место</b><span>${relDay(start)}, ${fmtTime(start)}–${fmtTime(bkEnd())} · ${S.bk.hours} ч</span></div>
    <button class="link-btn" data-a="bkToWhen">Изменить</button>
  </div>
  <div class="bk-layout"><div class="bk-main">
    <div class="legend" style="margin:4px 2px 14px"><span><i style="background:var(--green)"></i>Свободен</span><span><i style="background:var(--grey)"></i>Занят</span><span><i style="background:var(--amber)"></i>Забронирован на это время</span><span><i style="background:var(--blue)"></i>Ваш выбор</span></div>
    <div class="zones">
    ${ZONES.map(z => {
      const pr = z.price[C.isWeekend(start) ? 1 : 0];
      const allFree = z.seats.every(s => seatInWindow(v, s).ok);
      return `<section class="zone" id="zone-${z.id}" aria-label="${z.name}">
        <div class="zone-h"><b>${z.name}</b><span class="hz">${z.hz}Hz</span><span class="pr"><b>₾${pr}</b> / ${z.perSeat ? 'место' : 'час'}</span></div>
        <div class="seats">${z.seats.map(s => seatTile(v, s)).join('')}</div>
        ${allFree && z.seats.length > 1 ? `<div class="zone-tools"><button class="btn btn-ghost btn-xs" data-a="pickZone" data-zone="${z.id}">${z.id === 'duo' ? 'Вся комната' : 'Вся зона'} · ${z.seats.length} ${C.plural(z.seats.length, 'место', 'места', 'мест')}</button></div>` : ''}
      </section>`;
    }).join('')}
    </div>
  </div><aside class="bk-aside" aria-label="Ваша бронь">${summaryCard(v)}</aside></div>`;
}
H.bkToSeat = () => { S.bk.step = 'seat'; haptic.light(); lastKey = ''; render(); };
H.bkToWhen = () => { S.bk.step = 'when'; haptic.tap(); lastKey = ''; render(); };
const pkgLabel = pk => `пакет «${{ p3: '3 часа', p5: '5 часов', morning: 'Утро', night: 'Ночь' }[pk.id]}»`;
// подробный расчёт: по зонам × часы × тариф, затем пакет и итог
function calcRows() {
  const seats = [...S.bk.seats].sort((a, b) => a - b);
  const start = bkStart(), h = S.bk.hours, we = C.isWeekend(start) ? 1 : 0;
  const groups = ZONES.map(z => ({ z, n: seats.filter(s => z.seats.includes(s)).length })).filter(g => g.n);
  const q = C.quote(seats, start, h);
  return { seats, q, rows: groups.map(({ z, n }) => ({ label: `${zoneLabel(z)} · ${n} ${C.plural(n, 'место', 'места', 'мест')} × ${h} ч × ₾${z.price[we]}`, sum: n * h * z.price[we] })) };
}
function summaryCard(v) {
  const { seats, q, rows } = calcRows();
  const pk = q.pkg && PACKAGES.find(p => p.id === q.pkg);
  return `<div class="bk-sum">
    <h2 class="h3">Ваша бронь</h2>
    <div class="bk-when"><span class="ic-wrap">${icon('calendar', 18)}</span><div><b>${relDay(bkStart())}, ${fmtTime(bkStart())}–${fmtTime(bkEnd())}</b><span>${S.bk.hours} ${C.plural(S.bk.hours, 'час', 'часа', 'часов')} · ${C.isWeekend(bkStart()) ? 'тариф выходных' : 'будний тариф'}</span></div></div>
    ${seats.length ? `<div class="bk-seats">${seats.map(s => `<button class="bk-seat" data-a="bkSeat" data-seat="${s}" aria-label="Убрать место ${s}">${s}${icon('close', 12)}</button>`).join('')}</div>
      <div class="bk-calc">
        ${rows.map(r => `<div><span>${r.label}</span><span>${money(r.sum)}</span></div>`).join('')}
        ${pk ? `<div class="disc"><span>Скидка: ${pkgLabel(pk)}</span><span>−${money(q.saving)}</span></div>` : ''}
        <div class="tot"><span>Итого</span><span>${money(q.price)}</span></div>
      </div>
      <button class="btn" data-a="bkNext">Далее${icon('chevron', 18)}</button>`
    : `<p class="bk-empty">Выберите одно или несколько мест на карте слева.</p><button class="btn" disabled>Далее</button>`}
    <p class="bk-pay">${icon('clock', 15)}Оплата в клубе. Место держим 15 минут после начала.</p>
  </div>`;
}
function seatTile(v, s) {
  const st = seatInWindow(v, s);
  const sel = S.bk.seats.has(s);
  const later = st.ok && v.live[s].nextBooking && v.live[s].nextBooking >= bkEnd() && v.live[s].nextBooking - bkEnd() < 3 * 3600e3 ? fmtTime(v.live[s].nextBooking) : '';
  return `<button class="seat ${st.cls} ${st.ok ? 'pick' : ''} ${sel ? 'sel' : ''}" data-a="bkSeat" data-seat="${s}" ${st.ok ? '' : 'disabled'} aria-pressed="${sel}" aria-label="Место ${s}, ${st.text.replace(/<[^>]+>/g, '')}">
    <span class="n">${s}</span><span class="st">${sel ? 'Выбрано' : st.text}</span>
    <span class="tick">${icon('check', 13)}</span>${later ? `<span class="later" title="Следующая бронь">${later}</span>` : ''}</button>`;
}
function sumbar(v) {
  const n = S.bk.seats.size;
  if (!n) return `<div class="sumbar empty"><div class="sumbar-in"><div class="tot"><b>Выберите место на карте</b><span>${relDay(bkStart())}, ${fmtTime(bkStart())}–${fmtTime(bkEnd())} · ${S.bk.hours} ч</span></div><button class="btn" disabled>Далее</button></div></div>`;
  const q = C.quote([...S.bk.seats], bkStart(), S.bk.hours);
  return `<div class="sumbar"><div class="sumbar-in">
    <div class="tot"><b>${money(q.price)}${q.saving > 0 ? `<s>${money(q.hourly)}</s>` : ''}</b>
    <span>${n === 1 ? 'Место ' : 'Места '}${[...S.bk.seats].sort((a, b) => a - b).join(', ')} · ${S.bk.hours} ч${q.pkg ? ` · <em>${pkgLabel(PACKAGES.find(p => p.id === q.pkg))}</em>` : ''}</span></div>
    <button class="btn" data-a="bkNext">Далее${icon('chevron', 18)}</button></div></div>`;
}
function dropConflicts() {
  const v = store.view; const dropped = [];
  for (const s of [...S.bk.seats]) if (!seatInWindow(v, s).ok) { S.bk.seats.delete(s); dropped.push(s); }
  if (dropped.length) toast(`${dropped.length > 1 ? 'Места' : 'Место'} ${dropped.join(', ')} ${dropped.length > 1 ? 'заняты' : 'занято'} в это время — убрали из выбора`);
}
H.bkDay = el => {
  S.bk.day = Number(el.dataset.day);
  const min = minSlotFor(S.bk.day); if (S.bk.startMin < min) S.bk.startMin = min;
  haptic.tap(); dropConflicts(); render();
  $('[data-keep="times"] .chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
};
H.bkTime = el => { S.bk.startMin = Number(el.dataset.min); haptic.tap(); dropConflicts(); render(); };
H.bkHours = el => { S.bk.hours = Math.max(1, Math.min(12, S.bk.hours + Number(el.dataset.d))); haptic.tap(); dropConflicts(); render(); };
H.bkSeat = el => {
  const s = Number(el.dataset.seat);
  if (S.bk.seats.has(s)) S.bk.seats.delete(s); else { if (S.bk.seats.size >= 10) return toast('За раз — до 10 мест'); S.bk.seats.add(s); }
  haptic.light(); render();
};
H.pickZone = el => { const z = C.zoneById(el.dataset.zone); z.seats.forEach(s => S.bk.seats.add(s)); haptic.light(); render(); };
H.jump = el => { $('#zone-' + el.dataset.zone)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); haptic.tap(); };
H.usePkg = el => {
  const pk = PACKAGES.find(p => p.id === el.dataset.pkg);
  const now = Date.now();
  let day = S.tab === 'book' ? S.bk.day : dayStart(now);
  let startMin = S.bk.startMin;
  if (pk.fixedStart != null) startMin = pk.fixedStart;
  else if (pk.id === 'p3' && !(startMin >= 480 && startMin <= 960)) startMin = 480;
  if (isToday(day) && startMin < nextSlotMin(now)) {
    if (pk.id === 'p5') startMin = nextSlotMin(now);
    else if (pk.id === 'p3' && nextSlotMin(now) <= 960) startMin = Math.max(480, nextSlotMin(now));
    else { day += 864e5; toast(`${pk.name} — переносим на завтра`); }
  }
  if (startMin > 23 * 60 + 30) { day += 864e5; startMin = 12 * 60; }
  Object.assign(S.bk, { day, startMin, hours: pk.hours, step: 'seat' });
  closeAllSheets();
  dropConflicts();
  S.tab = 'book'; haptic.tap(); render();
};
// варианты тарифа для выбранных мест и времени начала
function tariffOptions(seats, base) {
  // список не зависит от выбранного варианта: часы из шага «Когда» + подходящие пакеты, по возрастанию
  const start = bkStart(), iv = store.view.occupied;
  const fits = h => seats.every(s => !C.seatConflict(iv, s, start, start + h * 3600e3));
  const hrs = new Set([base]);
  for (const pk of PACKAGES) if (pk.hours !== base && fits(pk.hours) && C.quote(seats, start, pk.hours).pkg === pk.id) hrs.add(pk.hours);
  return [...hrs].sort((a, b) => a - b).map(h => {
    const q = C.quote(seats, start, h), pk = q.pkg && PACKAGES.find(x => x.id === q.pkg);
    return { hours: h, title: `${h} ${C.plural(h, 'час', 'часа', 'часов')} · ${fmtTime(start)}–${fmtTime(start + h * 3600e3)}`, sub: pk ? `${pk.name} · выгода ${money(q.hourly - q.price)}` : 'Почасовой тариф', price: q.price, old: q.saving > 0 ? q.hourly : 0 };
  });
}
H.bkNext = () => {
  const v = store.view;
  const st = { promo: '', bonus: (v.profile?.bonusHours || 0) > 0, base: S.bk.hours };
  haptic.light();
  const s = sheet({ title: 'Подтверждение', body: '' });
  const draw = () => {
    const seats = [...S.bk.seats].sort((a, b) => a - b);
    const q = C.quote(seats, bkStart(), S.bk.hours);
    const zones = [...new Set(seats.map(x => zoneLabel(C.zoneOf(x))))].join(', ');
    const opts = tariffOptions(seats, st.base);
    s.body.innerHTML = `
      <div class="summary">
        <div class="li"><span>${seats.length > 1 ? 'Места' : 'Место'}</span><span>${seats.join(', ')} · ${zones}</span></div>
        <div class="li"><span>Когда</span><span>${relDay(bkStart())}, ${fmtTime(bkStart())}–${fmtTime(bkEnd())}</span></div>
      </div>
      ${opts.length > 1 ? `<h3 class="cf-t">Тариф</h3>
      <div class="opts" role="radiogroup" aria-label="Тариф">${opts.map(o => `<button type="button" class="opt ${o.hours === S.bk.hours ? 'on' : ''}" data-hours="${o.hours}" role="radio" aria-checked="${o.hours === S.bk.hours}"><span class="radio"></span><span class="grow"><b>${o.title}</b><span>${o.sub}</span></span><span class="opt-p">${o.old ? `<s>${money(o.old)}</s>` : ''}${money(o.price)}</span></button>`).join('')}</div>` : ''}
      ${v.promos.length ? `<h3 class="cf-t">Акция</h3>
      <div class="promo-chips">${['', ...v.promos.map(p => p.title)].map(t => `<button type="button" class="chip ${st.promo === t ? 'on' : ''}" data-promo="${esc(t)}">${t ? esc(t) : 'Без акции'}</button>`).join('')}</div>
      ${st.promo ? (() => { const pr = v.promos.find(p => p.title === st.promo); return `<div class="cf-promo">${pr?.badge ? `<span class="cf-badge">${esc(pr.badge)}</span>` : ''}<p>${esc(pr?.text || '')}</p><small>${icon('check', 13)}Скидку учтём при оплате в клубе</small></div>`; })() : ''}` : ''}
      <form id="bkForm" novalidate>
        <div class="who" style="margin-top:18px">${avatarHTML(v, 44)}<div class="grow"><b>${esc(v.profile?.name || '')}</b><span>${esc(v.profile?.phone || '')}</span></div></div>
        <label class="field"><span>Комментарий <span class="dim" style="font-weight:500">— необязательно</span></span><input name="comment" placeholder="Например: нужен геймпад"></label>
        <input type="hidden" name="promo" value="${esc(st.promo)}"><input type="hidden" name="useBonus" value="${st.bonus ? '1' : ''}">
        ${(() => {
          const bh = v.profile?.bonusHours || 0; if (!bh) return '';
          const { used: use, off } = C.bonusDiscount(bh, seats, bkStart(), S.bk.hours);
          st.off = st.bonus ? off : 0;
          return `<button type="button" class="bonus-opt ${st.bonus ? 'on' : ''}" data-bonus role="switch" aria-checked="${st.bonus}"><span class="grow"><b>Списать бонусные часы</b><span>${use} из ${bh} ч · −${money(off)}</span></span><span class="switch ${st.bonus ? 'on' : ''}"></span></button>`;
        })()}
        <div class="cf-total"><span>Итого</span><span>${q.saving > 0 || st.off ? `<s>${money(q.hourly)}</s>` : ''}${money(q.price - (st.off || 0))}</span></div>
        <button class="btn" type="submit" data-a="bkSubmit">Забронировать</button>
        <p class="pay-note" style="margin:12px 0 0">${icon('clock', 16)}<span>Оплата в клубе. Место держим 15 минут после начала брони.</span></p>
      </form>`;
  };
  draw();
  s.body.addEventListener('click', e => {
    const o = e.target.closest('[data-hours]');
    if (o) { S.bk.hours = Number(o.dataset.hours); haptic.tap(); draw(); render(); return; }
    const p = e.target.closest('[data-promo]');
    if (p) { st.promo = p.dataset.promo; haptic.tap(); draw(); }
    if (e.target.closest('[data-bonus]')) { st.bonus = !st.bonus; haptic.tap(); draw(); }
  });
};
H.askContact = el => {
  tg.requestContact((ok, resp) => {
    const ph = resp?.responseUnsafe?.contact?.phone_number;
    if (ph) { const inp = $('#bkForm [name=phone]'); inp.value = (ph.startsWith('+') ? '' : '+') + ph; haptic.ok(); }
    else if (!ok) toast('Можно ввести номер вручную');
  });
};
H.bkSubmit = async (el, e) => {
  e.preventDefault();
  const f = $('#bkForm'); const data = Object.fromEntries(new FormData(f));
  await busy(el, async () => {
    try {
      const res = await store.act('createBooking', { ...data, seats: [...S.bk.seats], start: bkStart(), hours: S.bk.hours });
      LS.set('nebula:name', data.name); LS.set('nebula:phone', data.phone);
      haptic.ok();
      closeAllSheets();
      S.bk.seats.clear(); S.bk.step = 'when'; render();
      successSheet(res.booking);
    } catch (err) { toast(err.message, 'err'); }
  });
};
function successSheet(b) {
  const z = C.zoneOf(b.seats[0]);
  sheet({
    body: `<div class="done">
      <div class="done-mark"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
      <h2>${b.seats.length > 1 ? `Места ${b.seats.join(', ')} ваши` : `Место ${b.seats[0]} ваше`}</h2>
      <p class="muted">${relDay(b.start)}, ${fmtTime(b.start)}–${fmtTime(b.start + b.hours * 3600e3)} · ${zoneLabel(z)} ${z.hz}Hz</p>
      <div class="code">${b.code}</div>
      <p class="dim" style="font-size:13.5px;margin:6px 0 24px">Назовите код на ресепшене. ${store.mode === 'remote' ? 'Подтверждение придёт в Telegram.' : 'Администратор подтвердит бронь.'}</p>
      <div class="row-btns"><button class="btn btn-ghost" data-a="open" data-url="${CLUB.map}">${icon('route', 18)}Маршрут</button><button class="btn" data-close>Готово</button></div>
    </div>`,
  });
}

// ---------- ТУРНИРЫ ----------
function untilText(t, now) {
  const d = t - now;
  if (d < 0) return 'идёт сейчас';
  if (d < 3600e3) return `через ${Math.max(1, Math.round(d / 60e3))} мин`;
  if (isToday(t)) return `сегодня в ${fmtTime(t)}`;
  const days = Math.round((dayStart(t) - dayStart(now)) / 864e5);
  if (days === 1) return `завтра в ${fmtTime(t)}`;
  return `через ${days} ${C.plural(days, 'день', 'дня', 'дней')}`;
}
function tourCard(t, v) {
  const full = t.regCount >= t.slots;
  const unit = t.teamSize > 1 ? C.plural(t.slots, 'команда', 'команды', 'команд') : C.plural(t.slots, 'игрок', 'игрока', 'игроков');
  return `<article class="card tour hue-${t.hue}">
    <div class="tour-band"></div>
    <div class="tour-in" data-a="tourOpen" data-id="${t.id}" role="button" tabindex="0">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span class="game"><i></i>${esc(t.game)} · ${esc(t.format)}</span><span class="countdown">${untilText(t.start, v.now)}</span></div>
      <h3>${esc(t.title)}</h3>
      <div class="tour-meta">
        <div>${t.prize ? `<b class="cyan">₾${t.prize}</b><span>${t.prizeHours ? `+ ${t.prizeHours} ч в подарок` : 'призовой'}</span>` : t.prizeHours ? `<b class="cyan">${t.prizeHours} ч</b><span>в подарок</span>` : `<b class="cyan">${icon('trophy', 16)}</b><span>призы</span>`}</div>
        <div><b>${fmtDay(t.start).split(', ')[1]}</b><span>${C.wdShort(t.start)}, ${fmtTime(t.start)}</span></div>
        <div><b>${t.entry ? '₾' + t.entry : 'Free'}</b><span>${t.entry ? t.entryUnit : 'вход'}</span></div>
      </div>
      <div class="slots"><div class="bar"><i style="width:${Math.min(100, t.regCount / t.slots * 100)}%"></i></div><span><b style="color:var(--ink)">${t.regCount}</b> из ${t.slots} ${unit}</span></div>
    </div>
    <div style="padding:0 18px 18px">
      ${t.myReg ? `<div class="reg-ok">${icon('check', 18)}Вы участвуете · ${esc(t.myReg.team)}</div>`
        : !t.open ? `<button class="btn btn-ghost" disabled>Регистрация закрыта</button>`
        : full ? `<button class="btn btn-ghost" disabled>Мест нет</button>`
        : `<button class="btn" data-a="tourOpen" data-id="${t.id}" data-reg="1">Участвовать</button>`}
    </div>
  </article>`;
}
function tours(v) {
  const upcoming = v.tournaments.filter(t => t.start > v.now - 6 * 3600e3);
  const past = v.tournaments.filter(t => t.start <= v.now - 6 * 3600e3);
  return `<h1 class="h1">Турниры</h1>
    <p class="sub">Регистрируйтесь прямо здесь — взнос оплачивается на ресепшене в день игры.</p>
    ${upcoming.length ? `<div class="tgrid">${upcoming.map(t => tourCard(t, v)).join('')}</div>` : `<div class="card empty"><b>Скоро анонсируем новый турнир</b>Включите уведомления в «Акциях», чтобы не пропустить.</div>`}
    ${past.length ? `<h2 class="group-t">Прошедшие</h2><div class="rows">${past.map(t => `<div class="rowi"><span class="grow"><span class="t">${esc(t.title)}</span><span class="s">${esc(t.game)} · ${fmtDay(t.start)}</span></span><span class="dim">${t.winners?.length ? '🏆 ' + esc(t.winners[0]) : t.regCount + ' уч.'}</span></div>`).join('')}</div>` : ''}
    ${footer()}`;
}
H.tourOpen = el => {
  const v = store.view; const t = v.tournaments.find(x => x.id === el.dataset.id); if (!t) return;
  const u = tgUser();
  const solo = t.teamSize === 1;
  const canReg = t.open && !t.myReg && t.regCount < t.slots;
  const s = sheet({
    title: t.title,
    body: `<p class="muted" style="margin:0 0 16px">${esc(t.game)} · ${esc(t.format)} · ${fmtDay(t.start)}, ${fmtTime(t.start)}</p>
      <div class="summary">
        ${t.prize ? `<div class="li"><span>Призовой фонд</span><span class="cyan">₾${t.prize}${t.prizeNote ? ` <span class="dim" style="font-weight:500">(${esc(t.prizeNote)})</span>` : ''}</span></div>` : ''}
        ${t.prizeHours ? `<div class="li"><span>Победителям</span><span class="cyan">+${t.prizeHours} ч игры на аккаунт</span></div>` : ''}
        <div class="li"><span>Взнос</span><span>${t.entry ? `₾${t.entry} ${t.entryUnit}` : 'бесплатно'}</span></div>
        <div class="li"><span>Участники</span><span>${t.regCount} из ${t.slots}</span></div>
      </div>
      ${t.prizeComment ? `<div class="prize-sum" style="margin-bottom:16px">${icon('trophy', 16)}<span>${esc(t.prizeComment)}</span></div>` : ''}
      ${t.about ? `<p style="margin:0 0 18px;color:var(--ink-2);font-size:14.5px;line-height:1.55">${esc(t.about)}</p>` : ''}
      ${t.teams.length ? `<h3 class="group-t" style="margin-top:0">${solo ? 'Игроки' : 'Команды'}</h3><div class="team-list" style="margin-bottom:22px">${t.teams.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}
      ${t.myReg ? `<div class="reg-ok" style="margin-bottom:10px">${icon('check', 18)}Вы в списке · ${esc(t.myReg.team)}</div><button class="btn btn-ghost" data-a="tourLeave" data-id="${t.id}">Отменить участие</button>`
        : canReg ? `<form id="regForm" novalidate>
          <h3 class="group-t" style="margin-top:0">Регистрация</h3>
          <label class="field"><span>${solo ? 'Никнейм' : 'Название команды'}</span><input name="team" placeholder="${solo ? 'Ваш ник в игре' : 'Например, Batumi Five'}" required></label>
          ${solo ? '' : `<label class="field"><span>Капитан</span><input name="captain" placeholder="Ник капитана" value="${esc(u?.username ? '@' + u.username : '')}"></label>
          <label class="field"><span>Состав <span class="dim" style="font-weight:500">— можно позже</span></span><input name="players" placeholder="Ники через запятую"></label>`}
          <label class="field"><span>Связь</span><input name="contact" placeholder="@username или телефон" value="${esc(v.profile?.phone || (u?.username ? '@' + u.username : ''))}" required></label>
          <button class="btn" type="submit" data-a="tourReg" data-id="${t.id}">Зарегистрироваться${t.entry ? ` · ₾${t.entry}` : ''}</button>
        </form>` : `<button class="btn btn-ghost" disabled>${t.open ? 'Мест нет' : 'Регистрация закрыта'}</button>`}`,
  });
  if (el.dataset.reg) setTimeout(() => s.body.querySelector('[name=team]')?.focus({ preventScroll: true }), 450);
};
H.tourReg = async (el, e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData($('#regForm')));
  await busy(el, async () => {
    try {
      await store.act('registerTournament', { id: el.dataset.id, team: d.team, captain: d.captain, contact: d.contact, players: (d.players || '').split(',') });
      haptic.ok(); closeAllSheets(); render(); toast('Вы в списке участников!', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  });
};
H.tourLeave = async el => {
  if (!(await confirmSheet({ title: 'Отменить участие?', text: 'Место освободится для другой команды.', ok: 'Отменить участие', danger: true }))) return;
  try { await store.act('leaveTournament', { id: el.dataset.id }); closeAllSheets(); render(); toast('Участие отменено'); } catch (err) { toast(err.message, 'err'); }
};

// ---------- АКЦИИ ----------
function promos(v) {
  const z = C.zoneById(S.promoZone);
  return `<h1 class="h1">Акции</h1>
    <p class="sub">Пакеты по времени выгоднее почасовой оплаты. Все цены — за одно место.</p>
    <div class="card sub-card">
      <span class="ic-wrap">${icon('bell', 22)}</span>
      <span><b style="display:block;font-size:15px">Сообщать об акциях</b><span class="dim" style="font-size:13px">Новые скидки и турниры — сообщением в Telegram</span></span>
      <button class="switch ${v.subscribed ? 'on' : ''}" role="switch" aria-checked="${v.subscribed}" data-a="sub" aria-label="Уведомления об акциях"></button>
    </div>

    ${v.promos.length ? `<section class="sec" style="margin-top:28px">
      <h2 class="h2" style="margin-bottom:14px">Сейчас действуют</h2>
      ${v.promos.map(p => `<article class="card promo"><h3 class="h3">${esc(p.title)}</h3>${p.badge ? `<span class="badge-lg">${esc(p.badge)}</span>` : '<span></span>'}<p>${esc(p.text)}</p></article>`).join('')}
    </section>` : ''}

    <section class="sec"${v.promos.length ? '' : ' style="margin-top:28px"'}>
      <h2 class="h2" style="margin-bottom:14px">Пакетные цены</h2>
      <div class="seg" role="tablist" data-keep="pz">${C.HZ_ROWS.map(([id, label]) => `<button role="tab" class="${S.promoZone === id ? 'on' : ''}" data-a="pz" data-zone="${id}" aria-selected="${S.promoZone === id}">${label.replace('Duo 500Hz', 'Duo').replace('Hz', '')}</button>`).join('')}</div>
      <div class="card" style="margin-top:12px;padding:14px 18px 6px">
        <table class="ptable">
          <thead><tr><th>Пакет</th><th>Пн–Чт</th><th>Пт–Вс</th></tr></thead>
          <tbody>${PACKAGES.map(pk => {
            const [a, b] = pk.prices[z.id];
            const save = z.price[0] * pk.hours - a;
            return `<tr><td><span class="pn">${{ p3: '3 часа', p5: '5 часов', morning: 'Утро', night: 'Ночь' }[pk.id]}</span><span class="pw">${pk.window.replace(' – ', '–')}</span></td>
              <td><span class="pv">₾${a}</span>${save > 0 ? `<span class="ps">вместо <s>₾${z.price[0] * pk.hours}</s></span>` : ''}</td><td class="pv2">₾${b}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <p class="dim" style="font-size:13px;margin:12px 2px 16px">«Вместо» — сколько стоили бы те же часы по обычному тарифу ${z.name}: ₾${z.price[0]} / ₾${z.price[1]} в час. Пакет применяется сам, если время брони подходит.</p>
      <button class="btn" data-a="go" data-tab="book">Забронировать</button>
    </section>
    ${footer()}`;
}
H.pz = el => { S.promoZone = el.dataset.zone; haptic.tap(); render(); };
H.sub = async el => {
  const on = !store.view.subscribed;
  el.classList.toggle('on', on);
  if (on) await requestWrite();
  try { await store.act('subscribe', { on }); haptic.ok(); toast(on ? 'Подписка включена: новые акции придут в Telegram' : 'Уведомления об акциях выключены', on ? 'ok' : 'info'); render(); }
  catch (err) { el.classList.toggle('on', !on); toast(err.message, 'err'); }
};

// ---------- ПРОФИЛЬ ----------
function me(v) {
  const u = tgUser();
  const name = u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : (LS.get('nebula:name') || 'Гость');
  const now = v.now;
  const up = v.myBookings.filter(b => b.start + b.hours * 3600e3 > now && ['new', 'confirmed', 'arrived'].includes(b.status)).sort((a, b) => a.start - b.start);
  const past = v.myBookings.filter(b => !up.includes(b)).slice(0, 6);
  const myT = v.tournaments.filter(t => t.myReg);
  const p = v.profile;
  return `<div class="me">
      <button class="ava-btn" data-a="avaSheet" aria-label="Изменить фото">${avatarHTML(v, 64)}<span class="ava-cam">${icon('edit', 13)}</span></button>
      <div style="min-width:0"><h1>${esc(p?.name || name)}</h1><p>${p?.phone ? esc(p.phone) : (u?.username ? '@' + esc(u.username) : 'Гость NEBULA')}</p></div>
    </div>
    ${p?.bonusHours ? `<div class="bonus-card">${icon('trophy', 22)}<div><b>${p.bonusHours} ${C.plural(p.bonusHours, 'бонусный час', 'бонусных часа', 'бонусных часов')}</b><span>Спишем при следующей брони — отметьте в подтверждении</span></div></div>` : ''}
    <section class="sec" style="margin-top:24px">
      <div class="sec-head"><h2 class="h2">Мои брони</h2></div>
      ${up.length ? up.map(b => bookingCard(b)).join('') : `<div class="card empty"><b>Пока без броней</b>Выберите свободный ПК — это займёт минуту.<div style="margin-top:16px"><button class="btn btn-sm" data-a="go" data-tab="book" style="width:auto">Забронировать</button></div></div>`}
      ${past.length ? `<h3 class="group-t">История</h3><div class="rows">${past.map(b => `<div class="rowi"><span class="grow"><span class="t">${b.seats.length > 1 ? 'Места' : 'Место'} ${b.seats.join(', ')}</span><span class="s">${fmtDay(b.start)}, ${fmtTime(b.start)} · ${b.hours} ч</span></span><span class="pill ${b.status}">${STATUS[b.status]}</span></div>`).join('')}</div>` : ''}
    </section>
    ${myT.length ? `<section class="sec"><div class="sec-head"><h2 class="h2">Мои турниры</h2></div><div class="rows">${myT.map(t => `<button class="rowi" data-a="tourOpen" data-id="${t.id}"><span class="grow"><span class="t">${esc(t.title)}</span><span class="s">${t.myReg.winner ? `🏆 ${t.myReg.winner.place} место${t.myReg.winner.hours ? ` · +${t.myReg.winner.hours} ч` : ''} · ` : ''}${esc(t.myReg.team)} · ${fmtDay(t.start)}, ${fmtTime(t.start)}</span></span>${icon('chevron', 18)}</button>`).join('')}</div></section>` : ''}
    <section class="sec">
      <div class="rows">
        <div class="rowi"><span class="ic-wrap">${icon('bell', 20)}</span><span class="grow"><span class="t">Уведомления об акциях</span><span class="s">Скидки и анонсы турниров</span></span><button class="switch ${v.subscribed ? 'on' : ''}" role="switch" aria-checked="${v.subscribed}" data-a="sub" aria-label="Уведомления"></button></div>
        <button class="rowi" data-a="open" data-url="${CLUB.map}"><span class="ic-wrap">${icon('pin', 20)}</span><span class="grow"><span class="t">Как добраться</span><span class="s">${CLUB.city}</span></span>${icon('chevron', 18)}</button>
        <a class="rowi" href="tel:${CLUB.phoneRaw}"><span class="ic-wrap">${icon('phone', 20)}</span><span class="grow"><span class="t">${CLUB.phone}</span><span class="s">Вопросы и групповые брони</span></span>${icon('chevron', 18)}</a>
        <button class="rowi" data-a="adminLogin"><span class="ic-wrap">${icon('shield', 20)}</span><span class="grow"><span class="t">Для персонала</span><span class="s">Вход в админ-панель</span></span>${icon('chevron', 18)}</button>
      </div>
    </section>
    <section class="sec">
      <h2 class="group-t" style="margin-top:0">Аккаунт</h2>
      <div class="rows">
        <button class="rowi" data-a="editName"><span class="grow"><span class="t">Имя</span><span class="s">${esc(p?.name || '')}</span></span>${icon('edit', 18)}</button>
        <button class="rowi" data-a="avaSheet"><span class="grow"><span class="t">Фото профиля</span><span class="s">${v.avatar ? 'Загружено' : 'Не выбрано'}</span></span>${icon('chevron', 18)}</button>
        <button class="rowi" data-a="editName"><span class="grow"><span class="t">Телефон</span><span class="s">${esc(p?.phone || '—')}</span></span>${icon('edit', 18)}</button>
        <button class="rowi" data-a="privacy"><span class="grow"><span class="t">Политика конфиденциальности</span></span>${icon('chevron', 18)}</button>
        ${!tg ? `<button class="rowi" data-a="logoutUser"><span class="grow"><span class="t">Выйти из аккаунта</span><span class="s">На этом устройстве</span></span>${icon('logout', 18)}</button>` : ''}
        <button class="rowi" data-a="deleteAccount"><span class="grow"><span class="t red">Удалить аккаунт</span><span class="s">Профиль, фото и подписка удалятся</span></span></button>
      </div>
    </section>
    ${footer()}`;
}
export const STATUS = { new: 'Ждёт подтверждения', confirmed: 'Подтверждена', arrived: 'В клубе', done: 'Завершена', cancelled: 'Отменена', noshow: 'Не пришли' };
function bookingCard(b) {
  const z = C.zoneOf(b.seats[0]);
  const pk = b.pkg && PACKAGES.find(p => p.id === b.pkg);
  const p = clubParts(b.start);
  const rel = relDay(b.start);
  return `<article class="bkc">
    <div class="bkc-date"><b>${p.d}</b><span>${rel === 'Сегодня' || rel === 'Завтра' ? rel : C.wdShort(b.start) + ', ' + MON_SHORT[p.m]}</span></div>
    <div class="bkc-main">
      <div class="bkc-r1"><span class="bkc-time">${fmtTime(b.start)} – ${fmtTime(b.start + b.hours * 3600e3)}</span><span class="pill ${b.status}">${STATUS[b.status]}</span></div>
      <div class="bkc-meta">${b.seats.length > 1 ? 'Места' : 'Место'} <b>${b.seats.join(', ')}</b> · ${zoneLabel(z)} ${z.hz}Hz · ${pk ? pkgLabel(pk) : b.hours + ' ' + C.plural(b.hours, 'час', 'часа', 'часов')}</div>
      ${b.promo ? `<div class="bkc-meta">${icon('tag', 13)} ${esc(b.promo)}</div>` : ''}
      <div class="bkc-foot"><span class="bkc-codew"><small>Код на ресепшене</small><span class="bkc-code">${b.code}</span></span><span class="bkc-price">${money(b.price)}</span>
      ${['new', 'confirmed'].includes(b.status) ? `<button class="btn btn-ghost btn-xs" data-a="cancelBk" data-id="${b.id}">Отменить</button>` : ''}</div>
    </div>
  </article>`;
}
H.editName = () => {
  const s = sheet({
    title: 'Ваши данные',
    body: `<form id="nameForm" novalidate><label class="field"><span>Имя</span><input name="name" maxlength="60" value="${esc(store.view.profile?.name || '')}"></label><label class="field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" maxlength="24" value="${esc(store.view.profile?.phone || '')}"></label><button class="btn" type="submit" data-a="saveName">Сохранить</button></form>`,
  });
  setTimeout(() => s.body.querySelector('input')?.focus(), 400);
};
H.saveName = async (el, e) => {
  e?.preventDefault();
  await busy(el, async () => {
    try { await store.act('updateProfile', { name: $('#nameForm [name=name]').value, phone: $('#nameForm [name=phone]').value }); closeAllSheets(); toast('Сохранено', 'ok'); } catch (err) { toast(err.message, 'err'); }
  });
};
H.logoutUser = async () => {
  if (!(await confirmSheet({ title: 'Выйти из аккаунта?', text: 'Чтобы снова бронировать, нужно будет ввести имя и телефон.', ok: 'Выйти' }))) return;
  store.logoutUser();
};
H.deleteAccount = async () => {
  if (!(await confirmSheet({ title: 'Удалить аккаунт?', text: 'Удалятся профиль, фото, подписка и регистрации на турниры. Активные брони отменятся. Это нельзя отменить.', ok: 'Удалить навсегда', danger: true }))) return;
  try { await store.act('deleteAccount'); toast('Аккаунт удалён'); } catch (err) { toast(err.message, 'err'); }
};
H.cancelBk = async el => {
  if (!(await confirmSheet({ title: 'Отменить бронь?', text: 'Место станет доступно другим гостям.', ok: 'Отменить бронь', danger: true }))) return;
  try { await store.act('cancelBooking', { id: el.dataset.id }); haptic.warn(); render(); toast('Бронь отменена'); } catch (err) { toast(err.message, 'err'); }
};

// ---------- вход в админку ----------
let taps = 0, tapTimer;
H.logoTap = () => { taps++; clearTimeout(tapTimer); tapTimer = setTimeout(() => (taps = 0), 1200); if (taps >= 5) { taps = 0; H.adminLogin(); } };
H.adminLogin = () => {
  if (store.isAdmin) return enterAdmin();
  const s = sheet({
    title: 'Вход для персонала',
    body: `<form id="pinForm" novalidate>
      <label class="field"><span>PIN-код</span><input name="pin" type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="••••" style="font-family:var(--f-mono);letter-spacing:.3em;font-size:20px"></label>
      ${store.mode === 'local' ? '<p class="dim" style="font-size:13px;margin:-4px 0 16px">Демо-версия: PIN 2828</p>' : ''}
      <button class="btn" type="submit" data-a="pinSubmit">Войти</button></form>`,
  });
  setTimeout(() => s.body.querySelector('input')?.focus(), 400);
};
H.pinSubmit = async (el, e) => {
  e.preventDefault();
  const pin = $('#pinForm [name=pin]').value.trim();
  await busy(el, async () => {
    if (await store.login(pin)) { haptic.ok(); closeAllSheets(); enterAdmin(); }
    else toast('Неверный PIN', 'err');
  });
};
function enterAdmin() { S.admin = true; S.adminTab = 'hall'; render(); }
H.adminExit = () => { S.admin = false; S.tab = 'me'; closeAllSheets(); render(); };
H.aTab = el => { S.adminTab = el.dataset.tab; haptic.tap(); closeAllSheets(); render(); };

// ---------- запуск ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = H[el.dataset.a] || adminApi?.handlers[el.dataset.a];
  if (fn) fn(el, e);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit][data-a]');
  if (btn) btn.click();
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-a]')) { e.preventDefault(); e.target.click(); }
});

async function boot() {
  initTelegram();
  shell();
  adminApi = initAdmin({ S, render, liveState, STATUS, zoneLabel });
  obApi = initOnboarding({ S, render, H, fsBtn });
  store.on(() => render());
  initFullscreen();
  await store.init();
  const start = tg?.initDataUnsafe?.start_param || location.hash.slice(1) || (location.pathname.startsWith('/admin') ? 'admin' : '');
  if (start === 'book') S.tab = 'book';
  if (start === 'tours') S.tab = 'tours';
  if (start === 'promos') S.tab = 'promos';
  if (start === 'admin') { if (store.isAdmin) S.admin = true; else setTimeout(H.adminLogin, 300); }
  render();
  document.documentElement.classList.add('ready');
  setInterval(() => { if (!document.hidden) store.refresh(); }, store.mode === 'remote' ? 15000 : 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) store.refresh(); });
}
boot();
