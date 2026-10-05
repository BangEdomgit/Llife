// Llife 경력 · 자격증 — 📱 자격증 앱 (자격넷 / 뉴욕은 서트허브)
// 자격증: 인강 듣기(⚡6, 도서관·학교 도서관이면 더 잘 됨)로 공부 진도를 쌓고 → 시험 접수(응시료, 시험 10일 전까지) →
//   시험 날 아침 '시험 보러 가기'(⚡30) → 2~3주 뒤 합격 발표. 어학 시험은 점수로 나옴
// 붙은 자격증은 이력서에 올라가 관련 직업(jobs)·업종(cats)의 서류 합격률을 올리고, 입사 연봉을 조금 올림
// 경력: 직장마다 들어간 날 · 나온 날로 몇 년 몇 개월 — '경력 n년↑' 공고는 같은 업종 경력이 그만큼 있어야 유리 (js/game.js)
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.certs = [
  // id, 이름(뉴욕), 종류, 판정 능력치, 난이도 1~5, 응시료(원·달러), 시험 달, 발표까지 며칠, 관련 직업·업종
  { id: 'drive', name: '운전면허 1종 보통', ny: "운전면허 (Driver's License)", kind: '면허', stat: 'craft', diff: 1, won: 700000, usd: 300, months: 'all', days: 3, jobs: ['rider', 'parcel', 'driver', 'sales', 'insurance'], cats: ['drive'], desc: '학원 등록비 포함. 따 두면 운전·배달·영업 쪽에서 좋아한다.' },
  { id: 'lang', name: '토익', ny: 'TOEFL', kind: '어학', stat: 'smart', diff: 2, won: 52500, usd: 255, months: 'all', days: 10, score: true, cats: ['office', 'it'], jobs: ['flight', 'bigco', 'marketer', 'pm'], desc: '점수로 나온다. 800점(뉴욕은 100점) 넘으면 대기업·승무원 서류에서 눈에 띈다.' },
  { id: 'comp', name: '컴퓨터활용능력 1급', ny: 'MS 오피스 전문가 (MOS)', kind: '국가기술', stat: 'smart', diff: 2, won: 30000, usd: 100, months: [3, 5, 8, 11], days: 14, cats: ['office'], jobs: ['office', 'hr', 'bank'], desc: '엑셀·데이터베이스. 사무직 서류의 기본.' },
  { id: 'hist', name: '한국사능력검정 1급', ny: '응급처치·CPR', kind: '검정', stat: 'smart', diff: 2, won: 27000, usd: 90, months: [2, 5, 8, 10], days: 14, cats: ['public', 'edu'], jobs: ['civil', 'police', 'teacher', 'firefighter', 'caregiver', 'trainer', 'kinder'], desc: '공무원·교사 쪽에서 가산점처럼 본다. (뉴욕: 응급처치 — 돌봄·체육·교육 쪽)' },
  { id: 'it', name: '정보처리기사', ny: '클라우드 자격 (AWS 계열)', kind: '국가기술', stat: 'smart', diff: 3, won: 50000, usd: 150, months: [3, 6, 9], days: 21, cats: ['it'], jobs: ['dev', 'data', 'gamedev', 'pm'], desc: '개발·데이터 직무의 단골 우대 사항.' },
  { id: 'acct', name: '전산회계 1급', ny: '회계 소프트웨어 자격 (QuickBooks)', kind: '민간', stat: 'smart', diff: 2, won: 40000, usd: 150, months: [2, 4, 6, 8, 10, 12], days: 14, cats: ['office'], jobs: ['accountant', 'office', 'bank', 'hr'], desc: '장부·결산. 회계·경리·은행 서류에 좋다.' },
  { id: 'invest', name: '투자자산운용사', ny: '증권 라이선스 (SIE)', kind: '금융', stat: 'smart', diff: 3, won: 80000, usd: 80, months: [3, 7, 11], days: 21, cats: ['office'], jobs: ['bank', 'insurance', 'accountant'], desc: '은행·보험·금융권 우대.' },
  { id: 'realty', name: '공인중개사', ny: '부동산 중개인 라이선스', kind: '전문', stat: 'smart', diff: 4, won: 33000, usd: 250, months: [10], days: 30, cats: [], jobs: ['realtor'], desc: '1년에 한 번. 어렵지만 붙으면 공인중개사로 일할 수 있는 길이 열린다.' },
  { id: 'cpa', name: '공인회계사(1차)', ny: 'CPA (1과목)', kind: '전문', stat: 'smart', diff: 5, won: 50000, usd: 250, months: [2], days: 45, cats: [], jobs: ['accountant'], desc: '가장 어려운 시험. 회계사 서류는 거의 프리패스.' },
  { id: 'barista', name: '바리스타 2급', ny: '바리스타 자격', kind: '민간', stat: 'craft', diff: 1, won: 100000, usd: 120, months: 'all', days: 7, cats: ['service'], jobs: ['barista', 'server'], desc: '카페 알바·바리스타 지원에 바로 쓴다.' },
  { id: 'cook', name: '한식조리기능사', ny: '푸드 핸들러 · 조리 자격', kind: '국가기술', stat: 'craft', diff: 2, won: 35000, usd: 15, months: [1, 3, 5, 7, 9, 11], days: 14, cats: ['craft'], jobs: ['cook', 'baker', 'server'], desc: '주방·제빵 쪽 기본.' },
  { id: 'hair', name: '미용사(일반) 면허', ny: '미용사 면허 (Cosmetology)', kind: '면허', stat: 'craft', diff: 2, won: 37000, usd: 150, months: [2, 4, 6, 8, 10], days: 14, cats: [], jobs: ['hair'], desc: '미용실에서 일하려면 사실상 필요하다.' },
  { id: 'elec', name: '전기기능사', ny: '전기 기능 자격', kind: '국가기술', stat: 'craft', diff: 3, won: 40000, usd: 120, months: [3, 6, 9, 12], days: 21, cats: ['craft'], jobs: ['electric', 'interior', 'mechanic'], desc: '현장 기술직 우대.' },
  { id: 'care', name: '요양보호사', ny: '홈헬스 에이드 (HHA)', kind: '국가', stat: 'art', diff: 1, won: 500000, usd: 300, months: [2, 5, 8, 11], days: 14, cats: ['medical'], jobs: ['caregiver'], desc: '교육비 포함. 돌봄 일자리에 바로 지원 가능.' },
  { id: 'sport', name: '생활스포츠지도사 2급', ny: '퍼스널 트레이너 자격', kind: '국가', stat: 'fit', diff: 2, won: 70000, usd: 400, months: [5, 10], days: 30, cats: [], jobs: ['trainer'], desc: '헬스 트레이너 서류에 좋다. 체력이 받쳐줘야 한다.' },
  { id: 'color', name: '컬러리스트기사', ny: 'Adobe 공인 전문가', kind: '국가기술', stat: 'art', diff: 3, won: 50000, usd: 100, months: [3, 7, 10], days: 21, cats: ['art'], jobs: ['designer', 'marketer', 'photographer'], desc: '디자인·마케팅 포트폴리오에 한 줄.' },
];
// 앱 이름 (가상)
GAME_DATA.certApp = { kr: '자격넷', ny: '서트허브' };
// 인강·시험 장면 한 줄
GAME_DATA.certLines = {
  study: ['인강을 1.5배속으로 틀어 놓고 노트를 채웠다.', '기출문제를 풀다가 틀린 문제에 별표를 쳤다.', '요약 노트를 만들다 보니 한 시간이 훌쩍 갔다.', '이어폰을 꽂고 강의를 들었다. 가끔 졸았다.', '모르는 개념을 찾아보다 유튜브로 새어 나갈 뻔했다.'],
  lib: ['도서관 열람실은 조용했다. 진도가 쭉쭉 나갔다.', '옆자리 사람들도 다들 뭔가 공부 중이었다. 덩달아 집중이 됐다.'],
  exam: ['시험장 책상에 수험표를 올려놓고 숨을 골랐다.', '시험지를 넘기자 아는 문제가 먼저 보였다.', '시간이 모자랐다. 마지막 몇 문제는 찍었다.'],
};
// 시험 날 아침 (js/game.js certDaily → 이 이벤트) — 보러 가면 ⚡30, 2~3주 뒤 발표
GAME_DATA.events.push({ id: 'cert_exam', type: 'trigger', once: false,
  text: s => `오늘은 ${s.vars.certName} 시험 날이다. 수험표와 신분증을 챙겼다.`,
  choices: [
    { label: '시험 보러 간다', do: (s, a) => a.certTake() },
    { label: '오늘은 포기한다', do: (s, a) => a.certSkip(), effect: { happy: -1 }, text: '이불 속에서 시험 시간이 지나가길 기다렸다. 응시료가 아까웠다.' },
  ] });
