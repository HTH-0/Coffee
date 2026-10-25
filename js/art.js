/* =========================================================
   장별 몬스터 그림 + 손상 연출
   각 항목: scene() 장면 HTML, portrait() 초상화 HTML,
            apply(root, n, isNew) HP 가 n 만큼 깎였을 때 모습, hitPoint(n) 공격 이펙트 위치
   좌표계는 1280x720
   ========================================================= */
(function () {
  'use strict';

  var INK = '#2A0F06';
  var MAX = 10;

  /* ---------------------------------------------------------
     장별 단계 그림 (assets/chN/base/f01~f10.webp, 맞았을 때 hit/f01~f10.webp)
     받은 피해 n → 그림: 0→1, 1→2 ... 8→9, 9→9(가장 지친 모습), 10→10(쓰러짐)
     맞는 순간에는 맞기 전 단계의 hit 그림을 잠깐 보여 준 뒤 다음 단계 base 그림으로 넘어간다
     --------------------------------------------------------- */
  var FRAMES = 10;
  var HIT_MS = 650;
  function frameOf(n) {
    if (n >= MAX) return FRAMES;
    return Math.min(n + 1, FRAMES - 1);
  }
  function src(ch, kind, f) { return 'assets/ch' + ch + '/' + kind + '/f' + String(f).padStart(2, '0') + '.webp'; }

  function sheet(ch, hasHit) {
    var timer = 0;
    function show(root, kind, f) {
      root.querySelector('.card-bg').src = src(ch, kind, f);
      Array.prototype.forEach.call(root.querySelectorAll('.card-img'), function (img) {
        img.classList.toggle('show', img.getAttribute('data-kind') === kind && +img.getAttribute('data-frame') === f);
      });
    }
    return {
      scene: function () {
        var s = '<img class="card-bg" src="' + src(ch, 'base', 1) + '" alt=""><div class="card">';
        [['base', true], ['hit', hasHit]].forEach(function (k) {
          if (!k[1]) return;
          for (var i = 1; i <= FRAMES; i++) s += '<img class="card-img" data-kind="' + k[0] + '" data-frame="' + i + '" src="' + src(ch, k[0], i) + '" alt="">';
        });
        return s + '</div>';
      },
      portrait: function () { return '<img class="portrait-crop" src="' + src(ch, 'base', 1) + '" alt="">'; },
      apply: function (root, n, isNew) {
        clearTimeout(timer);
        var f = frameOf(n);
        // 맞는 순간: 맞기 전 단계의 hit 그림 → 다음 단계 base 그림 (base1 → hit1 → base2)
        if (isNew && hasHit) {
          show(root, 'hit', frameOf(n - 1));
          timer = setTimeout(function () { show(root, 'base', f); }, HIT_MS);
        } else {
          show(root, 'base', f);
        }
      },
      hitPoint: function () { return [580, 300]; }
    };
  }
  var tree = sheet(1, false);
  tree.portrait = function () { return '<img src="assets/ch1-portrait.webp" alt="">'; };
  /* ---------------------------------------------------------
     2장 커피 열매 군단: 10명이 한꺼번에 서 있고, 한 문제마다 한 명씩 쓰러진다
     assets/ch2/cut/base/fNN.webp = N번 병사, cut/hit/fNN.webp = 맞은 N번 병사 (배경 없는 그림)
     앞줄 1~5번 → 뒷줄 6~10번 순서로 쓰러지고, 10번(대장)은 뒷줄 가운데
     --------------------------------------------------------- */
  // [가운데 x, 발 y, 높이]
  var SQUAD = [
    [200, 546, 214], [390, 546, 214], [580, 546, 214], [770, 546, 214], [960, 546, 214],
    [295, 404, 172], [485, 404, 172], [865, 404, 172], [1055, 404, 172], [675, 398, 196]
  ];
  var berries = {
    scene: function () {
      var s = '<img class="squad-bg" src="assets/title-bg.webp" alt="">';
      SQUAD.forEach(function (p, i) {
        var w = Math.round(p[2] * 486 / 570);
        s += '<div class="trooper' + (i >= 5 ? ' back' : '') + '" data-t="' + i + '" style="left:' + (p[0] - w / 2) + 'px;top:' + (p[1] - p[2]) + 'px;width:' + w + 'px;height:' + p[2] + 'px">' +
          '<img class="t-base" src="' + src(2, 'cut/base', i + 1) + '" alt="">' +
          '<img class="t-hit" src="' + src(2, 'cut/hit', i + 1) + '" alt=""></div>';
      });
      return s;
    },
    portrait: function () { return '<img class="portrait-crop" src="' + src(2, 'base', 10) + '" alt="">'; },
    apply: function (root, n, isNew) {
      Array.prototype.forEach.call(root.querySelectorAll('.trooper'), function (t) {
        var i = +t.getAttribute('data-t');
        t.classList.toggle('target', i === n);
        t.classList.toggle('down', i < n && !(isNew && i === n - 1));
        t.classList.remove('hurt');
        if (isNew && i === n - 1) {
          // 방금 맞은 병사: 맞은 그림을 밝게 보여 준 뒤 쓰러진 상태로
          void t.offsetWidth;
          t.classList.add('hurt');
          setTimeout(function () { t.classList.remove('hurt'); t.classList.add('down'); }, 900);
        }
      });
    },
    hitPoint: function (n) {
      var p = SQUAD[Math.max(0, Math.min(SQUAD.length - 1, n - 1))];
      return [p[0], p[1] - p[2] / 2];
    }
  };
  var greenbean = sheet(3, true);
  var roastbean = sheet(4, true);

  /* ---------------------------------------------------------
     엔딩: 커피를 마시며 쉬는 나
     --------------------------------------------------------- */
  function ending() {
    return '<svg viewBox="0 0 1280 720" aria-hidden="true">' +
      '<rect width="1280" height="720" fill="#E9D2AE"/>' +
      '<rect y="0" width="1280" height="60" fill="#D9BC92"/>' +
      // 창문 + 바깥의 커피나무
      '<rect x="640" y="90" width="460" height="300" rx="10" fill="#9ED3F0" stroke="#6B4A33" stroke-width="12"/>' +
      '<path d="M870 90 V390 M640 240 H1100" stroke="#6B4A33" stroke-width="10"/>' +
      '<rect x="720" y="250" width="22" height="140" fill="#6B4A33"/><circle cx="731" cy="230" r="60" fill="#5E8C45"/>' +
      '<circle cx="710" cy="214" r="8" fill="#C2452D"/><circle cx="752" cy="240" r="8" fill="#C2452D"/><circle cx="730" cy="190" r="8" fill="#C2452D"/>' +
      '<circle cx="1030" cy="150" r="34" fill="#FFF3B0"/>' +
      // 탁자
      '<rect x="560" y="540" width="640" height="26" rx="8" fill="#8A5A2B" stroke="' + INK + '" stroke-width="4"/>' +
      '<rect x="600" y="566" width="22" height="154" fill="#6B4A33"/><rect x="1140" y="566" width="22" height="154" fill="#6B4A33"/>' +
      // 사람
      '<path d="M760 540 V430 q0 -70 110 -70 q110 0 110 70 V540z" fill="#4F6B3A" stroke="' + INK + '" stroke-width="5"/>' +
      '<circle cx="870" cy="290" r="72" fill="#F2C9A0" stroke="' + INK + '" stroke-width="5"/>' +
      '<path d="M798 284 q0 -86 72 -86 q72 0 72 86 q-20 -44 -72 -44 q-52 0 -72 44z" fill="#4A2C1C" stroke="' + INK + '" stroke-width="5"/>' +
      '<path d="M836 300 q12 -12 24 0 M880 300 q12 -12 24 0" stroke="' + INK + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<circle cx="826" cy="320" r="10" fill="#F09A86" opacity=".7"/><circle cx="914" cy="320" r="10" fill="#F09A86" opacity=".7"/>' +
      '<path d="M856 330 q14 12 28 0" stroke="' + INK + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      // 컵을 든 손
      '<path d="M800 460 q30 40 60 20 M940 460 q-30 40 -60 20" stroke="' + INK + '" stroke-width="5" fill="none"/>' +
      '<path d="M830 420 h80 v50 a30 30 0 0 1 -30 30 h-20 a30 30 0 0 1 -30 -30z" fill="#FFF8EC" stroke="' + INK + '" stroke-width="5"/>' +
      '<path d="M910 432 h12 a16 16 0 0 1 0 32 h-12" stroke="' + INK + '" stroke-width="5" fill="none"/>' +
      '<ellipse cx="870" cy="422" rx="38" ry="7" fill="#3A1F12"/>' +
      '<circle cx="840" cy="478" r="14" fill="#F2C9A0" stroke="' + INK + '" stroke-width="4"/><circle cx="900" cy="478" r="14" fill="#F2C9A0" stroke="' + INK + '" stroke-width="4"/>' +
      '<g class="steam"><path d="M852 412 q-8 -10 0 -20 q8 -10 0 -20" stroke="#B8A089" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M870 408 q-8 -10 0 -20 q8 -10 0 -20" stroke="#B8A089" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M888 412 q-8 -10 0 -20 q8 -10 0 -20" stroke="#B8A089" stroke-width="5" fill="none" stroke-linecap="round"/></g>' +
      // 탁자 위 원두 접시
      '<ellipse cx="1080" cy="534" rx="70" ry="12" fill="#FFF8EC" stroke="' + INK + '" stroke-width="4"/>' +
      '<ellipse cx="1060" cy="524" rx="12" ry="8" fill="#3A1F12"/><ellipse cx="1086" cy="522" rx="12" ry="8" fill="#2A140C"/><ellipse cx="1106" cy="526" rx="12" ry="8" fill="#3A1F12"/>' +
      '</svg>';
  }

  /* 오프닝 진행 아이콘 */
  var ICONS = {
    tree: '<svg viewBox="0 0 48 48"><rect x="21" y="26" width="6" height="16" rx="2" fill="#6B4A33"/><circle cx="24" cy="18" r="13" fill="#5E8C45"/><circle cx="18" cy="15" r="2.6" fill="#C2452D"/><circle cx="29" cy="20" r="2.6" fill="#C2452D"/><circle cx="23" cy="10" r="2.6" fill="#C2452D"/></svg>',
    berries: '<svg viewBox="0 0 48 48"><circle cx="17" cy="27" r="9" fill="#C2452D"/><circle cx="31" cy="27" r="9" fill="#A83A26"/><circle cx="24" cy="17" r="9" fill="#D9573D"/><path d="M24 8c2-4 6-5 9-4" stroke="#5E8C45" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    greenbean: '<svg viewBox="0 0 48 48"><path d="M24 46c-9 0-13-6-10-13 2-5 6-6 6-12 5 3 6 7 5 10 3-1 4-4 4-6 4 4 6 9 5 13-1 5-5 8-10 8z" fill="#E07A3A"/><ellipse cx="24" cy="26" rx="8" ry="11" transform="rotate(25 24 26)" fill="#A9BE6A" stroke="#2A0F06" stroke-width="2"/></svg>',
    roastbean: '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="12" ry="17" transform="rotate(25 24 24)" fill="#3A1F12" stroke="#2A0F06" stroke-width="2"/><path d="M17 12c6 8 9 15 14 22" fill="none" stroke="#8A5A2B" stroke-width="3" stroke-linecap="round"/></svg>',
    cup: '<svg viewBox="0 0 48 48"><path d="M10 18h24v12a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z" fill="#F3E7D3"/><path d="M34 21h3a5 5 0 0 1 0 10h-3" stroke="#F3E7D3" stroke-width="3" fill="none"/><ellipse cx="22" cy="18" rx="12" ry="3" fill="#3A1F12"/><path d="M17 12c0-3 3-3 3-6M24 12c0-3 3-3 3-6" stroke="#CDB89A" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
  };

  /* 메인 화면 카드용 아이콘: 24px 로 그린 뒤 캔버스에서 확대해 픽셀처럼 보이게 한다 */
  var O = ' stroke="#2A1A0E" stroke-width="1.3"';
  var PIXEL_ICONS = {
    tree: '<rect x="10" y="13" width="4" height="9" fill="#8A5A2E"' + O + '/>' +
      '<circle cx="12" cy="9.5" r="7.6" fill="#4E9A3A"' + O + '/><circle cx="9.6" cy="6.8" r="2.4" fill="#7CC55A"/>' +
      '<circle cx="8.6" cy="10.6" r="1.4" fill="#E0402E"/><circle cx="14.8" cy="7.4" r="1.4" fill="#E0402E"/><circle cx="13.6" cy="12.4" r="1.4" fill="#E0402E"/>',
    berries: '<path d="M12 7 Q12 3 15 2" stroke="#3E7B2A" stroke-width="1.6" fill="none"/><path d="M15 2 q4 0 4 3 q-4 1 -4 -3z" fill="#5DAA45"' + O + '/>' +
      '<circle cx="12" cy="10" r="4.6" fill="#D9301C"' + O + '/><circle cx="7.6" cy="16.6" r="4.6" fill="#C8281A"' + O + '/><circle cx="16.4" cy="16.6" r="4.6" fill="#C8281A"' + O + '/>' +
      '<circle cx="10.6" cy="8.6" r="1.2" fill="#FFB0A0"/><circle cx="6.2" cy="15.2" r="1.2" fill="#FFB0A0"/><circle cx="15" cy="15.2" r="1.2" fill="#FFB0A0"/>',
    greenbean: '<defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset=".45" stop-color="#8CC255"/><stop offset=".55" stop-color="#E8892A"/></linearGradient></defs>' +
      '<ellipse cx="12" cy="12.5" rx="6.6" ry="9" transform="rotate(35 12 12.5)" fill="url(#gb)"' + O + '/>' +
      '<path d="M8 7 Q12 12 16 18" stroke="#4E7A2A" stroke-width="1.3" fill="none"/><circle cx="9" cy="9" r="1.4" fill="#C8EE90"/>',
    roastbean: '<ellipse cx="12" cy="12" rx="6.8" ry="9.2" transform="rotate(30 12 12)" fill="#6B3A1A"' + O + '/>' +
      '<path d="M8.4 5.8 Q11 12 15.6 18.2" stroke="#2A1408" stroke-width="1.6" fill="none"/><circle cx="9.4" cy="8" r="1.5" fill="#A8683A"/>',
    cup: '<path d="M8 5 q-1.5 -2 0 -4 M12 5 q-1.5 -2 0 -4" stroke="#9A9088" stroke-width="1.2" fill="none"/>' +
      '<path d="M4 8 h13 v7 a5 5 0 0 1 -5 5 h-3 a5 5 0 0 1 -5 -5z" fill="#F7F2E8"' + O + '/>' +
      '<path d="M17 10 h2 a3 3 0 0 1 0 6 h-2" stroke="#2A1A0E" stroke-width="1.3" fill="#F7F2E8"/>' +
      '<rect x="5" y="9" width="11" height="2" fill="#4A2A14"/>'
  };
  function pixelIconSvg(name) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' + PIXEL_ICONS[name] + '</svg>';
  }
  // 카드 둘레의 넝쿨 장식 (170x170, 카드 바깥으로 10px)
  var VINE = '<svg class="vine" viewBox="0 0 170 170" aria-hidden="true">' +
    '<path d="M6 120 Q14 90 8 64 Q2 36 22 14 Q44 2 70 10 Q96 18 118 8" stroke="#2F5E22" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M164 46 Q156 80 162 110 Q166 140 146 158 Q120 168 96 160" stroke="#2F5E22" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    [[10, 96, -40], [6, 50, 30], [30, 12, -10], [62, 8, 20], [100, 12, -20], [160, 70, 40], [162, 126, -30], [134, 160, 10], [104, 160, -20]].map(function (l) {
      return '<ellipse cx="' + l[0] + '" cy="' + l[1] + '" rx="9" ry="5" transform="rotate(' + l[2] + ' ' + l[0] + ' ' + l[1] + ')" fill="#5DAA45" stroke="#1E3A12" stroke-width="2"/>';
    }).join('') + '</svg>';
  var LOCK = '<svg class="lock" viewBox="0 0 20 22" aria-hidden="true">' +
    '<path d="M5 10 V6 a5 5 0 0 1 10 0 V10" stroke="#2A1A0E" stroke-width="4" fill="none"/><path d="M5 10 V6 a5 5 0 0 1 10 0 V10" stroke="#8A8A80" stroke-width="2" fill="none"/>' +
    '<rect x="2" y="9" width="16" height="12" rx="2" fill="#6E6E66" stroke="#2A1A0E" stroke-width="2"/><rect x="4" y="11" width="12" height="3" fill="#9A9A90"/>' +
    '<rect x="9" y="14" width="2" height="4" fill="#2A1A0E"/></svg>';

  // 나무 액자 패널(가로 w, 세로 h)의 모서리에 두를 넝쿨 장식
  function vinePanel(w, h) {
    var W = w + 24, H = h + 24;
    var leaves = [[10, 40, -50], [22, 16, -20], [52, 10, 15], [86, 12, -10], [W - 70, 10, 20], [W - 22, 40, 50], [W - 12, H - 60, -40],
      [W - 40, H - 14, 10], [W - 90, H - 12, -20], [18, H - 40, 40], [10, H - 80, -30], [W - 14, 70, 30]];
    var s = '<svg class="vine" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<path d="M8 ' + (H * 0.3) + ' Q6 22 30 10 Q60 4 96 14" stroke="#2F5E22" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M' + (W - 96) + ' ' + (H - 12) + ' Q' + (W - 44) + ' ' + (H - 6) + ' ' + (W - 14) + ' ' + (H - 34) + ' Q' + (W - 4) + ' ' + (H * 0.7) + ' ' + (W - 8) + ' ' + (H * 0.62) + '" stroke="#2F5E22" stroke-width="5" fill="none" stroke-linecap="round"/>';
    leaves.forEach(function (l) {
      s += '<ellipse cx="' + l[0] + '" cy="' + l[1] + '" rx="10" ry="5.5" transform="rotate(' + l[2] + ' ' + l[0] + ' ' + l[1] + ')" fill="#5DAA45" stroke="#1E3A12" stroke-width="2"/>';
    });
    return s + '</svg>';
  }
  // 10번 문제용 불꽃 (128x150)
  var FLAME = '<svg class="flame" viewBox="0 0 128 150" aria-hidden="true"><defs>' +
    '<linearGradient id="fl-o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A2A"/><stop offset=".6" stop-color="#D81E10"/><stop offset="1" stop-color="#8A0E08"/></linearGradient>' +
    '<linearGradient id="fl-i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD25A"/><stop offset="1" stop-color="#FF7A2A"/></linearGradient></defs>' +
    '<path d="M64 4 C70 30 100 40 96 72 C112 62 118 84 118 100 C118 130 94 146 64 146 C34 146 10 130 10 100 C10 80 22 64 34 58 C32 74 40 80 46 82 C40 54 52 30 64 4Z" fill="url(#fl-o)" stroke="#4A0A04" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M64 52 C68 70 86 78 84 100 C84 120 74 132 64 132 C52 132 42 120 44 102 C44 90 52 84 56 76 C58 68 60 60 64 52Z" fill="url(#fl-i)"/></svg>';
  var TAB_LOCK = '<svg class="tab-lock" viewBox="0 0 20 22" aria-hidden="true"><path d="M5 10 V6 a5 5 0 0 1 10 0 V10" stroke="#14140F" stroke-width="4" fill="none"/><path d="M5 10 V6 a5 5 0 0 1 10 0 V10" stroke="#9A9A90" stroke-width="2" fill="none"/><rect x="2" y="9" width="16" height="12" rx="2" fill="#6E6E66" stroke="#14140F" stroke-width="2"/><rect x="9" y="14" width="2" height="4" fill="#14140F"/></svg>';

  /* 메인 로고: 7x8 격자 블록 글자 (획 2칸). 그림자 → 진한 외곽선 → 노랑·주황 그라데이션 순서로 겹친다 */
  var GLYPHS = {
    K: ['##...##', '##..##.', '##.##..', '####...', '####...', '##.##..', '##..##.', '##...##'],
    L: ['##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '#######', '#######'],
    O: ['.#####.', '#######', '##...##', '##...##', '##...##', '##...##', '#######', '.#####.'],
    A: ['..###..', '.#####.', '##...##', '##...##', '#######', '#######', '##...##', '##...##'],
    D: ['#####..', '######.', '##..###', '##...##', '##...##', '##..###', '######.', '#####..']
  };
  function logo(text) {
    var C = 12, GAP = 1, OUT = 5, DROP = 8;
    var cells = [];
    text.split('').forEach(function (ch, n) {
      (GLYPHS[ch] || []).forEach(function (row, y) {
        row.split('').forEach(function (v, x) {
          if (v === '#') cells.push([(n * (7 + GAP) + x) * C, y * C]);
        });
      });
    });
    var W = (text.length * (7 + GAP) - GAP) * C, H = 8 * C;
    function rects(pad, dy, fill) {
      return cells.map(function (c) {
        return '<rect x="' + (c[0] - pad + OUT) + '" y="' + (c[1] - pad + OUT + dy) + '" width="' + (C + pad * 2) + '" height="' + (C + pad * 2) + '"' + (fill ? ' fill="' + fill + '"' : '') + '/>';
      }).join('');
    }
    return '<svg viewBox="0 0 ' + (W + OUT * 2) + ' ' + (H + OUT * 2 + DROP) + '" width="' + (W + OUT * 2) + '" height="' + (H + OUT * 2 + DROP) + '" shape-rendering="crispEdges" aria-hidden="true">' +
      '<defs><linearGradient id="logo-fill" gradientUnits="userSpaceOnUse" x1="0" y1="' + OUT + '" x2="0" y2="' + (OUT + H) + '">' +
      '<stop offset="0" stop-color="#FFF27A"/><stop offset=".44" stop-color="#FFD03A"/><stop offset=".5" stop-color="#FFAE2E"/><stop offset="1" stop-color="#F0801C"/></linearGradient></defs>' +
      '<g fill="#2A140A">' + rects(OUT, DROP, '') + rects(OUT, 0, '') + '</g>' +
      '<g fill="url(#logo-fill)">' + rects(0, 0, '') + '</g>' +
      // 윗면 반사광, 아랫면 그늘: 위/아래 칸이 비어 있는 칸에만
      edge(-1, 0, 3, '#FFFBD0', '.7') + edge(1, C - 3, 3, '#B8540E', '.6') + '</svg>';
    function edge(dir, oy, hgt, fill, op) {
      var has = {};
      cells.forEach(function (c) { has[c[0] + ',' + c[1]] = 1; });
      return '<g fill="' + fill + '" opacity="' + op + '">' + cells.filter(function (c) {
        return !has[c[0] + ',' + (c[1] + dir * C)];
      }).map(function (c) {
        return '<rect x="' + (c[0] + OUT) + '" y="' + (c[1] + OUT + oy) + '" width="' + C + '" height="' + hgt + '"/>';
      }).join('') + '</g>';
    }
  }

  window.ART = {
    logo: logo,
    tree: tree, berries: berries, greenbean: greenbean, roastbean: roastbean, ending: ending, icons: ICONS,
    pixelIconSvg: pixelIconSvg, vine: VINE, lock: LOCK, vinePanel: vinePanel, flame: FLAME, tabLock: TAB_LOCK
  };
})();
