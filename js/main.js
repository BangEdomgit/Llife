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
let modalMode = null, modalArg = null, lastFocus = null, endingFor = null;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bar = v => { const n = Math.round(v / 10); return '■'.repeat(n) + '□'.repeat(10 - n); };
const mini = v => { const n = Math.round(v / 20); return '■'.repeat(n) + '□'.repeat(5 - n); };
const wxIcon = k => (WX[k] && WX[k].icon) || '';
const genderKo = g => g === 'm' ? '남' : '여';
const isMoney = k => k === 'money';
const pbar = p => { const n = Math.round(p * 5); return '▰'.repeat(n) + '▱'.repeat(5 - n); };
function abHTML(k, v) {
  const g = G.gradeInfo(v);
  return `<span class="ab" title="${v}"><span>${G.LABEL[k]}</span><span class="g g-${g.letter}">${g.letter}</span><span class="pb">${pbar(g.pct)}</span></span>`;
}

function deltaHTML(d) {
  if (!d || !d.length) return '';
  const parts = d.map(([k, v]) => {
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
  $('#conds').innerHTML = G.conds.map(k =>
    `<span>${G.LABEL[k]}</span><span class="bar${S.stats[k] < 25 ? ' low' : ''}">${bar(S.stats[k])}</span><span class="num">${S.stats[k]}</span>`).join('');
  $('#abils').innerHTML = G.abilities.map(k => abHTML(k, S.stats[k])).join('');

  renderLog(S);

  const se = G.season();
  $('#season').textContent = `${se.icon} ${se.id}`;
  $('#ap').textContent = seasonDots(S);
  $('#apNum').textContent = `${S.ap}/${G.config.apPerYear}`;
  $("#peopleBtn").textContent = "👥 관계";
  $('#jobBtn').hidden = S.age < 16;
  $('#crimeBtn').hidden = G.crimes().length === 0 && S.jail === 0;

  const acts = G.actionList();
  $('#acts').innerHTML = acts.length
    ? acts.filter(a => S.age >= (a.minAge || 0)).map(a => {
        const c = G.costOf(a);
        return `<button type="button" class="act" data-a="${a.id}"${G.canDo(a) ? '' : ' disabled'}${c ? ` title="${G.fmtMoney(c)}"` : ''}><span class="ic" aria-hidden="true">${a.icon}</span>${a.label}</button>`;
      }).join('') || '<p class="empty">아직은 먹고 자는 게 전부다.</p>'
    : '<p class="empty">아직은 먹고 자는 게 전부다.</p>';

  const ageBtn = $('#ageUp');
  ageBtn.textContent = S.ended ? '↻ 새 인생 시작' : S.ap > 0 ? `⏭ 남은 ${S.ap}번 쉬고 1살 먹기` : '＋ 1살 먹기';
  ageBtn.disabled = !S.ended && S.pending.length > 0;

  // 배경: 지금 계절의 날씨와 시간대
  if (bg.w !== S.weather) { WeatherBG.setWeather(WX[S.weather].p, bg.w === null); bg.w = S.weather; }
  if (bg.t !== S.time) { WeatherBG.setTime(S.time, bg.t === null); bg.t = S.time; }

  // 모달
  if (S.pending.length) openEvent();
  else if (S.ended && endingFor !== S.id) { endingFor = S.id; openEnding(); }
  else if (modalMode === 'event') closeModal();
  else if (modalMode === 'people') openPeople();
  else if (modalMode === 'person') openPerson(modalArg);
  else if (modalMode === 'jobs') openJobs();
  else if (modalMode === 'crime') openCrime();
  else if (modalMode === 'me') openMe();
  else if (modalMode === 'study') closeModal();
}

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
  showModal('event', `${S.age}살 ${se.icon} ${se.id} ${wxIcon(S.weather)}`,
    `<p>${esc(ev.text)}</p><div class="choices">${ev.choices.map((c, i) => `<button type="button" data-c="${i}">[${i + 1}] ${esc(c)}</button>`).join('')}</div>`, false, ev.text);
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
    return `<button type="button" class="prow" data-pv="${p.id}">
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
  const tags = [];
  const mine = p.partner || p.spouse || p.secret;
  if (p.taken && !mine) tags.push('<span class="tag">애인 있음</span>');
  if (p.secret) tags.push('<span class="tag warn">들키면 안 됨</span>');
  if (p.debt) tags.push(`<span class="tag warn">빌린 돈 ${G.fmtMoney(p.debt)}</span>`);
  if (p.ex) tags.push('<span class="tag">예전에 사귐</span>');
  const prof = G.profile(p).map(f => `<dt>${f.label}</dt><dd${f.value == null ? ' class="unk"' : ''}>${f.value == null ? '???' : esc(f.value)}</dd>`).join('');
  const acts = G.interactions(id).map(it =>
    `<button type="button" data-i="${it.id}"${it.ok ? '' : ' disabled'}>${it.icon} ${it.label}${it.cost ? ` <small>${G.fmtMoney(it.cost)}</small>` : ''}</button>`).join('');
  showModal('person', `${G.pname(p)}`, `
    <p><b>${esc(G.pname(p))}</b> <span class="dim">${G.npcAge(p)}살 ${genderKo(p.gender)}, ${esc(G.relLabel(p))}</span></p>
    <div class="stats">${stats}</div>
    ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    <dl class="prof">${prof}</dl>
    ${G.profile(p).some(f => f.value == null) ? '<p class="hint">더 친해지면 더 알 수 있다.</p>' : ''}
    <div class="igrid">${acts || '<p class="hint">지금은 할 수 있는 게 없다.</p>'}</div>
    <p class="hint">한 번에 행동 1을 써. (남은 행동 ${S.ap})</p>
    <button type="button" class="back" data-back>← 목록</button>`, true, id);
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
  showModal('me', `📋 ${S.name}`, `
    <dl class="prof">${prof}</dl>
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
  const stats = G.conds.map(k => `<span>${G.LABEL[k]}</span><span class="bar">${bar(S.stats[k])}</span><span class="num">${S.stats[k]}</span>`).join('')
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
$('#acts').addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const a = G.actionList().find(x => x.id === b.dataset.a);
  if (a && G.needsSubject(a)) openStudy(); else G.doAction(b.dataset.a);
});
$('#meBtn').addEventListener('click', openMe);
$('#ageUp').addEventListener('click', () => { const S = G.state(); if (S.ended) { draft = null; openCreate(true); } else G.ageUp(); });
$('#peopleBtn').addEventListener('click', openPeople);
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
  else if (d.pv) openPerson(d.pv);
  else if (d.i) G.interact(modalArg, d.i);
  else if ('back' in d) openPeople();
  else if (d.j) G.applyJob(d.j);
  else if (d.k) G.commitCrime(d.k);
  else if ('quit' in d) G.quitJob();
  else if ('new' in d) { draft = null; openCreate(true); }
  else if ('cancel' in d) closeModal();
});
window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target && e.target.tagName === 'INPUT')) return;
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
