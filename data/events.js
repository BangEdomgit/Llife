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
// 친밀한 관계: 사귀는 사이 / 사귀지 않고 밤을 보낸 사이 / 다음 날 아침 한 줄(상대 성격마다, data/social.js)
const lover = p => p.partner || p.spouse || p.secret;
const nightLine = (a, set) => { const p = a.focused(), L = p && GAME_DATA.nightLines[set][p.personality]; return (L ? a.pick(L) : GAME_DATA.nightLines[set]._).replace(/\{p([|}])/g, '{fp$1'); };
const firstNight = (s, a) => (a.focused() || {}).nights === 1;
// 아이를 같이 키우기로 함: 다른 애인과는 끝내고 이 사람과 사귐 (marry면 결혼까지)
function raiseTogether(s, a, marry) {
  const p = a.focused();
  if (!p || !s.preg) return;
  const m = a.main();
  s.vars.leftName = m && m !== p ? a.josa(m.name || m.role, '와는') : '';
  if (m && m !== p) a.endMain(40);
  p.secret = false;
  if (!p.partner && !p.spouse) a.startRelation(p, false);
  if (marry && !p.spouse) a.marry(p);
  s.preg.mode = marry || p.spouse ? 'married' : 'together';
}
const leftLine = s => s.vars.leftName ? ` ${s.vars.leftName} 끝났다.` : '';
// 관계·가족: 연인(배우자) 조건, 초점 맞추기, 상대 성격마다 다른 문장, 나이대별 아이
const mainIs = fn => (s, a) => { const m = a.main(); return !!m && fn(m, s, a); };
const focusMain = (s, a) => a.focus(a.main());
const byPers = (map, fallback) => (s, a) => map[(a.focused() || {}).personality] || fallback;
const kidsAged = (a, lo, hi) => a.find(p => p.kind === 'child' && a.npcAge(p) >= lo && a.npcAge(p) <= hi);
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
  // 수학여행 (고2 가을)
  { id: 'schoolTrip', type: 'must', at: 17, season: ['가을'], text: '수학여행! 버스 안이 시끄럽다.', memory: true,
    choices: [
      { label: '짝꿍이랑 얘기한다', do: (s, a) => { const f = a.find(p => p.kind === 'classmate').sort((x, y) => y.close - x.close)[0]; if (f) a.changeP(f, { close: [5, 10] }); }, effect: { happy: 4 }, text: '창밖 풍경보다 짝꿍 이야기가 더 재밌었다. 밤새 떠드느라 한숨도 못 잤다.' },
      { label: '자리에서 잔다', effect: { health: 3 }, text: '눈을 떠 보니 숙소 앞이었다.' },
      { label: '뒤에서 몰래 과자 파티', effect: { happy: 5 }, karma: -1, text: '선생님한테 걸려서 다 같이 반성문을 썼다. 그래도 웃겼다.' },
    ] },
  // 고1 봄: 계열·선택 과목 (SCHOOL.md) / 고2 봄: 확정하거나 한 번 바꾸기
  { id: 'trackChoice', type: 'must', at: 16, season: ['봄'], text: '과목 선택의 시간이 왔다. 어떤 길을 갈까?',
    choices: GAME_DATA.tracks.map(t => ({ label: t.label, do: (s, a) => a.chooseTrack(t.id), text: t.text })) },
  { id: 'trackConfirm', type: 'must', at: 17, season: ['봄'], text: s => `문·이과를 확정할 때다. 지금은 ${(GAME_DATA.tracks.find(t => t.id === s.school.track) || {}).label || '아직 미정'}.`,
    choices: [{ label: '이대로 간다', text: '마음을 굳혔다.' }].concat(GAME_DATA.tracks.map(t => ({ label: `${t.label}(으)로 바꾼다`, if: s => s.school.track !== t.id, do: (s, a) => a.chooseTrack(t.id), text: `${t.label}(으)로 바꿨다. 새 교과서가 낯설었다.`, effect: { happy: -1 } }))) },
  // 고1 동아리 — 자유 턴의 '동아리' 행동이 이쪽으로 (비교과)
  { id: 'clubJoin', type: 'must', at: 16, season: ['여름'], text: '동아리 가입 신청서를 받았다.',
    choices: [
      { label: '밴드부', do: s => { s.school.club = 'music'; }, text: '드럼 스틱을 처음 잡았다.', effect: { art: 1 } },
      { label: '농구부', do: s => { s.school.club = 'sport'; }, text: '키 큰 선배들 사이에서 공을 튀겼다.', effect: { fit: 1 } },
      { label: '코딩 동아리', do: s => { s.school.club = 'game'; }, text: '첫날부터 게임을 만들자는 얘기가 나왔다.', effect: { smart: 1 } },
      { label: '문예부', do: s => { s.school.club = 'book'; }, text: '동아리방 책장이 마음에 들었다.', effect: { art: 1 } },
      { label: '봉사 동아리', do: s => { s.school.club = 'volunteer'; }, text: '첫 활동은 동네 공부방이었다.', karma: 2 },
      { label: '안 든다', text: '방과 후엔 집에 가는 게 좋았다.' },
    ] },
  // 수능 전날 → 수능 (고3 학교 턴 csat)
  // 외박한 다음 날 어제 옷 그대로 (HAIR_CLOTHES_BODY 3-7)
  { id: 'sameClothes', type: 'trigger', text: s => s.vars.dutyKind === 'work' ? '"어? 어제 그 옷 아니에요?" 옆자리 동료가 의미심장하게 웃었다.' : '"너 어제랑 옷 똑같은데?" 동기가 눈썹을 치켜올렸다.',
    choices: [
      { label: '"집에 못 들어갔어." 웃어넘긴다', effect: { happy: 1, charm: [0, 1] }, text: '"오~" 소리가 몇 번 오갔다. 점심시간 내내 그 얘기였다.' },
      { label: '"똑같은 옷이 두 벌이야." 둘러댄다', effect: { happy: -1 }, text: '아무도 안 믿는 눈치였다.' },
      { label: '못 들은 척한다', effect: { happy: -1, style: -2 }, text: '하루 종일 괜히 옷깃만 만지작거렸다.' },
    ] },
  { id: 'csatEve', type: 'trigger', text: s => s.age >= 19 ? '두 번째 수능 전날. 작년 이맘때가 떠오른다.' : '수능 전날. 내일이다.',
    choices: [
      { label: '마지막으로 정리한다', do: (s, a) => { s.vars.csatCond = a.rand(-3, 6); a.takeCSAT(); }, text: '오답 노트를 한 번 더 넘겼다. 새벽 한 시에 불을 껐다.' },
      { label: '일찍 잔다', do: (s, a) => { s.vars.csatCond = a.rand(3, 8); a.takeCSAT(); }, text: '아홉 시에 누웠다. 생각보다 잠이 잘 왔다.' },
      { label: '친구들과 서로 응원한다', effect: { happy: 3 }, do: (s, a) => { s.vars.csatCond = a.rand(0, 5); a.takeCSAT(); }, text: '"잘 보자!" 서로 찹쌀떡을 나눠 먹었다.' },
    ] },
  // 합격한 곳 고르기 (수시 또는 정시)
  { id: 'pickUniv', type: 'trigger', text: '합격한 곳 중에서 골라야 한다.',
    choices: [0, 1, 2, 3, 4, 5].map(i => ({
      label: (s, a) => { const o = s.school.offers[i]; return `${a.univ(o.u).name} ${a.dept(o.d).name}`; },
      if: s => !!(s.school.offers && s.school.offers[i]),
      do: (s, a) => { const o = s.school.offers[i]; a.admit(o.u, o.d); }, memory: true,
      text: (s, a) => `${a.univ(s.school.univ).name} ${a.dept(s.school.dept).name}에 가기로 했다.`, effect: { happy: 10 },
    })).concat([{ label: '전부 포기하고 재수한다', if: s => s.age === 18, set: 'retake', do: s => { s.school.offers = null; }, text: '더 높은 곳을 보기로 했다. 1년만 더.', effect: { happy: -4 } }]) },
  // 어디에도 붙지 못했을 때 (SCHOOL.md 재수 선택)
  { id: 'retakeChoice', type: 'trigger', text: '어디에도 붙지 못했다. 어떻게 할까?', memory: true,
    choices: [
      { label: '재수한다', if: s => s.age === 18, set: 'retake', text: '1년을 더 투자하기로 했다. 길고 외로운 시간이 시작됐다.', effect: { happy: -6 } },
      { label: '취업한다', set: 'noCollege', unset: 'retake', text: '학교가 전부는 아니다. 내 길을 가기로 했다.', effect: { happy: 1 } },
      { label: '전문대라도 간다', do: (s, a) => { const u = a.univ('COL1'); a.admit('COL1', a.pick(u.departments)); }, text: '갈 수 있는 곳에 갔다. 여기서 다시 시작이다.' },
    ] },
  { id: 'dreamSpeech', type: 'must', at: 10, text: '장래희망 발표 시간. "{dreamSpeech}"', memory: true },
  { id: 'enlist', type: 'must', age: [20, 21], season: ['봄'], req: { gender: 'm', noFlags: ['inJail', 'exempt'] }, when: s => s.age === (s.vars.enlistAt || 20),   // 20세 시작에선 내년으로 미루거나 면제
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
  // 만성 피로 (새벽까지 깨는 날이 쌓이면, js/game.js endDay에서 한 달에 한 번까지)
  { id: 'burnedOut', type: 'trigger', once: false,
    text: '요즘 너무 무리하고 있다. 아침에 눈을 떠도 개운하지가 않다.',
    choices: [
      { label: '하루 푹 쉰다', effect: { health: [3, 5], happy: [2, 4] }, do: s => { s.fatigue = 0; s.wake = 4; }, text: '알람을 끄고 점심때까지 잤다. 몸이 조금 가벼워졌다.' },
      { label: '커피로 버틴다', effect: { health: -2 }, do: s => { s.fatigue = Math.max(0, s.fatigue - 1); }, text: '세 번째 커피를 마셨다. 손이 조금 떨렸다.' },
    ] },

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
  { id: 'puberty', type: 'fixed', age: [13, 14], text: '거울 보는 시간이 부쩍 늘었다.', effect: { style: [3, 6], happy: -2 } },
  // 짝사랑 (중학생, 아직 없으면) — 감정만. 고등학교 고백 이벤트로 이어짐
  { id: 'crushMs', type: 'fixed', age: [14, 15], when: (s, a) => !a.find(p => p.crush).length,
    onStart: (s, a) => { const p = a.meet({ kind: 'classmate', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [s.age, s.age], close: 20, trust: 15 }); p.crush = true; },
    text: '{new|이} 지나갈 때마다 괜히 머리를 매만지게 된다.', effect: { happy: 2, style: 1 } },
  /* ═════ 고등학교 (SCHOOL.md) ═════ */
  { id: 'sportsFest', type: 'fixed', age: [16, 18], season: ['봄'], once: false, cooldown: 1, text: '체육대회 날이다!',
    choices: [
      { label: '전력 질주', check: { stat: 'fit', diff: 60, dice: true },
        success: { text: '1등! 반 아이들이 환호했다.', effect: { happy: 5, fit: 2 }, memory: true }, fail: { text: '넘어졌다... 무릎이 까졌다.', effect: { happy: -2, health: -3 } } },
      { label: '적당히 한다', text: '무난하게 끝냈다.', effect: { happy: 1 } },
    ] },
  { id: 'festival', type: 'fixed', age: [16, 18], season: ['겨울'], once: false, cooldown: 1, text: '학교 축제. 반에서 무엇을 할까?',
    choices: [
      { label: '무대 공연', check: { stat: 'charm', diff: 50, dice: true },
        success: { text: '환호 속에 무대가 끝났다. 잊을 수 없는 순간이다.', effect: { happy: 8, charm: 3 }, memory: true, extra: 1 }, fail: { text: '삐끗했다. 하지만 나름 즐거웠다.', effect: { happy: 2 } } },
      { label: '포장마차 운영', effect: { happy: 4, money: [5, 20], craft: 1 }, extra: .5, text: '떡볶이가 동났다. 반 회비가 두둑해졌다.' },
      { label: '돌아다니기', effect: { happy: 3 }, text: '다른 반 귀신의 집에서 소리를 질렀다.' },
    ] },
  // 고백 (짝사랑) — 고등학생은 사귀는 데까지 (손잡기까지만). 19살이 되면 이어지거나 흐지부지
  { id: 'confess', type: 'random', age: [16, 18], once: true, weight: 2,
    when: (s, a) => a.find(p => p.crush && !p.teenLove).length > 0,
    onStart: (s, a) => a.focus(a.pick(a.find(p => p.crush && !p.teenLove))),
    text: '더 이상 참을 수 없다. {fp}에게 고백할까?',
    choices: [
      { label: '고백한다', check: { stat: 'charm', diff: 55, dice: true },
        success: { text: '{fp|이} "나도..." 라고 했다. 세상이 달라 보였다.', p: { close: [15, 20], trust: [8, 12] }, effect: { happy: 10 }, memory: true, do: (s, a) => { a.focused().teenLove = true; } },
        fail: { text: '{fp|이} 미안하다고 했다. 가슴이 아팠다.', effect: { happy: -8 }, memory: true, do: (s, a) => { a.focused().crush = false; } } },
      { label: '아직은 아니다', text: '오늘도 마음을 삼켰다.' },
    ] },
  { id: 'teenDate', type: 'fixed', age: [16, 18], once: false, cooldown: 1, when: (s, a) => a.find(p => p.teenLove).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.teenLove)[0]),
    text: '{fp|와} 학교 끝나고 떡볶이를 먹으러 갔다.',
    choices: [
      { label: '손을 잡는다', p: { close: [4, 8] }, effect: { happy: 5 }, text: '손바닥에 땀이 났다. {fp|도} 놓지 않았다.', memory: true },
      { label: '시험 얘기만 한다', p: { close: [1, 3] }, text: '둘 다 수학이 제일 싫다는 걸 알게 됐다.' },
    ] },
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
  { id: 'moveOut', type: 'fixed', age: [21, 30], req: { noFlags: ['married', 'ownPlace'] }, text: '처음으로 자취방을 구했다. 좁지만 온전히 내 공간이다.', memory: true, set: 'ownPlace', effect: { happy: 5, money: -300 } },
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
  { id: 'baby', type: 'fixed', age: [27, 45], once: false, weight: 2, req: { flags: ['intimate'] },
    when: (s, a) => { const m = a.main(); return m && m.spouse && !s.preg && a.find(p => p.kind === 'child').length < 2; },
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
        success: { set: 'stocks', text: '생각보다 수익이 꽤 났다.', effect: { money: [300, 1500], happy: 4 } },
        fail: { set: 'stocks', text: '계좌가 반토막이 났다. 앱을 지웠다.', effect: { money: [-1000, -300], happy: -5 } } },
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
  { id: 'reunion', type: 'fixed', age: [40, 48], past: true,   // past: 지나온 어린 시절을 떠올리는 이벤트 — 20세 시작이면 안 나옴
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
  { id: 'travelSunset', type: 'random', on: ['travel'], once: false, cooldown: 3, text: '여행지에서 길을 잃었다가 우연히 엄청난 노을을 봤다.', memory: true, effect: { happy: 5 } },
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
      { label: '등록한다', if: s => s.money >= 150, text: '첫 수업 다음 날, 계단을 기어서 내려갔다. 그래도 몸이 달라지는 게 느껴졌다.', effect: { money: -150, fit: [6, 10], health: [3, 5] } },
      { label: '혼자 해본다', text: '유튜브 영상을 보며 따라 했다.', effect: { fit: [1, 2] } },
    ] },
  { id: 'gymSpot', type: 'random', on: ['gym', 'exercise'], age: [16, 50], once: false, cooldown: 4, meet: meetHere({ hobby: 'sport', close: 18 }),
    text: '벤치프레스를 하다 바벨이 안 올라갔다. 옆에 있던 {new|이} 잡아줬다. "무리하지 마세요." 그 뒤로 인사하는 사이가 됐다.' },
  { id: 'gymMirror', type: 'random', on: ['gym', 'exercise'], age: [16, 50], when: s => s.stats.fit >= 100, text: '거울 속 내 몸이 달라졌다는 걸 처음으로 느꼈다.', memory: true, effect: { charm: [1, 3], happy: 4 } },

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
  { id: 'mallScout', type: 'random', on: ['mall', 'shop', 'style'], age: [15, 30], when: s => s.stats.face >= 120 && s.stats.style >= 50, text: '길에서 누가 명함을 내밀었다. 모델 일을 해볼 생각이 없냐고 한다.',
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
  { id: 'mallSale', type: 'random', on: ['mall', 'shop'], age: [13, 50], once: false, cooldown: 3, text: '마감 세일. 몇 주째 눈여겨보던 옷이 반값이었다.', effect: s => ({ money: s.age >= 18 ? -15 : -1, style: [4, 8], happy: 3 }) },

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

  /* ═════ 외모 (생김새·몸·꾸밈) ═════ */
  { id: 'faceAttract', type: 'random', on: NOT_ROUTINE, age: [19, 49], once: false, cooldown: 2, when: (s, a) => s.stats.face >= a.gradeMin('B'),
    meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [Math.max(19, s.age - 6), Math.min(49, s.age + 6)], hangout: s.place, close: 30, heart: 15 }),
    text: '처음 보는 {new|이} 먼저 말을 걸어왔다. 웃는 얼굴이 낯설지 않은 것 같다고 했다.' },
  { id: 'faceNumber', type: 'random', on: ['cafe', 'coffee'], age: [19, 49], once: false, cooldown: 3, when: (s, a) => s.stats.face >= a.gradeMin('A'),
    meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [Math.max(19, s.age - 5), Math.min(49, s.age + 5)], hangout: 'cafe', close: 35, heart: 25 }),
    text: '카페에서 {new|이} 쪽지를 밀어왔다. 번호가 적혀 있다.' },
  { id: 'faceSelfConscious', type: 'fixed', age: [14, 25], once: false, cooldown: 4, when: (s, a) => s.stats.face < a.gradeMin('D'),
    text: '거울을 보다가 한숨이 나왔다.',
    choices: [
      { label: '운동이라도 하자', text: '줄넘기를 샀다. 일단 몸부터 바꿔보기로 했다.', effect: { fit: [3, 5], happy: 2 } },
      { label: '옷이라도 신경 쓰자', text: '옷장을 뒤집어엎었다. 어울리는 색을 찾았다.', effect: { style: [5, 10], happy: 1 } },
      { label: '신경 안 쓰기로 했다', text: '거울을 뒤집어 놓았다. 그래도 가끔 생각났다.', effect: { happy: -2 } },
    ] },
  // 견적은 상담 때마다 1000~3000만원 (100만원 단위)
  { id: 'surgery', type: 'fixed', age: [20, 45], once: false, cooldown: 5,
    when: (s, a) => s.stats.face < a.gradeMin('B') && s.money >= GAME_DATA.surgeryCost[0] && !s.flags.unnatural,
    onStart: (s, a) => { const [lo, hi] = GAME_DATA.surgeryCost; s.vars.quote = Math.min(Math.floor(s.money / 100) * 100, a.rand(lo / 100, hi / 100) * 100); },
    text: s => `성형외과 앞을 지나갔다. 상담만 받아볼까. 견적은 ${s.vars.quote}만원.`,
    choices: [
      { label: s => `한다 (${s.vars.quote}만원)`, chance: .8,
        success: { text: '붓기가 빠지자 거울 속 얼굴이 달라져 있었다.', memory: true, effect: s => ({ money: -s.vars.quote, happy: 8 }), do: (s, a) => a.faceStep(1) },
        fail: { text: '수술이 잘 안 됐다. 어딘가 부자연스럽다.', memory: true, set: 'unnatural', effect: s => ({ money: -s.vars.quote, health: -10, happy: -8 }), do: (s, a) => a.faceStep(-1) } },
      { label: '이대로가 나다', text: '상담 실장의 명함을 가방 깊숙이 넣었다.' },
    ] },

  /* ═════ 친밀한 관계 (둘 다 19살 이상, 이성, 가족 아님) — 행위는 한 줄로 넘기고 그 전후에 무게 ═════ */
  // 연인의 빈 집
  { id: 'emptyHouse', type: 'fixed', age: [20, 49], once: false, cooldown: 2,
    when: (s, a) => { const m = a.main(); return m && m.partner && m.heart >= 55 && a.canSex(m); },
    onStart: (s, a) => a.focus(a.main()),
    text: '{fp}의 가족이 여행을 갔다. 빈 집에 둘만 있다.',
    choices: [
      { label: '가까이 앉는다', text: '영화를 틀었지만 20분을 못 넘겼다. 소파 위에 이불이 흘러내렸다.', intimate: true, mood: 15, pregnant: .08,
        p: { heart: [8, 14], close: [4, 8] }, effect: { happy: [4, 6] }, memory: firstNight },
      { label: '일찍 들어간다', text: '아쉬운 표정을 뒤로하고 나왔다.' },
    ] },
  // 여행지에서
  { id: 'travelIntimate', type: 'random', on: ['travel'], age: [20, 49], once: false, cooldown: 4,
    when: (s, a) => { const m = a.main(); return m && m.heart >= 60 && a.canSex(m); },
    onStart: (s, a) => a.focus(a.main()),
    text: '여행지 숙소에서 {fp|와} 단둘이. 파도 소리 말고는 아무것도 들리지 않았다.',
    intimate: true, away: true, mood: 25, pregnant: (s, a) => a.focused().spouse ? .12 : .06,
    p: { heart: [6, 12], close: [5, 8] }, effect: { happy: [5, 8] }, memory: true },
  // 술자리 뒤
  { id: 'drunkNight', type: 'random', on: ['bar', 'drink'], age: [20, 49], once: false, cooldown: 3,
    when: (s, a) => s.drunk >= 2 && hereWho(a, p => a.canSex(p) && p.heart >= 45 && !p.partner && !p.spouse).length > 0,
    onStart: (s, a) => a.focus(a.pick(hereWho(a, p => a.canSex(p) && p.heart >= 45 && !p.partner && !p.spouse))),
    text: '술집을 나서는데 {fp|이} 택시를 같이 타자고 했다.',
    choices: [
      { label: '같이 탄다', text: (s, a) => '택시 뒷좌석에서 {fp}의 머리가 내 어깨에 기댔다. 아무도 안 내렸다. ' + nightLine(a, 'fling'),
        intimate: true, fling: true, pregnant: .05, memory: firstNight,
        p: { heart: [10, 16], close: [4, 6] }, effect: { happy: [3, 6] }, risk: .2, riskTaken: .15 },
      { label: '각자 간다', text: '손을 흔들고 돌아섰다. 조금 아쉬웠다.' },
    ] },
  // 몰래 만나는 사이
  { id: 'secretMeet', type: 'fixed', age: [20, 49], once: false, cooldown: 2,
    when: (s, a) => a.find(p => p.secret && p.heart >= 40 && a.canSex(p)).length > 0,
    onStart: (s, a) => a.focus(a.pick(a.find(p => p.secret && p.heart >= 40 && a.canSex(p)))),
    text: '{fp|이} 아무도 우리를 모르는 동네에서 보자고 했다.',
    choices: [
      { label: '간다', text: (s, a) => '낯선 동네의 작은 숙소였다. ' + nightLine(a, 'lover') + ' 돌아오는 길은 유난히 길었다.',
        intimate: true, mood: 10, pregnant: .06, risk: .25,
        p: { heart: [6, 10], close: [3, 6] }, effect: { happy: 3, money: -10 } },
      { label: '오늘은 못 간다', p: { heart: -5 }, text: '답장이 한참 뒤에 왔다. "응."' },
    ] },
  // 사귀지 않고 밤을 보낸 뒤
  { id: 'flingTalk', type: 'fixed', age: [19, 49], once: false, cooldown: 2, weight: 2,
    when: (s, a) => a.find(p => p.fling && !p.fwb && !lover(p)).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.fling && !p.fwb && !lover(p))[0]),
    text: '{fp|이} 그날 밤 이야기를 꺼냈다. "우리, 이대로 괜찮아?"',
    choices: [
      { label: '사귀자고 한다', memory: true, effect: { happy: [4, 8] }, do: (s, a) => a.startRelation(a.focused(), !!a.main()),
        text: (s, a) => a.focused().secret ? '{fp|와} 몰래 만나기 시작했다. 아무도 몰라야 한다.' : '{fp|와} 정식으로 사귀기로 했다.' },
      { label: '없던 일로 하자고 한다', do: (s, a) => { a.focused().fling = false; },
        p: { heart: [-20, -12], close: [-6, -3], grudge: [3, 8] },
        text: (s, a) => ({ sensitive: '{fp|은} 아무렇지 않은 척했지만 목소리가 떨렸다.', cool: '{fp|은} "그래, 그게 낫겠다."라고 짧게 답했다.',
          bold: '{fp|이} "알았어. 근데 난 진심이었어."라고 했다.', playful: '{fp|이} 웃으며 넘겼다. 눈은 웃고 있지 않았다.' })[a.focused().personality] || '{fp|이} 고개를 끄덕였다. 그 뒤로 조금 어색해졌다.' },
      { label: '편하게 만나자고 한다', if: (s, a) => a.focused().heart <= 60, do: (s, a) => { a.focused().fwb = true; },
        p: { heart: [-6, -2] }, text: '{fp|이} 잠깐 생각하더니 고개를 끄덕였다. "그래, 편하게."' },
      { label: '대답을 미룬다', p: { heart: -4, trust: -3 }, text: '{fp|은} 더 묻지 않았다.' },
    ] },
  { id: 'flingAwkward', type: 'random', on: NOT_ROUTINE.concat(['office', 'campus']), age: [19, 50], once: false, cooldown: 2,
    when: (s, a) => hereWho(a, p => p.fling && !lover(p)).length > 0,
    onStart: focusHere(p => p.fling && !lover(p)), text: '{fp|와} 마주쳤다. 그날 이후 처음이었다.',
    choices: [
      { label: '먼저 인사한다', p: { close: [2, 4], heart: [1, 3] }, text: '"잘 지냈어?" 둘 다 같은 말을 동시에 했다.' },
      { label: '못 본 척한다', p: { close: -4, grudge: 3 }, text: '{fp}의 시선이 등 뒤에 오래 머물렀다.' },
    ] },
  // 임신
  { id: 'unexpectedPreg', type: 'trigger',
    text: s => s.gender === 'm' ? '{fp|이} 할 말이 있다며 만나자고 했다. 임신이라고 했다.' : '임신 테스트기에 두 줄이 떴다. {fp}의 아이다.',
    choices: [
      { label: '결혼하자', if: (s, a) => s.gender === 'm' && s.age >= 20 && !(a.main() && a.main().spouse && a.main() !== a.focused()),
        do: (s, a) => raiseTogether(s, a, true), memory: true, effect: { happy: 5, money: -500 },
        text: s => '서둘러 혼인신고를 했다. 배가 불러오기 전에 작은 식을 올렸다.' + leftLine(s) },
      { label: '같이 키우자', if: s => s.gender === 'm', do: (s, a) => raiseTogether(s, a, false), memory: true, effect: { happy: 4 },
        text: s => '{fp|와} 함께 키우기로 했다. 인생이 한순간에 바뀌었다.' + leftLine(s) },
      { label: '책임은 지겠다', if: s => s.gender === 'm', do: s => { s.preg.mode = 'apart'; }, memory: true, effect: { happy: -2 },
        text: '같이 살지는 않지만, 아이에 대한 책임은 지기로 했다.' },
      { label: '못 본 척한다', if: s => s.gender === 'm', karma: -30, p: { grudge: 50, trust: -40, heart: -30 }, effect: { happy: -8 },
        do: (s, a) => { s.vars.hiddenName = a.focused().name; s.flags.hiddenChild = true; s.preg = null; },
        text: '전화를 받지 않았다. 오래 찜찜했다.' },
      { label: '{fp}에게 말한다', if: s => s.gender === 'f', chance: (s, a) => { const p = a.focused(); return Math.min(.9, (p.heart + p.trust) / 150 + (p.personality === 'warm' || p.personality === 'bold' ? .15 : 0)); },
        success: { do: (s, a) => raiseTogether(s, a, false), memory: true, effect: { happy: 4 },
          text: s => '{fp|이} 한참 말이 없더니 내 손을 잡았다. "같이 키우자."' + leftLine(s) },
        fail: { do: s => { s.preg.mode = 'alone'; }, p: { heart: -20, trust: -25, grudge: 20 }, memory: true, effect: { happy: -6 },
          text: '{fp|은} 그 뒤로 연락을 피했다. 혼자 낳기로 마음먹었다.' } },
      { label: '결혼하자고 한다', if: (s, a) => s.gender === 'f' && s.age >= 20 && !(a.main() && a.main().spouse && a.main() !== a.focused()),
        chance: (s, a) => { const p = a.focused(); return Math.min(.85, (p.heart + p.trust) / 170); },
        success: { do: (s, a) => raiseTogether(s, a, true), memory: true, effect: { happy: 6, money: -500 },
          text: s => '{fp|이} 고개를 끄덕였다. 배가 불러오기 전에 작은 식을 올렸다.' + leftLine(s) },
        fail: { do: s => { s.preg.mode = 'alone'; }, p: { heart: -15, trust: -15, grudge: 15 }, memory: true, effect: { happy: -6 },
          text: '{fp|은} 아직 준비가 안 됐다고 했다. 그 말을 듣고 혼자 낳기로 했다.' } },
      { label: '혼자 키운다', if: s => s.gender === 'f', do: s => { s.preg.mode = 'alone'; }, memory: true, effect: { happy: -2 },
        text: '{fp}에게는 말하지 않기로 했다. 혼자서도 해낼 수 있을 것 같았다.' },
    ] },
  { id: 'babyBorn', type: 'must', once: false,
    when: s => !!s.preg && !!s.preg.mode && s.preg.due != null && s.age >= s.preg.due,
    onStart: (s, a) => { a.focus(a.person(s.preg.pid)); s.vars.pregMode = s.preg.mode; },
    meet: s => ({ kind: 'child', ageDiff: -s.age, close: s.preg.mode === 'apart' ? 55 : 80, trust: 60 }),
    text: s => s.vars.pregMode === 'alone' ? '혼자 아이를 낳았다. 이름은 {new|으로} 지었다. 작은 손이 내 손가락을 꼭 쥐었다.'
      : s.vars.pregMode === 'apart' ? '아이가 태어났다. 이름은 {new|으로} 지었다. 같이 살지는 않지만, 주말마다 보러 가기로 했다.'
      : '아이가 태어났다. 이름은 {new|으로} 지었다. {fp|와} 번갈아 안아보며 한참을 울었다.',
    memory: true, effect: { happy: 12 }, do: s => { s.preg = null; s.flags.intimate = true; } },
  /* ═════ 피임 · 임신 공포 ═════ */
  // 함께 밤을 보내기 직전 (엔진이 부름. 고른 뒤 그 밤이 이어짐). 아이가 생길 수 있을 때만
  { id: 'contraAsk', type: 'trigger',
    text: (s, a) => {
      const p = a.focused() || {};
      if (p.spouse) return '{fp|이} 불을 끄며 작게 물었다. "우리… 아이 가질까?"';
      return GAME_DATA.contra.ask[p.personality] || '{fp|이} 잠깐 멈추고 나를 봤다.';
    },
    choices: [
      { label: '콘돔을 쓴다', do: s => { s.vars.contra = 'condom'; }, effect: { money: -1 } },
      { label: '피임약을 먹고 있으니까', if: (s, a) => a.onPill(a.focused()), do: s => { s.vars.contra = 'pill'; } },
      { label: '콘돔도 쓰고, 약도 먹었고', if: (s, a) => a.onPill(a.focused()), do: s => { s.vars.contra = 'both'; }, effect: { money: -1 } },
      { label: (s, a) => (a.focused() || {}).spouse ? '아이가 생겨도 좋아' : '그냥', do: s => { s.vars.contra = 'none'; } },
    ] },
  // 피임 없이 보낸 밤 뒤, 아이가 생기지 않았을 때 다음 계절에 (엔진이 부름)
  { id: 'pregScare', type: 'trigger',
    text: s => s.gender === 'f' ? '그날 이후로 생리가 늦어진다. 하루 종일 아무것도 손에 잡히지 않았다.' : '그날 이후로 며칠째 불안하다. {fp}에게서 연락이 없다.',
    choices: [
      { label: '먼저 연락한다', if: s => s.gender === 'm', p: { trust: [5, 8], close: [3, 6] }, effect: { happy: 4 },
        text: '"나 괜찮아. 걱정했어?" {fp}의 목소리에 안도가 묻어났다.' },
      { label: '기다린다', if: s => s.gender === 'm', effect: { happy: 2 }, text: '며칠 뒤 {fp}에게서 "다행이다"라는 문자가 왔다. 한숨이 나왔다.' },
      { label: '모른 척한다', if: s => s.gender === 'm', karma: -4, p: { trust: -12, grudge: 8 }, text: '"알아서 하겠지." 그 말을 한 걸 오래 후회했다. 다행히 아니었다.' },
      { label: '{fp}에게 말한다', if: s => s.gender === 'f', p: { trust: [4, 8], close: [2, 4] }, effect: { happy: -1 },
        text: byPers({ warm: '{fp|이} 바로 달려와 같이 테스트기를 봤다. 한 줄이었다. 둘이 동시에 긴 숨을 내쉬었다.', cool: '{fp|은} 말없이 약국에 다녀왔다. 한 줄이었다. 그제야 {fp}의 손이 떨리는 게 보였다.' },
          '{fp|와} 같이 테스트기를 봤다. 한 줄이었다. 둘이 동시에 긴 숨을 내쉬었다.') },
      { label: '혼자 병원에 간다', if: s => s.gender === 'f', effect: { happy: -2 }, text: '아니었다. 병원을 나서며, 다음엔 혼자 감당하지 않기로 했다.' },
    ] },
  // 두 번째부터 — 반복범
  { id: 'pregScareRepeat', type: 'trigger',
    text: '또다. 이번에도 괜찮을까? 불안이 점점 커진다.',
    choices: [
      { label: '피임약을 처방받는다', if: s => s.gender === 'f', set: 'onPill', effect: { money: -5, happy: 2 }, text: '며칠 뒤, 아니었다. 이제는 관리하기로 했다.' },
      { label: '{fp|와} 피임 얘기를 꺼낸다', if: s => s.gender === 'm', p: { trust: [4, 8] }, effect: { happy: 2 },
        do: (s, a) => { const p = a.focused(); if (p) p.pill = true; },
        text: '며칠 뒤, 아니었다. {fp|이} 다음 날 병원에 다녀왔다. "이제 둘 다 마음 편하게."' },
      { label: '다음에도 그냥', effect: { happy: -3 }, text: '다행히 아니었다. 또 운에 맡겼다. 진짜 괜찮을까.' },
    ] },

  /* ═════ 거절 & 실패 ═════ */
  // 함께 밤을 보내자고 했는데 상대가 내키지 않을 때 (엔진의 refusal). 내 반응이 신뢰를 가름
  { id: 'nightRefused', type: 'trigger',
    text: (s, a) => {
      const p = a.focused() || {}, R = GAME_DATA.refuseLines;
      return [R.why[s.vars.why], R[p.personality]].filter(Boolean).join(' ').replace(/\{p([|}])/g, '{fp$1');
    },
    choices: [
      { label: '"알겠어." 그대로 받아들인다', p: { trust: [3, 5], close: [1, 3] },
        text: (s, a) => lover(a.focused() || {}) ? '{fp|이} 내 품으로 파고들었다. 그날은 그냥 안고 잠들었다.' : '{fp|이} 고맙다는 듯 웃었다. 다음을 기약했다.' },
      { label: '짜증을 낸다', p: { trust: [-10, -5], heart: [-5, -3] }, text: '"맨날 이런 식이야." 말해놓고 등을 돌렸다. 둘 다 한참 잠들지 못했다.' },
      { label: '계속 조른다', p: { trust: [-20, -15], heart: -10, grudge: [8, 12] }, karma: -3,
        text: '"싫다고 했잖아." {fp|이} 베개를 들고 방을 나갔다. 며칠 동안 눈을 마주치지 않았다.' },
    ] },
  // 전 상대보다 못하다는 말을 두 번 들음 → 기술을 올리고 싶어짐
  { id: 'skillMotivate', type: 'fixed', age: [20, 49], once: false, cooldown: 3,
    when: s => (s.vars.worseN || 0) >= 2,
    text: '자존심이 상했다. 이대로는 안 되겠다.',
    choices: [
      { label: '연애 칼럼을 몰래 찾아 읽는다', do: s => { s.sexSkill = (s.sexSkill || 0) + 8; s.vars.worseN = 0; }, effect: { smart: [0, 1] },
        text: '밤새 스크롤을 내렸다. 아는 게 하나도 없었다는 걸 알았다.' },
      { label: '{partner}에게 솔직하게 물어본다', if: (s, a) => !!a.main() && a.canSex(a.main()),
        do: (s, a) => { s.sexSkill = (s.sexSkill || 0) + 6; s.vars.worseN = 0; const m = a.main(); m.compat = Math.min(100, (m.compat || 30) + 10); },
        p: { trust: [4, 8] }, text: '"뭘 좋아해?" 한참 웃다가, 진지하게 대답해줬다.' },
      { label: '신경 안 쓴다', do: s => { s.vars.worseN = 0; }, effect: { happy: -1 }, text: '그런 말 하나에 흔들리지 않기로 했다. …조금은 흔들렸다.' },
    ] },

  /* ═════ 권태 · 화해 ═════ */
  // 같은 사람과 같은 패턴이 반복됨 (같은 상대와 8번 넘게, 새로운 게 없을 때)
  { id: 'bedroomBored', type: 'fixed', age: [20, 49], once: false, cooldown: 3,
    when: mainIs((m, s, a) => (m.partner || m.spouse) && a.canSex(m) && (m.routine || 0) >= 8 && m.heart >= 40), onStart: focusMain,
    text: '요즘 {fp|와} 같은 패턴이 반복되는 느낌이다.',
    choices: [
      { label: '장소를 바꿔보자', if: s => s.money >= 20, effect: { happy: 3, money: -20 },
        do: (s, a) => { a.focused().freshBonus = true; }, text: '"이번 주말엔 어디 좀 가자." {fp}의 눈이 반짝였다. 근교 호텔을 예약했다.' },
      { label: '대화를 해본다', p: { trust: [4, 8], close: [3, 6] }, do: (s, a) => { const p = a.focused(); p.routine = Math.max(0, (p.routine || 0) - 3); },
        text: '"우리 좀 달라져 볼까?" 어색했지만 필요한 대화였다.' },
      { label: '그냥 넘어간다', text: '또 같은 밤이 반복됐다.' },
    ] },
  // 싸운 뒤 (6턴 안), 설렘이 아직 30 넘게 남아 있을 때
  { id: 'makeupSex', type: 'random', on: ['home'], age: [20, 49], once: false, cooldown: 1, weight: 3,
    when: mainIs((m, s, a) => (m.partner || m.spouse) && a.canSex(m) && m.fought != null && a.turn() - m.fought <= 3 && m.heart >= 30), onStart: focusMain,
    text: '싸운 뒤 냉전이 이어졌다. {fp|이} 먼저 내 방문을 열었다.',
    choices: [
      { label: '끌어안는다', intimate: true, satBonus: 15, memory: true, pregnant: (s, a) => a.focused().spouse ? .12 : .06,
        p: { heart: [10, 15], trust: [8, 12], grudge: [-12, -8] }, effect: { happy: [6, 10] },
        do: (s, a) => { a.focused().fought = null; },
        text: '아무 말 없이 끌어안았다. 그날 밤은 평소보다 뜨거웠다. 아침엔 둘 다 무엇 때문에 싸웠는지 잊어버렸다.' },
      { label: '"아직 화 안 풀렸어"', p: { heart: -5 }, text: '{fp|이} 문을 닫고 나갔다.' },
    ] },

  // 크기 — 기술이 결국 이김 / 크기만 믿으면 안 됨 (내가 남자일 때)
  { id: 'skillOverSize', type: 'fixed', age: [20, 49], req: { flags: ['hadSex'] },
    when: (s, a) => s.gender === 'm' && a.pGrade(s.penis) <= 2 && (s.sexSkill || 0) >= a.gradeMin('B'),
    text: '크기가 다가 아니라는 걸 알았다. 기술이 좋으면 상대의 표정이 달라진다.', effect: { happy: 5 }, memory: true },
  { id: 'sizeNotEnough', type: 'fixed', age: [20, 49], req: { flags: ['hadSex'] },
    when: (s, a) => s.gender === 'm' && a.pGrade(s.penis) >= 5 && (s.sexSkill || 0) < a.gradeMin('D') && !!a.main() && a.canSex(a.main()), onStart: focusMain,
    text: '크기만 믿으면 안 된다는 걸 알았다. {fp|이} "좀 더… 천천히"라고 했다.', effect: { happy: -2 } },
  { id: 'hiddenChildSeen', type: 'fixed', age: [28, 50], req: { flags: ['hiddenChild'] },
    text: '길에서 나를 꼭 닮은 아이를 봤다. 아이 손을 잡고 걷던 {hiddenName|이} 나를 보고 걸음을 멈췄다.',
    choices: [
      { label: '다가가서 사과한다', karma: 10, unset: 'hiddenChild', memory: true, effect: { happy: -2 },
        text: '아이는 내 얼굴을 빤히 올려다봤다. {hiddenName|은} 한참 만에 "늦었어."라고만 했다.' },
      { label: '고개를 돌린다', karma: -5, effect: { happy: -6 }, text: '그날 밤 한숨도 못 잤다.' },
    ] },
  // 전 연인
  { id: 'exCall', type: 'random', on: ['bar', 'drink', 'home', 'rest'], age: [19, 49], once: false, cooldown: 3,
    when: (s, a) => a.find(p => p.ex && !lover(p) && a.canRomance(p) && p.grudge < 40 && p.close >= 15).length > 0,
    onStart: (s, a) => a.focus(a.pick(a.find(p => p.ex && !lover(p) && a.canRomance(p) && p.grudge < 40 && p.close >= 15))),
    text: '새벽 두 시, {fp}에게서 전화가 왔다. "자?"',
    choices: [
      { label: '받는다', p: { heart: [6, 10], close: [3, 5] }, risk: .15, text: '{fp|와} 새벽까지 통화했다. 끊고 나서 한참 천장을 봤다.' },
      { label: '안 받는다', effect: { happy: -1 }, text: '휴대폰을 엎어놨다. 진동이 두 번 더 울렸다.' },
    ] },
  // 결혼 뒤
  { id: 'quietNight', type: 'fixed', age: [24, 49], once: false, cooldown: 3,
    when: (s, a) => { const m = a.main(); return m && m.spouse && m.heart >= 50 && m.trust >= 40 && a.canSex(m); },
    onStart: (s, a) => a.focus(a.main()),
    text: (s, a) => a.find(p => p.kind === 'child' && a.npcAge(p) < 10).length ? '아이들이 잠든 뒤, {fp|와} 오랜만에 둘만 남았다.' : '{fp|와} 오랜만에 둘 다 일찍 퇴근했다.',
    choices: [
      { label: '와인을 꺼낸다', text: (s, a) => '오랜만에 둘만의 밤이었다. ' + nightLine(a, 'lover'), intimate: true, mood: 10, pregnant: .12,
        p: { heart: [6, 10], close: [3, 6] }, effect: { happy: [3, 5] } },
      { label: '피곤하다며 먼저 잔다', p: { heart: -3 }, text: '{fp|이} 등을 돌리고 누웠다.' },
    ] },
  { id: 'marriageBoredom', type: 'fixed', age: [30, 49], once: false, cooldown: 4,
    when: (s, a) => { const m = a.main(); return m && m.spouse && m.heart < 30; },
    onStart: (s, a) => a.focus(a.main()),
    text: '{fp|와} 마지막으로 손을 잡은 게 언제인지 기억이 안 난다.',
    choices: [
      { label: '깜짝 데이트를 계획한다', if: s => s.money >= 50,
        p: { heart: [10, 18], close: [6, 10] }, effect: { happy: 4, money: -50 },
        text: '처음 만났을 때 이야기가 나왔다. 집에 돌아와서도 불을 바로 끄지 않았다.', memory: true },
      { label: '그냥 지나간다', text: '오늘도 각자의 방에서 잠들었다.' },
    ] },

  /* ═════ 친밀한 관계 — 첫 경험, 성욕, 만족감 ═════ */
  // 내 첫 경험 (엔진이 함께 보낸 첫 밤에 부름)
  { id: 'firstTime', type: 'trigger',
    text: byPers({ bold: '{fp|이} 먼저 불을 껐다.', shy: '둘 다 긴장해서 한참을 가만히 있었다.', playful: '{fp|이} "긴장했어?" 하고 웃었다.', cool: '아무 말 없이, 자연스럽게.',
      warm: '{fp|이} 내 손을 꼭 잡고 눈을 맞췄다.', sharp: '"준비됐어?" {fp|이} 물었다. 고개를 끄덕였다.', sunny: '{fp|이} 웃으면서 이불을 끌어올렸다.', sensitive: '{fp}의 심장 소리가 들렸다. 내 것도.' },
      '서툴렀지만, 오래 기억에 남을 밤이었다.'),
    p: { heart: [12, 20], close: [6, 10], trust: [8, 12] }, effect: { happy: [6, 10] }, memory: true },
  { id: 'partnerFrustrated', type: 'fixed', age: [20, 49], once: false, cooldown: 3,
    when: mainIs(m => (m.partner || m.spouse) && (m.libido || 0) >= 75 && m.heart >= 40), onStart: focusMain,
    text: '{fp|이} 요즘 우리 좀 그런 거 같지 않냐고 말했다.',
    choices: [
      { label: '"미안, 요즘 정신이 없었어"', p: { heart: [3, 6] }, text: '{fp|이} 고개를 끄덕였지만, 표정이 다 풀리진 않았다.' },
      { label: '오늘 밤 보여줄게', intimate: true, mood: 10, p: { heart: [10, 16] }, effect: { happy: [4, 8] },
        pregnant: (s, a) => a.focused().spouse ? .12 : .06, text: '{fp|이} 웃었다. 그날 밤은 평소보다 길었다.' },
    ] },
  { id: 'npcInitiate', type: 'fixed', age: [20, 49], once: false, cooldown: 2, weight: 1.5,
    when: mainIs(m => m.heart >= 70 && (m.libido || 0) >= 60), onStart: focusMain,
    text: byPers({ bold: '{fp|이} 대뜸 내 손을 잡고 방으로 끌었다.', shy: '{fp|이} 한참을 우물쭈물하다가 내 옷자락을 잡았다.', playful: '{fp|이} "오늘 일찍 자자"고 하더니 불을 먼저 껐다.',
      cool: '{fp|이} 말없이 내 옆에 누워서 어깨에 머리를 기댔다.', warm: '{fp|이} 뒤에서 안으며 "보고 싶었어"라고 했다.', sharp: '{fp|이} "요즘 왜 이렇게 안 해?"라고 직접적으로 말했다.',
      sunny: '{fp|이} 욕실에서 나오더니 수건만 두른 채로 웃었다.', sensitive: '{fp|이} 이유 없이 꼭 안기더니 고개를 들어 입술을 맞췄다.' }, '{fp|이} 먼저 다가왔다.'),
    choices: [
      { label: '받아들인다', intimate: true, mood: 15, p: { heart: [8, 14] }, effect: { happy: [4, 6] }, pregnant: (s, a) => a.focused().spouse ? .12 : .06,
        risk: (s, a) => a.focused().secret ? .15 : 0, text: (s, a) => nightLine(a, 'lover') },
      { label: '오늘은 피곤하다', p: { heart: -3, close: -2 }, text: '{fp|이} 머쓱하게 웃으며 돌아누웠다.' },
    ] },
  { id: 'neckKiss', type: 'random', on: ['home', 'rest'], age: [20, 49], once: false, cooldown: 2,
    when: (s, a) => { const m = a.main(); return m && m.heart >= 55 && (m.livesWith || m.spouse); }, onStart: focusMain,
    text: '소파에 앉아 있는데 {fp}의 입술이 목덜미에 닿았다.',
    choices: [
      { label: '돌아본다', intimate: true, mood: 10, p: { heart: [6, 10] }, effect: { happy: [3, 5] }, pregnant: (s, a) => a.focused().spouse ? .12 : .06, text: (s, a) => nightLine(a, 'lover') },
      { label: '"간지러워" 하고 웃는다', p: { heart: [2, 4] }, text: '{fp|이} 장난스럽게 한 번 더 그랬다.' },
    ] },
  { id: 'npcApproach', type: 'random', on: NOT_ROUTINE, age: [20, 49], once: false, weight: 3,
    // 생김새 S는 한 해 1~2번, A는 2년에 1번, B는 3~4년에 1번 (몸 A 이상이면 S·A는 한 번 더, B는 2년마다). C 이하는 몸·매력이 좋으면 가끔
    when: (s, a) => {
      const g = a.myFace(), bodyA = s.stats.fit >= a.gradeMin('A');
      const gap = g >= 6 ? 1 : g >= 5 ? 2 : g >= 4 ? (bodyA ? 2 : 3) : bodyA && s.stats.charm >= a.gradeMin('C') ? 4 : 99;
      const quota = (g >= 6 ? (Math.random() < .5 ? 2 : 1) : 1) + (g >= 5 && bodyA ? 1 : 0), w = s.vars.npcApp || { from: -99, n: 0 };
      s.vars.npcAppGap = gap;
      return s.age - w.from >= gap || w.n < quota;
    },
    // 기간(gap년) 안에서 몇 번 왔는지 셈
    do: s => { const w = s.vars.npcApp; s.vars.npcApp = w && s.age - w.from < s.vars.npcAppGap ? { from: w.from, n: w.n + 1 } : { from: s.age, n: 1 }; },
    meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [Math.max(20, s.age - 5), Math.min(49, s.age + 5)], hangout: s.place, close: 30, heart: 20 }),
    text: s => s.place === 'bar' ? ['옆 테이블 {new|이} 먼저 말을 걸어왔다. "혼자세요?"', '{new|이} "같이 한 잔 해도 돼요?"라며 옆에 앉았다.']
      : ['{new|이} 웃으며 자기 번호를 적은 냅킨을 밀어왔다.', '{new|이} 머뭇거리다 먼저 말을 걸어왔다. "아까부터 보고 있었어요."'] },
  { id: 'barWhisper', type: 'random', on: ['bar', 'drink'], age: [20, 49], once: false, cooldown: 2,
    when: (s, a) => hereWho(a, p => a.canSex(p) && p.heart >= 35 && !lover(p)).length > 0,
    onStart: focusHere(p => p.heart >= 35 && !lover(p)), text: '{fp|이} 귓가에 속삭였다. "우리 나갈래?"',
    choices: [
      { label: '같이 나간다', intimate: true, fling: true, mood: 10, p: { heart: [8, 12], close: [3, 5] }, effect: { happy: [3, 5] }, pregnant: .05, risk: .2, riskTaken: .15, memory: firstNight,
        text: (s, a) => a.pick(GAME_DATA.nightLines.flingIntro) + ' ' + nightLine(a, 'fling') },
      { label: '웃으며 넘긴다', p: { heart: -2 }, text: '{fp|이} 어깨를 으쓱하고 잔을 비웠다.' },
    ] },
  { id: 'gymSpotHand', type: 'random', on: ['gym', 'exercise'], age: [20, 49], once: false, cooldown: 3,
    when: (s, a) => hereWho(a, p => a.canSex(p) && !lover(p)).length > 0, onStart: focusHere(p => !lover(p)),
    text: '자세를 봐주겠다며 {fp|이} 내 허리에 손을 올렸다. 손이 조금 오래 머물렀다.', p: { heart: [3, 6] }, libido: [5, 10] },
  { id: 'lateOffice', type: 'random', on: ['office', 'overtime'], age: [22, 49], once: false, cooldown: 3,
    when: (s, a) => hereWho(a, p => a.canSex(p) && p.kind === 'coworker' && p.heart >= 30).length > 0,
    onStart: focusHere(p => p.kind === 'coworker' && p.heart >= 30), text: '야근이 끝난 사무실에 {fp|와} 둘만 남았다. {fp|이} 넥타이를 느슨하게 풀며 웃었다.',
    choices: [
      { label: '같이 야식을 먹는다', p: { heart: [5, 9], close: [3, 5] }, risk: .1, text: '편의점 테이블에서 컵라면을 먹었다. 무릎이 몇 번 닿았다.' },
      { label: '먼저 퇴근한다', text: '엘리베이터 문이 닫힐 때까지 {fp|이} 손을 흔들었다.' },
    ] },
  { id: 'npcCafeSeat', type: 'random', on: ['cafe', 'coffee'], age: [20, 49], once: false, cooldown: 3, when: (s, a) => a.myFace() >= 3 || s.stats.style >= a.gradeMin('C'),
    meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [Math.max(20, s.age - 6), Math.min(49, s.age + 6)], hangout: 'cafe', close: 22, heart: 12 }),
    text: '자리가 없는 카페, {new|이} 내 맞은편 빈자리를 가리켰다. "여기 앉아도 돼요?" 커피가 식을 때까지 이야기했다.' },
  { id: 'npcConcertHand', type: 'random', on: ['concert', 'watch'], age: [20, 49], once: false, cooldown: 3,
    meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [Math.max(20, s.age - 6), Math.min(49, s.age + 6)], hangout: 'concert', hobby: 'music', close: 24, heart: 15 }),
    text: '앵콜 때 사람들이 밀려들었다. 넘어질 뻔한 나를 옆 사람 {new|이} 붙잡았다. 노래가 끝날 때까지 손을 놓지 않았다.' },
  { id: 'npcAskOut', type: 'random', age: [20, 49], once: false, cooldown: 2,
    when: (s, a) => a.find(p => a.canRomance(p) && !lover(p) && p.heart >= 40 && ['bold', 'sunny', 'playful'].includes(p.personality)).length > 0,
    onStart: (s, a) => a.focus(a.pick(a.find(p => a.canRomance(p) && !lover(p) && p.heart >= 40 && ['bold', 'sunny', 'playful'].includes(p.personality)))),
    text: byPers({ bold: '{fp|이} 대뜸 말했다. "이번 주말에 나랑 영화 보자. 싫으면 말고."', sunny: '{fp|이} 신나서 전화를 걸어왔다. "주말에 바다 보러 갈래?"',
      playful: '{fp|이} 영화표 두 장을 흔들었다. "친구가 바람맞혔는데, 대타 할래?"' }, '{fp|이} 주말에 시간 있냐고 물었다.'),
    choices: [
      { label: '좋다고 한다', p: { heart: [6, 10], close: [3, 5] }, effect: { happy: 3 }, text: '영화는 기억이 안 난다. 끝나고 걸었던 길만 생각난다.' },
      { label: '다음에 하자고 한다', p: { heart: -4 }, text: '{fp|이} "다음에 꼭!" 하고 웃었다.' },
    ] },
  { id: 'npcLateCall', type: 'random', on: ['home', 'rest'], age: [20, 49], once: false, cooldown: 3,
    when: (s, a) => a.find(p => a.canSex(p) && !lover(p) && p.heart >= 50 && (p.libido || 0) >= 50).length > 0,
    onStart: (s, a) => a.focus(a.find(p => a.canSex(p) && !lover(p) && p.heart >= 50 && (p.libido || 0) >= 50)[0]),
    text: '자정이 넘어 {fp}에게서 전화가 왔다. "그냥… 목소리 듣고 싶어서."',
    choices: [
      { label: '"지금 올래?"', intimate: true, fling: true, p: { heart: [6, 10] }, risk: .2, riskTaken: .15, pregnant: .04, memory: firstNight,
        text: (s, a) => '이십 분 뒤 초인종이 울렸다. ' + nightLine(a, 'fling') },
      { label: '새벽까지 통화만 한다', p: { heart: [4, 7], close: [3, 5] }, text: '해가 뜰 때쯤 {fp|이} 먼저 잠들었다. 숨소리가 들렸다.' },
    ] },
  { id: 'loverAfterglow', type: 'random', age: [20, 49], once: false, cooldown: 2,
    when: (s, a) => a.find(p => lover(p) && (p.lastSat || 0) >= 90).length > 0,
    onStart: (s, a) => a.focus(a.find(p => lover(p) && (p.lastSat || 0) >= 90)[0]),
    text: '{fp|이} 요즘 부쩍 먼저 연락한다. 별일 없이도 "뭐 해?"', p: { heart: [3, 5] }, do: (s, a) => { const p = a.focused(); p.libido = Math.min(100, (p.libido || 0) + 20); } },
  { id: 'loverCold', type: 'fixed', age: [20, 49], once: false, cooldown: 3,
    when: (s, a) => a.find(p => lover(p) && p.nights >= 2 && (p.lastSat ?? 50) < 30).length > 0,
    onStart: (s, a) => a.focus(a.find(p => lover(p) && p.nights >= 2 && (p.lastSat ?? 50) < 30)[0]),
    text: '{fp|이} 요즘 스킨십을 슬쩍 피한다.',
    choices: [
      { label: '솔직하게 이야기해본다', p: { trust: [5, 8] }, do: (s, a) => { const p = a.focused(); p.compat = Math.min(100, (p.compat || 30) + 10); },
        text: '어색했지만 끝까지 이야기했다. 서로 몰랐던 게 많았다.' },
      { label: '모른 척한다', p: { heart: [-6, -3] }, text: '침대 양 끝에 누워 잠들었다.' },
    ] },
  // 성욕은 늘 대상이 있음 — 가장 높은 대상(a.lustTop)이 80을 넘으면 그 사람 생각에 잠이 안 옴
  { id: 'libidoRestless', type: 'random', age: [20, 49], once: false, cooldown: 2, when: (s, a) => s.stats.libido >= 80 && !!a.lustTop(),
    onStart: (s, a) => a.focus(a.lustTop()),
    text: '밤마다 {fp} 생각에 잠이 안 온다. 괜히 휴대폰 연락처만 위아래로 넘겼다.',
    choices: [
      { label: '{fp}에게 연락한다', p: { heart: [3, 6] }, libido: [4, 8], risk: (s, a) => a.focused() && !lover(a.focused()) ? .1 : 0,
        text: (s, a) => lover(a.focused()) || a.focused().fwb ? '"자?" 1이 사라지자마자 전화가 걸려왔다.' : '"자?" 한 글자를 보냈다. 한참 뒤에 1이 사라졌다.' },
      { label: '전 연인에게 연락한다', if: (s, a) => a.find(p => p.ex && a.canSex(p) && p.grudge < 40).length > 0, risk: .15,
        do: (s, a) => a.focus(a.find(p => p.ex && a.canSex(p) && p.grudge < 40)[0]), p: { heart: [4, 8] }, text: '"자?" 한 글자를 보냈다. 1이 금방 사라졌다.' },
      { label: '편한 사람을 부른다', if: (s, a) => a.find(p => (p.fwb || p.fling) && a.canSex(p)).length > 0,
        do: (s, a) => a.focus(a.find(p => (p.fwb || p.fling) && a.canSex(p))[0]), intimate: true, fling: true, risk: .2, pregnant: .04,
        text: (s, a) => '"지금 와." 답장은 한 글자였다. ' + nightLine(a, 'fling') },
      { label: '찬물로 샤워한다', libido: [-25, -15], effect: { health: 1 }, text: '이가 딱딱 부딪혔다. 조금 나아졌다.' },
    ] },
  { id: 'libidoDistract', type: 'random', on: ['work', 'study', 'office'], age: [20, 49], once: false, cooldown: 2, when: (s, a) => s.stats.libido >= 70 && !!a.lustTop(),
    onStart: (s, a) => a.focus(a.lustTop()),
    text: '도무지 집중이 안 된다. {fp|이} 자꾸 떠올라 같은 문장을 다섯 번째 읽고 있다.', effect: { happy: -1 }, do: (s, a) => a.perf(-3) },

  /* ═════ 섹파 (감정은 깊지 않고, 서로 성욕이 차면 만나는 사이) ═════ */
  { id: 'fwbOffer', type: 'fixed', age: [20, 49], once: false, cooldown: 2, weight: 1.5,
    when: (s, a) => a.find(p => a.canSex(p) && !lover(p) && !p.fwb && p.nights >= 1 && p.close >= 40 && p.heart >= 30 && p.heart <= 60).length > 0,
    onStart: (s, a) => a.focus(a.find(p => a.canSex(p) && !lover(p) && !p.fwb && p.nights >= 1 && p.close >= 40 && p.heart >= 30 && p.heart <= 60)[0]),
    text: byPers({ bold: '{fp|이} "우리 그냥 편하게 만나자. 서로 부담 없이."라고 했다.', cool: '{fp|이} 무심하게 물었다. "이대로 가끔 보는 거, 괜찮지?"',
      playful: '{fp|이} 새끼손가락을 내밀었다. "사귀는 건 아니고, 근데 또 보는 거. 약속?"', sharp: '{fp|이} 조건을 정리하듯 말했다. "연애는 아니야. 그래도 가끔은 보자."' },
      '{fp|이} 조심스럽게 물었다. "우리… 그냥 편하게 만나는 건 어때?"'),
    choices: [
      { label: '좋아', do: (s, a) => { const p = a.focused(); p.fwb = true; p.fling = true; }, text: '선은 확실히 그었다. 적어도 그렇다고 생각했다.' },
      { label: '그건 싫어', do: (s, a) => { const p = a.focused(); p.fling = false; }, p: { heart: [-10, -5], close: [-3, -1] }, text: '{fp|이} 알겠다며 웃었다. 그 뒤로 조금 어색해졌다.' },
    ] },
  { id: 'fwbCall', type: 'random', age: [20, 49], once: false, cooldown: 1, weight: 1.5,
    when: (s, a) => a.find(p => p.fwb && a.canSex(p) && (a.lust(p) >= 60 || (p.libido || 0) >= 60)).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.fwb && a.canSex(p) && (a.lust(p) >= 60 || (p.libido || 0) >= 60))[0]),
    text: '{fp}에게서 문자가 왔다. "오늘 시간 돼?"',
    choices: [
      { label: '간다', intimate: true, fling: true, p: { close: [2, 4] }, effect: { happy: [2, 4] }, risk: .15, pregnant: .04,
        text: (s, a) => '현관문이 닫히자마자 말이 필요 없었다. ' + nightLine(a, 'fling') },
      { label: '오늘은 패스', p: { close: -2 }, text: '"ㅇㅋ" 답장이 바로 왔다.' },
    ] },
  { id: 'fwbFeelings', type: 'fixed', age: [20, 49], once: false, cooldown: 2, weight: 2,
    when: (s, a) => a.find(p => p.fwb && p.heart > 70).length > 0, onStart: (s, a) => a.focus(a.find(p => p.fwb && p.heart > 70)[0]),
    text: '{fp|이} 옷을 입다 말고 물었다. "우리… 이거 사귀는 거 아니야?"',
    choices: [
      { label: '사귀자', memory: true, do: (s, a) => a.startRelation(a.focused(), !!a.main() || !!a.focused().married), effect: { happy: [4, 8] },
        text: (s, a) => a.focused().secret ? '{fp|와} 몰래 만나기 시작했다. 이번엔 진짜였다.' : '{fp|와} 정식으로 사귀기로 했다. 순서가 좀 뒤바뀌었을 뿐이다.' },
      { label: '선은 지키자', p: { heart: [-15, -10], close: [-4, -2] }, text: '{fp|이} "그래, 그렇지." 하고 웃었다. 웃는 얼굴이 아니었다.' },
      { label: '이제 그만하자', do: (s, a) => a.endAffair(a.focused()), p: { heart: [-20, -10], close: [-10, -5] }, text: '{fp|이} 한참 나를 보다가 문을 닫고 나갔다.' },
    ] },

  /* ═════ 술자리 (s.drunk: 0 맨정신 / 1 한잔 / 2 적당히 취함 / 3 만취) ═════ */
  { id: 'drunkText', type: 'random', on: ['bar', 'drink'], age: [20, 50], once: false, cooldown: 3,
    when: (s, a) => s.drunk >= 3 && a.find(p => p.ex && !lover(p)).length > 0, onStart: (s, a) => a.focus(a.pick(a.find(p => p.ex && !lover(p)))),
    text: '만취 상태로 {fp}에게 "보고 싶다"고 카톡을 보냈다.',
    choices: [
      { label: '보내버렸다', p: { heart: [3, 8], close: [-5, 0] }, risk: .15, text: '읽씹당했다. 아침에 후회할 거다.', effect: { happy: -2 } },
    ] },
  { id: 'passOut', type: 'random', on: ['bar', 'drink'], age: [19, 50], once: false, cooldown: 4, when: s => s.drunk >= 3,
    text: '정신을 차려보니 공원 벤치였다. 지갑이 없다.', sober: true, moveTo: 'park', effect: { health: -8, happy: -4, money: [-100, -30] } },
  { id: 'drunkCall', type: 'random', on: ['bar', 'drink'], age: [20, 50], once: false, cooldown: 3,
    when: (s, a) => s.drunk >= 3 && a.find(p => p.close >= 20 && p.close < 45 && !['family', 'child'].includes(p.kind)).length > 0,
    onStart: (s, a) => a.focus(a.pick(a.find(p => p.close >= 20 && p.close < 45 && !['family', 'child'].includes(p.kind)))),
    text: '새벽 세 시, 왜인지 {fp}에게 전화를 걸고 있었다.',
    choices: [
      { label: '할 말은 한다', chance: .4,
        success: { p: { close: [6, 10], trust: [2, 4] }, text: '{fp|이} 잠긴 목소리로 한참 들어줬다. "너 취했구나. 들어가서 자."' },
        fail: { p: { close: -6, trust: -4 }, text: '횡설수설했다. 다음 날 통화 기록을 보고 이불을 걷어찼다.' } },
      { label: '급히 끊는다', text: '신호가 가기 전에 끊었다. 부재중 전화 한 통이 찍혔을 거다.', p: { close: -1 } },
    ] },
  { id: 'drunkFlirtStranger', type: 'random', on: ['bar', 'drink'], age: [20, 49], once: false, cooldown: 2, when: s => s.drunk >= 3,
    text: '취기에 옆 테이블 사람에게 다짜고짜 말을 걸었다. "나 좋아해? 좋아하지?"',
    choices: [
      { label: '밀어붙인다', chance: .35,
        success: { meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [Math.max(20, s.age - 6), Math.min(49, s.age + 6)], hangout: 'bar', close: 22, heart: 18 }),
          text: '{new|이} 어이없다는 듯 웃더니 번호를 찍어줬다.' },
        fail: { text: '테이블 전체가 조용해졌다. 일행이 나를 끌고 나갔다.', effect: { happy: -4 } } },
      { label: '정신을 차린다', text: '찬물을 한 잔 들이켰다. 조금 살 것 같았다.', drunk: -1 },
    ] },
  { id: 'drunkBrawl', type: 'random', on: ['bar', 'drink'], age: [19, 50], once: false, cooldown: 3, when: s => s.drunk >= 3,
    text: '만취해서 옆 테이블과 시비가 붙었다. 누가 먼저였는지는 기억이 안 난다.',
    choices: [
      { label: '주먹이 먼저 나간다', karma: -5, heat: 12, effect: { health: [-12, -5], happy: -5 }, text: '파출소에서 아침을 맞았다.', sober: true },
      { label: '사과하고 나간다', karma: 1, effect: { happy: -2 }, text: '연신 고개를 숙이고 나왔다. 밤공기가 정신을 들게 했다.', sober: true },
    ] },
  { id: 'drunkKaraoke', type: 'random', on: ['bar', 'drink'], age: [19, 50], once: false, cooldown: 2,
    when: (s, a) => s.drunk >= 2 && hereWho(a).length > 0, onStart: focusHere(),
    text: '{fp|이} 2차로 노래방에 가자고 했다.',
    choices: [
      { label: '간다', drunk: 1, p: { close: [5, 8], heart: [1, 3] }, effect: { happy: [3, 5], money: -20 }, text: '{fp|와} 듀엣으로 발라드를 불렀다. 둘 다 음이 하나도 안 맞았다.' },
      { label: '여기까지만', text: '"다음엔 꼭!" {fp|이} 손을 흔들었다.' },
    ] },
  { id: 'drunkTaxiSleep', type: 'random', on: ['bar', 'drink'], age: [19, 50], once: false, cooldown: 4, when: s => s.drunk >= 2,
    text: '택시에서 잠들었다. 기사님이 흔들어 깨워보니 미터기가 3만 원을 넘어 있었다.', sober: true, effect: { money: -3, happy: -1 } },
  { id: 'drunkConfession', type: 'random', on: ['bar', 'drink'], age: [20, 49], once: false, cooldown: 3,
    when: (s, a) => s.drunk >= 2 && hereWho(a, p => a.canRomance(p) && p.heart >= 30 && !lover(p)).length > 0,
    onStart: focusHere(p => p.heart >= 30 && !lover(p)),
    text: '{fp|이} 술기운에 "사실 나 예전부터…" 하다가 말을 멈췄다.',
    choices: [
      { label: '"예전부터 뭐?"', p: { heart: [6, 10] }, text: '{fp|이} 잔만 만지작거리다 웃어버렸다. 대답은 다음으로 미뤄졌다.' },
      { label: '못 들은 척한다', p: { heart: -3 }, text: '{fp|이} 화제를 돌렸다. 둘 다 술만 마셨다.' },
    ] },
  { id: 'drunkPhoto', type: 'random', on: ['bar', 'drink'], age: [19, 50], once: false, cooldown: 4, when: s => s.drunk >= 2,
    text: '다음 날, 단톡방에 내 사진이 올라와 있었다. 테이블에 엎드려 자는 사진이었다. 반응이 뜨거웠다.', effect: { happy: -2, charm: 1 } },
  { id: 'hangoverWork', type: 'random', on: ['office', 'work'], age: [20, 50], once: false, cooldown: 3, when: s => (s.done.drunkBrawl || s.done.passOut || s.done.drunkKaraoke) && s.stats.health < 85,
    text: '숙취에 회의 시간 내내 졸았다. 상사의 시선이 따가웠다.', effect: { happy: -2 }, do: (s, a) => a.perf(-4) },

  /* ═════ 기혼자 (친밀 20 반지, 40 결혼 확인. 늘 몰래 만나는 사이로 시작) ═════ */
  { id: 'marriedReveal', type: 'random', age: [20, 50], once: false, cooldown: 2,
    when: (s, a) => a.find(p => p.married && !p.marriedKnown && p.close >= 35 && a.canRomance(p)).length > 0,
    onStart: (s, a) => { const p = a.find(x => x.married && !x.marriedKnown && x.close >= 35 && a.canRomance(x))[0]; a.focus(p); },
    text: '{fp|이} 조심스럽게 말했다. "사실… 나 결혼했어."',
    choices: [
      { label: '상관없어', p: { heart: [4, 8], trust: [3, 6] }, do: (s, a) => { a.focused().marriedKnown = true; }, text: '둘 다 이게 뭘 의미하는지 알고 있었다.' },
      { label: '왜 이제야 말해', p: { trust: [-15, -10], heart: [-5, -2] }, do: (s, a) => { a.focused().marriedKnown = true; }, text: '{fp|이} 고개를 숙였다. "말할 타이밍을 놓쳤어."' },
      { label: '여기까지야', p: { heart: [-20, -10], close: [-10, -5] }, do: (s, a) => { const p = a.focused(); p.marriedKnown = true; if (p.secret) a.breakUp(p, 5); p.fling = false; p.fwb = false; },
        text: '자리에서 일어났다. {fp|이} 붙잡지 않았다.' },
    ] },
  { id: 'spouseCaught', type: 'trigger',
    onStart: (s, a) => { s.vars.spw = a.spouseWord(a.focused()); },
    text: '{fp}의 {spw|이} 찾아왔다. 눈이 벌겠다.',
    choices: [
      { label: '맞는다', effect: { health: [-15, -8], happy: -6 }, karma: 1, p: { heart: -5 }, text: '피하지 않았다. 할 말이 없었다.' },
      { label: '도망친다', check: { stat: 'fit', diff: 80 },
        success: { effect: { happy: -4 }, text: '골목을 몇 개 지나서야 숨을 돌렸다.' },
        fail: { effect: { health: [-20, -12], happy: -8 }, text: '세 걸음 만에 붙잡혔다.' } },
      { label: '사과한다', chance: .3,
        success: { effect: { health: -5, happy: -4 }, karma: 2, text: '고개를 숙였다. {spw|은} 한참 노려보다 돌아섰다.' },
        fail: { effect: { health: -8, happy: -8 }, do: (s, a) => a.perf(-25), text: '사과는 통하지 않았다. 다음 날 회사로 전화가 왔다.' } },
    ] },
  { id: 'marriedLeave', type: 'fixed', age: [20, 50], once: false, cooldown: 3,
    when: (s, a) => a.find(p => p.married && p.secret && p.heart >= 80 && p.trust >= 65).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.married && p.secret && p.heart >= 80 && p.trust >= 65)[0]),
    text: (s, a) => a.main() && a.main() !== a.focused() ? '{fp|이} 말했다. "이혼했어. 이제 너만 정리하면 돼."' : '{fp|이} 말했다. "이혼했어. 이제 숨지 않아도 돼."',   // 문장은 do 다음에 정해짐
    do: (s, a) => { const p = a.focused(); p.married = false; p.divorced = true; p.divorcedKnown = true; p.taken = false; if (!a.main()) { p.secret = false; p.partner = true; } },
    memory: true, effect: { happy: 8 } },
  { id: 'marriedReturn', type: 'fixed', age: [20, 50], once: false, cooldown: 3,
    when: (s, a) => a.find(p => p.married && (p.secret || p.fwb || p.fling) && p.heart < 40).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.married && (p.secret || p.fwb || p.fling) && p.heart < 40)[0]),
    text: '{fp|이} "미안해. 돌아가야 할 것 같아."라고 했다.', do: (s, a) => { const p = a.focused(); a.endAffair(p); p.ex = true; }, memory: true, effect: { happy: -6 } },
  { id: 'marriedLonely', type: 'fixed', age: [25, 49], once: false, cooldown: 3,
    when: (s, a) => a.find(p => p.married && p.marriedKnown && a.canSex(p) && p.close >= 50 && p.heart >= 35 && (p.libido || 0) >= 50).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.married && p.marriedKnown && a.canSex(p) && p.close >= 50 && p.heart >= 35 && (p.libido || 0) >= 50)[0]),
    text: '{fp|이} 야근 끝나고 "오늘 집에 가기 싫다"고 했다.',
    choices: [
      { label: '"한 잔 하러 갈까"', drunk: 2, p: { heart: [8, 14], close: [4, 8] }, text: '늦게까지 둘이 마셨다. {fp|이} 취해서 내 어깨에 기댔다.' },
      { label: '"집에 가"', text: '{fp|이} 쓴웃음을 지었다.' },
    ] },
  { id: 'marriedDrunk', type: 'random', on: ['bar', 'drink'], age: [25, 49], once: false, cooldown: 3,
    when: (s, a) => s.drunk >= 2 && a.find(p => p.married && p.marriedKnown && a.canSex(p) && p.heart >= 45).length > 0,
    onStart: (s, a) => a.focus(a.pick(hereWho(a, p => p.married && p.marriedKnown && p.heart >= 45).concat(a.find(p => p.married && p.marriedKnown && a.canSex(p) && p.heart >= 45)).slice(0, 1))),
    text: '2차를 나서는데 {fp|이} 택시를 같이 타자고 했다. 눈이 촉촉했다.',
    choices: [
      { label: '같이 탄다', intimate: true, fling: true, mood: 10, p: { heart: [10, 16] }, effect: { happy: [3, 6] }, risk: .2, riskTaken: .2, pregnant: .04,
        text: (s, a) => '택시에서 {fp}의 손이 내 손 위에 올라왔다. 아무도 안 내렸다. ' + nightLine(a, 'fling') },
      { label: '보내준다', text: '{fp|이} "고마워"라고 하고 내렸다. 손을 늦게 놓았다.' },
    ] },
  { id: 'marriedVent', type: 'fixed', age: [25, 49], once: false, cooldown: 4,
    when: (s, a) => a.find(p => p.married && p.marriedKnown && a.canRomance(p) && p.close >= 55 && p.trust >= 40).length > 0,
    onStart: (s, a) => { const p = a.find(x => x.married && x.marriedKnown && a.canRomance(x) && x.close >= 55 && x.trust >= 40)[0]; a.focus(p); s.vars.spw = a.spouseWord(p); },
    text: '{fp|이} {spw} 얘기를 하다가 울었다. "나한테는 왜 이렇게 잘해줘?"',
    choices: [
      { label: '안아준다', p: { heart: [12, 18], trust: [6, 10], close: [4, 8] }, text: '{fp|이} 한참을 울더니 고개를 들어 나를 봤다. 거리가 가까웠다.' },
      { label: '"괜찮을 거야"', p: { trust: [4, 8], close: [3, 6] }, text: '티슈를 건넸다. {fp|이} 코를 풀며 웃었다.' },
    ] },
  { id: 'marriedTravel', type: 'random', on: ['travel', 'station'], age: [25, 49], once: false, cooldown: 4,
    when: (s, a) => a.find(p => p.married && p.marriedKnown && a.canSex(p) && p.heart >= 55).length > 0,
    onStart: (s, a) => { const p = a.find(x => x.married && x.marriedKnown && a.canSex(x) && x.heart >= 55)[0]; a.focus(p); s.vars.spw = a.spouseWord(p); },
    text: '출장지에서 {fp|을} 우연히 만났다. {fp|이} "{spw}한테는 출장 연장이라고 했어"라고 했다.',
    choices: [
      { label: '같이 저녁을 먹는다', intimate: true, fling: true, mood: 20, p: { heart: [10, 16] }, effect: { happy: [4, 6] }, memory: true, riskTaken: .1, pregnant: .04,
        text: '호텔 바에서 시작된 밤이 객실에서 끝났다.' },
      { label: '선을 지킨다', text: '저녁만 먹고 돌아왔다. {fp}의 표정이 아쉬워 보였다.' },
    ] },
  { id: 'marriedRing', type: 'random', on: ['bar', 'cafe', 'home'], age: [20, 50], once: false, cooldown: 3,
    when: (s, a) => a.find(p => p.married && p.marriedKnown && (p.secret || p.fwb || p.fling)).length > 0,
    onStart: (s, a) => a.focus(a.find(p => p.married && p.marriedKnown && (p.secret || p.fwb || p.fling))[0]),
    text: '{fp|은} 만나러 올 때마다 반지를 빼놓고 왔다. 오늘은 깜빡했는지 손가락에 그대로였다.',
    choices: [
      { label: '말없이 그 손을 잡는다', p: { heart: [3, 6], trust: [2, 4] }, text: '{fp|이} 반지를 빼려다 그만뒀다.' },
      { label: '"그거 빼고 와"라고 한다', p: { heart: -4, trust: -3 }, text: '{fp|이} 반지를 주머니에 넣었다. 얼굴이 굳어 있었다.' },
    ] },
  { id: 'marriedPhone', type: 'random', on: ['bar', 'home', 'cafe'], age: [20, 50], once: false, cooldown: 3,
    when: (s, a) => a.find(p => p.married && p.marriedKnown && (p.secret || p.fwb || p.fling)).length > 0,
    onStart: (s, a) => { const p = a.find(x => x.married && x.marriedKnown && (x.secret || x.fwb || x.fling))[0]; a.focus(p); s.vars.spw = a.spouseWord(p); },
    text: '{fp}의 휴대폰이 계속 울렸다. 화면에 "{spw}"이라고 떠 있었다.',
    choices: [
      { label: '받으라고 한다', p: { trust: [3, 6] }, text: '{fp|이} 밖에 나가서 받았다. 돌아와서는 아무 말도 하지 않았다.' },
      { label: '휴대폰을 엎어놓는다', p: { heart: [3, 6] }, riskTaken: .12, text: '진동이 몇 번 더 울리다 멈췄다.' },
    ] },

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


  /* ═════ 학교 — 대학 (원서·합격은 js/game.js 학교 턴: 수시 → 수능 → 정시 → 발표, 위 csatEve·pickUniv·retakeChoice) ═════ */
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
      { label: '받아준다', memory: true, scene: 'kiss', effect: { happy: [6, 10] },
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

  /* ═════ 직업별 (v4 확장) ═════ */
  // 편의점
  { id: 'cvsExpired', type: 'fixed', weight: 2.5, when: JOB('cvs'), text: '유통기한이 지난 도시락을 폐기하는 날이다. 아직 멀쩡해 보인다.',
    choices: [
      { label: '몰래 챙겨 간다', karma: -1, text: '저녁이 해결됐다. 조금 찜찜했다.', effect: { happy: 2 } },
      { label: '규칙대로 버린다', karma: 1, text: '아까웠지만 규칙은 규칙이다.' },
    ] },
  { id: 'cvsKidThief', type: 'fixed', weight: 2.5, when: JOB('cvs'), text: '중학생쯤 돼 보이는 아이가 과자를 주머니에 넣는 걸 봤다.',
    choices: [
      { label: '불러서 타이른다', karma: 4, text: '아이가 울면서 과자를 내려놨다. 며칠 뒤 그 아이가 꾸벅 인사하고 지나갔다.', effect: { happy: 2 } },
      { label: '규정대로 신고한다', do: (s, a) => a.perf(4), text: '아이 엄마가 달려와 한참 고개를 숙였다. 마음이 무거웠다.', effect: { happy: -2 } },
      { label: '못 본 척한다', karma: -1, text: '계산대만 내려다봤다.' },
    ] },
  { id: 'cvsStars', type: 'fixed', weight: 2, when: JOB('cvs'), text: '새벽 네 시, 손님 없는 편의점 앞에 나가 하늘을 봤다. 별이 생각보다 많았다.', effect: { happy: 3 } },
  // 배달 라이더
  { id: 'riderLost', type: 'fixed', weight: 2.5, once: false, cooldown: 3, when: JOB('rider'), text: '배달 주소가 틀렸다. 음식이 식어간다.',
    choices: [
      { label: '끝까지 찾아간다', check: { stat: 'fit', diff: 60 },
        success: { text: '골목 끝에서 찾았다. 고객이 별 다섯 개를 줬다.', do: (s, a) => a.perf(5) },
        fail: { text: '30분을 헤맸다. 별 하나가 달렸다.', do: (s, a) => a.perf(-5), effect: { happy: -2 } } },
      { label: '가게에 연락한다', text: '규정대로 처리했다. 오늘 하루가 길었다.' },
    ] },
  { id: 'riderClose', type: 'fixed', weight: 2, when: JOB('rider'), text: '신호를 무시한 차가 코앞을 스쳐 지나갔다. 오토바이를 세우고 한참 숨을 골랐다.', effect: { happy: -3 } },
  { id: 'riderUnion', type: 'fixed', weight: 2, when: JOB('rider'), text: '배달 앱 수수료가 또 올랐다. 라이더들끼리 모임을 만든다고 한다.',
    choices: [
      { label: '모임에 나간다', meet: s => ({ kind: 'coworker', ageRange: [Math.max(20, s.age - 10), s.age + 10], hangout: null, close: 25, trust: 30 }),
        text: '{new|이} 내 옆자리에 앉았다. 다들 사정이 비슷했다.', karma: 1 },
      { label: '묵묵히 콜을 잡는다', text: '콜을 몇 개 더 잡았다.', effect: { money: 30, health: -2 } },
    ] },
  // 바리스타
  { id: 'baristaBean', type: 'fixed', weight: 2.5, when: JOB('barista'), text: '사장님이 새로 들여온 원두를 맛보라고 했다. 솔직히 별로다.',
    choices: [
      { label: '솔직히 말한다', check: { stat: 'art', diff: 80 },
        success: { text: '내 말대로 로스팅을 바꿨다. 손님들 반응이 좋았다.', do: (s, a) => a.perf(8) },
        fail: { text: '사장님 표정이 굳었다.', do: (s, a) => a.perf(-3) } },
      { label: '맛있다고 한다', text: '사장님이 흐뭇해했다. 그 원두는 석 달 동안 팔렸다.' },
    ] },
  { id: 'baristaNumber', type: 'fixed', weight: 2, age: [19, 45], when: JOB('barista'), text: '매일 오는 단골이 컵홀더에 전화번호를 적어 두고 갔다.',
    choices: [
      { label: '연락해본다', meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: peer(s), hangout: 'cafe', close: 22 }),
        do: focusNew, p: { heart: [6, 10] }, text: '{new|이} 답장을 기다렸다는 듯 바로 전화를 걸어왔다.' },
      { label: '못 본 척한다', text: '다음 날 그 손님은 평소처럼 아메리카노를 시켰다.' },
    ] },
  { id: 'baristaBurn', type: 'fixed', weight: 2, when: JOB('barista'), text: '스팀 노즐에 손등을 데었다. 얼음을 대고 마저 일했다.', effect: { health: -3, craft: 1 } },
  // 요리사
  { id: 'cookCritic', type: 'fixed', weight: 2.5, when: JOB('cook'), text: '음식 평론가가 다녀갔다는 소문이 돌았다.',
    choices: [
      { label: '평소대로 만든다', chance: s => .3 + s.stats.craft / 400,
        success: { text: '평이 올라왔다. "다시 가고 싶은 집."', memory: true, effect: { happy: 5 }, do: (s, a) => a.perf(12) },
        fail: { text: '"무난하다." 그 한 줄이 뼈아팠다.', effect: { happy: -4 } } },
      { label: '특별 메뉴를 낸다', check: { stat: 'craft', diff: 130 },
        success: { text: '그 메뉴가 그대로 간판 메뉴가 됐다.', memory: true, effect: { happy: 6 }, do: (s, a) => a.perf(15) },
        fail: { text: '욕심이 과했다. 간이 하나도 안 맞았다.', effect: { happy: -5 }, do: (s, a) => a.perf(-5) } },
    ] },
  { id: 'cookStaffMeal', type: 'fixed', weight: 2, when: JOB('cook'), text: '직원 식사를 내가 맡게 됐다.',
    choices: [
      { label: '정성껏 만든다', text: '다들 한 그릇씩 더 먹었다. 막내가 레시피를 물어봤다.', effect: { craft: [1, 2] }, do: (s, a) => a.perf(4) },
      { label: '라면을 끓인다', text: '아무도 불평하지 않았다. 아무도 칭찬하지도 않았다.' },
    ] },
  { id: 'cookMomDish', type: 'fixed', weight: 2, req: { person: 'mom' }, when: JOB('cook'), text: '엄마한테 배운 반찬을 메뉴에 올려봤다. 손님 하나가 "어릴 때 먹던 맛"이라고 했다.',
    memory: true, effect: { happy: 5, rel: { mom: 4 } }, do: (s, a) => a.perf(6) },
  { id: 'cookFire', type: 'fixed', weight: 2, when: JOB('cook'), text: '불 앞에서 앞치마 끝이 그을렸다. 선배가 웃으며 소화기를 내려놨다.', effect: { health: -2, fit: 1 } },
  // 미용사
  { id: 'hairStory', type: 'fixed', weight: 2.5, when: JOB('hair'), text: '단골 손님이 머리를 하는 내내 이혼 이야기를 했다.',
    choices: [
      { label: '끝까지 들어준다', karma: 2, text: '손님이 거울 속 나를 보며 고맙다고 했다. 팁을 두고 갔다.', effect: { charm: [1, 2], money: 3 }, do: (s, a) => a.perf(4) },
      { label: '자연스럽게 말을 돌린다', text: '날씨 이야기로 넘어갔다. 손님은 조금 서운한 눈치였다.' },
    ] },
  { id: 'hairBride', type: 'fixed', weight: 2, when: JOB('hair'), text: '신부 머리와 화장을 맡게 됐다.',
    choices: [
      { label: '최선을 다한다', check: { stat: 'craft', diff: 100 },
        success: { text: '신부가 거울을 보고 울었다. 화장을 다시 해야 했다.', memory: true, effect: { happy: 5 }, do: (s, a) => a.perf(10) },
        fail: { text: '시간에 쫓겨 손이 떨렸다. 사진에 잔머리가 다 나왔다.', effect: { happy: -4 }, do: (s, a) => a.perf(-5) } },
    ] },
  { id: 'hairSeminar', type: 'fixed', weight: 2, when: JOB('hair'), text: '요즘 유행하는 커트를 배우는 세미나가 열린다.',
    choices: [
      { label: '배우러 간다', if: s => s.money >= 50, text: '새 기술을 배웠다. 손이 근질거렸다.', effect: { money: -50, craft: [3, 5], art: [1, 2] } },
      { label: '하던 대로 한다', text: '단골은 늘 하던 머리를 원했다.' },
    ] },
  { id: 'hairBaby', type: 'fixed', weight: 2, when: JOB('hair'), text: '처음 머리를 자르는 아기가 내내 울었다. 엄마가 첫 머리카락을 봉투에 담아 갔다.', effect: { happy: 3 } },
  // 정비사
  { id: 'mechClassic', type: 'fixed', weight: 2, when: JOB('mechanic'), text: '30년 된 차가 들어왔다. 부품을 구할 데가 없다.',
    choices: [
      { label: '직접 깎아서 만든다', check: { stat: 'craft', diff: 120 },
        success: { text: '시동이 걸렸다. 차 주인이 엔진 소리를 듣고 눈시울을 붉혔다.', memory: true, effect: { craft: [2, 4], happy: 5 }, do: (s, a) => a.perf(12) },
        fail: { text: '부품이 맞지 않았다. 차는 견인차에 실려 나갔다.', do: (s, a) => a.perf(-6) } },
      { label: '못 고친다고 돌려보낸다', text: '차 주인이 아쉬운 얼굴로 돌아갔다.' },
    ] },
  { id: 'mechTow', type: 'fixed', weight: 2, once: false, cooldown: 3, when: JOB('mechanic'), text: '새벽에 고속도로에서 퍼진 차를 끌어오러 출동했다.', effect: { health: -2, money: 30 }, do: (s, a) => a.perf(4) },
  { id: 'mechApprentice', type: 'fixed', weight: 2, age: [28, 50], when: JOB('mechanic'), text: '새로 온 견습생이 자꾸 손을 다친다.',
    choices: [
      { label: '하나하나 가르친다', karma: 2, meet: s => ({ kind: 'coworker', ageRange: [19, 24], hangout: null, close: 30, trust: 30 }),
        text: '{new|이} 내 손놀림을 따라 하기 시작했다.' },
      { label: '알아서 배우게 둔다', text: '견습생은 석 달 만에 그만뒀다.' },
    ] },
  // 사무직
  { id: 'officeTalent', type: 'fixed', weight: 2, when: JOB('office', 'bigco', 'bank'), text: '워크숍에서 장기자랑을 하라고 한다.',
    choices: [
      { label: '한다', check: { stat: 'charm', diff: 70 },
        success: { text: '의외의 반응이 터졌다. 별명이 하나 생겼다.', effect: { charm: [1, 2] }, do: (s, a) => a.perf(3) },
        fail: { text: '분위기가 싸해졌다. 박수 소리가 드문드문했다.', effect: { happy: -4 } } },
      { label: '배가 아프다고 한다', text: '숙소에서 혼자 컵라면을 먹었다.', effect: { happy: -1 } },
    ] },
  { id: 'officeTypo', type: 'fixed', weight: 2.5, when: JOB('office', 'bigco', 'bank', 'civil'), text: '보고서 숫자 하나를 잘못 적어 올렸다. 아직 아무도 모른다.',
    choices: [
      { label: '바로 말한다', karma: 2, text: '팀장이 한숨을 쉬었지만 크게 번지진 않았다.', do: (s, a) => a.perf(-2) },
      { label: '조용히 고쳐서 다시 올린다', chance: .6,
        success: { text: '아무도 몰랐다.' },
        fail: { text: '결국 들통났다. 더 크게 혼났다.', do: (s, a) => a.perf(-10), effect: { happy: -4 } } },
    ] },
  { id: 'bigcoReorg', type: 'fixed', weight: 2, when: JOB('bigco'), text: '조직 개편 소문이 돈다. 우리 팀이 없어진다는 말이 있다.',
    choices: [
      { label: '먼저 다른 팀에 지원한다', check: { stat: 'smart', diff: 150 },
        success: { text: '새 팀에 자리를 잡았다. 오히려 잘된 일이었다.', do: (s, a) => a.perf(5) },
        fail: { text: '지원서가 반려됐다. 팀장 귀에도 들어갔다.', do: (s, a) => a.perf(-6), effect: { happy: -3 } } },
      { label: '버틴다', chance: .5,
        success: { text: '소문으로 끝났다.' },
        fail: { text: '팀이 쪼개졌다. 낯선 부서로 발령이 났다.', effect: { happy: -5 }, do: s => { s.perf = Math.min(s.perf, 20); } } },
    ] },
  { id: 'bigcoAbroad', type: 'fixed', weight: 2, age: [26, 45], when: JOB('bigco', 'dev'), text: '해외 지사 파견 제안이 들어왔다. 2년이다.',
    choices: [
      { label: '간다', memory: true, text: '낯선 도시에서 2년을 보냈다. 돌아오니 동네가 조금 바뀌어 있었다.',
        effect: { money: 1000, smart: [2, 4], charm: [1, 3], happy: 3, rel: { family: -5 } },
        do: (s, a) => { const m = a.main(); if (m) a.changeP(m, { heart: -10, close: -8 }); a.perf(10); } },
      { label: '남는다', text: '가족 곁에 남기로 했다. 가끔 그 도시 사진을 찾아봤다.' },
    ] },
  { id: 'bankDrill', type: 'fixed', weight: 2, when: JOB('bank'), text: '모의 강도 훈련 날, 진짜인 줄 알고 비상벨을 눌렀다. 다들 웃었다. 지점장은 칭찬했다.', effect: { happy: 1 }, do: (s, a) => a.perf(2) },
  { id: 'bankGrandpa', type: 'fixed', weight: 2, when: JOB('bank'), text: '매달 같은 날 오시던 할아버지가 오늘은 안 오셨다.',
    choices: [
      { label: '전화를 드려본다', karma: 5, text: '감기라고 하셨다. 다음 달엔 사탕 한 봉지를 들고 오셨다.', effect: { happy: 3 } },
      { label: '바빠서 잊는다', text: '그 뒤로 할아버지를 다시 보지 못했다.' },
    ] },
  // 프로그래머
  { id: 'devHackathon', type: 'fixed', weight: 2, when: JOB('dev'), text: '사내 해커톤 공지가 올라왔다.',
    choices: [
      { label: '나간다', check: { stat: 'smart', diff: 150 },
        success: { text: '우리 팀이 1등을 했다. 밤샘의 보람이 있었다.', memory: true, effect: { money: 200, happy: 5, health: -2 }, do: (s, a) => a.perf(8) },
        fail: { text: '발표 직전에 서버가 죽었다.', effect: { health: -2, happy: -2 } } },
      { label: '주말엔 쉰다', text: '주말 내내 잠만 잤다.', effect: { health: 2 } },
    ] },
  { id: 'devLegacy', type: 'fixed', weight: 2, when: JOB('dev'), text: '10년 된 코드를 고치라는 업무가 떨어졌다. 주석은 "건드리지 마시오" 한 줄뿐이다.',
    choices: [
      { label: '다 뜯어고친다', chance: .5,
        success: { text: '깔끔해졌다. 다들 박수를 쳤다.', do: (s, a) => a.perf(12) },
        fail: { text: '서비스가 반나절 멈췄다. 주석이 옳았다.', do: (s, a) => a.perf(-8), effect: { happy: -4 } } },
      { label: '조심조심 한 줄만 고친다', text: '아무 일도 일어나지 않았다. 그게 제일 좋은 결과였다.', do: (s, a) => a.perf(3) },
    ] },
  // 디자이너
  { id: 'designFont', type: 'fixed', weight: 2, when: JOB('designer'), text: '클라이언트가 폰트를 궁서체로 바꿔달라고 했다.',
    choices: [
      { label: '설득한다', check: { stat: 'charm', diff: 90 },
        success: { text: '클라이언트가 내 안을 받아들였다.', do: (s, a) => a.perf(6) },
        fail: { text: '결국 궁서체로 나갔다.', effect: { happy: -3 } } },
      { label: '그대로 한다', text: '포트폴리오에서는 빼기로 했다.', effect: { happy: -2 } },
    ] },
  { id: 'designCrash', type: 'fixed', weight: 2, when: JOB('designer'), text: '마감 전날 밤, 작업 파일이 날아갔다.',
    choices: [
      { label: '처음부터 다시 한다', text: '해가 뜰 무렵 다시 완성했다. 처음보다 나았다.', effect: { health: -4, art: [1, 2] }, do: (s, a) => a.perf(6) },
      { label: '마감 연장을 부탁한다', text: '클라이언트가 하루를 줬다. 대신 신뢰를 조금 잃었다.', do: (s, a) => a.perf(-4) },
    ] },
  // 교사
  { id: 'teacherParent', type: 'fixed', weight: 2, when: JOB('teacher'), text: '학부모가 성적 문제로 찾아와 언성을 높였다.',
    choices: [
      { label: '차분하게 설명한다', check: { stat: 'charm', diff: 90 },
        success: { text: '학부모가 결국 고개를 끄덕였다. 돌아가는 길에 미안하다고 했다.', do: (s, a) => a.perf(5) },
        fail: { text: '교육청에 민원이 들어갔다.', effect: { happy: -5 }, do: (s, a) => a.perf(-5) } },
      { label: '교감 선생님께 넘긴다', text: '숨을 돌렸다. 마음은 편치 않았다.' },
    ] },
  { id: 'teacherTrip', type: 'fixed', weight: 2, when: JOB('teacher'), text: '수학여행 인솔. 새벽에 순찰을 돌다 한 방에서 몰래 과자 파티를 하는 걸 봤다.',
    choices: [
      { label: '못 본 척해준다', memory: true, text: '내가 학생일 때가 생각났다. 문을 살짝 닫아줬다.', effect: { happy: 3 } },
      { label: '불을 켠다', text: '아이들이 이불 속으로 숨었다. 다음 날 아침 다들 퉁퉁 부어 있었다.', do: (s, a) => a.perf(2) },
    ] },
  { id: 'teacherDay', type: 'fixed', weight: 2, season: ['봄'], when: JOB('teacher'), text: '스승의 날, 칠판에 삐뚤빼뚤한 글씨가 가득했다.', memory: true, effect: { happy: 6 } },
  // 공무원
  { id: 'civilTyphoon', type: 'fixed', weight: 2, season: ['여름'], when: JOB('civil'), text: '태풍 비상근무. 사흘째 집에 못 갔다.', karma: 3, effect: { health: -5 }, do: (s, a) => a.perf(8) },
  { id: 'civilExam', type: 'fixed', weight: 2, once: false, cooldown: 4, when: JOB('civil'), text: '승진 시험 공고가 떴다.',
    choices: [
      { label: '퇴근하고 공부한다', check: { stat: 'smart', diff: 120 },
        success: { text: '합격했다. 오랜만에 부모님께 자랑할 일이 생겼다.', effect: { happy: 5, health: -2 }, do: (s, a) => a.perf(25) },
        fail: { text: '두 문제 차이로 떨어졌다.', effect: { happy: -4, health: -2 } } },
      { label: '이번엔 넘긴다', text: '저녁이 있는 삶을 택했다.', effect: { happy: 1 } },
    ] },
  { id: 'civilEnvelope', type: 'fixed', weight: 2, when: JOB('civil'), text: '민원인이 서류 사이에 봉투를 끼워 놓고 갔다.',
    choices: [
      { label: '돌려준다', karma: 5, text: '쫓아가서 봉투를 돌려줬다. 민원인이 머쓱해했다.' },
      { label: '모른 척 받는다', karma: -12, heat: 15, text: '봉투가 서랍 속에서 자꾸 신경 쓰였다.', effect: { money: [100, 300] } },
    ] },
  // 간호사
  { id: 'nurseThanks', type: 'fixed', weight: 2, when: JOB('nurse'), text: '퇴원하는 할머니가 손을 꼭 잡고 "간호사 양반 덕에 살았어"라고 했다.', memory: true, effect: { happy: 6 } },
  { id: 'nurseBurnout', type: 'fixed', weight: 2, once: false, cooldown: 3, when: JOB('nurse'), text: '3교대가 계속됐다. 출근길 버스에서 이유 없이 눈물이 났다.',
    choices: [
      { label: '휴가를 낸다', text: '사흘 내내 잤다. 조금 살 것 같았다.', effect: { happy: 4, health: 3 }, do: (s, a) => a.perf(-4) },
      { label: '버틴다', text: '오늘도 병동 불을 켰다.', effect: { health: -5, happy: -3 }, do: (s, a) => a.perf(4) },
    ] },
  { id: 'nurseCPR', type: 'fixed', weight: 2, when: JOB('nurse', 'doctor'), text: '병동에서 심정지 환자가 생겼다. 내가 제일 가까이 있었다.',
    choices: [
      { label: '바로 가슴을 누른다', check: { stat: 'fit', diff: 80 },
        success: { text: '심장이 다시 뛰었다. 한참 동안 손이 떨렸다.', memory: true, effect: { happy: 5 }, do: (s, a) => a.perf(10) },
        fail: { text: '최선을 다했다. 그날 밤은 잠이 오지 않았다.', effect: { happy: -8 } } },
    ] },
  // 의사
  { id: 'doctorCatch', type: 'fixed', weight: 2, when: JOB('doctor'), text: '차트를 보다 선배 의사의 처방 실수를 발견했다.',
    choices: [
      { label: '바로 말한다', karma: 4, text: '선배 얼굴이 굳었지만, 나중에 고맙다고 했다.', do: (s, a) => a.perf(5) },
      { label: '모른 척한다', karma: -10, chance: .7,
        success: { text: '다행히 별일 없이 지나갔다. 마음은 오래 무거웠다.' },
        fail: { text: '환자 상태가 나빠졌다. 그때 말했어야 했다.', memory: true, effect: { happy: -8 } } },
    ] },
  // 기자
  { id: 'reporterThreat', type: 'fixed', weight: 2, when: JOB('reporter'), text: '기사를 내리라는 전화가 왔다. 목소리가 낮고 느렸다.',
    choices: [
      { label: '끝까지 간다', karma: 5, memory: true, text: '기사는 그대로 나갔다. 한동안 퇴근길에 뒤를 돌아봤다.', effect: { happy: -3 }, do: (s, a) => a.perf(12) },
      { label: '수위를 낮춘다', karma: -2, text: '몇 문장을 지웠다. 나머지는 지키지 못했다.', do: (s, a) => a.perf(-3) },
    ] },
  { id: 'reporterHero', type: 'fixed', weight: 2, when: JOB('reporter'), text: '어릴 때부터 동경하던 사람을 인터뷰하게 됐다. 질문지를 열 번은 고쳤다.', memory: true, effect: { happy: 6 }, do: (s, a) => a.perf(6) },
  { id: 'reporterDeadline', type: 'fixed', weight: 2, once: false, cooldown: 3, when: JOB('reporter'), text: '마감 10분 전, 기사 한 문단이 통째로 날아갔다.',
    choices: [
      { label: '기억으로 다시 쓴다', check: { stat: 'smart', diff: 100 },
        success: { text: '9분 만에 다시 썼다. 오히려 문장이 짧고 단단해졌다.', do: (s, a) => a.perf(6) },
        fail: { text: '앞뒤가 안 맞는 채로 나갔다. 데스크에 불려갔다.', do: (s, a) => a.perf(-6) } },
      { label: '데스크에 사정한다', text: '5분을 얻었다. 대신 한 소리 들었다.' },
    ] },
  // 유튜버
  { id: 'creatorCollab', type: 'fixed', weight: 2, when: JOB('creator'), text: '큰 채널에서 합동 방송 제안이 왔다.',
    choices: [
      { label: '한다', check: { stat: 'charm', diff: 120 },
        success: { text: '구독자가 하룻밤 새 두 배가 됐다.', memory: true, effect: { money: [300, 800], charm: [2, 3], happy: 5 } },
        fail: { text: '분위기가 어색했다. 댓글창이 시끄러웠다.', effect: { happy: -3 } } },
      { label: '내 색깔을 지킨다', text: '조용히 내 영상을 올렸다. 오래된 구독자들이 반겨줬다.' },
    ] },
  { id: 'creatorSmile', type: 'fixed', weight: 2, once: false, cooldown: 3, when: JOB('creator'), text: '카메라를 켰는데 웃음이 나오지 않았다.',
    choices: [
      { label: '한 달 쉰다', text: '휴재 공지를 올렸다. 응원 댓글이 생각보다 많았다.', effect: { happy: 6, money: -100 } },
      { label: '억지로 찍는다', text: '편집하면서 내 얼굴을 보기가 힘들었다.', effect: { happy: -4 } },
    ] },
  // 음악가
  { id: 'musicDemo', type: 'fixed', weight: 2, when: JOB('musician'), text: '데모 음원을 기획사 몇 곳에 보냈다.',
    choices: [
      { label: '답장을 기다린다', chance: s => Math.min(.6, s.stats.art / 400),
        success: { text: '연락이 왔다. 떨리는 손으로 계약서에 이름을 적었다.', memory: true, effect: { money: 500, happy: 8 }, do: (s, a) => a.perf(20) },
        fail: { text: '답장은 끝내 오지 않았다.', effect: { happy: -3 } } },
    ] },
  { id: 'musicStolen', type: 'fixed', weight: 2, when: JOB('musician'), text: '내 곡과 똑같은 노래가 음원 차트에 올라왔다.',
    choices: [
      { label: '문제를 제기한다', chance: .5,
        success: { text: '표절이 인정됐다. 작곡가 이름에 내 이름이 올라갔다.', memory: true, effect: { money: [200, 600], happy: 5 } },
        fail: { text: '증거가 부족하다고 했다. 변호사비만 나갔다.', effect: { money: -150, happy: -5 } } },
      { label: '그냥 둔다', text: '다음 곡을 쓰기로 했다. 그래도 그 노래가 나오면 채널을 돌렸다.', effect: { happy: -4 } },
    ] },
  { id: 'musicThree', type: 'fixed', weight: 2, when: JOB('musician'), text: '관객이 셋뿐인 공연. 그중 한 명이 끝까지 울면서 들었다.', memory: true, effect: { happy: 5, art: [1, 3] } },
  /* ═════ 관계 심화 ═════ */
  { id: 'firstAnniv', type: 'fixed', age: [19, 49], once: false, cooldown: 3, weight: 2,
    when: mainIs(m => m.partner && m.since != null), onStart: focusMain,
    text: s => '{fp|와} 사귄 지 꽤 됐다. 내일이 기념일이다.',
    choices: [
      { label: '선물을 준비한다', if: s => s.money >= 30, memory: true, effect: { money: -30, happy: 3 }, p: { heart: [6, 10], close: [3, 5] },
        text: byPers({ shy: '{fp|이} 선물을 받고 한참 말을 못 했다. 집에 가서야 긴 문자가 왔다.', bold: '{fp|이} 그 자리에서 포장을 뜯고 나를 끌어안았다.',
          cool: '{fp|은} "뭘 이런 걸." 하면서도 그 뒤로 매일 그걸 하고 다녔다.', playful: '{fp|이} 몰래 똑같은 선물을 준비해 왔다. 둘 다 웃음이 터졌다.' },
          '{fp|이} 선물을 받고 환하게 웃었다.') },
      { label: '깜빡하고 지나간다', p: { heart: -8, grudge: 6 },
        text: byPers({ sensitive: '{fp|은} 아무 말도 하지 않았다. 그게 더 무서웠다.', sharp: '{fp|이} "괜찮아. 기대 안 했어."라고 했다.' }, '{fp|이} 서운한 티를 감추지 못했다.') },
    ] },
  { id: 'cohabit', type: 'fixed', age: [23, 45], req: { noFlags: ['married'] },
    when: mainIs(m => m.partner && !m.livesWith && m.heart >= 65 && m.trust >= 50), onStart: focusMain,
    text: '{fp|이} 같이 살아보는 게 어떠냐고 했다.',
    choices: [
      { label: '같이 산다', memory: true, set: 'ownPlace', effect: { money: -200, happy: 5 }, p: { close: [6, 10] },
        do: (s, a) => { a.focused().livesWith = true; }, text: '작은 집을 구했다. 칫솔 두 개가 나란히 꽂혔다.' },
      { label: '아직은 따로 살고 싶다', p: { heart: -5 }, text: '{fp|이} 고개를 끄덕였지만 조금 서운해 보였다.' },
    ] },
  { id: 'partnerWorry', type: 'fixed', age: [19, 49], once: false, cooldown: 3,
    when: mainIs(m => m.trust >= 35), onStart: focusMain, text: '{fp|이} 요즘 일 때문에 많이 힘들어 보인다.',
    choices: [
      { label: '밤새 이야기를 들어준다', p: { trust: [6, 10], close: [3, 6] }, text: '{fp|이} 이야기를 하다 말고 울었다. 그 뒤로 조금 가벼워진 얼굴이었다.', effect: { happy: 1 } },
      { label: '"다 그런 거지."라고 한다', p: { trust: -6, heart: -4 }, text: '{fp|이} 더 말하지 않았다.' },
    ] },
  { id: 'jealousy', type: 'random', age: [19, 49], once: false, cooldown: 3,
    when: (s, a) => { const m = a.main(); return m && a.find(p => p !== m && !['family', 'child'].includes(p.kind) && p.gender !== s.gender && p.close >= 40).length > 0; },
    onStart: focusMain, text: '{fp|이} 내 휴대폰에 뜬 이름을 보고 누구냐고 물었다.',
    choices: [
      { label: '솔직하게 설명한다', p: { trust: [2, 5] },
        text: byPers({ sensitive: '{fp|이} 고개를 끄덕였지만, 그날 밤 내 휴대폰을 한 번 더 쳐다봤다.', sunny: '{fp|이} "그 친구도 언제 같이 밥 먹자!"라고 했다.' }, '{fp|이} 알겠다며 웃었다.') },
      { label: '짜증을 낸다', fight: true, p: { trust: -8, grudge: 5 }, text: '"왜 그렇게 예민해?" 말해놓고 바로 후회했다.' },
    ] },
  { id: 'smallFight', type: 'random', age: [19, 50], once: false, cooldown: 2,
    when: (s, a) => !!a.main(), onStart: focusMain,
    text: (s, a) => a.pick(['{fp|와} 설거지 문제로 다퉜다.', '{fp|와} 약속 시간 때문에 다퉜다.', '{fp|와} 별것 아닌 말투 하나로 다퉜다.']),
    choices: [
      { label: '먼저 사과한다', fight: true, p: { close: [3, 5], grudge: -4 }, karma: 1, text: '먼저 손을 내밀었다. {fp|이} 못 이기는 척 잡았다.' },
      { label: '버틴다', fight: true, p: { close: -5, grudge: [4, 8] },
        text: byPers({ bold: '{fp|이} 문을 쾅 닫고 나갔다.', shy: '{fp|이} 방에 들어가 나오지 않았다.', cool: '{fp|은} 아무 일 없다는 듯 TV를 켰다. 그게 더 화가 났다.',
          playful: '{fp|이} 한참 뒤 웃긴 사진을 보내왔다. 화해의 신호였다.', warm: '{fp|이} 다음 날 아침, 내가 좋아하는 반찬을 해놨다.' }, '하루 종일 말을 하지 않았다.') },
    ] },
  { id: 'meetParents', type: 'fixed', age: [24, 45], req: { noFlags: ['married'] },
    when: mainIs(m => m.partner && m.heart >= 60), onStart: focusMain, text: '{fp}의 부모님을 처음 뵙는 날이다.',
    choices: [
      { label: '정장을 입고 간다', check: { stat: 'charm', diff: 70 },
        success: { memory: true, p: { trust: [6, 10] }, text: '어머님이 반찬을 한 보따리 싸주셨다. {fp|이} 돌아오는 내내 웃었다.', effect: { happy: 4 } },
        fail: { p: { trust: -3 }, text: '말실수를 했다. 돌아오는 길이 길었다.', effect: { happy: -3 } } },
      { label: '편하게 간다', chance: .5,
        success: { p: { trust: [3, 6] }, text: '아버님과 축구 이야기로 한참 떠들었다.' },
        fail: { p: { trust: -4 }, text: '어머님이 내 옷차림을 위아래로 훑어보셨다.' } },
    ] },
  { id: 'honeymoon', type: 'fixed', weight: 4, when: mainIs((m, s) => m.spouse && s.age - (s.vars.marriedAt ?? -9) <= 1 && s.age >= 20), onStart: focusMain,
    text: '신혼여행을 떠났다.',
    choices: [
      { label: '바다로', memory: true, effect: { happy: 8, money: -300 }, p: { heart: [6, 10] }, intimate: true, away: true, mood: 25, pregnant: .1,
        text: '매일 저녁 {fp|와} 해변에 앉아 노을이 질 때까지 있었다.' },
      { label: '낯선 도시로', memory: true, effect: { happy: 7, money: -400, art: [1, 3] }, p: { heart: [5, 9] }, intimate: true, away: true, mood: 25, pregnant: .1,
        text: '말도 안 통하는 도시에서 {fp|와} 길을 잃고 또 잃었다. 다 좋았다.' },
      { label: '집에서 쉰다', effect: { happy: 3 }, p: { close: [3, 5] }, text: '돈을 아끼기로 했다. 집에서 배달 음식을 시켜 먹으며 영화를 봤다.' },
    ] },
  { id: 'partnerFriends', type: 'fixed', age: [19, 45], when: mainIs(m => m.partner || m.spouse), onStart: focusMain,
    text: '{fp}의 친구들과 처음으로 저녁을 먹었다.',
    choices: [
      { label: '분위기를 띄운다', check: { stat: 'charm', diff: 60 },
        success: { p: { heart: [3, 6], trust: [3, 5] }, meet: s => ({ kind: 'friend', ageRange: peer(s), hangout: null, close: 25 }),
          text: '다들 금방 친해졌다. {new|이} 다음엔 따로 보자고 했다.' },
        fail: { text: '아는 이야기가 하나도 없었다. 혼자 겉돌았다.', effect: { happy: -3 } } },
      { label: '조용히 웃기만 한다', text: '{fp|이} 테이블 아래로 내 손을 잡아줬다.', p: { close: [2, 3] } },
    ] },
  { id: 'forgotBirthday', type: 'random', age: [19, 50], once: false, cooldown: 4,
    when: (s, a) => !!a.main(), onStart: focusMain, text: '{fp}의 생일을 깜빡했다. 자정까지 3분 남았다.',
    choices: [
      { label: '편의점으로 뛴다', p: { heart: [1, 3] }, text: '편의점 케이크에 초를 꽂았다. {fp|이} 어이없다는 듯 웃었다.' },
      { label: '내일 챙긴다', p: { heart: -8, grudge: 6 }, text: '다음 날 선물을 내밀었지만 {fp}의 표정은 풀리지 않았다.' },
    ] },
  { id: 'longDistance', type: 'fixed', age: [22, 45], when: mainIs(m => m.partner && !m.livesWith), onStart: focusMain,
    text: '{fp|이} 먼 지방으로 발령이 났다.',
    choices: [
      { label: '주말마다 내려간다', effect: { money: -100, health: -1 }, p: { heart: [4, 8], close: [3, 5] },
        text: '금요일 밤 기차가 일상이 됐다. 역 앞에서 기다리는 {fp|이} 늘 손을 흔들었다.', memory: true },
      { label: '이참에 생각할 시간을 갖자고 한다', p: { heart: [-15, -10], close: -6 }, text: '전화가 점점 짧아졌다.' },
    ] },
  { id: 'partnerFlu', type: 'random', age: [19, 50], once: false, cooldown: 4, when: (s, a) => !!a.main(), onStart: focusMain,
    text: '{fp|이} 독감으로 앓아누웠다.',
    choices: [
      { label: '죽을 끓여 간다', karma: 1, p: { trust: [4, 7], heart: [2, 5] }, text: '{fp|이} 열에 들뜬 얼굴로 "맛있다"고 했다. 간이 하나도 안 돼 있었다.' },
      { label: '전화로 안부만 묻는다', p: { close: -2 }, text: '"괜찮아, 자면 나아." 목소리가 많이 잠겨 있었다.' },
    ] },
  { id: 'shelterDog', type: 'fixed', age: [22, 48], req: { noFlags: ['pet'] }, when: mainIs(m => m.heart >= 55 && (m.livesWith || m.spouse)), onStart: focusMain,
    text: '{fp|와} 유기견 보호소에 갔다. 한 녀석이 계속 눈에 밟혔다.',
    choices: [
      { label: '데려가자', set: 'pet', memory: true, effect: { happy: 6 }, p: { close: [4, 6] },
        do: (s, a) => { s.vars.petName = a.pick(GAME_DATA.dogNames); }, text: '{petName|이라는} 이름을 지어줬다. 첫날 밤, 우리 사이에 끼어서 잤다.' },
      { label: '아직은 무리야', text: '돌아오는 차 안이 조용했다.' },
    ] },
  { id: 'petWalk', type: 'random', on: ['park', 'walk', 'home'], once: false, cooldown: 3, req: { flags: ['pet'] },
    text: '{petName|와} 산책을 나갔다. 내가 끌려가는 건지 데려가는 건지 모르겠다.', effect: { happy: 3, health: 1 } },
  { id: 'partnerJobless', type: 'random', age: [22, 50], once: false, cooldown: 6, when: (s, a) => !!a.main(), onStart: focusMain,
    text: '{fp|이} 회사를 그만두게 됐다고 했다.',
    choices: [
      { label: '당분간 내가 책임질게', if: s => s.money >= 200, effect: { money: -200 }, p: { trust: [8, 12], heart: [3, 6] }, text: '{fp|이} 고맙다는 말 대신 오래 안고 있었다.' },
      { label: '걱정돼서 잔소리를 한다', p: { trust: -5, grudge: 3 }, text: '말하고 나니 내가 더 불안했던 것 같다.' },
    ] },
  { id: 'firstTrip', type: 'fixed', age: [19, 45], when: mainIs(m => m.partner && m.heart >= 50), onStart: focusMain,
    text: '{fp|와} 처음으로 둘이 여행을 떠났다.', memory: true, effect: { happy: 6, money: -50 }, p: { heart: [5, 9], close: [4, 6] } },
  { id: 'friendLoveTalk', type: 'random', age: [15, 50], once: false, cooldown: 3,
    when: (s, a) => friends(a).some(p => p.close >= 50 && a.npcAge(p) >= 15), onStart: (s, a) => a.focus(a.pick(friends(a).filter(p => p.close >= 50 && a.npcAge(p) >= 15))),
    text: '{fp|이} 연애 상담을 해왔다. 벌써 세 시간째다.',
    choices: [
      { label: '끝까지 들어준다', p: { trust: [5, 8] }, text: '결론은 처음과 똑같았다. 그래도 {fp|이} 후련해했다.' },
      { label: '내 얘기로 넘어간다', p: { close: -4 }, text: '{fp|이} 말끝을 흐렸다.' },
    ] },
  { id: 'friendDrift', type: 'fixed', age: [26, 48],
    when: (s, a) => adultFriends(a).some(p => p.close >= 55 && p.taken), onStart: (s, a) => a.focus(adultFriends(a).find(p => p.close >= 55 && p.taken)),
    text: '{fp|이} 연애를 시작하고 나서 연락이 뜸해졌다.',
    choices: [
      { label: '먼저 연락한다', p: { close: [6, 10] }, text: '"야, 살아 있냐?" 오 분 만에 답장이 왔다.' },
      { label: '그럴 때도 있지', p: { close: -6 }, text: '단톡방에서만 가끔 이름을 봤다.' },
    ] },
  { id: 'friendLoan', type: 'fixed', age: [27, 50], req: { minMoney: 500 },
    when: (s, a) => adultFriends(a).some(p => p.close >= 55), onStart: (s, a) => a.focus(adultFriends(a).find(p => p.close >= 55)),
    text: '{fp|이} 가게를 차린다며 500만원을 빌려달라고 했다.',
    choices: [
      { label: '빌려준다', chance: .55,
        success: { text: '반년 만에 갚았다. 고맙다며 이자까지 얹어 줬다.', effect: { money: 50 }, p: { trust: [8, 12], close: [4, 6] } },
        fail: { text: '가게는 석 달 만에 문을 닫았다. 돈 얘기를 꺼낼 수 없었다.', effect: { money: -500, happy: -5 }, p: { close: -10, trust: -10 } } },
      { label: '거절한다', p: { close: -8 }, text: '{fp|이} 괜찮다고 했다. 그 뒤로 조금 서먹해졌다.' },
    ] },
  { id: 'guiltyTender', type: 'fixed', age: [19, 49],
    when: (s, a) => !!a.main() && a.find(p => p.secret).length > 0, onStart: focusMain,
    text: '오늘따라 {fp|이} 유난히 다정했다. 괜히 목이 메었다.',
    choices: [
      { label: '다 털어놓는다', chance: (s, a) => (a.focused() || { trust: 0 }).trust / 140, memory: true,
        success: { text: '긴 침묵 끝에 {fp|이} 내 손을 잡았다. 다른 사람과는 정리했다.',
          do: (s, a) => { a.find(p => p.secret).forEach(p => a.breakUp(p, 20)); a.changeP(a.focused(), { trust: -20, heart: -10 }); } },
        fail: { text: '{fp|은} 아무 말 없이 짐을 쌌다.', do: (s, a) => a.endMain(40) } },
      { label: '아무 말도 하지 않는다', karma: -3, effect: { happy: -3 }, text: '{fp}의 손을 잡았다. 따뜻해서 더 괴로웠다.' },
    ] },
  { id: 'exWedding', type: 'random', age: [22, 49], once: false, cooldown: 5,
    when: (s, a) => a.find(p => p.ex && !p.taken && !lover(p)).length > 0, onStart: (s, a) => a.focus(a.find(p => p.ex && !p.taken && !lover(p))[0]),
    text: 'SNS에서 {fp}의 결혼 소식을 봤다.',
    choices: [
      { label: '축하 메시지를 보낸다', karma: 2, do: (s, a) => { a.focused().taken = true; }, text: '"고마워. 너도 행복해." 답장이 짧았다.', effect: { happy: -1 } },
      { label: '조용히 창을 닫는다', do: (s, a) => { a.focused().taken = true; }, text: '그날은 일찍 잤다.', effect: { happy: -3 } },
    ] },
  { id: 'oldStreet', type: 'fixed', age: [32, 50], when: mainIs(m => m.spouse && m.heart >= 50), onStart: focusMain,
    text: '{fp|와} 처음 데이트했던 동네를 지나갔다. 그 가게가 아직 있었다.', memory: true, effect: { happy: 4 }, p: { heart: [5, 8] } },
  { id: 'publicFight', type: 'random', on: ['cafe', 'mall', 'bar'], age: [19, 50], once: false, cooldown: 4,
    when: (s, a) => { const m = a.main(); return m && a.isHere(m); }, onStart: focusMain,
    text: '{fp|와} 이야기하다 언성이 높아졌다. 다들 쳐다봤다.',
    choices: [
      { label: '밖으로 나가서 이야기하자고 한다', fight: true, p: { close: [1, 3] }, text: '찬바람을 맞으니 둘 다 조금 누그러졌다.' },
      { label: '끝까지 따진다', fight: true, p: { close: -6, grudge: 6 }, text: '{fp|이} 먼저 자리를 박차고 나갔다.' },
    ] },
  { id: 'bumpIntoLover', type: 'random', on: NOT_ROUTINE, age: [19, 50], once: false, cooldown: 3,
    when: (s, a) => { const m = a.main(); return m && a.isHere(m); }, onStart: focusMain,
    text: '약속도 안 했는데 {place}에서 {fp|와} 마주쳤다. 둘 다 크게 웃었다.', p: { heart: [3, 5] }, effect: { happy: 2 } },
  { id: 'loverTreat', type: 'random', age: [19, 50], once: false, cooldown: 2, when: mainIs(m => m.heart >= 50), onStart: focusMain,
    text: byPers({ warm: '{fp|이} 퇴근길에 내가 좋아하는 붕어빵을 사 왔다.', cool: '{fp|이} 말없이 내 신발 끈을 다시 묶어줬다.', playful: '{fp|이} 내 사진으로 이상한 이모티콘을 만들어 보냈다.',
      bold: '{fp|이} 사람들 앞에서 내 손을 덥석 잡았다.', shy: '{fp|이} 손편지를 내 가방에 몰래 넣어놨다.', sharp: '{fp|이} 내가 지나가듯 말한 책을 사다 놨다.',
      sunny: '{fp|이} 아침부터 노래를 불러줬다. 음정은 엉망이었다.', sensitive: '{fp|이} 내가 피곤한 걸 알아채고 먼저 불을 꺼줬다.' }, '{fp|이} 작은 선물을 건넸다.'),
    p: { heart: [2, 4], close: [1, 3] }, effect: { happy: 2 } },
  /* ═════ 가족 ═════ */
  { id: 'dadRetire', type: 'fixed', age: [28, 46], req: { person: 'dad' }, text: '아빠가 정년퇴직을 하셨다. 마지막 출근 날 꽃다발을 들고 들어오셨다.',
    choices: [
      { label: '부모님 여행을 보내드린다', if: s => s.money >= 200, memory: true, effect: { money: -200, happy: 4, rel: { family: 8 } }, text: '공항에서 엄마가 아빠 팔짱을 끼는 걸 봤다. 처음 보는 모습이었다.' },
      { label: '저녁을 같이 먹는다', effect: { rel: { dad: 5 } }, text: '아빠가 "이제 뭐 하고 살지." 하며 웃으셨다. 웃음이 조금 쓸쓸했다.' },
    ] },
  { id: 'siblingHired', type: 'fixed', age: [16, 45], when: (s, a) => sibs(a).some(p => a.npcAge(p) >= 24 && a.npcAge(p) <= 30),
    onStart: (s, a) => a.focus(sibs(a).find(p => a.npcAge(p) >= 24 && a.npcAge(p) <= 30)),
    text: '{fp|이} 드디어 취업했다며 한턱 쏘겠다고 했다. 고기를 굽는 손이 신나 보였다.', p: { close: [4, 6] }, effect: { happy: 2 } },
  { id: 'nephew', type: 'fixed', age: [20, 50], when: (s, a) => sibs(a).some(p => a.npcAge(p) >= 28 && p.taken),
    onStart: (s, a) => a.focus(sibs(a).find(p => a.npcAge(p) >= 28 && p.taken)),
    text: (s, a) => { const p = a.focused(); const t = s.gender === 'f' ? (p.gender === 'm' ? '고모' : '이모') : (p.gender === 'm' ? '삼촌' : '외삼촌'); return `{fp|이} 아이를 낳았다. 내가 ${a.josa(t, '이')} 됐다.`; },
    memory: true, p: { close: [4, 8] }, effect: { happy: 4 } },
  { id: 'siblingMoneyFight', type: 'fixed', age: [26, 50], req: { person: 'mom' }, when: (s, a) => sibs(a).some(p => a.npcAge(p) >= 24),
    onStart: (s, a) => a.focus(sibs(a).find(p => a.npcAge(p) >= 24)), text: '{fp|와} 부모님 용돈 문제로 언성이 높아졌다.',
    choices: [
      { label: '내가 더 내겠다고 한다', effect: { money: -100 }, p: { close: [5, 8] }, karma: 2, text: '{fp|이} 미안하다며 다음 명절 장은 자기가 보겠다고 했다.' },
      { label: '똑같이 하자고 한다', p: { close: -5, grudge: 5 }, text: '말은 맞는데, 둘 다 기분이 상했다.' },
    ] },
  { id: 'holiday', type: 'fixed', age: [20, 50], season: ['가을', '겨울'], once: false, cooldown: 2, when: (s, a) => !!(a.person('mom') || a.person('dad')),
    text: '명절이다.',
    choices: [
      { label: '본가에 간다', effect: { money: -30, rel: { family: 4 } },
        text: (s, a) => s.flags.married ? (a.find(p => p.kind === 'child').length ? '"애들 많이 컸네." 엄마가 아이들 볼을 쓰다듬었다.' : '"애는 언제 가질 거니?" 질문이 세 번 나왔다.')
          : '"결혼은 언제 하니?" 질문이 세 번 나왔다. 송편은 맛있었다.' },
      { label: '이번엔 쉰다', effect: { happy: 2, rel: { family: -4 } }, text: '전화로 인사만 드렸다. 혼자 먹는 전도 나쁘지 않았다.' },
      { label: '여행을 떠난다', if: s => s.money >= 300, effect: { money: -300, happy: 6, rel: { family: -2 } }, text: '공항이 사람으로 꽉 차 있었다. 다들 같은 생각이었다.' },
    ] },
  { id: 'momSurgery', type: 'fixed', age: [28, 50], req: { person: 'mom' }, text: '엄마가 수술을 받으신다는 연락이 왔다.',
    choices: [
      { label: '휴가를 내고 곁을 지킨다', memory: true, effect: { money: -100, rel: { mom: 10 }, health: -2 }, text: '수술실 앞에서 네 시간을 기다렸다. 마취에서 깬 엄마가 제일 먼저 내 밥 걱정을 했다.' },
      { label: '간병인을 구해드린다', if: s => s.money >= 300, effect: { money: -300, rel: { mom: 2 } }, text: '퇴근길에 병원에 들렀다. 엄마는 괜찮다며 빨리 가라고 했다.' },
    ] },
  { id: 'kidSteps', type: 'fixed', weight: 3, when: (s, a) => !!kidAt(a, 1), onStart: (s, a) => a.focus(kidAt(a, 1)),
    text: '{fp|이} 처음으로 걸음마를 뗐다. 세 걸음 만에 내 품으로 넘어졌다.', memory: true, effect: { happy: 6 }, p: { close: [3, 5] } },
  { id: 'kidRecital', type: 'fixed', once: false, cooldown: 3, when: (s, a) => kidsAged(a, 7, 11).length > 0, onStart: (s, a) => a.focus(a.pick(kidsAged(a, 7, 11))),
    text: '{fp}의 학예회 날이다.',
    choices: [
      { label: '반차를 내고 간다', memory: true, p: { close: [6, 10] }, text: '무대 위 {fp|이} 나를 찾아내고 손을 흔들었다. 대사는 까먹었다.', effect: { happy: 4 } },
      { label: '일이 바빠 못 간다', p: { close: -6 }, text: '저녁에 영상으로 봤다. {fp|이} 자꾸 객석 쪽을 두리번거렸다.' },
    ] },
  { id: 'kidReport', type: 'fixed', once: false, cooldown: 3, when: (s, a) => kidsAged(a, 13, 17).length > 0, onStart: (s, a) => a.focus(a.pick(kidsAged(a, 13, 17))),
    text: '{fp}의 성적표가 나왔다. 반에서 뒤에서 세는 게 빨랐다.',
    choices: [
      { label: '혼낸다', p: { close: -6, grudge: 4 }, text: '{fp|이} 방문을 쾅 닫았다.' },
      { label: '같이 계획을 세운다', p: { close: [3, 5] }, text: '{fp|이} 귀찮아하면서도 끝까지 앉아 있었다.' },
      { label: '괜찮다고 안아준다', p: { close: [5, 8] }, text: '{fp|이} 어깨를 들썩였다. 나도 그 나이 땐 그랬다.' },
    ] },
  { id: 'kidPuberty', type: 'fixed', when: (s, a) => kidsAged(a, 13, 15).length > 0, onStart: (s, a) => a.focus(a.pick(kidsAged(a, 13, 15))),
    text: '{fp|이} 방문을 닫고 나오지 않는다. 대답은 "몰라"와 "됐어" 두 개뿐이다.',
    choices: [
      { label: '문 앞에 간식을 두고 간다', p: { close: [3, 6] }, text: '다음 날 빈 접시 위에 "ㄱㅅ" 두 글자가 적힌 포스트잇이 있었다.' },
      { label: '문을 두드려 이야기하자고 한다', chance: .45,
        success: { p: { close: [5, 8], trust: [3, 5] }, text: '{fp|이} 한참 만에 문을 열었다. 친구 이야기를 했다.' },
        fail: { p: { close: -4 }, text: '"아 진짜, 나가라고!"' } },
    ] },
  { id: 'kidCrush', type: 'fixed', when: (s, a) => kidsAged(a, 15, 18).length > 0, onStart: (s, a) => a.focus(a.pick(kidsAged(a, 15, 18))),
    text: '{fp|이} 밥 먹다 말고 휴대폰을 보며 혼자 웃는다. 모른 척해주기로 했다.', effect: { happy: 2 } },
  { id: 'kidFever', type: 'random', once: false, cooldown: 3, when: (s, a) => kidsAged(a, 1, 9).length > 0, onStart: (s, a) => a.focus(a.pick(kidsAged(a, 1, 9))),
    text: '{fp|이} 밤새 열이 펄펄 났다.',
    choices: [
      { label: '응급실로 간다', effect: { money: -20, health: -2 }, p: { close: [4, 6] }, text: '새벽 세 시 응급실. {fp|이} 내 옷자락을 꼭 쥐고 잠들었다.' },
      { label: '해열제를 먹이고 지켜본다', chance: .75,
        success: { p: { close: [2, 4] }, text: '아침이 되자 열이 내렸다. 내가 더 지쳐 있었다.', effect: { health: -1 } },
        fail: { text: '열이 내리지 않아 결국 병원에 갔다. 진작 갈걸.', effect: { money: -30, happy: -3 } } },
    ] },
  { id: 'kidCollege', type: 'fixed', weight: 2, when: (s, a) => kidsAged(a, 19, 19).length > 0, onStart: (s, a) => a.focus(kidsAged(a, 19, 19)[0]),
    text: '{fp|이} 대학에 붙었다. 등록금 고지서와 함께.', memory: true, effect: { happy: 8, money: -400 }, p: { close: [3, 5] } },
  { id: 'kidMoveOut', type: 'fixed', when: (s, a) => kidsAged(a, 21, 25).length > 0, onStart: (s, a) => a.focus(a.pick(kidsAged(a, 21, 25))),
    text: '{fp|이} 독립하겠다며 짐을 쌌다. 빈 방에 한참 서 있었다.', memory: true, effect: { happy: -3 }, p: { close: [3, 5] } },
  { id: 'momBirthday', type: 'fixed', age: [15, 50], once: false, cooldown: 3, req: { person: 'mom' }, text: '엄마 생신이다.',
    choices: [
      { label: '케이크를 사 들고 간다', effect: { money: -5, rel: { mom: 5 } }, text: '엄마가 초를 끄기 전에 사진부터 찍으라고 했다.' },
      { label: '용돈을 보낸다', if: s => s.age >= 20, effect: { money: -50, rel: { mom: 3 } }, text: '"돈 쓰지 말라니까." 목소리는 웃고 있었다.' },
      { label: '전화만 드린다', effect: { rel: { mom: -2 } }, text: '통화가 생각보다 짧게 끝났다.' },
    ] },
  { id: 'dadSoju', type: 'fixed', age: [21, 45], req: { person: 'dad' }, text: '아빠가 소주 한잔하자고 하셨다.',
    choices: [
      { label: '따라간다', memory: true, effect: { rel: { dad: 8 }, health: -1 }, text: '아빠가 처음으로 젊었을 때 이야기를 하셨다. 나도 모르던 아빠였다.' },
      { label: '피곤하다고 한다', effect: { rel: { dad: -3 } }, text: '아빠가 "그래, 쉬어라." 하고 혼자 TV를 켜셨다.' },
    ] },
  { id: 'familyTrip', type: 'fixed', age: [5, 14], season: ['여름'], req: { person: 'mom' }, text: '가족 여행을 갔다. 차 안에서 다 같이 노래를 불렀다. 아빠는 가사를 다 틀렸다.',
    memory: true, effect: { happy: 5, rel: { family: 4 } } },
  { id: 'grandmaFuneral', type: 'fixed', age: [10, 32], text: '할머니가 돌아가셨다. 장례식장에서 처음으로 아빠가 우는 걸 봤다.', memory: true, effect: { happy: -8, rel: { dad: 4 } } },
  { id: 'parentsMove', type: 'fixed', age: [33, 48], req: { person: 'mom' }, text: '부모님이 고향으로 내려가서 사시겠다고 했다.',
    choices: [
      { label: '자주 찾아뵙겠다고 한다', effect: { rel: { family: 3 } }, text: '이삿날, 텅 빈 내 어릴 적 방을 한참 둘러봤다.', memory: true },
      { label: '가까이 계시라고 말린다', chance: .4,
        success: { text: '부모님이 마음을 바꾸셨다. 우리 집 근처로 이사 오셨다.', effect: { rel: { family: 5 } } },
        fail: { text: '부모님 뜻은 확고했다.', effect: { rel: { family: -2 } } } },
    ] },
  { id: 'momRecipe', type: 'fixed', age: [22, 48], req: { person: 'mom' }, text: '엄마한테 김치찌개 끓이는 법을 물어봤다. "그냥 대충 넣어." 그 대충이 제일 어렵다.',
    effect: { craft: 1, rel: { mom: 3 } } },
  /* ═════ 건강 ═════ */
  { id: 'backPain', type: 'fixed', age: [30, 50], once: false, cooldown: 5, text: '아침에 일어나는데 허리가 끊어질 것 같았다.',
    choices: [
      { label: '병원에 간다', effect: { money: -50, health: 4 }, text: '디스크 초기라고 했다. 의자부터 바꿨다.' },
      { label: '파스를 붙이고 버틴다', effect: { health: -4 }, text: '파스 냄새가 하루 종일 따라다녔다.' },
    ] },
  { id: 'insomnia', type: 'random', age: [18, 50], once: false, cooldown: 3, text: '며칠째 잠이 오지 않는다.',
    choices: [
      { label: '휴대폰을 멀리 둔다', effect: { health: 2, happy: 1 }, text: '사흘째 되던 날, 자다가 알람 소리를 못 들었다.' },
      { label: '술 한잔하고 잔다', if: s => s.age >= 19, effect: { health: -2, happy: 1 }, text: '잠은 들었는데 개운하지 않았다.' },
    ] },
  { id: 'burnout', type: 'fixed', age: [25, 50], once: false, cooldown: 4, req: { job: true }, when: s => s.stats.happy < 55, text: '아침에 눈을 떴는데 출근할 힘이 하나도 없었다.',
    choices: [
      { label: '휴가를 낸다', effect: { happy: 6, health: 2 }, do: (s, a) => a.perf(-5), text: '아무것도 안 했다. 그게 필요했다.' },
      { label: '버틴다', effect: { health: -5, happy: -4 }, text: '모니터 앞에서 하루가 흐릿하게 지나갔다.' },
    ] },
  { id: 'cholesterol', type: 'fixed', age: [32, 50], text: '건강검진 결과지에 빨간 글씨가 몇 줄 있었다. 콜레스테롤이 높다고 한다.',
    choices: [
      { label: '식단을 바꾼다', effect: { health: 5, happy: -2 }, text: '라면을 끊었다. 대신 두부를 많이 먹었다.' },
      { label: '다음 검진 때 보자', effect: { health: -3 }, text: '결과지를 서랍에 넣었다.' },
    ] },
  { id: 'appendix', type: 'random', age: [12, 50],
    text: (s, a) => a.main() ? '배가 칼로 찌르듯 아팠다. 맹장이 터져서 응급 수술을 받았다. {partner|이} 밤새 병실을 지켰다.'
      : s.age < 20 ? '배가 칼로 찌르듯 아팠다. 맹장이 터져서 응급 수술을 받았다. 엄마가 밤새 병실을 지켰다.' : '배가 칼로 찌르듯 아팠다. 맹장이 터져서 응급 수술을 받았다. 혼자 수술 동의서에 사인했다.',
    effect: s => ({ health: -10, money: s.age >= 18 ? -50 : 0 }), memory: true,
    do: (s, a) => { const m = a.main(); if (m) a.changeP(m, { close: 5, trust: 3 }); } },
  { id: 'firstSmoke', type: 'fixed', age: [17, 30], text: '선배가 담배를 권했다.',
    choices: [
      { label: '피워본다', set: 'smoker', effect: { health: -2, happy: 1 }, text: '콜록거리면서도 한 대를 다 피웠다. 어른이 된 기분은 아니었다.' },
      { label: '거절한다', text: '"안 피워요." 선배가 머쓱하게 웃었다.' },
    ] },
  { id: 'smokerCough', type: 'fixed', age: [25, 50], once: false, cooldown: 3, req: { flags: ['smoker'] }, text: '계단 몇 층을 올랐을 뿐인데 숨이 찼다.',
    choices: [
      { label: '담배를 끊는다', chance: .45,
        success: { unset: 'smoker', memory: true, text: '한 달째 안 피우고 있다. 공기 맛이 달라졌다.', effect: { health: 6, happy: 2 } },
        fail: { text: '사흘 만에 편의점에서 다시 샀다.', effect: { health: -2, happy: -2 } } },
      { label: '아직은 아니다', effect: { health: -4 }, text: '한 대 피우고 마저 올라갔다.' },
    ] },
  { id: 'wisdomTooth', type: 'random', on: ['hospital', 'doctor'], age: [16, 35], text: '사랑니를 뽑았다. 볼이 호빵처럼 부어올랐다.', effect: { health: -1, happy: -2 } },
  { id: 'farsighted', type: 'fixed', age: [42, 50], text: '휴대폰 글씨가 흐릿하다. 팔을 쭉 뻗어야 읽힌다. 돋보기를 샀다.', effect: { happy: -2 } },
  { id: 'diet', type: 'fixed', age: [17, 45], once: false, cooldown: 4, text: '다이어트를 하기로 결심했다.',
    choices: [
      { label: '식단과 운동을 같이 한다', check: { stat: 'fit', diff: 60 },
        success: { text: '석 달 만에 바지가 헐렁해졌다.', effect: { fit: [3, 5], style: [4, 8], health: [2, 4], happy: 3 } },
        fail: { text: '2주째 밤, 치킨 앞에서 무너졌다.', effect: { happy: -2 } } },
      { label: '내일부터', text: '내일도 내일부터였다.', effect: { happy: 1 } },
    ] },
  { id: 'blueDays', type: 'fixed', age: [16, 50], once: false, cooldown: 3, when: s => s.stats.happy < 35, text: '모든 게 다 귀찮다. 이불 밖으로 나가기가 싫다.',
    choices: [
      { label: '상담을 받아본다', effect: { money: -30, happy: 8 }, memory: true, text: '말하고 나니 조금 가벼워졌다. 생각보다 괜찮은 사람이었다, 나는.' },
      { label: '누군가에게 전화를 건다', if: (s, a) => friends(a).some(p => p.close >= 40), do: (s, a) => a.focus(friends(a).sort((x, y) => y.close - x.close)[0]),
        p: { close: [4, 6], trust: [3, 5] }, effect: { happy: 5 }, text: '{fp|이} 아무것도 묻지 않고 한 시간을 들어줬다.' },
      { label: '혼자 버틴다', effect: { happy: -3 }, text: '창밖이 어두워질 때까지 누워 있었다.' },
    ] },
  { id: 'winterCold', type: 'random', season: ['겨울'], age: [4, 50], once: false, cooldown: 2, text: '한파에 감기가 독하게 걸렸다. 목소리가 나오지 않았다.', effect: { health: -4 } },
  { id: 'heatstroke', type: 'random', season: ['여름'], on: ['exercise', 'walk', 'park', 'play'], once: false, cooldown: 3, text: '땡볕 아래 오래 있다가 어지러워서 주저앉았다.', effect: { health: -4 } },
  { id: 'marathon', type: 'fixed', age: [20, 48], when: s => s.stats.fit >= 100, text: '마라톤 대회 참가 신청을 했다.',
    choices: [
      { label: '풀코스에 도전한다', check: { stat: 'fit', diff: 140 },
        success: { memory: true, text: '결승선을 넘자 다리가 풀렸다. 완주 메달이 묵직했다.', effect: { happy: 8, health: 3 } },
        fail: { text: '30km에서 멈췄다. 그래도 거기까지 뛰었다.', effect: { happy: 2, health: -2 } } },
      { label: '10km만 뛴다', text: '가볍게 완주했다. 바나나가 맛있었다.', effect: { happy: 3, fit: [1, 2] } },
    ] },
  /* ═════ 돈 ═════ */
  { id: 'jeonseScam', type: 'fixed', age: [24, 45], req: { minMoney: 3000, noFlags: ['married'] }, text: '전셋집 계약을 앞두고 있다. 집주인이 오늘 안에 도장을 찍자고 재촉한다.',
    choices: [
      { label: '등기부등본부터 확인한다', text: '근저당이 잔뜩 잡혀 있었다. 계약하지 않았다. 등골이 서늘했다.', effect: { smart: 1 } },
      { label: '믿고 계약한다', chance: .5,
        success: { text: '무사히 이사했다. 집이 넓어졌다.', set: 'ownPlace', effect: { happy: 4 } },
        fail: { text: '전세 사기였다. 집주인은 연락이 끊겼고 보증금이 날아갔다.', memory: true, effect: { money: -2000, happy: -12 } } },
    ] },
  { id: 'stockCrash', type: 'fixed', age: [26, 50], req: { flags: ['stocks'] }, once: false, cooldown: 5, text: '주식 시장이 폭락했다. 빨간 숫자가 파란 숫자로 다 바뀌었다.',
    choices: [
      { label: '손절한다', effect: { money: -300, happy: -4 }, text: '눈을 질끈 감고 팔았다. 다음 날 조금 올랐다.' },
      { label: '버틴다', chance: .5,
        success: { text: '반년을 버텼다. 결국 다시 올랐다.', effect: { money: 500, happy: 4 } },
        fail: { text: '반토막이 났다. 앱을 지웠다.', effect: { money: -1200, happy: -8 } } },
    ] },
  { id: 'lottoTicket', type: 'random', on: ['conveni', 'snack'], age: [19, 50], once: false, cooldown: 3, text: '편의점 계산대 옆에 복권이 보였다.',
    choices: [
      { label: '한 장 산다', chance: .06,
        success: { text: '3등에 당첨됐다! 손이 덜덜 떨렸다.', memory: true, effect: { money: 150, happy: 8 } },
        fail: { text: '꽝이었다. 다음 주를 기약했다.', effect: { money: -1 } } },
      { label: '안 산다', text: '그 돈으로 바나나우유를 샀다.' },
    ] },
  { id: 'distantInherit', type: 'fixed', age: [30, 50], text: '얼굴도 가물가물한 먼 친척 어른이 돌아가시며 내 앞으로 재산을 조금 남기셨다.',
    memory: true, effect: { money: [500, 3000], happy: 3 } },
  { id: 'debtCollector', type: 'fixed', age: [22, 50], once: false, cooldown: 3, when: s => s.money < -1500, text: '빚 독촉 전화가 하루에 열 통씩 온다.',
    choices: [
      { label: '부모님께 손을 벌린다', if: (s, a) => !!(a.person('mom') || a.person('dad')), effect: { money: 800, happy: -4, rel: { family: -6 } }, text: '엄마가 적금을 깼다고 했다. 고개를 들 수가 없었다.' },
      { label: '대출을 더 받는다', effect: { money: 1000, happy: -6 }, text: '빚으로 빚을 막았다. 숫자만 커졌다.' },
      { label: '개인회생을 신청한다', memory: true, do: s => { s.money = Math.round(s.money / 2); }, effect: { happy: -4 }, text: '서류를 내고 법원을 나섰다. 다시 시작하기로 했다.' },
    ] },
  { id: 'phishing', type: 'random', age: [25, 50], once: false, cooldown: 6, text: '검찰이라는 사람에게서 전화가 왔다. 내 계좌가 범죄에 쓰였다고 한다.',
    choices: [
      { label: '끊고 직접 확인한다', text: '보이스피싱이었다. 심장이 한참 쿵쾅거렸다.', effect: { smart: 1 } },
      { label: '시키는 대로 한다', if: s => s.money >= 300, text: '시키는 대로 돈을 옮겼다. 다음 날에야 알았다. 보이스피싱이었다.', memory: true, effect: { money: -300, happy: -10 } },
    ] },
  { id: 'savingsDone', type: 'fixed', age: [21, 50], once: false, cooldown: 5, when: s => s.money >= 0, text: '몇 년 부은 적금이 만기됐다. 통장에 찍힌 숫자를 몇 번이나 다시 봤다.', effect: { money: [300, 800], happy: 3 } },
  { id: 'coinFever', type: 'fixed', age: [20, 42], req: { minMoney: 500 }, text: '친구가 코인으로 한 달 만에 차를 바꿨다고 했다.',
    choices: [
      { label: '나도 넣는다', chance: .3,
        success: { text: '며칠 만에 몇 배가 됐다. 바로 뺐다. 손이 떨렸다.', memory: true, effect: { money: [1000, 4000], happy: 6 } },
        fail: { text: '상장 폐지 공지가 떴다.', effect: { money: -500, happy: -7 } } },
      { label: '관심 없다', text: '그 친구는 반년 뒤에 차를 팔았다.' },
    ] },
  { id: 'rentHike', type: 'fixed', age: [22, 45], req: { flags: ['ownPlace'], noFlags: ['married'] }, once: false, cooldown: 4, text: '집주인이 다음 달부터 월세를 올리겠다고 했다.',
    choices: [
      { label: '받아들인다', effect: { money: -100, happy: -2 }, text: '한숨을 쉬며 이체 금액을 고쳤다.' },
      { label: '이사한다', effect: { money: -150, happy: 1 }, text: '더 작지만 햇빛이 잘 드는 집으로 옮겼다.' },
    ] },
  { id: 'usedSale', type: 'random', on: ['home', 'rest'], age: [14, 50], once: false, cooldown: 3, text: '안 쓰는 물건을 중고로 팔았다. 거래하러 나온 사람이 동네 주민이었다.',
    effect: s => ({ money: s.age >= 18 ? [5, 30] : [1, 5], happy: 1 }) },
  { id: 'bonusPay', type: 'fixed', age: [24, 50], once: false, cooldown: 2, req: { job: true }, when: s => s.perf >= 50, text: '성과급이 나왔다. 생각보다 많았다.',
    effect: s => ({ money: Math.round(s.salary * .1), happy: 4 }) },
  { id: 'cardBill', type: 'fixed', age: [20, 45], once: false, cooldown: 3, when: s => s.money < 0, text: '카드 명세서를 열어보기가 무섭다.',
    choices: [
      { label: '가계부를 쓰기 시작한다', effect: { smart: 1, happy: -1 }, text: '커피값만 한 달에 꽤 됐다.' },
      { label: '못 본 척한다', effect: { happy: -2 }, text: '이메일을 안 읽은 채로 뒀다.' },
    ] },
  { id: 'cashOnRoad', type: 'random', on: ['park', 'mall', 'station', 'walk'], age: [10, 50], once: false, cooldown: 5, text: '길바닥에 5만 원짜리 지폐가 떨어져 있었다.',
    choices: [
      { label: '경찰서에 맡긴다', karma: 3, text: '경찰관이 요즘 이런 사람 드물다며 웃었다.' },
      { label: '주머니에 넣는다', karma: -2, effect: { money: 5 }, text: '그날 저녁은 조금 맛있었다.' },
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
  // 골목 (섹드립·스킨십으로 짧은 시간에 끌어올렸을 때, 엔진이 바로 부름) → 모텔에서 그날 밤 / 여기까지. 골목 연출은 키스까지
  { id: 'alleyHeat', type: 'trigger', text: '골목 끝에서 모텔 간판이 깜빡였다. {fp|이} 내 셔츠 깃을 잡은 채 숨을 골랐다.',
    choices: [
      { label: '모텔로 간다', intimate: true, fling: true, spot: 'motel', mood: 15, effect: { happy: [3, 6], money: -6 }, p: { heart: [6, 10], close: [3, 5] },
        memory: firstNight, pregnant: .05,
        risk: (s, a) => a.main() && a.main() !== a.focused() ? .2 : 0, riskTaken: (s, a) => (a.focused() || {}).taken ? .12 : 0,
        text: (s, a) => '모텔 엘리베이터 문이 닫히기도 전이었다. ' + nightLine(a, lover(a.focused()) ? 'lover' : 'fling') },
      { label: '오늘은 여기까지', p: { heart: [3, 6] }, effect: { happy: 1 },
        text: '이마를 맞댄 채 숨을 골랐다. "다음엔 안 놔줄 거야." {fp|이} 웃으며 먼저 골목을 나갔다.' },
    ] },
  // 애인이 있는 상대가 고백을 받아줬을 때: 정리하고 만날지, 헤어지지 않은 채 몰래 만날지, 사귀지 않고 즐기기만 할지
  { id: 'takenConfess', type: 'trigger',
    text: (s, a) => { const p = a.focused(); return `{fp|이} 내 손을 잡은 채 망설였다. "근데 나… 아직 ${p && p.gender === 'm' ? '여자친구' : '남자친구'}가 있어."`; },
    choices: [
      { label: '정리하고 나랑 만나자', do: (s, a) => { const p = a.focused(); a.startRelation(p, !!a.main() && a.main() !== p); }, memory: true, scene: 'kiss', effect: { happy: [6, 10] },
        text: '{fp|은} 만나던 사람과 정리하고 내 손을 잡았다.' },
      { label: '지금처럼, 몰래 만나자', do: (s, a) => { const p = a.focused(); a.startRelation(p, true); p.taken = true; }, memory: true, scene: 'kiss', effect: { happy: [4, 8] }, risk: .1, riskTaken: .1,
        text: '{fp|은} 애인과 헤어지지 않은 채 나를 만나기로 했다. 둘만의 비밀이다.' },
      { label: '사귀진 말고 즐기기만 하자', if: (s, a) => a.canSex(a.focused()), do: (s, a) => { const p = a.focused(); p.fwb = true; p.fling = true; }, p: { heart: [-5, -2], close: [2, 4] },
        text: '"그게 서로 편하겠다." {fp|이} 피식 웃었다. 애인과는 그대로, 나와는 즐기기만 하기로 했다.' },
    ] },
  { id: 'rivalFound', type: 'trigger', text: '{fp}의 애인이 나를 찾아왔다. 표정이 심상치 않았다.',
    choices: [
      { label: '사과하고 물러난다', p: { heart: [-25, -15] }, karma: 3, text: '고개를 숙였다. {fp|와는} 거리를 두기로 했다.' },
      { label: '맞선다', effect: { health: [-10, -3] }, karma: -5,
        meet: s => ({ kind: 'rival', ageRange: [Math.max(19, s.age - 5), Math.min(49, s.age + 5)], close: 0, grudge: 60 }),
        text: '{new|와} 크게 부딪쳤다. 적이 하나 생겼다.' },
    ] },

  /* ═════ 평판 · 소문 (엔진이 해마다 소문을 굴림: rumor 0~100, rumorType bad/good/skill) ═════ */
  { id: 'badRumor', type: 'fixed', age: [20, 49], once: false, cooldown: 3,
    when: s => (s.rumor || 0) >= 50 && s.rumorType === 'bad',
    text: s => s.job ? '직장 동료가 슬쩍 물었다. "너 요즘 많이 놀아?"' : '오랜만에 만난 동창이 슬쩍 물었다. "너 요즘 많이 놀아?"',
    choices: [
      { label: '무시한다', effect: { happy: -2 }, do: (s, a) => { if (s.job) a.perf(-5); }, text: '신경 쓰이지만 모른 척했다.' },
      { label: '부인한다', check: { stat: 'charm', diff: 60 },
        success: { do: s => { s.rumor = Math.max(0, s.rumor - 20); }, text: '"무슨 소리야." 웃으며 넘겼다. 다들 믿는 눈치였다.' },
        fail: { effect: { happy: -3 }, do: (s, a) => { if (s.job) a.perf(-5); }, text: '"무슨 소리야." 넘어가긴 했지만, 다들 눈빛이 묘했다.' } },
      { label: '당분간 조용히 지낸다', effect: { happy: -1 }, do: s => { s.rumor = Math.max(0, s.rumor - 30); }, text: '한동안 약속을 잡지 않았다. 소문은 조금씩 잦아들었다.' },
    ] },
  { id: 'rumorFriendAsk', type: 'random', age: [20, 49], once: false, cooldown: 3,
    when: (s, a) => (s.rumor || 0) >= 30 && s.rumorType === 'bad' && adultFriends(a).length > 0,
    onStart: (s, a) => a.focus(a.pick(adultFriends(a))),
    text: '{fp|이} 조심스럽게 물었다. "너 그 소문… 진짜야?"',
    choices: [
      { label: '솔직하게 말한다', p: { trust: [4, 8] }, text: '{fp|은} 한참 듣더니 "그래도 넌 너지"라고 했다.' },
      { label: '"헛소문이야"', p: { trust: [-4, 0] }, text: '{fp|은} 고개를 끄덕였지만, 믿는 눈치는 아니었다.' },
    ] },
  { id: 'goodRumor', type: 'fixed', age: [22, 50], once: false, cooldown: 4,
    when: s => (s.rumor || 0) >= 30 && s.rumorType === 'good',
    text: '"너네 진짜 오래 간다. 부럽다." 어느새 주변에서 그렇게들 말한다.', effect: { happy: 3, charm: [0, 1] } },
  { id: 'dirtyRumor', type: 'fixed', age: [20, 49], once: false, cooldown: 4,
    when: s => (s.rumor || 0) >= 30 && s.rumorType === 'skill',
    meet: s => ({ kind: 'friend', gender: s.gender === 'm' ? 'f' : 'm', ageRange: [Math.max(20, s.age - 6), Math.min(49, s.age + 6)], close: 25, heart: 30, libido: 60, taken: false, married: false }),
    text: '처음 보는 {new|이} 의미심장하게 웃으며 다가왔다. "소문 들었는데…"', effect: { happy: 2 } },

  /* ═════ 야한 문자 ═════ */
  // 만취 상태에서 보낸 야한 문자가 엉뚱한 곳으로 (data/social.js sexyText)
  { id: 'wrongText', type: 'trigger',
    do: (s, a) => {
      const r = Math.random(), mom = a.find(p => p.id === 'mom').length, ex = a.find(p => p.ex);
      s.vars.wrongTo = r < .4 ? 'work' : r < .7 && mom ? 'mom' : r < .9 && ex.length ? 'ex' : 'friend';
      if (s.vars.wrongTo === 'work' && s.job) a.perf(-15);
      if (s.vars.wrongTo === 'ex') { const e = a.pick(ex); e.heart = Math.min(100, e.heart + 5); }
    },
    text: s => ({ work: s.job ? '다음 날 아침, 보낸 메시지를 확인했다. 직장 동료 단톡방이었다. 월요일이 무서워졌다.' : '다음 날 아침, 보낸 메시지를 확인했다. 동창 단톡방이었다.',
      mom: '다음 날 아침, 보낸 메시지를 확인했다. 엄마한테였다. 인생 최악의 순간이었다.',
      ex: '다음 날 아침, 보낸 메시지를 확인했다. 전 연인한테였다. 읽음 표시가 떠 있었다.',
      friend: '다음 날 아침, 보낸 메시지를 확인했다. 다행히 친한 친구한테였다. "ㅋㅋㅋ 누구한테 보내려던 거야"' })[s.vars.wrongTo],
    effect: s => ({ work: { happy: -8 }, mom: { happy: -12 }, ex: { happy: -5 }, friend: { happy: -2 } })[s.vars.wrongTo] },
  // 상대가 먼저 보내옴
  { id: 'sexyTextIn', type: 'random', age: [20, 49], once: false, cooldown: 2,
    when: (s, a) => a.find(p => a.canSex(p) && (lover(p) || p.fwb) && p.heart >= 60 && (p.libido || 0) >= 60).length > 0,
    onStart: (s, a) => a.focus(a.pick(a.find(p => a.canSex(p) && (lover(p) || p.fwb) && p.heart >= 60 && (p.libido || 0) >= 60))),
    text: '{fp}에게서 사진 한 장이 왔다. 열어보기 전에 주위를 둘러봤다.',
    choices: [
      { label: '"지금 갈게"', libido: [8, 12], p: { heart: [3, 6] }, do: (s, a) => { a.focused().texted = true; }, text: '답장을 보내자마자 {fp}에게서 하트가 쏟아졌다.' },
      { label: '"이따 봐"', libido: [5, 8], do: (s, a) => { a.focused().texted = true; }, text: '하루 종일 일이 손에 안 잡혔다.' },
      { label: '"지금 바빠"', p: { heart: [-3, 0] }, text: '{fp|이} 삐친 이모티콘을 보냈다.' },
    ] },
  { id: 'textGrin', type: 'random', on: ['work', 'overtime', 'cafe', 'library'], age: [20, 49], once: false, cooldown: 3,
    when: (s, a) => a.find(p => p.texted && a.canSex(p)).length > 0,
    text: '휴대폰 화면을 보며 실실 웃다가 옆자리 사람과 눈이 마주쳤다. 황급히 화면을 껐다.', effect: { happy: 2 } },

  /* ═════ 피임 ═════ */
  { id: 'condomStore', type: 'random', on: ['conveni'], age: [20, 45], once: false, cooldown: 3, req: { flags: ['hadSex'] },
    text: '편의점 계산대에 콘돔을 올려놓는 순간, 뒤에서 아는 목소리가 들렸다.',
    choices: [
      { label: '태연하게 계산한다', check: { stat: 'charm', diff: 55 },
        success: { effect: { happy: 2 }, text: '"어, 안녕?" 아무렇지 않게 인사했다. 상대가 더 당황했다.' },
        fail: { effect: { happy: -2 }, text: '"…안녕?" 목소리가 갈라졌다. 서로 못 본 척하기로 했다.' } },
      { label: '껌을 하나 같이 올려놓는다', effect: { happy: 1 }, text: '아무도 속지 않았다.' },
    ] },
  { id: 'pillForgot', type: 'fixed', age: [20, 44], once: false, cooldown: 3, req: { flags: ['onPill'] },
    when: s => s.gender === 'f',
    text: '어젯밤 피임약 먹는 걸 깜빡했다.',
    choices: [
      { label: '바로 챙겨 먹는다', effect: { happy: -1 }, text: '알람을 하나 더 맞췄다.' },
      { label: '하루쯤이야', text: '괜찮겠지. 아마.',
        do: (s, a) => { const m = a.main(); if (m && a.canSex(m) && a.fertile(m) && Math.random() < .5) s.scare = { pid: m.id }; } },
    ] },
  { id: 'pillSide', type: 'fixed', age: [20, 44], req: { flags: ['onPill'] }, when: s => s.gender === 'f',
    text: '피임약 때문인지 요즘 몸이 붓고 기분이 오락가락한다.',
    choices: [
      { label: '병원에서 약을 바꾼다', effect: { money: -5, health: [1, 3] }, text: '약을 바꾸니 한결 나아졌다.' },
      { label: '그냥 참는다', effect: { happy: -2 }, text: '한동안 거울 보기가 싫었다.' },
      { label: '끊는다', unset: 'onPill', text: '약을 끊었다. 이제 다른 방법을 써야 한다.' },
    ] },
  { id: 'partnerPill', type: 'fixed', age: [20, 44], once: false, cooldown: 4,
    when: mainIs((m, s, a) => s.gender === 'm' && a.canSex(m) && !m.pill && !m.spouse && m.heart >= 50 && m.trust >= 40), onStart: focusMain,
    text: '{fp|이} 피임약을 먹어볼까 고민 중이라고 했다.',
    choices: [
      { label: '"네 몸이 먼저야. 내가 챙길게."', p: { trust: [6, 10], close: [2, 4] }, text: '{fp|이} 한참 나를 보다가 웃었다.' },
      { label: '"그럼 편하겠다"', p: { trust: [-4, -2] }, do: (s, a) => { a.focused().pill = true; }, text: '{fp|은} 대답 없이 웃었다. 며칠 뒤 혼자 병원에 다녀왔다.' },
    ] },

  /* ═════ 기념일 ═════ */
  { id: 'anniversaryHotel', type: 'fixed', age: [21, 49], once: false, cooldown: 3,
    when: mainIs((m, s, a) => (m.partner || m.spouse) && a.canSex(m) && m.heart >= 50 && s.age - (m.since ?? s.age) >= 1 && s.money >= 30), onStart: focusMain,
    text: '{fp|와} 만난 지 또 한 해가 됐다.',
    choices: [
      { label: '호텔을 잡는다', intimate: true, spot: 'hotel', mood: 20, memory: true, effect: { happy: [4, 6], money: -30 }, p: { heart: [6, 10], close: [3, 5] },
        pregnant: (s, a) => a.focused().spouse ? .12 : .06, text: '창밖으로 도시 불빛이 내려다보였다. 기념일다운 밤이었다.' },
      { label: '집에서 조촐하게', p: { close: [3, 6] }, effect: { happy: 2 }, text: '케이크에 초를 하나 꽂고 둘이 마주 앉았다.' },
    ] },
];
})();
