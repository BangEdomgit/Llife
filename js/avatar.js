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
// 머리색: 검정, 갈색, 밝은 갈색, 회색(나이 들면), 염색 6가지(와인, 애쉬 금발, 애쉬 브라운, 구릿빛, 밀크티 베이지, 핑크 브라운)
const HAIR = ['#23201f', '#4b3022', '#7d5536', '#a19d98', '#7e3343', '#c9a66c', '#6c625a', '#9a5a35', '#cdb594', '#9b6266'];
const GRAY = 3;
const TOP_COLORS = ['#4f6d8f', '#9a4f5f', '#5f8f6a', '#d0a443', '#ece7dd', '#3b3e48', '#8a6fb0', '#d9784a', '#6aa3c8', '#7a8a5a'];
const UNIFORM = { blazer: '#2f3a5a', shirt: '#f3f1ec', tie: ['#9b2f3a', '#2c4a7a', '#3d6b4a'], skirt: '#3b4766' };
const LINE = '#33241f';
const IRIS = ['#2b1d16', '#5b3a26', '#8a5c38', '#6e5a32', '#4d4c4b'];   // 검정, 갈색, 밝은 갈색, 헤이즐(드묾), 짙은 회색(드묾)
const METAL = ['#d8b45a', '#c9ced6'];   // 귀걸이·목걸이·안경테: 금, 은
const WHITE = '#fbf8f4', PUPIL = '#120c09', MOUTH_IN = '#7a2f33';
const LIPS = ['#d4707a', '#c9606b', '#b8434f', '#e0898f'];   // 어른 여자 립 색
const NATURAL_LIP = ['#e0a49b', '#cf8f80', '#a9654f', '#7d4535'];

const shade = (hex, k) => {   // k<1 어둡게, k>1 밝게
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('');
};

/* ---------- 생김새 만들기 ---------- */
// 파츠 수 (예전 저장의 번호는 그대로 쓰고, 새로 만드는 사람부터 늘어난 범위에서 뽑음)
const FACE_N = 6, EYE_N = 7, BROW_N = 5, MOUTH_N = 6;
const TOPS = [0, 1, 2, 3, 5, 6, 7, 8];   // 4는 교복이라 뽑지 않음
const M_HAIR = [0, 0, 1, 2, 2, 3, 3, 4, 5, 6, 6, 6, 7, 8, 8, 9];   // 남자는 장발·묶은 머리가 드묾
function make(seed, gender, opt = {}) {
  const r = rng(seed), n = k => Math.floor(r() * k);
  const f = opt.feature || '';
  const dyed = r() < .14;
  const a = {
    g: gender === 'f' ? 'f' : 'm',
    face: n(FACE_N),
    skin: opt.skin != null ? opt.skin : [0, 0, 1, 1, 1, 1, 2, 3][n(8)],
    hair: gender === 'f' ? n(STYLES.f.length) : M_HAIR[n(M_HAIR.length)],
    hc: dyed ? 4 + n(6) : [0, 0, 0, 1, 1, 2][n(6)],
    eyes: n(EYE_N), brows: n(BROW_N), mouth: n(MOUTH_N),
    glasses: f.includes('안경') ? 1 + n(4) : 0,
    top: TOPS[n(TOPS.length)], tc: n(TOP_COLORS.length), tie: n(UNIFORM.tie.length),
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
//   뒤쪽 세부(코·쌍꺼풀·수염·점·귀걸이…)는 나중에 더한 것 — 앞 순서를 건드리지 않게 이어서 뽑음
function extras(a) {
  const r = rng('x' + [a.g, a.face, a.skin, a.hair, a.hc, a.eyes, a.brows, a.mouth, a.top, a.tc, a.tie, a.gray].join(','));
  const n = k => Math.floor(r() * k);
  const X = { iris: n(3), gaze: [0, 0, 0, -1, 1][n(5)], bang: n(4), lip: n(LIPS.length), teeth: r() < .55, shoe: r(), pants: r(), hem: r() };
  const rare = r(), rareK = n(2);
  if (rare < .07) X.iris = 3 + rareK;                          // 헤이즐·회색 눈은 드묾
  X.nose = n(5);                                               // 코 5종
  X.lid = [0, 1, 1, 2, 2, 2][n(6)];                            // 쌍꺼풀: 없음 / 속쌍 / 겉쌍
  X.aegyo = r() < .35;                                         // 애교살
  X.lipF = [0, 1, 1, 1, 2][n(5)];                              // 입술 두께: 얇은 / 보통 / 도톰한
  const bd = r();                                              // 수염 (어른 남자): 없음 / 거뭇 / 콧수염 / 염소 / 짧은 턱수염
  X.beard = bd < .68 ? 0 : bd < .83 ? 1 : bd < .88 ? 2 : bd < .93 ? 3 : 4;
  const mo = r(), moK = n(4);
  X.mole = mo < .26 ? moK : -1;                                // 점: 입가 / 눈 밑 / 볼 / 턱
  const er = r(), erK = n(4);
  X.ear = a.g === 'f' ? (er < .55 ? 1 + erK : 0) : (er < .09 ? 1 : 0);   // 귀걸이: 큐빅 / 링 / 드롭 / 진주 (남자는 작은 큐빅만)
  X.metal = n(2);                                              // 금 / 은
  X.chain = r() < .3;                                          // 목걸이 (어른 여자)
  const pn = r(), pnK = n(2);
  X.pin = a.g === 'f' && pn < .2 ? 1 + pnK : 0;                // 실핀 / 머리띠
  X.liner = r() < .45;                                         // 아이라인 꼬리 (어른 여자)
  X.glc = n(4);                                                // 안경테: 검정 / 뿔테 갈색 / 금 / 은
  X.pinC = n(TOP_COLORS.length);                               // 머리띠 색
  return X;
}

/* ---------- 얼굴 ---------- */
const FACES = [
  'M33,68 C33,46 45,38 60,38 C75,38 87,46 87,68 C87,88 76,101 60,101 C44,101 33,88 33,68 Z',                       // 둥근형
  'M34,63 C34,45 46,38 60,38 C74,38 86,45 86,63 L86,80 C86,92 76,100 60,100 C44,100 34,92 34,80 Z',                  // 각진형
  'M35,66 C35,46 46,38 60,38 C74,38 85,46 85,66 C85,82 74,97 60,103 C46,97 35,82 35,66 Z',                            // 갸름형
  'M34,66 C34,46 45.5,38 60,38 C74.5,38 86,46 86,66 C86,85 75,99.5 60,102 C45,99.5 34,85 34,66 Z',                     // 계란형
  'M35.5,64 C35.5,45 46,37.5 60,37.5 C74,37.5 84.5,45 84.5,64 L84.5,77 C84.5,92 74.5,104 60,104 C45.5,104 35.5,92 35.5,77 Z',   // 긴 얼굴
  'M33,64 C33,45 45,38 60,38 C75,38 87,45 87,64 C87,74 84,82 78,90 C72,97 66,101.5 60,102 C54,101.5 48,97 42,90 C36,82 33,74 33,64 Z',   // 하트형 (광대 넓고 턱 뾰족)
];
// 귀: 바깥 테두리 + 안쪽 주름 + 귓구멍 그림자 (s: 왼쪽 -1 / 오른쪽 1). 얼굴이 안쪽 절반을 덮음
function earSVG(skin, s) {
  const X = dx => f1(60 + s * dx), d = shade(skin, .86), ln = shade(skin, .68);
  return `<path d="M${X(24.5)},65.6 C${X(29.6)},63.4 ${X(32)},67.4 ${X(31.6)},72.6 C${X(31.2)},77.2 ${X(30)},80.8 ${X(27.2)},81.2 C${X(25.6)},81.4 ${X(24.6)},80.2 ${X(24.4)},78 Z" fill="${d}" stroke="${ln}" stroke-width=".6" stroke-opacity=".5"/>` +
    `<ellipse cx="${X(27.9)}" cy="72.8" rx="1.3" ry="2.7" fill="${shade(skin, .7)}" opacity=".35"/>` +
    `<path d="M${X(26.4)},67.6 C${X(29.4)},67 ${X(30.1)},70.6 ${X(29.5)},73.9 C${X(29.1)},76.1 ${X(28.1)},77.2 ${X(27.1)},76.8" fill="none" stroke="${ln}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`;
}
// 눈 모양: 안쪽 꼬리(i), 바깥 꼬리(o), 윗꺼풀(u)·아랫꺼풀(l) 조절점, 홍채 반지름 (side: 왼눈 -1 / 오른눈 1)
function eyeShape(t, x, y, s) {
  if (t === 1) return { i: [x - 5.4 * s, y + .9], o: [x + 5.8 * s, y - 2.1], u: [x - .4 * s, y - 6.4], l: [x + .8 * s, y + 3.8], ir: [2.8, 3.3] };   // 날카로운: 눈꼬리 올라감, 가는 홍채
  if (t === 2) return { i: [x - 5.4 * s, y - .9], o: [x + 5.9 * s, y + 1.9], u: [x + .6 * s, y - 6.8], l: [x, y + 4.6], ir: [3.7, 3.8] };   // 처진: 눈꼬리 내려감, 큰 홍채
  if (t === 3) return { i: [x - 5.9 * s, y + .4], o: [x + 5.9 * s, y - .3], u: [x, y - 3.8], l: [x, y + 2.8], ir: [2.4, 2.4] };              // 가는: 가로로 긴 슬릿
  if (t === 4) return { i: [x - 5.8 * s, y + .8], o: [x + 6 * s, y - .9], u: [x + .5 * s, y - 5.2], l: [x, y + 3.9], ir: [3.1, 3.3], mono: 1 };   // 무쌍: 납작한 윗꺼풀, 굵은 눈두덩 선
  if (t === 5) return { i: [x - 6.1 * s, y + .9], o: [x + 6.2 * s, y + .1], u: [x + .2 * s, y - 8], l: [x, y + 6], ir: [3.8, 3.9], crease: 2 };     // 큰 눈: 또렷한 겉쌍
  if (t === 6) return { i: [x - 6 * s, y + 1], o: [x + 6.1 * s, y - 1], u: [x + 1 * s, y - 6.4], l: [x - .8 * s, y + 4.3], ir: [3.2, 3.4] };     // 아몬드: 앞트임처럼 안쪽이 뾰족
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
// 2차 곡선 위 점·접선
const qTan = (p0, c, p2, t) => [2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0]), 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1])];
// 곡선(안쪽 p0 → 바깥 p2)을 따라 위쪽으로 off(t)만큼 띄운 점들 (s: 왼눈 -1 / 오른눈 1)
function qOffset(p0, c, p2, s, t0, t1, off, N = 7) {
  const pts = [];
  for (let k = 0; k <= N; k++) {
    const t = t0 + (t1 - t0) * k / N, p = qAt(p0, c, p2, t), [tx, ty] = qTan(p0, c, p2, t), l = Math.hypot(tx, ty) || 1, d = off(t);
    pts.push([p[0] + s * ty / l * d, p[1] - s * tx / l * d]);
  }
  return pts;
}
const polyD = pts => `M${P(...pts[0])}${crThrough(pts)}`;
// 윗눈꺼풀 선: 눈머리는 가늘고 눈꼬리로 갈수록 굵어지는 채운 모양. wing: 아이라인 꼬리
function lidSVG(p0, c, p2, s, w0, w1, wing) {
  const th = t => w0 + (w1 - w0) * Math.pow(t, .8);
  const top = qOffset(p0, c, p2, s, 0, 1, t => th(t) * .72), bot = qOffset(p0, c, p2, s, 0, 1, t => -th(t) * .28);
  const end = bot[bot.length - 1], tip = [p2[0] + s * 3, p2[1] - 1.9];
  return `<path d="${polyD(bot)}${wing ? ` Q${P(end[0] + s * 1.6, end[1] - .2)} ${P(...tip)} L${P(top[top.length - 1][0] + s * .4, top[top.length - 1][1])}` : ''} L${P(...top[top.length - 1])}${crThrough(top.reverse())} Z" fill="${LINE}"/>`;
}
// 홍채: 위는 눈꺼풀 그림자로 짙고 아래는 밝게 + 테두리(윤부) + 동공
function irisSVG(X, id, gx, gy, rx, ry) {
  const c = IRIS[X.iris] || IRIS[0];
  return `<radialGradient id="${id}" cx=".5" cy=".72" r=".78"><stop offset="0" stop-color="${shade(c, 1.5)}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${shade(c, .5)}"/></radialGradient>` +
    `<ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="url(#${id})"/>` +
    `<ellipse cx="${f1(gx)}" cy="${f1(gy)}" rx="${f1(rx - .3)}" ry="${f1(ry - .3)}" fill="none" stroke="${shade(c, .42)}" stroke-width=".6" opacity=".75"/>` +
    `<ellipse cx="${f1(gx)}" cy="${f1(gy + .3)}" rx="${f1(rx * .48)}" ry="${f1(ry * .5)}" fill="${PUPIL}"/>`;
}
// 아래 눈꺼풀: 눈꼬리 쪽 속눈썹 선 + 전체 옅은 선
const lowerLid = (e, s) => `<path d="${polyD(qOffset(e.i, e.l, e.o, s, .38, 1, () => 0, 5))}" fill="none" stroke="${LINE}" stroke-width=".9" stroke-linecap="round" opacity=".5"/>` +
  `<path d="M${P(...e.i)} Q${P(...e.l)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width=".7" opacity=".2"/>`;
function openEye(a, X, x, y, s, nLash, o = {}) {
  const e = eyeShape(a.eyes, x, y, s), id = `av${UID}e${s > 0 ? 'r' : 'l'}`;
  const shape = `M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)} Q${P(...e.l)} ${P(...e.i)} Z`;
  const gx = x + X.gaze * 1.2, gy = y + .5;
  // 쌍꺼풀: 가는 눈·무쌍은 없음, 큰 눈은 늘 겉쌍 / 속쌍은 눈머리 쪽에서 붙고, 겉쌍은 나란히
  const lid = e.mono || a.eyes === 3 ? 0 : Math.max(e.crease || 0, X.lid);
  const crease = lid ? `<path d="${polyD(qOffset(e.i, e.u, e.o, s, lid === 1 ? .14 : .06, 1.04, t => lid === 1 ? 2.5 * clamp((t - .1) / .45, 0, 1) : 2.3))}" fill="none" stroke="${LINE}" stroke-width=".8" stroke-linecap="round" opacity=".42"/>` : '';
  const aegyo = o.aegyo ? `<path d="${polyD(qOffset(e.i, e.l, e.o, s, .12, .9, () => -2.4, 5))}" fill="none" stroke="${o.skinLn}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>` +
    `<ellipse cx="${f1(x + .3 * s)}" cy="${f1(e.l[1] - .2)}" rx="3.6" ry=".9" fill="#fff" opacity=".16"/>` : '';
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/>
    <g clip-path="url(#${id})">${irisSVG(X, id + 'i', gx, gy, e.ir[0], e.ir[1])}
      <circle cx="${f1(gx + 1.3)}" cy="${f1(gy - 1.4)}" r="1.4" fill="#fff"/><circle cx="${f1(gx - 1.1)}" cy="${f1(gy + 1.5)}" r=".6" fill="#fff" opacity=".8"/>
      <path d="M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)}" fill="none" stroke="${PUPIL}" stroke-width="3.4" opacity=".16"/></g>
    ${crease}${aegyo}${lidSVG(e.i, e.u, e.o, s, e.mono ? 1.5 : 1, e.mono ? 3.2 : 2.8, o.wing)}${lowerLid(e, s)}${nLash ? lashes(e, s, nLash) : ''}`;
}
// 반쯤 감은 눈: gap(눈꺼풀이 내려온 정도), (dx, dy) 시선
function halfEye(a, X, x, y, s, nLash, dx, dy, gap) {
  const e = eyeShape(a.eyes, x, y, s), id = `av${UID}ar${s > 0 ? 'r' : 'l'}`;
  const midU = [(e.i[0] + e.o[0]) / 2, Math.min(e.i[1], e.o[1]) + gap];
  const shape = `M${P(...e.i)} Q${P(...midU)} ${P(...e.o)} Q${P(...e.l)} ${P(...e.i)} Z`, gx = x + dx, gy = y + dy;
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/>
    <g clip-path="url(#${id})">${irisSVG(X, id + 'i', gx, gy, e.ir[0], e.ir[1] * .8)}
    <circle cx="${f1(gx + 1)}" cy="${f1(gy - .8)}" r="1.2" fill="#fff" opacity=".5"/>
    <path d="M${P(...e.i)} Q${P(...midU)} ${P(...e.o)}" fill="none" stroke="${PUPIL}" stroke-width="3" opacity=".18"/></g>
    ${lidSVG(e.i, midU, e.o, s, 1, 2.8)}${lowerLid(e, s)}${nLash ? lashes(e, s, nLash) : ''}`;
}
// 하트 눈: 반쯤 풀린 눈 안에 분홍 하트 홍채 (big이 아니면 홍채 위에 작은 하트 하이라이트만)
const HEART_P = 'M0,5 C-7,0 -6,-6 -2.5,-6 C-1,-6 0,-5 0,-4 C0,-5 1,-6 2.5,-6 C6,-6 7,0 0,5 Z';
function loveEye(a, X, x, y, s, nLash, gap, big) {
  const e = eyeShape(a.eyes, x, y, s), id = `av${UID}lv${s > 0 ? 'r' : 'l'}`;
  const midU = [(e.i[0] + e.o[0]) / 2, Math.min(e.i[1], e.o[1]) + gap];
  const shape = `M${P(...e.i)} Q${P(...midU)} ${P(...e.o)} Q${P(...e.l)} ${P(...e.i)} Z`, gx = x - .4, gy = y + (big ? .6 : -.2);
  const iris = big ? `<path d="${HEART_P}" transform="translate(${f1(gx)},${f1(gy)}) scale(.62)" fill="#ff4f86"/><path d="${HEART_P}" transform="translate(${f1(gx)},${f1(gy + .4)}) scale(.3)" fill="#c2185b" opacity=".6"/>`
    : `${irisSVG(X, id + 'i', gx, gy, e.ir[0], e.ir[1])}<path d="${HEART_P}" transform="translate(${f1(gx + 1.2)},${f1(gy - 1.2)}) scale(.2)" fill="#ffc2d6"/>`;
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/><g clip-path="url(#${id})">${iris}<circle cx="${f1(gx - 1.6)}" cy="${f1(gy - 1.8)}" r=".9" fill="#fff"/></g>
    ${lidSVG(e.i, midU, e.o, s, 1, 2.8)}${lowerLid(e, s)}${nLash ? lashes(e, s, nLash) : ''}`;
}
// 즐거운 벌린 입 (입꼬리 올라감, 윗니·혀): k 0~2 클수록 크게
const JOY = (k, lip, female) => {
  const w = 5.4 + k * .7, y0 = 87.2 - k * .3, y1 = 91.6 + k * 1.8;
  return `<path d="M${f1(60 - w)},${f1(y0)} Q60,${f1(y0 + 2)} ${f1(60 + w)},${f1(y0)} Q${f1(60 + w * .55)},${f1(y1)} 60,${f1(y1)} Q${f1(60 - w * .55)},${f1(y1)} ${f1(60 - w)},${f1(y0)} Z" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M${f1(60 - w * .62)},${f1(y0 + 1.1)} Q60,${f1(y0 + 2.6)} ${f1(60 + w * .62)},${f1(y0 + 1.1)} L${f1(60 + w * .5)},${f1(y0 + 2.2)} Q60,${f1(y0 + 3.4)} ${f1(60 - w * .5)},${f1(y0 + 2.2)} Z" fill="#fbf7f2"/>` +
    `<ellipse cx="60" cy="${f1(y1 - 1.5 - k * .3)}" rx="${f1(w * .48)}" ry="${f1(1.5 + k * .5)}" fill="#e27886"/>`;
};
// 절정 표정 (성격별). 없으면 하트 눈
const PEAK = {
  bold: { eye: 'open', mouth: 'joy2' },                        // 당당하게 눈 뜨고 웃음
  shy: { eye: 'squeeze', mouth: 'o', blush: .95, flush: 1 },  // 눈 못 뜨고 얼굴 전체 빨개짐
  playful: { eye: 'wink', mouth: 'tongue' },                  // 혀 내밀며 윙크
  cool: { eye: 'calm', mouth: 'smile', blush: .45 },          // 미소만 살짝
  warm: { eye: 'happy', mouth: 'joy1', tears: 1 },            // 눈물 + 미소
  sharp: { eye: 'sharp', mouth: 'smirk', brow: null },        // 날카로운 눈 + 입꼬리 올라감
  sunny: { eye: 'happy', mouth: 'joy2' },                     // 활짝 웃으며 눈 감김
  sensitive: { eye: 'happy', mouth: 'tremble', tears: 2 },    // 눈물 줄줄 + 입 떨림 (기분 좋아서)
};
const TONGUE = '<path d="M57.4,93.2 Q60,99.6 62.6,93.2 Z" fill="#e27886" stroke="#c25a6a" stroke-width=".8"/><path d="M60,94 V97" stroke="#c25a6a" stroke-width=".6" opacity=".6"/>';
const SMIRK = lip => `<path d="M54.4,88.8 Q59,90.6 66.2,86.2" fill="none" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/><path d="M57,90.6 Q60.5,92 64,89.6" fill="none" stroke="${lip.c}" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`;
const TREMBLE = (lip, female) => `<path d="M54.6,88 q1.35,-1.1 2.7,0 t2.7,0 t2.7,0 t2.7,0 Q60,94.5 54.6,88 Z" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.2" stroke-linejoin="round"/>`;
const TEARS = n => [48, 72].map((x, i) => { const s = i ? 1 : -1; return `<path d="M${f1(x + 4.8 * s)},74 q${f1(1.4 * s)},6 ${f1(.4 * s)},13${n > 1 ? ` M${f1(x + 2 * s)},75.5 q${f1(.8 * s)},5 0,10` : ''}" fill="none" stroke="#9fd4f0" stroke-width="1.5" stroke-linecap="round" opacity=".85"/>`; }).join('');
const MINI_HEARTS = `<path d="${HEART_P}" transform="translate(95,42) rotate(16) scale(.7)" fill="#ff6f94"/><path d="${HEART_P}" transform="translate(24,52) rotate(-14) scale(.52)" fill="#ff8fab"/>`;
const SPARKLE = (x, y, k) => `<path d="M${x},${y - 3 * k} Q${x + .5 * k},${y - .5 * k} ${x + 3 * k},${y} Q${x + .5 * k},${y + .5 * k} ${x},${y + 3 * k} Q${x - .5 * k},${y + .5 * k} ${x - 3 * k},${y} Q${x - .5 * k},${y - .5 * k} ${x},${y - 3 * k} Z" fill="#fff" opacity=".9"/>`;
// 질끈 감은 눈 (> <): 꼭짓점이 코 쪽
const SQUEEZE = (x, y, s) => `<path d="M${f1(x + 4.6 * s)},${y - 2.8} Q${f1(x - .5 * s)},${y - .6} ${f1(x - 3.8 * s)},${y + .4} Q${f1(x - .5 * s)},${y + 1.4} ${f1(x + 4.6 * s)},${y + 3.2}" fill="none" stroke="${LINE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
const SWEAT = (x, y, k = 1) => `<g transform="translate(${x},${y}) scale(${k})"><path d="M0,0 Q-2.6,3.8 -2.4,5.6 Q0,7.6 2.4,5.6 Q2.6,3.8 0,0 Z" fill="#d6f0ff" stroke="#86bfdc" stroke-width=".7"/><ellipse cx="-.9" cy="4.6" rx=".6" ry="1" fill="#fff"/></g>`;
const BLUSH_LINES = `<path d="${[44, 76].map(cx => [0, 1, 2].map(i => `M${cx - 4.4 + i * 3},87 l2,-3.6`).join(' ')).join(' ')}" fill="none" stroke="#d4574e" stroke-width="1" stroke-linecap="round" opacity=".55"/>`;
// 벌린 입 (숨이 차서): k 0~2 클수록 크게
const AH = (k, lip, female) => { const rx = 3 + k * .6, ry = 3.4 + k * .9; return `<ellipse cx="60" cy="${f1(89 + ry * .2)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.3"/><ellipse cx="60" cy="${f1(89 + ry * .75)}" rx="${f1(rx * .62)}" ry="${f1(ry * .34)}" fill="#c96a6e" opacity=".85"/>`; };
const POUT = lip => `<path d="M55.6,90.6 Q60,87.4 64.4,90.6" fill="none" stroke="${LINE}" stroke-width="1.9" stroke-linecap="round"/><path d="M57.4,91.8 Q60,93.2 62.6,91.8" fill="none" stroke="${lip.c}" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`;
// 감은 눈 (다음 날 아침): 나른하게 / 웃으며
const SLEEPY = (x, y, s, nl) => `<path d="M${x - 4.8},${y - .5} Q${x},${y + 3} ${x + 4.8},${y - .5}" fill="none" stroke="${LINE}" stroke-width="2.1" stroke-linecap="round"/>` +
  (nl ? `<path d="M${f1(x + 4.6 * s)},${y - .4} l${f1(1.8 * s)},1.4 M${f1(x + 3.4 * s)},${y + .8} l${f1(1.2 * s)},1.6" stroke="${LINE}" stroke-width="1" stroke-linecap="round"/>` : '');
const HAPPY = (x, y) => `<path d="M${x - 4.6},${y + 1.6} Q${x},${y - 3.6} ${x + 4.6},${y + 1.6}" fill="none" stroke="${LINE}" stroke-width="2.3" stroke-linecap="round"/>`;
// 눈썹 5종 (일자·아치·각진·두꺼운 일자·가늘고 둥근) + 표정 (화남: 안쪽이 내려감 / 놀람: 올라감 / 슬픔: 바깥쪽이 내려감)
function browPts(type, x, y, s, expr) {
  let inY = y, midY = y, outY = y, mx = x, k = 1;
  if (type === 0) { inY = y + .6; midY = y - .3; outY = y; }
  else if (type === 1) { inY = y + 1.2; midY = y - 3; outY = y + 1.4; }
  else if (type === 2) { inY = y + 1.6; midY = y - 2.8; outY = y + .6; mx = x + 2.2 * s; }
  else if (type === 3) { inY = y + .5; midY = y - .7; outY = y + .5; k = 1.3; }
  else { inY = y + 1.3; midY = y - 2.6; outY = y + 2.2; mx = x + .6 * s; k = .72; }
  if (expr === 'angry') { inY += 2.8; midY += .8; }
  else if (expr === 'surprised') { inY -= 2.6; midY -= 3; outY -= 2.2; }
  else if (expr === 'sad') { inY -= 2.2; outY += 1.8; }
  else if (expr === 'soft') { inY -= 1.4; midY -= 1; outY += .4; }   // 기분 좋게 풀린
  return { a: [x - 6 * s, inY], m: [mx, midY], b: [x + 6.4 * s, outY], ang: type === 2, k };
}
function brow(type, x, y, s, expr) {
  const B = browPts(type, x, y, s, expr);
  return B.ang ? `M${P(...B.a)} L${P(...B.m)} L${P(...B.b)}` : `M${P(...B.a)} Q${P(...B.m)} ${P(...B.b)}`;
}
// 채운 눈썹: 눈썹머리는 뭉툭하고 굵게, 꼬리로 갈수록 가늘게
function browFill(type, x, y, s, expr, wid) {
  const B = browPts(type, x, y, s, expr), w = wid * B.k, N = 8, up = [], dn = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    let p, tx, ty;
    if (B.ang) { const h = t < .5, u = h ? t * 2 : t * 2 - 1, A = h ? B.a : B.m, Z = h ? B.m : B.b; p = [lerp(A[0], Z[0], u), lerp(A[1], Z[1], u)]; tx = Z[0] - A[0]; ty = Z[1] - A[1]; }
    else { p = qAt(B.a, B.m, B.b, t); [tx, ty] = qTan(B.a, B.m, B.b, t); }
    const l = Math.hypot(tx, ty) || 1, nx = s * ty / l, ny = -s * tx / l;
    const th = w * (t < .25 ? lerp(.85, 1, t / .25) : lerp(1, .24, (t - .25) / .75)) / 2;
    up.push([p[0] + nx * th, p[1] + ny * th]); dn.push([p[0] - nx * th, p[1] - ny * th]);
  }
  return `M${P(...dn[0])}${crThrough(dn)} L${P(...up[N])}${crThrough(up.reverse())} Z`;
}
// 입 6종 (보통·웃는·무표정·약간 벌린·다문 미소·고양이 입). 윗입술 선 + 아랫입술, 여자는 입술 색
//   lip: { c 색, teeth, f 두께(0 얇은 / 1 보통 / 2 도톰), gloss 아랫입술 윤기 }
function mouthSVG(type, lip, female) {
  const lo = female ? .95 : .5, fz = lip.f ?? 1, d = [-.9, 0, 1.3][fz], gl = lip.gloss ? `<ellipse cx="58.4" cy="${f1(91 + d * .5)}" rx="1.7" ry=".55" fill="#fff" opacity=".4"/>` : '';
  if (type === 1) return lip.teeth
    ? `<path d="M52.5,86.4 Q60,95.6 67.5,86.4 Q60,89.2 52.5,86.4 Z" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.3" stroke-linejoin="round"/><path d="M54.6,87.5 Q60,89.6 65.4,87.5 L64.8,89.1 Q60,90.8 55.2,89.1 Z" fill="#fbf7f2"/>`
    : `<path d="M53,86.8 Q60,93.8 67,86.8" fill="none" stroke="${LINE}" stroke-width="1.9" stroke-linecap="round"/><path d="M56,90.8 Q60,${f1(92.8 + d * .6)} 64,90.8" fill="none" stroke="${lip.c}" stroke-width="${f1(1.7 + fz * .3)}" stroke-linecap="round" opacity="${lo}"/>`;
  if (type === 2) return `<path d="M55,88.8 L65,88.8" stroke="${LINE}" stroke-width="1.8" stroke-linecap="round"/><path d="M56.6,90 Q60,${f1(92.2 + d * .7)} 63.4,90" fill="none" stroke="${lip.c}" stroke-width="${f1(1.6 + fz * .3)}" stroke-linecap="round" opacity="${lo}"/>`;
  if (type === 3) return `<path d="M55.4,87 Q60,85.8 64.6,87 Q64.2,93.6 60,93.6 Q55.8,93.6 55.4,87 Z" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="60" cy="92" rx="2.6" ry="1.2" fill="#c96a6e" opacity=".8"/>`;
  if (type === 4) return (female ? `<path d="M55,87.6 Q57.4,86.2 60,87.3 Q62.6,86.2 65,87.6 Q60,89.4 55,87.6 Z" fill="${lip.c}" opacity=".9"/>` : '') +   // 다문 미소: 입꼬리가 올라감
    `<path d="M53.8,86.9 Q60,91.4 66.2,86.9" fill="none" stroke="${LINE}" stroke-width="1.7" stroke-linecap="round"/><path d="M53.2,86.1 q.9,.4 1.1,1.4 M66.8,86.1 q-.9,.4 -1.1,1.4" fill="none" stroke="${LINE}" stroke-width=".9" stroke-linecap="round" opacity=".6"/>` +
    `<path d="M57,90.8 Q60,${f1(92.6 + d * .6)} 63,90.8 Q60,91.4 57,90.8 Z" fill="${lip.c}" opacity="${lo}"/>${gl}`;
  if (type === 5) return `<path d="M55.6,87.7 Q57.9,89.7 60,88.4 Q62.1,89.7 64.4,87.7" fill="none" stroke="${LINE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +   // 고양이 입 (ω)
    `<path d="M57.6,90.9 Q60,${f1(92.3 + d * .6)} 62.4,90.9" fill="none" stroke="${lip.c}" stroke-width="${f1(1.4 + fz * .3)}" stroke-linecap="round" opacity="${lo}"/>`;
  return (female ? `<path d="M54.6,88 Q57.2,${f1(86.2 - d * .45)} 60,87.5 Q62.8,${f1(86.2 - d * .45)} 65.4,88 Q60,89.3 54.6,88 Z" fill="${lip.c}"/>` : '') +
    `<path d="M54,88.2 Q60,89.9 66,88.2" fill="none" stroke="${LINE}" stroke-width="1.7" stroke-linecap="round"/><path d="M56,89.5 Q60,${f1(93.2 + d)} 64,89.5 Q60,90.5 56,89.5 Z" fill="${lip.c}" opacity="${lo}"/>${gl}`;
}
// 코 5종: 꺾인 선 / 동글한 코끝 / 높은 콧대 / 넓은 콧방울 / 작고 뾰족한. 코끝 하이라이트 + 코 아래 그림자
function noseSVG(type, skin, kid) {
  const ln = shade(skin, .66), st = w => `fill="none" stroke="${ln}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const hl = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f1(r * .8)}" fill="#fff" opacity=".28"/>`;
  let o = `<ellipse cx="60.4" cy="84.7" rx="3" ry="1" fill="${shade(skin, .62)}" opacity=".16"/>`;
  if (type === 1) o += `<path d="M57.5,82.3 Q60,84.6 62.5,82.3" ${st(1.3)}/><path d="M58,83.3 q.8,.5 1.5,.2 M62,83.3 q-.8,.5 -1.5,.2" ${st(.9)} opacity=".6"/>${hl(60.2, 80.6, 1.3)}`;
  else if (type === 2) o += `<path d="M58.3,69.5 Q58.8,75.5 58.1,80.4" fill="none" stroke="${shade(skin, .74)}" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>` +
    `<path d="M58.2,81.4 Q57.4,83.7 59.7,84 Q61.7,84.1 62.7,82.8 Q63.4,81.8 62.4,80.9" ${st(1.4)}/><path d="M60.8,71.5 L61,79" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".22"/>`;
  else if (type === 3) o += `<path d="M56.5,80.4 Q55.4,83.4 58.2,83.7 M63.5,80.4 Q64.6,83.4 61.8,83.7" ${st(1.3)}/><path d="M58.6,84.2 Q60,84.9 61.4,84.2" ${st(.9)} opacity=".6"/>${hl(60, 81, 1.5)}`;
  else if (type === 4) o += `<path d="M60.6,78.2 L59.1,82.5 Q60.4,83.5 62,82.8" ${st(1.3)}/>${hl(60.6, 81.2, .9)}`;
  else o += `<path d="M61.2,76.4 L58.4,82.8 Q60.2,84.2 62.6,83.2" ${st(1.5)}/>`;
  return kid ? `<g transform="translate(60,82) scale(.82) translate(-60,-82)">${o}</g>` : o;
}
// 수염 (어른 남자): 1 거뭇한 턱 / 2 콧수염 / 3 염소수염 / 4 짧은 턱수염. clip: 얼굴 clipPath id
function beardSVG(kind, hc, clip) {
  if (!kind) return '';
  const c = shade(hc, .85);
  const jaw = op => `<g clip-path="url(#${clip})"><path d="M32,77 C34,93 47,104 60,104 C73,104 86,93 88,77 C85,86 79,91.5 72,93.8 Q66,95.6 60,95.4 Q54,95.6 48,93.8 C41,91.5 35,86 32,77 Z M52.6,86.8 Q56,84.4 60,85.4 Q64,84.4 67.4,86.8 Q60,86 52.6,86.8 Z" fill="${c}" opacity="${op}"/></g>`;
  const must = op => `<path d="M52.6,87.2 C54.4,84.6 57.6,84.5 60,85.6 C62.4,84.5 65.6,84.6 67.4,87.2 C64.8,86.4 62.4,86.6 60,87.3 C57.6,86.6 55.2,86.4 52.6,87.2 Z" fill="${c}" opacity="${op}"/>`;
  const chin = op => `<path d="M55.4,94.4 Q60,93.2 64.6,94.4 Q64.8,99.8 60,101.6 Q55.2,99.8 55.4,94.4 Z" fill="${c}" opacity="${op}"/>`;
  if (kind === 1) return jaw(.15);
  if (kind === 2) return jaw(.06) + must(.9);
  if (kind === 3) return jaw(.08) + must(.85) + chin(.8);
  return jaw(.34) + must(.92) + chin(.5);
}
// 점: 입가 / 눈 밑 / 볼 / 턱
const MOLES = [[54.2, 92.8], [41.6, 77.6], [77.6, 86.4], [65.6, 97.2]];
// 귀걸이 (s: 왼쪽 -1 / 오른쪽 1): 1 큐빅 / 2 링 / 3 드롭 / 4 진주
function earringSVG(kind, metal, s) {
  const x = f1(60 + s * 27), m = METAL[metal] || METAL[0], hi = `fill="#fff" opacity=".7"`;
  if (kind === 2) return `<circle cx="${x}" cy="83.8" r="3.1" fill="none" stroke="${m}" stroke-width="1.1"/><path d="M${f1(60 + s * 25.6)},81.4 a3.1,3.1 0 0 1 2.4,-.5" fill="none" stroke="#fff" stroke-width=".5" opacity=".6"/>`;
  if (kind === 3) return `<path d="M${x},80.6 L${x},85.6" stroke="${m}" stroke-width=".7"/><path d="M${x},85 Q${f1(60 + s * 28.7)},87.4 ${x},89.4 Q${f1(60 + s * 25.3)},87.4 ${x},85 Z" fill="${m}"/><circle cx="${f1(60 + s * 26.6)}" cy="86.8" r=".45" ${hi}/>`;
  if (kind === 4) return `<circle cx="${x}" cy="81.3" r="1.8" fill="#f5f0e6" stroke="#d6ccbb" stroke-width=".5"/><circle cx="${f1(60 + s * 26.4)}" cy="80.7" r=".55" ${hi}/>`;
  return `<circle cx="${x}" cy="80.8" r="1.25" fill="${m}"/><circle cx="${f1(60 + s * 26.6)}" cy="80.4" r=".45" ${hi}/>`;
}
// 안경: 1 동그란 / 2 네모 / 3 얇은 타원 / 4 반무테. 테 색: 검정 / 뿔테 / 금 / 은 (금·은은 가는 테). 렌즈 반사
function glassesSVG(type, glc) {
  if (!type) return '';
  const c = [LINE, '#6b4a2e', '#b8913a', '#9aa1aa'][glc || 0], w = glc >= 2 ? 1.15 : 1.8, g = `fill="none" stroke="${c}" stroke-width="${w}"`;
  const glare = [48, 72].map(x => `<path d="M${x - 4.6},${73.6} L${x - 1.4},${67.8} M${x - 2.4},${75.2} L${x - .6},${72}" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".38"/>`).join('');
  const lens = `fill="#dfeef7" opacity=".1"`;
  let o;
  if (type === 1) o = `<circle cx="48" cy="72" r="7.8" ${lens}/><circle cx="72" cy="72" r="7.8" ${lens}/><g ${g}><circle cx="48" cy="72" r="7.8"/><circle cx="72" cy="72" r="7.8"/><path d="M55.8,71 Q60,68.5 64.2,71 M40.2,71 L35,69 M79.8,71 L85,69"/></g>`;
  else if (type === 2) o = `<rect x="39.5" y="65.5" width="17" height="12.5" rx="2.5" ${lens}/><rect x="63.5" y="65.5" width="17" height="12.5" rx="2.5" ${lens}/><g ${g}><rect x="39.5" y="65.5" width="17" height="12.5" rx="2.5"/><rect x="63.5" y="65.5" width="17" height="12.5" rx="2.5"/><path d="M56.5,71 L63.5,71 M39.5,70 L35,69 M80.5,70 L85,69"/></g>`;
  else if (type === 3) o = `<ellipse cx="48" cy="72.4" rx="8.4" ry="6.4" ${lens}/><ellipse cx="72" cy="72.4" rx="8.4" ry="6.4" ${lens}/><g ${g} stroke-width="${f1(w * .8)}"><ellipse cx="48" cy="72.4" rx="8.4" ry="6.4"/><ellipse cx="72" cy="72.4" rx="8.4" ry="6.4"/><path d="M56.4,71.6 Q60,69.6 63.6,71.6 M39.6,71.4 L35,69.4 M80.4,71.4 L85,69.4"/></g>`;
  else o = `<path d="M39.5,66.5 L56.5,66.5 L56,73.5 Q55,78.2 48,78.2 Q41,78.2 40,73.5 Z M63.5,66.5 L80.5,66.5 L80,73.5 Q79,78.2 72,78.2 Q65,78.2 64,73.5 Z" ${lens}/>` +
    `<path d="M39.2,66.6 L56.8,66.6 M63.2,66.6 L80.8,66.6" stroke="${c}" stroke-width="${f1(w + .9)}" stroke-linecap="round"/><path d="M56.5,67.2 L56,73.5 Q55,78.2 48,78.2 Q41,78.2 40,73.5 L39.5,67.2 M80.5,67.2 L80,73.5 Q79,78.2 72,78.2 Q65,78.2 64,73.5 L63.5,67.2" fill="none" stroke="${c}" stroke-width=".6" opacity=".55"/><path d="M56.8,67.4 Q60,65.8 63.2,67.4 M39.2,67 L35,68.6 M80.8,67 L85,68.6" ${g}/>`;
  return o + glare;
}
const FROWN = `<path d="M54,90 Q60,86 66,90" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`;
// 살짝 벌어진 입술 (나를 향한 성욕이 높을 때): k 0~1 클수록 조금 더 벌어짐. 여자는 립 색 + 아랫입술 윤기
const PARTED = (k, lip, female) => {
  const g = 1.2 + k * 1.1, lc = female ? lip.c : shade(lip.c, .92);
  return `<ellipse cx="60" cy="${f1(88.9 + g * .25)}" rx="${f1(3.2 + k * .5)}" ry="${f1(g * .55)}" fill="${MOUTH_IN}"/>` +
    `<path d="M54.6,88.2 Q57.3,86.4 60,87.6 Q62.7,86.4 65.4,88.2 Q60,${f1(88.6)} 54.6,88.2 Z" fill="${lc}"${female ? '' : ' opacity=".7"'}/>` +
    `<path d="M54.6,88.2 Q57.3,86.4 60,87.6 Q62.7,86.4 65.4,88.2" fill="none" stroke="${LINE}" stroke-width="1.2" stroke-linecap="round" opacity=".75"/>` +
    `<path d="M53.6,87.2 q.9,.3 1.2,1.2 M66.4,87.2 q-.9,.3 -1.2,1.2" fill="none" stroke="${LINE}" stroke-width=".9" stroke-linecap="round" opacity=".6"/>` +   // 입꼬리가 살짝 올라감
    `<path d="M56.2,${f1(89.4 + g * .5)} Q60,${f1(92.6 + g * .45)} 63.8,${f1(89.4 + g * .5)} Q60,${f1(90.4 + g * .55)} 56.2,${f1(89.4 + g * .5)} Z" fill="${lc}"${female ? '' : ' opacity=".6"'}/>` +
    (female ? `<ellipse cx="58.6" cy="${f1(90.9 + g * .55)}" rx="1.5" ry=".5" fill="#fff" opacity=".45"/>` : '');
};

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
    { w: 32, ys: 64, bangs: ['comma'] },                                                         // 댄디 (쉼표머리)
    { w: 31, ys: 60, bangs: ['slick'], crown: 4 },                                               // 올백
    { w: 34.5, ys: 66, bangs: ['curly'], curly: true, crown: 2 },                                // 곱슬 펌
    { w: 33.5, ys: 70, bangs: ['see', 'center'], back: 'wolf', locks: 'wolf' },                 // 울프컷
  ],
  f: [
    { w: 35, ys: 78, bangs: ['straight', 'side', 'center', 'straight'], back: 'bob', locks: 'bob', crown: 1 },  // 단발
    { w: 34, ys: 78, bangs: ['side', 'straight', 'center', 'up'], back: 'shoulder', locks: 'shoulder' },       // 어깨
    { w: 34, ys: 78, bangs: ['center', 'side', 'straight', 'up'], back: 'long', locks: 'long' },               // 긴 머리
    { w: 32.5, ys: 70, bangs: ['up', 'side'], tail: 'low', wisps: true, crown: 3 },                            // 묶은
    { w: 32.5, ys: 70, bangs: ['straight', 'side', 'up', 'side'], tail: 'pony', crown: 2 },                    // 포니테일
    { w: 34, ys: 76, bangs: ['side', 'straight', 'center', 'side'], back: 'shoulder', locks: 'shoulder', bun: 'half' },  // 반묶음
    { w: 33, ys: 68, bangs: ['side', 'see', 'comma'], locks: 'pixie' },                                        // 숏컷
    { w: 35.5, ys: 78, bangs: ['center', 'see', 'side', 'see'], back: 'wavy', locks: 'wavy' },                // 긴 웨이브
    { w: 32.5, ys: 70, bangs: ['see', 'up', 'straight', 'see'], bun: 'high', wisps: true, crown: 1 },          // 똥머리
    { w: 33, ys: 72, bangs: ['side', 'straight', 'see', 'side'], braid: true, crown: 1 },                     // 옆으로 땋은 머리
    { w: 34.5, ys: 78, bangs: ['straight'], back: 'long', locks: 'hime' },                                    // 히메컷
    { w: 35, ys: 78, bangs: ['see', 'side', 'center', 'see'], back: 'layer', locks: 'layer' },                // 레이어드 (끝이 바깥으로 뻗침)
  ],
};
// 어린이는 머리 스타일이 단순해짐 (남: 짧은·덮은 / 여: 단발·포니테일·묶은). 교복 입는 10대 남자는 장발·묶은 머리 없음
//   새 스타일: 어린이 남 댄디·곱슬은 그대로 / 여 똥머리·땋은 머리는 그대로. 10대 남 올백 → 짧은, 울프컷 → 덮은 / 여 웨이브 → 긴 생머리
const KID_HAIR = { m: [0, 3, 0, 3, 3, 0, 6, 0, 8, 3], f: [0, 4, 0, 3, 4, 0, 0, 4, 8, 9, 0, 0] };
const TEEN_HAIR = { m: [0, 1, 2, 3, 3, 0, 6, 0, 8, 3], f: [0, 1, 2, 3, 4, 5, 6, 2, 8, 9, 10, 11] };
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
  comma:    ys => `C87,61.5 86.8,59.5 86,58 C85.4,61 83,63.4 80.5,62.6 C78.6,62 78.4,59.6 80,58.4 C76,55.6 70,52 62,50 C55,48.2 49.5,47 46.5,47.6 C40,49 35.5,53 34,57.4 C33.3,59.6 33,62 33,${ys}`,   // 쉼표: 끝이 안으로 말림
  slick:    ys => `C87,54 84,45 75,41.6 C69,39.6 64,40.4 60,40.4 C55,40.4 49,39.6 44,41.8 C36,45 33,54 33,${ys}`,                   // 올백: 이마를 다 드러냄
  curly:    ys => `C87,62 86.5,58 85,56.5 ${curls(85, 35, 56, 7)}C33.5,58 33,62 33,${ys}`,                                         // 곱슬: 동글동글한 끝
  see:      ys => `C87,58 84,49.5 74,46.6 Q60,43.8 46,46.6 C36,49.5 33,58 33,${ys}`,                                              // 시스루: 이마가 비치게 가는 가닥만 (가닥은 따로)
};
const PART = { side: 'M51,27.5 Q49.5,36 52.5,45', center: 'M60,26.5 Q60.4,34 60,41.6', comma: 'M47,28 Q45.4,37 47.4,46.6' };
// 동글동글한 곱슬 끝 (x1 → x2, 아래로 볼록한 반원 n개)
function curls(x1, x2, y, n) {
  let d = '';
  const dx = (x2 - x1) / n, r = Math.abs(dx) * .58;
  for (let i = 1; i <= n; i++) d += `A${f1(r)},${f1(r * 1.05)} 0 0 1 ${P(x1 + dx * i, y + (i % 2 ? -.8 : .5))} `;
  return d;
}
// 3차 곡선 위 점
const cAt = (p0, c1, c2, p3, t) => [0, 1].map(k => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * c1[k] + 3 * (1 - t) * t * t * c2[k] + t ** 3 * p3[k]);
// 끝이 가는 머리 가닥 (뿌리 b → 끝 t, c 조절점, w 뿌리 굵기)
function strandD(bx, by, cx, cy, tx, ty, w) {
  const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, px = -dy / l * w / 2, py = dx / l * w / 2;
  return `M${P(bx + px, by + py)} Q${P(cx + px * .5, cy + py * .5)} ${P(tx, ty)} Q${P(cx - px * .5, cy - py * .5)} ${P(bx - px, by - py)} Z`;
}
// 시스루뱅 가닥: 이마 위로 가늘게 내려옴
const SEE = [[41.5, 47.6, 40.4, 53, 39.6, 56.6], [47, 45.8, 46, 52, 45.8, 58], [52.6, 45, 52.4, 52, 51.6, 59.2], [58.4, 44.6, 58.6, 52, 57.8, 59.6], [64.2, 44.8, 64.6, 52, 65, 59.4], [70, 45.4, 70.6, 52, 71.4, 58.6], [76, 46.6, 77, 52, 78.6, 57.4]];
// 머리 결: 가르마에서 바깥으로 흐르는 곡선 몇 개 (밝은 결 + 어두운 결)
const STRANDS = {
  side:     ['M52,30 Q67,29.5 81,40', 'M53,34 Q68,36 83,49', 'M50,30 Q41,31 35,40', 'M56,40 Q70,44 80,52'],
  center:   ['M60,29 Q73,30 83,42', 'M60,29 Q47,30 37,42', 'M62,34 Q72,38 79,47', 'M58,34 Q48,38 41,47'],
  up:       ['M44,33 Q60,25.5 76,33', 'M39,39 Q60,30.5 81,39', 'M48,40 Q60,36.5 72,40'],
  straight: ['M46,38 Q45,47 44,55', 'M56,37 Q56,47 55,56', 'M66,37 Q66,47 67,56', 'M76,39 Q77,47 78,55', 'M44,31 Q60,25.5 76,31'],
  low:      ['M44,40 Q43,50 42,59', 'M54,39 Q54,50 53,60', 'M66,39 Q66,50 67,60', 'M77,41 Q78,50 79,59'],
  comma:    ['M49,33 Q66,32 82,44', 'M50,39 Q66,40 80,54', 'M48,31 Q40,32 35.5,40', 'M54,45 Q68,47 78,57'],
  slick:    ['M45,42.4 Q49,32 58,27', 'M53,41 Q57,32 66,28', 'M62,40.6 Q68,33 77,31', 'M70,41.4 Q78,36 84,42', 'M40,46 Q40,38 47,31'],
  see:      ['M60,29 Q73,30 83,42', 'M60,29 Q47,30 37,42', 'M46,37 Q60,32 74,37'],
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
  if (kind === 'wolf') { const yb = L.sy - 3; return `${dome} C${f1(60 + w + 3)},80 ${f1(60 + w + 5)},${f1(yb - 10)} ${f1(60 + w + 4)},${f1(yb - 2)} ${splitEnds(60 + w + 4, 60 - w - 4, yb - 2, 8)}C${f1(60 - w - 5)},${f1(yb - 10)} ${f1(60 - w - 3)},80 ${f1(60 - w - 2)},64 Z`; }   // 목덜미까지 층진 끝
  if (kind === 'layer') {   // 어깨 길이, 끝이 바깥으로 뻗침
    const yb = L.sy + 8, R = v => f1(60 + w + v), Lx = v => f1(60 - w - v);
    return `${dome} C${R(4)},80 ${R(5)},${f1(yb - 16)} ${R(5)},${f1(yb - 8)} Q${R(7)},${f1(yb - 1)} ${R(12)},${f1(yb - 4)} Q${R(8)},${f1(yb + 3)} ${R(1)},${f1(yb + 1)} ${splitEnds(60 + w + 1, 60 - w - 1, yb + 1, 6)}Q${Lx(8)},${f1(yb + 3)} ${Lx(12)},${f1(yb - 4)} Q${Lx(7)},${f1(yb - 1)} ${Lx(5)},${f1(yb - 8)} C${Lx(5)},${f1(yb - 16)} ${Lx(4)},80 ${Lx(2)},64 Z`;
  }
  if (kind === 'wavy') {   // 가슴 아래까지, 옆선이 물결
    const yb = L.chest + 26, side = s => { const pts = []; for (let y = 64; y <= yb - 4; y += 9) pts.push([60 + s * (w + 3 + (y - 64) * .05 + 2.6 * Math.sin((y - 64) / 18 * Math.PI)), y]); pts.push([60 + s * (w + 5 + (yb - 64) * .05), yb - 4]); return pts; };
    const Rp = side(1), Lp = side(-1).reverse();
    return `${dome} L${P(...Rp[0])}${crThrough(Rp)} ${curls(Rp[Rp.length - 1][0], Lp[0][0], yb - 3, 9)}L${P(...Lp[0])}${crThrough(Lp)} Z`;
  }
  return '';
}
// 옆머리 — 관자놀이에서 얼굴 옆(귀 앞)으로 내려와 어깨나 가슴 위로 떨어짐 (s: 왼쪽 -1 / 오른쪽 1)
function lock(kind, s, L) {
  const X = dx => f1(60 + s * dx), top = 58;
  if (kind === 'pixie') return `M${X(30)},${top} C${X(33.6)},66 ${X(33.6)},74 ${X(32.6)},82 L${X(30.4)},86.4 L${X(29.4)},80.4 C${X(28)},74 ${X(27.2)},66 ${X(26.8)},${top + 2} Z`;   // 숏컷: 귀 앞 짧은 구레나룻
  if (kind === 'hime') return `M${X(30)},${top} C${X(34.8)},66 ${X(35.2)},78 ${X(35.2)},97.4 L${X(27.2)},97.8 C${X(27)},84 ${X(26)},70 ${X(26.5)},${top + 4} Z`;   // 히메컷: 턱선에서 일자로 자른 옆머리
  if (kind === 'wavy') {
    const yb = L.chest + 8;
    return `M${X(30)},${top} C${X(36)},70 ${X(31)},82 ${X(35)},94 C${X(39)},106 ${X(32)},${f1(yb - 10)} ${X(35)},${f1(yb)} L${X(31)},${f1(yb + 4)} L${X(28.6)},${f1(yb - .5)} C${X(25)},${f1(yb - 12)} ${X(31.5)},104 ${X(27)},94 C${X(23)},84 ${X(28)},70 ${X(26.5)},${top + 4} Z`;
  }
  if (kind === 'layer') {   // 끝이 바깥으로 뻗침
    const yb = L.sy + 4;
    return `M${X(30)},${top} C${X(35.5)},74 ${X(35)},${f1(yb - 16)} ${X(34)},${f1(yb - 5)} Q${X(35.5)},${f1(yb)} ${X(39.5)},${f1(yb - 2.4)} Q${X(36)},${f1(yb + 3)} ${X(30)},${f1(yb + 1.6)} L${X(28.4)},${f1(yb - 1.6)} C${X(26)},${f1(yb - 12)} ${X(25)},74 ${X(26.5)},${top + 4} Z`;
  }
  const yb = f1(kind === 'bob' ? 103 : kind === 'shoulder' ? L.sy + 6 : kind === 'long' ? L.chest + 12 : kind === 'wolf' ? 97 : L.sy);
  const end = kind === 'bob'
    ? `C${X(33.5)},${f1(yb + 5)} ${X(28)},${f1(yb + 4.5)} ${X(25.5)},${f1(yb - 1)}`                       // 단발: 끝이 안쪽으로 말림 (C커브)
    : `L${X(31)},${f1(yb + 4)} L${X(29)},${yb} L${X(26.8)},${f1(yb + 3.4)} L${X(25.2)},${f1(yb - 2)}`;   // 끝이 갈라짐
  return `M${X(30)},${top} C${X(35.5)},${top + 18} ${X(35)},${f1(yb - 24)} ${X(34)},${yb} ${end} C${X(25.5)},${f1(yb - 22)} ${X(25)},${top + 22} ${X(26.5)},${top + 4} Z`;
}
// 땋은 머리: 왼쪽(보는 쪽) 귀 뒤에서 어깨 앞으로 내려옴. 굵기가 줄어드는 몸통 + 엇갈려 맞물리는 마디 선 + 마디마다 윤기 + 고무줄·끝 술
function braidSVG(hc, L) {
  const y0 = 79, y1 = L.chest + 12, x0 = 34.6, x1 = 40.6, n = Math.max(4, Math.round((y1 - y0) / 6.6)), seg = (y1 - y0) / n;
  const at = t => [lerp(x0, x1, t * t), lerp(y0, y1, t)], wid = t => lerp(8.8, 6.2, t);
  const body = taperD([[...at(0), wid(0)], [...at(.5), wid(.5)], [...at(1), wid(1)]], true);
  let d = '', hl = '';
  for (let i = 0; i < n; i++) {
    const ta = (i + .1) / n, [ax, ay] = at(ta), ha = wid(ta) / 2, tb = (i + .6) / n, [bx, by] = at(tb), hb = wid(tb) / 2;
    d += `M${P(ax - ha, ay)} Q${P(ax - ha * .1, ay + seg * .12)} ${P(ax + ha * .3, ay + seg * .62)} M${P(bx + hb, by)} Q${P(bx + hb * .1, by + seg * .12)} ${P(bx - hb * .3, by + seg * .62)} `;
    hl += `M${P(ax - ha * .62, ay + seg * .14)} q${f1(ha * .32)},${f1(seg * .1)} ${f1(ha * .62)},${f1(seg * .36)} M${P(bx + hb * .62, by + seg * .14)} q${f1(-hb * .32)},${f1(seg * .1)} ${f1(-hb * .62)},${f1(seg * .36)} `;
  }
  const [ex, ey] = at(1);
  return `<path d="${body}" fill="${hc}"/><path d="${d}" fill="none" stroke="${shade(hc, .55)}" stroke-width=".9" stroke-linecap="round" opacity=".7"/>` +
    `<path d="${hl}" fill="none" stroke="${shade(hc, 1.6)}" stroke-width=".8" stroke-linecap="round" opacity=".28"/>` +
    `<path d="M${f1(ex - 2.6)},${f1(ey)} C${f1(ex - 4)},${f1(ey + 5)} ${f1(ex - 2)},${f1(ey + 9)} ${f1(ex)},${f1(ey + 10)} C${f1(ex + 2)},${f1(ey + 9)} ${f1(ex + 4)},${f1(ey + 5)} ${f1(ex + 2.6)},${f1(ey)} Z" fill="${hc}"/>` +
    `<path d="M${f1(ex - 1)},${f1(ey + 2)} L${f1(ex - 1.4)},${f1(ey + 8)} M${f1(ex + 1)},${f1(ey + 2)} L${f1(ex + 1.2)},${f1(ey + 8)}" stroke="${shade(hc, .6)}" stroke-width=".6" opacity=".5"/>` +
    `<rect x="${f1(ex - 3)}" y="${f1(ey - 1.6)}" width="6" height="2.6" rx="1.2" fill="${shade(hc, .5)}"/>`;
}
function hairPieces(a, X, age, hc, L) {
  const kid = age <= 12, teen = age >= 13 && age <= 18;
  const idx = (kid ? KID_HAIR : teen ? TEEN_HAIR : null)?.[a.g][a.hair] ?? a.hair;
  const st = STYLES[a.g][idx] || STYLES[a.g][0];
  const bang = st.bangs[X.bang % st.bangs.length];
  const w = st.w, ys = st.ys, top = 27 - (st.crown || 0), dark = shade(hc, .82), band = shade(TOP_COLORS[a.tc], .8);
  let back = '', front = '', shadow = '';
  // 뒤: 묶음(정수리·반묶음·똥머리), 꼬리, 뒷머리
  if (st.bun === 'top') back += `<circle cx="60" cy="20.5" r="7.5" fill="${shade(hc, .9)}"/><path d="M54.5,25 Q60,27.4 65.5,25" fill="none" stroke="${shade(hc, .55)}" stroke-width="1.6"/>`;
  if (st.bun === 'half') back += `<circle cx="60" cy="23" r="6.2" fill="${shade(hc, .9)}"/>`;
  if (st.bun === 'high') back += `<circle cx="60" cy="15.5" r="10.5" fill="${shade(hc, .92)}"/><path d="M52,13 Q57,6.4 64.6,9.4 M51.4,18 Q56,22.6 64,20.4 Q68.6,18.6 68.4,13.6 M56.4,13.6 Q60.4,11.2 63.6,14.4" fill="none" stroke="${shade(hc, .62)}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/><path d="M54.4,9.6 Q59,6.6 64,8.4" fill="none" stroke="${shade(hc, 1.5)}" stroke-width="1.6" stroke-linecap="round" opacity=".22"/><path d="M53,24.6 Q60,27.4 67,24.6" fill="none" stroke="${band}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (st.tail === 'low') back += `<path d="M85,72 C95,85 96,106 90,126 C88,133 82,134 81,128 C85,112 85,95 79,80 Z" fill="${dark}"/><path d="M86,84 Q90,104 86,124" fill="none" stroke="${shade(hc, 1.4)}" stroke-width="1.1" opacity=".18"/><rect x="84.4" y="87" width="8.6" height="3.4" rx="1.6" transform="rotate(-12 88.7 88.7)" fill="${band}"/>`;
  if (st.tail === 'pony') back += `<path d="M77,36 C97,35 106,58 101,88 C99,98 96,104 92,100 L94,95 L90,96 C95,74 93,54 80,46 Z" fill="${dark}"/><path d="M86,42 Q99,58 96,90" fill="none" stroke="${shade(hc, 1.4)}" stroke-width="1.1" opacity=".18"/>`;
  if (st.back) back += `<path d="${backHair(st.back, w, L)}" fill="${dark}"/>`;
  if (st.back === 'long' || st.back === 'shoulder' || st.back === 'wavy' || st.back === 'layer') back += `<path d="M${f1(60 - w + 1)},70 Q${f1(60 - w - 3)},${f1(L.sy)} ${f1(60 - w + 1)},${f1(L.sy + 30)} M${f1(60 + w - 1)},70 Q${f1(60 + w + 3)},${f1(L.sy)} ${f1(60 + w - 1)},${f1(L.sy + 30)}" fill="none" stroke="${shade(hc, 1.35)}" stroke-width="1.2" opacity=".14"/>`;
  // 앞: 반삭은 두피가 비침, 투블럭은 옆을 짧게 깎은 경계
  if (st.buzz) front += `<path d="M31,68 C30,42 43,30.5 60,30.5 C77,30.5 90,42 89,68 Z" fill="${shade(hc, .9)}" opacity=".45"/>`;
  if (st.block) front += `<path d="M29.5,52 L35.5,49.5 L35,72 L30.5,70 Z M90.5,52 L84.5,49.5 L85,72 L89.5,70 Z" fill="${hc}" opacity=".38"/>`;
  const dl = [60 - w, ys], dc1 = [60 - w - 1.5, top + 20], dc2 = [60 - w * .6, top], dt = [60, top];
  let domeD = `M${f1(60 - w)},${ys} C${f1(60 - w - 1.5)},${top + 20} ${f1(60 - w * .6)},${top} 60,${top} C${f1(60 + w * .6)},${top} ${f1(60 + w + 1.5)},${top + 20} ${f1(60 + w)},${ys}`;
  if (st.curly) {   // 곱슬: 윤곽이 동글동글
    const pts = [];
    for (let i = 0; i <= 5; i++) pts.push(cAt(dl, dc1, dc2, dt, i / 5));
    for (let i = 4; i >= 0; i--) { const q = cAt(dl, dc1, dc2, dt, i / 5); pts.push([120 - q[0], q[1]]); }
    domeD = `M${P(...pts[0])}` + pts.slice(1).map((q, i) => { const p0 = pts[i], r = Math.hypot(q[0] - p0[0], q[1] - p0[1]) * .6; return ` A${f1(r)},${f1(r)} 0 0 1 ${P(...q)}`; }).join('');
  }
  const mainD = `${domeD} L87,${ys} ${BANGS[bang](ys)} L${f1(60 - w)},${ys} Z`;
  front += `<path d="${mainD}" fill="${hc}"${st.buzz ? ' opacity=".55"' : ''}/>`;
  if (!st.buzz) {
    shadow += mainD;
    front += strands(STRANDS[bang], hc);
    // 윤기: 정수리 아래로 둥근 띠 (끊어진 하이라이트)
    const hid = `av${UID}h`;
    front += `<clipPath id="${hid}"><path d="${mainD}"/></clipPath><g clip-path="url(#${hid})"><path d="M${f1(60 - w * .8)},${top + 18} Q60,${top + 4} ${f1(60 + w * .8)},${top + 18}" fill="none" stroke="${shade(hc, 1.75)}" stroke-width="3.6" stroke-dasharray="16 2.6 7 2.6 20 2.6" opacity=".14"/>` +
      `<path d="M${f1(60 - w * .95)},${ys} C${f1(60 - w - 1)},${top + 22} ${f1(60 - w * .6)},${top + 1} 60,${top + 1}" fill="none" stroke="${shade(hc, .6)}" stroke-width="2.4" opacity=".18"/></g>`;
  }
  if (st.curly) front += `<path d="${[[44, 36], [54, 31.5], [66, 32], [76, 37], [40, 46], [50, 41.6], [62, 40.6], [72, 43.6], [81, 49]].map(([x, y]) => `M${x},${y} a2.4,2.4 0 1 1 3.4,1.4`).join(' ')}" fill="none" stroke="${shade(hc, .58)}" stroke-width="1" stroke-linecap="round" opacity=".28"/>` +
    `<path d="${[[47, 34], [59, 30], [70, 35], [45, 44], [57, 39.6], [67, 42]].map(([x, y]) => `M${x},${y} a2,2 0 0 1 3,-.6`).join(' ')}" fill="none" stroke="${shade(hc, 1.5)}" stroke-width="1" stroke-linecap="round" opacity=".22"/>`;
  if (bang === 'see') { const sd = SEE.map(q => strandD(...q, 3.4)).join(' '); front += `<path d="${sd}" fill="${hc}"/>`; shadow += ' ' + sd; }
  if (PART[bang]) front += `<path d="${PART[bang]}" fill="none" stroke="${shade(hc, .55)}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`;
  if (st.locks) {
    const ld = `${lock(st.locks, -1, L)} ${lock(st.locks, 1, L)}`;
    front += `<path d="${ld}" fill="${hc}"/>` + (st.locks === 'pixie' ? '' : `<path d="M29,66 Q27,84 29.5,100 M91,66 Q93,84 90.5,100" fill="none" stroke="${shade(hc, 1.45)}" stroke-width="1.1" opacity=".18"/>`);
    shadow += ' ' + ld;
  }
  if (st.wisps) front += `<path d="M33.5,57 q-3.4,6 -1.2,13.5 M86.5,57 q3.4,6 1.2,13.5" fill="none" stroke="${hc}" stroke-width="1.2" stroke-linecap="round"/>`;   // 잔머리
  if (st.braid) front += braidSVG(hc, L);
  if (st.tail === 'pony') front += `<path d="M82,40 l5,-4 l.6,6 Z M82,40 l4.6,4.4 l-5.4,1.6 Z" fill="${TOP_COLORS[a.tc]}"/><circle cx="82" cy="40" r="2.8" fill="${band}"/>`;   // 리본
  if (st.bun === 'half') front += `<path d="M54.5,27.5 Q60,29.6 65.5,27.5" fill="none" stroke="${band}" stroke-width="2"/>`;
  // 머리 장식 (여자, 4살부터): 실핀 두 개 / 머리띠
  if (X.pin === 1 && age >= 4 && !st.buzz) front += `<path d="M75.6,41.4 L82.6,45.4 M76.6,44.6 L83.4,48.2" stroke="${METAL[X.metal]}" stroke-width="1.2" stroke-linecap="round"/>`;
  if (X.pin === 2 && age >= 4) { const hb = TOP_COLORS[X.pinC], yb = Math.min(ys - 10, 60); front += `<path d="M${f1(60 - w + 1)},${yb} C${f1(60 - w * .74)},${top + 3} ${f1(60 + w * .74)},${top + 3} ${f1(60 + w - 1)},${yb}" fill="none" stroke="${hb}" stroke-width="3.4" stroke-linecap="round"/><path d="M${f1(60 - w * .6)},${top + 9} Q60,${top + 3.2} ${f1(60 + w * .6)},${top + 9}" fill="none" stroke="#fff" stroke-width=".9" opacity=".3"/>`; }
  return { back, front, shadow: st.buzz ? '' : shadow };
}

/* ---------- 몸·옷 공용 ---------- */
// 쇄골: 목 아래에서 어깨 쪽으로 살짝 벌어지는 V
const clav = (y, half, skin, k = 1) => `<path d="M${f1(60 - 3 * k)},${f1(y)} Q${f1(60 - half * .55)},${f1(y + 1.6 * k)} ${f1(60 - half)},${f1(y + .6 * k)} M${f1(60 + 3 * k)},${f1(y)} Q${f1(60 + half * .55)},${f1(y + 1.6 * k)} ${f1(60 + half)},${f1(y + .6 * k)}" fill="none" stroke="${shade(skin, .74)}" stroke-width="${f1(1.1 * k)}" stroke-linecap="round" opacity=".7"/>`;
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
//   티 / 셔츠 / 후디 / 니트(밑단 골지가 허리 바로 아래) / 교복 재킷 / 터틀넥 / 가디건(안에 티) / 재킷 / 줄무늬 보트넥
const TOP_FIT = [[1, 0, .55, 1], [2, .3, .62, 1], [5, .85, .6, .5], [3, .35, .3, 1], [4, .25, .75, .5], [1.2, .1, .5, 1], [3.5, .5, .64, .75], [4, .45, .74, .6], [1.5, .15, .56, 1]];
const STRIPE_BASE = '#f2eee5';
// 가슴 입체감 — 가슴 자리(가운데에서 ±bx, 꼭짓점 높이 cy, 반지름 r)에만: 윗면 하이라이트 + 아래쪽 둥근 그림자(위 절반은 마스크로 지움)
//   + valley면 가운데 골 그림자. dk 그림자 색, op 세기. 옷·맨몸 공용 (좌표는 전신 px)
function bustVolume(id, bx, cy, r, dk, op, valley, k) {
  const q = v => f1(v * 100) / 100, y0 = cy - r * 2.2, hgt = r * 4.4;
  let o = `<defs><linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(cy - r * .22)}" x2="0" y2="${f1(cy + r * .16)}"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
    `<mask id="${id}m" maskUnits="userSpaceOnUse" x="-40" y="${f1(y0)}" width="200" height="${f1(hgt)}"><rect x="-40" y="${f1(y0)}" width="200" height="${f1(hgt)}" fill="url(#${id}l)"/></mask>` +
    `<radialGradient id="${id}g" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${dk}" stop-opacity="${q(op * .3)}"/><stop offset=".6" stop-color="${dk}" stop-opacity="${q(op * .45)}"/><stop offset=".9" stop-color="${dk}" stop-opacity="${q(op * .85)}"/><stop offset="1" stop-color="${dk}" stop-opacity="${q(op)}"/></radialGradient>` +
    `<radialGradient id="${id}h"><stop offset="0" stop-color="#fff" stop-opacity="${q(op * .42)}"/><stop offset=".6" stop-color="#fff" stop-opacity="${q(op * .2)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    (valley ? `<radialGradient id="${id}v"><stop offset="0" stop-color="${dk}" stop-opacity="${q(op * .9)}"/><stop offset="1" stop-color="${dk}" stop-opacity="0"/></radialGradient>` : '') + '</defs>';
  o += [-1, 1].map(s => `<ellipse cx="${f1(60 + s * bx)}" cy="${f1(cy)}" rx="${f1(r)}" ry="${f1(r)}" fill="url(#${id}g)" mask="url(#${id}m)"/>` +
    `<ellipse cx="${f1(60 + s * (bx - r * .08))}" cy="${f1(cy - r * .52)}" rx="${f1(r * .72)}" ry="${f1(r * .34)}" fill="url(#${id}h)"/>`).join('');
  if (valley) o += `<ellipse cx="60" cy="${f1(cy - r * .12)}" rx="${f1(1.8 * k + Math.max(0, bx - r) * .8)}" ry="${f1(r * .62)}" fill="url(#${id}v)"/>`;
  return o;
}
// 밑단 골지 (세로줄)
const hemRib = (hemW, hemY, k, c) => `<path d="${Array.from({ length: 9 }, (_, i) => { const x = 60 - hemW + 1.5 + i * (hemW * 2 - 3) / 8; return `M${f1(x)},${f1(hemY - 6 * k)} L${f1(x)},${f1(hemY)}`; }).join(' ')}" stroke="${c}" stroke-width="${f1(1.2 * k)}"/>`;
// 윗옷 (전신): 몸 앵커 + 여유분. 헐렁할수록 허리 곡선이 덜 드러남. 어른 여자는 옆 볼록·밑단 들림 + 가슴 자리 입체 그림자
//   상반신 초상화도 이 함수를 머리 좌표로 옮겨서 씀 → 어깨 폭·가슴 위치가 전신과 같음. X: 세부(목걸이)
function topFull(a, top, A, skin, bt, X) {
  const stripe = top === 8, base = TOP_COLORS[a.tc];
  const c = top === 4 ? UNIFORM.blazer : stripe ? (base === '#ece7dd' ? '#3b4a6b' : base) : base, dark = shade(c, .78), fold = shade(c, .58);
  const [e, loose, hemR, bustF] = TOP_FIT[top] || TOP_FIT[0];
  const { y, w } = A, k = A.hs, sw = v => f1(v * k), nh = w.nh, ny = y.neck, sig = A.adult && A.f ? A.sig : null, tid = `av${UID}t`;
  const tucked = !!bt.tucked, rib = top === 2 || top === 3 || top === 5 || top === 6, fitted = top === 0 || top === 1 || top === 3 || top === 5 || top === 8;
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
  const shapeD = symShape(R, hemY + 1.4 - 2 * lift, ny + 2), fillC = stripe ? `url(#${tid}p)` : c;
  let o = `<defs><clipPath id="${tid}c"><path d="${shapeD}"/></clipPath>${stripe ? `<pattern id="${tid}p" patternUnits="userSpaceOnUse" x="0" y="${f1(ny)}" width="40" height="${sw(7)}"><rect width="40" height="${sw(7)}" fill="${STRIPE_BASE}"/><rect y="${sw(4.2)}" width="40" height="${sw(2.8)}" fill="${c}"/></pattern>` : ''}</defs>`;
  o += `<path d="${shapeD}" fill="${fillC}" stroke="${shade(c, .6)}" stroke-width=".55" stroke-opacity=".55"/>`;
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
  } else if (top === 5) {   // 터틀넥: 목을 감싸며 접힌 깃(세로 골지) + 밑단 골지
    const t0 = ny - 6.5 * k, t1 = ny + 3 * k, c0 = nh + 1.6 * k, c1 = nh + 3.4 * k;
    let ribs = '';
    for (let i = -3; i <= 3; i++) ribs += `M${f1(60 + i * c0 / 3.7)},${f1(t0 + 1.4 * k)} L${f1(60 + i * c1 / 3.7)},${f1(t1 + 1.8 * k)} `;
    o += `<path d="M${f1(60 - c0)},${f1(t0)} Q60,${f1(t0 + 1.8 * k)} ${f1(60 + c0)},${f1(t0)} L${f1(60 + c1)},${f1(t1)} Q60,${f1(t1 + 3.2 * k)} ${f1(60 - c1)},${f1(t1)} Z" fill="${c}" stroke="${shade(c, .6)}" stroke-width=".5"/>
      <path d="${ribs}" stroke="${dark}" stroke-width="${sw(.8)}" opacity=".5"/><path d="M${f1(60 - c0 - .4 * k)},${f1(t0 + 3 * k)} Q60,${f1(t0 + 5 * k)} ${f1(60 + c0 + .4 * k)},${f1(t0 + 3 * k)}" fill="none" stroke="${fold}" stroke-width="${sw(1.1)}" opacity=".4"/>
      <path d="M${f1(60 - c1)},${f1(t1)} Q60,${f1(t1 + 3.2 * k)} ${f1(60 + c1)},${f1(t1)}" fill="none" stroke="${fold}" stroke-width="${sw(1.6)}" opacity=".3"/>${hemRib(hemW, hemY, k, dark)}`;
  } else if (top === 6) {   // 가디건: 앞이 V로 트여 안의 티가 보임 + 앞단 + 단추 + 밑단 골지
    const ic = c === '#ece7dd' || c === '#d0a443' ? '#3b3e48' : '#f1ede4', vy = lerp(y.bust, y.underbust, .35);
    const band = sd => `M${f1(60 + sd * (nh + 2.2 * k))},${f1(ny - .5 * k)} L${f1(60 + sd * .7 * k)},${f1(vy)} L${f1(60 + sd * .7 * k)},${f1(hemY)}`;
    o += `<path d="M${f1(60 - nh - 2.2 * k)},${f1(ny - .5 * k)} L${f1(60 - .7 * k)},${f1(vy)} L${f1(60 + .7 * k)},${f1(vy)} L${f1(60 + nh + 2.2 * k)},${f1(ny - .5 * k)} Z" fill="${ic}"/>
      <path d="M${f1(60 - nh)},${f1(ny - .4 * k)} Q60,${f1(ny + 10 * k)} ${f1(60 + nh)},${f1(ny - .4 * k)}" fill="${skin}"/>${clav(ny + 3.4 * k, nh - 2 * k, skin, k)}
      <path d="M${f1(60 - nh)},${f1(ny - .4 * k)} Q60,${f1(ny + 10 * k)} ${f1(60 + nh)},${f1(ny - .4 * k)}" fill="none" stroke="${shade(ic, .78)}" stroke-width="${sw(1.6)}"/>
      <path d="${band(-1)} ${band(1)}" fill="none" stroke="${shade(c, .74)}" stroke-width="${sw(2.4)}" stroke-linejoin="round"/>
      ${[0, 1, 2].map(i => `<circle cx="${f1(60 - .7 * k)}" cy="${f1(vy + 3 * k + i * (hemY - vy - 9 * k) / 2)}" r="${sw(1.4)}" fill="${shade(c, 1.4)}" stroke="${shade(c, .6)}" stroke-width="${sw(.4)}"/>`).join('')}${hemRib(hemW, hemY, k, dark)}`;
  } else if (top === 7) {   // 재킷: 노치드 라펠 + 안에 셔츠·넥타이(남) / 둥근 목 이너(여) + 단추 2개 + 주머니
    const ic = '#f4f1ea', vy = lerp(y.armpit, y.bust, A.f ? 1.08 : .95), tie = ['#7d2f3d', '#2c4a7a', '#3b3e48'][a.tie % 3];
    o += `<path d="M${f1(60 - nh - k)},${f1(ny - .5 * k)} L60,${f1(vy)} L${f1(60 + nh + k)},${f1(ny - .5 * k)} Z" fill="${A.f ? skin : ic}"/>`;
    if (A.f) o += `<path d="M${f1(60 - nh - k)},${f1(ny + 7 * k)} Q60,${f1(ny + 13 * k)} ${f1(60 + nh + k)},${f1(ny + 7 * k)} L60,${f1(vy)} Z" fill="${ic}"/>${clav(ny + 3.6 * k, nh - 2.5 * k, skin, k)}`;
    else o += `<path d="M${f1(60 - nh + .5 * k)},${f1(ny - k)} L${f1(60 - 1.2 * k)},${f1(ny + 5.5 * k)} L${f1(60 - nh - 2.4 * k)},${f1(ny + 4 * k)} Z M${f1(60 + nh - .5 * k)},${f1(ny - k)} L${f1(60 + 1.2 * k)},${f1(ny + 5.5 * k)} L${f1(60 + nh + 2.4 * k)},${f1(ny + 4 * k)} Z" fill="#fff" stroke="#c9c4b8" stroke-width="${sw(.5)}"/>` +
      `<path d="M${f1(60 - 2.4 * k)},${f1(ny + 3.6 * k)} L${f1(60 + 2.4 * k)},${f1(ny + 3.6 * k)} L${f1(60 + 1.6 * k)},${f1(ny + 7 * k)} L${f1(60 + 3.4 * k)},${f1(vy - 2 * k)} L60,${f1(vy + 2 * k)} L${f1(60 - 3.4 * k)},${f1(vy - 2 * k)} L${f1(60 - 1.6 * k)},${f1(ny + 7 * k)} Z" fill="${tie}"/>`;
    const lap = sd => { const X = v => f1(60 + sd * v); return `M${X(nh + k)},${f1(ny - .8 * k)} L${X(.4 * k)},${f1(vy)} L${X(nh + 7.6 * k)},${f1(lerp(ny, vy, .32))} L${X(nh + 8.4 * k)},${f1(ny + 5.6 * k)} L${X(nh + 5.4 * k)},${f1(ny + 5 * k)} L${X(nh + 6.4 * k)},${f1(ny + 1.2 * k)} Z`; };
    o += `<path d="${lap(-1)} ${lap(1)}" fill="${shade(c, 1.12)}" stroke="${shade(c, .6)}" stroke-width="${sw(.6)}" stroke-linejoin="round"/>
      <path d="M60,${f1(vy)} L60,${f1(hemY)}" stroke="${shade(c, .6)}" stroke-width="${sw(1)}"/>
      <circle cx="${f1(60 + 1.2 * k)}" cy="${f1(vy + 5 * k)}" r="${sw(1.5)}" fill="${shade(c, .62)}"/><circle cx="${f1(60 + 1.2 * k)}" cy="${f1(vy + 17 * k)}" r="${sw(1.5)}" fill="${shade(c, .62)}"/>
      <path d="M${f1(60 + w.rib * .42)},${f1(y.bust - 3 * k)} l${sw(8)},${sw(-.6)} M${f1(60 - straight * .62)},${f1(hemY - 9 * k)} l${sw(9)},0 M${f1(60 + straight * .62)},${f1(hemY - 9 * k)} l${sw(-9)},0" stroke="${shade(c, .6)}" stroke-width="${sw(1.1)}" stroke-linecap="round" opacity=".7"/>`;
  } else if (stripe) {   // 줄무늬 보트넥: 넓고 얕은 목선
    const nl = `M${f1(60 - nh - 7 * k)},${f1(ny - .8 * k)} Q60,${f1(ny + 9 * k)} ${f1(60 + nh + 7 * k)},${f1(ny - .8 * k)}`;
    o += `<g clip-path="url(#${tid}c)"><path d="${nl}" fill="${skin}"/>${clav(ny + 3.2 * k, nh + 3 * k, skin, k)}<path d="${nl}" fill="none" stroke="${shade(STRIPE_BASE, .82)}" stroke-width="${sw(1.8)}"/></g>`;
  } else {   // 니트: 라운드 넥 골지 + 짜임 물결 + 밑단 골지
    const rows = [lerp(y.armpit, y.bust, .5), lerp(y.bust, y.waist, .55)].map(yy => {
      const half = edgeAt(R, yy) - 2 * k; let d = `M${f1(60 - half)},${f1(yy)}`;
      for (let x = 60 - half, i = 0; x < 60 + half - 5 * k; x += 6 * k, i++) d += ` q${sw(3)},${sw(i % 2 ? 2.4 : -2.4)} ${sw(6)},0`;
      return d;
    }).join(' ');
    o += `<path d="M${f1(60 - nh - 3 * k)},${f1(ny - k)} Q60,${f1(ny + 9 * k)} ${f1(60 + nh + 3 * k)},${f1(ny - k)} L${f1(60 + nh + 3 * k)},${f1(ny + 4 * k)} Q60,${f1(ny + 14 * k)} ${f1(60 - nh - 3 * k)},${f1(ny + 4 * k)} Z" fill="${dark}"/>
      <path d="M${f1(60 - nh - k)},${f1(ny - k)} Q60,${f1(ny + 7 * k)} ${f1(60 + nh + k)},${f1(ny - k)}" fill="${skin}"/>
      <path d="${rows}" fill="none" stroke="${dark}" stroke-width="${sw(1)}" opacity="${sig ? .18 : .3}"/>${hemRib(hemW, hemY, k, dark)}`;
  }
  // 목걸이 (어른 여자, 목선이 트인 옷)
  if (X && X.chain && A.adult && A.f && [0, 1, 6, 7, 8].includes(top)) {
    const m = METAL[X.metal], cy0 = ny - .8 * k, d = top === 1 || top === 7 ? 10 : 7.5;
    o += `<path d="M${f1(60 - nh + .8 * k)},${f1(cy0)} Q60,${f1(cy0 + d * 2 * k)} ${f1(60 + nh - .8 * k)},${f1(cy0)}" fill="none" stroke="${m}" stroke-width="${sw(.55)}"/><circle cx="60" cy="${f1(cy0 + d * k + .6 * k)}" r="${sw(1.1)}" fill="${m}"/><circle cx="${f1(60 - .35 * k)}" cy="${f1(cy0 + d * k + .25 * k)}" r="${sw(.35)}" fill="#fff" opacity=".7"/>`;
  }
  // 주름·그림자: 겨드랑이, 옷깃 아래, 허리 옆(몸에 붙는 옷)
  const sf = `fill="none" stroke="${fold}" stroke-linecap="round"`, ax = w.armpit + e;
  o += `<path d="M${f1(60 - ax + .4)},${f1(y.armpit)} L${f1(60 - ax + 4.5 * k)},${f1(y.armpit + 3 * k)} L${f1(60 - ax + k)},${f1(y.armpit + 10 * k)} Z M${f1(60 + ax - .4)},${f1(y.armpit)} L${f1(60 + ax - 4.5 * k)},${f1(y.armpit + 3 * k)} L${f1(60 + ax - k)},${f1(y.armpit + 10 * k)} Z" fill="${fold}" opacity=".2"/>`;
  if (top !== 4 && top !== 5 && top !== 7) o += `<path d="M${f1(60 - nh - 4 * k)},${f1(ny + 4 * k)} Q60,${f1(ny + 19 * k)} ${f1(60 + nh + 4 * k)},${f1(ny + 4 * k)}" ${sf} stroke-width="${sw(2)}" opacity=".14"/>`;
  if (fitted && hemY > y.waist + 2) {
    const wx = straight + e;
    o += `<path d="${[-1, 1].map(s => `M${f1(60 + s * (wx - 2.5 * k))},${f1(y.waist - 7 * k)} L${f1(60 + s * (wx - 2 * k))},${f1(y.waist + k)} M${f1(60 + s * (wx - 5.5 * k))},${f1(y.waist - 5 * k)} L${f1(60 + s * (wx - 5 * k))},${f1(y.waist + 1.5 * k)}`).join(' ')}" ${sf} stroke-width="${sw(1.2)}" opacity=".2"/>`;
  }
  if (sig && A.ci >= 1) {   // 가슴 자리에만 입체 그림자 (컵이 클수록 짙게, 헐렁한 옷은 약하게, 몸에 붙는 옷은 가운데 골)
    const bx = bustW * .5, r = bustW * (.42 + A.ci * .022), op = Math.min(.42, .1 + A.ci * .05) * (fitted ? 1 : .6);
    o += `<g clip-path="url(#${tid}c)">${bustVolume(tid + 'b', bx, y.bust, r, shade(stripe ? '#8d8679' : c, .42), op, fitted && A.ci >= 3, k)}</g>`;
    if (fitted && A.ci >= 4) {   // 옷 장력 주름: 가슴에서 겨드랑이 쪽으로 (D 1개, E 이상 2개)
      let dd = '';
      for (let i = 0; i < (A.ci >= 5 ? 2 : 1); i++) for (const s of [-1, 1]) dd += `M${f1(60 + s * bustW * .62)},${f1(y.bust - 1 - i * 2.4 * k)} Q${f1(60 + s * bustW * .82)},${f1(y.bust - 3 - i * 2.4 * k)} ${f1(60 + s * (ax - 1.2))},${f1(y.armpit + 2.5 - i * 1.2 * k)} `;
      o += `<path d="${dd}" ${sf} stroke-width=".7" opacity=".3"/>`;
    }
  } else if (!A.f && A.adult && (A.fitM || A.C.shoulder >= 46)) o += `<path d="M${f1(60 - w.rib * .7)},${f1(y.bust + 1)} Q${f1(60 - w.rib * .35)},${f1(y.bust + 3)} 59,${f1(y.bust + 1.5)} M${f1(60 + w.rib * .7)},${f1(y.bust + 1)} Q${f1(60 + w.rib * .35)},${f1(y.bust + 3)} 61,${f1(y.bust + 1.5)}" ${sf} stroke-width=".9" opacity=".22"/>`;   // 가슴 근육선
  return { svg: o, color: c, fill: stripe ? fillC : null, gw: yy => edgeAt(R, yy), bustEdge: bustW + e };
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
    const sc = T.fill || (dim ? shade(c, .9) : c), sk = dim ? shade(skin, .94) : skin;
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

/* ---------- 함께 밤을 보내는 중·다음 날 아침 (어른만, 상반신): 맨 어깨 + 이불 ---------- */
const tierOf = v => v >= 90 ? 4 : v >= 70 ? 3 : v >= 50 ? 2 : v >= 30 ? 1 : 0;
// 맨몸 상반신 (전신 앵커, 전신 px 좌표): 팔(몸통 뒤) → 몸통 → 쇄골·겨드랑이 경계 → 가슴
//   여자: 가슴 자리(꼭짓점 ±bx, 반지름 r)에만 윤곽선 + 입체 그림자 / 남자: 가슴 근육
function bareTorso(a, A, skin, id) {
  const { y, w } = A, k = A.hs, { uw } = A.arm, female = a.g === 'f', sk = v => shade(skin, v), ny = y.neck;
  const ln = (d, c, wd, op) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f1(wd * k)}" stroke-linecap="round" opacity="${op}"/>`;
  const jx = w.sh - uw / 2, jy = y.sh + uw * .45, capR = uw / 2 + (A.adult && !female ? (A.fitM ? 2.5 : 1.2) : 0);
  let o = `<defs><linearGradient id="${id}sk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${sk(.82)}"/><stop offset=".2" stop-color="${skin}"/><stop offset=".8" stop-color="${skin}"/><stop offset="1" stop-color="${sk(.82)}"/></linearGradient></defs>`;
  for (const s of [-1, 1]) {   // 팔: 어깨 관절(둥근 삼각근)에서 거의 곧게 내려옴
    const pts = [[60 + s * jx, jy, capR * 2], [60 + s * (jx + .6), y.bust + 6 * k, uw], [60 + s * (jx + 1.4), y.waist, uw * .9]];
    o += `<path d="${taperD(pts, true)}" fill="${sk(.93)}"/>` + `<ellipse cx="${f1(60 + s * (jx + .4 * k))}" cy="${f1(jy - capR * .45)}" rx="${f1(capR * .55)}" ry="${f1(capR * .3)}" fill="#fff" opacity=".1"/>`;
  }
  const bw = female && A.adult ? w.bust : w.rib;
  const R = [[w.nh - .2 * k, ny - 6 * k], [w.nh + 1.4 * k, ny + 1.2 * k], [lerp(w.nh, w.sh, .6), lerp(ny, y.sh, .8)], [w.tip, y.sh + 1.2], [w.armpit, y.armpit], [bw, y.bust], [w.ub, y.underbust], [w.waist, y.waist]];
  const torsoD = symShape(R, y.waist + 2, ny - 6 * k);
  o += `<path d="${torsoD}" fill="url(#${id}sk)"/><clipPath id="${id}tc"><path d="${torsoD}"/></clipPath><g clip-path="url(#${id}tc)">`;
  // 겨드랑이 앞 경계 (팔과 가슴 사이), 쇄골(+윗면 빛, 어깨 쪽으로 살짝 내려감), 목 아래 오목한 곳 — 몸통 안에서만
  o += ln([-1, 1].map(s => `M${f1(60 + s * (w.tip - 1.2 * k))},${f1(y.sh + 4 * k)} Q${f1(60 + s * (w.armpit + .4 * k))},${f1(y.armpit - 4 * k)} ${f1(60 + s * (w.armpit - .8 * k))},${f1(y.armpit + 5 * k)}`).join(' '), sk(.7), 1.1, .42);
  const cl = lerp(w.nh, w.tip, .62), cy0 = ny + 4.4 * k;
  const clavD = [-1, 1].map(s => `M${f1(60 + s * 2.6 * k)},${f1(cy0 + .8 * k)} C${f1(60 + s * 6 * k)},${f1(cy0 + 2.2 * k)} ${f1(60 + s * cl * .6)},${f1(cy0 + .6 * k)} ${f1(60 + s * cl)},${f1(cy0 + 2.2 * k)}`).join(' ');
  o += ln(clavD, sk(.66), 1.2, .45) + `<g transform="translate(0,${f1(-1.3 * k)})">${ln(clavD, '#fff', .9, .16)}</g>`;
  o += ln(`M${f1(60 - 1.5 * k)},${f1(cy0 - .2 * k)} Q60,${f1(cy0 + 2.4 * k)} ${f1(60 + 1.5 * k)},${f1(cy0 - .2 * k)}`, sk(.6), 1.1, .5);
  if (female && A.adult) {
    // 가슴: 위쪽 바깥 둥근 선 + 안쪽에서 가슴골로 모이는 선 + 아래 윤곽 — 모두 가슴 자리 안에서만
    const bx = w.bust * .5, r = w.bust * (.42 + A.ci * .022), cy = y.bust, gap = Math.max(.5 * k, bx - r * .9);
    o += [-1, 1].map(s => {
      const X = v => f1(60 + s * v);
      return ln(`M${X(bx + r * .05)},${f1(cy - r * .98)} Q${X(bx + r * .78)},${f1(cy - r * .9)} ${X(bx + r * .98)},${f1(cy - r * .12)}`, sk(.72), 1, .24) +
        ln(`M${X(bx - r * .45)},${f1(cy - r * .86)} Q${X(gap + 1.4 * k)},${f1(cy - r * .45)} ${X(gap)},${f1(cy + r * .08)}`, sk(.64), 1.2, .42) +
        ln(`M${X(bx + r * .97)},${f1(cy + r * .1)} Q${X(bx + r * .62)},${f1(cy + r * 1.06)} ${X(Math.max(gap, bx - r * .45))},${f1(cy + r * .96)}`, sk(.6), 1.2, .45);
    }).join('');
    o += bustVolume(id + 'b', bx, cy, r, sk(.5), .34, true, k);
  } else if (A.adult) {
    // 가슴 근육 아랫선 + 아래 그림자 + 가운데 오목한 선
    const px = w.rib * .45, pr = w.rib * .5, py = y.bust - 2 * k;
    o += ln([-1, 1].map(s => `M${f1(60 + s * w.rib * .88)},${f1(y.armpit + 2 * k)} Q${f1(60 + s * w.rib * .5)},${f1(y.bust + 4.5 * k)} ${f1(60 + s * 1.2 * k)},${f1(y.bust + 1.6 * k)}`).join(' '), sk(.68), 1.3, .4);
    o += bustVolume(id + 'b', px, py, pr, sk(.55), A.fitM ? .26 : .18, false, k);
    o += ln(`M60,${f1(ny + 8 * k)} L60,${f1(y.bust + 2 * k)}`, sk(.66), 1.3, .18);
  }
  return o + '</g>';
}
// 함께 밤을 보내는 중·다음 날 아침 (상반신, 머리 좌표). A: 전신 앵커 — 몸은 전신 좌표로 그려 머리 좌표로 옮김
//   o: { by(이불 윗선 y), marks(0~4: 립스틱·손톱 자국 정도), lipstick, hickey, clutch(이불 움켜쥔 손) }
function bareBody(a, A, skin, o) {
  const id = `av${UID}`, hs = A.hs, hw = A.w.sh / hs - 3, L = f1(60 - hw), R = f1(60 + hw), nh = A.w.nh / hs, nl = 60 - nh, nr = 60 + nh, by = o.by;
  const ln = (d, c, w, op) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
  const sk = k => shade(skin, k), notch = (A.y.neck - A.hty) / hs + 5;
  let s = `<g transform="scale(${(1 / hs).toFixed(4)}) translate(${f1(-A.htx)},${f1(-A.hty)})">${bareTorso(a, A, skin, id)}</g>`;
  s += `<defs><linearGradient id="${id}q" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcbde6"/><stop offset=".5" stop-color="#b48bc6"/><stop offset="1" stop-color="#8c66a3"/></linearGradient></defs>`;
  s += ln(`M${f1(nl + 1.5)},101 Q${f1(nl + 3)},${f1(notch - 6)} 58.4,${f1(notch)} M${f1(nr - 1.5)},101 Q${f1(nr - 3)},${f1(notch - 6)} 61.6,${f1(notch)}`, sk(.72), 1, .22);   // 목 근육
  // 자국: 목·쇄골의 립스틱, 어깨의 손톱 자국
  const kiss = (x, y, r) => `<path d="M${x - 4},${y} q2,-2.5 4,0 q2,-2.5 4,0 q-2,3.5 -4,3.5 q-2,0 -4,-3.5 Z" fill="#c43c4f" opacity=".55" transform="rotate(${r} ${x} ${y})"/>`;
  if (o.lipstick && o.marks >= 3) s += kiss(66, 109, -10) + kiss(47, 126, 14) + (o.marks >= 4 ? kiss(+R - 14, 128, -18) : '');
  if (o.marks >= 4) s += ln(`M${f1(+L + 7)},130 q4,-2.2 9,-1.4 M${f1(+L + 8)},133.4 q4,-2 8,-1.2`, '#c86070', 1.2, .5);
  // 키스 자국(70+ 목 1~2, 90+ 목 3 + 어깨), 90+면 어깨에 옅은 이빨 자국
  const hickey = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="3.3" ry="2.5" fill="#9c3a55" opacity=".24"/><ellipse cx="${x}" cy="${y}" rx="2" ry="1.5" fill="#b0425f" opacity=".3"/>`;
  if (o.hickey && o.marks >= 3) s += [[54, 108], [66, 112], [57, 116], [f1(+R - 16), 126]].slice(0, o.marks >= 4 ? 4 : 2).map(([x, y]) => hickey(x, y)).join('');
  if (o.hickey && o.marks >= 4) s += [-1, 1].map(k => [0, 1, 2, 3, 4].map(i => `<ellipse cx="${f1(+L + 12 + i * 1.8)}" cy="${f1(128 + k * (2.2 - Math.abs(i - 2) * .45))}" rx=".7" ry=".5" fill="#c86a70" opacity=".45"/>`).join('')).join('');
  // 이불(밤과 같은 라벤더 이불): 살 위 그림자 → 이불 → 접힌 단 → 주름 → 윗선 하이라이트
  const top = `M0,${by + 5} C18,${by - 3} 38,${by + 3} 60,${by} C80,${by - 3} 102,${by + 4} 120,${by - 1}`;
  s += `<path d="${top} L120,${by - 4} C102,${by + 1} 80,${by - 6} 60,${by - 3} C38,${by} 18,${by - 6} 0,${by + 2} Z" fill="${sk(.55)}" opacity=".22"/>`;
  s += `<path d="${top} L120,160 L0,160 Z" fill="url(#${id}q)"/>`;
  s += `<path d="${top} L120,${by + 6} C102,${by + 11} 80,${by + 4} 60,${by + 7} C38,${by + 10} 18,${by + 4} 0,${by + 12} Z" fill="#ecdcf2" opacity=".45"/>`;
  s += `<path d="M0,${by + 10} C18,${by + 2} 38,${by + 8} 60,${by + 5} C80,${by + 2} 102,${by + 9} 120,${by + 4}" fill="none" stroke="#f3e6f8" stroke-width=".8" stroke-dasharray="2 2.4" opacity=".5"/>`;
  s += ln(`M20,${by + 14} C28,${by + 22} 24,${by + 32} 30,160 M86,${by + 12} C78,${by + 22} 84,${by + 30} 82,160 M52,${by + 13} C56,${by + 20} 52,${by + 28} 56,${by + 36}`, '#6e4d84', 2, .35);
  s += ln(`M22,${by + 14} C30,${by + 22} 26,${by + 32} 32,160 M88,${by + 12} C80,${by + 22} 86,${by + 30} 84,160`, '#f3e6f8', 1, .25);
  s += ln(top, '#f6ecfa', 1.4, .75);
  if (o.clutch) {
    // 이불 끝을 움켜쥔 두 손: 손등은 이불 위로, 손가락 네 개는 이불 끝을 넘어 아래로
    s += [47, 73].map(x => `<path d="M${x - 6.2},${by + .5} Q${x - 6},${by - 5} ${x},${by - 5.4} Q${x + 6},${by - 5} ${x + 6.2},${by + .5} Z" fill="${skin}"/>` +
      [-4.3, -1.45, 1.45, 4.3].map((d, k) => `<ellipse cx="${f1(x + d)}" cy="${f1(by + 1.8 - (k % 3 ? 0 : .7))}" rx="1.5" ry="2.9" fill="${skin}" stroke="${sk(.72)}" stroke-width=".6"/>`).join('') +
      ln(`M${x - 5},${by - 1.6} Q${x},${by - 3} ${x + 5},${by - 1.6}`, sk(.74), .7, .5)).join('');
  }
  return s;
}
// 흐트러진 머리: 뿌리는 굵고 끝은 가는 삐친 가닥들
function messyHair(hc, n) {
  const list = [[40, 40, 33, 36, 29, 45], [78, 36, 87, 30, 91, 40], [56, 31, 52, 21, 62, 18], [35, 58, 27, 58, 27, 67], [85, 56, 93, 58, 92, 66], [66, 30, 72, 22, 79, 24]];
  return list.slice(0, n).map(([bx, by, cx, cy, tx, ty]) => {
    const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy), px = -dy / l * 1.5, py = dx / l * 1.5;
    return `<path d="M${P(bx + px, by + py)} Q${P(cx + px * .5, cy + py * .5)} ${P(tx, ty)} Q${P(cx - px * .5, cy - py * .5)} ${P(bx - px, by - py)} Z" fill="${hc}"/>`;
  }).join('');
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
  const { skin, hc, hp, nh, neckBot, af, tier, du } = g, skinD = shade(skin, .86);
  // du(관계 중): { lv 0~3 (pleasure), mood: pleasure | bliss | content | bored | disappointed }
  const mood = du && (du.mood || 'pleasure'), lv = du ? du.lv || 0 : 0, pk = du && mood === 'pleasure' && lv >= 3 ? PEAK[du.personality] : null;
  const kid = age <= 12, adult = age >= 20, female = a.g === 'f', ey = 72, ex = [48, 72];
  // 턱 아래·목 옆 그림자
  let o = `<ellipse cx="60" cy="101.5" rx="${f1(nh - .5)}" ry="6" fill="${shade(skin, .6)}" opacity=".26"/>`;
  o += `<path d="M${f1(60 - nh + 1.6)},104 L${f1(60 - nh + 1.6)},${f1(neckBot - 2)} M${f1(60 + nh - 1.6)},104 L${f1(60 + nh - 1.6)},${f1(neckBot - 2)}" stroke="${shade(skin, .66)}" stroke-width="2" opacity=".14"/>`;
  if (a.buds && !af && !du) o += `<path d="M34,78 C30,96 40,112 47,130" fill="none" stroke="#f4f4f4" stroke-width="1.3"/>`;
  // 귀, 얼굴 (6살 이하는 둥근 얼굴). 얼굴은 가운데가 밝고 가장자리로 살짝 어두워짐
  o += earSVG(skin, -1) + earSVG(skin, 1);
  if (a.buds && !af && !du) o += `<circle cx="33" cy="76" r="2.6" fill="#f4f4f4"/>`;
  const faceD = FACES[age <= 6 ? 0 : a.face] || FACES[0], fid = `av${UID}f`;
  o += `<defs><radialGradient id="${fid}g" cx=".5" cy=".44" r=".62"><stop offset=".58" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, .91)}"/></radialGradient><clipPath id="${fid}c"><path d="${faceD}"/></clipPath></defs>`;
  o += `<path d="${faceD}" fill="url(#${fid}g)"/>`;
  // 앞머리·옆머리가 이마와 볼에 드리우는 그림자
  if (hp.shadow) o += `<g clip-path="url(#${fid}c)"><path d="${hp.shadow}" transform="translate(.7,2.6)" fill="${shade(skin, .5)}" opacity=".2"/></g>`;
  // 귀걸이 (어른만, 남자는 작은 큐빅). 옆머리가 있으면 그 뒤로
  if (adult && X.ear) o += earringSVG(female ? X.ear : 1, X.metal, -1) + earringSVG(female ? X.ear : 1, X.metal, 1);
  if (g.chin2) o += `<path d="M48,100.5 Q60,108.5 72,100.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.6" stroke-linecap="round" opacity=".4"/>`;   // 이중턱
  // 볼 홍조 (모두 옅게, 어린이·볼 빨간 사람은 더), 주근깨, 주름
  // 나를 향한 성욕 (st.libido: 이 사람이 지금 대하는 사람 = 나에게 느끼는 것, 어른 이성만). 대상마다 달라서 같은 사람도 누구를 대하느냐에 따라 표정이 다름
  //   30+ 나를 똑바로 봄·눈썹이 풀림 / 50+ 눈에 반짝임·다문 미소·홍조 선 / 70+ 나른하게 내리깐 눈·살짝 벌어진 입술 / 85+ 풀린 눈에 분홍 하트 반사광·더 붉음·땀 한 방울
  const lib = adult && !du && !af ? st.libido || 0 : 0, lt = lib >= 85 ? 4 : lib >= 70 ? 3 : lib >= 50 ? 2 : lib >= 30 ? 1 : 0;
  const blush = f1(Math.min(.95, [0, .08, .18, .3, .42][lt] + (pk && pk.blush ? pk.blush : du ? { pleasure: [.42, .56, .68, .8][lv], bliss: .62, content: .45, bored: .1, disappointed: .14 }[mood] + (du.personality === 'shy' ? .1 : 0)
    : af ? [.1, .1, .25, .42, .55][tier] + (af.personality === 'shy' && tier >= 2 ? .15 : 0) : kid ? .3 : a.blush ? .24 : .1)) * 100) / 100;
  o += `<ellipse cx="44" cy="84" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${blush}"/><ellipse cx="76" cy="84" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${blush}"/>`;
  if (st.aroused && adult) o += arousalFX(st.aroused);
  if (a.freckles) o += [[43, 80], [46, 82], [49, 80], [71, 80], [74, 82], [77, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="${shade(skin, .62)}"/>`).join('');
  if (X.mole >= 0 && age >= 10) { const [mx, my] = MOLES[X.mole]; o += `<circle cx="${mx}" cy="${my}" r=".8" fill="${shade(skin, .42)}" opacity=".85"/>`; }
  // 나이: 40 팔자 주름(점점 짙게), 45 눈 밑, 50 눈가 잔주름, 55 이마 주름, 65 턱선 처짐
  const wl = (d, op, w = 1) => `<path d="${d}" fill="none" stroke="${shade(skin, .72)}" stroke-width="${w}" stroke-linecap="round" opacity="${f1(op * 100) / 100}"/>`;
  if (age >= 40) o += wl('M54.2,82.4 Q51.4,86 52.6,90.4 M65.8,82.4 Q68.6,86 67.4,90.4', clamp((age - 36) / 40, .12, .5));
  if (age >= 45) o += `<path d="M41,77 Q44,79 47,78 M73,78 Q76,79 79,77" fill="none" stroke="${shade(skin, .75)}" stroke-width="1"/>`;
  if (age >= 50) o += wl('M39.6,70.4 l-2.8,-1.3 M39.8,72.6 l-3.1,.2 M39.6,74.6 l-2.6,1.4 M80.4,70.4 l2.8,-1.3 M80.2,72.6 l3.1,.2 M80.4,74.6 l2.6,1.4', .4, .8);
  if (age >= 55) o += wl('M47,51.6 Q60,49.6 73,51.6 M49.5,55.4 Q60,53.8 70.5,55.4', .3);
  if (age >= 65) o += wl('M39.4,90 Q41.6,95.2 45.6,97.6 M80.6,90 Q78.4,95.2 74.4,97.6', .32);
  // 눈: 흰자 + 홍채 + 하이라이트 + 속눈썹 (어린이는 조금 크게) / 다음 날 아침엔 감은 눈 / 흥분 시 반쯤 감김
  const nLash = female ? (age >= 18 ? 3 : 2) : kid ? 1 : 0;
  const aro = adult && st.aroused || 0;
  o += ex.map((x, i) => {
    const s = i ? 1 : -1;
    if (du) {
      if (pk) return { open: () => openEye(a, X, x, ey, s, nLash), squeeze: () => SQUEEZE(x, ey, s), wink: () => i ? openEye(a, X, x, ey, s, nLash) : HAPPY(x, ey),
        calm: () => halfEye(a, X, x, ey, s, nLash, 0, .6, -2.6), happy: () => HAPPY(x, ey), sharp: () => halfEye(a, X, x, ey, s, nLash, .4, -.2, -4.2) }[pk.eye]();
      if (mood === 'bliss' || (mood === 'pleasure' && lv === 1)) return HAPPY(x, ey);   // 행복하게 감은 눈
      if (mood === 'content') return SLEEPY(x, ey, s, nLash);
      if (mood === 'bored') return halfEye(a, X, x, ey, s, nLash, 2.6, .9, -2.2);
      if (mood === 'disappointed') return halfEye(a, X, x, ey, s, nLash, -1.4, 2, -1.8);
      if (lv >= 2) return loveEye(a, X, x, ey, s, nLash, lv >= 3 ? -4 : -2.4, lv >= 3);   // 풀린 눈 → 하트 눈
      return halfEye(a, X, x, ey, s, nLash, -.6, .6, -3.2);
    }
    if (af && tier >= 3 && af.personality === 'playful' && i === 1) return HAPPY(x, ey);
    if (af && tier === 4) return HAPPY(x, ey);
    if (af && tier === 3) return SLEEPY(x, ey, s, nLash);
    if (aro >= 86) return SLEEPY(x, ey, s, nLash);
    if (aro >= 71) return halfEye(a, X, x, ey, s, nLash, -2.5, 1.5, 1.2);
    if (lt >= 4) return loveEye(a, X, x, ey, s, nLash, -3, false);
    if (lt >= 3) return halfEye(a, X, x, ey, s, nLash, 0, .4, -3.3);
    const e = openEye(a, lt ? Object.assign({}, X, { gaze: 0 }) : X, x, ey, s, nLash, { aegyo: X.aegyo && age >= 13, skinLn: shade(skin, .74), wing: female && adult && X.liner });
    return kid ? `<g transform="translate(${x},${ey}) scale(1.1) translate(${-x},${-ey})">${e}</g>` : e;
  }).join('');
  if (lt === 2 || lt === 3) o += ex.map(x => `<circle cx="${x + 2.2}" cy="${ey - 1.2}" r=".9" fill="#fff" opacity=".85"/><circle cx="${x - 1.4}" cy="${ey + 1.6}" r=".5" fill="#fff" opacity=".7"/>`).join('');
  // 눈썹 (다음 날 아침 만족감이 낮으면 처짐)
  const expr = st.expr || (pk && 'brow' in pk ? pk.brow : du ? (mood === 'disappointed' ? 'sad' : (mood === 'pleasure' && lv >= 1) || mood === 'bliss' ? 'soft' : null) : af && tier <= 1 ? 'sad' : lt === 1 || lt === 2 ? 'soft' : null);
  const btype = (af && tier >= 3) || mood === 'bliss' || mood === 'content' ? 1 : mood === 'bored' ? 0 : a.brows;
  const bw = (a.thick ? 3.8 : a.g === 'm' ? 3.1 : 2.5) * (kid ? .9 : 1);
  o += `<path d="${ex.map((x, i) => browFill(btype, x, ey - 10, i ? 1 : -1, expr, bw)).join(' ')}" fill="${shade(hc, .72)}"/>`;
  // 코 (5종) + 코 아래 그림자
  o += noseSVG(X.nose, skin, kid);
  // 입 (어른 여자는 립 색, 여자아이는 연분홍, 남자는 자연스러운 입술색). 입술 두께, 어른 여자는 아랫입술 윤기
  const lip = { c: female && age >= 18 ? LIPS[X.lip] : female ? '#e39aa0' : NATURAL_LIP[a.skin] || NATURAL_LIP[1], teeth: X.teeth, f: X.lipF, gloss: female && adult };
  o += pk ? { joy2: JOY(2, lip, female), joy1: JOY(1, lip, female), o: mouthSVG(3, lip, female), tongue: JOY(1, lip, female) + TONGUE, smile: mouthSVG(1, lip, female), smirk: SMIRK(lip), tremble: TREMBLE(lip, female) }[pk.mouth]
    : du ? ({ bliss: JOY(0, lip, female), content: mouthSVG(1, lip, female), bored: mouthSVG(2, lip, female), disappointed: POUT(lip) }[mood] || (lv ? JOY(lv - 1, lip, female) : mouthSVG(1, lip, female)))
    : af ? (tier === 0 ? FROWN : tier === 1 ? mouthSVG(2, lip, female) : tier >= 3 && af.personality !== 'cool' ? mouthSVG(1, lip, female) : mouthSVG(0, lip, female))
    : aro >= 71 ? mouthSVG(1, lip, female) : aro >= 51 ? mouthSVG(3, lip, female)
    : lt >= 3 ? PARTED(lt - 3, lip, female) : lt === 2 && a.mouth !== 1 ? mouthSVG(4, lip, female) : mouthSVG(a.mouth, lip, female);
  if (!female && adult) o += beardSVG(X.beard, hc, `${fid}c`);
  // 립스틱 자국은 bareBody에서 목·쇄골에 표시
  if (af && tier >= 4 && female) {
    o += `<path d="M42,74 Q38,78 36,82" fill="none" stroke="#555" stroke-width="1.2" opacity=".25" stroke-linecap="round"/>`;
    o += `<path d="M78,74 Q82,78 84,82" fill="none" stroke="#555" stroke-width="1.2" opacity=".25" stroke-linecap="round"/>`;
  }
  if (a.dimples) o += `<path d="M50,87 q-1.5,2 0,3.5 M70,87 q1.5,2 0,3.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.1" stroke-linecap="round"/>`;
  if (lt >= 2) o += `<g opacity="${lt >= 3 ? .8 : .45}">${BLUSH_LINES}</g>`;
  // 앞머리·옆머리
  // 이불을 덮었으면 앞머리·옆머리 끝은 이불 속으로
  o += g.cut ? `<clipPath id="av${UID}cut"><rect width="120" height="${g.cut}"/></clipPath><g clip-path="url(#av${UID}cut)">${hp.front}</g>` : hp.front;
  if (af && tier >= 2) o += messyHair(hc, [0, 0, 1, 3, 5][tier]);
  if (lt >= 4) o += SWEAT(83, 52, .7);
  if (af) o += [[82, 52], [37, 57], [70, 118]].slice(0, Math.min(3, Math.floor((af.sat ?? 50) / 30))).map(([x, y]) => SWEAT(x, y, .85)).join('');
  if (af && female && tier >= 3) o += `<path d="M64.5,88.6 q3.6,1.2 6.8,-.6${tier >= 4 ? ' M55.4,89.4 q-3.4,1.8 -6.4,.8 M61,92.6 q2,2.6 1,4.8' : ''}" fill="none" stroke="${lip.c}" stroke-width="${tier >= 4 ? 2.2 : 1.8}" stroke-linecap="round" opacity="${tier >= 4 ? .45 : .32}"/>`;   // 립스틱 번짐
  if (du) {
    o += messyHair(hc, { pleasure: lv + 1, bliss: 5, content: 3, bored: 0, disappointed: 1 }[mood]);
    if ((mood === 'pleasure' && lv >= 1) || mood === 'bliss') o += BLUSH_LINES;
    if (mood === 'pleasure' && lv >= 2) o += [[80, 50], [38, 54]].slice(0, lv - 1).map(([x, y]) => SWEAT(x, y)).join('');
    if ((mood === 'pleasure' && lv >= 2) || mood === 'bliss') o += MINI_HEARTS;
    if (pk && pk.tears) o += TEARS(pk.tears);
    if (pk && pk.flush) o += '<ellipse cx="60" cy="81" rx="21" ry="6" fill="#e8857a" opacity=".38"/>';
    if (mood === 'bliss') o += SPARKLE(30, 40, 1.1) + SPARKLE(92, 64, .8);
    if (mood === 'disappointed') o += SWEAT(88, 44, 1.7);
  }
  // 안경
  o += glassesSVG(a.glasses, X.glc);
  return o;
}
const hairColor = (a, age) => {
  const old = age >= 40 && a.gray < (age - 38) / 22;   // 40대부터 흰머리 확률 증가
  return HAIR[old ? GRAY : age <= 18 && a.hc >= 4 ? (a.hc % 2 ? 2 : 1) : a.hc] || HAIR[0];   // 어린이·10대는 염색 안 함 (갈색 / 밝은 갈색)
};
const topOf = (a, age) => age >= 13 && age <= 18 ? 4 : age <= 12 ? ({ 1: 0, 3: 2, 7: 2 }[a.top] ?? a.top) : a.top;   // 10대는 교복, 어린이는 셔츠·니트·재킷 대신 티·후디
// 옷 입은 전신: 0 0 120 280, 바닥선 272. 머리는 머리 좌표 그대로 그려서 나이별 머리 높이에 맞게 줄임
function renderFull(a, size, st) {
  UID++;
  const X = extras(a), age = st.age ?? 25, skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86), hc = hairColor(a, age), top = topOf(a, age);
  const A = anchorsOf(a, age, typeof st.full === 'object' ? st.full : null), { y, w } = A, hs = A.hs;
  const toHead = v => (v - A.hty) / hs, HG = s => `<g transform="translate(${f1(A.htx)},${f1(A.hty)}) scale(${hs.toFixed(4)})">${s}</g>`;
  const hp = hairPieces(a, X, age, hc, { sy: toHead(y.sh), chest: toHead(y.bust) });
  const bt = bottomOf(a, X, age, A), pose = age <= 12 ? 'default' : st.pose || POSE[st.personality] || 'default';
  const low = lowerFull(a, X, age, A, skinD, bt), T = topFull(a, top, A, skinD, bt, X), AR = armsFull(A, top, pose, skinD, T, low.hipEdge);
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
  // 상반신 (0 0 120 160): 머리·어깨·가슴 위. 몸은 전신과 같은 앵커(어깨 폭·가슴 높이·팔)를 머리 좌표로 옮겨 그림
  UID++;
  const X = extras(a);
  const af = adult && st.after ? st.after : null, du = adult && !af && st.during ? st.during : null, tier = af ? tierOf(af.sat ?? 50) : -1;
  const skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86), hc = hairColor(a, age), top = topOf(a, age);
  const fig = adult ? (af || du || st).fig : null;
  const A = anchorsOf(a, age, fig && typeof fig === 'object' ? fig : null), hs = A.hs, toHead = v => (v - A.hty) / hs;
  const BG = s => `<g transform="scale(${(1 / hs).toFixed(4)}) translate(${f1(-A.htx)},${f1(-A.hty)})">${s}</g>`;
  const hp = hairPieces(a, X, age, hc, { sy: toHead(A.y.sh), chest: toHead(A.y.bust) });
  const nh = A.w.nh / hs, neckBot = toHead(A.y.neck + 4 * hs);
  const neck = c => `<path d="M${f1(60 - nh)},94 L${f1(60 + nh)},94 L${f1(60 + nh)},${f1(neckBot)} L${f1(60 - nh)},${f1(neckBot)} Z" fill="${c}"/>`;
  let o = `<svg class="av" width="${w}" height="${h}" viewBox="0 0 120 160" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="159" rx="10"/>`;
  o += hp.back;
  let cut = 0;
  if (af || du) {
    // 이불 높이: 여자는 가슴 꼭짓점보다 늘 3 이상 위 (가슴골까지만). 아침엔 만족감이 높을수록 조금 내려가고, 소심형은 끌어올려 움켜쥠
    const shy = (af || du).personality === 'shy', apex = toHead(A.y.bust);
    const by = Math.round(a.g === 'f' ? apex - (af ? [7, 6, 5, 4, 3][tier] : 4) - (shy ? 2 : 0) : apex + (af ? [-4, -3, -2, -1, 0][tier] : -1) - (shy ? 2 : 0));
    cut = by + 2;
    o += neck(skin) + bareBody(a, A, skin, { by, marks: af ? tier : 0, lipstick: af && af.lipstick, hickey: af && af.hickey, clutch: shy });
  } else {
    const bt = bottomOf(a, X, age, A), T = topFull(a, top, A, skinD, bt, X), AR = armsFull(A, top, 'default', skinD, T, A.w.hip + 2);
    o += BG(AR.back) + neck(skinD) + BG(T.svg + AR.front);
  }
  o += headSVG(a, X, age, st, { skin, hc, hp, nh, neckBot, af, tier, du, cut, chin2: A.chubbyM });
  return o + '</svg>';
}

const topColor = a => TOP_COLORS[(a && a.tc) || 0];
// anchors: 전신 앵커(px)를 그대로 꺼내 봄 (test.html 비교용)
window.Avatar = { make, render, topColor, anchors: (a, age, fig) => anchorsOf(a, age, fig) };
window.renderAvatar = render;
})();
