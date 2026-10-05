/* 📊 예측 성적 — tabs 1순위 · 2순위 · AI 예측 (user 2026-10-05). Each tab = the real live picks frozen at kickoff and
 * graded ONLY with the confirmed official result (app/proto.official_outcome; app games: ESPN/Naver final score):
 *   ✅ 적중 / ❌ 미적중 / ⏳ 대기 (not final or not confirmed yet) / 취소 (취소·연기·적중특례 → not graded).
 * Summary "적중 N · 미적중 M · 적중률 X%" + a per-match list (date, match, pick, odds, final score, result).
 * No 백테스트 / 재계산 rows (deleted), no "실시간" wording. ★유력, 🧠 심리, 구 1.75+ and 가치 records stay in
 * data/marks.sqlite (flagged hidden in the API) but are never shown. Data: /api/marks/record?sport=… (app/marks.py). */
(function () {
  const STYLE = `
  .rc-tabs { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
  .rc-tab { flex:1 1 30%; min-width:0; min-height:44px; border-radius:10px; border:2px solid var(--border); background:var(--inset); color:var(--text);
    font:inherit; font-weight:800; font-size:13px; padding:0 4px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rc-tab.jr_main.on { border-color:#facc15; background:rgba(250,204,21,.18); color:#fde047; }
  .rc-tab.jr_sub.on { border-color:#7dd3fc; background:rgba(125,211,252,.14); color:#bae6fd; }
  .rc-tab.ai.on { border-color:#c084fc; background:rgba(192,132,252,.14); color:#e9d5ff; }
  .rc-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .rc-chips .chip { cursor:pointer; }
  .rc-kpi { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:6px; margin-top:10px; }
  .rc-kpi > div { background:var(--inset); border:1px solid var(--border); border-radius:10px; padding:8px; min-width:0; text-align:center; }
  .rc-kpi b { display:block; font-size:21px; white-space:nowrap; } .rc-kpi span { font-size:11.5px; color:var(--muted); display:block; overflow-wrap:anywhere; }
  .rc-kpi .h b { color:#4ade80; } .rc-kpi .m b { color:#f87171; }
  .rc-sum { margin-top:8px; font-size:14px; font-weight:800; overflow-wrap:anywhere; }
  .rc-sub { margin-top:3px; font-size:11.5px; color:var(--muted); overflow-wrap:anywhere; }
  .rc-trend { margin-top:6px; font-size:12.5px; font-weight:700; color:#fbbf24; overflow-wrap:anywhere; }
  .rc-t { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12.5px; margin-top:6px; }
  .rc-t th, .rc-t td { padding:5px 4px; border-bottom:1px solid var(--divider); text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rc-t th:first-child, .rc-t td:first-child { text-align:left; width:34%; }
  .rc-list { list-style:none; margin:6px 0 0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .rc-it { background:var(--inset); border:1px solid var(--border); border-radius:10px; padding:7px 9px; min-width:0; border-left-width:4px; }
  .rc-it.hit { border-left-color:#22c55e; } .rc-it.miss { border-left-color:#ef4444; } .rc-it.pending { border-left-color:#64748b; } .rc-it.void { border-left-color:#a3a3a3; opacity:.8; }
  .rc-r1 { display:flex; gap:6px; font-size:11.5px; color:var(--muted); min-width:0; } .rc-r1 .lg { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .rc-r2 { display:flex; gap:6px; align-items:baseline; margin-top:2px; min-width:0; }
  .rc-tm { flex:1; min-width:0; font-weight:700; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rc-st { flex:0 0 auto; font-size:12.5px; font-weight:800; padding:1px 7px; border-radius:7px; white-space:nowrap; }
  .rc-st.hit { background:#10331f; color:#4ade80; } .rc-st.miss { background:#3a1212; color:#fca5a5; }
  .rc-st.pending { background:#1e293b; color:#cbd5e1; } .rc-st.void { background:#262626; color:#d4d4d4; }
  .rc-r3 { display:flex; gap:6px; font-size:12.5px; margin-top:2px; min-width:0; }
  .rc-cell { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rc-od { flex:0 0 auto; font-weight:800; }
  .rc-sc { flex:0 0 auto; font-weight:800; color:var(--text); }`;
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
  const e = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const P = x => x == null ? '–' : (x * 100).toFixed(1) + '%';
  const R = x => x == null ? '–' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  const DT = iso => iso ? new Date(iso).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}) : '–';
  const TABS = ['jr_main', 'jr_sub', 'ai'];          // the only tabs (1순위 · 2순위 · AI 예측)
  const REC = window.REC = {mark: 'jr_main', sport: '', data: null, err: null};
  const SPK = {soccer: '축구', baseball: '야구', basketball: '농구', volleyball: '배구', hockey: '아이스하키'};
  const STK = {hit: '✅ 적중', miss: '❌ 미적중', pending: '⏳ 대기', void: '취소'};

  function tabData(d, k) { return k === 'ai' ? d.ai : (d.marks || {})[k]; }
  function cellText(r) {
    const bt = r.bet_type || '';
    const ln = r.line != null && bt !== '일반' && !bt.includes(String(Math.abs(r.line))) ? ` ${r.line > 0 && bt === '핸디캡' ? '+' : ''}${r.line}` : '';
    return `${bt}${ln} ${r.label || ''}`.trim();
  }
  function sumText(s) { return s && s.n ? `적중 ${s.hits} · 미적중 ${s.misses} · 적중률 ${P(s.hit_rate)}` : '아직 채점된 경기가 없습니다'; }
  function render() {
    const v = document.getElementById('perfView');
    if (!v) return;
    const d = REC.data;
    if (!d) { v.innerHTML = REC.err ? `<div class="errbox" role="alert">⚠️ 예측 성적 불러오기 실패: ${e(REC.err)}</div>` : '<div class="card"><div class="skel"><i class="s"></i><i></i><i></i></div></div>'; return; }
    const keys = TABS.filter(k => tabData(d, k));
    if (!keys.length) { v.innerHTML = '<div class="card"><div class="muted">예측 성적 기록이 아직 없습니다.</div></div>'; return; }
    if (!keys.includes(REC.mark)) REC.mark = keys[0];
    const M = tabData(d, REC.mark), s = M.summary || {};
    const tabs = keys.map(k => [k, tabData(d, k)]).map(([k, x]) => `<button type="button" class="rc-tab ${k} ${k === REC.mark ? 'on' : ''}" data-mark="${k}" aria-pressed="${k === REC.mark}">${e(x.name)} <span style="font-weight:600">${x.summary && x.summary.n ? P(x.summary.hit_rate) : ''}</span></button>`).join('');
    const sports = ['', ...(d.sports || [])].map(sp => `<span class="chip ${sp === REC.sport ? 'active' : ''}" data-sp="${e(sp)}">${sp ? e(SPK[sp] || sp) : '전체 종목'}</span>`).join('');
    const days = (M.by_day || []).map(x => `<tr><td>${e(x.k)}</td><td>${x.hits}</td><td>${x.misses}</td><td>${P(x.hit_rate)}</td></tr>`).join('');
    const spRows = !REC.sport && (M.by_sport || []).length ? `<div class="card" style="margin-top:10px"><h3 style="margin:0">종목별</h3><table class="rc-t"><tr><th>종목</th><th>적중</th><th>미적중</th><th>적중률</th></tr>${M.by_sport.map(x => `<tr><td>${e(x.name)}</td><td>${x.hits}</td><td>${x.misses}</td><td>${P(x.hit_rate)}</td></tr>`).join('')}</table></div>` : '';
    const list = (M.list || []).map(r => `<li class="rc-it ${r.status}">
        <div class="rc-r1"><span class="lg">${DT(r.kickoff)} · ${e(SPK[r.sport] || r.sport || '')} · ${e(r.league || '')}</span></div>
        <div class="rc-r2"><span class="rc-tm">${e(r.home)} vs ${e(r.away)}</span><span class="rc-st ${r.status}">${STK[r.status] || ''}</span></div>
        <div class="rc-r3"><span class="rc-cell">픽 ${e(cellText(r))}</span><span class="rc-od">@${r.odds ? Number(r.odds).toFixed(2) : '–'}</span><span class="rc-sc">${r.status === 'void' ? e(r.void_why || '취소') : r.score ? '최종 ' + e(r.score) : r.status === 'pending' ? '결과 대기' : ''}</span></div></li>`).join('');
    v.innerHTML = `<div class="card pmeta"><h2 style="margin:0">📊 예측 성적 <span class="muted" style="font-size:13px">1순위 · 2순위 · AI 예측</span></h2>
      <div class="rc-tabs">${tabs}</div>
      <div class="rc-chips">${sports}</div>
      <div class="muted sm" style="margin-top:8px">${e(M.name)} = ${e(M.desc)}</div>
      <div class="rc-kpi"><div class="h"><b>${s.hits ?? 0}</b><span>✅ 적중</span></div><div class="m"><b>${s.misses ?? 0}</b><span>❌ 미적중</span></div><div><b>${P(s.hit_rate)}</b><span>적중률</span></div></div>
      <div class="rc-sum">${e(sumText(s))}</div>
      ${M.trend && M.trend.text ? `<div class="rc-trend">📉 최근 추세 · ${e(M.trend.text)}</div>` : ''}
      <div class="rc-sub">${s.pending ? `⏳ 대기 ${s.pending}경기 · ` : ''}${s.void ? `취소 ${s.void}경기 · ` : ''}${s.roi != null ? `참고 ROI ${R(s.roi)} (1단위)` : ''}</div></div>
      <div class="card" style="margin-top:10px"><h3 style="margin:0">경기별 결과 <span class="muted" style="font-size:12px">${(M.list || []).length}경기</span></h3>
        ${list ? `<ul class="rc-list">${list}</ul>` : '<div class="muted">아직 기록된 경기가 없습니다.</div>'}</div>
      <div class="card" style="margin-top:10px"><h3 style="margin:0">날짜별</h3>
        ${days ? `<table class="rc-t"><tr><th>날짜</th><th>적중</th><th>미적중</th><th>적중률</th></tr>${days}</table>` : '<div class="muted">아직 채점된 경기가 없습니다.</div>'}</div>
      ${spRows}
      <div class="pdisc" style="margin-top:10px">⚠️ ${e(d.note)}</div>`;
    v.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => { REC.mark = b.dataset.mark; REC.userPicked = true; render(); });
    v.querySelectorAll('[data-sp]').forEach(c => c.onclick = () => { REC.sport = c.dataset.sp; load(); });
  }
  async function load() {
    try {
      const r = await fetch('/api/marks/record' + (REC.sport ? `?sport=${encodeURIComponent(REC.sport)}` : ''));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      REC.data = await r.json(); REC.err = null;
    } catch (x) { REC.err = String(x.message || x); }
    render();
    // the global 🚨 radar banner keeps working although its panel is no longer shown here
    if (typeof radarBannerRender === 'function') fetch('/api/radar').then(r => r.ok ? r.json() : null).then(rd => rd && radarBannerRender(rd)).catch(() => {});
  }
  window.recordLoad = load;
})();
