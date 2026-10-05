/* 🏆 검증된 최고 픽 (home + Proto): only selections from segments that beat break-even OUT OF SAMPLE
 * (/api/best-picks, app/best_picks.py). Also publishes window.BEST_CELLS so 주력 marking prefers them. */
(function () {
  const STYLE = `
  .bv { overflow:hidden; margin:8px 24px 4px; padding:10px 12px; border-radius:12px; background:linear-gradient(135deg,#0c2318,#101a2c 65%); border:1px solid #1f7a4d; min-width:0; }
  .bv-h { display:flex; align-items:center; gap:8px; min-width:0; }
  .bv-h h2 { margin:0; font-size:15.5px; white-space:nowrap; }
  .bv-h .sub2 { font-size:11px; color:#86efac; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; text-align:right; }
  .bv-sum { font-size:12.5px; color:#e8edf5; margin-top:6px; line-height:1.5; overflow-wrap:anywhere; }
  .bv-sum b.z { color:#fcd34d; } .bv-sum b.ok { color:#4ade80; }
  .bv-list { list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .bv-it { display:block; width:100%; text-align:left; font:inherit; color:inherit; background:#0f1728; border:2px solid #22c55e; border-radius:9px; padding:7px 9px; cursor:pointer; min-width:0; }
  .bv-it.watch { border:1px dashed #64748b; cursor:pointer; }
  .bv-r1 { display:flex; gap:6px; font-size:11.5px; color:#94a3b8; min-width:0; }
  .bv-tm { font-size:13.5px; font-weight:700; color:#e8edf5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
  .bv-r2 { display:flex; align-items:baseline; gap:6px; margin-top:2px; font-size:12.5px; min-width:0; }
  .bv-pk { color:#86efac; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:1; }
  .bv-od { flex:0 0 auto; font-weight:800; font-size:15px; color:#fff; }
  .bv-r3 { font-size:11px; color:#c5cedd; margin-top:2px; overflow-wrap:anywhere; }
  .bv-r3 .good { color:#4ade80; font-weight:700; } .bv-r3 .neg { color:#f87171; }
  .bv-d { margin-top:6px; font-size:11.5px; color:#c5cedd; }
  .bv-d summary { cursor:pointer; color:#93c5fd; min-height:32px; display:flex; align-items:center; }
  .bv-d h4 { margin:8px 0 3px; font-size:12px; color:#e8edf5; }
  .bv-t { width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px; }
  .bv-t td, .bv-t th { padding:2px 3px; border-bottom:1px solid #1e293b; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bv-t td:first-child, .bv-t th:first-child { text-align:left; width:44%; white-space:normal; overflow-wrap:anywhere; }
  .bv-t.c2 td { white-space:normal; line-height:1.35; } .bv-t.c2 td:first-child { width:46%; }
  .bv-t .good { color:#4ade80; } .bv-t .neg { color:#f87171; }
  .bv-ft { font-size:10.5px; color:#94a3b8; margin-top:6px; line-height:1.45; overflow-wrap:anywhere; }
  @media (max-width: 640px) { .bv { margin:6px 12px 4px; padding:9px 10px; } }`;
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);

  const e = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const P = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
  const R = x => x == null ? '–' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  const rc = x => x == null ? '' : x > 0 ? 'good' : 'neg';
  const KO = iso => iso ? new Date(iso).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}) : '–';
  const S = {data: null};
  window.BEST_CELLS = new Set();
  const box = () => document.getElementById('bestVal');
  const visible = () => (typeof sport !== 'undefined') && ((typeof SPORT_TABS !== 'undefined' && SPORT_TABS.includes(sport)) || sport === 'proto');
  const st3 = s => s && s.n ? `${s.hits}/${s.n} · ${P(s.hit)} · ROI <span class="${rc(s.roi)}">${R(s.roi)}</span>` : 'n=0';

  function item(p, watch, i) {
    const ds = p.key ? `data-src="proto" data-year="${p.y}" data-round="${p.r}" data-key="${e(p.key)}"` : p.game_ref ? `data-src="app" data-sport="${e(p.sport)}" data-id="${e(p.game_ref)}"` : '';
    const o = p.oos || {};
    return `<li><button type="button" class="bv-it ${watch ? 'watch' : ''}" ${ds}>
      <div class="bv-r1"><span class="bv-tm">${e(p.title || '')}</span><span>${KO(p.kickoff)}</span></div>
      <div class="bv-r2"><span class="bv-pk">${watch ? '' : '✅ '}${e(p.bet_type || '')} ${e(p.label || '')} · ${e(p.kind_ko)}</span><span class="bv-od">${p.odds ? p.odds.toFixed(2) : '–'}</span></div>
      <div class="bv-r3">${e(p.segment)} — 표본 밖 ${o.hits}/${o.n} 적중 ${P(o.hit)} (손익분기 ${P(o.breakeven)}) · ROI <span class="${rc(o.roi)}">${R(o.roi)}</span>${o.n < 30 ? ' · <span class="neg">표본 적음</span>' : ''}</div></button></li>`;
  }

  function detail(d) {
    const wf = d.walk_forward || {}, rows = [];
    for (const [k, v] of Object.entries(wf.before || {})) rows.push(`<tr><td>${e(k)}</td><td>${v.n}</td><td>${P(v.hit)}</td><td class="${rc(v.roi)}">${R(v.roi)}</td></tr>`);
    const a = wf.after_bh || {};
    rows.push(`<tr><td><b>검증 규칙(이번 기능)</b></td><td>${a.n || 0}</td><td>${P(a.hit)}</td><td class="${rc(a.roi)}">${a.n ? R(a.roi) : '선택 없음'}</td></tr>`);
    const kinds = Object.values(d.by_kind || {}).sort((x, y) => y.n - x.n).map(v => `<tr><td>${e(v.name)}</td><td>${v.n}</td><td>${P(v.hit)}</td><td class="${rc(v.roi)}">${R(v.roi)}</td></tr>`).join('');
    const weak = (d.weak || []).slice(0, 8).map(v => `<tr><td>${e(v.label)}</td><td>${v.all.n}</td><td>${P(v.all.hit)}</td><td class="neg">${R(v.all.roi)}</td></tr>`).join('');
    const cand = (d.candidates_detail || []).map(c => `<tr><td>${e(c.label)}</td><td>${c.disc.hits}/${c.disc.n} ${P(c.disc.hit)}<br><span class="${rc(c.disc.roi)}">${R(c.disc.roi)}</span></td><td>${c.oos.hits}/${c.oos.n} ${P(c.oos.hit)}<br><span class="${rc(c.oos.roi)}">${R(c.oos.roi)}</span></td></tr>`).join('');
    const cal = (d.recalibration || []).map(c => `<tr><td>${e(c.name)}</td><td>${c.before ? c.before.logloss : '–'}</td><td>${c.after ? c.after.logloss : '–'}</td><td class="${c.adopted ? 'good' : 'neg'}">${c.adopted ? '채택' : '기각'}</td></tr>`).join('');
    const sp = d.split || {};
    return `<details class="bv-d"><summary>📋 검증 상세 (규칙 · 전후 비교 · 약한 구간)</summary>
      <div class="bv-ft">채점 기록 ${d.n_records}건 (${e(d.days[0])} ~ ${e(d.days[d.days.length - 1])}). 발견 ${e((sp.discovery || []).join('~'))} → 확인 ${e((sp.confirm || []).join('~'))}.<br>
      ① ${e(d.rules.discovery)}<br>② ${e(d.rules.confirm)}<br>③ ${e(d.rules.walk_forward)}</div>
      ${cand ? `<h4>발견 단계 후보 → 표본 밖 확인 결과</h4><table class="bv-t c2"><tr><th>구간</th><th>발견 기간</th><th>확인 기간</th></tr>${cand}</table>` : ''}
      <h4>표본 밖 전후 비교 (${(wf.test_days || []).length}일, 매일 전날까지만 학습)</h4>
      <table class="bv-t"><tr><th>방식</th><th>n</th><th>적중</th><th>ROI</th></tr>${rows.join('')}</table>
      <h4>픽 종류별 전체 성적</h4><table class="bv-t"><tr><th>종류</th><th>n</th><th>적중</th><th>ROI</th></tr>${kinds}</table>
      ${weak ? `<h4>⚠ 검증된 약한 구간 (다중검정 보정 후에도 손익분기 미달)</h4><table class="bv-t"><tr><th>구간</th><th>n</th><th>적중</th><th>ROI</th></tr>${weak}</table>` : ''}
      ${cal ? `<h4>확률 재보정 (표본 밖 로그손실)</h4><table class="bv-t"><tr><th>방법</th><th>현재</th><th>재보정</th><th>결과</th></tr>${cal}</table>` : ''}
      <div class="bv-ft">ROI = 고정 시점 배당 1단위 균등 가정. 통계적 추정이며 베팅 권유가 아닙니다.</div></details>`;
  }

  function render() {
    const el = box();
    if (!el) return;
    el.hidden = !visible();
    const d = S.data;
    if (!d) { el.innerHTML = `<div class="bv-h"><h2>🏆 검증된 최고 픽</h2><span class="sub2">불러오는 중…</span></div>`; return; }
    if (d.error) { el.innerHTML = `<div class="bv-h"><h2>🏆 검증된 최고 픽</h2><span class="sub2">불러오기 실패</span></div>`; return; }
    const n = d.picks.length, wk = d.weak_today || {n: 0};
    let sum;
    if (n) sum = `오늘·현재 회차 후보 ${d.n_candidates}개 중 <b class="ok">${n}개</b>가 표본 밖에서 검증된 구간에 속합니다 (오늘 경기 ${d.n_today}개).`;
    else sum = `<b class="z">오늘 검증 통과 픽 0개</b> — 채점 ${d.n_records}건에서 손익분기(1/배당)를 넘는 구간이 표본 밖에서 확인되지 않았습니다. `
      + `발견 단계 후보 ${d.candidates || 0}개${d.candidates ? '는 모두 이후 경기에서 수익률이 마이너스로 돌아섰습니다' : ''}. 억지로 고르지 않고 비워 둡니다.`;
    const wl = wk.n ? `<div class="bv-ft">⚠ 오늘 후보 중 <b>${wk.n}개</b>는 검증된 약한 구간입니다 (예: ${e(wk.items[0].segment)} ROI ${R(wk.items[0].all.roi)}).</div>` : '';
    const watch = (d.watch || []).slice(0, 3);
    el.innerHTML = `<div class="bv-h"><h2>🏆 검증된 최고 픽</h2><span class="sub2">학습 ${e(d.fitted_kst || '')}</span></div>
      <div class="bv-sum">${sum}</div>
      ${n ? `<ul class="bv-list">${d.picks.slice(0, 8).map((p, i) => item(p, false, i)).join('')}</ul>` : ''}
      ${watch.length ? `<div class="bv-ft">참고(검증 미달·표본 적음): 표본 밖 수익은 났지만 통계적으로 확정되지 않은 구간</div><ul class="bv-list">${watch.map((p, i) => item(p, true, i)).join('')}</ul>` : ''}
      ${wl}${detail(d)}`;
    el.querySelectorAll('.bv-it[data-src]').forEach(b => b.onclick = () => { if (typeof openTarget === 'function') openTarget(b.dataset); });
  }

  async function load() {
    try {
      const r = await fetch('/api/best-picks');
      const j = await r.json();
      if (!r.ok || !j.picks) throw new Error(j.detail || ('HTTP ' + r.status));
      S.data = j;
      const before = [...window.BEST_CELLS].join(',');
      window.BEST_CELLS = new Set(j.main_cells || []);
      if (before !== [...window.BEST_CELLS].join(',') && typeof protoRenderSoon === 'function' && typeof sport !== 'undefined' && sport === 'proto') protoRenderSoon();
    } catch (x) { if (!S.data) S.data = {error: String(x.message || x)}; }
    render();
  }
  window.bestValLoad = load;
  window.bestValSync = () => { const el = box(); if (el) el.hidden = !visible(); };
  setInterval(() => { if (!document.hidden && visible()) load(); }, 120000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
  if (typeof module !== 'undefined') module.exports = {render, S};
})();
