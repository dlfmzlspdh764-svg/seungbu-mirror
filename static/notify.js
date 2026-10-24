/* notify.js — 🔔 알림: Web Push (VAPID) subscription + settings, and the in-app notification center
   (bell + unread list). The center polls /api/notify/feed and filters events locally with the same
   rules the server uses for push, so it works even without push permission. */
(function () {
  const PREF_KEY = 'winprob.nprefs', READ_KEY = 'winprob.nread', SEEN_KEY = 'winprob.nseen';
  const $ = id => document.getElementById(id);
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = () => !!window.isIOSDevice, standalone = () => (window.isStandalonePWA ? window.isStandalonePWA() : false);
  const iosVer = () => { const m = /OS (\d+)_(\d+)/.exec(navigator.userAgent); return m ? +m[1] + m[2] / 100 : null; };
  const N = {cfg: null, prefs: null, sub: null, events: [], lastId: 0, tab: 'list', open: false, busy: false, msg: null};

  function defaults() {
    const d = (N.cfg && N.cfg.default_prefs) || {};
    return Object.assign({types: {}, level: 7, quiet: {on: false, start: 23, end: 8}}, JSON.parse(JSON.stringify(d)));
  }
  function loadPrefs() {
    const d = defaults(), p = LS.get(PREF_KEY, null) || {};
    N.prefs = Object.assign(d, p, {types: Object.assign({}, d.types, p.types || {}), quiet: Object.assign({}, d.quiet, p.quiet || {})});
    delete N.prefs.scope;                      // ⭐ 관심 경기 removed 2026-10-04: no favourites-only scope any more
  }
  function eligible(ev) {                      // mirror of app/notify.py eligible()
    const P = N.prefs;
    if (!P || !P.types[ev.type]) return false;
    if (ev.type === 'prob' && ev.level !== P.level) return false;
    if (ev.fav_only) return false;             // legacy favourites-only events (feature removed)
    return true;
  }
  const lastRead = () => +LS.get(READ_KEY, 0) || 0;
  const visible = () => N.events.filter(eligible);
  function badge() {
    const n = visible().filter(e => e.id > lastRead()).length, b = $('bellBadge');
    if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
    const bell = $('bellBtn'); if (bell) bell.setAttribute('aria-label', `알림${n ? ` (읽지 않음 ${n}개)` : ''}`);
  }

  /* ---------- feed polling ---------- */
  async function poll() {
    try {
      const d = await fetch('/api/notify/feed?limit=80').then(r => r.json());
      const evs = d.events || [];
      const seen = +LS.get(SEEN_KEY, 0) || 0;
      N.events = evs;
      const fresh = evs.filter(e => e.id > seen && eligible(e));
      if (seen && fresh.length && !N.open && document.visibilityState === 'visible' && typeof toast === 'function')
        toast(`🔔 ${fresh[0].title}${fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ''}`);
      if (evs.length) LS.set(SEEN_KEY, Math.max(seen, evs[0].id));
      if (!seen && !evs.length) LS.set(SEEN_KEY, 1);
      badge();
      if (N.open && N.tab === 'list') renderList();
    } catch (e) { /* offline — keep the last list */ }
  }

  /* ---------- push subscription ---------- */
  function b64ToU8(s) {
    const pad = '='.repeat((4 - s.length % 4) % 4), b = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(b, c => c.charCodeAt(0));
  }
  async function currentSub() {
    if (!hasPush) return null;
    try { const reg = await navigator.serviceWorker.getRegistration('/'); return reg ? await reg.pushManager.getSubscription() : null; } catch (e) { return null; }
  }
  const post = (url, body) => fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`); return j; });
  async function enable() {
    if (N.busy) return;
    N.busy = true; N.msg = null;
    try {
      // must be the first await in the tap handler (Safari/Chrome require a user gesture for the prompt)
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { N.msg = perm === 'denied' ? '알림이 차단되어 있습니다. 브라우저/기기 설정에서 이 사이트의 알림을 허용하세요.' : '알림 권한 요청이 취소되었습니다.'; return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const key = N.cfg && N.cfg.vapid_public_key;
      if (!key) throw new Error('서버 VAPID 키를 불러오지 못했습니다');
      if (!sub) sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64ToU8(key)});
      await post('/api/notify/subscribe', {subscription: sub.toJSON(), prefs: N.prefs});
      N.sub = sub;
      N.msg = '✅ 푸시 알림이 켜졌습니다. “테스트 알림”으로 확인해 보세요.';
    } catch (e) { N.msg = '알림 켜기 실패: ' + (e.message || e); }
    finally { N.busy = false; renderSettings(); }
  }
  async function disable() {
    const sub = N.sub || await currentSub();
    try { if (sub) { await post('/api/notify/unsubscribe', {endpoint: sub.endpoint}).catch(() => null); await sub.unsubscribe(); } } catch (e) {}
    N.sub = null; N.msg = '푸시 알림을 껐습니다. 앱 안의 알림 목록은 계속 볼 수 있습니다.';
    renderSettings();
  }
  let syncT = 0;
  function savePrefs() {
    LS.set(PREF_KEY, N.prefs); badge();
    clearTimeout(syncT);
    syncT = setTimeout(async () => {
      if (!N.sub) return;
      try {
        const r = await post('/api/notify/prefs', {endpoint: N.sub.endpoint, prefs: N.prefs});
        if (r && r.ok === false)            // server forgot us (e.g. expired) → re-register silently
          await post('/api/notify/subscribe', {subscription: N.sub.toJSON(), prefs: N.prefs});
      } catch (e) {}
    }, 600);
  }
  async function test() {
    const b = $('nTest'); if (b) b.disabled = true;
    try {
      const r = await post('/api/notify/test', {endpoint: N.sub.endpoint});
      N.msg = r.ok ? '📨 테스트 알림을 보냈습니다. 몇 초 안에 도착해야 합니다.' : '⚠️ ' + (r.error || '전송 실패');
    } catch (e) { N.msg = '⚠️ ' + (e.message || e); }
    renderSettings();
  }

  /* ---------- sheet UI ---------- */
  function openSheet(tab) {
    N.open = true; N.tab = tab || N.tab;
    $('notifySheet').hidden = false; $('scrim').hidden = false;
    requestAnimationFrame(() => { $('notifySheet').classList.add('show'); $('scrim').classList.add('show'); });
    document.body.style.overflow = 'hidden';
    paintTabs();
    setTimeout(() => $('notifyClose').focus(), 50);
  }
  function closeSheet() {
    N.open = false;
    $('notifySheet').classList.remove('show'); $('scrim').classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => { if (!N.open) { $('notifySheet').hidden = true; $('scrim').hidden = true; } }, 220);
    if (location.hash.includes('open=')) history.replaceState(null, '', location.pathname + location.search);
  }
  function paintTabs() {
    $('nTabList').classList.toggle('active', N.tab === 'list'); $('nTabList').setAttribute('aria-selected', N.tab === 'list');
    $('nTabSet').classList.toggle('active', N.tab === 'set'); $('nTabSet').setAttribute('aria-selected', N.tab === 'set');
    N.tab === 'list' ? renderList() : renderSettings();
  }
  const ICON = {prob: '📈', pick: '🎯', lineup: '🧢', odds: '💱', round: '🎫', kickoff: '⏰', graded: '✅', best: '🔥', radar: '🚨', upset_radar: '📡', system: '🛠', test: '🔔'};
  function ago(ts) {
    const s = Date.now() / 1000 - ts;
    const hm = new Date(ts * 1000).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false});
    return `${s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : s < 86400 ? Math.floor(s / 3600) + '시간 전' : Math.floor(s / 86400) + '일 전'} · ${hm} KST`;
  }
  function renderList() {
    const el = $('notifyBody'), evs = visible(), lr = lastRead();
    const hidden = N.events.length - evs.length;
    el.innerHTML = (evs.length ? evs.map(e => `<button type="button" class="nitem ${e.id > lr ? 'unread' : ''}" data-url="${esc(e.url || '')}">
        <span class="ic" aria-hidden="true">${ICON[e.type] || '🔔'}</span><span class="tx"><span class="tt">${esc(String(e.title).replace(/^[^\p{L}\p{N}]+\s*/u, ''))}</span>
        <span class="bd">${esc(e.body)}</span><span class="tm">${ago(e.ts)}</span></span></button>`).join('')
      : `<div class="empty">최근 3일간 조건에 맞는 알림이 없습니다.<br>경기 전 확률·추천·라인업·배당 변화가 감지되면 여기에 쌓입니다.</div>`)
      + (hidden > 0 ? `<div class="muted sm" style="margin-top:10px">설정(유형·기준 %p)에 따라 ${hidden}건은 숨겼습니다.</div>` : '');
    el.querySelectorAll('.nitem').forEach(b => b.onclick = () => { closeSheet(); openUrl(b.dataset.url); });
    const top = N.events.length ? N.events[0].id : 0;
    if (top > lr) LS.set(READ_KEY, top);      // opening the list marks everything read
    setTimeout(badge, 0);
  }
  function stateBox() {
    if (!hasPush) {
      if (ios() && !standalone())
        return `<div class="nstate warn">📱 <b>iPhone/iPad</b>에서는 <b>홈 화면에 설치한 앱</b>에서만 푸시 알림을 받을 수 있습니다 (iOS 16.4 이상).<br>
          Safari 하단 <b>공유 버튼(□↑) → “홈 화면에 추가”</b> 후, 홈 화면의 아이콘으로 앱을 열고 여기서 알림을 켜세요.${iosVer() && iosVer() < 16.4 ? `<br>⚠️ 현재 iOS ${String(iosVer()).replace('.', '.')} — 16.4 이상으로 업데이트가 필요합니다.` : ''}
          <br><button type="button" class="btn sm" id="nIosHow" style="margin-top:8px">설치 방법 보기</button><br>푸시 없이도 🔔 목록에서 알림을 확인할 수 있습니다.</div>`;
      return `<div class="nstate warn">이 브라우저는 웹 푸시를 지원하지 않습니다. 🔔 알림 목록은 앱을 열어 둔 동안 계속 갱신됩니다.</div>`;
    }
    const perm = Notification.permission;
    if (perm === 'denied') return `<div class="nstate warn">🚫 이 사이트의 알림이 <b>차단</b>되어 있습니다. ${ios() ? '설정 → 알림 → 앱 이름에서' : '주소창의 🔒(사이트 설정) → 알림에서'} 허용으로 바꾼 뒤 다시 시도하세요.</div>`;
    if (N.sub) return `<div class="nstate ok">🔔 푸시 알림 <b>켜짐</b> — 이 기기로 전송됩니다.<div class="row-btns" style="margin-top:8px"><button type="button" class="btn sm" id="nTest">📨 테스트 알림</button><button type="button" class="btn sm danger" id="nOff">끄기</button></div></div>`;
    return `<div class="nstate">앱을 닫아도 폰으로 알림을 받으려면 푸시를 켜세요.${ios() ? ' (iOS: 홈 화면에 설치된 앱 · 16.4+)' : ''}<br>
      <button type="button" class="btn primary" id="nOn" style="margin-top:8px;width:100%" ${N.busy ? 'disabled' : ''}>🔔 푸시 알림 켜기</button></div>`;
  }
  function renderSettings() {
    const el = $('notifyBody');
    if (!N.open || N.tab !== 'set' || !el) return;
    const P = N.prefs, C = N.cfg || {types: [], levels: [5, 7, 10, 15]};
    const hours = sel => Array.from({length: 24}, (_, h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('');
    el.innerHTML = stateBox() + (N.msg ? `<div class="nstate" role="status">${esc(N.msg)}</div>` : '') + `
      <h3 class="set-h">받을 알림</h3>
      ${C.types.map(t => `<label class="setrow"><span class="lbl"><b>${esc(t.label)}</b><span>${esc(t.desc)}</span></span>
        <span class="sw"><input type="checkbox" data-type="${t.key}" ${P.types[t.key] ? 'checked' : ''} aria-label="${esc(t.label)}"><span></span></span></label>`).join('')}
      <div class="setrow"><span class="lbl"><b>확률 급변 기준</b><span>경기 전 승리 확률이 이만큼 바뀌면 알림</span></span>
        <select id="nLevel" aria-label="확률 급변 기준">${C.levels.map(l => `<option value="${l}" ${l === P.level ? 'selected' : ''}>${l}%p 이상</option>`).join('')}</select></div>
      <h3 class="set-h">방해 금지 시간</h3>
      <label class="setrow"><span class="lbl"><b>방해 금지 사용</b><span>이 시간에는 푸시를 보내지 않고 목록에만 쌓습니다 (KST)</span></span>
        <span class="sw"><input type="checkbox" id="nQuiet" ${P.quiet.on ? 'checked' : ''} aria-label="방해 금지 사용"><span></span></span></label>
      <div class="setrow"><span class="lbl"><b>시간</b></span><select id="nQs" aria-label="시작">${hours(P.quiet.start)}</select> ~ <select id="nQe" aria-label="종료">${hours(P.quiet.end)}</select></div>
      <label class="setrow"><span class="lbl"><b>🚨 긴급 레이더는 방해 금지 무시</b><span>예측픽 적중률 80% 미만 긴급 알림은 방해 금지 시간에도 푸시</span></span>
        <span class="sw"><input type="checkbox" id="nRadarBypass" ${P.radar_bypass_quiet !== false ? 'checked' : ''} aria-label="긴급 레이더는 방해 금지 무시"><span></span></span></label>
      <div class="muted sm" style="margin-top:10px">중복 알림은 보내지 않으며, 기기당 ${C.rate ? `${C.rate.window_min}분에 최대 ${C.rate.max}건` : '일정 횟수'}으로 제한합니다 (초과분은 다음 알림에 “+N건 더”로 합산). 모든 수치는 앱이 수집한 실제 데이터 변화에서만 나옵니다.</div>`;
    const on = $('nOn'); if (on) on.onclick = enable;
    const off = $('nOff'); if (off) off.onclick = disable;
    const t = $('nTest'); if (t) t.onclick = test;
    const how = $('nIosHow'); if (how) how.onclick = () => { closeSheet(); if (window.showIosHint) window.showIosHint(); };
    el.querySelectorAll('[data-type]').forEach(c => c.onchange = () => { P.types[c.dataset.type] = c.checked; savePrefs(); });
    $('nLevel').onchange = e => { P.level = +e.target.value; savePrefs(); };
    $('nQuiet').onchange = e => { P.quiet.on = e.target.checked; savePrefs(); };
    $('nQs').onchange = e => { P.quiet.start = +e.target.value; savePrefs(); };
    $('nQe').onchange = e => { P.quiet.end = +e.target.value; savePrefs(); };
    $('nRadarBypass').onchange = e => { P.radar_bypass_quiet = e.target.checked; savePrefs(); };
  }

  /* ---------- deep links: /#open=p:KEY&y=&r= | g:ID&tab= | tab:NAME | notify ---------- */
  function openUrl(url) {
    if (!url) return;
    const h = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url;
    const q = new URLSearchParams(h), o = q.get('open') || '';
    if (!o) return;
    if (o === 'notify' || o === 'tab:notify') return openSheet('list');
    if (o.startsWith('tab:')) {
      const tab = o.slice(4);
      if (tab === 'proto' && q.get('y') && typeof PROTO !== 'undefined') {
        const want = `${q.get('y')}-${q.get('r')}`;
        if (PROTO.lastCurrent && PROTO.lastCurrent !== want) { PROTO.follow = false; PROTO.sel = [+q.get('y'), +q.get('r')]; }
      }
      return selectTab(tab);
    }
    if (o.startsWith('p:') && window.openTarget) return window.openTarget({src: 'proto', key: o.slice(2), year: q.get('y'), round: q.get('r')});
    if (o.startsWith('g:') && window.openTarget) return window.openTarget({src: 'app', id: o.slice(2), sport: q.get('tab') || 'soccer'});
  }
  window.openAppUrl = openUrl;

  /* ---------- wire up ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    $('bellBtn').onclick = () => openSheet('list');
    $('notifyClose').onclick = closeSheet;
    $('scrim').onclick = closeSheet;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && N.open) closeSheet(); });
    $('nTabList').onclick = () => { N.tab = 'list'; paintTabs(); };
    $('nTabSet').onclick = () => { N.tab = 'set'; paintTabs(); };
    try { N.cfg = await fetch('/api/notify/config').then(r => r.json()); } catch (e) { N.cfg = null; }
    loadPrefs();
    N.sub = await currentSub();
    if (N.sub && N.cfg) savePrefs();          // keep the server copy of prefs fresh
    poll(); setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
    if (location.hash.includes('open=')) setTimeout(() => openUrl(location.hash), 300);
  });
  window.addEventListener('hashchange', () => { if (location.hash.includes('open=')) openUrl(location.hash); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === 'open' && d.url) openUrl(d.url);
    if (d.type === 'push') poll();
  });
})();
