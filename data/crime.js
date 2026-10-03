// 범죄 — 돈은 되지만 인과응보가 따라옴
//
// odds      성공 확률 (숫자 또는 함수)
// caught    그 자리에서 잡힐 기본 확률 (실패하면 더 높아짐)
// gain      성공했을 때 버는 돈 (만원, 미성년자는 1/5)
// heat      경찰의 관심. 쌓이면 몇 년 뒤에라도 잡힐 수 있음 (해마다 조금씩 식음)
// karma     보이지 않는 업보. 낮으면 안 좋은 일이 자주 생김
// severity  처벌 무게 (전과가 쌓이면 더 무거워짐)
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.crimes = [
  { id: 'shoplift',   label: '물건 훔치기',      icon: '🧃', minAge: 10, odds: .7, caught: .25, gain: [5, 30], heat: 8, karma: -5, severity: 1,
    ok: ['물건 하나를 슬쩍 주머니에 넣었다. 심장이 쿵쾅거렸다.'], fail: ['주머니에 넣다가 직원과 눈이 마주쳤다.'] },
  { id: 'fight',      label: '시비 걸기',        icon: '👊', minAge: 12, odds: s => .3 + s.stats.fit / 250, caught: .3, heat: 10, karma: -8, severity: 1,
    effect: { happy: [1, 3] }, failEffect: { health: [-12, -4], happy: -3 },
    ok: ['길에서 시비가 붙었고, 내가 이겼다.'], fail: ['시비를 걸었다가 크게 얻어맞았다.'] },
  { id: 'pickpocket', label: '소매치기',         icon: '👛', minAge: 14, odds: s => .35 + s.stats.craft / 500, caught: .35, gain: [20, 120], heat: 15, karma: -10, severity: 2,
    ok: ['붐비는 지하철에서 지갑을 빼냈다.'], fail: ['손이 닿기도 전에 상대가 돌아봤다.'] },
  { id: 'burglary',   label: '빈집 털기',        icon: '🏚', minAge: 17, odds: .4, caught: .45, gain: [100, 600], heat: 30, karma: -20, severity: 3,
    ok: ['불 꺼진 집에 들어갔다 나왔다. 손이 떨렸다.'], fail: ['창문을 넘다가 개 짖는 소리에 도망쳤다.'] },
  { id: 'fraud',      label: '사기 치기',        icon: '🎭', minAge: 20, odds: s => .15 + (s.stats.smart + s.stats.charm) / 600, caught: .3, gain: [300, 2000], heat: 35, karma: -25, severity: 3,
    ok: ['그럴듯한 말로 큰돈을 받아냈다.'], fail: ['상대가 눈치를 챘다. 서둘러 자리를 떴다.'] },
  { id: 'embezzle',   label: '회삿돈 빼돌리기',  icon: '💼', minAge: 20, req: { job: true }, odds: .6, caught: .2, gain: [500, 3000], heat: 45, karma: -25, severity: 4,
    ok: ['장부를 조금 손봤다. 아무도 모르는 것 같다.'], fail: ['결재 서류가 이상하다는 말이 나왔다.'] },
];
