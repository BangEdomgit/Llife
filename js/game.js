// 게임 엔진 — 화면(DOM)은 모르고 상태만 다룸. 화면은 js/main.js가 그림
(function () {
'use strict';

const D = window.GAME_DATA;
const C = D.config;
const SEASONS = C.seasons;
// 저장: 칸 3개 (llife-save-v6-1~3), 지금 쓰는 칸은 llife-slot. 예전 v5 저장은 1번 칸으로 옮겨 읽음
const SLOT_KEY = 'llife-slot', slotKey = n => `llife-save-v6-${n}`, SLOTS_N = 3;
const SAVE_KEY = 'llife-save-v5';
const OLD_KEYS = ['llife-save-v4', 'llife-save-v3'];
let slot = 1;
try { slot = Math.max(1, Math.min(SLOTS_N, Math.round(+localStorage.getItem(SLOT_KEY)) || 1)); } catch (e) { /* 저장 불가 */ }   // clamp는 아래에 있어서 여기선 못 씀
const COND = ['happy', 'health', 'libido'];   // 상태: 0~100. 성욕은 대상마다 따로(S.lust) — stats.libido는 그중 가장 높은 값(화면·조건용)
const ABIL = D.abilities;                     // 능력: 상한 없음, 등급
const STATS = COND.concat(ABIL);
const PSTATS = ['close', 'trust', 'heart', 'grudge'];
const LABEL = Object.assign({}, D.statLabel, { close: '친밀', trust: '신뢰', heart: '설렘', grudge: '원한', sat: '만족감' });
const GR = D.grades;
const SUBJ = D.subjects.map(x => x.id);   // 모든 과목 id (지금 듣는 과목은 subjectsNow)
const KIND_LABEL = { classmate: '같은 반', friend: '친구', coworker: '동료', rival: '앙숙', child: '아이', family: '가족', neighbor: '이웃' };
const EVENTS = Object.fromEntries(D.events.concat(D.classEvents || []).map(e => [e.id, e]));   // 수업 이벤트도 id로 찾음 (뽑는 건 classTurn만)
const PLACES = Object.fromEntries(D.places.map(p => [p.id, p]));
const ACTIONS = Object.fromEntries(D.actions.map(a => [a.id, a]));
const TIMES = ['아침', '낮', '저녁'];
const TRANSIENT = ['classSubj', 'fp', 'sev', 'late', 'mainId', 'mainName', 'loverId', 'lover', 'debt', 'new', 'newId', 'attempt', 'uniScore', 'signal', 'fline', 'myValue', 'theirValue', 'satText', 'placeLabel'];

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
const LETTERS = GR.map(g => g[0]);
const pickKey = obj => weighted(Object.keys(obj), k => obj[k]);
// 등급 글자 → 그 등급 안의 아무 값
function gradeValue(letter) {
  const i = Math.max(0, LETTERS.indexOf(letter)), lo = GR[i][1], hi = GR[i + 1] ? GR[i + 1][1] : lo + 60;
  return rand(lo, hi - 1);
}
// 한 등급 위/아래로 (등급 안에서의 위치는 유지). cap: 최고 등급 번호
function gradeStep(v, dir, cap = LETTERS.length - 1) {
  const g = gradeInfo(v), i = clamp(g.idx + dir, 0, cap);
  const lo = GR[i][1], hi = GR[i + 1] ? GR[i + 1][1] : lo + 60;
  return Math.round(lo + g.pct * (hi - lo - 1));
}

let S = null;
let held = null;   // 피임을 묻는 동안 잠시 멈춘 밤 { o, target, pid } — 저장하지 않음 (새로고침하면 그날 밤은 없던 일)
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
  if (p.teenLove && S.age < 19) return '사귀는 사이';   // 고등학생 연애 (고백·손잡기까지)
  if (p.partner) return '연인';
  if (p.secret) return '몰래 만나는 사이';
  if (p.grudge >= 50) return '원수';
  if (p.fwb) return '섹파';                                                              // 감정은 깊지 않고 만나서 해소하는 사이
  if (p.fling) return mainPartner() || p.taken || p.heart < 40 ? '복잡한 사이' : '썸';   // 사귀지 않고 밤을 보낸 사이
  if (p.ex) return '전 연인';
  if (p.heart >= 40 && heartOk(p)) return '썸';
  if (p.close >= 75) return '절친';
  if (p.close >= 45) return '친구';
  if (p.tag) return p.tag;   // 20세 시작: 과 친구·과 선배
  if (p.kind === 'classmate') return S.age >= 19 ? '동창' : '같은 반';
  return KIND_LABEL[p.kind] || '아는 사람';
}

// 관계 목록이 꽉 차면 제일 덜 친한 사람부터 멀어짐
// 상한(NPC_ENCOUNTER 120명)을 넘으면: 소속이 끝난 '얼굴만 아는 사람' → 얼굴만 아는 사람 → 덜 친한 사람 순
function makeRoom(kind) {
  if (alive().filter(p => p.kind !== 'family').length >= (D.encounter ? D.encounter.cap : C.maxPeople) && kind !== 'child') {
    const rank = p => (p.acq ? (orgActive(p) ? 1 : 0) : 2);
    const drop = alive().filter(p => !['family', 'child'].includes(p.kind) && !p.partner && !p.spouse && !p.secret).sort((a, b) => rank(a) - rank(b) || a.close - b.close)[0];
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
    close: spec.close ?? rand(15, 30), trust: spec.trust ?? rand(15, 30), heart: spec.heart && age >= 19 && S.age >= 19 ? spec.heart : 0, grudge: spec.grudge ?? 0,
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
    // 외모 3층 (등급 번호 0=F … 6=S). 몸은 체형(appearance.body)에서 계산
    face: spec.face ?? LETTERS.indexOf(pickKey(D.npcFace)),
    style: spec.style ?? npcStyle(hobby, age),
    bodyPlus: Math.random() < .4,
    libido: age >= C.sexMinAge ? spec.libido ?? rand(10, 50) : 0,
    penis: gender === 'm' ? rollPenis() : null,   // 성기 크기(cm). 함께 밤을 보낸 뒤에만 보임
    pref: age >= 19 && Math.random() < .6 ? randomPref(gender) : null,   // 좋아하는 체형 (null이면 상관없음)
  };
  if (p.kind === 'child') p.role = '아이';
  // 좋은 소문(한 사람과 오래, 존중함)이 돌면 새로 만난 어른이 처음부터 조금 더 믿어줌
  if (S.rumorType === 'good' && (S.rumor || 0) >= 30 && age >= 19 && p.kind !== 'family') p.trust = clamp(p.trust + rand(5, 10), 0, 100);
  // 기혼 NPC — 친밀 20이면 반지가 보이고, 40이면 결혼한 걸 알게 됨. 늘 몰래 만나는 사이로만 시작
  // 나이별 기혼 확률 (data/encounter.js) — 기혼자 85%는 반지를 끼고, 그중 일부는 술집·번화가에선 반지를 뺌
  if (spec.married ?? (!['family', 'child'].includes(p.kind) && spec.taken !== false && Math.random() < marriedChance(age))) { p.married = true; p.taken = true; }
  if (p.married) ringFor(p);
  p.seen = S.dayN || 0;
  // 피임약을 먹고 있는 사람 (20살 이상 여자, 냉철형·무심형이 조금 더 많음) — 피임을 물을 때 드러남
  if (gender === 'f' && age >= C.sexMinAge && !['family', 'child'].includes(p.kind) && Math.random() < (['sharp', 'cool'].includes(p.personality) ? .35 : .2)) p.pill = true;
  return p;
}
function npcStyle(hobby, age) {
  if (age < 13) return rand(0, 1);
  return clamp(rand(1, 3) + (hobby === 'fashion' ? 2 : 0) + (age >= 40 ? -1 : 0), 0, 6);
}
// 좋아하는 타입: 키·체격 + 남자는 가슴(컵 등급)·골반 등급, 여자는 어깨 등급·크기 등급 (그 등급 이상이면 좋아함)
function randomPref(gender) {
  const pr = { height: Math.random() < .5 ? pick(['short', 'avg', 'tall', 'tall']) : null, build: Math.random() < .6 ? pick(['slim', 'avg', 'fit', 'fit', 'chubby']) : null };
  if (gender === 'm') { if (Math.random() < .35) pr.cup = rand(3, 5); if (Math.random() < .25) pr.hip = rand(3, 5); }
  else { if (Math.random() < .35) pr.shoulder = rand(2, 4); if (Math.random() < .3) pr.penis = rand(3, 5); }
  for (const k in pr) if (pr[k] == null) delete pr[k];
  return Object.keys(pr).length ? pr : null;
}
// NPC 몸 등급 (체격 기준, 40대부터 하나 내려감)
function bodyIdx(p) {
  const b = (lookOf(p) || {}).body || {};
  let i = { fit: 4, avg: 2, slim: 2, chubby: 1 }[b.build] ?? 2;
  if (p.bodyPlus) i++;
  if (npcAge(p) >= 40) i--;
  return clamp(i, 0, 6);
}
// 내 체격: 체력이 B 이상이면 탄탄, 아니면 타고난 골격
//   20세 시작에서 직접 고른 체형은 체력 등급이 바뀌기 전까지 그대로 (fitAtPick: 고를 때의 체력 등급)
function myBuild() {
  const g = gIdx(S.stats.fit);
  if (S.fitAtPick != null && g === S.fitAtPick) return S.frame || 'avg';
  return g >= 4 ? 'fit' : S.frame && S.frame !== 'fit' ? S.frame : 'avg';
}
function syncMyBody() {
  if (S.fitAtPick != null && gIdx(S.stats.fit) !== S.fitAtPick) delete S.fitAtPick;
  if (S.look && S.look.body) S.look.body.build = myBuild();
}
// 생김새 (js/avatar.js). 같은 인생의 같은 id면 늘 같은 얼굴. 가족·아이는 피부색이 나와 같음
function lookOf(p) {
  if (!p.appearance && window.Avatar) {
    p.appearance = Avatar.make(`${S.id}:${p.id}`, p.gender, { feature: p.feature, skin: p.kind === 'family' || p.kind === 'child' ? S.skin : null });
    // 30대 이상 기혼자: 남자는 셔츠·재킷, 여자는 단정한 머리가 조금 더 많음 (미혼이어도 단정한 사람은 있음)
    if (p.married && npcAge(p) >= 30 && Math.random() < .5) { if (p.gender === 'm') p.appearance.top = pick([1, 1, 7]); else p.appearance.hair = pick([0, 1, 3, 4, 5]); }
  }
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

function applyP(p, delta, mult, gk) {
  if (!p || !delta) return [];
  if (p.acq) delete p.acq;
  p.seen = S.dayN || 0;
  const out = [], tr = trait();
  for (const k of Object.keys(delta)) {
    if (!PSTATS.includes(k)) continue;
    if (k === 'heart' && !heartOk(p)) continue;
    let v = val(delta[k]);
    if (gk != null && gk !== 1 && v > 0 && k !== 'grudge') v = probRound(v * gk);
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
  p.partner = false; p.secret = false; p.ex = true; p.fling = false; p.fwb = false; p.livesWith = false;
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
  if (sneaky || p.married) p.secret = true; else p.partner = true;   // 기혼인 상대와는 공개 연애가 안 됨
  p.taken = false; p.ex = false; p.fling = false; p.fwb = false;
  p.since = S.age;
}
/* ═════════ 친밀한 관계와 아이 ═════════ */
// 함께 밤을 보냄 (fling: 사귀지 않는 사이 → '썸' 또는 '복잡한 사이')
function night(p, fling) {
  if (!p) return;
  S.flags.intimate = true;
  p.nights = (p.nights || 0) + 1;
  if (p.nightsAt !== S.age) { p.nightsAt = S.age; p.nightsYr = 0; }
  p.nightsYr++;
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

/* ═════════ 술 ═════════ */
// 0 맨정신 / 1 한잔 / 2 적당히 취함 / 3 만취. 술집을 떠나면 깨고, 적당히 넘게 마셨으면 다음 날 숙취
const DRUNK = ['맨정신', '한잔', '적당히 취함', '만취'];
function drinkUp(n) { S.drunk = clamp((S.drunk || 0) + n, 0, 3); }
function soberUp(silent) {
  const d = S.drunk || 0;
  S.drunk = 0;
  if (d >= 2 && !silent) log(pick(D.hangoverLines), { t: 'info', deltas: applyEffect({ health: -rand(3, 8), happy: -rand(2, 4) }) });
}

/* ═════════ 성욕 · 섹스 스탯 · 꼬심 ═════════ */
// 성적인 것은 둘 다 20살 이상, 이성, 가족 아님. 이미 사귀는 사이면 상대가 50살을 넘어도 됨
const lover = p => !!(p.partner || p.spouse || p.secret);
function canSex(p) {
  if (!p || p.gone || p.kind === 'family' || p.kind === 'child' || p.gender === S.gender) return false;
  if (S.age < C.sexMinAge || npcAge(p) < C.sexMinAge) return false;
  return lover(p) || canRomance(p);
}
/* ── 성욕은 늘 대상이 있음 ──
   내 성욕: S.lust[사람 id] (그 사람을 향한 것) / NPC 성욕: p.libido (나를 향한 것)
   S.stats.libido는 내 성욕 중 가장 높은 값(S.lustTop이 그 대상) — 화면과 '성욕 몇 이상' 조건용 */
const lustOf = p => (p && S.lust && S.lust[p.id]) || 0;
function addLust(p, v) {
  if (!p || !v || !canSex(p)) return 0;
  const b = lustOf(p);
  S.lust[p.id] = clamp(b + Math.round(v), 0, 100);
  return S.lust[p.id] - b;
}
function lustTop() {
  let best = null, v = 0;
  for (const id in S.lust) { const p = person(id); if (p && canSex(p) && S.lust[id] > v) { v = S.lust[id]; best = p; } }
  return { p: best, v };
}
function syncLibido() { const t = lustTop(); S.stats.libido = t.v; S.lustTop = t.p ? t.p.id : null; }
// 성욕 변화: 오를 땐 대상(없으면 지금 가장 높은 대상)에게만, 내릴 땐(해소) 대상이 없으면 모두에게
function libidoDelta(v, p) {
  v = val(v);
  if (!v) return [];
  if (!p || !canSex(p)) {
    if (v < 0) { for (const id in S.lust) S.lust[id] = clamp(S.lust[id] + v, 0, 100); syncLibido(); return [['libido', v]]; }
    p = lustTop().p;
    if (!p) return [];
  }
  const d = addLust(p, v);
  syncLibido();
  return d ? [[`성욕→${pname(p)}`, d]] : [];
}
// 이 사람이 나에게 얼마나 끌리는지와 반대로, 내가 이 사람에게 끌리는 정도 (처음 성욕을 정할 때): 생김새·몸·꾸밈 + 설렘
const attraction = p => clamp((p.face ?? 2) * 3 + bodyIdx(p) * 2 + (p.style ?? 2) + Math.round((p.heart || 0) / 8), 0, 40);
// 시간이 흐르면 성욕이 오름 — 이미 마음에 둔 대상들에게, 설렘이 클수록 많이 (20대 3 / 30대 2 / 40대 1 기준, 건강 50 이하면 절반)
// 가장 높은 대상이 60을 넘으면 행복이 조금씩 깎임 (30 아래로는 안 깎음)
function libidoTick() {
  if (S.age < C.sexMinAge) return;
  let r = S.age < 30 ? 3 : S.age < 40 ? 2 : 1;
  if (S.stats.health <= 50) r /= 2;
  for (const id in S.lust) {
    const p = person(id);
    if (!p || !canSex(p)) continue;
    const w = clamp(.25 + (p.heart || 0) / 100 * .75 + (lover(p) || p.fwb ? .2 : 0), .25, 1.2);
    S.lust[id] = clamp(S.lust[id] + Math.round(r * w * rand(60, 140) / 100), 0, 100);
  }
  syncLibido();
  if (S.stats.libido >= 60 && S.stats.happy > 30) S.stats.happy--;
}
// 같이 있으면 서로 자극됨: 상대 성욕(나를 향한)은 내 몸 등급만큼, 내 성욕(그 사람을 향한)은 상대 몸 등급만큼 빨리 오름
function nearby(p) {
  if (!canSex(p)) return;
  p.libido = clamp((p.libido || 0) + Math.round(rand(1, 3) * (1 + gIdx(S.stats.fit) * .08 + (figPref(p) ? .05 : 0)) * (S.gender === 'm' && pGrade(S.penis) >= 5 && p.nights ? 1.3 : 1)), 0, 100);
  if (S.lust[p.id] == null) S.lust[p.id] = clamp(rand(0, 8) + attraction(p), 0, 60);   // 처음 마음에 들어옴
  addLust(p, Math.round(rand(0, 2) * (1 + bodyIdx(p) * .08)));
  syncLibido();
}
// 꼬심 — 외모(생김새·몸·꾸밈) + 인간(매력·감성) + 관계(설렘·친밀) + 보정. 상황마다 가중치가 다름
const g100 = v => Math.min(100, (gIdx(v) + gradeInfo(v).pct) * 100 / 6);
const ALLURE_W = { first: [.30, .10, .25, .10, .02], known: [.15, .15, .10, .25, .10], close: [.08, .12, .05, .30, .15], bed: [.05, .15, .03, .10, .05] };
// 선호에 맞으면 꼬심 +10~15, 등급 선호보다 2등급 이상 높으면 +20. 하나라도 안 맞으면 0
function prefBonus(p) {
  const pr = p.pref;
  if (!pr) return 0;
  const b = (S.look && S.look.body) || {}, fg = figure(null);
  if (pr.height && pr.height !== b.height) return 0;
  if (pr.build && pr.build !== myBuild()) return 0;
  let over = false;
  for (const [k, mine] of [['cup', fg.cGrade], ['hip', fg.hipGrade], ['shoulder', fg.sGrade], ['penis', p.nights && S.penis ? [pGrade(S.penis)] : 'unknown']]) {
    if (!pr[k] || mine === 'unknown') continue;   // 크기는 함께 밤을 보낸 뒤에야 앎
    if (!mine || mine[0] < pr[k]) return 0;
    if (mine[0] >= pr[k] + 2) over = true;
  }
  return over ? 20 : rand(10, 15);
}
const prefMatch = p => prefBonus(p) > 0;
// 내 가슴·골반이 상대 취향 등급 이상인지 (상대 성욕이 조금 더 빨리 오름)
function figPref(p) {
  const pr = p.pref;
  if (!pr || !(pr.cup || pr.hip)) return false;
  const fg = figure(null);
  return (!pr.cup || (fg.cGrade && fg.cGrade[0] >= pr.cup)) && (!pr.hip || (fg.hipGrade && fg.hipGrade[0] >= pr.hip));
}
function allure(p, sit) {
  sit = sit || (p.close >= 60 ? 'close' : p.close >= 30 ? 'known' : 'first');
  const [wf, wb, ws, wc, wa] = ALLURE_W[sit], d = S.drunk || 0, st = S.stats;
  const looks = g100(st.face) * wf + g100(st.fit) * wb + g100(st.style) * ws;
  const human = (g100(st.charm) + [0, 3, 6, -5][d]) * wc + g100(st.art) * wa;
  const rel = sit === 'first' ? 0 : p.heart * .5 + p.close * .15;
  let m = personality(p).allure || 0;
  m += prefBonus(p);
  if (myHobby(p.hobby)) m += rand(5, 8);
  if (p.value === S.value) m += rand(5, 8); else if (valueClash(p)) m -= rand(5, 8);
  if (S.place === 'bar') m += rand(10, 15); else if (S.place === 'station') m += rand(8, 10);
  if (S.age >= C.sexMinAge && lustOf(p) >= 60) m += lustOf(p) / 8;   // 이 사람을 향한 내 성욕
  if ((p.libido || 0) >= 60 && npcAge(p) >= C.sexMinAge) m += p.libido / 10;   // 나를 향한 상대 성욕
  if (p.married) m -= p.ringOff ? rand(0, 5) : rand(15, 20);   // 술집에서 반지를 빼는 기혼자는 덜 망설임
  if (sit === 'bed' && !lover(p)) m += casualBonus();   // 가벼운 관계(하룻밤·집으로 데려가기·즐기자는 제안)는 외모·매력이 크게 먹힘
  if (S.rumorType === 'bad' && (S.rumor || 0) >= 30 && sit !== 'close' && sit !== 'bed') m -= rand(10, 20);   // 나쁜 소문 — 새 사람이 경계함
  m += [0, 3, rand(10, 12), 5][d];
  return looks + human + rel + m;
}
const charmed = (p, sit, need) => allure(p, sit) + rand(-15, 15) >= need;
// 그저 즐기는 관계: 외모(생김새·몸·꾸밈)와 매력이 높을수록 훨씬 쉬움 — 0(F·F) ~ 40(S·S)
function casualBonus() {
  const st = S.stats, looks = g100(st.face) * .6 + g100(st.fit) * .2 + g100(st.style) * .2;
  return Math.round((looks + g100(st.charm)) / 2 * .4);
}
// 설렘이 없어도 나를 향한 성욕이 차면 하룻밤까지 갈 수 있음 (외모·매력이 높을수록 문턱이 낮음: 성욕 60 → 40)
const casualReady = p => !!p && canSex(p) && !lover(p) && p.close >= 20 && (p.libido || 0) >= 60 - casualBonus() / 2;
// 첫인상 등급 (생김새·꾸밈 위주)
const firstLook = () => clamp(Math.round(gIdx(S.stats.face) * .5 + gIdx(S.stats.style) * .35 + gIdx(S.stats.fit) * .15), 0, 6);

// 만족감 = 기술 40% + 궁합 25% + 크기 10% + 설렘 15% + 분위기 10%  (상대가 느끼는 것)
// 성기 크기: cm → 등급 1~6, 라벨 '18cm(대물)'. 크기 보정은 등급표 값(흉기인데 여자 쪽이 마르면 -3)
const PG = () => D.penisGrades;
function rollPenis() { const g = weighted(PG(), r => r[3]); return rand(g[0], g[1]); }
const pGrade = cm => cm ? PG().findIndex(r => cm <= r[1]) + 1 || 6 : 0;
const penisLabel = cm => `${cm}cm(${PG()[pGrade(cm) - 1][2]})`;
const cmFromSize = sz => ({ small: rand(9, 12), avg: rand(13, 15), large: rand(16, 17), xlarge: rand(18, 21) })[sz] || rollPenis();
// 이 둘 사이: 남자 쪽 크기와 여자 쪽 체격
function pairOf(p) {
  const cm = S.gender === 'm' ? S.penis : p.penis;
  return { cm, g: pGrade(cm), herBuild: S.gender === 'm' ? ((lookOf(p) || {}).body || {}).build : myBuild() };
}
function sizeTerm(p) {
  const { g, herBuild } = pairOf(p);
  return 6 + (g === 6 && herBuild === 'slim' ? -3 : g ? PG()[g - 1][4] : 0);
}
function startCompat(p) {
  return clamp(rand(20, 45) + (myHobby(p.hobby) ? 10 : 0) + (p.value === S.value ? 5 : valueClash(p) ? -5 : 0) + (prefMatch(p) ? 10 : 0), 0, 100);
}
function satisfaction(p, mood, adj) {
  const md = clamp(50 + (mood || 0) + [0, 10, 15, -10][S.drunk || 0], 0, 100);
  return clamp(Math.round(g100(S.sexSkill || 0) * .4 + (p.compat ?? 30) * .25 + sizeTerm(p) + p.heart * .15 + md * .1 + rand(-8, 8) + (adj || 0)), 0, 100);
}
// 지금이 인생에서 몇 번째 행동인지 (싸운 뒤 몇 턴, 오랜만인지 계산용)
// '턴' = 옛 기준 한 행동(1년의 1/10 ≈ 36.5일). 싸운 뒤 몇 턴·오랜만인지 등은 날짜로 셈
const turnNo = () => Math.floor((S.dayN || 0) / 36.5);
/* ── 평판: 몇 명이냐보다 어떻게 관리하느냐. 해마다 최근 2년 안에 밤을 보낸 상대(배우자 제외) 수 × 5% ──
   × 상대마다 (섹파·연인이면 .3) (만족감 70+면 .5) (대놓고 데려간 적 없으면 .4) (원한 낮으면 .3) 의 평균 × (들킨 적 없으면 .5)
   소문 종류: bad(원나잇·원한·들킴) / skill(기술 A 이상 + 다들 만족) / good(한 사람과 3년 넘게, 신뢰 70+) */
const PUBLIC = ['bar', 'concert', 'station', 'mall', 'cafe'];
const RUMOR_LINE = { bad: '많이 놀고 다닌다더라', good: '한 사람만 오래 만난다더라', skill: '밤에 대단하다더라' };
function rumorYear() {
  if (S.age < C.sexMinAge) return;
  S.rumor = Math.max(0, (S.rumor || 0) - 15);
  if (!S.rumor) S.rumorType = null;
  const ps = S.people.filter(p => p.nights && (p.nightsAt ?? -9) >= S.age - 2 && !p.spouse && p.kind !== 'family');
  if (!ps.length) {
    const m = mainPartner();
    if (m && S.age - (m.since ?? S.age) >= 3 && m.trust >= 70 && S.rumorType !== 'bad' && Math.random() < .2) {
      S.rumor = clamp((S.rumor || 0) + rand(25, 40), 0, 100); S.rumorType = 'good';
    }
    return;
  }
  const f = ps.reduce((t, p) => t + (p.fwb || lover(p) ? .3 : 1) * ((p.bestSat || 0) >= 70 ? .5 : 1) * (p.flaunt ? 1 : .4) * (p.grudge < 20 ? .3 : 1), 0) / ps.length;
  const chance = ps.length * .05 * f * (S.caughtN ? 1 : .5);
  if (Math.random() >= chance) return;
  const avgSat = ps.reduce((t, p) => t + (p.bestSat || 0), 0) / ps.length;
  const type = !S.caughtN && !ps.some(p => p.grudge >= 40) && gIdx(S.sexSkill || 0) >= 5 && avgSat >= 75 ? 'skill' : 'bad';
  S.rumor = clamp((S.rumor || 0) + rand(30, 50), 0, 100); S.rumorType = type;
  log(type === 'skill' ? '어디선가 내 이야기가 돌고 있다. 나쁜 얘기는 아닌 것 같은데… 얼굴이 화끈거렸다.' : '어디선가 내 이야기가 돌고 있다는 걸 알았다. 수군거리는 소리가 들렸다.', { t: 'info' });
}
// 거절: 기본 10% + 피곤함(성욕 20 미만) 15% + 싸운 지 얼마 안 됨 20% + 생리 중 20% + 올해 벌써 3번 넘게 10% - 성욕이 높으면 10~20%
// 거절하면 이유('period'|'fight'|'tired'|'mood'), 받아주면 null
function refusal(p) {
  if (!canSex(p)) return 'mood';
  const lib = p.libido || 0;
  const tired = lib < 20, fight = p.fought != null && turnNo() - p.fought <= 6, period = p.gender === 'f' && Math.random() < .12;
  let c = .10 + (tired ? .15 : 0) + (fight ? .20 : 0) + (period ? .20 : 0) + (p.nightsAt === S.age && (p.nightsYr || 0) >= 3 ? .10 : 0);
  c -= lib >= 80 ? .20 : lib >= 60 ? .10 : 0;
  if (Math.random() >= c) return null;
  return period ? 'period' : fight ? 'fight' : tired ? 'tired' : 'mood';
}
/* ── 피임: 함께 밤을 보내기 직전에 묻고(contraAsk), 고른 뒤 그 밤을 이어서 처리 ── */
// 아이가 생길 수 있는 사이인지 (엄마 나이 45 미만, 이미 임신 중이 아님)
const fertile = p => !S.preg && (S.gender === 'f' ? S.age : npcAge(p)) < 45;
// 피임약: 나(여자)가 먹고 있거나, 상대(여자)가 먹고 있음
const onPill = p => S.gender === 'f' ? !!S.flags.onPill : !!(p && p.pill);
// 고른 방법을 꺼냄. 물어본 적이 없으면 null. '그냥'이어도 냉철형·예민형은 안 된다고 할 때가 있고, 만취면 콘돔을 깜빡함
function takeContra(p) {
  const m0 = S.vars.contra;
  delete S.vars.contra;
  if (!m0) return null;
  const CT = D.contra;
  let m = m0;
  if (m === 'pill' && !onPill(p)) m = 'none';
  if (m === 'none' && !p.spouse && CT.insist[p.personality] && Math.random() < .6) { m = 'condom'; log(fill(CT.insist[p.personality]), { t: 'info' }); }
  else if ((m === 'condom' || m === 'both') && (S.drunk || 0) >= 3 && Math.random() < .25) { m = m === 'both' ? 'pill' : 'none'; log(CT.drunkForgot, { t: 'info' }); }
  return m;
}
const satTier = v => v >= 90 ? 4 : v >= 70 ? 3 : v >= 50 ? 2 : v >= 30 ? 1 : 0;
// 함께 밤을 보냄: 성욕 해소, 기술·궁합 상승, 만족감에 따라 상대 마음이 달라짐 (첫 경험은 감정이 덮어줌)
// 연출 번호(S.sceneN)는 인생 내내 계속 올라감 — 연출을 지운 뒤 1부터 다시 세면 화면이 이미 본 연출로 여겨 건너뛰었음
function sexScene(p, o) {
  if (!canSex(p)) return null;
  const first = !S.flags.hadSex, firstWith = !p.nights;
  if (p.compat == null) p.compat = startCompat(p);
  const contra = takeContra(p), cm = D.contra.methods[contra || 'none'];
  let adj = cm.sat && gIdx(S.sexSkill || 0) >= gIdx(gradeMin('B')) ? Math.round(cm.sat / 2) : cm.sat;   // 콘돔은 익숙해지면 덜 깎임
  adj += resolve(o.satBonus) || 0;
  const awkward = gIdx(S.sexSkill || 0) === 0;   // 밤의 기술 F — 어색한 순간이 끼어듦
  // 권태와 신선함: 같은 상대와 4번째부터 3씩 깎임(최대 -24). 새 장소 +8~12, 오랜만(5턴 이상) +5~10, 새 상대 +10~15, 여행지 +8
  const t = turnNo(), spot = o.away ? 'travel' : o.spot || o.moveTo || S.place || 'home';
  if (PUBLIC.includes(S.place)) p.flaunt = true;
  if (p.texted) { adj += 6; delete p.texted; }   // 야한 문자를 주고받은 뒤
  p.spots = p.spots || [];
  let fresh = 0;
  if (firstWith) { if (S.flags.hadSex) fresh += rand(10, 15); }
  else {
    if (!p.spots.includes(spot)) { fresh += rand(8, 12); p.routine = Math.max(0, (p.routine || 0) - 4); }
    if (p.lastNightT != null && t - p.lastNightT >= 5) { fresh += rand(5, 10); p.routine = Math.max(0, (p.routine || 0) - 3); }
  }
  if (o.away) fresh += 8;
  if (p.freshBonus) { fresh += 10; p.routine = 0; delete p.freshBonus; }
  const bored = Math.min(24, Math.max(0, ((p.routine || 0) - 3) * 3));
  adj += fresh - bored;
  p.routine = (p.routine || 0) + 1; p.lastNightT = t;
  if (!p.spots.includes(spot)) p.spots.push(spot);
  let sat = satisfaction(p, resolve(o.mood), adj);
  // 크기: 단소는 만족감 85, 소형은 92까지가 한계. 대물 이상은 기술이 낮아도 바닥 25~35. 흉기인데 여자 쪽이 마른 체형이면 아픔
  const { cm: pcm, g: pg, herBuild } = pairOf(p);
  if (pg === 1) sat = Math.min(sat, 85);
  else if (pg === 2) sat = Math.min(sat, 92);
  else if (pg >= 5) { sat = Math.max(sat, rand(25, 35)); if (pg === 6 && herBuild === 'slim') sat = clamp(sat - rand(10, 15), 0, 100); }
  const tier = satTier(sat);
  // 해소: 이 사람을 향한 성욕은 크게, 다른 대상들은 조금 (몸이 채워져서)
  if (S.lust[p.id] == null) S.lust[p.id] = 0;
  addLust(p, -rand(70, 90));
  for (const id in S.lust) if (id !== p.id) S.lust[id] = clamp(S.lust[id] - rand(10, 20), 0, 100);
  p.libido = clamp((p.libido || 0) - rand(70, 90), 0, 100);
  // 대물·흉기는 보는 것만으로 상대 성욕 +10~15 (그래서 더 자주 먼저 원함)
  if (pg >= 5) { if (S.gender === 'm') p.libido = clamp(p.libido + rand(10, 15), 0, 100); else addLust(p, rand(10, 15)); }
  syncLibido();
  S.sexSkill = (S.sexSkill || 0) + Math.max(1, Math.round(rand(6, 10) * GR[gIdx(S.sexSkill || 0)][2]));
  p.compat = clamp(p.compat + rand(5, 10), 0, 100);
  night(p, !!o.fling);
  const prevBest = p.bestSat || 0;
  p.lastSat = sat; p.bestSat = Math.max(prevBest, sat);
  S.flags.hadSex = true;
  const fig = figure(p);
  if (S.companion === p.id) S.companion = null;
  S.scene = { kind: 'night', pid: p.id, sat, first: firstWith, fling: !lover(p), contra, spot, direct: !!o.direct, personality: p.personality, fig, cm: pcm, build: herBuild, n: (S.sceneN = (S.sceneN || 0) + 1) };   // cm·build: 그날 밤 ♂♀ 화살 길이·움찔 기준
  if (first) { S.vars.fp = p.id; trigger('firstTime'); }   // 내 첫 경험 — 상대 성격마다 다른 한 줄, 추억
  return { sat, tier, first, firstWith, lover: lover(p), legend: tier === 4 && prevBest < 90, contra, pregMul: cm.preg, awkward };
}
/* ── 죄책감: 성격 기본값에서 만족감이 70을 넘은 만큼(×1.5) 깎임 ── */
const guiltOf = (pers, sat) => Math.max(0, ((D.personalities.find(x => x.id === pers) || {}).guilt ?? 40) - Math.max(0, sat - 70) * 1.5);
// 상대가 떳떳하지 못한 사이 (기혼, 애인 있음, 나와 몰래 만나는 중)
const npcIllicit = p => !!(p.married || p.taken || p.secret);
// 관계를 끝냄 (몰래 만나는 사이·섹파·썸 모두)
function endAffair(p) {
  if (p.secret || p.partner) breakUp(p, 0);
  p.fling = false; p.fwb = false;
  p.heart = Math.max(0, p.heart - 10);
}
function guiltCheck(p, sx, ctx) {
  const G = D.guiltLines, c = Object.assign({ p: pname(p) }, ctx);
  // 상대의 죄책감
  if (npcIllicit(p)) {
    const pt = personality(p), base = pt.guilt ?? 40, g = Math.round(guiltOf(p.personality, sx.sat) * (p.fwb && !p.married ? .6 : 1));   // 즐기기만 하기로 한 사이면 죄책감이 덜함
    p.guiltN = (p.guiltN || 0) + 1;
    let line = null, end = false;
    if (g >= 86) { end = true; line = G.breakNow; }
    else if (g >= 66) { p.guiltLimit = p.guiltLimit || rand(1, 2); end = p.guiltN >= p.guiltLimit; line = end ? G.breakHeavy : G.heavy; }
    else if (g >= 41) { p.guiltLimit = p.guiltLimit || rand(3, 4); end = p.guiltN >= p.guiltLimit; line = end ? G.breakMid : (Math.random() < .5 ? G.mid : null); }
    else if (g >= 16) line = Math.random() < .3 ? G.light : null;
    if (!end && base >= 66 && g < base) line = g === 0 ? (G.noGuilt[p.personality] || line) : (G.override[p.personality] || line);   // 만족감이 죄책감을 눌렀을 때
    if (line) log(fill(pick(asList(line)), c), { t: end ? 'text' : 'info' });
    if (end) {
      endAffair(p);
      if (g >= 66 && Math.random() < .35) {   // 자기 애인·배우자에게 털어놓음
        S.vars.fp = p.id;
        trigger(p.married ? 'spouseCaught' : 'rivalFound');
      }
    }
  }
  // 내 죄책감 (내가 바람피우는 중일 때)
  const m = mainPartner();
  if (m && m !== p) {
    const g = guiltOf(S.personality, sx.sat);
    const hit = g >= 86 ? -8 : g >= 66 ? -5 : g >= 41 ? -3 : g >= 16 ? -1 : 0;
    if (hit) log(fill(pick(G.mine[g >= 66 ? 2 : g >= 41 ? 1 : 0]), { partner: pname(m) }), { t: 'info', deltas: applyEffect({ happy: hit }) });
    if (g >= 86) addKarma(-3);
  }
}
// 만족감에 따라 설렘·친밀 변화 배율 (사귀는 사이는 실망해도 덜 깎임, 첫 경험은 무조건 오름)
function scaleBySat(pd, sx) {
  pd = Object.assign({ heart: [6, 10], close: [3, 6] }, pd);
  const sc = (v, f) => Array.isArray(v) ? v.map(x => Math.round(x * f)) : Math.round((v || 0) * f);
  let f = [-.7, .1, .8, 1.2, 1.6][sx.tier];
  if (sx.lover && sx.tier <= 1) f = sx.tier ? .4 : .1;
  if (sx.first) f = Math.max(f, .9);
  pd.heart = sc(pd.heart, f);
  pd.close = sc(pd.close, Math.max(.3, f));
  return pd;
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
// gk: 행동으로 얻는 양의 배율(단계마다 다름) — 오르는 쪽만, 확률 반올림
function applyEffect(eff, gk) {
  eff = resolve(eff);
  if (!eff) return [];
  const tr = trait(), out = [];
  for (const k of Object.keys(eff)) {
    if (k === 'rel') { out.push(...applyRel(eff.rel)); continue; }
    if (k === 'libido') { out.push(...libidoDelta(eff[k], person(S.vars.fp))); continue; }
    let v = val(eff[k]);
    if (gk != null && gk !== 1 && v > 0) v = probRound(v * gk);
    if (!v) continue;
    if (k === 'money') { S.money += v; out.push(['money', v]); continue; }
    if (!STATS.includes(k)) continue;
    if (v > 0 && tr.mult && tr.mult[k]) v = Math.round(v * tr.mult[k]);
    if (v < 0 && tr.negMult && tr.negMult[k]) v = Math.round(v * tr.negMult[k]);
    if (v > 0 && k === 'fit') v = Math.round(v * (S.age < 20 ? 1 : S.age < 30 ? 1.2 : S.age < 40 ? 1 : .8));   // 몸: 20대 잘 오르고 40대 잘 안 오름
    if (v > 0 && k === 'style') v = Math.round(v * (1 + gIdx(S.stats.art) * .1));                              // 감성이 높으면 같은 돈으로 더 잘 꾸밈
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
// resumed: 피임을 고른 뒤 멈췄던 밤을 이어서 처리 (플래그·새 사람·함수는 이미 적용됨)
function applyOutcome(o, target, resumed) {
  if (!o) return;
  if (!resumed) {
    asList(o.set).forEach(f => { S.flags[f] = true; });
    asList(o.unset).forEach(f => { delete S.flags[f]; });
    if (o.meet) addPerson(resolve(o.meet));
    if (o.do) o.do(S, api);
    const tp0 = target || person(S.vars.fp);
    // 아이가 생길 수 있는 밤이면 피임부터 물어봄 → 고르면 choose()가 이어서 처리
    if (o.intimate && tp0 && canSex(tp0) && resolve(o.pregnant) && fertile(tp0) && EVENTS.contraAsk) {
      held = { o, target, pid: tp0.id };
      S.vars.fp = tp0.id;
      trigger('contraAsk');
      return;
    }
  }
  const deltas = applyEffect(o.effect, o.gk);
  const tp = target || person(S.vars.fp);
  let pd = o.p ? resolve(o.p) : null;
  const sx = o.intimate && tp ? sexScene(tp, o) : null;   // 함께 밤을 보내는 결과 (만족감 계산)
  if (sx) { pd = scaleBySat(pd, sx); deltas.push(['sat', sx.sat]); }
  if (pd && tp) deltas.push(...applyP(tp, pd, o.mult, sx ? null : o.gk));
  if (o.fight && tp && lover(tp)) tp.fought = turnNo();   // 싸움 — 몇 턴 동안 거절이 잦고, 화해할 기회가 생김
  if (o.libido) deltas.push(...libidoDelta(o.libido, tp));
  if (o.drunk) drinkUp(val(o.drunk));
  if (o.sober) soberUp(true);
  // 어린 시절 이야기: 성격·가치관이 어느 쪽으로 기우는지, 취미 정하기 (data/story.js)
  if (o.lean) { S.lean = S.lean || {}; S.lean[o.lean] = (S.lean[o.lean] || 0) + 1; }
  if (o.vlean) { S.vlean = S.vlean || {}; S.vlean[o.vlean] = (S.vlean[o.vlean] || 0) + 1; }
  if (o.hobby) S.hobby = o.hobby;
  if (o.subjectBonus && S.vars.classSubj) addBonus(S.vars.classSubj, o.subjectBonus);   // 수업 이벤트 → 다음 시험 보정
  if (o.extra && inSchool()) S.school.extra = (S.school.extra || 0) + val(o.extra);   // 비교과 (수시 종합)
  addKarma(o.karma);
  if (o.heat) S.heat = clamp(S.heat + val(o.heat), 0, 100);
  const ctx = target ? { p: pname(target) } : {};
  const text = o.text != null ? fill(textOf(o.text), ctx) : '';
  if (text) log(text, { memory: !!resolve(o.memory), deltas });
  else if (deltas.length) log('', { t: 'info', deltas });
  if (sx) { if (S.scene) S.scene.text = text; afterSex(tp, sx, ctx); guiltCheck(tp, sx, ctx); }
  // 키스·포옹·끌어당기기 실루엣 연출 (화면이 S.scene을 보고 그림)
  if (o.scene && tp && S.age >= C.romanceMinAge && npcAge(tp) >= C.romanceMinAge) S.scene = { kind: o.scene, pid: tp.id, text, n: (S.sceneN = (S.sceneN || 0) + 1) };
  const conceived = !!(o.pregnant && tp && (!o.intimate || sx) && conceive(tp, resolve(o.pregnant) * (sx ? sx.pregMul : 1)));
  if (conceived && S.scene) S.scene.preg = true;
  // 피임 없이 보냈는데 아이가 안 생겼으면, 70% 확률로 다음 계절에 불안이 찾아옴 (배우자는 제외)
  if (sx && sx.contra === 'none' && !conceived && !tp.spouse && fertile(tp) && Math.random() < .7) S.scare = { pid: tp.id };
  // 사람 많은 곳에서 대놓고 데려가면 눈에 띔 (소문 방지 조건이 깨짐)
  if (o.bring && tp && PUBLIC.includes(S.place)) tp.flaunt = true;
  // 다른 장소로 이동 (예: 술집에서 집으로 같이, 정신 차려보니 공원)
  if (o.moveTo && PLACES[o.moveTo] && !jailed()) enterPlace(PLACES[o.moveTo], o.bring && tp && !tp.gone ? tp : null);
  riskCheck(o, tp);
  if (o.then) { const t = resolve(o.then); if (t) trigger(t); }
}
// 함께 밤을 보낸 뒤: 만족감에 따른 상대 반응 한 줄
function afterSex(p, sx, ctx) {
  const L = D.satLines, c = Object.assign({ p: pname(p) }, ctx);
  if (sx.awkward) log(pick(L.awkward), { t: 'info' });
  // 그 사람과 처음 보낸 밤, 내 크기에 대한 반응 (내가 남자일 때, 대물·흉기 / 단소·소형)
  const sr = sx.firstWith && S.gender === 'm' && (pGrade(S.penis) >= 5 ? D.sizeReaction.big : pGrade(S.penis) <= 2 ? D.sizeReaction.small : null);
  if (sr && sr[p.personality]) log(fill(sr[p.personality], c), { t: 'info' });
  compareEx(p, sx, c);
  if (sx.first && sx.tier <= 1) { log(fill(pick(L.firstLow), c), { t: 'info' }); return; }
  const line = pick(L[sx.tier] || []);
  if (line) log(fill(line, c), { t: sx.tier >= 3 ? 'text' : 'info', memory: sx.legend });
  pillowTalk(p, sx, c);
}
// 필로우 토크: 만족감 50+·친밀 40+면 60%, 만족감 80+면 90% (소심형·예민형 +10%). 같은 사람과는 4턴에 한 번까지
// 신뢰 +5~10, 친밀 +3~6, 가끔 속마음을 털어놓아 아직 모르던 프로필이 열림
function pillowTalk(p, sx, c) {
  let ch = sx.sat >= 80 ? .9 : sx.sat >= 50 && p.close >= 40 ? .6 : 0;
  if (ch && ['shy', 'sensitive'].includes(p.personality)) ch += .1;
  if (!ch || (p.pillowT != null && turnNo() - p.pillowT < 4) || Math.random() >= ch) return;
  p.pillowT = turnNo();
  let text = pick(D.pillowTalk[p.personality] || D.pillowTalk.warm);
  const hidden = ['personality', 'hobby', 'dream', 'value', 'wealth'].filter(f => !known(p, f));
  if (hidden.length && Math.random() < .35) { const f = hidden[0]; p.told = (p.told || []).concat(f); text += ' ' + D.pillowReveal[f]; }
  log(fill(text, c), { memory: sx.tier >= 4 && Math.random() < .3, deltas: applyP(p, { trust: [5, 10], close: [3, 6] }) });
}
// 전 상대와의 비교: 처음 두 밤 안에 한 번, 직진형·냉철형이거나 내 기술과 그 사람 전 상대의 차이가 30 넘게 날 때 (40%)
// 내가 낫다 → 설렘 +5~10 / 못하다 → 설렘 -3~5, 행복 -3 (두 번 쌓이면 기술을 올리고 싶어지는 이벤트)
function compareEx(p, sx, c) {
  if (p.exSkill == null) p.exSkill = rand(10, 90);   // 이 사람의 전 상대 (숨은 값)
  if (p.compared || (p.nights || 0) > 2) return;
  const diff = g100(S.sexSkill || 0) - p.exSkill;
  if (!(['bold', 'sharp'].includes(p.personality) || Math.abs(diff) >= 30) || Math.abs(diff) < 10 || Math.random() >= .4) return;
  p.compared = true;
  const better = diff > 0, L = D.compareLines[better ? 'better' : 'worse'];
  const text = fill(L[p.personality] || L._, Object.assign({ ex: S.gender === 'm' ? '전 남자친구' : '전 여자친구' }, c));
  if (better) {
    // 전 상대보다 낫다는 걸 알게 되면 만족감도 조금 더
    const bonus = rand(3, 6);
    p.lastSat = Math.min(100, p.lastSat + bonus); p.bestSat = Math.max(p.bestSat || 0, p.lastSat);
    if (S.scene && S.scene.kind === 'night' && S.scene.pid === p.id) S.scene.sat = p.lastSat;
    log(text, { deltas: applyP(p, { heart: [5, 10] }) });
  }
  else { S.vars.worseN = (S.vars.worseN || 0) + 1; log(text, { t: 'info', deltas: applyP(p, { heart: [-5, -3] }).concat(applyEffect({ happy: -3 })) }); }
}
// 얽힌 사이: 들키지 않으면 괜찮지만… (risk: 내 애인에게 / riskTaken: 상대 애인에게)
function riskCheck(o, p) {
  const low = p && p.fwb ? .6 : 1;   // 섹파는 감정이 깊지 않아서 들킬 위험도 낮음
  const risk = (resolve(o.risk) || 0) * low, rt = (resolve(o.riskTaken) || 0) * low;
  const m = mainPartner();
  if (risk && p && m && m !== p && Math.random() < risk + .05 * alive().filter(x => x.secret).length) {
    S.vars.mainId = m.id; S.vars.mainName = pname(m); S.vars.loverId = p.id; S.vars.lover = pname(p);
    S.caughtN = (S.caughtN || 0) + 1;
    trigger('affairCaught');
  } else if (rt && p && p.taken && Math.random() < rt) {
    S.vars.fp = p.id;
    S.caughtN = (S.caughtN || 0) + 1;
    trigger(p.married ? 'spouseCaught' : 'rivalFound');   // 상대 애인에게 / 기혼이면 상대 배우자에게
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
  if (ev.past && S.quickstart) return false;   // 20세 시작: 플레이하지 않은 어린 시절을 떠올리는 이벤트는 없음
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
const trigger = id => { if (EVENTS[id]) fire(EVENTS[id]); };
const choicesOf = ev => ev.choices.filter(c => !c.if || c.if(S, api));

function currentEvent() {
  const p = S.pending[0];
  if (!p) return null;
  const ev = EVENTS[p.id];
  if (!ev) { S.pending.shift(); return currentEvent(); }
  Object.assign(S.vars, p.tv);
  const wp = p.who && person(p.who);
  const who = wp ? { look: lookOf(wp), age: npcAge(wp), name: pname(wp), rel: relLabel(wp), fig: figure(wp), libido: canSex(wp) ? wp.libido || 0 : 0 } : null;   // 나를 향한 성욕 → 표정
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
  if (ch.check && ch.check.dice) {   // 주사위: (능력치 lvl / 난이도) × 100 + rand(-20, 20), 5~95%
    const pc = clamp(Math.round(lvl(S.stats[ch.check.stat]) / ch.check.diff * 100) + rand(-20, 20), 5, 95), roll = rand(1, 100), ok = roll <= pc;
    log(`🎲 ${LABEL[ch.check.stat]} 판정 ${pc}% → ${ok ? '성공' : '실패'}`, { t: 'info' });
    o = ok ? ch.success : ch.fail;
  } else if (ch.check) o = (S.stats[ch.check.stat] || 0) + rand(-15, 15) >= ch.check.diff ? ch.success : ch.fail;
  else if (ch.chance != null) o = Math.random() < resolve(ch.chance) ? ch.success : ch.fail;
  applyOutcome(o);
  if (p.id === 'contraAsk') resumeHeld();
  after();
}
// 피임을 고른 뒤 멈췄던 밤을 이어서
function resumeHeld() {
  const h = held;
  held = null;
  const tp = h && person(h.pid);
  if (!h || !tp || !canSex(tp)) { delete S.vars.contra; log('분위기가 깨졌다. 그날은 그냥 잠들었다.', { t: 'info' }); return; }
  S.vars.fp = tp.id;
  applyOutcome(h.o, h.target, true);
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
  S.weather = rollWeather();
  updateTime();
  S.log.push({ n: ++S.seq, t: 'season', season: se.id, icon: se.icon, wx: S.weather });
  if (S.preg && S.preg.due == null) tellPreg();
  if (S.scare) {   // 피임 없이 보낸 밤 뒤의 불안 (그새 아이가 생겼으면 그 소식이 대신)
    const sp = person(S.scare.pid);
    S.scare = null;
    if (sp && !S.preg) { S.scares = (S.scares || 0) + 1; S.vars.fp = sp.id; trigger(S.scares >= 2 ? 'pregScareRepeat' : 'pregScare'); }
  }

  // 반드시 터지는 것 (입학, 수능, 전역 등)
  const musts = D.events.filter(e => e.type === 'must' && seasonOk(e, se.id) && eligible(e));
  musts.forEach(e => { if (eligible(e)) fire(e); });
  if (!se.fixed || musts.length) return;

  // 고정 이벤트 한 개 (가끔은 일상 한 줄)
  const pool = D.events.filter(e => e.type === 'fixed' && seasonOk(e, se.id) && eligible(e));
  if (pool.length && Math.random() >= C.flavorChance) fire(weighted(pool));
  else log(flavorLine(se.id));
}
/* ═════════ 시간 (GAMEFLOW) ═════════
   story  0~12살  선택지 이야기 — 행동 없음. '계속'을 누르면 다음 선택지(이야기·이벤트)나 해가 바뀔 때까지 시간이 흐름
   ms     13~15살 중학교 — 1년 50턴(1턴 ≈ 1주): 수업 주간(자동)·중간·기말·자유 턴·방학
   hs     16~18살 고등학교 — 1년 30턴: 수업·시험·자유·방학, 고3은 모의고사·수능·원서 접수·결과 발표 (재수하면 19살에 고3 턴을 한 번 더)
   adult  19살~   하루 단위 — 행동력 12칸(1칸 = 1.5시간, 아침 6시부터), 새벽까지 깨면 18칸까지. 평일엔 출근·수업이 자동으로 칸을 씀
   학년도는 3월 1일에 시작하고 그때 나이가 하나 늘어남. 계절은 달에서, 생일은 태어난 달에 */
const SEASON_OF = m => m >= 3 && m <= 5 ? 0 : m >= 6 && m <= 8 ? 1 : m >= 9 && m <= 11 ? 2 : 3;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const T_OF = { C: 'class', F: 'free', M: 'mid', X: 'final', V: 'vac', K: 'mock', N: 'csat', A: 'apply', R: 'result' };
const semOf = str => str.split('').map(c => T_OF[c]);
// 학년도 턴 일정: [1학기, 2학기]. 한 학기는 3월 1일·9월 1일부터 182일에 고르게 펼침
const SCHED = {
  ms:  [semOf('CFCFCFCFMCFCFCFCFXVVVVVVV'), semOf('CFCFCFCFMCFCFCFCFXVVVVVVV')],   // 수업 8 · 중간 · 자유 8 · 기말 · 방학 7
  hs:  [semOf('CFCFCMCFCFXVVVV'), semOf('CFCFCMCFCFXVVVV')],                       // 수업 5 · 중간 · 자유 4 · 기말 · 방학 4
  hs2: [semOf('CFCFCMCFCFXVVVV'), semOf('CFCFCMCKFFXVVVV')],                       // 고2: 11월 모의고사 (선택)
  hs3: [semOf('CKCFCMCFKFXVVVV'), semOf('CKCMCFNFFARVVVV')],                       // 고3: 3·6월 모의고사 / 9월 모의고사·수능·원서·발표
};
const TURN_AP = { free: 2, vac: 3 };   // 자유 턴은 방과 후, 방학은 조금 더
const TURN_LABEL = { class: '수업', free: '자유', mid: '중간고사', final: '기말고사', vac: '방학', mock: '모의고사', csat: '수능', apply: '원서 접수', result: '결과 발표' };
const DAY_AP = 12, LATE_AP = 6;       // 하루 12칸 + 새벽 6칸
// 지금 단계
function phase() {
  if (S.age <= 12) return 'story';
  if (S.age <= 15) return 'ms';
  if (S.age <= 18 || (S.age <= 20 && S.flags.retake && !S.flags.student)) return 'hs';   // 재수: 19살(20세 시작이면 20살)에 고3 턴을 한 번 더
  return 'adult';
}
const schedule = () => { const ph = phase(); return ph === 'ms' ? SCHED.ms : ph === 'hs' ? (S.age >= 18 ? SCHED.hs3 : S.age === 17 ? SCHED.hs2 : SCHED.hs) : null; };
const turnKind = i => { const sc = schedule(); if (!sc) return null; const L = sc[0].length; return sc[i < L ? 0 : 1][i % L]; };
const turnsInYear = () => { const sc = schedule(); return sc ? sc[0].length * 2 : 0; };
// 이 학년도(나이)의 3월 1일 / 그 턴의 날짜
const yearStartDate = age => new Date(S.birthYear + age, 2, 1);
function turnDate(i) {
  const sc = schedule(), L = sc[0].length, base = new Date(S.birthYear + S.age, i < L ? 2 : 8, 1);
  base.setDate(base.getDate() + Math.floor((i % L) * 182 / L));
  return base;
}
const dateOf = () => new Date(S.date.y, S.date.m - 1, S.date.d);
const dow = () => dateOf().getDay();
const isWeekend = () => { const d = dow(); return d === 0 || d === 6; };
function rollWeather() { const se = SEASONS[SEASON_OF(S.date ? S.date.m : 3)]; return weighted(Object.keys(se.weather), k => se.weather[k]); }
// 하루 넘기기 — 달이 바뀌면 monthly, 3월 1일이면 한 살(advanceYear), 계절이 바뀌면 enterSeason
function nextDay() {
  const dt = dateOf(); dt.setDate(dt.getDate() + 1);
  const pm = S.date.m;
  S.date = { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  S.dayN = (S.dayN || 0) + 1;
  if (S.date.m === pm) return;
  if (S.date.m === 3) { advanceYear(); if (S.ended) return; }
  monthly();
  const si = SEASON_OF(S.date.m);
  if (si !== S.seasonIdx) enterSeason(si);
}
// 그 날짜까지 하루씩 (선택지가 걸리면 거기서 멈춤 — stop이 true면)
function goToDate(dt, stop) {
  let guard = 0;
  while (dateOf() < dt && !S.ended && guard++ < 400) { nextDay(); if (stop && S.pending.length) return false; }
  return true;
}
// 하루의 때 (배경·술집): 어른은 시계, 학교 다닐 땐 턴 종류, 어릴 땐 계절 안에서 천천히
function updateTime() {
  const ph = phase();
  if (ph === 'adult') { const h = 6 + (S.used || 0) * 1.5; S.sky = clamp((h - 6) / 6, 0, 2); S.time = h < 11 ? 0 : h < 17 ? 1 : 2; }
  else if (ph === 'story') { S.sky = .4; S.time = 0; }
  else { S.sky = S.tkind === 'vac' ? .6 : 1.3; S.time = 1; }
}
// 시계 (어른): 아침 6시 + 쓴 칸 × 1.5시간
const clockOf = used => { const m = Math.round((6 + used * 1.5) * 60) % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const SLOTS = [[2, '아침'], [4, '오전'], [5, '점심'], [9, '오후'], [11, '저녁'], [12, '밤'], [14, '새벽'], [18, '심야']];
const slotOf = used => (SLOTS.find(([n]) => used < n) || SLOTS[SLOTS.length - 1])[1];

/* ── 이야기 (0~12살) ── */
// 다음 선택지가 나오거나 해가 바뀔 때까지 시간이 흐름 (한 번에 한 계절씩)
function storyNext() {
  if (busy() || phase() !== 'story') return;
  const age0 = S.age;
  let guard = 0;
  while (!S.pending.length && !S.ended && S.age === age0 && guard++ < 400) {
    const si = S.seasonIdx;
    nextDay();
    if (S.seasonIdx !== si && (S.pending.length || S.age !== age0)) break;
  }
  if (S.age !== age0 && phase() !== 'story') beginPhase();
  after();
}

/* ── 학교 턴 (13~18살) ── */
function beginPhase() {
  const ph = phase();
  S.ph = ph;
  S.place = null; S.here = [];
  if (ph === 'ms' || ph === 'hs') { S.turn = 0; startTurn(); }
  else if (ph === 'adult') startDay(true);
  else { S.ap = 0; S.tkind = null; }
  updateTime();
}
// 이 턴 시작: 수업·시험은 자동으로 처리, 자유·방학은 행동력
function startTurn() {
  const k = turnKind(S.turn);
  S.tkind = k; S.used = 0; S.ap = jailed() ? 2 : TURN_AP[k] || 0;
  S.place = null; S.here = [];
  S.weather = rollWeather();
  updateTime();
  if (!jailed()) schoolTurn(k);
}
// 이번 턴을 끝내고(남은 행동은 쉬면서) 행동이 필요한 다음 턴까지 넘김 — 수업·시험 턴은 자동, 선택지가 걸리면 멈춤
function nextTurn() {
  if (busy() || !schedule()) return;
  if (S.ap > 0 && TURN_AP[S.tkind]) log(S.tkind === 'vac' ? '남은 방학은 집에서 뒹굴며 보냈다.' : '남은 시간은 쉬면서 보냈다.', { t: 'info', deltas: applyEffect({ health: S.ap >= 2 ? 1 : 0, happy: 1 }) });
  let guard = 0;
  do {
    advanceTurn();
    if (S.ended || S.report || S.apply) break;
  } while (!S.pending.length && !S.ap && schedule() && guard++ < 60);
  after();
}
function advanceTurn() {
  const age0 = S.age;
  S.turn++;
  if (S.turn >= turnsInYear()) {   // 학년도 끝 → 다음 3월 1일 (나이가 오르며 다음 단계일 수도)
    goToDate(yearStartDate(age0 + 1), false);
    beginPhase();
    return;
  }
  goToDate(turnDate(S.turn), false);
  startTurn();
}

/* ── 하루 (19살~) ── */
// 아침 6시: 전날 늦게 잤으면 그만큼 늦게 일어남. 주말 아침엔 피로가 풀림
function startDay(first) {
  const pen = S.wake || 0;
  S.wake = 0; S.used = pen; S.dayStart = pen; S.ap = DAY_AP + LATE_AP - pen; S.meals = 0; S.worked = false;
  S.place = null; S.here = []; S.zone = 'home'; S.drunk = 0;
  if (!first) S.weather = rollWeather();
  if (isWeekend() && (S.fatigue || 0) > 0) S.fatigue--;
  updateTime();
}
// 평일에 해야 하는 일 (직장 6칸 / 대학 수업 4칸 / 군 복무 8칸)
function dutyOf() {
  if (phase() !== 'adult' || jailed() || isWeekend()) return null;
  if (S.flags.inArmy) return { id: 'army', ap: 8, label: '훈련', zone: 'home' };
  if (S.job) return { id: 'work', ap: 6, label: '출근', zone: 'work' };
  if (S.flags.student && (S.school.start ?? 0) <= S.age) return { id: 'class', ap: 4, label: '수업', zone: 'school' };
  return null;
}
const dutyPending = () => !!dutyOf() && !S.worked;
// 출근·수업 (자동으로 칸을 씀). auto: 넘기는 중
function doDuty(auto) {
  const d = dutyOf();
  if (!d || S.worked || (!auto && busy())) return;
  S.worked = true;
  const n = Math.min(d.ap, Math.max(0, S.ap));
  S.ap -= n; S.used += n; S.zone = d.zone; S.place = null; S.here = [];
  updateTime();
  const tired = (S.fatigue || 0) >= 3 ? .6 : 1;
  if (d.id === 'work') {
    S.perf = clamp(S.perf + probRound((.12 + gIdx(S.stats.smart) * .02) * tired), 0, 100);
    if (!auto) log(pick(['출근했다. 하루가 길었다.', '회의, 메일, 회의. 퇴근길 하늘이 벌써 어두웠다.', '일을 마치고 퇴근했다.', '점심시간만 기다리며 오전을 버텼다.']), { t: 'info' });
    maybeRandom(['work', 'office', S.job], auto ? .01 : C.randomEventChance * .5);
  } else if (d.id === 'class') {
    S.school.studyYear += .02 * tired;
    if (!auto) log(pick(['강의실 맨 뒷자리에서 수업을 들었다.', '전공 수업 두 개를 듣고 나왔다.', '조별 과제 회의가 길어졌다.']), { t: 'info' });
    maybeRandom(['campus', 'study'], auto ? .01 : C.randomEventChance * .5);
  } else if (!auto) log('하루 종일 훈련을 받았다.', { t: 'info' });
}
// 잠자기 — 하루 끝. 밥을 거르면 건강이 깎이고, 새벽까지 깨 있었으면 다음 날 늦게 일어나고 피로가 쌓임
function endDay(auto) {
  const h0 = S.stats.health;
  S.companion = null;   // 동행은 그날까지
  if (dutyPending()) {   // 출근·수업을 빼먹음
    if (auto) doDuty(true);
    else if (S.job) { S.perf = clamp(S.perf - 4, 0, 100); log('출근을 안 했다. 휴대폰에 부재중 전화가 쌓였다.', { t: 'info', deltas: applyEffect({ happy: -1 }) }); }
    else log('수업을 빼먹었다.', { t: 'info' });
  }
  if (!auto) {
    const m = S.meals || 0;
    if (m < 2) log(m ? '오늘은 한 끼밖에 못 먹었다.' : '하루 종일 아무것도 안 먹었다.', { t: 'info', deltas: applyEffect({ health: m ? -1 : -2 }) });
    if (S.used >= 16) { S.wake = 4; S.fatigue = (S.fatigue || 0) + 2; log('해가 뜰 무렵에야 잠들었다.', { t: 'info', deltas: applyEffect({ health: -3 }) }); }
    else if (S.used >= 13) { S.wake = 2; S.fatigue = (S.fatigue || 0) + 1; log('새벽 늦게 잠들었다.', { t: 'info', deltas: applyEffect({ health: -1 }) }); }
  }
  libidoTick();
  if (S.drunk) soberUp();
  if ((S.fatigue || 0) >= 3) applyEffect({ health: -1 });
  // 제때 먹고 제때 자면 건강이 조금씩 회복 (나이·체력에 따른 기준선까지만)
  else if ((auto || (S.meals || 0) >= 2) && (S.used || 0) < 13 && S.stats.health < healthBase() && Math.random() < .3) S.stats.health++;
  if ((S.fatigue || 0) >= 5 && EVENTS.burnedOut && (S.dayN || 0) - (S.vars.burnDay ?? -99) > 30) { S.vars.burnDay = S.dayN; fire(EVENTS.burnedOut); }
  // 건강이 위험선 아래로 떨어진 날: 넘기기와 똑같이 경고 (밥·잠을 챙기라는 신호)
  if (!auto && h0 >= 30 && S.stats.health < 30) log('몸 상태가 심상치 않다. 밥을 챙겨 먹고 푹 자야 한다.', { t: 'info' });
  nextDay();
  if (S.ended) return;
  if (phase() === 'adult') startDay(); else beginPhase();
}
// 잘 먹고 잘 자면 돌아오는 건강 기준선: 30대부터 천천히 낮아지고, 체력 등급이 높으면 높음
const healthBase = () => clamp(Math.round(86 - Math.max(0, S.age - 30) * .8 + gIdx(S.stats.fit) * 2), 40, 96);
// 하루를 통째로 넘김 (출근·밥은 자동, 랜덤 이벤트는 하루에 조금)
function autoDay() {
  S.meals = 2;
  if (dutyPending()) doDuty(true);
  maybeRandom(['day'], C.dayEventChance);
  endDay(true);
}
// 넘기기: today 오늘 끝내기 / week 다음 월요일까지 / month 다음 달 1일까지 / event 무슨 일이 생길 때까지
// 멈추는 때: 선택지 이벤트(랜덤·계절·생일 다음 날·연인·가족·직장), 성욕 80 돌파, 건강 25 아래
function skip(kind) {
  if (busy() || phase() !== 'adult') return;
  S.stop = null;
  // 아직 아무것도 안 한 날이면 그날도 통째로 넘김 (밥·출근 자동), 뭔가 했으면 그 하루를 마무리
  if (kind !== 'today' && (S.used || 0) <= (S.dayStart || 0)) autoDay(); else endDay(false);
  if (kind !== 'today') {
    const lib0 = S.stats.libido, m0 = S.date.m, h0 = S.stats.health;
    let guard = 0;
    while (!S.pending.length && !S.ended && !S.stop && phase() === 'adult' && guard++ < 400) {
      if (kind === 'week' && dow() === 1) break;
      if (kind === 'month' && S.date.m !== m0 && S.date.d === 1) break;
      autoDay();
      if (S.stats.libido >= 80 && lib0 < 80) { S.stop = 'libido'; if (EVENTS.libidoRestless && eligible(EVENTS.libidoRestless)) fire(EVENTS.libidoRestless); }
      if (S.stats.health < 25 && h0 >= 25) S.stop = 'health';
    }
    if (S.stop === 'health') log('몸 상태가 심상치 않다.', { t: 'info' });
  }
  if (phase() !== 'adult') beginPhase();
  after();
}
// 밥 먹기 (1칸) — 하루 두 끼를 안 먹으면 건강이 깎임
function eat() {
  if (busy() || phase() !== 'adult' || S.ap <= 0) return;
  spend(1);
  S.meals = (S.meals || 0) + 1;
  const where = S.place ? PLACES[S.place].label : '집';
  log(pick(S.used <= 3 ? ['토스트 한 장으로 아침을 때웠다.', '아침밥을 든든하게 먹었다.'] : S.used <= 7 ? ['점심을 먹었다.', `${where} 근처에서 점심을 먹었다.`, '김치찌개 한 그릇을 비웠다.'] : ['저녁을 먹었다.', '배달 음식을 시켜 먹었다.', '라면을 끓여 먹었다.']), { t: 'info', deltas: applyEffect({ health: 1 }) });
  after();
}
// 한 달마다: 월급·생활비·피임약값
function monthly() {
  if (S.date.m === S.month) { birthday(); if (phase() === 'adult') S.stop = S.stop || 'birthday'; }
  // 행복은 익숙해짐: 아주 높거나 낮으면 한 달에 1씩 가운데로
  if (S.stats.happy > 75) S.stats.happy -= Math.ceil((S.stats.happy - 70) / 10); else if (S.stats.happy < 35) S.stats.happy += Math.ceil((40 - S.stats.happy) / 10);
  if (S.job && !jailed()) { const j = job(S.job); S.money += j.volatile ? Math.round(rand(Math.round(S.salary * .2), S.salary * 2) / 12) : Math.round(S.salary / 12); }
  if (S.age >= 20 && !S.flags.student && !S.flags.inArmy && !jailed()) {
    const kids = alive().filter(p => p.kind === 'child').length;
    S.money -= Math.round((C.livingCost + (S.flags.married ? 600 : 0) + kids * 400) / 12);   // 가족이 늘면 생활비도 늘어남
  }
  if (S.flags.onPill) S.money -= rand(3, 5);   // 피임약값 (한 달 3~5만원)
}
// 화면용 시간 정보
function timeInfo() {
  const ph = phase(), d = S.date || { y: 2000, m: 3, d: 1 };
  const info = { phase: ph, y: d.y, m: d.m, d: d.d, dow: DOW[dow()], weekend: isWeekend(), season: SEASONS[SEASON_OF(d.m)], age: S.age };
  if (ph === 'adult') Object.assign(info, { clock: clockOf(S.used || 0), slot: slotOf(S.used || 0), used: S.used || 0, ap: S.ap, day: DAY_AP, lateMax: LATE_AP, late: (S.used || 0) >= DAY_AP,
    duty: dutyPending() ? dutyOf() : null, meals: S.meals || 0, fatigue: S.fatigue || 0, zone: ZONE_LABEL[S.zone || 'home'] });
  else if (ph === 'ms' || ph === 'hs') {
    const sc = schedule(), L = sc[0].length, g = S.age - (ph === 'ms' ? 12 : 15);
    Object.assign(info, { school: ph === 'ms' ? '중' : '고', grade: g > 3 ? '재수' : `${g}학년`, sem: S.turn < L ? 1 : 2, week: S.turn % L + 1, kind: S.tkind, kindLabel: TURN_LABEL[S.tkind] || '', ap: S.ap, apMax: TURN_AP[S.tkind] || (jailed() ? 2 : 0) });
  }
  return info;
}
// 확률 반올림: 1.3 → 70%로 1, 30%로 2
const probRound = v => { const f = Math.floor(v); return f + (Math.random() < v - f ? 1 : 0); };
// 행동으로 얻는 것의 배율 — 1년에 할 수 있는 행동이 단계마다 달라서 (예전 1년 10번 기준으로 맞춤)
const gainK = () => ({ story: 1, ms: .3, hs: .35, adult: .25 })[phase()];

// 랜덤 이벤트: on에 행동 id나 장소 id를 적으면 그때만 (맞는 태그가 있으면 두 배로 잘 뽑힘)
function maybeRandom(tags, chance = C.randomEventChance) {
  if (S.pending.length || Math.random() >= chance * ({ story: 0, ms: .8, hs: .8, adult: .45 })[phase()]) return;
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

/* ═════════ 학교 (SCHOOL.md) ═════════
   과목 원점수 = 과목 기본값(능력치 가중합) + 공부량 보정(다음 시험까지 공부한 만큼) + 수업 보정(수업 이벤트) + 컨디션 ±5 + 운
   → 9등급(data/school.js gradeCuts). 중학교는 공통 4과목, 고등학교는 공통 4 + 계열 선택 과목 */
const SUB = id => D.subjects.find(x => x.id === id) || D.subjects[0];
const COMMON = D.subjects.filter(x => x.common).map(x => x.id);
const UNIV = id => D.universities.find(u => u.id === id);
const DEPT = id => D.departments.find(d => d.id === id);
const inSchool = () => S.age >= D.schoolStart && (S.age <= 18 || phase() === 'hs') && !jailed();
const subjectsNow = () => phase() === 'hs' && S.school.electives && S.school.electives.length ? COMMON.concat(S.school.electives) : COMMON;
// 능력치(상한 없음) → 0~100
const lvl = v => Math.min(100, Math.max(0, (v || 0) * .9));
function subjBase(id) { const w = SUB(id).w; let t = 0; for (const k in w) t += lvl(S.stats[k]) * w[k]; return t; }
// 공부량 보정: 다음 시험까지 (시험이 끝나면 비워짐). 고등학교에서 공부한 횟수는 수능에 따로 쌓임
// 한 시험을 위해 쌓을 수 있는 건 과목당 20까지 (방학 내내 공부해도 다음 시험에 몰리지 않게)
function addPrep(id, n) { const sc = S.school; sc.prep = sc.prep || {}; sc.prep[id] = Math.min(20, Math.round(((sc.prep[id] || 0) + n) * 10) / 10); }
function addBonus(id, n) { const sc = S.school; sc.bonus = sc.bonus || {}; sc.bonus[id] = (sc.bonus[id] || 0) + n; }
// 이벤트에서 쓰던 '모든 과목 실력 +n' → 지금 과목들의 다음 시험 보정 (예전 과목 id kor/math/eng/sci도 받음)
function subjAll(n) { if (inSchool()) subjectsNow().forEach(k => addPrep(k, n)); }
const OLD_SUBJ = { kor: 'korean', math: 'math', eng: 'english', sci: null };
function subjAdd(k, n) { if (!inSchool()) return; const L = subjectsNow(); addPrep(k in OLD_SUBJ ? OLD_SUBJ[k] || L[L.length - 1] : k, n); }
// 지금 실력으로 본 예상 점수 평균 (운·컨디션 빼고)
const expScore = id => subjBase(id) + ((S.school.prep || {})[id] || 0) + ((S.school.bonus || {})[id] || 0);
const subjAvg = () => { const L = subjectsNow(); return L.reduce((t, k) => t + expScore(k), 0) / L.length; };
const gradeOfScore = sc => { const i = D.gradeCuts.findIndex(c => sc >= c); return i < 0 ? 9 : i + 1; };
const condBonus = () => clamp(Math.round((S.stats.health - 60) / 10 + (S.stats.happy - 55) / 10 - (S.fatigue || 0)), -5, 5);
// 시험 한 번: 과목마다 원점수·등급(+굴린 운), 평균 등급 → 성적표(S.report)
function sitExam(title, luck, extra) {
  const rows = subjectsNow().map(id => {
    const roll = rand(-luck, luck), sc = clamp(Math.round(expScore(id) + condBonus() + (extra ? extra(id) : 0) + roll), 0, 100);
    return { id, label: SUB(id).label, score: sc, grade: gradeOfScore(sc), roll };
  });
  return { title, rows, avg: Math.round(rows.reduce((t, r) => t + r.grade, 0) / rows.length * 10) / 10 };
}
const naesinAvg = () => S.school.naesin.length ? Math.round(S.school.naesin.reduce((a, b) => a + b, 0) / S.school.naesin.length * 10) / 10 : null;
const mockAvg = () => (S.school.mocks || []).length ? S.school.mocks.reduce((a, b) => a + b, 0) / S.school.mocks.length : null;
const gradeLabel = () => { const ph = phase(), g = S.age - (ph === 'ms' ? 12 : 15); return g > 3 ? '재수' : `${ph === 'ms' ? '중' : '고'}${g}`; };
// 수업 턴: 중학교는 자동(과목 하나에 진도 ±), 고등학교는 과목 하나를 골라 수업 이벤트
const CLASS_LINES = { ms: ['수업 주간. 졸린 5교시를 버텼다.', '수업 주간. 수행평가 공지가 떴다.', '수업 주간. 선생님 농담에 반 전체가 웃었다.', '수업 주간. 진도가 빠르게 나갔다.'],
  hs: ['야간 자율학습이 끝나니 밤 10시였다.', '판서를 받아 적느라 손목이 아팠다.', '매점 빵으로 버틴 한 주였다.', '모두가 조금씩 지쳐 있었다.'] };
function classTurn() {
  const ph = phase(), L = subjectsNow(), id = pick(L);
  if (ph === 'ms' || S.age >= 19) {   // 중학교·재수학원은 자동
    const d = rand(-1, 2);
    if (d) addBonus(id, d);
    log(`${pick(CLASS_LINES.ms)} ${SUB(id).label} 진도가 ${d > 0 ? '귀에 쏙쏙 들어왔다' : d < 0 ? '버거웠다' : '평소대로 나갔다'}.`, { t: 'info' });
    maybeRandom(['school', 'class'], C.randomEventChance);
    return;
  }
  const pool = D.classEvents.filter(e => e.subject === id), fresh = pool.filter(e => S.last[e.id] !== S.age);
  const ev = pick(fresh.length ? fresh : pool);
  if (!ev) { log(pick(CLASS_LINES.hs), { t: 'info' }); return; }
  S.vars.classSubj = id;
  S.done[ev.id] = (S.done[ev.id] || 0) + 1; S.last[ev.id] = S.age;
  const text = fill(ev.text), tv = {}; TRANSIENT.forEach(k => { tv[k] = S.vars[k]; });
  S.pending.push({ id: ev.id, text, tv, who: null });
  log(`📖 ${SUB(id).label} · ${text}`, { t: 'ask' });
}
// 중간·기말: 성적표. 고등학교는 시험마다 평균 등급이 내신에 쌓임
function examTurn(k) {
  const ph = phase(), Lh = schedule()[0].length, sem = S.turn < Lh ? 1 : 2, g = S.age - (ph === 'ms' ? 12 : 15);
  const r = sitExam(`${g > 3 ? '재수' : `${g}학년`} ${sem}학기 ${TURN_LABEL[k]}`, 10);
  r.school = ph === 'ms' ? '중학교' : '고등학교';
  S.school.exams.push({ title: r.title, avg: r.avg, age: S.age, ms: ph === 'ms' });
  if (ph === 'hs' && g <= 3) { S.school.naesin.push(r.avg); r.note = `내신 평균: ${naesinAvg().toFixed(1)}등급`; }
  S.school.prep = {}; S.school.bonus = {};
  log(`${r.school} ${r.title} — 평균 ${r.avg.toFixed(1)}등급.`, { t: 'info', deltas: applyEffect({ happy: r.avg <= 3 ? 3 : r.avg >= 7 ? -3 : 0 }) });
  S.report = r;
}
// 모의고사 (고2 11월, 고3 3·6·9월): 운이 더 크고(±15) 백분위로. 이대로면 어디까지 가능한지
function mockTurn() {
  const r = sitExam(`${S.date.m}월 모의고사`, 15);
  r.mock = true; r.rows.forEach(x => { x.pct = clamp(x.score + rand(-3, 3), 1, 99); });
  S.school.mocks.push(r.avg); S.school.mock = { avg: r.avg };
  const pred = mockAvg(), u = bestReach(pred);
  r.note = `모의고사 평균 ${pred.toFixed(1)}등급 · ` + (u ? `이대로 가면 ${u.name} 가능` : '이러다 큰일이다');
  log(`${r.title} — 평균 ${r.avg.toFixed(1)}등급. ${u ? `이대로 가면 ${u.short}도 노려볼 만하다.` : '이러다 큰일이다. 등골이 서늘했다.'}`, { t: 'info' });
  S.report = r;
}
// 이 등급(정시 가군 기준 ±.5)으로 갈 수 있는 가장 높은 대학
const bestReach = g => D.universities.filter(u => u.tier < 5).sort((a, b) => a.cut.정시가 - b.cut.정시가).find(u => g <= u.cut.정시가 + .5) || null;
// 수능: 과목 기본값 + 고교 공부 횟수 × .3(최대 18) + 내신·모의고사 보정(±4) + 전날 컨디션 + 운(±12). 재수면 +3
function takeCSAT() {
  const sc = S.school, n = naesinAvg(), m = mockAvg();
  const base = Math.min(18, (sc.studyN || 0) * .3) + (n != null ? clamp(5 - n, -4, 4) : 0) + (m != null ? clamp((5 - m) * .8, -4, 4) : 0) + (S.vars.csatCond || 0) + (S.age >= 19 ? 3 : 0);
  const r = sitExam(S.age >= 19 ? '두 번째 수능' : '대학수학능력시험', 12, () => base);
  r.csat = true;
  sc.sat = { avg: r.avg, rows: r.rows.map(x => ({ id: x.id, grade: x.grade, score: x.score })) };
  const exp = m ?? n ?? r.avg;
  r.note = r.avg <= exp - .5 ? '믿기지 않았다. 손이 떨렸다.' : r.avg <= exp + .5 ? '예상대로다.' : '눈물이 났다.';
  S.vars.satText = `수능 평균 ${r.avg.toFixed(1)}등급. ${r.note}`;
  log(`수능이 끝났다. 한 달 뒤, 성적표가 나왔다. 평균 ${r.avg.toFixed(1)}등급. ${r.note}`, { memory: true });
  S.report = r;
}
/* ── 원서: 수시(고3 1학기, 6개까지 — 내신) / 정시 가·나·다(수능). 합격 확률은 내 등급과 기준 등급의 차이로 ── */
// 의학과는 기준이 1등급 더 높음(cut_bonus). 수시 종합은 비교과(동아리·봉사·독서)와 자소서(성격)가 내신을 조금 끌어올림
function myGradeFor(kind) {
  if (kind === '종합') { const n = naesinAvg() ?? 9; return n - Math.min(.8, (S.school.extra || 0) * .04) - (['bold', 'sunny', 'warm'].includes(S.personality) ? .1 : 0); }
  if (kind === '교과') return naesinAvg() ?? 9;
  return S.school.sat ? S.school.sat.avg : 9;
}
function admitP(uid, did, kind) {
  const u = UNIV(uid), d = DEPT(did);
  if (!u || !d || !u.departments.includes(did)) return 0;
  const cut = (kind === '교과' || kind === '종합' ? u.cut.수시 : u.cut['정시' + kind]) + (d.cut_bonus || 0);
  const x = myGradeFor(kind) - cut;
  const p = x <= -.5 ? .92 + Math.min(.03, (-.5 - x) * .03) : x <= 0 ? lerp(.92, .65, (x + .5) / .5) : x <= .5 ? lerp(.65, .35, x / .5) : x <= 1.5 ? lerp(.3, .1, (x - .5)) : Math.max(.01, .05 - (x - 1.5) * .02);
  return Math.round(clamp(p, .01, .95) * 100) / 100;
}
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
// 원서를 쓰는 동안 시간은 멈춤 (S.apply) — 화면이 고르고 submitApply로 냄
function submitApply(list) {
  const ap = S.apply;
  if (!ap) return;
  list = (list || []).filter(x => x && UNIV(x.u) && DEPT(x.d) && UNIV(x.u).departments.includes(x.d)).slice(0, ap.kind === 'susi' ? 6 : 3);
  if (ap.kind === 'susi') {
    S.school.susi = list.map(x => ({ u: x.u, d: x.d, type: x.type === '종합' ? '종합' : '교과', p: admitP(x.u, x.d, x.type === '종합' ? '종합' : '교과') }));
    log(list.length ? `수시 원서 ${list.length}장을 냈다. ${list.map(x => UNIV(x.u).short).join(', ')}.` : '수시는 넣지 않았다. 정시로 승부한다.', { t: 'info' });
  } else {
    const gun = ['가', '나', '다'];
    S.school.jeongsi = list.map((x, i) => ({ u: x.u, d: x.d, gun: gun[i], p: admitP(x.u, x.d, gun[i]) }));
    log(list.length ? `정시 원서를 냈다. ${S.school.jeongsi.map(x => `${x.gun}군 ${UNIV(x.u).short} ${DEPT(x.d).name}`).join(' · ')}.` : '정시 원서를 내지 않았다.', { t: 'info' });
  }
  S.apply = null;
  after();
}
// 원서 접수 턴: 수시 결과 먼저 → 붙었으면 고르기, 아니면 정시 원서
function applyTurn() {
  const susi = S.school.susi || [];
  if (susi.length && !S.school.susiDone) {
    S.school.susiDone = true;
    const passed = susi.filter(x => Math.random() < x.p);
    log(passed.length ? `수시 발표. ${passed.map(x => `${UNIV(x.u).short} ${DEPT(x.d).name}`).join(', ')} 합격!` : '수시 발표. 모두 불합격이었다.', { t: passed.length ? 'mem' : 'info', memory: !!passed.length });
    if (passed.length) { S.school.offers = passed; trigger('pickUniv'); return; }
  }
  if (!S.flags.student) { S.apply = { kind: 'jeongsi', max: 3 }; log('정시 원서를 쓸 때다. 가·나·다군에 한 장씩.', { t: 'info' }); }
}
// 결과 발표 턴: 정시 합격(떨어졌어도 가능성이 남은 곳은 30% 추가 합격) → 고르기 / 전부 떨어지면 재수·취업·전문대
function resultTurn() {
  if (S.flags.student) return;
  const js = S.school.jeongsi || [], passed = [];
  for (const x of js) {
    if (Math.random() < x.p) passed.push(x);
    else if (x.p >= .15 && Math.random() < .3) { passed.push(x); log(`추가합격 통보가 왔다! ${UNIV(x.u).short} ${DEPT(x.d).name}.`, { memory: true }); }
  }
  if (js.length) log(passed.length ? `정시 발표. ${passed.map(x => `${UNIV(x.u).short}`).join(', ')} 합격!` : '정시 발표. 불합격...', { t: 'info' });
  if (passed.length) { S.school.offers = passed; trigger('pickUniv'); }
  else trigger('retakeChoice');
}
// 합격한 곳 중 하나로 (화면에서 큰 로고와 함께)
function admit(uid, did) {
  const u = UNIV(uid), d = DEPT(did);
  if (!u || !d) return;
  const sc = S.school;
  sc.univ = uid; sc.dept = did; sc.tier = u.tier; sc.start = S.age + 1;
  sc.years = d.years || (u.tier === 5 && did !== 'nursing' ? 2 : 4);
  sc.gpa = 0; sc.gpaN = 0; sc.offers = null;
  S.flags.student = true; delete S.flags.retake;
  S.report = { title: '합격', admit: { u: uid, d: did }, rows: [], note: `${u.name} ${d.name} 합격!` };
}
function graduate() {
  S.school.degree = (S.school.tier || 0) >= 5 ? 'associate' : 'bachelor';
  if (S.school.degree === 'bachelor') S.flags.degree = true;
  S.flags.anyDegree = true;
  delete S.flags.student;
}
const univLabel = () => { const u = UNIV(S.school.univ); return u ? u.name : null; };
const majorLabel = () => { const d = DEPT(S.school.dept); return d ? d.name : null; };
// 학교 턴 종류마다
function schoolTurn(k) {
  if (k === 'class') classTurn();
  else if (k === 'mid' || k === 'final') examTurn(k);
  else if (k === 'mock') mockTurn();
  else if (k === 'csat') trigger('csatEve');
  else if (k === 'apply') applyTurn();
  else if (k === 'result') resultTurn();
  else if (k === 'vac' && turnKind(S.turn - 1) !== 'vac') log(S.date.m >= 6 && S.date.m <= 8 ? '여름방학이 시작됐다.' : '겨울방학이 시작됐다.', { t: 'info', deltas: applyEffect({ happy: 2 }) });
  // 고3 1학기, 6월 모의고사 뒤 첫 자유 턴: 수시 원서
  if (k === 'free' && S.age === 18 && S.turn < schedule()[0].length && S.turn > 8 && !S.school.susi && !S.flags.student) { S.apply = { kind: 'susi', max: 6 }; log('수시 원서를 쓸 때다. 내신으로 6장까지.', { t: 'info' }); }
}

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
  S.place = null; S.here = []; S.drunk = 0;
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
  return !busy() && S.ap > 0 && !dutyPending() && phase() !== 'story' && !jailed() && S.age >= c.minAge && meets(c.req);
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
  // 외모 3층: 생김새는 40대부터 5년에 한 등급 / 꾸밈은 안 하면 떨어짐 / 몸은 운동 안 하면 빠짐 (40대는 운동해도 조금씩)
  if (a === 40 || a === 45) { st.face = gradeStep(st.face, -1); log('거울 속 얼굴에 세월이 보이기 시작했다.', { t: 'info' }); }
  if (a >= 13) st.style = Math.max(0, st.style - rand(D.styleDecay[0], D.styleDecay[1]));
  const ex = S.vars.exN || 0;
  if (a >= 20) {
    const loss = a < 30 ? (ex ? 0 : rand(0, 2)) : a < 40 ? (ex >= 2 ? 0 : rand(1, 3)) : (ex >= 3 ? rand(0, 1) : rand(2, 5));
    st.fit = Math.max(0, st.fit - loss);
  }
  S.vars.exN = 0;
  syncMyBody();
  if (st.happy > 65) st.happy--; else if (st.happy < 40) st.happy++;

  // 대학 학점: 공부한 만큼 + 지능 + 학과와 맞는 능력치
  if (S.flags.student && S.school.start != null && a > S.school.start) {
    const d = DEPT(S.school.dept), fit = d && d.stat ? gIdx(st[d.stat]) * .06 : 0;
    const y = clamp(1.8 + Math.min(S.school.studyYear, 6) * .3 + gIdx(st.smart) * .1 + fit + rand(-3, 3) / 10, 1, 4.5);
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
    if (p.acq) { if (!orgActive(p) && (p.close <= 5 || Math.random() < .5)) p.gone = true; continue; }   // 얼굴만 아는 사이: 반·직장·동네가 바뀌면 조용히 멀어짐
    const mine = p.partner || p.spouse || p.secret;
    p.close = clamp(p.close - (mine ? 2 : 3), 0, 100);
    p.heart = clamp(p.heart - (mine ? 3 : 2), 0, 100);
    p.grudge = clamp(p.grudge - 3, 0, 100);
    if (!mine && !p.married && npcAge(p) >= 24 && Math.random() < .05) p.taken = !p.taken;
    if (!mine && !p.debt && p.close <= 0 && p.grudge <= 0) { p.gone = true; log(`${josa(pname(p), '와')}는 연락이 끊겼다.`, { t: 'info' }); }
    else if (p.fwb && (p.close <= 20 || ((p.lastSat ?? 50) < 40 && Math.random() < .5))) { p.fwb = false; p.fling = false; log(`${josa(pname(p), '와')}의 관계는 흐지부지 끝났다.`, { t: 'info' }); }
  }

  // 일: 연봉, 성과, 승진
  if (S.job && !jailed()) {
    const j = job(S.job);   // 월급은 매달(monthly)
    if (j.happy) applyEffect({ happy: j.happy });
    if (S.rank < j.ranks.length - 1 && Math.random() < .04 + S.perf / 220) {
      S.rank++; S.perf = Math.max(0, S.perf - 35);
      S.salary = Math.round(j.salary * (1 + .25 * S.rank) / 10) * 10;
      log(`${j.ranks[S.rank]}${josa(j.ranks[S.rank], '으로').slice(j.ranks[S.rank].length)} 승진했다! 연봉 ${fmtMoney(S.salary)}.`, { memory: true });
    } else S.salary = Math.round(S.salary * 1.02);
    S.perf = clamp(S.perf - 8, 0, 100);
  }
  // 어른 NPC 직업 붙이기, 나이에 안 맞게 된 단골 장소 바꾸기, 성욕 (20살부터, 나이 들수록 천천히)
  for (const p of alive()) {
    const na = npcAge(p);
    // 나를 향한 성욕: 나에게 끌리는 만큼(설렘, 내 몸이 취향, 함께 보낸 밤) 해마다 쌓임
    if (canSex(p) && !p.acq) p.libido = clamp((p.libido || 0) + Math.round(rand(6, 14) * (na < 30 ? 1.2 : na < 40 ? 1 : .7) * (.4 + p.heart / 80 + (figPref(p) || prefMatch(p) ? .2 : 0) + (p.nights ? .3 : 0))), 0, 100);
    else if (!lover(p)) p.libido = 0;
    if (!p.npcJob && npcAge(p) >= 23 && p.kind !== 'family') p.npcJob = pick(D.npcJobs);
    if (p.hangout && !ageFits(PLACES[p.hangout], npcAge(p))) p.hangout = pickHangout(p.hobby, npcAge(p));
  }
  // 생활비·피임약값은 매달(monthly)
  if (S.money < 0 && a >= 20) log('통장 잔고가 마이너스다.', { deltas: applyEffect({ happy: -4 }) });
  if (!jailed()) rumorYear();
  // 말 한 번 안 해보고 멀어진 '얼굴만 아는 사람'은 저장에서 지움 (관계였던 사람은 기록으로 남김)
  S.people = S.people.filter(p => !(p.gone && p.acq && p.id !== S.vars.fp));
  // 내 성욕: 떠난 사람·더는 안 되는 사람은 지우고, 사귀는 사이가 아니면 한 해에 10%씩 식음
  for (const id in S.lust) { const p = person(id); if (!p || !canSex(p)) delete S.lust[id]; else if (!lover(p) && !p.fwb) S.lust[id] = Math.round(S.lust[id] * .9); }
  syncLibido();

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
  for (const p of alive()) {
    if (p.married && !p.marriedKnown && p.close >= 40) { p.marriedKnown = true; log(`알고 보니 ${josa(pname(p), '은')} 결혼한 사람이었다.`, { t: 'info' }); }
    if (p.divorced && !p.divorcedKnown && Math.max(p.close, p.trust) >= 40) p.divorcedKnown = true;
  }
  if (!S.ended) ensurePools();
  if (S.lust) syncLibido();
  if (!S.ended) {
    if (S.stats.health <= 0) { S.ended = 'death'; S.pending = []; }
    else if (S.age >= C.endAge && !S.pending.length) S.ended = 'fifty';
  }
  // 단계가 바뀌면(예: 재수하다 대학에 붙음) 그 단계로 시작
  if (!S.ended && S.date) { const ph = phase(); if (S.ph !== ph) { const was = S.ph; S.ph = ph; if (was) beginPhase(); } }
  // 학교: 자유·방학 턴의 행동을 다 쓰면 다음 턴으로 / 어른: 18칸을 다 쓰면 쓰러지듯 잠듦
  if (!S.ended && !S.pending.length && !S.report && !S.apply && !S.intro) {
    const ph = phase();
    if ((ph === 'ms' || ph === 'hs') && S.ap <= 0 && TURN_AP[S.tkind]) { nextTurn(); return; }
    if (ph === 'adult' && S.ap <= 0) { log('더는 버틸 수 없어 그대로 잠들었다.', { t: 'info' }); endDay(false); }
  }
  save(); emit();
}
// 3월 1일: 한 살 (학년도가 바뀜)
function advanceYear() {
  S.age++;
  S.seasonIdx = -1;
  S.drunk = 0;
  S.log.push({ n: ++S.seq, t: 'year', age: S.age });
  if (S.age === 13) settleChildhood();
  // 고등학교 때 사귄 사이: 스무 살을 앞두고 이어지거나(친밀 50+) 흐지부지
  if (S.age === 19) for (const p of alive().filter(x => x.teenLove)) {
    p.teenLove = false;
    if (p.close >= 50 && canRomance(p) && !mainPartner()) { startRelation(p, false); p.heart = Math.max(p.heart, 50); log(`졸업하고도 ${josa(pname(p), '와')}는 계속 만나기로 했다.`, { memory: true }); }
    else log(`${josa(pname(p), '와')}는 졸업과 함께 자연스럽게 멀어졌다.`, { t: 'info' });
  }
  yearly();
}
// 13살: 어린 시절 선택들이 기운 쪽으로 성격·가치관이 굳어짐 (처음 고른 쪽은 3점에서 시작)
function settleChildhood() {
  const top = (map, cur) => { const w = Object.assign({}, map); w[cur] = (w[cur] || 0) + 3; return Object.keys(w).sort((a, b) => w[b] - w[a])[0]; };
  const np = top(S.lean || {}, S.personality), nv = top(S.vlean || {}, S.value);
  if (np !== S.personality) { S.personality = np; log(`어느새 ${labelOf(D.personalities, np)}이 됐다. 어릴 적 선택들이 쌓인 결과였다.`, { t: 'info' }); }
  if (nv !== S.value) { S.value = nv; log(`'${labelOf(D.values, nv)}'이 제일 소중하다고 생각하게 됐다.`, { t: 'info' }); }
}

/* ═════════ 행동 ═════════ */
const busy = () => !!S.ended || S.pending.length > 0 || !!S.report || !!S.apply || !!S.intro;
// 행동력 쓰기 (어른은 시계가 1.5시간씩 감)
function spend(n = 1) { S.ap -= n; S.used = (S.used || 0) + n; updateTime(); if (phase() !== 'adult') libidoTick(); }
const apOf = a => phase() === 'adult' ? (a.ap || 1) : 1;
const costOf = a => a.cost && S.age >= 18 ? resolve(a.cost) : 0;
// 지금 있는 장소에서 할 수 있는 행동 (수감 중엔 교도소 행동)
function actionList() {
  if (jailed()) return D.jailActions;
  const pl = PLACES[S.place];
  if (!pl) return [];
  return pl.actions.map(id => ACTIONS[id]).filter(a => a && S.age >= a.minAge && (a.maxAge == null || S.age <= a.maxAge) && meets(a.req) && (!a.if || a.if(S)) && !(a.id === 'parttime' && S.flags.inArmy));
}
function canDo(a) { return !busy() && S.ap >= apOf(a) && !dutyPending() && (!costOf(a) || S.money >= costOf(a)); }
const needsSubject = a => a.id === 'study' && inSchool();
// 공부할 과목 고르기 화면용: 지금 과목들의 예상 점수
const studyInfo = () => subjectsNow().map(id => ({ id, label: SUB(id).label, exp: Math.round(expScore(id)), prep: Math.round((S.school.prep || {})[id] || 0) }));
function doAction(id, subj) {
  const a = actionList().find(x => x.id === id);
  if (!a || !canDo(a)) return;
  spend(apOf(a));
  const gk = gainK();
  if (a.id === 'study') {
    const deltas = applyEffect(a.effect, gk);
    if (inSchool()) {   // 다음 시험 보정: 골고루면 과목마다 3~5, 한 과목이면 8~10. 고등학교 공부 횟수는 수능에도
      const L = subjectsNow(), list = subj && L.includes(subj) ? [subj] : L;
      list.forEach(k => { const g = list.length > 1 ? rand(3, 5) : rand(8, 10); addPrep(k, g); deltas.push([SUB(k).label, g]); });
      if (phase() === 'hs') S.school.studyN = (S.school.studyN || 0) + 1;
    }
    if (S.flags.student) S.school.studyYear += gk;
    log(fill(textOf(a.text)), { deltas });
    maybeRandom([a.id, S.place]); after(); return;
  }
  if (a.work) S.perf = clamp(S.perf + probRound((val(a.perf || [6, 12]) + gIdx(S.stats.smart)) * gk), 0, 100);
  if (a.escape) {
    const ok = S.stats.health + S.stats.smart + rand(-30, 30) >= 120;
    if (ok) { escape(true); log('한밤중에 담을 넘었다. 이제 쫓기는 몸이다.', { memory: true }); addKarma(-10); }
    else { escape(false); log('탈옥하다 붙잡혔다. 형기가 2년 늘었다.'); }
    after(); return;
  }
  if (a.id === 'exercise' || a.id === 'play') S.vars.exN = (S.vars.exN || 0) + 1;
  asList(a.set).forEach(f => { S.flags[f] = true; });
  asList(a.unset).forEach(f => { delete S.flags[f]; });
  if (a.drunk) drinkUp(a.drunk);
  if (a.id === 'rest' && S.fatigue) S.fatigue--;   // 쉬면 피로가 풀림
  const deltas = libidoDelta(a.libido, null).concat(applyEffect(a.effect, gk));
  const c = costOf(a);
  if (c) deltas.push(...applyEffect({ money: -c }));
  if (a.subjAll && inSchool()) { const g = val(a.subjAll); subjectsNow().forEach(k => addPrep(k, g)); deltas.push(['모든 과목', g]); if (phase() === 'hs') S.school.studyN = (S.school.studyN || 0) + .5; }
  if (a.extra && inSchool()) S.school.extra = (S.school.extra || 0) + val(a.extra);   // 비교과: 동아리·봉사·독서 (수시 종합)
  addKarma(a.karma);
  log(fill(textOf(a.text)), { deltas, memory: a.memoryChance ? Math.random() < a.memoryChance : false });
  maybeRandom([a.id, S.place]);
  after();
}

/* ═════════ 장소 ═════════ */
// 구역 (어른): 같은 구역 안은 공짜로 드나들고, 다른 구역은 1칸, 여행지(터미널)는 2칸
const ZONE = { home: 'home', conveni: 'home', playground: 'home', school: 'school', academy: 'school', library: 'school', campus: 'school',
  cafe: 'downtown', mall: 'downtown', gym: 'downtown', concert: 'downtown', bar: 'downtown', pcbang: 'downtown', motel: 'downtown',
  office: 'work', park: 'out', market: 'out', church: 'out', hospital: 'out', center: 'out', station: 'travel' };
const ZONE_LABEL = { home: '집 근처', school: '학교 쪽', downtown: '번화가', work: '직장', out: '외곽', travel: '여행지' };
function travelCost(pl) {
  const ph = phase();
  if (ph !== 'adult') return 1;
  const z = ZONE[pl.id] || 'out';
  return z === 'travel' ? 2 : z === (S.zone || 'home') ? 0 : 1;
}
const ageFits = (pl, age) => !!pl && age >= (pl.minAge || 0) && (pl.maxAge == null || age <= pl.maxAge);
function pickHangout(hobby, age) {
  if (age < 13) return Math.random() < .6 ? (age >= 4 ? pick(['playground', 'park']) : null) : null;
  const list = (D.hangoutByHobby[hobby] || []).filter(id => ageFits(PLACES[id], age) && !PLACES[id].night);
  return list.length && Math.random() < .75 ? pick(list) : null;
}
function placeOpen(pl) {
  if (jailed() || !ageFits(pl, S.age) || !phaseFits(pl)) return false;
  if (pl.night && S.time !== 2) return false;
  return !pl.open || !!pl.open(S, api);
}
function closedWhy(pl) {
  if (pl.night && S.time !== 2) return '저녁에만';
  if (pl.open && !pl.open(S, api)) return pl.closed || '지금은 못 감';
  return '';
}
// 장소 목록 (나이에 맞는 곳만). ok: 지금 갈 수 있는지
// 중학생은 갈 수 있는 곳이 적음 (집·학교·공원·도서관·학원·편의점·시장), 어린 시절엔 장소 없이 이야기만
const phaseFits = pl => { const ph = phase(); return ph !== 'story' && (ph !== 'ms' || !!pl.ms); };
function placeList() {
  if (jailed() || phase() === 'story') return [];
  return D.places.filter(pl => ageFits(pl, S.age) && phaseFits(pl)).map(pl => {
    const cost = travelCost(pl);
    return { id: pl.id, label: pl.label, icon: pl.icon, why: closedWhy(pl), regular: !!S.regular[pl.id], cost, zone: ZONE_LABEL[ZONE[pl.id] || 'out'],
      ok: !busy() && S.ap >= cost && (cost || S.ap > 0) && !dutyPending() && placeOpen(pl) };
  });
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
function makeStranger(pl, night, lead) {
  let type = (night && pl.nightCrowd) || pl.crowd;
  if (Array.isArray(type)) type = pick(type);
  const E = D.encounter, fr = pl.id === 'conveni' && clockHour() >= 21 ? E.femaleRatio.conveniNight : E.femaleRatio[pl.id] ?? .5;
  const la = lead ? npcAge(lead) : 0;
  const p = makePerson({
    kind: pl.kind || 'friend', gender: Math.random() < fr ? 'f' : 'm',
    ageRange: lead ? [Math.max(pl.minAge || 0, la - 4), Math.min(pl.maxAge ?? 99, la + 4)] : crowdRange(type), hangout: pl.id,
    personality: lead && Math.random() < .5 ? lead.personality : undefined,   // 일행끼리는 비슷한 사람
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
// 장소에 도착하면 (NPC_ENCOUNTER.md): 아는 사람은 한 명씩 재출현 확률을 굴려 장소별 수까지, 처음 보는 사람은 장소별 수 × 시간대·요일·날씨, 40%는 일행과 같이
//   집은 같이 사는 사람 (regulars 함수)
function fillHere(pl, bring, night) {
  const here = [], taken = [], E = D.encounter, inHere = new Set();
  const add = (p, x, grp, doing) => {
    const d = doing || (grp ? pick(E.groupDoing[pl.id] || E.groupDoing._) : doingFor(pl, p, night, taken));
    taken.push(d); inHere.add(p);
    here.push({ key: p.id, x: x ? p : undefined, doing: d, used: false, grp: grp || undefined });
    if (!x) p.seen = S.dayN || 0;
  };
  if (bring) add(bring);
  if (typeof pl.regulars === 'function') {
    const cands = pl.regulars(S, api).filter(p => p !== bring && ageFits(pl, npcAge(p)));
    const [lo, hi] = pl.regularsN || [1, 2];
    for (const p of shuffle(cands).slice(0, rand(lo, hi))) add(p);
    return here;
  }
  const [kn, st] = E.count[countKey(pl)] || [[1, 2], pl.crowdN || [0, 2]], m = crowdMult(pl);
  // 아는 사람: 이 장소가 단골 장소·소속(학교·직장)·동네면 잘 나옴. 일행(group)이 있으면 같이 올 때가 많음
  const nK = Math.round(rand(kn[0], kn[1]) * m);
  const hits = shuffle(alive().filter(p => p !== bring && p.kind !== 'family' && p.kind !== 'child' && ageFits(pl, npcAge(p)) && Math.random() < encounterChance(p, pl)));
  for (const p of hits) {
    if (here.length - (bring ? 1 : 0) >= nK || here.length >= E.maxHere) break;
    if (inHere.has(p)) continue;
    add(p);
    for (const id of p.group || []) { const g = person(id); if (g && !inHere.has(g) && here.length < E.maxHere && ageFits(pl, npcAge(g)) && Math.random() < .7) add(g, false, null, '일행과 함께'); }
  }
  // 처음 보는 사람 (일행은 한 줄로)
  if (pl.crowd) {
    let nS = Math.min(Math.round(rand(st[0], st[1]) * m * weatherMult()), E.maxHere - here.length);
    while (nS > 0) {
      const size = Math.min(nS, groupRoll(pl)), lead = makeStranger(pl, night), grp = [];
      for (let k = 1; k < size; k++) grp.push(makeStranger(pl, night, lead));
      add(lead, true, grp.length ? grp : null);
      nS -= size;
    }
  }
  return here;
}
function enterPlace(pl, bring, night = S.time === 2) {
  S.place = pl.id; S.placeNight = night;
  S.here = fillHere(pl, bring, night);
  S.vars.placeLabel = pl.label;
}
// 장소에 가기 (행동 1). 거기 있는 사람에겐 행동 없이 한 번씩 말을 걸 수 있음
// 동행 — 잠자리 제안·가볍게 즐기기를 받아준 사람이 오늘 하루 같이 다님 (모텔·집으로). 하루가 끝나거나 그날 밤을 보내면 헤어짐
const companion = () => { const p = S.companion && person(S.companion); return p && canSex(p) ? p : null; };
function setCompanion(p) { S.companion = p ? p.id : null; }
function goPlace(id) {
  const pl = PLACES[id];
  const cost = pl ? travelCost(pl) : 0;
  if (!pl || busy() || S.ap < cost || S.ap <= 0 || dutyPending() || !placeOpen(pl)) return;
  const night = S.time === 2;   // 사람은 도착한 때(행동 쓰기 전) 기준으로 채움
  if (S.drunk && ZONE[pl.id] !== ZONE[S.place]) soberUp();
  if (cost) spend(cost);
  S.zone = ZONE[pl.id] || 'out';
  enterPlace(pl, companion(), night);   // 동행은 같이 옴
  log(`${pl.icon} ` + fill(textOf(pl.arrive) || `${josa(pl.label, '으로')} 갔다.`), { t: 'place' });
  if (!pl.routine) {
    S.visits[id] = (S.visits[id] || 0) + 1;
    if (S.visits[id] >= D.regularVisits && !S.regular[id]) { S.regular[id] = true; log(`이제 ${pl.label} 단골이다. 얼굴을 알아보는 사람이 생겼다.`, { t: 'info' }); }
  }
  maybeRandom([id], cost ? C.placeEventChance : C.placeEventChance / 2);
  after();
}
function leavePlace() {
  if (!S.place || S.ended) return;
  if (S.drunk) soberUp();
  S.place = null; S.here = [];
  save(); emit();
}
// 여기 있는 사람들 (화면용)
function hereList() {
  if (!S.place) return [];
  return S.here.map(h => ({ key: h.key, stranger: !!h.x, p: h.x || person(h.key), doing: h.doing, used: h.used, grp: (h.grp || []).length })).filter(h => h.p);
}
const hereEntry = pid => S.place ? S.here.find(h => h.key === pid && !h.x) : null;
// 처음 보는 사람에게 말 걸기 (행동 안 씀). 잘 되면 관계 목록에 들어감
function talkTo(key) {
  const h = S.place && S.here.find(x => x.key === key && x.x);
  if (!h || h.used || busy()) return null;
  h.used = true;
  const x = h.x, pt = personality(x);
  const odds = clamp(.2 + allure(x, 'first') / 55 + (pt.open || 0) + (trait().relMult ? .1 : 0) + (x.ringOff && D.encounter.ringOffAt.includes(S.place) ? .1 : 0), .15, .95);   // 첫인상은 생김새·꾸밈이 크게
  if (Math.random() >= odds) {
    log(fill('처음 보는 사람에게 말을 걸었다. ' + pt.snub), { deltas: applyEffect({ happy: -1 }) });
    after();
    return null;
  }
  delete h.x;
  const p = enlist(x);
  h.key = p.id;
  // 일행: 대표와 이야기하면 나머지도 인사를 나눔 → 관계 목록에 (서로 아는 사이)
  const grp = (h.grp || []).map(m => { m.close = rand(3, 8); m.trust = rand(3, 6); const q = enlist(m); S.here.push({ key: q.id, doing: '일행과 함께', used: false }); return q; });
  delete h.grp;
  if (grp.length) { const ids = [p.id, ...grp.map(q => q.id)]; for (const q of [p, ...grp]) q.group = ids.filter(id => id !== q.id); }
  const fl = firstLook(), romantic = canRomance(p);
  const deltas = applyP(p, { close: [6, 12], trust: [3, 7], heart: romantic ? [Math.max(0, (fl - 2) * 3), Math.max(3, (fl - 1) * 4)] : 0 });
  const hello = S.age < 13 ? pick(D.kidHello) : pt.hello;
  const react = romantic ? ' ' + D.faceReact.first[LETTERS[fl]] : '';
  log('처음 보는 사람에게 말을 걸었다. ' + fill(hello + react, { p: pname(p) }) + (grp.length ? ` 일행 ${josa(grp.map(pname).join(', '), '와')}도 인사를 나눴다.` : ''), { deltas });
  after();
  return p.id;
}

/* ═════════ NPC 출현 (NPC_ENCOUNTER.md, data/encounter.js) ═════════
   사람 풀(이웃·같은 반·같은 과·선후배·팀·타 부서·단골·상인)은 '얼굴만 아는 사이'(acq)로 들어와 소속이 같을 때 학교·직장·동네에 나옴
   재출현 확률: 단골 장소 .6 / 소속 장소 .7 / 이웃은 동네 .4 / 같은 구역 .1 / 우연 .02 (친할수록·연인이면 더, 180일 넘게 못 봤으면 거의 안 나옴)
   기혼: 나이별 확률, 85%는 반지 (일부는 술집·번화가에서 뺌). 이름 옆 마커: 💍 확실히 기혼(친밀 40) / 💍❓ 반지를 봄(친밀 20) / 💍✕ 이혼 */
const marriedChance = age => age < 19 ? 0 : (D.encounter.married.find(([max]) => age <= max) || [0, .8])[1];
function ringFor(p) { const E = D.encounter; p.ring = Math.random() < E.ringWear; p.ringOff = p.ring && Math.random() < E.ringOff / E.ringWear; }
const ringVisible = p => !!p && !!p.married && !!p.ring && !(p.ringOff && D.encounter.ringOffAt.includes(S.place));
function marker(p) {
  if (!p || p.kind === 'family' || p.kind === 'child' || p.spouse || npcAge(p) < 19) return '';
  if (p.divorced && (p.divorcedKnown || Math.max(p.close, p.trust) >= 40)) return '💍✕';
  if (p.married && p.marriedKnown) return '💍';
  if (p.married && p.close >= 20 && ringVisible(p)) return '💍❓';
  return '';
}
// 결혼 여부 (프로필): 친밀 40이면 확정, 20~39는 반지를 봤으면 추정
function marriageText(p) {
  if (p.kind === 'family' || p.kind === 'child' || npcAge(p) < 19) return undefined;
  const deep = Math.max(p.close, p.trust);
  if (p.married && p.marriedKnown) return '기혼';
  if (p.divorced && (p.divorcedKnown || deep >= 40)) return '이혼';
  if (!p.married && deep >= 40) return '미혼';
  if (p.married && p.close >= 20 && ringVisible(p)) return '반지를 끼고 있다 (기혼 추정)';
  return null;
}
// 친밀 20~39인 기혼자와 이야기하다 보면 새어 나오는 것
function marriedHint(p) {
  const L = D.encounter.marriedHints.filter(h => (!h.gender || h.gender === p.gender) && (!h.at || h.at === S.place) && (!h.ringOff || p.ringOff) && (!h.ring || ringVisible(p)));
  if (L.length) log(fill(pick(L).t), { t: 'info' });
}
// 소속: 지금도 그 반·과·직장·동네에 있는지
function orgActive(p) {
  const o = p.org, V = S.vars;
  if (!o) return false;
  if (o.startsWith('nb')) return o === V.nbOrg;
  if (o === 'ms' || o === 'hs') return phase() === o;
  if (o.startsWith('univ')) return !!S.flags.student && o === V.univOrg;
  if (o.startsWith('job')) return !!S.job && o === V.jobOrg;
  return o.startsWith('reg');
}
const orgPlace = p => { const o = p.org || ''; return o === 'ms' || o === 'hs' ? 'school' : o.startsWith('univ') ? 'campus' : o.startsWith('job') ? 'office' : null; };
const faded = p => !lover(p) && !orgActive(p) && (S.dayN || 0) - (p.seen ?? S.dayN ?? 0) > D.encounter.fadeDays;
function encounterChance(p, pl) {
  let b;
  if (p.hangout === pl.id) b = .6;
  else if (orgPlace(p) === pl.id && orgActive(p)) b = .7;
  else if (p.kind === 'neighbor' && orgActive(p) && ZONE[pl.id] === 'home') b = .4;
  else if (p.hangout && ZONE[p.hangout] === ZONE[pl.id]) b = .1;
  else b = .02;
  if (p.close >= 60) b *= 1.4;
  if (p.close >= 80) b *= 1.3;
  if (p.partner || p.fwb) b *= 1.5;
  if (faded(p)) b *= .05;   // 소원해짐 — 우연히 마주치면 다시 이어짐
  return Math.min(b, .95);
}
const clockHour = () => 6 + (S.used || 0) * 1.5;
// 학교 수업 / 점심·방과 후, 직장 근무 / 점심·퇴근 (중·고등학교 자유 턴은 방과 후)
function countKey(pl) {
  const h = clockHour(), adult = phase() === 'adult';
  if (pl.id === 'school') return 'schoolAfter';
  if (pl.id === 'campus') return adult && h < 12 ? 'campus' : 'campusAfter';
  if (pl.id === 'office') return h >= 9 && h < 18 ? 'office' : 'officeAfter';
  return pl.id;
}
// 시간대·요일 보정 (어른 하루만 — 학교 다닐 땐 늘 방과 후)
function crowdMult(pl) {
  if (phase() !== 'adult') return 1;
  const h = clockHour(), id = pl.id, d = dow();
  let m = h < 9 ? .5 : h < 18 ? 1 : h < 21 ? (id === 'bar' || id === 'mall' ? 1.5 : .8) : h < 24 ? (id === 'bar' ? 2 : id === 'conveni' ? 1.3 : .3) : (id === 'conveni' ? .8 : .1);
  if (d === 0 || d === 6) { if (['park', 'mall', 'cafe'].includes(id)) m *= 1.5; if (['school', 'campus', 'office'].includes(id)) m = 0; }   // 주말: 학교·직장은 쉼
  if (d === 5 && h >= 18 && id === 'bar') m *= 2.5;   // 불금
  return m;
}
const weatherMult = () => ({ rain: .6, storm: .6, snow: .4, sleet: .4 })[S.weather] || 1;
const groupRoll = pl => weighted(D.encounter.groupSize.filter(([n]) => n < 4 || pl.id === 'bar'), g => g[1])[0];
// 사람 풀 — 얼굴만 아는 사이로 들어옴 (말을 걸거나 무슨 일이 생기면 관계로)
function poolPerson(spec, org, tag) {
  const p = addPerson(Object.assign({ close: rand(2, 10), trust: rand(2, 10) }, spec));
  p.org = org; p.acq = true;
  if (tag) p.tag = tag;
  return p;
}
const ageSpec = (lo, hi) => ({ ageDiff: rand(lo, hi) - S.age });
function ensurePools() {
  if (!S || !S.date || !D.encounter) return;
  const E = D.encounter, P = E.pools, V = S.vars, ph = phase();
  const n = range => rand(range[0], range[1]);
  // 이웃 (시작할 때, 이사하거나 결혼하면 새 동네)
  const home = S.flags.married ? 'married' + (V.marriedAt ?? '') : S.flags.ownPlace ? 'own' : 'parents';
  if (V.nbHome !== home) {
    V.nbHome = home; V.orgN = (V.orgN || 0) + 1; V.nbOrg = 'nb' + V.orgN;
    for (let i = n(P.neighbors); i > 0; i--) {
      const r = Math.random(), age = r < .5 ? rand(Math.max(25, S.age + 10), Math.max(70, S.age + 30)) : r < .8 ? rand(Math.max(0, S.age - 3), S.age + 3) : rand(Math.max(0, S.age - 10), S.age + 15);
      const spots = E.neighborSpots.filter(id => ageFits(PLACES[id], age));
      poolPerson(Object.assign({ kind: 'neighbor', hangout: spots.length && Math.random() < .7 ? pick(spots) : null }, ageSpec(age, age)), V.nbOrg);
    }
  }
  // 중학교·고등학교: 같은 반 (고등학교는 선배도)
  if ((ph === 'ms' || ph === 'hs') && S.age <= 18 && !V['pool_' + ph]) {
    V['pool_' + ph] = 1;
    for (let i = n(P.classmates); i > 0; i--) poolPerson({ kind: 'classmate', ageDiff: 0 }, ph);
    if (ph === 'hs') for (let i = n(P.seniors); i > 0; i--) poolPerson({ kind: 'classmate', ageDiff: pick([1, 1, 2]) }, ph, '선배');
  }
  // 대학: 같은 과 + 선후배 (학교에 다니기 시작한 해부터)
  if (S.flags.student && S.school.univ && (S.school.start ?? 99) <= S.age) {
    const org = `univ:${S.school.univ}:${S.school.start}`;
    if (V.univOrg !== org) {
      V.univOrg = org;
      for (let i = n(P.classmates); i > 0; i--) poolPerson(Object.assign({ kind: 'classmate' }, ageSpec(S.age - 1, S.age + 2)), org, '같은 과');
      for (let i = n(P.seniors); i > 0; i--) poolPerson(Object.assign({ kind: 'classmate' }, ageSpec(Math.max(19, S.age - 2), S.age + 3)), org, '선후배');
    }
  }
  // 직장: 같은 팀 + 타 부서 (취업할 때마다)
  if (S.job && !jailed()) {
    const org = `job:${S.job}:${V.hireN || 0}`;
    if (V.jobOrg !== org) {
      V.jobOrg = org;
      const ar = () => ageSpec(Math.max(20, S.age - 8), Math.min(62, S.age + 20));
      for (let i = n(P.team); i > 0; i--) { const p = poolPerson(Object.assign({ kind: 'coworker' }, ar()), org, '팀 동료'); p.team = true; }
      for (let i = n(P.otherDept); i > 0; i--) poolPerson(Object.assign({ kind: 'coworker' }, ar()), org, '타 부서');
    }
  }
  // 동네 상인 (시장·편의점 두 번째 방문부터)
  if (!V.merchants && S.age >= 6 && ((S.visits.market || 0) >= 2 || (S.visits.conveni || 0) >= 2)) {
    V.merchants = 1;
    for (let i = n(P.merchants); i > 0; i--) poolPerson(Object.assign({ kind: 'neighbor', hangout: pick(['market', 'conveni']) }, ageSpec(35, 65)), 'reg:merchant', '동네 상인');
  }
  // 단골 장소의 단골들
  for (const id in E.regulars) {
    if (!S.regular[id] || (V.regPools || {})[id] || !PLACES[id]) continue;
    V.regPools = Object.assign({}, V.regPools, { [id]: 1 });
    const pl = PLACES[id], c = Array.isArray(pl.crowd) ? pl.crowd[0] : pl.crowd || 'peer', [lo, hi] = crowdRange(c), fr = E.femaleRatio[id] ?? .5;
    for (let i = n(E.regulars[id]); i > 0; i--) poolPerson(Object.assign({ kind: 'friend', hangout: id, gender: Math.random() < fr ? 'f' : 'm' }, ageSpec(Math.max(pl.minAge || 0, lo), Math.max(pl.minAge || 0, hi))), 'reg:' + id, E.regularTag[id]);
  }
}

/* ═════════ 사람과 상호작용 ═════════ */
// 관계 창에서는 행동 1. 지금 장소에 같이 있는 사람이면 한 번은 행동 없이 (noFree면 늘 행동 1)
const socialCost = (it, p) => it.cost ? (resolve(it.cost) || 0) : 0;
const INTIMATE_IDS = ['intimate', 'onenight', 'enjoy'];   // 함께 밤을 보내는 건 2칸 (어른)
const socialAp = it => phase() === 'adult' && INTIMATE_IDS.includes(it.id) ? 2 : 1;
function interactions(pid) {
  const p = person(pid);
  if (!p) return [];
  const h = hereEntry(pid), here = !!h && !h.used;
  return D.social.filter(it => it.if(S, p, api)).map(it => {
    const cost = socialCost(it, p), free = here && !it.noFree && socialAp(it) === 1, ap = socialAp(it);
    return { id: it.id, label: it.label, icon: it.icon, cost, free, ap, ok: !busy() && !dutyPending() && (free || S.ap >= ap) && (!cost || S.money >= cost) };
  });
}
function interact(pid, iid) {
  const p = person(pid), it = D.social.find(x => x.id === iid);
  if (!p || !it || !it.if(S, p, api)) return;
  const cost = socialCost(it, p);
  const ap = socialAp(it), h = hereEntry(pid), free = !!h && !h.used && !it.noFree && ap === 1;
  if (busy() || dutyPending() || (!free && S.ap < ap) || (cost && S.money < cost)) return;
  if (!free) spend(ap);
  if (h) h.used = true;
  const o = it.run(S, p, api) || {};
  const pm = personality(p).mod[iid] || 1, mm = personality(S).mod[iid] || 1;
  const hm = sharedHobby(p) && (iid === 'hang' || iid === 'gift') ? 1.3 : 1;
  const vm = p.value === S.value ? 1.2 : valueClash(p) ? .8 : 1;
  const fm = 1 + ((p.face ?? 2) - 3) * .05;   // 상대 생김새가 좋으면 설렘이 빨리 오름
  o.mult = { close: pm * mm * hm, trust: pm * mm * vm, heart: pm * mm * vm * fm, grudge: (personality(p).mod.argue || 1) * (valueClash(p) ? 1.3 : 1) };
  if (['talk', 'hang', 'date', 'flirt', 'gift', 'listen', 'drinkWith'].includes(iid)) nearby(p);
  // 친밀 20~39인 기혼자: 이야기하다 보면 결혼한 티가 새어 나옴 (40이면 확실히 앎)
  if (['talk', 'hang', 'listen', 'drinkWith', 'date'].includes(iid) && p.married && !p.marriedKnown && p.close >= 20 && p.close < 40 && Math.random() < .35) { S.vars.fp = p.id; marriedHint(p); }
  if (cost) { const eff = Object.assign({}, resolve(o.effect)); eff.money = val(eff.money) - cost; o.effect = eff; }
  S.vars.fp = p.id;
  if (!o.intimate) o.gk = gainK();
  applyOutcome(o, p);
  after();
}

/* ═════════ 직업 ═════════ */
// 조건 하나하나를 [통과 여부, 설명]으로 돌려줌 (화면에서 빨강/초록 표시용)
function jobChecks(j) {
  const r = j.req || {}, out = [];
  if (r.degree === true) out.push([S.school.degree === 'bachelor', '4년제 졸업']);
  if (r.degree === 'any') out.push([!!S.school.degree, '대학 졸업']);
  if (r.tier) out.push([S.school.degree === 'bachelor' && S.school.tier <= r.tier, `${D.tierLabel[r.tier]} 대학 이상`]);
  if (r.major) out.push([r.major.includes(S.school.dept), `${r.major.map(m => (DEPT(m) || {}).name || m).join('/')}`]);
  if (r.gpa) out.push([S.school.gpa >= r.gpa, `학점 ${r.gpa}+`]);
  for (const k of ABIL) if (r[k]) out.push([S.stats[k] >= gradeMin(r[k]), `${LABEL[k]} ${r[k]}+`]);
  if (j.clean) out.push([S.record === 0, '전과 없음']);
  return out;
}
const meetsJob = j => jobChecks(j).every(c => c[0]);
const canJobHunt = () => !busy() && S.ap > 0 && !dutyPending() && S.age >= 19 && !S.flags.student && !S.flags.inArmy && !jailed() && !S.job;
const jobInfo = () => D.jobs.map(j => Object.assign({}, j, { ok: meetsJob(j), checks: jobChecks(j) }));
function jobOdds(j) {
  let o = j.odds ?? .7;
  if (j.major && j.major.includes(S.school.dept)) o += .15;   // 관련 학과면 유리
  if (S.record) o *= .5;
  return clamp(o, .05, .95);
}
function hire(j) {
  S.job = j.id; S.rank = 0; S.perf = 30; S.salary = j.salary;
  log(`${j.label} 자리에 합격했다!`, { memory: !S.flags.firstJob, deltas: applyEffect({ happy: 6 }) });
  S.flags.firstJob = true;
  const dr = D.dreams.find(d => d.id === S.dream);
  if (dr && dr.job === j.id && !S.flags.dreamDone) { S.flags.dreamDone = true; log(`어릴 적 꿈이 이뤄졌다. ${dr.label}.`, { memory: true, deltas: applyEffect({ happy: 10 }) }); }
  S.vars.hireN = (S.vars.hireN || 0) + 1;   // 새 직장 → 같은 팀·타 부서 사람들 (ensurePools)
}
function applyJob(id) {
  const j = job(id);
  if (!j || !canJobHunt()) return;
  spend();
  if (meetsJob(j) && Math.random() < jobOdds(j)) hire(j);
  else log(S.record && Math.random() < .5 ? `${j.label} 면접에서 전과 이야기가 나왔다. 떨어졌다.` : `${j.label} 면접에서 떨어졌다.`, { deltas: applyEffect({ happy: -3 }) });
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
  if (S.flags.retake) return '재수생';
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
const myHobby = h => !!h && (h === S.hobby || h === S.hobby2);   // 취미는 하나, 20세 시작이면 두 개까지
const sharedHobby = p => myHobby(p.hobby) ? D.hobbies.find(h => h.id === p.hobby) : null;
const valueClash = p => D.valueClash.some(([a, b]) => (a === p.value && b === S.value) || (b === p.value && a === S.value));
const valueLabel = id => (D.values.find(v => v.id === id) || {}).label || '';
function known(p, field) {
  if (p.kind === 'family' || p.kind === 'child') return true;
  if (p.told && p.told.includes(field)) return true;   // 필로우 토크에서 털어놓음
  return Math.max(p.close, p.trust) >= (D.revealAt[field] || 0);
}
// 신체 수치 — 아바타 체형(키·체격·가슴·어깨)에서 정해지고 사람마다 고정 (id 기준). p 없으면 나
// 키는 정규분포(남 173±6, 여 162±5)에서 체형의 키 구간에 맞는 쪽을 씀. 등급 1~6과 라벨이 같이 나옴
const gradeBy = (table, v) => { const i = table.findIndex(([max]) => v <= max); return [i + 1, table[i][1]]; };
const invNorm = u => {   // 표준정규 역함수 근사 (0<u<1)
  const t = Math.sqrt(-2 * Math.log(u < .5 ? u : 1 - u));
  const z = t - (2.515517 + .802853 * t + .010328 * t * t) / (1 + 1.432788 * t + .189269 * t * t + .001308 * t * t * t);
  return u < .5 ? -z : z;
};
function figure(p) {
  if (!p && S.fig) return customFig(S.gender, myBuild(), S.fig);   // 20세 시작: 직접 정한 몸
  const look = p ? lookOf(p) : S.look, g = p ? p.gender : S.gender;
  const b = (look || {}).body || {}, BG = D.bodyGrades;
  let h = 7; for (const ch of String(S.id) + (p ? p.id : 'me')) h = (h * 31 + ch.charCodeAt(0)) % 2147483647;
  const u = () => { h = (h * 16807) % 2147483647; return (h % 100000) / 100000; };
  const r = (lo, hi) => lo + Math.floor(u() * (hi - lo + 1));
  const [lo, hi] = { short: [.02, .27], tall: [.73, .995] }[b.height] || [.27, .73];
  const height = Math.round((g === 'm' ? 173 : 162) + invNorm(lo + u() * (hi - lo)) * (g === 'm' ? 6 : 5));
  const f = { height, hGrade: gradeBy(BG.height[g], height) };
  if (g === 'f') {
    const cups = Object.keys(BG.cup);
    let cup = (() => { const w = BG.cupBy[b.chest] || BG.cupBy.avg; let t = u() * Object.values(w).reduce((x, y) => x + y, 0); for (const k in w) { t -= w[k]; if (t <= 0) return k; } return 'B'; })();
    if (b.build === 'chubby') cup = cups[Math.min(cups.length - 1, cups.indexOf(cup) + 1)];
    const under = { slim: [65, 70], avg: [70, 75], fit: [70, 75], chubby: [80, 85] }[b.build] || [70, 75];
    f.under = under[u() < .5 ? 0 : 1];
    f.cup = cup; f.cGrade = BG.cup[cup];
    f.bust = f.under + 7 + cups.indexOf(cup) * 2.5 + r(0, 2) | 0;
    f.waist = r(...{ slim: [56, 61], avg: [61, 66], fit: [59, 64], chubby: [68, 78] }[b.build] || [61, 66]);
    f.hip = r(...{ slim: [80, 90], avg: [85, 96], fit: [86, 97], chubby: [93, 105] }[b.build] || [85, 96]);
    f.hipGrade = gradeBy(BG.hip, f.hip);
  } else {
    f.shoulder = r(...{ narrow: [38, 41], avg: [41, 46], wide: [46, 50] }[b.shoulder] || [41, 46]) + (b.build === 'fit' && u() < .5 ? 1 : 0) + (b.shoulder === 'wide' && u() < .12 ? 2 : 0);
    f.sGrade = gradeBy(BG.shoulder, f.shoulder);
    f.bust = r(...{ narrow: [86, 90], avg: [92, 97], wide: [99, 105] }[b.shoulder] || [92, 97]) + (b.build === 'fit' ? 3 : b.build === 'chubby' ? 6 : 0);
    f.waist = r(...{ slim: [69, 73], avg: [76, 81], fit: [74, 78], chubby: [86, 94] }[b.build] || [76, 81]);
    f.hip = r(89, 97);
  }
  return f;
}
const cm = (v, gr) => `${v}cm(${gr[1]})`;
// 몸에 대해 보이는 것: 처음엔 키·대략적 체형 / 친밀 30 인상 / 친밀 60 쓰리 사이즈·컵·골반·어깨 / 함께 밤을 보낸 뒤 전부 (20살 이상만)
function bodyInfo(p) {
  const age = npcAge(p), b = (lookOf(p) || {}).body || {}, BL = D.bodyLabel;
  if (age < 13 || p.kind === 'family' || p.kind === 'child') return [];
  const deep = Math.max(p.close, p.trust), slept = (p.nights || 0) > 0, adult = age >= 20 && S.age >= 20;
  const fg = figure(p), seen = known(p, 'body') || slept;   // 친밀 10부터 키 라벨·체형 인상
  const out = [{ label: '체형', value: seen ? `${age >= 19 ? `키 ${cm(fg.height, fg.hGrade)}` : BL.height[b.height] || ''}, ${BL.build[b.build] || ''} (몸 ${LETTERS[bodyIdx(p)]})` : null }];
  if (!adult) return out;
  const X = D.bodyImpression.extra;
  const extra = [fg.cGrade && fg.cGrade[0] >= 5 && X.cup, fg.hipGrade && fg.hipGrade[0] >= 4 && X.hip, fg.sGrade && fg.sGrade[0] >= 4 && X.shoulder, fg.hGrade[0] >= 5 && X.height].filter(Boolean);
  out.push({ label: '인상', value: seen ? [D.bodyImpression[p.gender][b.build], ...extra].join(', ') : null });
  out.push({ label: '사이즈', value: deep >= 60 || slept ? [fg.bust, fg.waist, fg.hip].join('-') : null });
  if (p.gender === 'f') {
    out.push({ label: '가슴', value: deep >= 60 || slept ? `${fg.under}${fg.cup}(${fg.cGrade[1]})` : null });
    out.push({ label: '골반', value: deep >= 60 || slept ? cm(fg.hip, fg.hipGrade) : null });
  } else out.push({ label: '어깨', value: deep >= 60 || slept ? cm(fg.shoulder, fg.sGrade) : null });
  if (slept && p.penis) out.push({ label: '성기', value: penisLabel(p.penis) });
  if (p.pref) out.push({ label: '좋아하는 타입', value: deep >= 50 || slept ? prefText(p.pref) : null });
  return out;
}
function prefText(pr) {
  const BL = D.bodyLabel, G = D.bodyGrades;
  const lab = (tbl, n) => tbl[Math.min(n, tbl.length) - 1][1];
  return [BL.height[pr.height], BL.build[pr.build],
    pr.cup && `가슴 ${Object.keys(G.cup).find(k => G.cup[k][0] === pr.cup) || ''}컵 이상`,
    pr.hip && `골반 ${lab(G.hip, pr.hip)} 이상`, pr.shoulder && `어깨 ${lab(G.shoulder, pr.shoulder)} 이상`, pr.penis && `크기 ${D.penisGrades[pr.penis - 1][2]} 이상`].filter(Boolean).join(', ');
}
function profile(p) {
  const L = (list, id) => (list.find(x => x.id === id) || {}).label;
  const age = npcAge(p);
  const f = (field, label, value) => ({ field, label, value: known(p, field) ? value : null });
  const kin = p.kind === 'family' || p.kind === 'child';
  const mt = marriageText(p);
  return [
    f('feature', '특징', p.feature),
    ...(age >= 13 && !kin ? [{ field: 'face', label: '생김새', value: `${LETTERS[p.face] || 'D'} · 꾸밈 ${LETTERS[p.style] || 'D'}` }] : []),
    ...bodyInfo(p).map(x => Object.assign({ field: 'body' }, x)),
    ...(mt !== undefined ? [{ field: 'married', label: '결혼', value: mt }] : []),
    f('personality', '성격', L(D.personalities, p.personality)),
    f('hobby', '취미', L(D.hobbies, p.hobby)),
    age >= 23 ? f('job', '직업', p.npcJob || '—') : f('dream', '꿈', L(D.dreams, p.dream)),
    f('value', '가치관', L(D.values, p.value)),
    f('wealth', '집안', L(D.wealth, p.wealth)),
  ];
}
function myProfile() {
  const L = (list, id) => (list.find(x => x.id === id) || {}).label;
  const b = (S.look && S.look.body) || {}, BL = D.bodyLabel, fg = figure(null);
  const shape = S.age < C.sexMinAge ? [] : S.gender === 'f'
    ? [['가슴', `${fg.under}${fg.cup}(${fg.cGrade[1]})`], ['골반', cm(fg.hip, fg.hipGrade)], ['사이즈', [fg.bust, fg.waist, fg.hip].join('-')]]
    : [['어깨', cm(fg.shoulder, fg.sGrade)]];
  return [
    ['소질', trait().label], ['성격', L(D.personalities, S.personality)], ['취미', [S.hobby, S.hobby2].filter(Boolean).map(h => L(D.hobbies, h)).join(', ')],
    ['체형', [S.age >= 19 ? `키 ${cm(fg.height, fg.hGrade)}` : BL.height[b.height], BL.build[b.build]].filter(Boolean).join(', ') + ` (몸 ${gradeOf(S.stats.fit)})`],
    ...shape,
    ...(S.flags.unnatural ? [['특징', '어딘가 부자연스럽다']] : []),
    ...(S.age >= C.sexMinAge && S.penis ? [['성기', penisLabel(S.penis)]] : []),
    ...(S.flags.hadSex ? [['밤의 기술', gradeOf(S.sexSkill)]] : []),
    ...((S.rumor || 0) >= 30 && S.rumorType ? [['소문', RUMOR_LINE[S.rumorType]]] : []),
    ['가치관', L(D.values, S.value)], ['집안', L(D.wealth, S.wealth)], ['꿈', L(D.dreams, S.dream) + (S.flags.dreamDone ? ' (이룸)' : '')],
    ['형제', L(D.siblings, S.sibling)], ['생일', `${S.month}월`],
  ];
}

/* ═════════ 데이터에서 쓰는 도구 ═════════ */
const api = {
  rand, pick, josa, money: fmtMoney,
  givenName: g => pick(g === 'm' ? D.namesM : g === 'f' ? D.namesF : D.namesM.concat(D.namesF)),
  meet: spec => addPerson(spec),
  person, npcAge, canRomance, heartOk, jailed, gradeMin, gradeOf, pGrade,
  faceStep: dir => { S.stats.face = gradeStep(S.stats.face, dir, LETTERS.indexOf('S')); },
  place: () => S.place, isHere: p => !!p && !!S.place && S.here.some(h => h.key === p.id),
  here: () => S.here.filter(h => !h.x).map(h => person(h.key)).filter(Boolean),
  regular: id => !!S.regular[id],
  find: fn => alive().filter(p => !p.acq && p.kind !== undefined && fn(p)),   // 얼굴만 아는 사이(acq)는 빠짐 — 장소에서 마주치면 a.here()로
  main: mainPartner,
  focus: p => { S.vars.fp = p ? p.id : null; },
  focused: () => person(S.vars.fp),
  changeP: (p, d) => applyP(p, d),
  startRelation, marry, breakUp, divorce, endMain, night, conceive, endAffair, guiltOf,
  drunk: () => S.drunk || 0, spouseWord: p => p && p.gender === 'f' ? '남편' : '아내',
  canSex, onPill, fertile, refusal, turn: () => turnNo(), today: () => S.dayN || 0, casualBonus, casualReady, companion, setCompanion, lust: p => lustOf(p), lustTop: () => lustTop().p, allure, charmed, need: k => C.allureNeed[k], firstLook, faceGrade: () => LETTERS[firstLook()], myFace: () => gIdx(S.stats.face),
  sentence, escape, tryJob, loseJob,
  perf: n => { S.perf = clamp(S.perf + n, 0, 100); },
  personality, sharedHobby, valueClash, valueLabel,
  subjAvg, subjAll, subjAdd, takeCSAT, admit, graduate, admitP, univ: UNIV, dept: DEPT, naesinAvg, mockAvg,
  chooseTrack: id => { const t = D.tracks.find(x => x.id === id); if (t) { S.school.track = t.id; S.school.electives = t.electives.slice(); } },
  addSibling,
};

/* ═════════ 새 인생 / 저장 ═════════ */
// 학교 기록: 계열·선택 과목, 다음 시험 보정(prep·bonus), 성적표, 내신, 모의고사, 수능, 원서, 대학·학과·학점, 비교과
const newSchool = () => ({ track: null, electives: [], prep: {}, bonus: {}, exams: [], naesin: [], mocks: [], mock: null, sat: null, susi: null, susiDone: false, jeongsi: null, offers: null,
  univ: null, dept: null, tier: null, start: null, years: null, gpa: 0, gpaN: 0, studyYear: 0, studyN: 0, extra: 0, degree: null, club: null });
const labelOf = (list, id) => (list.find(x => x.id === id) || {}).label || '';
// 빈 인생 (0살 상태) — 새 인생·20세 시작이 같이 씀
function blankState(opt, gender, tr, name, sib) {
  return {
    v: 5, id: Date.now(), seq: 0, pseq: 0, xseq: 0,
    name, gender, age: 0, money: 0, ap: 0, used: 0, seasonIdx: -1, trait: tr.id,
    birthYear: rand(2000, 2006), date: null, dayN: 0, turn: 0, tkind: null, zone: 'home', fatigue: 0, meals: 0, wake: 0, worked: false, report: null,
    personality: opt.personality || pick(D.personalities).id,
    hobby: opt.hobby || pick(D.hobbies).id,
    value: opt.value || pick(D.values).id,
    wealth: opt.wealth || weighted(D.wealth).id,
    dream: opt.dream || pick(D.dreams).id,
    sibling: sib.id,
    month: clamp(+opt.month || rand(1, 12), 1, 12),
    stats: { happy: rand(60, 80), health: rand(65, 90), libido: 0, smart: rand(5, 20), fit: rand(5, 20), face: gradeValue(pickKey(tr.face || D.faceStart)), style: rand(0, 10), charm: rand(5, 20), art: rand(5, 20), craft: rand(5, 20) },
    school: newSchool(),
    karma: 0, heat: 0, record: 0, crimes: 0, jail: 0, rank: 0, perf: 0, preg: null,
    sexSkill: 0, penis: gender === 'm' ? rollPenis() : null, drunk: 0, scene: null, lust: {}, lustTop: null,
    flags: {}, vars: {}, done: {}, last: {},
    people: [], job: null, salary: 0, log: [], memories: [], pending: [], ended: null,
    weather: 'sunny', time: 0,
    place: null, here: [], visits: {}, regular: {},
  };
}
function newLife(opt = {}) {
  const gender = opt.gender === 'm' || opt.gender === 'f' ? opt.gender : (Math.random() < .5 ? 'm' : 'f');
  const tr = D.traits.find(t => t.id === opt.trait) || pick(D.traits);
  const name = (opt.name || '').trim().slice(0, 6) || pick(D.surnames) + pick(gender === 'm' ? D.namesM : D.namesF);
  const sib = D.siblings.find(x => x.id === opt.sibling) || (Math.random() < .35 ? D.siblings[0] : pick(D.siblings.slice(1)));
  S = blankState(opt, gender, tr, name, sib);
  if (tr.start) for (const k in tr.start) S.stats[k] = COND.includes(k) ? clamp(S.stats[k] + tr.start[k], 0, 100) : S.stats[k] + tr.start[k];
  S.look = window.Avatar ? Avatar.make(`${S.id}:me`, gender) : null;
  S.skin = S.look ? S.look.skin : 1;
  S.frame = S.look && S.look.body.build !== 'fit' ? S.look.body.build : 'avg';
  syncMyBody();
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

  S.date = { y: S.birthYear, m: 3, d: 1 };   // 태어난 해의 학년도 시작(3월 1일)부터
  S.log.push({ n: ++S.seq, t: 'year', age: 0 });
  log(`${josa(S.name, '이')} ${S.month}월에 세상에 태어났다.`, { memory: true });
  log(`소질 ${tr.label}, 성격 ${labelOf(D.personalities, S.personality)}, 집안 ${labelOf(D.wealth, S.wealth)}, 형제 ${sib.label}, 꿈 ${dr.label}.`, { t: 'info' });
  enterSeason(0);
  S.memories[0].wx = S.weather; S.memories[0].season = season().id;
  after();
}
/* ═════════ 20세 시작 (QUICKSTART.md) ═════════
   0~19살을 건너뛰고, 직접 정한 능력치(300포인트)·몸·배경·관계로 스무 살 3월 1일(학년도 시작)부터 어른 하루를 삶 (재수면 고3 턴 한 번 더)
   지나온 시간(내신·수능·1학년 학점, 가족·친구·연인, 어린 시절 추억)은 고른 값에서 거꾸로 만들어 넣음 (data/quick.js) */
const QD = () => D.quick;
// 0~100 포인트 → 게임 능력치: 0~20 F / 21~40 E~D / 41~60 C / 61~80 B~A / 81~100 S (등급 시작값 data/life.js grades)
const QS_CONV = [[0, 0], [20, 24], [21, 25], [40, 79], [41, 80], [60, 119], [61, 120], [80, 229], [81, 230], [100, 299]];
function qsStat(v) {
  v = clamp(Math.round(+v || 0), 0, 100);
  for (let i = 1; i < QS_CONV.length; i++) {
    const [x0, y0] = QS_CONV[i - 1], [x1, y1] = QS_CONV[i];
    if (v <= x1) return x1 === x0 ? y1 : Math.round(y0 + (y1 - y0) * (v - x0) / (x1 - x0));
  }
  return 299;
}
// 직접 정한 몸 수치 → figure() 모양 (밑가슴은 허리에서, 남자 가슴둘레는 어깨에서)
function customFig(g, build, c) {
  const BG = D.bodyGrades, h = clamp(Math.round(+c.height || (g === 'm' ? 173 : 162)), 135, 200);   // 샌드박스 극단값까지
  const f = { height: h, hGrade: gradeBy(BG.height[g], h) };
  if (g === 'f') {
    const cups = Object.keys(BG.cup), ci = Math.max(0, cups.indexOf(c.cup)), waist = clamp(Math.round(+c.waist || 63), 45, 100);
    f.under = clamp(Math.round((waist + 10) / 5) * 5, 65, 85);
    f.cup = cups[ci]; f.cGrade = BG.cup[f.cup];
    f.bust = Math.round(f.under + 7 + ci * 2.5);
    f.waist = waist; f.hip = clamp(Math.round(+c.hip || 90), 70, 120); f.hipGrade = gradeBy(BG.hip, f.hip);
  } else {
    f.shoulder = clamp(Math.round(+c.shoulder || 44), 34, 56); f.sGrade = gradeBy(BG.shoulder, f.shoulder);
    f.bust = Math.round(f.shoulder * 2.15 + (build === 'fit' ? 3 : build === 'chubby' ? 6 : 0));
    f.waist = { slim: 71, fit: 76, chubby: 90 }[build] || 78;
    f.hip = { slim: 89, fit: 93, chubby: 99 }[build] || 93;
  }
  return f;
}
// 고른 생김새 (머리·머리색·피부·눈 + 체형). 세부(코·점·귀걸이…)는 seed로 고정 — 머리를 바꿔도 얼굴이 흔들리지 않음
function quickLook(q) {
  if (!window.Avatar) return null;
  const g = q.gender === 'f' ? 'f' : 'm', a = Avatar.make(`${q.seed || 'qs'}:me`, g);
  a.xseed = String(q.seed || 'qs');
  for (const k of ['hair', 'hc', 'skin', 'eyes']) if (q[k] != null && q[k] !== '') a[k] = +q[k];
  const h = +q.height || (g === 'm' ? 173 : 162), R = g === 'm' ? [168, 179] : [157, 167];
  a.body = { height: h < R[0] ? 'short' : h > R[1] ? 'tall' : 'avg', build: QD().builds.some(b => b.id === q.build) ? q.build : 'avg' };
  if (g === 'f') { const ci = QD().cups.indexOf(q.cup); a.body.chest = ci <= 1 ? 'small' : ci >= 4 ? 'large' : 'avg'; }
  else a.body.shoulder = +q.shoulder < 41 ? 'narrow' : +q.shoulder > 46 ? 'wide' : 'avg';
  return a;
}
const QS_TRACK = { cs: 'tech', medicine: 'life', nursing: 'life', biology: 'life', physics: 'science', chemistry: 'science', engineering: 'science', architecture: 'science', arts: 'arts', music: 'arts', design: 'arts', culinary: 'arts', beauty: 'arts' };
const r1 = v => Math.round(v * 10) / 10;
const ida = w => josa(w, '이').slice(-1) === '이' ? w + '이다' : w + '다';
function newLife20(q = {}) {
  const Q = QD(), gender = q.gender === 'f' ? 'f' : 'm', opp = gender === 'm' ? 'f' : 'm';
  const tr = D.traits.find(t => t.id === q.trait) || pick(D.traits);
  const name = (q.name || '').trim().slice(0, 6) || pick(D.surnames) + pick(gender === 'm' ? D.namesM : D.namesF);
  const sib = D.siblings.find(x => x.id === q.sibling) || D.siblings[0];
  const hob = [...new Set((q.hobbies || []).filter(h => D.hobbies.some(x => x.id === h)))].slice(0, 2);
  const valid = (list, id) => list.some(x => x.id === id) ? id : null;
  S = blankState({ personality: valid(D.personalities, q.personality), hobby: hob[0], value: valid(D.values, q.value), wealth: valid(D.wealth, q.wealth), dream: valid(D.dreams, q.dream), month: q.month }, gender, tr, name, sib);
  S.hobby2 = hob[1] || null;
  S.quickstart = true;
  // 난이도: 하드 240 · 보통 300 · 이지 360 · 샌드박스 제한 없음 (저장에 sandbox 표시 — 기록용)
  const diff = Q.diffs.find(d => d.id === q.diff) || Q.diffs.find(d => d.id === 'normal'), sandbox = diff.id === 'sandbox';
  S.vars.diff = diff.id;
  if (sandbox) S.sandbox = true;

  // 능력치: 포인트 → 등급 수치. 소질의 시작 보너스는 그대로 얹음 (타고난 외모는 생김새 B~S 보장)
  const pts = Q.stats.map(k => clamp(Math.round(+((q.st || {})[k]) || 0), 0, 100));
  const sum = pts.reduce((a, b) => a + b, 0);
  if (!sandbox && sum > diff.points) { const k = diff.points / sum; for (let i = 0; i < pts.length; i++) pts[i] = Math.floor(pts[i] * k); }
  Q.stats.forEach((k, i) => { S.stats[k] = qsStat(pts[i]); });
  S.stats.style = qsStat(clamp(+q.style || 0, 0, 50));
  S.stats.happy = 60; S.stats.health = 80; S.stats.libido = 0;
  if (tr.start) for (const k in tr.start) S.stats[k] = COND.includes(k) ? clamp(S.stats[k] + tr.start[k], 0, 100) : S.stats[k] + tr.start[k];
  if (tr.face) S.stats.face = Math.max(S.stats.face, gradeValue(pickKey(tr.face)));
  const edu = Q.edu.find(e => e.id === q.edu) || Q.edu[1];
  if (edu.bonus) for (const k in edu.bonus) S.stats[k] += edu.bonus[k];

  // 몸: 고른 체형·수치 (체형은 체력 등급이 바뀌기 전까지 그대로)
  S.look = quickLook(q);
  S.skin = S.look ? S.look.skin : 1;
  S.frame = S.look ? S.look.body.build : 'avg';
  S.fitAtPick = gIdx(S.stats.fit);
  const R = sandbox ? Q.rangeSandbox : Q.range, num = (v, r, d) => clamp(Math.round(+v || d), r[0], r[1]);
  S.fig = gender === 'f'
    ? { height: num(q.height, R.height.f, 162), cup: Q.cups.includes(q.cup) ? q.cup : 'B', waist: num(q.waist, R.waist, 63), hip: num(q.hip, R.hip, 90) }
    : { height: num(q.height, R.height.m, 173), shoulder: num(q.shoulder, R.shoulder, 44) };
  S.penis = gender === 'm' ? num(q.penis, R.penis, 14) : null;
  syncMyBody();

  // 날짜: 스무 살 3월 1일 (게임의 한 해는 학년도 — 3월에 시작하고 그때 나이가 오름)
  S.age = 20; S.dayN = Math.round(20 * 365.25);
  S.date = { y: S.birthYear + 20, m: 3, d: 1 };
  const dr = D.dreams.find(x => x.id === S.dream);
  S.vars.dreamLabel = dr.label;
  S.vars.dreamSpeech = dr.id === 'family' ? '행복한 가정을 꾸리고 싶어요!' : `${josa(dr.label, '이')} 되고 싶어요!`;
  const mr = Q.money[S.wealth] || [50, 100];
  S.money = rand(mr[0], mr[1]);
  if (q.home === 'own') S.flags.ownPlace = true;
  if (gender === 'm') { const ar = edu.id === 'retake' && q.army === 'now' ? 'next' : q.army; if (ar === 'exempt') S.flags.exempt = true; else S.vars.enlistAt = ar === 'now' ? 20 : 21; }

  // 학교: 고교 내신·수능은 능력치로 역산 (대학을 골랐으면 그 대학 합격선 쪽으로), 1학년 학점
  const sc = S.school, lines = [];
  const uniEdu = !!edu.tiers;
  let u = null, d = null;
  if (uniEdu) {
    u = UNIV(q.univ);
    if (!u || !edu.tiers.includes(u.tier)) u = pick(D.universities.filter(x => edu.tiers.includes(x.tier)));
    d = DEPT(u.departments.includes(q.dept) ? q.dept : pick(u.departments));
  }
  const tk = D.tracks.find(t => t.id === (d && QS_TRACK[d.id] || (S.stats.art > S.stats.smart ? 'liberal' : 'science'))) || D.tracks[0];
  sc.track = tk.id; sc.electives = tk.electives.slice();
  const L = COMMON.concat(sc.electives), g0 = gradeOfScore(L.reduce((t, k) => t + subjBase(k) + 8, 0) / L.length);
  const toward = (cut, w) => clamp(r1((g0 + cut * w) / (1 + w) + rand(-3, 3) / 10), 1, 9);
  const hs = pick(Q.highSchools);
  let nae, sat = null;
  if (uniEdu) {
    const cb = d.cut_bonus || 0;
    nae = toward(Math.max(1, u.cut.수시 + cb), 2); sat = toward(Math.max(1, u.cut.정시가 + cb), 2);
    Object.assign(sc, { univ: u.id, dept: d.id, tier: u.tier, start: 19, years: d.years || (u.tier === 5 && d.id !== 'nursing' ? 2 : 4) });
    const y = clamp(1.8 + rand(2, 5) * .3 + gIdx(S.stats.smart) * .1 + (d.stat ? gIdx(S.stats[d.stat]) * .06 : 0) + rand(-3, 3) / 10, 1, 4.5);
    sc.gpa = Math.round(y * 100) / 100; sc.gpaN = 1;
    S.flags.student = true;
    if (S.wealth === 'poor') S.money = -rand(100, 300);   // 학자금 대출
    lines.push(['📚', `${josa(hs, '을')} 졸업하고 ${u.name} ${d.name}에 입학했다. ${sc.years - 1 <= 1 ? '지금은 2학년, 올겨울 졸업 예정.' : '지금은 2학년.'}`,
      `내신 ${nae}등급 · 수능 ${sat}등급 · 1학년 학점 ${sc.gpa.toFixed(2)}`]);
  } else if (edu.id === 'retake') {
    nae = clamp(r1(g0 + rand(-3, 3) / 10), 1, 9); sat = clamp(r1(g0 + rand(3, 10) / 10), 1, 9);
    S.flags.retake = true;
    sc.studyN = Math.round(10 + pts[0] / 4);
    S.money = Math.round(S.money * .2);
    S.stats.happy = 45;
    lines.push(['📚', `${josa(hs, '을')} 졸업했지만 원하는 대학에 가지 못했다. 올해 수능을 한 번 더 본다.`, `내신 ${nae}등급 · 작년 수능 ${sat}등급`]);
  } else {
    nae = clamp(r1(g0 + rand(-3, 3) / 10), 1, 9);
    if (Math.random() < .5) sat = clamp(r1(g0 + rand(0, 6) / 10), 1, 9);
    const j = job(Q.jobs.includes(q.job) ? q.job : Q.jobs[0]);
    S.job = j.id; S.rank = 0; S.perf = rand(10, 25); S.salary = j.salary;
    S.flags.firstJob = true; S.flags.noCollege = true;
    S.money += rand(300, 700);   // 1년 동안 모은 돈
    if (dr.job === j.id) S.flags.dreamDone = true;
    S.vars.hireN = 1;   // 같은 팀·타 부서 (ensurePools)
    lines.push(['📚', `${josa(hs, '을')} 졸업하고 바로 ${j.label} 일을 시작했다.${S.flags.dreamDone ? ' 어릴 적 꿈이 이미 이뤄진 셈이다.' : ''}`, `연봉 ${fmtMoney(S.salary)}${sat ? ` · 수능 ${sat}등급` : ' · 수능은 보지 않았다'}`]);
  }
  sc.naesin = Array.from({ length: 6 }, () => clamp(r1(nae + rand(-4, 4) / 10), 1, 9));
  if (sat != null) { sc.sat = { avg: sat, rows: [] }; sc.mocks = [0, 1, 2].map(() => clamp(r1(sat + rand(-6, 6) / 10), 1, 9)); }
  if (gender === 'm') lines[0][1] += S.flags.exempt ? ' 병역은 면제받았다.' : S.vars.enlistAt === 20 ? ' 올봄 입대를 앞두고 있다.' : ' 내년 봄에 입대한다.';

  // 가족: 부모(함께·이혼·여읨), 형제는 이미 자란 채로
  const mom = addPerson({ kind: 'family', role: '엄마', gender: 'f', ageDiff: rand(26, 34), close: rand(55, 85), trust: rand(55, 80), taken: true, wealth: S.wealth });
  const dad = addPerson({ kind: 'family', role: '아빠', gender: 'm', ageDiff: rand(27, 36), close: rand(45, 80), trust: rand(50, 75), taken: true, wealth: S.wealth });
  mom.id = 'mom'; mom.name = null; dad.id = 'dad'; dad.name = null;
  let fam = `${Q.wealthAdj[S.wealth] || '평범한'} 집에서 자랐다.`;
  if (q.parents === 'divorced') {
    const at = rand(8, 17), away = Math.random() < .7 ? dad : mom;
    away.close = clamp(away.close - rand(20, 30), 5, 100);
    S.flags.parentsDivorced = true; S.vars.divorceAt = at;
    fam += ` ${at}살 때 부모님이 이혼하셨다.`;
  } else if (q.parents === 'lost') {
    const at = rand(10, 18), gone = Math.random() < .6 ? dad : mom;
    gone.gone = true; S.vars.lostParent = gone.role; S.vars.lostAt = at;
    fam += ` ${at}살 때 ${josa(gone.role, '을')} 여의었다.`;
  }
  if (sib.id !== 'none') {
    S.vars.sibGap = rand(sib.gap[0], sib.gap[1]);
    const sg = sib.gender || (Math.random() < .5 ? 'm' : 'f');
    const sp = addPerson({ kind: 'family', sibling: true, gender: sg, ageDiff: S.vars.sibGap, close: rand(50, 80), trust: rand(45, 75), taken: false });
    sp.role = sibRole(sib, S.vars.sibGap > 0, sg);
    S.done.siblingBorn = 1;
    fam += ` ${josa(sp.role, '이')} 한 명 있다.`;
  } else fam += ' 외동이다.';
  if (S.flags.ownPlace) fam += ' 지금은 혼자 산다.';
  lines.unshift(['🏠', fam]);

  // 친구 (같은 대학이면 캠퍼스에서 자주 마주침) — 명문대는 인맥 보너스: 더 가깝고 과 선배 한 명
  const campus = p => { if (uniEdu) { p.uni = sc.univ; p.hangout = 'campus'; p.tag = p.tag || '과 친구'; } };
  const friends = [];
  for (let i = 0; i < clamp(+q.friends || 0, 0, 3); i++) {
    const f = addPerson({ kind: 'friend', ageDiff: rand(-1, 1), close: rand(40, 60) + (edu.id === 'elite' ? 8 : 0), trust: rand(35, 55) });
    if (i < 2) campus(f);
    friends.push(f);
  }
  if (edu.id === 'elite') { const sr = addPerson({ kind: 'friend', ageDiff: rand(1, 3), close: rand(28, 38), trust: rand(30, 42) }); sr.tag = '과 선배'; campus(sr); }

  // 연인 / 전 연인
  const exp = !!q.exp || (q.love === 'yes' && !!q.lsex);
  let lover = null, ex = null, love = '지금은 솔로다.';
  if (q.love === 'yes') {
    const y = clamp(Math.round(+q.ly || 1), 1, 3), sx = !!q.lsex;   // 연인은 동갑~두 살 위 (스무 살 이상이라 성욕의 대상이 될 수 있음)
    lover = addPerson({ kind: 'friend', gender: opp, ageDiff: rand(0, 2), personality: valid(D.personalities, q.lp) || undefined, taken: false, married: false,
      close: 50 + y * 10 + rand(-3, 3), trust: 45 + y * 10 + rand(-3, 3), heart: 80 - y * 8 + rand(-3, 3) });
    startRelation(lover, false); lover.since = S.age - y;
    if (canSex(lover)) lover.libido = clamp(rand(25, 45) + y * 5, 0, 100);
    if (sx && canSex(lover)) { lover.nights = rand(6, 14) * y; lover.compat = clamp(startCompat(lover) + rand(5, 10) * y, 0, 100); }
    if (uniEdu && Math.random() < .5) { campus(lover); lover.tag = null; }
    if (sandbox && q.lst) for (const [k] of Q.loverStats) if (q.lst[k] != null && q.lst[k] !== '') lover[k] = clamp(Math.round(+q.lst[k]), 0, 100);   // 샌드박스: 연인 스탯 직접
    love = `${josa(lover.name, '와')} 사귄 지 ${y}년째.`;
  } else if (q.love === 'ex') {
    const why = Q.exWhy.find(w => w.id === q.exWhy) || Q.exWhy[0];
    ex = addPerson({ kind: 'friend', gender: opp, ageDiff: rand(0, 2), taken: false, married: false,
      close: val(why.p.close), trust: val(why.p.trust), heart: val(why.p.heart), grudge: val(why.p.grudge) });
    ex.ex = true; ex.since = S.age - rand(1, 2);
    if (canSex(ex)) ex.libido = rand(10, 30);
    S.vars.exWhy = why.id; S.vars.exId = ex.id;
    if (why.karma) addKarma(why.karma);
    love = `${josa(ex.name, '와')}는 ${why.line}.`;
  }
  // 밤의 기술: 경험 있음이면 20~40 (0~100 기준) / 성욕(20~60)은 대상별 — 연인에게, 전 연인에게는 조금
  if (exp) { S.sexSkill = qsStat(rand(20, 40)); S.flags.hadSex = true; S.flags.intimate = true; }
  const lib = rand(20, 60);
  if (lover && canSex(lover)) S.lust[lover.id] = lib;
  if (ex && canSex(ex)) S.lust[ex.id] = Math.round(lib * .35);
  syncLibido();

  if (sandbox && q.money != null && q.money !== '') S.money = clamp(Math.round(+q.money) || 0, 0, Q.rangeSandbox.money[1]);   // 샌드박스: 시작 돈 직접
  if (sandbox) lines.unshift(['🎮', '샌드박스 모드 — 밸런스는 무시된다.']);
  const L2 = (list, id) => (list.find(x => x.id === id) || {}).label || '';
  const hl = [S.hobby, S.hobby2].filter(Boolean).map(h => L2(D.hobbies, h)).join('·');
  lines.push(['👤', `성격은 ${L2(D.personalities, S.personality)}, ${josa(hl, '을')} 좋아한다.`]);
  lines.push(['💭', `꿈은 ${ida(dr.label)}.`]);
  lines.push(['💕', love]);
  lines.push(['👥', friends.length ? `친구: ${friends.map(f => f.name).join(', ')}` : '아직 마음을 터놓을 친구는 없다.']);
  lines.push(['💰', S.money < 0 ? `학자금 대출 ${fmtMoney(-S.money)}.` : `통장에 ${fmtMoney(S.money)}.`]);

  // 어린 시절 추억 2~3개 (성격으로 초등·고등, 취미로 중학교) → 앨범
  const am = Q.autoMemories[S.personality] || Q.autoMemories.warm, hm = Q.hobbyMemories[S.hobby];
  const mem = (age, text) => { const si = rand(0, 3), se = SEASONS[si]; S.memories.push({ age, season: se.id, wx: weighted(Object.keys(se.weather), k => se.weather[k]), text }); return text; };
  const mems = [mem(rand(8, 11), am[0])];
  if (hm) mems.push(mem(14, hm));
  mems.push(mem(17, am[1]));

  S.intro = { lines, mems };
  S.log.push({ n: ++S.seq, t: 'year', age: S.age });
  log(`스무 살의 봄. ${josa(S.name, '은')} 여기서부터 시작한다.`, { memory: true });
  const first = S.memories[S.memories.length - 1];
  log(`소질 ${tr.label}, 성격 ${L2(D.personalities, S.personality)}, 집안 ${L2(D.wealth, S.wealth)}, 꿈 ${dr.label}.`, { t: 'info' });
  enterSeason(0);
  first.wx = S.weather; first.season = season().id;
  beginPhase();
  after();
}
// 자동 저장: 행동·턴·하루가 끝날 때마다 지금 칸에
function save() { if (!S) return; try { S.v = 6; localStorage.setItem(slotKey(slot), JSON.stringify(S)); localStorage.setItem(SLOT_KEY, String(slot)); } catch (e) { /* 저장 불가 환경이면 넘어감 */ } }
function readSlot(n) { try { return JSON.parse(localStorage.getItem(slotKey(n))); } catch (e) { return null; } }
function load() {
  try {
    const cur = readSlot(slot);
    if (cur && (cur.v === 6 || cur.v === 5)) return patch(cur);
    // 예전 저장(v5 이하)이 있으면 1번 칸으로
    if (slot !== 1 || readSlot(1)) return null;
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    // v5 칸에 v4로 찍혀 저장된 것(새 인생이 v4로 만들어지던 버그)도 v5 그대로라 살려서 읽음
    if (s && (s.v === 5 || s.v === 4)) { s.v = 5; return patch(s); }
    for (const k of OLD_KEYS) {
      const old = JSON.parse(localStorage.getItem(k));
      if (old && (old.v === 3 || old.v === 4)) return upgrade(old.v === 3 ? migrate(old) : old);
    }
    return null;
  } catch (e) { return null; }
}
// 같은 v5 안에서 새로 생긴 값 채우기: 크기 등급(small·avg·large·xlarge) → cm
function patch(s) {
  // NPC_ENCOUNTER: 마지막으로 본 날, 기혼자 결혼 반지 (풀은 ensurePools가 채움)
  for (const p of s.people) { if (p.seen == null) p.seen = s.dayN || 0; if (p.married && p.ring == null) ringFor(p); }
  for (const x of [s, ...s.people]) {
    if (x.gender === 'm' && x.penis == null) x.penis = cmFromSize(x.size);
    delete x.size;
  }
  // 예전 학교 기록 → SCHOOL.md 형식 (전공 → 학과, 대학 등급 → 대학)
  if (!s.school.exams) {
    const o = s.school, n = newSchool();
    n.naesin = o.naesin || []; n.sat = o.sat ? { avg: o.sat.avg, rows: [] } : null; n.mocks = o.mock ? [o.mock.avg] : [];
    if (o.tier) { n.univ = D.oldTier[o.tier] || 'UNI7'; n.tier = UNIV(n.univ).tier; }
    if (o.major) n.dept = D.oldMajor[o.major] || 'business';
    for (const k of ['start', 'years', 'gpa', 'gpaN', 'studyYear', 'degree']) if (o[k] != null) n[k] = o[k];
    s.school = n;
  }
  // 1년 10행동 → 달력 (GAMEFLOW): 지금 계절의 첫날로 옮기고 단계에 맞게 시작
  if (!s.date) {
    const prev = S; S = s;
    s.birthYear = 2003; s.dayN = s.age * 365; s.zone = 'home'; s.fatigue = 0; s.meals = 0; s.wake = 0; s.worked = false; s.report = null;
    const si = Math.max(0, s.seasonIdx), m = [3, 6, 9, 12][si];
    s.date = { y: s.birthYear + s.age, m, d: 1 };
    s.place = null; s.here = [];
    const ph = phase();
    if (ph === 'ms' || ph === 'hs') { let i = 0; while (i < turnsInYear() - 1 && turnDate(i + 1) <= dateOf()) i++; s.turn = i; s.tkind = turnKind(i); s.ap = TURN_AP[s.tkind] || 0; s.used = 0; }
    else if (ph === 'adult') startDay(true);
    else { s.ap = 0; s.tkind = null; }
    updateTime();
    S = prev;
  }
  // 대상 없는 성욕 하나 → 대상별 성욕: 예전 값은 애인(없으면 설렘이 가장 큰 사람)에게, 함께 밤을 보낸 사람들은 조금씩
  if (!s.lust) {
    const prev = S; S = s;
    s.lust = {};
    const cands = s.people.filter(p => !p.gone && canSex(p)).sort((a, b) => (lover(b) - lover(a)) || b.heart - a.heart);
    if (cands[0] && (s.stats.libido || 0) > 0) s.lust[cands[0].id] = s.stats.libido;
    for (const p of cands.slice(1)) if (p.nights || p.heart >= 40) s.lust[p.id] = clamp(Math.round((s.stats.libido || 0) * .5) + attraction(p), 0, 100);
    syncLibido();
    S = prev;
  }
  return s;
}
// v4 → v5 (외모 3층, 체형). 비어 있는 값만 채움
function upgrade(s) {
  S = s;
  s.v = 5;
  if (s.stats.face == null) { s.stats.face = s.stats.looks ?? gradeValue(pickKey(D.faceStart)); delete s.stats.looks; }
  if (s.stats.style == null) s.stats.style = 20;
  if (s.stats.libido == null) s.stats.libido = s.age >= C.sexMinAge ? 30 : 0;
  if (s.sexSkill == null) { s.sexSkill = s.flags.intimate ? 40 : 0; s.drunk = 0; }
  if (s.flags.intimate) s.flags.hadSex = true;
  if (!s.look && window.Avatar) s.look = Avatar.make(`${s.id}:me`, s.gender);
  if (s.look && !s.look.body && window.Avatar) s.look.body = Avatar.make(`${s.id}:me`, s.gender).body;
  if (!s.frame) s.frame = s.look && s.look.body && s.look.body.build !== 'fit' ? s.look.body.build : 'avg';
  for (const p of s.people) {
    if (p.face == null) p.face = LETTERS.indexOf(pickKey(D.npcFace));
    if (p.style == null) p.style = npcStyle(p.hobby, npcAge(p));
    if (p.pref === undefined) p.pref = npcAge(p) >= 19 && Math.random() < .6 ? randomPref() : null;
    if (p.libido == null) p.libido = npcAge(p) >= C.sexMinAge ? rand(10, 50) : 0;
    if (p.appearance && !p.appearance.body && window.Avatar) p.appearance.body = Avatar.make(`${s.id}:${p.id}`, p.gender, { feature: p.feature }).body;
  }
  syncMyBody();
  return patch(s);
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
function init() { S = load(); if (S) { after(); return true; } return false; }
// 저장 칸 목록 (화면용 요약)
function slotList() {
  return Array.from({ length: SLOTS_N }, (_, i) => {
    const n = i + 1, s = n === slot && S ? S : readSlot(n);
    return { n, current: n === slot, empty: !s, name: s && s.name, age: s && s.age, gender: s && s.gender, date: s && s.date, ended: s && s.ended, quick: !!(s && s.quickstart), sandbox: !!(s && s.sandbox) };
  });
}
// 다른 칸으로: 비어 있으면 false (화면이 새 인생 만들기를 열고, newLife가 그 칸에 저장)
function useSlot(n) {
  n = clamp(+n || 1, 1, SLOTS_N);
  if (S) save();
  slot = n;
  try { localStorage.setItem(SLOT_KEY, String(n)); } catch (e) { /* */ }
  const s = readSlot(n);
  if (!s) { S = null; return false; }
  S = patch(s); held = null;
  after();
  return true;
}
// 지금 인생을 다른 칸에도 저장 (수동 저장 — 그 칸으로 옮겨감)
function saveTo(n) { n = clamp(+n || 1, 1, SLOTS_N); if (!S) return; slot = n; save(); emit(); }
function deleteSlot(n) { if (n === slot) return; try { localStorage.removeItem(slotKey(n)); } catch (e) { /* */ } emit(); }

window.Game = {
  init, subscribe: f => subs.push(f), state: () => S,
  slots: slotList, useSlot, saveTo, deleteSlot, slot: () => slot,
  newLife, choose, currentEvent,
  // 20세 시작 (QUICKSTART.md): 만들기, 지나온 20년 요약 확인, 화면용 도구 (포인트 → 등급, 몸 수치, 미리보기 생김새)
  newLife20, ackIntro: () => { if (S) { S.intro = null; after(); } },
  quick: {
    data: () => D.quick, grade: v => gradeOf(qsStat(v)), stat: qsStat,
    fig: (g, build, c) => customFig(g, build, c), look: quickLook,
    heightLabel: (g, h) => gradeBy(D.bodyGrades.height[g], h)[1], hipLabel: v => gradeBy(D.bodyGrades.hip, v)[1], shoulderLabel: v => gradeBy(D.bodyGrades.shoulder, v)[1],
    cupLabel: c => (D.bodyGrades.cup[c] || [0, ''])[1], penisLabel: cm => PG()[pGrade(cm) - 1][2],
    jobs: () => D.quick.jobs.map(job), tierUnis: tiers => D.universities.filter(u => tiers.includes(u.tier)),
  },
  // 시간 (GAMEFLOW): 단계, 이야기 계속, 다음 주(턴), 하루(밥·출근·잠·넘기기)
  phase, timeInfo, storyNext, nextTurn, eat, doDuty: () => { doDuty(false); after(); }, sleep: () => skip('today'), skip,
  actionList, canDo, costOf, doAction, needsSubject,
  places: placeList, goPlace, leavePlace, here: hereList, talkTo, drunkLabel: () => DRUNK[S.drunk || 0], place: () => PLACES[S.place] || null, timeLabel: () => TIMES[S.time] || '', jailed,
  // 함께 밤을 보낸 적 있거나 사귀는 사이에게만 보이는 것: 상대 성욕, 궁합, 마지막 만족감
  intimacy: p => canSex(p) && (p.nights || lover(p) || p.teased) ? { libido: p.libido || 0, compat: p.compat, sat: p.lastSat, nights: p.nights || 0 } : null,
  // 이 사람을 향한 내 성욕 (내 마음이라 늘 보임) / 지금 가장 높은 대상
  myLust: p => canSex(p) ? lustOf(p) : null, lustTarget: () => { const t = lustTop(); return t.p ? { name: pname(t.p), v: t.v, id: t.p.id } : null; },
  people: () => alive(), person, interactions,
  // NPC 출현: 이름 옆 결혼 마커, 지금 반지가 보이는지, 얼굴만 아는 사람(관계 목록엔 따로), 소원해짐
  marker, ringVisible, acquaintance: p => !!p.acq, faded: p => faded(p), companion, endCompany: () => { S.companion = null; save(); emit(); }, interact, canSex, clearScene: () => { if (S.scene) { S.scene = null; save(); } }, look: lookOf, myLook: () => S.look, figure, relLabel, npcAge, canRomance, heartOk, pname, profile, myProfile,
  crimes: () => D.crimes.filter(c => S.age >= c.minAge && meets(c.req)), canCrime, crimeOdds, commitCrime,
  jobInfo, canJobHunt, applyJob, quitJob, jobTitle,
  roleText, karmaLabel, trait, job, mainPartner, season, fmtMoney, josa,
  gradeInfo, abilities: ABIL, conds: COND, subjects: D.subjects, naesinAvg, mockAvg, univLabel, majorLabel, studyInfo, subjectsNow: () => subjectsNow().map(SUB),
  // 학교 화면: 성적표 확인, 원서 (대학·학과 목록, 합격 확률, 내기)
  ackReport: () => { S.report = null; after(); }, universities: D.universities, departments: D.departments, tracks: D.tracks, tierLabel: t => D.tierLabel[t], admitP, submitApply, gradeLabel: () => gradeLabel(),
  creation: { traits: D.traits, personalities: D.personalities, wealth: D.wealth, hobbies: D.hobbies, values: D.values, dreams: D.dreams, siblings: D.siblings },
  LABEL, config: C, seasons: SEASONS,
  // 개발·테스트용 (브라우저 콘솔이나 헤드리스 검사에서 이벤트를 직접 터뜨려볼 때)
  dev: { fire: id => { fire(EVENTS[id]); after(); }, eligible: id => eligible(EVENTS[id]), meet: spec => addPerson(spec), rumorYear, api },
};
})();
