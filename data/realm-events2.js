// Llife: 영지 — 사건 2: 신분 · 작위 · 왕실 · 종족 · 오러/서클 · 용병 · 노예(해방) · 연애 · 마을 장소(place)
//   형식은 data/realm-events.js와 같음. place가 있는 사건은 마을 나들이에서만 뜸 (js/realm-life.js)
//   yearly(s, id): 해마다 한 번 (지난번 뒤로 12달)
window.REALM = window.REALM || {};
(() => {
const RE = REALM.events;
const yearly = (s, id) => s.monthN - ((s.flags.last || {})[id] ?? -99) >= 12;
const stamp = id => s => { s.flags.last = s.flags.last || {}; s.flags.last[id] = s.monthN; };
const lord = s => s.title === '영주';

/* ── 왕실 · 작위 ── */
RE.push(
  { id: 'promotion', story: true, when: (s, R) => R.canPromote(),
    text: (s, R) => `왕도에서 금빛 봉인이 찍힌 교서가 왔다. "${s.house} 가문의 공을 치하하여 작위를 올린다." 왕실 공헌 ${s.favor}, 명성 ${s.fame}.`,
    choices: [{ label: '왕도로 가서 무릎 꿇고 받는다', do: (s, R) => R.promote(), text: '대관식장의 은빛 검이 어깨에 닿았다.' }] },
  { id: 'royalLevy', when: (s, R) => lord(s) && s.month === 5 && s.monthN >= 10 && yearly(s, 'royalLevy'), weight: 4,
    text: '왕의 소집령. "북쪽 국경에 병사를 보내라." 전령이 영지의 병력 명부를 훑어본다.',
    choices: [
      { label: '상비병을 보낸다', when: s => s.realm.troops.men >= 12, do: (s, R) => { stamp('royalLevy')(s); s.realm.troops.men -= 12; R.favor(12); }, fame: 3, text: '깃발을 든 병사들이 북쪽으로 떠났다. 왕실이 기억할 것이다. (상비병 -12 · 왕실 공헌 +12)' },
      { label: '금화로 대신한다', do: (s, R) => { stamp('royalLevy')(s); s.realm.gold = Math.max(0, s.realm.gold - 80); R.favor(7); }, text: '금화 상자를 실은 수레가 왕도로 떠났다. (💰 -80 · 왕실 공헌 +7)' },
      { label: '영지 사정이 어렵다며 거절한다', check: { stat: 'charm', g: 'C' }, ok: { do: (s, R) => { stamp('royalLevy')(s); R.favor(-2); }, text: '사정을 잘 설명했다. 이번엔 넘어가 주었다. (왕실 공헌 -2)' },
        no: { do: (s, R) => { stamp('royalLevy')(s); R.favor(-12); }, fame: -4, text: '전령의 얼굴이 굳었다. 왕실에 나쁜 소문이 돌 것이다. (왕실 공헌 -12)' } },
    ] },
  { id: 'royalFeast', when: (s, R) => s.age >= 18 && s.favor >= 15 && yearly(s, 'royalFeast'), weight: 1.2,
    text: '왕궁 연회 초대장. 샹들리에 아래 귀족들이 서로의 작위를 재고 있다.',
    choices: [
      { label: '왕에게 인사를 올린다', check: { stat: 'charm', g: 'C' }, ok: { do: (s, R) => { stamp('royalFeast')(s); R.favor(8); }, fame: 3, text: '왕이 내 이름을 기억했다. (왕실 공헌 +8)' }, no: { do: stamp('royalFeast'), text: '말을 더듬었다. 왕은 이미 다른 사람을 보고 있었다.' } },
      { label: '젊은 귀족들과 어울린다', do: (s, R) => { stamp('royalFeast')(s); R.mkPerson('noble', { met: true, aff: 30, place: 'salon' }); }, fx: { charm: [1, 2] }, text: '춤을 청한 귀족 자제와 이야기가 잘 통했다. (새 인연)' },
      { label: '구석에서 정보를 모은다', check: { stat: 'lore', g: 'C' }, ok: { do: stamp('royalFeast'), realm: { gold: 60 }, text: '곡물 값이 오른다는 소문을 들었다. 미리 사 두어 이문을 남겼다.' }, no: { do: stamp('royalFeast'), text: '쓸 만한 이야기는 없었다.' } },
    ] },
  { id: 'tourney', when: s => s.age >= 18 && yearly(s, 'tourney'), weight: 1.1,
    text: '왕도의 마상 창시합. 깃발이 펄럭이고, 기사들이 창을 세운다. "영주께서도 나오시겠소?"',
    choices: [
      { label: '갑옷을 입고 나선다', fight: 'knight', do: stamp('tourney'), win: { text: '창이 상대의 방패를 꿰뚫었다! 관중이 일어섰다.', fame: 10, realm: { gold: 80 }, do: (s, R) => R.favor(4) }, lose: { text: '낙마했다. 그래도 끝까지 일어선 모습에 박수가 나왔다.', fame: 1 } },
      { label: '관람석에서 지켜본다', do: stamp('tourney'), fx: { command: [0, 1] }, text: '기사들의 기술을 눈에 담았다.' },
    ] },
  { id: 'nobleInsult', when: s => s.age >= 18 && s.peer <= 3, weight: .8,
    text: (s, R) => `연회장에서 백작가의 자제가 웃었다. "${['장원', '남작령', '자작령', '백작령'][s.peer] || '시골'} 영주라, 소 냄새가 나는군."`,
    choices: [
      { label: '장갑을 던져 결투를 청한다', fight: 'knight', win: { text: '검끝이 상대의 목에 멈췄다. 그는 사과했다.', fame: 8 }, lose: { text: '졌다. 그래도 물러서지 않았다는 이야기가 돌았다.', fame: 2 } },
      { label: '웃으며 받아친다', check: { stat: 'charm', g: 'B' }, ok: { fame: 5, text: '"소가 있어야 빵도 있지요." 좌중이 웃음을 터뜨렸고, 그는 얼굴이 붉어졌다.' }, no: { fame: -2, text: '받아친 말이 어색했다. 수군거림만 남았다.' } },
      { label: '못 들은 척한다', text: '귀족 사회는 원래 이렇다. 참았다.' },
    ] },
  { id: 'knightPlea', when: s => lord(s), weight: .7, once: false,
    text: '전쟁에서 공을 세운 평민 병사가 무릎을 꿇었다. "기사로 서임해 주십시오. 목숨을 바치겠습니다."',
    choices: [
      { label: '검을 들어 서임한다', do: (s, R) => R.mkPerson('knight', { met: true, aff: 55 }), realm: { morale: 3 }, fame: 2, text: '새 기사가 탄생했다. 병사들이 환호했다. (기사 한 명이 가신이 됨)' },
      { label: '아직 이르다고 타이른다', realm: { order: 1 }, text: '그는 고개를 숙이고 물러났다. 더 공을 세우겠다고 했다.' },
    ] },
  { id: 'assassin', when: s => s.peer >= 2 || s.favor >= 80, weight: .5,
    text: '한밤중, 침실 창문이 소리 없이 열렸다. 검은 옷의 자객!',
    choices: [
      { label: '베개 밑의 단검을 뽑는다', fight: 'wraith', win: { text: '자객을 쓰러뜨렸다. 품에서 경쟁 가문의 문장이 나왔다.', fame: 6, do: (s, R) => R.favor(3) }, lose: { text: '경비병이 달려와 자객이 달아났다. 어깨에 깊은 상처가 남았다.', hp: -15 } },
      { label: '경비를 부른다', check: { stat: 'agility', g: 'C' }, ok: { text: '외침과 함께 몸을 굴렸다. 경비병들이 자객을 붙잡았다.', realm: { order: 3 } }, no: { hp: -20, text: '칼날이 옆구리를 스쳤다. 자객은 사라졌다.' } },
    ] },
);

/* ── 평민 · 신분 ── */
RE.push(
  { id: 'commonerBlock', when: s => s.age >= 15, weight: .9,
    text: '말을 타고 마을을 지나는데, 맨발의 아이가 말 앞을 막아섰다. 병사들이 창을 들었다.',
    choices: [
      { label: '"멈춰라." 말에서 내려 사정을 듣는다', realm: { morale: 4 }, fame: 1, text: '아이의 어머니가 병들었다고 했다. 신전 치료사를 보내 주었다.' },
      { label: '금화 몇 닢을 던져 준다', realm: { gold: -5, morale: 2 }, text: '아이가 금화를 꼭 쥐고 달아났다.' },
      { label: '"영주의 길을 막지 마라." 꾸짖는다', realm: { order: 2, morale: -2 }, text: '마을 사람들이 고개를 숙였다. 눈빛은 차가웠다.' },
    ] },
  { id: 'merchantBribe', when: s => lord(s), weight: .7,
    text: '상인 조합장이 묵직한 주머니를 내밀었다. "시장 통행세를 조금만 낮춰 주시면…"',
    choices: [
      { label: '주머니를 받는다', realm: { gold: 90, order: -4 }, text: '금화가 쏟아졌다. 시장에 불공정하다는 말이 돌았다.' },
      { label: '돌려보낸다', fame: 3, realm: { morale: 2 }, text: '"영주는 사지 못하는 사람이오." 소문이 퍼졌다.' },
      { label: '대신 시장 정비 비용을 내라고 한다', check: { stat: 'stewardship', g: 'C' }, ok: { realm: { gold: 50, morale: 1 }, text: '조합장이 웃으며 받아들였다. 시장 길이 넓어졌다.' }, no: { text: '조합장이 말을 돌리며 빠져나갔다.' } },
    ] },
  { id: 'heresy', when: s => s.circle && s.circle.lv >= 2, weight: .7,
    text: '신전의 이단 심문관이 찾아왔다. "영주께서 금지된 마법을 쓰신다는 말이 있습니다."',
    choices: [
      { label: '신학 지식으로 반박한다', check: { stat: 'lore', g: 'C' }, ok: { fame: 3, text: '마법이 신의 섭리를 거스르지 않음을 경전으로 보였다. 심문관이 물러났다.' }, no: { realm: { morale: -4 }, text: '논쟁에서 밀렸다. 마을에 불길한 소문이 돌았다.' } },
      { label: '신전에 기부한다', realm: { gold: -60, morale: 2 }, text: '심문관은 "오해였군요" 하며 웃었다.' },
      { label: '"내 땅에서 나가시오."', realm: { morale: -3, order: 2 }, fame: 2, text: '심문관이 이를 갈며 떠났다. 신전과 사이가 틀어졌다.' },
    ] },
  { id: 'bardBallad', when: s => s.fame >= 80, weight: .6,
    text: (s) => `광장에서 음유시인이 노래한다. "${s.house}의 ${s.name}, 그 검이 빛날 때…" 사람들이 따라 부른다.`,
    choices: [{ label: '금화를 던져 준다', realm: { gold: -10, morale: 4 }, fame: 3, text: '노래가 세 곡 더 이어졌다.' }, { label: '쑥스러워 자리를 뜬다', fx: { charm: [0, 1] }, text: '등 뒤로 노랫소리가 따라왔다.' }] },
);

/* ── 종족 ── */
RE.push(
  { id: 'raceSlur', when: (s, R) => R.race() !== 'human' && s.age >= 18, weight: 1,
    text: (s, R) => `살롱에서 들려오는 수군거림. "${{ elf: '귀 뾰족한 숲쟁이', dwarf: '땅굴 난쟁이', beast: '짐승 귀 달린', orc: '초록 야만인' }[R.race()]}가 영주라니, 왕국도 끝났군."`,
    choices: [
      { label: '당당히 앞에 나서 말한다', check: { stat: 'charm', g: 'B' }, ok: { fame: 6, text: '"내 영지는 굶는 이가 없소. 당신 영지는 어떻소?" 침묵이 흘렀다.' }, no: { fame: -1, text: '말이 엉켰다. 비웃음만 커졌다.' } },
      { label: '무력으로 본때를 보인다', check: { stat: 'might', g: 'B' }, ok: { fame: 4, realm: { order: 1 }, text: '탁자를 한 손으로 들어 올렸다. 아무도 다시 입을 열지 않았다.' }, no: { fame: -3, text: '소란만 피운 꼴이 되었다.' } },
      { label: '못 들은 척한다', text: '이런 말은 처음이 아니다.' },
    ] },
  { id: 'elfKin', when: (s, R) => R.race() === 'elf', weight: .6, once: true,
    text: '숲에서 동족 사절이 왔다. 은빛 머리의 장로가 미소 지었다. "인간의 땅에서 잘 버티고 있구나, 아이야."',
    choices: [{ label: '정중히 맞이한다', goods: { mana: 4 }, fx: { arcana: [2, 3] }, text: '장로가 숲의 마석과 옛 주문을 나눠 주었다.' }] },
  { id: 'dwarfGuild', when: (s, R) => R.race() === 'dwarf', weight: .6, once: true,
    text: '산 아래 드워프 대장장이 조합이 편지를 보냈다. "동족 영주께 우리 망치를 빌려드리지."',
    choices: [{ label: '고맙게 받는다', goods: { iron: 10 }, realm: { gold: 40 }, text: '철 수레와 함께 솜씨 좋은 견습공들이 왔다.' }] },
  { id: 'orcFear', when: (s, R) => R.race() === 'orc', weight: .8,
    text: '마을 아이들이 나를 보고 울며 달아났다. 어른들도 문을 걸어 잠갔다.',
    choices: [
      { label: '추수를 직접 거든다', check: { stat: 'vigor', g: 'C' }, ok: { realm: { morale: 6 }, text: '밀 다발 열 개를 한 번에 짊어지자 아이들이 다가와 구경했다.' }, no: { realm: { morale: 1 }, text: '어색한 웃음만 오갔다.' } },
      { label: '두려움도 다스림이다', realm: { order: 5, morale: -3 }, text: '아무도 감히 세금을 미루지 않았다.' },
    ] },
  { id: 'beastRefugees', when: s => lord(s), weight: .6,
    text: '전쟁에 쫓긴 수인 피난민 수십 명이 성문 앞에 모였다. 마을 사람들이 웅성인다.',
    choices: [
      { label: '받아들인다', realm: { pop: 50 }, do: (s, R) => { s.realm.morale = Math.max(0, s.realm.morale + (R.race() === 'beast' ? 4 : -3)); }, fame: 4, text: '수인들이 빈 땅을 일구기 시작했다.' },
      { label: '식량만 나눠 주고 돌려보낸다', realm: { food: -60 }, fame: 1, text: '피난민들이 고개를 숙이고 남쪽으로 떠났다.' },
      { label: '성문을 닫는다', realm: { order: 1 }, fame: -2, text: '울음소리가 밤새 들렸다.' },
    ] },
  { id: 'orcEnvoy', when: s => s.monthN >= 30 && !s.flags.orcPeace, weight: .5,
    text: '초원의 오크 부족장이 사절을 보냈다. 뼈 목걸이를 건 거구가 말했다. "강한 자와는 싸우지 않는다. 증명하라."',
    choices: [
      { label: '팔씨름으로 증명한다', check: { stat: 'might', g: 'B' }, ok: { flag: 'orcPeace', fame: 5, text: '사절의 팔이 탁자에 닿았다. "형제여." 오크 부족이 영지를 넘보지 않기로 했다.' }, no: { fame: -1, text: '팔이 꺾였다. 사절이 비웃으며 돌아갔다.' } },
      { label: '공물을 주고 평화를 산다', realm: { gold: -120 }, flag: 'orcPeace', text: '오크들이 금화를 세며 웃었다. 당분간 오크 습격은 없을 것이다.' },
      { label: '돌려보낸다', text: '사절이 침을 뱉고 떠났다.' },
    ] },
);

/* ── 오러 · 서클 · 용병 ── */
RE.push(
  { id: 'masterVisit', when: s => s.aura && s.aura.lv >= 2 && s.aura.lv < 5, weight: .5,
    text: '떠돌이 노검객이 성에 묵었다. 그의 검끝에 푸른 오러가 길게 뻗어 있었다. 소드 마스터다.',
    choices: [
      { label: '가르침을 청한다', check: { stat: 'might', g: 'B' }, ok: { do: s => { s.aura.xp += 70; }, text: '사흘 밤낮 검을 맞댔다. 오러의 흐름이 보였다. (오러 수련 +70)' }, no: { do: s => { s.aura.xp += 25; }, text: '아직 이르다며 기초만 봐 주었다. (오러 수련 +25)' } },
      { label: '대접만 한다', realm: { gold: -15 }, fame: 2, text: '노검객이 고맙다며 길을 떠났다.' },
    ] },
  { id: 'mageTower', when: s => s.circle && s.circle.lv >= 3, weight: .5,
    text: '마탑에서 초대장이 왔다. "서클의 새 이론을 발표하는 자리에 영주 마법사를 모십니다."',
    choices: [
      { label: '참석해 토론한다', check: { stat: 'lore', g: 'B' }, ok: { do: (s, R) => { s.circle.xp += 90; R.favor(3); }, fame: 4, text: '탑의 대마법사들이 내 이론을 받아 적었다. (마나 수련 +90)' }, no: { do: s => { s.circle.xp += 30; }, text: '토론에선 밀렸지만 배운 게 많았다. (마나 수련 +30)' } },
      { label: '마석을 사 온다', realm: { gold: -100 }, goods: { mana: 3 }, text: '마탑 상점의 마석은 질이 좋았다.' },
    ] },
  { id: 'mercExposed', when: s => s.merc && s.merc.g >= 3, weight: .6, once: true,
    text: (s) => `선술집에서 누군가 외쳤다. "저 '${s.merc.alias}'가… 우리 영주님이잖아?!"`,
    choices: [
      { label: '가면을 벗는다', fame: 12, do: (s, R) => R.favor(-3), text: '술잔이 일제히 높이 올라갔다. 귀족들은 체면이 깎였다며 혀를 찼다.' },
      { label: '시치미를 뗀다', check: { stat: 'charm', g: 'C' }, ok: { text: '"영주님이 이런 곳에 오실 리가!" 모두 웃고 넘어갔다.' }, no: { fame: 6, text: '아무도 믿지 않았다. 소문은 이미 퍼졌다.' } },
    ] },
  { id: 'dragonRumor', when: s => (s.aura && s.aura.lv >= 4) || (s.circle && s.circle.lv >= 6), weight: .4, once: true,
    text: '왕국 곳곳에서 이야기가 들린다. "그 영주라면 고룡도 벨 수 있을 거야."',
    choices: [{ label: '웃어넘긴다', fame: 10, do: (s, R) => R.favor(5), text: '이름이 대륙 너머까지 퍼지기 시작했다.' }] },
);

/* ── 노예 (해방만) ── */
RE.push(
  { id: 'slaverRevenge', when: s => !!(s.laws && s.laws.noSlavery), weight: .7,
    text: '노예 매매를 금지한 뒤, 노예상들이 고용한 무뢰배가 국경 마을을 습격했다!',
    choices: [
      { label: '직접 말을 몬다', fight: 'bandit', win: { text: '무뢰배를 쓸어버렸다. 노예상들이 다시는 얼씬하지 않을 것이다.', fame: 5, realm: { order: 4 } }, lose: { text: '놓쳤다. 마을 창고가 털렸다.', realm: { food: -60 } } },
      { label: '기사들을 보낸다', realm: { men: -3, order: 3 }, text: '기사들이 무뢰배를 몰아냈다. 다친 병사가 나왔다.' },
    ] },
  { id: 'slaveGift', when: s => s.age >= 20 && s.peer >= 1, weight: .4,
    text: '이웃 귀족이 "우정의 표시"라며 사슬에 묶인 사람을 보내왔다.',
    choices: [
      { label: '그 자리에서 해방시킨다', do: (s, R) => { R.mkPerson('freed', { met: true, aff: 50, extra: { job: null } }); }, fame: 3, realm: { morale: 2 }, text: '사슬을 풀어 주었다. "…감사합니다." 그는 스스로 성에 남기로 했다.' },
      { label: '해방시켜 고향으로 보내 주고, 선물은 정중히 돌려보낸다', fame: 2, do: (s, R) => R.favor(-1), text: '이웃 귀족은 의아해했지만, 그 사람은 집으로 돌아갔다.' },
    ] },
  { id: 'freedThanks', when: s => (s.rec.freed || 0) >= 2, weight: .4, once: true,
    text: '해방된 이들이 모여 작은 감사 잔치를 열었다. 투박한 노래가 성 안뜰을 채웠다.',
    choices: [{ label: '함께 잔을 든다', realm: { morale: 5 }, fame: 4, text: '그날 밤, 성은 오래도록 밝았다.' }] },
);

/* ── 연애 · 가족 ── */
RE.push(
  { id: 'ballMeet', when: s => s.age >= 20 && !s.spouse, weight: .8,
    text: '이웃 영지의 무도회. 촛불 아래, 누군가와 눈이 마주쳤다.',
    choices: [
      { label: '춤을 청한다', check: { stat: 'charm', g: 'D' }, ok: { do: (s, R) => R.mkPerson('noble', { met: true, aff: 40, place: 'salon' }), text: '음악이 끝날 때까지 손을 놓지 않았다. 다음에 또 보자고 했다. (새 인연)' },
        no: { do: (s, R) => R.mkPerson('noble', { met: true, aff: 20, place: 'salon' }), text: '발을 밟았다. 그래도 웃어 주었다. (새 인연)' } },
      { label: '벽에 기대 구경한다', text: '음악만 듣다 돌아왔다.' },
    ] },
  { id: 'jealousSpouse', when: (s, R) => !!R.spouseP() && !!R.lover(), weight: 1.2,
    text: (s, R) => `${R.josa(R.spouseP().name, '이')} 조용히 물었다. "${R.lover().name}… 그 사람, 어떤 사이예요?"`,
    choices: [
      { label: '솔직하게 말하고 사과한다', do: (s, R) => { R.addAff(R.spouseP(), 4); }, text: '긴 침묵 끝에, 배우자가 고개를 끄덕였다. "…다음엔 먼저 말해 줘요."' },
      { label: '아무 사이도 아니라고 한다', check: { stat: 'charm', g: 'B' }, ok: { text: '배우자는 더 묻지 않았다.' }, no: { do: (s, R) => R.addAff(R.spouseP(), -12), text: '거짓말이 들통났다. 방문이 쾅 닫혔다. (배우자 호감 -12)' } },
    ] },
  { id: 'spouseCare', when: (s, R) => R.spouseP() && R.spouseP().aff >= 70, weight: .5,
    text: (s, R) => `밤늦게까지 장부를 보는데, ${R.josa(R.spouseP().name, '이')} 따뜻한 수프를 들고 왔다.`,
    choices: [{ label: '고맙다며 같이 먹는다', hp: 10, do: (s, R) => R.addAff(R.spouseP(), 3), text: '수프보다 대화가 더 따뜻했다.' }] },
  { id: 'companionPast', when: (s, R) => R.party().length > 0, weight: .5,
    text: (s, R) => `원정 동료 ${R.josa(R.party()[0].name, '이')} 모닥불 앞에서 털어놓았다. "내 고향을 불태운 산적 두목이 이 근처에 있다."`,
    choices: [
      { label: '함께 원수를 갚으러 간다', fight: 'warlord', win: { text: '산적 두목이 쓰러졌다. 동료가 오래 울었다.', fame: 5, do: (s, R) => R.addAff(R.party()[0], 15) }, lose: { text: '두목이 달아났다. 동료가 내 어깨를 두드렸다. "고맙다, 같이 와 줘서."', do: (s, R) => R.addAff(R.party()[0], 6) } },
      { label: '복수는 아무것도 바꾸지 못한다고 말린다', check: { stat: 'charm', g: 'C' }, ok: { text: '동료가 칼을 내려놓았다.', do: (s, R) => R.addAff(R.party()[0], 5) }, no: { text: '동료가 혼자 밤길을 떠났다가 새벽에 돌아왔다.', do: (s, R) => R.addAff(R.party()[0], -5) } },
    ] },
);

/* ── 마을 장소 (마을 나들이에서만) ── */
RE.push(
  { id: 'tavernBrawl', place: 'tavern', weight: 1,
    text: '술 취한 용병 둘이 의자를 집어던지기 시작했다. 주점 주인이 나를 쳐다본다.',
    choices: [
      { label: '둘 다 제압한다', check: { stat: 'might', g: 'C' }, ok: { fame: 3, realm: { order: 2 }, text: '두 사람을 바닥에 눕혔다. 주인이 술 한 통을 공짜로 내왔다.' }, no: { hp: -8, text: '맥주잔이 날아와 이마에 맞았다.' } },
      { label: '한 잔씩 사며 말린다', realm: { gold: -6 }, fx: { charm: [0, 1] }, text: '"영주님 술이라면!" 싸움이 노래로 바뀌었다.' },
    ] },
  { id: 'armWrestle', place: 'tavern', weight: .9,
    text: '구석 탁자에서 팔씨름 내기가 한창이다. "누구든 덤벼라! 판돈 금화 스무 닢!"',
    choices: [
      { label: '소매를 걷는다', check: { stat: 'might', g: 'C' }, ok: { realm: { gold: 20 }, fame: 1, text: '탁자가 쩍 소리를 냈다. 판돈은 내 것.' }, no: { realm: { gold: -20 }, text: '팔이 넘어갔다. 웃음소리가 쏟아졌다.' } },
      { label: '구경만 한다', text: '오크 용병이 연승했다.' },
    ] },
  { id: 'rumorMap', place: 'tavern', weight: .7,
    text: '늙은 사냥꾼이 술값 대신 낡은 지도를 내밀었다. "폐허에 아직 안 털린 방이 있지."',
    choices: [
      { label: '술값을 내고 지도를 산다', realm: { gold: -12 }, check: { stat: 'lore', g: 'C' }, ok: { realm: { gold: 70 }, goods: { mana: 1 }, text: '지도가 진짜였다. 숨은 방에서 금화와 마석을 찾았다.' }, no: { text: '지도는 엉터리였다. 술값만 날렸다.' } },
      { label: '거절한다', text: '사냥꾼이 어깨를 으쓱했다.' },
    ] },
  { id: 'pickpocket', place: 'square', weight: .9,
    text: '시장 인파 속, 누군가 허리춤의 지갑에 손을 뻗었다.',
    choices: [
      { label: '손목을 낚아챈다', check: { stat: 'agility', g: 'C' }, ok: { text: '굶주린 소년이었다. 빵값을 쥐여 보냈다.', realm: { morale: 2, gold: -2 } }, no: { realm: { gold: -15 }, text: '지갑이 사라졌다.' } },
    ] },
  { id: 'spiceDeal', place: 'square', weight: .8,
    text: '항구에서 온 상인이 목소리를 낮췄다. "향신료 한 상자, 오늘만 반값에 드리지요."',
    choices: [
      { label: '흥정한다', check: { stat: 'charm', g: 'C' }, ok: { realm: { gold: -60 }, goods: { spice: 4 }, text: '좋은 값에 샀다. 왕도에 팔면 남는다.' }, no: { realm: { gold: -80 }, goods: { spice: 3 }, text: '상인이 한 수 위였다.' } },
      { label: '지나친다', text: '상인이 다른 손님을 붙잡았다.' },
    ] },
  { id: 'templeBless', place: 'temple', weight: 1,
    text: '늙은 신관이 축복을 내려 주겠다며 손을 들었다.',
    choices: [
      { label: '헌금을 바치고 축복을 받는다', realm: { gold: -10 }, hp: 30, text: '따뜻한 빛이 몸을 감쌌다. 오래된 상처가 아물었다.' },
      { label: '고아원에 기부한다', realm: { gold: -30, morale: 5 }, fame: 2, text: '아이들이 서툰 글씨로 감사 편지를 썼다.' },
    ] },
  { id: 'guildRookie', place: 'guild', weight: .9,
    text: '갓 등록한 신참 용병이 쭈뼛거리며 다가왔다. "저, 검 쥐는 법 좀…"',
    choices: [
      { label: '가르쳐 준다', fx: { command: [1, 2] }, do: (s, R) => R.mkPerson('merc', { met: true, aff: 40, place: 'guild' }), text: '눈이 반짝이는 신참이었다. 언젠가 쓸모 있을 것이다. (새 인연)' },
      { label: '바쁘다고 한다', text: '신참이 풀 죽어 돌아섰다.' },
    ] },
  { id: 'salonGossip', place: 'salon', weight: 1,
    text: '귀족 부인들의 찻잔 너머로 왕실 이야기가 오간다.',
    choices: [
      { label: '귀를 기울인다', check: { stat: 'charm', g: 'C' }, ok: { do: (s, R) => R.favor(4), text: '왕비가 좋아하는 꽃을 알아냈다. 다음 공물에 넣어야겠다. (왕실 공헌 +4)' }, no: { text: '내 이야기가 화제에 오를까 봐 자리를 떴다.' } },
      { label: '시 한 수를 읊는다', check: { stat: 'lore', g: 'B' }, ok: { fame: 4, text: '박수가 쏟아졌다.' }, no: { fame: -1, text: '운율이 어긋났다.' } },
    ] },
);
})();
