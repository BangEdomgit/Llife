// 이벤트 정의
//
// type
//   must     조건이 맞으면 계절이 바뀔 때 반드시 터짐 (입학, 수능, 전역 등)
//   fixed    봄·여름·겨울에 한 번씩 뽑히는 고정 이벤트
//   random   행동 후 가끔 터짐 (on: ['walk'] 처럼 특정 행동에만 붙일 수 있음)
//   karma    업보가 많이 쌓였을 때 (sign: -1 나쁜 일 / 1 좋은 일)
//   trigger  엔진이 직접 부르는 것 (체포, 바람 들킴 등)
//
// 언제: at(나이) / age:[최소,최대] / season:['겨울'] / req / when(s,a) / once:false / cooldown:년 / weight / jail:true(수감 중 전용)
// 결과: text, effect(내 스탯), p(지금 초점 맞춘 사람의 호감도), karma, heat, set, unset, meet(새 사람), memory, do(s,a)
// 문장 틀: {name} {fp}(초점 맞춘 사람) {new}(새로 만난 사람) {partner} 그 외 s.vars 값. 조사는 {fp|와} 처럼
window.GAME_DATA = window.GAME_DATA || {};

(function () {
const gradeOf = v => v >= 90 ? 1 : v >= 80 ? 2 : v >= 70 ? 3 : v >= 60 ? 4 : v >= 50 ? 5 : v >= 40 ? 6 : v >= 30 ? 7 : v >= 20 ? 8 : 9;
const friends = a => a.find(p => !['family', 'child', 'rival'].includes(p.kind));
const adultFriends = a => friends(a).filter(p => a.npcAge(p) >= 19 && !p.partner && !p.spouse && !p.secret);
const kidAt = (a, n) => a.find(p => p.kind === 'child' && a.npcAge(p) === n)[0];
const sibs = a => a.find(p => p.sibling);
const JOB = (...ids) => s => ids.includes(s.job);
const wealthIs = (...ids) => s => ids.includes(s.wealth);
const romanceCand = (a, minHeart) => a.find(p => a.canRomance(p) && !p.partner && !p.spouse && !p.secret && p.heart >= minHeart).sort((x, y) => y.heart - x.heart)[0];
GAME_DATA.events = [
  /* ═════ 반드시 (must) ═════ */
  { id: 'firstSteps', type: 'must', at: 1, text: '처음으로 걸음마를 뗐다. 엄마가 박수를 쳤다.', memory: true, effect: { happy: 3 } },
  { id: 'firstWord',  type: 'must', at: 2, season: ['여름'], text: ['첫 마디는 "엄마"였다.', '첫 마디는 "아빠"였다. 아빠가 하루 종일 자랑했다.'], memory: true, effect: { rel: { family: 3 } } },
  { id: 'elementary', type: 'must', at: 7, text: '초등학교에 입학했다. 가방이 몸보다 컸다.', memory: true,
    do: (s, a) => { a.meet({ kind: 'classmate', ageRange: [7, 7], close: 25 }); a.meet({ kind: 'classmate', ageRange: [7, 7], close: 20 }); } },
  { id: 'middle', type: 'must', at: 13, text: '중학교에 입학했다. 교복이 아직 어색하다.', memory: true,
    do: (s, a) => { a.meet({ kind: 'classmate', ageRange: [13, 13], close: 25 }); } },
  { id: 'high', type: 'must', at: 16, text: '고등학교에 입학했다. 3년이 길 것 같기도, 짧을 것 같기도 하다.', memory: true,
    do: (s, a) => { a.meet({ kind: 'classmate', ageRange: [16, 16], close: 25 }); } },
  { id: 'schoolTrip', type: 'must', at: 17, text: '수학여행을 갔다. 밤새 떠드느라 한숨도 못 잤다.', memory: true, effect: { happy: 8 } },
  { id: 'dreamSpeech', type: 'must', at: 10, text: '장래희망 발표 시간. "{dreamSpeech}"', memory: true },
  { id: 'suneung', type: 'must', at: 18, season: ['겨울'], req: { noFlags: ['inJail'] },
    do: (s, a) => a.takeSuneung(0), text: s => s.vars.satText, memory: true, then: 'collegeApply' },
  { id: 'suneung2', type: 'must', at: 19, season: ['겨울'], req: { flags: ['retake'], noFlags: ['inJail'] },
    do: (s, a) => a.takeSuneung(6), text: s => '두 번째 수능. ' + s.vars.satText, memory: true, then: 'collegeApply' },
  { id: 'enlist', type: 'must', at: 20, req: { gender: 'm', noFlags: ['inJail'] },
    text: '입영 통지서가 날아왔다. 머리를 짧게 깎았다.', memory: true, set: ['army', 'inArmy'], effect: { happy: -6, health: 4 },
    do: s => {
      s.vars.enlistAge = s.age; s.job = null; s.salary = 0;
      if (s.flags.student) { s.vars.armyInCollege = true; delete s.flags.student; s.flags.onLeave = true; }
    } },
  { id: 'discharge', type: 'must', when: s => s.flags.inArmy && s.age >= s.vars.enlistAge + 2,
    text: '전역했다! 바깥 공기가 다르게 느껴진다.', memory: true, unset: 'inArmy', effect: { happy: 10 },
    do: s => { if (s.flags.onLeave) { delete s.flags.onLeave; s.flags.student = true; } } },
  { id: 'graduation', type: 'must', season: ['겨울'],
    when: s => s.flags.student && s.school.start != null && s.age - s.school.start >= s.school.years - 1 + (s.vars.armyInCollege ? 2 : 0),
    do: (s, a) => a.graduate(), text: s => `졸업식. 학사모를 하늘 높이 던졌다. 학점 ${s.school.gpa.toFixed(2)}.`, memory: true, effect: { happy: 8 } },
  { id: 'kidSchool', type: 'must', once: false, when: (s, a) => !!kidAt(a, 7),
    onStart: (s, a) => a.focus(kidAt(a, 7)),
    text: '{fp|이} 초등학교에 입학했다. 내 입학식 날이 떠올랐다.', memory: true, effect: { happy: 6 } },
  { id: 'partnerFade', type: 'must', once: false,
    when: (s, a) => { const m = a.main(); return m && m.partner && m.close < 15 && m.heart < 25; },
    onStart: (s, a) => a.focus(a.main()),
    text: '{fp|와} 연락이 뜸해지더니 자연스럽게 멀어졌다.', memory: true, effect: { happy: -6 },
    do: (s, a) => a.breakUp(a.focused(), 5) },
  { id: 'spouseCrisis', type: 'must', once: false, cooldown: 2,
    when: (s, a) => { const m = a.main(); return m && m.spouse && m.close < 15; },
    onStart: (s, a) => a.focus(a.main()),
    text: '{fp|와} 말 한마디 안 하는 날이 늘었다.',
    choices: [
      { label: '마주 앉아 이야기한다', p: { close: [12, 18], trust: [3, 6] }, text: '밤새 이야기했다. 조금은 풀린 것 같다.' },
      { label: '각자 시간을 갖는다', p: { close: -5 }, text: '집 안이 조용해졌다.' },
      { label: '이혼하자고 한다', memory: true, effect: { happy: -6 }, do: (s, a) => a.divorce(a.focused()), text: '{fp|와} 갈라서기로 했다.' },
    ] },
  { id: 'fiftyEve', type: 'must', at: 49, season: ['겨울'], text: '내년이면 쉰이다. 시간이 참 빠르다.' },

  /* ═════ 고정 — 어린 시절 ═════ */
  { id: 'kinderFight', type: 'fixed', age: [4, 6], text: '어린이집에서 장난감 때문에 친구랑 싸웠다.',
    choices: [
      { label: '먼저 사과한다', text: '먼저 미안하다고 했다. 선생님이 칭찬 스티커를 줬다.', effect: { happy: 2 }, karma: 2 },
      { label: '엉엉 운다', text: '한참 울었다. 장난감은 결국 돌려받았다.', effect: { happy: -1 } },
    ] },
  { id: 'amusementPark', type: 'fixed', age: [4, 8], season: ['봄', '여름'], text: '가족이랑 놀이공원에 갔다. 회전목마를 세 번이나 탔다.', memory: true, effect: { happy: 8, rel: { family: 4 } } },
  { id: 'bike', type: 'fixed', age: [6, 9], season: ['봄', '여름'], text: '보조바퀴 없이 자전거를 탔다! 무릎이 까졌지만 상관없었다.', memory: true, effect: { health: 3, happy: 4 } },
  { id: 'snowman', type: 'fixed', age: [3, 10], season: ['겨울'], text: '첫눈이 왔다. 마당에 눈사람을 만들었다. 코는 당근으로 했다.', memory: true, effect: { happy: 5 } },
  { id: 'santa', type: 'fixed', age: [4, 9], season: ['겨울'], text: '크리스마스 아침, 머리맡에 선물이 놓여 있었다.', memory: true, effect: { happy: 6 } },
  { id: 'wantDog', type: 'fixed', age: [6, 9], text: '강아지를 키우고 싶다.',
    choices: [
      { label: '부모님을 조른다', chance: .55,
        success: { set: 'dog', do: (s, a) => { s.vars.dogName = a.pick(GAME_DATA.dogNames); }, text: '{dogName|이라는} 강아지가 가족이 됐다!', memory: true, effect: { happy: 10 } },
        fail: { text: '안 된다는 대답만 돌아왔다.', effect: { happy: -3, rel: { family: -2 } } } },
      { label: '꾹 참는다', text: '강아지 영상만 잔뜩 봤다.' },
    ] },
  { id: 'dictation', type: 'fixed', age: [7, 9], req: { stats: { smart: 30 } }, text: '받아쓰기 100점을 받았다. 냉장고에 시험지가 붙었다.', effect: { happy: 3, smart: 1 } },
  { id: 'academy', type: 'fixed', age: [8, 11], text: '엄마가 학원을 알아보고 있다.',
    choices: [
      { label: '학원에 다닌다', text: '학원 가방이 하나 늘었다.', effect: { smart: [3, 5], happy: -3 }, do: (s, a) => a.subjAll(4) },
      { label: '놀고 싶다고 한다', text: '놀이터에서 해가 질 때까지 놀았다.', effect: { happy: 4, rel: { mom: -3 } } },
    ] },
  { id: 'election', type: 'fixed', age: [9, 12], season: ['봄'], text: '반장 선거 날이다.',
    choices: [
      { label: '손을 든다', check: { stat: 'charm', diff: 40 },
        success: { set: 'president', text: '반장이 됐다! 집에 가는 길이 유난히 길게 느껴졌다.', memory: true, effect: { happy: 8 } },
        fail: { text: '두 표 차이로 떨어졌다.', effect: { happy: -4 } } },
      { label: '조용히 있는다', text: '박수만 열심히 쳤다.' },
    ] },
  { id: 'sportsDay', type: 'fixed', age: [7, 12], season: ['봄'], cooldown: 3, once: false, text: '운동회 날, 계주 선수로 뽑혔다.',
    choices: [
      { label: '죽어라 뛴다', check: { stat: 'fit', diff: 45 },
        success: { text: '1등으로 들어왔다! 반 친구들이 이름을 외쳤다.', memory: true, effect: { happy: 7 } },
        fail: { text: '마지막 코너에서 바통을 떨어뜨렸다.', effect: { happy: -4 } } },
      { label: '응원석으로 빠진다', text: '목이 쉬도록 응원했다.', effect: { happy: 1 } },
    ] },
  { id: 'summerBreak', type: 'fixed', age: [7, 12], season: ['여름'], cooldown: 2, once: false, text: '여름방학이다.',
    choices: [
      { label: '시골 할머니 댁에 간다', text: '할머니 댁 평상에 누워 수박을 먹었다. 별이 엄청 많았다.', memory: true, effect: { happy: 5, rel: { family: 3 } } },
      { label: '캠프에 간다', meet: s => ({ kind: 'friend', ageRange: [s.age, s.age + 1], close: 30 }), text: '캠프에서 {new|와} 단짝이 됐다.', effect: { happy: 4 } },
      { label: '집에서 뒹군다', text: '에어컨 밑에서 만화책만 봤다.', effect: { happy: 2 } },
    ] },
  { id: 'dogWalk', type: 'fixed', age: [9, 15], req: { flags: ['dog'] }, text: '{dogName|와} 동네를 한 바퀴 돌았다. 꼬리가 쉬지 않았다.', effect: { health: 2, happy: 3 } },

  /* ═════ 고정 — 10대 ═════ */
  { id: 'puberty', type: 'fixed', age: [13, 14], text: '거울 보는 시간이 부쩍 늘었다.', effect: { looks: 2, happy: -2 } },
  { id: 'midterm', type: 'fixed', age: [13, 15], season: ['봄', '겨울'],
    text: (s, a) => a.subjAvg() >= 60 ? '중간고사에서 반 5등 안에 들었다.' : '중간고사 성적표를 가방 깊숙이 넣었다.',
    effect: (s, a) => a.subjAvg() >= 60 ? { happy: 4 } : { happy: -3 } },
  { id: 'bigFight', type: 'fixed', age: [13, 15],
    onStart: (s, a) => {
      let f = friends(a).sort((x, y) => y.close - x.close)[0];
      if (!f) f = a.meet({ kind: 'classmate', ageRange: [s.age, s.age], close: 55 });
      a.focus(f);
    },
    text: '제일 친한 친구 {fp|와} 크게 싸웠다.',
    choices: [
      { label: '먼저 사과한다', set: 'bestfriend', p: { close: [8, 12], trust: [8, 12] }, memory: true, effect: { happy: 3 },
        do: (s, a) => { const f = a.focused(); s.vars.bf = f.id; s.vars.bfName = f.name; },
        text: '{fp|이} 웃으면서 받아줬다. 오히려 더 가까워졌다.' },
      { label: '그냥 둔다', p: { close: -15, grudge: 12 }, effect: { happy: -4 }, text: '그 뒤로 {fp|와} 어색해졌다.' },
    ] },
  { id: 'gameHooked', type: 'fixed', age: [12, 16], text: '새로 나온 게임에 푹 빠졌다.',
    choices: [
      { label: '밤새 한다', set: 'gamer', text: '해 뜨는 걸 보고 잠들었다.', effect: { happy: 5, smart: -2, health: -2 } },
      { label: '하루 한 시간만', text: '알람을 맞춰두고 했다.', effect: { happy: 2 } },
    ] },
  { id: 'camp', type: 'fixed', age: [14, 15], season: ['여름'], text: '수련회. 밤에 몰래 과자 파티를 하다 걸렸다.', memory: true, effect: { happy: 5 } },
  { id: 'skipStudy', type: 'fixed', age: [16, 18], text: '친구들이 야자 째고 떡볶이 먹으러 가자고 한다.',
    choices: [
      { label: '따라간다', text: '떡볶이가 유난히 맛있었다. 다음 날 혼났다.', memory: true, effect: { happy: 6, smart: -1 } },
      { label: '자리를 지킨다', text: '창밖으로 친구들 뒷모습이 보였다.', effect: { smart: 2, happy: -1 } },
    ] },
  { id: 'firstWork', type: 'fixed', age: [16, 18], req: { job: false }, text: '편의점 주말 알바 자리가 났다.',
    choices: [
      { label: '해본다', text: '첫 월급으로 부모님 선물을 샀다.', memory: true, effect: { money: 60, happy: 2, rel: { family: 5 } } },
      { label: '공부에 집중한다', text: '아직은 공부할 때라고 생각했다.', effect: { smart: 2 } },
    ] },
  { id: 'hundredDays', type: 'fixed', age: [18, 18], season: ['여름'], text: '수능 D-100. 교실 뒤 칠판의 숫자가 하루씩 줄어든다.', effect: { happy: -2, smart: 1 } },
  { id: 'dogOld', type: 'fixed', age: [15, 19], req: { flags: ['dog'] }, text: '{dogName|이} 많이 늙었다. 산책 속도가 느려졌다.', set: 'dogOld', effect: { happy: -2 } },
  { id: 'dogBye', type: 'fixed', age: [17, 24], req: { flags: ['dogOld'] }, text: '{dogName|와} 작별했다. 빈 방석을 한참 바라봤다.', memory: true, unset: ['dog', 'dogOld'], effect: { happy: -12 } },

  /* ═════ 고정 — 20대 ═════ */
  { id: 'collegeFest', type: 'fixed', age: [19, 23], season: ['봄'], req: { flags: ['student'] }, text: '대학 축제. 처음 보는 사람들이랑 밤새 놀았다.', memory: true, effect: { happy: 6 },
    meet: s => ({ kind: 'friend', ageRange: [s.age - 1, s.age + 2], close: 25 }) },
  { id: 'mt', type: 'fixed', age: [19, 21], season: ['봄'], req: { flags: ['student'] }, text: '첫 MT. 밤새 게임하다가 아침에 라면을 먹었다.', memory: true, effect: { happy: 5 } },
  { id: 'moveOut', type: 'fixed', age: [21, 30], text: '처음으로 자취방을 구했다. 좁지만 온전히 내 공간이다.', memory: true, effect: { happy: 5, money: -300 } },
  { id: 'jobSeason', type: 'fixed', age: [23, 30], once: false, cooldown: 2, req: { job: false, noFlags: ['student', 'inArmy', 'inJail'] }, text: '공채 시즌이다.',
    choices: [
      { label: '원서를 왕창 쓴다', do: (s, a) => a.tryJob(), text: s => s.job ? '드디어 합격 문자가 왔다.' : '불합격 메일만 잔뜩 쌓였다.', effect: s => s.job ? { happy: 6 } : { happy: -4 } },
      { label: '이번엔 쉰다', text: '조급해하지 않기로 했다.', effect: { happy: 1 } },
    ] },
  { id: 'vacation', type: 'fixed', age: [22, 48], season: ['여름'], once: false, cooldown: 3, req: { noFlags: ['inJail'] }, text: '휴가철이다.',
    choices: [
      { label: '혼자 떠난다', text: '혼자 바다를 보러 갔다. 생각보다 좋았다.', memory: true, effect: { happy: 8, money: -100 } },
      { label: '친구랑 간다', if: (s, a) => adultFriends(a).some(p => p.close >= 45),
        do: (s, a) => a.focus(adultFriends(a).sort((x, y) => y.close - x.close)[0]),
        p: { close: [6, 10] }, text: '{fp|와} 바다에 갔다. 밤새 이야기했다.', memory: true, effect: { happy: 7, money: -100 } },
      { label: '집에서 쉰다', text: '휴가 내내 잠만 잤다.', effect: { health: 2 } },
    ] },
  { id: 'christmas', type: 'fixed', age: [19, 49], season: ['겨울'], once: false, cooldown: 2, req: { noFlags: ['inJail'] }, text: '크리스마스 이브다.',
    choices: [
      { label: '연인과 보낸다', if: (s, a) => !!a.main(), do: (s, a) => a.focus(a.main()), p: { heart: [5, 9], close: [3, 5] }, text: '{fp|와} 트리 앞에서 사진을 찍었다.', memory: true, effect: { happy: 6 } },
      { label: '친구들과 파티', text: '케이크를 나눠 먹고 선물 교환을 했다.', effect: { happy: 5 } },
      { label: '혼자 케이크 한 조각', text: '혼자 먹는 케이크도 나쁘지 않았다.', effect: { happy: 1 } },
    ] },
  { id: 'friendWedding', type: 'fixed', age: [26, 40], when: (s, a) => adultFriends(a).some(p => p.close >= 60),
    onStart: (s, a) => a.focus(adultFriends(a).sort((x, y) => y.close - x.close)[0]),
    text: s => s.vars.fp === s.vars.bf ? '{fp|이} 결혼한다며 축사를 부탁했다. 중학교 때 싸웠던 얘기로 시작했다.' : '{fp|이} 결혼한다. 축가를 부탁받았다.',
    memory: true, effect: { happy: 5 }, p: { close: [4, 8] }, do: (s, a) => { const f = a.focused(); if (f) f.taken = true; } },
  { id: 'marriageTalk', type: 'fixed', age: [26, 45],
    when: (s, a) => { const m = a.main(); return m && m.partner && m.heart >= 70 && m.trust >= 55; },
    onStart: (s, a) => a.focus(a.main()),
    text: '{fp|와} 함께한 지 꽤 됐다. 자연스럽게 결혼 이야기가 나왔다.',
    choices: [
      { label: '결혼하자', do: (s, a) => a.marry(a.focused()), memory: true, effect: { happy: 12, money: -1500 }, text: '작은 결혼식을 올렸다. {fp|이} 울다가 웃었다.' },
      { label: '아직은 이르다', p: { heart: -8 }, text: '조금 더 지켜보기로 했다.' },
    ] },
  { id: 'baby', type: 'fixed', age: [27, 45], once: false, weight: 2,
    when: (s, a) => { const m = a.main(); return m && m.spouse && a.find(p => p.kind === 'child').length < 2; },
    meet: s => ({ kind: 'child', ageDiff: -s.age, close: 80, trust: 60 }),
    text: '아이가 태어났다. 이름은 {new|으로} 지었다.', memory: true, effect: { happy: 15 } },

  /* ═════ 고정 — 30~40대 ═════ */
  { id: 'hobby', type: 'fixed', age: [25, 40], text: '퇴근 후에 할 취미를 찾고 있다.',
    choices: [
      { label: '기타를 배운다', set: 'guitar', text: '첫 코드를 잡았다. 손가락 끝이 얼얼했다.', memory: true, effect: { happy: 5 } },
      { label: '등산을 시작한다', set: 'hiking', text: '첫 정상에서 컵라면을 먹었다.', memory: true, effect: { health: 5, happy: 3 } },
      { label: '그냥 쉰다', text: '쉬는 것도 취미라고 생각하기로 했다.', effect: { happy: 2 } },
    ] },
  { id: 'gameRemaster', type: 'fixed', age: [28, 42], req: { flags: ['gamer'] }, text: '어릴 때 밤새 하던 게임이 리마스터로 나왔다. 손이 아직 기억하고 있었다.', memory: true, effect: { happy: 6 } },
  { id: 'guitarAgain', type: 'fixed', age: [35, 49], req: { flags: ['guitar'] }, text: '오랜만에 기타를 꺼냈다. 손가락이 아직 코드를 기억한다.', memory: true, effect: { happy: 4 } },
  { id: 'teamDinner', type: 'fixed', age: [24, 45], req: { job: true }, text: '회식 자리. 2차로 노래방에 가자고 한다.',
    choices: [
      { label: '따라간다', text: '탬버린을 열심히 흔들었다.', effect: { happy: -2, health: -1 } },
      { label: '조용히 빠진다', text: '집에 가서 라면을 끓였다. 행복했다.', effect: { happy: 2 } },
    ] },
  { id: 'invest', type: 'fixed', age: [25, 45], req: { minMoney: 1000 }, text: '친구가 주식 이야기를 꺼냈다.',
    choices: [
      { label: '한번 넣어본다', chance: .5,
        success: { text: '생각보다 수익이 꽤 났다.', effect: { money: [300, 1500], happy: 4 } },
        fail: { text: '계좌가 반토막이 났다. 앱을 지웠다.', effect: { money: [-1000, -300], happy: -5 } } },
      { label: '관심 없다', text: '적금이나 하나 더 들었다.' },
    ] },
  { id: 'checkup', type: 'fixed', age: [38, 50], once: false, cooldown: 4, text: '건강검진 안내 문자가 왔다.',
    choices: [
      { label: '받으러 간다', text: '일찍 발견해서 다행이었다.', effect: { money: -30, health: 6 } },
      { label: '다음에 받는다', text: '괜찮겠지 하고 넘겼다.', effect: { health: -6 } },
    ] },
  { id: 'parentsAging', type: 'fixed', age: [38, 46], req: { person: 'mom' }, text: '부모님 흰머리가 부쩍 늘었다.',
    choices: [
      { label: '자주 찾아뵌다', text: '주말마다 본가에 들렀다. 엄마가 반찬을 잔뜩 싸줬다.', memory: true, effect: { rel: { family: 10 }, happy: 3, money: -100 } },
      { label: '요즘은 너무 바쁘다', text: '전화만 몇 번 드렸다.', effect: { rel: { family: -6 } } },
    ] },
  { id: 'farewellDad', type: 'fixed', age: [43, 50], weight: .6, req: { person: 'dad' }, when: s => !!s.done.parentsAging,
    onStart: (s, a) => { s.vars.dadClose = a.person('dad').close; },
    text: s => s.vars.dadClose >= 70 ? '아버지가 돌아가셨다. 마지막까지 손을 꼭 잡고 있었다.' : '아버지가 돌아가셨다. 하지 못한 말들이 자꾸 떠올랐다.',
    memory: true, effect: { happy: -15 }, do: (s, a) => { a.person('dad').gone = true; } },
  { id: 'reunion', type: 'fixed', age: [40, 48],
    text: s => s.flags.president ? '동창회에 나갔다. 다들 반장이었던 나를 기억하고 있었다.'
      : s.vars.bfName ? '동창회에 나갔다. {bfName|이} 제일 먼저 손을 흔들었다.'
      : '동창회에 나갔다. 이름이 잘 떠오르지 않는 얼굴이 많았다.',
    memory: true, effect: { happy: 5 } },
  { id: 'midlife', type: 'fixed', age: [42, 49], text: '문득, 사는 게 뭔가 싶다.',
    choices: [
      { label: '새로운 걸 배운다', text: '동네 문화센터에 등록했다. 다들 나보다 나이가 많았다.', effect: { smart: 3, happy: 4 } },
      { label: '옛날 친구에게 연락한다', if: (s, a) => friends(a).length > 0,
        do: (s, a) => a.focus(friends(a).sort((x, y) => x.close - y.close)[0]), p: { close: [10, 15] },
        text: '{fp}에게 오랜만에 전화를 걸었다. 목소리가 그대로였다.', memory: true, effect: { happy: 4 } },
      { label: '그냥 산다', text: '그래도 오늘 저녁은 맛있었다.', effect: { happy: 1 } },
    ] },

  /* ═════ 고정 — 수감 중 ═════ */
  { id: 'jailVisit', type: 'fixed', jail: true, once: false, cooldown: 1,
    onStart: (s, a) => { a.focus(a.find(p => p.close >= 55).sort((x, y) => y.close - x.close)[0] || null); },
    text: s => s.vars.fp ? '면회 날. {fp|이} 찾아왔다. 유리창 너머로 손을 맞댔다.' : '면회 날. 아무도 오지 않았다.',
    memory: true, effect: s => s.vars.fp ? { happy: 4 } : { happy: -4 } },
  { id: 'jailPlan', type: 'fixed', jail: true, text: '같은 방 사람이 탈옥 계획을 꺼냈다.',
    choices: [
      { label: '끼어든다', chance: .3,
        success: { text: '한밤중에 담을 넘었다. 이제 쫓기는 몸이다.', memory: true, karma: -10, do: (s, a) => a.escape(true) },
        fail: { text: '계획이 새어 나갔다. 형기가 늘었다.', do: (s, a) => a.escape(false) } },
      { label: '모른 척한다', text: '눈을 감고 자는 척했다.', karma: 2 },
    ] },

  /* ═════ 랜덤 (행동 뒤 가끔) ═════ */
  { id: 'wallet', type: 'random', on: ['walk', 'parttime', 'exercise'], age: [8, 50], once: false, cooldown: 4, text: '길에서 두툼한 지갑을 주웠다.',
    choices: [
      { label: '경찰서에 맡긴다', karma: 8, text: '주인이 고맙다며 음료수를 사줬다.', effect: { happy: 3 } },
      { label: '슬쩍 챙긴다', karma: -10, heat: 5, text: '현금만 빼고 지갑은 버렸다. 하루 종일 찜찜했다.', effect: s => ({ money: s.age >= 18 ? [10, 50] : [1, 5] }) },
    ] },
  { id: 'stranger', type: 'random', on: ['walk', 'travel', 'read'], age: [19, 49], once: false, cooldown: 2, text: '옆자리 사람이 먼저 말을 걸어왔다.',
    choices: [
      { label: '이야기를 나눈다', meet: s => ({ kind: 'friend', ageRange: [Math.max(19, s.age - 6), Math.min(49, s.age + 6)], close: 20 }), text: '{new|와} 한참 이야기했다. 연락처를 주고받았다.' },
      { label: '이어폰을 낀다', text: '창밖만 봤다.' },
    ] },
  { id: 'classmateAsk', type: 'random', on: ['study', 'read'], age: [7, 18], once: false, cooldown: 2,
    meet: s => ({ kind: 'classmate', ageRange: [s.age, s.age], close: 22 }), text: '같은 반 {new|이} 모르는 문제를 물어봤다. 그 뒤로 친해졌다.' },
  { id: 'gymBuddy', type: 'random', on: ['exercise'], age: [16, 49], once: false, cooldown: 3,
    meet: s => ({ kind: 'friend', ageRange: [Math.max(16, s.age - 5), s.age + 6], close: 20 }), text: '운동하다 자주 마주치던 {new|와} 인사를 텄다.' },
  { id: 'sprain', type: 'random', on: ['exercise'], once: false, cooldown: 3, text: '운동하다 발목을 삐었다.', effect: { health: -6 } },
  { id: 'bookNote', type: 'random', on: ['read'], text: '헌책 사이에서 누군가의 오래된 쪽지를 발견했다. "꼭 행복해."', memory: true, effect: { happy: 3 } },
  { id: 'rudeCustomer', type: 'random', on: ['parttime', 'overtime'], once: false, cooldown: 2, text: '진상 손님이 소리를 질렀다.',
    choices: [
      { label: '참는다', text: '꾹 참았다. 집에 와서 베개에 소리 질렀다.', effect: { happy: -3 } },
      { label: '한마디 한다', text: '할 말은 했다. 속은 시원했다.', effect: { happy: 3 }, karma: -1 },
    ] },
  { id: 'onlineFriend', type: 'random', on: ['game'], age: [12, 49], once: false, cooldown: 3,
    meet: s => ({ kind: 'friend', ageRange: s.age < 19 ? [s.age - 1, s.age + 1] : [Math.max(19, s.age - 5), s.age + 5], close: 20 }), text: '게임에서 만난 {new|와} 친해졌다.' },
  { id: 'grandma', type: 'random', on: ['volunteer'], text: '봉사하다 만난 할머니가 고맙다며 손을 꼭 잡아주셨다.', memory: true, karma: 3, effect: { happy: 4 } },
  { id: 'travelNight', type: 'random', on: ['travel'], once: false, cooldown: 3, text: '여행지에서 길을 잃었다가 우연히 엄청난 노을을 봤다.', memory: true, effect: { happy: 5 } },
  { id: 'oldFriend', type: 'random', age: [20, 50], once: false, cooldown: 3,
    when: (s, a) => friends(a).some(p => p.close < 40),
    onStart: (s, a) => a.focus(friends(a).filter(p => p.close < 40)[0]),
    p: { close: [10, 14] }, text: '오랜만에 {fp|이} 먼저 연락해왔다.', effect: { happy: 3 } },
  { id: 'debtCall', type: 'random', once: false, cooldown: 2,
    when: (s, a) => a.find(p => p.debt > 0).length > 0,
    onStart: (s, a) => { const p = a.find(x => x.debt > 0)[0]; a.focus(p); s.vars.debt = a.money(p.debt); },
    text: '{fp|이} 빌려간 돈 {debt} 얘기를 꺼냈다.',
    choices: [
      { label: '갚는다', if: (s, a) => s.money >= a.focused().debt, do: (s, a) => { const p = a.focused(); s.money -= p.debt; p.debt = 0; }, p: { trust: [6, 10] }, text: '빌린 돈을 다 갚았다. 마음이 가벼워졌다.' },
      { label: '조금만 더 기다려달라', p: { trust: -10 }, text: '{fp|은} 한숨을 쉬었다.' },
      { label: '모른 척한다', p: { trust: -30, grudge: 25, close: -15 }, karma: -10, text: '{fp|와} 사이가 틀어졌다.' },
    ] },
  { id: 'flu', type: 'random', once: false, cooldown: 3, text: '독감에 걸려 며칠을 앓았다.', effect: { health: -5 } },
  { id: 'foundCoin', type: 'random', on: ['walk'], once: false, cooldown: 5, text: '길에서 만 원을 주웠다.', effect: { money: 1, happy: 1 } },

  /* ═════ 업보 ═════ */
  { id: 'kLostWallet', type: 'karma', sign: -1, once: false, text: '지갑을 잃어버렸다. 어디서 흘렸는지 모르겠다.', effect: s => ({ money: s.age >= 18 ? [-80, -10] : [-3, -1], happy: -3 }) },
  { id: 'kBike', type: 'karma', sign: -1, once: false, text: '누가 내 자전거를 훔쳐갔다. 기분이 묘했다.', effect: { happy: -4 } },
  { id: 'kScam', type: 'karma', sign: -1, age: [20, 50], once: false, text: '믿었던 사람에게 사기를 당했다.', effect: { money: [-1000, -200], happy: -8 } },
  { id: 'kFall', type: 'karma', sign: -1, once: false, text: '계단에서 굴러떨어졌다. 한동안 깁스를 했다.', effect: { health: -10 } },
  { id: 'kRumor', type: 'karma', sign: -1, once: false, when: (s, a) => friends(a).length > 0,
    onStart: (s, a) => a.focus(a.pick(friends(a))), p: { trust: [-18, -10] }, text: '내 지난 일에 대한 소문이 {fp}의 귀에 들어갔다.' },
  { id: 'kLotto', type: 'karma', sign: 1, once: false, text: '심심풀이로 산 복권이 5만 원에 당첨됐다.', effect: { money: 5, happy: 3 } },
  { id: 'kHelped', type: 'karma', sign: 1, age: [20, 50], once: false, text: '예전에 도와줬던 사람이 큰 도움을 줬다. 세상 일은 돌고 돈다.', effect: { money: [50, 200], happy: 5 } },
  { id: 'kLucky', type: 'karma', sign: 1, once: false, text: '이상하게 일이 술술 풀리는 날들이었다.', effect: { happy: 6 } },


  /* ═════ 학교 — 대학 지원 (엔진이 수능 뒤에 부름) ═════ */
  { id: 'collegeApply', type: 'trigger',
    text: s => `${['가', '나', '다'][s.vars.attempt - 1]}군 원서를 쓴다. 환산 등급 ${s.vars.uniScore.toFixed(2)}.`,
    choices: GAME_DATA.univTiers.map(t => ({
      label: (s, a) => `${t.label} (${a.chanceText(t)})`,
      if: (s, a) => a.reachable(t),
      chance: (s, a) => a.admitChance(t),
      success: { do: (s, a) => a.admit(t.id), text: `${t.label}에 합격했다!`, memory: true, effect: { happy: 10 }, then: 'chooseMajor' },
      fail: { text: `${t.label} 불합격.`, effect: { happy: -4 }, then: s => ++s.vars.attempt <= 3 ? 'collegeApply' : 'collegeFail' },
    })).concat([
      { label: '재수한다', if: s => !s.flags.retake, set: 'retake', text: '1년만 더 해보기로 했다.', effect: { happy: -6 } },
      { label: '대학 대신 사회로 나간다', set: 'noCollege', text: '대학 대신 바로 일을 시작하기로 했다.', effect: { happy: 1 } },
    ]) },
  { id: 'collegeFail', type: 'trigger', text: '세 군데 모두 떨어졌다.',
    choices: [
      { label: '재수한다', if: s => !s.flags.retake, set: 'retake', text: '이를 악물었다. 1년만 더.', effect: { happy: -4 } },
      { label: '사회로 나간다', set: 'noCollege', text: '다른 길도 있다고 생각하기로 했다.' },
    ] },
  { id: 'chooseMajor', type: 'trigger', text: '어떤 전공으로 갈까?',
    choices: GAME_DATA.majors.map(m => ({
      label: m.label, if: (s, a) => a.majorOk(m),
      do: (s, a) => a.setMajor(m.id), text: `${m.label}에 들어갔다.`,
    })) },
  { id: 'gpaWarning', type: 'fixed', age: [19, 26], req: { flags: ['student'] }, when: s => s.school.gpa > 0 && s.school.gpa < 2.5,
    text: '학사경고 안내 문자가 왔다.',
    choices: [
      { label: '정신 차린다', text: '도서관 자리를 맡았다.', effect: { smart: [2, 4], happy: -3 }, do: s => { s.school.studyYear += 2; } },
      { label: '대학이 다는 아니다', text: '괜찮다고, 스스로를 달랬다.', effect: { happy: 1 } },
    ] },

  /* ═════ 가족 — 형제 ═════ */
  { id: 'siblingBorn', type: 'must', when: s => s.vars.sibGap < 0 && s.age === -s.vars.sibGap,
    do: (s, a) => a.addSibling(), text: '동생 {new|이} 태어났다. 이제 나도 형제가 있다.', memory: true, effect: { happy: 4 } },
  { id: 'siblingFight', type: 'fixed', age: [5, 15], once: false, cooldown: 4, when: (s, a) => sibs(a).length > 0,
    onStart: (s, a) => a.focus(a.pick(sibs(a))), text: '{fp|와} 리모컨 때문에 크게 싸웠다.',
    choices: [
      { label: '먼저 사과한다', p: { close: [4, 8] }, text: '먼저 미안하다고 했다. 같이 만화를 봤다.', karma: 1 },
      { label: '엄마한테 이른다', p: { close: -6, grudge: 5 }, text: '{fp|이} 혼났다. 며칠 동안 말을 안 했다.' },
    ] },
  { id: 'siblingWedding', type: 'fixed', age: [22, 48], when: (s, a) => sibs(a).some(p => a.npcAge(p) >= 27),
    onStart: (s, a) => a.focus(sibs(a).find(p => a.npcAge(p) >= 27)), text: '{fp|이} 결혼했다. 식장에서 괜히 눈물이 났다.',
    memory: true, p: { close: [4, 8] }, effect: { happy: 4 }, do: (s, a) => { a.focused().taken = true; } },
  { id: 'siblingMoney', type: 'fixed', age: [26, 48], when: (s, a) => sibs(a).some(p => a.npcAge(p) >= 25) && s.money >= 300,
    onStart: (s, a) => a.focus(sibs(a).find(p => a.npcAge(p) >= 25)), text: '{fp|이} 조심스럽게 돈 이야기를 꺼냈다. 300만원이 급하다고 했다.',
    choices: [
      { label: '빌려준다', effect: { money: -300 }, p: { close: [8, 12], trust: [8, 12] }, karma: 3, text: '말없이 송금했다.' },
      { label: '나도 여유가 없다', p: { close: -8 }, text: '{fp|이} 괜찮다며 웃었다. 그 웃음이 신경 쓰였다.' },
    ] },

  /* ═════ 집안 형편 ═════ */
  { id: 'tutoring', type: 'fixed', age: [10, 17], when: wealthIs('rich', 'comfy'), text: '고액 과외 선생님이 집으로 오기 시작했다.',
    do: (s, a) => a.subjAll(6), effect: { smart: [3, 5], happy: -3 } },
  { id: 'studyAbroad', type: 'fixed', age: [13, 17], when: wealthIs('rich'), text: '부모님이 유학 이야기를 꺼냈다.',
    choices: [
      { label: '1년만 다녀온다', text: '낯선 나라에서 1년을 보냈다. 영어가 늘었다.', memory: true, effect: { smart: [4, 7], charm: [2, 4], happy: 2 }, do: (s, a) => a.subjAdd('eng', 15) },
      { label: '여기 남겠다', text: '친구들이랑 떨어지기 싫었다.', effect: { rel: { family: -4 } } },
    ] },
  { id: 'padding', type: 'fixed', age: [12, 17], when: wealthIs('tight', 'poor'), text: '반 애들이 다 비싼 패딩을 입고 왔다.',
    choices: [
      { label: '사달라고 조른다', text: '엄마가 한참 말이 없더니 사주셨다. 마음이 무거웠다.', effect: { happy: 2, rel: { family: -4 } } },
      { label: '그냥 참는다', text: '작년 패딩 지퍼를 끝까지 올렸다.', effect: { happy: -3 }, karma: 1 },
      { label: '알바해서 산다', if: s => s.age >= 16, text: '두 달 알바해서 직접 샀다. 제일 따뜻한 옷이었다.', memory: true, effect: { happy: 4, fit: 2 } },
    ] },
  { id: 'homeFight', type: 'fixed', age: [6, 16], once: false, cooldown: 3, when: wealthIs('complex'), text: '부모님이 또 다투셨다.',
    choices: [
      { label: '방에 들어가 이어폰을 낀다', text: '음악 소리를 최대로 키웠다.', effect: { happy: -4, art: [1, 3] } },
      { label: '사이에 끼어 말린다', text: '울면서 그만하라고 소리쳤다. 집 안이 조용해졌다.', memory: true, effect: { happy: -2, rel: { family: 4 } } },
    ] },
  { id: 'inheritance', type: 'fixed', age: [40, 50], when: wealthIs('rich', 'comfy'), text: '부모님이 미리 재산을 조금 나눠주셨다.',
    effect: s => ({ money: s.wealth === 'rich' ? [2000, 5000] : [500, 1500], happy: 3 }) },

  /* ═════ 사람 — 성격·취미·가치관 ═════ */
  { id: 'npcSignal', type: 'random', age: [19, 50], once: false, cooldown: 1,
    when: (s, a) => !!romanceCand(a, 25),
    onStart: (s, a) => { const p = romanceCand(a, 25); a.focus(p); s.vars.signal = a.personality(p).signal; },
    text: s => s.vars.signal, p: { heart: [3, 6] } },
  { id: 'npcConfess', type: 'fixed', age: [19, 49], once: false, cooldown: 2, weight: 2,
    when: (s, a) => !!romanceCand(a, 65),
    onStart: (s, a) => a.focus(romanceCand(a, 65)),
    text: '{fp|이} 할 말이 있다며 나를 불러냈다. 좋아한다고 했다.',
    choices: [
      { label: '받아준다', memory: true, effect: { happy: [6, 10] },
        do: (s, a) => a.startRelation(a.focused(), !!a.main()),
        text: (s, a) => a.focused().secret ? '{fp|와} 몰래 만나기 시작했다.' : '{fp|와} 사귀게 됐다!' },
      { label: '미안하다고 한다', p: { heart: [-25, -15], close: [-6, -3] }, text: '{fp|이} 괜찮다며 먼저 돌아섰다.' },
    ] },
  { id: 'friendMoment', type: 'random', once: false, cooldown: 1,
    when: (s, a) => a.find(p => !['family', 'child'].includes(p.kind) && p.close >= 50).length > 0,
    onStart: (s, a) => { const p = a.pick(a.find(x => !['family', 'child'].includes(x.kind) && x.close >= 50)); a.focus(p); s.vars.fline = a.personality(p).friendLine; },
    text: s => s.vars.fline, p: { close: [2, 4] } },
  { id: 'hobbyClub', type: 'fixed', age: [13, 45], once: false, cooldown: 6,
    text: s => s.age < 19 ? '{hobbyLabel} 동아리에서 신입 부원을 모집한다.' : '{hobbyLabel} 동호회 모집 글을 봤다.',
    choices: [
      { label: '들어간다', meet: (s, a) => ({ kind: 'friend', hobby: s.hobby, ageRange: s.age < 19 ? [s.age, s.age + 1] : [Math.max(19, s.age - 6), Math.min(49, s.age + 6)], close: 30 }),
        text: '{new|와} 금방 친해졌다. 좋아하는 게 같으니까.', effect: { happy: 4 } },
      { label: '혼자가 편하다', text: '혼자 하는 것도 나쁘지 않다.' },
    ] },
  { id: 'valueClash', type: 'fixed', age: [22, 49], once: false, cooldown: 3,
    when: (s, a) => { const m = a.main(); return m && a.valueClash(m) && m.close >= 25; },
    onStart: (s, a) => { const m = a.main(); a.focus(m); s.vars.myValue = a.valueLabel(s.value); s.vars.theirValue = a.valueLabel(m.value); },
    text: '{fp|와} 생각이 부딪쳤다. 나는 {myValue|이}, {fp|은} {theirValue|이} 먼저였다.',
    choices: [
      { label: '내가 맞춘다', p: { close: [4, 6], trust: [4, 6] }, effect: { happy: -3 }, text: '이번엔 내가 한발 물러섰다.' },
      { label: '내 생각을 지킨다', p: { close: [-10, -6], grudge: [5, 10] }, text: '둘 다 말없이 잠들었다.' },
      { label: '절충안을 찾는다', check: { stat: 'charm', diff: 90 },
        success: { p: { trust: [6, 10] }, text: '한참 이야기한 끝에 서로 조금씩 양보했다.' },
        fail: { p: { close: -3 }, text: '이야기가 자꾸 겉돌았다.' } },
    ] },

  /* ═════ 직업별 ═════ */
  { id: 'cvsDrunk', type: 'fixed', weight: 2.5, when: JOB('cvs'), text: '새벽, 술 취한 손님이 계산대 앞에서 시비를 걸었다.',
    choices: [
      { label: '웃으며 넘긴다', text: '끝까지 웃었다. 퇴근길에 한숨이 길었다.', effect: { happy: -3, charm: [1, 2] } },
      { label: '단호하게 대한다', text: '경찰을 부르겠다고 하자 조용히 나갔다.', effect: { happy: 2 } },
    ] },
  { id: 'cvsGrandpa', type: 'fixed', weight: 2.5, when: JOB('cvs'), text: '매일 오시는 할아버지 손님이 귤 몇 개를 두고 가셨다.', memory: true, effect: { happy: 4 } },
  { id: 'riderStorm', type: 'fixed', weight: 3, once: false, cooldown: 2, when: s => s.job === 'rider' && ['rain', 'storm', 'snow', 'sleet'].includes(s.weather),
    text: '궂은 날씨에 배달 콜이 쏟아진다. 단가가 두 배다.',
    choices: [
      { label: '달린다', check: { stat: 'fit', diff: 70 },
        success: { text: '하루 만에 일주일치를 벌었다.', effect: { money: [100, 200], health: -3 } },
        fail: { text: '빗길에 미끄러졌다. 한동안 일을 못 했다.', memory: true, effect: { health: -12, money: -50 } } },
      { label: '오늘은 쉰다', text: '창밖 빗소리를 들으며 라면을 먹었다.', effect: { happy: 2 } },
    ] },
  { id: 'riderNote', type: 'fixed', weight: 2.5, when: JOB('rider'), text: '단골 고객이 문 앞에 음료수와 "늘 고마워요" 쪽지를 놓아뒀다.', memory: true, effect: { happy: 5 } },
  { id: 'baristaRegular', type: 'fixed', weight: 2.5, when: JOB('barista'),
    meet: s => ({ kind: 'friend', ageRange: [Math.max(19, s.age - 6), Math.min(49, s.age + 8)], close: 25 }),
    text: '매일 같은 시간에 오는 손님 {new|와} 이야기를 나누게 됐다.', effect: { happy: 3 } },
  { id: 'latteArt', type: 'fixed', weight: 2.5, when: JOB('barista'), text: '라떼아트 대회에 나가보라는 권유를 받았다.',
    choices: [
      { label: '나간다', check: { stat: 'art', diff: 100 },
        success: { text: '입상했다! 가게 벽에 상장이 걸렸다.', memory: true, effect: { happy: 6 }, do: (s, a) => a.perf(15) },
        fail: { text: '손이 떨려서 하트가 찌그러졌다.', effect: { happy: -2 } } },
      { label: '자신 없다', text: '대신 우유 거품 연습을 더 했다.', effect: { art: [1, 3] } },
    ] },
  { id: 'cookTV', type: 'fixed', weight: 2.5, when: JOB('cook'), text: '맛집 프로그램에서 섭외 전화가 왔다.',
    choices: [
      { label: '출연한다', text: '방송이 나간 다음 날 줄이 가게 밖까지 섰다.', memory: true, effect: { happy: 6, charm: [2, 4] }, do: (s, a) => a.perf(15) },
      { label: '거절한다', text: '조용히 내 음식만 만들고 싶었다.' },
    ] },
  { id: 'ownShop', type: 'fixed', age: [30, 48], weight: 2, when: s => ['cook', 'barista', 'hair'].includes(s.job) && s.rank >= 1 && s.money >= 3000,
    text: '내 가게를 차려볼까?',
    choices: [
      { label: '차린다', chance: (s) => .35 + s.stats.charm / 600,
        success: { text: '가게가 자리를 잡았다. 간판에 내 이름이 걸렸다.', memory: true, effect: { money: -3000, happy: 10 }, do: s => { s.salary = Math.round(s.salary * 1.8); s.flags.owner = true; } },
        fail: { text: '1년을 못 버티고 가게를 접었다.', memory: true, effect: { money: -3000, happy: -12 }, do: (s, a) => a.loseJob() } },
      { label: '아직은 아니다', text: '조금 더 모아보기로 했다.' },
    ] },
  { id: 'hairMiss', type: 'fixed', weight: 2.5, when: JOB('hair'), text: '손님 앞머리를 너무 짧게 잘랐다.',
    choices: [
      { label: '솔직하게 사과한다', text: '손님이 웃으며 다음에 또 오겠다고 했다.', karma: 2, effect: { charm: [1, 2] } },
      { label: '요즘 유행이라고 우긴다', text: '손님은 다시 오지 않았다.', karma: -2, do: (s, a) => a.perf(-8) },
    ] },
  { id: 'mechHonest', type: 'fixed', weight: 2.5, when: JOB('mechanic'), text: '차를 잘 모르는 손님이다. 수리비를 부풀려도 모를 것 같다.',
    choices: [
      { label: '정직하게 받는다', text: '손님이 단골이 됐다.', karma: 5, do: (s, a) => a.perf(5) },
      { label: '조금 부풀린다', text: '주머니가 두둑해졌다. 마음은 아니었다.', karma: -8, heat: 5, effect: { money: [50, 150] } },
    ] },
  { id: 'mechInjury', type: 'fixed', weight: 2, when: JOB('mechanic'), text: '정비 중에 손을 크게 다쳤다.', effect: { health: -10, craft: -3 } },
  { id: 'stealCredit', type: 'fixed', weight: 2.5, when: JOB('office', 'bigco', 'bank'), text: '팀장이 내 기획을 자기 것처럼 발표했다.',
    choices: [
      { label: '공개적으로 따진다', check: { stat: 'charm', diff: 100 },
        success: { text: '다들 내 편을 들었다. 기획은 내 이름으로 올라갔다.', memory: true, do: (s, a) => a.perf(18) },
        fail: { text: '분위기만 싸해졌다.', do: (s, a) => a.perf(-10), effect: { happy: -3 } } },
      { label: '참는다', text: '화장실에서 한참 있다 나왔다.', effect: { happy: -4 } },
    ] },
  { id: 'poach', type: 'fixed', weight: 2, when: s => ['office', 'bigco', 'bank', 'dev', 'designer', 'reporter'].includes(s.job) && s.rank >= 1,
    text: '다른 회사에서 이직 제안이 왔다. 연봉을 20% 더 주겠다고 한다.',
    choices: [
      { label: '옮긴다', text: '새 명함이 생겼다.', effect: { happy: 3 }, do: s => { s.salary = Math.round(s.salary * 1.2); s.perf = 20; } },
      { label: '남는다', text: '지금 팀이 좋다.', do: (s, a) => a.perf(5) },
    ] },
  { id: 'bankQuota', type: 'fixed', weight: 2.5, when: JOB('bank'), text: '실적 압박. 노부부 고객에게 위험한 상품을 권하라고 한다.',
    choices: [
      { label: '권한다', text: '실적표에 숫자가 올라갔다. 그날 밤 잠이 안 왔다.', karma: -8, do: (s, a) => a.perf(15) },
      { label: '거절한다', text: '안전한 적금을 권해드렸다.', karma: 5, do: (s, a) => a.perf(-10) },
    ] },
  { id: 'devOutage', type: 'fixed', weight: 2.5, once: false, cooldown: 3, when: JOB('dev'), text: '새벽 3시, 서버가 터졌다는 알림이 왔다.',
    choices: [
      { label: '바로 노트북을 연다', text: '해 뜰 때쯤 복구했다. 팀장이 커피를 사줬다.', effect: { health: -4 }, do: (s, a) => a.perf(12) },
      { label: '못 본 척 다시 잔다', text: '아침에 메시지가 99개 와 있었다.', do: (s, a) => a.perf(-12) },
    ] },
  { id: 'devSide', type: 'fixed', weight: 2, when: s => s.job === 'dev' && s.stats.smart >= 150, text: '취미로 만든 앱이 입소문을 탔다.',
    memory: true, effect: { money: [300, 1500], happy: 6 } },
  { id: 'designRevise', type: 'fixed', weight: 2.5, when: JOB('designer'), text: '클라이언트의 수정 요청이 열일곱 번째다. "처음 거로 해주세요."',
    choices: [
      { label: '끝까지 맞춘다', text: '결국 첫 시안으로 갔다.', effect: { happy: -4 }, do: (s, a) => a.perf(8) },
      { label: '정중하게 선을 긋는다', check: { stat: 'charm', diff: 90 },
        success: { text: '오히려 신뢰를 얻었다.', do: (s, a) => a.perf(10) },
        fail: { text: '클라이언트가 떨어져 나갔다.', do: (s, a) => a.perf(-10) } },
    ] },
  { id: 'designAward', type: 'fixed', weight: 2, when: s => s.job === 'designer' && s.stats.art >= 170, text: '내 디자인이 상을 받았다.', memory: true, effect: { happy: 8 } },
  { id: 'teacherCounsel', type: 'fixed', weight: 2.5, once: false, cooldown: 3, when: JOB('teacher'), text: '반 아이 하나가 고민이 있다며 남았다.',
    choices: [
      { label: '끝까지 들어준다', text: '해가 질 때까지 이야기했다. 아이가 웃으며 돌아갔다.', karma: 5, effect: { happy: 3 } },
      { label: '오늘은 바빠서 다음에', text: '그 아이는 다시 찾아오지 않았다.', karma: -2 },
    ] },
  { id: 'teacherAlumni', type: 'fixed', age: [33, 50], weight: 2, when: JOB('teacher'), text: '첫 제자가 찾아왔다. 어엿한 어른이 돼 있었다.', memory: true, effect: { happy: 8 } },
  { id: 'civilComplaint', type: 'fixed', weight: 2.5, when: JOB('civil'), text: '민원인이 한 시간째 고함을 지르고 있다.',
    choices: [
      { label: '끝까지 응대한다', text: '결국 민원인이 미안하다고 했다.', effect: { happy: -3, charm: [1, 2] }, do: (s, a) => a.perf(6) },
      { label: '상급자에게 넘긴다', text: '숨을 돌렸다.', effect: { happy: 1 } },
    ] },
  { id: 'civilOnTime', type: 'fixed', weight: 2, when: JOB('civil'), text: '6시 정각 퇴근. 하늘이 아직 밝았다.', effect: { happy: 4 } },
  { id: 'nurseNight', type: 'fixed', weight: 2.5, once: false, cooldown: 3, when: JOB('nurse'), text: '야간 근무 중 새벽에 환자 상태가 급변했다.',
    choices: [
      { label: '바로 대처한다', check: { stat: 'smart', diff: 90 },
        success: { text: '빨리 알아챈 덕에 환자가 고비를 넘겼다.', memory: true, do: (s, a) => a.perf(15) },
        fail: { text: '선배가 대신 처리했다. 손이 떨렸다.', do: (s, a) => a.perf(-5), effect: { happy: -3 } } },
    ] },
  { id: 'doctorER', type: 'fixed', weight: 2.5, once: false, cooldown: 2, when: JOB('doctor'), text: '응급실 당직, 36시간째 집에 못 갔다.', effect: { health: -6, happy: -2 }, do: (s, a) => a.perf(8) },
  { id: 'doctorLetter', type: 'fixed', weight: 2, when: JOB('doctor'), text: '퇴원한 환자가 손편지를 보내왔다.', memory: true, effect: { happy: 8 } },
  { id: 'doctorBribe', type: 'fixed', weight: 2, when: JOB('doctor'), text: '제약회사 영업사원이 봉투를 내밀었다.',
    choices: [
      { label: '받는다', text: '봉투가 생각보다 두꺼웠다.', karma: -12, heat: 15, effect: { money: [300, 800] } },
      { label: '돌려보낸다', text: '정중하게 돌려보냈다.', karma: 5 },
    ] },
  { id: 'scoop', type: 'fixed', weight: 2.5, when: JOB('reporter'), text: '특종 제보가 들어왔다. 확인이 아직 덜 됐다.',
    choices: [
      { label: '바로 터뜨린다', chance: .5,
        success: { text: '단독 기사가 하루 종일 1면에 걸렸다.', memory: true, do: (s, a) => a.perf(20) },
        fail: { text: '오보였다. 정정 기사를 냈다.', karma: -5, do: (s, a) => a.perf(-20), effect: { happy: -6 } } },
      { label: '끝까지 확인한다', text: '다른 언론사가 먼저 냈다. 그래도 내 기사가 더 정확했다.', karma: 3, do: (s, a) => a.perf(5) },
    ] },
  { id: 'viral', type: 'fixed', weight: 2.5, once: false, cooldown: 4, when: JOB('creator'), text: '올린 영상 하나가 떡상했다.', memory: true, effect: { money: [500, 3000], happy: 8, charm: [2, 4] } },
  { id: 'hateComments', type: 'fixed', weight: 2.5, once: false, cooldown: 3, when: JOB('creator'), text: '악플이 쏟아졌다.',
    choices: [
      { label: '무시한다', text: '댓글창을 닫았다. 그래도 자꾸 생각났다.', effect: { happy: -5 } },
      { label: '법적 대응한다', text: '고소장을 냈다. 조금은 후련했다.', effect: { money: -200, happy: 2 } },
    ] },
  { id: 'adOffer', type: 'fixed', weight: 2, when: JOB('creator'), text: '광고 제의가 들어왔다. 써보니 별로인 제품이다.',
    choices: [
      { label: '받는다', text: '광고비가 들어왔다. 댓글 반응은 싸늘했다.', karma: -5, effect: { money: [500, 1000] } },
      { label: '거절한다', text: '구독자들이 그 얘기를 듣고 더 좋아해줬다.', karma: 3, effect: { charm: [2, 3] } },
    ] },
  { id: 'gig', type: 'fixed', weight: 2.5, when: JOB('musician'), text: '첫 단독 공연. 관객이 스무 명 왔다. 다 기억난다.', memory: true, effect: { happy: 8, art: [2, 4] } },
  { id: 'busking', type: 'fixed', weight: 2.5, once: false, cooldown: 3, when: JOB('musician'),
    meet: s => ({ kind: 'friend', hobby: 'music', ageRange: [Math.max(19, s.age - 6), Math.min(49, s.age + 6)], close: 30 }),
    text: '버스킹에 사람들이 모여들었다. 끝나고 {new|이} 말을 걸어왔다.', effect: { happy: 4 } },
  { id: 'layoff', type: 'fixed', weight: 3, when: s => !!s.job && s.perf < 15 && !s.flags.owner, text: '회사에서 면담 요청이 왔다. 분위기가 심상치 않다.',
    choices: [
      { label: '한 번만 기회를 달라고 한다', check: { stat: 'charm', diff: 80 },
        success: { text: '마지막 기회를 받았다.', do: s => { s.perf = 35; } },
        fail: { text: '권고사직 서류에 서명했다.', memory: true, effect: { happy: -8 }, do: (s, a) => a.loseJob() } },
      { label: '먼저 그만두겠다고 한다', text: '짐을 상자 하나에 담아 나왔다.', effect: { happy: -4 }, do: (s, a) => a.loseJob() },
    ] },

  /* ═════ 트리거 (엔진이 부름) ═════ */
  { id: 'arrest', type: 'trigger', text: s => s.vars.late ? '몇 년 전 일이 들통났다. 경찰이 찾아왔다.' : '경찰에 붙잡혔다.',
    choices: [
      { label: '순순히 인정한다', do: (s, a) => a.sentence(-1) },
      { label: '끝까지 부인한다', chance: s => s.stats.smart / 160,
        success: { text: '증거 불충분으로 풀려났다.', karma: -3 },
        fail: { do: (s, a) => a.sentence(1) } },
      { label: '변호사를 산다', if: s => s.age >= 19 && s.money >= 500, effect: { money: -500 }, do: (s, a) => a.sentence(-2) },
    ] },
  { id: 'affairCaught', type: 'trigger', text: '{mainName|이} 눈치를 챘다. 내가 {lover|와} 몰래 만나고 있다는 걸.',
    choices: [
      { label: '무릎 꿇고 빈다', chance: (s, a) => (a.person(s.vars.mainId) || { trust: 0 }).trust / 130,
        success: { text: '겨우 용서받았다. {lover|와는} 정리했다.',
          do: (s, a) => { const m = a.person(s.vars.mainId), l = a.person(s.vars.loverId); if (m) a.changeP(m, { trust: -25, heart: -15 }); if (l) a.breakUp(l, 20); } },
        fail: { text: '{mainName|은} 끝내 나를 용서하지 않았다.', memory: true, do: (s, a) => a.endMain(40) } },
      { label: '{lover|을} 택한다', memory: true, text: '{mainName|와} 끝냈다. 이제 {lover|와} 숨지 않아도 된다.',
        do: (s, a) => { a.endMain(30); const l = a.person(s.vars.loverId); if (l) { l.secret = false; l.partner = true; } } },
      { label: '끝까지 잡아뗀다', chance: .35,
        success: { text: '겨우 넘어갔다. 하지만 눈빛이 달라졌다.', do: (s, a) => { const m = a.person(s.vars.mainId); if (m) a.changeP(m, { trust: -15 }); } },
        fail: { text: '거짓말까지 들통났다. {mainName|은} 짐을 쌌다.', memory: true, do: (s, a) => a.endMain(50) } },
    ] },
  { id: 'rivalFound', type: 'trigger', text: '{fp}의 애인이 나를 찾아왔다. 표정이 심상치 않았다.',
    choices: [
      { label: '사과하고 물러난다', p: { heart: [-25, -15] }, karma: 3, text: '고개를 숙였다. {fp|와는} 거리를 두기로 했다.' },
      { label: '맞선다', effect: { health: [-10, -3] }, karma: -5,
        meet: s => ({ kind: 'rival', ageRange: [Math.max(19, s.age - 5), Math.min(49, s.age + 5)], close: 0, grudge: 60 }),
        text: '{new|와} 크게 부딪쳤다. 적이 하나 생겼다.' },
    ] },
];
})();
