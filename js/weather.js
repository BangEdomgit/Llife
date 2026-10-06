// 배경 렌더러 — 하늘, 해, 구름, 비·눈, 안개, 황사, 무지개, 번개, 도시 실루엣
// 게임 쪽에서는 WeatherBG.init / setTime / setWeather 세 개만 쓰면 됨
(function () {
'use strict';

const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const skyCv = document.createElement('canvas'), sk = skyCv.getContext('2d');
let cv = null, ctx = null;
let W = 0, H = 0, DPR = 1, AREA = 1, T = 0;

/* ---------- 색 유틸 ---------- */
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a).toFixed(3)})`;
const H3 = a => a.map(hex);
// 각 배열 = [아침, 점심, 저녁] / clear 맑음, gray 흐림, storm 폭풍
const pset = (c, g, s) => ({ clear: H3(c), gray: H3(g), storm: H3(s) });

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 팔레트 ---------- */
const SKY_TOP = pset(['#4a8ad6','#2373d8','#232d6e'], ['#7a8694','#748090','#323748'], ['#3a4049','#343b45','#191c25']);
const SKY_MID = pset(['#93c2ec','#5ba5f0','#c25a7e'], ['#a2acb7','#98a3ae','#545563'], ['#515962','#4b535d','#282a35']);
const SKY_BOT = pset(['#ffe1bf','#c6e7ff','#ffac5c'], ['#c9ced3','#bbc2c9','#786d77'], ['#6b727a','#646c75','#3a3943']);
const CL_TOP  = pset(['#ffffff','#ffffff','#ffd2b4'], ['#d6dbe0','#d0d6dc','#8a8090'], ['#6f757d','#676d76','#3a3a46']);
const CL_BOT  = pset(['#efdad0','#dbe5ef','#87557a'], ['#9ca4ad','#97a0aa','#58525f'], ['#41464d','#3c4149','#22222b']);
const BLD     = pset(['#3b4762','#4a5975','#1b1930'], ['#4a5260','#4d5563','#22222d'], ['#2f343c','#2d3239','#15161c']);
const BLD_FAR = pset(['#6d84a6','#7b93b6','#3a3157'], ['#7d8792','#7f8994','#3c3a47'], ['#4a5059','#474d56','#23242d']);
const MNT     = pset(['#8aa3c4','#93b0d4','#5e4a78'], ['#9aa3ad','#98a1ab','#4d4a58'], ['#5b6168','#575e66','#2b2c35']);
const SUN_CORE = H3(['#fff1c9','#fffdf2','#ff8a3d']);
const SUN_GLOW = H3(['#ffd49a','#fff4c4','#ff6236']);
const SUN_POS  = [[.2,.45],[.78,.32],[.83,.6]];
const SUN_SIZE = [[1.1],[1],[1.5]];
const FOG_C    = H3(['#e2e5e8','#e7eaec','#8d8896']);
const DUST_C   = H3(['#d5b479','#d9bb80','#a86f47']);
const SNOW_SKY = H3(['#dde3ea','#e2e7ed','#8b8a9e']);
const SNOW_CAP = H3(['#f2f6fa','#f6f9fc','#b8bdd6']);
const RAINBOW  = ['#ff4a4a','#ff9a3a','#ffe14a','#5ad66a','#46b2ff','#5866ff','#a157ff'].map(hex);
const FOG_BANDS = [{y:.48,s:1,o:.1},{y:.62,s:1.6,o:.5},{y:.76,s:.8,o:.3},{y:.9,s:1.3,o:.8}];

/* ---------- 연출 상태 (현재값 P가 목표값 TG를 부드럽게 따라감) ---------- */
const KEYS = ['cloud','dark','rain','snow','sleet','fog','dust','sun','rays','storm','rainbow','wind','snowCover'];
const P = {}, TG = {};
KEYS.forEach(k => { P[k] = 0; TG[k] = 0; });
let tval = 0, tTarget = 0;

function tm(arr) { const t = clamp(tval, 0, 2); const i = t < 1 ? 0 : 1; return mix(arr[i], arr[i + 1], t - i); }
function pal(s) {
  const d = clamp(P.dark), c = tm(s.clear), g = tm(s.gray), st = tm(s.storm);
  return d <= .5 ? mix(c, g, d / .5) : mix(g, st, (d - .5) / .5);
}
function atmos(c, k = 1) {
  let r = mix(c, tm(SNOW_SKY), P.snow * .3 * k);
  r = mix(r, tm(FOG_C), P.fog * .62 * k);
  return mix(r, tm(DUST_C), P.dust * .5 * k);
}

/* ---------- 구름 ---------- */
let clouds = [];
function makeMask(w, h, R) {
  const m = document.createElement('canvas'); m.width = w; m.height = h;
  const g = m.getContext('2d');
  const n = 8 + (R() * 6 | 0);
  for (let k = 0; k < n; k++) {
    const u = .14 + R() * .72, px = w * u, dome = 1 - Math.abs(u - .5) * 2;
    let pr = h * (.2 + R() * .16 + dome * .14);
    const py = h * .66 - dome * h * .16 + (R() - .5) * h * .06;
    pr = Math.min(pr, px, w - px, py, h - py);
    if (pr < 2) continue;
    const gr = g.createRadialGradient(px, py, 0, px, py, pr);
    gr.addColorStop(0, 'rgba(255,255,255,.95)');
    gr.addColorStop(.55, 'rgba(255,255,255,.6)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
  }
  return m;
}
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildClouds() {
  const R = rng(99), s = clamp(Math.max(W, H) / 1000, .6, 1.6), n = 16;
  const ranks = shuffle([...Array(n).keys()], R);
  clouds = [];
  for (let i = 0; i < n; i++) {
    const w = Math.round((130 + R() * 190) * s), h = Math.round(w * .5);
    const tint = document.createElement('canvas'); tint.width = w; tint.height = h;
    clouds.push({ x: R() * (W + w) - w, y: H * (.02 + R() * .42) - h * .35, w, h,
      mask: makeMask(w, h, R), tint, tctx: tint.getContext('2d'), key: '', rank: ranks[i],
      spd: (6 + R() * 14) * (w / (220 * s)) });
  }
  clouds.sort((a, b) => a.w - b.w);
}
function retint(c, top, bot) {
  const g = c.tctx;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, c.w, c.h);
  g.drawImage(c.mask, 0, 0);
  g.globalCompositeOperation = 'source-in';
  const lg = g.createLinearGradient(0, c.h * .15, 0, c.h * .9);
  lg.addColorStop(0, top); lg.addColorStop(1, bot);
  g.fillStyle = lg; g.fillRect(0, 0, c.w, c.h);
  g.globalCompositeOperation = 'source-over';
}

/* ---------- 별 ---------- */
let stars = [];
function buildStars() { const R = rng(7); stars = Array.from({ length: 70 }, () => ({ x: R(), y: R() * .42, r: R() < .15 ? 1.6 : 1, ph: R() * 6.28 })); }

/* ---------- 산·건물 ---------- */
let ridge = [], farB = [], nearB = [], winW = 4, winH = 6, skyKey = '', CITY = 'kr';
// 도시 모양: kr 서울(뒤로 산 능선 + 고만고만한 빌딩) / ny 뉴욕(산 없이 높은 마천루 + 첨탑·계단식 꼭대기, 앞 건물 옥상의 물탱크)
function setCity(c) { if (c === CITY) return; CITY = c; if (W) buildSkyline(); }
function buildSkyline() {
  const R = rng(1234), ny = CITY === 'ny';
  ridge = [];
  const step = Math.max(14, W / 48), ph = [R() * 6.28, R() * 6.28, R() * 6.28];
  for (let x = -step; x <= W + step; x += step) {
    const u = x / Math.max(W, 600);
    const n = Math.sin(u * 3.2 + ph[0]) * .5 + Math.sin(u * 7.7 + ph[1]) * .3 + Math.sin(u * 16.1 + ph[2]) * .14;
    ridge.push([x, ny ? H + 10 : H * .66 - n * H * .055]);
  }
  const sc = clamp(W / 1000, .75, 1.2);
  farB = []; let x = -10;
  while (x < W + 10) {
    const w = (34 + R() * 60) * sc, tall = ny && R() < .3;
    farB.push({ x, w, h: H * (ny ? (tall ? .36 + R() * .16 : .22 + R() * .14) : .17 + R() * .15), ant: R() < (ny ? .35 : .25), step: ny && R() < .45, spire: tall && R() < .6 });
    x += w + (R() * 14 - 4) * sc;
  }
  nearB = []; x = -6;
  const gx = 9 * sc, gy = 12 * sc; winW = 4 * sc; winH = 6 * sc;
  while (x < W + 6) {
    const w = (30 + R() * 46) * sc; let h = H * (.09 + R() * .13); if (R() < .12) h *= 1.45;
    const b = { x, w, h, wins: [], tank: ny && w > 34 * sc && R() < .45 ? x + w * (.25 + R() * .5) : null };
    const cols = Math.floor((w - 8 * sc) / gx), rows = Math.floor((h - 14 * sc) / gy);
    const ox = x + (w - (cols * gx - (gx - winW))) / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (R() < .82) b.wins.push([ox + c * gx, H - h + 9 * sc + r * gy, R()]);
    nearB.push(b); x += w + (R() < .35 ? R() * 12 * sc : 0);
  }
  skyKey = '';
}
// 색이 바뀔 때만 다시 그려서 캐시해 둠
function renderSkyline(skyMid) {
  const snow = P.snowCover, eve = clamp(tval - 1), morn = clamp(1 - tval);
  const mcol = mix(atmos(pal(MNT), .9), tm(SNOW_CAP), snow * .4);
  const fcol = atmos(pal(BLD_FAR), .75), bcol = atmos(pal(BLD), .55);
  const lit = clamp(eve * .48 + morn * .1 + P.dark * .22 + P.fog * .08);
  const winDay = mix(bcol, skyMid, .5);
  const key = [mcol, fcol, bcol, winDay].map(c => c.map(v => v | 0).join(',')).join('|') + '|' + lit.toFixed(2) + '|' + snow.toFixed(2);
  if (key === skyKey) return;
  skyKey = key;
  sk.setTransform(DPR, 0, 0, DPR, 0, 0);
  sk.clearRect(0, 0, W, H);
  sk.fillStyle = rgba(mcol); sk.beginPath(); sk.moveTo(ridge[0][0], H);
  for (const p of ridge) sk.lineTo(p[0], p[1]);
  sk.lineTo(ridge[ridge.length - 1][0], H); sk.closePath(); sk.fill();
  sk.fillStyle = rgba(fcol); sk.beginPath();
  for (const b of farB) {
    sk.rect(b.x, H - b.h, b.w, b.h);
    if (b.step) { sk.rect(b.x + b.w * .15, H - b.h - b.w * .22, b.w * .7, b.w * .22); sk.rect(b.x + b.w * .3, H - b.h - b.w * .4, b.w * .4, b.w * .18); }   // 계단식 꼭대기
    if (b.spire) { const t = H - b.h - (b.step ? b.w * .4 : 0); sk.moveTo(b.x + b.w * .42, t); sk.lineTo(b.x + b.w * .5, t - b.w * .9); sk.lineTo(b.x + b.w * .58, t); sk.closePath(); }   // 첨탑
    if (b.ant) sk.rect(b.x + b.w * .5 - 1, H - b.h - (b.step ? b.w * .4 : 0) - 14, 2, 14);
  }
  sk.fill();
  const cap = tm(SNOW_CAP);
  if (snow > .01) { sk.fillStyle = rgba(cap, snow * .8); sk.beginPath(); for (const b of farB) sk.rect(b.x - 1, H - b.h - 2, b.w + 2, 3); sk.fill(); }
  sk.fillStyle = rgba(bcol); sk.beginPath();
  for (const b of nearB) {
    sk.rect(b.x, H - b.h, b.w, b.h);
    if (b.tank) { const s2 = clamp(W / 1000, .75, 1.2), tx = b.tank, ty = H - b.h; sk.rect(tx - 1.2 * s2, ty - 6 * s2, 1.4 * s2, 6 * s2); sk.rect(tx + 6.8 * s2, ty - 6 * s2, 1.4 * s2, 6 * s2); sk.rect(tx - 2 * s2, ty - 15 * s2, 11 * s2, 9 * s2); sk.moveTo(tx - 2.6 * s2, ty - 15 * s2); sk.lineTo(tx + 3.5 * s2, ty - 20 * s2); sk.lineTo(tx + 9.6 * s2, ty - 15 * s2); sk.closePath(); }   // 옥상 물탱크
  }
  sk.fill();
  sk.fillStyle = rgba(winDay, .55); sk.beginPath();
  for (const b of nearB) for (const w of b.wins) if (w[2] >= lit) sk.rect(w[0], w[1], winW, winH);
  sk.fill();
  sk.fillStyle = 'rgba(255,212,128,.95)'; sk.beginPath();
  for (const b of nearB) for (const w of b.wins) if (w[2] < lit) sk.rect(w[0], w[1], winW, winH);
  sk.fill();
  if (snow > .01) { sk.fillStyle = rgba(cap, snow * .95); sk.beginPath(); for (const b of nearB) sk.rect(b.x - 1, H - b.h - 3, b.w + 2, 4); sk.fill(); }
}

/* ---------- 입자 ---------- */
const MAXR = 520, MAXS = 300, MAXM = 140;
let drops = [], flakes = [], motes = [];
const cnt = { r: 0, s: 0, m: 0 };
function initParticles() {
  drops = Array.from({ length: MAXR }, () => ({ x: Math.random() * (W + 300) - 150, y: Math.random() * H, l: 10 + Math.random() * 16, v: 650 + Math.random() * 450, z: .55 + Math.random() * .45 }));
  flakes = Array.from({ length: MAXS }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .9 + Math.random() * 2.4, v: 28 + Math.random() * 40, ph: Math.random() * 6.28, sw: .6 + Math.random() * 1.4 }));
  motes = Array.from({ length: MAXM }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .6 + Math.random() * 1.4, v: 20 + Math.random() * 50, ph: Math.random() * 6.28 }));
}

/* ---------- 번개 ---------- */
let flash = 0, bolt = null, boltT = 0, nextBolt = 1.2;
function makeBolt() {
  const main = []; let x = W * (.15 + Math.random() * .7), y = -5;
  const end = H * (.6 + Math.random() * .15);
  main.push([x, y]);
  while (y < end) { y += 12 + Math.random() * 24; x += (Math.random() - .5) * 36; main.push([x, y]); }
  const si = Math.min(main.length - 1, 2 + (Math.random() * Math.max(1, main.length - 4) | 0));
  let [bx, by] = main[si]; const br = [[bx, by]], dir = Math.random() < .5 ? -1 : 1;
  for (let k = 0; k < 5; k++) { by += 10 + Math.random() * 16; bx += dir * (8 + Math.random() * 16); br.push([bx, by]); }
  return [main, br];
}
function strike() {
  const f = reduceMotion ? .35 : 1;
  flash = f; boltT = .24; bolt = makeBolt();
  setTimeout(() => { flash = Math.max(flash, .7 * f); }, 130);
}

/* ---------- 업데이트 ---------- */
function update(dt) {
  const k = 1 - Math.exp(-dt * 1.7), ks = 1 - Math.exp(-dt * .35);
  for (const key of KEYS) P[key] += (TG[key] - P[key]) * (key === 'snowCover' ? ks : k);
  tval += (tTarget - tval) * (1 - Math.exp(-dt * 1.4));

  for (const c of clouds) { c.x += c.spd * (.35 + P.wind) * dt; if (c.x > W + 10) c.x = -c.w - 10; }

  cnt.r = Math.min(MAXR, Math.floor(MAXR * clamp(P.rain) * AREA));
  cnt.s = Math.min(MAXS, Math.floor(MAXS * clamp(P.snow) * AREA));
  cnt.m = Math.min(MAXM, Math.floor(MAXM * clamp(P.dust) * AREA));

  const ang = P.wind * .2, sa = Math.sin(ang), ca = Math.cos(ang);
  for (let i = 0; i < cnt.r; i++) {
    const d = drops[i];
    d.x += sa * d.v * d.z * dt; d.y += ca * d.v * d.z * dt;
    if (d.y - d.l > H) { d.y = -Math.random() * 60; d.x = Math.random() * (W + H * sa + 40) - H * sa - 20; }
  }
  const sp = 1 + P.sleet * 1.8, sway = 18 * (1 - P.sleet * .6);
  for (let i = 0; i < cnt.s; i++) {
    const f = flakes[i];
    f.y += f.v * sp * (.6 + f.r * .3) * dt;
    f.x += (Math.sin(T * f.sw + f.ph) * sway + P.wind * 30) * dt;
    if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
    if (f.x > W + 6) f.x = -6; else if (f.x < -6) f.x = W + 6;
  }
  for (let i = 0; i < cnt.m; i++) {
    const m = motes[i];
    m.x += m.v * (.4 + P.wind) * dt; m.y += Math.sin(T * .8 + m.ph) * 8 * dt;
    if (m.x > W + 4) { m.x = -4; m.y = Math.random() * H; }
  }

  if (P.storm > .6) { nextBolt -= dt; if (nextBolt <= 0) { strike(); nextBolt = 2.2 + Math.random() * 4.5; } }
  flash *= Math.exp(-dt * 6.5);
  boltT = Math.max(0, boltT - dt);
}

/* ---------- 그리기 ---------- */
function draw() {
  const eve = clamp(tval - 1);
  const top = atmos(pal(SKY_TOP)), mid = atmos(pal(SKY_MID)), bot = atmos(pal(SKY_BOT));
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(top)); g.addColorStop(.55, rgba(mid)); g.addColorStop(1, rgba(bot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 별 (저녁)
  const sa = eve * eve * (1 - P.cloud * .85) * (1 - P.fog) * (1 - P.dust) * (1 - P.dark) * .75;
  if (sa > .01) {
    ctx.fillStyle = '#fff';
    for (const s of stars) { ctx.globalAlpha = sa * (.55 + .45 * Math.sin(T * 1.7 + s.ph)); ctx.fillRect(s.x * W, s.y * H, s.r, s.r); }
    ctx.globalAlpha = 1;
  }

  // 해
  const sv = clamp(P.sun);
  if (sv > .01) {
    const pos = tm(SUN_POS), sx = pos[0] * W, sy = pos[1] * H;
    const sr = Math.max(22, Math.min(W, H) * .055) * tm(SUN_SIZE)[0];
    const core = mix(tm(SUN_CORE), [235, 160, 100], P.dust * .6);
    const glow = mix(tm(SUN_GLOW), [215, 150, 90], P.dust * .6);
    const gr = sr * (7 + P.rays * 3);
    g = ctx.createRadialGradient(sx, sy, sr * .4, sx, sy, gr);
    g.addColorStop(0, rgba(glow, .6 * sv)); g.addColorStop(.35, rgba(glow, .18 * sv)); g.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = g; ctx.fillRect(sx - gr, sy - gr, gr * 2, gr * 2);
    if (P.rays > .01) {
      const RL = Math.max(W, H) * .95;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(T * .035);
      g = ctx.createRadialGradient(0, 0, sr, 0, 0, RL);
      g.addColorStop(0, rgba(glow, .11 * P.rays * sv)); g.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI * 2 / 16;
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - .045) * RL, Math.sin(a - .045) * RL); ctx.lineTo(Math.cos(a + .045) * RL, Math.sin(a + .045) * RL); ctx.closePath();
      }
      ctx.fill(); ctx.restore();
      const cx = W / 2, cy = H / 2;
      for (const [t, r, a] of [[.55, sr * .6, .1], [1.15, sr * 1.1, .06], [1.5, sr * .35, .12]]) {
        ctx.fillStyle = rgba(glow, a * P.rays * sv); ctx.beginPath();
        ctx.arc(sx + (cx - sx) * t, sy + (cy - sy) * t, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0, rgba([255, 255, 252], sv)); g.addColorStop(.7, rgba(core, sv)); g.addColorStop(1, rgba(core, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  }

  // 무지개
  if (P.rainbow > .01) {
    const R0 = Math.min(W * .72, H * .52), cx = W * .3, cy = H * .8, bw = R0 * .034;
    ctx.lineWidth = bw + .5;
    RAINBOW.forEach((c, i) => {
      ctx.strokeStyle = rgba(c, .28 * P.rainbow * (1 - eve * .4));
      ctx.beginPath(); ctx.arc(cx, cy, R0 - i * bw, Math.PI, Math.PI * 2); ctx.stroke();
    });
  }

  // 구름층
  const ctop = atmos(pal(CL_TOP), .8), cbot = atmos(pal(CL_BOT), .8);
  const deck = clamp((P.cloud - .55) / .45) * .55 + P.storm * .15;
  if (deck > .01) {
    g = ctx.createLinearGradient(0, 0, 0, H * .6);
    g.addColorStop(0, rgba(cbot, deck)); g.addColorStop(1, rgba(cbot, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .6);
  }
  const ts = rgba(ctop), bs = rgba(cbot), key = ts + bs, n = clouds.length;
  for (const c of clouds) {
    const v = clamp(P.cloud * n * 1.1 - c.rank);
    if (v <= .01) continue;
    if (c.key !== key) { retint(c, ts, bs); c.key = key; }
    ctx.globalAlpha = v * .96 * (1 - P.fog * .45);
    ctx.drawImage(c.tint, c.x, c.y, c.w, c.h);
  }
  ctx.globalAlpha = 1;

  // 번개 줄기
  if (boltT > 0 && bolt) {
    const a = (boltT / .24) * (.7 + .3 * Math.random());
    for (const path of bolt) {
      ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.strokeStyle = `rgba(190,180,255,${(a * .35).toFixed(3)})`; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.lineWidth = 1.8; ctx.stroke();
    }
  }

  // 산·건물
  renderSkyline(mid);
  ctx.drawImage(skyCv, 0, 0, W, H);

  // 안개
  if (P.fog > .01) {
    const fc = tm(FOG_C);
    ctx.fillStyle = rgba(fc, .22 * P.fog); ctx.fillRect(0, 0, W, H);
    const R = W * .75, span = W + R * 2;
    for (const b of FOG_BANDS) {
      for (let k = 0; k < 2; k++) {
        const x = ((b.o * W + T * b.s * 20 + k * span * .5) % span) - R;
        ctx.save(); ctx.translate(x, H * b.y); ctx.scale(1, .22);
        const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        gg.addColorStop(0, rgba(fc, .55 * P.fog)); gg.addColorStop(1, rgba(fc, 0));
        ctx.fillStyle = gg; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.restore();
      }
    }
    g = ctx.createLinearGradient(0, H * .45, 0, H);
    g.addColorStop(0, rgba(fc, 0)); g.addColorStop(1, rgba(fc, .5 * P.fog));
    ctx.fillStyle = g; ctx.fillRect(0, H * .45, W, H * .55);
  }

  // 황사
  if (P.dust > .01) {
    const dc = tm(DUST_C);
    g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(dc, .22 * P.dust)); g.addColorStop(1, rgba(dc, .48 * P.dust));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(248,226,178,.5)'; ctx.beginPath();
    for (let i = 0; i < cnt.m; i++) { const m = motes[i]; ctx.moveTo(m.x + m.r, m.y); ctx.arc(m.x, m.y, m.r, 0, 6.283); }
    ctx.fill();
  }

  // 비
  if (cnt.r > 0) {
    const ang = P.wind * .2, s = Math.sin(ang), c = Math.cos(ang);
    const rc = mix([215, 228, 245], [180, 188, 220], eve);
    for (const [thick, alpha, lw] of [[false, .42, 1], [true, .55, 1.5]]) {
      ctx.strokeStyle = rgba(rc, alpha); ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i < cnt.r; i++) {
        const d = drops[i]; if ((d.z > .85) !== thick) continue;
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - s * d.l, d.y - c * d.l);
      }
      ctx.stroke();
    }
  }

  // 눈
  if (cnt.s > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(.9 - P.sleet * .2).toFixed(3)})`; ctx.beginPath();
    const rs = 1 - P.sleet * .35;
    for (let i = 0; i < cnt.s; i++) { const f = flakes[i], r = f.r * rs; ctx.moveTo(f.x + r, f.y); ctx.arc(f.x, f.y, r, 0, 6.283); }
    ctx.fill();
  }

  // 비네트
  g = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .45, Math.max(W, H) * .85);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${(.18 + P.dark * .12).toFixed(3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 번쩍
  if (flash > .01) { ctx.fillStyle = `rgba(225,230,255,${(flash * .5).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- 루프 ---------- */
let last = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  T += dt * (reduceMotion ? .4 : 1);
  update(dt); draw();
  requestAnimationFrame(frame);
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  skyCv.width = cv.width; skyCv.height = cv.height;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  AREA = clamp(W * H / (1280 * 800), .4, 1.3);
  buildSkyline(); buildClouds(); buildStars(); initParticles();
}

/* ---------- 바깥에서 쓰는 함수 ---------- */
function init(canvas) {
  cv = canvas; ctx = cv.getContext('2d');
  resize();
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
  requestAnimationFrame(t => { last = t; requestAnimationFrame(frame); });
}
// i: 시간대 번호 (0 아침, 1 점심, 2 저녁) / instant: true면 전환 없이 바로
function setTime(i, instant) { tTarget = i; if (instant) tval = i; }
// p: data/weather.js의 p 값
function setWeather(p, instant) {
  for (const key of KEYS) TG[key] = p[key] ?? (key === 'wind' ? .3 : 0);
  if (instant) for (const key of KEYS) P[key] = TG[key];
}

window.WeatherBG = { init, setTime, setWeather, setCity };
})();
