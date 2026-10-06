// Llife: 영지 — 화면. 엔진(js/realm.js · js/realm-life.js)의 window.Realm 을 그림
//   시작 화면(시작 방식 · 이름 · 가문 · 종족 · 작위 · 땅 · 기질/길 · 샌드박스 값 · 문장) → (유년기) → 본편(HUD · 영지 현황 · 위협 · 기록 · 행동)
//   창: 사건 · 결투 · 모험 · 수성전 · 건설 · 징병 · 시장 · 상단 · 대장간 · 원정지 · 강함 · 사람들/인물 · 마을 나들이 · 용병 길드 · 노예시장 · 법령 · 능력치 · 세율 · 메뉴 · 결말
//   초상화는 현대 모드의 js/avatar.js를 그대로 쓰고, 종족(엘프 귀·수인 귀·오크·드워프)과 중세 옷(data/realm-world.js looks)만 얹음
(() => {
const R = window.Realm, D = window.REALM, L = () => R.life;
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
  { id: 'gifted', icon: '✨', name: '마법의 재능', desc: '마력 +8 · 처음부터 마나 수련 가능' },
];
const PATHS = [
  { id: 'knight', icon: '⚔️', name: '기사의 길', desc: '무력·체력·민첩 크게 · 오러 각성 직전' },
  { id: 'mage', icon: '✨', name: '마법사의 길', desc: '마력·학식 크게 · 1서클로 시작' },
  { id: 'ruler', icon: '📜', name: '영주의 길', desc: '정무·통솔·학식 크게' },
  { id: 'social', icon: '🎻', name: '사교의 길', desc: '화술·통솔 크게' },
];
const MODES = [['child', '🌱 유년기부터', '6살부터 네 장면, 15살에 영주 대리'], ['q20', '⚔️ 20살 시작', '고른 길대로 자라 스무 살에 바로 영주'], ['sandbox', '🎮 샌드박스', '스무 살, 능력치·오러·서클·용병·금화를 마음대로']];
const GROUPS = [['self', '🧍 나'], ['social', '💬 교류'], ['realm', '🏰 영지'], ['adv', '🗺 모험'], ['trade', '🐫 교역']];
const ui = { group: 'self', modal: null, cv: null, made: null, lastLog: -1, hit: null, pid: null, flash: '' };

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

/* ═════ 초상화 ═════ */
const LOOKC = new Map();
function lookOf(o) {
  const k = `${o.seed}|${o.gender}|${o.race}|${o.beast || ''}`;
  if (!LOOKC.has(k)) LOOKC.set(k, Avatar.make(o.seed, o.gender, { race: o.race || 'human', beast: o.beast || undefined }));
  return LOOKC.get(k);
}
// 보이는 나이: 엘프는 서른 남짓에서 멈추고, 드워프는 절반쯤
const visAge = (race, age) => race === 'elf' ? Math.min(age, 30) : race === 'dwarf' ? (age < 20 ? age : Math.min(62, 20 + Math.round((age - 20) / 2))) : age;
const hashC = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return D.crestColors[h % D.crestColors.length]; };
function outfitFor(kind, g, color) {
  const Lk = D.looks[kind] || D.looks.common, o = JSON.parse(JSON.stringify(Lk[g] || Lk.m));
  for (const k of ['inner', 'outer', 'dress', 'bottom']) if (o[k] && o[k].c === '$house') o[k].c = color;
  o.acc = o.acc || {};
  return o;
}
function portrait(o, size = 56) {
  if (!window.Avatar) return `<span class="pf-emoji" style="font-size:${size * .6}px">${(D.races[o.race] || D.races.human).icon}</span>`;
  try { return Avatar.render(lookOf(o), size, { age: Math.max(4, visAge(o.race, o.age)), outfit: outfitFor(o.kind || 'common', o.gender, o.color || '#6b4a8a'), lod: size <= 64 ? 1 : 2 }); }
  catch (e) { return `<span class="pf-emoji">${(D.races[o.race] || D.races.human).icon}</span>`; }
}
const FAMILY = ['father', 'mother', 'sibling', 'child', 'spouse'];
function personPF(p, size) {
  const S = R.state();
  const kind = FAMILY.includes(p.role) ? 'noble' : (D.roles[p.role] || {}).look || 'common';
  const color = FAMILY.includes(p.role) || ['knight', 'captain'].includes(p.role) ? S.crest.color : hashC(p.seed);
  return portrait({ seed: p.seed || p.id, gender: p.gender, race: p.race, beast: p.beast, age: p.age, kind, color }, size);
}
function mePF(size, I) { I = I || R.info(); return portrait({ seed: I.seed, gender: I.gender, race: I.race, beast: I.beast, age: I.age, kind: 'noble', color: I.crest.color }, size); }

/* ═════ 시작 화면 ═════ */
function showStart() {
  $('#app').hidden = true; $('#start').hidden = false;
  const m = ui.made || (ui.made = { mode: 'child', gender: 'm', name: '', house: pick(HOUSE_NAMES), land: 'march', trait: 'strong', path: 'knight', race: 'human', beast: 'wolf', peer: 1,
    crest: { color: pick(D.crestColors), sym: pick(D.crestSyms) }, seed: 'me' + Math.floor(Math.random() * 1e9),
    sb: { stats: { might: 40, agility: 40, vigor: 40, command: 40, stewardship: 40, charm: 40, lore: 40, arcana: 30 }, aura: 0, circle: 0, merc: -1, gold: 500, fame: 0, troops: 1, noThreat: false, noDeath: false } });
  const age = m.mode === 'child' ? 6 : 20, RC = D.races[m.race];
  const pv = portrait({ seed: m.seed, gender: m.gender, race: m.race, beast: m.race === 'beast' ? m.beast : null, age: Math.max(age, 20), kind: 'noble', color: m.crest.color }, 92);
  const raceCard = (id, r) => `<button class="b opt race ${m.race === id ? 'on' : ''}" data-race="${id}">${portrait({ seed: 'rc' + id + m.gender, gender: m.gender, race: id, beast: id === 'beast' ? m.beast : null, age: 26, kind: 'common', color: '#6b5038' }, 52)}
    <span><span class="t">${r.icon} ${r.name}</span><small>${r.desc}</small><small class="gold-t">${Object.entries(r.bonus).map(([k, v]) => `${D.stats[k]} ${v > 0 ? '+' : ''}${v}`).join(' · ')} · 수명 ~${r.life.max}</small></span></button>`;
  const sb = m.sb;
  const sandbox = m.mode !== 'sandbox' ? '' : `<div class="field"><label>🎮 샌드박스 — 능력치</label><div class="sliders">${Object.entries(D.stats).map(([k, n]) => `
      <label class="sl"><span>${D.statIcon[k]} ${n}</span><input type="range" min="0" max="100" value="${sb.stats[k]}" data-sbs="${k}"><b>${sb.stats[k]}</b></label>`).join('')}</div></div>
    <div class="field"><label>강함</label><div class="two">
      <label class="sel">🗡 오러<select data-sb="aura">${D.aura.map(a => `<option value="${a.lv}" ${sb.aura == a.lv ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label>
      <label class="sel">✨ 서클<select data-sb="circle">${D.circles.map(c => `<option value="${c.lv}" ${sb.circle == c.lv ? 'selected' : ''}>${c.name}${c.title ? ` (${c.title})` : ''}</option>`).join('')}</select></label>
      <label class="sel">🛡 용병<select data-sb="merc"><option value="-1">길드 미등록</option>${D.mercGrades.map((g, i) => `<option value="${i}" ${sb.merc == i ? 'selected' : ''}>${g.name}</option>`).join('')}</select></label>
      <label class="sel">💰 금화<input type="number" min="0" max="99999" value="${sb.gold}" data-sb="gold"></label>
      <label class="sel">⭐ 명성<input type="number" min="0" max="9999" value="${sb.fame}" data-sb="fame"></label>
      <label class="sel">🛡 병력<select data-sb="troops">${[1, 2, 3, 5].map(x => `<option value="${x}" ${sb.troops == x ? 'selected' : ''}>×${x}</option>`).join('')}</select></label></div>
      <div class="two" style="margin-top:8px"><button class="b ${sb.noThreat ? 'on' : ''}" data-sbt="noThreat">${sb.noThreat ? '✅' : '⬜'} 위협 없음</button><button class="b ${sb.noDeath ? 'on' : ''}" data-sbt="noDeath">${sb.noDeath ? '✅' : '⬜'} 죽지 않음</button></div></div>`;
  $('#start').innerHTML = `
    <h1>⚜ Llife: 영지</h1>
    <p class="tag">영주의 자식으로 태어나, 땅을 지키고, 교역하고, 모험을 떠나라.</p>
    <div class="field"><div class="modes">${MODES.map(([id, n, d]) => `<button class="b ${m.mode === id ? 'on' : ''}" data-mode="${id}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
    <div class="preview"><div class="pf big">${pv}</div>${crestSVG(m.crest, 48)}<div><b style="font-family:var(--serif);font-size:18px">${esc(m.house)} 가문</b><div class="dim">${esc(m.name || '(이름은 비우면 무작위)')} · ${m.gender === 'm' ? '아들' : '딸'} · ${RC.name}${m.race === 'beast' ? `(${RC.subs[m.beast].name})` : ''} · ${D.peerage[m.peer].name}가</div></div></div>
    <div class="field"><label>이름 · 가문</label><div class="two">
      <input id="f-name" maxlength="10" placeholder="이름 (비우면 무작위)" value="${esc(m.name)}">
      <input id="f-house" maxlength="12" placeholder="가문 이름" value="${esc(m.house)}"></div></div>
    <div class="field"><label>태어난 자식</label><div class="two">
      <button class="b ${m.gender === 'm' ? 'on' : ''}" data-g="m">🗡 영주의 아들</button>
      <button class="b ${m.gender === 'f' ? 'on' : ''}" data-g="f">🌹 영주의 딸</button></div>
      <button class="b sm" data-reface style="margin-top:6px">🎲 얼굴 다시 뽑기</button></div>
    <div class="field"><label>종족</label><div class="opts races">${Object.entries(D.races).map(([id, r]) => raceCard(id, r)).join('')}</div>
      ${m.race === 'beast' ? `<div class="chips" style="margin-top:8px">${Object.entries(D.races.beast.subs).map(([id, s]) => `<button class="b sm ${m.beast === id ? 'on' : ''}" data-beast="${id}">${s.name} <small>${Object.entries(s.bonus).map(([k, v]) => `${D.stats[k]}+${v}`).join(' ')}</small></button>`).join('')}</div>` : ''}</div>
    <div class="field"><label>가문의 작위 (클수록 영지도 위협도 큼)</label><div class="chips">${D.peerage.map((p, i) => `<button class="b sm ${m.peer === i ? 'on' : ''}" data-peer="${i}">${p.name} <small>${p.land}</small></button>`).join('')}</div></div>
    <div class="field"><label>물려받을 땅</label><div class="opts">${D.lands.map(l => `
      <button class="b opt ${m.land === l.id ? 'on' : ''}" data-land="${l.id}"><span class="t">${l.icon} ${l.name}</span><small>${l.desc}</small></button>`).join('')}</div></div>
    ${m.mode === 'q20' ? `<div class="field"><label>자라 온 길</label><div class="opts">${PATHS.map(t => `<button class="b opt ${m.path === t.id ? 'on' : ''}" data-path="${t.id}"><span class="t">${t.icon} ${t.name}</span><small>${t.desc}</small></button>`).join('')}</div></div>` : ''}
    ${m.mode !== 'sandbox' ? `<div class="field"><label>타고난 기질</label><div class="opts">${TRAITS.map(t => `
      <button class="b opt ${m.trait === t.id ? 'on' : ''}" data-trait="${t.id}"><span class="t">${t.icon} ${t.name}</span><small>${t.desc}</small></button>`).join('')}</div></div>` : ''}
    ${sandbox}
    <div class="field"><label>가문의 문장</label>
      <div class="swatches" style="margin-bottom:8px">${D.crestColors.map(c => `<button class="sw ${m.crest.color === c ? 'on' : ''}" data-col="${c}" style="background:${c}" aria-label="색 ${c}"></button>`).join('')}</div>
      <div class="swatches">${D.crestSyms.map(s => `<button class="b sym ${m.crest.sym === s ? 'on' : ''}" data-sym="${s}">${s}</button>`).join('')}</div></div>
    <button class="b gold wide" id="f-go" style="min-height:52px;font-size:17px">⚜ ${m.mode === 'child' ? '태어나기' : '영주로 시작'}</button>
    <a class="back-link" href="index.html">← 현대 Llife로 돌아가기</a>`;
  const keep = () => { m.name = $('#f-name').value.trim(); m.house = $('#f-house').value.trim() || m.house; };
  $('#start').onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    keep();
    const d = t.dataset;
    if (d.mode) m.mode = d.mode;
    else if (d.g) m.gender = d.g;
    else if ('reface' in d) m.seed = 'me' + Math.floor(Math.random() * 1e9);
    else if (d.race) m.race = d.race;
    else if (d.beast) m.beast = d.beast;
    else if (d.peer) m.peer = +d.peer;
    else if (d.land) m.land = d.land;
    else if (d.trait) m.trait = d.trait;
    else if (d.path) m.path = d.path;
    else if (d.col) m.crest.color = d.col;
    else if (d.sym) m.crest.sym = d.sym;
    else if (d.sbt) m.sb[d.sbt] = !m.sb[d.sbt];
    else if (t.id === 'f-go') {
      R.newGame({ name: m.name, gender: m.gender, house: m.house, land: m.land, trait: m.trait, crest: m.crest, race: m.race, beast: m.beast, peer: m.peer, seed: m.seed,
        start: m.mode, path: m.path, sandboxOpts: m.mode === 'sandbox' ? Object.assign({}, m.sb, { stats: Object.assign({}, m.sb.stats) }) : null });
      ui.lastLog = -1; ui.made = null; return render();
    } else return;
    showStart();
  };
  $('#start').oninput = e => { const t = e.target; if (t.dataset.sbs) { m.sb.stats[t.dataset.sbs] = +t.value; t.nextElementSibling.textContent = t.value; } };
  $('#start').onchange = e => { const t = e.target; if (t.dataset.sb) m.sb[t.dataset.sb] = +t.value; };
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
  $('#hud').innerHTML = `<button class="me-pf" data-modal="power" aria-label="강함">${mePF(60, I)}<span class="me-crest">${crestSVG(I.crest, 22)}</span></button>
    <div class="who"><h1>${esc(I.name)} <span class="grade-chip" title="강함 등급">${I.mightGrade.id}</span></h1>
      <div class="sub">${esc(I.titleLabel)} · ${I.age}살 · ${esc(I.raceName)}${hurt}</div>
      <div class="bars" style="margin:4px 0 0"><span>❤️</span>${pctBar('hp', I.hp, I.hpMax)}<span class="dim">${I.hp}/${I.hpMax}</span></div></div>
    <div class="date"><b>${I.year}년 ${I.month}월</b>${I.season} · ${I.land.icon}<div class="ap" title="이번 달 남은 행동" style="margin-top:4px">${Array.from({ length: I.apMax }, (_, i) => `<i class="${i < I.ap ? 'on' : ''}"></i>`).join('')}</div><div class="dim" style="font-size:11px">⭐ ${num(I.fame)} · 👑 ${num(I.favor)}</div></div>
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
  if (I.preg) bits.push(`👶 아이가 생겼다 — ${Math.max(0, I.preg.due - R.state().monthN)}달 뒤`);
  if (I.canPromote) bits.push('👑 작위를 올릴 자격이 됐다 — 다음 달 왕의 교서가 올 것이다');
  el.hidden = !bits.length;
  el.classList.toggle('calm', !t);
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
      ${ui.group === 'self' ? `<button class="b act" data-modal="stats"><span class="t">📊 능력치</span><span class="d">등급·장비·기록</span></button>` : ''}</div>
    <div class="foot"><button class="b gold next" data-next ${busy ? 'disabled' : ''}>▶ 다음 달${I.ap > 0 ? ` <small style="font-weight:400;opacity:.8">(행동 ${I.ap} 남음)</small>` : ''}</button></div>`;
}

/* ═════ 창 ═════ */
function openModal(name, arg) { ui.modal = name; ui.arg = arg; ui.flash = ''; render(); }
function closeModal() { ui.modal = null; ui.flash = ''; render(); }
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
  const f = { build: mBuild, recruit: mRecruit, market: mMarket, caravan: mCaravan, smith: mSmith, adventure: mSites, people: mPeople, person: mPerson, stats: mStats, tax: mTax, menu: mMenu,
    power: mPower, town: mTown, scene: mScene, guild: mGuild, port: mPort, laws: mLaws }[ui.modal];
  if (f) f(I); else closeModal();
}
const head = (t, x = true) => `<h2>${t}${x ? '<button class="b sm x" data-close>✕</button>' : ''}</h2>`;
const flash = () => ui.flash ? `<p class="flash">${esc(ui.flash)}</p>` : '';

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
  const spells = (o.spells || []).map(x => `<button class="b sm spell" data-fa="spell:${x.id}" ${!over && x.ok ? '' : 'disabled'}>${x.icon} ${x.name}<span class="pct">${x.dmg ? x.dmg : x.heal ? `+${Math.round(x.heal * 100)}%` : '막 50%'} · 마나 ${x.mp}</span></button>`).join('');
  const moves = over ? `<button class="b gold wide" data-fight-close>${over === 'win' ? '🏆 승리! 계속' : over === 'fled' ? '🏃 물러난다' : '🩸 쓰러졌다…'}</button>` : `<div class="moves">
      <button class="b" data-fa="hit">⚔️ 베기<span class="pct">${o.hit}%</span></button>
      <button class="b" data-fa="power">💥 강타<span class="pct">${o.power}% ×1.7</span></button>
      <button class="b" data-fa="guard">🛡 막기<span class="pct">반격 35%</span></button>
      ${o.aura ? `<button class="b aura" data-fa="aura">🗡✨ ${o.aura.name}<span class="pct">${o.aura.hit}% · ${o.aura.dmg} · ${o.aura.n}번</span></button>` : ''}
      <button class="b" data-fa="potion" ${S.potions > 0 ? '' : 'disabled'}>🧪 물약<span class="pct">${S.potions}개</span></button>
      <button class="b" data-fa="flee" ${o.canFlee ? '' : 'disabled'}>🏃 도망<span class="pct">${o.canFlee ? o.flee + '%' : '불가'}</span></button></div>
      ${spells ? `<div class="spells"><span class="dim">✨ 마나 ${c.mp}/${c.mpMax}</span>${spells}</div>` : ''}`;
  box(`${head(`⚔️ 결투 · ${c.turn}턴`, false)}
    <div class="duel">
      <div class="fighter"><div class="face pf ${shakeMe}">${mePF(64)}</div><div class="nm">${esc(S.name)}</div>${pctBar('hp', c.hp, c.hpMax)}<div class="hpn">${Math.max(0, c.hp)}/${c.hpMax}${c.guard ? ' · 🛡' : ''}${c.shield ? ' · 🔰' : ''}</div></div>
      <div class="vs">VS</div>
      <div class="fighter"><div class="face ${shakeFoe}">${f.icon}</div><div class="nm">${esc(f.name)}${f.spec ? ` <small class="dim">${{ regen: '재생', drain: '흡혈', breath: '불길' }[f.spec]}</small>` : ''}</div>${pctBar('foe', f.hp, f.hpMax)}<div class="hpn">${Math.max(0, f.hp)}/${f.hpMax}</div></div>
    </div>
    ${c.party && c.party.length ? `<p class="dim" style="margin:-4px 0 6px;font-size:12px">🤝 동료: ${c.party.map(m => esc(m.name)).join(', ')} (차례마다 지원 공격)</p>` : ''}
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
  const party = R.info().party || [];
  box(`${head(`${A.site.icon} ${esc(A.site.name)}`, false)}
    <div class="path">${A.path.map((k, j) => `<span class="${j < A.i ? 'done' : j === A.i && !A.done ? 'here' : ''}">${icons[k] || k}</span>`).join('')}</div>
    <div class="bars"><span>❤️</span>${pctBar('hp', A.hp, A.hpMax)}<span class="dim">${A.hp}/${A.hpMax} · 🧪${A.potions}</span></div>
    ${party.length ? `<div class="party-row">${party.map(p => `<span class="mini">${personPF(p, 34)}<small>${esc(p.name)}</small></span>`).join('')}</div>` : ''}
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
    <p class="note">병영 단계와 작위가 높을수록 상비병·기사를 더 둘 수 있다. 징집병은 인구에서 뽑아 민심과 농사가 조금 준다. 지금 방어력 ⚔️ ${num(I.realm.defense)} (훈련도 ${I.realm.drill})</p>`);
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
  const S = R.state(), cp = I.cp, rec = [0, 34, 60, 95, 130];
  box(`${head('🗺 원정 <small class="dim" style="font-size:13px">이번 달 행동을 모두 씀</small>')}
    ${R.sites().map(s => { const ok = cp >= rec[s.tier];
      return `<div class="row"><div class="ic">${s.icon}</div><div class="main"><b>${s.name} <span class="${ok ? 'plus' : 'minus'}" style="font-weight:400;font-size:12px">${'★'.repeat(s.tier)} ${ok ? '해볼 만함' : `위험 (강함 ${rec[s.tier]}↑ 권장)`}</span></b>
        <small>${s.desc}<br>${s.nodes}칸 · ${[...new Set(s.foes)].map(f => D.foes[f].icon).join('')}${s.boss ? ` · 우두머리 ${D.foes[s.boss].icon}` : ''} · 💰${s.gold[0]}~${s.gold[1]}</small></div>
        <button class="b sm" data-site="${s.id}" ${I.ap > 0 ? '' : 'disabled'}>출발</button></div>`; }).join('')}
    <p class="note">내 강함 ${cp} (${I.mightGrade.id} ${I.mightGrade.name}) · ❤️ ${I.hp}/${I.hpMax} · 🧪 ${I.potions}개${(I.party || []).length ? ` · 🤝 동료 ${I.party.map(p => esc(p.name)).join(', ')}` : ' · 동료 없음 (💬 교류 → 사람들에서 데려갈 수 있음)'}${I.injury ? ' · <span class="minus">🩹 부상 중 — 지면 목숨이 위험</span>' : ''}</p>`);
}
// 강함: 강함 등급 · 오러 · 서클 · 용병 · 작위
function circleRings(lv) {
  return `<svg class="rings" viewBox="0 0 100 100" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => { const r = 8 + i * 4.6, on = i < lv;
    return `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${on ? '#9d8bff' : '#3b3122'}" stroke-width="${on ? 2.2 : 1.2}" ${on ? 'filter="url(#gl)"' : ''} opacity="${on ? 1 : .7}"/>`; }).join('')}
    <defs><filter id="gl"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <text x="50" y="55" text-anchor="middle" font-size="14" fill="#efe6d2" font-weight="800">${lv}</text></svg>`;
}
function mPower(I) {
  const A = I.aura, C = I.circle, M = I.merc, P = I.peer, nextP = D.peerage[I.peerIdx + 1];
  const gradeIdx = D.might.findIndex(g => g.id === I.mightGrade.id), nextG = D.might[gradeIdx + 1];
  box(`${head('💠 강함')}
    <div class="power-top"><div class="pf big">${mePF(96, I)}</div>
      <div><div class="grade-big">${I.mightGrade.id}</div><b>${I.mightGrade.name}</b><div class="dim">전투력 ${I.cp}${nextG ? ` · 다음 ${nextG.id}까지 ${nextG.min - I.cp}` : ''}</div>
      <div class="dim" style="font-size:12px;margin-top:4px">${esc(I.raceName)} · ${esc(I.titleLabel)}</div></div></div>
    <div class="pw"><div class="pw-h">🗡 오러 — <b>${A.name}</b></div>
      ${A.next ? `${pctBar('aura', A.xp, A.next.need)}<small class="dim">수련 ${A.xp}/${A.next.need} → ${A.next.name} (돌파 판정 ${A.next.check}${A.next.insight ? ' · 실전 경험 필요' : ''})</small>` : '<small class="dim">더 오를 곳이 없다.</small>'}
      ${A.lv ? `<small>${A.desc} · 공격 +${A.atk} · 결투마다 ${A.charges}번 ${A.lv >= 5 ? '오러 블레이드' : '오러 베기'} ×${A.mult}</small>` : `<small class="dim">${R.state().stats.might >= 30 ? '🧍 나 → 오러 수련으로 각성할 수 있다.' : '무력 30부터 오러 수련을 시작할 수 있다.'}</small>`}</div>
    <div class="pw"><div class="pw-h">✨ 서클 — <b>${C.lv ? `${C.name} ${C.title}` : '마법 없음'}</b></div>
      <div class="circle-row">${circleRings(C.lv)}<div style="flex:1">
        ${C.next ? `${pctBar('mana', C.xp, C.next.need)}<small class="dim">마나 ${C.xp}/${C.next.need} → ${C.next.name} (마석 ${C.next.stones}개 · 판정 ${C.next.check}) · 가진 마석 ${R.state().inv.mana || 0}</small>` : '<small class="dim">9서클, 마법의 끝.</small>'}
        <div class="spell-list">${I.spells.map(x => `<span>${x.icon} ${x.name}</span>`).join('') || '<small class="dim">아직 쓸 수 있는 주문이 없다.</small>'}</div>
        <small class="dim">결투 마나 ${I.mpMax}</small></div></div></div>
    <div class="pw"><div class="pw-h">🛡 용병 — <b>${M ? `${M.grade.name} '${esc(M.alias)}'` : '길드 미등록'}</b></div>
      ${M ? (M.next ? `${pctBar('merc', M.pts, M.next.need)}<small class="dim">공적 ${M.pts}/${M.next.need} → ${M.next.name}${M.next.test ? ` (승급 시험: ${D.foes[M.next.test].name})` : ''} · 완료한 의뢰 ${M.done}</small>` : '<small>S급. 대륙 최고의 용병이다.</small>') : '<small class="dim">🗺 모험 → 용병 길드에서 신분을 숨기고 등록할 수 있다.</small>'}</div>
    <div class="pw"><div class="pw-h">👑 작위 — <b>${P.name}</b> <small class="dim">(${P.land})</small></div>
      ${nextP ? `<small class="dim">다음 ${nextP.name}: 왕실 공헌 ${I.favor}/${nextP.favor} · 명성 ${num(I.fame)}/${nextP.fame}${R.state().title !== '영주' ? ' · 영주가 된 뒤에' : ''}</small>${pctBar('favor', Math.min(I.favor / nextP.favor, I.fame / nextP.fame), 1)}` : '<small>더 오를 작위가 없다.</small>'}</div>`);
}
// 사람들 · 인물
const REL_ICON = { lover: '💕', spouse: '💍', consort: '👑' };
function affBar(a) { return `<span class="aff"><i style="width:${a}%"></i></span>`; }
function mPeople() {
  const ps = L().people(), S = R.state();
  const groups = [['💍 배우자·연인', p => p.rel], ['👪 가족', p => ['father', 'mother', 'sibling', 'child'].includes(p.role)], ['🏰 성 안 사람들', p => !p.place && !p.rel && !['father', 'mother', 'sibling', 'child'].includes(p.role)], ['🏘 마을에서 만난 사람', p => p.place && !p.rel]];
  const seen = new Set();
  const html = groups.map(([t, f]) => { const list = ps.filter(p => !seen.has(p.id) && f(p)); list.forEach(p => seen.add(p.id)); if (!list.length) return '';
    return `<div class="grp-h">${t}</div>${list.map(p => `<button class="prow" data-person="${p.id}"><span class="pf sm">${personPF(p, 44)}</span><span class="main"><b>${esc(p.name)} ${REL_ICON[p.rel] || ''}${p.inParty ? ' 🤝' : ''}</b>
      <small>${esc(p.roleName)} · ${esc(p.raceName)} · ${p.age}살 · ${esc(p.rankName)}</small><small>${affBar(p.aff)} 호감 ${p.aff} · 강함 ${p.grade.id}</small></span></button>`).join('')}`; }).join('');
  box(`${head('👥 사람들')}${html || '<p class="dim">아직 아는 사람이 없다.</p>'}<p class="note">교류는 행동을 쓰지 않는다 (사람마다 한 달에 한 번씩). 사귈 수 있는 건 20살 이상끼리, 부리는 사람(시녀·시종·집사·기사단장)과 해방민은 구애 대상이 아니다.</p>`);
}
function mPerson() {
  const p = L().people().find(x => x.id === ui.pid);
  if (!p) return openModal('people');
  const P = D.personalities[p.personality] || {};
  const opts = L().options(p.id);
  box(`${head(`${esc(p.name)} ${REL_ICON[p.rel] || ''}`)}
    <div class="power-top"><div class="pf big">${personPF(p, 104)}</div><div class="kvs">
      <div>${esc(p.roleName)} · ${esc(p.rankName)}</div><div>${esc(p.raceName)} · ${p.age}살 · ${p.gender === 'm' ? '남' : '여'}</div>
      <div>성격: ${P.name || '-'}</div><div>강함 ${p.grade.id} <small class="dim">(${p.grade.name} · ${p.cp})</small>${p.aura ? ` · 🗡 ${D.aura[p.aura].short}` : ''}${p.circle ? ` · ✨ ${p.circle}서클` : ''}</div>
      <div>${affBar(p.aff)} 호감 ${p.aff}${p.relName ? ` · <b>${p.relName}</b>` : ''}</div></div></div>
    ${flash()}
    <div class="choices">${opts.map(o => `<button class="b" data-pact="${o.id}" ${o.ok ? '' : 'disabled'}>${o.label}${o.note ? ` <span class="pct">${esc(o.note)}</span>` : ''}</button>`).join('') || '<p class="dim">지금은 할 수 있는 게 없다.</p>'}</div>
    <button class="b sm" data-modal="people" style="margin-top:10px">← 사람들</button>`);
}
// 마을 나들이
function mTown(I) {
  box(`${head('🏘 마을 나들이 <small class="dim" style="font-size:13px">행동 1</small>')}
    ${L().places().map(P => `<div class="row"><div class="ic">${P.icon}</div><div class="main"><b>${P.name}</b><small>${P.desc}</small></div><button class="b sm" data-town="${P.id}" ${P.ok && I.ap > 0 ? '' : 'disabled'}>가기</button></div>`).join('')}
    <p class="note">장소마다 만나는 사람이 다르다. 말을 건 사람은 기억에 남고, 다음에 또 마주칠 수 있다.</p>`);
}
function mScene() {
  const T = L().townInfo();
  if (!T) return closeModal();
  box(`${head(`${T.place.icon} ${esc(T.place.name)}`)}
    <div class="scene">${T.here.map(p => { const q = L().people().find(x => x.id === p.id) || Object.assign({ roleName: (D.roles[p.role] || {}).name, raceName: D.races[p.race].name, grade: { id: '?' } }, p);
      return `<button class="scard" data-person="${p.id}"><span class="pf">${personPF(p, 72)}</span><b>${esc(p.name)}${p.met ? '' : ' <small class="dim">처음 봄</small>'}</b><small>${esc(q.roleName || '')} · ${esc(q.raceName || '')} · ${p.age}살</small></button>`; }).join('')}</div>
    <p class="note">누구에게 말을 걸까? (교류는 행동을 쓰지 않는다)</p>`);
}
// 용병 길드
function mGuild(I) {
  const M = I.merc;
  if (!M) return box(`${head('🛡 용병 길드')}<div class="story" style="font-size:15px">게시판엔 의뢰서가 빼곡하고, 탁자마다 칼자국이 나 있다. 귀족이 이름을 올린 일은 없다 — 신분을 숨긴다면 모를까.</div>
    <button class="b gold wide" data-greg ${I.realm.gold >= 10 ? '' : 'disabled'}>✍️ 가명으로 등록한다 (💰10)</button><p class="note">등급 F~S. 의뢰를 마치면 공적이 쌓이고, 승급 시험을 통과하면 등급이 오른다.</p>`);
  const B = L().board(), N = M.next;
  const KIND = { hunt: '⚔️ 토벌', escort: '🐎 호위', gather: '🌿 채집', probe: '🔍 조사' };
  box(`${head(`🛡 용병 길드 — ${M.grade.name} '${esc(M.alias)}'`)}
    ${N ? `<div class="bars"><span>공적</span>${pctBar('merc', M.pts, N.need)}<b>${M.pts}/${N.need}</b></div>
      <button class="b ${M.pts >= N.need ? 'gold' : ''} wide" data-gtest ${M.pts >= N.need && (I.ap > 0 || !N.test) ? '' : 'disabled'}>🎖 ${N.name} 승급 시험${N.test ? ` — ${D.foes[N.test].icon} ${D.foes[N.test].name} (행동 1)` : ''}</button>` : '<p>S급. 더 오를 곳이 없다.</p>'}
    <div class="grp-h">📋 이달의 의뢰</div>
    ${B.map(q => `<div class="row stack"><div class="ic">${KIND[q.kind].split(' ')[0]}</div><div class="main"><b>${esc(q.name)} <span class="dim" style="font-weight:400;font-size:12px">${q.gradeName} 이상</span></b>
      <small>${KIND[q.kind]} · 💰${q.gold[0]}~${q.gold[1]} · 공적 ${q.pts}${q.pct != null ? ` · 🎲 ${D.stats[q.stat]} ${q.pct}%` : ''}${q.foes ? ` · ${q.foes.map(f => D.foes[f].icon).join('')}` : q.foe ? ` · 습격 ${D.foes[q.foe].icon}` : ''}</small></div>
      <div class="btns">${q.taken ? '<span class="dim">끝남</span>' : `<button class="b sm" data-quest="${q.i}" ${q.ok ? '' : 'disabled'}>맡는다</button>`}</div></div>`).join('')}
    <p class="note">의뢰마다 행동 1. 원정 동료가 있으면 결투에서 지원 공격을 해 준다.</p>`);
}
// 노예시장 (해방만)
function mPort(I) {
  const list = L().slaves();
  if (!list) return box(`${head('⚓ 벨레노 뒷골목')}<div class="story" style="font-size:15px">항구도시 벨레노의 뒷골목엔 노예시장이 선다. 사슬에 묶인 사람들이 경매대에 오른다.</div>
    <button class="b gold wide" data-port ${I.ap > 0 ? '' : 'disabled'}>⚓ 가 본다 (행동 1)</button>
    <p class="note">이 게임에서 사람을 소유할 수는 없다. 값을 치르면 그 자리에서 해방 증서를 써 주고, 남을지 떠날지는 그 사람이 정한다.${I.laws && I.laws.noSlavery ? ' 우리 영지에선 이미 노예 매매를 금지했다.' : ' 🏰 영지 → 📜 법령에서 영지 안 노예 매매를 금지할 수도 있다.'}</p>`);
  box(`${head('⚓ 벨레노 노예시장')}
    ${list.map((x, i) => `<div class="row stack"><span class="pf sm">${portrait({ seed: x.seed, gender: x.gender, race: x.race, beast: x.beast, age: x.age, kind: 'common', color: '#5a4c3a' }, 52)}</span>
      <div class="main"><b>${esc(x.name)} <span class="dim" style="font-weight:400">${D.races[x.race].name}${x.beast ? `(${D.races.beast.subs[x.beast].name})` : ''} · ${x.age}살</span></b>
      <small>${esc(x.origin)} · ${D.slaveSkills.find(k => k.id === x.skill).name} · ${D.personalities[x.personality].name}</small></div>
      <div class="btns">${x.freed ? '<span class="plus">해방됨</span>' : `<button class="b sm" data-free="${i}" ${I.realm.gold >= x.price ? '' : 'disabled'}>📜 해방시키기 💰${x.price}</button>`}</div></div>`).join('')}
    <p class="note">해방된 사람은 자유민이 된다. 성에 남겠다고 하면 가신(해방민)으로 맞는다 — 해방민은 구애 대상이 아니다.</p>`);
}
function mLaws() {
  box(`${head('📜 법령 <small class="dim" style="font-size:13px">반포에 행동 1</small>')}
    ${L().laws().map(l => `<div class="row"><div class="ic">📜</div><div class="main"><b>${l.name}</b><small>${l.desc}</small></div>${l.done ? '<span class="plus">시행 중</span>' : `<button class="b sm" data-law="${l.id}" ${l.ok ? '' : 'disabled'}>반포</button>`}</div>`).join('')}`);
}
function mStats(I) {
  const S = R.state();
  box(`${head('📊 능력치')}
    <div class="kv">${Object.entries(D.stats).map(([k, n]) => `<div><span>${D.statIcon[k]} ${n}</span><span><span class="dim">${S.stats[k]}</span> <span class="grade">${I.grades[k]}</span></span></div>`).join('')}</div>
    <div class="kv"><div><span>🧬 종족</span><span>${esc(I.raceName)}</span></div><div><span>👑 작위</span><span>${I.peer.name}</span></div>
      <div><span>🗡 무기</span><span>${I.gear.weapon[0]}</span></div><div><span>🛡 갑옷</span><span>${I.gear.armor[0]}</span></div>
      <div><span>🏆 결투 승</span><span>${I.rec.wins}</span></div><div><span>🏰 수성 승리</span><span>${I.rec.sieges}</span></div>
      <div><span>🗺 원정 성공</span><span>${I.rec.adv}</span></div><div><span>🐫 교역</span><span>${I.rec.trades}</span></div>
      <div><span>🏗 건설</span><span>${I.rec.built}</span></div><div><span>📜 해방시킨 사람</span><span>${I.rec.freed || 0}</span></div></div>
    <p class="note">판정은 등급 기준선에서 50%, 1점마다 ±1.5%. 등급: ${D.grades.map(g => `${g[0]} ${g[1]}`).join(' · ')}. 수명: ${I.life.old}살부터 늙고 ~${I.life.max}살.</p>`);
}
function mTax(I) {
  const t = I.realm.tax;
  box(`${head('📜 세율 <small class="dim" style="font-size:13px">행동 안 씀</small>')}
    <div class="choices">${[['낮게', '세금 줄어듦 · 민심이 서서히 오름'], ['보통', '균형'], ['높게', '세금 많이 · 민심이 서서히 떨어짐']].map(([n, d], i) => `<button class="b ${t === i ? 'on' : ''}" data-tax="${i}"><b>${n}</b> <span class="dim">— ${d}</span></button>`).join('')}</div>`);
}
function mMenu(I) {
  box(`${head('☰ 메뉴')}<div class="choices">
    <button class="b" data-modal="power">💠 강함</button>
    <button class="b" data-modal="stats">📊 능력치·기록</button>
    <button class="b" data-modal="people">👥 사람들</button>
    <button class="b" data-help>❔ 어떻게 하나요</button>
    <button class="b red" data-newlife>⚜ 새 인생 (지금 인생 지움)</button>
    <a class="b" href="index.html" style="text-decoration:none">← 현대 Llife로</a></div>
    ${I.sandbox ? `<p class="note">🎮 샌드박스${I.sandbox.noThreat ? ' · 위협 없음' : ''}${I.sandbox.noDeath ? ' · 죽지 않음' : ''}</p>` : ''}
    <div id="help" hidden><p class="note" style="font-size:13px;line-height:1.7">
      · 한 달에 행동 3번. 다 쓰면 ▶ 다음 달 → 월말 정산(세금·유지비·식량·민심·치안·인구).<br>
      · 강함: 오러(무력 30부터, 🧍 오러 수련)와 서클(✨ 마나 수련, 돌파에 마석)이 결투 기술이 된다.<br>
      · 💬 교류: 마을 나들이에서 사람을 만나고, 사람들에서 대화·선물·대련·데이트·고백·청혼. 밤 초대는 연인·배우자에게만, 상대가 거절할 수 있다.<br>
      · 🛡 용병 길드: 가명으로 등록, 의뢰로 공적을 쌓아 F→S.<br>
      · 👑 왕실에 공물·수성전 승리로 왕실 공헌을 쌓고 명성과 함께 작위를 올린다.<br>
      · 정찰병이 위협을 알리면 1~2달 안에 수성전. 원정은 칸을 하나씩. 다친 몸으로 지면 목숨이 위험.<br>
      · 선택지의 〔🎲 능력치 %〕는 성공 확률.</p></div>`);
}
function mEnding(S) {
  const E = S.ended, I = R.info();
  box(`${head(E.kind === 'exile' ? '🏚 추방' : '🕯 한 생의 끝', false)}
    <div class="power-top"><div class="pf big">${mePF(88, I)}</div><div class="story" style="margin:0">${esc(E.text)}</div></div>
    <div class="kv"><div><span>나이</span><span>${E.age}살</span></div><div><span>다스린 해</span><span>${E.years}년</span></div>
      <div><span>작위</span><span>${I.peer.name}</span></div><div><span>강함</span><span>${I.mightGrade.id} ${I.mightGrade.name}</span></div>
      <div><span>명성</span><span>${num(E.fame)}</span></div><div><span>남은 인구</span><span>${num(E.realm.pop)}</span></div>
      <div><span>결투 승</span><span>${E.rec.wins}</span></div><div><span>수성 승리</span><span>${E.rec.sieges}</span></div>
      <div><span>오러</span><span>${I.aura.name}</span></div><div><span>서클</span><span>${I.circle.lv ? I.circle.name : '-'}</span></div>
      <div><span>용병</span><span>${I.merc ? I.merc.grade.name : '-'}</span></div><div><span>후계자</span><span>${E.heirs}명</span></div></div>
    <p class="story" style="font-size:14px">${E.fame >= 300 ? '음유시인들이 그대의 이름을 노래한다. 전설의 영주.' : E.fame >= 120 ? '왕국 사람들이 그대의 이름을 기억한다.' : E.fame >= 40 ? '영지 사람들은 좋은 영주로 기억할 것이다.' : '역사는 그대를 오래 기억하지 않을 것이다.'}</p>
    <button class="b gold wide" data-newlife>⚜ 새 인생</button>`);
}

/* ═════ 입력 ═════ */
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-close]');
  if (!t || t.disabled || !R.state() || t.closest('#start')) return;
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
  // 사람 · 마을 · 길드 · 노예시장 · 법령
  if (d.person) { ui.pid = d.person; ui.flash = ''; ui.modal = 'person'; return render(); }
  if (d.pact) { const msg = L().act(ui.pid, d.pact); ui.flash = typeof msg === 'string' ? msg : ''; return render(); }
  if (d.town) { if (L().town(d.town)) ui.modal = 'scene'; return render(); }
  if ('greg' in d) { L().guildRegister(); return render(); }
  if (d.quest != null) { L().takeQuest(+d.quest); return render(); }
  if ('gtest' in d) { L().promoteTest(); return render(); }
  if ('port' in d) { L().visitPort(); return render(); }
  if (d.free != null) { L().freeSlave(+d.free); return render(); }
  if (d.law) { L().passLaw(d.law); return render(); }
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
