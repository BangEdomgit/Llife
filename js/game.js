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
const ABIL = D.abilities;                     // 능력: 등급, 상한 ABIL_CAP (화면에는 ×10/3 → 1000 만점)
const ABIL_CAP = D.abilCap || 300, ABIL_SHOW = D.abilShow || 10 / 3;
const abilShow = v => Math.min(1000, Math.round((v || 0) * ABIL_SHOW));   // 화면용 능력치 (0~1000)
function capAbil() { if (S && S.stats) for (const k of ABIL) if (S.stats[k] > ABIL_CAP) S.stats[k] = ABIL_CAP; }
const STATS = COND.concat(ABIL);
const PSTATS = ['close', 'trust', 'heart', 'grudge'];
const LABEL = Object.assign({}, D.statLabel, { close: '친밀', trust: '신뢰', heart: '설렘', grudge: '원한', sat: '만족감' });
const GR = D.grades;
const SUBJ = D.subjects.map(x => x.id);   // 모든 과목 id (지금 듣는 과목은 subjectsNow)
const KIND_LABEL = { classmate: '같은 반', friend: '친구', coworker: '동료', rival: '앙숙', child: '아이', family: '가족', neighbor: '이웃', staff: '일하는 사람' };
const EVENTS = Object.fromEntries(D.events.concat(D.classEvents || []).map(e => [e.id, e]));   // 수업 이벤트도 id로 찾음 (뽑는 건 classTurn만)
const PLACES = Object.fromEntries(D.places.map(p => [p.id, p]));
const ACTIONS = Object.fromEntries(D.actions.map(a => [a.id, a]));
const TIMES = ['아침', '낮', '저녁'];
const TRANSIENT = ['classSubj', 'fp', 'sev', 'late', 'mainId', 'mainName', 'loverId', 'lover', 'debt', 'new', 'newId', 'attempt', 'uniScore', 'signal', 'fline', 'myValue', 'theirValue', 'satText', 'placeLabel', 'nbUnit', 'mateName', 'mateId', 'mateWord', 'ivApp', 'ivCo', 'ivJob', 'ivPart', 'ivGood'];

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
  if (REGION !== 'kr') return fmtUSD(v);
  const sign = v < 0 ? '-' : '', a = Math.abs(Math.round(v));
  if (a === 0) return '0원';
  if (a >= 10000) { const man = a % 10000; return `${sign}${Math.floor(a / 10000)}억${man ? ' ' + man.toLocaleString() + '만' : ''}원`; }
  return `${sign}${a.toLocaleString()}만원`;
}

/* ═════════ 나라 (data/region.js) ═════════
   새 인생을 만들 때 고른 나라(S.region). 한국은 data/*.js 그대로, 뉴욕은 데이터 항목을 덮어쓰고(되돌릴 수 있게 원래 값을 기억)
   화면 글의 한국 낱말·원화 금액을 뉴욕식으로 바꿈(loc — js/main.js가 화면에 나오는 글마다 적용) */
const REG = D.regions || { kr: { id: 'kr' } };
let REGION = 'kr', LOC = null;
const ORIG = [];   // [객체, 키, 원래 값, 원래 있었나]
function setD(obj, key, v) {
  if (!ORIG.some(o => o[0] === obj && o[1] === key)) ORIG.push([obj, key, obj[key], key in obj]);
  obj[key] = v;
}
// 원화(만원 단위) → 달러 글: 1,250달러 / 3.2만 달러 / 1.5억 달러 (조사가 '원'과 똑같이 붙도록 '달러')
function fmtUSD(v) {
  const d = Math.round(v * ((REG[REGION] || {}).money || 15)), sign = d < 0 ? '-' : '', a = Math.abs(d);
  if (a === 0) return '0달러';
  if (a >= 1e8) return `${sign}${(a / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, '')}억 달러`;
  if (a >= 1e4) return `${sign}${(a / 1e4).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '')}만 달러`;
  return `${sign}${a.toLocaleString('en-US')}달러`;
}
// 평균 등급 글: 서울 '3.2등급' / 뉴욕 'GPA 3.18'(학교 시험·내신) · '1310점'(SAT·모의 SAT) — data/region.js grade
function gradeTxt(g, kind) {
  const C = (REG[REGION] || {}).grade;
  if (!C) return `${(+g).toFixed(1)}등급`;
  return kind === 'sat' ? `${C.sat(+g)}점` : `GPA ${C.gpa(+g)}`;
}
const gradeLetter = g => { const C = (REG[REGION] || {}).grade; return C ? C.letter(g) : `${g}등급`; };
function applyRegion(id) {
  for (let i = ORIG.length - 1; i >= 0; i--) { const [o, k, v, had] = ORIG[i]; if (had) o[k] = v; else delete o[k]; }
  ORIG.length = 0;
  REGION = REG[id] ? id : 'kr'; LOC = null;
  const R = REG[REGION];
  if (REGION === 'kr') return;
  const P = R.patch || {};
  const byId = (list, map) => { if (list && map) for (const x of list) if (map[x.id]) for (const k in map[x.id]) setD(x, k, map[x.id][k]); };
  byId(D.places, P.places); byId(D.jobs, P.jobs); byId(D.hobbies, P.hobbies); byId(D.dreams, P.dreams);
  byId(D.subjects, P.subjects); byId(D.tracks, P.tracks); byId(D.wealth, P.wealth); byId(D.actions, P.actions); byId(D.events, P.events); byId(D.housing, P.housing);
  if (R.features) setD(D, 'features', R.features);
  if (R.dogNames) setD(D, 'dogNames', R.dogNames);
  if (R.universities) setD(D, 'universities', R.universities);
  if (R.departments) byId(D.departments, R.departments);
  if (R.weather) for (const s of SEASONS) if (R.weather[s.id]) setD(s, 'weather', R.weather[s.id]);
  if (R.names) {   // 아무 데서나 이름을 뽑을 때(인종을 모를 때)는 전체에서
    const all = k => [...new Set(Object.values(R.names).flatMap(x => x[k]))];
    setD(D, 'namesM', all('m')); setD(D, 'namesF', all('f')); setD(D, 'surnames', all('s'));
  }
  if (R.apply) R.apply(D, setD);   // 그 밖의 덮어쓰기 (data/region.js)
}
const NORM = k => ((REG[REGION] || {}).norms || {})[k];
// 인종 (뉴욕만): 외모의 피부·머리색·눈동자·머리결과 이름에만 씀 — 매력 점수와 무관
function pickEth() { const E = (REG[REGION] || {}).eth; return E ? pickKey(E) : null; }
function nameFor(g, eth, full) {
  const N = (REG[REGION] || {}).names;
  if (!N) return (full ? pick(D.surnames) : '') + pick(g === 'm' ? D.namesM : D.namesF);
  const pool = N[eth] && Math.random() < .8 ? N[eth] : N[pick(Object.keys(N))], sp = N[eth] && Math.random() < .85 ? N[eth] : N[pick(Object.keys(N))];   // 이름·성은 가끔 다른 배경에서 (섞여 사는 도시)
  const given = pick(g === 'm' ? pool.m : pool.f);
  return full ? `${given} ${pick(sp.s)}` : given;
}
// 화면 글의 한국 낱말 → 뉴욕식 (조사 자동), 원화 금액 → 달러
const JOSA_V = { '이': '이', '가': '이', '을': '을', '를': '을', '은': '은', '는': '은', '과': '와', '와': '와', '이랑': '이랑', '랑': '이랑', '으로': '으로', '로': '으로' };
const hasJong = w => { const c = w.charCodeAt(w.length - 1); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 > 0; };
function fixPart(part, w) {
  if (!part) return '';
  if (JOSA_V[part]) return josa(w, JOSA_V[part]).slice(w.length);
  const j = hasJong(w);
  if (part === '이에요' || part === '예요') return j ? '이에요' : '예요';
  if (part === '이었' || part === '였') return j ? '이었' : '였';
  if (part === '이야') return j ? '이야' : '야';
  if (part === '이나') return j ? '이나' : '나';
  return part;
}
const PART = '이에요|이지만|이랑|이야|이었|이다|이고|이면|이라|이나|으로|에서|에게|까지|부터|처럼|보다|마다|하고|예요|랑|였|로|을|를|은|는|과|와|이|가|인|에|의|도|만|들';
function compileLoc() {
  const R = REG[REGION] || {}, pairs = R.dict || [], map = Object.fromEntries(pairs);
  const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keys = pairs.map(p => p[0]).sort((a, b) => b.length - a.length);
  const re = keys.length ? new RegExp(`(?<![가-힣A-Za-z0-9])(${keys.map(esc).join('|')})(?:(${PART})|(?![가-힣A-Za-z0-9]))`, 'g') : null;
  const won = v => fmtUSD(v);
  const num = x => +String(x).replace(/,/g, '');
  return t => {
    let u = t;
    if (/원/.test(u)) u = u.replace(/(\d[\d,]*(?:\.\d+)?)\s?억(?:\s?(\d[\d,]*)\s?만)?\s?원/g, (m, a, b) => won(num(a) * 10000 + (b ? num(b) : 0)))
      .replace(/(\d[\d,]*(?:\.\d+)?)\s?만\s?원/g, (m, a) => won(num(a)))
      .replace(/(\d[\d,]*)\s?천\s?원/g, (m, a) => won(num(a) / 10))
      .replace(/(\d[\d,]*)\s?원(?![가-힣])/g, (m, a) => won(num(a) / 10000));
    if (re) u = u.replace(re, (m, k, part) => map[k] + fixPart(part, map[k]));
    for (const [re2, fn] of R.post || []) u = u.replace(re2, fn);
    // '원'(받침 있음) 뒤에 붙어 있던 조사 → '달러'(받침 없음)에 맞게
    if (/달러/.test(u)) u = u.replace(/달러(이랑|으로|을|은|과|이(?=[\s.,!?)"'…]|$))/g, (m, part) => '달러' + fixPart(part, '달러'));
    return u;
  };
}
function loc(t) {
  if (REGION === 'kr' || typeof t !== 'string' || !t) return t;
  if (!LOC) LOC = compileLoc();
  return LOC(t);
}

/* ---------- 능력치 등급 ---------- */
function gIdx(v) { let i = 0; while (i + 1 < GR.length && v >= GR[i + 1][1]) i++; return i; }
const gradeOf = v => GR[gIdx(v)][0];
const gradeMin = letter => (GR.find(g => g[0] === letter) || GR[0])[1];
function gradeInfo(v) {
  const i = gIdx(v), lo = GR[i][1], hi = GR[i + 1] ? GR[i + 1][1] : ABIL_CAP;
  return { letter: GR[i][0], idx: i, pct: Math.min(1, (v - lo) / (hi - lo)), value: v };
}
const LETTERS = GR.map(g => g[0]);
// 섹스 기술 (F ~ SSS): 등급, 0~150 점수(S = 100, SS 117, SSS 133~150)
const SG = D.sexGrades;
function sIdx(v) { let i = 0; while (i + 1 < SG.length && (v || 0) >= SG[i + 1][1]) i++; return i; }
const sexGrade = v => SG[sIdx(v)][0];
function sexInfo(v) {
  const i = sIdx(v), lo = SG[i][1], hi = SG[i + 1] ? SG[i + 1][1] : lo + 100;
  return { letter: SG[i][0], idx: i, pct: Math.min(1, ((v || 0) - lo) / (hi - lo)), value: v || 0 };
}
const sk100 = v => { const g = sexInfo(v); return (g.idx + g.pct) * 100 / 6; };
const SSS = () => sIdx(S.sexSkill) >= 8;
const pickKey = obj => weighted(Object.keys(obj), k => obj[k]);
// 등급 글자 → 그 등급 안의 아무 값
function gradeValue(letter) {
  const i = Math.max(0, LETTERS.indexOf(letter)), lo = GR[i][1], hi = GR[i + 1] ? GR[i + 1][1] : ABIL_CAP + 1;
  return rand(lo, hi - 1);
}
// 한 등급 위/아래로 (등급 안에서의 위치는 유지). cap: 최고 등급 번호
function gradeStep(v, dir, cap = LETTERS.length - 1) {
  const g = gradeInfo(v), i = clamp(g.idx + dir, 0, cap);
  const lo = GR[i][1], hi = GR[i + 1] ? GR[i + 1][1] : ABIL_CAP + 1;
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
  if (p.role) return p.role;   // 교수님·옆집 할머니처럼 역할이 있는 사람
  if (p.kind === 'neighbor' && p.unit && p.close < 45) return `이웃 · ${p.unit}`;   // 같은 건물·단지 이웃 (호수)
  if (p.org === 'mate' && p.close < 45) { const m = person(p.mateId); if (m) return `${pname(m)}의 ${mateWord(p)}`; }   // 아는 사람의 연인·배우자
  if (p.close >= 75) return '절친';
  if (p.close >= 45) return '친구';
  if (p.rtag) return p.rtag;   // 20세 시작: 과 친구·과 선배 / 사람 풀: 같은 과·선후배·단골·동네 상인
  if (p.tag && D.castLabel && D.castLabel[p.tag]) return D.castLabel[p.tag];   // 대학 1학년 고정 인물 (data/freshman.js — p.tag는 그쪽 이름표)
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
  delete p.stranger; delete p.couple;
  lookOf(p);
  S.people.push(p);
  S.vars.new = p.name; S.vars.newId = p.id;
  return p;
}
function addPerson(spec) { return enlist(makePerson(spec || meetDefault())); }
// 사람 한 명 만들기 (아직 관계 목록에는 안 넣음)
function makePerson(spec) {
  const gender = spec.gender || (Math.random() < .5 ? 'm' : 'f');
  const eth = REGION === 'kr' ? undefined : spec.eth || (spec.kind === 'family' || spec.kind === 'child' ? S.eth : null) || pickEth();   // 뉴욕: 가족은 나와 같은 배경
  let ageDiff = spec.ageDiff;
  if (ageDiff == null) {
    const r = spec.ageRange || [S.age, S.age];
    ageDiff = rand(Math.max(0, r[0]), Math.max(0, r[1])) - S.age;
  }
  const age = S.age + ageDiff;
  const hobby = spec.hobby || (spec.hobbyW ? wpickId(D.hobbies, spec.hobbyW) : pick(D.hobbies).id);
  const p = {
    id: null, kind: spec.kind || 'friend', role: spec.role || null,
    name: spec.name || nameFor(gender, eth), gender, ageDiff, eth,
    close: spec.close ?? rand(15, 30), trust: spec.trust ?? rand(15, 30), heart: spec.heart && age >= 19 && S.age >= 19 ? spec.heart : 0, grudge: spec.grudge ?? 0,
    taken: spec.taken ?? (age >= 24 ? Math.random() < .35 : age >= 19 ? Math.random() < .15 : false),
    met: S.age, debt: 0, sibling: !!spec.sibling,
    // 프로필 — 친해질수록 보임
    personality: spec.personality || (spec.persW ? wpickId(D.personalities, spec.persW) : pick(D.personalities).id),
    hobby,
    value: spec.value || pick(D.values).id,
    wealth: spec.wealth || (spec.wealthW ? weighted(D.wealth, w => (w.weight ?? 1) * (spec.wealthW[w.id] ?? 1)) : weighted(D.wealth)).id,
    dream: pick(D.dreams).id,
    npcJob: age >= 23 ? npcJobFor(age, spec.jobW) : null,
    feature: pick(D.features),
    hangout: spec.hangout !== undefined ? spec.hangout : pickHangout(hobby, age),   // 자주 가는 곳
    // 외모 3층 (등급 번호 0=F … 6=S). 몸은 체형(appearance.body)에서 계산
    face: spec.face ?? LETTERS.indexOf(pickKey(D.npcFace)), faceFixed: spec.face != null,   // 얼굴을 그리면 얼굴 점수 등급으로 바뀜 (정해 둔 등급은 그 등급의 얼굴을 찾음)
    style: spec.style ?? npcStyle(hobby, age),
    bodyPlus: Math.random() < .4,
    libido: age >= C.sexMinAge ? spec.libido ?? rand(10, 50) : 0,
    penis: gender === 'm' ? rollPenis() : null,   // 성기 크기(cm). 함께 밤을 보낸 뒤에만 보임
    pref: age >= 19 && Math.random() < .6 ? randomPref(gender) : null,   // 좋아하는 체형 (null이면 상관없음)
  };
  if (p.kind === 'child') p.role = '아이';
  if (spec.rtag) p.rtag = spec.rtag;   // 이벤트로 만난 사람의 관계 이름표 (동아리 사람·선후배 …)
  // 좋은 소문(한 사람과 오래, 존중함)이 돌면 새로 만난 어른이 처음부터 조금 더 믿어줌
  if (S.rumorType === 'good' && (S.rumor || 0) >= 30 && age >= 19 && p.kind !== 'family') p.trust = clamp(p.trust + rand(5, 10), 0, 100);
  // 기혼 NPC — 친밀 20이면 반지가 보이고, 40이면 결혼한 걸 알게 됨. 늘 몰래 만나는 사이로만 시작
  // 나이별 기혼 확률 (data/encounter.js) — 기혼자 85%는 반지를 끼고, 그중 일부는 술집·번화가에선 반지를 뺌
  if (spec.married ?? (!['family', 'child'].includes(p.kind) && spec.taken !== false && Math.random() < Math.min(.95, marriedChance(age) * (spec.marriedK ?? 1)))) { p.married = true; p.taken = true; }
  if (p.married) ringFor(p);
  p.seen = S.dayN || 0;
  // 피임약을 먹고 있는 사람 (20살 이상 여자, 냉철형·무심형이 조금 더 많음) — 피임을 물을 때 드러남
  if (gender === 'f' && age >= C.sexMinAge && !['family', 'child'].includes(p.kind) && Math.random() < (['sharp', 'cool'].includes(p.personality) ? .35 : .2)) p.pill = true;
  return p;
}
// 비중 배율로 고르기 (m에 없는 건 1) — 장소 분포(data/encounter.js crowds)의 성격·취미
const wpickId = (list, m) => weighted(list, x => m[x.id] ?? 1).id;
// 어른 NPC 직업: 나이에 맞는 것 중 비중대로 (data/jobs.js npcJobW). mult: 장소 분포의 직업 배율. 퇴직자는 58살부터, 65살부터는 대부분
function npcJobFor(age, mult) {
  const W = D.npcJobW;
  if (!W) return pick(D.npcJobs);
  const list = D.npcJobs.map(j => {
    const [w0, lo, hi] = W[j] || [1, 23, 62];
    const w = age < lo || age > hi ? 0 : j === '퇴직자' ? (age >= 65 ? 12 : 2) : w0;
    return [j, w * ((mult || {})[j] ?? 1)];
  }).filter(x => x[1] > 0);
  return list.length ? weighted(list, x => x[1])[0] : pick(D.npcJobs);
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
// opt: Avatar.make에 더 넘길 것 (장소 분포의 체격 비중 build)
function lookOf(p, opt) {
  if (!p.appearance && window.Avatar) {
    p.appearance = Avatar.make(`${S.id}:${p.sk || p.id}`, p.gender, Object.assign({ feature: p.feature, skin: p.kind === 'family' || p.kind === 'child' ? S.skin : null, personality: p.personality, hobby: p.hobby, job: p.npcJob, eth: p.eth }, opt));
    // 최고 미녀·미남 (BEAUTY): 20~39살 남(가족·아이 아님)의 0.5%는 성격에 맞는 유형으로 설계한 얼굴 — 지나가던 사람들이 돌아보는 사람
    const ag = npcAge(p);
    if (Avatar.beauty && !p.faceFixed && !['family', 'child'].includes(p.kind) && ag >= 20 && ag < 40 && Math.random() < .005)
      p.appearance = Avatar.beauty((BEAUTY_TYPE[p.gender] || BEAUTY_TYPE.f)[p.personality] || null, p.gender, `${S.id}:${p.sk || p.id}`);
    // 30대 이상 기혼자: 남자는 셔츠·재킷, 여자는 단정한 머리(C컬 단발·허쉬컷·로우 포니테일·로우번·반묶음)가 조금 더 많음
    if (p.married && npcAge(p) >= 30 && Math.random() < .5) { if (p.gender === 'm') p.appearance.top = pick([1, 1, 7]); else p.appearance.hair = pick([4, 3, 9, 12, 10]); }
    // 비슷한 얼굴 방지 (FACE_VARIETY.md §10): 같은 생활권(같은 소속, 아니면 같은 관계·같은 단골 장소)에 얼굴 거리 3 미만이 있으면 얼굴 시드만 바꿔 다시 (최대 5번)
    if (Avatar.faceDistance && !p.appearance.go) {
      const peers = alive().filter(q => q !== p && q.appearance && (p.org ? q.org === p.org : q.kind === p.kind && q.hangout === p.hangout)).slice(-40);
      for (let k = 1; k <= 5 && peers.some(q => Avatar.faceDistance(p.appearance, q.appearance) < 3); k++) p.appearance.gs = k;
    }
    faceFromLook(p);
  }
  return p.appearance || null;
}
const FACE_V = 3;   // 얼굴 점수 기준 판 (2: BEAUTY 기준, 3: 눈 20·눈썹 18·얼굴형 12) — 예전 판으로 매긴 등급은 한 번 다시 맞춤
const BEAUTY_TYPE = { f: { warm: '청순', shy: '청순', sensitive: '청순', bold: '고혹', sharp: '시크', cool: '시크', playful: '귀염', sunny: '귀염' },
  m: { warm: '훈남', sunny: '훈남', bold: '조각', sharp: '조각', shy: '꽃미남', sensitive: '꽃미남', playful: '꽃미남', cool: '시크' } };
// 생김새 등급 = 얼굴 점수 (FACE_UPGRADE 4절). 정해 둔 등급(고정 인물 등)이 있으면 그 등급의 얼굴을 찾음
function faceFromLook(p) {
  if (!p.appearance || !window.Avatar || !Avatar.faceInfo) return;
  const inf = p.faceFixed ? Avatar.fitGrade(p.appearance, LETTERS[p.face] || 'C') : Avatar.faceInfo(p.appearance, npcAge(p));
  if (inf && !p.faceFixed) p.face = LETTERS.indexOf(inf.grade);
  p.faceG = FACE_V;
  if (p.likeEye == null && window.Face) { p.likeEye = Math.floor(Math.random() * Face.EYES.length); p.likeNose = Math.floor(Math.random() * Face.NOSES.length); }   // 내 타입 (눈 하나·코 하나)
}
// 내 얼굴: 생김새 능력치의 등급이 나오는 얼굴을 찾고(처음 한 번), 능력치 숫자는 얼굴 점수에서 (등급 안의 위치)
function faceStat(inf) {
  const i = Math.max(0, LETTERS.indexOf(inf.grade)), lo = GR[i][1], hi = GR[i + 1] ? GR[i + 1][1] : lo + 40;
  return Math.round(lo + inf.pos * (hi - lo - 1));
}
// 얼굴 그림 등급은 S까지 (SS 생김새도 S 얼굴 중 가장 위로)
const faceLetter = v => { const L = gradeOf(v); return L === 'SS' ? 'S' : L; };
function fitMyFace() {
  if (!S.look || !window.Avatar || !Avatar.fitGrade) return;
  const inf = Avatar.fitGrade(S.look, faceLetter(S.stats.face));
  if (inf && inf.grade === gradeOf(S.stats.face)) S.stats.face = faceStat(inf);   // 같은 등급 안에서 숫자만 얼굴 점수 위치로 (이후 나이·성형 재계산과 이어지게)
  S.look.gfit = FACE_V;
}
function syncFace() {
  if (!S.look || !window.Avatar || !Avatar.faceInfo) return null;
  const inf = Avatar.faceInfo(S.look, S.age);
  if (inf) {   // fadj: 성형 최소 보정 (다시 계산해도 남게)
    const ss = gradeMin('SS'), v = clamp(faceStat(inf) + (S.look.fadj || 0), 0, ss - 1);
    S.stats.face = S.stats.face >= ss && inf.grade === 'S' ? S.stats.face : v;   // SS 생김새(샌드박스로 높게)는 얼굴 그림이 S로 남아 있는 동안 그대로 — 나이 들어 A로 내려가면 그때 같이
  }
  return inf;
}
let MF = { k: null, v: null };   // 내 얼굴 정보는 꼬심 계산마다 쓰여서 얼굴·나이가 같으면 다시 안 셈
function myFace() {
  if (!S.look || !window.Avatar || !Avatar.faceInfo) return null;
  const k = `${S.id}:${S.look.gs}:${S.look.gb}:${JSON.stringify(S.look.fx || 0)}:${S.age}`;
  if (MF.k !== k) MF = { k, v: Avatar.faceInfo(S.look, S.age) };
  return MF.v;
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
  p.wx = Object.assign({}, p.wx, { mono: (S.dayN || 0) + 60 });   // 이별하면 한동안 무채색 옷
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
  p.wx = Object.assign({}, p.wx, { extra: Math.min(3, ((p.wx && p.wx.extra) || 0) + 1), mono: 0 });   // 연애 시작 → 옷장에 새 옷 한 벌
  p.taken = false; p.ex = false; p.fling = false; p.fwb = false;
  p.since = S.age;
}
/* ═════════ 친밀한 관계와 아이 ═════════ */
// 함께 밤을 보냄 (fling: 사귀지 않는 사이 → '썸' 또는 '복잡한 사이')
function night(p, fling, quick) {
  if (!p) return;
  S.flags.intimate = true;
  if (S.place && S.place !== 'home' && !quick) S.sameClothes = (S.dayN || 0) + 1;   // 골목·화장실에서 잠깐이면 옷은 그대로 갈아입고 다님   // 밖에서 밤을 보냄 → 다음 날 같은 옷 (동기·동료가 알아챌 수 있음)
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
  if (S.scene && S.scene.kind === 'night' && S.scene.pid === p.id) S.scene.pregP = c;   // 디테일 모드 자궁 그림에 숫자로 보여 줌
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
  const mf = p.likeEye != null ? myFace() : null;
  if (mf && (mf.eyeIx === p.likeEye || mf.noseIx === p.likeNose)) m += 5;   // 내 타입인 눈·코 (생김새 점수와 별개)
  if (myHobby(p.hobby)) m += rand(5, 8);
  if (p.value === S.value) m += rand(5, 8); else if (valueClash(p)) m -= rand(5, 8);
  if (S.place === 'bar') m += rand(10, 15); else if (S.place === 'station') m += rand(8, 10);
  if (S.age >= C.sexMinAge && lustOf(p) >= 60) m += lustOf(p) / 8;   // 이 사람을 향한 내 성욕
  if ((p.libido || 0) >= 60 && npcAge(p) >= C.sexMinAge) m += p.libido / 10;   // 나를 향한 상대 성욕
  if (p.married) m -= p.ringOff ? rand(0, 5) : rand(15, 20);   // 술집에서 반지를 빼는 기혼자는 덜 망설임
  if (sit === 'bed' && !lover(p)) m += casualBonus();
  if (sit === 'bed' && SSS()) m += p.hooked ? 40 : 10;   // 섹스 기술 SSS: 한 번 같이 잔 사람은 빠져나오지 못함 (애인·남편이 있어도)   // 가벼운 관계(하룻밤·집으로 데려가기·즐기자는 제안)는 외모·매력이 크게 먹힘
  if (S.rumorType === 'bad' && (S.rumor || 0) >= 30 && sit !== 'close' && sit !== 'bed') m -= rand(10, 20);   // 나쁜 소문 — 새 사람이 경계함
  m += [0, 3, rand(10, 12), 5][d];
  m -= NORM('flirtNeed') || 0;   // 뉴욕: 다가가는 데 덜 망설임
  return looks + human + rel + m;
}
const charmed = (p, sit, need) => allure(p, sit) + rand(-15, 15) + DLGB >= need;   // DLGB: 대화 이벤트에서 고른 말이 잘 맞으면 + (dlgChoose)
// 그저 즐기는 관계: 외모(생김새·몸·꾸밈)와 매력이 높을수록 훨씬 쉬움 — 0(F·F) ~ 40(S·S)
function casualBonus() {
  const st = S.stats, looks = g100(st.face) * .6 + g100(st.fit) * .2 + g100(st.style) * .2;
  return Math.round((looks + g100(st.charm)) / 2 * .4 * (NORM('casualK') || 1));   // 뉴욕: 가벼운 만남이 더 자연스러움
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
  return clamp(Math.round(sk100(S.sexSkill) * .4 + (p.compat ?? 30) * .25 + sizeTerm(p) + p.heart * .15 + md * .1 + rand(-8, 8) + (adj || 0)), 0, SSS() ? 130 : 100);   // SSS면 100을 넘을 수 있음
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
  const chance = ps.length * .05 * f * (S.caughtN ? 1 : .5) * (NORM('rumorK') ?? 1);   // 뉴욕: 누구와 자든 덜 수군거림
  if (Math.random() >= chance) return;
  const avgSat = ps.reduce((t, p) => t + (p.bestSat || 0), 0) / ps.length;
  const type = !S.caughtN && !ps.some(p => p.grudge >= 40) && sIdx(S.sexSkill) >= 5 && avgSat >= 75 ? 'skill' : 'bad';
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
// 그날 밤의 흐름: 남자 쪽 종합(섹스 기술이 가장 큼 + 크기 + 매력 + 체력)으로 길이(분)·상대 절정 횟수(소·중·대)가 정해짐
//   너무 낮으면(종합 40 아래) 1~3분 만에 일찍 끝날 수 있고, 높을수록 길어져 SSS면 15~20분에 절정이 훨씬 많음. 상대 만족감이 30 아래면 절정 없음
function nightFlow(sat, cm) {
  const pow = sk100(S.sexSkill) * .55 + clamp((cm - 8) / 12 * 100, 0, 110) * .15 + g100(S.stats.charm) * .15 + g100(S.stats.fit) * .15;
  const early = pow < 40 && Math.random() < (40 - pow) / 30;
  const dur = early ? rand(1, 3) : clamp(Math.round(1 + Math.max(0, pow - 20) * .19 + rand(-1, 1)), 2, 20);
  const k = sat < 30 ? 0 : sat < 50 ? .5 : 1, per = dur / 5;   // 5분마다
  const n = rate => probRound(Math.max(0, rate) * per * k);
  const f = { dur, early, pow: Math.round(pow), grade: sIdx(S.sexSkill),
    minor: n((pow - 30) / 40), mid: sat < 50 ? 0 : n((pow - 50) / 50), major: sat < 50 ? 0 : n((pow - 75) / 45) };
  if (early) f.minor = f.mid = f.major = 0;
  return f;
}
// 그날 밤 테스트 창 (js/main.js): 저장 데이터는 그대로 두고 상대와 장면만 만듦 — 상대는 사람 목록에 넣지 않고, 섹스 기술·크기는 잠깐 바꿨다 되돌림
//   o: { gender, age, personality, chest, build, grade(0 F ~ 8 SSS), cm, sat(null이면 계산), spot, contra, preg }. 둘 다 20살 이상일 때만
function testNight(o) {
  if (S.age < C.sexMinAge) return null;
  const g = o.gender === 'm' ? 'm' : 'f';
  const p = makePerson({ gender: g, ageDiff: clamp(Math.round(o.age || 25), C.sexMinAge, 70) - S.age, personality: o.personality || undefined, kind: 'friend', married: false, taken: false });
  p.id = 'test'; p.close = p.trust = 70; p.heart = 80; p.compat = 60; p.libido = 80;
  const look = lookOf(p);
  if (look && look.body) { if (o.chest) look.body.chest = o.chest; if (o.build) look.body.build = o.build; }
  const keep = { sk: S.sexSkill, pe: S.penis }, cmv = clamp(Math.round(o.cm || 15), 6, 26), contra = D.contra.methods[o.contra] ? o.contra : 'none';
  if (S.gender === 'm') S.penis = cmv; else p.penis = cmv;
  S.sexSkill = SG[clamp(o.grade ?? 4, 0, SG.length - 1)][1] + 5;
  try {
    const herBuild = S.gender === 'm' ? (look.body || {}).build : myBuild(), pg = pGrade(cmv);
    let sat = o.sat != null && o.sat !== '' ? clamp(+o.sat, 0, SSS() ? 130 : 100) : satisfaction(p, 0, D.contra.methods[contra].sat || 0);
    if (o.sat == null || o.sat === '') { if (pg === 1) sat = Math.min(sat, 85); else if (pg === 2) sat = Math.min(sat, 92); else if (pg >= 5) sat = Math.max(sat, 30); }
    const flow = nightFlow(sat, cmv);
    if (o.sat == null || o.sat === '') sat = clamp(sat + flow.major * 2 + flow.mid, 0, SSS() ? 130 : 100);
    const mom = S.gender === 'f' ? S.age : npcAge(p), ageK = mom >= 45 ? 0 : mom >= 40 ? .25 : mom >= 35 ? .5 : mom >= 30 ? .8 : 1;
    const sc = { kind: 'night', pid: p.id, sat, first: false, fling: true, contra, spot: o.spot || 'home', direct: !o.fore, personality: p.personality, fig: figure(p), cm: cmv, build: herBuild, flow,
      preg: !!o.preg && contra !== 'both', pregP: .25 * D.contra.methods[contra].preg * ageK, test: true, text: '(테스트) ' + flowLine(flow), n: -1 };
    return { sc, p };
  } finally { S.sexSkill = keep.sk; S.penis = keep.pe; }
}
const flowLine = f => f.early ? `${f.dur}분 만에 끝나 버렸다.` : `${f.dur}분 동안.` + (f.minor + f.mid + f.major ? ` 상대가 ${[['소절정', f.minor], ['중절정', f.mid], ['대절정', f.major]].filter(x => x[1]).map(([l, v]) => `${l} ${v}번`).join(' · ')}.` : ' 상대는 끝까지 가지 못했다.');
function sexScene(p, o) {
  if (!canSex(p)) return null;
  const first = !S.flags.hadSex, firstWith = !p.nights;
  if (p.compat == null) p.compat = startCompat(p);
  const contra = takeContra(p), cm = D.contra.methods[contra || 'none'];
  let adj = cm.sat && sIdx(S.sexSkill) >= 4 ? Math.round(cm.sat / 2) : cm.sat;   // 콘돔은 익숙해지면 덜 깎임
  adj += resolve(o.satBonus) || 0;
  const awkward = sIdx(S.sexSkill) === 0;   // 섹스 기술 F — 어색한 순간이 끼어듦
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
  const flow = nightFlow(sat, pcm || 14);
  if (o.quick) { flow.dur = Math.min(flow.dur, rand(6, 14)); flow.major = Math.min(flow.major, 1); flow.mid = Math.min(flow.mid, 1); flow.minor = Math.min(flow.minor, 2); }   // 골목·화장실: 짧게
  sat = clamp(sat + flow.major * 2 + flow.mid, 0, SSS() ? 130 : Math.max(100, sat));   // 절정이 많으면 조금 더
  const tier = satTier(sat);
  // 해소: 이 사람을 향한 성욕은 크게, 다른 대상들은 조금 (몸이 채워져서)
  if (S.lust[p.id] == null) S.lust[p.id] = 0;
  addLust(p, -rand(70, 90));
  for (const id in S.lust) if (id !== p.id) S.lust[id] = clamp(S.lust[id] - rand(10, 20), 0, 100);
  p.libido = clamp((p.libido || 0) - (SSS() ? rand(15, 30) : rand(70, 90)), 0, 100);   // SSS: 끝나도 또 원함
  if (SSS()) { p.hooked = true; p.heart = clamp(p.heart + rand(4, 8), 0, 100); }
  // 대물·흉기는 보는 것만으로 상대 성욕 +10~15 (그래서 더 자주 먼저 원함)
  if (pg >= 5) { if (S.gender === 'm') p.libido = clamp(p.libido + rand(10, 15), 0, 100); else addLust(p, rand(10, 15)); }
  syncLibido();
  S.sexSkill = (S.sexSkill || 0) + Math.max(1, Math.round(rand(6, 10) * SG[sIdx(S.sexSkill)][2]));
  p.compat = clamp(p.compat + rand(5, 10), 0, 100);
  night(p, !!o.fling, !!o.quick);
  const prevBest = p.bestSat || 0;
  p.lastSat = sat; p.bestSat = Math.max(prevBest, sat);
  S.flags.hadSex = true;
  if (Math.random() < (lover(p) ? .3 : .75)) p.afterTxt = (S.dayN || 0) + rand(1, 3);   // 며칠 뒤 메시지 (afterTexts)
  const fig = figure(p);
  if (S.companion === p.id) S.companion = null;
  S.scene = { kind: 'night', pid: p.id, sat, first: firstWith, fling: !lover(p), contra, spot, direct: !!o.direct, personality: p.personality, fig, cm: pcm, build: herBuild, flow, quick: !!o.quick, spotLabel: o.quick ? S.vars.spotLabel || '' : '', n: (S.sceneN = (S.sceneN || 0) + 1) };   // cm·build: 그날 밤 ♂♀ 화살 길이·움찔 기준
  if (first) { S.vars.fp = p.id; trigger('firstTime'); }   // 내 첫 경험 — 상대 성격마다 다른 한 줄, 추억
  return { sat, tier, first, firstWith, lover: lover(p), legend: tier === 4 && prevBest < 90, contra, pregMul: cm.preg, awkward, flow, quick: !!o.quick };
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
    const pt = personality(p), base = pt.guilt ?? 40, g = SSS() ? 0 : Math.round(guiltOf(p.personality, sx.sat) * (p.fwb && !p.married ? .6 : 1) * (NORM('guiltK') ?? 1));   // SSS: 죄책감을 못 느낌   // 즐기기만 하기로 한 사이면 죄책감이 덜함
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
      S.stats[k] = clamp(b + v, 0, ABIL_CAP);   // 상한 (화면 1000)
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
  if (sx && tp.taken && !tp.partner && !tp.spouse) scheduleTrace(tp, sx);   // 애인·배우자가 있는 상대와 보낸 밤 → 흔적
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
  if (sx.flow) log(flowLine(sx.flow), { t: 'info' });
  if (sx.awkward) log(pick(L.awkward), { t: 'info' });
  // 그 사람과 처음 보낸 밤, 내 크기에 대한 반응 (내가 남자일 때, 대물·흉기 / 단소·소형)
  const sr = sx.firstWith && S.gender === 'm' && (pGrade(S.penis) >= 5 ? D.sizeReaction.big : pGrade(S.penis) <= 2 ? D.sizeReaction.small : null);
  if (sr && sr[p.personality]) log(fill(sr[p.personality], c), { t: 'info' });
  compareEx(p, sx, c);
  if (sx.first && sx.tier <= 1) { log(fill(pick(L.firstLow), c), { t: 'info' }); return; }
  const line = pick(L[sx.tier] || []);
  if (line && !sx.quick) log(fill(line, c), { t: sx.tier >= 3 ? 'text' : 'info', memory: sx.legend });
  if (sx.quick) {   // 골목·화장실: 옷매무새를 고치고 아무 일 없었다는 듯 (잠들기 전 대화·다음 날 아침 없음)
    log(fill(pick(sx.tier >= 3 ? ['{p|이} 헝클어진 머리를 손가락으로 빗으며 웃었다. "…미쳤어, 진짜."', '서로 옷매무새를 고쳐 주고, 아무 일 없었다는 듯 사람들 사이로 섞여 나왔다. 심장이 아직 쿵쾅거렸다.']
      : ['{p|이} 먼저 옷을 추스르고 나갔다. 조금 어색했다.', '숨을 고르고 시간 차를 두고 따로 나왔다.']), c), { t: 'info', memory: sx.legend });
    return;
  }
  afterTalk(p, sx, c);
  pillowTalk(p, sx, c);
  // 사귀지 않는 사이와 처음 보낸 밤 → 다음 날 아침 (해장·연락처·택시·선 긋기)
  if (sx.firstWith && !sx.first && !sx.lover && !npcIllicit(p) && !S.pending.length && Math.random() < .5) { S.vars.fp = p.id; trigger('af_morning'); }
}
// 끝나고 잠들기 전 한마디 (data/social.js afterTalk) — 사귀는 사이 / 사귀지 않는 사이 / 떳떳하지 못한 사이. 사랑 얘기는 사귀는 사이만
function afterTalk(p, sx, c) {
  const A = D.afterTalk;
  if (!A || Math.random() > .7) return;
  const set = npcIllicit(p) && !lover(p) ? A.illicit : (sx.lover ? A.love : A.casual)[sx.tier >= 2 ? 'good' : 'bad'];
  if (set && set.length) log(fill(pick(set), c), { t: 'info' });
}
// 1~3일 뒤 메시지 (data/events2.js af_*): 사귀는 사이 → 보고 싶다는 말 / 떳떳하지 못한 사이 → "지워 줘" / 사귀지 않는 사이 → 잘 들어갔냐는 말, 별로였으면 읽씹
function afterTexts() {
  if (S.pending.length || phase() !== 'adult' || jailed()) return;
  const day = S.dayN || 0, p = alive().find(x => x.afterTxt != null && x.afterTxt <= day);
  if (!p) return;
  delete p.afterTxt;
  if (!hasNumber(p) && !lover(p)) return;   // 번호도 모르는 원나잇 상대는 연락이 안 옴
  const id = lover(p) ? 'af_text_love' : npcIllicit(p) ? 'af_text_illicit' : (p.lastSat || 0) >= 45 && p.heart >= 15 ? 'af_text_casual' : 'af_ghost';
  if (id === 'af_text_love' && (S.companion === p.id || p.livesWith || p.spouse)) return;   // 같이 사는 사이는 문자 대신 얼굴 보고
  S.vars.fp = p.id; trigger(id);
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
  const diff = Math.min(100, sk100(S.sexSkill)) - p.exSkill;
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
//   상대 애인에게는: 그 애인이 같이 있을 때(커플로 만난 사람의 연인이 지금 여기 있음)가 아니면 그 자리에서는 거의 안 들킴 (×0.05)
//   함께 밤을 보낸 건 그 자리에서 들키지 않고, 며칠 안에 문자 내역·몸 자국으로 들킬 수 있음 (scheduleTrace, 상대 성격마다)
const mateHere = p => !!(p && p.mateId && S.place && S.here.some(h => h.key === p.mateId && !h.x));
function riskCheck(o, p) {
  const low = p && p.fwb ? .6 : 1;   // 섹파는 감정이 깊지 않아서 들킬 위험도 낮음
  const risk = (resolve(o.risk) || 0) * low, rt = (resolve(o.riskTaken) || 0) * low * (mateHere(p) ? 1 : o.intimate ? 0 : .05);
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

// 흔적: 상대 성격마다 들킬 확률과 들키는 방식(문자 내역 / 몸 자국)이 다름. 격한 밤·높은 섹스 기술은 자국을, 배우자는 더 잘 알아챔
//   1~3일 뒤 한 번 굴림. 같은 사람과 또 자면 더 높은 쪽으로
const TRACE = { sunny: [.16, 'text'], playful: [.14, 'text'], bold: [.12, 'mark'], sensitive: [.1, 'text'], warm: [.08, 'text'], shy: [.06, 'mark'], cool: [.04, 'text'], sharp: [.03, 'mark'] };
function scheduleTrace(p, sx) {
  const [base, kind0] = TRACE[p.personality] || [.08, 'text'];
  let ch = base * (sx.tier >= 4 ? 1.5 : sx.tier >= 3 ? 1.25 : 1) * (p.married ? 1.2 : 1);
  const markK = (sx.tier >= 4 ? .15 : sx.tier >= 3 ? .08 : 0) + (sIdx(S.sexSkill) >= 6 ? .1 : 0);
  const kind = Math.random() < (kind0 === 'mark' ? .75 : .15) + markK ? 'mark' : 'text';
  const old = (S.traces || []).find(t => t.pid === p.id);
  ch = Math.min(.35, Math.max(ch, old ? old.ch : 0));
  S.traces = (S.traces || []).filter(t => t.pid !== p.id).concat({ pid: p.id, day: (S.dayN || 0) + rand(1, 3), ch, kind });
}
function checkTraces() {
  if (!S.traces || !S.traces.length || S.pending.length) return;
  const today = S.dayN || 0, due = S.traces.filter(t => t.day <= today);
  if (!due.length) return;
  S.traces = S.traces.filter(t => t.day > today);
  for (const t of due) {
    const p = person(t.pid);
    if (!p || p.gone || !p.taken || p.partner || p.spouse || Math.random() >= t.ch) continue;
    S.vars.fp = p.id;
    log(fill(pick(D.traceLines[t.kind]), { mate: p.married ? (p.gender === 'f' ? '남편' : '아내') : p.gender === 'f' ? '남자친구' : '여자친구' }), { t: 'info' });
    S.caughtN = (S.caughtN || 0) + 1;
    trigger(p.married ? 'spouseCaught' : 'rivalFound');
    return;
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
  if (ev.region && ev.region !== REGION) return false;   // 그 나라에만 있는 이벤트 (data/region.js)
  if (ev.once !== false && S.done[ev.id]) return false;
  if (ev.cooldown && S.last[ev.id] != null && S.age - S.last[ev.id] < ev.cooldown) return false;
  if (ev.cdDays && S.lastDay && S.lastDay[ev.id] != null && (S.dayN || 0) - S.lastDay[ev.id] < ev.cdDays) return false;   // 며칠에 한 번 (강의 이벤트 등)
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
  if (ev.cdDays) (S.lastDay = S.lastDay || {})[ev.id] = S.dayN || 0;
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
// 등급 판정 (check: { stat, g }): 능력치가 기준 등급 g의 문턱이면 50%, 30점(한 등급쯤)마다 ±18%p, 5~95% — 선택지에 미리 보임
const checkPct = c => clamp(Math.round(50 + ((S.stats[c.stat] || 0) - gradeMin(c.g)) * .6 + (c.bonus ? resolve(c.bonus) : 0)), 5, 95);
const choiceLabel = c => fill(resolve(c.label)) + (c.check && c.check.g ? ` 〔🎲 ${LABEL[c.check.stat]} ${checkPct(c.check)}%〕` : '');

function currentEvent() {
  const p = S.pending[0];
  if (!p) return null;
  if (p.dlg) {   // 대화 이벤트
    const wp = person(p.pid);
    if (!wp || !dlgById(p.dlg)) { S.pending.shift(); return currentEvent(); }
    Object.assign(S.vars, p.tv);
    const kind = dlgById(p.dlg).kind;
    return { text: p.text, who: whoView(wp, p.id), choices: p.labels, dlg: kind };
  }
  const ev = EVENTS[p.id];
  if (!ev) { S.pending.shift(); return currentEvent(); }
  Object.assign(S.vars, p.tv);
  const wp = p.who && person(p.who);
  return { text: p.text, who: wp ? whoView(wp, p.id) : null, choices: choicesOf(ev).map(choiceLabel) };
}
// 이벤트 창 위에 보이는 사람 (나를 향한 성욕 → 표정)
const whoView = (wp, evId) => ({ look: lookOf(wp), age: npcAge(wp), name: pname(wp), rel: relLabel(wp), fig: figure(wp), libido: canSex(wp) ? wp.libido || 0 : 0, ctx: outfitCtx(wp, evId) });
function choose(i) {
  const p = S.pending[0];
  if (!p || S.ended) return;
  Object.assign(S.vars, p.tv);
  if (p.dlg) {
    if (!p.labels[i]) return;
    S.pending.shift();
    dlgChoose(p, i);
    after();
    return;
  }
  const ch = choicesOf(EVENTS[p.id])[i];
  if (!ch) return;
  S.pending.shift();
  log('▸ ' + fill(resolve(ch.label)), { t: 'pick' });
  let o = ch;
  if (ch.check && ch.check.g) {   // 등급 판정
    const pc = checkPct(ch.check), ok = rand(1, 100) <= pc;
    log(`🎲 ${LABEL[ch.check.stat]} 판정 ${pc}% → ${ok ? '성공' : '실패'}`, { t: 'info' });
    o = ok ? ch.success : ch.fail;
  } else if (ch.check && ch.check.dice) {   // 주사위: (능력치 lvl / 난이도) × 100 + rand(-20, 20), 5~95%
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
   adult  19살~   하루 단위 — 행동력 18칸(1칸 = 1시간, 아침 6시부터 자정까지), 새벽까지 깨면 24칸까지. 평일엔 출근·수업이 자동으로 칸을 씀
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
// 행동력 (100 기준): 학교 다닐 땐 자유 턴 100 · 방학 150, 장소 이동·행동·말 걸기가 한 번에 50 (한 주의 방과 후를 반씩)
const TURN_AP = { free: 100, vac: 150 }, TEEN_PT = 50, JAIL_AP = 100;
const TURN_LABEL = { class: '수업', free: '자유', mid: '중간고사', final: '기말고사', vac: '방학', mock: '모의고사', csat: '수능', apply: '원서 접수', result: '결과 발표' };
// 어른: 하루 100 (아침 6시 → 자정, 1 ≈ 11분) + 새벽 33. 행동마다 비용이 다름 (data/life.js pt, 기본 6 ≈ 1시간), 이동은 지도 거리로 (data/map.js)
const DAY_AP = 100, LATE_AP = 33;
const HPA = 18 / DAY_AP;              // 1이 몇 시간인지
const PT = { act: 6, eat: 5, talk: 5, intimate: 12, crime: 6, job: 6 };   // 어른의 기본 비용 (행동·밥·말 걸기·함께 밤·범죄·면접)
const hourOf = used => 6 + (used || 0) * HPA;
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
  checkTraces();
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
  if (ph === 'adult') { const h = hourOf(S.used); S.sky = clamp((h - 6) / 6, 0, 2); S.time = h < 11 ? 0 : h < 17 ? 1 : 2; }
  else if (ph === 'story') { S.sky = .4; S.time = 0; }
  else { S.sky = S.tkind === 'vac' ? .6 : 1.3; S.time = 1; }
}
// 시계 (어른): 아침 6시 + 쓴 칸 × 1.5시간
const clockOf = used => { const m = Math.round(hourOf(used) * 60) % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const SLOTS = [[9, '아침'], [12, '오전'], [13.5, '점심'], [19.5, '오후'], [22.5, '저녁'], [24, '밤'], [27, '새벽'], [99, '심야']];   // [몇 시 전까지, 때]
const slotOf = used => (SLOTS.find(([h]) => hourOf(used) < h) || SLOTS[SLOTS.length - 1])[1];

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
  S.tkind = k; S.used = 0; S.ap = jailed() ? JAIL_AP : TURN_AP[k] || 0;
  S.place = null; S.here = [];
  S.weather = rollWeather();
  updateTime();
  if (!jailed()) schoolTurn(k);
}
// 이번 턴을 끝내고(남은 행동은 쉬면서) 행동이 필요한 다음 턴까지 넘김 — 수업·시험 턴은 자동, 선택지가 걸리면 멈춤
function nextTurn() {
  if (busy() || !schedule()) return;
  if (S.ap > 0 && TURN_AP[S.tkind]) log(S.tkind === 'vac' ? '남은 방학은 집에서 뒹굴며 보냈다.' : '남은 시간은 쉬면서 보냈다.', { t: 'info', deltas: applyEffect({ health: S.ap >= TEEN_PT * 2 ? 1 : 0, happy: 1 }) });
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
  spoilBag();   // 🎒 가방 속 상한 음식
  afterTexts();   // 함께 밤을 보낸 사람에게서 온 메시지
  jobDaily();   // 💼 지원 결과·면접·합격
  certDaily();   // 📜 자격증 시험 날·발표
  S.place = null; S.here = []; S.zone = 'home'; S.at = 'home'; S.drunk = 0;
  if (!first) S.weather = rollWeather();
  if (isWeekend() && (S.fatigue || 0) > 0) S.fatigue--;
  updateTime();
}
// 평일에 해야 하는 일 (직장 45 ≈ 8시간 / 대학 수업 25 ≈ 4시간 반 / 군 복무 45). at: 끝나고 있는 곳 (지도)
function dutyOf() {
  if (phase() !== 'adult' || jailed() || isWeekend()) return null;
  if (S.flags.inArmy) return { id: 'army', ap: 45, label: '훈련', zone: 'home', at: 'home' };
  const cm = homeCommute();   // 통근 (사는 동네 → 직장·학교, 왕복)
  if (S.job) return { id: 'work', ap: ((job(S.job) || {}).ap || 45) + cm, label: '출근', zone: 'work', at: 'office' };
  if (S.flags.student && (S.school.start ?? 0) <= S.age) { const L = lecToday(); return L.length ? { id: 'class', ap: L.reduce((t, x) => t + lecAP(x), 0), label: '강의', zone: 'school', at: 'lecture', n: L.length } : null; }
  return null;
}
// 출근·훈련은 먼저 해야 다른 걸 함. 대학 강의는 막지 않음 — 직접 대학까지 가서 강의실에서 들음 (안 가면 결석)
const dutyPending = () => { const d = dutyOf(); return !!d && d.id !== 'class' && !S.worked; };
/* ── 대학 강의 (data/lecture.js): 학기 · 시간표 · 출석 · 시험 ──
   아침엔 집에서 깸 → 지도에서 대학으로 → 강의실에서 '📖 강의 듣기'. 시작 전이면 기다렸다 듣고, 10분 넘으면 지각, 끝나면 결석
   출석률·시험 점수·공부량이 1년 학점(yearly)에 들어감. 넘기는 날은 다 들은 것으로 */
const LEC = () => D.lecture || null;
const hm = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
function termNow() {
  const L = LEC();
  if (!L || !S.date) return null;
  const T = L.terms[REGION] || L.terms.kr, d = dateOf(), y = d.getFullYear();
  for (let i = 0; i < T.length; i++) {
    const [m0, d0, m1, d1, name] = T[i], a = new Date(y, m0 - 1, d0), b = new Date(y, m1 - 1, d1);
    if (d >= a && d <= b) { const week = Math.floor((d - a) / 864e5 / 7) + 1; return { name, week, exam: week === L.exam.mid ? 'mid' : week === L.exam.fin ? 'fin' : null, key: `${y}-${i}` }; }
  }
  return null;
}
const isLecStudent = () => phase() === 'adult' && !!S.flags.student && !!S.school && (S.school.start ?? 99) <= S.age && !!S.school.univ;
// 이번 학기 시간표 (학기가 바뀌면 새로): 전공 6할 + 교양, 같은 요일 시간이 겹치지 않게
function timetable() {
  const t = termNow();
  if (!t || !isLecStudent()) return null;
  const sc = S.school;
  if (!sc.tt || sc.tt.key !== t.key) {
    const L = LEC(), n = rand(L.perTerm[0], L.perTerm[1]), major = (L.dept[sc.dept] || L.dept.business).slice(), gen = L.general.slice();
    const slots = L.slots.slice().sort(() => Math.random() - .5), used = [], list = [];
    const span = x => [x[1] * 60 + x[2], x[1] * 60 + x[2] + x[3]];
    const clash = x => used.some(u => u[0].some(d => x[0].includes(d)) && span(u)[0] < span(x)[1] && span(x)[0] < span(u)[1]);
    for (const x of slots) {
      if (list.length >= n) break;
      if (clash(x)) continue;
      used.push(x);
      const mj = list.length < Math.ceil(n * .6), pool = mj ? major : gen;
      list.push({ name: pool.splice(rand(0, pool.length - 1), 1)[0] || pick(L.general), days: x[0], h: x[1], m: x[2], dur: x[3], major: mj });
    }
    list.sort((a, b) => a.days[0] - b.days[0] || a.h * 60 + a.m - b.h * 60 - b.m);
    sc.tt = { key: t.key, term: t.name, list };
    log(`🎓 ${t.name} 시간표: ${list.map(x => `${x.name}(${x.days.map(d => '일월화수목금토'[d]).join('')} ${hm(x.h + x.m / 60)})`).join(' · ')}`, { t: 'info' });
    save();   // 화면을 그리다 처음 만들어질 수도 있어서 바로 저장 (안 그러면 저장본이 기록 한 줄 뒤처짐)
  }
  return sc.tt;
}
const lecAP = x => Math.max(1, Math.round(x.dur / 60 / HPA));
const lecAtt = () => { const A = S.school.att || (S.school.att = { day: -1, st: {}, held: 0, went: 0, late: 0 }); if (A.day !== (S.dayN || 0)) { A.day = S.dayN || 0; A.st = {}; } return A; };
// 오늘 강의 (주말·방학·수감·군대면 없음)
function lecToday() {
  if (!isLecStudent() || isWeekend() || jailed() || S.flags.inArmy) return [];
  const tt = timetable();
  if (!tt) return [];
  const wd = dateOf().getDay(), t = termNow(), A = lecAtt();
  return tt.list.map((x, i) => Object.assign({}, x, { i })).filter(x => x.days.includes(wd))
    .map(x => { const st = x.h + x.m / 60; return Object.assign(x, { st, en: st + x.dur / 60, exam: t && t.exam && x.days[0] === wd ? t.exam : null, state: A.st[x.i] || null }); });   // 시험은 시험 주 그 강의 첫 시간에 한 번
}
// 화면용: 학기·주차, 오늘 강의(시각·상태), 다음 들을 강의, 출석률
function classInfo() {
  if (!isLecStudent()) return null;
  const t = termNow(), A = lecAtt(), now = hourOf(S.used), late = LEC().late / 60, onC = onCampus(standAt());
  const L = lecToday().map(x => ({ i: x.i, name: x.name, time: hm(x.st), end: hm(x.en), major: x.major, exam: x.exam, ap: lecAP(x),
    state: x.state || (now >= x.en - .05 ? 'gone' : now > x.st + late ? 'lateNow' : now >= x.st ? 'now' : 'later') }));
  const next = L.find(x => ['later', 'now', 'lateNow'].includes(x.state)) || null;
  const need = next ? lecNeed(lecToday().find(x => x.i === next.i)) : 0;
  const why = !next ? '' : !onC ? '대학에 가야 들을 수 있다' : busy() ? '지금은 못 함' : S.ap < need ? `행동력 ⚡${need} 필요` : '';
  const rate = A.held ? Math.round(A.went / A.held * 100) : null;
  const nx = next && lecToday().find(x => x.i === next.i), wait = nx ? Math.max(0, nx.st - now - (S.place === 'lecture' ? 0 : HPA)) : 0;
  return { term: t ? `${t.name} ${t.week}주차${t.exam === 'mid' ? ' · 중간고사 주' : t.exam === 'fin' ? ' · 기말고사 주' : ''}` : '방학', vac: !t, today: L, next, need, why, onCampus: onC, rate, att: A, wait: Math.round(wait * 10) / 10 };
}
// 지금 들으러 가면 드는 행동력: (강의실까지 1) + 시작까지 기다림 + 남은 강의 시간
function lecNeed(x) {
  if (!x) return 0;
  const now = hourOf(S.used) + (S.place === 'lecture' ? 0 : HPA);
  return (S.place === 'lecture' ? 0 : 1) + Math.max(1, Math.round((x.en - now) / HPA));
}
function attendLecture(i) {
  const L = lecToday(), x = i == null ? L.find(y => !y.state && hourOf(S.used) < y.en - .05) : L.find(y => y.i === +i);
  if (!x || x.state || busy() || !onCampus(standAt()) || hourOf(S.used) >= x.en - .05) return;
  const need = lecNeed(x);
  if (S.ap < need) return;
  const now0 = hourOf(S.used) + (S.place === 'lecture' ? 0 : HPA), wait = x.st - now0, late = now0 > x.st + LEC().late / 60, A = lecAtt();
  spend(need);
  if (S.place !== 'lecture' && PLACES.lecture) { enterPlace(PLACES.lecture); S.at = 'lecture'; }
  S.zone = 'school';
  A.st[x.i] = late ? 'late' : 'ok';
  S.vars.lecName = x.name;
  const tired = (S.fatigue || 0) >= 3 ? .6 : 1;
  S.school.studyYear += (x.dur >= 150 ? .02 : .01) * tired;
  if (x.exam) {   // 시험 주: 그 강의 시험 — 지능·공부량·출석률
    const rate = A.held ? A.went / A.held : 1, sc = clamp(Math.round(48 + gIdx(S.stats.smart) * 6 + Math.min(S.school.studyYear, 6) * 4 + (rate - .8) * 30 + rand(-14, 14) - (late ? 6 : 0)), 5, 100);
    (S.school.scores = S.school.scores || []).push(sc);
    log(`📝 ${x.exam === 'mid' ? '중간고사' : '기말고사'} — ${x.name}: ${sc}점. ${pick(LEC().examLines)}`, { t: 'info', deltas: applyEffect({ happy: sc >= 85 ? 3 : sc < 50 ? -3 : 0 }) });
  } else log(`📖 ${x.name} (${hm(x.st)}) — ${late ? pick(LEC().lateLines) : (wait >= 1 ? `강의 시작까지 ${Math.round(wait * 10) / 10}시간을 기다렸다. ` : wait > .25 ? '조금 일찍 와서 기다렸다. ' : '') + pick(LEC().lines)}`, { t: 'info' });
  if (S.sameClothes === (S.dayN || 0) && Math.random() < .5 && EVENTS.sameClothes) { S.sameClothes = -1; S.vars.dutyKind = 'class'; fire(EVENTS.sameClothes); }
  if (!x.exam) maybeRandom(['class'], .8);
  maybeRandom(['lecture', 'campus', 'study'], C.randomEventChance * .5);
  if (lecToday().every(y => y.state)) S.worked = true;
  after();
}
// 하루 끝: 못 간 강의는 결석. auto(넘기기)면 다 들은 것으로
function lecDayEnd(auto) {
  const L = lecToday();
  if (!L.length) return;
  const A = lecAtt();
  let miss = 0;
  for (const x of L) {
    if (!x.state) {
      if (auto) { A.st[x.i] = 'ok'; S.school.studyYear += (x.dur >= 150 ? .02 : .01); if (x.exam) (S.school.scores = S.school.scores || []).push(clamp(Math.round(50 + gIdx(S.stats.smart) * 6 + Math.min(S.school.studyYear, 6) * 4 + rand(-12, 12)), 5, 100)); }
      else { A.st[x.i] = 'miss'; miss++; }
    }
    A.held++;
    A.went += A.st[x.i] === 'ok' ? 1 : A.st[x.i] === 'late' ? .8 : 0;
    if (A.st[x.i] === 'late') A.late++;
  }
  if (miss) log(`🎓 강의 ${miss}개를 빼먹었다.${L.some(x => x.exam) ? ' 시험이었는데… 0점이다.' : ''} (출석률 ${Math.round(A.went / A.held * 100)}%)`, { t: 'info', deltas: applyEffect({ happy: -1 }) });
  if (miss && L.some(x => x.exam && A.st[x.i] === 'miss')) (S.school.scores = S.school.scores || []).push(...L.filter(x => x.exam && A.st[x.i] === 'miss').map(() => 0));
}
// 출근·수업 (자동으로 칸을 씀). auto: 넘기는 중
function doDuty(auto) {
  const d = dutyOf();
  if (!d || S.worked || (!auto && busy())) return;
  if (d.id === 'class') { if (!auto) attendLecture(); return; }   // 강의는 직접 가서 들음 (넘기기는 lecDayEnd)
  S.worked = true;
  const n = Math.min(d.ap, Math.max(0, S.ap));
  S.ap -= n; S.used += n; S.zone = d.zone; S.at = d.at; S.place = null; S.here = [];
  updateTime();
  const tired = (S.fatigue || 0) >= 3 ? .6 : 1;
  if (!auto && S.sameClothes === (S.dayN || 0) && (d.id === 'work' || d.id === 'class') && Math.random() < .55 && EVENTS.sameClothes) { S.sameClothes = -1; S.vars.dutyKind = d.id; fire(EVENTS.sameClothes); }   // 어제 옷 그대로 출근·등교
  if (d.id === 'work') {
    S.perf = clamp(S.perf + probRound((.12 + gIdx(S.stats.smart) * .02) * tired), 0, 100);
    const lunch = workLunch();   // 점심은 회사 근처에서
    if (!auto) log(`${pick(['출근했다. 하루가 길었다.', '회의, 메일, 회의. 퇴근길 하늘이 벌써 어두웠다.', '일을 마치고 퇴근했다.', '점심시간만 기다리며 오전을 버텼다.'])} 점심은 ${pick(FD().lunchSpots || ['회사 근처 백반집', '구내식당'])}에서 먹었다. (${fmtPrice(lunch)})`, { t: 'info' });
    const jc = (job(S.job) || {}).cat;
    if (!auto && !S.pending.length && Math.random() < .12) {   // 직업·업종별 고충 이벤트 (data/events2.js jb_*) — 출근한 날 열에 한 번쯤
      const hard = D.events.filter(e => /^jb_/.test(e.id) && e.type === 'random' && e.on && e.on.some(t => t === S.job || t === jc) && eligible(e));
      if (hard.length) fire(pick(hard));
    }
    maybeRandom(['work', ['office', 'it'].includes(jc) && 'office', S.job, jc], auto ? .01 : C.randomEventChance * .5);   // 사무실 이벤트는 사무·IT 직군만
  } else { S.meals = Math.max(S.meals || 0, 2); if (!auto) log('하루 종일 훈련을 받았다. 밥은 짬밥.', { t: 'info' }); }
}
// 잠자기 — 하루 끝. 밥을 거르면 건강이 깎이고, 새벽까지 깨 있었으면 다음 날 늦게 일어나고 피로가 쌓임
function endDay(auto) {
  const h0 = S.stats.health;
  S.companion = null;   // 동행은 그날까지
  if (dutyPending()) {   // 출근·수업을 빼먹음
    if (auto) doDuty(true);
    else if (S.job) { S.perf = clamp(S.perf - 4, 0, 100); log('출근을 안 했다. 휴대폰에 부재중 전화가 쌓였다.', { t: 'info', deltas: applyEffect({ happy: -1 }) }); }
  }
  lecDayEnd(auto);
  if (!auto) {
    const m = S.meals || 0;
    if (m < 2 && !S.flags.inArmy && !jailed()) log(m >= .5 ? (m >= 1 ? '오늘은 한 끼밖에 못 먹었다.' : '오늘은 군것질로만 버텼다.') : '하루 종일 아무것도 안 먹었다.', { t: 'info', deltas: applyEffect(m >= 1 ? { health: -1 } : { health: -2, happy: -1 }) });
    if (hourOf(S.used) >= 29) { S.wake = Math.round(6 / HPA); S.fatigue = (S.fatigue || 0) + 2; log('해가 뜰 무렵에야 잠들었다.', { t: 'info', deltas: applyEffect({ health: -3 }) }); }
    else if (hourOf(S.used) >= 25.5) { S.wake = Math.round(3 / HPA); S.fatigue = (S.fatigue || 0) + 1; log('새벽 늦게 잠들었다.', { t: 'info', deltas: applyEffect({ health: -1 }) }); }
  }
  libidoTick();
  if (S.drunk) soberUp();
  if ((S.fatigue || 0) >= 3) applyEffect({ health: -1 });
  // 제때 먹고 제때 자면 건강이 조금씩 회복 (나이·체력에 따른 기준선까지만)
  else if ((auto || (S.meals || 0) >= 2) && hourOf(S.used) < 25.5 && S.stats.health < healthBase() && Math.random() < .3) S.stats.health++;
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
  if (dutyPending()) doDuty(true);
  autoMeals();   // 끼니는 알아서 (식비만 나감)
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
/* ═════════ 먹을 것 (data/food.js) — 🍽 식당 · 🛵 배달 · 🎒 가방 ═════════
   끼니(S.meals): 하루 두 끼가 기준 (못 채우면 잠들 때 건강이 깎임). 먹을 때마다 메뉴의 건강·행복(기대값, 확률 반올림)
   건강은 나이·체력 기준선(healthBase)까지만 오름 — 자극적인 음식은 깎일 수도. 세 끼를 넘기면 더 먹어도 소용없음
   🎒 S.bag = [{ id, n, day }] — 편의점·시장·카페에서 산 것. keep일이 지나면 상해서 버림. 식재료는 집에서 해 먹기에 씀
   출근한 날 점심은 회사 근처에서(자동), 넘기는 날은 끼니 평균값만큼 나감(본가·군대·수감 중엔 0) */
const FD = () => (D.food || {})[REGION] || (D.food || {}).kr;
const BAG_MAX = 12;
const fPrice = x => REGION === 'kr' ? (x.won || 0) / 10000 : (x.usd || 0) / ((REG[REGION] || {}).money || 15);
// 메뉴 값 (내부 단위 → 원·달러 그대로)
function fmtPrice(v) {
  if (REGION !== 'kr') { const d = Math.round(v * ((REG[REGION] || {}).money || 15) * 100) / 100; return `${d % 1 ? d.toFixed(2) : d}달러`; }
  const w = Math.round(v * 1000) * 10;
  if (!w) return '0원';
  const man = Math.floor(w / 10000), rest = w % 10000;
  return man ? `${man}만${rest ? ' ' + rest.toLocaleString() : ''}원` : `${rest.toLocaleString()}원`;
}
const foodState = () => { if (!S.bag) S.bag = []; if (!S.food) S.food = { key: '', spent: 0, last: 0 }; return S.food; };
function payFood(v) {
  const F = foodState(), key = `${S.date.y}-${S.date.m}`;
  if (F.key !== key) { F.last = F.key ? F.spent : 0; F.key = key; F.spent = 0; }
  S.money -= v; F.spent += v;
}
const atHome = () => S.place === 'home' || (!S.place && (S.zone || 'home') === 'home');
const parentsHome = () => homeNow().id === 'parents' && !S.flags.married;
const foodBlock = () => phase() !== 'adult' ? '어른이 되면' : busy() ? '지금은 못 함' : jailed() ? '수감 중' : '';
const foodTags = f => [f.meal >= 1 ? '든든' : f.meal <= .25 ? '주전부리' : '간단히', ...(f.hp >= .8 ? ['건강식'] : f.hp < 0 ? ['자극적'] : []), ...(f.hy >= 1.5 ? ['행복 ↑↑'] : f.hy >= .9 ? ['행복 ↑'] : [])];
// 먹기 (모든 먹는 길이 여기로): 끼니 + 건강·행복
// 문장 속 {f|을} → 음식 이름 + 조사
const fillF = (t, label) => t.replace(/\{f(?:\|([^}]+))?\}/g, (m, j) => j ? subJ(label, j) : label);
function eatFood(f) {
  const before = S.meals || 0;
  S.meals = before + (f.meal ?? 1);
  const eff = {};
  if (before >= 3) return { deltas: [], full: true };   // 배불러서 더 먹어도 소용없음
  const hp = probRound(Math.abs(f.hp || 0)) * Math.sign(f.hp || 0), hy = probRound(Math.max(0, f.hy || 0)) + (before === 0 && hourOf(S.used || 0) >= 13 && Math.random() < .5 ? 1 : 0);   // 굶다가 먹으면 꿀맛
  if (hp > 0 && S.stats.health < healthBase() + 2) eff.health = hp; else if (hp < 0) eff.health = hp;
  if (hy) eff.happy = hy;
  return { deltas: applyEffect(eff), full: false };
}
// 지금 있는 곳에서 먹거나 살 수 있는 것 (장소 메뉴 · 파는 것 · 집)
function foodView(x, kind, mult = 1) {
  const price = fPrice(x) * mult, pt = kind === 'buy' ? 0 : x.pt ?? (x.meal >= 1 ? 3 : 2);
  let why = foodBlock();
  if (!why && price > 0 && S.money < price) why = '돈이 모자람';
  if (!why && S.ap < pt) why = `행동력 ⚡${pt} 필요`;
  return { id: x.id, label: x.label, icon: x.icon, price, priceT: fmtPrice(price), pt, meal: x.meal, tags: x.cook ? ['집에서 해 먹기'] : foodTags(x), keep: x.keep || 0, uses: x.uses || 0, why, ok: !why, with: !!x.with };
}
function foodHere() {
  const F = FD();
  if (!F || phase() !== 'adult') return null;
  const id = S.place || (atHome() ? 'home' : null);
  if (!id) return null;
  const c = companion() || (S.companion && person(S.companion)) || null;
  const out = { place: id, title: '', note: '', eat: [], buy: [], home: [], mate: c ? pname(c) : '' };
  const m = F.menus[id];
  if (m) { out.title = m.title; out.note = m.note || ''; out.eat = m.menu.map(x => foodView(x, 'menu', c ? 2 : 1)); }
  out.buy = F.items.filter(x => (x.at || []).includes(id)).map(x => foodView(x, 'buy'));
  if (id === 'home') {
    if (parentsHome()) out.home.push(foodView(F.home.parents, 'menu'));
    const gro = bagCount('groceries');
    out.home.push(Object.assign(foodView(F.home.cook, 'menu'), gro ? {} : { why: '식재료가 없다 (시장에서)', ok: false }, { left: gro }));
  }
  return out.eat.length || out.buy.length || out.home.length ? out : null;
}
// 식당·포장마차·카페에서 앉아서 먹기 (같이 온 사람이 있으면 2인분 — 내가 삼)
function eatMenu(id) {
  const here = foodHere(), v = here && here.eat.find(x => x.id === id);
  if (!v || !v.ok) return;
  const F = FD(), m = F.menus[here.place], x = m.menu.find(y => y.id === id), c = S.companion && person(S.companion);
  spend(v.pt); payFood(v.price);
  const r = eatFood(x);
  if (c) applyP(c, { close: probRound(x.with ? 2 : 1.2), heart: lover(c) || c.heart >= 30 ? probRound(x.with ? 1.5 : .6) : 0 });
  log(`${x.icon} ${c ? `${josa(pname(c), '와')} ` : ''}${subJ(x.label, '을')} 먹었다. (${fmtPrice(v.price)})${r.full ? ' 배가 불러서 반은 남겼다.' : ''}`, { t: 'info', deltas: r.deltas });
  after();
}
// 사서 가방에 넣기 (식재료는 끼니 수만큼)
function bagCount(id) { return (S.bag || []).filter(b => b.id === id).reduce((t, b) => t + b.n, 0); }
function bagUsed() { return (S.bag || []).reduce((t, b) => t + ((FD().items.find(x => x.id === b.id) || {}).cook ? 1 : b.n), 0); }
function buyFood(id) {
  const here = foodHere(), v = here && here.buy.find(x => x.id === id), x = FD().items.find(y => y.id === id);
  if (!v || !v.ok || !x) return;
  foodState();
  if (bagUsed() >= BAG_MAX && !(x.cook && bagCount(id))) { log(FD().say.full, { t: 'info' }); after(); return; }
  payFood(v.price);
  const day = S.dayN || 0, st = S.bag.find(b => b.id === id && b.day === day);
  if (st) st.n += x.uses || 1; else S.bag.push({ id, n: x.uses || 1, day });
  log(`🛒 ${subJ(x.label, '을')} 샀다. (${fmtPrice(v.price)}) 가방에 넣었다.`, { t: 'info' });
  after();
}
// 가방 보기: 상한 날까지
function bagList() {
  const F = FD(), day = S.dayN || 0;
  return (S.bag || []).map((b, i) => { const x = F.items.find(y => y.id === b.id) || { label: b.id, icon: '❔' };
    const left = x.keep ? x.keep - (day - b.day) : null;
    return { ix: i, id: b.id, label: x.label.replace(' (3끼분)', ''), icon: x.icon, n: b.n, cook: !!x.cook, left, meal: x.meal, tags: x.cook ? ['집에서 해 먹기'] : foodTags(x), pt: x.meal >= 1 ? 3 : 2,
      why: x.cook ? '집에서 해 먹기로' : foodBlock() || (S.ap < (x.meal >= 1 ? 3 : 2) ? '행동력 부족' : '') }; });
}
function eatBag(ix) {
  const b = (S.bag || [])[ix], F = FD(), x = b && F.items.find(y => y.id === b.id);
  if (!x || x.cook || foodBlock()) return;
  const pt = x.meal >= 1 ? 3 : 2;
  if (S.ap < pt) return;
  spend(pt);
  if (--b.n <= 0) S.bag.splice(ix, 1);
  const r = eatFood(x);
  log(`${x.icon} ${fillF(pick(F.say.eat), x.label)}${r.full ? ' 배가 불러서 반은 남겼다.' : ''}`, { t: 'info', deltas: r.deltas });
  after();
}
function dropBag(ix) { if (S.bag && S.bag[ix]) { S.bag.splice(ix, 1); save(); emit(); } }
// 상한 것 버리기 (아침마다)
function spoilBag() {
  if (!S.bag || !S.bag.length) return;
  const F = FD(), day = S.dayN || 0;
  S.bag = S.bag.filter(b => { const x = F.items.find(y => y.id === b.id); if (!x || !x.keep || day - b.day <= x.keep) return true; log(fillF(F.say.bad, x.label.replace(' (3끼분)', '')), { t: 'info' }); return false; });
}
// 집: 본가 집밥 · 해 먹기
function homeEat(kind) {
  const here = foodHere(), F = FD(), x = kind === 'parents' ? F.home.parents : F.home.cook;
  const v = here && here.home.find(y => y.id === x.id);
  if (!v || !v.ok) return;
  spend(v.pt);
  if (kind === 'cook') { const st = S.bag.find(b => b.id === 'groceries'); if (!st) return; if (--st.n <= 0) S.bag.splice(S.bag.indexOf(st), 1); }
  const r = eatFood(x), extra = kind === 'cook' && Math.random() < .3 ? applyEffect({ craft: 1 }) : [];
  log(`${x.icon} ${pick(x.say)}`, { t: 'info', deltas: r.deltas.concat(extra) });
  after();
}
// 🛵 배달 (집에 있을 때): 값 + 배달팁(뉴욕은 배달비 + 팁). 기다리는 동안 행동력
function deliveryInfo() {
  const F = FD(), Dv = F.delivery, rate = (REG[REGION] || {}).money || 15;
  const why = foodBlock() || (!atHome() ? '집에 있을 때만' : '');
  const fee = p => REGION === 'kr' ? Dv.tipWon / 10000 : (Dv.feeUsd / rate) + p * Dv.tipPct;
  const min = REGION === 'kr' ? Dv.minWon / 10000 : Dv.minUsd / rate;
  const stores = Dv.stores.map(st => Object.assign({}, st, { menu: st.menu.map((m, i) => { const p = fPrice(m), f = fee(p), tot = p + f;
    const w = why || (p < min ? `최소주문 ${fmtPrice(min)}` : S.money < tot ? '돈이 모자람' : S.ap < Dv.pt ? `행동력 ⚡${Dv.pt} 필요` : '');
    return { ix: i, label: m.label, price: p, priceT: fmtPrice(p), fee: f, feeT: fmtPrice(f), total: tot, totalT: fmtPrice(tot), tags: foodTags(m), why: w, ok: !w }; }) }));
  return { app: Dv.app, why, pt: Dv.pt, tipT: REGION === 'kr' ? `배달팁 ${fmtPrice(Dv.tipWon / 10000)}` : `배달비 ${fmtPrice(Dv.feeUsd / rate)} + 팁 ${Math.round(Dv.tipPct * 100)}%`, minT: fmtPrice(min), stores, home: atHome() };
}
function orderFood(storeId, ix) {
  const info = deliveryInfo(), st = info.stores.find(x => x.id === storeId), m = st && st.menu[ix];
  if (!m || !m.ok) return;
  const raw = FD().delivery.stores.find(x => x.id === storeId).menu[ix], c = S.companion && person(S.companion);
  spend(info.pt); payFood(m.total);
  const r = eatFood(raw);
  if (c) applyP(c, { close: probRound(1.2) });
  log(`🛵 ${st.name}에서 ${subJ(m.label, '을')} 시켰다. ${st.eta.split('~')[1] || st.eta} 만에 문 앞에 왔다.${c ? ` ${josa(pname(c), '와')} 나눠 먹었다.` : ''} (${m.totalT})`, { t: 'info', deltas: r.deltas });
  after();
}
// 넘기는 날 끼니 (출근한 날 점심은 doDuty에서) — 본가·군대·수감 중엔 돈이 안 듦
function autoMeals() {
  const F = FD(), need = Math.max(0, 2 - (S.meals || 0));
  if (need && F && !parentsHome() && !S.flags.inArmy && !jailed()) payFood(fPrice({ won: F.autoWon, usd: F.autoUsd }) * need);
  S.meals = Math.max(S.meals || 0, 2);
}
// 출근한 날 점심 (회사 근처·구내식당)
function workLunch() {
  const F = FD();
  if (!F) return 0;
  const p = fPrice({ won: F.lunchWon, usd: F.lunchUsd });
  payFood(p); S.meals = (S.meals || 0) + 1;
  return p;
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
  if (S.car) S.money -= rideCfg().carMonth || 15;   // 차 유지비 (보험·세금·주차)
  if (S.age >= 19 && !S.flags.inArmy && !jailed()) {   // 월세·관리비·대출 이자 (data/realty.js) + 집 하자·갱신
    const H = S.home || {};
    S.money -= (H.rent ?? homeNow().rent ?? 0) + (H.mgmt || 0) + Math.round((H.loan || 0) * (H.rate || 0) / 12);
    homeMonthly();
  }
}
// 화면용 시간 정보
function timeInfo() {
  const ph = phase(), d = S.date || { y: 2000, m: 3, d: 1 };
  const info = { phase: ph, y: d.y, m: d.m, d: d.d, dow: DOW[dow()], weekend: isWeekend(), season: SEASONS[SEASON_OF(d.m)], age: S.age };
  if (ph === 'adult') Object.assign(info, { clock: clockOf(S.used || 0), slot: slotOf(S.used || 0), used: S.used || 0, ap: S.ap, day: DAY_AP, lateMax: LATE_AP, late: (S.used || 0) >= DAY_AP,
    duty: dutyPending() ? dutyOf() : null, cls: phase() === 'adult' ? classInfo() : null, meals: S.meals || 0, fatigue: S.fatigue || 0, zone: ZONE_LABEL[S.zone || 'home'] });
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
  if (S.flags.student && S.school && S.age === S.school.start) chance = Math.max(chance, .5);   // 대학 1학년은 이벤트를 촘촘하게 (data/freshman.js)
  if (S.pending.length || Math.random() >= chance * ({ story: 0, ms: .8, hs: .8, adult: .45 })[phase()]) return;
  tags = asList(tags).filter(Boolean);
  const sid = (SEASONS[S.date ? SEASON_OF(S.date.m) : Math.max(0, S.seasonIdx)] || SEASONS[0]).id;   // 지금 계절 — season이 있는 이벤트는 그 계절에만
  const pool = D.events.filter(e => e.type === 'random' && (!e.season || e.season.includes(sid)) && (!e.on || e.on.some(t => tags.includes(t))) && eligible(e));
  if (pool.length) fire(weighted(pool, e => (typeof e.weight === 'function' ? e.weight(S, api) : e.weight ?? 1) * (e.on ? 2 : 1)));   // weight가 함수면 그때그때 (매력·외모 등)
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
  if (ph === 'hs' && g <= 3) { S.school.naesin.push(r.avg); r.note = `${REGION === 'kr' ? '내신 평균: ' : '누적 '}${gradeTxt(naesinAvg())}`; }
  S.school.prep = {}; S.school.bonus = {};
  log(`${r.school} ${r.title} — 평균 ${gradeTxt(r.avg)}.`, { t: 'info', deltas: applyEffect({ happy: r.avg <= 3 ? 3 : r.avg >= 7 ? -3 : 0 }) });
  S.report = r;
}
// 모의고사 (고2 11월, 고3 3·6·9월): 운이 더 크고(±15) 백분위로. 이대로면 어디까지 가능한지
function mockTurn() {
  const r = sitExam(`${S.date.m}월 모의고사`, 15);
  r.mock = true; r.rows.forEach(x => { x.pct = clamp(x.score + rand(-3, 3), 1, 99); });
  S.school.mocks.push(r.avg); S.school.mock = { avg: r.avg };
  const pred = mockAvg(), u = bestReach(pred);
  r.note = `모의고사 평균 ${gradeTxt(pred, 'sat')} · ` + (u ? `이대로 가면 ${u.name} 가능` : '이러다 큰일이다');
  log(`${r.title} — 평균 ${gradeTxt(r.avg, 'sat')}. ${u ? `이대로 가면 ${u.short}도 노려볼 만하다.` : '이러다 큰일이다. 등골이 서늘했다.'}`, { t: 'info' });
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
  S.vars.satText = `수능 평균 ${gradeTxt(r.avg, 'sat')}. ${r.note}`;
  log(`수능이 끝났다. 한 달 뒤, 성적표가 나왔다. 평균 ${gradeTxt(r.avg, 'sat')}. ${r.note}`, { memory: true });
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
  return !busy() && S.ap >= (phase() === 'adult' ? PT.crime : TEEN_PT) && !dutyPending() && phase() !== 'story' && !jailed() && S.age >= c.minAge && meets(c.req);
}
function commitCrime(id) {
  const c = D.crimes.find(x => x.id === id);
  if (!c || !canCrime(c)) return;
  spend(phase() === 'adult' ? PT.crime : TEEN_PT);
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
  if (a >= 40 && a % 5 === 0) {   // 40대부터 5년마다 턱선·얼굴 길이가 조금씩 → 얼굴 점수를 다시 계산
    const f0 = st.face, inf = syncFace();
    if (!inf) { if (a === 40 || a === 45) st.face = gradeStep(st.face, -1); }
    if (st.face < f0 || !inf) log('거울 속 얼굴에 세월이 보이기 시작했다.', { t: 'info' });
  }
  if (a >= 13) st.style = Math.max(0, st.style - rand(D.styleDecay[0], D.styleDecay[1]));
  if (S.closet) S.closet = S.closet.map(x => Object.assign({}, x, { q: Math.max(0, x.q - rand(8, 14)) })).filter(x => x.q > 5);   // 옷도 낡음
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
    const A = S.school.att, rate = A && A.held ? A.went / A.held : 1, sc = S.school.scores || [], exam = sc.length ? (sc.reduce((t, v) => t + v, 0) / sc.length - 70) / 50 : 0;
    const y = clamp(1.8 + Math.min(S.school.studyYear, 6) * .3 + gIdx(st.smart) * .1 + fit + exam - (rate < .5 ? 1 : rate < .75 ? .45 : rate < .9 ? .12 : 0) + rand(-3, 3) / 10, 1, 4.5);
    if (A && A.held) log(`🎓 지난 1년 출석률 ${Math.round(rate * 100)}%${A.late ? ` (지각 ${A.late}번)` : ''}${sc.length ? ` · 시험 평균 ${Math.round(sc.reduce((t, v) => t + v, 0) / sc.length)}점` : ''} → 학점 ${y.toFixed(2)}`, { t: 'info' });
    S.school.gpa = (S.school.gpa * S.school.gpaN + y) / (S.school.gpaN + 1);
    S.school.gpaN++;
  }
  S.school.studyYear = 0;
  if (S.school.att) { S.school.att.held = 0; S.school.att.went = 0; S.school.att.late = 0; }
  S.school.scores = [];
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
    if (!p.npcJob && npcAge(p) >= 23 && p.kind !== 'family') p.npcJob = npcJobFor(npcAge(p));
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
  capAbil();   // 능력치 상한 (예전 저장의 큰 값도 여기서 맞춤)
  for (const p of alive()) {
    if (p.married && !p.marriedKnown && (p.close >= 25 || (p.mateId && S.here.some(h => h.key === p.mateId)))) { p.marriedKnown = true; log(`알고 보니 ${josa(pname(p), '은')} 결혼한 사람이었다.`, { t: 'info' }); }
    if (p.divorced && !p.divorcedKnown && Math.max(p.close, p.trust) >= 40) p.divorcedKnown = true;
  }
  if (!S.ended) { syncHome(); ensurePools(); }
  if (S.lust) syncLibido();
  if (!S.ended) {
    if (S.stats.health <= 0) { S.ended = 'death'; S.pending = []; }
    else if (S.age >= C.endAge && !S.pending.length) S.ended = 'fifty';
  }
  // 단계가 바뀌면(예: 재수하다 대학에 붙음) 그 단계로 시작
  if (!S.ended && S.date) { const ph = phase(); if (S.ph !== ph) { const was = S.ph; S.ph = ph; if (was) beginPhase(); } }
  // 학교: 자유·방학 턴의 행동력을 다 쓰면 다음 턴으로 / 어른: 새벽까지 다 쓰면 쓰러지듯 잠듦
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
// 행동력 쓰기 (어른은 1마다 시계가 약 11분 감). 기본: 어른 6 / 학교 다닐 때 50
const unitAP = () => phase() === 'adult' ? PT.act : TEEN_PT;
function spend(n = unitAP()) { S.ap -= n; S.used = (S.used || 0) + n; updateTime(); if (phase() !== 'adult') libidoTick(); }
const apOf = a => phase() === 'adult' ? (a.pt ?? PT.act) : a.pt === 0 ? 0 : TEEN_PT;
const costOf = a => a.cost && S.age >= 18 ? resolve(a.cost) : 0;
// 지금 있는 장소에서 할 수 있는 행동 (수감 중엔 교도소 행동)
function actionList() {
  if (jailed()) return D.jailActions;
  const pl = PLACES[S.place];
  if (!pl) return [];
  return pl.actions.map(id => ACTIONS[id]).filter(a => a && S.age >= a.minAge && (a.maxAge == null || S.age <= a.maxAge) && meets(a.req) && (!a.if || a.if(S)) && !(a.id === 'parttime' && S.flags.inArmy) && !(a.id === 'pickup' && !kidAt(S.place)));   // 아이 데리러 가기는 그 나이 아이가 있을 때만
}
function canDo(a) { return !busy() && S.ap >= apOf(a) && !dutyPending() && (!costOf(a) || S.money >= costOf(a)); }
const needsSubject = a => a.id === 'houseHunt' || (a.id === 'study' && inSchool()) || (a.id === 'shop' && S.age >= 13 && !!window.Outfit && !!S.look);
// 공부할 과목 고르기 화면용: 지금 과목들의 예상 점수
const studyInfo = () => subjectsNow().map(id => ({ id, label: SUB(id).label, exp: Math.round(expScore(id)), prep: Math.round((S.school.prep || {})[id] || 0) }));
// 🎲 행동 창 (data/acts.js): 주사위 1~6 + 보정 → 등급. 등급 배수만큼 오르는 값이 달라짐
const ACT = () => D.acts || { dice: [], grades: {}, lines: {}, mods: {} };
const isDiceAct = a => !!a && !jailed() && ACT().dice.includes(a.id);
const OUTDOOR = ['park', 'playground', 'block', 'quad', 'campus'];
function actMods(a) {
  const M = ACT().mods, m = [], h = hourOf(S.used);
  if ((S.fatigue || 0) >= 3) m.push([M.tired, -1]);
  if (S.drunk) m.push([M.drunk, -1]);
  if (S.stats.health < 30) m.push([M.sick, -1]);
  if (S.stats.happy >= 80) m.push([M.mood, 1]);
  if (['study', 'read'].includes(a.id) && ['library', 'ulib'].includes(S.place) && (h >= 19 || h < 6)) m.push([M.nightLib, 1]);
  if (a.id === 'exercise' && S.place === 'gym') m.push([M.gym, 1]);
  const wet = ['rain', 'storm', 'snow', 'sleet', 'dust'].includes(S.weather);
  if (OUTDOOR.includes(S.place) && ['walk', 'exercise', 'play', 'rest'].includes(a.id)) m.push(wet ? [M.weather, -1] : a.id === 'walk' && ['park', 'quad'].includes(S.place) ? [M.park, 1] : null);
  return m.filter(Boolean);
}
function rollAct(a) {
  const mods = actMods(a), mod = clamp(mods.reduce((t, x) => t + x[1], 0), -2, 2), die = rand(1, 6), fin = clamp(die + mod, 1, 6);
  return Object.assign({ id: a.id, die, mod, mods, fin }, ACT().grades[fin] || { label: '', mult: 1 });
}
let LAST_ACT = null;
const actPreview = id => { const a = actionList().find(x => x.id === id); return a ? { id, label: a.label, icon: a.icon, dice: isDiceAct(a), mods: isDiceAct(a) ? actMods(a) : [], ap: apOf(a), cost: costOf(a), ok: canDo(a), place: S.place, placeLabel: (PLACES[S.place] || {}).label || '', hour: phase() === 'adult' ? hourOf(S.used) % 24 : 6 + (S.sky ?? 1) * 6, clock: phase() === 'adult' ? clockOf(S.used || 0) : '' } : null; };
function doAction(id, subj) {
  LAST_ACT = null;
  const a = actionList().find(x => x.id === id);
  if (!a || !canDo(a)) return;
  spend(apOf(a));
  if (a.meal) S.meals = (S.meals || 0) + 1;   // 학식: 끼니로 침
  const R = isDiceAct(a) ? rollAct(a) : null;
  LAST_ACT = R;
  const gk = gainK() * (R ? R.mult : 1);
  // 등급 한 줄 + 대성공·망함 보너스를 기록에 붙임
  const gradeTxt = t => { if (!R) return t; const L = (ACT().lines[a.id] || {})[R.fin]; return L ? `${t} ${pick(L)}` : t; };
  const actLog = (t, o) => { if (R) { if (R.bonus) o.deltas.push(...applyEffect(R.bonus)); R.text = t; R.deltas = o.deltas; } log(t, o); };
  if (a.id === 'study') {
    const deltas = applyEffect(a.effect, gk);
    if (inSchool()) {   // 다음 시험 보정: 골고루면 과목마다 3~5, 한 과목이면 8~10. 고등학교 공부 횟수는 수능에도
      const L = subjectsNow(), list = subj && L.includes(subj) ? [subj] : L;
      list.forEach(k => { const g = Math.max(1, probRound((list.length > 1 ? rand(3, 5) : rand(8, 10)) * (R ? R.mult : 1))); addPrep(k, g); deltas.push([SUB(k).label, g]); });
      if (phase() === 'hs') S.school.studyN = (S.school.studyN || 0) + 1;
    }
    if (S.flags.student) S.school.studyYear += gk;
    actLog(gradeTxt(fill(textOf(a.text))), { deltas });
    maybeRandom([a.id, S.place]); after(); return;
  }
  if (a.work) S.perf = clamp(S.perf + probRound((val(a.perf || [6, 12]) + gIdx(S.stats.smart)) * gk), 0, 100);
  if (a.escape) {
    const ok = S.stats.health + S.stats.smart + rand(-30, 30) >= 120;
    if (ok) { escape(true); log('한밤중에 담을 넘었다. 이제 쫓기는 몸이다.', { memory: true }); addKarma(-10); }
    else { escape(false); log('탈옥하다 붙잡혔다. 형기가 2년 늘었다.'); }
    after(); return;
  }
  if (a.id === 'shop' && subj != null) {   // 오늘 파는 옷 중 하나 (가격만큼 돈, 꾸밈은 옷장 평균 쪽으로)
    const it = shopToday()[+subj];
    if (it) {
      const d = buyItem(it), deltas = applyEffect({ money: -it.price, happy: rand(2, 4) });
      if (d) deltas.push([LABEL.style, d]);
      log(`${it.label}${josa(it.label, '을').slice(-1)} 샀다. 다음에 나갈 때 입어야지.`, { deltas });
      maybeRandom([a.id, S.place]); after(); return;
    }
  }
  if (a.id === 'exercise' || a.id === 'play') S.vars.exN = (S.vars.exN || 0) + 1;
  asList(a.set).forEach(f => { S.flags[f] = true; });
  asList(a.unset).forEach(f => { delete S.flags[f]; });
  if (a.drunk) drinkUp(a.drunk);
  if (a.id === 'rest' && S.fatigue) S.fatigue--;   // 쉬면 피로가 풀림
  const deltas = libidoDelta(a.libido, null).concat(applyEffect(a.effect, gk));
  const c = costOf(a);
  if (c) deltas.push(...applyEffect({ money: -c }));
  if (a.subjAll && inSchool()) { const g = Math.max(1, probRound(val(a.subjAll) * (R ? R.mult : 1))); subjectsNow().forEach(k => addPrep(k, g)); deltas.push(['모든 과목', g]); if (phase() === 'hs') S.school.studyN = (S.school.studyN || 0) + .5; }
  if (a.extra && inSchool()) S.school.extra = (S.school.extra || 0) + val(a.extra);   // 비교과: 동아리·봉사·독서 (수시 종합)
  addKarma(a.karma);
  if (a.id === 'pickup') { const [lo, hi] = S.place === 'kinder' ? [3, 6] : [7, 12]; for (const c of alive().filter(p => p.kind === 'child' && npcAge(p) >= lo && npcAge(p) <= hi)) deltas.push(...applyP(c, { close: [2, 4] })); }
  actLog(gradeTxt(fill(textOf(a.text))), { deltas, memory: a.memoryChance ? Math.random() < a.memoryChance : false });
  maybeRandom([a.id, S.place]);
  after();
}

/* ═════════ 옷 (HAIR_CLOTHES_BODY 3부) ═════════ */
// 그릴 때 넘기는 상황: 계절·날씨·장소·시간·요일 + 근무 중(출근복)·학교(교복)·집 밤(잠옷)·군복무 + 사람 정보(성격·취미·직업·꾸밈·산 옷)
const SEASON_EN = { 봄: 'spring', 여름: 'summer', 가을: 'fall', 겨울: 'winter' };
const JOB_PLACE = { 회사원: 'office', 은행원: 'office', 공무원: 'office', 프로그래머: 'office', 디자이너: 'office', 간호사: 'hospital', 선생님: 'school', 요리사: 'market', 자영업자: 'market', '배달 라이더': 'mall', 대학원생: 'campus', 프리랜서: 'cafe' };
const EVENT_DRESS = [[/wedding|marry|Wedd/i, 'wedding'], [/funeral|Funeral/, 'funeral'], [/interview/i, 'interview'], [/beach|sea|swim/i, 'beach']];
function outfitCtx(p, evId) {
  const me = !p, age = me ? S.age : npcAge(p), hour = hourOf(S.used), wk = isWeekend(), dayN = S.dayN || 0;
  const here = me ? S.place : (S.place && hereEntry(p.id) ? S.place : null);
  const ctx = { season: SEASON_EN[season().id] || 'spring', weather: S.weather, place: here, hour, weekend: wk, dayN };
  if (me) {
    ctx.home = !S.place || S.place === 'home';
    ctx.army = !!S.flags.inArmy;
    ctx.working = !!S.job && !wk && phase() === 'adult' && hour < 20 && !jailed();
    ctx.school = age >= 13 && age <= 18 && ((!wk && hour < 18) || ['school', 'academy'].includes(S.place));
    if (S.sameClothes === dayN) ctx.dayN = dayN - 1;   // 외박한 다음 날: 어제 옷 그대로
    if (S.vars.dateWear && S.vars.dateWear.day === dayN && !ctx.working) ctx.outfitIx = S.vars.dateWear.ix;
    ctx.who = { personality: S.personality, hobby: S.hobby, job: S.job, styleG: gIdx(S.stats.style), closet: S.closet || [], wx: S.wx };
  } else {
    const jp = p.npcJob && JOB_PLACE[p.npcJob];
    ctx.working = !!p.npcJob && age >= 23 && !wk && hour >= 9 && hour < 19 && (!here || here === jp || here === orgPlace(p));
    ctx.school = age >= 13 && age <= 18 && ((!wk && hour < 17) || here === 'school');
    ctx.home = !!(p.livesWith || p.spouse) && (!S.place || S.place === 'home') && (hour >= 22 || hour < 7);
    ctx.who = { personality: p.personality, hobby: p.hobby, job: age >= 23 ? p.npcJob : null, styleG: p.style ?? 2, wx: p.wx };
  }
  if (evId) for (const [re, ev] of EVENT_DRESS) if (re.test(evId)) { ctx.event = ev; break; }
  return ctx;
}
// 쇼핑 (3-7): 번화가·쇼핑몰에서 오늘 파는 옷 3벌 → 사면 옷장에 들어가 다음 외출부터 입음. 꾸밈은 옷장 평균 쪽으로 움직임
const shopToday = () => window.Outfit && S.look ? Outfit.shopItems(S.gender, S.age, SEASON_EN[season().id] || 'spring', `${S.id}:${S.dayN}:${S.place}`) : [];
const closetAvg = () => { const q = (S.closet || []).map(x => x.q).sort((a, b) => b - a).slice(0, 5); return q.length ? q.reduce((a, b) => a + b, 0) / q.length : null; };
function buyItem(it) {
  S.closet = (S.closet || []).concat([{ slot: it.slot, k: it.k, c: it.c, q: it.q, w: it.w, cut: it.cut, day: S.dayN || 0 }]).slice(-20);
  const before = S.stats.style, avg = closetAvg();
  S.stats.style = clamp(Math.round(Math.max(before + 2, lerp(before, avg, .35))), 0, 100);
  return S.stats.style - before;
}
// 데이트 옷 고르기: 옷장에서 지금 계절에 맞는 3벌 (꾸밈 점수 순 + 다양하게) → 상대 성격 취향과 맞으면 설렘 보너스
function dateOutfits() {
  if (!window.Outfit || !S.look) return [];
  const ctx = outfitCtx(null), W = Outfit.wardrobe(S.look, S.age, ctx.who), list = W.list.map((o, ix) => ({ o, ix })).filter(x => x.o.season === ctx.season);
  const seen = new Set(), pick3 = (list.length ? list : W.list.map((o, ix) => ({ o, ix }))).sort((a, b) => b.o.score - a.o.score).filter(x => { const d = Outfit.describe(x.o); if (seen.has(d)) return false; seen.add(d); return true; }).slice(0, 3);
  return pick3.map(x => ({ ix: x.ix, label: Outfit.describe(x.o), score: Math.round(x.o.score * 10) / 10 }));
}
function dateDress(p) {
  const ix = S.vars.dateOutfit;
  delete S.vars.dateOutfit;
  if (ix == null || !window.Outfit || !S.look) return null;
  const ctx = outfitCtx(null), o = Outfit.wardrobe(S.look, S.age, ctx.who).list[ix];
  if (!o) return null;
  S.vars.dateWear = { ix, day: S.dayN || 0 };   // 오늘 하루는 이 옷
  return { liked: Outfit.likes(p.personality, o), score: o.score, label: Outfit.describe(o) };
}

/* ═════════ 장소 ═════════ */
// 구역 (어른): 장소 배경·동네 판정에 씀. 이동 비용은 지도 거리로 (data/map.js, travelCost)
const ZONE = { home: 'home', conveni: 'home', playground: 'home', school: 'school', academy: 'school', library: 'school', campus: 'school',
  cafe: 'downtown', mall: 'downtown', gym: 'downtown', concert: 'downtown', bar: 'downtown', pcbang: 'downtown', motel: 'downtown',
  office: 'work', park: 'out', market: 'out', church: 'out', hospital: 'out', center: 'out', station: 'travel' };
const ZONE_LABEL = { home: '집 근처', school: '학교 쪽', downtown: '번화가', work: '직장', out: '외곽', travel: '여행지' };
// 지도 위치 (data/map.js — 나라별 덮어쓰기) / 지금 서 있는 곳: 장소 안이면 그 장소, 아니면 마지막에 있던 곳(출근·수업 뒤엔 직장·대학)
/* ═════════ 지도·교통 (data/map.js) ═════════
   지도 720×920 (나라별 실제 지리를 줄여 옮김). 집·편의점·집 앞·놀이터·학교·유치원 등은 사는 동네를 따라다님
   이동: 걷기·자전거·버스·지하철·내 차·택시 — 행동력(1 ≈ 11분)과 요금이 다름. 지하철은 가까운 역까지 걷기 + 역 사이, 서울은 자정 넘으면 막차 끊김(N버스만) */
const MAPD = () => D.map || {};
const MK = () => MAPD().k || 1;
const regMap = key => { const o = MAPD()[key] || {}; return o[REGION] || o.kr; };
function riverY(x) {
  const R = (regMap('water') || {}).river;
  if (!R) return null;
  for (let i = 0; i < R.length - 1; i++) if (x >= R[i][0] && x <= R[i + 1][0]) return R[i][1] + (R[i + 1][1] - R[i][1]) * (x - R[i][0]) / (R[i + 1][0] - R[i][0]);
  return R[R.length - 1][1];
}
const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
function inWater(x, y) {
  const Wt = regMap('water') || {};
  if (Wt.river) { const ry = riverY(x); if (ry != null && Math.abs(y - ry) < Wt.hw + 8 && !(Wt.islands || []).some(([ix, iy, rx, ry2]) => ((x - ix) / rx) ** 2 + ((y - iy) / ry2) ** 2 < 1)) return true; }
  return (Wt.polys || []).some(P => inPoly(P, x, y));
}
const dongPos = name => (regMap('dongs') || {})[name] || null;
// 본가(부모님 집) 동네: 집안 형편으로 한 번 정함
function parentsDong() {
  if (!S.vars.pDong || !dongPos(S.vars.pDong)) {
    const P = regMap('parents') || {}, L = P[S.wealth] || P.normal || Object.keys(regMap('dongs') || {});
    S.vars.pDong = L.length ? withSeed(`pd:${S.id}`, () => pick(L)) : null;
  }
  return S.vars.pDong;
}
const homeDong = () => { const H = S.home || {}; return H.id === 'parents' || !H.dong || !dongPos(H.dong) ? parentsDong() : H.dong; };
function homePos() {
  const H = S.home || {};
  if (H.pos && H.id !== 'parents') return H.pos;
  const p = dongPos(homeDong());
  return p ? [p[0] + 10, p[1] + 12] : [360, 460];
}
// 집을 따라다니는 장소: 집 + 오프셋, 물이면 반대쪽으로
// 같은 땅인지 (강 건너·섬 건너면 '집 근처'가 아님): 서울은 한강 북·남, 뉴욕은 맨해튼 / 뉴저지 / 브루클린·퀸스
function sideOf(x, y) {
  const Wt = regMap('water') || {};
  if (Wt.river) { const ry = riverY(x); return ry == null ? 'n' : y < ry ? 'n' : 's'; }
  if (Wt.manhattan && inPoly(Wt.manhattan, x, y)) return 'm';
  return x < 240 && y < 640 ? 'nj' : 'e';
}
function localPos(id, base = homePos()) {
  const off = (MAPD().local || {})[id];
  if (!off) return null;
  const [hx, hy] = base, W = MAPD().w || 720, H = MAPD().h || 920, side = sideOf(hx, hy);
  const r0 = Math.hypot(off[0], off[1]), a0 = Math.atan2(off[1], off[0]);
  for (const k of [1, .7, .45]) for (let t = 0; t < 8; t++) {   // 정한 방향부터 45°씩 돌려 가며, 안 되면 더 가까이
    const a = a0 + (t % 2 ? -1 : 1) * Math.ceil(t / 2) * Math.PI / 4, x = Math.round(clamp(hx + Math.cos(a) * r0 * k, 22, W - 22)), y = Math.round(clamp(hy + Math.sin(a) * r0 * k, 22, H - 22));
    if (!inWater(x, y) && sideOf(x, y) === side) return [x, y];
  }
  return [hx, hy];
}
// 아이 시설 (유치원·초·중·고): 가장 가까운 곳 / 집 근처 점수 (근처 집은 아이 있는 부부가 많음)
const kidsList = () => regMap('kids') || [];
function nearestKid(type, [x, y]) {
  let best = null, bd = 1e9;
  for (const k of kidsList()) if (k[0] === type) { const d = Math.hypot(k[2] - x, k[3] - y); if (d < bd) { bd = d; best = k; } }
  return best ? { name: best[1], pos: [best[2], best[3]], d: bd } : null;
}
const KID_W = { kinder: 1, elem: 1.2, mid: .5, high: .3 };
function kidsNear([x, y]) {
  let score = 0;
  for (const [t, , kx, ky] of kidsList()) { const d = Math.hypot(kx - x, ky - y); if (d < 90) score += (KID_W[t] || .5) * (d < 45 ? 1 : .5); }
  const e = nearestKid('elem', [x, y]), kd = nearestKid('kinder', [x, y]);
  return { score: Math.round(score * 10) / 10, elem: e && e.d < 90 ? { name: e.name, min: Math.max(1, Math.round(e.d / 4)) } : null, kinder: kd && kd.d < 90 ? { name: kd.name, min: Math.max(1, Math.round(kd.d / 4)) } : null, cho: !!(e && e.d < 50) };
}
// 직장: 다니는 회사 동네 (구인 사이트로 들어간 곳) — 예전 저장은 구역 대표 위치
const ZONE_POS = { kr: { school: [228, 352], downtown: [398, 346], work: [362, 300], out: [520, 700] }, ny: { school: [300, 500], downtown: [352, 372], work: [278, 590], out: [500, 360] } };
const zonePos = z => z === 'home' ? homePos() : (ZONE_POS[REGION] || ZONE_POS.kr)[z] || null;
const jobPos = () => { const p = S.jobDong && dongPos(S.jobDong); return p ? [p[0] + 16, p[1] - 12] : zonePos(S.jobZone) || null; };
const KID_PLACE = { kinder: 'kinder', elem: 'elem' };
function mapPos(id) {
  const M = D.map;
  if (!M) return null;
  if (PLACES[id] && PLACES[id].campus && id !== 'campus') id = 'campus';
  if (id === 'home') return homePos();
  if (KID_PLACE[id] || id === 'school') { const k = nearestKid(KID_PLACE[id] || (phase() === 'hs' ? 'high' : 'mid'), homePos()); if (k && k.d < 150) return k.pos; }
  if ((M.local || {})[id]) return localPos(id);
  if (id === 'office' && (S.jobDong || S.jobZone)) { const j = jobPos(); if (j) return j; }
  return ((M.pos || {})[REGION] || (M.pos || {}).kr || {})[id] || null;
}
// 아이 시설 장소 이름: 가까운 유치원·초등학교 이름으로
const kidPlaceName = id => { if (!KID_PLACE[id]) return null; const k = nearestKid(id, homePos()); return k && k.d < 150 ? k.name + ' 앞' : null; };
// 유치원·초등학교 앞의 아이들 (배경 — 사람 목록엔 안 들어가고 말 걸 수 없음): 등·하원 시간에 붐비고, 주말·밤엔 거의 없음. 같은 날·같은 시간엔 같은 수
const kidAt = id => alive().some(p => p.kind === 'child' && (id === 'kinder' ? npcAge(p) >= 3 && npcAge(p) <= 6 : npcAge(p) >= 7 && npcAge(p) <= 12));
function kidsAround() {
  if (!KID_PLACE[S.place] || phase() !== 'adult') return 0;
  const h = clockHour(), d = dow(), r = (hashStr(`${S.dayN || 0}:${S.place}:${h}`) % 1000) / 1000, el = S.place === 'elem';
  if (d === 0 || d === 6) return h >= 10 && h < 18 ? Math.round(2 + r * 6) : 0;   // 주말: 운동장에서 노는 아이 몇
  const peak = el ? (h >= 8 && h < 9.5) || (h >= 13 && h < 16) : (h >= 8 && h < 10) || (h >= 15 && h < 18);
  if (peak) return Math.round((el ? 35 : 15) + r * (el ? 30 : 12));
  return h >= 9 && h < 17 ? Math.round((el ? 6 : 3) + r * 8) : 0;   // 수업 중엔 운동장·담장 너머로 조금
}
/* 교통 */
const RIDE_IC = { walk: '🚶', bike: '🚲', bus: '🚌', subway: '🚇', car: '🚗', taxi: '🚕' };
const RIDE_LB = { walk: '걷기', bike: '자전거', bus: '버스', subway: '지하철', car: '내 차', taxi: '택시' };
const rideCfg = () => regMap('ride') || { hours: [0, 99] };
function stationList() { const out = []; for (const l of regMap('subway') || []) for (const s of l.st) out.push({ name: s[0], x: s[1], y: s[2], line: l.name }); return out; }
function nearestStation([x, y]) { let b = null, bd = 1e9; for (const s of stationList()) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; b = s; } } return b ? Object.assign({ d: bd }, b) : null; }
const fare = v => REGION === 'kr' ? fPrice({ won: v }) : fPrice({ usd: v });
// a → b 가는 방법들 (dest: 도착 장소 id — 주차비). o.h: 시각을 정해서 (통근은 아침 8시)
function routeOptions(a, b, dest, o = {}) {
  const R = rideCfg(), k = MK(), d = Math.hypot(a[0] - b[0], a[1] - b[1]) / k, h = o.h ?? hourOf(S.used || 0);
  const transit = h >= R.hours[0] && h < R.hours[1], wet = ['rain', 'storm', 'snow', 'sleet'].includes(S.weather), drunk = !o.h && !!S.drunk;
  const out = [{ mode: 'walk', ap: Math.max(1, Math.round(d / 28)), money: 0 }];
  if (R.bike) out.push({ mode: 'bike', ap: Math.max(1, Math.round(d / 40 + .3)), money: fare(R.bike), why: wet && !o.h ? '비·눈 오는 날은 무리' : drunk ? '술 마시고는 못 탐' : '' });
  if (R.bus) out.push({ mode: 'bus', ap: 1 + Math.round(d / 60) + (transit ? 0 : 1), money: fare(transit ? R.bus : R.nbus), nbus: !transit });
  const sa = nearestStation(a), sb = nearestStation(b);
  if (sa && sb) {
    const wa = sa.d / k, wb = sb.d / k, dn = Math.hypot(sa.x - sb.x, sa.y - sb.y) / k * 1.2;
    out.push({ mode: 'subway', ap: Math.max(1, Math.round((wa + wb) / 28 + dn / 160 + .8)), money: fare(R.subway + (R.subwayPer ? R.subwayPer * Math.floor(Math.max(0, dn - 60) / 40) : 0)), from: sa.name, to: sb.name,
      why: !transit ? '막차 끊김' : sa.name === sb.name || wa > 70 || wb > 70 ? '역이 멀다' : '' });
  }
  if (S.car) out.push({ mode: 'car', ap: Math.max(1, Math.round(d / 100 + .6)), money: fare(R.fuelPer * d) + ((MAPD().paidParking || []).includes(dest) ? fare(R.parking) : 0), why: drunk ? '음주운전은 안 된다' : '' });
  if (R.taxi) out.push({ mode: 'taxi', ap: Math.max(1, Math.round(d / 95 + .3)), money: fare((R.taxi + R.taxiPer * d) * (h >= 22 || h < 4 ? R.night : 1)) });
  out.forEach(x => { x.money = Math.round(x.money * 1000) / 1000; if (!x.why && x.money && S.money < x.money) x.why = '돈이 모자람'; x.min = x.ap * 11; x.why = x.why || ''; });
  return out;
}
// 교통 설정 (지도 위 칩): 자동 / 걷기 / 자전거 / 버스 / 지하철 / 내 차 / 택시
function setRide(m) { if (!RIDE_LB[m] && m !== 'auto') return; S.ride = m; save(); emit(); }
const carPrice = () => rideCfg().car || 1500;
function buyCar() {
  if (S.car || S.age < 20 || busy() || S.money < carPrice()) return;
  S.money -= carPrice(); S.car = { since: S.dayN || 0, price: carPrice() };
  log(`🚗 ${REGION === 'kr' ? '중고차' : '중고 세단'}을 한 대 샀다. 처음 시동을 걸 때 괜히 손이 떨렸다. (한 달 유지비 ${fmtMoney(rideCfg().carMonth || 15)})`, { memory: true, deltas: applyEffect({ happy: 3 }) });
  if (S.ride === 'auto' || !S.ride) S.ride = 'car';
  after();
}
function sellCar() {
  if (!S.car || busy()) return;
  const v = Math.round((S.car.price || carPrice()) * .6);
  S.money += v; S.car = null; if (S.ride === 'car') S.ride = 'auto';
  log(`🚗 차를 팔았다. ${fmtMoney(v)}를 받았다.`, { t: 'info' });
  after();
}
function rideInfo() {
  const R = rideCfg(), h = hourOf(S.used || 0);
  return { pref: S.ride || 'auto', car: !!S.car, carPrice: carPrice(), carMonth: R.carMonth || 15, canCar: S.age >= 20, bikeName: R.bikeName || '자전거', late: !(h >= R.hours[0] && h < R.hours[1]),
    modes: ['auto', 'walk', 'bike', 'bus', 'subway', ...(S.car ? ['car'] : []), 'taxi'].map(m => ({ id: m, ic: m === 'auto' ? '✨' : RIDE_IC[m], label: m === 'auto' ? '자동' : m === 'bike' ? (R.bikeName || '자전거') : RIDE_LB[m] })) };
}
// 고르기: 정해 둔 교통수단(S.ride)이 되면 그걸로, 아니면 자동 — 행동력 + 요금(만원 × 4) 이 가장 적은 것
function pickRoute(opts, pref) {
  const ok = opts.filter(o => !o.why);
  if (pref && pref !== 'auto') { const p = ok.find(o => o.mode === pref); if (p) return p; }
  return ok.slice().sort((x, y) => (x.ap + x.money * 4) - (y.ap + y.money * 4) || x.ap - y.ap)[0] || opts[0];
}
const campusPos = id => (D.map && D.map.campus && D.map.campus.pos[id]) || null;   // 캠퍼스 지도 위치
const onCampus = id => !!(PLACES[id] && PLACES[id].campus);
const standAt = () => S.place || S.at || 'home';
// 이동 비용: 학교 다닐 땐 어디든 50. 어른은 지도 거리 — 바로 옆 1, 가까우면 2, 멀면 3~10 (1 ≈ 11분)
// mode: 고른 교통수단 (지도에서 핀을 누르면 고르는 창) — 없으면 정해 둔 것(S.ride) 또는 자동
function travelRoute(pl, mode) {
  if (phase() !== 'adult') return null;
  const from = standAt();
  if (from === pl.id) return null;
  if (onCampus(from) && onCampus(pl.id)) return { mode: 'walk', ap: 1, money: 0, min: 11 };   // 캠퍼스 안은 걸어서 금방
  const a = mapPos(from), b = mapPos(pl.id);
  if (!a || !b) return { mode: 'walk', ap: 3, money: 0, min: 33 };
  const r = pickRoute(routeOptions(a, b, pl.id), mode || S.ride || 'auto');
  return Object.assign({}, r, { ap: clamp(r.ap, 1, 10) + (onCampus(pl.id) && pl.id !== 'campus' ? 1 : 0) });
}
function travelCost(pl, mode) {
  if (phase() !== 'adult') return TEEN_PT;
  const r = travelRoute(pl, mode);
  return r ? r.ap : 0;
}
// 가는 방법 고르기 창 (지도): 수단마다 행동력·시간·요금, 못 쓰는 까닭, 추천(자동이 고르는 것)
function routeChoices(id) {
  const pl = PLACES[id];
  if (!pl || phase() !== 'adult') return null;
  const from = standAt();
  if (from === id || (onCampus(from) && onCampus(id))) return null;
  const a = mapPos(from), b = mapPos(id);
  if (!a || !b) return null;
  const extra = onCampus(id) && id !== 'campus' ? 1 : 0, opts = routeOptions(a, b, id), best = pickRoute(opts, 'auto');
  const list = opts.map(o => { const ap = clamp(o.ap, 1, 10) + extra; return { mode: o.mode, ic: RIDE_IC[o.mode], label: o.nbus ? '심야 N버스' : o.mode === 'bike' ? rideCfg().bikeName || '자전거' : RIDE_LB[o.mode], ap, min: ap * 11, money: o.money, moneyT: o.money ? fmtPrice(o.money) : '무료', via: o.from && o.to ? `${o.from}역 → ${o.to}역` : '', why: o.why || (S.ap < ap ? `행동력 ⚡${ap} 필요` : ''), best: o === best }; });
  return { id, label: kidPlaceName(id) || pl.label, icon: pl.icon, from: mapPos(from), to: b, list, why: closedWhy(pl) || (dutyPending() ? '먼저 출근·수업부터' : ''), car: rideInfo() };
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
    const rt = phase() === 'adult' ? travelRoute(pl) : null;
    return { id: pl.id, label: kidPlaceName(pl.id) || pl.label, icon: pl.icon, why: closedWhy(pl), regular: !!S.regular[pl.id], cost, zone: ZONE_LABEL[ZONE[pl.id] || 'out'], pos: pl.campus && pl.id !== 'campus' ? null : mapPos(pl.id),
      ride: rt ? { mode: rt.mode, ic: RIDE_IC[rt.mode], money: rt.money, moneyT: rt.money ? fmtPrice(rt.money) : '', min: rt.min } : null,
      campus: !!pl.campus, cpos: pl.campus ? campusPos(pl.id) : null, clabel: pl.campusLabel || pl.label,
      here: S.place === pl.id, at: !S.place && standAt() === pl.id,
      ok: S.place !== pl.id && !busy() && S.ap >= cost && (cost || S.ap > 0) && !dutyPending() && placeOpen(pl) };
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
// 장소 분포 (data/encounter.js crowds): 기본값에 지금 시간·요일 규칙을 위에서부터 덮어씀 (성격·취미·직업·형편·체격 배율 표는 합침)
const PROF_MAPS = ['pers', 'hobby', 'job', 'wealth', 'build'], PROF_IF = ['h', 'we', 'fri', 'days', 'night', 'when'];
function crowdProfile(pl, night) {
  const C = D.encounter.crowds && D.encounter.crowds[pl.id];
  if (!C) return null;
  const adult = phase() === 'adult', h = clockHour(), d = dow(), we = d === 0 || d === 6, out = {};
  const put = o => { for (const k in o) if (!PROF_IF.includes(k)) out[k] = PROF_MAPS.includes(k) ? Object.assign({}, out[k], o[k]) : o[k]; };
  put(C);
  for (const w of C.when || []) {
    if (w.h && (!adult || h < w.h[0] || h >= w.h[1])) continue;
    if (w.we != null && w.we !== we) continue;
    if (w.fri && !(d === 5 && (adult ? h >= 17 : night))) continue;
    if (w.days && !w.days.includes(d)) continue;
    if (w.night != null && w.night !== !!night) continue;
    put(w);
  }
  return out;
}
// 처음 보는 사람 한 명. P: 장소 분포 (어른이 된 뒤엔 나이도 분포대로, 그 전엔 또래·어른 나이대) / lead: 일행의 첫 사람 / mate: lead의 연인(커플)
function makeStranger(pl, night, lead, sk, P, mate) {
  let type = (night && pl.nightCrowd) || pl.crowd;
  if (Array.isArray(type)) type = pick(type);
  const E = D.encounter, fr = P && P.female != null ? P.female : pl.id === 'conveni' && clockHour() >= 21 ? E.femaleRatio.conveniNight : E.femaleRatio[pl.id] ?? .5;
  const la = lead ? npcAge(lead) : 0;
  let ageRange;
  if (mate) ageRange = [Math.max(19, la - 3), la + 3];
  else if (lead) ageRange = [Math.max(pl.minAge || 0, la - 4), Math.min(pl.maxAge ?? 99, la + 4)];
  else if (P && S.age >= 19) { const b = weighted(P.age, x => x[x.length - 1]); ageRange = b[0] === 'peer' ? crowdRange('peer') : [b[0], b[1]]; }
  else ageRange = crowdRange(type);
  const p = makePerson({
    kind: pl.kind || 'friend', gender: mate ? (Math.random() < .94 ? (lead.gender === 'f' ? 'm' : 'f') : lead.gender) : Math.random() < fr ? 'f' : 'm',
    ageRange, hangout: pl.id,
    personality: lead && !mate && Math.random() < .5 ? lead.personality : undefined,   // 일행끼리는 비슷한 사람
    hobby: mate ? (Math.random() < .4 ? lead.hobby : undefined) : !P && pl.hobby && Math.random() < .6 ? pl.hobby : undefined,
    persW: P && P.pers, hobbyW: P && P.hobby, jobW: P && P.job, wealthW: P && P.wealth, marriedK: P ? P.married : undefined,
    married: mate ? !!lead.married : undefined, taken: mate ? true : undefined,   // 커플: 기혼이면 배우자, 아니면 서로 사귀는 사이
    close: rand(4, 10), trust: rand(4, 10),
  });
  p.id = 'x' + (++S.xseq);
  p.stranger = true;
  if (sk) p.sk = sk;
  const a = npcAge(p);
  if (P && P.style && a >= 13) p.style = clamp(p.style + Math.floor(P.style + Math.random()), 0, 6);   // 번화가·공연장은 잘 꾸민 사람, 시장·병원은 편한 차림
  // 직진형·장난형은 가끔 먼저 말을 걸어옴 (FACE_UPGRADE 6-3) — 어른은 어른끼리, 10대는 비슷한 또래끼리만
  if (!lead && ['bold', 'playful'].includes(p.personality) && Math.random() < .3 && (S.age >= 20 ? a >= 20 && Math.abs(a - S.age) <= 12 : S.age >= 13 && a < 20 && Math.abs(a - S.age) <= 2)) p.approach = true;
  lookOf(p, P && P.build ? { build: P.build } : null);
  return p;
}
// 길거리 즉석 생성 (FACE_UPGRADE 6-2): 씨앗 = 인생·날짜·장소·시간대·둘러본 횟수 → 같은 날 같은 장소·시간이면 같은 사람들, 다음 날은 새 사람들
//   정해진 씨앗으로 Math.random을 잠깐 바꿔 굴림 (사람 만들기·얼굴·옷이 전부 같은 결과). 이미 말을 걸어 아는 사이가 된 사람(sk)은 빠짐
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seededRng(key) {
  let a = hashStr(key);
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function withSeed(key, fn) { const R = Math.random; Math.random = seededRng(key); try { return fn(); } finally { Math.random = R; } }
function browseState() { if (!S.browse || S.browse.d !== (S.dayN || 0)) S.browse = { d: S.dayN || 0, n: {} }; return S.browse; }
const BROWSE_MAX = 3;
function crowdSeed(pl) {
  const slot = phase() === 'adult' ? 'h' + Math.floor(clockHour() / 3) : 't' + (S.time || 0);   // 어른: 3시간 단위, 학생: 턴의 때
  return `${S.id}:${S.dayN || 0}:${pl.id}:${slot}:${browseState().n[pl.id] || 0}`;
}
//   무리 중 일부는 커플 (장소 분포의 couple — 주말 번화가·공원에 많음): 어른 둘, 대개 남녀, 기혼이면 배우자
function spawnCrowd(pl, night, room) {
  const st = (D.encounter.count[countKey(pl)] || [null, pl.crowdN || [0, 2]])[1], seed = crowdSeed(pl), P = crowdProfile(pl, night);
  const met = new Set(S.people.map(p => p.sk).filter(Boolean)), out = [];
  withSeed(seed, () => {
    let nS = Math.round(rand(st[0], st[1]) * crowdMult(pl) * weatherMult()), i = 0;
    while (nS > 0) {
      const lead = makeStranger(pl, night, null, `${seed}:${i++}`, P), grp = [];
      const couple = !!(P && P.couple) && nS >= 2 && npcAge(lead) >= 19 && Math.random() < P.couple;
      const size = couple ? 2 : Math.min(nS, groupRoll(pl));
      if (couple) {
        const m = makeStranger(pl, night, lead, `${seed}:${i++}`, P, true);
        lead.taken = true; lead.couple = m.couple = true; lead.approach = false;
        grp.push(m);
      } else for (let k = 1; k < size; k++) grp.push(makeStranger(pl, night, lead, `${seed}:${i++}`, P));
      nS -= size;
      if (!met.has(lead.sk)) out.push({ lead, grp });
    }
  });
  const res = [];
  for (const g of out) { if (room <= 0) break; g.grp = g.grp.slice(0, room - 1); room -= 1 + g.grp.length; res.push(g); }
  return res;
}
const grpDoing = (pl, p) => { const E = D.encounter, L = p.couple ? E.coupleDoing : E.groupDoing; return L[pl.id] || L._; };
function doingFor(pl, p, night, taken) {
  let list = (night && pl.nightDoing) || pl.doing;
  if (typeof list === 'function') list = list(S, p, api);
  const fresh = list.filter(t => !taken.includes(t));
  return pick(fresh.length ? fresh : list);
}
// 장소에 도착하면 (NPC_ENCOUNTER.md): 아는 사람은 한 명씩 재출현 확률을 굴려 장소별 수까지, 처음 보는 사람은 장소별 수 × 시간대·요일·날씨, 40%는 일행과 같이
//   집은 같이 사는 사람 (regulars 함수)
// 장소에서 일하는 사람 (data/places.js GAME_DATA.staff) — 그 장소에 가면 늘 있음
//   한 번 만들면 같은 사람 (org = staff:장소[:동네][:해]:번호). 집 근처 장소는 사는 동네마다, 학교 담임은 해마다
//   tag가 있으면 대학 1학년 고정 인물과 같은 사람 (교수님·동아리 회장)
const STAFF_YEARLY = ['school', 'elem', 'kinder'];
function staffKey(pl, i) {
  const local = D.map && ((D.map.local || {})[pl.id] || KID_PLACE[pl.id]);
  const uni = PLACES[pl.id] && PLACES[pl.id].campus || pl.id === 'campus' ? `:${(S.school && S.school.univ) || ''}` : '';
  return `staff:${pl.id}${local ? ':' + homeDong() : ''}${uni}${STAFF_YEARLY.includes(pl.id) ? ':' + S.age : ''}${pl.id === 'office' ? ':' + (S.vars.jobOrg || S.job || '') : ''}:${i}`;
}
const staffRole = sp => (REGION !== 'kr' && sp.ny) || sp.role;
function staffOf(pl) {
  const L = (D.staff || {})[pl.id] || [], out = [];
  L.forEach((sp, i) => {
    if (sp.when && !sp.when(S, api)) return;
    const key = staffKey(pl, i);
    let p = sp.tag ? alive().find(x => x.tag === sp.tag) : alive().find(x => x.org === key);
    if (!p) {
      p = poolPerson({ kind: sp.tag ? 'friend' : 'staff', role: staffRole(sp), gender: sp.gender, ageDiff: rand(sp.age[0], sp.age[1]) - S.age, personality: sp.pers ? pick(sp.pers) : undefined, hangout: null, close: rand(2, 8), trust: rand(5, 12) }, key);
      if (sp.tag) { p.tag = sp.tag; if (sp.tag === 'prof') p.name = (REGION === 'kr' ? p.name.slice(0, 1) : p.name.split(' ').pop()) + ' 교수님'; }
      p.staffAt = pl.id;
      if (sp.job) p.npcJob = sp.job;
    }
    out.push({ p, sp });
  });
  return out;
}
function fillHere(pl, bring, night) {
  const here = [], taken = [], E = D.encounter, inHere = new Set();
  const add = (p, x, grp, doing) => {
    const roll = () => doing || (grp ? pick(grpDoing(pl, p)) : doingFor(pl, p, night, taken));
    const d = x && p.sk ? withSeed(p.sk + ':do', roll) : roll();   // 같은 사람은 같은 일을 하는 중
    taken.push(d); inHere.add(p);
    here.push({ key: p.id, x: x ? p : undefined, doing: d, used: false, grp: grp || undefined });
    if (!x) p.seen = S.dayN || 0;
  };
  if (bring) add(bring);
  // 일하는 사람 먼저 (교수님·담임 선생님·점원·사장님 …)
  for (const { p, sp } of staffOf(pl)) if (!inHere.has(p) && ageFits(pl, S.age)) { add(p, false, null, pick(sp.doing || ['일하고 있다'])); here[here.length - 1].staff = true; }
  if (typeof pl.regulars === 'function') {
    const cands = pl.regulars(S, api).filter(p => p !== bring && ageFits(pl, npcAge(p)));
    const [lo, hi] = pl.regularsN || [1, 2];
    for (const p of shuffle(cands).slice(0, rand(lo, hi))) add(p);
    if (KID_PLACE[pl.id] && pl.crowd) for (const { lead, grp } of spawnCrowd(pl, night, E.maxHere - here.length)) add(lead, true, grp.length ? grp : null);   // 유치원·초등학교 앞: 내 아이 + 아이 데리러 온 엄마들
    return here;
  }
  const [kn] = E.count[countKey(pl)] || [[1, 2]], m = crowdMult(pl), P = crowdProfile(pl, night), open = P && P.open != null ? P.open : 1;
  // 아는 사람: 이 장소가 단골 장소·소속(학교·직장)·동네면 잘 나옴. 일행(group)이 있으면 같이 올 때가 많음
  //   열린 장소(시장·번화가·공원·터미널…)는 open 배율만큼만 — 대부분 그날그날 처음 보는 사람들
  const nK = Math.round(rand(kn[0], kn[1]) * m);
  const hits = shuffle(alive().filter(p => p !== bring && p.kind !== 'family' && p.kind !== 'child' && !(p.staffAt && !lover(p)) && ageFits(pl, npcAge(p)) && Math.random() < encounterChance(p, pl) * open));   // 일하는 사람은 자기 일터에서만 (친해져 사귀면 예외)
  const MW = E.mateWith, mateOK = MW && S.age >= 19 && MW.at.includes(pl.id), wkd = isWeekend() ? .15 : 0;
  for (const p of hits) {
    if (here.length - (bring ? 1 : 0) >= nK || here.length >= E.maxHere) break;
    if (inHere.has(p)) continue;
    add(p);
    // 연인·배우자와 같이 온 아는 사람 (주말엔 더 자주) — 짝이 없으면 이때 생김
    if (mateOK && !p.spouse && !p.partner && !p.secret && npcAge(p) >= 19 && (p.married || p.taken) && Math.random() < (p.married ? MW.married : MW.taken) + wkd) {
      const m = mateOf(p, true);
      if (m && !inHere.has(m) && here.length < E.maxHere) add(m, false, null, p.married ? '배우자와 함께' : '연인과 함께');
    }
    for (const id of p.group || []) { const g = person(id); if (g && !inHere.has(g) && here.length < E.maxHere && ageFits(pl, npcAge(g)) && Math.random() < .7) add(g, false, null, '일행과 함께'); }
  }
  // 처음 보는 사람 (일행은 한 줄로)
  if (pl.crowd) for (const { lead, grp } of spawnCrowd(pl, night, E.maxHere - here.length)) add(lead, true, grp.length ? grp : null);
  return here;
}
// 지금 이 장소에 오는 사람들 한 줄 (장소 분포의 note, 어른이 된 뒤) — 도착한 시각 기준
function crowdNote(pl, night) {
  const P = S.age >= 19 && pl.crowd ? crowdProfile(pl, night) : null;
  return P && P.note ? { pl: pl.id, t: P.note, open: (P.open ?? 1) < .5 } : null;
}
function enterPlace(pl, bring, night = S.time === 2) {
  S.place = pl.id; S.placeNight = night;
  S.here = fillHere(pl, bring, night);
  S.hereNote = crowdNote(pl, night);
  S.vars.placeLabel = pl.label;
}
// 장소에 가기 (행동 1). 거기 있는 사람에겐 행동 없이 한 번씩 말을 걸 수 있음
// 동행 — 잠자리 제안·가볍게 즐기기를 받아준 사람이 오늘 하루 같이 다님 (모텔·집으로). 하루가 끝나거나 그날 밤을 보내면 헤어짐
const companion = () => { const p = S.companion && person(S.companion); return p && canSex(p) ? p : null; };
function setCompanion(p) { S.companion = p ? p.id : null; }
function goPlace(id, mode) {
  const pl = PLACES[id];
  const cost = pl ? travelCost(pl, mode) : 0, rt = pl ? travelRoute(pl, mode) : null;
  if (!pl || S.place === id || busy() || S.ap < cost || S.ap <= 0 || dutyPending() || !placeOpen(pl)) return;
  const night = S.time === 2;   // 사람은 도착한 때(행동 쓰기 전) 기준으로 채움
  if (S.drunk && ZONE[pl.id] !== ZONE[S.place]) soberUp();
  if (rt && (rt.mode !== 'walk' || rt.ap >= 3)) {   // 교통: 요금 내고 한 줄 (가까운 걸음은 생략)
    if (rt.money) S.money -= rt.money;
    log(`${RIDE_IC[rt.mode]} ${rt.nbus ? '심야 N버스' : rt.mode === 'bike' ? rideCfg().bikeName || '자전거' : RIDE_LB[rt.mode]}로 ${rt.min}분${rt.from && rt.to ? ` — ${rt.from}역 → ${rt.to}역` : ''}${rt.money ? ` (${fmtPrice(rt.money)})` : ''}`, { t: 'info' });
  }
  if (cost) spend(cost);
  S.zone = ZONE[pl.id] || 'out'; S.at = pl.id;
  enterPlace(pl, companion(), night);   // 동행은 같이 옴
  log(`${pl.icon} ` + fill(textOf(pl.arrive) || `${josa(pl.label, '으로')} 갔다.`), { t: 'place' });
  if (!pl.routine) {
    S.visits[id] = (S.visits[id] || 0) + 1;
    if (S.visits[id] >= D.regularVisits && !S.regular[id]) { S.regular[id] = true; log(`이제 ${pl.label} 단골이다. 얼굴을 알아보는 사람이 생겼다.`, { t: 'info' }); }
  }
  if (id === 'realty' && phase() === 'adult') { realtyState().agentDay = S.dayN || 0; log('중개사가 오늘 들어온 매물 몇 개를 따로 보여 줬다. 📱 방구하기에 "중개사 추천"으로 올라왔다.', { t: 'info' }); }
  coupleSpot();
  maybeRandom(pl.campus ? [id, 'campus'] : [id], cost ? C.placeEventChance : C.placeEventChance / 2);
  after();
}
function leavePlace() {
  if (!S.place || S.ended) return;
  if (S.drunk) soberUp();
  S.at = S.place; S.place = null; S.here = []; S.hereNote = null;
  save(); emit();
}
// 여기 있는 사람들 (화면용)
function hereList() {
  if (!S.place) return [];
  const ids = new Set(S.here.map(h => h.key));
  return S.here.map(h => {
    const p = h.x || person(h.key);
    if (!p) return null;
    const lead = h.x && h.x.couple && h.grp && h.grp[0];   // 처음 보는 커플: 같이 있는 짝
    return { key: h.key, stranger: !!h.x, staff: !!h.staff, p, doing: h.doing, used: h.used, grp: (h.grp || []).length, couple: !!(h.x && h.x.couple), approach: !!(h.x && h.x.approach && !h.used),
      wed: lead ? !!p.married : false, withMate: !h.x && !!p.mateId && ids.has(p.mateId), ring: ringVisible(p), phone: !h.x && hasNumber(p) };
  }).filter(Boolean);
}
// 둘러보기 (FACE_UPGRADE 6-3): 그냥 지나가기 — 이번 방문 동안은 목록에서 빠짐
function passBy(key) {
  if (!S.place) return;
  S.here = S.here.filter(h => !(h.x && h.key === key));
  save(); emit();
}
// 새로 둘러보기: 행동 0으로 같은 장소의 다른 쪽 = 씨앗 +1로 새 무리 (장소당 하루 3번). 아는 사람은 그대로
const browseLeft = () => S.place ? BROWSE_MAX - (browseState().n[S.place] || 0) : 0;
function browseMore() {
  const pl = S.place && PLACES[S.place];
  if (!pl || !pl.crowd || busy() || browseLeft() <= 0) return false;
  const B = browseState();
  B.n[pl.id] = (B.n[pl.id] || 0) + 1;
  const keep = S.here.filter(h => !h.x), taken = keep.map(h => h.doing), night = !!S.placeNight;
  const fresh = spawnCrowd(pl, night, D.encounter.maxHere - keep.length).map(({ lead, grp }) => {
    const d = withSeed(lead.sk + ':do', () => grp.length ? pick(grpDoing(pl, lead)) : doingFor(pl, lead, night, taken));
    taken.push(d);
    return { key: lead.id, x: lead, doing: d, used: false, grp: grp.length ? grp : undefined };
  });
  S.here = keep.concat(fresh);
  S.hereNote = crowdNote(pl, night);
  log(`${pl.icon} ${pl.label}의 다른 쪽을 둘러봤다.`, { t: 'place' });
  save(); emit();
  return true;
}
const hereEntry = pid => S.place ? S.here.find(h => h.key === pid && !h.x) : null;
// 처음 보는 사람에게 말 걸기 (행동 안 씀). 잘 되면 관계 목록에 들어감
function talkTo(key) {
  const h = S.place && S.here.find(x => x.key === key && x.x);
  if (!h || h.used || busy()) return null;
  h.used = true;
  const x = h.x, pt = personality(x);
  const odds = clamp(.2 + allure(x, 'first') / 55 + (pt.open || 0) + (trait().relMult ? .1 : 0) + (x.ringOff && D.encounter.ringOffAt.includes(S.place) ? .1 : 0) + (x.approach ? .4 : 0) - (x.couple ? .15 : 0), .15, .95);   // 첫인상은 생김새·꾸밈이 크게 / 먼저 말을 걸어온 사람은 거의 받아줌
  const opener = x.approach ? '"저기요." 처음 보는 사람이 먼저 말을 걸어왔다. ' : '처음 보는 사람에게 말을 걸었다. ';
  if (Math.random() >= odds) {
    log(fill(opener + (x.approach ? '어색하게 몇 마디 나누다 흐지부지 헤어졌다.' : pt.snub)), { deltas: applyEffect({ happy: -1 }) });
    after();
    return null;
  }
  const came = !!x.approach;   // 먼저 다가온 사람 (번호까지 줌)
  delete h.x; delete x.approach;
  const couple = !!x.couple;
  const p = enlist(x);
  h.key = p.id;
  // 일행: 대표와 이야기하면 나머지도 인사를 나눔 → 관계 목록에 (서로 아는 사이)
  const grp = (h.grp || []).map(m => { m.close = rand(3, 8); m.trust = rand(3, 6); const q = enlist(m); S.here.push({ key: q.id, doing: '일행과 함께', used: false }); return q; });
  delete h.grp;
  if (grp.length) { const ids = [p.id, ...grp.map(q => q.id)]; for (const q of [p, ...grp]) q.group = ids.filter(id => id !== q.id); }
  if (couple && grp[0]) { p.mateId = grp[0].id; grp[0].mateId = p.id; }   // 커플: 서로의 연인 (같이 있으면 들키기 쉬움)
  const fl = firstLook(), romantic = canRomance(p);
  const deltas = applyP(p, { close: [6, 12], trust: [3, 7], heart: romantic ? [Math.max(0, (fl - 2) * 3), Math.max(3, (fl - 1) * 4)] : 0 });
  const hello = S.age < 13 ? pick(D.kidHello) : pt.hello;
  const react = romantic ? ' ' + D.faceReact.first[LETTERS[fl]] : '';
  // 번호: 먼저 다가온 사람은 번호까지 주고, 아니면 아직 없음 (📱 번호 묻기). 일행은 얼굴만 아는 사이
  p.phone = came || S.age < 13;
  grp.forEach(q => { q.phone = false; q.acq = true; if (couple) q.org = 'mate'; });
  log(opener + fill(hello + react, { p: pname(p) }) + (grp.length ? ` 일행 ${josa(grp.map(pname).join(', '), '와')}도 인사를 나눴다.` : '') + (came && S.age >= 13 ? ' 헤어질 때 번호를 주고받았다.' : ''), { deltas });
  // 연인·배우자와 같이 있던 사람에게 말을 걸었으면: 그 짝의 반응 (data/events2.js cp_talk)
  if (couple && grp[0] && npcAge(p) >= 20 && S.age >= 20 && p.gender !== S.gender && EVENTS.cp_talk && eligible(EVENTS.cp_talk) && !S.pending.length) { setMateVars(p, grp[0]); fire(EVENTS.cp_talk); }
  after();
  return p.id;
}
/* ── 번호 묻기 (관계 쌓기) — 번호가 있어야 같은 곳에 없을 때도 연락(관계 창의 상호작용)할 수 있음 ──
   가족·연인·배우자·같이 사는 사람은 늘 / 이벤트로 알게 된 사람은 번호가 있음 / 장소에서 말을 건 사람·얼굴만 아는 사이는 물어봐야
   성공 확률: 친밀·신뢰·설렘 + 첫인상(이성) − 결혼·애인(이성) − 짝이 옆에 있음. 같은 성별·친구로는 쉽게. 하루에 한 번 */
const hasNumber = p => !!p && (p.phone !== false || ['family', 'child'].includes(p.kind) || !!p.spouse || !!p.partner || !!p.livesWith);
const mateWord = q => q.married ? (q.gender === 'm' ? '남편' : '아내') : (q.gender === 'm' ? '남자친구' : '여자친구');
function setMateVars(p, m) { S.vars.fp = p.id; S.vars.mateId = m ? m.id : null; S.vars.mateName = m ? pname(m) : ''; S.vars.mateWord = m ? mateWord(m) : ''; }
function numberOdds(p) {
  const pt = personality(p), opp = p.gender !== S.gender && npcAge(p) >= 19 && S.age >= 19;
  let o = .18 + p.close / 110 + p.trust / 220 + (p.heart || 0) / 90 + (pt.open || 0) + (trait().relMult ? .05 : 0);
  if (opp) o += allure(p, 'first') / 80 - (p.married ? .3 : p.taken ? .18 : 0) - (mateHere(p) ? .25 : 0);
  else o += .3;
  return clamp(o, .05, .95);
}
const NUM_PT = 2;   // 번호 묻기 (어른 행동력 2, 학교 다닐 땐 0)
function askNumber(pid) {
  const p = person(pid), h = p && hereEntry(pid);
  if (!p || !h || hasNumber(p) || busy() || p.askDay === (S.dayN || 0) || (phase() === 'adult' && S.ap < NUM_PT)) return;
  if (phase() === 'adult') spend(NUM_PT);
  p.askDay = S.dayN || 0;
  const m = mateHere(p) ? person(p.mateId) : null;
  // 짝이 옆에 있으면 끼어듦 (data/events2.js cp_number)
  //   그 사람도 마음이 있으면(설렘·첫인상·성격) 짝 몰래 번호를 주고받을 기회 (cp_secret_num), 아니면 짝이 끼어듦 (cp_number)
  if (m && p.gender !== S.gender && npcAge(p) >= 20 && S.age >= 20) {
    const willing = (p.heart || 0) >= 30 || allure(p, 'first') + (['bold', 'playful'].includes(p.personality) ? 15 : 0) + (p.married ? -5 : 0) >= 72 || Math.random() < .12;
    const ev = willing && EVENTS.cp_secret_num ? EVENTS.cp_secret_num : EVENTS.cp_number;
    if (ev && eligible(ev)) { setMateVars(p, m); fire(ev); after(); return; }
  }
  S.vars.fp = p.id;
  if (Math.random() < numberOdds(p)) {
    p.phone = true;
    const deltas = applyP(p, { close: [2, 4], trust: [1, 3] });
    log(fill(pick(['{fp|이} 내 휴대폰을 받아 번호를 찍어 줬다.', '"연락해요." {fp|이} 내 휴대폰에 자기 이름을 저장했다.', '{fp|이} 웃으며 번호를 불러 줬다. 바로 문자를 하나 보냈다.', '"제 것도 저장해 주세요." 번호를 주고받았다.'])) + ' 📱', { deltas });
  } else {
    const deltas = applyP(p, { close: [-2, -1] });
    const opp = p.gender !== S.gender && npcAge(p) >= 19;
    log(fill(opp && p.married ? '"저 결혼했어요." {fp|이} 왼손을 살짝 들어 보였다.' : opp && p.taken ? `"${p.gender === 'f' ? '남자친구' : '여자친구'}가 있어서요." {fp|이} 미안하다는 듯 웃었다.`
      : pick(['"아… 그건 좀." 어색한 웃음이 돌아왔다.', '{fp|이} "다음에요" 하며 말을 돌렸다.', '{fp|이} 휴대폰을 만지작거리다 "배터리가 없어서…"라고 했다.'])), { deltas: deltas.concat(applyEffect({ happy: -1 })) });
  }
  after();
}
// 장소에서 처음 보는 사람에게 말을 걸고 번호까지 (둘러보기·사람 목록)
function askStranger(key) { const id = talkTo(key); if (id && !S.pending.length) askNumber(id); return id; }
// 아는 사람의 연인·배우자: 있으면 그 사람, 없으면 만들어 둠 (얼굴만 아는 사이, 서로 mateId)
function mateOf(p, create) {
  let m = p.mateId && person(p.mateId);
  if (m && !m.gone) return m;
  if (!create || !(p.married || p.taken) || npcAge(p) < 19 || p.spouse || p.partner) return null;
  const age = Math.max(19, npcAge(p) + rand(-4, 4));
  m = enlist(makePerson({ kind: 'friend', gender: Math.random() < .94 ? (p.gender === 'm' ? 'f' : 'm') : p.gender, ageDiff: age - S.age, married: !!p.married, taken: true, close: rand(2, 6), trust: rand(2, 6), hangout: p.hangout, wealth: p.wealth }));
  m.acq = true; m.phone = false; m.org = 'mate'; m.mateId = p.id; p.mateId = m.id;
  if (p.married) m.marriedKnown = true;
  return m;
}
// 장소에 도착했는데 아는 사람이 연인·배우자와 같이 있으면 (밤을 보낸 사이·나를 좋아하는 사람·친한 친구) — data/events2.js cp_spot_*
function coupleSpot() {
  if (S.pending.length || S.age < 20 || !S.place) return;
  const cands = S.here.filter(h => !h.x).map(h => person(h.key)).filter(p => p && p.mateId && !p.spouse && !p.partner && npcAge(p) >= 20 && S.here.some(h => h.key === p.mateId));
  const pickEv = p => (p.nights || p.secret || p.fling || p.fwb) ? 'cp_spot_secret' : p.heart >= 35 && p.gender !== S.gender ? 'cp_spot_crush' : p.close >= 45 ? 'cp_spot_friend' : null;
  const p = pick(cands.filter(pickEv));
  if (!p || Math.random() > .7) return;
  const ev = EVENTS[pickEv(p)];
  if (!ev || !eligible(ev)) return;
  setMateVars(p, person(p.mateId));
  fire(ev);
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
  if (p.married && ringVisible(p)) return '💍❓';   // 반지는 처음 볼 때부터 보임 (기혼 추정)
  return '';
}
// 결혼 여부 (프로필): 친밀 40이면 확정, 20~39는 반지를 봤으면 추정
function marriageText(p) {
  if (p.kind === 'family' || p.kind === 'child' || npcAge(p) < 19) return undefined;
  const deep = Math.max(p.close, p.trust);
  if (p.married && p.marriedKnown) return '기혼';
  if (p.divorced && (p.divorcedKnown || deep >= 40)) return '이혼';
  if (!p.married && deep >= 40) return '미혼';
  if (p.married && ringVisible(p)) return '반지를 끼고 있다 (기혼 추정)';
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
  if (o.startsWith('staff:')) { const pl = PLACES[p.staffAt]; return !!pl && o === staffKey(pl, +o.split(':').pop()); }   // 지금 다니는 곳에서 일하는 사람
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
const clockHour = () => hourOf(S.used);
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
  if (KID_PLACE[id]) {   // 유치원·초등학교 앞: 등·하원 시간에 엄마들이 몰리고, 수업 중엔 조금, 밤·주말엔 거의 없음
    const el = id === 'elem', peak = el ? (h >= 8 && h < 9.5) || (h >= 13 && h < 16) : (h >= 8 && h < 10) || (h >= 15 && h < 18);
    m = d === 0 || d === 6 ? (h >= 10 && h < 18 ? .3 : 0) : peak ? 1.4 : h >= 9 && h < 18 ? .5 : h >= 18 && h < 20 ? .2 : 0;
  }
  return m;
}
const weatherMult = () => ({ rain: .6, storm: .6, snow: .4, sleet: .4 })[S.weather] || 1;
const groupRoll = pl => weighted(D.encounter.groupSize.filter(([n]) => n < 4 || pl.id === 'bar'), g => g[1])[0];
/* ═════════ 집·부동산 (data/housing.js) ═════════ */
// S.home = { id: 집 종류, dep: 낸 보증금(이사 나갈 때 돌려받음), n: 이사 횟수, since: 들어온 날 }
const housingOf = id => (D.housing || []).find(h => h.id === id) || (D.housing || [])[0] || { id: 'parents', label: '집', nb: { n: [6, 10], hh: { single: 1 } } };
function homeNow() {
  if (!S.home) S.home = { id: S.flags.married ? 'villa' : S.flags.ownPlace ? 'oneroom' : 'parents', dep: 0, n: 0, since: S.dayN || 0 };   // 예전 저장
  return housingOf(S.home.id);
}
// 같이 사는 식구 수 (나 + 배우자·같이 사는 연인 + 스무 살 안 된 아이) — 집 크기(cap)를 넘으면 그 집으로는 못 감
const HOUSE_CAP = { goshiwon: 1, oneroom: 2, officetel: 2, villa: 4, apt: 6, house: 8, parents: 9 };
const householdN = () => 1 + alive().filter(p => p.spouse || p.livesWith || (p.kind === 'child' && npcAge(p) < 20)).length;
// 독립·동거·결혼 이벤트로 집을 나가면 집 종류를 맞춤 (보증금은 그 이벤트에서 이미 씀 — dep 0)
function syncHome() {
  if (!D.housing || !S.date || S.age < 19) return;
  const h = homeNow();
  let want = null;
  if (S.flags.married && HOUSE_CAP[h.id] < 4) want = 'villa';
  else if (S.flags.ownPlace && h.id === 'parents') want = householdN() > 1 ? 'villa' : 'oneroom';
  if (want) { S.home = homeFrom(want, false); log(`${housingOf(want).icon} 새 집은 ${S.home.dong ? S.home.dong + ' ' : ''}${S.home.sub || housingOf(want).label}. 이웃도 새 얼굴들이다.`, { t: 'info' }); }
  syncSpot();
}
// 우리 집 앞 (지도의 이웃 장소): 집 종류마다 이름·아이콘·풍경
function syncSpot() {
  const pl = PLACES.block, sp = homeNow().spot;
  if (pl && sp) { pl.label = sp.label; pl.icon = sp.icon; }
}
/* ═════════ 부동산 매물 (data/realty.js) — 📱 폰 → 🏠 방구하기 ═════════
   매물은 주마다 새로 올라옴 (씨앗 = 인생·나라·주). 동네·세부 종류·면적·층·준공·역 거리·옵션·관리비, 월세(보증금/월세)·전세·매매
   값: ㎡당 시세 × 동네 × 신축·역세권·층(반지하·옥탑 싸게). 월세는 전세가에서 전월세 전환율로. 뉴욕은 렌트(보증금 한 달 치)·매매
   보러 가야 드러나는 하자·좋은 점, 허위매물(보러 가면 '방금 나갔어요', 안 보고 계약하면 계약금을 날림), 등기부(전세 근저당 — 깡통전세 위험)
   계약: 보증금(또는 매매가) − 대출 + 중개수수료 + 이사비(용달·포장이사) + 보증보험, 지금 집 보증금은 돌려받음. 2년(뉴욕 1년)마다 갱신(5% 인상)
   S.home = { id(집 종류 — 이웃 구성), dong, sub, area, floor, deal, dep, rent, mgmt, owned, price, loan, rate, insured, risk, flaws, commute, until, n, since } */
const RT = () => (D.realty || {})[REGION] || (D.realty || {}).kr;
const VISIT_PT = 8, REG_PT = 2;
const r100 = v => Math.max(0, Math.round(v / 100) * 100), r500 = v => Math.max(0, Math.round(v / 500) * 500);
const realtyState = () => { if (!S.realty) S.realty = { fav: [], seen: {}, reg: {}, gone: {} }; const R = S.realty; R.recent = R.recent || []; R.asked = R.asked || {}; R.reported = R.reported || {}; return R; };
// 매물 한 개 (opt.type: 그 종류로, opt.agent: 중개사 추천 — 허위매물 없음)
function makeListing(R, id, opt = {}) {
  const t = opt.type ? R.types.find(x => x.id === opt.type) || R.types[0] : weighted(R.types, x => x.w);
  const dong = weighted(R.dongs, d => (d.prefer || []).includes(t.id) ? 3 : 1);
  const sub = pick(t.subs), ar = sub.area || t.area, area = rand(ar[0], ar[1]);
  const fresh = !!sub.fresh || Math.random() < .15, age = fresh ? rand(0, 3) : rand(4, 38);
  const floors = rand(t.floors[0], t.floors[1]), floor = sub.basement ? 0 : sub.rooftop ? floors : rand(1, floors);
  // 지도 위 자리: 동네 둘레 (물 위면 다시) → 가까운 역(도보 분) · 근처 유치원·초등학교
  const dp = dongPos(dong.name);
  let pos = dp ? [dp[0], dp[1]] : null;
  if (dp) for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 34, x = Math.round(dp[0] + Math.cos(a) * r), y = Math.round(dp[1] + Math.sin(a) * r * .8); if (!inWater(x, y)) { pos = [x, y]; break; } }
  const ns = pos && nearestStation(pos), kn = pos ? kidsNear(pos) : null;
  const L = { id, type: t.id, sub: sub.n, dong: dong.name, zone: dong.zone, dongTag: dong.tag || '', area, floor, floors, basement: !!sub.basement, rooftop: !!sub.rooftop, duplex: !!sub.duplex, pos, kids: kn,
    age, built: (S.date ? S.date.y : 2026) - age, station: ns ? clamp(Math.round(ns.d / 4), 1, 25) : rand(2, 18), south: Math.random() < .4, elevator: !!t.elevator || floors >= 7, parking: !!t.parking || Math.random() < .25, pets: Math.random() < .35,
    win: sub.win !== false, deal: pickKey(t.deals), mgmt: rand(t.mgmt[0], t.mgmt[1]), agent: !!opt.agent };
  L.opts = shuffle(t.opts.slice()).slice(0, rand(2, Math.min(6, t.opts.length)));
  const k = dong.k * (age <= 3 ? 1.12 : age >= 25 ? .85 : 1) * (L.station <= 5 ? 1.07 : L.station >= 13 ? .92 : 1) * (L.basement ? .65 : L.rooftop ? .78 : floor === 1 ? .95 : 1) * (L.south ? 1.03 : 1)
    * (kn && ['apt', 'villa', 'house'].includes(t.id) ? 1 + Math.min(.12, kn.score * .03) + (kn.cho && t.id === 'apt' ? .04 : 0) : 1);   // 학교 가까운 집 (초품아) 은 더 비쌈
  const market = t.ppm ? rand(t.ppm[0], t.ppm[1]) * area * k : 0;   // 매매 시세
  L.market = Math.round(market);
  if (t.rentR) {   // 한 달 값이 기준 (고시원·뉴욕 렌트)
    const rent = Math.round(rand(t.rentR[0], t.rentR[1]) * (t.id === 'goshiwon' ? Math.sqrt(dong.k) : k));
    if (L.deal === '매매' && market) L.price = r500(market);
    else { L.deal = '월세'; L.rent = rent; L.dep = t.depMonths ? rent * t.depMonths : pick(t.deps || [0]); }
  } else if (L.deal === '매매') L.price = r500(market);
  else {
    const J = market * t.jr;
    if (L.deal === '전세') L.dep = r500(J);
    else { L.dep = Math.min(pick(t.deps), r100(J * .5)); L.rent = Math.max(t.minRent || 30, Math.round((J - L.dep) * t.conv / 12)); }
  }
  // 등기부: 선순위 근저당 (빌라가 많음) — 전세가율이 80%를 넘으면 깡통전세 위험
  if (L.deal === '전세' && REGION === 'kr') {
    L.lien = Math.random() < (t.id === 'villa' ? .4 : t.id === 'officetel' ? .25 : .12) ? r500(market * rand(15, 45) / 100) : 0;
    L.risk = market ? Math.round((L.dep + L.lien) / market * 100) / 100 : 0;
  }
  // 보러 가야 드러나는 것 (하자 · 좋은 점)
  L.hidden = R.flaws.filter(f => !f.when || f.when(L)).filter(f => Math.random() < (f.bad ? .32 : .22)).map(f => f.id).slice(0, 3);
  // 허위매물 (앱에만): 시세보다 싸게 올려 미끼로
  if (!opt.agent && !opt.type && Math.random() < R.fake) { L.fake = true; if (L.rent) { L.rent = Math.round(L.rent * .82); if (t.depMonths) L.dep = L.rent * t.depMonths; } if (L.dep && L.deal === '전세') L.dep = r500(L.dep * .85); if (L.price) L.price = r500(L.price * .85); }
  L.urgent = !!L.fake || Math.random() < .07;   // '급매' — 허위매물도 다 급매로 올라옴 (진짜 급매도 가끔)
  L.nofee = REGION !== 'kr' && Math.random() < .3;
  L.instant = Math.random() < .4;
  L.say = pick(R.agent);
  appInfo(L, R, t, dong);
  return L;
}
// 📱 앱 화면용 정보 (직방·다방·네이버 부동산 / StreetEasy·Zillow 참고): 매물 번호·제목·사진 수·확인매물·방·욕실·난방·방향·입주·용도
//   관리비 포함/별도 · 보안 · 주변 편의 시설(도보 분) · 역 이름 · 중개사무소 · 중개사가 적은 융자금(거짓일 수도) · 단지 정보 · 실거래가
//   뉴욕: 올라온 지 며칠 · 한 달 무료(넷 이펙티브) · 렌트 안정화 · 가격 변동 · 편의 시설(amenities)
function appInfo(L, R, t, dong) {
  const T = R.titles && R.titles[t.id], day = S.dayN || 0, kr = REGION === 'kr';
  const big = L.area >= 85, mid = L.area >= 50;
  L.no = String(2e9 + Math.floor(Math.random() * 7e8));
  L.photos = L.fake ? rand(3, 6) : rand(6, 15);
  L.verified = !L.fake && (L.agent || Math.random() < .55) ? day - rand(0, 6) : null;   // 확인매물 (중개사가 현장 확인한 날)
  L.rooms = { goshiwon: 1, oneroom: L.duplex ? 1 : 1, officetel: mid ? 2 : 1, villa: mid ? 3 : 2, apt: big ? 4 : L.area >= 59 ? 3 : 2, house: rand(3, 5) }[t.id] || 1;
  L.baths = t.id === 'goshiwon' ? (L.win ? 1 : 0) : big || t.id === 'house' ? 2 : 1;
  L.heat = pick((R.heat || {})[t.id] || ['개별난방']);
  L.dirT = L.south ? '남향' : pick(['동향', '서향', '남동향', '남서향', '북향']);
  L.moveIn = L.instant ? '즉시 입주' : `${((S.date ? S.date.m : 3) % 12) + 1}월 ${pick([1, 10, 15, 20, 25])}일 이후 (협의)`;
  L.use = (R.uses || {})[t.id] || '';
  L.entr = ['apt', 'officetel'].includes(t.id) ? pick(['계단식', '복도식']) : null;
  const mi = (R.mgmtInc || {})[t.id] || [[], []];
  L.mgmtIn = mi[0]; L.mgmtOut = mi[1];
  L.secu = shuffle((R.secu || []).slice()).slice(0, rand(2, 5));
  L.near = shuffle((R.near || []).slice()).slice(0, 5).map(n => [n, rand(1, 12)]).sort((a, b) => a[1] - b[1]);
  const ns = L.pos && D.map ? nearestStation(L.pos) : null;
  L.stName = ns ? (kr ? `${ns.name}역 (${ns.line})` : `${ns.line} · ${ns.name}`) : (R.stations || {})[dong.name] || '';
  const O = R.office || {};
  if (O.words) L.office = { name: kr ? `${dongShort(dong.name)} ${pick(O.words)}${O.suffix}` : `${pick(O.words)}${O.suffix}`, boss: `${pick(O.surnames)}${kr ? '○○' : ''}`, deals: rand(2, 46), tel: `${O.tel}-${rand(200, 999)}-${rand(1000, 9999)}`, years: rand(2, 25) };
  // 중개사가 적은 융자금: 근저당이 있어도 '없음'이라 적기도 함 → 등기부로 확인
  if (kr && (L.deal === '전세' || L.deal === '매매')) L.claim = !L.lien ? '없음' : Math.random() < .45 ? '없음' : L.lien < (L.market || 1) * .3 ? '시세 대비 30% 미만' : '있음 (협의)';
  // 단지 (아파트·오피스텔) + 실거래가 (최근 거래 4건)
  if (['apt', 'officetel'].includes(t.id) && R.cx) {
    const nm = pick(R.cx.names);
    L.cx = { name: kr ? `${dongShort(dong.name)} ${nm}${t.id === 'apt' ? R.cx.suffix : ' 오피스텔'}` : nm, units: t.id === 'apt' ? (kr ? rand(3, 30) * 100 + rand(0, 99) : rand(40, 400)) : rand(120, 600), dongs: t.id === 'apt' && kr ? rand(4, 28) : 1,
      top: L.floors, built: L.built, park: (rand(t.id === 'apt' ? 9 : 4, t.id === 'apt' ? 16 : 9) / 10).toFixed(1), builder: pick(R.cx.builders) };
  }
  if (['apt', 'officetel', 'villa'].includes(t.id) && L.market) {
    const base = L.deal === '매매' ? L.market : L.deal === '전세' ? L.market * t.jr : null;
    let ag = rand(0, 1);
    if (base) L.trades = Array.from({ length: 4 }, (_, i) => ({ ago: i ? (ag += rand(1, 3)) : ag, f: rand(2, L.floors), v: r500(base * (1 - i * .012 + (Math.random() - .5) * .08)) }));
  }
  const py = kr ? ((/(\d+)평형/.exec(L.sub) || [])[1] ? `${/(\d+)평형/.exec(L.sub)[1]}평` : `${Math.round(L.area / 3.3058)}평`) : '';
  // 매물 제목: 집과 안 맞는 말은 빼고 (신축·역세권·남향·풀옵션·주차·복층·세탁기 …)
  const fits = x => !(/신축/.test(x) && L.age > 5) && !(/역세권|역 \{st\}분|\{st\}분 거리/.test(x) && L.station > 7) && !(/남향|햇살|채광/.test(x) && !L.south) && !(/풀옵션/.test(x) && (L.opts || []).length < 5)
    && !(/주차/.test(x) && !L.parking) && !(/복층/.test(x) && !L.duplex) && !(/창문 있는/.test(x) && !L.win) && !(/세탁기/.test(x) && !(L.opts || []).some(o => o.includes('세탁'))) && !(/뷰|스카이라인/.test(x) && (L.floor || 0) < 8);
  const Tf = T && T.filter(fits);
  L.title = T ? pick(Tf && Tf.length ? Tf : T).replace('{dong}', dong.name).replace('{st}', L.station).replace('{cx}', L.cx ? L.cx.name.replace(/ ?아파트$/, '') : dong.name).replace('{py}', py) : L.sub;
  if (!kr) {
    L.dom = L.fake ? rand(1, 4) : rand(1, 45);   // 올라온 지 며칠 (Days on market)
    L.free = L.deal === '월세' && !L.fake && Math.random() < .22 ? 1 : 0;   // 한 달 무료 → 넷 이펙티브
    L.stab = L.deal === '월세' && ['oneroom', 'villa'].includes(t.id) && Math.random() < .15;   // 렌트 안정화
    if (L.deal === '월세' && L.dom > 14 && Math.random() < .5) L.hist = [{ ago: L.dom, t: '등록', v: Math.round(L.rent * 1.05) }, { ago: rand(1, L.dom - 1), t: '가격 인하', v: L.rent }];
    else L.hist = [{ ago: L.dom, t: '등록', v: L.deal === '매매' ? L.price : L.rent }];
    L.amen = shuffle((R.amen || []).filter(a => (a !== '도어맨' || ['officetel', 'apt'].includes(t.id)) && (a !== '엘리베이터' || L.elevator))).slice(0, rand(2, 6));
    L.baths = big ? 2 : 1;
    const bd = /(\d)베드/.exec(L.sub); L.rooms = bd ? +bd[1] : /스튜디오|방$|셰어/.test(L.sub) ? 0 : L.rooms;   // 침실 수는 이름대로 (스튜디오 0)
  }
}
let LCACHE = null;
function listings() {
  const R = RT();
  if (!R || !S.date) return [];
  const wk = Math.floor((S.dayN || 0) / 7), key = `${S.id}:${REGION}:${wk}:${S.realty && S.realty.agentDay === S.dayN ? 'a' : ''}`;
  if (LCACHE && LCACHE.key === key) return LCACHE.list;
  const list = withSeed(`realty:${S.id}:${REGION}:${wk}`, () => Array.from({ length: 16 }, (_, i) => makeListing(R, `w${wk}-${i}`)));
  // 부동산 사무실에 가면 그날 중개사 추천 매물 3개 (현장 확인 — 허위매물 없음)
  if (S.realty && S.realty.agentDay === S.dayN) list.unshift(...withSeed(`agent:${S.id}:${S.dayN}`, () => Array.from({ length: 3 }, (_, i) => makeListing(R, `a${S.dayN}-${i}`, { agent: true }))));
  LCACHE = { key, list };
  return list;
}
const listingById = id => listings().find(l => l.id === id) || realtyState().fav.find(l => l.id === id) || realtyState().recent.find(l => l.id === id) || null;
// 화면용: 값·면적·층·통근
const eok = v => v >= 10000 ? `${Math.floor(v / 10000)}억${v % 10000 ? ' ' + (v % 10000).toLocaleString('en-US') : ''}` : v.toLocaleString('en-US');
function priceLine(L) {
  if (REGION === 'kr') return L.deal === '월세' ? `월세 ${L.dep >= 10000 ? eok(L.dep).replace(' ', '') : L.dep.toLocaleString('en-US')}/${L.rent}` : L.deal === '전세' ? `전세 ${eok(L.dep)}` : `매매 ${eok(L.price)}`;
  return L.deal === '월세' ? `렌트 ${fmtMoney(L.rent)}/월` : `매매 ${fmtMoney(L.price)}`;
}
const areaText = L => REGION === 'kr' ? `전용 ${L.area}㎡ (${Math.round(L.area / 3.3058)}평)` : `${Math.round(L.area * 10.764).toLocaleString('en-US')} sqft (${L.area}㎡)`;
const floorText = L => L.basement ? (REGION === 'kr' ? '반지하' : '가든 레벨') : L.rooftop ? (REGION === 'kr' ? '옥탑' : `${L.floor}층 (꼭대기)`) : `${L.floor}층 / ${L.floors}층`;
// 통근: 직장(또는 대학)까지 — 편도 분 · 출근·수업에 더해지는 행동력(왕복)
// 통근: 아침 8시 기준 가장 나은 방법 (택시 빼고). pt = 출근·수업에 더해지는 행동력(왕복)
function commuteOf(L) {
  const to = S.job ? 'office' : S.flags.student ? 'campus' : null;
  if (!to) return null;
  const a = L.pos || dongPos(L.dong) || zonePos(L.zone) || homePos(), b = mapPos(to) || [360, 460];
  const r = pickRoute(routeOptions(a, b, to, { h: 8 }).filter(o => o.mode !== 'taxi'), S.ride && S.ride !== 'taxi' ? S.ride : 'auto');
  return { to: to === 'office' ? '직장' : '학교', min: Math.round(6 + r.ap * 11), pt: clamp(r.ap - 1, 0, 4) * 2, mode: r.mode, ic: RIDE_IC[r.mode], label: RIDE_LB[r.mode], via: r.from && r.to ? `${r.from}역 → ${r.to}역` : '', money: r.money };
}
const seenOf = id => realtyState().seen[id];
// 괄호 뒤 조사: '아파트 59㎡ (25평형)' + 을 → 괄호 앞 낱말 기준
const subJ = (t, j) => { const base = String(t).replace(/\s*\([^)]*\)\s*$/, ''); return t + josa(base, j).slice(base.length); };
// 지금 집의 통근 행동력 (직장·학교가 바뀌어도 그때그때) — 본가·예전 저장(동네 모름)은 0
const homeCommute = () => { if (!S.home || !D.map) return 0; const c = commuteOf({ pos: homePos() }); return c ? c.pt : 0; };
function listingView(L) {
  const R = RT(), RS = realtyState(), seen = RS.seen[L.id], reg = RS.reg[L.id];
  const flawT = id => (R.flaws.find(f => f.id === id) || {});
  return Object.assign({}, L, { priceN: L.price || 0, depN: L.dep || 0, price: priceLine(L), areaT: areaText(L), floorT: floorText(L), commute: commuteOf(L), fav: RS.fav.some(x => x.id === L.id), gone: !!RS.gone[L.id],
    seen: !!seen || L.agent, notes: (seen || L.agent) ? L.hidden.map(id => ({ t: flawT(id).t, bad: !!flawT(id).bad })) : null,
    reg: reg ? { lien: L.lien || 0, risk: L.risk || 0 } : null, canReg: REGION === 'kr' && (L.deal === '전세' || L.deal === '매매'),
    asked: RS.asked[L.id] || null, reported: !!RS.reported[L.id], wasFake: !!RS.gone[L.id] && !!L.fake, verifiedT: L.verified != null ? ago(L.verified) : null,
    fake: undefined, hidden: undefined, market: undefined, lien: undefined, risk: undefined });
}
function realtyList() { return listings().map(listingView); }
// 며칠 전 (확인매물 날짜 · 올라온 날)
const ago = d => { const n = (S.dayN || 0) - d; return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전`; };
// 최근 본 방 (앱의 '최근 본') — 매물은 주마다 바뀌어도 기록은 남음
function viewListing(id) {
  const RS = realtyState(), L = listingById(id);
  if (!L) return;
  RS.recent = [JSON.parse(JSON.stringify(L))].concat(RS.recent.filter(x => x.id !== id)).slice(0, 15);
}
// 📞 중개사에게 문의 (⚡1): 진짜 매물이면 "아직 있어요", 허위매물이면 대개 "방금 나갔어요"(들킴) — 가끔 "오시면 설명드릴게요"
function askListing(id) {
  const L = listingById(id), RS = realtyState();
  if (!L || RS.asked[id] || RS.gone[id] || realtyWhy() || busy() || S.ap < 1) return;
  spend(1);
  let a;
  if (L.fake && Math.random() < .7) { RS.gone[id] = true; a = pick(['"아, 그 방은 방금 나갔어요. 대신 비슷한 거 있는데 보러 오실래요?"', '"그건 계약됐고요, 조금 더 주시면 더 좋은 방 있어요."']); }
  else if (L.fake) a = '"전화로는 좀 그렇고, 사무실로 오시면 자세히 설명드릴게요."';
  else a = pick(L.instant ? ['"네, 아직 있어요. 오늘도 보실 수 있어요."', '"비어 있는 방이라 바로 보실 수 있어요."'] : ['"네, 있어요. 세입자분 계셔서 시간 맞춰 보셔야 해요."', '"아직 있어요. 주말에 보러 오세요."']) +
    (L.mgmtOut && L.mgmtOut.length ? ` 관리비 말고 ${josa(L.mgmtOut.join('·'), '은')} 따로 나와요.` : '');
  RS.asked[id] = a;
  log(`📞 ${L.office ? L.office.name : '중개사'}에 전화했다. ${a}`, { t: 'info' });
  after();
}
// 🚨 허위매물 신고 (들킨 허위매물만)
function reportListing(id) {
  const L = listingById(id), RS = realtyState();
  if (!L || !L.fake || !RS.gone[id] || RS.reported[id]) return;
  RS.reported[id] = true;
  log('🚨 허위매물로 신고했다. 며칠 뒤 그 광고가 내려갔다는 알림이 왔다.', { t: 'info', deltas: applyEffect({ happy: 1 }) });
  addKarma(1);
  after();
}
const realtyWhy = () => phase() !== 'adult' ? '스무 살이 되면' : jailed() ? '수감 중' : '';
// 보러 가기·등기부·계약을 지금 못 하는 까닭 (평일 출근·수업 전, 이벤트 중)
const realtyActWhy = () => { if (dutyPending()) { const d = dutyOf(); return `평일 — 먼저 ${d.id === 'work' ? '출근' : d.id === 'class' ? '수업' : '훈련'}부터`; } return busy() ? '지금은 못 함' : ''; };
function favListing(id) {
  const RS = realtyState(), L = listingById(id);
  if (!L) return;
  const i = RS.fav.findIndex(x => x.id === id);
  if (i >= 0) RS.fav.splice(i, 1); else RS.fav.unshift(JSON.parse(JSON.stringify(L)));
  RS.fav = RS.fav.slice(0, 12);
  save(); emit();
}
// 집 보러 가기 (행동력 8): 하자·좋은 점이 드러남. 허위매물이면 '방금 나갔어요'
function visitListing(id) {
  const L = listingById(id), RS = realtyState();
  if (!L || RS.gone[id] || RS.seen[id] || realtyWhy() || busy() || dutyPending() || S.ap < VISIT_PT) return;
  spend(VISIT_PT);
  if (L.fake) {
    RS.gone[id] = true;
    log(pick(['현장에 가 보니 중개사가 말했다. "아, 그 방은 방금 나갔어요. 대신 이 방은 어때요?" 보여 준 방은 훨씬 비쌌다.', '사진 속 방은 없었다. "그건 광고용이고요…" 허위매물이었다.']), { t: 'info', deltas: applyEffect({ happy: -2 }) });
  } else {
    RS.seen[id] = { day: S.dayN || 0 };
    const R = RT(), bad = L.hidden.map(f => R.flaws.find(x => x.id === f)).filter(f => f && f.bad), good = L.hidden.map(f => R.flaws.find(x => x.id === f)).filter(f => f && f.good);
    log(`🏠 ${subJ(`${L.dong} ${L.sub}`, '을')} 보고 왔다.${bad.length ? ' ' + bad.map(f => f.t.split(' — ')[0]).join(', ') + '.' : ''}${good.length ? ' ' + good.map(f => f.t).join(', ') + '.' : ''}${!bad.length && !good.length ? ' 사진 그대로였다.' : ''}`, { t: 'info' });
  }
  after();
}
// 등기부등본 떼 보기 (서울 전세·매매, 행동력 2): 선순위 근저당 · 전세가율
function checkRegistry(id) {
  const L = listingById(id), RS = realtyState();
  if (!L || REGION !== 'kr' || RS.reg[id] || busy() || S.ap < REG_PT || phase() !== 'adult') return;
  spend(REG_PT);
  RS.reg[id] = true;
  const danger = (L.risk || 0) >= .8;
  log(L.lien ? `📄 등기부를 떼 보니 근저당이 ${eok(L.lien)} 잡혀 있었다.${danger ? ' 보증금까지 더하면 집값의 ' + Math.round(L.risk * 100) + '%. 깡통전세가 될 수 있다.' : ''}` : '📄 등기부는 깨끗했다.', { t: 'info' });
  after();
}
// 계약 견적: 지금 내야 할 돈 · 한 달 고정비 · 행동력 · 안 되는 까닭
function quote(id, o = {}) {
  const R = RT(), L = listingById(id);
  if (!L) return null;
  const mv = R.move[o.move === 'full' ? 'full' : 'truck'], lo = R.loan[L.deal];
  const pay = L.deal === '매매' ? L.price : L.dep || 0;
  const loan = o.loan && lo && (S.job || L.deal === '매매' && S.money >= pay * (1 - lo.ltv)) ? r100(pay * lo.ltv) : 0;
  const fee = REGION === 'kr' ? Math.round((L.deal === '월세' ? (L.dep + L.rent * 100) : pay) * (R.fee[L.deal] || 0))
    : L.deal === '월세' ? (L.nofee ? 0 : Math.round(L.rent * R.fee.월세)) : Math.round(pay * R.fee.매매);
  const moveCost = Math.round(mv.cost[0] + (mv.cost[1] - mv.cost[0]) * clamp(L.area / 100, 0, 1));
  const insure = o.insure && L.deal === '전세' && R.insure ? Math.max(1, Math.round(pay * R.insure)) : 0;
  const H = S.home || {}, refund = (H.dep || 0) + (H.owned ? H.price || 0 : 0) - (H.loan || 0);
  const now = pay - loan + fee + moveCost + insure;
  const monthly = (L.rent || 0) + (L.mgmt || 0) + Math.round(loan * (lo ? lo.rate : 0) / 12);
  const cm = commuteOf(L);
  let why = realtyWhy();
  if (!why && RS_gone(id)) why = '이미 나간 매물';
  if (!why && S.age < (R.minAge || 19)) why = `${R.minAge}살부터`;
  if (!why && householdN() > (HOUSE_CAP[L.type] || 9)) why = '식구가 살기엔 좁다';
  if (!why && o.loan && lo && !loan) why = L.deal === '매매' ? '계약금(집값의 일부)이 모자라 대출이 안 나온다' : '대출은 직장이 있어야';
  if (!why && S.money + refund < now) why = `돈이 ${fmtMoney(now - S.money - refund)} 모자람`;
  if (!why) why = realtyActWhy();
  if (!why && S.ap < mv.pt) why = `행동력 ⚡${mv.pt} 필요`;
  return { id, pay, loan, loanLabel: lo ? lo.label : '', loanRate: lo ? lo.rate : 0, canLoan: !!lo, fee, moveCost, movePt: mv.pt, moveLabel: mv.label, insure, canInsure: L.deal === '전세' && !!R.insure, refund, now, after: S.money + refund - now,
    monthly, rent: L.rent || 0, mgmt: L.mgmt || 0, interest: Math.round(loan * (lo ? lo.rate : 0) / 12), commute: cm, why, ok: !why, visited: !!realtyState().seen[id] || L.agent };
}
const RS_gone = id => !!realtyState().gone[id];
// 계약하고 이사 — 안 보고 계약한 허위매물이면 계약금만 날림
function signContract(id, o = {}) {
  const R = RT(), L = listingById(id), q = quote(id, o), RS = realtyState();
  if (!L || !q || !q.ok) return;
  if (L.fake && !RS.seen[id]) {
    const lost = Math.max(30, Math.round((L.deal === '월세' ? L.rent : (L.dep || L.price || 0) * .1)));
    S.money -= lost; RS.gone[id] = true;
    log(`📵 계약금 ${fmtMoney(lost)}를 보냈는데 중개사와 연락이 끊겼다. 허위매물이었다.`, { memory: true, deltas: applyEffect({ happy: -8 }) });
    after();
    return;
  }
  spend(q.movePt);
  S.money += q.refund - q.now;
  const lo = R.loan[L.deal];
  S.home = { id: L.type, n: ((S.home && S.home.n) || 0) + 1, since: S.dayN || 0, dong: L.dong, sub: L.sub, area: L.area, floor: floorText(L), deal: L.deal,
    dep: L.deal === '매매' ? 0 : L.dep || 0, rent: L.rent || 0, mgmt: L.mgmt || 0, owned: L.deal === '매매', price: L.deal === '매매' ? L.price : 0, loan: q.loan, rate: q.loan && lo ? lo.rate : 0,
    insured: !!q.insure, risk: L.risk || 0, flaws: L.hidden.slice(), zone: L.zone, until: L.deal === '매매' ? null : (S.dayN || 0) + R.contract, station: L.station, pos: L.pos, kids: L.kids ? L.kids.score : 0 };
  S.flags.ownPlace = true;
  RS.gone[id] = true;
  const surprise = !RS.seen[id] && !L.agent ? L.hidden.map(f => R.flaws.find(x => x.id === f)).filter(f => f && f.bad) : [];
  log(`🏠 ${L.deal === '매매' ? subJ(`${L.dong} ${L.sub}`, '을') + ' 샀다' : subJ(`${L.dong} ${L.sub}`, '으로') + ' 이사했다'}. ${pick(['상자를 다 풀고 나니 밤이었다.', '낯선 천장을 한참 올려다봤다.', '현관 비밀번호를 세 번 틀렸다.', '새 동네 냄새가 났다.'])}${surprise.length ? ` 살아 보니 ${surprise.map(f => f.t.split(' — ')[0]).join(', ')}…` : ''}`, { memory: true, deltas: applyEffect({ happy: surprise.length ? 1 : 4 }) });
  syncSpot();
  ensurePools();
  after();
}
// 본가로 들어가기 (결혼·동거·아이가 없을 때, 부모님이 계시면) — 보증금은 돌려받고, 산 집은 팖
function toParents() {
  if (realtyWhy() || busy() || S.home.id === 'parents' || S.flags.married || householdN() > 1 || !alive().some(p => p.kind === 'family' && !p.sibling)) return;
  const H = S.home;
  S.money += (H.dep || 0) + (H.owned ? H.price || 0 : 0) - (H.loan || 0);
  S.home = { id: 'parents', dep: 0, n: (H.n || 0) + 1, since: S.dayN || 0, rent: 0, mgmt: 0 };
  S.flags.ownPlace = false;
  log('🏡 짐을 싸서 본가로 들어갔다. 엄마가 말없이 내 방 이불을 갈아 두셨다.', { memory: true });
  syncSpot(); ensurePools(); after();
}
// 지금 집 (📱 내 집 탭)
function homeInfo() {
  const h = homeNow(), H = S.home || {}, R = RT();
  return { type: h.id, label: H.sub || h.label, icon: h.icon, dong: H.dong || '', deal: H.deal || (h.id === 'parents' ? '' : '월세'), dep: H.dep || 0, rent: H.rent ?? h.rent ?? 0, mgmt: H.mgmt || 0,
    owned: !!H.owned, price: H.price || 0, loan: H.loan || 0, interest: Math.round((H.loan || 0) * (H.rate || 0) / 12), insured: !!H.insured, area: H.area || 0, floor: H.floor || '',
    flaws: (H.flaws || []).map(id => (R.flaws.find(f => f.id === id) || {})).filter(f => f.t).map(f => ({ t: f.t, bad: !!f.bad })), commute: homeCommute(), daysLeft: H.until ? H.until - (S.dayN || 0) : null,
    since: H.since || 0, hh: h.nb ? hhNear(h.nb.hh, homeKids()) : {}, kids: D.map ? kidsNear(homePos()) : null, dongName: homeDong(), station: D.map ? (s2 => s2 ? { name: s2.name, line: s2.line, min: Math.max(1, Math.round(s2.d / 4)) } : null)(nearestStation(homePos())) : null, canParents: h.id !== 'parents' && !S.flags.married && householdN() === 1 && alive().some(p => p.kind === 'family' && !p.sibling) && !realtyWhy() };
}
// 한 달 돈 흐름 (📱 은행)
function budget() {
  const out = [], H = S.home || {};
  if (S.job && !jailed()) { const j = job(S.job); out.push([j.volatile ? '💼 수입 (들쭉날쭉, 평균)' : '💼 월급', Math.round(S.salary / 12)]); }
  if (S.age >= 20 && !S.flags.student && !S.flags.inArmy && !jailed()) { const kids = alive().filter(p => p.kind === 'child').length; out.push(['🛒 생활비', -Math.round((C.livingCost + (S.flags.married ? 600 : 0) + kids * 400) / 12)]); }
  if (S.age >= 19 && !S.flags.inArmy && !jailed()) {
    const rent = H.rent ?? homeNow().rent ?? 0;
    if (rent) out.push([REGION === 'kr' ? '🏠 월세' : '🏠 렌트', -rent]);
    if (H.mgmt) out.push(['🧾 관리비', -H.mgmt]);
    if (H.loan) out.push([`🏦 대출 이자 (연 ${((H.rate || 0) * 100).toFixed(1)}%)`, -Math.round(H.loan * (H.rate || 0) / 12)]);
  }
  if (S.flags.onPill) out.push(['💊 피임약', -4]);
  if (S.car) out.push(['🚗 차 유지비 (보험·세금·주차)', -(rideCfg().carMonth || 15)]);
  if (S.age >= 19 && S.food && (S.food.last || S.food.spent)) out.push([S.food.last ? '🍚 식비 (지난달)' : '🍚 식비 (이번 달 지금까지)', -Math.round((S.food.last || S.food.spent) * 10) / 10]);
  return { lines: out, net: out.reduce((t, l) => t + l[1], 0), money: S.money, dep: H.dep || 0, loan: H.loan || 0, owned: H.owned ? H.price || 0 : 0 };
}
// 기본 집 채우기 (독립·동거·결혼 이벤트, 20세 시작) — 그 종류의 매물 하나로. dep: 이미 낸 보증금으로 칠지
function homeFrom(type, dep) {
  const R = RT();
  if (!R || !R.types.some(t => t.id === type)) return { id: type, dep: 0, n: (S.home && S.home.n || 0) + 1, since: S.dayN || 0 };
  const L = withSeed(`home:${S.id}:${type}:${S.dayN || 0}`, () => { let x; for (let i = 0; i < 6; i++) { x = makeListing(R, 'h', { type, agent: true }); if (x.deal !== '매매') break; } if (x.deal === '매매') { x.deal = '월세'; x.dep = 0; x.rent = Math.round(x.market * .004); } return x; });
  return { id: type, n: (S.home && S.home.n || 0) + 1, since: S.dayN || 0, dong: L.dong, sub: L.sub, area: L.area, floor: floorText(L), deal: L.deal, dep: dep ? L.dep || 0 : 0, rent: L.rent || 0, mgmt: L.mgmt || 0,
    owned: false, price: 0, loan: 0, rate: 0, insured: false, risk: 0, flaws: L.hidden.slice(), zone: L.zone, until: (S.dayN || 0) + R.contract, station: L.station, pos: L.pos, kids: L.kids ? L.kids.score : 0 };
}
// 한 달마다: 집 하자·좋은 점이 생활에 · 계약 갱신(5% 인상) · 깡통전세 사고
function homeMonthly() {
  const H = S.home, R = RT();
  if (!H || H.id === 'parents' || !R) return;
  const winter = [12, 1, 2].includes(S.date.m);
  for (const id of H.flaws || []) {
    const f = R.flaws.find(x => x.id === id);
    if (!f || (f.winter && !winter) || Math.random() > .5) continue;
    const eff = {}; if (f.health) eff.health = f.health; if (f.happy) eff.happy = f.happy;
    if (Object.keys(eff).length) applyEffect(eff);
  }
  if (H.until && (S.dayN || 0) >= H.until && !H.owned) {
    H.until += R.contract;
    if (H.deal === '전세') { const add = r100(H.dep * .05); S.money -= add; H.dep += add; log(`📄 전세 계약을 연장했다. 보증금이 ${fmtMoney(add)} 올랐다.`, { t: 'info' }); }
    else { H.rent = Math.round(H.rent * 1.05); log(`📄 ${REGION === 'kr' ? '월세' : '렌트'} 계약을 연장했다. ${fmtMoney(H.rent)}로 5% 올랐다.`, { t: 'info' }); }
  }
  if (H.deal === '전세' && (H.risk || 0) >= .8 && !H.insured && !S.pending.length && Math.random() < .02 && EVENTS.jeonseFraud) fire(EVENTS.jeonseFraud);
}
// 깡통전세 사고: 보증금의 일부(frac)만 건지고 고시원·본가로
function loseHome(frac) {
  const H = S.home;
  if (!H) return;
  S.money += Math.round((H.dep || 0) * (frac || 0)) - (H.loan || 0);
  const back = !S.flags.married && householdN() === 1 && alive().some(p => p.kind === 'family' && !p.sibling);
  S.home = back ? { id: 'parents', dep: 0, n: (H.n || 0) + 1, since: S.dayN || 0, rent: 0, mgmt: 0 } : homeFrom(householdN() > 1 ? 'villa' : 'goshiwon', false);
  S.flags.ownPlace = !back;
  syncSpot(); ensurePools();
}
// 이웃 가구 만들기: 비중(nb.hh)대로 가구를 골라 사람 수(nb.n)가 찰 때까지. 부부·커플은 서로 짝(mateId), 가족은 아이까지
//   같은 집 사람끼리는 hh(가구 번호)·unit(호수)·hhRole(남편·아내·아이·혼자 산다 …)이 같음. 부부·커플은 서로 mateId. 부부인 건 처음부터 앎 (같이 사는 걸 봄)
function unitName(h, i, used) {
  for (let k = 0; k < 30; k++) {
    const u = h.id === 'apt' ? `${101 + (i % 3)}동 ${rand(3, 15)}0${rand(1, 4)}호` : h.id === 'officetel' ? `${rand(5, 22)}층 ${rand(1, 9)}호`
      : h.id === 'goshiwon' ? `${rand(2, 3)}${String(rand(1, 24)).padStart(2, '0')}호` : h.id === 'oneroom' || h.id === 'villa' ? `${rand(1, 5)}0${rand(1, 4)}호`
      : ['옆집', '앞집', '윗집', '아랫집', '골목 끝 집', '맞은편 집', '모퉁이 집', '대문 파란 집', '담장 낮은 집', '감나무 집'][(i + k) % 10];
    if (!used.has(u)) { used.add(u); return u; }
  }
  return `${i + 1}번째 집`;
}
// 유치원·초등학교 가까운 집: 아이 있는 가족·부부가 많이 삶 (k = 근처 아이 시설 점수, 최대 3)
function hhNear(hh, k) {
  k = Math.min(3, k || 0);
  if (!k || !hh) return hh;
  const out = Object.assign({}, hh);
  for (const key of Object.keys(out)) out[key] *= key === 'family' ? 1 + .4 * k : key === 'married' ? 1 + .2 * k : key === 'elder' ? 1 : Math.max(.35, 1 - .15 * k);
  if (!out.family && !out.student) out.family = 3 * k;   // 오피스텔·원룸도 학교 옆이면 아이 키우는 집이 조금
  return out;
}
const homeKids = () => { const H = S.home || {}; return H.id !== 'parents' && H.kids != null ? H.kids : (D.map ? kidsNear(homePos()).score : 0); };
function neighborsFor(h, org) {
  const NB0 = h.nb || { n: [6, 10], hh: { single: 1 } }, NB = Object.assign({}, NB0, { hh: hhNear(NB0.hh, homeKids()) }), total = rand(NB.n[0], NB.n[1]), spots = ['block', ...D.encounter.neighborSpots];
  let made = 0, hhN = 0;
  const used = new Set();
  while (made < total && hhN < 24) {
    const unit = unitName(h, hhN, used), hh = `${org}:${++hhN}`;
    const mk = (spec, role) => {
      const age = S.age + spec.ageDiff, sp = spots.filter(id => PLACES[id] && ageFits(PLACES[id], age));
      const p = poolPerson(Object.assign({ kind: 'neighbor', hangout: sp.length ? (Math.random() < .55 ? 'block' : pick(sp)) : null }, spec), org);
      p.hh = hh; p.unit = unit; p.hhRole = role;
      made++;
      return p;
    };
    const A = (lo, hi) => rand(Math.max(0, lo), Math.max(0, hi)) - S.age, g = () => Math.random() < .5 ? 'm' : 'f', og = x => x === 'm' ? 'f' : 'm';
    const pair = (p, q, wed) => { p.mateId = q.id; q.mateId = p.id; if (wed) p.marriedKnown = q.marriedKnown = true; };
    const kind = pickKey(NB.hh);
    if (kind === 'single' || kind === 'student') {
      const r = kind === 'student' ? [19, 27] : NB.single || [22, 78];
      mk({ gender: g(), married: false, ageDiff: A(r[0], r[1]) }, kind === 'student' ? '학생' : '혼자 산다');
    } else if (kind === 'roommates') {
      const x = g(), a = rand(21, 31);
      mk({ gender: x, married: false, ageDiff: A(a, a) }, '룸메이트'); mk({ gender: x, married: false, ageDiff: A(a - 2, a + 2) }, '룸메이트');
    } else if (kind === 'couple') {
      const x = g(), a = rand(22, 37);
      const p = mk({ gender: x, married: false, taken: true, ageDiff: A(a, a) }, '동거 중'), q = mk({ gender: og(x), married: false, taken: true, ageDiff: A(a - 3, a + 3) }, '동거 중');
      pair(p, q, false);
    } else if (kind === 'married' || kind === 'family' || kind === 'elder') {
      const a = kind === 'elder' ? rand(62, 84) : kind === 'family' ? rand(31, 50) : NB.married ? rand(NB.married[0], NB.married[1]) : rand(26, 58);
      if (kind === 'elder' && Math.random() < .4) { mk({ gender: Math.random() < .7 ? 'f' : 'm', married: false, taken: false, ageDiff: A(a, a) }, '혼자 사시는 어르신'); continue; }
      const x = g(), p = mk({ gender: x, married: true, ageDiff: A(a, a) }, x === 'm' ? '남편' : '아내'), q = mk({ gender: og(x), married: true, ageDiff: A(a - 4, a + 3) }, x === 'm' ? '아내' : '남편');
      pair(p, q, true);
      if (kind === 'family') for (let k = rand(1, 2); k > 0; k--) { const c = mk({ gender: g(), married: false, taken: false, ageDiff: A(Math.max(0, a - 44), Math.min(17, a - 25)) }, '아이'); c.parents = [p.id, q.id]; }
    }
  }
}
// 사람 풀 — 얼굴만 아는 사이로 들어옴 (말을 걸거나 무슨 일이 생기면 관계로)
function poolPerson(spec, org, tag) {
  const p = addPerson(Object.assign({ close: rand(2, 10), trust: rand(2, 10) }, spec));
  p.org = org; p.acq = true; p.phone = false;   // 얼굴만 아는 사이 — 번호는 마주쳤을 때 물어봐야
  if (tag) p.rtag = tag;
  return p;
}
const ageSpec = (lo, hi) => ({ ageDiff: rand(lo, hi) - S.age });
function ensurePools() {
  if (!S || !S.date || !D.encounter) return;
  const E = D.encounter, P = E.pools, V = S.vars, ph = phase();
  const n = range => rand(range[0], range[1]);
  // 이웃 (시작할 때, 이사하면 새 동네) — 사는 집의 종류에 따라 가구 구성이 다름 (data/housing.js nb)
  const hm = homeNow(), home = `${hm.id}:${S.home.n || 0}`;
  if (V.nbHome !== home) {
    V.nbHome = home; V.orgN = (V.orgN || 0) + 1; V.nbOrg = 'nb' + V.orgN;
    neighborsFor(hm, V.nbOrg);
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
  // 대학 동아리 사람들 (대학마다) — 동아리방에 나옴
  if (S.flags.student && V.univOrg && V.clubOrg !== V.univOrg) {
    V.clubOrg = V.univOrg;
    for (let i = rand(6, 9); i > 0; i--) { const p = poolPerson(Object.assign({ kind: 'classmate', hangout: 'clubroom' }, ageSpec(Math.max(19, S.age - 2), S.age + 4)), 'club:' + V.univOrg, '동아리 사람'); if (Math.random() < .5) p.hobby = S.hobby; }
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
// 관계 창에서는 행동력 5(학교 다닐 땐 50), 함께 밤은 12. 지금 장소에 같이 있는 사람이면 한 번은 행동력 없이 (noFree·함께 밤은 늘 씀)
const socialCost = (it, p) => it.cost ? (resolve(it.cost) || 0) : 0;
const INTIMATE_IDS = ['intimate', 'onenight', 'enjoy'];   // 함께 밤을 보내는 건 12 (어른, 약 2시간)
const QUICK_IDS = ['quickAlley', 'quickToilet', 'quickBush'];   // 지금 여기서 (골목·화장실·수풀) — 짧게 (약 1시간)
const socialAp = it => phase() !== 'adult' ? TEEN_PT : INTIMATE_IDS.includes(it.id) ? PT.intimate : QUICK_IDS.includes(it.id) ? 5 : PT.talk;
function interactions(pid) {
  const p = person(pid);
  if (!p) return [];
  const h = hereEntry(pid), here = !!h && !h.used, reach = !!h || hasNumber(p);   // 같은 곳에 없으면 번호가 있어야 연락
  const out = D.social.filter(it => it.if(S, p, api)).map(it => {
    const cost = socialCost(it, p), free = here && !it.noFree && !INTIMATE_IDS.includes(it.id), ap = socialAp(it);
    return { id: it.id, label: it.label, icon: it.icon, cost, free, ap, ok: reach && !busy() && !dutyPending() && (free || S.ap >= ap) && (!cost || S.money >= cost) };
  });
  if (h && !hasNumber(p) && npcAge(p) >= 10) out.unshift({ id: 'askNum', label: '번호 묻기', icon: '📱', cost: 0, free: phase() !== 'adult', ap: phase() === 'adult' ? NUM_PT : 0,
    ok: !busy() && p.askDay !== (S.dayN || 0) && (phase() !== 'adult' || S.ap >= NUM_PT) });
  return out;
}
function interact(pid, iid) {
  if (iid === 'askNum') { askNumber(pid); return; }
  const p = person(pid), it = D.social.find(x => x.id === iid);
  if (!p || !it || !it.if(S, p, api)) return;
  const cost = socialCost(it, p);
  const ap = socialAp(it), h = hereEntry(pid), free = !!h && !h.used && !it.noFree && !INTIMATE_IDS.includes(it.id);
  if (busy() || dutyPending() || (!free && S.ap < ap) || (cost && S.money < cost) || !(h || hasNumber(p))) return;
  const dlg = dlgFor(p, iid);
  if (!free) spend(ap);
  if (h) h.used = true;
  if (['talk', 'hang', 'date', 'flirt', 'gift', 'listen', 'drinkWith'].includes(iid)) nearby(p);
  // 친밀 20~39인 기혼자: 이야기하다 보면 결혼한 티가 새어 나옴 (40이면 확실히 앎)
  if (['talk', 'hang', 'listen', 'drinkWith', 'date'].includes(iid) && p.married && !p.marriedKnown && p.close >= 20 && p.close < 40 && Math.random() < .35) { S.vars.fp = p.id; marriedHint(p); }
  if (dlg) { openDialogue(p, iid, dlg, cost); return; }   // 대화 이벤트: 장면을 띄우고, 고른 말로 결과 (dlgChoose). 돈은 고를 때 냄
  const o = it.run(S, p, api) || {};
  o.mult = interactMult(p, iid);
  if (cost) { const eff = Object.assign({}, resolve(o.effect)); eff.money = val(eff.money) - cost; o.effect = eff; }
  S.vars.fp = p.id;
  if (!o.intimate) o.gk = gainK();
  applyOutcome(o, p);
  after();
}

// 호감도 배율: 성격 궁합(mod), 같은 취미(같이 놀기·선물), 가치관, 상대 생김새(설렘)
function interactMult(p, iid) {
  const pm = personality(p).mod[iid] || 1, mm = personality(S).mod[iid] || 1;
  const hm = sharedHobby(p) && (iid === 'hang' || iid === 'gift') ? 1.3 : 1;
  const vm = p.value === S.value ? 1.2 : valueClash(p) ? .8 : 1;
  const fm = 1 + ((p.face ?? 2) - 3) * .05;   // 상대 생김새가 좋으면 설렘이 빨리 오름
  return { close: pm * mm * hm, trust: pm * mm * vm, heart: pm * mm * vm * fm, grudge: (personality(p).mod.argue || 1) * (valueClash(p) ? 1.3 : 1) };
}

/* ═════════ 대화 이벤트 (data/dialogues.js) ═════════ */
// 대화하기·플러팅·섹드립 → 지금 상황·상대 성격에 맞는 장면 하나 → 고른 말의 말투(상대 성격과 궁합)·과감함에 따라 결과 (data/social.js run의 ch)
//   같은 사람에게 최근 본 장면(8개)·전체 최근 장면(12개)은 다른 게 있으면 피함. 조건이 구체적인 장면일수록 더 잘 뽑힘
//   대화 이벤트로 얻는 호감도는 그냥 행동보다 1.6배 (고르는 데 신경을 쓴 만큼)
const DLG_KIND = { talk: 'talk', flirt: 'flirt', dirtyTalk: 'dirty', touch: 'touch', hang: 'hang', gift: 'gift', listen: 'listen', family: 'family', date: 'date', drinkWith: 'drink',
  argue: 'argue', confess: 'confess', apologize: 'apologize', propose: 'propose', sexAsk: 'bed' };
// 그 밖의 상호작용(같이 놀기·선물·고민·가족·데이트·한잔·다투기)은 원래 결과에 고른 말의 궁합을 곱함 (잘 맞음 ×1.4 / 보통 ×1 / 안 맞음 ×0.5, 나쁜 값은 반대로)
//   성공·실패가 있는 것(고백·사과·청혼·잠자리 제안)은 고른 말이 문턱을 바꿈 (DLGB: 궁합 ±10, 스탯 선택지 +8)
//   선택지 need: { 스탯: 등급 } — 그 등급 이상일 때만 보임(스탯 선택지: 잘 맞음 취급 + ×1.2) / look: 내 외모 단계 / next: 이어지는 2차 장면 id (nextIf 'any'면 실패해도)
const DLG_REACT = { hang: 1, gift: 1, listen: 1, family: 1, date: 1, drink: 1, argue: 0 }, DLG_CHECK = ['confess', 'apologize', 'propose', 'bed'], DLG_REPLACE = ['hang', 'gift', 'listen', 'family'];
let DLGB = 0;
const needMet = c => (!c.need || Object.keys(c.need).every(k => (S.stats[k] || 0) >= gradeMin(c.need[k]))) && (!c.look || c.look.includes(myLook()));
const needTag = c => c.need ? ' · ' + Object.keys(c.need).map(k => `${LABEL[k]} ${c.need[k]}+`).join(', ') : '';
// 원래 결과의 좋은 값은 k배, 나쁜 값(마이너스·원한)은 kn배
function dlgScale(pd, k, kn) {
  const out = {};
  for (const key in pd) {
    const bad = x => key === 'grudge' ? x > 0 : x < 0, sc = x => Math.round(x * (bad(x) ? kn : k)), v = pd[key];
    out[key] = Array.isArray(v) ? v.map(sc) : typeof v === 'number' ? sc(v) : v;
  }
  return out;
}
const DLG_COND = ['pers', 'place', 'weather', 'season', 'drunk', 'taken', 'married', 'gender', 'if', 'night', 'heart', 'look', 'theirLook'];
// 외모 단계: 나는 첫인상 등급(A 이상 hi · D 이하 lo), 상대는 생김새 등급(B 이상 hi · E 이하 lo — NPC 상위 15% / 하위 40%)
const myLook = () => { const i = firstLook(); return i >= 5 ? 'hi' : i <= 2 ? 'lo' : 'mid'; };
const theirLook = p => { const i = p.face ?? 2; return i >= 4 ? 'hi' : i <= 1 ? 'lo' : 'mid'; };
let DLG = null;
const dlgById = id => { if (!DLG) { DLG = {}; for (const d of D.dialogues || []) DLG[d.id] = d; } return DLG[id]; };
const dlgStage = p => lover(p) ? 'lover' : p.fwb ? 'fwb' : p.close >= 60 ? 'close' : p.close >= 30 ? 'friend' : p.close >= 15 ? 'acq' : 'new';
const nightNow = () => phase() === 'adult' ? clockHour() >= 19 || clockHour() < 5 : S.time === 2;
const inRange = (v, r) => !r || (v >= r[0] && v <= r[1]);
function dlgFits(d, p) {
  const w = d.when || {}, age = npcAge(p);
  if (w.kin !== 'any' && !!w.kin !== (p.kind === 'family')) return false;
  if (w.pers && !w.pers.includes(p.personality)) return false;
  if (w.stage && !w.stage.includes(dlgStage(p))) return false;
  if (w.place && !w.place.includes(S.place)) return false;
  if (w.notPlace && w.notPlace.includes(S.place)) return false;
  if (w.night != null && w.night !== nightNow()) return false;
  if (w.weather && !w.weather.includes(S.weather)) return false;
  if (w.season && !w.season.includes(season().id)) return false;
  if (w.drunk && (S.drunk || 0) < w.drunk) return false;
  if (!inRange(p.close, w.close) || !inRange(p.heart || 0, w.heart) || !inRange(age, w.age) || !inRange(S.age, w.myAge)) return false;
  if (w.taken != null && w.taken !== !!(p.taken && !lover(p))) return false;
  if (w.married != null && w.married !== !!(p.married && !p.spouse)) return false;
  if (w.gender && p.gender !== w.gender) return false;
  if (w.me && S.gender !== w.me) return false;
  if (w.adult && (S.age < 19 || age < 19)) return false;
  if (w.look && !w.look.includes(myLook())) return false;
  if (w.theirLook && !w.theirLook.includes(theirLook(p))) return false;
  return !w.if || !!w.if(S, p, api);
}
// 이 상호작용이 대화 이벤트가 되는지: 13살부터, 내 아이(어린 자녀)와는 예전처럼 한 줄
function dlgFor(p, iid) {
  const kind = DLG_KIND[iid];
  if (!kind || !D.dialogues || S.age < 13 || p.kind === 'child' || npcAge(p) < 13) return null;
  const all = D.dialogues.filter(d => d.kind === kind && !d.follow && dlgFits(d, p));
  if (!all.length) return null;
  const recent = new Set((p.dlg || []).concat(S.dlgR || [])), fresh = all.filter(d => !recent.has(d.id));
  return weighted(fresh.length ? fresh : all, d => (d.weight || 1) * (1 + DLG_COND.filter(k => (d.when || {})[k] != null).length));
}
const dlgText = (v, p) => fill(typeof v === 'function' ? v(S, p, api) : v, { p: pname(p) });
// 선택지 한 줄: 말투 아이콘 + 말 (+ 플러팅·섹드립은 살짝 / 과감하게)
function dlgLabel(d, c, p) {
  const r = c.risk == null || c.tone === 'back' || !['flirt', 'dirty', 'touch', 'bed'].includes(d.kind) ? '' : c.risk === 0 ? ' · 살짝' : c.risk === 2 ? ' · 과감하게' : '';
  return `${(D.toneIcon || {})[c.tone] || '💬'} ${dlgText(c.t, p)}${needTag(c)}${r}`;
}
function openDialogue(p, iid, d, cost) {
  S.vars.fp = p.id;
  const text = dlgText(d.text, p), cs = d.choices.map((c, i) => i).filter(i => needMet(d.choices[i]) && (!d.choices[i].if || d.choices[i].if(S, p, api)));
  const tv = {}; TRANSIENT.forEach(k => { tv[k] = S.vars[k]; });
  p.dlg = (p.dlg || []).concat(d.id).slice(-8);
  S.dlgR = (S.dlgR || []).concat(d.id).slice(-12);
  S.pending.push({ id: '@dlg', dlg: d.id, pid: p.id, iid, text, cs, labels: cs.map(i => dlgLabel(d, d.choices[i], p)), tv, who: p.id, cost: cost || 0 });
  log(text, { t: 'ask' });
  after();
}
function dlgChoose(pd, i) {
  const d = dlgById(pd.dlg), p = person(pd.pid), it = D.social.find(x => x.id === pd.iid), c = d && d.choices[pd.cs[i]];
  if (!d || !p || !it || !c) return;
  log('▸ ' + pd.labels[i], { t: 'pick' });
  if (!it.if(S, p, api)) { log('타이밍을 놓쳤다. 이야기가 흐지부지 끝났다.', { t: 'info' }); return; }
  S.vars.fp = p.id;
  const fit = ((D.toneFit || {})[p.personality] || {})[c.tone] || 0, kind = d.kind, stat = !!c.need;
  let o;
  if (kind in DLG_REACT || DLG_CHECK.includes(kind)) {
    // 원래 결과 + 고른 말 (궁합·스탯 선택지·과감함)
    DLGB = fit * 10 + (stat ? 8 : 0) + (c.risk === 2 ? (fit >= 0 ? 4 : -6) : c.risk === 0 ? 2 : 0);
    try { o = it.run(S, p, api) || {}; } finally { DLGB = 0; }
    const lv = fit > 0 || stat ? 'great' : fit < 0 ? 'meh' : 'good';
    const k = (lv === 'great' ? 1.4 : lv === 'meh' ? .5 : 1) * (stat ? 1.2 : 1) * (c.risk === 2 ? 1.25 : c.risk === 0 ? .85 : 1), kn = lv === 'great' ? .6 : lv === 'meh' ? 1.4 : 1;
    if (o.p) o.p = dlgScale(resolve(o.p), k, kn);
    const ok = DLG_CHECK.includes(kind) ? o.ok !== false : lv !== 'meh', own = ok ? c.ok : c.ng, base = o.text;
    if (DLG_REACT[kind]) {
      const R = D.dlgReact.talk[lv], rx = own ? fill(own, { p: pname(p) }) : fill(pick(R[p.personality] || R.warm), { p: pname(p) });
      if (lv === 'meh' && o.p && !Object.values(o.p).some(v => Array.isArray(v) ? v[1] < 0 : v < 0)) o.p.close = [-2, 0];   // 안 맞으면 조금 서먹해짐
      o.text = DLG_REPLACE.includes(kind) ? rx : () => [fill(textOf(base) || '', { p: pname(p) }), rx].filter(Boolean).join(' ');
    } else if (own) o.text = () => [fill(textOf(base) || '', { p: pname(p) }), fill(own, { p: pname(p) })].filter(Boolean).join(' ');
    o.dlgOk = ok;
  } else o = it.run(S, p, api, { tone: c.tone, risk: c.risk ?? 1, fit, ok: c.ok, ng: c.ng, scene: d.id }) || {};
  if (pd.cost) { const eff = Object.assign({}, resolve(o.effect)); eff.money = val(eff.money) - pd.cost; o.effect = eff; }
  o.mult = interactMult(p, pd.iid);
  o.gk = Math.min(1, gainK() * 1.6);
  applyOutcome(o, p);
  // 2차: 고른 말에 이어지는 장면 (잘 됐을 때만, nextIf 'any'면 늘). 행동은 더 안 씀
  const okAll = o.dlgOk ?? o.ok ?? true, nx = c.next && dlgById(c.next);
  if (nx && (c.nextIf === 'any' || okAll) && person(p.id) && !S.ended) openDialogue(p, nx.iid || pd.iid, nx);
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
const canJobHunt = () => !busy() && S.ap >= PT.job && !dutyPending() && S.age >= 19 && !S.flags.student && !S.flags.inArmy && !jailed() && !S.job;
const jobInfo = () => D.jobs.map(j => Object.assign({}, j, { ok: meetsJob(j), checks: jobChecks(j) }));
function jobOdds(j) {
  let o = j.odds ?? .7;
  if (j.major && j.major.includes(S.school.dept)) o += .15;   // 관련 학과면 유리
  if (S.record) o *= .5;
  if ((S.closet || []).some(x => ['blazer', 'slacks', 'pencil', 'suitdress', 'longcoat'].includes(x.k)) || gIdx(S.stats.style) >= 4) o += .05;   // 면접에 입고 갈 단정한 옷
  return clamp(o, .05, .95);
}
function hire(j, o = {}) {
  // 같은 업종 경력 1년마다 +4%(최대 20%), 관련 자격증 +3~10% (알바·시급은 그대로)
  const exY = careerYears(j.cat), boost = o.hourly ? 1 : 1 + Math.min(.2, exY * .04) + Math.min(.1, certBonus(j) * .35);
  S.job = j.id; S.rank = 0; S.perf = 30; S.salary = Math.round((o.salary || j.salary) * boost); S.jobZone = o.zone || null; S.jobCo = o.co || null; S.jobDong = o.dong || null;
  const JB = jobState(); JB.career.push({ id: j.id, label: j.label, co: o.co || '', from: S.age, day: S.dayN || 0 });
  log(`${o.co ? `${o.co} — ` : ''}${j.label} 자리에 합격했다!`, { memory: !S.flags.firstJob, deltas: applyEffect({ happy: 6 }) });
  S.flags.firstJob = true;
  const dr = D.dreams.find(d => d.id === S.dream);
  if (dr && dr.job === j.id && !S.flags.dreamDone) { S.flags.dreamDone = true; log(`어릴 적 꿈이 이뤄졌다. ${dr.label}.`, { memory: true, deltas: applyEffect({ happy: 10 }) }); }
  S.vars.hireN = (S.vars.hireN || 0) + 1;   // 새 직장 → 같은 팀·타 부서 사람들 (ensurePools)
}
function applyJob(id) {
  const j = job(id);
  if (!j || !canJobHunt()) return;
  spend(PT.job);
  if (meetsJob(j) && Math.random() < jobOdds(j)) hire(j);
  else log(S.record && Math.random() < .5 ? `${j.label} 면접에서 전과 이야기가 나왔다. 떨어졌다.` : `${j.label} 면접에서 떨어졌다.`, { deltas: applyEffect({ happy: -3 }) });
  after();
}
function tryJob() {
  const ok = D.jobs.filter(meetsJob).sort((a, b) => b.salary - a.salary);
  for (const j of ok) if (Math.random() < jobOdds(j)) { hire(j); return true; }
  return false;
}
function loseJob() { const c = S.job && jobState().career.slice(-1)[0]; if (c && c.id === S.job && c.to == null) { c.to = S.age; c.toDay = S.dayN || 0; } S.job = null; S.salary = 0; S.rank = 0; S.perf = 0; S.jobZone = null; S.jobCo = null; S.jobDong = null; delete S.flags.owner; }
function quitJob() {
  if (!S.job || busy()) return;
  const j = job(S.job);
  loseJob();
  log(`${j.label} 일을 그만뒀다.`, { deltas: applyEffect({ happy: 2 }) });
  after();
}
/* ═════════ 구인 (📱 💼 잡서치 / 잡보드 — data/jobs.js jobSite) ═════════
   공고: 주마다 16개 (씨앗 = 인생·주) — 회사·동네·근무 형태·급여(알바는 시급)·마감·복리후생·지원자 수·평점
   이력서: 학력·경력·어학·자격증·자기소개서(다듬기 ⚡6, 0~3) → 서류 점수
   지원(⚡2, 온라인) → 1~4일 뒤 서류 결과(메일) → 면접 날 이벤트(job_interview — 고른 답 + 능력치) → 1~3일 뒤 합격·불합격 → 입사 (5일 안에)
   S.jobs = { apps: [{ pid, job, co, title, salary, zone, type, stage: doc|iv|wait|offer|fail|done|expired, res, iv, at }], intro, career: [{ id, label, co, from, to }] } */
const JS = () => (D.jobSite || {})[REGION] || (D.jobSite || {}).kr;
const jobState = () => { if (!S.jobs) S.jobs = { apps: [], intro: 0, career: S.job ? [{ id: S.job, label: job(S.job).label, co: S.jobCo || '', from: S.age, day: S.dayN || 0 }] : [] }; return S.jobs; };
// 상호·지점 이름용 동 이름: 신림동 → 신림, 목동 → 목동
const dongShort = n => n.length > 2 ? n.replace(/동$/, '') : n;
const APPLY_PT = 2, POLISH_PT = 6;
let JCACHE = null;
function postings() {
  const W = JS();
  if (!W || !S.date) return [];
  const wk = Math.floor((S.dayN || 0) / 7), key = `${S.id}:${REGION}:${wk}`;
  if (JCACHE && JCACHE.key === key) return JCACHE.list;
  const list = withSeed(`jobs:${key}`, () => Array.from({ length: 16 }, (_, i) => {
    const j = weighted(D.jobs, x => (x.type === '알바' || x.type === '계약직' ? 3 : x.type === '프리랜서' ? 1.4 : 2) * (x.odds < .4 ? .6 : 1));
    return makePosting(W, j, `${wk}-${i}`);
  }));
  JCACHE = { key, list };
  return list;
}
function makePosting(W, j, id) {
  const dongs = ((RT() || {}).dongs || []).filter(d => ['office', 'it'].includes(j.cat) ? ['work', 'downtown'].includes(d.zone) : true);
  const dong = dongs.length ? pick(dongs) : { name: '시내', zone: 'downtown' };
  const co = pick((W.by || {})[j.id] || W.co[j.cat] || ['(주)한빛']).replace('{d}', dongShort(dong.name)).replace('{n}', rand(2, 99));
  const career = j.type === '알바' ? '경력 무관' : Math.random() < .72 ? '신입' : `경력 ${rand(1, 5)}년↑`;
  const salary = Math.round(j.salary * (.9 + Math.random() * .25) / 10) * 10;
  const hourly = j.type === '알바' ? Math.round(W.minWage * (1 + rand(0, 22) / 100) * (REGION === 'kr' ? .1 : 100)) / (REGION === 'kr' ? .1 : 100) : null;
  const title = j.type === '알바' ? `${j.label} 구해요 · 주 ${rand(3, 6)}일` : `[${career}] ${j.label} ${pick(['채용', '모집', '구인', '정규직 채용'])}`;
  return { id: 'j' + id, job: j.id, label: j.label, cat: j.cat, co, dong: dong.name, zone: dong.zone, type: j.type, career, salary, hourly, title,
    deadline: (S.dayN || 0) + rand(3, 20), perks: shuffle(W.perks.slice()).slice(0, rand(2, 5)), applicants: rand(3, 240), star: Math.round((2.9 + Math.random() * 1.9) * 10) / 10, volatile: !!j.volatile };
}
// 이력서 (자동으로 채워짐 + 자기소개서 수준)
function resume() {
  const sc = S.school || {}, R = jobState(), kr = REGION === 'kr', yrs = c => Math.max(0, (c.to ?? S.age) - c.from);
  const edu = sc.degree ? `${univLabel() || '대학'} ${majorLabel() || ''} 졸업${sc.gpaN ? ` · 학점 ${sc.gpa.toFixed(2)}` : ''}` : sc.univ && S.flags.student ? `${univLabel()} ${majorLabel() || ''} 재학` : S.age >= 19 ? '고등학교 졸업' : '재학 중';
  const career = R.career.map(c => `${c.co ? c.co + ' · ' : ''}${c.label} ${ymText(spanY(c))}${c.to == null ? ' (재직 중)' : ''}`);
  // 자격증: 실제로 딴 것 (📱 자격증 앱) + 학과 졸업으로 따라오는 면허 (간호사·의사·교원)
  const certs = CERTS().filter(c => !c.score && (certState()[c.id] || {}).has).map(certName);
  const dept = sc.degree ? sc.dept : null, C2 = { nursing: ['간호사 면허'], medicine: ['의사 면허'], education: ['교원자격증'] }[dept];
  if (C2) certs.push(...C2);
  const lc = CERTS().find(c => c.score), ls = lc && (certState()[lc.id] || {}).score;
  const lang = ls ? `${certName(lc)} ${ls}점` : kr ? '어학 점수 없음' : (S.eth && S.eth !== 'white' ? '영어 · 제2외국어 가능' : '영어 (원어민)');
  const cy = careerYears();
  return { edu, career, certs, lang, intro: R.intro || 0, introT: ['안 씀', '기본', '괜찮음', '공들임'][R.intro || 0], years: Math.floor(cy), yearsT: ymText(cy) };
}
function polishResume() {
  const R = jobState();
  if (busy() || S.ap < POLISH_PT || (R.intro || 0) >= 3 || phase() !== 'adult') return;
  spend(POLISH_PT); R.intro = (R.intro || 0) + 1;
  log(pick(['카페 구석에서 자기소개서를 처음부터 다시 썼다.', '이력서 사진을 새로 찍고 경력 기술서를 다듬었다.', '자기소개서를 소리 내어 읽어 보며 어색한 문장을 고쳤다.']) + ` (자기소개서: ${resume().introT})`, { t: 'info' });
  after();
}
/* ═════════ 경력 · 자격증 (data/career.js) ═════════
   경력: 직장마다 들어간 날(day)~나온 날(toDay) → 몇 년 몇 개월 (예전 저장은 나이로)
   자격증: S.certs[id] = { prog 공부 진도 0~100, reg 시험 날(dayN), res 발표 날, out 결과, has 딴 날, score 어학 점수, tries } */
const spanY = c => c.day != null ? Math.max(0, ((c.toDay ?? (c.to == null ? S.dayN || 0 : c.day + (c.to - c.from) * 365)) - c.day) / 365) : Math.max(0, (c.to ?? S.age) - c.from);
function careerYears(cat) { return (S.jobs ? S.jobs.career : []).filter(c => !cat || (job(c.id) || {}).cat === cat).reduce((t, c) => t + spanY(c), 0); }
const ymText = y => { const m = Math.round(y * 12); return m < 1 ? '1개월 미만' : m < 12 ? `${m}개월` : `${Math.floor(m / 12)}년${m % 12 ? ` ${m % 12}개월` : ''}`; };
const CERTS = () => D.certs || [];
const certOf = id => CERTS().find(c => c.id === id);
const certName = c => (REGION !== 'kr' && c.ny) || c.name;
const certState = () => S.certs || (S.certs = {});
const certFee = c => fPrice({ won: c.won, usd: c.usd });
const CERT_PT = 6, CERT_EXAM_PT = 30;
// 관련 자격증만큼 서류 가산 (직업이 콕 집혀 있으면 크게, 업종이면 조금. 어학은 점수가 높을 때만)
function certBonus(j) {
  let b = 0;
  for (const c of CERTS()) {
    const x = certState()[c.id];
    if (!x || !x.has) continue;
    if (c.score) { if ((x.score || 0) >= (REGION === 'kr' ? 800 : 100) && (c.jobs.includes(j.id) || c.cats.includes(j.cat))) b += .08; }
    else if (c.jobs.includes(j.id)) b += .15;
    else if (c.cats.includes(j.cat)) b += .06;
  }
  return Math.min(.3, b);
}
// 다음 시험일: 시험 달의 둘째 토요일, 접수 마감(시험 10일 전)이 지난 건 그다음
function certNext(c) {
  if (!S.date) return null;
  const d0 = dateOf();
  for (let k = 0; k < 15; k++) {
    const t = d0.getMonth() + k, y = d0.getFullYear() + Math.floor(t / 12), m = t % 12 + 1;
    if (c.months !== 'all' && !c.months.includes(m)) continue;
    const first = new Date(y, m - 1, 1), sat = new Date(y, m - 1, 1 + (6 - first.getDay() + 7) % 7 + 7);
    const dd = Math.round((sat - d0) / 864e5);
    if (dd >= 10) return { day: (S.dayN || 0) + dd, dd, t: `${m}월 ${sat.getDate()}일 (토)` };
  }
  return null;
}
function certInfo() {
  const st = certState(), day = S.dayN || 0, lib = ['library', 'ulib'].includes(S.place), adult = phase() === 'adult' && S.age >= 19;
  return { app: (D.certApp || {})[REGION] || (D.certApp || {}).kr || '자격증', ap: CERT_PT, examAp: CERT_EXAM_PT, lib, list: CERTS().map(c => {
    const x = st[c.id] || {}, nx = certNext(c), fee = certFee(c), done = !!x.has && !c.score;
    const why = !adult ? '열아홉 살부터' : jailed() ? '수감 중' : busy() ? '지금은 못 함' : '';
    return { id: c.id, name: certName(c), kind: c.kind, diff: c.diff, stat: LABEL[c.stat], score: !!c.score, desc: c.desc, fee, feeT: fmtMoney(fee), prog: Math.round(x.prog || 0), has: !!x.has, best: x.score || null, tries: x.tries || 0,
      reg: x.reg ? { dd: x.reg - day, t: x.regT || '' } : null, wait: x.res ? Math.max(0, x.res - day) : null, next: nx,
      jobs: c.jobs.map(id => (job(id) || {}).label).filter(Boolean),
      study: { ok: !why && !done && S.ap >= CERT_PT && !S.flags.inArmy, why: why || (done ? '이미 땀' : S.ap < CERT_PT ? `행동력 ⚡${CERT_PT}` : '') },
      apply: { ok: !why && !done && !x.reg && !x.res && !!nx && S.money >= fee, why: why || (done ? '이미 땀' : x.reg ? '접수함' : x.res ? '발표 기다리는 중' : !nx ? '일정 없음' : S.money < fee ? '돈이 모자람' : '') } };
  }) };
}
function certStudy(id) {
  const c = certOf(id), x = c && (certState()[id] = certState()[id] || {});
  if (!c || phase() !== 'adult' || busy() || S.ap < CERT_PT || (x.has && !c.score) || S.flags.inArmy || jailed()) return;
  spend(CERT_PT);
  const lib = ['library', 'ulib'].includes(S.place), gain = Math.max(2, Math.round((7 + gIdx(S.stats[c.stat]) * 1.6) * (lib ? 1.35 : 1) * ((S.fatigue || 0) >= 3 ? .6 : 1) / Math.pow(c.diff, .55)));
  x.prog = Math.min(100, (x.prog || 0) + gain);
  log(`📝 ${certName(c)} 공부 — ${pick(lib ? D.certLines.lib : D.certLines.study)} (진도 ${Math.round(x.prog)}%)`, { t: 'info' });
  after();
}
function certApply(id) {
  const c = certOf(id), x = c && (certState()[id] = certState()[id] || {}), nx = c && certNext(c);
  if (!c || !nx || x.reg || x.res || (x.has && !c.score) || busy() || phase() !== 'adult') return;
  const fee = certFee(c);
  if (S.money < fee) return;
  S.money -= fee; x.reg = nx.day; x.regT = nx.t;
  log(`📜 ${certName(c)} 시험 접수 — ${nx.t}. 응시료 ${fmtMoney(fee)}.`, { t: 'info' });
  after();
}
// 아침마다: 시험 날이면 '시험 보러 가기' 이벤트, 발표 날이면 결과
function certDaily() {
  if (!S.certs || phase() !== 'adult') return;
  const day = S.dayN || 0;
  for (const c of CERTS()) {
    const x = S.certs[c.id];
    if (!x) continue;
    if (x.res && day >= x.res) {
      const o = x.out || {};
      x.res = null; x.out = null;
      if (c.score) { x.has = true; x.score = Math.max(x.score || 0, o.score || 0); log(`📜 ${certName(c)} 성적 발표: ${o.score}점${o.score >= (x.prevBest || 0) && x.prevBest ? ' — 최고 점수!' : ''}`, { t: 'info', memory: !x.prevBest, deltas: applyEffect({ happy: o.score >= (REGION === 'kr' ? 800 : 100) ? 4 : 1 }) }); x.prevBest = x.score; }
      else if (o.pass) { x.has = day; log(`📜 ${certName(c)} 최종 합격! 이력서에 한 줄이 늘었다.`, { memory: true, deltas: applyEffect({ happy: 5 + c.diff }) }); }
      else { x.prog = Math.round((x.prog || 0) * .8); log(`📜 ${certName(c)} 불합격. ${pick(['다음 시험을 노리자.', '아깝게 떨어졌다.', '조금만 더 했으면…'])}`, { t: 'info', deltas: applyEffect({ happy: -3 }) }); }
    }
    if (x.reg && day >= x.reg) {
      if (day === x.reg && !S.pending.length && EVENTS.cert_exam) { S.vars.certId = c.id; S.vars.certName = certName(c); fire(EVENTS.cert_exam); }
      else if (day > x.reg) { x.reg = null; log(`📜 ${certName(c)} 시험 날을 놓쳤다. 응시료만 날렸다.`, { t: 'info', deltas: applyEffect({ happy: -1 }) }); }
    }
  }
}
// 시험 보기 (cert_exam 이벤트 '시험 보러 간다'): ⚡30, 합격 확률 = 진도·능력치·난이도. 어학은 점수
function certTake() {
  const c = certOf(S.vars.certId), x = c && S.certs[c.id];
  if (!c || !x || !x.reg) return;
  spend(Math.min(S.ap, CERT_EXAM_PT));
  x.reg = null; x.tries = (x.tries || 0) + 1;
  const p = (x.prog || 0) / 100, g = gIdx(S.stats[c.stat]), tired = (S.fatigue || 0) >= 3 ? .08 : 0;
  if (c.score) x.out = { score: REGION === 'kr' ? clamp(Math.round((250 + p * 460 + g * 30 + rand(-50, 50)) / 5) * 5, 10, 990) : clamp(Math.round(20 + p * 72 + g * 4 + rand(-8, 8)), 0, 120) };
  else x.out = { pass: Math.random() < clamp(.1 + p * .85 - (c.diff - 1) * .1 + (g - 3) * .05 - tired, .02, .97) };
  x.res = (S.dayN || 0) + c.days;
  log(`✏️ ${certName(c)} 시험을 봤다. ${pick(D.certLines.exam)} 결과는 ${c.days}일 뒤.`, { t: 'info' });
}
function certSkip() { const x = S.certs && S.certs[S.vars.certId]; if (x) x.reg = null; }
// 서류 점수: 조건 충족 여부 + 합격률 + 자기소개서 + 같은 업종 경력 (경력직 공고는 경력이 없으면 크게 깎임)
function docOdds(P) {
  const j = job(P.job), R = jobState(), rs = resume();
  let o = meetsJob(j) ? jobOdds(j) : (j.type === '알바' ? jobOdds(j) * .7 : jobOdds(j) * .15);
  const exY = careerYears(j.cat), need = +((P.career || '').match(/(\d+)년/) || [])[1] || 0;
  o += (R.intro || 0) * .05 + Math.min(.15, exY * .05) + certBonus(j);
  if (/경력/.test(P.career)) o *= exY >= need ? 1.15 : exY > 0 ? .6 : .3;   // 경력 n년↑: 같은 업종 경력이 그만큼 있어야
  if (S.record) o *= .6;
  return clamp(o + (j.type === '알바' ? .1 : 0), .03, .97);
}
const jobAppWhy = P => phase() !== 'adult' ? '어른이 되면' : S.age < 19 ? '19살부터' : jailed() ? '수감 중' : S.flags.inArmy ? '군 복무 중' : busy() ? '지금은 못 함' : S.ap < APPLY_PT ? `행동력 ⚡${APPLY_PT} 필요` : P && (S.dayN || 0) > P.deadline ? '마감' : P && jobState().apps.some(a => a.pid === P.id) ? '지원함' : P && S.job === P.job && S.jobCo === P.co ? '지금 다니는 곳' : '';
function postingView(P) {
  const j = job(P.job), checks = jobChecks(j), a = jobState().apps.find(x => x.pid === P.id);
  return Object.assign({}, P, { checks, ok: checks.every(c => c[0]), why: jobAppWhy(P), app: a ? a.stage : null, chance: (o => o >= .6 ? ['높음', 'hi'] : o >= .3 ? ['보통', 'mid'] : ['낮음', 'lo'])(docOdds(P)), dday: P.deadline - (S.dayN || 0), commute: jobCommuteMin(P), salaryT: P.hourly ? `시급 ${REGION === 'kr' ? P.hourly.toLocaleString() + '원' : '$' + P.hourly}` : `${P.volatile ? '평균 ' : ''}연봉 ${fmtMoney(P.salary)}`, catT: (D.jobCats || {})[P.cat] || '' });
}
const jobCommuteMin = P => { const b = dongPos(P.dong) || zonePos(P.zone) || [360, 460]; const r = pickRoute(routeOptions(homePos(), b, 'office', { h: 8 }).filter(o => o.mode !== 'taxi'), 'auto'); return Math.round(6 + r.ap * 11); };
function applyPosting(id) {
  const P = postings().find(x => x.id === id);
  if (!P || jobAppWhy(P)) return;
  spend(APPLY_PT);
  const fast = P.type === '알바';
  jobState().apps.unshift({ pid: P.id, job: P.job, label: P.label, co: P.co, title: P.title, salary: P.salary, hourly: P.hourly, zone: P.zone, dong: P.dong, type: P.type, stage: 'doc', at: S.dayN || 0, res: (S.dayN || 0) + (fast ? 1 : rand(2, 4)), pass: Math.random() < docOdds(P) });
  jobState().apps = jobState().apps.slice(0, 20);
  log(`📨 ${P.co}에 지원했다. (${P.label}) ${fast ? '내일쯤 연락이 온다고 했다.' : '서류 결과는 며칠 뒤에 나온다.'}`, { t: 'info' });
  after();
}
// 아침마다: 서류 결과 · 면접 날 · 최종 결과 · 오퍼 만료
function jobDaily() {
  if (!S.jobs || phase() !== 'adult') return;
  const W = JS(), day = S.dayN || 0;
  S.jobs.apps.forEach((a, i) => {
    if (a.stage === 'doc' && day >= a.res) {
      if (a.pass) { a.stage = 'iv'; a.iv = day + (a.type === '알바' ? rand(0, 1) : rand(1, 4)); log(W.say.pass.replace('{co}', a.co).replace('{d}', a.iv === day ? '오늘' : `${a.iv - day}일 뒤`), { t: 'info' }); }
      else { a.stage = 'fail'; log(W.say.fail.replace('{co}', a.co), { t: 'info', deltas: applyEffect({ happy: -1 }) }); }
    } else if (a.stage === 'iv' && day >= a.iv && !S.pending.length && EVENTS.job_interview) {
      S.vars.ivApp = i; S.vars.ivCo = a.co; S.vars.ivJob = a.label; S.vars.ivPart = a.type === '알바' ? 1 : 0;
      fire(EVENTS.job_interview);
    } else if (a.stage === 'wait' && day >= a.res) {
      if (a.ok) { a.stage = 'offer'; a.exp = day + 5; log(W.say.offer.replace('{co}', a.co), { t: 'info', memory: false }); }
      else { a.stage = 'fail'; log(W.say.fail.replace('{co}', a.co), { t: 'info', deltas: applyEffect({ happy: -2 }) }); }
    } else if (a.stage === 'offer' && day > a.exp) a.stage = 'expired';
  });
}
// 면접 (data/events2.js job_interview 선택지): smart 또박또박 / charm 웃으며 자신 있게 / skill 경험·실력 / honest 솔직하게
function interview(kind) {
  const a = jobState().apps[S.vars.ivApp];
  if (!a) return false;
  const j = job(a.job), stat = { smart: 'smart', charm: 'charm', skill: ['craft', 'medical', 'labor', 'drive'].includes(j.cat) ? 'craft' : j.cat === 'art' ? 'art' : 'smart', honest: 'charm' }[kind] || 'charm';
  let o = (meetsJob(j) ? jobOdds(j) : .15) + (gIdx(S.stats[stat]) - 3) * .07 + (jobState().intro || 0) * .03 - (S.drunk ? .2 : 0) - ((S.fatigue || 0) >= 3 ? .08 : 0);
  if (kind === 'honest') o += .04;
  if (kind === 'skill' && jobState().career.some(c => (job(c.id) || {}).cat === j.cat)) o += .12;
  if ((S.closet || []).some(x => ['blazer', 'slacks', 'pencil', 'suitdress', 'longcoat'].includes(x.k)) || gIdx(S.stats.style) >= 4) o += .05;
  a.ok = Math.random() < clamp(o + (a.type === '알바' ? .15 : 0), .05, .95);
  a.stage = 'wait'; a.res = (S.dayN || 0) + (a.type === '알바' ? 1 : rand(1, 3));
  S.vars.ivGood = a.ok ? 1 : 0;
  return a.ok;
}
function acceptOffer(i) {
  const a = jobState().apps[i], j = a && job(a.job);
  if (!j || a.stage !== 'offer' || busy()) return;
  if (S.job) { const old = job(S.job); loseJob(); log(`${old.label} 일을 정리하고 사직서를 냈다.`, { t: 'info' }); }
  a.stage = 'done';
  hire(j, { salary: a.hourly ? j.salary : a.salary, hourly: !!a.hourly, zone: a.zone, co: a.co, dong: a.dong });
  after();
}
function declineOffer(i) { const a = jobState().apps[i]; if (a && a.stage === 'offer') { a.stage = 'declined'; log(`${a.co}의 제안을 정중히 거절했다.`, { t: 'info' }); after(); } }
function jobApps() { return jobState().apps.map((a, i) => Object.assign({ ix: i }, a, { dday: a.stage === 'iv' ? a.iv - (S.dayN || 0) : a.stage === 'offer' ? a.exp - (S.dayN || 0) : null })); }
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
    f('feature', '특징', [...(window.Avatar && Avatar.traits ? Avatar.traits(lookOf(p)).filter(t => !['보조개', '주근깨', '눈썹'].some(k => t.includes(k) && (p.feature || '').includes(k))).slice(0, 2) : []), p.feature].join(' · ')),   // 얼굴 특징(○○상·점·보조개 …) + 말버릇
    ...(age >= 13 && !kin ? [{ field: 'face', label: '생김새', value: `${LETTERS[p.face] || 'D'} · 꾸밈 ${LETTERS[p.style] || 'D'}` }] : []),
    ...(age >= 13 && !kin && window.Avatar && Avatar.faceInfo && lookOf(p) ? [{ field: 'look', label: '인상', value: Avatar.faceInfo(lookOf(p), age).sentence }] : []),
    ...(p.likeEye != null && window.Face && age >= 16 && !kin && p.close >= 40 ? [{ field: 'type', label: '좋아하는 얼굴', value: `${Face.EYES[p.likeEye].name} 눈 · ${Face.NOSES[p.likeNose].name} 코` }] : []),
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
  const mf = S.age >= 13 ? myFace() : null;
  return [
    ['소질', trait().label], ...(mf ? [['인상', mf.sentence]] : []), ['성격', L(D.personalities, S.personality)], ['취미', [S.hobby, S.hobby2].filter(Boolean).map(h => L(D.hobbies, h)).join(', ')],
    ['체형', [S.age >= 19 ? `키 ${cm(fg.height, fg.hGrade)}` : BL.height[b.height], BL.build[b.build]].filter(Boolean).join(', ') + ` (몸 ${gradeOf(S.stats.fit)})`],
    ...shape,
    ...(S.flags.unnatural ? [['특징', '어딘가 부자연스럽다']] : []),
    ...(S.age >= C.sexMinAge && S.penis ? [['성기', penisLabel(S.penis)]] : []),
    ...(S.flags.hadSex ? [['섹스 기술', sexGrade(S.sexSkill)]] : []),
    ...((S.rumor || 0) >= 30 && S.rumorType ? [['소문', RUMOR_LINE[S.rumorType]]] : []),
    ['가치관', L(D.values, S.value)], ['집안', L(D.wealth, S.wealth)], ['꿈', L(D.dreams, S.dream) + (S.flags.dreamDone ? ' (이룸)' : '')],
    ['형제', L(D.siblings, S.sibling)], ['생일', `${S.month}월`],
  ];
}

// 내 정보(프로필 원)의 기록 — 숫자로 남는 것들
function myRecords() {
  const ps = alive().filter(p => p.kind !== 'child' || p.role), out = [];
  const num = ps.filter(p => hasNumber(p)).length, fr = ps.filter(p => relLabel(p) === '친구').length;
  out.push(['💰 돈', fmtMoney(S.money)]);
  if (S.job) out.push(['💼 직업', `${jobTitle()} · 연봉 ${fmtMoney(S.salary || 0)} · 성과 ${Math.round(S.perf || 0)}`]);
  if (S.jobs && S.jobs.career.length) out.push(['🗂 경력', `총 ${ymText(careerYears())} · ${S.jobs.career.slice(-3).map(c => `${c.label} ${ymText(spanY(c))}`).join(' · ')}`]);
  const cs = CERTS().filter(c => (certState()[c.id] || {}).has);
  if (cs.length) out.push(['📜 자격증', cs.map(c => c.score ? `${certName(c)} ${certState()[c.id].score}점` : certName(c)).join(' · ')]);
  out.push(['👥 아는 사람', `${ps.length}명 · 번호 ${num} · 친구 ${fr}`]);
  const mate = ps.find(p => p.spouse) || ps.find(p => p.partner);
  const loves = ps.filter(p => p.partner || p.spouse || p.ex || p.secret).length;
  if (S.age >= 13) out.push(['💕 연애', `${mate ? `${relLabel(mate)} ${pname(mate)} · ` : ''}사귄 사람 ${loves}명`]);
  if (S.age >= C.sexMinAge && S.flags.hadSex) { const np = ps.filter(p => p.nights); out.push(['🌙 함께 보낸 밤', `${np.length}명 · ${np.reduce((a, p) => a + (p.nights || 0), 0)}번 · 기술 ${sexGrade(S.sexSkill)}`]); }
  if (S.age >= 19) out.push(['🏠 집', `${homeNow().label || '집'}${S.home && S.home.dong ? ` (${S.home.dong})` : ''} · 이사 ${Math.max(0, (S.home && S.home.n || 0) - 0)}번`]);
  out.push(['📷 추억', `${(S.memories || []).length}개`]);
  out.push(['☯ 업보', `${karmaLabel()} (${S.karma || 0})`]);
  if ((S.rumor || 0) > 0) out.push(['🗣 소문', `${Math.round(S.rumor)}`]);
  if (S.record || S.caughtN) out.push(['🚨 전과·들킴', `전과 ${S.record || 0}번 · 들킨 일 ${S.caughtN || 0}번`]);
  if (phase() === 'adult') out.push(['😮‍💨 피로·취기', `피로 ${S.fatigue || 0} · ${DRUNK[S.drunk || 0] || '맨정신'}`]);
  return out;
}

/* ═════════ 데이터에서 쓰는 도구 ═════════ */
const api = {
  rand, pick, josa, money: fmtMoney, dateDress, college: () => D.universities.find(u => u.tier === 5) || D.universities[D.universities.length - 1],   // 그 나라의 전문대(커뮤니티 칼리지)
  givenName: g => pick(g === 'm' ? D.namesM : g === 'f' ? D.namesF : D.namesM.concat(D.namesF)),
  region: () => REGION, regions: REG, loc, previewRegion: id => applyRegion(id), syncRegion: () => applyRegion(S ? S.region : 'kr'), norm: NORM, gradeTxt, gradeLetter,
  myGiven: () => !S ? '' : REGION === 'kr' ? (S.name.length >= 3 ? S.name.slice(1) : S.name) : S.name.split(' ')[0],
  meet: spec => addPerson(spec),
  person, npcAge, canRomance, heartOk, jailed, gradeMin, gradeOf, pGrade,
  faceStep: dir => { S.stats.face = gradeStep(S.stats.face, dir, LETTERS.indexOf('S')); },
  // 성형 (FACE_UPGRADE 4-6): 코·눈 크기·쌍꺼풀을 바꾸고 점수를 다시 계산 / 실패하면 비대칭
  faceSurgery: ok => {
    const f0 = S.stats.face;
    if (S.look && window.Avatar && Avatar.surgery) { S.vars.surgeryKind = Avatar.surgery(S.look, ok); syncFace();
      const want = clamp(f0 + (ok ? 3 : -3), 0, gradeMin('SS') - 1);
      if (ok ? S.stats.face < want : S.stats.face > want) { S.look.fadj = (S.look.fadj || 0) + want - S.stats.face; S.stats.face = want; } }
    else S.stats.face = gradeStep(S.stats.face, ok ? 1 : -1, LETTERS.indexOf('S'));
  },
  place: () => S.place, isHere: p => !!p && !!S.place && S.here.some(h => h.key === p.id),
  here: () => S.here.filter(h => !h.x).map(h => person(h.key)).filter(Boolean),
  regular: id => !!S.regular[id],
  find: fn => alive().filter(p => !p.acq && p.kind !== undefined && fn(p)),   // 얼굴만 아는 사이(acq)는 빠짐 — 장소에서 마주치면 a.here()로
  main: mainPartner,
  focus: p => { S.vars.fp = p ? p.id : null; },
  // 내 매력·외모 (처음 보는 이성 기준 0~100+): 생김새·매력이 크고 꾸밈·몸, 취기가 조금
  myAllure: () => g100(S.stats.face) * .42 + g100(S.stats.charm) * .32 + g100(S.stats.style) * .14 + g100(S.stats.fit) * .12 + [0, 3, 5, -4][S.drunk || 0],
  // 집·이웃 (data/housing.js): 지금 집, 집 앞 풍경, 지금 동네 이웃들
  home: () => homeNow(), homeSpot: () => homeNow().spot || { label: '집 앞', doing: ['지나가고 있다'] },
  neighbors: () => alive().filter(p => p.kind === 'neighbor' && p.org === S.vars.nbOrg && p.hh),
  clubMates: () => alive().filter(p => p.rtag === '동아리 사람' && p.org === 'club:' + S.vars.univOrg),
  loseHome, homeDep: () => (S.home && S.home.dep) || 0,
  focused: () => person(S.vars.fp),
  changeP: (p, d) => applyP(p, d),
  startRelation, marry, breakUp, divorce, endMain, night, conceive, endAffair, guiltOf,
  drunk: () => S.drunk || 0, spouseWord: p => p && p.gender === 'f' ? '남편' : '아내',
  canSex, onPill, fertile, refusal, known, dlgBonus: () => DLGB, myLook, theirLook, mateHere, sexIdx: () => sIdx(S.sexSkill), charmIdx: () => gIdx(S.stats.charm), lookIdx: () => firstLook(), sss: () => SSS(), sexGrade: () => sexGrade(S.sexSkill), turn: () => turnNo(), today: () => S.dayN || 0, casualBonus, casualReady, companion, setCompanion, lust: p => lustOf(p), lustTop: () => lustTop().p, allure, charmed, need: k => C.allureNeed[k], firstLook, faceGrade: () => LETTERS[firstLook()], myFace: () => gIdx(S.stats.face),
  sentence, escape, tryJob, loseJob, certTake, certSkip,
  perf: n => { S.perf = clamp(S.perf + n, 0, 100); },
  interview, jobLabel: () => S.job ? job(S.job).label : '',
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
    v: 5, id: Date.now(), seq: 0, pseq: 0, xseq: 0, region: REGION, eth: REGION === 'kr' ? undefined : opt.eth || pickEth(),
    name, gender, age: 0, money: 0, ap: 0, used: 0, apv: 2, at: 'home', seasonIdx: -1, trait: tr.id,
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
  applyRegion(opt.region || 'kr');
  const gender = opt.gender === 'm' || opt.gender === 'f' ? opt.gender : (Math.random() < .5 ? 'm' : 'f');
  const tr = D.traits.find(t => t.id === opt.trait) || pick(D.traits);
  if (REGION !== 'kr' && !opt.eth) opt = Object.assign({}, opt, { eth: pickEth() });
  const name = (opt.name || '').trim().slice(0, REGION === 'kr' ? 6 : 12) || nameFor(gender, opt.eth, true);
  const sib = D.siblings.find(x => x.id === opt.sibling) || (Math.random() < .35 ? D.siblings[0] : pick(D.siblings.slice(1)));
  S = blankState(opt, gender, tr, name, sib);
  if (REGION !== 'kr') S.flags.exempt = true;   // 뉴욕: 병역 없음
  if (tr.start) for (const k in tr.start) S.stats[k] = COND.includes(k) ? clamp(S.stats[k] + tr.start[k], 0, 100) : S.stats[k] + tr.start[k];
  S.look = window.Avatar ? Avatar.make(`${S.id}:me`, gender, { eth: S.eth }) : null;
  fitMyFace();
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
// 0~100 포인트 → 게임 능력치: 0~20 F / 21~40 E~D / 41~60 C / 61~80 B~A / 81~100 S~SS (등급 시작값 data/life.js grades, 100이면 상한 = 화면 1000)
const QS_CONV = [[0, 0], [20, 29], [21, 30], [40, 89], [41, 90], [60, 119], [61, 120], [80, 224], [81, 225], [100, 300]];
function qsStat(v) {
  v = clamp(Math.round(+v || 0), 0, 100);
  for (let i = 1; i < QS_CONV.length; i++) {
    const [x0, y0] = QS_CONV[i - 1], [x1, y1] = QS_CONV[i];
    if (v <= x1) return x1 === x0 ? y1 : Math.round(y0 + (y1 - y0) * (v - x0) / (x1 - x0));
  }
  return 300;
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
  const g = q.gender === 'f' ? 'f' : 'm', a = Avatar.make(`${q.seed || 'qs'}:me`, g, { eth: q.eth || (REGION === 'kr' ? null : S && S.eth) });
  a.xseed = String(q.seed || 'qs');
  for (const k of ['hair', 'hc', 'skin', 'eyes', 'iris']) if (q[k] != null && q[k] !== '') a[k] = +q[k];
  // 직접 고른 얼굴형·눈썹·속눈썹·눈썹 진하기 (안 고르면 얼굴 유전자대로) — 생김새 등급을 맞출 때도 그대로 남음
  const has = k => q[k] != null && q[k] !== '', go = {};
  if (has('shape')) go.shape = +q.shape;
  if (has('brow')) go.brow = +q.brow;
  if (has('lashLv')) go.lashLv = +q.lashLv;
  if (has('browLv') && window.Face) go.browThick = Face.BROW_LV[g][+q.browLv];
  if (Object.keys(go).length) a.go = go;
  const h = +q.height || (g === 'm' ? 173 : 162), R = g === 'm' ? [168, 179] : [157, 167];
  a.body = { height: h < R[0] ? 'short' : h > R[1] ? 'tall' : 'avg', build: QD().builds.some(b => b.id === q.build) ? q.build : 'avg' };
  if (g === 'f') { const ci = QD().cups.indexOf(q.cup); a.body.chest = ci <= 1 ? 'small' : ci >= 4 ? 'large' : 'avg'; }
  else a.body.shoulder = +q.shoulder < 41 ? 'narrow' : +q.shoulder > 46 ? 'wide' : 'avg';
  if (q.st && q.st.face != null && Avatar.fitGrade) Avatar.fitGrade(a, faceLetter(qsStat(+q.st.face)));   // 미리보기·랜덤 얼굴도 고른 생김새 등급으로 (포인트 → 능력치로 바꿔서 — 샌드박스로 높게 깔면 높은 얼굴만)
  if (q.gray && q.diff === 'sandbox') a.blank = true;   // 샌드박스: 외모를 정하지 않음 → 회색 아바타 (얼굴 유전자는 그대로 두고 그리기만 회색. look.gray는 흰머리 나는 정도라 blank로 따로)
  return a;
}
const QS_TRACK = { cs: 'tech', medicine: 'life', nursing: 'life', biology: 'life', physics: 'science', chemistry: 'science', engineering: 'science', architecture: 'science', arts: 'arts', music: 'arts', design: 'arts', culinary: 'arts', beauty: 'arts' };
const r1 = v => Math.round(v * 10) / 10;
const ida = w => josa(w, '이').slice(-1) === '이' ? w + '이다' : w + '다';
const AGE_WORD = { 22: '스물두 살', 23: '스물세 살', 24: '스물네 살', 25: '스물다섯 살', 26: '스물여섯 살', 27: '스물일곱 살', 28: '스물여덟 살' };
// 🎓 졸업 후 시작: 딴 자격증(고른 것) · 인턴·알바 경력 · (골랐으면) 졸업 전에 확정된 첫 직장
function gradSetup(q, d, lines) {
  const Q = QD(), day = S.dayN || 0, st = certState(), got = [];
  for (const id of (q.certs || []).slice(0, Q.gradCertMax || 3)) {
    const c = certOf(id);
    if (!c) continue;
    st[id] = { prog: 100, has: day - rand(30, 500), tries: 1 };
    if (c.score) st[id].score = REGION === 'kr' ? clamp(Math.round((560 + gIdx(S.stats.smart) * 48 + rand(-60, 60)) / 5) * 5, 10, 990) : clamp(Math.round(62 + gIdx(S.stats.smart) * 6 + rand(-8, 8)), 0, 120);
    got.push(c.score ? `${certName(c)} ${st[id].score}점` : certName(c));
  }
  const JB = jobState(), W = JS() || {}, coOf = j => pick((W.by || {})[j.id] || (W.co || {})[j.cat] || ['(주)한빛']).replace('{d}', dongShort(homeDong() || '시내')).replace('{n}', rand(2, 99));
  if (q.intern === 'office') JB.career.push({ id: 'office', label: '사무 인턴', co: coOf(job('office')), from: S.age - 1, to: S.age - 1, day: day - 300, toDay: day - 120 });
  else if (q.intern === 'part') { const pj = job(pick(['cvs', 'barista', 'server'])); JB.career.push({ id: pj.id, label: pj.label + ' (알바)', co: coOf(pj), from: S.age - 2, to: S.age - 1, day: day - 420, toDay: day - 60 }); }
  let hired = null;
  if (q.gjob === 'hired') {
    hired = ((Q.gradJobs || {})[d && d.id] || ['office']).map(job).find(j => j && meetsJob(j)) || (meetsJob(job('office')) ? job('office') : null);
    if (hired) {
      S.job = hired.id; S.rank = 0; S.perf = rand(20, 30); S.salary = Math.round(hired.salary * (1 + Math.min(.1, certBonus(hired) * .35))); S.jobCo = coOf(hired);
      JB.career.push({ id: hired.id, label: hired.label, co: S.jobCo, from: S.age, day });
      S.flags.firstJob = true; S.vars.hireN = 1;
      const dr = D.dreams.find(x => x.id === S.dream);
      if (dr && dr.job === hired.id) S.flags.dreamDone = true;
    }
  }
  lines.push(['💼', hired ? `졸업 전에 ${S.jobCo} ${hired.label} 자리가 확정됐다. 다음 주 월요일이 첫 출근이다.` : q.gjob === 'hired' ? '취업이 확정됐다고 생각했는데 무산됐다. 다시 구직 사이트를 연다.' : '아직 취업 준비 중이다. 📱 구인 앱과 자격증 앱이 친구다.',
    [got.length ? `자격증 ${got.join(' · ')}` : '자격증 없음', JB.career.length ? `경력 ${JB.career.filter(c => c.toDay != null).map(c => `${c.label} ${ymText(spanY(c))}`).join(' · ') || '없음'}` : '경력 없음'].join(' · ')]);
}
function newLife20(q = {}) {
  applyRegion(q.region || 'kr');
  const Q = QD(), gender = q.gender === 'f' ? 'f' : 'm', opp = gender === 'm' ? 'f' : 'm';
  const tr = D.traits.find(t => t.id === q.trait) || pick(D.traits);
  const eth = REGION === 'kr' ? undefined : q.eth || pickEth();
  const name = (q.name || '').trim().slice(0, REGION === 'kr' ? 6 : 12) || nameFor(gender, eth, true);
  const sib = D.siblings.find(x => x.id === q.sibling) || D.siblings[0];
  const hob = [...new Set((q.hobbies || []).filter(h => D.hobbies.some(x => x.id === h)))].slice(0, 2);
  const valid = (list, id) => list.some(x => x.id === id) ? id : null;
  S = blankState({ personality: valid(D.personalities, q.personality), hobby: hob[0], value: valid(D.values, q.value), wealth: valid(D.wealth, q.wealth), dream: valid(D.dreams, q.dream), month: q.month, eth }, gender, tr, name, sib);
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
  S.stats.style = qsStat(clamp(+q.style || 0, 0, (q.diff === 'sandbox' ? QD().rangeSandbox : QD().range).style[1]));   // 샌드박스는 꾸밈도 100까지
  S.stats.happy = 60; S.stats.health = 80; S.stats.libido = 0;
  if (tr.start) for (const k in tr.start) S.stats[k] = COND.includes(k) ? clamp(S.stats[k] + tr.start[k], 0, 100) : S.stats[k] + tr.start[k];
  if (tr.face) S.stats.face = Math.max(S.stats.face, gradeValue(pickKey(tr.face)));
  const grad = !!q.grad && !!Q.gradEdu;   // 🎓 대학 졸업 후 시작
  const edu = grad ? (Q.gradEdu.find(e => e.id === q.edu) || Q.gradEdu[1]) : (Q.edu.find(e => e.id === q.edu) || Q.edu[1]);
  if (edu.bonus) for (const k in edu.bonus) S.stats[k] += edu.bonus[k];

  // 몸: 고른 체형·수치 (체형은 체력 등급이 바뀌기 전까지 그대로)
  S.look = quickLook(q);
  fitMyFace();
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
  if (q.home && q.home !== 'parents') S.flags.ownPlace = true;
  const ht = q.home === 'own' ? 'oneroom' : housingOf(q.home).id === q.home ? q.home : 'parents';
  S.home = ht === 'parents' ? { id: 'parents', dep: 0, n: 0, since: 0, rent: 0, mgmt: 0 } : homeFrom(ht, false);   // 사는 집 (data/realty.js 매물 하나)
  S.home.n = 0;
  if (REGION !== 'kr') S.flags.exempt = true;   // 뉴욕: 병역 없음
  else if (gender === 'm' && grad) { if (q.army === 'exempt') S.flags.exempt = true; else S.flags.served = true; }   // 졸업 후 시작: 군필이거나 면제
  else if (gender === 'm') { const ar = edu.id === 'retake' && q.army === 'now' ? 'next' : q.army; if (ar === 'exempt') S.flags.exempt = true; else S.vars.enlistAt = ar === 'now' ? 20 : 21; }

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
    Object.assign(sc, { univ: u.id, dept: d.id, tier: u.tier, start: 20, years: d.years || (u.tier === 5 && d.id !== 'nursing' ? 2 : 4) });
    if (grad) {   // 졸업 후 시작: 학점을 고른 대로, 2월에 졸업했고 오늘(3월 1일)부터 사회인
      sc.gpa = clamp(r1((+q.gpa || 3.2) + rand(-1, 1) / 10), 2, 4.5); sc.gpaN = sc.years;
      graduate();
      if (S.wealth === 'poor') S.money = -rand(400, 900);   // 4년치 학자금 대출
      lines.push(['🎓', `${josa(hs, '을')} 거쳐 ${u.name} ${josa(d.name, '을')} 졸업했다. 학사모를 던진 게 엊그제 같은데, 오늘부터는 사회인이다.`,
        `${u.short || u.name} ${sc.years}년제 · 학점 ${sc.gpa.toFixed(2)}`]);
    } else {
      // 입학 시점에서 시작: 오늘이 1학년 입학식 날 (학점은 아직 없음) → 대학 1학년 이야기(data/freshman.js)가 처음부터
      sc.gpa = 0; sc.gpaN = 0;
      S.flags.student = true;
      if (S.wealth === 'poor') S.money = -rand(100, 300);   // 학자금 대출
      lines.push(['📚', `${josa(hs, '을')} 졸업하고 ${u.name} ${d.name}에 합격했다. 오늘은 입학식 날, 1학년의 첫 봄이다.${sc.years <= 2 ? ' 2년제라 두 해 뒤면 졸업이다.' : ''}`,
        `내신 ${nae}등급 · 수능 ${sat}등급 · ${u.short || u.name} ${sc.years}년제`]);
    }
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
  if (gender === 'm' && REGION === 'kr') lines[0][1] += S.flags.exempt ? ' 병역은 면제받았다.' : S.flags.served ? ' 군대도 다녀왔다.' : S.vars.enlistAt === 20 ? ' 올봄 입대를 앞두고 있다.' : ' 내년 봄에 입대한다.';
  // 졸업 후 시작: 나이·날짜를 졸업한 해 3월 1일로 (입학 20살 + 학제 + 군필이면 2년)
  if (grad) {
    S.age = 20 + sc.years + (S.flags.served ? 2 : 0);
    S.dayN = Math.round(S.age * 365.25); S.date = { y: S.birthYear + S.age, m: 3, d: 1 };
  }

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
  if (S.flags.ownPlace) fam += ` 지금은 ${homeNow().label}에서 혼자 산다.`;
  lines.unshift(['🏠', fam]);

  // 친구 (같은 대학이면 캠퍼스에서 자주 마주침) — 명문대는 인맥 보너스: 더 가깝고 과 선배 한 명
  const campus = p => { if (uniEdu && grad) { p.uni = sc.univ; p.rtag = p.rtag || '대학 동기'; } else if (uniEdu) { p.uni = sc.univ; p.hangout = 'campus'; p.rtag = p.rtag || '같은 대학 간 친구'; } };
  const friends = [];
  for (let i = 0; i < clamp(+q.friends || 0, 0, 3); i++) {
    const f = addPerson({ kind: 'friend', ageDiff: rand(-1, 1), close: rand(40, 60) + (edu.id === 'elite' ? 8 : 0), trust: rand(35, 55) });
    if (i < 2) campus(f);
    friends.push(f);
  }
  if (edu.id === 'elite') { const sr = addPerson({ kind: 'friend', ageDiff: rand(1, 3), close: rand(28, 38), trust: rand(30, 42) }); sr.rtag = '같은 과 고교 선배'; campus(sr); }

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
    if (uniEdu && Math.random() < .5) { campus(lover); lover.rtag = null; }
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
  // 섹스 기술: 경험 있음이면 20~40 (0~100 기준) / 성욕(20~60)은 대상별 — 연인에게, 전 연인에게는 조금
  if (exp) { S.sexSkill = qsStat(rand(20, 40)); S.flags.hadSex = true; S.flags.intimate = true; }
  const sg = sandbox && SG.find(g => g[0] === q.sexg);   // 샌드박스: 섹스 기술 등급 직접 (F면 경험 없음)
  if (sg && sg[0] !== 'F') { S.sexSkill = sg[1] + rand(0, 15); S.flags.hadSex = true; S.flags.intimate = true; }
  const lib = rand(20, 60);
  if (lover && canSex(lover)) S.lust[lover.id] = lib;
  if (ex && canSex(ex)) S.lust[ex.id] = Math.round(lib * .35);
  syncLibido();

  if (grad) gradSetup(q, d, lines);
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
  log(grad ? `${AGE_WORD[S.age] || S.age + '살'}의 봄. 졸업장을 받아 들고, ${josa(S.name, '은')} 여기서부터 시작한다.` : `스무 살의 봄. ${josa(S.name, '은')} 여기서부터 시작한다.`, { memory: true });
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
  // 행동력 100 기준 (MAP): 예전 칸(어른 1칸 = 1시간 · 학교 턴 2~3칸) → 점수. 달력이 없던 저장은 아래에서 새로 시작
  if (!s.apv && s.date) {
    const prev = S; S = s;
    const ph = phase(), k = ph === 'adult' ? DAY_AP / 18 : TEEN_PT;
    if (ph === 'adult' || ph === 'ms' || ph === 'hs') for (const f of ['ap', 'used', 'dayStart', 'wake']) if (s[f]) s[f] = Math.round(s[f] * k);
    S = prev;
  }
  s.apv = 2;
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
  if (s.stats) for (const k of ABIL) if (s.stats[k] > ABIL_CAP) s.stats[k] = ABIL_CAP;   // 능력치 상한 (화면 1000)
  if (s.stats.face == null) { s.stats.face = s.stats.looks ?? gradeValue(pickKey(D.faceStart)); delete s.stats.looks; }
  if (s.stats.style == null) s.stats.style = 20;
  if (!s.closet) s.closet = [];   // 옷장 (산 옷)
  if (s.stats.libido == null) s.stats.libido = s.age >= C.sexMinAge ? 30 : 0;
  if (s.sexSkill == null) { s.sexSkill = s.flags.intimate ? 40 : 0; s.drunk = 0; }
  if (s.flags.intimate) s.flags.hadSex = true;
  if (!s.look && window.Avatar) s.look = Avatar.make(`${s.id}:me`, s.gender);
  if (s.look && !s.look.body && window.Avatar) s.look.body = Avatar.make(`${s.id}:me`, s.gender).body;
  if (!s.frame) s.frame = s.look && s.look.body && s.look.body.build !== 'fit' ? s.look.body.build : 'avg';
  for (const p of s.people) {
    if (p.tag && !(D.castLabel && D.castLabel[p.tag])) { p.rtag = p.tag; delete p.tag; }   // 예전 저장: 관계 이름표는 rtag로 (tag는 1학년 고정 인물 이름표)
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
// 예전 저장: 내 얼굴을 생김새 등급에 맞추고(한 번), NPC 생김새 등급은 얼굴 점수로 (FACE_UPGRADE)
function migrateFaces() {
  if (!S || !window.Avatar || !Avatar.faceInfo) return;
  if (S.look && typeof S.look.gray === 'boolean') { if (S.look.gray) S.look.blank = true; S.look.gray = .5; }   // 예전 저장: 회색 아바타를 gray(흰머리 정도)에 넣었던 것 → blank로 옮김
  if (S.look && (S.look.gfit || 0) < FACE_V) { const inf = Avatar.faceInfo(S.look); if (inf && inf.grade === gradeOf(S.stats.face)) S.look.gfit = FACE_V; else fitMyFace(); }   // 등급이 그대로면 얼굴도 그대로
  for (const p of S.people) if (p.appearance && (p.faceG || 0) < FACE_V) faceFromLook(p);
}
function init() { S = load(); if (S) { applyRegion(S.region); migrateFaces(); after(); return true; } return false; }
// 저장 칸 목록 (화면용 요약)
function slotList() {
  return Array.from({ length: SLOTS_N }, (_, i) => {
    const n = i + 1, s = n === slot && S ? S : readSlot(n);
    return { n, current: n === slot, empty: !s, name: s && s.name, age: s && s.age, gender: s && s.gender, date: s && s.date, ended: s && s.ended, quick: !!(s && s.quickstart), sandbox: !!(s && s.sandbox), region: s && (s.region || 'kr') };
  });
}
// 다른 칸으로: 비어 있으면 false (화면이 새 인생 만들기를 열고, newLife가 그 칸에 저장)
function useSlot(n) {
  n = clamp(+n || 1, 1, SLOTS_N);
  if (S) save();
  slot = n;
  try { localStorage.setItem(SLOT_KEY, String(n)); } catch (e) { /* */ }
  const s = readSlot(n);
  if (!s) { S = null; applyRegion('kr'); return false; }
  S = patch(s); held = null;
  applyRegion(S.region);
  migrateFaces();
  after();
  return true;
}
// 지금 인생을 다른 칸에도 저장 (수동 저장 — 그 칸으로 옮겨감)
function saveTo(n) { n = clamp(+n || 1, 1, SLOTS_N); if (!S) return; slot = n; save(); emit(); }
function deleteSlot(n) { if (n === slot) return; try { localStorage.removeItem(slotKey(n)); } catch (e) { /* */ } emit(); }

window.Game = {
  // 나라 (data/region.js)
  region: () => REGION, regions: REG, loc, previewRegion: id => applyRegion(id), syncRegion: () => applyRegion(S ? S.region : 'kr'), norm: NORM, gradeTxt, gradeLetter,
  myGiven: () => !S ? '' : REGION === 'kr' ? (S.name.length >= 3 ? S.name.slice(1) : S.name) : S.name.split(' ')[0],
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
  actPreview, lastAct: () => LAST_ACT, ride: { info: rideInfo, set: setRide, buyCar, sellCar, choices: routeChoices, options: id => { const pl = PLACES[id], a = mapPos(standAt()), b = pl && mapPos(id); return a && b ? routeOptions(a, b, id) : []; } }, mapInfo: () => ({ home: D.map ? homePos() : null, dong: D.map ? homeDong() : '', at: D.map ? mapPos(standAt()) : null }), phase, timeInfo, storyNext, nextTurn, doDuty: () => { doDuty(false); after(); }, attend: i => attendLecture(i), classInfo, cert: { info: certInfo, study: certStudy, apply: certApply, list: () => CERTS().map(c => ({ id: c.id, name: certName(c), score: !!c.score })) }, setGray: on => { if (S && S.look) { S.look.blank = !!on; save(); emit(); } }, sleep: () => skip('today'), skip,
  actionList, canDo, costOf, apOf, doAction, needsSubject, shopToday, outfitCtx: (p, evId) => outfitCtx(p || null, evId), dateOutfits, setDateOutfit: ix => { S.vars.dateOutfit = ix; },
  places: placeList, onCampus: () => onCampus(standAt()) && !!S.flags.student, teenPt: TEEN_PT, goPlace, leavePlace, hasNumber, askNumber, askStranger, mateWord, numberOdds, homeNow: () => homeNow(),
  // 📱 부동산 앱 (data/realty.js)
  realty: { list: realtyList, get: id => { const L = listingById(id); return L ? listingView(L) : null; }, fav: favListing, favs: () => realtyState().fav.map(listingView), recent: () => realtyState().recent.map(listingView), view: viewListing, ask: askListing, report: reportListing, visit: visitListing, registry: checkRegistry, quote, sign: signContract,
    toParents, home: homeInfo, why: realtyWhy, actWhy: () => realtyWhy() || realtyActWhy(), app: () => (RT() || {}).app || '방구하기', visitPt: VISIT_PT, regPt: REG_PT, agentToday: () => !!(S.realty && S.realty.agentDay === S.dayN), moves: () => RT().move },
  // 🍽 먹을 것 (data/food.js): 여기 메뉴·사기·가방·집밥·해 먹기·배달
  food: { here: foodHere, eat: eatMenu, buy: buyFood, bag: bagList, eatBag, drop: dropBag, home: homeEat, delivery: deliveryInfo, order: orderFood, price: fmtPrice, max: BAG_MAX, used: bagUsed, spent: () => { foodState(); payFood(0); return S.food; } },
  budget, here: hereList, hereNote: () => S.hereNote && S.hereNote.pl === S.place ? S.hereNote : null, talkTo, passBy, browseMore, browseLeft, drunkLabel: () => DRUNK[S.drunk || 0], place: () => PLACES[S.place] ? Object.assign({}, PLACES[S.place], kidPlaceName(S.place) ? { label: kidPlaceName(S.place) } : {}) : null, kidsAround, timeLabel: () => TIMES[S.time] || '', jailed,
  // 함께 밤을 보낸 적 있거나 사귀는 사이에게만 보이는 것: 상대 성욕, 궁합, 마지막 만족감
  intimacy: p => canSex(p) && (p.nights || lover(p) || p.teased) ? { libido: p.libido || 0, compat: p.compat, sat: p.lastSat, nights: p.nights || 0 } : null,
  // 이 사람을 향한 내 성욕 (내 마음이라 늘 보임) / 지금 가장 높은 대상
  myLust: p => canSex(p) ? lustOf(p) : null, lustTarget: () => { const t = lustTop(); return t.p ? { name: pname(t.p), v: t.v, id: t.p.id } : null; },
  people: () => alive(), person, interactions,
  // NPC 출현: 이름 옆 결혼 마커, 지금 반지가 보이는지, 얼굴만 아는 사람(관계 목록엔 따로), 소원해짐
  marker, ringVisible, acquaintance: p => !!p.acq, faded: p => faded(p), companion, endCompany: () => { S.companion = null; save(); emit(); }, interact, canSex, clearScene: () => { if (S.scene) { S.scene = null; save(); } }, look: lookOf, myLook: () => S.look, figure, relLabel, npcAge, canRomance, heartOk, pname, profile, myProfile, myRecords,
  crimes: () => D.crimes.filter(c => S.age >= c.minAge && meets(c.req)), canCrime, crimeOdds, commitCrime,
  jobInfo, canJobHunt, applyJob, quitJob, jobTitle,
  jobsite: { list: () => postings().map(postingView), apply: applyPosting, resume, polish: polishResume, apps: jobApps, accept: acceptOffer, decline: declineOffer, app: () => (JS() || {}).app || '구인', applyPt: APPLY_PT, polishPt: POLISH_PT, cats: () => D.jobCats || {} },
  roleText, karmaLabel, trait, job, mainPartner, season, fmtMoney, josa,
  gradeInfo, abilShow, abilMax: 1000, sexInfo: () => sexInfo(S.sexSkill), sexGrades: SG.map(g => g[0]), abilities: ABIL, conds: COND, subjects: D.subjects, naesinAvg, mockAvg, univLabel, majorLabel, studyInfo, subjectsNow: () => subjectsNow().map(SUB),
  // 학교 화면: 성적표 확인, 원서 (대학·학과 목록, 합격 확률, 내기)
  ackReport: () => { S.report = null; after(); }, get universities() { return D.universities; }, departments: D.departments, tracks: D.tracks, tierLabel: t => D.tierLabel[t], admitP, submitApply, gradeLabel: () => gradeLabel(),
  creation: { traits: D.traits, personalities: D.personalities, wealth: D.wealth, hobbies: D.hobbies, values: D.values, dreams: D.dreams, siblings: D.siblings },
  LABEL, config: C, seasons: SEASONS,
  // 개발·테스트용 (브라우저 콘솔이나 헤드리스 검사에서 이벤트를 직접 터뜨려볼 때)
  testNight, dev: { flow: (sat, cm) => nightFlow(sat, cm), fire: id => { fire(EVENTS[id]); after(); }, eligible: id => eligible(EVENTS[id]), meet: spec => addPerson(spec), rumorYear, api },
};
})();
