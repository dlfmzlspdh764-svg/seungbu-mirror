/* 🧠 오답 분석 · 학습 반영 (/api/misses, /api/learning) */
const CAT_KO = {miss: ['오답', 'st-live'], low_prob_hit: ['저확률 적중', 'st-on'], upset_hit: ['역배 적중', 'st-on']};
const GRP_KO = {mlb: '⚾ MLB', kbo: '⚾ KBO', soccer: '⚽ 축구(7개 리그)'};
const CAUSE_KO = {close_game: '접전 변동 (1점·1골 차/무승부)', model_wrong: '모델 오판 (시장이 더 정확)', market_wrong: '시장 오판 (모델이 더 정확)',
  upset: '이변 (모델·시장 모두 우세 예상)', _no_market: '(시장 배당 없음 → 시장 비교 불가)', _unexplained: '판별 가능한 원인 없음'};
const mpp = x => x == null ? '–' : (x > 0 ? '+' : '') + x.toFixed(1) + '%p';
const f4 = x => x == null ? '–' : x.toFixed(4);

function hbars(items, total, color) {
  const mx = Math.max(1, ...items.map(i => i.n));
  return items.map(i => `<div class="hb"><span class="lb">${esc(i.label)}</span><span class="nv">${i.n}${total ? ` · ${Math.round(i.n / total * 100)}%` : ''}</span>
    <div class="bar2"><i style="width:${(i.n / mx * 100).toFixed(1)}%;${color ? 'background:' + color : ''}"></i></div></div>`).join('');
}

function calChart(before, after, adopted) {
  const S = 300, P = 30, W = S - 2 * P;
  if (!adopted) after = [];
  const X = v => P + v * W, Y = v => S - P - v * W;
  const line = (pts, col) => pts.length ? `<polyline fill="none" stroke="${col}" stroke-width="2" points="${pts.map(b => `${X(b.pred).toFixed(1)},${Y(b.actual).toFixed(1)}`).join(' ')}"/>` +
    pts.map(b => `<circle cx="${X(b.pred).toFixed(1)}" cy="${Y(b.actual).toFixed(1)}" r="${Math.min(7, 2 + Math.sqrt(b.n) / 8).toFixed(1)}" fill="${col}" fill-opacity=".75"/>`).join('') : '';
  let grid = '';
  for (let i = 0; i <= 10; i += 2) {
    const v = i / 10;
    grid += `<line x1="${X(v)}" y1="${Y(0)}" x2="${X(v)}" y2="${Y(1)}" stroke="#1f2a40"/><line x1="${X(0)}" y1="${Y(v)}" x2="${X(1)}" y2="${Y(v)}" stroke="#1f2a40"/>` +
      `<text x="${X(v)}" y="${S - 10}" fill="#94a3b8" font-size="10" text-anchor="middle">${i * 10}</text><text x="${P - 6}" y="${Y(v) + 3}" fill="#94a3b8" font-size="10" text-anchor="end">${i * 10}</text>`;
  }
  return `<svg class="calchart" viewBox="0 0 ${S} ${S + 16}" role="img" aria-label="보정 차트">${grid}
    <line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="#64748b" stroke-dasharray="4 4"/>
    ${line(before || [], '#f87171')}${line(after || [], '#4ade80')}
    <text x="${S / 2}" y="${S + 12}" fill="#94a3b8" font-size="10" text-anchor="middle">예측 확률(%) → 세로축: 실제 빈도(%)</text></svg>
    <div class="lgd"><span><b style="background:#f87171"></b>보정 전</span>${adopted ? '<span><b style="background:#4ade80"></b>보정 후(채택)</span>' : '<span>미채택 → 보정 전 확률 그대로 사용</span>'}<span>점선 = 완벽 보정</span></div>`;
}

function mrows(rows, adopted) {
  return rows.map(([k, b, a]) => `<div class="mrow"><span>${k}</span><span>${b}</span><span class="${adopted && a && b && parseFloat(a) < parseFloat(b) ? 'good' : ''}">${a}</span></div>`).join('');
}

function missCard(r) {
  const [cat, cls] = CAT_KO[r.category] || [r.category, 'st-off'];
  const causes = (r.causes || []).map(c => `<div class="c"><div class="h"><span>${esc(c.label)}</span><span class="muted">신뢰도 ${Math.round(c.confidence * 100)}%</span></div>
    <div class="e">${esc(c.evidence)}</div><div class="confbar"><i style="width:${Math.round(c.confidence * 100)}%"></i></div></div>`).join('');
  const nod = (r.checks || []).filter(c => c.status === 'no_data').map(c => c.label);
  const nf = (r.checks || []).filter(c => c.status === 'not_found').map(c => c.label);
  return `<div class="mc"><div class="mc-h"><span>${esc(r.kind_ko || r.kind)} · ${esc(r.league || '')} · ${kstFmt(r.kickoff)}</span><span class="stb ${cls}">${cat}</span></div>
    <div class="mc-t">${esc(r.home || '')}<span class="vs">vs</span>${esc(r.away || '')}</div>
    <div class="sub">${esc(r.bet_type || '')}${r.line != null ? ' ' + r.line : ''} · 예측 <b>${esc(r.outcome_label || '')}</b> ${fmtP(r.p)}${r.odds ? ' @' + r.odds.toFixed(2) : ''} → 결과 ${esc(r.result || '')}</div>
    ${causes ? `<div class="cz">${causes}</div>` : `<div class="sub" style="margin-top:6px">🔍 ${esc(r.summary || '뚜렷한 원인 없음')}</div>`}
    ${nf.length ? `<div class="nd">확인했지만 해당 없음: ${nf.map(esc).join(', ')}</div>` : ''}
    ${nod.length ? `<div class="nd">원인 데이터 없음: ${nod.map(esc).join(', ')}</div>` : ''}
    ${r.data && r.data.snapshot === false ? '<div class="nd">⚠ 이 예측은 경기 전 스냅샷 수집 이전에 고정됨 → 비교 가능한 항목이 적음</div>' : ''}</div>`;
}

function segTable(list, cols) {
  if (!list || !list.length) return '<div class="muted">표본 없음</div>';
  return `<div class="tw"><table class="mt"><thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr></thead><tbody>${list.map(s => `<tr>${cols.map(c => `<td>${c[1](s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

async function missLoad() {
  const v = document.getElementById('missView');
  try {
    const [d, L] = await Promise.all([fetch('/api/misses').then(r => r.json()), fetch('/api/learning').then(r => r.json())]);
    const c = d.counts, pt = d.patterns || {}, cz = pt.causes || {};
    // ---- A. header + recent misses
    let h = `<div class="card pmeta"><h2 style="margin:0">🧠 오답 분석 · 학습</h2>
      <div class="kv"><div><b>${c.decided}</b><span>실전 채점 완료 (무효 ${c.void} 제외)</span></div><div><b>${c.miss}</b><span>분석된 오답</span></div>
      <div><b>${c.low_prob_hit + c.upset_hit}</b><span>저확률·역배 적중 분석</span></div><div><b>${c.frozen_pending}</b><span>경기 중(고정·채점 대기)</span></div>
      <div><b>${c.snapshots}</b><span>경기 전 스냅샷 수집</span></div><div><b>${c.open}</b><span>기록 중(경기 전)</span></div></div>
      <div class="muted">${esc(d.note)}</div>
      <div class="sub">자동 실행: ${esc(L.schedule)} · 마지막 분석 ${d.last_run && d.last_run.t ? kstFmt(new Date(d.last_run.t * 1000).toISOString()) : '–'}</div></div>`;
    h += `<div id="uaSec"><div class="card muted">🎲 역배 오답 분석 · 신뢰도 맵 불러오는 중…</div></div>`;
    h += `<h2 id="missSec">최근 오답과 원인</h2>` + (d.recent.length ? `<div class="pgrid">${d.recent.map(missCard).join('')}</div>` :
      `<div class="empty">아직 분석할 실전 오답이 없습니다 (채점 완료 ${c.decided}건). 경기 전 스냅샷 ${c.snapshots}건을 모으는 중이며, 경기가 끝나 채점되면 1분 안에 원인이 자동 분석됩니다.</div>`);
    // ---- B. cause distribution (real) + backtest
    h += `<h2>원인 분포</h2><div class="pgrid">`;
    h += `<div class="card"><h3 style="margin:0 0 6px">실전 오답 (n=${cz.n_miss || 0})</h3>${cz.any && cz.any.length ? hbars(cz.any.map(x => ({label: x.label, n: x.n})), cz.n_miss, '#f97316') +
      `<div class="nd">한 오답에 원인 여러 개 가능 · 주원인: ${(cz.primary || []).map(x => `${esc(x.label)} ${x.n}`).join(', ')}</div>` : '<div class="muted">실전 오답 없음</div>'}
      ${cz.no_data && cz.no_data.length ? `<div class="nd">원인 데이터 없음 빈도: ${cz.no_data.map(x => `${esc(x.label)} ${x.n}`).join(', ')}</div>` : ''}</div>`;
    for (const [g, b] of Object.entries(d.backtest || {})) {
      const mc = b.miss_causes; if (!mc) continue;
      const items = Object.entries(mc.counts).map(([k, n]) => ({label: CAUSE_KO[k] || k, n})).sort((a, b) => b.n - a.n);
      h += `<div class="card"><h3 style="margin:0 0 6px">${GRP_KO[g] || esc(g)} 백테스트 오답 (n=${mc.n_miss}/${mc.n_test})</h3>
        <div class="sub">홀드아웃 ${esc((b.test_period || []).join('~'))} · 과거 경기라 판별 가능한 원인만</div>${hbars(items, mc.n_miss)}
        <div class="nd">${esc(mc.note)}</div></div>`;
    }
    h += `</div>`;
    // ---- C. weakest segments / systematic biases
    h += `<h2>약한 구간 · 체계적 편향</h2><div class="pgrid">`;
    h += `<div class="card"><h3 style="margin:0 0 6px">실전 약한 구간 (적중률 − 예상)</h3>${pt.weakest && pt.weakest.length ? segTable(pt.weakest, [
      ['구분', s => `${esc(s.dim)}: ${esc(s.segment)}`], ['n', s => s.n], ['적중', s => fmtP(s.hit_rate)], ['예상', s => fmtP(s.expected)], ['차이', s => `<span class="${s.gap_pp < 0 ? 'bad' : 'good'}">${mpp(s.gap_pp)}</span>`], ['판정', s => esc(s.bias)]]) :
      '<div class="muted">실전 채점 표본이 없어 아직 계산할 수 없습니다. (판정은 n≥20, |z|≥2, 차이≥5%p일 때만 "과신/과소평가")</div>'}</div>`;
    for (const [g, b] of Object.entries(d.backtest || {})) {
      const p = b.patterns; if (!p) continue;
      h += `<div class="card"><h3 style="margin:0 0 6px">${GRP_KO[g] || esc(g)} 백테스트 확률 구간별 (최고 확률 픽)</h3>${segTable(p.buckets, [
        ['구간', s => s.bucket], ['n', s => s.n], ['예측', s => fmtP(s.pred)], ['실제', s => fmtP(s.actual)], ['차이', s => `<span class="${Math.abs(s.z) >= 2 ? (s.gap_pp < 0 ? 'bad' : 'good') : ''}">${mpp(s.gap_pp)}</span>`]])}
        ${p.leagues && p.leagues.length > 1 ? `<div class="sub" style="margin-top:6px">리그별 홈 승률: 예측 vs 실제 (홈 어드밴티지 오차)</div>${segTable(p.leagues, [
          ['리그', s => esc(s.league)], ['n', s => s.n], ['예측', s => fmtP(s.pred_home)], ['실제', s => fmtP(s.actual_home)], ['오차', s => `<span class="${Math.abs(s.z) >= 2 ? 'bad' : ''}">${mpp(s.home_gap_pp)}</span>`]])}` : ''}
        <div class="nd">빨간 차이 = |z| ≥ 2 (통계적으로 유의한 편향). 백테스트 OOS 예측 ${b.n_test ? '' : ''}기준.</div></div>`;
    }
    h += `</div>`;
    // ---- D. calibration chart + E. adopted corrections
    h += `<h2 id="learnSec">보정 차트 · 학습 반영 내역</h2><div class="muted" style="margin-bottom:8px">${esc(L.gate)}. 마지막 보정 적합: ${kstFmt(L.fitted_at)}</div><div class="pgrid">`;
    for (const [g, r] of Object.entries(L.groups || {})) {
      if (r.error) { h += `<div class="card"><h3>${GRP_KO[g] || g}</h3><div class="bad">${esc(r.error)}</div></div>`; continue; }
      const a = r.after, b = r.before, bc = r.blend_check;
      h += `<div class="card"><div class="mc-h"><h3 style="margin:0">${GRP_KO[g] || esc(g)}</h3><span class="stb ${r.adopted ? 'st-on' : 'st-off'}">${r.adopted ? '채택: ' + esc(r.adopted) : '미채택(원래 확률 유지)'}</span></div>
        <div class="sub">워크포워드 OOS ${r.n_oos}경기 · 적합 ${r.n_fit} (${esc(r.fit_period.join('~'))}) · 검증 ${r.n_test} (${esc(r.test_period.join('~'))})</div>
        ${calChart(r.reliability_before, r.reliability_after, !!r.adopted)}
        <div class="mrow" style="font-weight:700"><span>검증 구간 지표</span><span>보정 전</span><span>${r.adopted ? '보정 후' : '적용값(=전)'}</span></div>
        ${mrows([['LogLoss', f4(b.logloss), f4(a.logloss)], ['Brier', f4(b.brier), f4(a.brier)], ['ECE', f4(b.ece), f4(a.ece)], ['정확도', fmtP(b.accuracy), fmtP(a.accuracy)]], !!r.adopted)}
        ${(r.trials || []).concat(r.league_trial ? [r.league_trial] : []).map(t => `<div class="nd">• ${esc(t.method)}: LogLoss ${f4(t.after.logloss)}, Brier ${f4(t.after.brier)} — ${esc(t.reason)}</div>`).join('')}
        ${bc ? `<div class="nd">실제 서비스 확률(모델 30%+시장 70%) 기준, 배당 있는 검증 경기 ${bc.n}: LogLoss ${f4(bc.blend_before.logloss)} → ${f4(bc.blend_after.logloss)}, Brier ${f4(bc.blend_before.brier)} → ${f4(bc.blend_after.brier)} (시장 단독 ${f4(bc.market_only.logloss)})</div>` : ''}</div>`;
    }
    const pm = L.proto_market || {};
    h += `<div class="card"><div class="mc-h"><h3 style="margin:0">🎫 프로토 배당(마진 제거) 보정</h3><span class="stb ${pm.adopted ? 'st-on' : 'st-off'}">${pm.adopted ? '채택' : '미채택'}</span></div>
      ${pm.status === 'ok' ? `<div class="sub">p ∝ p^γ (인기·비인기 편향 보정) · 적합 ${pm.fit_rounds.map(x => x[1] + '회').join(',')} (n=${pm.n_fit}) → 검증 ${pm.test_round[1]}회 (n=${pm.n_test})</div>
      <div class="mrow" style="font-weight:700"><span>검증 회차 지표</span><span>보정 전</span><span>보정 후보</span></div>
      ${mrows([['LogLoss', f4(pm.before.logloss), f4(pm.after.logloss)], ['Brier', f4(pm.before.brier), f4(pm.after.brier)]], pm.adopted)}
      <div class="nd">γ(전체) ${pm.gamma_fit._all} · ${esc(pm.reason)} · 배당 기반(시장) 출처 확률에만 적용</div>` : `<div class="muted">${esc(pm.reason || '미실행')}</div>`}</div>`;
    // real-data learning status
    const R = L.real || {};
    const rs = Object.entries(R.groups || {}).map(([g, s]) => `<div class="mrow"><span>${GRP_KO[g] || esc(g)} 모델 보정 갱신</span><span>${s.n}/${s.min_n}</span><span>${s.adopted ? '<span class="good">채택</span>' : s.reason ? esc(s.reason) : '표본 부족'}</span></div>`).join('') +
      Object.entries(R.segments || {}).map(([k, s]) => `<div class="mrow"><span>프로토 ${esc(k)}</span><span>${s.n}/${s.min_n}</span><span>${s.adopted ? '<span class="good">채택</span>' : s.reason ? esc(s.reason).slice(0, 18) : '표본 부족'}</span></div>`).join('') +
      Object.entries(R.flags || {}).map(([k, s]) => `<div class="mrow"><span>⚠ ${esc((L.flags[k] || {}).label || k)}</span><span>${s.n}/${s.min_n}</span><span>적중 ${fmtP(s.hit_rate)} / 예상 ${fmtP(s.expected)}${s.adopted ? ` · α=${s.alpha}` : ''}</span></div>`).join('');
    h += `<div class="card"><h3 style="margin:0 0 6px">실전 채점 반영 상태</h3><div class="sub">실전 표본이 ${L.min_real}건 이상 쌓이면 백테스트 보정을 사전분포로 베이지안 갱신 → 시간순 검증 통과 시에만 채택 (표본이 늘수록 실전 가중 ↑)</div>
      ${rs || `<div class="muted">실전 채점 ${R.n_graded || 0}건 → 아직 갱신 대상 없음. 현재는 백테스트 보정만 사용.</div>`}
      <div class="nd">⚠ 적중 위험 규칙: ${Object.values(L.flags || {}).map(f => `${esc(f.label)}(${esc(f.rule)})`).join(' · ')}</div></div>`;
    h += `<div class="card"><h3 style="margin:0 0 6px">학습 반영 내역 (최근)</h3>${(L.corrections || []).slice(0, 24).map(x => `<div class="clog"><span class="k">${x.adopted ? '✅' : '⏸'} ${esc(x.scope)} · ${esc(GRP_KO[x.key] || x.key)} · ${esc(x.method)}</span> <span class="muted">${kstFmt(new Date(x.ts * 1000).toISOString())}</span><br>
      ${x.before && x.after ? `LogLoss ${f4(x.before.logloss)} → ${f4(x.after.logloss)} · Brier ${f4(x.before.brier)} → ${f4(x.after.brier)} (적합 ${x.n_fit}/검증 ${x.n_test}) · ` : ''}${esc(x.reason)}</div>`).join('') || '<div class="muted">기록 없음</div>'}</div>`;
    h += `</div>`;
    v.innerHTML = h;
    if (typeof upsetAnLoad === 'function') upsetAnLoad(document.getElementById('uaSec'));
  } catch (e) { v.innerHTML = `<div class="card bad">불러오기 실패: ${esc(String(e))}</div>`; }
}
setInterval(() => { if (sport === 'miss') missLoad(); }, 120000);
