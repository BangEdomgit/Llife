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
// 함께 밤을 보낸 뒤: ♂♀ 맞물림 → 💓 → 암전 → 다음 날 아침(초상화 + 아침 한 줄 + 바닥의 옷) → (임신이면) 정자·난자
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
function blanketSVG(shape, build) {
  const bm = build === 'slim' ? .88 : build === 'chubby' ? 1.12 : 1;
  const fsk = '#e2c3a0', fskD = '#b89071', fskL = '#f0d4b2'; // female: lighter
  const msk = '#b89675', mskD = '#8a6a4a';                    // male: darker
  const hrF = '#2a1e18', hrM = '#1e1612', nip = '#9a6650';
  const mattress = `<rect x="0" y="92" width="200" height="10" rx="3" fill="#1e1814" opacity=".55"/><rect x="0" y="102" width="200" height="6" rx="2" fill="#261e18"/>`;
  const pillow = `<ellipse cx="28" cy="80" rx="22" ry="9" fill="#e8dfd0" opacity=".7"/><ellipse cx="28" cy="78" rx="18" ry="6" fill="#f4ece0" opacity=".4"/>`;
  let base = '', active = '';
  if (shape === 'A') {
    // 정상위: 여자 누움(아래), 남자 위에서 (base=여, active=남)
    base = `<g class="pose-base">${pillow}
      <!-- 여자 긴 머리 베개 위 퍼짐 -->
      <path d="M12,72 Q8,80 10,88 Q16,90 22,86 Q18,78 20,70 Z" fill="${hrF}" opacity=".85"/>
      <path d="M14,70 Q10,74 12,80 L18,80 Q20,74 20,70 Z" fill="${hrF}" opacity=".7"/>
      <!-- 여자 머리 -->
      <circle cx="30" cy="72" r="8.5" fill="${fsk}"/>
      <path d="M22,70 Q22,62 30,61 Q38,62 38,70 Q38,74 36,76 L24,76 Q22,74 22,70 Z" fill="${hrF}" opacity=".92"/>
      <!-- 얼굴 디테일: 눈 감김 + 입 -->
      <path d="M26,72 Q27.5,71.5 29,72" stroke="${mskD}" stroke-width=".6" fill="none" opacity=".6"/>
      <path d="M32,72 Q33.5,71.5 35,72" stroke="${mskD}" stroke-width=".6" fill="none" opacity=".6"/>
      <ellipse cx="30.5" cy="76" rx="1.5" ry=".6" fill="#c75858" opacity=".55"/>
      <!-- 목 -->
      <path d="M27,78 L34,78 L35,82 L26,82 Z" fill="${fsk}"/>
      <!-- 어깨→토르소→가슴(옆에서 본 반원) -->
      <path d="M26,82 L35,82 Q42,82 48,83 L56,85 Q62,86 68,86 L80,88 L80,94 L38,94 Z" fill="${fsk}" opacity=".92"/>
      <!-- 가슴 두 봉우리 (옆얼굴 뷰) -->
      <path d="M48,83 Q52,78 56,79 Q58,82 56,85 Q53,86 48,85 Z" fill="${fsk}"/>
      <circle cx="55" cy="81.5" r="${1.1 * bm}" fill="${nip}" opacity=".7"/>
      <path d="M60,85 Q64,80 68,81 Q70,84 68,87 Q65,88 60,87 Z" fill="${fsk}" opacity=".9"/>
      <circle cx="67" cy="83" r="${1 * bm}" fill="${nip}" opacity=".6"/>
      <!-- 무릎 세운 다리(V자): 왼다리 세움 -->
      <path d="M68,88 Q78,70 92,58 Q98,56 102,60 Q104,66 98,70 Q86,78 80,90 Z" fill="${fsk}" opacity=".9"/>
      <!-- 오른다리 세움 -->
      <path d="M76,90 Q90,74 106,66 Q112,66 114,72 Q112,76 108,78 Q94,86 86,94 Z" fill="${fsk}" opacity=".88"/>
      <!-- 다리 음영 -->
      <path d="M86,82 Q94,72 102,66" stroke="${fskD}" stroke-width=".8" fill="none" opacity=".5"/>
    </g>`;
    active = `<g class="pose-active">
      <!-- 남자: 위에서 덮친 자세, 상체 아치 -->
      <!-- 머리 (앞쪽 보고 숙임) -->
      <circle cx="80" cy="40" r="7.5" fill="${msk}"/>
      <path d="M72,38 Q72,30 80,30 Q88,30 88,38 Q88,42 86,44 L74,44 Q72,42 72,38 Z" fill="${hrM}" opacity=".95"/>
      <path d="M74,36 L86,36" stroke="${hrM}" stroke-width="1" opacity=".7"/>
      <!-- 목 뒤 -->
      <path d="M77,46 L84,46 L84,50 L77,50 Z" fill="${msk}"/>
      <!-- 넓은 어깨+등 아치(위에서 아래로 숙임) -->
      <path d="M73,48 Q66,52 68,56 L74,60 Q78,66 82,72 L88,80 L96,82 Q100,80 98,76 L94,70 Q92,62 92,56 L94,50 Q92,46 86,46 Z" fill="${msk}" opacity=".95"/>
      <!-- 등근육 음영 -->
      <path d="M78,54 Q82,60 86,66" stroke="${mskD}" stroke-width=".8" fill="none" opacity=".5"/>
      <!-- 왼팔 (여자 옆 바닥 짚기) -->
      <path d="M70,52 Q58,58 52,70 Q50,76 54,80 Q58,80 60,76 Q66,66 74,60 Z" fill="${msk}" opacity=".92"/>
      <circle cx="54" cy="78" r="3" fill="${msk}"/>
      <!-- 오른팔 (여자 어깨 옆 짚기) -->
      <path d="M90,50 Q104,54 112,66 Q114,72 110,76 Q106,76 104,72 Q96,62 88,56 Z" fill="${msk}" opacity=".9"/>
      <circle cx="110" cy="74" r="3" fill="${msk}"/>
      <!-- 엉덩이+다리 (뒤에서 보임) -->
      <path d="M88,80 Q94,84 96,88 L100,94 L108,94 L106,88 Q104,82 100,80 Z" fill="${msk}" opacity=".88"/>
      <path d="M94,88 L112,92 L118,94 L96,94 Z" fill="${msk}" opacity=".82"/>
      <!-- 엉덩이 라인 -->
      <path d="M94,84 Q98,86 102,88" stroke="${mskD}" stroke-width=".8" fill="none" opacity=".5"/>
    </g>`;
  } else if (shape === 'B') {
    // 기승위: 남자 아래 누움(base), 여자 위에 올라탐(active)
    base = `<g class="pose-base">${pillow}
      <!-- 남자 머리 (베개 위) -->
      <circle cx="30" cy="78" r="8" fill="${msk}"/>
      <path d="M22,76 Q22,69 30,69 Q38,69 38,76 Q38,80 36,82 L24,82 Q22,80 22,76 Z" fill="${hrM}" opacity=".95"/>
      <!-- 얼굴: 입 벌림 (쾌감) -->
      <path d="M27,78 Q28,77.5 29,78" stroke="${mskD}" stroke-width=".7" fill="none" opacity=".65"/>
      <path d="M31,78 Q32,77.5 33,78" stroke="${mskD}" stroke-width=".7" fill="none" opacity=".65"/>
      <ellipse cx="30" cy="82" rx="1.6" ry="1" fill="#4a2a20" opacity=".65"/>
      <!-- 목 -->
      <path d="M27,84 L34,84 L35,88 L26,88 Z" fill="${msk}"/>
      <!-- 남자 넓은 가슴·몸통 (누운) -->
      <path d="M24,86 Q22,88 24,92 L80,92 Q86,92 90,90 L82,86 L46,84 Z" fill="${msk}" opacity=".92"/>
      <!-- 가슴근육 라인 -->
      <path d="M44,86 Q48,89 52,90" stroke="${mskD}" stroke-width=".9" fill="none" opacity=".55"/>
      <path d="M58,86 Q62,89 66,90" stroke="${mskD}" stroke-width=".9" fill="none" opacity=".55"/>
      <!-- 왼팔 (여자 허리 잡음) -->
      <path d="M46,88 Q50,80 60,76 Q66,74 70,78 Q72,82 68,84 Q60,86 54,90 Z" fill="${msk}" opacity=".88"/>
      <!-- 오른팔 -->
      <path d="M66,88 Q70,80 80,76 Q86,74 90,78 Q92,82 88,84 Q80,86 74,90 Z" fill="${msk}" opacity=".88"/>
    </g>`;
    active = `<g class="pose-active">
      <!-- 여자: 위에 올라타 상체 세움 (측면 뷰) -->
      <!-- 긴 머리 등 뒤 -->
      <path d="M74,24 Q68,28 68,38 Q68,48 72,52 Q76,46 76,36 Q76,28 74,24 Z" fill="${hrF}" opacity=".88"/>
      <path d="M70,34 Q66,42 68,52" stroke="${hrF}" stroke-width=".8" fill="none" opacity=".6"/>
      <!-- 머리 -->
      <circle cx="80" cy="26" r="7.5" fill="${fsk}"/>
      <path d="M72,24 Q72,16 80,16 Q88,16 88,24 Q88,28 86,30 L74,30 Q72,28 72,24 Z" fill="${hrF}" opacity=".95"/>
      <!-- 얼굴 -->
      <path d="M77,27 Q78,26.5 79,27" stroke="${mskD}" stroke-width=".6" fill="none" opacity=".7"/>
      <path d="M82,27 Q83,26.5 84,27" stroke="${mskD}" stroke-width=".6" fill="none" opacity=".7"/>
      <ellipse cx="80.5" cy="30.5" rx="1.3" ry=".6" fill="#c75858" opacity=".7"/>
      <!-- 목 -->
      <path d="M77,32 L84,32 L85,36 L76,36 Z" fill="${fsk}"/>
      <!-- 상체 세움 (허리 S라인) -->
      <path d="M74,36 Q68,46 70,58 Q72,70 76,78 L92,78 Q96,70 98,58 Q100,46 94,36 Z" fill="${fsk}" opacity=".93"/>
      <!-- 가슴 두 봉우리 (측면이지만 정면 쪽) -->
      <path d="M74,42 Q76,36 82,37 Q84,42 82,46 Q77,47 74,46 Z" fill="${fsk}"/>
      <circle cx="81" cy="40" r="${1.3 * bm}" fill="${nip}" opacity=".75"/>
      <path d="M86,42 Q88,36 94,37 Q96,42 94,46 Q89,47 86,46 Z" fill="${fskL}" opacity=".95"/>
      <circle cx="93" cy="40" r="${1.3 * bm}" fill="${nip}" opacity=".75"/>
      <!-- 배꼽 -->
      <circle cx="84" cy="56" r=".8" fill="${fskD}" opacity=".5"/>
      <!-- 허리 음영 -->
      <path d="M72,52 Q84,54 96,52" stroke="${fskD}" stroke-width=".6" fill="none" opacity=".4"/>
      <!-- 왼팔 (뒤로 짚음) -->
      <path d="M72,46 Q62,54 58,66 Q58,72 62,74 Q66,74 66,70 Q68,60 76,52 Z" fill="${fsk}" opacity=".9"/>
      <circle cx="62" cy="72" r="2.8" fill="${fsk}"/>
      <!-- 오른팔 (앞으로 가슴/허리) -->
      <path d="M96,46 Q106,54 110,66 Q110,72 106,74 Q102,74 102,70 Q100,60 92,52 Z" fill="${fsk}" opacity=".9"/>
      <circle cx="106" cy="72" r="2.8" fill="${fsk}"/>
      <!-- 다리: 남자 허리 양옆으로 벌림 (무릎 접음) -->
      <path d="M76,78 Q68,84 64,92 L58,92 Q58,86 62,80 Q66,76 70,76 Z" fill="${fsk}" opacity=".88"/>
      <path d="M92,78 Q100,84 104,92 L110,92 Q110,86 106,80 Q102,76 98,76 Z" fill="${fsk}" opacity=".88"/>
    </g>`;
  } else {
    // 후배위: 여자 네발 (base), 남자 뒤에서 (active)
    base = `<g class="pose-base">
      <!-- 여자 긴 머리 아래로 -->
      <path d="M24,52 Q18,62 20,74 Q24,78 30,74 Q28,66 30,56 Z" fill="${hrF}" opacity=".88"/>
      <path d="M22,60 Q18,70 22,76" stroke="${hrF}" stroke-width=".8" fill="none" opacity=".6"/>
      <!-- 머리 (앞으로 숙임) -->
      <circle cx="30" cy="52" r="7.5" fill="${fsk}"/>
      <path d="M22,50 Q22,42 30,42 Q38,42 38,50 Q38,54 36,56 L24,56 Q22,54 22,50 Z" fill="${hrF}" opacity=".95"/>
      <!-- 목 (앞으로) -->
      <path d="M30,58 L36,58 L38,64 L32,64 Z" fill="${fsk}"/>
      <!-- 등 아치 (어깨→허리→엉덩이) -->
      <path d="M32,60 Q40,58 50,58 L68,60 Q82,62 92,66 L102,72 Q104,76 102,80 L96,86 Q82,86 68,84 Q50,80 36,72 Q30,66 32,60 Z" fill="${fsk}" opacity=".94"/>
      <!-- 등 중앙 음영 -->
      <path d="M42,62 Q60,66 78,70 Q88,74 96,78" stroke="${fskD}" stroke-width=".9" fill="none" opacity=".5"/>
      <!-- 엉덩이 라인 -->
      <path d="M92,74 Q98,78 102,82" stroke="${fskD}" stroke-width=".9" fill="none" opacity=".55"/>
      <!-- 아래로 늘어진 가슴 -->
      <ellipse cx="48" cy="72" rx="${5 * bm}" ry="${7 * bm}" fill="${fsk}" opacity=".92"/>
      <circle cx="48" cy="77" r="${1.3 * bm}" fill="${nip}" opacity=".75"/>
      <ellipse cx="62" cy="72" rx="${5 * bm}" ry="${7 * bm}" fill="${fskL}" opacity=".95"/>
      <circle cx="62" cy="77" r="${1.3 * bm}" fill="${nip}" opacity=".7"/>
      <!-- 양팔 바닥 짚음 -->
      <path d="M34,66 Q28,76 26,86 Q26,92 32,92 Q34,86 36,76 Z" fill="${fsk}" opacity=".9"/>
      <circle cx="30" cy="90" r="3" fill="${fsk}"/>
      <path d="M46,68 Q42,76 40,86 Q40,92 46,92 Q48,86 50,78 Z" fill="${fsk}" opacity=".88"/>
      <circle cx="44" cy="90" r="3" fill="${fsk}"/>
      <!-- 무릎 꿇은 다리 -->
      <path d="M86,80 Q88,86 86,92 L78,92 Q76,86 78,80 Z" fill="${fsk}" opacity=".88"/>
      <path d="M98,80 Q102,86 100,92 L92,92 Q90,86 92,80 Z" fill="${fsk}" opacity=".88"/>
    </g>`;
    active = `<g class="pose-active">
      <!-- 남자: 여자 뒤에서 무릎 꿇음, 허리 잡음 -->
      <!-- 머리 -->
      <circle cx="140" cy="40" r="7.5" fill="${msk}"/>
      <path d="M132,38 Q132,30 140,30 Q148,30 148,38 Q148,42 146,44 L134,44 Q132,42 132,38 Z" fill="${hrM}" opacity=".95"/>
      <path d="M134,36 L146,36" stroke="${hrM}" stroke-width="1" opacity=".7"/>
      <!-- 목 -->
      <path d="M137,46 L144,46 L144,50 L137,50 Z" fill="${msk}"/>
      <!-- 상체 (앞으로 숙임) -->
      <path d="M132,50 Q126,54 128,62 L132,72 Q136,78 142,80 L150,80 Q156,78 158,72 L160,62 Q162,54 156,50 Z" fill="${msk}" opacity=".94"/>
      <!-- 가슴근육 -->
      <path d="M136,58 Q140,60 142,62" stroke="${mskD}" stroke-width=".8" fill="none" opacity=".5"/>
      <path d="M150,58 Q154,60 156,62" stroke="${mskD}" stroke-width=".8" fill="none" opacity=".5"/>
      <!-- 왼팔 (여자 허리 잡음, 앞으로) -->
      <path d="M130,56 Q118,62 108,70 Q104,74 108,78 Q112,78 116,74 Q124,66 134,62 Z" fill="${msk}" opacity=".9"/>
      <circle cx="110" cy="76" r="2.8" fill="${msk}"/>
      <!-- 오른팔 -->
      <path d="M158,56 Q166,62 168,70 Q168,74 164,74 Q160,72 158,66 Z" fill="${msk}" opacity=".88"/>
      <!-- 엉덩이+다리 (무릎 꿇음, 뒤에서) -->
      <path d="M138,80 Q134,86 134,92 L144,92 L146,86 Z" fill="${msk}" opacity=".88"/>
      <path d="M150,80 Q154,86 154,92 L164,92 L162,86 Z" fill="${msk}" opacity=".88"/>
      <!-- 엉덩이 음영 -->
      <path d="M140,82 Q148,82 156,82" stroke="${mskD}" stroke-width=".8" fill="none" opacity=".5"/>
    </g>`;
  }
  return `<svg class="blanket-svg" viewBox="0 0 200 110">${mattress}${base}${active}</svg>`;
}
function phaseCard(sc, p, phase, shape, icon) {
  const look = G.look(p), age = G.npcAge(p);
  const avatarPhase = phase === 'climax' ? 3 : phase === 'end' ? 4 : phase;
  const duringState = { age, duringIntimate: avatarPhase, personality: sc.personality || p.personality, fig: sc.fig };
  const portrait = Avatar.render(look, 90, duringState);
  const particles = phase === 'climax' ? Array.from({ length: 4 }, (_, i) => {
    const dx = (Math.random() * 120 - 60) + 'px', dy = -(40 + Math.random() * 60) + 'px';
    return `<div class="sc-particle" style="left:${20 + Math.random() * 60}%;top:${30 + Math.random() * 40}%;--dx:${dx};--dy:${dy};animation-delay:${i * .15}s"></div>`;
  }).join('') : '';
  const cls = typeof phase === 'number' ? `phase${phase + 1}` : phase === 'climax' ? 'phase-climax' : 'phase-end';
  return `<div class="sc-phase ${cls}"><div class="portrait">${portrait}</div><div class="blanket-side"><div class="sym"><svg viewBox="0 0 100 56" aria-hidden="true"><g class="f-sym"><circle cx="58" cy="28" r="11" fill="none" stroke="#ff69b4" stroke-width="2.4"/><line x1="58" y1="39" x2="58" y2="52" stroke="#ff69b4" stroke-width="2.4"/><line x1="52" y1="46" x2="64" y2="46" stroke="#ff69b4" stroke-width="2.4"/></g><g class="m-sym"><circle cx="28" cy="28" r="11" fill="none" stroke="#4da6ff" stroke-width="2.4"/><line x1="39" y1="28" x2="66" y2="28" stroke="#4da6ff" stroke-width="2.4"/><polyline points="60,22 66,28 60,34" fill="none" stroke="#4da6ff" stroke-width="2.4"/></g></svg></div>${blanketSVG(shape, p.body && p.body.build)}<div class="beat-icon">${icon}</div></div><div class="sc-redden"></div>${particles ? `<div class="sc-particles">${particles}</div>` : ''}<div class="sc-flash"></div></div>`;
}
function foreplayCard(sc, p) {
  const fl = p.gender === 'f';
  const head = (cx, cy) => `<path d="M${cx},${cy - 13} C${cx - 12},${cy - 13} ${cx - 14},${cy - 4} ${cx - 13},${cy + 2} C${cx - 12},${cy + 8} ${cx - 8},${cy + 13} ${cx - 3},${cy + 15} L${cx + 3},${cy + 15} C${cx + 8},${cy + 13} ${cx + 12},${cy + 8} ${cx + 13},${cy + 2} C${cx + 14},${cy - 4} ${cx + 12},${cy - 13} ${cx},${cy - 13} Z" class="fp-fill"/>`;
  const fBodyL = '<path d="M64,46 C56,48 52,56 51,64 C50,70 52,76 55,82 C51,88 49,98 49,110 C49,122 50,134 52,150 L62,150 L64,116 L68,150 L78,150 C80,134 82,122 82,110 C82,98 80,88 76,82 C79,76 80,70 79,64 C78,56 74,48 66,46 Z" class="fp-fill"/>';
  const fBodyR = '<path d="M128,46 C120,48 116,56 115,64 C114,70 116,76 119,82 C115,88 113,98 113,110 C113,122 114,134 116,150 L126,150 L128,116 L132,150 L142,150 C144,134 146,122 146,110 C146,98 144,88 140,82 C143,76 144,70 143,64 C142,56 138,48 130,46 Z" class="fp-fill"/>';
  const mBodyL = '<path d="M62,46 C54,48 48,54 47,64 C46,72 48,80 52,86 C48,92 46,102 46,114 C46,126 48,138 50,150 L62,150 L64,116 L68,150 L80,150 C82,138 84,126 84,114 C84,102 82,92 78,86 C82,80 84,72 83,64 C82,54 76,48 68,46 Z" class="fp-fill"/>';
  const mBodyR = '<path d="M126,46 C118,48 112,54 111,64 C110,72 112,80 116,86 C112,92 110,102 110,114 C110,126 112,138 114,150 L126,150 L128,116 L132,150 L144,150 C146,138 148,126 148,114 C148,102 146,92 142,86 C146,80 148,72 147,64 C146,54 140,48 132,46 Z" class="fp-fill"/>';
  const lBody = fl ? fBodyL : mBodyL, rBody = fl ? mBodyR : fBodyR;
  const lH = fl ? 28 : 30, rH = fl ? 30 : 28;
  const arm = '<path d="M78,68 Q92,60 110,66 Q114,72 110,76 Q94,66 80,74 Z" class="fp-fill"/>';
  return `<div class="sc-foreplay"><svg viewBox="0 0 200 160">${head(64, lH)}${lBody}${head(128, rH)}${rBody}${arm}</svg></div>`;
}
function uterusSVG(preg) {
  const anim = preg ? 'G' : 'B';
  const sperm = [1, 2, 3, 4, 5, 6, 7].map(i => {
    const x = 195 + (i % 3) * 12 - 12, delay = (i * .3).toFixed(1);
    const dx = preg && i <= 2 ? -135 : -60 - i * 12, dy = preg && i <= 2 ? -155 : -80 - i * 8;
    const fade = preg && i <= 2 ? 1 : 0;
    return `<g class="sp-u" style="animation:spU${anim}${i} 3s ease-in ${delay}s forwards"><ellipse cx="${x}" cy="240" rx="4.5" ry="3" fill="#f4f4f4"/><path class="tail" d="M${x - 4.5},240 q-5,-4 -10,0 t-10,0 t-10,0" fill="none" stroke="#f4f4f4" stroke-width="1.3"/></g>
      <style>@keyframes spU${anim}${i}{0%{transform:translate(0,0);opacity:1}60%{opacity:${fade || .8}}100%{transform:translate(${dx}px,${dy}px);opacity:${fade}}}</style>`;
  }).join('');
  return `<div class="sc-uterus"><svg viewBox="0 0 400 280">
    <defs><radialGradient id="ug" cx="50%" cy="40%"><stop offset="0" stop-color="#fde0d8" stop-opacity=".5"/><stop offset="1" stop-color="#e4a098" stop-opacity=".3"/></radialGradient></defs>
    <path d="M155,85 C155,55 170,40 200,40 C230,40 245,55 245,85 L245,185 Q245,225 200,225 Q155,225 155,185 Z" fill="url(#ug)"/>
    <path d="M155,85 C155,55 170,40 200,40 C230,40 245,55 245,85 L245,185 Q245,225 200,225 Q155,225 155,185 Z" fill="none" stroke="#d98a7e" stroke-width="5" stroke-linejoin="round"/>
    <path d="M161,85 C161,58 174,46 200,46 C226,46 239,58 239,85 L239,183 Q239,219 200,219 Q161,219 161,183 Z" fill="none" stroke="#e4a8a0" stroke-width="2" opacity=".5"/>
    <path d="M155,85 Q130,60 95,52 Q72,48 55,55 Q42,62 38,78" fill="none" stroke="#d98a7e" stroke-width="5" stroke-linecap="round"/>
    <path d="M38,78 Q34,86 28,88 Q20,90 16,84 Q12,76 18,68 Q24,60 36,56" fill="none" stroke="#d98a7e" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M245,85 Q270,60 305,52 Q328,48 345,55 Q358,62 362,78" fill="none" stroke="#d98a7e" stroke-width="5" stroke-linecap="round"/>
    <path d="M362,78 Q366,86 372,88 Q380,90 384,84 Q388,76 382,68 Q376,60 364,56" fill="none" stroke="#d98a7e" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse class="ovary" cx="28" cy="75" rx="16" ry="12"/><circle cx="24" cy="72" r="4" fill="#fff2e6" opacity=".7"/><circle cx="32" cy="78" r="3" fill="#fff2e6" opacity=".5"/>
    <ellipse class="ovary" cx="372" cy="75" rx="16" ry="12"/><circle cx="368" cy="72" r="4" fill="#fff2e6" opacity=".7"/><circle cx="376" cy="78" r="3" fill="#fff2e6" opacity=".5"/>
    <path d="M185,230 Q200,245 215,230" fill="none" stroke="#d98a7e" stroke-width="4" stroke-linecap="round"/>
    ${sperm}${preg ? '<circle class="egg-target" cx="38" cy="72" r="6" fill="#ffd9a8" opacity="0" style="animation:eggGlow .6s ease-out 3.2s forwards"/><style>@keyframes eggGlow{to{opacity:.85;r:14}}</style>' : ''}</svg></div>`;
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
  const internal = sc.contra === 'none' || sc.contra === 'pill';
  const uterusQ = internal ? [`<div class="sc-card">${uterusSVG(!!sc.preg)}<p class="sc-later" style="color:#aaa;margin-top:8px">${sc.preg ? '몇 주 뒤…' : ''}</p><button type="button" data-sc-next>계속</button></div>`] : [];
  const morningQ = [`<div class="sc-card sc-morning">${morningCard(sc, p)}</div>`];
  const pregQ = sc.preg ? [`<div class="sc-card">${CONCEIVE}<p class="sc-later">몇 주 뒤…</p><button type="button" data-sc-next>계속</button></div>`] : [];
  if (calm) {
    sceneQueue = morningQ.concat(pregQ);
    nextScene();
    return;
  }
  sceneQueue = [
    foreplayCard(sc, p),
    phaseCard(sc, p, 0, 'A', '💓'),
    phaseCard(sc, p, 1, 'A', '💓💓'),
    phaseCard(sc, p, 2, 'B', '🔥'),
    phaseCard(sc, p, 3, 'C', '🔥🔥'),
    phaseCard(sc, p, 'climax', 'C', '💦'),
    phaseCard(sc, p, 'end', 'A', ''),
  ].concat(uterusQ, morningQ, pregQ);
  nextScene();
}
function nextScene() {
  clearTimeout(sceneTimer);
  if (sceneQueue.length) {
    const html = sceneQueue.shift();
    sceneCard(html);
    const isPhase = sceneBox.querySelector('.sc-phase') || sceneBox.querySelector('.sc-foreplay') || sceneBox.querySelector('.sc-uterus');
    if (isPhase) sceneTimer = setTimeout(nextScene, sceneBox.querySelector('.sc-foreplay') ? 1800 : sceneBox.querySelector('.sc-uterus') ? 3500 : sceneBox.querySelector('.phase-climax') ? 2200 : sceneBox.querySelector('.phase-end') ? 2000 : 2500);
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
  if (sceneBox.querySelector('.sc-night') || sceneBox.querySelector('.sc-phase') || sceneBox.querySelector('.sc-foreplay') || sceneBox.querySelector('.sc-uterus')) nextScene();
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
