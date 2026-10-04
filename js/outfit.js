// 옷 (HAIR_CLOTHES_BODY.md 3부) — 아이템 목록, 사람마다 옷장(3~6벌), 상황에 맞게 꺼내 입기, 팔레트
// 그리는 건 js/avatar.js (이너·겉옷·하의·원피스·신발·소품). 여기는 무엇을 입을지만 정함 (저장하지 않고 시드에서 늘 똑같이 나옴)
//   Outfit.wardrobe(a, age, who)   → 옷장 [{ inner, outer, bottom, dress, shoes, acc, tuck, tags, score }, ...] (+ work: 출근복 2벌)
//   Outfit.pick(a, age, ctx)       → 지금 입은 한 벌. ctx: { season, weather, place, hour, weekend, dayN, working, school, home, event, who }
//     who: { personality, hobby, job(라벨 또는 직업 id), styleG(꾸밈 등급 0~6), wealth, closet(산 옷), wx(연애·이별·취업 변화) }
//   ctx가 비어 있으면(테스트 시트·예전 호출) 생김새의 top·tc에서 나온 '대표 한 벌'
//   Outfit.likes(personality, outfit) → 그 성격이 좋아하는 옷인지 (데이트 옷 고르기 보너스)
(function () {
'use strict';
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = hash(String(seed)) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const ALL = ['spring', 'summer', 'fall', 'winter'];

// ── 아이템 (3-3). w: 입는 계절, g: 성별 제한, age: 나이 범위, t: 스타일 태그, q: 기본 품질(꾸밈 점수)
const INNER = {
  tee:        { label: '반팔 티', w: ['spring', 'summer', 'fall'], t: ['casual'], q: 1 },
  longtee:    { label: '긴팔 티', w: ['spring', 'fall', 'winter'], t: ['casual'], q: 1 },
  crop:       { label: '크롭티', w: ['spring', 'summer'], g: 'f', age: [18, 29], t: ['bold', 'street'], q: 2 },
  sleeveless: { label: '민소매', w: ['summer'], t: ['casual'], q: 1 },
  sweat:      { label: '맨투맨', w: ['spring', 'fall', 'winter'], t: ['casual', 'street'], q: 1 },
  hoodie:     { label: '후디', w: ['spring', 'fall', 'winter'], t: ['casual', 'street', 'sporty'], q: 1 },
  shirt:      { label: '셔츠', w: ALL, t: ['neat', 'formal'], q: 2 },
  overshirt:  { label: '오버핏 셔츠', w: ['spring', 'summer', 'fall'], age: [15, 39], t: ['street'], q: 2 },
  blouse:     { label: '블라우스', w: ['spring', 'summer', 'fall'], g: 'f', t: ['neat', 'soft'], q: 2 },
  knit:       { label: '니트', w: ['spring', 'fall', 'winter'], t: ['soft', 'neat'], q: 2 },
  turtle:     { label: '터틀넥', w: ['fall', 'winter'], t: ['neat', 'soft'], q: 2 },
  polo:       { label: '폴로', w: ['spring', 'summer'], t: ['neat', 'sporty'], q: 2 },
  stripe:     { label: '줄무늬 티', w: ['spring', 'summer', 'fall'], t: ['casual', 'soft'], q: 1 },
  check:      { label: '체크 셔츠', w: ['spring', 'fall', 'winter'], t: ['casual'], q: 1 },
};
const OUTER = {
  cardigan: { label: '가디건', w: ['spring', 'fall'], t: ['soft', 'neat'], q: 2, len: 'hip' },
  denim:    { label: '데님 재킷', w: ['spring', 'fall'], age: [13, 49], t: ['casual', 'street'], q: 2, len: 'hip' },
  wind:     { label: '바람막이', w: ['spring', 'fall'], t: ['sporty'], q: 1, len: 'hip' },
  blazer:   { label: '블레이저', w: ALL, age: [18, 99], t: ['neat', 'formal'], q: 3, len: 'thigh' },
  leather:  { label: '가죽 재킷', w: ['fall', 'spring'], age: [18, 59], t: ['bold', 'street'], q: 3, len: 'hip' },
  trench:   { label: '트렌치코트', w: ['fall', 'spring'], age: [20, 99], t: ['neat', 'soft'], q: 3, len: 'knee' },
  longcoat: { label: '롱코트', w: ['winter'], age: [18, 99], t: ['neat', 'formal'], q: 3, len: 'knee' },
  shortpad: { label: '숏패딩', w: ['winter'], t: ['casual', 'sporty'], q: 2, len: 'hip' },
  longpad:  { label: '롱패딩', w: ['winter'], t: ['casual'], q: 2, len: 'calf' },
  fleece:   { label: '플리스', w: ['winter', 'fall'], t: ['casual', 'soft'], q: 1, len: 'hip' },
};
const BOTTOM = {
  jeans:      { label: '청바지', w: ALL, t: ['casual'], q: 1, cuts: ['skinny', 'straight', 'wide'] },
  slacks:     { label: '슬랙스', w: ALL, age: [16, 99], t: ['neat', 'formal'], q: 2 },
  chino:      { label: '면바지', w: ALL, t: ['neat', 'casual'], q: 1 },
  jogger:     { label: '조거 팬츠', w: ['spring', 'fall', 'winter'], t: ['sporty', 'street'], q: 1 },
  cargo:      { label: '카고 바지', w: ['spring', 'fall', 'summer'], age: [13, 39], t: ['street'], q: 1 },
  shorts:     { label: '반바지', w: ['summer'], t: ['casual', 'sporty'], q: 1 },
  training:   { label: '트레이닝 바지', w: ALL, t: ['sporty'], q: 0 },
  mini:       { label: '미니스커트', w: ['spring', 'summer', 'fall'], g: 'f', age: [13, 34], t: ['bold'], q: 2, skirt: true },
  pleats:     { label: '플리츠스커트', w: ['spring', 'summer', 'fall'], g: 'f', t: ['soft'], q: 2, skirt: true },
  aline:      { label: 'A라인 스커트', w: ALL, g: 'f', t: ['soft', 'neat'], q: 2, skirt: true },
  pencil:     { label: '펜슬 스커트', w: ALL, g: 'f', age: [20, 99], t: ['neat', 'formal'], q: 2, skirt: true },
  longskirt:  { label: '롱스커트', w: ALL, g: 'f', t: ['soft'], q: 2, skirt: true },
  denimskirt: { label: '데님 스커트', w: ['spring', 'summer', 'fall'], g: 'f', age: [13, 49], t: ['casual'], q: 1, skirt: true },
};
const DRESS = {
  sundress:   { label: '여름 원피스', w: ['summer'], g: 'f', t: ['soft'], q: 2 },
  shirtdress: { label: '셔츠 원피스', w: ['spring', 'summer', 'fall'], g: 'f', t: ['neat', 'soft'], q: 2 },
  knitdress:  { label: '니트 원피스', w: ['fall', 'winter'], g: 'f', t: ['soft'], q: 2 },
  suitdress:  { label: '정장 원피스', w: ALL, g: 'f', age: [20, 99], t: ['neat', 'formal'], q: 3 },
};
const SHOES = {
  sneaker: { label: '운동화', w: ALL, t: ['casual'], q: 1 }, runner: { label: '러닝화', w: ALL, t: ['sporty'], q: 1 },
  loafer: { label: '로퍼', w: ALL, t: ['neat'], q: 2 }, dress: { label: '구두', w: ALL, g: 'm', age: [20, 99], t: ['formal'], q: 2 },
  heel: { label: '힐', w: ALL, g: 'f', age: [20, 99], t: ['formal', 'bold'], q: 2 }, ankleboot: { label: '앵클부츠', w: ['fall', 'winter'], t: ['neat', 'street'], q: 2 },
  longboot: { label: '롱부츠', w: ['fall', 'winter'], g: 'f', age: [18, 59], t: ['bold'], q: 2 }, slipper: { label: '슬리퍼', w: ['summer'], t: ['casual'], q: 0 },
  sandal: { label: '샌들', w: ['summer'], t: ['casual', 'soft'], q: 1 }, ugg: { label: '어그', w: ['winter'], t: ['soft'], q: 1 },
  rainboot: { label: '장화', w: ALL, t: ['casual'], q: 1 },
};
const LABELS = Object.assign({}, ...[INNER, OUTER, BOTTOM, DRESS, SHOES].map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.label]))),
  { uniform: '교복', summerUni: '하복', gym: '체육복', suit: '정장', gown: '의사 가운', scrub: '간호복', chef: '셰프복', police: '경찰 제복', fire: '소방복',
    work: '작업복', apron: '카페 앞치마', cvsvest: '편의점 조끼', delivery: '배달 조끼', army: '군복', pajama: '잠옷', sports: '운동복', swim: '수영복', mourning: '검은 정장',
    pajamaP: '잠옷 바지', scrubP: '간호복 바지', chefP: '셰프 바지', fireP: '방화복 바지', uniSkirt: '교복 치마', boardshorts: '보드숏', rash: '래시가드', track: '트레이닝 집업',
    vest: '조끼', gown: '의사 가운', wind: '바람막이' });

// ── 색 (3-5): 한 사람 옷장은 팔레트 하나에서. 한 벌에 포인트 색 최대 1개, 나머지는 무채색·데님·베이지 같은 기본색
const N = { black: '#2a2a2e', white: '#f2efe9', gray: '#8d8d92', lgray: '#c9c7c2', navy: '#2e3a56', denim: '#4a5f86', ldenim: '#7d93b8', beige: '#d8c6a8', cream: '#ece3cf', charcoal: '#3b3e48', khaki: '#a08a63', brown: '#6b4a36', olive: '#6d7254' };
const PAL = {
  bold:      ['#c8323c', '#1f4fa8', '#e8a200', '#7a1f3d', '#111114'],
  shy:       ['#8a8f98', '#d6cfc3', '#6b7a8f', '#9aa38c'],
  playful:   ['#ff7f50', '#36a46a', '#6a5acd', '#f2c230', '#2ab3a6'],
  cool:      ['#1c1c1e', '#4a4a50', '#6e6e73', '#2e3440'],
  warm:      ['#f0b8c0', '#b9dcc0', '#f3e5a0', '#a9c6dc', '#d9c8ec'],
  sharp:     ['#2c3e50', '#5d6d7e', '#8e2b3a', '#1f3d5a'],
  sunny:     ['#ff9f43', '#5ecb6a', '#f6d743', '#5aa9f0', '#ff6b6b'],
  sensitive: ['#7d6b91', '#8e9aaf', '#9a9a6e', '#b5838d', '#6d6875'],
};
const NEUTRALS = [N.black, N.white, N.gray, N.navy, N.beige, N.cream, N.charcoal, N.lgray];
// 성격별로 좋아하는 스타일 (옷장 비중·데이트 취향)
const LIKES = { bold: ['bold', 'street'], shy: ['soft', 'neat'], playful: ['street', 'casual'], cool: ['street', 'casual'], warm: ['soft', 'neat'], sharp: ['neat', 'formal'], sunny: ['casual', 'sporty'], sensitive: ['soft', 'neat'] };
// 직업 → 출근복 (게임 직업 id와 NPC 직업 라벨)
const JOBWEAR = { cvs: 'cvsvest', rider: 'delivery', barista: 'apron', cook: 'chef', hair: 'apron', mechanic: 'work', office: 'suit', bigco: 'suit', bank: 'suit', dev: 'casualW', designer: 'casualW',
  teacher: 'neatW', civil: 'neatW', nurse: 'scrub', doctor: 'gown', reporter: 'neatW', creator: 'casualW', musician: 'casualW', army: 'army', police: 'police', fire: 'fire',
  '회사원': 'suit', '공무원': 'neatW', '자영업자': 'apron', '간호사': 'scrub', '선생님': 'neatW', '프로그래머': 'casualW', '요리사': 'chef', '디자이너': 'casualW', '은행원': 'suit', '배달 라이더': 'delivery', '대학원생': 'casualW', '프리랜서': 'casualW' };

const pickW = (r, list) => { let t = r() * list.reduce((x, y) => x + y[1], 0); for (const [k, w] of list) { t -= w; if (t <= 0) return k; } return list[0][0]; };
const okFor = (it, g, age) => (!it.g || it.g === g) && (!it.age || (age >= it.age[0] && age <= it.age[1]));
const ageBand = age => age <= 12 ? 'kid' : age <= 18 ? 'teen' : age <= 29 ? '20s' : age <= 49 ? 'mid' : 'old';

// 나이·성격·취미로 아이템 비중
function weightsFor(cat, g, age, who) {
  const band = ageBand(age), like = LIKES[who.personality] || [], hob = who.hobby;
  return Object.entries(cat).filter(([, it]) => okFor(it, g, age)).map(([k, it]) => {
    let w = 1;
    for (const t of it.t) if (like.includes(t)) w *= 1.8;
    if (band === 'kid') w *= { tee: 3, longtee: 3, sweat: 2, hoodie: 2, shorts: 3, jeans: 2, jogger: 2, training: 1.5, pleats: 2, aline: 1.5, sneaker: 4, slacks: 0, shirt: .3, knit: .5, blazer: 0, trench: 0, longcoat: 0 }[k] ?? .5;
    if (band === 'teen') w *= { hoodie: 2.5, sweat: 2.5, tee: 2, jogger: 2, jeans: 2, longpad: 3, sneaker: 3, slacks: .3, blazer: .2, trench: .1, loafer: .5 }[k] ?? 1;
    if (band === '20s') w *= { crop: 1.5, overshirt: 1.6, cargo: 1.4, wide: 1.3, longpad: 1.6, denim: 1.4 }[k] ?? 1;
    if (band === 'mid') w *= { shirt: 2, knit: 2, slacks: 2, chino: 1.6, blazer: 1.5, cardigan: 1.6, loafer: 1.6, trench: 1.5, hoodie: .5, crop: 0, cargo: .4, mini: .3 }[k] ?? 1;
    if (band === 'old') w *= { wind: 3, fleece: 2.4, cardigan: 2, training: 1.6, cargo: 1.2, runner: 2, chino: 1.6, longtee: 1.5, polo: 1.8, crop: 0, mini: 0, overshirt: 0, hoodie: .4 }[k] ?? 1;
    if (hob === 'sport') w *= { runner: 3, training: 2.4, jogger: 2, wind: 2, hoodie: 1.4, polo: 1.4 }[k] ?? 1;
    if (hob === 'travel') w *= { wind: 1.8, cargo: 1.6, runner: 1.6 }[k] ?? 1;
    if (hob === 'fashion') w *= { overshirt: 1.6, leather: 1.8, trench: 1.6, longboot: 1.8, ankleboot: 1.6, blazer: 1.3 }[k] ?? 1;
    if (who.personality === 'shy' || who.personality === 'cool') w *= { sweat: 1.6, hoodie: 1.6, overshirt: 1.3 }[k] ?? 1;
    return [k, w];
  }).filter(([, w]) => w > 0);
}

// 한 벌 만들기: 계절 하나에 맞춰 이너·하의(또는 원피스)·겉옷·신발 + 포인트 색 하나·무늬 하나
function makeOutfit(r, g, age, who, season, opt = {}) {
  const pal = PAL[who.personality] || PAL.shy, styleG = who.styleG ?? 2;
  const inSeason = cat => Object.fromEntries(Object.entries(cat).filter(([, it]) => it.w.includes(season)));
  const o = { season, acc: {} };
  const useDress = g === 'f' && age >= 13 && r() < (season === 'summer' ? .3 : .14) && !opt.noDress;
  if (useDress) { const dw = weightsFor(inSeason(DRESS), g, age, who); if (dw.length) o.dress = { k: pickW(r, dw) }; }
  if (!o.dress) {
    o.inner = { k: pickW(r, weightsFor(inSeason(INNER), g, age, who)) };
    const bk = pickW(r, weightsFor(inSeason(BOTTOM), g, age, who));
    o.bottom = { k: bk };
    if (bk === 'jeans') o.bottom.cut = pickW(r, [['skinny', age <= 30 && g === 'f' ? 2 : .8], ['straight', 2], ['wide', age <= 35 ? 1.6 : .5]]);
    else if (bk === 'slacks' || bk === 'chino') o.bottom.cut = r() < (g === 'f' ? .4 : .2) ? 'wide' : 'straight';
  }
  // 겉옷: 겨울 필수, 봄·가을 레이어링 (꾸밈·패션 취미가 높을수록 자주)
  const needOuter = season === 'winter' || opt.outer;
  const outerP = season === 'winter' ? 1 : season === 'summer' ? 0 : .35 + styleG * .06 + (who.hobby === 'fashion' ? .2 : 0);
  if ((needOuter || r() < outerP) && !(o.inner && ['hoodie'].includes(o.inner.k) && season !== 'winter')) {
    const ow = weightsFor(inSeason(OUTER), g, age, who).map(([k, w]) => [k, w * (k === 'longcoat' || k === 'trench' ? 1 + styleG * .25 : 1)]);
    if (ow.length) o.outer = { k: pickW(r, ow) };
  }
  // 어울림: 단정한 겉옷(블레이저·트렌치·롱코트)이나 셔츠·블라우스엔 트레이닝·조거·카고·반바지 대신 단정한 하의
  const NEAT_TOP = o.outer && ['blazer', 'trench', 'longcoat'].includes(o.outer.k) || o.inner && ['shirt', 'blouse'].includes(o.inner.k);
  if (NEAT_TOP && o.bottom && ['training', 'jogger', 'cargo', 'shorts'].includes(o.bottom.k)) o.bottom = { k: g === 'f' && r() < .5 ? 'aline' : 'slacks', cut: 'straight' };
  if (o.dress && o.outer && ['wind', 'fleece', 'shortpad'].includes(o.outer.k)) o.outer = { k: season === 'winter' ? 'longcoat' : 'cardigan' };
  // 신발
  const sw = weightsFor(inSeason(SHOES), g, age, who).filter(([k]) => k !== 'rainboot').map(([k, w]) => [k, w * (k === 'sneaker' ? 2.4 : 1) * ((o.bottom && BOTTOM[o.bottom.k] && BOTTOM[o.bottom.k].skirt) || o.dress ? ({ heel: 2, longboot: 1.6, loafer: 1.4, sandal: 1.4 }[k] || 1) : ({ heel: .3, longboot: .2 }[k] ?? 1)) * (o.bottom && ['slacks'].includes(o.bottom.k) ? ({ loafer: 2, dress: 2.4 }[k] || 1) : 1)]);
  o.shoes = { k: pickW(r, sw) };
  // 색: 포인트 색은 한 곳만
  const accent = pal[Math.floor(r() * pal.length)], slots = ['inner', 'outer', 'bottom', 'dress'].filter(k => o[k]);
  const accentSlot = r() < .75 ? slots[Math.floor(r() * slots.length)] : null;
  const neu = () => NEUTRALS[Math.floor(r() * NEUTRALS.length)];
  for (const k of slots) o[k].c = k === accentSlot ? accent : neu();
  if (o.bottom) {
    if (o.bottom.k === 'jeans' || o.bottom.k === 'denimskirt') o.bottom.c = r() < .6 ? N.denim : r() < .5 ? N.ldenim : N.charcoal;
    else if (o.bottom.k === 'chino' && o.bottom.c !== accent) o.bottom.c = [N.khaki, N.beige, N.navy, N.olive][Math.floor(r() * 4)];
    else if (o.bottom.k === 'cargo' && o.bottom.c !== accent) o.bottom.c = [N.olive, N.khaki, N.black][Math.floor(r() * 3)];
  }
  if (o.outer) {
    if (o.outer.k === 'denim') o.outer.c = N.ldenim;
    if (o.outer.k === 'leather') o.outer.c = r() < .7 ? '#1d1b1c' : N.brown;
    if (o.outer.k === 'trench') o.outer.c = o.outer.c === accent ? accent : '#c7a97a';
  }
  // 위아래가 같은 색이면 하의를 다른 기본색으로
  if (o.inner && o.bottom && o.inner.c === o.bottom.c) o.bottom.c = o.inner.c === N.navy ? N.beige : N.navy;
  const sc = { sneaker: [N.white, N.white, N.white, N.black, accent], runner: [N.lgray, accent, N.black], loafer: ['#2a211d', N.brown], dress: ['#1c1715', N.brown], heel: [N.black, '#c9a98b', accent],
    ankleboot: ['#2a211d', N.brown], longboot: ['#1c1715', N.brown], slipper: ['#5b6b7a', N.black], sandal: [N.beige, N.brown], ugg: ['#c8a47a', N.cream], rainboot: ['#e2c34b', N.black] }[o.shoes.k];
  o.shoes.c = sc[Math.floor(r() * sc.length)];
  // 무늬 (한 벌에 하나): 블라우스·원피스 도트, 티·맨투맨·후디 작은 로고
  if (o.inner && ['tee', 'sweat', 'hoodie', 'longtee'].includes(o.inner.k) && r() < (who.personality === 'playful' ? .6 : .25)) o.inner.pat = 'logo';
  else if ((o.inner && o.inner.k === 'blouse' || o.dress && o.dress.k === 'sundress') && r() < .3) (o.inner || o.dress).pat = 'dot';
  o.tuck = o.inner && ['shirt', 'blouse', 'polo', 'knit', 'turtle'].includes(o.inner.k) && (o.bottom && ['slacks', 'chino', 'pencil', 'aline', 'pleats', 'longskirt', 'mini'].includes(o.bottom.k)) && r() < .6;
  if (o.inner && o.inner.k === 'crop') o.tuck = false;
  // 소품: 가방(크로스·숄더·백팩), 시계, 목도리(겨울 40%)
  const bag = r();
  if (age >= 13) o.acc.bag = bag < .3 ? 'cross' : bag < .5 ? (g === 'f' ? 'shoulder' : 'cross') : bag < .65 && age <= 30 ? 'backpack' : null;
  if (age >= 25 && r() < .35 + styleG * .05) o.acc.watch = true;
  if (season === 'winter' && r() < .4) o.acc.scarf = pal[Math.floor(r() * pal.length)];
  if (season === 'winter' && age >= 10 && r() < .15) o.acc.hat = 'beanie';   // 겨울 비니 15%
  o.tags = [...new Set(['inner', 'outer', 'bottom', 'dress', 'shoes'].filter(k => o[k]).flatMap(k => (({ inner: INNER, outer: OUTER, bottom: BOTTOM, dress: DRESS, shoes: SHOES })[k][o[k].k] || { t: [] }).t))];
  o.score = scoreOf(o, styleG);
  return o;
}
const scoreOf = (o, styleG) => ['inner', 'outer', 'bottom', 'dress', 'shoes'].filter(k => o[k]).reduce((x, k) => x + ((({ inner: INNER, outer: OUTER, bottom: BOTTOM, dress: DRESS, shoes: SHOES })[k][o[k].k] || {}).q || 1), 0)
  + (o.outer ? 1 : 0) + Object.keys(o.acc).length * .5 + (styleG || 0) * .5 + (o.q || 0);

// ── 출근복·제복·상황 전용 (3-3 직업·상황)
function special(id, g, age, r, season) {
  const summer = season === 'summer';
  const sh = g === 'f' ? 'loafer' : 'dress';
  switch (id) {
    case 'suit': return { inner: { k: 'shirt', c: r() < .7 ? N.white : '#dfe6ef', tie: g === 'm' }, outer: { k: 'blazer', c: [N.charcoal, N.navy, '#2b2b30'][Math.floor(r() * 3)] }, bottom: g === 'f' && r() < .5 ? { k: 'pencil', c: N.charcoal } : { k: 'slacks', c: N.charcoal, cut: 'straight' }, shoes: { k: g === 'f' ? 'heel' : 'dress', c: '#1c1715' }, tuck: true, acc: { badge: true, watch: true }, tags: ['formal', 'neat'], uni: 'suit' };
    case 'mourning': return { inner: { k: 'shirt', c: N.white, tie: g === 'm', tieC: '#1a1a1a' }, outer: { k: 'blazer', c: '#1a1a1c' }, bottom: g === 'f' ? { k: 'aline', c: '#1a1a1c' } : { k: 'slacks', c: '#1a1a1c', cut: 'straight' }, shoes: { k: sh, c: '#111' }, tuck: true, acc: {}, tags: ['formal'], uni: 'mourning' };
    case 'neatW': return { inner: { k: summer ? 'polo' : g === 'f' ? 'blouse' : 'shirt', c: [N.white, '#dfe6ef', N.cream][Math.floor(r() * 3)] }, outer: summer ? null : { k: r() < .5 ? 'cardigan' : 'blazer', c: [N.navy, N.beige, N.gray][Math.floor(r() * 3)] }, bottom: g === 'f' && r() < .5 ? { k: 'aline', c: N.navy } : { k: 'slacks', c: N.charcoal, cut: 'straight' }, shoes: { k: 'loafer', c: '#2a211d' }, tuck: true, acc: { badge: true }, tags: ['neat'], uni: 'neatW' };
    case 'casualW': return null;   // 평소 옷으로 출근 (+ 사원증)
    case 'scrub': { const c = ['#5f9ea0', '#7aa7c7', '#c7a1c9'][Math.floor(r() * 3)]; return { inner: { k: 'scrub', c }, bottom: { k: 'scrubP', c }, shoes: { k: 'runner', c: N.white }, acc: { badge: true }, tags: ['work'], uni: 'scrub' }; }
    case 'gown': return { inner: { k: 'shirt', c: '#dfe6ef', tie: g === 'm' }, outer: { k: 'gown', c: '#f7f7f5' }, bottom: { k: 'slacks', c: N.charcoal, cut: 'straight' }, shoes: { k: sh, c: '#1c1715' }, tuck: true, acc: { badge: true }, tags: ['work', 'neat'], uni: 'gown' };
    case 'chef': return { inner: { k: 'chef', c: '#f7f7f5' }, bottom: { k: 'chefP', c: '#2b2b2e' }, shoes: { k: 'sneaker', c: N.black }, acc: { apron: '#2b2b2e' }, tags: ['work'], uni: 'chef' };
    case 'apron': return { inner: { k: r() < .5 ? 'tee' : 'shirt', c: [N.white, N.black, N.cream][Math.floor(r() * 3)] }, bottom: { k: 'jeans', c: N.denim, cut: 'straight' }, shoes: { k: 'sneaker', c: N.black }, acc: { apron: ['#6b4a36', '#2e3a56', '#3d5a40'][Math.floor(r() * 3)] }, tuck: false, tags: ['work'], uni: 'apron' };
    case 'cvsvest': return { inner: { k: summer ? 'tee' : 'longtee', c: N.white }, outer: { k: 'vest', c: ['#1f8a4c', '#2b5fa8', '#e2722b'][Math.floor(r() * 3)] }, bottom: { k: 'jeans', c: N.denim, cut: 'straight' }, shoes: { k: 'sneaker', c: N.white }, acc: { badge: true }, tags: ['work'], uni: 'cvsvest' };
    case 'delivery': return { inner: { k: summer ? 'tee' : 'wind', c: N.black }, outer: { k: 'vest', c: '#e8e14a', reflect: true }, bottom: { k: 'cargo', c: N.black }, shoes: { k: 'runner', c: N.black }, acc: {}, tags: ['work'], uni: 'delivery' };
    case 'work': return { inner: { k: 'work', c: ['#3d4f66', '#5b6470'][Math.floor(r() * 2)] }, bottom: { k: 'cargo', c: '#3d4f66' }, shoes: { k: 'ankleboot', c: '#2a211d' }, acc: {}, tags: ['work'], uni: 'work' };
    case 'police': return { inner: { k: 'police', c: '#4a6a96' }, bottom: { k: 'slacks', c: '#1f2a44', cut: 'straight' }, shoes: { k: 'dress', c: '#111' }, tuck: true, acc: {}, tags: ['work'], uni: 'police' };
    case 'fire': return { inner: { k: 'fire', c: '#2f2f33' }, bottom: { k: 'fireP', c: '#2f2f33' }, shoes: { k: 'ankleboot', c: '#111' }, acc: {}, tags: ['work'], uni: 'fire' };
    case 'army': return { inner: { k: 'army', c: '#5b6447', pat: 'camo' }, bottom: { k: 'cargo', c: '#5b6447', pat: 'camo' }, shoes: { k: 'ankleboot', c: '#1c1715' }, tuck: false, acc: {}, tags: ['work'], uni: 'army' };
    case 'pajama': { const c = ['#a9c6dc', '#f0b8c0', '#c9c7c2', '#b9dcc0'][Math.floor(r() * 4)]; return { inner: { k: 'pajama', c, pat: r() < .5 ? 'dot' : 'check' }, bottom: { k: 'pajamaP', c, pat: 'same' }, shoes: { k: 'slipper', c: '#5b6b7a' }, acc: {}, tags: [], uni: 'pajama' }; }
    case 'sports': return { inner: { k: summer ? 'tee' : 'track', c: [N.black, N.navy, '#2b5fa8'][Math.floor(r() * 3)] }, bottom: { k: summer ? 'shorts' : 'training', c: N.black }, shoes: { k: 'runner', c: N.lgray }, acc: {}, tags: ['sporty'], uni: 'sports' };
    case 'swim': return { inner: { k: 'rash', c: ['#2ab3a6', '#1f4fa8', '#e86a8a', N.black][Math.floor(r() * 4)] }, bottom: { k: 'boardshorts', c: ['#f2c230', N.navy, '#ff7f50'][Math.floor(r() * 3)] }, shoes: { k: 'sandal', c: N.black }, acc: {}, tags: ['casual'], uni: 'swim' };
    case 'uniform': {   // 교복: 동복(블레이저) / 하복(반팔 셔츠) / 체육복
      if (summer) return { inner: { k: 'summerUni', c: '#f6f5f1' }, bottom: g === 'f' ? { k: 'uniSkirt', c: '#3b4766' } : { k: 'slacks', c: '#3b4766', cut: 'straight' }, shoes: { k: r() < .5 ? 'loafer' : 'sneaker', c: r() < .5 ? '#2a211d' : N.white }, tuck: true, acc: { bag: 'backpack' }, tags: [], uni: 'uniform' };
      return { inner: { k: 'uniform', c: '#2f3a5a' }, bottom: g === 'f' ? { k: 'uniSkirt', c: '#3b4766' } : { k: 'slacks', c: '#2f3a5a', cut: 'straight' }, shoes: { k: r() < .5 ? 'loafer' : 'sneaker', c: r() < .5 ? '#2a211d' : N.white }, tuck: true, acc: { bag: 'backpack' }, tags: [], uni: 'uniform' };
    }
    case 'gym': return { inner: { k: 'track', c: '#2b4a8a' }, bottom: { k: 'training', c: '#2b4a8a' }, shoes: { k: 'sneaker', c: N.white }, acc: {}, tags: ['sporty'], uni: 'gym' };
  }
  return null;
}

// 예전 생김새의 top·tc → 대표 한 벌 (테스트 시트·ctx 없는 호출). 0 티 / 1 셔츠 / 2 후디 / 3 니트 / 4 교복 / 5 터틀넥 / 6 가디건 / 7 재킷 / 8 줄무늬
const OLD_TOP = ['tee', 'shirt', 'hoodie', 'knit', 'uniform', 'turtle', 'tee', 'shirt', 'stripe'];
const OLD_COLORS = ['#4f6d8f', '#9a4f5f', '#5f8f6a', '#d0a443', '#ece7dd', '#3b3e48', '#8a6fb0', '#d9784a', '#6aa3c8', '#7a8a5a'];
function signature(a, age, X) {
  const g = a.g === 'f' ? 'f' : 'm', c = OLD_COLORS[a.tc || 0] || OLD_COLORS[0], kid = age <= 12, teen = age >= 13 && age <= 18;
  if (teen) return special('uniform', g, age, rng('u' + (a.fs || a.tc)), 'spring');
  let ik = OLD_TOP[a.top] || 'tee';
  if (kid && ['shirt', 'knit', 'uniform', 'turtle'].includes(ik)) ik = ik === 'shirt' ? 'tee' : 'sweat';
  const o = { inner: { k: ik, c: ik === 'stripe' ? (c === '#ece7dd' ? '#3b4a6b' : c) : ik === 'shirt' && a.top === 7 ? N.white : c }, acc: {}, tags: [] };
  if (a.top === 6) o.outer = { k: 'cardigan', c };
  if (a.top === 6) o.inner = { k: 'tee', c: c === '#ece7dd' || c === '#d0a443' ? N.charcoal : N.white };
  if (a.top === 7) o.outer = { k: 'blazer', c, tie: g === 'm' }, o.inner.tie = g === 'm';
  // 하의·신발: 예전 bottomOf·shoeOf와 같은 규칙
  const pants = X.pants, hem = X.hem, sh = X.shoe;
  if (kid) o.bottom = g === 'f' ? (pants < .55 ? { k: 'aline', c: ['#c25a6b', '#6aa3c8', '#d0a443'][a.tc % 3] } : { k: 'shorts', c: ['#4a5f86', '#c25a6b', '#5f8f6a'][a.tc % 3] }) : (pants < .6 ? { k: 'shorts', c: ['#4a5f86', '#7a8a5a', '#3b3e48'][a.tc % 3] } : { k: 'jeans', c: N.denim, cut: 'straight' });
  else if (g === 'f' && (a.tc + a.top) % 3 !== 0) o.bottom = { k: hem > .6 ? 'pencil' : 'aline', c: ['#2e2e36', '#8a6f5a', '#5b4a78', '#7d2f3d'][a.tc % 4], hem };
  else if (g === 'm' && a.top === 1) o.bottom = { k: 'slacks', c: pants < .5 ? N.charcoal : '#2e3440', cut: 'straight' }, o.tuck = true;
  else o.bottom = pants < .6 ? { k: 'jeans', c: N.denim, cut: hem < .5 ? 'skinny' : 'straight' } : pants < .8 ? { k: g === 'f' ? 'slacks' : 'chino', c: g === 'f' ? N.charcoal : N.khaki, cut: g === 'f' && hem < .45 ? 'wide' : 'straight' } : { k: 'jeans', c: '#2f3b55', cut: hem < .5 ? 'skinny' : 'straight' };
  const skirt = BOTTOM[o.bottom.k] && BOTTOM[o.bottom.k].skirt;
  const sk = kid ? 'sneaker' : g === 'f' ? (skirt ? (sh < .7 ? 'heel' : 'sneaker') : sh < .25 ? 'heel' : sh < .88 ? 'sneaker' : 'slipper') : (o.bottom.k === 'slacks' ? 'loafer' : sh < .87 ? 'sneaker' : 'slipper');
  o.shoes = { k: sk, c: sk === 'heel' ? ['#2b2724', '#8c2f3a', '#c9a98b'][a.tc % 3] : sk === 'loafer' ? '#2a211d' : sk === 'slipper' ? '#5b6b7a' : ['#eceae6', '#e2e4ea', '#d9534f', '#3b3e48'][(a.tc + a.top) % 4] };
  return o;
}

// ── 옷장 (3-4): 사람마다 3~6벌 (패션 취미 ×1.5), 계절마다 고르게. 직업이 있으면 출근복 2벌
const CACHE = new Map();
function wardrobe(a, age, who = {}) {
  const g = a.g === 'f' ? 'f' : 'm', band = ageBand(age), wx = who.wx || {};
  const key = [a.fs || a.tc, g, band, who.personality, who.hobby, who.job, who.styleG, wx.extra || 0, (who.closet || []).length].join('|');
  if (CACHE.has(key)) return CACHE.get(key);
  const r = rng('wd:' + key), n = Math.round((3 + Math.floor(r() * 4)) * (who.hobby === 'fashion' ? 1.5 : 1)) + (wx.extra || 0);
  const list = [];
  for (let i = 0; i < Math.max(n, 4); i++) list.push(makeOutfit(r, g, age, who, ALL[i % 4]));
  for (const s of ALL) if (list.filter(o => o.season === s).length < 2) list.push(makeOutfit(r, g, age, who, s));   // 계절마다 최소 2벌
  // 산 옷: 같은 계절의 한 벌에서 그 자리를 바꿔 끼운 한 벌을 더함 (최근 산 것 먼저)
  for (const it of (who.closet || []).slice(-8)) {
    const base = list.find(o => (it.w || ALL).includes(o.season) && (it.slot !== 'bottom' || o.bottom) && (it.slot !== 'inner' || o.inner)) || list[0];
    const o = JSON.parse(JSON.stringify(base));
    if (it.slot === 'dress') { delete o.inner; delete o.bottom; o.dress = { k: it.k, c: it.c }; }
    else if (it.slot === 'inner') { delete o.dress; o.inner = { k: it.k, c: it.c }; if (!o.bottom) o.bottom = { k: 'jeans', c: N.denim, cut: 'straight' }; }
    else o[it.slot] = Object.assign({ k: it.k, c: it.c }, it.cut ? { cut: it.cut } : {});
    o.bought = it.day; o.q = (it.q || 0) / 25; o.season = (it.w || [base.season]).includes(base.season) ? base.season : (it.w || ALL)[0];
    o.score = scoreOf(o, who.styleG) + 1;
    list.push(o);
  }
  const job = who.job && JOBWEAR[who.job];
  const work = job && job !== 'casualW' ? [special(job, g, age, r, 'spring'), special(job, g, age, r, 'summer')] : null;
  const res = { list, work, casualWork: job === 'casualW' };
  if (CACHE.size > 600) CACHE.clear();
  CACHE.set(key, res);
  return res;
}

// 무채색으로 (이별 뒤 한동안)
const MONO = [N.black, N.charcoal, N.gray, N.navy, N.lgray];
const mono = o => { const q = JSON.parse(JSON.stringify(o)); let i = 0; for (const k of ['inner', 'outer', 'bottom', 'dress']) if (q[k] && !['jeans', 'denimskirt'].includes(q[k].k)) q[k].c = MONO[i++ % MONO.length]; if (q.inner) delete q.inner.pat; q.mono = true; return q; };

// 지금 입은 한 벌 (3-4 pickOutfit)
function pick(a, age, ctx, X) {
  const g = a.g === 'f' ? 'f' : 'm';
  if (!ctx || !ctx.season) return signature(a, age, X || {});
  const who = ctx.who || {}, wx = who.wx || {}, season = ctx.season, r = rng(`pk:${a.fs || a.tc}:${ctx.dayN || 0}:${ctx.event || ''}`);
  // 1) 강제 복장: 근무 중 → 출근복 / 학교(18살 이하) → 교복 / 집(밤) → 잠옷 / 바다 → 수영복
  if (ctx.event === 'beach' && age >= 4) return special('swim', g, age, r, season);
  if (ctx.home && (ctx.hour >= 22 || ctx.hour < 7)) return special('pajama', g, age, rng('pj' + (a.fs || a.tc)), season);
  if (age >= 13 && age <= 18 && ctx.school) return special(ctx.gymDay ? 'gym' : 'uniform', g, age, rng('un' + (a.fs || a.tc)), season);
  if (ctx.army) return special('army', g, age, r, season);
  const W = wardrobe(a, age, who);
  if (ctx.working && W.work) { const o = W.work[season === 'summer' ? 1 : 0]; return season === 'winter' && !o.outer && !['fire', 'army'].includes(o.uni) ? Object.assign({}, o, { outer: { k: 'longcoat', c: N.charcoal } }) : o; }
  // 2) 이벤트: 면접·결혼식 → 정장 / 장례 → 검정 / 운동 → 운동복 / 데이트 → 옷장에서 꾸밈 점수가 가장 높은 것
  if (ctx.event === 'interview' || ctx.event === 'wedding') return special('suit', g, age, r, season);
  if (ctx.event === 'funeral') return special('mourning', g, age, r, season);
  if (ctx.event === 'gym') return special('sports', g, age, r, season);
  let pool = W.list.filter(o => o.season === season);
  if (!pool.length) pool = W.list;
  let o;
  if (ctx.event === 'date' || ctx.outfitIx != null) o = ctx.outfitIx != null ? (W.list[ctx.outfitIx] || pool[0]) : pool.slice().sort((x, y) => y.score - x.score)[0];
  else {
    // 3) 계절에 맞는 것 중 하루마다 돌려 입기 (어제 입은 것 제외). 새로 산 옷은 다음 외출에 먼저
    const fresh = pool.filter(q => q.bought != null && ctx.dayN != null && ctx.dayN - q.bought >= 0 && ctx.dayN - q.bought <= 2);
    const base = hash(String(a.fs || a.tc)), day = ctx.dayN || 0, ix = d => (base + d * 7) % pool.length;
    o = fresh.length ? fresh[fresh.length - 1] : pool[ix(day) === ix(day - 1) ? (ix(day) + 1) % pool.length : ix(day)];
  }
  if (ctx.sameAs) o = ctx.sameAs;   // 밤샘·외박: 어제 옷 그대로
  o = Object.assign({}, o, { acc: Object.assign({}, o.acc) });
  if (W.casualWork && ctx.working) o.acc.badge = true;
  // 날씨: 비 → 우산(+장화 10%), 겨울 → 겉옷 필수
  if (ctx.weather === 'rain' || ctx.weather === 'storm') { o.acc.umbrella = true; if (r() < .1) o.shoes = { k: 'rainboot', c: '#e2c34b' }; }
  if (season === 'winter' && !o.outer) o.outer = { k: age <= 29 && r() < .5 ? 'longpad' : 'shortpad', c: N.black };
  if (wx.mono && ctx.dayN != null && ctx.dayN < wx.mono) o = mono(o);
  return o;
}
const likes = (personality, o) => { const L = LIKES[personality] || []; return (o.tags || []).some(t => L.includes(t)); };
// 옷 이름 (요약): "베이지 트렌치코트 + 셔츠 + 슬랙스"
const describe = o => ['outer', 'dress', 'inner', 'bottom'].filter(k => o[k]).map(k => LABELS[o[k].k] || o[k].k).join(' + ');
// 쇼핑 (3-7): 계절에 맞는 아이템 3개 (값·등급). q 0~100 = 꾸밈 점수에 더해짐
function shopItems(g, age, season, seed, money) {
  const r = rng('shop:' + seed), out = [];
  const cats = [['inner', INNER], ['outer', OUTER], ['bottom', BOTTOM], ['dress', DRESS], ['shoes', SHOES]];
  for (let i = 0; i < 12 && out.length < 3; i++) {
    const [slot, cat] = cats[Math.floor(r() * cats.length)];
    const list = Object.entries(cat).filter(([k, it]) => okFor(it, g, age) && it.w.includes(season) && k !== 'rainboot');
    if (!list.length) continue;
    const [k, it] = list[Math.floor(r() * list.length)];
    if (out.some(x => x.k === k)) continue;
    const tier = Math.floor(r() * 3), q = [30, 55, 80][tier] + Math.floor(r() * 10), price = Math.round(([3, 8, 20][tier] + (slot === 'outer' ? 6 : 0) + (it.q || 1) * 2) * (1 + r() * .4));
    const c = slot === 'bottom' && k === 'jeans' ? N.denim : [...NEUTRALS, ...PAL.bold, ...PAL.warm, ...PAL.sharp][Math.floor(r() * 22)];
    out.push({ slot, k, c, q, price, label: it.label, w: it.w, cut: k === 'jeans' ? ['skinny', 'straight', 'wide'][Math.floor(r() * 3)] : undefined });
  }
  return out;
}
window.Outfit = { wardrobe, pick, signature, special, likes, describe, shopItems, LABELS, INNER, OUTER, BOTTOM, DRESS, SHOES, PAL, N, JOBWEAR };
})();
