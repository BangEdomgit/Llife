// Llife: 영지 — 엔진 (중세 판타지 모드). 화면은 js/realm-ui.js, 데이터는 data/realm.js · data/realm-events.js
//   흐름: 유년기 이야기(6·9·12·14살) → 15살 봄, 왕의 전쟁에 소집된 아버지 대신 영지를 맡음 → 한 달 = 행동 3번 + 월말 정산
//   월말: 상단 귀환 → 생산·세금·유지비·식량 → 민심·치안·인구 → 위협(정찰 → 도착하면 수성전) → 나이·부상 → 사건 하나
//   전투(결투·모험·수성 출격)는 같은 턴제 결투, 모험은 칸을 하나씩 나아감, 수성전은 3라운드 공방
(() => {
const D = window.REALM, KEY = 'llife-realm-v1';
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const randf = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const val = v => Array.isArray(v) ? rand(v[0], v[1]) : (v || 0);
const probRound = v => { const f = Math.floor(v); return f + (Math.random() < v - f ? 1 : 0); };
const weighted = (list, w) => { const tot = list.reduce((t, x) => t + w(x), 0); let r = Math.random() * tot; return list.find(x => (r -= w(x)) < 0) || list[0]; };
const josa = (w, j) => { const c = w.charCodeAt(w.length - 1) - 0xac00, has = c >= 0 && c <= 11171 && c % 28 > 0 && !(j === '으로' && c % 28 === 8); const m = { 이: ['이', '가'], 을: ['을', '를'], 은: ['은', '는'], 와: ['과', '와'], 으로: ['으로', '로'] }[j]; return w + (m ? (has ? m[0] : m[1]) : j); };
const SEASON = m => m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
const SEASON_KO = { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' };
const STATS = Object.keys(D.stats);
const LAND = () => D.lands.find(l => l.id === S.land) || D.lands[0];
const gradeOf = v => { let g = D.grades[0][0]; for (const [l, m] of D.grades) if (v >= m) g = l; return g; };
const gradeMin = l => (D.grades.find(g => g[0] === l) || D.grades[0])[1];
const WEAPONS = [['나무 검', 0], ['강철 검', 3], ['기사의 장검', 6], ['명검', 10], ['룬 검', 15]];
const ARMORS = [['가죽 갑옷', 0], ['사슬 갑옷', 2], ['판금 흉갑', 4], ['판금 갑옷', 7], ['미스릴 갑옷', 10]];
const GEAR_COST = [null, { gold: 40, iron: 2 }, { gold: 90, iron: 4 }, { gold: 180, iron: 8 }, { gold: 360, iron: 12, mana: 2 }];
const AP_MAX = 3;
// 확장(js/realm-life.js)이 끼어드는 자리: 달마다 · 새 인생 · 본편 시작 · 불러오기 · 결투 종류별 결과 · 화면 정보
const HOOK = { month: [], newGame: [], begin: [], load: [], fight: {}, info: [] };
const RACE = () => D.races[S.race] || D.races.human;
const PEER = () => D.peerage[S.peer ?? 1] || D.peerage[1];
const SIZE = () => PEER().size;
const AURA = () => D.aura[S.aura ? S.aura.lv : 0];
const CIRCLE = () => (S.circle ? S.circle.lv : 0);

let S = null, listeners = [];
const emit = () => { save(); listeners.forEach(f => f()); };
function save() { if (!S) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 */ } }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (!s || s.v !== 1) return null; migrate(s); HOOK.load.forEach(f => f(s)); return s; } catch (e) { return null; } }
function migrate(s) {
  s.race = s.race || 'human'; if (s.peer == null) s.peer = 1; if (s.favor == null) s.favor = 0;
  s.aura = s.aura || { lv: 0, xp: 0 }; s.circle = s.circle || { lv: 0, xp: 0 }; s.party = s.party || []; s.laws = s.laws || {};
  s.seed = s.seed || ('me' + Math.floor(Math.random() * 1e9));
}
const log = (text, cls = '') => { S.log.push({ n: S.log.length, text, cls }); if (S.log.length > 400) S.log.splice(0, S.log.length - 400); };
const fmtD = d => Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${LABEL[k] || k} ${v > 0 ? '+' : ''}${Math.round(v)}`).join(' · ');
const LABEL = Object.assign({}, D.stats, { gold: '💰', food: '🌾', morale: '민심', order: '치안', pop: '인구', wall: '성벽', levy: '징집병', men: '상비병', knights: '기사', fame: '명성', hp: '체력' });

/* ═════ 새 인생 ═════ */
function newGame(o) {
  const g = o.gender === 'f' ? 'f' : 'm', land = D.lands.find(l => l.id === o.land) || D.lands[0];
  const race = D.races[o.race] ? o.race : 'human', peer = o.peer != null ? clamp(o.peer, 0, D.peerage.length - 1) : 1, size = D.peerage[peer].size;
  const nameOf = gg => (race !== 'human' && D.raceNames[race] ? pick(D.raceNames[race][gg]) : pick(D.names[gg]));
  S = { v: 1, name: o.name || nameOf(g), gender: g, race, beast: race === 'beast' ? (o.beast || 'wolf') : null, peer, favor: 0, seed: o.seed || ('me' + Math.floor(Math.random() * 1e9)),
    aura: { lv: 0, xp: 0 }, circle: { lv: 0, xp: 0 }, party: [], laws: {}, start: o.start || 'child', sandbox: o.start === 'sandbox' ? Object.assign({ noThreat: false, noDeath: false }, o.sandboxOpts || {}) : null, house: o.house || '그레이몬트', crest: o.crest || { color: pick(D.crestColors), sym: pick(D.crestSyms) }, land: land.id,
    age: 6, stage: 'child', childIdx: 0, year: 806, month: 3, monthN: 0, title: '영주의 자식',
    stats: { might: 8, agility: 8, vigor: 10, command: 6, stewardship: 6, charm: 8, lore: 8, arcana: 3 }, hp: 50, fame: 0, injury: 0,
    realm: JSON.parse(JSON.stringify(Object.assign({}, land.start, { b: land.b, tax: 1, drill: 20 }))),
    inv: Object.fromEntries(D.goods.map(x => [x.id, 0])), prices: {}, caravan: null, gear: { weapon: 1, armor: 0 }, potions: 2,
    threat: null, people: [], spouse: null, children: [], fatherAway: true, flags: {}, done: {}, lastProposal: -99, prop: null,
    ap: 0, log: [], pending: [], combat: null, adv: null, siege: null, ended: null, rec: { wins: 0, losses: 0, sieges: 0, raids: 0, trades: 0, adv: 0, built: 0 } };
  for (const [k, v] of Object.entries(land.bonus || {})) S.stats[k] += v;
  // 종족 능력치 (수인은 갈래 보너스도)
  const RC = D.races[race];
  for (const [k, v] of Object.entries(RC.bonus || {})) S.stats[k] = clamp(S.stats[k] + v, 0, 100);
  if (RC.subs && RC.subs[S.beast]) for (const [k, v] of Object.entries(RC.subs[S.beast].bonus || {})) S.stats[k] = clamp(S.stats[k] + v, 0, 100);
  // 작위가 클수록 영지도 큼
  if (size !== 1) { const R = S.realm; for (const k of ['pop', 'food', 'gold']) R[k] = Math.round(R[k] * size); for (const k of ['levy', 'men', 'knights']) R.troops[k] = Math.round(R.troops[k] * size); }
  if (o.trait === 'strong') { S.stats.might += 5; S.stats.vigor += 3; } else if (o.trait === 'wise') { S.stats.lore += 5; S.stats.stewardship += 3; } else if (o.trait === 'fair') { S.stats.charm += 5; S.stats.command += 3; } else if (o.trait === 'gifted') { S.stats.arcana += 8; S.flags.mage = true; }
  const fam = g === 'm' ? 'f' : 'm';
  // 가족은 나와 같은 종족 (오래 사는 종족은 나이도 많음)
  const ak = RC.life.max / 78;
  addPerson({ role: 'father', name: o.father || nameOf('m'), gender: 'm', age: Math.round(41 * ak), race, beast: S.beast });
  addPerson({ role: 'mother', name: nameOf('f'), gender: 'f', age: Math.round(38 * ak), race, beast: S.beast });
  addPerson({ role: 'sibling', name: nameOf(fam), gender: fam, age: 4, race, beast: S.beast });
  addPerson({ role: 'steward', name: pick(D.names.m), gender: 'm', age: 58 });
  addPerson({ role: 'captain', name: pick(D.names.m), gender: 'm', age: 47 });
  rollPrices(true);
  log(`${S.house} 가문의 ${josa(S.name, '이')} ${LAND().name}의 성에서 태어났다.${race !== 'human' ? ` ${RC.name}${S.beast ? `(${RC.subs[S.beast].name})` : ''} 가문이다.` : ''}`, 'mem');
  S.hp = hpMax();
  HOOK.newGame.forEach(f => f(o));
  if (S.start === 'q20' || S.start === 'sandbox') quickStart(o);
  else pushChild();
  emit();
}
// 20살 시작 · 샌드박스: 유년기를 건너뜀. q20은 고른 길(path)대로 능력치를 받고, 샌드박스는 고른 값 그대로
const PATHS = {
  knight: { fx: { might: 18, vigor: 12, agility: 8, command: 8 }, aura: 34, text: '기사단장 밑에서 검을 익히며 자랐다.' },
  mage:   { fx: { arcana: 20, lore: 16, agility: 4 }, circle: 1, text: '탑에서 온 스승에게 마법을 배웠다.', flag: 'mage' },
  ruler:  { fx: { stewardship: 18, command: 12, lore: 8, charm: 6 }, text: '아버지 곁에서 영지를 다스리는 법을 배웠다.' },
  social: { fx: { charm: 18, command: 8, agility: 6, lore: 6 }, text: '왕도의 연회장을 누비며 사람을 얻는 법을 배웠다.' },
};
function quickStart(o) {
  S.childIdx = D.childhood.length; S.pending = [];
  if (S.start === 'sandbox') {
    const sb = o.sandboxOpts || {};
    if (sb.stats) for (const k of STATS) if (sb.stats[k] != null) S.stats[k] = clamp(+sb.stats[k], 0, 100);
    if (sb.aura) S.aura = { lv: clamp(+sb.aura, 0, 6), xp: 0 };
    if (sb.circle) { S.circle = { lv: clamp(+sb.circle, 0, 9), xp: 0 }; S.flags.mage = true; }
    if (S.aura.lv) S.aura.xp = D.aura[S.aura.lv].need;
    if (S.circle.lv) S.circle.xp = D.circles[S.circle.lv].need;
    if (sb.gold != null) S.realm.gold = Math.max(0, +sb.gold);
    if (sb.fame != null) S.fame = Math.max(0, +sb.fame);
    if (sb.merc != null && sb.merc >= 0) S.mercInit = +sb.merc;
    if (sb.troops) for (const k of ['levy', 'men', 'knights']) S.realm.troops[k] = Math.round(S.realm.troops[k] * +sb.troops);
  } else {
    const P = PATHS[o.path] || PATHS.knight;
    gainStats(P.fx, 1);
    if (P.aura) S.aura.xp = P.aura;
    if (P.circle) { S.circle = { lv: 1, xp: D.circles[1].need }; }
    if (P.flag) S.flags[P.flag] = true;
    log(P.text);
  }
  beginMain(20);
}
let pid = 0;
function addPerson(p) { const id = 'p' + (S.people.length + 1) + '_' + (pid++); S.people.push(Object.assign({ id, alive: true }, p)); return S.people[S.people.length - 1]; }
const person = role => S.people.find(p => p.role === role && p.alive);
const hpMax = () => { const L = RACE().life, o = L.old - 13; return Math.max(20, Math.round(40 + S.stats.vigor * 1.1 + Math.min(10, S.fame / 20) + (S.aura ? S.aura.lv * 4 : 0) - (S.age > o ? (S.age - o) * .8 * 78 / L.max : 0))); };

/* ═════ 유년기 ═════ */
function pushChild() {
  const c = D.childhood[S.childIdx];
  if (!c) return beginMain();
  const d = c.age - S.age;
  if (d > 0) S.people.forEach(p => { p.age += d; });   // 유년기 장면 사이에 가족도 함께 나이 먹음
  S.age = c.age;
  S.pending = [{ child: S.childIdx, text: c.text }];
}
function childChoose(i) {
  const c = D.childhood[S.childIdx], ch = c && c.choices[i];
  if (!ch) return;
  log(`▸ ${ch.label}`, 'pick');
  gainStats(ch.fx, 1);
  if (ch.flag) S.flags[ch.flag] = true;
  if (ch.morale) S.realm.morale = clamp(S.realm.morale + ch.morale, 0, 100);
  if (ch.gold) S.realm.gold += ch.gold;
  if (ch.wall) S.realm.wall += ch.wall;
  log(ch.text);
  S.childIdx++; S.pending = [];
  pushChild();
  emit();
}
function beginMain(age = 15) {
  const grow = age - S.age;
  S.stage = 'main'; S.age = age; S.year = 800 + age; S.month = 3; S.monthN = 0;
  S.people.forEach(p => { p.age += grow; });
  const f = person('father');
  log(`— ${S.year}년 봄 —`, 'year');
  if (age >= 20) {
    // 20살 시작: 아버지는 이미 전쟁에서 다쳐 물러났고, 나는 기사 서임을 받은 영주
    S.title = '영주'; S.fatherAway = false; f.retired = true;
    S.done.letter1 = S.done.knighting = S.done.fatherFate = 1;
    log(`스무 살 봄. 전쟁에서 다리를 다친 아버지 ${josa(f.name, '이')} 물러나고, 내가 ${LAND().name}의 영주가 되었다. ${PEER().name}의 작위를 이었다.`, 'mem');
  } else {
    S.title = '영주 대리';
    log(`열다섯 살 봄. 왕의 소집령이 내려와 아버지 ${josa(f.name, '이')} 기사들을 이끌고 남쪽 전쟁터로 떠났다. "내가 돌아올 때까지 영지는 네 것이다." 오늘부터 ${LAND().name}의 주인 노릇을 해야 한다.`, 'mem');
  }
  log('💡 한 달에 행동 3번. 영지를 돌보고, 수련하고, 원정이나 무역도 할 수 있다. 다 쓰면 ▶ 다음 달.', 'info');
  HOOK.begin.forEach(fn => fn());
  S.hp = hpMax();
  S.ap = AP_MAX;
}

/* ═════ 능력치 ═════ */
// 오를수록 덜 오름 (90이면 거의 안 오름)
function gainStats(fx, k = 1) {
  const out = {};
  for (const [s, v0] of Object.entries(fx || {})) {
    if (!(s in S.stats)) continue;
    let v = val(v0) * k;
    if (v > 0) v = probRound(v * RACE().grow * Math.max(.15, 1 - S.stats[s] / 115));
    const b = S.stats[s];
    S.stats[s] = clamp(b + v, 0, 100);
    if (S.stats[s] !== b) out[s] = S.stats[s] - b;
  }
  return out;
}
function realmDelta(d) {
  const R = S.realm, out = {};
  for (const [k, v0] of Object.entries(d || {})) {
    const v = val(v0);
    if (!v) continue;
    if (['levy', 'men', 'knights'].includes(k)) { const b = R.troops[k]; R.troops[k] = Math.max(0, b + v); out[k] = R.troops[k] - b; continue; }
    if (k === 'morale' || k === 'order') { const b = R[k]; R[k] = clamp(b + v, 0, 100); out[k] = R[k] - b; continue; }
    if (k === 'wall') { const b = R.wall; R.wall = clamp(b + v, 0, wallMax()); out.wall = R.wall - b; continue; }
    const b = R[k] || 0; R[k] = Math.max(0, b + v); out[k] = R[k] - b;
  }
  return out;
}
const wallMax = () => 40 + S.realm.b.wall * 40;
const troopPower = () => { const t = S.realm.troops; return t.levy * D.troops.levy.power + t.men * D.troops.men.power + t.knights * D.troops.knights.power; };
const troopCap = () => ({ men: Math.round((30 + S.realm.b.barracks * 30) * SIZE()), knights: Math.round((2 + S.realm.b.barracks * 3) * SIZE()) });
const defense = () => Math.round((troopPower() + (S.flags.allyHarth ? 60 : 0)) * (1 + S.stats.command / 200) * (1 + S.realm.drill / 300) * (S.realm.wall > 0 ? 1 + S.realm.b.wall * .12 : 1));
// 인구 상한 (땅이 먹여 살릴 수 있는 만큼): 농지·시장·신전이 늘려 줌
const popCap = () => Math.round(LAND().start.pop * SIZE() * (1.15 + S.realm.b.farm * .12 + S.realm.b.market * .06 + S.realm.b.temple * .04));

// 판정 (check: { stat, g }): 기준 등급 문턱이면 50%, 1점마다 1.5%p, 5~95%
const checkPct = c => clamp(Math.round(50 + (S.stats[c.stat] - gradeMin(c.g)) * 1.5 - (S.injury ? 8 : 0)), 5, 95);

/* ═════ 결과 적용 (사건·모험 공통) ═════ */
function apply(o) {
  if (!o) return;
  const parts = [];
  const st = gainStats(o.fx);
  const rd = realmDelta(o.realm);
  if (o.fame) { S.fame = Math.max(0, S.fame + val(o.fame)); parts.push(`명성 ${o.fame > 0 ? '+' : ''}${val(o.fame)}`); }
  if (o.hp) { const b = S.hp; S.hp = clamp(S.hp + val(o.hp), 1, hpMax()); if (S.hp !== b) parts.push(`체력 ${S.hp - b}`); }
  if (o.goods) for (const [g, n] of Object.entries(o.goods)) { S.inv[g] = (S.inv[g] || 0) + val(n); parts.push(`${goodName(g)} +${val(n)}`); }
  if (o.flag) S.flags[o.flag] = true;
  if (o.do) o.do(S, API);
  const txt = typeof o.text === 'function' ? o.text(S, API) : o.text;
  const ds = [fmtD(st), fmtD(rd), parts.join(' · ')].filter(Boolean).join(' · ');
  if (txt || ds) log((txt || '') + (ds ? ` (${ds})` : ''));
  if (o.fight) startFight(o.fight, { win: o.win, lose: o.lose, kind: 'event' });
}
const goodName = id => (D.goods.find(g => g.id === id) || {}).name || id;

/* ═════ 사건 ═════ */
const evText = ev => typeof ev.text === 'function' ? ev.text(S, API) : ev.text;
const choicesOf = ev => ev.choices.filter(c => !c.when || c.when(S, API));
const choiceLabel = c => c.label + (c.check ? ` 〔🎲 ${D.stats[c.check.stat]} ${checkPct(c.check)}%〕` : '') + (c.fight ? ` 〔⚔️ ${josa(D.foes[c.fight].name, '와')} 결투〕` : '');
function eligible(ev) {
  if (ev.once && S.done[ev.id]) return false;
  if (ev.when && !ev.when(S, API)) return false;
  return true;
}
function fireEvent(ev) {
  S.done[ev.id] = (S.done[ev.id] || 0) + 1;
  const text = evText(ev);
  S.pending.push({ id: ev.id, text });
  log(text, 'ask');
}
function monthEvent() {
  const story = D.events.filter(e => e.story && eligible(e));
  if (story.length) { fireEvent(story[0]); return; }
  if (Math.random() < .62) {
    const pool = D.events.filter(e => !e.story && !e.place && eligible(e));
    if (pool.length) { fireEvent(weighted(pool, e => e.weight ?? 1)); return; }
  }
  log(pick(D.quiet[SEASON(S.month)]), 'info');
}
function currentEvent() {
  const p = S.pending[0];
  if (!p) return null;
  if (p.child != null) { const c = D.childhood[p.child]; return { text: p.text, choices: c.choices.map(x => x.label), child: true }; }
  if (p.siegeAsk) return { text: p.text, choices: p.choices };
  const ev = D.events.find(e => e.id === p.id);
  if (!ev) { S.pending.shift(); return currentEvent(); }
  return { text: p.text, choices: choicesOf(ev).map(choiceLabel) };
}
function choose(i) {
  const p = S.pending[0];
  if (!p || S.combat || S.ended) return;
  if (p.child != null) return childChoose(i);
  if (p.siegeAsk) { S.pending.shift(); log(`▸ ${p.choices[i]}`, 'pick'); siegeAnswer(p, i); emit(); return; }
  const ev = D.events.find(e => e.id === p.id), ch = ev && choicesOf(ev)[i];
  if (!ch) return;
  S.pending.shift();
  log(`▸ ${ch.label}`, 'pick');
  if (ch.check) {
    const pc = checkPct(ch.check), ok = rand(1, 100) <= pc;
    log(`🎲 ${D.stats[ch.check.stat]} 판정 ${pc}% → ${ok ? '성공' : '실패'}`, 'info');
    apply(ok ? ch.ok : ch.no);
  } else apply(ch);
  emit();
}

/* ═════ 오러 · 서클 돌파 ═════ */
// 수련치가 다음 단계에 닿으면 돌파 판정. 실패하면 벽에 부딪혀 수련치가 조금 깎임
const breakPct = (stat, g) => clamp(Math.round(50 + (stat - gradeMin(g)) * 1.5), 5, 95);
function auraBreak() {
  const A = S.aura, N = D.aura[A.lv + 1];
  if (!N || A.xp < N.need) return;
  if (N.insight && S.rec.wins < (A.lv + 1 === 5 ? 40 : 100)) { A.xp = N.need; log(`🧘 오러가 벽 앞에서 멈췄다. 더 많은 실전이 필요하다. (결투 승리 ${S.rec.wins}/${A.lv + 1 === 5 ? 40 : 100})`, 'info'); return; }
  const pc = breakPct((S.stats.might + S.stats.vigor) / 2, N.check);
  if (rand(1, 100) <= pc) { A.lv++; S.fame += A.lv * 4; log(`🗡✨ 돌파! ${N.name}의 경지에 올랐다. ${N.desc} (🎲 ${pc}% · 명성 +${A.lv * 4})`, 'mem'); }
  else { A.xp = Math.round(N.need * .85); log(`🗡 ${N.name}의 벽에 부딪혔다. 오러가 흩어졌다. (🎲 ${pc}% 실패)`, 'info'); }
}
function circleBreak() {
  const C = S.circle, N = D.circles[C.lv + 1];
  if (!N || C.xp < N.need) return;
  if ((S.inv.mana || 0) < N.stones) { C.xp = N.need; log(`💎 ${N.name}에 오르려면 마석 ${N.stones}개가 필요하다. (가진 마석 ${S.inv.mana || 0})`, 'info'); return; }
  const pc = breakPct((S.stats.arcana + S.stats.lore) / 2, N.check);
  S.inv.mana -= N.stones;
  if (rand(1, 100) <= pc) { C.lv++; S.flags.mage = true; S.fame += C.lv * 3; log(`✨ 심장에 ${N.name}가 새겨졌다! 이제 ${N.title}다. 새 주문: ${D.spells.filter(x => x.circle === C.lv).map(x => x.icon + x.name).join(', ') || '없음'} (🎲 ${pc}% · 명성 +${C.lv * 3})`, 'mem'); }
  else { C.xp = Math.round(N.need * .85); log(`✨ ${N.name} 돌파 실패. 마석 ${N.stones}개가 가루가 되었다. (🎲 ${pc}% 실패)`, 'info'); }
}

/* ═════ 행동 (한 달에 3번) ═════ */
const ACTIONS = [
  { id: 'train', group: 'self', icon: '⚔️', label: '검술 훈련', desc: '무력·체력', run: () => { const d = gainStats({ might: [2, 4], vigor: [0, 2] }); log(`${pick(['기사단장과 목검을 맞댔다.', '허수아비를 수백 번 베었다.', '갑옷을 입은 채 성벽을 뛰어올랐다.'])} (${fmtD(d) || '제자리걸음'})`); } },
  { id: 'ride', group: 'self', icon: '🏹', label: '승마·활쏘기', desc: '민첩·통솔', run: () => { const d = gainStats({ agility: [2, 4], command: [0, 1] }); log(`${pick(['말을 타고 과녁을 맞혔다.', '들판을 질주하며 활을 쐈다.', '기병들과 대형 연습을 했다.'])} (${fmtD(d) || '제자리걸음'})`); } },
  { id: 'study', group: 'self', icon: '📚', label: '서고에서 공부', desc: '학식·정무', run: () => { const d = gainStats({ lore: [2, 4], stewardship: [1, 2] }); log(`${pick(['낡은 연대기를 읽었다.', '집사와 장부를 맞췄다.', '왕국 법전을 베껴 썼다.'])} (${fmtD(d) || '제자리걸음'})`); } },
  { id: 'aura', group: 'self', icon: '🗡', label: '오러 수련', desc: '검에 오러를 맺는다 (무력 30부터)', if: () => S.aura.lv > 0 || S.stats.might >= 30,
    run: () => { const d = gainStats({ might: [0, 2], vigor: [0, 1] }); const x = Math.round((4 + S.stats.might / 11 + S.stats.vigor / 22) * RACE().aura * (1 - S.aura.lv * .07) * randf(.8, 1.2)); S.aura.xp += x;
      log(`${pick(['단전에 기를 모으며 검을 쥐었다.', '폭포 아래에서 검을 휘둘렀다.', '눈을 감고 검끝의 떨림을 느꼈다.'])} (오러 +${x}${fmtD(d) ? ' · ' + fmtD(d) : ''})`); auraBreak(); } },
  { id: 'magic', group: 'self', icon: '✨', label: '마나 수련', desc: '서클을 쌓는다 (학식이 받쳐 줘야)', if: () => S.flags.mage || CIRCLE() > 0 || S.stats.arcana >= 12 || S.stats.lore >= 35,
    run: () => { const d = gainStats({ arcana: [1, 3], lore: [0, 1] }); const x = Math.round((4 + S.stats.arcana / 10 + S.stats.lore / 20) * RACE().magic * (1 - CIRCLE() * .05) * randf(.8, 1.2)); S.circle.xp += x;
      if (Math.random() < .08) { S.hp = Math.max(1, S.hp - 8); log(`마나가 역류해 손끝이 데었다. (마나 +${x}${fmtD(d) ? ' · ' + fmtD(d) : ''} · 체력 -8)`); }
      else log(`${pick(['마석을 쥐고 명상했다.', '심장 둘레로 마나를 돌렸다.', '룬 문자를 허공에 새겼다.'])} (마나 +${x}${fmtD(d) ? ' · ' + fmtD(d) : ''})`); circleBreak(); } },
  { id: 'feast', group: 'self', icon: '🍷', label: '연회 열기', desc: '화술·민심·명성 (금화 25)', cost: 25, run: () => { const d = gainStats({ charm: [2, 3] }); realmDelta({ morale: 3 }); S.fame += 1; log(`가신과 마을 유지들을 불러 잔치를 열었다. (${fmtD(d)} · 민심 +3 · 명성 +1)`); } },
  { id: 'rest', group: 'self', icon: '🛏', label: '휴식', desc: '체력 회복', run: () => { const b = S.hp; S.hp = Math.min(hpMax(), S.hp + Math.round(hpMax() * .45)); if (S.injury) S.injury = Math.max(0, S.injury - 1); log(`성에서 푹 쉬었다. (체력 +${S.hp - b})`); } },
  { id: 'build', group: 'realm', icon: '🏗', label: '건설', desc: '건물 올리기', modal: 'build' },
  { id: 'recruit', group: 'realm', icon: '🛡', label: '징병·모집', desc: '병력 늘리기', modal: 'recruit' },
  { id: 'drill', group: 'realm', icon: '🚩', label: '병사 훈련', desc: '훈련도·통솔', run: () => { const b = S.realm.drill; S.realm.drill = clamp(S.realm.drill + 8 + S.realm.b.barracks * 2, 0, 100); const d = gainStats({ command: [1, 3] }); log(`병사들을 이끌고 진형 훈련을 했다. (훈련도 ${b} → ${S.realm.drill}${fmtD(d) ? ' · ' + fmtD(d) : ''})`); } },
  { id: 'patrol', group: 'realm', icon: '🐎', label: '영지 순찰', desc: '치안 + (산적과 마주칠 수도)', run: () => { const d = realmDelta({ order: [5, 9] }); if (Math.random() < .3) { log(`순찰 중 길목을 막은 산적과 마주쳤다! (치안 +${d.order || 0})`); startFight('bandit', { kind: 'event', win: { text: '산적을 쓰러뜨렸다. 마을 사람들이 고마워했다.', realm: { order: 4 }, fame: 2 }, lose: { text: '산적이 달아났다.', realm: { order: -3 } } }); } else log(`${pick(['마을을 돌며 촌장들을 만났다.', '국경 초소를 점검했다.', '다리를 고치게 했다.'])} (치안 +${d.order || 0})`); } },
  { id: 'court', group: 'realm', icon: '⚖️', label: '청원 듣기', desc: '사건 하나를 바로', run: () => { const pool = D.events.filter(e => !e.story && !e.place && eligible(e) && e.id !== 'proposal' && e.id !== 'heir'); if (pool.length) fireEvent(weighted(pool, e => e.weight ?? 1)); else log('오늘은 청원이 없었다.'); } },
  { id: 'adventure', group: 'adv', icon: '🗺', label: '원정 떠나기', desc: '이번 달 행동을 모두 씀', modal: 'adventure', if: () => S.age >= 15 },
  { id: 'market', group: 'trade', icon: '🏪', label: '시장', desc: '사고팔기 (행동 안 씀)', modal: 'market', free: true },
  { id: 'caravan', group: 'trade', icon: '🐫', label: '상단 보내기', desc: '다른 도시로 (한 달)', modal: 'caravan', if: () => !S.caravan },
  { id: 'smith', group: 'self', icon: '⚒', label: '대장간·장비', desc: '무기·갑옷·물약 (행동 안 씀)', modal: 'smith', free: true },
];
const busy = () => !!(S.pending.length || S.combat || S.adv || S.siege || S.ended);
function actionList() {
  return ACTIONS.filter(a => !a.if || a.if()).map(a => ({ id: a.id, group: a.group, icon: a.icon, label: a.label, desc: a.desc, modal: a.modal, free: !!a.free,
    ok: !busy() && (a.free || S.ap > 0) && (!a.cost || S.realm.gold >= a.cost) }));
}
function doAction(id) {
  const a = ACTIONS.find(x => x.id === id);
  if (!a || busy() || (!a.free && S.ap <= 0) || (a.cost && S.realm.gold < a.cost)) return false;
  if (a.modal) return a.modal;
  if (a.cost) S.realm.gold -= a.cost;
  S.ap--;
  a.run();
  emit();
  return true;
}
// 건설: 행동 1 + 금화
function buildCost(b) { const lv = S.realm.b[b] || 0; return lv >= 5 ? null : D.buildings[b].base * (lv + 1); }
function build(b) {
  const c = buildCost(b);
  if (c == null || busy() || S.ap <= 0 || S.realm.gold < c) return false;
  S.realm.gold -= c; S.ap--; S.realm.b[b]++; S.rec.built++;
  if (b === 'wall') S.realm.wall = Math.min(wallMax(), S.realm.wall + 40);
  log(`🏗 ${D.buildings[b].icon} ${D.buildings[b].name} ${S.realm.b[b]}단계 완공! (💰 -${c})`, 'mem');
  emit(); return true;
}
// 징병·모집: 행동 1. 징집병은 인구에서, 상비병·기사는 병영 한도까지
function recruit(type, n) {
  const T = D.troops[type], cap = troopCap(), R = S.realm;
  if (!T || busy() || S.ap <= 0 || n <= 0) return false;
  if (type !== 'levy' && R.troops[type] + n > cap[type]) return false;
  if (type === 'levy' && n > R.pop * .15 - R.troops.levy) return false;
  const cost = T.cost * n;
  if (R.gold < cost) return false;
  R.gold -= cost; R.troops[type] += n; S.ap--;
  if (type === 'levy') { R.pop -= Math.round(n * .5); R.morale = clamp(R.morale - Math.ceil(n / 15), 0, 100); }
  log(`${T.icon} ${T.name} ${n}명을 ${type === 'levy' ? '징집했다' : '모집했다'}. (💰 -${cost}${type === 'levy' ? ` · 민심 -${Math.ceil(n / 15)}` : ''})`);
  emit(); return true;
}
function setTax(t) { if (S.title !== '영주' && S.title !== '영주 대리') return; S.realm.tax = clamp(t, 0, 2); log(`세율을 ${['낮게', '보통으로', '높게'][S.realm.tax]} 정했다.`, 'info'); emit(); }

/* ═════ 장비 ═════ */
function gearInfo() {
  const nx = k => { const lv = S.gear[k] + 1; if (lv > 4) return null; const c = GEAR_COST[lv], need = Math.ceil(lv / 2); return { lv, name: (k === 'weapon' ? WEAPONS : ARMORS)[lv][0], cost: c, smithy: need, ok: S.realm.b.smithy >= need && S.realm.gold >= c.gold && (S.inv.iron || 0) >= c.iron && (!c.mana || (S.inv.mana || 0) >= c.mana) }; };
  return { weapon: WEAPONS[S.gear.weapon], armor: ARMORS[S.gear.armor], next: { weapon: nx('weapon'), armor: nx('armor') }, potions: S.potions, potionCost: 12, smithy: S.realm.b.smithy };
}
function upgrade(k) {
  const n = gearInfo().next[k];
  if (!n || !n.ok || busy()) return false;
  S.realm.gold -= n.cost.gold; S.inv.iron -= n.cost.iron; if (n.cost.mana) S.inv.mana -= n.cost.mana;
  S.gear[k] = n.lv;
  log(`⚒ 대장간에서 ${josa(n.name, '을')} 받았다.`, 'mem'); emit(); return true;
}
function buyPotion() { if (S.realm.gold < 12 || busy()) return false; S.realm.gold -= 12; S.potions++; log('🧪 치유 물약을 하나 샀다. (💰 -12)', 'info'); emit(); return true; }

/* ═════ 결투 (턴제) ═════ */
const compAtk = p => Math.round(4 + (p.might || 30) * .28 + (p.gear || 3) + (D.aura[p.aura || 0].atk || 0) + (p.circle ? p.circle * 2.5 : 0));
const myAtk = () => 4 + S.stats.might * .28 + WEAPONS[S.gear.weapon][1] + (AURA().atk || 0);
const myDef = () => 1 + S.stats.vigor * .06 + ARMORS[S.gear.armor][1] + (S.aura ? S.aura.lv * .8 : 0);
// 마나: 서클 × 2 + 마력 30마다 1
const mpMax = () => CIRCLE() ? CIRCLE() * 2 + Math.floor(S.stats.arcana / 30) : 0;
const spellsKnown = () => D.spells.filter(x => x.circle <= CIRCLE());
const spellDmg = x => x.dmg ? Math.round(x.dmg[0] + S.stats.arcana * x.dmg[1] * RACE().magic) : 0;
// 강함 (전투력): 무기·갑옷·체력·민첩 + 오러 + 가장 센 주문 → 강함 등급 (사람도 같은 식, js/realm-life.js)
function cpOf(o) {
  const A = D.aura[o.aura || 0], best = D.spells.filter(x => x.circle <= (o.circle || 0) && x.dmg).reduce((m, x) => Math.max(m, x.dmg[0] + o.arcana * x.dmg[1] * (o.magicK || 1)), 0);
  return Math.round(o.atk + o.def * 1.5 + o.hp / 4 + o.agility / 4 + (A.charges || 0) * (A.mult || 0) * 6 + (o.circle ? best * 1.2 + o.circle * 4 : 0));
}
const myCP = () => cpOf({ atk: myAtk(), def: myDef(), hp: hpMax(), agility: S.stats.agility, aura: S.aura.lv, circle: CIRCLE(), arcana: S.stats.arcana, magicK: RACE().magic });
const mightGrade = cp => { let g = D.might[0]; for (const m of D.might) if (cp >= m.min) g = m; return g; };
const foeAgi = f => f.spd * 4;
function startFight(id, ctx) {
  const F = D.foes[id], k = ctx.scale || (1 + Math.min(.8, S.monthN / 300));
  S.combat = { id, foe: { name: F.name, icon: F.icon, spec: F.spec, hp: Math.round(F.hp * k), hpMax: Math.round(F.hp * k), atk: F.atk * (.85 + k * .15), def: F.def, spd: F.spd, gold: F.gold },
    hp: S.hp, hpMax: hpMax(), mp: mpMax(), mpMax: mpMax(), auraN: AURA().charges || 0, guard: false, turn: 1, hurt: S.injury > 0, log: [`${F.icon} ${josa(F.name, '이')} 앞을 막아섰다!`], ctx, over: null,
    party: ['adv', 'quest'].includes(ctx.kind) ? (S.party || []).map(id => S.people.find(p => p.id === id && p.alive)).filter(Boolean).map(p => ({ id: p.id, name: p.name, atk: compAtk(p) })) : [] };
  emit();
}
function fightOdds() {
  const c = S.combat; if (!c) return null;
  const agi = S.stats.agility - (S.injury ? 8 : 0), fa = foeAgi(c.foe);
  return { hit: clamp(Math.round(72 + (agi - fa) * .6 + (c.guard ? 12 : 0)), 25, 95), power: clamp(Math.round(54 + (agi - fa) * .6), 15, 85), flee: clamp(Math.round(38 + (agi - fa) * .8), 10, 85),
    magic: c.mp > 0 ? 90 : 0, dmg: Math.round(myAtk() - c.foe.def), canFlee: c.ctx.kind !== 'siege' && c.ctx.kind !== 'duelOnly',
    aura: c.auraN > 0 ? { n: c.auraN, hit: clamp(Math.round(72 + (agi - fa) * .6 + 20), 40, 97), dmg: Math.round(myAtk() * AURA().mult - c.foe.def * .3), name: AURA().lv >= 5 ? '오러 블레이드' : '오러 베기' } : null,
    spells: spellsKnown().map(x => ({ id: x.id, name: x.name, icon: x.icon, mp: x.mp, ok: c.mp >= x.mp, dmg: spellDmg(x), heal: x.heal, stun: x.stun, shield: x.shield })) };
}
function fightAct(a) {
  const c = S.combat; if (!c || c.over) return;
  const o = fightOdds(), L = c.log, f = c.foe;
  let dmg = 0, foeTurn = true;
  c.guard = false;
  if (a === 'hit' || a === 'power') {
    const pc = a === 'hit' ? o.hit : o.power;
    if (rand(1, 100) <= pc) { dmg = Math.max(1, Math.round(myAtk() * randf(.85, 1.15) * (a === 'power' ? 1.7 : 1) - f.def)); f.hp -= dmg; L.push(`⚔️ ${a === 'power' ? '강타! ' : ''}${dmg}의 피해를 입혔다.`); }
    else L.push(a === 'power' ? '💨 크게 휘둘렀지만 빗나갔다.' : '💨 빗나갔다.');
  } else if (a === 'aura' && c.auraN > 0) {
    c.auraN--;
    if (rand(1, 100) <= o.aura.hit) { dmg = Math.max(1, Math.round(myAtk() * AURA().mult * randf(.95, 1.15) - f.def * .3)); f.hp -= dmg; L.push(`🗡✨ ${o.aura.name}! 빛나는 검이 ${dmg}의 피해를 입혔다. (남은 오러 ${c.auraN})`); }
    else L.push(`🗡✨ ${o.aura.name}가 아슬아슬하게 빗나갔다. (남은 오러 ${c.auraN})`);
  } else if (a.startsWith('spell:')) {
    const x = D.spells.find(z => z.id === a.slice(6));
    if (!x || x.circle > CIRCLE() || c.mp < x.mp) return;
    c.mp -= x.mp;
    if (x.heal) { const h = Math.round(c.hpMax * x.heal); c.hp = Math.min(c.hpMax, c.hp + h); L.push(`${x.icon} ${x.name}. 상처가 아물었다. (+${h}, 마나 ${c.mp})`); }
    else if (x.shield) { c.shield = x.shield; L.push(`${x.icon} ${x.name}! 푸른 막이 몸을 감쌌다. (마나 ${c.mp})`); }
    if (x.dmg) { dmg = Math.round(spellDmg(x) * randf(.9, 1.1)); f.hp -= dmg; L.push(`${x.icon} ${x.name}! ${dmg}의 피해. (마나 ${c.mp})`); }
    if (x.stun && f.hp > 0 && Math.random() < x.stun) { c.stun = true; L.push(`${f.icon} ${josa(f.name, '이')} 얼어붙어 움직이지 못한다!`); }
  } else if (a === 'guard') { c.guard = true; L.push('🛡 방패를 들고 자세를 낮췄다.'); }
  else if (a === 'potion' && S.potions > 0) { S.potions--; const h = Math.round(c.hpMax * .45); c.hp = Math.min(c.hpMax, c.hp + h); L.push(`🧪 물약을 마셨다. (+${h})`); }
  else if (a === 'flee' && o.canFlee) {
    if (rand(1, 100) <= o.flee) { L.push('🏃 몸을 빼 달아났다.'); return endFight('fled'); }
    L.push('🏃 달아나려다 막혔다!');
  } else return;
  // 동료의 지원 공격 (원정·의뢰)
  if (f.hp > 0) for (const m of c.party || []) if (Math.random() < .7) { const d = Math.max(1, Math.round(m.atk * randf(.7, 1.1) - f.def)); f.hp -= d; L.push(`🤝 ${m.name}의 지원 공격! ${d}의 피해.`); if (f.hp <= 0) break; }
  if (f.hp <= 0) return endFight('win');
  if (c.stun) { c.stun = false; L.push(`${f.icon} ${josa(f.name, '이')} 꼼짝 못 하는 사이 숨을 골랐다.`); foeTurn = false; }
  if (foeTurn) {
    // 적의 차례 (특기: 재생 · 흡혈 · 브레스)
    if (f.spec === 'regen') { const r = Math.round(f.hpMax * .05); f.hp = Math.min(f.hpMax, f.hp + r); L.push(`${f.icon} 상처가 꿈틀대며 아물었다. (+${r})`); }
    const breath = f.spec === 'breath' && c.turn % 3 === 0;
    const hit = breath ? 88 : clamp(Math.round(64 + (foeAgi(f) - S.stats.agility) * .6), 18, 92);
    if (rand(1, 100) <= hit) {
      let d = breath ? f.atk * 1.6 * randf(.9, 1.1) - myDef() * .4 : f.atk * randf(.85, 1.15) - myDef();
      if (c.guard) d *= breath ? .7 : .4;
      if (c.shield) { d *= 1 - c.shield; c.shield = 0; }
      d = Math.max(1, Math.round(d));
      c.hp -= d;
      L.push(breath ? `🔥 ${f.name}의 불길이 덮쳤다! ${d}의 피해.` : `${f.icon} ${f.name}의 공격! ${d}의 피해.${c.guard ? ' (막아 냄)' : ''}`);
      if (f.spec === 'drain') { const h = Math.round(d * .5); f.hp = Math.min(f.hpMax, f.hp + h); }
      if (c.guard && !breath && Math.random() < .35) { const r = Math.max(1, Math.round(myAtk() * .6 - f.def)); f.hp -= r; L.push(`↩️ 막고 되받아쳤다! ${r}의 피해.`); if (f.hp <= 0) return endFight('win'); }
    } else L.push(`${f.icon} ${f.name}의 공격을 피했다.`);
  }
  c.turn++;
  if (c.hp <= 0) return endFight('lose');
  if (L.length > 14) L.splice(0, L.length - 14);
  emit();
}
function endFight(res) {
  const c = S.combat;
  c.over = res;
  S.hp = Math.max(1, c.hp);
  if (res === 'win') {
    S.rec.wins++;
    const g = val(c.foe.gold); S.realm.gold += g;
    gainStats({ might: [0, 1], agility: [0, 1] });
    c.log.push(`🏆 ${josa(c.foe.name, '을')} 쓰러뜨렸다!${g ? ` (💰 +${g})` : ''}`);
  } else if (res === 'lose') {
    S.rec.losses++;
    S.injury = Math.max(S.injury, 2); S.hp = 1;
    // 목숨은 다친 몸으로 싸우다 질 때 위험함 (멀쩡하면 거의 살아남)
    const dc = S.sandbox && S.sandbox.noDeath ? 0 : (c.ctx.death ?? .03) * (c.hurt ? 3 : .2);
    if (Math.random() < dc) { c.log.push('💀 눈앞이 깜깜해졌다…'); c.dead = true; }
    else c.log.push('🩸 쓰러졌다. 부하들이 나를 끌어냈다. (부상 2달)');
  }
  emit();
}
// 결투 창을 닫으면 결과를 반영
function closeFight() {
  const c = S.combat; if (!c || !c.over) return;
  S.combat = null;
  log(c.log.slice(-2).join(' '), 'info');
  if (c.dead) return die(`${josa(c.foe.name, '와')}의 싸움에서 쓰러져 다시 일어나지 못했다.`);
  const ctx = c.ctx;
  if (HOOK.fight[ctx.kind]) HOOK.fight[ctx.kind](c.over, ctx);
  else if (ctx.kind === 'adv') advAfterFight(c.over);
  else if (ctx.kind === 'siege') siegeAfterSortie(c.over);
  else apply(c.over === 'win' ? ctx.win : c.over === 'lose' ? ctx.lose : { text: '싸움을 피해 물러났다.' });
  emit();
}

/* ═════ 모험 ═════ */
function startAdv(siteId) {
  const site = D.sites.find(x => x.id === siteId);
  if (!site || busy() || S.ap <= 0) return false;
  const path = [];
  for (let i = 0; i < site.nodes - 1; i++) path.push(weighted(['fight', 'trap', 'treasure', 'shrine', 'rest'], k => ({ fight: 4.5, trap: 1.5, treasure: 2, shrine: 1.2, rest: .8 })[k]));
  path.push(site.boss ? 'boss' : 'fight');
  S.adv = { site: site.id, i: 0, path, loot: { gold: 0, goods: {} }, msg: `${site.icon} ${josa(site.name, '으로')} 떠났다. 영지는 집사에게 맡겼다.`, done: false };
  S.ap = 0;
  log(S.adv.msg, 'mem');
  emit(); return true;
}
function advInfo() {
  const A = S.adv; if (!A) return null;
  const site = D.sites.find(x => x.id === A.site);
  return { site, i: A.i, n: A.path.length, path: A.path.map((k, j) => j < A.i ? k : j === A.i ? '?' : '·'), loot: A.loot, msg: A.msg, summary: A.summary, done: A.done, hp: S.hp, hpMax: hpMax(), potions: S.potions,
    trapPct: clamp(Math.round(50 + (S.stats.agility - gradeMin(['D', 'C', 'B', 'A'][site.tier - 1])) * 1.5), 5, 95) };
}
function advStep() {
  const A = S.adv; if (!A || A.done || S.combat) return;
  const site = D.sites.find(x => x.id === A.site), kind = A.path[A.i], scale = 1 + (site.tier - 1) * .25 + Math.min(.6, S.monthN / 360);
  if (kind === 'fight' || kind === 'boss') {
    const id = kind === 'boss' ? site.boss : pick(site.foes);
    A.msg = kind === 'boss' ? `${D.foes[id].icon} 둥지 깊은 곳에서 ${josa(D.foes[id].name, '이')} 깨어났다!` : `${D.foes[id].icon} ${josa(D.foes[id].name, '이')} 덤벼들었다!`;
    startFight(id, { kind: 'adv', scale: kind === 'boss' ? 1 : scale, death: site.tier >= 3 ? .08 : .03 });
    return;
  }
  if (kind === 'trap') {
    const pc = advInfo().trapPct;
    if (rand(1, 100) <= pc) A.msg = `🪤 발밑의 함정을 알아채고 피했다. (🎲 민첩 ${pc}% → 성공)`;
    else { const d = rand(6, 12) * site.tier; S.hp = Math.max(1, S.hp - d); A.msg = `🪤 함정에 걸렸다! 체력 -${d}. (🎲 민첩 ${pc}% → 실패)`; }
  } else if (kind === 'treasure') {
    const g = rand(site.gold[0], site.gold[1]), gd = pick(site.goods), n = rand(1, 2 + site.tier);
    A.loot.gold += g; A.loot.goods[gd] = (A.loot.goods[gd] || 0) + n;
    A.msg = `💰 낡은 상자를 찾았다! 금화 ${g} · ${goodName(gd)} ${n}`;
  } else if (kind === 'shrine') {
    if (rand(1, 100) <= clamp(50 + (S.stats.lore - gradeMin('C')) * 1.5, 5, 95)) { const h = Math.round(hpMax() * .4); S.hp = Math.min(hpMax(), S.hp + h); gainStats({ arcana: [1, 2] }); A.msg = `⛩ 옛 신의 제단. 비문을 읽고 기도했다. 몸이 가벼워졌다. (체력 +${h})`; }
    else { A.msg = '⛩ 옛 신의 제단. 비문을 읽을 수 없었다. 서늘한 기운만 남았다.'; }
  } else if (kind === 'rest') { const h = Math.round(hpMax() * .25); S.hp = Math.min(hpMax(), S.hp + h); A.msg = `🔥 안전한 동굴에서 불을 피우고 쉬었다. (체력 +${h})`; }
  advAdvance();
  emit();
}
function advAdvance() {
  const A = S.adv;
  A.i++;
  if (A.i >= A.path.length) advFinish(true);
}
function advAfterFight(res) {
  const A = S.adv, site = D.sites.find(x => x.id === A.site);
  if (res === 'win') {
    const g = rand(Math.round(site.gold[0] / 3), Math.round(site.gold[1] / 3));
    A.loot.gold += g;
    if (A.path[A.i] === 'boss') { A.loot.goods.mana = (A.loot.goods.mana || 0) + 4; S.flags.slewDrake = true; }
    A.msg = `🏆 승리! 전리품 금화 ${g}.`;
    advAdvance();
  } else { A.msg = res === 'fled' ? '🏃 겨우 빠져나왔다. 원정을 접고 돌아간다.' : '🩸 쓰러졌다… 동료들이 나를 업고 돌아갔다. 전리품 절반을 잃었다.'; if (res === 'lose') { A.loot.gold = Math.round(A.loot.gold / 2); for (const k in A.loot.goods) A.loot.goods[k] = Math.floor(A.loot.goods[k] / 2); } advFinish(false); }
}
function advRetreat() { if (S.adv && !S.adv.done && !S.combat) { S.adv.msg = '돌아가기로 했다. 지금까지 얻은 것을 챙겼다.'; advFinish(false, true); emit(); } }
function advFinish(cleared) {
  const A = S.adv, site = D.sites.find(x => x.id === A.site);
  A.done = true;
  S.realm.gold += A.loot.gold;
  for (const [g, n] of Object.entries(A.loot.goods)) S.inv[g] = (S.inv[g] || 0) + n;
  const fame = cleared ? site.tier * 4 + (A.path.includes('boss') ? 25 : 0) : 0;
  S.fame += fame;
  if (cleared) { S.rec.adv++; gainStats({ might: [1, 2], agility: [1, 2], vigor: [0, 1] }); }
  const gl = Object.entries(A.loot.goods).filter(([, n]) => n).map(([g, n]) => `${goodName(g)} ${n}`).join(', ');
  A.summary = `${cleared ? `🏁 ${site.name} 원정 성공!` : `↩️ ${site.name}에서 돌아왔다.`} 금화 ${A.loot.gold}${gl ? ` · ${gl}` : ''}${fame ? ` · 명성 +${fame}` : ''}`;
  if (cleared && site.boss) A.summary += ' — 비룡을 쓰러뜨린 영주의 이야기가 왕국에 퍼졌다!';
}
function advClose() { const A = S.adv; if (!A || !A.done) return; log(A.summary, 'mem'); S.adv = null; emit(); }

/* ═════ 수성전 ═════ */
function spawnThreat(id) {
  if (S.threat) return;
  const yearN = Math.floor(S.monthN / 12) + 1, pool = D.threats.filter(t => (id ? t.id === id : t.from <= yearN && !(S.flags.orcPeace && t.id === 'orcs')));
  const t = id ? pool[0] : weighted(pool, t => t.id === 'drake' ? .3 : t.id === 'baron' ? .7 : 1);
  if (!t) return;
  const grow = 1 + Math.min(2, S.monthN / 96);
  S.threat = { id: t.id, name: t.name, icon: t.icon, power: Math.round(rand(t.power[0], t.power[1]) * grow * PEER().threat), eta: rand(1, 2), tribute: t.tribute, champ: t.champ };
  log(`⚠️ 정찰병 보고: ${t.icon} ${josa(t.name, '이')} 영지로 다가온다. 추정 전력 ${S.threat.power}. 약 ${S.threat.eta}달 뒤 도착. (우리 방어력 ${defense()})`, 'mem');
}
function siegeStart() {
  const t = S.threat; S.threat = null;
  const ask = { siegeAsk: true, text: `${t.icon} ${josa(t.name, '이')} 성 밖에 진을 쳤다! 적 전력 ${t.power}, 우리 방어력 ${defense()}, 성벽 ${S.realm.wall}/${wallMax()}.`, choices: ['⚔️ 성문을 닫고 싸운다'], t };
  const trib = Math.round(t.power * .8);
  if (t.tribute) { ask.choices.push(`💰 공물을 바치고 물러가게 한다 (금화 ${trib})`); ask.trib = trib; }
  S.pending.unshift(ask);
  log(ask.text, 'ask');
}
function siegeBegin(t) {
  S.siege = { t, P: t.power, P0: t.power, round: 1, rounds: 3, log: [`${t.icon} ${josa(t.name, '이')} 공격해 온다! (적 전력 ${t.power})`], over: null };
}
function siegeOdds() {
  const G = S.siege; if (!G) return null;
  const D0 = defense();
  return { D: D0, P: Math.round(G.P), wall: S.realm.wall, wallMax: wallMax(), round: G.round, rounds: G.rounds, oil: S.realm.gold >= 15 && S.realm.wall > 15, repair: S.realm.gold >= 20 && S.realm.wall < wallMax(),
    champ: D.foes[G.t.champ] };
}
function siegeAct(a) {
  const G = S.siege; if (!G || G.over || S.combat) return;
  const L = G.log, Dp = defense(), R = S.realm;
  let enemyK = 1;
  if (a === 'volley') { const d = Math.round(Dp * .13 * randf(.8, 1.2)); G.P -= d; L.push(`🏹 화살 일제 사격! 적 전력 -${d}`); }
  else if (a === 'oil' && R.gold >= 15 && R.wall > 15) { R.gold -= 15; const d = Math.round(Dp * .22 * randf(.85, 1.15)); G.P -= d; L.push(`🔥 성벽 위에서 끓는 기름을 부었다! 적 전력 -${d} (💰 -15)`); }
  else if (a === 'repair' && R.gold >= 20) { R.gold -= 20; const w = 20 + R.b.wall * 6; R.wall = Math.min(wallMax(), R.wall + w); enemyK = .8; L.push(`🧱 무너진 성벽을 메웠다. 성벽 +${w} (💰 -20)`); }
  else if (a === 'hold') { enemyK = .5; L.push('🛡 방패벽을 세우고 버텼다.'); }
  else if (a === 'sortie') { L.push(`🐴 성문을 열고 직접 출격했다! 적장 ${josa(D.foes[G.t.champ].name, '와')} 맞선다.`); startFight(G.t.champ, { kind: 'siege', death: .06, scale: 1 + Math.min(.8, S.monthN / 240) }); return; }
  else return;
  siegeEnemy(enemyK);
}
function siegeEnemy(k) {
  const G = S.siege, L = G.log, R = S.realm;
  if (G.P <= 0) return siegeEnd(true);
  const hit = G.P * .14 * randf(.8, 1.2) * k;
  if (R.wall > 0) { const w = Math.round(hit / (1 + R.b.wall * .15)); R.wall = Math.max(0, R.wall - w); lose(G.P * .015 * k); L.push(`⛏ 적이 성벽을 두드렸다. 성벽 -${w}`); }
  else { lose(G.P * .06 * k); L.push('💥 성벽이 뚫렸다! 성안에서 백병전이 벌어졌다.'); }
  G.round++;
  if (G.round > G.rounds) return siegeEnd(defense() >= G.P);
  emit();
}
// 병력 손실 (전력 단위): 징집병부터
function lose(p) {
  const t = S.realm.troops;
  let left = p;
  for (const [k, pw] of [['levy', 1], ['men', 3], ['knights', 14]]) { const n = Math.min(t[k], Math.ceil(left / pw)); t[k] -= n; left -= n * pw; if (left <= 0) break; }
}
function siegeAfterSortie(res) {
  const G = S.siege, L = G.log;
  if (res === 'win') { const d = Math.round(G.P * .35); G.P -= d; S.fame += 3; realmDelta({ morale: 4 }); L.push(`🏆 적장을 쓰러뜨렸다! 적이 흔들린다. 적 전력 -${d}`); siegeEnemy(.6); }
  else { realmDelta({ morale: -6 }); L.push('🩸 출격이 실패했다. 병사들이 술렁인다.'); siegeEnemy(1.2); }
}
function siegeEnd(win) {
  const G = S.siege, R = S.realm;
  G.over = win ? 'win' : 'lose';
  if (win) {
    const g = Math.round(G.P0 * .3), f = Math.round(G.P0 / 12);
    R.gold += g; S.fame += f; R.morale = clamp(R.morale + 6, 0, 100); S.rec.sieges++; S.favor = (S.favor || 0) + 2;
    G.log.push(`🎉 ${josa(G.t.name, '이')} 물러갔다! (💰 +${g} · 명성 +${f} · 민심 +6)`);
  } else {
    S.rec.raids++;
    const fl = Math.round(R.food * .35), gl = Math.round(R.gold * .3), pl = Math.round(R.pop * .08);
    R.food -= fl; R.gold -= gl; R.pop -= pl; R.morale = clamp(R.morale - 12, 0, 100); S.fame = Math.max(0, S.fame - 5);
    const bs = Object.keys(R.b).filter(b => R.b[b] > 0), lost = bs.length ? pick(bs) : null;
    if (lost) R.b[lost]--;
    G.log.push(`🔥 영지가 약탈당했다… (🌾 -${fl} · 💰 -${gl} · 인구 -${pl} · 민심 -12${lost ? ` · ${D.buildings[lost].name} 1단계 파괴` : ''})`);
  }
  emit();
}
function siegeClose() { const G = S.siege; if (!G || !G.over) return; log(G.log[G.log.length - 1], 'mem'); S.siege = null; checkCollapse(); emit(); }

/* ═════ 무역 ═════ */
function rollPrices(init) {
  if (!S.trend || init) S.trend = Object.fromEntries(D.goods.map(g => [g.id, randf(.85, 1.15)]));
  for (const g of D.goods) S.trend[g.id] = clamp(S.trend[g.id] * randf(.9, 1.1) + (1 - S.trend[g.id]) * .1, .65, 1.45);
  for (const t of D.towns) {
    S.prices[t.id] = {};
    for (const g of D.goods) {
      let p = g.base * (t.mods[g.id] || 1) * S.trend[g.id] * randf(.94, 1.06);
      if (g.id === 'grain' && t.id === 'home' && ['autumn'].includes(SEASON(S.month))) p *= .8;
      S.prices[t.id][g.id] = Math.max(1, Math.round(p * 10) / 10);
    }
  }
}
const sellK = () => Math.min(.94, .8 + S.realm.b.market * .02 + S.stats.charm / 1000);
function market() {
  return D.goods.map(g => ({ id: g.id, name: g.name, icon: g.icon, have: g.id === 'grain' ? Math.floor(S.realm.food / 10) : S.inv[g.id] || 0, buy: Math.round(S.prices.home[g.id] * 10) / 10, sell: Math.round(S.prices.home[g.id] * sellK() * 10) / 10,
    away: D.towns.filter(t => t.id !== 'home').map(t => ({ id: t.id, icon: t.icon, p: S.prices[t.id][g.id] })) }));
}
// 곡물은 영지 식량 10 = 곡물 1
function trade(gid, n) {
  if (busy() || !n) return false;
  const p = S.prices.home[gid], isG = gid === 'grain';
  if (n > 0) { const c = Math.round(p * n); if (S.realm.gold < c) return false; S.realm.gold -= c; if (isG) S.realm.food += n * 10; else S.inv[gid] += n; log(`🏪 ${goodName(gid)} ${n} 구입 (💰 -${c})`, 'info'); }
  else { const m = -n, have = isG ? Math.floor(S.realm.food / 10) : S.inv[gid]; if (have < m) return false; const c = Math.round(p * sellK() * m); S.realm.gold += c; if (isG) S.realm.food -= m * 10; else S.inv[gid] -= m; log(`🏪 ${goodName(gid)} ${m} 판매 (💰 +${c})`, 'info'); }
  emit(); return true;
}
// 상단: 짐을 싣고 한 달 뒤 돌아옴 (통행세·산적 위험, 호위 상비병을 붙이면 덜 위험). 돌아올 때 사 올 물건을 하나 고를 수 있음
function caravanQuote(to, goods, escort) {
  const t = D.towns.find(x => x.id === to);
  if (!t) return null;
  let v = 0;
  for (const [g, n] of Object.entries(goods)) v += n * S.prices[to][g];
  v = Math.round(v * (1 - t.toll) * (1 + S.realm.b.market * .02));
  return { value: v, risk: Math.round(t.risk * (escort ? .4 : 1) * 100) };
}
function sendCaravan(to, goods, escort, back) {
  const t = D.towns.find(x => x.id === to);
  if (!t || S.caravan || busy() || S.ap <= 0) return false;
  goods = Object.fromEntries(Object.entries(goods).filter(([, n]) => n > 0));
  for (const [g, n] of Object.entries(goods)) { const have = g === 'grain' ? Math.floor(S.realm.food / 10) : S.inv[g]; if (have < n) return false; }
  if (!Object.keys(goods).length) return false;
  if (escort && S.realm.troops.men < 10) return false;
  for (const [g, n] of Object.entries(goods)) { if (g === 'grain') S.realm.food -= n * 10; else S.inv[g] -= n; }
  if (escort) S.realm.troops.men -= 10;
  S.caravan = { to, goods, escort: !!escort, back: back || null, at: S.monthN };
  S.ap--;
  log(`🐫 상단이 ${t.icon} ${josa(t.name, '으로')} 떠났다.${escort ? ' (상비병 10명 호위)' : ''}`);
  emit(); return true;
}
function caravanReturn() {
  const C = S.caravan; S.caravan = null;
  const t = D.towns.find(x => x.id === C.to), q = caravanQuote(C.to, C.goods, C.escort);
  if (C.escort) S.realm.troops.men += 10;
  let v = q.value, txt;
  if (rand(1, 100) <= q.risk) {
    if (C.escort && Math.random() < .55) { txt = `🐫 상단이 ${t.name}에서 돌아왔다. 길에서 산적을 만났지만 호위병이 물리쳤다.`; S.realm.troops.men -= rand(0, 2); }
    else { v = Math.round(v * .35); txt = `🐫 상단이 산적에게 털렸다! 겨우 일부만 건져 돌아왔다.`; }
  } else txt = `🐫 상단이 ${t.icon} ${t.name}에서 무사히 돌아왔다.`;
  let bought = '';
  if (C.back) { const p = S.prices[C.to][C.back], n = Math.floor((v * .5) / p); if (n > 0) { v -= Math.round(n * p); S.inv[C.back] += n; bought = ` · ${goodName(C.back)} ${n} 사 옴`; } }
  S.realm.gold += v; S.rec.trades++;
  log(`${txt} (💰 +${v}${bought})`, 'mem');
}

/* ═════ 혼담 · 아이 · 아버지 ═════ */
const API = {
  josa,
  fertile: () => S.age <= Math.round(RACE().life.old * .82),
  race: () => S.race, peer: () => S.peer, rankLv: () => D.ranks[PEER().id].lv, title: () => S.title,
  favor: n => { S.favor = Math.max(0, S.favor + n); }, auraLv: () => S.aura.lv, circleLv: () => CIRCLE(), cp: () => myCP(),
  gain: fx => gainStats(fx), realm: d => realmDelta(d), fight: (id, ctx) => startFight(id, ctx),
  log: t => log(t), spawnThreat: id => spawnThreat(id),
  proposalHouse: () => { if (!S.prop || S.prop.at !== S.monthN) { const h = pick(D.houses), g = S.gender === 'm' ? 'f' : 'm'; S.prop = { at: S.monthN, house: h.id, name: h.race && D.raceNames[h.race] ? pick(D.raceNames[h.race][g]) : pick(D.names[g]), gender: g, age: clamp(S.age + rand(-3, 2), 20, 40), race: h.race || 'human' }; } return D.houses.find(h => h.id === S.prop.house); },
  proposalWho: () => S.prop,
  marry: met => {
    const P = S.prop, h = D.houses.find(x => x.id === P.house);
    const sp = addPerson({ role: 'spouse', name: P.name, gender: P.gender, age: P.age, house: h.name, race: P.race || 'human', rank: 'baron', personality: pick(Object.keys(D.personalities)), aff: met ? 65 : 50, rel: 'spouse', seed: 'sp' + S.monthN + P.name });
    S.spouse = sp.id; S.lastProposal = S.monthN;
    const fx = { valen: () => { S.realm.gold += 180; return '지참금 금화 180'; }, morrow: () => { gainStats({ lore: 3, arcana: 3 }); return '배우자에게 마법을 배워 학식·마력 +'; },
      harth: () => { S.flags.allyHarth = true; return '하스 가문과 동맹 — 수성전 방어력 +60'; }, eloin: () => { realmDelta({ morale: 8 }); S.fame += 6; return '민심 +8 · 명성 +6'; } }[h.id]();
    log(`💍 ${h.sym} ${h.name} 가문의 ${josa(P.name, '와')} 혼인했다${met ? ' — 직접 만나 마음이 통했다' : ''}. 성대한 혼례가 열렸다. (${fx})`, 'mem');
  },
  spouseName: () => { const p = S.people.find(x => x.id === S.spouse); return p ? p.name : '배우자'; },
  child: () => { const g = Math.random() < .5 ? 'm' : 'f', c = addPerson({ role: 'child', name: pick(D.names[g]), gender: g, age: 0 }); S.children.push(c.id); log(`👶 ${c.gender === 'm' ? '아들' : '딸'} ${josa(c.name, '이')} 태어났다. 가문의 대가 이어진다.`, 'mem'); },
  fatherFate: () => {
    const f = person('father');
    S.fatherAway = false;
    if (Math.random() < .5) { log(`편지에는 아버지가 다리를 다쳐 돌아온다고 적혀 있었다. 몇 주 뒤, 지팡이를 짚은 ${josa(f.name, '이')} 성문을 들어섰다. "이제 네가 영주다. 나는 뒤에서 지켜보마."`, 'mem'); f.role = 'father'; f.retired = true; }
    else { f.alive = false; log(`편지에는 아버지 ${josa(f.name, '이')} 전장에서 왕을 지키다 쓰러졌다고 적혀 있었다. 성 전체가 검은 깃발을 걸었다. 이제 이 땅은 온전히 나의 것이다.`, 'mem'); realmDelta({ morale: -5 }); S.fame += 5; }
    S.title = '영주';
    log(`👑 ${S.name}, ${LAND().name}의 영주가 되었다.`, 'mem');
  },
};
// 수성전 물음 답 (성문을 닫고 싸움 / 공물)
function siegeAnswer(ask, i) {
  if (i === 1 && ask.trib) {
    if (S.realm.gold >= ask.trib) { S.realm.gold -= ask.trib; S.fame = Math.max(0, S.fame - 4); log(`💰 공물 금화 ${ask.trib}을 바쳤다. ${josa(ask.t.name, '이')} 물러갔다. (명성 -4)`); return; }
    log('금고에 공물을 바칠 금화가 없었다. 싸울 수밖에 없다.');
  }
  siegeBegin(ask.t);
}

/* ═════ 한 달 넘기기 ═════ */
function endMonth() {
  if (S.stage !== 'main' || busy()) return false;
  const R = S.realm, rep = {};
  if (S.caravan && S.monthN > S.caravan.at) caravanReturn();
  // 생산
  const harvest = [8, 9, 10].includes(S.month), farmK = 1 + R.b.farm * .25, levyK = Math.max(.5, 1 - R.troops.levy / Math.max(1, R.pop) * 2);
  let food = R.pop * (harvest ? .32 : .05) * farmK * levyK * (S.flags.drought && harvest ? .55 : 1) * (S.flags.irrigated && harvest ? 1.2 : 1) * (LAND().id === 'river' ? 1.15 : LAND().id === 'mine' ? .85 : 1);
  const eat = R.pop * .1 + R.troops.levy * D.troops.levy.food + R.troops.men * D.troops.men.food + R.troops.knights * D.troops.knights.food;
  rep.food = Math.round(food - eat);
  R.food += rep.food;
  const tax = R.pop * [.04, .065, .09][R.tax] * (1 + R.b.market * .12) * (.7 + S.stats.stewardship / 200);
  const upkeep = R.troops.levy * D.troops.levy.upkeep + R.troops.men * D.troops.men.upkeep + R.troops.knights * D.troops.knights.upkeep;
  rep.gold = Math.round(tax - upkeep);
  R.gold = Math.max(0, R.gold + rep.gold);
  for (const [g, n] of Object.entries(LAND().prod || {})) S.inv[g] = (S.inv[g] || 0) + probRound(n * (g === 'iron' ? 1 + R.b.smithy * .3 : 1));
  if (R.b.smithy) S.inv.iron += probRound(R.b.smithy * .5);
  // 굶주림 · 민심 · 치안 · 인구
  if (R.food < 0) { R.pop = Math.round(R.pop * .96); R.morale = clamp(R.morale - 10, 0, 100); R.food = 0; log('🌾 창고가 바닥났다! 굶주린 백성들이 떠나고 원망이 커졌다. (인구 -4% · 민심 -10)', 'mem'); }
  const mT = 50 + R.b.temple * 4 + [8, 0, -12][R.tax] + Math.min(12, S.fame / 12) + (R.food < 50 ? -12 : 0) - (R.order < 30 ? 6 : 0);
  R.morale = clamp(Math.round(R.morale + (mT - R.morale) * .15), 0, 100);
  const oT = 42 + R.b.barracks * 5 + Math.min(15, troopPower() / Math.max(1, R.pop) * 60) + (R.morale > 60 ? 5 : 0);
  R.order = clamp(Math.round(R.order + (oT - R.order) * .12), 0, 100);
  const cap = popCap();
  if (R.pop > cap) R.pop = Math.round(R.pop - (R.pop - cap) * .05);
  else if (R.morale >= 55 && R.food > 0) R.pop = Math.round(R.pop + Math.max(R.pop < cap ? 1 : 0, R.pop * .012 * (1 - R.pop / cap)));
  else if (R.morale < 30) R.pop = Math.round(R.pop * .99);
  R.drill = Math.max(0, R.drill - 1);
  rep.tax = Math.round(tax); rep.upkeep = Math.round(upkeep);
  // 시간
  S.month++; S.monthN++;
  if (S.month > 12) { S.month = 1; S.year++; }
  if (S.month === 3) { S.age++; S.people.forEach(p => { if (p.alive) p.age++; }); delete S.flags.drought; delete S.flags.irrigated; log(`— ${S.year}년 봄 · ${S.age}살 —`, 'year'); }
  else log(`— ${S.year}년 ${S.month}월 (${SEASON_KO[SEASON(S.month)]}) —`, 'month');
  log(`📜 집사의 보고: 💰 ${rep.gold >= 0 ? '+' : ''}${rep.gold} (세금 ${rep.tax} · 유지비 ${rep.upkeep}) · 🌾 ${rep.food >= 0 ? '+' : ''}${rep.food}${harvest ? ' (수확철)' : ''} · 민심 ${R.morale} · 치안 ${R.order}`, 'info');
  rollPrices();
  // 몸
  if (S.injury) S.injury--;
  S.hp = Math.min(hpMax(), S.hp + Math.round(hpMax() * (.22 + R.b.temple * .03)));
  // 늙음 · 죽음
  const LF = RACE().life, noDeath = S.sandbox && S.sandbox.noDeath;
  if (!noDeath && S.age >= LF.old && Math.random() < (S.age - LF.old + 2) * .0035 * 78 / LF.max) return die(`${S.age}살, 성의 침상에서 가족에 둘러싸여 눈을 감았다.`), emit(), true;
  if (S.fatherAway === false) { const f = person('father'); if (f && f.retired && f.age > LF.old + 2 && Math.random() < .01 * (f.age - LF.old - 1) * 78 / LF.max) { f.alive = false; log(`아버지 ${josa(f.name, '이')} 세상을 떠났다. 마지막까지 "잘했다"고 말했다.`, 'mem'); } }
  // 위협
  if (S.threat) { S.threat.eta--; if (S.threat.eta <= 0) siegeStart(); else log(`⚠️ ${S.threat.icon} ${josa(S.threat.name, '이')} 다가온다. 약 ${S.threat.eta}달 뒤 도착. (적 ${S.threat.power} vs 우리 ${defense()})`, 'info'); }
  else if (!(S.sandbox && S.sandbox.noThreat) && Math.random() < .075 * LAND().threat * (SEASON(S.month) === 'winter' ? 1.3 : 1) * (S.monthN < 4 ? .3 : 1)) spawnThreat();
  HOOK.month.forEach(f => f());
  // 반란
  if (checkCollapse()) { emit(); return true; }
  // 사건
  if (!S.pending.length) monthEvent();
  S.ap = S.injury ? AP_MAX - 1 : AP_MAX;
  if (S.age >= LF.max && !noDeath) die(`${S.age}살, 긴 통치를 마치고 조용히 잠들었다.`);
  emit(); return true;
}
function checkCollapse() {
  const R = S.realm;
  if (R.morale <= 8 && R.order <= 20 && !S.ended) {
    S.flags.revolt = (S.flags.revolt || 0) + 1;
    if (S.flags.revolt >= 2) { die('굶주리고 성난 백성들이 성문을 부쉈다. 가문은 영지에서 쫓겨났다.', 'exile'); return true; }
    log('🔥 농민 반란이 일어났다! 기사들이 간신히 진압했다. 한 번 더 일어나면 끝이다. (민심을 올려야 한다)', 'mem');
    R.morale = 20; R.order = 30; lose(30);
  }
  return false;
}
function die(text, kind = 'death') {
  S.ended = { kind, text, age: S.age, years: Math.floor(S.monthN / 12), fame: S.fame, rec: S.rec, realm: { pop: S.realm.pop, gold: S.realm.gold, b: Object.assign({}, S.realm.b) }, heirs: S.children.length };
  log(`🕯 ${text}`, 'mem');
}

/* ═════ 화면용 정보 ═════ */
function info() {
  if (!S) return null;
  const R = S.realm;
  return { name: S.name, gender: S.gender, house: S.house, crest: S.crest, land: LAND(), title: S.title, age: S.age, year: S.year, month: S.month, season: SEASON_KO[SEASON(S.month)], stage: S.stage,
    hp: S.hp, hpMax: hpMax(), fame: S.fame, injury: S.injury, ap: S.ap, apMax: AP_MAX, stats: S.stats, grades: Object.fromEntries(STATS.map(k => [k, gradeOf(S.stats[k])])),
    realm: { pop: R.pop, food: Math.round(R.food), gold: Math.round(R.gold), morale: R.morale, order: R.order, wall: R.wall, wallMax: wallMax(), troops: R.troops, power: troopPower(), defense: defense(), drill: R.drill, b: R.b, tax: R.tax, cap: troopCap(),
      foodMonths: Math.round(R.food / Math.max(1, R.pop * .1)) },
    inv: S.inv, caravan: S.caravan && Object.assign({ town: D.towns.find(t => t.id === S.caravan.to) }, S.caravan), threat: S.threat, people: S.people.filter(p => p.alive || p.role === 'father'),
    gear: gearInfo(), potions: S.potions, ended: S.ended, rec: S.rec, spouse: S.people.find(p => p.id === S.spouse) || null,
    race: S.race, beast: S.beast, raceName: RACE().name + (S.beast && RACE().subs ? `(${RACE().subs[S.beast].name})` : ''), peer: PEER(), peerIdx: S.peer, favor: S.favor, seed: S.seed,
    titleLabel: titleLabel(), aura: Object.assign({}, AURA(), { xp: S.aura.xp, next: D.aura[S.aura.lv + 1] || null }), circle: Object.assign({}, D.circles[CIRCLE()], { xp: S.circle.xp, next: D.circles[CIRCLE() + 1] || null }),
    cp: myCP(), mightGrade: mightGrade(myCP()), mpMax: mpMax(), spells: spellsKnown(), start: S.start, sandbox: S.sandbox, life: RACE().life,
    ...Object.assign({}, ...HOOK.info.map(f => f())) };
}
// 호칭: 영주면 '남작', 대리면 '남작령 영주 대리', 유년기면 '남작가 영식/영애'
function titleLabel() {
  const P = PEER();
  if (S.title === '영주') return `${S.house} ${P.name}`;
  if (S.title === '영주 대리') return `${P.land} 영주 대리`;
  return `${P.name}가 ${S.gender === 'm' ? '영식' : '영애'}`;
}
function buildList() { return Object.entries(D.buildings).map(([id, b]) => ({ id, name: b.name, icon: b.icon, desc: b.desc, lv: S.realm.b[id], cost: buildCost(id), ok: buildCost(id) != null && S.realm.gold >= buildCost(id) && S.ap > 0 && !busy() })); }
function recruitInfo() { const R = S.realm, cap = troopCap(); return Object.entries(D.troops).map(([id, t]) => ({ id, name: t.name, icon: t.icon, desc: t.desc, cost: t.cost, upkeep: t.upkeep, power: t.power, have: R.troops[id], max: id === 'levy' ? Math.max(0, Math.floor(R.pop * .15 - R.troops.levy)) : Math.max(0, cap[id] - R.troops[id]) })); }

// 확장 모듈(js/realm-life.js)이 쓰는 내부 도구
const KERNEL = { get S() { return S; }, D, HOOK, ACTIONS, API, rand, randf, pick, clamp, val, weighted, josa, log, emit, gainStats, realmDelta, checkPct, gradeOf, gradeMin, startFight, defense, troopPower, hpMax,
  myAtk, myDef, myCP, cpOf, mightGrade, compAtk, busy, apply, fireEvent, eligible, choicesOf, addPerson, person, die, STATS, LAND, RACE, PEER, SIZE, fmtD, goodName, breakPct, AP_MAX, SEASON };
window.Realm = {
  _k: KERNEL,
  init: () => { S = load(); return !!S; }, newGame, state: () => S, info, on: f => listeners.push(f), reset: () => { S = null; try { localStorage.removeItem(KEY); } catch (e) { /* */ } },
  event: currentEvent, choose,
  actions: actionList, act: doAction, endMonth, buildList, build, recruitInfo, recruit, setTax, gear: gearInfo, upgrade, buyPotion,
  fight: () => S && S.combat, odds: fightOdds, fightAct, closeFight,
  sites: () => D.sites.map(s => Object.assign({}, s, { danger: s.tier })), startAdv, adv: advInfo, advStep, advRetreat, advClose,
  siege: () => S && S.siege, siegeOdds, siegeAct, siegeClose, siegeLog: () => S.siege && S.siege.log,
  market, trade, towns: () => D.towns.filter(t => t.id !== 'home'), caravanQuote, sendCaravan,
  gradeOf, D,
  dev: { threat: id => { spawnThreat(id); if (S.threat) S.threat.eta = 1; emit(); }, set: f => { f(S); emit(); }, fire: id => { const e = D.events.find(x => x.id === id); if (e) { fireEvent(e); emit(); } } },
};
})();
