// 사람 아바타 — 파츠(얼굴·머리·눈·입·옷…)를 조합해 SVG 문자열로 그림. 외부 이미지 없음
// Avatar.make(seed, gender, opt)    → appearance (파츠 번호 묶음). 같은 seed면 늘 같은 얼굴
// Avatar.render(appearance, size, state) → SVG 문자열 (상반신: 가로 size, 세로 size×4/3 / 전신: 세로 size×7/3)
//   state: 나이(숫자) 또는 { age, after: { sat, personality, lipstick }, full: true | 수치, personality, expr }
//     full: 옷 입은 전신. 수치 { height, waist, hip, cup, shoulder }를 주면 20살부터 체형 곡선에 반영
//     personality: 전신 기본 자세 (직진형·낙천형 한 손 허리 / 냉철형·무심형 팔짱 / 그 외 차렷)
//     expr: 눈썹 표정 ('angry' | 'surprised' | 'sad')
//   좌표는 하나: 머리(정수리~턱 77) 기준. 상반신은 머리·어깨만 잘라 보여주고,
//   전신은 나이별 등신 비율(어린이 1:3 → 10대 1:4 → 어른 1:4.5)로 몸을 그림
//   체형 곡선(컵·허리·골반)은 20살부터만. 10대는 성별 평균 체형만, 어린이는 일자 몸
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
const clav = (y, half, skin) => `<path d="M57,${f1(y)} Q${f1(60 - half * .55)},${f1(y + 1.6)} ${f1(60 - half)},${f1(y + .6)} M63,${f1(y)} Q${f1(60 + half * .55)},${f1(y + 1.6)} ${f1(60 + half)},${f1(y + .6)}" fill="none" stroke="${shade(skin, .74)}" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>`;
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

/* ---------- 전신 ---------- */
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
// 하의 종류와 색
function bottomOf(a, X, age, F) {
  const kid = age <= 12, teen = age >= 13 && age <= 18;
  if (teen) return F.f ? { k: 'skirt', c: UNIFORM.skirt, uniform: true } : { k: 'slacks', c: UNIFORM.blazer };
  if (kid) return F.f ? (X.pants < .55 ? { k: 'skirt', c: ['#c25a6b', '#6aa3c8', '#d0a443'][a.tc % 3] } : { k: 'shorts', c: ['#4a5f86', '#c25a6b', '#5f8f6a'][a.tc % 3] })
    : (X.pants < .6 ? { k: 'shorts', c: ['#4a5f86', '#7a8a5a', '#3b3e48'][a.tc % 3] } : { k: 'jeans', c: '#4a5f86' });
  if (F.f && (a.tc + a.top) % 3 !== 0) return { k: 'skirt', c: ['#2e2e36', '#8a6f5a', '#5b4a78', '#7d2f3d'][a.tc % 4] };
  if (!F.f && a.top === 1) return { k: 'slacks', c: X.pants < .5 ? '#3b3e48' : '#2e3440', tucked: true };
  return X.pants < .6 ? { k: 'jeans', c: '#4a5f86' } : X.pants < .8 ? { k: 'slacks', c: F.f ? '#3b3e48' : '#a08a63', chino: !F.f } : { k: 'jeans', c: '#2f3b55' };
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
      <path d="M${X(4.6)},${Y(4)} l${f1(s * 1.8)},0 l${f1(-s * .3)},6.2 l${f1(-s * 1.1)},0 Z" fill="${shade(c, .7)}"/>
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
// 하의 + 다리 + 신발
function lowerBody(a, X, age, F, skin, bt) {
  const R = legPath(F, 1), Lg = legPath(F, -1), shoeT = shoeOf(X, age, F, bt);
  const legs = `<path d="${Lg.d} ${R.d}" fill="${skin}"/>`;
  const sk = F.kid ? 1.05 : F.adult ? 1.3 : 1.2;   // 신발은 발목 기준으로 키움
  const sz = (x, svg) => `<g transform="translate(${f1(x)},${f1(F.ankle)}) scale(${sk}) translate(${f1(-x)},${f1(-F.ankle)})">${svg}</g>`;
  const shoes = sz(60 - Lg.ax, shoe(shoeT, 60 - Lg.ax, F.ankle, -1, Lg.ah, skin, a)) + sz(60 + R.ax, shoe(shoeT, 60 + R.ax, F.ankle, 1, R.ah, skin, a));
  const dk = shade(bt.c, .72), knee = `M${f1(60 - R.kx - 3.5)},${f1(F.knee + 1)} q3.5,1.6 7,0 M${f1(60 + R.kx - 3.5)},${f1(F.knee + 1)} q3.5,1.6 7,0`;
  const wy = F.waistY - 3, top = F.waist + 1;
  if (bt.k === 'skirt') {
    const hemY = bt.uniform ? F.knee - 8 : age <= 12 ? F.crotch + F.legs * .22 : F.knee - 26 + X.hem * 34;   // 무릎 위 ~ 무릎 아래
    const flare = bt.uniform ? 5 : 3 + X.hem * 4;
    const d = sym([top, wy], [{ c: [top + 1, wy + 6, F.hip + 1, F.hipY - 12], p: [F.hip + 1.5, F.hipY] }, { c: [F.hip + 2, F.hipY + 10, F.hip + flare - 1, hemY - 10], p: [F.hip + flare, hemY] }, { p: [0, hemY + 1.5] }]);
    let det;
    if (bt.uniform) {   // 교복 치마: 주름선 + 체크 선
      let pl = '';
      for (let i = -2; i <= 2; i++) pl += `M${f1(60 + i * (F.hip + flare) * .36)},${f1(F.hipY - 2)} L${f1(60 + i * (F.hip + flare) * .42)},${f1(hemY)} `;
      det = `<path d="${pl}" stroke="${dk}" stroke-width="1.1" opacity=".55"/><path d="M${f1(60 - F.hip - 4)},${f1(hemY - 9)} L${f1(60 + F.hip + 4)},${f1(hemY - 9)} M${f1(60 - F.hip)},${f1(F.hipY + 6)} L${f1(60 + F.hip)},${f1(F.hipY + 6)}" stroke="${shade(bt.c, 1.45)}" stroke-width=".9" opacity=".45"/>`;
    } else det = `<path d="M${f1(60 - F.hip * .45)},${f1(F.hipY + 6)} Q${f1(60 - F.hip * .55)},${f1(hemY - 8)} ${f1(60 - F.hip * .7)},${f1(hemY)} M${f1(60 + F.hip * .4)},${f1(F.hipY + 8)} Q${f1(60 + F.hip * .5)},${f1(hemY - 8)} ${f1(60 + F.hip * .62)},${f1(hemY)}" fill="none" stroke="${dk}" stroke-width="1.2" opacity=".35"/>`;   // A라인 주름
    const band = `<path d="M${f1(60 - top)},${f1(wy)} L${f1(60 + top)},${f1(wy)} L${f1(60 + top + .4)},${f1(wy + 4)} L${f1(60 - top - .4)},${f1(wy + 4)} Z" fill="${dk}" opacity=".7"/>`;
    return legs + `<path d="${knee}" fill="none" stroke="${shade(skin, .78)}" stroke-width="1" opacity=".55"/>` + shoes + `<path d="${d}" fill="${bt.c}"/>` + det + band;
  }
  // 바지·반바지: 허리 → 골반 → 다리 (반바지는 허벅지 중간에서 끝남)
  const short = bt.k === 'shorts', hemY = short ? F.crotch + F.legs * .24 : F.ankle - .5;
  const ox = R.ax + R.ah + (short ? 4.4 : 3.4), ix = R.ax - R.ah - (short ? 2 : 2.6);
  const okx = R.kx + R.kh + 2.6, ikx = R.kx - R.kh - 2;
  const segs = short
    ? [{ c: [top + 1, wy + 6, F.hip + 1, F.hipY - 12], p: [F.hip + 1.2, F.hipY] }, { c: [F.hip + 1.8, F.hipY + 8, R.cx + 9 + F.thigh, hemY - 6], p: [R.cx + 8.5 + F.thigh, hemY] }, { p: [R.cx - 7.5 - F.thigh * .6, hemY] }, { c: [R.cx - 7, hemY - 8, 2, F.crotch + 6], p: [0, F.crotch + 1] }]
    : [{ c: [top + 1, wy + 6, F.hip + 1, F.hipY - 12], p: [F.hip + 1.4, F.hipY] }, { c: [F.hip + 2, F.hipY + 18, okx + 1, F.knee - 20], p: [okx, F.knee] }, { c: [okx - .4, F.knee + 20, ox, hemY - 26], p: [ox, hemY] }, { p: [ix, hemY] }, { c: [ix, hemY - 26, ikx, F.knee + 22], p: [ikx, F.knee] }, { c: [ikx + .5, F.knee - 26, 2.6, F.crotch + 16], p: [0, F.crotch + 2] }];
  let out = (short ? legs : '') + shoes + `<path d="${sym([top, wy], segs)}" fill="${bt.c}"/>`;
  out += `<path d="M60,${f1(F.waistY + 2)} L60,${f1(F.crotch + 1)}" stroke="${dk}" stroke-width="1" opacity=".55"/>`;
  if (short) out += `<path d="M${f1(60 - R.cx - 8 - F.thigh)},${f1(hemY - 3)} L${f1(60 - R.cx + 7)},${f1(hemY - 3)} M${f1(60 + R.cx - 7)},${f1(hemY - 3)} L${f1(60 + R.cx + 8 + F.thigh)},${f1(hemY - 3)}" stroke="${dk}" stroke-width="1" opacity=".5"/>`;   // 끝단 접힘
  else {
    out += `<path d="${knee}" fill="none" stroke="${dk}" stroke-width="1.1" opacity=".5"/>`;   // 무릎 주름
    out += `<path d="M${f1(60 - ox)},${f1(hemY - 4)} L${f1(60 - ix)},${f1(hemY - 4)} M${f1(60 + ix)},${f1(hemY - 4)} L${f1(60 + ox)},${f1(hemY - 4)}" stroke="${dk}" stroke-width="1.1" opacity=".55"/>`;   // 밑단 접힘
  }
  if (bt.k === 'jeans') out += `<path d="M${f1(60 - F.hip - .6)},${f1(F.hipY)} L${f1(60 - ox + .8)},${f1(hemY - 5)} M${f1(60 + F.hip + .6)},${f1(F.hipY)} L${f1(60 + ox - .8)},${f1(hemY - 5)}" stroke="#d2a659" stroke-width=".8" stroke-dasharray="2 1.6" opacity=".6"/>` +
    `<path d="M${f1(60 - top + 2)},${f1(F.waistY + 1)} Q${f1(60 - top + 5)},${f1(F.hipY - 4)} ${f1(60 - F.hip)},${f1(F.hipY - 2)} M${f1(60 + top - 2)},${f1(F.waistY + 1)} Q${f1(60 + top - 5)},${f1(F.hipY - 4)} ${f1(60 + F.hip)},${f1(F.hipY - 2)}" fill="none" stroke="#d2a659" stroke-width=".8" opacity=".55"/>`;   // 옆선 스티치, 주머니
  if (bt.k === 'slacks' && !short) out += `<path d="M${f1(60 - R.cx)},${f1(F.hipY + 8)} L${f1(60 - R.ax)},${f1(hemY - 6)} M${f1(60 + R.cx)},${f1(F.hipY + 8)} L${f1(60 + R.ax)},${f1(hemY - 6)}" stroke="${shade(bt.c, 1.3)}" stroke-width=".9" opacity=".45"/>`;   // 다림질 선
  if (bt.tucked) out += `<path d="M${f1(60 - top - .5)},${f1(F.waistY - 2)} L${f1(60 + top + .5)},${f1(F.waistY - 2)} L${f1(60 + top + .8)},${f1(F.waistY + 3)} L${f1(60 - top - .8)},${f1(F.waistY + 3)} Z" fill="#2a211d"/><rect x="57" y="${f1(F.waistY - 2.4)}" width="6" height="6" rx="1" fill="none" stroke="#c8a24a" stroke-width="1.2"/>`;   // 벨트
  return out;
}
// 윗옷 (전신): 몸통 실루엣 + 옷 종류별 디테일 + 주름·그림자
function upperBody(a, top, F, skin, bt) {
  const c = top === 4 ? UNIFORM.blazer : TOP_COLORS[a.tc], dark = shade(c, .78), fold = shade(c, .58), Y = f1;
  const loose = [.15, .1, .6, .3, .25][top];   // 후디·니트는 허리선이 뭉뚱그려짐
  const bust = F.adult && F.f ? F.bust * (top === 2 ? .55 : top === 4 ? .8 : 1) : 0;
  const waist = lerp(F.waist, F.rib, loose), tucked = bt.tucked;
  const hemY = tucked ? F.waistY + 1 : F.waistY + (F.crotch - F.waistY) * (top === 4 ? .55 : .36);
  const hemH = lerp(waist, F.hip, tucked ? .1 : top === 4 ? .9 : .65) + 1.5;
  const ny = F.sy - 3, nh = F.nh;
  const segs = [
    { c: [nh + 9, ny + 1, F.sh - 6, ny + 2.5], p: [F.sh, ny + 11] },                                    // 승모근 → 어깨 끝
    { c: [F.sh + 2.6, ny + 17, F.rib + 2, ny + 22], p: [F.rib + .5, ny + 27] },                         // 어깨 → 겨드랑이
    { c: [F.rib + bust * 1.05, F.chest - 6, F.rib + bust * .95, F.chest + 8], p: [F.rib + bust * .25, F.chest + 17] },   // 가슴 (어른 여자는 컵만큼 볼록)
    { c: [F.rib - .5, F.chest + 28, waist + 1, F.waistY - 14], p: [waist, F.waistY] },                 // 허리 잘록
    { c: [waist + .6, F.waistY + 6, hemH - 1, hemY - 8], p: [hemH, hemY] },                             // 골반 쪽으로
  ];
  let o = `<path d="${sym([nh + 2.5, ny], segs)}" fill="${c}"/>`;
  if (top === 4) {   // 교복: 셔츠 V + 라펠 + 넥타이/리본 + 단추 + 왼가슴 마크
    const tie = UNIFORM.tie[a.tie], vy = F.chest + 10;
    o += `<path d="M${f1(60 - nh - 1)},${Y(ny)} L60,${Y(vy)} L${f1(60 + nh + 1)},${Y(ny)} Z" fill="${UNIFORM.shirt}"/>
      <path d="M${f1(60 - nh - 1)},${Y(ny)} L60,${Y(vy)} L${f1(60 - nh - 8)},${Y(vy - 4)} L${f1(60 - nh - 9)},${Y(ny + 4)} Z M${f1(60 + nh + 1)},${Y(ny)} L60,${Y(vy)} L${f1(60 + nh + 8)},${Y(vy - 4)} L${f1(60 + nh + 9)},${Y(ny + 4)} Z" fill="${shade(c, 1.25)}"/>
      ${F.f ? `<path d="M60,${Y(ny + 7)} L51.5,${Y(ny + 2.5)} L51.5,${Y(ny + 11.5)} Z M60,${Y(ny + 7)} L68.5,${Y(ny + 2.5)} L68.5,${Y(ny + 11.5)} Z" fill="${tie}"/><circle cx="60" cy="${Y(ny + 7)}" r="2.4" fill="${shade(tie, .8)}"/>`
        : `<path d="M57,${Y(ny + 3)} L63,${Y(ny + 3)} L62,${Y(ny + 7)} L64,${Y(vy - 4)} L60,${Y(vy + 1)} L56,${Y(vy - 4)} L58,${Y(ny + 7)} Z" fill="${tie}"/>`}
      <circle cx="60" cy="${Y(F.waistY - 6)}" r="1.6" fill="${shade(c, 1.5)}"/><circle cx="60" cy="${Y(F.waistY + 6)}" r="1.6" fill="${shade(c, 1.5)}"/>
      <path d="M${f1(60 + F.rib * .45)},${Y(F.chest - 2)} l7,0 l0,5.6 q-3.5,3.4 -7,0 Z" fill="#c8a24a" opacity=".85"/>
      <path d="M60,${Y(vy)} L60,${Y(hemY)}" stroke="${shade(c, .6)}" stroke-width="1" opacity=".6"/>`;
  } else if (top === 0) {   // 티셔츠: 라운드 넥 + 쇄골
    o += `<path d="M${f1(60 - nh - 3)},${Y(ny)} Q60,${Y(ny + 13)} ${f1(60 + nh + 3)},${Y(ny)}" fill="${skin}"/>${clav(ny + 4.5, nh + 2, skin)}<path d="M${f1(60 - nh - 3)},${Y(ny)} Q60,${Y(ny + 13)} ${f1(60 + nh + 3)},${Y(ny)}" fill="none" stroke="${dark}" stroke-width="3"/>`;
  } else if (top === 1) {   // 셔츠: 뾰족한 칼라 + 단추 + 가슴 주머니(남)
    o += `<path d="M${f1(60 - nh + 1.5)},${Y(ny)} L60,${Y(ny + 15)} L${f1(60 + nh - 1.5)},${Y(ny)} Z" fill="${skin}"/>${clav(ny + 4, nh - 2, skin)}
      <path d="M${f1(60 - nh)},${Y(ny - 1)} L60,${Y(ny + 15)} L${f1(60 - nh + 3)},${Y(ny + 19)} L${f1(60 - nh - 6)},${Y(ny + 5)} Z M${f1(60 + nh)},${Y(ny - 1)} L60,${Y(ny + 15)} L${f1(60 + nh - 3)},${Y(ny + 19)} L${f1(60 + nh + 6)},${Y(ny + 5)} Z" fill="${shade(c, 1.35)}" stroke="${dark}" stroke-width="1"/>
      <path d="M60,${Y(ny + 15)} L60,${Y(hemY)}" stroke="${dark}" stroke-width="1.2"/>
      ${[0, 1, 2, 3].map(i => `<circle cx="60" cy="${Y(ny + 22 + i * (hemY - ny - 28) / 3)}" r="1.3" fill="${dark}"/>`).join('')}
      ${!F.f ? `<path d="M${f1(60 + F.rib * .3)},${Y(F.chest - 4)} l9,0 l0,9 l-9,0 Z" fill="none" stroke="${dark}" stroke-width="1" opacity=".6"/>` : ''}`;
  } else if (top === 2) {   // 후디: 후드 + 끈 + 캥거루 주머니 + 밑단 리브
    const pw = waist * .62, py = F.waistY - 6;
    o += `<path d="M${f1(60 - nh - 10)},${Y(ny + 5)} C${f1(60 - nh - 9)},${Y(ny - 9)} ${f1(60 + nh + 9)},${Y(ny - 9)} ${f1(60 + nh + 10)},${Y(ny + 5)} C${f1(60 + nh)},${Y(ny + 14)} ${f1(60 - nh)},${Y(ny + 14)} ${f1(60 - nh - 10)},${Y(ny + 5)} Z" fill="${dark}"/>
      <path d="M${f1(60 - nh - 1)},${Y(ny)} Q60,${Y(ny + 10)} ${f1(60 + nh + 1)},${Y(ny)}" fill="${skin}"/>
      <path d="M55,${Y(ny + 9)} L54,${Y(ny + 28)} M65,${Y(ny + 9)} L66,${Y(ny + 28)}" stroke="${shade(c, 1.5)}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M${f1(60 - pw)},${Y(py + 16)} L${f1(60 - pw + 5)},${Y(py)} Q60,${Y(py - 4)} ${f1(60 + pw - 5)},${Y(py)} L${f1(60 + pw)},${Y(py + 16)} Z" fill="none" stroke="${fold}" stroke-width="1.3" opacity=".45"/>
      <path d="M${f1(60 - hemH)},${Y(hemY - 5)} L${f1(60 + hemH)},${Y(hemY - 5)}" stroke="${fold}" stroke-width="1.2" opacity=".4"/>`;
  } else {   // 니트: 라운드 넥 리브 + 짜임 물결 + 밑단 리브
    const rows = [F.chest + 8, F.chest + 22, F.waistY - 8].map(y => { let d = `M${f1(60 - F.rib + 2)},${Y(y)}`; for (let x = 60 - F.rib + 2, i = 0; x < 60 + F.rib - 4; x += 6, i++) d += ` q3,${i % 2 ? 2.4 : -2.4} 6,0`; return d; }).join(' ');
    o += `<path d="M${f1(60 - nh - 3)},${Y(ny - 1)} Q60,${Y(ny + 9)} ${f1(60 + nh + 3)},${Y(ny - 1)} L${f1(60 + nh + 3)},${Y(ny + 4)} Q60,${Y(ny + 14)} ${f1(60 - nh - 3)},${Y(ny + 4)} Z" fill="${dark}"/>
      <path d="M${f1(60 - nh - 1)},${Y(ny - 1)} Q60,${Y(ny + 7)} ${f1(60 + nh + 1)},${Y(ny - 1)}" fill="${skin}"/>
      <path d="${rows}" fill="none" stroke="${dark}" stroke-width="1" opacity=".3"/>
      <path d="${Array.from({ length: 9 }, (_, i) => { const x = 60 - hemH + 2 + i * (hemH * 2 - 4) / 8; return `M${f1(x)},${Y(hemY - 6)} L${f1(x)},${Y(hemY)}`; }).join(' ')}" stroke="${dark}" stroke-width="1.2"/>`;
  }
  // 주름·그림자: 겨드랑이 삼각형, 옷깃 아래, 허리 세로 주름, 가슴 아래 가로 주름(컵이 클수록 길고 깊게, 20살부터)
  const sf = `fill="none" stroke="${fold}" stroke-linecap="round"`;
  o += `<path d="M${f1(60 - F.rib - .5)},${Y(ny + 27)} L${f1(60 - F.rib + 5)},${Y(ny + 31)} L${f1(60 - F.rib + 1)},${Y(ny + 40)} Z M${f1(60 + F.rib + .5)},${Y(ny + 27)} L${f1(60 + F.rib - 5)},${Y(ny + 31)} L${f1(60 + F.rib - 1)},${Y(ny + 40)} Z" fill="${fold}" opacity=".22"/>`;
  if (top !== 4) o += `<path d="M${f1(60 - nh - 4)},${Y(ny + 4)} Q60,${Y(ny + 19)} ${f1(60 + nh + 4)},${Y(ny + 4)}" ${sf} stroke-width="2" opacity=".14"/>`;
  o += `<path d="M${f1(60 - waist + 3)},${Y(F.waistY - 13)} L${f1(60 - waist + 2.4)},${Y(F.waistY - 2)} M${f1(60 - waist + 6.5)},${Y(F.waistY - 10)} L${f1(60 - waist + 6)},${Y(F.waistY - 1)} M${f1(60 + waist - 3)},${Y(F.waistY - 13)} L${f1(60 + waist - 2.4)},${Y(F.waistY - 2)} M${f1(60 + waist - 6.5)},${Y(F.waistY - 10)} L${f1(60 + waist - 6)},${Y(F.waistY - 1)}" ${sf} stroke-width="1.2" opacity=".2"/>`;
  if (bust >= 2) {
    const n = bust >= 9 ? 2 : 1, len = bust >= 11 ? 1 : bust >= 6 ? .8 : .5, by = F.chest + 13 + bust * .35;
    let d = '';
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const x0 = 60 + s * 3, x1 = 60 + s * (3 + (F.rib + bust * .4 - 3) * len), y = by + i * 3.2;
      d += `M${f1(x0)},${Y(y)} Q${f1((x0 + x1) / 2)},${Y(y + 3 + bust * .12)} ${f1(x1)},${Y(y - 2)} `;
    }
    o += `<path d="${d}" ${sf} stroke-width="${f1(1.2 + bust * .05)}" opacity="${f1((.16 + bust * .006) * 100) / 100}"/>`;
  } else if (!F.f && F.adult && (F.b.build === 'fit' || F.sh > 44)) o += `<path d="M${f1(60 - F.rib * .7)},${Y(F.chest + 8)} Q${f1(60 - F.rib * .35)},${Y(F.chest + 12)} 59,${Y(F.chest + 9)} M${f1(60 + F.rib * .7)},${Y(F.chest + 8)} Q${f1(60 + F.rib * .35)},${Y(F.chest + 12)} 61,${Y(F.chest + 9)}" ${sf} stroke-width="1.3" opacity=".22"/>`;
  return { svg: o, color: c, waist, bust };
}
// 손: 엄지만 분리된 벙어리장갑 모양. (x,y) 손목, rot 회전(아래가 0), s 바깥쪽 방향
const mitt = (x, y, s, skin, rot) => `<g transform="translate(${f1(x)},${f1(y)}) rotate(${rot || 0}) scale(${s},1)">
  <path d="M-4.4,-1.5 C-5.2,4.5 -4.8,10.6 -1.4,12.6 C1.8,14.2 4.9,11.8 4.8,7.6 L4.8,-1.5 Z" fill="${skin}"/>
  <path d="M-3.9,2.4 C-7.4,4.2 -7.2,8.6 -4.4,9.6 C-3.4,8.2 -3.2,5.4 -2.6,3.2 Z" fill="${shade(skin, .9)}"/>
  <path d="M-1.2,9.6 Q1,11 3.2,9.2" fill="none" stroke="${shade(skin, .7)}" stroke-width=".8" opacity=".5"/></g>`;
// 팔 한 마디 (윤곽선 + 색)
const limb = (x1, y1, cx, cy, x2, y2, w, c) => `<path d="M${P(x1, y1)} Q${P(cx, cy)} ${P(x2, y2)}" fill="none" stroke="${shade(c, .74)}" stroke-width="${f1(w + 1.6)}" stroke-linecap="round"/><path d="M${P(x1, y1)} Q${P(cx, cy)} ${P(x2, y2)}" fill="none" stroke="${c}" stroke-width="${f1(w)}" stroke-linecap="round"/>`;
// 자세: default 차렷(살짝 벌림, 팔꿈치에서 살짝 꺾임) / hip 한 손 허리 / cross 팔짱. 반팔이면 아래팔이 살
function arms(top, F, skin, U, pose) {
  const c = U.color, shortSl = top === 0, aw = F.arm * 2, fw = F.fore * 2;
  const J = s => [60 + s * (F.sh - F.arm * .55), F.sy + 9];
  const cuff = (ex, ey, wx, wy, w) => {
    const x = ex + (wx - ex) * .86, y = ey + (wy - ey) * .86, l = Math.hypot(wx - ex, wy - ey) || 1, nx = -(wy - ey) / l * w * .55, ny = (wx - ex) / l * w * .55;
    return `<path d="M${P(x - nx, y - ny)} L${P(x + nx, y + ny)}" stroke="${shade(c, .6)}" stroke-width="1.6" opacity=".5"/>`;
  };
  const one = (s, E, W, rot) => {
    const j = J(s), ub = [(j[0] + E[0]) / 2 + s * 1.6, (j[1] + E[1]) / 2], fb = [(E[0] + W[0]) / 2 + s * .6, (E[1] + W[1]) / 2];
    let o = '';
    if (shortSl) {
      o += limb(j[0], j[1], ub[0], ub[1], E[0], E[1], aw - 1, skin) + limb(E[0], E[1], fb[0], fb[1], W[0], W[1], fw, skin);
      const m = [lerp(j[0], E[0], .42), lerp(j[1], E[1], .42)];
      o += limb(j[0], j[1], lerp(j[0], ub[0], .5), lerp(j[1], ub[1], .5), m[0], m[1], aw + 1.6, c);
      o += `<path d="M${P(m[0] - (aw / 2 + .8), m[1] + 1)} L${P(m[0] + (aw / 2 + .8), m[1] + 1)}" stroke="${shade(c, .62)}" stroke-width="1.3" opacity=".45"/>`;   // 소매 끝 접힌 선
    } else o += limb(j[0], j[1], ub[0], ub[1], E[0], E[1], aw, c) + limb(E[0], E[1], fb[0], fb[1], W[0], W[1], fw, c) + cuff(E[0], E[1], W[0], W[1], fw);
    o += `<path d="M${P(E[0] - s * F.fore * .5, E[1] + 4)} Q${P(fb[0] - s * F.fore * .6, fb[1])} ${P(W[0] - s * F.fore * .5, W[1] - 3)}" fill="none" stroke="${shade(shortSl ? skin : c, .72)}" stroke-width="1" opacity=".35"/>`;   // 팔 안쪽 그림자
    return o + mitt(W[0], W[1] + 1, s, skin, rot);
  };
  const elbowX = s => 60 + s * Math.max(F.sh + .5, U.waist + F.arm + 4.5, F.rib + U.bust * .7 + F.arm * .7);
  const def = s => one(s, [elbowX(s), F.waistY - 7], [60 + s * Math.max(F.hip + F.fore + 2.5, Math.abs(elbowX(s) - 60) + 1.5), F.crotch - 8], 0);
  if (pose === 'hip') return def(-1) + one(1, [60 + F.sh + 13, F.waistY - 30], [60 + U.waist + 3.5, F.waistY - 5], 58);
  if (pose === 'cross') {   // 팔짱: 위팔은 옆구리를 따라 내려오고, 아래팔이 가슴 아래에서 X자로 엇갈려 반대쪽 위팔을 잡음
    const ey = F.chest + 28, ex = s => 60 + s * (F.rib + U.bust * .6 + F.arm * .5 + 1.5);
    const up = s => { const j = J(s); return limb(j[0], j[1], j[0] + s * 2.5, (j[1] + ey) / 2, ex(s), ey, aw, c); };
    const fore = (s, dy, y2) => limb(ex(s), ey + dy, 60 + s * 4, ey + dy + 6, 60 - s * (F.rib + 1), y2, fw, c);
    return up(-1) + up(1) + fore(1, 0, ey - 15) + mitt(60 - (F.rib + 1), ey - 15, -1, skin, 125) + fore(-1, 3, ey - 9) + mitt(60 + (F.rib + 1), ey - 9, 1, skin, -125);
  }
  return def(-1) + def(1);
}

/* ---------- 함께 밤을 보낸 다음 날 아침 (어른만, 상반신) ---------- */
// 만족감 구간(0~4)마다 눈·입·볼, 머리 흐트러짐이 달라짐. 옷 대신 맨 어깨와 이불
const tierOf = v => v >= 90 ? 4 : v >= 70 ? 3 : v >= 50 ? 2 : v >= 30 ? 1 : 0;
function morningBody(a, skin, skinD, hw) {
  const blanketY = a.g === 'f' ? 130 : 138;
  return `<path d="${body(false, hw)}" fill="${skinD}"/>
    <path d="M47,121 Q53,124 58,122 M62,122 Q67,124 73,121" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M0,${blanketY + 6} C20,${blanketY - 4} 40,${blanketY + 4} 60,${blanketY} C80,${blanketY - 4} 100,${blanketY + 5} 120,${blanketY - 2} L120,160 L0,160 Z" fill="#ece6da"/>
    <path d="M18,${blanketY + 12} Q34,${blanketY + 22} 30,160 M84,${blanketY + 10} Q76,${blanketY + 24} 88,160 M52,${blanketY + 8} Q58,${blanketY + 18} 54,${blanketY + 30}" fill="none" stroke="#cfc6b6" stroke-width="1.6" stroke-linecap="round"/>`;
}
function messyHair(hc, n) {
  const list = ['M40,40 q-7,-4 -9,4', 'M78,36 q8,-5 11,3', 'M55,31 q-2,-9 6,-10', 'M34,58 q-7,1 -6,8', 'M86,56 q7,2 5,9'];
  return list.slice(0, n).map(d => `<path d="${d}" fill="none" stroke="${hc}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
}

/* ---------- 그리기 ---------- */
const POSE = { bold: 'hip', sunny: 'hip', sharp: 'cross', cool: 'cross' };
function render(a, size = 48, state = 25) {
  const st = typeof state === 'object' && state ? state : { age: state };
  const age = st.age ?? 25, full = !!st.full;
  const w = Math.round(size), h = Math.round(size * (full ? 7 / 3 : 4 / 3));
  if (!a) return `<svg class="av" width="${w}" height="${h}" viewBox="0 0 120 ${full ? 280 : 160}" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="${full ? 279 : 159}" rx="10"/></svg>`;
  UID++;
  const X = extras(a);
  const kid = age <= 12, teen = age >= 13 && age <= 18, adult = age >= 20;
  const af = adult && !full && st.after ? st.after : null, tier = af ? tierOf(af.sat ?? 50) : -1;
  const skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86);
  const old = age >= 40 && a.gray < (age - 38) / 22;   // 40대부터 흰머리 확률 증가
  const hc = HAIR[old ? GRAY : (kid || teen) && a.hc >= 4 ? a.hc - 3 : a.hc] || HAIR[0];   // 어린이·10대는 염색 안 함
  const top = teen ? 4 : kid ? (a.top === 1 ? 0 : a.top === 3 ? 2 : a.top) : a.top;
  const F = full ? frameOf(a, age, typeof st.full === 'object' ? st.full : null) : null;
  const hp = hairPieces(a, X, age, hc, F ? { sy: F.sy, chest: F.chest } : { sy: 115, chest: 146 });
  const ey = 72, ex = [48, 72];

  // 틀 — 상반신은 0 0 120 160. 전신은 머리 크기를 그대로 두고 화면을 넓혀서 몸 전체를 담음
  //   어른은 키 비교가 되도록 같은 틀(가장 큰 키 기준)에 발을 바닥에 맞춤 → 키가 작으면 머리 위가 빔
  let x0 = 0, y0 = 0, W = 120, H = 160;
  if (F) {
    const bottom = F.ankle + 19;
    H = F.adult ? 103 + 15 + 348 * 1.12 + 19 - 10 : Math.max(bottom - 10, 300);
    W = H * 120 / 280; x0 = 60 - W / 2; y0 = bottom - H;
  }
  const u = W / 120;   // 화면 1px이 몇 단위인지 (테두리 두께 맞춤)
  let o = `<svg class="av${full ? ' av-full' : ''}" width="${w}" height="${h}" viewBox="${f1(x0)} ${f1(y0)} ${f1(W)} ${f1(H)}" aria-hidden="true">`;
  o += `<rect class="av-bg" x="${f1(x0 + .5 * u)}" y="${f1(y0 + .5 * u)}" width="${f1(W - u)}" height="${f1(H - u)}" rx="${f1(10 * u)}"${full ? ` style="stroke-width:${f1(1.5 * u)}"` : ''}/>`;
  o += hp.back;
  // 몸 (목 + 옷). 전신: 하의·다리·신발 → 목 → 윗옷 → 팔
  const nh = F ? F.nh : kid ? 8.5 : a.g === 'f' ? 10.5 : 12, neckBot = F ? F.sy + 4 : kid ? 121 : 118;
  const neck = `<path d="M${f1(60 - nh)},94 L${f1(60 + nh)},94 L${f1(60 + nh)},${f1(neckBot)} L${f1(60 - nh)},${f1(neckBot)} Z" fill="${skinD}"/>`;
  if (F) {
    const bt = bottomOf(a, X, age, F);
    const U = upperBody(a, top, F, skinD, bt);
    o += lowerBody(a, X, age, F, skinD, bt) + neck + U.svg + arms(top, F, skinD, U, kid ? 'default' : st.pose || POSE[st.personality] || 'default');
  } else {
    const hw = halfWidth(a, kid, adult);
    o += neck + (af ? morningBody(a, skin, skinD, hw) : clothes(a, top, kid, skinD, hw, adult));
  }
  // 턱 아래·목 옆 그림자
  o += `<ellipse cx="60" cy="101.5" rx="${f1(nh - .5)}" ry="6" fill="${shade(skin, .6)}" opacity=".26"/>`;
  o += `<path d="M${f1(60 - nh + 1.6)},104 L${f1(60 - nh + 1.6)},${f1(neckBot - 2)} M${f1(60 + nh - 1.6)},104 L${f1(60 + nh - 1.6)},${f1(neckBot - 2)}" stroke="${shade(skin, .66)}" stroke-width="2" opacity=".14"/>`;
  if (a.buds) o += `<path d="M34,78 C30,96 40,112 47,130" fill="none" stroke="#f4f4f4" stroke-width="1.3"/>`;
  // 귀, 얼굴 (6살 이하는 둥근 얼굴)
  o += `<ellipse cx="33.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/><ellipse cx="86.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/>`;
  o += `<path d="M33,70 q-2.4,3 0,7 M87,70 q2.4,3 0,7" fill="none" stroke="${shade(skin, .68)}" stroke-width="1" opacity=".5"/>`;
  if (a.buds) o += `<circle cx="33" cy="76" r="2.6" fill="#f4f4f4"/>`;
  o += `<path d="${FACES[age <= 6 ? 0 : a.face] || FACES[0]}" fill="${skin}"/>`;
  // 볼 홍조 (모두 옅게, 어린이·볼 빨간 사람은 더), 주근깨, 주름
  const blush = f1((af ? [.1, .1, .25, .42, .55][tier] + (af.personality === 'shy' && tier >= 2 ? .15 : 0) : kid ? .3 : a.blush ? .24 : .1) * 100) / 100;
  o += `<ellipse cx="44" cy="84" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${blush}"/><ellipse cx="76" cy="84" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${blush}"/>`;
  if (a.freckles) o += [[43, 80], [46, 82], [49, 80], [71, 80], [74, 82], [77, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="${shade(skin, .62)}"/>`).join('');
  if (age >= 45) o += `<path d="M41,77 Q44,79 47,78 M73,78 Q76,79 79,77" fill="none" stroke="${shade(skin, .75)}" stroke-width="1"/>`;
  // 눈: 흰자 + 홍채 + 하이라이트 + 속눈썹 (어린이는 조금 크게) / 다음 날 아침엔 감은 눈
  const nLash = a.g === 'f' ? (age >= 18 ? 3 : 2) : kid ? 1 : 0;
  o += ex.map((x, i) => {
    const s = i ? 1 : -1;
    if (af && tier >= 3 && af.personality === 'playful' && i === 1) return HAPPY(x, ey);   // 장난형: 윙크
    if (af && tier === 4) return HAPPY(x, ey);
    if (af && tier === 3) return SLEEPY(x, ey, s, nLash);
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
  const female = a.g === 'f';
  const lip = { c: female && age >= 18 ? LIPS[X.lip] : female ? '#e39aa0' : NATURAL_LIP[a.skin] || NATURAL_LIP[1], teeth: X.teeth };
  o += af ? (tier === 0 ? FROWN : tier === 1 ? mouthSVG(2, lip, female) : tier >= 3 && af.personality !== 'cool' ? mouthSVG(1, lip, female) : mouthSVG(0, lip, female)) : mouthSVG(a.mouth, lip, female);
  if (af && af.lipstick && tier >= 3) o += `<path d="M75,90 q2.5,-3 5,0 q2.5,-3 5,0 q-2.5,4 -5,4 q-2.5,0 -5,-4 Z" fill="#c43c4f" opacity=".75" transform="rotate(-12 80 90)"/>`;   // 볼에 립스틱 자국
  if (a.dimples) o += `<path d="M50,87 q-1.5,2 0,3.5 M70,87 q1.5,2 0,3.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.1" stroke-linecap="round"/>`;
  // 앞머리·옆머리
  o += hp.front;
  if (af && tier >= 2) o += messyHair(hc, [0, 0, 1, 3, 5][tier]);
  // 안경
  if (a.glasses === 1) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><circle cx="48" cy="72" r="7.8"/><circle cx="72" cy="72" r="7.8"/><path d="M55.8,71 Q60,68.5 64.2,71 M40.2,71 L35,69 M79.8,71 L85,69"/></g>`;
  if (a.glasses === 2) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><rect x="39.5" y="65.5" width="17" height="12.5" rx="2.5"/><rect x="63.5" y="65.5" width="17" height="12.5" rx="2.5"/><path d="M56.5,71 L63.5,71 M39.5,70 L35,69 M80.5,70 L85,69"/></g>`;
  return o + '</svg>';
}

const topColor = a => TOP_COLORS[(a && a.tc) || 0];
window.Avatar = { make, render, topColor };
window.renderAvatar = render;
})();
