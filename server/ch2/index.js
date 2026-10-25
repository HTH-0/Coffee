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

router.post('/:no/check', find, async (req, res) => {
  const p = req.problem;
  const url = String((req.body && req.body.url) || '');
  const prefix = config.origin + '/ch2/' + p.no + '/play';
  if (String(req.get('user-agent')).includes(bot.BOT_MARK)) return res.status(403).json({ ok: false, message: '봇은 확인 요청을 보낼 수 없습니다.' });
  if (!p.ready) return res.json({ ok: false, message: '아직 준비 중인 문제입니다.' });
  if (!(url === prefix || ['?', '#', '/'].some(c => url.startsWith(prefix + c)))) {
    return res.json({ ok: false, message: '이 문제의 페이지 주소만 확인할 수 있습니다.' });
  }
  if (pending.has(req.ip)) return res.json({ ok: false, message: '이전 확인이 아직 진행 중입니다. 잠시 뒤 다시 시도해 주세요.' });
  pending.add(req.ip);
  try {
    const fired = await bot.check(url, { answer: p.answer });
    res.json(fired
      ? { ok: true, flag: config.flags.ch2[p.no - 1] }
      : { ok: false, message: '서버가 같은 주소를 열어 봤지만 목표한 알림창이 뜨지 않았습니다. 주소만으로 다시 재현되는지 확인해 보세요.' });
  } catch (e) {
    console.error('[bot]', e.message);
    res.json({ ok: false, message: '확인 중 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.' });
  } finally {
    pending.delete(req.ip);
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
const REVIEW_UI = '<div class="review"><button type="button" id="review-btn">검열관에게 검토 요청</button> ' +
  '<span class="hint">남긴 신고를 열매 군단 검열관이 열어 봅니다.</span></div>' +
  '<script>(function(){var b=document.getElementById("review-btn");b.onclick=function(){' +
  'var s=document.getElementById("xss-status");s.className="status wait";s.textContent="검열관이 신고 목록을 여는 중...";b.disabled=true;' +
  'fetch("/ch2/4/review",{method:"POST"}).then(function(r){return r.json()}).then(function(r){' +
  'b.disabled=false;if(r.ok){s.className="status ok";s.textContent="검열관 화면에서 알림창 확인! 플래그: "+r.flag;}' +
  'else{s.className="status bad";s.textContent=r.message;}}).catch(function(){b.disabled=false;s.className="status bad";s.textContent="서버에 연결하지 못했습니다.";});};})();</script>';

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

// 아직 만들지 않은 문제: 안내 띠와 준비 중 표시
router.get('/:no/play', find, (req, res) => {
  res.send(page(req.problem, title(req.problem) + '<p class="empty">준비 중인 문제입니다.</p>'));
});

module.exports = router;
