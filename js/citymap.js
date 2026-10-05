/* 도시 지도 배경 (SVG, 720×920) — 서울: 북한산·관악산·한강(여의도)·다리·한강공원·지하철 5개 노선·동네·학교·집들
   뉴욕: 허드슨강·이스트강·어퍼 베이·맨해튼 격자·센트럴 파크·다리·지하철·브루클린·퀸스·저지시티
   핀(장소 버튼)은 js/main.js가 이 그림 위에 올림 (data/map.js). 밤이면 CSS로 어둡게 */
(function () {
  const M = () => window.GAME_DATA.map;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pts = a => a.map(p => p.join(',')).join(' ');
  // 매끄러운 선 (캣멀-롬 → 베지어)
  function smooth(P) {
    let d = `M${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  }
  const label = (x, y, t, cls = 'cm-dong') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle">${t}</text>`;
  // 지하철: 노선 + 역 (환승역은 두 겹 동그라미) + 역 이름
  function subway(region) {
    const L = (M().subway || {})[region] || [];
    const lines = L.map(l => { const P = l.st.map(s => [s[1], s[2]]); if (l.loop) P.push(P[0]); return `<polyline points="${pts(P)}" fill="none" stroke="${l.color}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>`; }).join('');
    const seen = {};
    for (const l of L) for (const s of l.st) { const k = s[0]; (seen[k] = seen[k] || { x: s[1], y: s[2], n: 0, c: l.color }).n++; }
    const st = Object.entries(seen).map(([n, s]) => `<circle cx="${s.x}" cy="${s.y}" r="${s.n > 1 ? 5.5 : 4}" fill="#fff" stroke="${s.n > 1 ? '#333' : s.c}" stroke-width="${s.n > 1 ? 2 : 2.2}"/><text class="cm-st" x="${s.x + 7}" y="${s.y - 6}">${n}</text>`).join('');
    return lines + st;
  }
  // 아이 시설: 유치원(분홍) · 초(주황) · 중(파랑) · 고(보라)
  const KIDC = { kinder: ['#f27ab0', '유'], elem: ['#f2994a', '초'], mid: ['#4a90d9', '중'], high: ['#8e6bd1', '고'] };
  function kids(region) {
    return ((M().kids || {})[region] || []).map(([t, n, x, y]) => { const [c, ch] = KIDC[t] || KIDC.elem; return `<g class="cm-kid"><rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="4" fill="${c}" stroke="#fff" stroke-width="1.5"/><text x="${x}" y="${y + 3.5}" text-anchor="middle" class="cm-kc">${ch}</text><text class="cm-kn" x="${x}" y="${y + 17}" text-anchor="middle">${n}</text></g>`; }).join('');
  }
  // 동네마다 집들 (아파트 단지 · 빌라 · 주택 · 브라운스톤 · 고층) — 씨앗 고정
  function homes(region) {
    const D = (M().dongs || {})[region] || {}, R = ((window.GAME_DATA.realty || {})[region] || {}).dongs || [];
    let o = '';
    for (const [name, [x, y]] of Object.entries(D)) {
      const d = R.find(r => r.name === name) || {}, pref = (d.prefer || [])[0] || 'villa';
      seed = 13 + name.length * 31 + x;
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2, r = 16 + rnd() * 30, hx = x + Math.cos(a) * r, hy = y + Math.sin(a) * r * .8;
        if (pref === 'apt') o += `<rect x="${(hx - 5).toFixed(1)}" y="${(hy - 9).toFixed(1)}" width="10" height="16" rx="1" fill="#d8dce6" stroke="#aab0c0" stroke-width=".8"/><path d="M${(hx - 3).toFixed(1)},${(hy - 5).toFixed(1)} h6 M${(hx - 3).toFixed(1)},${(hy - 1).toFixed(1)} h6 M${(hx - 3).toFixed(1)},${(hy + 3).toFixed(1)} h6" stroke="#9aa3b5" stroke-width=".8"/>`;
        else if (pref === 'house') o += `<path d="M${(hx - 6).toFixed(1)},${(hy).toFixed(1)} l6,-6 l6,6 v6 h-12 Z" fill="#e9d2b4" stroke="#b89a74" stroke-width=".8"/>`;
        else if (pref === 'officetel') o += `<rect x="${(hx - 4).toFixed(1)}" y="${(hy - 12).toFixed(1)}" width="8" height="20" fill="#cfd8e3" stroke="#9fb0c4" stroke-width=".8"/>`;
        else o += `<rect x="${(hx - 5).toFixed(1)}" y="${(hy - 5).toFixed(1)}" width="10" height="9" rx="1" fill="#e6ddd0" stroke="#bba98f" stroke-width=".8"/>`;
      }
      o += `<circle cx="${x}" cy="${y}" r="2.5" fill="#556"/>${label(x, y - 8, name)}`;
    }
    return o;
  }
  function districts(region) {
    return ((M().districts || {})[region] || []).map(d => label(d.x, d.y, d.label, 'cm-dl')).join('');
  }
  function seoul() {
    const W = M().water.kr, top = W.river.map(([x, y]) => [x, y - W.hw]), bot = W.river.map(([x, y]) => [x, y + W.hw]).reverse();
    const riverD = `${smooth(top)} L${bot[0][0]},${bot[0][1]} ${smooth(bot).slice(1)} Z`;
    const isl = W.islands.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#e7ecdf" stroke="#cfd8c4"/>`).join('');
    // 산: 북한산·인왕산(북), 관악산(남), 남산(가운데 — 타워)
    const hills = [[250, 0, 90, 70], [360, 0, 120, 92], [470, 0, 80, 60], [200, 920, 70, 60], [300, 920, 90, 80]].map(([x, y, w, h]) => `<path d="M${x - w},${y} Q${x},${y + (y ? -h * 2 : h * 2)} ${x + w},${y} Z" fill="#b9d6a8" opacity=".75"/>`).join('')
      + `<ellipse cx="385" cy="410" rx="30" ry="20" fill="#b9d6a8" opacity=".85"/><rect x="383" y="388" width="4" height="16" fill="#9aa"/><circle cx="385" cy="388" r="4" fill="#eee" stroke="#888"/>`;
    // 큰 공원: 올림픽공원 · 서울숲 · 한강공원(강변 띠)
    const parks = `<ellipse cx="690" cy="600" rx="30" ry="22" fill="#a9d68f"/><ellipse cx="515" cy="448" rx="20" ry="12" fill="#a9d68f"/>
      <path d="${smooth(top.map(([x, y]) => [x, y - 8]))}" fill="none" stroke="#c4e3b0" stroke-width="12" opacity=".9"/><path d="${smooth(bot.slice().reverse().map(([x, y]) => [x, y + 8]))}" fill="none" stroke="#c4e3b0" stroke-width="12" opacity=".9"/>`;
    // 큰길: 강변북로·올림픽대로(강 따라) + 남북·동서 간선
    const roads = [smooth(top.map(([x, y]) => [x, y - 22])), smooth(bot.slice().reverse().map(([x, y]) => [x, y + 24])),
      'M0,300 C200,290 400,310 720,290', 'M0,700 C200,690 450,700 720,680', 'M0,190 C250,200 450,180 720,170', 'M0,820 C250,800 450,800 720,790',
      'M170,0 C175,300 160,600 180,920', 'M360,0 C350,300 380,600 380,920', 'M480,0 C500,300 470,600 480,920', 'M620,0 C610,300 640,600 630,920']
      .map(d => `<path d="${d}" fill="none" stroke="#fffaf0" stroke-width="7" stroke-linecap="round" opacity=".95"/>`).join('');
    // 다리 (강을 건너는 길)
    const bridges = [140, 215, 300, 400, 470, 560, 640].map(x => { const yc = W.river.reduce((a, p, i, A) => (p[0] <= x && A[i + 1] && A[i + 1][0] >= x) ? p[1] + (A[i + 1][1] - p[1]) * (x - p[0]) / (A[i + 1][0] - p[0]) : a, 480); return `<line x1="${x}" y1="${yc - W.hw - 6}" x2="${x + 4}" y2="${yc + W.hw + 6}" stroke="#d8d2c4" stroke-width="6"/><line x1="${x}" y1="${yc - W.hw - 6}" x2="${x + 4}" y2="${yc + W.hw + 6}" stroke="#a49b88" stroke-width="1" stroke-dasharray="3 3"/>`; }).join('');
    return `<rect width="720" height="920" fill="#eef1e6"/>${hills}${roads}
      <path d="${riverD}" fill="#8cc6ea"/><path d="${smooth(top)}" fill="none" stroke="#6fb0dc" stroke-width="1.5"/>${isl}${parks}${bridges}
      <text class="cm-river" x="420" y="${W.river[5][1] + 5}">${M().river.kr}</text>`;
  }
  function newYork() {
    const W = M().water.ny, man = W.manhattan;
    // 맨해튼 격자 (섬 모양으로 자름): 애비뉴는 섬 방향, 스트리트는 가로
    const grid = [];
    for (let i = -4; i < 14; i++) grid.push(`<line x1="${200 + i * 22}" y1="660" x2="${330 + i * 22}" y2="0" stroke="#fffaf0" stroke-width="2.6" opacity=".8"/>`);
    for (let j = 0; j < 40; j++) grid.push(`<line x1="150" y1="${j * 17 - 20}" x2="560" y2="${j * 17 + 40}" stroke="#fffaf0" stroke-width="1.3" opacity=".7"/>`);
    // 브루클린·퀸스 격자 (흐리게)
    const bq = [];
    for (let i = 0; i < 14; i++) bq.push(`<line x1="${300 + i * 34}" y1="920" x2="${400 + i * 34}" y2="200" stroke="#fffaf0" stroke-width="1.6" opacity=".55"/>`);
    for (let j = 0; j < 22; j++) bq.push(`<line x1="300" y1="${220 + j * 34}" x2="720" y2="${180 + j * 34}" stroke="#fffaf0" stroke-width="1.6" opacity=".55"/>`);
    // 다리: 조지 워싱턴(허드슨) · 퀸스보로 · 윌리엄스버그 · 맨해튼 · 브루클린
    const bridges = [[[338, 64], [382, 76]], [[436, 330], [482, 344]], [[392, 512], [436, 522]], [[338, 574], [372, 606]], [[300, 604], [330, 640]]]
      .map(([a, b]) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#c9c1ae" stroke-width="6"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7d7462" stroke-width="1" stroke-dasharray="3 3"/>`).join('');
    const water = W.polys.map(P => `<polygon points="${pts(P)}" fill="#7fb8de"/>`).join('');
    return `<rect width="720" height="920" fill="#eceae3"/>
      <defs><clipPath id="cmMan"><polygon points="${pts(man)}"/></clipPath></defs>
      <g opacity=".9">${bq.join('')}</g>
      <rect x="0" y="0" width="200" height="920" fill="#e6e3da"/>
      ${water}
      <polygon points="${pts(man)}" fill="#e4e1d8" stroke="#cfcab9" stroke-width="1.5"/>
      <g clip-path="url(#cmMan)">${grid.join('')}</g>
      <polygon points="${pts(W.park)}" fill="#9fcf8a" stroke="#86b874" stroke-width="1.5"/><ellipse cx="392" cy="236" rx="9" ry="14" fill="#8cc6ea" transform="rotate(14 392 236)"/>
      <ellipse cx="560" cy="520" rx="22" ry="14" fill="#a9d68f"/><ellipse cx="420" cy="760" rx="26" ry="20" fill="#a9d68f"/>
      ${bridges}
      <text class="cm-river" x="470" y="440" transform="rotate(-70 470 440)">${M().river.ny}</text><text class="cm-river" x="250" y="300" transform="rotate(-72 250 300)">허드슨강</text>`;
  }
  // 지도 배경 한 장 (region: 'kr' | 'ny')
  const cache = {};
  const inner = region => cache[region] || (cache[region] = `${region === 'ny' ? newYork() : seoul()}${districts(region)}${homes(region)}${subway(region)}${kids(region)}`);
  function svg(region) {
    const g = M();
    return `<svg class="cm-svg" viewBox="0 0 ${g.w} ${g.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${inner(region)}
      <g class="cm-n" transform="translate(30,32)"><circle r="14" fill="rgba(255,255,255,.8)"/><path d="M0,-10 L5,5 L0,1 L-5,5 Z" fill="#c0392b"/><text y="-15" text-anchor="middle">N</text></g></svg>`;
  }
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
  window.CityMap = { svg, inner, campusSvg };
})();
