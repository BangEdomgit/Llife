// Llife: 영지 — 중세 판타지 모드 데이터 (realm.html · js/realm.js · js/realm-ui.js)
//   영주의 자식으로 태어나 유년기를 보내고, 15살에 왕의 전쟁에 소집된 아버지 대신 영지를 맡음
//   한 달 = 한 턴(행동 3번). 영지 경영(건설·징병·세율·순찰) · 개인 수련 · 모험(던전) · 무역(상단) · 수성전 · 결투 · 혼담
window.REALM = window.REALM || {};

// 능력치 0~100 — 등급은 현대판과 같은 글자 (F ~ SS)
REALM.stats = { might: '무력', agility: '민첩', vigor: '체력', command: '통솔', stewardship: '정무', charm: '화술', lore: '학식', arcana: '마력' };
REALM.statIcon = { might: '⚔️', agility: '🏹', vigor: '💪', command: '🚩', stewardship: '📜', charm: '🗣', lore: '📚', arcana: '✨' };
REALM.grades = [['F', 0], ['E', 15], ['D', 28], ['C', 40], ['B', 52], ['A', 64], ['S', 77], ['SS', 90]];

// 영지 종류 — 시작 자원·건물·위협·교역·특산물
REALM.lands = [
  { id: 'march', name: '변경 요새령', icon: '🏔', desc: '북쪽 검은숲과 맞닿은 요새. 몬스터 습격이 잦지만 병사들이 거칠고 강하다.',
    start: { pop: 700, food: 800, gold: 260, morale: 55, order: 62, wall: 90, troops: { levy: 50, men: 40, knights: 4 } },
    b: { farm: 1, market: 0, barracks: 2, wall: 2, smithy: 1, temple: 1 }, threat: 1.35, prod: { wool: 3, iron: 2 }, bonus: { might: 6, vigor: 4 } },
  { id: 'river', name: '강변 교역령', icon: '⛵', desc: '큰 강 나루에 선 상업 도시. 돈이 돌고 상인이 모이지만 성벽이 낮다.',
    start: { pop: 950, food: 900, gold: 420, morale: 60, order: 55, wall: 55, troops: { levy: 60, men: 20, knights: 2 } },
    b: { farm: 2, market: 2, barracks: 0, wall: 1, smithy: 0, temple: 1 }, threat: .9, prod: { grain: 8, wine: 2, salt: 2 }, bonus: { charm: 6, stewardship: 4 } },
  { id: 'mine', name: '산골 광산령', icon: '⛏', desc: '높은 산 아래 광산 마을. 철과 가끔 마석이 나오지만 땅이 척박하다.',
    start: { pop: 600, food: 620, gold: 320, morale: 52, order: 60, wall: 70, troops: { levy: 50, men: 30, knights: 3 } },
    b: { farm: 1, market: 1, barracks: 1, wall: 2, smithy: 2, temple: 0 }, threat: 1.1, prod: { iron: 5, mana: .4 }, bonus: { vigor: 6, lore: 4 } },
];

// 건물 (단계 0~5). cost: 다음 단계 금화 = base × (단계+1)
REALM.buildings = {
  farm:     { name: '농지',   icon: '🌾', base: 60, desc: '단계마다 식량 생산 +25% (가을 수확이 특히 큼)' },
  market:   { name: '시장',   icon: '🏪', base: 80, desc: '단계마다 세금 수입 +12%, 무역 가격이 조금 유리해짐' },
  barracks: { name: '병영',   icon: '⛺', base: 70, desc: '단계마다 상비병·기사를 더 둘 수 있고 훈련이 잘 됨, 치안 +' },
  wall:     { name: '성벽',   icon: '🧱', base: 90, desc: '단계마다 성벽 최대 내구 +40, 수성전 방어 배율 +' },
  smithy:   { name: '대장간', icon: '⚒', base: 70, desc: '단계마다 철 생산 +1, 장비를 만들 수 있음' },
  temple:   { name: '신전',   icon: '⛪', base: 65, desc: '단계마다 민심 +, 역병에 강해짐, 치유' },
};

// 병종: 전력(power), 한 달 유지비(금화), 모집비(금화), 식량
REALM.troops = {
  levy:    { name: '징집병', icon: '🪓', power: 1,  upkeep: .08, cost: 1,  food: .02, desc: '농민을 모아 창을 쥐여 준다. 싸게 모으지만 약하고, 많으면 농사가 줄어든다.' },
  men:     { name: '상비병', icon: '🛡', power: 3,  upkeep: .4,  cost: 8,  food: .03, desc: '훈련받은 병사. 병영 단계만큼 둘 수 있는 수가 늘어난다.' },
  knights: { name: '기사',   icon: '🐴', power: 14, upkeep: 2.5, cost: 70, food: .1,  desc: '말과 갑옷을 갖춘 기사. 비싸지만 전장의 꽃.' },
};

// 교역품 (기준가 = 금화)
REALM.goods = [
  { id: 'grain', name: '곡물', icon: '🌾', base: 2 },
  { id: 'wool',  name: '양모', icon: '🧶', base: 6 },
  { id: 'salt',  name: '소금', icon: '🧂', base: 8 },
  { id: 'iron',  name: '철',   icon: '⛓', base: 11 },
  { id: 'wine',  name: '와인', icon: '🍷', base: 15 },
  { id: 'spice', name: '향신료', icon: '🌶', base: 32 },
  { id: 'mana',  name: '마석', icon: '💎', base: 60 },
];
// 도시 — 가격 배율 (낮으면 싸게 사고, 높으면 비싸게 팔림). 상단은 한 달 걸려 다녀옴
REALM.towns = [
  { id: 'home',    name: '우리 영지 시장', icon: '🏰', mods: {} },
  { id: 'port',    name: '항구도시 벨레노', icon: '⚓', risk: .14, toll: .06, mods: { spice: .62, salt: .7, wine: 1.25, wool: 1.35, iron: 1.25, grain: 1.1 } },
  { id: 'capital', name: '왕도 아르덴',    icon: '👑', risk: .08, toll: .1,  mods: { wine: .85, spice: 1.35, mana: 1.45, grain: 1.3, wool: 1.15 } },
  { id: 'hill',    name: '산악 마을 그림홀드', icon: '⛰', risk: .2, toll: .03, mods: { iron: .6, mana: .75, grain: 1.5, wine: 1.4, salt: 1.3 } },
];

// 적 (결투·모험·수성전 대장) — hp, 공격, 방어, 빠르기, 특기
REALM.foes = {
  wolf:    { name: '굶주린 늑대', icon: '🐺', hp: 24, atk: 7,  def: 1, spd: 14, gold: [0, 4] },
  bandit:  { name: '산적',       icon: '🗡', hp: 32, atk: 8,  def: 3, spd: 10, gold: [6, 18] },
  goblin:  { name: '고블린',     icon: '👺', hp: 26, atk: 7,  def: 2, spd: 13, gold: [3, 12] },
  orc:     { name: '오크 전사',   icon: '👹', hp: 52, atk: 12, def: 5, spd: 8,  gold: [10, 26] },
  knight:  { name: '떠돌이 기사', icon: '🛡', hp: 58, atk: 12, def: 8, spd: 10, gold: [15, 40] },
  wraith:  { name: '폐허의 망령', icon: '👻', hp: 44, atk: 13, def: 2, spd: 15, gold: [8, 20], spec: 'drain' },
  troll:   { name: '동굴 트롤',   icon: '🧌', hp: 90, atk: 15, def: 6, spd: 6,  gold: [20, 50], spec: 'regen' },
  drake:   { name: '어린 비룡',   icon: '🐉', hp: 140, atk: 19, def: 9, spd: 11, gold: [80, 160], spec: 'breath' },
  warlord: { name: '적장',       icon: '⚔️', hp: 70, atk: 14, def: 7, spd: 10, gold: [20, 50] },
};

// 모험지 — 칸(노드) 수, 나오는 적, 전리품. 원정은 그 달 행동을 다 씀 (그동안 영지는 집사가 돌봄)
REALM.sites = [
  { id: 'forest', name: '검은숲 언저리', icon: '🌲', tier: 1, nodes: 3, foes: ['wolf', 'wolf', 'bandit', 'goblin'], gold: [15, 45], goods: ['wool', 'grain'], desc: '늑대와 산적이 출몰한다. 첫 원정에 알맞다.' },
  { id: 'cave',   name: '고블린 굴',     icon: '🕳', tier: 2, nodes: 4, foes: ['goblin', 'goblin', 'orc', 'bandit'], gold: [35, 90], goods: ['iron', 'salt'], desc: '고블린이 훔쳐 온 물건이 쌓여 있다고 한다.' },
  { id: 'ruin',   name: '잊힌 왕국의 폐허', icon: '🏛', tier: 3, nodes: 5, foes: ['wraith', 'orc', 'troll', 'wraith'], gold: [60, 150], goods: ['mana', 'spice'], desc: '마석과 옛 보물이 잠들어 있다. 망령이 지킨다.' },
  { id: 'lair',   name: '비룡의 둥지',   icon: '🌋', tier: 4, nodes: 5, foes: ['troll', 'orc', 'wraith'], boss: 'drake', gold: [150, 320], goods: ['mana', 'mana'], desc: '영지를 노리는 어린 비룡이 산다. 이기면 이름이 왕국에 퍼진다.' },
];

// 영지를 노리는 위협 — 전력(power) 범위는 해가 지날수록 커짐. 정찰 보고 뒤 1~2달 뒤 도착
REALM.threats = [
  { id: 'wolves',  name: '늑대 무리',      icon: '🐺', power: [15, 35],  champ: 'wolf',    tribute: false, from: 1 },
  { id: 'bandits', name: '산적단',         icon: '🗡', power: [35, 80],  champ: 'bandit',  tribute: true,  from: 1 },
  { id: 'goblins', name: '고블린 떼',      icon: '👺', power: [50, 110], champ: 'goblin',  tribute: false, from: 1 },
  { id: 'orcs',    name: '오크 습격대',     icon: '👹', power: [100, 200], champ: 'orc',    tribute: false, from: 3 },
  { id: 'baron',   name: '이웃 남작의 군대', icon: '⚔️', power: [150, 280], champ: 'warlord', tribute: true,  from: 4 },
  { id: 'drake',   name: '비룡',           icon: '🐉', power: [220, 320], champ: 'drake',   tribute: false, from: 7 },
];

// 이웃 가문 (혼담·외교)
REALM.houses = [
  { id: 'valen',  name: '발렌',  color: '#3d6fd8', sym: '🦁', trait: '부유한 상인 귀족 — 지참금이 크다' },
  { id: 'morrow', name: '모로우', color: '#7b3fb0', sym: '🦉', trait: '마법사 가문 — 학식·마력이 높은 자식들' },
  { id: 'harth',  name: '하스',  color: '#b53a2e', sym: '🐗', trait: '무가 — 동맹하면 위기 때 기사를 보내 준다' },
  { id: 'eloin',  name: '엘로인', color: '#2e8f5e', sym: '🦌', trait: '오래된 숲의 가문 — 민심과 명성이 오른다' },
];
REALM.names = {
  m: ['알드릭', '베른', '카일', '도리안', '에드윈', '펠릭스', '가레스', '하롤드', '이반', '율리안', '케인', '레온', '마르셀', '오스릭', '롤랑', '세드릭', '테오도르', '울릭'],
  f: ['아델라', '브리엔', '셀레스트', '다리아', '엘레인', '피오나', '그웬', '헬레나', '이솔데', '줄리아', '카타리나', '리아나', '미라벨', '노라', '오필리아', '로잘린', '세라', '비비안'],
};
REALM.crestSyms = ['🦅', '🐺', '🦁', '🐉', '🌹', '⚜', '🗝', '🌙', '☀', '🐻'];
REALM.crestColors = ['#b53a2e', '#2f5fb3', '#2e8f5e', '#7b3fb0', '#c28a1e', '#3a3f4b'];

// 유년기 이야기 (나이 → 장면). 고른 것이 능력치·성향이 됨
REALM.childhood = [
  { age: 6, text: '여섯 살. 성 안뜰에서 놀던 어느 날, 아버지가 물었다. "커서 무엇이 되고 싶으냐?"',
    choices: [
      { label: '"아버지처럼 강한 기사요!"', fx: { might: 6, vigor: 4 }, text: '아버지가 웃으며 나무검을 깎아 주었다.' },
      { label: '"성의 책을 다 읽을래요."', fx: { lore: 7, stewardship: 3 }, text: '그날부터 서고 열쇠가 내 것이 되었다.' },
      { label: '"모두가 좋아하는 사람이요."', fx: { charm: 7, command: 3 }, text: '어머니가 나를 데리고 마을 축제에 다니기 시작했다.' },
    ] },
  { age: 9, text: '아홉 살. 가정교사를 고를 때가 됐다. 성에 세 사람이 찾아왔다.',
    choices: [
      { label: '늙은 기사 브람 — 검술과 승마', fx: { might: 6, agility: 6 }, text: '매일 새벽, 손바닥에 물집이 잡혔다.' },
      { label: '왕도에서 온 학자 — 셈과 법', fx: { stewardship: 7, lore: 5 }, text: '장부를 읽는 법과 법전을 외웠다.' },
      { label: '떠돌이 마법사 — 별과 룬', fx: { arcana: 8, lore: 4 }, text: '촛불이 손끝에서 흔들렸다. 아버지는 못마땅해했다.', flag: 'mage' },
    ] },
  { age: 12, text: '열두 살. 성 밑 마을에 늑대가 내려왔다. 병사들이 창을 들고 모였다.',
    choices: [
      { label: '몰래 병사들을 따라간다', fx: { might: 4, command: 5, vigor: 3 }, text: '늑대를 쫓아낸 뒤, 병사들이 나를 어깨에 태웠다. 아버지께는 크게 혼났다.' },
      { label: '마을 사람들을 성으로 피신시킨다', fx: { command: 6, charm: 4 }, text: '아이들을 모아 성문으로 이끌었다. 노인들이 내 이름을 불렀다.' },
      { label: '늑대 습성을 책에서 찾아본다', fx: { lore: 5, agility: 3, stewardship: 3 }, text: '불을 피우면 늑대가 물러난다는 걸 알려 줬다. 효과가 있었다.' },
    ] },
  { age: 14, text: '열네 살. 처음으로 아버지를 따라 영지 순회에 나섰다. 굶주린 마을이 세금을 깎아 달라고 빌었다.',
    choices: [
      { label: '"올해만 세금을 깎아 주세요."', fx: { charm: 4, stewardship: 2 }, morale: 8, text: '아버지는 한참 나를 보더니 고개를 끄덕였다. 마을 사람들이 울었다.' },
      { label: '"법은 법입니다."', fx: { stewardship: 5, command: 3 }, gold: 40, text: '아버지가 "영주의 눈을 가졌구나" 하고 말했다. 마을의 눈빛은 차가웠다.' },
      { label: '"대신 성의 공사를 거들게 하세요."', fx: { stewardship: 4, lore: 2 }, wall: 10, text: '세금 대신 성벽 보수에 손을 보탰다. 모두 그럭저럭 만족했다.' },
    ] },
];
