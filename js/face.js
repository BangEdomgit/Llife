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
  return g;
}

// 나이 보정 (그릴 때마다): 어릴수록 눈이 크고 낮고 코는 점, 나이 들수록 입술이 얇고 턱이 처지고 눈이 덮임
function forAge(g, age, eyeOf) {
  const o = Object.assign({}, g);
  if (age <= 6) Object.assign(o, { shape: 0, eyeSize: g.eyeSize * 1.25, eyeY: g.eyeY + .05, nose: 5, mouth: 'small', chinPoint: 0, faceLen: 1, jawW: .95 });
  else if (age <= 12) Object.assign(o, { eyeSize: g.eyeSize * 1.15, nose: g.nose % 2 ? 5 : 4, chinPoint: g.chinPoint * .4, faceLen: Math.min(g.faceLen, 1.02) });
  else if (age <= 18) o.eyeSize = g.eyeSize * 1.05;
  else if (age >= 55) {
    o.lipFull = g.lipFull * .75; o.faceLen = g.faceLen + .03;
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

window.Face = { genes, forAge, distance, traits, RANGE, SHAPE_LABEL, ARCH };
})();
