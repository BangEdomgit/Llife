// 이벤트 정의
//
// type
//   must     조건이 맞으면 계절이 바뀔 때 반드시 터짐 (입학, 수능, 전역 등)
//   fixed    봄·여름·겨울에 한 번씩 뽑히는 고정 이벤트
//   random   행동 후 가끔 터짐 (on: ['walk'] 처럼 특정 행동, on: ['cafe'] 처럼 특정 장소에만 붙일 수 있음)
//   karma    업보가 많이 쌓였을 때 (sign: -1 나쁜 일 / 1 좋은 일)
//   trigger  엔진이 직접 부르는 것 (체포, 바람 들킴 등)
//
// 언제: at(나이) / age:[최소,최대] / season:['겨울'] / req / when(s,a) / once:false / cooldown:년 / weight / jail:true(수감 중 전용)
// 결과: text, effect(내 스탯), p(지금 초점 맞춘 사람의 호감도), karma, heat, set, unset, meet(새 사람), memory, do(s,a)
// 문장 틀: {name} {fp}(초점 맞춘 사람) {new}(새로 만난 사람) {partner} {place}(지금 장소) 그 외 s.vars 값. 조사는 {fp|와} 처럼
// 장소 이벤트에서 쓰는 것: a.here()(지금 여기 있는 아는 사람), a.regular('cafe')(단골인지), s.place, s.placeNight(저녁에 왔는지)
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
// 장소: 또래 나이대, 여기서 알게 된 사람, 지금 여기 있는 아는 사람
const peer = s => s.age < 19 ? [Math.max(4, s.age - 1), s.age + 1] : [Math.max(19, s.age - 6), Math.min(49, s.age + 6)];
const meetHere = extra => s => Object.assign({ kind: 'friend', ageRange: peer(s), hangout: s.place, close: 20 }, extra && (typeof extra === 'function' ? extra(s) : extra));
const hereWho = (a, fn) => a.here().filter(p => !fn || fn(p));
const focusHere = fn => (s, a) => a.focus(a.pick(hereWho(a, fn)));
const focusNew = (s, a) => a.focus(a.person(s.vars.newId));
const NOT_ROUTINE = ['playground', 'park', 'cafe', 'library', 'gym', 'pcbang', 'mall', 'hospital', 'center', 'bar', 'church', 'conveni', 'concert'];
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
  { id: 'moveOut', type: 'fixed', age: [21, 30], req: { noFlags: ['married'] }, text: '처음으로 자취방을 구했다. 좁지만 온전히 내 공간이다.', memory: true, set: 'ownPlace', effect: { happy: 5, money: -300 } },
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

  /* ═════ 장소 (도착했을 때, 또는 거기서 행동할 때 가끔) ═════ */
  // 집
  { id: 'homeBlackout', type: 'random', on: ['home'], age: [5, 50], once: false, cooldown: 6,
    text: (s, a) => a.here().length ? '갑자기 정전이 됐다. 촛불 하나를 가운데 두고 둘러앉아 이야기했다.' : '갑자기 정전이 됐다. 촛불을 켜고 창밖을 오래 봤다.',
    do: (s, a) => a.here().forEach(p => a.changeP(p, { close: [2, 4] })), effect: { happy: 2 } },
  { id: 'homeCleaning', type: 'random', on: ['home'], age: [10, 50], once: false, cooldown: 5,
    text: '대청소를 했다. 서랍 깊숙한 곳에서 옛날 사진이 나왔다. 한참을 들여다봤다.', effect: { happy: 2, health: 1 } },
  { id: 'homeCooking', type: 'random', on: ['home', 'rest'], age: [12, 50], once: false, cooldown: 4, text: '냉장고에 남은 재료로 뭔가 만들어보기로 했다.',
    choices: [
      { label: '레시피대로 만든다', text: '레시피를 한 줄씩 따라 했다. 먹을 만했다.', effect: { craft: [1, 2], happy: 1 } },
      { label: '감으로 간다', chance: .5,
        success: { text: '의외로 맛있었다. 이름을 붙여주고 싶은 맛이었다.', effect: { craft: [2, 3], happy: 4 } },
        fail: { text: '아무도 두 번째 숟가락을 뜨지 않았다.', effect: { happy: -1 } } },
    ] },
  { id: 'homeNoise', type: 'random', on: ['home'], age: [21, 50], once: false, cooldown: 5, req: { flags: ['ownPlace'] }, text: '윗집에서 밤마다 쿵쿵 소리가 난다.',
    choices: [
      { label: '올라가서 말한다', chance: .6,
        success: { meet: s => ({ kind: 'friend', ageRange: [Math.max(19, s.age - 10), s.age + 15], hangout: null, close: 18 }), text: '윗집 {new|이} 몰랐다며 연신 사과했다. 다음 날 귤 한 봉지가 문 앞에 걸려 있었다.', effect: { happy: 2 } },
        fail: { text: '문이 열리자마자 언성이 높아졌다. 소리는 그대로였다.', effect: { happy: -4 } } },
      { label: '참는다', text: '이어폰을 끼고 잤다.', effect: { happy: -2 } },
    ] },

  // 놀이터
  { id: 'pgSwing', type: 'random', on: ['playground'], once: false, cooldown: 3, text: '그네 줄이 길다. 앞에 선 아이가 자꾸 새치기를 한다.',
    choices: [
      { label: '양보한다', text: '그냥 미끄럼틀로 갔다. 미끄럼틀도 재밌었다.', karma: 2 },
      { label: '따진다', check: { stat: 'charm', diff: 25 },
        success: { text: '줄이 다시 똑바로 섰다. 다들 나를 쳐다봤다.', effect: { charm: 1, happy: 2 } },
        fail: { text: '말싸움 끝에 울음이 터졌다. 엄마가 데리러 왔다.', effect: { happy: -2 } } },
    ] },
  { id: 'pgToy', type: 'random', on: ['playground'], text: '모래 속에서 누가 잃어버린 장난감 로봇을 찾았다.',
    choices: [
      { label: '주인을 찾아준다', karma: 3, meet: s => ({ kind: 'friend', ageRange: [Math.max(4, s.age - 1), s.age + 1], hangout: 'playground', close: 30 }),
        text: '로봇 주인 {new|이} 고맙다며 내일도 같이 놀자고 했다.', effect: { happy: 3 } },
      { label: '내가 갖는다', karma: -3, text: '로봇을 주머니에 넣었다. 집에 와서도 꺼내 보지 못했다.', effect: { happy: 1 } },
    ] },
  { id: 'pgScrape', type: 'random', on: ['playground', 'play'], once: false, cooldown: 3, text: '미끄럼틀에서 굴러 무릎이 까졌다. 울지 않으려고 입술을 꽉 깨물었다.', effect: { health: -2, fit: 1 } },

  // 공원
  { id: 'parkDog', type: 'random', on: ['park', 'walk'], once: false, cooldown: 3, text: '강아지 한 마리가 다가와 내 신발 냄새를 킁킁 맡았다.',
    choices: [
      { label: '쪼그려 앉아 쓰다듬는다', meet: s => ({ kind: 'friend', ageRange: s.age < 19 ? [25, 60] : peer(s), hangout: 'park', close: 18 }),
        text: '견주 {new|와} 강아지 얘기로 한참 서 있었다. 강아지가 내 손을 핥았다.', effect: { happy: 4 } },
      { label: '살짝 비켜선다', text: '강아지가 아쉬운 듯 꼬리를 흔들며 갔다.' },
    ] },
  { id: 'parkGuitar', type: 'random', on: ['park', 'walk'], age: [8, 50], season: ['봄', '가을'], once: false, cooldown: 4,
    text: '잔디밭에서 누가 기타를 치며 노래하고 있었다. 노래가 끝나자 다들 박수를 쳤다.', effect: { happy: 3, art: [0, 1] } },
  { id: 'parkShower', type: 'random', on: ['park'], age: [13, 50], once: false, cooldown: 3, when: s => ['rain', 'storm', 'cloudy'].includes(s.weather),
    text: '공원에 있는데 갑자기 소나기가 쏟아졌다.',
    choices: [
      { label: '정자로 뛰어간다', meet: meetHere(), do: focusNew, p: { heart: [2, 5] },
        text: '정자 아래서 비를 피하던 {new|와} 눈이 마주쳤다. 비가 그칠 때까지 이야기했다.' },
      { label: '그냥 맞는다', text: '흠뻑 젖었다. 이상하게 웃음이 났다.', effect: { happy: 3, health: -1 } },
    ] },
  { id: 'parkJanggi', type: 'random', on: ['park', 'walk'], age: [9, 50], once: false, cooldown: 5, text: '벤치에 앉은 할아버지가 장기 한 판 두자고 하셨다.',
    choices: [
      { label: '둔다', check: { stat: 'smart', diff: 45 },
        success: { text: '할아버지가 껄껄 웃으시며 다음에 또 오라고 하셨다.', effect: { smart: 2, happy: 3 } },
        fail: { text: '스무 수 만에 졌다. 훈수가 더 길었다.', effect: { smart: 1 } } },
      { label: '정중히 사양한다', text: '꾸벅 인사하고 지나갔다.' },
    ] },

  // 학교
  { id: 'schoolLunch', type: 'random', on: ['school'], once: false, cooldown: 2, when: (s, a) => hereWho(a, p => p.kind === 'classmate').length > 0,
    onStart: focusHere(p => p.kind === 'classmate'), text: '급식에 좋아하는 반찬이 나왔다. {fp|이} 자기 몫을 내 식판에 덜어줬다.', p: { close: [3, 5] }, effect: { happy: 2 } },
  { id: 'schoolQuiz', type: 'random', on: ['school', 'study'], age: [8, 18], once: false, cooldown: 2, text: '갑자기 쪽지 시험을 본다고 했다. 하나도 안 봤다.',
    choices: [
      { label: '아는 만큼 푼다', check: { stat: 'smart', diff: 40 },
        success: { text: '찍은 것까지 다 맞았다. 오늘은 운이 좋다.', effect: { happy: 3 } },
        fail: { text: '빈칸이 반이었다. 다음엔 꼭 복습하기로 했다.', effect: { happy: -2, smart: 1 } } },
      { label: '옆을 슬쩍 본다', karma: -3, chance: .6,
        success: { text: '들키지 않았다. 점수는 좋았는데 기분은 별로였다.', effect: { happy: 1 } },
        fail: { text: '선생님과 눈이 마주쳤다. 교무실에 불려갔다.', effect: { happy: -5, rel: { family: -2 } } } },
    ] },
  { id: 'schoolNew', type: 'random', on: ['school'], age: [8, 17], once: false, cooldown: 4,
    meet: s => ({ kind: 'classmate', ageRange: [s.age, s.age], hangout: null, close: 22 }), text: '전학생 {new|이} 내 옆자리에 앉았다. 교과서를 같이 봤다.' },

  // 학원
  { id: 'acadPraise', type: 'random', on: ['academy', 'cram'], once: false, cooldown: 4, text: '학원 선생님이 내 풀이를 보더니 "너 이거 소질 있다"고 했다.',
    do: (s, a) => a.subjAdd('math', 4), effect: { smart: 2, happy: 3 } },
  { id: 'acadSkip', type: 'random', on: ['academy'], age: [12, 18], once: false, cooldown: 3, text: '친구가 학원 빼먹고 코인노래방 가자고 한다.',
    choices: [
      { label: '따라간다', text: '목이 쉬도록 불렀다. 집에 오니 학원에서 전화가 와 있었다.', effect: { happy: 5, rel: { mom: -3 } } },
      { label: '수업 듣는다', text: '창밖으로 친구 뒷모습이 보였다.', effect: { smart: 1 } },
    ] },
  { id: 'acadBus', type: 'random', on: ['academy', 'cram'], age: [10, 18], once: false, cooldown: 4,
    meet: s => ({ kind: 'friend', ageRange: [s.age - 1, s.age + 1], hangout: 'academy', close: 24 }),
    text: '학원 끝나고 나오니 밤이 깊었다. 같은 반 {new|와} 같은 버스를 타고 졸면서 왔다.' },

  // 대학
  { id: 'campusTeam', type: 'random', on: ['campus', 'study'], req: { flags: ['student'] }, once: false, cooldown: 2, text: '조별 과제 팀원 한 명이 단톡방에서 사라졌다.',
    choices: [
      { label: '내가 다 한다', text: '밤을 새웠다. 발표 날 그 팀원이 나타나 자기 이름을 넣어달라고 했다.', effect: { smart: 2, happy: -4, health: -2 }, do: s => { s.school.studyYear++; } },
      { label: '교수님께 말한다', check: { stat: 'charm', diff: 60 },
        success: { text: '교수님이 기여도를 따로 받겠다고 했다. 속이 시원했다.', effect: { happy: 3 } },
        fail: { text: '"알아서들 해결하세요." 메일 한 줄이 돌아왔다.', effect: { happy: -2 } } },
    ] },
  { id: 'campusPen', type: 'random', on: ['campus'], age: [19, 30], once: false, cooldown: 3, meet: meetHere({ close: 18 }), do: focusNew, p: { heart: [1, 4] },
    text: '교양 수업 옆자리 {new|이} 펜을 빌려달라고 했다. 수업이 끝나고 펜과 함께 커피 쿠폰이 돌아왔다.' },
  { id: 'campusClub', type: 'random', on: ['campus'], req: { flags: ['student'] }, once: false, cooldown: 4, text: '동아리 홍보 부스 앞을 지나다 붙잡혔다.',
    choices: [
      { label: '가입한다', meet: meetHere({ close: 25 }), text: '동아리 방에서 {new|와} 금방 말을 텄다.', effect: { happy: 4, charm: [1, 2] } },
      { label: '도망간다', text: '전단지만 세 장 받아 들고 빠져나왔다.' },
    ] },

  // 직장
  { id: 'officeLunch', type: 'random', on: ['office'], once: false, cooldown: 2, when: (s, a) => hereWho(a, p => p.kind === 'coworker').length > 0,
    onStart: focusHere(p => p.kind === 'coworker'), text: '점심시간, {fp|이} 회사 근처에 새로 생긴 국숫집에 가자고 했다.', p: { close: [3, 6] }, effect: { happy: 2 } },
  { id: 'officeGossip', type: 'random', on: ['office'], once: false, cooldown: 4, req: { job: true }, text: '잠깐 쉬러 갔다가 사람들이 내 얘기를 하는 소리를 들었다.',
    choices: [
      { label: '모른 척한다', text: '물만 마시고 조용히 돌아왔다. 오후 내내 신경이 쓰였다.', effect: { happy: -3 } },
      { label: '태연하게 들어가 인사한다', check: { stat: 'charm', diff: 85 },
        success: { text: '분위기가 잠깐 얼어붙었다. 그 뒤로 뒷말이 사라졌다.', effect: { happy: 2, charm: 1 } },
        fail: { text: '더 어색해졌다. 다들 갑자기 바빠졌다.', effect: { happy: -4 } } },
    ] },
  { id: 'officeRookie', type: 'random', on: ['office', 'work'], age: [24, 50], once: false, cooldown: 4, req: { job: true }, text: '새로 온 막내가 첫날부터 실수를 하고 얼어붙어 있다.',
    choices: [
      { label: '수습을 도와준다', karma: 2, meet: s => ({ kind: 'coworker', ageRange: [Math.max(20, s.age - 12), Math.max(21, s.age - 3)], hangout: null, close: 28, trust: 30 }),
        text: '같이 수습했다. 막내 {new|이} 퇴근길에 음료수를 건넸다.', do: (s, a) => a.perf(3) },
      { label: '못 본 척한다', text: '내 일도 바빴다.' },
    ] },

  // 카페
  { id: 'cafeEyes', type: 'random', on: ['cafe', 'coffee'], age: [16, 49], once: false, cooldown: 3, text: '카페에서 낯선 사람과 눈이 마주쳤다. 둘 다 바로 피하지 않았다.',
    choices: [
      { label: '먼저 웃어 보인다', meet: meetHere({ close: 16 }), do: focusNew, p: { heart: [3, 7] },
        text: '{new|이} 따라 웃었다. 어쩌다 보니 합석까지 했다.' },
      { label: '시선을 피한다', text: '괜히 컵만 만지작거렸다.' },
    ] },
  { id: 'cafeSpill', type: 'random', on: ['cafe'], age: [13, 50], once: false, cooldown: 4,
    text: s => s.age < 19 ? '옆 사람이 일어나다 내 문제집에 음료를 쏟았다.' : '옆 사람이 일어나다 내 노트북에 커피를 쏟았다.',
    choices: [
      { label: '괜찮다고 한다', karma: 3, meet: meetHere({ close: 15 }), text: '{new|이} 연신 사과하더니 연락처를 줬다. 세탁비는 끝내 받지 않았다.' },
      { label: '화를 낸다', karma: -1, text: '상대가 고개를 숙였다. 화를 내고 나니 더 피곤해졌다.', effect: { happy: -2 } },
    ] },
  { id: 'cafeUsual', type: 'random', on: ['cafe', 'coffee'], once: false, cooldown: 3, when: (s, a) => a.regular('cafe'),
    text: '주문하기도 전에 사장님이 "늘 드시던 걸로요?" 하고 물었다.', effect: { happy: 3 } },

  // 도서관
  { id: 'libSameBook', type: 'random', on: ['library', 'read'], age: [12, 50], once: false, cooldown: 4, text: '빌리려던 책을 누가 한발 먼저 집어 들었다.',
    choices: [
      { label: '양보한다', meet: meetHere({ hobby: 'book', close: 18 }), text: '{new|이} 다 읽으면 빌려주겠다며 연락처를 적어줬다. 같은 책을 좋아하는 사람이었다.' },
      { label: '먼저 봤다고 한다', check: { stat: 'charm', diff: 50 },
        success: { text: '상대가 웃으며 책을 넘겨줬다.', effect: { happy: 2 } },
        fail: { text: '상대도 물러서지 않았다. 결국 사서가 반납 순서대로 하라고 했다.', effect: { happy: -2 } } },
    ] },
  { id: 'libNote', type: 'random', on: ['library', 'read'], age: [15, 45], text: '반납된 책 사이에 메모가 끼어 있었다. "이 문장에 밑줄 그은 사람, 누구예요?"',
    choices: [
      { label: '답장을 끼워둔다', set: 'libNote', text: '"저요." 한 줄을 적어 같은 자리에 끼워뒀다.', effect: { happy: 2, art: 1 } },
      { label: '그냥 꽂아둔다', text: '책을 제자리에 꽂았다. 문장은 오래 기억에 남았다.' },
    ] },
  { id: 'libNoteReply', type: 'random', on: ['library'], age: [15, 46], req: { flags: ['libNote'] }, weight: 3,
    text: '그 책에 또 메모가 끼어 있었다. "저도 이 문장 좋아해요. 다음 주 목요일, 3층 창가 자리."',
    choices: [
      { label: '나가본다', memory: true, meet: s => ({ kind: 'friend', hobby: 'book', ageRange: peer(s), hangout: 'library', close: 25, gender: s.age >= 19 && Math.random() < .8 ? (s.gender === 'm' ? 'f' : 'm') : undefined }),
        do: focusNew, p: { heart: [5, 10] }, text: '창가 자리에 그 책을 든 {new|이} 앉아 있었다. 처음 만났는데 할 말이 끝이 없었다.' },
      { label: '나가지 않는다', text: '목요일 내내 3층 쪽을 쳐다보지 않으려고 애썼다.' },
    ] },
  { id: 'libNap', type: 'random', on: ['library', 'study'], once: false, cooldown: 4, text: '열람실에서 깜빡 잠들었다. 깨어보니 폐관 10분 전이었다.', effect: { health: 1, happy: -1 } },

  // 헬스장
  { id: 'gymPT', type: 'random', on: ['gym'], age: [19, 50], once: false, cooldown: 4, text: 'PT 상담을 받았다. 20회에 150만원이라고 한다.',
    choices: [
      { label: '등록한다', if: s => s.money >= 150, text: '첫 수업 다음 날, 계단을 기어서 내려갔다. 그래도 몸이 달라지는 게 느껴졌다.', effect: { money: -150, fit: [6, 10], health: [3, 5], looks: [1, 3] } },
      { label: '혼자 해본다', text: '유튜브 영상을 보며 따라 했다.', effect: { fit: [1, 2] } },
    ] },
  { id: 'gymSpot', type: 'random', on: ['gym', 'exercise'], age: [16, 50], once: false, cooldown: 4, meet: meetHere({ hobby: 'sport', close: 18 }),
    text: '벤치프레스를 하다 바벨이 안 올라갔다. 옆에 있던 {new|이} 잡아줬다. "무리하지 마세요." 그 뒤로 인사하는 사이가 됐다.' },
  { id: 'gymMirror', type: 'random', on: ['gym', 'exercise'], age: [16, 50], when: s => s.stats.fit >= 100, text: '거울 속 내 몸이 달라졌다는 걸 처음으로 느꼈다.', memory: true, effect: { looks: [2, 4], happy: 4 } },

  // PC방
  { id: 'pcDuo', type: 'random', on: ['pcbang', 'game'], age: [12, 45], once: false, cooldown: 3, meet: meetHere({ hobby: 'game', close: 20 }),
    text: '옆자리 사람이 같은 게임을 하고 있었다. {new|와} 즉석에서 팀을 짜서 연승을 했다.', effect: { happy: 3 } },
  { id: 'pcAllNight', type: 'random', on: ['pcbang'], age: [14, 40], once: false, cooldown: 3, text: '한 판만 더 하다 보니 창밖이 밝아왔다.', effect: { health: -3, happy: 2 } },
  { id: 'pcRamen', type: 'random', on: ['pcbang'], once: false, cooldown: 3, when: (s, a) => a.regular('pcbang'), text: '사장님이 라면에 계란을 하나 더 풀어줬다. "단골이니까."', effect: { happy: 3 } },

  // 번화가
  { id: 'mallBusking', type: 'random', on: ['mall', 'shop'], age: [12, 50], once: false, cooldown: 4, text: '버스킹 마지막 곡이 끝나자 노래하던 사람이 내 쪽을 보고 웃었다.',
    choices: [
      { label: '기타 케이스에 돈을 넣는다', karma: 1, effect: s => ({ money: s.age >= 18 ? -1 : 0, happy: 2 }), meet: meetHere({ hobby: 'music', close: 16 }),
        text: '{new|이} 고맙다며 다음 공연 날짜를 알려줬다.' },
      { label: '박수만 치고 간다', text: '노래가 귀에 오래 남았다.', effect: { art: [0, 1] } },
    ] },
  { id: 'mallScout', type: 'random', on: ['mall', 'shop', 'style'], age: [15, 30], when: s => s.stats.looks >= 110, text: '길에서 누가 명함을 내밀었다. 모델 일을 해볼 생각이 없냐고 한다.',
    choices: [
      { label: '해본다', chance: .45,
        success: { text: '광고 사진 한 장에 내 얼굴이 실렸다. 버스 정류장에서 나를 마주쳤다.', memory: true, effect: { money: [100, 400], charm: [2, 4], happy: 6 } },
        fail: { text: '알고 보니 프로필 촬영비부터 내라는 곳이었다.', effect: { money: -50, happy: -4 } } },
      { label: '거절한다', text: '명함은 지갑 속에 오래 남아 있었다.' },
    ] },
  { id: 'mallLostKid', type: 'random', on: ['mall'], age: [13, 50], once: false, cooldown: 5, text: '울고 있는 아이를 발견했다. 엄마를 잃어버렸다고 한다.',
    choices: [
      { label: '안내데스크에 데려간다', karma: 5, text: '아이 엄마가 뛰어와 몇 번이고 고개를 숙였다.', effect: { happy: 3 } },
      { label: '못 본 척한다', karma: -3, text: '뒤에서 울음소리가 한참 들렸다.' },
    ] },
  { id: 'mallSale', type: 'random', on: ['mall', 'shop'], age: [13, 50], once: false, cooldown: 3, text: '마감 세일. 몇 주째 눈여겨보던 옷이 반값이었다.', effect: s => ({ money: s.age >= 18 ? -15 : -1, looks: [1, 2], happy: 3 }) },

  // 병원
  { id: 'hospOrange', type: 'random', on: ['hospital'], once: false, cooldown: 4, text: '대기실 옆자리 할머니가 귤 하나를 손에 쥐여주셨다. "젊은 사람이 아프면 쓰나."', effect: { happy: 3 } },
  { id: 'hospNurse', type: 'random', on: ['hospital', 'doctor'], once: false, cooldown: 3, when: (s, a) => a.regular('hospital'), text: '간호사 선생님이 차트를 보기도 전에 내 이름을 불렀다. "또 오셨네요."', effect: { happy: 1, health: 2 } },
  { id: 'hospResult', type: 'random', on: ['hospital', 'doctor'], age: [30, 50], once: false, cooldown: 6, text: '검사 결과를 설명하는 의사 선생님 표정이 묘했다. 정밀 검사를 받아보라고 한다.',
    choices: [
      { label: '정밀 검사를 받는다', chance: .7, effect: { money: -100 },
        success: { text: '별것 아니었다. 병원을 나서는데 다리에 힘이 풀렸다.', effect: { happy: 4 } },
        fail: { text: '초기에 발견해서 다행이라고 했다. 한동안 치료를 받았다.', memory: true, effect: { health: -8, money: -200, happy: -4 } } },
      { label: '괜찮겠지 하고 넘긴다', chance: .6,
        success: { text: '정말 괜찮았다. 운이 좋았다.' },
        fail: { text: '반년 뒤 다시 병원을 찾았다. 그때 받을걸 그랬다.', memory: true, effect: { health: -15, happy: -6 } } },
    ] },

  // 복지관
  { id: 'centerStory', type: 'random', on: ['center', 'volunteer'], text: '복지관 할아버지가 젊었을 때 이야기를 해주셨다. 전쟁, 첫사랑, 그리고 망한 국밥집.', memory: true, effect: { art: [1, 2], happy: 2 } },
  { id: 'centerTeacher', type: 'random', on: ['center', 'volunteer'], age: [14, 50], text: '공부방 아이 하나가 나를 "쌤"이라고 불렀다. 집에 오는 내내 그 소리가 귀에 남았다.', karma: 3, effect: { happy: 4 } },
  { id: 'centerPartner', type: 'random', on: ['center', 'volunteer'], once: false, cooldown: 4, meet: meetHere({ close: 24, trust: 25 }),
    text: '같이 봉사하는 {new|와} 손발이 척척 맞았다. 끝나고 같이 떡볶이를 먹었다.', effect: { happy: 2 } },

  // 터미널
  { id: 'stationWrong', type: 'random', on: ['station', 'travel'], text: '표를 잘못 끊었다. 반대 방향 버스였다.',
    choices: [
      { label: '그냥 가본다', text: '계획에 없던 바닷가 마을에 내렸다. 이번 여행에서 그게 제일 좋았다.', memory: true, effect: { happy: 6 } },
      { label: '다시 끊는다', text: '수수료를 내고 표를 바꿨다.', effect: { money: -2 } },
    ] },
  { id: 'stationGoodbye', type: 'random', on: ['station'], once: false, cooldown: 5, text: '대합실에서 누군가 오래 포옹하고 있었다. 괜히 내 쪽이 먹먹했다.', effect: { art: [0, 1] } },
  { id: 'stationSeat', type: 'random', on: ['station', 'travel'], once: false, cooldown: 4, meet: meetHere({ hobby: 'travel', close: 20 }),
    text: '{new|와} 같은 버스 옆자리였다. 내릴 때쯤엔 서로 맛집 목록을 주고받고 있었다.', effect: { happy: 2 } },

  // 술집
  { id: 'barUsual', type: 'random', on: ['bar', 'drink'], once: false, cooldown: 3, when: (s, a) => a.regular('bar'), text: '사장님이 내 잔을 기억하고 있었다. "늘 드시던 걸로?"', effect: { happy: 3 } },
  { id: 'barBirthday', type: 'random', on: ['bar'], once: false, cooldown: 4, text: '옆 테이블에서 생일 파티가 한창이었다. 얼떨결에 같이 생일 노래를 부르고 건배를 했다.',
    meet: s => ({ kind: 'friend', ageRange: [Math.max(19, s.age - 8), Math.min(60, s.age + 8)], hangout: 'bar', close: 18 }), effect: { happy: 3 } },
  { id: 'barBlackout', type: 'random', on: ['bar', 'drink'], once: false, cooldown: 3, text: '너무 마셨다. 다음 날 아침, 어젯밤 기억이 군데군데 비어 있었다.', effect: { health: -4, happy: -1 } },
  { id: 'barBrawl', type: 'random', on: ['bar'], once: false, cooldown: 4, text: '옆 테이블 취객이 괜히 시비를 걸어왔다.',
    choices: [
      { label: '자리를 피한다', text: '계산하고 나왔다. 밤공기가 찼다.' },
      { label: '맞받아친다', check: { stat: 'fit', diff: 90 },
        success: { text: '상대가 먼저 꼬리를 내렸다. 가게 안이 조용해졌다.', karma: -2, heat: 4, effect: { happy: 2 } },
        fail: { text: '코피가 터졌다. 경찰이 와서야 끝났다.', karma: -3, heat: 10, effect: { health: -8, happy: -4 } } },
    ] },

  // 종교시설
  { id: 'churchNoodle', type: 'random', on: ['church', 'pray'], once: false, cooldown: 3,
    meet: s => ({ kind: 'friend', ageRange: [Math.max(40, s.age + 20), Math.max(60, s.age + 40)], hangout: 'church', close: 22, trust: 25 }), text: '모임이 끝나고 국수를 나눠 먹었다. {new|이} 이것저것 물어보시더니 다음 주에도 오라고 하셨다.', effect: { happy: 2 } },
  { id: 'churchChoir', type: 'random', on: ['church'], age: [8, 50], text: '합창 연습에 들어와 보라는 권유를 받았다.',
    choices: [
      { label: '들어간다', meet: meetHere({ hobby: 'music', close: 22 }), text: '{new|이} 옆자리에서 음을 잡아줬다. 생각보다 목소리가 잘 맞았다.', effect: { art: [2, 4], happy: 3 } },
      { label: '사양한다', text: '맨 뒷자리에서 듣기만 했다. 그것도 좋았다.' },
    ] },
  { id: 'churchConfess', type: 'random', on: ['church', 'pray'], once: false, cooldown: 4, when: s => s.karma <= -20, text: '조용히 앉아 있는데, 그동안 모른 척한 일들이 하나씩 떠올랐다.',
    choices: [
      { label: '마음속으로 사과한다', karma: 8, text: '용서받을 수 있을지는 몰라도, 조금은 가벼워졌다.', effect: { happy: 2 } },
      { label: '털고 일어난다', text: '문을 나서자 다시 아무렇지 않은 척했다.' },
    ] },

  // 편의점
  { id: 'cvsNeighbor', type: 'random', on: ['conveni', 'snack'], age: [19, 50], once: false, cooldown: 3, when: s => !!s.placeNight,
    meet: s => ({ kind: 'friend', ageRange: [Math.max(19, s.age - 8), s.age + 12], hangout: 'conveni', close: 18 }),
    text: '새벽 편의점에서 같은 동네 {new|와} 마주쳤다. 둘 다 슬리퍼 차림이었다. 컵라면을 사이에 두고 웃음이 터졌다.' },
  { id: 'cvsUmbrella', type: 'random', on: ['conveni'], age: [13, 50], once: false, cooldown: 4, when: s => ['rain', 'storm'].includes(s.weather),
    text: '비가 쏟아져서 편의점 처마 밑에 갇혔다. 옆에 선 사람이 우산을 같이 쓰자고 했다.',
    choices: [
      { label: '같이 쓴다', meet: meetHere({ close: 16 }), do: focusNew, p: { heart: [2, 5] }, text: '{new|와} 우산 하나를 나눠 쓰고 걸었다. 한쪽 어깨가 다 젖었다.' },
      { label: '그칠 때까지 기다린다', text: '빗소리를 들으며 삼각김밥을 먹었다.' },
    ] },
  { id: 'cvsAllowance', type: 'random', on: ['conveni', 'snack'], age: [6, 12], once: false, cooldown: 3, text: '용돈으로 뭘 살지 30분째 고민했다. 결국 제일 처음 집었던 걸 샀다.', effect: { happy: 2 } },
  { id: 'cvsStaff', type: 'random', on: ['conveni'], once: false, cooldown: 3, when: (s, a) => a.regular('conveni'), text: '알바생이 내가 늘 사는 걸 먼저 계산대에 올려놨다.', effect: { happy: 2 } },

  // 공연장
  { id: 'concertFan', type: 'random', on: ['concert', 'watch'], once: false, cooldown: 3, meet: meetHere({ hobby: 'music', close: 22 }),
    text: '옆자리 {new|이} 내가 제일 좋아하는 노래를 한 소절도 안 틀리고 따라 불렀다. 공연이 끝나고 같이 역까지 걸었다.', effect: { happy: 3 } },
  { id: 'concertWave', type: 'random', on: ['concert', 'watch'], text: '앵콜 곡에서 무대 위 가수가 내 쪽을 보고 손을 흔들었다. 분명히 나였다.', memory: true, effect: { happy: 6 } },

  // 단골 장소
  { id: 'regularSeat', type: 'random', on: NOT_ROUTINE, age: [13, 50], once: false, cooldown: 3, weight: 1.5, when: s => !!s.regular[s.place],
    text: '{place}에 올 때마다 늘 같은 자리에 있는 사람이 있다.',
    choices: [
      { label: '말을 걸어본다', meet: meetHere({ close: 24 }), text: '{new|와} 인사를 나눴다. 알고 보니 서로 얼굴은 진작부터 알고 있었다.' },
      { label: '오늘도 그냥 지나친다', text: '오늘도 고개만 살짝 숙였다.' },
    ] },
  { id: 'regularMissed', type: 'random', on: NOT_ROUTINE, age: [10, 50], once: false, cooldown: 4, when: s => !!s.regular[s.place],
    text: '"요즘 왜 안 왔어요?" {place}에서 누가 먼저 안부를 물었다. 별것 아닌데 기분이 좋았다.', effect: { happy: 3 } },

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
