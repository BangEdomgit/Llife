// 20세 시작 (QUICKSTART.md) — 0~19살을 건너뛰고 스무 살 3월 1일(학년도 시작)부터. 학력·능력치·몸·관계를 직접 정함
// 엔진: js/game.js newLife20 / 화면: js/main.js 20세 시작 단계 (배경 → 능력치 → 외모·신체 → 성격·취향 → 관계 → 확인)
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.quick = {
  points: 300,   // 능력치 6개에 나눠 줌 (각 0~100). 0~100 → 게임 등급 수치로 바꿈 (js/game.js qsStat) — 난이도마다 다름 (diffs)
  // 난이도 (포인트 배분 전에 고름). 샌드박스: 제한 없음 — 능력치 0~100 마음대로, 몸 수치 극단값, 시작 돈·연인 스탯 직접, 저장에 sandbox 표시
  diffs: [
    { id: 'hard', label: '하드', points: 240, desc: '평균 40. 약점이 뚜렷하다.' },
    { id: 'normal', label: '보통', points: 300, desc: '평균 50. 기본.' },
    { id: 'easy', label: '이지', points: 360, desc: '평균 60. 여유 있다.' },
    { id: 'sandbox', label: '샌드박스', points: null, desc: '제한 없음. 능력치는 마음대로(전부 100도), 몸 수치는 극단값까지, 시작 돈과 연인 스탯도 직접 정한다.' },
  ],
  stats: ['smart', 'fit', 'face', 'charm', 'art', 'craft'],
  statDesc: { smart: '학업, 판단', fit: '건강, 운동, 몸', face: '타고난 얼굴', charm: '말솜씨, 분위기', art: '예술, 감정 읽기', craft: '기술, 만들기' },
  presets: [
    { id: 'balance', label: '균형형',   v: [50, 50, 50, 50, 50, 50] },
    { id: 'genius',  label: '천재',     v: [90, 30, 30, 80, 40, 30] },
    { id: 'athlete', label: '운동선수', v: [30, 90, 60, 40, 30, 50] },
    { id: 'looks',   label: '미남미녀', v: [40, 50, 90, 70, 30, 20] },
    { id: 'artist',  label: '예술가',   v: [50, 30, 40, 50, 90, 40] },
    { id: 'allround', label: '만능',    v: [55, 55, 50, 50, 50, 40] },
    { id: 'allmax', label: '올맥스',    v: [100, 100, 100, 100, 100, 100], sandbox: true },   // 샌드박스 전용
  ],
  // 학력 — 대학은 data/school.js의 해당 등급 대학 중에서 고르고 학과까지. 이미 1학년을 마친 2학년으로 시작 (1학년 학점이 잡혀 있음)
  edu: [
    { id: 'elite',   label: '명문대 재학', tiers: [1, 2], desc: '지능 보너스, 인맥 보너스(친구가 더 가깝고 선배 한 명). 돈은 집안대로.', bonus: { smart: 15 } },
    { id: 'normal',  label: '일반대 재학', tiers: [3, 4], desc: '평범한 대학 2학년.' },
    { id: 'college', label: '전문대 재학', tiers: [5],    desc: '손재주·실무 보너스. 올겨울이면 졸업.', bonus: { craft: 15 } },
    { id: 'retake',  label: '재수 중',     desc: '올해 수능을 한 번 더 본다. 시간은 많지만 돈이 없고 스트레스가 크다.' },
    { id: 'work',    label: '취업 (고졸)', desc: '고등학교를 졸업하고 바로 일을 시작했다. 모아둔 돈은 있지만 학력은 없다.' },
  ],
  jobs: ['cvs', 'barista', 'rider', 'cook', 'hair', 'mechanic', 'creator', 'musician'],   // 고졸로 바로 시작할 수 있는 일
  money: { rich: [1000, 2000], comfy: [400, 800], normal: [100, 300], tight: [20, 50], poor: [0, 0], complex: [30, 150] },   // 시작 돈 (만원)
  wealthAdj: { rich: '부유한', comfy: '여유 있는', normal: '평범한', tight: '빠듯한', poor: '어려운', complex: '복잡한' },
  home: [{ id: 'parents', label: '본가에서' }, { id: 'own', label: '자취' }],
  army: [{ id: 'now', label: '올봄 입대' }, { id: 'next', label: '내년 봄 입대' }, { id: 'exempt', label: '면제' }],
  parents: [{ id: 'both', label: '두 분 다 계심' }, { id: 'divorced', label: '이혼하심' }, { id: 'lost', label: '한 분을 여읨' }],
  builds: [{ id: 'slim', label: '마른' }, { id: 'avg', label: '보통' }, { id: 'fit', label: '탄탄한' }, { id: 'chubby', label: '통통한' }],
  cups: ['AA', 'A', 'B', 'C', 'D', 'E', 'F'],
  range: { height: { m: [155, 190], f: [148, 175] }, waist: [55, 80], hip: [80, 105], shoulder: [38, 50], penis: [8, 20], style: [0, 50] },
  rangeSandbox: { height: { m: [140, 200], f: [135, 195] }, waist: [45, 100], hip: [70, 120], shoulder: [34, 56], penis: [5, 25], style: [0, 50], money: [0, 99999] },
  loverStats: [['close', '친밀'], ['trust', '신뢰'], ['heart', '설렘'], ['compat', '궁합'], ['libido', '나를 향한 성욕']],   // 샌드박스에서 직접 정하는 연인 스탯
  // 성격 고를 때 보이는 효과 미리보기
  persEffect: { bold: '플러팅 +, 조심성 -', shy: '신뢰 +, 적극성 -', playful: '매력 +, 진지함 -', cool: '독립성 +, 친밀 -',
    warm: '관계 +, 자기 관리 -', sharp: '판단 +, 호감 -', sunny: '행복 +, 심각함 -', sensitive: '감성 +, 안정감 -' },
  // 연인 — 만난 기간이 길수록 친밀·신뢰는 높고 설렘은 조금 가라앉음
  love: [{ id: 'none', label: '없음 (솔로)' }, { id: 'yes', label: '있음' }, { id: 'ex', label: '복잡함 (전 연인)' }],
  // 전 연인과 헤어진 이유 → 처음 맞는 여름에 이어지는 이야기 (아래 exEcho_*)
  exWhy: [
    { id: 'drift',    label: '자연스럽게 멀어졌다',  line: '자연스럽게 멀어졌다',      p: { close: [25, 35], heart: [10, 15], trust: [30, 40], grudge: [0, 5] } },
    { id: 'fight',    label: '너무 자주 싸웠다',     line: '너무 자주 싸우다 끝났다',  p: { close: [15, 25], heart: [8, 12], trust: [20, 30], grudge: [20, 30] } },
    { id: 'cheated',  label: '상대가 바람을 피웠다', line: '상대의 바람으로 끝났다',   p: { close: [15, 20], heart: [5, 10], trust: [0, 5], grudge: [5, 10] } },
    { id: 'mine',     label: '내가 바람을 피웠다',   line: '내 잘못으로 끝났다',       p: { close: [10, 15], heart: [5, 10], trust: [5, 10], grudge: [50, 65] }, karma: -8 },
    { id: 'distance', label: '멀리 떨어지게 됐다',   line: '멀리 떨어지면서 끝났다',   p: { close: [30, 40], heart: [20, 30], trust: [40, 50], grudge: [0, 0] } },
  ],
  // 어린 시절 추억 (성격마다 초등학교·고등학교 한 개씩) + 취미로 중학교 한 개 → 앨범에
  autoMemories: {
    bold:      ['초등학교 때 주먹 한 방으로 왕따를 멈추게 했다.', '고등학교 축제에서 무대를 혼자 섰다.'],
    shy:       ['초등학교 때 전학 온 날 한마디도 못 했다.', '고등학교 때 좋아하는 애한테 끝내 고백 못 했다.'],
    playful:   ['초등학교 때 선생님 별명을 만들어서 유명해졌다.', '고등학교 때 친구들 사이에서 분위기 메이커였다.'],
    cool:      ['초등학교 때 혼자 도서관에서 시간을 보냈다.', '고등학교 때 졸업식에서도 안 울었다.'],
    warm:      ['초등학교 때 다친 친구를 업고 보건실에 갔다.', '고등학교 때 후배들이 잘 따랐다.'],
    sharp:     ['초등학교 때 불공평한 규칙에 항의하다 벌을 섰다.', '고등학교 때 토론 대회에서 우승했다.'],
    sunny:     ['초등학교 때 매일 웃어서 "해바라기"라는 별명이 붙었다.', '고등학교 때 힘든 일이 있어도 남들 앞에서 웃었다.'],
    sensitive: ['초등학교 때 친구가 전학 가는 날 하루 종일 울었다.', '고등학교 때 쓴 시가 교지에 실렸다.'],
  },
  hobbyMemories: {
    game: '중학교 때 PC방 대회에서 처음으로 상품을 탔다.', sport: '중학교 때 체육대회 계주 마지막 주자였다.',
    music: '중학교 때 처음 산 이어폰으로 밤새 노래를 들었다.', book: '중학교 때 도서관 책을 제일 많이 빌린 학생이었다.',
    cook: '중학교 때 처음 끓인 김치찌개를 가족이 맛있다고 해줬다.', travel: '중학교 때 혼자 기차를 타고 바다를 보러 갔다.',
    draw: '중학교 때 그린 그림이 복도에 걸렸다.', fashion: '중학교 때 용돈을 모아 처음으로 내 옷을 샀다.',
  },
  highSchools: ['한솔고등학교', '새빛고등학교', '푸른숲고등학교', '청운고등학교', '늘해고등학교', '동산고등학교', '미래고등학교', '한마음고등학교'],
};

// 전 연인과 이어지는 이야기 — 20세 시작에서 '복잡함'을 고르면 처음 맞는 여름에 (헤어진 이유마다 하나)
(function () {
  const exOf = (s, a) => a.person(s.vars.exId);
  const base = id => ({
    id: 'exEcho_' + id, type: 'must', season: ['여름'],
    when: (s, a) => !!s.quickstart && s.vars.exWhy === id && (() => { const p = exOf(s, a); return !!p && p.ex && !(p.partner || p.spouse || p.secret); })(),
    onStart: (s, a) => a.focus(exOf(s, a)),
  });
  const ev = [
    Object.assign(base('drift'), { text: '{fp}에게서 오랜만에 연락이 왔다. "잘 지내? 갑자기 생각나서."',
      choices: [
        { label: '만나서 밥이나 먹자고 한다', p: { close: [6, 10], heart: [4, 8] }, text: '{fp|와} 밥을 먹었다. 어색함은 10분이면 사라졌다.', effect: { happy: 3 } },
        { label: '"응, 잘 지내." 하고 끝낸다', p: { close: [-3, 0] }, text: '짧게 답장하고 휴대폰을 내려놨다. 그걸로 됐다.' },
      ] }),
    Object.assign(base('fight'), { text: '친구 생일 파티에 {fp|이} 와 있었다. 눈이 마주쳤다.',
      choices: [
        { label: '먼저 인사한다', karma: 1, p: { grudge: [-12, -8], close: [3, 6] }, text: '"…안녕." 그때만큼 날이 서 있진 않았다.', effect: { happy: 2 } },
        { label: '모른 척한다', p: { grudge: [2, 5] }, text: '파티 내내 반대편 구석에만 있었다.', effect: { happy: -2 } },
      ] }),
    Object.assign(base('cheated'), { text: '{fp|이} 긴 메시지를 보냈다. "그때 정말 미안했어. 한 번만 얼굴 보고 사과하고 싶어."',
      choices: [
        { label: '만나서 사과를 받는다', p: { trust: [6, 10], close: [4, 8] }, text: '{fp|은} 고개를 들지 못했다. 이상하게 마음이 조금 가벼워졌다.', effect: { happy: 3 } },
        { label: '차단한다', do: (s, a) => { const p = a.focused(); if (p) { p.close = 0; p.heart = 0; } }, text: '차단 버튼을 눌렀다. 손끝이 조금 떨렸다.', effect: { happy: -1 } },
      ] }),
    Object.assign(base('mine'), { text: '{fp}의 친구가 내 앞을 막아섰다. "너 걔한테 그래놓고 잘도 웃고 다닌다?"',
      choices: [
        { label: '진심으로 미안하다고 전해달라고 한다', karma: 4, p: { grudge: [-15, -10] }, text: '"…전해는 줄게." 친구가 돌아섰다.', effect: { happy: -1 } },
        { label: '"끝난 일이야."', karma: -2, p: { grudge: [3, 6] }, text: '그날 이후로 단톡방이 조금 조용해졌다.', effect: { happy: -3 } },
      ] }),
    Object.assign(base('distance'), { text: '{fp|이} 돌아왔다고 연락이 왔다. "잠깐 볼 수 있어?"',
      choices: [
        { label: '다시 시작해본다', if: (s, a) => !a.main() && a.canRomance(a.focused()), do: (s, a) => a.startRelation(a.focused(), false),
          p: { heart: [10, 15], close: [8, 12] }, text: '{fp|와} 다시 만나기로 했다. 그동안 못 한 이야기가 많았다.', memory: true, effect: { happy: 8 } },
        { label: '친구로 지내자고 한다', p: { close: [5, 8], heart: [-5, -2] }, text: '"그래, 그게 맞겠다." 둘 다 조금 웃었다.', effect: { happy: 1 } },
      ] }),
  ];
  GAME_DATA.events = (GAME_DATA.events || []).concat(ev);
})();
