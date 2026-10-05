/* 프로토 승부식 tab */
const PROTO = {data: null, sel: null, follow: true, sport: 'all', status: '자동', onlyApp: false, onlyFlag: false, lastCurrent: null, banner: null, doneOpen: false, openKeys: new Set(),
  detail: {}, error: null};
const ppct = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
const kst = iso => iso ? new Date(iso).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}) : '–';
const SRC_NAME = {app: '앱 모델+시장', dk: 'DraftKings', rating: '순위/랭킹+시장', rating_only: '순위/랭킹(배당 전)', market: '배당 기반', none: '계산 불가'};
const ST_CLS = {'발매중': 'st-on', '마감': 'st-off', '진행중': 'st-live', '결과': 'st-done', '취소': 'st-off', '연기': 'st-off'};

function toast(msg, ms = 7000) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast hide'; if (t.setAttribute) t.setAttribute('role', 'status'); document.body.appendChild(t);
            if (t.addEventListener) t.addEventListener('click', () => t.classList.add('hide')); }
  t.textContent = msg; t.classList.remove('hide');
  clearTimeout(toast._h); toast._h = setTimeout(() => t.classList.add('hide'), ms);
}

/* 홀/짝 · 전반 bet types: never analysed — one collapsed line, no odds, no picks, not addable to the combo. */
function exclHtml(ex) {
  if (!ex || !ex.length) return '';
  const names = [...new Set(ex.map(x => x.label))];
  return `<details class="pexcl"><summary class="muted sm">⊘ 분석 제외 ${ex.length}항목 (${esc(names.join(' · '))})</summary>
    <div class="muted sm">${ex.map(x => `${x.game_no} ${esc(x.label)}${x.line != null ? ' ' + x.line : ''}`).join(' · ')}<br>홀/짝·전반 유형은 확률·추천·역배·시뮬레이션·알림·채점에서 제외됩니다.</div></details>`;
}

/* Returns the new round number if the current round changed since the last check (null otherwise). */
function detectRoundChange(prev, cur) {
  if (!prev || !cur || prev === cur) return null;
  return cur.split('-')[1];
}

/* 배당 발표 대기: a 발매중 match none of whose analysed bets has Proto odds yet (the server re-polls every ~2 min). */
const oddsPending = m => !!m && m.status === '발매중' && (m.bets || []).length > 0 && m.bets.every(b => !(b.odds || []).some(o => o != null));
/* Matches of the same round that were waiting for odds in `prev` and now have a 1순위 (jr.main) in `cur` (for a toast). */
function announcedMains(prev, cur) {
  if (!prev || !cur || prev.year !== cur.year || prev.round !== cur.round) return [];
  const was = new Set(prev.matches.filter(m => oddsPending(m) || !pickJr(m, 'main')).map(m => m.key));
  return cur.matches.filter(m => was.has(m.key) && m.status === '발매중' && pickJr(m, 'main')).map(m => `${m.home} vs ${m.away}`);
}
/* Live record of the card marks (📊 예측 성적, /api/marks/record) for the legend tooltip — refreshed every 10 min. */
async function markRecLoad() {
  if (PROTO.markRecAt && Date.now() - PROTO.markRecAt < 600000) return;
  PROTO.markRecAt = Date.now();
  try { PROTO.markRec = (await fetch('/api/marks/record').then(r => r.json())).marks || null; } catch (e) { /* tooltip without numbers */ }
}
function markRecText(k) {
  const a = PROTO.markRec && PROTO.markRec[k] && PROTO.markRec[k].summary;
  return a && a.n ? `적중 ${a.hits} · 미적중 ${a.misses} · 적중률 ${Math.round(a.hit_rate * 100)}%` : '채점된 경기 없음';
}

/* Slim round list (card fields only; analysis + odds history are fetched per match when a panel is opened). */
async function protoLoad() {
  const url = (!PROTO.follow && PROTO.sel) ? `/api/proto/list?year=${PROTO.sel[0]}&round=${PROTO.sel[1]}` : '/api/proto/list';
  try {
    const [d, rr] = await Promise.all([fetch(url).then(r => { if (r.ok === false && r.status !== 304) throw new Error('HTTP ' + r.status); return r.json(); }),
                                       fetch('/api/proto/rounds').then(r => r.json()).catch(() => ({rounds: PROTO.rounds || []}))]);
    const cur = d.current ? d.current.join('-') : null;
    const nr = detectRoundChange(PROTO.lastCurrent, cur);
    if (nr) {
      PROTO.banner = `🆕 새 회차 감지: ${PROTO.lastCurrent.split('-')[1]}회차 → ${nr}회차${PROTO.follow ? ' (자동 전환됨)' : ''}`;
      toast(`새 회차 ${nr}회차 발매 시작`);
      if (PROTO.follow) { PROTO.status = '자동'; PROTO.openKeys.clear(); }
    }
    PROTO.lastCurrent = cur;
    const R0 = PROTO.data && PROTO.data.round, R1 = d.round;
    if (R0 && R1 && (R0.year !== R1.year || R0.round !== R1.round)) PROTO.detail = {};
    const newMain = announcedMains(PROTO.data && PROTO.data.round, d.round);
    PROTO.data = d; PROTO.rounds = rr.rounds || []; PROTO.error = null;
    markRecLoad().then(() => { if (PROTO.markRec && !PROTO._recShown) { PROTO._recShown = true; protoRenderSoon(); } });
    if (newMain.length) toast(`💱 배당 발표 → 1순위 반영: ${newMain.slice(0, 3).join(', ')}${newMain.length > 3 ? ` 외 ${newMain.length - 3}경기` : ''}`);
    if (typeof setFresh === 'function' && typeof sport !== 'undefined' && sport === 'proto') setFresh('proto', d.last_poll);
    protoRender();
  } catch (e) {
    PROTO.error = String(e.message || e);
    const v = document.getElementById('protoView');
    if (!PROTO.data) v.innerHTML = `<div class="errbox" role="alert">⚠️ 프로토 데이터 불러오기 실패: ${esc(PROTO.error)}<br><button type="button" class="btn sm" onclick="protoLoad()">다시 시도</button></div>`;
  }
}
let _protoRaf = 0;
function protoRenderSoon() {           // coalesce bursts (live refresh + filter taps) into one render per frame
  if (typeof requestAnimationFrame !== 'function') return protoRender();
  if (_protoRaf) return;
  _protoRaf = requestAnimationFrame(() => { _protoRaf = 0; protoRender(); });
}

/* 30-second live refresh: status, live/final score, section order (compact endpoint). */
async function protoLive() {
  const R = PROTO.data && PROTO.data.round;
  if (!R) return;
  try {
    const d = await fetch(`/api/proto/live?year=${R.year}&round=${R.round}`).then(r => r.json());
    const cur = d.current ? d.current.join('-') : null;
    if (PROTO.follow && detectRoundChange(PROTO.lastCurrent, cur)) return protoLoad();
    const sig = JSON.stringify([d.sections, d.status_counts, d.last_poll, Object.values(d.matches || {}).map(m => [m.status, (m.live || {}).score, (m.live || {}).detail])]);
    if (sig === PROTO.liveSig) return;       // nothing changed → no re-render
    PROTO.liveSig = sig;
    mergeLive(R, d);
    protoRenderSoon();
  } catch (e) { /* keep the last view; next tick retries */ }
}

function mergeLive(R, d) {
  for (const m of R.matches) {
    const u = (d.matches || {})[m.key];
    if (!u) continue;
    m.status = u.status; m.live = u.live;
    for (const b of m.bets) {
      const x = (u.bets || {})[b.game_no];
      if (x) [b.status, b.result, b.score, b.winner_idx] = x;
    }
  }
  if (d.sections) R.sections = d.sections;
  if (d.status_counts) R.status_counts = d.status_counts;
  if (d.live_coverage) R.live_coverage = d.live_coverage;
}

function liveHtml(m) {
  const L = m.live || {};
  const t = L.as_of ? ` · ${kst(L.as_of).slice(-5)} 기준` : '';
  if (L.state === 'in') return `<div class="live in"><span class="dot">● LIVE</span><span class="sc">${esc((L.score || '').replace(':', ' : '))}</span><span class="det">${esc(L.detail || '')}</span><span class="src">${esc(L.source || '')}${t}</span></div>`;
  if (L.state === 'post') return `<div class="live post"><span>종료</span><span class="sc">${esc((L.score || '').replace(':', ' : '))}</span><span class="src">${esc(L.source || '')}</span></div>`;
  if (L.state === 'cancel') return `<div class="live none">경기 ${esc(L.detail || '취소')}</div>`;
  if (L.state === 'none') return `<div class="live none">실시간 스코어 없음</div>`;
  return '';
}

/* Two marks per match (user choice 2026-10-04), each at most ONE cell:
 *  (A) ★유력      pickLikely(m)      — the single most likely cell (highest 추정 est.p) at ANY odds — NOT drawn since 2026-10-05
 *  (B) ★주력 1.75+ pickMain175(m, R)  — OLD (ended 2026-10-04, history only as "(구)"; no longer drawn on cards)
 *      A ✅검증 cell (window.BEST_CELLS, app/best_picks.py) is preferred; an optional server field m.score_main
 *      ({game_no, idx}, e.g. a scoreline model) overrides the selection when it points at an eligible cell.
 *      Server counterpart for the push: app/notify.py pick_main175().
 * Eligible cells: analysed bet with real odds and a probability; never 취소/연기, 전반, 미발표 (홀/짝 is not in m.bets).
 * mainPicks(m, R) keeps the old shape for (B): {} or {game_no: {idx, strong: true[, best: true][, score: true]}}. */
const MAIN_SKIP = new Set(['취소', '연기']);
const MAIN_MIN_ODDS = 1.75;          // user rule (2026-10-04): ★주력 only on cells with Proto odds ≥ 1.75 (same in app/notify.py)
function cellOk(b, i, minOdds) {
  return !!(b && !b.half && !MAIN_SKIP.has(b.status) && b.labels && b.labels[i] && b.labels[i] !== '-'
    && b.odds && b.odds[i] != null && b.odds[i] > 1 && b.odds[i] >= (minOdds || 0) - 1e-9 && b.est && b.est.p && b.est.p[i] != null);
}
function topCell(m, minOdds, pref) {
  let top = null;
  for (const b of (m && m.bets) || []) for (const i of [0, 1, 2]) {
    if (!cellOk(b, i, minOdds)) continue;
    const c = {b, i, p: b.est.p[i], v: !!(pref && pref(b, i))};
    if (!top || (c.v && !top.v) || (c.v === top.v && c.p > top.p)) top = c;   // preferred first, then highest probability
  }
  return top;
}
/* (A) ★유력 → {game_no, idx, p} | null */
function pickLikely(m) {
  const t = topCell(m, 0, null);
  return t ? {game_no: t.b.game_no, idx: t.i, p: t.p} : null;
}
/* (B) ★주력 1.75+ → {game_no, idx, p[, best][, score]} | null */
function pickMain175(m, yr) {
  if (!m || !m.bets) return null;
  const sm = m.score_main;
  if (sm && sm.game_no != null && sm.idx != null) {
    const b = m.bets.find(x => x.game_no === sm.game_no);
    if (cellOk(b, sm.idx, MAIN_MIN_ODDS)) return {game_no: b.game_no, idx: sm.idx, p: b.est.p[sm.idx], score: true};
  }
  const BC = typeof window !== 'undefined' ? window.BEST_CELLS : (typeof BEST_CELLS !== 'undefined' ? BEST_CELLS : null);
  const RR = yr || (PROTO.data && PROTO.data.round);
  const isBest = (b, i) => !!(BC && BC.size && RR && BC.has(`${RR.year}-${RR.round}-${b.game_no}:${i}`));
  const t = topCell(m, MAIN_MIN_ODDS, isBest);
  return t ? Object.assign({game_no: t.b.game_no, idx: t.i, p: t.p}, t.v ? {best: true} : {}) : null;
}
function mainPicks(m, yr) {
  const t = pickMain175(m, yr);
  if (!t) return {};
  return {[t.game_no]: Object.assign({idx: t.idx, strong: true}, t.best ? {best: true} : {}, t.score ? {score: true} : {})};
}
/* 1순위 / 2순위 (formerly ★주력 / ☆부주력, visible labels renamed 2026-10-05; user correction 2026-10-04 evening): ALWAYS two analysis-based picks per match, chosen by the server's
 * composite score (app/edge.analyse_jr: model probability + value vs the margin-free price + market flow − traps,
 * 2.5+ penalised unless the overseas market agrees). Never by the lowest odds, never left empty while odds exist.
 * The old ★주력 1.75+ (pickMain175) is no longer drawn on the cards; its history stays in 📊 예측 성적 as (구). */
function pickJr(m, kind) {
  const pk = m && m.jr && m.jr[kind];
  if (!pk || pk.game_no == null) return null;
  const b = (m.bets || []).find(x => x.game_no === pk.game_no);
  if (!b || MAIN_SKIP.has(b.status) || !b.odds || b.odds[pk.idx] == null) return null;
  return Object.assign({}, pk, {b});
}
/* Marks per bet row: {game_no: {jmain?: {idx}, jsub?: {idx}, psych?: {idx}}}. ★유력 is no longer drawn (user 2026-10-05:
 * 1순위 is now itself the highest-probability cell, so the separate ★유력 badge next to 1순위/2순위 is removed). */
function cellMarks(m, yr) {
  const out = {}, jm = pickJr(m, 'main'), js = pickJr(m, 'sub');
  if (jm) (out[jm.game_no] = out[jm.game_no] || {}).jmain = {idx: jm.idx};
  if (js) (out[js.game_no] = out[js.game_no] || {}).jsub = {idx: js.idx};
  const ps = m && m.psych && m.psych.pick;     // 🧠 only when a validated psychology signal fires (app/psych.py)
  if (ps && ps.game_no != null) (out[ps.game_no] = out[ps.game_no] || {}).psych = {idx: ps.idx};
  return out;
}

const SRC_CLS = {app: 'src-app', dk: 'src-dk', rating: 'src-rt', rating_only: 'src-rt', market: 'src-mk', none: 'src-none'};
function oddsChip(b, i, mk) {
  const o = b.odds[i], e = b.est || {}, ep = e.p ? e.p[i] : null;
  if (o == null && ep == null) return (b.labels[i] === '-' || i === 1) ? '' : `<div class="oc2 na"><div class="l1"><span class="lab">${esc(b.labels[i])}</span><span class="od">-</span></div></div>`;
  if (o == null) return `<div class="oc2 est"><div class="l1"><span class="lab">${esc(b.labels[i])}</span><span class="od na2">미발표</span></div><div class="l2">추정 <b>${ppct(ep)}</b></div></div>`;
  const mv = b.movement[i] || {}, c = b.compare, win = b.winner_idx === i;
  const dl = mv.d ?? mv.delta, base = mv.b ?? mv.base, msrc = mv.s ? (mv.s === 's' ? '사이트 최초 배당' : '앱 최초 수집') : mv.src;
  const dir = mv.dir || (dl > 0 ? 'up' : dl < 0 ? 'down' : null);
  const arrow = dir === 'up' ? `<span class="mv up" title="${esc(msrc)} ${base}→${o}">▲${Math.abs(dl).toFixed(2)}</span>`
    : dir === 'down' ? `<span class="mv down" title="${esc(msrc)} ${base}→${o}">▼${Math.abs(dl).toFixed(2)}</span>` : '';
  const flag = (c && (c.flags || []).find(f => f.idx === i)) || (e.flags || []).find(f => f.idx === i);
  let l2 = `내재 ${ppct(b.fair[i])}`;
  let l3 = '';
  if (c && c.app && c.app[i] != null && b.bet_type === '일반' && !b.half) l3 = `앱 ${ppct(c.app[i])} · <span class="${c.ev[i] > 0 ? 'good' : ''}">EV ${c.ev[i] > 0 ? '+' : ''}${(c.ev[i] * 100).toFixed(0)}%</span>`;
  else if (ep != null && e.ev && e.ev[i] != null) {
    const same = e.src === 'market' || (b.fair[i] != null && Math.abs(ep - b.fair[i]) < 0.0005);
    l3 = `${same ? '' : '추정 <b>' + ppct(ep) + '</b></div><div class="l2">'}<span class="${e.ev[i] > 0 ? 'good' : 'muted'}">EV ${e.ev[i] > 0 ? '+' : ''}${(e.ev[i] * 100).toFixed(0)}%</span>`;
  }
  const isM = !!(mk && mk.jmain && mk.jmain.idx === i), isS = !!(mk && mk.jsub && mk.jsub.idx === i), isL = false;   // ★유력 removed 2026-10-05
  const isP = !!(mk && mk.psych && mk.psych.idx === i);
  const main = (isM ? 'main main-s' : '') + (isS ? ' jsub' : '') + (isL ? ' likely' : '') + (isP ? ' psy' : '');
  const unv = '<small class="unvt">미검증</small>';
  const mb = (isM || isS || isL || isP) ? `<span class="markb">${isP ? '<span class="psyb" aria-label="심리 분석 픽: 검증 통과 배당 심리 신호">🧠심리</span>' : ''}${isM ? `<span class="mainb" title="1순위 = 적중 확률이 가장 높은 칸 · ${esc(markRecText('jr_main'))}" aria-label="1순위: 적중 확률 가장 높음">1순위</span>` : ''}${isS ? `<span class="subb" title="2순위 = 1순위 다음으로 적중 확률이 높은 칸 · ${esc(markRecText('jr_sub'))}" aria-label="2순위: 1순위 다음 적중 확률">2순위</span>` : ''}</span>` : '';
  return `<div class="oc2 ${win ? 'win' : ''} ${flag ? flag.kind : ''} ${main}">${mb}<div class="l1"><span class="lab">${flag ? (flag.kind === 'upset' ? '🔥' : '💎') : ''}${esc(b.labels[i])}</span><span class="ov"><span class="od">${o.toFixed(2)}</span>${arrow}</span></div>
    <div class="l2">${l2}</div>${l3 ? `<div class="l2">${l3}</div>` : ''}</div>`;
}

/* 🔎 분석 상세 for a Proto match: probability components, score model, team facts, per-bet table. */
function protoAnalysis(m) {
  const A = m.analysis;
  if (!A) return '';
  if (!A.components && !A.method) {        // slim list: the panel body is fetched on first open
    const d = PROTO.detail[m.key];
    return `<details class="ana pan" data-lazy="ana" data-key="${esc(m.key)}"><summary>🔎 분석 상세 · <span class="${SRC_CLS[A.source] || ''}">${esc(A.source_label)}</span></summary>
      <div class="lz">${d ? protoAnalysisInner(mergeDetail(m, d)) : '<div class="muted">열면 불러옵니다…</div>'}</div></details>`;
  }
  return `<details class="ana pan"><summary>🔎 분석 상세 · <span class="${SRC_CLS[A.source] || ''}">${esc(A.source_label)}</span></summary>${protoAnalysisInner(m)}</details>`;
}
function mergeDetail(m, d) {
  const byNo = Object.fromEntries((d.bets || []).map(b => [b.game_no, b]));
  return Object.assign({}, m, {analysis: d.analysis || m.analysis, mc_bets: d.mc_bets || m.mc_bets, bets: m.bets.map(b => Object.assign({}, b, byNo[b.game_no] || {}))});
}
function protoAnalysisInner(m) {
  const A = m.analysis;
  if (!A) return '<div class="muted">분석 데이터 없음</div>';
  const two = !(A.components || []).some(c => c.p && c.p[1] != null);
  const head = `<tr><th>출처</th><th>${esc(m.home)}</th>${two ? '' : '<th>무</th>'}<th>${esc(m.away)}</th></tr>`;
  const comp = (A.components || []).map(c => `<tr class="${c.name.startsWith('최종') ? 'fin' : ''}"><td><b>${esc(c.name)}</b></td><td>${ppct(c.p && c.p[0])}</td>${two ? '' : `<td>${ppct(c.p && c.p[1])}</td>`}<td>${ppct(c.p && c.p[2])}</td></tr>`
    + (c.detail ? `<tr class="det"><td colspan="${two ? 3 : 4}">${esc(c.detail)}</td></tr>` : '')).join('');
  const d = A.dist;
  let dist = '';
  if (d) {
    const kv = Object.entries(d).filter(([k]) => !['kind', 'label', 'set_scores'].includes(k)).map(([k, v]) => `${({lambda_home: 'λ홈', lambda_away: 'λ원정', exp_total: '예상 총점', runs_home: '홈 득점', runs_away: '원정 득점', margin: '예상 점수차', total: '예상 총점', delta: 'Δ'})[k] || k} ${v}`).join(' · ');
    const ss = d.set_scores ? ' · ' + Object.entries(d.set_scores).map(([k, v]) => `${k} ${ppct(v)}`).join(' ') : '';
    dist = `<div class="an-sec">📐 ${esc(d.label || d.kind)}: ${esc(kv)}${esc(ss)}</div>`;
  }
  const teams = ['home', 'away'].map(s => (A.teams && A.teams[s] && A.teams[s].length) ? `<div class="an-sec"><b>${esc(m[s])}</b><ul>${A.teams[s].map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '').join('');
  const h2h = (A.h2h || []).length ? `<div class="an-sec"><b>상대전적</b><ul>${A.h2h.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const notes = (A.notes || []).map(x => `<div class="muted">${esc(x)}</div>`).join('');
  const rows = m.bets.map(b => {
    const e = b.est || {};
    const cell = i => (b.labels[i] === '-' || (e.p ? e.p[i] == null : b.odds[i] == null)) ? '' : `<span class="oc-i">${esc(b.labels[i])} <b>${ppct(e.p ? e.p[i] : null)}</b>${e.p_market && e.p_market[i] != null && e.p && Math.abs(e.p[i] - e.p_market[i]) >= 0.0005 ? ` <span class="muted">(시장 ${ppct(e.p_market[i])})</span>` : ''}</span>`;
    return `<div class="an-bet"><div><b>${b.game_no} ${b.half ? '전반 ' : ''}${esc(b.bet_type)}${b.line != null && b.odds.some(x => x) ? ' ' + b.line : ''}</b> <span class="muted sm">${esc(e.basis || '')}</span></div><div>${e.p ? [0, 1, 2].map(cell).filter(x => x).join(' · ') : `<span class="muted">${esc(e.reason || '계산 불가')}</span>`}</div></div>`;
  }).join('');
  const none = !(A.components || []).length && !teams ? '<div class="muted">연결된 외부 데이터와 프로토 배당이 아직 없습니다.</div>' : '';
  return `${none}${(A.components || []).length ? `<table class="an-t">${head}${comp}</table>` : ''}${dist}${teams}${h2h}${notes}
    <div class="an-sec"><b>유형별 확률</b> <span class="muted sm">(추정, 괄호는 프로토 시장)</span>${rows}</div>
    ${typeof mcBetsHtml === 'function' ? mcBetsHtml(m.mc_bets, m) : ''}
    <div class="muted sm">${esc(A.method || '')}${A.calibration ? ' · ' + esc(A.calibration) : ''}</div>`;
}

function betRow(b, mStatus, mk) {
  const line = b.line != null ? `<span class="ln">${b.bet_type === '핸디캡' && b.line > 0 ? '+' : ''}${b.line}</span>` : '';
  const st = b.status !== mStatus ? `<span class="stb sm ${ST_CLS[b.status] || ''}">${esc(b.status)}</span>` : '';
  const res = (b.status === '결과' || b.status === '진행중') && b.result ? `<span class="res">${esc(b.result)}${b.score ? ' · ' + esc(b.score) : ''}</span>` : '';
  return `<div class="brow"><div class="brow-h"><span class="no">${b.game_no}</span>${b.half ? '<span class="half">전반</span>' : ''}<span class="bt">${esc(b.bet_type)}</span>${line}${st}${res}</div>
    ${(cs => `<div class="ocs ${cs.filter(x => x).length >= 3 ? 'n3' : ''}">${cs.join('')}</div>`)([0, 1, 2].map(i => oddsChip(b, i, mk)))}</div>`;
}

function histBlock(m) {
  if (m.n_snap != null && !m.bets.some(b => b.history)) {   // slim list: lazy
    const d = PROTO.detail[m.key];
    return `<details data-lazy="hist" data-key="${esc(m.key)}"><summary>📈 배당 변동 내역 (앱 스냅샷 ${m.n_snap}개)</summary><div class="lz">${d ? histInner(mergeDetail(m, d)) : '<div class="muted">열면 불러옵니다…</div>'}</div></details>`;
  }
  const n = m.bets.reduce((a, b) => a + (b.n_snapshots || 0), 0);
  return `<details><summary>📈 배당 변동 내역 (앱 스냅샷 ${n}개)</summary>${histInner(m)}</details>`;
}
function histInner(m) {
  const items = m.bets.filter(b => (b.site_changes || []).length || (b.history || []).length > 1).map(b =>
    `<div><b>${b.game_no} ${esc(b.bet_type)}${b.line != null ? ' ' + b.line : ''}</b>: ${(b.site_changes || []).map(esc).join(' · ')}${(b.history || []).length > 1 ? ` <span class="muted">(앱 수집 ${b.history.map(x => x.slice(1).map(v => v == null ? '-' : v.toFixed(2)).join('/')).join(' → ')})</span>` : ''}</div>`).join('');
  return items || '<div class="muted">변동 없음</div>';
}
async function loadDetail(el) {
  const R = PROTO.data && PROTO.data.round, key = el.dataset.key, box = el.querySelector('.lz');
  if (!R || !box) return;
  const m = R.matches.find(x => String(x.key) === String(key));
  if (!m) return;
  if (!PROTO.detail[key]) {
    box.innerHTML = '<div class="skel"><i class="s"></i><i></i><i></i></div>';
    try {
      const r = await fetch(`/api/proto/match/${R.year}/${R.round}/${encodeURIComponent(key)}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      PROTO.detail[key] = await r.json();
    } catch (e) { box.innerHTML = `<div class="bad">불러오기 실패: ${esc(String(e.message || e))} — 다시 열어 재시도</div>`; return; }
  }
  const mm = mergeDetail(m, PROTO.detail[key]);
  box.innerHTML = el.dataset.lazy === 'ana' ? protoAnalysisInner(mm) : histInner(mm);
}

function protoRender() {
  const d = PROTO.data, v = document.getElementById('protoView');
  if (!d) return;
  const R = d.round, srcs = (d.sources || []).map(s => `<span class="srcb ${s.active ? 'act' : s.ok === false ? 'bad' : ''}" title="${esc(s.last_error || '')}">${s.active ? '● ' : s.ok === false ? '✕ ' : '○ '}${esc(s.label)}${s.ok === false ? ' — 실패: ' + esc(s.last_error || '') : s.active ? ' (사용 중)' : ''}</span>`).join('');
  const roundsOpt = (PROTO.rounds || []).map(r => `<option value="${r.year}-${r.round}" ${R && r.year === R.year && r.round === R.round ? 'selected' : ''}>${r.year}년 ${r.round}회차 · ${esc(r.status || '')}${d.current && r.year === d.current[0] && r.round === d.current[1] ? ' (현재)' : ''}</option>`).join('');
  let head = `<div class="card pmeta">
    ${PROTO.banner ? `<div class="banner">${esc(PROTO.banner)}</div>` : ''}
    <div class="prow"><h2 style="margin:0">🎫 프로토 승부식 ${R ? `${R.year}년 <b>${R.round}회차</b>` : ''}</h2>
      ${R && R.meta ? `<span class="stb ${R.meta.status === '발매중' ? 'st-on' : 'st-off'}">${esc(R.meta.status || '')}</span>` : ''}
      <select id="p_round">${roundsOpt}</select>
      <label class="toggle"><input type="checkbox" id="p_follow" ${PROTO.follow ? 'checked' : ''}> 현재 회차 자동 따라가기</label></div>
    ${R ? `<div class="psum"><span>경기 <b>${R.n_matches}</b></span><span>앱 매칭 <b>${R.n_matched}</b></span>${R.rec_coverage ? `<span>🎯 추천 <b>${R.rec_coverage.with_recommendation}/${R.rec_coverage.total}</b></span>` : ''}<span>💎🔥 후보 <b>${R.n_flags}</b></span><span class="mainlg" title="1순위(노랑) = 경기에서 적중 확률이 가장 높은 칸 (보정된 모델 적중확률) · ${esc(markRecText('jr_main'))}&#10;2순위(하늘 점선) = 1순위 다음으로 적중 확률이 높은 칸 (다른 배팅 유형) · ${esc(markRecText('jr_sub'))}&#10;🧠심리(보라) = 검증 통과 배당 심리 신호 칸"><i></i>1순위 <b>${R.matches.filter(m => pickJr(m, 'main')).length}</b> <i class="sb"></i>2순위 <b>${R.matches.filter(m => pickJr(m, 'sub')).length}</b></span><span class="muted">수집 ${kst(d.last_poll)}${d.last_error && !d.active_source ? ' <span class="bad">· 오류</span>' : ''}</span></div>` : ''}
    <details class="pmore" ${PROTO.moreOpen ? 'open' : ''}><summary>ℹ️ 회차 정보 · 데이터 소스 · 확률 출처</summary>
    ${R && R.meta ? `<div class="muted">발매기간: ${esc(R.meta.sales_start || '?')} ~ ${esc(R.meta.sales_note || '')} · 경기 ${R.n_matches} · 배팅항목 ${R.n_entries} · 앱 배당 스냅샷 ${R.snapshots}개 · ${esc(R.match_rate_note)}</div>
    <div class="chips">${Object.entries(R.bet_types).map(([k, n]) => `<span class="chip">${esc(k)} ${n}</span>`).join('')}</div>
    ${R.n_excluded ? `<div class="muted">분석 제외 ${R.n_excluded}항목: ${Object.entries(R.excluded_types || {}).map(([k, n]) => `${esc(k)} ${n}`).join(' · ')} — 확률·추천·역배·시뮬레이션·알림·채점 대상 아님</div>` : ''}` : '<div class="muted">아직 수집된 회차가 없습니다.</div>'}
    <div class="muted">데이터 소스: ${srcs}</div>
    <div class="muted">마지막 수집 ${kst(d.last_poll)} · 다음 수집 ${kst(d.next_poll)} (발매 중 ${d.interval_s}초 간격, 서버가 자동 수집) ${d.last_error ? `<span class="bad">· 오류: ${esc(d.last_error)}</span>` : ''}</div>
    ${R && R.rec_coverage ? `<div class="muted">🎯 추천 가능 <b>${R.rec_coverage.with_recommendation}/${R.rec_coverage.total}</b>경기 (종료·취소 제외) · 확률 출처: ${Object.entries(R.rec_coverage.by_source).map(([k, n]) => `<span class="srcl ${SRC_CLS[k] || ''}">${esc(SRC_NAME[k] || k)} ${n}</span>`).join(' ')}</div>` : ''}
    <div class="pdisc">⚠️ 내재확률 = 파워 방식 마진 제거(Σ(1/배당)^k = 1, 프로토 마진 약 ${R && R.matches.length ? ppct(R.matches[0].bets[0].overround) : '13%'}). 모든 경기·유형의 확률 출처를 카드마다 표시합니다: <b>앱 모델+시장</b> / <b>외부 배당(DraftKings)</b> / <b>순위·랭킹 모델</b>(FIFA·FIVB 랭킹, NPB 득실) / <b>배당 기반(시장)</b>. 배당 기반은 확률이 배당 자체에서 나오므로 EV ≈ −마진이며 가치 신호가 아닙니다. 핸디캡·언오버·홀짝·승①패는 일반 확률과 총점 라인에 맞춘 득점분포 모델로 계산합니다. 💎 가치(EV+) / 🔥 역배 후보는 발매 중인 일반 항목에서 앱 모델·DraftKings·랭킹 모델이 시장보다 높을 때만 표시합니다. <b>통계적 추정일 뿐 베팅 권유가 아닙니다.</b></div>
    </details>
  </div>`;
  if (!R) { v.innerHTML = head; protoBind(); return; }
  const sports = [...new Set(R.matches.map(m => m.sport_ko))];
  const stats = ['자동', '발매중', '진행중', '결과', '마감', '전체'];
  const q = typeof searchMatch === 'function' ? searchMatch : () => true;
  const keep = m => (PROTO.sport === 'all' || m.sport_ko === PROTO.sport) && (!PROTO.onlyApp || m.app) && (!PROTO.onlyFlag || m.flags > 0)
    && q(m.home, m.away, m.league, m.sport_ko, m.app && m.app.home, m.app && m.app.away);
  const cnt = s => s === '전체' ? R.n_matches : s === '자동' ? R.n_matches : (R.status_counts[s] || 0);
  const filt = `<div class="filters">${['all', ...sports].map(s => `<span class="chip pchip ${s === PROTO.sport ? 'active' : ''}" data-k="sport" data-v="${esc(s)}">${s === 'all' ? '전체 종목' : esc(s)}</span>`).join('')}
    <span class="sep"></span>${stats.map(s => `<span class="chip pchip ${s === PROTO.status ? 'active' : ''}" data-k="status" data-v="${s}">${s === '자동' ? '⏱ 시간순 자동' : s + ' (' + cnt(s) + ')'}</span>`).join('')}
    <span class="sep"></span><label class="toggle"><input type="checkbox" id="p_app" ${PROTO.onlyApp ? 'checked' : ''}> 앱 경기 매칭만 (${R.n_matched})</label>
    <label class="toggle"><input type="checkbox" id="p_flag" ${PROTO.onlyFlag ? 'checked' : ''}> 가치/역배 후보만 (${R.n_flags})</label></div>`;
  const card = m => protoCardHtml(m, R);
  const grid = arr => `<div class="pgrid">${arr.map(card).join('')}</div>`;
  let body;
  const nKeep = R.matches.filter(keep).length;
  if (!nKeep && R.matches.length) body = `<div class="empty">${typeof SEARCH !== 'undefined' && SEARCH.q ? `‘${esc(SEARCH.q)}’ 검색 결과가 없습니다.` : '조건에 맞는 경기가 없습니다.'}</div>`;
  else if (PROTO.status === '자동' && R.sections) {
    const byKey = Object.fromEntries(R.matches.map(m => [m.key, m]));
    const pick = keys => keys.map(k => byKey[k]).filter(m => m && keep(m));
    const S = R.sections, cov = R.live_coverage || {};
    const slots = S.on_sale.map(s => [s, pick(s.keys)]).filter(([, a]) => a.length);
    const live = pick(S.live), done = pick(S.done);
    body = `<div class="psec">🟢 발매중 <span class="n">${slots.reduce((a, [, x]) => a + x.length, 0)}경기 · 경기 시작 시간순</span></div>`
      + (slots.length ? slots.map(([s, a]) => `<div class="slot">⏰ ${esc(s.slot)} <span class="n muted">${a.length}경기</span></div>${grid(a)}`).join('') : '<div class="empty">발매 중인 경기가 없습니다.</div>')
      + (live.length ? `<div class="psec" id="p_live">🔴 진행중 · 마감 <span class="n">${live.length}경기 · 스코어 ${cov.live_with_score ?? '-'}/${cov.live_total ?? '-'} · 30초마다 갱신</span></div>${grid(live)}` : '')
      + `<details class="donesec" id="p_done" ${PROTO.doneOpen ? 'open' : ''}><summary>⚪ 종료 · 취소 · 연기 (${done.length}경기)</summary>${PROTO.doneOpen ? grid(done) : ''}</details>`;
  } else {
    const ms = R.matches.filter(m => keep(m) && (PROTO.status === '전체' || m.status === PROTO.status));
    body = ms.length ? grid(ms) : `<div class="empty">조건에 맞는 경기가 없습니다.</div>`;
  }
  const y = window.scrollY;
  v.innerHTML = head + filt + body;
  (v.querySelectorAll('.mc[data-key]') || []).forEach(c => {
    const k = c.dataset.key;
    (c.querySelectorAll('details') || []).forEach((el, i) => {
      const id = k + '|' + i;                      // per panel, so opening one panel doesn't reopen all of them
      if (PROTO.openKeys.has(id)) el.open = true;
      el.ontoggle = () => { el.open ? PROTO.openKeys.add(id) : PROTO.openKeys.delete(id); if (el.open && el.dataset.lazy) loadDetail(el); };
    });
  });
  window.scrollTo(0, y);
  protoBind();
}

function protoBind() {
  const r = document.getElementById('p_round');
  if (r) r.onchange = () => { PROTO.sel = r.value.split('-').map(Number); PROTO.follow = false; protoLoad(); };
  const f = document.getElementById('p_follow');
  if (f) f.onchange = () => { PROTO.follow = f.checked; if (f.checked) PROTO.sel = null; protoLoad(); };
  document.querySelectorAll('.pchip').forEach(c => c.onclick = () => { PROTO[c.dataset.k] = c.dataset.v; protoRenderSoon(); });
  const a = document.getElementById('p_app'); if (a) a.onchange = () => { PROTO.onlyApp = a.checked; protoRenderSoon(); };
  const mo = document.querySelector && document.querySelector('#protoView details.pmore'); if (mo) mo.ontoggle = () => { PROTO.moreOpen = mo.open; };
  const g = document.getElementById('p_flag'); if (g) g.onchange = () => { PROTO.onlyFlag = g.checked; protoRenderSoon(); };
  const dn = document.getElementById('p_done');
  if (dn) dn.ontoggle = () => { if (dn.open !== PROTO.doneOpen) { PROTO.doneOpen = dn.open; protoRender(); } };
}
/* 예상 스코어 line (app/score_model.py via m.score_pred): top-3 scorelines (set scores for volleyball) with their
 * probabilities, or the expected score for basketball. "주력 반영" when the walk-forward check adopted the model for
 * this sport (then m.score_main drives ★주력 1.75+), otherwise "참고용". */
function scorePredHtml(m) {
  const sp = m && m.score_pred;
  if (!sp || !sp.exp) return '';
  const pc = p => `${Math.round(p * 100)}%`;
  const body = (sp.top && sp.top.length) ? sp.top.map(t => `<b>${esc(t.s)}</b> (${pc(t.p)})`).join(' · ')
    : `<b>${Math.round(sp.exp[0])}-${Math.round(sp.exp[1])}</b> (평균)`;
  const tag = sp.adopted ? '<span class="scp-a" title="검증 통과: 이 종목은 예상 스코어 모델이 표본 밖 검증을 통과했습니다 — 1순위·2순위 선택과는 별개">검증 통과</span>'
    : '<span class="scp-r" title="검증에서 기존 기준을 넘지 못해 화면 표시만 합니다">참고용</span>';
  return `<div class="mc-score" title="${esc(sp.model || '')} · 평균 ${sp.exp[0].toFixed(1)}-${sp.exp[1].toFixed(1)}">${({soccer: '⚽', baseball: '⚾', basketball: '🏀', volleyball: '🏐', hockey: '🏒'})[m.sport] || '🎯'} 예상 스코어 ${body} ${tag}</div>`;
}
/* 🧠 배당 심리 분석 (app/psych.py via m.psych): 배당 흐름 / 함정 경고 / 역배 신호 (+ 해외·앱 격차), each with its
 * validated record ("검증 통과/실패: 적중 x% (n=…)" or "미검증"), and the 🧠 심리 픽 only when a validated signal fires. */
const PSY_CLS = {pass: 'ps-ok', fail: 'ps-bad', few: 'ps-few', none: 'ps-few', info: 'ps-info'};
function psychHtml(m) {
  const P = m && m.psych;
  if (!P || !P.lines) return '';
  const li = P.lines.map(l => `<div class="psl"><span class="pst">${esc(l.t)}</span>${l.v && l.v.status !== 'info' ? ` <span class="psv ${PSY_CLS[l.v.status] || ''}">${esc(l.v.text)}</span>` : ''}</div>`).join('');
  const pk = P.pick;
  const pick = pk ? `<div class="psl psp">🧠 심리 분석 픽: <b>${esc(pk.bet_type)}${pk.line != null && pk.bet_type !== '일반' ? ' ' + esc(String(pk.line)) : ''} ${esc(pk.label)}</b> @${Number(pk.odds).toFixed(2)} · ${esc(pk.signal)}${pk.oos && pk.oos.n ? ` <span class="psv ps-ok">검증 적중 ${Math.round(pk.oos.hit * 100)}% (n=${pk.oos.n})</span>` : ''}</div>`
    : `<div class="psl psp none">🧠 심리 분석 픽: 없음 <span class="muted">— 검증 통과 신호 ${P.n_validated || 0}개</span></div>`;
  return `<div class="psy-box" aria-label="배당 심리 분석">${li}${pick}</div>`;
}
/* 1순위 / 2순위 (internal keys jr.main / jr.sub) box on the card: 1순위 = highest calibrated hit probability, 2순위 = next
 * highest from another bet row (app/edge.analyse_jr, 2026-10-05); reason from the cell's real numbers (e.g.
 * "적중확률 68% (시장 61%) · 배당 하락(돈 유입)"), plus the 적중/미적중 record of real live picks (R.jr_record). */
function jrCellName(b, idx) {
  return `${esc(b.bet_type === '일반' ? (b.labels.includes('무') ? '승무패' : '승패') : b.bet_type)}${b.line != null && b.bet_type !== '일반' ? ' ' + esc(String(b.line)) : ''} ${esc(b.labels[idx])}`;
}
/* "📈 1순위 적중 6 · 미적중 3 (67%) · 2순위 …" — real live picks graded with official results only (R.jr_record). */
function jrRecText(R) {
  const J = R && R.jr_record;
  if (!J || !J.jr_main) return '';
  const one = (x, nm) => {
    if (!x || !x.n) return `${nm} 채점 전`;
    return `${nm} 적중 <b>${x.hits}</b> · 미적중 <b>${x.misses}</b> (${Math.round(x.hit * 100)}%)`;
  };
  return `<div class="jrec">📈 ${one(J.jr_main, '1순위')} · ${one(J.jr_sub, '2순위')}</div>`;
}
function jrHtml(m, R) {
  if (!m || oddsPending(m)) return '';
  const jm = pickJr(m, 'main'), js = pickJr(m, 'sub');
  if (!jm) return '';
  const line = (p, k, nm) => `<div class="jl"><span class="jk ${k}">${nm}</span><span class="jc">${jrCellName(p.b, p.idx)}</span><span class="jo">@${Number(p.odds).toFixed(2)}</span><span class="jw">${esc(p.reason || '')}</span></div>`;
  return `<div class="jr-box" aria-label="1순위·2순위 분석 픽">${line(jm, 'm', '1순위')}${js ? line(js, 's', '2순위') : ''}${jrRecText(R || (PROTO.data && PROTO.data.round))}</div>`;
}
/* One Proto match card. */
function protoCardHtml(m, R) {
  return `<div class="mc ${m.flags ? 'flagged' : ''}" data-key="${esc(m.key)}">
      <div class="mc-h"><span>${kst(m.kickoff)} · ${esc(m.sport_ko)} · ${esc(m.league)}</span><span class="hd-r"><span class="stb ${ST_CLS[m.status] || ''}">${esc(m.status)}</span></span></div>
      <div class="mc-t">${esc(m.home)}<span class="vs">vs</span>${esc(m.away)}</div>
      ${liveHtml(m)}
      ${m.app ? `<div class="mc-app">📊 앱: ${esc(m.app.home)} vs ${esc(m.app.away)}${m.app.swapped ? ' (홈/원정 반대)' : ''} · ${esc(m.app.status_text || '')}</div>` : ''}
      ${oddsPending(m) ? `<div class="mc-src"><span class="srcl src-wait" title="배당이 발표되면 확률·추천·1순위·2순위가 자동으로 표시됩니다">⏳ 배당 발표 대기 · 자동 반영</span>${PROTO.data && PROTO.data.next_poll ? ` <span class="muted sm">다음 확인 ${kst(PROTO.data.next_poll).slice(-5)}</span>` : ''}</div>`
        : m.analysis ? `<div class="mc-src">확률 출처: <span class="srcl ${SRC_CLS[m.analysis.source] || ''}">${esc(m.analysis.source_label)}</span></div>` : ''}
      ${m.neutral ? `<div class="sub">${esc(m.neutral)}</div>` : ''}
      ${scorePredHtml(m)}
      ${jrHtml(m, R)}
      ${psychHtml(m)}
      ${(mp => m.bets.map(b => betRow(b, m.status, mp[b.game_no])).join(''))(cellMarks(m, R))}
      ${exclHtml(m.excluded)}
      ${typeof mcPickHtml === 'function' ? mcPickHtml(m.mc_pick) : ''}
      ${recHtml(m.recommend)}
      ${typeof upsetPickHtml === 'function' ? upsetPickHtml(m.upset_pick, m) : ''}
      ${protoAnalysis(m)}
      ${histBlock(m)}</div>`;
}
setInterval(() => { if (sport === 'proto') protoLoad(); }, 60000);   // ETag → 304 when nothing changed
if (typeof document !== 'undefined' && document.addEventListener)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && sport === 'proto') protoLoad(); });
setInterval(() => { if (sport === 'proto') protoLive(); }, 30000);
if (typeof module !== 'undefined') module.exports = {detectRoundChange, mergeLive, mainPicks, pickMain175, pickLikely, pickJr, jrHtml, jrRecText, cellMarks, scorePredHtml, psychHtml, oddsPending, announcedMains, PROTO, protoLoadForTest: protoLoad};
