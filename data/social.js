// 사람과의 상호작용 — 관계 창에서 사람을 눌렀을 때 나오는 버튼들 (행동 1 사용)
//
// 호감도 4종 (사람마다 따로)
//   close 친밀 / trust 신뢰 / heart 설렘 / grudge 원한
//   설렘은 연애 가능한 상대만 움직임: 둘 다 19살 이상, 상대 50살 미만, 이성, 가족 아님
//   엔진이 추가로 곱해주는 것: 성격 궁합(mod), 같은 취미(같이 놀기·선물 1.3배), 가치관(같으면 1.2배, 부딪히면 0.8배)
//
// if(s, p, a)  → 이 버튼이 보이는 조건
// cost(s, p)   → 드는 돈 (만원)
// run(s, p, a) → 결과. p: 상대 호감도 변화 / effect: 내 스탯 / risk: 애인에게 들킬 확률 / riskTaken: 상대 애인에게 들킬 확률
//                pregnant: 아이가 생길 확률 (엔진이 나이·아이 수로 보정) / moveTo: 상대와 같이 다른 장소로 이동
// noFree: true  → 장소에 같이 있어도 늘 행동 1 (이동하는 것들)
// 문장의 {p}는 상대 이름 (조사는 {p|와} 처럼)
//
// intimate: true → 엔진이 '함께 밤을 보냄'으로 처리 (성욕 해소, 기술·궁합, 만족감에 따라 설렘 변화). mood: 분위기 보정
//
// 친밀한 관계 — 조건: 둘 다 20살 이상, 이성, 가족 아님, 집에서만. 행위 과정은 쓰지 않고, 그 전후와 다음 날 아침에 무게를 둠
// 받아줄지는 꼬심 점수(잠자리 수락 가중치: 설렘·친밀·성욕·상황이 크고 외모는 작게)로 정함
window.GAME_DATA = window.GAME_DATA || {};

(function () {
const notKin = p => p.kind !== 'family' && p.kind !== 'child';
const lover = p => p.partner || p.spouse || p.secret;
// 이미 사귀는 사이는 상대가 50살을 넘어도 됨. 그 외엔 연애 가능 조건 그대로 (엔진의 canSex: 둘 다 20살 이상)
const adultPair = (s, p, a) => a.canSex(p);
const pickLine = (a, set, p) => { const L = GAME_DATA.nightLines[set][p.personality]; return L ? a.pick(L) : GAME_DATA.nightLines[set]._; };

// 함께 밤을 보낸 다음 날 아침 — 상대 성격마다 다름 (lover: 사귀는 사이 / fling: 사귀지 않는 사이)
GAME_DATA.nightLines = {
  // 불이 꺼지기 전 한 줄 (사귀는 사이)
  intro: ['불을 끄자 방 안에 숨소리만 남았다.', '{p|이} 내 셔츠 단추에 손을 올렸다. 멈추지 않았다.', '소파에서 시작된 키스가 침대까지 이어졌다.', '{p}의 손이 등을 타고 올라왔다. 숨이 가까워졌다.'],
  // 사귀지 않는 사이
  flingIntro: ['문이 닫히자마자 입술이 먼저 닿았다.', '술기운 탓이라고 하기엔 서로 너무 또렷하게 기억하고 있었다.', '엘리베이터 안에서 시작된 건 택시 안에서 끝나지 않았다.', '샤워기 소리가 멈추자 방 안이 조용해졌다. 둘 다 어색했다.'],
  lover: {
    bold:      ['{p|이} 내 위에서 일어나며 웃었다. "또 해도 돼?"', '{p|이} 먼저 이불을 걷어찼다. "일어나, 밥 먹자."'],
    shy:       ['{p|이} 이불 속에서 내 가슴에 얼굴을 묻었다. 귀 끝이 아직 빨갛다.', '{p|이} 눈이 마주치자 이불을 머리끝까지 끌어올렸다.'],
    playful:   ['{p|이} 내 등에 남은 손톱 자국을 보더니 "내 작품"이라며 깔깔거렸다.', '눈을 떠 보니 {p|이} 내 얼굴에 낙서를 하고 있었다.'],
    cool:      ['{p|이} 아무 일 없었다는 듯이 커피를 내리고 있었다. 컵이 두 개다.', '{p|은} 말없이 내 몫의 토스트까지 구워놨다.'],
    warm:      ['{p|이} 먼저 일어나 아침을 차려 놓았다. 내 옷을 걸치고.', '{p|이} 내 머리를 쓸어 넘기며 더 자라고 했다.'],
    sharp:     ['{p|이} "어젯밤 좋았어"라고 짧게 말했다. 목에 자국이 남아 있었다.', '{p|이} 옷을 챙기며 "다음 주 금요일 비워둬."라고 했다.'],
    sunny:     ['아침부터 {p}의 콧노래가 집 안을 채웠다. 바닥에 옷이 흩어져 있었다.', '{p|이} 콧노래를 부르며 커튼을 활짝 열었다.'],
    sensitive: ['{p|이} 아직 내 팔 안에 있었다. "가지 마"라고 작게 말했다.', '{p|이} 내 손을 꼭 잡고 한참을 놓지 않았다.'],
    _: '{p|와} 뒤엉킨 이불 속에서 늦은 아침을 맞았다.',
  },
  fling: {
    bold:      ['{p|이} "우리 이제 뭐야?"라고 대놓고 물었다.'],
    shy:       ['{p|이} 얼굴을 붉히며 인사도 제대로 못 하고 나갔다.'],
    playful:   ['{p|이} "우리 둘만 아는 걸로?" 하며 새끼손가락을 내밀었다.'],
    cool:      ['{p|은} 아무 일 없었다는 듯 손을 흔들고 나갔다.'],
    warm:      ['{p|이} 해장국을 끓여놓고 갔다. "밥 꼭 먹어"라는 쪽지가 붙어 있었다.'],
    sharp:     ['{p|이} "어젯밤 일은 어젯밤 일로 하자."라고 선을 그었다.'],
    sunny:     ['{p|이} 아침부터 콧노래를 불렀다. 어색한 건 나뿐이었다.'],
    sensitive: ['{p|이} 한참 망설이다 "후회 안 해?"라고 물었다.'],
    _: '{p|이} 조용히 먼저 나갔다.',
  },
};

GAME_DATA.social = [
  { id: 'talk', label: '대화하기', icon: '💬',
    if: (s, p, a) => s.age >= 3 && !a.jailed(),
    run: () => ({ p: { close: [3, 6], trust: [0, 2] },
      text: ['{p|와} 이런저런 얘기를 나눴다.', '{p|와} 수다를 떨다 시간 가는 줄 몰랐다.', '{p|와} 별것 아닌 일로 한참 웃었다.'] }) },

  { id: 'family', label: '함께 시간 보내기', icon: '🏠',
    if: (s, p, a) => p.kind === 'family' && s.age >= 4 && !a.jailed(),
    run: (s, p, a) => ({ p: { close: [5, 9] }, effect: { happy: [1, 3] }, text: GAME_DATA.familyText[p.role] || GAME_DATA.familyText._sib }) },

  { id: 'hang', label: '같이 놀기', icon: '🎈',
    if: (s, p, a) => s.age >= 4 && notKin(p) && !a.jailed(),
    cost: s => s.age >= 18 ? 10 : 0,
    run: (s, p, a) => {
      const h = a.sharedHobby(p);   // 같은 취미면 그 취미로 놂 (엔진이 효과도 더 줌)
      return { p: { close: [5, 9], heart: [0, 2] }, effect: { happy: [2, 4], charm: [0, 1] },
        text: h ? h.act.map(t => '{p|와} ' + t)
          : s.age < 13 ? ['{p|와} 놀이터에서 해 질 때까지 놀았다.', '{p|와} 딱지치기를 했다.']
          : s.age < 19 ? ['{p|와} 노래방에 갔다.', '{p|와} 떡볶이를 먹으러 갔다.', '{p|와} PC방에서 밤을 새웠다.']
          : ['{p|와} 저녁을 먹었다.', '{p|와} 늦게까지 이야기를 나눴다.', '{p|와} 영화를 봤다.'] };
    } },

  { id: 'listen', label: '고민 들어주기', icon: '👂',
    if: (s, p, a) => s.age >= 10 && p.close >= 30 && p.kind !== 'child' && !a.jailed(),
    run: () => ({ p: { trust: [4, 8], close: [2, 4] }, text: ['{p}의 고민을 끝까지 들어줬다.', '{p|이} 말하기 힘든 이야기를 털어놨다.'] }) },

  { id: 'gift', label: '선물하기', icon: '🎁',
    if: (s, p, a) => s.age >= 6 && !a.jailed(),
    cost: s => s.age >= 18 ? 20 : 0,
    run: s => ({ p: { close: [4, 8], heart: [3, 6] }, effect: { happy: [0, 1] },
      text: s.age < 18 ? ['{p}에게 직접 만든 카드를 줬다.', '{p}에게 아끼던 스티커를 나눠줬다.'] : ['{p}에게 작은 선물을 했다.', '{p|이} 갖고 싶다던 걸 기억해뒀다가 선물했다.'] }) },

  /* ── 연애 (조건은 엔진에서도 한 번 더 확인) ── */
  { id: 'flirt', label: '플러팅', icon: '😉',
    if: (s, p, a) => a.canRomance(p) && !p.partner && !p.spouse && !a.jailed(),
    run: (s, p, a) => {
      const ok = a.charmed(p, null, a.need('flirt'));   // 꼬심 점수: 아는 정도에 따라 외모·매력·관계 가중치가 바뀜
      const risk = a.main() && a.main() !== p ? .2 : 0;
      const g = a.faceGrade(), react = GAME_DATA.faceReact.flirt[g === 'SS' ? 'S' : g];
      const say = s.place === 'bar' ? ['"오늘 재밌었어." ', '"오늘 재밌었어." ', '"너 눈 진짜 예쁘다. 아까부터 계속 보고 있었어." ', '"나 좋아해? 좋아하지?" '][s.drunk || 0] : '';
      return ok
        ? { p: { heart: [8, 14], close: [1, 3] }, risk, riskTaken: p.taken ? .15 : 0,
            text: () => say + (['S', 'SS', 'A', 'B'].includes(g) ? react : a.pick(['{p|이} 내 농담에 오래 웃었다.', '{p|와} 눈이 마주쳤다. 둘 다 먼저 피하지 않았다.', '{p|이} 다음에 또 보자고 했다.'])) }
        : { p: { close: [-3, -1] }, effect: { happy: -2 }, risk, riskTaken: p.taken ? .1 : 0,
            text: () => say + (['D', 'E', 'F'].includes(g) ? react : a.pick(['분위기가 어색해졌다.', '{p|이} 못 들은 척했다.'])) };
    } },

  { id: 'confess', label: '고백하기', icon: '💌',
    if: (s, p, a) => a.canRomance(p) && p.heart >= 40 && !lover(p) && !a.jailed(),
    run: (s, p, a) => {
      const ok = p.heart + p.close / 4 + a.rand(-15, 15) - (p.taken ? 15 : 0) >= 55;
      if (!ok) return { p: { heart: [-18, -12], close: [-8, -4] }, effect: { happy: [-8, -4] },
        text: ['{p|이} 미안하다고 했다.', '{p|은} 친구로 지내고 싶다고 했다.'] };
      const sneaky = !!a.main();
      return { do: () => a.startRelation(p, sneaky), memory: true, effect: { happy: [6, 10] }, risk: sneaky ? .15 : 0,
        text: sneaky ? '{p|와} 몰래 만나기 시작했다. 아무도 몰라야 한다.'
          : p.taken ? '{p|은} 만나던 사람과 정리하고 내 손을 잡았다.' : '{p|와} 사귀게 됐다!' };
    } },

  { id: 'date', label: '데이트', icon: '💕',
    if: (s, p, a) => lover(p) && s.age >= 19 && !a.jailed(),
    cost: () => 10,
    run: (s, p) => ({ p: { heart: [5, 10], close: [3, 5] }, effect: { happy: [2, 4] }, risk: p.secret ? .18 : 0,
      text: ['{p|와} 처음 가보는 동네를 걸었다.', '{p|와} 늦게까지 이야기를 나눴다.', '{p|와} 바다를 보러 갔다.', '{p|와} 집에서 영화를 봤다.'] }) },

  { id: 'propose', label: '청혼하기', icon: '💍',
    if: (s, p, a) => p.partner && p.heart >= 65 && p.trust >= 50 && s.age >= 22 && !a.jailed(),
    run: (s, p, a) => p.heart + p.trust / 2 + a.rand(-10, 10) >= 95
      ? { do: () => a.marry(p), memory: true, effect: { happy: 12, money: -1500 }, text: '{p|이} 고개를 끄덕였다. 결혼식을 올렸다!' }
      : { p: { heart: -10 }, effect: { happy: -5 }, text: '{p|은} 아직은 아니라고 했다.' } },

  /* ── 친밀한 관계 (집에서만) ── */
  { id: 'intimate', label: '함께 밤을 보내다', icon: '♂♀',
    if: (s, p, a) => adultPair(s, p, a) && lover(p) && p.heart >= 60 && p.trust >= 40 && s.place === 'home' && !a.jailed(),
    run: (s, p, a) => {
      const m = a.main();
      // 사귀는 사이라도 상대가 내키지 않을 때가 있음 (성욕이 바닥이면 더)
      if (!a.charmed(p, 'bed', a.need('lover') + ((p.libido || 0) < 20 ? 15 : 0)))
        return { p: { heart: [-2, 0] }, text: a.pick(['{p|이} 오늘은 피곤하다며 이불을 끌어올렸다.', '{p|이} 내 이마에 입을 맞추고 먼저 돌아누웠다.', '"오늘은 그냥 안고만 자자." {p|이} 작게 말했다.']) };
      const first = !p.nights;
      return {
        intimate: true,
        p: { heart: [8, 15], close: [5, 10], trust: [3, 6] },
        effect: { happy: [4, 8] },
        memory: first,                                  // 이 사람과 처음 보낸 밤은 추억으로 (날씨와 함께 앨범에)
        pregnant: s.flags.married || p.spouse ? .15 : .08,   // 엔진이 30살부터 확률을 줄이고, 45살부터는 0
        risk: p.secret ? (m && a.isHere(m) ? .6 : .2) : 0,  // 몰래 만나는 사이면 들킬 위험 (배우자가 집에 있으면 훨씬 큼)
        text: () => a.pick(GAME_DATA.nightLines.intro) + ' ' + pickLine(a, 'lover', p),
      };
    } },

  { id: 'onenight', label: '하룻밤', icon: '♂♀',
    if: (s, p, a) => adultPair(s, p, a) && !lover(p) && p.close >= 40 && (p.heart >= 50 || (p.fwb && p.heart >= 25)) && s.place === 'home' && !a.jailed(),
    run: (s, p, a) => {
      if (!p.fwb && !a.charmed(p, 'bed', a.need('bed')))
        return { p: { heart: [-3, -1] }, effect: { happy: -2 }, text: a.pick(['{p|이} 웃으며 고개를 저었다. "오늘은 여기까지."', '{p|이} 잠깐 망설이더니 택시를 불렀다.']) };
      const risk = a.main() ? .25 : 0;     // 애인이 있으면 들킬 위험
      const theirRisk = p.taken ? .2 : 0;  // 상대에게 애인이 있으면 그쪽도 위험
      return {
        intimate: true, fling: true,       // 관계가 '썸' 또는 '복잡한 사이'로
        p: { heart: [10, 18], close: [4, 8] },
        effect: { happy: [3, 6] },
        memory: !p.nights,
        pregnant: .05,
        risk, riskTaken: theirRisk,
        text: () => a.pick(GAME_DATA.nightLines.flingIntro) + ' ' + pickLine(a, 'fling', p),
      };
    } },

  { id: 'takeHome', label: '집으로 데려가기', icon: '🏠', noFree: true,
    if: (s, p, a) => ['bar', 'concert'].includes(s.place) && a.isHere(p) && !s.flags.married && adultPair(s, p, a) && p.heart >= 45 && p.close >= 30 && !a.jailed(),
    run: (s, p, a) => a.charmed(p, 'bed', a.need('takeHome')) ? {
      moveTo: 'home', p: { heart: [2, 4] },
      risk: a.main() && a.main() !== p ? .1 : 0,
      text: !s.flags.ownPlace ? '부모님이 주무시는 걸 확인하고 {p|와} 조용히 현관문을 열었다.'
        : ['택시 창밖으로 불빛이 길게 번졌다. {p|와} 우리 집 앞에서 내렸다.', '{p|와} 말없이 걸었다. 어느새 우리 집 골목이었다.'],
    } : { p: { heart: [-2, 0] }, text: ['{p|이} 택시를 잡아주고 혼자 돌아섰다.', '"다음에." {p|이} 웃으며 손을 흔들었다.'] } },

  { id: 'breakup', label: '헤어지기', icon: '💔',
    if: (s, p, a) => (p.partner || p.secret) && !a.jailed(),
    run: (s, p, a) => ({ do: () => a.breakUp(p, 20), memory: true, effect: { happy: [-6, -3] }, text: '{p|와} 헤어졌다.' }) },

  { id: 'divorce', label: '이혼하기', icon: '📄',
    if: (s, p, a) => p.spouse && !a.jailed(),
    run: (s, p, a) => ({ do: () => a.divorce(p), memory: true, effect: { happy: -8 }, text: '{p|와} 이혼했다. 재산을 반으로 나눴다.' }) },

  /* ── 갈등 ── */
  { id: 'argue', label: '다투기', icon: '💢',
    if: (s, p, a) => s.age >= 6 && !a.jailed(),
    run: () => ({ p: { grudge: [12, 20], close: [-12, -8], trust: [-4, -2] }, effect: { happy: [0, 2] }, karma: -2,
      text: ['{p|와} 크게 다퉜다.', '{p}에게 해서는 안 될 말을 했다.', '{p|와} 언성을 높였다.'] }) },

  { id: 'apologize', label: '사과하기', icon: '🙇',
    if: (s, p, a) => p.grudge >= 10 && !a.jailed(),
    run: (s, p, a) => p.trust + a.rand(-20, 20) >= 30
      ? { p: { grudge: [-20, -12], close: [2, 4] }, karma: 2, text: '{p}에게 진심으로 사과했다. 조금은 풀린 눈치다.' }
      : { p: { grudge: [-5, -2] }, text: '{p|은} 아직 화가 덜 풀렸다.' } },

  /* ── 돈 ── */
  { id: 'borrow', label: '돈 빌리기', icon: '💸',
    if: (s, p, a) => s.age >= 19 && p.close >= 50 && !p.debt && p.kind !== 'child' && !a.jailed(),
    run: (s, p, a) => { const amt = a.rand(5, 30) * 10;
      return { effect: { money: amt }, do: () => { p.debt = amt; }, p: { trust: [-8, -4] }, text: `{p}에게 ${a.money(amt)}을 빌렸다.` }; } },

  { id: 'repay', label: '빚 갚기', icon: '🧾',
    if: (s, p) => p.debt > 0 && s.money >= p.debt,
    run: (s, p) => ({ effect: { money: -p.debt }, do: () => { p.debt = 0; }, p: { trust: [6, 10] }, text: '{p}에게 빌린 돈을 갚았다.' }) },

  /* ── 가족 ── */
  { id: 'allowance', label: '용돈 조르기', icon: '🪙',
    if: (s, p, a) => p.kind === 'family' && s.age >= 6 && s.age <= 18 && !a.jailed(),
    run: () => ({ effect: { money: [1, 5] }, p: { close: [-2, 0] }, text: ['{p|이} 못 이기는 척 용돈을 줬다.', '{p|이} 이번 한 번만이라며 지갑을 열었다.'] }) },

  { id: 'filial', label: '효도하기', icon: '🧧',
    if: (s, p, a) => p.kind === 'family' && s.age >= 25 && !a.jailed(),
    cost: () => 50,
    run: () => ({ p: { close: [6, 10], trust: [2, 4] }, effect: { happy: [2, 4] }, text: ['{p}에게 용돈을 드렸다. 괜히 쑥스러웠다.', '{p|와} 근사한 식당에 갔다.'] }) },

  { id: 'play', label: '놀아주기', icon: '🧸',
    if: (s, p, a) => p.kind === 'child' && a.npcAge(p) <= 15 && !a.jailed(),
    run: () => ({ p: { close: [6, 10] }, effect: { happy: [3, 5] }, text: ['{p|와} 놀이터에 갔다.', '{p|이} 그린 그림을 냉장고에 붙였다.', '{p|와} 같이 숙제를 했다.'] }) },

  /* ── 수감 중 ── */
  { id: 'letter', label: '편지 쓰기', icon: '✉️',
    if: (s, p, a) => a.jailed(),
    run: () => ({ p: { close: [4, 7], trust: [1, 3] }, text: '{p}에게 긴 편지를 썼다.' }) },

  { id: 'cutoff', label: '연락 끊기', icon: '✂️',
    if: (s, p, a) => notKin(p) && !p.spouse && !a.jailed(),
    run: (s, p, a) => ({ do: () => { if (p.partner || p.secret) a.breakUp(p, 10); p.gone = true; }, text: '{p|와} 연락을 끊었다.' }) },
];
})();
