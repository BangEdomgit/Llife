// Llife 대학 1학년 슬라이스 — 사람·대화·추억
// 넣는 위치: data/freshman.js, index.html에서 data/events.js와 data/social.js "다음"에 불러올 것
//
// 들어있는 것
//   1. 대화 대사      GAME_DATA.talkLines (성격 8 × 관계 단계 7), talkContext (날씨·시간·계절), talkMemory (함께한 기억을 꺼내는 말)
//   2. 대화 고르기    GAME_DATA.pickTalk(s, p, a) → social.js의 '대화하기'에서 이 함수 결과를 text로 쓰면 됨
//   3. 기억 라벨      GAME_DATA.memLabel (1년 회고에 쓰는 짧은 이름)
//   4. 1학년 이벤트   봄 → 여름 → 가을 → 겨울 순서, 고정 인물 10명과의 이야기 + 다음 해에 돌아오는 후속 이벤트
//
// 사람마다 기억이 쌓임: p.mem = [{ tag, age, wx, place }]  (rem() 도우미가 넣어줌)
// 고정 인물은 p.tag로 구분: dongi1 dongi2 dongi3 crush sunbae1 sunbae2 prof halmeoni barista clerk
// 성적 요소 없음 — 1학년(19세) 구간이라 연애는 고백·사귐·손잡기까지만
window.GAME_DATA = window.GAME_DATA || {};

(function () {
const D = GAME_DATA;

/* ═════════ 도우미 ═════════ */
const fresh = s => !!(s.flags.student && s.school && s.school.start != null && s.age === s.school.start);
const after1 = s => !!(s.school && s.school.start != null && s.age > s.school.start);
const byTag = (a, t) => a.find(p => p.tag === t)[0];
const has = (a, t) => !!byTag(a, t);
const opp = s => (s.gender === 'm' ? 'f' : 'm');
const same = s => s.gender;
const mates = s => [s.age, s.age];
// 고정 인물 만들기 (이미 있으면 그 사람)
function cast(a, t, spec) {
  let p = byTag(a, t);
  if (!p) { p = a.meet(spec); if (p) p.tag = t; }
  return p;
}
const focusT = t => (s, a) => a.focus(byTag(a, t));
// 기억 남기기: 지금 초점 맞춘 사람(또는 tag로 지정한 사람)에게
function rem(t, who) {
  return (s, a) => {
    const p = who ? byTag(a, who) : a.focused();
    if (!p) return;
    (p.mem = p.mem || []).push({ tag: t, age: s.age, wx: s.weather, place: s.place });
  };
}
const remembers = (p, t) => !!(p && p.mem && p.mem.some(m => m.tag === t));
const memWho = (a, ...tags) => a.find(p => tags.some(t => remembers(p, t)))[0];
const all = (...fns) => (s, a) => fns.forEach(f => f && f(s, a));
const wet = s => ['rain', 'storm', 'sleet'].includes(s.weather);
const mom = a => a.find(p => p.role === '엄마')[0];
const nm = p => (p ? (p.name || p.role) : '');
const SEASON_IDS = ['봄', '여름', '가을', '겨울'];
const seasonOf = s => SEASON_IDS[Math.max(0, s.seasonIdx || 0) % 4];

/* ═════════ 1. 대화 대사 (성격 × 관계 단계) ═════════ */
// 단계: stranger(친밀 0~19) acq(20~44) friend(45~69) best(70+) crush(설렘 45+, 안 사귐) lover(연인·배우자) sour(원한 30+)
// {p}는 상대 이름. 조사는 {p|이} {p|은} {p|을} {p|와} {p|이랑}
D.talkLines = {
  bold: {
    stranger: ['{p|이} "너 같은 과지? 앞으로 자주 보자." 하고 먼저 손을 내밀었다.',
               '{p|이} 대뜸 "아까 수업에서 질문한 사람 너 맞지?" 하고 말을 걸었다.'],
    acq:      ['{p|이} "이따 점심 같이 먹어. 맛집 찾아놨어." 하고 말했다. 묻는 게 아니라 통보였다.',
               '"주말에 뭐 해? 안 하면 나랑 놀자." {p}다운 말이었다.'],
    friend:   ['{p|이} 내 어깨를 툭 치며 "너 요즘 표정 왜 그래. 말해봐." 하고 말했다.',
               '{p|와} 학교 앞 분식집에서 떡볶이 2인분을 3인분처럼 먹었다.'],
    best:     ['"너 없었으면 이 학교 못 다녔다." {p|이} 아무렇지 않게 말했다. 귀가 조금 빨개져 있었다.',
               '{p|이} 내 휴대폰을 뺏어 들더니 자기 번호를 즐겨찾기 1번에 저장했다.'],
    crush:    ['{p|이} 내 눈을 똑바로 보며 "너랑 있으면 시간이 빨리 가." 하고 말했다.',
               '"다음 주 토요일 비워 둬." {p|은} 이유를 말해주지 않았다.'],
    lover:    ['{p|이} 걸어가다 말고 내 손을 잡아끌었다. "느려. 빨리 와."',
               '"오늘 어땠어? 하나도 빼지 말고 말해." {p|이} 턱을 괴고 기다렸다.'],
    sour:     ['{p|이} 나를 보더니 대놓고 한숨을 쉬었다. "할 말 있으면 해."',
               '"우리 그 얘기 아직 안 끝났어." {p}의 목소리가 딱딱했다.'],
  },
  shy: {
    stranger: ['{p|이} 눈이 마주치자 황급히 고개를 숙였다. 인사는 한 박자 늦게 왔다.',
               '"저… 이거 떨어뜨리셨어요." {p|이} 내 볼펜을 내밀고 바로 자리로 돌아갔다.'],
    acq:      ['{p|이} 작은 목소리로 "지난번에… 고마웠어." 하고 말했다. 뭘 말하는 건지 한참 생각해야 했다.',
               '{p|와} 같은 수업 뒷자리에 앉았다. 말은 별로 안 했는데 이상하게 편했다.'],
    friend:   ['{p|이} 가방에서 내가 지나가듯 좋아한다고 말했던 과자를 꺼냈다.',
               '"나 원래 이런 얘기 잘 안 하는데…" {p|이} 조심스럽게 고민을 꺼냈다.'],
    best:     ['{p|은} 내 앞에서만 말이 많아진다. 다른 사람들은 모르는 얼굴이다.',
               '"너한테만 말하는 거야." {p|이} 새끼손가락을 내밀었다.'],
    crush:    ['{p|이} 말을 하다가 내 눈을 보고는 하려던 말을 잃어버렸다.',
               '{p}에게서 메시지가 왔다가 지워졌다. 곧 "아무것도 아니야"가 다시 왔다.'],
    lover:    ['{p|은} 사람 많은 데서는 손을 못 잡는다. 대신 내 소매 끝을 살짝 쥐었다.',
               '"보고 싶었어." {p|이} 아주 작게 말하고 내 어깨에 얼굴을 묻었다.'],
    sour:     ['{p|이} 나를 보자 자리를 옮겼다. 싸운 것보다 그게 더 아팠다.',
               '{p}에게 보낸 메시지의 1이 하루 종일 지워지지 않았다.'],
  },
  playful: {
    stranger: ['{p|이} 내 이름을 듣더니 "이름 멋있다. 나랑 바꿀래?" 하고 웃었다.',
               '처음 보는 {p|이} 내 우유에 빨대를 꽂아주고 사라졌다. 뭐지.'],
    acq:      ['{p|이} 강의실 맨 뒤에서 종이비행기를 날렸다. 정확히 내 머리에 꽂혔다.',
               '"퀴즈. 오늘 학식 메뉴는?" {p|은} 내가 틀릴 때마다 꿀밤을 때렸다.'],
    friend:   ['{p|이} 내 프로필 사진을 몰래 바꿔놨다. 하필 제일 못 나온 사진으로.',
               '{p|와} 편의점 신상 과자 품평회를 했다. 둘 다 만점만 줬다.'],
    best:     ['{p|은} 내 흑역사를 열두 개쯤 외우고 있다. 그래도 남한테는 하나도 안 말한다.',
               '"우리 할머니 할아버지 돼서도 이러고 있을 듯." {p|이} 낄낄거렸다.'],
    crush:    ['{p}의 장난이 요즘 이상하게 나한테만 몰린다.',
               '"너 나 좋아하지? 농담이야." {p|이} 웃었다. 농담치고 눈이 진지했다.'],
    lover:    ['{p|이} 내 볼을 꼬집고는 "내 거라서 꼬집는 거야." 하고 말했다.',
               '{p|은} 카페 진동벨이 울리자 "운명의 종소리네" 하며 혼자 웃었다.'],
    sour:     ['{p|이} 농담을 던졌다. 하나도 안 웃겼다. {p}도 웃지 않았다.',
               '"아 그래? 몰랐네~" {p}의 말투에 가시가 있었다.'],
  },
  cool: {
    stranger: ['{p|은} 고개만 까딱하고 이어폰을 다시 꼈다.',
               '"…응." {p}의 대답은 그게 전부였다.'],
    acq:      ['{p|이} 말없이 내 자리에 프린트 한 장을 놓고 갔다. 결석한 날 나눠준 거였다.',
               '"그거 틀렸어." {p|이} 내 노트를 손가락으로 짚고 지나갔다. 진짜 틀려 있었다.'],
    friend:   ['{p|이} "추워 보여서" 하며 핫팩을 던졌다. 자기 건 없었다.',
               '{p|와} 한 시간 동안 다섯 마디 했다. 그래도 좋은 시간이었다.'],
    best:     ['{p|은} 내 생일을 한 번도 안 까먹었다. 축하 메시지는 늘 "ㅊㅋ" 두 글자다.',
               '"힘들면 말해. 안 물어볼 테니까." {p|은} 그렇게만 말했다.'],
    crush:    ['{p|은} 나만 보면 표정 관리가 안 된다. 본인만 모른다.',
               '"딱히 너 기다린 거 아니야." {p}의 커피는 다 식어 있었다.'],
    lover:    ['{p|이} 무심하게 내 목도리를 다시 감아줬다. "똑바로 하고 다녀."',
               '{p|은} 사랑한다는 말 대신 내 휴대폰을 충전해 놓는다.'],
    sour:     ['{p|은} 원래 말이 없는데, 요즘은 그 침묵이 차갑다.',
               '"됐어." {p}의 한마디에 대화가 끝났다.'],
  },
  warm: {
    stranger: ['{p|이} "처음이지? 나도 그래. 같이 다니자." 하고 웃었다. 금방 긴장이 풀렸다.',
               '{p|이} 길을 헤매던 나를 강의실 앞까지 데려다줬다.'],
    acq:      ['"밥은 먹었어?" {p|은} 만날 때마다 이것부터 묻는다.',
               '{p|이} 내 감기 기운을 먼저 알아채고 목캔디를 쥐여줬다.'],
    friend:   ['{p|이} 시험 전날 "너 이 부분 약하잖아" 하며 정리한 노트를 보내줬다.',
               '{p|와} 늦게까지 통화했다. 끊을 때 {p|이} "얘기해줘서 고마워" 하고 말했다.'],
    best:     ['{p|은} 내가 말하기 전에 이미 알고 있다. 가끔은 무섭고 대부분은 고맙다.',
               '"네가 잘되면 나 진짜 울 거야." {p|이} 진심으로 말했다.'],
    crush:    ['{p|이} 내 머리에 붙은 꽃잎을 떼어주다가 손을 멈췄다.',
               '"너 웃을 때 좋다." {p|이} 말해놓고 자기가 더 당황했다.'],
    lover:    ['{p|이} 내 가방에 쪽지를 넣어놨다. "오늘도 수고했어."',
               '{p|이} 내 손을 자기 주머니에 같이 넣었다. 거기가 제일 따뜻했다.'],
    sour:     ['{p|이} "괜찮아" 하고 말했다. 하나도 안 괜찮은 얼굴이었다.',
               '{p|은} 여전히 내 몫의 커피를 샀다. 다만 말없이 놓고 갔다.'],
  },
  sharp: {
    stranger: ['{p|이} 나를 한번 훑어보더니 "전공 이거 맞게 온 거야?" 하고 물었다.',
               '"질문할 거면 요점만." {p|이} 시계를 봤다.'],
    acq:      ['{p|이} 내 과제를 보더니 "논리가 여기서 끊겨" 하고 정확히 짚었다.',
               '{p|이} 조모임 무임승차한 애를 한마디로 정리했다. 속이 시원했다.'],
    friend:   ['"너 그 사람한테 너무 맞춰줘." {p|은} 늘 듣기 싫은 말을 해준다. 대부분 맞다.',
               '{p|와} 토론하다 둘 다 언성이 높아졌다. 끝나고 같이 라면을 먹었다.'],
    best:     ['{p|은} 나한테만 틀렸다고 말해준다. 그게 {p}식 애정이다.',
               '"칭찬은 안 해. 근데 네 편은 해." {p|이} 말했다.'],
    crush:    ['"솔직히 말할게. 너랑 있는 거 좋아." {p}에게는 돌려 말하는 법이 없다.',
               '{p|은} 내 얘기를 들을 때만 휴대폰을 엎어둔다.'],
    lover:    ['"미안, 내가 틀렸어." {p|이} 그 말을 하는 상대는 나뿐이다.',
               '{p|은} 내 일정을 나보다 더 잘 안다. 잔소리와 함께.'],
    sour:     ['"네가 뭘 잘못했는지는 알아?" {p}의 눈이 차가웠다.',
               '{p|이} 내 말을 끝까지 듣지도 않고 반박했다.'],
  },
  sunny: {
    stranger: ['"안녕! 너도 신입생이야? 반가워!" {p}의 목소리에 주변이 다 돌아봤다.',
               '{p|이} 처음 보는 나한테 젤리를 반 나눠줬다.'],
    acq:      ['{p|이} 멀리서 내 이름을 부르며 두 팔을 흔들었다. 조금 창피했고 많이 좋았다.',
               '"오늘 날씨 최고다! 그치?" {p|은} 비 오는 날에도 그렇게 말한다.'],
    friend:   ['{p|와} 이유 없이 학교를 한 바퀴 돌았다. {p|이} 계속 노래를 흥얼거렸다.',
               '시험 망친 날, {p|이} "괜찮아, 우린 아직 젊어!" 하며 아이스크림을 사줬다.'],
    best:     ['{p|이} 웃으면 나도 따라 웃게 된다. 진짜 힘든 날에도.',
               '"너는 내 인생 최고의 뽑기야!" {p|이} 소리쳤다.'],
    crush:    ['{p|은} 나만 보면 더 크게 웃는다. 착각이 아니길 바랐다.',
               '"이거 너 주려고 샀어! 그냥!" {p|이} 키링을 내밀었다. 자기 가방에도 똑같은 게 달려 있었다.'],
    lover:    ['{p|은} 매일 아침 "좋은 아침!" 메시지에 이모티콘을 세 개씩 붙인다.',
               '"우리 백일까지 며칠 남았게?" {p|은} 이미 달력에 하트를 그려놨다.'],
    sour:     ['{p|이} 웃는데 눈이 안 웃었다. 처음 보는 얼굴이었다.',
               '"응, 나 괜찮아!" {p}의 목소리가 너무 밝아서 오히려 불안했다.'],
  },
  sensitive: {
    stranger: ['{p|이} 눈치를 살피며 조심스럽게 물었다. "혹시… 여기 자리 있어요?"',
               '{p}의 손이 조금 떨리고 있었다. 나만큼 긴장한 것 같았다.'],
    acq:      ['"너 오늘 좀 피곤해 보여." {p|은} 작은 변화도 금방 알아챈다.',
               '{p|이} 내가 추천한 노래를 하루 종일 들었다고 했다.'],
    friend:   ['{p|이} 내 얘기를 듣다가 나보다 먼저 울었다.',
               '"요즘 나 좀 이상하지?" {p|이} 조용히 물었다. 한참을 같이 걸었다.'],
    best:     ['{p|은} 내 목소리만 듣고도 무슨 일이 있는지 안다.',
               '"네가 있어서 버텼어." {p}의 말이 오래 남았다.'],
    crush:    ['{p}의 표정이 내가 다른 사람이랑 웃는 걸 보고 흐려졌다.',
               '"나한테 너는… 좀 특별해." {p|이} 말하고 고개를 돌렸다.'],
    lover:    ['{p|은} 자기 전에 꼭 "오늘 나 때문에 속상한 거 없었어?" 하고 묻는다.',
               '{p|이} 내 손금을 따라 그리며 "여기 나도 있어?" 하고 물었다.'],
    sour:     ['{p|은} 아무 말도 안 했다. 대신 눈가가 빨갰다.',
               '{p}의 SNS에 슬픈 노래 한 곡이 올라왔다. 나 때문인 것 같았다.'],
  },
};

/* 상황 대사 — 날씨·시간·계절이 맞으면 가끔 섞어 씀 */
D.talkContext = {
  rain:   ['{p|와} 처마 밑에서 비가 그치길 기다렸다. 생각보다 오래 걸렸고, 생각보다 좋았다.',
           '"우산 없어? 같이 쓰자." {p}의 우산이 내 쪽으로 기울어 있었다.',
           '{p|이} 빗소리를 들으며 "이런 날은 전 부쳐 먹어야 하는데" 하고 말했다.'],
  snow:   ['{p|이} 첫눈이라며 사진을 찍어 보냈다. 같은 하늘인데.',
           '{p|와} 눈 쌓인 운동장에 발자국으로 이름을 썼다.',
           '"눈 오면 다 예뻐 보이지 않아?" {p|이} 말했다.'],
  night:  ['늦은 밤 {p|와} 편의점 앞 파라솔에 앉아 컵라면을 먹었다.',
           '{p|이} "이 시간에 깨어 있는 사람 우리밖에 없을걸" 하고 말했다.',
           '{p|와} 불 꺼진 캠퍼스를 걸었다. 낮이랑은 다른 학교 같았다.'],
  봄:     ['{p|와} 벚꽃길을 걸었다. {p|이} 떨어지는 꽃잎을 잡으면 소원이 이뤄진다며 뛰어다녔다.',
           '"봄이라 그런가, 다 설레." {p|이} 기지개를 켰다.'],
  여름:   ['{p|와} 에어컨 나오는 도서관에서 공부하는 척 낮잠을 잤다.',
           '{p|이} 아이스크림 두 개를 사 와서 "녹기 전에 빨리!" 하고 내밀었다.'],
  가을:   ['{p|와} 은행잎을 밟으며 걷다가 냄새 때문에 같이 도망쳤다.',
           '"가을 타나 봐." {p|이} 괜히 하늘을 봤다.'],
  겨울:   ['{p|이} 붕어빵 봉지를 내밀었다. 머리부터 먹는 사람이었다.',
           '{p|와} 누가 입김을 더 길게 부는지 내기했다.'],
};

/* 기억 대사 — 이 사람이 나와의 기억(tag)을 갖고 있으면 대화 중에 꺼냄 */
D.talkMemory = {
  ot_funny:        ['"너 OT 때 자기소개 아직도 과에서 회자돼." {p|이} 웃었다.'],
  ot_silence:      ['{p|이} "OT 때 그 정적, 나 평생 못 잊어" 하며 놀렸다.'],
  sugang_pcbang:   ['"수강신청 때 PC방 기억나? 우리 손 떨던 거." {p|이} 웃었다.'],
  sugang_fail:     ['"1교시 동지." {p|이} 졸린 눈으로 하이파이브를 했다.'],
  sat_next:        ['"첫 수업 때 네가 옆에 앉아줘서 살았어." {p|이} 지금도 그 얘기를 한다.'],
  carried_home:    ['"환영회 날 너 업고 계단 올라간 거, 아직도 허리 아파." {p|이} 생색을 냈다.',
                    '{p|은} 술자리만 가면 "오늘은 걸어서 가는 거다?" 하고 다짐을 받는다.'],
  cider:           ['{p|이} 술자리에서 내 잔에 슬쩍 사이다를 따라줬다. 기억하고 있었다.'],
  umbrella_lent:   ['"그때 우산 빌려준 거, 나 진짜 감동이었어." {p|이} 뜬금없이 말했다.'],
  umbrella_shared: ['비 오는 날이면 {p|은} 우산을 하나만 들고 나타난다. 일부러인 것 같다.'],
  project_carry:   ['"조별과제 때 너 아니었으면 우리 둘 다 F였어." {p|은} 아직도 고마워한다.'],
  all_nighter:     ['"도서관 밤샘 또 해야 하나…" {p|이} 그날 생각에 몸서리를 쳤다.'],
  helped_bags:     ['"학생 덕분에 요즘 장 보러 갈 맛이 나." {p|이} 귤을 한 움큼 쥐여줬다.'],
  cafe_iced:       ['"아아 연하게, 맞죠?" {p|이} 주문도 하기 전에 컵을 꺼냈다.'],
  free_onigiri:    ['{p|이} 계산대 밑에서 유통기한 임박 김밥을 꺼내며 눈짓을 했다.'],
  beach_walk:      ['"그 바다, 또 가고 싶다." {p|이} 창밖을 보며 말했다.',
                    '{p}의 휴대폰 배경화면이 그날 밤바다였다.'],
  beach_fireworks: ['"폭죽 거꾸로 들었던 거 기억나?" {p|이} 배를 잡고 웃었다.'],
  dodgeball_hero:  ['"피구 영웅 오셨다!" {p|이} 과방에서 박수를 쳤다.'],
  dodgeball_face:  ['{p|은} 피구공만 보면 내 얼굴을 보고 웃는다.'],
  mt_said_name:    ['"MT 때 진실게임, 그거 진심이었어?" {p|이} 장난처럼 물었다. 눈은 안 웃고 있었다.'],
  first_meal:      ['"우리 처음 둘이 밥 먹은 데가 저기잖아." {p|이} 지나가며 말했다.'],
  confess_yes:     ['"그날 고백할 때 너 목소리 떨렸던 거 알아?" {p|이} 놀렸다.'],
  talked_it_out:   ['{p|이} "그때 솔직하게 말해줘서 우리가 아직 친구인 거야" 하고 말했다.'],
  reconciled:      ['{p|이} "그때 먼저 연락해줘서 고마웠어" 하고 말했다. 1년 만에.'],
  sunbae_listen:   ['"그때 네가 들어줘서 결정할 수 있었어." {p|이} 또 밥값을 냈다.'],
  watermelon:      ['"그 수박 참 달았어." {p|은} 여름만 되면 그 얘기를 한다.'],
  leak_help:       ['"너네 집 천장 아직 괜찮냐?" {p|이} 안부처럼 물었다.'],
  first_snow_text: ['"첫눈 오면 너한테 먼저 연락하는 거, 이제 국룰이야." {p|이} 말했다.'],
  hometown_pc:     ['"고향 오면 PC방, 알지?" {p|이} 메시지를 보냈다.'],
  cheer_retake:    ['"그때 네가 응원해줘서 버텼어." {p|이} 말했다.'],
  club_effort:     ['"너 그때 2주 동안 매일 남았던 거, 다들 알아." {p|이} 지나가듯 말했다.'],
  lent_notes:      ['"그 교양 수업 필기, 아직 내 사진첩에 있어." {p|이} 웃었다.'],
  exam_food:       ['"식혜는 잘 먹었어?" {p|이} 물으셨다. 빈 병을 씻어서 돌려드렸다.'],
};

/* 기억 라벨 — 1년 회고, 앨범 요약에 씀 */
D.memLabel = {
  ot_funny: 'OT 자기소개', ot_silence: 'OT의 정적', sugang_pcbang: 'PC방 수강신청', sugang_fail: '1교시 폭탄 시간표',
  sat_next: '첫 수업 옆자리', carried_home: '환영회 날 업혀 간 밤', cider: '술자리의 사이다', umbrella_lent: '비 오는 날 빌려준 우산',
  umbrella_shared: '같이 쓴 우산', project_carry: '둘이서 끝낸 조별과제', project_callout: '단톡방 사건', all_nighter: '도서관 밤샘',
  helped_bags: '장바구니', cafe_iced: '늘 먹던 아아', free_onigiri: '새벽의 삼각김밥', beach_walk: '여름 밤바다 산책',
  beach_fireworks: '거꾸로 든 폭죽', dodgeball_hero: '피구 마지막 1인', dodgeball_face: '얼굴로 받은 피구공', mt_said_name: 'MT 진실게임',
  first_meal: '처음 둘이 먹은 밥', confess_yes: '가을 고백', confess_no: '전하지 못한 마음', talked_it_out: '솔직했던 밤',
  fight_money: '돈 때문에 생긴 금', reconciled: '먼저 건넨 사과', drifted: '멀어진 겨울', sunbae_listen: '선배의 고민',
  watermelon: '한여름 수박', leak_help: '물 새던 자취방', first_snow_text: '첫눈 메시지', hometown_pc: '고향 PC방',
  cheer_retake: '반수 응원', welcome_fun: '신입생 환영회', fest_bar: '축제 주점', fest_concert: '축제 공연', jonggang1: '1학기 종강파티',
  xmas_together: '크리스마스', yearend: '12월 31일 카운트다운', club_effort: '2주 동안의 연습', lent_notes: '빌려준 필기',
  retake_pass: '반수 합격 전화', retake_fail: '"2학년 같이 다니자"', exam_food: '현관 앞 식혜', lab_yes: '교수님 연구실', usual_order: '"늘 드시던 걸로요?"',
};

/* 기억의 무게 — 회고에서 한 사람당 하나만 고를 때 무거운 것부터 */
D.memWeight = {
  confess_yes: 10, beach_walk: 9, carried_home: 8, umbrella_lent: 8, reconciled: 8, umbrella_shared: 7, mt_said_name: 7,
  project_carry: 7, sunbae_listen: 7, watermelon: 6, retake_pass: 6, retake_fail: 6, leak_help: 6, first_meal: 6,
  confess_no: 6, talked_it_out: 6, dodgeball_hero: 5, dodgeball_face: 5, cider: 5, all_nighter: 5, lab_yes: 5,
  sat_next: 5, ot_silence: 4, ot_funny: 4, first_snow_text: 4, club_effort: 4, fest_concert: 4, beach_fireworks: 4,
  xmas_together: 3, yearend: 2, jonggang1: 2, fest_bar: 3, helped_bags: 4, free_onigiri: 3, cafe_iced: 2,
};

/* 역할별 대사 — 또래가 아닌 사람 (성격 대사 대신 이걸 씀) */
D.talkRole = {
  '교수님': {
    stranger: ['{p|이} 출석부에서 고개를 들고 내 이름을 한 번 불러봤다. 외우려는 것 같았다.',
               '복도에서 마주친 {p|이} 짧게 목례만 하고 지나갔다.'],
    acq:      ['{p|이} "질문은 수업 끝나고 해도 됩니다" 하더니, 정말로 30분을 남아서 답해줬다.',
               '{p|이} 내 리포트 여백에 빨간 펜으로 한 줄 적어놨다. "이 생각, 더 밀어붙여 보세요."'],
    friend:   ['연구실에서 {p|이} 믹스커피를 타주며 자기 대학 시절 얘기를 했다. 의외로 F를 받은 적이 있다고 했다.',
               '"요즘 표정이 좋네요." {p}의 칭찬은 늘 짧았다.'],
    best:     ['{p|이} "졸업하고도 가끔 들러요. 여기 커피는 늘 있으니까" 하고 말했다.',
               '{p|은} 내 진로 얘기를 듣고 한참 생각하더니, 책 한 권을 빌려줬다.'],
    sour:     ['{p|이} 내 과제를 돌려주며 "이건 학생 실력이 아니네요" 하고 말했다. 칭찬이 아니었다.',
               '수업 시간에 {p}와 눈이 마주쳤다. {p|이} 먼저 시선을 돌렸다.'],
  },
  '옆집 할머니': {
    stranger: ['{p|이} 계단에서 "새로 이사 온 학생이지?" 하고 물으셨다.',
               '{p|이} 현관 앞 화분에 물을 주다가 나를 보고 고개를 끄덕이셨다.'],
    acq:      ['"밥은 먹었어?" {p|이} 엘리베이터에서 물으셨다. 엄마랑 똑같은 말이었다.',
               '{p|이} 택배를 대신 받아 두셨다. 상자 위에 사탕 두 개가 올려져 있었다.'],
    friend:   ['{p} 댁에서 고구마를 얻어먹었다. {p|이} 돌아가신 할아버지 사진을 보여주셨다.',
               '"우리 손주도 학생만 해." {p|이} 휴대폰 속 손주 사진을 한참 넘기셨다.'],
    best:     ['{p|이} "학생이 있어서 이 동네 사는 게 덜 심심해" 하고 말씀하셨다.',
               '{p|이} 내 생일을 어떻게 아셨는지 미역국을 끓여 오셨다.'],
    sour:     ['{p|이} 계단에서 마주쳐도 인사를 받지 않으셨다. 늦은 밤 소음 때문인 것 같았다.',
               '"요즘 학생들은…" {p}의 혼잣말이 등 뒤에서 들렸다.'],
  },
};

/* ═════════ 2. 대화 고르기 ═════════ */
function talkStage(s, p, a) {
  if ((p.grudge || 0) >= 30) return 'sour';
  if (p.partner || p.spouse) return 'lover';
  if (a.canRomance(p) && (p.heart || 0) >= 45) return 'crush';
  const c = p.close || 0;
  return c >= 70 ? 'best' : c >= 45 ? 'friend' : c >= 20 ? 'acq' : 'stranger';
}
D.talkStage = talkStage;
// social.js '대화하기' run에서: text: GAME_DATA.pickTalk(s, p, a)
D.pickTalk = function (s, p, a) {
  // 1) 함께한 기억이 있으면 30% 확률로 그 얘기
  if (p.mem && p.mem.length && Math.random() < .3) {
    const pool = p.mem.map(m => D.talkMemory[m.tag]).filter(Boolean);
    if (pool.length) return a.pick(a.pick(pool));
  }
  // 2) 날씨·시간·계절이 맞으면 25% 확률로 상황 대사
  if (Math.random() < .25 && (p.close || 0) >= 20) {
    const keys = [];
    if (wet(s)) keys.push('rain');
    if (s.weather === 'snow') keys.push('snow');
    if (s.placeNight) keys.push('night');
    keys.push(seasonOf(s));
    const k = a.pick(keys);
    if (D.talkContext[k]) return a.pick(D.talkContext[k]);
  }
  // 3) 역할 대사 (교수님, 옆집 할머니 등) — 연애 단계는 없으니 친밀도로만
  const R = D.talkRole[p.role];
  if (R) { const st = talkStage(s, p, a); const k = st === 'crush' || st === 'lover' ? 'friend' : st; return a.pick(R[k] || R.acq); }
  // 4) 성격 × 관계 단계
  const byP = D.talkLines[p.personality] || D.talkLines.warm;
  return a.pick(byP[talkStage(s, p, a)] || byP.acq);
};

/* ═════════ 3. 1학년 이벤트 ═════════ */
// 고정 인물 스펙
const SPEC = {
  dongi1:  s => ({ kind: 'classmate', gender: same(s), ageRange: mates(s), personality: 'playful', close: 28, trust: 20 }),
  dongi2:  s => ({ kind: 'classmate', ageRange: mates(s), personality: 'shy', close: 15, trust: 15 }),
  dongi3:  s => ({ kind: 'classmate', ageRange: mates(s), personality: 'bold', close: 22, trust: 15 }),
  crush:   (s, a) => ({ kind: 'friend', gender: opp(s), ageRange: mates(s), personality: a.pick(['warm', 'sensitive', 'sunny', 'cool']), close: 15, heart: 12, taken: false, married: false }),   // 애인·배우자 없음 (NPC 출현의 무작위 기혼·애인 있음을 끔)
  sunbae1: s => ({ kind: 'friend', ageRange: [s.age + 1, s.age + 3], personality: 'warm', close: 20, trust: 25 }),
  sunbae2: s => ({ kind: 'friend', ageRange: [s.age + 2, s.age + 4], personality: 'sharp', close: 12, trust: 15 }),
  prof:    (s, a) => ({ kind: 'friend', role: '교수님', name: a.pick(D.surnames) + ' 교수님', ageRange: [46, 58], personality: 'cool', close: 5, trust: 10 }),
  halmeoni:() => ({ kind: 'friend', role: '옆집 할머니', name: '옆집 할머니', gender: 'f', ageRange: [72, 80], personality: 'warm', hangout: 'home', close: 15, trust: 20, married: false, taken: false }),   // 할아버지는 돌아가심
  barista: s => ({ kind: 'friend', ageRange: [s.age + 1, s.age + 4], personality: 'sunny', hangout: 'cafe', close: 12 }),
  clerk:   s => ({ kind: 'friend', ageRange: [s.age + 2, s.age + 5], personality: 'cool', hangout: 'conveni', close: 10 }),
};
// 관계 목록에 보이는 이름 (엔진 relLabel이 씀)
D.castLabel = { dongi1: '과 동기', dongi2: '과 동기', dongi3: '과 동기', crush: '동아리 동기', sunbae1: '과 선배', sunbae2: '동아리 회장',
  prof: '교수님', halmeoni: '옆집 할머니', barista: '카페 알바', clerk: '편의점 알바' };
const mk = t => (s, a) => cast(a, t, SPEC[t](s, a));
const mkFocus = t => (s, a) => a.focus(cast(a, t, SPEC[t](s, a)));

const FR = [
  /* ───────── 봄: 입학 (계절 시작에 세 장면 연속) ───────── */
  { id: 'fr_ot', type: 'must', season: ['봄'], when: fresh,
    onStart: (s, a) => { mk('dongi3')(s, a); mkFocus('dongi1')(s, a); },
    text: '신입생 OT. 강당에 처음 보는 얼굴이 이백 명쯤 있었다. 옆자리 {fp|이} "너도 혼자 왔어?" 하고 속삭였다. 곧 자기소개 차례가 돌아왔다.',
    choices: [
      { label: '웃기게 한다', check: { stat: 'charm', diff: 40 },
        success: { text: '강당이 뒤집어졌다. 맨 앞줄의 {fp|이} 제일 크게 웃었다. 그날부터 다들 내 이름을 알았다.',
          p: { close: [6, 9] }, effect: { happy: 4, charm: 1 }, do: all(rem('ot_funny'), rem('ot_funny', 'dongi3')), memory: true, then: 'fr_sugang' },
        fail: { text: '정적. 기침 소리까지 들렸다. 자리에 앉자 {fp|이} 조용히 박수를 쳐줬다. 그 박수가 오래 기억에 남았다.',
          p: { close: [8, 12], trust: [3, 5] }, effect: { happy: -2 }, do: rem('ot_silence'), memory: true, then: 'fr_sugang' } },
      { label: '무난하게 한다', text: '이름, 고향, 취미. 무난하게 끝냈다. {fp|이} "나랑 취미 같네" 하고 말했다.',
        p: { close: [3, 5] }, then: 'fr_sugang' },
      { label: '이름만 말하고 앉는다', text: '이름만 말하고 앉았다. {fp|이} "시크하네" 하며 웃었다.',
        p: { close: [1, 3] }, effect: { happy: -1 }, then: 'fr_sugang' },
    ] },

  { id: 'fr_sugang', type: 'trigger', onStart: focusT('dongi1'),
    text: '수강신청 날 아침 9시 50분. {fp|이} "학교 앞 PC방이 제일 빠르대. 같이 갈래?" 하고 연락했다.',
    choices: [
      { label: '같이 PC방 간다', chance: .6,
        success: { text: '10시 정각, 둘이 동시에 엔터를 눌렀다. 전부 성공. PC방이 떠나가라 소리를 질렀다.',
          p: { close: [6, 9] }, effect: { happy: 4 }, do: rem('sugang_pcbang'), memory: true, then: 'fr_firstclass' },
        fail: { text: '둘 다 튕겼다. 남은 건 월요일 1교시 9시 수업뿐이었다. 망했는데, 같이 망해서 이상하게 웃겼다.',
          p: { close: [8, 11] }, effect: { happy: 1 }, do: rem('sugang_fail'), memory: true, then: 'fr_firstclass' } },
      { label: '집에서 혼자 한다', chance: .45,
        success: { text: '혼자 조용히 성공했다. {fp}에게 결과를 보내니 우는 이모티콘만 왔다.', effect: { happy: 2 }, then: 'fr_firstclass' },
        fail: { text: '서버가 터졌다. 남은 시간표는 우주 공강이었다.', effect: { happy: -3 }, then: 'fr_firstclass' } },
      { label: '선배에게 물어본다', do: all(mkFocus('sunbae1'), rem('sugang_tip')),
        text: '과 단톡방에서 {fp|이} 개인 메시지를 보내왔다. "이 교수님 수업은 꼭 잡아. 나머진 아무거나 괜찮아." 덕분에 시간표가 깔끔해졌다.',
        p: { trust: [5, 8], close: [4, 6] }, effect: { happy: 2 }, then: 'fr_firstclass' },
    ] },

  { id: 'fr_firstclass', type: 'trigger', onStart: (s, a) => { mk('dongi2')(s, a); mkFocus('prof')(s, a); },
    text: '첫 전공 수업. {fp|이} 들어오자마자 출석부 대신 질문부터 던졌다. "이 과에 왜 왔습니까?" 강의실이 조용해졌다.',
    choices: [
      { label: '맨 앞자리에서 대답한다', check: { stat: 'smart', diff: 35 },
        success: { text: '떨렸지만 끝까지 말했다. {fp|이} 잠깐 나를 보더니 "이름이?" 하고 물었다.',
          p: { close: [5, 8], trust: [5, 8] }, effect: { smart: 1, happy: 2 }, do: rem('front_row'), memory: true },
        fail: { text: '말이 꼬였다. {fp|은} "솔직해서 좋네요" 하고 넘어갔다. 칭찬인지 아닌지 모르겠다.',
          p: { close: [2, 4] }, do: rem('front_row') } },
      { label: '혼자 앉은 애 옆에 앉는다', do: all(focusT('dongi2'), rem('sat_next')),
        text: '맨 끝에 혼자 앉은 {fp} 옆에 앉았다. {fp|이} 깜짝 놀라더니 필통을 내 쪽으로 조금 밀어줬다. 같이 쓰자는 뜻 같았다.',
        p: { close: [6, 9], trust: [4, 6] }, effect: { happy: 2 } },
      { label: '뒷자리에서 조용히 듣는다', text: '뒷자리에서 듣기만 했다. 첫 수업부터 졸음이 왔다.', effect: { smart: -1 } },
    ] },

  /* ───────── 봄: 캠퍼스에서 가끔 ───────── */
  { id: 'fr_welcome', type: 'random', on: ['campus', 'bar'], season: ['봄'], when: fresh, weight: 5,
    onStart: (s, a) => { mk('sunbae1')(s, a); mk('dongi3')(s, a); mkFocus('dongi1')(s, a); },
    text: '신입생 환영회. 선배들이 "마셔라 마셔라"를 외쳤다. {fp|이} 옆에서 내 잔을 힐끔 봤다.',
    choices: [
      { label: '분위기 맞춰 마신다', chance: .5, 
        success: { text: '처음으로 술자리가 재밌다고 느꼈다. 새벽까지 동기들이랑 노래방에서 목이 쉬었다.',
          drunk: 2, effect: { happy: 5 }, do: all(rem('welcome_fun', 'dongi3'), rem('welcome_fun')), memory: true },
        fail: { text: '기억이 거기서 끊겼다. 눈을 떠보니 자취방이었고, 머리맡에 숙취해소제와 {fp}의 쪽지가 있었다. "업고 오느라 죽는 줄."',
          drunk: 3, p: { close: [8, 12], trust: [3, 6] }, effect: { happy: -2, health: -3 }, do: rem('carried_home'), memory: true } },
      { label: '적당히 마신다', text: '두 잔쯤에서 멈췄다. 끝까지 멀쩡한 덕에 취한 동기들 택시를 다 잡아줬다.', drunk: 1, p: { close: [3, 5], trust: [3, 5] }, effect: { happy: 2 } },
      { label: '사이다만 마신다', do: all(focusT('sunbae1'), rem('cider')),
        text: '사이다 잔을 들자 누가 야유를 했다. 그때 {fp|이} "마시기 싫으면 안 마셔도 돼. 내가 마실게" 하고 내 잔을 가져갔다.',
        p: { trust: [6, 10], close: [4, 6] }, effect: { happy: 1 } },
    ] },

  { id: 'fr_clubfair', type: 'random', on: ['campus'], season: ['봄'], when: fresh, weight: 5,
    onStart: (s, a) => { mk('sunbae2')(s, a); mkFocus('crush')(s, a); },
    text: '동아리 박람회. 부스마다 호객이 한창이었다. 전단지를 나눠주던 신입 {fp|와} 눈이 마주쳤다. "너도 1학년이지? 여기 같이 들어갈래?"',
    choices: [
      { label: '밴드 동아리', set: 'club_band', text: '기타 하나 못 치면서 밴드에 들어갔다. 회장 선배가 팔짱을 끼고 "초보는 일단 짐부터 나른다" 하고 말했다. {fp|은} 키보드 자리에 앉았다.',
        p: { close: [5, 8], heart: [3, 5] }, effect: { art: 2, happy: 3 }, do: rem('club_join'), memory: true },
      { label: '봉사 동아리', set: 'club_volunteer', text: '봉사 동아리에 들어갔다. 첫 활동은 연탄 나르기였다. {fp}의 얼굴에 검댕이 묻어 있었다.',
        p: { close: [6, 9], heart: [2, 4] }, effect: { happy: 3 }, karma: 3, do: rem('club_join'), memory: true },
      { label: '운동 동아리', set: 'club_sport', text: '운동 동아리에 들어갔다. 첫날부터 운동장 다섯 바퀴. {fp|이} 옆에서 같이 헐떡였다.',
        p: { close: [5, 8], heart: [2, 4] }, effect: { fit: 2, happy: 2 }, do: rem('club_join'), memory: true },
      { label: '안 든다', text: '전단지만 잔뜩 받아 들고 나왔다. {fp|이} 조금 아쉬운 얼굴로 손을 흔들었다.', p: { close: [1, 2] } },
    ] },

  { id: 'fr_umbrella', type: 'random', on: ['campus'], when: (s, a) => fresh(s) && wet(s) && (has(a, 'crush') || has(a, 'dongi2')), weight: 4,
    onStart: (s, a) => a.focus(byTag(a, 'crush') || byTag(a, 'dongi2')),
    text: '수업이 끝나고 나오니 비가 쏟아지고 있었다. 건물 입구에 {fp|이} 우산 없이 서 있었다.',
    choices: [
      { label: '같이 쓰자고 한다', text: '우산 하나에 둘이 들어갔다. 정류장까지 가는 동안 내 어깨 한쪽이 다 젖었다. {fp}의 쪽은 하나도 안 젖었다.',
        p: { close: [5, 8], heart: [4, 7] }, effect: { happy: 3 }, do: rem('umbrella_shared'), memory: true },
      { label: '빌려주고 뛰어간다', text: '"나 집 가까워!" 우산을 쥐여주고 빗속으로 뛰었다. 다음 날 감기에 걸렸다. 그래도 나쁘지 않았다.',
        p: { trust: [7, 10], heart: [2, 4] }, effect: { health: -3, happy: 2 }, do: rem('umbrella_lent'), memory: true },
      { label: '못 본 척한다', text: '모른 척 지나쳤다. 등 뒤에서 빗소리가 유난히 크게 들렸다.', effect: { happy: -1 } },
    ] },

  { id: 'fr_project', type: 'random', on: ['campus', 'library'], season: ['봄'], when: (s, a) => fresh(s) && has(a, 'dongi2'), weight: 4,
    onStart: focusT('dongi2'),
    text: '조별과제 4인 팀. 두 명이 단톡방에서 사라졌다. 남은 건 나랑 {fp}뿐이었다. 발표는 사흘 뒤.',
    choices: [
      { label: '둘이서 끝낸다', text: '사흘 동안 과방에서 살았다. 발표 날 {fp|이} 떨리는 목소리로 끝까지 해냈다. 끝나고 둘이 말없이 하이파이브를 했다.',
        p: { close: [8, 12], trust: [8, 12] }, effect: { smart: 2, health: -2, happy: 3 }, do: rem('project_carry'), memory: true },
      { label: '단톡방에서 공개 저격한다', text: '"과제 안 하실 거면 이름 빼겠습니다." 단톡방이 얼어붙었다. 한 명이 돌아왔고, 한 명은 과에서 나를 피했다. {fp|은} 조금 놀란 눈치였다.',
        p: { trust: [2, 4] }, effect: { happy: 1 }, do: rem('project_callout') },
      { label: '교수님께 메일을 보낸다', text: '사정을 정리해서 메일을 보냈다. 답장은 한 줄이었다. "기여도 평가에 반영하겠습니다."',
        effect: { smart: 1 }, do: all(rem('project_report', 'prof')), p: { trust: [3, 5] } },
    ] },

  { id: 'fr_midterm', type: 'random', on: ['library', 'campus'], season: ['봄'], when: (s, a) => fresh(s) && has(a, 'dongi1'), weight: 3,
    onStart: focusT('dongi1'),
    text: '중간고사 전날 밤 11시. {fp|이} "도서관 24시간 열람실 자리 맡았다. 올 거지?" 하고 연락했다.',
    choices: [
      { label: '같이 밤샌다', text: '새벽 4시, 자판기 커피를 세 잔째 마시며 서로의 다크서클을 보고 웃었다. 시험은 생각보다 잘 봤다.',
        p: { close: [6, 9] }, effect: { smart: 2, health: -3, happy: 2 }, do: rem('all_nighter'), memory: true },
      { label: '집에서 혼자 한다', text: '집에서 혼자 했다. 집중은 잘 됐는데 조금 외로웠다.', effect: { smart: 2 } },
      { label: '포기하고 치킨 시킨다', text: '"인생 길다." 치킨을 시켰다. {fp|이} 사진을 보고 "배신자" 하고 답장했다.',
        p: { close: [1, 3] }, effect: { smart: -1, happy: 3 } },
    ] },

  { id: 'fr_mt', type: 'random', on: ['campus'], season: ['봄'], when: (s, a) => fresh(s) && has(a, 'crush'), weight: 4,
    onStart: focusT('crush'),
    text: 'MT 둘째 날 밤. 진실게임 병이 나를 가리켰다. 누군가 외쳤다. "여기서 제일 마음에 드는 사람!" {fp|이} 고개를 숙였다.',
    choices: [
      { label: '{fp}의 이름을 말한다', text: '"…{fp}." 순간 방이 난리가 났다. {fp|은} 끝까지 고개를 못 들었다. 귀가 새빨갰다.',
        p: { heart: [10, 14], close: [3, 5] }, effect: { happy: 4 }, do: rem('mt_said_name'), memory: true },
      { label: '웃으며 넘긴다', text: '"다 좋은데?" 야유가 쏟아졌다. {fp|이} 살짝 웃은 것 같기도 했다.', p: { heart: [1, 3] } },
      { label: '벌칙주를 마신다', text: '대답 대신 잔을 비웠다. {fp|이} 물을 따라줬다.', drunk: 1, p: { close: [2, 4] } },
    ] },

  { id: 'fr_springfest', type: 'random', on: ['campus'], season: ['봄'], when: (s, a) => fresh(s) && has(a, 'dongi3'), weight: 3,
    onStart: focusT('dongi3'),
    text: '봄 축제 날. {fp|이} 과 주점 앞치마를 던지며 말했다. "일손 부족해. 도와줄 거지?"',
    choices: [
      { label: '주점 서빙을 한다', text: '파전을 이백 장쯤 날랐다. 새벽에 남은 파전으로 동기들끼리 뒤풀이를 했다. 그 파전이 제일 맛있었다.',
        p: { close: [7, 10] }, effect: { happy: 4, health: -2 }, do: rem('fest_bar'), memory: true },
      { label: '공연 보러 간다', if: (s, a) => has(a, 'crush'),
        do: all(focusT('crush'), rem('fest_concert')),
        text: '운동장 공연을 보러 갔다. 사람들 사이에서 {fp|이} 내 옷자락을 잡았다. 놓칠까 봐 그런 거라고 했다.',
        p: { heart: [6, 9], close: [3, 5] }, effect: { happy: 5 }, memory: true },
      { label: '그냥 집에 간다', text: '시끄러운 게 싫어서 집에 갔다. 창밖으로 폭죽 소리가 들렸다.', effect: { happy: -2 } },
    ] },

  { id: 'fr_halmeoni', type: 'random', on: ['home'], when: s => fresh(s) && !s.flags.metHalmeoni, weight: 4,
    text: '자취방 계단에서 옆집 할머니가 장바구니를 든 채 숨을 고르고 계셨다.',
    choices: [
      { label: '들어드린다', set: 'metHalmeoni', do: all(mkFocus('halmeoni'), rem('helped_bags')),
        text: '4층까지 들어드렸다. {fp|이} 문 앞에서 "잠깐 있어 봐" 하더니 김치 한 통을 쥐여주셨다.',
        p: { close: [8, 12], trust: [6, 9] }, effect: { happy: 3 }, karma: 2, memory: true },
      { label: '인사만 하고 지나간다', set: 'metHalmeoni', do: mkFocus('halmeoni'),
        text: '"안녕하세요." 꾸벅 인사만 했다. {fp|이} "그래, 학생이구나" 하고 웃으셨다.', p: { close: [2, 4] } },
      { label: '못 본 척한다', set: 'metHalmeoni', text: '이어폰 볼륨을 높이고 지나쳤다.', karma: -1 },
    ] },

  { id: 'fr_cafe', type: 'random', on: ['cafe'], when: (s, a) => fresh(s) && !has(a, 'barista'), weight: 4,
    onStart: mkFocus('barista'),
    text: '학교 앞 작은 카페. 알바생 {fp|이} 주문을 받다 말고 물었다. "혹시 새내기세요? 첫 방문 쿠폰 드릴게요!"',
    choices: [
      { label: '아이스 아메리카노, 연하게', text: '"아아 연하게!" {fp|이} 따라 하며 웃었다. 그 말투가 이상하게 귀에 남았다.',
        p: { close: [4, 6] }, effect: { happy: 2 }, do: rem('cafe_iced') },
      { label: '추천해 달라고 한다', text: '{fp|이} 신메뉴라며 이름도 어려운 라테를 줬다. 달았다. 너무 달았다. 그래도 다 마셨다.',
        p: { close: [5, 7] }, effect: { happy: 2 } },
    ] },

  { id: 'fr_conveni', type: 'random', on: ['conveni'], when: (s, a) => fresh(s) && s.placeNight && !has(a, 'clerk'), weight: 4,
    onStart: mkFocus('clerk'),
    text: '새벽 2시 편의점. 야간 알바 {fp|이} 계산하다가 폐기 직전 삼각김밥을 하나 더 올려놨다. "이거 어차피 버려요."',
    choices: [
      { label: '고맙게 받는다', text: '"감사합니다." {fp|은} 대답 없이 고개만 까딱했다. 그 삼각김밥이 그날 먹은 것 중 제일 맛있었다.',
        p: { close: [4, 7] }, effect: { happy: 2 }, do: rem('free_onigiri') },
      { label: '괜찮다고 사양한다', text: '사양했다. {fp|이} "그럼 제가 먹죠" 하고 바로 뜯었다.', p: { close: [1, 3] } },
    ] },

  { id: 'fr_momcall', type: 'random', on: ['home'], when: (s, a) => fresh(s) && !!mom(a), weight: 3,
    onStart: (s, a) => a.focus(mom(a)),
    text: '엄마한테 전화가 왔다. "밥은 먹고 다니니?" 오늘 먹은 건 컵라면 하나였다.',
    choices: [
      { label: '잘 먹는다고 한다', text: '"그럼, 잘 먹지." 엄마가 안심한 목소리로 끊었다. 끊고 나서 괜히 냉장고를 열어봤다.', p: { close: [1, 3] } },
      { label: '솔직하게 말한다', text: '"라면만 먹었어." 사흘 뒤 택배가 왔다. 반찬통 일곱 개와 손편지 한 장. "사 먹지 말고 해 먹어."',
        p: { close: [6, 9], trust: [3, 5] }, effect: { happy: 4, health: 2 }, memory: true },
      { label: '바쁘다고 끊는다', text: '"나 지금 바빠, 나중에 할게." 끊고 보니 통화 시간이 23초였다.',
        p: { close: [-4, -2] }, effect: { happy: -1 }, do: rem('hung_up') },
    ] },

  /* ───────── 여름 ───────── */
  { id: 'fr_finals1', type: 'must', season: ['여름'], when: (s, a) => fresh(s) && has(a, 'dongi1'),
    onStart: focusT('dongi1'),
    text: '1학기 기말이 끝났다. 마지막 시험지를 내고 나오자 {fp|이} 복도에서 기다리고 있었다. "종강이다!"',
    choices: [
      { label: '종강파티에 간다', text: '고깃집에서 시작해서 노래방으로 끝났다. 한 학기 동안 있었던 일을 다 같이 떠들었다. 벌써 반년이 지나 있었다.',
        p: { close: [5, 8] }, effect: { happy: 5 }, do: rem('jonggang1'), memory: true, then: 'fr_summerplan' },
      { label: '바로 집에 내려간다', text: '짐을 싸서 바로 고향에 내려갔다. 엄마가 해준 밥을 먹고 열네 시간을 잤다.',
        effect: { happy: 3, health: 3, rel: { family: 4 } }, then: 'fr_summerplan' },
    ] },

  { id: 'fr_summerplan', type: 'trigger', text: '두 달짜리 여름방학. 뭘 하지?',
    choices: [
      { label: '알바를 한다', set: 'fr_summerJob', text: '동네 고깃집 알바를 구했다. 시급은 최저, 불판은 무한이었다.', effect: { money: [60, 120] } },
      { label: '고향에 내려간다', set: 'fr_summerHome', text: '고향에 내려가기로 했다. 고등학교 친구들한테 연락을 돌렸다.', effect: { happy: 2 } },
      { label: '계절학기를 듣는다', set: 'fr_summerClass', text: '계절학기를 신청했다. 텅 빈 캠퍼스는 생각보다 조용하고 좋았다.', effect: { smart: 3, money: -30 } },
      { label: '동기들이랑 바다 간다', set: 'fr_summerTrip', text: '단톡방에 "바다 갈 사람"을 올리자 1분 만에 다섯 명이 손을 들었다.', effect: { money: -25, happy: 3 } },
    ] },

  { id: 'fr_parttime', type: 'fixed', season: ['여름'], req: { flags: ['fr_summerJob'] }, when: fresh, weight: 6,
    text: '고깃집 알바 3주 차. 술 취한 손님이 "고기가 왜 이렇게 늦어!" 하며 집게를 던졌다.',
    choices: [
      { label: '참는다', text: '이를 악물고 "죄송합니다" 했다. 퇴근길 버스에서 괜히 눈물이 났다. 통장에 찍힌 숫자를 보며 겨우 웃었다.', effect: { money: 20, happy: -3 } },
      { label: '사장님께 말한다', text: '사장님이 직접 나가서 손님을 내보냈다. "우리 알바한테 그러면 안 되지." 그날 사장님이 냉면을 사줬다.', effect: { money: 15, happy: 3 } },
      { label: '똑바로 맞받아친다', check: { stat: 'charm', diff: 45 },
        success: { text: '"집게 던지시면 안 됩니다." 차분하게 말하자 손님이 머쓱해했다. 옆 테이블에서 박수가 나왔다.', effect: { happy: 4, charm: 1 } },
        fail: { text: '언성이 높아졌고, 다음 날부터 안 나와도 된다는 문자가 왔다.', effect: { happy: -4 } } },
    ] },

  { id: 'fr_hometown', type: 'fixed', season: ['여름'], req: { flags: ['fr_summerHome'] }, when: fresh, weight: 6,
    onStart: (s, a) => {
      const old = a.find(p => p.kind === 'classmate' && p.tag == null && p.met < (s.school.start || s.age)).sort((x, y) => y.close - x.close)[0];
      a.focus(old || a.meet({ kind: 'friend', ageRange: mates(s), personality: 'bold', close: 50, trust: 40 }));
    },
    text: '고향 친구 {fp|와} 반년 만에 만났다. 말투가 조금 달라져 있었다. 나도 그럴 것이다.',
    choices: [
      { label: '예전처럼 PC방 간다', text: '고등학교 때 다니던 PC방, 같은 자리. 둘 다 실력이 그대로라 한참 웃었다. 시간이 하나도 안 지난 것 같았다.',
        p: { close: [8, 12] }, effect: { happy: 5 }, do: rem('hometown_pc'), memory: true },
      { label: '대학 얘기를 한다', text: '서로 학교 얘기만 했다. 모르는 이름이 계속 나왔다. 헤어질 때 {fp|이} "너 좀 변했다" 하고 말했다.',
        p: { close: [-3, 0] }, effect: { happy: -1 } },
    ] },

  { id: 'fr_beach', type: 'fixed', season: ['여름'], req: { flags: ['fr_summerTrip'] }, when: (s, a) => fresh(s) && (has(a, 'crush') || has(a, 'dongi1')), weight: 6,
    onStart: (s, a) => a.focus(byTag(a, 'crush') || byTag(a, 'dongi1')),
    text: '동기들이랑 간 바다. 밤이 되자 다들 숙소에서 술판을 벌였다. {fp|이} 슬쩍 나가는 게 보였다.',
    choices: [
      { label: '따라 나가서 같이 걷는다', text: '파도 소리만 들리는 해변을 둘이 걸었다. {fp|이} "나 사실 처음에 이 학교 오기 싫었어" 하고 말했다. "근데 지금은 좋아." 왜 좋은지는 말하지 않았다.',
        p: { heart: [10, 15], close: [6, 9], trust: [5, 8] }, effect: { happy: 6 }, do: rem('beach_walk'), memory: true },
      { label: '다 같이 폭죽을 터뜨린다', do: (s, a) => { a.focus(byTag(a, 'dongi1') || a.focused()); rem('beach_fireworks')(s, a); },
        text: '편의점 폭죽을 사 와서 터뜨렸다. {fp|이} 폭죽을 거꾸로 들어서 모두가 비명을 질렀다. 다친 사람은 없었고, 웃음은 멈추지 않았다.',
        p: { close: [8, 11] }, effect: { happy: 6 }, memory: true },
      { label: '숙소에서 잔다', text: '일찍 잤다. 아침에 단톡방 사진을 보니 다들 밤새 재밌게 논 것 같았다.', effect: { health: 2, happy: -2 } },
    ] },

  { id: 'fr_heatwave', type: 'random', on: ['home'], season: ['여름'], when: (s, a) => fresh(s) && has(a, 'halmeoni'), weight: 3,
    onStart: focusT('halmeoni'),
    text: '폭염 경보. 옆집에서 선풍기 돌아가는 소리만 들렸다. {fp} 댁 에어컨이 고장 났다고 했다.',
    choices: [
      { label: '수박 한 통 사서 간다', text: '수박을 반으로 잘라 둘이 숟가락으로 퍼먹었다. {fp|이} 옛날 얘기를 해주셨다. 할아버지 처음 만난 여름 얘기였다.',
        p: { close: [8, 12], trust: [5, 8] }, effect: { happy: 4, money: -2 }, karma: 2, do: rem('watermelon'), memory: true },
      { label: '관리실에 대신 전화한다', text: '관리실에 전화해서 수리 기사를 불러드렸다. {fp|이} "요즘 학생 같지 않네" 하셨다.',
        p: { close: [4, 6], trust: [5, 7] }, karma: 1 },
    ] },

  { id: 'fr_leak', type: 'random', on: ['home'], season: ['여름'], when: (s, a) => fresh(s) && wet(s) && has(a, 'dongi1'), weight: 3,
    onStart: focusT('dongi1'),
    text: '장마. 자취방 천장에서 물이 뚝뚝 떨어지기 시작했다. 다급하게 {fp}에게 전화했다.',
    choices: [
      { label: 'SOS를 친다', text: '20분 뒤 {fp|이} 양동이 두 개와 치킨을 들고 나타났다. "물 받으면서 먹자." 그날 밤 빗소리가 박자 같았다.',
        p: { close: [8, 11], trust: [5, 8] }, effect: { happy: 3 }, do: rem('leak_help'), memory: true },
      { label: '혼자 해결한다', text: '냄비 세 개로 버텼다. 새벽 내내 똑, 똑, 똑.', effect: { happy: -2, health: -1 } },
    ] },

  /* ───────── 가을 ───────── */
  { id: 'fr_fallopen', type: 'must', season: ['가을'], when: (s, a) => fresh(s) && has(a, 'dongi3'),
    onStart: focusT('dongi3'),
    text: '2학기 개강 날. {fp|이} 과방에서 휴학계를 흔들었다. "나 반수한다. 수능 다시 봐."',
    choices: [
      { label: '응원한다', text: '"넌 할 거야." 진심이었다. {fp|이} 피식 웃더니 "붙으면 밥 산다" 하고 말했다.',
        p: { trust: [8, 12], close: [4, 6] }, do: rem('cheer_retake'), memory: true },
      { label: '서운하다고 말한다', text: '"그럼 우리는?" 나도 모르게 나온 말이었다. {fp|이} 한참 대답을 못 했다.', p: { close: [3, 6], heart: [0, 3] }, do: rem('sad_leave') },
      { label: '농담으로 넘긴다', text: '"떨어지면 2학년 때 후배로 받아줄게." {fp|이} 내 등을 세게 때렸다.', p: { close: [3, 5] } },
    ] },

  { id: 'fr_chuseok', type: 'random', on: ['home'], season: ['가을'], when: (s, a) => fresh(s) && !!mom(a), weight: 4,
    onStart: (s, a) => a.focus(mom(a)),
    text: (s, a) => remembers(mom(a), 'hung_up')
      ? '추석. 큰집에 모인 친척들 사이에서 엄마가 내 접시에 전을 쌓아주며 작게 말했다. "전화 좀 자주 해." 봄에 23초 만에 끊은 그 전화가 떠올랐다.'
      : '추석. 큰집에 친척들이 모였다. 큰아버지가 물었다. "그래서 학점은 몇 나왔냐?"',
    choices: [
      { label: '웃으며 넘긴다', text: '"열심히 하고 있어요." 웃으면서 전을 하나 더 집었다.', p: { close: [2, 4] } },
      { label: '엄마 옆에서 설거지를 돕는다', text: '부엌에서 엄마랑 둘이 설거지를 했다. 엄마가 아무 말 없이 내 등을 한 번 쓸었다. 그걸로 충분했다.',
        p: { close: [6, 9], trust: [3, 5] }, effect: { happy: 3, rel: { family: 4 } }, memory: true },
      { label: '용돈 받고 일찍 올라간다', text: '용돈 봉투를 챙겨 일찍 올라왔다. 버스 창밖으로 보름달이 따라왔다.', effect: { money: [10, 30] } },
    ] },

  { id: 'fr_crushmeal', type: 'random', on: ['campus', 'cafe'], season: ['가을'],
    when: (s, a) => { const c = byTag(a, 'crush'); return fresh(s) && c && !c.partner && (c.heart || 0) >= 25; }, weight: 4,
    onStart: focusT('crush'),
    text: '{fp}에게 메시지가 왔다. "오늘 점심 같이 먹을 사람 없는데… 혹시 시간 돼?"',
    choices: [
      { label: '간다', text: '학교 뒤 작은 국밥집. {fp|이} 깍두기를 내 쪽으로 밀어줬다. 별말 없이 밥만 먹었는데, 나오면서 {fp|이} "다음엔 내가 살게" 하고 말했다. 다음이 있다는 뜻이었다.',
        p: { heart: [7, 10], close: [5, 8] }, effect: { happy: 4 }, do: rem('first_meal'), memory: true },
      { label: '선약이 있다고 한다', text: '"미안, 오늘은 좀…" {fp|이} "괜찮아!" 하고 답장했다. 마침표가 하나 더 붙어 있었다.', p: { heart: [-4, -2] } },
    ] },

  { id: 'fr_dodgeball', type: 'random', on: ['campus'], season: ['가을'], when: (s, a) => fresh(s) && has(a, 'dongi1'), weight: 3,
    onStart: focusT('dongi1'),
    text: '과 체육대회 피구 결승. 우리 팀에 남은 건 나 하나였다. {fp|이} 라인 밖에서 소리를 질렀다. "피해! 무조건 피해!"',
    choices: [
      { label: '끝까지 버틴다', check: { stat: 'fit', diff: 42 },
        success: { text: '공 일곱 개를 피했고, 마지막 공을 잡았다. 역전승. 과 사람들이 나를 헹가래 쳤다.',
          p: { close: [6, 9] }, effect: { happy: 6, fit: 1 }, do: all(rem('dodgeball_hero'), rem('dodgeball_hero', 'dongi3')), memory: true },
        fail: { text: '첫 공을 얼굴로 받았다. 운동장이 조용해졌다가 폭소가 터졌다. 코피는 안 났다. 자존심은 났다.',
          p: { close: [6, 9] }, effect: { happy: 2, health: -1 }, do: rem('dodgeball_face'), memory: true } },
      { label: '일부러 맞고 나온다', text: '적당히 맞고 나왔다. {fp|이} "아깝다!" 하며 내 등을 두드렸다. 다음 경기에서 우리 과는 꼴찌를 했다.', p: { close: [2, 4] } },
    ] },

  { id: 'fr_sunbaemeal', type: 'random', on: ['campus', 'cafe'], season: ['가을'], when: (s, a) => fresh(s) && has(a, 'sunbae1'), weight: 3,
    onStart: focusT('sunbae1'),
    text: '{fp|이} 밥을 사준다며 불렀다. 그런데 정작 밥은 안 먹고 젓가락만 만지작거렸다. "나 전과할까 고민 중이야."',
    choices: [
      { label: '끝까지 들어준다', text: '두 시간을 들었다. 해결책은 하나도 못 줬다. 헤어질 때 {fp|이} "들어줘서 고마워. 정리됐어" 하고 말했다.',
        p: { trust: [10, 14], close: [6, 9] }, effect: { happy: 2 }, do: rem('sunbae_listen'), memory: true },
      { label: '버티라고 조언한다', text: '"선배, 그래도 여기까지 왔잖아요." {fp|이} 웃었지만 표정이 조금 굳었다.', p: { close: [1, 3] } },
    ] },

  { id: 'fr_profoffice', type: 'random', on: ['campus'], season: ['가을'],
    when: (s, a) => { const p = byTag(a, 'prof'); return fresh(s) && p && (remembers(p, 'front_row') || remembers(p, 'project_report')); }, weight: 3,
    onStart: focusT('prof'),
    text: '{fp|이} 수업이 끝나고 나를 불렀다. "1학기 때 기억나요. 연구실 학부연구생 자리가 하나 있는데, 해볼 생각 있습니까?"',
    choices: [
      { label: '하겠다고 한다', set: 'labIntern', text: '"하겠습니다." 다음 날부터 연구실 열쇠를 받았다. 밤마다 커피 냄새와 논문 냄새가 났다.',
        p: { trust: [10, 14], close: [5, 8] }, effect: { smart: 3, happy: 2 }, do: rem('lab_yes'), memory: true },
      { label: '생각해 보겠다고 한다', text: '"생각해 보겠습니다." {fp|은} "언제든지" 하고 말했다. 문은 열려 있는 것 같았다.', p: { trust: [2, 4] } },
      { label: '정중히 거절한다', text: '아직은 1학년답게 놀고 싶었다. {fp|은} 고개를 끄덕였다.', p: { close: [0, 2] } },
    ] },

  { id: 'fr_fight', type: 'random', on: ['campus', 'bar'], season: ['가을'], when: (s, a) => fresh(s) && has(a, 'dongi1'), weight: 3,
    onStart: focusT('dongi1'),
    text: '{fp|이} 봄에 빌려간 20만 원 얘기를 꺼냈더니 표정이 굳었다. "지금 나 돈 떼먹을 사람으로 보는 거야?"',
    choices: [
      { label: '따진다', text: '"그런 뜻은 아닌데, 그래도 갚아야지." 말이 오갈수록 목소리가 커졌다. 그날 이후 {fp}의 답장이 짧아졌다.',
        p: { grudge: [20, 28], close: [-10, -6] }, effect: { happy: -3 }, do: rem('fight_money') },
      { label: '그냥 됐다고 한다', text: '"아냐, 됐어. 잊어." 돈은 돌아오지 않았다. 대신 {fp|와}의 사이는 그대로였다. 아마도.', p: { trust: [-3, -1] } },
      { label: '솔직하게 털어놓는다', check: { stat: 'charm', diff: 40 },
        success: { text: '"나 이번 달 진짜 빠듯해서 그래. 너 의심하는 거 아니야." {fp|이} 한참 있다가 "미안, 내가 예민했다" 하고 말했다. 다음 날 돈이 들어와 있었다.',
          p: { trust: [8, 12], close: [4, 6] }, effect: { happy: 2 }, do: rem('talked_it_out'), memory: true },
        fail: { text: '말을 고를수록 더 꼬였다. {fp|이} "알겠어" 하고 먼저 일어났다.',
          p: { grudge: [12, 18], close: [-6, -3] }, effect: { happy: -2 }, do: rem('fight_money') } },
    ] },

  { id: 'fr_confess', type: 'random', on: ['campus', 'park', 'cafe'], season: ['가을', '겨울'],
    when: (s, a) => { const c = byTag(a, 'crush'); return fresh(s) && c && !c.partner && !c.spouse && (c.heart || 0) >= 50; }, weight: 6,
    onStart: focusT('crush'),
    text: (s, a) => {
      const c = byTag(a, 'crush');
      if (remembers(c, 'beach_walk')) return '해 질 녘, {fp|이} 문득 말했다. "여름에 그 바다 기억나? 그때부터였던 것 같아." 무엇이 그때부터였는지는 말하지 않았다. 지금 말해야 할 것 같았다.';
      if (remembers(c, 'mt_said_name')) return '{fp|이} 웃으며 물었다. "MT 때 진실게임, 그거 진심이었어?" 이번엔 웃어넘길 수 없었다.';
      if (remembers(c, 'umbrella_shared')) return '또 비가 왔다. 우산 하나 아래서 {fp}의 어깨가 내 어깨에 닿았다. 심장 소리가 빗소리보다 컸다.';
      return '같이 걷던 {fp|이} 걸음을 멈췄다. 할 말이 있는 얼굴이었다. 아니, 할 말이 있는 건 나였다.';
    },
    choices: [
      { label: '고백한다', chance: (s, a) => Math.min(.92, .35 + ((byTag(a, 'crush') || {}).heart || 0) / 150),
        success: { text: '"좋아해." 말하고 나니 다리가 풀렸다. {fp|이} 한참 나를 보다가, 내 손을 잡았다. "나도. 언제 말하나 기다렸어."',
          do: all((s, a) => { const p = a.focused(); if (p) a.startRelation(p, false); }, rem('confess_yes')), p: { heart: [10, 15], trust: [6, 9] }, effect: { happy: 10 }, scene: 'hug', memory: true },
        fail: { text: '"좋아해." {fp|이} 오래 망설이다 말했다. "고마워. 근데… 지금은 친구로 남고 싶어." 집에 오는 길이 그렇게 길 줄 몰랐다.',
          p: { heart: [-15, -10], close: [-3, 0] }, effect: { happy: -8 }, do: rem('confess_no'), memory: true } },
      { label: '아직은 아니다', text: '입을 열었다가 다시 닫았다. {fp|이} "응?" 하고 물었다. "아냐, 아무것도." 오늘은 아니었다.', p: { heart: [1, 3] } },
    ] },

  { id: 'fr_clubstage', type: 'random', on: ['campus'], season: ['가을'],
    when: (s, a) => fresh(s) && has(a, 'sunbae2') && (s.flags.club_band || s.flags.club_volunteer || s.flags.club_sport), weight: 4,
    onStart: focusT('sunbae2'),
    text: s => s.flags.club_band ? '동아리 정기공연 2주 전. 회장 {fp|이} 합주실 문을 닫으며 말했다. "1학년도 한 곡씩 무대 선다. 빠지는 사람 없어."'
      : s.flags.club_volunteer ? '봉사 동아리 연말 바자회 준비. 회장 {fp|이} 역할표를 붙였다. 내 이름 옆에 "총괄 보조"라고 적혀 있었다.'
      : '운동 동아리 교내 대회 2주 전. 회장 {fp|이} 명단을 보더니 "1학년 중에 너 넣는다" 하고 말했다.',
    choices: [
      { label: '2주 동안 매일 남아서 준비한다', text: '매일 밤 마지막까지 남았다. 당일, 끝나고 {fp|이} 처음으로 내 어깨를 두드렸다. "2학년 때 네가 1학년들 맡아."',
        p: { trust: [10, 14], close: [6, 9] }, effect: { happy: 5, health: -2, art: 1 }, do: rem('club_effort'), memory: true },
      { label: '할 만큼만 한다', text: '무난하게 끝냈다. {fp|은} 아무 말도 안 했다. 그게 평가였다.', p: { close: [1, 3] } },
      { label: '빠지겠다고 한다', text: '"이번엔 빠질게요." {fp|이} 나를 한참 보더니 "알았어" 하고 말했다. 그 뒤로 단톡방 공지가 나한테만 늦게 오는 것 같았다.',
        p: { trust: [-8, -5], grudge: [5, 8] }, effect: { happy: -1 } },
    ] },

  { id: 'fr_newface', type: 'random', on: ['campus', 'library', 'cafe'], season: ['가을'], when: (s, a) => fresh(s) && !has(a, 'crush'), weight: 5,
    onStart: mkFocus('crush'),
    text: '2학기 교양 수업. 옆자리 {fp|이} 수업 내내 졸다가 끝나기 직전에 깨서 물었다. "혹시… 오늘 과제 뭐라고 했어요?"',
    choices: [
      { label: '필기를 보여준다', text: '노트를 내밀었다. {fp|이} 사진을 찍더니 "다음 주에 커피 살게요" 하고 말했다. 다음 주, 정말로 커피 두 잔을 들고 왔다.',
        p: { close: [6, 9], heart: [5, 8] }, effect: { happy: 3 }, do: rem('lent_notes'), memory: true },
      { label: '대충 알려준다', text: '"리포트 하나요." {fp|이} "감사합니다!" 하고 꾸벅 인사했다.', p: { close: [2, 4], heart: [1, 3] } },
    ] },

  { id: 'fr_lonely', type: 'random', on: ['home'], season: ['가을'], when: s => fresh(s) && s.stats.happy < 45, weight: 4,
    text: (s, a) => {
      const h = byTag(a, 'halmeoni');
      if (h && remembers(h, 'helped_bags')) { a.focus(h); return '쓸쓸한 가을밤. 아무한테도 연락이 오지 않았다. 그때 누가 문을 두드렸다. 옆집 할머니가 반찬통을 들고 서 계셨다. "혼자 사는 학생, 밥은 챙겨 먹어야지."'; }
      const c = byTag(a, 'clerk');
      if (c) { a.focus(c); return '쓸쓸한 가을밤. 괜히 편의점에 갔다. {fp|이} 나를 보더니 "오늘 좀 늦게 오셨네요" 하고 말했다. 누군가 내가 오는 시간을 알고 있었다.'; }
      a.focus(null);
      return '쓸쓸한 가을밤. 아무한테도 연락이 오지 않았다. 창밖의 가로등만 깜빡였다.';
    },
    choices: [
      { label: '고맙다고 말한다', if: (s, a) => !!a.focused(), text: '"감사합니다." 목이 조금 메었다. 그날 밤은 덜 쓸쓸했다.', p: { close: [6, 9], trust: [4, 6] }, effect: { happy: 5 }, memory: true },
      { label: '혼자 버틴다', text: '이불을 머리끝까지 덮었다. 내일은 누구한테든 먼저 연락하자고 다짐했다.', effect: { happy: -1 } },
    ] },

  /* ───────── 겨울 ───────── */
  { id: 'fr_firstsnow', type: 'fixed', season: ['겨울'], when: fresh, weight: 7,
    text: '첫눈이 왔다. 창밖이 하얘지는 걸 보다가 휴대폰을 집어 들었다. 누구한테 제일 먼저 보낼까?',
    choices: [
      { label: '{crushName}', if: (s, a) => { const c = byTag(a, 'crush'); s.vars.crushName = c ? c.name : ''; return !!c; },
        do: all(focusT('crush'), rem('first_snow_text')),
        text: '"눈 와." 세 글자를 보냈다. 1초 만에 답장이 왔다. "알아. 나도 지금 너한테 보내려고 했어."',
        p: { heart: [8, 12] }, effect: { happy: 5 }, memory: true },
      { label: '{dongi1Name}', if: (s, a) => { const d = byTag(a, 'dongi1'); s.vars.dongi1Name = d ? d.name : ''; return !!d; },
        do: all(focusT('dongi1'), rem('first_snow_text')),
        text: '"눈 온다!!" {fp}에게서 동시에 같은 메시지가 왔다. 둘 다 웃음 이모티콘만 열 개씩 보냈다.',
        p: { close: [5, 8] }, effect: { happy: 4 }, memory: true },
      { label: '엄마', if: (s, a) => !!mom(a), do: (s, a) => a.focus(mom(a)),
        text: '엄마한테 눈 사진을 보냈다. "거기도 와? 여기도 와. 따뜻하게 입고 다녀." 같은 눈을 보고 있었다.',
        p: { close: [5, 8] }, effect: { happy: 3 } },
      { label: '아무한테도 안 보낸다', text: '혼자 창가에 앉아 눈을 봤다. 그것도 나쁘지 않았다.', effect: { happy: 1 } },
    ] },

  { id: 'fr_retake', type: 'random', on: ['home', 'campus'], season: ['겨울'],
    when: (s, a) => { const d = byTag(a, 'dongi3'); return fresh(s) && d && (remembers(d, 'cheer_retake') || remembers(d, 'sad_leave')); }, weight: 5,
    onStart: focusT('dongi3'),
    text: '수능 성적 발표 날 밤. {fp}에게서 전화가 왔다. 첫마디까지 한참이 걸렸다.',
    choices: [
      { label: '먼저 묻지 않고 기다린다', chance: .5,
        success: { text: '"붙었어. 원하던 데." {fp}의 목소리가 떨렸다. "네가 제일 먼저 생각났어. 밥 산다고 했잖아." 축하한다는 말이 잘 안 나왔다. 기뻐서, 그리고 조금 쓸쓸해서.',
          p: { trust: [8, 12], close: [5, 8] }, effect: { happy: 3 }, do: rem('retake_pass'), memory: true },
        fail: { text: '"망했어." 한참 침묵이 흐르고, {fp|이} 웃었다. "뭐, 2학년 같이 다니자. 후배 말고 동기로." 그 말이 이상하게 반가웠다.',
          p: { close: [8, 12], trust: [5, 8] }, effect: { happy: 2 }, do: rem('retake_fail'), memory: true } },
    ] },

  { id: 'fr_reconcile', type: 'random', on: ['campus', 'bar', 'home'], season: ['겨울'],
    when: (s, a) => { const d = byTag(a, 'dongi1'); return fresh(s) && d && remembers(d, 'fight_money') && (d.grudge || 0) >= 10; }, weight: 6,
    onStart: focusT('dongi1'),
    text: '2학기 종강파티. {fp|이} 반대편 끝자리에 앉았다. 한 학기 내내 그랬다. 봄에 같이 PC방 가던 게 먼 일 같았다.',
    choices: [
      { label: '먼저 옆자리로 간다', text: '잔을 들고 옆에 앉았다. "그때 내가 말을 너무 세게 했어." {fp|이} 한참 있다가 내 잔에 잔을 부딪쳤다. "나도 미안. 쪽팔려서 먼저 말을 못 했어."',
        p: { grudge: [-30, -20], close: [8, 12], trust: [6, 9] }, effect: { happy: 6 }, do: rem('reconciled'), memory: true },
      { label: '그냥 둔다', text: '끝까지 다른 사람들이랑만 얘기했다. 파티가 끝나고 {fp}의 뒷모습이 골목으로 사라졌다.',
        p: { close: [-5, -3] }, effect: { happy: -3 }, do: rem('drifted') },
    ] },

  { id: 'fr_finals2', type: 'must', season: ['겨울'], when: fresh,
    text: '2학기 기말이 끝났다. 시험장을 나오는데 공기가 차가웠다. 1학년이 거의 끝나가고 있었다.',
    effect: { happy: 2 }, then: 'fr_xmas' },

  { id: 'fr_xmas', type: 'trigger',
    text: (s, a) => { const m = a.main(); if (m) { a.focus(m); return '크리스마스이브. {fp|이} "오늘 뭐 할 거야?" 하고 물었다. 대답은 이미 정해져 있었다.'; }
      return '크리스마스이브. 단톡방에 "솔로들 우리 집으로"라는 메시지가 올라왔다.'; },
    choices: [
      { label: '{fp|와} 시내에 나간다', if: (s, a) => !!a.main(),
        text: '트리 앞에서 사진을 찍으려는데 사람이 너무 많았다. 결국 골목 붕어빵 가게 앞에서 찍었다. 그 사진이 제일 잘 나왔다.',
        p: { heart: [6, 10], close: [5, 8] }, effect: { happy: 6, money: -5 }, do: rem('xmas_together'), memory: true, then: 'fr_yearend' },
      { label: '솔로 파티에 간다', if: (s, a) => !a.main(), do: (s, a) => a.focus(byTag(a, 'dongi1') || byTag(a, 'dongi2')),
        text: '동기 자취방에 일곱 명이 모였다. 케이크는 하나, 포크는 세 개. 캐럴 대신 아이돌 노래를 불렀다. 외롭지 않은 크리스마스였다.',
        p: { close: [5, 8] }, effect: { happy: 5 }, do: rem('xmas_together'), memory: true, then: 'fr_yearend' },
      { label: '혼자 영화를 본다', text: '혼자 케이크 한 조각을 사서 영화를 봤다. 조용해서 좋았다.', effect: { happy: 1 }, then: 'fr_yearend' },
    ] },

  { id: 'fr_yearend', type: 'trigger', text: '12월 31일 밤 11시 55분. 카운트다운까지 5분.',
    choices: [
      { label: '제일 친한 사람한테 전화한다', if: (s, a) => a.find(x => x.kind !== 'family' && x.tag).length > 0,
        do: (s, a) => { const p = a.find(x => x.kind !== 'family' && x.tag).sort((x, y) => (y.close + y.heart) - (x.close + x.heart))[0]; if (p) { a.focus(p); rem('yearend')(s, a); } },
        text: '"5, 4, 3, 2, 1. 새해 복 많이 받아." 수화기 너머로 {fp}의 웃음소리가 들렸다. 1년 전엔 이 사람의 이름도 몰랐다.',
        p: { close: [5, 8] }, effect: { happy: 5 }, memory: true, then: 'fr_recap' },
      { label: '엄마한테 전화한다', if: (s, a) => !!mom(a), do: (s, a) => a.focus(mom(a)),
        text: '"엄마, 새해 복 많이 받아." 엄마가 "우리 애 벌써 2학년이네" 하고 말했다. 목소리가 조금 젖어 있었다.',
        p: { close: [6, 9] }, effect: { happy: 4, rel: { family: 4 } }, memory: true, then: 'fr_recap' },
      { label: '혼자 일기를 쓴다', text: '1년 치 일기를 넘겨봤다. 3월의 내가 지금의 나를 보면 뭐라고 할까.', effect: { happy: 2, art: 1 }, then: 'fr_recap' },
    ] },

  { id: 'fr_recap', type: 'trigger', memory: true,
    text: (s, a) => {
      const ppl = a.find(p => p.mem && p.mem.some(m => m.age === s.age))
        .sort((x, y) => ((y.close || 0) + (y.heart || 0)) - ((x.close || 0) + (x.heart || 0))).slice(0, 4);
      if (!ppl.length) return '1학년이 끝났다. 돌아보니 기억나는 얼굴이 별로 없다. 내년엔 조금 달라지고 싶다.';
      const bits = ppl.map(p => {
        const m = p.mem.filter(x => x.age === s.age && D.memLabel[x.tag]).sort((x, y) => (D.memWeight[y.tag] || 1) - (D.memWeight[x.tag] || 1))[0];
        return m ? `${a.josa(nm(p), '와')}의 ${D.memLabel[m.tag]}` : null;
      }).filter(Boolean);
      return '1학년이 끝났다. 남은 것들: ' + bits.join(', ') + '. 그게 올해의 전부였고, 충분했다.';
    } },

  /* ───────── 2학년 이후: 1학년의 기억이 돌아오는 순간들 ───────── */
  { id: 'cb_umbrella', type: 'random', on: ['campus', 'cafe', 'home'],
    when: (s, a) => after1(s) && wet(s) && !!memWho(a, 'umbrella_lent', 'umbrella_shared'), weight: 4,
    do: (s, a) => a.focus(memWho(a, 'umbrella_lent', 'umbrella_shared')),
    text: '또 비가 왔다. 우산 없이 서 있는데 누가 내 머리 위로 우산을 씌웠다. {fp|이} 웃었다. "그때 빌려준 거, 이번엔 내 차례."',
    p: { trust: [5, 8], heart: [3, 6], close: [4, 6] }, effect: { happy: 5 }, memory: true },

  { id: 'cb_usual', type: 'random', on: ['cafe'], when: (s, a) => { const b = byTag(a, 'barista'); return after1(s) && b && !remembers(b, 'usual_order'); }, weight: 4,
    do: all(focusT('barista'), rem('usual_order')),
    text: (s, a) => remembers(byTag(a, 'barista'), 'cafe_iced')
      ? '카페 문을 열자마자 {fp|이} 말했다. "아아 연하게, 맞죠?" 1년 동안 나는 이 카페의 단골이 되어 있었다.'
      : '카페에 들어서자 {fp|이} "늘 드시던 걸로요?" 하고 물었다. 1년 동안 나는 이 카페의 단골이 되어 있었다.',
    p: { close: [6, 9] }, effect: { happy: 3 } },

  { id: 'cb_halmeoni', type: 'random', on: ['home'], when: (s, a) => { const h = byTag(a, 'halmeoni'); return after1(s) && h && remembers(h, 'helped_bags') && !remembers(h, 'exam_food'); }, weight: 4,
    do: all(focusT('halmeoni'), rem('exam_food')),
    text: '시험 기간. 현관 앞에 식혜 한 병과 쪽지가 놓여 있었다. 삐뚤빼뚤한 글씨였다. "공부하느라 고생한다. 옆집."',
    p: { close: [6, 9] }, effect: { happy: 5, health: 2 }, memory: true },

  { id: 'cb_project', type: 'random', on: ['campus'], season: ['봄'],
    when: (s, a) => { const d = byTag(a, 'dongi2'); return after1(s) && s.flags.student && d && remembers(d, 'project_carry') && !remembers(d, 'project_again'); }, weight: 4,
    onStart: focusT('dongi2'),
    text: '새 학기 조 편성 날. 쭈뼛거리던 {fp|이} 내 앞에 와서 말했다. "이번에도… 같은 조 할래?" 1년 전보다 목소리가 커져 있었다.',
    choices: [
      { label: '당연하지', text: '"당연하지." {fp|이} 처음으로 크게 웃었다.', p: { close: [6, 9], trust: [5, 8] }, effect: { happy: 3 }, do: rem('project_again'), memory: true },
      { label: '이번엔 다른 조로', text: '"이번엔 다른 사람들이랑 해볼게." {fp|이} "응, 그래" 하고 돌아섰다.', p: { close: [-3, -1] } },
    ] },

  { id: 'cb_beach', type: 'fixed', season: ['여름'], when: (s, a) => { const p = memWho(a, 'beach_walk'); return after1(s) && p && !remembers(p, 'beach_again'); }, weight: 5,
    onStart: (s, a) => a.focus(memWho(a, 'beach_walk')),
    text: '{fp}에게서 메시지가 왔다. 사진 한 장. 작년 여름 그 바다였다. "올해도 갈래?"',
    choices: [
      { label: '간다', text: '같은 바다, 같은 밤, 같은 해변. 달라진 건 우리가 서로를 조금 더 안다는 것뿐이었다.', p: { heart: [6, 9], close: [5, 8] }, effect: { happy: 6, money: -20 }, do: rem('beach_again'), memory: true },
      { label: '이번엔 못 간다', text: '"이번엔 일정이 안 돼서." 답장을 보내고 사진을 오래 봤다.', p: { heart: [-3, -1] } },
    ] },

  { id: 'cb_firstsnow', type: 'fixed', season: ['겨울'], when: (s, a) => { const p = memWho(a, 'first_snow_text'); return after1(s) && p && !remembers(p, 'first_snow_again'); }, weight: 6,
    do: (s, a) => { a.focus(memWho(a, 'first_snow_text')); rem('first_snow_again')(s, a); },
    text: '첫눈이 왔다. 휴대폰을 집어 드는 순간, 먼저 울렸다. {fp}였다. "눈 와. 이번엔 내가 먼저야."',
    p: { close: [6, 9], heart: [4, 7] }, effect: { happy: 6 }, memory: true },

  { id: 'cb_profletter', type: 'random', on: ['campus', 'home'], age: [22, 27],
    when: (s, a) => { const p = byTag(a, 'prof'); return s.flags.labIntern && p && remembers(p, 'lab_yes') && !s.flags.profLetter; }, weight: 5,
    do: focusT('prof'), set: 'profLetter',
    text: '취업 준비로 정신없던 날, {fp}에게서 메일이 왔다. "추천서 필요하면 말하세요. 1학년 때부터 봐온 학생이니까." 첫 수업 날 맨 앞자리가 떠올랐다.',
    p: { trust: [8, 12] }, effect: { happy: 5 }, memory: true },

  { id: 'cb_sunbaejob', type: 'random', on: ['home', 'cafe', 'campus'], age: [22, 27],
    when: (s, a) => { const p = byTag(a, 'sunbae1'); return p && remembers(p, 'sunbae_listen') && !s.flags.sunbaeJob; }, weight: 4,
    onStart: focusT('sunbae1'), set: 'sunbaeJob',
    text: '오랜만에 {fp}에게 연락이 왔다. "우리 회사에 인턴 자리 났어. 너 생각나서. 그때 내 얘기 끝까지 들어줬잖아."',
    choices: [
      { label: '지원한다', text: '{fp}의 추천으로 서류를 냈다. 면접장 앞에서 {fp|이} 엄지를 들어 보였다.', p: { trust: [6, 9] }, effect: { happy: 4 }, set: 'internReady', memory: true },
      { label: '고맙지만 다른 길을 간다', text: '"선배, 고마워요. 근데 저는 다른 쪽을 보고 있어서요." {fp|이} "역시 너답다" 하고 웃었다.', p: { close: [3, 5] } },
    ] },
];

D.events = (D.events || []).concat(FR);
})();
