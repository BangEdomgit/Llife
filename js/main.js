// 화면 — 엔진(js/game.js) 상태를 그리고, 버튼 입력을 엔진에 전달
(function () {
'use strict';

const $ = s => document.querySelector(s);
const WX = window.GAME_DATA.weather;
const G = window.Game;
const STAT_ORDER = ['happy', 'health', 'smart', 'fit', 'looks', 'charm', 'art', 'craft'];
const PST = ['close', 'trust', 'heart', 'grudge'];

const app = $('#app'), logBox = $('#log'), modal = $('#modal'), mBody = $('#mBody');
let bg = { w: null, t: null };
let logState = { id: null, n: 0 };
let modalMode = null, modalArg = null, lastFocus = null, endingFor = null, personFrom = 'people';
let fullView = null;   // 초상화를 눌러 전신으로 펼친 사람 id ('me' = 나)

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 게이지: 둥근 막대 (색은 감싼 요소의 color — .bar 노랑, .bar.low 빨강)
const meter = (pct, cls = '') => `<span class="meter${cls}" role="img" aria-label="${Math.round(pct)}%"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%"></i></span>`;
const bar = v => meter(v);
const CD_ICON = { happy: '😊', health: '❤️', libido: '🔥' };
const mini = v => meter(v, ' sm');
const wxIcon = k => (WX[k] && WX[k].icon) || '';
const genderKo = g => g === 'm' ? '남' : '여';
const isMoney = k => k === 'money';
const pbar = p => meter(p * 100, ' sm');
// 아바타 크기: 관계 목록 32×42 / 장소 48×64 / 상세·이벤트 60×80
const av = (p, size) => window.Avatar ? Avatar.render(G.look(p), size, { age: G.npcAge(p), libido: G.canSex(p) ? p.libido || 0 : 0, fig: G.figure(p), ctx: G.outfitCtx(p) }) : '';   // 화면 속 사람은 늘 나를 대하고 있음 → 나를 향한 성욕(p.libido)만큼 표정이 달라짐 (어른 이성만). 체형 수치 → 전신과 같은 어깨·가슴
// 누르면 전신으로 펼쳐지는 초상화 (20살부터 키·허리·골반 수치가 실루엣에 반영)
const avBtn = (key, html) => `<button type="button" class="av-btn" data-full="${key}" aria-label="${fullView === key ? '접기' : '전신 보기'}" title="${fullView === key ? '접기' : '전신 보기'}">${html}</button>`;
// 전신: 성격에 따라 기본 자세가 다름 (직진형·낙천형 한 손 허리, 냉철형·무심형 팔짱)
//   ctx: 지금 상황(계절·장소·시간·근무…) → 그 상황에 맞게 옷장에서 꺼내 입은 옷 (js/outfit.js)
const fullAv = (look, age, fig, personality, ring, ctx) => window.Avatar ? `<div class="p-full">${Avatar.render(look, 132, { age, full: age >= 20 && fig ? fig : true, personality, ring, ctx })}</div>` : '';
function deltaHTML(d) {
  if (!d || !d.length) return '';
  const parts = d.map(([k, v]) => {
    if (k === 'sat') return `${esc(G.LABEL.sat)} <b class="sat">${v}</b>`;
    const shown = isMoney(k) ? G.fmtMoney(Math.abs(v)) : Math.abs(v);
    return `${esc(G.LABEL[k] || k)} <span class="${v > 0 ? 'p' : 'm'}">${v > 0 ? '+' : '-'}${shown}</span>`;
  });
  return `<span class="delta">(${parts.join(', ')})</span>`;
}

/* ---------- 기록 (새 줄만 덧붙임) ---------- */
function renderLog(S) {
  if (logState.id !== S.id) { logBox.innerHTML = ''; logState = { id: S.id, n: 0 }; }
  const frag = document.createDocumentFragment();
  for (const e of S.log) {
    if (e.n <= logState.n) continue;
    let el;
    if (e.t === 'year') {
      el = document.createElement('div'); el.className = 'year';
      el.textContent = `${e.age}살`;
    } else if (e.t === 'season') {
      el = document.createElement('div'); el.className = 'season';
      el.textContent = `${e.icon} ${e.season} ${wxIcon(e.wx)}`;
    } else {
      el = document.createElement('p'); el.className = e.t;
      el.innerHTML = (e.t === 'mem' ? '✦ ' : '') + esc(e.text) + deltaHTML(e.d);
    }
    frag.appendChild(el);
    logState.n = e.n;
  }
  if (frag.childNodes.length) { logBox.appendChild(frag); logBox.scrollTop = logBox.scrollHeight; }
}

/* ---------- 전체 그리기 ---------- */
// 행동력 막대 (100 기준): 어른은 하루 100 + 새벽 33(빨강), 학교 턴은 그 턴의 100·150
function apDots(ti) {
  if (ti.phase === 'adult') {
    const day = Math.max(0, ti.day - ti.used), late = Math.min(ti.lateMax, Math.max(0, ti.day + ti.lateMax - Math.max(ti.used, ti.day)));
    return `<span class="apbar"><i style="width:${day / ti.day * 100}%"></i></span><span class="apbar late"><i style="width:${late / ti.lateMax * 100}%"></i></span>`;
  }
  if (ti.apMax) return `<span class="apbar"><i style="width:${Math.max(0, ti.ap) / ti.apMax * 100}%"></i></span>`;
  return '';
}
function timeText(ti) {
  const date = `${ti.y}년 ${ti.m}월`;
  if (ti.phase === 'story') return `${ti.season.icon} ${ti.season.id} · ${date}`;
  if (ti.phase === 'adult') return `📅 ${date} ${ti.d}일 (${ti.dow}) ${wxIcon(G.state().weather)} ⏰ ${ti.clock} · ${ti.slot}`;
  return `📅 ${date} ${ti.d}일 (${ti.dow}) ${wxIcon(G.state().weather)} · ${ti.school}${ti.grade === '재수' ? ' 재수' : ti.grade.replace('학년', '')} ${ti.sem}학기 ${ti.week}주차 · ${ti.kindLabel}`;
}
function render(S) {
  $('#name').textContent = S.name;
  $('#age').textContent = `${S.age}살`;
  $('#gender').textContent = genderKo(S.gender);
  $('#role').textContent = G.roleText();
  const tr = G.trait();
  $('#trait').textContent = tr.label;
  $('#trait').title = tr.desc;
  const money = $('#money');
  money.textContent = G.fmtMoney(S.money);
  money.classList.toggle('neg', S.money < 0);
  // 홈 화면 게이지는 행복·건강·성욕만 (성욕은 어른부터, 가장 높은 대상이 있으면 이름도). 능력치·기록은 프로필 원 → 내 정보
  const lt = G.lustTarget();
  $('#conds').innerHTML = G.conds.filter(k => k !== 'libido' || S.age >= G.config.sexMinAge).map(k => {
    const v = S.stats[k], low = k === 'libido' ? v >= 60 : v < 25;
    return `<div class="cd cd-${k}${low ? ' low' : ''}"><span class="cl">${CD_ICON[k]} ${G.LABEL[k]}${k === 'libido' && lt ? `<small class="lt">→${esc(lt.name)}</small>` : ''}</span><b class="cn">${v}</b>${meter(v, ' cm')}</div>`; }).join('');

  renderLog(S);

  const ti = G.timeInfo();
  $('#season').textContent = timeText(ti);
  $('#ap').innerHTML = apDots(ti);
  $('#apNum').textContent = ti.phase === 'adult' ? `⚡ ${Math.max(0, ti.day - ti.used)}/${ti.day}${ti.late ? ' 새벽' : ''} · 🍚 ${mealTxt(ti.meals || 0)}${ti.fatigue >= 3 ? ` · 피로 ${ti.fatigue}` : ''}` : ti.apMax ? `⚡ ${S.ap}/${ti.apMax}` : '';
  $('#crimeBtn').hidden = G.crimes().length === 0 && S.jail === 0;
  $('#mapBtn').disabled = !G.places().length;
  $('#phoneBtn').disabled = S.age < 10;   // 폰은 열 살부터

  renderWhere(S);

  // 아래 큰 버튼: 단계마다 다름 (이야기 계속 / 다음 주 / 잠자기) + 어른은 출근·넘기기 줄 (밥은 장소의 🍽·🎒 가방·🛵 배달)
  const ageBtn = $('#ageUp'), flow = $('#flow');
  const wait = !S.ended && (S.pending.length > 0 || !!S.report);
  ageBtn.textContent = S.ended ? '↻ 새 인생' : ti.phase === 'story' ? '▶ 계속' : ti.phase === 'adult' ? '😴 잠자기' : S.ap > 0 ? `⏭ 다음 주 (⚡${S.ap} 쉬기)` : '▶ 다음 주';
  ageBtn.title = ti.phase === 'adult' ? '오늘 끝내기' : '';
  ageBtn.disabled = wait;
  if (ti.phase === 'adult' && !S.ended) {
    const d = ti.duty;
    flow.hidden = false;
    flow.innerHTML = (d ? `<button type="button" data-flow="duty"${wait ? ' disabled' : ''}>${d.id === 'work' ? '💼' : d.id === 'class' ? '🎓' : '🪖'} ${d.label} <small>⚡${d.ap}</small></button>` : '') +
      `<button type="button" data-flow="week"${wait ? ' disabled' : ''}>⏭ 이번 주 넘기기</button><button type="button" data-flow="month"${wait ? ' disabled' : ''}>⏩ 이번 달 넘기기</button><button type="button" data-flow="event"${wait ? ' disabled' : ''}>⏬ 다음 일까지</button>`;
  } else { flow.hidden = true; flow.innerHTML = ''; }

  // 배경: 지금 날씨와 시간대 (어른은 시계를 따라 하늘이 바뀜)
  WeatherBG.setCity(G.region() === 'ny' ? 'ny' : 'kr');   // 뉴욕이면 마천루·물탱크 실루엣
  if (bg.w !== S.weather) { WeatherBG.setWeather(WX[S.weather].p, bg.w === null); bg.w = S.weather; }
  const sky = S.sky ?? S.time;
  if (bg.t !== sky) { WeatherBG.setTime(sky, bg.t === null); bg.t = sky; }

  sceneBG(S, ti);
  maybeScene(S);
  // 모달 (이벤트 → 성적표·합격 → 원서)
  if (S.intro) openIntro();
  else if (modalMode === 'act') {}   // 🎲 행동 창: 닫을 때까지 이벤트는 기다림
  else if (S.pending.length) openEvent();
  else if (S.report) openReport();
  else if (S.apply) openApply();
  else if (S.ended && endingFor !== S.id) { endingFor = S.id; openEnding(); }
  else if (modalMode === 'event' && dlgBack && G.person(dlgBack)) { const id = dlgBack; dlgBack = null; openPerson(id); }
  else if (['event', 'report', 'apply', 'intro'].includes(modalMode)) closeModal();   // 상태가 사라진 창(확인한 성적표·낸 원서·20년 요약)은 닫음
  else if (modalMode === 'people') openPeople();
  else if (modalMode === 'person') openPerson(modalArg);
  else if (modalMode === 'browse') openBrowse(browseIx);
  else if (modalMode === 'jobs') openJobs();
  else if (modalMode === 'crime') openCrime();
  else if (modalMode === 'me') openMe();
  else if (modalMode === 'food') openFood();
  else if (modalMode === 'bag') openBag();
  else if (modalMode === 'study' || modalMode === 'shop') closeModal();
  else if (modalMode === 'map') openMap(true);   // 지도 창은 그대로 두고 다시 그림 (교통수단 바꿔도 안 닫힘 — 핀으로 이동하면 따로 닫음)
  else if (PHONE_RENDER[modalMode] && inPhone) PHONE_RENDER[modalMode]();   // 📱 폰 앱은 그 화면 그대로 다시
  else if (modalMode === 'dateDress') openPerson(modalArg);   // 데이트 옷을 고르고 나면 그 사람 창으로
}

/* ---------- 장소 배경 (js/scenes.js) ---------- */
// 장소에 가면 그 장소 그림, 장소 밖이면 지금 구역(집 근처 → 집, 수업 끝난 학교 쪽 → 강의실, 직장 → 사무실, 번화가 → 거리)
//   대학은 '대학'에 가면 캠퍼스, 수업 시간(평일 9~17시 학교 쪽)엔 강의실. 중·고등학생은 학기 중 교실, 방학엔 집
const PLACE_SCENE = { home: 'home', playground: 'playground', kinder: 'playground', elem: 'classroom', park: 'park', school: 'classroom', academy: 'academy', campus: 'campus', office: 'office', cafe: 'cafe', library: 'library', gym: 'gym',
  pcbang: 'pcbang', mall: 'street', hospital: 'hospital', center: 'center', station: 'station', bar: 'bar', motel: 'motel', church: 'church', conveni: 'conveni', concert: 'concert', market: 'market', block: 'street', realty: 'street', diner: 'cafe', lecture: 'lecture', cafeteria: 'cafe', ulib: 'library', clubroom: 'academy', quad: 'campus', union: 'campus' };
const SEASON_EN = { 봄: 'spring', 여름: 'summer', 가을: 'fall', 겨울: 'winter' };
function sceneBG(S, ti) {
  if (!window.SceneBG) return;
  const h = ti.clock ? +ti.clock.split(':')[0] : [8, 13, 18][S.time] ?? 13;
  const tod = h < 6 || h >= 20 ? 'night' : h < 10 ? 'morning' : h < 17 ? 'day' : 'evening';
  const pl = G.place();
  let id = null;
  if (S.jail) id = null;
  else if (pl) id = PLACE_SCENE[pl.id] || null;
  else if (ti.phase === 'story') id = 'home';
  else if (ti.phase === 'ms' || ti.phase === 'hs') id = S.tkind === 'vac' ? 'home' : 'classroom';
  else if (ti.phase === 'adult') {
    const z = S.zone || 'home';
    id = z === 'home' ? 'home' : z === 'school' ? (S.flags.student && !ti.weekend && h >= 9 && h < 17 ? 'lecture' : 'campus') : z === 'work' ? 'office' : z === 'downtown' ? 'street' : null;
  }
  SceneBG.set({ id, tod, season: SEASON_EN[ti.season && ti.season.id] || 'spring', wet: /rain|storm|snow|sleet/.test(S.weather || '') });
}

/* ---------- 하단: 장소 고르기 → 거기 있는 사람 + 할 수 있는 것 ---------- */
function actButtons(acts) {
  return acts.map(a => {
    const c = G.costOf(a), ap = a.escape ? 0 : G.apOf(a);
    return `<button type="button" class="act" data-a="${a.id}"${G.canDo(a) ? '' : ' disabled'}${c ? ` title="${G.fmtMoney(c)}"` : ''}><span class="ic" aria-hidden="true">${a.icon}</span>${a.label}<small>${ap ? `⚡${ap}` : ''}${c ? `${ap ? ' · ' : ''}${G.fmtMoney(c)}` : ''}</small></button>`;
  }).join('');
}
/* ---------- 지도: 핀을 누르면 그곳으로 이동 (js/citymap.js 배경 + data/map.js 위치) ---------- */
// 핀: 아이콘 · 이름 · 이동 비용(⚡) 또는 못 가는 까닭. 지금 있는 곳은 빨간 고리, 장소 밖이면 서 있는 곳에 📍
const WHY_SHORT = { '같이 갈 사람이 있어야': '동행 필요', '직업이 있어야': '직장인만', '지금은 못 감': '닫힘' };
// mode: 'city' 시내 지도 / 'campus' 대학 캠퍼스 지도 (캠퍼스 안 장소들, 정문 = 시내의 '대학')
let mapMode = null;
const campusOK = () => G.places().some(p => p.campus && p.id !== 'campus');
// 시내 지도는 720×920 — 크게 보기(스크롤) / 한눈에 보기. 열 때·움직일 때 지금 있는 곳을 가운데로
let mapZoom = (() => { try { return localStorage.getItem('llife-mapzoom') || 'big'; } catch (e) { return 'big'; } })(), mapCenterKey = null;
function mapHTML(list, mode) {
  const S = G.state(), night = S.time === 2 || (S.sky ?? 0) > 1.6, cp = mode === 'campus', GM = window.GAME_DATA.map, W = cp ? 360 : GM.w || 720, H = cp ? 460 : GM.h || 920;
  const pins = list.filter(p => cp ? p.campus && p.cpos : p.pos).map(p => {
    const xy = cp ? p.cpos : p.pos, rd = !cp && p.ride && !p.here ? p.ride : null;
    const sub = p.here || (p.at && !p.cost) ? '지금 여기' : p.why ? (WHY_SHORT[p.why] || p.why) : `⚡${p.cost}${rd && rd.mode !== 'walk' ? ` ${rd.ic}` : ''}${rd && rd.money ? ` ${rd.moneyT}` : ''}`;
    return `<button type="button" class="pin${p.here ? ' here' : ''}${p.at ? ' at' : ''}${p.regular ? ' reg' : ''}${p.id === 'home' ? ' home' : ''}${!p.ok && !p.here && p.why ? ' off' : ''}${p.ok && !p.here && !p.at ? ' go' : ''}" data-pl="${p.id}" style="left:${(xy[0] / W * 100).toFixed(2)}%;top:${(xy[1] / H * 100).toFixed(2)}%"${p.ok ? '' : ' disabled'}${p.why ? ` title="${esc(p.why)}"` : ''}>
      <span class="pi" aria-hidden="true">${p.icon}</span><span class="pn">${esc(cp ? p.clabel : p.label)}${p.regular ? ' ★' : ''}</span><small>${esc(sub)}</small></button>`;
  }).join('');
  const univ = cp ? G.univLabel() : '';
  const map = `<div class="cmap${night ? ' night' : ''}${cp ? ' campus' : ''}">${window.CityMap ? (cp ? CityMap.campusSvg(univ) : CityMap.svg(G.region())) : ''}${pins}</div>`;
  if (cp) return map;
  if (G.region() === 'kr') {   // 서울: 휠·두 손가락으로 확대/축소, 끌어서 이동, ＋/－ (지도 폭 = 720 × 배율)
    return `${rideBar()}<div class="cmap-wrap"><div class="cmap-view kr${mapScale < .75 ? ' zs' : ''}">${map.replace('<div class="cmap', `<div style="width:${Math.round(720 * mapScale)}px" class="cmap`)}</div>
      <div class="cm-zbtn" role="group" aria-label="지도 확대·축소"><button type="button" data-mapz="in" aria-label="확대">＋</button><button type="button" data-mapz="out" aria-label="축소">－</button><button type="button" data-mapz="fit" aria-label="전체 보기">⤢</button></div></div>
      <p class="cm-legend"><span><i class="k me"></i>내 위치</span><span><i class="k go"></i>갈 수 있는 곳</span><span><i class="k kinder">유</i>유치원</span><span><i class="k elem">초</i>초등</span><span><i class="k mid">중</i>중</span><span><i class="k high">고</i>고</span><span>🚇 역</span><button type="button" class="cm-zoom" data-mapcenter>📍 내 위치</button></p>
      <p class="hint cm-hint">마우스 휠·두 손가락으로 확대/축소, 끌어서 이동</p>`;
  }
  return `${rideBar()}<div class="cmap-view ${mapZoom}">${map}</div>
    <p class="cm-legend"><span><i class="k kinder">유</i>유치원</span><span><i class="k elem">초</i>초등</span><span><i class="k mid">중</i>중학교</span><span><i class="k high">고</i>고등학교</span><span>🚇 지하철역</span><button type="button" class="cm-zoom" data-mapzoom>${mapZoom === 'big' ? '🗺️ 한눈에' : '🔍 크게'}</button><button type="button" class="cm-zoom" data-mapcenter>📍 내 위치</button></p>`;
}
// 교통 칩: 자동·걷기·자전거·버스·지하철·(내 차)·택시 + 차 사기/팔기 + 막차 안내
function rideBar() {
  const S = G.state();
  if (G.phase() !== 'adult' || !G.ride) return '';
  const R = G.ride.info();
  const chips = R.modes.map(m => `<button type="button" data-ride="${m.id}" aria-pressed="${R.pref === m.id}">${m.ic} ${esc(m.label)}</button>`).join('');
  const car = R.car ? `<button type="button" class="ride-car" data-sellcar>🚗 내 차 · 월 ${G.fmtMoney(R.carMonth)} <small>팔기</small></button>`
    : R.canCar ? `<button type="button" class="ride-car" data-buycar${S.money < R.carPrice ? ' disabled' : ''}>🚗 중고차 사기 <small>${G.fmtMoney(R.carPrice)}</small></button>` : '';
  return `<div class="ride-bar" role="group" aria-label="이동 수단">${chips}${car}</div>${R.late ? `<p class="hint ride-late">🌙 ${G.region() === 'kr' ? '지하철 막차가 끊겼다 — 심야 N버스·택시·걷기' : '심야 — 지하철은 24시간이지만 배차가 길다'}</p>` : ''}`;
}
// 지도 가운데 맞추기 (지금 있는 곳 → 없으면 집)
function centerMap(force) {
  const v = (modalMode === 'map' ? mBody : $('#where')).querySelector('.cmap-view') || document.querySelector('.cmap-view');
  if (!v || (mapZoom !== 'big' && !v.classList.contains('kr'))) return;
  const S = G.state(), key = `${S.place || S.at || 'home'}:${S.dayN}:${G.region()}`;
  if (!force && key === mapCenterKey) return;
  mapCenterKey = key;
  const pin = v.querySelector('.pin.here, .pin.at') || v.querySelector('.pin.home');
  if (!pin) return;
  const m = v.querySelector('.cmap'), x = parseFloat(pin.style.left) / 100 * m.offsetWidth, y = parseFloat(pin.style.top) / 100 * m.offsetHeight;
  v.scrollLeft = Math.max(0, x - v.clientWidth / 2); v.scrollTop = Math.max(0, y - v.clientHeight / 2);
}
// 서울 지도 확대·축소: 배율(mapScale) — 기준점(ax, ay: 보이는 칸 안 좌표)이 그 자리에 머물게 스크롤을 맞춤
let mapScale = (() => { try { return +localStorage.getItem('llife-mapscale') || 1; } catch (e) { return 1; } })();
function setMapScale(v, s, ax, ay) {
  const m = v && v.querySelector('.cmap');
  if (!m) return;
  const min = Math.min(1, v.clientWidth / 720), s2 = Math.max(min, Math.min(3, s));
  if (ax == null) { ax = v.clientWidth / 2; ay = v.clientHeight / 2; }
  const fx = (v.scrollLeft + ax) / m.offsetWidth, fy = (v.scrollTop + ay) / m.offsetHeight;
  m.style.width = Math.round(720 * s2) + 'px';
  mapScale = s2;
  v.classList.toggle('zs', s2 < .75);
  v.scrollLeft = fx * m.offsetWidth - ax; v.scrollTop = fy * m.offsetHeight - ay;
  clearTimeout(setMapScale.t); setMapScale.t = setTimeout(() => { try { localStorage.setItem('llife-mapscale', String(mapScale)); } catch (e) {} }, 300);
}
const zoomView = el => el && el.closest && el.closest('.cmap-view.kr');
document.addEventListener('wheel', e => {   // 휠 = 확대/축소
  const v = zoomView(e.target);
  if (!v) return;
  e.preventDefault();
  const r = v.getBoundingClientRect();
  setMapScale(v, mapScale * Math.exp(-e.deltaY * (e.deltaMode === 1 ? .06 : .0022)), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
let pinch = null;   // 두 손가락 = 확대/축소 (한 손가락은 그냥 밀어서 이동)
const tDist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
document.addEventListener('touchstart', e => { const v = zoomView(e.target); if (v && e.touches.length === 2) pinch = { v, d: tDist(e.touches) || 1, s: mapScale }; }, { passive: true });
document.addEventListener('touchmove', e => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const r = pinch.v.getBoundingClientRect(), [a, b] = e.touches;
  setMapScale(pinch.v, pinch.s * tDist(e.touches) / pinch.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top);
}, { passive: false });
document.addEventListener('touchend', e => { if (pinch && e.touches.length < 2) pinch = null; });
let mdrag = null, mdragClick = false;   // 마우스로 끌어서 이동 (끈 뒤의 클릭은 핀 이동으로 치지 않음)
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0) return; const v = zoomView(e.target); if (v) mdrag = { v, x: e.clientX, y: e.clientY, sl: v.scrollLeft, st: v.scrollTop, moved: false }; });
document.addEventListener('pointermove', e => {
  if (!mdrag) return;
  const dx = e.clientX - mdrag.x, dy = e.clientY - mdrag.y;
  if (!mdrag.moved && Math.hypot(dx, dy) < 6) return;
  mdrag.moved = true; mdrag.v.classList.add('drag');
  mdrag.v.scrollLeft = mdrag.sl - dx; mdrag.v.scrollTop = mdrag.st - dy;
});
document.addEventListener('pointerup', () => { if (!mdrag) return; mdrag.v.classList.remove('drag'); if (mdrag.moved) { mdragClick = true; setTimeout(() => { mdragClick = false; }, 0); } mdrag = null; });
document.addEventListener('click', e => {
  if (mdragClick) { e.stopPropagation(); e.preventDefault(); mdragClick = false; return; }
  const b = e.target.closest && e.target.closest('[data-mapz]');
  if (!b) return;
  e.stopPropagation();
  const v = b.closest('.cmap-wrap') && b.closest('.cmap-wrap').querySelector('.cmap-view');
  if (!v) return;
  const z = b.dataset.mapz;
  setMapScale(v, z === 'in' ? mapScale * 1.4 : z === 'out' ? mapScale / 1.4 : 0);
}, true);
// 지도 모드 고르기: 캠퍼스 안에 있으면 캠퍼스 지도부터 (버튼으로 바꿈)
const mapModeNow = () => mapMode && (mapMode !== 'campus' || campusOK()) ? mapMode : G.onCampus() ? 'campus' : 'city';
const mapToggle = mode => campusOK() ? `<button type="button" class="map-tog" data-mapmode="${mode === 'campus' ? 'city' : 'campus'}">${mode === 'campus' ? '🏙️ 시내 지도' : '🎓 캠퍼스 지도'}</button>` : '';
// 이웃 구성 막대 (부동산 앱 내 집 탭)
const HH_LABEL = { single: '혼자 사는 사람', student: '학생', roommates: '룸메이트', couple: '동거 커플', married: '부부', family: '아이 있는 가족', elder: '어르신' };
const HH_COLOR = { single: '#8fb8e8', student: '#a7d8c8', roommates: '#c8b4e8', couple: '#f2a3b8', married: '#f4c26b', family: '#9ed48a', elder: '#c9b08f' };
const hhMix = hh => { const t = Object.values(hh).reduce((a, b) => a + b, 0) || 1; return `<div class="hh-bar">${Object.entries(hh).map(([k, v]) => `<i style="width:${v / t * 100}%;background:${HH_COLOR[k]}" title="${HH_LABEL[k]} ${Math.round(v / t * 100)}%"></i>`).join('')}</div>
    <div class="hh-leg">${Object.entries(hh).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><b style="background:${HH_COLOR[k]}"></b>${HH_LABEL[k]} ${Math.round(v / t * 100)}%</span>`).join('')}</div>`; };
// keep: 이미 열린 지도 창을 다시 그릴 때 (교통수단·차·상태가 바뀜) — 보던 자리·배율 그대로
function openMap(keep) {
  const ti = G.timeInfo(), S = G.state(), mode = mapModeNow();
  const old = keep === true && modalMode === 'map' && mBody.querySelector('.cmap-view'), sx = old ? old.scrollLeft : 0, sy = old ? old.scrollTop : 0;
  showModal('map', mode === 'campus' ? '🎓 캠퍼스 지도' : '🗺️ 지도', `${mapToggle(mode)}${mapHTML(G.places(), mode)}<p class="hint">${ti.phase === 'adult' ? `가고 싶은 곳을 누르면 바로 이동한다. ⚡ = 이동에 드는 행동력 (1 ≈ 11분), 옆은 교통수단·요금. 남은 행동력 ⚡${S.ap} · ⏰ ${ti.clock}` : `어디든 ⚡${G.teenPt}. 남은 행동력 ⚡${S.ap}`}</p>`);
  const v = mBody.querySelector('.cmap-view');
  if (old && v) { v.scrollLeft = sx; v.scrollTop = sy; }
  else requestAnimationFrame(() => centerMap(true));
}
const ageBand = age => age < 13 ? '어린이' : age < 20 ? `${age < 16 ? '10대 중반' : '10대 후반'}` : `${Math.floor(age / 10) * 10}대${age % 10 < 4 ? ' 초반' : age % 10 < 7 ? ' 중반' : ' 후반'}`;
// 낯선 사람: '낯선 여자 (~25)' — 나이는 5살 단위 어림, 일행이면 '외 n명', 반지가 보이면 (반지)
function strangerLabel(p, grp) {
  const a = G.npcAge(p), who = a < 13 ? (p.gender === 'f' ? '여자아이' : '남자아이') : p.gender === 'f' ? '여자' : '남자';
  return `낯선 ${who} (~${Math.max(5, Math.round(a / 5) * 5)})${grp ? ` 외 ${grp}명` : ''}`;
}
// 여기 있는 사람 한 줄 (목록): 아바타 · 이름(아는 사람) 또는 '낯선 여자 (~25)' · 배지 · 하고 있는 일 · 관계
//   배지: 💍 기혼(반지가 보이면 바로) · 💑 부부 / 👫 커플 (짝과 같이 있음) · 👥 일행 · 👋 이쪽을 봄 · 📱 번호 있음
function hereBadges(h) {
  const p = h.p, b = [], mk = h.stranger ? '' : G.marker(p);
  if (mk) b.push(`<span class="bd wed" title="${mk === '💍' ? '기혼' : '반지 — 기혼 추정'}">${mk}${mk === '💍' ? ' 기혼' : ''}</span>`);
  else if (h.ring) b.push('<span class="bd wed" title="왼손에 결혼 반지">💍 반지</span>');
  if (h.couple) b.push(`<span class="bd cp">${h.wed ? '💑 부부' : '👫 커플'}</span>`);
  else if (h.withMate) b.push(`<span class="bd cp">👫 ${esc(G.mateWord(G.person(h.p.mateId) || {}))}와 함께</span>`);
  else if (h.grp) b.push(`<span class="bd">👥 일행 ${h.grp}</span>`);
  if (h.approach) b.push('<span class="bd hey" title="이쪽을 힐끔거린다">👋</span>');
  if (h.phone) b.push('<span class="bd ph" title="번호 있음">📱</span>');
  return b.join('');
}
function hereRow(h) {
  const p = h.p;
  const who = h.stranger ? esc(strangerLabel(p)) : `${h.staff ? `<span class="bd staff">${esc(p.role || G.relLabel(p))}</span> ` : ''}${esc(G.pname(p))} <span class="dim">(${G.npcAge(p)})</span>`;
  return `<button type="button" class="hp${h.used ? ' used' : ''}${h.stranger ? ' x' : ''}" data-hp="${h.key}" title="${esc(h.doing)}">${av(p, 28)}
    <span class="hw"><span class="hn"><b>${who}</b>${hereBadges(h)}</span><span class="hd">${h.used ? '이야기함' : esc(h.doing)}</span></span>${h.stranger ? '' : `<span class="hr">${esc(G.relLabel(p))}</span>`}</button>`;
}
// 이 장소에 오는 사람들 한 줄 (장소 분포) + 지금 보이는 낯선 사람들 요약 (나이대·성비·커플)
function crowdLine(here) {
  const note = G.hereNote(), xs = here.filter(h => h.stranger);
  if (!note) return '';
  const ages = xs.map(h => G.npcAge(h.p)).sort((a, b) => a - b), mid = ages.length ? ages[ages.length >> 1] : 0;
  const nF = xs.filter(h => h.p.gender === 'f').length, nC = xs.filter(h => h.couple).length;
  const sum = xs.length ? [`주로 ${Math.floor(mid / 10) * 10}대`, `여자 ${nF} · 남자 ${xs.length - nF}`, nC ? `커플 ${nC}쌍` : ''].filter(Boolean).join(' · ') : '';
  return `<p class="crowd-note"><span>${note.open ? '📅' : '👥'} ${esc(note.t)}</span>${sum ? `<small>${esc(sum)}${note.open ? ' · 매일 다른 사람들' : ''}</small>` : ''}</p>`;
}
function renderWhere(S) {
  const box = $('#where');
  if (S.jail) {
    box.innerHTML = `<div class="acts">${actButtons(G.actionList())}</div>`;
    return;
  }
  const pl = G.place();
  if (!pl) {
    const list = G.places();
    const ti = G.timeInfo();
    if (ti.phase === 'story') { box.innerHTML = '<p class="empty">어린 시절은 이야기로 흘러간다. <b>▶ 계속</b>을 누르면 다음 장면으로.</p>'; return; }
    const adult = ti.phase === 'adult', at = list.find(p => p.at);
    const head = adult ? `<p class="sec-t">🗺️ 어디로 갈까? <span class="dim">· ${at ? `지금 ${esc(at.label)} 근처` : `지금 ${esc(ti.zone)}`} · 핀을 누르면 이동 (⚡ 거리만큼)</span></p>`
      : ti.apMax ? `<p class="sec-t">🗺️ ${esc(ti.kindLabel)} 턴 <span class="dim">· 이동 ⚡${G.teenPt} · 행동 ⚡${G.teenPt} · 같이 있는 사람에게 말 걸기는 행동력 안 씀</span></p>` : '';
    const duty = adult && ti.duty ? `<p class="hint">평일이다. 먼저 ${ti.duty.id === 'work' ? '출근' : ti.duty.id === 'class' ? '수업' : '훈련'}부터 (⚡${ti.duty.ap}). 아침밥은 그 전에 먹을 수 있다.</p>` : '';
    const mode = mapModeNow();
    const keep = box.querySelector('.cmap-view'), sx = keep ? keep.scrollLeft : 0, sy = keep ? keep.scrollTop : 0;
    box.innerHTML = list.length
      ? `${head}${duty}${adult ? foodBar(G.food.here()) : ''}${mapToggle(mode)}${mapHTML(list, mode)}`
      : ti.apMax ? '<p class="empty">갈 수 있는 곳이 없다.</p>' : `<p class="empty">${esc(ti.kindLabel || '')} 주간이다. <b>▶ 다음 주</b>를 누르면 이어진다.</p>`;
    const v = box.querySelector('.cmap-view');
    if (v) { v.scrollLeft = sx; v.scrollTop = sy; requestAnimationFrame(() => centerMap(false)); }
    return;
  }
  const here = G.here(), acts = G.actionList();
  const nStaff = here.filter(h => h.staff).length, nKnown = here.filter(h => !h.stranger && !h.staff).length, nNew = here.filter(h => h.stranger).reduce((t, h) => t + 1 + (h.grp || 0), 0);
  box.innerHTML = `
    <div class="here-head"><span>📍 현재 장소: <b>${esc(pl.label)}</b> ${pl.icon}${S.regular[pl.id] ? ' <small class="dim">단골</small>' : ''}${S.drunk ? ` <small class="drunk d${S.drunk}">🍺 ${G.drunkLabel()}</small>` : ''}</span><button type="button" class="map-btn" data-map>🗺️ 지도</button></div>
    ${compBar(pl)}
    <p class="sec-t">👥 여기 있는 사람 ${nStaff + nKnown + nNew}명 <span class="dim">· ${nStaff ? `일하는 사람 ${nStaff} · ` : ''}아는 사람 ${nKnown} · 처음 보는 사람 ${nNew} · 말 걸기는 행동력 안 씀</span>${pl.crowd ? ' <button type="button" class="br-open" data-browse>👀 둘러보기</button>' : ''}</p>
    ${crowdLine(here)}
    <div class="here">${here.length ? [['🧑‍💼 여기서 일하는 사람', here.filter(h => h.staff)], ['아는 사람', here.filter(h => !h.stranger && !h.staff)], ['처음 보는 사람', here.filter(h => h.stranger)]].filter(g => g[1].length).map(([t, L]) => `<p class="here-g">${t} <small>${L.length}</small></p>${L.map(hereRow).join('')}`).join('') : '<p class="empty">아무도 없다.</p>'}</div>
    ${foodBar(G.food.here())}
    <p class="sec-t">여기서 할 수 있는 것 <span class="dim">· ⚡ = 드는 행동력</span></p>
    <div class="acts">${actButtons(acts) || '<p class="empty">여기선 딱히 할 게 없다.</p>'}</div>`;
}

// 동행 — 밖이면 모텔·집으로 바로 가는 버튼, 모텔·집이면 바로 즐기기
function compBar(pl) {
  const c = G.companion();
  if (!c) return '';
  const inside = pl.id === 'motel' || pl.id === 'home';
  const go = inside ? '' : G.places().filter(x => x.id === 'motel' || x.id === 'home').map(x =>
    `<button type="button" data-pl="${x.id}"${x.ok ? '' : ' disabled'}>${x.icon} ${esc(G.josa(x.label, '으로'))}${x.cost ? ` <small>⚡${x.cost}</small>` : ''}</button>`).join('');
  const enjoy = inside && G.interactions(c.id).some(i => i.id === 'enjoy') ? `<button type="button" class="hot" data-enjoy="${c.id}">♂♀ 즐기기</button>` : '';
  return `<p class="comp">🤝 동행: <b>${esc(G.pname(c))}</b> <span class="dim">${inside ? '— 단둘이' : '— 같이 간다'}</span><span class="go">${go}${enjoy}<button type="button" data-endco>헤어지기</button></span></p>`;
}

/* ---------- 연출 (S.scene) ---------- */
// 함께 밤을 보낸 뒤: 이불 들썩임 + 하트 → 다음 날 아침(초상화 + 아침 한 줄 + 바닥의 옷) → (임신이면) 정자·난자
// 키스·포옹·끌어당기기: 실루엣 한 장. 행위 자체는 그리지 않음
const sceneEl = $('#scene'), sceneBox = $('#sceneBox');
const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let sceneSeen = null, sceneQueue = [], sceneTimer = null;
const PROFILE = 'M38,12 C22,12 10,24 10,42 C10,54 14,62 18,68 L18,96 L44,96 L44,82 C48,82 52,80 53,76 C54,72 52,70 54,68 C56,67 57,65 55,63 C57,62 58,60 56,58 L60,54 C61,52 60,51 58,50 C56,44 56,38 54,32 C50,20 46,12 38,12 Z';
const SIL = {
  kiss: `<svg viewBox="0 0 200 110" class="sil"><g transform="translate(40,4) rotate(-6 30 90)"><path d="${PROFILE}"/></g><g transform="translate(160,6) scale(-1,1) rotate(-6 30 90)"><path d="${PROFILE}"/></g><path class="sil-heart" d="M100,8 c-4,-6 -12,-2 -8,4 l8,8 l8,-8 c4,-6 -4,-10 -8,-4 Z"/></svg>`,
  hug: `<svg viewBox="0 0 200 110" class="sil"><circle cx="118" cy="34" r="15"/><path d="M98,110 C98,74 104,56 118,52 C132,56 140,74 140,110 Z"/><circle cx="84" cy="30" r="16"/><path d="M60,110 C60,74 68,54 84,50 C100,54 106,74 106,110 Z"/><path d="M96,66 C112,58 132,60 138,76 C140,83 135,85 131,80 C124,71 110,72 98,78 Z"/></svg>`,
  pull: `<svg viewBox="0 0 200 110" class="sil"><circle cx="70" cy="30" r="15"/><path d="M48,110 C48,74 56,54 70,50 C84,54 92,74 92,110 Z"/><g transform="rotate(-10 128 110)"><circle cx="128" cy="32" r="14"/><path d="M108,110 C108,76 114,58 128,54 C142,58 148,76 148,110 Z"/></g><path d="M86,70 C98,66 110,72 116,82 C118,86 113,88 110,84 C104,78 96,76 88,78 Z"/></svg>`,
};
function floorClothes(p) {
  const c = Avatar.topColor(G.look(p));
  const pers = p.personality || 'warm';
  const uc = p.gender === 'f'
    ? (pers === 'bold' ? '#2a2a2a' : pers === 'shy' ? '#e8dff0' : pers === 'sensitive' ? '#f5e0e4' : '#d4c8b8')
    : '#3a4a5a';
  const under = p.gender === 'f'
    ? `<g transform="translate(158,10) rotate(-8)"><path d="M0,8 Q8,-4 16,8 Q24,-4 32,8 L30,14 Q24,4 16,14 Q8,4 2,14 Z" fill="${uc}" opacity=".45"/><path d="M0,8 Q8,-4 16,8 Q24,-4 32,8" fill="none" stroke="${uc}" stroke-width="1.5" opacity=".55"/></g>
       <g transform="translate(148,26) rotate(12)"><path d="M0,0 L18,0 L20,12 L10,14 L0,12 Z" fill="${uc}" opacity=".4"/><path d="M4,4 Q10,2 16,4" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="1"/></g>`
    : `<g transform="translate(150,12) rotate(-6)"><path d="M0,0 L30,0 L32,22 L18,22 L16,8 L14,22 L0,22 Z" fill="${uc}" opacity=".4"/><path d="M2,6 L28,6" fill="none" stroke="rgba(0,0,0,.15)" stroke-width="1.2"/></g>`;
  return `<svg class="floor" viewBox="0 0 240 48" aria-hidden="true">
    <g transform="rotate(-10 50 30)"><path d="M18,36 C10,28 18,14 36,16 C46,8 70,12 74,22 C86,20 96,30 88,36 C68,42 38,42 18,36 Z" fill="${c}"/>
    <path d="M30,28 Q44,22 56,30 M58,22 Q68,26 76,32" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="1.8"/>
    <path d="M22,20 L18,8 L26,6 M72,18 L78,8 L70,6" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>
    ${under}</svg>`;
}
const CONCEIVE = `<svg class="conceive" viewBox="0 0 300 120" aria-hidden="true"><defs><radialGradient id="egg" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fff2e6"/><stop offset="1" stop-color="#e9a88e"/></radialGradient></defs>
  <circle class="glow" cx="232" cy="60" r="48" fill="#ffd9a8"/>
  ${[[196, 30], [268, 34], [272, 86], [200, 92], [232, 18], [234, 104]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#e9b9a3" opacity=".7"/>`).join('')}
  <circle cx="232" cy="60" r="34" fill="url(#egg)"/>
  ${[1, 2, 3].map(i => `<g class="sp sp${i}"><ellipse cx="0" cy="0" rx="5" ry="3.4" fill="#f4f4f4"/><path class="tail" d="M-5,0 q-6,-4 -12,0 t-12,0 t-12,0" fill="none" stroke="#f4f4f4" stroke-width="1.4"/></g>`).join('')}</svg>`;
function sceneCard(html) {
  sceneBox.innerHTML = html;
  const b = sceneBox.querySelector('button');
  if (b) b.focus({ preventScroll: true });
}
const CONTRA_LABEL = { none: '피임 안 함', condom: '콘돔', pill: '피임약', both: '콘돔 + 피임약' };
// 다음 날 아침 카드: 만족감에 따라 표정·머리가 달라진 초상화(80×107) + 아침 한 줄 + 바닥의 옷
function morningCard(sc, p) {
  const S = G.state(), dt = window.Night && Night.detail(), rec = dt ? Night.lastStats() : null;
  const look = { age: G.npcAge(p), after: { sat: sc.sat, personality: p.personality, lipstick: S.gender === 'f' && p.gender === 'm', hickey: S.gender === 'm' && p.gender === 'f', fig: sc.fig, detail: rec && rec.marks ? { shown: rec.marks, lip: rec.lip } : null } };
  // 디테일 모드(테스트): 만족감 단계별 아침 한 줄 + 어젯밤 기록(길이·체위·절정·최고 쾌락·움찔·헉·자국·종합 점수)
  const tierN = [30, 50, 70, 90].filter(v => (sc.sat ?? 50) >= v).length, MN = window.GAME_DATA.morningNarr;
  const narr = dt && MN ? MN[tierN][Math.floor(Math.random() * MN[tierN].length)].replace(/\{p\|(.)\}/g, (_, j) => G.josa(G.pname(p), j)).replace(/\{p\}/g, G.pname(p)) : '';
  const recHTML = rec ? `<div class="sc-rec">📝 <b>어젯밤 기록</b> (디테일)<br>${rec.early ? `${rec.dur}분 만에 끝남` : `${rec.dur}분`} · 섹스 기술 ${rec.grade} · ${rec.cm}cm · 종합 ${rec.pow ?? '?'}<br>체위: ${rec.poses.filter((k, i, a) => !i || a[i - 1] !== k).map(k => Night.poseLabel[k] || k).join(' → ')}<br>` +
    `절정: 소 ${rec.counts.minor} · 중 ${rec.counts.mid} · 대 ${rec.counts.major} · 최고 쾌락 ${rec.maxPl}<br>헉 ${rec.gasp}번 · 움찔 ${rec.ouch}번 · 남은 자국 ${rec.marks}개</div>` : '';
  return `<p class="sc-t">다음 날 아침</p><div class="sc-port">${Avatar.render(G.look(p), 80, look)}</div>
    <p>${esc(sc.text || '')}</p>${narr ? `<p class="sc-narr">${esc(narr)}</p>` : ''}<p class="dim sc-sat">만족감 ${sc.sat}${sc.contra ? ` · ${CONTRA_LABEL[sc.contra]}` : ''}</p>${recHTML}${floorClothes(p)}<button type="button" data-sc-next>계속</button>`;
}
// 그날 밤 장면은 night.js (Night.html / Night.run)
let nightJob = null;
function playScene(sc, testP) {
  const p = testP || G.person(sc.pid);   // testP: 그날 밤 테스트 창의 상대 (사람 목록에 없음)
  if (!p || !window.Avatar) { G.clearScene(); return; }
  sceneEl.hidden = false;
  clearTimeout(sceneTimer);
  if (sc.kind !== 'night') {
    sceneQueue = [];
    // 골목: 벽에 기댄 상대가 깃을 잡아끌고 입맞춤 (night.js) — 키스까지만
    const art = sc.kind === 'alley' && window.Night ? Night.alley(G.state().gender === 'm', p.gender === 'm', Night.detail() ? window.GAME_DATA.alleyCap : null) : SIL[sc.kind] || '';
    sceneCard(`<div class="sc-card">${art}<p>${esc(sc.text || '')}</p><button type="button" data-sc-next>계속</button></div>`);
    return;
  }
  const morningQ = [() => `<div class="sc-card sc-morning">${morningCard(sc, p)}</div>`];   // 보여 줄 때 그림 (디테일 모드의 어젯밤 기록)
  const pregQ = sc.preg ? [`<div class="sc-card">${CONCEIVE}<p class="sc-later">몇 주 뒤, ${esc(G.josa(G.pname(p), '이'))} 할 말이 있다고 했다.</p><button type="button" data-sc-next>계속</button></div>`] : [];
  nightJob = { sc, p };
  if (window.Night) Night.resetStats();   // 어젯밤 기록은 이번 그날 밤을 본 경우에만 (동작 줄이기면 없음)
  // 서서 다가감 → 그날 밤 → (콘돔 없이면) 자궁 그림 → 다음 날 아침 → (임신이면) 몇 주 뒤
  const S = G.state(), inside = sc.contra === 'none' || sc.contra === 'pill';
  const tops = [Avatar.topColor(S.gender === 'm' ? G.myLook() : G.look(p)), Avatar.topColor(S.gender === 'm' ? G.look(p) : G.myLook())];
  const nightQ = calm || !window.Night ? [] : (sc.direct ? [] : [() => `<div class="sc-card sc-fp">${Night.foreplay(tops, Night.detail() ? window.GAME_DATA.foreCap : null)}</div>`]).concat([() => `<div class="sc-night"><p class="sc-t">그날 밤${sc.test ? ' <small class="dim">(테스트)</small>' : ''}</p>${Night.html(sc.spot)}<div class="nt-bar"><span class="nt-clock">⏱ 0:00</span><span class="nt-pose"></span><span class="nt-cnt"></span></div><div class="nt-btns"><span class="nt-rate" role="group" aria-label="배속">${[1, 2, 4, 8].map(r => `<button type="button" data-nt-rate="${r}"${Night.rate() === r ? ' class="on"' : ''}>×${r}</button>`).join('')}</span><button type="button" class="nt-dbtn${Night.detail() ? ' on' : ''}" data-nt-detail title="디테일 모드 (테스트용)">🔬 디테일</button><button type="button" class="nt-skip" data-nt-skip>⏩ 건너뛰기</button><button type="button" class="nt-end" data-nt-end>종료</button></div></div>`])   // 즐기기·잠자리 제안은 바로 그날 밤
    .concat(inside ? [() => `<div class="sc-card sc-ut">${Night.uterus(!!sc.preg, Night.detail() ? { pregP: sc.pregP, contra: CONTRA_LABEL[sc.contra] } : null)}</div>`] : []);
  sceneQueue = nightQ.concat(morningQ, pregQ);
  nextScene();
}
function nextScene() {
  clearTimeout(sceneTimer); if (window.Night) Night.stop();
  if (sceneQueue.length) {
    const next = sceneQueue.shift(), html = typeof next === 'function' ? next() : next;
    sceneCard(html);
    const night = sceneBox.querySelector('.nt-stage');
    if (night) Night.run(night, nightJob, () => { sceneTimer = setTimeout(nextScene, 500); });
    else if (sceneBox.querySelector('.sc-fp')) sceneTimer = setTimeout(nextScene, 3100);
    else if (sceneBox.querySelector('.sc-ut')) sceneTimer = setTimeout(nextScene, 4300);
    return;
  }
  sceneEl.hidden = true; sceneBox.innerHTML = '';
  if (window.Night) Night.forcePose(null);   // 테스트 창의 체위 고정은 한 번만
  G.clearScene();
}
function maybeScene(S) {
  const sc = S.scene, key = sc && `${S.id}:${sc.n}`;
  if (!sc || sceneSeen === key) return;
  sceneSeen = key;
  playScene(sc);
}
sceneEl.addEventListener('click', e => {
  if (e.target.closest('[data-sc-next]')) { nextScene(); return; }
  // 그날 밤은 종료 버튼을 누를 때까지 계속 (누르면 마무리, 마무리 중에 또 누르면 바로 넘김)
  if (e.target.closest('[data-nt-skip]')) { if (window.Night) Night.skip(); return; }   // 다음 일(절정·체위 바꾸기·마무리) 직전까지 빨리 감기
  const db = e.target.closest('[data-nt-detail]');   // 🔬 디테일 모드 (테스트용) 켜고 끔 — 지금 장면에 바로 적용
  if (db) { db.classList.toggle('on', Night.setDetail(!Night.detail())); return; }
  const rb = e.target.closest('[data-nt-rate]');   // 배속 ×1 / ×2 / ×4 / ×8
  if (rb) { const r = Night.setRate(+rb.dataset.ntRate); rb.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.ntRate === r)); return; }
  const end = e.target.closest('[data-nt-end]');
  if (end) { if (window.Night && Night.finish()) end.textContent = '넘기기'; else nextScene(); return; }
  if (sceneBox.querySelector('.sc-fp, .sc-ut')) nextScene();
});

/* ---------- 모달 ---------- */
function showModal(mode, title, html, closable = true, arg = null) {
  if (modal.hidden) lastFocus = document.activeElement;
  const same = modalMode === mode && modalArg === arg;
  const scroll = same ? mBody.scrollTop : 0;
  modalMode = mode; modalArg = arg;
  $('#mTitle').textContent = title;
  mBody.innerHTML = html;
  mBody.scrollTop = scroll;
  $('#mClose').hidden = !closable;
  modal.querySelector('.modal').classList.toggle('wide', mode === 'quick');   // 20세 시작: 오른쪽에 전신 미리보기
  const phoneUI = inPhone && PHONE_MODES.has(mode);   // 📱 폰에서 연 창: 폰 모양 + 상태 표시줄 + ‹ 뒤로
  modal.querySelector('.modal').classList.toggle('phone-ui', phoneUI);
  $('#phStatus').innerHTML = phoneUI ? phoneStatus() : '';
  $('#mBack').hidden = !phoneUI || mode === 'phone';
  modal.hidden = false;
  if (!same) {
    const first = mBody.querySelector('button:not(:disabled)') || (closable ? $('#mClose') : null);
    if (first) first.focus({ preventScroll: true });
  }
}
function closeModal() {
  const wasAct = modalMode === 'act';
  modal.hidden = true;
  inPhone = false;
  actRun = null;
  if (modalMode === 'create' || modalMode === 'quick') G.syncRegion();   // 새 인생 화면에서 미리 본 나라 → 지금 인생의 나라로
  modalMode = null; modalArg = null;
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  if (wasAct) render(G.state());   // 행동 창 동안 미뤄 둔 이벤트를 이제 띄움
}

const DLG_TITLE = { talk: '💬 대화', flirt: '😉 플러팅', dirty: '😏 섹드립', touch: '🤝 스킨십', hang: '🎈 같이 놀기', gift: '🎁 선물', listen: '👂 고민 들어주기', family: '🏠 함께 시간 보내기',
  date: '💕 데이트', drink: '🍻 같이 한잔', argue: '💢 다투기', confess: '💌 고백', apologize: '🙇 사과', propose: '💍 청혼', bed: '🛏 잠자리 제안' };
const DLG_HINT = {
  talk: '말투가 상대 성격과 맞으면 훨씬 가까워지고, 안 맞으면 오히려 멀어진다.',
  flirt: '과감할수록 크게 설레게 하지만 실패하면 크게 잃는다. 말투가 성격과 맞으면 잘 통한다.',
  dirty: '과감할수록 크게 달아오르지만 선을 넘으면 신뢰를 잃는다. ✋ 물러서기는 늘 안전하다.',
  touch: '과감할수록 크게 달아오르지만 선을 넘으면 신뢰를 잃는다. 섹스 기술이 높을수록 손길이 잘 먹힌다.',
  bed: '과감할수록 크게 얻고 크게 잃는다. 외모·매력이 높으면 더 잘 통한다.',
  confess: '고백하는 방식이 상대 성격과 맞으면 받아줄 가능성이 커진다. 스탯이 받쳐 주면 특별한 방법이 생긴다.',
  argue: '어떻게 다투느냐에 따라 상처가 커지거나 작아진다.',
  _: '말투가 상대 성격과 맞으면 훨씬 좋아지고, 안 맞으면 효과가 줄어든다. 스탯이 높으면 특별한 선택지가 생긴다.',
};
let dlgBack = null;
// 플러팅·섹드립 선택지 끝의 ' · 살짝' / ' · 과감하게'를 작은 표시로
const riskTag = c => { const m = /^(.*) · (살짝|과감하게)$/.exec(c); return m ? `${esc(m[1])} <small class="risk${m[2] === '과감하게' ? ' hi' : ''}">${m[2]}</small>` : esc(c); };   // 사람 창에서 대화 이벤트를 열었으면, 고른 뒤 그 사람 창으로 돌아감
function openEvent() {
  const ev = G.currentEvent();
  if (!ev) { if (modalMode === 'event') closeModal(); return; }   // 사라진 이벤트 창이 남지 않게
  const S = G.state(), se = G.season();
  const who = ev.who && window.Avatar ? `<div class="ev-who">${Avatar.render(ev.who.look, 60, { age: ev.who.age, fig: ev.who.fig, libido: ev.who.libido || 0, ctx: ev.who.ctx })}<span><b>${esc(ev.who.name)}</b><br><span class="dim">${ev.who.age}살, ${esc(ev.who.rel)}</span></span></div>` : '';
  const dk = ev.dlg && DLG_TITLE[ev.dlg];   // 대화 이벤트: 제목 + 아래 도움말
  showModal('event', dk ? `${dk} · ${S.age}살 ${se.icon} ${wxIcon(S.weather)}` : `${S.age}살 ${se.icon} ${se.id} ${wxIcon(S.weather)}`,
    `${who}<p>${esc(ev.text)}</p><div class="choices${dk ? ' dlg' : ''}">${ev.choices.map((c, i) => `<button type="button" data-c="${i}">[${i + 1}] ${dk ? riskTag(c) : esc(c)}</button>`).join('')}</div>${dk ? `<p class="dlg-hint">${DLG_HINT[ev.dlg] || DLG_HINT._}</p>` : ''}`, false, ev.text);
}

/* 성적표 (중간·기말·모의고사·수능) / 합격 — SCHOOL.md */
const logo = (id, size) => window.Avatar && Avatar.univLogo ? Avatar.univLogo(G.universities.find(u => u.id === id), size) : '';
function openReport() {
  const r = G.state().report;
  if (!r) return;
  if (r.admit) {
    const u = G.universities.find(x => x.id === r.admit.u), d = G.departments.find(x => x.id === r.admit.d);
    showModal('report', '🎉 합격', `<div class="admit">${logo(u.id, 96)}<p class="admit-t">${esc(u.name)}<br><b>${esc(d.icon)} ${esc(d.name)}</b> 합격!</p>
      <p class="dim">"${esc(u.motto || '')}"</p></div><div class="choices"><button type="button" data-rok>확인</button></div>`, false, 'admit');
    return;
  }
  const extra = r.csat ? '<th>🎲</th>' : r.mock ? '<th>백분위</th>' : '';
  const kr = G.region() === 'kr', gk = r.csat || r.mock ? 'sat' : 'gpa';   // 뉴욕: 과목은 학점(A+~F), 평균은 GPA·SAT 점수
  const rows = r.rows.map(x => `<tr><td>${esc(x.label)}</td><td>${x.score}</td><td><b class="gr gr${x.grade}">${kr ? x.grade + '등급' : G.gradeLetter(x.grade)}</b></td>${r.csat ? `<td class="dim">${x.roll > 0 ? '+' : ''}${x.roll}</td>` : r.mock ? `<td class="dim">${x.pct}</td>` : ''}</tr>`).join('');
  showModal('report', r.csat ? '📜 수능 성적표' : '📋 성적표', `<p class="rc-t">${esc(r.school ? r.school + ' ' : '')}${esc(r.title)}</p>
    <table class="rc"><thead><tr><th>과목</th><th>점수</th><th>${kr ? '등급' : '학점'}</th>${extra}</tr></thead><tbody>${rows}</tbody></table>
    <p class="rc-avg">${kr || gk !== 'sat' ? '평균' : '환산 점수'} <b>${G.gradeTxt(r.avg, gk)}</b></p>${r.note ? `<p class="dim rc-note">${esc(r.note)}</p>` : ''}
    <div class="choices"><button type="button" data-rok>확인</button></div>`, false, r.title);
}
/* 원서 접수: 수시(6장, 내신 — 교과/종합) / 정시(가·나·다, 수능) */
let applyDraft = null;
function openApply() {
  const S = G.state(), ap = S.apply;
  if (!ap) return;
  const susi = ap.kind === 'susi';
  if (!applyDraft || applyDraft.kind !== ap.kind) applyDraft = { kind: ap.kind, rows: susi ? [{ u: '', d: '', type: '교과' }] : [{ u: '', d: '' }, { u: '', d: '' }, { u: '', d: '' }] };
  const unis = G.universities, uOpt = sel => `<option value="">대학 선택</option>` + unis.map(u => `<option value="${u.id}"${u.id === sel ? ' selected' : ''}>${esc(u.name)} (${G.tierLabel(u.tier)})</option>`).join('');
  const dOpt = (uid, sel) => { const u = unis.find(x => x.id === uid); return `<option value="">학과 선택</option>` + (u ? u.departments.map(id => { const d = G.departments.find(x => x.id === id); return `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(d.icon + ' ' + d.name)}</option>`; }).join('') : ''); };
  const gun = ['가', '나', '다'];
  const rows = applyDraft.rows.map((r, i) => {
    const kind = susi ? r.type : gun[i], p = r.u && r.d ? G.admitP(r.u, r.d, kind) : null;
    return `<div class="ap-row" data-row="${i}"><span class="ap-k">${susi ? `${i + 1}` : `${gun[i]}군`}</span>${r.u ? logo(r.u, 28) : '<span class="ap-nologo"></span>'}
      <select data-f="u">${uOpt(r.u)}</select><select data-f="d"${r.u ? '' : ' disabled'}>${dOpt(r.u, r.d)}</select>
      ${susi ? `<select data-f="type"><option${r.type === '교과' ? ' selected' : ''}>교과</option><option${r.type === '종합' ? ' selected' : ''}>종합</option></select>` : ''}
      <span class="ap-p${p == null ? '' : p >= .7 ? ' ok' : p >= .35 ? ' mid' : ' low'}">${p == null ? '' : `예상 합격률 ${Math.round(p * 100)}%`}</span></div>`;
  }).join('');
  const n = G.naesinAvg(), sat = S.school.sat, kr = G.region() === 'kr';
  showModal('apply', susi ? '📝 수시 원서 접수' : '📝 정시 원서 접수', `
    <p class="dim">${sat ? `${kr ? '내 수능 평균' : '내 SAT'}: <b>${G.gradeTxt(sat.avg, 'sat')}</b><br>` : ''}${kr ? '내 내신 평균' : '내 GPA'}: <b>${n == null ? '없음' : kr ? G.gradeTxt(n) : G.gradeTxt(n).replace('GPA ', '')}</b>${susi ? ` · 비교과 ${Math.round(S.school.extra || 0)}점` : ''}</p>
    <div class="ap">${rows}</div>
    ${susi && applyDraft.rows.length < 6 ? '<button type="button" class="ap-add" data-apadd>＋ 한 장 더</button>' : ''}
    <p class="hint">${kr ? (susi ? '교과는 내신만, 종합은 내신 + 비교과(동아리·봉사·독서) + 자소서. 6장까지. 의학과는 기준이 1등급 더 높다.' : '가·나·다군에 한 장씩. 수능 평균 등급으로 본다. 의학과는 기준이 1등급 더 높다.')
      : susi ? '교과는 GPA만, 종합은 GPA + 비교과(동아리·봉사·독서) + 에세이. 6장까지. 의예과는 기준이 더 높다.' : '1·2·3지망에 한 장씩. SAT 점수로 본다. 의예과는 기준이 더 높다.'}</p>
    <div class="choices"><button type="button" data-apgo>접수하기</button>${susi ? '<button type="button" data-apskip>수시는 안 넣는다</button>' : ''}</div>`, false, 'apply');
}
mBody.addEventListener('change', e => {
  if (e.target.matches('[data-rsort]')) { rtF.sort = e.target.value; openRealty('list'); return; }   // 🏠 방구하기 정렬
  if (modalMode !== 'apply' || !applyDraft) return;
  const el = e.target.closest('select'), row = el && el.closest('[data-row]');
  if (!row) return;
  const r = applyDraft.rows[+row.dataset.row], f = el.dataset.f;
  r[f] = el.value;
  if (f === 'u') r.d = '';
  openApply();
});

/* 관계 목록 */
function order(p) {
  if (p.id === 'mom') return 0; if (p.id === 'dad') return 1;
  if (p.spouse) return 2; if (p.partner) return 3; if (p.secret) return 4;
  if (p.kind === 'child') return 5;
  return 10;
}
let showAcq = false, peopleFilter = 'all', peopleView = 'list';
const kin = p => p.kind === 'family' || p.kind === 'child';
const mine = p => p.partner || p.spouse || p.secret || p.fwb || p.fling;
// 상태: 유부녀·유부남(결혼한 걸 알 때) / 애인 있음 (내 연인이 아닌데)
const statusTag = p => kin(p) || p.spouse ? '' : p.married && p.marriedKnown ? (p.gender === 'f' ? '유부녀' : '유부남') : p.taken && !p.married && !(p.partner || p.secret) ? '애인 있음' : '';
const PFILTER = [['all', '전체', () => true], ['phone', '📱 번호', p => G.hasNumber(p)], ['love', '연인·섹파', mine], ['friend', '친구·지인', p => !kin(p) && !mine(p)], ['family', '가족', kin],
  ['married', '유부녀·유부남', p => p.married && p.marriedKnown], ['taken', '애인 있음', p => p.taken && !p.married && !kin(p)]];
function openPeople() {
  const S = G.state();
  const all = G.people().slice().sort((a, b) => order(a) - order(b) || b.close - a.close);
  const fl = (PFILTER.find(f => f[0] === peopleFilter) || PFILTER[0])[2];
  const known = all.filter(p => !G.acquaintance(p)), list = known.filter(fl), acq = all.filter(p => G.acquaintance(p));
  const chips = `<div class="chips pfilter">${PFILTER.map(([id, label, fn]) => { const n = known.filter(fn).length; return `<button type="button" data-pf="${id}" aria-pressed="${peopleFilter === id}"${n || id === 'all' ? '' : ' disabled'}>${label} <small>${n}</small></button>`; }).join('')}</div>`;
  const row = p => {
    const extra = [];
    if (G.heartOk(p) || p.heart > 0) extra.push(`설렘 <b>${mini(p.heart)}</b>`);
    if (p.grudge >= 15) extra.push(`원한 <b class="r">${mini(p.grudge)}</b>`);
    const mk = G.marker(p), st = statusTag(p);
    return `<button type="button" class="prow${G.faded(p) ? ' faded' : ''}" data-pv="${p.id}">${av(p, 32)}
      <span><b>${esc(G.pname(p))}</b>${mk ? ` <span class="mk">${mk}</span>` : ''}${G.hasNumber(p) ? '' : ' <span class="dim" title="번호 없음">📵</span>'} <span class="dim">${G.npcAge(p)}살 ${genderKo(p.gender)}${G.faded(p) ? ' · 소원해짐' : ''}</span>${st ? ` <span class="tag${st === '애인 있음' ? '' : ' warn'}">${st}</span>` : ''}</span>
      <span class="pl">${esc(G.relLabel(p))}</span>
      <span class="pm">친밀 <b>${mini(p.close)}</b>  ${extra.join('  ')}</span>
    </button>`;
  };
  const acqBox = acq.length ? `<button type="button" class="acq-t" data-acq aria-expanded="${showAcq}">${showAcq ? '▾' : '▸'} 얼굴만 아는 사람 ${acq.length}명 <span class="dim">같은 반·과·팀·이웃·단골 — 말을 걸면 관계가 된다</span></button>${showAcq ? `<div class="plist">${acq.map(row).join('')}</div>` : ''}` : '';
  const tabs = `<div class="pview" role="tablist"><button type="button" role="tab" data-pview="list" aria-selected="${peopleView === 'list'}">📋 목록</button><button type="button" role="tab" data-pview="web" aria-selected="${peopleView === 'web'}">🕸️ 관계망</button></div>`;
  const body = peopleView === 'web' ? webHTML(list)
    : `<div class="plist">${list.map(row).join('') || '<p class="hint">여기에 해당하는 사람이 없다.</p>'}</div>${peopleFilter === 'all' ? acqBox : ''}`;
  showModal('people', inPhone ? (peopleView === 'web' ? '🕸️ 관계망' : '📇 연락처') : `👥 관계 ${known.length}명`,
    `${tabs}${chips}${body}<p class="hint">사람을 누르면 할 수 있는 게 나와. 관계는 가만두면 조금씩 멀어져. (남은 행동력 ⚡${S.ap})</p>`);
}
/* 인간 관계망 — 나를 가운데 두고 실로 잇기 (가까운 사이일수록 안쪽 고리)
   실 색: 관계 종류 / 굵기: 친밀 / 화살표: 마음의 방향 (상대 설렘 40+ → 나에게, 내 성욕 50+ → 상대에게, 둘 다면 양쪽, 원한 50+ → 빨간 화살표)
   함께 밤을 보낸 사이: 실 가운데 ⚤ + ♥ / 사람끼리의 실: 부부·커플(💍)·부모와 아이·같은 무리 */
const WEB_COLOR = { spouse: '#f4c542', partner: '#ff5d8f', secret: '#b06cff', fwb: '#ff7ad9', family: '#5ccf7a', friend: '#5aa9ff', coworker: '#9fb3c8', classmate: '#4fd1c5', neighbor: '#d0a070', ex: '#9a9a9a', grudge: '#e24a3b', other: '#7f8794' };
const WEB_LABEL = { spouse: '배우자', partner: '연인', secret: '몰래 만남', fwb: '섹파·썸', family: '가족', friend: '친구', coworker: '직장', classmate: '학교', neighbor: '이웃', ex: '전 연인', grudge: '원한', other: '아는 사이' };
function webType(p) {
  if (p.spouse) return 'spouse';
  if (p.partner || p.teenLove) return 'partner';
  if (p.secret) return 'secret';
  if (p.fwb || p.fling) return 'fwb';
  if (p.kind === 'family' || p.kind === 'child') return 'family';
  if (p.grudge >= 50) return 'grudge';
  if (p.ex) return 'ex';
  if (p.close >= 45) return 'friend';
  return { coworker: 'coworker', classmate: 'classmate', neighbor: 'neighbor' }[p.kind] || 'other';
}
const SEX_ICON = `<svg viewBox="0 0 26 22" aria-hidden="true"><circle cx="9" cy="9" r="5.2" fill="none" stroke="#ff6fa8" stroke-width="2.2"/><path d="M9 14.2V21M5.8 18h6.4" stroke="#ff6fa8" stroke-width="2.2" stroke-linecap="round"/><circle cx="15.5" cy="11" r="5.2" fill="none" stroke="#5aa9ff" stroke-width="2.2"/><path d="M19.2 7.3L24 2.5M19.6 2.5H24V6.9" fill="none" stroke="#5aa9ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function webHTML(list) {
  const S = G.state(), lust = S.lust || {};
  if (!list.length) return '<p class="hint">여기에 해당하는 사람이 없다.</p>';
  const ringOf = p => { const t = webType(p); return ['spouse', 'partner', 'secret', 'fwb', 'family'].includes(t) ? 0 : (t === 'friend' || t === 'grudge' || p.heart >= 40 || p.nights) ? 1 : 2; };
  const TORD = Object.keys(WEB_COLOR);
  const rings = [[], [], []];
  for (const p of list) rings[ringOf(p)].push(p);
  const CAP = [12, 18, 26], R = [25, 37, 46.5];
  const hidden = rings.reduce((t, r, i) => t + Math.max(0, r.length - CAP[i]), 0);
  const pos = new Map();
  rings.forEach((r, i) => {
    // 같은 종류끼리, 짝(부부·커플)·같은 집은 나란히
    r.sort((a, b) => TORD.indexOf(webType(a)) - TORD.indexOf(webType(b)) || String(a.hh || a.mateId || a.id).localeCompare(String(b.hh || b.mateId || b.id)) || b.close - a.close);
    const shown = r.slice(0, CAP[i]), off = i * .55 - Math.PI / 2;
    shown.forEach((p, k) => { const ang = off + k / shown.length * Math.PI * 2; pos.set(p.id, [50 + R[i] * Math.cos(ang), 50 + R[i] * Math.sin(ang)]); });
  });
  const shrink = (x1, y1, x2, y2, a, b) => { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1; return [x1 + dx / L * a, y1 + dy / L * a, x2 - dx / L * b, y2 - dy / L * b, L]; };
  const marks = new Set(), lines = [], icons = [];
  let side = 1;
  for (const p of list) {
    const q = pos.get(p.id);
    if (!q) continue;
    const t = webType(p), c = WEB_COLOR[t], w = (1 + p.close / 28).toFixed(1);
    const [x1, y1, x2, y2] = shrink(50, 50, q[0], q[1], 6.5, 5.2);
    side = -side;
    const mx = (x1 + x2) / 2 + (y2 - y1) * .08 * side, my = (y1 + y2) / 2 - (x2 - x1) * .08 * side;   // 살짝 휜 실
    const toMe = p.heart >= 40 || p.grudge >= 50 || ['spouse', 'partner'].includes(t), toThem = (lust[p.id] || 0) >= 50 || ['spouse', 'partner'].includes(t);
    const ac = p.grudge >= 50 ? WEB_COLOR.grudge : c;
    if (toMe) marks.add(ac); if (toThem) marks.add(ac);
    const id = ac.slice(1);
    lines.push(`<path d="M${x1.toFixed(2)},${y1.toFixed(2)} Q${mx.toFixed(2)},${my.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}" stroke="${c}" stroke-width="${w}" fill="none" vector-effect="non-scaling-stroke"${['secret', 'ex'].includes(t) ? ' stroke-dasharray="5 4"' : ''}${toMe ? ` marker-start="url(#wa${id})"` : ''}${toThem ? ` marker-end="url(#wa${id})"` : ''} opacity=".85"/>`);
    const bz = (a, m, b, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * m + t * t * b;   // 실 위의 한 점 (t: 나 → 상대)
    if (p.nights) icons.push(`<span class="wb-ic" style="left:${bz(x1, mx, x2, .58).toFixed(1)}%;top:${bz(y1, my, y2, .58).toFixed(1)}%" title="함께 밤을 보낸 사이 (${p.nights}번)">${SEX_ICON}<b>♥</b></span>`);
  }
  // 사람끼리: 부부·커플(짝), 부모와 아이(같은 집), 같은 무리
  const done = new Set();
  for (const p of list) {
    const a = pos.get(p.id);
    if (!a) continue;
    const links = [];
    if (p.mateId) links.push([p.mateId, p.married ? WEB_COLOR.spouse : WEB_COLOR.partner, p.married ? '💍' : '♡']);
    for (const pid of p.parents || []) links.push([pid, WEB_COLOR.family, '']);
    for (const gid of p.group || []) links.push([gid, '#8a93a6', '']);
    for (const [oid, c, ic] of links) {
      const b = pos.get(oid), key = [p.id, oid].sort().join('-');
      if (!b || done.has(key)) continue;
      done.add(key);
      const [x1, y1, x2, y2] = shrink(a[0], a[1], b[0], b[1], 4.6, 4.6);
      lines.push(`<path d="M${x1.toFixed(2)},${y1.toFixed(2)} L${x2.toFixed(2)},${y2.toFixed(2)}" stroke="${c}" stroke-width="1.6" fill="none" vector-effect="non-scaling-stroke" stroke-dasharray="2 3" opacity=".9"/>`);
      if (ic) icons.push(`<span class="wb-ic sm" style="left:${((x1 + x2) / 2).toFixed(1)}%;top:${((y1 + y2) / 2).toFixed(1)}%">${ic}</span>`);
    }
  }
  const defs = [...marks].map(c => `<marker id="wa${c.slice(1)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.2" markerHeight="3.2" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('');
  const nodes = list.filter(p => pos.has(p.id)).map(p => { const [x, y] = pos.get(p.id), t = webType(p), mk = G.marker(p);
    return `<button type="button" class="wb-n" data-pv="${p.id}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--c:${WEB_COLOR[t]}" title="${esc(G.pname(p))} · ${esc(G.relLabel(p))}">${av(p, 30)}<span>${esc(G.pname(p))}${mk ? ` <i>${mk}</i>` : ''}</span></button>`; }).join('');
  const used = [...new Set(list.filter(p => pos.has(p.id)).map(webType))];
  const legend = `<div class="wb-leg">${used.map(t => `<span><b style="background:${WEB_COLOR[t]}"></b>${WEB_LABEL[t]}</span>`).join('')}<span>➝ 마음의 방향</span><span class="wb-legsex">${SEX_ICON}♥ 함께 밤</span><span>💍 부부 · ♡ 커플 (그 사람들끼리)</span></div>`;
  return `<div class="web"><svg class="wb-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>${defs}</defs>
      ${R.map(r => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" vector-effect="non-scaling-stroke"/>`).join('')}${lines.join('')}</svg>
    ${icons.join('')}${nodes}<div class="wb-me">${window.Avatar && S.look ? Avatar.render(G.myLook(), 40) : '🙂'}<span>나</span></div></div>
    ${legend}${hidden ? `<p class="hint">더 먼 사이 ${hidden}명은 목록에서 볼 수 있다.</p>` : ''}`;
}

/* 사람 한 명 */
function openPerson(id) {
  const p = G.person(id);
  if (!p) { openPeople(); return; }
  const S = G.state();
  const stats = PST.map(k => {
    if (k === 'heart' && !G.heartOk(p) && !p.heart) return `<span>${G.LABEL[k]}</span><span class="dim">—</span><span class="num"></span>`;
    return `<span>${G.LABEL[k]}</span><span class="bar${k === 'grudge' ? ' low' : ''}">${bar(p[k])}</span><span class="num">${p[k]}</span>`;
  }).join('');
  const im = G.intimacy(p), ml = G.myLust(p);
  // 성욕은 서로 따로: 이 사람을 향한 내 성욕(늘 보임) / 나를 향한 이 사람의 성욕(함께 밤을 보냈거나 사귀면 보임)
  const myL = ml != null && ml > 0 ? `<span>내 성욕</span><span class="bar${ml >= 60 ? ' low' : ''}">${bar(ml)}</span><span class="num">${ml}</span>` : '';
  const imHTML = im || myL ? `<div class="stats">${myL}
      ${im ? `<span>나를 향한 성욕</span><span class="bar${im.libido >= 60 ? ' low' : ''}">${bar(im.libido)}</span><span class="num">${im.libido}</span>` : ''}
      ${im && im.nights ? `<span>궁합</span><span class="bar">${bar(im.compat || 0)}</span><span class="num">${im.compat || 0}</span>
      <span>만족감</span><span class="bar">${bar(im.sat || 0)}</span><span class="num">${im.sat ?? '—'}</span>` : ''}</div>` : '';
  const tags = [];
  const mine = p.partner || p.spouse || p.secret;
  if (p.married && p.marriedKnown) tags.push(`<span class="tag warn">${p.gender === 'f' ? '유부녀' : '유부남'} · 들키면 ${p.gender === 'f' ? '남편' : '아내'}이 찾아옴</span>`);
  else if (p.married && p.close >= 20 && G.ringVisible(p)) tags.push('<span class="tag">반지를 끼고 있다</span>');
  else if (p.taken && !mine && p.kind !== 'family' && p.kind !== 'child') tags.push(`<span class="tag">애인 있음 · 들키면 ${p.gender === 'f' ? '남자친구' : '여자친구'}가 찾아옴</span>`);
  if (G.companion() === p) tags.push('<span class="tag">🤝 동행 중</span>');
  if (p.fwb) tags.push('<span class="tag">섹파</span>');
  if (p.secret) tags.push('<span class="tag warn">들키면 안 됨</span>');
  if (p.debt) tags.push(`<span class="tag warn">빌린 돈 ${G.fmtMoney(p.debt)}</span>`);
  if (p.ex) tags.push('<span class="tag">예전에 사귐</span>');
  if (S.preg && S.preg.pid === p.id && S.preg.mode && S.gender === 'm') tags.push('<span class="tag">아이를 가짐</span>');
  if (p.livesWith) tags.push('<span class="tag">같이 삶</span>');
  if (p.taken && mine && !p.married && !p.spouse) tags.push('<span class="tag warn">애인이 따로 있음</span>');   // 헤어지지 않은 채 나를 만나는 사람
  const prof = G.profile(p).map(f => `<dt>${f.label}</dt><dd${f.value == null ? ' class="unk"' : ''}>${f.value == null ? '???' : esc(f.value)}</dd>`).join('');
  const its = G.interactions(id), anyFree = its.some(it => it.free);
  const acts = its.map(it =>
    `<button type="button" data-i="${it.id}"${it.ok ? '' : ' disabled'}>${it.icon} ${it.label}${it.cost ? ` <small>${G.fmtMoney(it.cost)}</small>` : ''}${!it.free ? ` <small>⚡${it.ap}</small>` : ''}</button>`).join('');
  showModal('person', `${G.pname(p)}`, `
    <div class="p-top">${avBtn(id, av(p, 60))}<div class="p-who"><b>${esc(G.pname(p))}${G.marker(p) ? ` <span class="mk">${G.marker(p)}</span>` : ''}</b><span class="dim">${G.npcAge(p)}살 ${genderKo(p.gender)}, ${esc(G.relLabel(p))}${G.acquaintance(p) ? ' (얼굴만 아는 사이)' : ''}</span></div></div>
    ${fullView === id ? fullAv(G.look(p), G.npcAge(p), G.figure(p), p.personality, G.ringVisible(p), G.outfitCtx(p)) : ''}
    <div class="stats">${stats}</div>
    ${imHTML}
    ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    <dl class="prof">${prof}</dl>
    ${G.profile(p).some(f => f.value == null) ? '<p class="hint">더 친해지면 더 알 수 있다.</p>' : ''}
    <div class="igrid">${acts || '<p class="hint">지금은 할 수 있는 게 없다.</p>'}</div>
    ${!G.hasNumber(p) && !G.here().some(h => h.key === id) ? '<p class="hint">📵 번호가 없어서 따로 연락할 수 없다. 같은 곳에서 마주치면 번호를 물어보자.</p>' : ''}
    <p class="hint">${anyFree ? `지금 ${esc(G.place().label)}에 같이 있어서 한 번은 행동력을 쓰지 않는다.` : '⚡ = 드는 행동력.'} (남은 행동력 ⚡${S.ap})</p>
    <button type="button" class="back" data-back>${personFrom === 'here' ? '← 닫기' : '← 목록'}</button>`, true, id);
}

/* 장소에서 처음 보는 사람 — 둘러보기 (FACE_UPGRADE 6-3): 한 명씩 넘겨보며 말을 걸지 고름 (◀ ▶·화살표 키·좌우 스와이프, 모아 보기) */
let browseIx = 0, browseGrid = false, browseHey = null;
const brCache = new Map();   // 초상화는 넘길 때 그리고 캐시 (지금 ±1명은 미리)
function brPortrait(h) {
  const k = h.key + ':' + (h.p.sk || '');
  if (!brCache.has(k)) { if (brCache.size > 30) brCache.clear(); brCache.set(k, av(h.p, 160)); }
  return brCache.get(k);
}
const strangerWho = p => { const a = G.npcAge(p); return a < 13 ? (p.gender === 'f' ? '여자아이' : '남자아이') : a < 20 ? (p.gender === 'f' ? '여학생' : '남학생') : p.gender === 'f' ? '여자' : '남자'; };
function startBrowse(key) {
  const list = G.here().filter(h => h.stranger);
  browseIx = Math.max(0, list.findIndex(h => h.key === key)); browseGrid = false; brCache.clear();
  openBrowse(browseIx);
}
function openBrowse(ix) {
  const pl = G.place(), S = G.state();
  if (!pl) { closeModal(); return; }
  const list = G.here().filter(h => h.stranger), n = list.length, left = G.browseLeft(), ti = G.timeInfo(), wx = WX[S.weather];
  const note = G.hereNote();
  const head = `<p class="br-head">${pl.icon} ${esc(pl.label)} · ${esc(ti.phase === 'adult' ? ti.slot : G.timeLabel())}${wx ? ` · ${wx.icon} ${esc(wx.label)}` : ''}${note ? `<small>${esc(note.t)}</small>` : ''}</p>`;
  const more = pl.crowd ? `<button type="button" data-brmore${left > 0 ? '' : ' disabled'}>🔄 새로 둘러보기 <small>${left > 0 ? `오늘 ${left}번 더` : '오늘은 여기까지'}</small></button>` : '';
  if (!n) {
    showModal('browse', '👀 둘러보기', `${head}<p class="empty">눈에 띄는 낯선 사람이 없다.</p><div class="choices">${more}<button type="button" class="back" data-back>← 닫기</button></div>`, true, 'x');
    return;
  }
  browseIx = ((ix % n) + n) % n;
  // 다시 그려도 누르던 버튼에 초점이 남게 (키보드로 넘길 때)
  const fa = document.activeElement, fat = fa && mBody.contains(fa) && [...fa.attributes].find(x => x.name.startsWith('data-'));
  const refocus = () => { const b = fat && mBody.querySelector(fat.name === 'data-brgo' ? '.br-dot.on, .br-cell.on' : `[${fat.name}]:not(:disabled)`); if (b) b.focus({ preventScroll: true }); };
  if (browseGrid) {
    const cells = list.map((h, i) => `<button type="button" class="br-cell${i === browseIx ? ' on' : ''}${h.used ? ' used' : ''}" data-brgo="${i}">${window.Avatar ? Avatar.render(G.look(h.p), 64, { age: G.npcAge(h.p), lod: 0, ctx: G.outfitCtx(h.p) }) : ''}<small>${esc(strangerWho(h.p))} · ${esc(ageBand(G.npcAge(h.p)))}</small></button>`).join('');
    showModal('browse', '👀 둘러보기', `${head}<div class="br-grid">${cells}</div><div class="choices"><button type="button" data-brgrid>한 명씩 보기 ◀▶</button>${more}<button type="button" class="back" data-back>← 닫기</button></div>`, true, 'grid');
    refocus();
    return;
  }
  const h = list[browseIx], p = h.p, age = G.npcAge(p);
  const inf = window.Avatar && Avatar.faceInfo ? Avatar.faceInfo(G.look(p), age) : null;
  const hey = h.approach && browseHey !== h.key;   // 먼저 말을 걸어오는 사람: 처음 볼 때 카드가 흔들리며 "저기요"
  if (hey) browseHey = h.key;
  const dots = list.map((x, i) => `<button type="button" class="br-dot${i === browseIx ? ' on' : ''}" data-brgo="${i}" aria-label="${i + 1}번째 사람">${i === browseIx ? '●' : '○'}</button>`).join('');
  showModal('browse', '👀 둘러보기', `${head}
    <div class="br-stage"><button type="button" class="br-nav" data-brprev aria-label="이전 사람">◀</button>
      <div class="br-card${hey ? ' hey' : ''}">${brPortrait(h)}${h.approach ? '<span class="br-bubble">저기요</span>' : ''}</div>
      <button type="button" class="br-nav" data-brnext aria-label="다음 사람">▶</button></div>
    <p class="br-n">${browseIx + 1} / ${n}</p>
    <div class="br-info"><b>낯선 ${esc(strangerWho(p))} · ${esc(ageBand(age))}</b> ${hereBadges(h)}
      ${inf ? `<span>${esc(inf.sentence)}</span>` : ''}<span class="dim">${esc(h.doing)}.</span>${h.ring ? '<span class="dim">왼손 약지에 결혼 반지가 있다.</span>' : ''}${h.couple ? `<span class="dim">${h.wed ? '배우자' : '연인'}와 함께 있다 — 말을 걸면 짝이 끼어들지도.</span>` : ''}
      ${h.used ? '<span class="hint">대화가 이어지지 않았다. 다음에 또 마주칠지도.</span>' : h.approach ? '<span class="hint">상대가 먼저 다가왔다. 받아주면 거의 이어진다.</span>' : ''}</div>
    <div class="choices br-acts"><button type="button" data-talk="${h.key}"${h.used ? ' disabled' : ''}>💬 ${h.approach ? '대답한다' : '말 걸기'} <small>행동력 안 씀</small></button><button type="button" data-ask="${h.key}"${h.used || age < 10 ? ' disabled' : ''}>📱 말 걸고 번호 묻기 <small>${G.timeInfo().phase === 'adult' ? '⚡2' : '행동력 안 씀'}</small></button><button type="button" data-brnext>다음 사람 ▶</button><button type="button" data-brpass="${h.key}">그냥 지나간다</button></div>
    <div class="br-foot"><span class="br-dots">${dots}</span><button type="button" data-brgrid>모아 보기 ▦</button></div>
    <div class="choices">${more}<button type="button" class="back" data-back>← 닫기</button></div>`, true, 'one');
  refocus();
  // 다음·이전 사람 초상화는 화면을 그린 뒤 미리
  setTimeout(() => { if (modalMode !== 'browse') return; const L = G.here().filter(x => x.stranger); for (const d of [1, -1]) { const q = L[(browseIx + d + L.length) % L.length]; if (q) brPortrait(q); } }, 30);
}

/* 직업 */
function reqText(j) {
  if (!j.checks.length) return '<span class="req">조건 없음</span>';
  return j.checks.map(([ok, t]) => `<span class="req${ok ? '' : ' no'}">${esc(t)}</span>`).join(', ');
}
// 💼 구인 앱 (사람인·잡코리아·알바몬 / Indeed·LinkedIn 참고): 채용공고(업종·지원 가능만) · 지원 현황 · 이력서 · 내 직장
let jbTab = 'list', jbCat = 'all', jbOk = false;
const JB_STAGE = { doc: ['📄 서류 검토 중', ''], iv: ['🗣 면접 예정', 'hot'], wait: ['⏳ 결과 대기', ''], offer: ['🎉 최종 합격', 'ok'], fail: ['불합격', 'gone'], done: ['입사', 'ok'], expired: ['답 안 함 · 기한 지남', 'gone'], declined: ['입사 거절', 'gone'] };
const jbCard = P => `<button type="button" class="jb-card" data-post="${P.id}"><span class="jb-co">${esc(P.co)} <small>★ ${P.star}</small></span><b class="jb-t">${esc(P.title)}</b>
  <span class="jb-m">${esc(P.salaryT)} · ${esc(P.type)} · ${esc(P.career)}</span><span class="dim jb-m">📍 ${esc(P.dong)} · 통근 ${P.commute}분 · ${P.dday > 0 ? `D-${P.dday}` : P.dday === 0 ? '오늘 마감' : '마감'}</span>
  <span class="rt-tags">${P.app ? `<i class="rt-tag ${(JB_STAGE[P.app] || [])[1]}">${(JB_STAGE[P.app] || [''])[0]}</i>` : ''}${P.ok ? '<i class="rt-tag ok">✓ 자격 충족</i>' : ''}${P.perks.slice(0, 3).map(x => `<i class="rt-tag">${esc(x)}</i>`).join('')}</span></button>`;
function openJobs(tab) {
  jbTab = tab || jbTab;
  const S = G.state(), J = G.jobsite, apps = J.apps(), live = apps.filter(a => ['doc', 'iv', 'wait', 'offer'].includes(a.stage)).length;
  const tabs = `<div class="rt-tabs" role="tablist">${[['list', '채용공고'], ['apps', `지원 현황${live ? ' ' + live : ''}`], ['cv', '이력서'], ...(S.job ? [['me', '내 직장']] : [])].map(([id, l]) => `<button type="button" role="tab" data-jtab="${id}" aria-selected="${jbTab === id}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (S.age < 19) body = '<p class="empty">19살부터 일자리를 구할 수 있다. 그 전엔 알바로 용돈을 벌 수 있다.</p>';
  else if (jbTab === 'me' && S.job) {
    const j = G.job(S.job);
    body = `<div class="jb-me"><p class="jb-co">${esc(S.jobCo || '')}</p><b class="jb-t">${esc(G.jobTitle())}</b><p class="dim">${j.volatile ? '수입 들쭉날쭉 · 평균 ' : '연봉 '}${G.fmtMoney(S.salary)} · 하루 근무 ⚡${j.ap || 45}</p>
      <div class="stats"><span>성과</span><span class="bar">${bar(S.perf)}</span><span class="num">${S.perf}</span></div>
      <p class="hint">출근해서 성과를 쌓으면 승진한다. 성과가 너무 낮으면 잘릴 수도 있다.${S.rank < j.ranks.length - 1 ? ` 다음 직급: ${esc(j.ranks[S.rank + 1])}.` : ''} 출근하다 보면 이 일만의 고충도 생긴다.</p>
      <div class="choices"><button type="button" data-quit${S.pending.length ? ' disabled' : ''}>사직서 내기</button></div>
      ${(S.jobs && S.jobs.career.length > 1) ? `<p class="sec-t rt-sec">지난 경력</p><ul class="rt-notes">${S.jobs.career.slice(0, -1).reverse().map(c => `<li>${esc(c.co ? c.co + ' · ' : '')}${esc(c.label)} <span class="dim">${c.from}살${c.to != null && c.to !== c.from ? `~${c.to}살` : ''}</span></li>`).join('')}</ul>` : ''}</div>`;
  } else if (jbTab === 'cv') {
    const R = J.resume();
    const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    body = `<div class="jb-cv"><div class="jb-cvh"><span class="jb-ph">👤</span><div><b>${esc(S.name)}</b><span class="dim">${S.age}살 · ${S.gender === 'm' ? '남' : '여'}</span></div></div>
      <table class="rt-table">${row('학력', esc(R.edu))}${row('경력', R.career.length ? R.career.map(esc).join('<br>') : '없음 (신입)')}${row('어학', esc(R.lang))}${row('자격증', R.certs.length ? R.certs.map(esc).join(', ') : '없음')}${row('자기소개서', `${esc(R.introT)} ${'★'.repeat(R.intro)}${'☆'.repeat(3 - R.intro)}`)}</table>
      <button type="button" class="hot jb-pol" data-jpolish${R.intro >= 3 || S.ap < J.polishPt ? ' disabled' : ''}>✍ 자기소개서 다듬기 <small>⚡${J.polishPt}</small></button>
      <p class="hint">자기소개서를 공들일수록 서류·면접에 유리하다. 같은 업종 경력이 있으면 경력직 공고에도 붙을 수 있다.</p></div>`;
  } else if (jbTab === 'apps') {
    body = apps.length ? `<div class="jb-apps">${apps.map(a => { const st = JB_STAGE[a.stage] || ['', ''];
      return `<div class="jb-app"><div><span class="jb-co">${esc(a.co)}</span><b>${esc(a.title)}</b><span class="rt-tags"><i class="rt-tag ${st[1]}">${st[0]}${a.dday != null && a.dday >= 0 ? ` · D-${a.dday}` : ''}</i></span></div>
        ${a.stage === 'offer' ? `<div class="jb-ofr"><button type="button" class="hot" data-jacc="${a.ix}">입사하기</button><button type="button" data-jdec="${a.ix}">거절</button></div>` : ''}</div>`; }).join('')}</div>` : '<p class="empty">아직 지원한 곳이 없다.</p>';
    body += `<p class="hint">서류 결과는 며칠 뒤 메일로 온다. 면접 날 아침에 면접이 열리고, 며칠 뒤 최종 결과가 온다. 합격하면 5일 안에 입사를 정한다${S.job ? ' — 입사하면 지금 직장은 그만둔다' : ''}.</p>`;
  } else {
    const cats = J.cats(), all = J.list();
    const L = all.filter(P => (jbCat === 'all' || P.cat === jbCat) && (!jbOk || P.ok));
    body = `<div class="rt-chips">${[['all', '전체'], ...Object.entries(cats)].map(([id, l]) => `<button type="button" data-jcat="${id}" aria-pressed="${jbCat === id}">${esc(l)}</button>`).join('')}</div>
      <div class="rt-bar"><span><b>${L.length}</b>개 공고 · 매주 새로</span><span class="rt-vw"><button type="button" data-jok aria-pressed="${jbOk}">✓ 자격 충족만</button></span></div>
      <div class="jb-list">${L.map(jbCard).join('') || '<p class="empty">조건에 맞는 공고가 없다.</p>'}</div>`;
  }
  showModal('jobs', `💼 ${J.app()}`, tabs + body);
}
function openPosting(id) {
  const J = G.jobsite, P = J.list().find(x => x.id === id), S = G.state();
  if (!P) { openJobs('list'); return; }
  const j = G.job(P.job), hrs = Math.round((j.ap || 45) * 11 / 60);
  const rows = [['근무 형태', P.type], ['경력', P.career], ['급여', P.salaryT + (P.volatile ? ' (실적에 따라)' : '')], ['근무지', `${P.dong} · 집에서 약 ${P.commute}분`], ['근무 시간', `하루 약 ${hrs}시간 (⚡${j.ap || 45})`], ['마감', P.dday > 0 ? `D-${P.dday}` : P.dday === 0 ? '오늘 마감' : '마감'], ['지원자', `${P.applicants}명`]];
  const chk = P.checks.length ? P.checks.map(([ok, t]) => `<li class="${ok ? 'good' : 'bad'}">${ok ? '✔' : '✖'} ${esc(t)}</li>`).join('') : '<li class="good">✔ 조건 없음</li>';
  showModal('posting', P.co, `<div class="jb-hd"><span class="jb-logo">${esc(P.co.slice(0, 1))}</span><div><span class="jb-co">${esc(P.co)} · ★ ${P.star}</span><b class="jb-t">${esc(P.title)}</b><span class="dim">${esc(P.catT)} · ${esc(j.label)}</span></div></div>
    <p class="sec-t rt-sec">모집 요강</p><table class="rt-table">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    <p class="sec-t rt-sec">자격 요건</p><ul class="rt-notes">${chk}</ul>
    <p class="sec-t rt-sec">복리후생</p><div class="rt-near">${P.perks.map(x => `<span>${esc(x)}</span>`).join('')}</div>
    <p class="sec-t rt-sec">하는 일</p><p class="dim">${esc(j.label)} — ${esc((G.jobsite.cats()[P.cat] || ''))}. 직급: ${j.ranks.map(esc).join(' → ')}</p>
    <p class="hint">서류 통과 가능성: <b class="jb-ch ${P.chance[1]}">${P.chance[0]}</b>${P.ok ? '' : ' — 자격이 모자라면 서류에서 떨어지기 쉽다'}${/경력 \d/.test(P.career) ? ' · 경력직 공고라 같은 분야 경력이 없으면 불리하다' : ''}. 지원은 온라인으로 ⚡${J.applyPt}.</p>
    <div class="rt-acts"><button type="button" class="hot" data-japply="${P.id}"${P.why ? ' disabled' : ''}>${P.why ? esc(P.why) : '지원하기'} ${P.why ? '' : `<small>⚡${J.applyPt}</small>`}</button></div>`, true, id);
}

/* 범죄 */
function openCrime() {
  const S = G.state();
  if (S.jail) { showModal('crime', '🕶 범죄', '<p>지금은 갇혀 있다. 할 수 있는 건 버티는 것뿐이다.</p>'); return; }
  const risk = c => c.caught < .25 ? '낮음' : c.caught < .4 ? '보통' : '높음';
  const rows = G.crimes().map(c => `
    <div class="row">
      <div><b>${c.icon} ${esc(c.label)}</b><div class="dim" style="font-size:12.5px">성공 ${Math.round(G.crimeOdds(c) * 100)}%, 잡힐 위험 ${risk(c)}</div></div>
      <button type="button" data-k="${c.id}"${G.canCrime(c) ? '' : ' disabled'}>저지른다</button>
    </div>`).join('');
  showModal('crime', '🕶 범죄', `
    <p class="hint">돈은 되지만, 언젠가 어떤 식으로든 돌아온다. 당장 안 잡혀도 경찰의 관심은 쌓인다.</p>
    <div class="stats"><span>경찰의 관심</span><span class="bar low">${bar(S.heat)}</span><span class="num">${S.heat}</span></div>
    ${S.record ? `<p class="dim">전과 ${S.record}회</p>` : ''}
    ${rows}
    <p class="hint">한 번에 행동력 ⚡${G.timeInfo().phase === 'adult' ? 6 : G.teenPt}. 남은 행동력 ⚡${S.ap}</p>`);
}


/* 공부: 과목 고르기 (중·고등학생) */
/* 🎲 행동 창: 아이콘맨 장면 + 주사위 (data/acts.js, js/act.js) */
let actRun = null;
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const dieHTML = n => `<div class="die" data-face="${n}" aria-label="주사위 ${n}">${Array.from({ length: 9 }, (_, i) => `<i${PIPS[n].includes(i + 1) ? ' class="on"' : ''}></i>`).join('')}</div>`;
const setDie = (el, n) => { el.dataset.face = n; el.setAttribute('aria-label', `주사위 ${n}`); el.querySelectorAll('i').forEach((p, i) => p.classList.toggle('on', PIPS[n].includes(i + 1))); };
function openAct(id, subj) {
  const S = G.state(), P = G.actPreview(id);
  if (!P) return;
  if (!P.ok) { G.doAction(id, subj); return; }
  actRun = { id, subj, rolled: false };
  const ctx = { place: S.place, hour: P.hour, weather: S.weather, region: G.region(), gender: S.gender, age: S.age, dayN: S.dayN || 0 };
  const art = window.ActArt ? ActArt.scene(id, ctx) : '';
  const sub = subj ? (G.studyInfo().find(x => x.id === subj) || {}).label : null;
  const mods = P.mods.length ? P.mods.map(([t, v]) => `<span class="act-mod ${v > 0 ? 'p' : 'm'}">${esc(t)} ${v > 0 ? '+' : ''}${v}</span>`).join('') : '<span class="dim">보정 없음</span>';
  showModal('act', `${P.icon} ${P.label}${sub ? ` · ${esc(sub)}` : ''}`, `<div class="act-stage">${art}<span class="act-tag">${esc(P.placeLabel)}${P.clock ? ` · ${P.clock}` : ''}</span></div>
    <div class="act-roll">${dieHTML(rand6())}<div class="act-mods"><small class="dim">주사위 보정</small><div>${mods}</div></div></div>
    <div class="act-res" hidden></div>
    <div class="choices"><button type="button" class="hot" data-roll>🎲 주사위 굴리기 <small>⚡${P.ap}${P.cost ? ` · ${G.fmtMoney(P.cost)}` : ''}</small></button></div>
    <p class="hint act-key">1 망함 ×0.3 · 2 아쉬움 ×0.7 · 3~4 보통 · 5 잘됨 ×1.4 · 6 대성공 ×2</p>`, true, id);
}
const rand6 = () => 1 + Math.floor(Math.random() * 6);
function rollAct() {
  if (!actRun || actRun.rolled) return;
  actRun.rolled = true;
  const run = actRun, btn = mBody.querySelector('[data-roll]'), die = mBody.querySelector('.die');
  if (btn) btn.disabled = true;
  $('#mClose').hidden = true;
  G.doAction(run.id, run.subj);
  const R = G.lastAct();
  if (!R) { closeModal(); return; }
  const fast = window.__fastDice || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fast) land();
  else {
    die.classList.add('rolling');
    let n = 0;
    const tick = setInterval(() => { setDie(die, rand6()); if (++n >= 12) { clearInterval(tick); land(); } }, 70);
  }
  function land() {
    if (actRun !== run) return;
    setDie(die, R.die); die.classList.remove('rolling'); die.classList.add('land');
    const res = mBody.querySelector('.act-res');
    res.innerHTML = `<div class="act-grade ${R.cls}"><span class="act-num">${R.die}${R.mod ? ` <small>${R.mod > 0 ? '+' : ''}${R.mod} → ${R.fin}</small>` : ''}</span><b>${esc(R.label)}</b>${R.mult !== 1 ? `<small>오르는 값 ×${R.mult}</small>` : ''}</div>
      <p class="act-text">${esc(R.text || '')}</p><p class="act-d">${deltaHTML(R.deltas)}</p>`;
    res.hidden = false;
    const ch = mBody.querySelector('.choices');
    ch.innerHTML = `<button type="button" class="hot" data-actok>확인${G.state().pending.length ? ' — 그런데…' : ''}</button>`;
    mBody.querySelector('.act-key').remove();
    $('#mClose').hidden = false;
    ch.querySelector('button').focus({ preventScroll: true });
  }
}

// 지도 조작 (#where·지도 창 공통): 교통수단·차·크게/한눈에·내 위치
function mapCtl(d) {
  if (d.ride) { G.ride.set(d.ride); return true; }   // 상태가 바뀌면 render가 지도(화면·창)를 제자리에서 다시 그림
  if ('buycar' in d) { G.ride.buyCar(); return true; }
  if ('sellcar' in d) { if (confirm('차를 팔까? 산 값의 60%를 받는다.')) G.ride.sellCar(); return true; }
  if ('mapzoom' in d) { mapZoom = mapZoom === 'big' ? 'fit' : 'big'; try { localStorage.setItem('llife-mapzoom', mapZoom); } catch (e) {} mapCenterKey = null; if (modalMode === 'map') openMap(); else render(G.state()); requestAnimationFrame(() => centerMap(true)); return true; }
  if ('mapcenter' in d) { centerMap(true); return true; }
  return false;
}

function openStudy() {
  const S = G.state();
  const rows = G.studyInfo().map(x => `<button type="button" data-s="${x.id}">${x.label} <small>${x.exp}점${x.prep ? ` (+${x.prep})` : ''}</small></button>`).join('');
  showModal('study', '📚 무슨 공부?', `<div class="igrid">${rows}<button type="button" data-s="all">골고루</button></div>
    <p class="hint">다음 시험까지 쌓이는 공부: 한 과목에 집중하면 +8~10, 골고루 하면 과목마다 +3~5. 숫자는 지금 예상 점수(괄호는 이번 시험을 위해 쌓은 공부).</p>`);
}

// 쇼핑 (HAIR_CLOTHES_BODY 3-7): 오늘 파는 옷 3벌 — 내가 입은 모습 미리보기, 사면 옷장에 들어가 다음 외출부터 입음
function openShop() {
  const S = G.state(), look = G.myLook(), ctx = Object.assign(G.outfitCtx(null), { working: false, home: false }), fig = G.figure(null);
  const base = window.Outfit && look ? Outfit.pick(look, S.age, ctx) : null;
  const rows = G.shopToday().map((it, i) => {
    const of = base ? JSON.parse(JSON.stringify(base)) : null;
    if (of) { if (it.slot === 'dress') { delete of.inner; delete of.bottom; of.dress = { k: it.k, c: it.c }; } else { if (it.slot === 'inner') delete of.dress; of[it.slot] = { k: it.k, c: it.c, cut: it.cut }; if (it.slot === 'inner' && !of.bottom) of.bottom = { k: 'jeans', c: '#4a5f86', cut: 'straight' }; } }
    const pv = of && window.Avatar ? Avatar.render(look, 54, { age: S.age, full: S.age >= 20 && fig ? fig : true, outfit: of, pose: 'default' }) : '';
    return `<button type="button" class="shop-it" data-shop="${i}"${S.money < it.price ? ' disabled' : ''}>${pv}<span><b>${esc(it.label)}</b><br><small>${G.fmtMoney(it.price)} · ${G.gradeInfo(it.q).letter}급</small></span></button>`;
  }).join('');
  showModal('shop', '🛍 뭘 살까?', `<div class="shop-grid">${rows}</div><div class="choices"><button type="button" data-shopskip>구경만 하기</button></div>
    <p class="hint">산 옷은 옷장에 들어가 다음에 나갈 때 입는다. 꾸밈은 옷장에 있는 좋은 옷들의 평균 쪽으로 오른다 (옷은 해마다 낡음).</p>`);
}
// 데이트: 뭐 입고 갈까? — 내 옷장에서 지금 계절의 3벌. 상대 취향(성격)에 맞으면 설렘 보너스
function openDateDress(pid) {
  const S = G.state(), look = G.myLook(), ctx = G.outfitCtx(null), fig = G.figure(null), list = G.dateOutfits();
  const rows = list.map(x => `<button type="button" class="shop-it" data-dd="${x.ix}">${window.Avatar ? Avatar.render(look, 54, { age: S.age, full: S.age >= 20 && fig ? fig : true, ctx: Object.assign({}, ctx, { outfitIx: x.ix, working: false }), pose: 'default' }) : ''}<span><b>${esc(x.label)}</b><br><small>꾸밈 ${x.score}</small></span></button>`).join('');
  showModal('dateDress', '👗 뭐 입고 갈까?', `<div class="shop-grid">${rows}</div><p class="hint">상대 취향에 맞는 옷이면 설렘이 더 오른다 (다정형은 부드럽고 단정한 옷, 직진형은 과감한 옷, 냉철형은 단정한 정장 쪽…).</p>`, true, pid);
}

/* 나 */
function openMe() {
  const S = G.state();
  const prof = G.myProfile().map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const ab = G.abilities.map(k => { const g = G.gradeInfo(S.stats[k]);
    return `<span>${G.LABEL[k]}</span><span class="bar">${bar(g.pct * 100)}</span><span class="num"><b class="g-${g.letter}">${g.letter}</b> ${S.stats[k]}</span>`; }).join('');
  const cond = G.conds.filter(k => k !== 'libido' || S.age >= G.config.sexMinAge).map(k => `<span>${CD_ICON[k]} ${G.LABEL[k]}</span><span class="bar">${bar(S.stats[k])}</span><span class="num">${S.stats[k]}</span>`).join('');
  const sx = S.age >= G.config.sexMinAge ? (g => `<span>섹스 기술</span><span class="bar">${bar(g.pct * 100)}</span><span class="num"><b class="g-${g.letter}">${g.letter}</b> ${g.value}</span>`)(G.sexInfo()) : '';
  const rec = G.myRecords().map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  let school = '';
  const sc = S.school;
  if (S.age >= 13) {
    const inSch = !sc.sat && !sc.univ && S.age <= 19;
    const subj = inSch ? G.studyInfo().map(x => `<span>${x.label}</span><span class="bar">${bar(x.exp)}</span><span class="num">${x.exp}</span>`).join('') : '';
    const lines = [];
    const tr = sc.track && G.tracks.find(t => t.id === sc.track);
    if (tr) lines.push(`계열 ${tr.label} — ${G.subjectsNow().map(x => x.label).join('·')}`);
    const kr = G.region() === 'kr';   // 뉴욕: GPA·SAT 점수·과목 학점
    const last = sc.exams.slice(-4).map(e => `${e.title} ${kr ? e.avg.toFixed(1) : G.gradeTxt(e.avg).replace('GPA ', '')}`).join(' · ');
    if (last) lines.push(`최근 시험 (${kr ? '평균 등급' : 'GPA'}): ${last}`);
    if (G.naesinAvg() != null) lines.push(`${kr ? '내신 평균 ' : '누적 '}${G.gradeTxt(G.naesinAvg())}`);
    if (G.mockAvg() != null) lines.push(`모의고사 평균 ${G.gradeTxt(G.mockAvg(), 'sat')} (${sc.mocks.length}회)`);
    if (sc.sat) lines.push(`수능 평균 ${G.gradeTxt(sc.sat.avg, 'sat')}${sc.sat.rows && sc.sat.rows.length ? ` (${sc.sat.rows.map(x => (G.subjects.find(y => y.id === x.id) || {}).label + ' ' + (kr ? x.grade : G.gradeLetter(x.grade))).join(', ')})` : ''}`);
    if (sc.extra) lines.push(`비교과 ${Math.round(sc.extra)}점 (동아리·봉사·독서)`);
    const uni = G.univLabel() ? `<div class="me-uni">${logo(sc.univ, 34)}<span>${esc(G.univLabel())} ${esc(G.majorLabel() || '')}${sc.gpaN ? `<br><span class="dim">학점 ${sc.gpa.toFixed(2)}${sc.degree ? ' · 졸업' : ''}</span>` : ''}</span></div>` : '';
    school = `<p class="sec-t">학교</p>${subj ? `<div class="subj">${subj}</div><p class="hint">예상 점수 (능력치 + 이번 시험을 위해 쌓은 공부·수업)</p>` : ''}${lines.map(l => `<p class="dim" style="font-size:13px">${esc(l)}</p>`).join('')}${uni}`;
  }
  const me = G.myLook() && window.Avatar ? avBtn('me', Avatar.render(G.myLook(), 60, { age: S.age, fig: G.figure(null), ctx: G.outfitCtx(null) })) : '';
  showModal('me', `👤 ${S.name}`, `
    <div class="me-top">${me}<dl class="prof">${prof}</dl></div>
    ${fullView === 'me' && G.myLook() ? fullAv(G.myLook(), S.age, G.figure(null), S.personality, false, G.outfitCtx(null)) : ''}
    ${S.preg && S.preg.mode ? `<p class="dim" style="font-size:13px">${S.gender === 'f' ? '임신 중' : '곧 아이가 태어난다'} — ${S.preg.due > S.age ? '내년' : '올해'} 출산 예정</p>` : ''}
    <p class="sec-t">상태</p>
    <div class="stats">${cond}</div>
    <p class="sec-t">능력치</p>
    <div class="stats">${ab}${sx}</div>
    <p class="hint">능력치는 100에서 멈추지 않는다. F부터 SS까지, 등급이 오를수록 올리기 어렵다.</p>
    <p class="sec-t">기록</p>
    <dl class="prof me-rec">${rec}</dl>
    ${school}`);
}

/* 새 인생: 특성 고르기 — 처음부터(0살) / 20세 시작 (QUICKSTART.md) */
const CREATE_FIELDS = [
  ['gender', '성별', [{ id: 'm', label: '남' }, { id: 'f', label: '여' }]],
  ['trait', '소질', null], ['personality', '성격', null], ['wealth', '집안', null],
  ['hobby', '취미', null], ['value', '가치관', null], ['dream', '꿈', null], ['sibling', '형제', null],
  ['month', '생일', Array.from({ length: 12 }, (_, i) => ({ id: i + 1, label: `${i + 1}월` }))],
];
const Q20_FIELDS = ['gender', 'month'];   // 20세 시작: 첫 화면엔 이름·성별·생일만 (나머지는 단계마다)
const SRC = { trait: 'traits', personality: 'personalities', wealth: 'wealth', hobby: 'hobbies', value: 'values', dream: 'dreams', sibling: 'siblings' };
let draft = null;
const optsOf = f => f[2] || G.creation[SRC[f[0]]];
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
function randomDraft(mode, region) {
  const d = { name: '', mode: mode || 'full', step: 0, region: region || G.region() };
  G.previewRegion(d.region);   // 나라에 맞는 이름표(꿈·취미 …)로 보여 줌
  CREATE_FIELDS.forEach(f => { d[f[0]] = rnd(optsOf(f)).id; });
  return d;
}
function openCreate(closable) {
  if (!draft) draft = randomDraft();
  if (draft.mode === 'q20' && draft.step > 0) { openQuick(closable); return; }
  const q20 = draft.mode === 'q20';
  G.previewRegion(draft.region);
  const regs = Object.values(G.regions), rsel = G.regions[draft.region] || regs[0];
  const regionFld = `<div class="fld"><div class="fl"><span>나라</span></div><div class="chips mode">${regs.map(r => `<button type="button" data-region="${r.id}" aria-pressed="${r.id === draft.region}">${r.flag} ${esc(r.label)}</button>`).join('')}</div><p class="desc">${esc(rsel.desc || '')}</p></div>`;
  const fields = CREATE_FIELDS.filter(f => !q20 || Q20_FIELDS.includes(f[0])).map(f => {
    const opts = optsOf(f);
    const sel = opts.find(o => o.id === draft[f[0]]);
    return `<div class="fld"><div class="fl"><span>${f[1]}</span><button type="button" class="dice" data-rf="${f[0]}" aria-label="${f[1]} 랜덤">🎲</button></div>
      <div class="chips">${opts.map(o => `<button type="button" data-cf="${f[0]}" data-cv="${o.id}" aria-pressed="${o.id === draft[f[0]]}">${esc(o.label)}</button>`).join('')}</div>
      ${sel && sel.desc ? `<p class="desc">${esc(sel.desc)}</p>` : ''}</div>`;
  }).join('');
  showModal('create', '🌱 새 인생', `<div class="create">
    <div class="fld"><div class="fl"><span>시작</span></div><div class="chips mode">
      <button type="button" data-mode="full" aria-pressed="${!q20}">처음부터 (0세~)</button><button type="button" data-mode="q20" aria-pressed="${q20}">20세 시작</button></div>
      <p class="desc">${q20 ? '0~19살을 건너뛴다. 학력·능력치·몸·관계를 직접 정하고 스무 살 봄부터.' : '태어나는 순간부터. 어린 시절의 선택이 성격과 취향이 된다.'}</p></div>
    ${regionFld}
    <div class="fld"><div class="fl"><span>이름 (비우면 랜덤)</span></div><input id="cName" maxlength="${draft.region === 'kr' ? 6 : 12}" value="${esc(draft.name)}" placeholder="${draft.region === 'kr' ? '예: 김하늘' : '예: 에밀리 존슨'}" autocomplete="off"></div>
    ${fields}
    <div class="create-go"><button type="button" data-rall>🎲 전부 랜덤</button><button type="button" class="go" data-go>${q20 ? '다음 →' : '태어나기'}</button></div>
  </div>`, !!closable, 'create');
}
function createClick(b) {
  const d = b.dataset;
  const nameEl = $('#cName'); if (nameEl) draft.name = nameEl.value;
  if (d.mode) draft.mode = d.mode;
  else if (d.region) { draft.region = d.region; G.previewRegion(d.region); }
  else if (d.cf) { const f = CREATE_FIELDS.find(x => x[0] === d.cf); draft[d.cf] = typeof optsOf(f)[0].id === 'number' ? +d.cv : d.cv; }
  else if (d.rf) { const f = CREATE_FIELDS.find(x => x[0] === d.rf); draft[d.rf] = rnd(optsOf(f)).id; }
  else if ('rall' in d) { const n = draft.name, m = draft.mode, r = draft.region; draft = randomDraft(m, r); draft.name = n; }
  else if ('go' in d) {
    if (draft.mode === 'q20') { quickSync(); draft.step = 1; draft.maxStep = Math.max(draft.maxStep || 1, 1); openQuick(!$('#mClose').hidden); return; }
    const opt = draft; draft = null; G.newLife(opt); closeModal(); return;
  }
  const top = mBody.scrollTop;
  openCreate(!$('#mClose').hidden);
  mBody.scrollTop = top;
}

// 얼굴: 얼굴형 12 · 눈 20 · 눈썹 18 · 속눈썹 3단계 · 눈썹 진하기 3단계 (안 고른 칸은 지금 얼굴 유전자 값에 불이 들어옴)
function qFace(q, P) {
  if (!P || !P.shape) return '';
  const cur = window.Avatar && window.Face ? Avatar.genes(G.quick.look(q), 20) : null, g = q.gender;
  const val = (f, gv) => q[f] != null && q[f] !== '' ? +q[f] : gv;
  const chips = (f, list, v) => `<div class="chips">${list.map(o => qChip(f, o.id, esc(o.label), o.id === v)).join('')}</div>`;
  return qFld('얼굴형', chips('shape', P.shape, val('shape', cur && cur.shape)))
    + qFld('눈', chips('eyes', P.eyes, q.eyes))
    + qFld('눈썹', chips('brow', P.brow, val('brow', cur && cur.brow)))
    + qFld('속눈썹', chips('lashLv', P.lash, val('lashLv', cur && Face.lashLevel(cur, g))))
    + qFld('눈썹 진하기', chips('browLv', P.browLv, val('browLv', cur && Face.browLevel(cur, g))));
}
/* ── 20세 시작: 배경 → 능력치 → 외모·신체 → 성격·취향 → 관계 → 확인 (뒤로 가기 가능, 오른쪽에 전신 미리보기) ── */
const QSTEPS = ['배경', '능력치', '외모·신체', '성격·취향', '관계', '확인'];
const QNUM = ['hair', 'hc', 'skin', 'iris', 'eyes', 'shape', 'brow', 'lashLv', 'browLv', 'friends', 'ly'], QBOOL = ['exp', 'lsex'];
const QD = () => G.quick.data();
// 처음 들어올 때(또는 성별을 바꿨을 때) 기본값: 첫 화면에서 뽑힌 성격·집안·취미·꿈·형제를 이어받음
function quickSync() {
  const g = draft.gender, Q = QD();
  let q = draft.q;
  if (!q) {
    q = draft.q = {
      seed: Math.random().toString(36).slice(2, 9), gender: g,
      edu: 'normal', univ: null, dept: null, job: Q.jobs[0], wealth: draft.wealth, home: 'parents', army: 'next',
      st: Object.fromEntries(Q.stats.map(k => [k, 50])), style: 20, exp: false, trait: draft.trait,
      build: 'avg', cup: 'B', waist: 63, hip: 90, shoulder: 44, penis: 14,
      personality: draft.personality, hobbies: [draft.hobby], value: draft.value, dream: draft.dream,
      parents: 'both', sibling: draft.sibling, friends: 2, love: 'none', lp: 'warm', ly: 1, lsex: false, exWhy: Q.exWhy[0].id,
      diff: 'normal', money: null, lst: { close: 70, trust: 65, heart: 70, compat: 50, libido: 45 },
    };
  }
  if (q.gender !== g || q.height == null) {
    const a = window.Avatar ? Avatar.make(`${q.seed}:me`, g) : {};
    Object.assign(q, { gender: g, height: g === 'm' ? 173 : 162, hair: a.hair ?? 0, hc: a.hc ?? 0, skin: a.skin ?? 1, eyes: a.eyes ?? 0 });
  }
  quickFixEdu();
}
// 학력이 바뀌면 그 등급의 대학·학과로 맞춤
function quickFixEdu() {
  const q = draft.q, e = QD().edu.find(x => x.id === q.edu);
  if (!e || !e.tiers) return;
  const unis = G.quick.tierUnis(e.tiers);
  if (!unis.some(u => u.id === q.univ)) q.univ = unis[0].id;
  const u = unis.find(x => x.id === q.univ);
  if (!u.departments.includes(q.dept)) q.dept = u.departments[0];
}
const qSandbox = q => q.diff === 'sandbox';
const qTotal = q => (QD().diffs.find(d => d.id === q.diff) || { points: QD().points }).points ?? Infinity;
const qLeft = q => qTotal(q) - QD().stats.reduce((t, k) => t + (q.st[k] || 0), 0);
const qRanges = q => qSandbox(q) ? QD().rangeSandbox : QD().range;
// 난이도를 바꾸면: 포인트가 넘치면 비율대로 줄이고, 몸 수치는 그 난이도 범위 안으로
function quickFitDiff() {
  const q = draft.q, Q = QD(), T = qTotal(q), sum = Q.stats.reduce((t, k) => t + q.st[k], 0);
  if (sum > T) Q.stats.forEach(k => { q.st[k] = Math.floor(q.st[k] * T / sum); });
  const R = qRanges(q), cl = (v, r) => Math.max(r[0], Math.min(r[1], v));
  q.height = cl(q.height, R.height[q.gender]); q.waist = cl(q.waist, R.waist); q.hip = cl(q.hip, R.hip); q.shoulder = cl(q.shoulder, R.shoulder); q.penis = cl(q.penis, R.penis);
}
const qFig = q => G.quick.fig(q.gender, q.build, q);
function qLabel(k) {
  const q = draft.q, Qk = G.quick, gl = v => { const L = Qk.grade(v); return `<b class="g g-${L}">${L}</b>`; };
  if (k === 'left') return String(qLeft(q));
  if (q.st && k in q.st) return `${q.st[k]} ${gl(q.st[k])}`;
  if (k === 'style') return `${q.style} ${gl(q.style)}`;
  if (k === 'height') return `${q.height}cm (${Qk.heightLabel(q.gender, q.height)})`;
  if (k === 'waist') return `${q.waist}cm`;
  if (k === 'hip') return `${q.hip}cm (${Qk.hipLabel(q.hip)})`;
  if (k === 'shoulder') return `${q.shoulder}cm (${Qk.shoulderLabel(q.shoulder)})`;
  if (k === 'penis') return `${q.penis}cm (${Qk.penisLabel(q.penis)})`;
  if (k.startsWith('l_')) return String(q.lst[k.slice(2)]);
  return '';
}
function qPreview() {
  const q = draft.q, f = qFig(q), look = G.quick.look(q);
  const svg = window.Avatar && look ? (draft.step === 3 ? Avatar.render(look, 132, { age: 20 }) : '') + Avatar.render(look, 132, { age: 20, full: f, personality: q.personality }) : '';   // 외모 단계: 얼굴 확대 + 전신
  const bl = (QD().builds.find(b => b.id === q.build) || {}).label || '';
  const cap = q.gender === 'f' ? `${f.under}${f.cup} · ${f.bust}-${f.waist}-${f.hip}` : `어깨 ${f.shoulder}cm`;
  return `${svg}<p class="qs-cap">${f.height}cm · ${esc(bl)} 체형<br>${esc(cap)}</p>`;
}
const qChip = (f, v, label, on, title) => `<button type="button" data-qf="${f}" data-qv="${v}" aria-pressed="${!!on}"${title ? ` title="${esc(title)}"` : ''}>${label}</button>`;
const qChips = (f, list, cur) => `<div class="chips">${list.map(o => qChip(f, o.id, esc(o.label), o.id === cur)).join('')}</div>`;
const qFld = (title, body, desc) => `<div class="fld"><div class="fl"><span>${title}</span></div>${body}${desc ? `<p class="desc">${desc}</p>` : ''}</div>`;
const qRange = (key, min, max, val, label, attr = 'qr') => `<div class="qs-r"><span class="qs-rl">${label}</span><input type="range" data-${attr}="${key}" min="${min}" max="${max}" step="1" value="${val}" aria-label="${esc(label.replace(/<[^>]+>/g, ''))}"><span class="qs-rv" data-qlab="${key}">${qLabel(key)}</span></div>`;
// 컵 아이콘: 옆모습 실루엣 — 컵이 클수록 앞으로 더 나옴
const cupIcon = i => `<svg class="cup-i" viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><path d="M3 1 L3 4.5 Q${(3 + 2.2 + i * 2.1).toFixed(1)} ${(7.5 + i * .45).toFixed(1)} 3 ${(11.5 + i * .55).toFixed(1)} L3 17" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function quickStep(n) {
  const q = draft.q, Q = QD(), C = G.creation, L = (list, id) => (list.find(x => x.id === id) || {}).label || '';
  if (n === 1) {
    const e = Q.edu.find(x => x.id === q.edu);
    let more = '';
    if (e.tiers) {
      const unis = G.quick.tierUnis(e.tiers), u = unis.find(x => x.id === q.univ);
      more = qFld('대학', `<div class="chips unis">${unis.map(x => qChip('univ', x.id, `${logo(x.id, 18)} ${esc(x.short || x.name)}`, x.id === q.univ, x.name)).join('')}</div>`, `${esc(u.name)} · ${esc(G.tierLabel(u.tier))} · "${esc(u.motto || '')}"`)
        + qFld('학과', `<div class="chips">${u.departments.map(id => { const d = G.departments.find(x => x.id === id); return qChip('dept', id, esc(d.icon + ' ' + d.name), id === q.dept); }).join('')}</div>`, '갓 입학한 1학년으로, 3월 입학식 날부터 시작한다. OT·수강신청·첫 수업·동아리·MT 같은 1학년 이야기가 이어진다.');
    } else if (q.edu === 'work') {
      more = qFld('하는 일', `<div class="chips">${G.quick.jobs().map(j => qChip('job', j.id, `${esc(j.label)} <small>${esc(G.fmtMoney(j.salary))}</small>`, j.id === q.job)).join('')}</div>`, '연봉 (만원). 고졸로 바로 시작할 수 있는 일.');
    }
    const mr = Q.money[q.wealth] || [0, 0], w = C.wealth.find(x => x.id === q.wealth) || {};
    const army = q.gender === 'm' && G.region() === 'kr' ? qFld('병역', qChips('army', Q.army.filter(a => q.edu !== 'retake' || a.id !== 'now'), q.army === 'now' && q.edu === 'retake' ? 'next' : q.army), '입대하면 2년 동안 훈련이 하루 8칸을 쓴다.') : '';
    return qFld('학력', qChips('edu', Q.edu, q.edu), esc(e.desc)) + more
      + qFld('집안', qChips('wealth', C.wealth, q.wealth), `${esc(w.desc || '')} 시작 돈 ${mr[0] === mr[1] ? G.fmtMoney(mr[0]) + (q.wealth === 'poor' ? ' (대학생이면 학자금 대출)' : '') : `${G.fmtMoney(mr[0])}~${G.fmtMoney(mr[1])}`}`)
      + (qSandbox(q) ? qFld('시작 돈 <small class="dim">샌드박스 · 만원, 비우면 집안대로</small>', `<input type="number" id="qsMoney" min="0" max="${Q.rangeSandbox.money[1]}" step="10" inputmode="numeric" value="${q.money ?? ''}" placeholder="예: 5000">`) : '')
      + qFld('사는 곳', qChips('home', Q.home, q.home)) + army;
  }
  if (n === 2) {
    const tr = C.traits.find(t => t.id === q.trait) || {};
    const rows = Q.stats.map(k => qRange(k, 0, 100, q.st[k], `${G.LABEL[k]} <small class="dim">${esc(Q.statDesc[k])}</small>`, 'qs')).join('');
    const dv = Q.diffs.find(d => d.id === q.diff) || Q.diffs[1];
    const head = qSandbox(q) ? '<div class="qs-left sandbox">🎮 샌드박스 모드 <small>밸런스 무시 — 저장 칸에 샌드박스로 표시된다</small></div>'
      : `<div class="qs-left">남은 포인트 <b data-qlab="left">${qLabel('left')}</b> / ${dv.points}</div>`;
    return qFld('난이도', qChips('diff', Q.diffs, q.diff), esc(dv.desc)) + head + `
      <div class="chips">${Q.presets.filter(p => !p.sandbox || qSandbox(q)).map(p => `<button type="button" data-qpre="${p.id}">${esc(p.label)}</button>`).join('')}<button type="button" data-qpre="random">🎲 랜덤</button></div>
      <div class="qs-rs">${rows}</div>
      <p class="hint">0~20 F · 21~40 E~D · 41~60 C · 61~80 B~A · 81~100 S.${qSandbox(q) ? ' 샌드박스는 포인트 제한이 없다.' : ' 남은 포인트가 0이면 더 올릴 수 없다.'}</p>
      <div class="qs-rs">${qRange('style', 0, 50, q.style, '꾸밈 <small class="dim">옷·머리 상태</small>')}</div>
      ${qFld('소질 <small class="dim">앞으로 잘 오르는 것</small>', qChips('trait', C.traits, q.trait), esc(tr.desc || ''))}
      ${qSandbox(q) ? qFld('섹스 기술 <small class="dim">샌드박스</small>', `<div class="chips">${G.sexGrades.map(l => qChip('sexg', l, l, (q.sexg || 'F') === l)).join('')}</div>`, (q.sexg || 'F') === 'F' ? '경험 없이 시작한다.' : q.sexg === 'SSS' ? 'SSS — 애인이 있든 결혼했든 한 번 자면 빠져들고 죄책감을 못 느낀다. 만족감이 100을 넘을 수 있다.' : `${q.sexg} 등급으로 시작한다. 높을수록 그날 밤이 길고 상대가 더 많이 절정한다.`)
        : qFld('경험', `<div class="chips">${qChip('exp', 0, '없음', !q.exp)}${qChip('exp', 1, '있음', q.exp)}</div>`, q.exp ? '섹스 기술이 조금 있는 채로 시작한다.' : '아직 경험 없이 시작한다.')}`;
  }
  if (n === 3) {
    const P = window.Avatar ? Avatar.parts : { hair: { m: [], f: [] }, hc: [], skin: [], eyes: [] }, g = q.gender, R = qRanges(q);
    const body = g === 'f'
      ? qFld('가슴', `<div class="chips">${Q.cups.map((c, i) => qChip('cup', c, `${cupIcon(i)} ${c}`, c === q.cup)).join('')}</div>`, esc(G.quick.cupLabel(q.cup)))
        + `<div class="qs-rs">${qRange('waist', R.waist[0], R.waist[1], q.waist, '허리')}${qRange('hip', R.hip[0], R.hip[1], q.hip, '골반')}</div>`
      : `<div class="qs-rs">${qRange('shoulder', R.shoulder[0], R.shoulder[1], q.shoulder, '어깨')}${qRange('penis', R.penis[0], R.penis[1], q.penis, '크기')}</div>`;
    const sw = (f, list) => `<div class="chips sw">${list.map(o => qChip(f, o.id, `<i style="background:${o.color}"></i>${esc(o.label)}`, o.id === q[f])).join('')}</div>`;
    return `<div class="qs-rs">${qRange('height', R.height[g][0], R.height[g][1], q.height, '키')}</div>`
      + qFld('체형', qChips('build', Q.builds, q.build)) + body
      + qFld('머리 스타일', `<div class="chips">${P.hair[g].map((l, i) => qChip('hair', i, esc(l), i === q.hair)).join('')}</div>`)
      + qFld('머리색', sw('hc', P.hc)) + qFld('피부', sw('skin', P.skin)) + (P.iris ? qFld('눈동자', sw('iris', P.iris)) : '')
      + qFace(q, P)
      + `<div class="chips"><button type="button" data-qreface>🎲 얼굴 다시 뽑기</button></div>`;
  }
  if (n === 4) {
    const pe = C.personalities.find(x => x.id === q.personality) || {};
    return qFld('성격', qChips('personality', C.personalities, q.personality), `${esc(pe.desc || '')} <b>${esc(Q.persEffect[q.personality] || '')}</b>`)
      + qFld(`취미 <small class="dim">두 개까지 (${q.hobbies.length}/2)</small>`, `<div class="chips">${C.hobbies.map(h => `<button type="button" data-qh="${h.id}" aria-pressed="${q.hobbies.includes(h.id)}">${esc(h.label)}</button>`).join('')}</div>`)
      + qFld('가치관', qChips('value', C.values, q.value)) + qFld('꿈', qChips('dream', C.dreams, q.dream));
  }
  if (n === 5) {
    let love = '';
    if (q.love === 'yes') {
      love = qFld('연인 성격', qChips('lp', C.personalities, q.lp))
        + qFld('만난 기간', `<div class="chips">${[1, 2, 3].map(y => qChip('ly', y, `${y}년`, y === q.ly)).join('')}</div>`, '오래 만날수록 친밀·신뢰는 깊고, 설렘은 조금 잔잔하다.')
        + qFld('함께 보낸 밤', `<div class="chips">${qChip('lsex', 0, '아직', !q.lsex)}${qChip('lsex', 1, '있음', q.lsex)}</div>`, q.lsex ? '경험이 있는 채로 시작하고, 서로 조금 맞춰져 있다.' : '')
        + (qSandbox(q) ? `<div class="qs-rs"><p class="sec-t">연인 스탯 <span class="dim">샌드박스</span></p>${Q.loverStats.map(([k, l]) => qRange('l_' + k, 0, 100, q.lst[k], l)).join('')}</div>` : '');
    } else if (q.love === 'ex') love = qFld('헤어진 이유', qChips('exWhy', Q.exWhy, q.exWhy), '첫 여름에 그 사람과 다시 얽히는 일이 생긴다.');
    return qFld('부모님', qChips('parents', Q.parents, q.parents))
      + qFld('형제', qChips('sibling', C.siblings, q.sibling))
      + qFld('친구', `<div class="chips">${[0, 1, 2, 3].map(k => qChip('friends', k, k ? `${k}명` : '없음', k === q.friends)).join('')}</div>`, q.edu === 'elite' || q.edu === 'normal' || q.edu === 'college' ? '두 명까지는 같은 과 — 캠퍼스에서 자주 마주친다.' : '')
      + qFld('연인', qChips('love', Q.love, q.love)) + love;
  }
  // 6: 확인
  const e = Q.edu.find(x => x.id === q.edu), u = q.univ && G.universities.find(x => x.id === q.univ), d = q.dept && G.departments.find(x => x.id === q.dept);
  const f = qFig(q), P = window.Avatar ? Avatar.parts : null;
  const rows = [
    ['이름', `${draft.name.trim() || '(랜덤)'} · ${genderKo(q.gender)} · ${draft.month}월생`],
    ['난이도', `${L(Q.diffs, q.diff)}${qSandbox(q) && q.money != null && q.money !== '' ? ` · 시작 돈 ${G.fmtMoney(+q.money)}` : ''}`],
    ['학력', e.tiers && u ? `${e.label} — ${u.name} ${d ? d.name : ''}` : q.edu === 'work' ? `${e.label} — ${(G.quick.jobs().find(j => j.id === q.job) || {}).label || ''}` : e.label],
    ['집안', `${L(C.wealth, q.wealth)} · ${L(Q.home, q.home)}${q.gender === 'm' && G.region() === 'kr' ? ` · ${L(Q.army, q.edu === 'retake' && q.army === 'now' ? 'next' : q.army)}` : ''}`],
    ['능력치', Q.stats.map(k => `${G.LABEL[k]} ${G.quick.grade(q.st[k])}`).join(' · ') + ` · 꾸밈 ${G.quick.grade(q.style)}`],
    ['소질', L(C.traits, q.trait) + (qSandbox(q) ? ((q.sexg || 'F') !== 'F' ? ` · 섹스 기술 ${q.sexg}` : '') : q.exp ? ' · 경험 있음' : '')],
    ['몸', `${f.height}cm · ${L(Q.builds, q.build)} · ${q.gender === 'f' ? `${f.under}${f.cup} · ${f.bust}-${f.waist}-${f.hip}` : `어깨 ${f.shoulder}cm · ${q.penis}cm`}`],
    ['생김새', P ? `${P.hair[q.gender][q.hair] || ''} · ${(P.hc.find(x => x.id === q.hc) || {}).label || ''} · 피부 ${(P.skin[q.skin] || {}).label || ''} · ${(P.eyes[q.eyes] || {}).label || ''} 눈${q.shape != null && P.shape ? ` · ${P.shape[q.shape].label}` : ''}${q.brow != null && P.brow ? ` · ${P.brow[q.brow].label} 눈썹` : ''}` : ''],
    ['성격·취향', `${L(C.personalities, q.personality)} · ${q.hobbies.map(h => L(C.hobbies, h)).join('·')} · ${L(C.values, q.value)} · 꿈 ${L(C.dreams, q.dream)}`],
    ['관계', `부모님 ${L(Q.parents, q.parents)} · ${L(C.siblings, q.sibling)} · 친구 ${q.friends}명 · ${q.love === 'yes' ? `연인 (${L(C.personalities, q.lp)}, ${q.ly}년)` : q.love === 'ex' ? `전 연인 (${L(Q.exWhy, q.exWhy)})` : '솔로'}`],
  ];
  return `<dl class="prof qs-sum">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="hint">스무 살 3월 1일, 새 학년도의 첫날부터 시작한다.</p>`;
}
function openQuick(closable) {
  const n = draft.step, q = draft.q;
  const steps = QSTEPS.map((t, i) => { const k = i + 1; return `<button type="button" class="${k === n ? 'on' : k < n ? 'done' : ''}" data-qstep="${k}"${k > (draft.maxStep || 1) ? ' disabled' : ''}>${k} ${t}</button>`; }).join('');
  const warn = n === 4 && !q.hobbies.length ? '취미를 하나 이상 골라줘.' : '';
  showModal('quick', `🌱 20세 시작 · ${n}/6 ${QSTEPS[n - 1]}`, `<div class="create qs">
    <div class="qs-steps">${steps}</div>
    <div class="qs-grid"><div class="qs-main">${quickStep(n)}</div><div class="qs-side" id="qsPrev">${qPreview()}</div></div>
    ${warn ? `<p class="hint warn">${warn}</p>` : ''}
    <div class="create-go"><button type="button" data-qback>← 뒤로</button><button type="button" class="go" data-${n === 6 ? 'qgo' : 'qnext'}${warn ? ' disabled' : ''}>${n === 6 ? '이대로 시작' : '다음 →'}</button></div>
  </div>`, closable == null ? !$('#mClose').hidden : !!closable, 'q' + n);
}
function quickRefresh() {
  mBody.querySelectorAll('[data-qlab]').forEach(el => { el.innerHTML = qLabel(el.dataset.qlab); });
  const pv = $('#qsPrev'); if (pv) pv.innerHTML = qPreview();
}
function quickRandom() {
  const Q = QD(), v = Q.stats.map(() => 0);
  if (qSandbox(draft.q)) return v.map(() => Math.floor(Math.random() * 101));
  let left = qTotal(draft.q);
  while (left > 0) { const i = Math.floor(Math.random() * v.length), add = Math.min(left, 1 + Math.floor(Math.random() * 10), 100 - v[i]); v[i] += add; left -= add; }
  return v;
}
function quickClick(b) {
  const d = b.dataset, q = draft.q, Q = QD();
  if ('qback' in d) { draft.step--; if (draft.step <= 0) { draft.step = 0; openCreate(!$('#mClose').hidden); } else openQuick(); return; }
  if ('qnext' in d) { draft.step = Math.min(6, draft.step + 1); draft.maxStep = Math.max(draft.maxStep || 1, draft.step); openQuick(); return; }
  if (d.qstep) { draft.step = +d.qstep; openQuick(); return; }
  if ('qgo' in d) { const opt = Object.assign({}, q, { name: draft.name, gender: draft.gender, month: draft.month, region: draft.region }); draft = null; closeModal(); G.newLife20(opt); return; }   // 닫고 나서 만들어야 '나의 20년' 창이 뜸
  if (d.qf) {
    const f = d.qf, v = QNUM.includes(f) ? +d.qv : QBOOL.includes(f) ? d.qv === '1' : d.qv;
    q[f] = v;
    if (f === 'edu' || f === 'univ') quickFixEdu();
    if (f === 'diff') quickFitDiff();
  } else if (d.qh) {
    const i = q.hobbies.indexOf(d.qh);
    if (i >= 0) q.hobbies.splice(i, 1); else { q.hobbies.push(d.qh); if (q.hobbies.length > 2) q.hobbies.shift(); }
  } else if (d.qpre) {
    const v = d.qpre === 'random' ? quickRandom() : (Q.presets.find(p => p.id === d.qpre) || Q.presets[0]).v;
    Q.stats.forEach((k, i) => { q.st[k] = v[i]; });
    quickFitDiff();   // 하드(240)면 프리셋을 비율대로 줄임
  } else if ('qreface' in d) q.seed = Math.random().toString(36).slice(2, 9);
  openQuick();
}
// 슬라이더: 다시 그리지 않고 값·라벨·미리보기만 (끄는 중에 슬라이더가 사라지지 않게). 능력치는 남은 포인트까지만
mBody.addEventListener('input', e => {
  if (modalMode !== 'quick' || !draft || !draft.q) return;
  const el = e.target;
  const q = draft.q;
  if (el && el.id === 'qsMoney') { q.money = el.value === '' ? null : Math.max(0, Math.min(QD().rangeSandbox.money[1], Math.round(+el.value) || 0)); return; }
  if (!el || el.type !== 'range') return;
  if (el.dataset.qr && el.dataset.qr.startsWith('l_')) { q.lst[el.dataset.qr.slice(2)] = +el.value; quickRefresh(); return; }
  if (el.dataset.qs) {
    const k = el.dataset.qs, max = Math.min(100, q.st[k] + qLeft(q));
    let v = +el.value;
    if (v > max) { v = max; el.value = v; }
    q.st[k] = v;
  } else if (el.dataset.qr) q[el.dataset.qr] = +el.value;
  quickRefresh();
});

/* 20세 시작: 지나온 20년 요약 → [시작하기] */
function openIntro() {
  const S = G.state(), it = S.intro;
  if (!it) return;
  const me = G.myLook() && window.Avatar ? Avatar.render(G.myLook(), 58, { age: S.age, fig: G.figure(null), ctx: G.outfitCtx(null) }) : '';
  const lines = it.lines.map(([i, t, sub]) => `<p class="il"><span class="ii">${i}</span><span>${esc(t)}${sub ? `<br><small class="dim">${esc(sub)}</small>` : ''}</span></p>`).join('');
  showModal('intro', '나의 20년', `<div class="intro">
    <div class="intro-top">${me}<span><b>${esc(S.name)}</b><br><span class="dim">스무 살 · ${S.date.y}년 3월 1일</span></span></div>
    ${lines}
    <p class="il"><span class="ii">📷</span><span>추억${it.mems.map(m => `<br>• "${esc(m)}"`).join('')}</span></p>
    <p class="intro-last">지금, 인생이 시작된다.</p>
    <div class="choices"><button type="button" data-intro>시작하기</button></div></div>`, false, 'intro');
}

/* 엔딩 */
function openEnding() {
  const S = G.state(), wx = WX[S.weather];
  const main = G.mainPartner();
  const kids = G.people().filter(p => p.kind === 'child');
  const kidNames = kids.map(k => k.name).join(', ');
  const death = S.ended === 'death';
  let first;
  if (death) first = `${wx.adj} 날, ${S.age}살의 나이로 눈을 감았다.`;
  else if (S.jail) first = `${wx.adj} 날, 교도소 안에서 쉰 번째 생일을 맞았다.`;
  else first = `${wx.adj} 날, 쉰 번째 생일을 맞았다.`;
  let last;
  if (death) last = '짧았지만, 분명히 살아낸 시간이었다.';
  else if (S.jail) last = `출소까지 ${S.jail}년. 그 뒤의 삶은 아직 아무도 모른다.`;
  else if (main && kids.length) last = `${G.josa(kidNames, '이')} 케이크 촛불을 같이 불어줬다. 남은 절반은 또 어떤 날들일까.`;
  else if (main) last = `${G.josa(G.pname(main), '와')} 조용히 케이크를 나눠 먹었다. 내일은 뭘 해볼까.`;
  else if (kids.length) last = `${G.josa(kidNames, '이')} 전화로 생일 노래를 불러줬다. 아직 해보고 싶은 게 많다.`;
  else last = '혼자 맞는 쉰 번째 생일. 창밖을 보다가 문득, 아직 해보고 싶은 게 남아 있다는 걸 깨달았다.';
  if (!death && S.karma <= -40) last += ' 가끔은 지난 일들이 꿈에 나온다.';

  const close = G.people().filter(p => p.kind === 'family' || p.kind === 'child' || p.spouse || p.partner || p.close >= 60)
    .map(p => `${G.pname(p)}(${G.relLabel(p)})`).join(', ') || '없음';
  const stats = G.conds.filter(k => k !== 'libido' || S.age >= G.config.sexMinAge).map(k => `<span>${G.LABEL[k]}</span><span class="bar">${bar(S.stats[k])}</span><span class="num">${S.stats[k]}</span>`).join('')
    + G.abilities.map(k => { const g = G.gradeInfo(S.stats[k]); return `<span>${G.LABEL[k]}</span><span class="bar">${bar(g.pct * 100)}</span><span class="num"><b class="g-${g.letter}">${g.letter}</b></span>`; }).join('');
  const album = S.memories.map(m => `<p><span class="dim">${m.age}살 ${m.season || ''} ${wxIcon(m.wx)}</span> ${esc(m.text)}</p>`).join('');

  showModal('ending', death ? '— 끝 —' : '🎂 50번째 생일', `
    <p>${esc(first)}</p>
    <p class="dim">${esc(S.name)}${S.sandbox ? ' · 🎮 샌드박스' : ''}<br>${esc(G.roleText())}, 재산 ${G.fmtMoney(S.money)}${S.record ? `, 전과 ${S.record}회` : ''}<br>${G.univLabel() ? logo(S.school.univ, 22) + ' ' + esc(`${G.univLabel()} ${G.majorLabel() || ''}${S.school.degree ? ' 졸업' : ''}`) + '<br>' : ''}꿈: ${esc(S.vars.dreamLabel)} — ${dreamDone(S) ? '이뤘다' : '아직'}<br>업보: ${G.karmaLabel()}<br>곁에 있는 사람: ${esc(close)}</p>
    <div class="stats">${stats}</div>
    <div class="album"><p class="t">✦ 추억 ${S.memories.length}개</p>${album}</div>
    <p class="ending-last">${esc(last)}</p>
    <div class="choices"><button type="button" data-new>↻ 새 인생 시작</button></div>`);
}

function dreamDone(S) {
  const dr = G.creation.dreams.find(d => d.id === S.dream);
  if (!dr) return false;
  if (dr.job) return !!S.flags.dreamDone;
  if (dr.money) return S.money >= dr.money;
  if (dr.flag) return !!S.flags[dr.flag];
  return false;
}
/* 저장 칸 3개 — 지금 칸은 자동 저장. 다른 칸 불러오기, 지금 인생을 다른 칸에 저장, 빈 칸에서 새 인생 */
function openSlots() {
  const rows = G.slots().map(x => {
    const info = x.empty ? '<span class="dim">비어 있음</span>'
      : `<b>${esc(x.name)}</b> <span class="dim">${x.age}살 ${genderKo(x.gender)}${x.date ? ` · ${x.date.y}년 ${x.date.m}월` : ''}${x.quick ? ' · 20세 시작' : ''}${x.sandbox ? ' · 🎮 샌드박스' : ''}${x.ended ? ' · 끝난 인생' : ''}</span>`;
    const btns = x.current ? '<span class="tag">지금 칸 · 자동 저장</span>'
      : (x.empty ? `<button type="button" data-sv="${x.n}">여기에 저장</button><button type="button" data-snew="${x.n}">새 인생</button>`
        : `<button type="button" data-sl="${x.n}">불러오기</button><button type="button" data-sv="${x.n}">덮어쓰기</button><button type="button" data-sdel="${x.n}">지우기</button>`);
    return `<div class="row"><div>${x.n}번 칸 · ${x.region && G.regions[x.region] ? G.regions[x.region].flag + ' ' : ''}${info}</div><div class="slot-btns">${btns}</div></div>`;
  }).join('');
  const S = G.state(), ntOk = S && !S.ended && S.age >= 20;
  showModal('slots', '💾 저장 칸', `${rows}<p class="hint">지금 칸에는 행동·턴·하루가 끝날 때마다 자동으로 저장돼. 다른 칸에 저장하면 그 칸으로 옮겨가서 이어서 저장돼.</p>` +
    (ntOk ? '<div class="choices"><button type="button" data-ntest>🧪 그날 밤 테스트 (디테일 모드)</button></div>' : ''));
}
/* 그날 밤 테스트 창: 저장 데이터를 건드리지 않고 원하는 조건으로 그날 밤 연출 전체(다가감 → 그날 밤 → 자궁 그림 → 아침)를 재생. 디테일 모드 확인용 */
let ntDraft = null;
function openNightTest() {
  const S = G.state();
  if (!S || S.age < 20) { showModal('ntest', '🧪 그날 밤 테스트', '<p>20살 이상인 인생에서만 열 수 있어.</p>'); return; }
  const d = ntDraft || (ntDraft = { gender: S.gender === 'm' ? 'f' : 'm', age: 25, personality: 'playful', chest: 'avg', build: 'avg', grade: 5, cm: 15, sat: '', pose: '', spot: 'home', contra: 'none', preg: false, fore: true, detail: true });
  const sel = (k, opts) => `<select data-nt="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(d[k]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const num = (k, lo, hi, ph = '') => `<input type="number" data-nt="${k}" min="${lo}" max="${hi}" value="${d[k] ?? ''}" placeholder="${ph}">`;
  const chk = (k, l) => `<label class="nt-chk"><input type="checkbox" data-nt="${k}"${d[k] ? ' checked' : ''}> ${l}</label>`;
  const row = (l, x) => `<label class="nt-row"><span>${l}</span>${x}</label>`;
  const D = window.GAME_DATA;
  showModal('ntest', '🧪 그날 밤 테스트', `<p class="hint">저장 데이터는 그대로 두고 상대·조건만 정해서 그날 밤 연출 전체를 다시 봐. 상대는 사람 목록에 들어가지 않아.</p>
    <div class="nt-form">
      ${row('상대 성별', sel('gender', [['f', '여자'], ['m', '남자']]))}${row('상대 나이', num('age', 20, 70))}
      ${row('성격', sel('personality', D.personalities.map(x => [x.id, x.label])))}${row('가슴', sel('chest', [['small', '작은 편'], ['avg', '보통'], ['large', '큰 편']]))}
      ${row('체형', sel('build', [['slim', '마름'], ['avg', '보통'], ['fit', '탄탄'], ['chubby', '통통']]))}${row('섹스 기술', sel('grade', G.sexGrades.map((g, i) => [i, g])))}
      ${row('크기 cm', num('cm', 6, 26))}${row('만족감', num('sat', 0, 130, '자동'))}
      ${row('체위', sel('pose', [['', '자동 (성격대로)']].concat(Object.entries(Night.poseLabel))))}${row('장소', sel('spot', [['home', '집'], ['hotel', '호텔'], ['travel', '여행지'], ['park', '공원'], ['motel', '모텔']]))}
      ${row('피임', sel('contra', Object.entries(CONTRA_LABEL)))}
    </div>
    <div class="nt-chks">${chk('detail', '🔬 디테일 모드')}${chk('fore', '다가가는 카드부터')}${chk('preg', '임신 연출')}</div>
    <div class="choices"><button type="button" data-ntgo>▶ 재생</button></div>`);
}
function runNightTest() {
  const v = k => { const el = mBody.querySelector(`[data-nt="${k}"]`); return !el ? null : el.type === 'checkbox' ? el.checked : el.value; };
  ntDraft = { gender: v('gender'), age: +v('age') || 25, personality: v('personality'), chest: v('chest'), build: v('build'), grade: +v('grade'), cm: +v('cm') || 15, sat: v('sat'), pose: v('pose'), spot: v('spot'), contra: v('contra'), preg: v('preg'), fore: v('fore'), detail: v('detail') };
  const r = G.testNight(ntDraft);
  if (!r) return;
  closeModal();
  Night.setDetail(ntDraft.detail); Night.forcePose(ntDraft.pose || null);
  playScene(r.sc, r.p);
}
function confirmRestart() {
  showModal('confirm', '↻ 새 인생', `<p>지금 인생을 접고 처음부터 다시 시작할까?</p>
    <div class="choices"><button type="button" data-cancel>계속 살기</button><button type="button" data-new>새로 시작</button></div>`);
}

/* ═════════ 📱 게임 속 핸드폰 — 홈 화면 + 앱 (연락처·관계망·방구하기·구인·은행·지도·앨범·저장) ═════════
   폰에서 연 창은 폰 모양(상태 표시줄 · ‹ 뒤로). 앱 안에서 연 사람 창·지도도 폰 안에서. 열 살부터 (그 전엔 폰이 없음) */
let inPhone = false;
const PHONE_MODES = new Set(['phone', 'people', 'person', 'jobs', 'posting', 'map', 'realty', 'listing', 'contract', 'bank', 'album', 'slots', 'delivery', 'store']);
const PHONE_APPS = [
  { id: 'contacts', icon: '📇', label: '연락처', bg: '#3fae73' },
  { id: 'web', icon: '🕸️', label: '관계망', bg: '#8a6cf0' },
  { id: 'realty', icon: '🏠', label: () => G.realty.app(), bg: '#2f80ed', age: 19 },
  { id: 'delivery', icon: '🛵', label: () => G.food.delivery().app, bg: '#2ac1bc', age: 19 },
  { id: 'jobs', icon: '💼', label: () => G.jobsite.app(), bg: '#f2994a', age: 16 },
  { id: 'bank', icon: '🏦', label: '은행', bg: '#1f9d6b', age: 16 },
  { id: 'map', icon: '🗺️', label: '지도', bg: '#33a9d6' },
  { id: 'album', icon: '📷', label: '앨범', bg: '#e0555f' },
  { id: 'slots', icon: '💾', label: '저장', bg: '#7d8592' },
];
const phoneStatus = () => { const ti = G.timeInfo(), S = G.state(); return `<span>${ti.clock || `${ti.m}월`}</span><span class="ph-isl" aria-hidden="true"></span><span>📶 ⚡${Math.max(0, S.ap || 0)} 🔋</span>`; };
function openPhone(app = 'home', arg) {
  inPhone = true;
  if (app === 'contacts') { peopleView = 'list'; peopleFilter = 'phone'; personFrom = 'people'; return openPeople(); }
  if (app === 'web') { peopleView = 'web'; peopleFilter = 'all'; personFrom = 'people'; return openPeople(); }
  if (app === 'realty') return openRealty(arg || rtTab);
  if (app === 'delivery') return openDelivery();
  if (app === 'jobs') return openJobs();
  if (app === 'bank') return openBank();
  if (app === 'map') return openMap();
  if (app === 'album') return openAlbum();
  if (app === 'slots') return openSlots();
  phoneHome();
}
function phoneHome() {
  inPhone = true;
  const S = G.state(), ti = G.timeInfo(), pl = G.place(), age = S.age;
  const date = `${ti.m}월 ${ti.d}일 ${ti.dow ? `(${ti.dow})` : ''}`;
  const nNum = G.people().filter(p => !G.acquaintance(p) && G.hasNumber(p)).length;
  const badge = { contacts: nNum || '', realty: G.realty.agentToday() ? 'N' : '', jobs: G.jobsite.apps().filter(a => a.stage === 'offer' || a.stage === 'iv').length || '' };
  const apps = PHONE_APPS.map(a => { const lab = typeof a.label === 'function' ? a.label() : a.label, off = age < (a.age || 0) || (a.id === 'map' && !G.places().length);
    return `<button type="button" class="ph-app" data-app="${a.id}"${off ? ' disabled' : ''}><span class="ai" style="--bg:${a.bg}">${a.icon}</span><span class="an">${esc(lab)}</span>${badge[a.id] ? `<b class="ph-badge">${badge[a.id]}</b>` : ''}</button>`; }).join('');
  showModal('phone', '📱 내 폰', `<div class="ph-home">
    <div class="ph-clock"><b>${ti.clock || date}</b><span>${ti.clock ? date + ' ' : ''}${wxIcon(S.weather)}</span></div>
    <div class="ph-widget"><span>💰 ${G.fmtMoney(S.money)}</span><span>⚡ ${Math.max(0, S.ap || 0)}</span><span>📍 ${esc(pl ? pl.label : ti.zone || '집')}</span></div>
    <div class="ph-apps">${apps}</div>
    <p class="ph-tip">${age < 19 ? '방구하기는 스무 살부터.' : '앱을 눌러 열고, ‹ 로 돌아온다.'}</p></div>`);
}
function phoneBack() {
  if (modalMode === 'person' && personFrom === 'people') return openPeople();
  if (modalMode === 'contract') return openListing(modalArg);
  if (modalMode === 'listing') return openRealty(rtTab);
  if (modalMode === 'store') return openDelivery();
  if (modalMode === 'posting') return openJobs('list');
  phoneHome();
}
// 다시 그리기 (상태가 바뀌면 그 앱 화면 그대로)
const PHONE_RENDER = { phone: () => phoneHome(), realty: () => openRealty(rtTab), listing: () => openListing(modalArg), contract: () => openContract(modalArg), bank: () => openBank(), album: () => openAlbum(), delivery: () => openDelivery(), store: () => openStore(modalArg), posting: () => openPosting(modalArg) };

/* 🍽 먹을 것 (data/food.js) — 장소 메뉴 · 사서 챙기기 · 집밥·해 먹기 / 🎒 가방 / 🛵 배달 앱 */
let foodTab = 'eat', dlvCat = '전체';
const mealTxt = m => m >= 1 ? `${Math.floor(m)}끼${m % 1 >= .5 ? ' 반' : ''}` : m > 0 ? '조금' : '0끼';
function foodBar(f) {
  if (!f) return '';
  const bt = [];
  if (f.eat.length) bt.push(`<button type="button" data-food="eat">🍽 ${esc(f.title || '메뉴')} <small>${f.eat.length}가지</small></button>`);
  if (f.buy.length) bt.push(`<button type="button" data-food="buy">🛒 사서 챙기기 <small>${f.buy.length}가지</small></button>`);
  if (f.home.length) bt.push('<button type="button" data-food="home">🍚 집에서 먹기</button>', `<button type="button" data-dlv>🛵 ${esc(G.food.delivery().app)}</button>`);
  return `<p class="sec-t">🍽 먹기 <span class="dim">· 오늘 ${mealTxt(G.timeInfo().meals || 0)} 먹음 · 하루 두 끼</span></p><div class="food-bar">${bt.join('')}</div>`;
}
function foodCard(v, attr) {
  return `<div class="fd-card${v.ok ? '' : ' off'}"><span class="fd-ic">${v.icon}</span><span class="fd-i"><b>${esc(v.label)}</b><span class="fd-tags">${v.tags.map(t => `<i>${esc(t)}</i>`).join('')}</span>${v.why ? `<small class="dim">${esc(v.why)}</small>` : ''}</span>
    <button type="button" ${attr}${v.ok ? '' : ' disabled'}><b>${esc(v.priceT)}</b>${v.pt ? `<small>⚡${v.pt}</small>` : ''}</button></div>`;
}
function openFood(tab) {
  const f = G.food.here();
  if (!f) { closeModal(); return; }
  foodTab = tab || foodTab;
  const tabs = [['eat', '🍽 여기서 먹기', f.eat.length], ['buy', '🛒 사서 챙기기', f.buy.length], ['home', '🏠 집밥', f.home.length]].filter(t => t[2]);
  if (!tabs.some(t => t[0] === foodTab)) foodTab = tabs[0][0];
  const S = G.state(), keepTag = v => v.keep ? (v.keep <= 1 ? '오늘까지' : `${v.keep}일 보관`) : v.uses ? `${v.uses}끼분` : '오래감';
  const body = foodTab === 'eat' ? `${f.note ? `<p class="dim fd-note">${esc(f.note)}</p>` : ''}${f.mate ? `<p class="fd-mate">👫 ${esc(G.josa(f.mate, '와'))} 같이 — 2인분 값 (내가 산다)</p>` : ''}${f.eat.map(v => foodCard(v, `data-feat="${v.id}"`)).join('')}`
    : foodTab === 'buy' ? `<p class="dim fd-note">사서 🎒 가방에 넣어 다니다가 아무 데서나 먹는다. 도시락·김밥은 그날까지, 빵은 사흘쯤, 컵라면은 오래간다. (가방 ${G.food.used()}/${G.food.max})</p>${f.buy.map(v => foodCard(Object.assign({}, v, { tags: v.tags.concat([keepTag(v)]) }), `data-fbuy="${v.id}"`)).join('')}`
    : `${f.home.map(v => foodCard(Object.assign({}, v, { label: v.label + (v.id === 'cook' ? ` (식재료 ${v.left || 0}끼분)` : '') }), `data-fhome="${v.id === 'homemeal' ? 'parents' : 'cook'}"`)).join('')}<button type="button" class="fd-dlv" data-dlv>🛵 ${esc(G.food.delivery().app)} 앱으로 시켜 먹기</button>`;
  const pl = G.place();
  showModal('food', f.place === 'home' ? '🏠 집에서 먹기' : `${pl ? pl.icon + ' ' + pl.label : '🍽'} · ${foodTab === 'buy' ? '사서 챙기기' : f.title || '메뉴'}`, `<div class="rt-tabs">${tabs.map(t => `<button type="button" data-ftab="${t[0]}" aria-pressed="${t[0] === foodTab}">${t[1]}</button>`).join('')}</div>
    <p class="fd-stat">오늘 먹은 끼니 <b>${mealTxt(G.timeInfo().meals || 0)}</b> · 💰 ${G.fmtMoney(S.money)} · ⚡ ${Math.max(0, S.ap)}</p>${body}`);
}
function openBag() {
  const list = G.food.bag(), adult = G.phase() === 'adult';
  const rows = list.map(b => `<div class="fd-card"><span class="fd-ic">${b.icon}</span><span class="fd-i"><b>${esc(b.label)} <small class="dim">×${b.n}${b.cook ? '끼분' : ''}</small></b><span class="fd-tags">${b.tags.map(t => `<i>${esc(t)}</i>`).join('')}${b.left == null ? '<i>오래감</i>' : `<i class="${b.left <= 0 ? 'bad' : ''}">${b.left <= 0 ? '오늘까지' : `${b.left}일 남음`}</i>`}</span></span>
    <span class="fd-b2">${b.cook ? '<small class="dim">집에서<br>해 먹기</small>' : `<button type="button" data-beat="${b.ix}"${b.why ? ' disabled' : ''}>먹기 <small>⚡${b.pt}</small></button>`}<button type="button" class="ghost" data-bdrop="${b.ix}" aria-label="버리기">🗑</button></span></div>`).join('');
  showModal('bag', `🎒 가방 ${G.food.used()}/${G.food.max}`, `${adult ? `<p class="fd-stat">오늘 먹은 끼니 <b>${mealTxt(G.timeInfo().meals || 0)}</b> · 하루 두 끼를 못 먹으면 건강이 깎인다</p>` : ''}${rows || `<p class="empty">가방이 비어 있다.${adult ? ' 편의점·시장·카페에서 먹을 걸 사서 넣어 두면 아무 데서나 꺼내 먹을 수 있다.' : ''}</p>`}`);
}
// 🛵 배달 앱 (📱 폰): 카테고리 · 가게 목록(별점·리뷰·도착 시간) · 가게 메뉴 → 주문
function openDelivery() {
  const D = G.food.delivery(), cats = ['전체', ...new Set(D.stores.map(x => x.cat))];
  const list = D.stores.filter(x => dlvCat === '전체' || x.cat === dlvCat);
  showModal('delivery', `🛵 ${D.app}`, `<div class="dv-addr">📍 <b>${D.home ? '우리 집' : '집 밖'}</b> <small class="dim">· ${esc(D.tipT)} · 최소주문 ${esc(D.minT)}</small></div>
    ${D.why ? `<p class="rt-warn">⏰ ${esc(D.why)}</p>` : ''}
    <div class="rt-chips">${cats.map(c => `<button type="button" data-dcat="${esc(c)}" aria-pressed="${c === dlvCat}">${esc(c)}</button>`).join('')}</div>
    <div class="dv-list">${list.map(x => `<button type="button" class="dv-card" data-store="${x.id}"><span class="dv-ic">${x.icon}</span><span class="dv-i"><b>${esc(x.name)}</b><span class="dv-meta">⭐ ${x.star} <small>(${x.rev.toLocaleString()})</small> · 🕒 ${esc(x.eta)}</span><span class="dim">${esc(x.menu[0].label)} · ${esc(x.menu[0].priceT)}</span></span></button>`).join('')}</div>`);
}
function openStore(id) {
  const D = G.food.delivery(), x = D.stores.find(y => y.id === id), kr = G.region() === 'kr';
  if (!x) { openDelivery(); return; }
  showModal('store', `${x.icon} ${x.name}`, `<div class="dv-hero"><span class="dv-ic">${x.icon}</span><div><b>${esc(x.name)}</b><span>⭐ ${x.star} · 리뷰 ${x.rev.toLocaleString()} · 🕒 ${esc(x.eta)}</span><span class="dim">${esc(D.tipT)} · 최소주문 ${esc(D.minT)}</span></div></div>
    ${D.why ? `<p class="rt-warn">⏰ ${esc(D.why)}</p>` : ''}
    ${x.menu.map(m => `<div class="fd-card${m.ok ? '' : ' off'}"><span class="fd-i"><b>${esc(m.label)}</b><span class="fd-tags">${m.tags.map(t => `<i>${esc(t)}</i>`).join('')}</span><small class="dim">${esc(m.priceT)} + ${kr ? '배달팁' : '배달비·팁'} ${esc(m.feeT)} = <b>${esc(m.totalT)}</b>${m.why ? ` · ${esc(m.why)}` : ''}</small></span><button type="button" data-order="${x.id}:${m.ix}"${m.ok ? '' : ' disabled'}>주문 <small>⚡${D.pt}</small></button></div>`).join('')}
    <p class="hint">오는 동안 ⚡${D.pt} (약 ${Math.round(D.pt * 11)}분). 같이 있는 사람과 나눠 먹으면 조금 더 가까워진다.</p>`, true, id);
}

/* 🏠 방구하기 — 직방·다방·네이버 부동산 / StreetEasy·Zillow 참고
   매물(카테고리·필터 칩·정렬·목록 ↔ 지도) · ♡ 관심 · 🕘 최근 본 · 🏠 내 집 / 매물 상세(사진 넘기기·가격·매물 정보·관리비·옵션·보안·위치·주변·단지·실거래가·중개사무소·비슷한 매물) */
let rtTab = 'list', rtView = 'list', rtF = { deal: 'all', type: 'all', sort: 'rec', dong: '', x: {} }, ctOpt = { move: 'truck', loan: false, insure: true }, rtPh = 0;
const RT_TYPE = { kr: [['all', '전체'], ['small', '원룸·투룸'], ['officetel', '오피스텔'], ['villa', '빌라'], ['apt', '아파트'], ['house', '주택']],
  ny: [['all', '전체'], ['small', '스튜디오·셰어'], ['officetel', '렌탈 빌딩'], ['villa', '워크업'], ['apt', '콘도'], ['house', '타운하우스']] };
const RT_DEAL = { kr: [['all', '전체'], ['월세', '월세'], ['전세', '전세'], ['매매', '매매']], ny: [['all', '전체'], ['월세', '렌트'], ['매매', '매매']] };
const RT_SORT = [['rec', '추천순'], ['cheap', '낮은 가격순'], ['wide', '넓은 순'], ['near', '역 가까운 순'], ['new', '최신순']];
// 추가 필터 (토글): 주차·엘리베이터·반려동물·신축·역세권·풀옵션·확인매물 (뉴욕: NO FEE)
const RT_X = { kr: [['park', '🅿 주차', L => L.parking], ['elev', '🛗 엘리베이터', L => L.elevator], ['pet', '🐶 반려동물', L => L.pets], ['new', '✨ 신축', L => L.age <= 3], ['st', '🚇 역세권', L => L.station <= 5], ['full', '🛋 풀옵션', L => (L.opts || []).length >= 5], ['ok', '✅ 확인매물', L => L.verified != null]],
  ny: [['nofee', 'NO FEE', L => L.nofee], ['pet', '🐶 반려동물', L => L.pets], ['elev', '🛗 엘리베이터', L => L.elevator], ['st', '🚇 역 5분', L => L.station <= 5], ['free', '🎁 한 달 무료', L => L.free], ['ok', '✅ 확인', L => L.verified != null]] };
const monthlyEq = L => (L.rent || 0) + (L.mgmt || 0) + Math.round(((L.deal === '매매' ? L.priceN : L.depN) || 0) * .004);
function rtTags(L) {
  const t = [];
  if (L.agent) t.push(['중개사 추천', 'ag']);
  if (L.gone) t.push(['거래 완료', 'gone']);
  if (L.verified != null && !L.gone) t.push([`✓ 확인매물 ${L.verifiedT}`, 'ok']);
  if (L.nofee) t.push(['NO FEE', 'hot']);
  if (L.urgent) t.push(['급매', 'hot']);
  if (L.kids && L.kids.cho && L.type === 'apt' && G.region() === 'kr') t.push(['🏫 초품아', 'ok']);
  else if (L.kids && L.kids.score >= 1.5) t.push([G.region() === 'kr' ? '🏫 학교 가까움' : '🏫 좋은 학군', '']);
  if (L.free) t.push(['1개월 무료']);
  if (L.stab) t.push(['렌트 안정화']);
  if (L.seen && !L.agent) t.push(['방문함', 'seen']);
  if (L.age <= 3) t.push(['신축']);
  if (L.station <= 5) t.push(['역세권']);
  if ((L.opts || []).length >= 5) t.push(['풀옵션']);
  if (L.pets) t.push(['반려동물']);
  return t.slice(0, 4).map(([x, c]) => `<i class="rt-tag${c ? ' ' + c : ''}">${esc(x)}</i>`).join('');
}
const rtSub = L => `${L.sub} · ${L.areaT.replace(/^전용 /, '')} · ${L.floorT.split(' / ')[0]}`;
const rtCard = L => `<button type="button" class="rt-card${L.gone ? ' gone' : ''}" data-lst="${L.id}"><span class="rt-ph">${roomArt(L, 116, 96)}<b class="rt-pc">📷 ${L.photos || 1}</b><span class="rt-fv" aria-label="관심">${L.fav ? '♥' : '♡'}</span></span>
  <span class="rt-i"><b class="rt-p">${esc(L.price)}</b><span class="rt-s">${esc(rtSub(L))}</span><span class="dim">${L.mgmt ? '관리비 ' + G.fmtMoney(L.mgmt) : '관리비 없음'} · 🚇 ${L.station}분${L.commute ? ` · ${L.commute.to} ${L.commute.min}분` : ''}</span>
  <span class="rt-ti">${esc(L.title || L.sub)}</span><span class="rt-tags">${rtTags(L)}</span></span></button>`;
function rtFilter(all, anyDong) {
  const reg = G.region() === 'ny' ? 'ny' : 'kr';
  let L = all.slice();
  if (rtF.deal !== 'all') L = L.filter(x => x.deal === rtF.deal);
  if (rtF.type !== 'all') L = L.filter(x => rtF.type === 'small' ? ['goshiwon', 'oneroom'].includes(x.type) : x.type === rtF.type);
  if (rtF.dong && !anyDong) L = L.filter(x => x.dong === rtF.dong);
  for (const [k, , fn] of RT_X[reg]) if (rtF.x[k]) L = L.filter(fn);
  if (rtF.sort === 'cheap') L.sort((a, b) => monthlyEq(a) - monthlyEq(b));
  else if (rtF.sort === 'wide') L.sort((a, b) => b.area - a.area);
  else if (rtF.sort === 'near') L.sort((a, b) => a.station - b.station);
  else if (rtF.sort === 'new') L.sort((a, b) => (b.verified ?? -1) - (a.verified ?? -1));
  return L;
}
// 지도 보기: 구역 위에 동네 말풍선 (매물 수 · 대표 가격) — 누르면 그 동네 매물만
function rtMap(L) {
  const reg = G.region() === 'ny' ? 'ny' : 'kr', M = window.GAME_DATA.map, DP = (M.dongs || {})[reg] || {};
  const by = {};
  for (const x of L) (by[x.dong] = by[x.dong] || { n: 0, list: [] }).n++, by[x.dong].list.push(x);
  const bubbles = Object.keys(by).map(nm => { const g = by[nm], [x, y] = DP[nm] || [360, 460];
    const m = g.list.slice().sort((a, b) => monthlyEq(a) - monthlyEq(b))[Math.floor(g.list.length / 2)];
    const tag = m.deal === '월세' ? (reg === 'ny' ? G.fmtMoney(m.rent) : `월 ${m.rent}`) : m.deal === '전세' ? `전 ${Math.round(m.depN / 1000) / 10}억` : reg === 'ny' ? G.fmtMoney(m.priceN) : `매 ${Math.round(m.priceN / 1000) / 10}억`;
    return `<g class="rt-bub${rtF.dong === nm ? ' on' : ''}" data-rdong="${esc(nm)}" transform="translate(${x},${y - 28})"><rect x="-62" y="-27" width="124" height="48" rx="13"/><text y="-6">${esc(nm)}</text><text y="14" class="v">${esc(tag)} · ${g.n}</text><path d="M-8,21 L0,31 L8,21 Z"/></g>`; }).join('');
  const home = G.mapInfo().home;
  return `<div class="rt-map"><svg viewBox="0 0 ${M.w} ${M.h}" aria-label="매물 지도">${window.CityMap ? CityMap.inner(reg) : ''}${home ? `<g transform="translate(${home[0]},${home[1]})"><circle r="9" fill="#f4b740" stroke="#fff" stroke-width="3"/><text y="4" text-anchor="middle" font-size="10">🏠</text></g>` : ''}${bubbles}</svg></div><p class="hint">동네 말풍선 = 대표 가격 · 매물 수. 누르면 그 동네 매물만 본다. 🏠 = 지금 집 · 지하철 노선과 유치원·학교도 같이 보인다.</p>`;
}
function openRealty(tab) {
  rtTab = tab || rtTab;
  const reg = G.region() === 'ny' ? 'ny' : 'kr', why = G.realty.why();
  const all = G.realty.list(), favs = G.realty.favs(), rec = G.realty.recent();
  const tabs = `<div class="rt-tabs" role="tablist">${[['list', `매물 ${all.length}`], ['fav', `♡ ${favs.length}`], ['recent', `🕘 최근 ${rec.length}`], ['home', '🏠 내 집']].map(([id, l]) => `<button type="button" role="tab" data-rtab="${id}" aria-selected="${rtTab === id}">${l}</button>`).join('')}</div>`;
  let body;
  if (rtTab === 'home') body = rtHome();
  else if (rtTab !== 'list') {
    const L = rtTab === 'fav' ? favs : rec;
    body = L.length ? `<div class="rt-list">${L.map(rtCard).join('')}</div>` : `<p class="empty">${rtTab === 'fav' ? '관심 매물이 없다. 매물에서 ♡를 누르면 여기에.' : '최근 본 매물이 없다.'}</p>`;
  } else {
    const L = rtFilter(all);
    const cat = `<div class="rt-cat">${RT_TYPE[reg].map(([id, l]) => `<button type="button" data-rf="type:${id}" aria-pressed="${rtF.type === id}">${l}</button>`).join('')}</div>`;
    const deal = `<div class="rt-chips">${RT_DEAL[reg].map(([id, l]) => `<button type="button" data-rf="deal:${id}" aria-pressed="${rtF.deal === id}">${l}</button>`).join('')}<span class="rt-sep"></span>${RT_X[reg].map(([k, l]) => `<button type="button" data-rx="${k}" aria-pressed="${!!rtF.x[k]}">${l}</button>`).join('')}</div>`;
    const bar = `<div class="rt-bar"><span><b>${L.length}</b>개 매물${rtF.dong ? ` · <button type="button" class="rt-dong" data-rdong="">📍 ${esc(rtF.dong)} ✕</button>` : ''}</span>
      <select data-rsort aria-label="정렬">${RT_SORT.map(([id, l]) => `<option value="${id}"${rtF.sort === id ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <span class="rt-vw"><button type="button" data-rview="list" aria-pressed="${rtView === 'list'}">☰ 목록</button><button type="button" data-rview="map" aria-pressed="${rtView === 'map'}">🗺 지도</button></span></div>`;
    body = `${cat}${deal}${bar}${rtView === 'map' ? rtMap(rtFilter(all, true)) : ''}
      ${rtView === 'list' || rtF.dong ? (L.length ? `<div class="rt-list">${L.map(rtCard).join('')}</div>` : '<p class="empty">조건에 맞는 매물이 없다. 필터를 줄여 보자.</p>') : ''}
      <p class="hint rt-note">매주 새 매물이 올라온다${G.realty.agentToday() ? ' · 오늘은 중개사 추천 매물이 맨 위에' : ' · 지도의 🔑 부동산에 가면 중개사 추천 매물(허위매물 없음)'}. ✓ 확인매물이 아니고 시세보다 너무 싸면 의심해 볼 것 — 📞 문의로 먼저 확인.</p>`;
  }
  showModal('realty', `🏠 ${G.realty.app()}`, `${tabs}${why ? `<p class="hint">📵 ${esc(why)} 계약할 수 있다. 구경은 지금도 할 수 있다.</p>` : ''}${body}`);
}
function rtHome() {
  const H = G.realty.home(), reg = G.region() === 'ny';
  const rows = [['사는 곳', `${H.icon} ${H.dong || H.dongName ? (H.dong || H.dongName) + ' ' : ''}${H.label}`]];
  if (H.station) rows.push(['가까운 역', reg ? `${H.station.line} · ${H.station.name} 도보 ${H.station.min}분` : `${H.station.name}역 (${H.station.line}) 도보 ${H.station.min}분`]);
  if (H.kids && (H.kids.elem || H.kids.kinder)) rows.push(['학교·유치원', [H.kids.elem ? `${H.kids.elem.name} ${H.kids.elem.min}분` : '', H.kids.kinder ? `${H.kids.kinder.name} ${H.kids.kinder.min}분` : ''].filter(Boolean).join(' · ')]);
  if (H.area) rows.push(['면적 · 층', `${reg ? Math.round(H.area * 10.764) + ' sqft' : H.area + '㎡ (' + Math.round(H.area / 3.3058) + '평)'} · ${H.floor}`]);
  if (H.type !== 'parents') {
    rows.push(['계약', H.owned ? `매매 (내 집) · ${G.fmtMoney(H.price)}` : `${H.deal === '월세' && reg ? '렌트' : H.deal || '월세'} · 보증금 ${G.fmtMoney(H.dep)}${H.rent ? ` · 월 ${G.fmtMoney(H.rent)}` : ''}`]);
    rows.push(['관리비', H.mgmt ? G.fmtMoney(H.mgmt) : '없음']);
    if (H.loan) rows.push(['대출', `${G.fmtMoney(H.loan)} · 이자 월 ${G.fmtMoney(H.interest)}`]);
    if (H.insured) rows.push(['보증보험', '가입 (보증금 보호)']);
    if (H.daysLeft != null) rows.push(['계약 만료', H.daysLeft > 0 ? `${H.daysLeft}일 남음 (만료되면 5% 올려 연장)` : '곧 연장']);
  }
  if (H.commute) rows.push(['통근', `출근·수업에 ⚡+${H.commute} (왕복)`]);
  const flaws = H.flaws.length ? `<p class="sec-t">살아 보니</p><ul class="rt-notes">${H.flaws.map(f => `<li class="${f.bad ? 'bad' : 'good'}">${f.bad ? '✖' : '✔'} ${esc(f.t)}</li>`).join('')}</ul>` : '';
  return `<div class="rt-home"><table class="rt-table">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>${flaws}
    <p class="sec-t">이웃 구성</p>${hhMix(H.hh)}${H.kids && H.kids.score >= 1.5 ? '<p class="hint">유치원·초등학교가 가까워서 아이 키우는 부부가 많이 산다.</p>' : ''}
    ${H.canParents ? '<button type="button" class="rt-parents" data-parents>🏡 본가로 들어가기 <small>보증금은 돌려받는다</small></button>' : ''}</div>`;
}
// 옵션 아이콘 (직방·다방의 옵션 칸)
const OPT_IC = { 에어컨: '❄️', 냉장고: '🧊', 세탁기: '🫧', 가스레인지: '🔥', 인덕션: '🍳', 전자레인지: '♨️', 침대: '🛏', 책상: '🪑', 옷장: '🚪', 신발장: '👟', TV: '📺', 비데: '🚽', 인터넷: '🌐', 붙박이장: '🗄', 건조기: '🌀', 식기세척기: '🍽', 베란다: '🪴', 소파: '🛋', 와이파이: '📶' };
const optIc = o => { const k = Object.keys(OPT_IC).find(x => o.includes(x)); return k ? OPT_IC[k] : '✔'; };
const SECU_IC = { CCTV: '📹', '현관 보안': '🔐', 비디오폰: '📞', 도어락: '🔑', 방범창: '🪟', 경비원: '💂', 무인택배함: '📦', 인터폰: '☎️', '버저·인터폰': '🔔', 도어맨: '🎩', '이중 잠금장치': '🔒', 택배실: '📦' };
const NEAR_IC = { 편의점: '🏪', 카페: '☕', 마트: '🛒', 병원: '🏥', 약국: '💊', 공원: '🌳', 헬스장: '🏋', 세탁소: '👔', 은행: '🏦', '버스 정류장': '🚌', 분식집: '🍢', '코인 빨래방': '🧺', 보데가: '🏪', 커피숍: '☕', 슈퍼마켓: '🛒', 피자집: '🍕', 바: '🍺', 빨래방: '🧺' };
// 위치 미니 지도: 구역 + 매물 핀 + 가까운 역
function rtMini(L) {
  const reg = G.region() === 'ny' ? 'ny' : 'kr', M = window.GAME_DATA.map, p = L.pos || ((M.dongs || {})[reg] || {})[L.dong] || [360, 460], [x, y] = p;
  return `<div class="rt-mini"><svg viewBox="${x - 110} ${y - 70} 220 140" aria-hidden="true">${window.CityMap ? CityMap.inner(reg) : ''}
    <path transform="translate(${x},${y - 6})" d="M0,-16 c-9,0 -13,8 -13,12 c0,9 13,20 13,20 c0,0 13,-11 13,-20 c0,-4 -4,-12 -13,-12 Z" fill="#ff5a5f" stroke="#fff" stroke-width="1.5"/><circle cx="${x}" cy="${y - 11}" r="4.5" fill="#fff"/></svg></div>`;
}
// 사진 넘기기: 방 · 주방 · 욕실 · 창밖 · 건물 (사진 수만큼 돌아가며)
function photoArt(L, k, w, h) {
  const v = ['room', 'kitchen', 'bath', 'view', 'out'][k % 5];
  if (v === 'room' || L.type === 'house' && v === 'out') return roomArt(L, w, h);
  const hs = [...String(L.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), wall = L.basement ? '#a39b8a' : ['#efe7da', '#e6edf2', '#f3ece4', '#ebe6f2'][hs % 4];
  let g;
  if (v === 'kitchen') g = `<rect width="160" height="110" fill="${wall}"/><rect x="0" y="62" width="160" height="48" fill="#d8d2c8"/><rect x="10" y="20" width="140" height="26" fill="#f6f4f0" stroke="#c9c2b6"/><path d="M45,20 V46 M80,20 V46 M115,20 V46" stroke="#c9c2b6"/><rect x="10" y="58" width="140" height="6" fill="#9aa4ad"/><rect x="18" y="66" width="40" height="40" fill="#f2efe9" stroke="#c9c2b6"/><circle cx="96" cy="60" r="5" fill="#333"/><circle cx="112" cy="60" r="5" fill="#333"/><rect x="128" y="50" width="16" height="8" fill="#bbb"/>${L.type === 'goshiwon' ? '<text x="80" y="96" font-size="9" text-anchor="middle" fill="#666">공용 주방</text>' : ''}`;
  else if (v === 'bath') g = `<rect width="160" height="110" fill="#dfe8ec"/><path d="M0,0 H160 V110 H0 Z" fill="url(#tile${hs % 3})" opacity=".0"/><g stroke="#c6d3d9">${[20, 40, 60, 80, 100].map(y => `<path d="M0,${y} H160"/>`).join('')}${[20, 40, 60, 80, 100, 120, 140].map(x => `<path d="M${x},0 V110"/>`).join('')}</g><rect x="20" y="58" width="34" height="40" rx="6" fill="#fff" stroke="#b9c4ca"/><ellipse cx="37" cy="58" rx="16" ry="6" fill="#f4f7f8" stroke="#b9c4ca"/><rect x="74" y="34" width="34" height="26" rx="3" fill="#cfe3ee" stroke="#9fb0ba"/><rect x="78" y="62" width="26" height="12" fill="#fff" stroke="#b9c4ca"/><path d="M130,10 V60 M122,14 h16" stroke="#9aa4ad" stroke-width="3"/>`;
  else if (v === 'view') { const hi = (L.floor || 0) >= 8, sky = hi ? '#8ccaf0' : '#a9d8f2';
    g = `<rect width="160" height="110" fill="${wall}"/><rect x="18" y="12" width="124" height="80" fill="${sky}" stroke="#fff" stroke-width="4"/>${L.basement ? '<rect x="18" y="62" width="124" height="30" fill="#7a8a5a"/><rect x="40" y="58" width="12" height="20" fill="#555"/>' : hi ? '<path d="M22,92 v-30 h14 v-12 h14 v20 h12 v-28 h16 v40 h14 v-18 h14 v28 Z" fill="#7aa2bf"/>' : '<rect x="22" y="40" width="40" height="52" fill="#c9b8a6"/><rect x="70" y="50" width="34" height="42" fill="#b8a896"/><circle cx="122" cy="70" r="14" fill="#7fbf6a"/>'}<path d="M80,12 V92" stroke="#fff" stroke-width="3"/>`; }
  else g = `<rect width="160" height="110" fill="#a9d8f2"/><rect y="90" width="160" height="20" fill="#9a9a9a"/>${L.type === 'apt' || L.type === 'officetel' ? `<rect x="40" y="6" width="80" height="86" fill="#e4e6ea" stroke="#9aa"/>${Array.from({ length: 8 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<rect x="${46 + c * 15}" y="${12 + r * 10}" width="9" height="6" fill="#8fb6cf"/>`).join('')).join('')}` : `<rect x="34" y="30" width="92" height="62" fill="${['#c98f6e', '#d9c3a5', '#b8b0a6'][hs % 3]}" stroke="#8d7f6c"/>${Array.from({ length: 3 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<rect x="${42 + c * 21}" y="${38 + r * 17}" width="12" height="9" fill="#bfe3f7"/>`).join('')).join('')}<rect x="72" y="76" width="16" height="16" fill="#6b4a32"/>`}`;
  return `<svg class="room" viewBox="0 0 160 110" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`;
}
function openListing(id) {
  const L = G.realty.get(id);
  if (!L) { openRealty(rtTab); return; }
  if (modalMode !== 'listing' || modalArg !== id) { rtPh = 0; G.realty.view(id); }   // 최근 본 방
  const S = G.state(), reg = G.region() === 'ny', why = G.realty.why(), f = G.fmtMoney;
  const deal = L.deal === '매매' ? `매매가 ${f(L.priceN)}` : L.deal === '전세' ? `전세금 ${f(L.depN)}` : `보증금 ${f(L.depN)} · ${reg ? '렌트' : '월세'} ${f(L.rent)}`;
  const rows = [['매물 번호', L.no || '-'], ['종류', L.sub], ...(L.use && !reg ? [['건축물 용도', L.use]] : []), [reg ? '면적' : '전용면적', L.areaT], [reg ? '침실 · 욕실' : '방 · 욕실', `${reg && !L.rooms ? '스튜디오' : `${L.rooms || 1}개`} · ${L.baths ?? 1}개`],
    ['층', L.floorT], ['방향', L.dirT || (L.south ? '남향' : '-')], ['난방', L.heat || '-'], ...(L.entr ? [['현관 구조', L.entr]] : []), ['엘리베이터', L.elevator ? '있음' : '없음'],
    ['주차', L.parking ? '가능' : '불가'], ['반려동물', L.pets ? '가능' : '불가'], ['입주 가능일', L.moveIn || (L.instant ? '즉시 입주' : '협의')], [reg ? '지은 해' : '사용승인일', `${L.built}년${L.age <= 3 ? ' (신축)' : ` (${L.age}년 차)`}`]];
  const ph = L.photos || 5, k = ((rtPh % ph) + ph) % ph;
  const hero = `<div class="rt-hero">${photoArt(L, k, 360, 230)}<button type="button" class="rt-pv l" data-rph="-1" aria-label="이전 사진">‹</button><button type="button" class="rt-pv r" data-rph="1" aria-label="다음 사진">›</button>
    <b class="rt-cnt">${k + 1} / ${ph}</b>${L.agent ? '<span class="rt-badge">중개사 추천</span>' : ''}${L.gone ? '<span class="rt-badge gone">거래 완료</span>' : ''}</div>`;
  const mg = L.mgmt ? `월 ${f(L.mgmt)}${(L.mgmtIn || []).length ? ` · 포함: ${L.mgmtIn.join('·')}` : ''}${(L.mgmtOut || []).length ? ` · 별도: ${L.mgmtOut.join('·')}` : ''}` : `없음${(L.mgmtOut || []).length ? ` (${L.mgmtOut.join('·')} 별도)` : ''}`;
  const moneyNotes = [];
  if (!reg && L.claim) moneyNotes.push(`융자금 <b>${esc(L.claim)}</b> <small class="dim">(중개사 표기 — 등기부로 확인)</small>`);
  if (reg && L.deal === '월세') {
    if (L.free) moneyNotes.push(`🎁 1개월 무료 (13개월 계약) → 실질 ${f(Math.round(L.rent * 12 / 13))}/월`);
    moneyNotes.push(L.nofee ? '✅ NO FEE — 브로커 수수료 없음' : `브로커 수수료 약 ${f(Math.round(L.rent * 1.8))} (연 렌트의 15%)`);
    moneyNotes.push(`입주 비용: 첫 달 ${f(L.rent)} + 보증금 ${f(L.depN)}${L.nofee ? '' : ' + 브로커 수수료'}`);
    if (L.stab) moneyNotes.push('🏷 렌트 안정화 — 갱신 때 인상률이 법으로 묶여 있음');
  }
  if (reg && L.dom != null) moneyNotes.push(`올라온 지 ${L.dom}일${L.hist && L.hist.length > 1 ? ' · 최근 가격 인하' : ''}`);
  const sec = (t, h) => `<p class="sec-t rt-sec">${t}</p>${h}`;
  const notes = L.notes ? sec(L.agent ? '중개사와 함께 확인함' : '👀 직접 보고 온 것', L.notes.length ? `<ul class="rt-notes">${L.notes.map(n => `<li class="${n.bad ? 'bad' : 'good'}">${n.bad ? '✖' : '✔'} ${esc(n.t)}</li>`).join('')}</ul>` : '<p class="dim">사진 그대로였다.</p>') : '';
  const regR = L.reg ? `<p class="rt-reg${L.reg.risk >= .8 ? ' bad' : ''}">📄 등기부: ${L.reg.lien ? `근저당 ${f(L.reg.lien)}` : '근저당 없음'}${L.claim && L.claim === '없음' && L.reg.lien ? ' — <b>중개사 말과 다르다!</b>' : ''}${L.deal === '전세' ? ` · 전세가율 ${Math.round(L.reg.risk * 100)}%${L.reg.risk >= .8 ? ' — 깡통전세 위험! 보증보험 없이는 피하는 게 좋다' : ' — 안전한 편'}` : ''}</p>` : '';
  const opts = sec('옵션', `<div class="rt-ic">${(L.opts || []).map(o => `<span><i>${optIc(o)}</i>${esc(o)}</span>`).join('') || '<span class="dim">없음</span>'}</div>`);
  const secu = (L.secu || []).length ? sec(reg ? '보안' : '보안·안전 시설', `<div class="rt-ic">${L.secu.map(o => `<span><i>${SECU_IC[o] || '🛡'}</i>${esc(o)}</span>`).join('')}</div>`) : '';
  const amen = reg && (L.amen || []).length ? sec('편의 시설 (Amenities)', `<div class="rt-ic">${L.amen.map(o => `<span><i>✔</i>${esc(o)}</span>`).join('')}</div>`) : '';
  const K = L.kids || {}, kidT = [K.elem ? `🏫 ${esc(K.elem.name)} 도보 ${K.elem.min}분` : '', K.kinder ? `🧸 ${esc(K.kinder.name)} 도보 ${K.kinder.min}분` : ''].filter(Boolean).join(' · ');
  const loc = sec('위치', `${rtMini(L)}<p class="rt-loc">🚇 ${esc(L.stName || '지하철역')} · 도보 ${L.station}분<br>📍 ${esc(L.dong)}${L.dongTag ? ` · ${esc(L.dongTag)}` : ''}${kidT ? `<br>${kidT}${K.cho && L.type === 'apt' && G.region() === 'kr' ? ' · <b>초품아</b>' : ''}` : ''}${L.commute ? `<br>🏢 ${L.commute.to}까지 편도 약 ${L.commute.min}분 · ${L.commute.ic} ${esc(L.commute.label)}${L.commute.via ? ` (${esc(L.commute.via)})` : ''} ${L.commute.pt ? `· 출근·수업 ⚡+${L.commute.pt}` : '· 가까워서 부담 없음'}` : ''}${K.score >= 1.5 ? '<br><span class="dim">학교·유치원이 가까워 아이 키우는 부부가 많이 사는 동네</span>' : ''}</p>`);
  const near = (L.near || []).length ? sec('주변 편의 시설', `<div class="rt-near">${L.near.map(([n, m]) => `<span>${NEAR_IC[n] || '📍'} ${esc(n)} <b>${m}분</b></span>`).join('')}</div>`) : '';
  const cx = L.cx ? sec(reg ? '건물 정보' : '단지 정보', `<table class="rt-table">${[[reg ? '건물' : '단지', L.cx.name], [reg ? '유닛' : '세대수', `${L.cx.units.toLocaleString()}${reg ? '유닛' : '세대'}${L.cx.dongs > 1 ? ` · ${L.cx.dongs}개 동` : ''}`], ['최고층', `${L.cx.top}층`], [reg ? '지은 해' : '사용승인', `${L.cx.built}년`], ['주차', `세대당 ${L.cx.park}대`], [reg ? '개발사' : '건설사', L.cx.builder]].map(([a, b]) => `<tr><th>${a}</th><td>${esc(b)}</td></tr>`).join('')}</table>`) : '';
  const tmax = L.trades ? Math.max(...L.trades.map(t => t.v)) : 1;
  const trades = L.trades ? sec(reg ? '최근 거래' : `실거래가 (${L.deal === '전세' ? '전세' : '매매'})`, `<div class="rt-trades">${L.trades.map(t => `<div><span>${t.ago ? `${t.ago}개월 전` : '이번 달'} · ${t.f}층</span><i style="width:${Math.round(t.v / tmax * 100)}%"></i><b>${esc(f(t.v))}</b></div>`).join('')}</div>`) : '';
  const hist = reg && L.hist ? sec('가격 변동', `<table class="rt-table">${L.hist.map(h => `<tr><th>${h.ago}일 전</th><td>${esc(h.t)} · ${esc(f(h.v))}${L.deal === '월세' ? '/월' : ''}</td></tr>`).join('')}</table>`) : '';
  const O = L.office;
  const office = O ? sec('중개사무소', `<div class="rt-office"><span class="ro-ic">🏢</span><div><b>${esc(O.name)}</b><span class="dim">대표 ${esc(O.boss)} · ${esc(O.tel)}</span><span class="dim">최근 3개월 거래 ${O.deals}건 · 경력 ${O.years}년</span></div>
    <button type="button" data-rask="${L.id}"${L.asked || L.gone || why || S.ap < 1 ? ' disabled' : ''}>📞 문의 <small>⚡1</small></button></div>${L.asked ? `<p class="rt-ans">💬 ${esc(L.asked)}</p>` : ''}
    ${L.wasFake && !L.reported ? '<button type="button" class="rt-report" data-rrep="' + L.id + '">🚨 허위매물 신고</button>' : L.reported ? '<p class="dim">🚨 신고 완료</p>' : ''}`) : '';
  const sim = G.realty.list().filter(x => x.id !== L.id && x.type === L.type && !x.gone).slice(0, 6);
  const simH = sim.length ? sec('비슷한 매물', `<div class="rt-sim">${sim.map(x => `<button type="button" data-lst="${x.id}"><span>${roomArt(x, 120, 80)}</span><b>${esc(x.price)}</b><small>${esc(x.dong)} · ${esc(x.areaT.replace(/^전용 /, ''))}</small></button>`).join('')}</div>`) : '';
  const off = !!why || L.gone, block = G.realty.actWhy();
  showModal('listing', `${L.dong} · ${L.sub}`, `${hero}
    <div class="rt-pricebox"><b>${esc(L.price)}</b><span>${esc(deal)}</span><span>관리비 ${esc(mg)}</span>${moneyNotes.map(n => `<span class="rt-mn">${n}</span>`).join('')}<span class="rt-tags">${rtTags(L)}</span></div>
    <p class="rt-title">${esc(L.title || L.sub)}</p>
    <p class="rt-say">💬 중개사: "${esc(L.say)}"</p>
    ${notes}${regR}
    ${sec('매물 정보', `<table class="rt-table">${rows.map(([a, b]) => `<tr><th>${a}</th><td>${esc(b)}</td></tr>`).join('')}</table>`)}
    ${opts}${amen}${secu}${loc}${near}${cx}${trades}${hist}${office}${simH}
    <div class="rt-acts">
      <button type="button" data-rfav="${L.id}">${L.fav ? '♥' : '♡'}</button>
      ${L.canReg ? `<button type="button" data-rreg="${L.id}"${L.reg || off || S.ap < G.realty.regPt ? ' disabled' : ''}>📄 등기부 <small>⚡${G.realty.regPt}</small></button>` : ''}
      <button type="button" data-rvisit="${L.id}"${L.seen || off || block || S.ap < G.realty.visitPt ? ' disabled' : ''}>🏃 보러 가기 <small>⚡${G.realty.visitPt}</small></button>
      <button type="button" class="hot" data-rsign="${L.id}"${off ? ' disabled' : ''}>✍ 계약</button>
    </div>
    ${block && !L.gone ? `<p class="rt-warn">⏰ ${esc(block)}</p>` : ''}
    <p class="hint">보러 가면 사진에 없는 하자(곰팡이·소음·외풍 …)나 좋은 점이 보인다. 허위매물은 📞 문의나 방문에서 "방금 나갔어요". 안 보고 계약하면 계약금을 날릴 수도 있다.${L.canReg ? ' 전세·매매는 등기부로 근저당을 꼭 확인할 것 — 중개사가 적은 융자금이 틀릴 수 있다.' : ''}</p>`, true, id);
}
function openContract(id) {
  const L = G.realty.get(id), q = L && G.realty.quote(id, ctOpt);
  if (!q) { openRealty(rtTab); return; }
  const mv = G.realty.moves(), reg = G.region() === 'ny', f = G.fmtMoney;
  const payLabel = L.deal === '매매' ? '매매가' : L.deal === '전세' ? '전세 보증금' : reg ? '보증금 (한 달 치)' : '보증금';
  const rows = [[payLabel, q.pay], ...(q.loan ? [[`${q.loanLabel} (연 ${(q.loanRate * 100).toFixed(1)}%)`, -q.loan]] : []), ['중개수수료', q.fee], [`이사비 · ${q.moveLabel}`, q.moveCost], ...(q.insure ? [['전세보증보험', q.insure]] : [])];
  const opt = (key, val, label, on) => `<button type="button" data-copt="${key}:${val}" aria-pressed="${on}">${label}</button>`;
  showModal('contract', '✍ 계약서', `<p class="rt-ct-h"><b>${esc(L.dong)} ${esc(L.sub)}</b><span>${esc(L.price)}</span></p>
    <p class="sec-t">이사 방법</p><div class="rt-chips wrap">${Object.entries(mv).map(([k, m]) => opt('move', k, `${m.label} · ⚡${m.pt} · ${f(Math.round(m.cost[0] + (m.cost[1] - m.cost[0]) * Math.min(1, L.area / 100)))}`, ctOpt.move === k)).join('')}</div>
    ${q.canLoan ? `<p class="sec-t">대출</p><div class="rt-chips wrap">${opt('loan', 1, `${q.loanLabel} 받기 (${L.deal === '매매' ? '집값의 ' : '보증금의 '}${L.deal === '매매' ? (reg ? 80 : 70) : 80}%)`, ctOpt.loan)}${opt('loan', 0, '대출 없이', !ctOpt.loan)}</div>` : ''}
    ${q.canInsure ? `<p class="sec-t">전세보증보험</p><div class="rt-chips wrap">${opt('insure', 1, '가입 (보증금을 지켜 준다)', ctOpt.insure)}${opt('insure', 0, '가입 안 함', !ctOpt.insure)}</div>` : ''}
    <table class="rt-table rt-bill">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td class="${v < 0 ? 'p' : ''}">${v < 0 ? '−' : ''}${f(Math.abs(v))}</td></tr>`).join('')}
      <tr class="sum"><th>지금 낼 돈</th><td>${f(q.now)}</td></tr>${q.refund ? `<tr><th>지금 집에서 돌려받는 돈</th><td class="p">+${f(q.refund)}</td></tr>` : ''}
      <tr><th>계약 뒤 잔고</th><td class="${q.after < 0 ? 'm' : ''}">${f(q.after)}</td></tr>
      <tr class="sum"><th>매달 나가는 돈</th><td>${f(q.monthly)}${q.interest ? ` <small>(이자 ${f(q.interest)} 포함)</small>` : ''}</td></tr>
      ${q.commute ? `<tr><th>통근</th><td>${q.commute.to}까지 편도 ${q.commute.min}분 · ⚡+${q.commute.pt}</td></tr>` : ''}</table>
    ${!q.visited ? '<p class="rt-warn">⚠ 아직 직접 보지 않았다. 허위매물이면 계약금을 날린다.</p>' : ''}
    ${L.canReg && !L.reg && L.deal === '전세' ? '<p class="rt-warn">⚠ 등기부를 확인하지 않았다.</p>' : ''}
    <div class="choices"><button type="button" class="hot" data-cgo="${id}"${q.ok ? '' : ' disabled'}>✍ 계약하고 이사 <small>⚡${q.movePt}</small></button>${q.why ? `<p class="hint">${esc(q.why)}</p>` : ''}</div>`, true, id);
}
/* 🏦 은행 · 📷 앨범 */
function openBank() {
  const b = G.budget(), f = G.fmtMoney;
  showModal('bank', '🏦 은행', `<div class="bk-bal"><span>잔고</span><b class="${b.money < 0 ? 'neg' : ''}">${f(b.money)}</b></div>
    <div class="bk-assets"><div><span>맡긴 보증금</span><b>${b.dep ? f(b.dep) : '—'}</b></div><div><span>내 집</span><b>${b.owned ? f(b.owned) : '—'}</b></div><div><span>대출</span><b class="${b.loan ? 'neg' : ''}">${b.loan ? f(b.loan) : '없음'}</b></div></div>
    <p class="sec-t">한 달 돈 흐름</p>
    <div class="bk-lines">${b.lines.length ? b.lines.map(([k, v]) => `<div><span>${esc(k)}</span><b class="${v < 0 ? 'neg' : 'pos'}">${v < 0 ? '−' : '+'}${f(Math.abs(v))}</b></div>`).join('') : '<p class="dim">고정으로 들어오고 나가는 돈이 없다.</p>'}</div>
    <div class="bk-net"><span>한 달에</span><b class="${b.net < 0 ? 'neg' : 'pos'}">${b.net < 0 ? '−' : '+'}${f(Math.abs(b.net))}</b></div>
    <p class="hint">매달 1일에 월급이 들어오고 월세·관리비·생활비·대출 이자가 빠져나간다. 쇼핑·술값 같은 그때그때 쓰는 돈은 빼고.</p>`);
}
function openAlbum() {
  const M = G.state().memories.slice().reverse();
  showModal('album', '📷 앨범', M.length ? `<p class="hint">추억 ${M.length}개 — 최근 것부터</p><div class="al">${M.map(m => `<div class="al-i"><span class="al-a">${m.age}살 · ${esc(m.season || '')} ${m.wx ? wxIcon(m.wx) : ''}</span><p>${esc(m.text)}</p></div>`).join('')}</div>` : '<p class="empty">아직 추억이 없다.</p>');
}
// 폰 안 클릭 (처리했으면 true)
function phoneClick(b, d) {
  if (d.app) { openPhone(d.app); return true; }
  if (d.dcat) { dlvCat = d.dcat; openDelivery(); return true; }
  if (d.jtab) { openJobs(d.jtab); return true; }
  if (d.jcat) { jbCat = d.jcat; openJobs('list'); return true; }
  if ('jok' in d) { jbOk = !jbOk; openJobs('list'); return true; }
  if (d.post) { openPosting(d.post); return true; }
  if (d.japply) { G.jobsite.apply(d.japply); return true; }
  if ('jpolish' in d) { G.jobsite.polish(); return true; }
  if (d.jacc) { G.jobsite.accept(+d.jacc); openJobs('me'); return true; }
  if (d.jdec) { G.jobsite.decline(+d.jdec); return true; }
  if (d.store) { openStore(d.store); return true; }
  if (d.order) { const [id, ix] = d.order.split(':'); G.food.order(id, +ix); closeModal(); return true; }
  if (d.rtab) { openRealty(d.rtab); return true; }
  if (d.rf) { const [k, v] = d.rf.split(':'); rtF[k] = v; openRealty('list'); return true; }
  if (d.rx) { rtF.x[d.rx] = !rtF.x[d.rx]; openRealty('list'); return true; }
  if (d.rview) { rtView = d.rview; openRealty('list'); return true; }
  if ('rdong' in d) { rtF.dong = d.rdong; if (d.rdong) rtView = 'list'; openRealty('list'); return true; }
  if (d.rph) { rtPh += +d.rph; openListing(modalArg); return true; }
  if (d.rask) { G.realty.ask(d.rask); return true; }
  if (d.rrep) { G.realty.report(d.rrep); return true; }
  if (d.lst) { openListing(d.lst); return true; }
  if (d.rfav) { G.realty.fav(d.rfav); return true; }
  if (d.rvisit) { G.realty.visit(d.rvisit); return true; }
  if (d.rreg) { G.realty.registry(d.rreg); return true; }
  if (d.rsign) { ctOpt = { move: 'truck', loan: false, insure: true }; openContract(d.rsign); return true; }
  if (d.copt) { const [k, v] = d.copt.split(':'); ctOpt[k] = k === 'move' ? v : v === '1'; openContract(modalArg); return true; }
  if (d.cgo) { G.realty.sign(d.cgo); if (modalMode === 'contract') { rtTab = 'home'; openRealty('home'); } return true; }
  if ('parents' in d) { G.realty.toParents(); openRealty('home'); return true; }
  return false;
}
// 방 사진 (매물마다 다른 그림): 실내 — 벽·바닥·창(반지하는 위쪽 작은 창, 옥탑은 기운 천장)·가구(종류마다) / 주택은 바깥 모습
function roomArt(L, w, h) {
  const hs = [...String(L.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const wall = L.basement ? '#a39b8a' : ['#efe7da', '#e6edf2', '#f3ece4', '#ebe6f2', '#f1efe8'][hs % 5], wall2 = L.basement ? '#8d8574' : '#d9d0c2';
  const floor = L.basement ? '#776b5a' : ['#c9a27a', '#b88a5e', '#d8c3a5', '#a07850'][(hs >>> 3) % 4];
  const sky = (L.floor || 0) >= 10 ? '#8ccaf0' : '#a9d8f2';
  let g;
  if (L.type === 'house') {
    const roof = ['#a5523c', '#5b6b7a', '#7a4a3a'][hs % 3];
    g = `<rect width="160" height="110" fill="${sky}"/><rect y="78" width="160" height="32" fill="#8cc06a"/><circle cx="138" cy="60" r="16" fill="#6aa354"/><rect x="135" y="66" width="5" height="16" fill="#7a5a3a"/>
      <rect x="34" y="44" width="78" height="44" fill="${wall}" stroke="#8d7f6c"/><path d="M28,46 L73,18 L118,46 Z" fill="${roof}"/><rect x="66" y="62" width="14" height="26" fill="#6b4a32"/>
      <rect x="42" y="54" width="16" height="13" fill="#bfe3f7" stroke="#8d7f6c"/><rect x="88" y="54" width="16" height="13" fill="#bfe3f7" stroke="#8d7f6c"/><rect x="0" y="86" width="160" height="4" fill="#c8b08a"/>`;
  } else {
    const winW = L.type === 'goshiwon' ? (L.win ? 20 : 0) : L.type === 'apt' ? 70 : L.type === 'officetel' ? 56 : L.south ? 46 : 36;
    const win = L.basement ? `<rect x="58" y="6" width="44" height="12" fill="#c9d6dc"/><path d="M58,12 H102 M69,6 V18 M80,6 V18 M91,6 V18" stroke="#555" stroke-width="1"/><rect x="58" y="15" width="44" height="3" fill="#6d7f4f" opacity=".6"/>`
      : winW ? `<rect x="${80 - winW / 2}" y="14" width="${winW}" height="34" fill="${sky}" stroke="#fff" stroke-width="2"/>${(L.floor || 0) >= 6 ? `<path d="M${80 - winW / 2 + 2},48 v-10 h6 v-6 h7 v9 h6 v-12 h8 v19 Z" fill="#7aa2bf" opacity=".7"/>` : `<circle cx="${80 + winW / 4}" cy="40" r="7" fill="#7fbf6a"/>`}<path d="M80,14 V48" stroke="#fff" stroke-width="1.5"/>` : '';
    const roof = L.rooftop ? `<path d="M0,0 H160 V10 L0,30 Z" fill="${wall2}"/>` : '';
    const light = L.south && !L.basement ? `<path d="M${80 - winW / 2},48 L${60 - winW / 2},110 L${120 + winW / 2},110 L${80 + winW / 2},48 Z" fill="#fff3c4" opacity=".35"/>` : '';
    const F = {
      goshiwon: `<rect x="96" y="60" width="52" height="22" rx="3" fill="#7d93b5"/><rect x="96" y="56" width="14" height="8" rx="2" fill="#eee"/><rect x="14" y="56" width="34" height="5" fill="#8a6a4a"/><rect x="16" y="61" width="3" height="20" fill="#6d5238"/><rect x="43" y="61" width="3" height="20" fill="#6d5238"/>`,
      oneroom: `<rect x="96" y="62" width="58" height="22" rx="3" fill="#8fa7c8"/><rect x="98" y="57" width="16" height="8" rx="2" fill="#f4f4f4"/><rect x="8" y="50" width="40" height="30" fill="#d9d4cc"/><rect x="8" y="50" width="40" height="5" fill="#9aa4ad"/><circle cx="18" cy="52" r="2" fill="#555"/><circle cx="28" cy="52" r="2" fill="#555"/>${L.duplex ? '<rect x="0" y="28" width="60" height="5" fill="#8a6a4a"/><path d="M60,33 L70,80" stroke="#8a6a4a" stroke-width="3"/>' : ''}`,
      officetel: `<rect x="100" y="62" width="54" height="22" rx="3" fill="#c9ccd6"/><rect x="102" y="57" width="16" height="8" rx="2" fill="#fff"/><rect x="6" y="54" width="46" height="26" fill="#f2f2f2"/><rect x="6" y="54" width="46" height="4" fill="#333"/><rect x="58" y="64" width="22" height="3" fill="#333"/><rect x="66" y="67" width="2" height="14" fill="#333"/>`,
      villa: `<rect x="96" y="66" width="52" height="16" rx="4" fill="#a87b5a"/><rect x="96" y="60" width="52" height="8" rx="4" fill="#bf9070"/><rect x="10" y="30" width="26" height="52" fill="${wall2}"/><rect x="13" y="33" width="20" height="49" fill="#8a6a4a"/><circle cx="29" cy="58" r="1.5" fill="#e8d8a0"/>`,
      apt: `<rect x="92" y="66" width="62" height="16" rx="4" fill="#7d8c9b"/><rect x="92" y="59" width="62" height="9" rx="4" fill="#8f9eac"/><rect x="10" y="50" width="38" height="22" fill="#222"/><rect x="12" y="52" width="34" height="18" fill="#3b4a5a"/><rect x="24" y="72" width="10" height="6" fill="#555"/>${winW >= 70 ? '<path d="M45,44 H115" stroke="#eee" stroke-width="2"/><path d="M50,36 V48 M60,36 V48 M70,36 V48 M80,36 V48 M90,36 V48 M100,36 V48 M110,36 V48" stroke="#eee" stroke-width="1"/>' : ''}`,
    }[L.type] || '';
    g = `<rect width="160" height="110" fill="${wall}"/>${roof}${win}${light}<path d="M0,82 H160 V110 H0 Z" fill="${floor}"/><path d="M0,82 L-20,110 M40,82 L28,110 M80,82 V110 M120,82 L132,110" stroke="rgba(0,0,0,.08)"/>${F}
      ${L.basement ? '<rect width="160" height="110" fill="#2b2618" opacity=".18"/>' : ''}`;
  }
  return `<svg class="room" viewBox="0 0 160 110" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`;
}

/* ---------- 입력 ---------- */
$('#where').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.a) { const a = G.actionList().find(x => x.id === d.a); if (a && G.needsSubject(a)) (a.id === 'shop' ? openShop() : a.id === 'houseHunt' ? openPhone('realty') : openStudy()); else if ((G.actPreview(d.a) || {}).dice) openAct(d.a); else G.doAction(d.a); }
  else if (d.pl) { mapMode = null; G.goPlace(d.pl); }
  else if ('leave' in d) G.leavePlace();
  else if ('map' in d) openMap();
  else if (d.mapmode) { mapMode = d.mapmode; render(G.state()); }
  else if (mapCtl(d)) return;
  else if ('browse' in d) startBrowse(null);
  else if (d.food) openFood(d.food);
  else if ('dlv' in d) openPhone('delivery');
  else if ('endco' in d) G.endCompany();
  else if (d.enjoy) G.interact(d.enjoy, 'enjoy');
  else if (d.hp) {
    const h = G.here().find(x => x.key === d.hp);
    if (!h) return;
    if (h.stranger) startBrowse(h.key); else { personFrom = 'here'; openPerson(h.key); }
  }
});
$('#meAv').addEventListener('click', openMe);
$('#bagBtn').addEventListener('click', () => openBag());
$('#ageUp').addEventListener('click', () => {
  const S = G.state();
  if (S.ended) { draft = null; openCreate(true); return; }
  const ph = G.phase();
  if (ph === 'story') G.storyNext(); else if (ph === 'adult') G.sleep(); else G.nextTurn();
});
$('#flow').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const f = b.dataset.flow;
  if (f === 'duty') G.doDuty(); else G.skip(f);
});
$('#phoneBtn').addEventListener('click', () => openPhone('home'));
$('#mBack').addEventListener('click', phoneBack);
$('#mapBtn').addEventListener('click', openMap);
$('#crimeBtn').addEventListener('click', openCrime);
$('#restart').addEventListener('click', confirmRestart);
$('#slotsBtn').addEventListener('click', openSlots);
$('#mClose').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal && !$('#mClose').hidden) closeModal(); });
mBody.addEventListener('click', e => {
  const bub = e.target.closest('.rt-bub');   // 🏠 매물 지도의 동네 말풍선 (SVG)
  if (bub) { rtF.dong = bub.dataset.rdong; rtView = 'list'; openRealty('list'); return; }
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (modalMode === 'create') { createClick(b); return; }
  if ('ntest' in d) { openNightTest(); return; }   // 💾 저장 칸 → 🧪 그날 밤 테스트
  if (modalMode === 'ntest') { if ('ntgo' in d) runNightTest(); return; }
  if (modalMode === 'quick') { quickClick(b); return; }
  if (modalMode === 'map') { if (d.mapmode) { mapMode = d.mapmode; openMap(); } else if (mapCtl(d)) {} else if (d.pl) { G.goPlace(d.pl); mapMode = null; if (modalMode === 'map') closeModal(); } return; }   // 지도: 핀을 누르면 이동
  if (inPhone && phoneClick(b, d)) return;   // 📱 폰 (홈 화면·앱)
  if (modalMode === 'food') {   // 🍽 먹기·사기·집밥
    if (d.ftab) openFood(d.ftab);
    else if (d.feat) { G.food.eat(d.feat); closeModal(); }
    else if (d.fbuy) G.food.buy(d.fbuy);
    else if (d.fhome) { G.food.home(d.fhome); closeModal(); }
    else if ('dlv' in d) openPhone('delivery');
    return;
  }
  if (modalMode === 'bag') { if (d.beat) G.food.eatBag(+d.beat); else if (d.bdrop) G.food.drop(+d.bdrop); return; }
  if ('intro' in d) { G.ackIntro(); return; }
  if ('rok' in d) { G.ackReport(); return; }
  if (modalMode === 'apply') {
    if ('apadd' in d) { applyDraft.rows.push({ u: '', d: '', type: '교과' }); openApply(); }
    else if ('apgo' in d) { const list = applyDraft.rows.filter(r => r.u && r.d); applyDraft = null; G.submitApply(list); }
    else if ('apskip' in d) { applyDraft = null; G.submitApply([]); }
    return;
  }
  if (modalMode === 'slots') {
    if (d.sl) { G.useSlot(+d.sl); closeModal(); logState = { id: null, n: 0 }; render(G.state()); }
    else if (d.sv) { G.saveTo(+d.sv); openSlots(); }
    else if (d.snew) { G.useSlot(+d.snew); draft = null; openCreate(false); }   // 빈 칸으로 옮겨서 새로 시작 (닫을 수 없음 — 이 칸엔 아직 인생이 없음)
    else if (d.sdel) { G.deleteSlot(+d.sdel); openSlots(); }
    return;
  }
  if (modalMode === 'browse') {
    if ('brnext' in d) { openBrowse(browseIx + 1); return; }
    if ('brprev' in d) { openBrowse(browseIx - 1); return; }
    if (d.brgo != null) { browseGrid = false; openBrowse(+d.brgo); return; }
    if ('brgrid' in d) { browseGrid = !browseGrid; openBrowse(browseIx); return; }
    if (d.brpass) { G.passBy(d.brpass); return; }   // 다시 그리기는 render → openBrowse (같은 자리에 다음 사람)
    if ('brmore' in d) { brCache.clear(); browseIx = 0; browseGrid = false; G.browseMore(); return; }
  }
  if (d.s) { openAct('study', d.s === 'all' ? null : d.s); return; }
  if ('roll' in d && modalMode === 'act') { rollAct(); return; }
  if ('actok' in d && modalMode === 'act') { closeModal(); return; }
  if (d.shop != null) { closeModal(); G.doAction('shop', +d.shop); return; }
  if ('shopskip' in d) { closeModal(); G.doAction('shop'); return; }
  if (d.dd != null) { const pid = modalArg; G.setDateOutfit(+d.dd); G.interact(pid, 'date'); dlgBack = G.state().pending.some(x => x.dlg) ? pid : null; return; }
  if (d.c != null) G.choose(+d.c);
  else if (d.full) { fullView = fullView === d.full ? null : d.full; if (d.full === 'me') openMe(); else openPerson(d.full); }
  else if (d.pv) { personFrom = 'people'; openPerson(d.pv); }
  else if ('acq' in d) { showAcq = !showAcq; openPeople(); }
  else if (d.pf) { peopleFilter = d.pf; openPeople(); }
  else if (d.pview) { peopleView = d.pview; openPeople(); }
  else if (d.i === 'date' && G.dateOutfits().length) openDateDress(modalArg);
  else if (d.i) { const pid = modalArg; G.interact(pid, d.i); dlgBack = G.state().pending.some(x => x.dlg) ? pid : null; }
  else if (d.talk) { const id = G.talkTo(d.talk); if (id && !G.state().pending.length) { personFrom = 'here'; openPerson(id); } }
  else if (d.ask) { const id = G.askStranger(d.ask); if (id && !G.state().pending.length) { personFrom = 'here'; openPerson(id); } }
  else if ('back' in d) { if (modalMode === 'browse' || personFrom === 'here') closeModal(); else openPeople(); }
  else if (d.j) G.applyJob(d.j);
  else if (d.k) G.commitCrime(d.k);
  else if ('quit' in d) G.quitJob();
  else if ('new' in d) { draft = null; openCreate(true); }
  else if ('cancel' in d) closeModal();
});
// 둘러보기: 좌우 스와이프로 넘기기
let swipe0 = null;
mBody.addEventListener('touchstart', e => { swipe0 = modalMode === 'browse' && !browseGrid && e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null; }, { passive: true });
mBody.addEventListener('touchend', e => {
  if (!swipe0) return;
  const t = e.changedTouches[0], dx = t.clientX - swipe0[0], dy = t.clientY - swipe0[1];
  swipe0 = null;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) openBrowse(browseIx + (dx < 0 ? 1 : -1));
});
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target && e.target.tagName === 'INPUT')) return;
  if (!sceneEl.hidden) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); nextScene(); } return; }
  if (modalMode === 'event' && /^[1-9]$/.test(e.key)) { G.choose(+e.key - 1); e.preventDefault(); }
  else if (modalMode === 'browse' && !browseGrid && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { openBrowse(browseIx + (e.key === 'ArrowRight' ? 1 : -1)); e.preventDefault(); }
  else if (e.key === 'Escape' && !modal.hidden && !$('#mClose').hidden) closeModal();
});

function toggleUI(show) {
  app.classList.toggle('off', !show);
  $('#showWrap').hidden = show;
}
$('#hide').addEventListener('click', () => toggleUI(false));
$('#show').addEventListener('click', () => toggleUI(true));
$('#sky').addEventListener('click', () => { if (app.classList.contains('off')) toggleUI(true); });

/* ---------- 시작 ---------- */
WeatherBG.init($('#sky'));
if (window.SceneBG) SceneBG.init($('#backdrop'));
WeatherBG.setWeather(WX.partly.p, true);
// 뉴욕 인생: 화면에 나오는 모든 글의 한국 낱말·원화 금액을 뉴욕식으로 (data/region.js dict, 조사 자동 — js/game.js loc)
//   그리는 쪽은 그대로 두고, 화면에 붙는 글 조각마다 바꿈 (한 번 바꾼 글은 다시 바뀌지 않음: 국어 → 영어 → 스페인어처럼 이어서 바뀌지 않게)
const LOCD = new WeakMap();   // 글 조각 → 바꾼 결과
function locText(n) {
  const t = n.nodeValue;
  if (!t || LOCD.get(n) === t || !/[가-힣\d]/.test(t)) return;
  const u = G.loc(t);
  LOCD.set(n, u);
  if (u !== t) n.nodeValue = u;
}
function locTree(root) {
  if (G.region() === 'kr' || !root) return;
  if (root.nodeType === 3) { locText(root); return; }
  if (root.nodeType !== 1 || root.closest && root.closest('script,style')) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) locText(n);
}
new MutationObserver(ms => {
  if (G.region() === 'kr') return;
  for (const m of ms) {
    if (m.type === 'characterData') locText(m.target);
    else for (const n of m.addedNodes) locTree(n);
  }
}).observe(document.body, { childList: true, subtree: true, characterData: true });
G.subscribe(S => { if (G.region() !== 'kr') locTree(document.body); });   // 나라가 바뀐 뒤 처음 그릴 때 이미 있던 글까지
G.subscribe(render);
window.LlifeUI = { roomArt };   // 개발용 (방 그림 미리보기)
if (!G.init()) openCreate(false);
})();
