/*
 * 2장 (XSS) 라우터
 *   GET  /ch2/:no/play    문제 페이지 (게임의 문제보기 창에 바로 뜸). 위쪽 안내 띠 + 카페 화면
 *   POST /ch2/:no/check   확인 요청 (문제 페이지의 감지 스크립트가 자동으로 보냄)
 *                         서버 봇이 같은 주소를 직접 열어 알림창이 뜨면 플래그를 돌려준다
 */
const express = require('express');
const path = require('path');
const config = require('../config');
const bot = require('../bot');
const problems = require('./problems');
const { page, esc } = require('./view');

const router = express.Router();
router.use('/static', express.static(path.join(__dirname, 'public')));
router.use(express.json({ limit: '4kb' }));
router.use(express.urlencoded({ extended: false, limit: '8kb' }));

// 간단한 쿠키 읽기/쓰기 (참가자별 저장 공간 구분용)
function readCookie(req, name) {
  const m = String(req.headers.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function randomId() { return require('crypto').randomBytes(8).toString('hex'); }

function find(req, res, next) {
  const p = problems.find(x => String(x.no) === req.params.no);
  if (!p) return res.status(404).send('없는 문제입니다.');
  req.problem = p;
  next();
}

// /ch2/1, /ch2/1/ → 문제 페이지로
router.get('/:no', (req, res) => res.redirect(req.baseUrl + '/' + encodeURIComponent(req.params.no) + '/play'));

/* ---------- 확인 요청 ---------- */
const pending = new Set(); // 같은 접속자가 확인 요청을 겹쳐 보내지 못하게
const basketCodes = new Set(); // 7번: 지금 봇이 들고 있는 보관 코드 (확인이 끝나면 지워서 재사용 불가)

router.post('/:no/check', find, async (req, res) => {
  const p = req.problem;
  const url = String((req.body && req.body.url) || '');
  const prefix = config.origin + '/ch2/' + p.no + '/play';
  if (String(req.get('user-agent')).includes(bot.BOT_MARK)) return res.status(403).json({ ok: false, message: '봇은 확인 요청을 보낼 수 없습니다.' });
  if (!p.ready) return res.json({ ok: false, message: '아직 준비 중인 문제입니다.' });
  if (p.no === 5) return res.json({ ok: false, message: '알림창은 떴지만, 이 문제는 명예 관리인 화면에서 떠야 합니다. "명예 관리인에게 확인 요청"을 눌러 주세요.' });
  if (!(url === prefix || ['?', '#', '/'].some(c => url.startsWith(prefix + c)))) {
    return res.json({ ok: false, message: '이 문제의 페이지 주소만 확인할 수 있습니다.' });
  }
  if (pending.has(req.ip)) return res.json({ ok: false, message: '이전 확인이 아직 진행 중입니다. 잠시 뒤 다시 시도해 주세요.' });
  pending.add(req.ip);
  let basketCode = '';
  try {
    // 6번: 봇은 열쇠 번호가 든 쿠키를 들고 연다 (참가자 브라우저에는 미지급 표시만 있음)
    // 7번: 확인 요청마다 보관 코드를 새로 만들고, 봇만 HttpOnly 쿠키로 들고 간다
    let opts = p.no === 6 ? { answer: BENCH_KEY, cookies: [{ name: 'bench_key', value: BENCH_KEY }] } : { answer: p.answer };
    if (p.no === 7) {
      basketCode = 'BASKET-' + randomId().slice(0, 8);
      basketCodes.add(basketCode);
      opts = { answer: basketCode, cookies: [{ name: 'basket_pass', value: basketCode, httpOnly: true }] };
    }
    const fired = await bot.check(url, opts);
    res.json(fired
      ? { ok: true, flag: config.flags.ch2[p.no - 1] }
      : { ok: false, message: '서버가 같은 주소를 열어 봤지만 목표한 알림창이 뜨지 않았습니다. 주소만으로 다시 재현되는지 확인해 보세요.' });
  } catch (e) {
    console.error('[bot]', e.message);
    res.json({ ok: false, message: '확인 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.' });
  } finally {
    pending.delete(req.ip);
    if (p.no === 7) basketCodes.delete(basketCode);
  }
});

/* ---------- 문제 페이지 ---------- */
function title(p) { return '<h1>열매 군단 선별장 <small>' + esc(p.step) + ' · ' + esc(p.feature) + '</small></h1>'; }

// 1번 반입: 반입 기록 검색. 결과 없음 문구에 검색어를 그대로 출력한다 (의도된 취약점)
const INTAKE = [
  ['예가체프 농장', '320kg', '10/21'], ['시다모 농장', '280kg', '10/21'], ['안티구아 농장', '410kg', '10/22'],
  ['우일라 농장', '195kg', '10/23'], ['수프리모 농장', '360kg', '10/23'], ['코나 농장', '150kg', '10/24']
];
router.get('/1/play', (req, res) => {
  const p = problems[0];
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const hits = q ? INTAKE.filter(r => r[0].includes(q)) : INTAKE;
  let body = title(p) +
    '<form class="search"><input name="q" value="' + esc(q) + '" placeholder="농장 이름"><button>검색</button></form>';
  if (q && !hits.length) body += '<p class="empty">' + q + ' 반입 기록이 없습니다.</p>';
  else body += '<table class="rows"><tr><th>농장</th><th>열매 무게</th><th>반입일</th></tr>' +
    hits.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>').join('') + '</table>';
  res.send(page(p, body));
});

// 2번 등급 조회: 주소의 등급 코드를 "찾을 수 없습니다" 안내에 그대로 출력한다 (의도된 취약점)
// 입력칸이 없고 주소창에서 /ch2/2/play/코드 의 코드 부분을 직접 바꿔서 푼다. 게임 창 안에서는 새 창으로 풀도록만 안내.
const GRADES = { AA: ['최상급 (잘 익은 빨간 열매)', '합격'], A: ['상급', '합격'], B: ['보통 (덜 익은 열매 섞임)', '재선별'], C: ['하급 (벌레 먹음)', '불합격'] };
const GRADE_TIP = '<p class="tip" hidden>게임 창 안에서는 주소창을 쓸 수 없습니다. 위쪽 <b>새 창에서 보기</b>로 열어 주세요.' +
  '<script>if(window.top!==window.self){var t=document.currentScript.parentNode;t.hidden=false;}</script></p>';
router.get('/2/play', (req, res) => {
  const p = problems[1];
  const body = title(p) + GRADE_TIP + '<p>등급 코드를 눌러 상태를 확인하세요.</p>' +
    '<ul class="menu">' + Object.keys(GRADES).map(k => '<li><a href="/ch2/2/play/' + k + '">' + k + ' 등급</a></li>').join('') + '</ul>';
  res.send(page(p, body));
});
router.get('/2/play/:grade', (req, res) => {
  const p = problems[1];
  const g = GRADES[req.params.grade];
  let body = title(p) + GRADE_TIP;
  if (g) body += '<table class="rows"><tr><th>등급</th><th>설명</th><th>판정</th></tr><tr><td>' + esc(req.params.grade) + '</td><td>' + g[0] + '</td><td>' + g[1] + '</td></tr></table>';
  else body += '<p class="empty">' + req.params.grade + ' 등급을 찾을 수 없습니다.</p>';
  body += '<p><a href="/ch2/2/play">등급 목록으로</a></p>';
  res.send(page(p, body));
});

// 3번 색 선별: 선별 메모. 메모를 입력칸 value="" 안에 다시 넣는데 본문의 <,> 만 처리하고 따옴표는 처리하지 않는다 (의도된 취약점)
router.get('/3/play', (req, res) => {
  const p = problems[2];
  const memo = typeof req.query.memo === 'string' ? req.query.memo : '';
  // 의도된 취약점: escAttr 는 <,> 만 바꾸고 따옴표(",')는 그대로 둔다. 그래서 value="..." 의 따옴표를 벗어날 수 있다.
  const vulnValue = String(memo).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = title(p) +
    '<p>이번 열매의 색과 상태를 메모로 남기세요. 저장한 메모는 수정할 수 있도록 입력칸에 다시 채워집니다.</p>' +
    '<form class="search"><input name="memo" value="' + vulnValue + '" placeholder="예: 빨갛게 잘 익음"><button>저장</button></form>' +
    (memo ? '<p class="saved">메모를 저장했습니다.</p>' : '');
  res.send(page(p, body));
});

// 4번 불량 신고 (저장형, 관리자 봇):
//  - 신고는 /play 폼에서 남기고, 참가자의 "내 신고 목록"(/list/:id)에는 글자로만 보인다 (실행되지 않음).
//  - "검열관에게 검토 요청"을 누르면 서버의 관리자 봇이 관리자용 목록(/admin/:id)을 연다.
//  - 관리자용 목록은 서버만 아는 키(ADMIN_KEY)로만 열 수 있고, 신고 내용을 그대로 출력한다 (의도된 취약점).
//  - 참가자마다 board 쿠키로 자기 신고 목록을 따로 쓴다.
const boards = new Map(); // boardId -> [{text, at}]
function getBoard(id) { if (!boards.has(id)) boards.set(id, []); return boards.get(id); }
const ADMIN_KEY = require('crypto').randomBytes(16).toString('hex');
const BOARD_ID = /^[0-9a-f]{16}$/;

function ensureBoard(req, res) {
  let id = readCookie(req, 'board4');
  if (!BOARD_ID.test(id)) { id = randomId(); res.setHeader('Set-Cookie', 'board4=' + id + '; Path=/ch2/4; SameSite=Lax'); }
  return id;
}

// 검토 요청 버튼 (신고 폼 페이지와 내 목록 페이지에 같이 둔다)
function reviewUI(no, label, hint, wait) { return '<div class="review"><button type="button" id="review-btn">' + label + '</button> ' +
  '<span class="hint">' + hint + '</span></div>' +
  '<script>(function(){var b=document.getElementById("review-btn");b.onclick=function(){' +
  'var s=document.getElementById("xss-status");s.className="status wait";s.textContent="' + wait + '";b.disabled=true;' +
  'fetch("/ch2/' + no + '/review",{method:"POST"}).then(function(r){return r.json()}).then(function(r){' +
  'b.disabled=false;if(r.ok){s.className="status ok";s.textContent="관리자 화면에서 알림창 확인! 플래그: "+r.flag;}' +
  'else{s.className="status bad";s.textContent=r.message;}}).catch(function(){b.disabled=false;s.className="status bad";s.textContent="서버에 연결하지 못했습니다.";});};})();</script>'; }
const REVIEW_UI = reviewUI(4, '검열관에게 검토 요청', '남긴 신고를 열매 군단 검열관이 열어 봅니다.', '검열관이 신고 목록을 여는 중...');

router.get('/4/play', (req, res) => {
  const p = problems[3];
  const id = ensureBoard(req, res);
  const body = title(p) +
    '<p>불량 열매를 발견하면 신고하세요. 신고한 내용은 <b>내 신고 목록</b>에 쌓이고, 검열관이 검토합니다.</p>' +
    '<form class="search" method="post" action="/ch2/4/report"><input name="text" placeholder="예: B3 바구니에 벌레 먹은 열매" autocomplete="off"><button>신고</button></form>' +
    '<p><a href="/ch2/4/list/' + id + '">내 신고 목록 보기 →</a></p>' + REVIEW_UI;
  res.send(page(p, body));
});

router.post('/4/report', (req, res) => {
  const id = ensureBoard(req, res);
  // 가장 뻔한 수(<script> 태그)는 저장할 때 걸러낸다. 대소문자는 가린다. 다른 태그는 통과한다.
  const text = String((req.body && req.body.text) || '').slice(0, 500).replace(/<script/gi, '').replace(/<\/script>/gi, '');
  const list = getBoard(id);
  if (text) list.push({ text, at: new Date().toLocaleString('ko-KR') });
  if (list.length > 30) list.splice(0, list.length - 30);
  res.redirect('/ch2/4/list/' + id);
});

// 참가자용 내 신고 목록: 안전하게 글자로만 보여 준다
router.get('/4/list/:id', (req, res) => {
  const p = problems[3];
  const id = req.params.id;
  const list = BOARD_ID.test(id) ? getBoard(id) : [];
  const rows = list.length
    ? list.map(r => '<li><span class="when">' + esc(r.at) + '</span> ' + esc(r.text) + '</li>').join('')
    : '<li class="empty-row">아직 신고가 없습니다.</li>';
  const body = title(p) + '<p>내 신고 목록</p><ul class="reports">' + rows + '</ul>' +
    '<p><a href="/ch2/4/play">← 신고하러 가기</a></p>' + REVIEW_UI;
  res.send(page(p, body));
});

// 관리자용 목록: 서버 봇만 키로 열 수 있다. 저장된 신고 내용을 인코딩 없이 그대로 출력한다 (의도된 취약점)
router.get('/4/admin/:id', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send('검열관만 열 수 있습니다.');
  const p = problems[3];
  const id = req.params.id;
  const list = BOARD_ID.test(id) ? getBoard(id) : [];
  const rows = list.length
    ? list.map(r => '<li><span class="when">' + r.at + '</span> ' + r.text + '</li>').join('')
    : '<li class="empty-row">접수된 신고가 없습니다.</li>';
  res.send(page(p, '<h1>열매 군단 선별장 <small>검열관 화면</small></h1><ul class="reports">' + rows + '</ul>'));
});

// 검토 요청: 관리자 봇이 내 신고 목록의 관리자 화면을 열어 알림창을 확인한다
const reviewing = new Set();
router.post('/4/review', async (req, res) => {
  const p = problems[3];
  if (String(req.get('user-agent')).includes(bot.BOT_MARK)) return res.status(403).json({ ok: false, message: '봇은 요청할 수 없습니다.' });
  const id = readCookie(req, 'board4');
  if (!BOARD_ID.test(id) || !getBoard(id).length) return res.json({ ok: false, message: '먼저 신고를 남겨 주세요.' });
  if (reviewing.has(id) || pending.has(req.ip)) return res.json({ ok: false, message: '이전 검토가 아직 진행 중입니다. 잠시 뒤 다시 시도해 주세요.' });
  reviewing.add(id); pending.add(req.ip);
  try {
    const fired = await bot.check(config.origin + '/ch2/4/admin/' + id + '?key=' + ADMIN_KEY, { answer: p.answer });
    res.json(fired
      ? { ok: true, flag: config.flags.ch2[3] }
      : { ok: false, message: '검열관이 신고를 열어 봤지만 목표한 알림창이 뜨지 않았습니다. 신고 내용을 다시 확인해 보세요.' });
  } catch (e) {
    console.error('[bot]', e.message);
    res.json({ ok: false, message: '검토 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.' });
  } finally {
    reviewing.delete(id); pending.delete(req.ip);
  }
});

// 5번 선별왕 (2차 출력 + 관리자 비밀 읽기):
//  - 이름은 /play 에서 등록하고, 내 정보 화면에는 안전하게 글자로만 보인다.
//  - 명예의 전당(/play/hall)은 등록된 이름을 인코딩 없이 그대로 출력한다 (의도된 취약점). 여기에는 인증 코드가 없다.
//  - 명예 관리인 화면(/admin/:id?key=)도 같은 방식으로 이름을 출력하고, 거기에만 참가자별 선별왕 인증 코드가 숨어 있다.
//  - "확인 요청"을 누르면 봇이 관리인 화면을 열고, 그 코드가 알림창에 뜨는지 본다.
const hall = new Map(); // id -> {name, code}
const KINGS = ['예가체프 반장', '시다모 반장', '안티구아 반장'];
const ADMIN_KEY5 = require('crypto').randomBytes(16).toString('hex');
const REVIEW5 = reviewUI(5, '명예 관리인에게 확인 요청', '등록한 이름이 올라간 명단을 명예 관리인이 열어 봅니다.', '명예 관리인이 명단을 여는 중...');
function ensureHall(req, res) {
  let id = readCookie(req, 'board5');
  if (!BOARD_ID.test(id)) { id = randomId(); res.setHeader('Set-Cookie', 'board5=' + id + '; Path=/ch2/5; SameSite=Lax'); }
  return id;
}
function hallList(me) {
  const rows = KINGS.map((k, i) => '<li>' + (i + 1) + '위 ' + esc(k) + '</li>');
  if (me) rows.push('<li>후보 ' + me.name + '</li>');
  return '<ul class="reports">' + rows.join('') + '</ul>';
}
router.get('/5/play', (req, res) => {
  const p = problems[4];
  const id = ensureHall(req, res);
  const me = hall.get(id);
  const body = title(p) +
    '<p>선별을 가장 많이 한 일꾼이 선별왕이 됩니다. 일꾼 이름을 등록하면 명예의 전당 후보에 오릅니다.</p>' +
    '<form class="search" method="post" action="/ch2/5/name"><input name="name" placeholder="일꾼 이름" autocomplete="off"><button>등록</button></form>' +
    (me ? '<p class="saved">내 정보: ' + esc(me.name) + '</p>' : '<p class="empty">아직 등록한 이름이 없습니다.</p>') +
    '<p><a href="/ch2/5/play/hall">선별왕 명예의 전당 보기 →</a></p>' + REVIEW5;
  res.send(page(p, body));
});
router.post('/5/name', (req, res) => {
  const id = ensureHall(req, res);
  const name = String((req.body && req.body.name) || '').slice(0, 300);
  if (name) hall.set(id, { name, code: hall.has(id) ? hall.get(id).code : 'KING-' + randomId().slice(0, 8) });
  res.redirect('/ch2/5/play');
});
router.get('/5/play/hall', (req, res) => {
  const p = problems[4];
  const id = ensureHall(req, res);
  res.send(page(p, title(p) + '<p>선별왕 명예의 전당</p>' + hallList(hall.get(id)) +
    '<div id="king-code" hidden>관리인에게만 표시됩니다</div>' +
    '<p><a href="/ch2/5/play">← 내 정보</a></p>' + REVIEW5));
});
router.get('/5/admin/:id', (req, res) => {
  if (req.query.key !== ADMIN_KEY5) return res.status(403).send('명예 관리인만 열 수 있습니다.');
  const p = problems[4];
  const me = BOARD_ID.test(req.params.id) ? hall.get(req.params.id) : null;
  res.send(page(p, '<h1>열매 군단 선별장 <small>명예 관리인 화면</small></h1><p>선별왕 명단</p>' + hallList(me) +
    (me ? '<div id="king-code" hidden>' + esc(me.code) + '</div>' : '')));
});
const reviewing5 = new Set();
router.post('/5/review', async (req, res) => {
  if (String(req.get('user-agent')).includes(bot.BOT_MARK)) return res.status(403).json({ ok: false, message: '봇은 요청할 수 없습니다.' });
  const id = readCookie(req, 'board5');
  const me = BOARD_ID.test(id) ? hall.get(id) : null;
  if (!me) return res.json({ ok: false, message: '먼저 이름을 등록해 주세요.' });
  if (reviewing5.has(id) || pending.has(req.ip)) return res.json({ ok: false, message: '이전 확인이 아직 진행 중입니다. 잠시 뒤 다시 시도해 주세요.' });
  reviewing5.add(id); pending.add(req.ip);
  try {
    const fired = await bot.check(config.origin + '/ch2/5/admin/' + id + '?key=' + ADMIN_KEY5, { answer: me.code });
    res.json(fired
      ? { ok: true, flag: config.flags.ch2[4] }
      : { ok: false, message: '명예 관리인이 명단을 열어 봤지만 인증 코드가 알림창에 뜨지 않았습니다.' });
  } catch (e) {
    console.error('[bot]', e.message);
    res.json({ ok: false, message: '확인 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.' });
  } finally {
    reviewing5.delete(id); pending.delete(req.ip);
  }
});

// 6번 최근 확인한 선별대 (쿠키 읽기):
//  - /play?bench=값 으로 선별대를 확인하면 쿠키(lastbench)에 기억하고, 화면에 안전 처리 없이 그대로 보여 준다 (의도된 취약점).
//  - 열쇠 번호는 bench_key 쿠키에 있다. 참가자 브라우저에는 "열쇠미지급" 표시만 있고, 서버 봇만 진짜 번호를 들고 연다.
//  - 이 쿠키는 HttpOnly 가 아니라서 페이지의 스크립트가 document.cookie 로 읽을 수 있다.
const BENCH_KEY = 'KEY-' + require('crypto').randomBytes(4).toString('hex');
router.get('/6/play', (req, res) => {
  const p = problems[5];
  let bench = readCookie(req, 'lastbench');
  if (typeof req.query.bench === 'string') {
    bench = req.query.bench.slice(0, 300);
    res.append('Set-Cookie', 'lastbench=' + encodeURIComponent(bench) + '; Path=/ch2/6; SameSite=Lax');
  }
  if (!readCookie(req, 'bench_key')) res.append('Set-Cookie', 'bench_key=' + encodeURIComponent('열쇠미지급') + '; Path=/ch2/6; SameSite=Lax');
  const body = title(p) +
    '<p>선별대 이름을 입력하면 확인한 선별대로 기억해 둡니다.</p>' +
    '<form class="search"><input name="bench" placeholder="예: B3 선별대" autocomplete="off"><button>확인</button></form>' +
    '<p class="saved">최근 확인한 선별대: ' + (bench || '없음') + '</p>';
  res.send(page(p, body));
});

// 7번 바구니 번호 자동완성 (DOM 기반):
//  - 서버는 입력값을 전혀 출력하지 않는다. 취약한 곳은 이 페이지의 스크립트다.
//  - 주소의 # 뒤 값(해시)과 입력칸 값을 "찾는 중" 안내에 innerHTML 로 그대로 넣는다 (의도된 취약점). 해시는 서버로 전달되지 않는다.
//  - 보관 코드는 #basket-code 에만 있다. 서버 봇이 HttpOnly 쿠키(basket_pass)를 들고 열 때만 진짜 코드가 채워지고,
//    참가자 화면에는 같은 모양의 요소에 안내 문구만 있다. 쿠키는 HttpOnly 라 document.cookie 로는 읽히지 않는다.
router.get('/7/play', (req, res) => {
  const p = problems[6];
  const pass = readCookie(req, 'basket_pass');
  const code = basketCodes.has(pass) ? pass : '직원 화면에서만 표시됩니다';
  const body = title(p) +
    '<p>바구니 번호를 치면 추천 목록이 바로 나타납니다. 주소 뒤에 <code>#번호</code>를 붙여 열면 그 번호로 바로 찾아 줍니다.</p>' +
    '<form class="search" onsubmit="return false"><input id="basket-input" placeholder="예: B3" autocomplete="off"></form>' +
    '<p id="basket-msg" class="saved"></p><ul id="basket-list" class="menu"></ul>' +
    '<div id="basket-code" hidden>' + esc(code) + '</div>' +
    '<script>(function(){' +
    'var BASKETS=["A1","A2","B1","B2","B3","C1","C2"];' +
    'var input=document.getElementById("basket-input"),msg=document.getElementById("basket-msg"),list=document.getElementById("basket-list");' +
    'function suggest(v){' +
    'msg.innerHTML=v?"\\""+v+"\\" 번호의 바구니를 찾는 중":"";' +
    'var hits=BASKETS.filter(function(b){return v&&b.toLowerCase().indexOf(v.toLowerCase())===0;});' +
    'list.innerHTML=hits.map(function(b){return "<li>"+b+" 바구니</li>";}).join("");}' +
    'input.addEventListener("input",function(){suggest(input.value);});' +
    'var h=decodeURIComponent(location.hash.slice(1));if(h){input.value=h;suggest(h);}' +
    '})();</script>';
  res.send(page(p, body));
});

// 아직 만들지 않은 문제: 안내 띠와 준비 중 표시
router.get('/:no/play', find, (req, res) => {
  res.send(page(req.problem, title(req.problem) + '<p class="empty">준비 중인 문제입니다.</p>'));
});

module.exports = router;
