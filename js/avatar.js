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
// 그리는 정밀도 (FACE_UPGRADE 1절 LOD): 2 큰 화면(전부) / 1 작은 화면(64~96px — 얼굴만 크롭, 선 ×1.3, 작은 하이라이트·눈썹 결·속눈썹 꼬리·머리 결 끔) / 0 아주 작은 썸네일
let LOD = 2, LW = 1;

/* ---------- 팔레트 ---------- */
// 피부 10톤: 0 밝은, 1 보통, 2 어두운, 3 진한 + (뉴욕 등에서) 4 아주 밝은, 5 밝은 올리브, 6 올리브, 7 따뜻한 갈색, 8 짙은 갈색, 9 아주 짙은
//   피부색은 그림에만 쓰고 생김새 점수·등급과는 무관
const SKIN = ['#f7dcc5', '#e9bf98', '#c68b60', '#8b5a3c', '#fbe6d6', '#efcba7', '#d6a274', '#a8693f', '#7a4a2c', '#57331f',
  '#a9bd8a', '#8aa46c', '#6c8652'];   // 10~12: 판타지(영지) 오크의 초록 피부
// 머리색 (2-5): 0 흑발, 1 짙은 갈색, 2 밝은 갈색, 3 회색(예전 저장), 4 와인, 5 애쉬 금발, 6 애쉬브라운, 7 구릿빛, 8 밀크티 베이지, 9 핑크 브라운,
//   10 흑갈색, 11 밀크브라운, 12 다크초코, 13 탈색 금발, 14 애쉬그레이, 15 핑크, 16 블루블랙, 17 레드
//   18 골든 금발, 19 밝은 금발, 20 스트로베리 블론드, 21 진저 레드, 22 적갈색(오번), 23 더티 블론드 — 타고난 색 (염색 아님)
const HAIR = ['#23201f', '#4b3022', '#7d5536', '#a19d98', '#7e3343', '#c9a66c', '#6c625a', '#9a5a35', '#cdb594', '#9b6266',
  '#2e2420', '#a07c5c', '#4a2c22', '#dcc38f', '#9c9ca2', '#d08aa2', '#1e2333', '#8c2f33', '#d5b16e', '#e6cf9c', '#c98b58', '#a5512c', '#6c3622', '#a88a5c',
  '#d9dde3', '#efe4c6', '#2c3f6e', '#9e1f2c', '#3f5e3a', '#3b3936'];   // 24~29: 판타지(영지) 타고난 색 — 은발·백금발·짙은 청발·진홍·숲빛 초록·잿빛 흑발
const GRAY = 3;
const DYED = new Set([4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17]);   // 18~23은 타고난 색   // 염색 — 정수리·가르마에 원래 머리색 뿌리가 보임
const HC_NAT = [0, 0, 0, 10, 10, 1, 1], HC_MILD = [6, 11, 12, 8], HC_BOLD = [13, 14, 15, 16, 17, 4, 5, 9];
const TOP_COLORS = ['#4f6d8f', '#9a4f5f', '#5f8f6a', '#d0a443', '#ece7dd', '#3b3e48', '#8a6fb0', '#d9784a', '#6aa3c8', '#7a8a5a'];
const UNIFORM = { blazer: '#2f3a5a', shirt: '#f3f1ec', tie: ['#9b2f3a', '#2c4a7a', '#3d6b4a'], skirt: '#3b4766' };
const LINE = '#33241f';
const IRIS = ['#2b1d16', '#5b3a26', '#8a5c38', '#6e5a32', '#4d4c4b', '#3f6fa4', '#6f9cc4', '#55794a', '#7f7440', '#76838f'];   // 검정, 갈색, 밝은 갈색, 헤이즐, 짙은 회색 + 파랑, 하늘색, 초록, 초록 헤이즐, 회색
const METAL = ['#d8b45a', '#c9ced6'];   // 귀걸이·목걸이·안경테: 금, 은
const WHITE = '#fbf8f4', PUPIL = '#120c09', MOUTH_IN = '#7a2f33';
const LIPS = ['#d4707a', '#c9606b', '#b8434f', '#e0898f'];   // 어른 여자 립 색
const NATURAL_LIP = ['#e0a49b', '#cf8f80', '#a9654f', '#7d4535', '#e8aaa2', '#d4977f', '#b97c62', '#93573f', '#6f3d2b', '#562b1f', '#8f8a62', '#77724f', '#5f5b3e'];
// 배경(인종)별 타고난 색 비중 — 뉴욕처럼 섞여 사는 곳에서 피부·머리색·눈동자·머리 스타일을 고를 때만 씀 (점수와 무관)
const ETH = {
  white:  { skin: { 4: 3, 0: 4, 5: 2, 1: 1 }, hc: { 18: 2, 19: 1, 23: 2.5, 2: 3, 1: 3, 0: .5, 10: 1, 21: .6, 20: .5, 22: .7 }, iris: { 1: 3, 2: 2, 3: 1.5, 5: 2.5, 6: 1.5, 7: 1.2, 8: 1, 9: .8 }, lid: [2, 2, 2, 1], freckle: .14 },
  latino: { skin: { 5: 3, 1: 3, 6: 3, 2: 2, 0: 1, 7: 1 }, hc: { 0: 4, 10: 4, 1: 3, 2: 1 }, iris: { 1: 5, 2: 3, 3: 1.5, 0: 2, 7: .3, 5: .2 }, lid: [2, 2, 2, 1], freckle: .04 },
  black:  { skin: { 7: 3, 3: 3, 8: 3, 9: 2, 2: 1 }, hc: { 0: 7, 10: 3 }, iris: { 0: 5, 1: 4, 2: 1 }, lid: [2, 2, 2, 1], freckle: .03 },
  asian:  { skin: { 0: 3, 1: 3, 5: 2, 6: 1, 4: 1 }, hc: { 0: 7, 10: 3, 1: 1 }, iris: { 0: 6, 1: 3 }, lid: [0, 0, 1, 1, 2], freckle: .03 },
  mixed:  { skin: { 1: 2, 5: 2, 6: 2, 2: 2, 7: 2 }, hc: { 10: 3, 1: 3, 2: 2, 0: 2, 23: .5 }, iris: { 1: 4, 2: 3, 3: 1.5, 7: .5, 5: .3 }, lid: [2, 2, 1, 0], freckle: .08 },
};
// 머리 스타일 비중 (배경별): set — 이 스타일은 이 비중으로, 나머지는 기본 비중 × rest (한국식 남자 펌·쉼표머리는 kr 배율로 줄임)
const KR_M = { comma: .3, p64: .3, p55: .3, ash: .4, cover: .4, twoblock: .5 };
const ETH_HAIR = {
  black:  { f: { set: { afro: 3, braids: 4, puff: 3, curlS: 2, curlL: 2 }, rest: .4 }, m: { set: { afroM: 2.5, cornrow: 2.5, fade: 3, curlS: 2, buzz: 2 }, rest: .4, k: KR_M } },
  latino: { f: { set: { curlL: 2, wave: 2.5, curlS: 1, braids: .5, puff: .4 }, rest: 1 }, m: { set: { fade: 3, curlS: 1.2, buzz: 1.5, cornrow: .3 }, rest: 1, k: KR_M } },
  white:  { f: { set: { wave: 2, curlL: .7 }, rest: 1 }, m: { set: { fade: 1.5, curlS: .8 }, rest: 1, k: KR_M } },
  asian:  { f: { set: {}, rest: 1 }, m: { set: { fade: 1 }, rest: 1 } },
  mixed:  { f: { set: { curlL: 2.5, curlS: 2, afro: 1.2, puff: 1.2, braids: 1.5 }, rest: 1 }, m: { set: { curlS: 2, afroM: 1, fade: 2.5, cornrow: .8 }, rest: 1, k: KR_M } },
};
const wPick = (r, w) => { const ks = Object.keys(w); let t = r() * ks.reduce((a, k) => a + w[k], 0); for (const k of ks) { t -= w[k]; if (t <= 0) return +k; } return +ks[0]; };

const shade = (hex, k) => {   // k<1 어둡게, k>1 밝게
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1))));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('');
};

/* ---------- 생김새 만들기 ---------- */
// 파츠 수 (예전 저장의 번호는 그대로 쓰고, 새로 만드는 사람부터 늘어난 범위에서 뽑음)
const FACE_N = 6, EYE_N = 20, BROW_N = 5, MOUTH_N = 6;
// 두 색 섞기 (t: b 쪽 비율)
const mixC = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const TOPS = [0, 1, 2, 3, 5, 6, 7, 8];   // 4는 교복이라 뽑지 않음
const BUILD_W = [['slim', 3], ['avg', 4], ['fit', 2], ['chubby', 1.2]];
// opt: { feature, skin, personality, hobby, job } — 머리색 비율에 씀 / build: 체격 비중 배율 (장소 분포 — 헬스장은 탄탄한 사람이 많음)
function make(seed, gender, opt = {}) {
  const r = rng(seed), n = k => Math.floor(r() * k);
  const f = opt.feature || '', g = gender === 'f' ? 'f' : 'm';
  // 머리 스타일 (여 18 / 남 14, 비중대로) + 머리색: 자연 65% / 무난한 염색 25% / 튀는 염색 10% (직진·장난·패션 취미 ×2, 회사원·공무원·선생님·은행원 ×0.2)
  const EH = opt.eth && ETH_HAIR[opt.eth] ? ETH_HAIR[opt.eth][g] : null;
  const hw = EH ? HW[g].map((x, i) => { const id = HSTYLES[g][i].id; return id in EH.set ? EH.set[id] : x * EH.rest * ((EH.k || {})[id] ?? 1); }) : HW[g];
  let ht = r() * hw.reduce((x, y) => x + y, 0), hi = 0;
  for (; hi < hw.length - 1; hi++) { ht -= hw[hi]; if (ht <= 0) break; }
  const boldK = (['bold', 'playful'].includes(opt.personality) || opt.hobby === 'fashion' ? 2 : 1) * (/회사원|공무원|선생님|은행원/.test(opt.job || '') ? .2 : 1);
  const hcN = HC_NAT[n(HC_NAT.length)], cr = r() * (.9 + .1 * boldK), hcK = n(8);
  const a = {
    g,
    fs: String(seed), gv: 2,   // 얼굴 유전자 시드 (js/face.js) — ':me'로 끝나면 나, 아니면 NPC / gv: 유전자 판 (예전 저장은 없음 = 1판)
    face: n(FACE_N),
    skin: opt.skin != null ? opt.skin : [0, 0, 1, 1, 1, 1, 2, 3][n(8)],
    hair: hi, hv: 2,   // hv 2: 새 머리 목록 (예전 저장은 번호를 옮겨서 읽음)
    hc: cr < .65 ? hcN : cr < .9 ? HC_MILD[hcK % HC_MILD.length] : HC_BOLD[hcK % HC_BOLD.length], hcN,
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
    build: pickW(BUILD_W),
  };
  if (a.g === 'f') a.body.chest = pickW([['small', 3], ['avg', 5], ['large', 2.5]]);
  else a.body.shoulder = pickW([['narrow', 2.5], ['avg', 5], ['wide', 3]]);
  if (opt.build) a.body.build = pickW(BUILD_W.map(([k, w]) => [k, w * (opt.build[k] ?? 1)]));   // 맨 끝에서 한 번 더 뽑음 (앞의 값은 그대로)
  // 배경(인종, 뉴욕 등): 피부·타고난 머리색을 그 배경 비중으로 다시 고름 (가족은 내 피부를 그대로 받음). 맨 끝에서 뽑아 한국 사람의 생김새는 그대로
  const E = opt.eth && ETH[opt.eth];
  if (E) {
    a.eth = opt.eth;
    if (opt.skin == null) a.skin = wPick(r, E.skin); else r();
    const nat = wPick(r, E.hc), keep = DYED.has(a.hc);
    a.hcN = nat; if (!keep) a.hc = nat;
    if (r() < E.freckle + (nat === 21 || nat === 20 ? .4 : 0)) a.freckles = true;
  }
  // 종족 (판타지 영지 모드만 넘김): 엘프 귀 · 수인 귀(늑대·여우·고양이·토끼) · 오크 초록 피부와 엄니 · 드워프 수염. 피부·머리·눈동자를 종족 비중으로 다시 고름
  const RC = opt.race && RACE_LOOK[opt.race];
  if (RC) {
    a.race = opt.race;
    if (opt.beast) a.beast = opt.beast;
    if (opt.skin == null) a.skin = wPick(r, RC.skin);
    a.hc = a.hcN = wPick(r, RC.hc);
    a.iris = wPick(r, RC.iris);
    if (RC.height) a.body.height = RC.height;
    if (opt.race === 'dwarf' && g === 'm') a.beard = 1 + Math.floor(r() * 3);
    if (opt.race === 'orc') a.body.build = r() < .7 ? 'fit' : 'avg';
  }
  return a;
}
const RACE_LOOK = {
  human: { skin: { 0: 3, 1: 3, 4: 2, 5: 2, 2: 1, 6: 1 }, hc: { 0: 2, 1: 3, 2: 3, 10: 2, 18: 2, 19: 1, 21: .6, 22: 1, 23: 1.5, 24: .3 }, iris: { 0: 1, 1: 4, 2: 2, 3: 1.5, 5: 2, 6: 1, 7: 1.2, 9: .8 } },
  elf:   { skin: { 4: 4, 0: 3, 5: 1 }, hc: { 19: 3, 24: 3, 25: 3, 18: 2, 28: 1, 26: .6 }, iris: { 5: 2, 6: 3, 7: 3, 8: 1, 9: 1 } },
  dwarf: { skin: { 1: 3, 5: 2, 2: 2, 6: 1 }, hc: { 21: 3, 22: 3, 1: 2, 2: 2, 18: 1, 12: 1 }, iris: { 1: 3, 2: 2, 3: 2, 9: 1 }, height: 'short' },
  beast: { skin: { 0: 2, 1: 3, 5: 2, 2: 1 }, hc: { 0: 1.5, 1: 2, 2: 2, 10: 1, 18: 1.5, 19: 1, 24: 1.5, 21: 1.5, 3: .4 }, iris: { 2: 2, 3: 3, 7: 2, 8: 2, 1: 1 } },
  orc:   { skin: { 10: 3, 11: 4, 12: 3 }, hc: { 0: 4, 29: 4, 10: 2 }, iris: { 0: 2, 1: 2, 3: 2, 8: 1 }, height: 'tall' },
};
// 세부 — make() 값에서 늘 똑같이 나옴 (예전 저장의 얼굴도 그대로 살아남)
//   뒤쪽 세부(코·쌍꺼풀·수염·점·귀걸이…)는 나중에 더한 것 — 앞 순서를 건드리지 않게 이어서 뽑음
function extras(a) {
  // xseed가 있으면(20세 시작에서 직접 고른 생김새) 그걸로 — 머리·피부·눈을 바꿔도 코·점·귀걸이 같은 세부는 그대로
  const r = rng('x' + (a.xseed != null ? a.xseed : [a.g, a.face, a.skin, a.hair, a.hc, a.eyes, a.brows, a.mouth, a.top, a.tc, a.tie, a.gray].join(',')));
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
  const E = a.eth && ETH[a.eth];
  if (E) { X.iris = wPick(r, E.iris); X.lid = E.lid[n(E.lid.length)]; }   // 배경별 눈동자색·쌍꺼풀 (점수와 무관)
  if (a.iris != null) X.iris = a.iris;   // 20세 시작에서 직접 고른 눈동자색
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
  // 세분화 (유전자 2판)
  'M33,67 C33,46 45,38.5 60,38.5 C75,38.5 87,46 87,67 C87,86 77,98.5 60,98.5 C43,98.5 33,86 33,67 Z',                    // 동안형: 볼이 통통하고 턱이 짧음
  'M33.6,64 C33.6,45.5 46,38 60,38 C74,38 86.4,45.5 86.4,64 L86,79 C85.5,90 76,99.5 60,100 C44,99.5 34.5,90 34,79 Z',    // 둥근 사각형: 턱 모서리가 둥근 각진형
  'M34.5,65 C34.5,46 46,38 60,38 C74,38 85.5,46 85.5,65 C85.5,79 77,92 64,101.5 Q60,104 56,101.5 C43,92 34.5,79 34.5,65 Z',   // V라인: 좁은 턱선이 뾰족하게 모임
  'M36,62 C37,45 47,38 60,38 C73,38 83,45 84,62 C86.5,70 86,78 81,86 C75,95 67,101.5 60,102.5 C53,101.5 45,95 39,86 C34,78 33.5,70 36,62 Z',   // 다이아몬드형: 이마·턱이 좁고 광대가 넓음
  'M33.5,67 C33.5,46 45.5,38 60,38 C74.5,38 86.5,46 86.5,67 C86.5,86.5 75.5,100.5 60,101.5 C44.5,100.5 33.5,86.5 33.5,67 Z',   // 둥근 계란형
  'M33,62 C33,45 45,38 60,38 C75,38 87,45 87,62 C87,71 85,78 80.5,85 C76,92 69,98.5 64.5,101.5 Q60,104 55.5,101.5 C51,98.5 44,92 39.5,85 C35,78 33,71 33,62 Z',   // 역삼각형: 넓은 이마에서 턱까지 곧게 좁아짐
];
// 귀: 바깥 테두리 + 안쪽 주름 + 귓구멍 그림자 (s: 왼쪽 -1 / 오른쪽 1). 얼굴이 안쪽 절반을 덮음
function earSVG(skin, s) {
  const X = dx => f1(60 + s * dx), d = shade(skin, .86), ln = shade(skin, .68);
  return `<path d="M${X(24.5)},65.6 C${X(29.6)},63.4 ${X(32)},67.4 ${X(31.6)},72.6 C${X(31.2)},77.2 ${X(30)},80.8 ${X(27.2)},81.2 C${X(25.6)},81.4 ${X(24.6)},80.2 ${X(24.4)},78 Z" fill="${d}" stroke="${ln}" stroke-width=".6" stroke-opacity=".5"/>` +
    `<ellipse cx="${X(27.9)}" cy="72.8" rx="1.3" ry="2.7" fill="${shade(skin, .7)}" opacity=".35"/>` +
    `<path d="M${X(26.4)},67.6 C${X(29.4)},67 ${X(30.1)},70.6 ${X(29.5)},73.9 C${X(29.1)},76.1 ${X(28.1)},77.2 ${X(27.1)},76.8" fill="none" stroke="${ln}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`;
}
// 눈 모양 (FACE_UPGRADE 2절): 카탈로그(js/face.js EYES) 수치로 — 안쪽 꼬리(i), 바깥 꼬리(o), 윗꺼풀(u)·아랫꺼풀(l) 조절점, 홍채 반지름 (side: 왼눈 -1 / 오른눈 1)
//   w 가로, h 세로, peak 윗선 꼭짓점(0 안쪽~1 바깥), tilt 눈꼬리 각도, lower 아랫선 볼록함, iris 눈동자 크기, lid 윗꺼풀이 눈동자를 덮는 비율
const EYE_FALLBACK = { w: 1, h: 1, peak: .5, tilt: 2, lower: .5, iris: 1, lid: .15 };
function eyeShape(t, x, y, s) {
  const E = (window.Face && Face.EYES[t]) || EYE_FALLBACK, W = 5.9 * E.w, rise = Math.tan(E.tilt * Math.PI / 180) * W * 1.15;
  return { i: [x - W * s, y + .6 + rise * .25], o: [x + W * s, y + .3 - rise], u: [x + (E.peak - .5) * 2 * W * .7 * s, y - 6.7 * E.h - rise * .4], l: [x + (.5 - E.peak) * W * .3 * s, y + (2.6 + 2.6 * E.lower) * E.h * .92],
    ir: [3.85 * E.iris, 4 * E.iris], lidC: E.lid, crease: E.crease || 0, mono: !!E.mono, heavy: E.id === 'sleepy', hood: E.id === 'deep' };
}
const qAt = (p0, c, p2, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p2[1]];
// 속눈썹: 윗꺼풀 바깥쪽 끝에 짧은 곡선 (여자 2~3개, 남자아이 1개)
function lashes(e, s, n) {
  let d = '';
  for (let k = 0; k < n; k++) {
    const p = qAt(e.i, e.u, e.o, .98 - k * .14);
    d += `M${P(p[0], p[1])} q${f1(1.5 * s)},${f1(-.1 - k * .3)} ${f1(2.1 * s)},${f1(-1.5 - k * .6)} `;
  }
  return `<path d="${d}" fill="none" stroke="${LINE}" stroke-width=".8" stroke-linecap="round"/>`;
}
// 아래 속눈썹 (속눈썹 '풍성하게'): 눈꼬리 쪽 아랫선에 짧은 가닥 둘
function lowerLashes(e, s) {
  let d = '';
  for (const t of [.7, .85]) { const p = qAt(e.i, e.l, e.o, t); d += `M${P(p[0], p[1] + .2)} l${f1(.55 * s)},1.1 `; }
  return `<path d="${d}" fill="none" stroke="${LINE}" stroke-width=".6" stroke-linecap="round" opacity=".6"/>`;
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
    `<ellipse cx="${f1(gx)}" cy="${f1(gy + .3)}" rx="${f1(rx * .48)}" ry="${f1(ry * .5)}" fill="${PUPIL}"/>` +
    `<path d="M${f1(gx - rx * .78)},${f1(gy + ry * .28)} Q${f1(gx)},${f1(gy + ry * 1.12)} ${f1(gx + rx * .78)},${f1(gy + ry * .28)} Q${f1(gx)},${f1(gy + ry * .74)} ${f1(gx - rx * .78)},${f1(gy + ry * .28)} Z" fill="${shade(c, 2.1)}" opacity=".55"/>`;   // 아래쪽 밝은 초승달
}
// 아래 눈꺼풀: 눈꼬리 쪽 속눈썹 선 + 전체 옅은 선
const lowerLid = (e, s) => `<path d="${polyD(qOffset(e.i, e.l, e.o, s, .38, 1, () => 0, 5))}" fill="none" stroke="${LINE}" stroke-width=".9" stroke-linecap="round" opacity=".5"/>` +
  `<path d="M${P(...e.i)} Q${P(...e.l)} ${P(...e.o)}" fill="none" stroke="${LINE}" stroke-width=".7" opacity=".2"/>`;
function openEye(a, X, x, y, s, nLash, o = {}) {
  const e = eyeShape(a.eyes, x, y, s), id = `av${UID}e${s > 0 ? 'r' : 'l'}`;
  const shape = `M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)} Q${P(...e.l)} ${P(...e.i)} Z`;
  const gx = x + X.gaze * 1.2, gy = y + .5;
  // 쌍꺼풀: 가는 눈·무쌍은 없음, 큰 눈은 늘 겉쌍 / 속쌍은 눈머리 쪽에서 붙고, 겉쌍은 나란히
  const lid = e.mono && !(a.fx && a.fx.lid) ? 0 : Math.max(e.crease || 0, X.lid, (a.fx && a.fx.lid) || 0);
  const crease = lid ? `<path d="${polyD(qOffset(e.i, e.u, e.o, s, lid === 1 ? .14 : .06, 1.04, t => lid === 1 ? 2.5 * clamp((t - .1) / .45, 0, 1) : 2.3))}" fill="none" stroke="${LINE}" stroke-width=".7" stroke-linecap="round" opacity=".32"/>` : '';
  const aegyo = o.aegyo ? `<ellipse cx="${f1(x + .3 * s)}" cy="${f1(e.l[1] + 1)}" rx="3.8" ry="1.2" fill="${o.skinHi || '#fff'}" opacity=".3"/>` +   // 애교살: 눈 밑 밝은 볼록함 + 아주 옅은 아래 선 (다크서클처럼 안 보이게)
    `<path d="${polyD(qOffset(e.i, e.l, e.o, s, .3, .75, () => -2.8, 4))}" fill="none" stroke="${o.skinLn}" stroke-width=".6" stroke-linecap="round" opacity=".14"/>` : '';
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/>
    <g clip-path="url(#${id})">${irisSVG(X, id + 'i', gx, gy, e.ir[0], e.ir[1])}
      <circle cx="${f1(gx + 1.5)}" cy="${f1(gy - 1.6)}" r="1.55" fill="#fff"/>${LOD >= 2 ? `<circle cx="${f1(gx - 1.3)}" cy="${f1(gy + 1.8)}" r=".65" fill="#fff" opacity=".85"/>` : ''}
      <path d="M${P(...e.i)} Q${P(...e.u)} ${P(...e.o)}" fill="none" stroke="${PUPIL}" stroke-width="${f1(2.4 + (e.lidC ?? .15) * 9)}" opacity="${f1((.12 + (e.lidC ?? .15) * .3) * 100) / 100}"/></g>
    ${e.hood ? `<path d="${polyD(qOffset(e.i, e.u, e.o, s, .1, 1.02, t => 1.6 + 1.2 * Math.sin(Math.PI * t)))}" fill="none" stroke="${o.skinLn || LINE}" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>` : ''}
    ${crease}${aegyo}${lidSVG(e.i, e.u, e.o, s, (e.mono ? 1.5 : 1) * (o.male ? 1.15 : 1) * (o.lidK || 1) * LW, (e.mono || e.hood || e.heavy ? 3.4 : 2.8) * (o.male ? 1.15 : 1) * (o.lidK || 1) * LW, o.wing)}${lowerLid(e, s)}${nLash && LOD >= 2 ? lashes(e, s, Math.min(2, nLash)) : ''}${o.lowLash && LOD >= 2 ? lowerLashes(e, s) : ''}`;
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
// 눈썹 8~17 (유전자 2판): [안쪽 y, 산 y, 꼬리 y, 산 x(바깥 +), 굵기 배수, 각진 산, 안쪽 길이, 바깥 길이]
const BROW_T = {
  8: [.6, -.4, .2, 0, .7, 0, 6, 6.6],          // 가는 일자
  9: [.9, -1.9, 1, .6, 1, 0, 6, 6.4],           // 자연 아치
  10: [1.8, -3.8, 1.2, 2.6, .95, 1, 6, 6.4],    // 높은 각진 아치
  11: [1.1, -2.8, 1.4, .2, .9, 0, 4.4, 4.2],    // 짧고 둥근
  12: [1, -2.4, 2.6, 3.4, 1.05, 1, 6, 6.8],     // 갈매기: 산이 바깥쪽, 꼬리가 꺾여 내려감
  13: [.4, -1, .8, .3, 1.45, 0, 6.3, 6.6],      // 숱 많은
  14: [1, -2.4, 2.4, .8, .95, 0, 6, 8.2],       // 꼬리 긴
  15: [1.2, -3, 1.4, 0, 1.35, 0, 6, 6.4],       // 두꺼운 아치
  16: [.5, -.6, .6, 0, 1.5, 0, 4.6, 4.4],       // 짧고 굵은
  17: [.4, -2.4, 3, -.6, 1, 0, 6, 6.6],         // 처진 아치
};
// 눈썹 5종 (일자·아치·각진·두꺼운 일자·가늘고 둥근) + 표정 (화남: 안쪽이 내려감 / 놀람: 올라감 / 슬픔: 바깥쪽이 내려감)
function browPts(type, x, y, s, expr) {
  let inY = y, midY = y, outY = y, mx = x, k = 1;
  if (type === 0) { inY = y + .6; midY = y - .3; outY = y; }
  else if (type === 1) { inY = y + 1.2; midY = y - 3; outY = y + 1.4; }
  else if (type === 2) { inY = y + 1.6; midY = y - 2.8; outY = y + .6; mx = x + 2.2 * s; }
  else if (type === 3) { inY = y + .5; midY = y - .7; outY = y + .5; k = 1.3; }
  else if (type === 5) { inY = y + 1.6; midY = y - 4.4; outY = y + 1.8; mx = x + 1 * s; }                 // 높은 아치
  else if (type === 6) { inY = y - .4; midY = y - 1.4; outY = y + 2.8; mx = x - .4 * s; }                  // 처진: 바깥이 내려감 (순해 보임)
  else if (type === 7) { inY = y + 1.6; midY = y - 1.2; outY = y - 2.4; mx = x + .8 * s; }                 // 올라간: 바깥이 올라감 (강해 보임)
  else if (BROW_T[type]) { const T = BROW_T[type]; inY = y + T[0]; midY = y + T[1]; outY = y + T[2]; mx = x + T[3] * s; k = T[4]; }
  else { inY = y + 1.3; midY = y - 2.4; outY = y + 1.6; mx = x + .3 * s; k = .78; }                       // 짧고 동글
  if (expr === 'angry') { inY += 2.8; midY += .8; }
  else if (expr === 'surprised') { inY -= 2.6; midY -= 3; outY -= 2.2; }
  else if (expr === 'sad') { inY -= 2.2; outY += 1.8; }
  else if (expr === 'soft') { inY -= 1.4; midY -= 1; outY += .4; }   // 기분 좋게 풀린
  const T = BROW_T[type];
  return { a: [x - (T ? T[6] : type === 4 ? 4.4 : 6) * s, inY], m: [mx, midY], b: [x + (T ? T[7] : type === 4 ? 4.6 : 6.4) * s, outY], ang: type === 2 || !!(T && T[5]), k };
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
// 눈썹 결: 눈썹머리 쪽에 위로 비스듬히 선 짧은 가닥 3~4개
function browHairs(type, x, y, s, expr, wid, c) {
  const B = browPts(type, x, y, s, expr);
  let d = '';
  const n = type === 13 || type === 16 ? 7 : 4;   // 숱 많은·짧고 굵은 눈썹은 결이 더 보임
  for (let k = 0; k < n; k++) { const t = .03 + k * (n > 4 ? .06 : .07), p = qAt(B.a, B.m, B.b, t); d += `M${P(p[0], p[1] + wid * .3)} l${f1(s * (.5 + k * .2))},${f1(-wid * .85)} `; }
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width=".55" stroke-linecap="round" opacity=".75"/>`;
}
// 입 6종 (보통·웃는·무표정·약간 벌린·다문 미소·고양이 입). 윗입술 선 + 아랫입술, 여자는 입술 색
//   lip: { c 색, teeth, f 두께(0 얇은 / 1 보통 / 2 도톰), gloss 아랫입술 윤기 }
function mouthSVG(type, lip, female) {
  const lo = female ? .95 : .5, fz = lip.f ?? 1, d = [-.9, 0, 1.3][fz], gl = lip.gloss ? `<ellipse cx="58.4" cy="${f1(91 + d * .5)}" rx="1.7" ry=".55" fill="#fff" opacity=".4"/>` : '';
  if (type === 1) return lip.teeth
    ? `<path d="M52.5,86.4 Q60,95.6 67.5,86.4 Q60,89.2 52.5,86.4 Z" fill="${MOUTH_IN}" stroke="${female ? lip.c : LINE}" stroke-width="1.3" stroke-linejoin="round"/><ellipse cx="60" cy="91.2" rx="3.4" ry="1.2" fill="#e27886" opacity=".8"/>`
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
// 다문 입 9종 (기본 표정 — 벌린 입·이·혀는 표정에서만). 가운데 (60, 88.5), full: 아랫입술 두께 0.56~1.4
function closedMouth(id, lip, female, full) {
  const lo = female ? .9 : .6, lc = lip.c, dl = (full - 1) * 1.7;
  const lower = (w, y, k = 1) => `<path d="M${f1(60 - w)},${f1(y)} Q60,${f1(y + (2.5 + dl) * k)} ${f1(60 + w)},${f1(y)} Q60,${f1(y + .9)} ${f1(60 - w)},${f1(y)} Z" fill="${lc}" opacity="${lo}"/>`;
  const upper = (w, y, bow) => `<path d="M${f1(60 - w)},${f1(y)} Q${f1(60 - w * .45)},${f1(y - 1.6 - bow)} 60,${f1(y - .4 + bow * .4)} Q${f1(60 + w * .45)},${f1(y - 1.6 - bow)} ${f1(60 + w)},${f1(y)} Q60,${f1(y + 1.2)} ${f1(60 - w)},${f1(y)} Z" fill="${lc}" opacity="${female ? .88 : .35}"/>`;   // 윗·아랫입술 구분
  const ln = (d, w) => `<path d="${d}" fill="none" stroke="${female ? mixC(LINE, lc, .38) : LINE}" stroke-width="${f1(w * LW * (female ? .82 : 1))}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const gl = `<ellipse cx="58.6" cy="${f1(90.6 + dl * .5)}" rx="1.5" ry=".5" fill="#fff" opacity="${lip.gloss ? .42 : .2}"/>`;   // 아랫입술 하이라이트
  if (id === 'line') return lower(4.2, 89.4, .7) + ln('M54.8,88.6 Q60,89.5 65.2,88.6', 1.25) + gl;
  if (id === 'smile') return upper(5.4, 88, .2) + lower(4.4, 89.8) + ln('M53.8,87.3 Q60,91.2 66.2,87.3', 1.6) + gl;
  if (id === 'flat') return lower(4, 89.8, .8) + ln('M54.8,88.8 L65.2,88.8', 1.6) + ln('M54.1,88.2 l-.5,1 M65.9,88.2 l.5,1', .8) + gl;
  if (id === 'down') return lower(4, 90, .8) + ln('M54.6,89.9 Q60,87.9 65.4,89.9', 1.5) + gl;
  if (id === 'small') return upper(3.4, 88.2, .3) + lower(2.8, 89.4) + ln('M56.6,88.4 Q60,89.5 63.4,88.4', 1.35) + gl;
  if (id === 'wide') return upper(7, 88, 0) + lower(5.8, 89.6) + ln('M52.2,88 Q60,90.4 67.8,88', 1.6) + gl;
  if (id === 'pout') return upper(3.8, 88, .7) + lower(3.8, 89.5, 1.35) + ln('M56,88.1 Q60,89.1 64,88.1', 1.35) + gl;
  if (id === 'cat') return mouthSVG(5, lip, female);
  return upper(5.2, 88.2, .8) + lower(4.4, 89.4) + ln('M54.4,88.3 Q57,89 60,88.6 Q63,89 65.6,88.3', 1.5) + gl;   // bow: 윗입술 큐피드 활
}
// 코 10종 (FACE_UPGRADE 3절, 최소 선): 0 반듯한 / 1 둥근 / 2 콧대 높은 / 3 콧볼 넓은 / 4 단추 / 5 작고 오똑 / 6 긴 / 7 코끝이 들린 / 8 낮은 / 9 큼직한
//   코끝 하이라이트 + 코 아래 그림자. 콧구멍은 들린 코만 점 둘. 길이·폭은 유전자(noseLen·noseW)가 한 번 더 곱해짐
function noseSVG(type, skin, kid, soft) {
  const ln = shade(skin, soft ? .72 : .66), st = w => `fill="none" stroke="${ln}" stroke-width="${f1(w * LW * (soft ? .85 : 1))}" stroke-linecap="round" stroke-linejoin="round"`;
  const hl = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${f1(r * .8)}" fill="#fff" opacity=".3"/>`;
  const bridgeSh = (y0, y1, w, op) => `<path d="M58.4,${y0} Q58.9,${f1((y0 + y1) / 2)} 58.2,${y1}" fill="none" stroke="${shade(skin, .74)}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
  let o = `<ellipse cx="60.4" cy="84.7" rx="3" ry="1" fill="${shade(skin, .62)}" opacity=".16"/>`;
  if (type === 1) o += `<path d="M57.5,82.3 Q60,84.6 62.5,82.3" ${st(1.2)}/>${hl(60.2, 80.6, 1.3)}`;                                         // 둥근: 둥근 코끝
  else if (type === 2) o += bridgeSh(69.5, 80.4, 1.2, soft ? .24 : .35) + `<path d="M58.1,82.6 Q59.9,84.4 62.3,82.9 Q62.9,82.3 62.5,81.5" ${st(1.25)}/><path d="M60.8,71.5 L61,79" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".22"/>${hl(60.6, 81.2, .9)}`;   // 콧대 높은: 콧대 그림자 + 열린 코끝 곡선
  else if (type === 3) o += `<path d="M56.5,80.4 Q55.4,83.4 58.2,83.7 M63.5,80.4 Q64.6,83.4 61.8,83.7" ${st(1.2)}/>${hl(60, 81, 1.5)}`;      // 콧볼 넓은: 콧망울 곡선 둘
  else if (type === 4) o += `<path d="M60.4,79.4 L59.6,81.6" ${st(1.1)}/><path d="M58.3,82.4 Q60,84.4 61.9,82.4" ${st(1.15)}/>${hl(60.4, 81.6, .9)}`;   // 단추: 짧은 선 + 둥근 코끝 반원
  else if (type === 5) o += `<path d="M61.2,${soft ? 79.6 : 78.6} L60.3,82.2" ${st(1.15)}${soft ? ' opacity=".7"' : ''}/><path d="M59.4,83.1 Q60.4,83.6 61.5,83" ${st(1)} opacity=".7"/>${hl(60.1, 81.5, .85)}`;   // 작고 오똑: 그림자 쪽 짧은 선 + 코끝 점 하이라이트
  else if (type === 6) o += bridgeSh(68.5, 81.5, 1.1, .32) + `<path d="M58.4,83.6 Q60,85.2 61.8,83.6" ${st(1.25)}/>${hl(60.2, 81.8, 1)}`;   // 긴: 긴 콧대 + 처진 코끝
  else if (type === 7) o += `<path d="M58.4,81.2 Q60.2,79.6 62,81.2" ${st(1.1)} opacity=".7"/><circle cx="58.9" cy="82.7" r="${soft ? .45 : .6}" fill="${ln}" opacity="${soft ? .45 : .7}"/><circle cx="61.5" cy="82.7" r="${soft ? .45 : .6}" fill="${ln}" opacity="${soft ? .45 : .7}"/>${hl(60.2, 80.2, 1.1)}`;   // 들린: 코끝이 위로, 콧구멍 점 둘
  else if (type === 8) o += `<ellipse cx="60.2" cy="82.8" rx="2.2" ry="1.1" fill="${ln}" opacity=".32"/>${hl(60.1, 81.6, .9)}`;   // 낮은: 콧대 없이 코끝 그림자만
  else if (type === 9) o += bridgeSh(70, 80.6, 2, .3) + `<path d="M57.2,81 Q56.4,84 59.6,84.4 Q63.6,84.4 63,81" ${st(1.4)}/>${hl(60.2, 81.4, 1.6)}`;   // 큼직한: 굵은 콧대 그림자 + 넓은 코끝
  else o += `<path d="M61.2,${soft ? 78.2 : 76.4} L58.4,82.8 Q60.2,84.2 62.6,83.2" ${st(1.4)}/>`;                                                          // 반듯한: 중간 길이 선 + 콧망울 짧은 획
  return kid ? `<g transform="translate(60,82) scale(.82) translate(-60,-82)">${o}</g>` : o;
}
// 수염 (어른 남자): 1 거뭇한 턱 / 2 콧수염 / 3 염소수염 / 4 짧은 턱수염. clip: 얼굴 clipPath id
//   L: 얼굴 배치(있으면) — 턱 수염은 얼굴 윤곽을 따라 휘고, 콧수염·염소수염은 입 자리로
function beardSVG(kind, hc, clip, L) {
  if (!kind) return '';
  const c = shade(hc, .85), W = d => L ? L.warp(d) : d, MT = s => L ? `<g transform="${L.mouthT}">${s}</g>` : s;
  const jaw = op => `<g clip-path="url(#${clip})"><path d="${W('M32,77 C34,93 47,104 60,104 C73,104 86,93 88,77 C85,86 79,91.5 72,93.8 Q66,95.6 60,95.4 Q54,95.6 48,93.8 C41,91.5 35,86 32,77 Z')} ${mouthD(L, 'M52.6,86.8 Q56,84.4 60,85.4 Q64,84.4 67.4,86.8 Q60,86 52.6,86.8 Z')}" fill="${c}" opacity="${op}"/></g>`;
  const must = op => MT(`<path d="M52.6,87.2 C54.4,84.6 57.6,84.5 60,85.6 C62.4,84.5 65.6,84.6 67.4,87.2 C64.8,86.4 62.4,86.6 60,87.3 C57.6,86.6 55.2,86.4 52.6,87.2 Z" fill="${c}" opacity="${op}"/>`);
  const chin = op => L ? `<g clip-path="url(#${clip})"><path d="${W('M55.4,94.4 Q60,93.2 64.6,94.4 Q64.8,99.8 60,101.6 Q55.2,99.8 55.4,94.4 Z')}" fill="${c}" opacity="${op}"/></g>` : `<path d="M55.4,94.4 Q60,93.2 64.6,94.4 Q64.8,99.8 60,101.6 Q55.2,99.8 55.4,94.4 Z" fill="${c}" opacity="${op}"/>`;
  if (kind === 1) return jaw(.15);
  if (kind === 2) return jaw(.06) + must(.9);
  if (kind === 3) return jaw(.08) + must(.85) + chin(.8);
  return jaw(.34) + must(.92) + chin(.5);
}
// 점: 입가 / 눈 밑 / 볼 / 턱
const MOLES = [[54.2, 92.8], [41.6, 77.6], [77.6, 86.4], [65.6, 97.2]];
// 경로의 점들을 입 자리로 옮김 (입 폭·높이)
const mouthD = (L, d) => L ? d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${f1(60 + (+x - 60) * L.g.mouthW)},${f1(+y - 88.5 + L.my)}`) : d;

/* ---------- 얼굴 유전자 → 배치 (js/face.js) ----------
   기존 머리 좌표(얼굴 x 33~87, y 38~104) 위에서 파츠마다 옮기고 키우고 돌림. 표정(눈·입 모양)은 원래 자리에서 그린 뒤 이 변환을 씌우니
   웃어도 울어도 같은 사람. 윤곽은 경로의 점을 휘어(광대 폭·턱 폭·턱 끝·얼굴 길이) 만듦 */
const GENES = new Map();
function genesOf(a) {
  if (!window.Face || !a) return null;
  const key = (a.fs || ['o', a.g, a.face, a.skin, a.hair, a.hc, a.brows, a.mouth, a.top, a.tc, a.gray].join(',')) + (a.gs ? '#' + a.gs : '');
  const ck = key + (a.gv ? '|v' + a.gv : '') + (a.gb ? '|b' + a.gb : '') + (a.fx ? '|' + JSON.stringify(a.fx) : '') + (a.go ? '|o' + JSON.stringify(a.go) : '');
  let g = GENES.get(ck);
  if (!g) {
    g = Face.genes(key, a.g, !/:me$/.test(a.fs || ''), a.gv || 1);   // gv 2: 새로 만든 얼굴 (얼굴형 세분화·새 눈썹·속눈썹 단계)
    if (a.gb) g = Face.biasGenes(g, a.g, a.gb);   // 원하는 등급의 얼굴 (배치를 이상값 쪽으로)
    if (a.fx) {   // 성형: 코 모양·눈 크기 / 실패하면 비대칭
      g = Object.assign({}, g);
      if (a.fx.nose != null) g.nose = a.fx.nose;
      if (a.fx.eyeAdd) g.eyeSize += a.fx.eyeAdd;
      if (a.fx.asymAdd) g.asym = Math.min(1, (g.asym || 0) + a.fx.asymAdd);
    }
    if (a.go) g = Object.assign({}, g, a.go, { marks: Object.assign({}, g.marks, a.go.marks) });   // 직접 고른 얼굴 (미녀·미남 만들기): 배치·파츠 값을 덮어씀
    GENES.set(ck, g);
  }
  return g;
}
// 지금 나이의 유전자 (눈 종류: 아키타입이 없으면 생김새에서 고른 눈)
function genesAt(a, age) {
  const g0 = genesOf(a);
  if (!g0) return null;
  const eye = g0.eye != null ? g0.eye : a.eyes, g = Face.forAge(g0, age, eye);
  if (g.eye == null) g.eye = eye;
  return g;
}
function layoutOf(a, age) {
  const g = genesAt(a, age);
  if (!g) return null;
  if (age >= 20 && a.body && a.body.build === 'chubby') { g.jawW += .07; g.cheekW += .025; }   // 통통하면 볼살 (1-9)
  const H = 66, ey = 72 + g.eyeY * H, gap = 12 * g.eyeGap, ex = [60 - gap, 60 + gap];
  // 입은 턱 끝에서 9.5 위까지만, 코끝은 입에서 4.2 위까지만 (짧은 얼굴에 긴 코·낮은 입이 겹쳐도 턱이 남게)
  const chinB = 66 + (([101, 100, 103, 102, 104, 102, 98.5, 100, 103.5, 102.5, 101.5, 103][g.shape] || 102) - 66) * g.faceLen;
  const my = Math.min(ey + 11.5 * g.noseLen + 5 + g.mouthY * H, chinB - 9.5), tipY = Math.min(ey + 11.5 * g.noseLen, my - 4.2), chinDy = 36 * (g.faceLen - 1);
  g.noseLen = (tipY - ey) / 11.5;
  const jawK = 1 + (g.jawW - .925) * .6;
  // 윤곽 휘기: 위(이마)는 그대로, 광대(y 60~72)는 cheekW, 그 아래는 jaw 쪽으로, 턱 끝은 chinPoint만큼 모임, 66 아래는 faceLen만큼 길어짐
  const wk = y => y <= 50 ? 1 + (g.cheekW - 1) * Math.max(0, (y - 38) / 12) : y <= 72 ? g.cheekW : (() => { const t = Math.min(1, (y - 72) / 30); return lerp(g.cheekW, g.cheekW * jawK * (1 - .2 * g.chinPoint * t * t), t); })();
  const warp = d => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => { const X = +x, Y = +y; return `${f1(60 + (X - 60) * wk(Y))},${f1(Y <= 66 ? Y : 66 + (Y - 66) * g.faceLen)}`; });
  const ay = i => i ? (g.asym || 0) * 1.6 : 0;   // 좌우 비대칭 (FACE_UPGRADE 4-1)
  const eyeT = i => { const s = i ? 1 : -1, x0 = i ? 72 : 48; return `translate(${f1(ex[i])},${f1(ey + ay(i))}) rotate(${f1(-s * g.eyeTilt * .7)}) scale(${g.eyeSize.toFixed(3)}) translate(${-x0},-72)`; };
  const browT = i => { const s = i ? 1 : -1, x0 = i ? 72 : 48; return `translate(${f1(ex[i] - x0)},${f1(ey - 72 - g.browY * H + ay(i) * .7)}) rotate(${f1(-s * g.browAngle * .55)},${x0},62)`; };
  return { g, ey, ex, tipY, my, chinDy, warp, eyeT, browT, cheek: 27 * (g.cheekW - 1),
    noseT: `translate(60,${f1(ey)}) scale(${g.noseW.toFixed(3)},${g.noseLen.toFixed(3)}) translate(-60,-72)`,
    mouthT: `translate(60,${f1(my)}) scale(${g.mouthW.toFixed(3)},1) translate(-60,-88.5)`,
    earT: s => { const cx = 60 + s * 28, k = .82 + (g.ear.size - .75) * .9; return `translate(${f1(s * 27 * (g.cheekW - 1))},${f1(g.ear.y * H + (ey - 72) * .5)}) translate(${cx},73) scale(${k.toFixed(3)}) translate(${-cx},-73)`; },
    glassT: `translate(60,${f1(ey)}) scale(${g.eyeGap.toFixed(3)},${((1 + g.eyeSize) / 2).toFixed(3)}) translate(-60,-72)` };
}
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

/* ---------- 머리 (HAIR_CLOTHES_BODY 2부) ---------- */
// 레이어 4개: back 뒷머리(얼굴·몸 뒤) / side 옆머리(귀 앞뒤) / top 정수리·볼륨(두상보다 4~8% 크게) / front 앞머리(인상을 가장 크게 바꿈) + acc 액세서리
//   스타일 = back·side·top·front 조합. 앞머리는 독립 파츠 → 같은 긴 머리도 앞머리만 바꿔 여러 가지. 사람마다 hair 시드로 한 번 정해짐
//   그리는 법: 하이라이트는 좌상단에 두상을 따라 휘는 짧은 호 2~3개(머리색 +18%), 결 선은 최대 3개·옅게, 외곽선은 머리색의 가장 어두운 톤,
//   가르마가 있는 스타일만 가르마 자리에 피부색 가는 틈, 이마·귀 옆 잔머리(묶은 머리일수록 많이)
// 앞머리 9종 (오른쪽 관자놀이 87,ys → 왼쪽 33,ys 의 아래 선). 가르마·흐름은 한쪽 기준으로 그리고 사람마다 좌우를 뒤집음
const FRONT_LABEL = { none_center: '앞머리 없음 (5:5)', none_side: '앞머리 없음 (옆가르마)', seethrough: '시스루뱅', curtain: '커튼뱅', side_swept: '옆으로 넘긴 앞머리', full: '일자 풀뱅', short_crop: '짧은 앞머리', comma: '쉼표', up: '올린 앞머리' };
const FRONT_IDS = Object.keys(FRONT_LABEL);
function jag(x1, x2, y, h, n) {   // 짧게 친 앞머리 끝 (들쭉날쭉)
  let d = '';
  for (let i = 1; i <= n; i++) { const xa = x1 + (x2 - x1) * (i - .5) / n, xb = x1 + (x2 - x1) * i / n; d += `L${P(xa, y + h * (i % 2 ? 1 : .2))} L${P(xb, y + h * .45)} `; }
  return d;
}
const FRONTS = {
  none_center: ys => `C87,58 84.5,50 77.5,46.6 C71,44 64.5,43.4 60,41.4 C55.5,43.4 49,44 42.5,46.6 C35.5,50 33,58 33,${ys}`,
  none_side:   ys => `C87,58 85,49.6 78,45.8 C72,43 64,42.6 52,41.2 C46.4,43.2 40.4,46.4 36.8,51 C34.4,54.4 33,59 33,${ys}`,
  seethrough:  ys => `C87,58 84,49.5 74,46.6 Q60,43.8 46,46.6 C36,49.5 33,58 33,${ys}`,
  curtain:     ys => `C87,63 86,58 82.6,56 C77.4,53.6 70.4,50.6 65,46.8 Q61.6,44.2 60,42.4 Q58.4,44.2 55,46.8 C49.6,50.6 42.6,53.6 37.4,56 C34,58 33,63 33,${ys}`,
  side_swept:  ys => `C87,63 86,57 81.5,54.4 C73,50.4 63,49.6 53,46.4 C46,44.4 40,46.6 36.5,51.6 C34.5,55.4 33,60 33,${ys}`,
  full:        ys => `C87,63 86.5,59 85,57 ${scallop(85, 35, 57, 2.2, 11)}C33.5,59 33,63 33,${ys}`,
  full_low:    ys => `C87,65 87,62.5 86,61 ${scallop(86, 34, 61, 2.6, 10)}C33,62.5 33,65 33,${ys}`,
  short_crop:  ys => `C87,57 86,51.5 84,50.4 ${jag(84, 36, 49.6, 2.2, 10)}C34,51.5 33,57 33,${ys}`,
  comma:       ys => `C87,61.5 86.8,59.5 86,58 C85.4,61 83,63.4 80.5,62.6 C78.6,62 78.4,59.6 80,58.4 C76,55.6 70,52 62,50 C55,48.2 49.5,47 46.5,47.6 C40,49 35.5,53 34,57.4 C33.3,59.6 33,62 33,${ys}`,
  up:          ys => `C87,${Math.min(ys, 58)} 81,46 70,44.6 Q60,43 50,44.6 C39,46 33,${Math.min(ys, 58)} 33,${ys}`,
  slick:       ys => `C87,54 84,45 75,41.6 C69,39.6 64,40.4 60,40.4 C55,40.4 49,39.6 44,41.8 C36,45 33,54 33,${ys}`,
  curly:       ys => `C87,62 86.5,58 85,56.5 ${curls(85, 35, 56, 7)}C33.5,58 33,62 33,${ys}`,
};
// 가르마 자리 (x, 이마선 y) — 피부색 가는 틈
const PARTING = { none_center: [60, 41.4], none_side: [52, 41.2], curtain: [60, 42.4], side_swept: [52, 45.6] };
// 결 선 (최대 3개, 어둡게·옅게)
const FLOW = {
  none_center: ['M60,31 Q71,33 80,44', 'M60,31 Q49,33 40,44', 'M64,36 Q73,40 79,49'],
  none_side:   ['M52,31 Q68,31 81,42', 'M54,36 Q69,39 82,50', 'M50,32 Q42,34 37,42'],
  seethrough:  ['M60,31 Q72,32 81,43', 'M60,31 Q48,32 39,43', 'M48,40 Q60,36 72,40'],
  curtain:     ['M60,31 Q72,33 81,45', 'M60,31 Q48,33 39,45', 'M66,43 Q75,48 82,56'],
  side_swept:  ['M52,31 Q67,31 81,41', 'M54,38 Q68,41 80,51', 'M50,32 Q42,34 37,42'],
  full:        ['M47,39 Q46,48 45,55', 'M60,38 Q60,48 60,56', 'M73,39 Q74,48 75,55'],
  full_low:    ['M46,41 Q45,51 44,59', 'M60,40 Q60,51 60,60', 'M74,41 Q75,51 76,59'],
  short_crop:  ['M46,36 Q46,43 45,49', 'M58,35 Q58,42 58,49', 'M71,36 Q72,43 73,49'],
  comma:       ['M49,33 Q66,32 82,44', 'M50,39 Q66,40 80,54', 'M48,31 Q40,32 35.5,40'],
  up:          ['M44,33 Q60,26 76,33', 'M40,39 Q60,31 80,39', 'M49,41 Q60,37.6 71,41'],
  slick:       ['M45,42 Q49,32 58,27', 'M58,40.6 Q64,32 73,29', 'M70,41.4 Q78,36 84,42'],
  curly: [],
};
// 시스루뱅 가닥
const SEE2 = [[41.5, 47.6, 40.4, 53, 39.4, 57], [47, 45.8, 46, 52, 45.6, 58.4], [52.6, 45, 52.4, 52, 51.4, 59.4], [58.4, 44.6, 58.6, 52, 57.6, 59.8], [64.2, 44.8, 64.6, 52, 65.2, 59.6], [70, 45.4, 70.6, 52, 71.6, 58.8], [76, 46.6, 77, 52, 78.8, 57.6]];
// 스타일 — 여 18 / 남 14 (+ 나이별: 40대 이상 여자 짧은 펌, 아이 머리)
//   w 돔 반폭, ys 옆머리가 내려오는 높이, v 볼륨(두상보다 크게), crown 정수리 높이, back 뒷머리, side 옆머리, tie 묶음, wisps 잔머리 수, fronts [앞머리, 비중]
const HSTYLES = {
  f: [
    { id: 'long', label: '긴 생머리', w: 34, ys: 78, back: 'long', side: 'long', fronts: [['none_center', 3], ['none_side', 3], ['seethrough', 2.4], ['curtain', 2], ['side_swept', 1], ['full', .6]] },
    { id: 'wave', label: '긴 웨이브', w: 35.5, ys: 78, back: 'wavy', side: 'wavy', fronts: [['none_side', 3], ['none_center', 2], ['curtain', 2.5], ['seethrough', 2], ['full', .4]] },
    { id: 'hippie', label: '히피펌', w: 36.5, ys: 76, v: 1.08, back: 'hippie', side: 'hippie', fronts: [['none_center', 3], ['none_side', 2], ['curtain', 2], ['seethrough', 1]] },
    { id: 'hush', label: '허쉬컷', w: 35, ys: 78, back: 'layer', side: 'layer', fronts: [['seethrough', 3], ['curtain', 3], ['none_side', 2], ['side_swept', 1]] },
    { id: 'cbob', label: 'C컬 단발', w: 35, ys: 78, crown: 1, back: 'bob', side: 'bob', fronts: [['seethrough', 3], ['none_side', 2], ['none_center', 2], ['curtain', 1.5], ['full', .8]] },
    { id: 'bob', label: '일자 단발', w: 34.5, ys: 78, back: 'bobS', side: 'bobS', fronts: [['none_center', 2], ['none_side', 2], ['seethrough', 2], ['full', 1]] },
    { id: 'pixie', label: '숏컷', w: 33, ys: 68, side: 'pixie', fronts: [['side_swept', 3], ['seethrough', 1.5], ['none_side', 1.5], ['comma', 1]] },
    { id: 'wolf', label: '울프컷', w: 34.5, ys: 74, back: 'wolf', side: 'wolf', fronts: [['seethrough', 3], ['curtain', 2], ['none_center', 1]] },
    { id: 'hipony', label: '하이 포니테일', w: 32.5, ys: 70, crown: 2, tie: 'pony', wisps: 3, fronts: [['up', 2], ['seethrough', 2], ['none_center', 2], ['curtain', 1.5], ['none_side', 1]] },
    { id: 'lowpony', label: '로우 포니테일', w: 32.5, ys: 72, crown: 2, tie: 'lowFront', wisps: 3, fronts: [['none_center', 3], ['curtain', 2], ['none_side', 2], ['seethrough', 1]] },
    { id: 'half', label: '반묶음', w: 34, ys: 76, back: 'shoulder', side: 'shoulder', tie: 'half', fronts: [['none_side', 2], ['none_center', 2], ['seethrough', 2], ['curtain', 1.5]] },
    { id: 'hibun', label: '똥머리', w: 32.5, ys: 70, crown: 1, tie: 'high', wisps: 4, fronts: [['seethrough', 2], ['up', 2], ['curtain', 2], ['none_center', 1.5]] },
    { id: 'lowbun', label: '로우번', w: 32.5, ys: 72, crown: 2, tie: 'lowbun', wisps: 3, fronts: [['none_center', 3], ['none_side', 3], ['curtain', 1]] },
    { id: 'twin', label: '양갈래 땋기', w: 33, ys: 72, crown: 1, tie: 'twin', wisps: 2, fronts: [['none_center', 3], ['seethrough', 2], ['full', .8]] },
    { id: 'braid', label: '한 갈래 땋기', w: 33, ys: 72, crown: 1, tie: 'braid', wisps: 2, fronts: [['none_side', 2], ['seethrough', 2], ['curtain', 1.5], ['side_swept', 1]] },
    { id: 'curlS', label: '곱슬 숏', w: 36, ys: 72, v: 1.06, curly: true, side: 'curly', fronts: [['curly', 1]] },
    { id: 'curlL', label: '곱슬 롱', w: 37.5, ys: 78, v: 1.08, curly: true, back: 'curlLong', side: 'curly', fronts: [['curly', 2], ['none_center', 1]] },
    { id: 'tiedbob', label: '묶은 단발', w: 33, ys: 74, tie: 'stub', wisps: 3, side: 'short', fronts: [['seethrough', 2], ['none_side', 2], ['none_center', 1.5]] },
    // (뉴욕 등) 코일리·브레이드 — 끝에 붙여 예전 번호는 그대로
    { id: 'afro', label: '아프로', w: 42, ys: 78, v: 1.2, crown: 5, curly: true, coily: true, side: 'curly', fronts: [['curly', 1]] },
    { id: 'braids', label: '박스 브레이드', w: 35, ys: 78, back: 'long', side: 'long', braids: true, fronts: [['none_center', 3], ['none_side', 2]] },
    { id: 'puff', label: '하이 퍼프', w: 32.5, ys: 70, crown: 1, tie: 'puff', coily: true, wisps: 2, fronts: [['up', 2], ['none_center', 1]] },
  ],
  m: [
    { id: 'dandy', label: '댄디컷', w: 32, ys: 66, fronts: [['side_swept', 2], ['full', 1], ['seethrough', .6]] },
    { id: 'comma', label: '쉼표머리', w: 32, ys: 64, fronts: [['comma', 1]] },
    { id: 'p64', label: '가르마펌 6:4', w: 33.5, ys: 64, v: 1.07, fronts: [['none_side', 1]] },
    { id: 'p55', label: '가르마펌 5:5', w: 33.5, ys: 64, v: 1.07, fronts: [['none_center', 1]] },
    { id: 'regent', label: '리젠트', w: 31.5, ys: 60, crown: 2, quiff: true, fronts: [['up', 1]] },
    { id: 'pomade', label: '포마드 올백', w: 31, ys: 60, crown: 3, gloss: true, fronts: [['slick', 1]] },
    { id: 'twoblock', label: '투블럭', w: 31, ys: 57, crown: 2, block: true, fronts: [['side_swept', 1], ['comma', 1], ['up', 1]] },
    { id: 'crop', label: '크롭컷', w: 31, ys: 62, fronts: [['short_crop', 1]] },
    { id: 'buzz', label: '버즈컷', w: 29.5, ys: 62, buzz: true, fronts: [['up', 1]] },
    { id: 'ash', label: '애즈펌', w: 33.5, ys: 66, v: 1.05, fronts: [['curtain', 1], ['seethrough', 1]] },
    { id: 'wolf', label: '울프컷', w: 33.5, ys: 70, back: 'wolf', side: 'wolf', fronts: [['seethrough', 2], ['curtain', 1], ['none_center', 1]] },
    { id: 'curlS', label: '곱슬 숏', w: 34.5, ys: 66, v: 1.05, crown: 2, curly: true, fronts: [['curly', 1]] },
    { id: 'longtie', label: '장발 묶음', w: 32.5, ys: 70, tie: 'nape', wisps: 2, fronts: [['none_center', 1], ['none_side', 1]] },
    { id: 'cover', label: '덮은 머리', w: 33, ys: 70, fronts: [['full_low', 1]] },
    { id: 'afroM', label: '아프로', w: 37.5, ys: 66, v: 1.16, crown: 4, curly: true, coily: true, fronts: [['curly', 1]] },
    { id: 'cornrow', label: '콘로우', w: 30.5, ys: 60, crown: 1, rows: true, fronts: [['slick', 1]] },
    { id: 'fade', label: '하이 페이드', w: 30.5, ys: 56, crown: 2, block: true, fronts: [['short_crop', 1]] },
  ],
};
const HX = {   // 나이별 특수 스타일
  perm: { id: 'perm', label: '짧은 펌', w: 35.5, ys: 70, v: 1.1, crown: 2, curly: true, fronts: [['curly', 1]] },
  bowl: { id: 'bowl', label: '바가지', w: 34, ys: 70, v: 1.06, fronts: [['full', 1]] },
  kidboy: { id: 'kidboy', label: '짧은 남아컷', w: 32.5, ys: 66, v: 1.06, fronts: [['short_crop', 2], ['side_swept', 1]] },
  kidbob: { id: 'kidbob', label: '짧은 단발', w: 35, ys: 78, v: 1.06, back: 'bobS', side: 'bobS', fronts: [['full', 1.5], ['seethrough', 1], ['none_side', 1]] },
  pigtail: { id: 'pigtail', label: '양갈래', w: 33.5, ys: 72, v: 1.06, crown: 1, tie: 'pigtail', wisps: 2, fronts: [['full', 1], ['seethrough', 1], ['none_center', 1]] },
  kidpony: { id: 'kidpony', label: '포니테일', w: 33, ys: 70, v: 1.06, crown: 2, tie: 'pony', wisps: 2, fronts: [['full', 1], ['seethrough', 1], ['up', 1]] },
  kidlong: { id: 'kidlong', label: '긴 머리', w: 34.5, ys: 78, v: 1.06, back: 'long', side: 'long', fronts: [['full', 1], ['none_center', 1], ['seethrough', 1]] },
};
// 처음 고를 때 비중 (예전 일자 바가지 앞머리가 너무 많던 것 → 풀뱅은 10% 아래)
const HW = { f: [2, 1.5, .6, 1.2, 1.5, 1, .6, .5, .8, .8, 1, .7, .5, .2, .4, .3, .3, .6, .02, .02, .02], m: [2, 2, 1.5, 1, .6, .6, 1.5, 1.5, .5, 1, .6, .5, .3, 1, .02, .02, .15] };
// 예전 저장의 머리 번호 → 새 스타일 (hv 없음)
const OLD_HAIR = { f: [4, 3, 0, 9, 8, 10, 6, 1, 11, 14, 0, 3], m: [7, 8, 6, 13, 10, 12, 0, 5, 11, 10] };
const OLD_BANG = { straight: 'full', side: 'side_swept', center: 'none_center', up: 'up', see: 'seethrough', comma: 'comma', low: 'full_low', slick: 'slick', curly: 'curly' };
// 사람마다 머리 세부 (hair 시드): 앞머리, 좌우, 액세서리, 뿌리 염색 주기, M자 이마·정수리 숱, 40대 펌
function hairPlan(a, age) {
  const key = 'hair:' + (a.fs || [a.g, a.face, a.skin, a.hair, a.hc, a.eyes].join(',')), r = rng(key), g = a.g === 'f' ? 'f' : 'm';
  const roll = { front: r(), flip: r() < .5, acc: r(), accK: r(), root: r(), mline: r() < .25, thin: r() < .15, perm: r() < .3, wisp: r() };
  const idx = a.hv === 2 ? a.hair : (OLD_HAIR[g][a.hair] ?? 0);
  let st = HSTYLES[g][idx] || HSTYLES[g][0];
  const kid = age <= 12, teen = age >= 13 && age <= 18;
  if (kid) st = g === 'm' ? (age <= 4 ? HX.bowl : HX.kidboy)
    : HX[{ long: 'kidlong', wave: 'kidlong', hippie: 'kidlong', curlL: 'kidlong', hipony: 'kidpony', lowpony: 'kidpony', half: 'kidpony', hibun: 'kidpony', lowbun: 'kidpony', twin: 'pigtail', braid: 'pigtail' }[st.id] || 'kidbob'];
  else if (teen && g === 'm' && ['regent', 'pomade', 'longtie', 'wolf'].includes(st.id)) st = HSTYLES.m[{ regent: 7, pomade: 0, longtie: 13, wolf: 1 }[st.id]];   // 교복 입는 10대 남자: 올백·장발 묶음 없음
  else if (g === 'f' && age >= 42 && roll.perm && !['pixie', 'curlS', 'curlL'].includes(st.id)) st = HX.perm;   // 40대부터 여자 30%는 짧은 펌
  // 앞머리: 직접 고른 값(a.front) > 예전 저장의 앞머리 > 스타일 안에서 비중대로
  let front = a.front && st.fronts.some(f => f[0] === a.front) ? a.front : null;
  if (!front && a.hv !== 2) { const old = OLD_BANG[['up', 'straight', 'side', 'center', 'see', 'comma'][Math.floor(roll.front * 4)]]; if (st.fronts.some(f => f[0] === old)) front = old; }
  if (!front) { let t = roll.front * st.fronts.reduce((x, f) => x + f[1], 0); for (const f of st.fronts) { t -= f[1]; if (t <= 0) { front = f[0]; break; } } front = front || st.fronts[0][0]; }
  const male = g === 'm', older = age >= 40;
  return { st, front, flip: roll.flip, roll, mline: male && older && roll.mline && ['up', 'slick', 'short_crop', 'none_side', 'none_center'].includes(front), thin: male && older && roll.thin && !st.buzz };
}
// 흰머리 (2-4): 55살 무렵부터 머리색과 회색이 가닥으로 섞이고, 70대엔 대부분 백발 (회색 단색 금지). 0~1
const grayLevel = (a, age) => clamp((age - 52 - ((a.gray ?? .5) - .5) * 16) / 22, 0, 1);
// 동글동글한 곱슬 끝 (x1 → x2, 아래로 볼록한 반원 n개)
function curls(x1, x2, y, n) {
  let d = '';
  const dx = (x2 - x1) / n, r = Math.abs(dx) * .58;
  for (let i = 1; i <= n; i++) d += `A${f1(r)},${f1(r * 1.05)} 0 0 1 ${P(x1 + dx * i, y + (i % 2 ? -.8 : .5))} `;
  return d;
}
// 앞머리 끝: 아래로 둥글게 들쭉날쭉 (오른쪽 x1에서 왼쪽 x2로)
function scallop(x1, x2, y, h, n) {
  let d = '';
  for (let i = 1; i <= n; i++) { const xa = x1 + (x2 - x1) * (i - .5) / n, xb = x1 + (x2 - x1) * i / n; d += `Q${P(xa, y + h * (i % 2 ? 1 : .55))} ${P(xb, y)} `; }
  return d;
}
// 3차 곡선 위 점
const cAt = (p0, c1, c2, p3, t) => [0, 1].map(k => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * c1[k] + 3 * (1 - t) * t * t * c2[k] + t ** 3 * p3[k]);
// 끝이 가는 머리 가닥 (뿌리 b → 끝 t, c 조절점, w 뿌리 굵기)
function strandD(bx, by, cx, cy, tx, ty, w) {
  const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, px = -dy / l * w / 2, py = dx / l * w / 2;
  return `M${P(bx + px, by + py)} Q${P(cx + px * .5, cy + py * .5)} ${P(tx, ty)} Q${P(cx - px * .5, cy - py * .5)} ${P(bx - px, by - py)} Z`;
}
// 끝이 갈라지는 머리 끝 (오른쪽 xr에서 왼쪽 xl로)
function splitEnds(xr, xl, y, n) {
  let d = '';
  for (let i = 1; i <= n; i++) { const x = xr + (xl - xr) * i / n; d += `L${P(x - (xl - xr) / n / 2, y + (i % 2 ? 4.5 : 2))} L${P(x, y)} `; }
  return d;
}
// 물결치는 옆선 점들 (s 방향, y0~y1, 진폭 amp, 주기 per)
const waveSide = (s, x0, y0, y1, amp, per, grow) => { const pts = []; for (let y = y0; y <= y1 - 2; y += per / 2) pts.push([60 + s * (x0 + (y - y0) * grow + amp * Math.sin((y - y0) / per * Math.PI * 2)), y]); pts.push([60 + s * (x0 + (y1 - y0) * grow), y1]); return pts; };
// 뒷머리 (얼굴 뒤). L.sy 어깨선, L.chest 가슴 높이
function backHair(kind, w, L) {
  const dome = `M${f1(60 - w - 2)},64 C${f1(60 - w - 4)},38 42,23.5 60,23.5 C78,23.5 ${f1(60 + w + 4)},38 ${f1(60 + w + 2)},64`;
  if (kind === 'bob') return `${dome} L${f1(60 + w + 2.5)},95 C${f1(60 + w + 3)},104 ${f1(60 + w - 3)},108.5 ${f1(60 + w - 9)},104.5 L${f1(60 - w + 9)},104.5 C${f1(60 - w + 3)},108.5 ${f1(60 - w - 3)},104 ${f1(60 - w - 2.5)},95 Z`;   // C컬: 끝이 안쪽으로 말림
  if (kind === 'bobS') return `${dome} L${f1(60 + w + 2.4)},101 L${f1(60 + w + 1.6)},104.4 L${f1(60 - w - 1.6)},104.4 L${f1(60 - w - 2.4)},101 Z`;   // 일자: 턱선에서 직선
  if (kind === 'shoulder') { const yb = L.sy + 9; return `${dome} L${f1(60 + w + 5)},${f1(yb - 7)} Q${f1(60 + w + 7)},${f1(yb + 1)} ${f1(60 + w + 1)},${f1(yb)} ${splitEnds(60 + w + 1, 60 - w - 1, yb, 6)}Q${f1(60 - w - 7)},${f1(yb + 1)} ${f1(60 - w - 5)},${f1(yb - 7)} Z`; }
  if (kind === 'long') { const yb = L.chest + 24; return `${dome} C${f1(60 + w + 5)},90 ${f1(60 + w + 8)},${f1(yb - 30)} ${f1(60 + w + 7)},${f1(yb - 4)} ${splitEnds(60 + w + 7, 60 - w - 7, yb - 4, 9)}C${f1(60 - w - 8)},${f1(yb - 30)} ${f1(60 - w - 5)},90 ${f1(60 - w - 2)},64 Z`; }
  if (kind === 'wolf') { const yb = L.sy - 3; return `${dome} C${f1(60 + w + 3)},80 ${f1(60 + w + 5)},${f1(yb - 10)} ${f1(60 + w + 4)},${f1(yb - 2)} ${splitEnds(60 + w + 4, 60 - w - 4, yb - 2, 8)}C${f1(60 - w - 5)},${f1(yb - 10)} ${f1(60 - w - 3)},80 ${f1(60 - w - 2)},64 Z`; }   // 위 짧고 목뒤 길게
  if (kind === 'layer') {   // 허쉬컷: 어깨 길이, 층진 끝이 바깥으로 뻗침
    const yb = L.sy + 8, R = v => f1(60 + w + v), Lx = v => f1(60 - w - v);
    return `${dome} C${R(4)},80 ${R(5)},${f1(yb - 16)} ${R(5)},${f1(yb - 8)} Q${R(7)},${f1(yb - 1)} ${R(12)},${f1(yb - 4)} Q${R(8)},${f1(yb + 3)} ${R(1)},${f1(yb + 1)} ${splitEnds(60 + w + 1, 60 - w - 1, yb + 1, 6)}Q${Lx(8)},${f1(yb + 3)} ${Lx(12)},${f1(yb - 4)} Q${Lx(7)},${f1(yb - 1)} ${Lx(5)},${f1(yb - 8)} C${Lx(5)},${f1(yb - 16)} ${Lx(4)},80 ${Lx(2)},64 Z`;
  }
  if (kind === 'wavy' || kind === 'hippie' || kind === 'curlLong') {   // 긴 웨이브: 가슴 아래 S자 / 히피펌: 어깨~가슴 잔물결·볼륨 / 곱슬 롱: 크게 퍼짐
    const P0 = { wavy: [L.chest + 26, 3, 18, 2.6, .05], hippie: [L.chest + 8, 5, 8, 1.8, .14], curlLong: [L.chest + 14, 7, 9, 2.4, .2] }[kind];
    const [yb, x0, per, amp, grow] = P0, Rp = waveSide(1, w + x0, 64, yb - 4, amp, per, grow), Lp = waveSide(-1, w + x0, 64, yb - 4, amp, per, grow).reverse();
    return `${dome} L${P(...Rp[0])}${crThrough(Rp)} ${curls(Rp[Rp.length - 1][0], Lp[0][0], yb - 3, kind === 'wavy' ? 9 : 12)}L${P(...Lp[0])}${crThrough(Lp)} Z`;
  }
  return '';
}
// 옆머리 — 관자놀이에서 얼굴 옆(귀 앞)으로 내려와 어깨나 가슴 위로 떨어짐 (s: 왼쪽 -1 / 오른쪽 1). 귀 근처에서 바깥으로 1~2 부풂
function lock(kind, s, L) {
  const X = dx => f1(60 + s * dx), top = 58;
  if (kind === 'pixie') return `M${X(30)},${top} C${X(33.6)},66 ${X(33.6)},74 ${X(32.6)},82 L${X(30.4)},86.4 L${X(29.4)},80.4 C${X(28)},74 ${X(27.2)},66 ${X(26.8)},${top + 2} Z`;   // 숏컷: 귀 앞 짧은 구레나룻
  if (kind === 'short') return `M${X(30)},${top} C${X(35)},66 ${X(35.4)},76 ${X(33.6)},86 L${X(31.2)},90 L${X(29.8)},84 C${X(28)},76 ${X(27)},66 ${X(26.8)},${top + 3} Z`;   // 묶은 단발: 귀 옆으로 남은 짧은 가닥
  if (kind === 'hime') return `M${X(30)},${top} C${X(34.8)},66 ${X(35.2)},78 ${X(35.2)},97.4 L${X(27.2)},97.8 C${X(27)},84 ${X(26)},70 ${X(26.5)},${top + 4} Z`;
  if (kind === 'bobS') return `M${X(30)},${top} C${X(36)},70 ${X(36.4)},86 ${X(36)},103.6 L${X(27.6)},103.6 C${X(26.6)},88 ${X(26)},72 ${X(26.5)},${top + 4} Z`;   // 일자 단발: 턱선에서 직선
  if (kind === 'wavy' || kind === 'hippie' || kind === 'curly') {
    const yb = kind === 'wavy' ? L.chest + 8 : kind === 'hippie' ? L.sy + 10 : L.sy - 2, per = kind === 'wavy' ? 24 : 10, amp = kind === 'wavy' ? 2.6 : 1.8;
    const O = waveSide(s, 35.2, top + 4, yb, amp, per, .02).map(([x, y]) => [x, y]), I = waveSide(s, 27.4, top + 6, yb - 3, amp * .8, per, 0).reverse();
    return `M${X(30)},${top} L${P(...O[0])}${crThrough(O)} L${P(...I[0])}${crThrough(I)} Z`;
  }
  if (kind === 'layer') {   // 끝이 바깥으로 뻗침
    const yb = L.sy + 4;
    return `M${X(30)},${top} C${X(35.5)},74 ${X(35)},${f1(yb - 16)} ${X(34)},${f1(yb - 5)} Q${X(35.5)},${f1(yb)} ${X(39.5)},${f1(yb - 2.4)} Q${X(36)},${f1(yb + 3)} ${X(30)},${f1(yb + 1.6)} L${X(28.4)},${f1(yb - 1.6)} C${X(26)},${f1(yb - 12)} ${X(25)},74 ${X(26.5)},${top + 4} Z`;
  }
  const yb = f1(kind === 'bob' ? 103 : kind === 'shoulder' ? L.sy + 6 : kind === 'long' ? L.chest + 12 : kind === 'wolf' ? 97 : L.sy);
  const end = kind === 'bob'
    ? `C${X(33.5)},${f1(yb + 5)} ${X(28)},${f1(yb + 4.5)} ${X(25.5)},${f1(yb - 1)}`                       // C컬: 끝이 안쪽으로 말림
    : `L${X(31)},${f1(yb + 4)} L${X(29)},${yb} L${X(26.8)},${f1(yb + 3.4)} L${X(25.2)},${f1(yb - 2)}`;   // 끝이 갈라짐
  return `M${X(30)},${top} C${X(36.2)},${top + 14} ${X(35.6)},${f1(yb - 24)} ${X(34)},${yb} ${end} C${X(25.5)},${f1(yb - 22)} ${X(25)},${top + 22} ${X(26.5)},${top + 4} Z`;
}
// 땋은 머리: (x0,y0)에서 (x1,y1)로 내려옴. 굵기가 줄어드는 몸통 + 엇갈려 맞물리는 마디 선 + 마디마다 윤기 + 끈 + 끝 술
// 박스 브레이드 질감: x0~x1 사이 가는 땋은 가닥들 (갈매기 무늬 + 가닥 사이 어두운 틈)
function braidRows(x0, x1, y0, y1, hc) {
  const gap = 3.6, d = [], g = [];
  for (let x = x0; x <= x1; x += gap) {
    g.push(`M${f1(x + gap / 2)},${f1(y0)} L${f1(x + gap / 2 + .6)},${f1(y1)}`);
    for (let y = y0; y < y1; y += 2.6) d.push(`M${f1(x + .4)},${f1(y)} l${f1(gap / 2 - .4)},1.3 l${f1(gap / 2 - .4)},-1.3`);
  }
  return `<path d="${g.join(' ')}" stroke="${shade(hc, .45)}" stroke-width=".8" opacity=".55" fill="none"/><path d="${d.join(' ')}" stroke="${shade(hc, 1.35)}" stroke-width=".45" opacity=".45" fill="none"/>`;
}
function braidSVG(hc, x0, y0, x1, y1, w0, tieC) {
  const n = Math.max(4, Math.round((y1 - y0) / 6.6)), seg = (y1 - y0) / n;
  const at = t => [lerp(x0, x1, t * t), lerp(y0, y1, t)], wid = t => lerp(w0, w0 * .7, t);
  const body = taperD([[...at(0), wid(0)], [...at(.5), wid(.5)], [...at(1), wid(1)]], true);
  let d = '', hl = '';
  for (let i = 0; i < n; i++) {
    const ta = (i + .1) / n, [ax, ay] = at(ta), ha = wid(ta) / 2, tb = (i + .6) / n, [bx, by] = at(tb), hb = wid(tb) / 2;
    d += `M${P(ax - ha, ay)} Q${P(ax - ha * .1, ay + seg * .12)} ${P(ax + ha * .3, ay + seg * .62)} M${P(bx + hb, by)} Q${P(bx + hb * .1, by + seg * .12)} ${P(bx - hb * .3, by + seg * .62)} `;
    hl += `M${P(ax - ha * .62, ay + seg * .14)} q${f1(ha * .32)},${f1(seg * .1)} ${f1(ha * .62)},${f1(seg * .36)} `;
  }
  const [ex, ey] = at(1);
  return `<path d="${body}" fill="${hc}" stroke="${shade(hc, .55)}" stroke-width=".6"/><path d="${d}" fill="none" stroke="${shade(hc, .55)}" stroke-width=".9" stroke-linecap="round" opacity=".7"/>` +
    `<path d="${hl}" fill="none" stroke="${shade(hc, 1.18)}" stroke-width=".9" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M${f1(ex - 2.4)},${f1(ey)} C${f1(ex - 3.6)},${f1(ey + 5)} ${f1(ex - 1.8)},${f1(ey + 8.4)} ${f1(ex)},${f1(ey + 9.4)} C${f1(ex + 1.8)},${f1(ey + 8.4)} ${f1(ex + 3.6)},${f1(ey + 5)} ${f1(ex + 2.4)},${f1(ey)} Z" fill="${hc}" stroke="${shade(hc, .55)}" stroke-width=".5"/>` +
    `<rect x="${f1(ex - 2.8)}" y="${f1(ey - 1.6)}" width="5.6" height="2.6" rx="1.2" fill="${tieC}"/>`;
}
// 머리 액세서리 (2-7): 집게핀·똑딱핀·머리끈·곱창밴드·리본·헤어밴드·볼캡·비니(겨울)·헤어 스카프. NPC 20%가 하나 (계절·요일에 따라 바뀜)
const HACC = ['claw', 'snap', 'tie', 'scrunchie', 'ribbon', 'band', 'cap', 'beanie', 'scarf'];
const HACC_LABEL = { claw: '집게핀', snap: '똑딱핀', tie: '머리끈', scrunchie: '곱창밴드', ribbon: '리본', band: '헤어밴드', cap: '볼캡', beanie: '비니', scarf: '헤어 스카프' };
function hairAcc(a, X, st, plan, age, ctx) {
  if (age < 4) return null;
  let id = ctx && ctx.hat ? ctx.hat : a.hacc !== undefined ? a.hacc : null;
  if (id === null && a.hacc === undefined) {   // 예전 저장: 실핀(1)·머리띠(2)는 그대로, 새로 만든 사람은 20%
    if (X.pin === 1) id = 'snap'; else if (X.pin === 2) id = 'band';
    else if (plan.roll.acc < (a.g === 'f' ? .2 : .1)) {   // 여자 20%, 남자 10% (남자는 볼캡·비니만)
      const ok = HACC.filter(k => (k !== 'tie' && k !== 'scrunchie' || st.tie) && (k !== 'claw' || ['half', 'lowbun', 'high', 'stub'].includes(st.tie)) && (a.g === 'f' || ['cap', 'beanie'].includes(k)));
      const wt = k => k === 'cap' || k === 'beanie' ? (a.g === 'f' ? .5 : 1) : k === 'tie' || k === 'scrunchie' ? 1.6 : 1;
      let t = plan.roll.accK * ok.reduce((x, k) => x + wt(k), 0); for (const k of ok) { t -= wt(k); if (t <= 0) { id = k; break; } }
    }
  }
  if (!id) return null;
  if (ctx && ctx.noHat && (id === 'cap' || id === 'beanie' || id === 'scarf')) return null;   // 함께 밤·다음 날 아침엔 모자 없음
  if (id === 'beanie' && ctx && ctx.season && ctx.season !== 'winter') return null;   // 비니는 겨울
  if (id === 'cap' && ctx && ctx.weekend === false) return null;                      // 볼캡은 주말
  if (st.buzz && (id === 'snap' || id === 'claw' || id === 'band' || id === 'ribbon')) return null;
  return id;
}
function hairPieces(a, X, age, hc0, L, ctx) {
  const plan = hairPlan(a, age), st = plan.st, front = plan.front, g = a.g === 'f' ? 'f' : 'm';
  const gl = grayLevel(a, age), hc = gl > 0 ? mixC(hc0, '#d2cdc6', Math.pow(gl, 1.4) * .82) : hc0;
  const dark = shade(hc, .82), edge = shade(hc, .55), skin = SKIN[a.skin] || SKIN[1];
  const v = (st.v || 1.03) * (age <= 12 ? 1.03 : 1), w = st.w * v, ys = st.ys, top = 27 - (st.crown || 0) - (v - 1) * 34;
  const acc = hairAcc(a, X, st, plan, age, ctx), hat = acc === 'cap' || acc === 'beanie';
  const tieC = TOP_COLORS[(X.pinC + a.tc) % TOP_COLORS.length];
  let back = '', front2 = '', shadow = '', over = '';
  const OUT = `stroke="${edge}" stroke-width=".8" stroke-linejoin="round"`;
  // ── back: 묶음(정수리·반묶음·똥머리·꼬리), 뒷머리
  if (st.tie === 'high') back += `<circle cx="60" cy="${f1(top - 11)}" r="10.5" fill="${shade(hc, .92)}" ${OUT}/><path d="M52,${f1(top - 13.5)} Q57,${f1(top - 20)} 64.6,${f1(top - 17)} M51.4,${f1(top - 8.5)} Q56,${f1(top - 4)} 64,${f1(top - 6)} Q68.6,${f1(top - 8)} 68.4,${f1(top - 13)}" fill="none" stroke="${edge}" stroke-width="1" stroke-linecap="round" opacity=".45"/><path d="M53.6,${f1(top - 16)} Q58,${f1(top - 19.6)} 62.6,${f1(top - 18.6)}" fill="none" stroke="${shade(hc, 1.18)}" stroke-width="1.8" stroke-linecap="round"/>`;
  if (st.tie === 'half') back += `<circle cx="60" cy="${f1(top - 4)}" r="6.2" fill="${shade(hc, .9)}" ${OUT}/>`;
  if (st.tie === 'puff') {   // 하이 퍼프: 정수리 위 동그란 코일리 덩어리 (가장자리가 오돌토돌)
    const cy = top - 12, R = 13, n = 16;
    const pts = Array.from({ length: n }, (_, i) => { const a = i / n * 6.283; return [60 + Math.cos(a) * R, cy + Math.sin(a) * R * .86]; });
    back += `<path d="M${P(...pts[0])}${pts.slice(1).concat([pts[0]]).map(q => ` A2.9,2.9 0 0 1 ${P(...q)}`).join('')} Z" fill="${shade(hc, .95)}" ${OUT}/>` +
      `<path d="${Array.from({ length: 12 }, (_, i) => { const a = i * 2.39, rr = R * (.25 + (i % 4) * .17); return `M${f1(60 + Math.cos(a) * rr)},${f1(cy + Math.sin(a) * rr * .8)} a1.3,1.3 0 1 1 1.8,.8`; }).join(' ')}" fill="none" stroke="${shade(hc, .6)}" stroke-width=".8" opacity=".4"/>`;
  }
  if (st.tie === 'pony') back += `<path d="M77,36 C97,35 106,58 101,88 C99,98 96,104 92,100 L94,95 L90,96 C95,74 93,54 80,46 Z" fill="${dark}" ${OUT}/><path d="M86,42 Q99,58 96,90" fill="none" stroke="${shade(hc, 1.18)}" stroke-width="1.4" opacity=".7"/>`;
  if (st.tie === 'pigtail') for (const s of [-1, 1]) { const X0 = dx => f1(60 + s * dx); back += `<path d="M${X0(30)},70 C${X0(42)},74 ${X0(44)},92 ${X0(40)},106 C${X0(39)},110 ${X0(35)},110 ${X0(35)},106 C${X0(37)},94 ${X0(35)},82 ${X0(28)},76 Z" fill="${dark}" ${OUT}/>`; }
  if (st.tie === 'nape') back += `<path d="M80,84 C88,92 89,104 86,114 C85,117 82,117 82,114 C84,104 82,95 77,89 Z" fill="${dark}" ${OUT}/>`;   // 장발 묶음: 목덜미 꼬리가 옆으로 살짝
  if (st.tie === 'stub') back += `<path d="M82,86 C88,90 89,96 87,100 L84,99 C85,95 83,91 79,89 Z" fill="${dark}" ${OUT}/>`;   // 묶은 단발: 짧은 꽁지
  if (st.tie === 'lowbun') back += `<ellipse cx="${f1(60 + w * .78)}" cy="88" rx="5.6" ry="5" fill="${dark}" ${OUT}/>`;   // 로우번: 목덜미 번이 옆으로 살짝 보임
  if (st.back) {
    const bd = backHair(st.back, w, L);
    back += `<path d="${bd}" fill="${dark}" ${OUT}/>`;
    if (st.braids) { const bid = `av${UID}bb`; back += `<clipPath id="${bid}"><path d="${bd}"/></clipPath><g clip-path="url(#${bid})">${braidRows(60 - w - 6, 60 + w + 6, 56, L.sy + 46, hc)}</g>`; }   // 박스 브레이드: 가는 땋은 가닥이 나란히
  }
  else {   // 짧은 머리·묶은 머리: 귀 뒤로 내려가는 뒤통수 (옆이 수평으로 잘린 헬멧처럼 보이지 않게)
    const bw = w - .6, nb = st.buzz ? 88 : 94;
    back += `<path d="M${f1(60 - bw)},${f1(ys - 6)} C${f1(60 - bw - .4)},${f1(ys + 10)} ${f1(60 - bw * .8)},${f1(nb - 6)} ${f1(60 - bw * .56)},${nb} L${f1(60 + bw * .56)},${nb} C${f1(60 + bw * .8)},${f1(nb - 6)} ${f1(60 + bw + .4)},${f1(ys + 10)} ${f1(60 + bw)},${f1(ys - 6)} Z" fill="${st.buzz ? shade(hc, .9) : dark}"${st.buzz ? ' opacity=".55"' : ` ${OUT}`}/>`;
  }
  if (st.back && !['bob', 'bobS', 'wolf'].includes(st.back)) back += `<path d="M${f1(60 - w + 1)},70 Q${f1(60 - w - 3)},${f1(L.sy)} ${f1(60 - w + 1)},${f1(L.sy + 30)} M${f1(60 + w - 1)},70 Q${f1(60 + w + 3)},${f1(L.sy)} ${f1(60 + w - 1)},${f1(L.sy + 30)}" fill="none" stroke="${edge}" stroke-width="1" opacity=".25"/>`;
  // ── top + front: 돔(두상 + 볼륨, 귀 근처에서 바깥으로 부풂) + 앞머리 아래 선
  let F = '';
  if (st.block) F += `<path d="M29.5,52 L35.5,49.5 L35,72 L30.5,70 Z M90.5,52 L84.5,49.5 L85,72 L89.5,70 Z" fill="${hc}" opacity=".38"/>`;
  const pf = 1.4 * (v - .98) / .1;   // 귀 근처 옆 볼륨
  let domeD = `M${f1(60 - w)},${ys} C${f1(60 - w - 1.5 - pf)},${f1(top + 22)} ${f1(60 - w * .62)},${f1(top)} 60,${f1(top)} C${f1(60 + w * .62)},${f1(top)} ${f1(60 + w + 1.5 + pf)},${f1(top + 22)} ${f1(60 + w)},${ys}`;
  if (st.curly) {   // 곱슬: 윤곽이 동글동글
    const dl = [60 - w, ys], dc1 = [60 - w - 1.5 - pf, top + 22], dc2 = [60 - w * .62, top], dt = [60, top], pts = [];
    const ns = st.coily ? 10 : 6;   // 코일리: 더 잘고 촘촘하게
    for (let i = 0; i <= ns; i++) pts.push(cAt(dl, dc1, dc2, dt, i / ns));
    for (let i = ns - 1; i >= 0; i--) { const q = cAt(dl, dc1, dc2, dt, i / ns); pts.push([120 - q[0], q[1]]); }
    domeD = `M${P(...pts[0])}` + pts.slice(1).map((q, i) => { const p0 = pts[i], r = Math.hypot(q[0] - p0[0], q[1] - p0[1]) * .6; return ` A${f1(r)},${f1(r)} 0 0 1 ${P(...q)}`; }).join('');
  }
  const frontEdge = (FRONTS[front === 'up' && st.gloss ? 'slick' : front] || FRONTS.up)(ys);
  const mainD = `${domeD} L87,${ys} ${frontEdge} L${f1(60 - w)},${ys} Z`, hid = `av${UID}h`;
  F += `<path d="${mainD}" fill="${hc}"${st.buzz ? ' opacity=".62"' : ` ${OUT}`}/>`;
  if (st.buzz) F += `<path d="${mainD}" fill="none" stroke="${hc}" stroke-width="1.6" stroke-dasharray=".6 1.2" opacity=".5"/>`;   // 버즈컷: 두피가 비치는 짧은 머리 + 가장자리 까슬함
  if (!st.buzz) {
    shadow += mainD;
    F += `<clipPath id="${hid}"><path d="${mainD}"/></clipPath><g clip-path="url(#${hid})">`;
    // 결 선 (최대 3개, 어둡고 옅게)
    if (LOD >= 2 && FLOW[front] && FLOW[front].length) F += `<path d="${FLOW[front].slice(0, 3).join(' ')}" fill="none" stroke="${shade(hc, .62)}" stroke-width=".8" stroke-linecap="round" opacity=".35"/>`;
    // 하이라이트: 좌상단, 두상 곡선을 따라 휘는 짧은 호 2~3개 (서로 끊어짐)
    const hl = shade(hc, 1.18), T0 = top;
    F += `<path d="M${f1(60 - w * .7)},${f1(T0 + 15)} Q${f1(60 - w * .58)},${f1(T0 + 7.4)} ${f1(60 - w * .36)},${f1(T0 + 3.6)} M${f1(60 - w * .24)},${f1(T0 + 2.2)} Q${f1(60 - w * .1)},${f1(T0 + 1.2)} ${f1(60 + w * .06)},${f1(T0 + 1.4)}` +
      (st.gloss || v >= 1.05 ? ` M${f1(60 - w * .82)},${f1(T0 + 24)} Q${f1(60 - w * .8)},${f1(T0 + 20)} ${f1(60 - w * .74)},${f1(T0 + 17.6)}` : '') + `" fill="none" stroke="${hl}" stroke-width="${st.gloss ? 2.4 : 1.9}" stroke-linecap="round" opacity="${st.gloss ? 1 : .9}"/>`;
    // 곱슬 질감
    if (st.curly && !st.coily) F += `<path d="${[[44, 36], [54, 31.5], [66, 32], [76, 37], [40, 46], [50, 41.6], [62, 40.6], [72, 43.6], [81, 49]].map(([x, y]) => `M${x},${f1(y + top - 27)} a2.4,2.4 0 1 1 3.4,1.4`).join(' ')}" fill="none" stroke="${shade(hc, .6)}" stroke-width="1" stroke-linecap="round" opacity=".35"/>`;
    if (st.coily) {   // 코일리 질감: 작은 고리가 촘촘히 (가장자리 쪽은 옅게)
      const cr = rng('coil' + plan.roll.wisp);
      F += `<path d="${Array.from({ length: 34 }, () => { const x = 60 + (cr() * 2 - 1) * w * .92, y = top + 2 + cr() * (ys - top - 4); return `M${f1(x)},${f1(y)} a1.25,1.25 0 1 1 1.7,.7`; }).join(' ')}" fill="none" stroke="${shade(hc, .55)}" stroke-width=".75" stroke-linecap="round" opacity=".4"/>` +
        `<path d="${Array.from({ length: 14 }, () => { const x = 60 + (cr() * 2 - 1) * w * .8, y = top + 2 + cr() * (ys - top - 8); return `M${f1(x)},${f1(y)} a1,1 0 1 1 1.4,.6`; }).join(' ')}" fill="none" stroke="${shade(hc, 1.35)}" stroke-width=".55" stroke-linecap="round" opacity=".35"/>`;
    }
    if (st.rows) {   // 콘로우: 이마선에서 정수리로 나란히 땋은 줄 + 줄 사이 두피
      const rw = [-15, -9, -3, 3, 9, 15];
      F += `<path d="${rw.map(dx => `M${f1(60 + dx * .62)},${f1(ys - 9)} Q${f1(60 + dx * .95)},${f1(top + 10)} ${f1(60 + dx * 1.1)},${f1(top - 2)}`).join(' ')}" fill="none" stroke="${skin}" stroke-width=".9" opacity=".55"/>` +
        `<path d="${rw.slice(0, 5).map(dx => `M${f1(60 + (dx + 3) * .62)},${f1(ys - 9)} Q${f1(60 + (dx + 3) * .95)},${f1(top + 10)} ${f1(60 + (dx + 3) * 1.1)},${f1(top - 2)}`).join(' ')}" fill="none" stroke="${shade(hc, 1.3)}" stroke-width="1.6" stroke-dasharray="1.4 1.1" opacity=".55"/>`;
    }
    // 뿌리 염색 (2-5): 염색한 사람은 가르마·정수리 둘레가 원래 머리색. 시간이 지나면 넓어짐
    const nat = a.hcN != null ? HAIR[a.hcN] : null;
    if (nat && DYED.has(a.hc) && age >= 15 && gl < .3) {
      const rw = 1 + ((age * 7 + Math.floor(plan.roll.root * 40)) % 10) / 10 * 1.6, pt = PARTING[front];   // 양쪽으로 1~2.6 (2~3단위에서 점점 넓어짐)
      const d = pt ? `M${pt[0]},${f1(top + 1)} Q${f1(pt[0] + .4)},${f1((top + pt[1]) / 2)} ${pt[0]},${f1(pt[1] - 1)}` : `M${f1(60 - w * .6)},${f1(top + 6)} Q60,${f1(top - 5.4)} ${f1(60 + w * .6)},${f1(top + 6)}`;   // 가르마 없으면 정수리 윗선
      F += `<path d="${d}" fill="none" stroke="${nat}" stroke-width="${f1(rw * 2)}" stroke-linecap="round" opacity=".35"/><path d="${d}" fill="none" stroke="${nat}" stroke-width="${f1(rw * 1.1)}" stroke-linecap="round" opacity=".8"/>`;
    }
    // 흰머리 가닥 (머리색과 섞임), 70대 이상은 원래 색 가닥이 조금 남음
    if (gl > .02) F += grayStrands(w, top, ys, gl, hc0, plan.roll.wisp);
    // 정수리 숱 감소 (40대 이상 남자 15%)
    if (plan.thin) F += `<ellipse cx="60" cy="${f1(top + 4.5)}" rx="${f1(w * .42)}" ry="4.6" fill="${skin}" opacity=".42"/><path d="M53,${f1(top + 3)} q2,3 1.4,6 M60,${f1(top + 2)} q.6,3.4 0,6.6 M67,${f1(top + 3)} q-2,3 -1.4,6" fill="none" stroke="${shade(hc, .7)}" stroke-width=".6" opacity=".6"/>`;
    F += '</g>';
    // 가르마: 피부색 가는 틈 (가르마가 있는 앞머리만)
    const pt = PARTING[front];
    if (pt) F += `<path d="M${pt[0]},${f1(top + 3)} Q${f1(pt[0] + .5)},${f1((top + pt[1]) / 2 + 1)} ${pt[0]},${f1(pt[1] - .2)}" fill="none" stroke="${skin}" stroke-width="1" stroke-linecap="round" opacity=".85"/>`;
  }
  // M자 이마 (40대 이상 남자 25%): 관자놀이 쪽 이마선이 올라감
  if (plan.mline) F += `<path d="M36.4,55 C37.6,48.4 42,45.4 47.6,44.4 C46.4,48.6 44,52.6 40,55.6 Z M83.6,55 C82.4,48.4 78,45.4 72.4,44.4 C73.6,48.6 76,52.6 80,55.6 Z" fill="${skin}"/>`;
  if (st.quiff && !hat) F += `<path d="M45.6,45.4 C45.4,38.6 51.6,33.4 60,32.8 C68.4,32.4 75.4,35.4 77.4,41 C72.4,38.8 66.4,38.2 60.4,38.8 C53.6,39.6 48.8,41.8 45.6,45.4 Z" fill="${shade(hc, 1.04)}" stroke="${edge}" stroke-width=".6"/><path d="M50,38.4 Q55,34.6 62,34.4" fill="none" stroke="${shade(hc, 1.18)}" stroke-width="1.6" stroke-linecap="round"/>`;   // 리젠트: 앞머리를 올려 넘긴 볼륨
  if (front === 'seethrough') { const sd = SEE2.map(q => strandD(...q, 3.2)).join(' '); F += `<path d="${sd}" fill="${hc}" stroke="${shade(hc, .78)}" stroke-width=".35"/>`; shadow += ' ' + sd; }
  if (!st.side && !st.buzz && (g === 'm' || st.id === 'perm' || st.id === 'curlS')) {
    const bd = [-1, 1].map(s => { const X0 = dx => f1(60 + s * dx); return `M${X0(30.6)},${f1(ys - 3)} C${X0(30.2)},${f1(ys + 3)} ${X0(29.6)},${f1(ys + 8)} ${X0(28.6)},${f1(ys + 12)} C${X0(27.2)},${f1(ys + 9)} ${X0(26.4)},${f1(ys + 4)} ${X0(26.6)},${f1(ys - 2)} Z`; }).join(' ');
    F += `<path d="${bd}" fill="${hc}"/>`;   // 구레나룻: 귀 앞으로 가늘게
  }
  if (st.side) {
    const ld = `${lock(st.side, -1, L)} ${lock(st.side, 1, L)}`;
    F += `<path d="${ld}" fill="${hc}" ${OUT}/>` + (st.braids ? (() => { const sid = `av${UID}sb`; return `<clipPath id="${sid}"><path d="${ld}"/></clipPath><g clip-path="url(#${sid})">${braidRows(18, 102, 60, L.sy + 40, hc)}</g>`; })()
      : ['pixie', 'short'].includes(st.side) ? '' : `<path d="M29.4,68 Q27.4,84 29.8,98 M90.6,68 Q92.6,84 90.2,98" fill="none" stroke="${shade(hc, 1.18)}" stroke-width="1.2" opacity=".6"/>`);
    shadow += ' ' + ld;
  }
  // 잔머리 (이마선·귀 옆, 묶은 머리일수록 많이)
  const nw = st.wisps || (st.buzz ? 0 : 1);
  if (nw) {
    const W2 = [[33.4, 57, -3.2, 6, -1.4, 13], [86.6, 57, 3.2, 6, 1.4, 13], [46, 45.4, -1.6, 3.4, -2.6, 7], [74, 45.6, 1.8, 3.2, 2.4, 7.4]].slice(0, Math.min(4, nw + (plan.roll.wisp < .5 ? 0 : 1)));
    F += `<path d="${W2.map(([x, y, cx, cy, dx, dy]) => `M${x},${y} q${cx},${cy} ${dx},${dy}`).join(' ')}" fill="none" stroke="${hc}" stroke-width=".9" stroke-linecap="round" opacity=".6"/>`;
  }
  // 묶음 앞 (땋은 머리·양갈래·앞으로 넘긴 꼬리) — 몸 앞으로 내려옴
  if (st.tie === 'braid') F += braidSVG(hc, 34.6, 79, 40.6, L.chest + 12, 8.8, tieC);
  if (st.tie === 'twin') F += braidSVG(hc, 32.4, 78, 36, L.chest + 4, 7.4, tieC) + braidSVG(hc, 87.6, 78, 84, L.chest + 4, 7.4, tieC);
  if (st.tie === 'lowFront') F += `<path d="M84,74 C92,86 94,104 90,${f1(L.chest + 4)} C89,${f1(L.chest + 9)} 84,${f1(L.chest + 9)} 83.6,${f1(L.chest + 4)} C86,104 85,90 79,80 Z" fill="${hc}" ${OUT}/><path d="M86,86 Q90,100 88,${f1(L.chest)}" fill="none" stroke="${shade(hc, 1.18)}" stroke-width="1.3" opacity=".7"/><rect x="83" y="80.4" width="7.6" height="3.2" rx="1.5" transform="rotate(-24 86.8 82)" fill="${tieC}"/>`;   // 로우 포니테일: 목덜미에서 묶어 어깨 앞으로
  if (st.tie === 'pigtail') F += `<circle cx="31" cy="72" r="2.4" fill="${tieC}"/><circle cx="89" cy="72" r="2.4" fill="${tieC}"/>`;
  if (st.tie === 'pony' && acc !== 'scrunchie' && acc !== 'ribbon') F += `<circle cx="82" cy="40" r="2.4" fill="${acc === 'tie' ? tieC : shade(hc, .55)}"/>`;
  if (st.tie === 'half') F += `<path d="M54.5,${f1(top + .5)} Q60,${f1(top + 2.6)} 65.5,${f1(top + .5)}" fill="none" stroke="${shade(hc, .55)}" stroke-width="1.8"/>`;
  // 액세서리
  if (acc) F += accSVG(acc, st, w, top, ys, tieC, hc, X);
  // 앞쪽 레이어는 사람마다 좌우 뒤집음 (가르마·흐름·땋은 쪽)
  const flip = plan.flip && !st.quiff;
  if (flip) F = `<g transform="translate(120,0) scale(-1,1)">${F}</g>`;
  if (hat) over = hatSVG(acc, w, top, ys, tieC, X);
  return { back, front: F + over, shadow: st.buzz || hat ? '' : shadow, shadowT: flip ? 'translate(120,0) scale(-1,1)' : '', style: st.id, frontId: front, acc };
}
// 흰머리 가닥: 돔 안에서 정수리에서 바깥으로 흐르는 가는 선. gl 0~1
function grayStrands(w, top, ys, gl, hc0, seed) {
  const n = Math.round(5 + gl * 18), r = rng('gray' + seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, x0 = 60 + u * w * .35, y0 = top + 2 + r() * 4, x1 = 60 + u * (w + 2), y1 = ys - r() * 10, cx = 60 + u * w * .9, cy = top + 6;
    d += `M${P(x0, y0)} Q${P(cx, cy)} ${P(x1, y1)} `;
  }
  let o = `<path d="${d}" fill="none" stroke="#ece9e4" stroke-width=".7" stroke-linecap="round" opacity="${f1(.35 + gl * .4)}"/>`;
  if (gl > .6) { let d2 = ''; for (let i = 0; i < 5; i++) { const u = r() * 2 - 1; d2 += `M${P(60 + u * w * .3, top + 3)} Q${P(60 + u * w * .9, top + 7)} ${P(60 + u * (w + 1), ys - 6)} `; } o += `<path d="${d2}" fill="none" stroke="${shade(hc0, .9)}" stroke-width=".6" opacity=".5"/>`; }
  return o;
}
// 머리 액세서리 그림 (모자 제외)
function accSVG(id, st, w, top, ys, c, hc, X) {
  const m = METAL[X.metal] || METAL[0];
  if (id === 'snap') return `<path d="M73.6,44.4 L81.8,48.4" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/><circle cx="80.6" cy="47.8" r=".7" fill="#fff" opacity=".7"/>`;   // 똑딱핀
  if (id === 'band') return `<path d="M${f1(60 - w + 1)},${f1(Math.min(ys - 10, 60))} C${f1(60 - w * .74)},${f1(top + 3)} ${f1(60 + w * .74)},${f1(top + 3)} ${f1(60 + w - 1)},${f1(Math.min(ys - 10, 60))}" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"/><path d="M${f1(60 - w * .6)},${f1(top + 9)} Q60,${f1(top + 3.2)} ${f1(60 + w * .6)},${f1(top + 9)}" fill="none" stroke="#fff" stroke-width=".9" opacity=".3"/>`;
  if (id === 'scarf') return `<path d="M${f1(60 - w + .5)},${f1(Math.min(ys - 8, 58))} C${f1(60 - w * .7)},${f1(top + 5)} ${f1(60 + w * .7)},${f1(top + 5)} ${f1(60 + w - .5)},${f1(Math.min(ys - 8, 58))} L${f1(60 + w - 1)},${f1(Math.min(ys - 3, 63))} C${f1(60 + w * .7)},${f1(top + 10)} ${f1(60 - w * .7)},${f1(top + 10)} ${f1(60 - w + 1)},${f1(Math.min(ys - 3, 63))} Z" fill="${c}" stroke="${shade(c, .65)}" stroke-width=".6"/>` +
    `<path d="M${f1(60 - w * .5)},${f1(top + 8)} l1.2,1.2 M${f1(60 - w * .1)},${f1(top + 6.4)} l1.2,1.2 M${f1(60 + w * .3)},${f1(top + 7)} l1.2,1.2" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".7"/>` +
    `<path d="M${f1(60 + w - 1)},${f1(Math.min(ys - 6, 60))} l6,3 l-3,4 Z M${f1(60 + w - 1)},${f1(Math.min(ys - 6, 60))} l4,-2 l1,5 Z" fill="${shade(c, .9)}"/>`;
  if (id === 'claw') return `<g transform="translate(60,${f1(top - 1)})"><rect x="-6" y="-2.6" width="12" height="4.4" rx="2" fill="${c}" opacity=".95"/><path d="M-4.4,1.6 v2.4 M-1.5,1.6 v2.8 M1.5,1.6 v2.8 M4.4,1.6 v2.4" stroke="${shade(c, .7)}" stroke-width="1.2" stroke-linecap="round"/><path d="M-4,-1.4 h7" stroke="#fff" stroke-width=".8" opacity=".45"/></g>`;   // 집게핀 (정수리 뒤)
  const tieAt = st.tie === 'pony' ? [82, 40] : st.tie === 'high' ? [60, top - 1.2] : st.tie === 'half' ? [60, top + 1] : st.tie === 'lowFront' ? [86.8, 82] : st.tie === 'stub' ? [84, 88] : st.tie === 'pigtail' ? [89, 72] : [82, 40];
  if (id === 'scrunchie') return `<ellipse cx="${tieAt[0]}" cy="${tieAt[1]}" rx="4.4" ry="3.4" fill="${c}" stroke="${shade(c, .7)}" stroke-width=".6"/><path d="M${tieAt[0] - 3},${tieAt[1] - 1} q1.5,1.6 3,0 q1.5,1.6 3,0" fill="none" stroke="${shade(c, .7)}" stroke-width=".7" opacity=".7"/>`;
  if (id === 'ribbon') return `<g transform="translate(${tieAt[0]},${tieAt[1]})"><path d="M0,0 l-6,-4 l0,8 Z M0,0 l6,-4 l0,8 Z M0,0 l-3,7 M0,0 l3.4,7" fill="${c}" stroke="${shade(c, .7)}" stroke-width=".8"/><circle r="1.8" fill="${shade(c, .85)}"/></g>`;
  if (id === 'tie') return `<circle cx="${tieAt[0]}" cy="${tieAt[1]}" r="2.4" fill="${c}"/>`;
  return '';
}
// 모자: 볼캡(챙이 이마 위) / 비니(골지 단) — 앞머리 위를 덮음
function hatSVG(id, w, top, ys, c, X) {
  if (id === 'cap') {
    const by = 47.5;
    return `<path d="M${f1(60 - w - 1)},${f1(by + 2)} C${f1(60 - w - 2)},${f1(top + 8)} ${f1(60 - w * .5)},${f1(top - 2)} 60,${f1(top - 2)} C${f1(60 + w * .5)},${f1(top - 2)} ${f1(60 + w + 2)},${f1(top + 8)} ${f1(60 + w + 1)},${f1(by + 2)} Z" fill="${c}" stroke="${shade(c, .6)}" stroke-width=".8"/>` +
      `<path d="M60,${f1(top - 1.6)} L60,${f1(by)} M${f1(60 - w * .45)},${f1(top + 4)} Q${f1(60 - w * .3)},${f1(by - 8)} ${f1(60 - w * .32)},${f1(by + 1)} M${f1(60 + w * .45)},${f1(top + 4)} Q${f1(60 + w * .3)},${f1(by - 8)} ${f1(60 + w * .32)},${f1(by + 1)}" fill="none" stroke="${shade(c, .7)}" stroke-width=".7" opacity=".7"/>` +
      `<path d="M${f1(60 - w * .82)},${f1(by + 1)} Q60,${f1(by - 2)} ${f1(60 + w * .82)},${f1(by + 1)} Q60,${f1(by + 7.6)} ${f1(60 - w * .82)},${f1(by + 1)} Z" fill="${shade(c, .85)}" stroke="${shade(c, .55)}" stroke-width=".8"/><circle cx="60" cy="${f1(top - 1.4)}" r="1.4" fill="${shade(c, .7)}"/>`;
  }
  const by = 50, cuff = 7;   // 비니
  let ribs = '';
  for (let x = 60 - w + 2; x < 60 + w - 1; x += 3) ribs += `M${f1(x)},${f1(by - cuff + 1)} L${f1(x)},${f1(by - .5)} `;
  return `<path d="M${f1(60 - w - 1.4)},${f1(by)} C${f1(60 - w - 2)},${f1(top + 4)} ${f1(60 - w * .5)},${f1(top - 5)} 60,${f1(top - 5)} C${f1(60 + w * .5)},${f1(top - 5)} ${f1(60 + w + 2)},${f1(top + 4)} ${f1(60 + w + 1.4)},${f1(by)} Z" fill="${c}" stroke="${shade(c, .6)}" stroke-width=".8"/>` +
    `<path d="M${f1(60 - w - 1.6)},${f1(by - cuff)} Q60,${f1(by - cuff - 3)} ${f1(60 + w + 1.6)},${f1(by - cuff)} L${f1(60 + w + 1.6)},${f1(by)} Q60,${f1(by - 3)} ${f1(60 - w - 1.6)},${f1(by)} Z" fill="${shade(c, .88)}" stroke="${shade(c, .6)}" stroke-width=".7"/><path d="${ribs}" stroke="${shade(c, .7)}" stroke-width=".8" opacity=".6"/>`;
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
// 신발 (정면, 발목 x·y가 기준, s 바깥쪽 방향, w 발 반폭) — 운동화·러닝화·로퍼·구두·힐·앵클부츠·롱부츠·슬리퍼·샌들·어그·장화
//   부츠의 목(종아리까지 올라오는 부분)은 lowerFull이 다리 윤곽을 따라 따로 그림
function shoe(type, x, y, s, w, skin, c) {
  const X = dx => f1(x + s * dx), Y = dy => f1(y + dy);
  const body_ = `M${X(-w - 2.6)},${Y(1)} Q${X(-w - 3.8)},${Y(8)} ${X(-w)},${Y(9)} L${X(w + 2.6)},${Y(9)} Q${X(w + 6)},${Y(8.6)} ${X(w + 4.8)},${Y(3)} Q${X(w + 1.4)},${Y(-1.8)} ${f1(x)},${Y(-2)} Q${X(-w - 1)},${Y(-1.8)} ${X(-w - 2.6)},${Y(1)} Z`;
  if (type === 'heel') {   // 뾰족한 앞코 + 굽, 발등이 보임
    return `<path d="M${X(-3.4)},${Y(-1)} Q${f1(x)},${Y(1.6)} ${X(3.6)},${Y(-1)} L${X(3.4)},${Y(2.6)} Q${f1(x)},${Y(4)} ${X(-3.2)},${Y(2.6)} Z" fill="${skin}"/>
      <path d="M${X(2.4)},${Y(5)} l${f1(s * 1.5)},0 l${f1(-s * .2)},5.4 l${f1(-s * 1)},0 Z" fill="${shade(c, .7)}"/>
      <path d="M${X(-4.8)},${Y(1.6)} Q${f1(x)},${Y(5)} ${X(4.8)},${Y(1.6)} L${X(3.4)},${Y(8.4)} Q${f1(x)},${Y(11.4)} ${X(-3.4)},${Y(8.4)} Z" fill="${c}"/>
      <path d="M${X(-1.6)},${Y(4.6)} q1.4,1.2 3,0" fill="none" stroke="#fff" stroke-width=".9" opacity=".35"/>`;
  }
  if (type === 'slipper') return `<ellipse cx="${f1(x)}" cy="${Y(6.4)}" rx="${f1(w + 2.4)}" ry="2.6" fill="${skin}"/>
    <path d="M${X(-w - 4)},${Y(6.4)} Q${f1(x)},${Y(11.6)} ${X(w + 4)},${Y(6.4)} L${X(w + 4)},${Y(8.6)} Q${f1(x)},${Y(12.6)} ${X(-w - 4)},${Y(8.6)} Z" fill="${shade(c, .8)}"/>
    <path d="M${X(-w - 2.6)},${Y(5.2)} Q${f1(x)},${Y(2.2)} ${X(w + 2.6)},${Y(5.2)} L${X(w + 3)},${Y(8)} Q${f1(x)},${Y(5.4)} ${X(-w - 3)},${Y(8)} Z" fill="${c}"/>`;
  if (type === 'sandal') return `<path d="${body_}" fill="${skin}"/><path d="M${X(-w - 3.2)},${Y(7.6)} Q${f1(x)},${Y(10.6)} ${X(w + 5.4)},${Y(7.6)} L${X(w + 5)},${Y(9.6)} Q${f1(x)},${Y(11.8)} ${X(-w - 3)},${Y(9.6)} Z" fill="${shade(c, .75)}"/>
    <path d="M${X(-w - 2)},${Y(2.4)} L${X(w + 4)},${Y(2.4)} M${X(-w - 2.6)},${Y(6)} L${X(w + 4.8)},${Y(6)}" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/>`;
  if (type === 'loafer' || type === 'dress' || type === 'ankleboot' || type === 'longboot') {
    const pointy = type === 'dress';
    return `<path d="${body_}" fill="${c}"/><path d="M${X(-w - 2.6)},${Y(8)} Q${f1(x)},${Y(10.4)} ${X(w + 4.6)},${Y(8)}" fill="none" stroke="${shade(c, .55)}" stroke-width="1.4"/>
      <path d="M${X(-1.4)},${Y(2)} q2.4,-1.2 4.6,.4" fill="none" stroke="#fff" stroke-width="1" opacity="${pointy ? .4 : .25}"/>` + (type === 'loafer' ? `<path d="M${X(-2.6)},${Y(1)} L${X(3.4)},${Y(1)}" stroke="${shade(c, .6)}" stroke-width="1"/>` : pointy ? `<path d="M${X(-1)},${Y(-.6)} L${X(2.4)},${Y(-.6)}" stroke="${shade(c, .6)}" stroke-width=".8"/>` : '');
  }
  if (type === 'ugg' || type === 'rainboot') return `<path d="${body_}" fill="${c}"/><path d="M${X(-w - 3)},${Y(8.2)} Q${f1(x)},${Y(10.6)} ${X(w + 5)},${Y(8.2)}" fill="none" stroke="${shade(c, .65)}" stroke-width="1.6"/>` + (type === 'rainboot' ? `<path d="M${X(-.6)},${Y(1.6)} q2.4,-1.4 4.6,.4" fill="none" stroke="#fff" stroke-width="1.2" opacity=".55"/>` : '');
  const light = c === '#f2efe9' || c === '#eceae6' || c === '#e2e4ea' || c === '#c9c7c2';   // 운동화·러닝화: 밑창 + 끈 (러닝화는 옆 줄)
  return `<path d="${body_}" fill="${c}"/>
    <path d="M${X(-w - 3.2)},${Y(6.8)} Q${f1(x)},${Y(9.6)} ${X(w + 5.4)},${Y(6.8)} L${X(w + 5)},${Y(9.4)} Q${f1(x)},${Y(11.6)} ${X(-w - 3)},${Y(9.4)} Z" fill="#f7f6f3" stroke="${light ? '#b9b5ad' : shade(c, .75)}" stroke-width=".6"/>
    <path d="M${X(-1.8)},${Y(.4)} L${X(2.4)},${Y(2)} M${X(-1.8)},${Y(2.4)} L${X(2.4)},${Y(.6)}" stroke="${light ? '#9aa2ad' : '#fff'}" stroke-width=".9" stroke-linecap="round"/>` +
    (type === 'runner' ? `<path d="M${X(w - 1)},${Y(4.6)} Q${X(w + 2.4)},${Y(3)} ${X(w + 4.4)},${Y(5.4)}" fill="none" stroke="${light ? '#e2722b' : '#fff'}" stroke-width="1.3" stroke-linecap="round"/>` : '');
}
// 손: 엄지만 분리된 벙어리장갑 모양 (손목이 원점, 아래로 길이 약 15.7)
const mittIn = skin => `<path d="M-4.4,-1.5 C-5.2,4.5 -4.8,10.6 -1.4,12.6 C1.8,14.2 4.9,11.8 4.8,7.6 L4.8,-1.5 Z" fill="${skin}"/>
  <path d="M-3.9,2.4 C-7.4,4.2 -7.2,8.6 -4.4,9.6 C-3.4,8.2 -3.2,5.4 -2.6,3.2 Z" fill="${shade(skin, .9)}"/>
  <path d="M-1.2,9.6 Q1,11 3.2,9.2" fill="none" stroke="${shade(skin, .7)}" stroke-width=".8" opacity=".5"/>`;
// (x,y) 손목, rot 회전(아래가 0), s 바깥쪽 방향
const mitt = (x, y, s, skin, rot) => `<g transform="translate(${f1(x)},${f1(y)}) rotate(${rot || 0}) scale(${s},1)">${mittIn(skin)}</g>`;
// 전신용 손 (1-2): 손바닥이 허벅지 쪽 → 옆에서 본 좁은 미트(폭 = 손목 1.3) + 앞(몸 안쪽)으로 나온 엄지. 손목이 원점, 길이 약 15.3, +x가 바깥
const handIn = skin => `<path d="M-1.6,-1.5 C-1.8,2.6 -2,6.8 -1.8,10 C-1.6,13 -.4,14.9 .7,14.8 C1.9,14.6 2.6,12.4 2.5,9.2 C2.4,5.6 2.2,2 1.9,-1.5 Z" fill="${skin}" stroke="${shade(skin, .72)}" stroke-width=".6"/>
  <path d="M-1.3,2.8 C-3,4.6 -3.3,7.6 -2.2,9.2 C-1.6,10 -.8,9.6 -.7,8.6 C-.6,6.8 -.6,4.8 -.3,3.4 Z" fill="${shade(skin, .93)}" stroke="${shade(skin, .72)}" stroke-width=".55"/>
  <path d="M.5,10 Q1,12.2 .8,14 M1.7,9.6 Q2.2,11.6 2,13.2" fill="none" stroke="${shade(skin, .7)}" stroke-width=".45" stroke-linecap="round" opacity=".5"/>`;
// ring: 결혼 반지 — 약지 아래쪽 마디에 작은 금색 고리
const RING = '<path d="M-.4,10.6 Q1.4,11.5 3.2,10.4" fill="none" stroke="#d8b45a" stroke-width="1.1" stroke-linecap="round"/><circle cx="1.2" cy="10.9" r=".35" fill="#fff6d8"/>';
const handAt = (x, y, s, skin, rot, len, ring) => { const q = len / 15.3; return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(rot)}) scale(${(s * q).toFixed(3)},${q.toFixed(3)})">${handIn(skin)}${ring ? RING : ''}</g>`; };
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
    // 체형 4종이 눈에 보이게 (1-9): 마름은 허리·골반이 좁고, 통통은 허리·골반·허벅지가 넓음
    const waist = (fig && fig.waist) || ({ slim: 57, fit: 62, chubby: 78 }[build] || 64);
    const hip = (fig && fig.hip) || ({ slim: 83, fit: 91, chubby: 104 }[build] || 90);
    cup = fig && CUP_DIFF[fig.cup] != null ? fig.cup : ({ small: 'A', large: 'D' }[b.chest] || 'B');
    const ub = (fig && fig.under) || waist + 8;
    C = { shoulder: 37 + ({ slim: -1, fit: 1, chubby: 2 }[build] || 0), underbust: ub, bust: ub + CUP_DIFF[cup], waist, hip, thigh: hip * .58 };
    C.calf = C.thigh * .62;
  } else if (adult) {
    const shoulder = (fig && fig.shoulder) || ({ narrow: 39.5, wide: 48 }[b.shoulder] || 43.5);
    const waist = (fig && fig.waist) || ({ slim: 68, fit: 74, chubby: 96 }[build] || 78);
    C = { shoulder: shoulder + (!(fig && fig.shoulder) ? ({ slim: -1.5, fit: 2 }[build] || 0) : 0), chest: (fig && fig.bust) || shoulder * 2.1 + ({ fit: 4, chubby: 6 }[build] || 0), waist, hip: (fig && fig.hip) || waist + (build === 'slim' ? 12 : 10) };
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
  const grown = clamp((age - 12) / 7, 0, 1), chin = 1 / hr, shR = chin * lerp(1.236, f ? 1.27 : 1.2, grown), remap = v => shR + (v - .225) / .725 * (.95 - shR);
  const y = { chin: top + H * chin, neck: top + H * chin * lerp(1.1, f ? 1.12 : 1.09, grown), sh: top + H * shR };
  for (const k in ANCHOR_Y) y[k] = top + H * remap(ANCHOR_Y[k]);
  const ci = cup ? CUPS.indexOf(cup) : -1;
  if (cup) y.bust += H * .004 * (ci - 3);   // 컵이 커질수록 가슴 앵커가 아래로
  y.armpit = lerp(y.sh, y.bust, .55); y.hipUp = lerp(y.waist, y.hip, .5);
  // 팔·손·발
  // 팔 (HAIR_CLOTHES_BODY 1-2): 상완 굵기 기준 앵커 5개 — 어깨 1 / 상완 중간 .95(근육형 1.05, 이두 볼록) / 팔꿈치 .75 / 전완 .85 / 손목 .55
  //   남자가 굵고 여자는 가늘게. 손 길이 = 머리 .55 (= 키 .1), 폭 = 손목 1.3 (손바닥이 허벅지를 향해 옆에서 보이는 손)
  const bm = adult ? { slim: .84, fit: 1.15, chubby: 1.3 }[build] || 1 : 1;
  const arm = { uw: H * lerp(.0425, f ? .0385 : .047, grown) * bm, hand: H * .1 };
  arm.mw = arm.uw * (adult && build === 'fit' ? 1.05 : .95); arm.ew = arm.uw * .75; arm.fw = arm.uw * .85; arm.ww = arm.uw * .55;
  // 반폭
  const w = { nh: (age <= 12 ? 8.5 : lerp(10.5, f ? 9.6 : 12.8, grown)) * hs, sh: (adult && !f ? E.shoulder : C.shoulder) * PXCM / 2 };
  w.waist = half(E.waist, KW.waist) - (fitM ? 2 : 0);
  w.hip = half(E.hip, KW.hip);
  // 여자 어깨는 골반 폭쯤 (어깨 ≤ 골반, 1-8) — 10대 중반부터 점점
  if (f && age >= 13) w.sh = lerp(w.sh, 12 + w.hip * .45 + ({ slim: -.4, fit: 1.4 }[build] || 0), grown);
  if (f && adult) w.sh = Math.max(w.sh, half(E.underbust || E.waist + 8, KW.underbust) + 3.2);   // 가슴 둘레보다 어깨가 좁으면 팔이 벌어짐
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
  const delt = adult && !f ? (fitM ? 2 : 1) : 0;   // 남자 삼각근 볼륨 (팔 바깥선이 이만큼 나옴)
  w.armpit = Math.min(w.armpit, w.tip - .3);
  const chubbyF = adult && f && build === 'chubby';
  w.hipUp = chubbyM ? Math.max(w.waist, w.hip) + 2.5 : lerp(w.waist, w.hip, f && !kid ? .68 : .5) + (chubbyF ? 1.6 : 0);   // 골반은 허리에서 바로 벌어짐 / 통통하면 배가 옆 윤곽으로 볼록
  // 다리 (한쪽): 허벅지 → 무릎(허벅지의 .68) → 종아리 → 발목(종아리의 .55)
  // 다리 (1-5): 허벅지(굵음) → 무릎(좁음, 살짝 안쪽) → 종아리(바깥 볼록) → 발목(가장 좁음). 허벅지 사이: 마름 넓게 / 보통 조금 / 근육·통통 붙음
  const gap = adult ? ({ slim: 4, avg: 1.2 }[build] ?? 0) : kid ? 2 : 1.5;
  const thighW = Math.min(pxW(E.thigh, 1) * (adult && build === 'chubby' ? 1.1 : adult && build === 'slim' ? .92 : 1), w.hip - .8 - gap / 2), kneeW = thighW * (adult && build === 'slim' ? .64 : .68);
  const calfW = clamp(pxW(E.calf, 1) * (adult && build === 'fit' ? 1.08 : 1), kneeW * 1.04, thighW * .92), ankleW = calfW * .55, foot = H * .136;
  const leg = { gap, thighW, kneeW, calfW, ankleW, ct: gap / 2 + thighW / 2, ck: kneeW / 2 + (f ? .2 : 1.2) + gap * .3, cc: calfW / 2 + (f ? 1.2 : 2.2) + gap * .3 };
  leg.ca = Math.max(ankleW / 2 + (f ? 2 : 3) + gap * .3, foot * .28);
  const edge = [[w.tip, y.sh + 1.2], [w.armpit, y.armpit], [w.bust, y.bust], [w.ub, y.underbust], [w.waist, y.waist], [w.hipUp, y.hipUp], [w.hip, y.hip], [w.hip - 1, y.crotch]];
  return { f, adult, kid, age, build, cup, ci, sig: cup ? BUST_SIG[cup] : null, fitM, chubbyM, chubbyF, delt, hcm, H, top, headH, hs,
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
// 어깨 윤곽 (1-1): 목 옆 → 승모근 경사(완만한 내리막) → 어깨 끝(견봉) → 삼각근(작은 둥근 곡선) → 팔 바깥선으로 이어짐
//   여자: 경사 길고 완만, 어깨 끝 작게 / 남자: 경사 짧고 어깨 끝 넓게, 삼각근 볼륨(+1, 근육형 +2). 둥근 혹이 머리 쪽으로 솟지 않음
//   e: 옷 여유분(니트·후디도 어깨 위로는 반만), drop: 오버핏 — 어깨선이 팔 위로 내려옴
function shoulderR(A, e = 0, drop = 0) {
  const { y, w } = A, k = A.hs, uw = A.arm.uw, m = A.adult && !A.f, acro = w.sh - uw * .5;
  return [[w.nh + 1.6 * k + e * .25, y.neck + (m ? .8 * k : 0)],
    [lerp(w.nh, acro, m ? .42 : .5) + e * .3, lerp(y.neck, y.sh, m ? .5 : .6) + (m ? .4 * k : 0)],
    [acro + e * .45 + drop * .5, y.sh + e * .1 + drop * .3],
    [w.sh + e * .6 + A.delt + drop * .3, y.sh + uw * .55 + drop]];
}

// 하의 + 다리 + 신발 (3-3·3-6). 바지·치마는 다리·골반 윤곽 + 여유분. OF: 지금 입은 한 벌 (js/outfit.js)
//   바지 cut: skinny(다리 윤곽 +0.5) / straight(무릎 아래 일자) / wide(골반부터 벌어짐) / jogger(발목 골지) / short(허벅지에서 끝)
//   치마: mini·pleats·aline·pencil·longskirt·denimskirt·uniSkirt. 원피스면 하의 없이 다리·신발만
const SKIRTS = { mini: 1, pleats: 1, aline: 1, pencil: 1, longskirt: 1, denimskirt: 1, uniSkirt: 1 };
const BOOT_TOP = { ankleboot: 'ankle', longboot: 'knee', ugg: 'calf', rainboot: 'calf' };
function lowerFull(a, X, age, A, skin, OF, ST) {   // ST: 짝다리 (renderFull의 stanceOf) — 신발 위치·뒤꿈치
  const { y, w, leg: L } = A, k = A.hs, sw = v => f1(v * k);
  const bt = OF.dress ? { k: 'none', c: '#000' } : OF.bottom || { k: 'jeans', c: '#4a5f86', cut: 'straight' };
  const dk = shade(bt.c, .72);
  // 신발 (1-6): 머리 .75 크기, 발끝이 살짝 바깥(6°), 바닥에 작은 타원 그림자 → 떠 보이지 않게
  const sh = OF.shoes || { k: 'sneaker', c: '#eceae6' }, shoeT = sh.k, kf = A.foot / 31 * (shoeT === 'heel' ? 1.2 : 1.06), sy0 = FLOOR - 10.4 * kf;
  const shoes = `<ellipse cx="60" cy="${f1(FLOOR - .4)}" rx="${f1(L.ca + 11 * kf)}" ry="${f1(2.4 * kf)}" fill="#3a2a22" opacity=".13"/>` +
    [-1, 1].map(s => {
      const x0 = 60 + s * L.ca, fr = ST && s === ST.fs, x = ST ? ST.W(x0, FLOOR)[0] : x0, up = fr ? ST.heel : 0, rot = s * 6 + (fr ? s * 5 : 0);   // 짝다리: 쉬는 발은 뒤꿈치가 살짝 들리고 더 바깥으로
      return `<g transform="translate(0,${f1(-up)}) rotate(${rot},${f1(x)},${FLOOR}) translate(${f1(x)},${f1(sy0)}) scale(${kf.toFixed(3)}) translate(${f1(-x)},${f1(-sy0)})">${shoe(shoeT, x, sy0, s, 4.4, skin, sh.c)}</g>`;
    }).join('');
  const legD = s => { const { outer, inner } = legSide(A, s); return `M${P(60 + s * .2, y.hip)} L${P(...outer[0])}${crThrough(outer)} L${P(...inner[0])}${crThrough(inner)} Z`; };
  const bare = `<path d="${legD(-1)} ${legD(1)}" fill="${skin}"/>` +
    `<path d="${[-1, 1].map(s => `M${P(60 + s * (L.ck - L.kneeW * .3), y.knee + 1)} q${f1(s * L.kneeW * .3)},${sw(1.4)} ${f1(s * L.kneeW * .6)},0`).join(' ')}" fill="none" stroke="${shade(skin, .78)}" stroke-width="${sw(1)}" opacity="${A.build === 'slim' ? .8 : .55}"/>`;
  const rl = legSide(A, 1), outAt = yy => edgeAt(rl.outer.map(([x, v]) => [x - 60, v]), yy), inAt = yy => edgeAt(rl.inner.slice().reverse().map(([x, v]) => [x - 60, v]), yy);
  // 부츠 목: 발목에서 종아리·무릎까지 다리 윤곽 + 1.2
  const bootTop = BOOT_TOP[shoeT], bootY = bootTop === 'ankle' ? y.ankle - 7 : bootTop === 'calf' ? lerp(y.calf, y.knee, .15) : bootTop === 'knee' ? y.knee - 2 : 0;
  const shafts = bootTop ? [-1, 1].map(s => {
    const X0 = dx => f1(60 + s * dx), o0 = outAt(bootY) + (shoeT === 'ugg' ? 2 : 1.2), i0 = Math.max(.6, inAt(bootY) - 1.2), oA = outAt(y.ankle) + 1.6, iA = Math.max(.6, inAt(y.ankle) - 1.6);
    return `<path d="M${X0(i0)},${f1(bootY)} L${X0(o0)},${f1(bootY)} Q${X0(outAt(lerp(bootY, y.ankle, .5)) + 1.6)},${f1(lerp(bootY, y.ankle, .5))} ${X0(oA)},${f1(y.ankle + 3)} L${X0(iA)},${f1(y.ankle + 3)} Q${X0(Math.max(.6, inAt(lerp(bootY, y.ankle, .5)) - 1.2))},${f1(lerp(bootY, y.ankle, .5))} ${X0(i0)},${f1(bootY)} Z" fill="${sh.c}" stroke="${shade(sh.c, .6)}" stroke-width=".5"/>` +
      (shoeT === 'ugg' ? `<path d="M${X0(i0)},${f1(bootY + 1)} L${X0(o0)},${f1(bootY + 1)}" stroke="${shade(sh.c, 1.25)}" stroke-width="${sw(2.4)}" stroke-linecap="round"/>` : shoeT === 'rainboot' ? `<path d="M${X0((i0 + o0) / 2 + 1)},${f1(bootY + 3)} L${X0((iA + oA) / 2 + 1)},${f1(y.ankle - 2)}" stroke="#fff" stroke-width="${sw(1.2)}" opacity=".45"/>` : '');
  }).join('') : '';
  const kind = bt.k;
  if (kind === 'none') return { svg: bare + shoes + shafts, legs: bare, shoes: shoes + shafts, cloth: '', belt: '', hipEdge: w.hip };
  if (SKIRTS[kind]) {
    const uni = kind === 'uniSkirt', hemSel = bt.hem ?? X.hem;
    const hemY = uni ? lerp(y.crotch, y.knee, .82) : age <= 12 ? lerp(y.crotch, y.knee, .55)
      : kind === 'mini' || kind === 'denimskirt' ? lerp(y.crotch, y.knee, .42) : kind === 'longskirt' ? lerp(y.knee, y.calf, .9) : kind === 'pencil' ? lerp(y.knee, y.calf, .1 + hemSel * .3)
      : kind === 'pleats' ? lerp(y.knee, y.calf, .35) : lerp(lerp(y.crotch, y.knee, .5), lerp(y.knee, y.calf, .5), hemSel);
    const topY = y.waist + 1, pencil = kind === 'pencil';
    const ex = pencil ? 1 : 2, flare = pencil ? 0 : (hemY - y.hip) * (kind === 'longskirt' ? .12 : kind === 'pleats' || uni ? .2 : .18) + (uni ? 2 : .5);
    const R = [[w.waist + 1, topY], [w.hipUp + ex * .8, y.hipUp], [w.hip + ex, y.hip], [pencil ? Math.max(outAt(hemY) + 1.5, w.hip - (hemY - y.hip) * .12) : w.hip + ex + flare, hemY]];
    const hw = R[3][0];
    let det;
    if (uni || kind === 'pleats') {   // 주름선 (교복은 + 체크 선)
      let pl = '';
      for (let i = -3; i <= 3; i++) pl += `M${f1(60 + i * (w.hip + 2) * .27)},${f1(y.hip - 2)} L${f1(60 + i * hw * .31)},${f1(hemY)} `;
      det = `<path d="${pl}" stroke="${dk}" stroke-width="${sw(1.1)}" opacity=".5"/>` + (uni ? `<path d="M${f1(60 - hw + 1)},${f1(hemY - 9 * k)} L${f1(60 + hw - 1)},${f1(hemY - 9 * k)} M${f1(60 - w.hip)},${f1(y.hip + 6 * k)} L${f1(60 + w.hip)},${f1(y.hip + 6 * k)}" stroke="${shade(bt.c, 1.45)}" stroke-width="${sw(.9)}" opacity=".45"/>` : '');
    } else if (pencil) det = `<path d="M60,${f1(hemY)} L60,${f1(hemY - 9 * k)} M${f1(60 - w.hip * .5)},${f1(y.hip + 2)} Q${f1(60 - w.hip * .45)},${f1(hemY - 6 * k)} ${f1(60 - w.hip * .38)},${f1(hemY - 2 * k)}" fill="none" stroke="${dk}" stroke-width="${sw(1.1)}" opacity=".4"/>`;   // 뒤트임 + 주름
    else det = `<path d="M${f1(60 - w.hip * .45)},${f1(y.hip + 3)} Q${f1(60 - w.hip * .55)},${f1(hemY - 8 * k)} ${f1(60 - hw * .7)},${f1(hemY)} M${f1(60 + w.hip * .4)},${f1(y.hip + 4)} Q${f1(60 + w.hip * .5)},${f1(hemY - 8 * k)} ${f1(60 + hw * .62)},${f1(hemY)}" fill="none" stroke="${dk}" stroke-width="${sw(1.2)}" opacity=".35"/>`;   // A라인 주름
    if (kind === 'denimskirt') det += `<path d="M${f1(60 - w.waist)},${f1(topY + 5 * k)} Q${f1(60 - w.waist * .5)},${f1(y.hip)} ${f1(60 - w.hip * .9)},${f1(y.hip + 1)} M${f1(60 + w.waist)},${f1(topY + 5 * k)} Q${f1(60 + w.waist * .5)},${f1(y.hip)} ${f1(60 + w.hip * .9)},${f1(y.hip + 1)} M60,${f1(topY + 4 * k)} L60,${f1(hemY - 1)} M${f1(60 - hw + 1)},${f1(hemY - 2.4 * k)} L${f1(60 + hw - 1)},${f1(hemY - 2.4 * k)}" fill="none" stroke="#d2a659" stroke-width="${sw(.8)}" stroke-dasharray="${sw(2)} ${sw(1.4)}" opacity=".7"/>`;
    const band = `<path d="M${f1(60 - w.waist - 1)},${f1(topY)} L${f1(60 + w.waist + 1)},${f1(topY)} L${f1(60 + w.waist + 1.3)},${f1(topY + 4 * k)} L${f1(60 - w.waist - 1.3)},${f1(topY + 4 * k)} Z" fill="${dk}" opacity=".7"/>`;
    const cloth = `<path d="${symShape(R, hemY + 1.4, topY)}" fill="${bt.c}"/>` + det + band;
    const over = shafts && bootTop !== 'ankle' ? shafts : '';   // 치마 아래 부츠는 다리 위로
    return { svg: bare + shoes + (over ? '' : shafts) + cloth + over, legs: bare, shoes: shoes + shafts, cloth, belt: '', hipEdge: w.hip + ex };
  }
  // 바지·반바지: 허리 → 골반 → 다리 윤곽 + 여유분 (반바지는 허벅지에서 끝남)
  const short = kind === 'shorts' || kind === 'boardshorts';
  const cut = short ? 'short' : kind === 'jogger' ? 'skinny' : kind === 'fireP' || kind === 'pajamaP' ? 'wide' : bt.cut || 'straight', e = cut === 'skinny' ? (kind === 'jogger' ? 1.4 : .5) : 2 + (kind === 'cargo' || kind === 'fireP' ? 1 : 0);
  const tucked = !!OF.tuck;
  const topY = tucked ? y.waist + 1 : lerp(y.waist, y.hip, .28), tw = A.at(topY) + .6;
  const hemY = short ? lerp(y.crotch, y.knee, kind === 'boardshorts' ? .62 : .35) : kind === 'jogger' ? y.ankle + 1 : FLOOR - 9.5 * A.foot / 30;
  const shp = { cK: L.ck + .3, cA: (L.ck + L.ca) / 2 + .5, hw: Math.max(L.kneeW / 2 + 2.6, L.calfW / 2 + 2.2) };   // 일자: 무릎 아래 직선
  const wd = { cA: Math.max(L.ca + 1.5, L.ct), hw: L.thighW * .5 + 2.5 };   // 와이드
  const hems = [];   // [[바깥 x, 안쪽 x], ...] 오른쪽
  const side = s => {
    const X0 = dx => 60 + s * Math.max(-.3, dx), lo = legSide(A, s, e), crotch = [X0(-.3), y.crotch + 1.5];
    let oc = [[X0(tw), topY], [X0(w.hip + e), y.hip]], ol = [], ic;
    if (cut === 'short') { oc.push([X0(outAt(hemY) + e + (kind === 'boardshorts' ? 1.5 : 0)), hemY]); ic = [[X0(inAt(hemY) - e - (kind === 'boardshorts' ? 1 : 0)), hemY], crotch]; }
    else if (cut === 'skinny') { oc.push(...lo.outer.slice(1, -1), [X0(L.ca + L.ankleW / 2 + e + .3), hemY]); ic = [[X0(L.ca - L.ankleW / 2 - e - .3), hemY], ...lo.inner.slice(1, -1), crotch]; }
    else if (cut === 'straight') { oc.push(lo.outer[1], [X0(shp.cK + shp.hw), y.knee]); ol = [[X0(shp.cA + shp.hw), hemY], [X0(shp.cA - shp.hw), hemY]]; ic = [[X0(shp.cK - shp.hw), y.knee], lo.inner[3], crotch]; }
    else { oc.push([X0(L.ct + L.thighW / 2 + e + 1), y.thigh]); ol = [[X0(wd.cA + wd.hw), hemY], [X0(Math.max(.8, wd.cA - wd.hw)), hemY]]; ic = [lo.inner[3], crotch]; }
    if (s > 0) hems.push(ol.length ? [ol[0][0] - 60, ol[1][0] - 60] : [oc[oc.length - 1][0] - 60, ic[0][0] - 60]);
    return `M${P(60 - s * .6, topY)} L${P(...oc[0])}${crThrough(oc)}${ol.map(p => ` L${P(...p)}`).join('')} L${P(...ic[0])}${crThrough(ic)} L${P(60 - s * .6, y.crotch + 1.5)} Z`;
  };
  const pid = `av${UID}b`, dL = side(-1), dR = side(1);
  let out = `<path d="${dL}" fill="${bt.c}"/><path d="${dR}" fill="${bt.c}"/>`;   // 좌우를 한 path에 넣으면 겹친 가운데가 뚫림
  const [ho, hi] = hems[0], hc = (ho + hi) / 2;
  // 무늬: 잠옷 도트·체크, 셰프 바지 잔체크, 군복 위장, 보드숏 줄
  const pat = bt.pat === 'same' && OF.inner ? OF.inner.pat : bt.pat || (kind === 'chefP' ? 'check' : kind === 'boardshorts' ? 'band' : null);
  if (pat) out += `<clipPath id="${pid}"><path d="${dL} ${dR}"/></clipPath><g clip-path="url(#${pid})">${patternSVG(pat, bt.c, topY, hemY, 60 - ho - 3, 60 + ho + 3, k, pid)}</g>`;
  const thighIn = L.ct - L.thighW / 2 - e, kneeIn = (cut === 'straight' ? shp.cK - shp.hw : L.ck - L.kneeW / 2 - e);
  const seamTo = cut === 'short' ? hemY : thighIn > .3 ? y.crotch + 1 : kneeIn > .3 ? lerp(y.thigh, y.knee, .5) : cut === 'wide' ? hemY : y.knee;   // 다리가 붙은 곳까지 안쪽 솔기
  out += `<path d="M60,${f1(topY + 2 * k)} L60,${f1(seamTo)}" stroke="${dk}" stroke-width="${sw(1)}" opacity=".6"/>`;
  if (kind === 'jogger') out += `<path d="${[-1, 1].map(s => `M${f1(60 + s * (L.ca - L.ankleW / 2 - e))},${f1(hemY - 4 * k)} L${f1(60 + s * (L.ca + L.ankleW / 2 + e))},${f1(hemY - 4 * k)}`).join(' ')}" stroke="${dk}" stroke-width="${sw(1.2)}" opacity=".7"/><path d="M58.4,${f1(topY + 2 * k)} l-1,${sw(6)} M61.6,${f1(topY + 2 * k)} l1,${sw(6)}" stroke="${shade(bt.c, 1.5)}" stroke-width="${sw(.9)}" stroke-linecap="round"/>`;   // 발목 골지 + 허리끈
  else out += `<path d="M${f1(60 - ho)},${f1(hemY - 3.5 * k)} L${f1(60 - hi)},${f1(hemY - 3.5 * k)} M${f1(60 + hi)},${f1(hemY - 3.5 * k)} L${f1(60 + ho)},${f1(hemY - 3.5 * k)}" stroke="${dk}" stroke-width="${sw(1.1)}" opacity=".55"/>`;   // 밑단 접힘
  if (cut !== 'short') {   // 무릎 뒤 주름 (3-6) — 가로 곡선 2개, 옷 색 -15%
    const kc = cut === 'straight' ? shp.cK : L.ck, kw = cut === 'straight' ? shp.hw : L.kneeW / 2 + e;
    out += `<path d="${[-1, 1].map(s => `M${P(60 + s * (kc - kw * .6), y.knee)} q${f1(s * kw * .6)},${sw(1.3)} ${f1(s * kw * 1.2)},0 M${P(60 + s * (kc - kw * .4), y.knee + 3 * k)} q${f1(s * kw * .4)},${sw(.9)} ${f1(s * kw * .8)},0`).join(' ')}" fill="none" stroke="${shade(bt.c, .85)}" stroke-width="${sw(1.1)}" opacity=".9"/>`;
  }
  if (kind === 'jeans') out += `<path d="M${f1(60 - w.hip - e + .6)},${f1(y.hip)} L${f1(60 - ho + .8)},${f1(hemY - 5 * k)} M${f1(60 + w.hip + e - .6)},${f1(y.hip)} L${f1(60 + ho - .8)},${f1(hemY - 5 * k)}" stroke="#d2a659" stroke-width="${sw(.8)}" stroke-dasharray="${sw(2)} ${sw(1.6)}" opacity=".6"/>` +
    `<path d="M${f1(60 - tw + 2 * k)},${f1(topY + k)} Q${f1(60 - tw + 5 * k)},${f1(y.hip - 4 * k)} ${f1(60 - w.hip - e)},${f1(y.hip - 2 * k)} M${f1(60 + tw - 2 * k)},${f1(topY + k)} Q${f1(60 + tw - 5 * k)},${f1(y.hip - 4 * k)} ${f1(60 + w.hip + e)},${f1(y.hip - 2 * k)}" fill="none" stroke="#d2a659" stroke-width="${sw(.8)}" opacity=".55"/>`;   // 옆선 스티치, 주머니
  if ((kind === 'slacks' || kind === 'scrubP') && cut !== 'short') out += `<path d="M${f1(60 - L.ct)},${f1(y.hip + 6 * k)} L${f1(60 - hc)},${f1(hemY - 6 * k)} M${f1(60 + L.ct)},${f1(y.hip + 6 * k)} L${f1(60 + hc)},${f1(hemY - 6 * k)}" stroke="${shade(bt.c, 1.3)}" stroke-width="${sw(.9)}" opacity=".45"/>`;   // 다림질 선
  if (kind === 'cargo') out += [-1, 1].map(s => { const x0 = 60 + s * (outAt(y.thigh) + e - 1), yy = lerp(y.thigh, y.knee, .3); return `<path d="M${f1(x0)},${f1(yy)} l${f1(-s * 7 * k)},0 l0,${sw(9)} l${f1(s * 7 * k)},0 Z M${f1(x0)},${f1(yy + 2.4 * k)} l${f1(-s * 7 * k)},0" fill="${shade(bt.c, .92)}" stroke="${dk}" stroke-width="${sw(.8)}"/>`; }).join('');   // 옆 주머니
  if (kind === 'training' || kind === 'fireP') { const sc = kind === 'fireP' ? '#d9e04a' : '#f2efe9'; out += kind === 'fireP' ? `<path d="${[-1, 1].map(s => `M${f1(60 + s * hi)},${f1(lerp(y.knee, y.calf, .5))} L${f1(60 + s * ho)},${f1(lerp(y.knee, y.calf, .5))}`).join(' ')}" stroke="${sc}" stroke-width="${sw(3.2)}"/>` : `<path d="M${f1(60 - w.hip - e + 1.2)},${f1(y.hip)} L${f1(60 - ho + 1.2)},${f1(hemY - 2)} M${f1(60 + w.hip + e - 1.2)},${f1(y.hip)} L${f1(60 + ho - 1.2)},${f1(hemY - 2)}" stroke="${sc}" stroke-width="${sw(1.6)}" opacity=".85"/>`; }   // 옆줄 / 반사띠
  const belt = tucked && !['training', 'jogger', 'pajamaP', 'scrubP', 'boardshorts'].includes(kind) ? `<path d="M${f1(60 - tw - .3)},${f1(topY - 2.5 * k)} L${f1(60 + tw + .3)},${f1(topY - 2.5 * k)} L${f1(60 + tw + .5)},${f1(topY + 2.5 * k)} L${f1(60 - tw - .5)},${f1(topY + 2.5 * k)} Z" fill="#2a211d"/><rect x="${f1(60 - 3 * k)}" y="${f1(topY - 3 * k)}" width="${sw(6)}" height="${sw(6)}" rx="${sw(1)}" fill="none" stroke="#c8a24a" stroke-width="${sw(1.2)}"/>` : '';
  const legs = cut === 'short' ? bare : '', skinnyBoot = bootTop && (cut === 'skinny' || cut === 'short');   // 스키니·조거·반바지는 부츠 안으로
  return { svg: legs + shoes + (skinnyBoot ? '' : shafts) + out + (skinnyBoot ? shafts : ''), legs, shoes: shoes + (skinnyBoot ? '' : shafts), cloth: out + (skinnyBoot ? shafts : ''), belt, hipEdge: w.hip + e };
}
// 무늬 (3-5): 줄무늬는 이너에서 따로(가슴에서 휨). check 체크 / dot 도트 / camo 위장 / band 가로 띠 / logo는 이너 가슴에
function patternSVG(pat, c, y0, y1, x0, x1, k, id) {
  const r = rng(id), lc = shade(c, .72), hc = shade(c, 1.3);
  if (pat === 'check') { let d = '', d2 = ''; for (let x = x0; x <= x1; x += 6 * k) d += `M${f1(x)},${f1(y0)} L${f1(x)},${f1(y1)} `; for (let yy = y0; yy <= y1; yy += 6 * k) d2 += `M${f1(x0)},${f1(yy)} L${f1(x1)},${f1(yy)} `; return `<path d="${d}" stroke="${lc}" stroke-width="${f1(1.4 * k)}" opacity=".55"/><path d="${d2}" stroke="${hc}" stroke-width="${f1(1.4 * k)}" opacity=".45"/>`; }
  if (pat === 'dot') { let o = ''; for (let yy = y0 + 3 * k; yy <= y1; yy += 6 * k) for (let x = x0 + (Math.round((yy - y0) / (6 * k)) % 2 ? 3 * k : 0); x <= x1; x += 6 * k) o += `M${f1(x)},${f1(yy)} m-.9,0 a.9,.9 0 1 0 1.8,0 a.9,.9 0 1 0 -1.8,0 `; return `<path d="${o}" fill="${c === '#f2efe9' || c === '#ece3cf' ? '#3b3e48' : '#fbf8f2'}" opacity=".75"/>`; }
  if (pat === 'camo') { let o = ''; for (let i = 0; i < 26; i++) { const x = lerp(x0, x1, r()), yy = lerp(y0, y1, r()), rr = (2 + r() * 3) * k; o += `<ellipse cx="${f1(x)}" cy="${f1(yy)}" rx="${f1(rr * 1.4)}" ry="${f1(rr)}" transform="rotate(${Math.round(r() * 180)} ${f1(x)} ${f1(yy)})" fill="${['#3f4733', '#8a8a5c', '#2f2a22'][i % 3]}" opacity=".85"/>`; } return o; }
  if (pat === 'band') return `<path d="M${f1(x0)},${f1(lerp(y0, y1, .55))} L${f1(x1)},${f1(lerp(y0, y1, .55))}" stroke="#fbf8f2" stroke-width="${f1(2.4 * k)}" opacity=".8"/>`;
  return '';
}
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
// 옷 위 가슴 볼륨 (1-3): 동그란 하이라이트·컵 윤곽선 없이 — 밑가슴 그림자 곡선(초승달) + 윗면 아주 옅은 빛 (+ 몸에 붙는 옷은 가운데 짧은 골)
//   옆 윤곽 볼록과 밑단 들림은 윤곽에서 처리. bx: 가운데에서 가슴 중심까지, cy: 꼭짓점 높이, r: 반지름, dk 그림자 색, op 세기
function bustCloth(id, bx, cy, r, dk, op, valley, k) {
  const q = v => f1(v * 100) / 100;
  let o = `<defs><linearGradient id="${id}t" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(cy - r * 1.05)}" x2="0" y2="${f1(cy + r * .1)}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#fff" stop-opacity="${q(op * .32)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
  const xo = bx + r * .95;
  o += `<path d="M${f1(60 - xo)},${f1(cy + r * .1)} Q${f1(60 - bx)},${f1(cy - r * 1.15)} 60,${f1(cy - r * .55)} Q${f1(60 + bx)},${f1(cy - r * 1.15)} ${f1(60 + xo)},${f1(cy + r * .1)} Z" fill="url(#${id}t)"/>`;
  o += [-1, 1].map(s => {   // 밑가슴: 바깥에서 안쪽으로 가늘어지는 초승달
    const X = v => f1(60 + s * v);
    return `<path d="M${X(bx + r * .92)},${f1(cy + r * .05)} Q${X(bx + r * .7)},${f1(cy + r * 1.02)} ${X(bx - r * .15)},${f1(cy + r * .98)} Q${X(bx - r * .55)},${f1(cy + r * .92)} ${X(Math.max(1.2 * k, bx - r * .82))},${f1(cy + r * .58)} Q${X(bx - r * .3)},${f1(cy + r * .74)} ${X(bx + r * .1)},${f1(cy + r * .72)} Q${X(bx + r * .62)},${f1(cy + r * .66)} ${X(bx + r * .92)},${f1(cy + r * .05)} Z" fill="${dk}" opacity="${q(op)}"/>`;
  }).join('');
  if (valley) o += `<path d="M60,${f1(cy - r * .35)} L60,${f1(cy + r * .35)}" stroke="${dk}" stroke-width="${f1(1.3 * k)}" stroke-linecap="round" opacity="${q(op * .7)}"/>`;
  return o;
}
// 줄무늬가 가슴 높이에서 몸 볼륨을 따라 휨 (1-3) — 따로 선을 긋지 않음. rows: 줄 가운데 y 목록, half(y): 그 높이 반폭, bust: { bx, cy, r, amp }
function stripeRows(rows, half, bust, c, th) {
  return rows.map(yy => {
    const hw = half(yy) + 2;
    let d = `M${f1(60 - hw)},${f1(yy)}`;
    for (let x = -hw + 2; x <= hw + .01; x += 2) {
      let dy = 0;
      if (bust) {
        const t = (yy - (bust.cy - bust.r)) / (bust.r * 2.1);
        if (t > 0 && t < 1) { const ax = Math.abs(x), bump = Math.max(0, 1 - ((ax - bust.bx) / (bust.r * 1.05)) ** 2); dy = bust.amp * Math.sin(Math.PI * t) * bump; }
      }
      d += ` L${f1(60 + x)},${f1(yy + dy)}`;
    }
    return d;
  }).join(' ').replace(/^/, `<path d="`) + `" fill="none" stroke="${c}" stroke-width="${f1(th)}"/>`;
}
// 밑단 골지 (세로줄)
const hemRib = (hemW, hemY, k, c) => `<path d="${Array.from({ length: 9 }, (_, i) => { const x = 60 - hemW + 1.5 + i * (hemW * 2 - 3) / 8; return `M${f1(x)},${f1(hemY - 6 * k)} L${f1(x)},${f1(hemY)}`; }).join(' ')}" stroke="${c}" stroke-width="${f1(1.2 * k)}"/>`;
// 이너 모양 (3-3): e 여유분(한쪽 px), loose 헐렁함 0~1, hem 밑단(허리→가랑이 비율, 음수면 허리 위 = 크롭), bust 가슴 볼록 반영,
//   neck 목선, sl 소매(short·long·none·puff), rib 밑단 골지, fit 몸에 붙음(허리 옆 주름), drop 오버핏 어깨선, cuff 소매 끝(1 넘으면 손등을 덮음)
const GARM = {
  tee:        { e: 1, loose: 0, hem: .55, bust: 1, neck: 'round', sl: 'short', fit: 1 },
  longtee:    { e: 1.2, loose: .05, hem: .55, bust: 1, neck: 'round', sl: 'long', fit: 1 },
  crop:       { e: .8, loose: 0, hem: -.2, bust: 1, neck: 'round', sl: 'short', fit: 1 },
  sleeveless: { e: .6, loose: 0, hem: .5, bust: 1, neck: 'scoop', sl: 'none', fit: 1 },
  sweat:      { e: 4, loose: .7, hem: .62, bust: .5, neck: 'crew', sl: 'long', rib: 1 },
  hoodie:     { e: 5, loose: .85, hem: .6, bust: .5, neck: 'hood', sl: 'long', rib: 1 },
  shirt:      { e: 2, loose: .3, hem: .62, bust: 1, neck: 'collar', sl: 'long', fit: 1, placket: 1 },
  overshirt:  { e: 5, loose: .8, hem: .82, bust: .5, neck: 'collar', sl: 'long', drop: 3.4, cuff: 1.1, placket: 1 },
  blouse:     { e: 2, loose: .25, hem: .55, bust: 1, neck: 'blouse', sl: 'puff', fit: 1 },
  knit:       { e: 3, loose: .35, hem: .3, bust: 1, neck: 'crew', sl: 'long', rib: 1, fit: 1, knit: 1 },
  turtle:     { e: 1.2, loose: .1, hem: .5, bust: 1, neck: 'turtle', sl: 'long', rib: 1, fit: 1 },
  polo:       { e: 2, loose: .2, hem: .55, bust: 1, neck: 'polo', sl: 'short', fit: 1 },
  stripe:     { e: 1.5, loose: .15, hem: .56, bust: 1, neck: 'boat', sl: 'long', fit: 1, stripe: 1 },
  check:      { e: 2.2, loose: .35, hem: .62, bust: .8, neck: 'collar', sl: 'long', pat: 'check', placket: 1 },
  uniform:    { e: 4, loose: .25, hem: .75, bust: .5, neck: 'uniform', sl: 'long' },
  summerUni:  { e: 2, loose: .2, hem: .55, bust: 1, neck: 'collar', sl: 'short', fit: 1, school: 1, placket: 1 },
  track:      { e: 3, loose: .5, hem: .55, bust: .6, neck: 'zip', sl: 'long', rib: 1, stripes: 1 },
  wind:       { e: 3.4, loose: .55, hem: .58, bust: .5, neck: 'zip', sl: 'long' },
  scrub:      { e: 2.6, loose: .4, hem: .62, bust: .7, neck: 'v', sl: 'short', pocket: 1 },
  chef:       { e: 3, loose: .3, hem: .7, bust: .6, neck: 'mandarin', sl: 'long', double: 1 },
  police:     { e: 2, loose: .25, hem: .6, bust: .8, neck: 'collar', sl: 'long', fit: 1, patch: 1, placket: 1 },
  fire:       { e: 6, loose: .8, hem: .85, bust: .3, neck: 'mandarin', sl: 'long', reflect: 1 },
  work:       { e: 4, loose: .6, hem: .7, bust: .4, neck: 'collar', sl: 'long', zipC: 1, pocket: 2 },
  army:       { e: 4, loose: .5, hem: .75, bust: .4, neck: 'collar', sl: 'long', pocket: 2, placket: 1 },
  pajama:     { e: 3, loose: .55, hem: .62, bust: .6, neck: 'collar', sl: 'long', piping: 1, placket: 1 },
  rash:       { e: .8, loose: 0, hem: .5, bust: 1, neck: 'zip', sl: 'long', fit: 1 },
};
// 원피스 = 이너 윗부분 + 허리에서 이어지는 치마. len: 무릎→종아리 비율, flare 벌어짐
const DRESSG = { sundress: { as: 'sleeveless', len: .25, flare: .2, seam: 1 }, shirtdress: { as: 'shirt', len: .02, flare: .14, belt: 1 }, knitdress: { as: 'knit', len: .45, flare: .04 }, suitdress: { as: 'tee', len: .05, flare: .03, seam: 1 } };
// 겉옷 (3-6): 이너 위에, 앞이 열려 이너가 세로로 보임, 칼라·라펠이 목 둘레에, 겉옷 소매가 이너 소매를 덮음
//   len 길이, open 앞여밈(v 가디건 / straight 열린 재킷 / lapel 라펠 / asym 비스듬한 지퍼 / zip 지퍼 / closed 잠긴 패딩), collar 깃
const OUTG = {
  cardigan: { e: 3.5, loose: .5, len: 'hip', open: 'v', rib: 1, btn: 4 },
  denim:    { e: 3.6, loose: .4, len: 'waist', open: 'straight', collar: 'shirt', denim: 1 },
  wind:     { e: 4.4, loose: .6, len: 'hip', open: 'zip', collar: 'stand' },
  blazer:   { e: 3.2, loose: .3, len: 'thigh', open: 'lapel', btn: 2 },
  leather:  { e: 3.2, loose: .3, len: 'waist', open: 'asym', collar: 'notch', shine: 1 },
  trench:   { e: 4.2, loose: .4, len: 'knee', open: 'lapel', belt: 1, btn: 3 },
  longcoat: { e: 4.6, loose: .4, len: 'knee', open: 'lapel', btn: 2 },
  shortpad: { e: 7, loose: .9, len: 'hip', open: 'closed', collar: 'stand', quilt: 1 },
  longpad:  { e: 7.4, loose: .9, len: 'calf', open: 'closed', collar: 'hood', quilt: 1 },
  fleece:   { e: 5, loose: .7, len: 'hip', open: 'closed', collar: 'stand', fluffy: 1 },
  gown:     { e: 4, loose: .5, len: 'knee', open: 'lapel', pocket: 1, btn: 3 },
  vest:     { e: 3.4, loose: .5, len: 'hip', open: 'zip', sleeveless: 1 },
};
// 몸통 윤곽 (오른쪽 반 [dx, y]): 어깨 → 겨드랑이 → 가슴 → 밑가슴 → 허리 → 골반 (→ 허벅지·무릎·종아리: 긴 옷) → 밑단
function torsoR(A, g, hemY, opt = {}) {
  const { y, w } = A, k = A.hs, e = g.e, loose = g.loose, bustF = g.bust ?? 1;
  const bustW = w.rib + (w.bust - w.rib) * bustF;
  const straight = lerp(w.waist, Math.max(w.ub, Math.min(bustW, w.hip) * .97), loose);
  const below = yy => Math.max(A.at(yy), lerp(A.at(yy), straight, loose)) + e;
  let R = shoulderR(A, e, g.drop || 0);
  if (opt.sleeveless) R = [[w.nh + 3.2 * k, y.neck + 1.4 * k], [lerp(w.nh, w.sh - A.arm.uw * .5, .62), lerp(y.neck, y.sh, .7)], [w.sh - A.arm.uw * .95, y.sh + 1], [w.armpit - .2, y.armpit + 2.6 * k]];
  else R.push([w.armpit + e, y.armpit]);
  R.push([bustW + e, y.bust], [lerp(w.ub, bustW, loose * .7) + e, y.underbust]);
  if (hemY > y.waist + 2) R.push([straight + e, y.waist]);
  for (const yy of [y.hipUp, y.hip]) if (yy < hemY - 2) R.push([below(yy), yy]);
  if (hemY > y.hip + 4) {   // 긴 옷: 골반 아래로 다리를 감싸며 조금씩 벌어짐
    const ls = legSide(A, 1, 0).outer.map(([x, v]) => [x - 60, v]), fl = opt.flare ?? .05;
    for (const yy of [y.crotch, y.thigh, y.knee, y.calf]) if (yy < hemY - 2) R.push([Math.max(below(y.hip) + (yy - y.hip) * fl, edgeAt(ls, yy) + e), yy]);
    R.push([Math.max(below(y.hip) + (hemY - y.hip) * fl, edgeAt(ls, hemY) + e), hemY]);
  } else R.push([(hemY > y.waist ? below(hemY) : A.at(hemY) + e) - (g.rib ? 1.4 : 0), hemY]);   // 후디·니트는 밑단 골지가 조임
  return { R, bustW, straight };
}
// 맨살 몸통 (크롭·민소매·목선 사이로 보임)
//   cutY: 하의 윗선까지만 (하의 위로 살이 덮이지 않게)
const bodySkinD = (A, cutY) => { const { y, w } = A, pts = [[w.armpit, y.armpit], [w.bust, y.bust], [w.ub, y.underbust], [w.waist, y.waist], [w.hipUp, y.hipUp], [w.hip - .5, y.hip]].filter(p => p[1] < cutY - 1); return symShape([...shoulderR(A, 0), ...pts, [A.at(cutY), cutY]], cutY + .5, y.neck + 1); };
// 윗옷 (전신): 이너(또는 원피스) → 겉옷 → 소품. 상반신 초상화도 이 함수를 머리 좌표로 옮겨서 씀 → 어깨 폭·가슴 위치가 전신과 같음. X: 세부(목걸이)
function topFull(a, OF, A, skin, X) {
  const { y, w } = A, k = A.hs, sw = v => f1(v * k), nh = w.nh, ny = y.neck, sig = A.adult && A.f ? A.sig : null, tid = `av${UID}t`;
  const dr = OF.dress && DRESSG[OF.dress.k], inner = dr ? { k: dr.as, c: OF.dress.c, pat: OF.dress.pat } : OF.inner || { k: 'tee', c: '#4f6d8f' };
  const G = Object.assign({}, GARM[inner.k] || GARM.tee, inner.sl ? { sl: inner.sl } : {});
  const c = inner.k === 'stripe' ? inner.c : inner.c, dark = shade(c, .78), fold = shade(c, .85), fold2 = shade(c, .58);
  const bottomTop = OF.bottom && SKIRTS[OF.bottom.k] ? y.waist + 1 : lerp(y.waist, y.hip, .28);
  const tucked = !dr && !!OF.tuck && !!OF.bottom && G.hem > 0;
  const hemY = dr ? lerp(y.knee, y.calf, dr.len) : tucked ? y.waist + 3.5 : y.waist + (y.crotch - y.waist) * G.hem;
  const lift = tucked || dr ? 0 : (sig ? sig[4] : 0) + (A.chubbyM || A.chubbyF ? 2 : 0);   // 가슴·배 때문에 밑단 가운데가 들림
  const { R, bustW, straight } = torsoR(A, G, hemY, { sleeveless: G.sl === 'none', flare: dr ? dr.flare : .05 });
  const shapeD = symShape(R, hemY + 1.4 - 2 * lift, ny + 2), stripe = !!G.stripe, fillC = stripe ? STRIPE_BASE : c;
  let pocketT = null, o = `<path d="${bodySkinD(A, dr ? y.waist : bottomTop + (OF.tuck ? 0 : 1.5))}" fill="${skin}"/>`;
  if (G.sl === 'none' || G.hem < 0) o += clav(ny + 4.5 * k, nh + 3 * k, skin, k);
  o += `<defs><clipPath id="${tid}c"><path d="${shapeD}"/></clipPath>${stripe ? `<pattern id="${tid}p" patternUnits="userSpaceOnUse" x="0" y="${f1(ny)}" width="40" height="${sw(7)}"><rect width="40" height="${sw(7)}" fill="${STRIPE_BASE}"/><rect y="${sw(4.2)}" width="40" height="${sw(2.8)}" fill="${c}"/></pattern>` : ''}</defs>`;
  o += `<path d="${shapeD}" fill="${fillC}" stroke="${shade(c, .6)}" stroke-width=".55" stroke-opacity=".55"/>`;
  // 무늬: 줄무늬(가슴에서 휨) / 체크 / 도트 / 위장 / 로고
  if (stripe) {
    const rows = []; for (let yy = ny + 5.6 * k; yy < hemY; yy += 7 * k) rows.push(yy);
    const bz = sig && A.ci >= 1 ? { bx: bustW * .5, cy: y.bust, r: bustW * (.42 + A.ci * .022), amp: Math.min(2.6, .5 + A.ci * .4) * k } : null;
    o += `<g clip-path="url(#${tid}c)">${stripeRows(rows, yy => edgeAt(R, yy), bz, c, 2.8 * k)}</g>`;
  }
  const pat = inner.pat || G.pat;
  if (pat && pat !== 'logo') o += `<g clip-path="url(#${tid}c)">${patternSVG(pat, c, ny - 2, hemY + 2, 60 - w.sh - 8, 60 + w.sh + 8, k, tid + 'q')}</g>`;
  // 원피스 치마 부분: 허리 이음선 / 벨트, 주름
  if (dr) {
    if (dr.seam) o += `<path d="M${f1(60 - edgeAt(R, y.waist))},${f1(y.waist)} Q60,${f1(y.waist + 1.6 * k)} ${f1(60 + edgeAt(R, y.waist))},${f1(y.waist)}" fill="none" stroke="${fold2}" stroke-width="${sw(1)}" opacity=".5"/>`;
    if (dr.belt) o += `<path d="M${f1(60 - edgeAt(R, y.waist) - .3)},${f1(y.waist - 2 * k)} L${f1(60 + edgeAt(R, y.waist) + .3)},${f1(y.waist - 2 * k)} L${f1(60 + edgeAt(R, y.waist) + .3)},${f1(y.waist + 2 * k)} L${f1(60 - edgeAt(R, y.waist) - .3)},${f1(y.waist + 2 * k)} Z" fill="${shade(c, .62)}"/>`;
    const hw = edgeAt(R, hemY);
    o += `<path d="M${f1(60 - w.hip * .4)},${f1(y.hip + 3)} Q${f1(60 - w.hip * .5)},${f1(hemY - 8 * k)} ${f1(60 - hw * .66)},${f1(hemY)} M${f1(60 + w.hip * .38)},${f1(y.hip + 4)} Q${f1(60 + w.hip * .48)},${f1(hemY - 8 * k)} ${f1(60 + hw * .6)},${f1(hemY)}" fill="none" stroke="${fold2}" stroke-width="${sw(1.1)}" opacity=".35"/>`;
  }
  // 목선·디테일
  const nl = (d, edge) => `<path d="${d}" fill="${skin}"/>${clav(ny + 4.4 * k, nh + 1.5 * k, skin, k)}<path d="${d}" fill="none" stroke="${edge || dark}" stroke-width="${sw(2.4)}"/>`;
  const buttons = (x, y0, y1, n, col) => Array.from({ length: n }, (_, i) => `<circle cx="${f1(x)}" cy="${f1(y0 + i * (y1 - y0) / Math.max(1, n - 1))}" r="${sw(1.25)}" fill="${col}"/>`).join('');
  const collar = (open, col) => `<path d="M${f1(60 - nh + 1.5 * k)},${f1(ny)} L60,${f1(ny + (open ? 15 : 7) * k)} L${f1(60 + nh - 1.5 * k)},${f1(ny)} Z" fill="${skin}"/>${open ? clav(ny + 4 * k, nh - 2 * k, skin, k) : ''}` +
    `<path d="M${f1(60 - nh)},${f1(ny - k)} L60,${f1(ny + (open ? 15 : 7) * k)} L${f1(60 - nh + 3 * k)},${f1(ny + (open ? 19 : 12) * k)} L${f1(60 - nh - 6 * k)},${f1(ny + 5 * k)} Z M${f1(60 + nh)},${f1(ny - k)} L60,${f1(ny + (open ? 15 : 7) * k)} L${f1(60 + nh - 3 * k)},${f1(ny + (open ? 19 : 12) * k)} L${f1(60 + nh + 6 * k)},${f1(ny + 5 * k)} Z" fill="${col}" stroke="${dark}" stroke-width="${sw(1)}"/>`;
  const tie = (col, f) => f ? `<path d="M60,${f1(ny + 7 * k)} L${f1(60 - 7 * k)},${f1(ny + 3 * k)} L${f1(60 - 7 * k)},${f1(ny + 11 * k)} Z M60,${f1(ny + 7 * k)} L${f1(60 + 7 * k)},${f1(ny + 3 * k)} L${f1(60 + 7 * k)},${f1(ny + 11 * k)} Z" fill="${col}"/><circle cx="60" cy="${f1(ny + 7 * k)}" r="${sw(2.2)}" fill="${shade(col, .8)}"/>`
    : `<path d="M${f1(60 - 2.4 * k)},${f1(ny + 4.6 * k)} L${f1(60 + 2.4 * k)},${f1(ny + 4.6 * k)} L${f1(60 + 1.6 * k)},${f1(ny + 8 * k)} L${f1(60 + 3.4 * k)},${f1(y.bust + 2 * k)} L60,${f1(y.bust + 6 * k)} L${f1(60 - 3.4 * k)},${f1(y.bust + 2 * k)} L${f1(60 - 1.6 * k)},${f1(ny + 8 * k)} Z" fill="${col}"/>`;
  const nk = G.neck;
  if (nk === 'round') o += nl(`M${f1(60 - nh - 3 * k)},${f1(ny)} Q60,${f1(ny + 13 * k)} ${f1(60 + nh + 3 * k)},${f1(ny)}`);
  else if (nk === 'scoop') o += nl(`M${f1(60 - nh - 4 * k)},${f1(ny + 1)} Q60,${f1(ny + 19 * k)} ${f1(60 + nh + 4 * k)},${f1(ny + 1)}`, shade(c, .7));
  else if (nk === 'crew') {   // 맨투맨·니트: 골지 라운드 넥 (+ 니트 짜임 물결)
    o += `<path d="M${f1(60 - nh - 3 * k)},${f1(ny - k)} Q60,${f1(ny + 9 * k)} ${f1(60 + nh + 3 * k)},${f1(ny - k)} L${f1(60 + nh + 3 * k)},${f1(ny + 4 * k)} Q60,${f1(ny + 14 * k)} ${f1(60 - nh - 3 * k)},${f1(ny + 4 * k)} Z" fill="${dark}"/><path d="M${f1(60 - nh - k)},${f1(ny - k)} Q60,${f1(ny + 7 * k)} ${f1(60 + nh + k)},${f1(ny - k)}" fill="${skin}"/>`;
    if (G.knit) {
      const cable = hash(String(a.fs || a.tc)) % 2;   // 꽈배기 / 무지
      if (cable) o += `<g clip-path="url(#${tid}c)"><path d="${[-1, 0, 1].map(i => { let d = `M${f1(60 + i * bustW * .55)},${f1(ny + 10 * k)}`; for (let yy = ny + 10 * k; yy < hemY - 6 * k; yy += 6 * k) d += ` q${sw(2.4)},${sw(3)} 0,${sw(6)}`; return d; }).join(' ')}" fill="none" stroke="${dark}" stroke-width="${sw(1.6)}" opacity=".35"/></g>`;
      else { const rows = [lerp(y.armpit, y.bust, .5), lerp(y.bust, y.waist, .55)].map(yy => { const half = edgeAt(R, yy) - 2 * k; let d = `M${f1(60 - half)},${f1(yy)}`; for (let x = 60 - half, i = 0; x < 60 + half - 5 * k; x += 6 * k, i++) d += ` q${sw(3)},${sw(i % 2 ? 2.4 : -2.4)} ${sw(6)},0`; return d; }).join(' '); o += `<path d="${rows}" fill="none" stroke="${dark}" stroke-width="${sw(1)}" opacity="${sig ? .18 : .3}"/>`; }
    }
  } else if (nk === 'hood') {   // 후디: 후드 + 끈 + 캥거루 주머니
    const pw = straight * .62 + G.e * .3, py = y.waist - 6 * k;
    const pkD = `M${f1(60 - pw)},${f1(py + 16 * k)} L${f1(60 - pw + 5 * k)},${f1(py)} Q60,${f1(py - 4 * k)} ${f1(60 + pw - 5 * k)},${f1(py)} L${f1(60 + pw)},${f1(py + 16 * k)} Z`;
    pocketT = { x: pw - 2.4 * k, y: py + 7 * k, svg: `<path d="${pkD}" fill="${c}" stroke="${fold2}" stroke-width="${sw(1.3)}" stroke-opacity=".45"/>` };
    o += `<path d="M${f1(60 - nh - 10 * k)},${f1(ny + 5 * k)} C${f1(60 - nh - 9 * k)},${f1(ny - 9 * k)} ${f1(60 + nh + 9 * k)},${f1(ny - 9 * k)} ${f1(60 + nh + 10 * k)},${f1(ny + 5 * k)} C${f1(60 + nh)},${f1(ny + 14 * k)} ${f1(60 - nh)},${f1(ny + 14 * k)} ${f1(60 - nh - 10 * k)},${f1(ny + 5 * k)} Z" fill="${dark}"/>
      <path d="M${f1(60 - nh - k)},${f1(ny)} Q60,${f1(ny + 10 * k)} ${f1(60 + nh + k)},${f1(ny)}" fill="${skin}"/>
      <path d="M${f1(60 - 5 * k)},${f1(ny + 9 * k)} L${f1(60 - 6 * k)},${f1(ny + 28 * k)} M${f1(60 + 5 * k)},${f1(ny + 9 * k)} L${f1(60 + 6 * k)},${f1(ny + 28 * k)}" stroke="${shade(c, 1.5)}" stroke-width="${sw(1.6)}" stroke-linecap="round"/>
      <path d="${pkD}" fill="none" stroke="${fold2}" stroke-width="${sw(1.3)}" opacity=".45"/>`;
  } else if (nk === 'turtle') {   // 터틀넥: 목을 감싸며 접힌 깃(세로 골지)
    const t0 = ny - 6.5 * k, t1 = ny + 3 * k, c0 = nh + 1.6 * k, c1 = nh + 3.4 * k;
    let ribs = '';
    for (let i = -3; i <= 3; i++) ribs += `M${f1(60 + i * c0 / 3.7)},${f1(t0 + 1.4 * k)} L${f1(60 + i * c1 / 3.7)},${f1(t1 + 1.8 * k)} `;
    o += `<path d="M${f1(60 - c0)},${f1(t0)} Q60,${f1(t0 + 1.8 * k)} ${f1(60 + c0)},${f1(t0)} L${f1(60 + c1)},${f1(t1)} Q60,${f1(t1 + 3.2 * k)} ${f1(60 - c1)},${f1(t1)} Z" fill="${c}" stroke="${shade(c, .6)}" stroke-width=".5"/>
      <path d="${ribs}" stroke="${dark}" stroke-width="${sw(.8)}" opacity=".5"/><path d="M${f1(60 - c0 - .4 * k)},${f1(t0 + 3 * k)} Q60,${f1(t0 + 5 * k)} ${f1(60 + c0 + .4 * k)},${f1(t0 + 3 * k)}" fill="none" stroke="${fold2}" stroke-width="${sw(1.1)}" opacity=".4"/>`;
  } else if (nk === 'boat') {   // 줄무늬 보트넥
    const d = `M${f1(60 - nh - 7 * k)},${f1(ny - .8 * k)} Q60,${f1(ny + 9 * k)} ${f1(60 + nh + 7 * k)},${f1(ny - .8 * k)}`;
    o += `<g clip-path="url(#${tid}c)"><path d="${d}" fill="${skin}"/>${clav(ny + 3.2 * k, nh + 3 * k, skin, k)}<path d="${d}" fill="none" stroke="${shade(STRIPE_BASE, .82)}" stroke-width="${sw(1.8)}"/></g>`;
  } else if (nk === 'collar') {   // 셔츠·체크·작업복·군복·잠옷·경찰·하복: 칼라 + 단추 선
    const open = !inner.tie && !G.school, col = G.piping ? '#fbf8f2' : shade(c, 1.12);
    o += collar(open, col);
    if (G.placket) o += `<path d="M60,${f1(ny + (open ? 15 : 7) * k)} L60,${f1(hemY - 1)}" stroke="${dark}" stroke-width="${sw(1.2)}"/>` + buttons(60, ny + 20 * k, hemY - 6 * k, 4, dark);
    if (G.zipC) o += `<path d="M60,${f1(ny + 7 * k)} L60,${f1(hemY - 1)}" stroke="${shade(c, .55)}" stroke-width="${sw(1.4)}" stroke-dasharray="${sw(.8)} ${sw(.6)}"/>`;
    if (inner.tie || G.school) o += tie(inner.tieC || (G.school ? UNIFORM.tie[a.tie % 3] : ['#7d2f3d', '#2c4a7a', '#3b3e48'][a.tie % 3]), G.school && A.f);
    if (G.school) o += `<path d="M${f1(60 + w.rib * .45)},${f1(y.bust - 5 * k)} l${sw(6)},0 l0,${sw(5)} q${sw(-3)},${sw(3)} ${sw(-6)},0 Z" fill="#2f3a5a" opacity=".85"/>`;
    if (G.patch) o += `<path d="M${f1(60 + w.rib * .38)},${f1(y.bust - 6 * k)} l${sw(8)},0 l0,${sw(7)} l${sw(-4)},${sw(2.6)} l${sw(-4)},${sw(-2.6)} Z" fill="#c8a24a"/><path d="M${f1(60 - w.rib * .62)},${f1(y.bust - 5 * k)} l${sw(9)},0" stroke="#e8e6df" stroke-width="${sw(2)}"/>`;
    if (G.pocket) o += [-1, 1].slice(0, G.pocket).map(s => `<path d="M${f1(60 + s * w.rib * .58 - 4.5 * k)},${f1(y.bust - 6 * k)} l${sw(9)},0 l0,${sw(9)} l${sw(-9)},0 Z M${f1(60 + s * w.rib * .58 - 4.5 * k)},${f1(y.bust - 3.4 * k)} l${sw(9)},0" fill="${shade(c, .94)}" stroke="${dark}" stroke-width="${sw(.8)}"/>`).join('');
    if (!A.f && !G.pocket && !G.patch && G.placket && inner.k === 'shirt') o += `<path d="M${f1(60 + w.rib * .3)},${f1(y.bust - 6 * k)} l${sw(9)},0 l0,${sw(9)} l${sw(-9)},0 Z" fill="none" stroke="${dark}" stroke-width="${sw(1)}" opacity=".6"/>`;
    if (G.piping) o += `<path d="${shapeD}" fill="none" stroke="#fbf8f2" stroke-width="${sw(1.2)}" opacity=".7"/>`;
    if (sig && A.ci >= 5 && G.placket && !G.pocket) o += `<path d="M60,${f1(y.bust - 2.4)} Q61.4,${f1(y.bust)} 60,${f1(y.bust + 2.4)} Q58.6,${f1(y.bust)} 60,${f1(y.bust - 2.4)} Z" fill="${shade(skin, .92)}" stroke="${dark}" stroke-width=".5"/>`;   // 단추 사이 벌어짐
  } else if (nk === 'blouse') {   // 블라우스: 리본 / 프릴 칼라 / 라운드 넥 + 퍼프소매 중 하나
    const v = hash(String(a.fs || a.tc) + 'bl') % 3;
    o += nl(`M${f1(60 - nh - 2 * k)},${f1(ny)} Q60,${f1(ny + 10 * k)} ${f1(60 + nh + 2 * k)},${f1(ny)}`, shade(c, .7));
    if (v === 0) o += `<path d="M60,${f1(ny + 6 * k)} l${sw(-6)},${sw(-3.4)} l0,${sw(6.8)} Z M60,${f1(ny + 6 * k)} l${sw(6)},${sw(-3.4)} l0,${sw(6.8)} Z M60,${f1(ny + 6 * k)} l${sw(-3)},${sw(10)} M60,${f1(ny + 6 * k)} l${sw(3.4)},${sw(10)}" fill="${shade(c, .9)}" stroke="${shade(c, .65)}" stroke-width="${sw(1)}" stroke-linecap="round"/>`;
    else if (v === 1) o += `<path d="M${f1(60 - nh - 3 * k)},${f1(ny + k)} ${scallop(60 - nh - 3 * k, 60 + nh + 3 * k, ny + 7 * k, 2.6 * k, 8).replace(/^/, '')}" fill="none" stroke="${shade(c, 1.2)}" stroke-width="${sw(2.2)}"/>`;
    o += buttons(60, ny + 14 * k, hemY - 6 * k, 3, shade(c, 1.25));
  } else if (nk === 'polo') {   // 폴로: 짧은 칼라 + 단추 2개
    o += `<path d="M${f1(60 - 2 * k)},${f1(ny)} L${f1(60 - 2 * k)},${f1(ny + 12 * k)} L${f1(60 + 2 * k)},${f1(ny + 12 * k)} L${f1(60 + 2 * k)},${f1(ny)} Z" fill="${skin}"/>` + buttons(60, ny + 5 * k, ny + 10 * k, 2, shade(c, 1.4)) +
      `<path d="M${f1(60 - nh - k)},${f1(ny - k)} L${f1(60 - 2 * k)},${f1(ny + 2 * k)} L${f1(60 - nh - 5 * k)},${f1(ny + 5 * k)} Z M${f1(60 + nh + k)},${f1(ny - k)} L${f1(60 + 2 * k)},${f1(ny + 2 * k)} L${f1(60 + nh + 5 * k)},${f1(ny + 5 * k)} Z" fill="${shade(c, 1.1)}" stroke="${dark}" stroke-width="${sw(.8)}"/>`;
  } else if (nk === 'zip') {   // 집업 트레이닝·바람막이·래시가드: 스탠드 칼라 + 지퍼 + (트레이닝) 옆줄
    o += `<path d="M${f1(60 - nh - 1.4 * k)},${f1(ny + 2 * k)} L${f1(60 - nh - 1.2 * k)},${f1(ny - 4 * k)} Q60,${f1(ny - 2 * k)} ${f1(60 + nh + 1.2 * k)},${f1(ny - 4 * k)} L${f1(60 + nh + 1.4 * k)},${f1(ny + 2 * k)} Q60,${f1(ny + 4 * k)} ${f1(60 - nh - 1.4 * k)},${f1(ny + 2 * k)} Z" fill="${shade(c, .9)}" stroke="${dark}" stroke-width="${sw(.7)}"/>` +
      `<path d="M60,${f1(ny - 2.6 * k)} L60,${f1(hemY - 1)}" stroke="${shade(c, .55)}" stroke-width="${sw(1.3)}" stroke-dasharray="${sw(.8)} ${sw(.6)}"/>`;
    if (G.stripes) o += `<g clip-path="url(#${tid}c)"><path d="M${f1(60 - edgeAt(R, y.armpit) + 1.6 * k)},${f1(y.armpit)} L${f1(60 - edgeAt(R, hemY) + 1.6 * k)},${f1(hemY)} M${f1(60 + edgeAt(R, y.armpit) - 1.6 * k)},${f1(y.armpit)} L${f1(60 + edgeAt(R, hemY) - 1.6 * k)},${f1(hemY)}" stroke="#f2efe9" stroke-width="${sw(1.6)}"/></g>`;
  } else if (nk === 'v') {   // 간호복: V넥 + 가슴 주머니
    o += nl(`M${f1(60 - nh - 1.5 * k)},${f1(ny)} L60,${f1(ny + 14 * k)} L${f1(60 + nh + 1.5 * k)},${f1(ny)}`, shade(c, .7)) + `<path d="M${f1(60 - w.rib * .62)},${f1(y.bust - 3 * k)} l${sw(9)},0 l0,${sw(8)} l${sw(-9)},0 Z" fill="none" stroke="${dark}" stroke-width="${sw(.9)}"/><path d="M${f1(60 - w.rib * .5)},${f1(y.bust - 6 * k)} l0,${sw(4)}" stroke="#2b5fa8" stroke-width="${sw(1)}"/>`;
  } else if (nk === 'mandarin') {   // 셰프복(이중 단추) / 방화복(반사띠): 스탠드 칼라
    o += `<path d="M${f1(60 - nh - 1.4 * k)},${f1(ny + 2 * k)} L${f1(60 - nh - 1.2 * k)},${f1(ny - 3.4 * k)} Q60,${f1(ny - 1.6 * k)} ${f1(60 + nh + 1.2 * k)},${f1(ny - 3.4 * k)} L${f1(60 + nh + 1.4 * k)},${f1(ny + 2 * k)} Q60,${f1(ny + 4 * k)} ${f1(60 - nh - 1.4 * k)},${f1(ny + 2 * k)} Z" fill="${shade(c, .94)}" stroke="${dark}" stroke-width="${sw(.7)}"/>`;
    if (G.double) o += buttons(60 - 4.6 * k, ny + 9 * k, hemY - 8 * k, 4, shade(c, .5)) + buttons(60 + 4.6 * k, ny + 9 * k, hemY - 8 * k, 4, shade(c, .5)) + `<path d="M${f1(60 + 6.8 * k)},${f1(ny + 3 * k)} Q${f1(60 + 8 * k)},${f1(lerp(ny, hemY, .5))} ${f1(60 + 6.8 * k)},${f1(hemY - 1)}" fill="none" stroke="${dark}" stroke-width="${sw(.9)}" opacity=".6"/>`;
    if (G.reflect) o += `<g clip-path="url(#${tid}c)"><path d="M0,${f1(lerp(y.bust, y.waist, .4))} L120,${f1(lerp(y.bust, y.waist, .4))} M0,${f1(lerp(y.waist, hemY, .6))} L120,${f1(lerp(y.waist, hemY, .6))}" stroke="#d9e04a" stroke-width="${sw(3.4)}"/><path d="M0,${f1(lerp(y.bust, y.waist, .4))} L120,${f1(lerp(y.bust, y.waist, .4))} M0,${f1(lerp(y.waist, hemY, .6))} L120,${f1(lerp(y.waist, hemY, .6))}" stroke="#c9ced6" stroke-width="${sw(1.2)}"/></g><path d="M60,${f1(ny + 2 * k)} L60,${f1(hemY - 1)}" stroke="${shade(c, .5)}" stroke-width="${sw(1.4)}"/>`;
  } else if (nk === 'uniform') {   // 교복 동복: 셔츠 V + 라펠 + 넥타이/리본 + 단추 + 왼가슴 마크
    const tc = UNIFORM.tie[a.tie % 3], vy = lerp(y.armpit, y.bust, .85);
    o += `<path d="M${f1(60 - nh - k)},${f1(ny)} L60,${f1(vy)} L${f1(60 + nh + k)},${f1(ny)} Z" fill="${UNIFORM.shirt}"/>
      <path d="M${f1(60 - nh - k)},${f1(ny)} L60,${f1(vy)} L${f1(60 - nh - 8 * k)},${f1(vy - 4 * k)} L${f1(60 - nh - 9 * k)},${f1(ny + 4 * k)} Z M${f1(60 + nh + k)},${f1(ny)} L60,${f1(vy)} L${f1(60 + nh + 8 * k)},${f1(vy - 4 * k)} L${f1(60 + nh + 9 * k)},${f1(ny + 4 * k)} Z" fill="${shade(c, 1.25)}"/>` +
      (A.f ? tie(tc, true) : `<path d="M${f1(60 - 3 * k)},${f1(ny + 3 * k)} L${f1(60 + 3 * k)},${f1(ny + 3 * k)} L${f1(60 + 2 * k)},${f1(ny + 7 * k)} L${f1(60 + 4 * k)},${f1(vy - 4 * k)} L60,${f1(vy + k)} L${f1(60 - 4 * k)},${f1(vy - 4 * k)} L${f1(60 - 2 * k)},${f1(ny + 7 * k)} Z" fill="${tc}"/>`) +
      `<circle cx="60" cy="${f1(y.waist - 6 * k)}" r="${sw(1.6)}" fill="${shade(c, 1.5)}"/><circle cx="60" cy="${f1(y.waist + 6 * k)}" r="${sw(1.6)}" fill="${shade(c, 1.5)}"/>
      <path d="M${f1(60 + w.rib * .45)},${f1(y.bust - 5 * k)} l${sw(7)},0 l0,${sw(5.6)} q${sw(-3.5)},${sw(3.4)} ${sw(-7)},0 Z" fill="#c8a24a" opacity=".85"/>
      <path d="M60,${f1(vy)} L60,${f1(hemY)}" stroke="${shade(c, .6)}" stroke-width="${sw(1)}" opacity=".6"/>`;
  }
  if (pat === 'logo') {   // 가슴 작은 프린트 (원 / 글자 줄 / 별)
    const v = hash(String(a.fs || a.tc) + inner.k) % 3, lx = 60 + (v === 1 ? w.rib * .4 : 0), ly = lerp(y.armpit, y.bust, .7), lc = shade(c, c === '#2a2a2e' || c === '#3b3e48' ? 2 : .45);
    o += v === 0 ? `<circle cx="${f1(lx)}" cy="${f1(ly)}" r="${sw(4.6)}" fill="none" stroke="${lc}" stroke-width="${sw(1.4)}"/><circle cx="${f1(lx)}" cy="${f1(ly)}" r="${sw(1.6)}" fill="${lc}"/>`
      : v === 1 ? `<path d="M${f1(lx - 3 * k)},${f1(ly - 2 * k)} l${sw(7)},0 M${f1(lx - 3 * k)},${f1(ly + .4 * k)} l${sw(5)},0" stroke="${lc}" stroke-width="${sw(1.3)}" stroke-linecap="round"/>`
      : `<path d="M${f1(lx - 9 * k)},${f1(ly - 2 * k)} L${f1(lx + 9 * k)},${f1(ly - 2 * k)} M${f1(lx - 7 * k)},${f1(ly + 2 * k)} L${f1(lx + 7 * k)},${f1(ly + 2 * k)}" stroke="${lc}" stroke-width="${sw(2)}" stroke-linecap="round"/>`;
  }
  if (G.rib && !dr) o += hemRib(edgeAt(R, hemY), hemY, k, dark);
  // 목걸이 (어른 여자, 목선이 트인 옷)
  if (X && X.chain && A.adult && A.f && ['round', 'scoop', 'collar', 'boat', 'v', 'blouse'].includes(nk) && !(OF.outer && OUTG[OF.outer.k] && OUTG[OF.outer.k].open === 'closed')) {
    const m = METAL[X.metal], cy0 = ny - .8 * k, d = nk === 'collar' ? 10 : 7.5;
    o += `<path d="M${f1(60 - nh + .8 * k)},${f1(cy0)} Q60,${f1(cy0 + d * 2 * k)} ${f1(60 + nh - .8 * k)},${f1(cy0)}" fill="none" stroke="${m}" stroke-width="${sw(.55)}"/><circle cx="60" cy="${f1(cy0 + d * k + .6 * k)}" r="${sw(1.1)}" fill="${m}"/>`;
  }
  // 주름 (3-6, 위치 고정): 겨드랑이, 허리(넣어 입으면 위로 부풀어 겹침 / 몸에 붙는 옷은 옆 주름) — 옷 색 -15%
  const sf = `fill="none" stroke="${fold}" stroke-linecap="round"`, ax = edgeAt(R, y.armpit);
  o += `<path d="M${f1(60 - ax + 1.2 * k)},${f1(y.armpit + 1)} q${sw(2.6)},${sw(2)} ${sw(1.4)},${sw(6)} M${f1(60 + ax - 1.2 * k)},${f1(y.armpit + 1)} q${sw(-2.6)},${sw(2)} ${sw(-1.4)},${sw(6)}" ${sf} stroke-width="${sw(1.1)}" opacity=".9"/>`;
  if (tucked) o += `<path d="${[-1, 1].map(s => `M${f1(60 + s * (straight + G.e - 1.5 * k))},${f1(hemY - 3 * k)} q${f1(-s * 3 * k)},${sw(-1.6)} ${f1(-s * 6.5 * k)},${sw(.4)} M${f1(60 + s * (straight * .55))},${f1(hemY - 2.6 * k)} q${f1(-s * 2.4 * k)},${sw(-1.4)} ${f1(-s * 5 * k)},${sw(.2)}`).join(' ')}" ${sf} stroke-width="${sw(1.1)}" opacity=".9"/>`;
  else if (G.fit && hemY > y.waist + 2 && !dr) { const wx = straight + G.e; o += `<path d="${[-1, 1].map(s => `M${f1(60 + s * (wx - 2.5 * k))},${f1(y.waist - 7 * k)} L${f1(60 + s * (wx - 2 * k))},${f1(y.waist + k)}`).join(' ')}" ${sf} stroke-width="${sw(1.1)}" opacity=".8"/>`; }
  // 가슴: 밑가슴 그림자 곡선 + 윗면 옅은 빛 (컵이 클수록 짙게, 헐렁한 옷은 약하게, 몸에 붙는 옷은 가운데 골)
  if (sig && A.ci >= 1) {
    const bx = bustW * .5, r = bustW * (.42 + A.ci * .022), op = Math.min(.34, .08 + A.ci * .04) * (G.fit ? 1 : .6);
    o += `<g clip-path="url(#${tid}c)">${bustCloth(tid + 'b', bx, y.bust, r, shade(stripe ? '#8d8679' : c, .5), op, G.fit && A.ci >= 4 && !['collar', 'uniform'].includes(nk), k)}</g>`;
  } else if (!A.f && A.adult && A.fitM && G.fit) o += `<path d="M${f1(60 - w.rib * .7)},${f1(y.bust + 1)} Q${f1(60 - w.rib * .35)},${f1(y.bust + 3)} 59,${f1(y.bust + 1.5)} M${f1(60 + w.rib * .7)},${f1(y.bust + 1)} Q${f1(60 + w.rib * .35)},${f1(y.bust + 3)} 61,${f1(y.bust + 1.5)}" ${sf} stroke-width=".9" opacity=".5"/>`;   // 가슴 근육 아래 옅은 선 하나 (근육형만)
  // 오버핏: 내려온 어깨 솔기
  if (G.drop) o += `<path d="${[-1, 1].map(s => `M${f1(60 + s * (w.sh - A.arm.uw * .6 + G.e * .3))},${f1(y.sh + A.arm.uw * .6 + G.drop)} q${f1(s * A.arm.uw * .3)},${sw(1.2)} ${f1(s * A.arm.uw * .7)},${sw(.8)}`).join(' ')}" fill="none" stroke="${shade(c, .7)}" stroke-width="${sw(.9)}" opacity=".7"/>`;
  let T = { color: c, fill: stripe ? `url(#${tid}p)` : null, sleeve: G.sl === 'puff' ? 'short' : G.sl, puff: G.sl === 'puff', cuff: G.cuff, sleeveE: G.e * .7, R, hemY, bustEdge: bustW + G.e, straight };
  // 겉옷
  if (OF.outer && OUTG[OF.outer.k]) T = outerSVG(a, OF.outer, A, skin, G, R, T, (s2) => { o += s2; }, tid);
  // 소품: 앞치마 / 사원증 / 목도리 / 가방 끈
  o += accTop(OF, A, T, skin, tid);
  return { svg: o, color: T.color, fill: T.fill, sleeve: T.sleeve, puff: T.puff, cuff: T.cuff, sleeveE: T.sleeveE, gw: yy => edgeAt(T.R, yy), bustEdge: T.bustEdge, hemY: T.hemY, pocket: OF.outer && !OUTG[OF.outer.k]?.sleeveless ? null : pocketT, lowC: OF.bottom ? OF.bottom.c : null, watch: !!(OF.acc && OF.acc.watch), umbrella: !!(OF.acc && OF.acc.umbrella) };
}
// 겉옷 그리기: 이너 위에, 앞이 열려(evenodd 구멍) 이너가 보임. 반환: 소매·윤곽은 겉옷 기준
function outerSVG(a, OU, A, skin, Gi, Ri, Ti, put, tid) {
  const { y, w } = A, k = A.hs, sw = v => f1(v * k), nh = w.nh, ny = y.neck, OG = OUTG[OU.k], oc = OU.c, dk = shade(oc, .62), fold = shade(oc, .85);
  const g = { e: Math.max(OG.e, Gi.e + 1.2), loose: Math.max(OG.loose, Gi.loose * .8), bust: .55, rib: OG.rib };
  const lenY = { waist: lerp(y.waist, y.hip, .45), hip: lerp(y.hip, y.crotch, .5), thigh: lerp(y.crotch, y.thigh, .7), knee: y.knee + 2, calf: lerp(y.knee, y.calf, .9) }[OG.len];
  const { R, bustW } = torsoR(A, g, lenY, { flare: OG.len === 'knee' || OG.len === 'calf' ? .07 : .02, sleeveless: !!OG.sleeveless });
  if (OG.sleeveless) { R[0][0] += 1.5 * k; }
  const od = symShape(R, lenY + 1.2, ny + 2), nw = nh + 1.2 * k, top = ny + 1.8 * k;
  const vy = { v: lerp(y.bust, y.underbust, .5), lapel: OG.len === 'thigh' ? lerp(y.bust, y.underbust, .7) : lerp(y.armpit, y.bust, .9), asym: y.bust, zip: lerp(ny, y.bust, .3) }[OG.open];
  const gap = 2.6 * k;
  let open = '';
  if (OG.open === 'straight') open = `M${f1(60 - nw)},${f1(top)} L${f1(60 - gap)},${f1(top + 8 * k)} L${f1(60 - gap)},${f1(lenY - 2.4)} L${f1(60 + gap)},${f1(lenY - 2.4)} L${f1(60 + gap)},${f1(top + 8 * k)} L${f1(60 + nw)},${f1(top)} Z`;
  else if (OG.open === 'asym') open = `M${f1(60 - nw)},${f1(top)} L${f1(60 + 5 * k)},${f1(vy)} L${f1(60 + nw)},${f1(top)} Z`;
  else if (vy) open = `M${f1(60 - nw)},${f1(top)} L60,${f1(vy)} L${f1(60 + nw)},${f1(top)} Z`;
  let o = '';
  if (OG.collar === 'hood') o += `<path d="M${f1(60 - nh - 12 * k)},${f1(ny + 6 * k)} C${f1(60 - nh - 11 * k)},${f1(ny - 10 * k)} ${f1(60 + nh + 11 * k)},${f1(ny - 10 * k)} ${f1(60 + nh + 12 * k)},${f1(ny + 6 * k)} Z" fill="${dk}"/>`;   // 롱패딩 후드 (목 뒤)
  o += `<path d="${od} ${open}" fill="${oc}" fill-rule="evenodd" stroke="${shade(oc, .55)}" stroke-width=".6"/>`;
  o += `<defs><clipPath id="${tid}o" clip-rule="evenodd"><path d="${od} ${open}"/></clipPath></defs>`;
  const inC = `clip-path="url(#${tid}o)"`;
  // 디테일
  if (OG.quilt) { let d = ''; for (let yy = y.armpit; yy < lenY - 2; yy += 8 * k) d += `M0,${f1(yy)} Q60,${f1(yy + 2.6 * k)} 120,${f1(yy)} `; o += `<g ${inC}><path d="${d}" fill="none" stroke="${fold}" stroke-width="${sw(1.4)}"/><path d="${d}" fill="none" stroke="${shade(oc, 1.35)}" stroke-width="${sw(.7)}" transform="translate(0,${sw(-1.6)})" opacity=".5"/></g>`; }
  if (OG.fluffy) o += `<path d="${od}" fill="none" stroke="${shade(oc, 1.15)}" stroke-width="${sw(1.6)}" stroke-dasharray="${sw(.6)} ${sw(1.4)}" opacity=".6"/>`;
  if (OG.shine) o += `<g ${inC}><path d="M${f1(60 - bustW * .7)},${f1(y.armpit + 3)} q${sw(-2)},${sw(10)} ${sw(-1)},${sw(20)} M${f1(60 + bustW * .55)},${f1(y.bust)} q${sw(1.4)},${sw(8)} ${sw(.6)},${sw(14)}" fill="none" stroke="#fff" stroke-width="${sw(1.6)}" opacity=".25"/></g>`;
  if (OG.denim) o += `<g ${inC}><path d="M${f1(60 - edgeAt(R, y.armpit))},${f1(y.armpit)} Q60,${f1(y.armpit + 3 * k)} ${f1(60 + edgeAt(R, y.armpit))},${f1(y.armpit)}" fill="none" stroke="#d2a659" stroke-width="${sw(.8)}" stroke-dasharray="${sw(2)} ${sw(1.4)}" opacity=".8"/>${[-1, 1].map(s => `<path d="M${f1(60 + s * bustW * .55 - 4.5 * k)},${f1(y.armpit + 4 * k)} l${sw(9)},0 l0,${sw(7)} l${sw(-4.5)},${sw(2)} l${sw(-4.5)},${sw(-2)} Z" fill="none" stroke="#d2a659" stroke-width="${sw(.8)}" stroke-dasharray="${sw(1.6)} ${sw(1.2)}"/>`).join('')}</g>`;
  if (OG.belt) { const yb = y.waist, hw = edgeAt(R, yb); o += `<path d="M${f1(60 - hw)},${f1(yb - 2.4 * k)} L${f1(60 + hw)},${f1(yb - 2.4 * k)} L${f1(60 + hw)},${f1(yb + 2.4 * k)} L${f1(60 - hw)},${f1(yb + 2.4 * k)} Z" fill="${shade(oc, .9)}" stroke="${dk}" stroke-width="${sw(.6)}"/><rect x="${f1(60 - 3 * k)}" y="${f1(yb - 3 * k)}" width="${sw(6)}" height="${sw(6)}" rx="${sw(.8)}" fill="none" stroke="${dk}" stroke-width="${sw(1.1)}"/><path d="M${f1(60 + 2 * k)},${f1(yb + 2 * k)} q${sw(2)},${sw(6)} ${sw(-1)},${sw(12)}" fill="none" stroke="${shade(oc, .9)}" stroke-width="${sw(3.2)}" stroke-linecap="round"/>`; }
  if (OG.pocket || OG.len === 'knee' || OG.len === 'thigh') o += [-1, 1].map(s => `<path d="M${f1(60 + s * edgeAt(R, y.hip) * .45 - 5 * k)},${f1(y.hip + 1)} l${sw(10)},0" stroke="${dk}" stroke-width="${sw(1.2)}" stroke-linecap="round" opacity=".8"/>`).join('');
  if (OG.btn && OG.open !== 'straight') { const x0 = OG.open === 'lapel' ? 60 + 1.4 * k : 60; const yy0 = (vy || ny) + 4 * k, yy1 = Math.min(OG.belt ? y.waist - 5 * k : lenY - 6 * k, (vy || ny) + (OG.btn - 1) * 11 * k); o += Array.from({ length: OG.btn }, (_, i) => `<circle cx="${f1(x0)}" cy="${f1(yy0 + i * (yy1 - yy0) / Math.max(1, OG.btn - 1))}" r="${sw(1.4)}" fill="${shade(oc, OG.open === 'v' ? 1.35 : .55)}"/>`).join(''); }
  if (OG.open === 'lapel' || OG.collar === 'notch') {   // 노치드 라펠
    const lv = OG.open === 'lapel' ? vy : vy - 4 * k, lap = sd => { const X = v => f1(60 + sd * v); return `M${X(nw)},${f1(top - .6 * k)} L${X(.4 * k)},${f1(lv)} L${X(nh + 7.6 * k)},${f1(lerp(ny, lv, .32))} L${X(nh + 8.4 * k)},${f1(ny + 5.6 * k)} L${X(nh + 5.4 * k)},${f1(ny + 5 * k)} L${X(nh + 6.4 * k)},${f1(ny + 1.2 * k)} Z`; };
    o += `<path d="${lap(-1)} ${lap(1)}" fill="${shade(oc, 1.1)}" stroke="${dk}" stroke-width="${sw(.6)}" stroke-linejoin="round"/>`;
    if (OG.open === 'lapel') o += `<path d="M60,${f1(vy)} L60,${f1(lenY)}" stroke="${dk}" stroke-width="${sw(1)}"/>`;
  }
  if (OG.open === 'v') o += `<path d="M${f1(60 - nw)},${f1(top)} L60,${f1(vy)} L${f1(60 + nw)},${f1(top)} M60,${f1(vy)} L60,${f1(lenY)}" fill="none" stroke="${shade(oc, .74)}" stroke-width="${sw(2.2)}" stroke-linejoin="round"/>`;   // 가디건 앞단
  if (OG.open === 'straight') o += `<path d="M${f1(60 - gap)},${f1(top + 8 * k)} L${f1(60 - gap)},${f1(lenY - 1)} M${f1(60 + gap)},${f1(top + 8 * k)} L${f1(60 + gap)},${f1(lenY - 1)}" stroke="${dk}" stroke-width="${sw(1.2)}"/>`;
  if (OG.open === 'zip' || OG.open === 'closed' || OG.open === 'asym') { const zx = OG.open === 'asym' ? 60 + 5 * k : 60; o += `<path d="M${f1(zx)},${f1(vy || ny + 2 * k)} L${f1(OG.open === 'asym' ? 60 + 3 * k : 60)},${f1(lenY - 1)}" stroke="${shade(oc, .5)}" stroke-width="${sw(1.4)}" stroke-dasharray="${sw(.8)} ${sw(.6)}"/>`; }
  if (OG.collar === 'stand') o += `<path d="M${f1(60 - nh - 2 * k)},${f1(ny + 3 * k)} L${f1(60 - nh - 1.6 * k)},${f1(ny - 4.4 * k)} Q60,${f1(ny - 2.6 * k)} ${f1(60 + nh + 1.6 * k)},${f1(ny - 4.4 * k)} L${f1(60 + nh + 2 * k)},${f1(ny + 3 * k)} Q60,${f1(ny + 5 * k)} ${f1(60 - nh - 2 * k)},${f1(ny + 3 * k)} Z" fill="${shade(oc, .92)}" stroke="${dk}" stroke-width="${sw(.7)}"/>`;
  if (OG.collar === 'shirt') o += `<path d="M${f1(60 - nw)},${f1(top - k)} L${f1(60 - nw + 4 * k)},${f1(top + 10 * k)} L${f1(60 - nw - 7 * k)},${f1(top + 5 * k)} Z M${f1(60 + nw)},${f1(top - k)} L${f1(60 + nw - 4 * k)},${f1(top + 10 * k)} L${f1(60 + nw + 7 * k)},${f1(top + 5 * k)} Z" fill="${shade(oc, 1.08)}" stroke="#d2a659" stroke-width="${sw(.7)}"/>`;
  if (OU.reflect) o += `<g ${inC}><path d="M0,${f1(lerp(y.bust, y.waist, .3))} L120,${f1(lerp(y.bust, y.waist, .3))} M0,${f1(lerp(y.waist, lenY, .55))} L120,${f1(lerp(y.waist, lenY, .55))}" stroke="#c9ced6" stroke-width="${sw(3)}"/></g>`;
  if (OG.rib) o += hemRib(edgeAt(R, lenY), lenY, k, shade(oc, .78));
  // 겉옷 겨드랑이 주름
  const ax = edgeAt(R, y.armpit);
  o += `<path d="M${f1(60 - ax + 1.2 * k)},${f1(y.armpit + 1)} q${sw(2.6)},${sw(2)} ${sw(1.4)},${sw(6)} M${f1(60 + ax - 1.2 * k)},${f1(y.armpit + 1)} q${sw(-2.6)},${sw(2)} ${sw(-1.4)},${sw(6)}" fill="none" stroke="${fold}" stroke-width="${sw(1.1)}" stroke-linecap="round"/>`;
  put(o);
  if (OG.sleeveless) return Object.assign({}, Ti, { R: R.map((p, i) => p), hemY: Math.max(Ti.hemY, lenY), bustEdge: Math.max(Ti.bustEdge, bustW + g.e) });
  return { color: oc, fill: null, sleeve: 'long', puff: false, cuff: .9, sleeveE: g.e * .7, R, hemY: lenY, bustEdge: bustW + g.e, straight: Ti.straight };
}
// 소품 (윗몸): 앞치마 / 사원증 / 목도리 / 가방 끈 (크로스·숄더·백팩)
function accTop(OF, A, T, skin, tid) {
  const { y, w } = A, k = A.hs, sw = v => f1(v * k), ny = y.neck, nh = w.nh, ac = OF.acc || {};
  let o = '';
  if (ac.apron) {   // 카페·셰프 앞치마: 가슴에서 허벅지까지 + 목끈·허리끈
    const c = ac.apron, top = lerp(y.armpit, y.bust, .5), bot = lerp(y.crotch, y.knee, .45), tw = Math.min(w.rib * .62, 13 * k), bw = w.hip * .9;
    o += `<path d="M${f1(60 - tw)},${f1(top)} L${f1(60 + tw)},${f1(top)} L${f1(60 + tw + 1)},${f1(y.waist)} L${f1(60 + bw)},${f1(bot)} Q60,${f1(bot + 2 * k)} ${f1(60 - bw)},${f1(bot)} L${f1(60 - tw - 1)},${f1(y.waist)} Z" fill="${c}" stroke="${shade(c, .65)}" stroke-width=".6"/>` +
      `<path d="M${f1(60 - tw + 1)},${f1(top)} L${f1(60 - nh + 1)},${f1(ny + 1)} M${f1(60 + tw - 1)},${f1(top)} L${f1(60 + nh - 1)},${f1(ny + 1)} M${f1(60 - T.straight - 3)},${f1(y.waist)} L${f1(60 + T.straight + 3)},${f1(y.waist)}" stroke="${shade(c, .8)}" stroke-width="${sw(1.6)}" stroke-linecap="round"/>` +
      `<path d="M${f1(60 - bw * .55)},${f1(lerp(y.waist, bot, .45))} l${sw(10)},0 l0,${sw(7)} l${sw(-10)},0 Z" fill="none" stroke="${shade(c, .65)}" stroke-width="${sw(.8)}"/>`;
  }
  if (ac.badge) {   // 사원증: 목줄 V + 카드
    const cy = lerp(y.bust, y.underbust, .9);
    o += `<path d="M${f1(60 - nh + .5)},${f1(ny + .5)} L${f1(60 - 1.2 * k)},${f1(cy - 5 * k)} M${f1(60 + nh - .5)},${f1(ny + .5)} L${f1(60 + 1.2 * k)},${f1(cy - 5 * k)}" stroke="#2b5fa8" stroke-width="${sw(1.2)}"/><rect x="${f1(60 - 4 * k)}" y="${f1(cy - 5 * k)}" width="${sw(8)}" height="${sw(10)}" rx="${sw(1)}" fill="#f7f6f3" stroke="#9aa2ad" stroke-width="${sw(.6)}"/><rect x="${f1(60 - 2.6 * k)}" y="${f1(cy - 3.6 * k)}" width="${sw(5.2)}" height="${sw(3.6)}" fill="#a9c6dc"/>`;
  }
  if (ac.scarf) {   // 목도리: 목을 감싸고 한쪽 끝이 가슴 앞으로
    const c = ac.scarf, top2 = ny - 4 * k;
    o += `<path d="M${f1(60 - nh - 4 * k)},${f1(top2)} Q60,${f1(top2 + 3 * k)} ${f1(60 + nh + 4 * k)},${f1(top2)} L${f1(60 + nh + 5 * k)},${f1(ny + 5 * k)} Q60,${f1(ny + 9 * k)} ${f1(60 - nh - 5 * k)},${f1(ny + 5 * k)} Z" fill="${c}" stroke="${shade(c, .65)}" stroke-width=".6"/>` +
      `<path d="M${f1(60 + 2 * k)},${f1(ny + 5 * k)} L${f1(60 + 9 * k)},${f1(ny + 6 * k)} L${f1(60 + 8 * k)},${f1(y.underbust)} L${f1(60 + 2.4 * k)},${f1(y.underbust - k)} Z" fill="${shade(c, .92)}" stroke="${shade(c, .65)}" stroke-width=".6"/>` +
      `<path d="M${f1(60 + 3 * k)},${f1(y.underbust - k)} l0,${sw(3)} M${f1(60 + 5.4 * k)},${f1(y.underbust - .6 * k)} l0,${sw(3)} M${f1(60 + 7.6 * k)},${f1(y.underbust - .2 * k)} l0,${sw(3)}" stroke="${shade(c, .7)}" stroke-width="${sw(1)}"/>`;
  }
  if (ac.bag === 'cross') { const bx = 60 + w.hip * .5, by = y.hip - 1; o += `<path d="M${f1(60 - w.sh + A.arm.uw * .9)},${f1(y.sh + 1)} L${f1(bx + 2 * k)},${f1(by)}" stroke="#3a2f28" stroke-width="${sw(1.6)}"/><rect x="${f1(bx - 5 * k)}" y="${f1(by)}" width="${sw(12)}" height="${sw(9)}" rx="${sw(1.6)}" fill="#6b4a36" stroke="#3a2f28" stroke-width="${sw(.7)}"/><path d="M${f1(bx - 5 * k)},${f1(by + 3 * k)} l${sw(12)},0" stroke="#3a2f28" stroke-width="${sw(.7)}"/>`; }
  if (ac.bag === 'shoulder') o += `<path d="M${f1(60 + w.sh - A.arm.uw * .9)},${f1(y.sh + 1)} L${f1(60 + w.sh - A.arm.uw * .6)},${f1(y.waist - 2)}" stroke="#2a211d" stroke-width="${sw(1.4)}"/>`;
  if (ac.bag === 'backpack') o += [-1, 1].map(s => `<path d="M${f1(60 + s * (w.sh - A.arm.uw * 1.1))},${f1(y.sh - .5)} Q${f1(60 + s * (w.sh - A.arm.uw * .9))},${f1(y.armpit)} ${f1(60 + s * (w.armpit + 1))},${f1(y.bust + 2)}" fill="none" stroke="#2f3440" stroke-width="${sw(3)}" stroke-linecap="round"/>`).join('');
  return o;
}
// 팔 (1-2): 어깨 관절에서 앵커 5개(어깨 1 / 상완 중간 .95·근육형 1.05 / 팔꿈치 .75 / 전완 .85 / 손목 .55)를 지나는 굵기가 변하는 팔
//   팔꿈치는 허리 높이, 손목은 골반 높이, 손끝은 허벅지 중간. 팔꿈치에서 바깥으로 살짝 꺾임(남 2.5°, 여 4°) — 완전 직선 없음
//   기본 자세는 몸통 뒤에 그려서 가슴·허리 윤곽이 가려지지 않게. 위쪽 끝은 몸통(삼각근 윤곽) 아래로 숨음
//   default 차렷 / hip 한 손 허리 / cross 팔짱 / clasp 두 손을 앞에 모음 / pocket 주머니(한 손 또는 두 손)
function armsFull(A, top, pose, skin, T, lowHip, ring) {   // ring: 왼손(화면 오른쪽, s=1) 약지에 결혼 반지
  const k = A.hs, c = T.color, shortSl = T.sleeve ? T.sleeve === 'short' : top === 0, bareArm = T.sleeve === 'none', ln = shade(c, .6);
  // 소매 여유분: 옷이 두꺼울수록(후디·패딩·코트) 소매도 굵음. 반팔·민소매는 살 그대로
  const se = shortSl || bareArm ? 0 : T.sleeveE || 0, { y, w } = A, { hand } = A.arm;
  const uw = A.arm.uw + se, mw = A.arm.mw + se, ew = A.arm.ew + se * .8, fw = A.arm.fw + se * .8, ww = A.arm.ww + se * .6;
  const dv = A.delt || 0, jx = w.sh - A.arm.uw / 2 + se * .36, jy = y.sh + A.arm.uw * .5;
  const rotOf = (E, W) => Math.atan2(-(W[0] - E[0]), W[1] - E[1]) * 180 / Math.PI;
  const along = (P0, P1, d) => { const l = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) || 1; return [P0[0] + (P1[0] - P0[0]) * d / l, P0[1] + (P1[1] - P0[1]) * d / l]; };
  const cuffAt = T.cuff ?? .86;   // 소매 끝 (전완의 비율, 오버핏은 손등까지)
  const cuff = (E, W, wd) => {
    const x = lerp(E[0], W[0], Math.min(cuffAt, .97)), yy = lerp(E[1], W[1], Math.min(cuffAt, .97)), l = Math.hypot(W[0] - E[0], W[1] - E[1]) || 1, nx = -(W[1] - E[1]) / l * wd * .36, ny = (W[0] - E[0]) / l * wd * .36;
    return `<path d="M${P(x - nx, yy - ny)} L${P(x + nx, yy + ny)}" stroke="${ln}" stroke-width="${f1(1.4 * k)}" opacity=".55"/>`;
  };
  // 팔 한 줄기: 반팔이면 소매 아래는 살, 민소매면 전부 살. sleeveTo: 반팔 소매 끝(상완 비율)
  const seg = (pts, dim, sleeveTo) => {
    const sc = T.sleeveFill || T.fill || (dim ? shade(c, .9) : c), sk = dim ? shade(skin, .94) : skin;
    if (!shortSl && !bareArm) return `<path d="${taperD(pts, false)}" fill="${sc}" stroke="${ln}" stroke-width=".5"/>`;
    let o = `<path d="${taperD(pts, false)}" fill="${sk}" stroke="${shade(skin, .72)}" stroke-width=".5"/>`;
    if (shortSl && sleeveTo) { const p = pts[0], q = pts[1], m = [lerp(p[0], q[0], sleeveTo * (T.puff ? .8 : 1)), lerp(p[1], q[1], sleeveTo * (T.puff ? .8 : 1))], pf = T.puff ? 3.2 * k : 0; o += `<path d="${taperD([[p[0], p[1], p[2] + 1.4 * k + pf], [lerp(p[0], m[0], .5), lerp(p[1], m[1], .5), q[2] + 1.6 * k + pf * 1.4], [m[0], m[1], q[2] + 1.6 * k + pf * .3]], false)}" fill="${sc}" stroke="${ln}" stroke-width=".5"/>`; }
    return o;
  };
  // 마른 체형은 손목뼈가 살짝 보임, 주름 (팔꿈치 안쪽, 옷 색 -15%)
  const knob = (W, s) => A.build === 'slim' && A.adult && (shortSl || bareArm || cuffAt < .8) ? `<path d="M${P(W[0] + s * ww * .45, W[1] - 1.6 * k)} q${f1(s * .9 * k)},${f1(1 * k)} 0,${f1(2.2 * k)}" fill="none" stroke="${shade(skin, .7)}" stroke-width="${f1(.6 * k)}" opacity=".6"/>` : '';
  const elbowFold = (E, s) => shortSl || bareArm ? '' : `<path d="M${P(E[0] - s * ew * .35, E[1] - 2.4 * k)} q${f1(s * ew * .3)},${f1(1.6 * k)} ${f1(s * ew * .55)},${f1(1 * k)} M${P(E[0] - s * ew * .3, E[1] + .6 * k)} q${f1(s * ew * .25)},${f1(.9 * k)} ${f1(s * ew * .45)},${f1(.4 * k)}" fill="none" stroke="${shade(c, .85)}" stroke-width="${f1(.9 * k)}" stroke-linecap="round" opacity=".7"/>`;
  const one = (s, E, W, rot, dim) => {
    const J = [60 + s * jx, jy], U = along(J, E, A.H * .08), F = along(E, W, A.H * .05);
    const pts = [[J[0] + s * dv * .5, J[1], uw + dv], [U[0] + s * dv * .3, U[1], mw + dv * .6], [E[0], E[1], ew], [F[0], F[1], fw], [W[0], W[1], ww]];
    let o = seg(pts, dim, .62);
    if (!shortSl && !bareArm) o += cuff(E, W, ww * 1.6) + elbowFold(E, s);
    o += `<path d="M${P(E[0] - s * ew * .25, E[1] + 2 * k)} Q${P(F[0] - s * fw * .35, F[1])} ${P(W[0] - s * ww * .3, W[1] - 2 * k)}" fill="none" stroke="${shade(shortSl || bareArm ? skin : c, .72)}" stroke-width="${f1(k)}" opacity=".3"/>`;   // 팔 안쪽 그림자
    let hd = handAt(W[0], W[1], s, skin, rot, hand, ring && s === 1) + knob(W, s);
    if (T.watch && s === 1 && cuffAt <= 1) { const l = Math.hypot(W[0] - F[0], W[1] - F[1]) || 1, nx = -(W[1] - F[1]) / l * ww * .62, ny = (W[0] - F[0]) / l * ww * .62, wx = lerp(F[0], W[0], .82), wy = lerp(F[1], W[1], .82); hd += `<path d="M${P(wx - nx, wy - ny)} L${P(wx + nx, wy + ny)}" stroke="#3a2f28" stroke-width="${f1(1.8 * k)}"/><circle cx="${f1(wx)}" cy="${f1(wy)}" r="${f1(1.1 * k)}" fill="#d8dde3" stroke="#3a2f28" stroke-width="${f1(.4 * k)}"/>`; }   // 시계 (왼손목)
    if (T.umbrella && s === -1 && rot !== 42) { const ux = W[0] - 1.2 * k, uy = W[1] + hand * .55; hd += `<path d="M${f1(ux)},${f1(uy)} q${f1(-3 * k)},0 ${f1(-3 * k)},${f1(3 * k)}" fill="none" stroke="#3a2f28" stroke-width="${f1(1.2 * k)}" stroke-linecap="round"/><path d="M${f1(ux)},${f1(uy)} L${f1(ux - 2.2 * k)},${f1(uy + 8 * k)} L${f1(ux - .4)},${FLOOR - 2} L${f1(ux + .4)},${FLOOR - 2} L${f1(ux + 2.2 * k)},${f1(uy + 8 * k)} Z" fill="#2e3a56" stroke="#1d2436" stroke-width=".5"/>`; }   // 우산 (비 오는 날)
    return cuffAt > 1 ? hd + o : o + hd;   // 오버핏 소매는 손등을 덮음
  };
  // 차렷: 팔꿈치는 허리 높이에서 몸 바깥, 손목은 골반 높이에서 골반 바깥 — 팔꿈치에서 바깥으로 꺾임
  const tB = clamp((y.bust - jy) / (y.waist - jy), .2, 1);
  const xe = Math.max(jx + .6, T.gw(y.waist) + ew * .3, jx + (T.bustEdge - uw * .55 - jx) / tB);   // 팔 안쪽은 몸통(가슴·허리) 옆에 살짝 가려짐
  const bend = (A.f ? 4 : 2.5) * Math.PI / 180, fl = (y.hip - y.waist) * 1.02;
  const armDown = s => {
    const E = [60 + s * xe, y.waist], th = Math.atan2(xe - jx, y.waist - jy) + bend;
    const wy = y.waist + Math.cos(th) * fl, need = Math.max(wy < T.hemY ? T.gw(wy) + ww * .2 : 0, w.hip - ww * .1);   // 윗옷 밑단 위면 윗옷 옆, 아래면 손이 골반·허벅지 옆에 살짝 걸침
    const W = [60 + s * Math.max(need, Math.min(xe + Math.sin(th) * fl, Math.max(xe, need) + 1.4)), wy];   // 팔꿈치가 이미 바깥이면 전완은 거의 수직으로
    return [E, W];
  };
  const def = (s, dim) => { const [E, W] = armDown(s); return one(s, E, W, rotOf(E, W) * .85, dim); };
  if (pose === 'hip') {
    const yh = lerp(y.waist, y.hip, .42), E = [60 + T.gw(y.waist) + uw * 1.3 + 3.5, y.waist - (y.waist - y.sh) * .06];
    const W = [60 + Math.max(T.gw(yh), lowHip * .92) + ww * .2, yh - hand * .3];
    return { back: def(-1, true), front: one(1, E, W, 42, false) };
  }
  if (pose === 'cross') {
    const yc = (A.adult && A.f ? y.underbust : lerp(y.bust, y.waist, .35)) + 2 + fw / 2;
    const ex = Math.max(T.bustEdge, xe + uw / 2) + 2 - uw / 2;
    const up = s => { const J = [60 + s * jx, jy], E = [60 + s * ex, yc]; return seg([[J[0] + s * dv * .5, J[1], uw + dv], [lerp(J[0], E[0], .5) + s * .8, lerp(J[1], E[1], .5), mw + dv * .6], [E[0], E[1], uw * .9]], true, .62); };
    const fore = (s, E, W) => seg([[E[0], E[1], uw * .85], [lerp(E[0], W[0], .5), lerp(E[1], W[1], .5) + fw * .15, fw], [W[0], W[1], ww * 1.25]], false, 0) + (shortSl || bareArm ? '' : cuff(E, W, ww * 1.7));
    const ER = [60 + ex, yc], EL = [60 - ex, yc + fw * .55];
    return { back: up(-1) + up(1),
      front: fore(1, ER, [60 - ex + uw * .9, yc - fw * .2]) + fore(-1, EL, [60 + ex - uw * 1.1, yc + fw * .15]) + handAt(60 + ex - uw * .75, yc + fw * .1, 1, skin, -160, hand * .72, ring) };
  }
  if (pose === 'clasp') {   // 두 손을 앞에 모음: 팔꿈치는 허리 옆, 전완이 비스듬히 모여 골반 높이에서 한 손이 다른 손 위에 겹침
    const yc = lerp(y.waist, y.hip, 1.05), xe2 = Math.max(jx + .4, xe - 1.4);
    const arm2 = s => {
      const J = [60 + s * jx, jy], E = [60 + s * xe2, y.waist + 1], W = [60 + s * 3.2, yc + (s > 0 ? 1.2 : 0)], U = along(J, E, A.H * .08), F = along(E, W, A.H * .04);
      let o = seg([[J[0] + s * dv * .5, J[1], uw + dv], [U[0], U[1], mw + dv * .6], [E[0], E[1], ew], [F[0], F[1], fw], [W[0], W[1], ww]], false, .62);
      if (!shortSl && !bareArm) o += cuff(E, W, ww * 1.6);
      return { o, h: handAt(W[0] - s * .6, W[1] - .4, -s, skin, rotOf(E, W) * .55, hand * .9, ring && s > 0) };
    };
    const L2 = arm2(-1), R2 = arm2(1);
    return { back: '', front: L2.o + R2.o + L2.h + R2.h };
  }
  if (pose === 'pocket' || pose === 'pocket1') {   // 주머니: 손은 주머니 속(안 보임), 주머니 입구 천이 손목을 덮음. pocket1은 한 손만
    const kang = !!T.pocket, both = pose === 'pocket';
    const yp = kang ? T.pocket.y : lerp(y.hip, y.crotch, .15), pk = s => {
      const E = [60 + s * (xe + 1.6), y.waist + (kang ? -1 : 1)], W = kang ? [60 + s * T.pocket.x, yp] : [60 + s * (w.hip * .74), yp];
      const J = [60 + s * jx, jy], U = along(J, E, A.H * .08), F = along(E, W, A.H * .04);
      const upper = seg([[J[0] + s * dv * .5, J[1], uw + dv], [U[0], U[1], mw + dv * .6], [E[0], E[1], ew * 1.05]], true, .62);
      const fore = seg([[E[0], E[1], ew], [F[0], F[1], fw], [W[0], W[1], ww * 1.15]], false, 0) + (shortSl || bareArm ? '' : elbowFold(E, s));
      return { upper, fore, W };
    };
    const arms = both ? [pk(-1), pk(1)] : [pk(1)];
    const mouth = arms.map(({ W }) => { const s = W[0] > 60 ? 1 : -1; return kang ? '' : `<path d="M${P(W[0] - s * ww * .9, W[1] - 1.2)} Q${P(W[0], W[1] + 1.4)} ${P(W[0] + s * ww * 1.1, W[1] + 2.6)} L${P(W[0] + s * ww * 1.1, W[1] + 5)} L${P(W[0] - s * ww * .9, W[1] + 4)} Z" fill="${T.lowC || '#4a5f86'}"/><path d="M${P(W[0] - s * ww * .9, W[1] - 1.2)} Q${P(W[0], W[1] + 1.4)} ${P(W[0] + s * ww * 1.1, W[1] + 2.6)}" fill="none" stroke="${shade(T.lowC || '#4a5f86', .6)}" stroke-width=".7"/>`; }).join('');
    return { back: (both ? '' : def(-1, true)) + arms.map(q => q.upper).join('') + (kang ? '' : arms.map(q => q.fore).join('') + mouth),
      front: kang ? arms.map(q => q.fore).join('') + T.pocket.svg : '', pocket: true };
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
const BUST_MARK = '<!--bust-->';
function bareTorso(a, A, skin, id, dx, mist) {   // mist: 꼭짓점을 가리는 김 (이불이 없는 그날 밤에만)
  const { y, w } = A, k = A.hs, { uw } = A.arm, female = a.g === 'f', sk = v => shade(skin, v), ny = y.neck;
  const ln = (d, c, wd, op) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f1(wd * k)}" stroke-linecap="round" opacity="${op}"/>`;
  const jx = w.sh - uw / 2, jy = y.sh + uw * .45, capR = uw / 2 + (A.adult && !female ? (A.fitM ? 2.5 : 1.2) : 0);
  let o = `<defs><linearGradient id="${id}sk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${sk(.82)}"/><stop offset=".2" stop-color="${skin}"/><stop offset=".8" stop-color="${skin}"/><stop offset="1" stop-color="${sk(.82)}"/></linearGradient></defs>`;
  for (const s of [-1, 1]) {   // 팔: 어깨 관절(둥근 삼각근)에서 거의 곧게 내려옴
    const pts = [[60 + s * jx, jy, capR * 2], [60 + s * (jx + .6), y.bust + 6 * k, uw], [60 + s * (jx + 1.4), y.waist, uw * .9]];
    o += `<path d="${taperD(pts, true)}" fill="${sk(.93)}"/>` + `<ellipse cx="${f1(60 + s * (jx + .4 * k))}" cy="${f1(jy - capR * .45)}" rx="${f1(capR * .55)}" ry="${f1(capR * .3)}" fill="#fff" opacity=".1"/>`;
  }
  const bw = female && A.adult ? w.bust : w.rib;
  // 가슴이 크면 옆 윤곽이 뾰족하지 않게 가슴 높이 위아래에 둥근 점을 더함
  const side = bw - w.armpit > 2 * k ? [[lerp(w.armpit, bw, .72), lerp(y.armpit, y.bust, .5)], [bw, y.bust], [lerp(bw, w.ub, .5), lerp(y.bust, y.underbust, .55)]] : [[bw, y.bust]];
  const R = [[w.nh - .2 * k, ny - 6 * k], [w.nh + 1.4 * k, ny + 1.2 * k], [lerp(w.nh, w.sh, .6), lerp(ny, y.sh, .8)], [w.tip, y.sh + 1.2], [w.armpit, y.armpit], ...side, [w.ub, y.underbust], [w.waist, y.waist]];
  const torsoD = symShape(R, y.waist + 2, ny - 6 * k);
  o += `<path d="${torsoD}" fill="url(#${id}sk)"/><clipPath id="${id}tc"><path d="${torsoD}"/></clipPath><g clip-path="url(#${id}tc)">`;
  // 겨드랑이 앞 경계 (팔과 가슴 사이), 쇄골(+윗면 빛, 어깨 쪽으로 살짝 내려감), 목 아래 오목한 곳 — 몸통 안에서만
  o += ln([-1, 1].map(s => `M${f1(60 + s * (w.tip - 1.2 * k))},${f1(y.sh + 4 * k)} Q${f1(60 + s * (w.armpit + .4 * k))},${f1(y.armpit - 4 * k)} ${f1(60 + s * (w.armpit - .8 * k))},${f1(y.armpit + 5 * k)}`).join(' '), sk(.7), 1.1, .42);
  const cl = lerp(w.nh, w.tip, .62), cy0 = ny + 4.4 * k;
  const clavD = [-1, 1].map(s => `M${f1(60 + s * 2.6 * k)},${f1(cy0 + .8 * k)} C${f1(60 + s * 6 * k)},${f1(cy0 + 2.2 * k)} ${f1(60 + s * cl * .6)},${f1(cy0 + .6 * k)} ${f1(60 + s * cl)},${f1(cy0 + 2.2 * k)}`).join(' ');
  o += ln(clavD, sk(.66), 1.2, .45) + `<g transform="translate(0,${f1(-1.3 * k)})">${ln(clavD, '#fff', .9, .16)}</g>`;
  o += ln(`M${f1(60 - 1.5 * k)},${f1(cy0 - .2 * k)} Q60,${f1(cy0 + 2.4 * k)} ${f1(60 + 1.5 * k)},${f1(cy0 - .2 * k)}`, sk(.6), 1.1, .5);
  if (female && A.adult) {
    o += BUST_MARK;
    // 가슴 (어른 여자, 맨몸) — 앞에서 본 물방울형. 윗면은 윤곽 없이 가슴팍에서 비스듬히 이어져 내려오고(마스크로 위쪽 음영을 지움),
    //   볼륨은 아래쪽 음영·밑가슴 주름·그 아래 갈비뼈로 떨어지는 그림자·겨드랑이 쪽 옆 윤곽·윗면 빛으로만 보임
    //   꼭짓점은 살짝 바깥·아래를 향하고 그 자리는 김(안개)이 가림 — 유두는 그리지 않음. 문장처럼 그림도 암시까지만
    //   크기는 컵(A.ci), 체형: 탄탄하면 높고 둥글게, 통통하면 크고 부드럽게(주름이 옅음) / 나이: 36살부터 꼭짓점이 내려가고 윗면 경사가 길어짐
    const age = A.age || 25, sag = Math.max(0, Math.min(1, (age - 35) / 25)), fitB = A.build === 'fit', chub = A.build === 'chubby';
    const bx = w.bust * .5, r = w.bust * (.42 + A.ci * .022) * (chub ? 1.06 : 1), cy = y.bust + r * (sag * .22 + (chub ? .06 : 0) - (fitB ? .05 : 0)), gap = Math.max(.5 * k, bx - r * .9);
    const ry = (fitB ? .92 : 1) + sag * .14, gid = id + 'bf', soft = chub ? .78 : 1, ax = .14 + sag * .05, ay = .2 + sag * .22;
    const Y = v => f1(cy + v * r * (v > 0 ? ry : 1)), q2 = v => f1(v * 100) / 100;
    o += `<defs><linearGradient id="${gid}mg" gradientUnits="userSpaceOnUse" x1="0" y1="${Y(-.5)}" x2="0" y2="${Y(.22)}"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
      `<mask id="${gid}m" maskUnits="userSpaceOnUse" x="-60" y="${f1(cy - 3 * r)}" width="240" height="${f1(6 * r)}"><rect x="-60" y="${f1(cy - 3 * r)}" width="240" height="${f1(6 * r)}" fill="url(#${gid}mg)"/></mask>` +
      `<linearGradient id="${gid}cs" gradientUnits="userSpaceOnUse" x1="0" y1="${Y(1.02)}" x2="0" y2="${Y(1.32)}"><stop offset="0" stop-color="${sk(.52)}" stop-opacity="${q2(.34 * soft)}"/><stop offset="1" stop-color="${sk(.52)}" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="${gid}sd" gradientUnits="userSpaceOnUse" x1="0" y1="${Y(-.85)}" x2="0" y2="${Y(.1)}"><stop offset="0" stop-color="${sk(.66)}" stop-opacity="0"/><stop offset="1" stop-color="${sk(.66)}" stop-opacity="${q2(.4 * soft)}"/></linearGradient>` +
      `<radialGradient id="${gid}h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${gid}mi" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffdfb" stop-opacity=".95"/><stop offset=".45" stop-color="#fff6f6" stop-opacity=".72"/><stop offset="1" stop-color="#fdeef3" stop-opacity="0"/></radialGradient>` +
      `<filter id="${gid}fz" x="-60%" y="-80%" width="220%" height="260%"><feGaussianBlur stdDeviation="${f1(1.1 * k)}"/></filter>` +
      `<radialGradient id="${gid}v" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${sk(.52)}" stop-opacity=".4"/><stop offset="1" stop-color="${sk(.52)}" stop-opacity="0"/></radialGradient></defs>`;
    o += [-1, 1].map(s => {
      const X = u => f1(60 + s * (bx + u * r)), g2 = gid + (s > 0 ? 'R' : 'L');
      // 덩어리 음영: 위·안쪽이 밝고 아래·바깥 둘레로 갈수록 짙음 (위쪽 절반은 마스크로 지워 가슴팍과 이어짐)
      const mass = `M${X(-.86)},${Y(-.2)} C${X(-.8)},${Y(-.95)} ${X(.4)},${Y(-1.3)} ${X(.86)},${Y(-.55)} C${X(1.05)},${Y(-.2)} ${X(1.05)},${Y(.4)} ${X(.8)},${Y(.78)} C${X(.52)},${Y(1.08)} ${X(-.2)},${Y(1.1)} ${X(-.56)},${Y(.84)} C${X(-.82)},${Y(.64)} ${X(-.92)},${Y(.2)} ${X(-.86)},${Y(-.2)} Z`;
      const grad = `<radialGradient id="${g2}" gradientUnits="userSpaceOnUse" cx="${X(-.08)}" cy="${Y(-.32)}" r="${f1(r * 1.32)}"><stop offset="0" stop-color="${skin}" stop-opacity="0"/><stop offset=".52" stop-color="${sk(.92)}" stop-opacity="0"/><stop offset=".78" stop-color="${sk(.8)}" stop-opacity="${q2(.34 * soft)}"/><stop offset="1" stop-color="${sk(.64)}" stop-opacity="${q2(.6 * soft)}"/></radialGradient>`;
      // 밑가슴 주름: 가운데가 굵고 양끝이 가는 초승달 / 그 아래로 떨어지는 그림자
      const crease = `M${X(.98)},${Y(.28)} C${X(.93)},${Y(.86)} ${X(.36)},${Y(1.12)} ${X(-.12)},${Y(1.08)} C${X(-.43)},${Y(1.04)} ${X(-.65)},${Y(.88)} ${X(-.77)},${Y(.6)} C${X(-.6)},${Y(.85)} ${X(-.4)},${Y(.97)} ${X(-.12)},${Y(1)} C${X(.33)},${Y(1.03)} ${X(.86)},${Y(.8)} ${X(.98)},${Y(.28)} Z`;
      const cast = `M${X(.92)},${Y(.6)} C${X(.72)},${Y(1.02)} ${X(.3)},${Y(1.13)} ${X(-.12)},${Y(1.09)} C${X(-.45)},${Y(1.06)} ${X(-.66)},${Y(.9)} ${X(-.74)},${Y(.72)} C${X(-.62)},${Y(1.1)} ${X(-.3)},${Y(1.3)} ${X(-.08)},${Y(1.32)} C${X(.36)},${Y(1.33)} ${X(.82)},${Y(1.02)} ${X(.92)},${Y(.6)} Z`;
      // 김(안개): 꼭짓점 자리를 덮는 부드러운 김 몇 덩이 (바깥으로 흩어짐)
      // 김(안개): 꼭짓점 자리를 덮는 부드러운 김 — 옅은 큰 덩이 + 짙은 작은 덩이들 + 위·바깥으로 피어오르는 가는 김 줄기
      const steam = `<g filter="url(#${gid}fz)"><ellipse cx="${X(ax + .05)}" cy="${Y(ay - .02)}" rx="${f1(r * .72)}" ry="${f1(r * .46)}" fill="url(#${gid}mi)" opacity=".45"/>` +
        [[0, 0, .4, .3, .9], [.2, -.12, .28, .2, .7], [-.2, .06, .3, .2, .7], [.38, .1, .2, .14, .5]].map(([du, dv, rx, rv, op]) => `<ellipse cx="${X(ax + du)}" cy="${Y(ay + dv)}" rx="${f1(r * rx)}" ry="${f1(r * rv)}" fill="url(#${gid}mi)" opacity="${op}"/>`).join('') +
        `<path d="M${X(ax - .1)},${Y(ay - .3)} c${f1(s * r * .06)},${f1(-r * .18)} ${f1(s * r * .26)},${f1(-r * .14)} ${f1(s * r * .2)},${f1(-r * .34)} s${f1(s * r * .04)},${f1(-r * .2)} ${f1(s * r * .16)},${f1(-r * .3)}" fill="none" stroke="#fff" stroke-width="${f1(1.6 * k)}" stroke-linecap="round" opacity=".38"/>` +
        `<path d="M${X(ax + .3)},${Y(ay - .18)} c${f1(s * r * .1)},${f1(-r * .12)} ${f1(s * r * .02)},${f1(-r * .26)} ${f1(s * r * .14)},${f1(-r * .38)}" fill="none" stroke="#fff" stroke-width="${f1(1.2 * k)}" stroke-linecap="round" opacity=".3"/></g>`;
      return `<defs>${grad}</defs><path d="${mass}" fill="url(#${g2})" mask="url(#${gid}m)"/>` +
        `<path d="${cast}" fill="url(#${gid}cs)"/><path d="${crease}" fill="${sk(.56)}" opacity="${q2(.5 * soft)}"/>` +
        `<path d="M${X(.6)},${Y(-.84)} C${X(.92)},${Y(-.52)} ${X(1.05)},${Y(-.06)} ${X(.99)},${Y(.3)}" fill="none" stroke="url(#${gid}sd)" stroke-width="${f1(.9 * k)}" stroke-linecap="round"/>` +   // 옆 윤곽 (위로 갈수록 흐려짐)
        `<ellipse cx="${X(-.04)}" cy="${Y(-.34)}" rx="${f1(r * .52)}" ry="${f1(r * .25)}" transform="rotate(${s * -22} ${X(-.04)} ${Y(-.34)})" fill="url(#${gid}h)"/>` +   // 윗면 빛 (가슴팍에서 꼭짓점 쪽으로 비스듬히)
        `<ellipse cx="${X(ax - .16)}" cy="${Y(ay - .3)}" rx="${f1(r * .13)}" ry="${f1(r * .055)}" transform="rotate(${s * -25} ${X(ax - .16)} ${Y(ay - .3)})" fill="#fff" opacity=".3"/>` + (mist ? steam : '');
    }).join('');
    // 가슴골: 안쪽 아랫선이 가운데로 모이는 Y자 + 위로 옅어지는 골 그림자 (가깝고 클수록 짙게)
    const close = Math.max(0, Math.min(1, 1.25 - (bx - r * .62) / r));
    o += `<ellipse cx="60" cy="${f1(cy - r * .02)}" rx="${f1(1.4 * k + gap * .6)}" ry="${f1(r * .78)}" fill="url(#${gid}v)" opacity="${q2(.55 + close * .45)}"/>` +
      [-1, 1].map(s => ln(`M${f1(60 + s * (bx - r * .76))},${Y(.6)} Q${f1(60 + s * gap * .25)},${Y(.24)} 60,${Y(-.12)}`, sk(.6), .8, q2(.12 + close * .22))).join('');
    if (dx) {   // 디테일(테스트): 가슴 윗면 땀 윤기·방울, 가슴골로 흐르는 한 방울 (js/night.js가 세기 조절)
      o += `<g class="av-swt" opacity="0">` + [-1, 1].map(s => `<ellipse cx="${f1(60 + s * (bx - r * .28))}" cy="${f1(cy - r * .62)}" rx="${f1(r * .16)}" ry="${f1(r * .055)}" transform="rotate(${s * -18} ${f1(60 + s * (bx - r * .28))} ${f1(cy - r * .62)})" fill="#fff" opacity=".7"/>` +
        `<ellipse cx="${f1(60 + s * (bx + r * .3))}" cy="${f1(cy - r * .2)}" rx="${f1(r * .06)}" ry="${f1(r * .04)}" fill="#fff" opacity=".8"/>`).join('') +
        `<path d="M60,${f1(cy - r * .78)} q-.9,1.6 -.7,2.5 q.7,.9 1.4,0 q.2,-.9 -.7,-2.5 Z" transform="translate(0 0) scale(1)" fill="#e9f6ff" stroke="${sk(.7)}" stroke-width=".35" opacity=".9"/>` +
        ln(`M60,${f1(cy - r * .74)} L60,${f1(cy - r * .2)}`, '#fff', .5, .35) + '</g>';
    }
    o = o.replace(BUST_MARK, `<g class="av-bust" data-cy="${f1(cy)}" data-r="${f1(r)}" data-k="${k.toFixed(4)}">`) + '</g>';   // 가슴 (함께 밤을 보내는 중엔 js/night.js가 출렁이게 함)
  } else if (A.adult) {
    // 가슴 근육 아랫선 + 아래 그림자 + 가운데 오목한 선
    const px = w.rib * .45, pr = w.rib * .5, py = y.bust - 2 * k;
    o += ln([-1, 1].map(s => `M${f1(60 + s * w.rib * .88)},${f1(y.armpit + 2 * k)} Q${f1(60 + s * w.rib * .5)},${f1(y.bust + 4.5 * k)} ${f1(60 + s * 1.2 * k)},${f1(y.bust + 1.6 * k)}`).join(' '), sk(.68), 1.3, .4);
    o += bustVolume(id + 'b', px, py, pr, sk(.55), A.fitM ? .26 : .18, false, k);
    o += ln(`M60,${f1(ny + 8 * k)} L60,${f1(y.bust + 2 * k)}`, sk(.66), 1.3, .18);
  }
  if (dx && A.adult) {
    // 디테일(테스트): 달아오를수록 목 아래·가슴 위로 번지는 홍조, 쇄골·어깨·가슴 위 땀 윤기 (js/night.js가 opacity를 바꿈)
    const fy = lerp(ny, y.bust, .46);
    o += `<defs><radialGradient id="${id}fl" cx=".5" cy=".42" r=".5"><stop offset="0" stop-color="#ff5f7e" stop-opacity=".32"/><stop offset=".6" stop-color="#ff6f8a" stop-opacity=".16"/><stop offset="1" stop-color="#ff6f8a" stop-opacity="0"/></radialGradient></defs>` +
      `<ellipse class="av-flush" cx="60" cy="${f1(fy)}" rx="${f1(w.sh * .92)}" ry="${f1((y.bust - ny) * .82)}" fill="url(#${id}fl)" opacity="0"/>`;
    const gl = (x, yy, rx, rot, op = .7) => `<ellipse cx="${f1(x)}" cy="${f1(yy)}" rx="${f1(rx)}" ry="${f1(rx * .32)}" transform="rotate(${rot} ${f1(x)} ${f1(yy)})" fill="#fff" opacity="${op}"/>`;
    const drop = (x, yy, kk) => `<path d="M${f1(x)},${f1(yy)} q${f1(-1.1 * kk)},${f1(1.9 * kk)} ${f1(-.9 * kk)},${f1(2.9 * kk)} q${f1(.9 * kk)},${f1(1.1 * kk)} ${f1(1.8 * kk)},0 q${f1(.2 * kk)},${f1(-1 * kk)} ${f1(-.9 * kk)},${f1(-2.9 * kk)} Z" fill="#e9f6ff" stroke="${sk(.7)}" stroke-width="${f1(.35 * k)}" opacity=".9"/>`;
    o += `<g class="av-swt" opacity="0">` + [-1, 1].map(s => gl(60 + s * cl * .55, cy0 + 3.2 * k, 2.6 * k, s * 10) + gl(60 + s * (w.tip - 3 * k), y.sh + 3 * k, 3 * k, s * -30, .55) + gl(60 + s * (w.armpit - 4 * k), y.armpit + 1.5 * k, 2 * k, s * 70, .45)).join('') +
      drop(60 + cl * .35, cy0 + 5 * k, 1.1 * k) + drop(60 - (w.tip - 6 * k), y.sh + 6 * k, 1 * k) + (female ? '' : drop(60 + 4 * k, y.bust - 4 * k, 1.1 * k)) + '</g>';
  }
  return o + '</g>';
}
// 함께 밤을 보내는 중·다음 날 아침 (상반신, 머리 좌표). A: 전신 앵커 — 몸은 전신 좌표로 그려 머리 좌표로 옮김
//   o: { by(이불 윗선 y), marks(0~4: 립스틱·손톱 자국 정도), lipstick, hickey, clutch(이불 움켜쥔 손) }
function bareBody(a, A, skin, o) {
  const id = `av${UID}`, hs = A.hs, hw = A.w.sh / hs - 3, L = f1(60 - hw), R = f1(60 + hw), nh = A.w.nh / hs, nl = 60 - nh, nr = 60 + nh, by = o.by;
  const ln = (d, c, w, op) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
  const sk = k => shade(skin, k), notch = (A.y.neck - A.hty) / hs + 5;
  let s = `<g transform="scale(${(1 / hs).toFixed(4)}) translate(${f1(-A.htx)},${f1(-A.hty)})">${bareTorso(a, A, skin, id, o.dx, o.noQuilt)}</g>`;
  s += `<defs><linearGradient id="${id}q" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcbde6"/><stop offset=".5" stop-color="#b48bc6"/><stop offset="1" stop-color="#8c66a3"/></linearGradient></defs>`;
  s += ln(`M${f1(nl + 1.5)},101 Q${f1(nl + 3)},${f1(notch - 6)} 58.4,${f1(notch)} M${f1(nr - 1.5)},101 Q${f1(nr - 3)},${f1(notch - 6)} 61.6,${f1(notch)}`, sk(.72), 1, .22);   // 목 근육
  // 자국: 목·쇄골의 립스틱, 어깨의 손톱 자국
  if (o.lipstick && o.marks >= 3) s += KISS(66, 109, -10) + KISS(47, 126, 14) + (o.marks >= 4 ? KISS(+R - 14, 128, -18) : '');
  if (o.marks >= 4) s += ln(`M${f1(+L + 7)},130 q4,-2.2 9,-1.4 M${f1(+L + 8)},133.4 q4,-2 8,-1.2`, '#c86070', 1.2, .5);
  // 키스 자국(70+ 목 1~2, 90+ 목 3 + 어깨), 90+면 어깨에 옅은 이빨 자국
  if (o.hickey && o.marks >= 3) s += [[54, 108], [66, 112], [57, 116], [f1(+R - 16), 126]].slice(0, o.marks >= 4 ? 4 : 2).map(([x, y], i) => HICKEY(x, y, .9, i)).join('');
  if (o.hickey && o.marks >= 4) s += [-1, 1].map(k => [0, 1, 2, 3, 4].map(i => `<ellipse cx="${f1(+L + 12 + i * 1.8)}" cy="${f1(128 + k * (2.2 - Math.abs(i - 2) * .45))}" rx=".7" ry=".5" fill="#c86a70" opacity=".45"/>`).join('')).join('');
  if (o.dx) s += detailBody(o.dx, { id, L, R, nh, notch });
  if (o.noQuilt) return s;
  // 이불(밤과 같은 라벤더 이불): 살 위 그림자 → 이불 → 접힌 단 → 주름 → 윗선 하이라이트
  const top = `M0,${by + 5} C18,${by - 3} 38,${by + 3} 60,${by} C80,${by - 3} 102,${by + 4} 120,${by - 1}`;
  s += `<path d="${top} L120,${by - 4} C102,${by + 1} 80,${by - 6} 60,${by - 3} C38,${by} 18,${by - 6} 0,${by + 2} Z" fill="${sk(.55)}" opacity=".22"/>`;
  s += `<g transform="translate(60 0) scale(1.14 1) translate(-60 0)">`;   // 이불은 칸보다 조금 넓게 (인물이 흔들려도 가장자리가 안 보이게)
  s += `<path d="${top} L120,178 L0,178 Z" fill="url(#${id}q)"/>`;
  s += `<path d="${top} L120,${by + 6} C102,${by + 11} 80,${by + 4} 60,${by + 7} C38,${by + 10} 18,${by + 4} 0,${by + 12} Z" fill="#ecdcf2" opacity=".45"/>`;
  s += `<path d="M0,${by + 10} C18,${by + 2} 38,${by + 8} 60,${by + 5} C80,${by + 2} 102,${by + 9} 120,${by + 4}" fill="none" stroke="#f3e6f8" stroke-width=".8" stroke-dasharray="2 2.4" opacity=".5"/>`;
  s += ln(`M20,${by + 14} C28,${by + 22} 24,${by + 32} 30,160 M86,${by + 12} C78,${by + 22} 84,${by + 30} 82,160 M52,${by + 13} C56,${by + 20} 52,${by + 28} 56,${by + 36}`, '#6e4d84', 2, .35);
  s += ln(`M22,${by + 14} C30,${by + 22} 26,${by + 32} 32,160 M88,${by + 12} C80,${by + 22} 86,${by + 30} 84,160`, '#f3e6f8', 1, .25);
  s += ln(top, '#f6ecfa', 1.4, .75) + '</g>';
  if (o.clutch) {
    // 이불 끝을 움켜쥔 두 손: 손등은 이불 위로, 손가락 네 개는 이불 끝을 넘어 아래로
    s += [47, 73].map(x => `<path d="M${x - 6.2},${by + .5} Q${x - 6},${by - 5} ${x},${by - 5.4} Q${x + 6},${by - 5} ${x + 6.2},${by + .5} Z" fill="${skin}"/>` +
      [-4.3, -1.45, 1.45, 4.3].map((d, k) => `<ellipse cx="${f1(x + d)}" cy="${f1(by + 1.8 - (k % 3 ? 0 : .7))}" rx="1.5" ry="2.9" fill="${skin}" stroke="${sk(.72)}" stroke-width=".6"/>`).join('') +
      ln(`M${x - 5},${by - 1.6} Q${x},${by - 3} ${x + 5},${by - 1.6}`, sk(.74), .7, .5)).join('');
  }
  return s;
}
// 디테일(테스트) — 목의 홍조, 내가 남긴 자국(목 → 쇄골 → 가슴 위 → 어깨 손톱자국, 차례로 드러남). 머리 좌표
//   dx: { lip(내가 여자 → 립스틱 입술 자국, 아니면 키스 자국), shown(아침: 이만큼 자국을 보여 줌) }
//   js/night.js가 .av-flush / .av-mk[data-i] 를 켜고 끔
const MARK_AT = [[54, 108, -8], [66, 112, 12], [57, 117, 4], [47, 126, 14], [0, 128, -18], [66, 138, 8], [0, 0, 0]];
function detailBody(dx, g) {
  const { id, L, R, nh, notch } = g;
  let s = `<defs><radialGradient id="${id}nf" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#ff5f7e" stop-opacity=".3"/><stop offset="1" stop-color="#ff6f8a" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="${id}nk"><rect x="${f1(60 - nh)}" y="94" width="${f1(nh * 2)}" height="${f1(notch - 94 + 4)}"/></clipPath></defs>` +
    `<g clip-path="url(#${id}nk)"><ellipse class="av-flush" cx="60" cy="${f1(notch - 6)}" rx="${f1(nh * 1.3)}" ry="12" fill="url(#${id}nf)" opacity="0"/></g>`;
  const fingers = x => [0, 1, 2, 3].map(i => `<path d="M${f1(x + i * 2.4)},${f1(129 + i * .5)} q.6,3.2 .2,6" fill="none" stroke="#d0606e" stroke-width="1.3" stroke-linecap="round" opacity=".42"/>`).join('');
  const shown = dx.shown || 0;
  s += MARK_AT.map(([x, y, r], i) => {
    const X = i === 4 ? +R - 14 : x, art = i === 6 ? fingers(+L + 7) : dx.lip ? KISS(X, y, r, '#c43c4f', .9) : HICKEY(X, y, .8, i);
    return `<g class="av-mk" data-i="${i}" opacity="${i < shown ? 1 : 0}">${art}</g>`;
  }).join('');
  return s;
}
// 키스 자국(멍): 붉은 보라로 번진 테두리 + 울퉁불퉁한 짙은 가운데 + 잔 점(터진 모세혈관). i로 모양·각도가 조금씩 다름
function HICKEY(x, y, k = 1, i = 0) {
  const rot = [-14, 22, 6, -30, 12, 38, -6][i % 7], sh = i % 3 * .25;
  const dots = [[-1.2, -.4, .34], [.4, -.9, .28], [1.3, .1, .3], [-.3, .6, .32], [.9, .9, .24], [-1.6, .5, .22], [.1, -.1, .3], [1.9, -.5, .2], [-.9, -1.1, .2]];
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${f1(k * (1 + sh * .3) * 100) / 100})">` +
    `<ellipse rx="4.3" ry="3.2" fill="#c45a72" opacity=".12"/><ellipse rx="3.1" ry="2.3" fill="#a83d5c" opacity=".16"/>` +
    `<path d="M-2.2,-.6 C-2,-1.8 .2,-2 1.5,-1.4 C2.6,-.8 2.5,.9 1.3,1.5 C.2,2 -1.8,1.6 -2.3,.6 C-2.5,.1 -2.4,-.3 -2.2,-.6 Z" fill="#8e2a4a" opacity=".2"/>` +
    dots.slice(0, 6 + i % 4).map(([dx, dy, r]) => `<circle cx="${dx}" cy="${dy}" r="${r}" fill="#6e1c38" opacity=".3"/>`).join('') + '</g>';
}
// 립스틱 입술 자국: 큐피드 활 윗입술 + 도톰한 아랫입술 + 세로 입술 결(찍힌 잔줄) + 한쪽으로 끌린 번짐
function KISS(x, y, rot, c = '#c43c4f', k = 1) {
  const lines = [-3.3, -2.5, -1.7, -.9, -.2, .6, 1.4, 2.2, 3].map((lx, j) => `M${lx},${j % 2 ? -1.5 : -1.2} L${f1(lx * 1.06)},-.4 M${lx},.8 L${f1(lx * 1.08)},${j % 2 ? 2.5 : 2.2}`).join(' ');
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${k})" opacity=".8">` +
    `<path d="M-4.4,.15 Q-3.4,-1.9 -1.5,-2.15 Q-.5,-2.25 0,-1.3 Q.5,-2.25 1.5,-2.15 Q3.4,-1.9 4.4,.15 Q2,-.45 0,-.25 Q-2,-.45 -4.4,.15 Z" fill="${c}"/>` +
    `<path d="M-4.1,.65 Q-2,.15 0,.35 Q2,.15 4.1,.65 Q3.1,3.1 0,3.25 Q-3.1,3.1 -4.1,.65 Z" fill="${c}"/>` +
    `<path d="${lines}" stroke="#fbe2e6" stroke-width=".32" opacity=".55" fill="none"/>` +
    `<path d="M3.2,-1.2 Q4.6,-.4 5.6,.9 Q4.8,1.4 4,2.4" fill="none" stroke="${c}" stroke-width=".9" opacity=".3" stroke-linecap="round"/></g>`;
}
// 흐트러진 머리 (정사 뒤·한창일 때): 정수리·옆머리에서 삐죽삐죽 뻗친 가닥(뿌리 굵고 끝 가늘게, 가는 갈래·윤기 한 줄)
//   + 머리 윤곽 밖으로 부스스한 잔머리 + (4 이상) 이마를 가로질러 볼로 흘러내린 가닥. n 0~5
const TUFT = [[-14, 8, .7], [22, 7, -.8], [-42, 7, .8], [50, 6.5, -.7], [-72, 6.5, .6], [80, 7, -.6], [4, 5.5, 1], [-28, 5.5, -.9], [36, 5.5, .9], [-90, 6, .7], [94, 5.5, -.8], [12, 5, -1]];
function messyHair(hc, n) {
  if (!n) return '';
  const hi = shade(hc, 1.4), lo = shade(hc, .85), cnt = [0, 3, 5, 7, 9, 11][Math.min(5, n)];
  // 뿌리는 머리숱 안쪽(머리 윤곽보다 4~6 안), 끝은 윤곽 밖으로 조금 — 굵게 시작해 휘며 가늘어짐
  const root = deg => { const a = (deg - 90) * Math.PI / 180; return [Math.cos(a), Math.sin(a), 60 + Math.cos(a) * 26, 55 + Math.sin(a) * 27]; };
  const tuft = ([deg, len, bend], i) => {
    const [ux, uy, bx, by] = root(deg), px = -uy, py = ux, w = 2.1;
    const tx = bx + ux * len + px * bend * 3.4, ty = by + uy * len + py * bend * 3.4, mx = bx + ux * len * .55 + px * bend * 1.2, my = by + uy * len * .55 + py * bend * 1.2;
    let o = `<path d="M${P(bx + px * w, by + py * w)} Q${P(mx + px * w * .55, my + py * w * .55)} ${P(tx, ty)} Q${P(mx - px * w * .35, my - py * w * .35)} ${P(bx - px * w, by - py * w)} Z" fill="${hc}"/>`;
    if (i % 3 === 1) o += `<path d="M${P(mx, my)} q${f1(ux * 2.2 - px * bend * 2.6)},${f1(uy * 2.2 - py * bend * 2.6)} ${f1(ux * 3.4 - px * bend * 4.2)},${f1(uy * 3.4 - py * bend * 4.2)}" fill="none" stroke="${hc}" stroke-width=".7" stroke-linecap="round"/>`;   // 갈라진 가는 가닥
    return o + `<path d="M${P(bx + px * .4, by + py * .4)} Q${P(mx, my)} ${P(tx - ux * 1.2, ty - uy * 1.2)}" fill="none" stroke="${hi}" stroke-width=".4" stroke-linecap="round" opacity=".5"/>`;   // 윤기 한 줄
  };
  let o = TUFT.slice(0, cnt).map(tuft).join('');
  // 부스스한 잔머리: 머리 윤곽을 따라 짧게 휘어 나온 가는 털
  if (n >= 2) o += `<path d="${[-58, -24, 14, 46, -84, 86, -4].slice(0, n + 2).map(deg => { const [ux, uy, bx, by] = root(deg), x0 = bx + ux * 3, y0 = by + uy * 3; return `M${P(x0, y0)} q${f1(ux * 2.6 - uy * 2.2)},${f1(uy * 2.6 + ux * 2.2)} ${f1(ux * 4.6 - uy * .6)},${f1(uy * 4.6 + ux * .6)}`; }).join(' ')}" fill="none" stroke="${lo}" stroke-width=".45" stroke-linecap="round" opacity=".85"/>`;
  // 4 이상: 이마를 가로질러 볼 쪽으로 흘러내린 가닥 둘 (가늘게)
  if (n >= 4) o += `<path d="M${P(52.5, 41)} C${P(48.5, 50)} ${P(50.5, 57)} ${P(45.5, 66)} C${P(47.3, 58)} ${P(46.6, 50)} ${P(51.6, 41.3)} Z" fill="${hc}" opacity=".92"/><path d="M${P(69.5, 42)} C${P(73, 51)} ${P(70.6, 58)} ${P(74.6, 68)}" fill="none" stroke="${hc}" stroke-width=".65" stroke-linecap="round" opacity=".9"/>`;
  return o;
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
  const hc = hairColor(a, age);
  const female = a.g === 'f', fig = typeof st.preIntimate === 'object' ? st.preIntimate : null;
  const F = frameOf(a, age, fig), personality = st.personality || 'warm';
  const w = Math.round(size), h = Math.round(size * 7 / 3);
  const bottom = F.ankle + 19, H = 103 + 15 + 348 * 1.12 + 19 - 10, W = H * 120 / 280;
  const x0 = 60 - W / 2, y0 = bottom - H, u = W / 120;
  let o = `<svg class="av av-full" width="${w}" height="${h}" viewBox="${f1(x0)} ${f1(y0)} ${f1(W)} ${f1(H)}" aria-hidden="true">`;
  o += `<rect class="av-bg" x="${f1(x0 + .5 * u)}" y="${f1(y0 + .5 * u)}" width="${f1(W - u)}" height="${f1(H - u)}" rx="${f1(10 * u)}" style="stroke-width:${f1(1.5 * u)}"/>`;
  const hp = hairPieces(a, X, age, hc, { sy: F.sy, chest: F.chest }, { noHat: true });
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
// 머리 (머리 좌표: 정수리~턱 77). 목 그림자·귀·얼굴·눈·눈썹·코·입·앞머리·안경
//   g: { skin, hc, hp, nh(머리 좌표 목 반폭), neckBot, af(다음 날 아침), tier, chin2(이중턱) }
function headSVG(a, X, age, st, g) {
  const { skin, hc, hp, nh, neckBot, af, tier, du } = g, skinD = shade(skin, .86);
  // du(관계 중): { lv 0~3 (pleasure), mood: pleasure | bliss | content | bored | disappointed | wince(아픔·꽉 참) | gasp(헉) }
  // du.major: 대절정 — 질끈 감은 눈 + 벌어진 입(섹스 기술 SS 이상이면 혀까지) + 눈물·얼굴 전체 홍조 (성격과 상관없이)
  const mood = du && (du.mood || 'pleasure'), lv = du ? du.lv || 0 : 0, pk = du && mood === 'pleasure' && lv >= 3 ? (du.major ? { eye: 'squeeze', mouth: du.tongue ? 'ahT' : 'ah', blush: .95, flush: 1, tears: du.personality === 'sensitive' || du.personality === 'warm' ? 2 : 1, sweat: 2 } : PEAK[du.personality]) : null;
  const kid = age <= 12, adult = age >= 20, female = a.g === 'f', ey = 72, ex = [48, 72];
  // 얼굴 유전자 배치 (js/face.js). 파츠는 원래 자리(ex, ey)에서 그리고 아래 변환을 씌움
  const L = layoutOf(a, age), FG = L && L.g;
  if (L) a = Object.assign({}, a, { eyes: FG.eye });
  const G = (t, s2) => t ? `<g transform="${t}">${s2}</g>` : s2;
  const eyeG = (i, s2) => G(L && L.eyeT(i), s2), moveY = L ? L.ey - 72 : 0;
  // 턱 아래·목 옆 그림자
  let o = G(L && `translate(0,${f1(L.chinDy)})`, `<ellipse cx="60" cy="101.5" rx="${f1(nh - .5)}" ry="6" fill="${shade(skin, .6)}" opacity=".26"/>`);
  o += `<path d="M${f1(60 - nh + 1.6)},104 L${f1(60 - nh + 1.6)},${f1(neckBot - 2)} M${f1(60 + nh - 1.6)},104 L${f1(60 + nh - 1.6)},${f1(neckBot - 2)}" stroke="${shade(skin, .66)}" stroke-width="2" opacity=".14"/>`;
  if (a.buds && !af && !du) o += `<path d="M34,78 C30,96 40,112 47,130" fill="none" stroke="#f4f4f4" stroke-width="1.3"/>`;
  // 귀, 얼굴 (6살 이하는 둥근 얼굴). 얼굴은 가운데가 밝고 가장자리로 살짝 어두워짐
  if (a.race !== 'beast' && a.race !== 'elf') o += G(L && L.earT(-1), earSVG(skin, -1)) + G(L && L.earT(1), earSVG(skin, 1));
  if (a.buds && !af && !du) o += `<circle cx="33" cy="76" r="2.6" fill="#f4f4f4"/>`;
  const faceD = L ? L.warp(FACES[FG.shape] || FACES[0]) : FACES[age <= 6 ? 0 : a.face] || FACES[0], fid = `av${UID}f`;
  o += `<defs><radialGradient id="${fid}g" cx=".5" cy=".44" r=".62"><stop offset=".58" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, .91)}"/></radialGradient><clipPath id="${fid}c"><path d="${faceD}"/></clipPath></defs>`;
  o += `<path d="${faceD}" fill="url(#${fid}g)" stroke="${mixC(skin, '#4a2a20', .45)}" stroke-width="${f1(.75 * LW)}" stroke-opacity=".8"/>`;   // 웹툰풍 외곽선 (피부보다 짙은 갈색, 검정 아님)
  // 앞머리·옆머리가 이마와 볼에 드리우는 그림자
  if (hp.shadow) o += `<filter id="${fid}bl" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation=".7"/></filter><g clip-path="url(#${fid}c)"><g transform="translate(.7,2.6)"${LOD >= 2 ? ` filter="url(#${fid}bl)"` : ''}><path d="${hp.shadow}"${hp.shadowT ? ` transform="${hp.shadowT}"` : ''} fill="${shade(skin, .5)}" opacity=".22"/></g></g>`;   // 부드러운 셀 그림자 1단계
  // 귀걸이 (어른만, 남자는 작은 큐빅). 옆머리가 있으면 그 뒤로
  if (adult && X.ear) o += G(L && L.earT(-1), earringSVG(female ? X.ear : 1, X.metal, -1)) + G(L && L.earT(1), earringSVG(female ? X.ear : 1, X.metal, 1));
  if (g.chin2) o += G(L && `translate(0,${f1(L.chinDy)})`, `<path d="M48,100.5 Q60,108.5 72,100.5" fill="none" stroke="${shade(skin, .72)}" stroke-width="1.6" stroke-linecap="round" opacity=".4"/>`);   // 이중턱
  // 볼 홍조 (모두 옅게, 어린이·볼 빨간 사람은 더), 주근깨, 주름
  // 나를 향한 성욕 (st.libido: 이 사람이 지금 대하는 사람 = 나에게 느끼는 것, 어른 이성만). 대상마다 달라서 같은 사람도 누구를 대하느냐에 따라 표정이 다름
  //   30+ 나를 똑바로 봄·눈썹이 풀림 / 50+ 눈에 반짝임·다문 미소·홍조 선 / 70+ 나른하게 내리깐 눈·살짝 벌어진 입술 / 85+ 풀린 눈에 분홍 하트 반사광·더 붉음·땀 한 방울
  const lib = adult && !du && !af ? st.libido || 0 : 0, lt = lib >= 85 ? 4 : lib >= 70 ? 3 : lib >= 50 ? 2 : lib >= 30 ? 1 : 0;
  // 표정 레이어 (기본 neutral — 관계 목록·장소 목록). 얼굴 유전자 위에 눈꺼풀·눈썹·입꼬리만 바꿈
  const xp = !du && !af && !lt ? st.expr || null : null;
  const blush = f1(Math.min(.95, [0, .08, .18, .3, .42][lt] + (pk && pk.blush ? pk.blush : du ? { pleasure: [.42, .56, .68, .8][lv], bliss: .62, content: .45, bored: .1, disappointed: .14, wince: .55, gasp: .66 }[mood] + (du.personality === 'shy' ? .1 : 0)
    : af ? [.1, .1, .25, .42, .55][tier] + (af.personality === 'shy' && tier >= 2 ? .15 : 0) : kid ? .3 : a.blush ? .24 : .1)) * 100) / 100;
  // 볼터치는 눈 아래·바깥 (눈 배치를 따라감). 남자는 옅게, 수줍으면 더
  const bl = Math.min(.95, blush * (female || kid ? 1 : .55) + (xp === 'shy' ? .3 : 0)), bx = L ? L.ex : ex, by = (L ? L.ey : 72) + 12;
  o += `<ellipse cx="${f1(bx[0] - 4)}" cy="${f1(by)}" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${f1(bl * 100) / 100}"/><ellipse cx="${f1(bx[1] + 4)}" cy="${f1(by)}" rx="${kid ? 6.5 : 5.5}" ry="3.3" fill="#e8857a" opacity="${f1(bl * 100) / 100}"/>`;
  if (st.aroused && adult) o += arousalFX(st.aroused);
  if (a.freckles || (FG && FG.marks.freckles)) o += [[43, 80], [46, 82], [49, 80], [71, 80], [74, 82], [77, 80], [57.5, 79.5], [62.5, 79.5]].map(([x, y]) => `<circle cx="${f1(L ? 60 + (x - 60) * FG.eyeGap : x)}" cy="${f1(y + moveY)}" r=".9" fill="${shade(skin, .62)}" opacity=".85"/>`).join('');
  if (X.mole >= 0 && age >= 10) {   // 점: 입가는 입을, 눈 밑은 눈을, 볼은 광대를, 턱은 턱 끝을 따라감
    const [mx, my] = MOLES[X.mole], dot = `<circle cx="${mx}" cy="${my}" r=".8" fill="${shade(skin, .42)}" opacity=".85"/>`;
    o += !L ? dot : X.mole === 0 ? G(L.mouthT, dot) : X.mole === 1 ? eyeG(0, dot) : X.mole === 2 ? G(`translate(${f1(L.cheek)},${f1(moveY * .6)})`, dot) : G(`translate(0,${f1(L.chinDy)})`, dot);
  }
  if (FG && FG.marks.scar === 'chin' && age >= 10) o += `<path d="M62.4,${f1(99 + L.chinDy)} l3.2,-1.6" stroke="${shade(skin, .7)}" stroke-width=".9" stroke-linecap="round" opacity=".7"/>`;
  // 나이: 40 팔자 주름(점점 짙게), 45 눈 밑, 50 눈가 잔주름, 55 이마 주름, 65 턱선 처짐
  const wl = (d, op, w = 1) => `<path d="${d}" fill="none" stroke="${shade(skin, .72)}" stroke-width="${w}" stroke-linecap="round" opacity="${f1(op * 100) / 100}"/>`;
  if (age >= 40) o += G(L && `translate(0,${f1(L.tipY - 83.5)})`, wl('M54.2,82.4 Q51.4,86 52.6,90.4 M65.8,82.4 Q68.6,86 67.4,90.4', clamp((age - 36) / 40, .12, .5)));
  if (age >= 45) o += eyeG(0, `<path d="M41,77 Q44,79 47,78" fill="none" stroke="${shade(skin, .75)}" stroke-width="1"/>`) + eyeG(1, `<path d="M73,78 Q76,79 79,77" fill="none" stroke="${shade(skin, .75)}" stroke-width="1"/>`);
  if (age >= 50) o += eyeG(0, wl('M39.6,70.4 l-2.8,-1.3 M39.8,72.6 l-3.1,.2 M39.6,74.6 l-2.6,1.4', .4, .8)) + eyeG(1, wl('M80.4,70.4 l2.8,-1.3 M80.2,72.6 l3.1,.2 M80.4,74.6 l2.6,1.4', .4, .8));
  if (age >= 55) o += wl('M47,51.6 Q60,49.6 73,51.6 M49.5,55.4 Q60,53.8 70.5,55.4', .3);
  if (age >= 65) o += G(L && `translate(0,${f1(L.chinDy * .6)})`, wl('M39.4,90 Q41.6,95.2 45.6,97.6 M80.6,90 Q78.4,95.2 74.4,97.6', .32));
  // 눈: 흰자 + 홍채 + 하이라이트 + 속눈썹 (어린이는 조금 크게) / 다음 날 아침엔 감은 눈 / 흥분 시 반쯤 감김
  // 속눈썹 꼬리: 여자 어른은 사람마다 0·1·3가닥 (10대는 2까지), 남자는 꼬리 대신 윗선이 조금 더 굵음
  // 속눈썹 3단계 (적게 / 보통 / 풍성하게): 여자는 꼬리 가닥 0·1·2 (+ 풍성하면 아래 속눈썹), 남자는 '풍성하게'만 꼬리 1. 윗선 굵기 0.9·1·1.12배
  const lashLv = FG && Face.lashLevel ? Face.lashLevel(FG, female ? 'f' : 'm') : female ? 2 : 1;
  const nLash = female ? [0, 1, 2][lashLv] : kid ? 1 : lashLv === 2 ? 1 : 0, lidK = [.9, 1, 1.12][lashLv];
  const aro = adult && st.aroused || 0;
  o += ex.map((x, i) => eyeG(i, (() => {
    const s = i ? 1 : -1;
    if (du) {
      if (mood === 'wince') return SQUEEZE(x, ey, s);                                    // 아픔·너무 꽉 참: 질끈 감은 눈
      if (mood === 'gasp') return openEye(a, X, x, ey, s, nLash);                        // 헉: 눈이 번쩍
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
    if (xp === 'laugh') return HAPPY(x, ey);
    if (xp === 'sad') return halfEye(a, X, x, ey, s, nLash, 0, 1.2, -1.4);
    if (xp === 'angry') return halfEye(a, X, x, ey, s, nLash, 0, 0, -1);
    if (xp === 'shy') return halfEye(a, X, x, ey, s, nLash, -1.2 * s, 1.6, -2.6);
    const e = openEye(a, lt ? Object.assign({}, X, { gaze: 0 }) : X, x, ey, s, nLash, { aegyo: X.aegyo && age >= 13, lidK, lowLash: female && lashLv === 2 && age >= 13, skinLn: shade(skin, .74), skinHi: shade(skin, 1.22), wing: female && adult && X.liner, male: !female && age >= 13 });
    return xp === 'surprised' ? `<g transform="translate(${x},${ey}) scale(1.12) translate(${-x},${-ey})">${e}</g>` : !L && kid ? `<g transform="translate(${x},${ey}) scale(1.1) translate(${-x},${-ey})">${e}</g>` : e;
  })())).join('');
  if (lt === 2 || lt === 3) o += ex.map((x, i) => eyeG(i, `<circle cx="${x + 2.2}" cy="${ey - 1.2}" r=".9" fill="#fff" opacity=".85"/><circle cx="${x - 1.4}" cy="${ey + 1.6}" r=".5" fill="#fff" opacity=".7"/>`)).join('');
  // 눈썹 (다음 날 아침 만족감이 낮으면 처짐)
  const XB = { smile: 'soft', laugh: 'soft', shy: 'soft', sad: 'sad', angry: 'angry', surprised: 'surprised' };
  const expr = (xp ? XB[xp] : st.expr) || (pk && 'brow' in pk ? pk.brow : du ? (mood === 'disappointed' || mood === 'wince' ? 'sad' : mood === 'gasp' ? 'surprised' : (mood === 'pleasure' && lv >= 1) || mood === 'bliss' ? 'soft' : null) : af && tier <= 1 ? 'sad' : lt === 1 || lt === 2 ? 'soft' : null);
  const btype = (af && tier >= 3) || mood === 'bliss' || mood === 'content' ? 1 : mood === 'bored' ? 0 : FG ? FG.brow : a.brows;
  const bw = (a.thick ? 3.8 : (a.g === 'm' ? 3.1 : 2.25) * (FG ? Math.min(FG.browThick, 2.1) : 1)) * (kid ? .9 : 1), bc = female && age >= 13 ? mixC(shade(hc, .72), skin, .22) : shade(hc, .72);
  o += ex.map((x, i) => G(L && L.browT(i), `<path d="${browFill(btype, x, ey - 10, i ? 1 : -1, expr, bw * (LOD < 2 ? 1.15 : 1))}" fill="${bc}"/>` + (LOD >= 2 ? browHairs(btype, x, ey - 10, i ? 1 : -1, expr, bw, shade(hc, .62)) : '') +
    (i === 0 && FG && FG.marks.scar === 'brow' && age >= 10 ? `<path d="M${x - 1.4},${ey - 13.4} l1.6,4.2" stroke="${shade(skin, .92)}" stroke-width="1.1" stroke-linecap="round"/>` : ''))).join('');
  // 코 (8종) + 코 아래 그림자 — 길이·폭은 유전자
  o += G(L && L.noseT, noseSVG(FG ? FG.nose : X.nose, skin, kid, female && age >= 13));
  // 입술 색: 여자는 피부색에 붉은기(어른은 립 색 쪽으로), 남자는 피부 음영색. 두께는 유전자
  const lip = { c: female && age >= 18 ? mixC(skin, LIPS[X.lip], .66) : female ? mixC(skin, '#e39aa0', .62) : mixC(shade(skin, .8), '#b8675b', .32),
    teeth: X.teeth, f: FG ? (FG.lipFull < .88 ? 0 : FG.lipFull < 1.16 ? 1 : 2) : X.lipF, gloss: female && adult };
  const neutral = FG ? closedMouth(FG.mouth, lip, female, FG.lipFull) : mouthSVG(a.mouth, lip, female);
  const smiling = !!(xp === 'smile' || xp === 'laugh' || xp === 'shy' || lt === 2 || (du && (mood === 'bliss' || lv >= 1)) || (af && tier >= 3) || (!xp && !du && !af && !lt && FG && (FG.mouth === 'smile' || FG.mouth === 'wide')));
  o += G(L && L.mouthT, pk ? { joy2: JOY(2, lip, female), joy1: JOY(1, lip, female), o: mouthSVG(3, lip, female), tongue: JOY(1, lip, female) + TONGUE, smile: mouthSVG(1, lip, female), smirk: SMIRK(lip), tremble: TREMBLE(lip, female), ah: AH(2, lip, female), ahT: AH(1.4, lip, female) + TONGUE }[pk.mouth]
    : du ? ({ bliss: JOY(0, lip, female), content: mouthSVG(1, lip, female), bored: mouthSVG(2, lip, female), disappointed: POUT(lip), wince: TREMBLE(lip, female), gasp: mouthSVG(3, lip, female) }[mood] || (lv ? JOY(lv - 1, lip, female) : mouthSVG(1, lip, female)))
    : af ? (tier === 0 ? FROWN : tier === 1 ? mouthSVG(2, lip, female) : tier >= 3 && af.personality !== 'cool' ? mouthSVG(1, lip, female) : mouthSVG(0, lip, female))
    : aro >= 71 ? mouthSVG(1, lip, female) : aro >= 51 ? mouthSVG(3, lip, female)
    : lt >= 3 ? PARTED(lt - 3, lip, female) : lt === 2 ? (FG ? closedMouth('smile', lip, female, FG.lipFull) : mouthSVG(4, lip, female))
    : xp === 'smile' ? closedMouth('smile', lip, female, FG ? FG.lipFull : 1) : xp === 'laugh' ? JOY(1, lip, female) : xp === 'sad' ? closedMouth('down', lip, female, FG ? FG.lipFull : 1)
    : xp === 'angry' ? closedMouth('flat', lip, female, FG ? FG.lipFull : 1) : xp === 'surprised' ? mouthSVG(3, lip, female) : xp === 'shy' ? closedMouth('small', lip, female, FG ? FG.lipFull : 1)
    : neutral);
  // 보조개: 웃을 때만
  if ((a.dimples || (FG && FG.marks.dimples)) && smiling) o += G(L && L.mouthT, `<path d="M50.6,89.2 q-.8,1 -.1,2 M69.4,89.2 q.8,1 .1,2" fill="none" stroke="${shade(skin, .72)}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`);
  if (!female && adult) o += beardSVG(X.beard, hc, `${fid}c`, L);
  // 립스틱 자국은 bareBody에서 목·쇄골에 표시
  if (af && tier >= 4 && female) {
    o += `<path d="M42,74 Q38,78 36,82" fill="none" stroke="#555" stroke-width="1.2" opacity=".25" stroke-linecap="round"/>`;
    o += `<path d="M78,74 Q82,78 84,82" fill="none" stroke="#555" stroke-width="1.2" opacity=".25" stroke-linecap="round"/>`;
  }
  const BL = s2 => G(L && `translate(0,${f1(moveY)}) translate(60,0) scale(${FG ? FG.eyeGap.toFixed(3) : 1},1) translate(-60,0)`, s2);
  if (lt >= 2) o += BL(`<g opacity="${lt >= 3 ? .8 : .45}">${BLUSH_LINES}</g>`);
  // 앞머리·옆머리
  // 이불을 덮었으면 앞머리·옆머리 끝은 이불 속으로
  o += g.cut ? `<clipPath id="av${UID}cut"><rect width="120" height="${g.cut}"/></clipPath><g clip-path="url(#av${UID}cut)">${hp.front}</g>` : hp.front;
  const hcr = hairColor(a, age);   // 실제 머리색 (hc는 눈썹색 — 염색하면 다름)
  if (af && tier >= 2) o += messyHair(hcr, [0, 0, 1, 3, 5][tier]);
  if (lt >= 4) o += SWEAT(83, 52, .7);
  if (af) o += [[82, 52], [37, 57], [70, 118]].slice(0, Math.min(3, Math.floor((af.sat ?? 50) / 30))).map(([x, y]) => SWEAT(x, y, .85)).join('');
  // 립스틱 번짐: 가장자리가 흐린 얼룩 — 오른쪽 입꼬리에서 볼 쪽으로 끌린 자국, 윗입술 위로 번짐 (90+면 아랫입술 아래로 끌림·턱 쪽 줄·볼에 찍힘까지)
  if (af && female && tier >= 3) o += G(L && L.mouthT, `<defs><filter id="${fid}sm" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation=".45"/></filter></defs><g filter="url(#${fid}sm)" fill="${lip.c}">` +
    `<path d="M64.2,88.2 C66.8,87.6 70,87.2 72.8,85.8 C71.6,87.8 68.6,89.4 64.6,89.9 Z" opacity=".42"/><path d="M57.4,86.3 Q60.4,85.2 63.2,86.2 Q60.4,86.9 57.4,86.3 Z" opacity=".3"/>` +
    (tier >= 4 ? `<path d="M56.2,91.2 C54.2,92.6 51.4,93.9 48.8,93.9 C50.8,92.3 53.4,91.1 55.8,90.4 Z" opacity=".4"/><path d="M60.4,92.8 C61.6,94.4 61.8,96.2 61.2,97.8 C60.6,96.2 60.2,94.6 60.4,92.8 Z" opacity=".28"/><ellipse cx="67" cy="91.8" rx="2.6" ry="1" opacity=".22"/>` : '') + '</g>');
  if (af && af.lipstick && tier >= 3) o += KISS(75, 84, -16, '#c43c4f', .75) + (tier >= 4 ? KISS(46, 64, 12, '#c43c4f', .6) : '');   // 남자 상대: 볼·이마에 내 립스틱 자국
  if (du) {
    o += messyHair(hcr, { pleasure: lv + 1, bliss: 5, content: 3, bored: 0, disappointed: 1 }[mood]);
    if ((mood === 'pleasure' && lv >= 1) || mood === 'bliss') o += BL(BLUSH_LINES);
    if (mood === 'pleasure' && lv >= 2) o += [[80, 50], [38, 54]].slice(0, lv - 1).map(([x, y]) => SWEAT(x, y)).join('');
    if ((mood === 'pleasure' && lv >= 2) || mood === 'bliss') o += MINI_HEARTS;
    if (pk && pk.tears) o += BL(TEARS(pk.tears));
    if (pk && pk.flush) o += '<ellipse cx="60" cy="81" rx="21" ry="6" fill="#e8857a" opacity=".38"/>';
    if (pk && pk.sweat) o += SWEAT(84, 54, .75) + (pk.sweat > 1 ? SWEAT(35, 60, .6) : '');
    if (mood === 'bliss') o += SPARKLE(30, 40, 1.1) + SPARKLE(92, 64, .8);
    if (mood === 'disappointed') o += SWEAT(88, 44, 1.7);
    if (du.detail) {
      // 디테일(테스트): 얼굴 전체로 번지는 홍조, 이마·관자놀이 땀, 이마·볼에 달라붙은 젖은 머리 가닥, 입가 숨결 (js/night.js가 opacity를 바꿈)
      o += `<defs><radialGradient id="${fid}fl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff5f7e" stop-opacity=".26"/><stop offset=".7" stop-color="#ff6f8a" stop-opacity=".12"/><stop offset="1" stop-color="#ff6f8a" stop-opacity="0"/></radialGradient>` +
        `<radialGradient id="${fid}br" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
        `<g clip-path="url(#${fid}c)"><ellipse class="av-flush" cx="60" cy="80" rx="30" ry="17" fill="url(#${fid}fl)" opacity="0"/></g>`;
      o += `<g class="av-swt" opacity="0">${SWEAT(43, 55, .6)}${SWEAT(78, 58, .55)}${SWEAT(36, 74, .5)}<ellipse cx="56" cy="51" rx="3.2" ry=".9" fill="#fff" opacity=".55"/><ellipse cx="66" cy="53" rx="2" ry=".6" fill="#fff" opacity=".45"/>${G(L && L.noseT, '<ellipse cx="60.6" cy="82.2" rx="1" ry=".55" fill="#fff" opacity=".7"/>')}</g>`;
      const strand = (pts, w) => { const [[bx, by], [cx, cy], [tx, ty]] = pts, dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy), px = -dy / l * w, py = dx / l * w; return `<path d="M${P(bx + px, by + py)} Q${P(cx + px * .5, cy + py * .5)} ${P(tx, ty)} Q${P(cx - px * .5, cy - py * .5)} ${P(bx - px, by - py)} Z" fill="${hcr}"/>`; };
      o += `<g class="av-damp" opacity="0">${strand([[53, 44], [49, 56], [52, 67]], 1.1)}${strand([[57, 45], [58, 55], [55, 62]], .8)}${strand([[38, 60], [37, 74], [44, 88]], 1)}${strand([[82, 58], [84, 70], [77, 83]], .9)}</g>`;
      o += G(L && L.mouthT, `<g class="av-breath" opacity="0"><ellipse cx="70" cy="93.5" rx="2.6" ry="1.8" fill="url(#${fid}br)" opacity=".7"/><ellipse cx="75.5" cy="91.5" rx="3.4" ry="2.3" fill="url(#${fid}br)" opacity=".5"/><ellipse cx="81.5" cy="89" rx="4.2" ry="2.8" fill="url(#${fid}br)" opacity=".32"/></g>`);
    }
  }
  // 종족 장식 (판타지 영지 모드): 앞머리 위에 그림
  if (a.race) o += raceSVG(a, skin, hairColor(a, age), L, G);
  // 안경 (눈 간격·크기를 따라감)
  o += G(L && a.glasses && L.glassT, glassesSVG(a.glasses, X.glc));
  return o;
}
// 종족 장식 — 엘프 귀(길고 뾰족, 머리 위로 비죽) · 수인 귀(늑대·여우·고양이·토끼, 머리색 털 + 분홍 속) · 오크 아래 엄니 · 드워프 수염(남자, 1 짧게 다듬음 · 2 풍성 · 3 땋은 긴 수염)
function raceSVG(a, skin, hc, L, G) {
  let o = '';
  const ln = shade(skin, .62), d = shade(skin, .88);
  if (a.race === 'elf') {
    const ear = s => { const X = dx => f1(60 + s * dx);
      return `<path d="M${X(24.6)},63.5 C${X(28.5)},61 ${X(34)},55 ${X(41.5)},45.5 C${X(39.5)},55 ${X(36)},64 ${X(32)},71.5 C${X(31)},76.5 ${X(29.6)},80.6 ${X(27)},81.2 C${X(25.4)},81.5 ${X(24.5)},80 ${X(24.3)},77.6 Z" fill="${d}" stroke="${ln}" stroke-width=".7" stroke-opacity=".7"/>` +
        `<path d="M${X(27)},66 C${X(30)},62.5 ${X(34)},57 ${X(38)},50.5 M${X(27.2)},68.5 C${X(30)},70 ${X(30.4)},73.5 ${X(29.2)},76.5" fill="none" stroke="${ln}" stroke-width=".8" stroke-linecap="round" opacity=".5"/>`; };
    o += G(L && L.earT(-1), ear(-1)) + G(L && L.earT(1), ear(1));
  } else if (a.race === 'beast') {
    const kind = a.beast || 'wolf', fur = hc, furD = shade(hc, .72), inner = '#efb7ae', tip = kind === 'fox' ? '#2a211d' : null;
    const shapes = {   // 왼쪽 귀 (오른쪽은 거울): 바깥 · 안쪽
      wolf:   ['M33,49 C31,38 32,27 36,19 C42,24 48,31 51,39 Z', 'M36.5,45 C35.5,37 36.5,30 38.3,25.5 C41.5,29 44.5,33.5 46.5,38.5 Z'],
      fox:    ['M31,51 C27,38 28,23 33,13 C41,19 49,30 52,40 Z', 'M34.8,46.5 C32.8,37 33.4,27 35.8,20.5 C40.5,25.5 45,32 47.5,39 Z'],
      cat:    ['M34,47 C33,40 34,33 37,27 C42,30 47,35 50,40 Z', 'M37,44 C36.6,39 37.4,34.5 39,31 C41.8,33.5 44.5,36.5 46.2,39.6 Z'],
      rabbit: ['M41,44 C36,33 33,18 35,6 C37.5,2 41.5,3 43,8 C46,19 47,32 47.5,42 Z', 'M41.6,38 C38.6,29 37,18 38.2,9.5 C39.4,7.6 40.8,8 41.4,10.5 C43.4,19 44.4,28.5 44.8,37 Z'],
    }[kind] || [];
    const one = s => { const m = s > 0 ? ' transform="translate(120,0) scale(-1,1)"' : '';
      return `<g${m}><path d="${shapes[0]}" fill="${fur}" stroke="${furD}" stroke-width=".9"/><path d="${shapes[1]}" fill="${inner}" opacity=".9"/>` +
        (tip ? `<path d="M31.6,24 C31.2,19.5 32,16 33,13 C36,15.2 38.6,17.6 40.6,20.6 Z" fill="${tip}" opacity=".85"/>` : '') +
        `<path d="${shapes[1]}" fill="none" stroke="#fff" stroke-width=".8" stroke-dasharray="1.4 1.8" opacity=".55"/></g>`; };
    o += one(-1) + one(1);
  } else if (a.race === 'orc') {
    const t = `<path d="M53.2,94.6 L52.2,88.2 Q53.4,87.4 54.6,88.4 L55.6,94.2 Z" fill="#f1ead6" stroke="#8d8466" stroke-width=".6"/><path d="M66.8,94.6 L67.8,88.2 Q66.6,87.4 65.4,88.4 L64.4,94.2 Z" fill="#f1ead6" stroke="#8d8466" stroke-width=".6"/>`;
    o += G(L && L.mouthT, t);
    o += `<path d="M44,62.5 Q49,60.2 54.5,62.4 M65.5,62.4 Q71,60.2 76,62.5" fill="none" stroke="${shade(skin, .6)}" stroke-width="1.2" opacity=".35"/>`;   // 굵은 눈두덩
  }
  if (a.beard) {
    const bc = hc, bd = shade(hc, .72), lv = a.beard;
    const body = lv === 1 ? 'M39,84 C40,96 49,104 60,105 C71,104 80,96 81,84 C77,92 70,96 60,96.5 C50,96 43,92 39,84 Z'
      : lv === 2 ? 'M37,80 C37,98 46,112 60,114 C74,112 83,98 83,80 C79,92 71,97 60,97.5 C49,97 41,92 37,80 Z'
      : 'M37,80 C36,98 44,110 52,116 L54,126 L57,117 L60,128 L63,117 L66,126 L68,116 C76,110 84,98 83,80 C79,92 71,97 60,97.5 C49,97 41,92 37,80 Z';
    const stache = 'M50.5,90.6 C53.5,87.6 57.5,88 60,89.6 C62.5,88 66.5,87.6 69.5,90.6 C66,90.4 63,91.6 60,92 C57,91.6 54,90.4 50.5,90.6 Z';
    o += G(L && `translate(0,${f1(L.chinDy)})`, `<path d="${body}" fill="${bc}" stroke="${bd}" stroke-width=".8"/>` +
      `<path d="M46,101 q2,6 1,11 M54,104 q1,6 0,10 M66,104 q-1,6 0,10 M74,101 q-2,6 -1,11" fill="none" stroke="${bd}" stroke-width=".8" opacity=".55"/>` +
      (lv === 3 ? `<path d="M54.5,118 h3 M58.5,121 h3 M62.5,118 h3" stroke="#c9a24a" stroke-width="1.6" stroke-linecap="round"/>` : ''));
    o += G(L && L.mouthT, `<path d="${stache}" fill="${bc}" stroke="${bd}" stroke-width=".6"/>`);
  }
  return o;
}
// 머리색 (흰머리 섞기 전). 어린이·10대는 염색 안 함 → 원래 머리색
const hairColor = (a, age) => HAIR[age <= 18 && (DYED.has(a.hc) || a.hc === GRAY) ? (a.hcN ?? (a.hc % 2 ? 2 : 1)) : a.hc] || HAIR[0];
// 눈썹·수염용: 흰머리가 섞인 색
const browColor = (a, age) => { const hc = DYED.has(a.hc) && a.hcN != null && !DYED.has(a.hcN) ? mixC(HAIR[a.hcN], hairColor(a, age), .25) : hairColor(a, age), gl = grayLevel(a, age); return gl > 0 ? mixC(hc, '#d2cdc6', Math.pow(gl, 1.4) * .6) : hc; };   // 염색해도 눈썹은 원래 머리색 쪽
// 지금 입은 한 벌 (js/outfit.js): st.outfit > st.ctx(계절·장소·시간·사람 정보)로 고름 > 생김새의 대표 한 벌
const outfitOf = (a, age, st, X) => st.outfit || (window.Outfit ? Outfit.pick(a, age, st.ctx, X) : null) || { inner: { k: 'tee', c: TOP_COLORS[a.tc || 0] }, bottom: { k: 'jeans', c: '#4a5f86', cut: 'straight' }, shoes: { k: 'sneaker', c: '#eceae6' }, acc: {} };
const hatCtx = (st, OF) => OF && OF.acc && OF.acc.hat ? Object.assign({}, st.ctx, { hat: OF.acc.hat }) : st.ctx;
// SVG 문자열 안의 절대 좌표를 W(x, y)로 옮김 (path d의 대문자 명령, cx·cy, x·y). 상대 명령(소문자)은 변위라 그대로 둠
function warpSVG(svg, W) {
  const wp = d => {
    const tk = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    const AR = { M: 2, L: 2, T: 2, C: 6, S: 4, Q: 4, A: 7, H: 1, V: 1, Z: 0 };
    let out = '', cmd = '', i = 0, cx = 0, cy = 0;
    while (i < tk.length) {
      if (/[A-Za-z]/.test(tk[i])) { cmd = tk[i++]; out += cmd; if (cmd === 'Z' || cmd === 'z') continue; }
      const U = cmd.toUpperCase(), n = AR[U], abs = cmd === U, nums = tk.slice(i, i + n).map(Number); i += n;
      if (nums.length < n) break;
      if (!abs) { if (U === 'H') cx += nums[0]; else if (U === 'V') cy += nums[0]; else { cx += nums[n - 2]; cy += nums[n - 1]; } out += nums.join(',') + ' '; continue; }
      if (U === 'H' || U === 'V') { if (U === 'H') cx = nums[0]; else cy = nums[0]; const q = W(cx, cy); out = out.slice(0, -1) + 'L' + P(q[0], q[1]) + ' '; continue; }
      const o = nums.slice();
      for (let j = U === 'A' ? 5 : 0; j < n; j += 2) { const q = W(nums[j], nums[j + 1]); o[j] = f1(q[0]); o[j + 1] = f1(q[1]); }
      cx = nums[n - 2]; cy = nums[n - 1]; out += o.join(',') + ' ';
    }
    return out;
  };
  return svg.replace(/ d="([^"]*)"/g, (m, d) => ` d="${wp(d)}"`)
    .replace(/cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g, (m, x, y) => { const q = W(+x, +y); return `cx="${f1(q[0])}" cy="${f1(q[1])}"`; });
}
// 기본 서기 자세 (1-7): 차렷(소심·냉철) / 짝다리(직진·장난·낙천) / 손 모음(다정·예민) / 주머니(무심, 바지·후디일 때만)
//   arms: default·hip·cross·clasp·pocket·pocket1, stance: stand·contra. 냉철형은 차렷 + 팔짱, 직진형은 짝다리 + 한 손 허리
const POSE = { shy: ['stand', 'default'], sharp: ['stand', 'cross'], bold: ['contra', 'hip'], playful: ['contra', 'default'], sunny: ['contra', 'default'],
  warm: ['stand', 'clasp'], sensitive: ['stand', 'clasp'], cool: ['stand', 'pocket'] };
// 짝다리: 체중 실은 쪽 골반이 3.5° 올라가고 바깥으로 밀림, 반대쪽 무릎은 살짝 굽어 안쪽으로, 발은 바깥·뒤꿈치 들림, 어깨는 반대로 1.5°
function stanceOf(A, ws) {
  const { y, w, leg: L } = A, k = A.hs, fs = -ws, sway = 3.4, tilt = Math.tan(4 * Math.PI / 180), kb = 3.4, fo = 2.4;
  const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const W = (x, yy) => {
    const side = clamp((x - 60) / 2.5, -1, 1), free = Math.max(0, side * fs);
    const fsw = 1 - ramp(yy, y.hip, y.ankle), ft = 1 - ramp(yy, y.hip, y.knee);
    let dx = ws * sway * fsw, dy = -(x - 60) * ws * tilt * ft;
    if (free) {
      const kn = Math.max(0, 1 - Math.abs(yy - y.knee) / (y.knee - y.thigh) * .9);
      dx += free * (-fs * kb * kn + fs * fo * ramp(yy, y.knee, y.ankle));
      dy -= free * 1.8 * ramp(yy, y.calf, y.ankle);
    }
    return [x + dx, yy + dy];
  };
  return { ws, fs, W, heel: 1.8, up: `translate(${f1(ws * sway)},0) rotate(${ws * 1.8},60,${f1(y.waist)})` };
}
// 옷 입은 전신: 0 0 120 280, 바닥선 272. 머리는 머리 좌표 그대로 그려서 나이별 머리 높이에 맞게 줄임
function renderFull(a, size, st) {
  UID++;
  const X = extras(a), age = st.age ?? 25, skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86), hc = hairColor(a, age), OF = outfitOf(a, age, st, X);
  const A = anchorsOf(a, age, typeof st.full === 'object' ? st.full : null), { y, w } = A, hs = A.hs;
  const toHead = v => (v - A.hty) / hs, HG = s => `<g transform="translate(${f1(A.htx)},${f1(A.hty)}) scale(${hs.toFixed(4)})">${s}</g>`;
  const hp = hairPieces(a, X, age, hc, { sy: toHead(y.sh), chest: toHead(y.bust) }, hatCtx(st, OF));
  const skirtish = !!(OF.dress || (OF.bottom && SKIRTS[OF.bottom.k]));
  // 자세: st.pose('default'|'hip'|'cross'|'clasp'|'pocket'|'contra'…) 또는 성격. 어린이는 차렷. 주머니는 바지·후디일 때만
  const pz = typeof st.pose === 'string' && st.pose !== 'default' ? (st.pose === 'contra' ? ['contra', 'default'] : st.pose.startsWith('contra-') ? ['contra', st.pose.slice(7)] : ['stand', st.pose]) : st.pose === 'default' ? ['stand', 'default'] : POSE[st.personality] || ['stand', 'default'];
  let [stance, pose] = age <= 12 ? ['stand', 'default'] : pz;
  if (pose === 'pocket' && skirtish && !(OF.inner && OF.inner.k === 'hoodie')) pose = 'cross';
  if (pose === 'pocket' && hash(String(a.fs || a.hair)) % 3 === 0) pose = 'pocket1';
  const ST = stance === 'contra' ? stanceOf(A, pose === 'hip' ? 1 : hash(String(a.fs || a.face)) % 2 ? 1 : -1) : null;
  const low = lowerFull(a, X, age, A, skinD, OF, ST), T = topFull(a, OF, A, skinD, X), AR = armsFull(A, null, pose, skinD, T, low.hipEdge, !!st.ring && age >= 19);
  const neckBot = y.neck + 4 * hs, LW = s => ST ? warpSVG(s, ST.W) : s, UP = s => ST ? `<g transform="${ST.up}">${s}</g>` : s;
  let o = `<svg class="av av-full" width="${Math.round(size)}" height="${Math.round(size * 7 / 3)}" viewBox="0 0 120 280" aria-hidden="true">`;
  o += `<rect class="av-bg" x=".5" y=".5" width="119" height="279" rx="10" style="stroke-width:1.5"/>`;
  o += UP(HG(hp.back)) + LW(low.legs) + low.shoes + LW(low.cloth) + UP(AR.back);
  o += UP(`<path d="M${f1(60 - w.nh)},${f1(A.hty + 90 * hs)} L${f1(60 + w.nh)},${f1(A.hty + 90 * hs)} L${f1(60 + w.nh)},${f1(neckBot)} L${f1(60 - w.nh)},${f1(neckBot)} Z" fill="${skinD}"/>`);
  o += UP(T.svg) + LW(low.belt) + UP(AR.front);
  o += UP(HG(headSVG(a, X, age, st, { skin, hc: browColor(a, age), hp, nh: w.nh / hs, neckBot: toHead(neckBot), af: null, tier: -1, chin2: A.chubbyM })));
  if (st.guides) o += guidesSVG(A);
  return o + '</svg>';
}
// 회색 아바타: 얼굴 없이 머리·어깨(전신이면 몸까지) 실루엣
function graySVG(w, h, full) {
  const vb = full ? 280 : 160;
  return `<svg class="av av-gray" width="${w}" height="${h}" viewBox="0 0 120 ${vb}" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="${vb - 1}" rx="10"/><g fill="#9aa1aa">` + (full
    ? '<circle cx="60" cy="40" r="19"/><path d="M60,63 C38,63 31,78 29,98 L25,168 H38 L43,262 H57 L60,182 L63,262 H77 L82,168 H95 L91,98 C89,78 82,63 60,63 Z"/>'
    : '<circle cx="60" cy="62" r="27"/><path d="M60,95 C30,95 14,114 12,160 H108 C106,114 90,95 60,95 Z"/>') + '</g></svg>';
}
function render(a, size = 48, state = 25) {
  const st = typeof state === 'object' && state ? state : { age: state };
  const age = st.age ?? 25, full = !!st.full, adult = age >= 20;
  const w = Math.round(size), h = Math.round(size * (full ? 7 / 3 : 4 / 3));
  if (!a) return `<svg class="av" width="${w}" height="${h}" viewBox="0 0 120 ${full ? 280 : 160}" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="${full ? 279 : 159}" rx="10"/></svg>`;
  if (a.blank === true) return graySVG(w, h, full);   // 샌드박스 '외모 정하지 않음' — 회색 실루엣 (나만. gray는 흰머리 나는 정도라 따로)
  if (adult && st.preIntimate) return renderPreIntimate(a, size, st);
  if (full) { LOD = size < 200 ? 1 : 2; LW = LOD < 2 ? 1.2 : 1; try { return renderFull(a, size, st); } finally { LOD = 2; LW = 1; } }
  // 작은 화면 (FACE_UPGRADE 1절): 96px 이하는 얼굴만 크롭 + 선 ×1.3 + 작은 디테일 끔. 함께 밤·아침 장면은 그대로
  const lod = st.after || st.during || st.mask ? 2 : st.lod ?? (size <= 48 ? 0 : size <= 96 ? 1 : 2);
  LOD = lod; LW = lod < 2 ? 1.3 : 1;
  try { return renderPortrait(a, size, st, lod < 2); } finally { LOD = 2; LW = 1; }
}
function renderPortrait(a, size, st, crop) {
  const age = st.age ?? 25, adult = age >= 20, w = Math.round(size), h = Math.round(size * 4 / 3);
  // 상반신 (0 0 120 160): 머리·어깨·가슴 위. 몸은 전신과 같은 앵커(어깨 폭·가슴 높이·팔)를 머리 좌표로 옮겨 그림
  UID++;
  if (st.mask) a = Object.assign({}, a, { top: 0, tc: 5, glasses: 0 });   // 검사용 (test.html 가림 테스트): 같은 회색 옷, 안경 없음, 머리 없음
  const X = extras(a);
  const af = adult && st.after ? st.after : null, du = adult && !af && st.during ? st.during : null, tier = af ? tierOf(af.sat ?? 50) : -1;
  const skin = SKIN[a.skin] || SKIN[1], skinD = shade(skin, .86), hc = hairColor(a, age), OF = af || du ? null : outfitOf(a, age, st, X);
  const fig = adult ? (af || du || st).fig : null;
  const A = anchorsOf(a, age, fig && typeof fig === 'object' ? fig : null), hs = A.hs, toHead = v => (v - A.hty) / hs;
  const BG = s => `<g transform="scale(${(1 / hs).toFixed(4)}) translate(${f1(-A.htx)},${f1(-A.hty)})">${s}</g>`;
  const hp = st.mask ? { back: '', front: '', shadow: '' } : hairPieces(a, X, age, hc, { sy: toHead(A.y.sh), chest: toHead(A.y.bust) }, af || du ? { noHat: true } : hatCtx(st, OF));
  const nh = A.w.nh / hs, neckBot = toHead(A.y.neck + 4 * hs);
  const neck = c => `<path d="M${f1(60 - nh)},94 L${f1(60 + nh)},94 L${f1(60 + nh)},${f1(neckBot)} L${f1(60 - nh)},${f1(neckBot)} Z" fill="${c}"/>`;
  // 함께 밤을 보내는 중(du): 조금 더 넓게 잡아(3:4 유지) 가슴까지 들어오게
  let o = crop ? `<svg class="av" width="${w}" height="${h}" viewBox="18 14 84 112" aria-hidden="true"><rect class="av-bg" x="18.4" y="14.4" width="83.2" height="111.2" rx="7"/>`
    : du ? `<svg class="av" width="${w}" height="${h}" viewBox="-7 12 134 178.7" aria-hidden="true"><rect class="av-bg" x="-6.5" y="12.5" width="133" height="177.7" rx="10"/>`
    : `<svg class="av" width="${w}" height="${h}" viewBox="0 0 120 160" aria-hidden="true"><rect class="av-bg" x=".5" y=".5" width="119" height="159" rx="10"/>`;
  // 함께 밤을 보내는 중: 칸은 그대로 두고 인물(av-fig)·머리(av-hb·av-head)·가슴(av-bust)을 js/night.js가 따로 움직임
  const mv = !!du;
  if (mv) o += `<g class="av-fig"><g class="av-hb">${hp.back}</g><g class="av-body">`;
  else o += hp.back;
  let cut = 0;
  if (af || du) {
    // 이불 높이: 여자는 가슴 꼭짓점보다 늘 3 이상 위 (가슴골까지만). 아침엔 만족감이 높을수록 조금 내려가고, 소심형은 끌어올려 움켜쥠
    const shy = (af || du).personality === 'shy', apex = toHead(A.y.bust);
    const by = Math.round(a.g === 'f' ? apex - (af ? [7, 6, 5, 4, 3][tier] : 4) - (shy ? 2 : 0) : apex + (af ? [-4, -3, -2, -1, 0][tier] : -1) - (shy ? 2 : 0));
    cut = du ? 0 : by + 2;   // 함께 밤을 보내는 중엔 이불 없이 (다음 날 아침엔 이불)
    o += neck(skin) + bareBody(a, A, skin, { by, marks: af ? tier : 0, lipstick: af && af.lipstick, hickey: af && af.hickey, clutch: shy && !du, noQuilt: !!du, dx: (af || du).detail || null });
  } else {
    const T = topFull(a, OF, A, skinD, X), AR = armsFull(A, null, 'default', skinD, T, A.w.hip + 2);
    o += BG(AR.back) + neck(skinD) + BG(T.svg + AR.front);
  }
  if (mv) o += '</g><g class="av-head">';
  o += headSVG(a, X, age, st, { skin, hc: browColor(a, age), hp, nh, neckBot, af, tier, du, cut, chin2: A.chubbyM });
  if (mv) o += '</g></g>';
  return o + '</svg>';
}

const topColor = a => TOP_COLORS[(a && a.tc) || 0];
// anchors: 전신 앵커(px)를 그대로 꺼내 봄 (test.html 비교용)
/* ---------- 대학 로고 (SCHOOL.md): 교색 + 도형 + 이니셜 ----------
   최상위권: 방패 + 금색 테두리 + 월계수 / 상위권: 방패 + 금색 테두리 / 중·하위권: 이중 원 / 전문대: 둥근 네모 */
function univLogo(u, size = 40) {
  if (!u) return '';
  const c = u.color, dark = shade(c, .68), ch = u.mark || u.name[0], shield = u.tier <= 2;
  let shape;
  if (shield) {
    shape = `<path d="M50,5 L89,17 L85,57 C81,78 67,90 50,96 C33,90 19,78 15,57 L11,17 Z" fill="${c}" stroke="${dark}" stroke-width="3"/>` +
      `<path d="M50,13 L81,23 L78,56 C74,72 63,82 50,88 C37,82 26,72 22,56 L19,23 Z" fill="none" stroke="#f3d27a" stroke-width="2.2" opacity=".9"/>` +
      `<path d="M14,10 L50,0 L86,10" fill="none" stroke="#fff" stroke-width="2" opacity=".18"/>`;
    if (u.tier === 1) shape += [-1, 1].map(sd => [0, 1, 2, 3].map(i => {
      const t = .35 + i * .15, x = 50 + sd * (12 + i * 6.5), y = 84 - i * 6;
      return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="4.6" ry="2.2" transform="rotate(${f1(sd * (35 + i * 14))} ${f1(x)} ${f1(y)})" fill="#f3d27a" opacity="${t + .4}"/>`;
    }).join('')).join('');
  } else if (u.tier <= 4) shape = `<circle cx="50" cy="50" r="45" fill="${c}" stroke="${dark}" stroke-width="3"/><circle cx="50" cy="50" r="36" fill="none" stroke="#fff" stroke-width="2.4" opacity=".75"/>` +
    `<path d="M22,30 A36,36 0 0 1 78,30" fill="none" stroke="#fff" stroke-width="5" opacity=".12"/>`;
  else shape = `<rect x="7" y="7" width="86" height="86" rx="20" fill="${c}" stroke="${dark}" stroke-width="3"/><rect x="16" y="16" width="68" height="68" rx="13" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>`;
  return `<svg class="ulogo" width="${Math.round(size)}" height="${Math.round(size)}" viewBox="0 0 100 100" aria-hidden="true">${shape}` +
    `<text x="50" y="${shield ? 61 : 64}" text-anchor="middle" font-size="${(shield ? 38 : 42) * (ch.length > 1 ? .62 : 1)}" font-weight="700" fill="#fff" font-family="'Nanum Gothic Coding', sans-serif" style="paint-order:stroke" stroke="${dark}" stroke-width="2">${ch}</text></svg>`;
}

// 고를 수 있는 파츠 이름 (20세 시작 외모 단계)
const PARTS = {
  hair: { m: HSTYLES.m.map(x => x.label), f: HSTYLES.f.map(x => x.label) },
  front: FRONT_IDS.map(id => ({ id, label: FRONT_LABEL[id] })),
  hc: ['흑발', '짙은 갈색', '밝은 갈색', '회색', '와인', '애쉬 금발', '애쉬브라운', '구릿빛', '밀크티 베이지', '핑크 브라운', '흑갈색', '밀크브라운', '다크초코', '탈색 금발', '애쉬그레이', '핑크', '블루블랙', '레드', '골든 금발', '밝은 금발', '스트로베리 블론드', '진저 레드', '적갈색', '더티 블론드']
    .map((label, id) => ({ id, label, color: HAIR[id] })).filter(x => x.id !== GRAY),
  skin: ['밝은', '보통', '어두운', '진한', '아주 밝은', '밝은 올리브', '올리브', '따뜻한 갈색', '짙은 갈색', '아주 짙은'].map((label, id) => ({ id, label, color: SKIN[id] })),
  iris: ['검정', '갈색', '밝은 갈색', '헤이즐', '짙은 회색', '파랑', '하늘색', '초록', '초록 헤이즐', '회색'].map((label, id) => ({ id, label, color: IRIS[id] })),
  eyes: Face.EYES.map((e, id) => ({ id, label: e.name })),
  shape: Face.SHAPE_LABEL.map((label, id) => ({ id, label })),
  brow: Face.BROW_LABEL.map((label, id) => ({ id, label })),
  lash: Face.LASH_LABEL.map((label, id) => ({ id, label })),
  browLv: Face.BROWLV_LABEL.map((label, id) => ({ id, label })),
};
// 얼굴 유전자 (js/face.js): 지금 나이의 유전자, 두 사람 얼굴 거리(3 미만이면 비슷함), 프로필 특징 문장
const effGenes = a => { const g = genesOf(a); return g && Object.assign({}, g, { eye: g.eye != null ? g.eye : a.eyes }); };
// 얼굴 재능 (FACE_UPGRADE 4절): 배치 55% + 파츠 45% → 백분위 등급. 20살 기준 얼굴(나이 들면 40대부터 천천히 내려감)
function faceInfo(a, age = 25) {
  if (!window.Face || !a) return null;
  const g = genesAt(a, Math.max(20, age));
  if (!g) return null;
  const X = extras(a), sex = a.g === 'm' ? 'm' : 'f', eye = g.eye ?? a.eyes ?? 6, sc = Face.faceScore(g, sex, { eye, aegyo: X.aegyo });
  const BT = a.beauty && Face.TYPES[sex][a.beauty];
  if (BT) sc.type = { id: a.beauty, word: BT.word, fit: 1 };   // 설계한 미녀·미남은 그 유형으로
  const grade = Face.gradeOf(sc.raw, sex), E = Face.EYES[eye] || Face.EYES[6], N = Face.NOSES[g.nose] || Face.NOSES[0];
  return { raw: sc.raw, layout: sc.layout, parts: sc.parts, contour: sc.contour, ratio: sc.ratio, eyes: sc.eyes, features: sc.features, harmony: sc.harmony, type: sc.type,
    grade, pos: Face.gradePos(sc.raw, sex), eye: E.id, eyeName: E.name, eyeIx: eye, nose: N.id, noseName: N.name, noseIx: g.nose,
    words: Face.words(g, { sex, eye, mole: X.mole }).map(w => w[0]), sentence: Face.sentence(g, { sex, eye, mole: X.mole, grade, type: age >= 13 ? sc.type : null, noun: age < 13 ? (sex === 'm' ? '남자아이' : '여자아이') : age < 20 ? (sex === 'm' ? '소년' : '소녀') : null }) };
}
// 원하는 등급의 얼굴로 (4-5): 얼굴 시드(gs)를 바꿔 가며 그 등급이 나올 때까지 (A·S는 배치를 이상값 쪽으로 당겨서 찾음)
const GORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
function fitGrade(a, letter, tries = 300) {
  const ti = GORDER.indexOf(letter), bias = ti >= 6 ? .62 : ti >= 5 ? .45 : ti >= 4 ? .22 : 0;
  let best = null, bd = 99;
  for (let i = 0; i < tries; i++) {
    const b = Object.assign({}, a, { gs: i || undefined, gb: bias || undefined });
    const inf = faceInfo(b), d = Math.abs(GORDER.indexOf(inf.grade) - ti);
    if (d < bd) { bd = d; best = b; if (!d) break; }
  }
  if (GENES.size > 4000) GENES.clear();
  a.gs = best.gs; a.gb = best.gb;
  return faceInfo(a);
}
// 성형 (4-6): 코를 작고 오똑·콧대 높은 코로 / 눈 크기 +0.05 / 쌍꺼풀(점수 변화 없음, 인상만). 실패하면 비대칭 +0.2
function surgery(a, ok, r = Math.random()) {
  const fx = Object.assign({}, a.fx);
  if (!ok) { a.fx = Object.assign(fx, { asymAdd: Math.min(.6, (fx.asymAdd || 0) + .2) }); return 'fail'; }
  // 상담: 코(neat·bridge)·눈 키우기 중 점수가 가장 오르는 쪽 / 쌍꺼풀은 점수 변화 없이 인상만 (원하는 사람만)
  const opts = [['nose', { nose: 5 }], ['nose', { nose: 2 }], ['eye', { eyeAdd: Math.min(.15, (fx.eyeAdd || 0) + .05) }]].filter(([, o]) => o.nose == null ? (fx.eyeAdd || 0) < .15 : fx.nose !== o.nose);
  const base = faceInfo(a).raw;
  let best = null;
  for (const [kind, o] of opts) { const raw = faceInfo(Object.assign({}, a, { fx: Object.assign({}, fx, o) })).raw; if (!best || raw > best.raw) best = { kind, o, raw }; }
  const pick = r >= .85 && !fx.lid || !best || best.raw <= base + .05 ? ['lid', { lid: 2 }] : [best.kind, best.o];
  a.fx = Object.assign(fx, pick[1]);
  return pick[0];
}
// 최고 미녀·미남 만들기 (BEAUTY): 유형(청순·고혹·귀염·시크 / 훈남·조각·꽃미남·시크)마다 설계한 얼굴 + 어울리는 머리·립·아이라인
//   seed가 같으면 같은 사람. 피부색은 점수와 상관없어 시드로 고름 (opt.skin으로 지정 가능). 얼굴 점수는 S 기준점보다 한참 위
const BEAUTY_LOOK = {
  f: {
    청순: { hair: [0, 1, 10, 4], front: ['seethrough', 'curtain', 'none_side'], hc: [0, 10, 1], lip: [3, 0], liner: false, aegyo: true, mole: [-1] },
    고혹: { hair: [1, 2, 3], front: ['none_side', 'curtain', 'side_swept'], hc: [12, 4, 1, 17], lip: [2, 1], liner: true, aegyo: false, mole: [0, -1] },
    귀염: { hair: [8, 4, 11], front: ['seethrough', 'full'], hc: [8, 11, 9, 2], lip: [3, 0], liner: false, aegyo: true, mole: [-1], acc: ['ribbon', 'snap', null] },
    시크: { hair: [6, 5, 7, 9], front: ['none_center', 'side_swept', 'comma'], hc: [0, 16, 6, 12], lip: [1, 0], liner: true, aegyo: false, mole: [1, -1] },
  },
  m: {
    훈남: { hair: [0, 1, 2], front: [], hc: [0, 1, 10], mole: [-1] },
    조각: { hair: [5, 4, 7], front: [], hc: [0, 10], mole: [-1] },
    꽃미남: { hair: [1, 3, 9], front: [], hc: [1, 11, 12], mole: [1, -1] },
    시크: { hair: [9, 6, 10], front: [], hc: [0, 16, 6], mole: [-1] },
  },
};
function beauty(type, sex = 'f', seed = 0, opt = {}) {
  sex = sex === 'm' ? 'm' : 'f';
  const types = Object.keys(BEAUTY_LOOK[sex]), T = BEAUTY_LOOK[sex][type] ? type : types[0], Lk = BEAUTY_LOOK[sex][T];
  const r = rng('beautyLook:' + sex + T + seed), pk = l => l[Math.floor(r() * l.length)];
  const a = make('beauty:' + sex + ':' + T + ':' + seed, sex);
  const go = Face.beautyGenes(T, sex, seed);
  a.go = Object.assign({}, go, { arch: null, marks: { freckles: false, scar: null, exag: null, dimples: T === '귀염' || T === '훈남' } });
  a.eyes = go.eye;
  a.skin = opt.skin != null ? opt.skin : [0, 1, 0, 2, 1, 3][Math.floor(r() * 6)];
  a.hair = pk(Lk.hair); a.hv = 2; a.hc = a.hcN = pk(Lk.hc);
  if (DYED.has(a.hc)) a.hcN = pk([0, 10, 1]);
  if (Lk.front.length) a.front = pk(Lk.front);
  a.hacc = Lk.acc ? pk(Lk.acc) : null;
  a.glasses = 0; a.freckles = false; a.dimples = false; a.blush = sex === 'f' && Lk.aegyo;
  a.body = Object.assign({}, a.body, { build: pk(['slim', 'avg', 'slim', 'fit']), height: pk(['avg', 'tall', 'avg']) });
  // 세부(립 색·아이라인·애교살·점·귀걸이)는 xseed로 고름: 유형에 맞는 조합이 나올 때까지
  const want = X => (sex === 'm' || (Lk.lip.includes(X.lip) && X.liner === Lk.liner && X.aegyo === Lk.aegyo && X.ear > 0)) && Lk.mole.includes(X.mole) && X.beard === 0;
  for (let k = 0; k < 4000; k++) { a.xseed = 'b' + seed + ':' + k; if (want(extras(a))) break; }
  a.beauty = T;
  return a;
}
window.Avatar = { make, render, topColor, univLogo, parts: PARTS, anchors: (a, age, fig) => anchorsOf(a, age, fig), faceInfo, fitGrade, surgery, beauty, BEAUTY_TYPES: { f: Object.keys(BEAUTY_LOOK.f), m: Object.keys(BEAUTY_LOOK.m) },
  genes: (a, age) => age != null ? genesAt(a, age) : effGenes(a),
  faceDistance: (a, b) => { const x = effGenes(a), y = effGenes(b); return x && y ? Face.distance(x, y) : 99; },
  traits: a => { const g = effGenes(a); return g ? Face.traits(g, extras(a).mole) : []; } };
window.renderAvatar = render;
})();
