/* 🎲 몬테카를로 예측픽 · 🎯 예측픽 적중률 · 🚨 긴급 레이더 · 🎯 선별 픽 기준(백테스트)
 * Cards: mcPickHtml(g.mc_pick | m.mc_pick). 📊 예측 성적: pickAccHtml + radarHtml. 📈 백테스트: selectiveHtml.
 * Global red banner while the radar is active (polled every 60 s). */
const mcP = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
const mcP0 = x => x == null ? '–' : Math.round(x * 100) + '%';
const mcCi = ci => ci ? `${mcP0(ci[0])}–${mcP0(ci[1])}` : '–';
const mcN = n => Number(n || 0).toLocaleString('ko-KR');
const MC_NOTE = '모델 파라미터(팀 전력·기대득점·점수차)에 불확실성을 넣어 경기를 반복 시뮬레이션합니다. 구간 = 파라미터 불확실성의 95% 범위, 안정도 = 파라미터 세트 중 1위 결과가 그대로 1위인 비율. 예측픽은 1위 확률이 2위와 95% 구간이 겹치지 않고, 리그별 백테스트에서 적중률 80% 이상이던 확률 기준을 넘을 때만 냅니다. 나머지는 보류.';

function mcBadge(n) { return `<span class="mcb" title="몬테카를로 시뮬레이션 횟수">🎲 시뮬레이션 ${mcN(n)}회</span>`; }

function mcPickHtml(d) {
  if (!d) return '';
  const st = d.status;
  const head = st === 'pick' ? `<span class="mcpk">🎯 예측픽 <b>${esc(d.top_label)}</b> ${mcP(d.p_top)}</span>`
    : st === 'live' ? `<span class="mclv">📡 실시간 1위 ${esc(d.top_label)} ${mcP(d.p_top)}</span>`
    : `<span class="mchd">⏸ 보류</span> <span class="muted">1위 ${esc(d.top_label)} ${mcP(d.p_top)}</span>`;
  const outs = (d.outcomes || []).filter(o => !(o.key === 'tie' && !o.p)).map(o =>
    `<tr class="${o.key === d.top ? 'fin' : ''}"><td>${esc(o.label)}</td><td>${mcP(o.p)}</td><td>${mcCi(o.ci)}</td></tr>`).join('');
  const rs = d.reasons || [];
  const line2 = st === 'pick'
    ? `<div class="sub">95% 구간 ${mcCi(d.ci_top)} · 2위 ${esc(d.second_label || '')} ${mcCi(d.ci_second)} · 기준 ${mcP0(d.threshold)}${d.threshold_boosted ? ' <span class="bad">(레이더 상향)</span>' : ''}</div>`
    : rs.length ? `<div class="sub mcrs">${esc(rs[0])}${rs.length > 1 ? ` <span class="muted">외 ${rs.length - 1}건</span>` : ''}</div>` : '';
  return `<div class="mcrow ${esc(st)}">
    <div class="mcl1">${mcBadge(d.n_sims)}${head}</div>${line2}
    <details class="mcd"><summary>🎲 시뮬레이션 결과 · 안정도 ${mcP0(d.stability)}</summary>
      <table class="an-t mct"><tr><th>결과</th><th>확률</th><th>95% 구간</th></tr>${outs}</table>
      ${rs.length ? `<ul class="mcul">${rs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      <div class="muted sm">${MC_NOTE}</div></details></div>`;
}

/* 🔎 분석 상세 (Proto): every bet type from the fitted score model, 10,000 simulated scores */
function mcBetsHtml(mb, m) {
  if (!mb || !mb.bets) return '';
  const rows = (m.bets || []).map(b => {
    const r = mb.bets[String(b.game_no)];
    if (!r) return '';
    const cells = [0, 1, 2].filter(i => b.labels[i] && b.labels[i] !== '-' && r.p[i] > 0).map(i =>
      `<span class="oc-i ${i === r.top ? 'good' : ''}">${esc(b.labels[i])} <b>${mcP(r.p[i])}</b> <span class="muted">${mcCi(r.ci[i])}</span></span>`).join(' · ');
    return cells ? `<div class="an-bet"><div><b>${b.game_no} ${b.half ? '전반 ' : ''}${esc(b.bet_type)}${b.line != null ? ' ' + b.line : ''}</b></div><div>${cells}</div></div>` : '';
  }).join('');
  if (!rows) return '';
  return `<div class="an-sec">${mcBadge(mb.n_sims)} <b>유형별 시뮬레이션</b> <span class="muted sm">(${esc(mb.dist && mb.dist.label || '')}, 괄호 없는 범위 = 95% 구간)</span>${rows}
    <div class="muted sm">${esc(mb.note || '')}</div></div>`;
}

/* ---------- 📊 예측 성적: 예측픽 적중률 ---------- */
function accCell(a, label, min) {
  const enough = a && a.n >= min;
  const cls = !a || a.hit_rate == null ? '' : a.hit_rate >= 0.8 ? 'good' : enough ? 'bad' : 'warn';
  return `<div><b class="${cls}">${a && a.hit_rate != null ? mcP(a.hit_rate) : '–'}</b><span>${label} (n=${a ? a.n : 0}${a && a.n ? `, ${a.hits}적중` : ''})${a && a.n && !enough ? ' · 표본 부족' : ''}</span></div>`;
}
/* Reference numbers shown while there are no graded 예측픽 yet (all real, from /api/performance, /api/pick-accuracy
 * and /api/selective — clearly labelled 참고, never mixed into the 예측픽 hit rate). */
function selRefs(sel) {
  const rows = (sel && sel.rows) || [];
  const ok = rows.filter(r => r.status === 'ok' && r.val && r.val.n);
  const best = {};
  for (const r of ok) { const k = r.league; if (!best[k] || (r.val.n > best[k].val.n)) best[k] = r; }   // one basis per league
  const no = [...new Set(rows.filter(r => !r.league.startsWith('_') && (r.effective || {}).status === 'unreachable').map(r => r.name))];
  return {ok: Object.values(best), unreachable: no};
}
function refTile(v, label, n, tag) {
  return `<div><b>${v == null ? '–' : mcP(v)}</b><span><span class="reftag">${tag || '참고'}</span>${label}${n != null ? ` (n=${n})` : ''}</span></div>`;
}
function pickWhyHtml(pa, sel) {
  const c = pa.coverage || {}, R = selRefs(sel);
  const ths = R.ok.map(r => `${esc(r.name)} ${mcP0(r.threshold)}+`).join(', ');
  return `<div class="refbox"><b>왜 아직 예측픽이 없나요?</b>
    <div class="sub">지금까지 경기 시작 시 고정된 ${c.frozen_games || 0}경기가 모두 80% 기준에 못 미쳐 ⏸ 보류됐습니다. 그래서 예측픽 적중률은 아직 계산할 수 없습니다 (0건).</div>
    <div class="sub"><b>예측픽이 나오는 조건</b>: 몬테카를로 1만 회에서 ① 1위 확률이 2위와 95% 구간이 겹치지 않고 ② 리그별 백테스트 기준 이상${ths ? ` (${ths})` : ''}. 현재 이 조건을 만족할 수 있는 건 축구뿐이라, 해당 축구 경기가 열리고 확신도가 충분히 높을 때 첫 픽이 나옵니다.</div>
    ${R.unreachable.length ? `<div class="sub muted">항상 보류: ${esc(R.unreachable.join(' · '))} (백테스트에서 어떤 기준으로도 80% 미달) · 농구·챔스·J리그·NPB 등 (과거 데이터 없음)</div>` : ''}</div>`;
}
function pickAccHtml(pa, ref) {
  if (!pa) return '';
  ref = ref || {};
  if (!((pa.overall || {}).n)) return pickAccEmptyHtml(pa, ref);
  const min = pa.min_n || 10, c = pa.coverage || {}, k = pa.counts || {};
  const lg = Object.entries(pa.by_league || {}).map(([n, a]) => `<tr><td>${esc(n)}</td><td>${a.n}</td><td>${mcP(a.hit_rate)}</td><td>${a.ci95 ? mcCi(a.ci95) : '–'}</td></tr>`).join('');
  const item = r => `<div class="mc"><div class="mc-h"><span>${esc(r.league || '')} · ${kstFmt(r.kickoff)}</span><span class="stb ${r.hit === 1 ? 'st-on' : r.hit === 0 ? 'st-live' : 'st-off'}">${r.hit === 1 ? '적중' : r.hit === 0 ? '실패' : r.frozen ? '경기 중(고정)' : '경기 전'}</span></div>
    <div class="mc-t">${esc(r.home)}<span class="vs">vs</span>${esc(r.away)}</div>
    <div class="sub">🎯 <b>${esc(r.pick || r.outcome_label || '')}</b> ${mcP(r.p)}${r.ci ? ` (95% ${mcCi(r.ci)})` : ''}${r.result ? ' → ' + esc(r.result) : ''}</div></div>`;
  return `<div class="card pmeta" id="pickAcc"><h2 style="margin:0">🎯 예측픽 적중률 <span class="muted">목표 80%</span></h2>
    <div class="kv">${accCell(pa.overall, '전체', min)}${accCell(pa.last20, '최근 20픽', min)}${accCell(pa.last50, '최근 50픽', min)}
      <div><b>${c.rate == null ? '–' : mcP(c.rate)}</b><span>픽 비율 (고정된 ${c.frozen_games || 0}경기 중 ${c.picks || 0}픽)</span></div>
      <div><b>${mcP((pa.held_top_outcome || {}).hit_rate)}</b><span>보류 경기 1위 결과 적중률 (참고, n=${(pa.held_top_outcome || {}).n || 0})</span></div>
      <div><b>${k.picks_open || 0}/${k.picks_pending || 0}</b><span>경기 전 픽 / 경기 중(고정) · 보류 기록 ${k.holds_total || 0}</span></div></div>
    ${(pa.overall || {}).n < min ? `<div class="warn sub">표본 부족: 채점된 예측픽 ${(pa.overall || {}).n || 0}건 (레이더 판정은 ${min}건부터)</div>` : ''}
    <div class="muted sm">${esc(pa.note || '')}</div>
    ${lg ? `<div class="tw"><table class="mt"><thead><tr><th>리그</th><th>n</th><th>적중률</th><th>95% 구간</th></tr></thead><tbody>${lg}</tbody></table></div>` : ''}
    ${(pa.upcoming || []).length ? `<details class="pmore"><summary>⏳ 채점 대기 예측픽 ${pa.upcoming.length}건</summary><div class="pgrid">${pa.upcoming.map(item).join('')}</div></details>` : ''}
    ${(pa.recent || []).length ? `<details class="pmore"><summary>✅ 최근 채점된 예측픽 ${pa.recent.length}건</summary><div class="pgrid">${pa.recent.map(item).join('')}</div></details>` : ''}</div>`;
}

function pickAccEmptyHtml(pa, ref) {
  const c = pa.coverage || {}, k = pa.counts || {}, h = pa.held_top_outcome || {}, rec = ref.rec || null;
  const R = selRefs(ref.sel);
  const selTiles = R.ok.slice(0, 2).map(r => refTile(r.val.hit_rate, `${r.name} 선별 백테스트 (기준 ${mcP0(r.threshold)}, ${r.val.hits}/${r.val.n})`, null, '참고·과거검증')).join('');
  return `<div class="card pmeta" id="pickAcc"><h2 style="margin:0">🎯 예측픽 적중률 <span class="muted">목표 80%</span></h2>
    <div class="sub"><span class="stb st-off">예측픽 0건 · 집계 대기</span> <span class="muted">아래 숫자는 예측픽이 아닌 <b>참고 지표</b>입니다</span></div>
    <div class="kv">${rec ? refTile(rec.hit_rate, `추천(적중확률 최고) 실제 적중률 · ${rec.hits}적중`, rec.n) : ''}
      ${refTile(h.hit_rate, `보류 경기 1위 결과 적중률${h.hits != null ? ` · ${h.hits}적중` : ''}`, h.n || 0)}
      ${selTiles}
      <div><b>${c.picks || 0}/${c.frozen_games || 0}</b><span>예측픽 / 고정된 경기 (보류 기록 ${k.holds_total || 0})</span></div></div>
    ${pickWhyHtml(pa, ref.sel)}
    <div class="muted sm" style="margin-top:6px">${esc(pa.note || '')}</div></div>`;
}

/* ---------- 🚨 긴급 레이더 ---------- */
const RADAR_KIND = {trigger: '🚨', diagnose: '🔍', action: '🛠', notify: '📣', learn: '🧠', update: '🔄', recover: '✅', error: '⚠️', info: 'ℹ️'};
function radarHtml(r, ref) {
  if (!r) return '';
  ref = ref || {};
  const on = r.active, ev = r.event || r.last_event, m = r.metrics || {};
  const cls = on ? 'rd-on' : r.status === 'ok' ? 'rd-ok' : 'rd-wait';
  const win = (k, t) => { const a = m[k] || {}; return `<div><b class="${a.hit_rate == null ? '' : a.hit_rate >= 0.8 ? 'good' : a.enough ? 'bad' : 'warn'}">${mcP(a.hit_rate)}</b><span>${t} (n=${a.n || 0})${a.n && !a.enough ? ' · 표본 부족' : ''}</span></div>`; };
  const f = ev && ev.findings;
  const segs = f ? Object.entries(f.segments || {}).map(([dim, lst]) => {
    const rows = (lst || []).slice(0, 5).map(s => `<tr class="${(f.weak || []).some(w => w.dim === dim && String(w.key) === String(s.key)) ? 'bad' : ''}"><td>${esc(s.label)}</td><td>${s.n}</td><td>${s.misses}</td><td>${mcP(s.hit_rate)}</td><td>${mcP0(s.miss_share)}</td></tr>`).join('');
    return rows ? `<div class="sub" style="margin-top:6px"><b>${esc({sport: '종목별', league: '리그별', p_band: '확률 구간별', odds_band: '배당 구간별'}[dim] || dim)}</b></div>
      <div class="tw"><table class="mt"><thead><tr><th>구간</th><th>픽</th><th>오답</th><th>적중률</th><th>오답 비중</th></tr></thead><tbody>${rows}</tbody></table></div>` : '';
  }).join('') : '';
  const causes = f && (f.causes || []).length ? `<div class="sub" style="margin-top:6px"><b>오답 원인 (오답 분석 ${f.n_misses_analysed}/${f.n_misses}건)</b></div><ul class="mcul">${f.causes.map(c => `<li>${esc(c.label)} <b>${c.n}건</b>${c.share != null ? ` (${mcP0(c.share)})` : ''}</li>`).join('')}</ul>` : '';
  const steps = ev && (ev.scenario || []).length ? `<ol class="rd-steps">${ev.scenario.map(s => `<li><span class="muted">${esc(s.kst || '')}</span> ${RADAR_KIND[s.kind] || ''} ${esc(s.text)}</li>`).join('')}</ol>` : '';
  const blocks = (r.blocks || []).map(b => `<li>⛔ ${esc({sport: '종목', league: '리그', p_band: '확률 구간', odds_band: '배당 구간'}[b.dim] || b.dim)} ‘${esc(b.label || b.key)}’ — ${esc(b.why || '')}</li>`).join('');
  const ths = Object.entries(r.league_thresholds || {}).map(([k, v]) => `<li>⬆️ ${esc(k)} 기준 ${mcP0(v)}</li>`).join('');
  const ba = ev && ev.before && ev.after ? `<div class="sub">가동 전 → 회복 시: 최근 20픽 ${mcP((ev.before.metrics.last20 || {}).hit_rate)} → ${mcP((ev.after.metrics.last20 || {}).hit_rate)} · 가동 이후 ${ev.after.since_activation.hits}/${ev.after.since_activation.n}</div>` : '';
  const log = (r.events || []).map(e => `<tr><td>#${e.id}</td><td>${esc(e.started_kst || '')}</td><td>${esc(e.ended_kst || '진행 중')}</td><td>${e.status === 'active' ? '<span class="bad">가동</span>' : '회복'}</td><td>${esc(e.summary || '')}</td></tr>`).join('');
  return `<div class="card pmeta rd ${cls}" id="radarPanel"><div class="mc-h"><h2 style="margin:0">🚨 긴급 레이더</h2><span class="stb ${on ? 'st-live' : r.status === 'ok' ? 'st-on' : 'st-off'}">${esc(r.status_ko)}</span></div>
    ${r.demo ? '<div class="stb st-done demo">시연용 가상 데이터</div>' : ''}
    ${r.status === 'insufficient' && !on && !((m.overall || {}).n) ? radarWaitHtml(r, ref) :
      `<div class="kv">${win('overall', '기준 이후 전체')}${win('last20', '최근 20픽')}${win('last50', '최근 50픽')}</div>`}
    <div class="sub">측정 기준 시점: ${esc(r.epoch_kst || '')} · 누적 ${(r.lifetime || {}).n || 0}픽${r.learning ? ' · <b class="warn">🧠 학습 풀가동 중…</b>' : ''}${r.last_full_learn_kst ? ` · 최근 풀가동 ${esc(r.last_full_learn_kst)}` : ''}</div>
    <div class="muted sm">가동 조건: ${esc((r.rules || {}).trigger || '')} · 해제: ${esc((r.rules || {}).recover || '')}</div>
    ${ev ? `<div class="rd-find"><b>${on ? '🔍 원인 추적 결과' : `최근 이벤트 #${ev.id} (${esc(ev.started_kst || '')} ~ ${esc(ev.ended_kst || '')})`}</b><div>${esc((f || {}).summary || '')}</div>${segs}${causes}</div>` : ''}
    ${blocks || ths ? `<div class="sub" style="margin-top:6px"><b>현재 적용 중인 조치</b></div><ul class="mcul">${ths}${blocks}</ul>` : ''}
    <details class="pmore" ${on ? 'open' : ''}><summary>🧭 시나리오 — ${ev ? '실제로 실행된 자동 복구 단계' : '가동 시 자동 복구 절차'}</summary>
      ${steps || ''}${ba}
      <div class="sub" style="margin-top:6px"><b>자동 복구 절차</b></div><ol class="rd-plan">${(r.plan || []).map(p => `<li>${esc(p)}</li>`).join('')}</ol></details>
    <details class="pmore"><summary>📜 레이더 이벤트 기록 (${(r.events || []).length}건)</summary>${log ? `<div class="tw"><table class="mt"><thead><tr><th>#</th><th>가동(KST)</th><th>해제</th><th>상태</th><th>원인</th></tr></thead><tbody>${log}</tbody></table></div>` : '<div class="muted">아직 가동된 적 없음</div>'}</details></div>`;
}

function radarWaitHtml(r, ref) {
  const mn = r.min_n || 10, n = (r.lifetime || {}).n || 0, rec = ref.rec, h = ref.held || {};
  return `<div class="kv"><div><b>${n}/${mn}</b><span>채점된 예측픽 (레이더 판정 시작까지 ${Math.max(0, mn - n)}건)</span></div>
      ${rec ? refTile(rec.hit_rate, '추천(적중확률 최고) 실제 적중률', rec.n) : ''}
      ${h.n ? refTile(h.hit_rate, '보류 경기 1위 결과 적중률', h.n) : ''}</div>
    <div class="refbox"><b>레이더 대기 중 (정상)</b>
      <div class="sub">레이더는 <b>예측픽</b>의 적중률만 감시합니다. 아직 예측픽이 0건이라 80% 판정을 하지 않습니다 — 고장이 아닙니다.</div>
      <div class="sub">예측픽이 ${mn}건 채점되면 자동으로 판정을 시작하고, 전체·최근 20·최근 50픽 중 한 구간이라도 80% 밑이면 즉시 가동(원인 추적 → 긴급 알림 → 학습 풀가동 → 기준 상향)합니다.</div>
      <div class="sub muted">참고 지표(추천·보류 1위)는 예측픽이 아니므로 레이더 판정에 쓰지 않습니다.</div></div>`;
}

/* global banner (all tabs) while the radar is active */
let RADAR_LAST = null;
function radarBannerRender(r) {
  const el = document.getElementById('radarBar');
  if (!el) return;
  if (!r || !r.active) { el.hidden = true; el.innerHTML = ''; return; }
  const a = (r.metrics || {}).last20 || {};
  el.hidden = false;
  el.innerHTML = `<button type="button" class="rdbar-btn" onclick="selectTab('perf');setTimeout(()=>{const p=document.getElementById('radarPanel');p&&p.scrollIntoView({block:'start'})},300)">🚨 ${r.demo ? '<span class="stb st-done">시연용 가상 데이터</span> ' : ''}<b>긴급 레이더 가동 중</b> · 최근 20픽 ${mcP(a.hit_rate)} (n=${a.n || 0}) &lt; 80% · ${r.learning ? '학습 풀가동 중' : '원인·조치 보기'} ›</button>`;
}
async function radarPoll() {
  try { RADAR_LAST = await fetch('/api/radar').then(r => r.ok ? r.json() : null); radarBannerRender(RADAR_LAST); } catch (e) { /* offline: keep last */ }
}
if (typeof document !== 'undefined' && document.getElementById) { setTimeout(radarPoll, 1500); setInterval(radarPoll, 60000); }

/* ---------- 📈 백테스트: 선별 픽 기준 ---------- */
function selRowHtml(r) {
  const BN = {model: '모델', blend: '모델 30%+배당 70%'};
  const e = r.effective, pooledRow = r.league.startsWith('_');
  const hr = x => x && x.hit_rate != null ? `<b>${mcP(x.hit_rate)}</b> <span class="muted">(${x.hits}/${x.n})</span>` : '–';
  let st, cls, body;
  if (r.status === 'ok') {
    st = '✅ 검증 통과'; cls = 'st-on';
    body = `기준 <b>${mcP0(r.threshold)}</b> · 검증 ${hr(r.val)} · 전체 기간 ${hr(r.all)} · 픽 비율 <b>${mcP(r.all.coverage)}</b>`;
  } else if (e && e.ok && e.status === 'ok_pooled') {
    const ap = (r.at_pooled || {}).all;
    st = '↪ 통합 기준 적용'; cls = 'st-done';
    body = `기준 <b>${mcP0(e.threshold)}</b>(축구 통합) · 리그 자체 ${ap && ap.n ? hr(ap) + (ap.n < 10 ? ' <span class="muted">표본 10 미만</span>' : '') : '해당 경기 없음'}${ap && ap.n ? ` · 픽 비율 ${mcP(ap.coverage)}` : ''}`
      + (r.best ? `<br><span class="muted">리그 단독으로는 80% 불가 (최고 ${mcP(r.best.hit_rate)} @${mcP0(r.best.t)}, n=${r.best.n})</span>` : '');
  } else {
    st = r.status === 'unreachable' ? '⛔ 80% 도달 불가 → 보류' : `⛔ ${esc(r.status_ko)} → 보류`; cls = 'st-off';
    body = (r.best ? `최고 ${mcP(r.best.hit_rate)} @기준 ${mcP0(r.best.t)} (n=${r.best.n})` : '') + (r.val && r.val.n ? ` · 검증 ${hr(r.val)}` : '')
      + (e && e.reason && e.reason.includes('; ') ? `<br><span class="muted">${esc(e.reason.split('; ').slice(1).join('; ').replace(/ → 보류$/, ''))}</span>` : '');
  }
  return `<div class="selrow ${pooledRow ? 'pooled' : ''}"><div class="selh"><span><b>${esc(r.name)}</b> <span class="muted sm">${BN[r.basis] || esc(r.basis)} · ${mcN(r.n_total)}경기 · 1위 적중 ${mcP0(r.top_pick_accuracy)}</span></span><span class="stb ${cls}">${st}</span></div>
    <div class="sub">${body}</div></div>`;
}
function selectiveHtml(s) {
  if (!s || !(s.rows || []).length) return `<div class="card pmeta" id="selCard"><h2 style="margin:0">🎯 선별 픽 적중률 목표 80%</h2><div class="muted">선별 기준 백테스트 계산 중입니다 (서버 시작 후 약 30초).</div></div>`;
  // a "group" row that equals its only league (MLB, KBO) is shown once
  const leagues = new Set(s.rows.filter(r => !r.league.startsWith('_')).map(r => r.league));
  const rows = s.rows.filter(r => !(r.league.startsWith('_') && leagues.has(r.league.slice(1))));
  const OTH = ['mlb', 'kbo', 'npb', 'nhl', 'kovo', 'wkovo'];
  const G = [['⚾ 야구', r => ['mlb', 'kbo', 'npb'].includes(r.league)], ['⚽ 축구', r => !OTH.includes(r.league)],
             ['🏒 아이스하키', r => r.league === 'nhl'], ['🏐 배구', r => ['kovo', 'wkovo'].includes(r.league)]];
  const body = G.map(([t, f]) => { const rs = rows.filter(f); return rs.length ? `<div class="sub selg">${t}</div>${rs.map(selRowHtml).join('')}` : ''; }).join('');
  return `<div class="card pmeta" id="selCard"><h2 style="margin:0">🎯 선별 픽 적중률 목표 80%</h2>
    <div class="muted">예측픽은 몬테카를로 ${mcN(s.n_sims)}회(최소 ${mcN(s.min_sims)}회 강제) 결과 1위 확률이 리그별 기준 이상일 때만 냅니다. 전 경기 80%는 불가능하므로(축구·야구 1위 적중률 약 50~58%) 확신 높은 경기만 고르고 나머지는 보류합니다. 숫자는 실제 과거 경기(표본 외 예측) 결과입니다.</div>
    ${body}
    <div class="sub" style="margin-top:8px">${esc(s.rule || '')}</div>
    <div class="muted sm">기준: ${Object.entries(s.bases || {}).map(([k, v]) => `${k === 'blend' ? '모델+배당' : '모델'} = ${esc(v)}`).join(' · ')} · 계산 ${kstFmt(s.fitted_at)} KST (${s.seconds || '–'}초) · 농구·UCL·J리그·NPB 등 과거 데이터가 없는 리그는 보류.</div></div>`;
}
if (typeof module !== 'undefined') module.exports = {mcPickHtml, mcBetsHtml, pickAccHtml, radarHtml, selectiveHtml};
