/* PWA glue: service worker registration, "📲 앱 설치" button (Android/Chrome beforeinstallprompt),
 * one-time iOS "공유 → 홈 화면에 추가" hint, and an 오프라인 banner whenever an /api/* response came
 * from the service-worker cache instead of the network. Loaded in <head> so the fetch wrapper is in
 * place before any data request. */
(function () {
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const HINT_KEY = 'winprob.iosHintShown';
  let deferred = null, hintTimer = null;

  if (isStandalone()) document.documentElement.classList.add('standalone');

  /* ---- outage handling: never present cached data as live; reconnect + refresh by itself ----
   * Any /api/* GET that fails everywhere (or only gets the service worker's cached copy) puts the page in
   * "down" mode: a sticky banner says how old the shown data is ("마지막 업데이트 N시간 전 · 서버 재연결 중"),
   * and a probe loop polls /api/health on EVERY known origin (Funnel primary + Cloudflare fallback saved in
   * localStorage) with backoff 2 s → 4 s → 8 s → 15 s → 30 s (max). The moment one answers live, the stale
   * API cache is dropped, every view reloads fresh data (window.winprobRefreshAll) and the SW is updated. */
  const origFetch = window.fetch.bind(window);
  const LIVE_KEY = 'winprob.lastLiveAt';
  const NET = {down: false, since: 0, attempt: 0, timer: 0, tick: 0, nextAt: 0, dataAt: 0, probing: false, mirrorAt: 0,
               lastLiveAt: +(localStorage.getItem(LIVE_KEY) || 0) || 0};
  const PROBE_MS = [2000, 4000, 8000, 15000, 30000];
  function ago(ms) {
    const s = Math.max(0, ms / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분 전`;
    return `${Math.floor(s / 86400)}일 ${Math.floor(s % 86400 / 3600)}시간 전`;
  }
  const kstAt = t => new Date(t).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false});
  function banner() {
    const bar = document.getElementById('offlineBar');
    if (!bar) return;
    if (IS_MIRROR || (NET.down && NET.mirrorAt)) { mirrorBanner(bar); return; }
    bar.classList.remove('mirror');
    if (!NET.down) { bar.hidden = true; bar.classList.remove('recovered'); return; }
    const t = NET.dataAt || NET.lastLiveAt;
    const wait = Math.max(0, Math.ceil((NET.nextAt - Date.now()) / 1000));
    const off = navigator.onLine === false;
    bar.classList.remove('recovered');
    bar.innerHTML = `<div class="ob-l1">📴 ${t ? `마지막 업데이트 <b>${ago(Date.now() - t)}</b>` : '서버에 연결할 수 없습니다'} · ${off ? '휴대폰이 오프라인입니다' : '서버 재연결 중…'}</div>` +
      `<div class="ob-l2">${t ? `${kstAt(t)} KST 데이터 — 실시간 아님. ` : ''}${NET.probing ? '연결 확인 중…' : `${wait}초 후 다시 시도 (${NET.attempt}회째)`} · 연결되면 자동으로 새로고침됩니다 ` +
      `<button type="button" class="ob-btn" onclick="winprobNet.probeNow()">지금 재시도</button></div>`;
    bar.hidden = false;
  }
  /* ---- 📦 static mirror (GitHub Pages + raw data branch, pushed every ~4 min by tools/mirror.py) ----
   * When EVERY live origin fails (box paused: Funnel and Cloudflare die together) an /api/* GET is answered from
   * the mirror's JSON snapshot if it is newer than the service worker's cached copy; the banner then says
   * "📦 예비 사본 · N분 전 데이터" and the probe loop keeps trying the live server (recovered() drops mirror mode).
   * On the Pages site itself (window.WINPROB_MIRROR set by the build) the whole app runs read-only on snapshots. */
  const MCFG = Object.assign({site: 'https://dlfmzlspdh764-svg.github.io/seungbu-mirror/',
    data: 'https://raw.githubusercontent.com/dlfmzlspdh764-svg/seungbu-mirror/data/',
    ref: 'https://api.github.com/repos/dlfmzlspdh764-svg/seungbu-mirror/git/ref/heads/data',
    live: 'https://seungbu.taila9a748.ts.net'}, window.WINPROB_MIRROR || {});
  const IS_MIRROR = !!window.WINPROB_MIRROR;
  if (IS_MIRROR) document.documentElement.classList.add('mirror-mode');
  const M = {idx: null, at: 0, inflight: null, bundles: {}, base: '', refOffUntil: 0};
  /* raw.githubusercontent.com caches a BRANCH url for up to 5 min, so the newest data-branch commit is looked up
   * (GitHub API, keyless: 60/h per IP; cached 60 s here, 10 min pause after a 403) and files are read by commit SHA
   * (immutable -> fresh and consistent). If the API is unavailable the branch url is used (≤5 min older). */
  async function mirrorBase() {
    if (MCFG.ref && Date.now() > M.refOffUntil) {
      try {
        const r = await attempt(MCFG.ref, '', {}, 5000);
        if (r.ok) {
          const sha = ((await r.json()).object || {}).sha;
          if (/^[0-9a-f]{40}$/.test(sha || '')) return MCFG.data.replace(/[^/]+\/?$/, '') + sha + '/';
        } else M.refOffUntil = Date.now() + 600000;
      } catch (e) { M.refOffUntil = Date.now() + 120000; }
    }
    return MCFG.data;
  }
  // same rule as tools/mirror.py snap_key(): "/api/proto/list?year=2026&round=117" -> "proto_list__round_117_year_2026"
  function snapKey(pathname, search) {
    let k = pathname.replace(/^\/api\//, '');
    const q = [...new URLSearchParams(search || '')].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    if (q.length) k += '__' + q.map(([a, b]) => a + '=' + b).join('_');
    return k.replace(/[^A-Za-z0-9.-]/g, '_');
  }
  async function mirrorIndex() {
    if (M.idx && Date.now() - M.at < 60000) return M.idx;
    if (M.inflight) return M.inflight;
    M.inflight = (async () => {
      try {
        const base = await mirrorBase();
        const r = await attempt(base, 'snap/index.json', {}, 8000);
        if (r.ok) { const j = await r.json(); if (j && j.files && (!M.idx || j.generated_ms >= M.idx.generated_ms)) { M.idx = j; M.base = base; } M.at = Date.now(); }
      } catch (e) {}
      M.inflight = null;
      return M.idx;
    })();
    return M.inflight;
  }
  const mjson = (obj, status, at) => new Response(JSON.stringify(obj), {status, headers: Object.assign(
    {'Content-Type': 'application/json; charset=utf-8'}, at ? {'X-Mirror-At': at} : {})});
  async function mirrorFile(idx, key) {
    const r = await attempt(M.base || MCFG.data, `snap/${key}.json`, {}, 10000);
    if (!r.ok) throw new Error('mirror ' + r.status);
    return r.text();
  }
  /* -> Response (200 snapshot, or 503 "not in the mirror") | null when the mirror itself is unreachable */
  async function mirrorGet(pathname, search) {
    const idx = await mirrorIndex();
    if (!idx) return null;
    try {
      const pm = /^\/api\/proto\/match\/(\d+)\/(\d+)\/(.+)$/.exec(pathname);
      if (pm) {                                    // match details: one bundle per round
        const bk = `proto_match_bundle__${pm[1]}_${pm[2]}`;
        if (idx.files.includes(bk)) {
          if (!M.bundles[bk] || M.bundles[bk].v !== idx.generated_ms) M.bundles[bk] = {v: idx.generated_ms, d: JSON.parse(await mirrorFile(idx, bk))};
          const d = M.bundles[bk].d[decodeURIComponent(pm[3])];
          if (d) return mjson(d, 200, idx.generated_at);
        }
      } else {
        const key = snapKey(pathname, search);
        if (idx.files.includes(key))
          return new Response(await mirrorFile(idx, key), {status: 200, headers: {'Content-Type': 'application/json; charset=utf-8', 'X-Mirror-At': idx.generated_at}});
      }
    } catch (e) { return null; }
    return mjson({detail: '예비 사본에는 이 데이터가 없습니다 (서버 복구 후 표시)', mirror: true}, 503, idx.generated_at);
  }
  function mirrorBanner(bar) {
    const t = NET.mirrorAt || (M.idx && Date.parse(M.idx.generated_at)) || 0;
    bar.classList.remove('recovered'); bar.classList.add('mirror');
    const a = t ? ago(Date.now() - t) : '…';
    bar.innerHTML = `<div class="ob-l1">📦 예비 사본 · <b>${a === '방금' ? '1분 이내' : a}</b> 데이터</div>` +
      `<div class="ob-l2">${t ? `${kstAt(t)} KST 기준 · ` : ''}${IS_MIRROR
        ? `읽기 전용 · 몇 분마다 자동 갱신 · <a href="${MCFG.live}" style="color:#fff">실시간 앱 열기</a>`
        : `서버가 잠시 멈춰 백업 데이터를 보여드립니다 · ${NET.probing ? '연결 확인 중…' : '서버 재연결 중…'} 연결되면 자동으로 실시간으로 바뀝니다 ` +
          `<button type="button" class="ob-btn" onclick="winprobNet.probeNow()">지금 재시도</button>`}</div>`;
    bar.hidden = false;
  }
  function markMirror(at) {
    const t = Date.parse(at) || 0;
    if (t && (!NET.mirrorAt || t < NET.mirrorAt)) NET.mirrorAt = t;
    if (!IS_MIRROR) markDown(null); else banner();
  }

  function markDown(cachedAt) {
    const c = cachedAt ? Date.parse(cachedAt) : 0;
    if (c && (!NET.dataAt || c < NET.dataAt)) NET.dataAt = c;     // the OLDEST data on screen decides the label
    if (NET.down) { banner(); return; }
    NET.down = true; NET.since = Date.now(); NET.attempt = 0;
    netPill('');
    schedule(0);
    clearInterval(NET.tick); NET.tick = setInterval(banner, 1000);
    banner();
  }
  function markLive() {
    const now = Date.now();
    if (now - NET.lastLiveAt > 5000) { NET.lastLiveAt = now; try { localStorage.setItem(LIVE_KEY, String(now)); } catch (e) {} }
    if (NET.down && !NET.probing) recovered();
  }
  function schedule(ms) {
    clearTimeout(NET.timer);
    const d = ms != null ? ms : PROBE_MS[Math.min(NET.attempt, PROBE_MS.length - 1)] * (0.85 + Math.random() * 0.3);
    NET.nextAt = Date.now() + d;
    NET.timer = setTimeout(probe, d);
  }
  async function probe() {
    if (!NET.down || NET.probing) return;
    NET.probing = true; NET.attempt++; banner();
    let won = null;
    try {
      won = await Promise.any(order().map(o => attempt(o, '/api/health?probe=' + Date.now(), {cache: 'no-store'}, 7000).then(r => {
        if (!r.ok || r.headers.get('X-SW-Offline') === '1') throw new Error('bad');
        return o;
      })));
    } catch (e) { won = null; }
    NET.probing = false;
    if (won) { servedBy(won); await refreshCfg(); recovered(); }
    else schedule();
    banner();
  }
  async function recovered() {
    const was = NET.since;
    NET.down = false; NET.dataAt = 0; NET.attempt = 0; NET.mirrorAt = 0;
    clearTimeout(NET.timer); clearInterval(NET.tick);
    try {                                           // drop every stale cached API response
      if (window.caches) for (const k of await caches.keys()) if (k.startsWith('winprob-api-')) await caches.delete(k);
    } catch (e) {}
    const bar = document.getElementById('offlineBar');
    if (bar) {
      bar.classList.add('recovered'); bar.hidden = false;
      bar.innerHTML = `<div class="ob-l1">✅ 서버 재연결 — 최신 데이터로 새로고침했습니다</div>`;
      setTimeout(() => { if (!NET.down) bar.hidden = true; }, 4000);
    }
    try { if (typeof window.winprobRefreshAll === 'function') window.winprobRefreshAll(); } catch (e) {}
    try { const reg = await navigator.serviceWorker?.getRegistration('/'); reg && reg.update(); } catch (e) {}
    window.dispatchEvent(new CustomEvent('winprob:reconnected', {detail: {downMs: Date.now() - was}}));
  }

  /* ---- resilient /api/* GETs: failover between the public origins ----
   * /api/netcfg lists the public origins (primary = permanent Tailscale Funnel URL, fallback = Cloudflare quick
   * tunnel) + primary_status from the watchdog's per-ingress-IP probe. CORS is allowed for them. A response counts
   * as failed on a network error, a timeout, any 5xx (Cloudflare 530 included) or a SW cache replay (X-SW-Offline).
   * Then the next origin is tried at once (and a slow origin is hedged, see hedged()). While the primary is flaky (primary_status flaky/down) the fallback goes
   * first. While "down", requests make ONE quick pass (short timeouts) and return the cached copy right away;
   * the probe loop above takes care of reconnecting. The netcfg (incl. the fallback URL) stays in localStorage. */
  const HERE = location.origin, CFG_KEY = 'winprob.netcfg', PREF_KEY = 'winprob.prefOrigin';
  const TIMEOUT_MS = 15000, DOWN_TIMEOUT_MS = 6000, BACKOFF_MS = [0, 1500, 4000], PREF_TTL_MS = 120000;
  let cfg = null;
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) {}
  try { sessionStorage.removeItem('wpRetry'); } catch (e) {}
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const host = o => { try { return new URL(o).host; } catch (e) { return o; } };
  function origins() {
    const list = [HERE];
    for (const o of (cfg && cfg.origins) || []) if (o && !list.includes(o)) list.push(o);
    return list;
  }
  function preferred() {
    try {
      const p = JSON.parse(sessionStorage.getItem(PREF_KEY) || 'null');
      if (p && Date.now() - p.t < PREF_TTL_MS && origins().includes(p.o)) return p.o;
    } catch (e) {}
    // primary flaky (e.g. one Funnel ingress IP refusing TLS): use the fallback first
    if (cfg && cfg.fallback && cfg.primary === HERE && ['flaky', 'down'].includes(cfg.primary_status) && origins().includes(cfg.fallback)) return cfg.fallback;
    return null;
  }
  function order() { const l = origins(), p = preferred(); return p ? [p, ...l.filter(o => o !== p)] : l; }
  function netPill(text) {
    let el = document.getElementById('netStatus');
    if (!el && text) {
      el = document.createElement('div');
      el.id = 'netStatus'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(64px + env(safe-area-inset-bottom));' +
        'z-index:9999;background:#23304a;color:#e8edf5;border:1px solid #3a4b6b;border-radius:14px;padding:4px 12px;' +
        'font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.4);pointer-events:none;max-width:92vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      (document.body || document.documentElement).appendChild(el);
    }
    if (!el) return;
    el.hidden = !text;
    if (text) el.textContent = text;
  }
  function servedBy(o) {
    if (o === HERE) { try { sessionStorage.removeItem(PREF_KEY); } catch (e) {} netPill(''); }
    else {
      try { sessionStorage.setItem(PREF_KEY, JSON.stringify({o, t: Date.now()})); } catch (e) {}
      netPill(`↪ 우회 연결 중 · ${host(o)}`);
    }
  }
  const failed = r => r.status >= 500 || r.headers.get('X-SW-Offline') === '1';
  async function attempt(origin, path, init, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || (NET.down ? DOWN_TIMEOUT_MS : TIMEOUT_MS));
    const ext = init && init.signal;
    if (ext) { if (ext.aborted) ctl.abort(); else ext.addEventListener('abort', () => ctl.abort(), {once: true}); }
    const opts = Object.assign({}, init, {signal: ctl.signal});
    if (origin !== HERE) Object.assign(opts, {mode: 'cors', credentials: 'omit', cache: 'no-store'});
    try { return await origFetch(origin === HERE ? path : origin + path, opts); }
    finally { clearTimeout(timer); }
  }
  /* Hedged request: the first origin goes at once; if it has not answered after HEDGE_MS (1.5 s while the primary
   * is known flaky/down or something failed in the last 2 min, else 4 s) - or as soon as it fails - the next origin
   * is tried IN PARALLEL and the first good answer wins (the loser is aborted). A Funnel outage (TLS hang, HTTP 000)
   * therefore costs ~1.5-4 s instead of the full 15 s timeout before the Cloudflare fallback answers. GET only. */
  let lastFailAt = 0;
  const hedgeMs = () => (Date.now() - lastFailAt < 120000 || (cfg && ['flaky', 'down'].includes(cfg.primary_status))) ? 1500 : 4000;
  function hedged(list, path, init) {
    return new Promise(resolve => {
      let next = 0, running = 0, done = false, cached = null, timer = 0;
      const ctls = new Map(), ext = init && init.signal, wait = hedgeMs();
      const finish = (r, o) => {
        if (done) return;
        done = true; clearTimeout(timer);
        for (const [oo, c] of ctls) if (oo !== o) c.abort();
        resolve({r, o, cached});
      };
      const launch = () => {
        clearTimeout(timer);
        if (done) return;
        const stop = next >= list.length || (ext && ext.aborted) || (next > 0 && navigator.onLine === false);
        if (stop) { if (!running) finish(null, null); return; }
        const o = list[next++]; running++;
        const c = new AbortController(); ctls.set(o, c);
        if (ext) ext.addEventListener('abort', () => c.abort(), {once: true});
        attempt(o, path, Object.assign({}, init, {signal: c.signal})).then(r => {
          running--;
          if (!failed(r)) return finish(r, o);
          lastFailAt = Date.now();
          if (r.headers.get('X-SW-Offline') === '1' && r.ok && !cached) cached = r;
          launch();
        }, () => { running--; if (!done) lastFailAt = Date.now(); launch(); });
        if (next < list.length) timer = setTimeout(launch, wait);
      };
      launch();
    });
  }
  async function resilientGet(path, init) {
    let cached = null;
    const rounds = NET.down ? 1 : BACKOFF_MS.length;
    for (let round = 0; round < rounds; round++) {
      if (round && navigator.onLine === false) break;      // device offline: no point retrying, use the cache now
      if (BACKOFF_MS[round]) {
        netPill(`🔄 연결 재시도/우회 중… (${round}/${BACKOFF_MS.length - 1})`);
        await sleep(BACKOFF_MS[round] * (0.8 + Math.random() * 0.4));
      }
      const h = await hedged(order(), path, init);
      if (h.r) { servedBy(h.o); return h.r; }
      if (h.cached && !cached) cached = h.cached;
      if (init && init.signal && init.signal.aborted) throw new DOMException('요청이 취소되었습니다', 'AbortError');
      if (cached && NET.down) break;
    }
    netPill('');
    if (cached) return cached;
    throw new TypeError('모든 서버 주소에 연결하지 못했습니다');
  }
  async function refreshCfg() {
    for (const o of order()) {
      try {
        const r = await attempt(o, '/api/netcfg', {cache: 'no-store'}, 8000);
        if (r.ok && r.headers.get('X-SW-Offline') !== '1') {
          const c = await r.json();
          if (c && c.mirror) Object.assign(MCFG, c.mirror);
          if (c && Array.isArray(c.origins) && c.origins.length) { cfg = c; try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {} }
          return;
        }
      } catch (e) {}
    }
  }
  if (cfg && cfg.mirror && !IS_MIRROR) Object.assign(MCFG, cfg.mirror);
  if (!IS_MIRROR) { refreshCfg(); setInterval(refreshCfg, 5 * 60 * 1000); }
  window.winprobNet = {origins, order, refreshCfg, probeNow: () => { if (IS_MIRROR) return; if (NET.down) { schedule(0); } else probe(); },
                       state: NET, get cfg() { return cfg; }, _markDown: markDown,
                       mirror: {cfg: MCFG, snapKey, get: mirrorGet, index: mirrorIndex, isMirror: IS_MIRROR}};

  window.fetch = async function (input, init) {
    let u = null;
    try { u = new URL(typeof input === 'string' ? input : input.url, location.href); } catch (e) {}
    const method = ((init && init.method) || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const isApi = !!u && u.origin === HERE && u.pathname.startsWith('/api/');
    if (IS_MIRROR && isApi) {                     // GitHub Pages copy: read-only, snapshots only
      if (method !== 'GET') return mjson({detail: '예비 사본(읽기 전용)에서는 사용할 수 없습니다. 실시간 앱에서 이용해 주세요.', mirror: true}, 503);
      const r = await mirrorGet(u.pathname, u.search);
      if (r) { const at = r.headers.get('X-Mirror-At'); if (at) markMirror(at); return r; }
      throw new TypeError('예비 사본에 연결하지 못했습니다');
    }
    if (!isApi || method !== 'GET' || u.pathname === '/api/netcfg') return origFetch(input, init);
    const aborted = () => !!(init && init.signal && init.signal.aborted);
    try {
      const r = await resilientGet(u.pathname + u.search, typeof input === 'string' ? init : Object.assign({headers: input.headers}, init));
      if (r.headers.get('X-SW-Offline') === '1') {
        // live origins all failed and this is the SW's cached copy: prefer the mirror if its snapshot is newer
        const cachedAt = Date.parse(r.headers.get('X-SW-Cached-At') || '') || 0;
        const m = aborted() ? null : await mirrorGet(u.pathname, u.search).catch(() => null);
        if (m && m.ok && (Date.parse(m.headers.get('X-Mirror-At')) || 0) > cachedAt) { markMirror(m.headers.get('X-Mirror-At')); return m; }
        markDown(r.headers.get('X-SW-Cached-At'));
      } else markLive();
      return r;
    } catch (e) {
      if (aborted()) throw e;
      const m = await mirrorGet(u.pathname, u.search).catch(() => null);
      if (m && m.ok) { markMirror(m.headers.get('X-Mirror-At')); return m; }
      markDown(null);
      throw e;
    }
  };
  if (IS_MIRROR) { setInterval(banner, 30000); document.addEventListener('DOMContentLoaded', banner); }
  else {
  window.addEventListener('offline', () => markDown(null));
  window.addEventListener('online', () => { if (NET.down) schedule(0); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (NET.down) schedule(0);
    // reopened after a long pause (phone asleep / app in background): refresh everything at once
    else if (Date.now() - NET.lastLiveAt > 120000 && typeof window.winprobRefreshAll === 'function') window.winprobRefreshAll();
  });

  /* ---- service worker ---- */
  if ('serviceWorker' in navigator && !IS_MIRROR) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'}).then(reg => {
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      }).catch(e => console.warn('SW registration failed', e));
    });
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // a new SW version took over (skipWaiting + clients.claim): reload once so this page runs the new code too
      if (!hadController) return;
      try { if (sessionStorage.getItem('wpSwReload')) return; sessionStorage.setItem('wpSwReload', '1'); } catch (e) { return; }
      location.reload();
    });
  }

  /* ---- install button / iOS hint ---- */
  function btn() { return document.getElementById('installBtn'); }
  function showBtn(on) { const b = btn(); if (b) b.hidden = !on || isStandalone(); }
  function hint(on) {
    const h = document.getElementById('iosHint');
    if (!h) return;
    h.hidden = !on || isStandalone();
    clearTimeout(hintTimer);
    if (on) { try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {} }
  }
  function guideText() {
    const t = document.getElementById('iosHintText');
    if (!t) return;
    const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);
    if (inApp) t.innerHTML = '지금은 앱 안의 브라우저라 설치가 안 됩니다. 오른쪽 위 메뉴에서 <b>‘다른 브라우저로 열기’</b>(아이폰은 Safari, 안드로이드는 Chrome)를 누른 뒤 다시 <b>📲 앱 설치</b>를 눌러 주세요.';
    else if (isIOS && !/Safari/i.test(ua) || isIOS && /CriOS|FxiOS|EdgiOS/i.test(ua)) t.innerHTML = '아이폰은 <b>Safari</b>에서만 설치됩니다. 이 주소를 Safari로 연 뒤 <span class="shr">공유 ⬆︎</span> → <b>‘홈 화면에 추가’</b>를 눌러 주세요.';
    else if (isIOS) t.innerHTML = 'Safari 아래(또는 위)의 <span class="shr">공유 ⬆︎</span> 버튼을 누른 뒤 <b>‘홈 화면에 추가’</b>를 선택하세요.';
    else if (/SamsungBrowser/i.test(ua)) t.innerHTML = '아래쪽 <b>≡ 메뉴</b> → <b>‘현재 페이지 추가’ → ‘홈 화면’</b>을 누르세요. (이미 설치했다면 홈 화면의 ‘승부 예측’ 아이콘으로 여세요.)';
    else t.innerHTML = 'Chrome 오른쪽 위 <b>⋮ 메뉴</b> → <b>‘앱 설치’</b> 또는 <b>‘홈 화면에 추가’</b>를 누르세요. (이미 설치했다면 홈 화면의 ‘승부 예측’ 아이콘으로 여세요.)';
  }
  window.showIosHint = () => { guideText(); hint(true); };
  window.isStandalonePWA = isStandalone;
  window.isIOSDevice = isIOS;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    showBtn(true);
  });
  window.addEventListener('appinstalled', () => {
    deferred = null; showBtn(false); hint(false);
    if (typeof toast === 'function') toast('✅ 홈 화면에 설치되었습니다');
  });
  document.addEventListener('DOMContentLoaded', () => {
    const b = btn();
    if (b) b.addEventListener('click', async () => {
      if (deferred) {
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => null);
        deferred = null;
        if (!choice || choice.outcome !== 'accepted') showBtn(false);
      } else {
        guideText();
        hint(true);
      }
    });
    const close = document.getElementById('iosHintClose');
    if (close) close.addEventListener('click', () => hint(false));
    if (isStandalone()) return;
    showBtn(true);                            // always visible until installed; click shows prompt or a guide
    if (isIOS) {
      showBtn(true);                          // on iOS the button re-opens the hint
      let shown = false;
      try { shown = localStorage.getItem(HINT_KEY) === '1'; } catch (e) {}
      if (!shown) setTimeout(() => { hint(true); hintTimer = setTimeout(() => hint(false), 15000); }, 1200);
    }
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', ev => {
    document.documentElement.classList.toggle('standalone', ev.matches);
    if (ev.matches) { showBtn(false); hint(false); }
  });
})();
