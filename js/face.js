// 얼굴 유전자 (FACE_VARIETY.md) — 사람마다 시드로 한 번 정해져 평생 같음
// 사람 얼굴이 다르게 보이는 건 파츠 모양보다 배치(눈 높이·간격·크기·각도, 코 길이, 인중, 입 폭, 턱 길이) 차이라서
// 배치 수치를 흔드는 게 핵심. js/avatar.js는 기존 머리 좌표(120 너비, 얼굴은 x 33~87·y 38~104) 위에서 이 값으로
// 파츠마다 위치·크기·각도를 바꿔 그림 → 썸네일·초상화·전신이 같은 유전자·같은 좌표를 쓰고, 표정은 그 위에 얹힘
//
//   genes(key, gender, npc)  key: 얼굴 시드(같으면 늘 같은 얼굴), npc: 아키타입(○○상) 치우침 허용
//   distance(a, b)           비슷한 얼굴 판정 (3 미만이면 비슷함 — 같은 생활권이면 시드를 바꿔 다시 뽑음)
//   traits(g)                프로필 '특징'에 붙는 말 ("눈 밑에 점이 있다", "고양이상" …)
// 파츠는 피부색과 상관없이 고름 (피부색별로 코·입을 정하면 고정관념이 됨)
(function () {
'use strict';
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  let s = hash(String(seed)) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const range = (r, a, b) => a + (b - a) * r();
const wpick = (r, list) => { let t = r() * list.reduce((x, y) => x + y[1], 0); for (const [k, w] of list) { t -= w; if (t <= 0) return k; } return list[0][0]; };

// 얼굴형 (avatar.js FACES 순서): 0 둥근 1 각진 2 갸름 3 계란 4 긴 5 하트
const SHAPE = { round: 0, square: 1, slim: 2, oval: 3, long: 4, heart: 5 };
const SHAPE_LABEL = ['둥근형', '각진형', '갸름형', '계란형', '긴 얼굴', '하트형'];
// 눈 (avatar.js eyeShape): 0 동그란 1 날카로운 2 처진(강아지) 3 가는 4 무쌍 5 큰 눈(사슴) 6 아몬드 7 고양이 8 여우 9 졸린 10 덮인
// 코: 0 꺾인 선 1 동그란 코끝 2 높은 콧대 3 넓은 콧볼 4 작은(버튼) 5 점 6 곧은 7 들린
// 입(다문 기본 표정): line smile flat down small wide bow pout cat
// 눈썹: 0 일자 1 완만한 아치 2 각진 3 두꺼운 일자 4 짧은 5 높은 아치 6 처진 7 올라간
const RANGE = { eyeY: .12, eyeGap: .27, eyeSize: .38, eyeTilt: 18, noseLen: .35, mouthW: .45, jawW: .25, faceLen: .2, browY: .07 };

// 아키타입 — NPC 20%만 하나로 치우침 (프로필에 '고양이상'처럼 보임)
const ARCH = {
  puppy:  { label: '강아지상', eye: [2, 0], tilt: [-8, -3], browA: [-6, -2], brow: [6, 1], mouth: ['smile'], shape: ['round', 'oval'] },
  cat:    { label: '고양이상', eye: [7, 1], tilt: [8, 10], brow: [7], nose: [2], shape: ['slim', 'heart'] },
  fox:    { label: '여우상', eye: [8], tilt: [4, 9], gap: [1.08, 1.15], chin: [.7, 1], mouth: ['bow'] },
  rabbit: { label: '토끼상', eye: [5, 0], size: [1.1, 1.2], mouth: ['small', 'pout'], nose: [7] },
  bear:   { label: '곰상', shape: ['round', 'square'], size: [.82, .92], eye: [3], brow: [3], mouth: ['wide'] },
  deer:   { label: '사슴상', eye: [5], eyeY: [.02, .06], len: [1.04, 1.12], nose: [6], mouth: ['small'] },
};

function genes(key, gender, npc) {
  const r = rng('fg:' + key), male = gender === 'm';
  const g = {
    shape: SHAPE[wpick(r, male ? [['oval', 2], ['round', .5], ['slim', 1], ['square', 2], ['heart', .6], ['long', 2]]
      : [['oval', 3], ['round', 1.6], ['slim', 1.2], ['square', .5], ['heart', 1.6], ['long', .9]])],
    faceLen: range(r, .92, 1.12), jawW: range(r, .8, 1.05) + (male ? .08 : 0), cheekW: range(r, .95, 1.08), chinPoint: r(),
    eyeY: range(r, -.06, .06), eyeGap: range(r, .88, 1.15), eyeSize: range(r, .82, 1.2) * (male ? .88 : 1), eyeTilt: range(r, -8, 10), irisK: range(r, .88, 1.1),
    browY: range(r, -.03, .04), browAngle: range(r, -6, 10), browThick: range(r, .7, 1.5) * (male ? 1.3 : 1),
    noseLen: range(r, .85, 1.2), noseW: range(r, .8, 1.25),
    mouthY: range(r, -.03, .04), mouthW: range(r, .8, 1.25), lipFull: range(r, .7, 1.4) * (male ? .8 : 1),
    lashN: male ? 0 : [0, 1, 1, 3, 3, 3][Math.floor(r() * 6)],   // 여자 속눈썹 꼬리 0·1·3가닥
    eye: null,                                                    // null이면 생김새의 눈(a.eyes) 그대로 — 아키타입만 바꿈
    nose: Math.floor(r() * 8),
    mouth: wpick(r, [['line', 1], ['smile', 1.2], ['flat', 1], ['down', .8], ['small', 1], ['wide', .9], ['bow', 1.2], ['pout', .9], ['cat', .35]]),
    brow: wpick(r, male ? [[0, 2], [1, 1], [2, 1], [3, 2], [4, .6], [5, .5], [6, 1], [7, 1.2]] : [[0, 1], [1, 2], [2, .8], [3, .4], [4, 1], [5, 1.4], [6, 1], [7, 1]]),
    ear: { size: range(r, .75, 1), y: range(r, -.03, .03) },
    marks: {},
  };
  // 남녀 차이 조금 더 (같은 시드 남매도 머리 없이 구분되게): 남자는 눈썹이 눈에 가깝고 얼굴·코가 조금 넓음, 여자는 입술이 조금 도톰
  if (male) { g.browY -= .012; g.cheekW += .015; g.noseW += .06; } else g.lipFull += .06;
  // 개성 포인트: 주근깨 8%, 보조개 12%(웃을 때만), 흉터 2%, 과장 파츠 30% (가장 기억에 남음)
  const m = g.marks;
  if (r() < .08) m.freckles = true;
  if (r() < .12) m.dimples = true;
  if (r() < .02) m.scar = r() < .5 ? 'brow' : 'chin';
  if (r() < .3) {
    m.exag = ['eye', 'brow', 'mouth', 'long'][Math.floor(r() * 4)];
    if (m.exag === 'eye') g.eyeSize = male ? 1.16 : 1.3;
    else if (m.exag === 'brow') g.browThick = male ? 2.3 : 1.9;
    else if (m.exag === 'mouth') g.mouthW = 1.42;
    else g.faceLen = 1.18;
  }
  // 아키타입 (NPC 20%)
  if (npc && r() < .2) {
    const id = Object.keys(ARCH)[Math.floor(r() * 6)], A = ARCH[id], pk = list => list[Math.floor(r() * list.length)];
    g.arch = id;
    if (A.eye) g.eye = pk(A.eye);
    if (A.tilt) g.eyeTilt = range(r, ...A.tilt);
    if (A.browA) g.browAngle = range(r, ...A.browA);
    if (A.brow) g.brow = pk(A.brow);
    if (A.mouth) g.mouth = pk(A.mouth);
    if (A.shape) g.shape = SHAPE[pk(A.shape)];
    if (A.nose) g.nose = pk(A.nose);
    if (A.gap) g.eyeGap = range(r, ...A.gap);
    if (A.chin) g.chinPoint = range(r, ...A.chin);
    if (A.size) g.eyeSize = range(r, ...A.size) * (male ? .9 : 1);
    if (A.eyeY) g.eyeY = range(r, ...A.eyeY);
    if (A.len) g.faceLen = range(r, ...A.len);
  }
  // FACE_UPGRADE.md: 코 10종(낮은·큼직한 추가)·좌우 비대칭 — 예전 얼굴이 바뀌지 않게 맨 뒤에서 뽑음
  const nx = r();
  if (nx < .14 && !g.arch) g.nose = nx < .07 ? 8 : 9;
  g.asym = Math.pow(r(), 2.6) * .7;   // 대부분 0 근처, 가끔 눈·눈썹 높이가 조금 다름
  return g;
}

// 나이 보정 (그릴 때마다): 어릴수록 눈이 크고 낮고 코는 점, 나이 들수록 입술이 얇고 턱이 처지고 눈이 덮임
function forAge(g, age, eyeOf) {
  const o = Object.assign({}, g);
  if (age <= 6) Object.assign(o, { shape: 0, eyeSize: g.eyeSize * 1.25, eyeY: g.eyeY + .05, nose: 5, mouth: 'small', chinPoint: 0, faceLen: 1, jawW: .95 });
  else if (age <= 12) Object.assign(o, { eyeSize: g.eyeSize * 1.15, nose: g.nose % 2 ? 5 : 4, chinPoint: g.chinPoint * .4, faceLen: Math.min(g.faceLen, 1.02) });
  else if (age <= 18) o.eyeSize = g.eyeSize * 1.05;
  if (age >= 40) { const st = Math.floor((age - 40) / 5) + 1; o.jawW = g.jawW + .02 * st; o.faceLen = g.faceLen + .01 * st; }   // 5년마다 턱 +.02, 얼굴 길이 +.01
  if (age >= 55) {
    o.lipFull = g.lipFull * .75; o.faceLen += .03;
    if (eyeOf !== 9 && eyeOf !== 10 && hash(String(g.noseLen)) % 2) o.eye = 10;   // 눈이 덮임
  }
  return o;
}

// 비슷한 얼굴: 배치 수치 차이(범위로 나눔) + 파츠 종류가 다르면 +1
function distance(a, b) {
  let d = 0;
  for (const k in RANGE) d += Math.abs(a[k] - b[k]) / RANGE[k];
  for (const k of ['shape', 'eye', 'nose', 'mouth', 'brow']) if (a[k] !== b[k]) d += 1;
  return d;
}

// 프로필 '특징'에 붙는 말
const MOLE_TEXT = ['입가에 점이 있다', '눈 밑에 점이 있다', '볼에 점이 있다', '턱에 점이 있다'];
function traits(g, mole) {
  const out = [];
  if (g.arch) out.push(ARCH[g.arch].label);
  const ex = g.marks.exag;
  if (ex === 'eye') out.push('눈이 아주 크다');
  else if (ex === 'brow') out.push('눈썹이 아주 진하다');
  else if (ex === 'mouth') out.push('입이 시원하게 크다');
  else if (ex === 'long') out.push('얼굴이 길쭉하다');
  if (mole != null && mole >= 0) out.push(MOLE_TEXT[mole]);
  if (g.marks.dimples) out.push('웃으면 보조개가 생긴다');
  if (g.marks.freckles) out.push('콧등에 주근깨가 있다');
  if (g.marks.scar) out.push(g.marks.scar === 'brow' ? '눈썹에 작은 흉터가 있다' : '턱에 작은 흉터가 있다');
  return out;
}

/* ---------- FACE_UPGRADE.md: 카탈로그·얼굴 점수·등급·인상 묘사 ---------- */
// 눈 12종 — 번호는 생김새의 눈(a.eyes, 예전 11종 번호와 맞춤). 수치: w 가로, h 세로, peak 윗선 꼭짓점(0 안쪽~1 바깥), tilt 눈꼬리(도),
//   lower 아랫선 볼록함, iris 눈동자 크기, lid 윗꺼풀이 눈동자를 덮는 비율, base 매력 { f, m }, adn/con 인상 묘사 (꾸밈형 / 이어지는 형)
const EYES = [
  { id: 'round', name: '동그란', w: .95, h: 1.12, peak: .5, tilt: 0, lower: .9, iris: 1.05, lid: .08, base: { f: 70, m: 62 }, adn: '눈이 동글동글한', con: '눈이 동글동글하고' },
  { id: 'sharp', name: '날카로운', w: 1.05, h: .85, peak: .55, tilt: 5, lower: .2, iris: .9, lid: .25, base: { f: 64, m: 78 }, adn: '눈빛이 날카로운', con: '눈빛이 날카롭고' },
  { id: 'droop', name: '처진', w: 1, h: .95, peak: .35, tilt: -9, lower: .6, iris: .95, lid: .2, base: { f: 58, m: 60 }, adn: '눈꼬리가 처진', con: '눈꼬리가 처지고' },
  { id: 'narrow', name: '가는', w: 1, h: .75, peak: .5, tilt: 3, lower: .3, iris: .85, lid: .2, base: { f: 58, m: 64 }, adn: '눈이 가늘고 차분한', con: '눈이 가늘고 차분하며' },
  { id: 'puppy', name: '강아지', w: 1, h: 1.05, peak: .4, tilt: -6, lower: .7, iris: 1.05, lid: .12, base: { f: 76, m: 72 }, adn: '눈매가 순한', con: '눈매가 순하고' },
  { id: 'doe', name: '사슴', w: 1.05, h: 1.18, peak: .45, tilt: 0, lower: .8, iris: 1.1, lid: .1, base: { f: 82, m: 70 }, adn: '눈이 맑고 큰', con: '눈이 맑고 크며' },
  { id: 'almond', name: '아몬드', w: 1, h: 1, peak: .5, tilt: 2, lower: .5, iris: 1, lid: .15, base: { f: 74, m: 74 }, adn: '눈매가 또렷한', con: '눈매가 또렷하고' },
  { id: 'cat', name: '고양이', w: 1.02, h: .95, peak: .6, tilt: 9, lower: .4, iris: .98, lid: .18, base: { f: 78, m: 72 }, adn: '눈꼬리가 올라간', con: '눈꼬리가 올라가고' },
  { id: 'fox', name: '여우', w: 1.1, h: .82, peak: .62, tilt: 11, lower: .3, iris: .92, lid: .22, base: { f: 76, m: 70 }, adn: '눈매가 길고 가는', con: '눈매가 길고 가늘며' },
  { id: 'sleepy', name: '나른한', w: 1, h: .88, peak: .45, tilt: -2, lower: .5, iris: .95, lid: .35, base: { f: 62, m: 62 }, adn: '눈이 졸린 듯한', con: '눈이 졸린 듯하고' },
  { id: 'deep', name: '깊은', w: 1, h: .92, peak: .5, tilt: 3, lower: .5, iris: .95, lid: .3, base: { f: 66, m: 76 }, adn: '눈이 그윽한', con: '눈이 그윽하고' },
  { id: 'small', name: '작은', w: .85, h: .85, peak: .5, tilt: 0, lower: .5, iris: .9, lid: .15, base: { f: 54, m: 58 }, adn: '눈이 작은 편인', con: '눈이 작은 편이고' },
];
// 코 10종 (번호는 유전자 nose와 맞춤: 예전 0~7 + 낮은·큼직한). 매력 차이는 일부러 좁게(56~82)
const NOSES = [
  { id: 'straight', name: '반듯한', base: { f: 72, m: 74 }, adn: '코가 반듯한', con: '코가 반듯하고' },
  { id: 'soft', name: '둥근', base: { f: 66, m: 64 }, adn: '코가 둥글고 부드러운', con: '코가 둥글고 부드러우며' },
  { id: 'bridge', name: '콧대 높은', base: { f: 76, m: 82 }, adn: '콧대가 높은', con: '콧대가 높고' },
  { id: 'wide', name: '콧볼 넓은', base: { f: 62, m: 66 }, adn: '콧망울이 시원한', con: '콧망울이 시원하고' },
  { id: 'button', name: '단추', base: { f: 70, m: 60 }, adn: '코가 귀여운', con: '코가 귀엽고' },
  { id: 'neat', name: '작고 오똑', base: { f: 80, m: 76 }, adn: '코가 오똑한', con: '코가 오똑하고' },
  { id: 'long', name: '긴', base: { f: 58, m: 64 }, adn: '코가 긴 편인', con: '코가 긴 편이고' },
  { id: 'upturned', name: '코끝이 들린', base: { f: 64, m: 56 }, adn: '코끝이 살짝 들린', con: '코끝이 살짝 들리고' },
  { id: 'low', name: '낮은', base: { f: 60, m: 56 }, adn: '콧대가 낮은 편인', con: '콧대가 낮은 편이고' },
  { id: 'strong', name: '큼직한', base: { f: 56, m: 68 }, adn: '코가 큼직한', con: '코가 큼직하고' },
];
// 입 8종 (유전자 mouth 문자열 → 카탈로그), 눈썹 6종 (유전자 brow 0~7 → 카탈로그)
const MOUTHS = { bow: { f: 78, m: 72 }, full: { f: 76, m: 70 }, smile: { f: 74, m: 74 }, small: { f: 72, m: 60 }, neutral: { f: 66, m: 68 }, thin: { f: 58, m: 64 }, wide: { f: 62, m: 66 }, down: { f: 56, m: 62 } };
const MOUTH_OF = { line: 'neutral', flat: 'thin', pout: 'full', cat: 'smile' };
const BROWS = { softArch: { f: 76, m: 66 }, straight: { f: 70, m: 76 }, thick: { f: 62, m: 80 }, rising: { f: 68, m: 74 }, falling: { f: 64, m: 60 }, thin: { f: 66, m: 56 } };
const BROW_OF = ['straight', 'softArch', 'rising', 'thick', 'thin', 'softArch', 'falling', 'rising'];
const mouthId = m => MOUTH_OF[m] || m;
// 배치 이상값 [여, 남, 허용폭, 가중치] (4-1)
const IDEAL = {
  eyeY: [0, 0, .04, 1.2], eyeGap: [1, 1, .08, 1.2], eyeSize: [1.08, 1, .1, 1], eyeTilt: [3, 3, 6, .6], noseLen: [.94, 1, .1, .9],
  mouthY: [-.01, -.005, .02, 1], mouthW: [1, 1.05, .12, .6], faceLen: [.98, 1.02, .06, 1.1], jawW: [.86, .97, .07, 1.1], chinPoint: [.65, .45, .3, .6],
};
const near = (v, ideal, tol) => Math.exp(-.5 * ((v - ideal) / tol) ** 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// 조화 보정 (±6 이내, 4-3)
function harmony(g, sex, eyeId) {
  let h = 0;
  const nose = (NOSES[g.nose] || NOSES[0]).id, brow = BROW_OF[g.brow] || 'straight';
  if (g.eyeSize >= 1.1 && ['neat', 'button', 'soft'].includes(nose)) h += 3;
  if (g.faceLen >= 1.08 && ['small', 'narrow'].includes(eyeId)) h -= 3;
  if (['cat', 'fox', 'sharp'].includes(eyeId) && brow === 'rising') h += sex === 'm' ? 3 : 2;
  if (['puppy', 'droop'].includes(eyeId) && brow === 'falling') h += 2;
  if (g.jawW >= (sex === 'm' ? 1.02 : .96) && g.chinPoint >= .75) h -= 2;
  return clamp(h, -6, 6);
}
// 얼굴 점수: 배치 55% + 파츠 45%. o: { eye(눈 번호), aegyo(애교살) }
function layoutScore(g, sex) {
  let sum = 0, ws = 0;
  for (const k in IDEAL) { const [f, m, tol, w] = IDEAL[k]; sum += near(g[k], sex === 'f' ? f : m, tol) * w; ws += w; }
  return sum / ws * 100 - (g.asym || 0) * 12;
}
function partScore(g, sex, o = {}) {
  const E = EYES[o.eye ?? 6] || EYES[6], N = NOSES[g.nose] || NOSES[0], M = MOUTHS[mouthId(g.mouth)] || MOUTHS.neutral, B = BROWS[BROW_OF[g.brow] || 'straight'];
  return E.base[sex] * .55 + M[sex] * .18 + N.base[sex] * .14 + B[sex] * .13 + (o.aegyo ? 3 : 0) + 4 * near(g.irisK ?? 1, 1.05, .05);
}
function faceScore(g, sex, o = {}) {
  const eyeId = (EYES[o.eye ?? 6] || EYES[6]).id, lay = clamp(layoutScore(g, sex) + harmony(g, sex, eyeId), 0, 100), part = clamp(partScore(g, sex, o), 0, 100);
  return { layout: lay, parts: part, raw: lay * .55 + part * .45 };
}
// 등급: raw를 그대로 쓰지 않고 백분위로 (랜덤 얼굴 10,000개 분포의 기준점) — 수치를 고쳐도 등급 비율은 그대로
//   S 상위 1% / A 5% / B 15% / C 35% / D 60% / E 85% / F 나머지
const GRADE_TOP = [['S', .01], ['A', .05], ['B', .15], ['C', .35], ['D', .6], ['E', .85]];
let CUT = null;
function cutoffs() {
  if (CUT) return CUT;
  CUT = {};
  for (const sex of ['f', 'm']) {
    const r = rng('calib:' + sex), raws = [];
    for (let i = 0; i < 10000; i++) {
      const g = genes('calib:' + sex + ':' + i, sex, true), eye = g.eye != null ? g.eye : Math.floor(r() * EYES.length);
      raws.push(faceScore(g, sex, { eye, aegyo: r() < .35 }).raw);
    }
    raws.sort((a, b) => b - a);
    CUT[sex] = { cuts: GRADE_TOP.map(([L, p]) => [L, raws[Math.floor(p * raws.length)]]), raws };
  }
  return CUT;
}
function gradeOf(raw, sex) { for (const [L, v] of cutoffs()[sex === 'm' ? 'm' : 'f'].cuts) if (raw >= v) return L; return 'F'; }
// 등급 안에서의 위치 (0~1) — 능력치 숫자로 옮길 때
function gradePos(raw, sex) {
  const { cuts, raws } = cutoffs()[sex === 'm' ? 'm' : 'f'];
  let lo = 0, hi = raws.length;   // raws는 내림차순: raw 이상인 표본 수 = 위에서부터의 순위
  while (lo < hi) { const m = (lo + hi) >> 1; if (raws[m] >= raw) lo = m + 1; else hi = m; }
  const rank = lo / raws.length, i = cuts.findIndex(x => raw >= x[1]);
  const top = i > 0 ? GRADE_TOP[i - 1][1] : i === 0 ? 0 : GRADE_TOP[GRADE_TOP.length - 1][1], bot = i >= 0 ? GRADE_TOP[i][1] : 1;
  return clamp((bot - rank) / Math.max(1e-4, bot - top), 0, .999);   // 등급 안 백분위 위치 (0 = 바닥, 1 = 꼭대기)
}
// 배치 유전자를 이상값 쪽으로 bias만큼 당김 (원하는 등급의 얼굴을 빨리 찾기, 4-5)
function biasGenes(g, sex, bias) {
  if (!bias) return g;
  const o = Object.assign({}, g);
  for (const k in IDEAL) { const [f, m] = IDEAL[k]; o[k] = g[k] + ((sex === 'f' ? f : m) - g[k]) * bias; }
  o.asym = (g.asym || 0) * (1 - bias);
  return o;
}
// 인상 묘사 (5절): "눈꼬리가 올라가고 얼굴이 작은 여자. 눈에 띄는 얼굴이다." — 낮은 등급도 비하 표현 없이
const GRADE_LINE = { S: '지나가던 사람들이 돌아볼 만한 얼굴이다.', A: '눈에 띄는 얼굴이다.', B: '호감 가는 얼굴이다.', C: '평범한 얼굴이다.', D: '수수한 얼굴이다.', E: '수수한 얼굴이다.', F: '수수한 얼굴이다.' };
const MOLE_W = ['입가', '눈 밑', '볼', '턱'];
function words(g, o = {}) {
  const w = [], E = EYES[o.eye ?? 6] || EYES[6], N = NOSES[g.nose] || NOSES[0], sex = o.sex === 'm' ? 'm' : 'f';
  w.push([E.adn, E.con]);
  if (N.base[sex] >= 76 || N.base[sex] <= 58) w.push([N.adn, N.con]);   // 코는 인상적일 때만
  if (g.faceLen < .95 && g.jawW < (sex === 'm' ? .95 : .88)) w.push(['얼굴이 작은', '얼굴이 작고']);
  if (g.mouthY < -.02) w.push(['인중이 짧은', '인중이 짧고']);
  if (g.lipFull > 1.2) w.push(['입술이 도톰한', '입술이 도톰하고']);
  if (o.mole != null && o.mole >= 0) w.push([`${MOLE_W[o.mole]}에 점이 있는`, `${MOLE_W[o.mole]}에 점이 있고`]);
  return w.slice(0, 2);
}
function sentence(g, o = {}) {
  const w = words(g, o), noun = o.noun || (o.sex === 'm' ? '남자' : '여자');
  const head = w.length >= 2 ? `${w[0][1]} ${w[1][0]} ${noun}.` : w.length ? `${w[0][0]} ${noun}.` : `${noun}.`;
  return o.grade ? `${head} ${GRADE_LINE[o.grade]}` : head;
}

window.Face = { genes, forAge, distance, traits, RANGE, SHAPE_LABEL, ARCH, EYES, NOSES, MOUTHS, BROWS, BROW_OF, mouthId, IDEAL,
  faceScore, layoutScore, partScore, harmony, cutoffs, gradeOf, gradePos, biasGenes, words, sentence, GRADE_LINE };
})();
