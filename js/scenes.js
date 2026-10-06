// 장소 배경 — 하늘 캔버스(js/weather.js) 위, 화면(패널) 아래에 깔리는 장소 그림 (SVG)
//   실내는 창문 자리를 뚫어 둬서 창밖으로 지금 하늘·날씨·도시가 그대로 보임. 바깥은 위쪽을 비워 하늘이 보임
//   시간대는 그림 층의 CSS 필터(밝기·색온도)로, 저녁·밤엔 조명 층(전등·스탠드·간판·화면 빛)이 켜짐. 바깥 나무는 계절 색
//   SceneBG.init(el) / SceneBG.set({ id, tod: morning|day|evening|night, season: spring|summer|fall|winter, wet }) — 같은 그림이면 조명만 바꿈
//   좌표: 1600×1000, 바닥선 760. 화면 비율이 달라도 아래쪽 가운데 기준으로 꽉 차게 (xMidYMax slice)
(function () {
'use strict';
const W = 1600, FL = 760;
let uid = 0;
const nid = k => `sc${uid}${k}`;
const f1 = v => Math.round(v * 10) / 10;
const at = ex => ex ? ' ' + ex : '';
const R = (x, y, w, h, fill, rx, ex) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"${at(ex)}/>`;
const E = (cx, cy, rx, ry, fill, ex) => `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}"${at(ex)}/>`;
const C = (cx, cy, r, fill, ex) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${fill}"${at(ex)}/>`;
const P = (d, fill, ex) => `<path d="${d}" fill="${fill}"${at(ex)}/>`;
const L = (d, stroke, w, ex) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${at(ex)}/>`;
const T = (x, y, s, fill, txt, ex) => `<text x="${x}" y="${y}" font-size="${s}" fill="${fill}" font-family="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif" font-weight="700" text-anchor="middle"${at(ex)}>${txt}</text>`;
const shadow = (cx, cy, rx, ry) => E(cx, cy, rx, ry || rx * .1, '#000', 'opacity=".18"');
const rectHole = (x, y, w, h) => `M${x},${y}h${w}v${h}h${-w}Z`;
const archHole = (x, y, w, h) => `M${x},${y + w / 2}A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2}V${y + h}H${x}Z`;
const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rad = (id, c, a = 1) => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="${a}"/><stop offset=".45" stop-color="${c}" stop-opacity="${a * .35}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
// 빛 (조명 층): 둥근 번짐
function glow(cx, cy, r, c, a = .9) { const id = nid('g' + Math.round(cx) + Math.round(cy)); return `<defs>${rad(id, c, a)}</defs>${E(cx, cy, r, r * .9, `url(#${id})`)}`; }
// 바닥에 떨어지는 빛 원뿔 (천장 등)
const cone = (x, y, w, h, c, a = .18) => P(`M${x - 8},${y}L${x + 8},${y}L${x + w / 2},${y + h}L${x - w / 2},${y + h}Z`, c, `opacity="${a}"`);

/* ---------- 실내 공통: 창문이 뚫린 벽 + 바닥 + 걸레받이 ---------- */
// holes: [{ x, y, w, h, arch }]
function room(o) {
  const wid = nid('w'), fid = nid('f'), holes = (o.holes || []).map(h => h.arch ? archHole(h.x, h.y, h.w, h.h) : rectHole(h.x, h.y, h.w, h.h)).join('');
  return `<defs>${lin(wid, [[0, o.wallTop || o.wall], [1, o.wall]])}${lin(fid, [[0, o.floorTop || o.floor], [1, o.floor]])}</defs>` +
    P(`M0,0H${W}V${FL}H0Z${holes}`, `url(#${wid})`, 'fill-rule="evenodd"') +
    R(0, FL, W, 1000 - FL, `url(#${fid})`) + (o.planks ? planks(o.planks) : '') +
    R(0, FL - 16, W, 16, o.base || '#00000030') + R(0, FL, W, 4, '#000', 0, 'opacity=".12"');
}
const planks = c => Array.from({ length: 9 }, (_, i) => L(`M0,${FL + 26 + i * 26 + i * i * 1.6}H${W}`, c, 2, 'opacity=".35"')).join('');
// 창틀 (구멍 위에): 칸 나눔·창턱·유리 반사·커튼·블라인드
function winFrame(h, o = {}) {
  const { x, y, w } = h, hh = h.h, fc = o.frame || '#f3eee6', t = o.t || 12, cols = o.cols ?? 2, rows = o.rows ?? 1;
  const outer = h.arch ? archHole(x - t, y - t, w + 2 * t, hh + 2 * t) : rectHole(x - t, y - t, w + 2 * t, hh + 2 * t), inner = h.arch ? archHole(x, y, w, hh) : rectHole(x, y, w, hh);
  let s = P(outer + inner, fc, 'fill-rule="evenodd"');
  for (let i = 1; i < cols; i++) s += R(x + w * i / cols - t / 3, y, t * .66, hh, fc);
  for (let j = 1; j < rows; j++) s += R(x, y + hh * j / rows - t / 3, w, t * .66, fc);
  s += P(`M${x + w * .12},${y + hh}L${x + w * .42},${y + (h.arch ? w * .3 : 0)}L${x + w * .52},${y + (h.arch ? w * .3 : 0)}L${x + w * .22},${y + hh}Z`, '#fff', 'opacity=".07"');   // 유리 반사
  if (o.sill !== false) s += R(x - t - 10, y + hh + t - 2, w + 2 * t + 20, 12, o.sillC || fc, 3) + R(x - t - 10, y + hh + t + 9, w + 2 * t + 20, 4, '#000', 0, 'opacity=".12"');
  if (o.blind) for (let k = 0; k < o.blind; k++) s += R(x, y + k * 16, w, 9, o.blindC || '#e9e4da', 0, 'opacity=".92"');
  if (o.curtain) {   // 양옆 커튼 (주름 3줄)
    const cc = o.curtain, cw = Math.max(48, w * .2), top = y - t - 26, bot = y + hh + t + 30;
    s += R(x - t - 40, top - 8, w + 2 * t + 80, 9, '#5b4636', 4);
    for (const sx of [x - t - 34, x + w + t + 34 - cw]) {
      s += P(`M${sx},${top}H${sx + cw}Q${sx + cw * .92},${(top + bot) / 2} ${sx + cw + (sx < x ? 6 : -6)},${bot}H${sx + (sx < x ? -6 : 6)}Q${sx + cw * .08},${(top + bot) / 2} ${sx},${top}Z`, cc);
      for (let k = 1; k < 4; k++) s += L(`M${sx + cw * k / 4},${top + 4}V${bot - 4}`, '#000', 3, 'opacity=".1"');
    }
  }
  return s;
}

/* ---------- 소품 ---------- */
function plant(x, y, s = 1, pot = '#c9714d', leaf = '#4f8d5a') {
  let o = shadow(x, y + 2, 34 * s);
  for (let k = 0; k < 7; k++) { const a = -1.25 + k * .42, l = (60 + (k % 3) * 18) * s; o += P(`M${x},${y - 46 * s}Q${x + Math.sin(a) * l * .5 - 10 * s},${y - 46 * s - l * .7} ${x + Math.sin(a) * l},${y - 46 * s - Math.cos(a) * l}Q${x + Math.sin(a) * l * .45 + 10 * s},${y - 46 * s - l * .45} ${x},${y - 46 * s}Z`, k % 2 ? leaf : shade(leaf, 1.18)); }
  return o + P(`M${x - 30 * s},${y - 52 * s}H${x + 30 * s}L${x + 22 * s},${y}H${x - 22 * s}Z`, pot) + R(x - 33 * s, y - 58 * s, 66 * s, 10 * s, shade(pot, .85), 3);
}
function floorLamp(x, y, c = '#f6e3b8') { return shadow(x, y + 2, 40) + R(x - 3, y - 300, 6, 300, '#3d3530') + E(x, y, 34, 7, '#3d3530') + P(`M${x - 46},${y - 300}L${x - 32},${y - 370}H${x + 32}L${x + 46},${y - 300}Z`, c); }
function books(x, y, w, h, n = 12, seed = 1) {
  const cols = ['#c0554b', '#3f6fa6', '#e3b04b', '#5b8f62', '#8a5aa8', '#d9d2c4', '#2f3b55', '#cf7d4a'];
  let o = '', cx = x;
  for (let k = 0; k < n && cx < x + w - 8; k++) { const bw = 12 + ((k * 7 + seed * 3) % 9), bh = h * (.7 + ((k * 13 + seed) % 4) * .08); o += R(cx, y + h - bh, bw, bh, cols[(k + seed) % cols.length], 1.5); cx += bw + 2; }
  return o;
}
function shelf(x, y, w, h, rows, c = '#8a6446', seed = 1) {
  let o = R(x, y, w, h, c, 4) + R(x + 10, y + 10, w - 20, h - 20, shade(c, .7));
  for (let r = 0; r < rows; r++) { const ry = y + 10 + (h - 20) * r / rows, rh = (h - 20) / rows; o += books(x + 16, ry + 6, w - 32, rh - 14, 30, seed + r) + R(x + 10, ry + rh - 8, w - 20, 8, c); }
  return o;
}
function frameArt(x, y, w, h, c1 = '#7fb0d6', c2 = '#e9c46a') { return R(x, y, w, h, '#4a3a2e', 3) + R(x + 8, y + 8, w - 16, h - 16, c1) + P(`M${x + 8},${y + h - 8}L${x + w * .35},${y + h * .45}L${x + w * .55},${y + h * .7}L${x + w * .75},${y + h * .5}L${x + w - 8},${y + h - 8}Z`, c2, 'opacity=".9"'); }
function wallClock(x, y, r = 34) { return C(x, y, r + 5, '#3b3632') + C(x, y, r, '#fbf8f2') + L(`M${x},${y}V${y - r * .62}M${x},${y}L${x + r * .45},${y + r * .12}`, '#2b2622', 4) + C(x, y, 4, '#c0554b'); }
function chair(x, y, c = '#6b4d3a', s = 1) {   // 앞에서 본 의자: 등받이·앉는 판·다리 넷
  const d = shade(c, .75);
  return shadow(x, y + 2, 34 * s) + R(x - 26 * s, y - 50 * s, 6 * s, 50 * s, d) + R(x + 20 * s, y - 50 * s, 6 * s, 50 * s, d) + R(x - 18 * s, y - 46 * s, 5 * s, 40 * s, d, 0, 'opacity=".6"') + R(x + 13 * s, y - 46 * s, 5 * s, 40 * s, d, 0, 'opacity=".6"') +
    R(x - 24 * s, y - 118 * s, 48 * s, 56 * s, c, 10 * s) + R(x - 18 * s, y - 110 * s, 36 * s, 6 * s, '#fff', 3, 'opacity=".12"') + R(x - 30 * s, y - 62 * s, 60 * s, 14 * s, shade(c, 1.1), 5 * s);
}
function table(x, y, w, h, c = '#a77b56') { return shadow(x + w / 2, y + 4, w * .55) + R(x, y - h, w, 14, c, 4) + R(x + 12, y - h + 14, 10, h - 14, shade(c, .75)) + R(x + w - 22, y - h + 14, 10, h - 14, shade(c, .75)); }
function pendant(x, y, len, c = '#2f2a28', shadeC = '#e9c46a') { return L(`M${x},0V${y + len}`, '#2a2522', 2) + P(`M${x - 30},${y + len + 30}Q${x},${y + len - 6} ${x + 30},${y + len + 30}Z`, c) + E(x, y + len + 30, 30, 5, shadeC); }
function screenGlow(x, y, w, h, c) { return glow(x + w / 2, y + h / 2, Math.max(w, h) * .9, c, .55); }
function tile(x, y, w, h, c, step = 60) { let o = ''; for (let i = 0; i <= w; i += step) o += L(`M${x + i},${y}V${y + h}`, c, 2, 'opacity=".4"'); for (let j = 0; j <= h; j += step) o += L(`M${x},${y + j}H${x + w}`, c, 2, 'opacity=".4"'); return o; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1, 7), 16), f = c => Math.max(0, Math.min(255, Math.round(k < 1 ? c * k : c + (255 - c) * (k - 1)))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join(''); };

/* ---------- 바깥 공통: 나무(계절)·잔디·가로등·벤치 ---------- */
const LEAF = { spring: ['#f4b8c8', '#f7cdd8', '#e89ab0'], summer: ['#4f9152', '#62a35e', '#3f7d47'], fall: ['#e0913f', '#d2683a', '#e9b94e'], winter: ['#dfe6ee', '#c9d3de', '#eef2f6'] };
function tree(x, y, s = 1, season = 'summer') {
  const lf = LEAF[season] || LEAF.summer, tr = '#6b4a35';
  let o = shadow(x, y + 3, 70 * s, 12 * s) + P(`M${x - 12 * s},${y}Q${x - 8 * s},${y - 90 * s} ${x - 4 * s},${y - 150 * s}H${x + 6 * s}Q${x + 10 * s},${y - 90 * s} ${x + 14 * s},${y}Z`, tr);
  if (season === 'winter') {   // 앙상한 가지 + 눈
    o += L(`M${x},${y - 120 * s}L${x - 50 * s},${y - 200 * s}M${x},${y - 140 * s}L${x + 46 * s},${y - 215 * s}M${x - 24 * s},${y - 160 * s}L${x - 30 * s},${y - 230 * s}M${x + 20 * s},${y - 175 * s}L${x + 70 * s},${y - 190 * s}`, tr, 7 * s);
    return o + E(x - 50 * s, y - 202 * s, 16 * s, 6 * s, '#f4f7fa') + E(x + 46 * s, y - 217 * s, 14 * s, 5 * s, '#f4f7fa');
  }
  const blobs = [[0, -210, 78], [-56, -170, 60], [58, -168, 62], [-20, -140, 58], [30, -250, 50], [-40, -240, 46]];
  blobs.forEach(([dx, dy, r], i) => { o += C(x + dx * s, y + dy * s, r * s, lf[i % 3]); });
  return o + C(x - 24 * s, y - 236 * s, 22 * s, '#fff', 'opacity=".12"');
}
function lampPost(x, y, h = 300) { return R(x - 5, y - h, 10, h, '#2d3138') + R(x - 14, y - 8, 28, 10, '#2d3138', 3) + P(`M${x - 22},${y - h}H${x + 22}L${x + 14},${y - h - 34}H${x - 14}Z`, '#3a3f47') + R(x - 14, y - h - 4, 28, 8, '#fff3c4'); }
function bench(x, y, c = '#8a5a3c') { return shadow(x, y + 4, 90) + R(x - 90, y - 70, 180, 12, c, 3) + R(x - 90, y - 50, 180, 12, c, 3) + R(x - 94, y - 34, 188, 12, shade(c, 1.1), 3) + R(x - 80, y - 22, 8, 22, '#2d3138') + R(x + 72, y - 22, 8, 22, '#2d3138'); }
function grass(y, c1, c2) { const id = nid('gr'); return `<defs>${lin(id, [[0, c1], [1, c2]])}</defs>` + P(`M0,${y}Q${W * .25},${y - 24} ${W * .5},${y - 6}T${W},${y - 10}V1000H0Z`, `url(#${id})`); }
function bush(x, y, s = 1, c = '#4a8a50') { return C(x - 30 * s, y - 22 * s, 30 * s, c) + C(x + 4 * s, y - 34 * s, 38 * s, shade(c, 1.12)) + C(x + 38 * s, y - 20 * s, 28 * s, c); }
function building(x, y, w, h, c, o = {}) {   // 바깥 건물: 창 격자 (밤엔 불 켜진 창을 조명 층에)
  let s = R(x, y - h, w, h, c) + R(x, y - h, w, 10, shade(c, .8)), lit = '';
  const cw = o.cw || 34, ch = o.ch || 40, gx = o.gx || 22, gy = o.gy || 26;
  for (let j = y - h + 30; j < y - (o.bottom || 90); j += ch + gy) for (let i = x + 20; i < x + w - cw - 10; i += cw + gx) {
    s += R(i, j, cw, ch, o.win || '#a9c4dc', 2);
    if (((i * 7 + j * 3) >> 4) % 3 === 0) lit += R(i, j, cw, ch, '#ffd98a', 2, 'opacity=".85"');
  }
  return { s, lit };
}

/* ---------- 장면들 ---------- */
// 각 장면: (opt) => { art, glow, out(바깥이면 true) }
const SC = {};

// 집 — 거실: 커튼 달린 큰 창, 소파, 스탠드, 책장, 액자, 러그, 화분
SC.home = o => {
  const win = { x: 250, y: 230, w: 400, h: 330 };
  let a = room({ wall: '#efe2cf', wallTop: '#e6d6bf', floor: '#9c7150', floorTop: '#b5895f', base: '#d9c6ab', holes: [win], planks: '#6e4b33' });
  a += winFrame(win, { cols: 2, curtain: '#c9a27e' });
  a += shelf(1240, 250, 230, 510, 4, '#8a6446', 2) + frameArt(760, 300, 150, 110) + frameArt(930, 330, 90, 80, '#e7b3a1', '#7fb0d6') + wallClock(1110, 270);
  a += E(870, 905, 430, 52, '#c86f5e', 'opacity=".85"') + E(870, 905, 360, 40, '#e09b84', 'opacity=".5"');   // 러그
  a += shadow(880, 800, 300) + R(600, 610, 560, 120, '#5f7fa3', 34) + R(580, 560, 600, 110, '#6d8db3', 40) + R(560, 650, 70, 120, '#567599', 26) + R(1130, 650, 70, 120, '#567599', 26) + R(630, 740, 500, 34, '#4c6a8d', 12) + R(690, 600, 120, 70, '#e7c86e', 18) + R(950, 600, 120, 70, '#ef9d87', 18);   // 소파·쿠션
  a += table(780, 880, 220, 70, '#a77b56') + R(830, 796, 60, 14, '#fff', 3, 'opacity=".85"');
  a += floorLamp(1530, 760) + plant(170, 760, 1.2) + plant(1180, 905, .7, '#6b8fb3');
  const gl = glow(1530, 410, 210, '#ffd58a') + glow(1530, 560, 360, '#ffcf7a', .35) + glow(880, 620, 520, '#ffcf8a', .18);
  return { art: a, glow: gl };
};

// 교실 (중·고등학교): 왼쪽 창 세 칸, 칠판, 시계, 교탁, 책상 줄, 사물함
SC.classroom = o => {
  const ws = [{ x: 40, y: 190, w: 200, h: 330 }, { x: 290, y: 190, w: 200, h: 330 }];
  let a = room({ wall: '#e9eadb', wallTop: '#dfe2cf', floor: '#b28a5e', floorTop: '#c69c6c', base: '#c7c9b4', holes: ws, planks: '#8b6542' });
  ws.forEach(w => { a += winFrame(w, { cols: 2, frame: '#f2f2ea' }); });
  a += R(560, 220, 640, 300, '#3f6150', 10) + R(560, 220, 640, 300, 'none', 10, 'stroke="#8a6446" stroke-width="16"') + R(560, 512, 640, 14, '#8a6446');   // 칠판
  a += T(880, 350, 46, '#f4f1e6', '자 습', 'opacity=".85"') + L('M640,420Q720,400 800,420M960,410H1110', '#f4f1e6', 4, 'opacity=".6"') + R(1130, 500, 40, 10, '#f4f1e6', 2);
  a += wallClock(880, 160, 30) + R(1270, 250, 220, 110, '#f6efe0', 4) + T(1380, 318, 34, '#c0554b', '급훈', '') + R(1300, 330, 160, 6, '#7d6a58', 2, 'opacity=".5"');
  a += shadow(880, 742, 150) + R(790, 640, 180, 100, '#8a6446', 6) + R(780, 630, 200, 18, '#9c7454', 4);   // 교탁
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const x = 120 + i * 250 + r * 60, y = 860 + r * 110; a += shadow(x + 70, y + 4, 90) + R(x, y - 70, 140, 16, '#c9a77c', 3) + R(x + 10, y - 54, 10, 54, '#5c6670') + R(x + 120, y - 54, 10, 54, '#5c6670'); }
  for (let i = 0; i < 4; i++) a += R(1280 + i * 75, 440, 70, 300, i % 2 ? '#7f97ad' : '#8aa3b9', 3) + R(1300 + i * 75, 470, 30, 8, '#5d6f80', 2);   // 사물함
  const gl = [380, 880, 1380].map(x => R(x - 120, 40, 240, 14, '#fffbe8', 4) + cone(x, 54, 520, 700, '#fff6d8', .035)).join('');
  return { art: a, glow: gl };
};

// 학원: 화이트보드, 형광등, 작은 책상, 포스터
SC.academy = o => {
  const win = { x: 1290, y: 210, w: 230, h: 300 };
  let a = room({ wall: '#eef1f4', wallTop: '#e2e7ec', floor: '#9aa3ad', floorTop: '#aeb6bf', base: '#cfd5db', holes: [win] });
  a += winFrame(win, { cols: 2, blind: 9, blindC: '#e5e8ea', frame: '#e6eaee' });
  a += R(330, 210, 800, 330, '#fdfdfb', 8, 'stroke="#aab2bb" stroke-width="12"') + R(330, 532, 800, 14, '#aab2bb');
  a += L('M400,290Q480,260 560,300T720,290M400,360H700M400,420H620', '#2f5fa8', 6, 'opacity=".75"') + L('M800,300L900,420M900,300L800,420', '#c0554b', 7, 'opacity=".7"') + C(1000, 360, 60, 'none', 'stroke="#2f8a4a" stroke-width="6" opacity=".7"');
  a += R(90, 230, 170, 230, '#ffd166', 4) + T(175, 330, 40, '#7a3d00', '합격', '') + T(175, 390, 26, '#7a3d00', '100%', '');
  for (let i = 0; i < 5; i++) { const x = 120 + i * 300; a += shadow(x + 90, 904, 100) + R(x, 830, 180, 16, '#d8dde2', 3) + R(x + 12, 846, 10, 60, '#6c7680') + R(x + 158, 846, 10, 60, '#6c7680') + chair(x + 90, 960, '#3f5a7a', .7); }
  const gl = [300, 800, 1300].map(x => R(x - 140, 40, 280, 16, '#f4fbff', 4) + cone(x, 56, 560, 720, '#eef8ff', .03)).join('');
  return { art: a, glow: gl };
};

// 대학 강의실: 스크린(슬라이드), 계단식 좌석, 나무 벽, 높은 창
SC.lecture = o => {
  const ws = [{ x: 1300, y: 140, w: 120, h: 420 }, { x: 1450, y: 140, w: 120, h: 420 }];
  let a = room({ wall: '#d9c9b2', wallTop: '#c9b69c', floor: '#7e6248', floorTop: '#8f6f52', base: '#6e5440', holes: ws });
  ws.forEach(w => { a += winFrame(w, { cols: 1, rows: 3, frame: '#efe7da' }); });
  for (let i = 0; i < 12; i++) a += R(i * 110, 0, 6, FL, '#000', 0, 'opacity=".05"');   // 나무 벽 결
  a += R(420, 150, 760, 400, '#f7f8fa', 4) + R(410, 140, 780, 14, '#3a3a3a', 3) + R(470, 200, 300, 26, '#2f5fa8', 3) + R(470, 250, 520, 12, '#9aa6b2', 3) + R(470, 280, 460, 12, '#9aa6b2', 3) + R(470, 310, 500, 12, '#9aa6b2', 3);
  a += R(850, 380, 280, 140, '#e8eef5', 4) + P('M870,500L930,440L980,470L1040,410L1110,500Z', '#5fa0d6', 'opacity=".8"');   // 슬라이드
  a += R(110, 560, 220, 200, '#6e5440', 6) + R(100, 550, 240, 18, '#7e6248', 4);   // 교탁
  for (let r = 0; r < 3; r++) { const y = 800 + r * 80, inset = 40 - r * 20; a += R(inset, y - 60, W - inset * 2, 22, '#8f6f52', 6) + R(inset, y - 38, W - inset * 2, 40, '#a7835f', 6); for (let i = 0; i < 14; i++) a += R(inset + 40 + i * 112, y - 100, 70, 44, '#3f4f6b', 10); }
  const gl = glow(800, 360, 520, '#e8f2ff', .28) + [300, 800, 1300].map(x => cone(x, 0, 500, 760, '#fff6e0', .06)).join('');
  return { art: a, glow: gl };
};

// 대학 캠퍼스 (바깥): 시계탑 본관, 옆 건물, 잔디, 길, 나무, 가로등, 현수막
SC.campus = o => {
  const s = o.season;
  let a = '', lit = '';
  for (const [x, w, h, c] of [[-40, 380, 300, '#b88a6a'], [1260, 380, 330, '#b07f62']]) { const b = building(x, 690, w, h, c, { win: '#cfe0ee' }); a += b.s; lit += b.lit; }
  a += R(500, 330, 600, 360, '#d9c3a5') + R(500, 330, 600, 18, '#b8a083') + P('M480,330L800,200L1120,330Z', '#a9563f') + R(760, 120, 80, 220, '#e3d0b4') + P('M748,120L800,60L852,120Z', '#a9563f') + wallClock(800, 175, 26);   // 본관 + 시계탑
  for (let i = 0; i < 6; i++) a += R(540 + i * 98, 400, 24, 290, '#efe4d2');   // 기둥
  a += R(720, 560, 160, 130, '#6b4a35', 4) + R(735, 575, 130, 115, '#4a3426', 4);
  a += R(520, 360, 140, 30, '#2f5fa8', 3) + T(590, 383, 20, '#fff', '입학을 환영합니다', '');
  a += grass(700, '#79b46a', '#5b9455') + P(`M720,1000L770,700H830L880,1000Z`, '#d8cbb6') + P('M0,1000L0,960Q400,900 720,980V1000Z', '#6aa45f', 'opacity=".6"');
  a += tree(150, 760, 1.1, s) + tree(400, 740, .8, s) + tree(1200, 740, .85, s) + tree(1460, 770, 1.15, s) + lampPost(640, 860) + lampPost(960, 860) + bench(300, 900) + bench(1300, 900);
  const gl = lit + glow(640, 535, 120, '#ffe7a8') + glow(960, 535, 120, '#ffe7a8') + R(500, 410, 600, 280, '#ffd98a', 0, 'opacity=".08"');
  return { art: a, glow: gl, out: true };
};

// 직장: 큰 창(도시), 책상·모니터·칸막이, 화분, 천장 등
SC.office = o => {
  const ws = [0, 1, 2].map(i => ({ x: 120 + i * 470, y: 120, w: 420, h: 430 }));
  let a = room({ wall: '#dfe4ea', wallTop: '#cfd6de', floor: '#6f7a86', floorTop: '#7f8a96', base: '#b9c1ca', holes: ws });
  ws.forEach(w => { a += winFrame(w, { cols: 3, frame: '#c3cad2', sill: false }); });
  let gl = '';
  for (let i = 0; i < 4; i++) { const x = 60 + i * 400; a += shadow(x + 160, 892, 190) + R(x, 760, 330, 18, '#e9ecef', 3) + R(x + 10, 778, 12, 110, '#7a838c') + R(x + 308, 778, 12, 110, '#7a838c') + R(x - 10, 640, 12, 260, '#9aa6b2') + R(x + 90, 650, 150, 100, '#1f2630', 6) + R(x + 98, 658, 134, 80, '#4f86c6', 3) + R(x + 155, 750, 20, 14, '#1f2630') + R(x + 40, 740, 40, 20, '#f4f1ea', 2); gl += screenGlow(x + 98, 658, 134, 80, '#7fb6ff'); }
  a += plant(1520, 900, 1.1) + R(0, 590, W, 50, '#a8b2bc', 0, 'opacity=".55"');
  gl += [300, 800, 1300].map(x => R(x - 150, 40, 300, 14, '#f4fbff', 4) + cone(x, 54, 600, 700, '#eef8ff', .03)).join('');
  return { art: a, glow: gl };
};

// 카페: 벽돌·나무, 메뉴판, 카운터·커피 머신, 펜던트 등, 창(글자), 작은 탁자
SC.cafe = o => {
  const win = { x: 980, y: 210, w: 480, h: 380 };
  let a = room({ wall: '#e7d6c1', wallTop: '#dcc7ae', floor: '#6b4a35', floorTop: '#7d5840', base: '#5b3e2c', holes: [win], planks: '#4f3426' });
  for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) a += R(40 + i * 96 + (j % 2) * 48, 120 + j * 44, 88, 36, j % 3 ? '#c9805f' : '#bd7354', 3, 'opacity=".5"');   // 벽돌
  a += winFrame(win, { cols: 3, frame: '#3d2c22', t: 14, sillC: '#5b3e2c' }) + T(1220, 300, 34, '#f4ead8', 'CAFÉ  LLIFE', 'opacity=".55"');
  a += R(120, 170, 330, 230, '#2e3a33', 8, 'stroke="#7d5840" stroke-width="12"') + T(285, 225, 28, '#f4ead8', 'MENU', '') + L('M160,260H300M160,300H330M160,340H280', '#f4ead8', 4, 'opacity=".7"') + T(390, 272, 20, '#f4ead8', '4.5', '') + T(390, 312, 20, '#f4ead8', '5.0', '');
  a += shadow(430, 765, 380) + R(60, 560, 760, 200, '#7d5840', 6) + R(50, 548, 780, 22, '#a07455', 5) + R(120, 470, 130, 80, '#c9ced4', 8) + R(140, 490, 90, 30, '#30343a', 4) + R(300, 500, 50, 50, '#f4ead8', 4) + R(380, 510, 60, 40, '#e3b04b', 4);
  for (const x of [1020, 1300]) a += table(x, 900, 150, 120, '#3d2c22') + chair(x - 30, 910, '#7d5840', .8) + chair(x + 180, 910, '#7d5840', .8) + R(x + 60, 768, 30, 14, '#f4ead8', 3);
  a += plant(900, 760, 1, '#e7d6c1') + plant(1560, 930, .9);
  let gl = '';
  for (const x of [200, 440, 680, 1100, 1340]) { a += pendant(x, 0, 150); gl += glow(x, 190, 140, '#ffcf7a') + cone(x, 185, 260, 560, '#ffd99a', .1); }
  return { art: a, glow: gl };
};

// 도서관: 양쪽 높은 책장, 아치 창, 녹색 스탠드 책상
SC.library = o => {
  const win = { x: 650, y: 120, w: 300, h: 460, arch: true };
  let a = room({ wall: '#d8cbb6', wallTop: '#cbbba2', floor: '#7a5a42', floorTop: '#8c6a4f', base: '#5e4433', holes: [win], planks: '#5e4433' });
  a += winFrame(win, { cols: 2, rows: 3, frame: '#efe6d6' });
  a += shelf(30, 100, 280, 660, 6, '#6e4f39', 1) + shelf(330, 180, 260, 580, 5, '#6e4f39', 4) + shelf(1010, 180, 260, 580, 5, '#6e4f39', 7) + shelf(1290, 100, 280, 660, 6, '#6e4f39', 3);
  let gl = '';
  for (const x of [300, 980]) { a += shadow(x + 160, 905, 210) + R(x, 830, 330, 20, '#8a6446', 4) + R(x + 16, 850, 14, 60, '#5e4433') + R(x + 300, 850, 14, 60, '#5e4433'); for (const lx of [x + 80, x + 250]) { a += R(lx - 3, 790, 6, 40, '#c9a94b') + P(`M${lx - 30},${795}Q${lx},${770} ${lx + 30},${795}Z`, '#2f6b4a'); gl += glow(lx, 815, 110, '#fff0b0'); } a += R(x + 130, 818, 70, 12, '#f4efe2', 2); }
  gl += glow(800, 400, 380, '#fff4d6', .15);
  return { art: a, glow: gl };
};

// 헬스장: 거울 벽, 덤벨 랙, 러닝머신, 고무 바닥, 현수막
SC.gym = o => {
  const win = { x: 60, y: 160, w: 360, h: 300 };
  let a = room({ wall: '#3b4048', wallTop: '#30353c', floor: '#2b2e33', floorTop: '#34383e', base: '#1f2226', holes: [win] });
  a += winFrame(win, { cols: 3, frame: '#596069', sill: false });
  a += R(520, 160, 1040, 520, '#9fb3c4', 4, 'opacity=".55"') + P('M560,680L760,160H820L620,680Z', '#fff', 'opacity=".1"') + P('M900,680L1100,160H1130L930,680Z', '#fff', 'opacity=".08"') + R(510, 150, 1060, 540, 'none', 6, 'stroke="#596069" stroke-width="14"');   // 거울
  a += R(560, 80, 520, 54, '#e5534b', 6) + T(820, 120, 34, '#fff', 'NO PAIN NO GAIN', '');
  a += shadow(400, 910, 260) + R(180, 760, 440, 14, '#596069', 4) + R(190, 774, 12, 130, '#596069') + R(598, 774, 12, 130, '#596069');
  for (let i = 0; i < 6; i++) { const x = 215 + i * 66; a += R(x, 735, 18, 26, '#1d2024', 4) + R(x + 40, 735, 18, 26, '#1d2024', 4) + R(x + 14, 742, 30, 10, '#9aa3ad', 3); }
  a += shadow(1180, 920, 280) + P('M920,900L1400,900L1440,860L960,860Z', '#22262b') + R(950, 900, 470, 22, '#16191c', 6) + R(1370, 620, 20, 260, '#596069') + R(1300, 600, 140, 40, '#1d2024', 8) + R(1315, 610, 70, 20, '#5fd0a0', 3);
  const gl = [300, 800, 1300].map(x => R(x - 160, 30, 320, 14, '#f4fbff', 4) + cone(x, 44, 600, 800, '#eef8ff', .03)).join('') + screenGlow(1315, 610, 70, 20, '#5fd0a0');
  return { art: a, glow: gl };
};

// PC방: 어두운 방, 모니터 줄(빛), 네온, 게이밍 의자
SC.pcbang = o => {
  let a = room({ wall: '#20222c', wallTop: '#191a22', floor: '#17181e', floorTop: '#1f2028', base: '#111217', holes: [] });
  a += R(0, 330, W, 8, '#7a5cff', 0, 'opacity=".8"') + R(0, 345, W, 4, '#25d0ff', 0, 'opacity=".6"');
  a += R(620, 120, 360, 130, '#14151b', 12, 'stroke="#ff4fa3" stroke-width="6"') + T(800, 210, 76, '#ff7ac0', 'PC 방', '');
  let gl = glow(800, 185, 260, '#ff4fa3', .45) + R(0, 326, W, 16, '#9a7cff', 0, 'opacity=".45"');
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
    const x = 20 + i * 228 + r * 80, y = 640 + r * 190;
    a += shadow(x + 100, y + 120, 120) + R(x, y + 40, 210, 16, '#2b2d38', 3) + R(x + 40, y - 70, 130, 90, '#0d0e12', 6) + R(x + 47, y - 63, 116, 74, ['#2e8bff', '#7a5cff', '#21c48d', '#ff6a3d'][(i + r) % 4], 3) + R(x + 95, y + 20, 20, 20, '#0d0e12');
    a += R(x + 60, y + 60, 90, 120, '#c2334d', 26) + R(x + 70, y + 72, 70, 12, '#111', 4);
    gl += screenGlow(x + 47, y - 63, 116, 74, ['#4aa0ff', '#9a7cff', '#3ee0a8', '#ff8a5a'][(i + r) % 4]);
  }
  return { art: a, glow: gl, alwaysLit: true };
};

// 번화가 (바깥): 상가 건물·간판·차양, 인도, 가로등, 가로수, 네온
SC.street = o => {
  const s = o.season;
  let a = '', lit = '', gl = '';
  const shops = [[0, 300, 430, '#c9b7a6', '#e5534b', '분식'], [300, 260, 520, '#9fb0bf', '#2f8a4a', 'MART'], [560, 330, 380, '#d9c2a2', '#7a5cff', '노래방'], [890, 300, 470, '#b8c6cf', '#ff8a3d', '치킨'], [1190, 420, 400, '#cdb6a0', '#2f5fa8', 'CAFE']];
  for (const [x, w, h, c, sc, name] of shops) {
    const b = building(x, 700, w, h, c, { bottom: 200, cw: 30, ch: 36, gx: 26, gy: 24 }); a += b.s; lit += b.lit;
    a += R(x + 10, 500, w - 20, 200, '#2c3440') + R(x + 24, 520, w - 48, 160, '#7fa6c4', 2, 'opacity=".55"') + R(x + 10, 430, w - 20, 60, sc, 6) + T(x + w / 2, 474, 38, '#fff', name, '');
    for (let k = 0; k < (w - 20) / 40; k++) a += P(`M${x + 10 + k * 40},${500}h40l-6,30h-28z`, k % 2 ? '#f4f1ea' : sc, 'opacity=".95"');   // 차양
    gl += glow(x + w / 2, 460, w * .45, sc, .45);
  }
  a += R(0, 700, W, 300, '#8d8f93') + R(0, 700, W, 18, '#b9bbbe') + R(0, 800, W, 6, '#a3a5a8') + R(0, 870, W, 130, '#5d6066');
  for (let i = 0; i < 9; i++) a += R(30 + i * 190, 925, 100, 10, '#e8e8e2', 3);
  a += tree(170, 790, .7, s) + tree(1030, 790, .7, s) + lampPost(520, 800, 320) + lampPost(1420, 800, 320);
  gl += lit + glow(520, 470, 130, '#ffe7a8') + glow(1420, 470, 130, '#ffe7a8');
  return { art: a, glow: gl, out: true };
};

// 시장 (바깥): 줄무늬 차양 노점, 과일·채소 상자, 전구 줄
SC.market = o => {
  let a = '', gl = '';
  a += R(0, 380, W, 340, '#b9a38a') + R(0, 380, W, 14, '#9c866d');
  for (let i = 0; i < 5; i++) { const x = 20 + i * 320, cols = ['#e5534b', '#2f8a4a', '#2f5fa8', '#e3a13b', '#8a5aa8'][i];
    for (let k = 0; k < 7; k++) a += P(`M${x + k * 42},430h42l-8,70h-26z`, k % 2 ? '#f4f1ea' : cols);
    a += R(x, 420, 296, 14, shade(cols, .8), 3) + R(x + 10, 500, 276, 230, '#7a5a42', 4) + R(x + 6, 640, 284, 22, '#a07455', 4);
    for (let k = 0; k < 4; k++) { a += R(x + 20 + k * 68, 600, 60, 40, '#c9a77c', 3); for (let m = 0; m < 4; m++) a += C(x + 34 + k * 68 + (m % 2) * 18, 596 - (m >> 1) * 12, 11, ['#e5534b', '#f2a33b', '#7fbf4d', '#f2d14b'][(i + k) % 4]); }
    a += T(x + 148, 560, 30, '#f4f1ea', ['과일', '채소', '생선', '떡', '반찬'][i], '');
  }
  a += L('M0,410Q400,460 800,410T1600,410', '#3a3330', 3);
  for (let k = 0; k < 16; k++) { const x = 50 + k * 100, y = 410 + Math.sin(k * 1.57) * 18 + 22; a += C(x, y, 9, '#fff3c4'); gl += glow(x, y, 50, '#ffd77a', .7); }
  a += R(0, 720, W, 280, '#9a9690') + tile(0, 720, W, 280, '#7d7a75', 80);
  return { art: a, glow: gl, out: true };
};

// 공원 (바깥): 언덕 잔디, 나무, 길, 벤치, 가로등, 꽃, 연못
SC.park = o => {
  const s = o.season;
  let a = P('M0,620Q300,560 640,610T1600,590V1000H0Z', s === 'winter' ? '#dfe7ee' : '#8cc278', 'opacity=".75"');
  a += grass(700, s === 'winter' ? '#e8eef3' : s === 'fall' ? '#b5b55c' : '#7fbf6a', s === 'winter' ? '#d3dce5' : s === 'fall' ? '#8f9447' : '#5b9a55');
  a += E(1180, 880, 240, 50, '#7fb6d9') + E(1180, 872, 200, 34, '#a8d2ea', 'opacity=".6"');   // 연못
  a += P('M560,1000Q700,860 820,760T900,700H960Q900,780 880,840T760,1000Z', '#e2d5bd');
  a += tree(120, 760, 1.25, s) + tree(420, 720, .8, s) + tree(1320, 720, .9, s) + tree(1520, 780, 1.2, s) + bush(260, 800, 1, s === 'winter' ? '#c9d3de' : '#4a8a50') + bush(1000, 760, .8, s === 'winter' ? '#c9d3de' : '#58985a');
  if (s !== 'winter') for (let k = 0; k < 18; k++) a += C(80 + k * 87, 930 + (k % 3) * 18, 7, ['#f4b8c8', '#ffe07a', '#ffffff'][k % 3]);
  a += bench(420, 900) + lampPost(1000, 860);
  return { art: a, glow: glow(1000, 535, 130, '#ffe7a8'), out: true };
};

// 놀이터 (바깥): 미끄럼틀, 그네, 모래밭, 울타리, 나무
SC.playground = o => {
  const s = o.season;
  let a = grass(700, s === 'winter' ? '#e8eef3' : '#8cc878', s === 'winter' ? '#d3dce5' : '#6aa95f') + E(800, 900, 420, 70, '#e6cf9e');
  for (let i = 0; i < 26; i++) a += R(i * 64, 690, 8, 70, '#d9c2a2') ;
  a += R(0, 700, W, 8, '#d9c2a2');
  a += P('M520,880L520,600H620V880Z', '#e5534b') + P('M620,620L860,860H900L640,600Z', '#ffd166') + R(510, 590, 120, 16, '#2f5fa8', 4) + L('M530,880V600M610,880V600', '#2f5fa8', 6);   // 미끄럼틀
  a += L('M1000,880L1060,560L1300,560L1360,880', '#2f8a4a', 12) + L('M1120,560V760M1160,560V760M1220,560V760M1260,560V760', '#596069', 3) + R(1105, 760, 70, 12, '#e5534b', 3) + R(1205, 760, 70, 12, '#2f5fa8', 3);   // 그네
  a += tree(170, 760, 1.15, s) + tree(1500, 760, 1.05, s);
  return { art: a, glow: '', out: true };
};

// 병원: 흰·민트 벽, 침대·커튼 레일·링거, 창, 십자 표시
SC.hospital = o => {
  const win = { x: 1180, y: 200, w: 300, h: 300 };
  let a = room({ wall: '#e8f1ef', wallTop: '#dbe8e5', floor: '#c9d3d6', floorTop: '#d6dee0', base: '#9fc7bf', holes: [win] });
  a += winFrame(win, { cols: 2, blind: 6, frame: '#f4f7f7' }) + tile(0, FL, W, 240, '#aab6ba', 90);
  a += R(100, 120, 120, 120, '#fff', 10) + R(140, 140, 40, 80, '#e5534b') + R(120, 160, 80, 40, '#e5534b');
  a += L('M300,90H1000', '#9aa6b2', 6) + P('M310,95Q330,500 300,700H520Q500,400 540,95Z', '#bfe0d8', 'opacity=".9"');   // 커튼
  a += shadow(820, 900, 330) + R(560, 720, 520, 120, '#f4f7f7', 10) + R(560, 680, 520, 50, '#d6e9f2', 14) + R(570, 640, 140, 50, '#ffffff', 16) + R(540, 600, 30, 300, '#9aa6b2', 6) + R(560, 840, 12, 60, '#9aa6b2') + R(1068, 840, 12, 60, '#9aa6b2');
  a += R(1150, 520, 8, 380, '#9aa6b2') + R(1120, 520, 70, 8, '#9aa6b2') + R(1130, 528, 40, 70, '#dff1ff', 10, 'opacity=".9"');
  const gl = [400, 1000].map(x => R(x - 150, 40, 300, 14, '#f4fbff', 4) + cone(x, 54, 560, 700, '#eef8ff', .03)).join('');
  return { art: a, glow: gl };
};

// 복지관: 게시판, 접이식 의자, 탁구대, 화분, 창
SC.center = o => {
  const ws = [{ x: 90, y: 200, w: 260, h: 300 }, { x: 1250, y: 200, w: 260, h: 300 }];
  let a = room({ wall: '#f1e6d2', wallTop: '#e8dabf', floor: '#c9a77c', floorTop: '#d4b48a', base: '#b48d63', holes: ws, planks: '#a7835f' });
  ws.forEach(w => { a += winFrame(w, { cols: 2, frame: '#f8f2e8' }); });
  a += R(520, 200, 560, 300, '#b8895f', 8) + R(540, 220, 520, 260, '#d9b88c', 4);
  [[560, 240, '#fff6b0'], [700, 260, '#ffd1dc'], [850, 235, '#c9e7ff'], [960, 300, '#d8f5c9'], [620, 360, '#ffe2b8'], [800, 380, '#fff']].forEach(([x, y, c]) => { a += R(x, y, 110, 90, c, 2) + C(x + 55, y + 8, 6, '#e5534b'); });
  a += T(800, 190, 30, '#6b4a35', '우리 동네 소식', '');
  a += shadow(800, 900, 300) + R(560, 790, 480, 20, '#2f8a4a', 4) + R(796, 760, 8, 34, '#f4f1ea') + R(580, 810, 12, 90, '#596069') + R(1008, 810, 12, 90, '#596069');
  a += chair(300, 920, '#c0554b', .8) + chair(400, 920, '#2f5fa8', .8) + chair(1220, 920, '#e3a13b', .8) + plant(1520, 760, 1.1);
  const gl = [400, 1200].map(x => R(x - 140, 40, 280, 14, '#fffbe8', 4) + cone(x, 54, 520, 700, '#fff6d8', .03)).join('');
  return { art: a, glow: gl };
};

// 터미널: 큰 유리창, 출발 안내판(LED), 의자 줄, 기둥, 매표소
SC.station = o => {
  const ws = [0, 1, 2, 3].map(i => ({ x: 40 + i * 395, y: 100, w: 360, h: 420 }));
  let a = room({ wall: '#cfd5db', wallTop: '#bfc6ce', floor: '#9ea5ad', floorTop: '#b0b6bd', base: '#7f8790', holes: ws });
  ws.forEach(w => { a += winFrame(w, { cols: 3, rows: 2, frame: '#7f8790', sill: false, t: 10 }); });
  a += R(0, 520, W, 40, '#7f8790') + R(420, 560, 760, 120, '#1a1c20', 6);
  ['서울  09:30  3번', '부산  10:10  5번', '강릉  10:45  2번'].forEach((t, i) => { a += T(800, 600 + i * 34, 26, '#ffb13b', t, ''); });
  for (let i = 0; i < 4; i++) a += R(i * 520 - 20, 100, 40, 660, '#e6e9ec');
  for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { const x = 60 + i * 170 + r * 50, y = 860 + r * 90; a += R(x, y - 50, 130, 40, '#2f5fa8', 8) + R(x + 10, y - 90, 110, 44, '#3b6bb4', 10) + R(x + 60, y - 10, 10, 30, '#596069'); }
  const gl = glow(800, 620, 420, '#ffb13b', .25) + [400, 1200].map(x => cone(x, 0, 600, 760, '#eef8ff', .06)).join('');
  return { art: a, glow: gl };
};

// 술집: 어두운 나무, 술병 선반(뒤 조명), 바 카운터, 스툴, 네온 간판
SC.bar = o => {
  const win = { x: 1260, y: 230, w: 260, h: 300 };
  let a = room({ wall: '#3d2a22', wallTop: '#2f201a', floor: '#2a1d17', floorTop: '#33241c', base: '#1e1511', holes: [win], planks: '#1e1511' });
  a += winFrame(win, { cols: 2, frame: '#2a1d17', sillC: '#1e1511' });
  let gl = '';
  for (let r = 0; r < 3; r++) { const y = 260 + r * 120; a += R(100, y + 70, 860, 12, '#5a3d2e'); for (let i = 0; i < 18; i++) { const x = 130 + i * 46, c = ['#3f7d47', '#8a3b2e', '#c9a94b', '#2f5fa8', '#e8e0d0'][(i + r) % 5]; a += R(x, y + 10, 22, 60, c, 6) + R(x + 7, y - 6, 8, 18, c, 2); } gl += R(100, y + 60, 860, 30, '#ffb35a', 0, 'opacity=".25"'); }
  a += R(600, 120, 300, 80, '#1a1210', 10) + T(750, 178, 56, '#ff8f5a', '술 한 잔', '');
  gl += glow(750, 160, 220, '#ff7a3d', .5);
  a += shadow(700, 920, 640) + R(40, 690, 1200, 60, '#6b4433', 8) + R(60, 750, 1160, 160, '#4a2f24', 6) + R(40, 680, 1200, 18, '#8a5a40', 6);
  for (let i = 0; i < 6; i++) { const x = 140 + i * 190; a += C(x, 840, 34, '#7d2f2a') + R(x - 5, 870, 10, 90, '#2a2a2a') + E(x, 960, 30, 6, '#2a2a2a'); }
  for (const x of [300, 700, 1100]) { a += pendant(x, 0, 230, '#1a1210', '#ffcf7a'); gl += glow(x, 270, 150, '#ffb35a') + cone(x, 265, 280, 430, '#ffc27a', .12); }
  return { art: a, glow: gl, alwaysLit: true };
};

// 모텔: 어두운 방, 침대·베개, 분홍 네온 줄, 커튼 창, 스탠드
SC.motel = o => {
  const win = { x: 1220, y: 220, w: 280, h: 300 };
  let a = room({ wall: '#3a2a3e', wallTop: '#2d2031', floor: '#3a2a2e', floorTop: '#45333a', base: '#241a27', holes: [win] });
  a += winFrame(win, { cols: 2, frame: '#2d2031', curtain: '#7a3b5a' });
  a += R(0, 140, W, 8, '#ff5fae', 0, 'opacity=".85"');
  a += shadow(700, 940, 520) + R(260, 580, 880, 120, '#5a2f45', 10) + R(240, 520, 920, 80, '#6e3a55', 18) + R(280, 680, 840, 160, '#f2e6ee', 16) + R(260, 760, 880, 110, '#c9608e', 14) + R(320, 640, 220, 70, '#fff', 28) + R(860, 640, 220, 70, '#fff', 28);
  a += R(120, 680, 100, 120, '#2d2031', 6) + R(160, 600, 8, 80, '#c9a94b') + P('M130,610L150,560H180L200,610Z', '#ffd0e4');
  const gl = R(0, 134, W, 20, '#ff7cc0', 0, 'opacity=".5"') + glow(165, 585, 170, '#ffb0d0', .7) + glow(700, 400, 600, '#ff6fb0', .15);
  return { art: a, glow: gl, alwaysLit: true };
};

// 종교시설: 스테인드글라스, 긴 의자, 통로, 촛대
SC.church = o => {
  let a = room({ wall: '#e9e0cf', wallTop: '#ddd1bb', floor: '#8a6446', floorTop: '#9c7454', base: '#6e4f39', holes: [] });
  let gl = '';
  for (const [x, w] of [[180, 180], [710, 180], [1240, 180]]) {
    a += P(archHole(x - 14, 100, w + 28, 480), '#5e4433');
    const cs = ['#e5534b', '#2f5fa8', '#e3b04b', '#2f8a4a', '#8a5aa8', '#4fb0d6'];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) a += R(x + i * w / 3 + 3, 100 + w / 2 + j * 90 + 3, w / 3 - 6, 84, cs[(i + j * 2 + x) % 6], 2, 'opacity=".85"');
    a += P(archHole(x, 100, w, w / 2 + 2), '#e3b04b', 'opacity=".9"') + C(x + w / 2, 100 + w / 2 - 10, w / 5, '#e5534b', 'opacity=".9"');
    gl += glow(x + w / 2, 380, 260, '#ffe7b0', .3);
  }
  for (let r = 0; r < 3; r++) for (const side of [0, 1]) { const y = 800 + r * 70, x = side ? 880 : 100; a += R(x, y - 40, 620, 18, '#6e4f39', 4) + R(x, y - 22, 620, 40, '#7d5840', 4); }
  for (const x of [660, 940]) { a += R(x - 6, 620, 12, 140, '#c9a94b') + E(x, 760, 30, 8, '#c9a94b') + R(x - 8, 590, 16, 32, '#fff8e6', 3); gl += glow(x, 580, 90, '#ffd58a'); }
  return { art: a, glow: gl };
};

// 편의점: 상품 선반, 음료 냉장고(빛), 계산대, 유리 앞면, 형광등
SC.conveni = o => {
  const win = { x: 1180, y: 160, w: 380, h: 560 };
  let a = room({ wall: '#eef2f4', wallTop: '#e2e8eb', floor: '#d9dde0', floorTop: '#e4e7ea', base: '#bfc6cc', holes: [win] });
  a += winFrame(win, { cols: 2, frame: '#596069', sill: false, t: 10 }) + R(1180, 160, 380, 40, '#2f8a4a', 0, 'opacity=".85"') + T(1370, 190, 24, '#fff', '24 시간', '');
  a += R(0, 100, 1100, 50, '#2f8a4a') + R(0, 150, 1100, 10, '#e3b04b') + T(550, 138, 34, '#fff', 'LLIFE 24', '');
  let gl = '';
  for (let i = 0; i < 3; i++) { const x = 40 + i * 190; a += R(x, 200, 170, 540, '#c9d3d9', 6) + R(x + 10, 210, 150, 520, '#e8f6ff', 4, 'opacity=".85"'); for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) a += R(x + 18 + k * 28, 230 + r * 128, 20, 70, ['#e5534b', '#2f5fa8', '#ffd166', '#2f8a4a', '#f4f1ea'][(k + r + i) % 5], 4); gl += glow(x + 85, 470, 200, '#dff3ff', .4); }
  for (let r = 0; r < 4; r++) { const y = 260 + r * 120; a += R(640, y + 80, 440, 12, '#9aa6b2'); for (let k = 0; k < 11; k++) a += R(650 + k * 39, y + 20 + (k % 3) * 8, 32, 60 - (k % 3) * 8, ['#ff8a3d', '#7a5cff', '#e5534b', '#ffd166', '#21c48d'][(k + r) % 5], 3); }
  a += shadow(820, 905, 300) + R(560, 780, 560, 120, '#2f8a4a', 6) + R(550, 770, 580, 18, '#3fa05c', 4) + R(950, 720, 120, 60, '#1f2630', 4);
  gl += [300, 900].map(x => R(x - 180, 40, 360, 14, '#f4fbff', 4) + cone(x, 54, 640, 700, '#eef8ff', .03)).join('');
  return { art: a, glow: gl, alwaysLit: true };
};

// 공연장: 무대·조명 빔, 스피커, 관객 실루엣
SC.concert = o => {
  let a = room({ wall: '#15131f', wallTop: '#0e0c16', floor: '#0e0d14', floorTop: '#16141e', base: '#0a0910', holes: [] });
  a += R(200, 420, 1200, 300, '#1e1b2b', 8) + R(180, 700, 1240, 40, '#2c2840', 6) + R(220, 120, 1160, 30, '#2c2840', 4);
  for (const x of [240, 1280]) a += R(x, 460, 80, 240, '#0b0a10', 6) + C(x + 40, 530, 26, '#2c2840') + C(x + 40, 630, 30, '#2c2840');
  a += R(700, 560, 30, 140, '#2c2840') + C(715, 545, 18, '#2c2840');
  let gl = '';
  const beams = [[360, '#ff4fa3'], [620, '#4fb0ff'], [980, '#ffd166'], [1240, '#7a5cff']];
  for (const [x, c] of beams) { gl += P(`M${x - 14},150L${x + 14},150L${x + 160 - (x > 800 ? 320 : 0)},720L${x - 160 + (x < 800 ? 320 : 0)},720Z`, c, 'opacity=".22"') + glow(x, 160, 70, c); a += R(x - 18, 130, 36, 30, '#3a3550', 4); }
  gl += glow(800, 600, 600, '#7a5cff', .25);
  for (let i = 0; i < 26; i++) { const x = i * 64 + (i % 2) * 20, y = 900 + (i % 3) * 30; a += C(x, y - 70, 26, '#06050a') + R(x - 34, y - 46, 68, 160, '#06050a', 26); if (i % 5 === 2) a += L(`M${x + 20},${y - 60}L${x + 40},${y - 140}`, '#06050a', 12); }
  return { art: a, glow: gl, alwaysLit: true };
};

/* ---------- 고르기·그리기 ---------- */
// 시간대 → 그림 층 필터 (실내는 불을 켜서 밤에도 덜 어두움), 비·눈 오면 조금 흐리게
function look(tod, out, wet, lit) {
  const k = { morning: [1, 1.05, .08, 0], day: [1, 1, 0, 0], evening: [.82, 1.1, .22, -8], night: [out ? .5 : lit ? .62 : .58, .8, .05, 10] }[tod] || [1, 1, 0, 0];
  const b = k[0] * (wet ? (out ? .86 : .94) : 1);
  return `brightness(${b.toFixed(2)}) saturate(${(k[1] * (wet && out ? .85 : 1)).toFixed(2)}) sepia(${k[2]}) hue-rotate(${k[3]}deg)`;
}
const GLOW = { morning: .12, day: .08, evening: .7, night: 1 };
let host = null, cur = null;
function build(id, opt) {
  uid++;
  const s = SC[id](opt);
  const svg = (cls, inner) => `<svg class="${cls}" viewBox="0 0 ${W} 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${inner}</svg>`;
  const el = document.createElement('div');
  el.className = 'bd-scene';
  el.innerHTML = svg('bd-art', s.art) + svg('bd-glow', s.glow || '');
  el._meta = { out: !!s.out, lit: !!s.alwaysLit };
  return el;
}
function apply(el, o) {
  const m = el._meta;
  el.querySelector('.bd-art').style.filter = look(o.tod, m.out, o.wet, m.lit);
  el.querySelector('.bd-glow').style.opacity = Math.max(GLOW[o.tod] ?? .1, m.lit ? .75 : 0);
}
function set(o) {
  if (!host) return;
  const id = o && SC[o.id] ? o.id : null, key = id && `${id}:${o.season}`;
  if (!id) { if (cur) { const old = cur.el; old.classList.remove('on'); setTimeout(() => old.remove(), 700); cur = null; } host.classList.remove('has'); return; }
  host.classList.add('has');
  if (cur && cur.key === key) { apply(cur.el, o); return; }
  const el = build(id, o);
  apply(el, o);
  host.appendChild(el);
  if (cur) { const old = cur.el; old.classList.remove('on'); setTimeout(() => old.remove(), 700); }
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  cur = { key, el };
}
function init(el) { host = el; }
window.SceneBG = { init, set, ids: Object.keys(SC), build: (id, opt) => SC[id] ? SC[id](opt || {}) : null };
})();
