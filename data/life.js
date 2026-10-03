// 인생 기본 데이터 — 설정, 능력치 등급, 시작 특성, 사람 정보, 행동, 계절 문장
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.config = {
  endAge: 50,
  apPerYear: 10,
  livingCost: 1200,
  randomEventChance: .14,
  placeEventChance: .25,    // 장소에 도착했을 때 랜덤 이벤트 확률
  flavorChance: .3,
  maxPeople: 24,
  romanceMinAge: 19,        // 설렘(연애): 플레이어와 상대 모두 이 나이 이상
  romanceMaxAge: 49,        //             상대가 이 나이 이하
  seasons: [
    { id: '봄',   icon: '🌸', at: 0, fixed: true,  months: [3, 4, 5],  weather: { sunny: 3, partly: 3, rain: 2, dust: 2, fog: 1, rainbow: 1 } },
    { id: '여름', icon: '🌻', at: 3, fixed: true,  months: [6, 7, 8],  weather: { sunny: 4, partly: 2, rain: 3, storm: 2, cloudy: 1, rainbow: 1 } },
    { id: '가을', icon: '🍁', at: 6, fixed: false, months: [9, 10, 11], weather: { sunny: 3, partly: 3, cloudy: 2, fog: 2, rain: 1 } },
    { id: '겨울', icon: '⛄', at: 8, fixed: true,  months: [12, 1, 2], weather: { snow: 4, sleet: 2, cloudy: 3, sunny: 2, fog: 1 } },
  ],
};

/* ───── 능력치: 100에서 멈추지 않고 등급으로 올라감 ───── */
// 상태(0~100): 행복, 건강 / 능력(상한 없음, 등급): 지능, 체력, 외모, 매력, 감성, 손재주
GAME_DATA.abilities = ['smart', 'fit', 'looks', 'charm', 'art', 'craft'];
GAME_DATA.statLabel = { happy: '행복', health: '건강', smart: '지능', fit: '체력', looks: '외모', charm: '매력', art: '감성', craft: '손재주', money: '돈' };
// [등급, 시작값, 이 등급에서 오르는 속도]
GAME_DATA.grades = [
  ['F', 0, 1], ['E', 25, 1], ['D', 50, 1], ['C', 80, .85],
  ['B', 120, .7], ['A', 170, .55], ['S', 230, .4], ['SS', 300, .3],
];

/* ───── 시작 특성 ───── */
// 소질 — 하나 고름
GAME_DATA.traits = [
  { id: 'gifted',   label: '영재',        desc: '지능이 1.5배로 오르고 높게 시작한다.',   mult: { smart: 1.5 }, start: { smart: 15 } },
  { id: 'athletic', label: '운동 신경',   desc: '체력이 1.5배로 오르고 높게 시작한다.',   mult: { fit: 1.5 }, start: { fit: 15 } },
  { id: 'pretty',   label: '타고난 외모', desc: '외모가 아주 높게 시작한다.',             mult: { looks: 1.2 }, start: { looks: 30 } },
  { id: 'social',   label: '사교적',      desc: '매력이 잘 오르고 사람과 금방 가까워진다.', mult: { charm: 1.5 }, relMult: 1.3 },
  { id: 'artistic', label: '예술 감각',   desc: '감성이 1.5배로 오르고 높게 시작한다.',   mult: { art: 1.5 }, start: { art: 15 } },
  { id: 'handy',    label: '손재주',      desc: '손재주가 1.5배로 오르고 높게 시작한다.', mult: { craft: 1.5 }, start: { craft: 15 } },
  { id: 'sturdy',   label: '튼튼한 몸',   desc: '나이 들어도 건강이 덜 깎인다.',          agingMult: .5, start: { health: 10 } },
  { id: 'optimist', label: '낙천적',      desc: '안 좋은 일에도 행복이 덜 떨어진다.',     negMult: { happy: .5 } },
  { id: 'nimble',   label: '손이 빠름',   desc: '나쁜 짓도 잘 안 걸린다. 그래도 언젠가는…', crimeBonus: .12 },
];

/* ───── 사람 정보 (나와 NPC 공통) ───── */
// 성격 — mod: 상호작용별 효과 배율 / signal: 설렘이 생겼을 때 보내는 신호 / friendLine: 친해졌을 때 모습
//        open: 처음 보는 사이에 말 걸었을 때 잘 받아주는 정도 / hello: 받아줬을 때 / snub: 대화가 끊겼을 때
GAME_DATA.personalities = [
  { id: 'bold',      label: '직진형', desc: '마음에 들면 바로 표현한다.',     mod: { flirt: 1.2, hang: 1.1 }, confessBonus: 10,
    signal: '{fp|이} 먼저 영화 보자고 연락해왔다.', friendLine: '{fp|이} 대뜸 주말에 뭐 하냐고 물었다.',
    open: .15, hello: '"나 {p}. 너는?" 상대가 먼저 손을 내밀었다.',
    snub: '"아, 지금 좀 바빠서요." 단칼에 잘렸다.' },
  { id: 'shy',       label: '소심형', desc: '표현은 서툴지만 오래 기억한다.', mod: { flirt: .8, listen: 1.3, talk: 1.1 },
    signal: '{fp|이} 지나가듯 한 내 말을 기억하고 있었다.', friendLine: '{fp|이} 쭈뼛거리며 과자를 내밀었다.',
    open: -.15, hello: '{p|이} 깜짝 놀라더니, 작은 목소리로 이름을 알려줬다.',
    snub: '상대가 고개만 꾸벅하고 자리를 피했다.' },
  { id: 'playful',   label: '장난형', desc: '장난으로 마음을 드러낸다.',       mod: { hang: 1.3, argue: .7 },
    signal: '{fp}의 장난이 부쩍 늘었다. 이상하게 나한테만.', friendLine: '{fp|이} 몰래 내 가방에 웃긴 쪽지를 넣어놨다.',
    open: .1, hello: '{p|이} 이름 대신 수수께끼를 냈다. 겨우 맞히고 나서야 이름을 알려줬다.',
    snub: '농담으로 받아치더니 그대로 가버렸다.' },
  { id: 'cool',      label: '무심형', desc: '무심한 척 다 챙겨준다.',          mod: { talk: .8, gift: 1.3 },
    signal: '{fp|이} 아무렇지 않게 우산을 씌워줬다.', friendLine: '{fp|이} 말없이 음료수를 놓고 갔다.',
    open: -.1, hello: '{p|은} 짧게 이름만 말했다. 그래도 싫은 눈치는 아니었다.',
    snub: '대답이 "네." 한마디로 끝났다.' },
  { id: 'warm',      label: '다정형', desc: '누구에게나 따뜻하다.',            mod: { listen: 1.3, apologize: 1.3 },
    signal: '{fp|이} 내가 아팠던 날을 기억하고 죽을 사왔다.', friendLine: '{fp|이} 내 생일을 제일 먼저 챙겼다.',
    open: .1, hello: '{p|이} 환하게 웃으며 옆자리를 내줬다.',
    snub: '상대가 미안하다며 일행에게 돌아갔다.' },
  { id: 'sharp',     label: '냉철형', desc: '솔직하고 이성적이다.',            mod: { talk: 1.2, flirt: .85, argue: 1.2 },
    signal: '{fp|이} 나랑 있을 때만 말이 길어진다.', friendLine: '{fp|이} 내 고민에 정확한 답을 줬다.',
    open: 0, hello: '{p|은} 용건부터 물었다. 대답을 듣고 나서야 이름을 알려줬다.',
    snub: '"무슨 일이시죠?" 대화가 거기서 끝났다.' },
  { id: 'sunny',     label: '낙천형', desc: '어디서든 분위기를 띄운다.',       mod: { hang: 1.2 },
    signal: '{fp|이} 나만 보면 웃는다.', friendLine: '{fp} 덕분에 하루 종일 웃었다.',
    open: .15, hello: '{p|이} 처음 본 사이가 맞나 싶을 만큼 반겨줬다.',
    snub: '웃으며 인사는 받아줬지만 금방 다른 데로 갔다.' },
  { id: 'sensitive', label: '예민형', desc: '섬세하고 상처를 잘 받는다.',      mod: { argue: 1.5, gift: 1.2, listen: 1.2 },
    signal: '{fp|이} 내 표정 하나하나를 읽는다.', friendLine: '{fp|이} 내 기분이 안 좋은 걸 먼저 알아챘다.',
    open: -.05, hello: '{p|이} 잠깐 망설이다가 조심스럽게 웃었다.',
    snub: '경계하는 눈빛이 돌아왔다. 괜히 말을 걸었나 싶었다.' },
];
// 어릴 때 처음 보는 아이에게 말 걸었을 때
GAME_DATA.kidHello = ['{p|이} 같이 놀자며 손을 잡아끌었다.', '{p|와} 금방 친구가 됐다. 서로 이름을 크게 외쳤다.', '{p|이} 아끼는 사탕을 하나 나눠줬다.'];
// 취미 — 같은 취미면 같이 놀 때 더 가까워짐. act: 같이 놀 때 문장
GAME_DATA.hobbies = [
  { id: 'game',    label: '게임',   act: ['PC방에서 게임을 했다.', '같이 게임 대회에 나갔다.'] },
  { id: 'sport',   label: '운동',   act: ['배드민턴을 쳤다.', '같이 달리기를 했다.'] },
  { id: 'music',   label: '음악',   act: ['코인노래방에 갔다.', '같이 공연을 보러 갔다.'] },
  { id: 'book',    label: '독서',   act: ['서점 구경을 했다.', '같은 책을 읽고 이야기했다.'] },
  { id: 'cook',    label: '요리',   act: ['같이 떡볶이를 만들었다.', '맛집 투어를 했다.'] },
  { id: 'travel',  label: '여행',   act: ['당일치기 여행을 다녀왔다.', '처음 가보는 동네를 걸었다.'] },
  { id: 'draw',    label: '그림',   act: ['전시회에 갔다.', '서로 얼굴을 그려줬다.'] },
  { id: 'fashion', label: '패션',   act: ['쇼핑을 했다.', '서로 옷을 골라줬다.'] },
];
// 가치관 — 같으면 신뢰·설렘이 잘 오르고, 부딪히는 짝이면 덜 오름
GAME_DATA.values = [
  { id: 'family', label: '가족' }, { id: 'money', label: '돈' }, { id: 'success', label: '성공' },
  { id: 'freedom', label: '자유' }, { id: 'stable', label: '안정' }, { id: 'love', label: '사랑' },
];
GAME_DATA.valueClash = [['freedom', 'stable'], ['money', 'love'], ['success', 'family']];
// 집안 형편 — 시작 돈, 어릴 때 용돈(매년), 관련 이벤트
GAME_DATA.wealth = [
  { id: 'rich',    label: '부유',       weight: 1, money: 500, allowance: [80, 150], desc: '부족한 게 없다. 기대도 크다.' },
  { id: 'comfy',   label: '여유',       weight: 2, money: 200, allowance: [40, 80],  desc: '하고 싶은 건 대부분 할 수 있다.' },
  { id: 'normal',  label: '보통',       weight: 4, money: 50,  allowance: [15, 40],  desc: '평범한 집이다.' },
  { id: 'tight',   label: '빠듯',       weight: 2, money: 10,  allowance: [5, 15],   desc: '갖고 싶은 걸 참는 게 익숙하다.' },
  { id: 'poor',    label: '어려움',     weight: 1, money: 0,   allowance: [0, 5],    desc: '일찍 철이 든다.' },
  { id: 'complex', label: '복잡한 집안', weight: 1, money: 30, allowance: [5, 30],   desc: '집이 조용한 날이 드물다.' },
];
// 꿈 — 이루면 추억, 엔딩에 표시
GAME_DATA.dreams = [
  { id: 'doctor',   label: '의사',       job: 'doctor' },
  { id: 'teacher',  label: '선생님',     job: 'teacher' },
  { id: 'dev',      label: '개발자',     job: 'dev' },
  { id: 'creator',  label: '유튜버',     job: 'creator' },
  { id: 'singer',   label: '가수',       job: 'musician' },
  { id: 'chef',     label: '셰프',       job: 'cook' },
  { id: 'civil',    label: '공무원',     job: 'civil' },
  { id: 'reporter', label: '기자',       job: 'reporter' },
  { id: 'rich',     label: '부자',       money: 100000 },
  { id: 'family',   label: '행복한 가정', flag: 'married' },
];
// 형제 — 가족 NPC로 추가됨
GAME_DATA.siblings = [
  { id: 'none',     label: '외동' },
  { id: 'olderB',   label: '형·오빠',   gender: 'm', gap: [1, 6] },
  { id: 'olderS',   label: '누나·언니', gender: 'f', gap: [1, 6] },
  { id: 'youngerB', label: '남동생',    gender: 'm', gap: [-6, -1] },
  { id: 'youngerS', label: '여동생',    gender: 'f', gap: [-6, -1] },
  { id: 'twin',     label: '쌍둥이',    gap: [0, 0] },
];
// 생김새·말버릇 (NPC만, 처음부터 보임)
GAME_DATA.features = ['안경을 썼다', '키가 크다', '보조개가 있다', '목소리가 크다', '손글씨가 예쁘다', '웃음소리가 특이하다',
  '늘 이어폰을 끼고 있다', '말끝을 흐린다', '눈썹이 진하다', '걸음이 빠르다', '주근깨가 있다', '향수 냄새가 난다'];
// 사람 정보가 보이기 시작하는 친밀도 (친밀·신뢰 중 높은 쪽 기준)
GAME_DATA.revealAt = { personality: 15, hobby: 30, dream: 40, value: 50, wealth: 60 };

GAME_DATA.surnames = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','홍'];
GAME_DATA.namesM = ['민준','서준','도윤','예준','시우','하준','지호','주원','지후','준우','건우','현우','우진','선우','유찬','은호','태윤','하람','재민','승현'];
GAME_DATA.namesF = ['서연','서윤','지우','하은','민서','하윤','윤서','지유','채원','수아','지아','다은','예린','소율','은서','나윤','유나','하린','수빈','가은'];
GAME_DATA.dogNames = ['초코','보리','콩이','두부','몽이','해피','구름','밤이'];

/* ───── 행동 (장소에서 행동 1 사용, cost는 18살부터 내 돈에서) ───── */
// 어느 장소에서 할 수 있는지는 data/places.js의 actions에서 정함
// perf: 일 성과 / subjAll: 중·고등학생이면 모든 과목 실력이 오름
GAME_DATA.actions = [
  { id: 'rest',      label: '쉬기',   icon: '🛋', minAge: 0,  effect: { health: [1, 2], happy: [1, 3] },
    text: s => s.age < 4 ? ['낮잠을 푹 잤다.', '엄마 품에서 잠들었다.', '모빌을 보다가 잠들었다.']
      : ['이불 속에서 뒹굴었다.', '아무것도 안 하고 하루를 보냈다.', '낮잠을 자고 일어나니 저녁이었다.'] },
  { id: 'play',      label: '놀기',   icon: '🪁', minAge: 4,  effect: { happy: [3, 5], fit: [1, 3], charm: [0, 1] },
    text: ['해가 질 때까지 뛰어놀았다.', '무릎이 까지도록 놀았다.', '모래 범벅이 돼서 집에 갔다.'] },
  { id: 'study',     label: '공부',   icon: '📚', minAge: 6,  effect: { smart: [2, 5], happy: [-2, 0] },
    text: ['문제집 한 권을 끝냈다.', '노트 정리를 깔끔하게 끝냈다.', '밤늦게까지 책상 앞에 앉아 있었다.'] },
  { id: 'exercise',  label: '운동',   icon: '🏃', minAge: 5,  effect: { fit: [3, 6], health: [1, 3], looks: [0, 1] },
    text: ['동네를 몇 바퀴 뛰었다.', '땀을 흠뻑 흘렸다.', '숨이 턱까지 차도록 움직였다.'] },
  { id: 'read',      label: '독서',   icon: '📖', minAge: 7,  effect: { smart: [1, 3], art: [0, 2], happy: [1, 2] },
    text: ['책 한 권을 다 읽었다.', '책에 빠져 시간 가는 줄 몰랐다.', '읽다 만 책을 드디어 끝냈다.'] },
  { id: 'artPrac',   label: '예술',   icon: '🎨', minAge: 5,  effect: { art: [3, 6], happy: [1, 2] },
    text: ['그림을 한 장 완성했다.', '피아노 앞에 오래 앉아 있었다.', '노래를 녹음해봤다.'] },
  { id: 'make',      label: '만들기', icon: '🔧', minAge: 6,  effect: { craft: [3, 6], happy: [0, 2] },
    text: ['고장 난 라디오를 뜯어봤다.', '나무로 작은 상자를 만들었다.', '레고로 성을 쌓았다.'] },
  { id: 'walk',      label: '산책',   icon: '🌳', minAge: 4,  effect: { happy: [2, 5], health: [0, 1] },
    text: ['바람 쐬러 동네를 걸었다.', '공원 벤치에 한참 앉아 있었다.', '처음 가보는 골목을 걸어봤다.'] },
  { id: 'cram',      label: '수업',   icon: '📝', minAge: 7,  cost: 20, subjAll: [2, 3], effect: { smart: [2, 4], happy: [-3, -1] },
    text: ['학원 수업을 끝까지 버텼다.', '단어 시험에서 재시험을 봤다.', '밤 10시에 학원 문을 나섰다.'] },
  { id: 'game',     label: '게임',   icon: '🎮', minAge: 8,  effect: { happy: [3, 6], smart: [-1, 0] },
    text: ['게임 한 판만 하려다 세 시간이 지났다.', '드디어 어려운 판을 깼다.', '친구들이랑 밤늦게까지 게임을 했다.'] },
  { id: 'style',     label: '꾸미기', icon: '💇', minAge: 13, cost: 20, effect: { looks: [2, 5], charm: [0, 1], happy: [0, 2] },
    text: ['머리를 새로 했다.', '옷장을 정리하고 새 옷을 샀다.', '거울 앞에서 한참을 고민했다.'] },
  { id: 'parttime',  label: '알바',   icon: '🏪', minAge: 16, req: { job: false }, effect: { money: [30, 70], health: [-2, 0], charm: [0, 1], happy: [-2, 0] },
    text: s => s.place === 'cafe' ? ['카페에서 주말 알바를 했다.', '하루 종일 우유 거품을 냈다.'] : s.place === 'conveni' ? ['편의점 야간 알바를 했다.', '새벽에 들어온 물건을 진열했다.']
      : ['옷 가게에서 하루 종일 옷을 갰다.', '전단지를 돌렸다.', '물류센터에서 하루 일했다.'] },
  { id: 'work',      label: '일',     icon: '💼', minAge: 19, req: { job: true }, work: true, effect: { money: [50, 150], health: [-4, -1], happy: [-3, -1] },
    text: ['하루 종일 일에 매달렸다.', '맡은 일을 끝까지 해냈다.', '정신없이 하루가 지나갔다.'] },
  { id: 'overtime',  label: '야근',   icon: '🌙', minAge: 19, req: { job: true }, work: true, perf: [10, 18], effect: { money: [80, 180], health: [-7, -3], happy: [-5, -2] },
    text: ['사무실 불을 마지막으로 껐다.', '막차를 놓쳐서 택시를 탔다.', '주말에도 나와서 일했다.'] },
  { id: 'doctor',    label: '진료',   icon: '🩺', minAge: 5,  cost: 30, effect: { health: [5, 10] },
    text: s => s.age < 18 ? ['엄마 손을 잡고 소아과에 갔다.', '주사를 맞고 사탕을 받았다.'] : ['진료를 받고 약을 타 왔다.', '미뤄둔 치과에 다녀왔다.', '한의원에서 침을 맞았다.'] },
  { id: 'coffee',    label: '커피',   icon: '☕', minAge: 13, cost: 5, effect: { happy: [2, 4] },
    text: ['창가 자리에서 커피를 마셨다.', '처음 보는 메뉴를 시켜봤다.', '커피 한 잔을 두고 멍하니 있었다.'] },
  { id: 'shop',      label: '쇼핑',   icon: '🛍', minAge: 10, cost: 30, effect: { happy: [3, 6], looks: [0, 2] },
    text: ['충동구매를 했다. 후회는 없다.', '구경만 하려다 두 손이 무거워졌다.', '오래 고민하던 신발을 샀다.'] },
  { id: 'drink',     label: '한잔',   icon: '🍺', minAge: 19, cost: 30, effect: { happy: [3, 7], health: [-3, -1], charm: [0, 1] },
    text: ['한 잔만 하려다 두 병을 비웠다.', '시원한 생맥주 한 잔에 하루가 풀렸다.', '안주가 맛있어서 술이 술술 들어갔다.'] },
  { id: 'pray',      label: '기도',   icon: '🙏', minAge: 4,  effect: { happy: [1, 3] }, karma: [1, 3],
    text: ['눈을 감고 오래 앉아 있었다.', '두 손을 모으고 소원을 빌었다.', '마음이 조금 가라앉았다.'] },
  { id: 'snack',     label: '간식',   icon: '🍙', minAge: 6,  cost: 5, effect: { happy: [1, 3] },
    text: ['삼각김밥과 바나나우유를 샀다.', '컵라면에 물을 붓고 3분을 기다렸다.', '1+1 과자를 두 개 집었다.'] },
  { id: 'watch',     label: '공연',   icon: '🎵', minAge: 15, cost: 40, effect: { happy: [5, 9], art: [1, 3] }, memoryChance: .2,
    text: ['목이 쉬도록 따라 불렀다.', '앙코르 곡에서 소름이 돋았다.', '공연이 끝나고도 귀가 웅웅거렸다.'] },
  { id: 'volunteer', label: '봉사',   icon: '🤝', minAge: 12, effect: { happy: [2, 4], charm: [0, 2] }, karma: [4, 8],
    text: ['보육원에서 아이들과 놀아줬다.', '유기견 보호소 청소를 도왔다.', '무료 급식소에서 배식을 했다.'] },
  { id: 'donate',    label: '기부',   icon: '💝', minAge: 20, cost: 100, effect: { happy: [2, 4] }, karma: [8, 14],
    text: ['조금이지만 기부를 했다.', '정기 후원을 시작했다.', '모금함에 봉투를 넣었다.'] },
  { id: 'travel',    label: '여행',   icon: '🧳', minAge: 20, cost: 150, effect: { happy: [6, 12], art: [0, 2] }, memoryChance: .35,
    text: ['훌쩍 바다를 보러 다녀왔다.', '처음 가보는 도시를 걸었다.', '기차 창밖만 보다가 돌아왔다.'] },
];

GAME_DATA.jailActions = [
  { id: 'jWork',   label: '운동', icon: '🏋', effect: { fit: [3, 6], health: [1, 3] }, text: ['운동장을 몇 바퀴 돌았다.', '팔굽혀펴기를 백 개 했다.'] },
  { id: 'jRead',   label: '독서', icon: '📖', effect: { smart: [2, 4], happy: [0, 1] }, text: ['도서관 책을 한 권 다 읽었다.', '창살 사이로 들어오는 빛 아래서 책을 읽었다.'] },
  { id: 'jRepent', label: '반성', icon: '🙏', effect: { happy: [-1, 0] }, karma: [4, 8], text: ['지난 일을 하나씩 떠올렸다.', '부치지 못할 사과 편지를 썼다.'] },
  { id: 'jEscape', label: '탈옥', icon: '🕳', escape: true },
];

GAME_DATA.seasonLines = {
  '봄': {
    child: ['벚꽃잎을 잡으려고 한참을 뛰어다녔다.', '새 학년, 새 반. 짝꿍이 바뀌었다.', '개나리 꺾다가 혼났다.'],
    teen:  ['벚꽃 아래서 친구들이랑 사진을 찍었다.', '새 학기 첫날, 교실 공기가 낯설었다.', '춘곤증 때문에 수업 시간에 졸았다.'],
    adult: ['퇴근길에 벚꽃이 흩날렸다.', '봄옷을 꺼냈다. 아직 조금 쌀쌀했다.', '창문을 열어두고 잤다.'],
    jail:  ['담장 너머로 벚꽃이 피는 게 보였다.'],
  },
  '여름': {
    child: ['수박을 반으로 갈라 숟가락으로 퍼먹었다.', '매미 소리에 낮잠을 설쳤다.', '물놀이하다 코에 물이 들어갔다.'],
    teen:  ['에어컨 아래 자리를 두고 신경전이 벌어졌다.', '장마가 길었다. 운동화가 마를 날이 없었다.', '편의점 앞에서 아이스크림을 나눠 먹었다.'],
    adult: ['장마가 길었다. 빨래가 마르지 않았다.', '편의점 앞 파라솔에서 맥주를 마셨다.', '열대야에 선풍기를 끌어안고 잤다.'],
    jail:  ['방 안이 찜통 같았다.'],
  },
  '가을': {
    child: ['은행잎을 주워 책갈피를 만들었다.', '운동회 연습을 했다.'],
    teen:  ['하늘이 높아서 괜히 공부가 안 됐다.', '축제 준비로 학교가 시끌벅적했다.'],
    adult: ['바람이 선선해졌다. 괜히 마음이 싱숭생숭했다.', '낙엽 밟는 소리가 좋았다.'],
    jail:  ['바람이 차가워졌다.'],
  },
  '겨울': {
    child: ['첫눈에 강아지처럼 뛰어다녔다.', '손이 꽁꽁 얼 때까지 눈싸움을 했다.', '이불 속에서 귤을 까먹었다.'],
    teen:  ['귤 까먹으며 이불 속에서 방학을 보냈다.', '입김을 불며 등교했다.', '연말 분위기에 괜히 들떴다.'],
    adult: ['붕어빵 트럭이 다시 나타났다.', '연말이라 약속이 많았다.', '보일러를 틀고 일찍 잠들었다.'],
    jail:  ['얇은 담요로 겨울을 버텼다.'],
  },
};
GAME_DATA.weatherLines = {
  snow:    ['눈이 펑펑 내렸다. 창밖이 온통 하얬다.', '발목까지 눈이 쌓였다.'],
  sleet:   ['진눈깨비 때문에 길이 질척했다.'],
  rain:    ['하루 종일 비가 내렸다. 빗소리가 좋았다.', '우산을 두고 나와서 홀딱 젖었다.'],
  storm:   ['천둥이 무섭게 울렸다. 창문이 덜컹거렸다.'],
  dust:    ['하늘이 누렇다. 하루 종일 마스크를 썼다.'],
  fog:     ['안개가 짙어서 앞이 잘 안 보였다.'],
  rainbow: ['비가 그치고 무지개가 떴다. 한참 올려다봤다.'],
};
// 가족과 시간 보낼 때 문장 (호칭별)
GAME_DATA.familyText = {
  '엄마': ['엄마랑 장을 보러 갔다.', '엄마랑 저녁 먹으면서 이야기했다.', '엄마랑 옛날 사진첩을 넘겨봤다.'],
  '아빠': ['아빠랑 배드민턴을 쳤다.', '아빠랑 동네를 산책했다.', '아빠랑 TV 보면서 이야기했다.'],
  _sib:   ['{p|와} 리모컨을 두고 다퉜다. 그래도 재밌었다.', '{p|와} 같이 라면을 끓여 먹었다.', '{p|와} 밤늦게까지 수다를 떨었다.'],
};
