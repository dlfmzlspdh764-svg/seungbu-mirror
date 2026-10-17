/* 🏠 홈 = 실시간 경기 스코어 (2026-10-12): every sport from /api/games (ESPN · Naver, the same 30 s poll as the sport tabs).
 * 진행 중 first (score + period/minute, pulsing dot), then today's 예정 (kickoff) and 최근 종료 (final score, last 18 h).
 * Sport chips filter (전체 default); the top category chips still open the full per-sport views. */
const LIVE = {sp: 'all', pm: null, pmT: 0};
const LIVE_SP = {soccer: '⚽ 축구', baseball: '⚾ 야구', basketball: '🏀 농구', hockey: '🏒 아이스하키', volleyball: '🏐 배구'};
const LG_ORDER = {kbl: 0, wkbl: 1, nba: 2, wnba: 3};
function liveKstDay(t) { return new Date(t + 9 * 3600e3).toISOString().slice(0, 10); }
/* 24live-style compact row: time/status | teams (home on top) | per-set scores | bold total. */
function liveRow(g) {
  const st = g.state, hs = g.home.score, as = g.away.score, sc = st === 'in' || st === 'post';
  const win = s => st === 'post' && (s === 'home' ? hs > as : as > hs) ? ' w' : '';
  const tm = (g.start_kst || '').split(' ')[1] || '';
  const stt = st === 'in' ? `<i class="lv-dot"></i><span>${esc((g.status_text || 'LIVE').split(' · ')[0])}</span>`
    : st === 'post' ? '<span>종료</span>' : st === 'cancel' ? `<span>${esc(g.status_text || '취소')}</span>` : `<span>${esc(tm)}</span>`;
  const sets = Array.isArray(g.sets) && g.sets.length ? g.sets : null;
  const per = i => sets ? `<span class="lv-ps">${sets.map(x => `<i>${esc(x[i])}</i>`).join('')}</span>` : '';
  const line = (side, i) => `<div class="lv-tm"><span class="lv-n${win(side)}" title="${esc(g[side].en || g[side].name || '')}">${esc(g[side].name)}</span>${per(i)}<b class="lv-s">${sc ? esc(g[side].score) : '-'}</b></div>`;
  return `<li class="lv-it ${st === 'in' ? 'live' : st === 'post' ? 'done' : ''}"><div class="lv-t">${stt}</div><div class="lv-l">${line('home', 0)}${line('away', 1)}</div>${liveOuHtml(g)}</li>`;
}
/* 프로토 승부식 언더/오버 (2026-10-15): basketball = home+away score, volleyball = sum of all set points (Proto "합 N").
 * Live game ↔ Proto match: same sport, kickoff within 30 min, best Korean-name bigram overlap (both sides). */
function liveBig(s) { s = String(s || '').replace(/\s/g, ''); const o = new Set(); for (let i = 0; i < s.length - 1; i++) o.add(s.slice(i, i + 2)); return o; }
function liveSim(a, b) { const A = liveBig(a), B = liveBig(b); let n = 0; A.forEach(x => { if (B.has(x)) n++; }); return n; }
function liveProtoOf(g) {
  const ms = LIVE.pm; if (!ms || (g._sp !== 'basketball' && g._sp !== 'volleyball')) return null;
  let best = null, bs = 0;
  for (const m of ms) {
    if (m.sport !== g._sp || Math.abs(Date.parse(m.kickoff) - g._t) > 30 * 60e3) continue;
    const h = liveSim(m.home, g.home.ko || g.home.name), a = liveSim(m.away, g.away.ko || g.away.name);
    if (h && a && h + a > bs) { bs = h + a; best = m; }
  }
  return best;
}
function liveTotal(g) {
  if (g._sp === 'volleyball') { const s = Array.isArray(g.sets) ? g.sets : []; return s.length ? s.reduce((t, x) => t + (+x[0] || 0) + (+x[1] || 0), 0) : null; }
  const h = +g.home.score, a = +g.away.score; return Number.isFinite(h) && Number.isFinite(a) ? h + a : null;
}
function liveOuHtml(g) {
  const m = liveProtoOf(g); if (!m) return '';
  const bs = (m.bets || []).filter(b => b.bet_type === '언더/오버' && !b.half && b.line > 0);
  if (!bs.length) return '';
  const t = (g.state === 'in' || g.state === 'post') ? liveTotal(g) : null;
  return `<div class="lv-ou">${bs.map(b => {
    let tag = '';
    if (g.state === 'post' && (b.result === '오버' || b.result === '언더' || t != null)) {
      const r = b.result === '오버' || b.result === '언더' ? b.result : (t > b.line ? '오버' : '언더');
      tag = `<span class="ou-b ${r === '오버' ? 'ov' : 'un'} fin">${r} 결과</span>`;
    } else if (g.state === 'in' && t != null) tag = `<span class="ou-b ${t > b.line ? 'ov' : 'un'}">${t > b.line ? '오버' : '언더'} 진행</span>`;
    return `<div class="ou-r"><span class="ou-l">U/O ${esc(String(b.line))}</span>${t != null ? `<b class="ou-t">${t}</b>` : ''}${tag}</div>`;
  }).join('')}</div>`;
}
function liveProtoLoad() {
  const pd = typeof PROTO !== 'undefined' && PROTO.data && PROTO.data.round && PROTO.follow !== false ? PROTO.data.round.matches : null;
  if (pd && !LIVE.pm) LIVE.pm = pd;
  if (Date.now() - LIVE.pmT < 60e3) return;
  LIVE.pmT = Date.now();
  fetch('/api/proto/list').then(r => r.ok ? r.json() : null).then(d => {
    const ms = d && d.round && d.round.matches; if (ms) { LIVE.pm = ms; liveRender(); }
  }).catch(() => {});
}
function liveGroups(list, ord) {
  const by = new Map();
  list.sort(ord).forEach(g => { const k = g._sp + '|' + g.league_name; if (!by.has(k)) by.set(k, []); by.get(k).push(g); });
  return [...by.entries()].map(([k, gs]) => `<div class="lv-grp"><div class="lv-gh">${esc(LIVE_SP[gs[0]._sp].split(' ')[0])} <b>${esc(gs[0].league_name)}</b><span>${gs.length}</span></div><ul class="lv-list">${gs.map(liveRow).join('')}</ul></div>`).join('');
}
function liveRender() {
  const v = document.getElementById('liveView');
  if (!v || sport !== 'live') return;
  if (!data) { if (!v.innerHTML.trim()) v.innerHTML = skeleton(3); return; }
  liveProtoLoad();
  const now = Date.now(), today = liveKstDay(now);
  const all = [];
  for (const sp of SPORT_TABS) for (const g of (data.games[sp] || [])) all.push(Object.assign({_sp: sp, _t: Date.parse(g.start_utc) || 0}, g));
  const pick = all.filter(g => g.state === 'in' || (g.state === 'pre' && liveKstDay(g._t) === today && g._t >= now - 3 * 3600e3)
    || (g.state === 'post' && now - g._t < 18 * 3600e3) || (g.state === 'cancel' && liveKstDay(g._t) === today));
  const counts = {}; pick.forEach(g => counts[g._sp] = (counts[g._sp] || 0) + 1);
  const chips = ['all', ...SPORT_TABS.filter(s => counts[s])].map(s => `<button type="button" class="chip ${LIVE.sp === s ? 'active' : ''}" data-ls="${s}" aria-pressed="${LIVE.sp === s}">${s === 'all' ? '전체' : LIVE_SP[s]} (${s === 'all' ? pick.length : counts[s]})</button>`).join('');
  const gs = pick.filter(g => LIVE.sp === 'all' || g._sp === LIVE.sp);
  const ord = (a, b) => SPORT_TABS.indexOf(a._sp) - SPORT_TABS.indexOf(b._sp) || (LG_ORDER[a.league] ?? 9) - (LG_ORDER[b.league] ?? 9) || a._t - b._t;
  const sec = (title, list, empty) => `<h2>${title} <span class="muted">${list.length}경기</span></h2>` +
    (list.length ? liveGroups(list, ord) : `<div class="empty">${empty}</div>`);
  const ended = gs.filter(g => g.state === 'post').sort((a, b) => b._t - a._t);
  v.innerHTML = `<div class="card"><h2 style="margin:0">🏠 실시간 경기 스코어 <span class="muted" style="font-size:12px">· 30초마다 자동 갱신 · 축구·야구·농구·아이스하키·배구</span></h2>
    <div class="chips lv-chips">${chips}</div></div>` +
    sec('<i class="lv-dot"></i> 진행 중', gs.filter(g => g.state === 'in'), '지금 진행 중인 경기가 없습니다.') +
    sec('🕒 오늘 예정', gs.filter(g => g.state === 'pre' || g.state === 'cancel'), '오늘 남은 경기가 없습니다.') +
    `<h2>✅ 최근 종료 <span class="muted">${ended.length}경기</span></h2>` +
    (ended.length ? liveGroups(ended, (a, b) => ord(a, b) || b._t - a._t) : '<div class="empty">최근 종료된 경기가 없습니다.</div>');
  v.querySelectorAll('[data-ls]').forEach(c => c.onclick = () => { LIVE.sp = c.dataset.ls; liveRender(); });
  if (typeof setFresh === 'function') setFresh('games', data.updated_at);
}
function liveLoad() { liveRender(); }
