/* features.js — 🔍 검색, ● 데이터 신선도 + the small localStorage helper (LS) used by notify.js.
   (⭐ 관심 경기 and 🧾 조합·📒 내 픽 were removed on 2026-10-04 at the user's request.) */
const LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode / quota */ } },
};
const kstShort = iso => { try { return new Date(iso).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}); } catch (e) { return ''; } };

/* ---------------- 🔍 search (team / league, debounced) ---------------- */
const SEARCH = {q: '', norm: ''};
const normQ = s => String(s || '').toLowerCase().replace(/[\s·.\-_]/g, '');
function searchMatch(...fields) {
  if (!SEARCH.norm) return true;
  return fields.some(f => f && normQ(f).includes(SEARCH.norm));
}
function rerenderCurrent() {
  if (typeof SPORT_TABS !== 'undefined' && SPORT_TABS.includes(sport)) render();
  else if (sport === 'proto' && typeof protoRenderSoon === 'function') protoRenderSoon();
}
function clearSearch() {
  const q = document.getElementById('q');
  if (!SEARCH.q) return;
  SEARCH.q = SEARCH.norm = ''; if (q) q.value = '';
  document.getElementById('qClear').hidden = true;
  rerenderCurrent();
}
(function () {
  const q = document.getElementById('q'), x = document.getElementById('qClear');
  if (!q) return;
  let t = 0;
  q.addEventListener('input', () => {
    x.hidden = !q.value;
    clearTimeout(t);
    t = setTimeout(() => { SEARCH.q = q.value.trim(); SEARCH.norm = normQ(SEARCH.q); rerenderCurrent(); }, 200);
  });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') q.blur(); if (e.key === 'Escape') clearSearch(); });
  x.addEventListener('click', () => { clearSearch(); q.focus(); });
})();

/* ---------------- ● freshness ("마지막 업데이트") ---------------- */
const FRESH = {};
const FRESH_RULE = {games: [180, 600, '경기 데이터'], proto: [300, 900, '프로토 배당']};   // ok ≤ a s, warn ≤ b s, else stale
function setFresh(kind, iso) { if (iso) { FRESH[kind] = iso; paintFresh(); } }
function freshFor() { paintFresh(); }
function paintFresh() {
  const el = document.getElementById('fresh'), txt = document.getElementById('updated');
  if (!el || !txt) return;
  const kind = (typeof sport !== 'undefined' && sport === 'proto') ? 'proto' : 'games';
  const iso = FRESH[kind];
  el.classList.remove('ok', 'warn', 'stale');
  if (!iso) { txt.textContent = '불러오는 중…'; return; }
  const t = new Date(iso), age = Math.max(0, (Date.now() - t) / 1000);
  const [a, b, label] = FRESH_RULE[kind];
  el.classList.add(age <= a ? 'ok' : age <= b ? 'warn' : 'stale');
  const hm = t.toLocaleTimeString('ko-KR', {timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false});
  const rel = age < 60 ? '방금' : age < 3600 ? `${Math.floor(age / 60)}분 전` : `${Math.floor(age / 3600)}시간 전`;
  txt.textContent = `${hm} KST · ${rel}`;
  el.title = `${label} 마지막 업데이트 ${t.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})} KST`
    + (age > b ? ' — 데이터가 오래되었습니다 (소스 지연/오류 가능)' : '');
}
setInterval(paintFresh, 15000);
/* tap the pill → per-source freshness (mobile has no hover tooltips) */
async function freshPopover() {
  let pop = document.getElementById('freshPop');
  if (pop && !pop.hidden) { pop.hidden = true; return; }
  if (!pop) {
    pop = document.createElement('div'); pop.id = 'freshPop'; pop.className = 'freshpop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '데이터 신선도');
    document.body.appendChild(pop);
    document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('#freshPop, #fresh')) pop.hidden = true; });
  }
  pop.hidden = false;
  pop.innerHTML = '<div class="muted">확인 중…</div>';
  const row = (label, iso, rule, extra) => {
    if (!iso) return `<div class="fp-r"><i class="fp-d"></i><span class="fp-l">${label}</span><span class="fp-v muted">정보 없음</span></div>`;
    const age = Math.max(0, (Date.now() - new Date(iso)) / 1000), [a, b] = rule;
    const cls = age <= a ? 'ok' : age <= b ? 'warn' : 'stale';
    const rel = age < 60 ? '방금' : age < 3600 ? `${Math.floor(age / 60)}분 전` : age < 86400 ? `${Math.floor(age / 3600)}시간 전` : `${Math.floor(age / 86400)}일 전`;
    return `<div class="fp-r ${cls}"><i class="fp-d"></i><span class="fp-l">${label}</span><span class="fp-v">${kstShort(iso)} · ${rel}${extra ? `<br><span class="muted sm">${extra}</span>` : ''}</span></div>`;
  };
  const [src, rr, nc] = await Promise.all([fetch('/api/sources').then(r => r.json()).catch(() => null),
    fetch('/api/proto/rounds').then(r => r.json()).catch(() => null), fetch('/api/notify/config').then(r => r.json()).catch(() => null)]);
  const S = src ? Object.values(src.sources || {}) : [], bad = S.filter(x => !x.ok);
  const cur = rr && rr.current ? (rr.rounds || []).find(x => x.year === rr.current[0] && x.round === rr.current[1]) : null;
  const lc = nc && nc.status && nc.status.last_cycle;
  pop.innerHTML = `<b>데이터 기준 시각 (KST)</b>
    ${row('경기·확률', src && src.updated_at, FRESH_RULE.games, S.length ? `리그 소스 ${S.length - bad.length}/${S.length} 정상${bad.length ? ' · 오류: ' + bad.map(x => esc(x.league_name)).join(', ') : ''}` : '')}
    ${row('프로토 배당', cur && cur.last_fetch, FRESH_RULE.proto, cur ? `${cur.year}년 ${cur.round}회차 · ${esc(cur.status)} · 출처 ${esc(cur.source)}` : '')}
    ${row('알림 감지', lc, [90, 300], '30초마다 변화 감지')}
    <div class="muted sm" style="margin-top:6px">초록 = 최신 · 노랑 = 지연 · 빨강 = 오래됨(소스 오류 가능)</div>`;
}
document.getElementById('fresh')?.addEventListener('click', freshPopover);
document.getElementById('fresh')?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); freshPopover(); } });


/* ---------------- 📋 주간 개선 내역 (changelog) ---------------- */
async function loadChangelog() {
  const box = document.getElementById('changelogBox');
  const body = document.getElementById('clBody');
  const badge = document.getElementById('clBadge');
  if (!box || !body) return;
  try {
    const d = await fetch('/api/changelog', {cache: 'no-store'}).then(r => r.json());
    const entries = d.entries || [];
    if (!entries.length) {
      badge.textContent = '없음';
      body.innerHTML = '<div class="muted">등록된 개선 내역이 없습니다.</div>';
      return;
    }
    const latest = entries[0];
    badge.textContent = latest.date || '최신';
    body.innerHTML = entries.map(e => {
      const items = (e.items || []).map(x => `<li>${esc(x)}</li>`).join('');
      return `<div class="cl-date">${esc(e.date || '')}</div><b>${esc(e.title || '개선')}</b><ul>${items}</ul>`;
    }).join('<hr style="border:0;border-top:1px solid var(--divider);margin:10px 0">');
  } catch (e) {
    badge.textContent = '오류';
    body.innerHTML = `<div class="muted">불러오기 실패: ${esc(String(e.message || e))}</div>`;
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadChangelog);
else loadChangelog();
