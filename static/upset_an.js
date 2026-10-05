/* 🎲 역배 오답 분석 · 🗺 역배 신뢰도 맵 · 📡 역배 추적 레이더 (/api/upsets/analysis, /api/upsets/map, /api/upsets/radar).
   Real graded data only; every number carries n; cells with n < 10 are grey (표본 부족). */
(function () {
  const STYLE = `
  .ua-sec { margin:4px 0 14px; }
  .ua-sec h2 { margin:14px 0 8px; }
  .ua-sum { margin:8px 0 0; padding:0 0 0 18px; font-size:var(--fs-sm); line-height:1.55; color:var(--text-2); }
  .ua-sum li { margin:3px 0; overflow-wrap:anywhere; } .ua-sum .n { color:var(--muted); font-size:var(--fs-2xs); white-space:nowrap; }
  .ua-chips { display:flex; gap:6px; overflow-x:auto; padding:2px 0 6px; scrollbar-width:none; }
  .ua-chips::-webkit-scrollbar { display:none; }
  .ua-chips .chip { flex:0 0 auto; cursor:pointer; }
  .ua-sel { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:6px 0 8px; }
  .ua-sel label { font-size:var(--fs-xs); color:var(--muted); display:flex; flex-direction:column; gap:3px; min-width:0; }
  .ua-sel select { padding:6px 8px; font-size:14px; }
  .ua-gw { overflow-x:auto; margin:0 -2px; padding:0 2px 4px; }
  .ua-grid { display:grid; gap:3px; min-width:0; }
  .ua-h { font-size:var(--fs-2xs); color:var(--muted); display:flex; align-items:flex-end; justify-content:center; text-align:center; line-height:1.2; padding:2px; overflow-wrap:anywhere; }
  .ua-rl { font-size:var(--fs-2xs); color:var(--text-2); display:flex; align-items:center; line-height:1.2; padding:2px 4px 2px 0; overflow-wrap:anywhere; }
  .ua-c { min-height:var(--tap); min-width:0; border-radius:var(--r-xs); border:1px solid var(--border); background:var(--inset); color:var(--text); font:inherit; padding:3px 2px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1.15; }
  .ua-c b { font-size:15px; font-weight:800; } .ua-c small { font-size:10px; color:var(--text-2); white-space:nowrap; }
  .ua-c.red { background:#4a1a1f; border-color:#f87171; } .ua-c.green { background:#123a26; border-color:#34d399; }
  .ua-c.amber { background:#2d2410; border-color:#a16207; } .ua-c.grey { background:#1a2030; border-color:#2b3447; color:var(--muted); }
  .ua-c.sel { outline:2px solid #fff; outline-offset:1px; }
  .ua-c.empty { background:transparent; border:1px dashed #263044; cursor:default; }
  .ua-lg { display:flex; flex-wrap:wrap; gap:4px 10px; font-size:var(--fs-2xs); color:var(--muted); margin-top:6px; }
  .ua-lg i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:4px; vertical-align:-1px; }
  .ua-det { margin-top:10px; border-top:1px solid var(--border); padding-top:8px; }
  .ua-g { display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-sm); padding:6px 0; border-top:1px solid var(--divider, #1e2738); min-width:0; }
  .ua-g .t { min-width:0; overflow-wrap:anywhere; } .ua-g .r { flex:0 0 auto; text-align:right; white-space:nowrap; }
  .ua-b { display:inline-flex; align-items:center; gap:3px; padding:1px 7px; border-radius:999px; font-size:var(--fs-2xs); font-weight:700; white-space:nowrap; vertical-align:1px; }
  .ua-b.low { background:#4a1a1f; color:#fecaca; border:1px solid #f87171; } .ua-b.high { background:#123a26; color:#bbf7d0; border:1px solid #34d399; }
  .ua-b.neutral { background:#2d2410; color:#fde68a; border:1px solid #a16207; } .ua-b.insufficient { background:#1e293b; color:#cbd5e1; border:1px solid #334155; }
  .ua-it { border:1px solid var(--border); border-radius:var(--r-sm); padding:8px 9px; margin-top:6px; background:var(--inset); font-size:var(--fs-sm); overflow-wrap:anywhere; }
  .ua-it .why { font-size:var(--fs-xs); color:var(--text-2); margin-top:3px; }
  .ua-ev { font-size:var(--fs-xs); padding:5px 0; border-top:1px solid var(--divider, #1e2738); overflow-wrap:anywhere; }
  .ua-ev .k { color:var(--muted); font-size:var(--fs-2xs); }
  .ua-bt { display:grid; grid-template-columns:auto 1fr 1fr 1fr; gap:4px 8px; font-size:var(--fs-xs); align-items:center; }
  .ua-bt .hd { color:var(--muted); font-size:var(--fs-2xs); }
  .bu-rel { margin-top:3px; font-size:10.5px; color:#cbd5e1; overflow-wrap:anywhere; }
  `;
  const st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
  const e = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const P = (x, d = 1) => x == null ? '–' : (x * 100).toFixed(d) + '%';
  const R = x => x == null ? '–' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
  const KO = iso => iso ? new Date(iso).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}) : '–';
  const UA = window.UA_STATE = window.UA_STATE || {x: 'odds_band', y: 'gap', dim: 'gap', cell: null, map: null, an: null, radar: null};
  const PRESETS = [['odds_band', 'gap', '배당×차이'], ['odds_band', 'src', '배당×출처'], ['odds_band', 'league', '배당×리그'], ['odds_band', 'bet', '배당×유형'], ['odds_band', 'side', '배당×방향']];
  const COLKO = {red: '빨강 · 손익분기 유의 미달', green: '초록 · 손익분기 이상', amber: '노랑 · 유의하지 않음', grey: '회색 · 표본 부족(n<10)'};

  /* reliability badge used by the banner, the Proto card and the radar list */
  window.uaBadge = function (rel) {
    if (!rel || !rel.badge) return '';
    const sc = rel.score != null && rel.level !== 'insufficient' ? ` ${rel.score}` : '';
    return `<span class="ua-b ${e(rel.level)}" title="신뢰도 점수 (0–100)">${e(rel.badge)}${sc}</span>`;
  };
  window.uaRelLine = function (rel, demoted) {
    if (!rel && !demoted) return '';
    const parts = [];
    if (rel) {
      if (rel.score_cell) parts.push(`신뢰도 ${rel.score ?? '–'}/100 (${e(rel.score_cell)}, n=${rel.score_n})`);
      else parts.push('신뢰도 표본 부족');
      if (rel.adj_ev != null) parts.push(`보정 EV ${R(rel.adj_ev)}${rel.adj_capped ? ' (상한 = 원래 EV, 표본 부족으로 상향 안 함)' : ''}`);
      if (rel.level === 'low' && rel.reasons && rel.reasons.length) parts.push('⚠ ' + e(rel.reasons[0]));
    }
    if (demoted) parts.push(`↓ 강등: ${e(demoted.bet_type)} ${e(demoted.label)} @${(+demoted.odds).toFixed(2)} (낮은 신뢰)`);
    return parts.join(' · ');
  };

  function kpis(o) {
    return `<div class="kv"><div><b>${P(o.hit_rate)}</b><span>역배 적중률 (${o.hits}/${o.n})</span></div>
      <div><b>${P(o.expected)}</b><span>추정확률 평균 (기대)</span></div>
      <div><b>${P(o.breakeven)}</b><span>손익분기 1/배당 (평균 배당 ${o.avg_odds ?? '–'})</span></div>
      <div><b class="${o.roi > 0 ? 'good' : 'bad'}">${R(o.roi)}</b><span>ROI 1단위 (n=${o.n_roi})</span></div></div>
      <div class="sub">95% 구간 ${o.ci95 ? P(o.ci95[0]) + '–' + P(o.ci95[1]) : '–'} · 손익분기 미달 정확검정 p=${o.p_below_be ?? '–'} · 추정 과대 p=${o.p_below_exp ?? '–'}</div>`;
  }

  function segRows(list) {
    if (!list || !list.length) return '<div class="muted">표본 없음</div>';
    return `<div class="tw"><table class="mt"><thead><tr><th>구간</th><th>n</th><th>적중</th><th>예상</th><th>분기</th><th>ROI</th><th>판정</th></tr></thead><tbody>${list.map(s =>
      `<tr><td>${e(s.segment)}</td><td>${s.n}</td><td class="${s.verdict.startsWith('약점') ? 'bad' : ''}">${P(s.hit_rate, 0)}</td><td>${P(s.expected, 0)}</td><td>${P(s.breakeven, 0)}</td><td class="${s.roi > 0 ? 'good' : ''}">${R(s.roi)}</td><td>${e(s.small ? '표본 부족' : s.verdict.replace(/ \(.*\)/, ''))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function analysisHtml(d) {
    const a = d.analysis, o = a.overall, cal = a.calibration, cl = d.calibration_learning || {};
    const dims = Object.entries(a.dim_labels).filter(([k]) => k !== 'kind');
    let h = `<div class="card"><h3 style="margin:0">🎲 역배 오답 분석 <span class="muted" style="font-size:var(--fs-xs)">채점 ${a.n}건 (중복 제외, 원 기록 ${a.n_all}건)</span></h3>
      ${kpis(o)}
      <h4 style="margin:10px 0 2px">왜 역배 적중률이 낮은가 (실데이터 근거)</h4>
      <ul class="ua-sum">${a.summary.map(s => `<li>${e(s.text)} <span class="n">n=${s.n}</span></li>`).join('')}</ul>
      <div class="nd">${e(d.note)} · 맵 갱신 ${e(d.fitted_kst || '–')}</div></div>`;
    h += `<div class="card" style="margin-top:10px"><h3 style="margin:0 0 6px">예측 종류별</h3>${segRows(a.by_kind)}
      <h3 style="margin:12px 0 4px">구간별 분해</h3>
      <div class="ua-chips" role="tablist" aria-label="분해 기준">${dims.map(([k, v]) => `<button type="button" class="chip ${UA.dim === k ? 'active' : ''}" data-dim="${k}" role="tab" aria-selected="${UA.dim === k}">${e(v)}</button>`).join('')}</div>
      <div id="uaSeg">${segRows(a.dims[UA.dim])}</div>
      <div class="nd">분기 = 손익분기(1/배당 평균). 판정: n≥10에서 정확 검정(각 픽의 1/배당 기준) p&lt;0.05일 때만 '약점/강점'. 구간 ${a.n_tested}개를 동시에 보므로 BH 보정 q값도 함께 계산.</div></div>`;
    h += `<div class="card" style="margin-top:10px"><h3 style="margin:0 0 6px">보정 점검 (추정확률이 과대인가?)</h3>
      <div class="tw"><table class="mt"><thead><tr><th>추정 구간</th><th>n</th><th>추정</th><th>시장</th><th>실제</th><th>p(과대)</th></tr></thead><tbody>${cal.bins.map(b =>
        `<tr><td>${e(b.bin)}</td><td>${b.n}</td><td>${P(b.pred)}</td><td>${P(b.market)}</td><td>${P(b.actual)}</td><td>${b.p_below_exp}</td></tr>`).join('')}</tbody></table></div>
      ${cal.vs_market ? `<div class="sub" style="margin-top:6px">같은 ${cal.vs_market.n}건 LogLoss: 앱 ${cal.vs_market.served.logloss} · 시장 ${cal.vs_market.market.logloss}${cal.vs_market.model ? ' · 독립 추정 ' + cal.vs_market.model.logloss : ''} (낮을수록 정확)</div>` : ''}
      <div class="sub">학습(채택 게이트): ${e(cl.method || '')} — ${cl.adopted ? '<span class="good">채택</span>' : '<b>미채택</b>'} · ${e(cl.reason || '')}${cl.lambda_fit != null ? ` (λ=${cl.lambda_fit}, 적합 ${cl.n_fit}/검증 ${cl.n_test})` : ''}</div></div>`;
    const cz = a.causes;
    h += `<div class="card" style="margin-top:10px"><h3 style="margin:0 0 6px">역배 오답 원인 (n=${cz.n_analysed}/${cz.n_miss})</h3>
      ${cz.any.length ? cz.any.slice(0, 8).map(c => `<div class="mrow"><span>${e(c.label)}</span><span>${c.n}</span><span>${P(c.share, 0)}</span></div>`).join('') : '<div class="muted">분석된 오답 없음</div>'}
      <div class="nd">한 오답에 원인 여러 개 가능 (misses.py 원인 분석 결과)</div></div>`;
    return h;
  }

  function mapHtml(m) {
    const dimsSel = Object.entries((UA.an || {}).map_dims || {});
    const opt = (cur, other) => dimsSel.map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''} ${k === other ? 'disabled' : ''}>${e(v)}</option>`).join('');
    let h = `<div class="card"><h3 style="margin:0">🗺 역배 신뢰도 맵</h3>
      <div class="sub">셀 숫자 = 신뢰도 점수(0–100, 실제 적중률이 손익분기를 넘을 사후확률) · 아래 = 적중률 · n. 셀을 누르면 해당 경기 목록.</div>
      <div class="ua-chips" aria-label="맵 프리셋">${PRESETS.map(([x, y, l]) => `<button type="button" class="chip ${UA.x === x && UA.y === y ? 'active' : ''}" data-px="${x}" data-py="${y}">${l}</button>`).join('')}</div>
      <div class="ua-sel"><label>열(가로)<select id="uaX" aria-label="열 차원">${opt(UA.x, UA.y)}</select></label><label>행(세로)<select id="uaY" aria-label="행 차원">${opt(UA.y, UA.x)}</select></label></div>`;
    if (!m || !m.xs || !m.xs.length) return h + '<div class="muted">채점된 역배가 없어 맵을 그릴 수 없습니다.</div></div>';
    const cols = m.xs.length, cw = cols > 5 ? '58px' : 'minmax(48px, 1fr)';
    let g = `<div class="ua-h"></div>` + m.xs.map(x => `<div class="ua-h">${e(x)}</div>`).join('');
    for (const y of m.ys) {
      g += `<div class="ua-rl">${e(y)}</div>`;
      for (const x of m.xs) {
        const c = m.cells[`${x}|${y}`];
        if (!c) { g += `<div class="ua-c empty" aria-hidden="true"></div>`; continue; }
        const k = `${x}|${y}`;
        g += `<button type="button" class="ua-c ${c.color} ${UA.cell === k ? 'sel' : ''}" data-cell="${e(k)}" aria-label="${e(y)} · ${e(x)}: ${COLKO[c.color]}, 적중 ${c.hits}/${c.n}">
          <b>${c.n < 10 ? '–' : (c.score ?? '–')}</b><small>${P(c.hit_rate, 0)} · n${c.n}</small></button>`;
      }
    }
    h += `<div class="ua-gw"><div class="ua-grid" style="grid-template-columns:minmax(74px, 1.25fr) repeat(${cols}, ${cw})">${g}</div></div>
      <div class="ua-lg">${Object.entries({red: '#f87171', green: '#34d399', amber: '#a16207', grey: '#2b3447'}).map(([k, c]) => `<span><i style="background:${c}"></i>${COLKO[k]}</span>`).join('')}</div>
      <div class="nd">열 ${e(m.x_label)} × 행 ${e(m.y_label)} · 사전분포: 전체 적중률 ${P(m.prior.m)} (가상 ${m.prior.k}건) · 전체 n=${m.prior.n}</div>
      <div id="uaDet" class="ua-det">${UA.cell && m.cells[UA.cell] ? cellHtml(m.cells[UA.cell]) : '<div class="muted">셀을 눌러 경기 목록 보기</div>'}</div></div>`;
    return h;
  }

  function cellHtml(c) {
    return `<div><b>${e(c.y)} · ${e(c.x)}</b> <span class="ua-b ${c.color === 'red' ? 'low' : c.color === 'green' ? 'high' : c.color === 'grey' ? 'insufficient' : 'neutral'}">${e(c.color_ko)}</span></div>
      <div class="sub">적중 ${c.hits}/${c.n} (${P(c.hit_rate)}) · 추정 ${P(c.expected)} · 시장 ${P(c.market)} · 손익분기 ${P(c.breakeven)} · ROI ${R(c.roi)} · 신뢰도 ${c.n < 10 ? '표본 부족' : c.score + '/100'} · p(분기 미달)=${c.p_below_be ?? '–'}</div>
      ${(c.games || []).map(g => `<div class="ua-g"><span class="t">${KO(g.kickoff)} · ${e(g.league || '')}<br><b>${e(g.home)} vs ${e(g.away)}</b><br><span class="muted">${e(g.bet_type || '')} ${e(g.pick)} · ${e(g.src)} · ${e(g.kind || '')}</span></span>
        <span class="r"><span class="stb ${g.hit ? 'st-on' : 'st-live'}">${g.hit ? '적중' : '실패'}</span><br>@${g.odds ? g.odds.toFixed(2) : '–'} · 추정 ${P(g.p, 0)}<br><span class="muted">${e(g.result || '')}</span></span></div>`).join('')}`;
  }

  function itemHtml(r) {
    const u = r.pick, rel = u.rel;
    const pick = r.source === 'proto' ? `${u.bet_type} · ${u.label}` : `머니라인 · ${u.label}`;
    return `<div class="ua-it"><div style="display:flex;justify-content:space-between;gap:6px"><span class="muted">${KO(r.kickoff)} KST · ${e(r.league || '')}</span>${window.uaBadge(rel)}</div>
      <div><b>${e(r.home)} vs ${e(r.away)}</b></div>
      <div>${e(pick)} <b>@${(+u.odds).toFixed(2)}</b> · 추정 ${P(u.p)} · EV ${R(u.ev)}</div>
      <div class="why">${window.uaRelLine(rel, u.demoted_from)}</div></div>`;
  }

  function radarHtml(rd, d) {
    const l20 = (rd && rd.last20) || (d && d.last20) || {};
    const bt = (d && d.backtest) || {};
    let h = `<div class="card"><h3 style="margin:0">📡 역배 추적 레이더</h3>
      <div class="sub">새 역배 픽을 신뢰도 맵으로 채점 → ⚠ 낮은 신뢰는 강등·보류, ✅ 신뢰 상승(원래 EV>0·초록 셀·점수≥50·n≥20) · 순위 = 보정 EV (표본이 충분히 클 때만 상향, 그 외 원래 EV 상한) · 맵 적합 ${e((rd || d || {}).fitted_kst || '–')} (n=${(rd || {}).n_fit ?? (d && d.analysis ? d.analysis.n : '–')})</div>`;
    if (rd) {
      h += `<h4 style="margin:10px 0 0">오늘 시작 전 역배 (${rd.n_total}건${rd.n_held ? ` · 보류 ${rd.n_held}` : ''})</h4>` +
        (rd.items.length ? rd.items.map(itemHtml).join('') : `<div class="muted" style="margin-top:4px">오늘(${e(rd.window.label)}) 대상 역배 픽 없음</div>`) +
        ((rd.held || []).length ? `<h4 style="margin:10px 0 0">⏸ 보류 (낮은 신뢰 구간)</h4>${rd.held.map(itemHtml).join('')}` : '');
    }
    h += `<h4 style="margin:12px 0 2px">최근 ${l20.n || 0}건 감시</h4><div class="sub">${l20.status === '표본 부족' ? `표본 부족 (${l20.n}/20)` :
      `적중 ${l20.hits}/${l20.n} (${P(l20.hit_rate)}) vs 추정 ${P(l20.expected)} · p=${l20.p_below_exp} → ${l20.dropped ? '<span class="bad">유의한 급락</span>' : '유의한 급락 아님'} · 이전 ${l20.before ? l20.before.n + '건 ' + P(l20.before.hit_rate) : ''}`}</div>`;
    if (bt.walk_forward || bt.fixed) {
      const row = (nm, x) => x ? `<span>${nm}</span><span>${x.before.hits}/${x.before.n} · ${P(x.before.hit_rate, 0)} · ${R(x.before.roi)}</span><span>${x.after.n ? `${x.after.hits}/${x.after.n} · ${P(x.after.hit_rate, 0)} · ${R(x.after.roi)}` : '–'}</span><span>${x.suppressed.n ? `${x.suppressed.hits}/${x.suppressed.n} · ${P(x.suppressed.hit_rate, 0)}` : '0건'}</span>` : '';
      h += `<h4 style="margin:12px 0 4px">필터 백테스트 (시간순, 앞 구간으로 맵 적합 → 뒤 구간 적용)</h4>
        <div class="ua-bt"><span class="hd"></span><span class="hd">필터 전</span><span class="hd">필터 후</span><span class="hd">보류된 픽</span>${row('워크포워드', bt.walk_forward)}${row('고정 60/40', bt.fixed)}</div>
        <div class="nd">${e(bt.conclusion || bt.status || '')}</div>`;
    }
    const evs = (rd && rd.events) || (d && d.events) || [];
    h += `<h4 style="margin:12px 0 2px">레이더 이벤트 (KST)</h4>${evs.length ? evs.slice(0, 12).map(x => `<div class="ua-ev"><span class="k">${e(x.kst)}${x.pushed ? ` · 푸시 ${x.pushed}` : ''}</span><br><b>${e(x.title)}</b> — ${e(x.body)}</div>`).join('') : '<div class="muted">이벤트 없음</div>'}
      <div class="nd">${e((rd && rd.rule) || '')}</div></div>`;
    return h;
  }

  async function loadMap() {
    try {
      const r = await fetch(`/api/upsets/map?x=${encodeURIComponent(UA.x)}&y=${encodeURIComponent(UA.y)}`);
      UA.map = r.ok ? await r.json() : null;
    } catch (x) { UA.map = null; }
    if (UA.cell && !(UA.map && UA.map.cells[UA.cell])) UA.cell = null;
  }

  function wire(root) {
    root.querySelectorAll('[data-dim]').forEach(b => b.onclick = () => { UA.dim = b.dataset.dim; render(root); });
    root.querySelectorAll('[data-px]').forEach(b => b.onclick = async () => { UA.x = b.dataset.px; UA.y = b.dataset.py; UA.cell = null; await loadMap(); render(root); });
    const sx = root.querySelector('#uaX'), sy = root.querySelector('#uaY');
    if (sx) sx.onchange = async () => { UA.x = sx.value; UA.cell = null; await loadMap(); render(root); };
    if (sy) sy.onchange = async () => { UA.y = sy.value; UA.cell = null; await loadMap(); render(root); };
    root.querySelectorAll('.ua-c[data-cell]').forEach(b => b.onclick = () => {
      UA.cell = UA.cell === b.dataset.cell ? null : b.dataset.cell;
      root.querySelectorAll('.ua-c.sel').forEach(n => n.classList.remove('sel'));
      if (UA.cell) b.classList.add('sel');
      const det = root.querySelector('#uaDet');
      if (det) { det.innerHTML = UA.cell ? cellHtml(UA.map.cells[UA.cell]) : '<div class="muted">셀을 눌러 경기 목록 보기</div>'; if (UA.cell) det.scrollIntoView({block: 'nearest', behavior: 'smooth'}); }
    });
  }

  function render(root) {
    const d = UA.an;
    if (!d || !d.analysis) { root.innerHTML = '<div class="card bad">역배 분석을 불러오지 못했습니다</div>'; return; }
    root.innerHTML = `<div class="ua-sec"><h2 id="uaAnalysis">🎲 역배 오답 분석</h2>${analysisHtml(d)}
      <h2 id="uaMap">🗺 역배 신뢰도 맵</h2>${mapHtml(UA.map)}
      <h2 id="uaRadar">📡 역배 추적 레이더</h2>${radarHtml(UA.radar, d)}</div>`;
    wire(root);
  }

  window.upsetAnLoad = async function (root) {
    if (!root) return;
    try {
      const [an, rd] = await Promise.all([fetch('/api/upsets/analysis').then(r => r.json()),
        fetch('/api/upsets/radar').then(r => r.ok ? r.json() : null).catch(() => null), loadMap()]);
      UA.an = an; UA.radar = rd;
      render(root);
    } catch (x) { root.innerHTML = `<div class="card bad">역배 분석 불러오기 실패: ${e(String(x))}</div>`; }
  };

  /* compact radar card for the 🔥 역배 tab */
  window.upsetRadarCard = async function (root) {
    if (!root) return;
    try {
      const rd = await fetch('/api/upsets/radar').then(r => r.json());
      UA.radar = rd;
      root.innerHTML = radarHtml(rd, null).replace('<h4 style="margin:12px 0 2px">레이더 이벤트', '<div style="margin-top:8px"><button type="button" class="btn sm" id="uaGoMap">🗺 역배 신뢰도 맵·오답 분석 보기 →</button></div><h4 style="margin:12px 0 2px">레이더 이벤트');
      const a = root.querySelector('#uaGoMap');
      if (a) a.onclick = ev => { ev.preventDefault(); const b = document.querySelector('nav button[data-sport="miss"]'); if (b) b.click(); };
    } catch (x) { root.innerHTML = ''; }
  };
})();
