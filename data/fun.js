// Llife 재밌는 이벤트 — 장소·행동마다 (한국). 대부분 능력치 판정으로 성공·실패가 갈림
//   판정 check: { stat, g } — 내 능력치가 기준 등급 g의 문턱이면 50%, 한 등급쯤(30)마다 약 ±18%p, 5~95%
//   선택지에 '🎲 매력 62%'처럼 미리 보이고, 고르면 기록에 '🎲 매력 판정 62% → 성공' (js/game.js checkPct)
//   같은 이벤트는 20일에 한 번까지. 돈은 만 원 단위
window.GAME_DATA = window.GAME_DATA || {};
(() => {
const E = o => Object.assign({ type: 'random', region: 'kr', once: false, cdDays: 20, age: [19, 75] }, o);
const K = (label, stat, g, success, fail) => ({ label, check: { stat, g }, success, fail });
const opp = s => (s.gender === 'm' ? 'f' : 'm');
const near = s => [Math.max(20, s.age - 6), Math.min(60, s.age + 6)];
const perf = n => s => { if (s.job) s.perf = Math.max(0, Math.min(100, (s.perf || 0) + n)); };

GAME_DATA.events.push(
  /* ── ☕ 카페 ── */
  E({ id: 'fun_latte', on: ['cafe'], text: '바리스타가 웃으며 말했다. "오늘 라떼아트 원데이 이벤트 중인데, 한 잔 직접 그려 보실래요?"',
    choices: [
      K('하트에 도전한다', 'craft', 'C',
        { text: '스팀 우유가 매끈하게 퍼지며 하트가 떴다. 바리스타가 사진을 찍어 가게 인스타에 올렸다.', effect: { happy: 4, craft: 2 } },
        { text: '하트를 그리려 했는데… 컵 위에 우주에서 온 생명체가 떠 있었다. 바리스타가 웃음을 참았다.', effect: { happy: 1 } }),
      K('백조에 도전한다 (어려움)', 'craft', 'A',
        { text: '…백조였다. 진짜 백조. 바리스타가 "혹시 업계 분이세요?" 하고 물었다. 그 잔은 공짜.', effect: { happy: 7, craft: 3, money: 1 }, memory: true },
        { text: '백조 대신 뭔가 터진 모양이 됐다. 마셔 보니 맛은 똑같았다.', effect: { happy: 1 } }),
      { label: '구경만 한다', text: '다른 손님이 그린 곰돌이를 구경했다. 귀여웠다.', effect: { happy: 1 } },
    ] }),
  E({ id: 'fun_spill', on: ['cafe'], text: '옆자리 사람이 일어나다 노트북 옆 커피잔을 툭 쳤다. 잔이 기울어진다!',
    choices: [
      K('반사적으로 잡는다', 'fit', 'C',
        { text: '잔이 넘어가는 순간 낚아챘다. 한 방울도 안 흘렸다. "와… 이거 마감 파일이었어요!" {new|이} 커피를 사 줬다.', effect: { happy: 3 }, meet: s => ({ kind: 'friend', ageRange: near(s), close: 18 }) },
        { text: '손을 뻗었지만 잔이 먼저 넘어갔다. 커피가 내 바지 위로… 둘이 냅킨을 뽑느라 정신없었다. 세탁비가 들었다.', effect: { happy: -2, money: -2 } }),
      { label: '"컵이요!" 하고 외친다', text: '그 사람이 간신히 잔을 붙잡았다. 고맙다고 꾸벅 고개를 숙였다.', effect: { happy: 1 } },
    ] }),
  E({ id: 'fun_blind', on: ['cafe'], age: [20, 45], when: s => !s.flags.married, text: '친구에게서 다급한 전화가 왔다. "나 대신 소개팅 좀 나가 줘! 지금 그 카페 맞지? 창가 자리야!"',
    choices: [
      K('대타로 나가 본다', 'charm', 'C',
        { text: '어색한 첫마디가 웃음으로 바뀌었다. 두 시간이 훌쩍 지났다. {new|이} 먼저 번호를 물었다.', effect: { happy: 5 }, meet: s => ({ kind: 'friend', gender: opp(s), ageRange: near(s), close: 16, heart: 20, married: false }) },
        { text: '"아… 원래 오시기로 한 분은요?" 대화가 날씨 얘기에서 더 나아가지 못했다. 커피는 내가 샀다.', effect: { happy: -2, money: -1 } }),
      { label: '거절한다', text: '친구가 한숨을 쉬었다. 창가 자리엔 누군가 혼자 앉아 휴대폰만 보고 있었다.', effect: { happy: -1 } },
    ] }),

  /* ── 🍺 술집 ── */
  E({ id: 'fun_armwrestle', on: ['bar'], text: '옆 테이블에서 팔씨름 내기가 벌어졌다. "한 판에 만 원! 도전자 없어?"',
    choices: [
      K('도전한다', 'fit', 'B',
        { text: '팔뚝에 핏줄이 섰다. 상대 손등이 테이블에 닿았다. 환호성 속에 판돈을 챙겼다.', effect: { happy: 5, money: 3, fit: 1 } },
        { text: '3초 만에 손등이 테이블에 붙었다. 손목이 시큰했다. 만 원은 저쪽 테이블 술값이 됐다.', effect: { happy: -2, money: -1, health: -2 } }),
      { label: '응원만 한다', text: '누군가는 이겼고, 누군가는 손목을 주물렀다. 응원은 공짜였다.', effect: { happy: 1 } },
    ] }),
  E({ id: 'fun_pubquiz', on: ['bar'], text: '펍에서 퀴즈 나이트가 열렸다. 사회자: "마지막 문제! 맞히는 테이블에 맥주 한 통!"',
    choices: [
      K('손을 번쩍 든다', 'smart', 'B',
        { text: '"정답!" 사람들이 박수를 쳤다. 맥주 한 통이 테이블로 왔다. 모르는 사람들과 잔을 부딪쳤다.', effect: { happy: 5, smart: 1 }, drunk: 1 },
        { text: '자신 있게 외쳤는데 오답이었다. 사회자가 "아깝네요~" 하며 웃었다.', effect: { happy: -1 } }),
      { label: '모르는 척한다', text: '정답은 내가 생각한 거였다. 조금 억울했다.', effect: { happy: -1 } },
    ] }),

  /* ── 🛍 번화가 ── */
  E({ id: 'fun_interview', on: ['mall'], text: '방송국 카메라가 다가왔다. "시민 인터뷰 잠깐 괜찮으세요? 요즘 물가 어떠세요?"',
    choices: [
      K('능청스럽게 답한다', 'charm', 'C',
        { text: '"라면값 보고 놀라서 요즘 라면도 반 개씩 끓여요." 기자가 빵 터졌다. 저녁 뉴스에 내 얼굴이 나왔다. 단톡방이 난리가 났다.', effect: { happy: 5, charm: 2 }, memory: true },
        { text: '카메라 불이 켜지자 머리가 하얘졌다. "어… 음… 비싸요." 그게 다였다. 방송엔 뒤통수만 나왔다.', effect: { happy: -1 } }),
      { label: '바쁘다며 지나간다', text: '지나가며 힐끗 보니 다음 사람이 잡혀 있었다.' },
    ] }),
  E({ id: 'fun_busking', on: ['mall'], text: '버스커가 노래를 멈추고 관객을 향해 마이크를 내밀었다. "같이 부르실 분?"',
    choices: [
      K('마이크를 잡는다', 'art', 'B',
        { text: '첫 소절에 웅성거림이 멈췄다. 후렴에선 다들 따라 불렀다. 버스커가 기타 케이스에 들어온 돈을 나눠 줬다.', effect: { happy: 7, art: 2, money: 2 }, memory: true },
        { text: '고음에서 음이 하늘로 날아갔다. 관객들이 웃었고, 나도 웃었다. 그래도 박수는 받았다.', effect: { happy: 2 } }),
      { label: '박수로 응원한다', text: '다른 사람이 나가서 불렀다. 꽤 잘했다.', effect: { happy: 1 } },
    ] }),
  E({ id: 'fun_claw', on: ['mall'], text: '오락실 인형뽑기 기계 안, 커다란 곰 인형이 출구 바로 옆에 걸려 있다.',
    choices: [
      K('각도를 재고 한 판', 'craft', 'C',
        { text: '집게가 곰의 목을 정확히 걸었다. 툭— 출구로 떨어졌다. 지나가던 사람들이 박수를 쳤다.', effect: { happy: 5 } },
        { text: '곰이 들렸다가 출구 직전에 떨어졌다. 한 판만 더, 한 판만 더… 정신 차려 보니 만 원이 사라졌다.', effect: { happy: -2, money: -1 } }),
      { label: '그냥 지나간다', text: '곰 인형이 나를 쳐다보는 것 같았다.' },
    ] }),
  E({ id: 'fun_snap', on: ['mall'], text: '패션 잡지 스트리트 스냅 팀이 길목에 서서 지나가는 사람들을 훑어보고 있다.',
    choices: [
      K('자연스럽게 앞을 지나간다', 'style', 'B',
        { text: '"저기요! 한 컷만 찍어도 될까요?" 다음 달 잡지 스트리트 패션 코너에 실렸다.', effect: { happy: 6, style: 1, charm: 1 }, memory: true },
        { text: '포토그래퍼의 시선이 나를 스쳐 내 뒤 사람에게 꽂혔다. …괜히 옷매무새를 고쳤다.', effect: { happy: -1 } }),
      { label: '다른 길로 간다', text: '오늘은 무릎 나온 트레이닝복이었다. 현명한 선택이었다.' },
    ] }),

  /* ── 🌳 공원·산책 ── */
  E({ id: 'fun_dog', on: ['park', 'walk'], text: '목줄이 풀린 강아지가 전력 질주 중이다. 뒤에서 주인이 "초코야!!" 하고 외치며 달려온다.',
    choices: [
      K('같이 뛴다', 'fit', 'C',
        { text: '공원 반 바퀴를 돌아 결국 초코를 품에 안았다. {new|이} 숨을 몰아쉬며 연신 고개를 숙였다. 사례라며 커피 쿠폰을 줬다.', effect: { happy: 5, fit: 1, money: 1 }, meet: s => ({ kind: 'friend', ageRange: near(s), close: 18 }) },
        { text: '초코는 너무 빨랐다. 결국 간식 봉지 소리에 초코가 알아서 돌아왔다. 나는 벤치에 쓰러졌다.', effect: { happy: 1, health: -1 } }),
      K('과자 봉지 소리로 유인한다', 'smart', 'D',
        { text: '주머니 속 과자 봉지를 바스락거리자 초코가 급정거했다. 머리를 쓰면 다리가 편하다.', effect: { happy: 4 } },
        { text: '초코는 내 과자를 낚아채고 다시 달려갔다.', effect: { happy: -1 } }),
    ] }),
  E({ id: 'fun_janggi', on: ['park'], age: [19, 80], text: '정자에서 장기를 두던 할아버지들이 손짓했다. "젊은이, 한 판 둘 텐가?"',
    choices: [
      K('한 판 둔다', 'smart', 'B',
        { text: '"허허, 이 친구 수가 깊구먼." 다음 판엔 훈수꾼들까지 내 편이 됐다.', effect: { happy: 4, smart: 1 } },
        { text: '차·포 다 떼였다. "다음 주에 또 와. 가르쳐 줄게." 할아버지들이 즐거워했다.', effect: { happy: 2 } }),
      K('구경하며 훈수만 둔다', 'smart', 'C',
        { text: '내 훈수대로 둔 할아버지가 이겼다. 식혜 한 잔을 얻어 마셨다.', effect: { happy: 3 } },
        { text: '"자네 훈수 듣다 졌잖아!" 혼났다.', effect: { happy: -1 } }),
    ] }),
  E({ id: 'fun_photo', on: ['park', 'quad'], text: '커플이 휴대폰을 내밀었다. "저희 사진 좀 찍어 주실 수 있어요?"',
    choices: [
      K('각 잡고 찍어 준다', 'art', 'D',
        { text: '역광을 피하고 무릎을 굽혀 찍었다. "헐, 인생샷이에요!!" 둘이 몇 번이나 고맙다고 했다.', effect: { happy: 3, art: 1 } },
        { text: '열 장 모두 내 손가락이 렌즈를 가렸다. 둘이 애써 웃었다.', effect: { happy: -1 } }),
      { label: '대충 한 장 찍어 준다', text: '눈 감은 사진이었다. 그래도 고맙다고 했다.' },
    ] }),
  E({ id: 'fun_wallet', on: ['walk', 'park'], text: '벤치 위에 두툼한 지갑이 놓여 있다. 주변엔 아무도 없다.',
    choices: [
      K('신분증·명함으로 주인을 찾는다', 'smart', 'D',
        { text: '명함 번호로 연락했다. 주인이 헐레벌떡 달려와 사례금을 건넸다. "요즘 이런 분이 어딨어요."', effect: { happy: 3, money: 5 }, karma: [2, 3] },
        { text: '연락처를 찾을 수 없었다. 근처 파출소에 맡겼다.', effect: { happy: 1 }, karma: [1, 2] }),
      { label: '파출소에 맡긴다', text: '경찰관이 서류에 내 이름을 적었다. 뿌듯했다.', karma: [1, 2], effect: { happy: 1 } },
      { label: '현금만 슬쩍한다', chance: .65,
        success: { text: '아무도 보지 않았다. 지갑은 다시 벤치에 두었다. 주머니가 무거웠다.', effect: { money: 8 }, karma: [-4, -2] },
        fail: { text: '며칠 뒤 경찰서에서 연락이 왔다. 벤치 위 CCTV. 돈을 돌려주고 사과문을 썼다.', effect: { happy: -6 }, karma: [-3, -2] } },
    ] }),
  E({ id: 'fun_cat', on: ['walk', 'block'], text: '길고양이 한 마리가 몇 걸음 떨어져서 계속 따라온다.',
    choices: [
      K('쪼그려 앉아 천천히 손을 내민다', 'art', 'D',
        { text: '고양이가 내 손 냄새를 맡더니 다리에 몸을 비볐다. 다음 날도 같은 자리에서 기다리고 있었다.', effect: { happy: 4 } },
        { text: '"하악!" 고양이가 담 위로 사라졌다. 거절당했다.', effect: { happy: -1 } }),
      { label: '편의점에서 츄르를 사 온다', effect: { happy: 3, money: -1 }, text: '츄르 하나에 마음을 연 고양이가 골골송을 불렀다.' },
    ] }),

  /* ── 🏋 헬스장 ── */
  E({ id: 'fun_deadlift', on: ['gym'], text: '트레이너가 화이트보드를 세웠다. "이달의 데드리프트 챌린지 — 1등은 PT 10회 무료!"',
    choices: [
      K('최대 무게에 도전한다', 'fit', 'A',
        { text: '바가 바닥에서 떨어져 천천히 올라왔다. 락아웃. 체육관이 박수를 쳤다. 화이트보드 1위에 내 이름.', effect: { happy: 7, fit: 2 }, memory: true },
        { text: '바가 무릎까지 오다 멈췄다. 허리가 뜨끔했다. 트레이너가 달려와 바를 받아 줬다.', effect: { happy: -2, health: -4 } }),
      { label: '적당한 무게로 자세만 연습한다', text: '무리하지 않았다. 트레이너가 자세가 좋다고 칭찬했다.', effect: { fit: 1, happy: 1 } },
    ] }),
  E({ id: 'fun_spot', on: ['gym'], text: '벤치프레스를 하던 사람이 바를 못 올리고 버둥거린다.',
    choices: [
      K('달려가 보조한다', 'fit', 'D',
        { text: '바를 같이 들어 올렸다. "아, 살았다… 감사합니다." 그 뒤로 운동 메이트가 됐다.', effect: { happy: 3 }, meet: s => ({ kind: 'friend', ageRange: near(s), close: 18 }) },
        { text: '같이 들어도 무거웠다! 결국 옆 사람까지 셋이 들어 올렸다. 다 같이 웃었다.', effect: { happy: 1 } }),
      { label: '트레이너를 부른다', text: '트레이너가 와서 가볍게 바를 들어 올렸다.' },
    ] }),

  /* ── 📚 도서관 ── */
  E({ id: 'fun_libquiz', on: ['library', 'ulib'], text: '안내 데스크에 \'책 속 퀴즈 — 다 맞히면 문화상품권!\' 이벤트 종이가 놓여 있다.',
    choices: [
      K('도전한다', 'smart', 'C',
        { text: '열 문제 중 열 문제. 사서가 문화상품권 3만 원을 건넸다.', effect: { happy: 3, money: 3, smart: 1 } },
        { text: '일곱 문제에서 막혔다. 참가상으로 책갈피를 받았다.', effect: { happy: 1 } }),
      { label: '책이나 읽는다', text: '퀴즈 대신 그 책을 읽었다. 재밌었다.', effect: { smart: 1 } },
    ] }),

  /* ── 🥬 시장·편의점·식당 ── */
  E({ id: 'fun_haggle', on: ['market'], text: '과일 가게 사장님이 외쳤다. "오늘 딸기 한 박스 만 오천 원!"',
    choices: [
      K('넉살 좋게 깎는다', 'charm', 'C',
        { text: '"사장님 오늘 너무 멋있으시다~ 만 원에 안 될까요?" "에이 참… 가져가!" 덤으로 귤까지 받았다.', effect: { happy: 4, money: 1 } },
        { text: '"이거 원가야 원가." 사장님 눈빛이 단호했다. 정가에 샀다.', effect: { happy: -1 } }),
      { label: '정가에 산다', text: '딸기가 달았다.', effect: { happy: 1 } },
    ] }),
  E({ id: 'fun_change', on: ['conveni'], text: '편의점에서 계산하고 나오는데, 거스름돈이 좀 이상한 것 같다.',
    choices: [
      K('영수증을 다시 맞춰 본다', 'smart', 'D',
        { text: '알바생이 만 원을 오천 원으로 찍었었다. 같이 다시 셌다. "제 돈에서 빠질 뻔했어요. 감사합니다!"', effect: { happy: 2 }, karma: [1, 2] },
        { text: '아무리 봐도 모르겠다. 그냥 나왔다. 집에 와서 보니 몇천 원이 비었다.', effect: { happy: -1 } }),
      { label: '그냥 나간다', text: '기분 탓이겠지.' },
    ] }),
  E({ id: 'fun_spicy', on: ['diner'], text: '벽에 붙은 포스터: \'지옥불 떡볶이 — 10분 안에 다 먹으면 공짜 + 명예의 전당\'',
    choices: [
      K('도전한다', 'fit', 'B',
        { text: '눈물 콧물을 쏟았지만 9분 48초. 명예의 전당에 폴라로이드가 붙었다.', effect: { happy: 6, money: 1 }, memory: true },
        { text: '세 번째 떡에서 혀가 사라졌다. 우유 두 팩을 마셨다. 밤새 배가 아팠다.', effect: { happy: -2, health: -3, money: -1 } }),
      { label: '보통맛을 먹는다', text: '보통맛도 충분히 매웠다.', effect: { happy: 2 } },
    ] }),

  /* ── 🚉 터미널·지하철 ── */
  E({ id: 'fun_tourist', on: ['station'], text: '외국인 관광객이 지도 앱을 내밀었다. "Excuse me, how can I get to Gyeongbokgung?"',
    choices: [
      K('영어로 안내한다', 'smart', 'C',
        { text: '"Take Line 3 to Gyeongbokgung Station, exit 5!" 관광객이 환하게 웃으며 고향 엽서 한 장을 건넸다.', effect: { happy: 4, smart: 1 }, karma: [1, 1] },
        { text: '"Go… straight… and… 어… 저기!" 결국 매표소까지 같이 걸어가 줬다. 그래도 고마워했다.', effect: { happy: 2 } }),
      K('손짓 발짓으로 설명한다', 'charm', 'D',
        { text: '손가락 세 개(3호선)와 경복궁 사진을 번갈아 가리켰다. 통했다! 하이파이브를 했다.', effect: { happy: 3 } },
        { text: '관광객은 반대 방향 열차를 탔다. …미안해요.', effect: { happy: -1 } }),
    ] }),
  E({ id: 'fun_door', on: ['station'], text: '"출입문 닫습니다." 저 앞의 열차 문이 닫히기 시작했다.',
    choices: [
      K('전력 질주', 'fit', 'D',
        { text: '문틈으로 미끄러지듯 탔다. 아무도 박수 치진 않았지만 마음속으로는 기립 박수.', effect: { happy: 2 } },
        { text: '문에 가방끈이 끼었다. 다음 역까지 가방이 반쯤 바깥 구경을 했다.', effect: { happy: -2 } }),
      { label: '다음 열차를 탄다', text: '4분 뒤 열차는 자리가 비어 있었다. 오히려 좋았다.', effect: { happy: 1 } },
    ] }),

  /* ── 🎤 공연장·PC방·캠퍼스 ── */
  E({ id: 'fun_stage', on: ['concert'], text: '가수가 객석을 향해 외쳤다. "오늘 노래 좀 하시는 분, 무대로 올라오실래요?"',
    choices: [
      K('손을 번쩍 든다', 'art', 'A',
        { text: '무대 위에서 한 소절. 가수가 놀란 얼굴로 하이파이브를 했다. 그날 밤 영상이 돌았다.', effect: { happy: 9, art: 2, charm: 1 }, memory: true },
        { text: '긴장해서 가사를 다 까먹었다. 가수가 옆에서 같이 불러 줬다. 그래도 평생 이야깃거리.', effect: { happy: 4 } }),
      { label: '떼창으로 함께한다', text: '목이 쉬도록 따라 불렀다.', effect: { happy: 3 } },
    ] }),
  E({ id: 'fun_pctour', on: ['pcbang'], text: 'PC방 사장님이 마이크를 잡았다. "지금부터 즉석 대회! 1등은 정액권 10시간!"',
    choices: [
      K('출전한다', 'craft', 'B',
        { text: '결승에서 역전승. 사장님이 정액권과 컵라면을 안겨 줬다.', effect: { happy: 5, money: 1 } },
        { text: '1라운드 탈락. 상대의 손이 보이지 않았다.', effect: { happy: -2 } }),
      { label: '구경한다', text: '결승전은 꽤 볼만했다.', effect: { happy: 1 } },
    ] }),
  E({ id: 'fun_festival', on: ['quad', 'campus', 'union'], season: ['봄', '가을'], text: '축제 장기자랑 참가자를 모집한다. 현수막: "1등 상금 50만 원!"',
    choices: [
      K('노래로 나간다', 'art', 'B',
        { text: '무대가 끝나자 함성이 터졌다. 2등! 상금 20만 원.', effect: { happy: 7, money: 20, charm: 1 }, memory: true },
        { text: '반주가 끊겼다. 무반주로 끝까지 불렀다. 상은 없었지만 박수는 제일 컸다.', effect: { happy: 3 } }),
      K('춤으로 나간다', 'fit', 'B',
        { text: '아이돌 안무를 완벽하게 재현했다. 1등! 상금 50만 원.', effect: { happy: 8, money: 50 }, memory: true },
        { text: '발목을 살짝 접질렸다. 그래도 끝까지 췄다.', effect: { happy: 1, health: -2 } }),
      { label: '관객으로 즐긴다', text: '친구들과 소리 지르며 응원했다.', effect: { happy: 2 } },
    ] }),

  /* ── 🏘 집 앞 ── */
  E({ id: 'fun_elevator', on: ['block'], text: '엘리베이터가 덜컹하더니 층 사이에 멈췄다. 안엔 이웃 한 명과 나, 둘뿐이다.',
    choices: [
      K('농담으로 분위기를 푼다', 'charm', 'D',
        { text: '구조대가 올 때까지 40분, 웃다 보니 친해졌다. 다음 날 {new|이} 떡을 들고 왔다.', effect: { happy: 3 }, meet: s => ({ kind: 'neighbor', ageRange: near(s), close: 20 }) },
        { text: '농담이 안 먹혔다. 40분이 4시간 같았다.', effect: { happy: -2 } }),
      K('비상벨로 침착하게 연락한다', 'smart', 'E',
        { text: '관리실과 연락해 10분 만에 나왔다. 이웃이 든든했다며 고마워했다.', effect: { happy: 2 } },
        { text: '버튼을 잘못 눌러 화재 경보가 울렸다. 온 동네가 내려왔다.', effect: { happy: -2 } }),
    ] }),
  E({ id: 'fun_kimchi', on: ['block'], season: ['가을', '겨울'], text: '아랫집에서 김장을 하는데 손이 모자라 보인다. "잠깐 거들어 줄 수 있어요?"',
    choices: [
      K('팔을 걷어붙인다', 'craft', 'C',
        { text: '속을 척척 넣었다. "손맛 있네!" 김치 한 통과 수육을 얻었다.', effect: { happy: 4, health: 1 } },
        { text: '고춧가루가 눈에 들어갔다. 다들 웃으며 물을 갖다줬다. 그래도 김치는 받았다.', effect: { happy: 1 } }),
      { label: '바쁘다고 한다', text: '저녁 내내 김치 냄새가 났다.' },
    ] }),

  /* ── 💼 직장 ── */
  E({ id: 'fun_present', on: ['office'], text: '팀장님이 다급하게 불렀다. "오늘 임원 보고, 자네가 해 봐. 30분 뒤야."',
    choices: [
      K('숫자로 승부한다', 'smart', 'B',
        { text: '숫자로 조목조목 짚었다. 임원이 고개를 끄덕였다. 팀장님이 어깨를 두드렸다.', effect: { happy: 4 }, do: perf(6) },
        { text: '질문 하나에 말이 꼬였다. 회의실에 정적이 흘렀다.', effect: { happy: -3 }, do: perf(-4) }),
      K('말발로 승부한다', 'charm', 'B',
        { text: '농담으로 시작해 분위기를 잡았다. 결론은 기억 안 나도 인상은 남았다.', effect: { happy: 4 }, do: perf(5) },
        { text: '농담이 싸늘하게 식었다. 임원이 시계를 봤다.', effect: { happy: -3 }, do: perf(-4) }),
      { label: '자료만 만들어 팀장님께 넘긴다', text: '팀장님이 발표했다. 내 슬라이드였다.', effect: { happy: -1 } },
    ] }),
  E({ id: 'fun_hoesik', on: ['work'], text: '회식 2차는 노래방. 팀장님이 마이크를 내밀었다. "막내… 아니, 자네 한 곡!"',
    choices: [
      K('분위기를 띄운다', 'art', 'C',
        { text: '트로트 한 곡에 팀장님이 탬버린을 잡았다. 다음 날 팀 분위기가 좋아졌다.', effect: { happy: 4 }, do: perf(3) },
        { text: '발라드를 골랐다… 분위기가 가라앉았다. 누군가 조용히 다음 곡을 예약했다.', effect: { happy: -2 } }),
      { label: '탬버린 담당을 자처한다', text: '박자는 틀렸지만 열정은 1등이었다.', effect: { happy: 2 } },
    ] }),
  E({ id: 'fun_excel', on: ['office'], text: '공유 엑셀이 #REF! 투성이가 됐다. 마감까지 한 시간.',
    choices: [
      K('수식을 직접 고친다', 'smart', 'C',
        { text: '20분 만에 복구했다. 팀에서 \'구원자\'라는 별명이 생겼다.', effect: { happy: 3 }, do: perf(5) },
        { text: '고칠수록 #REF!가 늘었다. 결국 야근.', effect: { happy: -3, health: -1 } }),
      { label: 'IT팀에 SOS', text: '두 시간 뒤에 답이 왔다. 마감은 지났다.', effect: { happy: -1 }, do: perf(-2) },
    ] }),

  /* ── 🌧 아무 날 ── */
  E({ id: 'fun_umbrella', on: ['day'], when: s => ['rain', 'storm'].includes(s.weather) && s.age >= 20, text: '갑자기 쏟아진 비. 버스 정류장 처마 밑, 우산 없는 사람과 나란히 서 있다. 나한테는 우산이 하나 있다.',
    choices: [
      K('"같이 쓰실래요?"', 'charm', 'D',
        { text: '우산 하나에 어깨가 반씩 젖었다. 정류장 두 개를 같이 걸었다. 헤어질 때 {new|이} 번호를 물었다.', effect: { happy: 4 }, meet: s => ({ kind: 'friend', gender: opp(s), ageRange: near(s), close: 14, heart: 14 }) },
        { text: '"괜찮아요." 단칼에 거절당했다. 둘이 나란히 비만 바라봤다.', effect: { happy: -1 } }),
      { label: '우산을 주고 뛰어간다', text: '흠뻑 젖었지만 기분은 좋았다.', karma: [1, 2], effect: { happy: 2, health: -1 } },
    ] }),
);
})();
