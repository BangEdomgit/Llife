/* 도시 지도 배경 (SVG) — 서울: 북쪽 산·한강·다리·2호선 / 뉴욕: 맨해튼 격자·센트럴 파크·이스트강·브루클린 다리·지하철
   핀(장소 버튼)은 js/main.js가 이 그림 위에 올림 (data/map.js pos). 밤이면 CSS로 어둡게 */
(function () {
  const M = () => window.GAME_DATA.map;
  // 강: 왼쪽에서 오른쪽으로 살짝 굽이침 (y 255 근처, 폭 32)
  const RIVER_TOP = 'M-10,258 C60,246 120,274 180,262 C240,250 300,248 370,242';
  const RIVER_BOT = 'L370,274 C300,280 240,284 180,294 C120,306 60,278 -10,290 Z';
  function districts(region) {
    return (M().districts[region] || M().districts.kr).map(d =>
      `<ellipse cx="${d.cx}" cy="${d.cy}" rx="${d.rx}" ry="${d.ry}" fill="${d.color}" opacity=".42"/>` +
      `<text class="cm-dl" x="${d.cx}" y="${d.cy + 6}" text-anchor="middle">${d.label}</text>`).join('');
  }
  function seoul() {
    // 북쪽 산(북한산·인왕산) · 한강 · 다리 4개 · 큰길 · 2호선(초록 고리)
    const hills = [[-10, 40, 34], [40, 26, 30], [190, 30, 26], [236, 22, 34]].map(([x, h, w]) =>
      `<path d="M${x},0 L${x + w},${h} L${x + w * 2},0 Z" fill="#b9d6a8" opacity=".8"/>`).join('');
    const bridges = [70, 150, 230, 296].map(x => { const y1 = x < 180 ? 246 : 238, y2 = x < 180 ? 312 : 296; return `<line x1="${x}" y1="${y1}" x2="${x + 6}" y2="${y2}" stroke="#d8d2c4" stroke-width="5"/><line x1="${x}" y1="${y1}" x2="${x + 6}" y2="${y2}" stroke="#a49b88" stroke-width="1" stroke-dasharray="3 3"/>`; }).join('');
    const roads = ['M0,170 C90,160 200,150 360,128', 'M150,0 C150,120 160,200 150,460', 'M0,330 C120,330 240,320 360,300', 'M60,0 C80,150 90,300 70,460', 'M300,0 C290,150 300,300 320,460']
      .map(d => `<path d="${d}" fill="none" stroke="#fffaf0" stroke-width="7" stroke-linecap="round" opacity=".9"/>`).join('');
    const line2 = `<path d="M70,110 C70,60 260,40 300,90 C330,130 310,210 250,220 C200,228 150,320 128,360 C106,410 60,404 50,354 C40,290 70,180 70,110 Z" fill="none" stroke="#3cb44a" stroke-width="3" opacity=".75"/>`;
    return `<rect width="360" height="460" fill="#eef1e6"/>${hills}${roads}
      <path d="${RIVER_TOP} ${RIVER_BOT}" fill="#8cc6ea"/><path d="${RIVER_TOP}" fill="none" stroke="#6fb0dc" stroke-width="1.5"/>
      ${bridges}${line2}<text class="cm-river" x="190" y="280">${M().river.kr}</text>`;
  }
  function newYork() {
    // 강 위쪽은 맨해튼(비스듬한 격자·센트럴 파크), 아래는 브루클린·퀸스, 다리 2개, 지하철 노선(주황·파랑·초록)
    const grid = [];
    for (let i = -6; i < 16; i++) grid.push(`<line x1="${i * 28}" y1="0" x2="${i * 28 + 130}" y2="248" stroke="#fffaf0" stroke-width="2.4" opacity=".75"/>`);
    for (let j = 0; j < 14; j++) grid.push(`<line x1="-10" y1="${j * 18 + 10}" x2="370" y2="${j * 18 - 40}" stroke="#fffaf0" stroke-width="1.4" opacity=".6"/>`);
    const P = (M().posBy && M().posBy.ny && M().posBy.ny.park) || [98, 196];
    const park = `<rect x="${P[0] - 34}" y="${P[1] - 50}" width="68" height="78" rx="4" transform="rotate(29 ${P[0]} ${P[1]})" fill="#9fcf8a" stroke="#86b874" stroke-width="1.5"/><ellipse cx="${P[0] + 4}" cy="${P[1] - 14}" rx="10" ry="6" fill="#8cc6ea" transform="rotate(29 ${P[0]} ${P[1]})"/>`;
    const bridges = [[200, 'brooklyn'], [292, 'manhattan']].map(([x]) => `<path d="M${x},240 L${x + 14},306" stroke="#c9c1ae" stroke-width="5"/><path d="M${x - 3},254 Q${x + 7},264 ${x + 3},276 M${x + 4},274 Q${x + 14},284 ${x + 11},296" stroke="#7d7462" stroke-width="1" fill="none"/>`).join('');
    const subway = [['#ff6319', 'M40,0 L70,250 L60,320 L70,460'], ['#0039a6', 'M150,0 L190,250 L200,320 L176,460'], ['#00933c', 'M280,0 L300,246 L300,340 L330,460']]
      .map(([c, d]) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.6" opacity=".7"/>`).join('');
    const south = ['M0,340 L360,324', 'M0,410 L360,396', 'M110,276 L120,460', 'M260,270 L270,460'].map(d => `<path d="${d}" stroke="#fffaf0" stroke-width="5" opacity=".85"/>`).join('');
    return `<rect width="360" height="460" fill="#eceae3"/>
      <path d="M-10,0 L370,0 L370,242 C300,248 240,250 180,262 C120,274 60,246 -10,258 Z" fill="#e4e1d8"/>${grid.join('')}${park}${south}
      <path d="${RIVER_TOP} ${RIVER_BOT}" fill="#7fb8de"/><path d="${RIVER_TOP}" fill="none" stroke="#5f9fcc" stroke-width="1.5"/>
      ${bridges}${subway}<text class="cm-river" x="190" y="280">${M().river.ny}</text>`;
  }
  // 지도 배경 한 장 (region: 'kr' | 'ny')
  function svg(region) {
    const g = M();
    return `<svg class="cm-svg" viewBox="0 0 ${g.w} ${g.h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      ${region === 'ny' ? newYork() : seoul()}${districts(region)}
      <g class="cm-n" transform="translate(20,22)"><circle r="11" fill="rgba(255,255,255,.75)"/><path d="M0,-8 L4,4 L0,1 L-4,4 Z" fill="#c0392b"/><text y="-12" text-anchor="middle">N</text></g></svg>`;
  }
  const pos = (region, id) => { const g = M(), o = g.posBy && g.posBy[region]; return (o && o[id]) || g.pos[id] || null; };
  // 대학 캠퍼스 지도: 정문(아래) → 가운데 잔디 광장 → 양옆 강의동·도서관·학생식당·학생회관, 위쪽 동아리 건물. 길·나무·시계탑
  function campusSvg(univ) {
    const P = M().campus.pos, b = (id, w, h, c, roof) => { const [x, y] = P[id]; return `<rect x="${x - w / 2}" y="${y - h / 2 - 6}" width="${w}" height="${h}" rx="5" fill="${c}" stroke="rgba(0,0,0,.18)"/><rect x="${x - w / 2}" y="${y - h / 2 - 6}" width="${w}" height="9" rx="4" fill="${roof}"/>${[...Array(Math.floor(w / 16))].map((_, i) => `<rect x="${x - w / 2 + 7 + i * 16}" y="${y - h / 2 + 8}" width="8" height="7" rx="1" fill="rgba(255,255,255,.55)"/>`).join('')}`; };
    const trees = [[30, 120], [40, 260], [26, 400], [334, 130], [330, 260], [338, 400], [130, 400], [232, 400], [120, 120], [240, 120], [180, 160], [60, 60], [180, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#7cb86a"/><circle cx="${x - 4}" cy="${y - 4}" r="5" fill="#9bd087"/>`).join('');
    const [qx, qy] = P.quad, [gx, gy] = P.campus;
    return `<svg class="cm-svg" viewBox="0 0 360 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="360" height="460" fill="#dfe9d2"/>
      <path d="M${gx},460 L${gx},${qy} M${P.lecture[0]},${P.lecture[1]} L${qx},${qy} L${P.ulib[0]},${P.ulib[1]} M${P.cafeteria[0]},${P.cafeteria[1]} L${qx},${qy} L${P.union[0]},${P.union[1]} M${qx},${qy} L${P.clubroom[0]},${P.clubroom[1]}" stroke="#f3ead6" stroke-width="12" stroke-linecap="round" fill="none"/>
      <ellipse cx="${qx}" cy="${qy}" rx="66" ry="44" fill="#a9d68f" stroke="#93c57a"/><circle cx="${qx}" cy="${qy - 2}" r="9" fill="#cbb79a"/><rect x="${qx - 3}" y="${qy - 34}" width="6" height="30" fill="#b8a07a"/><circle cx="${qx}" cy="${qy - 36}" r="5" fill="#fff" stroke="#8a7350"/>
      ${trees}
      ${b('lecture', 96, 60, '#e9dcc6', '#b4553f')}${b('ulib', 96, 60, '#e4e0d6', '#4a6f9c')}${b('cafeteria', 84, 48, '#f1e2c4', '#d08a3c')}${b('union', 84, 48, '#e6dfcf', '#7b6aa8')}${b('clubroom', 76, 44, '#efe6d0', '#3f8f6b')}
      <path d="M${gx - 34},${gy + 12} L${gx - 34},${gy - 14} Q${gx},${gy - 34} ${gx + 34},${gy - 14} L${gx + 34},${gy + 12}" fill="none" stroke="#8b6f4e" stroke-width="7"/>
      <text class="cm-dl" x="180" y="34" text-anchor="middle">${univ || '캠퍼스'}</text></svg>`;
  }
  window.CityMap = { svg, pos, campusSvg };
})();
