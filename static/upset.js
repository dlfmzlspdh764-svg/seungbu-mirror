/* 🎲 역배 예측 (per Proto match card) + 🔥 오늘의 베스트 역배 (home banner, entrance animation, WebAudio chime). */
(function () {
  const STYLE = `
  .upk { margin-top:6px; font-size:11.5px; line-height:1.55; background:#1f1530; border:1px solid #6d3fb8; border-radius:6px; padding:5px 7px; overflow-wrap:anywhere; }
  .upk.none { background:#141a26; border-color:#2e3a52; color:#94a3b8; }
  .upk .ph { font-weight:700; color:#e9d5ff; } .upk .pk2 { font-size:12.5px; } .upk .pk2 b { color:#fdba74; }
  .upk .wk { color:#fcd34d; } .upk .ok2 { color:#4ade80; font-weight:600; }
  .bu { overflow:hidden; margin:8px 24px 4px; padding:10px 12px; border-radius:12px; background:linear-gradient(135deg,#2a1608,#1a1330 60%,#121a2c); border:1px solid #9a4d0f; position:relative; min-width:0; }
  .bu-h { display:flex; align-items:center; gap:8px; min-width:0; }
  .bu-h h2 { margin:0; font-size:15.5px; white-space:nowrap; }
  .bu-h .sub2 { font-size:11px; color:#fbbf24; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
  .bu-snd { flex:0 0 auto; min-width:44px; min-height:44px; background:#1e293b; border:1px solid #334155; color:#e8edf5; border-radius:22px; padding:3px 9px; font-size:15px; cursor:pointer; line-height:1.3; font-family:inherit; }
  .bu-list { list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .bu-it { position:relative; display:block; width:100%; text-align:left; font:inherit; color:inherit; background:#0f1728; border:1px solid #2b3750; border-radius:9px; padding:7px 9px; cursor:pointer; min-width:0; overflow:visible; }
  .bu-it:active { transform:scale(.99); }
  .bu-it.top { background:#2a1a0c; border-color:#f97316; }
  .bu-r1 { display:flex; align-items:center; gap:6px; font-size:12px; color:#94a3b8; min-width:0; }
  .bu-rk { flex:0 0 auto; width:19px; height:19px; border-radius:10px; background:#334155; color:#fff; font-size:11px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; }
  .bu-it.top .bu-rk { background:#f97316; }
  .bu-tm { font-size:13.5px; font-weight:700; color:#e8edf5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
  .bu-ko { flex:0 0 auto; white-space:nowrap; font-size:11px; }
  .bu-r2 { display:flex; align-items:baseline; gap:6px; margin-top:3px; font-size:12.5px; min-width:0; }
  .bu-pk { color:#fdba74; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
  .bu-od { flex:0 0 auto; font-weight:800; font-size:15px; color:#fff; }
  .bu-r3 { display:flex; flex-wrap:wrap; gap:2px 8px; font-size:11px; color:#c5cedd; margin-top:2px; }
  .bu-r3 .good { color:#4ade80; font-weight:700; } .bu-r3 .neg { color:#f87171; }
  .bu-nt { font-size:10.5px; color:#fcd34d; margin-top:2px; overflow-wrap:anywhere; }
  .bu-ft { font-size:10.5px; color:#94a3b8; margin-top:6px; line-height:1.45; overflow-wrap:anywhere; }
  .bu-empty { font-size:12.5px; color:#94a3b8; padding:6px 2px; }
  .bu-burst { position:absolute; left:50%; top:50%; width:0; height:0; pointer-events:none; z-index:3; }
  .bu-burst i { position:absolute; left:0; top:0; width:7px; height:11px; border-radius:2px; background:var(--c); opacity:0;
    animation:buConf 1.5s cubic-bezier(.15,.7,.3,1) var(--d) forwards; }
  .bu.anim .bu-it.top { animation:buSlide .55s cubic-bezier(.2,.9,.3,1.2) both, buGlow .9s ease-in-out .45s 2; }
  .bu.anim .bu-it:not(.top) { animation:buFade .5s ease-out both; animation-delay:calc(.25s + var(--i) * 70ms); }
  .bu.anim { animation:buFrame 2.4s ease-out; }
  @keyframes buSlide { from { transform:translateX(-110%); opacity:0; } to { transform:none; opacity:1; } }
  @keyframes buFade { from { transform:translateY(8px); opacity:0; } to { transform:none; opacity:1; } }
  @keyframes buGlow { 0%,100% { box-shadow:0 0 0 0 #f9731600; transform:scale(1); } 50% { box-shadow:0 0 18px 4px #f97316cc, 0 0 0 2px #fbbf24; transform:scale(1.025); } }
  @keyframes buFrame { 0% { border-color:#fbbf24; box-shadow:0 0 24px #f9731688; } 100% { border-color:#9a4d0f; box-shadow:none; } }
  @keyframes buConf { 0% { opacity:1; transform:translate(-50%,-50%) rotate(0) scale(.6); }
    80% { opacity:1; } 100% { opacity:0; transform:translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(var(--r)) scale(1); } }
  .bu.still .bu-it.top { box-shadow:0 0 0 2px #fbbf24; }
  .bu-jump { animation:buJump 1s ease-in-out 2 !important; }
  @keyframes buJump { 0%,100% { box-shadow:0 0 0 0 #f9731600; } 50% { box-shadow:0 0 0 3px #f97316, 0 0 20px #f97316aa; } }
  @media (prefers-reduced-motion: reduce) {
    .bu.anim, .bu.anim .bu-it, .bu-burst i, .bu-jump { animation:none !important; }
    .bu-burst { display:none; }
  }
  @media (max-width: 640px) { .bu { margin:6px 12px 4px; padding:9px 10px; } }`;
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);

  const e = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const P = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
  const EVs = x => x == null ? '–' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  const KO = iso => iso ? new Date(iso).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}) : '–';
  const SCLS = {app: 'src-app', dk: 'src-dk', rating: 'src-rt', rating_only: 'src-rt', market: 'src-mk', app_ml: 'src-app'};
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* team hint for Proto outcome labels (승 = home side, 패 = away side) */
  function side(label, home, away) {
    if (/^(핸디)?승$/.test(label)) return home;
    if (/^(핸디)?패$/.test(label)) return away;
    return null;
  }

  /* ---------- per-match box (Proto card) ---------- */
  window.upsetPickHtml = function (up, m) {
    if (!up || up.status === 'excluded') return '';
    const head = `<span class="ph">🎲 역배 예측</span> <span class="muted">(배당 ${(up.min_odds || 1.7).toFixed(2)} 이상 중 1개 · EV순)</span>`;
    const relh = (up.rel || up.demoted_from) && typeof uaBadge === 'function' ? `<br>${uaBadge(up.rel)} <span class="muted sm">${uaRelLine(up.rel, up.demoted_from)}</span>` : '';
    if (up.status === 'hold') return `<div class="upk none">${head}<br><b>${e(up.text)}</b><br><span class="sm">보류된 픽: ${e(up.bet_type)} ${e(up.label)} @${up.odds.toFixed(2)} · 추정 ${P(up.p)} · EV ${EVs(up.ev)}</span>${relh}</div>`;
    if (up.status !== 'pick') return `<div class="upk none">${head}<br>${e(up.text || '해당 없음 (1.70 이상 선택지 없음)')}${up.reason ? ` <span class="muted sm">· ${e(up.reason)}</span>` : ''}</div>`;
    const tm = m ? side(up.label, m.home, m.away) : null;
    const cls = up.strength === 'ev_plus' ? 'ok2' : 'wk';
    return `<div class="upk">${head}<br>
      <span class="pk2">${e(up.bet_type)} <b>${e(up.label)}${tm ? ' (' + e(tm) + ')' : ''}</b> @${up.odds.toFixed(2)}</span> · 추정 <b>${P(up.p)}</b> · <span class="${up.ev > 0 ? 'good' : 'muted'}">EV ${EVs(up.ev)}</span><br>
      <span class="srcl ${SCLS[up.src] || ''}">${e(up.src_label || up.src || '-')}</span> ${up.basis && up.basis !== up.src_label ? `<span class="muted sm">${e(up.basis)}</span>` : ''}<br>
      <span class="${cls}">${up.strength === 'market_only' ? '⚠️ ' : ''}${e(up.note || '')}</span>
      <span class="muted sm"> · 후보 ${up.n_candidates}개 중</span>${relh}</div>`;
  };

  /* ---------- sound: short WebAudio chime, unlocked by the first user gesture ---------- */
  const SKEY = 'wpUpsetSound';
  const S = {ctx: null, pendingUntil: 0};
  const soundOn = () => { try { return localStorage.getItem(SKEY) !== 'off'; } catch (x) { return true; } };
  function ctx(create) {
    if (!S.ctx && create) { const C = window.AudioContext || window.webkitAudioContext; if (C) try { S.ctx = new C(); } catch (x) {} }
    return S.ctx;
  }
  function playChime() {
    const c = ctx(true); if (!c || c.state !== 'running') return false;
    const t0 = c.currentTime + 0.02, out = c.createGain();
    out.gain.value = 0.16; out.connect(c.destination);
    [[1046.5, 0], [1318.5, 0.09], [1568.0, 0.18], [2093.0, 0.29]].forEach(([f, dt], k) => {
      for (const [type, mul, g] of [['sine', 1, 1], ['triangle', 2, 0.18]]) {
        const o = c.createOscillator(), a = c.createGain();
        o.type = type; o.frequency.value = f * mul;
        const s = t0 + dt, len = k === 3 ? 1.1 : 0.55;
        a.gain.setValueAtTime(0.0001, s); a.gain.exponentialRampToValueAtTime(g, s + 0.012);
        a.gain.exponentialRampToValueAtTime(0.0001, s + len);
        o.connect(a); a.connect(out); o.start(s); o.stop(s + len + 0.05);
      }
    });
    return true;
  }
  const activated = () => !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  function chime() {
    if (!soundOn()) return;
    const c = ctx(activated());           // don't create a (blocked) context before any gesture
    if (c && c.state === 'running') { playChime(); return; }
    if (c && activated()) { c.resume().then(() => { if (!playChime()) S.pendingUntil = Date.now() + 60000; }).catch(() => {}); return; }
    S.pendingUntil = Date.now() + 60000;  // play on the first tap (within a minute of the animation)
  }
  function unlock() {
    const c = ctx(true); if (!c) return;
    const go = () => { if (S.pendingUntil > Date.now() && soundOn()) { S.pendingUntil = 0; playChime(); } };
    if (c.state !== 'running') c.resume().then(go).catch(() => {}); else go();
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, {capture: true, passive: true}));

  /* ---------- home banner ---------- */
  const B = {data: null, hiddenAt: null, lastAnim: 0};
  const homeSport = () => (document.querySelector('#tabs button, nav button') || {}).dataset?.sport || 'soccer';
  const isHome = () => (typeof sport === 'undefined' ? true : sport === homeSport());
  const box = () => document.getElementById('bestUpset');

  function itemHtml(r, k) {
    const u = r.pick, tm = r.source === 'proto' ? side(u.label, r.home, r.away) : null;
    const pick = r.source === 'proto' ? `${u.bet_type} · ${u.label}${tm ? ' (' + tm + ')' : ''}` : `머니라인 · ${u.label}`;
    const where = r.source === 'proto' ? `프로토 ${r.round}회차` : '앱 경기';
    return `<li><button type="button" class="bu-it ${k === 0 ? 'top' : ''}" style="--i:${k}" data-src="${r.source}" data-key="${e(r.key ?? '')}" data-id="${e(r.id ?? '')}" data-sport="${e(r.sport)}" data-round="${r.round ?? ''}" data-year="${r.year ?? ''}">
      <div class="bu-r1"><span class="bu-rk">${k + 1}</span><span class="bu-tm">${e(r.home)} vs ${e(r.away)}</span><span class="bu-ko">${KO(r.kickoff)} KST</span></div>
      <div class="bu-r2"><span class="bu-pk">${e(pick)}</span><span class="bu-od">@${u.odds.toFixed(2)}</span></div>
      <div class="bu-r3"><span>추정 <b>${P(u.p)}</b></span><span class="${u.ev > 0 ? 'good' : 'neg'}">EV ${EVs(u.ev)}</span><span class="srcl ${SCLS[u.src] || ''}">${e(u.src_label || u.src)}</span><span class="muted">${e(where)} · ${e(r.league || '')}</span></div>
      ${u.strength !== 'ev_plus' ? `<div class="bu-nt">${u.strength === 'market_only' ? '⚠️ ' : ''}${e(u.note)}</div>` : ''}
      ${u.rel && typeof uaBadge === 'function' ? `<div class="bu-rel">${uaBadge(u.rel)} ${uaRelLine(u.rel, u.demoted_from)}</div>` : ''}
    </button></li>`;
  }

  function render() {
    const el = box(); if (!el) return;
    el.hidden = !isHome();
    const d = B.data;
    const snd = `<button type="button" class="bu-snd" id="buSound" aria-pressed="${soundOn()}" aria-label="효과음 ${soundOn() ? '끄기' : '켜기'}">${soundOn() ? '🔊' : '🔇'}</button>`;
    let body;
    if (!d) body = '<div class="bu-empty">불러오는 중…</div>';
    else if (d.error) body = `<div class="bu-empty">불러오기 실패: ${e(d.error)}</div>`;
    else if (!d.items.length) body = `<div class="bu-empty">해당 없음 (오늘 시작 전 경기 중 배당 ${d.min_odds.toFixed(2)} 이상 선택지 없음)</div>`;
    else body = `<ol class="bu-list">${d.items.map(itemHtml).join('')}</ol>`;
    const ft = d && !d.error ? `<div class="bu-ft">${e(d.window.label)} · 후보 ${d.n_total}경기 중 상위 ${d.items.length}${d.n_held ? ` · ⏸ 낮은 신뢰 보류 ${d.n_held}경기` : ''} · ${e(d.rule)}</div>` : '';
    el.innerHTML = `<div class="bu-h"><h2>🔥 오늘의 베스트 역배</h2><span class="sub2">배당 ${(d && d.min_odds || 1.7).toFixed(2)}+ · ${d && d.reliability ? '신뢰도 보정 EV 순' : 'EV→확률 순'}</span>${snd}</div>${body}${ft}`;
    el.querySelector('#buSound').onclick = ev => {
      ev.stopPropagation();
      const on = !soundOn();
      try { localStorage.setItem(SKEY, on ? 'on' : 'off'); } catch (x) {}
      render();
      if (on) { S.pendingUntil = Date.now() + 5000; unlock(); }   // preview (this tap is the unlocking gesture)
    };
    el.querySelectorAll('.bu-it').forEach(b => b.onclick = () => jump(b.dataset));
  }

  function animate() {
    const el = box();
    if (!el || el.hidden || !B.data || !B.data.items || !B.data.items.length) return;
    B.lastAnim = Date.now();
    el.classList.remove('anim', 'still'); void el.offsetWidth;
    if (reduced()) {
      el.classList.add('still'); setTimeout(() => el.classList.remove('still'), 2500);
    } else {
      el.classList.add('anim');
      const top = el.querySelector('.bu-it.top');
      if (top) {
        const burst = document.createElement('span'); burst.className = 'bu-burst';
        const cols = ['#f97316', '#fbbf24', '#f43f5e', '#a855f7', '#22d3ee', '#4ade80'];
        let h = '';
        for (let k = 0; k < 26; k++) {
          const a = (k / 26) * Math.PI * 2 + Math.random() * 0.3, dist = 60 + Math.random() * 90;
          h += `<i style="--x:${(Math.cos(a) * dist * 1.4).toFixed(0)}px;--y:${(Math.sin(a) * dist * 0.7 - 20).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;--c:${cols[k % cols.length]};--d:${(0.45 + Math.random() * 0.15).toFixed(2)}s"></i>`;
        }
        burst.innerHTML = h; top.appendChild(burst);
        setTimeout(() => burst.remove(), 2400);
      }
      setTimeout(() => el.classList.remove('anim'), 2600);
    }
    chime();
  }

  async function load(withAnim) {
    try {
      const r = await fetch('/api/upsets/best?limit=5');
      const j = await r.json();
      if (!r.ok || !j.items) throw new Error(j.detail || ('HTTP ' + r.status));
      B.data = j;
    } catch (x) { if (!B.data) B.data = {error: String(x.message || x)}; }
    render();
    if (withAnim) animate();
  }
  window.bestUpsetLoad = load;

  /* tap → the match card (Proto tab or the app game's sport tab) */
  function waitFor(sel, ms) {
    return new Promise(res => {
      const t0 = Date.now();
      (function poll() { const n = document.querySelector(sel); if (n) return res(n); if (Date.now() - t0 > ms) return res(null); setTimeout(poll, 150); })();
    });
  }
  async function jump(ds) {
    let sel, btn;
    if (typeof clearSearch === 'function') clearSearch();
    if (ds.src === 'proto') {
      if (typeof PROTO !== 'undefined') {
        Object.assign(PROTO, {sport: 'all', onlyApp: false, onlyFlag: false, status: '자동', doneOpen: true});
        const cur = PROTO.lastCurrent, want = `${ds.year}-${ds.round}`;
        if (!cur || cur === want) { PROTO.follow = true; PROTO.sel = null; } else { PROTO.follow = false; PROTO.sel = [+ds.year, +ds.round]; }
      }
      btn = document.querySelector('nav button[data-sport="proto"]');
      sel = `#protoView .mc[data-key="${CSS.escape(ds.key)}"]`;
    } else {
      btn = document.querySelector(`nav button[data-sport="${CSS.escape(ds.sport)}"]`);
      sel = `#games .card[data-gid="${CSS.escape(ds.id)}"]`;
    }
    if (btn) btn.click();
    else if (ds.src === 'proto' && typeof protoLoad === 'function') protoLoad();
    const card = await waitFor(sel, 15000);
    if (!card) { if (typeof toast === 'function') toast('해당 경기 카드를 찾지 못했습니다 (종료되었거나 목록에서 빠짐)'); return false; }
    const stick = document.getElementById('stick') || document.querySelector('nav');
    const off = (stick ? stick.offsetHeight : 0) + 44;
    // re-query each time: a live-score refresh may have re-rendered the list (new node) since the first scroll
    const go = smooth => { const c = document.querySelector(sel) || card;
      window.scrollTo({top: Math.max(0, c.getBoundingClientRect().top + window.scrollY - off), behavior: smooth && !reduced() ? 'smooth' : 'auto'}); };
    go(true);
    setTimeout(() => go(false), 700);          // correct for cards above that were laid out lazily (content-visibility)
    setTimeout(() => go(false), 1600);
    const flash = () => { const c = document.querySelector(sel) || card; c.classList.remove('bu-jump'); void c.offsetWidth; c.classList.add('bu-jump');
      setTimeout(() => c.classList.remove('bu-jump'), 2200); };
    flash(); setTimeout(() => { if (document.querySelector(sel) !== card) flash(); }, 750);
    return true;
  }
  window.openTarget = jump;                   // deep links (#open=…) and notification clicks
  window.bestUpsetSync = () => { const el = box(); if (el) el.hidden = !isHome(); };

  /* show only on the home (first) tab */
  document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => setTimeout(() => {
    const el = box(); if (el) el.hidden = !isHome();
  }, 0)));

  /* re-open: fresh load, bfcache restore, or back to a visible tab after > 30 s hidden */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { B.hiddenAt = Date.now(); return; }
    if (B.hiddenAt && Date.now() - B.hiddenAt > 30000) load(true);
    B.hiddenAt = null;
  });
  window.addEventListener('pageshow', ev => { if (ev.persisted) load(true); });
  setInterval(() => { if (!document.hidden && isHome()) load(false); }, 60000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => load(true));
  else load(true);
})();
