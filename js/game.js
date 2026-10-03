// 게임 엔진 — 화면(DOM)은 모르고 상태만 다룸. 화면은 js/main.js가 그림
(function () {
'use strict';

const D = window.GAME_DATA;
const C = D.config;
const SEASONS = C.seasons;
const SAVE_KEY = 'llife-save-v4';
const OLD_SAVE_KEY = 'llife-save-v3';
const COND = ['happy', 'health'];             // 상태: 0~100
const ABIL = D.abilities;                     // 능력: 상한 없음, 등급
const STATS = COND.concat(ABIL);
const PSTATS = ['close', 'trust', 'heart', 'grudge'];
const LABEL = Object.assign({}, D.statLabel, { close: '친밀', trust: '신뢰', heart: '설렘', grudge: '원한' });
const GR = D.grades;
const SUBJ = D.subjects.map(x => x.id);
const KIND_LABEL = { classmate: '같은 반', friend: '친구', coworker: '동료', rival: '앙숙', child: '아이', family: '가족' };
const EVENTS = Object.fromEntries(D.events.map(e => [e.id, e]));
const PLACES = Object.fromEntries(D.places.map(p => [p.id, p]));
const ACTIONS = Object.fromEntries(D.actions.map(a => [a.id, a]));
const TIMES = ['아침', '낮', '저녁'];
const TRANSIENT = ['fp', 'sev', 'late', 'mainId', 'mainName', 'loverId', 'lover', 'debt', 'new', 'newId', 'attempt', 'uniScore', 'signal', 'fline', 'myValue', 'theirValue', 'satText', 'placeLabel'];

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const asList = v => v == null ? [] : Array.isArray(v) ? v : [v];
const val = v => Array.isArray(v) ? rand(v[0], v[1]) : (v || 0);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function weighted(list, w = x => x.weight ?? 1) {
  let sum = 0; for (const x of list) sum += w(x);
  let r = Math.random() * sum;
  for (const x of list) { r -= w(x); if (r <= 0) return x; }
  return list[list.length - 1];
}

/* ---------- 조사: {fp|와} → 지우와 / 민준과 ---------- */
const JOSA = { '이': ['이', '가'], '을': ['을', '를'], '은': ['은', '는'], '와': ['과', '와'], '와는': ['과는', '와는'], '아': ['아', '야'], '이라는': ['이라는', '라는'], '이랑': ['이랑', '랑'] };
function josa(word, j) {
  const c = word.charCodeAt(word.length - 1);
  const jong = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : 0;
  if (j === '으로') return word + (jong === 0 || jong === 8 ? '로' : '으로');
  const pair = JOSA[j];
  return pair ? word + (jong ? pair[0] : pair[1]) : word + j;
}
function fmtMoney(v) {
  const sign = v < 0 ? '-' : '', a = Math.abs(Math.round(v));
  if (a === 0) return '0원';
  if (a >= 10000) { const man = a % 10000; return `${sign}${Math.floor(a / 10000)}억${man ? ' ' + man.toLocaleString() + '만' : ''}원`; }
  return `${sign}${a.toLocaleString()}만원`;
}

/* ---------- 능력치 등급 ---------- */
function gIdx(v) { let i = 0; while (i + 1 < GR.length && v >= GR[i + 1][1]) i++; return i; }
const gradeOf = v => GR[gIdx(v)][0];
const gradeMin = letter => (GR.find(g => g[0] === letter) || GR[0])[1];
function gradeInfo(v) {
  const i = gIdx(v), lo = GR[i][1], hi = GR[i + 1] ? GR[i + 1][1] : lo + 100;
  return { letter: GR[i][0], idx: i, pct: Math.min(1, (v - lo) / (hi - lo)), value: v };
}
const scoreGrade = sc => clamp(Math.round(9 - (sc - 15) / 9), 1, 9);   // 과목 점수 → 1~9등급 (87점 이상이면 1등급)

let S = null;
const subs = [];
const emit = () => subs.forEach(f => f(S));

/* ═════════ 사람 ═════════ */
const alive = () => S.people.filter(p => !p.gone);
const person = id => S.people.find(p => p.id === id && !p.gone);
const pname = p => p ? (p.name || p.role) : '';
const npcAge = p => S.age + p.ageDiff;
const jailed = () => S.jail > 0;
const mainPartner = () => alive().find(p => p.spouse) || alive().find(p => p.partner);
// 연애(설렘) 가능 조건: 둘 다 성인, 상대 50살 미만, 이성, 가족·자녀 아님
function canRomance(p) {
  if (!p || p.gone || p.kind === 'family' || p.kind === 'child') return false;
  const age = npcAge(p);
  return S.age >= C.romanceMinAge && age >= C.romanceMinAge && age <= C.romanceMaxAge && p.gender !== S.gender;
}
// 이미 사귀는 사이는 나이가 들어도 설렘이 변할 수 있음 (사귀는 사이 자체가 성인끼리만 성립)
const heartOk = p => (p.partner || p.spouse || p.secret) ? S.age >= C.romanceMinAge : canRomance(p);

function relLabel(p) {
  if (p.kind === 'family' || p.kind === 'child') return p.role;
  if (p.spouse) return '배우자';
  if (p.partner) return '연인';
  if (p.secret) return '몰래 만나는 사이';
  if (p.grudge >= 50) return '원수';
  if (p.fling) return mainPartner() || p.taken || p.heart < 40 ? '복잡한 사이' : '썸';   // 사귀지 않고 밤을 보낸 사이
  if (p.ex) return '전 연인';
  if (p.heart >= 40 && heartOk(p)) return '썸';
  if (p.close >= 75) return '절친';
  if (p.close >= 45) return '친구';
  if (p.kind === 'classmate') return S.age >= 19 ? '동창' : '같은 반';
  return KIND_LABEL[p.kind] || '아는 사람';
}

// 관계 목록이 꽉 차면 제일 덜 친한 사람부터 멀어짐
function makeRoom(kind) {
  if (alive().filter(p => p.kind !== 'family').length >= C.maxPeople && kind !== 'child') {
    const drop = alive().filter(p => !['family', 'child'].includes(p.kind) && !p.partner && !p.spouse && !p.secret).sort((a, b) => a.close - b.close)[0];
    if (drop) drop.gone = true;
  }
}
// 관계 목록에 정식으로 넣기 (장소에서 처음 본 사람도 말을 걸면 여기로)
function enlist(p) {
  makeRoom(p.kind);
  p.id = 'p' + (++S.pseq);
  p.met = S.age;
  delete p.stranger;
  lookOf(p);
  S.people.push(p);
  S.vars.new = p.name; S.vars.newId = p.id;
  return p;
}
function addPerson(spec) { return enlist(makePerson(spec || meetDefault())); }
// 사람 한 명 만들기 (아직 관계 목록에는 안 넣음)
function makePerson(spec) {
  const gender = spec.gender || (Math.random() < .5 ? 'm' : 'f');
  let ageDiff = spec.ageDiff;
  if (ageDiff == null) {
    const r = spec.ageRange || [S.age, S.age];
    ageDiff = rand(Math.max(0, r[0]), Math.max(0, r[1])) - S.age;
  }
  const age = S.age + ageDiff;
  const hobby = spec.hobby || pick(D.hobbies).id;
  const p = {
    id: null, kind: spec.kind || 'friend', role: spec.role || null,
    name: spec.name || pick(gender === 'm' ? D.namesM : D.namesF), gender, ageDiff,
    close: spec.close ?? rand(15, 30), trust: spec.trust ?? rand(15, 30), heart: 0, grudge: spec.grudge ?? 0,
    taken: spec.taken ?? (age >= 24 ? Math.random() < .35 : age >= 19 ? Math.random() < .15 : false),
    met: S.age, debt: 0, sibling: !!spec.sibling,
    // 프로필 — 친해질수록 보임
    personality: spec.personality || pick(D.personalities).id,
    hobby,
    value: spec.value || pick(D.values).id,
    wealth: spec.wealth || weighted(D.wealth).id,
    dream: pick(D.dreams).id,
    npcJob: age >= 23 ? pick(D.npcJobs) : null,
    feature: pick(D.features),
    hangout: spec.hangout !== undefined ? spec.hangout : pickHangout(hobby, age),   // 자주 가는 곳
  };
  if (p.kind === 'child') p.role = '아이';
  return p;
}
// 생김새 (js/avatar.js). 같은 인생의 같은 id면 늘 같은 얼굴. 가족·아이는 피부색이 나와 같음
function lookOf(p) {
  if (!p.appearance && window.Avatar) p.appearance = Avatar.make(`${S.id}:${p.id}`, p.gender, { feature: p.feature, skin: p.kind === 'family' || p.kind === 'child' ? S.skin : null });
  return p.appearance || null;
}
function meetDefault() {
  const a = S.age;
  if (a < 19) return { kind: 'classmate', ageRange: [Math.max(0, a - 1), a + 1] };
  const kind = S.job && Math.random() < .5 ? 'coworker' : 'friend';
  return Math.random() < .15
    ? { kind, ageRange: [Math.max(a + 10, 50), Math.max(a + 25, 62)] }
    : { kind, ageRange: [Math.max(19, a - 8), Math.min(C.romanceMaxAge, a + 8)] };
}

function applyP(p, delta, mult) {
  if (!p || !delta) return [];
  const out = [], tr = trait();
  for (const k of Object.keys(delta)) {
    if (!PSTATS.includes(k)) continue;
    if (k === 'heart' && !heartOk(p)) continue;
    let v = val(delta[k]);
    if (!v) continue;
    if (v > 0 && k !== 'grudge' && tr.relMult) v = Math.round(v * tr.relMult);
    if (mult && mult[k] && (v > 0 || k === 'grudge')) v = Math.round(v * mult[k]);
    const b = p[k]; p[k] = clamp(b + v, 0, 100);
    if (p[k] !== b) out.push([`${pname(p)} ${LABEL[k]}`, p[k] - b]);
  }
  return out;
}
function breakUp(p, grudge) {
  if (!p) return;
  p.partner = false; p.secret = false; p.ex = true; p.fling = false; p.livesWith = false;
  p.grudge = clamp(p.grudge + (grudge || 0), 0, 100);
  p.heart = Math.min(p.heart, 15);
}
function divorce(p) {
  if (!p) return;
  p.spouse = false; p.ex = true;
  p.grudge = clamp(p.grudge + 30, 0, 100);
  p.heart = Math.min(p.heart, 10);
  delete S.flags.married;
  if (S.money > 0) S.money -= Math.floor(S.money / 2);
}
function endMain(grudge) {
  const m = mainPartner();
  if (!m) return;
  if (m.spouse) { divorce(m); m.grudge = clamp(m.grudge + grudge, 0, 100); } else breakUp(m, grudge);
}
function startRelation(p, sneaky) {
  if (sneaky) p.secret = true; else p.partner = true;
  p.taken = false; p.ex = false; p.fling = false;
  p.since = S.age;
}
/* ═════════ 친밀한 관계와 아이 ═════════ */
// 함께 밤을 보냄 (fling: 사귀지 않는 사이 → '썸' 또는 '복잡한 사이')
function night(p, fling) {
  if (!p) return;
  S.flags.intimate = true;
  p.nights = (p.nights || 0) + 1;
  if (fling && !(p.partner || p.spouse || p.secret)) p.fling = true;
}
// 아이가 생길 수 있음. 엄마 나이 30살부터 확률이 줄고 45살부터는 0. 소식은 다음 계절에 (tellPreg)
function conceive(p, chance) {
  if (!p || p.gone || S.preg || !chance) return false;
  const mom = S.gender === 'f' ? S.age : npcAge(p);
  let c = chance * (mom >= 45 ? 0 : mom >= 40 ? .25 : mom >= 35 ? .5 : mom >= 30 ? .8 : 1);
  if (alive().filter(x => x.kind === 'child').length >= 3) c *= .3;
  if (Math.random() >= c) return false;
  S.preg = { pid: p.id, due: null, mode: null };
  return true;
}
// 임신 소식: 배우자면 기뻐하고 내년에 출산(babyBorn), 아니면 선택지 이벤트(unexpectedPreg)
function tellPreg() {
  const g = S.preg, p = person(g.pid);
  g.due = S.age + 1;
  if (p && p.spouse) {
    g.mode = 'married';
    log(fill(S.gender === 'f' ? '임신 테스트기에 두 줄이 떴다. {p}에게 보여주자 한참 말을 잇지 못했다.' : '{p|이} 말없이 임신 테스트기를 내밀었다. 두 줄이었다.', { p: pname(p) }), { memory: true, deltas: applyEffect({ happy: 6 }) });
  } else if (p) { S.vars.fp = p.id; trigger('unexpectedPreg'); }
  else if (S.gender === 'f') { g.mode = 'alone'; log('임신이었다. 아이 아빠와는 연락이 닿지 않았다. 혼자 낳기로 했다.', { memory: true }); }
  else S.preg = null;   // 연락이 끊긴 상대 — 나는 끝내 알지 못함
}
function marry(p) {
  if (!p) return;
  p.partner = false; p.spouse = true;
  S.flags.married = true; S.flags.ownPlace = true;
  S.vars.marriedAt = S.age;
}

/* ═════════ 도우미 ═════════ */
const trait = () => D.traits.find(t => t.id === S.trait) || {};
const job = id => D.jobs.find(j => j.id === id);
const resolve = v => typeof v === 'function' ? v(S, api) : v;
const textOf = v => { v = resolve(v); return Array.isArray(v) ? pick(v) : v; };
const season = () => SEASONS[Math.max(0, S.seasonIdx)];

function fill(t, ctx = {}) {
  if (typeof t !== 'string') return '';
  return t.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (m, k, j) => {
    let v;
    if (k in ctx) v = ctx[k];
    else if (k === 'name') v = S.name;
    else if (k === 'fp') v = pname(person(S.vars.fp));
    else if (k === 'partner') v = pname(mainPartner());
    else if (k === 'hobbyLabel') v = (D.hobbies.find(h => h.id === S.hobby) || {}).label;
    else if (k === 'place') v = S.place ? PLACES[S.place].label : '';
    else v = S.vars[k];
    v = v == null ? '' : String(v);
    return j && v ? josa(v, j) : v;
  });
}

function log(text, opt = {}) {
  const t = opt.t || (opt.memory ? 'mem' : 'text');
  S.log.push({ n: ++S.seq, t, text, d: opt.deltas && opt.deltas.length ? opt.deltas : undefined });
  if (opt.memory) S.memories.push({ age: S.age, season: season().id, wx: S.weather, text });
  if (S.log.length > 800) S.log.splice(0, S.log.length - 800);
}

/* ═════════ 효과 ═════════ */
function applyEffect(eff) {
  eff = resolve(eff);
  if (!eff) return [];
  const tr = trait(), out = [];
  for (const k of Object.keys(eff)) {
    if (k === 'rel') { out.push(...applyRel(eff.rel)); continue; }
    let v = val(eff[k]);
    if (!v) continue;
    if (k === 'money') { S.money += v; out.push(['money', v]); continue; }
    if (!STATS.includes(k)) continue;
    if (v > 0 && tr.mult && tr.mult[k]) v = Math.round(v * tr.mult[k]);
    if (v < 0 && tr.negMult && tr.negMult[k]) v = Math.round(v * tr.negMult[k]);
    const b = S.stats[k];
    if (COND.includes(k)) {
      S.stats[k] = clamp(b + v, 0, 100);
    } else {
      if (v > 0) v = Math.max(1, Math.round(v * GR[gIdx(b)][2]));   // 등급이 높을수록 덜 오름
      S.stats[k] = Math.max(0, b + v);
    }
    if (S.stats[k] !== b) out.push([k, S.stats[k] - b]);
  }
  return out;
}
// 예전 형식 호환: rel: { family: 5, mom: -3 } → 해당 사람 친밀
function applyRel(map) {
  const out = [];
  for (const key of Object.keys(map)) {
    const targets = key === 'family' ? alive().filter(p => p.kind === 'family') : [person(key)].filter(Boolean);
    for (const p of targets) out.push(...applyP(p, { close: map[key] }));
  }
  return out;
}
function addKarma(v) { if (v) S.karma = clamp(S.karma + val(v), -100, 100); }

// 결과 적용 순서: 플래그 → 새 사람 → 함수 → 수치 → 문장
function applyOutcome(o, target) {
  if (!o) return;
  asList(o.set).forEach(f => { S.flags[f] = true; });
  asList(o.unset).forEach(f => { delete S.flags[f]; });
  if (o.meet) addPerson(resolve(o.meet));
  if (o.do) o.do(S, api);
  const deltas = applyEffect(o.effect);
  const tp = target || person(S.vars.fp);
  if (o.p && tp) deltas.push(...applyP(tp, resolve(o.p), o.mult));
  addKarma(o.karma);
  if (o.heat) S.heat = clamp(S.heat + val(o.heat), 0, 100);
  const text = o.text != null ? fill(textOf(o.text), target ? { p: pname(target) } : {}) : '';
  if (text) log(text, { memory: !!resolve(o.memory), deltas });
  else if (deltas.length) log('', { t: 'info', deltas });
  if (o.pregnant && tp) conceive(tp, resolve(o.pregnant));
  riskCheck(o, tp);
  if (o.then) { const t = resolve(o.then); if (t) trigger(t); }
}
// 얽힌 사이: 들키지 않으면 괜찮지만… (risk: 내 애인에게 / riskTaken: 상대 애인에게)
function riskCheck(o, p) {
  const risk = resolve(o.risk) || 0, rt = resolve(o.riskTaken) || 0;
  const m = mainPartner();
  if (risk && p && m && m !== p && Math.random() < risk + .05 * alive().filter(x => x.secret).length) {
    S.vars.mainId = m.id; S.vars.mainName = pname(m); S.vars.loverId = p.id; S.vars.lover = pname(p);
    trigger('affairCaught');
  } else if (rt && p && p.taken && Math.random() < rt) {
    S.vars.fp = p.id;
    trigger('rivalFound');
  }
}

/* ═════════ 조건 ═════════ */
function meets(r) {
  if (!r) return true;
  if (r.flags && !r.flags.every(f => S.flags[f])) return false;
  if (r.noFlags && r.noFlags.some(f => S.flags[f])) return false;
  if (r.gender && S.gender !== r.gender) return false;
  if (r.stats) for (const k in r.stats) if (S.stats[k] < r.stats[k]) return false;
  if (r.job === true && !S.job) return false;
  if (r.job === false && S.job) return false;
  if (r.person && !person(r.person)) return false;
  if (r.minMoney != null && S.money < r.minMoney) return false;
  return true;
}
function seasonOk(ev, sid) {
  if (ev.season) return ev.season.includes(sid);
  if (ev.at != null) return sid === '봄';
  return true;
}
function eligible(ev) {
  if (ev.once !== false && S.done[ev.id]) return false;
  if (ev.cooldown && S.last[ev.id] != null && S.age - S.last[ev.id] < ev.cooldown) return false;
  if (ev.at != null && S.age !== ev.at) return false;
  if (ev.age && (S.age < ev.age[0] || S.age > ev.age[1])) return false;
  if (!!ev.jail !== jailed() && ev.type !== 'must' && ev.type !== 'trigger') return false;
  if (!meets(ev.req)) return false;
  if (ev.when && !ev.when(S, api)) return false;
  return true;
}

/* ═════════ 이벤트 ═════════ */
function fire(ev) {
  S.done[ev.id] = (S.done[ev.id] || 0) + 1;
  S.last[ev.id] = S.age;
  if (ev.onStart) ev.onStart(S, api);
  if (ev.choices) {
    const raw = textOf(ev.text), text = fill(raw);
    const tv = {}; TRANSIENT.forEach(k => { tv[k] = S.vars[k]; });
    S.pending.push({ id: ev.id, text, tv, who: whoIn(raw) });
    log(text, { t: 'ask' });
  } else applyOutcome(ev);
}
// 이벤트 문장에 나오는 사람 (이벤트 창 위에 아바타로 보여줌)
function whoIn(raw) {
  if (typeof raw !== 'string') return null;
  if (/\{fp\b/.test(raw)) return S.vars.fp || null;
  if (/\{mainName\b/.test(raw)) return S.vars.mainId || null;
  if (/\{lover\b/.test(raw)) return S.vars.loverId || null;
  if (/\{partner\b/.test(raw)) { const m = mainPartner(); return m ? m.id : null; }
  if (/\{new\b/.test(raw)) return S.vars.newId || null;
  return null;
}
const trigger = id => fire(EVENTS[id]);
const choicesOf = ev => ev.choices.filter(c => !c.if || c.if(S, api));

function currentEvent() {
  const p = S.pending[0];
  if (!p) return null;
  const ev = EVENTS[p.id];
  if (!ev) { S.pending.shift(); return currentEvent(); }
  Object.assign(S.vars, p.tv);
  const wp = p.who && person(p.who);
  const who = wp ? { look: lookOf(wp), age: npcAge(wp), name: pname(wp), rel: relLabel(wp) } : null;
  return { text: p.text, who, choices: choicesOf(ev).map(c => fill(resolve(c.label))) };
}
function choose(i) {
  const p = S.pending[0];
  if (!p || S.ended) return;
  Object.assign(S.vars, p.tv);
  const ch = choicesOf(EVENTS[p.id])[i];
  if (!ch) return;
  S.pending.shift();
  log('▸ ' + fill(resolve(ch.label)), { t: 'pick' });
  let o = ch;
  if (ch.check) o = (S.stats[ch.check.stat] || 0) + rand(-15, 15) >= ch.check.diff ? ch.success : ch.fail;
  else if (ch.chance != null) o = Math.random() < resolve(ch.chance) ? ch.success : ch.fail;
  applyOutcome(o);
  tickSeason();
  after();
}

/* ═════════ 계절과 고정 이벤트 ═════════ */
function stage() { return jailed() ? 'jail' : S.age <= 12 ? 'child' : S.age <= 18 ? 'teen' : 'adult'; }
function flavorLine(sid) {
  const wl = D.weatherLines[S.weather];
  if (wl && !jailed() && Math.random() < .5) return pick(wl);
  return pick(D.seasonLines[sid][stage()]);
}
function enterSeason(i) {
  const se = SEASONS[i];
  S.seasonIdx = i;
  S.weather = weighted(Object.keys(se.weather), k => se.weather[k]);
  updateTime();
  S.log.push({ n: ++S.seq, t: 'season', season: se.id, icon: se.icon, wx: S.weather });
  if (se.months.includes(S.month)) birthday();
  schoolExam(se.id);
  if (S.preg && S.preg.due == null) tellPreg();

  // 반드시 터지는 것 (입학, 수능, 전역 등)
  const musts = D.events.filter(e => e.type === 'must' && seasonOk(e, se.id) && eligible(e));
  musts.forEach(e => { if (eligible(e)) fire(e); });
  if (!se.fixed || musts.length) return;

  // 고정 이벤트 한 개 (가끔은 일상 한 줄)
  const pool = D.events.filter(e => e.type === 'fixed' && seasonOk(e, se.id) && eligible(e));
  if (pool.length && Math.random() >= C.flavorChance) fire(weighted(pool));
  else log(flavorLine(se.id));
}
// 하루의 때: 계절 안에서 행동을 쓸수록 아침 → 낮 → 저녁 (계절의 마지막 행동은 늘 저녁)
function updateTime() {
  const i = Math.max(0, S.seasonIdx), se = SEASONS[i], next = SEASONS[i + 1];
  const len = (next ? next.at : C.apPerYear) - se.at;
  const k = clamp(S.used - se.at, 0, Math.max(0, len - 1));
  S.time = len <= 1 ? 1 : Math.min(2, Math.round(k * 2 / (len - 1)));
}
// 쓴 행동 수에 맞춰 계절을 넘김. 선택지 이벤트가 걸리면 거기서 멈춤
function tickSeason() {
  while (!S.pending.length && !S.ended) {
    const next = S.seasonIdx + 1;
    if (next < SEASONS.length && SEASONS[next].at <= S.used) enterSeason(next);
    else break;
  }
}
// 랜덤 이벤트: on에 행동 id나 장소 id를 적으면 그때만 (맞는 태그가 있으면 두 배로 잘 뽑힘)
function maybeRandom(tags, chance = C.randomEventChance) {
  if (S.pending.length || Math.random() >= chance) return;
  tags = asList(tags).filter(Boolean);
  const pool = D.events.filter(e => e.type === 'random' && (!e.on || e.on.some(t => tags.includes(t))) && eligible(e));
  if (pool.length) fire(weighted(pool, e => (e.weight ?? 1) * (e.on ? 2 : 1)));
}


/* ═════════ 생일 ═════════ */
function birthday() {
  const a = S.age, milestone = a > 0 && a % 10 === 0;
  if (a === 0) return;
  const m = mainPartner();
  const fr = alive().filter(p => !['family', 'child'].includes(p.kind) && p.close >= 50 && !p.partner && !p.spouse && !p.secret);
  let text, deltas = [];
  if (jailed()) text = `${a}번째 생일. 아무도 모르게 지나갔다.`;
  else if (a <= 12) text = `${a}번째 생일. 케이크 촛불을 ${a}개 불었다.`;
  else if (m) { text = `${a}번째 생일. ${josa(pname(m), '와')} 둘이 생일 저녁을 먹었다.`; deltas = applyP(m, { close: [2, 4] }); }
  else if (fr.length) { const f = pick(fr); text = `${a}번째 생일. ${josa(pname(f), '이')} 생일 선물을 챙겨줬다.`; deltas = applyP(f, { close: [2, 4] }); }
  else if (a >= 20) text = `${a}번째 생일. 혼자 미역국을 끓여 먹었다.`;
  else text = `${a}번째 생일. 엄마가 미역국을 끓여주셨다.`;
  log(text, { memory: milestone, deltas: deltas.concat(applyEffect({ happy: 2 })) });
}

/* ═════════ 학교 ═════════ */
const inSchool = () => S.age >= D.schoolStart && S.age <= 18 && !jailed();
const subjAvg = () => SUBJ.reduce((t, k) => t + S.school.subj[k], 0) / SUBJ.length;
function subjAdd(k, n) { S.school.subj[k] = clamp(S.school.subj[k] + n, 0, 100); }
function subjAll(n) { SUBJ.forEach(k => subjAdd(k, n)); }
function subjGain(k, base) {
  const cur = S.school.subj[k];
  const g = Math.max(1, Math.round(base * (1 + gIdx(S.stats.smart) * .1) * (1 - cur / 130)));
  subjAdd(k, g);
  return g;
}
function examGrades(bonus) {
  const g = {};
  SUBJ.forEach(k => { g[k] = scoreGrade(S.school.subj[k] + (bonus || 0) + rand(-10, 10)); });
  g.avg = SUBJ.reduce((t, k) => t + g[k], 0) / SUBJ.length;
  return g;
}
const gradeLine = g => D.subjects.map(x => `${x.label} ${g[x.id]}`).join(', ');
function schoolExam(sid) {
  if (!inSchool()) return;
  if (S.age >= 16 && (sid === '여름' || sid === '겨울')) {
    const sem = (S.age - 16) * 2 + (sid === '여름' ? 1 : 2);
    const g = examGrades(0);
    const v = Math.round((g.avg + rand(-3, 3) / 10) * 10) / 10;
    S.school.naesin.push(clamp(v, 1, 9));
    log(`${Math.ceil(sem / 2)}학년 ${sem % 2 ? 1 : 2}학기 내신 ${clamp(v, 1, 9).toFixed(1)}등급 (${gradeLine(g)})`, { t: 'info' });
  }
  if ((S.age === 17 && sid === '겨울') || (S.age === 18 && sid === '여름')) {
    const g = examGrades(0);
    S.school.mock = g;
    log(`모의고사: ${gradeLine(g)}. 평균 ${g.avg.toFixed(1)}등급.`, { t: 'info' });
  }
}
const naesinAvg = () => S.school.naesin.length ? S.school.naesin.reduce((a, b) => a + b, 0) / S.school.naesin.length : null;
function uniScore() {
  const sat = S.school.sat ? S.school.sat.avg : 9, n = naesinAvg();
  return n == null ? sat : sat * .7 + n * .3;
}
function takeSuneung(bonus) {
  const g = examGrades(bonus);
  S.school.sat = g;
  S.vars.satText = `수능 결과: ${gradeLine(g)}. 평균 ${g.avg.toFixed(1)}등급.`;
  S.vars.attempt = 1;
  S.vars.uniScore = uniScore();
}
function admitChance(t) {
  const d = uniScore() - t.need;
  return d <= 0 ? .9 : d <= .5 ? .45 : d <= 1 ? .15 : 0;
}
const reachable = t => admitChance(t) > 0;
function chanceText(t) { const c = admitChance(t); return c >= .8 ? '안정' : c >= .4 ? '적정' : '상향'; }
function admit(tid) {
  const t = D.univTiers.find(x => x.id === tid);
  S.school.tier = tid; S.school.start = S.age + 1; S.school.years = t.years;
  S.school.gpa = 0; S.school.gpaN = 0;
  S.flags.student = true; delete S.flags.retake;
}
function majorOk(m) {
  const t = D.univTiers.find(x => x.id === S.school.tier);
  if (!t) return false;
  if (t.college ? !(m.college || (m.tierMax || 0) >= 6) : (m.college || (m.tierMax || 0) < t.id)) return false;
  if (m.need) for (const k in m.need) if (S.school.subj[k] < m.need[k]) return false;
  if (m.needAb) for (const k in m.needAb) if (S.stats[k] < gradeMin(m.needAb[k])) return false;
  return true;
}
function setMajor(id) {
  const m = D.majors.find(x => x.id === id);
  S.school.major = id;
  if (m && m.years) S.school.years = m.years;
}
function graduate() {
  const t = D.univTiers.find(x => x.id === S.school.tier);
  S.school.degree = t && t.college ? 'associate' : 'bachelor';
  if (S.school.degree === 'bachelor') S.flags.degree = true;
  S.flags.anyDegree = true;
  delete S.flags.student;
}
const univLabel = () => { const t = D.univTiers.find(x => x.id === S.school.tier); return t ? t.label : null; };
const majorLabel = () => { const m = D.majors.find(x => x.id === S.school.major); return m ? m.label : null; };

/* ═════════ 형제 ═════════ */
function sibRole(sib, older, sg) {
  if (sib.id === 'twin') return '쌍둥이';
  if (older) return sg === 'm' ? (S.gender === 'm' ? '형' : '오빠') : (S.gender === 'm' ? '누나' : '언니');
  return sg === 'm' ? '남동생' : '여동생';
}
function addSibling() {
  const sib = D.siblings.find(x => x.id === S.sibling);
  if (!sib || sib.id === 'none') return null;
  const sg = sib.gender || (Math.random() < .5 ? 'm' : 'f');
  const diff = S.vars.sibGap ?? 0;
  const older = diff > 0;
  const p = addPerson({ kind: 'family', sibling: true, gender: sg, ageDiff: diff > 0 ? diff : -S.age, close: rand(55, 80), trust: rand(50, 75), taken: false });
  p.role = sibRole(sib, older, sg);
  return p;
}

/* ═════════ 범죄와 인과응보 ═════════ */
function arrest(sev, late) {
  S.vars.sev = sev + Math.floor(S.record / 2);
  S.vars.late = !!late;
  S.vars.lastSev = 0;
  trigger('arrest');
}
function goJail(years) {
  S.jail = years; S.flags.inJail = true;
  S.place = null; S.here = [];
  if (S.job) { log(`${job(S.job).label} 일자리를 잃었다.`, { t: 'info' }); S.job = null; S.salary = 0; }
  delete S.flags.student;
  const m = mainPartner(); if (m) applyP(m, { trust: -30, heart: -15 });
}
function sentence(mod) {
  const sev = Math.max(0, S.vars.sev + mod);
  const minor = S.age < 19;
  S.heat = Math.max(0, S.heat - 50);
  let text, deltas = [];
  if (sev <= 0) {
    text = minor ? '훈방 조치로 끝났다. 부모님이 경찰서로 오셨다.' : '기소유예로 끝났다. 운이 좋았다.';
    if (minor) deltas = applyRel({ family: -5 });
    log(text, { deltas });
    return;
  }
  S.record++;
  if (minor) {
    if (sev <= 2) { text = '보호관찰 처분을 받았다.'; deltas = applyEffect({ happy: -8 }).concat(applyRel({ family: -10 })); }
    else { text = '소년원에 가게 됐다.'; goJail(1); }
  } else if (sev === 1) {
    const fine = rand(10, 30) * 10;
    text = `벌금 ${fmtMoney(fine)}을 냈다.`; deltas = applyEffect({ money: -fine, happy: -4 });
  } else if (sev === 2) {
    text = '집행유예를 받았다. 한 번만 더 걸리면 끝이다.'; deltas = applyEffect({ happy: -6 });
  } else {
    const y = sev === 3 ? rand(1, 2) : sev === 4 ? rand(2, 4) : rand(4, 7);
    text = `징역 ${y}년을 선고받았다.`; goJail(y);
  }
  for (const p of alive().filter(x => x.kind === 'family' || x.spouse || x.partner)) deltas.push(...applyP(p, { trust: -12 }));
  log(text, { memory: S.record === 1 || S.jail > 0, deltas });
}
function escape(ok) {
  if (ok) { S.jail = 0; delete S.flags.inJail; S.flags.fugitive = true; S.heat = 90; }
  else { S.jail += 2; applyEffect({ health: -5, happy: -6 }); }
}
function crimeOdds(c) {
  let o = resolve(c.odds);
  if (trait().crimeBonus) o += trait().crimeBonus;
  return clamp(o, .05, .95);
}
function canCrime(c) {
  return !busy() && S.ap > 0 && !jailed() && S.age >= c.minAge && meets(c.req);
}
function commitCrime(id) {
  const c = D.crimes.find(x => x.id === id);
  if (!c || !canCrime(c)) return;
  spend();
  addKarma(c.karma);
  S.crimes++;
  const ok = Math.random() < crimeOdds(c);
  let deltas = [];
  const caughtMult = trait().crimeBonus ? .7 : 1;
  if (ok) {
    let g = c.gain ? rand(c.gain[0], c.gain[1]) : 0;
    if (S.age < 19 && g) g = Math.max(1, Math.round(g / 5));
    if (g) deltas = deltas.concat(applyEffect({ money: g }));
    if (c.effect) deltas = deltas.concat(applyEffect(c.effect));
    S.heat = clamp(S.heat + c.heat, 0, 100);
    S.vars.lastSev = Math.max(S.vars.lastSev || 0, c.severity);
    log(pick(c.ok), { deltas });
    if (Math.random() < c.caught * .5 * caughtMult) arrest(c.severity);
  } else {
    if (c.failEffect) deltas = deltas.concat(applyEffect(c.failEffect));
    log(pick(c.fail), { deltas });
    if (Math.random() < Math.min(.9, c.caught * 1.6 * caughtMult)) arrest(c.severity);
    else S.heat = clamp(S.heat + Math.round(c.heat / 2), 0, 100);
  }
  tickSeason();
  after();
}

/* ═════════ 1년 지나갈 때 ═════════ */
function yearly() {
  const st = S.stats, a = S.age, tr = trait();
  // 자라면서 저절로 조금씩
  if (a <= 18) { st.smart += rand(0, 2); st.fit += rand(0, 2); st.charm += rand(0, 1); }
  // 나이 들면서
  let aging = a >= 40 ? rand(1, 3) : a >= 30 ? rand(0, 2) : 0;
  aging = Math.max(0, Math.round(aging * (1 - gIdx(st.fit) * .08)));   // 체력이 좋으면 덜 깎임
  if (tr.agingMult) aging = Math.round(aging * tr.agingMult);
  if (jailed()) aging += 1;
  st.health = clamp(st.health - aging, 0, 100);
  if (a >= 35 && Math.random() < .4) st.looks = Math.max(0, st.looks - rand(1, 3));
  if (a >= 40 && Math.random() < .5) st.fit = Math.max(0, st.fit - rand(1, 3));
  if (st.happy > 65) st.happy--; else if (st.happy < 40) st.happy++;

  // 중학교 입학: 그동안 쌓은 지능이 과목 실력의 바탕
  if (a === D.schoolStart) SUBJ.forEach(k => { S.school.subj[k] = clamp(Math.round(st.smart / 2) + rand(5, 15), 0, 100); });
  // 학교: 안 쓰면 잊어버림 / 대학 학점
  if (a >= D.schoolStart + 1 && a <= 18) SUBJ.forEach(k => subjAdd(k, -rand(0, 1)));
  if (S.flags.student && S.school.start != null && a > S.school.start) {
    const y = clamp(1.8 + Math.min(S.school.studyYear, 6) * .3 + gIdx(st.smart) * .12 + rand(-3, 3) / 10, 1, 4.5);
    S.school.gpa = (S.school.gpa * S.school.gpaN + y) / (S.school.gpaN + 1);
    S.school.gpaN++;
  }
  S.school.studyYear = 0;
  // 어릴 때 용돈
  if (a >= 6 && a <= 18) { const w = D.wealth.find(x => x.id === S.wealth); if (w) S.money += rand(w.allowance[0], w.allowance[1]); }

  // 관계는 가만두면 멀어짐
  for (const p of alive()) {
    if (p.kind === 'family') { p.close = clamp(p.close - 1, 0, 100); continue; }
    if (p.kind === 'child') { p.close = clamp(p.close - 1, 0, 100); continue; }
    const mine = p.partner || p.spouse || p.secret;
    p.close = clamp(p.close - (mine ? 2 : 3), 0, 100);
    p.heart = clamp(p.heart - (mine ? 3 : 2), 0, 100);
    p.grudge = clamp(p.grudge - 3, 0, 100);
    if (!mine && npcAge(p) >= 24 && Math.random() < .05) p.taken = !p.taken;
    if (!mine && !p.debt && p.close <= 0 && p.grudge <= 0) { p.gone = true; log(`${josa(pname(p), '와')}는 연락이 끊겼다.`, { t: 'info' }); }
  }

  // 일: 연봉, 성과, 승진
  if (S.job && !jailed()) {
    const j = job(S.job);
    S.money += j.volatile ? rand(Math.round(S.salary * .2), S.salary * 2) : S.salary;
    if (j.happy) applyEffect({ happy: j.happy });
    if (S.rank < j.ranks.length - 1 && Math.random() < .04 + S.perf / 220) {
      S.rank++; S.perf = Math.max(0, S.perf - 35);
      S.salary = Math.round(j.salary * (1 + .25 * S.rank) / 10) * 10;
      log(`${j.ranks[S.rank]}${josa(j.ranks[S.rank], '으로').slice(j.ranks[S.rank].length)} 승진했다! 연봉 ${fmtMoney(S.salary)}.`, { memory: true });
    } else S.salary = Math.round(S.salary * 1.02);
    S.perf = clamp(S.perf - 8, 0, 100);
  }
  // 어른 NPC 직업 붙이기, 나이에 안 맞게 된 단골 장소 바꾸기
  for (const p of alive()) {
    if (!p.npcJob && npcAge(p) >= 23 && p.kind !== 'family') p.npcJob = pick(D.npcJobs);
    if (p.hangout && !ageFits(PLACES[p.hangout], npcAge(p))) p.hangout = pickHangout(p.hobby, npcAge(p));
  }
  if (a >= 20 && !S.flags.student && !S.flags.inArmy && !jailed()) {
    const kids = alive().filter(p => p.kind === 'child').length;
    S.money -= C.livingCost + (S.flags.married ? 600 : 0) + kids * 400;   // 가족이 늘면 생활비도 늘어남
  }
  if (S.money < 0 && a >= 20) log('통장 잔고가 마이너스다.', { deltas: applyEffect({ happy: -4 }) });

  // 수감
  if (jailed()) {
    S.jail--;
    if (S.jail === 0) { delete S.flags.inJail; S.flags.exCon = true; log('출소했다. 바깥 공기가 낯설다.', { memory: true }); }
  }

  // 인과응보: 쌓인 수사망은 늦게라도 돌아옴
  if (S.heat > 0 && !jailed()) {
    if (Math.random() < S.heat / 250 + (S.flags.fugitive ? .25 : 0)) { delete S.flags.fugitive; arrest(Math.max(1, S.vars.lastSev || 2), true); }
    S.heat = Math.round(S.heat * .8);
  }
  // 업보: 나쁜 짓은 다른 모양으로도 돌아옴
  const k = S.karma;
  if ((k <= -25 && Math.random() < .4) || (k >= 25 && Math.random() < .25)) {
    const sign = k < 0 ? -1 : 1;
    const pool = D.events.filter(e => e.type === 'karma' && e.sign === sign && eligible(e));
    if (pool.length) fire(pick(pool));
  }
  S.karma += S.karma > 0 ? -1 : S.karma < 0 ? 1 : 0;
}

function after() {
  if (!S.ended) {
    if (S.stats.health <= 0) { S.ended = 'death'; S.pending = []; }
    else if (S.age >= C.endAge && !S.pending.length) S.ended = 'fifty';
  }
  save(); emit();
}
function advanceYear() {
  S.age++;
  S.ap = C.apPerYear; S.used = 0; S.seasonIdx = -1;
  S.place = null; S.here = [];
  S.log.push({ n: ++S.seq, t: 'year', age: S.age });
  yearly();
  if (S.age >= C.endAge) return;
  tickSeason();
}
// 남은 행동은 쉬면서 보내고(계절 이벤트는 그대로 터짐) 1살 먹기
function ageUp() {
  if (S.ended || S.pending.length) return;
  let rested = 0;
  while (S.ap > 0 && !S.pending.length) { spend(); rested++; tickSeason(); }
  if (rested) log('남은 시간은 쉬면서 보냈다.', { t: 'info', deltas: applyEffect({ health: rested >= 4 ? 1 : 0, happy: rested >= 4 ? 1 : 0 }) });
  if (S.ap === 0 && !S.pending.length) advanceYear();
  after();
}

/* ═════════ 행동 ═════════ */
const busy = () => !!S.ended || S.pending.length > 0;
function spend() { S.ap--; S.used++; updateTime(); }
const costOf = a => a.cost && S.age >= 18 ? a.cost : 0;
// 지금 있는 장소에서 할 수 있는 행동 (수감 중엔 교도소 행동)
function actionList() {
  if (jailed()) return D.jailActions;
  const pl = PLACES[S.place];
  if (!pl) return [];
  return pl.actions.map(id => ACTIONS[id]).filter(a => a && S.age >= a.minAge && meets(a.req) && !(a.id === 'parttime' && S.flags.inArmy));
}
function canDo(a) { return !busy() && S.ap > 0 && (!costOf(a) || S.money >= costOf(a)); }
const needsSubject = a => a.id === 'study' && inSchool();
function doAction(id, subj) {
  const a = actionList().find(x => x.id === id);
  if (!a || !canDo(a)) return;
  spend();
  if (a.id === 'study') {
    const deltas = applyEffect(a.effect);
    if (inSchool()) {
      const list = subj && SUBJ.includes(subj) ? [subj] : SUBJ;
      const per = list.length > 1 ? 3 : 7;
      list.forEach(k => { const g = subjGain(k, rand(per - 1, per + 1)); deltas.push([D.subjects.find(x => x.id === k).label, g]); });
    }
    if (S.flags.student) S.school.studyYear++;
    log(fill(textOf(a.text)), { deltas });
    maybeRandom([a.id, S.place]); tickSeason(); after(); return;
  }
  if (a.work) S.perf = clamp(S.perf + val(a.perf || [6, 12]) + gIdx(S.stats.smart), 0, 100);
  if (a.escape) {
    const ok = S.stats.health + S.stats.smart + rand(-30, 30) >= 120;
    if (ok) { escape(true); log('한밤중에 담을 넘었다. 이제 쫓기는 몸이다.', { memory: true }); addKarma(-10); }
    else { escape(false); log('탈옥하다 붙잡혔다. 형기가 2년 늘었다.'); }
    tickSeason(); after(); return;
  }
  const deltas = applyEffect(a.effect);
  const c = costOf(a);
  if (c) deltas.push(...applyEffect({ money: -c }));
  if (a.subjAll && inSchool()) SUBJ.forEach(k => { const g = subjGain(k, val(a.subjAll)); deltas.push([D.subjects.find(x => x.id === k).label, g]); });
  addKarma(a.karma);
  log(fill(textOf(a.text)), { deltas, memory: a.memoryChance ? Math.random() < a.memoryChance : false });
  maybeRandom([a.id, S.place]);
  tickSeason();
  after();
}

/* ═════════ 장소 ═════════ */
const ageFits = (pl, age) => !!pl && age >= (pl.minAge || 0) && (pl.maxAge == null || age <= pl.maxAge);
function pickHangout(hobby, age) {
  if (age < 13) return Math.random() < .6 ? (age >= 4 ? pick(['playground', 'park']) : null) : null;
  const list = (D.hangoutByHobby[hobby] || []).filter(id => ageFits(PLACES[id], age) && !PLACES[id].night);
  return list.length && Math.random() < .75 ? pick(list) : null;
}
function placeOpen(pl) {
  if (jailed() || !ageFits(pl, S.age)) return false;
  if (pl.night && S.time !== 2) return false;
  return !pl.open || !!pl.open(S, api);
}
function closedWhy(pl) {
  if (pl.night && S.time !== 2) return '저녁에만';
  if (pl.open && !pl.open(S, api)) return pl.closed || '지금은 못 감';
  return '';
}
// 장소 목록 (나이에 맞는 곳만). ok: 지금 갈 수 있는지
function placeList() {
  if (jailed()) return [];
  return D.places.filter(pl => ageFits(pl, S.age)).map(pl => ({
    id: pl.id, label: pl.label, icon: pl.icon, why: closedWhy(pl), regular: !!S.regular[pl.id],
    ok: !busy() && S.ap > 0 && placeOpen(pl),
  }));
}
// 처음 보는 사람의 나이대
function crowdRange(type) {
  const a = S.age;
  if (type === 'kid') return [Math.max(4, a - 2), Math.min(12, a + 2)];
  if (type === 'peer') return a < 19 ? [Math.max(4, a - 1), a + 1] : [Math.max(19, a - 5), a + 6];
  if (type === 'adult') return a < 19 ? [22, 50] : [Math.max(19, a - 8), Math.min(65, a + 12)];
  const r = Math.random();   // mixed: 또래, 어른, 아무나
  if (a < 13) return r < .6 ? crowdRange('kid') : [30, 75];
  return r < .4 ? crowdRange('peer') : r < .7 ? [Math.max(30, a + 15), Math.max(60, a + 40)] : [Math.max(8, a - 12), a + 12];
}
function makeStranger(pl, night) {
  let type = (night && pl.nightCrowd) || pl.crowd;
  if (Array.isArray(type)) type = pick(type);
  const p = makePerson({
    kind: pl.kind || 'friend', ageRange: crowdRange(type), hangout: pl.id,
    hobby: pl.hobby && Math.random() < .6 ? pl.hobby : undefined,
    close: rand(4, 10), trust: rand(4, 10),
  });
  p.id = 'x' + (++S.xseq);
  p.stranger = true;
  lookOf(p);
  return p;
}
function doingFor(pl, p, night, taken) {
  let list = (night && pl.nightDoing) || pl.doing;
  if (typeof list === 'function') list = list(S, p, api);
  const fresh = list.filter(t => !taken.includes(t));
  return pick(fresh.length ? fresh : list);
}
// 장소에 도착하면: 아는 사람 몇 명(단골이면 더 잘 나옴) + 처음 보는 사람 0~n명
function fillHere(pl, bring, night) {
  const here = [], taken = [];
  const add = (p, x) => { const d = doingFor(pl, p, night, taken); taken.push(d); here.push({ key: p.id, x: x ? p : undefined, doing: d, used: false }); };
  if (bring) add(bring);
  const kinds = pl.regulars || [];
  const base = typeof kinds === 'function' ? kinds(S, api) : alive().filter(p => kinds.includes(p.kind));
  const cands = [...new Set(base.concat(alive().filter(p => p.hangout === pl.id)))]
    .filter(p => p !== bring && ageFits(pl, npcAge(p)) && (typeof kinds === 'function' || p.kind !== 'child'));
  const pool = cands.map(p => ({ p, w: p.hangout === pl.id ? 4 : 1 }));
  const [lo, hi] = pl.regularsN || [1, 2];
  for (let n = rand(lo, hi); n > 0 && pool.length; n--) { const x = weighted(pool, y => y.w); pool.splice(pool.indexOf(x), 1); add(x.p); }
  if (pl.crowd) { const [clo, chi] = pl.crowdN || [0, 2]; for (let n = rand(clo, chi); n > 0; n--) add(makeStranger(pl, night), true); }
  return here;
}
function enterPlace(pl, bring, night = S.time === 2) {
  S.place = pl.id; S.placeNight = night;
  S.here = fillHere(pl, bring, night);
  S.vars.placeLabel = pl.label;
}
// 장소에 가기 (행동 1). 거기 있는 사람에겐 행동 없이 한 번씩 말을 걸 수 있음
function goPlace(id) {
  const pl = PLACES[id];
  if (!pl || busy() || S.ap <= 0 || !placeOpen(pl)) return;
  const night = S.time === 2;   // 사람은 도착한 때(행동 쓰기 전) 기준으로 채움
  spend();
  enterPlace(pl, null, night);
  log(`${pl.icon} ` + fill(textOf(pl.arrive) || `${josa(pl.label, '으로')} 갔다.`), { t: 'place' });
  if (!pl.routine) {
    S.visits[id] = (S.visits[id] || 0) + 1;
    if (S.visits[id] >= D.regularVisits && !S.regular[id]) { S.regular[id] = true; log(`이제 ${pl.label} 단골이다. 얼굴을 알아보는 사람이 생겼다.`, { t: 'info' }); }
  }
  maybeRandom([id], C.placeEventChance);
  tickSeason();
  after();
}
function leavePlace() {
  if (!S.place || S.ended) return;
  S.place = null; S.here = [];
  save(); emit();
}
// 여기 있는 사람들 (화면용)
function hereList() {
  if (!S.place) return [];
  return S.here.map(h => ({ key: h.key, stranger: !!h.x, p: h.x || person(h.key), doing: h.doing, used: h.used })).filter(h => h.p);
}
const hereEntry = pid => S.place ? S.here.find(h => h.key === pid && !h.x) : null;
// 처음 보는 사람에게 말 걸기 (행동 안 씀). 잘 되면 관계 목록에 들어감
function talkTo(key) {
  const h = S.place && S.here.find(x => x.key === key && x.x);
  if (!h || h.used || busy()) return null;
  h.used = true;
  const x = h.x, pt = personality(x);
  const odds = clamp(.45 + gIdx(S.stats.charm) * .05 + gIdx(S.stats.looks) * .03 + (pt.open || 0) + (x.hobby === S.hobby ? .1 : 0) + (trait().relMult ? .1 : 0), .15, .95);
  if (Math.random() >= odds) {
    log(fill('처음 보는 사람에게 말을 걸었다. ' + pt.snub), { deltas: applyEffect({ happy: -1 }) });
    after();
    return null;
  }
  delete h.x;
  const p = enlist(x);
  h.key = p.id;
  const deltas = applyP(p, { close: [6, 12], trust: [3, 7], heart: [0, 3] });
  const hello = S.age < 13 ? pick(D.kidHello) : pt.hello;
  log('처음 보는 사람에게 말을 걸었다. ' + fill(hello, { p: pname(p) }), { deltas });
  after();
  return p.id;
}

/* ═════════ 사람과 상호작용 ═════════ */
// 관계 창에서는 행동 1. 지금 장소에 같이 있는 사람이면 한 번은 행동 없이 (noFree면 늘 행동 1)
const socialCost = (it, p) => it.cost ? (resolve(it.cost) || 0) : 0;
function interactions(pid) {
  const p = person(pid);
  if (!p) return [];
  const h = hereEntry(pid), here = !!h && !h.used;
  return D.social.filter(it => it.if(S, p, api)).map(it => {
    const cost = socialCost(it, p), free = here && !it.noFree;
    return { id: it.id, label: it.label, icon: it.icon, cost, free, ok: !busy() && (free || S.ap > 0) && (!cost || S.money >= cost) };
  });
}
function interact(pid, iid) {
  const p = person(pid), it = D.social.find(x => x.id === iid);
  if (!p || !it || !it.if(S, p, api)) return;
  const cost = socialCost(it, p);
  const h = hereEntry(pid), free = !!h && !h.used && !it.noFree;
  if (busy() || (!free && S.ap <= 0) || (cost && S.money < cost)) return;
  if (!free) spend();
  if (h) h.used = true;
  const o = it.run(S, p, api) || {};
  const pm = personality(p).mod[iid] || 1, mm = personality(S).mod[iid] || 1;
  const hm = sharedHobby(p) && (iid === 'hang' || iid === 'gift') ? 1.3 : 1;
  const vm = p.value === S.value ? 1.2 : valueClash(p) ? .8 : 1;
  o.mult = { close: pm * mm * hm, trust: pm * mm * vm, heart: pm * mm * vm, grudge: (personality(p).mod.argue || 1) * (valueClash(p) ? 1.3 : 1) };
  if (cost) { const eff = Object.assign({}, resolve(o.effect)); eff.money = val(eff.money) - cost; o.effect = eff; }
  S.vars.fp = p.id;
  applyOutcome(o, p);
  // 다른 장소로 같이 이동 (예: 술집에서 집으로)
  if (o.moveTo && PLACES[o.moveTo] && !jailed()) { enterPlace(PLACES[o.moveTo], p.gone ? null : p); }
  tickSeason();
  after();
}

/* ═════════ 직업 ═════════ */
// 조건 하나하나를 [통과 여부, 설명]으로 돌려줌 (화면에서 빨강/초록 표시용)
function jobChecks(j) {
  const r = j.req || {}, out = [];
  if (r.degree === true) out.push([S.school.degree === 'bachelor', '4년제 졸업']);
  if (r.degree === 'any') out.push([!!S.school.degree, '대학 졸업']);
  if (r.tier) out.push([S.school.degree === 'bachelor' && S.school.tier <= r.tier, `${D.univTiers[r.tier - 1].label} 이상`]);
  if (r.major) out.push([r.major.includes(S.school.major), `${r.major.map(m => (D.majors.find(x => x.id === m) || {}).label || m).join('/')} 전공`]);
  if (r.gpa) out.push([S.school.gpa >= r.gpa, `학점 ${r.gpa}+`]);
  for (const k of ABIL) if (r[k]) out.push([S.stats[k] >= gradeMin(r[k]), `${LABEL[k]} ${r[k]}+`]);
  if (j.clean) out.push([S.record === 0, '전과 없음']);
  return out;
}
const meetsJob = j => jobChecks(j).every(c => c[0]);
const canJobHunt = () => !busy() && S.ap > 0 && S.age >= 19 && !S.flags.student && !S.flags.inArmy && !jailed() && !S.job;
const jobInfo = () => D.jobs.map(j => Object.assign({}, j, { ok: meetsJob(j), checks: jobChecks(j) }));
function jobOdds(j) {
  let o = j.odds ?? .7;
  if (j.major && j.major.includes(S.school.major)) o += .15;   // 관련 전공이면 유리
  if (S.record) o *= .5;
  return clamp(o, .05, .95);
}
function hire(j) {
  S.job = j.id; S.rank = 0; S.perf = 30; S.salary = j.salary;
  log(`${j.label} 자리에 합격했다!`, { memory: !S.flags.firstJob, deltas: applyEffect({ happy: 6 }) });
  S.flags.firstJob = true;
  const dr = D.dreams.find(d => d.id === S.dream);
  if (dr && dr.job === j.id && !S.flags.dreamDone) { S.flags.dreamDone = true; log(`어릴 적 꿈이 이뤄졌다. ${dr.label}.`, { memory: true, deltas: applyEffect({ happy: 10 }) }); }
  addPerson({ kind: 'coworker', ageRange: [Math.max(20, S.age - 6), S.age + 10] });
}
function applyJob(id) {
  const j = job(id);
  if (!j || !canJobHunt()) return;
  spend();
  if (meetsJob(j) && Math.random() < jobOdds(j)) hire(j);
  else log(S.record && Math.random() < .5 ? `${j.label} 면접에서 전과 이야기가 나왔다. 떨어졌다.` : `${j.label} 면접에서 떨어졌다.`, { deltas: applyEffect({ happy: -3 }) });
  tickSeason();
  after();
}
function tryJob() {
  const ok = D.jobs.filter(meetsJob).sort((a, b) => b.salary - a.salary);
  for (const j of ok) if (Math.random() < jobOdds(j)) { hire(j); return true; }
  return false;
}
function loseJob() { S.job = null; S.salary = 0; S.rank = 0; S.perf = 0; delete S.flags.owner; }
function quitJob() {
  if (!S.job || busy()) return;
  const j = job(S.job);
  loseJob();
  log(`${j.label} 일을 그만뒀다.`, { deltas: applyEffect({ happy: 2 }) });
  after();
}
function jobTitle() {
  if (!S.job) return null;
  const j = job(S.job), r = j.ranks[S.rank];
  return (S.flags.owner ? '사장님 ' : '') + j.label + (S.rank > 0 ? ' ' + r : '');
}

function roleText() {
  const a = S.age;
  if (jailed()) return `수감 중 (${S.jail}년 남음)`;
  if (S.flags.inArmy) return '군인';
  if (S.job) return jobTitle();
  if (S.flags.student) return univLabel() ? `${univLabel()} ${majorLabel() || ''}`.trim() : '대학생';
  if (a <= 1) return '아기';
  if (a <= 6) return '어린이';
  if (a <= 12) return '초등학생';
  if (a <= 15) return '중학생';
  if (a <= 18) return '고등학생';
  return a < 30 ? '취준생' : '무직';
}
function karmaLabel() { const k = S.karma; return k >= 30 ? '맑음' : k >= -10 ? '보통' : k >= -40 ? '얼룩짐' : '어두움'; }

/* ═════════ 사람 정보 ═════════ */
const personality = x => D.personalities.find(t => t.id === x.personality) || D.personalities[0];
const sharedHobby = p => p.hobby === S.hobby ? D.hobbies.find(h => h.id === p.hobby) : null;
const valueClash = p => D.valueClash.some(([a, b]) => (a === p.value && b === S.value) || (b === p.value && a === S.value));
const valueLabel = id => (D.values.find(v => v.id === id) || {}).label || '';
function known(p, field) {
  if (p.kind === 'family' || p.kind === 'child') return true;
  return Math.max(p.close, p.trust) >= (D.revealAt[field] || 0);
}
function profile(p) {
  const L = (list, id) => (list.find(x => x.id === id) || {}).label;
  const age = npcAge(p);
  const f = (field, label, value) => ({ field, label, value: known(p, field) ? value : null });
  return [
    { field: 'feature', label: '특징', value: p.feature },
    f('personality', '성격', L(D.personalities, p.personality)),
    f('hobby', '취미', L(D.hobbies, p.hobby)),
    f('dream', age >= 23 ? '직업' : '꿈', age >= 23 ? (p.npcJob || '—') : L(D.dreams, p.dream)),
    f('value', '가치관', L(D.values, p.value)),
    f('wealth', '집안', L(D.wealth, p.wealth)),
  ];
}
function myProfile() {
  const L = (list, id) => (list.find(x => x.id === id) || {}).label;
  return [
    ['소질', trait().label], ['성격', L(D.personalities, S.personality)], ['취미', L(D.hobbies, S.hobby)],
    ['가치관', L(D.values, S.value)], ['집안', L(D.wealth, S.wealth)], ['꿈', L(D.dreams, S.dream) + (S.flags.dreamDone ? ' (이룸)' : '')],
    ['형제', L(D.siblings, S.sibling)], ['생일', `${S.month}월`],
  ];
}

/* ═════════ 데이터에서 쓰는 도구 ═════════ */
const api = {
  rand, pick, josa, money: fmtMoney,
  givenName: g => pick(g === 'm' ? D.namesM : g === 'f' ? D.namesF : D.namesM.concat(D.namesF)),
  meet: spec => addPerson(spec),
  person, npcAge, canRomance, heartOk, jailed,
  place: () => S.place, isHere: p => !!p && !!S.place && S.here.some(h => h.key === p.id),
  here: () => S.here.filter(h => !h.x).map(h => person(h.key)).filter(Boolean),
  regular: id => !!S.regular[id],
  find: fn => alive().filter(p => p.kind !== undefined && fn(p)),
  main: mainPartner,
  focus: p => { S.vars.fp = p ? p.id : null; },
  focused: () => person(S.vars.fp),
  changeP: (p, d) => applyP(p, d),
  startRelation, marry, breakUp, divorce, endMain, night, conceive,
  sentence, escape, tryJob, loseJob,
  perf: n => { S.perf = clamp(S.perf + n, 0, 100); },
  personality, sharedHobby, valueClash, valueLabel,
  subjAvg, subjAll, subjAdd, takeSuneung, admitChance, reachable, chanceText, admit, majorOk, setMajor, graduate,
  addSibling,
};

/* ═════════ 새 인생 / 저장 ═════════ */
const labelOf = (list, id) => (list.find(x => x.id === id) || {}).label || '';
function newLife(opt = {}) {
  const gender = opt.gender === 'm' || opt.gender === 'f' ? opt.gender : (Math.random() < .5 ? 'm' : 'f');
  const tr = D.traits.find(t => t.id === opt.trait) || pick(D.traits);
  const name = (opt.name || '').trim().slice(0, 6) || pick(D.surnames) + pick(gender === 'm' ? D.namesM : D.namesF);
  const sib = D.siblings.find(x => x.id === opt.sibling) || (Math.random() < .35 ? D.siblings[0] : pick(D.siblings.slice(1)));
  S = {
    v: 4, id: Date.now(), seq: 0, pseq: 0, xseq: 0,
    name, gender, age: 0, money: 0, ap: C.apPerYear, used: 0, seasonIdx: -1, trait: tr.id,
    personality: opt.personality || pick(D.personalities).id,
    hobby: opt.hobby || pick(D.hobbies).id,
    value: opt.value || pick(D.values).id,
    wealth: opt.wealth || weighted(D.wealth).id,
    dream: opt.dream || pick(D.dreams).id,
    sibling: sib.id,
    month: clamp(+opt.month || rand(1, 12), 1, 12),
    stats: { happy: rand(60, 80), health: rand(65, 90), smart: rand(5, 20), fit: rand(5, 20), looks: rand(5, 25), charm: rand(5, 20), art: rand(5, 20), craft: rand(5, 20) },
    school: { subj: { kor: 0, math: 0, eng: 0, sci: 0 }, naesin: [], mock: null, sat: null, tier: null, major: null, start: null, years: null, gpa: 0, gpaN: 0, studyYear: 0, degree: null },
    karma: 0, heat: 0, record: 0, crimes: 0, jail: 0, rank: 0, perf: 0, preg: null,
    flags: {}, vars: {}, done: {}, last: {},
    people: [], job: null, salary: 0, log: [], memories: [], pending: [], ended: null,
    weather: 'sunny', time: 0,
    place: null, here: [], visits: {}, regular: {},
  };
  if (tr.start) for (const k in tr.start) S.stats[k] = COND.includes(k) ? clamp(S.stats[k] + tr.start[k], 0, 100) : S.stats[k] + tr.start[k];
  S.look = window.Avatar ? Avatar.make(`${S.id}:me`, gender) : null;
  S.skin = S.look ? S.look.skin : 1;
  const w = D.wealth.find(x => x.id === S.wealth);
  S.money = w.money;
  const dr = D.dreams.find(x => x.id === S.dream);
  S.vars.dreamLabel = dr.label;
  S.vars.dreamSpeech = dr.id === 'family' ? '행복한 가정을 꾸리고 싶어요!' : `${josa(dr.label, '이')} 되고 싶어요!`;

  const mom = addPerson({ kind: 'family', role: '엄마', gender: 'f', ageDiff: rand(26, 36), close: rand(65, 90), trust: rand(60, 85), taken: true, wealth: S.wealth });
  const dad = addPerson({ kind: 'family', role: '아빠', gender: 'm', ageDiff: rand(27, 38), close: rand(55, 85), trust: rand(55, 80), taken: true, wealth: S.wealth });
  mom.id = 'mom'; mom.name = null; dad.id = 'dad'; dad.name = null;
  if (sib.id !== 'none') {
    S.vars.sibGap = rand(sib.gap[0], sib.gap[1]);
    if (S.vars.sibGap >= 0) addSibling();
  }

  S.log.push({ n: ++S.seq, t: 'year', age: 0 });
  log(`${josa(S.name, '이')} ${S.month}월에 세상에 태어났다.`, { memory: true });
  log(`소질 ${tr.label}, 성격 ${labelOf(D.personalities, S.personality)}, 집안 ${labelOf(D.wealth, S.wealth)}, 형제 ${sib.label}, 꿈 ${dr.label}.`, { t: 'info' });
  tickSeason();
  S.memories[0].wx = S.weather; S.memories[0].season = season().id;
  after();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경이면 넘어감 */ } }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.v === 4) return s;
    const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
    return old && old.v === 3 ? migrate(old) : null;
  } catch (e) { return null; }
}
// v3 저장 → v4 (장소, 단골 장소)
function migrate(s) {
  S = s;
  Object.assign(s, { v: 4, xseq: 0, place: null, here: [], visits: {}, regular: {} });
  s.look = window.Avatar ? Avatar.make(`${s.id}:me`, s.gender) : null;
  s.skin = s.look ? s.look.skin : 1;
  for (const p of s.people) if (p.hangout === undefined) p.hangout = pickHangout(p.hobby, npcAge(p));
  return s;
}
function init() { S = load(); if (S) { emit(); return true; } return false; }

window.Game = {
  init, subscribe: f => subs.push(f), state: () => S,
  newLife, ageUp, choose, currentEvent,
  actionList, canDo, costOf, doAction, needsSubject,
  places: placeList, goPlace, leavePlace, here: hereList, talkTo, place: () => PLACES[S.place] || null, timeLabel: () => TIMES[S.time] || '', jailed,
  people: () => alive(), person, interactions, interact, look: lookOf, myLook: () => S.look, relLabel, npcAge, canRomance, heartOk, pname, profile, myProfile,
  crimes: () => D.crimes.filter(c => S.age >= c.minAge && meets(c.req)), canCrime, crimeOdds, commitCrime,
  jobInfo, canJobHunt, applyJob, quitJob, jobTitle,
  roleText, karmaLabel, trait, job, mainPartner, season, fmtMoney, josa,
  gradeInfo, abilities: ABIL, conds: COND, subjects: D.subjects, naesinAvg, univLabel, majorLabel,
  creation: { traits: D.traits, personalities: D.personalities, wealth: D.wealth, hobbies: D.hobbies, values: D.values, dreams: D.dreams, siblings: D.siblings },
  LABEL, config: C, seasons: SEASONS,
  // 개발·테스트용 (브라우저 콘솔이나 헤드리스 검사에서 이벤트를 직접 터뜨려볼 때)
  dev: { fire: id => { fire(EVENTS[id]); tickSeason(); after(); }, eligible: id => eligible(EVENTS[id]), meet: spec => addPerson(spec), api },
};
})();
