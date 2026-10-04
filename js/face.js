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
  { id: 'round', name: '동그란', w: .95, h: 1.12, peak: .5, tilt: 0, lower: .9, iris: 1.05, lid: .08, base: { f: 72, m: 64 }, adn: '눈이 동글동글한', con: '눈이 동글동글하고' },
  { id: 'sharp', name: '날카로운', w: 1.05, h: .85, peak: .55, tilt: 5, lower: .2, iris: .9, lid: .25, base: { f: 66, m: 80 }, adn: '눈빛이 날카로운', con: '눈빛이 날카롭고' },
  { id: 'droop', name: '처진', w: 1, h: .95, peak: .35, tilt: -9, lower: .6, iris: .95, lid: .2, base: { f: 62, m: 62 }, adn: '눈꼬리가 처진', con: '눈꼬리가 처지고' },
  { id: 'narrow', name: '가는', w: 1, h: .75, peak: .5, tilt: 3, lower: .3, iris: .85, lid: .2, base: { f: 60, m: 66 }, adn: '눈이 가늘고 차분한', con: '눈이 가늘고 차분하며' },
  { id: 'puppy', name: '강아지', w: 1, h: 1.05, peak: .4, tilt: -6, lower: .7, iris: 1.05, lid: .12, base: { f: 78, m: 72 }, adn: '눈매가 순한', con: '눈매가 순하고' },
  { id: 'doe', name: '사슴', w: 1.05, h: 1.18, peak: .45, tilt: 0, lower: .8, iris: 1.1, lid: .1, base: { f: 84, m: 70 }, adn: '눈이 맑고 큰', con: '눈이 맑고 크며' },
  { id: 'almond', name: '아몬드', w: 1, h: 1, peak: .5, tilt: 2, lower: .5, iris: 1, lid: .15, base: { f: 78, m: 78 }, adn: '눈매가 또렷한', con: '눈매가 또렷하고' },
  { id: 'cat', name: '고양이', w: 1.02, h: .95, peak: .6, tilt: 9, lower: .4, iris: .98, lid: .18, base: { f: 80, m: 74 }, adn: '눈꼬리가 올라간', con: '눈꼬리가 올라가고' },
  { id: 'fox', name: '여우', w: 1.1, h: .82, peak: .62, tilt: 11, lower: .3, iris: .92, lid: .22, base: { f: 76, m: 72 }, adn: '눈매가 길고 가는', con: '눈매가 길고 가늘며' },
  { id: 'sleepy', name: '나른한', w: 1, h: .88, peak: .45, tilt: -2, lower: .5, iris: .95, lid: .35, base: { f: 66, m: 64 }, adn: '눈이 졸린 듯한', con: '눈이 졸린 듯하고' },
  { id: 'deep', name: '깊은', w: 1, h: .92, peak: .5, tilt: 3, lower: .5, iris: .95, lid: .3, base: { f: 70, m: 78 }, adn: '눈이 그윽한', con: '눈이 그윽하고' },
  { id: 'small', name: '작은', w: .85, h: .85, peak: .5, tilt: 0, lower: .5, iris: .9, lid: .15, base: { f: 56, m: 60 }, adn: '눈이 작은 편인', con: '눈이 작은 편이고' },
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
const MOUTHS = { bow: { f: 80, m: 72 }, full: { f: 78, m: 68 }, smile: { f: 74, m: 76 }, small: { f: 74, m: 62 }, neutral: { f: 66, m: 72 }, thin: { f: 58, m: 66 }, wide: { f: 62, m: 66 }, down: { f: 56, m: 62 } };
const MOUTH_OF = { line: 'neutral', flat: 'thin', pout: 'full', cat: 'smile' };
const BROWS = { softArch: { f: 80, m: 66 }, straight: { f: 72, m: 78 }, thick: { f: 58, m: 80 }, rising: { f: 70, m: 74 }, falling: { f: 64, m: 62 }, thin: { f: 68, m: 56 } };
const BROW_OF = ['straight', 'softArch', 'rising', 'thick', 'thin', 'softArch', 'falling', 'rising'];
const mouthId = m => MOUTH_OF[m] || m;
const SHAPE_ID = ['round', 'square', 'slim', 'oval', 'long', 'heart'];

/* ---------- 외모 매력 기준 (BEAUTY) ----------
   웹툰 속 미인·미남의 공통점을 다섯 축으로 나눔. 합 100점 → 성별마다 백분위로 등급 (S 1% … F)
   1) 윤곽 25  얼굴형 + 턱 폭·턱끝·얼굴 길이·광대       여: 갸름한 V라인(좁은 턱, 뾰족한 턱끝, 조금 짧은 얼굴) / 남: 각이 살아 있는 턱선, 조금 긴 얼굴
   2) 비율 25  눈 높이·눈 사이(눈 하나 폭)·코 길이·인중·입 폭(눈동자 사이)·눈썹과 눈 사이
              여: 눈이 얼굴 가운데보다 살짝 아래, 짧은 코·짧은 인중, 작은 입, 눈썹이 눈에서 조금 떨어짐 / 남: 눈썹이 눈에 가깝고 코가 조금 김
   3) 눈 25   눈 종류 + 크기 + 눈꼬리 + 눈동자 크기 (+ 여자 애교살)   여: 크고 맑은 눈 / 남: 또렷하고 깊은 눈
   4) 코·입·눈썹 15  종류 + 코 폭·입술 두께·눈썹 굵기          여: 좁은 콧볼, 도톰한 입술, 가늘고 부드러운 눈썹 / 남: 높은 콧대, 얇은 입술, 진한 일자 눈썹
   5) 조화 10  좌우 대칭 + 인상 유형 하나로 파츠가 모였는지 (청순·고혹·귀염·시크 / 훈남·조각·꽃미남·시크)
              — 미인은 한 가지 얼굴이 아니라서, 고양이 눈도 강아지 눈도 그 유형으로 잘 모이면 최고점까지 감
   공정성: 피부색·쌍꺼풀 종류(무쌍·속쌍·겉쌍)는 점수에 안 들어감. 모든 파츠가 어느 유형엔 속해 있어 어떤 파츠로도 S가 나옴 */
// 배치 이상값 [여, 남, 허용폭, 축 안 가중치, 축] — 이상값에서 허용폭만큼 벗어나면 그 항목은 약 61%
const IDEAL = {
  jawW: [.83, .97, .06, 25, 'contour'], chinPoint: [.8, .45, .25, 20, 'contour'], faceLen: [.97, 1.03, .05, 15, 'contour'], cheekW: [.98, 1, .05, 10, 'contour'],
  eyeGap: [1, 1, .07, 22, 'ratio'], eyeY: [.012, 0, .035, 18, 'ratio'], noseLen: [.91, .98, .08, 18, 'ratio'], mouthY: [-.012, -.006, .02, 16, 'ratio'], mouthW: [.93, 1.02, .1, 14, 'ratio'], browY: [.012, -.012, .025, 12, 'ratio'],
  eyeSize: [1.15, .98, .09, 25, 'eyes'], eyeTilt: [4, 3, 6, 10, 'eyes'], irisK: [1.06, 1.04, .05, 10, 'eyes'],
  noseW: [.87, .98, .1, 0, 'parts'], lipFull: [1.18, .95, .15, 0, 'parts'], browThick: [.9, 1.35, .28, 0, 'parts'],
};
const SHAPE_SCORE = { f: { oval: 1, slim: 1, heart: .95, round: .78, long: .62, square: .56 }, m: { square: 1, oval: .96, slim: .9, long: .86, heart: .74, round: .66 } };
// 인상 유형: 파츠 다섯(눈·눈썹·코·입·얼굴형)이 한 유형에 몇 개 모였는지
const TYPES = {
  f: {
    청순: { word: '청순한', eye: ['doe', 'round', 'puppy', 'almond', 'droop'], brow: ['softArch', 'straight'], nose: ['neat', 'button', 'soft', 'straight'], mouth: ['small', 'bow', 'smile'], shape: ['oval', 'slim', 'round'] },
    고혹: { word: '고혹적인', eye: ['cat', 'fox', 'almond', 'deep', 'sleepy'], brow: ['rising', 'softArch'], nose: ['bridge', 'neat', 'straight'], mouth: ['full', 'bow', 'wide'], shape: ['slim', 'heart', 'oval'] },
    귀염: { word: '귀여운', eye: ['round', 'puppy', 'doe', 'small', 'droop'], brow: ['softArch', 'thin', 'falling'], nose: ['button', 'upturned', 'soft', 'wide'], mouth: ['small', 'smile', 'full'], shape: ['round', 'heart', 'oval'] },
    시크: { word: '시크한', eye: ['sharp', 'narrow', 'fox', 'almond', 'deep', 'sleepy'], brow: ['straight', 'rising', 'thick'], nose: ['bridge', 'straight', 'long', 'low'], mouth: ['neutral', 'thin', 'small', 'down'], shape: ['slim', 'long', 'oval', 'square'] },
  },
  m: {
    훈남: { word: '훈훈한', eye: ['puppy', 'droop', 'round', 'almond', 'doe'], brow: ['straight', 'softArch', 'falling'], nose: ['straight', 'soft', 'wide', 'button'], mouth: ['smile', 'neutral', 'wide'], shape: ['oval', 'round', 'square'] },
    조각: { word: '조각 같은', eye: ['sharp', 'deep', 'almond'], brow: ['thick', 'straight', 'rising'], nose: ['bridge', 'strong', 'straight'], mouth: ['neutral', 'thin', 'down'], shape: ['square', 'long', 'oval'] },
    꽃미남: { word: '곱상한', eye: ['doe', 'almond', 'cat', 'round', 'small'], brow: ['softArch', 'straight', 'thin'], nose: ['neat', 'bridge', 'upturned'], mouth: ['bow', 'small', 'full'], shape: ['slim', 'oval', 'heart'] },
    시크: { word: '시크한', eye: ['fox', 'narrow', 'sharp', 'sleepy', 'cat'], brow: ['straight', 'rising'], nose: ['bridge', 'long', 'low', 'straight'], mouth: ['thin', 'neutral', 'small'], shape: ['long', 'slim', 'square'] },
  },
};
// 최고 미녀·미남 설계 (BEAUTY): 유형마다 파츠 후보 + 배치 이상값 근처의 범위 — beauty()가 시드로 하나씩 골라 S 상위 얼굴을 만듦
//   eye: 눈 번호(EYES), brow: 유전자 눈썹 번호(BROW_OF), nose: 코 번호, mouth: 유전자 입, shape: 얼굴형 번호(0 둥근 1 각진 2 갸름 3 계란 4 긴 5 하트)
const BEAUTY = {
  f: {
    청순: { eye: [5, 6, 4], brow: [1, 5], nose: [5, 4], mouth: ['bow', 'small'], shape: [3, 2], tilt: [1, 4], size: [1.15, 1.2], lipFull: [1.12, 1.22] },
    고혹: { eye: [7, 8, 6], brow: [5, 1, 7], nose: [2, 5], mouth: ['pout', 'bow'], shape: [2, 5], tilt: [5, 8], size: [1.1, 1.16], lipFull: [1.28, 1.38] },
    귀염: { eye: [4, 0, 5], brow: [1, 4], nose: [4, 7], mouth: ['small', 'smile', 'pout'], shape: [5, 3], tilt: [-2, 2], size: [1.17, 1.22], lipFull: [1.15, 1.25], eyeY: [.018, .026] },
    시크: { eye: [6, 8, 1], brow: [0, 7], nose: [2, 0], mouth: ['line', 'small'], shape: [2, 3], tilt: [4, 7], size: [1.08, 1.14], lipFull: [1.02, 1.12] },
  },
  m: {
    훈남: { eye: [4, 6, 0], brow: [0, 1], nose: [0, 1], mouth: ['smile', 'line'], shape: [3, 1], tilt: [-2, 2], size: [.98, 1.03], lipFull: [.92, 1] },
    조각: { eye: [1, 10, 6], brow: [3, 0], nose: [2, 9], mouth: ['line', 'flat'], shape: [1, 4], tilt: [3, 6], size: [.94, 1], lipFull: [.86, .95] },
    꽃미남: { eye: [5, 6, 7], brow: [1, 0], nose: [5, 2], mouth: ['bow', 'small'], shape: [2, 3], tilt: [1, 4], size: [1, 1.05], lipFull: [.98, 1.08] },
    시크: { eye: [8, 3, 1], brow: [0, 7], nose: [2, 6], mouth: ['flat', 'line'], shape: [4, 2], tilt: [5, 8], size: [.94, .99], lipFull: [.86, .94] },
  },
};
const near = (v, ideal, tol) => Math.exp(-.5 * ((v - ideal) / tol) ** 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// 가장 잘 맞는 인상 유형 { id, word, fit 0~1 }
function typeOf(g, sex, eyeId) {
  const T = TYPES[sex === 'm' ? 'm' : 'f'], parts = { eye: eyeId, brow: BROW_OF[g.brow] || 'straight', nose: (NOSES[g.nose] || NOSES[0]).id, mouth: mouthId(g.mouth), shape: SHAPE_ID[g.shape] || 'oval' };
  let best = null;
  for (const id in T) { const t = T[id]; let n = 0; for (const k in parts) if (t[k].includes(parts[k])) n++; if (!best || n > best.n) best = { id, word: t.word, n }; }
  return { id: best.id, word: best.word, fit: best.n / 5 };
}
// 축마다 0~100
function axisScore(g, sex, axis) {
  let sum = 0, ws = 0;
  for (const k in IDEAL) { const [f, m, tol, w, ax] = IDEAL[k]; if (ax !== axis || !w) continue; sum += near(g[k] ?? (sex === 'f' ? f : m), sex === 'f' ? f : m, tol) * w; ws += w; }
  return ws ? sum / ws * 100 : 100;
}
const idealNear = (g, sex, k) => { const [f, m, tol] = IDEAL[k]; return near(g[k] ?? (sex === 'f' ? f : m), sex === 'f' ? f : m, tol); };
function contourScore(g, sex) { return (SHAPE_SCORE[sex][SHAPE_ID[g.shape] || 'oval'] || .7) * 30 + axisScore(g, sex, 'contour') * .7; }
function eyeScore(g, sex, o = {}) {
  const E = EYES[o.eye ?? 6] || EYES[6];
  return clamp(E.base[sex] * .55 + axisScore(g, sex, 'eyes') * .45 + (sex === 'f' && o.aegyo ? 3 : 0) + (sex === 'f' && g.lashN ? 1.5 : 0), 0, 100);
}
function featureScore(g, sex) {   // 코·입·눈썹: 종류 60% + 폭·두께 40%
  const N = NOSES[g.nose] || NOSES[0], M = MOUTHS[mouthId(g.mouth)] || MOUTHS.neutral, B = BROWS[BROW_OF[g.brow] || 'straight'];
  return (N.base[sex] * .6 + idealNear(g, sex, 'noseW') * 40) * .35 + (M[sex] * .6 + idealNear(g, sex, 'lipFull') * 40) * .35 + (B[sex] * .6 + idealNear(g, sex, 'browThick') * 40) * .3;
}
function harmony(g, sex, eyeId) {   // 0~100: 대칭 30 + 인상 유형 70
  return clamp((1 - (g.asym || 0) / .7) * 30, 0, 30) + typeOf(g, sex, eyeId).fit * 70;
}
// 예전 이름 유지: layoutScore = 윤곽·비율, partScore = 눈·코·입·눈썹
function layoutScore(g, sex) { return (contourScore(g, sex) + axisScore(g, sex, 'ratio')) / 2; }
function partScore(g, sex, o = {}) { return eyeScore(g, sex, o) * 25 / 40 + featureScore(g, sex) * 15 / 40; }
// 얼굴 점수: 윤곽 25 + 비율 25 + 눈 25 + 코·입·눈썹 15 + 조화 10
function faceScore(g, sex, o = {}) {
  sex = sex === 'm' ? 'm' : 'f';
  const E = EYES[o.eye ?? 6] || EYES[6], contour = contourScore(g, sex), ratio = axisScore(g, sex, 'ratio'), eyes = eyeScore(g, sex, o), feat = featureScore(g, sex), har = harmony(g, sex, E.id);
  const raw = contour * .25 + ratio * .25 + eyes * .25 + feat * .15 + har * .1;
  return { contour, ratio, eyes, features: feat, harmony: har, type: typeOf(g, sex, E.id), layout: (contour + ratio) / 2, parts: eyes * 25 / 40 + feat * 15 / 40, raw };
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
  for (const k in IDEAL) { const [f, m] = IDEAL[k]; if (g[k] != null) o[k] = g[k] + ((sex === 'f' ? f : m) - g[k]) * bias; }
  o.asym = (g.asym || 0) * (1 - bias);
  return o;
}
// 유형·시드로 설계한 얼굴 유전자 (배치는 이상값에서 허용폭의 ±25% 안, 파츠는 그 유형 후보에서)
function beautyGenes(type, sex, seed) {
  sex = sex === 'm' ? 'm' : 'f';
  const B = BEAUTY[sex][type] || Object.values(BEAUTY[sex])[0], r = rng('beauty:' + sex + ':' + type + ':' + seed), pk = l => l[Math.floor(r() * l.length)], rg = ([a, b]) => a + (b - a) * r();
  const g = { asym: 0, lashN: sex === 'f' ? 3 : 0, marks: {} };
  for (const k in IDEAL) { const [f, m, tol] = IDEAL[k]; g[k] = (sex === 'f' ? f : m) + (r() - .5) * tol * .5; }
  Object.assign(g, { eye: pk(B.eye), brow: pk(B.brow), nose: pk(B.nose), mouth: pk(B.mouth), shape: pk(B.shape), eyeTilt: rg(B.tilt), eyeSize: rg(B.size), lipFull: rg(B.lipFull) });
  if (B.eyeY) g.eyeY = rg(B.eyeY);
  return g;
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
// S·A는 인상 유형이 뚜렷하면(파츠 3개 이상이 한 유형) 그 말을 붙임: "… 지나가던 사람들이 돌아볼 만한 청순한 미인이다."
const TOP_LINE = { S: (w, m) => `지나가던 사람들이 돌아볼 만한 ${w} ${m ? '미남' : '미인'}이다.`, A: w => `눈에 띄는 ${w} 얼굴이다.` };
function sentence(g, o = {}) {
  const w = words(g, o), noun = o.noun || (o.sex === 'm' ? '남자' : '여자');
  const head = w.length >= 2 ? `${w[0][1]} ${w[1][0]} ${noun}.` : w.length ? `${w[0][0]} ${noun}.` : `${noun}.`;
  if (!o.grade) return head;
  const t = o.type && o.type.fit >= .6 && TOP_LINE[o.grade];
  return `${head} ${t ? t(o.type.word, o.sex === 'm') : GRADE_LINE[o.grade]}`;
}

window.Face = { genes, forAge, distance, traits, RANGE, SHAPE_LABEL, SHAPE_ID, ARCH, EYES, NOSES, MOUTHS, BROWS, BROW_OF, mouthId, IDEAL, SHAPE_SCORE, TYPES, typeOf, BEAUTY, beautyGenes,
  faceScore, layoutScore, partScore, harmony, cutoffs, gradeOf, gradePos, biasGenes, words, sentence, GRADE_LINE };
})();
