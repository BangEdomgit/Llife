// Llife: 영지 — 매달 사건 (js/realm.js monthEvent). 선택지는 능력치 판정(check: { stat, g })이 있으면 성공 ok / 실패 no
//   결과: text · fx(능력치) · realm{gold,food,morale,order,pop,wall,levy,men,knights} · fame · hp · goods{id:n} · fight(적 id → win/lose 결과) · flag · do(s, R)
//   when(s, R): 뜰 조건, weight: 뽑힐 무게, once: 한 번만, story: 이야기 사건(무조건 먼저)
window.REALM = window.REALM || {};
const RE = REALM.events = [];

/* ── 이야기: 아버지의 전쟁 · 기사 서임 · 혼담 ── */
RE.push(
  { id: 'letter1', story: true, once: true, when: s => s.monthN === 3,
    text: '아버지에게서 첫 편지가 왔다. "전선은 길어질 것 같다. 영지를 잘 부탁한다. 백성이 굶지 않게, 성벽이 무너지지 않게."',
    choices: [{ label: '"걱정 마세요, 아버지." 답장을 쓴다', fx: { command: 1 }, text: '편지를 접어 품에 넣었다.' }] },
  { id: 'knighting', story: true, once: true, when: s => s.age >= 16,
    text: '열여섯 살. 기사 서임식 날이다. 늙은 기사단장이 검을 들어 내 어깨에 댔다. "맹세하라."',
    choices: [
      { label: '"약한 자를 지키겠습니다."', fx: { charm: 3, command: 3 }, realm: { morale: 6 }, fame: 5, text: '성 안뜰에 모인 백성들이 환호했다. 이제 나는 기사다.' },
      { label: '"이 땅을 넓히겠습니다."', fx: { might: 3, command: 3 }, fame: 8, text: '기사들이 검으로 방패를 두드렸다. 이제 나는 기사다.' },
      { label: '"지혜로 다스리겠습니다."', fx: { stewardship: 3, lore: 3 }, fame: 5, text: '학자들이 고개를 끄덕였다. 이제 나는 기사다.' },
    ] },
  { id: 'fatherFate', story: true, once: true, when: s => s.monthN >= 30 && s.monthN <= 60 && Math.random() < .08,
    text: '전선에서 전령이 말을 몰고 왔다. 얼굴이 굳어 있었다.',
    choices: [{ label: '편지를 연다', do: (s, R) => R.fatherFate() }] },
  { id: 'proposal', when: s => s.age >= 17 && !s.spouse && !s.flags.noMarry && (s.monthN - (s.lastProposal ?? -99)) >= 10, weight: 1.4,
    text: (s, R) => { const h = R.proposalHouse(); return `${h.sym} ${h.name} 가문에서 혼담이 왔다. ${h.trait}. 상대는 ${R.proposalWho().name}(${R.proposalWho().age}살)이라고 한다.`; },
    choices: [
      { label: '혼담을 받아들인다', do: (s, R) => R.marry() },
      { label: '직접 만나 보고 정한다 (화술 판정)', check: { stat: 'charm', g: 'C' }, ok: { do: (s, R) => R.marry(true) }, no: { text: '어색한 만남이었다. 상대 가문이 혼담을 거뒀다.', do: s => { s.lastProposal = s.monthN; } } },
      { label: '아직은 이르다며 거절한다', text: '사절이 정중히 물러갔다.', do: s => { s.lastProposal = s.monthN; } },
    ] },
  { id: 'heir', when: s => !!s.spouse && s.age <= 48 && (s.children || []).length < 4 && Math.random() < .35, weight: 1,
    text: (s, R) => `${R.spouseName()}이(가) 수줍게 말했다. "아이가 생겼어요."`,
    choices: [{ label: '기뻐하며 끌어안는다', do: (s, R) => R.child(), text: '성 안에 경사가 났다.' }] },
);

/* ── 영지 ── */
RE.push(
  { id: 'boundary', weight: 1.2,
    text: '두 농부가 밭 경계를 두고 다투다 영주의 판결을 청했다. 서로 조상 대대로 자기 땅이라고 한다.',
    choices: [
      { label: '옛 토지 대장을 뒤져 판결한다', check: { stat: 'stewardship', g: 'C' }, ok: { text: '대장에 경계석 위치가 적혀 있었다. 두 사람 모두 판결에 승복했다.', realm: { order: 5, morale: 3 }, fx: { stewardship: 1 } }, no: { text: '대장이 낡아 알아볼 수 없었다. 어설픈 판결에 한쪽이 원망을 품었다.', realm: { order: -3 } } },
      { label: '땅을 반으로 나누라고 한다', text: '둘 다 투덜거렸지만 싸움은 멎었다.', realm: { order: 2 } },
      { label: '말재주로 화해시킨다', check: { stat: 'charm', g: 'C' }, ok: { text: '술 한 잔에 둘이 웃으며 악수했다. 마을에 내 이야기가 돌았다.', realm: { morale: 5 }, fame: 2 }, no: { text: '화해는커녕 내 앞에서 주먹다짐이 났다.', realm: { order: -4 } } },
    ] },
  { id: 'thief', weight: 1,
    text: '곡물 창고를 턴 도둑이 붙잡혀 왔다. 굶주린 아이들을 먹이려 했다고 한다.',
    choices: [
      { label: '법대로 매질한다', realm: { order: 6, morale: -4 }, text: '광장에 사람들이 모였다. 아무도 창고를 넘보지 않게 됐다.' },
      { label: '용서하고 일자리를 준다', realm: { morale: 5, order: -3 }, text: '도둑은 성의 마구간지기가 됐다. 사람들이 영주의 자비를 이야기했다.' },
      { label: '거짓말인지 캐묻는다 (학식 판정)', check: { stat: 'lore', g: 'D' }, ok: { text: '말이 앞뒤가 맞지 않았다. 배후의 장물아비까지 잡았다.', realm: { order: 8, gold: 20 } }, no: { text: '진실은 알 수 없었다. 마지못해 풀어 줬다.', realm: { order: -2 } } },
    ] },
  { id: 'merchants', weight: 1.1,
    text: '먼 남쪽에서 온 상단이 성문 앞에 짐마차를 세웠다. 통행세를 두고 흥정이 시작됐다.',
    choices: [
      { label: '통행세를 넉넉히 받는다', realm: { gold: 35 }, text: '상인들이 투덜대며 금화를 세어 줬다.' },
      { label: '세금을 깎아 주고 시장을 열게 한다', realm: { gold: 10, morale: 4 }, goods: { spice: 1 }, text: '광장에 장이 섰다. 상단 우두머리가 향신료 한 상자를 선물했다.' },
      { label: '좋은 값에 물건을 사들인다 (화술 판정)', check: { stat: 'charm', g: 'C' }, ok: { text: '반값에 와인과 소금을 사들였다.', goods: { wine: 3, salt: 3 }, realm: { gold: -25 } }, no: { text: '바가지를 쓰고 말았다.', goods: { wine: 2 }, realm: { gold: -40 } } },
    ] },
  { id: 'bard', weight: .8,
    text: '떠돌이 음유시인이 성 연회장에서 노래하게 해 달라고 청했다.',
    choices: [
      { label: '연회를 열어 준다 (금화 20)', realm: { gold: -20, morale: 5 }, fame: 4, text: '시인이 내 이름을 넣어 노래를 지었다. 노래가 이웃 영지까지 퍼졌다.' },
      { label: '함께 노래한다 (화술 판정)', check: { stat: 'charm', g: 'B' }, ok: { text: '성이 떠나갈 듯한 박수. 시인이 "영주님 목소리를 노래에 넣겠다"며 웃었다.', fame: 7, realm: { morale: 4 } }, no: { text: '음이 하늘로 날아갔다. 다들 웃었고, 그래도 분위기는 좋았다.', realm: { morale: 2 } } },
      { label: '돌려보낸다', text: '시인은 다음 마을로 떠났다.' },
    ] },
  { id: 'plague', weight: .6, when: s => s.monthN > 6,
    text: '아랫마을에 열병이 돈다. 벌써 몇 집이 문을 걸어 잠갔다.',
    choices: [
      { label: '약초와 치료법을 연구한다 (학식 판정)', check: { stat: 'lore', g: 'B' }, ok: { text: '버드나무 껍질 달인 물로 열을 내렸다. 병이 잦아들었다.', fx: { lore: 2 }, fame: 4, realm: { morale: 5 } }, no: { text: '치료는 듣지 않았다. 마을 사람 여럿이 죽었다.', realm: { pop: -40, morale: -6 } } },
      { label: '마을을 봉쇄한다', realm: { pop: -15, morale: -5, order: 3 }, text: '병은 번지지 않았지만, 봉쇄된 마을의 원망이 컸다.' },
      { label: '신전에 기도와 구호를 맡긴다 (금화 30)', realm: { gold: -30, pop: -10, morale: 3 }, do: (s, R) => { if (s.realm.b.temple >= 2) R.log('신전 사제들이 능숙하게 환자를 돌봤다.'); }, text: '사제들이 환자를 돌봤다.' },
    ] },
  { id: 'badHarvest', weight: .7, when: s => [4, 5, 6].includes(s.month),
    text: '봄비가 너무 적다. 늙은 농부들이 올해 수확이 걱정이라며 하늘만 본다.',
    choices: [
      { label: '수로를 파게 한다 (정무 판정)', check: { stat: 'stewardship', g: 'C' }, ok: { text: '강물을 끌어 밭을 적셨다. 가을이 기대된다.', realm: { gold: -25 }, flag: 'irrigated' }, no: { text: '수로가 중간에 무너졌다. 돈만 날렸다.', realm: { gold: -25, morale: -3 } } },
      { label: '곡물을 미리 사서 비축한다 (금화 40)', realm: { gold: -40, food: 160 }, text: '창고가 든든해졌다.' },
      { label: '하늘에 맡긴다', text: '농부들이 한숨을 쉬었다.', flag: 'drought' },
    ] },
  { id: 'mercs', weight: .8,
    text: '전쟁에서 돌아오던 용병단이 성문을 두드렸다. "겨울 날 곳과 금화만 주면 영주님 칼이 되겠소."',
    choices: [
      { label: '고용한다 (금화 90 → 상비병 25)', when: s => s.realm.gold >= 90, realm: { gold: -90, men: 25 }, text: '거친 사내들이 병영에 짐을 풀었다.' },
      { label: '우두머리와 결투로 값을 정한다', fight: 'knight', win: { text: '우두머리가 무릎을 꿇었다. "반값에 모시겠소."', realm: { gold: -45, men: 25 }, fame: 5 }, lose: { text: '흙바닥에 쓰러졌다. 용병단은 비웃으며 떠났다.', fame: -3 } },
      { label: '돌려보낸다', text: '용병들이 다른 영지로 향했다. 그쪽이 걱정이었다.' },
    ] },
  { id: 'deserters', weight: .6, when: s => s.realm.troops.levy > 30,
    text: '밤사이 징집병 여럿이 창을 버리고 도망쳤다. 남은 병사들도 술렁인다.',
    choices: [
      { label: '연설로 사기를 다잡는다 (통솔 판정)', check: { stat: 'command', g: 'C' }, ok: { text: '"너희 가족을 지키는 창이다!" 병사들이 함성을 질렀다.', realm: { order: 4 }, fx: { command: 1 } }, no: { text: '연설은 허공에 흩어졌다. 몇 명이 더 도망쳤다.', realm: { levy: -10 } } },
      { label: '추격해 붙잡아 온다', realm: { order: 3, morale: -3 }, text: '도망병을 끌고 왔다. 병영은 조용해졌다.' },
      { label: '보급을 늘린다 (식량 60)', realm: { food: -60, morale: 2 }, text: '배부른 병사는 도망치지 않았다.' },
    ] },
  { id: 'festival', weight: 1, when: s => [9, 10].includes(s.month), once: false,
    text: '가을걷이가 끝났다. 마을 원로들이 수확제를 열어도 되겠냐고 묻는다.',
    choices: [
      { label: '성대하게 연다 (금화 40)', realm: { gold: -40, morale: 10 }, fame: 3, text: '모닥불, 사과주, 춤. 영주님 만세 소리가 밤새 이어졌다.' },
      { label: '조촐하게 연다', realm: { morale: 4 }, text: '소박하지만 따뜻한 밤이었다.' },
      { label: '마상 창술 시합을 연다 (직접 출전)', fight: 'knight', win: { text: '우승! 관중이 꽃을 던졌다.', fame: 8, realm: { morale: 6 } }, lose: { text: '말에서 떨어졌다. 관중이 웃었지만 박수도 쳐 줬다.', realm: { morale: 3 } } },
    ] },
  { id: 'vein', weight: .5, when: s => s.land === 'mine' || Math.random() < .3,
    text: '광부들이 새 갱도에서 푸르게 빛나는 돌을 캐 왔다. 마석일지도 모른다.',
    choices: [
      { label: '감정해 본다 (마력 판정)', check: { stat: 'arcana', g: 'D' }, ok: { text: '진짜 마석이다! 맥을 따라 더 캐냈다.', goods: { mana: 3 }, fx: { arcana: 1 } }, no: { text: '그냥 푸른 돌이었다. 광부들이 머쓱해했다.' } },
      { label: '갱도를 넓힌다 (금화 50)', realm: { gold: -50 }, goods: { mana: 1, iron: 4 }, text: '철과 마석 한 덩이가 나왔다.' },
    ] },
  { id: 'envoy', weight: .7, when: s => s.monthN > 8,
    text: '이웃 남작의 사절이 왔다. "강 건너 숲은 원래 우리 땅이오. 공물을 바치면 시비를 걸지 않겠소."',
    choices: [
      { label: '공물을 바친다 (금화 60)', realm: { gold: -60 }, text: '사절이 만족해 돌아갔다. 기사들은 분해했다.', fame: -3 },
      { label: '옛 문서로 반박한다 (학식 판정)', check: { stat: 'lore', g: 'C' }, ok: { text: '할아버지 대의 하사 문서를 내밀었다. 사절이 얼굴을 붉히며 물러났다.', fame: 4 }, no: { text: '문서를 찾지 못했다. 사절이 비웃으며 떠났다. 남작의 군대가 움직인다는 소문이 돈다.', do: (s, R) => R.spawnThreat('baron') } },
      { label: '"와서 가져가 보시오."', fame: 5, do: (s, R) => R.spawnThreat('baron'), text: '사절이 이를 갈며 떠났다. 전쟁 준비를 해야 한다.' },
    ] },
  { id: 'wizard', weight: .5, when: s => s.stats.arcana < 70,
    text: '회색 망토의 마법사가 하룻밤 묵어가길 청했다. 지팡이 끝에 작은 불꽃이 떠 있다.',
    choices: [
      { label: '가르침을 청한다 (학식 판정)', check: { stat: 'lore', g: 'D' }, ok: { text: '밤새 룬을 배웠다. 손끝에 처음으로 불씨가 맺혔다.', fx: { arcana: 6, lore: 2 } }, no: { text: '이야기가 너무 어려웠다. 그래도 별자리 몇 개는 외웠다.', fx: { lore: 1 } } },
      { label: '마석을 팔라고 한다', goods: { mana: 1 }, realm: { gold: -45 }, text: '마법사가 푸른 돌 하나를 내밀었다.' },
      { label: '경계하며 돌려보낸다', text: '마법사는 웃으며 밤길로 사라졌다.' },
    ] },
  { id: 'duelChallenge', weight: .6, when: s => s.age >= 16,
    text: '떠돌이 기사가 성문 앞에서 외쳤다. "이 땅의 주인과 겨루고 싶소! 내가 지면 내 말을 주겠소."',
    choices: [
      { label: '도전을 받는다', fight: 'knight', win: { text: '기사가 투구를 벗고 고개를 숙였다. 좋은 말 한 필을 얻었다.', fame: 7, realm: { knights: 1 } }, lose: { text: '흙바닥에 나뒹굴었다. 기사는 웃으며 떠났다.', fame: -4 } },
      { label: '기사단장에게 맡긴다', text: '기사단장이 싸워 이겼다. 백성들이 조금 실망했다.', fame: -1 },
    ] },
  { id: 'huntInvite', weight: .7,
    text: '이웃 귀족들이 사냥 대회에 초대했다. 멧돼지 사냥이라고 한다.',
    choices: [
      { label: '참가한다 (민첩 판정)', check: { stat: 'agility', g: 'C' }, ok: { text: '큰 멧돼지를 한 화살에 잡았다. 귀족들 사이에 이름이 났다.', fame: 5, fx: { agility: 1 } }, no: { text: '말이 놀라 떨어질 뻔했다. 사냥감은 남의 차지였다.', hp: -6 } },
      { label: '연회에서 인맥을 쌓는다 (화술 판정)', check: { stat: 'charm', g: 'C' }, ok: { text: '여러 가문과 안면을 텄다. 혼담 이야기가 오갈 것 같다.', fame: 3, do: s => { s.lastProposal = -99; } }, no: { text: '농담이 빗나갔다. 어색하게 잔만 비웠다.' } },
      { label: '정중히 거절한다', text: '영지 일이 바빴다.' },
    ] },
  { id: 'winterWolves', weight: 1, when: s => [12, 1, 2].includes(s.month),
    text: '눈이 깊어지자 늑대들이 마을 가축우리를 노린다.',
    choices: [
      { label: '직접 사냥에 나선다', fight: 'wolf', win: { text: '우두머리 늑대를 쓰러뜨렸다. 늑대 가죽이 마을 회관에 걸렸다.', realm: { morale: 4 }, fame: 2, goods: { wool: 2 } }, lose: { text: '늑대에게 물려 쓰러졌다. 병사들이 나를 업고 돌아왔다.', realm: { morale: -2 } } },
      { label: '병사들을 보낸다', realm: { levy: -3, order: 2 }, text: '징집병 몇이 다쳤지만 늑대를 쫓아냈다.' },
      { label: '울타리를 높인다 (금화 15)', realm: { gold: -15 }, text: '피해가 줄었다.' },
    ] },
  { id: 'scholar', weight: .5,
    text: '왕립 학회에서 수학 문제를 담은 편지가 왔다. 풀면 학회 회원으로 이름을 올려 준다고 한다.',
    choices: [
      { label: '밤새 푼다 (학식 판정)', check: { stat: 'lore', g: 'B' }, ok: { text: '답장이 왔다. "귀하를 학회 명예 회원으로 모십니다."', fame: 6, fx: { lore: 2 } }, no: { text: '양피지만 잔뜩 버렸다.', fx: { lore: 1 } } },
      { label: '덮어 둔다', text: '서랍 속에 넣었다.' },
    ] },
  { id: 'smugglers', weight: .6, when: s => s.land === 'river' || Math.random() < .4,
    text: '강가 창고에서 밀수꾼들이 세금 없이 물건을 빼돌리다 들켰다.',
    choices: [
      { label: '물건을 압수한다', goods: { salt: 3, wine: 2 }, realm: { order: 3 }, text: '창고 가득한 소금과 와인을 압수했다.' },
      { label: '뒷돈을 받고 눈감아 준다', realm: { gold: 50, order: -6 }, fame: -2, text: '금화 주머니가 묵직했다. 소문이 나지 않길 바랐다.' },
      { label: '두목을 직접 잡는다', fight: 'bandit', win: { text: '두목을 사로잡았다. 밀수 조직이 뿌리 뽑혔다.', realm: { order: 8, gold: 25 }, fame: 3 }, lose: { text: '두목이 나를 밀치고 강으로 뛰어들었다.', realm: { order: -2 } } },
    ] },
);

/* ── 아무 일 없는 달의 한 줄 ── */
REALM.quiet = {
  spring: ['밭마다 쟁기질이 한창이다.', '성벽 위로 제비가 날아들었다.', '어린 양들이 언덕에서 뛰논다.'],
  summer: ['뙤약볕 아래 밀이 익어 간다.', '강에서 아이들이 물장구를 친다.', '성 안뜰에 무화과가 열렸다.'],
  autumn: ['황금빛 밀밭이 바람에 일렁인다.', '사과주 담그는 냄새가 마을에 가득하다.', '철새가 남쪽으로 떠났다.'],
  winter: ['눈이 성벽을 하얗게 덮었다.', '화롯가에서 기사들이 옛 전투 이야기를 한다.', '얼어붙은 강 위로 썰매가 달린다.'],
};
