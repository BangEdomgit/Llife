/* 🎲 행동 창 그림 — 픽토그램 아이콘맨 + 장소·시간대 배경 (SVG + SMIL 애니메이션)
   ActArt.scene(actionId, ctx) → <svg>. ctx = { place, hour, weather, region, gender, age, dayN }
   예) 저녁 도서관 공부 = 정면 아이콘맨이 독서실 책상에서 쓰는 중, 뒤 창문에 야경
       공원 산책 = 옆모습으로 걷는 모션, 뒤 배경이 흘러감 */
(function () {
  const W = 320, H = 200;
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let uid = 0, seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const kt = n => Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(';');
  const SPL = n => Array(n - 1).fill('.45 0 .55 1').join(';');
  // 관절(cx,cy) 기준 회전 / 이동 / 투명도 — 정적 자세는 바깥 g의 transform, 움직임은 additive
  const rot = (cx, cy, vals, dur, begin = 0) => RM ? '' : `<animateTransform attributeName="transform" type="rotate" values="${vals.map(v => `${v} ${cx} ${cy}`).join(';')}" keyTimes="${kt(vals.length)}" calcMode="spline" keySplines="${SPL(vals.length)}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" additive="sum"/>`;
  const mov = (vals, dur, begin = 0, lin) => RM ? '' : `<animateTransform attributeName="transform" type="translate" values="${vals.join(';')}" keyTimes="${kt(vals.length)}"${lin ? '' : ` calcMode="spline" keySplines="${SPL(vals.length)}"`} dur="${dur}s" begin="${begin}s" repeatCount="indefinite" additive="sum"/>`;
  const fade = (vals, dur, begin = 0) => RM ? '' : `<animate attributeName="opacity" values="${vals}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`;
  const L = (x1, y1, x2, y2, c, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const C = (x, y, r, c, ex = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"${ex}/>`;
  const R = (x, y, w, h, c, rx = 0, ex = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${c}"${ex}/>`;

  /* ── 시간대·하늘 ── */
  const todOf = h => h < 5 || h >= 20 ? 'night' : h >= 17 ? 'dusk' : h < 8 ? 'morning' : 'day';
  const GREY = ['cloudy', 'rain', 'storm', 'fog', 'dust', 'snow', 'sleet'];
  function skyStops(tod, wx) {
    const g = GREY.includes(wx);
    return {
      night: g ? ['#141a28', '#272e40'] : ['#0a1230', '#22305c'],
      dusk: g ? ['#4a4a62', '#a08080'] : ['#33386e', '#c86f7e', '#f4a76a'],
      morning: g ? ['#9aa6b4', '#d8dde3'] : ['#8cc3ef', '#ffe0b8'],
      day: g ? ['#95a3b3', '#cdd5de'] : ['#5fb0ea', '#cfeaff'],
    }[tod];
  }
  function skyDef(id, tod, wx) {
    const s = skyStops(tod, wx);
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${s.map((c, i) => `<stop offset="${i / (s.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  }
  const dark = tod => tod === 'night' || tod === 'dusk';
  // 해·달·별·구름
  function skyBits(x, y, w, h, tod, wx) {
    let o = '';
    if (tod === 'night' && !GREY.includes(wx)) {
      for (let i = 0; i < 14; i++) o += C(x + rnd() * w, y + rnd() * h * .55, rnd() < .3 ? 1.2 : .7, '#fff', ` opacity="${(.5 + rnd() * .5).toFixed(2)}"`).replace('/>', `>${fade('1;.25;1', (2 + rnd() * 3).toFixed(1), -rnd() * 3)}</circle>`);
      o += C(x + w * .78, y + h * .2, 9, '#fdf3c7') + C(x + w * .78 + 4, y + h * .2 - 3, 8, skyStops(tod, wx)[0]);   // 초승달
    } else if (tod === 'day' || tod === 'morning') {
      if (!GREY.includes(wx)) o += C(x + w * .82, y + h * .22, 11, '#fff3b0', ' opacity=".95"');
      const cl = GREY.includes(wx) ? 4 : 2;
      for (let i = 0; i < cl; i++) {
        const cx = x + rnd() * w, cy = y + 10 + rnd() * h * .35, k = .7 + rnd() * .6, c = GREY.includes(wx) ? '#e8ebef' : '#fff';
        o += `<g opacity=".9">${C(cx, cy, 9 * k, c)}${C(cx + 10 * k, cy - 4 * k, 11 * k, c)}${C(cx + 22 * k, cy, 9 * k, c)}${R(cx, cy, 22 * k, 9 * k, c)}${mov(['0 0', `${w * .25} 0`, '0 0'], 40 + rnd() * 30, -rnd() * 20)}</g>`;
      }
    }
    return o;
  }
  // 비·눈 (창문이나 바깥 영역)
  function precip(x, y, w, h, wx) {
    if (!['rain', 'storm', 'snow', 'sleet'].includes(wx)) return '';
    const snow = wx === 'snow';
    let o = '';
    for (let i = 0; i < (snow ? 22 : 28); i++) {
      const px = x + rnd() * w, py = y + rnd() * h, d = (snow ? 4 + rnd() * 3 : .7 + rnd() * .4).toFixed(2), b = -rnd() * 4;
      o += snow ? `<g>${C(px, y - 4, 1.6, '#fff', ' opacity=".9"')}${mov(['0 0', `${ri(-8, 8)} ${h + 8}`], d, b, true)}</g>`
        : `<g>${L(px, y - 10, px - 3, y - 2, 'rgba(210,225,245,.7)', 1.2)}${mov(['0 0', `-12 ${h + 12}`], d, b, true)}</g>`;
    }
    return `<g clip-path="url(#${CLIP})">${o}</g>`;
  }
  let CLIP = '';
  // 도시 실루엣 (밤엔 창문 불빛이 깜빡임). 뉴욕은 더 높고 물탱크가 있음
  function skyline(x, base, w, tod, city, tone) {
    let o = '', cx = x - 4;
    const night = dark(tod), ny = city === 'ny';
    while (cx < x + w) {
      const bw = ri(16, 30), bh = ri(ny ? 34 : 22, ny ? 78 : 56), c = tone || (night ? (rnd() < .5 ? '#161c30' : '#1d2440') : (rnd() < .5 ? '#8fa3b8' : '#a3b4c6'));
      o += R(cx, base - bh, bw, bh + 2, c);
      if (ny && rnd() < .35) o += R(cx + bw / 2 - 3, base - bh - 7, 6, 6, c) + L(cx + bw / 2 - 2, base - bh - 1, cx + bw / 2 - 2, base - bh + 1, c, 1);
      if (night) for (let wy = base - bh + 5; wy < base - 4; wy += 7) for (let wx2 = cx + 3; wx2 < cx + bw - 4; wx2 += 6) {
        if (rnd() < .42) { const tw = rnd() < .12; o += `<rect x="${wx2}" y="${wy}" width="3" height="3.5" fill="${rnd() < .8 ? '#ffd27a' : '#bfe3ff'}" opacity="${(.55 + rnd() * .45).toFixed(2)}">${tw ? fade('1;.1;1', (3 + rnd() * 5).toFixed(1), -rnd() * 4) : ''}</rect>`; }
      }
      cx += bw + ri(1, 4);
    }
    return o;
  }
  // 창문: 하늘 + 바깥 (도시/나무) + 비·눈 + 창틀
  function windowView(x, y, w, h, ctx, o = {}) {
    const id = `aw${uid}`, sky = `as${uid}`;
    CLIP = id;
    const tod = ctx.tod;
    let inner = R(x, y, w, h, `url(#${sky})`) + skyBits(x, y, w, h, tod, ctx.weather);
    if (o.trees) { for (let i = 0; i < 5; i++) { const tx = x + 10 + i * (w / 5) + ri(-4, 4), tr = ri(12, 18); inner += R(tx - 2, y + h - 22, 4, 22, dark(tod) ? '#1a1410' : '#6b4c35') + C(tx, y + h - 26, tr, dark(tod) ? '#14261c' : '#4f9a5a'); } }
    else inner += skyline(x, y + h, w, tod, ctx.region);
    inner += precip(x, y, w, h, ctx.weather);
    const fr = o.frame || '#d9d2c3';
    return `<defs>${skyDef(sky, tod, ctx.weather)}<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>
      <g clip-path="url(#${id})">${inner}</g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${fr}" stroke-width="5"/>
      ${o.bars !== false ? L(x + w / 2, y, x + w / 2, y + h, fr, 3) + (o.hbar ? L(x, y + h * .45, x + w, y + h * .45, fr, 3) : '') : ''}
      ${dark(tod) ? '' : `<path d="M${x + 8},${y + h - 6} L${x + 28},${y + 6}" stroke="rgba(255,255,255,.35)" stroke-width="5"/>`}`;
  }
  // 그림자 바닥 / 실내 어둡기
  const dim = (tod, a = .28) => dark(tod) ? R(0, 0, W, H, '#0a0e1c', 0, ` opacity="${tod === 'night' ? a : a * .5}"`) : '';

  /* ── 아이콘맨 ── */
  // 색: 어두운 장면은 밝게, 밝은 장면은 진하게. 뒤쪽 팔다리는 조금 흐리게
  const pcol = d => d ? ['#f2f5fa', '#b9c2d4'] : ['#263450', '#5b6a88'];
  const hairOf = (ctx, x, y, c) => ctx.gender === 'f' ? C(x - 7, y - 6, 5, c) : '';   // 여자면 뒤로 묶은 머리 한 점
  // 옆모습(오른쪽을 봄) 걷기·달리기. (x,y)=골반
  function sideWalker(x, y, o) {
    const [c, cb] = o.col, T = o.T || 1.1, sw = o.sw || 24, run = !!o.run;
    const thigh = [-sw, 0, sw, 0, -sw], shin = run ? [10, 20, 30, 95, 10] : [0, 4, 10, 50, 0];
    const arm = run ? [sw * 1.1, 0, -sw * 1.1, 0, sw * 1.1].map(v => -v) : [sw * 1.25, 0, -sw * 1.25, 0, sw * 1.25].map(v => -v);
    const fore = run ? [-85, -80, -95, -80, -85] : [-12, -18, -28, -18, -12];
    const leg = (col, b) => `<g>${rot(x, y, thigh, T, b)}${L(x, y, x, y + 21, col, 11)}<g>${rot(x, y + 21, shin, T, b)}${L(x, y + 21, x, y + 41, col, 10)}${L(x, y + 41, x + 7, y + 41, col, 8)}</g></g>`;
    const armG = (col, b) => o.carry ? `<g transform="rotate(-62 ${x} ${y - 38})">${L(x, y - 38, x, y - 20, col, 9)}<g transform="rotate(-30 ${x} ${y - 20})">${L(x, y - 20, x, y - 4, col, 9)}</g></g>`
      : `<g>${rot(x, y - 38, arm, T, b)}${L(x, y - 38, x, y - 20, col, 9)}<g transform="rotate(${fore[0]} ${x} ${y - 20})">${rot(x, y - 20, fore.map(v => v - fore[0]), T, b)}${L(x, y - 20, x, y - 4, col, 9)}</g></g>`;
    const half = -T / 2;
    const lean = run ? 9 : o.carry ? 3 : 2;
    return `<g>${mov(['0 0', `0 ${run ? -4 : -2}`, '0 0', `0 ${run ? -4 : -2}`, '0 0'], T)}
      ${leg(cb, half)}${armG(cb, 0)}
      <g transform="rotate(${lean} ${x} ${y})">${L(x, y - 42, x, y - 3, c, 15)}${hairOf(o.ctx || {}, x + 2, y - 57, c)}${C(x + 2, y - 57, 10, c)}</g>
      ${leg(c, 0)}${o.carry ? `<g transform="rotate(${lean} ${x} ${y})">${R(x + 10, y - 40, 24, 20, '#c89a5a', 2)}${L(x + 10, y - 30, x + 34, y - 30, '#a77b41', 2)}</g>` : ''}${armG(c, half)}</g>`;
  }
  // 정면 상반신 (책상 뒤에 앉음). (cx, top)=머리 중심
  function frontBust(cx, hy, c, ctx, headAnim = '') {
    return `<g>${headAnim}${hairOf(ctx, cx + 3, hy - 4, c)}${C(cx, hy, 13, c)}</g>${R(cx - 17, hy + 13, 34, 70, c, 15)}`;
  }

  /* ── 장면들 ── */
  // 책상 앞 정면 (공부·독서·학원). kind: lib | home | cafe | class
  function deskScene(ctx, kind, mode) {
    const tod = ctx.tod, d = kind === 'class' ? false : dark(tod);
    const [c, cb] = pcol(d || (kind === 'lib' && dark(tod)));
    const wall = { lib: d ? '#262b39' : '#cdbfa6', home: d ? '#3a3448' : '#ecdcc6', cafe: d ? '#3d2a22' : '#8a5a44', class: '#e7ecef' }[kind];
    let bg = R(0, 0, W, H, wall);
    if (kind === 'lib') {
      bg += windowView(78, 14, 164, 104, ctx, { frame: d ? '#4b4f5e' : '#efe8da', hbar: true });
      for (const sx of [0, 268]) { bg += R(sx, 0, 52, H, d ? '#2e2420' : '#7a5a40'); for (let sy = 12; sy < 150; sy += 34) { bg += R(sx, sy + 26, 52, 4, d ? '#1d1714' : '#5a412d'); let bx = sx + 3; while (bx < sx + 48) { const bw = ri(4, 7); bg += R(bx, sy + 4 + ri(0, 6), bw, 22 - ri(0, 6), ['#a33', '#36a', '#3a6', '#c93', '#666', '#839'][ri(0, 5)], 1, d ? ' opacity=".55"' : ''); bx += bw + 1; } } }
      // 독서실 칸막이
      bg += R(56, 52, 12, 148, d ? '#3a2c22' : '#8b6a4a', 2) + R(252, 52, 12, 148, d ? '#3a2c22' : '#8b6a4a', 2) + R(56, 52, 12, 3, d ? '#5a4636' : '#a88866') + R(252, 52, 12, 3, d ? '#5a4636' : '#a88866');
    } else if (kind === 'home') {
      bg += windowView(196, 22, 92, 82, ctx, { frame: '#f4efe6', hbar: false }) + R(186, 16, 10, 96, d ? '#5a4a6a' : '#d98c8c', 3) + R(288, 16, 10, 96, d ? '#5a4a6a' : '#d98c8c', 3);
      bg += R(36, 30, 46, 60, d ? '#4a5a7a' : '#7fb3d5', 2) + `<path d="M40,80 L55,52 L66,70 L72,62 L78,80 Z" fill="${d ? '#2a3550' : '#f6f0e0'}" opacity=".8"/>` + R(96, 40, 30, 30, d ? '#6a5040' : '#f2c46d', 15, ' opacity=".7"');
    } else if (kind === 'cafe') {
      bg += windowView(12, 18, 296, 98, ctx, { frame: '#2b1d16', hbar: false });
      for (const lx of [70, 250]) bg += L(lx, 0, lx, 30, '#222', 1.5) + `<path d="M${lx - 12},40 Q${lx},22 ${lx + 12},40 Z" fill="#2b2b2b"/>` + `<ellipse cx="${lx}" cy="42" rx="20" ry="6" fill="#ffd27a" opacity="${d ? .5 : .25}"/>`;
    } else {
      bg += R(44, 16, 232, 96, '#fdfdfb', 4, ' stroke="#9aa5ad" stroke-width="4"') + `<path d="M62,40 h40 M62,52 h70 M62,64 q10,-10 20,0 t20,0 M160,36 l20,20 m0,-20 l-20,20 M200,46 h48 M200,58 h30 M176,84 c10,-14 30,-14 40,0" stroke="#3a6fb0" stroke-width="2.4" fill="none" stroke-linecap="round"/>` + `<path d="M62,78 h30 M120,92 h50" stroke="#c0392b" stroke-width="2.4" stroke-linecap="round"/>`;
      bg += R(110, 0, 100, 6, '#eef6ff') + `<rect x="110" y="0" width="100" height="6" fill="#fff">${fade('1;.85;1', 5)}</rect>`;
    }
    bg += dim(tod, kind === 'lib' ? .15 : .28);
    // 스탠드 불빛 (도서관·집 밤)
    let lamp = '';
    if (kind === 'lib' || (kind === 'home' && d)) {
      const lx = kind === 'lib' ? 248 : 236;
      lamp = `<defs><radialGradient id="al${uid}" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".75"/><stop offset="1" stop-color="#ffe2a0" stop-opacity="0"/></radialGradient></defs>
        ${L(lx, 150, lx, 96, '#3a3a3a', 3)}${L(lx, 96, lx - 22, 84, '#3a3a3a', 3)}<path d="M${lx - 36},90 L${lx - 28},76 L${lx - 14},80 L${lx - 16},94 Z" fill="#2f3b4c"/>
        <path d="M${lx - 34},92 L${lx - 16},94 L${lx - 20 + 40},152 L${lx - 120},152 Z" fill="url(#al${uid})">${fade('1;.92;1;.96;1', 6)}</path>`;
    }
    const cx = 160, hy = 82, top = 150;
    // 머리 끄덕임 + 쓰는 손
    const head = rot(cx, hy + 12, [0, 4, 0, -2, 0, 3, 0], mode === 'read' ? 6 : 4.5);
    const fig = `<g>${frontBust(cx, hy, c, ctx, head)}${L(cx - 13, hy + 22, cx - 30, 128, c, 10)}${L(cx + 13, hy + 22, cx + 30, 128, c, 10)}</g>`;
    const desk = R(28, top, 264, 8, kind === 'class' ? '#b9c3c9' : d ? '#6e5038' : '#c49a6c', 2) + R(34, top + 8, 252, 50, kind === 'class' ? '#9aa5ad' : d ? '#4b3626' : '#a67c52');
    let onDesk = `<path d="M${cx - 34},${top - 3} L${cx},${top - 1} L${cx},${top + 6} L${cx - 36},${top + 4} Z" fill="#fbfaf4"/><path d="M${cx + 34},${top - 3} L${cx},${top - 1} L${cx},${top + 6} L${cx + 36},${top + 4} Z" fill="#f1efe6"/>
      <path d="M${cx - 30},${top + 1} h22 M${cx - 30},${top + 3} h20 M${cx + 8},${top + 1} h22 M${cx + 8},${top + 3} h18" stroke="#b9b6aa" stroke-width=".8"/>`;
    if (mode === 'read') onDesk += `<g transform="translate(${cx} 0)"><path d="M0,${top - 1} L32,${top - 3} L34,${top + 4} L0,${top + 6} Z" fill="#fffef8" stroke="#ddd" stroke-width=".5">${RM ? '' : `<animateTransform attributeName="transform" type="scale" values="1 1;1 1;-1 1;-1 1" keyTimes="0;.72;.86;1" dur="3.6s" repeatCount="indefinite" additive="sum"/>`}${fade('0;0;1;1;0', 3.6)}</path></g>`;
    if (kind === 'cafe') onDesk += R(232, top - 18, 16, 18, '#f4f1ea', 3) + `<path d="M248,${top - 14} q7,0 7,6 q0,6 -7,6" fill="none" stroke="#f4f1ea" stroke-width="2.5"/>` + steam(240, top - 22);
    if (kind === 'lib' || kind === 'home') onDesk += R(78, top - 22, 30, 7, '#3b6ea5', 1) + R(80, top - 15, 26, 7, '#a54a3b', 1) + R(76, top - 8, 32, 8, '#e0b84a', 1);
    // 팔뚝(책상 위): 왼손은 책 누르고, 오른손은 펜으로 씀 / 독서면 페이지 넘김
    const pen = mode === 'read' ? '' : L(cx + 16, top - 6, cx + 24, top - 18, '#1c2230', 3);
    const rh = mode === 'read' ? mov(['0 0', '0 0', '10 -2', '0 0'], 3.6) : mov(['0 0', '4 1', '-1 0', '5 -1', '1 1', '0 0'], 1.1);
    const fore = `${L(cx - 30, 128, cx - 14, top - 4, c, 10)}<g>${rh}${L(cx + 30, 128, cx + 14, top - 4, c, 10)}${pen}</g>`;
    return bg + lamp + fig + desk + onDesk + fore;
  }
  const steam = (x, y) => [0, 1, 2].map(i => `<path d="M${x + i * 5},${y} q-4,-6 0,-12 q4,-6 0,-12" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0">${RM ? '' : `<animate attributeName="opacity" values="0;.7;0" dur="2.4s" begin="${-i * .8}s" repeatCount="indefinite"/>`}${mov(['0 0', '0 -8'], 2.4, -i * .8, true)}</path>`).join('');

  // 바깥 (산책·조깅·봉사): 뒤 배경이 흘러가고 아이콘맨은 제자리 걸음
  function outdoorScene(ctx, mode) {
    const tod = ctx.tod, d = dark(tod), [c, cb] = pcol(d), sky = `as${uid}`;
    const park = ['park', 'quad', 'playground'].includes(ctx.place);
    CLIP = `ac${uid}`;
    let o = `<defs>${skyDef(sky, tod, ctx.weather)}<clipPath id="${CLIP}"><rect width="${W}" height="${H}"/></clipPath></defs>${R(0, 0, W, H, `url(#${sky})`)}${skyBits(0, 0, W, 120, tod, ctx.weather)}`;
    const T = mode === 'run' ? .62 : 1.1, far = mode === 'run' ? 16 : 30, near = mode === 'run' ? 3.2 : 6.5;
    // 먼 층: 언덕 or 도시
    const farTile = (dx) => park ? `<path d="M${dx},128 Q${dx + 60},92 ${dx + 120},120 T${dx + 240},112 T${dx + 320},126 V200 H${dx} Z" fill="${d ? '#16261f' : '#8cc49a'}"/>` : skyline(dx, 132, 320, tod, ctx.region);
    seed = 7 + (ctx.dayN || 0) % 50;
    const f1 = farTile(0); seed = 7 + (ctx.dayN || 0) % 50; const f2 = farTile(320);
    o += `<g>${mov(['0 0', '-320 0'], far, 0, true)}${f1}${f2}</g>`;
    o += R(0, 150, W, 50, park ? (d ? '#1d2e22' : '#7dbb6e') : (d ? '#23262e' : '#9da3ab'));
    o += R(0, 156, W, 16, park ? (d ? '#3a3328' : '#d9c39a') : (d ? '#3a3d46' : '#c8ccd2'));   // 길
    // 가까운 층: 나무·가로등·벤치 / 전봇대·가게
    const nearTile = dx => {
      let t = '';
      if (park) {
        for (const tx of [30, 140, 250]) t += R(dx + tx - 3, 104, 6, 48, d ? '#2a1e16' : '#7a5236') + C(dx + tx, 96, 22, d ? '#1b3324' : '#3f8a4c') + C(dx + tx - 14, 108, 14, d ? '#1b3324' : '#4f9a5a') + C(dx + tx + 14, 106, 15, d ? '#1b3324' : '#4a9455');
        t += L(dx + 200, 152, dx + 200, 92, d ? '#555' : '#4a4f57', 3) + C(dx + 200, 90, 5, d ? '#ffe7a3' : '#eee') + (d ? C(dx + 200, 92, 22, '#ffe7a3', ' opacity=".18"') : '');
        t += R(dx + 80, 140, 34, 4, '#8a5a34') + L(dx + 84, 144, dx + 84, 152, '#555', 2) + L(dx + 110, 144, dx + 110, 152, '#555', 2) + R(dx + 80, 132, 34, 3, '#8a5a34');
      } else {
        for (const [bx, bw, col] of [[0, 80, '#d8c7b0'], [86, 70, '#b9c8d6'], [162, 90, '#e2d2c0'], [258, 62, '#c8b8d6']]) {
          t += R(dx + bx, 70, bw, 82, d ? '#2a2e3a' : col) + R(dx + bx, 66, bw, 6, d ? '#202430' : '#8a7a6a');
          for (let wy = 80; wy < 130; wy += 18) for (let wx = bx + 8; wx < bx + bw - 12; wx += 18) t += R(dx + wx, wy, 10, 10, d ? (rnd() < .6 ? '#ffd27a' : '#1a1e28') : '#eef4fa', 1);
          t += R(dx + bx + bw / 2 - 8, 132, 16, 20, d ? '#151820' : '#6b5a4a');
        }
        t += L(dx + 150, 152, dx + 150, 60, d ? '#555' : '#6a6a6a', 4) + L(dx + 138, 66, dx + 162, 66, d ? '#555' : '#6a6a6a', 3) + `<path d="M${dx + 150},64 Q${dx + 240},74 ${dx + 330},64" stroke="#333" fill="none" stroke-width="1"/>`;
      }
      return t;
    };
    seed = 3; const n1 = nearTile(0); seed = 3; const n2 = nearTile(320);
    o += `<g>${mov(['0 0', '-320 0'], near, 0, true)}${n1}${n2}</g>`;
    o += precip(0, 0, W, H, ctx.weather) + dim(tod, .2);
    o += `<ellipse cx="152" cy="${172}" rx="18" ry="3" fill="#000" opacity=".2"/>`;
    o += sideWalker(150, 130, { col: [c, cb], T, sw: mode === 'run' ? 34 : 24, run: mode === 'run', carry: mode === 'carry', ctx });
    return o;
  }

  // 헬스장: 러닝머신(옆) 또는 덤벨 프레스(정면)
  function gymScene(ctx) {
    const tod = ctx.tod, [c, cb] = pcol(true);
    let o = R(0, 0, W, H, '#2a2e36') + windowView(20, 14, 280, 78, ctx, { frame: '#15171c', hbar: false, bars: true }) + R(0, 92, W, 108, '#33373f') + R(0, 92, W, 3, '#555b66');
    o += R(0, 168, W, 32, '#1e2025');
    if ((ctx.dayN || 0) % 2 === 0) {   // 러닝머신
      o += R(70, 160, 170, 12, '#15171b', 6) + `<g clip-path="url(#ab${uid})"><defs><clipPath id="ab${uid}"><rect x="76" y="160" width="158" height="5"/></clipPath></defs><g>${mov(['0 0', '-20 0'], .25, 0, true)}${Array.from({ length: 12 }, (_, i) => R(76 + i * 20, 160, 10, 5, '#3a3f48')).join('')}</g></g>`;
      o += L(236, 166, 252, 92, '#9aa3ad', 5) + R(238, 82, 30, 14, '#22262d', 3) + `<rect x="242" y="86" width="22" height="6" fill="#4be08a">${fade('1;.6;1', 1.2)}</rect>` + L(206, 108, 246, 104, '#9aa3ad', 4);
      o += sideWalker(150, 119, { col: [c, cb], T: .62, sw: 34, run: true, ctx });
    } else {   // 덤벨 숄더 프레스
      o += R(120, 150, 80, 10, '#4a4f5a', 3) + L(130, 160, 130, 172, '#666', 4) + L(190, 160, 190, 172, '#666', 4);
      for (let i = 0; i < 5; i++) o += R(16, 112 + i * 11, 34, 6, '#555', 3) + C(18, 115 + i * 11, 5, '#2a2a2a') + C(48, 115 + i * 11, 5, '#2a2a2a');
      const cx = 160, sy = 96, T = 1.6;
      const armL = `<g>${rot(cx - 16, sy, [0, 62, 62, 0, 0], T)}${L(cx - 16, sy, cx - 38, sy, c, 10)}<g>${rot(cx - 38, sy, [0, -62, -62, 0, 0], T)}${L(cx - 38, sy, cx - 38, sy - 22, c, 10)}${R(cx - 50, sy - 30, 24, 6, '#111', 2)}${R(cx - 52, sy - 34, 6, 14, '#111', 2)}${R(cx - 30, sy - 34, 6, 14, '#111', 2)}</g></g>`;
      const armR = `<g>${rot(cx + 16, sy, [0, -62, -62, 0, 0], T)}${L(cx + 16, sy, cx + 38, sy, c, 10)}<g>${rot(cx + 38, sy, [0, 62, 62, 0, 0], T)}${L(cx + 38, sy, cx + 38, sy - 22, c, 10)}${R(cx + 26, sy - 30, 24, 6, '#111', 2)}${R(cx + 24, sy - 34, 6, 14, '#111', 2)}${R(cx + 46, sy - 34, 6, 14, '#111', 2)}</g></g>`;
      o += `${L(cx - 9, 140, cx - 14, 168, c, 11)}${L(cx + 9, 140, cx + 14, 168, c, 11)}${hairOf(ctx, cx + 3, 76, c)}${C(cx, 76, 12, c)}${R(cx - 17, 90, 34, 54, c, 14)}${armL}${armR}`;
    }
    return o;
  }

  // 놀이터: 점프 + 공 + 그네
  function playScene(ctx) {
    const tod = ctx.tod, d = dark(tod), [c] = pcol(d), sky = `as${uid}`;
    CLIP = `ac${uid}`;
    let o = `<defs>${skyDef(sky, tod, ctx.weather)}<clipPath id="${CLIP}"><rect width="${W}" height="${H}"/></clipPath></defs>${R(0, 0, W, H, `url(#${sky})`)}${skyBits(0, 0, W, 110, tod, ctx.weather)}`;
    o += R(0, 150, W, 50, d ? '#2e2a22' : '#e3cf9a');
    o += `<path d="M30,150 L30,70 L80,70 L80,150 M30,70 L55,52 L80,70" fill="none" stroke="${d ? '#6a4a4a' : '#e2574c'}" stroke-width="5"/><path d="M80,80 Q120,90 128,150" fill="none" stroke="${d ? '#4a5a7a' : '#4aa3df'}" stroke-width="9" stroke-linecap="round"/>`;
    o += `<path d="M220,150 L236,70 L292,70 L306,150" fill="none" stroke="${d ? '#555' : '#7a7f88'}" stroke-width="4"/><g>${rot(264, 70, [-22, 22, -22], 2.2)}${L(258, 70, 258, 124, '#888', 1.5)}${L(270, 70, 270, 124, '#888', 1.5)}${R(254, 124, 20, 5, d ? '#8a6a3a' : '#f2b43a', 2)}</g>`;
    const cx = 160, hy = 96;
    o += `<g>${mov(['0 0', '0 -16', '0 0'], .8)}${hairOf(ctx, cx + 3, hy - 4, c)}${C(cx, hy, 12, c)}${R(cx - 13, hy + 13, 26, 38, c, 12)}
      <g>${rot(cx - 10, hy + 18, [30, 150, 30], .8)}${L(cx - 10, hy + 18, cx - 10, hy + 42, c, 9)}</g><g>${rot(cx + 10, hy + 18, [-30, -150, -30], .8)}${L(cx + 10, hy + 18, cx + 10, hy + 42, c, 9)}</g>
      <g>${rot(cx - 6, hy + 50, [8, 22, 8], .8)}${L(cx - 6, hy + 50, cx - 8, hy + 74, c, 10)}</g><g>${rot(cx + 6, hy + 50, [-8, -22, -8], .8)}${L(cx + 6, hy + 50, cx + 8, hy + 74, c, 10)}</g></g>`;
    o += `<g>${mov(['0 0', '0 -40', '0 0'], .8, -.4)}${C(196, 162, 8, '#e94b3c')}${L(190, 158, 202, 166, '#fff', 1.5)}</g>`;
    return o + precip(0, 0, W, H, ctx.weather) + dim(tod, .2);
  }

  // 게임: 뒤에서 본 모습 — 모니터 화면이 번쩍
  function gameScene(ctx) {
    const tod = ctx.tod, pc = ctx.place === 'pcbang', [c] = pcol(true);
    let o = R(0, 0, W, H, pc ? '#12131c' : dark(tod) ? '#2c2738' : '#dccfbe');
    if (pc) { for (const sx of [8, 250]) for (let i = 0; i < 2; i++) o += R(sx + i * 34, 70, 28, 22, '#0d1020', 2, ' stroke="#2c3350"') + `<rect x="${sx + i * 34 + 2}" y="72" width="24" height="18" fill="${['#2f7fff', '#ff4fa3', '#3cdc8c'][(i + sx) % 3]}" opacity=".7">${fade('.8;.4;.9;.6;.8', 1.5 + i)}</rect>`; o += `<text x="160" y="24" text-anchor="middle" font-size="16" font-weight="800" fill="#ff4fd8" font-family="sans-serif" opacity=".9">PC${fade('1;.6;1;1;.4;1', 3)}</text>`; }
    else o += windowView(232, 18, 70, 60, ctx, { frame: '#efe6d8', hbar: false }) + R(20, 30, 36, 48, '#6f8fbf', 2, ' opacity=".7"');
    // 모니터
    o += R(78, 34, 164, 96, '#0b0d14', 6) + `<defs><clipPath id="ag${uid}"><rect x="84" y="40" width="152" height="84"/></clipPath></defs><g clip-path="url(#ag${uid})">${R(84, 40, 152, 84, '#16224a')}
      <rect x="84" y="40" width="152" height="84" fill="#2c4cff" opacity=".2">${fade('.2;.5;.15;.35;.2', 1.3)}</rect>${R(84, 104, 152, 20, '#24395e')}
      <g>${mov(['0 0', '40 0', '10 0', '60 0', '0 0'], 2.6)}${R(110, 88, 10, 16, '#ffd34a', 2)}${C(115, 84, 5, '#ffd34a')}</g>
      <g>${mov(['0 0', '-30 0', '0 0'], 1.8)}${R(196, 86, 14, 18, '#ff5a5a', 3)}</g>
      <text x="170" y="74" font-size="12" font-weight="800" fill="#fff" font-family="sans-serif" opacity="0">HIT!${fade('0;0;1;0;0', 1.3)}</text>
      ${R(92, 46, 50, 5, '#333')}<rect x="92" y="46" width="44" height="5" fill="#4be08a">${RM ? '' : '<animate attributeName="width" values="44;30;40;22;44" dur="4s" repeatCount="indefinite"/>'}</rect></g>`;
    o += R(150, 130, 20, 10, '#222') + R(40, 140, 240, 8, pc ? '#26283a' : '#8a6a4a', 2) + R(40, 148, 240, 52, pc ? '#191a28' : '#6a4f36');
    if (dark(tod) || pc) o += `<ellipse cx="160" cy="96" rx="120" ry="70" fill="#5a7cff" opacity=".12">${fade('.12;.22;.1;.18;.12', 1.3)}</ellipse>`;
    // 아이콘맨 뒷모습 + 의자 + 헤드셋
    const cx = 160, hy = 118;
    o += R(cx - 30, 128, 60, 72, '#20232c', 14) + `<g>${rot(cx, hy + 12, [0, -3, 2, 0], 2.2)}${hairOf({ gender: ctx.gender }, cx, hy + 5, c)}${C(cx, hy, 13, c)}<path d="M${cx - 15},${hy} a15,15 0 0 1 30,0" fill="none" stroke="#e33" stroke-width="3"/>${R(cx - 18, hy - 4, 6, 12, '#e33', 3)}${R(cx + 12, hy - 4, 6, 12, '#e33', 3)}</g>`;
    o += R(cx - 20, hy + 14, 40, 60, c, 14);
    o += `<g>${mov(['0 0', '1 -1', '0 0', '-1 0', '0 0'], .35)}${L(cx - 18, hy + 22, cx - 34, hy + 30, c, 10)}</g><g>${mov(['0 0', '-2 -1', '1 0', '0 0'], .5)}${L(cx + 18, hy + 22, cx + 36, hy + 26, c, 10)}</g>`;
    return o;
  }

  // 쉬기: 집이면 소파에 누움, 바깥이면 잔디밭에 누움. Z가 떠오름
  function restScene(ctx) {
    const tod = ctx.tod, out = OUT.includes(ctx.place), d = dark(tod), [c] = pcol(d), sky = `as${uid}`;
    let o;
    if (out) { CLIP = `ac${uid}`; o = `<defs>${skyDef(sky, tod, ctx.weather)}<clipPath id="${CLIP}"><rect width="${W}" height="${H}"/></clipPath></defs>${R(0, 0, W, H, `url(#${sky})`)}${skyBits(0, 0, W, 120, tod, ctx.weather)}${R(0, 140, W, 60, d ? '#1d2e22' : '#78b86a')}` + precip(0, 0, W, H, ctx.weather); }
    else o = R(0, 0, W, H, d ? '#3a3448' : '#efe1cc') + windowView(40, 18, 96, 74, ctx, { frame: '#f4efe6', hbar: false }) + R(214, 50, 70, 42, '#1d1f26', 3) + `<rect x="218" y="54" width="62" height="34" fill="#6a8cff" opacity="${d ? .6 : .25}">${fade('.6;.35;.55;.4;.6', 2)}</rect>` + R(246, 92, 6, 14, '#333') + R(0, 160, W, 40, d ? '#2a2432' : '#c9a882');
    if (!out) o += R(46, 118, 228, 40, d ? '#4a3a5e' : '#5f7fa3', 10) + R(40, 104, 24, 52, d ? '#3f3152' : '#4f6f93', 9) + R(256, 104, 24, 52, d ? '#3f3152' : '#4f6f93', 9) + R(70, 112, 180, 10, d ? '#55456a' : '#6f8fb3', 5);
    const y = out ? 150 : 110;
    o += `<g>${hairOf(ctx, 84, y - 4, c)}${C(88, y, 12, c)}<g>${RM ? '' : `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.5;0 0" dur="3.2s" repeatCount="indefinite"/>`}${L(104, y + 2, 160, y + 2, c, 15)}${L(120, y - 2, 146, y - 6, c, 9)}</g>${L(160, y + 2, 186, y - 10, c, 11)}${L(186, y - 10, 214, y + 2, c, 10)}${L(214, y + 2, 222, y - 4, c, 8)}</g>`;
    o += [0, 1, 2].map(i => `<text x="${100 + i * 8}" y="${y - 18 - i * 8}" font-size="${10 + i * 3}" font-weight="800" fill="${d ? '#dfe6ff' : '#4a5a7a'}" font-family="sans-serif" opacity="0">z${RM ? '' : `<animate attributeName="opacity" values="0;1;0" dur="3s" begin="${-i}s" repeatCount="indefinite"/>`}${mov(['0 0', '10 -16'], 3, -i, true)}</text>`).join('');
    return o + dim(tod, .25);
  }
  const OUT = ['park', 'quad', 'playground', 'block', 'campus'];

  // 예술: 이젤 앞에서 붓질
  function artScene(ctx) {
    const tod = ctx.tod, d = dark(tod), [c, cb] = pcol(d);
    let o = R(0, 0, W, H, d ? '#2f2b3a' : '#f1e9dc') + windowView(20, 20, 90, 80, ctx, { frame: '#efe6d8', hbar: false }) + R(0, 160, W, 40, d ? '#2a2632' : '#cdb79a') + dim(tod, .2);
    o += L(214, 168, 230, 70, '#7a5236', 4) + L(262, 168, 246, 70, '#7a5236', 4) + L(238, 168, 238, 90, '#7a5236', 3);
    o += R(206, 66, 64, 70, '#fffdf6', 2, ' stroke="#bba" stroke-width="2"') + C(226, 92, 12, '#f2a65a', ' opacity=".85"') + C(246, 108, 14, '#4aa3df', ' opacity=".8"') + `<path d="M214,124 Q236,110 262,126" stroke="#3aa76d" stroke-width="5" fill="none" opacity=".85"/>`;
    o += `<circle cx="234" cy="100" r="0" fill="#e94b3c">${RM ? '' : '<animate attributeName="r" values="0;0;6;6" keyTimes="0;.5;.8;1" dur="6s" repeatCount="indefinite"/>'}</circle>`;
    const x = 160, y = 122;
    o += `${L(x - 4, y, x - 8, y + 41, cb, 11)}${L(x + 4, y, x + 6, y + 41, c, 11)}${L(x, y - 42, x, y - 3, c, 15)}${hairOf(ctx, x + 2, y - 57, c)}${C(x + 2, y - 57, 10, c)}`;
    o += `<g transform="rotate(-40 ${x} ${y - 36})">${L(x, y - 36, x, y - 18, cb, 9)}${L(x, y - 18, x + 14, y - 10, cb, 9)}</g><ellipse cx="${x + 2}" cy="${y - 22}" rx="12" ry="7" fill="#d9b98a"/>${C(x - 4, y - 24, 2, '#e33') + C(x + 3, y - 26, 2, '#36c') + C(x + 8, y - 21, 2, '#3a6')}`;
    o += `<g transform="rotate(-70 ${x} ${y - 36})">${rot(x, y - 36, [0, -14, 6, -8, 0], 1.6)}${L(x, y - 36, x, y - 16, c, 9)}<g transform="rotate(-20 ${x} ${y - 16})">${L(x, y - 16, x, y + 2, c, 9)}${L(x, y + 2, x, y + 18, '#7a5236', 2.5)}${C(x, y + 19, 2.5, '#e94b3c')}</g></g>`;
    return o;
  }

  // 만들기: 작업대 망치질
  function makeScene(ctx) {
    const tod = ctx.tod, d = dark(tod), [c] = pcol(d);
    let o = R(0, 0, W, H, d ? '#2e2a26' : '#d8cdbd') + R(30, 16, 260, 78, d ? '#3a3026' : '#b89a72', 3);
    for (let y = 24; y < 90; y += 10) for (let x = 38; x < 286; x += 10) o += C(x, y, 1.2, d ? '#2a2018' : '#8a6f50');
    o += `<path d="M60,30 v40 M54,30 h12 M100,34 l24,24 M118,34 l-14,32 M220,30 v34 M212,64 h16 M256,30 q10,20 0,40" stroke="${d ? '#8a8f98' : '#4a4f57'}" stroke-width="4" fill="none" stroke-linecap="round"/>` + dim(tod, .2);
    const cx = 160, hy = 74;
    o += frontBust(cx, hy, c, ctx) + L(cx - 13, hy + 22, cx - 34, hy + 52, c, 10) + L(cx - 34, hy + 52, cx - 16, hy + 64, c, 10);
    o += R(20, 140, 280, 10, d ? '#6e5038' : '#b07a4a', 2) + R(26, 150, 268, 50, d ? '#4b3626' : '#8a5a34');
    o += R(110, 128, 90, 12, '#d9b98a', 2) + `<path d="M150,128 v-6 h4 v6" fill="#888"/>`;
    o += `<g>${rot(cx + 13, hy + 22, [0, -80, 0, 0], .7)}${L(cx + 13, hy + 22, cx + 30, hy + 44, c, 10)}${L(cx + 30, hy + 44, cx + 2, hy + 50, c, 10)}${L(cx + 2, hy + 50, cx - 8, hy + 40, '#7a5236', 4)}${R(cx - 16, hy + 34, 14, 8, '#666', 2, ` transform="rotate(30 ${cx - 8} ${hy + 38})"`)}</g>`;
    o += `<g opacity="0">${fade('0;0;0;1;0', .7)}<path d="M146,118 l-6,-6 M152,114 v-8 M158,118 l6,-6" stroke="#ffd34a" stroke-width="2.5" stroke-linecap="round"/></g>`;
    return o;
  }

  // 카페 커피: 옆모습으로 앉아 컵을 들어 마심, 김이 오름
  function coffeeScene(ctx) {
    const tod = ctx.tod, d = dark(tod), [c, cb] = pcol(d);
    let o = R(0, 0, W, H, d ? '#3d2a22' : '#8a5a44') + windowView(14, 14, 292, 100, ctx, { frame: '#2b1d16', hbar: false });
    for (const lx of [60, 260]) o += L(lx, 0, lx, 24, '#222', 1.5) + `<path d="M${lx - 12},34 Q${lx},16 ${lx + 12},34 Z" fill="#2b2b2b"/><ellipse cx="${lx}" cy="36" rx="20" ry="6" fill="#ffd27a" opacity="${d ? .55 : .25}"/>`;
    o += R(0, 150, W, 50, d ? '#2a1d17' : '#6b4532') + dim(tod, .12);
    o += R(150, 120, 74, 6, '#efe6d8', 2) + L(187, 126, 187, 174, '#444', 4) + L(172, 174, 202, 174, '#444', 4) + R(196, 110, 16, 10, '#c49a6c', 2);
    o += R(108, 128, 40, 6, '#2b2b2b', 2) + L(112, 134, 112, 172, '#2b2b2b', 4) + L(144, 134, 144, 172, '#2b2b2b', 4) + L(110, 128, 104, 86, '#2b2b2b', 5);
    const x = 128, y = 126;
    o += `${L(x, y, x + 26, y, cb, 11)}${L(x + 26, y, x + 26, y + 40, cb, 10)}${L(x, y, x + 24, y + 2, c, 11)}${L(x + 24, y + 2, x + 28, y + 42, c, 10)}${L(x + 28, y + 42, x + 36, y + 42, c, 8)}`;
    o += `${L(x + 2, y - 40, x, y - 2, c, 15)}${hairOf(ctx, x + 5, y - 55, c)}${C(x + 5, y - 55, 10, c)}`;
    o += `${L(x + 2, y - 36, x + 16, y - 20, cb, 9)}${L(x + 16, y - 20, x + 34, y - 18, cb, 9)}`;
    // 컵 든 팔: 테이블 → 입
    o += `<g>${rot(x + 2, y - 36, [0, 0, -38, -38, 0], 4.2)}${L(x + 2, y - 36, x + 18, y - 18, c, 9)}<g>${rot(x + 18, y - 18, [0, 0, -62, -62, 0], 4.2)}${L(x + 18, y - 18, x + 40, y - 12, c, 9)}${R(x + 38, y - 18, 10, 12, '#f4f1ea', 2)}${steam(x + 39, y - 20)}</g></g>`;
    return o;
  }

  // 기도: 스테인드글라스 빛 + 손 모음
  function prayScene(ctx) {
    const tod = ctx.tod, d = dark(tod), [c] = pcol(true);
    let o = R(0, 0, W, H, '#2a2530');
    o += `<path d="M120,120 V50 a40,40 0 0 1 80,0 V120 Z" fill="#1a1622"/>`;
    const cols = ['#e94b3c', '#f2b43a', '#4aa3df', '#3aa76d', '#9b59b6', '#f27ab0'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o += R(126 + i * 17, 34 + j * 21, 15, 19, cols[(i + j * 2) % 6], 1, ` opacity="${d ? .5 : .85}"`);
    o += `<path d="M120,120 V50 a40,40 0 0 1 80,0 V120 Z" fill="none" stroke="#5a4a3a" stroke-width="5"/>`;
    o += `<path d="M126,120 L194,120 L250,200 L70,200 Z" fill="#fff4c8" opacity=".12">${fade('.08;.18;.08', 5)}</path>`;
    for (const px of [20, 250]) o += R(px, 130, 50, 10, '#4a3626', 2) + R(px + 2, 140, 46, 40, '#3a2a1e');
    const cx = 160, hy = 112;
    o += `<g>${rot(cx, hy + 12, [6, 9, 6], 4)}${hairOf(ctx, cx + 3, hy - 4, c)}${C(cx, hy, 12, c)}</g>${R(cx - 16, hy + 13, 32, 54, c, 14)}`;
    o += L(cx - 12, hy + 20, cx - 22, hy + 38, c, 9) + L(cx - 22, hy + 38, cx - 2, hy + 30, c, 9) + L(cx + 12, hy + 20, cx + 22, hy + 38, c, 9) + L(cx + 22, hy + 38, cx + 2, hy + 30, c, 9);
    o += R(90, 160, 140, 12, '#5a4030', 3) + R(94, 172, 132, 28, '#4a3626');
    return o;
  }

  // 공연: 무대 조명 + 관객 뒷모습, 내가 응원봉 흔듦
  function watchScene(ctx) {
    const [c] = pcol(true);
    let o = R(0, 0, W, H, '#0d0b18') + R(40, 30, 240, 60, '#1c1830', 4) + R(40, 86, 240, 6, '#3a3058');
    const beams = ['#ff4fa3', '#4fc3ff', '#ffe14f'];
    beams.forEach((b, i) => { const bx = 80 + i * 80; o += `<g>${rot(bx, 20, [-25, 25, -25], 3 + i)}<path d="M${bx - 4},20 L${bx + 4},20 L${bx + 30},150 L${bx - 30},150 Z" fill="${b}" opacity=".18"/></g>${C(bx, 20, 5, b)}`; });
    o += `<g>${mov(['0 0', '0 -3', '0 0'], .5)}${C(150, 62, 7, '#fff', ' opacity=".8"')}${R(144, 69, 12, 18, '#fff', 5, ' opacity=".8"')}</g>${C(184, 66, 6, '#fff', ' opacity=".6"')}${R(179, 72, 10, 15, '#fff', 4, ' opacity=".6"')}`;
    for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
      const x = 14 + i * 36 + row * 18, y = 132 + row * 30;
      if (row === 1 && i === 4) continue;
      o += `<g opacity="${row ? .95 : .7}">${mov(['0 0', '0 -3', '0 0'], .5, -rnd())}${C(x, y, 10, '#2a2640')}${R(x - 15, y + 10, 30, 40, '#2a2640', 12)}</g>`;
    }
    const x = 14 + 4 * 36 + 18, y = 162;
    o += `<g>${mov(['0 0', '0 -4', '0 0'], .5)}${hairOf(ctx, x, y - 3, c)}${C(x, y, 11, c)}${R(x - 16, y + 12, 32, 40, c, 13)}<g>${rot(x + 12, y + 16, [-150, -120, -150], .5)}${L(x + 12, y + 16, x + 12, y + 38, c, 9)}${L(x + 12, y + 38, x + 12, y + 54, '#7cf', 5)}</g></g>`;
    return o;
  }

  // 동아리: 기타 치기 + 음표
  function clubScene(ctx) {
    const tod = ctx.tod, d = dark(tod), [c] = pcol(d);
    let o = R(0, 0, W, H, d ? '#2b2836' : '#e6dccd') + R(20, 26, 40, 54, '#e94b3c', 2, ' opacity=".7"') + R(70, 34, 50, 36, '#4aa3df', 2, ' opacity=".6"') + R(238, 96, 56, 64, '#1d1d22', 4) + C(266, 120, 14, '#333') + C(266, 120, 8, '#111') + R(0, 160, W, 40, d ? '#26222e' : '#bca58a') + dim(tod, .2);
    const cx = 150, hy = 66;
    o += `${L(cx - 8, 128, cx - 14, 168, c, 11)}${L(cx + 8, 128, cx + 14, 168, c, 11)}<g>${rot(cx, hy + 12, [0, 6, 0, -4, 0], 1.2)}${hairOf(ctx, cx + 3, hy - 4, c)}${C(cx, hy, 12, c)}</g>${R(cx - 16, hy + 13, 32, 58, c, 14)}`;
    o += `<g transform="rotate(-24 ${cx} 112)"><ellipse cx="${cx + 10}" cy="114" rx="20" ry="16" fill="#c9762e"/><ellipse cx="${cx - 6}" cy="114" rx="14" ry="12" fill="#c9762e"/>${C(cx + 4, 114, 5, '#3a2210')}${R(cx + 26, 110, 58, 7, '#5a3a1e', 2)}${R(cx + 82, 107, 12, 13, '#3a2210', 2)}</g>`;
    o += L(cx - 12, hy + 20, cx - 22, hy + 42, c, 9) + `<g>${rot(cx - 22, hy + 42, [0, 14, 0], .45)}${L(cx - 22, hy + 42, cx + 4, hy + 48, c, 9)}</g>`;
    o += L(cx + 12, hy + 20, cx + 34, hy + 30, c, 9) + L(cx + 34, hy + 30, cx + 60, hy + 18, c, 9);
    o += [0, 1, 2].map(i => `<text x="${cx + 40 + i * 18}" y="${hy + 6}" font-size="16" fill="${d ? '#ffd34a' : '#e2574c'}" font-family="sans-serif" opacity="0">${i % 2 ? '♪' : '♫'}${RM ? '' : `<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${-i * .8}s" repeatCount="indefinite"/>`}${mov(['0 0', '12 -30'], 2.4, -i * .8, true)}</text>`).join('');
    return o;
  }

  function scene(id, ctx = {}) {
    uid++; seed = 11 + ((ctx.dayN || 0) * 31 + (ctx.hour || 0) * 7) % 997;
    ctx = Object.assign({ hour: 12, weather: 'sunny', region: 'kr', place: 'home' }, ctx);
    ctx.tod = todOf(ctx.hour);
    const p = ctx.place;
    const desk = mode => ['library', 'ulib'].includes(p) ? deskScene(ctx, 'lib', mode) : ['academy', 'school', 'lecture'].includes(p) ? deskScene(ctx, 'class', mode) : p === 'cafe' ? deskScene(ctx, 'cafe', mode) : deskScene(ctx, 'home', mode);
    const body = ({
      study: () => desk('write'), cram: () => deskScene(ctx, 'class', 'write'), read: () => desk('read'),
      walk: () => outdoorScene(ctx, 'walk'),
      exercise: () => p === 'gym' ? gymScene(ctx) : outdoorScene(ctx, 'run'),
      play: () => playScene(ctx), game: () => gameScene(ctx), rest: () => restScene(ctx),
      artPrac: () => artScene(ctx), make: () => makeScene(ctx), coffee: () => coffeeScene(ctx), pray: () => prayScene(ctx),
      volunteer: () => outdoorScene(Object.assign({}, ctx, { place: 'block' }), 'carry'), watch: () => watchScene(ctx), club: () => clubScene(ctx), uclub: () => clubScene(ctx),
    }[id] || (() => desk('write')))();
    return `<svg class="act-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="행동 장면">${body}</svg>`;
  }
  window.ActArt = { scene, todOf };
})();
