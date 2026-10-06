// Llife 대학 강의 — 학기·시간표·강의 이벤트
// 대학생의 평일: 아침엔 집에서 깸 → 지도에서 대학으로 이동 → 강의실에서 '📖 강의 듣기' (시간표의 시각에 맞춰)
//   늦으면 지각, 끝날 때까지 못 가면 결석 — 출석률·시험 점수가 1년 학점에 들어감 (js/game.js 시간표·출석)
// 강의 이벤트는 on: ['class'] (강의를 들은 직후) — 강의 이름은 s.vars.lecName, 교수님은 강의실의 '교수님'(tag prof)
window.GAME_DATA = window.GAME_DATA || {};

(function () {
const D = GAME_DATA;

D.lecture = {
  // 학기: [시작 월, 일, 끝 월, 일, 이름] — 그 밖은 방학 (강의 없음)
  terms: {
    kr: [[3, 2, 6, 19, '1학기'], [9, 1, 12, 19, '2학기']],
    ny: [[1, 21, 5, 14, '봄 학기'], [9, 3, 12, 19, '가을 학기']],
  },
  exam: { mid: 8, fin: 15 },   // 학기 몇째 주가 시험 주인지 (그 주 강의는 시험)
  // 시간표 칸: [요일들, 시, 분, 분량(분)] — 월수·화목 75분, 금요일은 3시간 한 번
  slots: [
    [[1, 3], 9, 0, 75], [[1, 3], 10, 30, 75], [[1, 3], 13, 0, 75], [[1, 3], 15, 0, 75],
    [[2, 4], 9, 0, 75], [[2, 4], 10, 30, 75], [[2, 4], 13, 0, 75], [[2, 4], 15, 0, 75], [[2, 4], 16, 30, 75],
    [[5], 10, 0, 170], [[5], 14, 0, 170],
  ],
  perTerm: [4, 6],   // 한 학기에 듣는 강의 수 (전공 2~4 + 교양)
  late: 10,          // 시작하고 몇 분 넘으면 지각
  general: ['대학 글쓰기', '교양 영어', '심리학의 이해', '철학과 비판적 사고', '세계사 산책', '통계학 입문', '생활 속 경제', '영화의 이해', '교양 체육', '환경과 인간',
    '현대 사회와 젠더', '과학사', '창업과 혁신', '음악의 이해', '인공지능과 사회', '글로벌 리더십', '한국 근현대사', '논리와 토론'],
  dept: {
    korean_lit: ['국어학 개론', '현대 소설론', '고전 시가', '문예 창작', '국어 문법론'],
    law: ['헌법', '민법 총칙', '형법 총론', '행정법', '법철학'],
    business: ['경영학 원론', '회계 원리', '마케팅 관리', '재무 관리', '조직 행동론'],
    economics: ['미시경제학', '거시경제학', '계량경제학', '경제 수학', '화폐 금융론'],
    media: ['미디어 개론', '영상 제작 실습', '저널리즘 글쓰기', '광고학', '뉴미디어와 문화'],
    psychology: ['심리학 개론', '발달 심리학', '사회 심리학', '심리 통계', '인지 심리학'],
    political: ['정치학 개론', '국제 관계론', '비교 정치', '외교사', '정치 사상'],
    philosophy: ['서양 철학사', '윤리학', '논리학', '동양 철학', '형이상학'],
    education: ['교육학 개론', '교육 심리', '교육 과정론', '교육 평가', '교수법 실습'],
    social: ['사회복지 개론', '사회복지 실천론', '지역사회 복지', '인간 행동과 사회 환경', '사회복지 정책'],
    theology: ['성서 개론', '교회사', '조직 신학', '종교 철학', '설교학'],
    physics: ['일반 물리', '역학', '전자기학', '양자역학', '물리 수학'],
    chemistry: ['일반 화학', '유기 화학', '물리 화학', '분석 화학', '화학 실험'],
    biology: ['일반 생물', '세포 생물학', '유전학', '생화학', '생물 실험'],
    cs: ['프로그래밍 기초', '자료구조', '알고리즘', '컴퓨터 구조', '운영체제', '데이터베이스'],
    engineering: ['공학 수학', '정역학', '회로 이론', '재료 역학', '열역학'],
    architecture: ['건축 설계 스튜디오', '건축사', '건축 구조', '도시 계획', '건축 재료'],
    design: ['기초 디자인', '타이포그래피', '시각 디자인', 'UX 디자인', '디자인사'],
    music: ['화성학', '청음과 시창', '음악사', '전공 실기', '합주'],
    arts: ['기초 드로잉', '서양 미술사', '회화 실기', '조소', '현대 미술론'],
    medicine: ['해부학', '생리학', '생화학', '병리학', '약리학'],
    nursing: ['기본 간호학', '인체 구조와 기능', '성인 간호학', '간호 윤리', '아동 간호학'],
    culinary: ['조리 원리', '한식 조리 실습', '제과 제빵', '식품 위생', '메뉴 개발'],
    beauty: ['헤어 디자인', '메이크업 실습', '피부 관리학', '네일 아트', '뷰티 마케팅'],
  },
  // 강의 듣는 모습 (기록 한 줄)
  lines: ['맨 앞줄에 앉아 필기를 했다.', '뒷자리에서 교수님 목소리를 들으며 노트를 채웠다.', '피피티가 넘어가는 속도를 겨우 따라갔다.', '중간에 졸음이 쏟아졌지만 버텼다.',
    '교수님이 칠판 가득 판서를 했다. 사진을 찍었다.', '오늘 내용은 시험에 나온다는 말에 강의실이 술렁였다.', '노트북 타자 소리가 빗소리처럼 들렸다.', '조별로 토론을 하다 시간이 다 갔다.'],
  lateLines: ['뒷문으로 고개를 숙이고 들어갔다. 교수님이 출석부에 뭔가를 적었다.', '숨을 헐떡이며 뛰어 들어갔다. 이미 출석은 불렀다.', '늦었다. 맨 앞자리만 비어 있었다.'],
  examLines: ['시험지를 받자마자 아는 문제부터 풀었다.', '마지막 문제에서 손이 멈췄다. 시간이 모자랐다.', '공부한 데서 나왔다. 펜이 술술 나갔다.'],
};

/* ═════════ 강의 이벤트 (강의를 들은 직후, on: ['class']) ═════════ */
const lec = s => s.vars.lecName || '전공 수업';
const prof = a => a.here().find(p => p.tag === 'prof') || null;
const mate = a => a.here().find(p => !p.staffAt && p.tag !== 'prof' && a.npcAge(p) >= 19 && a.npcAge(p) <= 30) || null;
const fx = fn => (s, a) => a.focus(fn(a));
const crush = (s, a) => a.here().find(p => !p.staffAt && p.tag !== 'prof' && a.npcAge(p) >= 20 && a.npcAge(p) <= 30 && p.gender !== s.gender && !p.married) || null;

D.events.push(
  { id: 'lc_rollcall', type: 'random', on: ['class'], weight: 3, once: false, cdDays: 21,
    text: s => `${lec(s)} 시간. 교수님이 출석부를 펼쳤다. "오늘은 이름 대신 질문으로 출석 부릅니다. 지난 시간에 뭐 배웠죠?"`,
    choices: [
      { label: '손을 들고 대답한다', check: { stat: 'smart', diff: 70 },
        success: { text: '지난 시간 내용을 또박또박 말했다. 교수님이 "좋아요, 출석 두 번 인정." 하고 웃었다.', effect: { smart: 1, happy: 2 } },
        fail: { text: '손을 들긴 했는데 말이 꼬였다. "음… 다음 사람?" 귀가 뜨거워졌다.', effect: { happy: -1 } } },
      { label: '노트를 뒤적인다', text: '노트를 넘기는 사이 다른 사람이 대답했다. 다음엔 복습하고 오자고 생각했다.' },
    ] },
  { id: 'lc_popquiz', type: 'random', on: ['class'], weight: 3, once: false, cdDays: 21,
    text: s => `${lec(s)} 시작하자마자 교수님이 종이를 나눠 줬다. "깜짝 퀴즈입니다. 10분."`,
    choices: [
      { label: '차분하게 푼다', check: { stat: 'smart', diff: 80, dice: true },
        success: { text: '다 풀고 시간이 남았다. 다음 주에 돌려받은 종이엔 10/10이 적혀 있었다.', effect: { smart: 1, happy: 3 }, do: s => { s.school.studyYear = (s.school.studyYear || 0) + .05; } },
        fail: { text: '반은 찍었다. 돌려받은 종이에 빨간 줄이 가득했다.', effect: { happy: -2 } } },
      { label: '옆 사람 답을 슬쩍 본다', chance: .6,
        success: { text: '다행히 안 들켰다. 점수는 받았지만 기분이 찜찜했다.', effect: { happy: -1 } },
        fail: { text: '"거기 두 사람, 시험지 이리 주세요." 0점. 얼굴이 화끈거렸다.', effect: { happy: -4 } } },
    ] },
  { id: 'lc_called', type: 'random', on: ['class'], weight: 2, once: false, cdDays: 21,
    onStart: fx(prof),
    text: s => `${lec(s)} 시간에 꾸벅 졸았다. "거기, 고개 숙인 학생. 방금 설명한 거 다시 말해 볼래요?" {fp|이} 나를 보고 있었다.`,
    choices: [
      { label: '솔직하게 졸았다고 말한다', text: '"죄송합니다, 졸았습니다." 강의실에 웃음이 터졌다. {fp|은} "솔직해서 봐줍니다." 하고 넘어갔다.', p: { close: [1, 3] }, effect: { charm: 1 } },
      { label: '아는 척 둘러댄다', check: { stat: 'charm', diff: 75 },
        success: { text: '앞뒤 맥락으로 그럴듯하게 말했다. {fp|은} 고개를 갸웃하더니 "음, 대충 맞네요." 하고 넘어갔다.', effect: { charm: 1, happy: 1 } },
        fail: { text: '횡설수설했다. {fp|이} 한숨을 쉬었다. "다음 시간까지 정리해서 제출하세요."', p: { trust: [-3, -1] }, effect: { happy: -2 } } },
    ] },
  { id: 'lc_group', type: 'random', on: ['class'], weight: 3, once: false, cdDays: 21,
    onStart: fx(mate),
    text: s => `${lec(s)} 끝나고 조별 과제 조가 발표됐다. 같은 조가 된 {fp|이} 단톡방을 만들었다. "다들 언제 시간 돼요?"`,
    when: (s, a) => !!mate(a),
    choices: [
      { label: '조장을 맡는다', text: '아무도 안 나서길래 손을 들었다. 일정표를 만들고 역할을 나눴다. {fp|이} "와, 든든하다." 하고 말했다.', p: { close: [3, 5], trust: [2, 4] }, effect: { charm: 1, happy: 1 }, memory: true },
      { label: '자료 조사를 맡는다', text: '자료 조사를 맡았다. 도서관에서 논문 세 편을 찾아 정리해 올렸다.', p: { close: [2, 3] }, effect: { smart: 1 } },
      { label: '조용히 묻어간다', text: '"저는 아무거나 할게요." 결국 발표 피피티 한 장만 만들었다. 다른 조원 눈빛이 조금 차가웠다.', p: { trust: [-3, -1] } },
    ] },
  { id: 'lc_pen', type: 'random', on: ['class'], weight: 2, once: false, cdDays: 21,
    onStart: fx(mate),
    when: (s, a) => !!mate(a),
    text: s => `${lec(s)} 시간. 옆자리 {fp|이} 필통을 뒤지더니 작게 물었다. "혹시 펜 하나만 빌려줄 수 있어요?"`,
    choices: [
      { label: '제일 좋은 펜을 건넨다', text: '아끼던 펜을 건넸다. 수업이 끝나고 {fp|이} 펜과 함께 사탕 하나를 돌려줬다. "고마워요. 다음에 밥 살게요."', p: { close: [3, 5], heart: [0, 2] }, effect: { happy: 2 } },
      { label: '그냥 아무 펜이나 준다', text: '굴러다니던 볼펜을 줬다. {fp|이} 고개를 꾸벅했다.', p: { close: [1, 3] } },
    ] },
  { id: 'lc_cancel', type: 'random', on: ['class'], weight: 1, once: false, cdDays: 21,
    text: s => `강의실에 도착하니 문에 종이가 붙어 있었다. "${lec(s)} — 교수님 학회 참석으로 휴강합니다." 출석은 인정이라고 했다.`,
    choices: [
      { label: '도서관에 가서 공부한다', text: '남은 시간에 도서관에서 밀린 과제를 했다. 뿌듯했다.', effect: { smart: 1 }, do: s => { s.school.studyYear = (s.school.studyYear || 0) + .03; } },
      { label: '잔디밭에서 쉰다', text: '잔디밭에 누워 하늘을 봤다. 휴강만큼 좋은 건 없었다.', effect: { happy: 3 } },
    ] },
  { id: 'lc_proxy', type: 'random', on: ['class'], weight: 2, once: false, cdDays: 21,
    text: s => `${lec(s)} 시간. 휴대폰이 울렸다. 같은 과 사람이 보낸 카톡. "나 늦잠 잤어 ㅠ 출석 대신 불러 줄 수 있어?"`,
    choices: [
      { label: '목소리를 바꿔서 대답한다', chance: .55,
        success: { text: '"네!" 목소리를 깔고 대답했다. 들키지 않았다. 답장으로 커피 쿠폰이 왔다.', effect: { happy: 2 } },
        fail: { text: '"방금 대답한 학생, 일어나 볼래요?" 교수님 눈은 못 속였다. 둘 다 결석 처리됐다.', effect: { happy: -3 } } },
      { label: '못 해 준다고 답한다', text: '"미안, 그건 좀…" 잠시 뒤 "ㅇㅋ ㅠ"가 왔다. 마음이 편했다.' },
    ] },
  { id: 'lc_office', type: 'random', on: ['class'], weight: 2, once: false, cdDays: 21,
    onStart: fx(prof),
    when: (s, a) => !!prof(a),
    text: s => `${lec(s)}이 끝나고 짐을 챙기는데 {fp|이} 불렀다. "잠깐 남아 볼래요? 지난번 과제 이야기 좀 하죠."`,
    choices: [
      { label: '남아서 이야기를 듣는다', check: { stat: 'smart', diff: 90 },
        success: { text: '"과제가 아주 좋았어요. 다음 학기에 연구실에서 일해 볼 생각 있어요?" 가슴이 두근거렸다.', p: { close: [3, 6], trust: [3, 5] }, effect: { smart: 2, happy: 4 }, memory: true },
        fail: { text: '"이 부분은 다시 생각해 봐요." 빨간 펜 자국이 가득한 과제를 돌려받았다. 그래도 피드백은 정확했다.', p: { close: [1, 3] }, effect: { smart: 1 } } },
      { label: '다음 약속이 있다며 나간다', text: '"아, 그럼 메일로 할게요." {fp|의} 목소리가 조금 서운했다.', p: { close: [-2, 0] } },
    ] },
  { id: 'lc_present', type: 'random', on: ['class'], weight: 2, once: false, cdDays: 21,
    text: s => `${lec(s)} 시간. 오늘은 내 발표 차례였다. 앞에 서니 서른 개의 눈이 나를 보고 있었다.`,
    choices: [
      { label: '연습한 대로 한다', check: { stat: 'charm', diff: 85, dice: true },
        success: { text: '발표가 끝나자 박수가 나왔다. 교수님이 "질문 받을 필요도 없겠네요." 하고 말했다.', effect: { charm: 2, happy: 4 }, do: s => { s.school.studyYear = (s.school.studyYear || 0) + .05; }, memory: true },
        fail: { text: '목소리가 떨렸고 슬라이드를 두 번 건너뛰었다. 그래도 끝까지 했다.', effect: { charm: 1, happy: -2 } } },
      { label: '자료를 그대로 읽는다', text: '피피티를 그대로 읽었다. 졸고 있는 사람이 몇 보였다. 무난하게 끝났다.', effect: { smart: 1 } },
    ] },
  { id: 'lc_laptop', type: 'random', on: ['class'], weight: 1, once: false, cdDays: 21,
    text: s => `${lec(s)} 중에 노트북 배터리가 5% 남았다는 알림이 떴다. 충전기는 집에 있다.`,
    choices: [
      { label: '손으로 필기한다', text: '오랜만에 공책에 손으로 썼다. 손목이 아팠지만 머리에 더 잘 들어왔다.', effect: { smart: 1 } },
      { label: '옆 사람에게 충전기를 빌린다', text: '"저기, 혹시 충전기…" 옆 사람이 웃으며 콘센트 쪽을 내줬다. 수업 끝나고 이야기를 조금 나눴다.', effect: { charm: 1, happy: 1 } },
    ] },
  { id: 'lc_examtip', type: 'random', on: ['class'], weight: 2, once: false, cdDays: 21,
    text: s => `${lec(s)} 끝나기 5분 전. 교수님이 말했다. "이건 시험에 꼭 나옵니다. 별표 세 개."`,
    choices: [
      { label: '빨간 펜으로 크게 표시한다', text: '별 세 개를 그렸다. 시험 전날 그 페이지만 열 번 봤다.', effect: { smart: 1 }, do: s => { s.school.studyYear = (s.school.studyYear || 0) + .04; } },
      { label: '사진만 찍어 둔다', text: '칠판을 찍었다. 사진첩에 칠판 사진이 400장째였다.' },
    ] },
  { id: 'lc_crushseat', type: 'random', on: ['class'], weight: 2, once: false, cdDays: 21,
    onStart: (s, a) => a.focus(crush(s, a)),
    when: (s, a) => s.age >= 20 && !!crush(s, a),
    text: s => `${lec(s)} 시간. 늘 같은 자리에 앉던 {fp|이} 오늘은 내 옆자리에 가방을 내려놓았다. "여기 앉아도 돼요?"`,
    choices: [
      { label: '웃으며 자리를 내준다', text: '"그럼요." 수업 내내 팔꿈치가 닿을 듯 말 듯 했다. 끝나고 {fp|이} 연락처를 물었다.', p: { close: [3, 5], heart: [3, 6] }, effect: { happy: 3 }, do: (s, a) => { const p = a.focused(); if (p) p.phone = true; } },
      { label: '고개만 끄덕인다', text: '고개만 끄덕였다. 수업이 끝나자 {fp|은} 먼저 나갔다. 조금 아쉬웠다.', p: { close: [1, 2] } },
    ] },
);
})();
