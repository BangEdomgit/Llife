// 날씨 정의 — 여기에 항목을 추가하면 버튼이 자동으로 생김
//
// p (배경 연출 값, 대부분 0~1, 안 적으면 0)
//   cloud 구름 양 / dark 어두움(0 맑음, 0.5 흐림, 1 폭풍) / sun 해 보이는 정도 / rays 햇살
//   rain 비 / snow 눈 / sleet 진눈깨비(눈을 빠르고 작게) / snowCover 지붕에 쌓이는 눈
//   fog 안개 / dust 황사 / storm 번개 / rainbow 무지개 / wind 바람(기본 0.3)
// adj:  문장에 들어가는 꾸밈말 ("비 오는 날")
// text: [아침, 점심, 저녁] 로그 문장
// mod:  날씨 보정 표시 문구 (아직 게임에는 반영 안 됨)
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.weather = {
  sunny: {
    label: '쨍쨍', icon: '☀️', adj: '햇살 쨍한',
    p: { cloud: .08, sun: 1, rays: 1, wind: .2 },
    text: ['눈부신 아침이다. 오늘은 뭘 해도 잘 될 것 같다.', '햇볕이 따갑다. 그늘이 그리워진다.', '노을이 진하게 번진다. 내일도 맑겠다.'],
    mod: '기분 +2, 체력 -1',
  },
  partly: {
    label: '구름조금', icon: '🌤️', adj: '구름 조금 낀',
    p: { cloud: .42, dark: .04, sun: .9, rays: .25, wind: .45 },
    text: ['구름 사이로 아침 햇살이 비친다.', '구름이 느릿느릿 흘러간다. 나른한 오후다.', '구름이 분홍빛으로 물들었다.'],
    mod: '기분 +1',
  },
  cloudy: {
    label: '흐림', icon: '☁️', adj: '흐린',
    p: { cloud: 1, dark: .55, sun: .04, wind: .5 },
    text: ['하늘이 잿빛이다. 왠지 몸이 무겁다.', '해가 보이지 않는다. 비가 올 것 같기도 하다.', '어둑어둑한 저녁. 일찍 들어가고 싶다.'],
    mod: '기분 -1',
  },
  rain: {
    label: '비', icon: '🌧️', adj: '비 오는',
    p: { cloud: 1, dark: .72, rain: .55, wind: .6 },
    text: ['빗소리에 눈을 떴다. 우산을 챙기자.', '창밖으로 빗줄기가 끊임없이 이어진다.', '젖은 아스팔트에 가로등 불빛이 번진다.'],
    mod: '기분 -1, 외출 시 체력 -1',
  },
  storm: {
    label: '폭풍우', icon: '⛈️', adj: '비바람 치는',
    p: { cloud: 1, dark: 1, rain: 1, storm: 1, wind: 1.5 },
    text: ['천둥 소리가 창문을 흔든다.', '번개가 번쩍인다. 밖에 나가는 건 무리다.', '비바람이 거세다. 오늘은 집에 있자.'],
    mod: '기분 -2, 외출 불가',
  },
  snow: {
    label: '눈', icon: '❄️', adj: '눈 오는',
    p: { cloud: .9, dark: .45, snow: 1, wind: .3, snowCover: 1 },
    text: ['밤새 눈이 쌓였다. 세상이 조용하다.', '함박눈이 소복소복 내린다.', '눈 내리는 저녁, 창문 불빛이 따뜻해 보인다.'],
    mod: '기분 +2, 특별 이벤트 확률 ↑',
  },
  sleet: {
    label: '진눈깨비', icon: '🌨️', adj: '진눈깨비 내리는',
    p: { cloud: 1, dark: .62, rain: .3, snow: .5, sleet: 1, wind: .9, snowCover: .35 },
    text: ['비인지 눈인지 모를 것이 내린다.', '진눈깨비 때문에 길이 질척하다.', '차가운 진눈깨비가 옷깃을 파고든다.'],
    mod: '기분 -2, 체력 -1',
  },
  fog: {
    label: '안개', icon: '🌫️', adj: '안개 낀',
    p: { cloud: .5, dark: .3, fog: 1, sun: .3, wind: .15 },
    text: ['짙은 안개. 몇 걸음 앞도 흐릿하다.', '안개가 좀처럼 걷히지 않는다.', '안개 속으로 불빛이 번져 보인다.'],
    mod: '외출 시 랜덤 이벤트 ↑',
  },
  dust: {
    label: '황사', icon: '💨', adj: '먼지 뿌연',
    p: { cloud: .15, dark: .12, dust: 1, sun: .55, wind: .7 },
    text: ['하늘이 누렇다. 마스크를 챙겨야겠다.', '목이 칼칼하다. 오늘은 실내에 있자.', '먼지 속으로 흐린 노을이 가라앉는다.'],
    mod: '체력 -1, 운동 효율 ↓',
  },
  rainbow: {
    label: '비 갠 뒤', icon: '🌈', adj: '비 갠',
    p: { cloud: .38, dark: .12, sun: .85, rainbow: 1, wind: .3 },
    text: ['비가 그쳤다. 하늘에 무지개가 걸렸다.', '물웅덩이에 하늘이 비친다. 무지개다!', '비 갠 저녁, 희미한 무지개가 남아 있다.'],
    mod: '기분 +3, 행운 +1',
  },
};

// 하루가 넘어갈 때 날씨가 뽑힐 확률 가중치 (클수록 자주 나옴)
GAME_DATA.weatherWeight = {
  sunny: 4, partly: 4, cloudy: 3, rain: 3, storm: 1,
  snow: 1.5, sleet: 1, fog: 1.5, dust: 1.5, rainbow: 1,
};
