// 1단계: 유아~초등학교 (0~12살) — 턴 없이 이어지는 선택지 이야기 (GAMEFLOW)
//
// 모두 type 'must' + at(나이) + season(없으면 봄)이라 그 나이의 그 계절이 되면 한 번 나옴
// 선택지가 있는 장면에서 새 사람을 만나려면 onStart에서 a.meet (선택지 이벤트는 meet·do를 고른 뒤에 처리하므로)
// 선택지에 더 쓸 수 있는 것 (js/game.js applyOutcome):
//   lean: '성격 id'     그 성격 쪽으로 기울어짐 (13살이 되면 가장 많이 기운 쪽으로 성격이 굳어짐, 처음 고른 성격은 3점으로 시작)
//   vlean: '가치관 id'  가치관도 같은 방식 (처음 고른 가치관 3점)
//   hobby: '취미 id'    취미를 정함 (10~12살)
// 부모 사이(s.vars.parents): warm 다정 / cold 무심 / fight 자주 싸움 / divorce 이혼 — 2살에 정해짐
window.GAME_DATA = window.GAME_DATA || {};

(function () {
const W = (s, map, other) => map[s.wealth] || other;
const story = [
  /* ── 0~3살: 가정환경 (선택 없음, 집안에 따라) ── */
  { id: 'st_home', at: 0, season: ['여름'],
    text: s => W(s, { rich: '햇살이 잘 드는 넓은 아기방. 장난감이 벽 한 면을 채웠다.', comfy: '아늑한 아기방에서 첫 여름을 보냈다. 모빌이 천천히 돌았다.',
      tight: '작은 방 한쪽에 아기 침대가 놓였다. 엄마는 밤마다 부업을 했다.', poor: '단칸방에 선풍기 한 대. 엄마 품이 제일 시원했다.',
      complex: '어른들 목소리가 자주 높아지는 집이었다. 그래도 요람은 따뜻했다.' }, '평범한 집, 평범한 첫 여름. 엄마 아빠가 번갈아 안아줬다.'),
    effect: { happy: 2 } },
  { id: 'st_parents', at: 2, season: ['가을'],
    do: (s, a) => {
      const r = Math.random(), bad = s.wealth === 'complex' ? .5 : s.wealth === 'poor' || s.wealth === 'tight' ? .25 : .15;
      s.vars.parents = r < bad * .3 ? 'divorce' : r < bad ? 'fight' : r < bad + .2 ? 'cold' : 'warm';
      if (s.vars.parents === 'divorce') { const d = a.person('dad'); if (d) d.close = Math.max(0, d.close - 30); }
    },
    text: s => ({ warm: '저녁마다 엄마 아빠가 나란히 앉아 내가 노는 걸 지켜봤다. 웃음소리가 많은 집이었다.',
      cold: '엄마 아빠는 각자 휴대폰을 봤다. 싸우지는 않았지만, 집이 조용했다.',
      fight: '밤이면 안방에서 언성이 높아졌다. 이불을 머리끝까지 덮는 법을 배웠다.',
      divorce: '아빠가 큰 가방을 들고 나갔다. 그날 이후 아빠는 주말에만 왔다.' })[s.vars.parents],
    memory: s => s.vars.parents === 'divorce' },
  { id: 'st_sibling', at: 3, season: ['가을'], when: (s, a) => a.find(p => p.sibling).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.sibling)[0]),
    text: '{fp|와} 장난감 하나를 두고 하루 종일 쫓고 쫓겼다. 밤엔 같은 이불을 덮고 잤다.', effect: { happy: 2 }, p: { close: [3, 6] } },

  /* ── 4~6살: 어린이집·유치원 ── */
  { id: 'st_kinder', at: 4,
    meet: s => ({ kind: 'classmate', ageRange: [4, 4], close: 30, trust: 25 }),
    text: '어린이집 첫날. 신발장 앞에서 울고 있는데 {new|이} 사탕을 내밀었다. 첫 친구가 생겼다.', memory: true, effect: { happy: 4 } },
  { id: 'st_toy', at: 4, season: ['가을'],
    text: '블록 놀이를 하는데 친구가 내가 쌓던 블록을 빼앗아 갔다.',
    choices: [
      { label: '엉엉 운다', lean: 'sensitive', text: '선생님이 달려와 안아줬다. 블록은 돌려받았지만 한참 훌쩍였다.', effect: { happy: -1 } },
      { label: '도로 빼앗는다', lean: 'bold', text: '힘껏 잡아당겼다. 둘 다 넘어졌고, 둘 다 혼났다.', effect: { fit: 1 } },
      { label: '같이 쌓자고 한다', lean: 'warm', text: '둘이서 쌓은 탑이 제일 높았다. 선생님이 사진을 찍어줬다.', effect: { happy: 3, charm: 1 } },
    ] },
  { id: 'st_sky', at: 5,
    text: '그림 그리기 시간. 하늘을 무슨 색으로 칠할까?',
    choices: [
      { label: '파랗게', lean: 'cool', text: '꼼꼼하게 파랗게 칠했다. 구름은 하얗게 남겨뒀다.', effect: { art: 1 } },
      { label: '무지개색으로', lean: 'playful', text: '하늘을 일곱 색으로 칠했다. 선생님이 웃으며 벽에 붙여줬다.', effect: { art: 2, happy: 2 } },
      { label: '옆 친구를 따라', lean: 'shy', text: '옆자리 그림을 힐끔거리며 똑같이 칠했다. 그래도 내 하늘이었다.', effect: { art: 1 } },
    ] },
  { id: 'st_lost', at: 5, season: ['겨울'],
    text: '마트에서 엄마 손을 놓쳤다. 고개를 들어도 아는 얼굴이 없다.',
    choices: [
      { label: '울면서 엄마를 찾는다', lean: 'sensitive', text: '목 놓아 울자 엄마가 금방 달려왔다. 그날은 손을 놓지 않았다.', effect: { rel: { mom: 3 } } },
      { label: '계산대 직원에게 말한다', lean: 'sharp', text: '"엄마를 잃어버렸어요." 안내 방송이 나오고 엄마가 왔다. 다들 똑똑하다고 했다.', effect: { smart: 2 } },
      { label: '그 자리에서 기다린다', lean: 'cool', text: '과자 진열대 앞에 가만히 서 있었다. 엄마가 숨을 몰아쉬며 나타났다.', effect: { happy: 1 } },
    ] },
  { id: 'st_recital', at: 6, season: ['겨울'],
    text: '유치원 발표회. 무대 조명이 눈부시다. 객석에 엄마 아빠가 보인다.',
    choices: [
      { label: '신나서 춤춘다', lean: 'sunny', text: '음악보다 신나게 춤췄다. 박수가 제일 컸다.', effect: { charm: 2, happy: 4 }, memory: true },
      { label: '얼어붙는다', lean: 'shy', text: '한 소절도 못 부르고 서 있었다. 집에 가는 차에서 아빠가 잘했다고 했다.', effect: { happy: -2, rel: { dad: 2 } } },
      { label: '떨고 있는 친구 손을 잡아준다', lean: 'warm', text: '옆 친구 손을 꼭 잡고 끝까지 불렀다. 친구가 고맙다고 했다.', effect: { charm: 1, happy: 2 } },
    ] },

  /* ── 7~9살: 초등 저학년 (동네 탐험, 소질 발견) ── */
  { id: 'st_neighbor', at: 7, season: ['여름'],
    meet: s => ({ kind: 'friend', ageRange: [60, 72], close: 30, trust: 30, hangout: 'park' }),
    text: '옆집으로 {new|이} 이사 왔다. 텃밭에서 딴 방울토마토를 한 바구니 나눠줬다.', effect: { happy: 2 } },
  { id: 'st_cat', at: 7, season: ['가을'],
    text: '학교 가는 길, 담벼락 아래 길고양이가 웅크리고 있다. 다리를 조금 전다.',
    choices: [
      { label: '집에 데려간다', lean: 'warm', vlean: 'family', text: '엄마가 한숨을 쉬었지만, 상자에 담요를 깔아줬다. 고양이는 겨울을 우리 집에서 났다.', effect: { happy: 4, art: 1 }, set: 'cat', memory: true },
      { label: '매일 밥만 챙겨준다', lean: 'sensitive', text: '용돈으로 산 사료를 매일 아침 담벼락 아래 뒀다. 어느 날부터 고양이가 날 기다렸다.', effect: { happy: 2, art: 1 } },
      { label: '그냥 지나친다', lean: 'cool', text: '뒤돌아보지 않으려 했다. 그날 밤 고양이 생각이 조금 났다.' },
    ] },
  { id: 'st_talent', at: 8,
    text: s => ({
      gifted: '수학 시간에 아무도 못 푼 문제를 혼자 풀었다. 선생님이 영재 교실을 권했다.',
      athletic: '체육 시간, 반에서 제일 빨랐다. 육상부 선생님이 이름을 물어봤다.',
      pretty: '사진관 아저씨가 내 사진을 가게 진열장에 걸어도 되냐고 물었다.',
      social: '전학 온 아이에게 제일 먼저 말을 건 건 나였다. 금세 반 전체와 친해졌다.',
      artistic: '교내 그림 대회에서 금상을 받았다. 액자에 넣어 거실에 걸었다.',
      handy: '미술 시간에 만든 나무 저금통을 선생님이 칭찬했다. 진짜 가게에서 파는 것 같다고.',
      sturdy: '감기 한 번 안 걸리고 1년을 다녔다. 개근상을 받았다.',
      optimist: '비가 쏟아진 소풍날, 다들 울상인데 혼자 웅덩이에서 신나게 뛰었다. 다들 따라 웃었다.',
      nimble: '숨바꼭질에서 한 번도 안 잡혔다. 다들 나를 \'유령\'이라고 불렀다.',
    })[s.trait] || '좋아하는 게 하나 생겼다. 시간 가는 줄 몰랐다.',
    effect: s => ({ gifted: { smart: 4 }, athletic: { fit: 4 }, pretty: { charm: 2, happy: 3 }, social: { charm: 4 }, artistic: { art: 4 }, handy: { craft: 4 },
      sturdy: { health: 4 }, optimist: { happy: 4 }, nimble: { fit: 2, craft: 1 } })[s.trait] || { happy: 2 },
    memory: true },
  { id: 'st_first', at: 8, season: ['겨울'],
    text: s => s.stats.smart >= 40 ? '기말 시험에서 반 1등을 했다. 엄마가 시험지를 냉장고에 붙였다.' : '받아쓰기에서 처음으로 100점을 받았다.',
    choices: [
      { label: '날아갈 듯 기쁘다', vlean: 'success', lean: 'bold', text: '다음엔 전교 1등을 하겠다고 큰소리쳤다.', effect: { happy: 4, smart: 1 } },
      { label: '그냥 그렇다', vlean: 'freedom', lean: 'cool', text: '점수보다 운동장에서 놀 시간이 더 좋았다.', effect: { happy: 1 } },
      { label: '엄마가 좋아해서 기쁘다', vlean: 'family', lean: 'warm', text: '엄마가 웃는 얼굴이 좋아서, 또 잘 보고 싶어졌다.', effect: { happy: 2, rel: { mom: 3 } } },
    ] },
  { id: 'st_explore', at: 9,
    text: '토요일 오후, 동네를 탐험하기로 했다. 어디로 갈까?',
    choices: [
      { label: '뒷산 꼭대기', lean: 'bold', text: '숨이 턱까지 찼지만 꼭대기에서 우리 동네가 다 보였다.', effect: { fit: 3, happy: 2 } },
      { label: '골목 끝 문방구', lean: 'playful', text: '뽑기 기계에서 반짝이는 반지가 나왔다. 아직도 서랍에 있다.', effect: { happy: 3 } },
      { label: '처음 가보는 도서관', lean: 'shy', text: '조용한 열람실 구석에서 해가 질 때까지 책을 읽었다.', effect: { smart: 2, art: 1 }, set: 'bookworm' },
    ] },
  { id: 'st_fishing', at: 9, season: ['여름'], when: s => s.vars.parents !== 'divorce',
    text: '아빠가 주말에 낚시를 가자고 했다. 친구들은 놀이터에서 축구를 한다고 했다.',
    choices: [
      { label: '아빠를 따라간다', vlean: 'family', text: '하루 종일 한 마리도 못 잡았다. 그래도 컵라면이 세상에서 제일 맛있었다.', effect: { happy: 3, rel: { dad: 5 } }, memory: true },
      { label: '친구들과 논다', vlean: 'freedom', text: '해가 질 때까지 공을 찼다. 아빠는 혼자 다녀왔다.', effect: { fit: 2, happy: 2 } },
    ] },

  /* ── 10~12살: 초등 고학년 (더 복잡한 선택) ── */
  { id: 'st_phone', at: 10,
    text: '첫 휴대폰이 생겼다. 제일 먼저 뭘 할까?',
    choices: [
      { label: '게임을 깐다', lean: 'playful', text: '밤에 이불 속에서 몰래 하다가 들켰다.', effect: { happy: 3, smart: -1 } },
      { label: '친구들 번호를 저장한다', lean: 'sunny', text: '연락처가 하루 만에 서른 개가 됐다.', effect: { charm: 2 } },
      { label: '사진을 찍는다', lean: 'sensitive', text: '하늘, 고양이, 급식. 사진첩이 금방 찼다.', effect: { art: 2 } },
    ] },
  { id: 'st_bully', at: 10, season: ['가을'],
    onStart: (s, a) => { a.meet({ kind: 'classmate', ageRange: [10, 10], close: 10, trust: 10 }); },
    text: '반에서 {new|을} 다들 피하기 시작했다. 오늘은 누가 {new}의 실내화를 쓰레기통에 버렸다.',
    choices: [
      { label: '나선다', lean: 'bold', vlean: 'love', karma: 5, text: '"그만해." 목소리가 떨렸지만 끝까지 말했다. {new|이} 그날 처음으로 웃었다.', effect: { charm: 2 },
        do: (s, a) => { const p = a.person(s.vars.newId); if (p) { p.close = Math.min(100, p.close + 30); p.trust = Math.min(100, p.trust + 35); } }, memory: true },
      { label: '못 본 척한다', lean: 'cool', text: '고개를 돌렸다. 집에 오는 길이 유난히 길었다.', effect: { happy: -2 } },
      { label: '같이 웃는다', lean: 'sharp', karma: -6, text: '다들 웃길래 같이 웃었다. {new|이} 나를 쳐다봤다.',
        do: (s, a) => { const p = a.person(s.vars.newId); if (p) p.grudge = Math.min(100, p.grudge + 40); } },
    ] },
  { id: 'st_parentFight', at: 11, when: s => s.vars.parents === 'fight' || s.vars.parents === 'cold',
    text: '거실에서 그릇 깨지는 소리가 났다. 엄마 아빠가 크게 싸우고 있다.',
    choices: [
      { label: '방에 숨는다', lean: 'shy', text: '이어폰을 끼고 볼륨을 끝까지 올렸다. 그래도 다 들렸다.', effect: { happy: -4 }, set: 'hidHome' },
      { label: '"그만 싸워!" 소리친다', lean: 'bold', text: '둘 다 놀라서 멈췄다. 그날 밤 엄마가 와서 미안하다며 울었다.', effect: { happy: -2, rel: { family: 3 } }, memory: true },
      { label: '모른 척 숙제를 한다', lean: 'cool', text: '같은 문제를 열 번 읽었다. 아무것도 머리에 안 들어왔다.', effect: { happy: -2, smart: 1 } },
    ] },
  { id: 'st_crush', at: 11, season: ['가을'],
    // 짝사랑 (감정만) — 고등학교 고백 이벤트에서 이어짐
    onStart: (s, a) => { const p = a.meet({ kind: 'classmate', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [11, 11], close: 15, trust: 15 }); p.crush = true; },
    text: '{new|이} 웃을 때마다 이상하게 심장이 빨리 뛴다. 좋아하는 애가 생겼다.',
    choices: [
      { label: '쪽지를 써서 서랍에 넣어둔다', lean: 'shy', text: '열 번을 고쳐 썼다. 결국 내 필통 속에만 들어갔다.', effect: { art: 1 } },
      { label: '괜히 장난을 건다', lean: 'playful', text: '지우개를 빌리는 척하다가 {new}의 공책에 낙서를 했다. 등짝을 맞았다. 좋았다.', effect: { happy: 2 } },
      { label: '친한 친구에게만 털어놓는다', lean: 'warm', text: '"절대 말하지 마." 다음 날 반 전체가 알았다.', effect: { happy: -1, charm: 1 } },
    ], memory: true },
  { id: 'st_hobby', at: 12,
    text: '방과 후 활동을 하나 골라야 한다. 요즘 제일 좋아하는 건…',
    choices: [
      { label: '게임', hobby: 'game', text: '컴퓨터 동아리에 들어갔다.', effect: { smart: 1 } },
      { label: '운동', hobby: 'sport', text: '축구부에 들어갔다. 매일 흙투성이로 집에 왔다.', effect: { fit: 2 } },
      { label: '음악', hobby: 'music', text: '합창부에 들어갔다.', effect: { art: 2 } },
      { label: '독서', hobby: 'book', text: '독서부에 들어갔다.', effect: { smart: 2 } },
      { label: '요리', hobby: 'cook', text: '요리 교실에서 처음 만든 쿠키를 엄마에게 줬다.', effect: { craft: 2 } },
      { label: '그림', hobby: 'draw', text: '미술부에 들어갔다.', effect: { art: 2 } },
      { label: '꾸미기', hobby: 'fashion', text: '용돈을 모아 첫 머리핀을 샀다.', effect: { style: 2 } },
      { label: '여행 영상 보기', hobby: 'travel', text: '세계지도를 방 벽에 붙였다.', effect: { art: 1 } },
    ] },
  { id: 'st_graduate', at: 12, season: ['겨울'],
    text: '초등학교 졸업식. 6년 동안 다닌 운동장이 갑자기 작아 보였다.',
    choices: [
      { label: '친구들과 사진을 찍는다', lean: 'sunny', text: '얼굴에 밀가루를 뒤집어쓰고 다 같이 웃었다.', effect: { happy: 4, charm: 1 }, memory: true },
      { label: '선생님께 편지를 드린다', lean: 'warm', text: '선생님이 편지를 읽다가 눈시울을 붉혔다.', effect: { happy: 3, art: 1 }, memory: true },
      { label: '혼자 교실을 한 바퀴 돈다', lean: 'sensitive', text: '내 책상 낙서를 손끝으로 쓸어봤다. 안녕.', effect: { art: 2 }, memory: true },
    ] },
];
GAME_DATA.events = (GAME_DATA.events || []).concat(story.map(e => Object.assign({ type: 'must', story: true }, e)));
})();
