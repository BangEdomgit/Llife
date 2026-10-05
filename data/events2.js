// 이벤트 더하기 (MAP 단계) — 이웃·집(부동산), 커플·부부와 마주침, 장소·대화, 대학 캠퍼스
//   형식은 data/events.js와 같음 (type·on·age·when·onStart·choices …). GAME_DATA.events 끝에 붙음
window.GAME_DATA = window.GAME_DATA || {};

(function () {
const E = GAME_DATA.events;
/* ═════ 이웃 (data/housing.js — 사는 집에 따라 이웃 구성이 다름) ═════ */
// 지금 동네의 스무 살 넘은 이웃 / 초점 맞추기(호수도 같이) / 그런 이웃이 있는지
const nbAdult = (a, fn) => a.neighbors().filter(p => a.npcAge(p) >= 20 && (!fn || fn(p, a)));
const focusNb = fn => (s, a) => { const p = a.pick(nbAdult(a, fn)); a.focus(p); s.vars.nbUnit = p ? p.unit : ''; };
const hasNb = fn => (s, a) => nbAdult(a, fn).length > 0;
const homeIs = (...ids) => (s, a) => ids.includes(a.home().id);
const both = (...fs) => (s, a) => fs.every(f => f(s, a));

E.push(
  { id: 'nb_parcel', type: 'random', on: ['block', 'home'], age: [19, 70], once: false, cooldown: 1, when: hasNb(), onStart: focusNb(),
    text: '{nbUnit} 앞으로 온 택배가 우리 집 앞에 잘못 와 있었다. 받는 사람: {fp}.',
    choices: [
      { label: '직접 가져다준다', p: { close: [4, 7], trust: [2, 4] }, effect: { happy: 1 }, text: '{fp|이} 문을 열고 고맙다며 웃었다. 처음으로 제대로 인사를 나눴다.' },
      { label: '관리실에 맡겨 둔다', text: '관리실 아저씨가 고개를 끄덕였다. 이웃의 얼굴은 여전히 모른다.' },
    ] },
  { id: 'nb_elevator', type: 'random', on: ['block'], age: [19, 65], once: false, cooldown: 1, when: both(homeIs('officetel', 'apt', 'oneroom'), hasNb()), onStart: focusNb(),
    text: '엘리베이터에 {fp|와} 단둘이 탔다. 둘 다 층수 버튼만 쳐다봤다.',
    choices: [
      { label: '날씨 얘기를 꺼낸다', check: { stat: 'charm', diff: 60 },
        success: { p: { close: [3, 6] }, text: '"오늘 진짜 덥죠." 한마디에 {fp|이} 웃었다. 내릴 때 "들어가세요" 소리가 다정했다.' },
        fail: { p: { close: [1, 2] }, text: '"…네." 대화는 거기서 끝났다. 엘리베이터가 유난히 느렸다.' } },
      { label: '휴대폰만 본다', text: '문이 열리자 둘 다 조용히 내렸다.' },
    ] },
  { id: 'nb_housewarming', type: 'random', on: ['block', 'home'], age: [20, 70], once: false, cooldown: 1,
    when: (s, a) => s.home && (s.dayN || 0) - (s.home.since || 0) < 45 && (s.home.n || 0) > 0 && nbAdult(a).length >= 2,
    text: '이사 온 지 얼마 안 됐다. 이웃들에게 인사를 돌릴까?',
    choices: [
      { label: '떡을 돌린다', effect: { money: -3, happy: 2, charm: [0, 1] },
        do: (s, a) => nbAdult(a).slice(0, 4).forEach(p => a.changeP(p, { close: [3, 6] })),
        text: '문이 열릴 때마다 다른 얼굴이 나왔다. "어머, 요즘 이런 사람 없는데." 이웃 몇 명의 이름을 알게 됐다.' },
      { label: '조용히 지낸다', text: '이웃과는 복도에서 목례만 하는 사이로 지내기로 했다.' },
    ] },
  { id: 'nb_wall', type: 'random', on: ['home'], age: [20, 50], once: false, cooldown: 2,
    when: both(s => !!s.flags.ownPlace, homeIs('goshiwon', 'oneroom', 'villa'), hasNb(p => p.mateId && !p.married)), onStart: focusNb(p => p.mateId && !p.married),
    text: '밤늦게 벽 너머로 {nbUnit} 커플의 웃음소리가 들렸다. 곧 침대 삐걱이는 소리가 이어졌다. 벽이 얇다.',
    choices: [
      { label: '이어폰을 낀다', effect: { happy: -1 }, text: '음악 볼륨을 올렸다. 그래도 잠이 쉽게 오지 않았다.' },
      { label: '벽을 두 번 두드린다', p: { close: [-4, -2] }, text: '순간 조용해졌다. 다음 날 아침 복도에서 {fp|와} 눈이 마주쳤고, 둘 다 얼굴이 빨개졌다.' },
      { label: '모른 척 웃고 만다', effect: { happy: 1 }, text: '괜히 얼굴이 달아올랐다. 혼자 사는 밤이 유난히 길었다.' },
    ] },
  { id: 'nb_kid', type: 'random', on: ['block'], age: [19, 70], once: false, cooldown: 1,
    when: (s, a) => a.neighbors().some(p => p.hhRole === '아이' && a.npcAge(p) >= 4 && a.npcAge(p) <= 12),
    onStart: (s, a) => { const k = a.pick(a.neighbors().filter(p => p.hhRole === '아이' && a.npcAge(p) >= 4 && a.npcAge(p) <= 12)); const par = k && a.person((k.parents || [])[0]); a.focus(par || null); s.vars.nbUnit = k ? k.unit : ''; },
    text: '{nbUnit} 꼬마가 고개를 꾸벅 숙였다. "안녕하세요!" 뒤에서 {fp|이} 웃으며 목례했다.',
    choices: [
      { label: '사탕을 하나 건넨다', p: { close: [3, 5] }, effect: { happy: 3 }, text: '꼬마가 두 손으로 받았다. {fp|이} "인사해야지" 하자 한 번 더 꾸벅했다.' },
      { label: '손을 흔들어 준다', p: { close: [1, 3] }, effect: { happy: 2 }, text: '작은 손이 따라 흔들렸다. 하루가 조금 밝아졌다.' },
    ] },
  { id: 'nb_borrow', type: 'random', on: ['home'], age: [20, 70], once: false, cooldown: 1, when: both(s => !!s.flags.ownPlace, hasNb()), onStart: focusNb(),
    text: '초인종이 울렸다. {nbUnit} {fp|이} 멋쩍게 웃으며 서 있었다. "혹시 간장 조금만 빌릴 수 있을까요?"',
    choices: [
      { label: '빌려준다', p: { close: [3, 6], trust: [2, 4] }, text: '{fp|이} 다음 날 직접 만든 반찬을 들고 왔다.' },
      { label: '없다고 한다', text: '문을 닫고 나니 괜히 마음이 쓰였다.' },
    ] },
  { id: 'nb_married', type: 'random', on: ['block'], age: [20, 55], once: false, cooldown: 2,
    when: (s, a) => s.age >= 20 && nbAdult(a, p => p.married && p.gender !== s.gender && Math.abs(a.npcAge(p) - s.age) <= 15).length > 0,
    onStart: (s, a) => { const p = a.pick(nbAdult(a, q => q.married && q.gender !== s.gender && Math.abs(a.npcAge(q) - s.age) <= 15)); a.focus(p); s.vars.nbUnit = p ? p.unit : ''; },
    text: '분리수거장에서 {nbUnit} {fp|와} 또 마주쳤다. 먼저 웃으며 말을 걸어온다. 박스를 접는 왼손 약지에서 반지가 반짝였다.',
    choices: [
      { label: '가볍게 받아준다', p: { close: [3, 5], heart: [2, 4] }, text: '"요즘 자주 보네요." {fp|이} 웃었다. 돌아서는데 뒤통수가 따가웠다.' },
      { label: '배우자 안부를 묻는다', p: { close: [2, 3], trust: [2, 3] }, text: '"아, 그 사람은 출장 갔어요." 대답이 조금 늦었다.' },
      { label: '목례만 하고 간다', text: '선을 그었다. 그게 편했다.' },
    ] },
  { id: 'nb_rooftop', type: 'random', on: ['block'], age: [20, 50], once: false, cooldown: 2, season: ['여름', '가을'], when: both(homeIs('officetel', 'apt'), hasNb()),
    text: '옥상에서 입주민 바비큐 모임이 열렸다. 고기 굽는 냄새가 엘리베이터까지 내려왔다.',
    choices: [
      { label: '올라가 본다', effect: { happy: 4 }, do: (s, a) => nbAdult(a).sort(() => Math.random() - .5).slice(0, 3).forEach(p => a.changeP(p, { close: [3, 6] })),
        text: '맥주 한 캔을 받아 들고 이웃들 틈에 섞였다. 같은 건물에 이렇게 많은 사람이 살고 있었다.' },
      { label: '그냥 쉰다', text: '창문을 닫았다. 웃음소리가 희미하게 들렸다.' },
    ] },
);

/* ═════ 연인·배우자와 같이 있는 사람 (js/game.js talkTo·askNumber·coupleSpot이 부름) ═════
   {fp} 그 사람 · {mateName} 같이 있던 짝 · {mateWord} 남편·아내·남자친구·여자친구 */
const mate = (s, a) => a.person(s.vars.mateId);
const toMate = d => (s, a) => { const m = mate(s, a); if (m) a.changeP(m, d); };
E.push(
  { id: 'cp_talk', type: 'trigger', once: false, age: [20, 70],
    text: '말을 걸자 옆에 있던 {fp}의 {mateWord} {mateName|이} 나를 위아래로 훑어봤다.',
    choices: [
      { label: '둘 다에게 웃으며 인사한다', p: { close: [2, 4] }, do: toMate({ close: [3, 5] }), text: '{mateName|이} 그제야 경계를 풀고 웃었다. 셋이서 잠깐 이야기를 나눴다.' },
      { label: '그 사람에게만 말을 이어 간다', check: { stat: 'charm', diff: 70 },
        success: { p: { heart: [3, 6] }, do: toMate({ grudge: [5, 10] }), text: '{fp|이} 웃음을 참으며 대답했다. {mateName}의 눈빛이 따가웠다.' },
        fail: { p: { close: [-3, -2] }, do: toMate({ grudge: [8, 12] }), text: '"저희 바빠서요." {mateName|이} {fp}의 팔을 잡아끌었다.' } },
      { label: '실례했다며 물러난다', text: '"아, 일행이 있으셨구나." 꾸벅 인사하고 돌아섰다.' },
    ] },
  { id: 'cp_number', type: 'trigger', once: false, age: [20, 70],
    text: '{fp}에게 번호를 묻자 옆에 있던 {mateWord} {mateName|이} 끼어들었다. "누구세요?"',
    choices: [
      { label: '길을 물어보려던 거라고 둘러댄다', check: { stat: 'smart', diff: 60 },
        success: { p: { heart: [1, 3] }, text: '"아, 역은 저쪽이에요." {mateName|이} 친절하게 알려 줬다. {fp|이} 몰래 웃음을 삼켰다.' },
        fail: { p: { close: [-2, -1] }, text: '어색한 침묵. {mateName|이} {fp}의 손을 잡고 돌아섰다.' } },
      { label: '당당하게 친구 하자고 한다', check: { stat: 'charm', diff: 80 },
        success: { p: { close: [3, 5] }, do: (s, a) => { const p = a.focused(), m = mate(s, a); if (p) p.phone = true; if (m) { m.phone = true; a.changeP(m, { close: [3, 5] }); } }, text: '"뭐, 친구라면." 둘 다 번호를 알려 줬다. 📱' },
        fail: { p: { close: [-3, -2] }, do: toMate({ grudge: [6, 10] }), text: '"됐거든요." {mateName}의 한마디에 분위기가 싸늘해졌다.' } },
      { label: '죄송하다고 물러난다', text: '고개를 숙이고 물러났다. 얼굴이 화끈거렸다.' },
    ] },
  { id: 'cp_spot_secret', type: 'trigger', once: false, age: [20, 70],
    text: '{fp|이} {mateWord} {mateName|와} 함께 있었다. 눈이 마주치자 {fp}의 얼굴이 굳었다.',
    choices: [
      { label: '모르는 척 지나간다', p: { trust: [3, 5] }, text: '시선을 거뒀다. 등 뒤로 {fp}의 안도하는 숨소리가 들리는 것 같았다.' },
      { label: '태연하게 인사한다', check: { stat: 'charm', diff: 80 },
        success: { do: toMate({ close: [2, 4] }), text: '"아, 아는 사람이야." {fp|이} 자연스럽게 소개했다. {mateName}는 아무것도 눈치채지 못했다.' },
        fail: { p: { close: [-4, -2] }, do: toMate({ grudge: [5, 8] }), text: '{mateName}의 눈이 가늘어졌다. "둘이 어떻게 아는 사이야?" {fp|이} 진땀을 흘렸다.' } },
      { label: '몰래 눈짓을 보낸다', chance: .6,
        success: { p: { heart: [3, 5] }, text: '{fp|이} {mateName} 몰래 입꼬리를 올렸다. 잠시 뒤 휴대폰이 짧게 울렸다. "이따 연락할게."' },
        fail: { p: { close: [-4, -3], trust: [-3, -2] }, do: toMate({ grudge: [10, 14] }), text: '{mateName|이} 내 눈짓을 봤다. 공기가 얼어붙었다.' } },
    ] },
  { id: 'cp_spot_crush', type: 'trigger', once: false, age: [20, 70],
    text: '{fp|이} {mateWord} {mateName}의 팔짱을 끼고 걸어오다 나를 보고 멈칫했다.',
    choices: [
      { label: '반갑게 인사한다', p: { close: [2, 3] }, do: toMate({ close: [2, 3] }), text: '"어머, 여기서 보네요!" {fp|이} {mateName}에게 나를 소개했다. 말끝이 조금 들떠 있었다.' },
      { label: '가볍게 목례만 한다', p: { heart: [2, 3] }, text: '스쳐 지나가는 순간 {fp}의 시선이 한 번 더 나를 따라왔다.' },
      { label: '모른 척한다', p: { heart: [-3, -2], close: [-2, -1] }, text: '{fp}의 표정에 서운함이 스쳤다.' },
    ] },
  { id: 'cp_spot_friend', type: 'trigger', once: false, age: [20, 70],
    text: '{fp|이} {mateWord} {mateName|와} 같이 와 있었다. "인사해, 내 친구야."',
    choices: [
      { label: '같이 어울린다', p: { close: [2, 3] }, effect: { happy: 3 }, do: (s, a) => { const m = mate(s, a); if (m) { m.phone = true; a.changeP(m, { close: [5, 8] }); } },
        text: '셋이서 한참을 웃었다. {mateName|이} 다음에 집에 놀러 오라며 번호를 줬다.' },
      { label: '짧게 인사하고 자리를 비켜 준다', p: { trust: [2, 3] }, text: '둘만의 시간을 방해하지 않기로 했다.' },
    ] },
);

/* ═════ 장소 상호작용 (그 장소에 가거나 거기서 행동할 때) — 이벤트가 적던 곳 위주 ═════ */
const meetAt = (extra) => s => Object.assign({ kind: 'friend', ageRange: s.age < 19 ? [Math.max(4, s.age - 1), s.age + 1] : [Math.max(19, s.age - 8), s.age + 10], hangout: s.place, close: 15 }, extra || {});
E.push(
  // 시장
  { id: 'pl_marketHaggle', type: 'random', on: ['market'], age: [13, 70], once: false, cooldown: 1,
    text: '과일 가게 사장님이 귤 한 봉지를 내밀었다. "만 원인데, 학생/총각 얼굴 보고 팔천 원!"',
    choices: [
      { label: '웃으며 칠천 원에 흥정한다', check: { stat: 'charm', diff: 45 }, success: { effect: { happy: 3, money: -1 }, text: '"에이, 졌다 졌어." 사장님이 귤을 두 개 더 얹어 줬다.' }, fail: { effect: { money: -1 }, text: '"안 돼, 그럼 장사 접어." 그래도 웃으며 팔천 원에 샀다.' } },
      { label: '그냥 산다', effect: { money: -1, happy: 1 }, text: '귤이 달았다.' },
    ] },
  { id: 'pl_marketLost', type: 'random', on: ['market'], age: [16, 70], once: false, cooldown: 2,
    text: '시장 골목에서 꼬마가 울고 있었다. 엄마를 잃어버린 모양이다.',
    choices: [
      { label: '같이 엄마를 찾아 준다', karma: [3, 5], effect: { happy: 3 }, meet: s => ({ kind: 'friend', gender: 'f', ageRange: [28, 44], married: true, close: 22 }), text: '생선 가게 앞에서 엄마를 찾았다. {new|이} 연신 고개를 숙였다. "정말 감사해요."' },
      { label: '상인회 사무실에 데려다준다', karma: [1, 2], text: '안내 방송이 나가고 금방 엄마가 달려왔다.' },
    ] },
  { id: 'pl_marketTaste', type: 'random', on: ['market', 'snack'], age: [6, 80], once: false, cooldown: 1,
    text: '전집 할머니가 갓 부친 동그랑땡을 하나 집어 입에 넣어 줬다. "맛보고 가."', effect: { happy: 3 } },
  // 부동산
  { id: 'pl_realtyTour', type: 'random', on: ['realty'], age: [19, 70], once: false, cooldown: 1,
    text: '중개사가 "마침 좋은 매물이 하나 나왔는데" 하며 휴대폰 사진을 넘겼다. 창밖이 탁 트인 방이었다.',
    choices: [
      { label: '직접 보러 간다', effect: { happy: 2 }, text: '사진보다 좁았다. 그래도 해 드는 창이 마음에 남았다.' },
      { label: '"사진은 원래 넓게 나오잖아요"', effect: { smart: [0, 1] }, text: '중개사가 웃으며 휴대폰을 집어넣었다. "눈이 밝으시네."' },
    ] },
  { id: 'pl_realtyCouple', type: 'random', on: ['realty'], age: [20, 60], once: false, cooldown: 2,
    text: '옆자리에서 신혼부부가 전세 계약서를 앞에 두고 소곤소곤 다투고 있었다. "역세권이 먼저라니까." "아니, 방이 하나 더 있어야지."',
    choices: [
      { label: '못 들은 척한다', text: '중개사와 눈이 마주쳤다. 둘 다 웃음을 참았다.' },
      { label: '"둘 다 맞는 말 같은데요"', check: { stat: 'charm', diff: 50 },
        success: { meet: s => ({ kind: 'friend', ageRange: [Math.max(24, s.age - 5), s.age + 8], married: true, close: 18 }), effect: { happy: 2 }, text: '둘이 동시에 웃음을 터뜨렸다. {new|이} "같은 동네 사시면 놀러 오세요" 하며 번호를 줬다.' },
        fail: { text: '두 사람이 동시에 나를 쳐다봤다. 조용히 내 서류로 눈을 돌렸다.' } },
    ] },
  // 터미널
  { id: 'pl_stationBye', type: 'random', on: ['station'], age: [16, 80], once: false, cooldown: 1,
    text: '개찰구 앞에서 연인이 한참을 끌어안고 있었다. 버스 시동 소리가 들리자 한 사람만 올라탔다.', effect: { happy: -1 } },
  { id: 'pl_stationSeat', type: 'random', on: ['station', 'travel'], age: [19, 70], once: false, cooldown: 1,
    text: '옆자리 사람이 내 어깨에 기대어 잠들었다. 깨울까 말까.',
    choices: [
      { label: '내릴 때까지 그대로 둔다', karma: [1, 2], meet: s => ({ kind: 'friend', ageRange: [Math.max(19, s.age - 6), s.age + 8], close: 16, heart: 6 }), text: '도착 안내 방송에 {new|이} 화들짝 깼다. "어머, 죄송해요…" 얼굴이 빨개진 채 번호를 물어 왔다. 사과의 커피를 사겠다고.' },
      { label: '살짝 어깨를 빼낸다', text: '그 사람은 창 쪽으로 고개를 돌려 다시 잠들었다.' },
    ] },
  { id: 'pl_stationLost', type: 'random', on: ['station'], age: [16, 70], once: false, cooldown: 2,
    text: '외국인 관광객이 지도를 들고 두리번거리고 있었다.',
    choices: [
      { label: '먼저 도와준다', check: { stat: 'smart', diff: 50 }, success: { karma: [1, 2], effect: { happy: 3 }, text: '손짓 발짓으로 길을 알려 줬다. 관광객이 엄지를 들어 보였다.' }, fail: { effect: { happy: 1 }, text: '서로 웃기만 하다가 결국 번역 앱을 켰다.' } },
      { label: '못 본 척 지나간다', text: '발걸음이 조금 무거웠다.' },
    ] },
  // 학교·학원 (중·고등학생)
  { id: 'pl_schoolLetter', type: 'random', on: ['school'], age: [14, 18], once: false, cooldown: 1,
    text: '책상 서랍에 접힌 쪽지가 들어 있었다. "매점 같이 갈래?" 이름은 없었다.',
    choices: [
      { label: '매점 앞에서 기다린다', meet: s => ({ kind: 'classmate', ageRange: [s.age, s.age], close: 22 }), effect: { happy: 3 }, text: '쭈뼛거리며 다가온 건 {new}였다. 빵 하나를 나눠 먹었다.' },
      { label: '장난이겠거니 한다', text: '쪽지를 필통에 넣었다. 왠지 버리지는 못했다.' },
    ] },
  { id: 'pl_schoolRain', type: 'random', on: ['school'], age: [13, 18], once: false, cooldown: 1, when: s => ['rain', 'storm'].includes(s.weather),
    text: '하교 시간에 비가 쏟아졌다. 우산이 없다.',
    choices: [
      { label: '친구 우산을 같이 쓴다', effect: { happy: 2 }, text: '어깨 한쪽이 다 젖었지만 웃으며 걸었다.' },
      { label: '뛰어간다', effect: { health: -1, happy: 1 }, text: '흠뻑 젖었다. 이상하게 신났다.' },
    ] },
  { id: 'pl_academyNight', type: 'random', on: ['academy', 'cram'], age: [13, 18], once: false, cooldown: 1,
    text: '밤 10시, 학원 건물 앞 편의점에 같은 반 애들이 모여 컵라면을 먹고 있었다.',
    choices: [
      { label: '끼어서 같이 먹는다', effect: { happy: 3, money: -1 }, text: '"야 국물 남겨." 하루의 피로가 라면 국물에 풀렸다.' },
      { label: '바로 집에 간다', effect: { health: 1 }, text: '버스 창에 머리를 기대고 졸았다.' },
    ] },
  // 직장
  { id: 'pl_officeElevator', type: 'random', on: ['office', 'work'], age: [20, 62], once: false, cooldown: 1,
    text: '엘리베이터에 사장님과 단둘이 탔다. 사장님이 먼저 물었다. "요즘 일은 할 만해요?"',
    choices: [
      { label: '아이디어를 하나 꺼낸다', check: { stat: 'smart', diff: 70 }, success: { do: (s, a) => a.perf(4), effect: { happy: 3 }, text: '"오, 그거 다음 회의 때 얘기해 봐요." 내 이름을 기억하는 눈치였다.' }, fail: { effect: { happy: -1 }, text: '말이 꼬였다. 사장님이 "아, 네네" 하며 휴대폰을 봤다.' } },
      { label: '"네, 덕분에요"', text: '무난했다. 문이 열리자 둘 다 안도했다.' },
    ] },
  { id: 'pl_officeSnack', type: 'random', on: ['office'], age: [20, 62], once: false, cooldown: 1,
    text: '탕비실에서 누가 몰래 숨겨 둔 고급 초콜릿을 발견했다.',
    choices: [
      { label: '하나만 먹는다', karma: [-1, 0], effect: { happy: 2 }, text: '달았다. 오후 회의 내내 범인처럼 굴었다.' },
      { label: '"주인 찾아요" 메모를 붙인다', karma: [1, 1], text: '다음 날 초콜릿 옆에 "드셔도 돼요 :)" 메모가 붙어 있었다.' },
    ] },
  // 장소 행동
  { id: 'pl_artPrac', type: 'random', on: ['artPrac'], age: [10, 80], once: false, cooldown: 1,
    text: '그리던 그림 위에 커피를 엎질렀다. 번진 얼룩이 묘하게 노을 같았다.',
    choices: [
      { label: '얼룩을 살려 완성한다', check: { stat: 'art', diff: 60 }, success: { effect: { art: [2, 3], happy: 4 }, text: '실수가 그림의 한가운데가 됐다. 지금까지 그린 것 중 제일 마음에 들었다.' }, fail: { effect: { happy: -1 }, text: '살려 보려다 더 엉망이 됐다. 새 종이를 꺼냈다.' } },
      { label: '처음부터 다시 그린다', effect: { art: [1, 1] }, text: '두 번째가 조금 더 나았다.' },
    ] },
  { id: 'pl_make', type: 'random', on: ['make'], age: [10, 80], once: false, cooldown: 1,
    text: '고치던 라디오에서 갑자기 옛날 노래가 흘러나왔다.', effect: { craft: [1, 2], happy: 3 } },
  { id: 'pl_style', type: 'random', on: ['style', 'shop'], age: [15, 60], once: false, cooldown: 1,
    text: '미용사가 거울 너머로 물었다. "오늘은 좀 과감하게 가 볼까요?"',
    choices: [
      { label: '맡긴다', chance: .6, success: { effect: { style: [4, 6], happy: 4 }, text: '거울 속 내가 낯설 만큼 잘 어울렸다.' }, fail: { effect: { style: [-2, 0], happy: -3 }, text: '…석 달은 모자를 써야겠다.' } },
      { label: '늘 하던 대로', effect: { style: [1, 2] }, text: '익숙한 얼굴이 거울에서 웃고 있었다.' },
    ] },
  { id: 'pl_game', type: 'random', on: ['game', 'pcbang'], age: [12, 50], once: false, cooldown: 1,
    text: '옆자리 사람과 같은 게임을 하고 있었다. 화면을 힐끗 보더니 "한 판 같이 할래요?" 했다.',
    choices: [
      { label: '같이 한다', meet: meetAt({ close: 20 }), effect: { happy: 4 }, text: '{new|와} 손발이 척척 맞았다. 세 판을 내리 이겼다.' },
      { label: '혼자 하던 걸 마저 한다', text: '헤드셋을 고쳐 썼다.' },
    ] },
  { id: 'pl_parttime', type: 'random', on: ['parttime'], age: [16, 40], once: false, cooldown: 1,
    text: '손님이 계산대에 커피 한 잔을 두고 갔다. 메모가 붙어 있었다. "늘 친절하셔서요."', effect: { happy: 4 } },
  { id: 'pl_donate', type: 'random', on: ['donate', 'volunteer'], age: [16, 80], once: false, cooldown: 2,
    text: '봉사 끝나고 아이 하나가 삐뚤빼뚤한 글씨의 편지를 건넸다. "다음 주에도 와요?"', karma: [1, 2], effect: { happy: 5 } },
);

/* ═════ 일반 대화 장면 (관계 창·장소에서 '대화' — data/dialogues.js와 같은 형식) ═════ */
const DL = GAME_DATA.dialogues;
DL.push(
  { id: 't2_market', kind: 'talk', when: { place: ['market'] },
    text: '{p|이} 떡볶이 포장마차 앞에서 멈췄다. "여기 진짜 맛있는 집이야. 먹고 갈래?"',
    choices: [ { t: '"좋아. 대신 순대도 시키자."', tone: 'warm' }, { t: '"맛집 감별사셨구나?"', tone: 'tease' }, { t: '"여기 단골이야? 언제부터?"', tone: 'ask' }, { t: '"배 안 고픈데."', tone: 'cool' } ] },
  { id: 't2_block', kind: 'talk', when: { place: ['block'] },
    text: '{p|이} 분리수거 봉투를 내려놓으며 말했다. "이 동네 산 지 얼마나 됐어요?"',
    choices: [ { t: '"얼마 안 됐어요. 좋은 데 있으면 알려 주세요."', tone: 'warm' }, { t: '"택배 기사님보다는 늦게 왔죠."', tone: 'joke' }, { t: '"오래 사셨어요? 이 동네 어때요?"', tone: 'ask' }, { t: '"글쎄요."', tone: 'cool' } ] },
  { id: 't2_neighborKid', kind: 'talk', when: { place: ['block'], if: (s, p) => p.hhRole === '아내' || p.hhRole === '남편' },
    text: '{p|이} 한숨을 쉬었다. "애 재우고 나오니까 이제야 숨 좀 쉬네요."',
    choices: [ { t: '"고생 많으세요. 잠깐이라도 쉬세요."', tone: 'warm' }, { t: '"아이가 몇 살이에요?"', tone: 'ask' }, { t: '"육아는 전쟁이라던데, 지금 휴전 중이시네요."', tone: 'joke' }, { t: '"힘들면 저한테 하소연하셔도 돼요."', tone: 'listen' } ] },
  { id: 't2_church', kind: 'talk', when: { place: ['church'] },
    text: '{p|이} 조용히 물었다. "기도할 때 뭘 빌어요?"',
    choices: [ { t: '"가족 건강. 그거면 돼요."', tone: 'warm' }, { t: '"솔직히 로또요."', tone: 'joke' }, { t: '"…요즘 마음이 좀 복잡해서요."', tone: 'deep' }, { t: '"딱히 없어요."', tone: 'cool' } ] },
  { id: 't2_hospital', kind: 'talk', when: { place: ['hospital'] },
    text: '{p|이} 번호표를 만지작거렸다. "병원 오면 괜히 겁나지 않아요?"',
    choices: [ { t: '"괜찮을 거예요. 같이 기다려 줄게요."', tone: 'warm' }, { t: '"주사 맞을 때 눈 감으면 안 아파요. 진짜로."', tone: 'joke' }, { t: '"어디가 안 좋으세요?"', tone: 'ask' }, { t: '"검사 결과는 숫자일 뿐이에요."', tone: 'smart' } ] },
  { id: 't2_station', kind: 'talk', when: { place: ['station'] },
    text: '{p|이} 전광판을 올려다봤다. "어디로든 떠나고 싶을 때 있지 않아요?"',
    choices: [ { t: '"지금 같이 아무 표나 끊을까요?"', tone: 'bold' }, { t: '"매일요. 월요일 아침마다."', tone: 'joke' }, { t: '"어디 가고 싶은데요?"', tone: 'ask' }, { t: '"…떠나고 싶은 이유가 있어요?"', tone: 'deep' } ] },
  { id: 't2_pcbang', kind: 'talk', when: { place: ['pcbang'] },
    text: '{p|이} 헤드셋을 벗으며 말했다. "아, 방금 그 판 진짜 억울하다."',
    choices: [ { t: '"다시 한 판 해. 내가 옆에서 봐 줄게."', tone: 'warm' }, { t: '"억울한 게 아니라 실력이…"', tone: 'tease' }, { t: '"뭐가 문제였는데?"', tone: 'ask' }, { t: '"난 방금 이겼는데."', tone: 'brag' } ] },
  { id: 't2_gym2', kind: 'talk', when: { place: ['gym'] },
    text: '{p|이} 물을 마시며 내 쪽을 봤다. "자세 엄청 좋으시네요. 운동 오래 하셨어요?"',
    choices: [ { t: '"아직 배우는 중이에요. 팁 있으면 알려 주세요."', tone: 'warm' }, { t: '"거울 보면서 연습만 오래 했죠."', tone: 'joke' }, { t: '"꽤 됐죠. 같이 루틴 짜 볼래요?"', tone: 'brag' }, { t: '"그쪽은요?"', tone: 'ask' } ] },
  { id: 't2_money', kind: 'talk', when: { adult: true, stage: ['friend', 'close'] },
    text: '{p|이} 통장 앱을 보다가 한숨을 쉬었다. "이번 달도 월세 내니까 끝이네."',
    choices: [ { t: '"오늘 저녁은 내가 살게."', tone: 'warm' }, { t: '"통장도 다이어트 중인가 봐."', tone: 'joke' }, { t: '"가계부 같이 써 볼래? 생각보다 새는 데가 많아."', tone: 'smart' }, { t: '"무슨 일 있어? 얘기해 봐."', tone: 'listen' } ] },
  { id: 't2_work', kind: 'talk', when: { adult: true, if: (s, p) => !!p.npcJob && p.npcJob !== '퇴직자' },
    text: '{p|이} 어깨를 주물렀다. "오늘 상사한테 또 깨졌어."',
    choices: [ { t: '"고생했다. 맛있는 거 먹으러 가자."', tone: 'warm' }, { t: '"그 상사 나한테 소개해 줘. 내가 혼내 줄게."', tone: 'joke' }, { t: '"무슨 일이었는데? 다 말해 봐."', tone: 'listen' }, { t: '"다들 그렇게 살아."', tone: 'cool' } ] },
  { id: 't2_dream', kind: 'talk', when: { stage: ['friend', 'close', 'lover'] },
    text: '{p|이} 하늘을 보며 물었다. "너는 10년 뒤에 뭐 하고 있을 것 같아?"',
    choices: [ { t: '"지금처럼 너랑 이러고 있겠지."', tone: 'shy' }, { t: '"억만장자. 아직 방법은 모름."', tone: 'joke' }, { t: '"…솔직히 무서워. 아무것도 안 돼 있을까 봐."', tone: 'deep' }, { t: '"너는?"', tone: 'ask' } ] },
  { id: 't2_family', kind: 'talk', when: { stage: ['friend', 'close', 'lover'], adult: true },
    text: '{p|이} 휴대폰을 내려놓았다. "엄마 전화였어. 언제 결혼하냐고."',
    choices: [ { t: '"부모님 마음은 다 같은가 봐. 우리 엄마도 그래."', tone: 'warm' }, { t: '"그럼 나랑 할래?"', tone: 'tease' }, { t: '"넌 결혼 생각 있어?"', tone: 'ask' }, { t: '"때 되면 하는 거지."', tone: 'cool' } ] },
  { id: 't2_taken', kind: 'talk', when: { adult: true, taken: true, stage: ['acq', 'friend', 'close'] },
    text: '{p|이} 휴대폰 화면을 엎어 놓았다. "애인이랑 좀 싸웠어. 요즘 자주 그래."',
    choices: [ { t: '"속상했겠다. 얘기하고 싶으면 해."', tone: 'listen' }, { t: '"싸우는 것도 사랑이래. 그렇다더라."', tone: 'joke' }, { t: '"…나라면 너 속상하게 안 할 텐데."', tone: 'bold' }, { t: '"화해할 거잖아. 걱정 마."', tone: 'warm' } ] },
  { id: 't2_married', kind: 'talk', when: { adult: true, married: true, stage: ['acq', 'friend', 'close'] },
    text: '{p|이} 반지를 만지작거렸다. "결혼하면 다 좋을 줄 알았는데, 요즘은 대화가 없어."',
    choices: [ { t: '"그래도 서로 노력하면 나아질 거야."', tone: 'warm' }, { t: '"대화가 고프면 나랑 하면 되지."', tone: 'tease' }, { t: '"언제부터 그랬는데?"', tone: 'listen' }, { t: '"그건 둘이 풀 문제 같아."', tone: 'cool' } ] },
  { id: 't2_number', kind: 'talk', when: { stage: ['new', 'acq'], if: (s, p) => p.phone === true && (p.close || 0) < 30 },
    text: '{p|이} 웃으며 휴대폰을 흔들었다. "번호 받고 연락 안 하는 사람 많던데, 그쪽은 아니죠?"',
    choices: [ { t: '"오늘 저녁에 바로 연락할게요."', tone: 'warm' }, { t: '"답장 빠른 걸로 유명해요. 3일 걸려서."', tone: 'joke' }, { t: '"먼저 연락해 줘도 되는데요?"', tone: 'tease' }, { t: '"글쎄요."', tone: 'cool' } ] },
  { id: 't2_night', kind: 'talk', when: { night: true, adult: true },
    text: '{p|이} 가로등 아래서 걸음을 늦췄다. "밤공기 좋다. 그치?"',
    choices: [ { t: '"좀 더 걷다 갈까?"', tone: 'shy' }, { t: '"밤공기는 좋은데 모기가 너무 좋아해."', tone: 'joke' }, { t: '"이런 밤엔 무슨 생각 해?"', tone: 'deep' }, { t: '"추운데."', tone: 'cool' } ] },
  { id: 't2_center', kind: 'talk', when: { place: ['center'] },
    text: '{p|이} 박스를 내려놓으며 땀을 닦았다. "봉사하면 오히려 내가 위로받는 것 같아요."',
    choices: [ { t: '"맞아요. 저도 그래서 와요."', tone: 'warm' }, { t: '"근육도 덤으로 받고요."', tone: 'joke' }, { t: '"언제부터 오셨어요?"', tone: 'ask' }, { t: '"…요즘 위로가 필요하셨어요?"', tone: 'deep' } ] },
  { id: 't2_realty', kind: 'talk', when: { place: ['realty'] },
    text: '{p|이} 매물 전단을 같이 들여다봤다. "요즘 집값 진짜 말이 안 되지 않아요?"',
    choices: [ { t: '"그러니까요. 같이 한숨 쉬어요."', tone: 'warm' }, { t: '"제 꿈은 원룸 탈출입니다."', tone: 'joke' }, { t: '"어떤 집 찾으세요?"', tone: 'ask' }, { t: '"대출 금리부터 보세요."', tone: 'smart' } ] },
);

/* ═════ 부동산 사고 (js/game.js homeMonthly — 전세가율 80%가 넘는 집에 보증보험 없이 살면 가끔) ═════ */
E.push(
  { id: 'jeonseFraud', type: 'trigger', once: false, age: [19, 90],
    onStart: (s, a) => { s.vars.dep = a.money(a.homeDep()); },
    text: '등기우편이 왔다. 살고 있는 집이 경매로 넘어간다고 한다. 집주인은 연락이 끊겼다. 전세 보증금 {dep}이 묶였다.',
    choices: [
      { label: '변호사를 사서 끝까지 싸운다', chance: .35,
        success: { effect: { money: -150, happy: -6 }, do: (s, a) => a.loseHome(.6), memory: true, text: '1년을 싸운 끝에 보증금의 절반 남짓을 돌려받았다. 짐을 싸서 나왔다.' },
        fail: { effect: { money: -150, happy: -12 }, do: (s, a) => a.loseHome(.1), memory: true, text: '변호사비만 나갔다. 경매 낙찰금에서 쥐꼬리만큼 돌려받았다.' } },
      { label: '포기하고 짐을 싼다', effect: { happy: -10 }, do: (s, a) => a.loseHome(.2), memory: true, text: '몇 년 모은 돈이 사라졌다. 다음엔 등기부부터 떼 보기로 했다.' },
    ] },
);

/* ═════ 대학 캠퍼스 (정문·강의실·학생식당·중앙도서관·동아리방·잔디밭·학생회관 — data/places.js campus) ═════ */
const uni = s => !!s.flags.student;
const peerU = s => [Math.max(19, s.age - 2), s.age + 3];
const classmateHere = (s, a) => a.here().filter(p => p.kind === 'classmate' && a.npcAge(p) >= 19);
E.push(
  // 정문
  { id: 'uc_gateFlyer', type: 'random', on: ['campus'], age: [19, 30], once: false, cooldown: 1, when: s => uni(s) && s.place === 'campus',
    text: '정문 앞에서 동아리 홍보 전단을 나눠 주던 선배가 앞을 막아섰다. "잠깐만! 우리 동아리 구경만 하고 가!"',
    choices: [
      { label: '따라가 본다', meet: s => ({ kind: 'classmate', ageRange: [s.age + 1, s.age + 3], close: 20, rtag: '동아리 사람' }), effect: { happy: 3 }, text: '동아리방에서 {new|이} 과자를 한 아름 안겨 줬다. 반쯤 넘어간 것 같다.' },
      { label: '"다음에요" 하고 지나간다', text: '전단만 한 장 받아 들었다.' },
    ] },
  { id: 'uc_gateConfess', type: 'random', on: ['campus'], age: [19, 30], once: false, cooldown: 2, when: s => uni(s) && s.place === 'campus',
    text: '정문 앞에 꽃다발을 든 사람이 서 있었다. 누군가를 기다리는 모양이다. 구경꾼이 하나둘 모였다.',
    choices: [
      { label: '같이 지켜본다', chance: .6, success: { effect: { happy: 4 }, text: '나타난 사람이 꽃다발을 받아 들었다. 박수가 터졌다. 괜히 나까지 설렜다.' }, fail: { effect: { happy: -1 }, text: '기다리던 사람은 고개를 저으며 지나갔다. 꽃다발이 축 처졌다.' } },
      { label: '갈 길 간다', text: '뒤에서 함성이 들렸다. 좋은 결말이었나 보다.' },
    ] },
  // 강의실
  { id: 'uc_lecNote', type: 'random', on: ['lecture'], age: [19, 30], once: false, cooldown: 1, when: uni,
    text: '깜빡 졸다 깼다. 칠판이 이미 반쯤 지워져 있었다. 옆자리 사람이 말없이 노트를 밀어 줬다.',
    choices: [
      { label: '고맙다며 커피를 산다', effect: { money: -1, smart: [1, 1] }, meet: s => ({ kind: 'classmate', ageRange: peerU(s), close: 22 }), text: '{new|이} 웃었다. "다음엔 네가 필기해."' },
      { label: '사진만 찍고 돌려준다', effect: { smart: [0, 1] }, text: '고개만 까딱하고 노트를 돌려줬다.' },
    ] },
  { id: 'uc_lecQuestion', type: 'random', on: ['lecture'], age: [19, 30], once: false, cooldown: 1, when: uni,
    text: '교수님이 강의실을 둘러보다 나와 눈이 마주쳤다. "거기, 이 문제 어떻게 생각해요?"',
    choices: [
      { label: '자신 있게 대답한다', check: { stat: 'smart', diff: 70 }, success: { do: (s, a) => { s.school.studyYear += .03; }, effect: { happy: 4, charm: [0, 1] }, text: '"좋네요." 교수님이 고개를 끄덕였다. 뒤에서 누가 "오…" 했다.' }, fail: { effect: { happy: -3 }, text: '말이 엉켰다. 교수님이 "조금 더 생각해 봐요" 하고 넘어갔다. 귀가 뜨거웠다.' } },
      { label: '"잘 모르겠습니다"', text: '솔직한 대답에 교수님이 웃었다. 다음 사람에게 질문이 넘어갔다.' },
    ] },
  { id: 'uc_lecAttend', type: 'random', on: ['lecture', 'campus'], age: [19, 30], once: false, cooldown: 1, when: (s, a) => uni(s) && classmateHere(s, a).length > 0, onStart: (s, a) => a.focus(a.pick(classmateHere(s, a))),
    text: '{fp|이} 다급하게 문자를 보냈다. "나 오늘 늦잠… 출석 좀 대신 불러 줄 수 있어?"',
    choices: [
      { label: '대신 대답해 준다', chance: .7, karma: [-1, 0], success: { p: { close: [4, 6] }, text: '목소리를 깔고 "네!" 했다. 무사히 넘어갔다. {fp|이} 밥을 사겠다고 했다.' }, fail: { p: { close: [1, 2] }, effect: { happy: -3 }, text: '"방금 그 목소리 누구예요?" 교수님이 나를 쳐다봤다. 둘 다 결석 처리됐다.' } },
      { label: '거절한다', p: { close: [-2, -1] }, text: '"미안, 그건 좀." 답장이 늦게 왔다. "ㅇㅋ…"' },
    ] },
  { id: 'uc_lecTeam', type: 'random', on: ['lecture', 'study'], age: [19, 30], once: false, cooldown: 1, when: uni,
    text: '조별 과제 단톡방에 내가 맡은 부분만 올라와 있다. 발표는 내일이다.',
    choices: [
      { label: '밤새 혼자 다 한다', effect: { smart: [1, 2], health: -2, happy: -2 }, text: '새벽 4시에 파일을 올렸다. "와 고마워!!" 메시지가 줄줄이 달렸다.' },
      { label: '단톡방에 공개적으로 독촉한다', check: { stat: 'charm', diff: 55 }, success: { effect: { happy: 2 }, text: '"죄송해요 지금 할게요!" 다들 움직이기 시작했다.' }, fail: { effect: { happy: -2 }, text: '읽음 표시만 늘었다. 결국 혼자 반을 했다.' } },
    ] },
  // 학생식당
  { id: 'uc_cafSeat', type: 'random', on: ['cafeteria', 'cafMeal'], age: [19, 30], once: false, cooldown: 1, when: uni,
    text: '식판을 들고 두리번거리는데 빈자리가 하나뿐이다. 앞자리엔 혼자 밥 먹는 사람이 있었다.',
    choices: [
      { label: '"여기 앉아도 돼요?"', meet: s => ({ kind: 'classmate', ageRange: peerU(s), close: 16 }), effect: { happy: 2 }, text: '{new|이} 고개를 끄덕였다. 같은 수업을 듣는다는 걸 알게 됐다.' },
      { label: '식판을 들고 밖으로 나간다', text: '잔디밭 벤치에서 먹었다. 바람이 좋았다.' },
    ] },
  { id: 'uc_cafSenior', type: 'random', on: ['cafeteria'], age: [19, 24], once: false, cooldown: 1, when: uni,
    text: '줄을 서 있는데 과 선배가 어깨를 툭 쳤다. "밥 먹었어? 내가 살게."',
    choices: [
      { label: '"감사합니다!"', meet: s => ({ kind: 'classmate', ageRange: [s.age + 1, s.age + 4], close: 24, rtag: '선후배' }), effect: { happy: 3 }, text: '{new|이} 돈가스를 사 주며 족보를 넘겨줬다. 대학 생활 꿀팁도 덤으로.' },
      { label: '"제가 낼게요"', effect: { money: -1, charm: [0, 1] }, text: '선배가 웃었다. "너 마음에 든다."' },
    ] },
  // 중앙도서관
  { id: 'uc_libNote', type: 'random', on: ['ulib'], age: [19, 30], once: false, cooldown: 2, when: uni,
    text: '잠깐 자리를 비운 사이 책상에 포스트잇이 붙어 있었다. "열심히 하시네요. 커피 한잔할래요? 3층 자판기 앞"',
    choices: [
      { label: '3층으로 가 본다', meet: s => ({ kind: 'classmate', gender: s.gender === 'm' ? 'f' : 'm', ageRange: peerU(s), close: 14, heart: 12 }), effect: { happy: 4 }, text: '자판기 앞에서 {new|이} 커피 두 잔을 들고 멋쩍게 웃고 있었다.' },
      { label: '포스트잇만 챙겨 둔다', effect: { happy: 1 }, text: '공부가 손에 안 잡혔다.' },
    ] },
  { id: 'uc_libDawn', type: 'random', on: ['ulib', 'study'], age: [19, 30], once: false, cooldown: 1, when: s => uni(s) && s.age < 28,
    text: '시험 기간 밤샘. 창밖이 파랗게 밝아 왔다. 열람실에 남은 건 나와 몇 사람뿐이다.', effect: { smart: [1, 2], health: -1 } },
  // 동아리방
  { id: 'uc_clubShow', type: 'random', on: ['clubroom', 'uclub'], age: [19, 30], once: false, cooldown: 1, when: uni,
    text: '정기 공연이 일주일 남았다. 회장이 무대 한가운데 자리를 맡아 보겠냐고 물었다.',
    choices: [
      { label: '해 본다', check: { stat: 'art', diff: 70 }, success: { memory: true, effect: { art: [2, 3], happy: 8, charm: [1, 2] }, text: '조명 아래 서자 다리가 떨렸다. 마지막 곡이 끝나자 함성이 쏟아졌다.' }, fail: { effect: { happy: -3 }, text: '중간에 박자를 놓쳤다. 그래도 다들 끝까지 박수를 쳐 줬다.' } },
      { label: '뒤에서 돕겠다고 한다', effect: { craft: [1, 2], happy: 2 }, text: '조명과 음향을 맡았다. 무대 뒤에서 본 공연도 꽤 멋있었다.' },
    ] },
  { id: 'uc_clubMT', type: 'random', on: ['clubroom'], age: [19, 30], once: false, cooldown: 1, when: uni,
    text: '동아리 MT 장소를 두고 투표가 열렸다. 바다냐, 계곡이냐.',
    choices: [
      { label: '바다!', effect: { happy: 4, money: -5 }, text: '밤바다에서 폭죽을 터뜨렸다. 동아리 사람들과 한결 가까워졌다.' },
      { label: '계곡!', effect: { happy: 4, money: -4, health: 1 }, text: '수박을 계곡물에 담가 놓고 물놀이를 했다. 다들 새카맣게 탔다.' },
      { label: '이번엔 빠진다', text: '단톡방에 사진이 쏟아졌다. 조금 아쉬웠다.' },
    ] },
  { id: 'uc_clubAfter', type: 'random', on: ['clubroom'], age: [20, 30], once: false, cooldown: 1, when: (s, a) => uni(s) && a.clubMates().some(p => p.gender !== s.gender && a.npcAge(p) >= 20),
    onStart: (s, a) => a.focus(a.pick(a.clubMates().filter(p => p.gender !== s.gender && a.npcAge(p) >= 20))),
    text: '뒤풀이가 끝나고 {fp|와} 둘만 동아리방에 남았다. 정리하던 손이 자꾸 부딪혔다.',
    choices: [
      { label: '"우리 둘이 한잔 더 할래?"', check: { stat: 'charm', diff: 65 }, success: { p: { close: [4, 6], heart: [5, 8] }, text: '{fp|이} 잠깐 망설이다 가방을 다시 내려놓았다. "…한 잔만."' }, fail: { p: { close: [1, 2] }, text: '"오늘은 피곤해서. 다음에!" {fp|이} 웃으며 먼저 나갔다.' } },
      { label: '불 끄고 같이 나간다', p: { close: [2, 4] }, text: '가로등 아래까지 같이 걸었다. 별말 없었는데 이상하게 좋았다.' },
    ] },
  // 잔디밭
  { id: 'uc_quadDelivery', type: 'random', on: ['quad'], age: [19, 30], once: false, cooldown: 1, when: uni,
    text: '잔디밭에 둘러앉은 과 사람들이 짜장면을 시키려다 나를 불렀다. "같이 먹자!"',
    choices: [
      { label: '끼어 앉는다', effect: { happy: 4, money: -1 }, do: (s, a) => a.here().filter(p => p.kind === 'classmate').slice(0, 3).forEach(p => a.changeP(p, { close: [2, 4] })), text: '단무지를 두고 가위바위보를 했다. 별것 아닌데 배가 아프게 웃었다.' },
      { label: '수업 있다고 한다', text: '뒤에서 "다음엔 꼭 와!" 소리가 들렸다.' },
    ] },
  { id: 'uc_quadFest', type: 'random', on: ['quad', 'campus'], age: [19, 30], season: ['봄', '가을'], once: false, cooldown: 1, when: uni,
    text: '대학 축제다. 잔디밭에 과 주점 천막이 줄지어 섰고, 무대에서는 초대 가수 리허설 소리가 들렸다.',
    choices: [
      { label: '과 주점에서 일손을 돕는다', effect: { happy: 5, charm: [1, 2], health: -1 }, text: '파전을 백 장쯤 부쳤다. 새벽까지 웃고 떠들었다.' },
      { label: '무대 앞자리를 맡는다', memory: true, effect: { happy: 7 }, text: '떼창이 캠퍼스를 흔들었다. 스무 살의 밤이 이렇게 지나갔다.' },
      { label: '시끄러워서 집에 간다', effect: { health: 1 }, text: '멀리서 들리는 노랫소리를 들으며 잠들었다.' },
    ] },
  // 학생회관
  { id: 'uc_unionVote', type: 'random', on: ['union'], age: [19, 30], once: false, cooldown: 2, when: uni,
    text: '학생회 선거 유세가 한창이다. 후보 한 명이 내 손을 덥석 잡았다. "기호 1번, 꼭 부탁드립니다!"',
    choices: [
      { label: '공약을 물어본다', effect: { smart: [0, 1] }, meet: s => ({ kind: 'classmate', ageRange: [s.age, s.age + 3], close: 15 }), text: '{new|이} 공약집을 펼쳐 열변을 토했다. 의외로 설득당했다.' },
      { label: '웃으며 지나간다', text: '손에 사탕 하나가 쥐어져 있었다.' },
    ] },
  { id: 'uc_unionLost', type: 'random', on: ['union'], age: [19, 30], once: false, cooldown: 2, when: uni,
    text: '학생회관 분실물 센터에서 잃어버린 줄 알았던 내 이어폰을 찾았다. 케이스에 "주인 찾아요" 쪽지와 번호가 붙어 있었다.',
    choices: [
      { label: '고맙다고 문자를 보낸다', meet: s => ({ kind: 'classmate', ageRange: peerU(s), close: 14 }), effect: { happy: 3 }, text: '{new}에게서 답장이 왔다. "다행이네요! 다음엔 흘리지 마요 :)"' },
      { label: '그냥 챙겨 간다', effect: { happy: 2 }, text: '세상은 아직 따뜻하다.' },
    ] },
);

/* ═════ 함께 밤을 보낸 뒤 (js/game.js afterSex·afterTexts) — 다음 날 아침, 1~3일 뒤 메시지, 읽씹 ═════ */
const fpP = (s, a) => a.focused();
E.push(
  // 사귀지 않는 사이와 처음 보낸 밤 — 다음 날 아침
  { id: 'af_morning', type: 'trigger', once: false, age: [20, 70],
    text: s => s.place === 'motel' ? '체크아웃 전화에 눈을 떴다. {fp|이} 이불 속에서 머리를 긁적였다. 둘 다 잠깐 말이 없었다.' : '커튼 사이로 해가 들어왔다. {fp|이} 옆에서 눈을 떴다. 둘 다 잠깐 말이 없었다.',
    choices: [
      { label: '해장하러 가자고 한다', effect: { money: -3, happy: 2 }, p: { close: [4, 7], heart: [2, 4] }, text: '국밥집에서 마주 앉았다. 어젯밤 얘기는 안 했는데 이상하게 편했다.' },
      { label: '"연락해도 돼?" 하고 묻는다', check: { stat: 'charm', diff: 55 },
        success: { p: { close: [3, 5], heart: [2, 4] }, do: (s, a) => { const p = fpP(s, a); if (p) p.phone = true; }, text: '{fp|이} 내 휴대폰에 번호를 찍어 줬다. 이름 옆에 이모티콘까지.' },
        fail: { p: { heart: [-3, -1] }, text: '"…그냥 이렇게 끝내는 게 좋지 않을까." {fp|이} 웃으며 신발을 신었다.' } },
      { label: '택시를 잡아 준다', effect: { money: -2 }, p: { close: [1, 3] }, text: '택시 문을 닫기 전에 {fp|이} 손을 흔들었다. 묘하게 아쉬웠다.' },
      { label: '"어젯밤 일은 없던 걸로 하자"', p: { heart: [-8, -5], trust: [1, 3] }, do: (s, a) => { const p = fpP(s, a); if (p) p.fling = false; }, text: '{fp|이} 잠깐 나를 보더니 고개를 끄덕였다. "그래, 그게 편하겠다."' },
    ] },
  // 1~3일 뒤 메시지 — 사귀지 않는 사이 (만족감이 괜찮았으면)
  { id: 'af_text_casual', type: 'trigger', once: false, age: [20, 70],
    text: s => `띵. {fp}에게서 메시지가 왔다. ${s.region === 'ny' ? '"Hey. 잘 들어갔어?"' : '"어제… 잘 들어갔어?"'}`,
    choices: [
      { label: '"응. 너는?" 다정하게 답한다', p: { close: [3, 5], heart: [2, 4] }, text: '대화가 새벽까지 이어졌다. 이모티콘이 점점 늘었다.' },
      { label: '"이번 주에 또 볼래?"', check: { stat: 'charm', diff: 60 },
        success: { p: { heart: [4, 7] }, do: (s, a) => { const p = fpP(s, a); if (p) p.libido = Math.min(100, (p.libido || 0) + 12); }, text: '"금요일?" 답이 바로 왔다.' },
        fail: { p: { heart: [-2, -1] }, text: '"…생각해 볼게." 그 뒤로 한참 답이 없었다.' } },
      { label: '"응ㅋㅋ" 짧게만 답한다', p: { close: [0, 1] }, text: '대화는 거기서 끝났다.' },
      { label: '읽고 답하지 않는다', karma: -2, p: { heart: [-7, -4], grudge: [2, 4] }, text: '읽고 그냥 뒀다. 다시 연락은 오지 않았다.' },
    ] },
  // 별로였던 밤 — 상대가 답을 안 함 (읽씹)
  { id: 'af_ghost', type: 'trigger', once: false, age: [20, 70],
    text: '{fp}에게 보낸 메시지에 이틀째 답이 없다. 읽은 표시만 떠 있다.',
    choices: [
      { label: '한 번 더 보낸다', chance: .35,
        success: { p: { close: [1, 3] }, text: '"아 미안, 요즘 정신이 없어서ㅠ" 늦은 답이 왔다. 그걸로 됐다.' },
        fail: { effect: { happy: -2 }, text: '두 번째 메시지에도 답은 없었다. 휴대폰을 엎어 놓았다.' } },
      { label: '그냥 넘긴다', effect: { happy: -1 }, text: '원래 그런 사이였다고 생각하기로 했다.' },
    ] },
  // 사귀는 사이 — 다음 날 메시지
  { id: 'af_text_love', type: 'trigger', once: false, age: [20, 70],
    text: '점심시간에 {fp}에게서 메시지가 왔다. "아직도 어제 생각나ㅎㅎ 오늘 일찍 와."',
    choices: [
      { label: '"나도. 칼퇴할게."', p: { heart: [2, 4], close: [1, 3] }, effect: { happy: 2 }, text: '오후 내내 시계만 봤다.' },
      { label: '"오늘 야근이야ㅠ"', p: { heart: [-1, 0] }, text: '"힝." 우는 이모티콘이 왔다.' },
    ] },
  // 결혼했거나 애인 있는 사람 — "지워 줘"
  { id: 'af_text_illicit', type: 'trigger', once: false, age: [20, 70],
    text: '{fp}에게서 짧은 메시지가 왔다. "어제 일 아무한테도 말하지 마. 이 대화도 지워 줘."',
    choices: [
      { label: '알겠다고 하고 지운다', p: { trust: [3, 6] }, text: '대화방을 나왔다. 기록은 남지 않았다. 기억은 남았다.' },
      { label: '"또 볼 수 있어?"', check: { stat: 'charm', diff: 70 },
        success: { p: { heart: [3, 6] }, text: '한참 뒤에 답이 왔다. "…다음 주 수요일. 내가 장소 보낼게."' },
        fail: { p: { trust: [-4, -2] }, text: '"안 돼. 이번이 마지막이야." 그 뒤로 번호가 바뀌었다.' } },
    ] },
);
})();
