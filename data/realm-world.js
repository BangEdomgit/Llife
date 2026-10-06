// Llife: 영지 — 세계 설정 2: 종족 · 신분과 작위 · 강함(오러 · 서클 · 용병 등급 · 강함 등급) · 사람(성격 · 직책 · 옷) · 노예시장
//   엔진(js/realm.js)과 화면(js/realm-ui.js)이 읽음. 나이는 모두 어른(20살 이상)만 사귈 수 있음
window.REALM = window.REALM || {};

/* ── 종족 ── bonus: 시작 능력치, grow: 수련 효율, life: { old 늙기 시작, max 수명 }, aura·magic: 오러·마법 재능 배율, prej: 인간 귀족 사회의 편견(0~1) */
REALM.races = {
  human: { name: '인간', icon: '🧑', desc: '왕국의 주인. 어떤 길이든 빨리 배우고, 귀족 사회에서 편견이 없다.', bonus: { charm: 2, command: 2, stewardship: 2 }, grow: 1.15, life: { old: 58, max: 78 }, aura: 1, magic: 1, prej: 0 },
  elf:   { name: '엘프', icon: '🧝', desc: '숲의 오래된 종족. 마력과 활에 타고났고 수백 년을 산다. 오러는 잘 맺히지 않는다.', bonus: { agility: 6, arcana: 9, lore: 3, might: -3, vigor: -2 }, grow: .95, life: { old: 240, max: 300 }, aura: .65, magic: 1.5, prej: .35 },
  dwarf: { name: '드워프', icon: '🧔', desc: '산 아래 대장장이 종족. 튼튼하고 손재주가 좋아 장비를 싸게 만든다. 마법은 서툴다.', bonus: { vigor: 8, might: 4, stewardship: 3, agility: -3, arcana: -5 }, grow: 1, life: { old: 120, max: 165 }, aura: 1.1, magic: .55, prej: .25, smith: .7 },
  beast: { name: '수인', icon: '🐾', desc: '짐승의 귀를 가진 종족. 감각과 몸놀림이 뛰어나지만 왕국에선 차별을 받는다.', bonus: { agility: 7, might: 3, vigor: 2, lore: -3, arcana: -3 }, grow: 1, life: { old: 52, max: 72 }, aura: 1.15, magic: .7, prej: .6,
    subs: { wolf: { name: '늑대', bonus: { might: 3, command: 2 } }, fox: { name: '여우', bonus: { charm: 4, arcana: 3 } }, cat: { name: '고양이', bonus: { agility: 4 } }, rabbit: { name: '토끼', bonus: { agility: 3, vigor: 2 } } } },
  orc:   { name: '오크', icon: '👹', desc: '초원의 전사 종족. 힘과 오러가 압도적이지만 인간 왕국에선 두려움과 멸시를 받는다.', bonus: { might: 11, vigor: 7, charm: -6, lore: -4, arcana: -3 }, grow: 1, life: { old: 46, max: 64 }, aura: 1.3, magic: .5, prej: .85 },
};
// 종족 이름 (사람 · 형용) — 엘프 이름 · 드워프 이름 · 수인 이름 · 오크 이름은 따로
REALM.raceNames = {
  elf:   { m: ['엘라리온', '실바린', '탈리엔', '에어린', '갈라드', '레골린', '페안로르'], f: ['아리엘', '셀린디엘', '나엘라', '이실라', '엘로웬', '갈라드리', '루시엔'] },
  dwarf: { m: ['토린', '발린', '그롬', '두린', '브론', '킬리', '보르가'], f: ['디스', '헬가', '브룬힐', '토라', '마그나', '군니', '에다'] },
  beast: { m: ['카룬', '레오', '하티', '로우', '페른', '젠', '토바'], f: ['미아', '루나', '코코', '네리', '시엘', '하루', '리코'] },
  orc:   { m: ['그롬쉬', '우르각', '타크', '모르그', '두르크', '가즈', '로크'], f: ['샤그라', '우르자', '가샤', '모가', '뎃카', '바르나', '쉬라'] },
};

/* ── 신분 (lv가 높을수록 위) ── 사람(NPC)과 나 모두 */
REALM.ranks = {
  slave:    { lv: 0, name: '노예' },
  freed:    { lv: 1, name: '해방민' },
  commoner: { lv: 1, name: '평민' },
  free:     { lv: 2, name: '자유민' },        // 상인 · 용병 · 장인
  knight:   { lv: 3, name: '기사', honor: '경' },
  baron:    { lv: 4, name: '남작' },
  viscount: { lv: 5, name: '자작' },
  count:    { lv: 6, name: '백작' },
  marquis:  { lv: 7, name: '후작' },
  duke:     { lv: 8, name: '공작' },
  royal:    { lv: 9, name: '왕족' },
};
// 내 작위 사다리 (영지를 가진 귀족). size: 영지 크기 배율(인구·병력·세금), threat: 위협 배율, favor/fame: 다음 작위로 오를 조건(왕실 공헌 · 명성)
REALM.peerage = [
  { id: 'knight',   name: '기사',  land: '장원',   size: .6,  threat: .8,  favor: 0,   fame: 0 },
  { id: 'baron',    name: '남작',  land: '남작령', size: 1,   threat: 1,   favor: 40,  fame: 40 },
  { id: 'viscount', name: '자작',  land: '자작령', size: 1.35, threat: 1.15, favor: 140, fame: 120 },
  { id: 'count',    name: '백작',  land: '백작령', size: 1.8, threat: 1.3, favor: 320, fame: 250 },
  { id: 'marquis',  name: '후작',  land: '후작령', size: 2.4, threat: 1.45, favor: 600, fame: 450 },
  { id: 'duke',     name: '공작',  land: '공작령', size: 3.2, threat: 1.6, favor: 1000, fame: 700 },
];

/* ── 오러 (검사의 길) ── need: 이 단계에 오르는 데 필요한 오러 수련치, check: 돌파 판정 등급(무력+체력), mult: 오러 베기 배율, charges: 결투 한 번에 쓸 수 있는 오러 베기 횟수 */
REALM.aura = [
  { lv: 0, name: '오러 없음', short: '—' },
  { lv: 1, name: '오러 유저', short: '유저', need: 40, check: 'D', mult: 1.5, charges: 1, atk: 2, desc: '검끝에 희미한 빛이 맺힌다.' },
  { lv: 2, name: '소드 익스퍼트 초급', short: '익스퍼트 초급', need: 150, check: 'C', mult: 1.7, charges: 2, atk: 4, desc: '오러를 검신에 얇게 두른다.' },
  { lv: 3, name: '소드 익스퍼트 중급', short: '익스퍼트 중급', need: 360, check: 'B', mult: 1.95, charges: 2, atk: 7, desc: '오러가 검을 따라 길게 뻗는다.' },
  { lv: 4, name: '소드 익스퍼트 상급', short: '익스퍼트 상급', need: 720, check: 'A', mult: 2.25, charges: 3, atk: 10, desc: '갑옷을 종잇장처럼 가른다.' },
  { lv: 5, name: '소드 마스터', short: '마스터', need: 1300, check: 'S', mult: 2.8, charges: 3, atk: 15, insight: true, desc: '오러 블레이드. 왕국에 손꼽히는 경지.' },
  { lv: 6, name: '그랜드 마스터', short: '그랜드 마스터', need: 2400, check: 'SS', mult: 3.6, charges: 4, atk: 22, insight: true, desc: '대륙의 전설. 혼자서 군대를 막는다.' },
];
/* ── 서클 (마법사의 길) ── need: 이 서클에 오르는 데 필요한 마나 수련치, stones: 돌파에 쓰는 마석, check: 판정 등급(마력+학식) */
REALM.circles = [
  { lv: 0, name: '마법 없음' },
  { lv: 1, name: '1서클', title: '견습 마법사', need: 30, stones: 0, check: 'E' },
  { lv: 2, name: '2서클', title: '견습 마법사', need: 100, stones: 1, check: 'D' },
  { lv: 3, name: '3서클', title: '정식 마법사', need: 220, stones: 1, check: 'D' },
  { lv: 4, name: '4서클', title: '중견 마법사', need: 420, stones: 2, check: 'C' },
  { lv: 5, name: '5서클', title: '상급 마법사', need: 720, stones: 3, check: 'B' },
  { lv: 6, name: '6서클', title: '대마법사', need: 1120, stones: 4, check: 'A' },
  { lv: 7, name: '7서클', title: '대마도사', need: 1700, stones: 6, check: 'A' },
  { lv: 8, name: '8서클', title: '현자', need: 2450, stones: 8, check: 'S' },
  { lv: 9, name: '9서클', title: '전설의 마도사', need: 3500, stones: 12, check: 'SS' },
];
// 주문 — circle 이상이면 씀. mp: 마나, dmg: [기본, 마력 배율], 특수: heal(체력 %) · stun(적 한 턴 멈춤 확률) · shield(받는 피해 줄임)
REALM.spells = [
  { id: 'missile',  circle: 1, name: '매직 미사일', icon: '✨', mp: 1, dmg: [7, .22] },
  { id: 'bolt',     circle: 2, name: '파이어 볼트', icon: '🔥', mp: 1, dmg: [11, .28] },
  { id: 'heal',     circle: 2, name: '힐',          icon: '💚', mp: 1, heal: .3 },
  { id: 'fireball', circle: 3, name: '파이어볼',    icon: '☄️', mp: 2, dmg: [18, .4] },
  { id: 'shield',   circle: 4, name: '매직 실드',   icon: '🔰', mp: 1, shield: .5 },
  { id: 'lightning', circle: 4, name: '라이트닝 볼트', icon: '⚡', mp: 2, dmg: [22, .45], stun: .4 },
  { id: 'frost',    circle: 5, name: '프로스트 노바', icon: '❄️', mp: 3, dmg: [28, .5], stun: .7 },
  { id: 'chain',    circle: 6, name: '체인 라이트닝', icon: '🌩', mp: 3, dmg: [42, .6] },
  { id: 'meteor',   circle: 7, name: '메테오',       icon: '🌠', mp: 4, dmg: [70, .8] },
  { id: 'hellfire', circle: 8, name: '헬파이어',     icon: '🔥', mp: 5, dmg: [100, 1] },
  { id: 'stop',     circle: 9, name: '타임 스톱',     icon: '⏳', mp: 5, dmg: [60, .6], stun: 1 },
];

/* ── 용병 등급 ── need: 다음 등급까지 공적 점수, test: 승급 시험 상대 */
REALM.mercGrades = [
  { id: 'F', name: 'F급', need: 0 },
  { id: 'E', name: 'E급', need: 20, test: null },
  { id: 'D', name: 'D급', need: 60, test: 'bandit' },
  { id: 'C', name: 'C급', need: 150, test: 'orc' },
  { id: 'B', name: 'B급', need: 300, test: 'knight' },
  { id: 'A', name: 'A급', need: 540, test: 'troll' },
  { id: 'S', name: 'S급', need: 950, test: 'drake' },
];
// 의뢰 — 길드 게시판에 매달 새로 붙음. grade: 받을 수 있는 최소 등급(인덱스), kind: hunt 토벌(결투) · escort 호위(판정 + 습격) · gather 채집(판정) · probe 조사(판정 + 결투)
REALM.quests = [
  { id: 'rats',    g: 0, kind: 'gather', name: '창고의 쥐 떼 몰아내기', stat: 'agility', grade: 'F', gold: [8, 16], pts: 3 },
  { id: 'herbs',   g: 0, kind: 'gather', name: '약초 채집',             stat: 'lore',    grade: 'E', gold: [10, 20], pts: 3 },
  { id: 'wolves',  g: 0, kind: 'hunt',   name: '늑대 토벌',             foes: ['wolf', 'wolf'], gold: [18, 30], pts: 5 },
  { id: 'letter',  g: 1, kind: 'escort', name: '상인 마차 호위',         stat: 'command', grade: 'E', foe: 'bandit', gold: [25, 45], pts: 6 },
  { id: 'goblin',  g: 1, kind: 'hunt',   name: '고블린 소굴 소탕',       foes: ['goblin', 'goblin', 'goblin'], gold: [35, 55], pts: 8 },
  { id: 'missing', g: 2, kind: 'probe',  name: '사라진 순찰대 찾기',     stat: 'lore', grade: 'D', foe: 'bandit', gold: [45, 75], pts: 10 },
  { id: 'bandits', g: 2, kind: 'hunt',   name: '산적 두목 현상금',       foes: ['bandit', 'bandit', 'warlord'], gold: [60, 95], pts: 12 },
  { id: 'orc',     g: 3, kind: 'hunt',   name: '오크 정찰대 격퇴',       foes: ['orc', 'orc'], gold: [80, 130], pts: 15 },
  { id: 'noble',   g: 3, kind: 'escort', name: '귀족 영애 호위',         stat: 'charm', grade: 'C', foe: 'knight', gold: [100, 160], pts: 16 },
  { id: 'crypt',   g: 4, kind: 'probe',  name: '저주받은 지하묘지 조사', stat: 'arcana', grade: 'C', foe: 'wraith', gold: [130, 200], pts: 20 },
  { id: 'troll',   g: 4, kind: 'hunt',   name: '다리 밑 트롤 토벌',      foes: ['troll'], gold: [150, 240], pts: 24 },
  { id: 'wyvern',  g: 5, kind: 'hunt',   name: '와이번 사냥',            foes: ['troll', 'drake'], gold: [260, 400], pts: 34 },
  { id: 'dragon',  g: 6, kind: 'hunt',   name: '고룡의 둥지 정찰',       foes: ['wraith', 'troll', 'drake'], gold: [500, 800], pts: 50 },
];

/* ── 강함 등급 ── 전투력(cp)으로 나눔. 사람(NPC)도 같은 표 */
REALM.might = [
  { id: 'F',   min: 0,    name: '일반인' },
  { id: 'E',   min: 22,   name: '견습 병사' },
  { id: 'D',   min: 34,   name: '정규 병사' },
  { id: 'C',   min: 50,   name: '기사급' },
  { id: 'B',   min: 72,   name: '정예 기사급' },
  { id: 'A',   min: 105,  name: '익스퍼트급' },
  { id: 'S',   min: 150,  name: '마스터급' },
  { id: 'SS',  min: 215,  name: '그랜드 마스터급' },
  { id: 'SSS', min: 300,  name: '대륙의 전설' },
];

/* ── 사람 ── 성격(말투·반응), 직책(옷·강함), 사귈 수 있는지 */
REALM.personalities = {
  warm:     { name: '다정함',   likes: ['talk', 'gift'],  line: { good: '"오늘 이야기 즐거웠어요."', bad: '"…괜찮아요. 다음에 또 얘기해요."' } },
  proud:    { name: '도도함',   likes: ['spar', 'feast'], line: { good: '"흥, 나쁘지 않았어."', bad: '"그 정도로 내 마음을 얻을 생각이야?"' } },
  cheerful: { name: '쾌활함',   likes: ['feast', 'talk'], line: { good: '"하하! 또 불러 줘요!"', bad: '"에이, 오늘은 영 재미가 없네요."' } },
  shy:      { name: '수줍음',   likes: ['gift', 'walk'],  line: { good: '"…저, 저도 좋았어요."', bad: '"…(고개를 숙인 채 말이 없다)"' } },
  cool:     { name: '냉철함',   likes: ['spar', 'study'], line: { good: '"합리적인 시간이었습니다."', bad: '"용건이 그것뿐입니까."' } },
};
// role: 직책 — rank 신분, power: 강함 범위(무력·민첩·체력·마력, 오러·서클), romance: 사귈 수 있는지 (부리는 사람·해방민은 안 됨 — 주종·은혜 관계라서)
REALM.roles = {
  knight:   { name: '기사',       rank: 'knight',   look: 'knight',  romance: true,  fight: true, stats: [40, 62], aura: [0, 2] },
  captain:  { name: '기사단장',   rank: 'knight',   look: 'knight',  romance: false, fight: true, stats: [55, 72], aura: [1, 3] },
  mage:     { name: '궁정 마법사', rank: 'free',    look: 'mage',    romance: true,  fight: true, stats: [20, 40], circle: [2, 5] },
  steward:  { name: '집사',       rank: 'commoner', look: 'scholar', romance: false },
  maid:     { name: '시녀',       rank: 'commoner', look: 'servant', romance: false },
  page:     { name: '시종',       rank: 'commoner', look: 'servant', romance: false },
  merc:     { name: '용병',       rank: 'free',     look: 'merc',    romance: true,  fight: true, stats: [35, 60], aura: [0, 2] },
  priest:   { name: '신관',       rank: 'free',     look: 'priest',  romance: true,  fight: true, stats: [20, 35], circle: [1, 3] },
  bard:     { name: '음유시인',   rank: 'free',     look: 'common',  romance: true },
  smith:    { name: '대장장이',   rank: 'free',     look: 'smith',   romance: true },
  tavern:   { name: '주점 주인',  rank: 'commoner', look: 'common',  romance: true },
  merchant: { name: '상인',       rank: 'free',     look: 'common',  romance: true },
  noble:    { name: '귀족 자제',  rank: 'baron',    look: 'noble',   romance: true },
  scholar:  { name: '학자',       rank: 'free',     look: 'scholar', romance: true },
  freed:    { name: '해방민',     rank: 'freed',    look: 'common',  romance: false, fight: true, stats: [30, 55], aura: [0, 1] },
};
// 옷 (js/avatar.js의 옷 조각으로 맞춤): 귀족 · 기사 · 마법사 · 용병 · 평민 · 하인 · 신관 · 학자 · 대장장이
REALM.looks = {
  noble:   { m: { inner: { k: 'shirt', c: '#efe6d2' }, outer: { k: 'longcoat', c: '$house' }, bottom: { k: 'slacks', c: '#2a2420', cut: 'straight' }, shoes: { k: 'ankleboot', c: '#2a211d' } },
             f: { dress: { k: 'suitdress', c: '$house' }, shoes: { k: 'longboot', c: '#2a211d' } } },
  knight:  { m: { inner: { k: 'turtle', c: '#9aa3ae' }, outer: { k: 'vest', c: '$house' }, bottom: { k: 'slacks', c: '#4b4f57', cut: 'straight' }, shoes: { k: 'ankleboot', c: '#3a3f47' } },
             f: { inner: { k: 'turtle', c: '#9aa3ae' }, outer: { k: 'vest', c: '$house' }, bottom: { k: 'slacks', c: '#4b4f57', cut: 'straight' }, shoes: { k: 'longboot', c: '#3a3f47' } } },
  mage:    { m: { inner: { k: 'turtle', c: '#2a2440' }, outer: { k: 'longcoat', c: '#3d2d6b' }, bottom: { k: 'slacks', c: '#211c33', cut: 'straight' }, shoes: { k: 'ankleboot', c: '#1d1828' } },
             f: { inner: { k: 'turtle', c: '#2a2440' }, outer: { k: 'longcoat', c: '#3d2d6b' }, bottom: { k: 'longskirt', c: '#211c33' }, shoes: { k: 'ankleboot', c: '#1d1828' } } },
  merc:    { m: { inner: { k: 'longtee', c: '#7a6a55' }, outer: { k: 'leather', c: '#5a3d26' }, bottom: { k: 'cargo', c: '#4a4136' }, shoes: { k: 'ankleboot', c: '#2a211d' } },
             f: { inner: { k: 'longtee', c: '#7a6a55' }, outer: { k: 'leather', c: '#5a3d26' }, bottom: { k: 'cargo', c: '#4a4136' }, shoes: { k: 'longboot', c: '#2a211d' } } },
  common:  { m: { inner: { k: 'longtee', c: '#b9a888' }, outer: { k: 'vest', c: '#6b5038' }, bottom: { k: 'chino', c: '#5a4c3a' }, shoes: { k: 'ankleboot', c: '#3a2c22' } },
             f: { dress: { k: 'shirtdress', c: '#8a7458' }, shoes: { k: 'ankleboot', c: '#3a2c22' }, acc: { apron: '#e9dfc9' } } },
  servant: { m: { inner: { k: 'shirt', c: '#f1ece2' }, outer: { k: 'vest', c: '#2b2b33' }, bottom: { k: 'slacks', c: '#2b2b33', cut: 'straight' }, shoes: { k: 'loafer', c: '#1c1715' } },
             f: { dress: { k: 'suitdress', c: '#2b2b33' }, shoes: { k: 'loafer', c: '#1c1715' }, acc: { apron: '#f3efe6' } } },
  priest:  { m: { inner: { k: 'turtle', c: '#f3efe6' }, outer: { k: 'longcoat', c: '#e9e2cf' }, bottom: { k: 'slacks', c: '#d9d1bd', cut: 'straight' }, shoes: { k: 'loafer', c: '#8a7a5e' } },
             f: { inner: { k: 'turtle', c: '#f3efe6' }, outer: { k: 'longcoat', c: '#e9e2cf' }, bottom: { k: 'longskirt', c: '#d9d1bd' }, shoes: { k: 'loafer', c: '#8a7a5e' } } },
  scholar: { m: { inner: { k: 'shirt', c: '#e9e2cf' }, outer: { k: 'longcoat', c: '#5a4632' }, bottom: { k: 'slacks', c: '#3a3028', cut: 'straight' }, shoes: { k: 'loafer', c: '#2a211d' } },
             f: { inner: { k: 'blouse', c: '#e9e2cf' }, outer: { k: 'longcoat', c: '#5a4632' }, bottom: { k: 'longskirt', c: '#3a3028' }, shoes: { k: 'loafer', c: '#2a211d' } } },
  smith:   { m: { inner: { k: 'sleeveless', c: '#8a7a64' }, bottom: { k: 'cargo', c: '#3d342a' }, shoes: { k: 'ankleboot', c: '#2a211d' }, acc: { apron: '#5a3d26' } },
             f: { inner: { k: 'longtee', c: '#8a7a64' }, bottom: { k: 'cargo', c: '#3d342a' }, shoes: { k: 'ankleboot', c: '#2a211d' }, acc: { apron: '#5a3d26' } } },
};

/* ── 마을 나들이 ── 장소마다 만나는 사람(직책 비중) · 종족 비중 · 그곳 사건 태그 */
REALM.places = [
  { id: 'tavern', name: '선술집 「붉은 사슴」', icon: '🍺', roles: { merc: 4, tavern: 1, bard: 2, merchant: 2, smith: 1 }, desc: '용병과 떠돌이가 모이는 곳. 소문이 돈다.' },
  { id: 'square', name: '광장 시장',            icon: '⛲', roles: { merchant: 4, bard: 1, smith: 1, priest: 1, scholar: 1 }, desc: '장이 서는 날엔 사람이 넘친다.' },
  { id: 'temple', name: '빛의 신전',            icon: '⛪', roles: { priest: 4, scholar: 1, noble: 1 }, desc: '치유와 축복. 고아원도 딸려 있다.' },
  { id: 'guild',  name: '용병 길드 지부',        icon: '🛡', roles: { merc: 6, mage: 1 }, desc: '의뢰 게시판과 승급 시험장.' },
  { id: 'salon',  name: '귀족 살롱',            icon: '🎻', roles: { noble: 5, mage: 1, bard: 1 }, desc: '이웃 영지의 자제들이 차를 마시는 곳. 기사 이상만 출입.', minRank: 3 },
];
// 마을 사람 종족 비중 (영지 종류에 따라 조금씩 다름)
REALM.townRaces = { human: 70, elf: 6, dwarf: 9, beast: 11, orc: 4 };

/* ── 노예시장 ── 항구도시 벨레노 뒷골목. 사면 그 자리에서 해방 증서를 써 줌 (사람을 소유하지 않음). 이후 본인이 원하면 가신으로 남음 */
REALM.slaveOrigins = ['전쟁 포로', '빚 때문에 팔려 옴', '해적에게 납치됨', '고향 마을이 불타 끌려옴', '주인이 죽어 다시 팔려 나옴', '부족 싸움에서 져서'];
REALM.slaveSkills = [
  { id: 'fighter', name: '전사였다', role: 'freed', fx: { might: 1 } },
  { id: 'smith',   name: '대장장이였다', role: 'freed', job: 'smith' },
  { id: 'scholar', name: '글을 읽고 셈을 한다', role: 'freed', job: 'steward' },
  { id: 'hunter',  name: '사냥꾼이었다', role: 'freed', fx: { agility: 1 } },
  { id: 'healer',  name: '약초를 다룰 줄 안다', role: 'freed', job: 'healer' },
];
