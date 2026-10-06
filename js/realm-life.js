// Llife: 영지 — 확장: 사람(NPC 명부·교류·연애·혼인·측실·밤 초대) · 마을 나들이 · 용병 길드 · 노예시장(해방) · 법령 · 왕실 공헌과 작위 승급 · 임신
//   엔진(js/realm.js)의 Realm._k(내부 도구)를 씀. 데이터는 data/realm-world.js
//   원칙: 사귈 수 있는 사람은 나도 상대도 20살 이상. 부리는 사람(시녀·시종·집사·기사단장)과 해방민은 구애 대상이 아님.
//         밤 초대는 연인·배우자·측실에게만, 상대가 거절할 수 있고 거절해도 불이익 없음. 신분으로 강요하는 선택지는 없음.
//         노예시장에서는 사람을 '소유'하지 않음 — 값을 치르면 그 자리에서 해방, 남을지는 본인이 정함
(() => {
const K = window.Realm._k, D = window.REALM;
const { rand, randf, pick, clamp, josa, log, emit, gainStats, realmDelta, weighted } = K;
const st = () => K.S;
const wKey = w => { const ks = Object.keys(w); let t = Math.random() * ks.reduce((a, k) => a + w[k], 0); for (const k of ks) { t -= w[k]; if (t <= 0) return k; } return ks[0]; };
const myLv = () => D.ranks[K.PEER().id].lv;
const PN = Object.keys(D.personalities);

/* ═════ 사람 만들기 ═════ */
function raceAge(race) { return race === 'elf' ? rand(45, 230) : race === 'dwarf' ? rand(28, 110) : rand(20, 44); }
function nameFor(race, g) { return race !== 'human' && D.raceNames[race] ? pick(D.raceNames[race][g]) : pick(D.names[g]); }
function mkPerson(role, o = {}) {
  const R = D.roles[role] || D.roles.merc, S = st();
  const g = o.gender || (Math.random() < .5 ? 'm' : 'f'), race = o.race || wKey(D.townRaces), RC = D.races[race];
  const p = { role, gender: g, race, beast: race === 'beast' ? (o.beast || pick(Object.keys(RC.subs))) : null, age: o.age || raceAge(race), name: o.name || nameFor(race, g),
    rank: o.rank || (role === 'noble' ? pick(['baron', 'baron', 'viscount', 'count']) : R.rank), personality: o.personality || pick(PN), aff: o.aff ?? 15, rel: '', met: !!o.met,
    seed: 'np' + Math.floor(Math.random() * 1e9), mo: {}, gear: { knight: 6, captain: 8, merc: 4, freed: 2, mage: 3, priest: 2 }[role] || 1 };
  const sr = R.stats || [10, 25];
  p.might = clamp(Math.round(rand(sr[0], sr[1]) + (RC.bonus.might || 0)), 5, 100);
  p.agility = clamp(Math.round(rand(sr[0], sr[1]) + (RC.bonus.agility || 0)), 5, 100);
  p.vigor = clamp(Math.round(rand(sr[0], sr[1]) + (RC.bonus.vigor || 0)), 5, 100);
  p.arcana = clamp(Math.round(rand(5, 25) + (RC.bonus.arcana || 0) + (R.circle ? 25 : 0)), 0, 100);
  p.aura = R.aura ? clamp(rand(R.aura[0], R.aura[1]) + (RC.aura >= 1.2 && Math.random() < .4 ? 1 : 0), 0, 6) : 0;
  p.circle = R.circle ? clamp(rand(R.circle[0], R.circle[1]) + (race === 'elf' ? 1 : 0), 0, 9) : 0;
  if (o.place) p.place = o.place;
  if (o.stranger) p.stranger = true;
  Object.assign(p, o.extra || {});
  return K.addPerson(p);
}
// 사람의 강함 (내 강함과 같은 식)
function cpP(p) { return K.cpOf({ atk: K.compAtk(p), def: 1 + (p.vigor || 20) * .06 + (p.gear || 1) * .6, hp: 40 + (p.vigor || 20) * 1.1, agility: p.agility || 20, aura: p.aura || 0, circle: p.circle || 0, arcana: p.arcana || 10, magicK: (D.races[p.race] || D.races.human).magic }); }
const FAMILY = ['father', 'mother', 'sibling', 'child'];
function canRomance(p) {
  const S = st();
  if (!p.alive || FAMILY.includes(p.role) || S.age < 20 || p.age < 20) return false;
  if (p.rel) return true;
  return !!(D.roles[p.role] && D.roles[p.role].romance);
}
const canFight = p => p.alive && !FAMILY.includes(p.role) && D.roles[p.role] && D.roles[p.role].fight && p.age >= 20;

/* ═════ 집안 사람들 (본편 시작 · 예전 저장) ═════ */
function fillPerson(p) {
  const S = st();
  if (p.seed) return;
  p.seed = 'np' + Math.floor(Math.random() * 1e9); p.mo = p.mo || {};
  if (!p.race) p.race = FAMILY.includes(p.role) ? S.race : 'human';
  if (p.race === 'beast' && !p.beast) p.beast = S.beast || 'wolf';
  p.personality = p.personality || pick(PN);
  p.aff = p.aff ?? (FAMILY.includes(p.role) ? 70 : p.role === 'spouse' ? 55 : 35);
  p.rank = p.rank || (FAMILY.includes(p.role) || p.role === 'spouse' ? K.PEER().id : (D.roles[p.role] || {}).rank || 'commoner');
  if (p.role === 'spouse') p.rel = 'spouse';
  p.met = true;
  if (p.role === 'captain') Object.assign(p, { might: 62, agility: 45, vigor: 58, arcana: 8, aura: 2, circle: 0, gear: 8 });
  else Object.assign(p, { might: p.might || 18, agility: p.agility || 20, vigor: p.vigor || 25, arcana: p.arcana || 8, aura: p.aura || 0, circle: p.circle || 0, gear: p.gear || 1 });
}
function household() {
  const S = st();
  S.people.forEach(fillPerson);
  if (S.flags.household) return;
  S.flags.household = true;
  const has = r => S.people.some(p => p.role === r && p.alive);
  if (!has('knight')) { mkPerson('knight', { race: 'human', met: true, aff: 35 }); mkPerson('knight', { race: pick(['human', 'human', 'dwarf', 'beast', 'orc']), met: true, aff: 30 }); }
  if (!has('mage')) mkPerson('mage', { race: Math.random() < .5 ? 'elf' : 'human', met: true, aff: 25 });
  if (!has('maid')) mkPerson('maid', { gender: 'f', race: pick(['human', 'human', 'beast']), met: true, aff: 40, age: rand(24, 40) });
  if (!has('page')) mkPerson('page', { gender: 'm', race: 'human', met: true, aff: 40, age: rand(22, 35) });
}
K.HOOK.begin.push(household);
K.HOOK.load.push(s => { if (s.stage === 'main') setTimeout(() => { if (st() === s) { household(); emit(); } }, 0); });

/* ═════ 교류 ═════ */
// 호감 배율: 성격이 좋아하는 일 ×1.5, 같은 종족 ×1.15, 신분 차이(내가 높으면 ×1.1, 낮으면 ×0.85), 편견(인간 귀족·평민이 비인간 영주를 볼 때)
function affK(p, kind) {
  const S = st(), P = D.personalities[p.personality] || D.personalities.warm;
  let k = P.likes.includes(kind) ? 1.5 : 1;
  if (p.race === S.race) k *= 1.15;
  const their = (D.ranks[p.rank] || D.ranks.commoner).lv;
  k *= myLv() > their ? 1.1 : myLv() < their ? .85 : 1;
  if (p.race === 'human' && S.race !== 'human' && p.aff < 50) k *= 1 - K.RACE().prej * .5;
  if (S.flags.hero) k *= 1.1;
  return k;
}
const used = (p, kind) => p.mo && p.mo[kind] === st().monthN;
const mark = (p, kind) => { p.mo = p.mo || {}; p.mo[kind] = st().monthN; };
const addAff = (p, v) => { const b = p.aff; p.aff = clamp(Math.round(p.aff + v), 0, 100); return p.aff - b; };
const line = (p, good) => (D.personalities[p.personality] || D.personalities.warm).line[good ? 'good' : 'bad'];
const relName = { lover: '연인', spouse: '배우자', consort: '측실' };

// 할 수 있는 교류 목록 (화면 버튼)
function options(p) {
  const S = st(), o = [], rom = canRomance(p), busy = K.busy();
  if (!p.alive || busy) return o;
  o.push({ id: 'talk', label: '💬 대화', ok: !used(p, 'talk'), note: used(p, 'talk') ? '이번 달 함' : `화술 판정 ${K.checkPct({ stat: 'charm', g: 'D' })}%` });
  const gc = (D.ranks[p.rank] || {}).lv >= 4 ? 40 : 15;
  o.push({ id: 'gift', label: `🎁 선물 (💰${gc})`, ok: !used(p, 'gift') && S.realm.gold >= gc });
  if (canFight(p)) o.push({ id: 'spar', label: '⚔️ 대련', ok: !used(p, 'spar') && S.hp > 10, note: `내 강함 ${K.myCP()} vs ${cpP(p)}` });
  if (rom && p.aff >= 25) o.push({ id: 'date', label: '🌹 함께 시간 보내기 (💰10)', ok: !used(p, 'date') && S.realm.gold >= 10 });
  if (rom && !p.rel && p.aff >= 55) o.push({ id: 'confess', label: '💘 마음을 고백한다', ok: !used(p, 'confess') && !(p.coolUntil > S.monthN), note: `받아 줄 확률 ${confessPct(p)}%` });
  if (p.rel === 'lover' && !S.spouse && p.aff >= 75) o.push({ id: 'propose', label: '💍 청혼한다 (💰50 혼례)', ok: !used(p, 'propose') && S.realm.gold >= 50, note: `${proposePct(p)}%` });
  if (p.rel === 'lover' && S.spouse && S.peer >= 1 && p.aff >= 70) o.push({ id: 'consort', label: '👑 측실로 맞기를 청한다', ok: !used(p, 'consort'), note: `동의할 확률 ${consortPct(p)}% · 배우자가 서운해함` });
  if (p.rel && p.aff >= 50 && S.age >= 20 && p.age >= 20) o.push({ id: 'night', label: '🌙 오늘 밤 함께하자고 청한다', ok: !used(p, 'night'), note: `응할 확률 약 ${nightPct(p)}% · 거절할 수 있음` });
  if (canFight(p) && p.role !== 'captain') {
    const inP = (S.party || []).includes(p.id), hire = p.role === 'merc' && !p.hired;
    if (hire) o.push({ id: 'hire', label: `🪙 용병으로 고용 (월 💰${wage(p)})`, ok: p.aff >= 25 && S.realm.gold >= wage(p), note: p.aff < 25 ? '호감 25부터' : '' });
    else o.push({ id: 'party', label: inP ? '↩️ 동료에서 뺀다' : '🤝 원정 동료로 데려간다', ok: inP || ((S.party || []).length < 2 && p.aff >= 30), note: !inP && p.aff < 30 ? '호감 30부터' : '최대 2명' });
  }
  if (p.rel === 'lover') o.push({ id: 'part', label: '💔 헤어진다', ok: true });
  return o;
}
const wage = p => 4 + Math.round(cpP(p) / 12);
const confessPct = p => { const S = st(); return clamp(Math.round(18 + (p.aff - 55) * 2 + S.stats.charm / 4 + (myLv() - (D.ranks[p.rank] || D.ranks.commoner).lv) * 2 + S.fame / 40), 5, 95); };
const proposePct = p => clamp(Math.round(30 + (p.aff - 75) * 3 + st().stats.charm / 5), 10, 95);
const consortPct = p => clamp(Math.round(25 + (p.aff - 70) * 2.5 + { shy: 5, warm: 5, cheerful: 0, cool: -5, proud: -15 }[p.personality]), 5, 90);
const nightPct = p => clamp(Math.round(40 + (p.aff - 50) * 1.3 + (p.rel === 'spouse' ? 8 : 0)), 10, 92);

// 밤 장면 문장 (암시까지만)
const NIGHT_YES = {
  warm: ['"…좋아요." 손을 잡아 오는 손바닥이 따뜻했다.', '그가 웃으며 촛불을 하나 남기고 나머지를 껐다.'],
  proud: ['"흥, 오늘만 특별히야." 그러면서도 먼저 손을 끌어당겼다.', '"늦으면 문 잠근다." 등을 돌린 귀끝이 붉었다.'],
  cheerful: ['"기다렸어요!" 웃음소리가 복도 끝까지 울렸다.', '장난스럽게 베개를 던지더니 금세 조용해졌다.'],
  shy: ['고개를 숙인 채, 아주 작게 고개를 끄덕였다.', '"…불, 꺼 주세요." 목소리가 떨렸다.'],
  cool: ['"알겠습니다." 짧은 대답과 달리 눈빛이 오래 머물렀다.', '말없이 망토를 벗어 의자에 걸었다.'],
};
const NIGHT_NO = {
  warm: '"오늘은 너무 피곤해요… 내일은 꼭요."', proud: '"오늘은 기분이 아니야."', cheerful: '"오늘은 친구들이랑 약속이 있어요! 미안해요!"',
  shy: '"…오, 오늘은 좀…" 얼굴이 새빨개져 도망치듯 나갔다.', cool: '"오늘은 혼자 있고 싶습니다."',
};
function act(id, kind) {
  const S = st(), p = S.people.find(x => x.id === id);
  if (!p) return false;
  const opt = options(p).find(o => o.id === kind);
  if (!opt || !opt.ok) return false;
  p.met = true; delete p.stranger;
  const k = affK(p, kind);
  let msg = '';
  if (kind === 'talk') {
    mark(p, 'talk');
    const pc = K.checkPct({ stat: 'charm', g: 'D' }), ok = rand(1, 100) <= pc;
    const d = ok ? addAff(p, rand(3, 6) * k) : addAff(p, rand(-1, 1));
    gainStats({ charm: [0, 1] });
    msg = `💬 ${josa(p.name, '와')} 이야기를 나눴다. ${line(p, ok)} (🎲 ${pc}% ${ok ? '성공' : '실패'} · 호감 ${d >= 0 ? '+' : ''}${d})`;
  } else if (kind === 'gift') {
    mark(p, 'gift');
    const gc = (D.ranks[p.rank] || {}).lv >= 4 ? 40 : 15; S.realm.gold -= gc;
    const d = addAff(p, rand(5, 9) * k);
    msg = `🎁 ${pick(['은 브로치', '향긋한 향유', '수놓은 손수건', '잘 벼린 단검', '희귀한 책'])}을 ${josa(p.name, '에게')} 건넸다. ${line(p, true)} (💰 -${gc} · 호감 +${d})`;
  } else if (kind === 'spar') {
    mark(p, 'spar');
    const me = K.myCP(), them = cpP(p), win = Math.random() < me / (me + them);
    S.aura.xp += win ? 6 : 10; gainStats({ might: [0, 1], agility: [0, 1] }); S.hp = Math.max(1, S.hp - rand(3, 9));
    const d = addAff(p, (win ? rand(2, 5) : rand(1, 3)) * k);
    msg = `⚔️ ${josa(p.name, '와')} 목검을 맞댔다. ${win ? '마지막 일격을 내가 꽂았다.' : `${josa(p.name, '이')} 한 수 위였다.`} (호감 +${d} · 오러 수련 +${win ? 6 : 10})`;
  } else if (kind === 'date') {
    mark(p, 'date'); S.realm.gold -= 10;
    const d = addAff(p, rand(5, 9) * k);
    msg = `🌹 ${josa(p.name, '와')} ${pick(['성벽 위를 걸으며 노을을 봤다', '정원에서 차를 마셨다', '말을 타고 호숫가까지 달렸다', '선술집 구석에서 노래를 들었다', '별자리를 세며 밤 산책을 했다'])}. ${line(p, true)} (호감 +${d})`;
  } else if (kind === 'confess') {
    mark(p, 'confess');
    const pc = confessPct(p);
    if (rand(1, 100) <= pc) { p.rel = 'lover'; addAff(p, 6); msg = `💘 떨리는 목소리로 마음을 전했다. ${josa(p.name, '이')} 잠시 말이 없다가… 손을 잡아 왔다. 이제 연인이다. (🎲 ${pc}%)`; }
    else { addAff(p, -6); p.coolUntil = S.monthN + 3; msg = `💔 ${josa(p.name, '이')} 곤란한 얼굴로 고개를 저었다. "…아직은 아니에요." (🎲 ${pc}% · 호감 -6 · 석 달 뒤 다시)`; }
  } else if (kind === 'propose') {
    mark(p, 'propose');
    const pc = proposePct(p);
    if (rand(1, 100) <= pc) {
      S.realm.gold -= 50; p.rel = 'spouse'; S.spouse = p.id; S.lastProposal = S.monthN; addAff(p, 8); realmDelta({ morale: 4 });
      msg = `💍 ${josa(p.name, '이')} 눈물을 글썽이며 고개를 끄덕였다. 성대한 혼례가 열렸다. (🎲 ${pc}% · 💰 -50 · 민심 +4)`;
    } else { addAff(p, -4); msg = `💍 "조금만 더 시간을 주세요." ${josa(p.name, '이')} 반지를 돌려주었다. (🎲 ${pc}%)`; }
  } else if (kind === 'consort') {
    mark(p, 'consort');
    const pc = consortPct(p), sp = S.people.find(x => x.id === S.spouse);
    if (rand(1, 100) <= pc) {
      p.rel = 'consort';
      const hurt = sp ? { warm: 8, shy: 10, cheerful: 10, cool: 14, proud: 22 }[sp.personality] || 12 : 0;
      if (sp) addAff(sp, -hurt);
      msg = `👑 ${josa(p.name, '이')} 측실이 되기로 했다.${sp ? ` ${sp.name}의 표정이 굳었다. (배우자 호감 -${hurt})` : ''} (🎲 ${pc}%)`;
    } else { addAff(p, -5); msg = `👑 "저는 누군가의 둘째가 되고 싶지 않아요." ${josa(p.name, '이')} 거절했다. 연인으로는 남았다. (🎲 ${pc}%)`; }
  } else if (kind === 'night') {
    mark(p, 'night');
    const pc = nightPct(p);
    if (rand(1, 100) <= pc) {
      const d = addAff(p, rand(2, 4));
      S.hp = Math.min(K.hpMax(), S.hp + Math.round(K.hpMax() * .1));
      msg = `🌙 ${pick(NIGHT_YES[p.personality] || NIGHT_YES.warm)} …그날 밤은 길었다. (호감 +${d})`;
      // 배우자·측실과는 아이가 생길 수 있음
      if ((p.rel === 'spouse' || p.rel === 'consort') && !S.preg && K.API.fertile() && Math.random() < .12) S.preg = { due: S.monthN + 9, with: p.id };
      // 배우자 몰래 연인을 만나면 들킬 수 있음
      const sp = S.people.find(x => x.id === S.spouse && x.alive);
      if (p.rel === 'lover' && sp && Math.random() < .15) { const h = addAff(sp, -10); msg += ` …다음 날, ${josa(sp.name, '이')} 차가운 눈으로 나를 봤다. (배우자 호감 ${h})`; }
    } else msg = `🌙 ${NIGHT_NO[p.personality] || NIGHT_NO.warm} ${josa(p.name, '은')} 오늘은 사양했다. 억지로 붙잡지 않았다.`;
  } else if (kind === 'hire') {
    p.hired = true; S.realm.gold -= wage(p); addAff(p, 3);
    msg = `🪙 ${josa(p.name, '을')} 용병으로 고용했다. 매달 💰${wage(p)}. 원정 동료로 데려갈 수 있다.`;
  } else if (kind === 'party') {
    S.party = S.party || [];
    if (S.party.includes(p.id)) { S.party = S.party.filter(x => x !== p.id); msg = `↩️ ${josa(p.name, '은')} 성에 남는다.`; }
    else { S.party.push(p.id); msg = `🤝 ${josa(p.name, '이')} 원정에 함께하기로 했다. (지원 공격 ${K.compAtk(p)})`; }
  } else if (kind === 'part') {
    p.rel = ''; addAff(p, -20); msg = `💔 ${josa(p.name, '와')} 헤어졌다. (호감 -20)`;
  }
  log(msg, kind === 'confess' || kind === 'propose' || kind === 'consort' || kind === 'night' ? 'mem' : 'info');
  emit();
  return msg;
}

/* ═════ 마을 나들이 (행동 1) ═════ */
function town(placeId) {
  const S = st(), P = D.places.find(x => x.id === placeId);
  if (!P || K.busy() || S.ap <= 0) return false;
  if (P.minRank && myLv() < P.minRank) return false;
  S.ap--;
  // 그곳 단골(이미 만난 사람) 중 일부 + 처음 보는 사람
  const regulars = S.people.filter(p => p.alive && p.place === placeId && p.met);
  const here = [];
  for (const p of regulars) if (Math.random() < .55 && here.length < 2) here.push(p.id);
  while (here.length < 3) { const role = wKey(P.roles); here.push(mkPerson(role, { place: placeId, stranger: true, age: role === 'noble' ? rand(20, 30) : undefined }).id); }
  S.town = { place: placeId, at: S.monthN, here };
  log(`${P.icon} ${P.name}에 들렀다. ${P.desc}`, 'info');
  // 그곳 사건
  const evs = D.events.filter(e => e.place === placeId && K.eligible(e));
  if (evs.length && Math.random() < .4) K.fireEvent(weighted(evs, e => e.weight ?? 1));
  emit();
  return true;
}
const townInfo = () => { const S = st(); if (!S.town || S.town.at !== S.monthN) return null; return Object.assign({ place: D.places.find(x => x.id === S.town.place) }, { here: S.town.here.map(id => S.people.find(p => p.id === id)).filter(Boolean) }); };

/* ═════ 용병 길드 ═════ */
const ALIASES = ['잿빛 늑대', '이름 없는 검', '붉은 망토', '새벽까마귀', '은빛 가면', '외눈 사자', '떠돌이 별'];
function guildRegister() {
  const S = st();
  if (S.merc || S.realm.gold < 10 || K.busy() || S.age < 15) return false;
  S.realm.gold -= 10;
  S.merc = { g: S.mercInit != null ? S.mercInit : 0, pts: 0, alias: pick(ALIASES), done: 0 };
  delete S.mercInit;
  log(`🛡 신분을 숨기고 용병 길드에 이름을 올렸다. 길드에선 '${S.merc.alias}'로 불린다. (${D.mercGrades[S.merc.g].name} · 💰 -10)`, 'mem');
  emit(); return true;
}
function board() {
  const S = st(); if (!S.merc) return [];
  if (S.boardAt !== S.monthN || !S.board) {
    const pool = D.quests.filter(q => q.g <= S.merc.g + 1);
    const pickW = () => weighted(pool, q => 1 + (q.g >= S.merc.g - 1 ? 2 : 0));
    const ids = new Set(); let tries = 0;
    while (ids.size < Math.min(4, pool.length) && tries++ < 40) ids.add(pickW().id);
    S.board = [...ids].map(id => ({ id, taken: false })); S.boardAt = S.monthN;
  }
  return S.board.map((b, i) => { const q = D.quests.find(x => x.id === b.id); return Object.assign({ i, taken: b.taken, ok: !b.taken && q.g <= S.merc.g && S.ap > 0 && !K.busy(), pct: q.stat ? K.checkPct({ stat: q.stat, g: q.grade }) : null, gradeName: D.mercGrades[q.g].name }, q); });
}
const qScale = q => 1 + q.g * .14 + Math.min(.5, st().monthN / 400);
function questReward(q) {
  const S = st(), g = Math.round(K.val(q.gold) * (1 + S.merc.g * .05));
  S.realm.gold += g; S.merc.pts += q.pts; S.merc.done++; S.fame += Math.max(1, Math.round(q.pts / 6));
  log(`📜 의뢰 「${q.name}」 완료! 길드가 보수를 건넸다. (💰 +${g} · 공적 +${q.pts}${S.merc.pts >= (D.mercGrades[S.merc.g + 1] || {}).need ? ' · 승급 시험을 볼 수 있다!' : ''})`, 'mem');
}
function takeQuest(i) {
  const S = st(), b = (S.board || [])[i]; if (!b) return false;
  const q = D.quests.find(x => x.id === b.id);
  if (!q || b.taken || q.g > S.merc.g || S.ap <= 0 || K.busy()) return false;
  b.taken = true; S.ap--;
  log(`📜 의뢰 「${q.name}」를 맡았다.`, 'info');
  const ctx = { kind: 'quest', qid: q.id, scale: qScale(q), death: .03 };
  if (q.kind === 'hunt') { S.quest = { qid: q.id, foes: q.foes, i: 0 }; K.startFight(q.foes[0], ctx); }
  else {
    const pc = K.checkPct({ stat: q.stat, g: q.grade }), ok = rand(1, 100) <= pc;
    log(`🎲 ${D.stats[q.stat]} 판정 ${pc}% → ${ok ? '성공' : '실패'}`, 'info');
    const fight = q.kind === 'escort' ? (!ok || Math.random() < .35) : q.kind === 'probe' ? (!ok || Math.random() < .5) : false;
    if (q.kind === 'gather') { if (ok) questReward(q); else { S.merc.pts = Math.max(0, S.merc.pts - 1); log(`📜 의뢰 「${q.name}」 실패. 빈손으로 돌아왔다.`, 'info'); } }
    else if (fight) { log(`⚠️ ${q.kind === 'escort' ? '길목에서 습격을 받았다!' : '어둠 속에서 무언가가 덮쳐 왔다!'}`, 'info'); S.quest = { qid: q.id, foes: [q.foe], i: 0 }; K.startFight(q.foe, ctx); }
    else questReward(q);
  }
  emit(); return true;
}
K.HOOK.fight.quest = res => {
  const S = st(), Q = S.quest; if (!Q) return;
  const q = D.quests.find(x => x.id === Q.qid);
  if (res === 'win') {
    Q.i++;
    if (Q.i < Q.foes.length) { log(`⚔️ 숨 돌릴 틈도 없이 다음 상대가 나타났다! (${Q.i + 1}/${Q.foes.length})`, 'info'); K.startFight(Q.foes[Q.i], { kind: 'quest', qid: q.id, scale: qScale(q), death: .03 }); return; }
    S.quest = null; questReward(q);
  } else { S.quest = null; S.merc.pts = Math.max(0, S.merc.pts - 2); log(`📜 의뢰 「${q.name}」 실패. (공적 -2)`, 'info'); }
};
function promoteTest() {
  const S = st(); if (!S.merc || K.busy()) return false;
  const N = D.mercGrades[S.merc.g + 1];
  if (!N || S.merc.pts < N.need) return false;
  if (!N.test) { S.merc.g++; log(`🛡 ${N.name} 용병이 되었다!`, 'mem'); emit(); return true; }
  if (S.ap <= 0) return false;
  S.ap--;
  log(`🛡 ${N.name} 승급 시험. 시험관이 데려온 상대는 ${D.foes[N.test].icon} ${D.foes[N.test].name}.`, 'info');
  K.startFight(N.test, { kind: 'mercTest', scale: 1 + (S.merc.g + 1) * .1, death: 0 });
  return true;
}
K.HOOK.fight.mercTest = res => {
  const S = st(), N = D.mercGrades[S.merc.g + 1];
  if (res === 'win') { S.merc.g++; S.fame += 3 * S.merc.g; log(`🛡 시험 통과! 이제 ${N.name} 용병 '${S.merc.alias}'. (명성 +${3 * S.merc.g})`, 'mem'); }
  else { S.merc.pts = Math.round(S.merc.pts * .9); log('🛡 승급 시험에 떨어졌다. 다음 달에 다시 볼 수 있다. (공적 -10%)', 'info'); }
};

/* ═════ 노예시장 (항구도시 벨레노 뒷골목) ═════ */
function visitPort() {
  const S = st();
  if (K.busy() || S.ap <= 0) return false;
  S.ap--;
  S.slaves = Array.from({ length: 4 }, () => {
    const race = wKey({ human: 3, beast: 4, elf: 2, orc: 2, dwarf: 1.5 }), g = Math.random() < .5 ? 'm' : 'f', sk = pick(D.slaveSkills);
    return { race, gender: g, beast: race === 'beast' ? pick(Object.keys(D.races.beast.subs)) : null, name: nameFor(race, g), age: race === 'elf' ? rand(60, 200) : race === 'dwarf' ? rand(30, 90) : rand(20, 42),
      origin: pick(D.slaveOrigins), skill: sk.id, price: rand(35, 70) + (race === 'elf' ? 40 : 0) + (sk.job ? 20 : 0), personality: pick(PN), seed: 'sl' + Math.floor(Math.random() * 1e9), freed: false };
  });
  S.slavesAt = S.monthN;
  log(`⚓ 벨레노 뒷골목의 노예시장. 사슬 소리와 노예상의 외침이 뒤섞였다.${S.laws.noSlavery ? ' (우리 영지에선 이미 금지한 일이다)' : ''}`, 'info');
  emit(); return true;
}
function freeSlave(i) {
  const S = st(), x = S.slaves && S.slaves[i];
  if (!x || x.freed || S.realm.gold < x.price) return false;
  S.realm.gold -= x.price; x.freed = true; S.fame += 1; S.rec.freed = (S.rec.freed || 0) + 1;
  const sk = D.slaveSkills.find(k => k.id === x.skill);
  const stay = Math.random() < .5 + ({ warm: .15, shy: .1, cheerful: .05, cool: -.1, proud: -.15 }[x.personality] || 0);
  let msg = `📜 금화 ${x.price}을 치르고 그 자리에서 ${josa(x.name, '의')} 해방 증서를 썼다. 사슬이 풀렸다.`;
  if (stay) {
    const p = mkPerson('freed', { race: x.race, beast: x.beast, gender: x.gender, age: x.age, name: x.name, personality: x.personality, met: true, aff: 45, extra: { job: sk.job || null, skill: x.skill, seed: x.seed } });
    p.seed = x.seed; p.rank = 'freed';
    if (sk.fx) Object.assign(p, { might: p.might + 15 });
    msg += ` "…갈 곳이 없습니다. 은혜를 갚게 해 주십시오." ${josa(x.name, '은')} 스스로 가신이 되기로 했다. (${sk.name})`;
  } else msg += ` ${josa(x.name, '은')} 깊이 고개를 숙이고 고향으로 떠났다. (명성 +1)`;
  log(msg, 'mem');
  emit(); return true;
}
// 해방민 가신의 솜씨: 대장장이 → 장비 값 할인 · 셈 → 세금 · 약초 → 회복
const jobOf = j => st().people.some(p => p.alive && p.job === j);

/* ═════ 법령 ═════ */
const LAWS = {
  noSlavery: { name: '영지 안 노예 매매 금지', desc: '민심 +6 · 명성 +8 · 치안 -3, 노예상들의 원한을 산다', run: () => { realmDelta({ morale: 6, order: -3 }); st().fame += 8; } },
  openGates: { name: '이종족에게 성문을 연다', desc: '수인·엘프·드워프·오크 이주민을 받는다 — 인구 상한 +, 인간 귀족들의 눈총', run: () => { realmDelta({ pop: 40, morale: -2 }); st().fame += 3; } },
  lowTithe:  { name: '신전 십일조 줄이기', desc: '민심 +4 · 신전과 사이가 나빠짐', run: () => { realmDelta({ morale: 4 }); } },
};
function passLaw(id) {
  const S = st(), L = LAWS[id];
  if (!L || S.laws[id] || S.title !== '영주' || K.busy() || S.ap <= 0) return false;
  S.ap--; S.laws[id] = S.monthN || 1; L.run();
  log(`📜 법령 반포: 「${L.name}」. 광장에 포고문이 붙었다.`, 'mem');
  emit(); return true;
}

/* ═════ 왕실 공헌 · 작위 ═════ */
function canPromote() { const S = st(), N = D.peerage[S.peer + 1]; return !!(N && S.title === '영주' && S.favor >= N.favor && S.fame >= N.fame); }
function promote() {
  const S = st(), N = D.peerage[S.peer + 1]; if (!N) return;
  const old = K.PEER();
  S.peer++;
  const k = N.size / old.size, R = S.realm;
  R.pop = Math.round(R.pop * (1 + (k - 1) * .5)); R.gold += Math.round(80 * N.size); S.fame += 10;
  log(`👑 왕의 교서: ${S.house} 가문을 ${N.name}으로 올린다. 영지가 ${N.land}으로 넓어졌다. (인구 늘어남 · 💰 +${Math.round(80 * N.size)} · 명성 +10)`, 'mem');
}
Object.assign(K.API, { canPromote, promote, mkPerson: (role, o) => mkPerson(role, o), jobOf, laws: () => st().laws, merc: () => st().merc,
  lover: () => st().people.find(p => p.alive && (p.rel === 'lover' || p.rel === 'consort')), spouseP: () => st().people.find(p => p.alive && p.id === st().spouse),
  personOf: role => st().people.find(p => p.alive && p.role === role), addAff: (p, v) => addAff(p, v), party: () => (st().party || []).map(id => st().people.find(p => p.id === id)).filter(Boolean) });

/* ═════ 달마다 ═════ */
K.HOOK.month.push(() => {
  const S = st();
  // 용병 품삯
  for (const p of S.people) if (p.alive && p.hired) { const w = wage(p); if (S.realm.gold >= w) S.realm.gold -= w; else { p.hired = false; S.party = (S.party || []).filter(x => x !== p.id); addAff(p, -10); log(`🪙 품삯을 못 받은 ${josa(p.name, '이')} 떠났다.`, 'info'); } }
  // 해방민 가신 솜씨
  if (jobOf('steward')) S.realm.gold += Math.round(S.realm.pop * .004);
  if (jobOf('healer')) S.hp = Math.min(K.hpMax(), S.hp + 4);
  // 연인·배우자는 오래 안 보면 서운해함
  for (const p of S.people) if (p.alive && p.rel) { const last = Math.max(...Object.values(p.mo || { x: -99 })); if (S.monthN - last > 3 && Math.random() < .5) addAff(p, -2); }
  // 처음 보고 말 안 건 사람은 잊힘
  S.people = S.people.filter(p => !p.stranger || p.met);
  S.party = (S.party || []).filter(id => S.people.some(p => p.id === id && p.alive));
  // 아이
  if (S.preg && S.monthN >= S.preg.due) {
    const par = S.people.find(p => p.id === S.preg.with), g = Math.random() < .5 ? 'm' : 'f';
    const race = par && par.race !== S.race && Math.random() < .5 ? par.race : S.race;
    const c = K.addPerson({ role: 'child', name: nameFor(race, g), gender: g, age: 0, race, beast: race === 'beast' ? (par && par.beast) || S.beast : null, seed: 'ch' + Math.floor(Math.random() * 1e9), mo: {}, aff: 80, met: true, personality: pick(PN) });
    S.children.push(c.id); S.preg = null;
    log(`👶 ${par ? `${josa(par.name, '와')} 나 사이에서 ` : ''}${g === 'm' ? '아들' : '딸'} ${josa(c.name, '이')} 태어났다.`, 'mem');
  }
  // 수성전 승리 · 작위 승급 알림은 사건(data/realm-events.js 'promotion')
});
// 화면 정보
K.HOOK.info.push(() => { const S = st(); return { merc: S.merc ? Object.assign({ grade: D.mercGrades[S.merc.g], next: D.mercGrades[S.merc.g + 1] || null }, S.merc) : null, party: (S.party || []).map(id => S.people.find(p => p.id === id)).filter(Boolean), preg: S.preg, laws: S.laws, canPromote: canPromote() }; });

/* ═════ 행동 추가 ═════ */
const A = K.ACTIONS;
const at = id => A.findIndex(a => a.id === id);
A.splice(at('rest') + 1, 0, { id: 'power', group: 'self', icon: '💠', label: '강함', desc: '강함 등급·오러·서클 (행동 안 씀)', modal: 'power', free: true });
A.push(
  { id: 'town', group: 'social', icon: '🏘', label: '마을 나들이', desc: '선술집·광장·신전·길드·살롱', modal: 'town', if: () => st().age >= 15 },
  { id: 'people', group: 'social', icon: '👥', label: '사람들', desc: '교류·연애·동료 (행동 안 씀)', modal: 'people', free: true },
  { id: 'guild', group: 'adv', icon: '🛡', label: '용병 길드', desc: '의뢰·승급 시험 (의뢰마다 행동 1)', modal: 'guild', free: true, if: () => st().age >= 15 },
  { id: 'port', group: 'trade', icon: '⚓', label: '벨레노 뒷골목', desc: '노예시장 — 값을 치르고 해방시킬 수 있다', modal: 'port', free: true },
  { id: 'tribute', group: 'realm', icon: '👑', label: '왕실에 공물', desc: '왕실 공헌 + (작위 승급)', get cost() { return Math.round(50 * K.SIZE()); }, if: () => st().title !== '영주의 자식',
    run: () => { const S = st(), c = Math.round(50 * K.SIZE()); const f = rand(6, 10) + Math.floor(S.stats.charm / 15); S.favor += f; log(`👑 왕도에 공물을 보냈다. (💰 -${c} · 왕실 공헌 +${f} → ${S.favor})`); } },
  { id: 'laws', group: 'realm', icon: '📜', label: '법령', desc: '영지의 법을 정한다 (반포에 행동 1)', modal: 'laws', free: true, if: () => st().title === '영주' },
);

/* ═════ 내보내기 ═════ */
window.Realm.life = {
  people: () => st().people.filter(p => p.alive && (p.met || FAMILY.includes(p.role))).map(p => Object.assign({}, p, { cp: cpP(p), grade: K.mightGrade(cpP(p)), roleName: (D.roles[p.role] || { name: { father: '아버지', mother: '어머니', sibling: '동생', child: '자식', spouse: '배우자' }[p.role] || p.role }).name,
    rankName: (D.ranks[p.rank] || {}).name || '', raceName: (D.races[p.race] || D.races.human).name + (p.beast && D.races.beast.subs[p.beast] ? `(${D.races.beast.subs[p.beast].name})` : ''), relName: relName[p.rel] || '', inParty: (st().party || []).includes(p.id), romance: canRomance(p) })),
  person: id => st().people.find(p => p.id === id),
  options: id => { const p = st().people.find(x => x.id === id); return p ? options(p) : []; },
  act, town, townInfo, places: () => D.places.map(P => Object.assign({ ok: !P.minRank || myLv() >= P.minRank }, P)),
  guildRegister, board, takeQuest, promoteTest,
  visitPort, freeSlave, slaves: () => (st().slavesAt === st().monthN ? st().slaves : null) || null,
  laws: () => Object.entries(LAWS).map(([id, L]) => ({ id, name: L.name, desc: L.desc, done: !!st().laws[id], ok: !st().laws[id] && st().ap > 0 && !K.busy() })), passLaw,
  cpP, wage,
};
})();
