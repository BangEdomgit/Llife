// 직업
// salary: 시작 연봉(만원) — 직급이 오를 때마다 25%씩 오름
// req: degree(true=4년제, 'any'=전문대 포함), tier(이 등급 이내 대학: 1 최상위 … 5 전문대, data/school.js), major(학과 id 목록), gpa(학점), 능력치 등급('C' 등)
// odds: 조건을 넘겼을 때 합격 확률 / clean: 전과 있으면 불가 / volatile: 수입이 해마다 들쭉날쭉
// ranks: 직급 — '일' 행동으로 성과를 쌓으면 승진
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.jobs = [
  // 서비스·알바 (cat: service) — type: 알바·계약직·정규직 / ap: 하루 근무 행동력(기본 45 ≈ 8시간, 알바는 짧게)
  { id: 'cvs',      label: '편의점 직원', cat: 'service', type: '알바', ap: 32, salary: 2000, req: {}, odds: .9, happy: -1, ranks: ['알바', '매니저', '점장'] },
  { id: 'barista',  label: '바리스타',   cat: 'service', type: '알바', ap: 36, salary: 2400, req: { charm: 'E' }, odds: .8, happy: 1, ranks: ['바리스타', '매니저', '점장'] },
  { id: 'server',   label: '홀 서빙',    cat: 'service', type: '알바', ap: 34, salary: 2200, req: {}, odds: .9, happy: -1, ranks: ['서버', '홀 매니저'] },
  { id: 'mart',     label: '마트 캐셔',   cat: 'service', type: '계약직', salary: 2500, req: {}, odds: .85, happy: -1, ranks: ['캐셔', '파트장', '점장'] },
  { id: 'shop',     label: '의류 매장 직원', cat: 'service', type: '계약직', salary: 2600, req: { style: 'D' }, odds: .75, happy: 0, ranks: ['스태프', '부매니저', '매니저'] },
  { id: 'call',     label: '콜센터 상담원', cat: 'service', type: '계약직', salary: 2700, req: {}, odds: .85, happy: -3, ranks: ['상담원', '파트장', '센터장'] },
  { id: 'flight',   label: '승무원',     cat: 'service', type: '정규직', ap: 50, salary: 4200, req: { degree: 'any', charm: 'B', face: 'C', fit: 'C' }, odds: .25, happy: 1, ranks: ['승무원', '부사무장', '사무장'] },
  // 운송·현장 (cat: drive / labor)
  { id: 'rider',    label: '배달 라이더', cat: 'drive', type: '프리랜서', ap: 40, salary: 3000, req: { fit: 'D' }, odds: .9, happy: 0, volatile: true, ranks: ['라이더', '베테랑 라이더'] },
  { id: 'parcel',   label: '택배 기사',   cat: 'drive', type: '프리랜서', ap: 55, salary: 4200, req: { fit: 'C' }, odds: .8, happy: -2, volatile: true, ranks: ['기사', '베테랑 기사', '대리점장'] },
  { id: 'driver',   label: '버스 기사',   cat: 'drive', type: '정규직', ap: 50, salary: 3800, req: { fit: 'D' }, odds: .6, happy: -1, ranks: ['기사', '선임 기사', '배차 팀장'] },
  { id: 'security', label: '경비원',     cat: 'labor', type: '계약직', ap: 50, salary: 2600, req: {}, odds: .85, happy: -1, ranks: ['경비원', '반장'] },
  { id: 'caregiver', label: '요양보호사', cat: 'medical', type: '계약직', salary: 2800, req: { fit: 'D' }, odds: .85, happy: 0, ranks: ['요양보호사', '팀장'] },
  // 기술 (cat: craft)
  { id: 'cook',     label: '요리사',     cat: 'craft', type: '정규직', salary: 2800, req: { craft: 'D', fit: 'E' }, odds: .75, happy: 0, ranks: ['막내', '요리사', '수셰프', '헤드셰프'], major: ['culinary'] },
  { id: 'baker',    label: '제빵사',     cat: 'craft', type: '정규직', ap: 48, salary: 2800, req: { craft: 'D' }, odds: .75, happy: 1, ranks: ['보조', '제빵사', '파티시에', '오너 셰프'], major: ['culinary'] },
  { id: 'hair',     label: '미용사',     cat: 'craft', type: '정규직', salary: 2600, req: { craft: 'C', art: 'E' }, odds: .7, happy: 1, ranks: ['스태프', '디자이너', '원장'], major: ['beauty'] },
  { id: 'mechanic', label: '정비사',     cat: 'craft', type: '정규직', salary: 3200, req: { craft: 'C', fit: 'D' }, odds: .7, happy: 0, ranks: ['정비공', '반장', '공장장'], major: ['engineering'] },
  { id: 'electric', label: '전기 기사',   cat: 'craft', type: '정규직', salary: 3800, req: { craft: 'C', smart: 'D' }, odds: .6, happy: 0, ranks: ['기사', '주임', '소장'], major: ['engineering', 'physics'] },
  { id: 'interior', label: '인테리어 기사', cat: 'craft', type: '프리랜서', salary: 3600, req: { craft: 'C', art: 'D' }, odds: .65, happy: 0, volatile: true, ranks: ['조공', '기공', '실장', '대표'], major: ['architecture', 'design'] },
  // 사무 (cat: office)
  { id: 'office',   label: '회사원',     cat: 'office', type: '정규직', salary: 3600, req: { degree: true, smart: 'C' }, odds: .6, happy: -2, ranks: ['사원', '대리', '과장', '차장', '부장'] },
  { id: 'bigco',    label: '대기업 사원', cat: 'office', type: '정규직', salary: 5500, req: { degree: true, tier: 3, gpa: 3.5, smart: 'B' }, odds: .35, happy: -2, ranks: ['사원', '대리', '과장', '차장', '부장', '임원'] },
  { id: 'sales',    label: '영업직',     cat: 'office', type: '정규직', salary: 3400, req: { charm: 'C' }, odds: .7, happy: -1, volatile: true, ranks: ['사원', '대리', '과장', '팀장'] },
  { id: 'marketer', label: '마케터',     cat: 'office', type: '정규직', salary: 3800, req: { degree: true, charm: 'D', art: 'D' }, odds: .5, happy: 0, ranks: ['주니어', '매니저', '팀장', '이사'], major: ['business', 'media', 'design', 'psychology'] },
  { id: 'hr',       label: '인사 담당자', cat: 'office', type: '정규직', salary: 3800, req: { degree: true, charm: 'D' }, odds: .45, happy: -1, ranks: ['사원', '대리', '과장', '팀장'], major: ['business', 'psychology', 'social'] },
  { id: 'pm',       label: '서비스 기획자', cat: 'office', type: '정규직', salary: 4200, req: { degree: true, smart: 'C' }, odds: .45, happy: -1, ranks: ['주니어', '시니어', '리드', '본부장'] },
  { id: 'bank',     label: '은행원',     cat: 'office', type: '정규직', salary: 5000, req: { degree: true, major: ['business', 'economics'], smart: 'C', charm: 'D' }, odds: .45, happy: -1, ranks: ['행원', '대리', '과장', '지점장'] },
  { id: 'accountant', label: '회계사',   cat: 'office', type: '정규직', ap: 50, salary: 6000, req: { degree: true, major: ['business', 'economics'], smart: 'A' }, odds: .3, happy: -2, ranks: ['스태프', '시니어', '매니저', '파트너'] },
  { id: 'realtor',  label: '공인중개사', cat: 'office', type: '프리랜서', salary: 4000, req: { smart: 'C', charm: 'C' }, odds: .5, happy: 0, volatile: true, ranks: ['소속 중개사', '대표 중개사'] },
  { id: 'insurance', label: '보험설계사', cat: 'office', type: '프리랜서', salary: 3600, req: { charm: 'C' }, odds: .85, happy: -1, volatile: true, ranks: ['설계사', '팀장', '지점장'] },
  // IT (cat: it)
  { id: 'dev',      label: '프로그래머', cat: 'it', type: '정규직', salary: 4800, req: { degree: true, major: ['cs', 'engineering', 'physics'], smart: 'B' }, odds: .55, happy: -1, ranks: ['주니어', '시니어', '리드', 'CTO'] },
  { id: 'data',     label: '데이터 분석가', cat: 'it', type: '정규직', salary: 5000, req: { degree: true, major: ['cs', 'economics', 'physics', 'business'], smart: 'B' }, odds: .45, happy: 0, ranks: ['주니어', '시니어', '리드'] },
  { id: 'gamedev',  label: '게임 개발자', cat: 'it', type: '정규직', ap: 50, salary: 4200, req: { degree: 'any', smart: 'C' }, odds: .5, happy: 1, ranks: ['주니어', '시니어', '디렉터'], major: ['cs', 'design', 'arts'] },
  // 의료 (cat: medical)
  { id: 'nurse',    label: '간호사',     cat: 'medical', type: '정규직', ap: 50, salary: 4200, req: { degree: 'any', major: ['nursing'], fit: 'D' }, odds: .8, happy: -1, ranks: ['간호사', '책임간호사', '수간호사'] },
  { id: 'doctor',   label: '의사',       cat: 'medical', type: '정규직', ap: 55, salary: 9000, req: { degree: true, major: ['medicine'] }, odds: .9, happy: -2, clean: true, ranks: ['전공의', '전문의', '과장', '병원장'] },
  { id: 'pharma',   label: '약사',       cat: 'medical', type: '정규직', salary: 6500, req: { degree: true, major: ['chemistry', 'biology'], smart: 'A' }, odds: .5, happy: 0, clean: true, ranks: ['근무약사', '관리약사', '약국장'] },
  { id: 'trainer',  label: '헬스 트레이너', cat: 'medical', type: '프리랜서', salary: 3000, req: { fit: 'B' }, odds: .7, happy: 1, volatile: true, ranks: ['트레이너', '팀장', '센터장'] },
  // 교육 (cat: edu)
  { id: 'teacher',  label: '교사',       cat: 'edu', type: '정규직', salary: 3800, req: { degree: true, major: ['education'], smart: 'C' }, odds: .3, happy: 1, clean: true, ranks: ['교사', '부장교사', '교감', '교장'] },
  { id: 'tutor',    label: '학원 강사',   cat: 'edu', type: '계약직', salary: 3200, req: { degree: 'any', smart: 'C' }, odds: .65, happy: 0, volatile: true, ranks: ['보조 강사', '강사', '대표 강사', '원장'] },
  { id: 'kinder',   label: '유치원 교사', cat: 'edu', type: '정규직', salary: 2800, req: { degree: 'any', major: ['education', 'psychology', 'social'] }, odds: .6, happy: 1, clean: true, ranks: ['교사', '주임', '원감', '원장'] },
  // 공공 (cat: public)
  { id: 'civil',    label: '공무원',     cat: 'public', type: '정규직', salary: 3200, req: { smart: 'C' }, odds: .3, happy: 0, clean: true, ranks: ['9급', '8급', '7급', '6급', '5급'] },
  { id: 'police',   label: '경찰',       cat: 'public', type: '정규직', ap: 50, salary: 3800, req: { fit: 'C', smart: 'D' }, odds: .3, happy: 0, clean: true, ranks: ['순경', '경장', '경사', '경위', '경감'] },
  { id: 'firefighter', label: '소방관',  cat: 'public', type: '정규직', ap: 50, salary: 3800, req: { fit: 'B' }, odds: .3, happy: 1, clean: true, ranks: ['소방사', '소방교', '소방장', '소방위'] },
  // 미디어·예술 (cat: art)
  { id: 'designer', label: '디자이너',   cat: 'art', type: '정규직', salary: 3300, req: { degree: 'any', major: ['design', 'arts', 'architecture'], art: 'C' }, odds: .6, happy: 1, ranks: ['주니어', '시니어', '아트디렉터'] },
  { id: 'architect', label: '건축가',    cat: 'art', type: '정규직', ap: 50, salary: 4000, req: { degree: true, major: ['architecture'], art: 'C', smart: 'C' }, odds: .5, happy: 0, ranks: ['사원', '실장', '소장'] },
  { id: 'reporter', label: '기자',       cat: 'art', type: '정규직', salary: 3800, req: { degree: true, major: ['korean_lit', 'media', 'political', 'economics', 'philosophy'], smart: 'C', charm: 'D' }, odds: .35, happy: 0, ranks: ['수습기자', '기자', '차장', '부장'] },
  { id: 'pd',       label: '방송 PD',    cat: 'art', type: '정규직', ap: 55, salary: 4200, req: { degree: true, major: ['media', 'korean_lit', 'arts'], art: 'C' }, odds: .25, happy: 0, ranks: ['조연출', 'PD', '책임 PD', '국장'] },
  { id: 'photographer', label: '사진작가', cat: 'art', type: '프리랜서', salary: 3000, req: { art: 'C' }, odds: .7, happy: 2, volatile: true, ranks: ['어시스턴트', '포토그래퍼', '실장'] },
  { id: 'writer',   label: '작가',       cat: 'art', type: '프리랜서', ap: 30, salary: 2600, req: { art: 'C', smart: 'C' }, odds: .6, happy: 2, volatile: true, ranks: ['신인', '연재 작가', '베스트셀러 작가'] },
  { id: 'creator',  label: '유튜버',     cat: 'art', type: '프리랜서', ap: 30, salary: 3000, req: { charm: 'C' }, odds: .95, happy: 2, volatile: true, ranks: ['초보', '중견', '대형'] },
  { id: 'musician', label: '음악가',     cat: 'art', type: '프리랜서', ap: 30, salary: 2500, req: { art: 'B' }, odds: .5, happy: 3, volatile: true, ranks: ['무명', '인디', '유명'] },
];
// 구인 앱(📱 💼): 업종 이름 · 회사 이름 만들기 · 복리후생 · 하는 일 (data/jobs.js — js/game.js '구인')
GAME_DATA.jobCats = { service: '서비스·판매', drive: '운전·배달', labor: '현장·경비', craft: '기술·요리', office: '사무·영업', it: 'IT·개발', medical: '의료·건강', edu: '교육', public: '공공', art: '미디어·예술' };
GAME_DATA.jobSite = {
  kr: { app: '잡서치', minWage: 10320,
    // 직업별 회사 (없으면 업종 co에서)
    by: { cvs: ['하루25 {d}점', '동네마트24 {d}점'], barista: ['스타빈 커피 {d}점', '카페 숲 {d}점', '데일리로스터스'], server: ['바른김밥 {d}점', '{d} 고깃집 화로', '한빛식당'], mart: ['모닝마트 {d}점', '홈플레이스 {d}점'],
      shop: ['무신상 {d} 매장', '어반룩 {d}점'], call: ['케이콜 고객센터', '한빛통신 고객센터'], flight: ['하늘항공', '에어블루'], rider: ['번개이츠', '배달각'], parcel: ['한빛택배 {d}대리점', '빠른택배 {d}센터'],
      driver: ['서울시내버스 {n}번 노선', '{d} 마을버스'], security: ['{d} 한빛아파트 관리사무소', '한빛시큐리티'], caregiver: ['{d} 사랑요양원', '늘봄재가센터'], cook: ['{d} 오마카세', '한빛호텔 주방', '{d} 이탈리안 비스트로'],
      baker: ['빵굽는집 {d}점', '르쁘띠 베이커리'], hair: ['헤어살롱 준', '{d} 바버샵'], mechanic: ['한빛자동차정비', '{d} 카센터'], electric: ['대성전기', '한빛전력기술'], interior: ['바른인테리어', '공간디자인 {d}'],
      office: ['(주)한빛물산', '(주)미래상사'], bigco: ['태평양그룹', '한울전자'], sales: ['(주)미래상사 영업본부', '한빛제약'], marketer: ['브랜드랩', '(주)누리커머스'], hr: ['(주)한빛물산 인사팀', '태평양그룹 HR'],
      pm: ['(주)누리소프트', '코드랩'], bank: ['대성은행 {d}지점'], accountant: ['한결회계법인'], realtor: ['{d} 행복공인중개사'], insurance: ['한빛생명', '든든손해보험'],
      dev: ['(주)누리소프트', '코드랩', '데이터웨이브'], data: ['데이터웨이브', '(주)누리커머스'], gamedev: ['픽셀게임즈', '넥스트플레이'], nurse: ['한빛대학병원', '{d} 온누리내과'], doctor: ['한빛대학병원', '{d} 온누리내과'],
      pharma: ['{d} 온누리약국', '한빛대학병원 약제부'], trainer: ['바디핏 {d}점', '짐박스 {d}'], teacher: ['{d} 한빛초등학교', '한빛중학교', '한빛고등학교'], tutor: ['대치 수학학원', '{d} 영어학원'],
      kinder: ['{d} 해님유치원', '새싹어린이집'], civil: ['{d}구청', '{d}주민센터'], police: ['{d}경찰서'], firefighter: ['{d}소방서'], designer: ['스튜디오 블랭크', '브랜드랩'], architect: ['건축사사무소 공간'],
      reporter: ['한빛일보', '데일리뉴스'], pd: ['HBC 방송국', '온스트림 제작사'], photographer: ['스튜디오 블랭크', '웨딩스냅 {d}'], writer: ['한빛출판사', '웹소설 플랫폼 이야기'], creator: ['MCN 크리에이터스'], musician: ['레이블 소리', '{d} 라이브클럽'] },
    co: { service: ['스타빈 커피 {d}점', '모닝마트 {d}점', '하루25 {d}점', '바른김밥 {d}점', '하늘항공', '무신상 {d} 매장', '케이콜 고객센터'], drive: ['번개배달', '한빛택배 {d}대리점', '서울시내버스 {n}번 노선', '번개이츠 라이더'], labor: ['{d} 한빛아파트 관리사무소', '한빛시큐리티'],
      craft: ['{d} 오마카세', '빵굽는집 {d}점', '헤어살롱 준', '한빛자동차정비', '대성전기', '바른인테리어'], office: ['(주)한빛물산', '(주)미래상사', '태평양그룹', '대성은행', '한결회계법인', '{d} 행복공인중개사', '한빛생명'],
      it: ['(주)누리소프트', '데이터웨이브', '픽셀게임즈', '코드랩'], medical: ['{d} 온누리내과', '한빛대학병원', '{d} 온누리약국', '{d} 요양원', '바디핏 {d}점'],
      edu: ['{d} 한빛초등학교', '대치 수학학원', '{d} 해님유치원'], public: ['{d}구청', '{d}경찰서', '{d}소방서'], art: ['스튜디오 블랭크', '한빛일보', 'HBC 방송국', '건축사사무소 공간', '프리랜서 플랫폼', '레이블 소리'] },
    perks: ['4대보험', '주5일', '식대 지원', '교통비', '퇴직금', '인센티브', '재택 가능', '유연근무', '경조사 지원', '사내 식당', '야근 수당', '주휴수당'],
    say: { doc: ['서류 전형 결과 안내', '지원해 주셔서 감사합니다'], pass: '📧 [{co}] 서류 합격 — {d}에 면접이 잡혔다.', fail: '📧 [{co}] "아쉽게도 이번에는 함께하지 못하게 되었습니다."', offer: '📧 [{co}] 최종 합격! 입사 의사를 알려 달라고 한다. (📱 잡 앱에서 바로 입사)' } },
  ny: { app: '잡보드', minWage: 16.5,
    by: { cvs: ['Corner Deli', 'QuickStop {d}'], barista: ['Bean & Co. {d}', 'Second Pour Coffee'], server: ['{d} 비스트로', 'Joe’s Diner'], mart: ['FreshMart {d}'], shop: ['Stitch & Row {d}'], call: ['CallPoint Center'],
      flight: ['Skyline Airways'], rider: ['DashRun Delivery'], parcel: ['Metro Parcel'], driver: ['City Transit B{n} 노선'], security: ['{d} 콘도 관리실', 'Liberty Security'], caregiver: ['{d} 홈케어', 'Golden Oak Senior Living'],
      cook: ['{d} 비스트로', 'Hudson Grill'], baker: ['Golden Crust Bakery'], hair: ['Salon Noir', '{d} Barbershop'], mechanic: ['Queens Auto Repair'], electric: ['Bright Electric'], interior: ['Brooklyn Renovations'],
      office: ['Empire Trading', 'Hudson Partners'], bigco: ['Atlas Group', 'Harbor Capital'], sales: ['Empire Trading 세일즈팀'], marketer: ['BrandLab NYC'], hr: ['Atlas Group HR'], pm: ['Nimbus Labs', 'Codeworks'],
      bank: ['Brightwater Bank {d} 지점'], accountant: ['Whitfield & Co. CPA'], realtor: ['{d} Realty'], insurance: ['Harbor Insurance'], dev: ['Nimbus Labs', 'Codeworks'], data: ['DataHarbor'], gamedev: ['Pixel Forge Games'],
      nurse: ['East River General 병원', '{d} 클리닉'], doctor: ['East River General 병원'], pharma: ['{d} 약국'], trainer: ['IronFit Gym'], teacher: ['P.S. 2○○ 초등학교'], tutor: ['Ivy Prep 학원'], kinder: ['{d} 프리스쿨'],
      civil: ['뉴욕시청'], police: ['뉴욕시 경찰 {n}지구대'], firefighter: ['뉴욕시 소방서 {n}'], designer: ['Studio Blank'], architect: ['Archform 설계사무소'], reporter: ['Daily Metro 신문'], pd: ['NBX 방송국'],
      photographer: ['Studio Blank'], writer: ['Hudson Books'], creator: ['Creator Collective'], musician: ['Indie Records', '{d} 재즈 바'] },
    co: { service: ['Bean & Co. {d}', 'FreshMart {d}', 'Corner Deli', 'Skyline Airways', 'Stitch & Row {d}', 'CallPoint Center'], drive: ['DashRun Delivery', 'Metro Parcel', 'City Transit B{n} 노선', 'Bike Courier NYC'], labor: ['{d} 콘도 관리실', 'Liberty Security'],
      craft: ['{d} 비스트로', 'Golden Crust Bakery', 'Salon Noir', 'Queens Auto Repair', 'Bright Electric', 'Brooklyn Renovations'], office: ['Hudson Partners', 'Empire Trading', 'Atlas Group', 'Brightwater Bank', 'Whitfield & Co. CPA', '{d} Realty', 'Harbor Insurance'],
      it: ['Nimbus Labs', 'DataHarbor', 'Pixel Forge Games', 'Codeworks'], medical: ['{d} 클리닉', 'East River General 병원', '{d} 약국', '{d} 요양원', 'IronFit Gym'],
      edu: ['P.S. 2○○ 초등학교', 'Ivy Prep 학원', '{d} 프리스쿨'], public: ['뉴욕시청', '뉴욕시 경찰 {n}지구대', '뉴욕시 소방서 {n}'], art: ['Studio Blank', 'Daily Metro 신문', 'NBX 방송국', 'Archform 설계사무소', '프리랜서 플랫폼', 'Indie Records'] },
    perks: ['건강보험', '401(k)', '유급휴가', '통근 지원', '재택 가능', '팁 별도', '유연근무', '헬스장 회원권', '사이닝 보너스'],
    say: { pass: '📧 [{co}] 서류 통과 — {d}에 인터뷰가 잡혔다.', fail: '📧 [{co}] "We have decided to move forward with other candidates."', offer: '📧 [{co}] 오퍼 레터가 왔다! 입사 의사를 알려 달라고 한다.' } },
};
// 직업 없는 NPC에게 붙일 직업 (어른 NPC용)
GAME_DATA.npcJobs = ['회사원', '공무원', '자영업자', '간호사', '선생님', '프로그래머', '요리사', '디자이너', '은행원', '배달 라이더', '대학원생', '프리랜서',
  '주부', '퇴직자', '취준생', '바리스타', '헬스 트레이너', '간병인'];
// 직업별 [기본 비중, 최소 나이, 최대 나이] — 나이에 맞는 것만 뽑음. 장소 분포(data/encounter.js crowds의 job)가 비중을 곱함
//   퇴직자는 58살부터 생기고 65살부터는 대부분 (js/game.js npcJobFor)
GAME_DATA.npcJobW = {
  회사원: [5, 23, 62], 공무원: [1.5, 23, 62], 자영업자: [2, 26, 78], 간호사: [1, 23, 60], 선생님: [1, 24, 62], 프로그래머: [1.2, 23, 52],
  요리사: [1, 23, 68], 디자이너: [1, 23, 52], 은행원: [.8, 24, 60], '배달 라이더': [.8, 20, 62], 대학원생: [.6, 23, 34], 프리랜서: [1.2, 23, 68],
  주부: [1.2, 26, 99], 퇴직자: [0, 58, 99], 취준생: [.8, 23, 32], 바리스타: [.5, 23, 40], '헬스 트레이너': [.3, 23, 45], 간병인: [.3, 40, 72],
};
