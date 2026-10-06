// Llife: 영지 — 화면. 엔진(js/realm.js)의 window.Realm 을 그림
//   시작 화면(이름·성별·가문·영지·기질·문장) → 유년기 선택 → 본편(상단 HUD · 영지 현황 · 위협 · 기록 · 행동)
//   창: 사건 · 결투 · 모험 · 수성전 · 건설 · 징병 · 시장 · 상단 · 대장간 · 원정지 · 사람들 · 능력치 · 세율 · 메뉴 · 결말
(() => {
const R = window.Realm, D = window.REALM;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const num = n => Math.round(n).toLocaleString('ko-KR');
const pctBar = (cls, v, max) => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v / Math.max(1, max) * 100))}%"></i></div>`;
const pips = (lv, max = 5) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</span>`;
const HOUSE_NAMES = ['그레이몬트', '아이언하트', '블랙웰', '실버브룩', '스톤헤이븐', '레이븐크로프트', '윈터벨', '애쉬포드'];
const TRAITS = [
  { id: 'strong', icon: '💪', name: '강골', desc: '무력 +5 · 체력 +3' },
  { id: 'wise', icon: '📚', name: '총명', desc: '학식 +5 · 정무 +3' },
  { id: 'fair', icon: '🗣', name: '다정', desc: '화술 +5 · 통솔 +3' },
  { id: 'gifted', icon: '✨', name: '마법의 재능', desc: '마력 +8 · 처음부터 마법 수련 가능' },
];
const GROUPS = [['self', '🧍 나'], ['realm', '🏰 영지'], ['adv', '🗺 모험'], ['trade', '🐫 교역']];
const ui = { group: 'self', modal: null, cv: null, made: null, lastLog: -1, hit: null };

/* ═════ 문장(방패) ═════ */
function crestSVG(c, w = 52) {
  const col = (c && c.color) || '#3a3f4b', sym = (c && c.sym) || '⚜';
  return `<svg class="crest" viewBox="0 0 52 60" width="${w}" aria-hidden="true">
    <defs><linearGradient id="cg${col.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
    <path d="M4 4h44v22c0 16-10 26-22 31C14 52 4 42 4 26z" fill="${col}" stroke="#e3bd6a" stroke-width="2.4"/>
    <path d="M4 4h44v22c0 16-10 26-22 31C14 52 4 42 4 26z" fill="url(#cg${col.slice(1)})"/>
    <path d="M4 15h44" stroke="#e3bd6a" stroke-width="1" opacity=".45"/>
    <text x="26" y="36" text-anchor="middle" font-size="21">${sym}</text></svg>`;
}

/* ═════ 시작 화면 ═════ */
function showStart() {
  $('#app').hidden = true; $('#start').hidden = false;
  const m = ui.made || (ui.made = { gender: 'm', name: '', house: pick(HOUSE_NAMES), land: 'march', trait: 'strong', crest: { color: pick(D.crestColors), sym: pick(D.crestSyms) } });
  $('#start').innerHTML = `
    <h1>⚜ Llife: 영지</h1>
    <p class="tag">영주의 자식으로 태어나, 땅을 지키고, 교역하고, 모험을 떠나라.</p>
    <div class="preview">${crestSVG(m.crest, 64)}<div><b style="font-family:var(--serif);font-size:18px">${esc(m.house)} 가문</b><div class="dim">${esc(m.name || '(이름은 비우면 무작위)')} · ${m.gender === 'm' ? '아들' : '딸'}</div></div></div>
    <div class="field"><label>이름 · 가문</label><div class="two">
      <input id="f-name" maxlength="10" placeholder="이름 (비우면 무작위)" value="${esc(m.name)}">
      <input id="f-house" maxlength="12" placeholder="가문 이름" value="${esc(m.house)}"></div></div>
    <div class="field"><label>태어난 자식</label><div class="two">
      <button class="b ${m.gender === 'm' ? 'on' : ''}" data-g="m">🗡 영주의 아들</button>
      <button class="b ${m.gender === 'f' ? 'on' : ''}" data-g="f">🌹 영주의 딸</button></div></div>
    <div class="field"><label>물려받을 땅</label><div class="opts">${D.lands.map(l => `
      <button class="b opt ${m.land === l.id ? 'on' : ''}" data-land="${l.id}"><span class="t">${l.icon} ${l.name}</span><small>${l.desc}</small></button>`).join('')}</div></div>
    <div class="field"><label>타고난 기질</label><div class="opts">${TRAITS.map(t => `
      <button class="b opt ${m.trait === t.id ? 'on' : ''}" data-trait="${t.id}"><span class="t">${t.icon} ${t.name}</span><small>${t.desc}</small></button>`).join('')}</div></div>
    <div class="field"><label>가문의 문장</label>
      <div class="swatches" style="margin-bottom:8px">${D.crestColors.map(c => `<button class="sw ${m.crest.color === c ? 'on' : ''}" data-col="${c}" style="background:${c}" aria-label="색 ${c}"></button>`).join('')}</div>
      <div class="swatches">${D.crestSyms.map(s => `<button class="b sym ${m.crest.sym === s ? 'on' : ''}" data-sym="${s}">${s}</button>`).join('')}</div></div>
    <button class="b gold wide" id="f-go" style="min-height:52px;font-size:17px">⚜ 태어나기</button>
    <a class="back-link" href="index.html">← 현대 Llife로 돌아가기</a>`;
  const keep = () => { m.name = $('#f-name').value.trim(); m.house = $('#f-house').value.trim() || m.house; };
  $('#start').onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    keep();
    if (t.dataset.g) m.gender = t.dataset.g;
    else if (t.dataset.land) m.land = t.dataset.land;
    else if (t.dataset.trait) m.trait = t.dataset.trait;
    else if (t.dataset.col) m.crest.color = t.dataset.col;
    else if (t.dataset.sym) m.crest.sym = t.dataset.sym;
    else if (t.id === 'f-go') { R.newGame({ name: m.name, gender: m.gender, house: m.house, land: m.land, trait: m.trait, crest: m.crest }); ui.lastLog = -1; return render(); }
    showStart();
  };
}

/* ═════ 본편 ═════ */
function render() {
  const S = R.state();
  if (!S) return showStart();
  $('#start').hidden = true; $('#app').hidden = false;
  const I = R.info();
  renderHud(I); renderRealm(I); renderThreat(I); renderLog(S); renderActs(I);
  renderModal(S, I);
}
function renderHud(I) {
  const hurt = I.injury ? ` · <span class="minus">🩹 부상 ${I.injury}달</span>` : '';
  $('#hud').innerHTML = `${crestSVG(I.crest)}
    <div class="who"><h1>${esc(I.name)} <small class="dim" style="font-size:13px">${esc(I.house)} 가문</small></h1>
      <div class="sub">${esc(I.title)} · ${I.age}살 · 명성 ${num(I.fame)}${hurt}</div>
      <div class="bars" style="margin:4px 0 0"><span>❤️</span>${pctBar('hp', I.hp, I.hpMax)}<span class="dim">${I.hp}/${I.hpMax}</span></div></div>
    <div class="date"><b>${I.year}년 ${I.month}월</b>${I.season} · ${I.land.icon}<div class="ap" title="이번 달 남은 행동" style="margin-top:4px">${Array.from({ length: I.apMax }, (_, i) => `<i class="${i < I.ap ? 'on' : ''}"></i>`).join('')}</div></div>
    <button class="menu-btn" data-modal="menu" aria-label="메뉴">☰</button>`;
}
function renderRealm(I) {
  const r = I.realm, t = r.troops;
  const s = (k, v, warn, title) => `<div class="stat ${warn ? 'warn' : ''}" ${title ? `title="${title}"` : ''}><div class="k">${k}</div><div class="v">${v}</div></div>`;
  $('#realm').innerHTML = [
    s('👥 인구', num(r.pop)),
    s('🌾 식량', `${num(r.food)} <small>${r.foodMonths}달</small>`, r.foodMonths < 3),
    s('💰 금화', num(r.gold), r.gold < 20),
    s('😊 민심', r.morale, r.morale < 30),
    s('⚖️ 치안', r.order, r.order < 30),
    s('🛡 병력', `${t.levy}·${t.men}·${t.knights}`, false, '징집병·상비병·기사'),
    s('🧱 성벽', `${r.wall}<small>/${r.wallMax}</small>`, r.wall < r.wallMax * .3),
    s('⚔️ 방어력', num(r.defense)),
  ].join('');
}
function renderThreat(I) {
  const t = I.threat, el = $('#threat'), c = I.caravan;
  const bits = [];
  if (t) bits.push(`⚠️ <b>${t.icon} ${esc(t.name)}</b> 접근 중 — 약 ${t.eta}달 뒤 도착 · 적 전력 <b>${num(t.power)}</b> vs 우리 방어력 <b class="${I.realm.defense >= t.power ? 'plus' : 'minus'}">${num(I.realm.defense)}</b>`);
  if (c) bits.push(`🐫 상단이 ${c.town.icon} ${esc(c.town.name)}에 가 있다 (다음 달 귀환)`);
  el.hidden = !bits.length;
  el.style.animation = t ? '' : 'none';
  el.style.background = t ? '' : 'var(--panel)'; el.style.borderColor = t ? '' : '#3b3122';
  el.innerHTML = bits.join('<br>');
}
function renderLog(S) {
  const el = $('#log'), last = S.log.length ? S.log[S.log.length - 1].n : -1;
  if (last === ui.lastLog) return;
  ui.lastLog = last;
  el.innerHTML = S.log.slice(-160).map(l => `<p class="${l.cls}">${esc(l.text)}</p>`).join('');
  el.scrollTop = el.scrollHeight;
}
function renderActs(I) {
  const S = R.state();
  if (I.stage !== 'main') { $('#acts').innerHTML = '<p class="dim" style="margin:4px">어린 시절 이야기가 이어진다…</p>'; return; }
  const acts = R.actions().filter(a => a.group === ui.group);
  const busy = !!(S.pending.length || S.combat || S.adv || S.siege || S.ended);
  $('#acts').innerHTML = `<div class="tabs">${GROUPS.map(([g, n]) => `<button class="b ${ui.group === g ? 'on' : ''}" data-group="${g}">${n}</button>`).join('')}</div>
    <div class="grid">${acts.map(a => `<button class="b act" data-act="${a.id}" ${a.ok ? '' : 'disabled'}><span class="t">${a.icon} ${a.label}</span><span class="d">${a.desc}</span></button>`).join('')}
      ${ui.group === 'realm' ? `<button class="b act" data-modal="tax" ${busy ? 'disabled' : ''}><span class="t">📜 세율</span><span class="d">지금: ${['낮음', '보통', '높음'][I.realm.tax]} (행동 안 씀)</span></button>` : ''}
      ${ui.group === 'self' ? `<button class="b act" data-modal="stats"><span class="t">📊 능력치</span><span class="d">등급·장비·기록</span></button><button class="b act" data-modal="people"><span class="t">👥 사람들</span><span class="d">가족·가신</span></button>` : ''}</div>
    <div class="foot"><button class="b gold next" data-next ${busy ? 'disabled' : ''}>▶ 다음 달${I.ap > 0 ? ` <small style="font-weight:400;opacity:.8">(행동 ${I.ap} 남음)</small>` : ''}</button></div>`;
}

/* ═════ 창 ═════ */
function openModal(name, arg) { ui.modal = name; ui.arg = arg; render(); }
function closeModal() { ui.modal = null; render(); }
function box(html) { const m = $('#modal'); m.hidden = false; m.querySelector('.box').innerHTML = html; }
function renderModal(S, I) {
  // 엔진이 기다리는 것부터: 결말 → 결투 → 수성전 → 모험 → 사건
  if (S.ended) return mEnding(S);
  if (S.combat) return mFight(S);
  if (S.siege) return mSiege(S);
  if (S.adv) return mAdv();
  const ev = R.event();
  if (ev) return mEvent(ev, I);
  if (!ui.modal) { $('#modal').hidden = true; return; }
  const f = { build: mBuild, recruit: mRecruit, market: mMarket, caravan: mCaravan, smith: mSmith, adventure: mSites, people: mPeople, stats: mStats, tax: mTax, menu: mMenu }[ui.modal];
  if (f) f(I); else closeModal();
}
const head = (t, x = true) => `<h2>${t}${x ? '<button class="b sm x" data-close>✕</button>' : ''}</h2>`;

function mEvent(ev, I) {
  const t = ev.child ? `👶 ${I.age}살` : `📜 ${I.year}년 ${I.month}월`;
  box(`${head(t, false)}<div class="story">${esc(ev.text)}</div>
    <div class="choices">${ev.choices.map((c, i) => `<button class="b" data-choose="${i}">${esc(c).replace(/〔(.+?)〕/g, '<span class="pct">〔$1〕</span>')}</button>`).join('')}</div>`);
}
function mFight(S) {
  const c = S.combat, o = R.odds(), f = c.foe;
  const shakeMe = ui.hit === 'me' ? 'shake' : '', shakeFoe = ui.hit === 'foe' ? 'shake' : '';
  ui.hit = null;
  const over = c.over;
  const moves = over ? `<button class="b gold wide" data-fight-close>${over === 'win' ? '🏆 승리! 계속' : over === 'fled' ? '🏃 물러난다' : '🩸 쓰러졌다…'}</button>` : `<div class="moves">
      <button class="b" data-fa="hit">⚔️ 베기<span class="pct">${o.hit}%</span></button>
      <button class="b" data-fa="power">💥 강타<span class="pct">${o.power}% ×1.7</span></button>
      <button class="b" data-fa="guard">🛡 막기<span class="pct">반격 35%</span></button>
      <button class="b" data-fa="magic" ${c.mp > 0 ? '' : 'disabled'}>🔥 화염 룬<span class="pct">${c.mp > 0 ? `마력 ${c.mp}` : '마력 없음'}</span></button>
      <button class="b" data-fa="potion" ${S.potions > 0 ? '' : 'disabled'}>🧪 물약<span class="pct">${S.potions}개</span></button>
      <button class="b ${o.canFlee ? '' : ''}" data-fa="flee" ${o.canFlee ? '' : 'disabled'}>🏃 도망<span class="pct">${o.canFlee ? o.flee + '%' : '불가'}</span></button></div>`;
  box(`${head(`⚔️ 결투 · ${c.turn}턴`, false)}
    <div class="duel">
      <div class="fighter"><div class="face ${shakeMe}">${crestSVG(S.crest, 40)}</div><div class="nm">${esc(S.name)}</div>${pctBar('hp', c.hp, c.hpMax)}<div class="hpn">${Math.max(0, c.hp)}/${c.hpMax}${c.guard ? ' · 🛡' : ''}</div></div>
      <div class="vs">VS</div>
      <div class="fighter"><div class="face ${shakeFoe}">${f.icon}</div><div class="nm">${esc(f.name)}${f.spec ? ` <small class="dim">${{ regen: '재생', drain: '흡혈', breath: '불길' }[f.spec]}</small>` : ''}</div>${pctBar('foe', f.hp, f.hpMax)}<div class="hpn">${Math.max(0, f.hp)}/${f.hpMax}</div></div>
    </div>
    <div class="flog">${c.log.map(l => `<p>${esc(l)}</p>`).join('')}</div>
    ${moves}
    ${!over && c.hurt ? '<p class="note minus">🩹 다친 몸으로 싸우는 중 — 지면 목숨이 위험하다.</p>' : ''}`);
  const fl = $('#modal .flog'); if (fl) fl.scrollTop = fl.scrollHeight;
}
function mSiege(S) {
  const G = S.siege, o = R.siegeOdds();
  const over = G.over;
  const btns = over ? `<button class="b gold wide" data-siege-close>${over === 'win' ? '🎉 승리!' : '🔥 패배… 피해를 수습한다'}</button>` : `<div class="moves">
      <button class="b" data-sa="volley">🏹 사격<span class="pct">방어력 13%</span></button>
      <button class="b" data-sa="oil" ${o.oil ? '' : 'disabled'}>🔥 기름<span class="pct">22% · 💰15</span></button>
      <button class="b" data-sa="repair" ${o.repair ? '' : 'disabled'}>🧱 보수<span class="pct">💰20</span></button>
      <button class="b" data-sa="hold">🛡 버티기<span class="pct">피해 ½</span></button>
      <button class="b red" data-sa="sortie" style="grid-column:span 2">🐴 출격 — ${o.champ.icon} ${esc(o.champ.name)} 상대<span class="pct">이기면 적 -35%</span></button></div>`;
  box(`${head(`🏰 수성전 · ${Math.min(o.round, o.rounds)}/${o.rounds} 라운드`, false)}
    <div class="bars"><span style="width:86px">${G.t.icon} 적 전력</span>${pctBar('enemy', o.P, G.P0)}<b>${num(Math.max(0, o.P))}</b></div>
    <div class="bars"><span style="width:86px">⚔️ 우리</span>${pctBar('pow', o.D, Math.max(o.D, G.P0))}<b>${num(o.D)}</b></div>
    <div class="bars"><span style="width:86px">🧱 성벽</span>${pctBar('wall', o.wall, o.wallMax)}<b>${o.wall}</b></div>
    <div class="flog">${G.log.map(l => `<p>${esc(l)}</p>`).join('')}</div>
    ${btns}
    ${over ? '' : '<p class="note">3라운드가 끝났을 때 우리 방어력이 남은 적 전력 이상이면 승리. 성벽이 무너지면 병사를 더 잃는다.</p>'}`);
  const fl = $('#modal .flog'); if (fl) fl.scrollTop = fl.scrollHeight;
}
function mAdv() {
  const A = R.adv(), icons = { fight: '⚔️', boss: '🐉', trap: '🪤', treasure: '💰', shrine: '⛩', rest: '🔥', '?': '❔', '·': '·' };
  const loot = Object.entries(A.loot.goods).filter(([, n]) => n).map(([g, n]) => `${D.goods.find(x => x.id === g).icon}${n}`).join(' ');
  box(`${head(`${A.site.icon} ${esc(A.site.name)}`, false)}
    <div class="path">${A.path.map((k, j) => `<span class="${j < A.i ? 'done' : j === A.i && !A.done ? 'here' : ''}">${icons[k] || k}</span>`).join('')}</div>
    <div class="bars"><span>❤️</span>${pctBar('hp', A.hp, A.hpMax)}<span class="dim">${A.hp}/${A.hpMax} · 🧪${A.potions}</span></div>
    <div class="story" style="font-size:15px">${esc(A.done ? A.summary || A.msg : A.msg)}</div>
    <p class="dim" style="margin:0 0 10px">전리품: 💰 ${A.loot.gold}${loot ? ' · ' + loot : ''}</p>
    ${A.done ? '<button class="b gold wide" data-adv-close>🏰 성으로 돌아간다</button>' : `<div class="two">
      <button class="b gold" data-adv-step>▶ 앞으로 (${A.i + 1}/${A.n})</button>
      <button class="b" data-adv-retreat>↩️ 돌아간다</button></div>
      <p class="note">🪤 함정 피하기 민첩 ${A.trapPct}% · 체력이 낮으면 돌아가는 것도 용기다.</p>`}`);
}
function mBuild(I) {
  const rows = R.buildList().map(b => `<div class="row"><div class="ic">${b.icon}</div><div class="main"><b>${b.name} ${pips(b.lv)}</b><small>${b.desc}</small></div>
    <div class="btns">${b.cost == null ? '<span class="dim">최고 단계</span>' : `<button class="b sm" data-build="${b.id}" ${b.ok ? '' : 'disabled'}>💰 ${b.cost}</button>`}</div></div>`).join('');
  box(`${head('🏗 건설 <small class="dim" style="font-size:13px">행동 1</small>')}${rows}<p class="note">금고 💰 ${num(I.realm.gold)} · 남은 행동 ${I.ap}</p>`);
}
function mRecruit(I) {
  const rows = R.recruitInfo().map(t => {
    const ns = (t.id === 'levy' ? [10, 30, 60] : t.id === 'men' ? [5, 10, 20] : [1, 2, 4]).filter(n => n <= t.max);
    return `<div class="row stack"><div class="ic">${t.icon}</div><div class="main"><b>${t.name} <span class="dim" style="font-weight:400">${t.have}명 · 더 ${t.max}명까지</span></b>
      <small>${t.desc}<br>힘 ${t.power} · 1명 💰${t.cost} · 유지 💰${t.upkeep}/달</small></div>
      <div class="btns">${ns.map(n => `<button class="b sm" data-recruit="${t.id}:${n}" ${I.ap > 0 && I.realm.gold >= n * t.cost ? '' : 'disabled'}>+${n}<br><small>💰${n * t.cost}</small></button>`).join('') || '<span class="dim">한도</span>'}</div></div>`;
  }).join('');
  box(`${head('🛡 징병·모집 <small class="dim" style="font-size:13px">행동 1</small>')}${rows}
    <p class="note">병영 단계가 높을수록 상비병·기사를 더 둘 수 있다. 징집병은 인구에서 뽑아 민심과 농사가 조금 준다. 지금 방어력 ⚔️ ${num(I.realm.defense)} (훈련도 ${I.realm.drill})</p>`);
}
function mMarket(I) {
  const rows = R.market().map(g => {
    const lo = Math.min(...g.away.map(a => a.p)), hi = Math.max(...g.away.map(a => a.p));
    return `<div class="row stack"><div class="ic">${g.icon}</div><div class="main"><b>${g.name} <span class="dim" style="font-weight:400">${g.have}개</span></b>
      <small>사기 <b style="color:var(--text)">${g.buy}</b> · 팔기 <b style="color:var(--text)">${g.sell}</b> · ${g.away.map(a => `<span class="${a.p === lo ? 'cheap' : a.p === hi ? 'dear' : ''}">${a.icon}${a.p}</span>`).join(' ')}</small></div>
      <div class="btns" style="flex-wrap:nowrap"><button class="b sm" data-trade="${g.id}:-5" ${g.have >= 5 ? '' : 'disabled'}>-5</button><button class="b sm" data-trade="${g.id}:-1" ${g.have >= 1 ? '' : 'disabled'}>-1</button><button class="b sm" data-trade="${g.id}:1" ${I.realm.gold >= g.buy ? '' : 'disabled'}>+1</button><button class="b sm" data-trade="${g.id}:5" ${I.realm.gold >= g.buy * 5 ? '' : 'disabled'}>+5</button></div></div>`;
  }).join('');
  box(`${head('🏪 영지 시장 <small class="dim" style="font-size:13px">행동 안 씀</small>')}${rows}
    <p class="note">💰 ${num(I.realm.gold)} · 곡물 1 = 영지 식량 10. 다른 도시 값: <span class="cheap">초록</span>은 가장 싸게 사는 곳, <span class="dear">빨강</span>은 가장 비싸게 사 주는 곳 → 🐫 상단으로 팔러 보내자.</p>`);
}
function mCaravan(I) {
  const towns = R.towns(), mk = R.market();
  const cv = ui.cv || (ui.cv = { to: towns[0].id, goods: {}, escort: false, back: '' });
  const q = R.caravanQuote(cv.to, cv.goods, cv.escort), t = towns.find(x => x.id === cv.to);
  const prices = R.state().prices[cv.to];
  const rows = mk.filter(g => g.have > 0 || cv.goods[g.id]).map(g => `<div class="row stack"><div class="ic">${g.icon}</div><div class="main"><b>${g.name} <span class="dim" style="font-weight:400">${g.have}개</span></b>
      <small>여기서 팔면 ${g.sell} → ${t.icon} ${prices[g.id]}</small></div>
      <div class="btns"><button class="b sm" data-cg="${g.id}:-5">-5</button><button class="b sm" data-cg="${g.id}:-1">-1</button><b style="min-width:28px;text-align:center">${cv.goods[g.id] || 0}</b><button class="b sm" data-cg="${g.id}:1">+1</button><button class="b sm" data-cg="${g.id}:all">전부</button></div></div>`).join('') || '<p class="dim">실을 물건이 없다. 시장에서 사거나 원정 전리품을 모아 보자.</p>';
  const any = Object.values(cv.goods).some(n => n > 0);
  box(`${head('🐫 상단 보내기 <small class="dim" style="font-size:13px">행동 1 · 한 달 뒤 귀환</small>')}
    <div class="opts" style="margin-bottom:8px">${towns.map(x => `<button class="b opt ${cv.to === x.id ? 'on' : ''}" data-cto="${x.id}"><span class="t">${x.icon} ${x.name}</span><small>산적 위험 ${Math.round(x.risk * 100)}% · 통행세 ${Math.round(x.toll * 100)}%</small></button>`).join('')}</div>
    ${rows}
    <div class="row"><div class="ic">🛡</div><div class="main"><b>상비병 10명 호위</b><small>위험이 크게 줄어든다 (한 달 동안 성을 비움)</small></div><button class="b sm ${cv.escort ? 'on' : ''}" data-cesc ${I.realm.troops.men >= 10 ? '' : 'disabled'}>${cv.escort ? '붙임' : '안 붙임'}</button></div>
    <div class="row"><div class="ic">🛒</div><div class="main"><b>돌아올 때 사 올 물건</b><small>번 돈의 절반으로 그 도시 값에 사 온다</small></div>
      <select data-cback><option value="">사 오지 않음</option>${D.goods.filter(g => g.id !== 'grain').map(g => `<option value="${g.id}" ${cv.back === g.id ? 'selected' : ''}>${g.icon} ${g.name} (${prices[g.id]})</option>`).join('')}</select></div>
    <p style="margin:10px 0">예상 수입 <b class="plus">💰 ${num(q.value)}</b> · 산적 위험 <b class="${q.risk > 12 ? 'minus' : ''}">${q.risk}%</b></p>
    <button class="b gold wide" data-csend ${any && I.ap > 0 ? '' : 'disabled'}>🐫 출발</button>`);
}
function mSmith(I) {
  const G = R.gear();
  const row = (k, icon, label) => { const cur = G[k], n = G.next[k];
    return `<div class="row"><div class="ic">${icon}</div><div class="main"><b>${label}: ${cur[0]} <span class="dim" style="font-weight:400">(+${cur[1]})</span></b>
      <small>${n ? `다음: ${n.name} — 💰${n.cost.gold} · ⛓철 ${n.cost.iron}${n.cost.mana ? ` · 💎마석 ${n.cost.mana}` : ''} · 대장간 ${n.smithy}단계 필요` : '최고의 장비다'}</small></div>
      ${n ? `<button class="b sm" data-up="${k}" ${n.ok ? '' : 'disabled'}>만들기</button>` : ''}</div>`; };
  const inv = R.state().inv;
  box(`${head('⚒ 대장간 <small class="dim" style="font-size:13px">행동 안 씀</small>')}
    ${row('weapon', '🗡', '무기')}${row('armor', '🛡', '갑옷')}
    <div class="row"><div class="ic">🧪</div><div class="main"><b>치유 물약 <span class="dim" style="font-weight:400">${G.potions}개</span></b><small>결투 중에 체력을 45% 채운다</small></div><button class="b sm" data-potion ${I.realm.gold >= G.potionCost ? '' : 'disabled'}>💰 ${G.potionCost}</button></div>
    <p class="note">대장간 ${G.smithy}단계 · 💰 ${num(I.realm.gold)} · ⛓ 철 ${inv.iron || 0} · 💎 마석 ${inv.mana || 0}</p>`);
}
function mSites(I) {
  const S = R.state(), might = S.stats.might, rec = [0, 20, 34, 50, 64];
  box(`${head('🗺 원정 <small class="dim" style="font-size:13px">이번 달 행동을 모두 씀</small>')}
    ${R.sites().map(s => { const ok = might + S.stats.agility / 2 >= rec[s.tier] + 10;
      return `<div class="row"><div class="ic">${s.icon}</div><div class="main"><b>${s.name} <span class="${ok ? 'plus' : 'minus'}" style="font-weight:400;font-size:12px">${'★'.repeat(s.tier)} ${ok ? '해볼 만함' : '위험'}</span></b>
        <small>${s.desc}<br>${s.nodes}칸 · ${[...new Set(s.foes)].map(f => D.foes[f].icon).join('')}${s.boss ? ` · 우두머리 ${D.foes[s.boss].icon}` : ''} · 💰${s.gold[0]}~${s.gold[1]}</small></div>
        <button class="b sm" data-site="${s.id}" ${I.ap > 0 ? '' : 'disabled'}>출발</button></div>`; }).join('')}
    <p class="note">❤️ ${I.hp}/${I.hpMax} · 🧪 ${I.potions}개 · 무기 ${I.gear.weapon[0]} · 갑옷 ${I.gear.armor[0]}${I.injury ? ' · <span class="minus">🩹 부상 중 — 지면 목숨이 위험</span>' : ''}</p>`);
}
function mPeople(I) {
  const role = { father: '아버지', mother: '어머니', sibling: '동생', steward: '집사', captain: '기사단장', spouse: '배우자', child: '자식' };
  const S = R.state();
  box(`${head('👥 사람들')}${I.people.map(p => `<div class="row"><div class="ic">${p.role === 'child' ? (p.gender === 'm' ? '👦' : '👧') : p.gender === 'm' ? '🧔' : '👩'}</div>
    <div class="main"><b>${esc(p.name)} <span class="dim" style="font-weight:400">${role[p.role] || p.role}${p.house ? ` · ${esc(p.house)} 가문` : ''}</span></b>
    <small>${p.alive ? `${p.age}살` : '세상을 떠남'}${p.role === 'father' && S.fatherAway ? ' · 왕의 전쟁에 나가 있음' : p.retired ? ' · 은퇴' : ''}</small></div></div>`).join('')}`);
}
function mStats(I) {
  const S = R.state();
  box(`${head('📊 능력치')}
    <div class="kv">${Object.entries(D.stats).map(([k, n]) => `<div><span>${D.statIcon[k]} ${n}</span><span><span class="dim">${S.stats[k]}</span> <span class="grade">${I.grades[k]}</span></span></div>`).join('')}</div>
    <div class="kv"><div><span>🗡 무기</span><span>${I.gear.weapon[0]}</span></div><div><span>🛡 갑옷</span><span>${I.gear.armor[0]}</span></div>
      <div><span>🏆 결투 승</span><span>${I.rec.wins}</span></div><div><span>🏰 수성 승리</span><span>${I.rec.sieges}</span></div>
      <div><span>🗺 원정 성공</span><span>${I.rec.adv}</span></div><div><span>🐫 교역</span><span>${I.rec.trades}</span></div>
      <div><span>🏗 건설</span><span>${I.rec.built}</span></div><div><span>🔥 약탈당함</span><span>${I.rec.raids}</span></div></div>
    <p class="note">판정은 등급 기준선에서 50%, 1점마다 ±1.5%. 등급: ${D.grades.map(g => `${g[0]} ${g[1]}`).join(' · ')}</p>`);
}
function mTax(I) {
  const t = I.realm.tax;
  box(`${head('📜 세율 <small class="dim" style="font-size:13px">행동 안 씀</small>')}
    <div class="choices">${[['낮게', '세금 줄어듦 · 민심이 서서히 오름'], ['보통', '균형'], ['높게', '세금 많이 · 민심이 서서히 떨어짐']].map(([n, d], i) => `<button class="b ${t === i ? 'on' : ''}" data-tax="${i}"><b>${n}</b> <span class="dim">— ${d}</span></button>`).join('')}</div>`);
}
function mMenu() {
  box(`${head('☰ 메뉴')}<div class="choices">
    <button class="b" data-modal="stats">📊 능력치·기록</button>
    <button class="b" data-modal="people">👥 사람들</button>
    <button class="b" data-help>❔ 어떻게 하나요</button>
    <button class="b red" data-newlife>⚜ 새 인생 (지금 인생 지움)</button>
    <a class="b" href="index.html" style="text-decoration:none">← 현대 Llife로</a></div>
    <div id="help" hidden><p class="note" style="font-size:13px;line-height:1.7">
      · 한 달에 행동 3번. 다 쓰면 ▶ 다음 달 → 월말 정산(세금·유지비·식량·민심·치안·인구).<br>
      · 가을(8~10월)에 수확. 식량이 바닥나면 백성이 떠난다.<br>
      · 정찰병이 위협을 알리면 1~2달 안에 수성전. 병력·훈련·성벽·통솔이 방어력.<br>
      · 원정은 칸을 하나씩 나아가며 결투·함정·보물. 다친 몸으로 지면 목숨이 위험.<br>
      · 시장에서 싸게 사서 🐫 상단으로 비싼 도시에 팔자. 철·마석으로 장비를 만든다.<br>
      · 선택지의 〔🎲 능력치 %〕는 성공 확률.</p></div>`);
}
function mEnding(S) {
  const E = S.ended;
  box(`${head(E.kind === 'exile' ? '🏚 추방' : '🕯 한 생의 끝', false)}
    <div class="story">${esc(E.text)}</div>
    <div class="kv"><div><span>나이</span><span>${E.age}살</span></div><div><span>다스린 해</span><span>${E.years}년</span></div>
      <div><span>명성</span><span>${num(E.fame)}</span></div><div><span>남은 인구</span><span>${num(E.realm.pop)}</span></div>
      <div><span>결투 승</span><span>${E.rec.wins}</span></div><div><span>수성 승리</span><span>${E.rec.sieges}</span></div>
      <div><span>원정 성공</span><span>${E.rec.adv}</span></div><div><span>후계자</span><span>${E.heirs}명</span></div></div>
    <p class="story" style="font-size:14px">${E.fame >= 300 ? '음유시인들이 그대의 이름을 노래한다. 전설의 영주.' : E.fame >= 120 ? '왕국 사람들이 그대의 이름을 기억한다.' : E.fame >= 40 ? '영지 사람들은 좋은 영주로 기억할 것이다.' : '역사는 그대를 오래 기억하지 않을 것이다.'}</p>
    <button class="b gold wide" data-newlife>⚜ 새 인생</button>`);
}

/* ═════ 입력 ═════ */
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-close]');
  if (!t || t.disabled || !R.state()) return;
  const d = t.dataset;
  if ('close' in d) return closeModal();
  if (d.modal) return openModal(d.modal);
  if (d.group) { ui.group = d.group; return render(); }
  if (d.act) { const r = R.act(d.act); if (typeof r === 'string') { if (r === 'caravan') ui.cv = null; openModal(r); } else render(); return; }
  if ('next' in d) { R.endMonth(); ui.modal = null; return render(); }
  if (d.choose != null) { R.choose(+d.choose); return render(); }
  if (d.fa) { const S = R.state(), mh = S.combat.hp, fh = S.combat.foe.hp; R.fightAct(d.fa); const c = R.state().combat; if (c) ui.hit = c.hp < mh ? 'me' : c.foe.hp < fh ? 'foe' : null; return render(); }
  if ('fightClose' in d) { R.closeFight(); return render(); }
  if (d.sa) { R.siegeAct(d.sa); return render(); }
  if ('siegeClose' in d) { R.siegeClose(); return render(); }
  if ('advStep' in d) { R.advStep(); return render(); }
  if ('advRetreat' in d) { R.advRetreat(); return render(); }
  if ('advClose' in d) { R.advClose(); ui.modal = null; return render(); }
  if (d.site) { ui.modal = null; R.startAdv(d.site); return render(); }
  if (d.build) { R.build(d.build); if (R.state().ap <= 0) ui.modal = null; return render(); }
  if (d.recruit) { const [k, n] = d.recruit.split(':'); R.recruit(k, +n); if (R.state().ap <= 0) ui.modal = null; return render(); }
  if (d.trade) { const [k, n] = d.trade.split(':'); R.trade(k, +n); return render(); }
  if (d.up) { R.upgrade(d.up); return render(); }
  if ('potion' in d) { R.buyPotion(); return render(); }
  if (d.tax != null) { R.setTax(+d.tax); ui.modal = null; return render(); }
  if (d.cto) { ui.cv.to = d.cto; return render(); }
  if (d.cg) { const [k, n] = d.cg.split(':'), have = R.market().find(g => g.id === k).have, cur = ui.cv.goods[k] || 0; ui.cv.goods[k] = Math.max(0, Math.min(have, n === 'all' ? have : cur + +n)); return render(); }
  if ('cesc' in d) { ui.cv.escort = !ui.cv.escort; return render(); }
  if ('csend' in d) { if (R.sendCaravan(ui.cv.to, ui.cv.goods, ui.cv.escort, ui.cv.back || null)) { ui.cv = null; ui.modal = null; } return render(); }
  if ('help' in d) { const h = $('#help'); if (h) h.hidden = !h.hidden; return; }
  if ('newlife' in d) { if (!R.state().ended && !confirm('지금 인생을 지우고 새로 시작할까요?')) return; R.reset(); ui.modal = null; ui.made = null; return showStart(); }
});
document.addEventListener('change', e => { if (e.target.matches('[data-cback]')) { ui.cv.back = e.target.value; } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.modal && !R.event()) closeModal(); });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && ui.modal && !R.event() && !R.state()?.combat && !R.state()?.siege && !R.state()?.adv && !R.state()?.ended) closeModal(); });

R.on(() => {});
if (R.init()) render(); else showStart();
window.RealmUI = { render, openModal };
})();
