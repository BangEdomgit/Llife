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
const bar = v => { const n = Math.round(v / 10); return '■'.repeat(n) + '□'.repeat(10 - n); };
const mini = v => { const n = Math.round(v / 20); return '■'.repeat(n) + '□'.repeat(5 - n); };
const wxIcon = k => (WX[k] && WX[k].icon) || '';
const genderKo = g => g === 'm' ? '남' : '여';
const isMoney = k => k === 'money';
const pbar = p => { const n = Math.round(p * 5); return '▰'.repeat(n) + '▱'.repeat(5 - n); };
// 아바타 크기: 관계 목록 32×42 / 장소 48×64 / 상세·이벤트 60×80
const av = (p, size) => window.Avatar ? Avatar.render(G.look(p), size, { age: G.npcAge(p), libido: G.canSex(p) ? p.libido || 0 : 0, fig: G.figure(p) }) : '';   // 화면 속 사람은 늘 나를 대하고 있음 → 나를 향한 성욕(p.libido)만큼 표정이 달라짐 (어른 이성만). 체형 수치 → 전신과 같은 어깨·가슴
// 누르면 전신으로 펼쳐지는 초상화 (20살부터 키·허리·골반 수치가 실루엣에 반영)
const avBtn = (key, html) => `<button type="button" class="av-btn" data-full="${key}" aria-label="${fullView === key ? '접기' : '전신 보기'}" title="${fullView === key ? '접기' : '전신 보기'}">${html}</button>`;
// 전신: 성격에 따라 기본 자세가 다름 (직진형·낙천형 한 손 허리, 냉철형·무심형 팔짱)
const fullAv = (look, age, fig, personality) => window.Avatar ? `<div class="p-full">${Avatar.render(look, 132, { age, full: age >= 20 && fig ? fig : true, personality })}</div>` : '';
function abHTML(k, v) {
  const g = G.gradeInfo(v);
  return `<span class="ab" title="${v}"><span>${G.LABEL[k]}</span><span class="g g-${g.letter}">${g.letter}</span><span class="pb">${pbar(g.pct)}</span></span>`;
}

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
      el.textContent = `── ${e.age}살 ` + '─'.repeat(80);
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
// 행동력 칸: 어른은 12칸 + 새벽 6칸(빨강), 학교 턴은 그 턴의 칸
function apDots(ti) {
  if (ti.phase === 'adult') {
    let out = '';
    for (let i = 0; i < ti.day + ti.lateMax; i++) { if (i === ti.day) out += ' '; out += `<b class="${i >= ti.day ? 'late' : ''}${i < ti.used ? ' u' : ''}">${i < ti.used ? '●' : '○'}</b>`; }
    return out;
  }
  if (ti.apMax) return Array.from({ length: ti.apMax }, (_, i) => i < ti.apMax - ti.ap ? '●' : '○').join('');
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
  $('#trait').textContent = `[${tr.label}]`;
  $('#trait').title = tr.desc;
  const money = $('#money');
  money.textContent = G.fmtMoney(S.money);
  money.classList.toggle('neg', S.money < 0);
  // 성욕은 대상이 있을 때만: 가장 높은 대상의 이름과 함께
  const lt = G.lustTarget();
  $('#conds').innerHTML = G.conds.filter(k => k !== 'libido' || (S.age >= G.config.sexMinAge && lt)).map(k =>
    `<span>${G.LABEL[k]}${k === 'libido' ? `<small class="lt">→${esc(lt.name)}</small>` : ''}</span><span class="bar${(k === 'libido' ? S.stats[k] >= 60 : S.stats[k] < 25) ? ' low' : ''}">${bar(S.stats[k])}</span><span class="num">${S.stats[k]}</span>`).join('');
  $('#abils').innerHTML = G.abilities.map(k => abHTML(k, S.stats[k])).join('');

  renderLog(S);

  const ti = G.timeInfo();
  $('#season').textContent = timeText(ti);
  $('#ap').innerHTML = apDots(ti);
  $('#apNum').textContent = ti.phase === 'adult' ? `⚡ ${Math.max(0, ti.day - ti.used)}/${ti.day}${ti.late ? ' 새벽' : ''}${ti.fatigue >= 3 ? ` · 피로 ${ti.fatigue}` : ''}` : ti.apMax ? `⚡ ${S.ap}/${ti.apMax}` : '';
  $("#peopleBtn").textContent = "👥 관계";
  $('#jobBtn').hidden = S.age < 16;
  $('#crimeBtn').hidden = G.crimes().length === 0 && S.jail === 0;

  renderWhere(S);

  // 아래 큰 버튼: 단계마다 다름 (이야기 계속 / 다음 주 / 잠자기) + 어른은 밥·출근·넘기기 줄
  const ageBtn = $('#ageUp'), flow = $('#flow');
  const wait = !S.ended && (S.pending.length > 0 || !!S.report);
  ageBtn.textContent = S.ended ? '↻ 새 인생 시작' : ti.phase === 'story' ? '▶ 계속' : ti.phase === 'adult' ? `😴 잠자기 (오늘 끝내기)` : S.ap > 0 ? `⏭ 다음 주로 (남은 ${S.ap}칸은 쉬기)` : '▶ 다음 주';
  ageBtn.disabled = wait;
  if (ti.phase === 'adult' && !S.ended) {
    const d = ti.duty;
    flow.hidden = false;
    flow.innerHTML = (d ? `<button type="button" data-flow="duty"${wait ? ' disabled' : ''}>${d.id === 'work' ? '💼' : d.id === 'class' ? '🎓' : '🪖'} ${d.label} <small>${d.ap}칸</small></button>` : '') +
      `<button type="button" data-flow="eat"${wait || S.ap <= 0 || d ? ' disabled' : ''}>🍚 밥 먹기 <small>${ti.meals}끼</small></button>` +
      `<button type="button" data-flow="week"${wait ? ' disabled' : ''}>⏭ 이번 주 넘기기</button><button type="button" data-flow="month"${wait ? ' disabled' : ''}>⏩ 이번 달 넘기기</button><button type="button" data-flow="event"${wait ? ' disabled' : ''}>⏬ 다음 일까지</button>`;
  } else { flow.hidden = true; flow.innerHTML = ''; }

  // 배경: 지금 날씨와 시간대 (어른은 시계를 따라 하늘이 바뀜)
  if (bg.w !== S.weather) { WeatherBG.setWeather(WX[S.weather].p, bg.w === null); bg.w = S.weather; }
  const sky = S.sky ?? S.time;
  if (bg.t !== sky) { WeatherBG.setTime(sky, bg.t === null); bg.t = sky; }

  maybeScene(S);
  // 모달 (이벤트 → 성적표·합격 → 원서)
  if (S.intro) openIntro();
  else if (S.pending.length) openEvent();
  else if (S.report) openReport();
  else if (S.apply) openApply();
  else if (S.ended && endingFor !== S.id) { endingFor = S.id; openEnding(); }
  else if (modalMode === 'event') closeModal();
  else if (modalMode === 'people') openPeople();
  else if (modalMode === 'person') openPerson(modalArg);
  else if (modalMode === 'stranger') openStranger(modalArg);
  else if (modalMode === 'jobs') openJobs();
  else if (modalMode === 'crime') openCrime();
  else if (modalMode === 'me') openMe();
  else if (modalMode === 'study') closeModal();
}

/* ---------- 하단: 장소 고르기 → 거기 있는 사람 + 할 수 있는 것 ---------- */
function actButtons(acts) {
  return acts.map(a => {
    const c = G.costOf(a);
    return `<button type="button" class="act" data-a="${a.id}"${G.canDo(a) ? '' : ' disabled'}${c ? ` title="${G.fmtMoney(c)}"` : ''}><span class="ic" aria-hidden="true">${a.icon}</span>${a.label}${c ? `<small>${G.fmtMoney(c)}</small>` : ''}</button>`;
  }).join('');
}
const ageBand = age => age < 13 ? '어린이' : age < 20 ? `${age < 16 ? '10대 중반' : '10대 후반'}` : `${Math.floor(age / 10) * 10}대${age % 10 < 4 ? ' 초반' : age % 10 < 7 ? ' 중반' : ' 후반'}`;
function hereRow(h) {
  const p = h.p;
  const who = h.stranger ? `<b>처음 보는 사람</b><span class="dim">${ageBand(G.npcAge(p))} ${genderKo(p.gender)}</span>`
    : `<b>${esc(G.pname(p))}</b><span class="dim">${G.npcAge(p)}살 · ${esc(G.relLabel(p))}</span>`;
  return `<button type="button" class="hp${h.used ? ' used' : ''}" data-hp="${h.key}" title="${esc(h.doing)}">${av(p, 48)}
    <span class="hw">${who}</span><span class="hd">${h.used ? '이야기함' : esc(h.doing)}</span></button>`;
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
    const adult = ti.phase === 'adult';
    const head = adult ? `<p class="sec-t">지금 ${esc(ti.zone)} <span class="dim">· 같은 구역은 0칸, 다른 구역 1칸, 여행지 2칸</span></p>`
      : ti.apMax ? `<p class="sec-t">${esc(ti.kindLabel)} 턴 <span class="dim">· 장소 1칸, 행동 1칸, 말 걸기는 0칸</span></p>` : '';
    const duty = adult && ti.duty ? `<p class="hint">평일이다. 먼저 ${ti.duty.id === 'work' ? '출근' : ti.duty.id === 'class' ? '수업' : '훈련'}부터 (${ti.duty.ap}칸). 아침밥은 그 전에 먹을 수 있다.</p>` : '';
    box.innerHTML = list.length
      ? `${head}${duty}<div class="acts places">${list.map(p => `<button type="button" class="act" data-pl="${p.id}"${p.ok ? '' : ' disabled'}${p.why ? ` title="${esc(p.why)}"` : ''}><span class="ic" aria-hidden="true">${p.icon}</span>${esc(p.label)}${p.why ? `<small>${esc(p.why)}</small>` : adult ? `<small>${p.cost ? p.cost + '칸' : '0칸'}${p.regular ? ' · 단골' : ''}</small>` : p.regular ? '<small>단골</small>' : ''}</button>`).join('')}</div>`
      : ti.apMax ? '<p class="empty">갈 수 있는 곳이 없다.</p>' : `<p class="empty">${esc(ti.kindLabel || '')} 주간이다. <b>▶ 다음 주</b>를 누르면 이어진다.</p>`;
    return;
  }
  const here = G.here(), acts = G.actionList();
  box.innerHTML = `
    <div class="here-head"><span>📍 현재 장소: <b>${esc(pl.label)}</b> ${pl.icon}${S.regular[pl.id] ? ' <small class="dim">단골</small>' : ''}${S.drunk ? ` <small class="drunk d${S.drunk}">🍺 ${G.drunkLabel()}</small>` : ''}</span><button type="button" data-leave>← 돌아가기</button></div>
    <p class="sec-t">여기 있는 사람들 <span class="dim">· 말 걸기는 행동을 안 씀</span></p>
    <div class="here">${here.map(hereRow).join('') || '<p class="empty">아무도 없다.</p>'}</div>
    <p class="sec-t">여기서 할 수 있는 것 <span class="dim">· 행동 1</span></p>
    <div class="acts">${actButtons(acts) || '<p class="empty">여기선 딱히 할 게 없다.</p>'}</div>`;
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
  const S = G.state(), look = { age: G.npcAge(p), after: { sat: sc.sat, personality: p.personality, lipstick: S.gender === 'f' && p.gender === 'm', hickey: S.gender === 'm' && p.gender === 'f', fig: sc.fig } };
  return `<p class="sc-t">다음 날 아침</p><div class="sc-port">${Avatar.render(G.look(p), 80, look)}</div>
    <p>${esc(sc.text || '')}</p><p class="dim sc-sat">만족감 ${sc.sat}${sc.contra ? ` · ${CONTRA_LABEL[sc.contra]}` : ''}</p>${floorClothes(p)}<button type="button" data-sc-next>계속</button>`;
}
// 그날 밤 장면은 night.js (Night.html / Night.run)
let nightJob = null;
function playScene(sc) {
  const p = G.person(sc.pid);
  if (!p || !window.Avatar) { G.clearScene(); return; }
  sceneEl.hidden = false;
  clearTimeout(sceneTimer);
  if (sc.kind !== 'night') {
    sceneQueue = [];
    sceneCard(`<div class="sc-card">${SIL[sc.kind] || ''}<p>${esc(sc.text || '')}</p><button type="button" data-sc-next>계속</button></div>`);
    return;
  }
  const morningQ = [`<div class="sc-card sc-morning">${morningCard(sc, p)}</div>`];
  const pregQ = sc.preg ? [`<div class="sc-card">${CONCEIVE}<p class="sc-later">몇 주 뒤, ${esc(G.josa(G.pname(p), '이'))} 할 말이 있다고 했다.</p><button type="button" data-sc-next>계속</button></div>`] : [];
  nightJob = { sc, p };
  // 서서 다가감 → 그날 밤 → (콘돔 없이면) 자궁 그림 → 다음 날 아침 → (임신이면) 몇 주 뒤
  const S = G.state(), inside = sc.contra === 'none' || sc.contra === 'pill';
  const tops = [Avatar.topColor(S.gender === 'm' ? G.myLook() : G.look(p)), Avatar.topColor(S.gender === 'm' ? G.look(p) : G.myLook())];
  const nightQ = calm || !window.Night ? [] : [`<div class="sc-card sc-fp">${Night.foreplay(tops)}</div>`, `<div class="sc-night"><p class="sc-t">그날 밤</p>${Night.html(sc.spot)}</div>`]
    .concat(inside ? [`<div class="sc-card sc-ut">${Night.uterus(!!sc.preg)}</div>`] : []);
  sceneQueue = nightQ.concat(morningQ, pregQ);
  nextScene();
}
function nextScene() {
  clearTimeout(sceneTimer); if (window.Night) Night.stop();
  if (sceneQueue.length) {
    const html = sceneQueue.shift();
    sceneCard(html);
    const night = sceneBox.querySelector('.nt-stage');
    if (night) Night.run(night, nightJob, () => { sceneTimer = setTimeout(nextScene, 500); });
    else if (sceneBox.querySelector('.sc-fp')) sceneTimer = setTimeout(nextScene, 3100);
    else if (sceneBox.querySelector('.sc-ut')) sceneTimer = setTimeout(nextScene, 4300);
    return;
  }
  sceneEl.hidden = true; sceneBox.innerHTML = '';
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
  if (sceneBox.querySelector('.sc-night, .sc-fp, .sc-ut')) nextScene();
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
  modal.hidden = false;
  if (!same) {
    const first = mBody.querySelector('button:not(:disabled)') || (closable ? $('#mClose') : null);
    if (first) first.focus({ preventScroll: true });
  }
}
function closeModal() {
  modal.hidden = true;
  modalMode = null; modalArg = null;
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}

function openEvent() {
  const ev = G.currentEvent();
  if (!ev) return;
  const S = G.state(), se = G.season();
  const who = ev.who && window.Avatar ? `<div class="ev-who">${Avatar.render(ev.who.look, 60, { age: ev.who.age, fig: ev.who.fig, libido: ev.who.libido || 0 })}<span><b>${esc(ev.who.name)}</b><br><span class="dim">${ev.who.age}살, ${esc(ev.who.rel)}</span></span></div>` : '';
  showModal('event', `${S.age}살 ${se.icon} ${se.id} ${wxIcon(S.weather)}`,
    `${who}<p>${esc(ev.text)}</p><div class="choices">${ev.choices.map((c, i) => `<button type="button" data-c="${i}">[${i + 1}] ${esc(c)}</button>`).join('')}</div>`, false, ev.text);
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
  const rows = r.rows.map(x => `<tr><td>${esc(x.label)}</td><td>${x.score}</td><td><b class="gr gr${x.grade}">${x.grade}등급</b></td>${r.csat ? `<td class="dim">${x.roll > 0 ? '+' : ''}${x.roll}</td>` : r.mock ? `<td class="dim">${x.pct}</td>` : ''}</tr>`).join('');
  showModal('report', r.csat ? '📜 수능 성적표' : '📋 성적표', `<p class="rc-t">${esc(r.school ? r.school + ' ' : '')}${esc(r.title)}</p>
    <table class="rc"><thead><tr><th>과목</th><th>점수</th><th>등급</th>${extra}</tr></thead><tbody>${rows}</tbody></table>
    <p class="rc-avg">평균 <b>${r.avg.toFixed(1)}등급</b></p>${r.note ? `<p class="dim rc-note">${esc(r.note)}</p>` : ''}
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
  const n = G.naesinAvg(), sat = S.school.sat;
  showModal('apply', susi ? '📝 수시 원서 접수' : '📝 정시 원서 접수', `
    <p class="dim">${sat ? `내 수능 평균: <b>${sat.avg.toFixed(1)}등급</b><br>` : ''}내 내신 평균: <b>${n != null ? n.toFixed(1) + '등급' : '없음'}</b>${susi ? ` · 비교과 ${Math.round(S.school.extra || 0)}점` : ''}</p>
    <div class="ap">${rows}</div>
    ${susi && applyDraft.rows.length < 6 ? '<button type="button" class="ap-add" data-apadd>＋ 한 장 더</button>' : ''}
    <p class="hint">${susi ? '교과는 내신만, 종합은 내신 + 비교과(동아리·봉사·독서) + 자소서. 6장까지. 의학과는 기준이 1등급 더 높다.' : '가·나·다군에 한 장씩. 수능 평균 등급으로 본다. 의학과는 기준이 1등급 더 높다.'}</p>
    <div class="choices"><button type="button" data-apgo>접수하기</button>${susi ? '<button type="button" data-apskip>수시는 안 넣는다</button>' : ''}</div>`, false, 'apply');
}
mBody.addEventListener('change', e => {
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
function openPeople() {
  const S = G.state();
  const list = G.people().slice().sort((a, b) => order(a) - order(b) || b.close - a.close);
  const rows = list.map(p => {
    const extra = [];
    if (G.heartOk(p) || p.heart > 0) extra.push(`설렘 <b>${mini(p.heart)}</b>`);
    if (p.grudge >= 15) extra.push(`원한 <b class="r">${mini(p.grudge)}</b>`);
    return `<button type="button" class="prow" data-pv="${p.id}">${av(p, 32)}
      <span><b>${esc(G.pname(p))}</b> <span class="dim">${G.npcAge(p)}살 ${genderKo(p.gender)}</span></span>
      <span class="pl">${esc(G.relLabel(p))}</span>
      <span class="pm">친밀 <b>${mini(p.close)}</b>  ${extra.join('  ')}</span>
    </button>`;
  }).join('');
  showModal('people', `👥 관계 ${list.length}명`,
    `<div class="plist">${rows || '<p>곁에 아무도 없다.</p>'}</div><p class="hint">사람을 누르면 할 수 있는 게 나와. 관계는 가만두면 조금씩 멀어져. (남은 행동 ${S.ap})</p>`);
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
  if (p.married && p.marriedKnown) tags.push('<span class="tag warn">기혼</span>');
  else if (p.married && p.close >= 20) tags.push('<span class="tag">반지를 끼고 있다</span>');
  else if (p.taken && !mine && p.kind !== 'family' && p.kind !== 'child') tags.push('<span class="tag">애인 있음</span>');
  if (p.fwb) tags.push('<span class="tag">섹파</span>');
  if (p.secret) tags.push('<span class="tag warn">들키면 안 됨</span>');
  if (p.debt) tags.push(`<span class="tag warn">빌린 돈 ${G.fmtMoney(p.debt)}</span>`);
  if (p.ex) tags.push('<span class="tag">예전에 사귐</span>');
  if (S.preg && S.preg.pid === p.id && S.preg.mode && S.gender === 'm') tags.push('<span class="tag">아이를 가짐</span>');
  if (p.livesWith) tags.push('<span class="tag">같이 삶</span>');
  const prof = G.profile(p).map(f => `<dt>${f.label}</dt><dd${f.value == null ? ' class="unk"' : ''}>${f.value == null ? '???' : esc(f.value)}</dd>`).join('');
  const its = G.interactions(id), anyFree = its.some(it => it.free);
  const acts = its.map(it =>
    `<button type="button" data-i="${it.id}"${it.ok ? '' : ' disabled'}>${it.icon} ${it.label}${it.cost ? ` <small>${G.fmtMoney(it.cost)}</small>` : ''}${anyFree && !it.free ? ' <small>행동 1</small>' : ''}</button>`).join('');
  showModal('person', `${G.pname(p)}`, `
    <div class="p-top">${avBtn(id, av(p, 60))}<div class="p-who"><b>${esc(G.pname(p))}</b><span class="dim">${G.npcAge(p)}살 ${genderKo(p.gender)}, ${esc(G.relLabel(p))}</span></div></div>
    ${fullView === id ? fullAv(G.look(p), G.npcAge(p), G.figure(p), p.personality) : ''}
    <div class="stats">${stats}</div>
    ${imHTML}
    ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    <dl class="prof">${prof}</dl>
    ${G.profile(p).some(f => f.value == null) ? '<p class="hint">더 친해지면 더 알 수 있다.</p>' : ''}
    <div class="igrid">${acts || '<p class="hint">지금은 할 수 있는 게 없다.</p>'}</div>
    <p class="hint">${anyFree ? `지금 ${esc(G.place().label)}에 같이 있어서 한 번은 행동을 쓰지 않는다.` : '한 번에 행동 1을 써.'} (남은 행동 ${S.ap})</p>
    <button type="button" class="back" data-back>${personFrom === 'here' ? '← 닫기' : '← 목록'}</button>`, true, id);
}

/* 장소에서 처음 보는 사람 */
function openStranger(key) {
  const h = G.here().find(x => x.key === key && x.stranger);
  if (!h) return;   // 말 걸기에 성공하면 엔진이 이 사람을 관계 목록으로 옮김 → 클릭 처리에서 openPerson으로 넘어감
  const p = h.p;
  showModal('stranger', '처음 보는 사람', `
    <div class="p-top">${av(p, 60)}<div class="p-who"><b>처음 보는 사람</b><span class="dim">${ageBand(G.npcAge(p))} ${genderKo(p.gender)}</span><span class="dim">${esc(h.doing)}.</span></div></div>
    <div class="igrid"><button type="button" data-talk="${h.key}"${h.used ? ' disabled' : ''}>💬 말 걸기 <small>행동 안 씀</small></button></div>
    <p class="hint">${h.used ? '대화가 이어지지 않았다. 다음에 또 마주칠지도.' : '말을 걸면 이름과 특징을 알 수 있다. 잘 받아주면 관계 목록에 추가된다.'}</p>
    <button type="button" class="back" data-back>← 닫기</button>`, true, key);
}

/* 직업 */
function reqText(j) {
  if (!j.checks.length) return '<span class="req">조건 없음</span>';
  return j.checks.map(([ok, t]) => `<span class="req${ok ? '' : ' no'}">${esc(t)}</span>`).join(', ');
}
function openJobs() {
  const S = G.state();
  let html;
  if (S.job) {
    const j = G.job(S.job);
    html = `<p>지금 직업: <b>${esc(G.jobTitle())}</b><br><span class="dim">연봉 ${j.volatile ? '대략 ' + G.fmtMoney(S.salary) + ' (들쭉날쭉)' : G.fmtMoney(S.salary)}</span></p>
      <div class="stats"><span>성과</span><span class="bar">${bar(S.perf)}</span><span class="num">${S.perf}</span></div>
      <p class="hint">'일' 행동으로 성과를 쌓으면 승진할 수 있다. 성과가 너무 낮으면 잘릴 수도 있다.${S.rank < j.ranks.length - 1 ? ` 다음 직급: ${j.ranks[S.rank + 1]}` : ''}</p>
      <div class="choices"><button type="button" data-quit${S.pending.length ? ' disabled' : ''}>그만두기</button></div>`;
  } else if (S.age < 19) html = '<p>19살부터 일자리를 구할 수 있어. 그 전엔 알바로 용돈을 벌 수 있어.</p>';
  else if (S.jail) html = '<p>수감 중에는 일자리를 구할 수 없다.</p>';
  else if (S.flags.student) html = '<p>지금은 학생이야. 졸업하고 구해보자.</p>';
  else if (S.flags.inArmy) html = '<p>군 복무 중이다.</p>';
  else {
    const can = G.canJobHunt();
    html = `<p class="hint">지원하면 행동 1을 써.${S.record ? ' 전과가 있으면 붙기 어렵다.' : ''} (남은 행동 ${S.ap})</p>` + G.jobInfo().map(j => `
      <div class="row">
        <div><b>${esc(j.label)}</b> <span class="dim">${j.volatile ? '수입 랜덤' : '연봉 ' + G.fmtMoney(j.salary)}</span><div style="font-size:12.5px">${reqText(j)}</div></div>
        <button type="button" data-j="${j.id}"${can ? '' : ' disabled'}>지원</button>
      </div>`).join('');
  }
  showModal('jobs', '💼 직업', html);
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
    <p class="hint">남은 행동 ${S.ap}</p>`);
}


/* 공부: 과목 고르기 (중·고등학생) */
function openStudy() {
  const S = G.state();
  const rows = G.studyInfo().map(x => `<button type="button" data-s="${x.id}">${x.label} <small>${x.exp}점${x.prep ? ` (+${x.prep})` : ''}</small></button>`).join('');
  showModal('study', '📚 무슨 공부?', `<div class="igrid">${rows}<button type="button" data-s="all">골고루</button></div>
    <p class="hint">다음 시험까지 쌓이는 공부: 한 과목에 집중하면 +8~10, 골고루 하면 과목마다 +3~5. 숫자는 지금 예상 점수(괄호는 이번 시험을 위해 쌓은 공부).</p>`);
}

/* 나 */
function openMe() {
  const S = G.state();
  const prof = G.myProfile().map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const ab = G.abilities.map(k => { const g = G.gradeInfo(S.stats[k]);
    return `<span>${G.LABEL[k]}</span><span class="bar">${bar(g.pct * 100)}</span><span class="num"><b class="g-${g.letter}">${g.letter}</b> ${S.stats[k]}</span>`; }).join('');
  let school = '';
  const sc = S.school;
  if (S.age >= 13) {
    const inSch = !sc.sat && !sc.univ && S.age <= 19;
    const subj = inSch ? G.studyInfo().map(x => `<span>${x.label}</span><span class="bar">${bar(x.exp)}</span><span class="num">${x.exp}</span>`).join('') : '';
    const lines = [];
    const tr = sc.track && G.tracks.find(t => t.id === sc.track);
    if (tr) lines.push(`계열 ${tr.label} — ${G.subjectsNow().map(x => x.label).join('·')}`);
    const last = sc.exams.slice(-4).map(e => `${e.title} ${e.avg.toFixed(1)}`).join(' · ');
    if (last) lines.push(`최근 시험 (평균 등급): ${last}`);
    if (G.naesinAvg() != null) lines.push(`내신 평균 ${G.naesinAvg().toFixed(1)}등급`);
    if (G.mockAvg() != null) lines.push(`모의고사 평균 ${G.mockAvg().toFixed(1)}등급 (${sc.mocks.length}회)`);
    if (sc.sat) lines.push(`수능 평균 ${sc.sat.avg.toFixed(1)}등급${sc.sat.rows && sc.sat.rows.length ? ` (${sc.sat.rows.map(x => (G.subjects.find(y => y.id === x.id) || {}).label + ' ' + x.grade).join(', ')})` : ''}`);
    if (sc.extra) lines.push(`비교과 ${Math.round(sc.extra)}점 (동아리·봉사·독서)`);
    const uni = G.univLabel() ? `<div class="me-uni">${logo(sc.univ, 34)}<span>${esc(G.univLabel())} ${esc(G.majorLabel() || '')}${sc.gpaN ? `<br><span class="dim">학점 ${sc.gpa.toFixed(2)}${sc.degree ? ' · 졸업' : ''}</span>` : ''}</span></div>` : '';
    school = `<p class="sec-t">학교</p>${subj ? `<div class="subj">${subj}</div><p class="hint">예상 점수 (능력치 + 이번 시험을 위해 쌓은 공부·수업)</p>` : ''}${lines.map(l => `<p class="dim" style="font-size:13px">${esc(l)}</p>`).join('')}${uni}`;
  }
  const me = G.myLook() && window.Avatar ? avBtn('me', Avatar.render(G.myLook(), 60, { age: S.age, fig: G.figure(null) })) : '';
  showModal('me', `📋 ${S.name}`, `
    <div class="me-top">${me}<dl class="prof">${prof}</dl></div>
    ${fullView === 'me' && G.myLook() ? fullAv(G.myLook(), S.age, G.figure(null), S.personality) : ''}
    ${S.preg && S.preg.mode ? `<p class="dim" style="font-size:13px">${S.gender === 'f' ? '임신 중' : '곧 아이가 태어난다'} — ${S.preg.due > S.age ? '내년' : '올해'} 출산 예정</p>` : ''}
    <p class="sec-t">능력치</p>
    <div class="stats">${ab}</div>
    <p class="hint">능력치는 100에서 멈추지 않는다. F부터 SS까지, 등급이 오를수록 올리기 어렵다.</p>
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
function randomDraft(mode) {
  const d = { name: '', mode: mode || 'full', step: 0 };
  CREATE_FIELDS.forEach(f => { d[f[0]] = rnd(optsOf(f)).id; });
  return d;
}
function openCreate(closable) {
  if (!draft) draft = randomDraft();
  if (draft.mode === 'q20' && draft.step > 0) { openQuick(closable); return; }
  const q20 = draft.mode === 'q20';
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
    <div class="fld"><div class="fl"><span>이름 (비우면 랜덤)</span></div><input id="cName" maxlength="6" value="${esc(draft.name)}" placeholder="예: 김하늘" autocomplete="off"></div>
    ${fields}
    <div class="create-go"><button type="button" data-rall>🎲 전부 랜덤</button><button type="button" class="go" data-go>${q20 ? '다음 →' : '태어나기'}</button></div>
  </div>`, !!closable, 'create');
}
function createClick(b) {
  const d = b.dataset;
  const nameEl = $('#cName'); if (nameEl) draft.name = nameEl.value;
  if (d.mode) draft.mode = d.mode;
  else if (d.cf) { const f = CREATE_FIELDS.find(x => x[0] === d.cf); draft[d.cf] = typeof optsOf(f)[0].id === 'number' ? +d.cv : d.cv; }
  else if (d.rf) { const f = CREATE_FIELDS.find(x => x[0] === d.rf); draft[d.rf] = rnd(optsOf(f)).id; }
  else if ('rall' in d) { const n = draft.name, m = draft.mode; draft = randomDraft(m); draft.name = n; }
  else if ('go' in d) {
    if (draft.mode === 'q20') { quickSync(); draft.step = 1; draft.maxStep = Math.max(draft.maxStep || 1, 1); openQuick(!$('#mClose').hidden); return; }
    const opt = draft; draft = null; G.newLife(opt); closeModal(); return;
  }
  const top = mBody.scrollTop;
  openCreate(!$('#mClose').hidden);
  mBody.scrollTop = top;
}

/* ── 20세 시작: 배경 → 능력치 → 외모·신체 → 성격·취향 → 관계 → 확인 (뒤로 가기 가능, 오른쪽에 전신 미리보기) ── */
const QSTEPS = ['배경', '능력치', '외모·신체', '성격·취향', '관계', '확인'];
const QNUM = ['hair', 'hc', 'skin', 'eyes', 'friends', 'ly'], QBOOL = ['exp', 'lsex'];
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
const qLeft = q => QD().points - QD().stats.reduce((t, k) => t + (q.st[k] || 0), 0);
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
  return '';
}
function qPreview() {
  const q = draft.q, f = qFig(q), look = G.quick.look(q);
  const svg = window.Avatar && look ? Avatar.render(look, 132, { age: 20, full: f, personality: q.personality }) : '';
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
        + qFld('학과', `<div class="chips">${u.departments.map(id => { const d = G.departments.find(x => x.id === id); return qChip('dept', id, esc(d.icon + ' ' + d.name), id === q.dept); }).join('')}</div>`, '1학년을 마친 2학년으로 시작한다. 1학년 학점은 능력치로 정해진다.');
    } else if (q.edu === 'work') {
      more = qFld('하는 일', `<div class="chips">${G.quick.jobs().map(j => qChip('job', j.id, `${esc(j.label)} <small>${esc(G.fmtMoney(j.salary))}</small>`, j.id === q.job)).join('')}</div>`, '연봉 (만원). 고졸로 바로 시작할 수 있는 일.');
    }
    const mr = Q.money[q.wealth] || [0, 0], w = C.wealth.find(x => x.id === q.wealth) || {};
    const army = q.gender === 'm' ? qFld('병역', qChips('army', Q.army.filter(a => q.edu !== 'retake' || a.id !== 'now'), q.army === 'now' && q.edu === 'retake' ? 'next' : q.army), '입대하면 2년 동안 훈련이 하루 8칸을 쓴다.') : '';
    return qFld('학력', qChips('edu', Q.edu, q.edu), esc(e.desc)) + more
      + qFld('집안', qChips('wealth', C.wealth, q.wealth), `${esc(w.desc || '')} 시작 돈 ${mr[0] === mr[1] ? G.fmtMoney(mr[0]) + (q.wealth === 'poor' ? ' (대학생이면 학자금 대출)' : '') : `${G.fmtMoney(mr[0])}~${G.fmtMoney(mr[1])}`}`)
      + qFld('사는 곳', qChips('home', Q.home, q.home)) + army;
  }
  if (n === 2) {
    const tr = C.traits.find(t => t.id === q.trait) || {};
    const rows = Q.stats.map(k => qRange(k, 0, 100, q.st[k], `${G.LABEL[k]} <small class="dim">${esc(Q.statDesc[k])}</small>`, 'qs')).join('');
    return `<div class="qs-left">남은 포인트 <b data-qlab="left">${qLabel('left')}</b> / ${Q.points}</div>
      <div class="chips">${Q.presets.map(p => `<button type="button" data-qpre="${p.id}">${esc(p.label)}</button>`).join('')}<button type="button" data-qpre="random">🎲 랜덤</button></div>
      <div class="qs-rs">${rows}</div>
      <p class="hint">0~20 F · 21~40 E~D · 41~60 C · 61~80 B~A · 81~100 S. 남은 포인트가 0이면 더 올릴 수 없다.</p>
      <div class="qs-rs">${qRange('style', 0, 50, q.style, '꾸밈 <small class="dim">옷·머리 상태</small>')}</div>
      ${qFld('소질 <small class="dim">앞으로 잘 오르는 것</small>', qChips('trait', C.traits, q.trait), esc(tr.desc || ''))}
      ${qFld('경험', `<div class="chips">${qChip('exp', 0, '없음', !q.exp)}${qChip('exp', 1, '있음', q.exp)}</div>`, q.exp ? '밤의 기술이 조금 있는 채로 시작한다.' : '아직 경험 없이 시작한다.')}`;
  }
  if (n === 3) {
    const P = window.Avatar ? Avatar.parts : { hair: { m: [], f: [] }, hc: [], skin: [], eyes: [] }, g = q.gender, R = Q.range;
    const body = g === 'f'
      ? qFld('가슴', `<div class="chips">${Q.cups.map((c, i) => qChip('cup', c, `${cupIcon(i)} ${c}`, c === q.cup)).join('')}</div>`, esc(G.quick.cupLabel(q.cup)))
        + `<div class="qs-rs">${qRange('waist', R.waist[0], R.waist[1], q.waist, '허리')}${qRange('hip', R.hip[0], R.hip[1], q.hip, '골반')}</div>`
      : `<div class="qs-rs">${qRange('shoulder', R.shoulder[0], R.shoulder[1], q.shoulder, '어깨')}${qRange('penis', R.penis[0], R.penis[1], q.penis, '크기')}</div>`;
    const sw = (f, list) => `<div class="chips sw">${list.map(o => qChip(f, o.id, `<i style="background:${o.color}"></i>${esc(o.label)}`, o.id === q[f])).join('')}</div>`;
    return `<div class="qs-rs">${qRange('height', R.height[g][0], R.height[g][1], q.height, '키')}</div>`
      + qFld('체형', qChips('build', Q.builds, q.build)) + body
      + qFld('머리 스타일', `<div class="chips">${P.hair[g].map((l, i) => qChip('hair', i, esc(l), i === q.hair)).join('')}</div>`)
      + qFld('머리색', sw('hc', P.hc)) + qFld('피부', sw('skin', P.skin))
      + qFld('눈', `<div class="chips">${P.eyes.map(o => qChip('eyes', o.id, esc(o.label), o.id === q.eyes)).join('')}</div>`)
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
        + qFld('함께 보낸 밤', `<div class="chips">${qChip('lsex', 0, '아직', !q.lsex)}${qChip('lsex', 1, '있음', q.lsex)}</div>`, q.lsex ? '경험이 있는 채로 시작하고, 서로 조금 맞춰져 있다.' : '');
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
    ['학력', e.tiers && u ? `${e.label} — ${u.name} ${d ? d.name : ''}` : q.edu === 'work' ? `${e.label} — ${(G.quick.jobs().find(j => j.id === q.job) || {}).label || ''}` : e.label],
    ['집안', `${L(C.wealth, q.wealth)} · ${L(Q.home, q.home)}${q.gender === 'm' ? ` · ${L(Q.army, q.edu === 'retake' && q.army === 'now' ? 'next' : q.army)}` : ''}`],
    ['능력치', Q.stats.map(k => `${G.LABEL[k]} ${G.quick.grade(q.st[k])}`).join(' · ') + ` · 꾸밈 ${G.quick.grade(q.style)}`],
    ['소질', L(C.traits, q.trait) + (q.exp ? ' · 경험 있음' : '')],
    ['몸', `${f.height}cm · ${L(Q.builds, q.build)} · ${q.gender === 'f' ? `${f.under}${f.cup} · ${f.bust}-${f.waist}-${f.hip}` : `어깨 ${f.shoulder}cm · ${q.penis}cm`}`],
    ['생김새', P ? `${P.hair[q.gender][q.hair] || ''} · ${(P.hc.find(x => x.id === q.hc) || {}).label || ''} · 피부 ${(P.skin[q.skin] || {}).label || ''} · ${(P.eyes[q.eyes] || {}).label || ''} 눈` : ''],
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
  let left = Q.points;
  while (left > 0) { const i = Math.floor(Math.random() * v.length), add = Math.min(left, 1 + Math.floor(Math.random() * 10), 100 - v[i]); v[i] += add; left -= add; }
  return v;
}
function quickClick(b) {
  const d = b.dataset, q = draft.q, Q = QD();
  if ('qback' in d) { draft.step--; if (draft.step <= 0) { draft.step = 0; openCreate(!$('#mClose').hidden); } else openQuick(); return; }
  if ('qnext' in d) { draft.step = Math.min(6, draft.step + 1); draft.maxStep = Math.max(draft.maxStep || 1, draft.step); openQuick(); return; }
  if (d.qstep) { draft.step = +d.qstep; openQuick(); return; }
  if ('qgo' in d) { const opt = Object.assign({}, q, { name: draft.name, gender: draft.gender, month: draft.month }); draft = null; closeModal(); G.newLife20(opt); return; }   // 닫고 나서 만들어야 '나의 20년' 창이 뜸
  if (d.qf) {
    const f = d.qf, v = QNUM.includes(f) ? +d.qv : QBOOL.includes(f) ? d.qv === '1' : d.qv;
    q[f] = v;
    if (f === 'edu' || f === 'univ') quickFixEdu();
  } else if (d.qh) {
    const i = q.hobbies.indexOf(d.qh);
    if (i >= 0) q.hobbies.splice(i, 1); else { q.hobbies.push(d.qh); if (q.hobbies.length > 2) q.hobbies.shift(); }
  } else if (d.qpre) {
    const v = d.qpre === 'random' ? quickRandom() : (Q.presets.find(p => p.id === d.qpre) || Q.presets[0]).v;
    Q.stats.forEach((k, i) => { q.st[k] = v[i]; });
  } else if ('qreface' in d) q.seed = Math.random().toString(36).slice(2, 9);
  openQuick();
}
// 슬라이더: 다시 그리지 않고 값·라벨·미리보기만 (끄는 중에 슬라이더가 사라지지 않게). 능력치는 남은 포인트까지만
mBody.addEventListener('input', e => {
  if (modalMode !== 'quick' || !draft || !draft.q) return;
  const el = e.target;
  if (!el || el.type !== 'range') return;
  const q = draft.q;
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
  const me = G.myLook() && window.Avatar ? Avatar.render(G.myLook(), 58, { age: S.age, fig: G.figure(null) }) : '';
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
    <p class="dim">${esc(S.name)}<br>${esc(G.roleText())}, 재산 ${G.fmtMoney(S.money)}${S.record ? `, 전과 ${S.record}회` : ''}<br>${G.univLabel() ? logo(S.school.univ, 22) + ' ' + esc(`${G.univLabel()} ${G.majorLabel() || ''}${S.school.degree ? ' 졸업' : ''}`) + '<br>' : ''}꿈: ${esc(S.vars.dreamLabel)} — ${dreamDone(S) ? '이뤘다' : '아직'}<br>업보: ${G.karmaLabel()}<br>곁에 있는 사람: ${esc(close)}</p>
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
      : `<b>${esc(x.name)}</b> <span class="dim">${x.age}살 ${genderKo(x.gender)}${x.date ? ` · ${x.date.y}년 ${x.date.m}월` : ''}${x.quick ? ' · 20세 시작' : ''}${x.ended ? ' · 끝난 인생' : ''}</span>`;
    const btns = x.current ? '<span class="tag">지금 칸 · 자동 저장</span>'
      : (x.empty ? `<button type="button" data-sv="${x.n}">여기에 저장</button><button type="button" data-snew="${x.n}">새 인생</button>`
        : `<button type="button" data-sl="${x.n}">불러오기</button><button type="button" data-sv="${x.n}">덮어쓰기</button><button type="button" data-sdel="${x.n}">지우기</button>`);
    return `<div class="row"><div>${x.n}번 칸 · ${info}</div><div class="slot-btns">${btns}</div></div>`;
  }).join('');
  showModal('slots', '💾 저장 칸', `${rows}<p class="hint">지금 칸에는 행동·턴·하루가 끝날 때마다 자동으로 저장돼. 다른 칸에 저장하면 그 칸으로 옮겨가서 이어서 저장돼.</p>`);
}
function confirmRestart() {
  showModal('confirm', '↻ 새 인생', `<p>지금 인생을 접고 처음부터 다시 시작할까?</p>
    <div class="choices"><button type="button" data-cancel>계속 살기</button><button type="button" data-new>새로 시작</button></div>`);
}

/* ---------- 입력 ---------- */
$('#where').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.a) { const a = G.actionList().find(x => x.id === d.a); if (a && G.needsSubject(a)) openStudy(); else G.doAction(d.a); }
  else if (d.pl) G.goPlace(d.pl);
  else if ('leave' in d) G.leavePlace();
  else if (d.hp) {
    const h = G.here().find(x => x.key === d.hp);
    if (!h) return;
    if (h.stranger) openStranger(h.key); else { personFrom = 'here'; openPerson(h.key); }
  }
});
$('#meBtn').addEventListener('click', openMe);
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
  if (f === 'eat') G.eat(); else if (f === 'duty') G.doDuty(); else G.skip(f);
});
$('#peopleBtn').addEventListener('click', () => { personFrom = 'people'; openPeople(); });
$('#jobBtn').addEventListener('click', openJobs);
$('#crimeBtn').addEventListener('click', openCrime);
$('#restart').addEventListener('click', confirmRestart);
$('#slotsBtn').addEventListener('click', openSlots);
$('#mClose').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal && !$('#mClose').hidden) closeModal(); });
mBody.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (modalMode === 'create') { createClick(b); return; }
  if (modalMode === 'quick') { quickClick(b); return; }
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
  if (d.s) { G.doAction('study', d.s === 'all' ? null : d.s); return; }
  if (d.c != null) G.choose(+d.c);
  else if (d.full) { fullView = fullView === d.full ? null : d.full; if (d.full === 'me') openMe(); else openPerson(d.full); }
  else if (d.pv) { personFrom = 'people'; openPerson(d.pv); }
  else if (d.i) G.interact(modalArg, d.i);
  else if (d.talk) { const id = G.talkTo(d.talk); if (id && !G.state().pending.length) { personFrom = 'here'; openPerson(id); } }
  else if ('back' in d) { if (modalMode === 'stranger' || personFrom === 'here') closeModal(); else openPeople(); }
  else if (d.j) G.applyJob(d.j);
  else if (d.k) G.commitCrime(d.k);
  else if ('quit' in d) G.quitJob();
  else if ('new' in d) { draft = null; openCreate(true); }
  else if ('cancel' in d) closeModal();
});
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target && e.target.tagName === 'INPUT')) return;
  if (!sceneEl.hidden) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); nextScene(); } return; }
  if (modalMode === 'event' && /^[1-9]$/.test(e.key)) { G.choose(+e.key - 1); e.preventDefault(); }
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
WeatherBG.setWeather(WX.partly.p, true);
G.subscribe(render);
if (!G.init()) openCreate(false);
})();
