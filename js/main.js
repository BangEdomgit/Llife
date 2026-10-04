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
const av = (p, size) => window.Avatar ? Avatar.render(G.look(p), size, G.npcAge(p)) : '';
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
function seasonDots(S) {
  const cuts = G.seasons.map(s => s.at).filter(a => a > 0);
  let out = '';
  for (let i = 0; i < G.config.apPerYear; i++) { if (cuts.includes(i)) out += ' '; out += i < S.used ? '●' : '○'; }
  return out;
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
  $('#conds').innerHTML = G.conds.filter(k => k !== 'libido' || S.age >= G.config.sexMinAge).map(k =>
    `<span>${G.LABEL[k]}</span><span class="bar${(k === 'libido' ? S.stats[k] >= 60 : S.stats[k] < 25) ? ' low' : ''}">${bar(S.stats[k])}</span><span class="num">${S.stats[k]}</span>`).join('');
  $('#abils').innerHTML = G.abilities.map(k => abHTML(k, S.stats[k])).join('');

  renderLog(S);

  const se = G.season();
  $('#season').textContent = `${se.icon} ${se.id} · ${G.timeLabel()}`;
  $('#ap').textContent = seasonDots(S);
  $('#apNum').textContent = `${S.ap}/${G.config.apPerYear}`;
  $("#peopleBtn").textContent = "👥 관계";
  $('#jobBtn').hidden = S.age < 16;
  $('#crimeBtn').hidden = G.crimes().length === 0 && S.jail === 0;

  renderWhere(S);

  const ageBtn = $('#ageUp');
  ageBtn.textContent = S.ended ? '↻ 새 인생 시작' : S.ap > 0 ? `⏭ 남은 ${S.ap}번 쉬고 1살 먹기` : '＋ 1살 먹기';
  ageBtn.disabled = !S.ended && S.pending.length > 0;

  // 배경: 지금 계절의 날씨와 시간대
  if (bg.w !== S.weather) { WeatherBG.setWeather(WX[S.weather].p, bg.w === null); bg.w = S.weather; }
  if (bg.t !== S.time) { WeatherBG.setTime(S.time, bg.t === null); bg.t = S.time; }

  maybeScene(S);
  // 모달
  if (S.pending.length) openEvent();
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
    box.innerHTML = list.length
      ? `<div class="acts places">${list.map(p => `<button type="button" class="act" data-pl="${p.id}"${p.ok ? '' : ' disabled'}${p.why ? ` title="${esc(p.why)}"` : ''}><span class="ic" aria-hidden="true">${p.icon}</span>${esc(p.label)}${p.regular ? '<small>단골</small>' : p.why ? `<small>${esc(p.why)}</small>` : ''}</button>`).join('')}</div>`
      : '<p class="empty">아직은 먹고 자는 게 전부다.</p>';
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
  const S = G.state(), look = { age: G.npcAge(p), after: { sat: sc.sat, personality: p.personality, lipstick: S.gender === 'f' && p.gender === 'm', fig: sc.fig } };
  return `<p class="sc-t">다음 날 아침</p><div class="sc-port">${Avatar.render(G.look(p), 80, look)}</div>
    <p>${esc(sc.text || '')}</p><p class="dim sc-sat">만족감 ${sc.sat}${sc.contra ? ` · ${CONTRA_LABEL[sc.contra]}` : ''}</p>${floorClothes(p)}<button type="button" data-sc-next>계속</button>`;
}
// 그날 밤: 달빛 드는 방의 침대. 이불 속 두 사람은 보이지 않는 더미(캡슐 몸통)이고, 무거운 이불이 중력으로 그 위에 얹혀 함께 출렁임
// 박자: 점점 빨라짐 → 세게 두 번 → 세게 누른 채 떨림 두 번 → 축 늘어짐. 행위 자체는 그리지 않음
// 상대 만족감이 높을수록 하트가 많이 터짐. 50 아래면 하트 없이 짧게 흔들리다 실망(말풍선 …, 깨진 하트)
// 주소에 ?dummy 를 붙이면 이불을 반투명하게 하고 더미를 보여줌 (실험용)
const HEART = 'M0,5 C-7,0 -6,-6 -2.5,-6 C-1,-6 0,-5 0,-4 C0,-5 1,-6 2.5,-6 C6,-6 7,0 0,5 Z';
const CX = Array.from({ length: 44 }, (_, i) => 68 + 216 * i / 43);   // 이불 윗선 점들의 x
const FOLDS = [[112, -4, .8], [146, 3, 1], [176, -3, .7], [212, 4, 1], [250, -2, .8]];
const NIGHT = `<svg class="bed" viewBox="0 0 320 190" aria-hidden="true"><defs>
  <linearGradient id="ntWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#161c33"/><stop offset="1" stop-color="#0d1120"/></linearGradient>
  <linearGradient id="ntSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1533"/><stop offset="1" stop-color="#27356c"/></linearGradient>
  <radialGradient id="ntMoon"><stop offset="0" stop-color="#fff4c8" stop-opacity=".5"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></radialGradient>
  <mask id="ntCres"><circle cx="268" cy="44" r="8" fill="#fff"/><circle cx="272" cy="41" r="7" fill="#000"/></mask>
  <linearGradient id="ntBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9d6ff" stop-opacity=".14"/><stop offset="1" stop-color="#c9d6ff" stop-opacity="0"/></linearGradient>
  <radialGradient id="ntLamp"><stop offset="0" stop-color="#ffc77a" stop-opacity=".4"/><stop offset="1" stop-color="#ffc77a" stop-opacity="0"/></radialGradient>
  <linearGradient id="ntWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d4a33"/><stop offset="1" stop-color="#4a3122"/></linearGradient>
  <linearGradient id="ntSheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece6dc"/><stop offset="1" stop-color="#b9b1a4"/></linearGradient>
  <linearGradient id="ntQuilt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcbde6"/><stop offset=".4" stop-color="#b48bc6"/><stop offset="1" stop-color="#76548c"/></linearGradient>
  <radialGradient id="ntWarm"><stop offset="0" stop-color="#ff7aa2" stop-opacity=".5"/><stop offset="1" stop-color="#ff7aa2" stop-opacity="0"/></radialGradient>
  <radialGradient id="ntHeart" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#ffc6d4"/><stop offset=".55" stop-color="#ff6f94"/><stop offset="1" stop-color="#df3467"/></radialGradient>
  <g id="ntH"><path d="${HEART}" fill="url(#ntHeart)"/><ellipse cx="-2.8" cy="-3.2" rx="1.7" ry="1" fill="#fff" opacity=".7" transform="rotate(-35 -2.8 -3.2)"/></g>
</defs><g class="nt-cam">
  <rect width="320" height="171" fill="url(#ntWall)"/><rect y="170" width="320" height="20" fill="#090b13"/><path d="M0,170.5 H320" stroke="#242b46"/>
  <rect x="214" y="24" width="76" height="68" rx="2" fill="url(#ntSky)"/>
  ${[[224, 34, 0], [240, 48, .8], [233, 78, 1.6], [282, 70, .4], [258, 84, 1.2], [246, 31, 2]].map(([x, y, d]) => `<circle class="nt-star" cx="${x}" cy="${y}" r=".9" fill="#fff" style="animation-delay:${d}s"/>`).join('')}
  <circle cx="268" cy="44" r="19" fill="url(#ntMoon)"/><circle cx="268" cy="44" r="8" fill="#f6ebc4" mask="url(#ntCres)"/>
  <path d="M252,24 V92 M214,58 H290" stroke="#303a62" stroke-width="2.4"/>
  <rect x="214" y="24" width="76" height="68" rx="2" fill="none" stroke="#3b4672" stroke-width="3.5"/><rect x="209" y="91" width="86" height="4" rx="1.5" fill="#3b4672"/>
  <path d="M206,18 H222 C220,40 216,60 222,80 C224,90 218,100 214,106 C210,98 206,92 206,84 Z" fill="#2a3558"/><path d="M211,20 C210,40 210,62 212,84 M216,20 C215,44 214,62 217,82" fill="none" stroke="#1c2442" stroke-width="1.4"/>
  <path d="M298,18 H282 C284,40 288,60 282,80 C280,90 286,100 290,106 C294,98 298,92 298,84 Z" fill="#2a3558"/><path d="M293,20 C294,40 294,62 292,84 M288,20 C289,44 290,62 287,82" fill="none" stroke="#1c2442" stroke-width="1.4"/>
  <path d="M202,17 H302" stroke="#4d3b2c" stroke-width="2.4" stroke-linecap="round"/><circle cx="201" cy="17" r="2.4" fill="#4d3b2c"/><circle cx="303" cy="17" r="2.4" fill="#4d3b2c"/>
  <rect x="112" y="40" width="44" height="32" rx="1.5" fill="#3a2a20"/><rect x="115" y="43" width="38" height="26" fill="#1c2340"/><path d="M115,69 L127,55 L134,61 L143,50 L153,62 V69 Z" fill="#2c3a5c"/><circle cx="145" cy="49" r="2.4" fill="#c8b98a" opacity=".6"/><path d="M120,36 L134,28 L148,36" fill="none" stroke="#3a3f55" stroke-width=".8"/>
  <circle cx="18" cy="112" r="50" fill="url(#ntLamp)"/>
  <rect x="3" y="134" width="30" height="36" rx="2" fill="url(#ntWood)"/><rect x="1" y="131" width="34" height="4" rx="1.5" fill="#5b3d2a"/><path d="M7,151 H29" stroke="#3a281c"/><circle cx="18" cy="143" r="1.3" fill="#c9a36a"/>
  <ellipse cx="18" cy="130" rx="5" ry="1.6" fill="#8a6a48"/><rect x="17" y="116" width="2" height="14" fill="#8a6a48"/><path d="M9,117 H27 L23,103 H13 Z" fill="#f3d9a6"/><path d="M9,117 H27" stroke="#d9b97f" stroke-width="1.2"/>
  <g class="nt-bed">
    <ellipse cx="168" cy="171" rx="134" ry="4" fill="#000" opacity=".5"/>
    <path d="M40,170 V88 Q40,80 45,80 Q50,80 50,88 V170 Z" fill="url(#ntWood)"/><path d="M42.5,90 V166" stroke="#8a6448" opacity=".55"/>
    <path d="M286,170 V120 Q286,114 290,114 Q294,114 294,120 V170 Z" fill="url(#ntWood)"/><path d="M288.5,122 V166" stroke="#8a6448" opacity=".55"/>
    <rect x="48" y="145" width="240" height="11" rx="2" fill="url(#ntWood)"/><path d="M50,147.5 H286" stroke="#8a6448" opacity=".4"/>
    <rect x="50" y="129" width="236" height="17" rx="5" fill="url(#ntSheet)"/><path d="M54,137.5 H282" stroke="#a49b8d" stroke-dasharray="3 3" opacity=".5"/>
    <path d="M66,129 C63,121 72,115 86,116 C100,115 107,120 105,128 C104,131 68,132 66,129 Z" fill="#ddd5c8"/>
    <path d="M54,130 C51,123 60,117 73,118 C87,117 93,122 91,129 C90,132 56,133 54,130 Z" fill="#f4efe6"/><path d="M62,124 Q71,120 82,122" fill="none" stroke="#d3cbbd" stroke-width="1.2" stroke-linecap="round"/>
    <path class="nt-q" fill="url(#ntQuilt)"/><path class="nt-st" fill="none" stroke="#efdcf5" stroke-width=".9" stroke-dasharray="2.2 2.6" opacity=".45"/>
    <g fill="none" stroke-linecap="round">${FOLDS.map(([, , o]) => `<path class="nt-f" stroke="#5c3f70" stroke-width="2.2" opacity="${.26 * o}"/><path class="nt-f" stroke="#f1e0f7" stroke-width="1.1" opacity="${.18 * o}"/>`).join('')}</g>
    <path class="nt-hem" fill="none" stroke="#5a3e6e" stroke-width="2.2" opacity=".55"/><path class="nt-rim" fill="none" stroke="#f3e6f8" stroke-width="1.3" stroke-linecap="round" opacity=".6"/>
    <g class="nt-dummy" stroke-linecap="round" opacity=".6"></g>
  </g>
  <ellipse class="nt-warm" cx="182" cy="116" rx="122" ry="54" fill="url(#ntWarm)" opacity="0"/>
  <path d="M216,92 L290,92 L224,170 L112,170 Z" fill="url(#ntBeam)"/>
  <g class="nt-hearts"></g><g class="nt-fx"></g>
</g></svg>`;
// 더미 자세 → 캡슐 [ax, ay, bx, by, 반지름]
//   d: 위 사람 엉덩이 앞뒤 (+ 뒤로 뺌 / − 밀어 넣음), up: 더 들림, tr: 떨림, slump: 축 늘어짐 0~1, sink: 매트리스 눌림, bs: 아래 사람이 머리 쪽으로 밀린 거리
function dummies(d, up, tr, slump, sink, bs) {
  const hx = 178 + .8 * d, hy = 104 - .6 * d - up + tr + 5 * slump + sink;
  const sx = 120 + .2 * d, sy = 100 - .22 * d + 6 * slump + sink * .6;
  const k = sink * .5;
  return [
    [86 + bs, 112 + k, 86 + bs, 112 + k, 8.5], [99 + bs, 119.5 + k, 146 + bs, 120 + sink, 8.5], [146 + bs, 121 + sink, 164 + bs, 121 + sink, 8],
    [164 + bs, 121 + sink, 194, 107 + k, 6.2], [194, 107 + k, 212, 125, 5.2],                                    // 아래 사람: 머리·몸통·골반·세운 다리
    [sx - 12, sy - 3 + 2 * slump, sx - 12, sy - 3 + 2 * slump, 8.5], [sx, sy, hx, hy, 10], [sx - 2, sy + 2, 112, 122, 4.2],
    [hx, hy, 206, 123, 7.5], [206, 123, 250, 125, 5.5],                                                            // 위 사람: 머리·몸통·짚은 팔·꿇은 다리
  ];
}
const PILLOW = [62, 122, 98, 122, 6];
// 캡슐 윗면의 y (x에서). 없으면 Infinity
function capTop([ax, ay, bx, by, r], x) {
  let top = Infinity;
  for (const [px, py] of [[ax, ay], [bx, by]]) { const dx = x - px; if (dx * dx < r * r) top = Math.min(top, py - Math.sqrt(r * r - dx * dx)); }
  const vx = bx - ax, vy = by - ay, l = Math.hypot(vx, vy);
  if (l > .01) {
    let nx = -vy / l, ny = vx / l;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const x0 = ax + nx * r, x1 = bx + nx * r;
    if (Math.abs(x1 - x0) > .01 && x >= Math.min(x0, x1) && x <= Math.max(x0, x1)) top = Math.min(top, ay + ny * r + (x - x0) * vy / (x1 - x0));
  }
  return top;
}
// 박자표: { t0, T, A(세기), kind: n 보통 | strong 세게 | final 누른 채 떨림 }
// 한 박자 = (세게·마지막이면) 크게 뺐다가 wu → 밀어 넣기 sl(끝이 부딪힘 hit) → (마지막이면) 누른 채 떨림 → 다음 박자 시작점(to)으로
function nightPlan(tier) {
  const S = [], good = tier >= 2, rampEnd = good ? 3.1 : tier === 1 ? 2.5 : 1.8;
  let t = .3;
  const add = (T, A, kind = 'n') => { S.push({ t0: t, T, A, kind }); t += T; };
  for (let T = .62; t < rampEnd; T = Math.max(good ? .2 : .32, T * .87)) add(T, good ? 3.5 + 3.5 * t / rampEnd : 2.6 + 1.2 * t / rampEnd);
  if (good) { add(.66, 10, 'strong'); add(.66, 11, 'strong'); add(.95, 12, 'final'); add(.9, 12.5, 'final'); }
  else if (tier === 1) { add(.6, 6, 'strong'); add(.48, 5, 'final'); }
  else add(.44, 4.2, 'final');
  S.forEach((s, k) => {
    const nx = S[k + 1];
    s.wu = s.kind === 'n' ? 0 : s.kind === 'strong' ? .2 : .22;
    s.sl = s.kind === 'n' ? s.T * .3 : .12;
    s.hit = s.t0 + s.wu + s.sl;
    s.to = !nx || s.kind === 'final' ? -s.A + 3 : nx.kind === 'n' ? nx.A : 2;
    s.from = k ? S[k - 1].to : 0;
  });
  return { S, end: t };
}
const ease = u => u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
let nightRaf = 0, nightJob = null;
function runNight(svg, job, done) {
  const q = c => svg.querySelector(c), f = v => v.toFixed(1), NS = 'http://www.w3.org/2000/svg';
  const cam = q('.nt-cam'), bed = q('.nt-bed'), quilt = q('.nt-q'), stitch = q('.nt-st'), hemEl = q('.nt-hem'), rim = q('.nt-rim'), warm = q('.nt-warm');
  const heartsEl = q('.nt-hearts'), fx = q('.nt-fx'), dummyEl = q('.nt-dummy'), face = svg.parentNode.querySelector('.nt-face'), folds = svg.querySelectorAll('.nt-f');
  const { sc, p } = job, tier = Math.max(0, Math.min(4, [30, 50, 70, 90].filter(v => (sc.sat ?? 50) >= v).length)), good = tier >= 2;
  const debug = /[?&#]dummy/.test(location.href);
  const { S, end } = nightPlan(tier), SLUMP = .7, END = end + SLUMP + (good ? 1.9 : 2.3);
  const HB = [null, null, { n: .5, strong: 3, fount: 6 }, { n: 1.4, strong: 6, fount: 12 }, { n: 2.4, strong: 9, fount: 20, ring: 10 }][tier];
  const n = CX.length, y = new Float64Array(n), v = new Float64Array(n), surf = new Float64Array(n), sv = new Float64Array(n), rest = new Float64Array(n), hemL = new Float64Array(n), DT = 1 / 240;
  let t = 0, si = 0, hi = 0, sink = 0, sinkV = 0, bs = 0, bsV = 0, jy = 0, jyV = 0, jx = 0, jxV = 0, heat = 0, shakeAt = -9, shakeK = 0, buzz = 0, fount = 0;
  let pose = dummies(0, 0, 0, 0, 0, 0), dEnd = null, faceKey = '', finale = false, acc = 0, last = 0;
  // 위 사람 엉덩이 위치 d, 추가 들림 up, 떨림 tr
  function drive() {
    while (si < S.length - 1 && t >= S[si].t0 + S[si].T) si++;
    const s = S[si];
    if (t >= end) {
      if (dEnd == null) dEnd = drive.last;
      const u = Math.min(1, (t - end) / SLUMP);
      return [dEnd + (-2 - dEnd) * ease(u), 0, 0, ease(u)];
    }
    if (t < s.t0) return [0, 0, 0, 0];
    const tau = t - s.t0, rel = s.t0 + s.T - (s.kind === 'final' ? .14 : 0);
    let d, up = 0, tr = 0;
    if (tau < s.wu) d = s.from + (s.A - s.from) * ease(tau / s.wu);
    else if (tau < s.wu + s.sl) { const st = s.wu ? s.A : s.from; d = st + (-s.A - st) * ((tau - s.wu) / s.sl) ** 2.2; }
    else if (s.kind === 'final') {
      // 세게 누른 채 부들부들 떨림, 끝에 살짝 풀림
      const u = t - s.hit, env = (1 - Math.exp(-u * 30)) * (good ? 1 : .35) * (t > rel ? 1 - (t - rel) / .14 : 1);
      tr = env * .8 * Math.sin(6.283 * 15 * u);
      d = -s.A + env * (1.3 * Math.sin(6.283 * 12 * u) + .6 * Math.sin(6.283 * 19 * u)) + (t > rel ? 3 * ease((t - rel) / .14) : 0);
      buzz = env;
    } else d = -s.A + (s.to + s.A) * ease((t - s.hit) / (s.t0 + s.T - s.hit));
    if (d > 0) up = (s.kind === 'n' ? .15 : .35) * d;
    drive.last = d;
    return [d, up, tr, 0];
  }
  drive.last = 0;
  function surface(i) {
    const x = CX[i];
    let top = Math.min(129, capTop(PILLOW, x));
    for (const c of pose) top = Math.min(top, capTop(c, x));
    return top - 3.2;
  }
  function heart(x, y0, o = {}) {
    const el = document.createElementNS(NS, 'use');
    el.setAttribute('href', '#ntH');
    heartsEl.appendChild(el);
    hearts.push({ el, t0: t, x, y: y0, life: o.life || 1.6 + Math.random() * .7, dx: o.dx || 0, dy: o.dy ?? -(40 + Math.random() * 26), sway: o.dx ? 0 : (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 4), fq: .8 + Math.random() * .5, ph: Math.random() * 6.3, s: o.s || .65 + Math.random() * .4, big: !!o.big });
  }
  const hearts = [];
  const at = (arr, x) => { const k = Math.max(0, Math.min(n - 1.001, (x - CX[0]) / (CX[n - 1] - CX[0]) * (n - 1))), i = Math.floor(k); return arr[i] + (arr[i + 1] - arr[i]) * (k - i); };
  const burstAt = (cnt, o) => { for (let j = 0; j < cnt; j++) { const x = 150 + Math.random() * 70; heart(x, at(y, x) - 6, typeof o === 'function' ? o(j) : o); } };
  function impact(s) {
    const str = s.kind === 'final' ? 2.2 : s.kind === 'strong' ? 1.7 : s.A / 6.5;
    sinkV += 34 * str; bsV -= 16 * str;
    if (s.kind !== 'n') { jyV += 22 * str; jxV -= 9 * str; shakeAt = t; shakeK = str; }
    heat = Math.max(heat, good ? Math.min(1, .3 + .3 * str) : .12);
    if (!HB) return;
    if (s.kind === 'n') { const k = (s.t0 / end) * .6 + .4, m = HB.n * k; burstAt(Math.floor(m) + (Math.random() < m % 1 ? 1 : 0), {}); }
    else burstAt(HB.strong, () => ({ s: .95 + Math.random() * .45, dy: -(60 + Math.random() * 26) }));
    if (s.kind === 'final' && HB.ring) for (let j = 0; j < HB.ring; j++) { const a = Math.PI * (1.05 + .9 * j / (HB.ring - 1)), r = 46 + Math.random() * 16, hx = pose[6][2]; heart(hx, at(y, hx) - 4, { dx: Math.cos(a) * r, dy: Math.sin(a) * r * .8 - 10, s: .8 + Math.random() * .3, life: 1.3 }); }
  }
  // 실망: 말풍선(…), 만족감이 아주 낮으면 깨진 하트
  function letdown() {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<g transform="translate(64,24)"><g class="nt-bub"><path d="M6,0 H38 A6,6 0 0 1 44,6 V16 A6,6 0 0 1 38,22 H6 A6,6 0 0 1 0,16 V14 L-7,10.5 L0,8 V6 A6,6 0 0 1 6,0 Z" fill="#f2eee6"/>${[13, 22, 31].map((x, j) => `<circle class="nt-dot" cx="${x}" cy="11" r="2" fill="#6b6478" style="animation-delay:${.35 + j * .3}s"/>`).join('')}</g></g>` +
      (tier === 0 ? `<g transform="translate(196,70) scale(2.2)"><g class="nt-broke"><path class="l" d="M0,5 C-7,0 -6,-6 -2.5,-6 C-1,-6 0,-5 0,-4 L-1.2,-1.6 L1,.4 L-.9,2.6 Z" fill="#a39bb3"/><path class="r" d="M0,-4 C0,-5 1,-6 2.5,-6 C6,-6 7,0 0,5 L-.9,2.6 L1,.4 L-1.2,-1.6 Z" fill="#a39bb3"/></g></g>` : '');
    fx.appendChild(g);
  }
  function step() {
    t += DT;
    const [d, up, tr, slump] = drive();
    while (hi < S.length && S[hi].hit <= t) impact(S[hi++]);
    sinkV += (-500 * sink - 22 * sinkV) * DT; sink += sinkV * DT;
    bsV += (-300 * bs - 18 * bsV) * DT; bs += bsV * DT;
    jyV += (-900 * jy - 24 * jyV) * DT; jy += jyV * DT;
    jxV += (-700 * jx - 20 * jxV) * DT; jx += jxV * DT;
    pose = dummies(d, up, tr, slump, sink, bs);
    // 이불: 중력 + 장력(옆 점과의 차이) + 내부 감쇠, 몸에 닿으면 그 위에 얹히고 몸이 올라가는 속도를 받음
    for (let i = 0; i < n; i++) {
      const s0 = surf[i], s1 = surface(i);
      surf[i] = s1;
      const vs = Math.max(-150, Math.min(150, (s1 - s0) / DT));
      const yl = y[i - 1] ?? y[i], yr = y[i + 1] ?? y[i], vl = v[i - 1] ?? v[i], vr = v[i + 1] ?? v[i];
      v[i] += (1500 + 2200 * (yl - 2 * y[i] + yr) + 40 * (vl - 2 * v[i] + vr) - 2 * v[i]) * DT;
      sv[i] = vs;
    }
    for (let i = 0; i < n; i++) {
      y[i] += v[i] * DT;
      if (y[i] >= surf[i]) { y[i] = surf[i]; v[i] = Math.min(v[i], sv[i]); }
      hemL[i] += ((y[i] - rest[i]) * .32 - hemL[i]) * Math.min(1, DT * 7);
    }
    if (buzz) { shakeK = Math.max(shakeK, .35 * buzz); if (t - shakeAt > .05) shakeAt = t - .02; }
    buzz = 0;
    if (HB && t >= S[S.length - 1].t0 && t < end) { fount += HB.fount * DT; while (fount >= 1) { fount--; burstAt(1, { s: .8 + Math.random() * .5, dy: -(55 + Math.random() * 35) }); } }
    heat = Math.max(heat * Math.exp(-DT * 1.4), t < end ? (good ? .1 + .4 * Math.min(1, t / end) : .05) : 0);
    if (!finale && t > end + .45) {
      finale = true;
      if (good) heart(188, 86, { big: true, s: 1.4 + .3 * tier, life: 1.8, dy: -24 });
      else letdown();
    }
  }
  // 상대 표정 (관계 중 초상화)
  function faceNow() {
    const k = Math.min(1, t / end), ramp = S.find(s => s.kind !== 'n');
    if (t >= end + .3) return good ? (tier >= 3 ? 'bliss' : 'content') : 'disappointed';
    if (!good) return k < (tier ? .4 : .25) ? 'p0' : 'bored';
    if (t >= ramp.t0) return 'p3';
    return 'p' + (k < .3 ? 0 : k < .62 ? 1 : 2);
  }
  const yWithRest = () => { for (let i = 0; i < n; i++) { surf[i] = surface(i); y[i] = surf[i]; } for (let j = 0; j < 300; j++) { const tt = t; step(); t = tt; } rest.set(y); hemL.fill(0); };
  const curve = P => P.slice(0, -1).map((b, i) => {
    const a = P[i - 1] || b, c = P[i + 1], e = P[i + 2] || c;
    return ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`;
  }).join('');
  const hemY = x => 150 - 17 * Math.exp(-(((x - 66) / 22) ** 2)) + .9 * Math.sin(x * .13 + .6) + FOLDS.reduce((s, [c, lean]) => s + 1.6 * Math.exp(-(((x - c - lean) / 6) ** 2)), 0) + at(hemL, x);
  function draw() {
    const top = CX.map((x, i) => [x, y[i]]), hem = Array.from({ length: 9 }, (_, i) => { const x = 284 - 216 * i / 8; return [x, hemY(x)]; });
    const l = top[0], r = top[n - 1], hr = hem[0], hl = hem[8];
    quilt.setAttribute('d', `M${f(l[0])},${f(l[1])}${curve(top)} C285.5,${f(r[1] + 8)} 285.5,${f(hr[1] - 8)} ${f(hr[0])},${f(hr[1])}${curve(hem)} C${f(hl[0] - 5)},${f(hl[1] - 4)} ${f(l[0] - 5)},${f(l[1] + 6)} ${f(l[0])},${f(l[1])} Z`);
    rim.setAttribute('d', `M${f(l[0])},${f(l[1] + .8)}${curve(top.map(([x, yy]) => [x, yy + .8]))}`);
    hemEl.setAttribute('d', `M${f(hr[0])},${f(hr[1] - 1)}${curve(hem.map(([x, yy]) => [x, yy - 1]))}`);
    const sp = top.slice(3, -3).map(([x, yy]) => [x, Math.min(143, yy + 8)]);
    stitch.setAttribute('d', `M${f(sp[0][0])},${f(sp[0][1])}${curve(sp)}`);
    FOLDS.forEach(([x, lean], j) => {
      const yt = at(y, x), y0 = yt + Math.max(6, (147 - yt) * .3), y1 = hemY(x + lean) - 1.2, dyn = Math.max(-5, Math.min(5, -at(v, x) * .02));
      for (let k = 0; k < 2; k++) {
        const o = k * 1.8;
        folds[j * 2 + k].setAttribute('d', `M${f(x + o)},${f(y0 + k)} C${f(x + o - dyn * .4)},${f(y0 + (y1 - y0) * .45)} ${f(x + o + lean * .6 - dyn * .7)},${f(y1 - 5)} ${f(x + o + lean + dyn)},${f(y1)}`);
      }
    });
    if (debug) dummyEl.innerHTML = pose.map(([ax, ay, bx, by, r], k) => `<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}" stroke="${k < 5 ? '#7fc4ff' : '#ffb36b'}" stroke-width="${2 * r}"/>`).join('');
    const ago = t - shakeAt, sk = ago < .6 ? 1.5 * shakeK * Math.exp(-ago * 10) : 0;
    const cx = sk * Math.sin(ago * 95), cy = sk * .6 * Math.sin(ago * 120 + 1);
    cam.setAttribute('transform', sk > .02 ? `translate(${f(cx)},${f(cy)})` : '');
    bed.setAttribute('transform', `translate(${jx.toFixed(2)},${jy.toFixed(2)})`);
    warm.setAttribute('opacity', (heat * .9).toFixed(3));
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i], age = t - h.t0, k = age / h.life;
      if (k >= 1) { h.el.remove(); hearts.splice(i, 1); continue; }
      const pop = k < .12 ? .4 + .7 * k / .12 : k < .2 ? 1.1 - (k - .12) / .8 : 1;
      const lub = h.big ? 1 + .16 * Math.exp(-((((age % .9) - .15) / .045) ** 2)) + .1 * Math.exp(-((((age % .9) - .35) / .045) ** 2)) : 1;
      const w = Math.sin(6.283 * h.fq * age + h.ph), m = 1 - (1 - k) ** 2;
      h.el.setAttribute('transform', `translate(${f(h.x + h.dx * m + h.sway * w)},${f(h.y + h.dy * m)}) rotate(${f(h.sway * 1.6 * Math.cos(6.283 * h.fq * age + h.ph))}) scale(${(h.s * pop * lub).toFixed(3)})`);
      h.el.setAttribute('opacity', (k < .1 ? k / .1 : k > .6 ? (1 - k) / .4 : 1).toFixed(2));
    }
    if (face) {
      const key = faceNow();
      if (key !== faceKey) {
        faceKey = key;
        const during = key[0] === 'p' && key.length === 2 ? { lv: +key[1] } : { mood: key };
        face.innerHTML = Avatar.render(G.look(p), 64, { age: G.npcAge(p), during: Object.assign(during, { personality: p.personality, fig: sc.fig }) });
      }
      face.style.transform = sk > .02 ? `translate(${f(cx * 1.2)}px,${f(cy * 1.2)}px)` : '';
    }
  }
  function frame(now) {
    acc += last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
    while (acc >= DT) { step(); acc -= DT; }
    draw();
    if (t < END) nightRaf = requestAnimationFrame(frame);
    else done();
  }
  if (debug) quilt.setAttribute('opacity', '.45');
  yWithRest();
  draw();
  nightRaf = requestAnimationFrame(frame);
}
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
  const pregQ = sc.preg ? [`<div class="sc-card">${CONCEIVE}<p class="sc-later">몇 주 뒤…</p><button type="button" data-sc-next>계속</button></div>`] : [];
  nightJob = { sc, p };
  sceneQueue = (calm ? [] : [`<div class="sc-night"><p class="sc-t">그날 밤</p><div class="nt-stage">${NIGHT}<div class="nt-face"></div></div></div>`]).concat(morningQ, pregQ);
  nextScene();
}
function nextScene() {
  clearTimeout(sceneTimer); cancelAnimationFrame(nightRaf);
  if (sceneQueue.length) {
    const html = sceneQueue.shift();
    sceneCard(html);
    const night = sceneBox.querySelector('.sc-night svg');
    if (night) runNight(night, nightJob, () => { sceneTimer = setTimeout(nextScene, 500); });
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
  if (sceneBox.querySelector('.sc-night')) nextScene();
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
  const who = ev.who && window.Avatar ? `<div class="ev-who">${Avatar.render(ev.who.look, 60, ev.who.age)}<span><b>${esc(ev.who.name)}</b><br><span class="dim">${ev.who.age}살, ${esc(ev.who.rel)}</span></span></div>` : '';
  showModal('event', `${S.age}살 ${se.icon} ${se.id} ${wxIcon(S.weather)}`,
    `${who}<p>${esc(ev.text)}</p><div class="choices">${ev.choices.map((c, i) => `<button type="button" data-c="${i}">[${i + 1}] ${esc(c)}</button>`).join('')}</div>`, false, ev.text);
}

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
  const im = G.intimacy(p);
  const imHTML = im ? `<div class="stats">
      <span>${G.LABEL.libido}</span><span class="bar${im.libido >= 60 ? ' low' : ''}">${bar(im.libido)}</span><span class="num">${im.libido}</span>
      ${im.nights ? `<span>궁합</span><span class="bar">${bar(im.compat || 0)}</span><span class="num">${im.compat || 0}</span>
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
  const rows = G.subjects.map(x => `<button type="button" data-s="${x.id}">${x.label} <small>${S.school.subj[x.id]}</small></button>`).join('');
  showModal('study', '📚 무슨 공부?', `<div class="igrid">${rows}<button type="button" data-s="all">골고루</button></div>
    <p class="hint">과목 하나에 집중하면 많이, 골고루 하면 조금씩 오른다. 숫자는 지금 실력.</p>`);
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
    const subj = G.subjects.map(x => `<span>${x.label}</span><span class="bar">${bar(sc.subj[x.id])}</span><span class="num">${sc.subj[x.id]}</span>`).join('');
    const lines = [];
    if (G.naesinAvg() != null) lines.push(`내신 평균 ${G.naesinAvg().toFixed(1)}등급 (${sc.naesin.map(v => v.toFixed(1)).join(' → ')})`);
    if (sc.mock) lines.push(`최근 모의고사 평균 ${sc.mock.avg.toFixed(1)}등급`);
    if (sc.sat) lines.push(`수능 평균 ${sc.sat.avg.toFixed(1)}등급 (${G.subjects.map(x => x.label + ' ' + sc.sat[x.id]).join(', ')})`);
    if (G.univLabel()) lines.push(`${G.univLabel()} ${G.majorLabel() || ''}${sc.gpaN ? `, 학점 ${sc.gpa.toFixed(2)}` : ''}${sc.degree ? ' 졸업' : ''}`);
    school = `<p class="sec-t">성적표</p>${S.age <= 18 && !sc.sat ? `<div class="subj">${subj}</div>` : ''}${lines.map(l => `<p class="dim" style="font-size:13px">${esc(l)}</p>`).join('')}`;
  }
  const me = G.myLook() && window.Avatar ? avBtn('me', Avatar.render(G.myLook(), 60, S.age)) : '';
  showModal('me', `📋 ${S.name}`, `
    <div class="me-top">${me}<dl class="prof">${prof}</dl></div>
    ${fullView === 'me' && G.myLook() ? fullAv(G.myLook(), S.age, G.figure(null), S.personality) : ''}
    ${S.preg && S.preg.mode ? `<p class="dim" style="font-size:13px">${S.gender === 'f' ? '임신 중' : '곧 아이가 태어난다'} — ${S.preg.due > S.age ? '내년' : '올해'} 출산 예정</p>` : ''}
    <p class="sec-t">능력치</p>
    <div class="stats">${ab}</div>
    <p class="hint">능력치는 100에서 멈추지 않는다. F부터 SS까지, 등급이 오를수록 올리기 어렵다.</p>
    ${school}`);
}

/* 새 인생: 특성 고르기 */
const CREATE_FIELDS = [
  ['gender', '성별', [{ id: 'm', label: '남' }, { id: 'f', label: '여' }]],
  ['trait', '소질', null], ['personality', '성격', null], ['wealth', '집안', null],
  ['hobby', '취미', null], ['value', '가치관', null], ['dream', '꿈', null], ['sibling', '형제', null],
  ['month', '생일', Array.from({ length: 12 }, (_, i) => ({ id: i + 1, label: `${i + 1}월` }))],
];
const SRC = { trait: 'traits', personality: 'personalities', wealth: 'wealth', hobby: 'hobbies', value: 'values', dream: 'dreams', sibling: 'siblings' };
let draft = null;
const optsOf = f => f[2] || G.creation[SRC[f[0]]];
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
function randomDraft() {
  const d = { name: '' };
  CREATE_FIELDS.forEach(f => { d[f[0]] = rnd(optsOf(f)).id; });
  return d;
}
function openCreate(closable) {
  if (!draft) draft = randomDraft();
  const fields = CREATE_FIELDS.map(f => {
    const opts = optsOf(f);
    const sel = opts.find(o => o.id === draft[f[0]]);
    return `<div class="fld"><div class="fl"><span>${f[1]}</span><button type="button" class="dice" data-rf="${f[0]}" aria-label="${f[1]} 랜덤">🎲</button></div>
      <div class="chips">${opts.map(o => `<button type="button" data-cf="${f[0]}" data-cv="${o.id}" aria-pressed="${o.id === draft[f[0]]}">${esc(o.label)}</button>`).join('')}</div>
      ${sel && sel.desc ? `<p class="desc">${esc(sel.desc)}</p>` : ''}</div>`;
  }).join('');
  showModal('create', '🌱 새 인생', `<div class="create">
    <div class="fld"><div class="fl"><span>이름 (비우면 랜덤)</span></div><input id="cName" maxlength="6" value="${esc(draft.name)}" placeholder="예: 김하늘" autocomplete="off"></div>
    ${fields}
    <div class="create-go"><button type="button" data-rall>🎲 전부 랜덤</button><button type="button" class="go" data-go>태어나기</button></div>
  </div>`, !!closable, 'create');
}
function createClick(b) {
  const d = b.dataset;
  const nameEl = $('#cName'); if (nameEl) draft.name = nameEl.value;
  if (d.cf) { const f = CREATE_FIELDS.find(x => x[0] === d.cf); draft[d.cf] = typeof optsOf(f)[0].id === 'number' ? +d.cv : d.cv; }
  else if (d.rf) { const f = CREATE_FIELDS.find(x => x[0] === d.rf); draft[d.rf] = rnd(optsOf(f)).id; }
  else if ('rall' in d) { const n = draft.name; draft = randomDraft(); draft.name = n; }
  else if ('go' in d) { const opt = draft; draft = null; G.newLife(opt); closeModal(); return; }
  const top = mBody.scrollTop;
  openCreate(!$('#mClose').hidden);
  mBody.scrollTop = top;
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
    <p class="dim">${esc(S.name)}<br>${esc(G.roleText())}, 재산 ${G.fmtMoney(S.money)}${S.record ? `, 전과 ${S.record}회` : ''}<br>${G.univLabel() ? esc(`${G.univLabel()} ${G.majorLabel() || ''}${S.school.degree ? ' 졸업' : ''}`) + '<br>' : ''}꿈: ${esc(S.vars.dreamLabel)} — ${dreamDone(S) ? '이뤘다' : '아직'}<br>업보: ${G.karmaLabel()}<br>곁에 있는 사람: ${esc(close)}</p>
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
$('#ageUp').addEventListener('click', () => { const S = G.state(); if (S.ended) { draft = null; openCreate(true); } else G.ageUp(); });
$('#peopleBtn').addEventListener('click', () => { personFrom = 'people'; openPeople(); });
$('#jobBtn').addEventListener('click', openJobs);
$('#crimeBtn').addEventListener('click', openCrime);
$('#restart').addEventListener('click', confirmRestart);
$('#mClose').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal && !$('#mClose').hidden) closeModal(); });
mBody.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (modalMode === 'create') { createClick(b); return; }
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
