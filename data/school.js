// 학교 — 과목 실력(0~100), 내신·모의고사·수능 등급, 대학, 전공, 학점
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.subjects = [
  { id: 'kor',  label: '국어' },
  { id: 'math', label: '수학' },
  { id: 'eng',  label: '영어' },
  { id: 'sci',  label: '탐구' },
];
GAME_DATA.schoolStart = 13;   // 이 나이부터 과목 실력이 따로 쌓임 (중학교)

// 대학 — need: 환산 등급(수능 70% + 내신 30%)이 이 이하면 안정권. years: 졸업까지 햇수
GAME_DATA.univTiers = [
  { id: 1, label: '최상위권 대학',  need: 1.7, years: 4 },
  { id: 2, label: '서울 상위권 대학', need: 2.5, years: 4 },
  { id: 3, label: '서울 중위권 대학', need: 3.4, years: 4 },
  { id: 4, label: '지방 국립대',    need: 4.4, years: 4 },
  { id: 5, label: '지방 사립대',    need: 5.6, years: 4 },
  { id: 6, label: '전문대',        need: 7.2, years: 2, college: true },
];

// 전공 — tierMax: 이 등급 이하 대학에서만 / college: 전문대 전공 / need: 과목 실력 조건 / years: 졸업 햇수 덮어쓰기
GAME_DATA.majors = [
  { id: '의예',   label: '의예과',   tierMax: 1, need: { math: 85, sci: 85 }, years: 6 },
  { id: '교육',   label: '교육학과', tierMax: 4, need: { kor: 60 } },
  { id: '공학',   label: '공학',     tierMax: 5, need: { math: 55 } },
  { id: '자연',   label: '자연과학', tierMax: 5, need: { sci: 55 } },
  { id: '상경',   label: '경영·경제', tierMax: 5, need: { math: 45 } },
  { id: '인문',   label: '인문학',   tierMax: 5 },
  { id: '예체능', label: '예체능',   tierMax: 5, needAb: { art: 'D' } },
  { id: '간호',   label: '간호학과', tierMax: 6, need: { sci: 45 }, years: 4 },
  { id: '조리',   label: '조리과',   college: true },
  { id: '미용',   label: '미용과',   college: true },
  { id: '자동차', label: '자동차과', college: true },
  { id: '디자인', label: '디자인과', college: true },
];
