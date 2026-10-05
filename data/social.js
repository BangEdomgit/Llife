// 사람과의 상호작용 — 관계 창에서 사람을 눌렀을 때 나오는 버튼들 (행동 1 사용)
//
// 호감도 4종 (사람마다 따로)
//   close 친밀 / trust 신뢰 / heart 설렘 / grudge 원한
//   설렘은 연애 가능한 상대만 움직임: 둘 다 19살 이상, 상대 50살 미만, 이성, 가족 아님
//   엔진이 추가로 곱해주는 것: 성격 궁합(mod), 같은 취미(같이 놀기·선물 1.3배), 가치관(같으면 1.2배, 부딪히면 0.8배)
//
// if(s, p, a)  → 이 버튼이 보이는 조건
// cost(s, p)   → 드는 돈 (만원)
// run(s, p, a) → 결과. p: 상대 호감도 변화 / effect: 내 스탯 / risk: 애인에게 들킬 확률 / riskTaken: 상대 애인에게 들킬 확률
//                pregnant: 아이가 생길 확률 (엔진이 나이·아이 수로 보정) / moveTo: 상대와 같이 다른 장소로 이동
// noFree: true  → 장소에 같이 있어도 늘 행동 1 (이동하는 것들)
// scene: 'kiss' | 'hug' | 'pull' → 화면에 실루엣 연출
// 문장의 {p}는 상대 이름 (조사는 {p|와} 처럼)
//
// intimate: true → 엔진이 '함께 밤을 보냄'으로 처리 (성욕 해소, 기술·궁합, 만족감에 따라 설렘 변화). mood: 분위기 보정
//
// 친밀한 관계 — 조건: 둘 다 20살 이상, 이성, 가족 아님, 집에서만. 행위 과정은 쓰지 않고, 그 전후와 다음 날 아침에 무게를 둠
// 받아줄지는 꼬심 점수(잠자리 수락 가중치: 설렘·친밀·성욕·상황이 크고 외모는 작게)로 정함
window.GAME_DATA = window.GAME_DATA || {};

(function () {
const notKin = p => p.kind !== 'family' && p.kind !== 'child';
const lover = p => p.partner || p.spouse || p.secret;
// 이미 사귀는 사이는 상대가 50살을 넘어도 됨. 그 외엔 연애 가능 조건 그대로 (엔진의 canSex: 둘 다 20살 이상)
const adultPair = (s, p, a) => a.canSex(p);
const pickLine = (a, set, p) => { const L = GAME_DATA.nightLines[set][p.personality]; return L ? a.pick(L) : GAME_DATA.nightLines[set]._; };

// 함께 밤을 보낸 다음 날 아침 — 상대 성격마다 다름 (lover: 사귀는 사이 / fling: 사귀지 않는 사이)
GAME_DATA.nightLines = {
  // 불이 꺼지기 전 한 줄 (사귀는 사이)
  intro: ['불을 끄자 방 안에 숨소리만 남았다.', '{p|이} 내 셔츠 단추에 손을 올렸다. 멈추지 않았다.', '소파에서 시작된 키스가 침대까지 이어졌다.', '{p}의 손이 등을 타고 올라왔다. 숨이 가까워졌다.'],
  // 사귀지 않는 사이
  flingIntro: ['문이 닫히자마자 입술이 먼저 닿았다.', '술기운 탓이라고 하기엔 서로 너무 또렷하게 기억하고 있었다.', '엘리베이터 안에서 시작된 건 택시 안에서 끝나지 않았다.', '샤워기 소리가 멈추자 방 안이 조용해졌다. 둘 다 어색했다.'],
  lover: {
    bold:      ['{p|이} 내 위에서 일어나며 웃었다. "또 해도 돼?"', '{p|이} 먼저 이불을 걷어찼다. "일어나, 밥 먹자."'],
    shy:       ['{p|이} 이불 속에서 내 가슴에 얼굴을 묻었다. 귀 끝이 아직 빨갛다.', '{p|이} 눈이 마주치자 이불을 머리끝까지 끌어올렸다.'],
    playful:   ['{p|이} 내 등에 남은 손톱 자국을 보더니 "내 작품"이라며 깔깔거렸다.', '눈을 떠 보니 {p|이} 내 얼굴에 낙서를 하고 있었다.'],
    cool:      ['{p|이} 아무 일 없었다는 듯이 커피를 내리고 있었다. 컵이 두 개다.', '{p|은} 말없이 내 몫의 토스트까지 구워놨다.'],
    warm:      ['{p|이} 먼저 일어나 아침을 차려 놓았다. 내 옷을 걸치고.', '{p|이} 내 머리를 쓸어 넘기며 더 자라고 했다.'],
    sharp:     ['{p|이} "어젯밤 좋았어"라고 짧게 말했다. 목에 자국이 남아 있었다.', '{p|이} 옷을 챙기며 "다음 주 금요일 비워둬."라고 했다.'],
    sunny:     ['아침부터 {p}의 콧노래가 집 안을 채웠다. 바닥에 옷이 흩어져 있었다.', '{p|이} 콧노래를 부르며 커튼을 활짝 열었다.'],
    sensitive: ['{p|이} 아직 내 팔 안에 있었다. "가지 마"라고 작게 말했다.', '{p|이} 내 손을 꼭 잡고 한참을 놓지 않았다.'],
    _: '{p|와} 뒤엉킨 이불 속에서 늦은 아침을 맞았다.',
  },
  fling: {
    bold:      ['{p|이} "우리 이제 뭐야?"라고 대놓고 물었다.'],
    shy:       ['{p|이} 얼굴을 붉히며 인사도 제대로 못 하고 나갔다.'],
    playful:   ['{p|이} "우리 둘만 아는 걸로?" 하며 새끼손가락을 내밀었다.'],
    cool:      ['{p|은} 아무 일 없었다는 듯 손을 흔들고 나갔다.'],
    warm:      ['{p|이} 해장국을 끓여놓고 갔다. "밥 꼭 먹어"라는 쪽지가 붙어 있었다.'],
    sharp:     ['{p|이} "어젯밤 일은 어젯밤 일로 하자."라고 선을 그었다.'],
    sunny:     ['{p|이} 아침부터 콧노래를 불렀다. 어색한 건 나뿐이었다.'],
    sensitive: ['{p|이} 한참 망설이다 "후회 안 해?"라고 물었다.'],
    _: '{p|이} 조용히 먼저 나갔다.',
  },
};

// 그날 밤 말풍선 (js/night.js): 상대가 중간중간 내는 소리와 말 — 만족감 단계(tier 0~4)·달아오른 정도·성격마다 다름. 문장은 암시까지만
//   moan: 소리 (나쁨 / 낮음 / 중간 / 높음), line: 말 (tier별), pers: tier 3 이상일 때 성격별 말, ouch: 움찔(넘칠 때), gasp: 헉, climax: 절정(소·중·대), end: 끝난 뒤(좋음·나쁨)
//   m: 상대가 남자일 때 (내가 여자)
GAME_DATA.nightSay = {
  moan: { bad: ['…', '음.', '…아직?', '(하품을 참는다)'], low: ['흐읍…', '하…', '음…', '읏…'], mid: ['하아…', '하앗…', '으응…', '아…'], high: ['하앗…! 하아…', '아…! 아앗…', '흐윽…♡', '하아… 하아…♡'] },
  line: [
    ['…끝났어?', '음… 그냥 빨리 하자.', '거기 아니야.', '…졸려.'],
    ['괜찮아… 그냥 그래.', '조금만 천천히…', '음, 나쁘진 않네.', '…이게 다야?'],
    ['좋아…', '천천히… 그렇게.', '너 따뜻하다…', '이대로…'],
    ['거기… 거기 좋아…!', '더… 멈추지 마…', '이상해… 너무 좋아…', '숨 막혀…♡'],
    ['머리가 하얘져…', '이러다 이상해질 것 같아…♡', '너 없으면 안 될 것 같아…', '아무 생각도 안 나…♡'],
  ],
  pers: { bold: '더 세게…!', shy: '…보지 마, 부끄러워…', playful: '히히… 반칙이야…♡', cool: '…생각보다… 괜찮네.', warm: '좋아… 너라서 좋아…', sharp: '그래… 거기, 정확해…', sunny: '최고야…! 진짜 최고…!', sensitive: '…눈물 날 것 같아…' },
  ouch: ['아…! 아파…', '잠깐… 천천히…!', '읏… 숨이 막혀…', '아…! 잠깐만…'],
  gasp: ['흣…!', '아…!?', '거, 거기…!', '하윽…!'],
  climax: { minor: ['하앗…♡', '으응…!'], mid: ['아…! 아앗…♡', '가… 갈 것 같아…♡'], major: ['아아아…♡♡', '머, 멈추지 마…! 아앗…♡', '하아아…♡ 하아…'] },
  end: { good: ['…하아. 최고였어.', '잠깐만… 다리에 힘이 없어…', '너 진짜…♡', '…한 번 더 안아 줘.'], bad: ['…벌써?', '음… 수고했어.', '…그냥 자자.', '…응.'] },
  m: {
    moan: { bad: ['…', '음.'], low: ['흐…', '하…'], mid: ['하아…', '읏…'], high: ['하아… 하아…', '흣…!'] },
    line: [['…피곤하다.', '음.'], ['괜찮네…', '조금만…'], ['좋다…', '너 진짜…'], ['미치겠다…', '멈추지 마…'], ['너밖에 없어…', '아무 생각도 안 나…']],
    pers: {}, ouch: ['읏…', '잠깐…'], gasp: ['흣…!', '하…!'], climax: { minor: ['흣…'], mid: ['하아…!'], major: ['하아… 하아…!'] },
    end: { good: ['…최고였어.', '너 진짜…'], bad: ['…자자.', '음…'] },
  },
};

// 디테일 모드(테스트) 전용 글 — js/night.js·js/main.js. {p}: 상대, {p|이}: 상대+조사, {me}: 내 이름. 문장은 암시까지만
//   nightNarr: 그날 밤 아래 내레이션 자막 (시작 / 만족감 단계 / 체위별 [시큰둥, 달아오름] / 절정 / 끝난 뒤)
GAME_DATA.nightNarr = {
  start: {
    good: ['불이 꺼지고, 이불 속에서 서로의 체온이 맞닿는다.', '{p|이} 작게 숨을 들이쉰다. 손끝이 등을 따라 내려간다.', '이불이 사락거리며 두 사람을 덮는다.', '{p|와}의 거리가 사라진다. 심장 소리가 들릴 것 같다.'],
    bad: ['어색한 침묵 속에 이불만 바스락거린다.', '{p|이} 천장을 바라보며 숨을 고른다.', '서로 눈을 피한 채 이불을 끌어당긴다.'],
  },
  band: {
    low: ['침대만 일정하게 삐걱거린다.', '{p|은} 딴생각을 하는 듯 창밖을 본다.', '어디에 손을 둘지 몰라 잠깐 멈칫한다.', '{p|이} 작게 한숨을 쉰다.'],
    mid: ['숨소리가 조금씩 가빠진다.', '{p}의 손이 어깨를 붙잡는다.', '이불 속 공기가 점점 뜨거워진다.', '목덜미에 입술이 닿자 {p|이} 움찔한다.', '엉킨 손가락에 힘이 들어간다.'],
    high: ['{p}의 손톱이 등에 박힌다.', '시트를 움켜쥔 손가락이 하얗게 질린다.', '땀에 젖은 머리카락이 목덜미에 달라붙는다.', '{p|이} 이름을 부르다 말끝을 흐린다.', '허리가 활처럼 휘었다가 천천히 풀린다.', '발끝이 오므라들었다 펴지기를 반복한다.', '숨이 엉켜 누구의 숨인지 모르겠다.'],
  },
  pose: {
    missionary: [['{p|은} 눈을 감은 채 가만히 있다.', '베개만 조금씩 밀려난다.'], ['{p|이} 두 팔로 목을 끌어안는다.', '{p}의 다리가 허리를 감는다.']],
    legsUp: [['{p|이} 불편한 듯 몸을 뒤척인다.'], ['{p}의 발끝이 허공에서 떨린다.', '{p|이} 시트를 양손으로 움켜쥔다.']],
    doggy: [['{p|이} 베개에 턱을 괸 채 하품을 참는다.'], ['흐트러진 머리카락 사이로 땀에 젖은 등이 보인다.', '{p|이} 베개를 끌어안고 얼굴을 묻는다.']],
    prone: [['{p|이} 엎드린 채 가만히 숨만 쉰다.'], ['베개를 끌어안은 손가락에 힘이 들어간다.', '{p}의 어깨가 잘게 떨린다.']],
    cowgirl: [['{p|이} 위에서 어색하게 머뭇거린다.'], ['{p|이} 머리카락을 쓸어 넘기며 내려다본다.', '{p}의 허리가 리듬을 탄다.', '{p|이} 가슴에 두 손을 짚고 숨을 고른다.']],
    reverse: [['{p}의 등이 멀게만 느껴진다.'], ['{p}의 등줄기를 따라 땀방울이 흘러내린다.', '{p|이} 고개를 젖히며 긴 숨을 내쉰다.']],
    seated: [['{p|이} 어정쩡하게 기대앉아 있다.'], ['{p|이} 등을 기대며 손을 뒤로 뻗어 목을 감는다.', '귓가에 닿는 숨이 뜨겁다.']],
    lotus: [['마주 앉았지만 시선이 자꾸 엇갈린다.'], ['이마를 맞댄 채 숨을 나눈다.', '{p|이} 두 팔로 목을 감고 놓아주지 않는다.']],
  },
  climax: {
    minor: ['{p}의 숨이 잠깐 멎었다가 터져 나온다.', '{p}의 허벅지가 잘게 떨린다.'],
    mid: ['{p}의 온몸이 굳었다가 천천히 풀린다.', '{p|이} 어깨에 얼굴을 묻고 소리를 삼킨다.', '발끝까지 힘이 들어갔다가 풀린다.'],
    major: ['{p}의 몸이 활처럼 휘고, 한참 동안 떨림이 멎지 않는다.', '{p|이} 이름을 부르며 매달린다.', '눈앞이 하얘진 듯 {p|이} 한동안 말이 없다.'],
  },
  after: {
    good: ['땀에 젖은 채 서로를 끌어안는다.', '{p|이} 가슴에 얼굴을 묻고 숨을 고른다.', '엉킨 시트 위로 두 사람의 숨소리만 남는다.', '{p|이} 손가락으로 등에 작은 원을 그린다.'],
    bad: ['{p|이} 등을 돌리고 이불을 끌어당긴다.', '어색한 침묵. 시계 초침 소리만 들린다.', '{p|이} 휴대폰을 집어 든다.'],
  },
};
// 디테일 모드에서 말풍선에 섞이는 말 (만족감 단계별) — 이름 부르기 등
GAME_DATA.nightSay.more = [
  ['…저기, 불 좀 꺼 줄래?', '아, 머리 눌렸어.'],
  ['음… 거기 말고.', '잠깐, 팔 저려.'],
  ['{me}…', '손… 잡아 줘.', '키스해 줘…'],
  ['{me}… {me}…', '놓지 마…', '얼굴 보지 마… 부끄러워…', '거기… 계속…'],
  ['{me}… 나 이상해…', '조금만 더… 이대로…', '안아 줘… 꽉…'],
];
GAME_DATA.nightSay.m.more = [['…불 끌까.'], ['음… 잠깐만.'], ['{me}…'], ['{me}… 진짜…', '놓기 싫다…'], ['너밖에 안 보여…', '{me}… 사랑해…']];
// 다가가는 카드·골목 카드 자막 (차례로 뜸), 다음 날 아침 내레이션 (만족감 단계별)
GAME_DATA.foreCap = ['시선이 얽힌다.', '입술이 겹친다.', '단추가 하나씩 풀린다.', '옷이 바닥으로 떨어진다.'];
GAME_DATA.alleyCap = ['차가운 벽에 등이 닿는다.', '깃을 잡아끄는 손에 힘이 들어간다.', '숨이 섞인다.'];
GAME_DATA.morningNarr = [
  ['{p|은} 먼저 일어나 옷을 입고 있었다.', '눈이 마주치자 {p|이} 시선을 피했다.'],
  ['{p|이} 하품을 하며 머리를 긁적인다.', '어젯밤 얘기는 아무도 꺼내지 않았다.'],
  ['{p|이} 이불 속에서 발끝으로 장난을 친다.', '커튼 틈으로 들어온 햇빛에 {p|이} 눈을 찡그린다.'],
  ['{p|이} 목에 남은 자국을 머리카락으로 가리며 웃는다.', '"허리 아파…" {p|이} 베개에 얼굴을 묻은 채 투덜거린다.'],
  ['{p|이} 다리에 힘이 안 들어간다며 이불 밖으로 나오지 않는다.', '엉킨 시트 위에서 {p|이} 한참 동안 품을 파고든다.', '"…또 하자." {p|이} 귓가에 속삭인다.'],
];

// 섹드립·스킨십 — 플러팅(설렘)과 달리 나를 향한 상대 성욕을 올림. 받아주면 성욕↑, 선을 넘으면 신뢰·원한으로 돌아옴
// 문장은 암시까지만 (행위 묘사 없음). {p}: 상대
GAME_DATA.teaseLines = {
  say: {
    m: ['"오늘따라 왜 이렇게 예뻐? 집에 보내기 아까운데."', '"그 립스틱, 진짜 안 지워지는지 확인해봐도 돼?"', '"너랑 있으면 밤이 너무 짧을 것 같아."',
      '"잘 때는 뭐 입고 자? …그냥 궁금해서."', '"그 단추 하나만 더 풀면 반칙이야."', '"너 그렇게 웃으면 나 오늘 집에 못 간다."'],
    f: ['"팔뚝 한번 만져봐도 돼? …생각보다 단단하네."', '"오늘 우리 집에 아무도 없는데."', '"너 그렇게 쳐다보면 나 오해한다?"',
      '"그 셔츠, 단추 몇 개까지 풀어봤어?"', '"키스 잘하게 생겼다는 말 많이 듣지?"', '"너 목소리, 밤에 들으면 위험하겠다."'],
  },
  sayOk: {
    bold: '{p|이} 피식 웃더니 더 센 농담으로 받아쳤다.', shy: '{p|이} 얼굴이 새빨개져서 고개를 숙였다. 그래도 싫지는 않은 눈치다.',
    playful: '{p|이} "변태!" 하며 내 팔을 때리더니 한참 웃었다.', cool: '{p|은} 대꾸 없이 잔을 비웠다. 귀 끝이 빨갰다.',
    warm: '{p|이} "못 말려" 하면서도 내 쪽으로 몸을 기울였다.', sharp: '{p|이} 한쪽 눈썹을 올렸다. "말만 그렇게 하는 거 아니지?"',
    sunny: '{p|이} 깔깔 웃더니 "나도 방금 그 생각 했는데!"라고 했다.', sensitive: '{p|이} 잠깐 말이 없다가 "…그런 말 하면 신경 쓰이잖아."라고 했다.',
  },
  sayNo: ['{p}의 표정이 싸늘하게 식었다. "선 넘지 마."', '{p|이} 못 들은 척 휴대폰을 봤다. 공기가 차가워졌다.', '{p|이} 어이없다는 듯 웃고는 화제를 돌렸다.'],
  sayNoSharp: '"그거 지금 농담이라고 한 거야?" {p|이} 정색했다.',
  touch: {
    light: ['{p}의 손등에 슬쩍 손을 겹쳤다.', '{p}의 어깨에 붙은 머리카락을 떼어주며 손끝을 잠깐 머물렀다.', '걷다가 {p}의 손을 살짝 잡았다.'],
    mid: ['{p}의 허리에 가볍게 손을 둘렀다.', '나란히 앉아 {p}의 무릎에 손을 얹었다.', '{p}의 귓가에 대고 작게 이름을 불렀다.'],
    close: ['뒤에서 {p}를 끌어안고 목덜미에 얼굴을 묻었다.', '{p}의 허리를 끌어당겨 이마를 맞댔다.', '{p}의 손가락 사이로 내 손가락을 천천히 끼웠다.'],
  },
  touchOk: {
    bold: '{p|이} 오히려 더 가까이 붙어왔다. "이게 다야?"', shy: '{p}의 귀가 새빨개졌다. 그래도 손을 빼지 않았다.',
    playful: '{p|이} 간지럽다며 웃더니 내 손가락에 깍지를 꼈다.', cool: '{p|은} 아무 말 없이 그대로 있었다. 숨이 조금 빨라져 있었다.',
    warm: '{p|이} 내 손 위에 자기 손을 포갰다.', sharp: '{p|이} 내 눈을 똑바로 봤다. "책임질 수 있어?"',
    sunny: '{p|이} 활짝 웃으며 내 어깨에 머리를 기댔다.', sensitive: '{p}의 숨이 살짝 떨렸다. "…심장 소리 들리겠다."',
  },
  touchNo: ['{p|이} 손을 빼며 한 발 물러섰다. "이러지 마."', '{p|이} 정색했다. 분위기가 순식간에 얼어붙었다.', '{p|이} 내 손을 치우며 "우리 그런 사이 아니잖아."라고 했다.'],
  // 애인이 있는 상대 (헤어지지 않은 채)
  taken: ['"나 {mate} 있는 거 알지?" {p|이} 그렇게 말하면서도 자리를 뜨지 않았다.', '{p}의 휴대폰에 {mate} 이름이 떴다. {p|은} 화면을 엎어놓았다.'],
  takenMorning: ['{p}의 휴대폰에 {mate} 이름이 몇 번이나 떠 있었다. {p|은} 화면을 엎어놓고 내 쪽으로 돌아누웠다.', '"{mate}한테는 친구 집에서 잤다고 할게." {p|이} 옷을 챙기며 말했다.', '{p|이} 문 앞에서 돌아봤다. "우리 둘만 아는 거야."'],
  heatUp: ' {p}의 눈빛이 달라졌다.',
};
// 함께 밤을 보낸 뒤 상대 애인·배우자에게 들키는 계기 (js/game.js scheduleTrace — 상대 성격마다 확률·방식이 다름). {fp}: 상대, {mate}: 상대의 애인·배우자
GAME_DATA.traceLines = {
  text: ['{fp}의 {mate}가 {fp}의 휴대폰에서 나와 주고받은 문자를 봤다.', '{fp|이} 미처 지우지 못한 메시지 하나가 문제였다. {mate}가 먼저 봤다.', '{fp}의 휴대폰 알림에 내 이름이 떴다. 하필 {mate} 앞에서.', '{fp}의 {mate}가 통화 기록을 뒤졌다. 같은 번호가 새벽마다 찍혀 있었다.'],
  mark: ['{fp}의 목덜미에 남은 자국을 {mate}가 봤다.', '{fp}의 어깨에 남은 자국 때문에 {mate}가 캐묻기 시작했다.', '{fp}의 셔츠 깃 아래 붉은 자국이 {mate} 눈에 띄었다.', '{fp}의 등에 남은 손톱자국을 {mate}가 봤다. 변명이 통하지 않았다.'],
};
const mateOf = p => p.married ? (p.gender === 'f' ? '남편' : '아내') : p.gender === 'f' ? '남자친구' : '여자친구';
const takenLine = (a, p, set) => a.pick(GAME_DATA.teaseLines[set]).replace(/\{mate\}/g, mateOf(p));
// 섹드립·스킨십 성공 여부: 꼬심 점수(외모·매력·관계) + 상대 성격 + 나를 향한 성욕 + 술기운. 같은 날 또 하면 덜 먹힘
const TEASE_MOD = { bold: 10, playful: 12, sunny: 6, cool: 0, warm: 2, sharp: -10, shy: -8, sensitive: -6 };
function teaseOk(s, p, a, need) {
  const same = p.teaseDay === a.today();
  return a.allure(p) + (TEASE_MOD[p.personality] || 0) + (p.libido || 0) / 5 + (lover(p) || p.fwb ? 25 : 0) + [0, 5, 10, 0][a.drunk()] - (same ? 12 : 0) + a.rand(-15, 15) >= need;
}
// 나를 향한 성욕을 얼마나 올릴지 (같은 날 또 하면 절반)
const heatRoll = (p, a, lo, hi) => Math.round(a.rand(lo, hi) * (p.teaseDay === a.today() ? .5 : 1));
// 골목: 짧은 시간(이틀 안)에 섹드립·스킨십으로 25 넘게 끌어올려 70을 넘겼고, 외모·매력이 받쳐주면(꼬심 보너스 24+) 밖에서 상대가 먼저 골목으로 이끔
const ALLEY_NO = ['home', 'office', 'campus', 'school', 'academy', 'hospital', 'church', 'library', 'center'];
function alleyReady(s, p, a, gain) {
  if (!a.canSex(p) || !s.place || ALLEY_NO.includes(s.place) || a.casualBonus() < 24) return false;
  if (p.alleyDay != null && a.today() - p.alleyDay < 7) return false;
  const streak = p.heatDay != null && a.today() - p.heatDay <= 1 ? (p.heatGain || 0) : 0;
  return streak + gain >= 25 && (p.libido || 0) + gain >= 70;
}
// 올림: 60을 넘는 순간이면 한 줄, 이틀 안에 올린 양을 쌓아둠
function heat(s, p, a, gain, alley) {
  const before = p.libido || 0, today = a.today();
  p.libido = Math.min(100, before + gain);
  p.heatGain = (p.heatDay != null && today - p.heatDay <= 1 ? p.heatGain || 0 : 0) + gain; p.heatDay = today;
  p.teaseDay = today; p.teased = true;
  s.vars.heatUp = before < 60 && p.libido >= 60;
  if (alley) p.alleyDay = today;
}
// 상대 상태별 문턱 (꼬심 점수에 더함): 유부녀·유부남 +12(술집에서 반지를 빼는 사람은 +4) / 애인 있음 +5 / 솔로 0
//   내 외모(첫인상)·매력이 A 이상이면 등급마다 -3 (S·S면 문턱이 거의 사라짐 — 외모·매력이 높으면 유부도 넘어옴)
const statusNeed = (p, a) => p.hooked ? 0 : Math.max(0, (p.married ? (p.ringOff ? 4 : 12) : p.taken ? 5 : 0) - (a ? Math.max(0, a.lookIdx() - 4) * 3 + Math.max(0, a.charmIdx() - 4) * 3 : 0));   // 섹스 기술 SSS에 빠진 사람은 상관없음
// 들킬 위험: 유부녀·유부남은 배우자에게(spouseCaught), 애인 있음은 애인에게(rivalFound)
const statusRisk = (p, k = 1) => (p.married ? .12 : p.taken ? .08 : 0) * k;
const PRIVATE = ['home', 'motel'];
// 동행으로 데려옴: 여기 없으면 내 옆으로 (모텔·집으로 가면 같이 감)
function comeAlong(s, p, a) { a.setCompanion(p); if (s.place && !s.here.some(h => h.key === p.id)) s.here.push({ key: p.id, doing: '내 옆에 붙어 있다', used: true }); }
const ALLEY_LINE = ' {p|이} 내 손목을 잡고 가게 옆 골목으로 이끌었다. 네온 불빛 아래에서 숨이 먼저 닿았다.';

// 대화 이벤트(data/dialogues.js)에서 고른 말의 결과 — ch: { tone 말투, risk 0 살짝·1 보통·2 과감하게, fit 상대 성격과 말투 궁합 +1·0·-1, ok/ng 선택지 반응 }
const react = (a, table, p) => a.pick(table[p.personality] || table.warm);
const DLG_REVEAL = ['hobby', 'dream', 'value', 'wealth'];
function talkChoice(s, p, a, ch) {
  const R = GAME_DATA.dlgReact.talk, lv = ch.fit > 0 ? 'great' : ch.fit < 0 ? 'meh' : 'good';
  const P = lv === 'great' ? { close: [6, 9], trust: [2, 4] } : lv === 'good' ? { close: [3, 5], trust: [1, 2] }
    : ['cool', 'brag', 'tease'].includes(ch.tone) ? { close: [-3, -1], trust: [-2, 0] } : { close: [0, 1], trust: [-1, 0] };
  const me = a.myLook(), them = a.theirLook(p), lk = lv === 'meh' ? null : me === 'hi' && a.heartOk(p) ? 'hi' : them === 'hi' ? 'up' : me === 'lo' ? 'lo' : null;
  if (lv !== 'meh') {
    if (ch.tone === 'listen' || ch.tone === 'deep') P.trust = [P.trust[0] + 2, P.trust[1] + 2];   // 들어주기·진지하게: 신뢰 +2
    if (ch.tone === 'joke') P.close = [P.close[0] + 1, P.close[1] + 1];                          // 농담: 친밀 +1
    if (lv === 'great' && ['warm', 'shy', 'deep', 'joke'].includes(ch.tone)) P.heart = [1, 3];     // 연애 가능한 상대면 설렘도 조금 (엔진이 거름)
  }
  // 물어보기: 아직 모르는 취미·꿈·가치관·형편 중 하나를 털어놓을 수 있음
  const f = ch.tone === 'ask' && lv !== 'meh' && DLG_REVEAL.find(k => !a.known(p, k));
  const tell = f && Math.random() < (lv === 'great' ? .8 : .5);
  return { ok: lv !== 'meh', p: P, effect: lv === 'meh' ? { happy: -1 } : { happy: [0, 1] }, do: tell ? () => { p.told = (p.told || []).concat(f); } : undefined,
    text: ((lv === 'meh' ? ch.ng : ch.ok) || react(a, R[lv], p)) + (tell ? ' ' + GAME_DATA.pillowReveal[f] : '') + (lk && Math.random() < .3 ? ' ' + a.pick(GAME_DATA.lookReact.talk[lk]) : '') };
}
// 외모 차이 (내 첫인상 / 상대 생김새): 나 hi·상대 lo → 문턱 -8·얻는 것 ×1.25 / 둘 다 hi → ×1.15 / 상대 hi·나는 아님 → 문턱 +8 (눈이 높음)
//   나 hi → 문턱 -3·×1.1 / 나 lo → 문턱 +3·×0.9. key: 이어 붙는 반응 대사 (data/dialogues.js lookReact)
function lookGap(a, p) {
  const me = a.myLook(), them = a.theirLook(p);
  if (me === 'hi') return them === 'lo' ? { need: -8, k: 1.25, key: 'gap' } : them === 'hi' ? { need: 0, k: 1.15, key: 'both' } : { need: -3, k: 1.1, key: 'hi' };
  if (them === 'hi') return { need: 8, k: 1, key: 'up' };
  return me === 'lo' ? { need: 3, k: .9, key: 'lo' } : { need: 0, k: 1, key: null };
}
const lookLine = (a, set, key) => { const L = key && (GAME_DATA.lookReact[set] || {})[key]; return L && Math.random() < .5 ? ' ' + a.pick(L) : ''; };
const kRange = ([lo, hi], k) => [Math.round(lo * k), Math.round(hi * k)];
// 애인·배우자가 있는 상대가 먼저 제안 (takenInvite): 내 첫인상이나 매력이 A 이상이고 상대가 달아올랐을 때. 같은 사람은 7일에 한 번
function inviteRoll(s, p, a, r) {
  if (!p.taken || lover(p) || !a.canSex(p) || a.companion() === p) return false;
  if (p.inviteDay != null && a.today() - p.inviteDay < 7) return false;
  const li = a.lookIdx(), ci = a.charmIdx();
  if (li < 5 && ci < 5 && !p.hooked) return false;
  const ch = .1 + Math.max(0, li - 4) * .08 + Math.max(0, ci - 4) * .06 + ((p.libido || 0) >= 55 ? .15 : 0) + (p.heart >= 40 ? .05 : 0) + [0, .04, .08][r] + (p.hooked ? .3 : 0);
  return Math.random() < Math.min(.6, ch);
}
function flirtChoice(s, p, a, ch) {
  const r = ch.risk, R = GAME_DATA.dlgReact.flirt, lg = lookGap(a, p);
  if (ch.tone === 'back') return { p: ch.fit > 0 ? { trust: [2, 4], close: [1, 2] } : { trust: [0, 2] }, text: ch.ok || react(a, GAME_DATA.dlgReact.dirty.back, p) };   // 물러서기: 선을 지킴 (설렘은 없음)
  const ok = a.charmed(p, null, a.need('flirt') + [-10, 0, 12][r] - ch.fit * 12 + lg.need);   // 과감할수록 문턱이 높고, 말투가 맞으면 낮아짐, 외모 차이
  const risk = a.main() && a.main() !== p ? [.1, .2, .3][r] : 0;
  if (ok) {
    const k = (ch.fit > 0 ? 1.3 : ch.fit < 0 ? .75 : 1) * lg.k, invite = inviteRoll(s, p, a, r);
    return { ok: true, p: { heart: kRange([[4, 7], [8, 13], [13, 20]][r], k), close: [[1, 2], [1, 3], [2, 4]][r] }, effect: { happy: r === 2 ? [2, 4] : [0, 2] },
      risk, riskTaken: p.taken ? [.08, .15, .22][r] : 0, do: invite ? () => { p.inviteDay = a.today(); } : undefined, then: invite ? 'takenInvite' : undefined,
      text: (ch.ok || react(a, r === 2 ? R.big : R.ok, p)) + lookLine(a, 'flirtOk', lg.key) };
  }
  const P = [{ close: [-1, 0] }, { close: [-3, -1] }, { close: [-5, -3], trust: [-3, -1] }][r];
  if (ch.fit < 0 && r) P.grudge = [1, 3];
  return { ok: false, p: P, effect: { happy: [-1, -2, -3][r] }, risk, riskTaken: p.taken ? [.05, .1, .15][r] : 0, text: (ch.ng || react(a, R.ng, p)) + lookLine(a, 'flirtNg', lg.key) };
}
function dirtyChoice(s, p, a, ch) {
  const T = GAME_DATA.teaseLines, R = GAME_DATA.dlgReact.dirty, r = ch.risk;
  const risk = a.main() && a.main() !== p ? [.03, .05, .08][r] : 0;
  if (ch.tone === 'back') return { p: ch.fit > 0 ? { trust: [2, 4], close: [1, 2] } : ch.fit < 0 ? { close: [-1, 0] } : { trust: [0, 2] }, text: ch.ok || react(a, R.back, p) };   // 물러서기: 늘 안전
  const lg = lookGap(a, p);
  if (!teaseOk(s, p, a, 42 + [-8, 0, 10][r] - ch.fit * 10 + lg.need)) {
    const P = [{ trust: [-2, -1], close: [-1, 0] }, { trust: [-6, -3], grudge: [2, 5], close: [-4, -2] }, { trust: [-10, -6], grudge: [5, 9], close: [-6, -3] }][r];
    if (p.personality === 'sharp' && P.grudge) P.grudge = [P.grudge[0] + 2, P.grudge[1] + 3];
    return { ok: false, p: P, effect: { happy: [-1, -2, -3][r] }, do: () => { p.teaseDay = a.today(); }, risk,
      text: (ch.ng || (p.personality === 'sharp' && r === 2 ? T.sayNoSharp : react(a, R.ng, p))) + lookLine(a, 'dirtyNg', lg.key) };
  }
  const gain = Math.round(heatRoll(p, a, ...[[3, 6], [6, 12], [11, 18]][r]) * lg.k), alley = alleyReady(s, p, a, gain), invite = !alley && inviteRoll(s, p, a, r);
  return { ok: true, p: { heart: [[0, 2], [1, 3], [2, 5]][r], close: [1, 2] }, libido: [[1, 3], [3, 6], [5, 9]][r], effect: { happy: [1, 2] }, risk, riskTaken: p.taken ? [.02, .04, .07][r] : 0,
    do: () => { heat(s, p, a, gain, alley); if (invite) p.inviteDay = a.today(); }, scene: alley ? 'alley' : undefined, then: alley ? 'alleyHeat' : invite ? 'takenInvite' : undefined,
    text: () => (ch.ok || react(a, R.ok, p)) + lookLine(a, 'dirtyOk', lg.key) + (p.taken && !invite && Math.random() < .4 ? ' ' + takenLine(a, p, 'taken') : '') + (alley ? ALLEY_LINE : s.vars.heatUp ? T.heatUp : '') };
}
// 스킨십: 살짝(손) 문턱 42 / 보통(허리·어깨) 52 / 과감하게(끌어안기) 62. 섹스 기술 등급마다 문턱 -2·달아오름 +6%, A 이상이면 상대가 손길을 알아봄(신뢰 +1~2, 기술 반응)
function touchChoice(s, p, a, ch) {
  const T = GAME_DATA.teaseLines, R = GAME_DATA.dlgReact.touch, r = ch.risk, sk = a.sexIdx(), lg = lookGap(a, p);
  const pub = s.place && !PRIVATE.includes(s.place), risk = a.main() && a.main() !== p ? (pub ? [.04, .08, .12][r] : .03) : 0;
  if (ch.tone === 'back') return { p: ch.fit > 0 ? { trust: [2, 4], close: [1, 2] } : ch.fit < 0 ? { close: [-1, 0] } : { trust: [0, 2] }, text: ch.ok || react(a, R.back, p) };
  if (!teaseOk(s, p, a, 52 + [-10, 0, 10][r] - ch.fit * 10 - sk * 2 + lg.need)) {
    const P = [{ trust: [-3, -1], close: [-1, 0] }, { trust: [-8, -4], grudge: [3, 6], close: [-4, -2] }, { trust: [-12, -7], grudge: [6, 10], close: [-6, -3] }][r];
    return { ok: false, p: P, karma: r ? -1 : 0, effect: { happy: [-1, -3, -4][r] }, do: () => { p.teaseDay = a.today(); }, risk, text: (ch.ng || react(a, R.ng, p)) + lookLine(a, 'touchNg', lg.key) };
  }
  const gain = Math.round(heatRoll(p, a, ...[[4, 8], [8, 15], [12, 20]][r]) * (1 + sk * .06) * lg.k), alley = alleyReady(s, p, a, gain), invite = !alley && inviteRoll(s, p, a, r);
  const skilled = sk >= 5 ? ((p.nights || 0) >= 1 && Math.random() < .5 ? R.remember : R.skilled) : null;
  const P = { heart: [[1, 3], [2, 5], [3, 7]][r], close: [1, 3] };
  if (skilled) P.trust = [1, 2];
  return { ok: true, p: P, libido: [[2, 4], [4, 8], [6, 10]][r], effect: { happy: [1, 3] }, risk, riskTaken: p.taken ? [.03, .06, .09][r] : 0,
    scene: alley ? 'alley' : r === 2 ? 'hug' : undefined, then: alley ? 'alleyHeat' : invite ? 'takenInvite' : undefined,
    do: () => { heat(s, p, a, gain, alley); if (invite) p.inviteDay = a.today(); },
    text: () => (ch.ok || react(a, R.ok, p)) + (skilled ? ' ' + a.pick(skilled) : '') + lookLine(a, 'touchOk', lg.key) + (p.taken && !invite && Math.random() < .3 ? ' ' + takenLine(a, p, 'taken') : '') + (alley ? ALLEY_LINE : s.vars.heatUp ? T.heatUp : '') };
}

const nightText = (a, p) => lover(p) ? a.pick(GAME_DATA.nightLines.intro) + ' ' + pickLine(a, 'lover', p)
  : a.pick(GAME_DATA.nightLines.flingIntro) + ' ' + (p.taken && Math.random() < .6 ? takenLine(a, p, 'takenMorning') : pickLine(a, 'fling', p));

GAME_DATA.social = [
  // 대화 대사는 data/freshman.js의 pickTalk (함께한 기억 → 날씨·계절 → 교수님·옆집 할머니 → 성격 × 관계 단계)
  //   대사가 캠퍼스 이야기라 1학년 고정 인물(p.tag)과 대학 다니는 동안 만난 또래에게만. 나머지(가족·아이·동료 …)는 예전 한 줄
  //   13살부터는 대화 이벤트(data/dialogues.js) — 장면 하나에 고른 말로 결과 (ch가 있을 때)
  { id: 'talk', label: '대화하기', icon: '💬',
    if: (s, p, a) => s.age >= 3 && !a.jailed(),
    run: (s, p, a, ch) => ch ? talkChoice(s, p, a, ch) : ({ p: { close: [3, 6], trust: [0, 2] },
      text: GAME_DATA.pickTalk && ((p.tag && GAME_DATA.castLabel && GAME_DATA.castLabel[p.tag]) || (s.flags.student && s.age >= 19 && p.kind !== 'family' && p.kind !== 'child' && Math.abs(a.npcAge(p) - s.age) <= 6))
        ? GAME_DATA.pickTalk(s, p, a)
        : ['{p|와} 이런저런 얘기를 나눴다.', '{p|와} 수다를 떨다 시간 가는 줄 몰랐다.', '{p|와} 별것 아닌 일로 한참 웃었다.'] }) },

  { id: 'family', label: '함께 시간 보내기', icon: '🏠',
    if: (s, p, a) => p.kind === 'family' && s.age >= 4 && !a.jailed(),
    run: (s, p, a) => ({ p: { close: [5, 9] }, effect: { happy: [1, 3] }, text: GAME_DATA.familyText[p.role] || GAME_DATA.familyText._sib }) },

  { id: 'hang', label: '같이 놀기', icon: '🎈',
    if: (s, p, a) => s.age >= 4 && notKin(p) && !a.jailed(),
    cost: s => s.age >= 18 ? 10 : 0,
    run: (s, p, a) => {
      const h = a.sharedHobby(p);   // 같은 취미면 그 취미로 놂 (엔진이 효과도 더 줌)
      return { p: { close: [5, 9], heart: [0, 2] }, effect: { happy: [2, 4], charm: [0, 1] },
        text: h ? h.act.map(t => '{p|와} ' + t)
          : s.age < 13 ? ['{p|와} 놀이터에서 해 질 때까지 놀았다.', '{p|와} 딱지치기를 했다.']
          : s.age < 19 ? ['{p|와} 노래방에 갔다.', '{p|와} 떡볶이를 먹으러 갔다.', '{p|와} PC방에서 밤을 새웠다.']
          : ['{p|와} 저녁을 먹었다.', '{p|와} 늦게까지 이야기를 나눴다.', '{p|와} 영화를 봤다.'] };
    } },

  { id: 'listen', label: '고민 들어주기', icon: '👂',
    if: (s, p, a) => s.age >= 10 && p.close >= 30 && p.kind !== 'child' && !a.jailed(),
    run: () => ({ p: { trust: [4, 8], close: [2, 4] }, text: ['{p}의 고민을 끝까지 들어줬다.', '{p|이} 말하기 힘든 이야기를 털어놨다.'] }) },

  { id: 'gift', label: '선물하기', icon: '🎁',
    if: (s, p, a) => s.age >= 6 && !a.jailed(),
    cost: s => s.age >= 18 ? 20 : 0,
    run: s => ({ p: { close: [4, 8], heart: [3, 6] }, effect: { happy: [0, 1] },
      text: s.age < 18 ? ['{p}에게 직접 만든 카드를 줬다.', '{p}에게 아끼던 스티커를 나눠줬다.'] : ['{p}에게 작은 선물을 했다.', '{p|이} 갖고 싶다던 걸 기억해뒀다가 선물했다.'] }) },

  /* ── 연애 (조건은 엔진에서도 한 번 더 확인) ── */
  { id: 'flirt', label: '플러팅', icon: '😉',
    if: (s, p, a) => a.canRomance(p) && !p.partner && !p.spouse && !a.jailed(),
    run: (s, p, a, ch) => {
      if (ch) return flirtChoice(s, p, a, ch);
      const ok = a.charmed(p, null, a.need('flirt'));   // 꼬심 점수: 아는 정도에 따라 외모·매력·관계 가중치가 바뀜
      const risk = a.main() && a.main() !== p ? .2 : 0;
      const g = a.faceGrade(), react = GAME_DATA.faceReact.flirt[g === 'SS' ? 'S' : g];
      const say = s.place === 'bar' ? ['"오늘 재밌었어." ', '"오늘 재밌었어." ', '"너 눈 진짜 예쁘다. 아까부터 계속 보고 있었어." ', '"나 좋아해? 좋아하지?" '][s.drunk || 0] : '';
      return ok
        ? { p: { heart: [8, 14], close: [1, 3] }, risk, riskTaken: p.taken ? .15 : 0,
            text: () => say + (['S', 'SS', 'A', 'B'].includes(g) ? react : a.pick(['{p|이} 내 농담에 오래 웃었다.', '{p|와} 눈이 마주쳤다. 둘 다 먼저 피하지 않았다.', '{p|이} 다음에 또 보자고 했다.'])) }
        : { p: { close: [-3, -1] }, effect: { happy: -2 }, risk, riskTaken: p.taken ? .1 : 0,
            text: () => say + (['D', 'E', 'F'].includes(g) ? react : a.pick(['분위기가 어색해졌다.', '{p|이} 못 들은 척했다.'])) };
    } },

  { id: 'dirtyTalk', label: '섹드립', icon: '😏',
    if: (s, p, a) => a.canSex(p) && p.close >= 15 && !a.jailed(),
    run: (s, p, a, ch) => {
      if (ch) return dirtyChoice(s, p, a, ch);
      const T = GAME_DATA.teaseLines, say = a.pick(T.say[s.gender === 'f' ? 'f' : 'm']) + ' ';
      const risk = a.main() && a.main() !== p ? .05 : 0;
      if (!teaseOk(s, p, a, 42)) return { p: p.personality === 'sharp' ? { trust: [-8, -5], grudge: [5, 9], close: [-5, -3] } : { trust: [-6, -3], grudge: [2, 5], close: [-4, -2] },
        effect: { happy: -2 }, do: () => { p.teaseDay = a.today(); }, risk,
        text: say + (p.personality === 'sharp' ? T.sayNoSharp : a.pick(T.sayNo)) };
      const gain = heatRoll(p, a, 6, 12), alley = alleyReady(s, p, a, gain);
      return { p: { heart: [1, 3], close: [1, 2] }, libido: [3, 6], effect: { happy: [1, 2] }, risk, riskTaken: p.taken ? .04 : 0,
        do: () => heat(s, p, a, gain, alley), scene: alley ? 'alley' : undefined, then: alley ? 'alleyHeat' : undefined,
        text: () => say + (T.sayOk[p.personality] || T.sayOk.warm) + (p.taken && Math.random() < .4 ? ' ' + takenLine(a, p, 'taken') : '') + (alley ? ALLEY_LINE : s.vars.heatUp ? T.heatUp : '') };
    } },

  { id: 'touch', label: '스킨십', icon: '🤝',
    if: (s, p, a) => a.canSex(p) && (lover(p) || p.fwb || p.close >= 30) && !a.jailed(),
    run: (s, p, a, ch) => {
      if (ch) return touchChoice(s, p, a, ch);
      const T = GAME_DATA.teaseLines, lv = lover(p) || p.fwb || p.nights ? 'close' : p.heart >= 40 ? 'mid' : 'light';
      const act = a.pick(T.touch[lv]) + ' ';
      const pub = s.place && s.place !== 'home', risk = a.main() && a.main() !== p ? (pub ? .08 : .03) : 0;
      if (!teaseOk(s, p, a, 52)) return { p: { trust: [-10, -6], grudge: [5, 10], close: [-6, -3] }, karma: -1, effect: { happy: -3 },
        do: () => { p.teaseDay = a.today(); }, risk, text: act + a.pick(T.touchNo) };
      const gain = heatRoll(p, a, 8, 15), alley = alleyReady(s, p, a, gain);
      return { p: { heart: [2, 5], close: [1, 3] }, libido: [4, 8], effect: { happy: [1, 3] }, risk, riskTaken: p.taken ? (pub ? .08 : .03) : 0,
        scene: alley ? 'alley' : lv === 'close' ? 'hug' : undefined, then: alley ? 'alleyHeat' : undefined,
        do: () => heat(s, p, a, gain, alley),
        text: () => act + (T.touchOk[p.personality] || T.touchOk.warm) + (p.taken && Math.random() < .3 ? ' ' + takenLine(a, p, 'taken') : '') + (alley ? ALLEY_LINE : s.vars.heatUp ? T.heatUp : '') };
    } },

  // 잠자리 제안 — 언제 어디서든. 사귀는 사이·섹파는 거절(피곤·싸움·생리)만, 그 외엔 꼬심 점수(외모·매력·성욕) + 상대 상태 문턱
  //   집·모텔이면 바로 그날 밤, 밖이면 동행이 되어 같이 감 (밖이면 골목 키스 카드)
  { id: 'sexAsk', label: '잠자리 제안', icon: '🛏',
    if: (s, p, a) => a.canSex(p) && a.companion() !== p && !a.jailed(),
    run: (s, p, a) => {
      if (lover(p) || p.fwb) { const no = a.refusal(p); if (no) return { ok: false, do: () => { s.vars.why = no; }, then: 'nightRefused' }; }
      else if (!a.charmed(p, 'bed', a.need('bed') + statusNeed(p, a) + (p.close < 20 ? 12 : 0)))
        return { ok: false, p: { heart: [-6, -3], close: [-5, -2], grudge: p.close < 20 ? [4, 8] : [0, 2] }, effect: { happy: -2 },
          text: p.married ? '{p|이} 왼손 반지를 만지작거렸다. "나 결혼한 사람이야."' : p.taken ? `"나 ${mateOf(p)} 있어." {p|이} 선을 그었다.`
            : ['{p|이} 어이없다는 듯 웃었다. "갑자기?"', '{p|이} 고개를 저었다. "우리 그런 사이 아니잖아."'] };
      if (PRIVATE.includes(s.place)) return {
        intimate: true, fling: true, direct: true, spot: s.place, mood: 8, p: { heart: [6, 10], close: [3, 6] }, effect: { happy: [3, 6] },
        memory: !p.nights, pregnant: lover(p) ? .08 : .05, risk: a.main() && a.main() !== p ? .2 : 0, riskTaken: statusRisk(p),
        text: () => nightText(a, p) };
      return { do: () => comeAlong(s, p, a), p: { heart: [2, 4] }, effect: { happy: [1, 3] },
        scene: !ALLEY_NO.includes(s.place) ? 'alley' : undefined,
        text: '"…어디로 갈까?" {p|이} 내 팔짱을 꼈다. (동행 — 모텔이나 집으로 가면 같이 간다)' };
    } },

  { id: 'enjoy', label: '즐기기', icon: '♂♀',
    if: (s, p, a) => a.canSex(p) && a.companion() === p && PRIVATE.includes(s.place) && !a.jailed(),
    cost: s => s.place === 'motel' ? 5 : 0,
    run: (s, p, a) => ({
      intimate: true, fling: true, direct: true, spot: s.place, mood: 12, p: { heart: [6, 10], close: [3, 6] }, effect: { happy: [3, 6] },
      memory: !p.nights, pregnant: lover(p) ? .08 : .05, risk: a.main() && a.main() !== p ? .2 : 0, riskTaken: statusRisk(p),
      text: () => (s.place === 'motel' ? '방 문이 닫히자마자 서로를 끌어당겼다. ' : '') + nightText(a, p) }) },

  // 그저 즐기는 사이 (섹파) 제안 — 애인이 있는 상대도 헤어지지 않은 채로. 외모·매력이 높을수록 잘 받아줌
  { id: 'casualAsk', label: '가볍게 즐기자고 하기', icon: '🔥',
    if: (s, p, a) => a.canSex(p) && !lover(p) && !p.fwb && ((p.nights || 0) >= 1 || a.casualReady(p)) && !a.jailed(),
    run: (s, p, a) => a.charmed(p, 'bed', a.need('bed') + statusNeed(p, a))
      ? { do: () => { p.fwb = true; p.fling = true; comeAlong(s, p, a); }, p: { close: [2, 4] }, effect: { happy: [2, 4] },
          scene: s.place && !PRIVATE.includes(s.place) && !ALLEY_NO.includes(s.place) ? 'alley' : undefined,
          text: (p.taken || p.married ? `"${mateOf(p)}한테는 비밀이야." {p|이} 웃으며 새끼손가락을 걸었다. 서로 즐기기만 하기로 했다.` : '"서로 부담 갖지 말자." {p|이} 웃었다. 즐기기만 하는 사이로 하기로 했다.')
            + (PRIVATE.includes(s.place) ? '' : ' 오늘은 같이 있기로 했다. (동행 — 모텔이나 집으로 가면 같이 간다)') }
      : { p: { heart: [-6, -3], close: [-4, -2] }, effect: { happy: -2 }, text: ['{p|이} 고개를 저었다. "난 그런 거 못 해."', '{p|이} 잠깐 생각하더니 "그건 좀 아닌 것 같아."라고 했다.'] } },

  { id: 'confess', label: '고백하기', icon: '💌',
    if: (s, p, a) => a.canRomance(p) && p.heart >= 40 && !lover(p) && !a.jailed(),
    run: (s, p, a) => {
      const ok = p.heart + p.close / 4 + a.rand(-15, 15) - (p.taken ? 15 : 0) + a.dlgBonus() >= 55;   // 대화 이벤트에서 고른 고백이 잘 맞으면 +
      if (!ok) return { ok: false, p: { heart: [-18, -12], close: [-8, -4] }, effect: { happy: [-8, -4] },
        text: ['{p|이} 미안하다고 했다.', '{p|은} 친구로 지내고 싶다고 했다.'] };
      if (p.taken && !p.married) return { ok: true, then: 'takenConfess' };   // 애인이 있는 상대: 정리할지, 몰래 만날지, 즐기기만 할지
      const sneaky = !!a.main();
      return { ok: true, do: () => a.startRelation(p, sneaky), memory: true, scene: 'kiss', effect: { happy: [6, 10] }, risk: sneaky ? .15 : 0,
        text: sneaky ? '{p|와} 몰래 만나기 시작했다. 아무도 몰라야 한다.'
          : p.taken ? '{p|은} 만나던 사람과 정리하고 내 손을 잡았다.' : '{p|와} 사귀게 됐다!' };
    } },

  { id: 'date', label: '데이트', icon: '💕',
    if: (s, p, a) => lover(p) && s.age >= 19 && !a.jailed(),
    cost: () => 10,
    // 데이트 옷 (HAIR_CLOTHES_BODY 3-7): "뭐 입고 갈까?"에서 고른 옷이 상대 취향이면 설렘 보너스
    run: (s, p, a) => { const dd = a.dateDress(p), base = ['{p|와} 처음 가보는 동네를 걸었다.', '{p|와} 늦게까지 이야기를 나눴다.', '{p|와} 바다를 보러 갔다.', '{p|와} 집에서 영화를 봤다.'];
      return { p: { heart: dd && dd.liked ? [9, 14] : [5, 10], close: [3, 5] }, effect: { happy: dd && dd.liked ? [3, 5] : [2, 4] }, risk: p.secret ? .18 : 0,
        text: dd && dd.liked ? base.map(t => t + ' {p|은} 오늘 옷이 잘 어울린다며 몇 번이나 다시 쳐다봤다.') : base }; } },

  { id: 'propose', label: '청혼하기', icon: '💍',
    if: (s, p, a) => p.partner && p.heart >= 65 && p.trust >= 50 && s.age >= 22 && !a.jailed(),
    run: (s, p, a) => p.heart + p.trust / 2 + a.rand(-10, 10) + a.dlgBonus() >= 95
      ? { ok: true, do: () => a.marry(p), memory: true, scene: 'hug', effect: { happy: 12, money: -1500 }, text: '{p|이} 고개를 끄덕였다. 결혼식을 올렸다!' }
      : { ok: false, p: { heart: -10 }, effect: { happy: -5 }, text: '{p|은} 아직은 아니라고 했다.' } },

  /* ── 술집 ── */
  { id: 'drinkWith', label: '같이 한잔', icon: '🍻',
    if: (s, p, a) => s.place === 'bar' && a.isHere(p) && s.age >= 19 && a.npcAge(p) >= 19 && !a.jailed(),
    cost: () => 20,
    run: (s, p, a) => ({ drunk: 1, p: { close: [4, 7], heart: [1, 4] }, effect: { happy: [2, 4] },
      text: () => [, ['{p|와} 잔을 부딪쳤다. 첫 잔이 목을 타고 내려갔다.', '{p|와} 건배를 했다. 말이 술술 나왔다.'],
        ['{p|와} 볼이 빨개진 얼굴로 서로 웃었다. 말이 점점 대담해졌다.', '{p|이} 내 잔이 비기 무섭게 채워줬다.'],
        ['{p|와} 무슨 얘기를 했는지 기억이 잘 안 난다. 계속 웃었던 것만 기억난다.', '{p|이} "너 취했어"라며 내 볼을 꼬집었다.']][a.drunk()] }) },

  /* ── 친밀한 관계 (집에서만) ── */
  { id: 'intimate', label: '함께 밤을 보내다', icon: '♂♀',
    if: (s, p, a) => adultPair(s, p, a) && lover(p) && p.heart >= 60 && p.trust >= 40 && PRIVATE.includes(s.place) && !a.jailed(),
    run: (s, p, a) => {
      const m = a.main();
      // 사귀는 사이라도 내키지 않을 때가 있음 (피곤함·싸운 뒤·생리 중·잦았을 때 더, 성욕이 높으면 덜) → 내 반응이 신뢰를 가름
      const no = a.refusal(p);
      if (no) return { do: () => { s.vars.why = no; }, then: 'nightRefused' };
      const first = !p.nights;
      return {
        intimate: true,
        p: { heart: [8, 15], close: [5, 10], trust: [3, 6] },
        effect: { happy: [4, 8] },
        memory: first,                                  // 이 사람과 처음 보낸 밤은 추억으로 (날씨와 함께 앨범에)
        pregnant: s.flags.married || p.spouse ? .15 : .08,   // 엔진이 30살부터 확률을 줄이고, 45살부터는 0
        risk: p.secret ? (m && a.isHere(m) ? .6 : .2) : 0,  // 몰래 만나는 사이면 들킬 위험 (배우자가 집에 있으면 훨씬 큼)
        riskTaken: p.married ? .12 : 0,                  // 상대가 기혼이면 상대 배우자에게 들킬 위험
        text: () => a.pick(GAME_DATA.nightLines.intro) + ' ' + pickLine(a, 'lover', p),
      };
    } },

  { id: 'onenight', label: '하룻밤', icon: '♂♀',
    if: (s, p, a) => adultPair(s, p, a) && !lover(p) && PRIVATE.includes(s.place) && !a.jailed()
      && ((p.close >= 40 && (p.heart >= 50 || (p.fwb && p.heart >= 25))) || (p.fwb && p.close >= 20) || a.casualReady(p)),   // 설렘 없이도: 섹파, 또는 나를 향한 성욕이 찬 상대
    run: (s, p, a) => {
      if (!p.fwb && !a.charmed(p, 'bed', a.need('bed')))
        return { p: { heart: [-3, -1] }, effect: { happy: -2 }, text: a.pick(['{p|이} 웃으며 고개를 저었다. "오늘은 여기까지."', '{p|이} 잠깐 망설이더니 택시를 불렀다.']) };
      const no = a.refusal(p);
      if (no) return { do: () => { s.vars.why = no; }, then: 'nightRefused' };
      const risk = a.main() ? .25 : 0;     // 애인이 있으면 들킬 위험
      const theirRisk = p.taken ? .2 : 0;  // 상대에게 애인이 있으면 그쪽도 위험
      return {
        intimate: true, fling: true,       // 관계가 '썸' 또는 '복잡한 사이'로
        p: { heart: [10, 18], close: [4, 8] },
        effect: { happy: [3, 6] },
        memory: !p.nights,
        pregnant: .05,
        risk, riskTaken: theirRisk,
        text: () => a.pick(GAME_DATA.nightLines.flingIntro) + ' ' + (p.taken && Math.random() < .6 ? takenLine(a, p, 'takenMorning') : pickLine(a, 'fling', p)),   // 애인 있는 상대는 헤어지지 않은 채
      };
    } },

  // 야한 문자 — 사귀는 사이·섹파·몰래 만나는 사이, 설렘 40·신뢰 30 이상. 상대 성욕 +10~20, 내 성욕 +5~10, 다음 밤 만족감 보너스
  // 만취(술집)면 15% 확률로 엉뚱한 사람에게 감 (wrongText)
  { id: 'sexyText', label: '야한 문자 보내기', icon: '📱',
    if: (s, p, a) => a.canSex(p) && (lover(p) || p.fwb) && p.heart >= 40 && p.trust >= 30 && !a.jailed(),
    run: (s, p, a) => a.drunk() >= 3 && Math.random() < .15 ? { then: 'wrongText', text: '취한 손가락으로 메시지를 보냈다. 전송 완료.' } : {
      p: { heart: [3, 6] }, libido: [5, 10],
      do: () => { p.libido = Math.min(100, (p.libido || 0) + a.rand(10, 20)); p.texted = true; },
      text: ({ bold: '{p|이} 즉시 답장했다. "지금 갈까?"', shy: '{p|이} 5분 뒤에 답했다. 이모티콘만 다섯 개.', playful: '{p|이} 더 야한 사진으로 답장했다.',
        cool: '{p}의 답장은 "ㅋ" 한 글자. 하지만 읽자마자 답했다.', warm: '{p}에게서 답장이 왔다. "보고 싶어… 빨리 만나자."', sharp: '{p}의 답장. "지금 회사인데? …저녁에 봐."',
        sunny: '{p}에게서 답장이 왔다. "ㅋㅋㅋㅋ 미쳤어!!! 근데 나도 💕"', sensitive: '{p}에게서 한참 뒤에 답장이 왔다. "…나도 생각하고 있었어."' })[p.personality] || '{p}에게서 답장이 왔다.',
    } },

  { id: 'takeHome', label: '집으로 데려가기', icon: '🏠', noFree: true,
    if: (s, p, a) => ['bar', 'concert'].includes(s.place) && a.isHere(p) && !s.flags.married && adultPair(s, p, a) && ((p.heart >= 45 && p.close >= 30) || p.fwb || a.casualReady(p)) && !a.jailed(),
    run: (s, p, a) => a.charmed(p, 'bed', a.need('takeHome')) ? {
      moveTo: 'home', bring: true, scene: 'pull', p: { heart: [2, 4] },
      risk: a.main() && a.main() !== p ? .1 : 0,
      text: !s.flags.ownPlace ? '부모님이 주무시는 걸 확인하고 {p|와} 조용히 현관문을 열었다.'
        : ['택시 창밖으로 불빛이 길게 번졌다. {p|와} 우리 집 앞에서 내렸다.', '{p|와} 말없이 걸었다. 어느새 우리 집 골목이었다.'],
    } : { p: { heart: [-2, 0] }, text: ['{p|이} 택시를 잡아주고 혼자 돌아섰다.', '"다음에." {p|이} 웃으며 손을 흔들었다.'] } },

  { id: 'breakup', label: '헤어지기', icon: '💔',
    if: (s, p, a) => (p.partner || p.secret) && !a.jailed(),
    run: (s, p, a) => ({ do: () => a.breakUp(p, 20), memory: true, effect: { happy: [-6, -3] }, text: '{p|와} 헤어졌다.' }) },

  { id: 'divorce', label: '이혼하기', icon: '📄',
    if: (s, p, a) => p.spouse && !a.jailed(),
    run: (s, p, a) => ({ do: () => a.divorce(p), memory: true, effect: { happy: -8 }, text: '{p|와} 이혼했다. 재산을 반으로 나눴다.' }) },

  /* ── 갈등 ── */
  { id: 'argue', label: '다투기', icon: '💢',
    if: (s, p, a) => s.age >= 6 && !a.jailed(),
    run: () => ({ fight: true, p: { grudge: [12, 20], close: [-12, -8], trust: [-4, -2] }, effect: { happy: [0, 2] }, karma: -2,
      text: ['{p|와} 크게 다퉜다.', '{p}에게 해서는 안 될 말을 했다.', '{p|와} 언성을 높였다.'] }) },

  { id: 'apologize', label: '사과하기', icon: '🙇',
    if: (s, p, a) => p.grudge >= 10 && !a.jailed(),
    run: (s, p, a) => p.trust + a.rand(-20, 20) + a.dlgBonus() >= 30
      ? { ok: true, p: { grudge: [-20, -12], close: [2, 4] }, karma: 2, text: '{p}에게 진심으로 사과했다. 조금은 풀린 눈치다.' }
      : { ok: false, p: { grudge: [-5, -2] }, text: '{p|은} 아직 화가 덜 풀렸다.' } },

  /* ── 돈 ── */
  { id: 'borrow', label: '돈 빌리기', icon: '💸',
    if: (s, p, a) => s.age >= 19 && p.close >= 50 && !p.debt && p.kind !== 'child' && !a.jailed(),
    run: (s, p, a) => { const amt = a.rand(5, 30) * 10;
      return { effect: { money: amt }, do: () => { p.debt = amt; }, p: { trust: [-8, -4] }, text: `{p}에게 ${a.money(amt)}을 빌렸다.` }; } },

  { id: 'repay', label: '빚 갚기', icon: '🧾',
    if: (s, p) => p.debt > 0 && s.money >= p.debt,
    run: (s, p) => ({ effect: { money: -p.debt }, do: () => { p.debt = 0; }, p: { trust: [6, 10] }, text: '{p}에게 빌린 돈을 갚았다.' }) },

  /* ── 가족 ── */
  { id: 'allowance', label: '용돈 조르기', icon: '🪙',
    if: (s, p, a) => p.kind === 'family' && s.age >= 6 && s.age <= 18 && !a.jailed(),
    run: () => ({ effect: { money: [1, 5] }, p: { close: [-2, 0] }, text: ['{p|이} 못 이기는 척 용돈을 줬다.', '{p|이} 이번 한 번만이라며 지갑을 열었다.'] }) },

  { id: 'filial', label: '효도하기', icon: '🧧',
    if: (s, p, a) => p.kind === 'family' && s.age >= 25 && !a.jailed(),
    cost: () => 50,
    run: () => ({ p: { close: [6, 10], trust: [2, 4] }, effect: { happy: [2, 4] }, text: ['{p}에게 용돈을 드렸다. 괜히 쑥스러웠다.', '{p|와} 근사한 식당에 갔다.'] }) },

  { id: 'play', label: '놀아주기', icon: '🧸',
    if: (s, p, a) => p.kind === 'child' && a.npcAge(p) <= 15 && !a.jailed(),
    run: () => ({ p: { close: [6, 10] }, effect: { happy: [3, 5] }, text: ['{p|와} 놀이터에 갔다.', '{p|이} 그린 그림을 냉장고에 붙였다.', '{p|와} 같이 숙제를 했다.'] }) },

  /* ── 수감 중 ── */
  { id: 'letter', label: '편지 쓰기', icon: '✉️',
    if: (s, p, a) => a.jailed(),
    run: () => ({ p: { close: [4, 7], trust: [1, 3] }, text: '{p}에게 긴 편지를 썼다.' }) },

  { id: 'cutoff', label: '연락 끊기', icon: '✂️',
    if: (s, p, a) => notKin(p) && !p.spouse && !a.jailed(),
    run: (s, p, a) => ({ do: () => { if (p.partner || p.secret) a.breakUp(p, 10); p.gone = true; }, text: '{p|와} 연락을 끊었다.' }) },
];
})();
