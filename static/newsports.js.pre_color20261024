/* 🏒 아이스하키 · 🏐 배구 tabs: per-card market/set details and the tab header (season state, schedule, real backtest). */
(function () {
  const st = document.createElement('style');
  st.textContent = `
  .ns-box { background:var(--surface); border:1px solid var(--border); border-radius:var(--r-lg); padding:12px 14px; margin:4px 0 12px; font-size:var(--fs-sm); line-height:1.55; }
  .ns-box h3 { margin:0 0 6px; font-size:var(--fs); }
  .ns-box details { margin-top:6px; } .ns-box summary { min-height:var(--tap); display:flex; align-items:center; cursor:pointer; font-weight:600; }
  .ns-sched { list-style:none; margin:6px 0 0; padding:0; } .ns-sched li { display:flex; gap:8px; padding:6px 0; border-top:1px solid var(--divider); flex-wrap:wrap; }
  .ns-sched .t { flex:0 0 92px; color:var(--muted); font-variant-numeric:tabular-nums; } .ns-sched .m { flex:1 1 150px; min-width:0; }
  .ns-tag { display:inline-block; font-size:10.5px; font-weight:700; padding:1px 7px; border-radius:8px; background:#334155; color:#e2e8f0; margin-right:4px; }
  .ns-tag.pre { background:#78350f; color:#fde68a; } .ns-tag.live { background:#14532d; color:#bbf7d0; }
  .ns-sets { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; } .ns-sets span { background:var(--inset); border:1px solid var(--border); border-radius:6px; padding:1px 6px; font-variant-numeric:tabular-nums; }
  .ns-tbl { width:100%; border-collapse:collapse; font-size:var(--fs-xs); margin-top:6px; table-layout:fixed; }
  .ns-tbl td, .ns-tbl th { border-top:1px solid var(--divider); padding:5px 4px; text-align:left; overflow-wrap:anywhere; }
  .ns-tbl th { color:var(--muted); font-weight:600; }`;
  document.head.appendChild(st);
})();
const NS = {info: {}, at: {}};
const nsPct = x => x == null ? '-' : (x * 100).toFixed(1) + '%';
const nsN = x => x == null ? '-' : (+x).toFixed(4);
async function nsLoad(sp) {
  if (NS.at[sp] && Date.now() - NS.at[sp] < 600000) return;
  NS.at[sp] = Date.now();
  try {
    const r = await fetch('/api/sport-info/' + sp);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    NS.info[sp] = await r.json();
    if (typeof sport !== 'undefined' && sport === sp && typeof render === 'function') render();
  } catch (e) { NS.at[sp] = 0; }
}
function nsSel(s) {
  if (!s) return '';
  const b = s.blend || {}, m = s.model || {}, best = (b.best || m.best);
  if (b.status === 'ok' || m.status === 'ok') return `선별 픽 기준 통과 (${esc(b.threshold || m.threshold)})`;
  return `80% 도달 기준 없음 → 예측픽은 항상 <b>보류</b>${best ? ` (최고 ${nsPct(best.hit_rate)}, n=${best.n})` : ''}`;
}
function sportHeader(sp) {
  if (sp !== 'hockey' && sp !== 'volleyball') return '';
  nsLoad(sp);
  const d = NS.info[sp];
  if (!d) return `<div class="ns-box muted">${sp === 'hockey' ? '🏒 NHL' : '🏐 V리그'} 정보 불러오는 중…</div>`;
  if (sp === 'hockey') {
    const bt = d.backtest || {}, ml = bt.ml || {}, mk = bt.market || {}, r3 = bt.reg3 || {}, tt = bt.totals || {}, pk = bt.puck || {};
    return `<div class="ns-box"><h3>🏒 NHL <span class="ns-tag live">정규시즌 진행 중</span></h3>
      <div class="muted">데이터: ${esc(d.source)}</div>
      <details><summary>📈 모델 백테스트 (${esc(bt.season || '')}, ${bt.n || 0}경기, 실제 결과)</summary>
      <table class="ns-tbl"><tr><th>항목</th><th>모델</th><th>비교</th></tr>
      <tr><td>머니라인 로그손실</td><td>${nsN(ml.logloss)} · 적중 ${nsPct(ml.acc)}</td><td>홈승률 기준 ${nsN(ml.base_logloss)}</td></tr>
      <tr><td>DraftKings 마감 대비</td><td>모델 ${nsN(mk.model_logloss)}</td><td>시장 ${nsN(mk.market_logloss)} · 30/70 혼합 ${nsN(mk.blend_logloss)} (적중 ${nsPct(mk.blend_acc)})</td></tr>
      <tr><td>정규 60분 3-way</td><td>${nsN(r3.logloss)} · 무 예측 ${nsPct(r3.pred_draw)}</td><td>기준 ${nsN(r3.base_logloss)} · 실제 무 ${nsPct(r3.obs_draw)}</td></tr>
      <tr><td>총점 (DK 라인)</td><td>${nsN(tt.model_logloss)} · 평균 ${tt.mean_pred_total ?? '-'}골</td><td>시장 ${nsN(tt.market_logloss)} · 실제 ${tt.mean_actual_total ?? '-'}골</td></tr>
      <tr><td>퍽라인 홈 −1.5</td><td>예측 ${nsPct(pk.pred)}</td><td>실제 ${nsPct(pk.obs)}</td></tr></table>
      <div class="muted" style="margin-top:6px">모델 단독은 시장보다 약하고(홈승률 기준과 비슷), 최종 확률은 시장 70% 혼합. ${nsSel(bt.selective)}</div>
      <div class="muted">${esc(d.rule)}</div></details></div>`;
  }
  const L = d.leagues || {}, B = d.backtest || {};
  const lg = Object.entries(L).map(([k, v]) => {
    const up = (v.upcoming || []).slice(0, 6).map(x => `<li><span class="t">${esc((x.start_kst || '').slice(5))}</span><span class="m"><span class="ns-tag">${esc(x.round)}</span>${esc(x.home)} vs ${esc(x.away)}${x.cancel ? ' <span class="bad">취소</span>' : ''}</span></li>`).join('');
    const b = B[k] || {}, mt = b.match || {}, ss = b.set_score || {}, tp = b.total_points || {};
    return `<div style="margin-top:8px"><b>${esc(v.name)}</b> ${v.preseason ? `<span class="ns-tag pre">시즌 시작 전</span> <span class="muted">정규리그 ${esc((v.regular_start || '').slice(5).replace('-', '/'))} 개막</span>` : '<span class="ns-tag live">시즌 중</span>'}
      ${up ? `<ul class="ns-sched">${up}</ul>` : '<div class="muted">45일 안 일정 없음</div>'}
      ${b.n ? `<details><summary>📈 백테스트 (${esc((b.period || []).join('~'))}, ${b.n}경기)</summary><table class="ns-tbl"><tr><th>항목</th><th>모델</th><th>기준</th></tr>
        <tr><td>승패 로그손실</td><td>${nsN(mt.logloss)} · 적중 ${nsPct(mt.acc)}</td><td>${nsN(mt.base_logloss)}</td></tr>
        <tr><td>세트스코어(6가지)</td><td>${nsN(ss.logloss)} · 적중 ${nsPct(ss.acc)}</td><td>${nsN(ss.base_logloss)}</td></tr>
        <tr><td>총점 평균오차</td><td>${tp.mae ?? '-'}점</td><td>${tp.base_mae ?? '-'}점</td></tr></table>
        <div class="muted">${nsSel({model: b.selective})}</div></details>` : ''}</div>`;
  }).join('');
  return `<div class="ns-box"><h3>🏐 배구 · V리그</h3><div class="muted">데이터: ${esc(d.source)} · 국제배구(AG남배 등)는 🎫 프로토 탭에서 FIVB 랭킹 모델로 분석</div>${lg}</div>`;
}
function sportExtra(g) {
  if (g.sport === 'hockey') {
    if (g.state === 'post') return g.ending && g.ending !== 'REG' ? `<div class="info">🏒 ${g.ending === 'SO' ? '승부샷' : '연장'} 승부 — 프로토 정규시간(승무패·핸디·언오버) 기준으로는 무승부</div>` : '';
    const h = g.hockey;
    if (!h) return '';
    const r = h.reg3 || [], pk = h.puck || {}, tt = h.total || {}, dk = pk.dk || {}, tk = tt.dk || {};
    const ln = pk.home_line, f = x => x == null ? '' : ` <span class="muted">(DK ${(+x).toFixed(2)})</span>`;
    return `<div class="info">🏒 정규 60분: 홈 <b>${nsPct(r[0])}</b> · 무 ${nsPct(r[1])} · 원정 ${nsPct(r[2])}<br>
      퍽라인 홈 ${ln > 0 ? '+' : ''}${ln}: <b>${nsPct(pk.home)}</b>${f(dk.home)} / 원정: ${nsPct(pk.away)}${f(dk.away)}<br>
      총점 ${tt.line}: 언더 ${nsPct(tt.under)}${f(tk.under)} / 오버 <b>${nsPct(tt.over)}</b>${f(tk.over)} <span class="muted">· 기대 ${h.exp_total}골</span><br>
      <span class="muted">${esc(h.basis)} · λ ${h.lambda_home}/${h.lambda_away} · 퍽라인·총점은 연장 포함(DK 기준)</span></div>`;
  }
  if (g.sport === 'volleyball') {
    const sets = (g.sets || []).map((s, i) => `<span>${i + 1}세트 ${s[0]}-${s[1]}</span>`).join('');
    const v = g.volley;
    let html = sets ? `<div class="ns-sets" aria-label="세트별 점수 (홈-원정)">${sets}</div>` : '';
    if (v && g.state === 'pre') {
      const top = (v.sets || []).map((p, i) => [p, v.set_keys[i]]).sort((a, b) => b[0] - a[0]).slice(0, 3);
      html += `<div class="info">🏐 세트스코어(홈-원정): ${top.map(([p, k]) => `${esc(k)} ${nsPct(p)}`).join(' · ')}<br>
        홈 −1.5세트: ${nsPct((v.hcp_15 || [])[0])} · 기대 총점 ${v.exp_total}점 <span class="muted">· 랠리 q=${v.q}${(g.model || {}).strength === 'ratings_partial' ? ' · 신규팀은 리그 평균 전력' : ''}</span></div>`;
    }
    return html;
  }
  return '';
}
