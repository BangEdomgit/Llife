// 집 종류 — 이웃(주민 구성)과 집 앞 풍경 (엔진: js/game.js '집·부동산'). 실제 매물·가격은 data/realty.js (📱 방구하기)
//   deposit·rent  예전 저장(계약 내용이 없는 집)에서만 쓰는 기본값 / minAge: 계약할 수 있는 나이
//   nb       이웃: n 몇 명쯤 / hh 가구 종류 비중 — single 혼자 사는 사람(age 범위) · couple 결혼 안 한 커플(동거) · married 신혼·부부 · family 부부 + 아이
//            elder 노부부·혼자 사는 어르신 · roommates 룸메이트 둘 · student 학생 / single·married: 그 가구의 나이 범위(없으면 기본)
//   spot     집 앞에서 이웃과 마주치는 곳 (지도 '우리 집 앞'): 이름·아이콘·하고 있는 일
//   guest    집에 사람을 데려오기 (false면 동행과 집으로 못 감 — 고시원)
//   noise    층간 소음·벽 너머 소리 이벤트가 잘 생기는 정도 (0~1)
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.housing = [
  { id: 'parents', label: '본가', icon: '🏡', deposit: 0, rent: 0, noise: .2,
    desc: '부모님과 같이 사는 집. 돈은 안 들지만 내 공간이 없고, 늦게 들어오면 눈치가 보인다.',
    nb: { n: [6, 9], hh: { single: 15, married: 20, family: 35, elder: 30 } },
    spot: { label: '동네 골목', icon: '🏘', doing: ['화분에 물을 주고 있다', '대문 앞을 쓸고 있다', '장바구니를 들고 들어간다', '강아지와 산책을 나선다', '평상에 앉아 계신다', '자전거를 세우고 있다'] } },
  { id: 'goshiwon', label: '고시원', icon: '🚪', deposit: 0, rent: 35, minAge: 19, guest: false, noise: .9,
    desc: '책상과 침대가 전부인 방 한 칸. 싸고 바로 들어갈 수 있지만 벽이 얇고 손님은 못 데려온다.',
    nb: { n: [7, 10], hh: { single: 70, student: 30 }, single: [21, 58] },
    spot: { label: '고시원 복도', icon: '🚪', doing: ['공용 주방에서 라면을 끓이고 있다', '복도 끝 창문을 열고 담배를 참고 있다', '공용 냉장고에서 반찬통을 찾고 있다', '슬리퍼를 끌며 샤워실로 간다', '방문을 반쯤 열고 통화하고 있다', '빨래 바구니를 들고 서 있다'] } },
  { id: 'oneroom', label: '원룸', icon: '🛏', deposit: 500, rent: 55, minAge: 19, noise: .6,
    desc: '혼자 살기 딱 좋은 방 하나. 이웃은 대부분 혼자 사는 20~30대라 서로 얼굴만 안다.',
    nb: { n: [8, 12], hh: { single: 68, couple: 17, married: 6, roommates: 9 }, single: [20, 36], married: [25, 36] },
    spot: { label: '원룸 건물 앞', icon: '🛏', doing: ['택배 상자를 들고 계단을 오르고 있다', '분리수거를 하고 있다', '현관 비밀번호를 누르고 있다', '배달 음식을 받고 있다', '편의점 봉지를 들고 들어온다', '이어폰을 끼고 나간다'] } },
  { id: 'officetel', label: '오피스텔', icon: '🏢', deposit: 1000, rent: 90, minAge: 20, noise: .3,
    desc: '역 가까운 깔끔한 건물. 1층에 편의점, 로비에 택배함. 바쁜 직장인과 커플이 많다.',
    nb: { n: [8, 12], hh: { single: 50, couple: 28, married: 22 }, single: [24, 40], married: [26, 42] },
    spot: { label: '오피스텔 로비', icon: '🏢', doing: ['엘리베이터를 기다리고 있다', '택배함에서 상자를 꺼내고 있다', '정장 차림으로 바쁘게 나간다', '로비 소파에서 통화하고 있다', '운동복 차림으로 피트니스실에서 나온다', '우편함을 확인하고 있다'] } },
  { id: 'villa', label: '빌라 (투룸)', icon: '🏘', deposit: 3000, rent: 60, minAge: 20, noise: .5,
    desc: '방 두 개짜리 다세대. 신혼부부, 아이 있는 집, 오래 산 어르신이 섞여 산다.',
    nb: { n: [8, 12], hh: { single: 18, couple: 10, married: 27, family: 30, elder: 15 } },
    spot: { label: '빌라 계단', icon: '🏘', doing: ['유모차를 계단 아래 세우고 있다', '현관 앞에 화분을 내놓고 있다', '아이 손을 잡고 내려온다', '장 본 봉지를 들고 올라간다', '계단에서 이웃과 이야기하고 있다', '주차 문제로 전화하고 있다'] } },
  { id: 'apt', label: '아파트 (전세)', icon: '🏬', deposit: 15000, rent: 25, minAge: 22, noise: .45,
    desc: '단지 안에 놀이터와 상가. 아이 키우는 부부가 대부분이라, 이웃 상당수가 유부녀·유부남이다.',
    nb: { n: [10, 14], hh: { single: 8, married: 27, family: 52, elder: 13 } },
    spot: { label: '아파트 단지', icon: '🏬', doing: ['놀이터 벤치에서 아이를 지켜보고 있다', '엘리베이터에서 마주쳤다', '분리수거장에서 박스를 접고 있다', '단지 산책로를 걷고 있다', '유치원 버스를 기다리고 있다', '관리사무소 앞 게시판을 보고 있다', '주차장에서 아이 카시트를 정리하고 있다'] } },
  { id: 'house', label: '단독주택 (전세)', icon: '🏠', deposit: 25000, rent: 30, minAge: 25, noise: .1,
    desc: '마당 있는 2층 집. 오래 산 이웃과 가족 단위가 많고, 서로의 사정을 다 안다.',
    nb: { n: [6, 9], hh: { married: 18, family: 40, elder: 42 } },
    spot: { label: '주택가 골목', icon: '🏠', doing: ['마당에서 고추를 말리고 있다', '대문 앞에서 이웃과 이야기하고 있다', '아이와 골목에서 공을 차고 있다', '담장 너머로 감을 따고 있다', '차를 세차하고 있다', '개를 데리고 산책을 나선다'] } },
];
