// 지도 — 장소 위치(0~360 × 0~460)와 구역. 화면: js/citymap.js(배경 그림) + js/main.js(핀 버튼) / 이동 비용: js/game.js travelCost
//   어른: 같은 구역 안은 1~2, 다른 구역은 거리만큼 3~10 (1 ≈ 11분). 학교 다닐 땐 어디든 50 (한 주의 방과 후 반)
//   pos: [x, y] · 나라마다 위치를 덮어쓸 수 있음 (regions.ny.pos). 없는 장소(캠퍼스 안 등)는 지도에 안 나옴
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.map = {
  w: 360, h: 460,
  // 구역: 지도에 옅은 땅 색으로 깔리는 곳 (cx·cy·rx·ry 타원) — 이름은 나라마다
  districts: {
    kr: [
      { zone: 'school',   label: '학교 앞',   cx: 80,  cy: 96,  rx: 78, ry: 68, color: '#9fc6e8' },
      { zone: 'work',     label: '업무 지구', cx: 300, cy: 70,  rx: 56, ry: 50, color: '#b8b4dc' },
      { zone: 'downtown', label: '번화가',    cx: 240, cy: 166, rx: 100, ry: 66, color: '#f2b9c8' },
      { zone: 'home',     label: '우리 동네', cx: 82,  cy: 384, rx: 78, ry: 64, color: '#bfe0b0' },
      { zone: 'out',      label: '옆 동네', cx: 250, cy: 376, rx: 96, ry: 74, color: '#e8d9b0' },
    ],
    ny: [
      { zone: 'school',   label: '어퍼웨스트', cx: 80,  cy: 96,  rx: 78, ry: 68, color: '#9fc6e8' },
      { zone: 'work',     label: '월스트리트', cx: 300, cy: 70, rx: 56, ry: 50, color: '#b8b4dc' },
      { zone: 'downtown', label: '미드타운',   cx: 240, cy: 166, rx: 100, ry: 66, color: '#f2b9c8' },
      { zone: 'home',     label: '브루클린', cx: 82, cy: 384, rx: 78, ry: 64, color: '#bfe0b0' },
      { zone: 'out',      label: '퀸스',       cx: 250, cy: 376, rx: 96, ry: 74, color: '#e8d9b0' },
    ],
  },
  // 강 이름 (지도 가운데를 가로지름)
  river: { kr: '한강', ny: '이스트강' },
  pos: {
    // 학교 쪽 (왼쪽 위)
    school: [44, 62], campus: [128, 48], academy: [108, 108], library: [40, 140],
    // 업무 지구 (오른쪽 위)
    office: [306, 52],
    // 번화가 (가운데 위)
    cafe: [166, 150], mall: [232, 106], pcbang: [306, 124], gym: [172, 210], bar: [244, 168], concert: [318, 186], motel: [262, 226],
    // 강가 공원
    park: [118, 306],
    // 우리 동네 (왼쪽 아래)
    home: [48, 396], block: [112, 416], conveni: [126, 358], playground: [30, 340], realty: [176, 330], diner: [74, 316],
    // 옆 동네 (오른쪽 아래)
    market: [172, 404], hospital: [310, 326], center: [222, 346], church: [246, 410],
    // 터미널 (오른쪽 끝)
    station: [318, 404],
  },
  // 대학 캠퍼스 지도 (대학 안 장소 — places.js campus: true). 시내에서 오면 '대학'(정문) 위치로 계산
  campus: {
    pos: { campus: [180, 422], quad: [180, 290], lecture: [84, 196], ulib: [276, 196], cafeteria: [86, 330], union: [276, 330], clubroom: [282, 82] },
  },
  // 나라별 위치 덮어쓰기 — 뉴욕: 센트럴 파크는 맨해튼 한가운데(강 위쪽)
  posBy: { ny: { park: [98, 196] } },
};
