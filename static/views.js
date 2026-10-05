/* 역배 예상 tab + 추천 배팅유형 helpers */
const fmtP = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
const fmtEV = x => x == null ? 'EV –' : `EV ${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
function riskHtml(fl, inline) {
  if (!fl || !fl.length) return '';
  const t = fl.map(f => `${f.label}: ${f.detail || ''}${f.history ? ` (실전 n=${f.history.n}, 적중 ${(f.history.hit_rate * 100).toFixed(0)}% vs 예상 ${(f.history.expected * 100).toFixed(0)}%)` : ' (실전 검증 전 규칙)'}`).join(' · ');
  return inline ? ` <span class="risk" title="${esc(t)}">⚠ 적중 위험: ${fl.map(f => esc(f.label)).join(', ')}</span>`
    : `<div class="risk">⚠ 적중 위험: ${esc(t)}</div>`;
}
function calInfo(g) {
  const c = g.calibration;
  if (!c || !c.applied) return '';
  const k = 'home';
  return `<div class="sub">🧠 학습 보정 적용(${esc(c.source || '')}, ${esc(c.method || '')}): 순수 모델 홈 ${fmtP(c.before[k])} → ${fmtP(c.after[k])}</div>`;
}
function recHtml(r) {
  if (!r) return '';
  const o = x => `${esc(x.bet_type)} <b>${esc(x.label)}</b> ${fmtP(x.p)}${x.p_adj != null ? ` <span class="muted">(학습 보정 ${fmtP(x.p_adj)})</span>` : ''}${x.odds ? ` @${x.odds.toFixed(2)}` : ' <span class="muted">(배당 미발표)</span>'}${x.proven ? ` <span class="tag okt">✅ 검증 구간 ${(x.proven.hit_rate * 100).toFixed(0)}% (n=${x.proven.n})</span>` : ''}${riskHtml(x.risk, true)}`;
  let h = `<div class="rec">🎯 <b>추천 배팅유형</b>${r.closed ? ' <span class="muted">(발매 마감)</span>' : ''}${r.source_label ? ` <span class="muted">· ${esc(r.source_label)}</span>` : ''}<br>`;
  if (r.best_prob) h += `적중확률 최고: ${o(r.best_prob)}<br>`;
  if (r.best_ev) h += `EV 최고: ${o(r.best_ev)} <span class="${r.best_ev.ev > 0 ? 'good' : 'muted'}">${fmtEV(r.best_ev.ev)}</span><br>`;
  for (const f of r.flags || []) h += `<span class="fl ${f.kind}">${f.kind === 'upset' ? '🔥' : '💎'} ${esc(f.flag)}: ${esc(f.bet_type)} ${esc(f.label)} ${fmtP(f.p)} (시장 ${fmtP(f.p_market)}) @${f.odds ? f.odds.toFixed(2) : '-'} ${fmtEV(f.ev)}</span><br>`;
  if (r.note) h += `<span class="muted">${esc(r.note)}</span><br>`;
  if (r.missing_reasons && Object.keys(r.missing_reasons).length) h += `<span class="muted">계산 불가: ${Object.entries(r.missing_reasons).map(([k, v]) => `${esc(k)}(${esc(v)})`).join(', ')}</span>`;
  else if (!r.missing_reasons && r.not_computable && r.not_computable.length) h += `<span class="muted">확률 계산 불가: ${r.not_computable.map(esc).join(', ')}</span>`;
  return h + `</div>`;
}
async function upsetsLoad() {
  const v = document.getElementById('upsetView');
  try {
    const d = await fetch('/api/upsets').then(r => r.json());
    const cards = d.upsets.map((u, k) => `<div class="mc ucard ${u.level}">
      <div class="mc-h"><span>#${k + 1} · <span class="stb ${u.source === 'proto' ? 'st-live' : 'st-done'}">${u.source === 'proto' ? '프로토' : '앱(ESPN)'}</span> ${esc(u.league || '')} · ${kstFmt(u.kickoff)}</span><span class="muted">${esc(u.state)}</span></div>
      <div class="mc-t">${esc(u.home)}<span class="vs">vs</span>${esc(u.away)}</div>
      <div class="pk">${u.level === 'strong' ? '🔥' : '👀'} ${esc(u.pick)} <span class="muted">${esc(u.odds_label)}</span></div>
      <div class="nums"><span>시장 ${fmtP(u.market_p)}</span><span>앱 ${fmtP(u.model_p)}</span><span class="good">Edge +${(u.edge * 100).toFixed(1)}%p</span><span class="${u.ev > 0 ? 'good' : ''}">${fmtEV(u.ev)}</span></div>
      <div class="sub">${esc(u.basis)}</div><ul>${u.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`).join('');
    v.innerHTML = `<div class="card pmeta"><h2 style="margin:0">🔥 역배 예상 경기 <span class="muted">${d.n}건</span></h2>
      <div class="muted">앱 경기(ESPN 배당)와 프로토 승부식 ${d.proto_round ? d.proto_round[1] + '회차' : ''} 발매 중 항목을 합쳐 앱 확률 − 시장 내재확률(edge) 순으로 정렬. 자동 갱신.</div>
      <div class="pdisc">⚠️ ${esc(d.rule)}</div></div><div id="uaRadarMini" style="margin-top:12px"></div>` +
      (d.n ? `<div class="pgrid" style="margin-top:12px">${cards}</div>` : `<div class="empty">현재 조건을 만족하는 역배 후보가 없습니다.</div>`);
    if (typeof upsetRadarCard === 'function') upsetRadarCard(document.getElementById('uaRadarMini'));
  } catch (e) { v.innerHTML = `<div class="card bad">불러오기 실패: ${esc(String(e))}</div>`; }
}
const kstFmt = iso => iso ? new Date(iso).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}) : '–';
setInterval(() => { if (sport === 'upsets') upsetsLoad(); }, 60000);

/* 예측 성적 */
function aggRow(name, a) {
  return `<tr><td>${esc(name)}</td><td>${a.n}</td><td>${a.hit_rate == null ? '–' : (a.hit_rate * 100).toFixed(1) + '%'}</td><td>${a.expected_hit_rate == null ? '–' : (a.expected_hit_rate * 100).toFixed(1) + '%'}</td><td class="${a.roi > 0 ? 'good' : ''}">${a.roi == null ? '–' : (a.roi > 0 ? '+' : '') + (a.roi * 100).toFixed(1) + '%'}</td><td>${a.brier ?? '–'}</td><td>${a.logloss ?? '–'}</td></tr>`;
}
function aggTable(title, obj) {
  const rows = Object.entries(obj || {}).map(([k, a]) => aggRow(k, a)).join('');
  return `<div class="card" style="margin-top:12px"><h3 style="margin:0 0 6px">${title}</h3>${rows ? `<div class="tw"><table class="mt"><thead><tr><th>구분</th><th>n</th><th>적중률</th><th>예상</th><th>ROI</th><th>Brier</th><th>LogLoss</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="muted">아직 채점된 예측이 없습니다.</div>'}</div>`;
}
async function perfLoad() {
  if (typeof recordLoad === 'function') return recordLoad();   // 📊 예측 성적 = 1순위 / 2순위 records only (static/record.js)
  const v = document.getElementById('perfView');
  try {
    const [d, pa, rd, sel] = await Promise.all([fetch('/api/performance').then(r => r.json()),
      fetch('/api/pick-accuracy').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/radar').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/selective').then(r => r.ok ? r.json() : null).catch(() => null)]);
    if (rd && typeof radarBannerRender === 'function') radarBannerRender(rd);
    const o = d.overall, c = d.counts, u = d.upsets;
    const pc = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
    const recent = d.recent.map(r => `<div class="mc"><div class="mc-h"><span>${esc(r.kind_ko)} · ${esc(r.league || '')} · ${kstFmt(r.kickoff)}</span><span class="stb ${r.hit === 1 ? 'st-on' : r.hit === 0 ? 'st-live' : 'st-off'}">${r.hit === 1 ? '적중' : r.hit === 0 ? '실패' : '무효'}</span></div>
      <div class="mc-t">${esc(r.home)}<span class="vs">vs</span>${esc(r.away)}</div>
      <div class="sub">${esc(r.bet_type || '')}${r.line != null ? ' ' + r.line : ''} · 예측 <b>${esc(r.outcome_label)}</b> ${pc(r.p)}${r.odds ? ' @' + r.odds.toFixed(2) : ''} → 결과 ${esc(r.result || '')}${r.pnl != null ? ` · 손익 ${r.pnl > 0 ? '+' : ''}${r.pnl.toFixed(2)}` : ''}</div></div>`).join('');
    // reference stats for the empty 예측픽 / 레이더 panels (real numbers, labelled 참고)
    const ref = {rec: (d.by_kind || {})['추천(적중확률 최고)'] || null, held: (pa || {}).held_top_outcome || null, sel};
    const top = typeof pickAccHtml === 'function' ? pickAccHtml(pa, ref) + radarHtml(rd, ref) : '';
    v.innerHTML = top + `<div class="card pmeta" style="margin-top:12px"><h2 style="margin:0">📊 예측 성적 (자동 채점)</h2>
      <div class="kv"><div><b>${pc(o.hit_rate)}</b><span>전체 적중률 (n=${o.n})</span></div><div><b>${pc(o.expected_hit_rate)}</b><span>예측 확률 평균(기대 적중률)</span></div>
      <div><b class="${o.roi > 0 ? 'good' : ''}">${o.roi == null ? '–' : (o.roi > 0 ? '+' : '') + (o.roi * 100).toFixed(1) + '%'}</b><span>ROI (1단위, n=${o.n_with_odds})</span></div>
      <div><b>${pc(u.hit_rate)}</b><span>역배 후보 적중률 (n=${u.n}, ROI ${u.roi == null ? '–' : (u.roi * 100).toFixed(1) + '%'})</span></div>
      <div><b>${o.brier ?? '–'}</b><span>Brier / LogLoss ${o.logloss ?? '–'}</span></div>
      <div><b>${c.open}/${c.frozen_pending}/${c.graded}</b><span>기록 중 / 경기 중(고정) / 채점 완료 (무효 ${c.void})</span></div></div>
      <div class="pdisc">⚠️ ${esc(d.note)}</div></div>
      ${aggTable('유형별', d.by_kind)}${aggTable('배팅유형별', d.by_bet_type)}${aggTable('종목별', d.by_sport)}${aggTable('리그별', d.by_league)}
      <h2>최근 채점 결과</h2>${recent ? `<div class="pgrid">${recent}</div>` : '<div class="empty">아직 종료된 경기가 없습니다. 경기 시작 시 예측이 고정되고, 종료 후 자동 채점됩니다.</div>'}`;
  } catch (e) { v.innerHTML = `<div class="card bad">불러오기 실패: ${esc(String(e))}</div>`; }
}
setInterval(() => { if (sport === 'perf') perfLoad(); }, 60000);

/* 📈 백테스트 (trained model vs hand-tuned vs market) */
async function btLoad() {
  const v = document.getElementById('btView');
  const GN = {mlb: '⚾ MLB', kbo: '⚾ KBO', soccer: '⚽ 축구(7개 리그 통합)'};
  const mrow = (name, m, best) => m ? `<tr${best ? ' class="good"' : ''}><td>${name}</td><td>${m.n}</td><td>${(m.accuracy * 100).toFixed(1)}%</td><td>${m.logloss}</td><td>${m.brier}</td><td>${m.ece}</td></tr>` : '';
  const thead = '<thead><tr><th>모델</th><th>n</th><th>정확도</th><th>LogLoss</th><th>Brier</th><th>ECE</th></tr></thead>';
  try {
    const [d, sel] = await Promise.all([fetch('/api/backtest').then(r => r.json()),
      fetch('/api/selective').then(r => r.ok ? r.json() : null).catch(() => null)]);
    const cards = Object.entries(d.groups || {}).map(([g, r]) => {
      if (r.error) return `<div class="card"><h3>${GN[g] || g}</h3><div class="bad">학습 실패: ${esc(r.error)}</div></div>`;
      const ms = r.market_subset;
      const rel = (r.trained.reliability || []).map(b => `<tr><td>${b.bin}</td><td>${b.n}</td><td>${(b.pred * 100).toFixed(1)}%</td><td>${(b.actual * 100).toFixed(1)}%</td></tr>`).join('');
      return `<div class="card"><div class="mc-h"><h3 style="margin:0">${GN[g] || esc(g)}</h3><span class="stb ${r.deployed ? 'st-on' : 'st-off'}">${r.deployed ? '실서비스 적용' : '미적용(수제 모델 유지)'}</span></div>
        <div class="sub">경기 ${r.n_games} · 학습 ${r.n_train} (${r.train_period.join('~')}) · 홀드아웃 ${r.n_test} (${r.test_period.join('~')}) · 선택 모델 <b>${esc(r.model)}</b></div>
        <div class="tw"><table class="mt">${thead}<tbody>${mrow('학습 모델', r.trained, r.trained.logloss < r.hand_tuned.logloss)}${mrow('기존 수제 모델', r.hand_tuned, false)}</tbody></table></div>
        ${ms ? `<div class="sub" style="margin-top:6px">배당 있는 홀드아웃 경기(n=${ms.n}, ESPN DraftKings 머니라인, 마진 제거)</div>
        <div class="tw"><table class="mt">${thead}<tbody>${mrow('시장(배당)', ms.market, false)}${mrow('학습 모델', ms.trained, false)}${mrow('기존 수제 모델', ms.hand_tuned, false)}</tbody></table></div>` : `<div class="muted">${g === 'kbo' ? 'KBO는 과거 배당 출처가 없어 시장 비교 불가' : '배당 비교 표본 부족'}</div>`}
        <details><summary>신뢰도(보정) 표 — 최고 확률 구간별 예측 vs 실제</summary><div class="tw"><table class="mt"><thead><tr><th>구간</th><th>n</th><th>예측</th><th>실제</th></tr></thead><tbody>${rel}</tbody></table></div></details></div>`;
    }).join('');
    const meta = d.meta || {};
    v.innerHTML = `<div class="card pmeta"><h2 style="margin:0">📈 백테스트 · 학습 모델</h2>
      <div class="muted">실제 과거 경기 결과(ESPN·네이버)로 경기 전 시점 정보만 사용해 학습. 시간순 마지막 20%를 홀드아웃으로 1회 평가. 홀드아웃 LogLoss가 기존 수제 모델보다 낮을 때만 실서비스에 적용. 매일 06:00(KST) 자동 재학습.</div>
      <div class="sub">마지막 학습: ${kstFmt(meta.trained_at)} · 적용 중: ${(d.serving || []).map(x => GN[x] || x).join(', ') || '없음'}</div>
      <div class="pdisc">⚠️ ${esc(d.note)}</div></div>` +
      (typeof selectiveHtml === 'function' ? `<div style="margin-top:12px">${selectiveHtml(sel)}</div>` : '') +
      (cards ? `<div class="pgrid" style="margin-top:12px">${cards}</div>` : '<div class="empty">아직 학습된 모델이 없습니다.</div>');
  } catch (e) { v.innerHTML = `<div class="card bad">불러오기 실패: ${esc(String(e))}</div>`; }
}

/* 🎯 AI 픽 */
async function picksLoad() {
  const v = document.getElementById('picksView');
  const pc = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
  try {
    const d = await fetch('/api/picks').then(r => r.json());
    const src = Object.entries(d.sources || {}).map(([k, s]) => `<span class="stb ${s.ok ? 'st-on' : s.ok === false ? 'st-live' : 'st-off'}" title="${esc(s.detail || '')}">${esc(k)} ${s.ok ? '정상' : s.ok === false ? '불가' : '대기'}</span>`).join(' ');
    const cards = d.picks.map(p => {
      const outs = Object.keys(p.final_probs);
      const chips = outs.map(k => `<div class="oc2 ${k === p.pick ? 'best' : ''}"><b>${esc(p.labels[k])}</b><span>${pc(p.final_probs[k])}</span>${p.news_adj_pp[k] ? `<span class="${p.news_adj_pp[k] > 0 ? 'good' : 'bad'}">뉴스 ${p.news_adj_pp[k] > 0 ? '+' : ''}${p.news_adj_pp[k]}%p</span>` : ''}</div>`).join('');
      const rb = p.recommended_bet;
      const evs = (p.evidence || []).map(e => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a> <span class="muted">· ${esc(e.source || '')} · ${esc(e.via)}${e.date ? ' · ' + kstFmt(e.date) : ''}</span> ${(e.categories_ko || []).map(c => `<span class="tag">${esc(c)}</span>`).join('')}${e.team ? ` <span class="muted">(${e.team === 'home' ? esc(p.home) : esc(p.away)}${e.sign < 0 ? ' 불리' : e.sign > 0 ? ' 유리' : ''})</span>` : ''}${e.fact ? `<br><span class="sub">🤖 ${esc(e.fact)}</span>` : ''}${e.sign && e.team ? (e.counted ? ' <span class="tag">반영</span>' : ` <span class="tag">미반영: ${esc(e.why_not || '')}</span>`) : ''}${e.also && e.also.length ? ` <span class="muted">+같은 기사 ${e.also.length}곳</span>` : ''}</li>`).join('');
      return `<div class="mc"><div class="mc-h"><span>${p.source === 'proto' ? '<span class="stb st-live">프로토</span>' : '<span class="stb st-done">앱</span>'} ${esc(p.league || '')} · ${kstFmt(p.kickoff)}</span><span class="stb ${p.confidence_level === '높음' ? 'st-on' : p.confidence_level === '보통' ? 'st-done' : 'st-off'}">신뢰도 ${p.confidence_level}</span></div>
        <div class="mc-t">${esc(p.home)}<span class="vs">vs</span>${esc(p.away)}</div>
        <div class="pk">🎯 ${esc(p.pick_label)} <b>${pc(p.confidence)}</b>${p.odds ? ` <span class="muted">@${p.odds.toFixed(2)}</span> <span class="${p.ev > 0 ? 'good' : 'muted'}">${fmtEV(p.ev)}</span>` : ''}</div>
        <div class="ocrow">${chips}</div>
        ${rb ? `<div class="sub">추천 배팅유형: <b>${esc(rb.bet_type)} ${esc(rb.label)}</b> ${pc(rb.p)}${rb.odds ? ' @' + rb.odds.toFixed(2) : ''} ${rb.ev != null ? fmtEV(rb.ev) : ''}</div>` : ''}
        <ul>${p.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <details><summary>📰 근거 기사 ${p.evidence.length}건 (수집 ${p.n_news ?? 0}건)</summary>${evs ? `<ul class="evl">${evs}</ul>` : '<div class="muted">분류된 관련 기사 없음</div>'}</details></div>`;
    }).join('');
    v.innerHTML = `<div class="card pmeta"><h2 style="margin:0">🎯 AI 최종 픽 <span class="muted">${d.n}경기</span></h2>
      <div class="muted">${esc(d.method)}. 30분마다 자동 갱신 · 마지막: ${kstFmt(d.updated)}${d.running ? ' · 갱신 중…' : ''}</div>
      <div class="sub">소스: ${src}</div>${d.llm.note ? `<div class="sub muted">${d.llm.available ? '🤖 ' : ''}${esc(d.llm.note)}${d.llm.available ? ` · 분석 기사 ${d.llm.cached_articles ?? 0}건 · API 호출 ${d.llm.calls ?? 0}회${d.llm.last_error ? ' · 최근 오류: ' + esc(d.llm.last_error) : ''}` : ''}</div>` : ''}
      <div class="pdisc">⚠️ ${esc(d.disclaimer)}</div></div>` +
      (d.n ? `<div class="pgrid" style="margin-top:12px">${cards}</div>` : `<div class="empty">${d.updated ? '대상 경기가 없습니다.' : '첫 분석 실행 중입니다 (서버 시작 후 약 1~3분).'}</div>`);
  } catch (e) { v.innerHTML = `<div class="card bad">불러오기 실패: ${esc(String(e))}</div>`; }
}
setInterval(() => { if (sport === 'picks') picksLoad(); }, 120000);
