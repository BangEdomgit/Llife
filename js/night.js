// 그날 밤 장면: 달빛 드는 방의 침대와 이불 속 두 사람
// - 두 사람은 관절 있는 더미: 머리·목·가슴·허리·골반·엉덩이·(가슴)·허벅지·종아리·발·위팔·아래팔. 실제 비율(1 = 약 0.85cm, 매트리스 236 = 2m)
//   무릎·손·팔꿈치처럼 바닥을 짚은 곳은 고정, 나머지 관절은 뼈 길이를 지키며 따라감(두 원의 교점)
// - 체위 넷(정상위·후배위·기승위·엎드려): 상대 성격에 따라 고름. 주소에 ?pose=doggy 처럼 고정 가능
// - 박자: 점점 빨라짐 → 세게 두 번 → 세게 누른 채 떨림 두 번 → 축 늘어짐. 만족감이 높으면 이 판이 종료 버튼까지 이어지고 판마다 상대 절정
//   (초상화가 절정 얼굴로 바뀌고 ♀에서 물방울이 뿜어짐)
//   밀어 넣을수록 빨라져 부딪히는 순간 멈추며 살짝 튕기고, 엉덩이·가슴 살은 관성으로 출렁임. 받는 쪽은 밀렸다 돌아오고 매트리스가 눌림
// - 이불: 중력·장력·감쇠로 몸 위에 얹혀 출렁이고, 몸 실루엣이 이불에 비침. 행위 자체는 그리지 않음
// - 상대 만족감이 높을수록 하트가 많이, 50 아래면 하트 없이 짧게 흔들리다 실망(… 말풍선, 30 아래면 깨진 하트)
// - 주소에 ?dummy 를 붙이면 이불을 반투명하게 하고 더미를 색으로 보여줌 (실험용)
(function () {
'use strict';
// 재생 배속 (×1 / ×2 / ×4 / ×8) — 화면에서 고름, 이 기기에 기억
let RATE = 1;
try { RATE = +localStorage.getItem('llife.ntRate') || 1; } catch (e) { /* 저장 못 하는 환경 */ }
// 디테일 모드 (테스트용, 기본 꺼짐): 그날 밤 카드의 🔬 버튼·그날 밤 테스트 창·주소 ?detail 로 켬, 이 기기에 기억
//   이불 장면(효과음 글자·땀·열기·숨결·시트 주름·발끝·김 서린 창·바닥 옷), 초상화(홍조·땀·젖은 머리·숨결·자국),
//   내레이션 자막·추가 말풍선·테스트 수치. 문장과 그림은 지금처럼 암시까지만
let DETAIL = false;
try { DETAIL = /[?&#]detail/.test(location.href) || localStorage.getItem('llife.ntDetail') === '1'; } catch (e) { /* 저장 못 하는 환경 */ }
let FORCE_POSE = null, LAST = null;   // 테스트 창의 체위 고정 / 마지막 밤 기록 (아침 카드의 '어젯밤 기록')
const HEART = 'M0,5 C-7,0 -6,-6 -2.5,-6 C-1,-6 0,-5 0,-4 C0,-5 1,-6 2.5,-6 C6,-6 7,0 0,5 Z';
const CX = Array.from({ length: 44 }, (_, i) => 68 + 216 * i / 43);   // 이불 윗선 점들의 x
const FOLDS = [[112, -4, .8], [146, 3, 1], [176, -3, .7], [212, 4, 1], [250, -2, .8]];
const MY = 129;                                                       // 매트리스 윗면
// 장소별 방: home 집 침실 / hotel 호텔(도시 야경) / sea 여행지 숙소(바다) / park 공원(이불 대신 덤불, 침대 대신 풀밭)
// motel 모텔(골목에서 이어짐): 블라인드 사이로 새는 분홍 네온, 누빔 헤드보드, 새틴 이불
const KIND = spot => spot === 'hotel' ? 'hotel' : spot === 'travel' ? 'sea' : spot === 'park' ? 'park' : spot === 'motel' ? 'motel' : spot === 'alley' ? 'alley' : spot === 'toilet' ? 'toilet' : 'home';
// 서서 하는 곳 (이불 없음): alley 골목(벽돌 벽에 기대어) / toilet 화장실 칸(칸막이·변기). 두 사람은 이불 대신 그대로 실루엣 (윤곽만 빛을 받음)
//   바닥 FY, 왼쪽 벽 WALLX. 사람은 장면에 들어오게 0.74배 (서 있으면 키가 커서)
const BEDWORD = /이불|침대|시트|베개|매트리스/;
const STAND = { alley: 1, toilet: 1 }, FY = 172, WALLX = { alley: 78, toilet: 76 }, STAND_K = .74;
const STAND_POSES = { alley: ['wall', 'standBack'], toilet: ['standBack', 'seatLap'] };
let WX = 78, POOL = null;   // 지금 장면의 벽 위치 · 고를 수 있는 체위 (서서 하는 곳)
const scaleBody = (B, k) => ({ head: B.head * k, neck: B.neck * k, torso: B.torso * k, thigh: B.thigh * k, shin: B.shin * k, foot: B.foot * k, uarm: B.uarm * k, farm: B.farm * k,
  r: Object.fromEntries(Object.entries(B.r).map(([n, v]) => [n, Array.isArray(v) ? v.map(x => x * k) : v * k])) });
const QSTYLE = {
  home: { g: ['#dcbde6', '#b48bc6', '#76548c'], st: '#efdcf5', stO: .45, fd: '#5c3f70', fl: '#f1e0f7', hem: '#5a3e6e', rim: '#f3e6f8', sil: .4 },
  hotel: { g: ['#fdfbf6', '#e7e1d6', '#b3a998'], st: '#fff', stO: 0, fd: '#8f8576', fl: '#fff', hem: '#a99f90', rim: '#fff', sil: .34 },
  park: { g: ['#5d8f4f', '#3a6936', '#1d3a1f'], st: '#8fbf72', stO: 0, fd: '#132a17', fl: '#9fd07e', hem: '#132a17', rim: '#8fc77a', sil: .3, leafy: true },
};
QSTYLE.sea = QSTYLE.hotel;
QSTYLE.motel = { g: ['#d65b78', '#9c2c4b', '#561428'], st: '#ffb3c6', stO: .35, fd: '#3d0b1c', fl: '#ffc4d4', hem: '#4a1023', rim: '#ffd0dc', sil: .36 };
const SKY = { home: ['#0d1533', '#27356c'], hotel: ['#0f1430', '#3d2f58'], sea: ['#0b1532', '#25386a'], park: ['#060b20', '#1d2a52'], motel: ['#1c0a26', '#46123f'], alley: ['#1a0c2a', '#3b1440'], toilet: ['#1d2a30', '#2d3d44'] };
const WALL = { home: ['#161c33', '#0d1120'], hotel: ['#2b211c', '#15100d'], sea: ['#2b211c', '#15100d'], park: ['#060b20', '#1d2a52'], motel: ['#2b1430', '#120816'], alley: ['#24131f', '#0e070c'], toilet: ['#9fb3b8', '#6c7f86'] };
QSTYLE.alley = QSTYLE.toilet = QSTYLE.hotel;
const stars = (list, cls = 'nt-star', fill = '#fff') => list.map(([x, y, d]) => `<circle class="${cls}" cx="${x}" cy="${y}" r=".9" fill="${fill}" style="animation-delay:${d}s"/>`).join('');
const crescent = (x, y) => `<circle cx="${x}" cy="${y}" r="19" fill="url(#ntMoon)"/><circle cx="${x}" cy="${y}" r="8" fill="#f6ebc4" mask="url(#ntCres)"/>`;
// 호텔·바다 숙소 공통: 큰 창(안쪽 풍경은 따로), 얇은 커튼, 벽등, 룸서비스 쟁반이 놓인 협탁
const suite = view => `<rect width="320" height="171" fill="url(#ntWall)"/><rect y="170" width="320" height="20" fill="#120d0b"/><path d="M0,170.5 H320" stroke="#3a2c24"/>
  <rect x="196" y="12" width="110" height="116" fill="url(#ntSky)"/>${view}
  <path d="M251,12 V128 M196,70 H306" stroke="#2a2128" stroke-width="2"/><rect x="196" y="12" width="110" height="116" fill="none" stroke="#3b2e2a" stroke-width="3"/>
  <path d="M188,8 H204 C201,50 208,92 202,130 H188 Z" fill="#efe4d4" opacity=".16"/><path d="M193,10 C192,50 196,90 194,128" fill="none" stroke="#efe4d4" stroke-width="1" opacity=".18"/>
  <circle cx="68" cy="72" r="42" fill="url(#ntLamp)"/><path d="M64,64 h8 l-1.6,11 h-4.8 z" fill="#f3d9a6"/><rect x="67" y="75" width="2" height="5" fill="#8a6a48"/>
  <rect x="4" y="138" width="28" height="32" rx="2" fill="#3a2a22"/><rect x="2" y="135" width="32" height="4" rx="1.5" fill="#4a362c"/><path d="M8,153 H28" stroke="#24180f"/>
  <rect x="5" y="131.5" width="24" height="3" rx="1" fill="#b9b2a6"/><path d="M8,131.5 Q17,119 26,131.5 Z" fill="#d5d0c7"/><circle cx="17" cy="122.6" r="1.4" fill="#eeeae3"/>
  <path d="M31,134.5 V128 M29.4,127 H32.6 L32,121.5 H30 Z" fill="#cfe9f5" stroke="#cfe9f5" stroke-width=".8" opacity=".75"/>`;
const city = () => `<path d="M196,128 ${[[0, 30], [9, 48], [17, 22], [24, 60], [34, 38], [42, 52], [52, 28], [59, 66], [70, 40], [78, 54], [88, 26], [95, 44], [104, 34], [110, 30]].map(([x, h]) => `V${128 - h} H${196 + x + 7}`).join(' ')} V128 Z" fill="#0a0d20"/>` +
  Array.from({ length: 46 }, (_, i) => { const x = 198 + (i * 37) % 104, y = 74 + (i * 23) % 50; return `<rect x="${x}" y="${y}" width="1.6" height="2" fill="#ffd98a" opacity="${.35 + (i % 4) * .15}"/>`; }).join('');
const sea = () => `<rect x="196" y="86" width="110" height="42" fill="#0a1734"/><path d="M196,86 H306" stroke="#3a4d80" stroke-width=".8"/>${crescent(222, 70)}
  ${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${214 - i * 1.5},${92 + i * 6} h${16 + i * 3}" stroke="#f6ebc4" stroke-width="1.2" stroke-linecap="round" opacity="${.55 - i * .07}"/>`).join('')}`;
const BACK = {
  home: `  <rect width="320" height="171" fill="url(#ntWall)"/><rect y="170" width="320" height="20" fill="#090b13"/><path d="M0,170.5 H320" stroke="#242b46"/>
  <rect x="214" y="24" width="76" height="68" rx="2" fill="url(#ntSky)"/>
  ${[[224, 34, 0], [240, 48, .8], [233, 78, 1.6], [282, 70, .4], [258, 84, 1.2], [246, 31, 2]].map(([x, y, d]) => `<circle class="nt-star" cx="${x}" cy="${y}" r=".9" fill="#fff" style="animation-delay:${d}s"/>`).join('')}
  <circle cx="236" cy="76" r="19" fill="url(#ntMoon)"/><circle cx="236" cy="76" r="8" fill="#f6ebc4" mask="url(#ntCres)"/>
  <path d="M252,24 V92 M214,58 H290" stroke="#303a62" stroke-width="2.4"/>
  <rect x="214" y="24" width="76" height="68" rx="2" fill="none" stroke="#3b4672" stroke-width="3.5"/><rect x="209" y="91" width="86" height="4" rx="1.5" fill="#3b4672"/>
  <path d="M206,18 H222 C220,40 216,60 222,80 C224,90 218,100 214,106 C210,98 206,92 206,84 Z" fill="#2a3558"/><path d="M211,20 C210,40 210,62 212,84 M216,20 C215,44 214,62 217,82" fill="none" stroke="#1c2442" stroke-width="1.4"/>
  <path d="M298,18 H282 C284,40 288,60 282,80 C280,90 286,100 290,106 C294,98 298,92 298,84 Z" fill="#2a3558"/><path d="M293,20 C294,40 294,62 292,84 M288,20 C289,44 290,62 287,82" fill="none" stroke="#1c2442" stroke-width="1.4"/>
  <path d="M202,17 H302" stroke="#4d3b2c" stroke-width="2.4" stroke-linecap="round"/><circle cx="201" cy="17" r="2.4" fill="#4d3b2c"/><circle cx="303" cy="17" r="2.4" fill="#4d3b2c"/>
  <rect x="112" y="40" width="44" height="32" rx="1.5" fill="#3a2a20"/><rect x="115" y="43" width="38" height="26" fill="#1c2340"/><path d="M115,69 L127,55 L134,61 L143,50 L153,62 V69 Z" fill="#2c3a5c"/><circle cx="145" cy="49" r="2.4" fill="#c8b98a" opacity=".6"/><path d="M120,36 L134,28 L148,36" fill="none" stroke="#3a3f55" stroke-width=".8"/>
  <circle cx="18" cy="112" r="50" fill="url(#ntLamp)"/>
  <rect x="3" y="134" width="30" height="36" rx="2" fill="url(#ntWood)"/><rect x="1" y="131" width="34" height="4" rx="1.5" fill="#5b3d2a"/><path d="M7,151 H29" stroke="#3a281c"/><circle cx="18" cy="143" r="1.3" fill="#c9a36a"/>
  <ellipse cx="18" cy="130" rx="5" ry="1.6" fill="#8a6a48"/><rect x="17" y="116" width="2" height="14" fill="#8a6a48"/><path d="M9,117 H27 L23,103 H13 Z" fill="#f3d9a6"/><path d="M9,117 H27" stroke="#d9b97f" stroke-width="1.2"/>
`,
  hotel: suite(city()),
  motel: `<rect width="320" height="171" fill="url(#ntWall)"/><rect y="170" width="320" height="20" fill="#0d0610"/><path d="M0,170.5 H320" stroke="#3a1a3c"/>
  <path d="M0,3 H320" stroke="#ff5fa2" stroke-width="2.2" opacity=".55"/><path d="M0,5 H320" stroke="#ff5fa2" stroke-width="7" opacity=".08"/>
  <rect x="110" y="22" width="70" height="70" fill="url(#ntSky)"/>
  <g class="nt-neon"><text x="145" y="56" text-anchor="middle" font-size="14" font-weight="700" letter-spacing="2" fill="#ff7ab6" font-family="sans-serif">MOTEL</text>
    <text x="145" y="56" text-anchor="middle" font-size="14" font-weight="700" letter-spacing="2" fill="none" stroke="#ff7ab6" stroke-width="3" opacity=".25" font-family="sans-serif">MOTEL</text>
    <path d="M122,64 H168" stroke="#7af0ff" stroke-width="1.4" opacity=".8"/></g>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="110" y="${23 + i * 7.7}" width="70" height="3.2" fill="#3a2440" opacity=".92"/>`).join('')}
  <rect x="110" y="22" width="70" height="70" fill="none" stroke="#4a2a4c" stroke-width="3"/><rect x="105" y="91" width="80" height="4" rx="1.5" fill="#4a2a4c"/>
  <g class="nt-neon" opacity=".5">${Array.from({ length: 5 }, (_, i) => `<path d="M${190 + i * 3},${30 + i * 9} L${262 + i * 6},${36 + i * 9} L${262 + i * 6},${38.5 + i * 9} L${190 + i * 3},${32.5 + i * 9} Z" fill="#ff6fae" opacity="${.22 - i * .03}"/>`).join('')}</g>
  <rect x="226" y="66" width="56" height="32" rx="2" fill="#0b0b10" stroke="#2a2030" stroke-width="2"/><path d="M230,70 H278 V94 H230 Z" fill="#141826" opacity=".9"/>
  <circle cx="18" cy="112" r="46" fill="url(#ntLamp)"/>
  <rect x="3" y="134" width="30" height="36" rx="2" fill="#3a1f2c"/><rect x="1" y="131" width="34" height="4" rx="1.5" fill="#4d2a3a"/><path d="M7,151 H29" stroke="#26131c"/>
  <ellipse cx="18" cy="130" rx="5" ry="1.6" fill="#8a4a68"/><rect x="17" y="117" width="2" height="13" fill="#8a4a68"/><path d="M10,118 H26 L22,105 H14 Z" fill="#ffb1c9"/>
  <path d="M27,129.5 h5 l1.5,-3 h-2.4 Z" fill="#d8b45a"/><rect x="28" y="125.5" width="5" height="2.4" rx=".6" fill="#ff6fae"/>`,
  sea: suite(sea()),
  park: `<rect width="320" height="190" fill="url(#ntSky)"/>${stars([[20, 20, 0], [44, 44, 1], [92, 16, .5], [120, 40, 1.4], [150, 12, .2], [180, 52, 1.8], [205, 74, .7], [248, 88, 1.1], [300, 78, 1.6], [70, 64, .9]])}${crescent(176, 26)}
  <path d="M0,124 L0,112 H14 V104 H22 V112 H40 V98 H48 V112 H210 V106 H222 V100 H230 V110 H258 V102 H268 V112 H320 V124 Z" fill="#0b1230" opacity=".9"/>
  <path d="M20,128 V74 h7 V128 Z" fill="#0d1a12"/><circle cx="12" cy="66" r="18" fill="#0f2416"/><circle cx="34" cy="58" r="20" fill="#11281a"/><circle cx="24" cy="44" r="16" fill="#0f2416"/><circle cx="48" cy="72" r="13" fill="#0f2416"/>
  <path d="M302,128 V80 h6 V128 Z" fill="#0d1a12"/><circle cx="296" cy="70" r="16" fill="#0f2416"/><circle cx="314" cy="62" r="18" fill="#11281a"/>
  <rect y="124" width="320" height="66" fill="url(#ntGrass)"/>
  <path d="${Array.from({ length: 64 }, (_, i) => { const x = i * 5 + (i % 3); return `M${x},126 l${(i % 2 ? 1.5 : -1.2)},-${4 + (i % 4)}`; }).join(' ')}" stroke="#2f5a30" stroke-width="1.1" stroke-linecap="round"/>
  ${stars([[60, 150, 0], [130, 160, .8], [210, 148, 1.6], [270, 166, .4], [96, 176, 1.2]], 'nt-star nt-fly', '#d8ff9a')}
  <text x="292" y="182" font-size="9" opacity=".7">🦗</text>`,
};
const BED = {
  home: `    <ellipse cx="168" cy="171" rx="134" ry="4" fill="#000" opacity=".5"/>
    <path d="M40,170 V88 Q40,80 45,80 Q50,80 50,88 V170 Z" fill="url(#ntWood)"/><path d="M42.5,90 V166" stroke="#8a6448" opacity=".55"/>
    <path d="M286,170 V120 Q286,114 290,114 Q294,114 294,120 V170 Z" fill="url(#ntWood)"/><path d="M288.5,122 V166" stroke="#8a6448" opacity=".55"/>
    <rect x="48" y="145" width="240" height="11" rx="2" fill="url(#ntWood)"/><path d="M50,147.5 H286" stroke="#8a6448" opacity=".4"/>
    <rect x="50" y="129" width="236" height="17" rx="5" fill="url(#ntSheet)"/><path d="M54,137.5 H282" stroke="#a49b8d" stroke-dasharray="3 3" opacity=".5"/>
    <path d="M66,129 C63,121 72,115 86,116 C100,115 107,120 105,128 C104,131 68,132 66,129 Z" fill="#ddd5c8"/>
    <path d="M54,130 C51,123 60,117 73,118 C87,117 93,122 91,129 C90,132 56,133 54,130 Z" fill="#f4efe6"/><path d="M62,124 Q71,120 82,122" fill="none" stroke="#d3cbbd" stroke-width="1.2" stroke-linecap="round"/>
`,
  hotel: `<ellipse cx="168" cy="171" rx="134" ry="4" fill="#000" opacity=".5"/>
    <rect x="28" y="86" width="24" height="84" rx="8" fill="#5b4a43"/>${[96, 108, 120].map(y => `<circle cx="36" cy="${y}" r="1.2" fill="#3a2e2a"/><circle cx="44" cy="${y + 6}" r="1.2" fill="#3a2e2a"/>`).join('')}<path d="M31,92 V166" stroke="#7a675e" opacity=".5"/>
    <rect x="48" y="146" width="242" height="12" rx="2" fill="#2a2220"/>
    <rect x="50" y="127" width="238" height="20" rx="5" fill="url(#ntSheet)"/>
    <path d="M66,128 C63,120 72,114 86,115 C100,114 107,119 105,127 C104,130 68,131 66,128 Z" fill="#eeeae3"/>
    <path d="M54,129 C51,122 60,116 73,117 C87,116 93,121 91,128 C90,131 56,132 54,129 Z" fill="#fbf9f5"/>`,
  park: `<ellipse cx="168" cy="146" rx="120" ry="4" fill="#000" opacity=".35"/>`,
};
BED.sea = BED.hotel;
// 모텔: 누빔 헤드보드(단추), 낮은 침대 틀
BED.motel = `<ellipse cx="168" cy="171" rx="134" ry="4" fill="#000" opacity=".55"/>
    <rect x="26" y="80" width="28" height="90" rx="9" fill="#6e2238"/>${[90, 104, 118, 132].map(y => `<circle cx="34" cy="${y}" r="1.4" fill="#3d0e1d"/><circle cx="46" cy="${y + 7}" r="1.4" fill="#3d0e1d"/>`).join('')}<path d="M29,86 V164" stroke="#8f3450" opacity=".5"/>
    <rect x="48" y="146" width="242" height="12" rx="2" fill="#24101a"/><path d="M50,158 H288" stroke="#ff5fa2" stroke-width="1" opacity=".35"/>
    <rect x="50" y="127" width="238" height="20" rx="5" fill="url(#ntSheet)"/>
    <path d="M66,128 C63,120 72,114 86,115 C100,114 107,119 105,127 C104,130 68,131 66,128 Z" fill="#ead8e0"/>
    <path d="M54,129 C51,122 60,116 73,117 C87,116 93,121 91,128 C90,131 56,132 54,129 Z" fill="#f8eef2"/>`;
// 골목: 왼쪽은 바로 옆 벽돌 벽(두 사람이 기대는 면, 배수관·실외기), 안쪽으로 좁아지는 골목 끝에 네온 간판과 가로등, 젖은 바닥에 비친 불빛
BACK.alley = `<rect width="320" height="190" fill="url(#ntSky)"/>
  <path d="M120,0 L150,48 L150,150 L120,172 Z" fill="#170b16"/><path d="M262,0 L238,48 L238,150 L262,172 Z" fill="#140912"/>
  <path d="M150,48 H238 V150 H150 Z" fill="#0c0610"/>
  <g class="nt-neon"><circle cx="196" cy="86" r="34" fill="url(#ntPinkGlow)"/><rect x="184" y="66" width="24" height="44" rx="3" fill="#1a0a1c" stroke="#ff7ab6" stroke-width="1.4"/>
    ${'BAR'.split('').map((ch, i) => `<text x="196" y="${80 + i * 11}" text-anchor="middle" font-size="9" font-weight="700" fill="#ff8cc0" font-family="sans-serif">${ch}</text>`).join('')}</g>
  <rect x="160" y="96" width="14" height="20" fill="#3a2a10" opacity=".8"/><rect x="214" y="90" width="12" height="16" fill="#2a3a4a" opacity=".7"/>
  <path d="M0,0 H${78} V172 H0 Z" fill="#2a1622"/>
  <path d="${Array.from({ length: 16 }, (_, r) => { const yy = 6 + r * 10.5, o = r % 2 ? 10 : 0; return `M0,${yy.toFixed(1)} H78` + Array.from({ length: 5 }, (_, c) => ` M${o + c * 20},${yy.toFixed(1)} V${(yy + 10.5).toFixed(1)}`).join(''); }).join(' ')}" stroke="#170b12" stroke-width="1.1" fill="none"/>
  <path d="M78,0 V172" stroke="#4a2638" stroke-width="2.4"/><path d="M80,0 V172" stroke="#000" stroke-width="2" opacity=".35"/>
  <rect x="58" y="0" width="5" height="172" fill="#1a1016"/><rect x="56" y="60" width="9" height="4" fill="#120a10"/><rect x="56" y="120" width="9" height="4" fill="#120a10"/>
  <rect x="12" y="92" width="34" height="24" rx="2" fill="#2e2a2c"/>${[0, 1, 2, 3, 4].map(i => `<path d="M16,${96 + i * 4} H42" stroke="#1a1718" stroke-width="1.4"/>`).join('')}
  <path d="M262,0 H320 V172 H262 Z" fill="#1d1018"/><rect x="276" y="96" width="30" height="76" fill="#120a10"/><rect x="279" y="99" width="24" height="70" fill="#3a2a18" opacity=".55"/><circle cx="300" cy="134" r="1.6" fill="#d8b45a"/>
  <path d="M290,40 v20 q0,6 -6,6 h-12" fill="none" stroke="#0c070e" stroke-width="3"/><path d="M266,66 h12 l-2,4 h-8 Z" fill="#2a1a1a"/>
  <path d="M268,70 L222,172 H320 L282,70 Z" fill="url(#ntLampCone)"/>
  <rect y="172" width="320" height="18" fill="url(#ntFloor)"/><path d="M80,172 L150,150 H238 L262,172" fill="#0e0710"/>
  <ellipse class="nt-neon" cx="196" cy="180" rx="34" ry="3.5" fill="#ff6fae" opacity=".22"/><ellipse cx="282" cy="182" rx="22" ry="2.6" fill="#ffd9a0" opacity=".18"/>`;
// 화장실 칸: 왼쪽 칸막이(휴지 걸이) 앞에 변기(물탱크·뚜껑 닫힌 변기), 오른쪽은 잠긴 문(고리에 가방), 위에 깜빡이는 형광등, 바닥 타일
BACK.toilet = `<rect width="320" height="190" fill="url(#ntWall)"/>
  <path d="${Array.from({ length: 12 }, (_, r) => `M0,${r * 15} H320`).join(' ')} ${Array.from({ length: 22 }, (_, c) => `M${c * 15},0 V172`).join(' ')}" stroke="#7d9096" stroke-width=".8" opacity=".55"/>
  <rect x="96" y="2" width="128" height="6" rx="3" fill="#eef8ff" class="nt-flick"/><rect x="90" y="8" width="140" height="70" fill="url(#ntTube)" class="nt-flick"/>
  <path d="M0,10 H76 V172 H0 Z" fill="#c9b79c"/><path d="M76,10 V172" stroke="#8d7d66" stroke-width="2.4"/><path d="M0,10 H76" stroke="#e2d4bc" stroke-width="2"/>
  <rect x="44" y="104" width="22" height="16" rx="3" fill="#a9b6bd"/><path d="M48,104 v-3 h14 v3" fill="none" stroke="#8a979e" stroke-width="1.6"/><rect x="47" y="110" width="16" height="9" rx="4" fill="#f4f1ea"/>
  <path d="M262,6 H320 V172 H262 Z" fill="#c9b79c"/><path d="M262,6 V172" stroke="#8d7d66" stroke-width="2.4"/><rect x="266" y="84" width="10" height="5" rx="1.5" fill="#8a979e"/><circle cx="270" cy="96" r="2.4" fill="#d24a4a"/>
  <path d="M296,30 q0,8 -6,10" fill="none" stroke="#5a5a5a" stroke-width="2"/><path d="M280,40 h20 l3,24 h-26 Z" fill="#4a3a5a"/><path d="M284,40 q6,-8 12,0" fill="none" stroke="#3a2a4a" stroke-width="1.6"/>
  <rect x="78" y="98" width="20" height="38" rx="3" fill="#eef1f2"/><rect x="76" y="94" width="24" height="6" rx="2" fill="#dfe4e6"/><circle cx="92" cy="97" r="1.6" fill="#b8c2c6"/>
  <path d="M84,138 H124 Q130,138 130,144 Q130,156 116,162 L110,172 H90 L88,162 Q80,156 80,148 Z" fill="#f2f4f5"/><path d="M82,136 H126 Q131,136 131,140 H82 Z" fill="#e6eaec"/>
  <rect y="172" width="320" height="18" fill="#56666c"/><path d="${Array.from({ length: 11 }, (_, c) => `M${c * 32},172 L${c * 32 - 12},190`).join(' ')} M0,181 H320" stroke="#46555a" stroke-width="1"/>`;
BED.alley = '<ellipse cx="150" cy="173" rx="74" ry="3.4" fill="#000" opacity=".55"/>';
BED.toilet = '<ellipse cx="130" cy="173" rx="70" ry="3.2" fill="#000" opacity=".3"/>';
function room(kind) {
  const q = QSTYLE[kind], [s0, s1] = SKY[kind], [w0, w1] = WALL[kind], st = !!STAND[kind], hide = st ? ' style="display:none"' : '';
  return `<svg class="bed" viewBox="0 0 320 190" aria-hidden="true"><defs>
  <linearGradient id="ntWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${w0}"/><stop offset="1" stop-color="${w1}"/></linearGradient>
  <linearGradient id="ntSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s0}"/><stop offset="1" stop-color="${s1}"/></linearGradient>
  <linearGradient id="ntGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f3b22"/><stop offset="1" stop-color="#0b170d"/></linearGradient>
  <radialGradient id="ntMoon"><stop offset="0" stop-color="#fff4c8" stop-opacity=".5"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></radialGradient>
  <mask id="ntCres" maskUnits="userSpaceOnUse"><rect width="320" height="190" fill="#000"/>${[[236, 76], [222, 70], [176, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#fff"/><circle cx="${x + 4}" cy="${y - 3}" r="7" fill="#000"/>`).join('')}</mask>
  <linearGradient id="ntBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d6ff" stop-opacity=".14"/><stop offset="1" stop-color="#c9d6ff" stop-opacity="0"/></linearGradient>
  <linearGradient id="ntPinkBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6fae" stop-opacity=".2"/><stop offset="1" stop-color="#ff6fae" stop-opacity="0"/></linearGradient>
  <radialGradient id="ntLamp"><stop offset="0" stop-color="#ffc77a" stop-opacity=".4"/><stop offset="1" stop-color="#ffc77a" stop-opacity="0"/></radialGradient>
  <linearGradient id="ntWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d4a33"/><stop offset="1" stop-color="#4a3122"/></linearGradient>
  <linearGradient id="ntSheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece6dc"/><stop offset="1" stop-color="#b9b1a4"/></linearGradient>
  <linearGradient id="ntQuilt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${q.g[0]}"/><stop offset=".4" stop-color="${q.g[1]}"/><stop offset="1" stop-color="${q.g[2]}"/></linearGradient>
  <radialGradient id="ntWarm"><stop offset="0" stop-color="#ff7aa2" stop-opacity=".5"/><stop offset="1" stop-color="#ff7aa2" stop-opacity="0"/></radialGradient>
  <radialGradient id="ntHeart" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffc6d4"/><stop offset=".55" stop-color="#ff6f94"/><stop offset="1" stop-color="#df3467"/></radialGradient>
  <filter id="ntBlur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.15"/></filter>
  <clipPath id="ntQC"><path class="nt-qc"/></clipPath>
  <radialGradient id="ntPinkGlow"><stop offset="0" stop-color="#ff6fae" stop-opacity=".55"/><stop offset="1" stop-color="#ff6fae" stop-opacity="0"/></radialGradient>
  <linearGradient id="ntLampCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".38"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>
  <linearGradient id="ntFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1020"/><stop offset="1" stop-color="#07050a"/></linearGradient>
  <linearGradient id="ntTube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef8ff" stop-opacity=".35"/><stop offset="1" stop-color="#eef8ff" stop-opacity="0"/></linearGradient>
  <filter id="ntRimF" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="d"/><feFlood flood-color="${kind === 'toilet' ? '#ffe2c8' : '#ff7ab6'}" flood-opacity=".75"/><feComposite in2="d" operator="in" result="rim"/><feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="ntRimM" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="d"/><feFlood flood-color="${kind === 'toilet' ? '#cfe9ff' : '#7ab8ff'}" flood-opacity=".7"/><feComposite in2="d" operator="in" result="rim"/><feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <g id="ntH"><path d="${HEART}" fill="url(#ntHeart)"/><ellipse cx="-2.8" cy="-3.2" rx="1.7" ry="1" fill="#fff" opacity=".7" transform="rotate(-35 -2.8 -3.2)"/></g>
</defs><g class="nt-cam">
  ${BACK[kind]}
  <g class="nt-fog"></g>
  <g class="nt-bed">
    ${BED[kind]}
    <g class="nt-wr"></g>
    <path class="nt-q" fill="url(#ntQuilt)"${hide}/>
    ${st ? `<g class="nt-sil nt-open"><path class="nt-sf" fill="${kind === 'toilet' ? '#2a1c22' : '#2a1028'}" filter="url(#ntRimF)"/><path class="nt-sm" fill="${kind === 'toilet' ? '#11141c' : '#0a0a16'}" filter="url(#ntRimM)"/></g>`
      : `<g class="nt-sil" clip-path="url(#ntQC)" filter="url(#ntBlur)"><path class="nt-sf" fill="#3b1b4a" opacity="${(q.sil * .9).toFixed(2)}"/><path class="nt-sm" fill="#1c0f2c" opacity="${(q.sil * 1.05).toFixed(2)}"/></g>`}<path class="nt-st" fill="none" stroke="${q.st}" stroke-width=".9" stroke-dasharray="2.2 2.6" opacity="${q.stO}"${hide}/>
    <g fill="none" stroke-linecap="round"${hide}>${FOLDS.map(([, , o]) => `<path class="nt-f" stroke="${q.fd}" stroke-width="2.2" opacity="${.26 * o}"/><path class="nt-f" stroke="${q.fl}" stroke-width="1.1" opacity="${.18 * o}"/>`).join('')}</g>
    <path class="nt-hem" fill="none" stroke="${q.hem}" stroke-width="2.2" opacity=".55"${hide}/><path class="nt-rim" fill="none" stroke="${q.rim}" ${q.leafy ? 'stroke-width="1.6" opacity=".7"' : 'stroke-width="1.3" opacity=".6"'} stroke-linecap="round"${hide}/>
    <g class="nt-dummy" hidden><path class="nt-df" fill="#ff9ec4" opacity=".8"/><path class="nt-dm" fill="#6bb5ff" opacity=".8"/><path class="nt-dj" fill="none" stroke="#222" stroke-width=".8"/></g>
  </g>
  <ellipse class="nt-warm" cx="182" cy="116" rx="122" ry="54" fill="url(#ntWarm)" opacity="0"/>
  ${kind === 'home' ? '<path d="M216,92 L290,92 L224,170 L112,170 Z" fill="url(#ntBeam)"/>' : kind === 'park' || st ? '' : kind === 'motel' ? '<path class="nt-neon" d="M110,92 L180,92 L250,170 L120,170 Z" fill="url(#ntPinkBeam)"/>' : '<path d="M198,128 L304,128 L230,170 L120,170 Z" fill="url(#ntBeam)"/>'}
  <g class="nt-hearts"></g><g class="nt-fx"></g><g class="nt-dx"></g>
</g></svg>`;
}

// 오른쪽 위 ♂♀ 패널. ♀ 고리는 옆으로 40°쯤 돌아선 고리(뒤쪽 반은 화살 뒤, 앞쪽 반은 화살 앞)라 화살이 고리를 꿰뚫어 보임
//   그리는 순서: 빛 → 고리 안 → 물결 → 고리 뒤쪽 반 → 잔상 → ♂ 화살 → 고리 앞쪽 반·하이라이트·십자 → 부딪힘 선·반짝 → 하트
const SYM = `<div class="nt-sym"><svg viewBox="0 0 150 64" aria-hidden="true"><defs>
  <radialGradient id="ntSG"><stop offset="0" stop-color="#ff7aa2" stop-opacity=".6"/><stop offset="1" stop-color="#ff7aa2" stop-opacity="0"/></radialGradient>
  <radialGradient id="syIn"><stop offset="0" stop-color="#ff9fbd" stop-opacity=".75"/><stop offset="1" stop-color="#ff6f9a" stop-opacity=".1"/></radialGradient>
  <linearGradient id="syBack" gradientUnits="userSpaceOnUse" x1="94" y1="0" x2="106" y2="0"><stop offset="0" stop-color="#8e3156"/><stop offset="1" stop-color="#cf4f79"/></linearGradient>
  <linearGradient id="syFront" gradientUnits="userSpaceOnUse" x1="106" y1="0" x2="118" y2="0"><stop offset="0" stop-color="#e5588a"/><stop offset=".7" stop-color="#ff86ab"/><stop offset="1" stop-color="#ffc2d6"/></linearGradient>
  <linearGradient id="syMg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9dcff"/><stop offset=".55" stop-color="#5aa8ff"/><stop offset="1" stop-color="#2f6bd0"/></linearGradient>
  <linearGradient id="syShaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4ebff"/><stop offset=".45" stop-color="#5aa8ff"/><stop offset="1" stop-color="#2a60c4"/></linearGradient>
  <linearGradient id="syHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9e5ff"/><stop offset=".5" stop-color="#4f9cf3"/><stop offset="1" stop-color="#2455b4"/></linearGradient>
  <radialGradient id="syDrop" cx=".65" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#c8ecff"/><stop offset="1" stop-color="#5fb8f0"/></radialGradient>
  <filter id="sySh" x="-20%" y="-30%" width="140%" height="160%"><feDropShadow dx="0" dy="1.1" stdDeviation=".9" flood-color="#000" flood-opacity=".5"/></filter>
</defs>
  <circle class="sy-glow" cx="106" cy="28" r="23" fill="url(#ntSG)" opacity="0"/>
  <ellipse class="sy-fill" cx="106" cy="28" rx="9" ry="12" fill="url(#syIn)" opacity="0"/>
  <ellipse class="sy-rip" fill="none" stroke="#ff9fbd" opacity="0"/>
  <path class="sy-back" fill="none" stroke="url(#syBack)" stroke-width="3.4" stroke-linecap="round"/>
  <g class="sy-trail" fill="none" stroke="#5aa8ff" stroke-width="3.6"><circle class="sy-g1" r="13.5" opacity="0"/><circle class="sy-g2" r="13.5" opacity="0"/></g>
  <g class="sy-m" transform="translate(40,28)" filter="url(#sySh)"><circle r="13.5" fill="none" stroke="url(#syMg)" stroke-width="5.2"/><path d="M-10.4,-6 A12.1,12.1 0 0 1 -1.3,-12.1" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>
    <rect class="sy-shaft" x="13.5" y="-3.5" height="7" rx="3.5" fill="url(#syShaft)"/><path class="sy-head" fill="url(#syHead)" stroke="#2457b5" stroke-width=".7" stroke-linejoin="round"/><path class="sy-hh" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".55"/></g>
  <g class="sy-front" filter="url(#sySh)"><path class="sy-fr" fill="none" stroke="url(#syFront)" stroke-width="4.2" stroke-linecap="round"/><path class="sy-spec" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>
    <path class="sy-cross" fill="none" stroke="#f0618f" stroke-width="3.6" stroke-linecap="round"/></g>
  <path class="sy-tak" fill="none" stroke="#ffe08a" stroke-width="1.6" stroke-linecap="round" opacity="0"/>
  <path class="sy-spark" fill="#fff6c8" opacity="0"/>
  <g class="sy-ouch" opacity="0"><path d="M126,6 Q123,11 126,13 Q129,11 126,6 Z" fill="#cfeeff" stroke="#86bfdc" stroke-width=".7"/><path d="M134,4 V12 M134,15.5 V16" stroke="#ffd36b" stroke-width="2.4" stroke-linecap="round"/></g>
  <g class="sy-sq"></g><g class="sy-hs"></g><g transform="translate(88,10)"><path class="sy-h" d="${HEART}" fill="#ff4f86"/></g>
  <text class="sy-beat" x="0" y="0" font-size="13" text-anchor="middle" dominant-baseline="central" transform="translate(20,55)"></text></svg></div>`;
// 크기(cm) → 등급 1~6 (단소·소형·보통·큰 편·대물·흉기)
const sizeGrade = cm => cm < 10 ? 1 : cm < 13 ? 2 : cm < 16 ? 3 : cm < 18 ? 4 : cm < 20 ? 5 : 6;

/* ---------- 앞뒤 카드: 서서 다가가는 실루엣 / 교과서식 자궁 그림 ---------- */
// 옆에서 본 서 있는 실루엣 (오른쪽을 봄, 발끝 0,0). 팔은 따로 움직이는 묶음
function standing(male) {
  const sh = male ? 15 : 12, hip = male ? 11 : 14, hair = male ? '<path d="M-9,-150 Q2,-160 11,-148 Q6,-152 -9,-146 Z"/>' : '<path d="M-10,-152 Q2,-162 11,-150 Q14,-138 6,-140 Q2,-150 -6,-148 Q-14,-128 -10,-112 Q-18,-124 -16,-140 Z"/>';
  return `<g class="fp-body"><circle cx="0" cy="-142" r="10"/><path d="M8,-144 l4,4 l-4,1 Z"/>${hair}
    <path d="M-4,-133 h8 v8 h-8 Z"/><path d="M${-sh},-124 Q0,-130 ${sh},-124 L${sh - 3},-92 Q${male ? 4 : 8},-82 ${hip},-74 L${hip - 2},-66 H${-hip + 2} L${-hip},-74 Q${male ? -6 : -10},-84 ${-sh + 3},-92 Z"/>
    ${male ? '' : '<ellipse cx="7" cy="-108" rx="6" ry="5.5"/>'}
    <path d="M${-hip + 2},-68 L-9,-36 L-7,0 H-1 L0,-36 L3,-68 Z"/><path d="M2,-68 L4,-36 L7,0 H13 L11,-36 L${hip - 1},-68 Z"/></g>`;
}
const arm = () => `<path d="M-3,-3 Q3,12 2,30 L6,30 Q9,12 4,-3 Z"/><circle cx="4" cy="31" r="3"/>`;
// 디테일 모드 자막: 카드 아래에 한 줄씩 차례로 (step초 간격)
const capLines = (list, step) => list && list.length ? `<p class="sc-cap">${list.map((c, i) => `<span${i === list.length - 1 ? ' class="last"' : ''} style="animation-delay:${(i * step).toFixed(2)}s;animation-duration:${i === list.length - 1 ? .5 : step}s">${c}</span>`).join('')}</p>` : '';
function foreplay(colors, cap) {
  const cloth = (c, cls) => `<g class="fp-cloth ${cls}"><path d="M-9,-6 L-4,-9 Q0,-6 4,-9 L9,-6 L12,0 L7,2 L6,10 H-6 L-7,2 L-12,0 Z" fill="${c}"/></g>`;
  return `<div class="sc-fore"><svg viewBox="0 0 320 190" aria-hidden="true">
  <defs><radialGradient id="fpLight" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#3a3f66"/><stop offset="1" stop-color="#0b0d18"/></radialGradient></defs>
  <rect width="320" height="190" fill="url(#fpLight)"/><rect x="118" y="20" width="84" height="110" rx="2" fill="#5a6390" opacity=".35"/><path d="M160,20 V130 M118,75 H202" stroke="#0b0d18" stroke-width="2" opacity=".5"/>
  <rect y="172" width="320" height="18" fill="#07080f"/>
  <g fill="#07080c">
    <g class="fp-a"><g transform="translate(149,172)">${standing(true)}<g transform="translate(4,-122)"><g class="fp-arm-a">${arm()}</g></g></g></g>
    <g class="fp-b"><g transform="translate(171,172) scale(-1,1)">${standing(false)}<g transform="translate(4,-120)"><g class="fp-arm-b">${arm()}</g></g></g></g>
  </g>
  <g transform="translate(146,96)">${cloth(colors[0], 'c1')}</g><g transform="translate(174,94)">${cloth(colors[1], 'c2')}</g>
  <rect class="fp-dark" width="320" height="190" fill="#000"/></svg>${capLines(cap, .72)}</div>`;
}
function alley(meMale, themMale, cap) {
  const bricks = Array.from({ length: 15 }, (_, r) => { const y = 14 + r * 11, o = r % 2 ? 9 : 0; return `M0,${y} H${118 - r * 1.5}` + Array.from({ length: 7 }, (_, c) => ` M${o + c * 18},${y} V${y + 11}`).join(''); }).join(' ');
  return `<div class="sc-alley"><svg viewBox="0 0 320 190" aria-hidden="true">
  <defs><linearGradient id="alSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0c2a"/><stop offset="1" stop-color="#3b1440"/></linearGradient>
    <radialGradient id="alLamp" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".42"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
    <radialGradient id="alNeon"><stop offset="0" stop-color="#ff6fae" stop-opacity=".55"/><stop offset="1" stop-color="#ff6fae" stop-opacity="0"/></radialGradient>
    <linearGradient id="alFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1020"/><stop offset="1" stop-color="#07050a"/></linearGradient></defs>
  <rect width="320" height="190" fill="url(#alSky)"/>
  <path d="M184,40 L232,40 L236,150 L180,150 Z" fill="#120a18"/>
  <g class="al-neon"><circle cx="208" cy="78" r="40" fill="url(#alNeon)"/>
    <rect x="196" y="50" width="24" height="56" rx="3" fill="#1a0a1c" stroke="#ff7ab6" stroke-width="1.6"/>
    ${'MOTEL'.split('').map((ch, i) => `<text x="208" y="${62 + i * 10}" text-anchor="middle" font-size="9" font-weight="700" fill="#ff8cc0" font-family="sans-serif">${ch}</text>`).join('')}</g>
  <path d="M0,0 H124 L120,172 H0 Z" fill="#2a1622"/><path d="${bricks}" stroke="#170b12" stroke-width="1.2" fill="none"/>
  <path d="M124,0 L120,172" stroke="#3d2030" stroke-width="2"/>
  <path d="M320,0 H262 L258,172 H320 Z" fill="#1d1018"/><rect x="276" y="40" width="26" height="34" fill="#2f1a24"/><rect x="279" y="43" width="20" height="28" fill="#4a2c18" opacity=".7"/>
  <path d="M0,172 H320 V190 H0 Z" fill="url(#alFloor)"/><path d="M120,172 L184,150 H236 L258,172" fill="#120a14"/>
  <ellipse class="al-neon" cx="214" cy="178" rx="26" ry="3.2" fill="#ff6fae" opacity=".28"/>
  <path d="M248,0 V60 Q248,66 242,66 H228" fill="none" stroke="#0c070e" stroke-width="3"/><path d="M222,66 h12 l-2,4 h-8 Z" fill="#2a1a1a"/>
  <path d="M224,70 L196,172 H262 L232,70 Z" fill="url(#alLamp)"/>
  <g fill="#08060b" stroke="#ff7ab6" stroke-width=".8" stroke-opacity=".5">
    <g class="al-a"><g transform="translate(112,172) rotate(-4)">${standing(themMale)}<g transform="translate(4,-122)"><g class="al-arm">${arm()}</g></g></g></g>
    <g class="al-b"><g transform="translate(140,172) scale(-1,1)">${standing(meMale)}<g transform="translate(4,-122)"><g class="al-arm-b">${arm()}</g></g></g></g>
  </g>
  <g class="al-heart" transform="translate(126,22)"><path d="${HEART}" fill="#ff6f94" transform="scale(1.6)"/></g>
  </svg>${capLines(cap, .9)}</div>`;
}
// 교과서식 자궁·난관·난소 단면. 정자는 자궁경부에서 올라오다 대부분 멈추고, 임신이면 하나가 왼쪽 난관 끝 난자에 닿아 빛남
//   info(디테일 모드): { pregP: 이번 밤 임신 확률 0~1 (모르면 없음), contra } → 단계별 정자 수와 확률을 숫자로
function uterus(preg, info) {
  const way = (k, side, j) => { const tx = 160 + side * 34, ox = 160 + side * 92; return `M${160 + j},176 C${160 + j * 2},150 ${150 + side * 8 + j},122 ${tx},96 C${tx + side * 22},${76 + k % 3 * 2} ${ox - side * 30},58 ${ox},66`; };
  const sperm = Array.from({ length: 14 }, (_, k) => {
    const side = k % 2 ? 1 : -1, win = preg && k === 2, stop = win ? 1 : [.25, .38, .5, .62, .72, .82][k % 6], dur = 2.6 + (k % 5) * .2, d = (k * .09).toFixed(2), path = way(k, side, (k % 5 - 2) * 3);
    return `<g opacity="1"><g class="sp-u"><ellipse rx="3.6" ry="2.4" fill="#f4f4f4"/><path class="tail" d="M-3.6,0 q-4,-3 -8,0 t-8,0" fill="none" stroke="#f4f4f4" stroke-width="1.1"/></g>
      <animateMotion dur="${dur}s" begin="${d}s" fill="freeze" rotate="auto" keyPoints="0;${stop}" keyTimes="0;1" calcMode="spline" keySplines=".3 .1 .5 1" path="${path}"/>
      ${win ? '' : `<animate attributeName="opacity" from="1" to="0" begin="${(+d + dur * .85).toFixed(2)}s" dur=".6s" fill="freeze"/>`}</g>`;
  }).join('');
  const tube = side => { const tx = 160 + side * 34, ox = 160 + side * 92; return `M${tx},96 C${tx + side * 22},76 ${ox - side * 30},58 ${ox},66`; };
  return `<div class="sc-uterus"><svg viewBox="0 0 320 200" aria-hidden="true">
  <defs><radialGradient id="utG" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#f6c6be" stop-opacity=".45"/><stop offset="1" stop-color="#d98a7e" stop-opacity=".2"/></radialGradient>
    <radialGradient id="eggG"><stop offset="0" stop-color="#fff6e8"/><stop offset="1" stop-color="#f0b48f"/></radialGradient></defs>
  <path d="${tube(-1)}" fill="none" stroke="#d98a7e" stroke-width="7" stroke-linecap="round"/><path d="${tube(1)}" fill="none" stroke="#d98a7e" stroke-width="7" stroke-linecap="round"/>
  <path d="${tube(-1)}" fill="none" stroke="#1b1220" stroke-width="2.4" stroke-linecap="round"/><path d="${tube(1)}" fill="none" stroke="#1b1220" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M124,92 Q160,80 196,92 Q194,140 172,160 L168,182 H152 L148,160 Q126,140 124,92 Z" fill="url(#utG)" stroke="#d98a7e" stroke-width="4" stroke-linejoin="round"/>
  <path d="M134,98 Q160,90 186,98 Q182,136 166,152 H154 Q138,136 134,98 Z" fill="#1b1220" opacity=".55"/>
  <ellipse cx="62" cy="70" rx="13" ry="9" fill="#f1c0b4" stroke="#d98a7e" stroke-width="2"/><ellipse cx="258" cy="70" rx="13" ry="9" fill="#f1c0b4" stroke="#d98a7e" stroke-width="2"/>
  <circle class="egg${preg ? ' win' : ''}" cx="68" cy="66" r="5.5" fill="url(#eggG)"/>
  ${sperm}</svg><p class="sc-later" style="animation-delay:3s">${preg ? '…하나가 닿았다.' : ''}</p>${info ? `<p class="sc-nums">정자 약 <b>2~3억</b> → 자궁경부를 지나는 건 약 <b>1%</b> → 자궁을 지나 난관까지 <b>수천</b> → 난자 곁까지 <b>수백</b> → 난자는 <b>1개</b><br>이번 밤 임신 확률 <b>${info.pregP != null ? (info.pregP * 100).toFixed(info.pregP < .1 ? 1 : 0) + '%' : '—'}</b>${info.contra ? ` · ${info.contra}` : ''} · 결과: <b>${preg ? '임신' : '아님'}</b></p>` : ''}</div>`;
}

/* ---------- 더미 ---------- */
// 길이와 반지름(옆에서 본 두께의 절반). [a, b]는 뿌리 → 끝으로 가늘어짐
const BODY = {
  m: { head: 11.8, neck: 14, torso: 61, thigh: 50, shin: 50, foot: 26, uarm: 39, farm: 32,
    r: { neck: 6.5, chest: 14.5, waist: 11.5, hip: 12.5, butt: 12, breast: 0, thigh: [10, 6.5], shin: [6, 4], foot: [4, 2.4], uarm: [5.6, 4.2], farm: [4, 3] } },
  f: { head: 11.2, neck: 13, torso: 56, thigh: 46, shin: 46, foot: 23, uarm: 35, farm: 29,
    r: { neck: 5.5, chest: 12.2, waist: 9.6, hip: 12.6, butt: 13.5, breast: 6.8, thigh: [10.5, 6], shin: [5.5, 3.6], foot: [3.6, 2.2], uarm: [4.8, 3.6], farm: [3.4, 2.6] } },
};
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const polar = (o, ang, l) => [o[0] + Math.cos(ang) * l, o[1] + Math.sin(ang) * l];
const perp = (v, pref) => { const p = [-v[1], v[0]]; return p[0] * pref[0] + p[1] * pref[1] >= 0 ? unit(p) : unit([-p[0], -p[1]]); };
// 두 원(중심 a 반지름 ra, 중심 b 반지름 rb)의 교점 중 pref 쪽. 닿지 않으면 b 쪽으로 쭉 뻗음
function meet(a, ra, b, rb, pref) {
  const D = Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1])), u = [(b[0] - a[0]) / D, (b[1] - a[1]) / D];
  const d = Math.min(ra + rb - 1e-6, Math.max(Math.abs(ra - rb) + 1e-6, D));
  const x = (d * d + ra * ra - rb * rb) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const p1 = [a[0] + u[0] * x - u[1] * h, a[1] + u[1] * x + u[0] * h], p2 = [a[0] + u[0] * x + u[1] * h, a[1] + u[1] * x - u[0] * h];
  return (p1[0] - p2[0]) * pref[0] + (p1[1] - p2[1]) * pref[1] > 0 ? p1 : p2;
}
// 어깨(sh)·골반(hip)과 몸 앞쪽(front: 배·얼굴 쪽) → 목·머리·허리·엉덩이·가슴. jig: 출렁이는 살의 어긋남
function trunk(B, sh, hip, front, tilt, jig) {
  const sp = unit(sub(sh, hip)), hd = unit(add(sp, front, tilt));
  return {
    sh, hip, neck: add(sh, sp, B.neck * .55), head: add(add(sh, hd, B.neck + B.head * .75), front, 1.5),
    waist: add(lerp(sh, hip, .55), front, -1),
    butt: add(add(add(hip, front, -B.r.hip * .32), sp, -7), jig.butt),
    breast: B.r.breast ? add(add(lerp(sh, hip, .24), front, B.r.chest * .72), jig.breast) : null,
    chest: lerp(sh, hip, .24), front,
  };
}
// 관절 → 캡슐 [ax, ay, bx, by, ra, rb]
function caps(B, J) {
  const c = [], seg = (a, b, ra, rb = ra) => c.push([a[0], a[1], b[0], b[1], ra, rb]);
  seg(J.head, J.head, B.head); seg(J.neck, J.sh, B.r.neck);
  seg(J.sh, J.waist, B.r.chest, B.r.waist); seg(J.waist, J.hip, B.r.waist, B.r.hip); seg(J.butt, J.butt, B.r.butt);
  if (J.breast) seg(J.breast, J.breast, B.r.breast);
  seg(J.hip, J.knee, ...B.r.thigh); seg(J.knee, J.ankle, ...B.r.shin); seg(J.ankle, J.toe, ...B.r.foot);
  if (J.knee2) { seg(J.hip, J.knee2, ...B.r.thigh); seg(J.knee2, J.ankle2, ...B.r.shin); seg(J.ankle2, J.toe2, ...B.r.foot); }   // 서 있을 땐 다른 쪽 다리도
  seg(J.sh, J.elbow, ...B.r.uarm); seg(J.elbow, J.hand, ...B.r.farm);
  return c;
}
// 그리기용 사람 몸 (이불 계산은 위의 단순한 캡슐로 빠르게): caps에 근육·뼈 윤곽을 더함
//   머리(두개·턱·코, 여자는 뒤로 넘긴 머리), 어깨 세모근, 가슴(남자 가슴 근육 / 여자 가슴 윗선), 이두·아래팔 근육·손,
//   허벅지 앞 근육·무릎뼈·종아리·발꿈치. 관절이 꺾인 쪽을 보고 근육을 앞뒤에 붙임
const scale = (v, k) => [v[0] * k, v[1] * k];
function bend(a, m, b, fb) {   // 관절 m이 꺾여 튀어나온 쪽 (거의 펴졌으면 fb)
  const v = add(unit(sub(m, a)), unit(sub(m, b))), l = Math.hypot(v[0], v[1]);
  return l > .2 ? [v[0] / l, v[1] / l] : fb;
}
function shape(B, J, male) {
  const c = caps(B, J), seg = (a, b, ra, rb = ra) => c.push([a[0], a[1], b[0], b[1], ra, rb]), dot = (a, r) => seg(a, a, r), R = B.head, r = B.r;
  const up = unit(sub(J.head, J.neck)), fr = perp(up, J.front), at = (o, kf, ku) => add(add(o, fr, kf), up, ku);
  seg(at(J.head, R * .25, -R * .15), at(J.head, R * .58, -R * .8), R * .56, R * .3);                 // 턱·뺨
  seg(at(J.head, R * .9, R * .02), at(J.head, R * 1.06, -R * .22), R * .15, R * .11);               // 코
  dot(at(J.head, -R * .18, R * .16), R * 1.02);                                                      // 뒤통수
  if (!male) seg(at(J.head, -R * .55, R * .1), at(J.neck, -R * .7, -R * .3), R * .66, R * .36);     // 뒤로 넘긴 머리
  seg(lerp(J.neck, J.sh, .2), J.sh, r.neck * .95, r.neck * 1.3);                                     // 목 → 어깨로 퍼짐
  const ua = unit(sub(J.elbow, J.sh));
  dot(add(J.sh, ua, B.uarm * .1), r.uarm[0] * (male ? 1.55 : 1.3));                                  // 어깨 세모근
  const ef = bend(J.sh, J.elbow, J.hand, scale(J.front, -1));                                        // 팔꿈치 뒤 (이두는 반대쪽)
  seg(add(lerp(J.sh, J.elbow, .3), ef, -r.uarm[0] * .3), add(lerp(J.sh, J.elbow, .72), ef, -r.uarm[1] * .3), r.uarm[0] * (male ? 1.1 : .95), r.uarm[1] * (male ? 1.05 : .88));
  dot(add(J.elbow, ef, r.farm[0] * .25), r.farm[0] * .95);                                           // 팔꿈치
  seg(lerp(J.elbow, J.hand, .1), lerp(J.elbow, J.hand, .5), r.farm[0] * (male ? 1.22 : 1.12), r.farm[0] * .95);   // 아래팔 근육
  const hd = unit(sub(J.hand, J.elbow));
  seg(J.hand, add(J.hand, hd, B.farm * .36), r.farm[1] * 1.3, r.farm[1] * .78);                     // 손 (손가락 쪽으로 가늘게)
  if (male) {
    dot(add(J.chest, J.front, r.chest * .28), r.chest * .8);                                         // 가슴 근육
    seg(add(lerp(J.chest, J.waist, .5), J.front, r.waist * .1), add(J.waist, J.front, r.waist * .05), r.waist * .92, r.waist * .9);   // 배
  } else {
    if (J.breast) seg(add(lerp(J.sh, J.chest, .4), J.front, r.chest * .4), J.breast, r.breast * .55, r.breast);   // 가슴 윗선 → 가슴
    seg(add(lerp(J.waist, J.hip, .45), J.front, -r.hip * .1), add(J.hip, J.front, -r.hip * .2), r.waist * 1.02, r.hip * 1.08);   // 골반 → 엉덩이로 넓어짐
  }
  const kf = bend(J.hip, J.knee, J.ankle, J.front);                                                  // 무릎 앞 (종아리는 반대쪽)
  seg(add(lerp(J.hip, J.knee, .2), kf, r.thigh[0] * .2), add(lerp(J.hip, J.knee, .72), kf, r.thigh[1] * .28), r.thigh[0] * .84, r.thigh[1] * .86);   // 허벅지 앞
  dot(add(J.knee, kf, r.thigh[1] * .4), r.thigh[1] * .62);                                           // 무릎뼈
  seg(add(lerp(J.knee, J.ankle, .14), kf, -r.shin[0] * .5), add(lerp(J.knee, J.ankle, .56), kf, -r.shin[0] * .3), r.shin[0] * (male ? 1.28 : 1.18), r.shin[0] * .78);   // 종아리
  const fd = unit(sub(J.toe, J.ankle));
  dot(add(J.ankle, fd, -r.foot[0] * .5), r.foot[0] * 1.08);                                          // 발꿈치
  return c;
}
// 체위: s = { d(움직이는 쪽 엉덩이를 뺀 거리, 호의 길이. 0 = 골반이 맞닿음, 조금 − = 살이 눌림), tr(떨림), slump(축 늘어짐 0~1), sink(매트리스 눌림), bs(받는 쪽이 밀린 거리), jig }
//   → { m, f: 관절, act: 움직이는 쪽, dir: 부딪히는 방향 }
const lie = (B, sh, k, b) => [[sh + b, MY - B.r.chest + 1 + k * .4], [sh + B.torso + b * .6, MY - B.r.hip + 2 + k]];
const legsBack = (B, J, knee) => Object.assign(J, { knee, ankle: [knee[0] + B.shin, MY - B.r.shin[1]], toe: [knee[0] + B.shin + B.foot * .75, MY - 1.5] });
const POSES = {
  // 정상위: 여자는 등을 대고 무릎을 세움, 남자는 다리 사이에 무릎 꿇고 팔꿈치로 여자 어깨 옆을 짚음
  missionary(s, M, F) {
    const [fsh, fhip] = lie(F, 102, s.sink, s.bs);
    const f = trunk(F, fsh, fhip, [0, -1], .28, s.jig.f);
    f.ankle = [fhip[0] + 64, MY - F.r.shin[1]]; f.knee = meet(fhip, F.thigh, f.ankle, F.shin, [.3, -1]); f.toe = [f.ankle[0] + F.foot * .8, MY - 2];
    const knee = [fhip[0] + 34, MY - M.r.shin[0] + 1], hip = add(polar(knee, -2.5 + s.d / M.thigh, M.thigh), [0, s.tr + 4 * s.slump + s.sink]);
    const elbow = [fsh[0] + 6 + s.bs * .6, MY - M.r.farm[0]], sh = meet(hip, M.torso, elbow, M.uarm * (1 - .15 * s.slump), [0, -1]);
    const m = legsBack(M, trunk(M, sh, hip, perp(sub(sh, hip), [0, 1]), .35, s.jig.m), knee);
    Object.assign(m, { elbow, hand: [elbow[0] - M.farm, MY - M.r.farm[1]] });
    f.hand = add(lerp(sh, hip, .3), perp(sub(sh, hip), [0, -1]), M.r.chest * .9); f.elbow = meet(fsh, F.uarm, f.hand, F.farm, [-.3, -1]);   // 남자 등을 감싸 안음
    return { m, f, act: 'm', dir: unit(sub(fhip, hip)) };
  },
  // 후배위: 여자는 무릎과 팔꿈치로 엎드려 엉덩이를 들고, 남자는 뒤에서 무릎 꿇고 상체를 40°쯤 숙인 채 두 손으로 여자 골반을 잡음
  //   상체는 골반을 따라 앞뒤로 움직이고, 세게 밀 땐 조금 더 숙여짐. 끝나면 앞으로 무너지듯 숙임
  doggy(s, M, F) {
    const fknee = [178, MY - F.r.shin[0] + 1 + s.sink * .3], fhip = polar(fknee, -1.66 + s.bs / F.thigh, F.thigh);
    const felbow = [118 + s.bs * .3, MY - F.r.farm[0]], fsh = meet(fhip, F.torso, felbow, F.uarm, [0, -1]);
    const f = legsBack(F, trunk(F, fsh, fhip, perp(sub(fsh, fhip), [0, 1]), -.35, s.jig.f), fknee);
    Object.assign(f, { elbow: felbow, hand: [felbow[0] - F.farm, MY - F.r.farm[1]] });
    const knee = [fknee[0] + 26, MY - M.r.shin[0] + 1], hip = add(polar(knee, -1.66 + s.d / M.thigh, M.thigh), [0, s.tr + 4 * s.slump]);
    const lean = -2.24 - .04 * Math.max(0, -s.d) - .4 * s.slump;   // 상체를 40°쯤 앞으로 → 끝나면 더 숙임 (이불이 등 위로 덮임)
    const sh = polar(hip, lean, M.torso);
    const m = legsBack(M, trunk(M, sh, hip, perp(sub(sh, hip), [0, 1]), .3, s.jig.m), knee);
    const hand = add(f.hip, [-1.5, -F.r.hip * .75]);   // 여자 골반 위
    Object.assign(m, { hand, elbow: meet(sh, M.uarm, hand, M.farm, [.6, .8]) });
    return { m, f, act: 'm', dir: unit(sub(fhip, hip)) };
  },
  // 기승위: 남자는 등을 대고 누움, 여자는 남자 골반 위에 무릎 꿇고 앉아 앞으로 숙여 남자 머리 옆을 짚음. 엉덩이가 오르내림
  cowgirl(s, M, F) {
    const [msh, mhip] = lie(M, 104, s.sink, s.bs * .3);
    const m = trunk(M, msh, mhip, [0, -1], .28, s.jig.m);
    m.knee = [mhip[0] + M.thigh * .97, MY - M.r.thigh[1] - 3]; m.ankle = [m.knee[0] + M.shin * .98, MY - M.r.shin[1]]; m.toe = [m.ankle[0] + 3, m.ankle[1] - M.foot * .8];
    const knee = [mhip[0] - 47, MY - F.r.shin[0] + 1 + s.sink * .5], hip = add(polar(knee, -.56 - .6 * s.d / F.thigh, F.thigh), [0, s.tr + 4 * s.slump + s.sink]);
    const hand = [msh[0] + 12, MY - 2 * M.r.chest + 2 + s.sink], sh = meet(hip, F.torso, hand, (F.uarm + F.farm) * (.62 - .12 * s.slump), [0, -1]);
    const f = legsBack(F, trunk(F, sh, hip, perp(sub(sh, hip), [0, 1]), .25, s.jig.f), knee);
    Object.assign(f, { hand, elbow: meet(sh, F.uarm, hand, F.farm, [1, 0]) });
    m.hand = add(hip, [4, 3]); m.elbow = meet(msh, M.uarm, m.hand, M.farm, [.2, 1]);   // 남자 손은 여자 엉덩이
    return { m, f, act: 'f', dir: [0, 1] };
  },
  // 엎드려: 여자는 엎드려 눕고(얼굴은 베개), 남자는 위에 엎드려 팔꿈치로 짚음. 엉덩이 위로 내려찍음
  prone(s, M, F) {
    const [fsh, fhip] = lie(F, 104, s.sink, s.bs);
    fsh[1] += 2; fhip[1] += 1;
    const f = trunk(F, fsh, fhip, [0, 1], -.15, s.jig.f);
    f.knee = [fhip[0] + F.thigh, MY - F.r.thigh[1] + 1]; f.ankle = [f.knee[0] + F.shin, MY - F.r.shin[1]]; f.toe = [f.ankle[0] + F.foot * .85, MY - 2];
    f.elbow = [fsh[0] - 6, MY - F.r.uarm[1] - 2]; f.hand = [f.elbow[0] - F.farm, MY - F.r.farm[1] - 6];   // 팔은 베개 밑으로
    const knee = [f.knee[0] + 6, MY - M.r.shin[0] + 1], hip = add(polar(knee, -2.52 + s.d / M.thigh, M.thigh), [0, s.tr + 3 * s.slump + s.sink]);
    const elbow = [fsh[0] + 12 + s.bs * .5, MY - M.r.farm[0]], sh = meet(hip, M.torso, elbow, M.uarm * (1 - .25 * s.slump), [0, -1]);
    const m = legsBack(M, trunk(M, sh, hip, perp(sub(sh, hip), [0, 1]), .3, s.jig.m), knee);
    Object.assign(m, { elbow, hand: [elbow[0] - M.farm, MY - M.r.farm[1]] });
    return { m, f, act: 'm', dir: unit([.25, 1]) };
  },
  // 역기승위: 남자는 등을 대고 누움(무릎 살짝 세움), 여자는 남자 골반 위에 발 쪽을 보고 무릎 꿇고 앉아 앞으로 숙여 남자 무릎을 짚음. 남자 손은 여자 엉덩이
  reverse(s, M, F) {
    const [msh, mhip] = lie(M, 96, s.sink, s.bs * .3);
    const m = trunk(M, msh, mhip, [0, -1], .28, s.jig.m);
    m.knee = [mhip[0] + M.thigh * .9, MY - M.r.thigh[1] - 8]; m.ankle = [m.knee[0] + M.shin * .95, MY - M.r.shin[1]]; m.toe = [m.ankle[0] + 3, m.ankle[1] - M.foot * .8];
    const knee = [mhip[0] + 30, MY - F.r.shin[0] + 1 + s.sink * .5], hip = add(polar(knee, -2.6 + .6 * s.d / F.thigh, F.thigh), [0, s.tr + 4 * s.slump + s.sink]);
    const hand = [m.knee[0] - 6, m.knee[1] - M.r.thigh[1] - 3 + s.sink], sh = meet(hip, F.torso, hand, (F.uarm + F.farm) * (.56 - .08 * s.slump), [0, -1]);
    const f = trunk(F, sh, hip, perp(sub(sh, hip), [0, 1]), .25, s.jig.f);
    Object.assign(f, { knee, ankle: [knee[0] - F.shin, MY - F.r.shin[1]], hand, elbow: meet(sh, F.uarm, hand, F.farm, [-1, 0]) });
    f.toe = [f.ankle[0] - F.foot * .8, MY - 2];
    m.hand = add(hip, [-3, 4]); m.elbow = meet(msh, M.uarm, m.hand, M.farm, [.2, 1]);
    return { m, f, act: 'f', dir: [0, 1] };
  },
  // 좌위: 남자는 책상다리로 앉아 살짝 뒤로 기댐, 여자는 남자 무릎 위에 마주 앉아 팔로 목을 감고 다리로 허리를 감음. 여자가 오르내림
  lotus(s, M, F) {
    const mhip = [132, MY - M.r.butt + 3 + s.sink * .5], msh = polar(mhip, -1.75 - .1 * s.slump, M.torso);
    const m = trunk(M, msh, mhip, perp(sub(msh, mhip), [1, 0]), .2, s.jig.m);
    Object.assign(m, { knee: [mhip[0] + 40, MY - M.r.thigh[1] - 6], ankle: [mhip[0] + 16, MY - M.r.shin[1] - 1], toe: [mhip[0] + 8, MY - 3] });
    const lift = Math.max(0, s.d) * .55 + s.tr, fhip = [mhip[0] + 20, mhip[1] - 16 - lift + s.sink * .5 + 3 * s.slump], fsh = polar(fhip, -1.45 + .12 * s.slump, F.torso);
    const f = trunk(F, fsh, fhip, perp(sub(fsh, fhip), [-1, 0]), .22, s.jig.f);
    f.hand = add(m.neck, [-7, 3]); f.elbow = meet(fsh, F.uarm, f.hand, F.farm, [0, -1]);
    f.ankle = [mhip[0] - 30, mhip[1] - 4]; f.knee = meet(fhip, F.thigh, f.ankle, F.shin, [0, -1]); f.toe = [f.ankle[0] - 6, f.ankle[1] + 5];   // 다리로 허리를 감음 (발목은 남자 등 뒤)
    m.hand = add(f.waist, f.front, -F.r.waist * .9); m.elbow = meet(msh, M.uarm, m.hand, M.farm, [0, 1]);
    return { m, f, act: 'f', dir: [0, 1] };
  },
  // 굴곡위: 여자는 등을 대고 골반을 말아 올리고 다리를 남자 어깨에 걸침, 남자는 무릎 꿇고 팔을 펴 여자 어깨 옆을 짚음. 팔은 머리 위 베개로
  legsUp(s, M, F) {
    let [fsh, fhip] = lie(F, 100, s.sink, s.bs);
    fhip = [fhip[0] - 4, fhip[1] - 7];
    const f = trunk(F, fsh, fhip, [0, -1], .28, s.jig.f);
    const knee = [fhip[0] + 28, MY - M.r.shin[0] + 1], hip = add(polar(knee, -2.4 + s.d / M.thigh, M.thigh), [0, s.tr + 4 * s.slump + s.sink]);
    const hand = [fsh[0] - 10, MY - M.r.farm[1]], sh = meet(hip, M.torso, hand, (M.uarm + M.farm) * (.92 - .12 * s.slump), [0, -1]);
    const m = legsBack(M, trunk(M, sh, hip, perp(sub(sh, hip), [0, 1]), .35, s.jig.m), knee);
    Object.assign(m, { hand, elbow: meet(sh, M.uarm, hand, M.farm, [1, 0]) });
    f.ankle = add(sh, [3, -5]); f.knee = meet(fhip, F.thigh, f.ankle, F.shin, [1, -.3]); f.toe = polar(f.ankle, -1.9, F.foot * .8);
    f.hand = [fsh[0] - 26, MY - 18]; f.elbow = meet(fsh, F.uarm, f.hand, F.farm, [0, -1]);
    return { m, f, act: 'm', dir: unit(sub(fhip, hip)) };
  },
  // 뒤로 앉기: 남자는 다리를 뻗고 앉아 뒤로 기댐, 여자는 남자 무릎 위에 등을 대고 앞(발 쪽)을 보고 앉아 남자 무릎을 짚고 오르내림. 남자 팔은 여자 배를 감음
  seated(s, M, F) {
    const mhip = [118, MY - M.r.butt + 3 + s.sink * .5], msh = polar(mhip, -1.95 - .1 * s.slump, M.torso);
    const m = trunk(M, msh, mhip, perp(sub(msh, mhip), [1, 0]), .2, s.jig.m);
    m.knee = [mhip[0] + M.thigh * .96, MY - M.r.thigh[1] - 5]; m.ankle = [m.knee[0] + M.shin * .97, MY - M.r.shin[1]]; m.toe = [m.ankle[0] + 3, m.ankle[1] - M.foot * .8];
    const lift = Math.max(0, s.d) * .55 + s.tr, fhip = [mhip[0] + 24, mhip[1] - 14 - lift + s.sink * .5 + 3 * s.slump];
    const hand = [m.knee[0] - 4, m.knee[1] - M.r.thigh[1] - 2], fsh = meet(fhip, F.torso, hand, (F.uarm + F.farm) * (.8 - .1 * s.slump), [0, -1]);
    const f = trunk(F, fsh, fhip, perp(sub(fsh, fhip), [1, 0]), .25, s.jig.f);
    Object.assign(f, { hand, elbow: meet(fsh, F.uarm, hand, F.farm, [-1, 0]), knee: add(fhip, polar([0, 0], -.35, F.thigh)) });
    f.ankle = [f.knee[0] + 10, MY - F.r.shin[1]]; f.toe = [f.ankle[0] + F.foot * .8, MY - 2];
    m.hand = add(f.waist, f.front, F.r.waist * .8); m.elbow = meet(msh, M.uarm, m.hand, M.farm, [0, 1]);
    return { m, f, act: 'f', dir: [0, 1] };
  },
  /* ── 서서 하는 곳 (골목·화장실, 바닥 FY · 왼쪽 벽 WX) ── */
  // 벽에 기대어: 여자는 벽에 등을 대고 한쪽 다리를 남자 허리에 감음(팔은 목을 감음), 남자는 마주 서서 여자 허벅지·골반을 받침
  wall(s, M, F) {
    const fhip = [WX + F.r.butt + 4 + s.bs * .25, FY - (F.shin + F.thigh) * .96 - 3 + s.tr * .3], fsh = polar(fhip, -1.67, F.torso);
    const f = trunk(F, fsh, fhip, [1, 0], .12, s.jig.f);
    const hip = [fhip[0] + F.r.hip * .8 + M.r.hip * .8 + Math.max(-3, s.d), fhip[1] + 3 + s.tr + 2 * s.slump], sh = polar(hip, -1.7 - .12 * s.slump, M.torso);
    const m = trunk(M, sh, hip, [-1, 0], .15, s.jig.m);
    const stand = (B, J, ax, pref, ax2) => {
      J.ankle2 = [ax2, FY - B.r.foot[0]]; J.knee2 = meet(J.hip, B.thigh, J.ankle2, B.shin, pref); J.toe2 = [J.ankle2[0] + pref[0] * B.foot * .8, FY - 1.2];
      if (ax != null) { J.ankle = [ax, FY - B.r.foot[0]]; J.knee = meet(J.hip, B.thigh, J.ankle, B.shin, pref); J.toe = [J.ankle[0] + pref[0] * B.foot * .8, FY - 1.2]; }
    };
    stand(M, m, hip[0] + 7, [-1, 0], hip[0] + 15);
    stand(F, f, null, [1, 0], fhip[0] + 3);
    f.ankle = add(m.butt, [M.r.butt * .9, 3]); f.knee = meet(fhip, F.thigh, f.ankle, F.shin, [.2, -1]); f.toe = polar(f.ankle, 2.2, F.foot * .7);   // 남자 허리를 감은 다리
    f.hand = add(m.neck, [3, 1]); f.elbow = meet(fsh, F.uarm, f.hand, F.farm, [0, -1]);
    m.hand = add(f.knee, [-2, 4]); m.elbow = meet(sh, M.uarm, m.hand, M.farm, [.3, 1]);
    return { m, f, act: 'm', dir: unit(sub(fhip, hip)) };
  },
  // 뒤에서 선 채로: 여자는 벽을 보고 두 손으로 벽을 짚고 허리를 숙임, 남자는 뒤에 서서 두 손으로 여자 골반을 잡음
  standBack(s, M, F) {
    const fhip = [WX + 62 + s.bs * .3, FY - (F.shin + F.thigh) * .93 + s.tr * .2], fsh = polar(fhip, -2.62 + .15 * s.slump, F.torso);
    const f = trunk(F, fsh, fhip, perp(sub(fsh, fhip), [0, 1]), -.2, s.jig.f);
    f.hand = [WX + 1.5, fsh[1] - 9]; f.elbow = meet(fsh, F.uarm, f.hand, F.farm, [.2, 1]);   // 두 손을 뻗어 벽을 짚음
    f.ankle = [fhip[0] - 3, FY - F.r.foot[0]]; f.knee = meet(fhip, F.thigh, f.ankle, F.shin, [-1, 0]); f.toe = [f.ankle[0] - F.foot * .8, FY - 1.2];
    f.ankle2 = [fhip[0] + 6, FY - F.r.foot[0]]; f.knee2 = meet(fhip, F.thigh, f.ankle2, F.shin, [-1, 0]); f.toe2 = [f.ankle2[0] - F.foot * .8, FY - 1.2];
    const hip = [fhip[0] + F.r.butt + M.r.hip * .55 + 1 + Math.max(-3, s.d), fhip[1] + 1.5 + s.tr + 2 * s.slump], sh = polar(hip, -1.82 - .35 * s.slump, M.torso);
    const m = trunk(M, sh, hip, perp(sub(sh, hip), [-1, 0]), .2, s.jig.m);
    m.ankle = [hip[0] + 5, FY - M.r.foot[0]]; m.knee = meet(hip, M.thigh, m.ankle, M.shin, [-1, 0]); m.toe = [m.ankle[0] - M.foot * .8, FY - 1.2];
    m.ankle2 = [hip[0] + 14, FY - M.r.foot[0]]; m.knee2 = meet(hip, M.thigh, m.ankle2, M.shin, [-1, 0]); m.toe2 = [m.ankle2[0] - M.foot * .8, FY - 1.2];
    m.hand = add(f.hip, [-1, -F.r.hip * .8]); m.elbow = meet(sh, M.uarm, m.hand, M.farm, [.4, 1]);
    return { m, f, act: 'm', dir: unit(sub(fhip, hip)) };
  },
  // 변기에 앉아: 남자는 닫힌 변기 뚜껑에 앉아 물탱크 쪽으로 살짝 기댐, 여자는 마주 보고 무릎 위에 올라앉아 목을 감음. 여자가 오르내림
  seatLap(s, M, F) {
    const mhip = [WX + 32, FY - 36 - M.r.butt * .55 + s.sink * .3], msh = polar(mhip, -1.74 - .1 * s.slump, M.torso);
    const m = trunk(M, msh, mhip, perp(sub(msh, mhip), [1, 0]), .2, s.jig.m);
    m.knee = [mhip[0] + M.thigh * .97, mhip[1] - 2]; m.ankle = [m.knee[0] + 3, FY - M.r.foot[0]]; m.toe = [m.ankle[0] + M.foot * .8, FY - 1.2];
    const lift = Math.max(0, s.d) * .55 + s.tr, fhip = [mhip[0] + 17, mhip[1] - 13 - lift + 3 * s.slump], fsh = polar(fhip, -1.72 - .08 * s.slump, F.torso);
    const f = trunk(F, fsh, fhip, perp(sub(fsh, fhip), [-1, 0]), .22, s.jig.f);
    f.hand = add(m.neck, [-5, 3]); f.elbow = meet(fsh, F.uarm, f.hand, F.farm, [0, -1]);
    f.ankle = [fhip[0] + 12, FY - F.r.foot[0]]; f.knee = meet(fhip, F.thigh, f.ankle, F.shin, [-1, -.2]); f.toe = [f.ankle[0] + F.foot * .7, FY - 1.2];
    m.hand = add(f.butt, [3, -1]); m.elbow = meet(msh, M.uarm, m.hand, M.farm, [0, 1]);
    return { m, f, act: 'f', dir: [0, 1] };
  },
};
// 체위 바꿀 때: 두 체위의 관절을 k만큼 섞음
function blendPose(A, B, k) {
  const mix = (a, b) => { const o = {}; for (const key in b) o[key] = Array.isArray(a[key]) && Array.isArray(b[key]) ? lerp(a[key], b[key], k) : b[key]; return o; };
  const m = mix(A.m, B.m), f = mix(A.f, B.f);
  m.front = unit(m.front); f.front = unit(f.front);
  return { m, f, act: k < .5 ? A.act : B.act, dir: k < .5 ? A.dir : B.dir };
}
// 절정 반응: 머리(목 위)를 어깨 기준으로 돌림 — 젖힘(몸 뒤쪽으로, 등도 살짝 휨) / 파묻음(몸 앞쪽·바닥으로). jx·jy: 떨림
function headReact(J, k, bury, jx, jy) {
  const v = sub(J.head, J.sh), side = bury ? J.front : scale(J.front, -1), sg = -v[1] * side[0] + v[0] * side[1] >= 0 ? 1 : -1;
  const a = sg * k * (bury ? .5 : .62), c = Math.cos(a), sn = Math.sin(a);
  const rot = pt => { const d = sub(pt, J.sh); return [J.sh[0] + d[0] * c - d[1] * sn + jx, J.sh[1] + d[0] * sn + d[1] * c + jy]; };
  J.head = rot(J.head); J.neck = rot(J.neck);
  if (!bury) J.waist = add(J.waist, J.front, 2.6 * k);
  if (J.breast) J.breast = add(J.breast, [jx * .5, jy * .5]);
}
const POSE_LABEL = { missionary: '정상위', doggy: '후배위', cowgirl: '기승위', prone: '엎드려서', reverse: '역기승위', lotus: '좌위', legsUp: '굴곡위', seated: '뒤로 앉기', wall: '벽에 기대어', standBack: '뒤에서 선 채로', seatLap: '변기에 앉아' };
// 절정 때 상대 고개: 엎드린 체위는 베개에 파묻고, 나머지는 뒤로 젖힘
const BURY = { doggy: 1, prone: 1, standBack: 1 };
// 초상화 속 인물: 상대가 받는 쪽이면 부딪힐 때마다 밀렸다 돌아오고(방향은 체위마다), 움직이는 쪽(기승위·역기승위·좌위·뒤로 앉기)이면 박자를 따라 오르내림
//   칸(초상화 테두리)은 그대로, 인물·머리·가슴이 따로 움직임 — 머리는 살짝 늦게, 가슴은 관성으로 출렁임
const PUSH = { missionary: [0, -1], legsUp: [0, -1], doggy: [.55, -.6], prone: [.35, -.65], cowgirl: [0, .6], reverse: [0, .6], lotus: [0, .5], seated: [0, .6], wall: [-.2, -.9], standBack: [.55, -.6], seatLap: [0, .6] };
// 섹스 기술 등급(F~SSS)에 따라 받는 쪽 더미가 반응하는 모양 — 같은 체위라도 천차만별
//   [마중(깊이 들어올 때 골반을 맞춰 밀어붙임, −면 살짝 피함), 휨(가슴을 내밀고 허리가 휨), 골반 굴림, 다리 떨림, 고개 젖힘]
//   F·E: 뻣뻣하게 버티다 살짝 피함 / D·C: 약하게 휨 / B·A: 마중하며 허리가 휨 / S 이상: 크게 휘고 골반을 굴리며 다리가 떨리고 고개를 젖힘
const REACT = [[-1.2, 0, 0, 0, .1], [-.6, .3, 0, 0, .2], [.3, .8, .2, 0, .4], [.8, 1.4, .4, .1, .6], [1.4, 2.2, .7, .25, .9],
  [2, 3, 1, .45, 1.2], [2.6, 3.8, 1.4, .7, 1.5], [3, 4.4, 1.7, .9, 1.8], [3.4, 5, 2, 1.1, 2.1]];
// 초상화 배경과 시점 (체위마다): pillow 위에서 내려다봄(베개·시트) / side 베개에 볼을 묻음 / board 앞에서 봄(헤드보드) / ceil 아래에서 올려다봄(천장·조명) / close 마주 보고 가까이(창·달빛)
//   r 기울기, k 확대, x·y 옮김 (초상화 단위)
const VIEW = { missionary: { v: 'pillow', r: -6, k: 1, x: 0, y: 0 }, legsUp: { v: 'pillow', r: 5, k: 1, x: 0, y: 0 }, prone: { v: 'side', r: 14, k: 1.02, x: 4, y: 4 },
  doggy: { v: 'board', r: -4, k: 1.02, x: -2, y: 4 }, cowgirl: { v: 'ceil', r: 0, k: 1.04, x: 0, y: -3 }, reverse: { v: 'ceil', r: 4, k: 1.02, x: 2, y: -2 },
  seated: { v: 'ceil', r: -3, k: 1.02, x: -1, y: -1 }, lotus: { v: 'close', r: 0, k: 1.08, x: 0, y: 2 },
  wall: { v: 'close', r: 2, k: 1.06, x: 0, y: 1 }, standBack: { v: 'board', r: -6, k: 1.02, x: -2, y: 4 }, seatLap: { v: 'close', r: 0, k: 1.08, x: 0, y: 2 } };
// 서서 하는 곳은 초상화 배경도 그 장소 (골목 벽돌 / 화장실 타일)
const viewOf = (name, kind) => kind === 'alley' ? 'brick' : kind === 'toilet' ? 'tile' : (VIEW[name] || VIEW.missionary).v;
// 성격별로 고를 확률
const POSE_W = { shy: { missionary: 4, prone: 1, doggy: 1, cowgirl: .5, lotus: 2, legsUp: .6, reverse: .3, seated: .8 },
  bold: { cowgirl: 3, doggy: 2.5, missionary: 1, prone: 1.5, reverse: 2.5, legsUp: 2, lotus: 1, seated: 1.5 },
  playful: { cowgirl: 2.5, doggy: 2, missionary: 1, prone: 1, reverse: 2, seated: 2, lotus: 1.5, legsUp: 1 } };
const POSE_W0 = { missionary: 2, doggy: 1.5, cowgirl: 1.5, prone: 1, lotus: 1.2, legsUp: 1, reverse: 1, seated: 1 };
// 체위 고르기 (not: 방금 한 체위는 빼고). 주소에 ?pose=doggy 처럼 고정 가능
function pickPose(personality, not) {
  const forced = FORCE_POSE || (location.search.match(/[?&]pose=(\w+)/) || [])[1];
  if (forced && POSES[forced] && (!POOL || POOL.includes(forced))) return forced;
  if (POOL) { const ks = POOL.length > 1 ? POOL.filter(k => k !== not) : POOL; return ks[Math.floor(Math.random() * ks.length)]; }   // 서서 하는 곳: 그 장소의 체위만
  const w = POSE_W[personality] || POSE_W0, ks = Object.keys(w).filter(k => k !== not);
  let r = Math.random() * ks.reduce((a, k) => a + w[k], 0);
  return ks.find(k => (r -= w[k]) < 0) || ks[0];
}
// 캡슐 윗면의 y (x에서). 없으면 Infinity
function capTop([ax, ay, bx, by, ra, rb], x) {
  let top = Infinity, dx = x - ax;
  if (dx * dx < ra * ra) top = ay - Math.sqrt(ra * ra - dx * dx);
  dx = x - bx;
  if (dx * dx < rb * rb) top = Math.min(top, by - Math.sqrt(rb * rb - dx * dx));
  const vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy);
  if (L > Math.abs(ra - rb) + .01) {
    const ux = vx / L, uy = vy / L, sn = (ra - rb) / L, cs = Math.sqrt(1 - sn * sn);
    let px = -uy, py = ux;
    if (py > 0) { px = -px; py = -py; }
    const nx = ux * sn + px * cs, ny = uy * sn + py * cs, x0 = ax + nx * ra, y0 = ay + ny * ra, x1 = bx + nx * rb, y1 = by + ny * rb;
    if (Math.abs(x1 - x0) > .01 && x >= Math.min(x0, x1) && x <= Math.max(x0, x1)) top = Math.min(top, y0 + (x - x0) * (y1 - y0) / (x1 - x0));
  }
  return top;
}
// 캡슐들 → 하나의 채운 path (모든 조각을 같은 방향으로 감아 겹쳐도 구멍이 안 생김)
function capsPath(list) {
  const f = v => v.toFixed(1), ring = (x, y, r) => `M${f(x - r)},${f(y)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0`;
  return list.map(([ax, ay, bx, by, ra, rb]) => {
    let d = ring(ax, ay, ra);
    const vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy);
    if (L > Math.abs(ra - rb) + .01) {
      const ux = vx / L, uy = vy / L, sn = (ra - rb) / L, cs = Math.sqrt(1 - sn * sn);
      const n1 = [ux * sn - uy * cs, uy * sn + ux * cs], n2 = [ux * sn + uy * cs, uy * sn - ux * cs];
      let q = [[ax + n1[0] * ra, ay + n1[1] * ra], [bx + n1[0] * rb, by + n1[1] * rb], [bx + n2[0] * rb, by + n2[1] * rb], [ax + n2[0] * ra, ay + n2[1] * ra]];
      if (q.reduce((s, p, i) => { const r = q[(i + 1) % 4]; return s + p[0] * r[1] - r[0] * p[1]; }, 0) > 0) q = q.reverse();
      d += `M${q.map(p => f(p[0]) + ',' + f(p[1])).join('L')}Z` + ring(bx, by, rb);
    }
    return d;
  }).join('');
}

/* ---------- 박자표 ---------- */
const ease = u => u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
// { t0, T, A(세기), kind: n 보통 | strong 세게 | final 누른 채 떨림 | shift 체위 바꾸기, her: 상대 절정(minor·mid·major), fin: 마무리 }
//   엉덩이는 0(맞닿음) ~ top = 2A(뺀 거리) 사이를 오감. 한 박자 = (세게·떨림이면) 크게 뺐다가 wu → 밀어 넣기 sl(점점 빨라져 끝에 부딪힘 hit)
//   → (떨림이면) 누른 채 떨림 → 다음 박자 시작점(to)으로
// 길이·절정 횟수는 엔진이 정함(sc.flow: 분, 소·중·대절정, 일찍 끝남, 섹스 기술 등급). 시계는 화면 1초 = 6초 (20분이 3분 20초)
//   절정(대체로 뒤로 갈수록 커짐)을 고르게 펼치고 그 사이 4분쯤마다 체위를 바꿈. 절정 앞은 점점 빨라지고 뒤는 잠깐 느려짐
// 박자 성격은 섹스 기술 등급: 높을수록 빠르고 깊고 고르며 '얕게 셋·깊게 하나', 낮으면 들쭉날쭉하고 가끔 멈칫. 부딪힘의 찰짐도 등급을 따름
const SPEED = 6;
const CLIMAX = { minor: { W: 3, strong: 1, finals: [.6], rest: 1.2 }, mid: { W: 4.5, strong: 2, finals: [.95], rest: 2 }, major: { W: 6, strong: 3, finals: [1.15, .9], rest: 3.2 } };
const CLIMAX_LABEL = { minor: '소절정', mid: '중절정', major: '대절정' };
function nightPlan(sc, tier, personality) {
  const good = tier >= 2;
  POOL = STAND_POSES[KIND(sc.spot)] || null;
  const fl = sc.flow || { dur: [2, 4, 7, 10, 13][tier], early: tier === 0, grade: 3, minor: Math.max(0, tier - 1), mid: tier >= 3 ? 1 : 0, major: tier >= 4 ? 1 : 0 };
  const gi = fl.grade ?? 3, T = Math.max(fl.early ? 5 : 8, fl.dur * 60 / SPEED);
  const Tb = .64 - .028 * gi, Tf = .38 - .018 * gi, jit = gi <= 2 ? .22 : gi <= 5 ? .1 : .05, A0 = 2.6 + .45 * gi;
  const S = [], poses = [{ name: pickPose(personality), at: 0 }];
  let t = .9, end = Infinity, bc = 0;   // 처음 0.9초: ♂♀가 양쪽에서 들어와 맞물림
  const add = (T, A, kind = 'n', o) => { S.push(Object.assign({ t0: t, T, A, kind }, o)); t += T; };
  // 박자의 세부 시간 (from 이후만 새로 계산 — 진행 중인 박자는 건드리지 않음)
  const fix = from => {
    for (let i = Math.max(0, from); i < S.length; i++) {
      const s = S[i], nx = S[i + 1];
      s.top = 2 * s.A;
      s.wu = s.kind === 'n' || s.kind === 'shift' ? 0 : s.kind === 'strong' ? .22 : .24;
      s.sl = s.kind === 'shift' ? s.T : s.kind === 'n' ? s.T * .32 : .13;
      s.hit = s.t0 + s.wu + s.sl;
      s.to = !nx || s.kind === 'final' ? 3 : nx.kind === 'n' ? 2 * nx.A : 6;
      s.from = i ? S[i - 1].to : 0;
    }
  };
  // 평소 박자 (u: 0~1 절정을 앞두고 빨라지는 정도)
  function beat(u) {
    const T0 = (Tb + (Tf - Tb) * u) * (1 + (Math.random() * 2 - 1) * jit) * (1 + .08 * Math.sin(t * .7));
    bc++;
    if (gi <= 1 && u < .5 && Math.random() < .07) return add(.45, .6);   // 멈칫
    if (gi >= 6 && bc % 4 === 0) return add(Math.max(.5, T0 * 1.6), A0 + 4 + 2 * u, 'strong');   // 얕게 셋, 깊게 하나
    if (gi >= 3 && gi < 6 && bc % 8 === 0) return add(.62, A0 + 3, 'strong');
    add(T0, Math.max(1, A0 * (.8 + .5 * u) + (Math.random() - .5) * jit * 4));
  }
  const cruise = until => { while (t < until) beat(0); };
  const build = until => { const t0 = t, W = Math.max(.5, until - t0); while (t < until) beat(ease(Math.min(1, (t - t0) / W))); };
  function climax(ty) {
    const c = CLIMAX[ty];
    for (let i = 0; i < c.strong; i++) add(.62 + .04 * i, A0 + 5 + 1.5 * i, 'strong');
    c.finals.forEach((d, i) => add(d, 11 + i, 'final', { her: ty, count: !i }));
    const r0 = t; while (t - r0 < c.rest) add(Tb * 1.25, A0 * .7);   // 숨 고르기
  }
  function finale(fast) {
    if (fast) for (let r = 0; r < 4; r++) add(.27, A0 + 2);
    if (fl.early) { add(.5, 6, 'strong', { fin: true }); add(.48, 5.5, 'final', { fin: true }); end = t; return; }
    if (tier >= 1) { add(.7, good ? 10 : 7, 'strong', { fin: true }); if (good) add(.7, 11, 'strong', { fin: true }); }
    add(good ? .95 : .48, good ? 12 : 5.5, 'final', { fin: true }); if (good) add(.9, 12.5, 'final', { fin: true });
    end = t;
  }
  // 일정
  const types = [].concat(Array(fl.minor || 0).fill('minor'), Array(fl.mid || 0).fill('mid'), Array(fl.major || 0).fill('major'))
    .map(ty => ({ ty, k: { minor: 0, mid: 1, major: 2 }[ty] + Math.random() * 1.6 })).sort((a, b) => a.k - b.k);
  const N = types.length, a0 = T * .14, a1 = T * .94, gap = (a1 - a0) / Math.max(1, N - 1);
  const ev = types.map((x, i) => ({ kind: 'climax', ty: x.ty, at: N === 1 ? T * .7 : a0 + gap * i + (Math.random() - .5) * gap * .4 }));
  const np = fl.early ? 1 : Math.max(1, Math.min(5, 1 + Math.floor(fl.dur / 4)));
  for (let i = 1; i < np; i++) ev.push({ kind: 'pose', at: T * i / np });
  ev.sort((a, b) => a.at - b.at);
  for (const e of ev) {
    if (e.kind === 'pose') { cruise(e.at); e.start = t; poses.push({ name: pickPose(personality, poses[poses.length - 1].name), at: t }); add(1.3, 4, 'shift'); continue; }
    cruise(e.at - CLIMAX[e.ty].W); e.start = t; build(e.at); climax(e.ty);
  }
  cruise(T - 2.5); const fe = { kind: 'end', start: t }; ev.push(fe); build(T); finale(false);
  fix(0);
  let done = false;
  return {
    S, poses, fl, end: () => end, total: () => end,
    // ⏩ 건너뛰기: 다음 일(절정 앞에서 빨라지기 시작·체위 바꾸기·마무리) 직전까지
    next: tt => { if (done) return null; const e = ev.find(x => x.start > tt + 1.2); return e ? e.start - .6 : null; },
    // 종료: 지금 박자는 마저 하고 나머지(절정·체위 바꾸기)를 지운 뒤 마무리
    finish: si => {
      if (done || (S[si] && S[si].fin)) return false;
      done = true;
      S.length = Math.min(S.length, si + 1); t = S[si].t0 + S[si].T;
      while (poses.length > 1 && poses[poses.length - 1].at > t) poses.pop();
      finale(true); fix(si + 1);
      return true;
    },
  };
}

/* ---------- 재생 ---------- */
let raf = 0, ender = null, skipper = null;
function run(stage, job, done) {
  const svg = stage.querySelector('svg'), q = c => svg.querySelector(c), f = v => v.toFixed(1), NS = 'http://www.w3.org/2000/svg';
  const cam = q('.nt-cam'), bed = q('.nt-bed'), quilt = q('.nt-q'), qclip = q('.nt-qc'), stitch = q('.nt-st'), hemEl = q('.nt-hem'), rim = q('.nt-rim'), warm = q('.nt-warm');
  const silF = q('.nt-sf'), silM = q('.nt-sm'), heartsEl = q('.nt-hearts'), fx = q('.nt-fx'), face = stage.querySelector('.nt-face'), folds = svg.querySelectorAll('.nt-f');
  const G = window.Game, { sc, p } = job, tier = [30, 50, 70, 90].filter(v => (sc.sat ?? 50) >= v).length, good = tier >= 2;
  const stand = !!STAND[stage.dataset.kind];   // 골목·화장실: 서서 (이불 없이 실루엣 그대로, 사람은 작게)
  if (stand) WX = WALLX[stage.dataset.kind];
  const debug = /[?&#]dummy/.test(location.href), M = stand ? scaleBody(BODY.m, STAND_K) : BODY.m, F = stand ? scaleBody(BODY.f, STAND_K) : BODY.f;
  const park = stage.dataset.kind === 'park';
  const plan = nightPlan(sc, tier, p.personality), S = plan.S, SLUMP = .7, AFTER = SLUMP + (good ? 1.9 : 2.3);
  let end = plan.end(), END = end + AFTER;
  // 섹스 기술 등급: 부딪힘의 찰짐(snap), 절정 반응의 크기
  const gi = plan.fl.grade ?? 3, snap = .7 + .07 * gi;
  // 체위: 일정대로 바뀌고, 바뀔 때 1.1초 동안 관절을 이어 옮김
  let pi = 0, poseName = plan.poses[0].name;
  stage.dataset.pose = poseName;
  // 그날 밤 아래 줄: 시계(화면 1초 = 6초), 지금 체위, 상대 절정 횟수
  const card = stage.closest('.sc-night'), clockEl = card && card.querySelector('.nt-clock'), poseEl = card && card.querySelector('.nt-pose'), cntEl = card && card.querySelector('.nt-cnt');
  const counts = { minor: 0, mid: 0, major: 0 };
  let clockTxt = '', warpTo = 0, react = null, quiv = null, flashK = 0;
  const showPose = () => { if (poseEl) poseEl.textContent = POSE_LABEL[poseName] || ''; };
  const showCnt = () => { if (cntEl) cntEl.innerHTML = Object.keys(counts).filter(k => counts[k]).map(k => `<span class="c-${k}">${CLIMAX_LABEL[k]} ${counts[k]}</span>`).join(''); };
  showPose();
  const HB = [null, null, { n: .6, strong: 4, fount: 7 }, { n: 1.5, strong: 7, fount: 14 }, { n: 2.6, strong: 10, fount: 22, ring: 12 }][tier];
  const n = CX.length, y = new Float64Array(n), v = new Float64Array(n), surf = new Float64Array(n), sv = new Float64Array(n), rest = new Float64Array(n), hemL = new Float64Array(n), DT = 1 / 240;
  const ms = { d: 0, tr: 0, slump: 0, sink: 0, bs: 0, jig: { f: { butt: [0, 0], breast: [0, 0] }, m: { butt: [0, 0], breast: [0, 0] } } };
  // 출렁이는 살: 붙은 관절이 갑자기 서거나 움직이면 관성으로 어긋났다가 용수철처럼 돌아옴
  const blobs = [['f', 'butt', 'hip'], ['f', 'breast', 'chest'], ['m', 'butt', 'hip']].map(([w, k, at]) => ({ w, k, at, o: [0, 0], v: [0, 0], p1: null, p2: null }));
  // 오른쪽 위 ♂♀: ♂ 화살표는 d를 따라 드나들고, ♀ 원은 부딪힐 때 눌렸다 튕김(symE), 밀림(symX)
  const sym = stage.querySelector('.nt-sym'), sq = c => sym.querySelector(c), symM = sq('.sy-m'), symC = sq('.sy-fill'), symG = sq('.sy-glow'), symH = sq('.sy-h');
  // 화살 길이는 남자 크기(cm)에 비례: 보통(14cm)부터 고리를 꿰뚫고 나감
  const cm = sc.cm || { small: 11, avg: 14, large: 17, xlarge: 20 }[sc.size] || 14, grade = sizeGrade(cm), shaft = 10 + 1.7 * cm;
  // ♂ 화살: 원(반지름 13.5, 굵기 5.2) → 굵은 대(7) → 큰 촉(높이 20) (촉 밑동 hb, 끝 ht). 길이는 크기(cm)에 비례
  const MR = 13.5, MO = MR + 2.6, hb = MR + shaft - 13, ht = MR + shaft;
  sq('.sy-shaft').setAttribute('width', f(hb - MR + .5));
  sq('.sy-head').setAttribute('d', `M${f(hb - 2)},-10 L${f(ht)},0 L${f(hb - 2)},10 Q${f(hb + 2.6)},0 ${f(hb - 2)},-10 Z`);
  sq('.sy-hh').setAttribute('d', `M${f(hb)},-7 L${f(ht - 3.4)},-1.3`);
  // ♀ 고리: 반지름 15를 옆으로 돌려 가로 폭은 0.78배. 맞닿음 = ♂ 원 바깥이 고리 왼쪽(뒤쪽) 끝에 걸림
  const FR = 12, RX0 = FR * .78, GX0 = 106 - RX0 - MO + 1;   // ♀ 고리 반지름 12 (예전 15의 0.8배)
  const E = Object.fromEntries(['back', 'fr', 'spec', 'cross', 'rip', 'tak', 'spark', 'g1', 'g2', 'ouch'].map(k => [k, sq('.sy-' + k)])), GB = sym.querySelector('#syBack'), GF = sym.querySelector('#syFront');
  // 받아들일 수 있는 세기: 체형이 가늘수록 낮음. 크기 × 세기가 넘으면 움찔, 아니면 하트
  const limit = { slim: 1.85, avg: 2.15, fit: 2.25, chubby: 2.35 }[sc.build] || 2.15, symHearts = [], symHS = sq('.sy-hs');
  let symE = 0, symEV = 0, symX = 0, symXV = 0, ouchAt = -9, beatK = 0, beatKV = 0, beatTxt = '', impT = -9, impS = 0, impExit = false, lastGx = null, lastHb = null, gv = 0;
  const beatEl = sq('.sy-beat'), sqEl = sq('.sy-sq'), drops = [];
  let peakUntil = -9, peakKind = '', sqBig = false, sqUntil = -9, lastSq = -9, ringX = 106, ringY = 28, ringRX = 9, ringRY = 12;   // 상대 절정: 초상화·♀ 물
  let t = 0, si = 0, hi = 0, sinkV = 0, bsV = 0, jy = 0, jyV = 0, jx = 0, jxV = 0, heat = 0, shakeAt = -9, shakeK = 0, buzz = 0, fount = 0;
  let P = null, capsM = [], capsF = [], lastD = 0, dEnd = null, faceKey = '', finale = false, acc = 0, last = 0;
  // 초상화 속 인물 (상대 = p): 몸 figX·figY, 머리 늦음 hd, 가슴 출렁 bY (가슴이 클수록 크고 느리게)
  const her = p.gender === 'f' ? 'f' : 'm', chest = ((G && G.look(p) || {}).body || {}).chest, cupK = her === 'f' ? ({ small: .7, large: 1.35 }[chest] || 1) : 0;
  let figX = 0, figY = 0, figVX = 0, figVY = 0, lastVY = 0, hd = 0, hdV = 0, hdR = 0, bY = 0, bV = 0, figEl = null, headEls = [], bustEl = null, bustK = 1, bustCy = 0;
  // 평소 반응 (절정 말고): 섹스 기술 등급·크기에 따라 달아오르는 속도(ar)와 표정·움찔(아픔)·헉·하트가 다름
  let ar = 0, gaspAt = -9, jolt = 0, lastPop = 0;
  const vw = Object.assign({}, VIEW[poseName] || VIEW.missionary), pops = stage.querySelector('.nt-pops');
  if (face) face.dataset.view = viewOf(poseName, stage.dataset.kind);
  function pop(txt, cls) {
    if (!pops) return;
    const el = document.createElement('span');
    el.className = 'nt-pop ' + (cls || '');
    el.textContent = txt;
    el.style.left = (84 + Math.random() * 18) + '%'; el.style.top = (4 + Math.random() * 26) + '%';   // 초상화 오른쪽 가장자리 (얼굴을 가리지 않게)
    pops.appendChild(el);
    setTimeout(() => el.remove(), 1300);
    lastPop = t;
  }
  // 쾌락 게이지: 달아오른 정도(ar)를 만족감 근처까지 따라가고, 절정엔 꽉 참. 끝나면 이번 밤 만족감으로
  const plEl = stage.querySelector('.nt-pl'), plBar = plEl && plEl.querySelector('i'), plNum = plEl && plEl.querySelector('b');
  const satV = (sc.sat ?? 50) / 100, satCap = Math.min(1, satV + .12);
  let pv = 0, pvShown = -1;
  // 말풍선: 소리(신음)와 말 — 만족감 단계·달아오른 정도·성격마다 (data/social.js nightSay)
  const SAYD = ((window.GAME_DATA || {}).nightSay) || null, SY = SAYD && (her === 'm' ? SAYD.m : SAYD), sayEl = stage.querySelector('.nt-say');
  // 사이: 사귀는 사이·배우자·몰래 만나는 사이만 사랑 말(love), 그 밖(원나잇·섹파·썸)은 가볍게(casual) — 억지 러브 없음
  const loverP = !!(p.partner || p.spouse || p.secret), LOVE_RE = SAYD && SAYD.loveRe;
  const linePool = () => {
    const L = [...(SY.line[tier] || []), ...((SY.real || [])[tier] || []), ...(((loverP ? SY.love : SY.casual) || [])[tier] || [])];
    if (DETAIL && SY.more) L.push(...(SY.more[tier] || []).filter(x => loverP || !LOVE_RE || !LOVE_RE.test(x)));   // 디테일: 이름 부르기 등
    return L;
  };
  let lastSay = -9, sayUntil = 0;
  const pickOf = a => a && a.length ? a[Math.floor(Math.random() * a.length)] : '';
  function say(txt, cls, dur = 1.5) {
    if (!sayEl || !txt || (stand && BEDWORD.test(txt))) return;
    sayEl.textContent = txt.includes('{') ? fillT(txt) : txt; sayEl.className = 'nt-say on' + (cls ? ' ' + cls : '');
    sayUntil = t + dur; lastSay = t;
  }
  const hearts = [];
  // ---------- 디테일 모드 (테스트용) ----------
  //   이불 장면: 효과음 글자, 이불 위로 튀는 땀, 열기 아지랑이, 숨결, 시트 주름, 발끝 오므림, 더 크게 흔들리는 침대, 김 서린 창(대절정에 손자국), 바닥에 흩어진 옷·콘돔 포장
  //   초상화: 홍조 번짐·땀·젖은 머리·숨결·자국(avatar.js가 그려 두고 여기서 세기 조절) / 내레이션 자막 / 테스트 수치
  const kind = stage.dataset.kind, WIN = { home: [214, 24, 76, 68], hotel: [196, 12, 110, 116], sea: [196, 12, 110, 116], motel: [110, 22, 70, 70] }[kind];
  const HEADB = { home: [45, 98], hotel: [40, 98], sea: [40, 98], motel: [40, 94] }[kind], KNOCK = { missionary: 1, legsUp: 1, doggy: 1, prone: 1 };
  const fogG = q('.nt-fog'), wrG = q('.nt-wr'), dxG = q('.nt-dx'), narEl = stage.querySelector('.nt-nar'), hudEl = stage.querySelector('.nt-hud');
  const meS = G && G.state ? G.state() : null, lipMe = !!meS && meS.gender === 'f';
  const NARR = ((window.GAME_DATA || {}).nightNarr) || null, gradeTxt = G && G.sexGrades ? G.sexGrades[gi] : '';
  let dxOn = null, dxBuilt = false, fogV = 0, handK = 0, handOn = false, lastSfx = -9, lastSweat = 0, lastNar = -9, narUntil = 0, brPh = 0, brS = 0, mkN = 0, lastMk = -9, gripK = 0, dampV = 0, lastFr = 0, hudAt = -9, narAfter = false;
  let fogEl = null, handEl = null, steamEls = [], wrEl = null, sfxG = null, swG = null, puffG = null, dx = null;
  const sfxs = [], sweats = [], puffs = [];
  const stats = { poses: [poseName], ouch: 0, gasp: 0, maxPl: 0 };
  // 아침 카드의 '어젯밤 기록' — 종료로 넘겨도 그때까지의 값
  LAST = () => ({ poses: stats.poses, ouch: stats.ouch, gasp: stats.gasp, maxPl: Math.round(stats.maxPl * 100), marks: mkN, lip: lipMe, counts: Object.assign({}, counts), dur: plan.fl.dur, early: !!plan.fl.early, pow: plan.fl.pow, grade: gradeTxt, cm, sat: sc.sat, contra: sc.contra, detail: DETAIL });
  const nameOf = () => (G && G.pname ? G.pname(p) : '');
  const fillT = txt => String(txt).replace(/\{p\|(.)\}/g, (_, j) => (G && G.josa ? G.josa(nameOf(), j) : nameOf() + j)).replace(/\{p\}/g, nameOf()).replace(/\{me\}/g, G && G.myGiven ? G.myGiven() || '너' : '너');
  function buildDetail() {
    dxBuilt = true;
    const hc = Avatar.topColor(G.look(p)), mc = Avatar.topColor(G.myLook()), pers = p.personality || 'warm';
    const uc = p.gender === 'f' ? (pers === 'bold' ? '#2a2a2a' : pers === 'shy' ? '#e8dff0' : pers === 'sensitive' ? '#f5e0e4' : '#d4c8b8') : '#3a4a5a';
    if (WIN) {   // 김 서린 창: 시간이 갈수록 뿌옇게, 대절정에 손자국 (닦인 자리로 밤하늘이 보이고 물방울이 흘러내림)
      const [wx, wy, ww, wh] = WIN, sky = SKY[kind][1];
      const hand = `<ellipse cx="0" cy="4" rx="6.2" ry="6.8"/>` + [[-5.6, -3, -22, 1.9, 6.5], [-2.3, -6.5, -7, 1.8, 8], [1.3, -7, 4, 1.8, 8.4], [4.6, -5.6, 15, 1.7, 7.2], [7.4, 1.5, 58, 1.8, 5.6]]
        .map(([x, yy, r, w, l]) => `<rect x="${-w}" y="${-l}" width="${2 * w}" height="${l + 2}" rx="${w}" transform="translate(${x},${yy}) rotate(${r})"/>`).join('');
      fogG.innerHTML = `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="#e3ebff" opacity="0"/>` +
        `<g opacity="0" fill="${sky}" transform="translate(${f(wx + ww * .56)},${f(wy + wh * .5)}) rotate(-8) scale(1.15)">${hand}<path d="M-3,10 v6 M1,10.6 v8 M4.4,9.6 v5 M-6.4,6 v7" stroke="${sky}" stroke-width="1.2" stroke-linecap="round"/></g>`;
      fogEl = fogG.firstChild; handEl = fogG.lastChild;
    }
    const top = (x, yy, c, r, k) => `<g transform="translate(${x},${yy}) rotate(${r}) scale(${k})"><path d="M18,36 C10,28 18,14 36,16 C46,8 70,12 74,22 C86,20 96,30 88,36 C68,42 38,42 18,36 Z" fill="${c}"/><path d="M30,28 Q44,22 56,30 M58,22 Q68,26 76,32" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.8"/></g>`;
    const under = p.gender === 'f' ? `<g transform="translate(138,178) rotate(-10) scale(.62)"><path d="M0,8 Q8,-4 16,8 Q24,-4 32,8 L30,14 Q24,4 16,14 Q8,4 2,14 Z" fill="${uc}" opacity=".9"/><path d="M0,8 Q8,-4 16,8 Q24,-4 32,8" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/><path d="M32,9 q8,3 14,1" fill="none" stroke="${uc}" stroke-width="1.4"/></g>`
      : `<g transform="translate(140,175) rotate(8) scale(.48)"><path d="M0,0 L30,0 L32,22 L18,22 L16,8 L14,22 L0,22 Z" fill="${uc}" opacity=".9"/></g>`;
    const socks = `<path d="M186,183 h6 v-5 h3 v8 h-9 Z" fill="#e9e4dc" opacity=".8" transform="rotate(-14 190 182)"/><path d="M198,186 h7 v-4 h3 v7 h-10 Z" fill="#d9d2c6" opacity=".75" transform="rotate(20 203 184)"/>`;
    const condom = sc.contra === 'condom' || sc.contra === 'both', wp = kind === 'home' || kind === 'motel' ? [25, 127.4] : [284, 181];
    const wrap = condom ? `<g transform="translate(${wp[0]},${wp[1]}) rotate(-14)"><path d="M0,0 h6.4 l-.6,.8 .6,.8 -.6,.8 .6,.8 -.6,.8 .6,.8 -.6,.8 .6,.6 H0 Z" fill="#c9ced8" stroke="#8e95a4" stroke-width=".4"/><circle cx="3" cy="3.2" r="1.9" fill="none" stroke="#e98fb6" stroke-width=".6"/><path d="M6.6,-.4 l1.4,-1.2 .4,1.6 Z" fill="#c9ced8"/></g>` : '';
    dxG.innerHTML = (kind === 'park' ? '' : top(68, 168, hc, -8, .42) + top(226, 166, mc, 12, .44) + under + socks) + wrap +
      `<g class="nt-steam">${[0, 1, 2].map(() => '<path fill="none" stroke="#ffd6e6" stroke-width="1.3" stroke-linecap="round"/>').join('')}</g><g></g><g></g><g></g>`;
    steamEls = [...dxG.querySelectorAll('.nt-steam path')]; [swG, puffG, sfxG] = [...dxG.children].slice(-3);
    wrG.innerHTML = '<path fill="none" stroke="#8f8676" stroke-width=".9" stroke-linecap="round" opacity="0"/>'; wrEl = wrG.firstChild;
  }
  // 효과음 글자: 침대 다리 삐걱, 헤드보드 쿵, 풀숲 바스락, 절정 부르르, 체위 바꿀 때 털썩
  function sfxAt(txt, x, yy, k = 1) {
    if (!sfxG) return;
    const el = document.createElementNS(NS, 'text');
    el.textContent = txt; el.setAttribute('class', 'nt-sfx'); el.setAttribute('text-anchor', 'middle');
    sfxG.appendChild(el);
    sfxs.push({ el, t0: t, x, y: yy, k, rot: (Math.random() - .5) * 22, life: .8 });
    lastSfx = t;
  }
  function sweatAt(cnt) {
    for (let j = 0; j < cnt; j++) {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('d', 'M0,-2.2 Q-1.5,.2 -1.3,1.1 Q0,2.2 1.3,1.1 Q1.5,.2 0,-2.2 Z'); el.setAttribute('fill', '#e3f5ff'); el.setAttribute('stroke', '#8cc5e6'); el.setAttribute('stroke-width', '.4');
      swG.appendChild(el);
      const x = actHip()[0] - 26 + Math.random() * 52, s2 = Math.random() < .5 ? -1 : 1;
      sweats.push({ el, t0: t, x, y: at(y, x) - 2, vx: s2 * (8 + Math.random() * 22), vy: -(38 + Math.random() * 34), life: .7 + Math.random() * .35 });
    }
  }
  function puffAt(x, yy) {
    const el = document.createElementNS(NS, 'ellipse');
    el.setAttribute('fill', '#fff'); puffG.appendChild(el);
    puffs.push({ el, t0: t, x, y: yy, life: 1 });
  }
  function narrate() {
    if (!NARR || !narEl) return;
    const band = tier <= 1 ? 'low' : tier === 2 || ar < .6 ? 'mid' : 'high';
    let pool;
    if (t >= end) pool = NARR.after[good ? 'good' : 'bad'];
    else if (t < peakUntil) pool = NARR.climax[peakKind] || NARR.climax.minor;
    else if (t < 5) pool = NARR.start[good ? 'good' : 'bad'];
    else if (Math.random() < .4 && NARR.pose[poseName]) pool = NARR.pose[poseName][band === 'low' ? 0 : 1];
    else pool = NARR.band[band];
    const txt = pickOf(stand ? (pool || []).filter(x => !BEDWORD.test(x)) : pool);   // 골목·화장실엔 이불·침대 말 없이
    if (!txt) return;
    narEl.textContent = fillT(txt); narEl.classList.add('on'); narUntil = t + 4.4; lastNar = t;
  }
  function detailDraw() {
    if (!dxBuilt) return;
    if (fogEl) { fogEl.setAttribute('opacity', fogV.toFixed(3)); handEl.setAttribute('opacity', (handK * .9 * Math.min(1, fogV / .15)).toFixed(3)); }
    // 열기 아지랑이 (달아오를수록 짙게, 이불 위로 흔들리며 올라감)
    const so = good ? Math.max(0, Math.min(.5, (heat - .3) * .9)) : 0, hx = actHip()[0];
    steamEls.forEach((el, j) => {
      const x0 = hx - 22 + j * 22, y0 = at(y, Math.max(CX[0], Math.min(CX[n - 1], x0))) - 5, w = Math.sin(t * 2.1 + j * 2), w2 = Math.sin(t * 1.7 + j);
      el.setAttribute('d', `M${f(x0)},${f(y0)} C${f(x0 + 4 * w)},${f(y0 - 8)} ${f(x0 - 4 * w2)},${f(y0 - 15)} ${f(x0 + 3 * w)},${f(y0 - 24)}`);
      el.setAttribute('opacity', (so * (.6 + .4 * Math.sin(t * 1.3 + j))).toFixed(3));
    });
    // 시트를 움켜쥔 손 주름 (이불 밖으로 보이는 곳에서만)
    const hh = P[her].hand, gx = hh[0], gy = Math.max(MY - 8, Math.min(MY + 6, hh[1]));
    wrEl.setAttribute('d', [200, 232, 264, 296, 328].map((dg, j) => { const a = dg * Math.PI / 180, r0 = 2.5, r1 = 7 + (j % 2) * 3; return `M${f(gx + r0 * Math.cos(a))},${f(gy + r0 * Math.sin(a) * .5)} Q${f(gx + (r0 + r1) * .5 * Math.cos(a + .25))},${f(gy + (r0 + r1) * .5 * Math.sin(a + .25) * .5)} ${f(gx + r1 * Math.cos(a))},${f(gy + r1 * Math.sin(a) * .5)}`; }).join(''));
    wrEl.setAttribute('opacity', (stand || park ? 0 : gripK * .85).toFixed(3));   // 시트 주름은 침대에서만
    for (let i = sfxs.length - 1; i >= 0; i--) {
      const s2 = sfxs[i], k = (t - s2.t0) / s2.life;
      if (k >= 1) { s2.el.remove(); sfxs.splice(i, 1); continue; }
      const sc2 = s2.k * (k < .15 ? .6 + 3.6 * k : k < .3 ? 1.14 - (k - .15) : 1);
      s2.el.setAttribute('transform', `translate(${f(s2.x)},${f(s2.y - 6 * k)}) rotate(${f(s2.rot)}) scale(${sc2.toFixed(3)})`);
      s2.el.setAttribute('opacity', (k > .6 ? (1 - k) / .4 : 1).toFixed(2));
    }
    for (let i = sweats.length - 1; i >= 0; i--) {
      const d = sweats[i], a = t - d.t0, k = a / d.life;
      if (k >= 1) { d.el.remove(); sweats.splice(i, 1); continue; }
      const vy = d.vy + 170 * a;
      d.el.setAttribute('transform', `translate(${f(d.x + d.vx * a)},${f(d.y + d.vy * a + 85 * a * a)}) rotate(${f(Math.atan2(vy, d.vx) * 57.3 + 90)})`);
      d.el.setAttribute('opacity', (k > .6 ? (1 - k) / .4 : 1).toFixed(2));
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const d = puffs[i], k = (t - d.t0) / d.life;
      if (k >= 1) { d.el.remove(); puffs.splice(i, 1); continue; }
      d.el.setAttribute('cx', f(d.x + 6 * k)); d.el.setAttribute('cy', f(d.y - 7 * k)); d.el.setAttribute('rx', f(2.2 + 5 * k)); d.el.setAttribute('ry', f(1.5 + 3 * k));
      d.el.setAttribute('opacity', ((1 - k) * .32).toFixed(3));
    }
  }
  function detailVis(on) {
    for (const g of [fogG, wrG, dxG]) if (g) g.style.display = on ? '' : 'none';
    if (narEl) narEl.hidden = !on;
    if (hudEl) hudEl.hidden = !on;
  }
  // 받는 쪽 더미의 반응 (섹스 기술 등급 × 달아오른 정도). mine: 상대가 움직이는 쪽(기승위 등)이면 마중 대신 골반을 더 굴림
  function herMotion(J, mine, dir) {
    const R = REACT[Math.max(0, Math.min(8, gi))], e = (good ? .35 + .65 * ar : .3) * (t < end ? 1 : Math.max(0, 1 - (t - end) / SLUMP));
    if (e <= 0 || !J || !J.front) return;
    const deep = Math.max(0, 1 - Math.max(0, ms.d) / 10), toHim = [-dir[0], -dir[1]];
    const meetA = R[0] * e * deep * (mine ? .3 : 1);
    for (const [k, w] of [['hip', 1], ['butt', 1], ['waist', .6], ['chest', .3], ['breast', .3], ['sh', .25], ['knee', .3]]) if (J[k]) J[k] = add(J[k], toHim, meetA * w);
    const arch = R[1] * e * (.55 + .45 * Math.sin(t * (2 + gi * .25)));   // 물결처럼 휘었다 풀림
    for (const [k, w] of [['chest', .7], ['breast', .8], ['sh', 1], ['neck', 1], ['head', 1], ['elbow', .5], ['hand', .2]]) if (J[k]) J[k] = add(J[k], J.front, arch * w);
    if (J.head) J.head = add(J.head, J.front, -R[4] * e * (.6 + .4 * Math.sin(t * 3.7)) * 1.6);   // 고개를 젖힘
    const rw = 3.2 + gi * .2, rl = R[2] * e * (mine ? 1.5 : 1);   // 골반을 둥글게 굴림
    for (const k of ['hip', 'butt']) if (J[k]) J[k] = add(add(J[k], dir, Math.sin(t * rw) * rl), J.front, Math.cos(t * rw) * rl * .6);
    if (ar > .35) { const sh2 = R[3] * e * (ar - .35) * 2; for (const [k, ph] of [['knee', 0], ['ankle', 1.3], ['toe', 2.1]]) if (J[k]) J[k] = add(J[k], [Math.sin(t * 47 + ph), Math.cos(t * 53 + ph)], sh2); }   // 다리가 떨림
  }
  function poseNow() {
    pi = Math.min(pi, plan.poses.length - 1);
    while (pi < plan.poses.length - 1 && t >= plan.poses[pi + 1].at) {
      pi++; poseName = plan.poses[pi].name; stage.dataset.pose = poseName; showPose(); if (face) face.dataset.view = viewOf(poseName, stage.dataset.kind);
      stats.poses.push(poseName);
      if (DETAIL && P) sfxAt('털썩', actHip()[0], at(y, actHip()[0]) - 12, 1.05);
    }
    const cur = POSES[poseName](ms, M, F), at0 = plan.poses[pi].at;
    return pi && t - at0 < 1.1 ? blendPose(POSES[plan.poses[pi - 1].name](ms, M, F), cur, ease((t - at0) / 1.1)) : cur;
  }
  // 움직이는 쪽 엉덩이 d, 떨림 tr, 축 늘어짐
  function drive() {
    while (si < S.length - 1 && t >= S[si].t0 + S[si].T) si++;
    const s = S[si];
    if (t >= end) {
      if (dEnd == null) dEnd = lastD;
      const u = Math.min(1, (t - end) / SLUMP);
      return [dEnd + (-1 - dEnd) * ease(u), 0, ease(u)];
    }
    if (t < s.t0) return [0, 0, 0];
    const tau = t - s.t0, rel = s.t0 + s.T - (s.kind === 'final' ? .14 : 0), u = t - s.hit;
    if (s.kind === 'shift') { const k = Math.min(1, tau / s.T); lastD = s.from + (s.to - s.from) * ease(k) + 9 * Math.sin(Math.PI * k); return [lastD, 0, 0]; }   // 체위 바꾸기: 잠깐 떨어졌다가
    const squish = s.top * .08 * Math.exp(-u * 18) * Math.sin(6.283 * 7 * u);   // 부딪힌 뒤 살이 눌렸다 튕김
    let d, tr = 0;
    if (tau < s.wu) d = s.from + (s.top - s.from) * ease(tau / s.wu);
    else if (tau < s.wu + s.sl) d = (s.wu ? s.top : s.from) * (1 - ((tau - s.wu) / s.sl) ** 2.3);   // 점점 빨라져 부딪힘
    else if (s.kind === 'final') {
      // 세게 누른 채 부들부들 떨림, 끝에 살짝 풀림
      const env = (1 - Math.exp(-u * 30)) * (good ? 1 : .35) * (t > rel ? 1 - (t - rel) / .14 : 1);
      tr = env * .9 * Math.sin(6.283 * 15 * u);
      d = env * (1.5 * Math.sin(6.283 * 12 * u) + .7 * Math.sin(6.283 * 19 * u)) - squish + (t > rel ? 3 * ease((t - rel) / .14) : 0);
      buzz = env;
    } else d = s.to * ease(u / (s.t0 + s.T - s.hit)) - squish;
    lastD = d;
    return [d, tr, 0];
  }
  function surface(i) {
    const x = CX[i];
    let top = stand ? FY : Math.min(MY, park ? Infinity : capTop([62, 122, 98, 122, 6, 6], x));   // 베개 (공원·골목·화장실엔 없음)
    for (const c of capsF) top = Math.min(top, capTop(c, x));
    for (const c of capsM) top = Math.min(top, capTop(c, x));
    return top - 3.2;
  }
  // 하트 하나 (화면 위로 넘어가지 않게 떠오름)
  function heart(x, y0, o = {}) {
    const el = document.createElementNS(NS, 'use');
    el.setAttribute('href', '#ntH');
    heartsEl.appendChild(el);
    hearts.push({ el, t0: t, x, y: y0, life: o.life || 1.6 + Math.random() * .7, dx: o.dx || 0, dy: Math.max(o.dy ?? -(40 + Math.random() * 26), 12 - y0), sway: o.dx ? 0 : (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 4), fq: .8 + Math.random() * .5, ph: Math.random() * 6.3, s: o.s || .65 + Math.random() * .4, big: !!o.big });
  }
  const at = (arr, x) => { const k = Math.max(0, Math.min(n - 1.001, (x - CX[0]) / (CX[n - 1] - CX[0]) * (n - 1))), i = Math.floor(k); return arr[i] + (arr[i + 1] - arr[i]) * (k - i); };
  const actHip = () => P[P.act].hip;
  const burstAt = (cnt, o) => { for (let j = 0; j < cnt; j++) { const x = actHip()[0] - 30 + Math.random() * 60; heart(x, at(y, x) - 6, typeof o === 'function' ? o(j) : o); } };
  // ♀ 고리 위로 튀어나오는 작은 하트
  function symHeart() {
    const el = document.createElementNS(NS, 'use');
    el.setAttribute('href', '#ntH');
    symHS.appendChild(el);
    const side = Math.random() < .5 ? -1 : 1;
    symHearts.push({ el, t0: t, x: 106 + side * (4 + Math.random() * 6), dx: side * (10 + Math.random() * 18), dy: -(4 + Math.random() * 7), s: .36 + Math.random() * .2 });   // 고리 위에서 양옆으로 퐁퐁
  }
  // ♀ 고리에서 물이 뿜어져 나옴: 고리 오른쪽 아래에서 위·오른쪽으로 부채꼴 (pw: 세기)
  function squirt(cnt, pw) {
    for (let j = 0; j < cnt; j++) {
      const el = document.createElementNS(NS, 'path');
      el.setAttribute('d', 'M2.3,0 C2.3,1.35 1.1,1.7 0,1.45 L-3.4,0 L0,-1.45 C1.1,-1.7 2.3,-1.35 2.3,0 Z');
      el.setAttribute('fill', 'url(#syDrop)');
      sqEl.appendChild(el);
      const a = -1.4 + Math.random() * 1.3, sp = (60 + Math.random() * 62) * pw;
      drops.push({ el, t0: t, x: ringX + ringRX * .6, y: ringY + ringRY * .2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .6 + Math.random() * .5, s: .85 + Math.random() * .7 });
    }
  }
  // 상대 절정 (소·중·대): 초상화·고개·떨림·♀ 고리·물·하트가 크기마다 다름
  function climax(s) {
    const ty = s.her, big = ty === 'major', mid = ty === 'mid', amp = .65 + .045 * gi;   // 등급이 높을수록 반응이 큼
    if (SY) say(pickOf(SY.climax[ty]), 'peak', big ? 2.2 : 1.5);
    if (face) { face.classList.remove('flash'); void face.offsetWidth; face.classList.add('flash'); }   // 절정 순간에만 번쩍 (헉·움찔로 표정이 바뀔 때마다 번쩍이지 않게)
    if (DETAIL) {
      const hx = P[her].hip[0];
      sfxAt(big ? '부르르르…' : mid ? '부르르' : '움찔', hx, at(y, Math.max(CX[0], Math.min(CX[n - 1], hx))) - 16, big ? 1.3 : mid ? 1.1 : .9);
      if (big) handOn = true;
      if (t - lastNar > 1.2) lastNar = -9;   // 절정 내레이션을 바로
    }
    ar = Math.max(.35, ar * (big ? .7 : .85));   // 절정 뒤엔 잠깐 가라앉았다 다시
    react = { t0: t, hold: s.t0 + s.T + (big ? .9 : mid ? .4 : 0), k: (big ? 1 : mid ? .62 : .3) * amp };
    peakUntil = Math.max(peakUntil, s.t0 + s.T + (big ? 1.6 : mid ? 1.1 : .5));
    peakKind = ty;
    if (s.count) { counts[ty]++; showCnt(); }
    quiv = { until: s.t0 + s.T + (big ? .8 : .3), amp: big ? .17 : mid ? .09 : .05 };
    symEV += big ? 34 : mid ? 22 : 14; heat = 1;
    if (ty !== 'minor') { sqUntil = s.t0 + s.T - .1; sqBig = big; squirt(big ? 22 : 11, big ? 1.3 : 1.05); }
    if (big) { flashK = 1; shakeAt = t; shakeK = Math.max(shakeK, 1.5); }
    for (let j = big ? 4 : mid ? 2 : 1; j > 0; j--) symHeart();
    if (HB || ty !== 'minor') burstAt(big ? 6 : mid ? 4 : 2, () => ({ s: .8 + Math.random() * .5, dy: -(50 + Math.random() * 30) }));
    if (big && s.count) for (let j = 0; j < 12; j++) { const a = Math.PI * (1.05 + .9 * j / 11), r = 46 + Math.random() * 16, hx = actHip()[0]; heart(hx, at(y, hx) - 4, { dx: Math.cos(a) * r, dy: Math.sin(a) * r * .8 - 10, s: .8 + Math.random() * .3, life: 1.3 }); }
  }
  function impact(s) {
    const str = (s.kind === 'final' ? 2.2 : s.kind === 'strong' ? 1.8 : Math.min(1.2, .45 + .75 * s.A / 7)) * (s.her || s.fin ? 1 : snap);   // 찰짐: 섹스 기술 등급
    sinkV += 40 * str; bsV -= 24 * str; symEV += 17 * str; symXV += 55 * str; beatKV += 9 * str;
    impT = t; impS = Math.min(1.4, str); impExit = GX0 + ht > 106 + RX0 + 1;   // 탁: 부딪힘 선·물결, 촉이 고리 밖으로 나가면 반짝
    const force = str * (.55 + .1 * grade);
    const lim = limit * (1 + gi * .03);   // 섹스 기술이 높을수록 상대가 받아들일 수 있게 맞춰 줌
    if (force > lim) { ouchAt = t; symXV += 60 * str; symEV -= 8; }   // 움찔
    else if (good) for (let j = Math.round(force / 1.2 * [0, 0, 1, 1.6, 2.3][tier]); j > 0; j--) symHeart();
    // 평소 반응: 크기가 체형에 맞을수록(받아들일 수 있는 세기의 80~100%) 빨리 달아오르고 가끔 헉, 넘치면 움찔(질끈 감은 눈), 작으면 잘 못 느낌. 섹스 기술이 높을수록 빨리
    if (!s.her) {
      const fr = force / lim, sizeK = fr > 1 ? .45 : fr > .8 ? 1.3 : fr > .45 ? 1 : .55;
      ar = Math.min(1, ar + .04 * (.35 + gi * .13) * sizeK * (good ? 1 : .35) * (s.kind === 'n' ? 1 : 1.6));
      lastFr = fr;
      if (fr > 1) { stats.ouch++; figVY -= 45 * str; jolt -= .5; if (t - lastPop > .5) pop('!', 'ow'); if (SY && t - lastSay > 1.2 && Math.random() < .6) say(pickOf(SY.ouch), 'ow', 1.1); }
      else if (good && fr > .8 && (s.kind !== 'n' || Math.random() < .1 + gi * .03)) { stats.gasp++; gaspAt = t; jolt += .4; if (t - lastPop > .6) pop(ar > .5 ? '♡' : '!?', 'gasp'); if (SY && t - lastSay > 1 && Math.random() < .5) say(pickOf(SY.gasp), 'gasp', .9); }
      // 디테일: 내가 남긴 자국이 하나씩 (목 → 쇄골 → 가슴 위 → 어깨 손자국은 아주 달아올랐을 때)
      if (DETAIL && good && s.kind !== 'n' && ar > .45 && t - lastMk > 3 && mkN < (ar > .8 ? 7 : 6) && Math.random() < .5) { mkN++; lastMk = t; pop('💋', 'love'); }
    }
    if (DETAIL && t - lastSfx > (s.kind === 'n' ? .5 : .2)) {   // 효과음 글자
      const hard = s.kind !== 'n';
      if (park) { if (hard || Math.random() < .2 + heat * .3) sfxAt('바스락', 90 + Math.random() * 160, 146 + Math.random() * 10, .85); }
      else if (stand) { if (hard || Math.random() < .18 + heat * .3) sfxAt(kind === 'toilet' ? (Math.random() < .5 ? '덜컹' : '쿵') : (Math.random() < .5 ? '탁' : '스윽'), WX + 8 + Math.random() * 10, 60 + Math.random() * 60, .9); }
      else {
        if (hard || Math.random() < .16 + heat * .38) sfxAt(Math.random() < .6 ? '삐걱' : '끼익', Math.random() < .5 ? 60 : 276, 162, .85);
        if (HEADB && KNOCK[poseName] && (hard || (heat > .6 && Math.random() < .22))) sfxAt('쿵', HEADB[0] + Math.random() * 4, HEADB[1], hard ? 1.3 : 1);
      }
    }
    if (DETAIL && good && s.kind !== 'n' && heat > .4 && swG) sweatAt(2);
    jyV += (s.kind === 'n' ? 7 : 22) * str; jxV -= (s.kind === 'n' ? 2.5 : 9) * str;
    const pu = PUSH[poseName] || [0, -1], mine = P.act === her;   // 초상화 인물: 받는 쪽이면 크게 밀리고, 움직이는 쪽이면 내려앉으며 쿵
    figVX += pu[0] * (mine ? 18 : 120) * str; figVY += (mine ? 70 : pu[1] * 120) * str;
    if (s.kind !== 'n') { shakeAt = t; shakeK = str * .8; }
    // 받는 쪽 살을 찰싹 침
    const rcv = P.act === 'm' ? 'f' : 'm', kick = 70 * str;
    for (const b of blobs) if (b.w === rcv) { b.v[0] += P.dir[0] * kick * (b.k === 'butt' ? 1 : .5); b.v[1] += P.dir[1] * kick * (b.k === 'butt' ? 1 : .5); }
    heat = Math.max(heat, good ? Math.min(1, .3 + .3 * str) : .12);
    if (s.her) { climax(s); return; }
    if (!HB) return;
    if (s.kind === 'n') { const m = HB.n * (Math.min(1, s.t0 / 30) * .6 + .4); burstAt(Math.floor(m) + (Math.random() < m % 1 ? 1 : 0), {}); }
    else burstAt(HB.strong, () => ({ s: .95 + Math.random() * .45, dy: -(60 + Math.random() * 26) }));
    if (s.kind === 'final' && HB.ring) for (let j = 0; j < HB.ring; j++) { const a = Math.PI * (1.05 + .9 * j / (HB.ring - 1)), r = 46 + Math.random() * 16, hx = actHip()[0]; heart(hx, at(y, hx) - 4, { dx: Math.cos(a) * r, dy: Math.sin(a) * r * .8 - 10, s: .8 + Math.random() * .3, life: 1.3 }); }
  }
  // 실망: 초상화를 가리키는 말풍선(…), 만족감이 아주 낮으면 깨진 하트
  function letdown() {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<g transform="translate(64,24)"><g class="nt-bub"><path d="M6,0 H38 A6,6 0 0 1 44,6 V16 A6,6 0 0 1 38,22 H6 A6,6 0 0 1 0,16 V14 L-7,10.5 L0,8 V6 A6,6 0 0 1 6,0 Z" fill="#f2eee6"/>${[13, 22, 31].map((x, j) => `<circle class="nt-dot" cx="${x}" cy="11" r="2" fill="#6b6478" style="animation-delay:${.35 + j * .3}s"/>`).join('')}</g></g>` +
      (tier === 0 ? `<g transform="translate(196,48) scale(2.2)"><g class="nt-broke"><path class="l" d="M0,5 C-7,0 -6,-6 -2.5,-6 C-1,-6 0,-5 0,-4 L-1.2,-1.6 L1,.4 L-.9,2.6 Z" fill="#a39bb3"/><path class="r" d="M0,-4 C0,-5 1,-6 2.5,-6 C6,-6 7,0 0,5 L-.9,2.6 L1,.4 L-1.2,-1.6 Z" fill="#a39bb3"/></g></g>` : '');
    fx.appendChild(g);
  }
  function step(settle) {
    t += DT;
    const [d, tr, slump] = settle ? [0, 0, 0] : drive();
    while (!settle && hi < S.length && S[hi].hit <= t) { const b = S[hi++]; if (b.kind !== 'shift') impact(b); }
    sinkV += (-500 * ms.sink - 22 * sinkV) * DT; ms.sink += sinkV * DT;
    bsV += (-300 * ms.bs - 18 * bsV) * DT; ms.bs += bsV * DT;
    jyV += (-900 * jy - 24 * jyV) * DT; jy += jyV * DT;
    jxV += (-700 * jx - 20 * jxV) * DT; jx += jxV * DT;
    Object.assign(ms, { d, tr, slump });
    P = poseNow();
    if (!settle) herMotion(P[her], P.act === her, P.dir);
    if (react && !settle) {   // 상대 절정: 고개를 젖히거나 베개에 파묻고 부들부들
      const a = t - react.t0, env = Math.min(1, a / .15) * (t < react.hold ? 1 : Math.max(0, 1 - (t - react.hold) / .7));
      if (env <= 0 && t > react.hold) react = null;
      else headReact(P.f, react.k * env, BURY[poseName], react.k * env * 1.3 * Math.sin(a * 92), react.k * env * .9 * Math.cos(a * 117));
    }
    if (DETAIL && !settle) {   // 발끝이 오므라듦 (절정·아주 달아올랐을 때)
      const J = P[her], c = react ? Math.min(1, react.k * 1.6) : Math.max(0, (ar - .8) * 3) * (.5 + .5 * Math.sin(t * 2.3));
      if (c > 0 && J.toe && J.ankle) J.toe = lerp(J.toe, add(J.ankle, sub(J.toe, J.ankle), .55), c * .8);
    }
    capsM = caps(M, P.m); capsF = caps(F, P.f);
    if (!settle) {
      // 초상화 인물: 움직이는 쪽이면 d(빼는 정도)를 따라 오르내림(좌위는 작은 원, 역기승위·뒤로 앉기는 살짝 앞뒤), 받는 쪽이면 제자리로 돌아오는 용수철. 끝나면 숨 고르기
      const mine = P.act === her && t < end, after = t >= end;
      const ty = mine ? -ms.d * .85 : after ? 1.4 * Math.sin(t * 2.2) : 0;
      const tx = mine ? (poseName === 'lotus' ? 2.6 * Math.sin(t * 5.2) : poseName === 'reverse' || poseName === 'seated' ? ms.d * .18 : 0) : 0;
      const kk = mine ? 300 : 420, cc = mine ? 21 : 15;
      figVX += (kk * (tx - figX) - cc * figVX) * DT; figVY += (kk * (ty - figY) - cc * figVY) * DT;
      figX += figVX * DT; figY += figVY * DT;
      const acc = (figVY - lastVY) / DT; lastVY = figVY;
      bV += (-520 * bY - 5.5 * bV - acc * .95) * DT; bY += bV * DT;   // 가슴: 몸이 갑자기 서거나 움직이면 늦게 따라오며 출렁
      const bm = 6.5 * cupK; if (Math.abs(bY) > bm) { bY = Math.sign(bY) * bm; bV *= -.3; }
      hdV += (-760 * hd - 16 * hdV - acc * .3) * DT; hd += hdV * DT;   // 머리: 살짝 늦게
      hdR = react ? react.k * Math.max(0, Math.min(1, (t - react.t0) / .15)) * (t < react.hold ? 1 : Math.max(0, 1 - (t - react.hold) / .7)) : hdR * .96;   // 절정: 고개가 젖혀짐
      if (quiv && t < quiv.until) figX += quiv.amp * 6 * Math.sin(t * 88);
      jolt *= Math.exp(-DT * 6);
      if (t < end && t > 1.5) {   // 달아오를수록 하트·땀이 자주, 시큰둥하면 가끔 '…'
        if (good && ar > .55 && t - lastPop > 2.8 - ar * 1.4) pop(ar > .85 && Math.random() < .4 ? '💦' : '♡', 'love');
        else if (!good && t - lastPop > 3.2) pop('…', 'meh');
      }
      const tv = VIEW[poseName] || VIEW.missionary, e = Math.min(1, DT * 3);
      for (const k of ['r', 'k', 'x', 'y']) vw[k] += (tv[k] - vw[k]) * e;
      const pt = t >= end ? satV : t < peakUntil ? (peakKind === 'major' ? 1 : peakKind === 'mid' ? .96 : .9) : Math.min(satCap, ar);
      pv += (pt - pv) * Math.min(1, DT * 3);
      // 말풍선: 달아오를수록 자주. 소리 절반 / 짧은 말 절반 (만족감 단계별 · 실제로 튀어나오는 말 · 사이별, tier 3 이상이면 가끔 성격별 말)
      if (SY && t < end && t > 1.2 && t - lastSay > (good ? 3.4 - ar * 1.7 : 4.6) && t >= peakUntil) {
        if (Math.random() < .48) say(pickOf(SY.moan[!good ? 'bad' : ar < .3 ? 'low' : ar < .65 ? 'mid' : 'high']), 'moan', 1.2);
        else say(tier >= 3 && SY.pers[p.personality] && Math.random() < .25 ? SY.pers[p.personality] : pickOf(linePool()), '', 1.8);
      }
      stats.maxPl = Math.max(stats.maxPl, pv);
      if (DETAIL) {
        // 숨: 달아오를수록 빠르게 (절정·끝난 뒤엔 더 가쁘게). 내쉴 때 이불 장면 머리맡에 숨결
        brPh += DT * 6.283 * (.35 + ar * .9 + (t < peakUntil ? .5 : 0) + (t > end && t < end + 3 ? .4 : 0));
        const bs = Math.sin(brPh);
        if (brS > 0 && bs <= 0 && (ar > .3 || t > end) && puffG) { const hd2 = P[her].head; puffAt(hd2[0] + 4, hd2[1] - 6); }
        brS = bs;
        fogV = Math.min(.42, fogV + DT * (good ? .0022 + heat * .006 : .0006));
        handK += ((handOn ? 1 : 0) - handK) * Math.min(1, DT * 2.5);
        gripK += (((t < end && good) ? Math.max(0, Math.min(1, (ar - .55) * 2.4), t < peakUntil ? 1 : 0) : 0) - gripK) * Math.min(1, DT * 4);
        if (good && t < end && heat > .5 && swG && t - lastSweat > 1 - heat * .6) { lastSweat = t; sweatAt(1); }
        if (t > .8 && (t - lastNar > 5.4 || (t >= end && !narAfter && t > end + .9))) { if (t >= end) narAfter = true; if (t < end || narAfter) narrate(); }
      }
    }
    for (const b of blobs) {
      const pj = P[b.w][b.at];
      if (b.p2) for (let k = 0; k < 2; k++) b.v[k] += (-1200 * b.o[k] - 7 * b.v[k] - (pj[k] - 2 * b.p1[k] + b.p2[k]) / (DT * DT) * .45) * DT;
      b.p2 = b.p1; b.p1 = pj;
      b.o[0] += b.v[0] * DT; b.o[1] += b.v[1] * DT;
      const l = Math.hypot(b.o[0], b.o[1]);
      if (l > 6) { b.o[0] *= 6 / l; b.o[1] *= 6 / l; }
      ms.jig[b.w][b.k] = b.o.slice();
    }
    // 이불: 중력 + 장력(옆 점과의 차이) + 내부 감쇠, 몸에 닿으면 그 위에 얹히고 몸이 올라가는 속도를 받음
    for (let i = 0; i < n; i++) {
      const s0 = surf[i], s1 = surface(i);
      surf[i] = s1; sv[i] = Math.max(-150, Math.min(150, (s1 - s0) / DT));
      const yl = y[i - 1] ?? y[i], yr = y[i + 1] ?? y[i], vl = v[i - 1] ?? v[i], vr = v[i + 1] ?? v[i];
      v[i] += (1500 + 2200 * (yl - 2 * y[i] + yr) + 40 * (vl - 2 * v[i] + vr) - 2 * v[i]) * DT;
    }
    for (let i = 0; i < n; i++) {
      y[i] += v[i] * DT;
      if (y[i] >= surf[i]) { y[i] = surf[i]; v[i] = Math.min(v[i], sv[i]); }
      hemL[i] += ((y[i] - rest[i]) * .32 - hemL[i]) * Math.min(1, DT * 7);
    }
    if (settle) return;
    if (buzz) { shakeK = Math.max(shakeK, .35 * buzz); if (t - shakeAt > .05) shakeAt = t - .02; }
    buzz = 0;
    const cur = S[si];
    if (HB && cur.kind === 'final' && (cur.her || cur.fin) && t >= cur.t0 && t < Math.min(end, cur.t0 + cur.T)) { fount += HB.fount * DT; while (fount >= 1) { fount--; burstAt(1, { s: .8 + Math.random() * .5, dy: -(55 + Math.random() * 35) }); } }
    heat = Math.max(heat * Math.exp(-DT * 1.4), t < end ? (good ? .1 + .4 * Math.min(1, t / 20) : .05) : 0);
    // ♀ 물: 절정 떨림 동안 짧게 여러 번 뿜음
    if (t < sqUntil && t - lastSq > (sqBig ? .13 : .22) + Math.random() * .08) { lastSq = t; squirt((sqBig ? 6 : 3) + Math.floor(Math.random() * 4), (sqBig ? .9 : .7) + Math.random() * .45); }
    flashK = Math.max(0, flashK - DT * 2.2);
    symEV += (-650 * symE - 6 * symEV) * DT; symE += symEV * DT;      // ♀ 고리: 말랑하게 눌렸다 여러 번 출렁이며 돌아옴
    symXV += (-480 * symX - 9 * symXV) * DT; symX += symXV * DT;
    beatKV += (-700 * beatK - 18 * beatKV) * DT; beatK += beatKV * DT;
    if (!finale && t > end + .45) {
      if (good) symH.classList.add('on'); else sym.classList.add('sad');
      finale = true;
      if (good) heart(actHip()[0], at(y, actHip()[0]) - 14, { big: true, s: 1.4 + .3 * tier, life: 1.8, dy: -24 });
      else letdown();
      if (SY) say(pickOf(SY.end[good ? 'good' : 'bad'].concat(good ? SY.end[loverP ? 'love' : 'casual'] || [] : [])), good ? 'peak' : '', 2.4);
      if (DETAIL) sfxAt(good ? '털썩' : '…', actHip()[0], at(y, actHip()[0]) - 14, 1.1);
    }
  }
  // 상대 표정 (관계 중 초상화)
  function faceNow() {
    if (t >= end + .3) return good ? (tier >= 3 ? 'bliss' : 'content') : 'disappointed';
    if (t < peakUntil) return peakKind === 'major' ? 'major' : peakKind === 'mid' ? 'p3' : 'p2';   // 절정: 소 = 풀린 눈, 중 = 성격별 절정 얼굴, 대 = 질끈 감은 눈·벌어진 입
    if (t - ouchAt < .45) return 'wince';   // 아픔·너무 꽉 참
    if (t - gaspAt < .32) return 'gasp';    // 헉
    if (!good) return t / end < (tier ? .4 : .25) ? 'p0' : 'bored';
    const cur = S[si];
    if (cur.fin && cur.kind !== 'n') return 'p3';   // 마무리 (같이)
    return ar < .15 ? 'p0' : ar < .4 ? 'p1' : ar < .7 ? 'p2' : 'p3';   // 달아오른 정도 (섹스 기술·크기에 따라 빠르기가 다름)
  }
  const curve = Q => Q.slice(0, -1).map((b, i) => {
    const a = Q[i - 1] || b, c = Q[i + 1], e = Q[i + 2] || c;
    return ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`;
  }).join('');
  const hemY = x => 150 - 17 * Math.exp(-(((x - 66) / 22) ** 2)) + .9 * Math.sin(x * .13 + .6) + FOLDS.reduce((s, [c, lean]) => s + 1.6 * Math.exp(-(((x - c - lean) / 6) ** 2)), 0) + at(hemL, x);
  function draw() {
    if (dxOn !== DETAIL) { dxOn = DETAIL; if (DETAIL && !dxBuilt) buildDetail(); detailVis(DETAIL); faceKey = ''; }   // 디테일 켜고 끔 (초상화도 다시 그림)
    if (DETAIL) detailDraw();
    const top = CX.map((x, i) => [x, y[i]]), hem = Array.from({ length: 9 }, (_, i) => { const x = 284 - 216 * i / 8; return [x, hemY(x)]; });
    const l = top[0], r = top[n - 1], hr = hem[0], hl = hem[8];
    // 공원 덤불은 윗선을 잎 뭉치처럼 오돌토돌하게 (두 점마다 위로 볼록한 호)
    const scal = Q => Q.filter((_, i) => i % 2 === 0 || i === Q.length - 1).slice(1).map((b, i, arr) => { const a = i ? arr[i - 1] : Q[0], r = Math.hypot(b[0] - a[0], b[1] - a[1]) * .62; return ` A${f(r)},${f(r)} 0 0 1 ${f(b[0])},${f(b[1])}`; }).join('');
    const topD = park ? scal(top) : curve(top);
    const qd = `M${f(l[0])},${f(l[1])}${topD} C285.5,${f(r[1] + 8)} 285.5,${f(hr[1] - 8)} ${f(hr[0])},${f(hr[1])}${curve(hem)} C${f(hl[0] - 5)},${f(hl[1] - 4)} ${f(l[0] - 5)},${f(l[1] + 6)} ${f(l[0])},${f(l[1])} Z`;
    quilt.setAttribute('d', qd); qclip.setAttribute('d', qd);
    rim.setAttribute('d', park ? `M${f(l[0])},${f(l[1] + 1.5)}${scal(top.map(([x, yy]) => [x, yy + 1.5]))}` : `M${f(l[0])},${f(l[1] + .8)}${curve(top.map(([x, yy]) => [x, yy + .8]))}`);
    hemEl.setAttribute('d', `M${f(hr[0])},${f(hr[1] - 1)}${curve(hem.map(([x, yy]) => [x, yy - 1]))}`);
    const sp = top.slice(3, -3).map(([x, yy]) => [x, Math.min(143, yy + 8)]);
    stitch.setAttribute('d', `M${f(sp[0][0])},${f(sp[0][1])}${curve(sp)}`);
    FOLDS.forEach(([x, lean], j) => {
      const yt = at(y, x), y0 = yt + Math.max(6, (147 - yt) * .3), y1 = hemY(x + lean) - 1.2, dyn = Math.max(-5, Math.min(5, -at(v, x) * .02));
      for (let k = 0; k < 2; k++) {
        const o = k * 1.8;
        folds[j * 2 + k].setAttribute('d', `M${f(x + o)},${f(y0 + k)} C${f(x + o - dyn * .4)},${f(y0 + (y1 - y0) * .45)} ${f(x + o + lean * .6 - dyn * .7)},${f(y1 - 5)} ${f(x + o + lean + dyn)},${f(y1)}`);
      }
    });
    // 이불에 비치는 두 사람 실루엣 (실험용이면 색으로)
    const pf = capsPath(shape(F, P.f, false)), pm = capsPath(shape(M, P.m, true));
    if (debug) {
      q('.nt-df').setAttribute('d', pf); q('.nt-dm').setAttribute('d', pm);
      const J = ['head', 'neck', 'sh', 'waist', 'hip', 'knee', 'ankle', 'toe', 'elbow', 'hand'];
      q('.nt-dj').setAttribute('d', ['f', 'm'].map(w => { const j = P[w]; return `M${[j.head, j.sh, j.hip, j.knee, j.ankle, j.toe].map(a => f(a[0]) + ',' + f(a[1])).join('L')}M${[j.sh, j.elbow, j.hand].map(a => f(a[0]) + ',' + f(a[1])).join('L')}` + J.map(k => `M${f(j[k][0] - 1)},${f(j[k][1])}a1,1 0 1,0 2,0a1,1 0 1,0 -2,0`).join(''); }).join(''));
    } else { silF.setAttribute('d', pf); silM.setAttribute('d', pm); }
    const ago = t - shakeAt, sk = ago < .6 ? 1.5 * shakeK * Math.exp(-ago * 10) : 0;
    const cx = sk * Math.sin(ago * 95), cy = sk * .6 * Math.sin(ago * 120 + 1);
    cam.setAttribute('transform', sk > .02 ? `translate(${f(cx)},${f(cy)})` : '');
    const bk = DETAIL ? 1.8 : 1;   // 디테일: 침대가 더 크게 흔들림
    bed.setAttribute('transform', `translate(${(jx * bk).toFixed(2)},${(jy * bk).toFixed(2)})`);
    warm.setAttribute('opacity', Math.min(1, Math.max(heat * .9, flashK)).toFixed(3));
    // 쾌락 게이지·말풍선
    if (plBar) { const v = Math.round(pv * 100); if (v !== pvShown) { pvShown = v; plBar.style.width = v + '%'; plNum.textContent = v; plEl.classList.toggle('hot', v >= 80); } }
    if (sayEl && t > sayUntil && sayEl.classList.contains('on')) sayEl.classList.remove('on');
    if (narEl && t > narUntil && narEl.classList.contains('on')) narEl.classList.remove('on');
    if (DETAIL && hudEl && t - hudAt > .2) {   // 테스트 수치
      hudAt = t;
      const b = S[si], bpm = b && b.kind === 'n' && b.T ? Math.round(60 / b.T) : 0;
      hudEl.textContent = `${gradeTxt} · ${cm}cm 궁합 ${Math.round(lastFr * 100)}% · ${bpm ? bpm + 'bpm' : b ? b.kind : ''} · 달아오름 ${Math.round(ar * 100)} · 만족 ${sc.sat ?? '?'} · 자국 ${mkN}`;
    }
    // 시계 (화면 1초 = 6초)
    if (clockEl) { const gs = Math.floor(Math.min(t, end) * SPEED), txt = `⏱ ${Math.floor(gs / 60)}:${String(gs % 60).padStart(2, '0')}${warpTo > t ? ' ⏩' : ''}`; if (txt !== clockTxt) { clockTxt = txt; clockEl.textContent = txt; } }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i], age = t - h.t0, k = age / h.life;
      if (k >= 1) { h.el.remove(); hearts.splice(i, 1); continue; }
      const pop = k < .12 ? .4 + .7 * k / .12 : k < .2 ? 1.1 - (k - .12) / .8 : 1;
      const lub = h.big ? 1 + .16 * Math.exp(-((((age % .9) - .15) / .045) ** 2)) + .1 * Math.exp(-((((age % .9) - .35) / .045) ** 2)) : 1;
      const w = Math.sin(6.283 * h.fq * age + h.ph), m = 1 - (1 - k) ** 2;
      h.el.setAttribute('transform', `translate(${f(h.x + h.dx * m + h.sway * w)},${f(h.y + h.dy * m)}) rotate(${f(h.sway * 1.6 * Math.cos(6.283 * h.fq * age + h.ph))}) scale(${(h.s * pop * lub).toFixed(3)})`);
      h.el.setAttribute('opacity', (k < .1 ? k / .1 : k > .6 ? (1 - k) / .4 : 1).toFixed(2));
    }
    if (face && window.Avatar && G) {
      const key = faceNow();
      if (key !== faceKey) {
        faceKey = key; face.dataset.key = key;
        const du = key === 'major' ? { lv: 3, major: true, tongue: gi >= 7 } : key[0] === 'p' && key.length === 2 ? { lv: +key[1] } : { mood: key };   // 대절정: SS 이상이면 혀까지
        face.innerHTML = Avatar.render(G.look(p), 110, { age: G.npcAge(p), during: Object.assign(du, { personality: p.personality, fig: sc.fig, detail: DETAIL ? { lip: lipMe } : null }) });
        figEl = face.querySelector('.av-fig'); headEls = [...face.querySelectorAll('.av-head, .av-hb')]; bustEl = face.querySelector('.av-bust');
        if (bustEl) { bustK = +bustEl.dataset.k || 1; bustCy = +bustEl.dataset.cy || 0; }
        const all = c => [...face.querySelectorAll(c)];
        dx = DETAIL ? { flush: all('.av-flush'), swt: all('.av-swt'), damp: all('.av-damp'), breath: all('.av-breath'), mk: all('.av-mk'), mkShown: -1 } : null;
      }
      face.classList.toggle('peak', t < peakUntil || (key === 'p3' && good));   // 절정: 초상화가 확 바뀌며 분홍빛으로 반짝
      face.classList.toggle('big', key === 'major');
      // 칸은 고정, 안의 인물이 움직임: 몸(이불째) → 머리(살짝 늦게, 절정엔 젖혀짐) → 가슴(출렁)
      const brY = DETAIL ? Math.sin(brPh) * (.5 + ar * 1.2) : 0;   // 디테일: 가쁜 숨에 어깨가 오르내림
      if (figEl) figEl.setAttribute('transform', `translate(${f(vw.x + figX)},${f(vw.y + figY + brY)}) translate(60 104) rotate(${f(vw.r)}) scale(${vw.k.toFixed(3)}) translate(-60 -104)`);
      if (dx) {   // 디테일: 홍조·땀·젖은 머리·숨결·자국
        const fl = Math.min(1, (good ? ar * 1.05 : ar * .4) + (t < peakUntil ? .25 : 0) + (t >= end ? satV * .45 : 0));
        const sw = Math.min(1, Math.min(1, t / Math.max(20, end * .6)) * (good ? .85 : .35) + (t < peakUntil ? .25 : 0));
        dampV = Math.max(dampV, Math.min(1, (ar - .4) * 1.8 + (t >= end && good ? .5 : 0)));
        const brO = ar > .2 || t > end ? Math.max(0, -Math.sin(brPh)) ** 2 * (.25 + ar * .75) : 0;
        for (const el of dx.flush) el.setAttribute('opacity', fl.toFixed(2));
        for (const el of dx.swt) el.setAttribute('opacity', sw.toFixed(2));
        for (const el of dx.damp) el.setAttribute('opacity', dampV.toFixed(2));
        for (const el of dx.breath) el.setAttribute('opacity', brO.toFixed(2));
        if (dx.mkShown !== mkN) { dx.mkShown = mkN; dx.mk.forEach(el => el.setAttribute('opacity', +el.dataset.i < mkN ? 1 : 0)); }
      }
      const tilt = hdR * (P && P.act === her ? 7 : -9) + (2 + ar * 5) * Math.sin(t * 1.3) * .3 - jolt * 8;   // 달아오를수록 고개가 더 움직이고, 헉·움찔엔 젖혀졌다 숙여짐
      for (const el of headEls) el.setAttribute('transform', `translate(0,${f(hd)}) rotate(${f(tilt)} 60 104)`);
      if (bustEl) { const ly = bY * bustK, sy = 1 - bY * .03; bustEl.setAttribute('transform', `translate(0,${ly.toFixed(2)}) translate(60 ${bustCy}) scale(${(1 + bY * .012).toFixed(4)} ${sy.toFixed(4)}) translate(-60 ${-bustCy})`); }
    }
    // ♂ 화살은 d를 따라 드나들고 맞닿으면 ♂ 원이 고리 뒤쪽 끝에 탁 걸림(더 밀면 고리째 밀려남). 만족감이 낮으면 끝나고 빠지며 고개를 숙임
    const intro = ease(Math.min(1, t / .8)), u = t >= end ? Math.min(1, (t - end) / SLUMP) : 0;
    const gx = Math.max(MO + 2, GX0 - 2.6 * Math.max(-2.5, ms.d + (good ? 0 : 14 * ease(u)))) - (1 - intro) * 80;   // 크게 빼고, 걸릴 때까지 밀어붙임
    const ouch = t - ouchAt < .6 ? 1 - (t - ouchAt) / .6 : 0, jit = ouch * 1.6 * Math.sin((t - ouchAt) * 190);
    const qv = quiv && t < quiv.until ? quiv.amp * Math.sin(t * 82) : 0;   // 절정: ♀ 고리가 바르르 (대절정은 크게)
    const rx = RX0 * (1 - .32 * symE) * (1 - .1 * ouch) * (1 + qv), ry = FR * (1 + .28 * symE) * (1 - .1 * ouch) * (1 - qv);
    const press = Math.max(0, gx + MO - (106 + symX - rx));   // ♂ 원이 고리를 누르는 만큼 고리가 밀림
    const cx0 = 106 + symX + jit + press + (1 - intro) * 50, cy0 = 28 + ms.tr * .8;
    // 화살 속도(잔상)·촉 밑동이 고리 끝을 지날 때 고리가 꿀렁 벌어짐·안에 있을 땐 화살이 고리를 끌고 감
    const fdt = lastGx == null ? 0 : 1 / 60;
    gv = lastGx == null ? 0 : gv * .6 + .4 * (gx - lastGx) / fdt;
    const hbX = gx + hb, edge = cx0 - rx;
    if (lastHb != null && (lastHb - edge) * (hbX - edge) < 0) symEV += 5;
    if (gx + ht > edge) symXV += Math.max(-300, Math.min(300, gv)) * .012;
    lastGx = gx; lastHb = hbX;
    symM.setAttribute('transform', `translate(${f(gx)},${f(28 + ms.tr * 1.6)}) rotate(${f(good ? 0 : 35 * ease(u))})`);
    [[E.g1, .03, .22], [E.g2, .06, .12]].forEach(([el, k, o]) => { el.setAttribute('cx', f(gx - gv * k)); el.setAttribute('cy', f(28 + ms.tr * 1.6)); el.setAttribute('opacity', (gv > 80 ? Math.min(o, gv / 2500) : 0).toFixed(2)); });
    // 고리: 뒤쪽 반(왼쪽, 어둡게·가늘게) / 앞쪽 반(오른쪽, 밝게·굵게) + 앞쪽 하이라이트, 그라데이션은 고리를 따라 옮김
    const RP = a => `${f(cx0 + rx * Math.cos(a))},${f(cy0 + ry * Math.sin(a))}`, Pi = (a, k) => `${f(cx0 + (rx - k) * Math.cos(a))},${f(cy0 + (ry - k) * Math.sin(a))}`, rad = d => d * Math.PI / 180;
    E.back.setAttribute('d', `M${RP(rad(-90))} A${f(rx)},${f(ry)} 0 0 0 ${RP(rad(90))}`);
    E.fr.setAttribute('d', `M${RP(rad(-90))} A${f(rx)},${f(ry)} 0 0 1 ${RP(rad(90))}`);
    E.spec.setAttribute('d', `M${Pi(rad(-62), 1)} A${f(rx - 1)},${f(ry - 1)} 0 0 1 ${Pi(rad(-18), 1)}`);
    for (const [g, x1, x2] of [[GB, cx0 - rx, cx0], [GF, cx0, cx0 + rx]]) { g.setAttribute('x1', f(x1)); g.setAttribute('x2', f(x2)); }
    E.cross.setAttribute('d', `M${f(cx0)},${f(cy0 + ry)} V${f(cy0 + ry + 13)} M${f(cx0 - 6)},${f(cy0 + ry + 6.8)} H${f(cx0 + 6)}`);
    symC.setAttribute('cx', f(cx0)); symC.setAttribute('cy', f(cy0)); symC.setAttribute('rx', f(rx)); symC.setAttribute('ry', f(ry));
    ringX = cx0; ringY = cy0; ringRX = rx; ringRY = ry;
    // ♀ 물방울: 포물선으로 튀고 떨어지며 흐려짐 (날아가는 쪽으로 길쭉)
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], a = t - d.t0, k = a / d.life;
      if (k >= 1) { d.el.remove(); drops.splice(i, 1); continue; }
      const vx = d.vx, vy = d.vy + 210 * a, x = d.x + vx * a, yy = d.y + d.vy * a + 105 * a * a;
      d.el.setAttribute('transform', `translate(${f(x)},${f(yy)}) rotate(${f(Math.atan2(vy, vx) * 57.3)}) scale(${(d.s * (1 + Math.min(.6, Math.hypot(vx, vy) / 260))).toFixed(2)},${d.s.toFixed(2)})`);
      d.el.setAttribute('opacity', (k < .08 ? k / .08 : k > .55 ? (1 - k) / .45 : 1).toFixed(2));
    }
    symC.setAttribute('opacity', (good ? .15 + heat * .85 : .1).toFixed(2)); symG.setAttribute('opacity', Math.min(1, Math.max(good ? heat : heat * .3, flashK)).toFixed(2));
    // 탁: 맞닿은 곳에서 위아래로 튀는 선 + 고리가 퍼지는 물결 + (꿰뚫었으면) 촉 끝 반짝
    const ia = t - impT, rip = E.rip, tak = E.tak, spk = E.spark;
    if (ia < .42) {
      const k = ia / .42;
      rip.setAttribute('cx', f(cx0)); rip.setAttribute('cy', f(cy0)); rip.setAttribute('rx', f(rx * (1 + k * 1.1))); rip.setAttribute('ry', f(ry * (1 + k * .8)));
      rip.setAttribute('stroke-width', f(2.4 * (1 - k))); rip.setAttribute('opacity', ((1 - k) * .7 * impS).toFixed(2));
      const r1 = 3 + k * 9, r2 = r1 + 5 * (1 - k), px = edge - 1;
      tak.setAttribute('d', [-128, -100, -72, 72, 100, 128].map(dg => { const a = rad(dg); return `M${f(px + r1 * Math.cos(a))},${f(cy0 + r1 * Math.sin(a))} L${f(px + r2 * Math.cos(a))},${f(cy0 + r2 * Math.sin(a))}`; }).join(''));
      tak.setAttribute('opacity', (Math.max(0, 1 - ia / .3) * impS).toFixed(2));
      if (impExit) { const tx = gx + ht + 1, s2 = (k < .3 ? k / .3 : 1) * 4.5 * (1 - k * .5); spk.setAttribute('d', `M${f(tx)},${f(cy0 - s2)} Q${f(tx + .6)},${f(cy0 - .6)} ${f(tx + s2)},${f(cy0)} Q${f(tx + .6)},${f(cy0 + .6)} ${f(tx)},${f(cy0 + s2)} Q${f(tx - .6)},${f(cy0 + .6)} ${f(tx - s2)},${f(cy0)} Q${f(tx - .6)},${f(cy0 - .6)} ${f(tx)},${f(cy0 - s2)} Z`); spk.setAttribute('opacity', (1 - k).toFixed(2)); }
    } else { rip.setAttribute('opacity', '0'); tak.setAttribute('opacity', '0'); spk.setAttribute('opacity', '0'); }
    E.ouch.setAttribute('opacity', ouch.toFixed(2));
    // 박자 아이콘: 💓 → 💓💓 → 🔥 → (끝나면) ✨. 부딪힐 때마다 통통
    const bc = S[si], bt = t >= end + .3 ? (good ? '✨' : '') : t < peakUntil ? '💦' : bc.kind !== 'n' ? '🔥' : bc.T > .44 ? '💓' : bc.T > .3 ? '💓💓' : '🔥';
    if (bt !== beatTxt) { beatTxt = bt; beatEl.textContent = bt; }
    beatEl.setAttribute('transform', `translate(20,55) scale(${(1 + .35 * Math.max(-.5, beatK)).toFixed(3)})`);
    for (let i = symHearts.length - 1; i >= 0; i--) {
      const h = symHearts[i], k = (t - h.t0) / .9;
      if (k >= 1) { h.el.remove(); symHearts.splice(i, 1); continue; }
      const m = 1 - (1 - k) ** 2;
      h.el.setAttribute('transform', `translate(${f(h.x + h.dx * m)},${f(cy0 - ry + h.dy * m)}) scale(${(h.s * (k < .15 ? k / .15 : 1)).toFixed(3)})`);
      h.el.setAttribute('opacity', (k > .6 ? (1 - k) / .4 : 1).toFixed(2));
    }
    sym.style.transform = sk > .02 ? `translate(${f(cx * 1.2)}px,${f(cy * 1.2)}px)` : '';
  }
  function frame(now) {
    if (warpTo && t >= warpTo) warpTo = 0;
    acc += (last ? Math.min(.05, (now - last) / 1000) : 0) * (warpTo ? Math.max(8, RATE) : RATE); last = now;   // ⏩ 건너뛰는 중엔 8배, 아니면 고른 배속
    while (acc >= DT) { step(); acc -= DT; }
    draw();
    if (t < END) raf = requestAnimationFrame(frame);
    else done();
  }
  if (debug) { quilt.setAttribute('opacity', '.35'); q('.nt-sil').setAttribute('hidden', ''); q('.nt-dummy').removeAttribute('hidden'); }
  // 처음엔 이불을 몸 위에 내려놓고 가라앉힘
  P = poseNow(); capsM = caps(M, P.m); capsF = caps(F, P.f);
  for (let i = 0; i < n; i++) { surf[i] = surface(i); y[i] = surf[i]; }
  for (let j = 0; j < 300; j++) step(true);
  t = 0; rest.set(y); hemL.fill(0); v.fill(0);
  draw();
  // 종료 버튼: 지금 박자는 마저 하고 마무리로 (이미 마무리 중이면 false → 화면이 바로 넘김)
  let ending = false;
  ender = () => { if (ending || !plan.finish(si)) return false; ending = true; warpTo = 0; end = plan.end(); END = end + AFTER; return true; };
  // ⏩ 건너뛰기: 다음 일(절정·체위 바꾸기·마무리) 직전까지 빨리 감기
  skipper = () => { const tg = ending ? null : plan.next(t); if (tg == null || tg <= t) return false; warpTo = tg; return true; };
  raf = requestAnimationFrame(frame);
}

window.Night = {
  html: spot => `<div class="nt-stage${STAND[KIND(spot)] ? ' stand' : ''}" data-kind="${KIND(spot)}">${room(KIND(spot))}<div class="nt-face"></div><div class="nt-pops"></div><div class="nt-say"></div><div class="nt-pl" title="쾌락"><span>💗 쾌락</span><em><i></i></em><b>0</b></div>${SYM}<div class="nt-nar"></div><div class="nt-hud"></div></div>`,
  detail: () => DETAIL, setDetail: on => { DETAIL = !!on; try { localStorage.setItem('llife.ntDetail', DETAIL ? '1' : '0'); } catch (e) { /* 무시 */ } return DETAIL; },
  forcePose: name => { FORCE_POSE = name && POSES[name] ? name : null; }, lastStats: () => (LAST ? LAST() : null), resetStats: () => { LAST = null; },
  rate: () => RATE, setRate: r => { RATE = [1, 2, 4, 8].includes(+r) ? +r : 1; try { localStorage.setItem('llife.ntRate', RATE); } catch (e) { /* 무시 */ } return RATE; },
  foreplay, uterus, alley,
  run, stop: () => { cancelAnimationFrame(raf); ender = skipper = null; }, finish: () => !!ender && ender(), skip: () => !!skipper && skipper(),
  poseLabel: POSE_LABEL,
  // 실험용: 체위 이름과 움직임 상태 → 관절 좌표
  pose: (name, st = {}) => POSES[name](Object.assign({ d: 0, tr: 0, slump: 0, sink: 0, bs: 0, jig: { f: { butt: [0, 0], breast: [0, 0] }, m: { butt: [0, 0], breast: [0, 0] } } }, st), BODY.m, BODY.f),
};
})();
