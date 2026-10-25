/* =========================================================
   KLOAD 커피 워게임
   흐름: 오프닝 → 1장~4장 전투 (몬스터 HP 10, 정답마다 -1) → 엔딩
   ========================================================= */
(function () {
  'use strict';

  var DATA = window.GAME_DATA;
  var ART = window.ART;
  var MAX = DATA.maxHp;
  var CHS = DATA.chapters;
  var STORE_KEY = 'kload-coffee-v2';

  /* ---------- 상태 저장 ---------- */
  // ch: 현재 장(1~4), dmg: 현재 몬스터가 받은 피해(0~10), ended: 엔딩 도달 여부
  var state = load();
  function fresh() { return { ch: 1, dmg: 0, ended: false }; }
  function load() {
    var s = fresh();
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && raw.ch >= 1 && raw.ch <= CHS.length && raw.dmg >= 0 && raw.dmg <= MAX) {
        s.ch = raw.ch; s.dmg = raw.dmg; s.ended = !!raw.ended;
      }
    } catch (e) { /* 무시 */ }
    return s;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }
  function hasProgress() { return state.ended || state.ch > 1 || state.dmg > 0; }
  function chapter() { return CHS[state.ch - 1]; }
  function problem() { return DATA.problems[state.ch - 1][Math.min(state.dmg, MAX - 1)]; }

  /* ---------- 도우미 ---------- */
  var $ = function (sel) { return document.querySelector(sel); };
  var app = $('#app');
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  async function sha256(text) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /* ---------- 1280x720 화면을 창 크기에 맞춤 ---------- */
  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    app.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  fit();

  /* ---------- 화면 전환 ---------- */
  function go(name) {
    ['title', 'map', 'battle', 'ending'].forEach(function (n) {
      $('#screen-' + n).classList.toggle('is-active', n === name);
    });
    if (name === 'title') renderTitle();
    if (name === 'map') renderMap();
    if (name === 'battle') renderBattle();
    if (name === 'ending') $('#ending-art').innerHTML = ART.ending();
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-close]');
    if (c) { c.closest('.modal').hidden = true; resetQuestFrame(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { $('#modal-quest').hidden = true; resetQuestFrame(); }
  });
  function resetQuestFrame() {
    var f = $('#quest-frame');
    if (f) { f.src = 'about:blank'; f.hidden = true; }
  }

  /* =========================================================
     오프닝
     ========================================================= */
  function renderTitle() {
    var steps = CHS.map(function (c) {
      var st = state.ended || c.id < state.ch ? 'done' : c.id === state.ch ? 'now' : '';
      return { icon: c.art, name: c.id + '장 ' + c.name, sub: st === 'done' ? '클리어' : st === 'now' ? '진행 중' : '잠김', st: st };
    });
    steps.push({ icon: 'cup', name: '엔딩', sub: state.ended ? '도착' : '잠김', st: state.ended ? 'now' : '' });
    $('#journey').innerHTML = steps.map(function (s, i) {
      return (i ? '<li class="arrow" aria-hidden="true">&gt;</li>' : '') +
        '<li><div class="step ' + s.st + '">' + ART.vine +
        '<canvas width="24" height="24" data-icon="' + s.icon + '"></canvas>' +
        '<span>' + s.name + '</span><small class="state-' + (s.st || 'lock') + '">' + s.sub + '</small>' +
        (s.st ? '' : ART.lock) + '</div></li>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#journey canvas'), drawPixelIcon);
    $('#btn-continue').disabled = !hasProgress();
    decorateTitle();
  }
  // SVG 아이콘을 24px 캔버스에 그린다 (CSS 에서 확대 + pixelated)
  function drawPixelIcon(cv) {
    var img = new Image();
    img.onload = function () {
      var ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 24, 24);
      ctx.drawImage(img, 0, 0, 24, 24);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART.pixelIconSvg(cv.getAttribute('data-icon')));
  }
  // 반짝이 가루와 떨어지는 잎 (한 번만 만든다)
  var decorated = false;
  function decorateTitle() {
    if (decorated) return;
    decorated = true;
    $('#logo').innerHTML = ART.logo('KLOAD');
    var sp = '';
    for (var i = 0; i < 26; i++) {
      sp += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:' +
        (Math.random() * 2).toFixed(2) + 's;animation-duration:' + (1.4 + Math.random() * 1.6).toFixed(2) + 's"></i>';
    }
    $('#sparkles').innerHTML = sp;
    var lv = '';
    for (var j = 0; j < 12; j++) {
      lv += '<i style="left:' + (Math.random() * 96).toFixed(1) + '%;animation-delay:-' + (Math.random() * 12).toFixed(1) + 's;animation-duration:' +
        (9 + Math.random() * 7).toFixed(1) + 's"></i>';
    }
    $('#leaves').innerHTML = lv;
  }
  $('#btn-start').addEventListener('click', function () {
    if (hasProgress() && !confirm('진행 기록을 지우고 처음부터 시작할까요?')) return;
    state = fresh();
    save();
    go('battle');
  });
  // 이어하기: 저장된 체력에서 바로 전투를 이어 간다 (엔딩까지 끝냈으면 엔딩)
  $('#btn-continue').addEventListener('click', function () {
    go(state.ended ? 'ending' : 'battle');
  });

  /* =========================================================
     장 지도 (세이브 포인트) — 전투 화면의 '지도' 버튼으로만 연다
     - 노드를 누르면 옆에 안내 상자가 뜬다.
     - 뚫은 문제(초록): 문제 다시 보기. 지금 풀 문제(강조): 이어서 전투.
     ========================================================= */
  // 노드 중심 좌표 (1280x720 기준, 지도 시안에서 환산)
  var NODE_POS = [
    [152, 620], [341, 548], [560, 595], [641, 417], [560, 340],
    [664, 253], [795, 286], [901, 271], [950, 170], [1094, 170]
  ];
  var mapCh = 1;

  // 노드를 지나는 부드러운 곡선 (Catmull-Rom → 베지어)
  function smoothPath(pts) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ' C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ',' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ',' + p2[0] + ' ' + p2[1];
    }
    return d;
  }

  // 장 c 의 문제 no 상태: done / now / lock
  function nodeState(c, no) {
    if (state.ended || c < state.ch) return 'done';
    if (c > state.ch) return 'lock';
    if (no <= state.dmg) return 'done';
    return no === state.dmg + 1 ? 'now' : 'lock';
  }

  function renderMap() {
    if (mapCh > state.ch && !state.ended) mapCh = state.ch;
    var c = CHS[mapCh - 1];
    $('#chapter-tabs').innerHTML = CHS.map(function (t) {
      var open = state.ended || t.id <= state.ch;
      var cls = (t.id === mapCh ? 'active' : '') + (open && (state.ended || t.id < state.ch) ? ' done' : '');
      return '<button type="button" data-ch="' + t.id + '" class="' + cls + '"' + (open ? '' : ' disabled') + '>' +
        t.id + '장 ' + t.name + (open ? '' : ' · 잠김' + ART.tabLock) + '</button>';
    }).join('');
    $('#map-title').textContent = c.id + '장 ' + c.name;
    $('#map-sub').textContent = c.goal;

    var cur = 0;
    var doneCount = 0;
    $('#map-nodes').innerHTML = DATA.problems[mapCh - 1].map(function (p, i) {
      var st = nodeState(mapCh, p.no);
      if (st === 'now') cur = p.no;
      if (st === 'done') doneCount++;
      var boss = p.no === MAX;
      var cls = 'node ' + (st === 'lock' ? '' : st) + (boss ? ' boss' : '');
      var inner = boss ? ART.flame + '<span class="num">' + p.no + '</span><small>마지막 문제</small>' : p.no;
      return '<button type="button" class="' + cls + '" data-no="' + p.no + '"' + (st === 'lock' ? ' disabled' : '') +
        ' style="left:' + NODE_POS[i][0] + 'px;top:' + (boss ? NODE_POS[i][1] + 8 : NODE_POS[i][1]) + 'px" aria-label="' + p.no + '번 ' +
        (st === 'done' ? '뚫은 문제' : st === 'now' ? '지금 풀 문제' : '잠김') + '">' + inner + '</button>';
    }).join('');

    // 길 (흙길, 가장자리, 지나온 곳)
    var d = smoothPath(NODE_POS);
    ['#path-shadow', '#path-bg', '#path-edge', '#path-done'].forEach(function (id) { $(id).setAttribute('d', d); });
    var bg = $('#path-bg');
    var total = bg.getTotalLength();
    var reach = cur || (doneCount ? MAX : 0);
    var len = reach > 1 ? lengthAt(bg, NODE_POS[reach - 1], total) : 0;
    $('#path-done').style.strokeDasharray = len + ' ' + (total + 20);

    // 범례 장식
    var legend = $('#map-legend');
    var oldVine = legend.querySelector('.vine');
    if (oldVine) oldVine.remove();
    legend.insertAdjacentHTML('beforeend', ART.vinePanel(318, 168));

    // 세이브 포인트 안내는 노드를 눌렀을 때만 띄운다 (엔딩까지 끝냈으면 마지막 문제에서 엔딩 보기를 띄움)
    hideTip();
    if (state.ended) showTip(MAX);
    $('#map-progress').textContent = '진행 ' + doneCount + ' / ' + MAX;
  }

  // 노드 옆 안내 상자: 지금 풀 문제는 이어서 전투, 뚫은 문제는 문제 다시 보기
  var tipNo = 0;
  function showTip(no) {
    var c = CHS[mapCh - 1];
    var tip = $('#map-tip');
    if (nodeState(mapCh, no) === 'now') {
      tip.innerHTML = '<span>세이브 포인트 · 지금 위치</span><strong>' + c.id + '장 ' + no + '번 문제</strong>' +
        '<em>몬스터 HP ' + (MAX - state.dmg) + '/' + MAX + '에서 이어서 싸워요</em>' +
        '<button type="button" class="game-btn game-btn-gold" data-enter>이어서 전투</button>';
    } else {
      tip.innerHTML = '<span>세이브 포인트</span><strong>' + c.id + '장 ' + no + '번 문제</strong>' +
        '<em>이미 뚫은 문제예요</em>' +
        '<button type="button" class="game-btn game-btn-tan" data-quest="' + no + '">문제 보기</button>' +
        (state.ended ? '<button type="button" class="game-btn game-btn-gold" data-ending>엔딩 보기</button>' : '');
    }
    tip.hidden = false;
    var spot = tipSpot(no);
    tip.style.left = spot[0] + 'px';
    tip.style.top = spot[1] + 'px';
    tip.insertAdjacentHTML('beforeend', ART.vinePanel(290, tip.offsetHeight || 170));
    tipNo = no;
    markNode(no);
  }
  function hideTip() {
    $('#map-tip').hidden = true;
    tipNo = 0;
    markNode(0);
  }
  function markNode(no) {
    Array.prototype.forEach.call(document.querySelectorAll('#map-nodes .node'), function (n) {
      n.classList.toggle('picked', +n.getAttribute('data-no') === no);
    });
  }

  // 안내 상자(290x170) 위치: 화면 안에 있고 다른 노드와 범례를 가리지 않는 첫 후보
  function tipSpot(no) {
    var x = NODE_POS[no - 1][0], y = NODE_POS[no - 1][1];
    var W = 290, H = 175, PAD = 42;
    var cands = [[x + 62, y - 50], [x + 62, y - 110], [x - 352, y - 50], [x + 62, y + 10], [x - 352, y - 110], [x - 145, y - 250], [x - 145, y + 70],
      [760, 430], [760, 330], [430, 140]]; // 노드가 몰린 곳은 오른쪽 빈 공간에 둔다
    for (var i = 0; i < cands.length; i++) {
      var l = cands[i][0], t = cands[i][1];
      if (l < 380 && t < 380) continue; // 범례 영역
      if (l < 10 || t < 70 || l + W > 1270 || t + H > 712) continue;
      var hit = NODE_POS.some(function (p) {
        return p[0] > l - PAD && p[0] < l + W + PAD && p[1] > t - PAD && p[1] < t + H + PAD;
      });
      if (!hit) return cands[i];
    }
    return cands[0];
  }
  // 경로 위에서 노드와 가장 가까운 지점까지의 길이
  function lengthAt(path, pt, total) {
    var best = 0, bestD = Infinity;
    for (var l = 0; l <= total; l += 4) {
      var q = path.getPointAtLength(l);
      var dd = (q.x - pt[0]) * (q.x - pt[0]) + (q.y - pt[1]) * (q.y - pt[1]);
      if (dd < bestD) { bestD = dd; best = l; }
    }
    return best;
  }
  $('#chapter-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-ch]');
    if (!b || b.disabled) return;
    mapCh = +b.getAttribute('data-ch');
    renderMap();
  });
  $('#map-nodes').addEventListener('click', function (e) {
    var n = e.target.closest('.node');
    if (!n || n.disabled) return;
    var no = +n.getAttribute('data-no');
    if (tipNo === no) hideTip();
    else showTip(no);
  });
  $('#map-tip').addEventListener('click', function (e) {
    var q = e.target.closest('[data-quest]');
    if (q) openQuest(mapCh, +q.getAttribute('data-quest'), true);
    if (e.target.closest('[data-enter]')) go('battle');
    if (e.target.closest('[data-ending]')) go('ending');
  });
  // 노드와 안내 상자 바깥을 누르면 안내 상자를 닫는다
  $('#screen-map').addEventListener('click', function (e) {
    if (!e.target.closest('.node, #map-tip, .map-top')) hideTip();
  });
  // 지도는 전투에서 열기 때문에 ← 는 전투로 돌아간다 (엔딩까지 끝냈으면 엔딩)
  $('#btn-map-back').addEventListener('click', function () { go(state.ended ? 'ending' : 'battle'); });
  $('#btn-map-reset').addEventListener('click', function () {
    if (!confirm('진행 기록을 지우고 1장 1번부터 다시 시작할까요?')) return;
    state = fresh();
    save();
    go('battle');
  });

  /* =========================================================
     전투
     ========================================================= */
  var busy = false;
  var dialogTimer = 0;

  function renderBattle() {
    var c = chapter();
    var art = $('#scene-art');
    art.className = 'scene-art';
    art.innerHTML = ART[c.art].scene();
    ART[c.art].apply(art, state.dmg, false);
    art.classList.toggle('defeated', state.dmg >= MAX);
    $('#hp-portrait').innerHTML = ART[c.art].portrait();
    $('#hp-name').textContent = c.monster;
    $('#hp-lv').textContent = c.id;
    renderSteps();
    paintHp();
    if (state.dmg === 0) say(c.intro, 'good', 2000);
    else showPrompt();
    setInput(true);
  }

  function renderSteps() {
    $('#chapter-steps').innerHTML = CHS.map(function (c, i) {
      var cls = c.id < state.ch ? 'done' : c.id === state.ch ? 'now' : '';
      return (i ? '<li class="sep" aria-hidden="true">›</li>' : '') + '<li class="' + cls + '">' + c.id + ' ' + c.name + '</li>';
    }).join('');
  }

  function paintHp() {
    var hp = MAX - state.dmg;
    var fill = $('#hp-fill');
    fill.style.width = (hp / MAX * 100) + '%';
    fill.classList.toggle('low', hp > 0 && hp <= 3);
    $('#hp-text').textContent = 'HP: ' + hp + '/' + MAX;
    $('#hp-sub').textContent = '체력: ' + hp + '/' + MAX;
  }

  // 대사 상자: 현재 문제 문구
  function showPrompt() {
    clearTimeout(dialogTimer);
    var p = problem();
    var text = p.title || (chapter().id + '장 ' + p.no + '번 문제가 여기에 표시됩니다.');
    var box = $('#dialog-text');
    box.className = 'dialog-text';
    box.innerHTML = '<span class="tag">[문제]</span> ' + esc(text);
  }
  // 대사 상자: 전투 안내 문구 (잠시 후 문제 문구로 돌아감)
  function say(text, kind, ms) {
    clearTimeout(dialogTimer);
    var box = $('#dialog-text');
    box.className = 'dialog-text' + (kind ? ' ' + kind : '');
    box.textContent = text;
    if (ms) dialogTimer = setTimeout(showPrompt, ms);
  }

  function setInput(on) {
    var input = $('#flag-input');
    input.disabled = !on;
    $('#flag-form button[type="submit"]').disabled = !on;
    if (on) { input.value = ''; setTimeout(function () { input.focus(); }, 30); }
  }

  /* ---------- 문제 보기 ---------- */
  // 지도의 뚫은 문제(solved)와 전투 중 문제에서 함께 쓴다
  function openQuest(ch, no, solved) {
    var c = CHS[ch - 1];
    var p = DATA.problems[ch - 1][no - 1];
    $('#quest-eyebrow').textContent = c.id + '장 ' + c.name + ' · 문제 ' + p.no + ' / ' + MAX + (solved ? ' · 해결 완료' : '');
    $('#quest-title').textContent = p.title || '문제 준비 중';
    $('#quest-desc').innerHTML = (p.desc ? esc(p.desc) : '아직 문제 내용이 정해지지 않았습니다.') +
      (solved ? '<br>이미 뚫은 세이브 포인트입니다.' : p.flagHash ? '' : '<br>테스트 플래그 <code>test</code>를 입력하면 몬스터를 공격할 수 있습니다.');
    // http(s) 주소만 허용한다
    var frame = $('#quest-frame');
    var ok = typeof p.url === 'string' && /^https?:\/\//i.test(p.url);
    frame.hidden = !ok;
    frame.src = ok ? p.url : 'about:blank';
    $('#quest-box').classList.toggle('wide', ok);
    $('#modal-quest').hidden = false;
  }
  $('#btn-quest').addEventListener('click', function () {
    openQuest(state.ch, problem().no, false);
  });

  /* ---------- 지도로 / 메인으로 ---------- */
  $('#btn-to-map').addEventListener('click', function () {
    if (busy) return;
    mapCh = state.ch;
    go('map');
  });
  $('#btn-to-title').addEventListener('click', function () {
    if (busy) return;
    go('title');
  });

  /* ---------- 플래그 제출 ---------- */
  $('#flag-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (busy || state.dmg >= MAX) return;
    var flag = $('#flag-input').value.trim();
    if (!flag) { say('FLAG를 입력하세요.', 'bad', 1400); return; }
    if (!window.crypto || !crypto.subtle) { say('이 브라우저에서는 플래그를 확인할 수 없습니다.', 'bad'); return; }
    busy = true;
    setInput(false);
    var p = problem();
    var ok = (await sha256(flag)) === (p.flagHash || DATA.testFlagHash);
    if (ok) await attack();
    else await counter();
    busy = false;
  });

  async function attack() {
    var c = chapter();
    var art = $('#scene-art');
    var fx = $('#fx');
    state.dmg += 1;
    save();
    var pt = ART[c.art].hitPoint(state.dmg);

    // 베기 + 흰 섬광 + 흔들림
    restart($('#flash'), 'white');
    [[-28, 0], [24, 0.12]].forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'slash';
      el.style.left = pt[0] + 'px';
      el.style.top = pt[1] + 'px';
      el.style.transform = 'rotate(' + s[0] + 'deg)';
      el.style.animationDelay = s[1] + 's';
      fx.appendChild(el);
      setTimeout(function () { el.remove(); }, 800);
    });
    restart(art, 'hit');
    floatText('-1', pt, '');
    restart($('#hp-heart'), 'beat');

    await wait(200);
    ART[c.art].apply(art, state.dmg, true);
    paintHp();

    if (state.dmg < MAX) {
      say('공격 성공! ' + c.monster + '의 HP가 1 줄었다. ' + c.hitLine, 'good', 1800);
      await wait(700);
      setInput(true);
      return;
    }

    // 몬스터 쓰러짐
    art.classList.add('defeated');
    say(c.clearLine, 'good');
    await wait(2000);
    if (state.ch < CHS.length) {
      state.ch += 1;
      state.dmg = 0;
      save();
      mapCh = state.ch;
      await chapterTransition('CHAPTER ' + state.ch, chapter().name, chapter().intro, function () { go('battle'); });
    } else {
      state.ended = true;
      save();
      await chapterTransition('ENDING', '커피 한 잔', '드디어 커피가 완성됐다!', function () { go('ending'); });
    }
  }

  async function counter() {
    var c = chapter();
    var pt = ART[c.art].hitPoint(state.dmg + 1);
    restart($('#flash'), 'red');
    restart($('#scene-art'), 'counter');
    restart($('#flag-form'), 'shake');
    floatText('MISS', pt, 'miss');
    say('FLAG가 틀렸다! ' + c.monster + '의 반격!', 'bad', 1800);
    await wait(500);
    setInput(true);
  }

  function floatText(text, pt, cls) {
    var el = document.createElement('div');
    el.className = 'dmg' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.style.left = pt[0] + 'px';
    el.style.top = (pt[1] - 120) + 'px';
    $('#fx').appendChild(el);
    setTimeout(function () { el.remove(); }, 1000);
  }

  /* ---------- 장 전환: 새 장이 화면을 덮어쓰듯 넘어감 ---------- */
  async function chapterTransition(eyebrow, title, sub, swap) {
    var tr = $('#transition');
    $('#tr-eyebrow').textContent = eyebrow;
    $('#tr-title').textContent = title;
    $('#tr-sub').textContent = sub;
    tr.className = 'transition in';
    await wait(650);
    swap();
    await wait(1300);
    tr.className = 'transition out';
    await wait(600);
    tr.className = 'transition';
  }

  /* ---------- 엔딩 ---------- */
  $('#btn-again').addEventListener('click', function () {
    state = fresh();
    save();
    go('title');
  });

  /* =========================================================
     테스트 패널 (배포 전에 지울 것)
     - 주소에 ?ch=2 또는 ?ch=2&no=3 을 붙이면 그 장/문제로 바로 전투 시작
     - 화면 왼쪽 아래 작은 패널에서 장·문제를 눌러 이동
     ========================================================= */
  function jumpTo(ch, no) {
    if (!(ch >= 1 && ch <= CHS.length)) return false;
    var dmg = Math.min(Math.max((no || 1) - 1, 0), MAX - 1);
    state = { ch: ch, dmg: dmg, ended: false };
    save();
    mapCh = ch;
    go('battle');
    return true;
  }
  function buildDevPanel() {
    var el = document.createElement('div');
    el.id = 'dev-panel';
    var html = '<button type="button" class="dev-toggle">TEST ▾</button><div class="dev-body">';
    CHS.forEach(function (c) {
      html += '<div class="dev-row"><b>' + c.id + '장 ' + c.name + '</b>';
      for (var n = 1; n <= MAX; n++) html += '<button type="button" data-ch="' + c.id + '" data-no="' + n + '">' + n + '</button>';
      html += '</div>';
    });
    html += '<div class="dev-row"><button type="button" data-home>메인</button><button type="button" data-reset>기록 초기화</button></div></div>';
    el.innerHTML = html;
    document.body.appendChild(el);
    el.querySelector('.dev-toggle').addEventListener('click', function () { el.classList.toggle('open'); });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-ch]');
      if (b) return jumpTo(+b.getAttribute('data-ch'), +b.getAttribute('data-no'));
      if (e.target.closest('[data-home]')) return go('title');
      if (e.target.closest('[data-reset]')) { state = fresh(); save(); go('title'); }
    });
  }

  /* ---------- 시작 ---------- */
  buildDevPanel();
  var params = new URLSearchParams(location.search);
  var ch = +params.get('ch');
  if (ch >= 1 && ch <= CHS.length) {
    history.replaceState(null, '', location.pathname);
    jumpTo(ch, +params.get('no'));
  } else {
    go('title');
  }
})();
