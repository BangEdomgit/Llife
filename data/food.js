// 먹을 것 — 식당에서 사 먹기 · 집에서 배달 시키기 · 편의점·시장·카페에서 사서 🎒 가방에 넣고 다니며 먹기 (엔진: js/game.js '먹을 것')
//   값은 그 나라 단위 그대로: 서울은 원(won), 뉴욕은 달러(usd) — 엔진이 내부 단위(만원)로 바꿈
//   meal  끼니로 치는 양 (1 = 한 끼, .5 = 간단히, .25 = 주전부리). 하루 두 끼를 못 채우면 건강이 깎임
//   hp/hy 한 번 먹을 때 건강·행복이 오르는 기대값 (확률 반올림). 건강은 나이·체력 기준선까지만 오름, 정크푸드는 깎일 수도
//   pt    먹는 데 드는 행동력 / keep: 가방에 넣고 며칠 지나면 상함 (없으면 오래감) / uses: 몇 번 쓰는지 (식재료)
//   cook  집에서 해 먹을 때 쓰는 식재료
window.GAME_DATA = window.GAME_DATA || {};

GAME_DATA.food = {
  kr: {
    // 🎒 사서 가방에 넣는 것 (at: 파는 곳)
    items: [
      { id: 'onigiri', label: '삼각김밥', icon: '🍙', won: 1500, meal: .5, hp: 0, hy: .3, keep: 1, at: ['conveni'] },
      { id: 'dosirak', label: '편의점 도시락', icon: '🍱', won: 5500, meal: 1, hp: .3, hy: .5, keep: 1, at: ['conveni'] },
      { id: 'cupramen', label: '컵라면', icon: '🍜', won: 1500, meal: .5, hp: -.3, hy: .6, at: ['conveni', 'market'] },
      { id: 'sandwich', label: '샌드위치', icon: '🥪', won: 3900, meal: .5, hp: .2, hy: .4, keep: 2, at: ['conveni', 'cafe'] },
      { id: 'kimbap', label: '김밥 한 줄', icon: '🍙', won: 3500, meal: 1, hp: .3, hy: .4, keep: 1, at: ['market', 'diner'] },
      { id: 'bread', label: '빵', icon: '🥐', won: 2800, meal: .5, hp: 0, hy: .5, keep: 3, at: ['cafe', 'conveni', 'market'] },
      { id: 'banana', label: '바나나', icon: '🍌', won: 1500, meal: .25, hp: .3, hy: .1, keep: 4, at: ['market', 'conveni'] },
      { id: 'probar', label: '단백질바', icon: '🍫', won: 2500, meal: .5, hp: .2, hy: 0, at: ['conveni', 'gym'] },
      { id: 'bmilk', label: '바나나우유', icon: '🥛', won: 1700, meal: .25, hp: 0, hy: .4, keep: 5, at: ['conveni'] },
      { id: 'groceries', label: '장본 식재료 (3끼분)', icon: '🥬', won: 15000, uses: 3, cook: true, keep: 5, at: ['market'] },
    ],
    // 🍽 앉아서 먹는 곳 (장소 id → 메뉴). with: 같이 온 사람과 나눠 먹기 좋은 메뉴
    menus: {
      diner: { title: '동네 밥집', note: '김치찌개 냄새가 문밖까지 나는 백반집', menu: [
        { id: 'kimchijj', label: '김치찌개 백반', icon: '🍲', won: 9000, pt: 6, meal: 1, hp: .8, hy: .6 },
        { id: 'jeyuk', label: '제육볶음', icon: '🍛', won: 9500, pt: 6, meal: 1, hp: .5, hy: .9 },
        { id: 'sundubu', label: '순두부찌개', icon: '🍲', won: 9000, pt: 6, meal: 1, hp: .9, hy: .5 },
        { id: 'bibim', label: '비빔밥', icon: '🥗', won: 9000, pt: 6, meal: 1, hp: 1, hy: .5 },
        { id: 'donkatsu', label: '돈가스', icon: '🍛', won: 10000, pt: 6, meal: 1, hp: .2, hy: 1 },
        { id: 'ramyeonkb', label: '라면 + 김밥', icon: '🍜', won: 7500, pt: 5, meal: 1, hp: -.1, hy: .7 },
      ] },
      mall: { title: '번화가 맛집', note: '줄 서는 가게가 많다', menu: [
        { id: 'samgyeop', label: '삼겹살 2인분', icon: '🥓', won: 34000, pt: 12, meal: 1, hp: .2, hy: 2.2, with: true },
        { id: 'pasta', label: '파스타', icon: '🍝', won: 17000, pt: 8, meal: 1, hp: .3, hy: 1.4, with: true },
        { id: 'sushi', label: '초밥 세트', icon: '🍣', won: 22000, pt: 8, meal: 1, hp: .6, hy: 1.6, with: true },
        { id: 'burger', label: '수제버거', icon: '🍔', won: 14000, pt: 6, meal: 1, hp: -.3, hy: 1.3 },
        { id: 'mala', label: '마라탕', icon: '🌶', won: 13000, pt: 6, meal: 1, hp: -.1, hy: 1.3 },
        { id: 'saladbowl', label: '샐러드볼', icon: '🥗', won: 12000, pt: 5, meal: 1, hp: 1.2, hy: .3 },
      ] },
      market: { title: '시장 먹자골목', note: '좌판 의자에 앉아 먹는다', menu: [
        { id: 'tteok', label: '떡볶이·순대', icon: '🍢', won: 7000, pt: 5, meal: 1, hp: -.1, hy: 1 },
        { id: 'gukbap', label: '순대국밥', icon: '🍲', won: 9000, pt: 6, meal: 1, hp: .9, hy: .9 },
        { id: 'kalguksu', label: '손칼국수', icon: '🍜', won: 8000, pt: 6, meal: 1, hp: .5, hy: .8 },
        { id: 'hotteok', label: '호떡', icon: '🥞', won: 1500, pt: 2, meal: .25, hp: -.1, hy: .6 },
      ] },
      conveni: { title: '편의점 안쪽 테이블', note: '창가에 컵라면 먹는 자리가 있다', menu: [
        { id: 'cupnow', label: '컵라면 + 삼각김밥', icon: '🍜', won: 3000, pt: 3, meal: 1, hp: -.3, hy: .6 },
      ] },
      cafe: { title: '카페 메뉴', menu: [
        { id: 'brunch', label: '브런치 플레이트', icon: '🥞', won: 16000, pt: 8, meal: 1, hp: .4, hy: 1.2, with: true },
        { id: 'cake', label: '케이크 한 조각', icon: '🍰', won: 7000, pt: 3, meal: .25, hp: -.1, hy: .8 },
      ] },
      bar: { title: '안주', menu: [
        { id: 'anju', label: '치킨·골뱅이 안주', icon: '🍗', won: 22000, pt: 6, meal: 1, hp: -.4, hy: 1, with: true },
      ] },
      cafeteria: { title: '오늘의 학식', menu: [
        { id: 'hakA', label: '학식 A (정식)', icon: '🍱', won: 5500, pt: 4, meal: 1, hp: .6, hy: .4 },
        { id: 'hakB', label: '학식 B (라면·돈가스)', icon: '🍜', won: 4500, pt: 4, meal: 1, hp: 0, hy: .6 },
      ] },
    },
    // 🏠 집에서: 본가 집밥(부모님) · 식재료로 해 먹기 · 배달
    home: {
      parents: { id: 'homemeal', label: '집밥', icon: '🍚', won: 0, pt: 6, meal: 1, hp: 1, hy: .8,
        say: ['엄마가 차려 준 밥을 먹었다. 반찬이 다섯 개였다.', '"밥은 먹고 다니냐." 아빠가 국을 한 국자 더 떠 줬다.', '냉장고에 엄마가 만들어 둔 반찬이 있었다. 데워 먹었다.'] },
      cook: { id: 'cook', label: '해 먹기', icon: '🍳', pt: 9, meal: 1, hp: 1, hy: .6,
        say: ['된장찌개를 끓였다. 생각보다 그럴듯했다.', '볶음밥을 만들었다. 프라이팬 하나로 끝냈다.', '파스타를 삶았다. 소스는 시판이지만 뿌듯했다.', '계란말이를 했다. 모양은 엉망이었지만 맛있었다.'] },
    },
    // 🛵 배달 앱 (집에 있을 때만): 가게 · 대표 메뉴 · 별점 · 배달팁 · 걸리는 시간(행동력)
    delivery: { app: '배달', tipWon: 3000, minWon: 12000, pt: 5, stores: [
      { id: 'chicken', name: '바삭치킨 ○○점', cat: '치킨', icon: '🍗', star: 4.8, rev: 2140, eta: '35~50분', menu: [{ label: '후라이드 한 마리', won: 20000, meal: 1, hp: -.6, hy: 2 }, { label: '양념 반 후라이드 반', won: 22000, meal: 1, hp: -.6, hy: 2.1 }] },
      { id: 'pizza', name: '도우하우스 피자', cat: '피자', icon: '🍕', star: 4.6, rev: 980, eta: '40~55분', menu: [{ label: '페퍼로니 라지', won: 24000, meal: 1, hp: -.5, hy: 1.8 }] },
      { id: 'chinese', name: '만리장성 반점', cat: '중식', icon: '🥡', star: 4.5, rev: 3320, eta: '25~40분', menu: [{ label: '짜장면 + 탕수육(소)', won: 19000, meal: 1, hp: -.2, hy: 1.4 }, { label: '짬뽕', won: 9000, meal: 1, hp: 0, hy: 1 }] },
      { id: 'tteok', name: '매운맛 떡볶이 연구소', cat: '분식', icon: '🍢', star: 4.7, rev: 5210, eta: '30~45분', menu: [{ label: '떡볶이 세트 (튀김·순대)', won: 17000, meal: 1, hp: -.4, hy: 1.7 }] },
      { id: 'jokbal', name: '골목 족발·보쌈', cat: '족발·보쌈', icon: '🍖', star: 4.8, rev: 1450, eta: '40~60분', menu: [{ label: '족발 소', won: 35000, meal: 1, hp: .2, hy: 2 }] },
      { id: 'mala', name: '마라공방', cat: '중식', icon: '🌶', star: 4.6, rev: 870, eta: '30~45분', menu: [{ label: '마라탕 + 꿔바로우', won: 23000, meal: 1, hp: -.2, hy: 1.6 }] },
      { id: 'gukbap', name: '24시 돼지국밥', cat: '한식', icon: '🍲', star: 4.7, rev: 1960, eta: '25~40분', menu: [{ label: '돼지국밥', won: 11000, meal: 1, hp: .8, hy: .8 }, { label: '순대국 특', won: 13000, meal: 1, hp: .9, hy: .9 }] },
      { id: 'salad', name: '그린볼 샐러드', cat: '샐러드', icon: '🥗', star: 4.5, rev: 640, eta: '25~35분', menu: [{ label: '닭가슴살 샐러드', won: 13000, meal: 1, hp: 1.2, hy: .3 }] },
      { id: 'sushi', name: '스시 오마카세 배달', cat: '일식', icon: '🍣', star: 4.6, rev: 520, eta: '40~55분', menu: [{ label: '모둠초밥 12p', won: 25000, meal: 1, hp: .6, hy: 1.6 }] },
      { id: 'burger', name: '버거 스테이션', cat: '패스트푸드', icon: '🍔', star: 4.4, rev: 4100, eta: '20~35분', menu: [{ label: '불고기버거 세트', won: 9900, meal: 1, hp: -.4, hy: 1 }, { label: '세트 두 개', won: 18000, meal: 1, hp: -.4, hy: 1.1 }] },
    ] },
    lunchWon: 9000,      // 출근한 날 점심 (회사 근처 백반·구내식당)
    lunchSpots: ['회사 근처 백반집', '구내식당', '회사 앞 김밥집', '팀 사람들과 국밥집', '편의점 도시락으로 자리'],
    autoWon: 7000,       // 넘기는 날 한 끼 평균 (본가·군대·수감 중엔 0)
    say: { eat: ['{f|을} 먹었다.', '{f|으로} 한 끼를 해결했다.', '걸으면서 {f|을} 먹었다.'], bad: '가방 속 {f|이} 상해서 버렸다.', full: '가방이 꽉 찼다. 더 넣을 데가 없다.' },
  },

  ny: {
    items: [
      { id: 'bec', label: '베이컨 에그 치즈', icon: '🥪', usd: 6, meal: 1, hp: -.2, hy: .8, keep: 1, at: ['conveni'] },
      { id: 'bagel', label: '베이글 (크림치즈)', icon: '🥯', usd: 4, meal: .5, hp: 0, hy: .5, keep: 2, at: ['conveni', 'cafe'] },
      { id: 'hero', label: '터키 히어로 샌드위치', icon: '🥖', usd: 11, meal: 1, hp: .2, hy: .6, keep: 1, at: ['conveni'] },
      { id: 'cupramen', label: '컵라면', icon: '🍜', usd: 2, meal: .5, hp: -.3, hy: .5, at: ['conveni'] },
      { id: 'croissant', label: '크루아상', icon: '🥐', usd: 5, meal: .5, hp: -.1, hy: .6, keep: 2, at: ['cafe'] },
      { id: 'apple', label: '사과', icon: '🍎', usd: 1.5, meal: .25, hp: .3, hy: .1, keep: 7, at: ['market', 'conveni'] },
      { id: 'granola', label: '그래놀라 바', icon: '🍫', usd: 2.5, meal: .5, hp: .2, hy: 0, at: ['conveni', 'gym'] },
      { id: 'chips', label: '감자칩', icon: '🥔', usd: 2, meal: .25, hp: -.2, hy: .4, at: ['conveni'] },
      { id: 'groceries', label: '장본 식재료 (3끼분)', icon: '🥬', usd: 32, uses: 3, cook: true, keep: 6, at: ['market', 'conveni'] },
    ],
    menus: {
      diner: { title: '24시 다이너', note: '빨간 가죽 의자와 끝없이 리필되는 커피', menu: [
        { id: 'pancake', label: '팬케이크 스택', icon: '🥞', usd: 14, pt: 6, meal: 1, hp: -.1, hy: 1 },
        { id: 'dinerburger', label: '치즈버거 & 프라이', icon: '🍔', usd: 18, pt: 6, meal: 1, hp: -.3, hy: 1.1 },
        { id: 'omelet', label: '웨스턴 오믈렛', icon: '🍳', usd: 15, pt: 6, meal: 1, hp: .5, hy: .7 },
        { id: 'club', label: '클럽 샌드위치', icon: '🥪', usd: 16, pt: 6, meal: 1, hp: .2, hy: .8 },
        { id: 'soup', label: '치킨 누들 수프', icon: '🍲', usd: 9, pt: 5, meal: 1, hp: .9, hy: .5 },
        { id: 'greek', label: '그릭 샐러드', icon: '🥗', usd: 14, pt: 5, meal: 1, hp: 1.1, hy: .3 },
      ] },
      mall: { title: '미드타운 식당가', menu: [
        { id: 'steak', label: '스테이크하우스', icon: '🥩', usd: 68, pt: 12, meal: 1, hp: .3, hy: 2.3, with: true },
        { id: 'ramen', label: '돈코츠 라멘', icon: '🍜', usd: 21, pt: 7, meal: 1, hp: .2, hy: 1.4, with: true },
        { id: 'slice', label: '피자 한 조각', icon: '🍕', usd: 4, pt: 2, meal: .5, hp: -.2, hy: .7 },
        { id: 'hotdog', label: '핫도그 카트', icon: '🌭', usd: 5, pt: 2, meal: .5, hp: -.3, hy: .6 },
        { id: 'shack', label: '버거 & 셰이크', icon: '🍔', usd: 17, pt: 6, meal: 1, hp: -.4, hy: 1.3 },
        { id: 'taco', label: '타코 세 개', icon: '🌮', usd: 14, pt: 5, meal: 1, hp: .1, hy: 1.1 },
      ] },
      market: { title: '푸드 트럭', note: '그린마켓 옆에 트럭들이 줄지어 있다', menu: [
        { id: 'halal', label: '치킨 오버 라이스 (할랄 카트)', icon: '🍛', usd: 10, pt: 4, meal: 1, hp: .2, hy: 1 },
        { id: 'trucktaco', label: '푸드 트럭 타코', icon: '🌮', usd: 12, pt: 4, meal: 1, hp: .1, hy: .9 },
        { id: 'pretzel', label: '프레첼', icon: '🥨', usd: 4, pt: 2, meal: .25, hp: -.1, hy: .5 },
      ] },
      conveni: { title: '보데가 그릴', note: '카운터 뒤에서 아저씨가 바로 만들어 준다', menu: [
        { id: 'becnow', label: '베이컨 에그 치즈 (바로)', icon: '🥪', usd: 6, pt: 3, meal: 1, hp: -.2, hy: .8 },
      ] },
      cafe: { title: '커피숍 메뉴', menu: [
        { id: 'avotoast', label: '아보카도 토스트', icon: '🥑', usd: 16, pt: 6, meal: 1, hp: .7, hy: .9, with: true },
        { id: 'muffin', label: '블루베리 머핀', icon: '🧁', usd: 5, pt: 2, meal: .25, hp: -.1, hy: .6 },
      ] },
      bar: { title: '바 메뉴', menu: [
        { id: 'wings', label: '버팔로 윙', icon: '🍗', usd: 17, pt: 6, meal: 1, hp: -.4, hy: 1, with: true },
      ] },
      cafeteria: { title: '다이닝 홀', menu: [
        { id: 'dhall', label: '다이닝 홀 뷔페', icon: '🍱', usd: 13, pt: 4, meal: 1, hp: .5, hy: .5 },
        { id: 'grill', label: '그릴 버거', icon: '🍔', usd: 9, pt: 4, meal: 1, hp: -.2, hy: .7 },
      ] },
    },
    home: {
      parents: { id: 'homemeal', label: '집밥', icon: '🍚', usd: 0, pt: 6, meal: 1, hp: 1, hy: .8,
        say: ['엄마가 미트로프를 데워 줬다. "Eat, you look thin."', '아빠가 그릴에 버거를 구웠다. 뒷마당에서 먹었다.', '냉장고에 남은 라자냐를 데워 먹었다.'] },
      cook: { id: 'cook', label: '해 먹기', icon: '🍳', pt: 9, meal: 1, hp: 1, hy: .6,
        say: ['파스타를 삶았다. 소스는 병에 든 거였지만 뿌듯했다.', '스크램블 에그와 토스트를 만들었다.', '닭가슴살을 구워 샐러드를 만들었다.', '타코를 만들었다. 부엌이 엉망이 됐다.'] },
    },
    delivery: { app: '딜리버리', feeUsd: 4, tipPct: .18, minUsd: 12, pt: 5, stores: [
      { id: 'pizza', name: '브루클린 슬라이스 하우스', cat: '피자', icon: '🍕', star: 4.7, rev: 3810, eta: '30~45분', menu: [{ label: '치즈 파이 (한 판)', usd: 24, meal: 1, hp: -.5, hy: 1.8 }, { label: '페퍼로니 두 조각', usd: 9, meal: .75, hp: -.4, hy: 1 }] },
      { id: 'chinese', name: '골든 드래곤 테이크아웃', cat: '중식', icon: '🥡', star: 4.4, rev: 1290, eta: '25~40분', menu: [{ label: '제너럴 쏘 치킨 + 볶음밥', usd: 17, meal: 1, hp: -.3, hy: 1.3 }] },
      { id: 'halal', name: '6번가 할랄 카트', cat: '할랄', icon: '🍛', star: 4.6, rev: 5020, eta: '20~35분', menu: [{ label: '치킨 앤 자이로 오버 라이스', usd: 13, meal: 1, hp: .1, hy: 1.1 }] },
      { id: 'thai', name: '방콕 키친', cat: '태국', icon: '🍜', star: 4.7, rev: 980, eta: '30~45분', menu: [{ label: '팟타이', usd: 18, meal: 1, hp: .2, hy: 1.2 }] },
      { id: 'sushi', name: '미드타운 스시 바', cat: '일식', icon: '🍣', star: 4.5, rev: 640, eta: '35~50분', menu: [{ label: '스파이시 튜나 롤 세트', usd: 28, meal: 1, hp: .6, hy: 1.5 }] },
      { id: 'kfc', name: '서울 윙스', cat: '한식', icon: '🍗', star: 4.6, rev: 1720, eta: '35~50분', menu: [{ label: '간장 마늘 윙 20p', usd: 27, meal: 1, hp: -.5, hy: 1.9 }] },
      { id: 'salad', name: '그린 하베스트', cat: '샐러드', icon: '🥗', star: 4.5, rev: 2230, eta: '20~30분', menu: [{ label: '하베스트 볼', usd: 17, meal: 1, hp: 1.2, hy: .4 }] },
      { id: 'burger', name: '더블스택 버거', cat: '버거', icon: '🍔', star: 4.4, rev: 2890, eta: '25~40분', menu: [{ label: '더블 버거 + 프라이', usd: 21, meal: 1, hp: -.5, hy: 1.4 }] },
      { id: 'ramen', name: '돈코츠 라멘 바', cat: '일식', icon: '🍜', star: 4.6, rev: 760, eta: '30~45분', menu: [{ label: '돈코츠 라멘', usd: 22, meal: 1, hp: .2, hy: 1.4 }] },
    ] },
    lunchUsd: 16,
    lunchSpots: ['회사 앞 샐러드 가게', '푸드 트럭', '델리', '회사 카페테리아', '책상'],
    autoUsd: 11,
    say: { eat: ['{f|을} 먹었다.', '{f|으로} 한 끼를 때웠다.', '지하철을 기다리며 {f|을} 먹었다.'], bad: '가방 속 {f|이} 상해서 버렸다.', full: '가방이 꽉 찼다. 더 넣을 데가 없다.' },
  },
};
