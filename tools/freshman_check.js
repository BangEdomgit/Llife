const vm = require('vm'), fs = require('fs');
const root = process.cwd() + '/';  // 저장소 루트에서: node tools/freshman_check.js
const store = {};
const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout,
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } } };
ctx.window = ctx; vm.createContext(ctx);
// index.html과 같은 순서로 데이터·엔진만 불러옴 (화면 js/avatar·night·main·weather는 빼고)
const files = [...fs.readFileSync(root + 'index.html', 'utf8').matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1])
  .filter(f => f.startsWith('data/') || f === 'js/game.js');
for (const f of files) vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });
const G = ctx.Game || ctx.window.Game;
console.log('Game keys:', G ? Object.keys(G).slice(0, 40).join(',') : 'NONE');
G.newLife({ gender: 'm', name: '테스트' });
const S = G.state();
// 엄마가 있는지
const api = G.dev.api;
// 1학년 상태로 만들기
S.age = 19; S.flags.student = true; S.school = S.school || {}; S.school.start = 19; S.school.tier = S.school.tier || 3; S.school.years = 4;
S.seasonIdx = 0; S.stats.charm = 45; S.stats.smart = 45; S.stats.fit = 45; S.stats.happy = 40;
const bad = [];
function lastLogs(n) { return S.log.slice(-n).map(l => l.text || l.t || JSON.stringify(l)); }
function run(id, pickFn, label) {
  try { G.dev.fire(id); } catch (e) { bad.push(id + ' FIRE ERR ' + e.message); return; }
  let guard = 0;
  while (S.pending && S.pending.length && guard++ < 10) {
    const ev = G.currentEvent();
    if (!ev) break;
    if (/\{[a-zA-Z]/.test(ev.text)) bad.push('UNFILLED text in ' + S.pending[0].id + ': ' + ev.text);
    ev.choices.forEach(c => { if (/\{[a-zA-Z]/.test(c)) bad.push('UNFILLED label in ' + S.pending[0].id + ': ' + c); });
    const i = pickFn ? pickFn(ev, guard) : 0;
    console.log(`[${S.pending[0].id}] ${ev.text}\n   ▸ ${ev.choices.join(' | ')}  → #${i}`);
    try { G.choose(Math.min(i, ev.choices.length - 1)); } catch (e) { bad.push(id + ' CHOOSE ERR ' + e.stack.split('\n').slice(0,3).join(' ')); break; }
    const L = S.log[S.log.length - 1];
    if (L && L.text) { console.log('   = ' + L.text); if (/\{[a-zA-Z]/.test(L.text)) bad.push('UNFILLED result ' + L.text); }
  }
}
S.weather = 'sunny';
run('fr_ot', () => 0);
S.place = 'campus';
run('fr_welcome', () => 2);
run('fr_clubfair', () => 0);
S.weather = 'rain';
run('fr_umbrella', () => 0);
run('fr_project', () => 0);
run('fr_midterm', () => 0);
run('fr_mt', () => 0);
run('fr_springfest', () => 1);
S.place = 'home';
run('fr_halmeoni', () => 0);
run('fr_momcall', () => 2);
S.place = 'cafe'; run('fr_cafe', () => 0);
S.place = 'conveni'; S.placeNight = true; run('fr_conveni', () => 0); S.placeNight = false;
S.seasonIdx = 1;
run('fr_finals1', (ev, g) => g === 1 ? 0 : 3);
run('fr_beach', () => 0);
S.place = 'home'; run('fr_heatwave', () => 0); S.weather='rain'; run('fr_leak', () => 0);
S.seasonIdx = 2; S.weather = 'sunny';
run('fr_fallopen', () => 0);
run('fr_chuseok', () => 1);
S.place = 'campus';
run('fr_clubstage', () => 0); run('fr_crushmeal', () => 0);
run('fr_dodgeball', () => 0);
run('fr_sunbaemeal', () => 0);
run('fr_profoffice', () => 0);
run('fr_fight', () => 0);
const c = S.people.find(p => p.tag === 'crush'); console.log('crush heart', c && c.heart, c && c.personality);
c.heart = Math.max(c.heart, 55);
run('fr_confess', () => 0);
S.stats.happy = 30; S.place = 'home'; run('fr_lonely', () => 0);
S.seasonIdx = 3; S.weather = 'snow';
run('fr_firstsnow', () => 0);
run('fr_retake', () => 0);
run('fr_reconcile', () => 0);
run('fr_finals2', () => 0);
// 2학년
S.age = 20; S.seasonIdx = 0; S.weather = 'rain'; S.place = 'campus';
run('cb_umbrella'); run('cb_project', () => 0); S.place='cafe'; run('cb_usual'); S.place='home'; run('cb_halmeoni');
S.seasonIdx = 1; run('cb_beach', () => 0); S.seasonIdx = 3; run('cb_firstsnow');
S.age = 23; run('cb_profletter'); run('cb_sunbaejob', () => 0);
// 대화 고르기
const people = S.people.filter(p => p.tag);
console.log('\n--- talk samples ---');
for (const p of people) for (let k = 0; k < 2; k++) { const t = ctx.GAME_DATA.pickTalk(S, p, api); const f = G.pname ? t.replace(/\{p\|?[^}]*\}/g, p.name) : t; console.log(p.tag, ctx.GAME_DATA.talkStage(S, p, api), '|', t); if (!t) bad.push('empty talk ' + p.tag); }
console.log('\nmem:', people.map(p => p.tag + ':' + (p.mem||[]).map(m=>m.tag).join('/')).join('  '));
console.log('\nBAD:', bad.length ? bad.join('\n') : 'none');
