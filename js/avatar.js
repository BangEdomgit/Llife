// 사람 아바타 — 파츠(얼굴·머리·눈·입·옷…)를 조합해 SVG 문자열로 그림. 외부 이미지 없음
// Avatar.make(seed, gender, opt)    → appearance (파츠 번호 묶음). 같은 seed면 늘 같은 얼굴
// Avatar.render(appearance, size, state) → SVG 문자열 (상반신: 가로 size, 세로 size×4/3 / 전신: 세로 size×7/3)
//   state: 나이(숫자) 또는 { age, after: { sat, personality, lipstick }, full: true | 수치, personality, expr }
//     full: 옷 입은 전신. 수치 { height, waist, hip, cup, under, shoulder, bust }를 주면 20살부터 체형에 반영
//     personality / pose: 전신 자세 (직진형·낙천형 한 손 허리 / 냉철형·무심형 팔짱 / 그 외 차렷), guides: 앵커 가이드선
//     expr: 눈썹 표정 ('angry' | 'surprised' | 'sad')
//   상반신: 머리 좌표(정수리~턱 77) 그대로 머리·어깨만
//   전신: 모두 같은 틀(0 0 120 280)·바닥선·cm당 px → 키가 그대로 보임. 등신은 나이별(3살 1:3 → 어른 1:5.5),
//     몸은 앵커 폭(둘레 cm에서 계산, 어른은 평균과의 차를 1.8배 과장)을 곡선으로 잇고, 옷은 몸 + 여유분. 머리는 머리 좌표를 줄여서 얹음
//   체형 수치(컵·허리·골반·어깨)는 20살부터만. 10대는 성별 평균 체형만, 어린이는 일자 몸
//   Avatar.anchors(appearance, age, 수치) → 전신 앵커 (test.html 비교용)
//   make()가 만든 값은 그대로 두고, 홍채색·시선·앞머리·입술색·신발 같은 세부는 그 값에서 매번 똑같이 뽑음 (저장 안 함)
(function () {
'use strict';

/* ---------- 시드 난수 ---------- */
function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let s = hash(String(seed));
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = v => Math.round(v * 10) / 10;
const P = (x, y) => `${f1(x)},${f1(y)}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
function lerpTable(tbl, v) {
  if (v <= tbl[0][0]) return tbl[0][1];
  for (let i = 1; i < tbl.length; i++) if (v <= tbl[i][0]) { const [x0, y0] = tbl[i - 1], [x1, y1] = tbl[i]; return y0 + (y1 - y0) * (v - x0) / (x1 - x0); }
  return tbl[tbl.length - 1][1];
}
let UID = 0;   // clipPath id (그릴 때마다 새로)

/* ---------- 팔레트 ---------- */
// 피부 4톤: 밝은, 보통, 어두운, 진한
const SKIN = ['#f7dcc5', '#e9bf98', '#c68b60', '#8b5a3c'];
// 머리색: 검정, 갈색, 밝은 갈색, 회색(나이 들면), 염색(와인), 염색(애쉬 금발)
const HAIR = ['#23201f', '#4b3022', '#7d5536', '#a19d98', '#7e3343', '#c9a66c'];
const GRAY = 3;
const TOP_COLORS = ['#4f6d8f', '#9a4f5f', '#5f8f6a', '#d0a443', '#ece7dd', '#3b3e48', '#8a6fb0', '#d9784a', '#6aa3c8', '#7a8a5a'];
const UNIFORM = { blazer: '#2f3a5a', shirt: '#f3f1ec', tie: ['#9b2f3a', '#2c4a7a', '#3d6b4a'], skirt: '#3b4766' };
const LINE = '#33241f';
const IRIS = ['#2b1d16', '#5b3a26', '#8a5c38'];             // 검정, 갈색, 밝은 갈색
const WHITE = '#fbf8f4', PUPIL = '#120c09', MOUTH_IN = '#7a2f33';
const LIPS = ['#d4707a', '#c9606b', '#b8434f', '#e0898f'];   // 어른 여자 립 색
const NATURAL_LIP = ['#e0a49b', '#cf8f80', '#a9654f', '#7d4535'];

const shade = (hex, k) => {   // k<1 어둡게, k>1 밝게
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('');
};

/* ---------- 생김새 만들기 ---------- */
const STYLE_N = 6, FACE_N = 3, EYE_N = 4, BROW_N = 3, MOUTH_N = 4, TOP_N = 4;
function make(seed, gender, opt = {}) {
  const r = rng(seed), n = k => Math.floor(r() * k);
  const f = opt.feature || '';
  const dyed = r() < .14;
  const a = {
    g: gender === 'f' ? 'f' : 'm',
    face: n(FACE_N),
    skin: opt.skin != null ? opt.skin : [0, 0, 1, 1, 1, 1, 2, 3][n(8)],
    hair: gender === 'f' ? n(STYLE_N) : [0, 0, 0, 1, 2, 2, 3, 3, 3, 4, 5][n(11)],   // 남자는 장발·묶은 머리가 드묾
    hc: dyed ? 4 + n(2) : [0, 0, 0, 1, 1, 2][n(6)],
    eyes: n(EYE_N), brows: n(BROW_N), mouth: n(MOUTH_N),
    glasses: f.includes('안경') ? 1 + n(2) : 0,
    top: n(TOP_N), tc: n(TOP_COLORS.length), tie: n(UNIFORM.tie.length),
    gray: Math.round(r() * 100) / 100,   // 흰머리가 나기 시작하는 정도 (작을수록 일찍)
    blush: r() < .35,
  };
  if (f.includes('주근깨')) a.freckles = true;
  if (f.includes('보조개')) a.dimples = true;
  if (f.includes('눈썹')) a.thick = true;
  if (f.includes('이어폰')) a.buds = true;
  if (f.includes('키가')) a.tall = true;
  // 체형 — 키·체격, 여자는 가슴, 남자는 어깨
  const pickW = w => { let t = r() * w.reduce((x, y) => x + y[1], 0); for (const [k, v] of w) { t -= v; if (t <= 0) return k; } return w[0][0]; };
  a.body = {
    height: a.tall ? 'tall' : pickW([['short', 3], ['avg', 5], ['tall', 3]]),
    build: pickW([['slim', 3], ['avg', 4], ['fit', 2], ['chubby', 1.2]]),
  };
  if (a.g === 'f') a.body.chest = pickW([['small', 3], ['avg', 5], ['large', 2.5]]);
  else a.body.shoulder = pickW([['narrow', 2.5], ['avg', 5], ['wide', 3]]);
  return a;
}
// 세부 — make() 값에서 늘 똑같이 나옴 (예전 저장의 얼굴도 그대로 살아남)
function extras(a) {
  const r = rng('x' + [a.g, a.face, a.skin, a.hair, a.hc, a.eyes, a.brows, a.mouth, a.top, a.tc, a.tie, a.gray].join(','));
  const n = k => Math.floor(r() * k);
  return { iris: n(3), gaze: [0, 0, 0, -1, 1][n(5)], bang: n(4), lip: n(LIPS.length), teeth: r() < .55, shoe: r(), pants: r(), hem: r() };
}

/* ---------- 얼굴 ---------- */
const FACES = [
  'M33,68 C33,46 45,38 60,38 C75,38 87,46 87,68 C87,88 76,101 60,101 C44,101 33,88 33,68 Z',                       // 둥근형
  'M34,63 C34,45 46,38 60,38 C74,38 86,45 86,63 L86,80 C86,92 76,100 60,100 C44,100 34,92 34,80 Z',                  // 각진형
  'M35,66 C35,46 46,38 60,38 C74,38 85,46 85,66 C85,82 74,97 60,103 C46,97 35,82 35,66 Z',                            // 갸름형
];
// 눈 모양: 안쪽 꼬리(i), 바깥 꼬리(o), 윗꺼풀(u)·아랫꺼풀(l) 조절점, 홍채 반지름 (side: 왼눈 -1 / 오른눈 1)
function eyeShape(t, x, y, s) {
  if (t === 1) return { i: [x - 5.4 * s, y + .9], o: [x + 5.8 * s, y - 2.1], u: [x - .4 * s, y - 6.4], l: [x + .8 * s, y + 3.8], ir: [2.8, 3.3] };   // 날카로운: 눈꼬리 올라감, 가는 홍채
  if (t === 2) return { i: [x - 5.4 * s, y - .9], o: [x + 5.9 * s, y + 1.9], u: [x + .6 * s, y - 6.8], l: [x, y + 4.6], ir: [3.7, 3.8] };   // 처진: 눈꼬리 내려감, 큰 홍채
  if (t === 3) return { i: [x - 5.9 * s, y + .4], o: [x + 5.9 * s, y - .3], u: [x, y - 3.8], l: [x, y + 2.8], ir: [2.4, 2.4] };              // 가는: 가로로 긴 슬릿
  return { i: [x - 5.8 * s, y + .7], o: [x + 5.8 * s, y + .4], u: [x, y - 7.2], l: [x, y + 5.4], ir: [3.5, 3.6] };                           // 동그란
}
const qAt = (p0, c, p2, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1]];
// 속눈썹: 윗꺼풀 바깥쪽 끝에 짧은 곡선 (여자 2~3개, 남자아이 1개)
function lashes(e, s, n) {
  let d = '';
  for (let k = 0; k < n; k++) {
    const p = qAt(e.i, e.u, e.o, .98 - k * .14);
    d += `M${P(p[0], p[1])} q${f1(1.3 * s)},${f1(-.4 - k * .5)} ${f1(2.3 * s)},${f1(-1.3 - k * .7)} `;
  }
  return `<path d="${d}" fill="none" stroke="${LINE}" stroke-width=".95" stroke-linecap="round"/>`;
}
function openEye(a, X, x, y, s, nLash) {
  const e = eyeShape(a.eyes, x, y, s), id = `av${UID}e${s > 0 ? 'r' : 'l'}`;
  const shape = `M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)} Q${P(...e.l)} ${P(...e.i)} Z`;
  const gx = x + X.gaze * 1.2, gy = y + .5, irC = IRIS[X.iris];
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/>
    <g clip-path="url(#${id})"><ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="${e.ir[0]}" ry="${e.ir[1]}" fill="${irC}"/>
      <ellipse cx="${f1(gx)}" cy="${f1(gy + .3)}" rx="${f1(e.ir[0] * .5)}" ry="${f1(e.ir[1] * .5)}" fill="${PUPIL}"/>
      <circle cx="${f1(gx + 1.3)}" cy="${f1(gy - 1.4)}" r="1.4" fill="#fff"/><circle cx="${f1(gx - 1.1)}" cy="${f1(gy + 1.5)}" r=".6" fill="#fff" opacity=".8"/>
      <path d="M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)}" fill="none" stroke="${PUPIL}" stroke-width="3.4" opacity=".14"/></g>
    <path d="M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width="2.3" stroke-linecap="round"/>
    <path d="M${P(...e.i)} Q${P(...e.l)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width=".8" opacity=".3"/>${nLash ? lashes(e, s, nLash) : ''}`;
}
// 감은 눈 (다음 날 아침): 나른하게 / 웃으며
const SLEEPY = (x, y, s, nl) => `<path d="M${x - 4.8},${y - .5} Q${x},${y + 3} ${x + 4.8},${y - .5}" fill="none" stroke="${LINE}" stroke-width="2.1" stroke-linecap="round"/>` +
  (nl ? `<path d="M${f1(x + 4.6 * s)},${y - .4} l${f1(1.8 * s)},1.4 M${f1(x + 3.4 * s)},${y + .8} l${f1(1.2 * s)},1.6" stroke="${LINE}" stroke-width="1" stroke-linecap="round"/>` : '');
const HAPPY = (x, y) => `<path d="M${x - 4.6},${y + 1.6} Q${x},${y - 3.6} ${x + 4.6},${y + 1.6}" fill="none" stroke="${LINE}" stroke-width="2.3" stroke-linecap="round"/>`;
// 눈썹 3종 (일자·아치·각진) + 표정 (화남: 안쪽이 내려감 / 놀람: 올라감 / 슬픔: 바깥쪽이 내려감)
function brow(type, x, y, s, expr) {
  let inY = y, midY = y, outY = y, mx = x;
  if (type === 0) { inY = y + .6; midY = y - .3; outY = y; }
  else if (type === 1) { inY = y + 1.2; midY = y - 3; outY = y + 1.4; }
  else { inY = y + 1.6; midY = y - 2.8; outY = y + .6; mx = x + 2.2 * s; }
  if (expr === 'angry') { inY += 2.8; midY += .8; }
  else if (expr === 'surprised') { inY -= 2.6; midY -= 3; outY -= 2.2; }
  else if (expr === 'sad') { inY -= 2.2; outY += 1.8; }
  const ix = x - 6 * s, ox = x + 6.4 * s;
  return type === 2 ? `M${P(ix, inY)} L${P(mx, midY)} L${P(ox, outY)}` : `M${P(ix, inY)} Q${P(mx, midY)} ${P(ox, outY)}`;
}
// 입 4종 (보통·웃는·무표정·약간 벌린). 윗입술 선 + 아랫입술 두 줄, 여자는 입술 색
function mouthSVG(type, lip, female) {
  const lo = female ? .95 : .5;
  if (type === 1) return lip.teeth
    ? `<path d="M52.5,86.4 Q60,95.6 67.5,86.4 Q60,89.2 52.5,86.4 Z" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.3" stroke-linejoin="round"/><path d="M54.6,87.5 Q60,89.6 65.4,87.5 L64.8,89.1 Q60,90.8 55.2,89.1 Z" fill="#fbf7f2"/>`
    : `<path d="M53,86.8 Q60,93.8 67,86.8" fill="none" stroke="${LINE}" stroke-width="1.9" stroke-linecap="round"/><path d="M56,90.8 Q60,92.8 64,90.8" fill="none" stroke="${lip.c}" stroke-width="1.7" stroke-linecap="round" opacity="${lo}"/>`;
  if (type === 2) return `<path d="M55,88.8 L65,88.8" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/><path d="M56.6,90 Q60,92.2 63.4,90" fill="none" stroke="${lip.c}" stroke-width="1.6" stroke-linecap="round" opacity="${lo}"/>`;
  if (type === 3) return `<path d="M55.4,87 Q60,85.8 64.6,87 Q64.2,93.6 60,93.6 Q55.8,93.6 55.4,87 Z" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="60" cy="92" rx="2.6" ry="1.2" fill="#c96a6e" opacity=".8"/>`;
  return (female ? `<path d="M54.6,88 Q57.2,86.2 60,87.5 Q62.8,86.2 65.4,88 Q60,89.3 54.6,88 Z" fill="${lip.c}"/>` : '') +
    `<path d="M54,88.2 Q60,89.9 66,88.2" fill="none" stroke="${LINE}" stroke-width="1.7" stroke-linecap="round"/><path d="M56,89.5 Q60,93.2 64,89.5 Q60,90.5 56,89.5 Z" fill="${lip.c}" opacity="${lo}"/>`;
}
const FROWN = `<path d="M54,90 Q60,86 66,90" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`;

/* ---------- 머리 ---------- */
// 윗머리(돔) + 앞머리(이마를 덮는 모양, 따로) + 옆머리(얼굴 옆으로 내려옴) + 뒷머리(얼굴 뒤) + 묶음
// w: 돔 반폭(얼굴보다 5~8 넓게), ys: 옆머리가 내려오는 높이, bangs: 이 스타일에서 나올 수 있는 앞머리
const STYLES = {
  m: [
    { w: 31.5, ys: 66, bangs: ['up', 'side', 'side', 'up'] },                                   // 짧은
    { w: 29.5, ys: 62, bangs: ['up'], buzz: true },                                              // 반삭
    { w: 31, ys: 57, bangs: ['side', 'up'], block: true, crown: 2 },                            // 투블럭
    { w: 33, ys: 70, bangs: ['low'] },                                                           // 덮은
    { w: 33.5, ys: 74, bangs: ['center', 'side'], back: 'manLong', locks: 'manLong' },         // 장발
    { w: 31.5, ys: 64, bangs: ['up'], bun: 'top', wisps: true },                                // 묶은
  ],
  f: [
    { w: 35, ys: 78, bangs: ['straight', 'side', 'center', 'straight'], back: 'bob', locks: 'bob', crown: 1 },  // 단발
    { w: 34, ys: 78, bangs: ['side', 'straight', 'center', 'up'], back: 'shoulder', locks: 'shoulder' },       // 어깨
    { w: 34, ys: 78, bangs: ['center', 'side', 'straight', 'up'], back: 'long', locks: 'long' },               // 긴 머리
    { w: 32.5, ys: 70, bangs: ['up', 'side'], tail: 'low', wisps: true, crown: 3 },                            // 묶은
    { w: 32.5, ys: 70, bangs: ['straight', 'side', 'up', 'side'], tail: 'pony', crown: 2 },                    // 포니테일
    { w: 34, ys: 76, bangs: ['side', 'straight', 'center', 'side'], back: 'shoulder', locks: 'shoulder', bun: 'half' },  // 반묶음
  ],
};
// 어린이는 머리 스타일이 단순해짐 (남: 짧은·덮은 / 여: 단발·포니테일·묶은). 교복 입는 10대 남자는 장발·묶은 머리 없음
const KID_HAIR = { m: [0, 3, 0, 3, 3, 0], f: [0, 4, 0, 3, 4, 0] };
const TEEN_HAIR = { m: [0, 1, 2, 3, 3, 0], f: [0, 1, 2, 3, 4, 5] };
// 앞머리 끝: 아래로 둥글게 들쭉날쭉 (오른쪽 x1에서 왼쪽 x2로)
function scallop(x1, x2, y, h, n) {
  let d = '';
  for (let i = 1; i <= n; i++) { const xa = x1 + (x2 - x1) * (i - .5) / n, xb = x1 + (x2 - x1) * i / n; d += `Q${P(xa, y + h * (i % 2 ? 1 : .55))} ${P(xb, y)} `; }
  return d;
}
// 앞머리 아래 선 — 오른쪽 관자놀이(87,ys)에서 왼쪽(33,ys)까지
const BANGS = {
  up:       ys => `C87,${Math.min(ys, 58)} 81,46 70,44.6 Q60,43 50,44.6 C39,46 33,${Math.min(ys, 58)} 33,${ys}`,                     // 이마 드러냄
  straight: ys => `C87,63 86.5,59 85,57 ${scallop(85, 35, 57, 2.4, 9)}C33.5,59 33,63 33,${ys}`,                                  // 일자
  low:      ys => `C87,65 87,62.5 86,61 ${scallop(86, 34, 61, 2.6, 10)}C33,62.5 33,65 33,${ys}`,                                 // 눈썹까지 덮음
  side:     ys => `C87,62 86,56 81.5,53.5 C73,49.6 63,48.4 53,45.6 C46,43.8 40,46.4 36.5,51.6 C34.5,55.4 33,60 33,${ys}`,        // 옆가르마
  center:   ys => `C87,60 85,51 77,47 C71,44.4 64,43.2 60,41.6 C56,43.2 49,44.4 43,47 C35,51 33,60 33,${ys}`,                     // 가운데 가르마
};
const PART = { side: 'M51,27.5 Q49.5,36 52.5,45', center: 'M60,26.5 Q60.4,34 60,41.6' };
// 머리 결: 가르마에서 바깥으로 흐르는 곡선 몇 개 (밝은 결 + 어두운 결)
const STRANDS = {
  side:     ['M52,30 Q67,29.5 81,40', 'M53,34 Q68,36 83,49', 'M50,30 Q41,31 35,40', 'M56,40 Q70,44 80,52'],
  center:   ['M60,29 Q73,30 83,42', 'M60,29 Q47,30 37,42', 'M62,34 Q72,38 79,47', 'M58,34 Q48,38 41,47'],
  up:       ['M44,33 Q60,25.5 76,33', 'M39,39 Q60,30.5 81,39', 'M48,40 Q60,36.5 72,40'],
  straight: ['M46,38 Q45,47 44,55', 'M56,37 Q56,47 55,56', 'M66,37 Q66,47 67,56', 'M76,39 Q77,47 78,55', 'M44,31 Q60,25.5 76,31'],
  low:      ['M44,40 Q43,50 42,59', 'M54,39 Q54,50 53,60', 'M66,39 Q66,50 67,60', 'M77,41 Q78,50 79,59'],
};
function strands(list, hc) {
  if (!list || !list.length) return '';
  const darkList = list.slice(0, 2).map(d => d.replace(/^M([\d.]+),([\d.]+)/, (m, x, y) => `M${+x + 2},${+y + 2}`));
  return `<path d="${list.join(' ')}" fill="none" stroke="${shade(hc, 1.45)}" stroke-width="1.3" stroke-linecap="round" opacity=".2"/>` +
    `<path d="${darkList.join(' ')}" fill="none" stroke="${shade(hc, .6)}" stroke-width="1.1" stroke-linecap="round" opacity=".18"/>`;
}
// 끝이 갈라지는 머리 끝 (오른쪽 xr에서 왼쪽 xl로)
function splitEnds(xr, xl, y, n) {
  let d = '';
  for (let i = 1; i <= n; i++) { const x = xr + (xl - xr) * i / n; d += `L${P(x - (xl - xr) / n / 2, y + (i % 2 ? 4.5 : 2))} L${P(x, y)} `; }
  return d;
}
// 뒷머리 (얼굴 뒤). L.sy 어깨선, L.chest 가슴 높이 — 긴 머리 끝 위치
function backHair(kind, w, L) {
  const dome = `M${f1(60 - w - 2)},64 C${f1(60 - w - 4)},38 42,23.5 60,23.5 C78,23.5 ${f1(60 + w + 4)},38 ${f1(60 + w + 2)},64`;
  if (kind === 'bob') return `${dome} L${f1(60 + w + 2.5)},95 C${f1(60 + w + 3)},104 ${f1(60 + w - 3)},108.5 ${f1(60 + w - 9)},104.5 L${f1(60 - w + 9)},104.5 C${f1(60 - w + 3)},108.5 ${f1(60 - w - 3)},104 ${f1(60 - w - 2.5)},95 Z`;   // 끝이 안쪽으로 말림
  if (kind === 'shoulder') { const yb = L.sy + 9; return `${dome} L${f1(60 + w + 5)},${f1(yb - 7)} Q${f1(60 + w + 7)},${f1(yb + 1)} ${f1(60 + w + 1)},${f1(yb)} ${splitEnds(60 + w + 1, 60 - w - 1, yb, 6)}Q${f1(60 - w - 7)},${f1(yb + 1)} ${f1(60 - w - 5)},${f1(yb - 7)} Z`; }
  if (kind === 'long') { const yb = L.chest + 24; return `${dome} C${f1(60 + w + 5)},90 ${f1(60 + w + 8)},${f1(yb - 30)} ${f1(60 + w + 7)},${f1(yb - 4)} ${splitEnds(60 + w + 7, 60 - w - 7, yb - 4, 9)}C${f1(60 - w - 8)},${f1(yb - 30)} ${f1(60 - w - 5)},90 ${f1(60 - w - 2)},64 Z`; }
  if (kind === 'manLong') { const yb = L.sy + 4; return `${dome} L${f1(60 + w + 3)},${f1(yb - 6)} ${splitEnds(60 + w + 3, 60 - w - 3, yb - 6, 7)}L${f1(60 - w - 3)},${f1(yb - 6)} Z`; }
  return '';
}
// 옆머리 — 관자놀이에서 얼굴 옆(귀 앞)으로 내려와 어깨나 가슴 위로 떨어짐 (s: 왼쪽 -1 / 오른쪽 1)
function lock(kind, s, L) {
  const X = dx => f1(60 + s * dx), top = 58;
  const yb = f1(kind === 'bob' ? 103 : kind === 'shoulder' ? L.sy + 6 : kind === 'long' ? L.chest + 12 : L.sy);
  const end = kind === 'bob'
    ? `C${X(33.5)},${f1(yb + 5)} ${X(28)},${f1(yb + 4.5)} ${X(25.5)},${f1(yb - 1)}`                       // 단발: 끝이 안쪽으로 말림 (C커브)
    : `L${X(31)},${f1(yb + 4)} L${X(29)},${yb} L${X(26.8)},${f1(yb + 3.4)} L${X(25.2)},${f1(yb - 2)}`;   // 끝이 갈라짐
  return `M${X(30)},${top} C${X(35.5)},${top + 18} ${X(35)},${f1(yb - 24)} ${X(34)},${yb} ${end} C${X(25.5)},${f1(yb - 22)} ${X(25)},${top + 22} ${X(26.5)},${top + 4} Z`;
}
function hairPieces(a, X, age, hc, L) {
  const kid = age <= 12, teen = age >= 13 && age <= 18;
  const idx = (kid ? KID_HAIR : teen ? TEEN_HAIR : null)?.[a.g][a.hair] ?? a.hair;
  const st = STYLES[a.g][idx] || STYLES[a.g][0];
  const bang = st.bangs[X.bang % st.bangs.length];
  const w = st.w, ys = st.ys, top = 27 - (st.crown || 0), dark = shade(hc, .82), band = shade(TOP_COLORS[a.tc], .8);
  let back = '', front = '';
  // 뒤: 묶음(정수리·반묶음), 꼬리, 뒷머리
  if (st.bun === 'top') back += `<circle cx="60" cy="20.5" r="7.5" fill="${shade(hc, .9)}"/><path d="M54.5,25 Q60,27.4 65.5,25" fill="none" stroke="${shade(hc, .55)}" stroke-width="1.6"/>`;
  if (st.bun === 'half') back += `<circle cx="60" cy="23" r="6.2" fill="${shade(hc, .9)}"/>`;
  if (st.tail === 'low') back += `<path d="M85,72 C95,85 96,106 90,126 C88,133 82,134 81,128 C85,112 85,95 79,80 Z" fill="${dark}"/><path d="M86,84 Q90,104 86,124" fill="none" stroke="${shade(hc, 1.4)}" stroke-width="1.1" opacity=".18"/>`;
  if (st.tail === 'pony') back += `<path d="M77,36 C97,35 106,58 101,88 C99,98 96,104 92,100 L94,95 L90,96 C95,74 93,54 80,46 Z" fill="${dark}"/><path d="M86,42 Q99,58 96,90" fill="none" stroke="${shade(hc, 1.4)}" stroke-width="1.1" opacity=".18"/>`;
  if (st.back) back += `<path d="${backHair(st.back, w, L)}" fill="${dark}"/>`;
  if (st.back === 'long' || st.back === 'shoulder') back += `<path d="M${f1(60 - w + 1)},70 Q${f1(60 - w - 3)},${f1(L.sy)} ${f1(60 - w + 1)},${f1(L.sy + 30)} M${f1(60 + w - 1)},70 Q${f1(60 + w + 3)},${f1(L.sy)} ${f1(60 + w - 1)},${f1(L.sy + 30)}" fill="none" stroke="${shade(hc, 1.35)}" stroke-width="1.2" opacity=".14"/>`;
  // 앞: 반삭은 두피가 비침, 투블럭은 옆을 짧게 깎은 경계
  if (st.buzz) front += `<path d="M31,68 C30,42 43,30.5 60,30.5 C77,30.5 90,42 89,68 Z" fill="${shade(hc, .9)}" opacity=".45"/>`;
  if (st.block) front += `<path d="M29.5,52 L35.5,49.5 L35,72 L30.5,70 Z M90.5,52 L84.5,49.5 L85,72 L89.5,70 Z" fill="${hc}" opacity=".38"/>`;
  const domeD = `M${f1(60 - w)},${ys} C${f1(60 - w - 1.5)},${top + 20} ${f1(60 - w * .6)},${top} 60,${top} C${f1(60 + w * .6)},${top} ${f1(60 + w + 1.5)},${top + 20} ${f1(60 + w)},${ys}`;
  front += `<path d="${domeD} L87,${ys} ${BANGS[bang](ys)} L${f1(60 - w)},${ys} Z" fill="${hc}"${st.buzz ? ' opacity=".55"' : ''}/>`;
  if (!st.buzz) front += strands(STRANDS[bang], hc);
  if (PART[bang]) front += `<path d="${PART[bang]}" fill="none" stroke="${shade(hc, .55)}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`;
  if (st.locks) front += `<path d="${lock(st.locks, -1, L)} ${lock(st.locks, 1, L)}" fill="${hc}"/>` +
    `<path d="M29,66 Q27,84 29.5,100 M91,66 Q93,84 90.5,100" fill="none" stroke="${shade(hc, 1.45)}" stroke-width="1.1" opacity=".18"/>`;
  if (st.wisps) front += `<path d="M33.5,57 q-3.4,6 -1.2,13.5 M86.5,57 q3.4,6 1.2,13.5" fill="none" stroke="${hc}" stroke-width="1.2" stroke-linecap="round"/>`;   // 잔머리
  if (st.tail === 'pony') front += `<path d="M82,40 l5,-4 l.6,6 Z M82,40 l4.6,4.4 l-5.4,1.6 Z" fill="${TOP_COLORS[a.tc]}"/><circle cx="82" cy="40" r="2.8" fill="${band}"/>`;   // 리본
  if (st.tail === 'low') front += `<rect x="80" y="74.5" width="6.5" height="3.4" rx="1.6" transform="rotate(35 83 76)" fill="${band}"/>`;   // 고무줄
  if (st.bun === 'half') front += `<path d="M54.5,27.5 Q60,29.6 65.5,27.5" fill="none" stroke="${band}" stroke-width="2"/>`;
  return { back, front };
}

/* ---------- 상반신 몸·옷 ---------- */
// 몸통 반폭: 어린이 36, 어른 남자는 어깨(좁음 42 / 보통 48 / 넓음 54), 여자 44. 체격이 통통하면 넓게, 마르면 좁게
function halfWidth(a, kid, adult) {
  if (kid) return 36;
  const b = a.body || {};
  let hw = a.g === 'm' ? ({ narrow: 42, avg: 48, wide: 54 }[adult ? b.shoulder : 'avg'] || 48) : 44;
  if (adult) hw += { chubby: 4, slim: -3, fit: a.g === 'm' ? 2 : 0 }[b.build] || 0;
  return hw;
}
function body(kid, hw = kid ? 36 : 48) {
  const sh = kid ? 4 : 0;
  return `M${60 - hw},160 C${60 - hw},${133 + sh} ${77 - hw},${119 + sh} 49,${115 + sh} L71,${115 + sh} C${43 + hw},${119 + sh} ${60 + hw},${133 + sh} ${60 + hw},160 Z`;
}
// 옷 위로 드러나는 체형선 (20살부터): 니트 > 티셔츠 > 셔츠 > 후디 순으로 잘 보임
function shapeLines(a, top, color) {
  const b = a.body || {}, op = [.4, .32, .14, .55][top] || 0;
  if (!op) return '';
  const st = `fill="none" stroke="${shade(color, .68)}" stroke-width="1.5" stroke-linecap="round" opacity="${op}"`;
  if (a.g === 'f') {
    if (b.chest === 'large') return `<path d="M39,139 Q48,152 58,143 M62,143 Q72,152 81,139" ${st}/>`;
    if (b.chest === 'avg') return `<path d="M43,140 Q50,148 58,143 M62,143 Q70,148 77,140" ${st}/>`;
    return '';
  }
  if (b.build === 'fit' || b.shoulder === 'wide') return `<path d="M43,135 Q51,140 59,136 M61,136 Q69,140 77,135" ${st}/>`;
  return '';
}
// 쇄골: 목 아래에서 어깨 쪽으로 살짝 벌어지는 V
const clav = (y, half, skin, k = 1) => `<path d="M${f1(60 - 3 * k)},${f1(y)} Q${f1(60 - half * .55)},${f1(y + 1.6 * k)} ${f1(60 - half)},${f1(y + .6 * k)} M${f1(60 + 3 * k)},${f1(y)} Q${f1(60 + half * .55)},${f1(y + 1.6 * k)} ${f1(60 + half)},${f1(y + .6 * k)}" fill="none" stroke="${shade(skin, .74)}" stroke-width="${f1(1.1 * k)}" stroke-linecap="round" opacity=".7"/>`;
function clothes(a, top, kid, skin, hw, adult) {
  const sh = kid ? 4 : 0;   // 어린이는 어깨선이 조금 아래
  if (top === 4) {   // 교복 — 블레이저 + 셔츠 + 넥타이(남) / 리본(여) + 왼가슴 마크
    const tie = UNIFORM.tie[a.tie];
    return `<path d="${body(kid, hw)}" fill="${UNIFORM.blazer}"/>
      <path d="M49,${115 + sh} L60,${142 + sh} L71,${115 + sh} Z" fill="${UNIFORM.shirt}"/>
      <path d="M49,${115 + sh} L56,${131 + sh} L46,${129 + sh} L41,${118 + sh} Z M71,${115 + sh} L64,${131 + sh} L74,${129 + sh} L79,${118 + sh} Z" fill="${shade(UNIFORM.blazer, 1.25)}"/>
      <path d="M46,${129.5 + sh} L56,${131.5 + sh} M74,${129.5 + sh} L64,${131.5 + sh}" stroke="${shade(UNIFORM.blazer, .6)}" stroke-width="1.2" opacity=".6"/>
      <path d="M78,${140 + sh} l6,0 l0,5 q-3,3 -6,0 Z" fill="#c8a24a" opacity=".85"/>
      ${a.g === 'm'
        ? `<path d="M57,${119 + sh} L63,${119 + sh} L62,${123 + sh} L64,${140 + sh} L60,${145 + sh} L56,${140 + sh} L58,${123 + sh} Z" fill="${tie}"/>`
        : `<path d="M60,${123 + sh} L51,${118 + sh} L51,${128 + sh} Z M60,${123 + sh} L69,${118 + sh} L69,${128 + sh} Z" fill="${tie}"/><circle cx="60" cy="${123 + sh}" r="2.4" fill="${shade(tie, .8)}"/>`}`;
  }
  const c = TOP_COLORS[a.tc], dark = shade(c, .78), fold = shade(c, .6);
  let out = `<path d="${body(kid, hw)}" fill="${c}"/>`;
  if (top === 0) out += `<path d="M47.5,${115 + sh} Q60,${128 + sh} 72.5,${115 + sh}" fill="${skin}"/>${clav(119.5 + sh, 11, skin)}<path d="M47.5,${115 + sh} Q60,${128 + sh} 72.5,${115 + sh}" fill="none" stroke="${dark}" stroke-width="3"/>`;   // 티셔츠
  else if (top === 1) out += `<path d="M51.5,${115 + sh} L60,${129 + sh} L68.5,${115 + sh} Z" fill="${skin}"/>${clav(119 + sh, 7, skin)}
      <path d="M50,${114 + sh} L60,${129 + sh} L52,${133 + sh} L44.5,${119 + sh} Z M70,${114 + sh} L60,${129 + sh} L68,${133 + sh} L75.5,${119 + sh} Z" fill="${shade(c, 1.35)}" stroke="${dark}" stroke-width="1"/>
      <path d="M52,${133.5 + sh} L60,${130 + sh} L68,${133.5 + sh}" fill="none" stroke="${fold}" stroke-width="1.6" opacity=".35"/>
      <path d="M60,${130 + sh} L60,160" stroke="${dark}" stroke-width="1.2"/><circle cx="60" cy="${140 + sh}" r="1.3" fill="${dark}"/><circle cx="60" cy="${151 + sh}" r="1.3" fill="${dark}"/>`;   // 셔츠
  else if (top === 2) out += `<path d="M37,${121 + sh} C39,${107 + sh} 81,${107 + sh} 83,${121 + sh} C72,${131 + sh} 48,${131 + sh} 37,${121 + sh} Z" fill="${dark}"/>
      <path d="M48,${115 + sh} Q60,${125 + sh} 72,${115 + sh}" fill="${skin}"/>
      <path d="M55,${124 + sh} L54,${141 + sh} M65,${124 + sh} L66,${141 + sh}" stroke="${shade(c, 1.5)}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="54" cy="${142 + sh}" r="1.2" fill="${shade(c, 1.5)}"/><circle cx="66" cy="${142 + sh}" r="1.2" fill="${shade(c, 1.5)}"/>`;   // 후디
  else out += `<path d="M47,${114 + sh} Q60,${123 + sh} 73,${114 + sh} L73,${119 + sh} Q60,${129 + sh} 47,${119 + sh} Z" fill="${dark}"/>
      <path d="M49,${114 + sh} Q60,${121 + sh} 71,${114 + sh}" fill="${skin}"/>
      <path d="M36,${138 + sh} Q42,${135 + sh} 48,${138 + sh} T60,${138 + sh} T72,${138 + sh} T84,${138 + sh} M34,${149 + sh} Q40,${146 + sh} 46,${149 + sh} T58,${149 + sh} T70,${149 + sh} T82,${149 + sh} T94,${149 + sh}" fill="none" stroke="${dark}" stroke-width="1.1" opacity=".35"/>
      <path d="M30,154 L30,160 M38,154 L38,160 M46,154 L46,160 M54,154 L54,160 M62,154 L62,160 M70,154 L70,160 M78,154 L78,160 M86,154 L86,160" stroke="${dark}" stroke-width="1.4"/>`;   // 니트
  // 옷깃 아래 그림자
  out += `<path d="M47,${119 + sh} Q60,${133 + sh} 73,${119 + sh}" fill="none" stroke="${fold}" stroke-width="2" opacity=".14"/>`;
  if (adult) out += shapeLines(a, top, c);
  return out;
}

/* ---------- 옛 전신 틀 (머리 77 기준) — 함께 밤을 보내기 전 장면(renderPreIntimate)만 씀. 옷 입은 전신은 아래 앵커 방식 ---------- */
// 나이별 비율 (머리 77 기준): [나이, 목, 어깨~허리, 허리~가랑이, 다리]
//   6살 1:2.5, 10살 1:3, 13살 1:3.5, 15살 1:4, 19살부터 1:4.5
const PROP = [[0, 2, 48, 20, 40], [3, 3, 60, 26, 70], [6, 4, 70, 30, 98], [10, 6, 82, 34, 122], [13, 9, 94, 40, 146], [15, 12, 104, 46, 162], [19, 15, 116, 54, 178]];
function prop(age) {
  for (let i = 1; i < PROP.length; i++) if (age <= PROP[i][0]) {
    const t = clamp((age - PROP[i - 1][0]) / (PROP[i][0] - PROP[i - 1][0]), 0, 1);
    return PROP[i].slice(1).map((v, k) => lerp(PROP[i - 1][k + 1], v, t));
  }
  return PROP[PROP.length - 1].slice(1);
}
const SH_RATIO = [[38, 1.02], [41, 1.25], [45, 1.6], [48, 1.72], [50, 1.82], [52, 1.92]];        // 남자 어깨 cm → 머리 너비의 몇 배
const HIP_OUT = [[80, 2.5], [85, 3.5], [89, 6], [96, 9.5], [100, 11], [103, 13.5], [105, 15]];   // 골반 cm → 허리에서 바깥으로
const CUP_OUT = { AA: 0, A: 2.5, B: 4.5, C: 7, D: 9.5, E: 12, F: 14 };                          // 컵 → 옷 위 옆 실루엣 볼록함
// 몸의 기준점(y)과 반폭(중심 60에서)
function frameOf(a, age, fig) {
  const f = a.g === 'f', b = a.body || {}, adult = age >= 20, kid = age <= 12, teen = !kid && !adult;
  let [neck, torso, hipLen, legs] = prop(age);
  const hcm = adult && fig && fig.height ? fig.height : (f ? 162 : 173) + ({ short: -8, tall: 8 }[b.height] || 0);
  const k = adult ? clamp(hcm / 172, .84, 1.12) : teen ? (f ? .97 : 1) * (1 + ({ short: -.04, tall: .04 }[b.height] || 0)) : 1;
  torso *= k; hipLen *= k; legs *= k;
  const bw = adult ? ({ slim: -2, fit: 1, chubby: 4 }[b.build] || 0) : 0;
  let sh, rib, waist, hip, bust = 0, arm, fore;
  if (kid) { const t = clamp(age / 12, 0, 1); sh = 23 + t * 7; rib = sh - 3.5; waist = rib + .5; hip = waist + 1; arm = 5.5 + t; fore = 4.6 + t * .8; }
  else if (teen) {   // 10대: 성별 평균 체형만 (개인별 컵·허리·골반 차이는 20살부터)
    const t = clamp((age - 13) / 6, 0, 1);
    sh = f ? 33 + t * 5 : 33 + t * 9; rib = sh - 6;
    waist = f ? rib - 1 - 2.5 * t : rib - 1.5 * t; hip = f ? waist + 3 + 3 * t : waist + 1.5;
    arm = f ? 6.8 : 7.2 + t * 1.4; fore = arm - 1.2;
  } else if (f) {
    sh = 40.5 + bw * .8; rib = sh - 7 + bw * .4;
    const wc = fig && fig.waist || ({ slim: 59, fit: 62, chubby: 73 }[b.build] || 64);
    const hc = fig && fig.hip || ({ slim: 85, fit: 91, chubby: 99 }[b.build] || 90);
    waist = 23.5 + (wc - 56) * .45; hip = waist + lerpTable(HIP_OUT, hc) * 1.1;
    bust = fig && fig.cup && CUP_OUT[fig.cup] != null ? CUP_OUT[fig.cup] : ({ small: 2.5, large: 9.5 }[b.chest] ?? 5.5);
    arm = 7.6 + bw * .3; fore = 6.2 + bw * .25;
  } else {
    const scm = fig && fig.shoulder || ({ narrow: 39.5, wide: 48 }[b.shoulder] || 43.5);
    sh = 29 * lerpTable(SH_RATIO, scm) + bw * .5; rib = sh - 6;
    const wc = fig && fig.waist || ({ slim: 71, fit: 76, chubby: 90 }[b.build] || 78);
    waist = sh * .72 + (wc - 76) * .38; hip = waist + 2;
    arm = 9 + bw * .4 + (b.build === 'fit' ? .9 : 0); fore = 7.5 + bw * .3;
  }
  if (adult && age >= 36 && b.build !== 'fit') { waist += 1.5; hip += 1; }   // 30대 후반부터 운동 안 하면 살짝 넓어짐
  const sy = 103 + neck, waistY = sy + torso, crotch = waistY + hipLen;
  return { f, adult, kid, teen, b, nh: kid ? 8.5 : f ? 10.5 : 12, sy, chest: sy + torso * .3, waistY, hipY: waistY + hipLen * .5, crotch,
    knee: crotch + legs * .47, ankle: crotch + legs, legs, sh, rib, waist, hip, bust, arm, fore, thigh: adult ? ({ slim: -1, fit: .6, chubby: 2.2 }[b.build] || 0) : 0 };
}
// 오른쪽 윤곽(중심에서 dx, 절대 y)을 좌우 대칭 닫힌 path로. seg: { c:[x1,y1,x2,y2], p:[x,y] } 또는 { p }
function sym(start, segs) {
  const X = (dx, s) => f1(60 + s * dx);
  let d = `M${X(start[0], 1)},${f1(start[1])}`;
  for (const g of segs) d += g.c ? ` C${X(g.c[0], 1)},${f1(g.c[1])} ${X(g.c[2], 1)},${f1(g.c[3])} ${X(g.p[0], 1)},${f1(g.p[1])}` : ` L${X(g.p[0], 1)},${f1(g.p[1])}`;
  const last = segs.length ? segs[segs.length - 1].p : start;
  d += ` L${X(last[0], -1)},${f1(last[1])}`;
  for (let i = segs.length - 1; i >= 0; i--) {
    const g = segs[i], prev = i ? segs[i - 1].p : start;
    d += g.c ? ` C${X(g.c[2], -1)},${f1(g.c[3])} ${X(g.c[0], -1)},${f1(g.c[1])} ${X(prev[0], -1)},${f1(prev[1])}` : ` L${X(prev[0], -1)},${f1(prev[1])}`;
  }
  return d + ' Z';
}
// 다리 한쪽 (허벅지 → 무릎 살짝 좁음 → 종아리 → 발목). s: 왼쪽 -1 / 오른쪽 1
function legPath(F, s) {
  const X = dx => f1(60 + s * dx), t = F.thigh;
  const top = F.hip - .5, cx = F.hip * .5 + .5, kx = cx * .86, ax = cx * .8;
  const g = F.kid ? .85 : 1;
  const kh = (7.6 + t * .7 + (F.f ? 0 : .9)) * g, ch = (8.8 + t + (F.f ? 0 : 1)) * g + (F.b.build === 'fit' && F.adult ? .7 : 0), ah = (4.4 + t * .3 + (F.f ? 0 : .5)) * g;
  const calfY = F.knee + F.legs * .17;
  return { d: `M${X(top)},${f1(F.hipY)} C${X(top + 1)},${f1(F.hipY + (F.knee - F.hipY) * .45)} ${X(kx + kh + 2)},${f1(F.knee - F.legs * .12)} ${X(kx + kh)},${f1(F.knee)}
    C${X(kx + ch + 1.4)},${f1(F.knee + F.legs * .07)} ${X(kx + ch)},${f1(calfY)} ${X(kx + ch - 1.2)},${f1(calfY + F.legs * .08)} C${X(ax + ah + 1.5)},${f1(F.ankle - F.legs * .14)} ${X(ax + ah)},${f1(F.ankle - 4)} ${X(ax + ah)},${f1(F.ankle)}
    L${X(ax - ah)},${f1(F.ankle)} C${X(ax - ah)},${f1(F.ankle - 10)} ${X(kx - ch * .78)},${f1(calfY + 4)} ${X(kx - ch * .8)},${f1(calfY - F.legs * .03)} C${X(kx - kh - .4)},${f1(F.knee + F.legs * .05)} ${X(kx - kh)},${f1(F.knee)} ${X(kx - kh)},${f1(F.knee - 2)}
    C${X(kx - kh - .6)},${f1(F.knee - F.legs * .2)} ${X(2.4)},${f1(F.crotch + F.legs * .1)} ${X(1.2)},${f1(F.crotch)} Z`, kx, kh, ax, ah, cx };
}
// 하의 종류와 색. 바지 cut: skinny(다리 윤곽 +0.5) / straight(무릎 아래 일자) / wide(골반부터 벌어짐)
function bottomOf(a, X, age, F) {
  const kid = age <= 12, teen = age >= 13 && age <= 18;
  if (teen) return F.f ? { k: 'skirt', c: UNIFORM.skirt, uniform: true } : { k: 'slacks', c: UNIFORM.blazer, cut: 'straight' };
  if (kid) return F.f ? (X.pants < .55 ? { k: 'skirt', c: ['#c25a6b', '#6aa3c8', '#d0a443'][a.tc % 3] } : { k: 'shorts', c: ['#4a5f86', '#c25a6b', '#5f8f6a'][a.tc % 3] })
    : (X.pants < .6 ? { k: 'shorts', c: ['#4a5f86', '#7a8a5a', '#3b3e48'][a.tc % 3] } : { k: 'jeans', c: '#4a5f86', cut: 'straight' });
  if (F.f && (a.tc + a.top) % 3 !== 0) return { k: 'skirt', c: ['#2e2e36', '#8a6f5a', '#5b4a78', '#7d2f3d'][a.tc % 4] };
  if (!F.f && a.top === 1) return { k: 'slacks', c: X.pants < .5 ? '#3b3e48' : '#2e3440', tucked: true, cut: 'straight' };
  const cut = X.hem < .5 ? 'skinny' : 'straight';
  return X.pants < .6 ? { k: 'jeans', c: '#4a5f86', cut } : X.pants < .8 ? { k: 'slacks', c: F.f ? '#3b3e48' : '#a08a63', chino: !F.f, cut: F.f && X.hem < .45 ? 'wide' : 'straight' } : { k: 'jeans', c: '#2f3b55', cut };
}
// 신발: 운동화 / 구두 / 굽 있는 구두 / 슬리퍼 — 나이·하의에 따라
function shoeOf(X, age, F, bt) {
  if (age <= 12) return 'sneaker';
  if (age <= 18) return X.shoe < .5 ? 'loafer' : 'sneaker';
  if (F.f) return bt.k === 'skirt' ? (X.shoe < .7 ? 'heel' : 'sneaker') : X.shoe < .25 ? 'heel' : X.shoe < .88 ? 'sneaker' : 'slipper';
  return bt.k === 'slacks' && !bt.chino ? 'loafer' : X.shoe < .87 ? 'sneaker' : 'slipper';
}
function shoe(type, x, y, s, w, skin, a) {
  const X = dx => f1(x + s * dx), Y = dy => f1(y + dy);
  if (type === 'heel') {   // 뾰족한 앞코 + 굽, 발등이 보임
    const c = ['#2b2724', '#8c2f3a', '#c9a98b'][a.tc % 3];
    return `<path d="M${X(-3.4)},${Y(-1)} Q${f1(x)},${Y(1.6)} ${X(3.6)},${Y(-1)} L${X(3.4)},${Y(2.6)} Q${f1(x)},${Y(4)} ${X(-3.2)},${Y(2.6)} Z" fill="${skin}"/>
      <path d="M${X(2.4)},${Y(5)} l${f1(s * 1.5)},0 l${f1(-s * .2)},5.4 l${f1(-s * 1)},0 Z" fill="${shade(c, .7)}"/>
      <path d="M${X(-4.8)},${Y(1.6)} Q${f1(x)},${Y(5)} ${X(4.8)},${Y(1.6)} L${X(3.4)},${Y(8.4)} Q${f1(x)},${Y(11.4)} ${X(-3.4)},${Y(8.4)} Z" fill="${c}"/>
      <path d="M${X(-1.6)},${Y(4.6)} q1.4,1.2 3,0" fill="none" stroke="#fff" stroke-width=".9" opacity=".35"/>`;
  }
  if (type === 'slipper') return `<ellipse cx="${f1(x)}" cy="${Y(6.4)}" rx="${f1(w + 2.4)}" ry="2.6" fill="${skin}"/>
    <path d="M${X(-w - 4)},${Y(6.4)} Q${f1(x)},${Y(11.6)} ${X(w + 4)},${Y(6.4)} L${X(w + 4)},${Y(8.6)} Q${f1(x)},${Y(12.6)} ${X(-w - 4)},${Y(8.6)} Z" fill="#5b6b7a"/>
    <path d="M${X(-w - 2.6)},${Y(5.2)} Q${f1(x)},${Y(2.2)} ${X(w + 2.6)},${Y(5.2)} L${X(w + 3)},${Y(8)} Q${f1(x)},${Y(5.4)} ${X(-w - 3)},${Y(8)} Z" fill="#3e8a7a"/>`;
  const body_ = `M${X(-w - 2.6)},${Y(1)} Q${X(-w - 3.8)},${Y(8)} ${X(-w)},${Y(9)} L${X(w + 2.6)},${Y(9)} Q${X(w + 6)},${Y(8.6)} ${X(w + 4.8)},${Y(3)} Q${X(w + 1.4)},${Y(-1.8)} ${f1(x)},${Y(-2)} Q${X(-w - 1)},${Y(-1.8)} ${X(-w - 2.6)},${Y(1)} Z`;
  if (type === 'loafer') return `<path d="${body_}" fill="#2a211d"/><path d="M${X(-w - 2.6)},${Y(8)} Q${f1(x)},${Y(10.4)} ${X(w + 4.6)},${Y(8)}" fill="none" stroke="#120d0b" stroke-width="1.4"/>
    <path d="M${X(-1.4)},${Y(2)} q2.4,-1.2 4.6,.4" fill="none" stroke="#fff" stroke-width="1" opacity=".25"/>`;
  const c = ['#eceae6', '#e2e4ea', '#d9534f', '#3b3e48'][(a.tc + a.top) % 4], light = c === '#eceae6' || c === '#e2e4ea';   // 운동화: 밑창 + 끈
  return `<path d="${body_}" fill="${c}"/>
    <path d="M${X(-w - 3.2)},${Y(6.8)} Q${f1(x)},${Y(9.6)} ${X(w + 5.4)},${Y(6.8)} L${X(w + 5)},${Y(9.4)} Q${f1(x)},${Y(11.6)} ${X(-w - 3)},${Y(9.4)} Z" fill="#f7f6f3" stroke="${light ? '#b9b5ad' : shade(c, .75)}" stroke-width=".6"/>
    <path d="M${X(-1.8)},${Y(.4)} L${X(2.4)},${Y(2)} M${X(-1.8)},${Y(2.4)} L${X(2.4)},${Y(.6)}" stroke="${light ? '#9aa2ad' : '#fff'}" stroke-width=".9" stroke-linecap="round"/>`;
}
// 손: 엄지만 분리된 벙어리장갑 모양 (손목이 원점, 아래로 길이 약 15.7)
const mittIn = skin => `<path d="M-4.4,-1.5 C-5.2,4.5 -4.8,10.6 -1.4,12.6 C1.8,14.2 4.9,11.8 4.8,7.6 L4.8,-1.5 Z" fill="${skin}"/>
  <path d="M-3.9,2.4 C-7.4,4.2 -7.2,8.6 -4.4,9.6 C-3.4,8.2 -3.2,5.4 -2.6,3.2 Z" fill="${shade(skin, .9)}"/>
  <path d="M-1.2,9.6 Q1,11 3.2,9.2" fill="none" stroke="${shade(skin, .7)}" stroke-width=".8" opacity=".5"/>`;
// (x,y) 손목, rot 회전(아래가 0), s 바깥쪽 방향
const mitt = (x, y, s, skin, rot) => `<g transform="translate(${f1(x)},${f1(y)}) rotate(${rot || 0}) scale(${s},1)">${mittIn(skin)}</g>`;
// 전신용 손: 손목에서 좁게 시작해 손바닥으로 넓어짐 (손목이 원점, 길이 약 15.3). len = 손 길이(px), 폭은 길이의 절반쯤
const handIn = skin => `<path d="M-2.6,-1.5 C-3.4,1.6 -4.9,3.8 -4.8,7.8 C-4.7,11.2 -2.8,13.7 0,13.8 C2.8,13.9 4.9,11.6 4.9,7.8 C4.9,4 3.4,1.4 2.8,-1.5 Z" fill="${skin}" stroke="${shade(skin, .72)}" stroke-width=".55"/>
  <path d="M-3.3,3 C-6.8,4.4 -7,8.6 -4.6,9.9 C-3.8,8.5 -3.5,6.1 -2.9,4 Z" fill="${shade(skin, .9)}" stroke="${shade(skin, .72)}" stroke-width=".5"/>
  <path d="M-1.3,9.6 L-1.1,12.4 M1.5,9.6 L1.7,12.2" stroke="${shade(skin, .7)}" stroke-width=".55" stroke-linecap="round" opacity=".55"/>`;
const handAt = (x, y, s, skin, rot, len) => { const q = len / 15.3; return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(rot)}) scale(${(s * q * .8).toFixed(3)},${q.toFixed(3)})">${handIn(skin)}</g>`; };
// 팔 한 마디 (윤곽선 + 색)
const limb = (x1, y1, cx, cy, x2, y2, w, c) => `<path d="M${P(x1, y1)} Q${P(cx, cy)} ${P(x2, y2)}" fill="none" stroke="${shade(c, .74)}" stroke-width="${f1(w + 1.6)}" stroke-linecap="round"/><path d="M${P(x1, y1)} Q${P(cx, cy)} ${P(x2, y2)}" fill="none" stroke="${c}" stroke-width="${f1(w)}" stroke-linecap="round"/>`;

/* ---------- 전신 (앵커 방식) ---------- */
// 모든 전신이 같은 틀(0 0 120 280)·같은 바닥선·같은 cm당 px을 씀 → 키 150과 170이 그대로 다르게 보임 (카드 안에서 늘리지 않음)
// 몸: 높이별 앵커(어깨·가슴·밑가슴·허리·골반·가랑이·허벅지·무릎·종아리·발목)의 폭을 둘레(cm)에서 계산해 곡선으로 이음
// 옷: 몸 앵커 폭 + 여유분. 어른은 평균에서 벗어난 만큼 1.8배로 과장 (실제 비율 그대로면 차이가 1~2px라 안 보임)
// 체형 수치(컵·허리·골반·어깨)는 20살부터. 10대는 성별 평균, 어린이는 일자 몸
const FLOOR = 272, PXCM = 260 / 195, EXAG = 1.8;
const AVG_F = { bust: 84, underbust: 72, waist: 64, hip: 92, thigh: 53, calf: 33 };
const AVG_M = { chest: 94, waist: 80, hip: 94, thigh: 53, calf: 36, shoulder: 44 };
const KW = { bust: 1.12, underbust: 1.1, waist: 1.08, hip: 1.15 };   // 단면이 타원이라 정면 폭이 원 지름보다 넓음
const CUPS = ['AA', 'A', 'B', 'C', 'D', 'E', 'F'];
const CUP_DIFF = { AA: 7.5, A: 10, B: 12.5, C: 15, D: 17.5, E: 20, F: 22.5 };   // 밑가슴과의 차 (cm)
// 옷 위 가슴 신호: [옆 윤곽 볼록 px, 밑가슴 그림자 깊이 px, 그림자 폭 비율, 윗면 하이라이트, 밑단 들림 px]
const BUST_SIG = { AA: [0, 0, 0, 0, 0], A: [0, 0, 0, 0, 0], B: [1, 1, .6, .06, 0], C: [2, 2, .7, .1, 1], D: [3, 2.5, .8, .12, 2], E: [4, 3, .85, .14, 3], F: [5, 3.5, .9, .16, 4] };
// 앵커 높이 (정수리 0 ~ 바닥 1, 어른 기준). 머리 비율이 다르면 어깨 아래를 남은 구간에 비례 배분
const ANCHOR_Y = { bust: .3, underbust: .34, waist: .4, hip: .48, crotch: .52, thigh: .58, knee: .73, calf: .8, ankle: .95 };
// 나이별 평균 키 (cm)
const GROW = {
  m: [[0, 50], [1, 76], [2, 88], [3, 96], [4, 103], [5, 110], [6, 116], [7, 122], [8, 128], [9, 133], [10, 139], [11, 145], [12, 151], [13, 158], [14, 165], [15, 169], [16, 171], [17, 172], [18, 173]],
  f: [[0, 49], [1, 75], [2, 87], [3, 95], [4, 102], [5, 109], [6, 115], [7, 121], [8, 127], [9, 133], [10, 139], [11, 146], [12, 151], [13, 155], [14, 158], [15, 159], [16, 160], [17, 161], [18, 161]],
};
const headRatio = age => age <= 3 ? 3 : age <= 7 ? 3.5 : age <= 11 ? 4 : age <= 14 ? 4.5 : age <= 18 ? 5 : 5.5;
const pxW = (circ, k) => circ / Math.PI * k * PXCM;   // 둘레(cm) → 정면 폭(px)
const exag = (v, avg) => avg + (v - avg) * EXAG;
// 오른쪽 윤곽 [[중심에서 dx, y], ...]에서 y 높이의 반폭
function edgeAt(pts, y) {
  if (y <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][1]) return lerp(pts[i - 1][0], pts[i][0], (y - pts[i - 1][1]) / (pts[i][1] - pts[i - 1][1]));
  return pts[pts.length - 1][0];
}

// 몸의 앵커: 높이(y)와 반폭(w, 중심 60에서), 다리·팔 크기
function anchorsOf(a, age, fig) {
  const f = a.g === 'f', b = a.body || {}, adult = age >= 20, kid = age <= 11;
  const build = adult ? b.build || 'avg' : 'avg', hm = { short: -1, tall: 1 }[b.height] || 0;
  const hcm = adult ? (fig && fig.height) || (f ? 162 : 173) + hm * 8 : lerpTable(GROW[f ? 'f' : 'm'], age) * (1 + hm * .04);
  const H = hcm * PXCM, top = FLOOR - H, hr = headRatio(age), headH = H / hr, hs = headH / 77;
  // 둘레 (cm). 데이터에 없는 둘레는 추정
  let C, cup = null;
  if (adult && f) {
    const waist = (fig && fig.waist) || ({ slim: 59, fit: 62, chubby: 73 }[build] || 64);
    const hip = (fig && fig.hip) || ({ slim: 85, fit: 91, chubby: 99 }[build] || 90);
    cup = fig && CUP_DIFF[fig.cup] != null ? fig.cup : ({ small: 'A', large: 'D' }[b.chest] || 'B');
    const ub = (fig && fig.under) || waist + 8;
    C = { shoulder: 37 + ({ slim: -1, fit: 1, chubby: 2 }[build] || 0), underbust: ub, bust: ub + CUP_DIFF[cup], waist, hip, thigh: hip * .58 };
    C.calf = C.thigh * .62;
  } else if (adult) {
    const shoulder = (fig && fig.shoulder) || ({ narrow: 39.5, wide: 48 }[b.shoulder] || 43.5);
    const waist = (fig && fig.waist) || ({ slim: 71, fit: 76, chubby: 90 }[build] || 78);
    C = { shoulder, chest: (fig && fig.bust) || shoulder * 2.1, waist, hip: (fig && fig.hip) || waist + 10 };
    C.thigh = C.hip * .56; C.calf = C.thigh * .64;
  } else {   // 어린이: 가슴·허리·골반이 거의 같은 일자 몸 → 10대: 성별 평균 체형 쪽으로
    const t = clamp((age - 11) / 8, 0, 1), T = f ? { shoulder: 36, chest: 78, waist: 65, hip: 88 } : { shoulder: 42, chest: 88, waist: 73, hip: 89 };
    C = { shoulder: lerp(hcm * .22, T.shoulder, t), chest: lerp(hcm * .5, T.chest, t), waist: lerp(hcm * .46, T.waist, t), hip: lerp(hcm * .5, T.hip, t) };
    C.thigh = C.hip * .57; C.calf = C.thigh * .64;
  }
  if (adult && age >= 36 && build !== 'fit') { C.waist += 2; C.hip += 1; }   // 30대 후반부터 운동 안 하면 살짝 넓어짐
  const E = Object.assign({}, C), AVG = f ? AVG_F : AVG_M;
  if (adult) for (const k in AVG) E[k] = exag(C[k], AVG[k]);
  const fitM = adult && !f && build === 'fit', chubbyM = adult && !f && (build === 'chubby' || C.waist >= 88);
  const half = (v, k) => pxW(v, k) / 2;
  // 높이
  const chin = 1 / hr, shR = chin * 1.236, remap = v => shR + (v - .225) / .725 * (.95 - shR);
  const y = { chin: top + H * chin, neck: top + H * chin * 1.1, sh: top + H * shR };
  for (const k in ANCHOR_Y) y[k] = top + H * remap(ANCHOR_Y[k]);
  const ci = cup ? CUPS.indexOf(cup) : -1;
  if (cup) y.bust += H * .004 * (ci - 3);   // 컵이 커질수록 가슴 앵커가 아래로
  y.armpit = lerp(y.sh, y.bust, .55); y.hipUp = lerp(y.waist, y.hip, .5);
  // 팔·손·발
  const bm = adult ? { slim: .9, fit: 1.15, chubby: 1.2 }[build] || 1 : 1;
  const arm = { uw: H * .0425 * bm, hand: H * .1 };
  arm.fw = arm.uw * .85; arm.ww = arm.uw * .6;
  // 반폭
  const w = { nh: (age <= 12 ? 8.5 : f ? 10.5 : 12) * hs, sh: (adult && !f ? E.shoulder : C.shoulder) * PXCM / 2 };
  w.waist = half(E.waist, KW.waist) - (fitM ? 2 : 0);
  w.hip = half(E.hip, KW.hip);
  if (adult && f) {
    w.ub = half(E.underbust, KW.underbust); w.rib = w.ub + 1;   // rib: 가슴 높이의 몸통 (가슴 볼륨 뺀 폭)
    w.armpit = lerp(w.rib, w.sh, .45);
    const chord = lerp(w.armpit, w.ub, (y.bust - y.armpit) / (y.underbust - y.armpit));
    w.bust = Math.max(half(E.bust, KW.bust), chord + BUST_SIG[cup][0]);
  } else {
    w.bust = w.rib = half(E.chest, KW.bust) + (fitM ? 1.5 : 0);
    w.ub = lerp(w.bust, w.waist, .35); w.armpit = lerp(w.bust, w.sh, .4);
  }
  w.tip = w.sh - arm.uw * .4;   // 어깨 솔기: 팔 중심 바로 바깥. 팔(둥근 어깨 끝)은 여기서 바깥으로 나옴
  w.armpit = Math.min(w.armpit, w.tip - .3);
  w.hipUp = chubbyM ? Math.max(w.waist, w.hip) + 2.5 : lerp(w.waist, w.hip, f && !kid ? .68 : .5);   // 골반은 허리에서 바로 벌어짐 / 통통한 남자는 배
  // 다리 (한쪽): 허벅지 → 무릎(허벅지의 .68) → 종아리 → 발목(종아리의 .55)
  const gap = adult ? ({ slim: 3, avg: 1 }[build] ?? 0) : kid ? 2 : 1.5;
  const thighW = Math.min(pxW(E.thigh, 1), w.hip - .8 - gap / 2), kneeW = thighW * .68;
  const calfW = clamp(pxW(E.calf, 1), kneeW * 1.04, thighW * .92), ankleW = calfW * .55, foot = H * .136;
  const leg = { gap, thighW, kneeW, calfW, ankleW, ct: gap / 2 + thighW / 2, ck: kneeW / 2 + (f ? .5 : 1.5) + gap * .3, cc: calfW / 2 + (f ? 1.2 : 2.2) + gap * .3 };
  leg.ca = Math.max(ankleW / 2 + (f ? 2 : 3) + gap * .3, foot * .28);
  const edge = [[w.tip, y.sh + 1.2], [w.armpit, y.armpit], [w.bust, y.bust], [w.ub, y.underbust], [w.waist, y.waist], [w.hipUp, y.hipUp], [w.hip, y.hip], [w.hip - 1, y.crotch]];
  return { f, adult, kid, age, build, cup, ci, sig: cup ? BUST_SIG[cup] : null, fitM, chubbyM, hcm, H, top, headH, hs,
    htx: 60 - 60 * hs, hty: top - 26 * hs, y, w, leg, arm, foot, edge, C, E, at: yy => edgeAt(edge, yy),
    px: { height: H, shoulder: w.sh * 2, bust: w.bust * 2, underbust: w.ub * 2, waist: w.waist * 2, hip: w.hip * 2, thigh: thighW } };
}

// Catmull-Rom → 큐빅 베지어. 지금 위치가 pts[0]일 때 나머지 점을 부드럽게 지나는 C 명령들
function crThrough(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${P(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)} ${P(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)} ${P(p2[0], p2[1])}`;
  }
  return d;
}
// 오른쪽 윤곽 R([dx, y])을 좌우 대칭으로 닫음. 아래·위 가장자리는 가운데 조절점(botY, topY)으로 휨
function symShape(R, botY, topY) {
  const Rr = R.map(([dx, yy]) => [60 + dx, yy]), Lr = R.map(([dx, yy]) => [60 - dx, yy]).reverse();
  return `M${P(...Rr[0])}${crThrough(Rr)} Q60,${f1(botY)} ${P(...Lr[0])}${crThrough(Lr)} Q60,${f1(topY)} ${P(...Rr[0])} Z`;
}
// 굵기가 변하는 팔: [[x, y, 폭], ...]을 따라 양쪽 윤곽을 곡선으로. round면 시작 끝(어깨·팔꿈치)을 둥글게
function taperD(pts, round) {
  const Lp = [], Rp = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l * p[2] / 2, ny = (b[0] - a[0]) / l * p[2] / 2;
    Lp.push([p[0] + nx, p[1] + ny]); Rp.push([p[0] - nx, p[1] - ny]);
  });
  Rp.reverse();
  const r = f1(pts[0][2] / 2);
  return `M${P(...Lp[0])}${crThrough(Lp)} L${P(...Rp[0])}${crThrough(Rp)}${round ? ` A${r},${r} 0 0 0 ${P(...Lp[0])}` : ''} Z`;
}
// 다리 한쪽 바깥선·안쪽선 (s: 왼쪽 -1 / 오른쪽 1, e: 양쪽으로 더하는 여유분)
function legSide(A, s, e = 0) {
  const { y, w, leg: L } = A, X = dx => 60 + s * Math.max(.2, dx), ay = y.ankle + 2;
  return {
    outer: [[X(w.hip - .5 + e), y.hip], [X(L.ct + L.thighW / 2 + e), y.thigh], [X(L.ck + L.kneeW / 2 + e), y.knee], [X(L.cc + L.calfW / 2 + e), y.calf], [X(L.ca + L.ankleW / 2 + e), ay]],
    inner: [[X(L.ca - L.ankleW / 2 - e), ay], [X(L.cc - L.calfW / 2 - e), y.calf], [X(L.ck - L.kneeW / 2 - e), y.knee], [X(L.ct - L.thighW / 2 - e), y.thigh], [X(.2), y.crotch]],
  };
}
const pantsTop = (A, bt) => bt.tucked ? A.y.waist + 1 : lerp(A.y.waist, A.y.hip, .28);

// 하의 + 다리 + 신발. 바지·치마는 다리·골반 윤곽 + 여유분
function lowerFull(a, X, age, A, skin, bt) {
  const { y, w, leg: L } = A, k = A.hs, dk = shade(bt.c, .72), sw = v => f1(v * k);
  const shoeT = shoeOf(X, age, A, bt), kf = A.foot / 31 * (shoeT === 'heel' ? 1.23 : 1), sy0 = FLOOR - 10.4 * kf;   // 신발 길이 = 머리 .75 (정면이라 보이는 폭은 그 절반쯤)
  const shoes = [-1, 1].map(s => { const x = 60 + s * L.ca; return `<g transform="translate(${f1(x)},${f1(sy0)}) scale(${kf.toFixed(3)}) translate(${f1(-x)},${f1(-sy0)})">${shoe(shoeT, x, sy0, s, 4.4, skin, a)}</g>`; }).join('');
  const legD = s => { const { outer, inner } = legSide(A, s); return `M${P(60 + s * .2, y.hip)} L${P(...outer[0])}${crThrough(outer)} L${P(...inner[0])}${crThrough(inner)} Z`; };
  const bare = `<path d="${legD(-1)} ${legD(1)}" fill="${skin}"/>` +
    `<path d="${[-1, 1].map(s => `M${P(60 + s * (L.ck - L.kneeW * .3), y.knee + 1)} q${f1(s * L.kneeW * .3)},${sw(1.4)} ${f1(s * L.kneeW * .6)},0`).join(' ')}" fill="none" stroke="${shade(skin, .78)}" stroke-width="${sw(1)}" opacity=".55"/>`;
  const rl = legSide(A, 1), outAt = yy => edgeAt(rl.outer.map(([x, v]) => [x - 60, v]), yy), inAt = yy => edgeAt(rl.inner.slice().reverse().map(([x, v]) => [x - 60, v]), yy);
  if (bt.k === 'skirt') {
    const hemY = bt.uniform ? lerp(y.crotch, y.knee, .82) : age <= 12 ? lerp(y.crotch, y.knee, .55) : lerp(lerp(y.crotch, y.knee, .45), lerp(y.knee, y.calf, .6), X.hem);
    const topY = y.waist + 1, pencil = !bt.uniform && age > 12 && X.hem > .6;
    const ex = pencil ? 1 : 2, flare = pencil ? 0 : (hemY - y.hip) * .18 + (bt.uniform ? 2 : .5);
    const R = [[w.waist + 1, topY], [w.hipUp + ex * .8, y.hipUp], [w.hip + ex, y.hip], [pencil ? Math.max(outAt(hemY) + 1.5, w.hip - (hemY - y.hip) * .12) : w.hip + ex + flare, hemY]];
    const hw = R[3][0];
    let det;
    if (bt.uniform) {   // 교복 치마: 주름선 + 체크 선
      let pl = '';
      for (let i = -2; i <= 2; i++) pl += `M${f1(60 + i * (w.hip + 2) * .36)},${f1(y.hip - 2)} L${f1(60 + i * hw * .42)},${f1(hemY)} `;
      det = `<path d="${pl}" stroke="${dk}" stroke-width="${sw(1.1)}" opacity=".55"/><path d="M${f1(60 - hw + 1)},${f1(hemY - 9 * k)} L${f1(60 + hw - 1)},${f1(hemY - 9 * k)} M${f1(60 - w.hip)},${f1(y.hip + 6 * k)} L${f1(60 + w.hip)},${f1(y.hip + 6 * k)}" stroke="${shade(bt.c, 1.45)}" stroke-width="${sw(.9)}" opacity=".45"/>`;
    } else if (pencil) det = `<path d="M60,${f1(hemY)} L60,${f1(hemY - 9 * k)} M${f1(60 - w.hip * .5)},${f1(y.hip + 2)} Q${f1(60 - w.hip * .45)},${f1(hemY - 6 * k)} ${f1(60 - w.hip * .38)},${f1(hemY - 2 * k)}" fill="none" stroke="${dk}" stroke-width="${sw(1.1)}" opacity=".4"/>`;   // 뒤트임 + 주름
    else det = `<path d="M${f1(60 - w.hip * .45)},${f1(y.hip + 3)} Q${f1(60 - w.hip * .55)},${f1(hemY - 8 * k)} ${f1(60 - hw * .7)},${f1(hemY)} M${f1(60 + w.hip * .4)},${f1(y.hip + 4)} Q${f1(60 + w.hip * .5)},${f1(hemY - 8 * k)} ${f1(60 + hw * .62)},${f1(hemY)}" fill="none" stroke="${dk}" stroke-width="${sw(1.2)}" opacity=".35"/>`;   // A라인 주름
    const band = `<path d="M${f1(60 - w.waist - 1)},${f1(topY)} L${f1(60 + w.waist + 1)},${f1(topY)} L${f1(60 + w.waist + 1.3)},${f1(topY + 4 * k)} L${f1(60 - w.waist - 1.3)},${f1(topY + 4 * k)} Z" fill="${dk}" opacity=".7"/>`;
    return { svg: bare + shoes + `<path d="${symShape(R, hemY + 1.4, topY)}" fill="${bt.c}"/>` + det + band, belt: '', hipEdge: w.hip + ex };
  }
  // 바지·반바지: 허리 → 골반 → 다리 윤곽 + 여유분 (반바지는 허벅지에서 끝남)
  const cut = bt.k === 'shorts' ? 'short' : bt.cut || 'straight', e = cut === 'skinny' ? .5 : 2;
  const topY = pantsTop(A, bt), tw = A.at(topY) + .6, hemY = cut === 'short' ? lerp(y.crotch, y.knee, .35) : FLOOR - 9.5 * A.foot / 30;
  const sh = { cK: L.ck + .3, cA: (L.ck + L.ca) / 2 + .5, hw: Math.max(L.kneeW / 2 + 2.6, L.calfW / 2 + 2.2) };   // 일자: 무릎 아래 직선
  const wd = { cA: Math.max(L.ca + 1.5, L.ct), hw: L.thighW * .5 + 2.5 };   // 와이드
  const hems = [];   // [[바깥 x, 안쪽 x], ...] 오른쪽
  const side = s => {
    const X = dx => 60 + s * Math.max(-.3, dx), lo = legSide(A, s, e), crotch = [X(-.3), y.crotch + 1.5];
    let oc = [[X(tw), topY], [X(w.hip + e), y.hip]], ol = [], ic;
    if (cut === 'short') { oc.push([X(outAt(hemY) + e), hemY]); ic = [[X(inAt(hemY) - e), hemY], crotch]; }
    else if (cut === 'skinny') { oc.push(...lo.outer.slice(1, -1), [X(L.ca + L.ankleW / 2 + e + .3), hemY]); ic = [[X(L.ca - L.ankleW / 2 - e - .3), hemY], ...lo.inner.slice(1, -1), crotch]; }
    else if (cut === 'straight') { oc.push(lo.outer[1], [X(sh.cK + sh.hw), y.knee]); ol = [[X(sh.cA + sh.hw), hemY], [X(sh.cA - sh.hw), hemY]]; ic = [[X(sh.cK - sh.hw), y.knee], lo.inner[3], crotch]; }
    else { oc.push([X(L.ct + L.thighW / 2 + e + 1), y.thigh]); ol = [[X(wd.cA + wd.hw), hemY], [X(Math.max(.8, wd.cA - wd.hw)), hemY]]; ic = [lo.inner[3], crotch]; }
    if (s > 0) hems.push(ol.length ? [ol[0][0] - 60, ol[1][0] - 60] : [oc[oc.length - 1][0] - 60, ic[0][0] - 60]);
    return `M${P(60 - s * .6, topY)} L${P(...oc[0])}${crThrough(oc)}${ol.map(p => ` L${P(...p)}`).join('')} L${P(...ic[0])}${crThrough(ic)} L${P(60 - s * .6, y.crotch + 1.5)} Z`;
  };
  let out = (cut === 'short' ? bare : '') + shoes + `<path d="${side(-1)}" fill="${bt.c}"/><path d="${side(1)}" fill="${bt.c}"/>`;   // 좌우를 한 path에 넣으면 겹친 가운데가 뚫림
  const [ho, hi] = hems[0], hc = (ho + hi) / 2;
  const thighIn = L.ct - L.thighW / 2 - e, kneeIn = (cut === 'straight' ? sh.cK - sh.hw : L.ck - L.kneeW / 2 - e);
  const seamTo = cut === 'short' ? hemY : thighIn > .3 ? y.crotch + 1 : kneeIn > .3 ? lerp(y.thigh, y.knee, .5) : cut === 'wide' ? hemY : y.knee;   // 다리가 붙은 곳까지 안쪽 솔기
  out += `<path d="M60,${f1(topY + 2 * k)} L60,${f1(seamTo)}" stroke="${dk}" stroke-width="${sw(1)}" opacity=".6"/>`;
  out += `<path d="M${f1(60 - ho)},${f1(hemY - 3.5 * k)} L${f1(60 - hi)},${f1(hemY - 3.5 * k)} M${f1(60 + hi)},${f1(hemY - 3.5 * k)} L${f1(60 + ho)},${f1(hemY - 3.5 * k)}" stroke="${dk}" stroke-width="${sw(1.1)}" opacity=".55"/>`;   // 밑단 접힘
  if (cut !== 'short') {   // 무릎 가로 주름
    const kc = cut === 'straight' ? sh.cK : L.ck, kw = cut === 'straight' ? sh.hw : L.kneeW / 2 + e;
    out += `<path d="${[-1, 1].map(s => `M${P(60 + s * (kc - kw * .6), y.knee)} q${f1(s * kw * .6)},${sw(1.3)} ${f1(s * kw * 1.2)},0`).join(' ')}" fill="none" stroke="${dk}" stroke-width="${sw(1.1)}" opacity=".5"/>`;
  }
  if (bt.k === 'jeans') out += `<path d="M${f1(60 - w.hip - e + .6)},${f1(y.hip)} L${f1(60 - ho + .8)},${f1(hemY - 5 * k)} M${f1(60 + w.hip + e - .6)},${f1(y.hip)} L${f1(60 + ho - .8)},${f1(hemY - 5 * k)}" stroke="#d2a659" stroke-width="${sw(.8)}" stroke-dasharray="${sw(2)} ${sw(1.6)}" opacity=".6"/>` +
    `<path d="M${f1(60 - tw + 2 * k)},${f1(topY + k)} Q${f1(60 - tw + 5 * k)},${f1(y.hip - 4 * k)} ${f1(60 - w.hip - e)},${f1(y.hip - 2 * k)} M${f1(60 + tw - 2 * k)},${f1(topY + k)} Q${f1(60 + tw - 5 * k)},${f1(y.hip - 4 * k)} ${f1(60 + w.hip + e)},${f1(y.hip - 2 * k)}" fill="none" stroke="#d2a659" stroke-width="${sw(.8)}" opacity=".55"/>`;   // 옆선 스티치, 주머니
  if (bt.k === 'slacks' && cut !== 'short') out += `<path d="M${f1(60 - L.ct)},${f1(y.hip + 6 * k)} L${f1(60 - hc)},${f1(hemY - 6 * k)} M${f1(60 + L.ct)},${f1(y.hip + 6 * k)} L${f1(60 + hc)},${f1(hemY - 6 * k)}" stroke="${shade(bt.c, 1.3)}" stroke-width="${sw(.9)}" opacity=".45"/>`;   // 다림질 선
  const belt = bt.tucked ? `<path d="M${f1(60 - tw - .3)},${f1(topY - 2.5 * k)} L${f1(60 + tw + .3)},${f1(topY - 2.5 * k)} L${f1(60 + tw + .5)},${f1(topY + 2.5 * k)} L${f1(60 - tw - .5)},${f1(topY + 2.5 * k)} Z" fill="#2a211d"/><rect x="${f1(60 - 3 * k)}" y="${f1(topY - 3 * k)}" width="${sw(6)}" height="${sw(6)}" rx="${sw(1)}" fill="none" stroke="#c8a24a" stroke-width="${sw(1.2)}"/>` : '';
  return { svg: out, belt, hipEdge: w.hip + e };
}

// 윗옷 종류별 [여유분(한쪽 px), 헐렁함 0~1, 밑단 높이(허리→가랑이 비율), 가슴 볼록 반영]
//   티 / 셔츠 / 후디 / 니트(밑단 골지가 허리 바로 아래) / 교복 재킷
const TOP_FIT = [[1, 0, .55, 1], [2, .3, .62, 1], [5, .85, .6, .5], [3, .35, .3, 1], [4, .25, .75, .5]];
// 윗옷 (전신): 몸 앵커 + 여유분. 헐렁할수록 허리 곡선이 덜 드러남. 어른 여자는 컵별 신호 4종
function topFull(a, top, A, skin, bt) {
  const c = top === 4 ? UNIFORM.blazer : TOP_COLORS[a.tc], dark = shade(c, .78), fold = shade(c, .58);
  const [e, loose, hemR, bustF] = TOP_FIT[top] || TOP_FIT[0];
  const { y, w } = A, k = A.hs, sw = v => f1(v * k), nh = w.nh, ny = y.neck, sig = A.adult && A.f ? A.sig : null;
  const tucked = !!bt.tucked, rib = top === 2 || top === 3, fitted = top === 0 || top === 1 || top === 3;
  const hemY = tucked ? pantsTop(A, bt) + 2.5 : y.waist + (y.crotch - y.waist) * hemR;
  const lift = tucked ? 0 : (sig ? sig[4] : 0) + (A.chubbyM ? 2 : 0);
  const bustW = w.rib + (w.bust - w.rib) * bustF;   // 헐렁한 옷은 옆 볼록이 절반
  const straight = lerp(w.waist, Math.max(w.ub, Math.min(bustW, w.hip) * .97), loose);
  const below = yy => Math.max(A.at(yy), lerp(A.at(yy), straight, loose)) + e;
  const R = [[nh + 2 * k, ny], [lerp(nh, w.sh, .58) + e * .4, lerp(ny, y.sh, .72)], [w.tip + e * .6, y.sh + 1.2], [w.armpit + e, y.armpit],
    [bustW + e, y.bust], [lerp(w.ub, bustW, loose * .7) + e, y.underbust]];
  if (hemY > y.waist + 2) R.push([straight + e, y.waist]);
  for (const yy of [y.hipUp, y.hip]) if (yy < hemY - 2) R.push([below(yy), yy]);
  const hemW = (hemY > y.waist ? below(hemY) : A.at(hemY) + e) - (rib ? 1.4 : 0);   // 후디·니트는 밑단 골지가 조임
  R.push([hemW, hemY]);
  let o = `<path d="${symShape(R, hemY + 1.4 - 2 * lift, ny + 2)}" fill="${c}" stroke="${shade(c, .6)}" stroke-width=".55" stroke-opacity=".55"/>`;
  if (top === 4) {   // 교복: 셔츠 V + 라펠 + 넥타이/리본 + 단추 + 왼가슴 마크
    const tie = UNIFORM.tie[a.tie], vy = lerp(y.armpit, y.bust, .85);
    o += `<path d="M${f1(60 - nh - k)},${f1(ny)} L60,${f1(vy)} L${f1(60 + nh + k)},${f1(ny)} Z" fill="${UNIFORM.shirt}"/>
      <path d="M${f1(60 - nh - k)},${f1(ny)} L60,${f1(vy)} L${f1(60 - nh - 8 * k)},${f1(vy - 4 * k)} L${f1(60 - nh - 9 * k)},${f1(ny + 4 * k)} Z M${f1(60 + nh + k)},${f1(ny)} L60,${f1(vy)} L${f1(60 + nh + 8 * k)},${f1(vy - 4 * k)} L${f1(60 + nh + 9 * k)},${f1(ny + 4 * k)} Z" fill="${shade(c, 1.25)}"/>
      ${A.f ? `<path d="M60,${f1(ny + 7 * k)} L${f1(60 - 8.5 * k)},${f1(ny + 2.5 * k)} L${f1(60 - 8.5 * k)},${f1(ny + 11.5 * k)} Z M60,${f1(ny + 7 * k)} L${f1(60 + 8.5 * k)},${f1(ny + 2.5 * k)} L${f1(60 + 8.5 * k)},${f1(ny + 11.5 * k)} Z" fill="${tie}"/><circle cx="60" cy="${f1(ny + 7 * k)}" r="${sw(2.4)}" fill="${shade(tie, .8)}"/>`
        : `<path d="M${f1(60 - 3 * k)},${f1(ny + 3 * k)} L${f1(60 + 3 * k)},${f1(ny + 3 * k)} L${f1(60 + 2 * k)},${f1(ny + 7 * k)} L${f1(60 + 4 * k)},${f1(vy - 4 * k)} L60,${f1(vy + k)} L${f1(60 - 4 * k)},${f1(vy - 4 * k)} L${f1(60 - 2 * k)},${f1(ny + 7 * k)} Z" fill="${tie}"/>`}
      <circle cx="60" cy="${f1(y.waist - 6 * k)}" r="${sw(1.6)}" fill="${shade(c, 1.5)}"/><circle cx="60" cy="${f1(y.waist + 6 * k)}" r="${sw(1.6)}" fill="${shade(c, 1.5)}"/>
      <path d="M${f1(60 + w.rib * .45)},${f1(y.bust - 5 * k)} l${sw(7)},0 l0,${sw(5.6)} q${sw(-3.5)},${sw(3.4)} ${sw(-7)},0 Z" fill="#c8a24a" opacity=".85"/>
      <path d="M60,${f1(vy)} L60,${f1(hemY)}" stroke="${shade(c, .6)}" stroke-width="${sw(1)}" opacity=".6"/>`;
  } else if (top === 0) {   // 티셔츠: 라운드 넥 + 쇄골
    const nl = `M${f1(60 - nh - 3 * k)},${f1(ny)} Q60,${f1(ny + 13 * k)} ${f1(60 + nh + 3 * k)},${f1(ny)}`;
    o += `<path d="${nl}" fill="${skin}"/>${clav(ny + 4.5 * k, nh + 2 * k, skin, k)}<path d="${nl}" fill="none" stroke="${dark}" stroke-width="${sw(3)}"/>`;
  } else if (top === 1) {   // 셔츠: 뾰족한 칼라 + 단추 + 가슴 주머니(남)
    o += `<path d="M${f1(60 - nh + 1.5 * k)},${f1(ny)} L60,${f1(ny + 15 * k)} L${f1(60 + nh - 1.5 * k)},${f1(ny)} Z" fill="${skin}"/>${clav(ny + 4 * k, nh - 2 * k, skin, k)}
      <path d="M${f1(60 - nh)},${f1(ny - k)} L60,${f1(ny + 15 * k)} L${f1(60 - nh + 3 * k)},${f1(ny + 19 * k)} L${f1(60 - nh - 6 * k)},${f1(ny + 5 * k)} Z M${f1(60 + nh)},${f1(ny - k)} L60,${f1(ny + 15 * k)} L${f1(60 + nh - 3 * k)},${f1(ny + 19 * k)} L${f1(60 + nh + 6 * k)},${f1(ny + 5 * k)} Z" fill="${shade(c, 1.35)}" stroke="${dark}" stroke-width="${sw(1)}"/>
      <path d="M60,${f1(ny + 15 * k)} L60,${f1(hemY)}" stroke="${dark}" stroke-width="${sw(1.2)}"/>
      ${[0, 1, 2, 3].map(i => `<circle cx="60" cy="${f1(ny + 22 * k + i * (hemY - ny - 28 * k) / 3)}" r="${sw(1.3)}" fill="${dark}"/>`).join('')}
      ${!A.f ? `<path d="M${f1(60 + w.rib * .3)},${f1(y.bust - 6 * k)} l${sw(9)},0 l0,${sw(9)} l${sw(-9)},0 Z" fill="none" stroke="${dark}" stroke-width="${sw(1)}" opacity=".6"/>` : ''}`;
    if (sig && A.ci >= 5) o += `<path d="M60,${f1(y.bust - 2.4)} Q61.4,${f1(y.bust)} 60,${f1(y.bust + 2.4)} Q58.6,${f1(y.bust)} 60,${f1(y.bust - 2.4)} Z" fill="${shade(skin, .92)}" stroke="${dark}" stroke-width=".5"/>`;   // 단추 사이 벌어짐
  } else if (top === 2) {   // 후디: 후드 + 끈 + 캥거루 주머니 + 밑단 골지
    const pw = straight * .62 + e * .3, py = y.waist - 6 * k;
    o += `<path d="M${f1(60 - nh - 10 * k)},${f1(ny + 5 * k)} C${f1(60 - nh - 9 * k)},${f1(ny - 9 * k)} ${f1(60 + nh + 9 * k)},${f1(ny - 9 * k)} ${f1(60 + nh + 10 * k)},${f1(ny + 5 * k)} C${f1(60 + nh)},${f1(ny + 14 * k)} ${f1(60 - nh)},${f1(ny + 14 * k)} ${f1(60 - nh - 10 * k)},${f1(ny + 5 * k)} Z" fill="${dark}"/>
      <path d="M${f1(60 - nh - k)},${f1(ny)} Q60,${f1(ny + 10 * k)} ${f1(60 + nh + k)},${f1(ny)}" fill="${skin}"/>
      <path d="M${f1(60 - 5 * k)},${f1(ny + 9 * k)} L${f1(60 - 6 * k)},${f1(ny + 28 * k)} M${f1(60 + 5 * k)},${f1(ny + 9 * k)} L${f1(60 + 6 * k)},${f1(ny + 28 * k)}" stroke="${shade(c, 1.5)}" stroke-width="${sw(1.6)}" stroke-linecap="round"/>
      <path d="M${f1(60 - pw)},${f1(py + 16 * k)} L${f1(60 - pw + 5 * k)},${f1(py)} Q60,${f1(py - 4 * k)} ${f1(60 + pw - 5 * k)},${f1(py)} L${f1(60 + pw)},${f1(py + 16 * k)} Z" fill="none" stroke="${fold}" stroke-width="${sw(1.3)}" opacity=".45"/>
      <path d="M${f1(60 - hemW)},${f1(hemY - 5 * k)} L${f1(60 + hemW)},${f1(hemY - 5 * k)}" stroke="${fold}" stroke-width="${sw(1.2)}" opacity=".4"/>`;
  } else {   // 니트: 라운드 넥 골지 + 짜임 물결 + 밑단 골지
    const rows = [lerp(y.armpit, y.bust, .5), lerp(y.bust, y.waist, .55)].map(yy => {
      const half = edgeAt(R, yy) - 2 * k; let d = `M${f1(60 - half)},${f1(yy)}`;
      for (let x = 60 - half, i = 0; x < 60 + half - 5 * k; x += 6 * k, i++) d += ` q${sw(3)},${sw(i % 2 ? 2.4 : -2.4)} ${sw(6)},0`;
      return d;
    }).join(' ');
    o += `<path d="M${f1(60 - nh - 3 * k)},${f1(ny - k)} Q60,${f1(ny + 9 * k)} ${f1(60 + nh + 3 * k)},${f1(ny - k)} L${f1(60 + nh + 3 * k)},${f1(ny + 4 * k)} Q60,${f1(ny + 14 * k)} ${f1(60 - nh - 3 * k)},${f1(ny + 4 * k)} Z" fill="${dark}"/>
      <path d="M${f1(60 - nh - k)},${f1(ny - k)} Q60,${f1(ny + 7 * k)} ${f1(60 + nh + k)},${f1(ny - k)}" fill="${skin}"/>
      <path d="${rows}" fill="none" stroke="${dark}" stroke-width="${sw(1)}" opacity=".3"/>
      <path d="${Array.from({ length: 9 }, (_, i) => { const x = 60 - hemW + 1.5 + i * (hemW * 2 - 3) / 8; return `M${f1(x)},${f1(hemY - 6 * k)} L${f1(x)},${f1(hemY)}`; }).join(' ')}" stroke="${dark}" stroke-width="${sw(1.2)}"/>`;
  }
  // 주름·그림자: 겨드랑이, 옷깃 아래, 허리 옆(몸에 붙는 옷)
  const sf = `fill="none" stroke="${fold}" stroke-linecap="round"`, ax = w.armpit + e;
  o += `<path d="M${f1(60 - ax + .4)},${f1(y.armpit)} L${f1(60 - ax + 4.5 * k)},${f1(y.armpit + 3 * k)} L${f1(60 - ax + k)},${f1(y.armpit + 10 * k)} Z M${f1(60 + ax - .4)},${f1(y.armpit)} L${f1(60 + ax - 4.5 * k)},${f1(y.armpit + 3 * k)} L${f1(60 + ax - k)},${f1(y.armpit + 10 * k)} Z" fill="${fold}" opacity=".2"/>`;
  if (top !== 4) o += `<path d="M${f1(60 - nh - 4 * k)},${f1(ny + 4 * k)} Q60,${f1(ny + 19 * k)} ${f1(60 + nh + 4 * k)},${f1(ny + 4 * k)}" ${sf} stroke-width="${sw(2)}" opacity=".14"/>`;
  if (fitted && hemY > y.waist + 2) {
    const wx = straight + e;
    o += `<path d="${[-1, 1].map(s => `M${f1(60 + s * (wx - 2.5 * k))},${f1(y.waist - 7 * k)} L${f1(60 + s * (wx - 2 * k))},${f1(y.waist + k)} M${f1(60 + s * (wx - 5.5 * k))},${f1(y.waist - 5 * k)} L${f1(60 + s * (wx - 5 * k))},${f1(y.waist + 1.5 * k)}`).join(' ')}" ${sf} stroke-width="${sw(1.2)}" opacity=".2"/>`;
  }
  if (sig && sig[1]) {   // ② 밑가슴 그림자 ③ 윗면 하이라이트 (④ 밑단 들림은 윤곽에서)
    const yS = lerp(y.bust, y.underbust, .55), d = sig[1], wS = bustW * sig[2];
    o += `<path d="${[-1, 1].map(s => `M${f1(60 + s * 2)},${f1(yS)} Q${f1(60 + s * wS * .55)},${f1(yS + d * 1.2)} ${f1(60 + s * wS * .95)},${f1(yS - d * .45)}`).join(' ')}" ${sf} stroke-width=".8" opacity=".3"/>`;
    o += [-1, 1].map(s => `<ellipse cx="${f1(60 + s * bustW * .5)}" cy="${f1(lerp(y.armpit, y.bust, .6))}" rx="${f1(bustW * .22)}" ry="${f1(.9 + A.ci * .14)}" fill="#fff" opacity="${sig[3]}"/>`).join('');
    if (fitted && A.ci >= 4) {   // 옷 장력 주름: 가슴에서 겨드랑이 쪽으로 (D 1개, E 이상 2개)
      let dd = '';
      for (let i = 0; i < (A.ci >= 5 ? 2 : 1); i++) for (const s of [-1, 1]) dd += `M${f1(60 + s * bustW * .62)},${f1(y.bust - 1 - i * 2.4 * k)} Q${f1(60 + s * bustW * .82)},${f1(y.bust - 3 - i * 2.4 * k)} ${f1(60 + s * (ax - 1.2))},${f1(y.armpit + 2.5 - i * 1.2 * k)} `;
      o += `<path d="${dd}" ${sf} stroke-width=".7" opacity=".3"/>`;
    }
    if ((top === 0 || top === 3) && A.ci >= 2) {
      const op = top === 3 ? .13 : .09;
      const nipY = A.ci >= 4 ? y.bust + 2 : y.bust + .8;
      o += [-1, 1].map(s => `<circle cx="${f1(60 + s * bustW * .5)}" cy="${f1(nipY)}" r="${f1(.7 + A.ci * .1)}" fill="${shade(skin, .52)}" opacity="${op}"/>`).join('');
    }
  } else if (!A.f && A.adult && (A.fitM || A.C.shoulder >= 46)) o += `<path d="M${f1(60 - w.rib * .7)},${f1(y.bust + 1)} Q${f1(60 - w.rib * .35)},${f1(y.bust + 3)} 59,${f1(y.bust + 1.5)} M${f1(60 + w.rib * .7)},${f1(y.bust + 1)} Q${f1(60 + w.rib * .35)},${f1(y.bust + 3)} 61,${f1(y.bust + 1.5)}" ${sf} stroke-width=".9" opacity=".22"/>`;   // 가슴 근육선
  return { svg: o, color: c, gw: yy => edgeAt(R, yy), bustEdge: bustW + e };
}

// 팔: 어깨 끝에서 시작해 골반보다 바깥으로 떨어짐. 기본 자세는 몸통 뒤에 그려서 가슴·허리 윤곽이 가려지지 않게
//   default 차렷 / hip 한 손 허리(팔꿈치는 허리 높이에서 바깥, 팔과 허리 사이 빈 삼각형) / cross 팔짱(밑가슴 +2px, 가슴에 밀려 바깥으로)
function armsFull(A, top, pose, skin, T, lowHip) {
  const { y, w } = A, { uw, fw, ww, hand } = A.arm, k = A.hs, c = T.color, shortSl = top === 0, ln = shade(c, .6);
  const jx = w.sh - uw / 2, jy = y.sh + uw * .45, capR = uw / 2 + (A.adult && !A.f ? (A.fitM ? 2.5 : 1.2) : 0);   // 남자는 삼각근 볼륨
  const rotOf = (E, W) => Math.atan2(-(W[0] - E[0]), W[1] - E[1]) * 180 / Math.PI;
  const cuff = (E, W, wd) => {
    const x = lerp(E[0], W[0], .84), yy = lerp(E[1], W[1], .84), l = Math.hypot(W[0] - E[0], W[1] - E[1]) || 1, nx = -(W[1] - E[1]) / l * wd * .55, ny = (W[0] - E[0]) / l * wd * .55;
    return `<path d="M${P(x - nx, yy - ny)} L${P(x + nx, yy + ny)}" stroke="${ln}" stroke-width="${f1(1.4 * k)}" opacity=".55"/>`;
  };
  // 팔 한 마디: 반팔이면 소매 아래는 살
  const seg = (pts, dim, sleeveTo) => {
    const sc = dim ? shade(c, .9) : c, sk = dim ? shade(skin, .94) : skin;
    if (!shortSl) return `<path d="${taperD(pts, true)}" fill="${sc}" stroke="${ln}" stroke-width=".5"/>`;
    let o = `<path d="${taperD(pts, true)}" fill="${sk}" stroke="${shade(skin, .72)}" stroke-width=".5"/>`;
    if (sleeveTo) { const p = pts[0], q = pts[pts.length - 1], m = [lerp(p[0], q[0], sleeveTo), lerp(p[1], q[1], sleeveTo)]; o += `<path d="${taperD([[p[0], p[1], p[2] + 1.2 * k], [m[0], m[1], uw + 1.3 * k]], true)}" fill="${sc}" stroke="${ln}" stroke-width=".5"/>`; }
    return o;
  };
  const one = (s, E, W, rot, dim) => {
    const J = [60 + s * jx, jy];
    const pts = [[J[0], J[1], capR * 2], [lerp(J[0], E[0], .4) + s * .5, lerp(J[1], E[1], .4), uw], [E[0], E[1], (uw + fw) / 2], [(E[0] + W[0]) / 2 + s * .3, (E[1] + W[1]) / 2, fw * .9], [W[0], W[1], ww]];
    let o = seg(pts, dim, .2);
    if (!shortSl) o += cuff(E, W, ww * 1.5);
    o += `<path d="M${P(E[0] - s * fw * .25, E[1] + 2 * k)} Q${P((E[0] + W[0]) / 2 - s * fw * .35, (E[1] + W[1]) / 2)} ${P(W[0] - s * ww * .3, W[1] - 2 * k)}" fill="none" stroke="${shade(shortSl ? skin : c, .72)}" stroke-width="${f1(k)}" opacity=".35"/>`;   // 팔 안쪽 그림자
    return o + handAt(W[0], W[1], s, skin, rot, hand);
  };
  const tB = clamp((y.bust - jy) / (y.waist - jy), .2, 1);
  const xe = Math.max(jx + 1, T.gw(y.waist) + uw / 2 + 2.5, jx + (T.bustEdge + 1.5 - uw / 2 - jx) / tB);
  const yw = lerp(y.hip, y.crotch, .55), xw = Math.max(Math.max(lowHip, T.gw(yw)) + ww / 2 + 1.5, xe + 1);
  const def = (s, dim) => { const E = [60 + s * xe, y.waist], W = [60 + s * xw, yw]; return one(s, E, W, rotOf(E, W) * .7, dim); };
  if (pose === 'hip') {
    const yh = lerp(y.waist, y.hip, .42), E = [60 + T.gw(y.waist) + uw * 1.3 + 3.5, y.waist - (y.waist - y.sh) * .06];
    const W = [60 + Math.max(T.gw(yh), lowHip * .92) + ww * .2, yh - hand * .3];
    return { back: def(-1, true), front: one(1, E, W, 42, false) };
  }
  if (pose === 'cross') {
    const yc = (A.adult && A.f ? y.underbust : lerp(y.bust, y.waist, .35)) + 2 + fw / 2;
    const ex = Math.max(T.bustEdge, xe + uw / 2) + 2 - uw / 2;
    const up = s => { const J = [60 + s * jx, jy], E = [60 + s * ex, yc]; return seg([[J[0], J[1], capR * 2], [lerp(J[0], E[0], .5) + s * .8, lerp(J[1], E[1], .5), uw], [E[0], E[1], uw * .98]], true, .45); };
    const fore = (s, E, W) => seg([[E[0], E[1], (uw + fw) / 2], [lerp(E[0], W[0], .5), lerp(E[1], W[1], .5) + fw * .15, fw * .95], [W[0], W[1], ww * 1.25]], false, 0) + (shortSl ? '' : cuff(E, W, ww * 1.7));
    const ER = [60 + ex, yc], EL = [60 - ex, yc + fw * .55];
    return { back: up(-1) + up(1),
      front: fore(1, ER, [60 - ex + uw * .9, yc - fw * .2]) + fore(-1, EL, [60 + ex - uw * 1.1, yc + fw * .15]) + handAt(60 + ex - uw * .75, yc + fw * .1, 1, skin, -160, hand * .72) };
  }
  return { back: def(-1, true) + def(1, true), front: '' };
}
// 테스트용 가이드: 앵커 높이 + 바닥선
function guidesSVG(A) {
  const ys = ['chin', 'sh', 'bust', 'underbust', 'waist', 'hip', 'crotch', 'thigh', 'knee', 'calf', 'ankle'].map(k => A.y[k]);
  return `<g class="av-guides"><path d="${ys.map(v => `M2,${f1(v)} L118,${f1(v)}`).join(' ')}" stroke="#d33" stroke-width=".35" opacity=".4"/><path d="M0,${FLOOR} L120,${FLOOR}" stroke="#333" stroke-width=".6" opacity=".6"/></g>`;
}

/* ---------- 함께 밤을 보낸 다음 날 아침 (어른만, 상반신) ---------- */
const tierOf = v => v >= 90 ? 4 : v >= 70 ? 3 : v >= 50 ? 2 : v >= 30 ? 1 : 0;
function morningBody(a, skin, skinD, hw, tier, fig, lipstick) {
  tier = tier || 0;
  const female = a.g === 'f', b = a.body || {};
  const blanketY = female ? [120, 124, 128, 133, 137][tier] : [128, 132, 136, 140, 144][tier];
  let o = `<path d="${body(false, hw)}" fill="${skinD}"/>`;
  o += `<path d="M47,121 Q53,124 58,122 M62,122 Q67,124 73,121" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.3" stroke-linecap="round"/>`;
  if (female) {
    const cup = fig && fig.cup ? CUP_OUT[fig.cup] || 5.5 : ({ small: 2.5, large: 9.5 }[b.chest] ?? 5.5);
    const bustW = 5 + cup * .45, clY = 125;
    o += `<path d="M${60 - hw + 8},${clY - 6} Q${60 - bustW - 1},${clY - 1} ${59},${clY + 1} M${61},${clY + 1} Q${60 + bustW + 1},${clY - 1} ${60 + hw - 8},${clY - 6}" fill="none" stroke="${shade(skin, .68)}" stroke-width="1.3" opacity=".5" stroke-linecap="round"/>`;
    o += `<path d="M59,${clY - 1} Q60,${clY + 5} 61,${clY - 1}" fill="none" stroke="${shade(skin, .55)}" stroke-width="1.2" opacity=".45"/>`;
    o += `<path d="M${60 - hw + 3},${clY - 4} Q${60 - hw},${clY + 3} ${60 - hw + 4},${clY + 6} M${60 + hw - 3},${clY - 4} Q${60 + hw},${clY + 3} ${60 + hw - 4},${clY + 6}" fill="none" stroke="${shade(skin, .62)}" stroke-width="1" opacity=".3"/>`;
  } else {
    o += `<path d="M42,126 Q50,131 58,127 M62,127 Q70,131 78,126" fill="none" stroke="${shade(skin, .68)}" stroke-width="1.2" opacity=".4"/>`;
  }
  if (tier >= 2) o += `<ellipse cx="46" cy="116" rx="1.3" ry="1.8" fill="#87ceeb" opacity=".45"/>`;
  if (tier >= 3) {
    o += `<ellipse cx="74" cy="114" rx="1.1" ry="1.6" fill="#87ceeb" opacity=".4"/>`;
    if (lipstick) {
      o += `<path d="M72,108 q2,-2.5 4,0 q2,-2.5 4,0 q-2,3.5 -4,3.5 q-2,0 -4,-3.5 Z" fill="#c43c4f" opacity=".6" transform="rotate(-8 75 109)"/>`;
      o += `<path d="M44,104 q2,-2 3.5,0 q2,-2 3.5,0 q-2,3 -3.5,3 q-2,0 -3.5,-3 Z" fill="#c43c4f" opacity=".5" transform="rotate(12 47 105)"/>`;
    }
    if (tier >= 4) {
      o += `<path d="M80,116 q1.5,-2 3,0 q1.5,-2 3,0 q-1.5,3 -3,3 q-1.5,0 -3,-3 Z" fill="#c43c4f" opacity=".55" transform="rotate(-15 82 117)"/>`;
      o += `<path d="M35,118 q5,-3 10,0" fill="none" stroke="#c86070" stroke-width="1.4" opacity=".55"/>`;
      o += `<path d="M36,120 q4,2.5 8,0" fill="none" stroke="#c86070" stroke-width="1.2" opacity=".45"/>`;
    }
  }
  o += `<path d="M0,${blanketY + 6} C20,${blanketY - 4} 40,${blanketY + 4} 60,${blanketY} C80,${blanketY - 4} 100,${blanketY + 5} 120,${blanketY - 2} L120,160 L0,160 Z" fill="#ece6da"/>`;
  o += `<path d="M18,${blanketY + 12} Q34,${blanketY + 22} 30,160 M84,${blanketY + 10} Q76,${blanketY + 24} 88,160 M52,${blanketY + 8} Q58,${blanketY + 18} 54,${blanketY + 30}" fill="none" stroke="#cfc6b6" stroke-width="1.6" stroke-linecap="round"/>`;
  return o;
}
function messyHair(hc, n) {
  const list = ['M40,40 q-7,-4 -9,4', 'M78,36 q8,-5 11,3', 'M55,31 q-2,-9 6,-10', 'M34,58 q-7,1 -6,8', 'M86,56 q7,2 5,9'];
  return list.slice(0, n).map(d => `<path d="${d}" fill="none" stroke="${hc}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
}

/* ---------- 알몸 전신 (preIntimate, 20살 이상만) ---------- */
function nudeTorso(F, skin, skinD) {
  const bust = F.bust || 0, sl = `fill="none" stroke="${shade(skin, .65)}" stroke-width="1" stroke-linecap="round"`;
  const bustPeak = F.chest + 14 + bust * .35;
  const segs = F.f ? [
    { c: [F.sh - 1, F.sy + 6, F.sh + 1, F.sy + 12], p: [F.sh, F.sy + 16] },
    { c: [F.sh + bust * .55, F.chest + 6, F.rib + bust * 1.05, bustPeak - 5], p: [F.rib + bust * .85, bustPeak] },
    { c: [F.rib + bust * .4, bustPeak + 8, F.rib - .5, bustPeak + 12], p: [F.rib - 1.5, bustPeak + 10] },
    { c: [F.rib - 2.5, F.waistY - 16, F.waist + .5, F.waistY - 6], p: [F.waist, F.waistY] },
    { c: [F.waist + 1, F.waistY + 10, F.hip + .5, F.hipY - 8], p: [F.hip + 1.5, F.hipY] },
    { c: [F.hip + 2, F.hipY + 10, F.hip, F.crotch - 6], p: [F.hip * .45, F.crotch] },
    { p: [0, F.crotch + 2] },
  ] : [
    { c: [F.sh - 1, F.sy + 5, F.sh + 1, F.sy + 10], p: [F.sh, F.sy + 16] },
    { c: [F.sh + 1, F.sy + 24, F.rib + 1, F.chest + 8], p: [F.rib, F.chest + 18] },
    { c: [F.rib - 1, F.waistY - 16, F.waist + .5, F.waistY - 6], p: [F.waist, F.waistY] },
    { c: [F.waist + .5, F.waistY + 8, F.hip + .5, F.hipY - 6], p: [F.hip + 1, F.hipY] },
    { c: [F.hip + 1.5, F.hipY + 8, F.hip - .5, F.crotch - 5], p: [F.hip * .4, F.crotch] },
    { p: [0, F.crotch + 2] },
  ];
  let o = `<path d="${sym([F.nh + 1.5, F.sy - 2], segs)}" fill="${skin}"/>`;
  if (F.f) {
    o += `<path d="M${f1(60 - F.rib - bust * .3)},${f1(bustPeak + 4)} Q${f1(60 - F.rib * .5)},${f1(bustPeak + 8 + bust * .14)} 59,${f1(bustPeak + 5)} M61,${f1(bustPeak + 5)} Q${f1(60 + F.rib * .5)},${f1(bustPeak + 8 + bust * .14)} ${f1(60 + F.rib + bust * .3)},${f1(bustPeak + 4)}" ${sl} opacity=".4"/>`;
    o += `<path d="M59,${f1(F.chest + 10)} Q60,${f1(bustPeak + 2)} 61,${f1(F.chest + 10)}" fill="none" stroke="${shade(skin, .55)}" stroke-width="1.2" opacity=".45"/>`;
  } else {
    o += `<path d="M${f1(60 - F.rib * .8)},${f1(F.chest + 6)} Q${f1(60 - F.rib * .3)},${f1(F.chest + 13)} 59,${f1(F.chest + 10)} M${f1(60 + F.rib * .8)},${f1(F.chest + 6)} Q${f1(60 + F.rib * .3)},${f1(F.chest + 13)} 61,${f1(F.chest + 10)}" ${sl} opacity=".35"/>`;
  }
  o += `<ellipse cx="60" cy="${f1(F.waistY + 5)}" rx="1.5" ry="2" fill="none" stroke="${shade(skin, .58)}" stroke-width="1" opacity=".5"/>`;
  o += `<path d="M${f1(60 - F.hip * .3)},${f1(F.crotch - 8)} Q${f1(60 - 3)},${f1(F.crotch)} ${f1(60 - 1.5)},${f1(F.crotch + 6)} M${f1(60 + F.hip * .3)},${f1(F.crotch - 8)} Q${f1(60 + 3)},${f1(F.crotch)} ${f1(60 + 1.5)},${f1(F.crotch + 6)}" ${sl} opacity=".35"/>`;
  o += `<path d="M${f1(60 - F.waist * .45)},${f1(F.waistY + 12)} Q60,${f1(F.waistY + 18)} ${f1(60 + F.waist * .45)},${f1(F.waistY + 12)}" ${sl} opacity=".25"/>`;
  return o;
}
function coverArms(F, skin, personality) {
  const bust = F.bust || 0, bustPeak = F.chest + 14 + bust * .35, aw = F.arm * 2, fw = F.fore * 2;
  const pers = personality || 'warm';
  let o = '';
  if (F.f) {
    if (pers === 'bold') {
      const sx = 60 + F.sh - 2, sy = F.sy + 12, mx = 60 + F.rib * .1, my = bustPeak + 4, ex = 60 - F.rib * .3, ey = bustPeak + 6;
      o += limb(sx, sy, (sx + mx) / 2 + 2, (sy + my) / 2 + 2, mx, my, aw - 1, skin);
      o += limb(mx, my, (mx + ex) / 2, (my + ey) / 2, ex, ey, fw - 1, skin);
      o += mitt(ex - 1, ey, -1, skin, -20);
      const jsx = 60 - F.sh + 1, jsy = F.sy + 12, elx = 60 - F.sh + 8, ely = F.waistY + 10;
      const gx = 60 - 2, gy = F.crotch + 2;
      o += limb(jsx, jsy, (jsx + elx) / 2 - 2, (jsy + ely) / 2, elx, ely, aw - 1, skin);
      o += limb(elx, ely, (elx + gx) / 2, (ely + gy) / 2 + 3, gx, gy, fw - 1, skin);
      o += mitt(gx, gy + 2, 1, skin, 80);
    } else if (pers === 'shy' || pers === 'sensitive') {
      const sx = 60 + F.sh - 2, sy = F.sy + 10;
      const mx = 60 - F.rib * .4, my = bustPeak - 3, ex = 60 - F.sh + 3, ey = bustPeak - 6;
      o += limb(sx, sy, (sx + mx) / 2 + 4, (sy + my) / 2, mx, my, aw - 1, skin);
      o += limb(mx, my, (mx + ex) / 2 - 2, (my + ey) / 2 + 1, ex, ey, fw - 1, skin);
      o += mitt(ex - 2, ey, -1, skin, -45);
      const jsx = 60 - F.sh + 1, jsy = F.sy + 10;
      const elx = 60 - F.sh + 4, ely = F.waistY;
      const gx = 60 + 1, gy = F.crotch - 8;
      o += limb(jsx, jsy, (jsx + elx) / 2 - 4, (jsy + ely) / 2, elx, ely, aw - 1, skin);
      o += limb(elx, ely, (elx + gx) / 2 - 1, (ely + gy) / 2 + 3, gx, gy, fw - 1, skin);
      o += mitt(gx, gy + 1, 1, skin, 85);
    } else {
      const sx = 60 + F.sh - 2, sy = F.sy + 12, mx = 60 - F.rib * .2, my = bustPeak, ex = 60 - F.sh + 5, ey = bustPeak - 4;
      o += limb(sx, sy, (sx + mx) / 2 + 3, (sy + my) / 2, mx, my, aw - 1, skin);
      o += limb(mx, my, (mx + ex) / 2 - 1, (my + ey) / 2 + 2, ex, ey, fw - 1, skin);
      o += mitt(ex - 2, ey, -1, skin, -40);
      const gx = 60, gy = F.crotch - 6, elx = 60 - F.sh + 6, ely = F.waistY + 4;
      const jsx = 60 - F.sh + 1, jsy = F.sy + 12;
      o += limb(jsx, jsy, (jsx + elx) / 2 - 3, (jsy + ely) / 2, elx, ely, aw - 1, skin);
      o += limb(elx, ely, (elx + gx) / 2, (ely + gy) / 2 + 4, gx, gy, fw - 1, skin);
      o += mitt(gx, gy + 2, 1, skin, 85);
    }
  } else {
    const jsx = 60 + F.sh - 2, jsy = F.sy + 14;
    const elx = 60 + F.sh - 8, ely = F.waistY + 2;
    const gx = 60 + 1, gy = F.crotch - 6;
    o += limb(jsx, jsy, (jsx + elx) / 2 + 2, (jsy + ely) / 2, elx, ely, aw, skin);
    o += limb(elx, ely, (elx + gx) / 2, (ely + gy) / 2 + 4, gx, gy, fw, skin);
    o += mitt(gx, gy + 2, 1, skin, 85);
    const lsx = 60 - F.sh + 1, lsy = F.sy + 14;
    const lex = 60 - F.sh - 2, ley = F.waistY + 8;
    const lwx = 60 - F.sh - 4, lwy = F.hipY + 4;
    o += limb(lsx, lsy, (lsx + lex) / 2 - 3, (lsy + ley) / 2, lex, ley, aw, skin);
    o += limb(lex, ley, (lex + lwx) / 2, (ley + lwy) / 2 + 2, lwx, lwy, fw, skin);
    o += mitt(lwx, lwy + 2, -1, skin, 10);
  }
  return o;
}
function renderPreIntimate(a, size, st) {
  UID++;
  const X = extras(a), age = st.age || 25, skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86);
  const old = age >= 40 && a.gray < (age - 38) / 22;
  const hc = HAIR[old ? GRAY : a.hc] || HAIR[0];
  const female = a.g === 'f', fig = typeof st.preIntimate === 'object' ? st.preIntimate : null;
  const F = frameOf(a, age, fig), personality = st.personality || 'warm';
  const w = Math.round(size), h = Math.round(size * 7 / 3);
  const bottom = F.ankle + 19, H = 103 + 15 + 348 * 1.12 + 19 - 10, W = H * 120 / 280;
  const x0 = 60 - W / 2, y0 = bottom - H, u = W / 120;
  let o = `<svg class="av av-full" width="${w}" height="${h}" viewBox="${f1(x0)} ${f1(y0)} ${f1(W)} ${f1(H)}" aria-hidden="true">`;
  o += `<rect class="av-bg" x="${f1(x0 + .5 * u)}" y="${f1(y0 + .5 * u)}" width="${f1(W - u)}" height="${f1(H - u)}" rx="${f1(10 * u)}" style="stroke-width:${f1(1.5 * u)}"/>`;
  const hp = hairPieces(a, X, age, hc, { sy: F.sy, chest: F.chest });
  o += hp.back;
  const nh = F.nh, neckBot = F.sy + 4;
  o += `<path d="M${f1(60 - nh)},94 L${f1(60 + nh)},94 L${f1(60 + nh)},${f1(neckBot)} L${f1(60 - nh)},${f1(neckBot)} Z" fill="${skinD}"/>`;
  const R = legPath(F, 1), Lg = legPath(F, -1);
  o += `<path d="${Lg.d} ${R.d}" fill="${skin}"/>`;
  o += nudeTorso(F, skin, skinD);
  o += coverArms(F, skin, personality);
  o += clav(F.sy, F.sh * .35, skin);
  o += `<ellipse cx="60" cy="101.5" rx="${f1(nh - .5)}" ry="6" fill="${shade(skin, .6)}" opacity=".26"/>`;
  o += `<ellipse cx="33.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/><ellipse cx="86.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/>`;
  o += `<path d="M33,70 q-2.4,3 0,7 M87,70 q2.4,3 0,7" fill="none" stroke="${shade(skin, .68)}" stroke-width="1" opacity=".5"/>`;
  o += `<path d="${FACES[a.face] || FACES[0]}" fill="${skin}"/>`;
  const blO = personality === 'shy' || personality === 'sensitive' ? .45 : .3;
  o += `<ellipse cx="44" cy="84" rx="5.5" ry="3.3" fill="#e8857a" opacity="${blO}"/><ellipse cx="76" cy="84" rx="5.5" ry="3.3" fill="#e8857a" opacity="${blO}"/>`;
  const nLash = female ? 3 : 0, ey = 72, exx = [48, 72];
  if (personality === 'shy' || personality === 'sensitive') {
    o += exx.map((x, i) => {
      const s = i ? 1 : -1, e = eyeShape(a.eyes, x, ey, s), id = `av${UID}pe${s > 0 ? 'r' : 'l'}`;
      const shape = `M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)} Q${P(...e.l)} ${P(...e.i)} Z`, gx = x - 2.5, gy = ey + 1.5, irC = IRIS[X.iris];
      return `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/>
        <g clip-path="url(#${id})"><ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="${e.ir[0]}" ry="${e.ir[1]}" fill="${irC}"/>
        <ellipse cx="${f1(gx)}" cy="${f1(gy + .3)}" rx="${f1(e.ir[0] * .5)}" ry="${f1(e.ir[1] * .5)}" fill="${PUPIL}"/>
        <circle cx="${f1(gx + 1.3)}" cy="${f1(gy - 1.4)}" r="1.4" fill="#fff"/></g>
        <path d="M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M${P(...e.i)} Q${P(...e.l)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width=".8" opacity=".3"/>${nLash ? lashes(e, s, nLash) : ''}`;
    }).join('');
  } else o += exx.map((x, i) => openEye(a, X, x, ey, i ? 1 : -1, nLash)).join('');
  const pExpr = (personality === 'shy' || personality === 'sensitive') ? 'sad' : null;
  o += `<path d="${exx.map((x, i) => brow(a.brows, x, ey - 10, i ? 1 : -1, pExpr)).join(' ')}" fill="none" stroke="${shade(hc, .72)}" stroke-width="${a.thick ? 3.6 : female ? 2.2 : 2.8}" stroke-linecap="round" stroke-linejoin="round"/>`;
  o += `<path d="M61.2,76.4 L58.4,82.8 Q60.2,84.2 62.6,83.2" fill="none" stroke="${shade(skin, .66)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  o += `<ellipse cx="60.6" cy="84.6" rx="3" ry="1" fill="${shade(skin, .62)}" opacity=".16"/>`;
  const lip = { c: female ? LIPS[X.lip] : NATURAL_LIP[a.skin] || NATURAL_LIP[1], teeth: X.teeth };
  o += mouthSVG(3, lip, female);
  if (a.dimples) o += `<path d="M50,87 q-1.5,2 0,3.5 M70,87 q1.5,2 0,3.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.1" stroke-linecap="round"/>`;
  o += hp.front;
  if (a.glasses === 1) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><circle cx="48" cy="72" r="7.8"/><circle cx="72" cy="72" r="7.8"/><path d="M55.8,71 Q60,68.5 64.2,71 M40.2,71 L35,69 M79.8,71 L85,69"/></g>`;
  if (a.glasses === 2) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><rect x="39.5" y="65.5" width="17" height="12.5" rx="2.5"/><rect x="63.5" y="65.5" width="17" height="12.5" rx="2.5"/><path d="M56.5,71 L63.5,71 M39.5,70 L35,69 M80.5,70 L85,69"/></g>`;
  return o + '</svg>';
}

/* ---------- 성적 흥분 시각 (aroused) ---------- */
function sweatDrops(n) {
  const spots = [[78, 62], [38, 66], [82, 78], [35, 74], [85, 55]];
  return spots.slice(0, n).map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.2" fill="#87ceeb" opacity=".55"/>`).join('');
}
function arousalFX(level) {
  if (!level || level <= 30) return '';
  let o = '';
  if (level <= 50) {
    o += `<ellipse cx="44" cy="84" rx="5" ry="3" fill="#e8857a" opacity=".15"/>`;
    o += `<ellipse cx="76" cy="84" rx="5" ry="3" fill="#e8857a" opacity=".15"/>`;
  } else if (level <= 70) {
    o += `<ellipse cx="44" cy="84" rx="5.5" ry="3.5" fill="#e8857a" opacity=".25"/>`;
    o += `<ellipse cx="76" cy="84" rx="5.5" ry="3.5" fill="#e8857a" opacity=".25"/>`;
    o += `<circle cx="48.5" cy="70.5" r="1.1" fill="#fff" opacity=".25"/>`;
    o += `<circle cx="72.5" cy="70.5" r="1.1" fill="#fff" opacity=".25"/>`;
  } else if (level <= 85) {
    o += `<ellipse cx="44" cy="84" rx="6" ry="3.8" fill="#e8857a" opacity=".35"/>`;
    o += `<ellipse cx="76" cy="84" rx="6" ry="3.8" fill="#e8857a" opacity=".35"/>`;
    o += `<circle cx="48.5" cy="70.5" r="1.3" fill="#fff" opacity=".35"/>`;
    o += `<circle cx="72.5" cy="70.5" r="1.3" fill="#fff" opacity=".35"/>`;
    o += sweatDrops(1);
  } else {
    o += `<ellipse cx="44" cy="84" rx="6.5" ry="4" fill="#e8857a" opacity=".45"/>`;
    o += `<ellipse cx="76" cy="84" rx="6.5" ry="4" fill="#e8857a" opacity=".45"/>`;
    o += `<circle cx="48.5" cy="70.5" r="1.4" fill="#fff" opacity=".4"/>`;
    o += `<circle cx="72.5" cy="70.5" r="1.4" fill="#fff" opacity=".4"/>`;
    o += sweatDrops(2);
  }
  return o;
}

/* ---------- 그리기 ---------- */
const POSE = { bold: 'hip', sunny: 'hip', sharp: 'cross', cool: 'cross' };
// 머리 (머리 좌표: 정수리~턱 77). 목 그림자·귀·얼굴·눈·눈썹·코·입·앞머리·안경
//   g: { skin, hc, hp, nh(머리 좌표 목 반폭), neckBot, af(다음 날 아침), tier, chin2(이중턱) }
function headSVG(a, X, age, st, g) {
  const { skin, hc, hp, nh, neckBot, af, tier } = g, skinD = shade(skin, .86);
  const kid = age <= 12, adult = age >= 20, female = a.g === 'f', ey = 72, ex = [48, 72];
  // 턱 아래·목 옆 그림자
  let o = `<ellipse cx="60" cy="101.5" rx="${f1(nh - .5)}" ry="6" fill="${shade(skin, .6)}" opacity=".26"/>`;
  o += `<path d="M${f1(60 - nh + 1.6)},104 L${f1(60 - nh + 1.6)},${f1(neckBot - 2)} M${f1(60 + nh - 1.6)},104 L${f1(60 + nh - 1.6)},${f1(neckBot - 2)}" stroke="${shade(skin, .66)}" stroke-width="2" opacity=".14"/>`;
  if (a.buds) o += `<path d="M34,78 C30,96 40,112 47,130" fill="none" stroke="#f4f4f4" stroke-width="1.3"/>`;
  // 귀, 얼굴 (6살 이하는 둥근 얼굴)
  o += `<ellipse cx="33.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/><ellipse cx="86.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/>`;
  o += `<path d="M33,70 q-2.4,3 0,7 M87,70 q2.4,3 0,7" fill="none" stroke="${shade(skin, .68)}" stroke-width="1" opacity=".5"/>`;
  if (a.buds) o += `<circle cx="33" cy="76" r="2.6" fill="#f4f4f4"/>`;
  o += `<path d="${FACES[age <= 6 ? 0 : a.face] || FACES[0]}" fill="${skin}"/>`;
  if (g.chin2) o += `<path d="M48,100.5 Q60,108.5 72,100.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.6" stroke-linecap="round" opacity=".4"/>`;   // 이중턱
  // 볼 홍조 (모두 옅게, 어린이·볼 빨간 사람은 더), 주근깨, 주름
  const blush = f1((af ? [.1, .1, .25, .42, .55][tier] + (af.personality === 'shy' && tier >= 2 ? .15 : 0) : kid ? .3 : a.blush ? .24 : .1) * 100) / 100;
  o += `<ellipse cx="44" cy="84" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${blush}"/><ellipse cx="76" cy="84" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${blush}"/>`;
  if (st.aroused && adult) o += arousalFX(st.aroused);
  if (a.freckles) o += [[43, 80], [46, 82], [49, 80], [71, 80], [74, 82], [77, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="${shade(skin, .62)}"/>`).join('');
  if (age >= 45) o += `<path d="M41,77 Q44,79 47,78 M73,78 Q76,79 79,77" fill="none" stroke="${shade(skin, .75)}" stroke-width="1"/>`;
  // 눈: 흰자 + 홍채 + 하이라이트 + 속눈썹 (어린이는 조금 크게) / 다음 날 아침엔 감은 눈 / 흥분 시 반쯤 감김
  const nLash = female ? (age >= 18 ? 3 : 2) : kid ? 1 : 0;
  const aro = adult && st.aroused || 0;
  o += ex.map((x, i) => {
    const s = i ? 1 : -1;
    if (af && tier >= 3 && af.personality === 'playful' && i === 1) return HAPPY(x, ey);
    if (af && tier === 4) return HAPPY(x, ey);
    if (af && tier === 3) return SLEEPY(x, ey, s, nLash);
    if (aro >= 86) return SLEEPY(x, ey, s, nLash);
    if (aro >= 71) {
      const e = eyeShape(a.eyes, x, ey, s), id = `av${UID}ar${s > 0 ? 'r' : 'l'}`;
      const gap = 1.2, midU = [(e.i[0] + e.o[0]) / 2, Math.min(e.i[1], e.o[1]) + gap];
      const shape = `M${P(...e.i)} Q${P(...midU)} ${P(...e.o)} Q${P(...e.l)} ${P(...e.i)} Z`, irC = IRIS[X.iris], gx = x - 2.5, gy = ey + 1.5;
      return `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/>
        <g clip-path="url(#${id})"><ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="${e.ir[0]}" ry="${f1(e.ir[1] * .7)}" fill="${irC}"/>
        <ellipse cx="${f1(gx)}" cy="${f1(gy + .3)}" rx="${f1(e.ir[0] * .5)}" ry="${f1(e.ir[1] * .4)}" fill="${PUPIL}"/>
        <circle cx="${f1(gx + 1)}" cy="${f1(gy - .8)}" r="1.2" fill="#fff" opacity=".5"/></g>
        <path d="M${P(...e.i)} Q${P(...midU)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width="2.3" stroke-linecap="round"/>
        <path d="M${P(...e.i)} Q${P(...e.l)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width=".8" opacity=".3"/>${nLash ? lashes(e, s, nLash) : ''}`;
    }
    const e = openEye(a, X, x, ey, s, nLash);
    return kid ? `<g transform="translate(${x},${ey}) scale(1.1) translate(${-x},${-ey})">${e}</g>` : e;
  }).join('');
  // 눈썹 (다음 날 아침 만족감이 낮으면 처짐)
  const expr = st.expr || (af && tier <= 1 ? 'sad' : null);
  const btype = af && tier >= 3 ? 1 : a.brows;
  o += `<path d="${ex.map((x, i) => brow(btype, x, ey - 10, i ? 1 : -1, expr)).join(' ')}" fill="none" stroke="${shade(hc, .72)}" stroke-width="${a.thick ? 3.6 : a.g === 'm' ? 2.8 : 2.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  // 코: 작게 꺾인 선 + 코 아래 그림자
  o += `<path d="M61.2,76.4 L58.4,82.8 Q60.2,84.2 62.6,83.2" fill="none" stroke="${shade(skin, .66)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  o += `<ellipse cx="60.6" cy="84.6" rx="3" ry="1" fill="${shade(skin, .62)}" opacity=".16"/>`;
  // 입 (어른 여자는 립 색, 여자아이는 연분홍, 남자는 자연스러운 입술색)
  const lip = { c: female && age >= 18 ? LIPS[X.lip] : female ? '#e39aa0' : NATURAL_LIP[a.skin] || NATURAL_LIP[1], teeth: X.teeth };
  o += af ? (tier === 0 ? FROWN : tier === 1 ? mouthSVG(2, lip, female) : tier >= 3 && af.personality !== 'cool' ? mouthSVG(1, lip, female) : mouthSVG(0, lip, female))
    : aro >= 71 ? mouthSVG(1, lip, female) : aro >= 51 ? mouthSVG(3, lip, female) : mouthSVG(a.mouth, lip, female);
  // 립스틱 자국은 morningBody에서 목·쇄골에 표시
  if (af && tier >= 4 && female) {
    o += `<path d="M42,74 Q38,78 36,82" fill="none" stroke="#555" stroke-width="1.2" opacity=".25" stroke-linecap="round"/>`;
    o += `<path d="M78,74 Q82,78 84,82" fill="none" stroke="#555" stroke-width="1.2" opacity=".25" stroke-linecap="round"/>`;
  }
  if (a.dimples) o += `<path d="M50,87 q-1.5,2 0,3.5 M70,87 q1.5,2 0,3.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.1" stroke-linecap="round"/>`;
  // 앞머리·옆머리
  o += hp.front;
  if (af && tier >= 2) o += messyHair(hc, [0, 0, 1, 3, 5][tier]);
  // 안경
  if (a.glasses === 1) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><circle cx="48" cy="72" r="7.8"/><circle cx="72" cy="72" r="7.8"/><path d="M55.8,71 Q60,68.5 64.2,71 M40.2,71 L35,69 M79.8,71 L85,69"/></g>`;
  if (a.glasses === 2) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><rect x="39.5" y="65.5" width="17" height="12.5" rx="2.5"/><rect x="63.5" y="65.5" width="17" height="12.5" rx="2.5"/><path d="M56.5,71 L63.5,71 M39.5,70 L35,69 M80.5,70 L85,69"/></g>`;
  return o;
}
const hairColor = (a, age) => {
  const old = age >= 40 && a.gray < (age - 38) / 22;   // 40대부터 흰머리 확률 증가
  return HAIR[old ? GRAY : age <= 18 && a.hc >= 4 ? a.hc - 3 : a.hc] || HAIR[0];   // 어린이·10대는 염색 안 함
};
const topOf = (a, age) => age >= 13 && age <= 18 ? 4 : age <= 12 ? (a.top === 1 ? 0 : a.top === 3 ? 2 : a.top) : a.top;   // 10대는 교복
// 옷 입은 전신: 0 0 120 280, 바닥선 272. 머리는 머리 좌표 그대로 그려서 나이별 머리 높이에 맞게 줄임
function renderFull(a, size, st) {
  UID++;
  const X = extras(a), age = st.age ?? 25, skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86), hc = hairColor(a, age), top = topOf(a, age);
  const A = anchorsOf(a, age, typeof st.full === 'object' ? st.full : null), { y, w } = A, hs = A.hs;
  const toHead = v => (v - A.hty) / hs, HG = s => `<g transform="translate(${f1(A.htx)},${f1(A.hty)}) scale(${hs.toFixed(4)})">${s}</g>`;
  const hp = hairPieces(a, X, age, hc, { sy: toHead(y.sh), chest: toHead(y.bust) });
  const bt = bottomOf(a, X, age, A), pose = age <= 12 ? 'default' : st.pose || POSE[st.personality] || 'default';
  const low = lowerFull(a, X, age, A, skinD, bt), T = topFull(a, top, A, skinD, bt), AR = armsFull(A, top, pose, skinD, T, low.hipEdge);
  const neckBot = y.neck + 4 * hs;
  let o = `<svg class="av av-full" width="${Math.round(size)}" height="${Math.round(size * 7 / 3)}" viewBox="0 0 120 280" aria-hidden="true">`;
  o += `<rect class="av-bg" x=".5" y=".5" width="119" height="279" rx="10" style="stroke-width:1.5"/>`;
  o += HG(hp.back) + AR.back + low.svg;
  o += `<path d="M${f1(60 - w.nh)},${f1(A.hty + 90 * hs)} L${f1(60 + w.nh)},${f1(A.hty + 90 * hs)} L${f1(60 + w.nh)},${f1(neckBot)} L${f1(60 - w.nh)},${f1(neckBot)} Z" fill="${skinD}"/>`;
  o += T.svg + low.belt + AR.front;
  o += HG(headSVG(a, X, age, st, { skin, hc, hp, nh: w.nh / hs, neckBot: toHead(neckBot), af: null, tier: -1, chin2: A.chubbyM }));
  if (st.guides) o += guidesSVG(A);
  return o + '</svg>';
}
function render(a, size = 48, state = 25) {
  const st = typeof state === 'object' && state ? state : { age: state };
  const age = st.age ?? 25, full = !!st.full, adult = age >= 20;
  const w = Math.round(size), h = Math.round(size * (full ? 7 / 3 : 4 / 3));
  if (!a) return `<svg class="av" width="${w}" height="${h}" viewBox="0 0 120 ${full ? 280 : 160}" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="${full ? 279 : 159}" rx="10"/></svg>`;
  if (adult && st.preIntimate) return renderPreIntimate(a, size, st);
  if (full) return renderFull(a, size, st);
  // 상반신 (0 0 120 160): 머리·어깨만
  UID++;
  const X = extras(a), kid = age <= 12;
  const af = adult && st.after ? st.after : null, tier = af ? tierOf(af.sat ?? 50) : -1;
  const skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86), hc = hairColor(a, age), top = topOf(a, age);
  const hp = hairPieces(a, X, age, hc, { sy: 115, chest: 146 });
  const nh = kid ? 8.5 : a.g === 'f' ? 10.5 : 12, neckBot = kid ? 121 : 118, hw = halfWidth(a, kid, adult);
  let o = `<svg class="av" width="${w}" height="${h}" viewBox="0 0 120 160" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="159" rx="10"/>`;
  o += hp.back;
  o += `<path d="M${f1(60 - nh)},94 L${f1(60 + nh)},94 L${f1(60 + nh)},${f1(neckBot)} L${f1(60 - nh)},${f1(neckBot)} Z" fill="${skinD}"/>`;
  o += af ? morningBody(a, skin, skinD, hw, tier, st.after && st.after.fig, af.lipstick) : clothes(a, top, kid, skinD, hw, adult);
  o += headSVG(a, X, age, st, { skin, hc, hp, nh, neckBot, af, tier });
  return o + '</svg>';
}

const topColor = a => TOP_COLORS[(a && a.tc) || 0];
// anchors: 전신 앵커(px)를 그대로 꺼내 봄 (test.html 비교용)
window.Avatar = { make, render, topColor, anchors: (a, age, fig) => anchorsOf(a, age, fig) };
window.renderAvatar = render;
})();
