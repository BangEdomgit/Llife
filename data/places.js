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
// ms: true          중학생(13~15살)도 갈 수 있는 곳 (그 나이엔 갈 수 있는 곳이 적음)
// 어른은 구역(js/game.js ZONE)마다 이동 칸이 다름: 같은 구역 0칸, 다른 구역 1칸, 여행지(터미널) 2칸
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
  { id: 'home', ms: true, label: '집', icon: '🏠', minAge: 0, routine: true,
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

  { id: 'park', ms: true, label: '공원', icon: '🌳', minAge: 4,
    regulars: ['friend', 'classmate'], crowd: 'mixed', hobby: 'sport',
    doing: ['벤치에 앉아 책을 읽고 있다', '강아지와 산책하고 있다', '조깅을 하고 있다', '돗자리를 펴고 누워 있다', '비둘기에게 과자 부스러기를 던지고 있다', '이어폰을 끼고 호수를 보고 있다', '배드민턴을 치고 있다'],
    arrive: ['공원에 나갔다. 바람이 좋았다.', '공원 산책로를 따라 걸었다.', '공원 벤치에 자리를 잡았다.'],
    actions: ['walk', 'exercise'] },

  { id: 'school', ms: true, label: '학교', icon: '🏫', minAge: 7, maxAge: 18, routine: true,
    regulars: ['classmate'], regularsN: [1, 3], crowd: 'peer', kind: 'classmate',
    doing: ['엎드려 자고 있다', '친구들과 떠들고 있다', '창밖을 멍하니 보고 있다', '숙제를 베끼고 있다', '매점 빵을 먹고 있다', '교과서 귀퉁이에 낙서를 하고 있다', '복도를 뛰어가고 있다'],
    arrive: s => s.age < 13 ? ['교문 앞에서 실내화 주머니를 흔들었다.', '교실에 들어서자 떠드는 소리가 쏟아졌다.'] : ['교실 문을 열었다. 다들 엎드려 있었다.', '1교시 종이 울리기 직전에 도착했다.', '교복 넥타이를 대충 매고 등교했다.'],
    actions: ['study', 'club', 'exercise', 'read'] },

  { id: 'academy', ms: true, label: '학원', icon: '📝', minAge: 7, maxAge: 18, routine: true,
    regulars: ['friend', 'classmate'], crowd: 'peer',
    doing: ['영어 단어장을 외우고 있다', '컵라면으로 저녁을 때우고 있다', '쉬는 시간에 졸고 있다', '선생님 몰래 휴대폰을 보고 있다', '문제집 답지를 슬쩍 보고 있다'],
    arrive: ['학원 버스에서 내렸다.', '학원 계단을 올라갔다. 형광등이 눈부셨다.', '학원 복도에서 컵라면 냄새가 났다.'],
    actions: ['cram'] },

  { id: 'campus', label: '대학', campusLabel: '정문', icon: '🎓', minAge: 19, routine: true, campus: true,
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

  { id: 'library', ms: true, label: '도서관', icon: '📚', minAge: 7,
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

  // 🍽 동네 식당 — 백반·찌개·돈가스 (메뉴: data/food.js menus.diner). 점심·저녁에 붐빔
  { id: 'diner', label: '식당', icon: '🍽', minAge: 19,
    regulars: ['friend', 'neighbor', 'coworker'], regularsN: [0, 1], crowd: 'mixed', crowdN: [2, 4], hobby: 'cook',
    doing: ['김치찌개를 떠먹고 있다', '혼자 TV를 보며 밥을 먹고 있다', '메뉴판을 한참 보고 있다', '반찬을 더 달라고 하고 있다', '계산대 앞에서 지갑을 꺼내고 있다', '동료들과 점심을 먹고 있다', '휴대폰을 세워 두고 밥을 먹고 있다'],
    arrive: ['식당 문을 열자 찌개 끓는 냄새가 났다.', '"어서 오세요, 아무 데나 앉으세요."', '벽에 붙은 메뉴판 글씨가 바래 있었다.'],
    actions: [] },

  { id: 'hospital', label: '병원', icon: '🏥', minAge: 5,
    regulars: [], regularsN: [0, 1], crowd: 'mixed', crowdN: [0, 2],
    doing: ['대기실에서 번호표를 쥐고 있다', '링거를 꽂은 채 복도를 걷고 있다', '접수창구 앞에서 서류를 쓰고 있다', '기침을 참고 있다', '깁스를 한 다리를 뻗고 앉아 있다'],
    arrive: ['병원 소독약 냄새가 났다.', '번호표를 뽑고 대기실에 앉았다.', '병원 대기실 TV에서 뉴스가 나오고 있었다.'],
    actions: ['doctor', 'pill', 'pillStop'] },

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

  // 모텔 — 동행이 있을 때만 (잠자리 제안·가볍게 즐기기를 받아준 사람과). 다른 사람은 없음. 들어가서 '즐기기'
  { id: 'motel', label: '모텔', icon: '🏩', minAge: 20,
    open: s => !!s.companion, closed: '같이 갈 사람이 있어야',
    regulars: () => [], regularsN: [0, 0],
    doing: ['침대 끝에 앉아 나를 보고 있다', '창가 블라인드를 내리고 있다', '거울 앞에서 머리를 넘기고 있다', '신발을 벗어 던지고 있다'],
    arrive: ['프런트 창구 너머로 열쇠를 받았다. 복도 끝 방이었다.', '엘리베이터 거울 속 둘이 서로를 보고 웃었다.', '방 문이 닫히자 네온 불빛만 블라인드 사이로 새어 들어왔다.'],
    actions: ['rest'] },

  { id: 'church', label: '종교시설', icon: '🙏', minAge: 4,
    regulars: ['friend', 'classmate'], crowd: 'mixed',
    doing: ['조용히 기도하고 있다', '두 손을 모으고 앉아 있다', '모임이 끝나고 다과를 나누고 있다', '마당을 쓸고 있다', '아이들을 돌보고 있다', '구석에 앉아 졸고 있다'],
    arrive: ['낮은 종소리가 들렸다.', '신발을 벗고 조용히 들어갔다.', '오래된 나무 의자에 앉았다.'],
    actions: ['pray'] },

  { id: 'conveni', ms: true, label: '편의점', icon: '🏪', minAge: 6,
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

  { id: 'market', ms: true, label: '시장', icon: '🧺', minAge: 6,
    regulars: ['friend', 'classmate', 'family'], regularsN: [0, 1], crowd: 'mixed', crowdN: [1, 3], hobby: 'cook',
    doing: ['떡볶이 포장마차 앞에 서 있다', '덤으로 귤을 더 받아 웃고 있다', '흥정하고 있다', '어묵 국물을 호호 불고 있다', '장바구니를 들고 걷고 있다', '호떡을 기다리고 있다'],
    arrive: ['시장 골목에 기름 냄새가 가득했다.', '"싸요 싸!" 상인들 목소리가 골목을 채웠다.', '시장 입구에서 호떡 냄새가 났다.'],
    actions: ['snack', 'walk'] },

  /* ── 대학 캠퍼스 (지도에서 '대학'에 들어가면 캠퍼스 지도 — data/map.js campus) — 학생만. 캠퍼스 안 이동은 행동력 1 ── */
  { id: 'lecture', label: '강의실', icon: '🏫', minAge: 19, routine: true, campus: true, open: s => !!s.flags.student, closed: '학생만',
    regulars: ['classmate', 'friend'], crowd: 'peer', kind: 'classmate',
    doing: ['맨 앞자리에서 필기하고 있다', '노트북으로 과제를 하고 있다', '맨 뒷자리에서 졸고 있다', '출석 부르기 전에 뛰어 들어왔다', '조별 과제 카톡을 보고 있다', '교수님께 질문하러 가고 있다'],
    arrive: ['강의실 뒷문으로 조용히 들어갔다.', '형광등 아래 책상들이 줄지어 있었다.', '칠판에 지난 수업 판서가 남아 있었다.'],
    actions: ['study', 'read'] },
  { id: 'cafeteria', label: '학생식당', icon: '🍱', minAge: 19, campus: true, open: s => !!s.flags.student, closed: '학생만',
    regulars: ['classmate', 'friend'], crowd: 'peer',
    doing: ['식판을 들고 빈자리를 찾고 있다', '돈가스를 먹고 있다', '친구들과 밥을 먹으며 떠들고 있다', '혼자 이어폰을 끼고 밥을 먹고 있다', '메뉴판 앞에서 고민하고 있다'],
    arrive: ['학생식당에 긴 줄이 늘어서 있었다.', '오늘의 메뉴: 돈가스, 김치볶음밥, 라면.', '식판 부딪히는 소리가 요란했다.'],
    actions: [] },   // 학식 메뉴 (data/food.js menus.cafeteria)
  { id: 'ulib', label: '중앙도서관', icon: '📚', minAge: 19, campus: true, open: s => !!s.flags.student, closed: '학생만',
    regulars: ['classmate', 'friend'], crowd: 'peer', hobby: 'book',
    doing: ['열람실에서 전공 책을 보고 있다', '노트북으로 리포트를 쓰고 있다', '책상에 엎드려 자고 있다', '서가 사이를 서성이고 있다', '스터디룸에서 토론하고 있다'],
    arrive: ['도서관 게이트에 학생증을 찍었다.', '열람실은 숨소리까지 들릴 만큼 조용했다.', '시험 기간이라 빈자리가 없었다.'],
    actions: ['study', 'read'] },
  { id: 'clubroom', label: '동아리방', icon: '🎸', minAge: 19, campus: true, open: s => !!s.flags.student, closed: '학생만',
    regulars: (s, a) => a.clubMates(), regularsN: [2, 6],
    doing: ['기타 줄을 갈고 있다', '소파에 누워 휴대폰을 보고 있다', '공연 포스터를 그리고 있다', '라면을 끓이고 있다', 'MT 장소를 검색하고 있다', '선배가 남긴 낙서를 읽고 있다'],
    arrive: ['동아리방 문을 열자 낡은 소파와 기타가 보였다.', '"왔어?" 누군가 고개도 안 들고 말했다.', '벽에 역대 공연 사진이 빼곡했다.'],
    actions: ['uclub'] },
  { id: 'quad', label: '잔디밭', icon: '🌿', minAge: 19, campus: true, open: s => !!s.flags.student, closed: '학생만',
    regulars: ['classmate', 'friend'], crowd: 'peer',
    doing: ['돗자리를 펴고 누워 있다', '짜장면을 시켜 먹고 있다', '기타를 치며 노래하고 있다', '프리스비를 던지고 있다', '나무 그늘에서 책을 읽고 있다'],
    arrive: ['잔디밭에 햇살이 가득했다.', '광장 한가운데서 누가 버스킹을 하고 있었다.', '벤치에 앉아 캠퍼스를 내려다봤다.'],
    actions: ['walk', 'rest'] },
  { id: 'union', label: '학생회관', icon: '🏛', minAge: 19, campus: true, open: s => !!s.flags.student, closed: '학생만',
    regulars: ['classmate', 'friend'], crowd: 'peer',
    doing: ['게시판에서 공모전 포스터를 보고 있다', '학생회실에서 회의를 하고 있다', '복사실 앞에 줄을 서 있다', '매점에서 삼각김밥을 고르고 있다', '분실물 센터를 기웃거리고 있다'],
    arrive: ['학생회관 1층 게시판이 포스터로 뒤덮여 있었다.', '복사기 돌아가는 소리가 났다.', '매점 앞에 사람이 북적였다.'],
    actions: ['coffee', 'snack'] },

  /* ── 아이 시설 (data/map.js kids) — 집에서 가장 가까운 유치원·초등학교. 그 나이 아이가 있거나 거기서 일하면 ── */
  // 등원·하원 시간엔 아이 데리러 온 엄마·아빠(대부분 기혼)가 모임 (data/encounter.js crowds)
  { id: 'kinder', label: '유치원', icon: '🧸', minAge: 20, crowd: 'adult', crowdN: [3, 7], kind: 'friend',
    open: (s, a) => s.job === 'kinder' || a.find(p => p.kind === 'child' && a.npcAge(p) >= 3 && a.npcAge(p) <= 6).length > 0, closed: '아이가 있어야',
    regulars: (s, a) => a.find(p => p.kind === 'child' && a.npcAge(p) >= 3 && a.npcAge(p) <= 6), regularsN: [1, 3],
    doing: (s, p, a) => a.npcAge(p) < 8 ? ['선생님 손을 잡고 나온다', '가방을 질질 끌고 온다', '친구랑 손잡고 뛰어온다'] : ['아이를 기다리고 있다', '다른 엄마들과 이야기하고 있다', '휴대폰을 보며 서 있다', '아이 가방을 받아 들고 있다', '유치원 버스를 기다리고 있다', '알림장을 확인하고 있다'],
    arrive: ['유치원 앞에 노란 버스가 서 있었다.', '하원 시간, 아이들 웃음소리가 담장 너머로 들렸다.', '엄마들이 삼삼오오 모여 수다를 떨고 있었다.'],
    actions: ['pickup'] },
  { id: 'elem', label: '초등학교', icon: '🏫', minAge: 20, crowd: 'adult', crowdN: [3, 7], kind: 'friend',
    open: (s, a) => s.job === 'teacher' || a.find(p => p.kind === 'child' && a.npcAge(p) >= 7 && a.npcAge(p) <= 12).length > 0, closed: '아이가 있어야',
    regulars: (s, a) => a.find(p => p.kind === 'child' && a.npcAge(p) >= 7 && a.npcAge(p) <= 12), regularsN: [1, 3],
    doing: (s, p, a) => a.npcAge(p) < 13 ? ['실내화 가방을 흔들며 나온다', '친구들과 떡볶이 사러 간다', '운동장에서 공을 차고 있다'] : ['교문 앞에서 아이를 기다리고 있다', '학부모 단톡방을 보고 있다', '다른 학부모와 학원 이야기를 하고 있다', '녹색 어머니 깃발을 들고 있다', '우산을 들고 서 있다'],
    arrive: ['교문 앞에 학부모들이 줄지어 서 있었다.', '수업 끝 종이 울렸다.', '운동장에서 아이들이 쏟아져 나왔다.'],
    actions: ['pickup'] },

  /* ── 집·부동산 (data/housing.js) ── */
  // 우리 집 앞 — 사는 집에 따라 이름이 바뀜 (원룸 건물 앞·아파트 단지·고시원 복도 …). 같은 건물·단지 이웃이 오감
  { id: 'block', ms: true, label: '집 앞', icon: '🏘', minAge: 4,
    regulars: (s, a) => a.neighbors(), regularsN: [2, 6],
    doing: (s, p, a) => a.npcAge(p) < 13 ? ['킥보드를 타고 있다', '엄마 손을 잡고 서 있다', '책가방을 메고 뛰어간다', '놀이터에서 그네를 타고 있다', '아이스크림을 먹고 있다'] : a.homeSpot().doing,
    arrive: (s, a) => [`${a.homeSpot().label}에 나왔다.`, '현관문을 나서자 이웃과 눈이 마주쳤다.', '분리수거 봉투를 들고 내려왔다.', '택배를 찾으러 나왔다.'],
    actions: ['walk'] },
  // 부동산 — 집 보러 다니기·이사 (본가·고시원·원룸·오피스텔·빌라·아파트·주택)
  { id: 'realty', label: '부동산', icon: '🔑', minAge: 19, crowd: 'adult', crowdN: [0, 2],
    doing: ['매물 전단을 보고 있다', '계약서를 읽고 있다', '중개사와 이야기하고 있다', '지도 앱으로 역까지 거리를 재고 있다', '보증금을 계산하고 있다'],
    arrive: ['유리문에 매물 전단이 빽빽하게 붙어 있었다.', '중개사가 믹스커피를 타 줬다.', '"어떤 집 찾으세요?"'],
    actions: ['houseHunt'] },
];

// NPC가 자주 가는 곳 — 취미에 따라 (나이에 맞는 곳만 고름)
GAME_DATA.hangoutByHobby = {
  game: ['pcbang', 'cafe'], sport: ['gym', 'park'], music: ['concert', 'bar', 'cafe'], book: ['library', 'cafe'],
  cook: ['mall', 'conveni'], travel: ['station', 'park'], draw: ['cafe', 'park'], fashion: ['mall', 'cafe'],
};
// 단골이 되는 방문 횟수
GAME_DATA.regularVisits = 3;

// 장소에서 일하는 사람 (필수 인물) — 그 장소에 가면 늘 있음 (js/game.js staffOf)
//   role 관계 이름(뉴욕은 ny) · job 직업 · age 나이 · gender 성별(없으면 아무나) · pers 성격 후보 · doing 하고 있는 일
//   tag  대학 1학년 고정 인물과 같은 사람 (data/freshman.js — prof 교수님, sunbae2 동아리 회장)
//   when 이때만 (예: 학교 선생님은 수업이 있는 날) · 집 근처 장소(편의점·식당·학교 …)는 사는 동네마다, 학교 담임은 해마다 바뀜
const W = ['warm', 'sunny', 'cool', 'sharp', 'bold', 'shy', 'playful', 'sensitive'];
GAME_DATA.staff = {
  school: [{ role: '담임 선생님', job: '선생님', age: [28, 56], pers: ['warm', 'sharp', 'cool', 'sunny'], doing: ['출석부를 들고 복도를 걷고 있다', '교무실에서 수행평가를 채점하고 있다', '칠판에 내일 일정을 적고 있다', '복도에서 뛰는 애들을 부르고 있다', '상담 일지를 쓰고 있다'] },
    { role: '체육 선생님', job: '선생님', age: [30, 50], gender: 'm', pers: ['bold', 'sunny'], doing: ['호루라기를 목에 걸고 운동장에 서 있다', '공 바구니를 끌고 간다', '팔짱을 끼고 줄 서는 걸 보고 있다'] }],
  academy: [{ role: '학원 선생님', ny: '튜터', job: '학원 강사', age: [26, 45], pers: ['sharp', 'sunny', 'cool'], doing: ['오답 노트를 걷고 있다', '화이트보드에 문제를 쓰고 있다', '단어 시험지를 나눠 주고 있다', '"숙제 안 해 온 사람?" 하고 묻고 있다'] }],
  library: [{ role: '사서', job: '사서', age: [28, 55], pers: ['cool', 'shy', 'warm'], doing: ['반납된 책을 꽂고 있다', '대출 데스크에서 바코드를 찍고 있다', '"조용히 해 주세요" 쪽지를 붙이고 있다', '신간 코너를 정리하고 있다'] }],
  lecture: [{ tag: 'prof', role: '교수님', job: '교수', age: [45, 64], pers: ['cool', 'sharp', 'warm'], doing: ['강의 자료를 띄우고 있다', '출석을 부르고 있다', '"질문 있습니까?" 하고 강의실을 둘러보고 있다', '칠판 가득 필기하고 있다', '과제 공지를 하고 있다'] },
    { role: '조교', job: '대학원생', age: [25, 31], pers: ['shy', 'cool', 'warm'], doing: ['출석부를 체크하고 있다', '과제물을 걷고 있다', '빔 프로젝터를 고치고 있다', '노트북으로 성적을 입력하고 있다'] }],
  ulib: [{ role: '도서관 사서', job: '사서', age: [30, 55], pers: ['cool', 'warm'], doing: ['열람실 좌석 배정을 확인하고 있다', '반납 카트를 밀고 있다', '연체 안내문을 붙이고 있다'] }],
  cafeteria: [{ role: '학식 조리원', ny: '카페테리아 직원', job: '조리사', age: [45, 62], gender: 'f', pers: ['warm', 'sunny'], doing: ['국자를 들고 배식하고 있다', '"많이 먹어~" 하며 밥을 꾹꾹 눌러 담고 있다', '식판을 정리하고 있다', '오늘의 메뉴판을 바꾸고 있다'] }],
  union: [{ role: '매점 직원', job: '점원', age: [22, 50], pers: W, doing: ['계산대에서 바코드를 찍고 있다', '삼각김밥을 채우고 있다', '복사기 용지를 갈고 있다'] }],
  clubroom: [{ tag: 'sunbae2', role: '동아리 회장', job: '대학생', age: [21, 24], pers: ['sharp', 'bold'], doing: ['다음 공연 일정표를 붙이고 있다', '회비 장부를 적고 있다', '신입 부원 명단을 보고 있다'] }],
  campus: [{ role: '경비 아저씨', ny: '캠퍼스 경비원', job: '경비원', age: [58, 70], gender: 'm', pers: ['warm', 'cool'], doing: ['정문 초소에서 차단기를 올리고 있다', '"학생, 학생증!" 하고 부르고 있다', '낙엽을 쓸고 있다'] }],
  office: [{ role: '팀장님', job: '회사원', age: [38, 52], pers: ['sharp', 'cool', 'bold', 'warm'], when: s => !!s.job, doing: ['회의실에서 통화하고 있다', '모니터 너머로 사무실을 둘러보고 있다', '결재 서류를 넘기고 있다', '"잠깐 얘기 좀 할까?" 하고 누군가를 부르고 있다'] }],
  cafe: [{ role: '카페 사장님', ny: '카페 주인', job: '자영업자', age: [30, 50], pers: ['sunny', 'warm', 'cool'], doing: ['원두를 갈고 있다', '라테 아트를 그리고 있다', '"주문 도와드릴게요" 하고 웃고 있다', '테이블을 닦고 있다'] }],
  conveni: [{ role: '편의점 점원', ny: '보데가 주인', job: '점원', age: [20, 34], pers: ['cool', 'shy', 'sunny'], doing: ['계산대에서 바코드를 찍고 있다', '음료 냉장고를 채우고 있다', '폐기 도시락을 정리하고 있다', '휴대폰을 보며 하품하고 있다', '택배 접수를 받고 있다'] }],
  diner: [{ role: '식당 사장님', ny: '다이너 주인', job: '자영업자', age: [45, 65], pers: ['warm', 'bold', 'sunny'], doing: ['주방에서 국을 끓이고 있다', '"자리 아무 데나 앉아요~" 하고 외치고 있다', '반찬을 리필해 주고 있다', '계산대에서 동전을 세고 있다'] }],
  mall: [{ role: '매장 직원', job: '점원', age: [21, 35], pers: ['sunny', 'playful', 'warm'], doing: ['"사이즈 있어요~" 하며 옷을 개고 있다', '마네킹 옷을 갈아입히고 있다', '세일 문구를 붙이고 있다'] }],
  gym: [{ role: '헬스 트레이너', ny: '트레이너', job: '트레이너', age: [24, 38], pers: ['bold', 'sunny', 'sharp'], doing: ['회원 자세를 잡아 주고 있다', '덤벨을 정리하고 있다', 'PT 상담을 하고 있다', '거울 앞에서 시범을 보이고 있다'] }],
  pcbang: [{ role: 'PC방 알바', ny: '카운터 직원', job: '점원', age: [20, 28], pers: ['cool', 'playful'], doing: ['라면을 끓이고 있다', '카운터에서 충전해 주고 있다', '자리 정리를 하고 있다'] }],
  bar: [{ role: '술집 사장님', ny: '바텐더', job: '자영업자', age: [30, 50], pers: ['bold', 'sunny', 'cool'], doing: ['잔을 닦고 있다', '안주를 내오고 있다', '"한 병 더 드려요?" 하고 묻고 있다', '단골과 웃으며 이야기하고 있다'] }],
  motel: [{ role: '카운터 직원', job: '점원', age: [30, 60], pers: ['cool'], doing: ['작은 창 너머로 카드키를 내밀고 있다', 'TV를 보고 있다', '전화를 받고 있다'] }],
  hospital: [{ role: '의사 선생님', job: '의사', age: [34, 58], pers: ['cool', 'warm', 'sharp'], doing: ['진료실에서 차트를 보고 있다', '청진기를 목에 걸고 걸어간다', '"어디가 불편하세요?" 하고 묻고 있다'] },
    { role: '간호사', job: '간호사', age: [24, 45], pers: ['warm', 'sunny', 'cool'], doing: ['이름을 부르고 있다', '혈압을 재고 있다', '접수 서류를 정리하고 있다'] }],
  center: [{ role: '사회복지사', job: '사회복지사', age: [28, 50], pers: ['warm', 'sunny'], doing: ['어르신 식사 배식을 돕고 있다', '봉사자 명단을 확인하고 있다', '프로그램 안내문을 붙이고 있다'] }],
  station: [{ role: '매표소 직원', ny: '역무원', job: '역무원', age: [28, 55], pers: ['cool', 'warm'], doing: ['승차권을 끊어 주고 있다', '"○○행 곧 출발합니다" 하고 안내하고 있다', '분실물 대장을 적고 있다'] }],
  concert: [{ role: '공연장 스태프', job: '스태프', age: [21, 32], pers: ['sunny', 'bold'], doing: ['티켓을 확인하고 있다', '"앞으로 조금만 이동해 주세요!" 하고 외치고 있다', '무전기로 이야기하고 있다'] }],
  market: [{ role: '과일가게 사장님', ny: '농장 상인', job: '자영업자', age: [45, 68], pers: ['warm', 'bold', 'sunny'], doing: ['"골라 골라, 싸다 싸!" 하고 외치고 있다', '사과를 반짝반짝 닦고 있다', '덤을 한 줌 더 얹어 주고 있다'] }],
  church: [{ role: '목사님', ny: '신부님', job: '성직자', age: [42, 66], gender: 'm', pers: ['warm', 'cool'], doing: ['예배당 맨 앞에서 기도하고 있다', '입구에서 사람들과 인사하고 있다', '주보를 접고 있다'] }],
  realty: [{ role: '공인중개사', ny: '부동산 브로커', job: '공인중개사', age: [40, 62], pers: ['sunny', 'sharp', 'bold'], doing: ['매물 장부를 넘기고 있다', '"좋은 거 들어왔어요" 하고 손짓하고 있다', '집주인과 통화하고 있다', '믹스커피를 타고 있다'] }],
  kinder: [{ role: '유치원 선생님', ny: '프리스쿨 선생님', job: '유치원 교사', age: [24, 40], gender: 'f', pers: ['warm', 'sunny'], doing: ['아이들 이름을 부르며 하원시키고 있다', '알림장을 나눠 주고 있다', '"오늘 ○○가 밥 다 먹었어요" 하고 말하고 있다'] }],
  elem: [{ role: '담임 선생님', job: '선생님', age: [27, 55], pers: ['warm', 'sharp', 'sunny'], doing: ['교문 앞에서 아이들을 배웅하고 있다', '학부모와 짧게 상담하고 있다', '하교 지도를 하고 있다'] }],
};
})();
