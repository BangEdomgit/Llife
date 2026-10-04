// 그날 밤 장면: 달빛 드는 방의 침대와 이불 속 두 사람
// - 두 사람은 관절 있는 더미: 머리·목·가슴·허리·골반·엉덩이·(가슴)·허벅지·종아리·발·위팔·아래팔. 실제 비율(1 = 약 0.85cm, 매트리스 236 = 2m)
//   무릎·손·팔꿈치처럼 바닥을 짚은 곳은 고정, 나머지 관절은 뼈 길이를 지키며 따라감(두 원의 교점)
// - 체위 넷(정상위·후배위·기승위·엎드려): 상대 성격에 따라 고름. 주소에 ?pose=doggy 처럼 고정 가능
// - 박자: 점점 빨라짐 → 세게 두 번 → 세게 누른 채 떨림 두 번 → 축 늘어짐
//   밀어 넣을수록 빨라져 부딪히는 순간 멈추며 살짝 튕기고, 엉덩이·가슴 살은 관성으로 출렁임. 받는 쪽은 밀렸다 돌아오고 매트리스가 눌림
// - 이불: 중력·장력·감쇠로 몸 위에 얹혀 출렁이고, 몸 실루엣이 이불에 비침. 행위 자체는 그리지 않음
// - 상대 만족감이 높을수록 하트가 많이, 50 아래면 하트 없이 짧게 흔들리다 실망(… 말풍선, 30 아래면 깨진 하트)
// - 주소에 ?dummy 를 붙이면 이불을 반투명하게 하고 더미를 색으로 보여줌 (실험용)
(function () {
'use strict';
const HEART = 'M0,5 C-7,0 -6,-6 -2.5,-6 C-1,-6 0,-5 0,-4 C0,-5 1,-6 2.5,-6 C6,-6 7,0 0,5 Z';
const CX = Array.from({ length: 44 }, (_, i) => 68 + 216 * i / 43);   // 이불 윗선 점들의 x
const FOLDS = [[112, -4, .8], [146, 3, 1], [176, -3, .7], [212, 4, 1], [250, -2, .8]];
const MY = 129;                                                       // 매트리스 윗면
const ROOM = `<svg class="bed" viewBox="0 0 320 190" aria-hidden="true"><defs>
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
  <filter id="ntBlur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.7"/></filter>
  <clipPath id="ntQC"><path class="nt-qc"/></clipPath>
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
    <path class="nt-q" fill="url(#ntQuilt)"/>
    <g class="nt-sil" clip-path="url(#ntQC)"><g filter="url(#ntBlur)" opacity=".4"><path class="nt-sf" fill="#2b1838"/><path class="nt-sm" fill="#2b1838"/></g></g><path class="nt-st" fill="none" stroke="#efdcf5" stroke-width=".9" stroke-dasharray="2.2 2.6" opacity=".45"/>
    <g fill="none" stroke-linecap="round">${FOLDS.map(([, , o]) => `<path class="nt-f" stroke="#5c3f70" stroke-width="2.2" opacity="${.26 * o}"/><path class="nt-f" stroke="#f1e0f7" stroke-width="1.1" opacity="${.18 * o}"/>`).join('')}</g>
    <path class="nt-hem" fill="none" stroke="#5a3e6e" stroke-width="2.2" opacity=".55"/><path class="nt-rim" fill="none" stroke="#f3e6f8" stroke-width="1.3" stroke-linecap="round" opacity=".6"/>
    <g class="nt-dummy" hidden><path class="nt-df" fill="#ff9ec4" opacity=".8"/><path class="nt-dm" fill="#6bb5ff" opacity=".8"/><path class="nt-dj" fill="none" stroke="#222" stroke-width=".8"/></g>
  </g>
  <ellipse class="nt-warm" cx="182" cy="116" rx="122" ry="54" fill="url(#ntWarm)" opacity="0"/>
  <path d="M216,92 L290,92 L224,170 L112,170 Z" fill="url(#ntBeam)"/>
  <g class="nt-hearts"></g><g class="nt-fx"></g>
</g></svg>`;

/* ---------- 더미 ---------- */
// 길이와 반지름(옆에서 본 두께의 절반). [a, b]는 뿌리 → 끝으로 가늘어짐
const BODY = {
  m: { head: 11.8, neck: 14, torso: 61, thigh: 50, shin: 50, foot: 26, uarm: 39, farm: 32,
    r: { neck: 6.5, chest: 14.5, waist: 11.5, hip: 12.5, butt: 12, breast: 0, thigh: [10, 6.5], shin: [6, 4], foot: [4, 2.4], uarm: [5.6, 4.2], farm: [4, 3] } },
  f: { head: 11.2, neck: 13, torso: 56, thigh: 46, shin: 46, foot: 23, uarm: 35, farm: 29,
    r: { neck: 5.5, chest: 12.2, waist: 9.6, hip: 12.6, butt: 13.5, breast: 6.8, thigh: [10.5, 6], shin: [5.5, 3.6], foot: [3.6, 2.2], uarm: [4.8, 3.6], farm: [3.4, 2.6] } },
};
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const polar = (o, ang, l) => [o[0] + Math.cos(ang) * l, o[1] + Math.sin(ang) * l];
const perp = (v, pref) => { const p = [-v[1], v[0]]; return p[0] * pref[0] + p[1] * pref[1] >= 0 ? unit(p) : unit([-p[0], -p[1]]); };
// 두 원(중심 a 반지름 ra, 중심 b 반지름 rb)의 교점 중 pref 쪽. 닿지 않으면 b 쪽으로 쭉 뻗음
function meet(a, ra, b, rb, pref) {
  const D = Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1])), u = [(b[0] - a[0]) / D, (b[1] - a[1]) / D];
  const d = Math.min(ra + rb - 1e-6, Math.max(Math.abs(ra - rb) + 1e-6, D));
  const x = (d * d + ra * ra - rb * rb) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const p1 = [a[0] + u[0] * x - u[1] * h, a[1] + u[1] * x + u[0] * h], p2 = [a[0] + u[0] * x + u[1] * h, a[1] + u[1] * x - u[0] * h];
  return (p1[0] - p2[0]) * pref[0] + (p1[1] - p2[1]) * pref[1] > 0 ? p1 : p2;
}
// 어깨(sh)·골반(hip)과 몸 앞쪽(front: 배·얼굴 쪽) → 목·머리·허리·엉덩이·가슴. jig: 출렁이는 살의 어긋남
function trunk(B, sh, hip, front, tilt, jig) {
  const sp = unit(sub(sh, hip)), hd = unit(add(sp, front, tilt));
  return {
    sh, hip, neck: add(sh, sp, B.neck * .55), head: add(add(sh, hd, B.neck + B.head * .75), front, 1.5),
    waist: add(lerp(sh, hip, .55), front, -1),
    butt: add(add(add(hip, front, -B.r.hip * .32), sp, -7), jig.butt),
    breast: B.r.breast ? add(add(lerp(sh, hip, .24), front, B.r.chest * .72), jig.breast) : null,
    chest: lerp(sh, hip, .24), front,
  };
}
// 관절 → 캡슐 [ax, ay, bx, by, ra, rb]
function caps(B, J) {
  const c = [], seg = (a, b, ra, rb = ra) => c.push([a[0], a[1], b[0], b[1], ra, rb]);
  seg(J.head, J.head, B.head); seg(J.neck, J.sh, B.r.neck);
  seg(J.sh, J.waist, B.r.chest, B.r.waist); seg(J.waist, J.hip, B.r.waist, B.r.hip); seg(J.butt, J.butt, B.r.butt);
  if (J.breast) seg(J.breast, J.breast, B.r.breast);
  seg(J.hip, J.knee, ...B.r.thigh); seg(J.knee, J.ankle, ...B.r.shin); seg(J.ankle, J.toe, ...B.r.foot);
  seg(J.sh, J.elbow, ...B.r.uarm); seg(J.elbow, J.hand, ...B.r.farm);
  return c;
}
// 체위: s = { d(움직이는 쪽 엉덩이를 뺀 거리, 호의 길이. 0 = 골반이 맞닿음, 조금 − = 살이 눌림), tr(떨림), slump(축 늘어짐 0~1), sink(매트리스 눌림), bs(받는 쪽이 밀린 거리), jig }
//   → { m, f: 관절, act: 움직이는 쪽, dir: 부딪히는 방향 }
const lie = (B, sh, k, b) => [[sh + b, MY - B.r.chest + 1 + k * .4], [sh + B.torso + b * .6, MY - B.r.hip + 2 + k]];
const legsBack = (B, J, knee) => Object.assign(J, { knee, ankle: [knee[0] + B.shin, MY - B.r.shin[1]], toe: [knee[0] + B.shin + B.foot * .75, MY - 1.5] });
const POSES = {
  // 정상위: 여자는 등을 대고 무릎을 세움, 남자는 다리 사이에 무릎 꿇고 팔꿈치로 여자 어깨 옆을 짚음
  missionary(s, M, F) {
    const [fsh, fhip] = lie(F, 102, s.sink, s.bs);
    const f = trunk(F, fsh, fhip, [0, -1], .28, s.jig.f);
    f.ankle = [fhip[0] + 64, MY - F.r.shin[1]]; f.knee = meet(fhip, F.thigh, f.ankle, F.shin, [.3, -1]); f.toe = [f.ankle[0] + F.foot * .8, MY - 2];
    const knee = [fhip[0] + 34, MY - M.r.shin[0] + 1], hip = add(polar(knee, -2.5 + s.d / M.thigh, M.thigh), [0, s.tr + 4 * s.slump + s.sink]);
    const elbow = [fsh[0] + 6 + s.bs * .6, MY - M.r.farm[0]], sh = meet(hip, M.torso, elbow, M.uarm * (1 - .15 * s.slump), [0, -1]);
    const m = legsBack(M, trunk(M, sh, hip, perp(sub(sh, hip), [0, 1]), .35, s.jig.m), knee);
    Object.assign(m, { elbow, hand: [elbow[0] - M.farm, MY - M.r.farm[1]] });
    f.hand = add(lerp(sh, hip, .3), perp(sub(sh, hip), [0, -1]), M.r.chest * .9); f.elbow = meet(fsh, F.uarm, f.hand, F.farm, [-.3, -1]);   // 남자 등을 감싸 안음
    return { m, f, act: 'm', dir: unit(sub(fhip, hip)) };
  },
  // 후배위: 여자는 무릎과 팔꿈치로 엎드려 엉덩이를 들고, 남자는 뒤에서 무릎 꿇고 여자 등 위로 숙여 손을 짚음
  doggy(s, M, F) {
    const fknee = [178, MY - F.r.shin[0] + 1 + s.sink * .3], fhip = polar(fknee, -1.66 + s.bs / F.thigh, F.thigh);
    const felbow = [118 + s.bs * .3, MY - F.r.farm[0]], fsh = meet(fhip, F.torso, felbow, F.uarm, [0, -1]);
    const f = legsBack(F, trunk(F, fsh, fhip, perp(sub(fsh, fhip), [0, 1]), -.35, s.jig.f), fknee);
    Object.assign(f, { elbow: felbow, hand: [felbow[0] - F.farm, MY - F.r.farm[1]] });
    const knee = [fknee[0] + 30, MY - M.r.shin[0] + 1], hip = add(polar(knee, -1.73 + s.d / M.thigh, M.thigh), [0, s.tr + 4 * s.slump]);
    const hand = [f.hand[0] + 16, MY - M.r.farm[1]], sh = meet(hip, M.torso, hand, (M.uarm + M.farm) * (.9 - .12 * s.slump), [0, -1]);
    const m = legsBack(M, trunk(M, sh, hip, perp(sub(sh, hip), [0, 1]), .3, s.jig.m), knee);
    Object.assign(m, { hand, elbow: meet(sh, M.uarm, hand, M.farm, [1, 0]) });
    return { m, f, act: 'm', dir: unit(sub(fhip, hip)) };
  },
  // 기승위: 남자는 등을 대고 누움, 여자는 남자 골반 위에 무릎 꿇고 앉아 앞으로 숙여 남자 머리 옆을 짚음. 엉덩이가 오르내림
  cowgirl(s, M, F) {
    const [msh, mhip] = lie(M, 104, s.sink, s.bs * .3);
    const m = trunk(M, msh, mhip, [0, -1], .28, s.jig.m);
    m.knee = [mhip[0] + M.thigh * .97, MY - M.r.thigh[1] - 3]; m.ankle = [m.knee[0] + M.shin * .98, MY - M.r.shin[1]]; m.toe = [m.ankle[0] + 3, m.ankle[1] - M.foot * .8];
    const knee = [mhip[0] - 47, MY - F.r.shin[0] + 1 + s.sink * .5], hip = add(polar(knee, -.56 - .6 * s.d / F.thigh, F.thigh), [0, s.tr + 4 * s.slump + s.sink]);
    const hand = [msh[0] + 12, MY - 2 * M.r.chest + 2 + s.sink], sh = meet(hip, F.torso, hand, (F.uarm + F.farm) * (.62 - .12 * s.slump), [0, -1]);
    const f = legsBack(F, trunk(F, sh, hip, perp(sub(sh, hip), [0, 1]), .25, s.jig.f), knee);
    Object.assign(f, { hand, elbow: meet(sh, F.uarm, hand, F.farm, [1, 0]) });
    m.hand = add(hip, [4, 3]); m.elbow = meet(msh, M.uarm, m.hand, M.farm, [.2, 1]);   // 남자 손은 여자 엉덩이
    return { m, f, act: 'f', dir: [0, 1] };
  },
  // 엎드려: 여자는 엎드려 눕고(얼굴은 베개), 남자는 위에 엎드려 팔꿈치로 짚음. 엉덩이 위로 내려찍음
  prone(s, M, F) {
    const [fsh, fhip] = lie(F, 104, s.sink, s.bs);
    fsh[1] += 2; fhip[1] += 1;
    const f = trunk(F, fsh, fhip, [0, 1], -.15, s.jig.f);
    f.knee = [fhip[0] + F.thigh, MY - F.r.thigh[1] + 1]; f.ankle = [f.knee[0] + F.shin, MY - F.r.shin[1]]; f.toe = [f.ankle[0] + F.foot * .85, MY - 2];
    f.elbow = [fsh[0] - 6, MY - F.r.uarm[1] - 2]; f.hand = [f.elbow[0] - F.farm, MY - F.r.farm[1] - 6];   // 팔은 베개 밑으로
    const knee = [f.knee[0] + 6, MY - M.r.shin[0] + 1], hip = add(polar(knee, -2.52 + s.d / M.thigh, M.thigh), [0, s.tr + 3 * s.slump + s.sink]);
    const elbow = [fsh[0] + 12 + s.bs * .5, MY - M.r.farm[0]], sh = meet(hip, M.torso, elbow, M.uarm * (1 - .25 * s.slump), [0, -1]);
    const m = legsBack(M, trunk(M, sh, hip, perp(sub(sh, hip), [0, 1]), .3, s.jig.m), knee);
    Object.assign(m, { elbow, hand: [elbow[0] - M.farm, MY - M.r.farm[1]] });
    return { m, f, act: 'm', dir: unit([.25, 1]) };
  },
};
// 성격별로 고를 확률
const POSE_W = { shy: { missionary: 4, prone: 1, doggy: 1, cowgirl: .5 }, bold: { cowgirl: 3, doggy: 2.5, missionary: 1, prone: 1.5 }, playful: { cowgirl: 2.5, doggy: 2, missionary: 1, prone: 1 } };
function pickPose(personality) {
  const forced = (location.search.match(/[?&]pose=(\w+)/) || [])[1];
  if (forced && POSES[forced]) return forced;
  const w = POSE_W[personality] || { missionary: 2, doggy: 1.5, cowgirl: 1.5, prone: 1 }, ks = Object.keys(w);
  let r = Math.random() * ks.reduce((a, k) => a + w[k], 0);
  return ks.find(k => (r -= w[k]) < 0) || ks[0];
}
// 캡슐 윗면의 y (x에서). 없으면 Infinity
function capTop([ax, ay, bx, by, ra, rb], x) {
  let top = Infinity, dx = x - ax;
  if (dx * dx < ra * ra) top = ay - Math.sqrt(ra * ra - dx * dx);
  dx = x - bx;
  if (dx * dx < rb * rb) top = Math.min(top, by - Math.sqrt(rb * rb - dx * dx));
  const vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy);
  if (L > Math.abs(ra - rb) + .01) {
    const ux = vx / L, uy = vy / L, sn = (ra - rb) / L, cs = Math.sqrt(1 - sn * sn);
    let px = -uy, py = ux;
    if (py > 0) { px = -px; py = -py; }
    const nx = ux * sn + px * cs, ny = uy * sn + py * cs, x0 = ax + nx * ra, y0 = ay + ny * ra, x1 = bx + nx * rb, y1 = by + ny * rb;
    if (Math.abs(x1 - x0) > .01 && x >= Math.min(x0, x1) && x <= Math.max(x0, x1)) top = Math.min(top, y0 + (x - x0) * (y1 - y0) / (x1 - x0));
  }
  return top;
}
// 캡슐들 → 하나의 채운 path (모든 조각을 같은 방향으로 감아 겹쳐도 구멍이 안 생김)
function capsPath(list) {
  const f = v => v.toFixed(1), ring = (x, y, r) => `M${f(x - r)},${f(y)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0`;
  return list.map(([ax, ay, bx, by, ra, rb]) => {
    let d = ring(ax, ay, ra);
    const vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy);
    if (L > Math.abs(ra - rb) + .01) {
      const ux = vx / L, uy = vy / L, sn = (ra - rb) / L, cs = Math.sqrt(1 - sn * sn);
      const n1 = [ux * sn - uy * cs, uy * sn + ux * cs], n2 = [ux * sn + uy * cs, uy * sn - ux * cs];
      let q = [[ax + n1[0] * ra, ay + n1[1] * ra], [bx + n1[0] * rb, by + n1[1] * rb], [bx + n2[0] * rb, by + n2[1] * rb], [ax + n2[0] * ra, ay + n2[1] * ra]];
      if (q.reduce((s, p, i) => { const r = q[(i + 1) % 4]; return s + p[0] * r[1] - r[0] * p[1]; }, 0) > 0) q = q.reverse();
      d += `M${q.map(p => f(p[0]) + ',' + f(p[1])).join('L')}Z` + ring(bx, by, rb);
    }
    return d;
  }).join('');
}

/* ---------- 박자표 ---------- */
// { t0, T, A(세기), kind: n 보통 | strong 세게 | final 누른 채 떨림 }. 엉덩이는 0(맞닿음) ~ top = 2A(뺀 거리) 사이를 오감
// 한 박자 = (세게·마지막이면) 크게 뺐다가 wu → 밀어 넣기 sl(점점 빨라져 끝에 부딪힘 hit) → (마지막이면) 누른 채 떨림 → 다음 박자 시작점(to)으로
function nightPlan(tier) {
  const S = [], good = tier >= 2, rampEnd = good ? 3.1 : tier === 1 ? 2.5 : 1.8;
  let t = .3;
  const add = (T, A, kind = 'n') => { S.push({ t0: t, T, A, kind }); t += T; };
  for (let T = .62; t < rampEnd; T = Math.max(good ? .22 : .32, T * .87)) add(T, good ? 3.5 + 3.5 * t / rampEnd : 3 + 1.5 * t / rampEnd);
  if (good) { add(.7, 10, 'strong'); add(.7, 11, 'strong'); add(.95, 12, 'final'); add(.9, 12.5, 'final'); }
  else if (tier === 1) { add(.6, 7, 'strong'); add(.48, 5.5, 'final'); }
  else add(.44, 5, 'final');
  S.forEach((s, k) => {
    const nx = S[k + 1];
    s.top = 2 * s.A;
    s.wu = s.kind === 'n' ? 0 : s.kind === 'strong' ? .22 : .24;
    s.sl = s.kind === 'n' ? s.T * .32 : .13;
    s.hit = s.t0 + s.wu + s.sl;
    s.to = !nx || s.kind === 'final' ? 3 : nx.kind === 'n' ? nx.top || 2 * nx.A : 6;
    s.from = k ? S[k - 1].to : 0;
  });
  return { S, end: t };
}
const ease = u => u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;

/* ---------- 재생 ---------- */
let raf = 0;
function run(stage, job, done) {
  const svg = stage.querySelector('svg'), q = c => svg.querySelector(c), f = v => v.toFixed(1), NS = 'http://www.w3.org/2000/svg';
  const cam = q('.nt-cam'), bed = q('.nt-bed'), quilt = q('.nt-q'), qclip = q('.nt-qc'), stitch = q('.nt-st'), hemEl = q('.nt-hem'), rim = q('.nt-rim'), warm = q('.nt-warm');
  const silF = q('.nt-sf'), silM = q('.nt-sm'), heartsEl = q('.nt-hearts'), fx = q('.nt-fx'), face = stage.querySelector('.nt-face'), folds = svg.querySelectorAll('.nt-f');
  const G = window.Game, { sc, p } = job, tier = [30, 50, 70, 90].filter(v => (sc.sat ?? 50) >= v).length, good = tier >= 2;
  const debug = /[?&#]dummy/.test(location.href), poseName = pickPose(p.personality), POSE = POSES[poseName], M = BODY.m, F = BODY.f;
  stage.dataset.pose = poseName;
  const { S, end } = nightPlan(tier), SLUMP = .7, END = end + SLUMP + (good ? 1.9 : 2.3);
  const HB = [null, null, { n: .6, strong: 4, fount: 7 }, { n: 1.5, strong: 7, fount: 14 }, { n: 2.6, strong: 10, fount: 22, ring: 12 }][tier];
  const n = CX.length, y = new Float64Array(n), v = new Float64Array(n), surf = new Float64Array(n), sv = new Float64Array(n), rest = new Float64Array(n), hemL = new Float64Array(n), DT = 1 / 240;
  const ms = { d: 0, tr: 0, slump: 0, sink: 0, bs: 0, jig: { f: { butt: [0, 0], breast: [0, 0] }, m: { butt: [0, 0], breast: [0, 0] } } };
  // 출렁이는 살: 붙은 관절이 갑자기 서거나 움직이면 관성으로 어긋났다가 용수철처럼 돌아옴
  const blobs = [['f', 'butt', 'hip'], ['f', 'breast', 'chest'], ['m', 'butt', 'hip']].map(([w, k, at]) => ({ w, k, at, o: [0, 0], v: [0, 0], p1: null, p2: null }));
  let t = 0, si = 0, hi = 0, sinkV = 0, bsV = 0, jy = 0, jyV = 0, jx = 0, jxV = 0, heat = 0, shakeAt = -9, shakeK = 0, buzz = 0, fount = 0;
  let P = null, capsM = [], capsF = [], lastD = 0, dEnd = null, faceKey = '', finale = false, acc = 0, last = 0;
  const hearts = [];
  // 움직이는 쪽 엉덩이 d, 떨림 tr, 축 늘어짐
  function drive() {
    while (si < S.length - 1 && t >= S[si].t0 + S[si].T) si++;
    const s = S[si];
    if (t >= end) {
      if (dEnd == null) dEnd = lastD;
      const u = Math.min(1, (t - end) / SLUMP);
      return [dEnd + (-1 - dEnd) * ease(u), 0, ease(u)];
    }
    if (t < s.t0) return [0, 0, 0];
    const tau = t - s.t0, rel = s.t0 + s.T - (s.kind === 'final' ? .14 : 0), u = t - s.hit;
    const squish = s.top * .08 * Math.exp(-u * 18) * Math.sin(6.283 * 7 * u);   // 부딪힌 뒤 살이 눌렸다 튕김
    let d, tr = 0;
    if (tau < s.wu) d = s.from + (s.top - s.from) * ease(tau / s.wu);
    else if (tau < s.wu + s.sl) d = (s.wu ? s.top : s.from) * (1 - ((tau - s.wu) / s.sl) ** 2.3);   // 점점 빨라져 부딪힘
    else if (s.kind === 'final') {
      // 세게 누른 채 부들부들 떨림, 끝에 살짝 풀림
      const env = (1 - Math.exp(-u * 30)) * (good ? 1 : .35) * (t > rel ? 1 - (t - rel) / .14 : 1);
      tr = env * .9 * Math.sin(6.283 * 15 * u);
      d = env * (1.5 * Math.sin(6.283 * 12 * u) + .7 * Math.sin(6.283 * 19 * u)) - squish + (t > rel ? 3 * ease((t - rel) / .14) : 0);
      buzz = env;
    } else d = s.to * ease(u / (s.t0 + s.T - s.hit)) - squish;
    lastD = d;
    return [d, tr, 0];
  }
  function surface(i) {
    const x = CX[i];
    let top = Math.min(MY, capTop([62, 122, 98, 122, 6, 6], x));   // 베개
    for (const c of capsF) top = Math.min(top, capTop(c, x));
    for (const c of capsM) top = Math.min(top, capTop(c, x));
    return top - 3.2;
  }
  // 하트 하나 (화면 위로 넘어가지 않게 떠오름)
  function heart(x, y0, o = {}) {
    const el = document.createElementNS(NS, 'use');
    el.setAttribute('href', '#ntH');
    heartsEl.appendChild(el);
    hearts.push({ el, t0: t, x, y: y0, life: o.life || 1.6 + Math.random() * .7, dx: o.dx || 0, dy: Math.max(o.dy ?? -(40 + Math.random() * 26), 12 - y0), sway: o.dx ? 0 : (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 4), fq: .8 + Math.random() * .5, ph: Math.random() * 6.3, s: o.s || .65 + Math.random() * .4, big: !!o.big });
  }
  const at = (arr, x) => { const k = Math.max(0, Math.min(n - 1.001, (x - CX[0]) / (CX[n - 1] - CX[0]) * (n - 1))), i = Math.floor(k); return arr[i] + (arr[i + 1] - arr[i]) * (k - i); };
  const actHip = () => P[P.act].hip;
  const burstAt = (cnt, o) => { for (let j = 0; j < cnt; j++) { const x = actHip()[0] - 30 + Math.random() * 60; heart(x, at(y, x) - 6, typeof o === 'function' ? o(j) : o); } };
  function impact(s) {
    const str = s.kind === 'final' ? 2.2 : s.kind === 'strong' ? 1.8 : Math.min(1.2, .45 + .75 * s.A / 7);
    sinkV += 40 * str; bsV -= 24 * str;
    jyV += (s.kind === 'n' ? 7 : 22) * str; jxV -= (s.kind === 'n' ? 2.5 : 9) * str;
    if (s.kind !== 'n') { shakeAt = t; shakeK = str * .8; }
    // 받는 쪽 살을 찰싹 침
    const rcv = P.act === 'm' ? 'f' : 'm', kick = 70 * str;
    for (const b of blobs) if (b.w === rcv) { b.v[0] += P.dir[0] * kick * (b.k === 'butt' ? 1 : .5); b.v[1] += P.dir[1] * kick * (b.k === 'butt' ? 1 : .5); }
    heat = Math.max(heat, good ? Math.min(1, .3 + .3 * str) : .12);
    if (!HB) return;
    if (s.kind === 'n') { const m = HB.n * ((s.t0 / end) * .6 + .4); burstAt(Math.floor(m) + (Math.random() < m % 1 ? 1 : 0), {}); }
    else burstAt(HB.strong, () => ({ s: .95 + Math.random() * .45, dy: -(60 + Math.random() * 26) }));
    if (s.kind === 'final' && HB.ring) for (let j = 0; j < HB.ring; j++) { const a = Math.PI * (1.05 + .9 * j / (HB.ring - 1)), r = 46 + Math.random() * 16, hx = actHip()[0]; heart(hx, at(y, hx) - 4, { dx: Math.cos(a) * r, dy: Math.sin(a) * r * .8 - 10, s: .8 + Math.random() * .3, life: 1.3 }); }
  }
  // 실망: 초상화를 가리키는 말풍선(…), 만족감이 아주 낮으면 깨진 하트
  function letdown() {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<g transform="translate(64,24)"><g class="nt-bub"><path d="M6,0 H38 A6,6 0 0 1 44,6 V16 A6,6 0 0 1 38,22 H6 A6,6 0 0 1 0,16 V14 L-7,10.5 L0,8 V6 A6,6 0 0 1 6,0 Z" fill="#f2eee6"/>${[13, 22, 31].map((x, j) => `<circle class="nt-dot" cx="${x}" cy="11" r="2" fill="#6b6478" style="animation-delay:${.35 + j * .3}s"/>`).join('')}</g></g>` +
      (tier === 0 ? `<g transform="translate(196,48) scale(2.2)"><g class="nt-broke"><path class="l" d="M0,5 C-7,0 -6,-6 -2.5,-6 C-1,-6 0,-5 0,-4 L-1.2,-1.6 L1,.4 L-.9,2.6 Z" fill="#a39bb3"/><path class="r" d="M0,-4 C0,-5 1,-6 2.5,-6 C6,-6 7,0 0,5 L-.9,2.6 L1,.4 L-1.2,-1.6 Z" fill="#a39bb3"/></g></g>` : '');
    fx.appendChild(g);
  }
  function step(settle) {
    t += DT;
    const [d, tr, slump] = settle ? [0, 0, 0] : drive();
    while (!settle && hi < S.length && S[hi].hit <= t) impact(S[hi++]);
    sinkV += (-500 * ms.sink - 22 * sinkV) * DT; ms.sink += sinkV * DT;
    bsV += (-300 * ms.bs - 18 * bsV) * DT; ms.bs += bsV * DT;
    jyV += (-900 * jy - 24 * jyV) * DT; jy += jyV * DT;
    jxV += (-700 * jx - 20 * jxV) * DT; jx += jxV * DT;
    Object.assign(ms, { d, tr, slump });
    P = POSE(ms, M, F); capsM = caps(M, P.m); capsF = caps(F, P.f);
    for (const b of blobs) {
      const pj = P[b.w][b.at];
      if (b.p2) for (let k = 0; k < 2; k++) b.v[k] += (-1200 * b.o[k] - 7 * b.v[k] - (pj[k] - 2 * b.p1[k] + b.p2[k]) / (DT * DT) * .45) * DT;
      b.p2 = b.p1; b.p1 = pj;
      b.o[0] += b.v[0] * DT; b.o[1] += b.v[1] * DT;
      const l = Math.hypot(b.o[0], b.o[1]);
      if (l > 6) { b.o[0] *= 6 / l; b.o[1] *= 6 / l; }
      ms.jig[b.w][b.k] = b.o.slice();
    }
    // 이불: 중력 + 장력(옆 점과의 차이) + 내부 감쇠, 몸에 닿으면 그 위에 얹히고 몸이 올라가는 속도를 받음
    for (let i = 0; i < n; i++) {
      const s0 = surf[i], s1 = surface(i);
      surf[i] = s1; sv[i] = Math.max(-150, Math.min(150, (s1 - s0) / DT));
      const yl = y[i - 1] ?? y[i], yr = y[i + 1] ?? y[i], vl = v[i - 1] ?? v[i], vr = v[i + 1] ?? v[i];
      v[i] += (1500 + 2200 * (yl - 2 * y[i] + yr) + 40 * (vl - 2 * v[i] + vr) - 2 * v[i]) * DT;
    }
    for (let i = 0; i < n; i++) {
      y[i] += v[i] * DT;
      if (y[i] >= surf[i]) { y[i] = surf[i]; v[i] = Math.min(v[i], sv[i]); }
      hemL[i] += ((y[i] - rest[i]) * .32 - hemL[i]) * Math.min(1, DT * 7);
    }
    if (settle) return;
    if (buzz) { shakeK = Math.max(shakeK, .35 * buzz); if (t - shakeAt > .05) shakeAt = t - .02; }
    buzz = 0;
    if (HB && t >= S[S.length - 1].t0 && t < end) { fount += HB.fount * DT; while (fount >= 1) { fount--; burstAt(1, { s: .8 + Math.random() * .5, dy: -(55 + Math.random() * 35) }); } }
    heat = Math.max(heat * Math.exp(-DT * 1.4), t < end ? (good ? .1 + .4 * Math.min(1, t / end) : .05) : 0);
    if (!finale && t > end + .45) {
      finale = true;
      if (good) heart(actHip()[0], at(y, actHip()[0]) - 14, { big: true, s: 1.4 + .3 * tier, life: 1.8, dy: -24 });
      else letdown();
    }
  }
  // 상대 표정 (관계 중 초상화)
  function faceNow() {
    const k = Math.min(1, t / end), first = S.find(s => s.kind !== 'n');
    if (t >= end + .3) return good ? (tier >= 3 ? 'bliss' : 'content') : 'disappointed';
    if (!good) return k < (tier ? .4 : .25) ? 'p0' : 'bored';
    if (t >= first.t0) return 'p3';
    return 'p' + (k < .28 ? 0 : k < .6 ? 1 : 2);
  }
  const curve = Q => Q.slice(0, -1).map((b, i) => {
    const a = Q[i - 1] || b, c = Q[i + 1], e = Q[i + 2] || c;
    return ` C${f(b[0] + (c[0] - a[0]) / 6)},${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)},${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])},${f(c[1])}`;
  }).join('');
  const hemY = x => 150 - 17 * Math.exp(-(((x - 66) / 22) ** 2)) + .9 * Math.sin(x * .13 + .6) + FOLDS.reduce((s, [c, lean]) => s + 1.6 * Math.exp(-(((x - c - lean) / 6) ** 2)), 0) + at(hemL, x);
  function draw() {
    const top = CX.map((x, i) => [x, y[i]]), hem = Array.from({ length: 9 }, (_, i) => { const x = 284 - 216 * i / 8; return [x, hemY(x)]; });
    const l = top[0], r = top[n - 1], hr = hem[0], hl = hem[8];
    const qd = `M${f(l[0])},${f(l[1])}${curve(top)} C285.5,${f(r[1] + 8)} 285.5,${f(hr[1] - 8)} ${f(hr[0])},${f(hr[1])}${curve(hem)} C${f(hl[0] - 5)},${f(hl[1] - 4)} ${f(l[0] - 5)},${f(l[1] + 6)} ${f(l[0])},${f(l[1])} Z`;
    quilt.setAttribute('d', qd); qclip.setAttribute('d', qd);
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
    // 이불에 비치는 두 사람 실루엣 (실험용이면 색으로)
    const pf = capsPath(capsF), pm = capsPath(capsM);
    if (debug) {
      q('.nt-df').setAttribute('d', pf); q('.nt-dm').setAttribute('d', pm);
      const J = ['head', 'neck', 'sh', 'waist', 'hip', 'knee', 'ankle', 'toe', 'elbow', 'hand'];
      q('.nt-dj').setAttribute('d', ['f', 'm'].map(w => { const j = P[w]; return `M${[j.head, j.sh, j.hip, j.knee, j.ankle, j.toe].map(a => f(a[0]) + ',' + f(a[1])).join('L')}M${[j.sh, j.elbow, j.hand].map(a => f(a[0]) + ',' + f(a[1])).join('L')}` + J.map(k => `M${f(j[k][0] - 1)},${f(j[k][1])}a1,1 0 1,0 2,0a1,1 0 1,0 -2,0`).join(''); }).join(''));
    } else { silF.setAttribute('d', pf); silM.setAttribute('d', pm); }
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
    if (face && window.Avatar && G) {
      const key = faceNow();
      if (key !== faceKey) {
        faceKey = key;
        const du = key[0] === 'p' && key.length === 2 ? { lv: +key[1] } : { mood: key };
        face.innerHTML = Avatar.render(G.look(p), 64, { age: G.npcAge(p), during: Object.assign(du, { personality: p.personality, fig: sc.fig }) });
      }
      face.style.transform = sk > .02 ? `translate(${f(cx * 1.2)}px,${f(cy * 1.2)}px)` : '';
    }
  }
  function frame(now) {
    acc += last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
    while (acc >= DT) { step(); acc -= DT; }
    draw();
    if (t < END) raf = requestAnimationFrame(frame);
    else done();
  }
  if (debug) { quilt.setAttribute('opacity', '.35'); q('.nt-sil').setAttribute('hidden', ''); q('.nt-dummy').removeAttribute('hidden'); }
  // 처음엔 이불을 몸 위에 내려놓고 가라앉힘
  P = POSE(ms, M, F); capsM = caps(M, P.m); capsF = caps(F, P.f);
  for (let i = 0; i < n; i++) { surf[i] = surface(i); y[i] = surf[i]; }
  for (let j = 0; j < 300; j++) step(true);
  t = 0; rest.set(y); hemL.fill(0); v.fill(0);
  draw();
  raf = requestAnimationFrame(frame);
}

window.Night = {
  html: () => `<div class="nt-stage">${ROOM}<div class="nt-face"></div></div>`,
  run, stop: () => cancelAnimationFrame(raf),
  // 실험용: 체위 이름과 움직임 상태 → 관절 좌표
  pose: (name, st = {}) => POSES[name](Object.assign({ d: 0, tr: 0, slump: 0, sink: 0, bs: 0, jig: { f: { butt: [0, 0], breast: [0, 0] }, m: { butt: [0, 0], breast: [0, 0] } } }, st), BODY.m, BODY.f),
};
})();
