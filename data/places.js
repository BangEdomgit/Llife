// 장소 — 행동 1을 써서 가고, 거기 있는 사람에게 말을 걸거나(행동 안 씀) 장소 행동을 함(행동 1)
//
// minAge / maxAge   이 나이일 때만 목록에 보임
// open(s, a)        갈 수 있는지 (false면 버튼이 비활성화). closed: 막혔을 때 보여줄 말
// night: true       저녁(계절의 마지막 행동)에만 열림
// regulars          아는 사람 중 여기 나올 수 있는 관계 종류(kind). 함수면 후보 목록을 직접 돌려줌
//                   NPC의 hangout이 이 장소면 종류와 상관없이 잘 나옴
// regularsN         나오는 아는 사람 수 [최소, 최대] (기본 [1, 2])
// crowd             처음 보는 사람들의 나이대: kid / peer / adult / mixed (배열이면 사람마다 하나 고름). 없으면 아무도 없음
// crowdN            처음 보는 사람 수 [최소, 최대] (기본 [0, 2]) / nightCrowd: 저녁에 바뀌는 나이대
// kind              여기서 알게 된 사람의 관계 종류 (기본 friend)
// hobby             처음 보는 사람이 이 취미일 확률이 높음
// doing             거기 있는 사람이 하고 있는 일 (함수면 (s, p, a) → 목록) / nightDoing: 저녁에만
// arrive            도착했을 때 한 줄
// actions           여기서 할 수 있는 행동 id (data/life.js의 actions)
// routine: true     매일 가는 곳이라 단골이 따로 없음
window.GAME_DATA = window.GAME_DATA || {};

(function () {
// 집에 같이 사는 사람: 독립 전엔 부모님·형제, 결혼하면 배우자, 같이 사는 연인, 아이들
function household(s, a) {
  const out = [];
  const withParents = !s.flags.ownPlace && !s.flags.married;
  for (const p of a.find(() => true)) {
    if (p.spouse || p.livesWith) out.push(p);
    else if (p.kind === 'child' && a.npcAge(p) < 20) out.push(p);
    else if (withParents && p.kind === 'family' && (!p.sibling || a.npcAge(p) < 25)) out.push(p);
  }
  return out;
}

GAME_DATA.places = [
  { id: 'home', label: '집', icon: '🏠', minAge: 0, routine: true,
    regulars: household, regularsN: [1, 4],
    doing: (s, p, a) => a.npcAge(p) < 8 ? ['블록을 쌓고 있다', '만화를 보고 있다', '바닥에 엎드려 그림을 그리고 있다', '장난감을 늘어놓고 있다']
      : a.npcAge(p) < 19 ? ['방에서 숙제를 하고 있다', '휴대폰을 붙잡고 누워 있다', '냉장고 문을 열고 서 있다', '방문을 닫고 음악을 듣고 있다']
      : ['TV를 보고 있다', '부엌에서 뭔가 만들고 있다', '빨래를 개고 있다', '소파에 누워 휴대폰을 보고 있다', '식탁에 앉아 신문을 읽고 있다', '베란다 화분에 물을 주고 있다'],
    arrive: s => s.age < 4 ? ['집에서 하루를 보냈다.', '엄마 품에서 하루를 보냈다.'] : ['오늘은 집에 있기로 했다.', '현관문을 닫자 바깥 소리가 멀어졌다.', '집에서 하루를 보내기로 했다.'],
    actions: ['rest', 'study', 'read', 'game', 'make', 'artPrac', 'selfRelief'] },

  { id: 'playground', label: '놀이터', icon: '🛝', minAge: 4, maxAge: 12,
    regulars: ['classmate', 'friend'], crowd: 'kid', crowdN: [1, 3],
    doing: ['그네를 타고 있다', '모래성을 쌓고 있다', '미끄럼틀을 거꾸로 올라가고 있다', '딱지를 치고 있다', '술래잡기 술래를 하고 있다', '쪼그려 앉아 개미를 구경하고 있다'],
    arrive: ['놀이터에 나갔다. 그네가 하나 비어 있었다.', '놀이터 모래 냄새가 났다.', '놀이터에서 누가 이름을 불렀다.'],
    actions: ['play', 'exercise'] },

  { id: 'park', label: '공원', icon: '🌳', minAge: 4,
    regulars: ['friend', 'classmate'], crowd: 'mixed', hobby: 'sport',
    doing: ['벤치에 앉아 책을 읽고 있다', '강아지와 산책하고 있다', '조깅을 하고 있다', '돗자리를 펴고 누워 있다', '비둘기에게 과자 부스러기를 던지고 있다', '이어폰을 끼고 호수를 보고 있다', '배드민턴을 치고 있다'],
    arrive: ['공원에 나갔다. 바람이 좋았다.', '공원 산책로를 따라 걸었다.', '공원 벤치에 자리를 잡았다.'],
    actions: ['walk', 'exercise'] },

  { id: 'school', label: '학교', icon: '🏫', minAge: 7, maxAge: 18, routine: true,
    regulars: ['classmate'], regularsN: [1, 3], crowd: 'peer', kind: 'classmate',
    doing: ['엎드려 자고 있다', '친구들과 떠들고 있다', '창밖을 멍하니 보고 있다', '숙제를 베끼고 있다', '매점 빵을 먹고 있다', '교과서 귀퉁이에 낙서를 하고 있다', '복도를 뛰어가고 있다'],
    arrive: s => s.age < 13 ? ['교문 앞에서 실내화 주머니를 흔들었다.', '교실에 들어서자 떠드는 소리가 쏟아졌다.'] : ['교실 문을 열었다. 다들 엎드려 있었다.', '1교시 종이 울리기 직전에 도착했다.', '교복 넥타이를 대충 매고 등교했다.'],
    actions: ['study', 'exercise', 'read'] },

  { id: 'academy', label: '학원', icon: '📝', minAge: 7, maxAge: 18, routine: true,
    regulars: ['friend', 'classmate'], crowd: 'peer',
    doing: ['영어 단어장을 외우고 있다', '컵라면으로 저녁을 때우고 있다', '쉬는 시간에 졸고 있다', '선생님 몰래 휴대폰을 보고 있다', '문제집 답지를 슬쩍 보고 있다'],
    arrive: ['학원 버스에서 내렸다.', '학원 계단을 올라갔다. 형광등이 눈부셨다.', '학원 복도에서 컵라면 냄새가 났다.'],
    actions: ['cram'] },

  { id: 'campus', label: '대학', icon: '🎓', minAge: 19, routine: true,
    open: s => !!s.flags.student, closed: '학생만',
    regulars: ['friend', 'classmate'], crowd: 'peer',
    doing: ['과제를 하고 있다', '잔디밭에 앉아 있다', '동아리 홍보 전단을 나눠주고 있다', '학식 줄에 서 있다', '노트북으로 수강신청 화면을 보고 있다', '강의실 맨 뒷자리에서 졸고 있다'],
    arrive: ['캠퍼스 언덕을 올라갔다.', '강의실 창밖으로 잔디밭이 보였다.', '학교 앞 카페 거리를 지나 정문에 들어섰다.'],
    actions: ['study', 'read'] },

  { id: 'office', label: '직장', icon: '💼', minAge: 19, routine: true,
    open: s => !!s.job, closed: '직업이 있어야',
    regulars: ['coworker'], crowd: 'adult', crowdN: [0, 1], kind: 'coworker',
    doing: ['모니터를 노려보고 있다', '커피를 타고 있다', '한숨을 쉬고 있다', '점심 메뉴를 고민하고 있다', '바쁘게 오가고 있다', '휴대폰으로 뭔가 확인하고 있다', '기지개를 켜고 있다'],
    arrive: ['출근했다.', '출근 카드를 찍었다.', '오늘도 일터에 나왔다.'],
    actions: ['work', 'overtime'] },

  { id: 'cafe', label: '카페', icon: '☕', minAge: 13,
    regulars: ['friend', 'coworker'], crowd: 'peer',
    doing: ['창가 자리에서 노트북을 두드리고 있다', '책을 펴놓고 졸고 있다', '친구와 수다를 떨고 있다', '아이스 아메리카노 얼음을 씹고 있다', '이어폰을 끼고 창밖을 보고 있다', '케이크 사진을 찍고 있다', '혼자 다이어리를 쓰고 있다'],
    arrive: ['카페 문을 열자 커피 향이 확 풍겼다.', '구석 자리에 가방을 내려놨다.', '카페 창가 자리가 비어 있었다.'],
    actions: ['coffee', 'study', 'read', 'parttime'] },

  { id: 'library', label: '도서관', icon: '📚', minAge: 7,
    regulars: ['classmate', 'friend'], crowd: 'peer', hobby: 'book',
    doing: ['두꺼운 책에 파묻혀 있다', '시험공부를 하고 있다', '서가 사이를 서성이고 있다', '책상에 엎드려 자고 있다', '열람실 창가에서 책을 읽고 있다'],
    arrive: ['도서관에 들어서자 종이 냄새가 났다.', '열람실 자리를 하나 맡았다.', '도서관은 오늘도 조용했다.'],
    actions: ['study', 'read'] },

  { id: 'gym', label: '헬스장', icon: '🏋', minAge: 14,
    regulars: ['friend', 'coworker'], crowd: 'peer', hobby: 'sport',
    doing: ['러닝머신 위를 달리고 있다', '거울 앞에서 덤벨을 들고 있다', '스트레칭을 하고 있다', '기구에 앉아 쉬는 척 휴대폰을 보고 있다', '땀을 닦으며 물을 마시고 있다'],
    arrive: ['헬스장 음악이 쿵쿵 울렸다.', '운동화 끈을 단단히 묶었다.', '헬스장 거울 속 내가 낯설었다.'],
    actions: ['exercise'] },

  { id: 'pcbang', label: 'PC방', icon: '🎮', minAge: 12,
    regulars: ['friend', 'classmate'], crowd: 'peer', hobby: 'game',
    doing: ['헤드셋을 끼고 소리를 지르고 있다', '라면을 먹으며 게임하고 있다', '랭크 게임에 집중하고 있다', '옆자리 화면을 구경하고 있다', '의자에 기대 자고 있다'],
    arrive: ['PC방 구석 자리에 앉았다.', '키보드 소리가 빗소리처럼 들렸다.', '자리에 앉자마자 라면부터 시켰다.'],
    actions: ['game'] },

  { id: 'mall', label: '번화가', icon: '🛍', minAge: 10,
    regulars: ['friend'], crowd: ['peer', 'mixed'], crowdN: [1, 3], hobby: 'fashion',
    doing: ['쇼윈도를 구경하고 있다', '쇼핑백을 잔뜩 들고 있다', '길거리 음식을 먹고 있다', '누군가를 기다리며 시계를 보고 있다', '버스킹을 구경하고 있다', '사진관 앞에 줄을 서 있다'],
    arrive: ['번화가는 사람으로 북적였다.', '길거리 음식 냄새에 발걸음이 느려졌다.', '버스킹 소리가 멀리서 들려왔다.'],
    actions: ['shop', 'style', 'parttime'] },

  { id: 'hospital', label: '병원', icon: '🏥', minAge: 5,
    regulars: [], regularsN: [0, 1], crowd: 'mixed', crowdN: [0, 2],
    doing: ['대기실에서 번호표를 쥐고 있다', '링거를 꽂은 채 복도를 걷고 있다', '접수창구 앞에서 서류를 쓰고 있다', '기침을 참고 있다', '깁스를 한 다리를 뻗고 앉아 있다'],
    arrive: ['병원 소독약 냄새가 났다.', '번호표를 뽑고 대기실에 앉았다.', '병원 대기실 TV에서 뉴스가 나오고 있었다.'],
    actions: ['doctor'] },

  { id: 'center', label: '복지관', icon: '🤝', minAge: 12,
    regulars: [], regularsN: [0, 1], crowd: 'mixed',
    doing: ['배식 준비를 하고 있다', '어르신과 바둑을 두고 있다', '아이들에게 책을 읽어주고 있다', '봉사 시간 확인서를 쓰고 있다', '박스를 나르고 있다'],
    arrive: ['복지관 게시판에 봉사자 모집 공고가 붙어 있었다.', '복지관 앞에서 어르신들이 햇볕을 쬐고 계셨다.'],
    actions: ['volunteer', 'donate'] },

  { id: 'station', label: '터미널', icon: '🚉', minAge: 20,
    regulars: [], regularsN: [0, 0], crowd: 'mixed', crowdN: [0, 1], hobby: 'travel',
    doing: ['캐리어에 걸터앉아 있다', '전광판을 올려다보고 있다', '도시락을 먹고 있다', '누군가를 배웅하며 손을 흔들고 있다', '지도 앱을 들여다보고 있다'],
    arrive: ['터미널 전광판에 행선지가 줄줄이 떠 있었다.', '표를 끊고 대합실 의자에 앉았다.'],
    actions: ['travel'] },

  /* ── v4에서 추가 ── */
  { id: 'bar', label: '술집', icon: '🍺', minAge: 19, night: true,
    regulars: ['friend', 'coworker'], crowd: 'adult', crowdN: [1, 3],
    doing: ['혼자 소주잔을 기울이고 있다', '친구들과 건배를 하고 있다', '바 자리에서 하이볼을 마시고 있다', '메뉴판을 한참 들여다보고 있다', '취해서 노래를 흥얼거리고 있다', '휴대폰을 보며 누군가를 기다리고 있다', '사장님과 이야기를 나누고 있다'],
    arrive: ['간판 불빛이 번지는 골목으로 들어갔다.', '문을 열자 잔 부딪히는 소리가 쏟아졌다.', '바 자리에 앉아 메뉴판을 펼쳤다.'],
    actions: ['drink'] },

  { id: 'church', label: '종교시설', icon: '🙏', minAge: 4,
    regulars: ['friend', 'classmate'], crowd: 'mixed',
    doing: ['조용히 기도하고 있다', '두 손을 모으고 앉아 있다', '모임이 끝나고 다과를 나누고 있다', '마당을 쓸고 있다', '아이들을 돌보고 있다', '구석에 앉아 졸고 있다'],
    arrive: ['낮은 종소리가 들렸다.', '신발을 벗고 조용히 들어갔다.', '오래된 나무 의자에 앉았다.'],
    actions: ['pray'] },

  { id: 'conveni', label: '편의점', icon: '🏪', minAge: 6,
    regulars: ['friend', 'classmate'], regularsN: [0, 1], crowd: 'mixed', nightCrowd: 'adult', crowdN: [0, 2],
    doing: ['삼각김밥을 고르고 있다', '컵라면에 물을 붓고 있다', '1+1 행사 상품을 들여다보고 있다', '계산대 앞에서 지갑을 뒤지고 있다', '파라솔 아래서 음료를 마시고 있다'],
    nightDoing: ['슬리퍼 차림으로 야식을 고르고 있다', '맥주 네 캔을 계산하고 있다', '라면을 먹으며 한숨을 쉬고 있다', '잠옷 위에 패딩을 걸치고 서 있다', '편의점 불빛 아래 혼자 서 있다'],
    arrive: s => s.time === 2 ? ['늦은 밤, 편의점 불빛만 환했다.', '야식이 당겨서 슬리퍼를 끌고 나왔다.'] : ['편의점 문이 띵동 하고 열렸다.', '편의점 냉장고 앞에서 한참 고민했다.'],
    actions: ['snack', 'parttime'] },

  { id: 'concert', label: '공연장', icon: '🎵', minAge: 15,
    regulars: ['friend'], regularsN: [0, 1], crowd: ['peer', 'adult'], crowdN: [1, 3], hobby: 'music',
    doing: ['응원봉을 흔들고 있다', '앞줄에서 따라 부르고 있다', '굿즈 줄에 서 있다', '셋리스트를 확인하고 있다', '눈을 감고 음악에 빠져 있다'],
    arrive: ['공연장 앞에 긴 줄이 늘어서 있었다.', '조명이 꺼지자 함성이 터졌다.', '스피커 앞에 서자 가슴이 울렸다.'],
    actions: ['watch'] },
];

// NPC가 자주 가는 곳 — 취미에 따라 (나이에 맞는 곳만 고름)
GAME_DATA.hangoutByHobby = {
  game: ['pcbang', 'cafe'], sport: ['gym', 'park'], music: ['concert', 'bar', 'cafe'], book: ['library', 'cafe'],
  cook: ['mall', 'conveni'], travel: ['station', 'park'], draw: ['cafe', 'park'], fashion: ['mall', 'cafe'],
};
// 단골이 되는 방문 횟수
GAME_DATA.regularVisits = 3;
})();
