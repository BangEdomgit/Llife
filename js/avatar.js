// NPC 상반신 아바타 — 파츠(얼굴·머리·눈·입·옷…)를 조합해 SVG 문자열로 그림. 외부 이미지 없음
// Avatar.make(seed, gender, opt)    → appearance (파츠 번호 묶음). 같은 seed면 늘 같은 얼굴
// Avatar.render(appearance, size, state) → SVG 문자열 (가로 size, 세로 size×4/3, 전신이면 size×7/3)
//   state: 나이(숫자) 또는 { age, after: { sat, personality, lipstick }, full: true | { height, waist, hip } }
//   full: 옷 입은 전신 (viewBox 0 0 120 280) — 허리·골반·다리 길이가 수치에 따라 달라짐
//   나이는 그릴 때 반영: 어린이는 머리 스타일이 단순해지고, 10대는 교복, 40대부터 흰머리가 늘어남
//   체형(appearance.body)은 20살부터 옷 위 실루엣으로 드러남 (어깨 너비, 체격, 가슴선)
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

/* ---------- 팔레트 ---------- */
// 피부 4톤: 밝은, 보통, 어두운, 진한
const SKIN = ['#f7dcc5', '#e9bf98', '#c68b60', '#8b5a3c'];
// 머리색: 검정, 갈색, 밝은 갈색, 회색(나이 들면), 염색(와인), 염색(애쉬 금발)
const HAIR = ['#23201f', '#4b3022', '#7d5536', '#a19d98', '#7e3343', '#c9a66c'];
const GRAY = 3;
const TOP_COLORS = ['#4f6d8f', '#9a4f5f', '#5f8f6a', '#d0a443', '#ece7dd', '#3b3e48', '#8a6fb0', '#d9784a', '#6aa3c8', '#7a8a5a'];
const UNIFORM = { blazer: '#2f3a5a', shirt: '#f3f1ec', tie: ['#9b2f3a', '#2c4a7a', '#3d6b4a'] };
const LINE = '#33241f';

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

/* ---------- 파츠 ---------- */
const FACES = [
  'M33,68 C33,46 45,38 60,38 C75,38 87,46 87,68 C87,88 76,101 60,101 C44,101 33,88 33,68 Z',                       // 둥근형
  'M34,63 C34,45 46,38 60,38 C74,38 86,45 86,63 L86,80 C86,92 76,100 60,100 C44,100 34,92 34,80 Z',                  // 각진형
  'M35,66 C35,46 46,38 60,38 C74,38 85,46 85,66 C85,82 74,97 60,103 C46,97 35,82 35,66 Z',                            // 갸름형
];
// 머리 — back: 얼굴 뒤, front: 이마 위. 남 6종 / 여 6종
const CAP = 'M31,68 C28,42 42,30 60,30 C78,30 92,42 89,68 L86,68 C85,56 82,50 76,47 C66,51 52,51 44,47 C38,50 35,56 34,68 Z';
const HAIRS = {
  m: [
    { front: CAP },                                                                                                        // 짧은
    { front: 'M33,62 C33,44 45,35 60,35 C75,35 87,44 87,62 C85,52 77,45 60,45 C43,45 35,52 33,62 Z', thin: true },        // 반삭
    { front: 'M35,55 C33,37 47,27 62,28 C78,29 90,39 86,55 C80,47 70,45 58,47 C48,49 40,49 35,55 Z', sides: true },      // 투블럭
    { front: 'M30,70 C27,40 43,29 60,29 C77,29 93,40 90,70 C88,63 86,59 84,58 C77,61 68,59 60,57 C51,60 41,61 36,58 C33,61 31,65 30,70 Z' },  // 덮은
    { back: 'M28,70 C26,40 42,28 60,28 C78,28 94,40 92,70 L93,112 C86,116 80,114 78,108 L42,108 C40,114 34,116 27,112 Z',
      front: 'M31,66 C29,40 44,30 60,30 C76,30 91,40 89,66 C86,56 76,48 64,47 C58,52 46,54 38,52 C35,56 33,60 31,66 Z' },  // 장발
    { front: CAP, bun: [60, 27, 7] },                                                                                      // 묶은
  ],
  f: [
    { back: 'M27,70 C25,40 42,27 60,27 C78,27 95,40 93,70 L94,100 C88,103 83,101 82,97 L38,97 C37,101 32,103 26,100 Z',
      front: 'M31,64 C29,40 44,30 60,30 C76,30 91,40 89,64 C85,55 78,53 60,54 C42,53 35,55 31,64 Z' },                    // 단발
    { back: 'M27,70 C25,40 42,27 60,27 C78,27 95,40 93,70 L96,122 C88,127 82,124 81,118 L39,118 C38,124 32,127 24,122 Z',
      front: 'M31,66 C29,40 44,30 60,30 C76,30 91,40 89,66 C86,56 78,49 66,48 C60,54 47,56 39,53 C35,57 33,61 31,66 Z' },  // 어깨
    { back: 'M27,70 C24,40 42,26 60,26 C78,26 96,40 93,70 L98,146 C90,151 84,148 82,142 L38,142 C36,148 30,151 22,146 Z',
      front: 'M31,66 C29,40 44,30 60,30 C76,30 91,40 89,66 C87,57 82,52 74,50 C68,52 64,48 60,44 C56,48 52,52 46,50 C38,52 33,57 31,66 Z' },  // 긴 머리
    { front: 'M31,66 C29,40 44,30 60,30 C76,30 91,40 89,66 C86,56 79,50 68,48 C60,52 47,53 39,51 C35,55 33,60 31,66 Z',
      tail: 'M86,74 C94,86 95,104 89,124 C87,130 82,131 81,126 C85,110 85,94 80,80 Z' },                                   // 묶은 (옆으로 내린)
    { front: 'M31,66 C29,40 44,30 60,30 C76,30 91,40 89,66 C86,55 78,50 60,50 C42,50 35,55 31,66 Z',
      tail: 'M78,36 C96,36 104,58 100,86 C98,96 92,98 92,90 C95,70 92,52 80,46 Z', band: [82, 40] },                       // 포니테일
    { back: 'M27,70 C25,40 42,27 60,27 C78,27 95,40 93,70 L96,128 C88,132 82,129 81,123 L39,123 C38,129 32,132 24,128 Z',
      front: 'M31,66 C29,40 44,30 60,30 C76,30 91,40 89,66 C86,56 79,50 68,48 C60,52 47,53 39,51 C35,55 33,60 31,66 Z', bun: [60, 29, 6] },  // 반묶음
  ],
};
// 어린이는 머리 스타일이 단순해짐 (남: 짧은·덮은 / 여: 단발·포니테일·묶은). 교복 입는 10대 남자는 장발·묶은 머리 없음
const KID_HAIR = { m: [0, 3, 0, 3, 3, 0], f: [0, 4, 0, 3, 4, 0] };
const TEEN_HAIR = { m: [0, 1, 2, 3, 3, 0], f: [0, 1, 2, 3, 4, 5] };

// side: 왼눈 -1, 오른눈 1 (눈꼬리 = 바깥쪽)
const almond = (x, y, side, oy, iy) => `<path d="M${x - 5.2 * side},${y + iy} Q${x},${y - 8.5} ${x + 5.2 * side},${y + oy} Q${x},${y + 6} ${x - 5.2 * side},${y + iy} Z" fill="${LINE}"/><circle cx="${x + .9}" cy="${y - 1.3}" r="1" fill="#fff"/>`;
const EYES = [
  (x, y) => `<circle cx="${x}" cy="${y}" r="3.3" fill="${LINE}"/><circle cx="${x + 1.1}" cy="${y - 1.1}" r="1" fill="#fff"/>`,                    // 동그란
  (x, y, side) => almond(x, y, side, -2.2, .6),                                                                                                     // 날카로운 (눈꼬리 올라감)
  (x, y, side) => almond(x, y, side, 2, -.4),                                                                                                       // 처진 (눈꼬리 내려감)
  (x, y) => `<path d="M${x - 4.5},${y + .5} Q${x},${y - 2.5} ${x + 4.5},${y + .5}" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`, // 가는
];
const BROWS = [
  (x, y) => `M${x - 6},${y} L${x + 6},${y}`,                                  // 일자
  (x, y) => `M${x - 6},${y + 1} Q${x},${y - 3} ${x + 6},${y + 1}`,            // 아치
  (x, y, s) => `M${x - 6 * s},${y + 2} L${x + 6 * s},${y - 2}`,                 // 올라간
];
const MOUTHS = [
  `<path d="M54,88 Q60,91 66,88" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`,                                      // 보통
  `<path d="M52,86 Q60,95 68,86 Q60,89 52,86 Z" fill="#8c3b3b" stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round"/>`,                 // 웃는
  `<path d="M55,89 L65,89" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`,                                                           // 무표정
  `<path d="M55,87 Q60,86 65,87 Q64,93 60,93 Q56,93 55,87 Z" fill="#7a2f33" stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round"/>`,    // 약간 벌린
];

/* ---------- 몸·옷 ---------- */
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
// 전신 몸통: 어깨 → 겨드랑이 → 허리(ww) → 골반(hp)까지. 옷 밑단은 y=204
function torso(kid, hw, ww, hp) {
  const sh = kid ? 4 : 0;
  return `M${60 - hw},142 C${60 - hw},${133 + sh} ${77 - hw},${119 + sh} 49,${115 + sh} L71,${115 + sh} C${43 + hw},${119 + sh} ${60 + hw},${133 + sh} ${60 + hw},142
    L${69 + hw - 18},152 Q${60 + ww + 2},170 ${60 + ww},184 Q${60 + hp},194 ${60 + hp - 1},204 L${61 - hp},204 Q${60 - hp},194 ${60 - ww},184 Q${58 - ww},170 ${51 - hw + 18},152 Z`;
}
function clothes(a, top, kid, skin, hw, adult, fb) {
  const sh = kid ? 4 : 0;   // 어린이는 어깨선이 조금 아래
  const body_ = () => fb ? torso(kid, hw, fb.ww, fb.hp) : body(kid, hw);
  if (top === 4) {   // 교복 — 블레이저 + 셔츠 + 넥타이(남) / 리본(여)
    const tie = UNIFORM.tie[a.tie];
    return `<path d="${body_()}" fill="${UNIFORM.blazer}"/>
      <path d="M50,${115 + sh} L60,${142 + sh} L70,${115 + sh} Z" fill="${UNIFORM.shirt}"/>
      <path d="M50,${115 + sh} L56,${131 + sh} L47,${129 + sh} L42,${118 + sh} Z M70,${115 + sh} L64,${131 + sh} L73,${129 + sh} L78,${118 + sh} Z" fill="${shade(UNIFORM.blazer, 1.25)}"/>
      ${a.g === 'm'
        ? `<path d="M57,${119 + sh} L63,${119 + sh} L62,${123 + sh} L64,${140 + sh} L60,${145 + sh} L56,${140 + sh} L58,${123 + sh} Z" fill="${tie}"/>`
        : `<path d="M60,${123 + sh} L51,${118 + sh} L51,${128 + sh} Z M60,${123 + sh} L69,${118 + sh} L69,${128 + sh} Z" fill="${tie}"/><circle cx="60" cy="${123 + sh}" r="2.4" fill="${shade(tie, .8)}"/>`}`;
  }
  const c = TOP_COLORS[a.tc], dark = shade(c, .78);
  let out = `<path d="${body_()}" fill="${c}"/>`;
  if (top === 0) out += `<path d="M49,${115 + sh} Q60,${126 + sh} 71,${115 + sh}" fill="${skin}" stroke="${dark}" stroke-width="3"/>`;   // 티셔츠
  else if (top === 1) out += `<path d="M52,${115 + sh} L60,${128 + sh} L68,${115 + sh} Z" fill="${skin}"/>
      <path d="M50,${114 + sh} L60,${128 + sh} L52,${132 + sh} L45,${119 + sh} Z M70,${114 + sh} L60,${128 + sh} L68,${132 + sh} L75,${119 + sh} Z" fill="${shade(c, 1.35)}" stroke="${dark}" stroke-width="1"/>
      <path d="M60,${130 + sh} L60,${fb ? 204 : 160}" stroke="${dark}" stroke-width="1.2"/><circle cx="60" cy="${140 + sh}" r="1.3" fill="${dark}"/><circle cx="60" cy="${151 + sh}" r="1.3" fill="${dark}"/>${fb ? `<circle cx="60" cy="166" r="1.3" fill="${dark}"/><circle cx="60" cy="182" r="1.3" fill="${dark}"/>` : ''}`;   // 셔츠
  else if (top === 2) out += `<path d="M38,${121 + sh} C40,${108 + sh} 80,${108 + sh} 82,${121 + sh} C72,${130 + sh} 48,${130 + sh} 38,${121 + sh} Z" fill="${dark}"/>
      <path d="M49,${115 + sh} Q60,${124 + sh} 71,${115 + sh}" fill="${skin}"/>
      <path d="M55,${124 + sh} L54,${140 + sh} M65,${124 + sh} L66,${140 + sh}" stroke="${shade(c, 1.5)}" stroke-width="1.6" stroke-linecap="round"/>`;   // 후디
  else out += `<path d="M48,${114 + sh} Q60,${122 + sh} 72,${114 + sh} L72,${119 + sh} Q60,${128 + sh} 48,${119 + sh} Z" fill="${dark}"/>
      <path d="M50,${114 + sh} Q60,${120 + sh} 70,${114 + sh}" fill="${skin}"/>
      ${fb ? `<path d="${Array.from({ length: 7 }, (_, i) => { const x = 60 - fb.hp + 4 + i * (fb.hp * 2 - 8) / 6; return `M${x.toFixed(1)},197 L${x.toFixed(1)},204`; }).join(' ')}" stroke="${dark}" stroke-width="1.4"/>`
        : `<path d="M30,154 L30,160 M38,154 L38,160 M46,154 L46,160 M54,154 L54,160 M62,154 L62,160 M70,154 L70,160 M78,154 L78,160 M86,154 L86,160" stroke="${dark}" stroke-width="1.4"/>`}`;   // 니트
  if (adult) out += shapeLines(a, top, c);
  return out;
}

/* ---------- 전신 (초상화를 누르면) ---------- */
// fig: 게임이 넘겨주는 수치 { height, waist, hip } (없으면 체형 구간으로). 어린이·10대는 체형 곡선 없이 평균 몸
function fullFrame(a, age, fig) {
  const kid = age <= 12, teen = age >= 13 && age <= 19, b = a.body || {}, f = a.g === 'f';
  const s = kid ? 1 : .8;   // 전신에선 어깨를 조금 좁혀 화면 안에 들어오게
  let hw = Math.round(halfWidth(a, kid, !kid && !teen) * s), ww, hp;
  if (kid) { hw = 30; ww = 24; hp = 25; }
  else if (teen || !fig) { ww = f ? 20 : hw - 10; hp = f ? 27 : ww + 2; }
  else {
    ww = f ? 15 + (fig.waist - 56) * .35 : hw - 10 + (fig.waist - 76) * .3;
    hp = f ? 22 + (fig.hip - 80) * .45 : ww + 2;
  }
  const hcm = fig && fig.height ? fig.height : (f ? 162 : 173) + ({ short: -8, tall: 8 }[b.height] || 0);
  const leg = kid ? 30 : teen ? 40 : Math.round(clamp(40 + (hcm - (f ? 160 : 170)) * .8, 26, 64));
  const thigh = { slim: 8, avg: 9.5, fit: 10.5, chubby: 12.5 }[!kid && !teen ? b.build : 'avg'] || 9.5;
  return { hw, ww: Math.round(ww), hp: Math.round(hp), leg, thigh, ankle: 222 + leg, dy: 274 - (222 + leg + 6) };   // 발이 늘 바닥에 닿게 (작으면 머리 위가 비고, 크면 꽉 참)
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// 하의: 어린이 반바지·치마 / 10대 교복 / 어른은 청바지·슬랙스·치마 (seed로 고정)
function bottoms(a, age, fb, skin) {
  const kid = age <= 12, teen = age >= 13 && age <= 18, f = a.g === 'f', { ww, hp, ankle, thigh } = fb;
  const skirt = f && (teen || (a.tc + a.top) % 3 !== 0);
  const color = teen ? (f ? '#3b4766' : UNIFORM.blazer) : kid ? ['#4a5f86', '#c25a6b', '#5f8f6a'][a.tc % 3] : skirt ? ['#2e2e36', '#8a6f5a', '#5b4a78', '#7d2f3d'][a.tc % 4] : ['#4a5f86', '#3b3e48', '#a08a63'][a.tc % 3];
  const lx = Math.max(7, hp * .42), shoe = '#2b2724';
  // 맨다리: 허벅지(체격)에서 발목으로 좁아짐
  const legs = y0 => [-1, 1].map(d => { const x = 60 + d * lx, t = thigh / 2, k = y0 + (ankle - y0) * .55;
    return `<path d="M${x - t},${y0} L${x + t},${y0} Q${x + t * .8},${k} ${x + 2.4},${ankle} L${x - 2.4},${ankle} Q${x - t * .8},${k} ${x - t},${y0} Z" fill="${skin}"/>`; }).join('');
  const shoes = `<ellipse cx="${60 - lx}" cy="${ankle + 3}" rx="7" ry="3.6" fill="${shoe}"/><ellipse cx="${60 + lx}" cy="${ankle + 3}" rx="7" ry="3.6" fill="${shoe}"/>`;
  if (skirt || (kid && f)) {
    const hem = kid ? 226 : teen ? 236 : 238 + (a.tie % 2) * 10;
    return legs(214) + `<path d="M${60 - ww},188 L${60 + ww},188 Q${60 + hp + 2},200 ${60 + hp + 6},${hem} L${54 - hp},${hem} Q${58 - hp},200 ${60 - ww},188 Z" fill="${color}"/>
      ${teen ? `<path d="M${62 - hp},${hem - 14} L${58 + hp},${hem - 14} M${62 - hp},${hem - 6} L${58 + hp},${hem - 6}" stroke="${shade(color, 1.35)}" stroke-width="1" opacity=".6"/>` : ''}` + shoes;
  }
  if (kid) {   // 반바지
    return legs(214) + `<path d="M${60 - ww},188 L${60 + ww},188 L${60 + hp + 1},226 L62,226 L60,214 L58,226 L${59 - hp},226 Z" fill="${color}"/>` + shoes;
  }
  const t = thigh / 2;
  return `<path d="M${60 - ww},188 L${60 + ww},188 Q${60 + hp},196 ${60 + hp},206 L${60 + lx + t},${ankle} L${60 + lx - t - 1},${ankle} L60,222 L${60 - lx + t + 1},${ankle} L${60 - lx - t},${ankle} L${60 - hp},206 Q${60 - hp},196 ${60 - ww},188 Z" fill="${color}"/>
    <path d="M60,206 L60,222" stroke="${shade(color, .75)}" stroke-width="1"/>` + shoes;
}
// 팔: 어깨에서 손목까지 (반팔 티셔츠면 팔뚝이 보임)
function arms(a, top, kid, fb, skin) {
  const sh = kid ? 4 : 0, c = top === 4 ? UNIFORM.blazer : TOP_COLORS[a.tc], w = a.g === 'm' && !kid ? 10.5 : 9;
  const one = d => {
    const x0 = 60 + d * (fb.hw - 4), x1 = 60 + d * (fb.hw + 2), y0 = 130 + sh, y1 = 198;
    const short = top === 0, ym = short ? 156 : y1, xm = x0 + (x1 - x0) * (ym - y0) / (y1 - y0);
    return (short ? `<path d="M${xm},${ym} L${x1},${y1}" stroke="${skin}" stroke-width="${w - 1.5}" stroke-linecap="round"/>` : '') +
      `<path d="M${x0},${y0} L${xm},${ym}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>` +
      `<path d="M${x0 + d * 3},${y0 + 8} L${xm + d * 3},${ym - 4}" stroke="${shade(c, .75)}" stroke-width="1" opacity=".5"/>` +
      `<circle cx="${x1 + d * .5}" cy="${y1 + 4}" r="4.6" fill="${skin}"/>`;
  };
  return one(-1) + one(1);
}

/* ---------- 함께 밤을 보낸 다음 날 아침 (어른만) ---------- */
// 만족감 구간(0~4)마다 눈·입·볼, 머리 흐트러짐이 달라짐. 옷 대신 맨 어깨와 이불
const SLEEPY = (x, y) => `<path d="M${x - 4.5},${y - .5} Q${x},${y + 2.8} ${x + 4.5},${y - .5}" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`;   // 나른하게 감은 눈
const HAPPY = (x, y) => `<path d="M${x - 4.5},${y + 1.5} Q${x},${y - 3.5} ${x + 4.5},${y + 1.5}" fill="none" stroke="${LINE}" stroke-width="2.2" stroke-linecap="round"/>`;  // 웃으며 감은 눈
const FROWN = `<path d="M54,90 Q60,86 66,90" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round"/>`;
const tierOf = v => v >= 90 ? 4 : v >= 70 ? 3 : v >= 50 ? 2 : v >= 30 ? 1 : 0;
function morningBody(a, skin, skinD, hw) {
  const blanketY = a.g === 'f' ? 130 : 138;
  return `<path d="${body(false, hw)}" fill="${skinD}"/>
    <path d="M47,121 Q53,124 58,122 M62,122 Q67,124 73,121" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M0,${blanketY + 6} C20,${blanketY - 4} 40,${blanketY + 4} 60,${blanketY} C80,${blanketY - 4} 100,${blanketY + 5} 120,${blanketY - 2} L120,160 L0,160 Z" fill="#ece6da"/>
    <path d="M18,${blanketY + 12} Q34,${blanketY + 22} 30,160 M84,${blanketY + 10} Q76,${blanketY + 24} 88,160 M52,${blanketY + 8} Q58,${blanketY + 18} 54,${blanketY + 30}" fill="none" stroke="#cfc6b6" stroke-width="1.6" stroke-linecap="round"/>`;
}
function messyHair(hc, n) {
  const strands = ['M40,40 q-7,-4 -9,4', 'M78,36 q8,-5 11,3', 'M55,31 q-2,-9 6,-10', 'M34,58 q-7,1 -6,8', 'M86,56 q7,2 5,9'];
  return strands.slice(0, n).map(d => `<path d="${d}" fill="none" stroke="${hc}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
}

/* ---------- 그리기 ---------- */
function render(a, size = 48, state = 25) {
  const st = typeof state === 'object' && state ? state : { age: state };
  const age = st.age ?? 25;
  const full = !!st.full && !(st.after && age >= 20), VH = full ? 280 : 160;
  const w = Math.round(size), h = Math.round(size * VH / 120);
  if (!a) return `<svg class="av" width="${w}" height="${h}" viewBox="0 0 120 ${VH}" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="${VH - 1}" rx="10"/></svg>`;
  const kid = age <= 12, teen = age >= 13 && age <= 18, adult = age >= 20;
  const af = adult && !full && st.after ? st.after : null, tier = af ? tierOf(af.sat ?? 50) : -1;
  const fb = full ? fullFrame(a, age, typeof st.full === 'object' ? st.full : null) : null;
  const hw = fb ? fb.hw : halfWidth(a, kid, adult);
  const skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86);
  const old = age >= 40 && a.gray < (age - 38) / 22;   // 40대부터 흰머리 확률 증가
  const hc = HAIR[old ? GRAY : (kid || teen) && a.hc >= 4 ? a.hc - 3 : a.hc] || HAIR[0];   // 어린이·10대는 염색 안 함
  const style = HAIRS[a.g][(kid ? KID_HAIR : teen ? TEEN_HAIR : null)?.[a.g][a.hair] ?? a.hair];
  const top = teen ? 4 : kid ? (a.top === 1 ? 0 : a.top === 3 ? 2 : a.top) : a.top;
  const ey = 72, ex = [48, 72];
  const neckTop = kid ? 96 : 94, neckBot = kid ? 121 : 118;
  const browC = shade(hc, .72), browW = a.thick ? 3.6 : 2.3;

  let o = `<svg class="av${full ? ' av-full' : ''}" width="${w}" height="${h}" viewBox="0 0 120 ${VH}" aria-hidden="true">`;
  o += `<rect class="av-bg" x=".5" y=".5" width="119" height="${VH - 1}" rx="10"/>`;
  if (fb) o += `<g transform="translate(0,${fb.dy})">`;
  // 머리 뒤쪽 (긴 머리)
  if (style.back) o += `<path d="${style.back}" fill="${shade(hc, .85)}"/>`;
  if (style.tail) o += `<path d="${style.tail}" fill="${shade(hc, .9)}"/>`;
  if (style.bun) o += `<circle cx="${style.bun[0]}" cy="${style.bun[1]}" r="${style.bun[2]}" fill="${shade(hc, .9)}"/>`;
  // 목, 몸
  o += `<path d="M51,${neckTop} L69,${neckTop} L69,${neckBot} L51,${neckBot} Z" fill="${skinD}"/>`;
  if (fb) o += bottoms(a, age, fb, skinD);
  o += af ? morningBody(a, skin, skinD, hw) : clothes(a, top, kid, skinD, hw, adult, fb);
  if (fb) o += arms(a, top, kid, fb, skinD);
  if (a.buds) o += `<path d="M34,78 C30,96 40,112 47,130" fill="none" stroke="#f4f4f4" stroke-width="1.3"/>`;
  // 귀, 얼굴
  o += `<ellipse cx="33.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/><ellipse cx="86.5" cy="73" rx="4.5" ry="6.5" fill="${skinD}"/>`;
  if (a.buds) o += `<circle cx="33" cy="76" r="2.6" fill="#f4f4f4"/>`;
  o += `<path d="${FACES[a.face] || FACES[0]}" fill="${skin}"/>`;
  // 볼, 주근깨, 주름
  const blush = af ? [0, 0, .25, .42, .55][tier] + (af.personality === 'shy' && tier >= 2 ? .15 : 0) : kid || a.blush ? .28 : 0;
  if (blush) o += `<ellipse cx="44" cy="84" rx="5.5" ry="3.2" fill="#e8857a" opacity="${blush}"/><ellipse cx="76" cy="84" rx="5.5" ry="3.2" fill="#e8857a" opacity="${blush}"/>`;
  if (a.freckles) o += [[43, 80], [46, 82], [49, 80], [71, 80], [74, 82], [77, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="${shade(skin, .62)}"/>`).join('');
  if (age >= 45) o += `<path d="M41,77 Q44,79 47,78 M73,78 Q76,79 79,77" fill="none" stroke="${shade(skin, .75)}" stroke-width="1"/>`;
  // 눈, 눈썹, 코, 입
  const eyeOf = (x, i) => {
    if (af && tier >= 3 && af.personality === 'playful' && i === 1) return HAPPY(x, ey);   // 장난형: 윙크
    if (af && tier === 4) return HAPPY(x, ey);
    if (af && tier === 3) return SLEEPY(x, ey);
    return (EYES[a.eyes] || EYES[0])(x, ey, i ? 1 : -1);
  };
  o += ex.map(eyeOf).join('');
  const brow = af && tier <= 1 ? (x, y, s) => `M${x - 6 * s},${y - 1} L${x + 6 * s},${y + 2}` : af && tier >= 3 ? BROWS[1] : (BROWS[a.brows] || BROWS[0]);
  o += `<path d="${ex.map((x, i) => brow(x, ey - 10, i ? 1 : -1)).join(' ')}" fill="none" stroke="${browC}" stroke-width="${browW}" stroke-linecap="round"/>`;
  o += `<path d="M60,76 Q57.5,82 61,83" fill="none" stroke="${shade(skin, .7)}" stroke-width="1.5" stroke-linecap="round"/>`;
  o += af ? (tier === 0 ? FROWN : tier === 1 ? MOUTHS[2] : tier >= 3 && af.personality !== 'cool' ? MOUTHS[1] : MOUTHS[0]) : (MOUTHS[a.mouth] || MOUTHS[0]);
  if (af && af.lipstick && tier >= 3) o += `<path d="M75,90 q2.5,-3 5,0 q2.5,-3 5,0 q-2.5,4 -5,4 q-2.5,0 -5,-4 Z" fill="#c43c4f" opacity=".75" transform="rotate(-12 80 90)"/>`;   // 볼에 립스틱 자국
  if (a.dimples) o += `<path d="M50,87 q-1.5,2 0,3.5 M70,87 q1.5,2 0,3.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.1" stroke-linecap="round"/>`;
  // 앞머리
  o += `<path d="${style.front}" fill="${hc}"${style.thin ? ' opacity=".9"' : ''}/>`;
  if (af && tier >= 2) o += messyHair(hc, [0, 0, 1, 3, 5][tier]);
  if (style.sides) o += `<path d="M33,58 L33,72 L36,72 L36,56 Z M87,58 L87,72 L84,72 L84,56 Z" fill="${hc}" opacity=".45"/>`;
  if (style.band) o += `<circle cx="${style.band[0]}" cy="${style.band[1]}" r="2.6" fill="${TOP_COLORS[a.tc]}"/>`;
  // 안경
  if (a.glasses === 1) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><circle cx="48" cy="72" r="7.5"/><circle cx="72" cy="72" r="7.5"/><path d="M55.5,71 Q60,68.5 64.5,71 M40.5,71 L35,69 M79.5,71 L85,69"/></g>`;
  if (a.glasses === 2) o += `<g fill="none" stroke="${LINE}" stroke-width="1.7"><rect x="39.5" y="66" width="17" height="12" rx="2.5"/><rect x="63.5" y="66" width="17" height="12" rx="2.5"/><path d="M56.5,71 L63.5,71 M39.5,70 L35,69 M80.5,70 L85,69"/></g>`;
  return o + (fb ? '</g>' : '') + '</svg>';
}

const topColor = a => TOP_COLORS[(a && a.tc) || 0];
window.Avatar = { make, render, topColor };
window.renderAvatar = render;
})();
