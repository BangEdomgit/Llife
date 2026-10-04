// 직업
// salary: 시작 연봉(만원) — 직급이 오를 때마다 25%씩 오름
// req: degree(true=4년제, 'any'=전문대 포함), tier(이 등급 이내 대학: 1 최상위 … 5 전문대, data/school.js), major(학과 id 목록), gpa(학점), 능력치 등급('C' 등)
// odds: 조건을 넘겼을 때 합격 확률 / clean: 전과 있으면 불가 / volatile: 수입이 해마다 들쭉날쭉
// ranks: 직급 — '일' 행동으로 성과를 쌓으면 승진
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.jobs = [
  { id: 'cvs',      label: '편의점 직원', salary: 2200, req: {},                                         odds: .9,  happy: -1, ranks: ['알바', '매니저', '점장'] },
  { id: 'rider',    label: '배달 라이더', salary: 2800, req: { fit: 'D' },                               odds: .9,  happy: 0,  volatile: true, ranks: ['라이더', '베테랑 라이더'] },
  { id: 'barista',  label: '바리스타',   salary: 2400, req: { charm: 'E' },                             odds: .8,  happy: 1,  ranks: ['바리스타', '매니저', '점장'] },
  { id: 'cook',     label: '요리사',     salary: 2800, req: { craft: 'D', fit: 'E' },                   odds: .75, happy: 0,  ranks: ['막내', '요리사', '수셰프', '헤드셰프'], major: ['culinary'] },
  { id: 'hair',     label: '미용사',     salary: 2600, req: { craft: 'C', art: 'E' },                   odds: .7,  happy: 1,  ranks: ['스태프', '디자이너', '원장'], major: ['beauty'] },
  { id: 'mechanic', label: '정비사',     salary: 3200, req: { craft: 'C', fit: 'D' },                   odds: .7,  happy: 0,  ranks: ['정비공', '반장', '공장장'], major: ['engineering'] },
  { id: 'office',   label: '회사원',     salary: 3600, req: { degree: true, smart: 'C' },               odds: .6,  happy: -2, ranks: ['사원', '대리', '과장', '차장', '부장'] },
  { id: 'bigco',    label: '대기업 사원', salary: 5000, req: { degree: true, tier: 3, gpa: 3.5, smart: 'B' }, odds: .35, happy: -2, ranks: ['사원', '대리', '과장', '차장', '부장', '임원'] },
  { id: 'bank',     label: '은행원',     salary: 4500, req: { degree: true, major: ['business', 'economics'], smart: 'C', charm: 'D' }, odds: .45, happy: -1, ranks: ['행원', '대리', '과장', '지점장'] },
  { id: 'dev',      label: '프로그래머', salary: 4800, req: { degree: true, major: ['cs', 'engineering', 'physics'], smart: 'B' }, odds: .55, happy: -1, ranks: ['주니어', '시니어', '리드', 'CTO'] },
  { id: 'designer', label: '디자이너',   salary: 3300, req: { degree: 'any', major: ['design', 'arts', 'architecture'], art: 'C' }, odds: .6, happy: 1, ranks: ['주니어', '시니어', '아트디렉터'] },
  { id: 'teacher',  label: '교사',       salary: 3800, req: { degree: true, major: ['education'], smart: 'C' }, odds: .3, happy: 1, clean: true, ranks: ['교사', '부장교사', '교감', '교장'] },
  { id: 'civil',    label: '공무원',     salary: 3200, req: { smart: 'C' },                             odds: .3,  happy: 0,  clean: true, ranks: ['9급', '8급', '7급', '6급', '5급'] },
  { id: 'nurse',    label: '간호사',     salary: 4000, req: { degree: 'any', major: ['nursing'], fit: 'D' }, odds: .8, happy: -1, ranks: ['간호사', '책임간호사', '수간호사'] },
  { id: 'doctor',   label: '의사',       salary: 9000, req: { degree: true, major: ['medicine'] },          odds: .9,  happy: -2, clean: true, ranks: ['전공의', '전문의', '과장', '병원장'] },
  { id: 'reporter', label: '기자',       salary: 3800, req: { degree: true, major: ['korean_lit', 'media', 'political', 'economics', 'philosophy'], smart: 'C', charm: 'D' }, odds: .35, happy: 0, ranks: ['수습기자', '기자', '차장', '부장'] },
  { id: 'creator',  label: '유튜버',     salary: 3000, req: { charm: 'C' },                             odds: .95, happy: 2,  volatile: true, ranks: ['초보', '중견', '대형'] },
  { id: 'musician', label: '음악가',     salary: 2500, req: { art: 'B' },                               odds: .5,  happy: 3,  volatile: true, ranks: ['무명', '인디', '유명'] },
];
// 직업 없는 NPC에게 붙일 직업 (어른 NPC용)
GAME_DATA.npcJobs = ['회사원', '공무원', '자영업자', '간호사', '선생님', '프로그래머', '요리사', '디자이너', '은행원', '배달 라이더', '대학원생', '프리랜서'];
