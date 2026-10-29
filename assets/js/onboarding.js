// Первый вход: имя + согласие → подтверждение номера через Telegram → аватар. Дальше приложение помнит человека.
import { store } from './store.js';
import { tg, tgUser, haptic, openLink } from './tg.js';
import { esc, $, icon, toast, sheet, busy } from './ui.js';
import { PRIVACY_HTML } from './privacy.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Сжимаем фото до квадрата 320×320, JPEG ~30–60 КБ
export function resizeImage(file, size = 320) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Выберите картинку'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Фото больше 15 МБ'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось открыть фото')); };
    img.src = url;
  });
}

export function avatarHTML(v, size = 56, cls = 'avatar') {
  const name = v.profile?.name || tgUser()?.first_name || 'Гость';
  const src = v.avatar;
  return `<div class="${cls}" style="width:${size}px;height:${size}px">${src ? `<img src="${esc(src)}" alt="">` : `<span style="font-size:${Math.round(size * 0.4)}px">${esc(name.trim().slice(0, 1).toUpperCase())}</span>`}</div>`;
}

export function initOnboarding({ S, render, H, fsBtn }) {
  S.ob = S.ob || { step: 'welcome', name: '', consent: false };
  const ob = S.ob;
  const canContact = () => !!(tg?.requestContact && tg.isVersionAtLeast?.('6.9'));

  function screen(v) {
    const u = tgUser();
    if (!ob.name) ob.name = u ? [u.first_name, u.last_name].filter(Boolean).join(' ') : '';
    const free = Object.values(v.live).filter(x => x.status === 'free').length;
    const dots = ['welcome', 'avatar'].map(s => `<i class="${ob.step === s ? 'on' : ''}"></i>`).join('');
    let body = '';

    if (ob.step === 'welcome') body = `
      <h1 class="ob-title">Бронь ПК в NEBULA за минуту</h1>
      <p class="ob-lead">Войдите один раз — дальше приложение запомнит вас на этом устройстве.</p>
      <div class="ob-live"><span class="dot"></span><b>${free}</b> из 22 ПК свободны прямо сейчас</div>
      <form id="obForm" novalidate>
        <label class="field"><span>Как к вам обращаться</span><input name="name" autocomplete="given-name" value="${esc(ob.name)}" placeholder="Имя или ник" maxlength="60"></label>
        <label class="field"><span>Телефон</span><div class="with-btn"><input name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(ob.phone || '')}" placeholder="+995 5__ __ __ __" maxlength="24">${canContact() ? `<button type="button" class="btn btn-ghost btn-sm" data-a="obContact" style="height:52px">Из Telegram</button>` : ''}</div><small>Чтобы администратор мог связаться по брони</small></label>
        <label class="check"><input type="checkbox" name="consent" ${ob.consent ? 'checked' : ''}><span class="box">${icon('check', 14)}</span><span>Соглашаюсь с <a href="/privacy" data-a="privacy">политикой конфиденциальности</a></span></label>
        <button class="btn" type="submit" data-a="obNext">Продолжить</button>
      </form>`;

    if (ob.step === 'phone') body = `
      <h1 class="ob-title">Подтвердите номер</h1>
      <p class="ob-lead">По номеру клуб подтверждает брони и связывается, если что-то изменится. Номер видит только администратор, рассылок без вашего согласия не будет.</p>
      ${tg && canContact() ? `
        <button class="btn" data-a="obContact">${icon('phone', 18)}Поделиться номером</button>
        <p class="ob-note">Telegram покажет окно подтверждения — нажмите «Поделиться». Вводить номер и коды не нужно.</p>`
      : store.mode === 'remote' ? `
        <button class="btn" data-a="obBot">${icon('send', 18)}Подтвердить через Telegram</button>
        <p class="ob-note">Откроется бот @${esc(store.bot)} — нажмите в нём «Поделиться номером». Это бесплатно и без SMS.</p>`
      : `
        <form id="obDemo" novalidate>
          <label class="field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+995 5__ __ __ __" value="${esc(ob.phone || '')}"></label>
          ${ob.codeSent ? `<label class="field"><span>Код из SMS</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="4" placeholder="••••" class="code-input"></label>` : ''}
          <button class="btn" type="submit" data-a="obDemoSubmit">${ob.codeSent ? 'Подтвердить' : 'Получить код'}</button>
          <p class="ob-note">Демо-версия без сервера: код — 0000. После подключения базы вход будет через Telegram.</p>
        </form>`}
      <button class="link-btn ob-back" data-a="obBack">${icon('back', 16)}Назад</button>`;

    if (ob.step === 'wait') body = `
      <h1 class="ob-title">Ждём подтверждение</h1>
      <p class="ob-lead">В боте @${esc(store.bot)} нажмите «📱 Поделиться номером». Эта страница войдёт сама.</p>
      <div class="ob-wait">
        <div class="ob-qr" id="obQr" aria-label="QR-код для входа с телефона"></div>
        <div><span class="spinner"></span><p class="ob-note" style="margin:12px 0 0">Telegram на другом устройстве? Отсканируйте QR телефоном.</p></div>
      </div>
      <button class="btn btn-ghost" data-a="obOpenBot">Открыть бота ещё раз</button>
      <button class="link-btn ob-back" data-a="obBack">${icon('back', 16)}Назад</button>`;

    if (ob.step === 'avatar') body = `
      <h1 class="ob-title">Добавьте аватар</h1>
      <p class="ob-lead">Так администратор быстрее узнает вас на ресепшене. Можно пропустить и добавить позже в профиле.</p>
      <div class="ob-ava">${avatarHTML(v, 132, 'avatar avatar-xl')}</div>
      <div class="ob-acts">
        <button class="btn" data-a="avaUpload">${icon('user', 18)}Загрузить фото</button>
        ${tgUser()?.photo_url ? `<button class="btn btn-ghost" data-a="avaTg">Фото из Telegram</button>` : ''}
        <button class="btn btn-ghost" data-a="obFinish">${v.avatar ? 'Готово' : 'Пропустить'}</button>
      </div>`;

    return `<div class="ob">
      <div class="ob-top"><div class="wordmark"><b>NEBUL<i>A</i></b><small>GAMING</small></div><div style="display:flex;align-items:center;gap:10px">${fsBtn ? fsBtn() : ''}<div class="ob-dots" aria-hidden="true">${dots}</div></div></div>
      <div class="ob-body">${body}</div>
      <button class="ob-staff" data-a="adminLogin">Для персонала</button>
    </div>`;
  }

  function after() {
    if (ob.step === 'wait' && ob.link) drawQR(ob.link);
  }

  function drawQR(text) {
    const el = $('#obQr'); if (!el || el.dataset.done) return;
    const go = () => { try { el.innerHTML = ''; new window.QRCode(el, { text, width: 148, height: 148, colorDark: '#05050F', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); el.dataset.done = 1; } catch { /* */ } };
    if (window.QRCode) return go();
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    sc.onload = go; document.head.appendChild(sc);
  }

  H.privacy = (el, e) => { e?.preventDefault(); sheet({ title: 'Политика конфиденциальности', full: true, body: `<article class="policy">${PRIVACY_HTML}</article>` }); };

  H.obNext = async (el, e) => {
    e?.preventDefault();
    const f = $('#obForm');
    ob.name = f.name.value.trim(); ob.phone = f.phone.value.trim(); ob.consent = f.consent.checked;
    if (ob.name.length < 2) { f.name.focus(); return toast('Напишите, как к вам обращаться', 'err'); }
    if (ob.phone.replace(/\D/g, '').length < 9) { f.phone.focus(); return toast('Укажите номер телефона', 'err'); }
    if (!ob.consent) return toast('Отметьте согласие с политикой', 'err');
    await busy(el, async () => {
      try { await store.act('completeProfile', { name: ob.name, phone: ob.phone, consent: true, via: 'manual' }); done(); }
      catch (err) { toast(err.message, 'err'); }
    });
  };
  H.obBack = () => { stopPoll(); ob.step = ob.step === 'wait' ? 'phone' : 'welcome'; ob.codeSent = false; render(); };

  // ---- в Telegram: подставить номер одной кнопкой (необязательно) ----
  H.obContact = () => {
    const f = $('#obForm');
    if (f) { ob.name = f.name.value; ob.consent = f.consent.checked; }
    tg.requestContact((shared, res) => {
      const ph = res?.responseUnsafe?.contact?.phone_number;
      if (shared && ph) { ob.phone = (ph.startsWith('+') ? '' : '+') + ph; const inp = $('#obForm [name=phone]'); if (inp) inp.value = ob.phone; haptic.ok(); }
      else if (!shared) toast('Можно ввести номер вручную');
    });
  };

  // ---- в браузере: вход через бота ----
  let pollTimer = null;
  const stopPoll = () => { clearTimeout(pollTimer); pollTimer = null; };
  H.obBot = async el => {
    await busy(el, async () => {
      try {
        const { token } = await store.act('authStart', { name: ob.name });
        ob.token = token; ob.link = `https://t.me/${store.bot}?start=auth_${token}`;
        ob.step = 'wait'; render();
        openLink(ob.link);
        poll(Date.now());
      } catch (err) { toast(err.message, 'err'); }
    });
  };
  H.obOpenBot = () => ob.link && openLink(ob.link);
  function poll(t0) {
    stopPoll();
    pollTimer = setTimeout(async () => {
      if (ob.step !== 'wait') return;
      if (Date.now() - t0 > 15 * 60e3) { toast('Время вышло — попробуйте ещё раз', 'err'); ob.step = 'phone'; return render(); }
      try {
        const r = await store.act('authCheck', { token: ob.token });
        if (r.done) return done();
      } catch (err) { toast(err.message, 'err'); ob.step = 'phone'; return render(); }
      poll(t0);
    }, 2500);
  }

  // ---- демо без сервера ----
  H.obDemoSubmit = async (el, e) => {
    e?.preventDefault();
    const f = $('#obDemo');
    ob.phone = f.phone.value.trim();
    if (ob.phone.replace(/\D/g, '').length < 9) return toast('Проверьте номер телефона', 'err');
    if (!ob.codeSent) { ob.codeSent = true; render(); setTimeout(() => $('#obDemo [name=code]')?.focus(), 50); return toast('Код отправлен. В демо — 0000', 'ok'); }
    if (f.code.value.trim() !== '0000') return toast('Неверный код', 'err');
    try { await store.act('completeProfile', { name: ob.name, consent: true, phone: ob.phone, via: 'demo' }); done(); } catch (err) { toast(err.message, 'err'); }
  };

  function done() {
    stopPoll(); haptic.ok();
    ob.step = 'avatar'; render();
  }
  H.obFinish = () => {
    Object.assign(ob, { step: 'welcome', codeSent: false, token: null, link: null }); S.tab = 'home'; haptic.ok();
    render();
    toast(`Готово, ${store.view.profile?.name || 'добро пожаловать'}! Вход запомнен`, 'ok');
  };

  // ---- аватар (и в онбординге, и в профиле) ----
  H.avaUpload = () => {
    let inp = $('#avaFile');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'avaFile'; inp.hidden = true;
      document.body.appendChild(inp);
      inp.addEventListener('change', async () => {
        const f = inp.files?.[0]; inp.value = '';
        if (!f) return;
        try {
          const data = await resizeImage(f);
          await store.act('setAvatar', { data });
          haptic.ok(); toast('Аватар обновлён', 'ok');
          document.querySelectorAll('.sheet-root').forEach(r => r.querySelector('[data-close]')?.click());
        } catch (err) { toast(err.message, 'err'); }
      });
    }
    inp.click();
  };
  H.avaTg = async () => {
    const url = tgUser()?.photo_url; if (!url) return;
    try { await store.act('setAvatar', { data: url }); haptic.ok(); toast('Взяли фото из Telegram', 'ok'); document.querySelectorAll('.sheet-root').forEach(r => r.querySelector('[data-close]')?.click()); } catch (err) { toast(err.message, 'err'); }
  };
  H.avaRemove = async () => {
    try { await store.act('setAvatar', { data: null }); toast('Фото удалено'); document.querySelectorAll('.sheet-root').forEach(r => r.querySelector('[data-close]')?.click()); } catch (err) { toast(err.message, 'err'); }
  };
  H.avaSheet = () => {
    const v = store.view;
    sheet({
      title: 'Фото профиля',
      body: `<div class="ob-ava" style="margin:4px 0 22px">${avatarHTML(v, 120, 'avatar avatar-xl')}</div>
        <div class="ob-acts">
          <button class="btn" data-a="avaUpload">${icon('user', 18)}${v.avatar ? 'Выбрать другое фото' : 'Загрузить фото'}</button>
          ${tgUser()?.photo_url ? `<button class="btn btn-ghost" data-a="avaTg">Фото из Telegram</button>` : ''}
          ${v.avatar ? `<button class="btn btn-ghost" data-a="avaRemove">Удалить фото</button>` : ''}
        </div>`,
    });
  };

  return { screen, after, stopPoll };
}
