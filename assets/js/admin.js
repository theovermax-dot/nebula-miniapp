// Админ-панель: зал в реальном времени, брони, турниры, акции и рассылка.
import * as C from './core.js?v=1793300130';
import { store } from './store.js?v=1793300130';
import { haptic } from './tg.js?v=1793300130';
import { esc, $, icon, toast, sheet, confirmSheet, busy, money, closeAllSheets } from './ui.js?v=1793300130';

const { ZONES, ALL_SEATS, PACKAGES, fmtTime, fmtDay, relDay, pad, clubParts, dayStart } = C;

const toLocalInput = t => { const p = clubParts(t); return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`; };
const fromLocalInput = s => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || ''); return m ? C.clubEpoch(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : 0; };
const endOf = b => b.start + b.hours * 3600e3;
const telHref = p => 'tel:' + String(p).replace(/[^\d+]/g, '');

export function initAdmin({ S, render, liveState, STATUS, zoneLabel }) {
  const A = { filter: 'pending' };
  const H = {};

  // ---------- ЗАЛ ----------
  function hall(v) {
    const now = v.now;
    const free = ALL_SEATS.filter(s => v.live[s].status === 'free').length;
    const today = v.bookings.filter(b => dayStart(b.start) === dayStart(now) && !['cancelled'].includes(b.status));
    const pending = v.bookings.filter(b => b.status === 'new' && endOf(b) > now);
    const nextToday = today.filter(b => endOf(b) > now && ['new', 'confirmed'].includes(b.status)).sort((a, b) => a.start - b.start).slice(0, 6);
    const repair = ALL_SEATS.filter(s => v.live[s].status === 'repair');
    return `<h1 class="h1">Зал</h1>
      <p class="sub">${C.fmtDayLong(now)} · <span class="mono">${fmtTime(now)}</span></p>
      <div class="kpis">
        <div><span>Свободно сейчас</span><b class="green">${free}<small>из 22</small></b></div>
        <div><span>Брони сегодня</span><b>${today.length}</b><em class="kpi-sub">на ${money(today.reduce((a, b) => a + b.price, 0))}</em></div>
        <div><span>Ждут подтверждения</span><b class="${pending.length ? 'amber' : ''}">${pending.length}</b></div>
        <div><span>Подписчики акций</span><b>${v.subCount}</b></div>
      </div>
      ${pending.length ? `<div class="finding"><span class="grow"><b>${pending.length} ${C.plural(pending.length, 'бронь ждёт', 'брони ждут', 'броней ждут')}</b> подтверждения — ближайшая ${relDay(pending.sort((a, b) => a.start - b.start)[0].start).toLowerCase()} в ${fmtTime(pending[0].start)}</span><button class="btn btn-xs" data-a="aGoPending">Открыть</button></div>` : ''}
      <div class="adm-grid" style="margin-top:20px">
        <div>
          ${ZONES.map(z => `<section class="zone"><div class="zone-h"><b>${z.name}</b><span class="hz">${z.hz}Hz</span><span class="pr">${z.seats.filter(s => v.live[s].status === 'free').length} свободно</span></div>
            <div class="seats">${z.seats.map(s => { const st = liveState(v, s); return `<button class="seat ${st.cls} pick" data-a="aSeat" data-seat="${s}" aria-label="Место ${s}"><span class="n">${s}</span><span class="st">${st.text}</span>${st.later ? `<span class="later">${st.later}</span>` : ''}</button>`; }).join('')}</div></section>`).join('')}
          <p class="dim" style="font-size:13px;margin:12px 2px 0">Нажмите на место, чтобы отметить гостя, продлить сессию или поставить ПК на ремонт.</p>
        </div>
        <div>
          <section class="sec" style="margin-top:28px">
            <div class="sec-head"><h2 class="h2">Дальше сегодня</h2><button class="link-btn" data-a="aTab" data-tab="bookings">Все брони${icon('chevron', 16)}</button></div>
            ${nextToday.length ? `<div class="ab-list">${nextToday.map(b => bookingRow(b, v, true)).join('')}</div>` : `<div class="card empty"><b>Сегодня больше броней нет</b>Новые появятся здесь сразу после оформления.</div>`}
          </section>
          ${repair.length ? `<section class="sec"><h2 class="h2" style="margin-bottom:12px">На ремонте</h2><div class="rows">${repair.map(s => `<button class="rowi" data-a="aSeat" data-seat="${s}"><span class="ic-wrap" style="color:var(--red)">${icon('wrench', 20)}</span><span class="grow"><span class="t">Место ${s} · ${zoneLabel(C.zoneOf(s))}</span><span class="s">${esc(v.seatsRaw?.[s]?.note || 'Без комментария')}</span></span>${icon('chevron', 18)}</button>`).join('')}</div></section>` : ''}
          <section class="sec">
            <div class="rows">
              <div class="rowi"><span class="grow"><span class="t">Демо-симуляция гостей</span><span class="s">Зал сам «заполняется», пока нет реальной интеграции с кассой</span></span><button class="switch ${v.demo ? 'on' : ''}" role="switch" aria-checked="${v.demo}" data-a="aDemo" aria-label="Демо-симуляция"></button></div>
              ${`<button class="rowi" data-a="aReset"><span class="grow"><span class="t">Сбросить демо-данные</span><span class="s">Вернуть исходные брони, турниры и акции</span></span>${icon('refresh', 18)}</button>`}
            </div>
            ${store.mode === 'local' ? `<div class="demo-note">Демо-режим: данные хранятся в этом браузере. После подключения бесплатной базы на Vercel брони, турниры и рассылка станут общими для всех гостей и персонала, а уведомления начнут приходить в Telegram.</div>` : ''}
          </section>
        </div>
      </div>`;
  }
  H.aGoPending = () => { A.filter = 'pending'; S.adminTab = 'bookings'; render(); };
  H.aDemo = async () => { try { await store.act('setDemo', { on: !store.view.demo }); haptic.tap(); } catch (e) { toast(e.message, 'err'); } };
  H.aReset = async () => {
    if (!(await confirmSheet({ title: 'Сбросить демо-данные?', text: 'Брони, турниры и акции вернутся к исходным примерам. Профили гостей сохранятся.', ok: 'Сбросить', danger: true }))) return;
    try { if (store.mode === 'local') store.resetDemo(); else await store.act('resetDemo'); toast('Демо-данные восстановлены', 'ok'); } catch (e) { toast(e.message, 'err'); }
  };

  H.aSeat = el => {
    const v = store.view; const seat = Number(el.dataset.seat);
    const z = C.zoneOf(seat); const live = v.live[seat];
    let status = live.status === 'repair' ? 'repair' : live.status === 'busy' ? 'busy' : 'free';
    let until = live.until || (v.now + 2 * 3600e3);
    const upcoming = v.bookings.filter(b => b.seats.includes(seat) && endOf(b) > v.now && ['new', 'confirmed', 'arrived'].includes(b.status)).sort((a, b) => a.start - b.start);
    const s = sheet({ title: `Место ${seat} · ${zoneLabel(z)} ${z.hz}Hz`, body: '' });
    const draw = () => {
      s.body.innerHTML = `
        <div class="status-seg" role="radiogroup" aria-label="Статус">
          ${[['free', 'Свободен', 'var(--green)'], ['busy', 'Занят', 'var(--grey)'], ['repair', 'Ремонт', 'var(--red)']].map(([k, l, c]) => `<button class="${status === k ? 'on' : ''}" data-st="${k}" role="radio" aria-checked="${status === k}"><i style="background:${c}"></i>${l}</button>`).join('')}
        </div>
        ${status === 'busy' ? `<div class="field"><span>Играет до</span>
          <div class="hscroll" style="margin-bottom:10px">${[1, 2, 3, 5].map(h => `<button class="chip" data-add="${h}">+${h} ч</button>`).join('')}<button class="chip" data-add="night">до 09:00</button></div>
          <input type="datetime-local" name="until" value="${toLocalInput(until)}"></div>` : ''}
        ${status === 'repair' ? `<label class="field"><span>Что случилось</span><input name="note" value="${esc(v.seatsRaw?.[seat]?.note || '')}" placeholder="Например: не работает мышь"></label>` : ''}
        <button class="btn" data-save>Сохранить</button>
        <h3 class="group-t">Брони этого места</h3>
        ${upcoming.length ? `<div class="rows">${upcoming.map(b => `<div class="rowi"><span class="grow"><span class="t">${relDay(b.start)}, ${fmtTime(b.start)}–${fmtTime(endOf(b))}</span><span class="s">${esc(b.name)} · ${b.code}</span></span><span class="pill ${b.status}">${STATUS[b.status]}</span></div>`).join('')}</div>` : '<p class="dim" style="font-size:14px;margin:0">Впереди броней нет.</p>'}`;
    };
    draw();
    s.body.addEventListener('click', async e => {
      const st = e.target.closest('[data-st]'); if (st) { status = st.dataset.st; haptic.tap(); draw(); return; }
      const add = e.target.closest('[data-add]');
      if (add) {
        if (add.dataset.add === 'night') { const p = clubParts(Date.now()); until = C.clubEpoch(p.y, p.m, p.d + (p.h >= 9 ? 1 : 0), 9); }
        else until = Math.max(Date.now(), live.until || Date.now()) + Number(add.dataset.add) * 3600e3;
        haptic.tap(); draw(); return;
      }
      const save = e.target.closest('[data-save]');
      if (save) {
        const inp = s.body.querySelector('[name=until]'); if (inp) until = fromLocalInput(inp.value);
        await busy(save, async () => {
          try { await store.act('setSeat', { seat, status, until, note: s.body.querySelector('[name=note]')?.value }); haptic.ok(); s.close(); toast(`Место ${seat} обновлено`, 'ok'); }
          catch (err) { toast(err.message, 'err'); }
        });
      }
    });
  };

  // ---------- БРОНИ ----------
  const HUES = ['#22a7ff', '#2bd46a', '#f5a524', '#a26bff', '#ff6b8a', '#3dd6c6'];
  const hueOf = s => HUES[[...String(s)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % HUES.length];
  function bookingRow(b, v, compact = false) {
    const z = C.zoneOf(b.seats[0]);
    const pk = b.pkg && PACKAGES.find(p => p.id === b.pkg);
    const started = b.start <= v.now + 30 * 60e3;
    const acts = [];
    if (b.status === 'new') acts.push(`<button class="btn btn-xs" data-a="aBk" data-id="${b.id}" data-st="confirmed">Подтвердить</button>`, `<button class="btn btn-ghost btn-xs" data-a="aBk" data-id="${b.id}" data-st="cancelled">Отклонить</button>`);
    if (b.status === 'confirmed' && started && endOf(b) > v.now) acts.push(`<button class="btn btn-xs" data-a="aBk" data-id="${b.id}" data-st="arrived">Пришёл</button>`, `<button class="btn btn-ghost btn-xs" data-a="aBk" data-id="${b.id}" data-st="noshow">Не пришёл</button>`);
    if (b.status === 'confirmed' && !started) acts.push(`<button class="btn btn-ghost btn-xs" data-a="aBk" data-id="${b.id}" data-st="cancelled">Отменить</button>`);
    if (b.status === 'arrived') acts.push(`<button class="btn btn-ghost btn-xs" data-a="aBk" data-id="${b.id}" data-st="done">Завершить</button>`);
    const initials = esc(String(b.name).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
    return `<article class="ab ab-${b.status}">
      <header class="ab-h">
        <span class="ab-ava" style="--h:${hueOf(b.name)}">${initials}</span>
        <div class="ab-who"><b>${esc(b.name)}</b><a href="${telHref(b.phone)}">${esc(C.normPhone(b.phone) || b.phone)}</a></div>
        <span class="pill ${b.status}">${STATUS[b.status]}</span>
      </header>
      <div class="ab-facts">
        <div><span>Когда</span><b>${fmtTime(b.start)}–${fmtTime(endOf(b))}</b><em>${relDay(b.start)}</em></div>
        <div><span>${b.seats.length > 1 ? 'Места' : 'Место'}</span><b>${b.seats.join(', ')}</b><em>${zoneLabel(z)} ${z.hz}Hz</em></div>
        <div><span>Сумма</span><b>${money(b.price)}</b><em>${pk ? pkgLabel(pk) : b.hours + ' ч по часам'}</em></div>
        <div><span>Код брони</span><b class="mono">${b.code}</b><em>${relDay(b.createdAt) === 'Сегодня' ? 'создана в ' + fmtTime(b.createdAt) : 'создана ' + fmtDay(b.createdAt)}</em></div>
      </div>
      ${b.bonusUsed ? `<div class="ab-note ab-promo">${icon('trophy', 15)}<span><b>Бонус:</b> списано ${b.bonusUsed} ч (−${money(b.bonusOff)})</span></div>` : ''}
      ${b.promo ? `<div class="ab-note ab-promo">${icon('tag', 15)}<span><b>Акция:</b> ${esc(b.promo)}</span></div>` : ''}
      ${b.comment ? `<div class="ab-note">${icon('edit', 15)}<span><b>Комментарий:</b> ${esc(b.comment)}</span></div>` : ''}
      <footer class="ab-f">
        <div class="ab-acts">${acts.join('')}</div>
        <div class="ab-contact">
          <a class="icon-btn" href="${telHref(b.phone)}" aria-label="Позвонить ${esc(b.name)}" title="Позвонить">${icon('phone', 18)}</a>
          ${b.tgUser ? `<a class="icon-btn" data-a="open" data-url="https://t.me/${esc(b.tgUser)}" href="https://t.me/${esc(b.tgUser)}" aria-label="Написать в Telegram" title="@${esc(b.tgUser)}">${icon('send', 18)}</a>` : ''}
        </div>
      </footer>
    </article>`;
  }
  const pkgLabel = pk => `пакет «${{ p3: '3 часа', p5: '5 часов', morning: 'Утро', night: 'Ночь' }[pk.id]}»`;
  function bookings(v) {
    const now = v.now;
    const F = {
      pending: b => b.status === 'new' && endOf(b) > now,
      today: b => dayStart(b.start) === dayStart(now) && b.status !== 'cancelled',
      upcoming: b => endOf(b) > now && ['new', 'confirmed', 'arrived'].includes(b.status),
      archive: b => endOf(b) <= now || ['cancelled', 'done', 'noshow'].includes(b.status),
    };
    const counts = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, v.bookings.filter(f).length]));
    let list = v.bookings.filter(F[A.filter]);
    if (A.filter === 'archive') list = list.sort((a, b) => b.start - a.start).slice(0, 40);
    const groups = {};
    list.forEach(b => { const k = relDay(b.start); (groups[k] = groups[k] || []).push(b); });
    const revenue = v.bookings.filter(F.upcoming).reduce((a, b) => a + b.price, 0);
    return `<h1 class="h1">Брони</h1>
      <p class="sub">Впереди ${counts.upcoming} ${C.plural(counts.upcoming, 'бронь', 'брони', 'броней')} на ${money(revenue)}</p>
      <label class="ab-search">${icon('search', 18)}<input id="abSearch" type="search" autocomplete="off" placeholder="Код брони, имя или телефон" inputmode="search" value="${esc(A.q || '')}" aria-label="Поиск брони"></label>
      <div id="abFound">${A.q ? searchResults(v) : ''}</div>
      <div id="abMain" ${A.q ? 'hidden' : ''}>
      <div class="seg" role="tablist" data-keep="bf">
        ${[['pending', 'Ждут'], ['today', 'Сегодня'], ['upcoming', 'Впереди'], ['archive', 'Архив']].map(([k, l]) => `<button class="${A.filter === k ? 'on' : ''}" data-a="aFilter" data-f="${k}" role="tab" aria-selected="${A.filter === k}">${l}${k !== 'archive' ? ` <span class="dim">${counts[k]}</span>` : ''}</button>`).join('')}
      </div>
      ${list.length ? Object.entries(groups).map(([day, arr]) => `<h3 class="group-t">${day}</h3><div class="ab-list">${arr.map(b => bookingRow(b, v, true)).join('')}</div>`).join('')
        : `<div class="card empty" style="margin-top:16px"><b>${A.filter === 'pending' ? 'Все брони подтверждены' : 'Здесь пусто'}</b>${A.filter === 'pending' ? 'Новые заявки появятся здесь и придут уведомлением в Telegram.' : ''}</div>`}
      </div>`;
  }
  // поиск: код (NB-WDVE, wdve), имя или цифры телефона
  function searchResults(v) {
    const q = (A.q || '').trim().toLowerCase(), qc = q.replace(/^nb-?/, ''), qd = q.replace(/\D/g, '');
    const found = v.bookings.filter(b => b.code.toLowerCase().replace('nb-', '').includes(qc) || b.name.toLowerCase().includes(q) || (qd.length >= 3 && b.phone.replace(/\D/g, '').includes(qd)))
      .sort((a, b) => (b.code === qc) - (a.code === qc) || Math.abs(a.start - v.now) - Math.abs(b.start - v.now)).slice(0, 20);
    return found.length ? `<div class="ab-list" style="margin-top:14px">${found.map(b => bookingRow(b, v, true)).join('')}</div>` : `<div class="card empty" style="margin-top:14px"><b>Ничего не нашли</b>Код брони — 4 цифры, например 4827</div>`;
  }
  document.addEventListener('input', e => {
    if (e.target.id !== 'abSearch') return;
    A.q = e.target.value;
    const f = document.getElementById('abFound'), m = document.getElementById('abMain');
    if (f) f.innerHTML = A.q.trim() ? searchResults(store.view) : '';
    if (m) m.hidden = !!A.q.trim();
  });
  H.aFilter = el => { A.filter = el.dataset.f; haptic.tap(); render(); };
  H.aBk = async el => {
    const st = el.dataset.st;
    if (st === 'cancelled' && !(await confirmSheet({ title: 'Отменить бронь?', text: 'Гость получит уведомление, место освободится.', ok: 'Отменить', danger: true }))) return;
    await busy(el, async () => {
      try { await store.act('setBookingStatus', { id: el.dataset.id, status: st }); haptic.ok(); toast({ confirmed: 'Бронь подтверждена', cancelled: 'Бронь отменена', arrived: 'Гость в клубе', noshow: 'Отмечено: не пришёл', done: 'Сессия завершена' }[st], 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    });
  };

  // ---------- ТУРНИРЫ ----------
  function tours(v) {
    const list = [...v.tournamentsFull].sort((a, b) => a.start - b.start);
    return `<div class="sec-head" style="margin:14px 0 6px;align-items:center"><h1 class="h1" style="margin:0">Турниры</h1><button class="btn btn-sm" data-a="aTourEdit">${icon('plus', 16)}Новый</button></div>
      <p class="sub">Регистрации приходят сюда и в Telegram-чат персонала.</p>
      ${list.length ? list.map(t => `<article class="card tour hue-${t.hue}" style="margin-bottom:12px"><div class="tour-band"></div><div class="tour-in">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span class="game"><i></i>${esc(t.game)} · ${esc(t.format)}</span><button class="switch ${t.open ? 'on' : ''}" role="switch" aria-checked="${t.open}" aria-label="Регистрация открыта" data-a="aTourToggle" data-id="${t.id}"></button></div>
        <h3 style="margin-bottom:6px">${esc(t.title)}</h3>
        <p class="dim" style="margin:0 0 14px;font-size:13.5px">${fmtDay(t.start)}, ${fmtTime(t.start)} · ₾${t.prize} призовой · ${t.entry ? `₾${t.entry} ${t.entryUnit}` : 'без взноса'} · регистрация ${t.open ? 'открыта' : 'закрыта'}</p>
        <div class="slots"><div class="bar"><i style="width:${Math.min(100, t.regs.length / t.slots * 100)}%"></i></div><span><b style="color:var(--ink)">${t.regs.length}</b> из ${t.slots} ${t.teamSize > 1 ? C.plural(t.slots, 'команды', 'команд', 'команд') : C.plural(t.slots, 'игрока', 'игроков', 'игроков')}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-xs" data-a="aTourRegs" data-id="${t.id}">${icon('users', 15)}${t.teamSize > 1 ? 'Команды' : 'Игроки'}</button><button class="btn btn-ghost btn-xs" data-a="aTourEdit" data-id="${t.id}">${icon('edit', 15)}Изменить</button><button class="btn btn-ghost btn-xs" data-a="aTourDel" data-id="${t.id}" aria-label="Удалить">${icon('trash', 15)}</button></div>
      </div></article>`).join('') : `<div class="card empty"><b>Турниров пока нет</b>Создайте первый — гости увидят его во вкладке «Турниры».</div>`}`;
  }
  H.aTourToggle = async el => { try { await store.act('toggleTournament', { id: el.dataset.id }); haptic.tap(); } catch (e) { toast(e.message, 'err'); } };
  H.aTourDel = async el => {
    if (!(await confirmSheet({ title: 'Удалить турнир?', text: 'Турнир и все регистрации исчезнут без возможности восстановления.', ok: 'Удалить', danger: true }))) return;
    try { await store.act('deleteTournament', { id: el.dataset.id }); toast('Турнир удалён'); } catch (e) { toast(e.message, 'err'); }
  };
  const unitWord = t => t.teamSize > 1 ? { one: 'команда', many: 'Команды', add: 'Добавить команду', name: 'Название команды', empty: 'Пока нет ни одной команды', rm: 'Убрать команду?' } : { one: 'игрок', many: 'Игроки', add: 'Добавить игрока', name: 'Никнейм', empty: 'Пока нет ни одного игрока', rm: 'Убрать игрока?' };
  H.aTourRegs = el => {
    const id = el.dataset.id;
    const t = () => store.view.tournamentsFull.find(x => x.id === id);
    if (!t()) return;
    const s = sheet({ title: '', body: '', full: true });
    const draw = () => {
      const T = t(), W = unitWord(T), full = T.regs.length >= T.slots;
      s.body.innerHTML = `
        <div class="regs-head">
          <div><h2>${esc(T.title)}</h2><span>${W.many}: <b>${T.regs.length}</b> из ${T.slots} · ${esc(T.format)}</span></div>
          <button class="icon-btn" data-close aria-label="Закрыть">${icon('close', 20)}</button>
        </div>
        ${T.prizeHours || T.prize || T.prizeComment ? `<div class="prize-sum">${icon('trophy', 16)}<span>${[T.prize ? '₾' + T.prize : '', T.prizeHours ? `+${T.prizeHours} ч на аккаунт` : '', T.prizeComment].filter(Boolean).map(esc).join(' · ')}</span></div>` : ''}
        <button class="btn btn-ghost" data-add ${full ? 'disabled' : ''} style="margin-bottom:6px">${icon('plus', 17)}${full ? 'Все места заняты' : W.add}</button>
        ${T.regs.length ? T.regs.map((r, i) => `<div class="reg-row"><span class="dim mono" style="width:22px">${i + 1}.</span><span class="grow"><b>${esc(r.team)}</b>${r.winner ? ` <span class="win-tag">${icon('trophy', 12)}${r.winner.place} место${r.winner.hours ? ` · +${r.winner.hours} ч` : ''}</span>` : ''}${r.byAdmin ? ' <span class="adm-tag">добавил админ</span>' : ''}<span class="s">${[T.teamSize > 1 && r.players?.length ? 'Состав: ' + r.players.join(', ') : '', r.captain, r.contact].filter(Boolean).map(esc).join(' · ') || 'без контакта'}</span></span>${r.winner ? '' : `<button class="btn btn-ghost btn-xs" data-win="${r.id}">${icon('trophy', 14)}Наградить</button>`}<button class="icon-btn" data-rm="${r.id}" aria-label="Убрать">${icon('trash', 18)}</button></div>`).join('')
          : `<div class="empty"><b>${W.empty}</b>Добавьте вручную или поделитесь турниром в Instagram и TikTok клуба.</div>`}`;
    };
    draw();
    const off = store.on(() => { if (!s.closed && t()) draw(); });
    const close0 = s.close; s.close = () => { off(); close0(); };
    s.body.addEventListener('click', async e => {
      if (e.target.closest('[data-add]')) return addRegSheet(t());
      const w = e.target.closest('[data-win]');
      if (w) return awardSheet(t(), t().regs.find(r => r.id === w.dataset.win), s);
      const rm = e.target.closest('[data-rm]'); if (!rm) return;
      if (!(await confirmSheet({ title: unitWord(t()).rm, text: 'Место станет свободным.', ok: 'Убрать', danger: true }))) return;
      try { await store.act('removeReg', { id, regId: rm.dataset.rm }); toast('Убрано'); } catch (err) { toast(err.message, 'err'); }
    });
  };
  function addRegSheet(T) {
    const W = unitWord(T), team = T.teamSize > 1;
    const a = sheet({
      title: W.add,
      body: `<form id="arForm" novalidate>
        <label class="field"><span>${W.name}</span><input name="team" maxlength="40" placeholder="${team ? 'Например, Batumi Five' : 'Ник в игре'}"></label>
        ${team ? `<label class="field"><span>Игроки <span class="dim" style="font-weight:500">— до ${T.teamSize}, через запятую</span></span><input name="players" placeholder="Ники игроков"></label>
        <label class="field"><span>Капитан</span><input name="captain" placeholder="Ник или @username"></label>` : ''}
        <label class="field"><span>Контакт <span class="dim" style="font-weight:500">— необязательно</span></span><input name="contact" placeholder="Телефон или @username"></label>
        <button class="btn" type="submit" data-a="aAddReg" data-id="${T.id}">${icon('plus', 17)}${W.add}</button>
      </form>`,
    });
    setTimeout(() => a.body.querySelector('[name=team]')?.focus(), 400);
  }
  H.aAddReg = async (el, e) => {
    e?.preventDefault();
    const f = Object.fromEntries(new FormData($('#arForm')));
    await busy(el, async () => {
      try {
        await store.act('adminAddReg', { id: el.dataset.id, team: f.team, captain: f.captain, contact: f.contact, players: (f.players || '').split(',') });
        haptic.ok(); $('#arForm').closest('.sheet-root').querySelector('[data-close]')?.click(); toast('Добавлено', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    });
  };
  function awardSheet(t, r, parent) {
    let place = 1;
    const a = sheet({ title: `Наградить «${r.team}»`, body: '' });
    const draw = () => {
      a.body.innerHTML = `
        <div class="field"><span>Место</span><div class="seg">${[1, 2, 3].map(n => `<button type="button" class="${place === n ? 'on' : ''}" data-place="${n}">${n} место</button>`).join('')}</div></div>
        <label class="field"><span>Начислить часов на аккаунт</span><input name="hours" type="number" inputmode="numeric" min="0" max="100" value="${place === 1 ? (t.prizeHours || 0) : 0}"><small>Часы спишутся при следующей брони гостя. 0 — без часов.</small></label>
        <button class="btn" data-go>${icon('trophy', 17)}Наградить</button>`;
    };
    draw();
    a.body.addEventListener('click', async e => {
      const pl = e.target.closest('[data-place]'); if (pl) { place = Number(pl.dataset.place); draw(); return; }
      const go = e.target.closest('[data-go]'); if (!go) return;
      await busy(go, async () => {
        try {
          const res = await store.act('awardWinner', { id: t.id, regId: r.id, place, hours: a.body.querySelector('[name=hours]').value });
          haptic.ok(); a.close(); parent.close();
          toast(res.credited ? `Готово: ${place} место, часы начислены` : `Готово: ${place} место${Number(a.body.querySelector('[name=hours]')?.value) ? ' — у гостя нет аккаунта, часы не начислены' : ''}`, 'ok');
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }
  const GAMES = ['Counter-Strike 2', 'Valorant', 'Dota 2', 'EA SPORTS FC 26', 'Fortnite', 'League of Legends', 'PUBG'];
  H.aTourEdit = el => {
    const t = el.dataset.id ? store.view.tournamentsFull.find(x => x.id === el.dataset.id) : null;
    const def = t || { game: 'Counter-Strike 2', title: '', format: '5 × 5', teamSize: 5, start: dayStart(Date.now()) + 7 * 864e5 + 18 * 3600e3, entry: 0, prize: 0, prizeNote: '', prizeHours: 0, prizeComment: '', slots: 16, about: '', hue: 'amber' };
    const s = sheet({
      title: t ? 'Изменить турнир' : 'Новый турнир', full: true,
      body: `<form id="tForm" novalidate>
        <label class="field"><span>Игра</span><input name="game" list="games" value="${esc(def.game)}" required><datalist id="games">${GAMES.map(g => `<option value="${g}">`).join('')}</datalist></label>
        <label class="field"><span>Название</span><input name="title" value="${esc(def.title)}" placeholder="Например, Wingman Cup" required></label>
        <div class="grid2">
          <label class="field"><span>Формат</span><input name="format" value="${esc(def.format)}" placeholder="5 × 5"></label>
          <label class="field"><span>Игроков в команде</span><input name="teamSize" type="number" inputmode="numeric" min="1" max="6" value="${def.teamSize}"></label>
        </div>
        <label class="field"><span>Начало</span><input name="start" type="datetime-local" value="${toLocalInput(def.start)}"></label>
        <div class="grid2">
          <label class="field"><span>Взнос, ₾</span><input name="entry" type="number" inputmode="numeric" min="0" value="${def.entry}"></label>
          <label class="field"><span>Мест</span><input name="slots" type="number" inputmode="numeric" min="2" value="${def.slots}"></label>
        </div>
        <fieldset class="prize-box">
          <legend>Призы</legend>
          <div class="grid2">
            <label class="field"><span>Денежный фонд, ₾</span><input name="prize" type="number" inputmode="numeric" min="0" value="${def.prize || 0}"></label>
            <label class="field"><span>Часы на аккаунт</span><input name="prizeHours" type="number" inputmode="numeric" min="0" max="100" value="${def.prizeHours || 0}"></label>
          </div>
          <label class="field"><span>Распределение по местам</span><input name="prizeNote" value="${esc(def.prizeNote || '')}" placeholder="₾400 · ₾150 · ₾50"></label>
          <label class="field" style="margin-bottom:4px"><span>Что ещё получат победители</span><textarea name="prizeComment" rows="2" placeholder="Например: кубок, мерч NEBULA, бесплатная ночь в клубе">${esc(def.prizeComment || '')}</textarea></label>
          <small class="dim" style="display:block;font-size:12.5px">Часы начисляются кнопкой «Наградить» в списке участников — на аккаунт того, кто регистрировал команду. Гость спишет их при следующей брони.</small>
        </fieldset>
        <label class="field"><span>Описание и правила</span><textarea name="about" placeholder="Карты, формат матчей, что взять с собой">${esc(def.about)}</textarea></label>
        <div class="field"><span>Цвет карточки</span><div class="seg" id="hueSeg">${[['amber', 'Янтарь'], ['red', 'Красный'], ['green', 'Зелёный'], ['blue', 'Голубой']].map(([k, l]) => `<button type="button" data-hue="${k}" class="${def.hue === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <button class="btn" type="submit" data-a="aTourSave" data-id="${t?.id || ''}">${t ? 'Сохранить' : 'Опубликовать турнир'}</button>
      </form>`,
    });
    s.body.addEventListener('click', e => { const h = e.target.closest('[data-hue]'); if (h) { s.body.querySelectorAll('[data-hue]').forEach(b => b.classList.toggle('on', b === h)); } });
  };
  H.aTourSave = async (el, e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData($('#tForm')));
    d.start = fromLocalInput(d.start); d.hue = $('#hueSeg .on')?.dataset.hue; d.id = el.dataset.id || undefined;
    await busy(el, async () => {
      try { await store.act('saveTournament', d); haptic.ok(); closeAllSheets(); toast(d.id ? 'Турнир обновлён' : 'Турнир опубликован', 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    });
  };

  // ---------- АКЦИИ ----------
  function promos(v) {
    const real = v.subCount;
    return `<div class="sec-head" style="margin:14px 0 6px;align-items:center"><h1 class="h1" style="margin:0">Акции</h1><button class="btn btn-sm" data-a="aPromoEdit">${icon('plus', 16)}Новая</button></div>
      <p class="sub">Активные акции видят все гости во вкладке «Акции».</p>
      <section class="card">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px"><h2 class="h3">Рассылка подписчикам</h2><span class="dim" style="font-size:13px"><b class="fig" style="color:var(--ink)">${real}</b> ${C.plural(real, 'подписчик', 'подписчика', 'подписчиков')}</span></div>
        <form id="bcForm" novalidate>
          <label class="field" style="margin-bottom:12px"><span class="sr">Текст рассылки</span><textarea name="text" placeholder="Например: в эту пятницу ночной пакет на 500Hz — ₾50 вместо ₾62. Бронь в приложении."></textarea></label>
          <button class="btn" type="submit" data-a="aBroadcast">${icon('send', 17)}Отправить в Telegram</button>
        </form>
        ${v.broadcasts?.length ? `<h3 class="group-t">Последние рассылки</h3>${v.broadcasts.slice(0, 3).map(b => `<div class="reg-row"><span class="grow">${esc(b.text.slice(0, 90))}${b.text.length > 90 ? '…' : ''}<span class="s">${relDay(b.at)}, ${fmtTime(b.at)} · ${store.mode === 'local' ? 'демо, не отправлялась' : `доставлено ${b.sent} из ${b.total}`}</span></span></div>`).join('')}` : ''}
      </section>
      <section class="sec" style="margin-top:24px">
        <h2 class="h2" style="margin-bottom:14px">Все акции</h2>
        ${v.promos.length ? `<div class="rows">${v.promos.map(p => `<div class="rowi">
          <span class="grow"><span class="t">${esc(p.title)}${p.badge ? ` <span class="cyan fig" style="font-size:13px;margin-left:4px">${esc(p.badge)}</span>` : ''}</span><span class="s">${esc(p.text)}</span></span>
          <button class="icon-btn" data-a="aPromoEdit" data-id="${p.id}" aria-label="Изменить">${icon('edit', 18)}</button>
          <button class="switch ${p.active ? 'on' : ''}" role="switch" aria-checked="${p.active}" data-a="aPromoToggle" data-id="${p.id}" aria-label="Показывать акцию"></button>
        </div>`).join('')}</div>` : `<div class="card empty"><b>Акций пока нет</b>Добавьте первую — например, скидку на утренние часы.</div>`}
      </section>`;
  }
  H.aPromoToggle = async el => { try { await store.act('togglePromo', { id: el.dataset.id }); haptic.tap(); } catch (e) { toast(e.message, 'err'); } };
  H.aPromoEdit = el => {
    const p = el.dataset.id ? store.view.promos.find(x => x.id === el.dataset.id) : null;
    sheet({
      title: p ? 'Изменить акцию' : 'Новая акция',
      body: `<form id="pForm" novalidate>
        <label class="field"><span>Заголовок</span><input name="title" value="${esc(p?.title || '')}" placeholder="Например, Студенческие будни" required></label>
        <label class="field"><span>Короткая метка <span class="dim" style="font-weight:500">— до 16 символов</span></span><input name="badge" maxlength="16" value="${esc(p?.badge || '')}" placeholder="−20%"></label>
        <label class="field"><span>Условия</span><textarea name="text" placeholder="Кому, когда и как получить">${esc(p?.text || '')}</textarea></label>
        <button class="btn" type="submit" data-a="aPromoSave" data-id="${p?.id || ''}">${p ? 'Сохранить' : 'Опубликовать'}</button>
        ${p ? `<button type="button" class="btn btn-ghost" style="margin-top:10px" data-a="aPromoDel" data-id="${p.id}">Удалить акцию</button>` : ''}
      </form>`,
    });
  };
  H.aPromoSave = async (el, e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData($('#pForm'))); d.id = el.dataset.id || undefined;
    await busy(el, async () => {
      try { await store.act('savePromo', d); haptic.ok(); closeAllSheets(); toast(d.id ? 'Акция обновлена' : 'Акция опубликована', 'ok'); } catch (err) { toast(err.message, 'err'); }
    });
  };
  H.aPromoDel = async el => {
    if (!(await confirmSheet({ title: 'Удалить акцию?', text: 'Гости перестанут её видеть.', ok: 'Удалить', danger: true }))) return;
    try { await store.act('deletePromo', { id: el.dataset.id }); closeAllSheets(); toast('Акция удалена'); } catch (err) { toast(err.message, 'err'); }
  };
  H.aBroadcast = async (el, e) => {
    e.preventDefault();
    const text = $('#bcForm [name=text]').value.trim();
    if (text.length < 5) return toast('Напишите текст рассылки', 'err');
    const n = store.view.subCount;
    if (!(await confirmSheet({ title: 'Отправить рассылку?', text: `Сообщение получат ${n} ${C.plural(n, 'подписчик', 'подписчика', 'подписчиков')} в Telegram.`, ok: 'Отправить' }))) return;
    await busy(el, async () => {
      try {
        const r = await store.act('broadcast', { text });
        haptic.ok();
        toast(store.mode === 'local' ? 'В демо-режиме рассылка сохранена, но не отправлена' : `Отправлено: ${r.broadcast.sent} из ${r.broadcast.total}`, 'ok');
      } catch (err) { toast(err.message, 'err'); }
    });
  };

  return { screens: { hall, bookings, tours, promos }, handlers: H };
}
