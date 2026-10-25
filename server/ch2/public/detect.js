/*
 * 알림창 감지 (문제 페이지 맨 앞에서 실행)
 * - alert/confirm/prompt 가 불리면 화면 위 안내 띠에 바로 표시하고, 현재 주소를 서버에 보내 확인을 받는다.
 * - 알림창 내용이 목표(data-answer)와 다르면 서버에 보내지 않고 바로 알려 준다.
 * - 플래그는 서버 봇이 같은 주소를 직접 열어 확인한 뒤에만 내려온다.
 * - 게임 창(iframe) 안에서는 진짜 알림창이 막혀 있어도 이 표시로 결과를 알 수 있다.
 * - 서버 봇이 열 때(KLOADBot)는 서버로 다시 보내지 않는다 (봇이 봇을 부르는 반복 방지).
 */
(function () {
  'use strict';
  var no = document.currentScript.getAttribute('data-no');
  var answer = document.currentScript.getAttribute('data-answer');
  var isBot = /KLOADBot/.test(navigator.userAgent);
  var sent = false;

  function box() { return document.getElementById('xss-status'); }
  function show(cls, html) {
    var b = box();
    if (!b) return;
    b.className = 'status ' + cls;
    b.innerHTML = html;
  }
  function text(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // 페이지가 다 그려진 뒤에 실행 (알림창이 본문보다 먼저 불릴 수 있음)
  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function report(message) {
    if (sent || isBot) return;
    if (answer !== null && message !== answer) {
      whenReady(function () {
        show('bad', '알림창은 떴지만 내용이 목표와 다릅니다. 띄운 내용: <code>' + text(message) + '</code>');
      });
      return;
    }
    sent = true;
    whenReady(function () {
      show('wait', '알림창 감지! 서버에서 같은 주소로 다시 확인하는 중...');
      fetch('/ch2/' + no + '/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: location.href })
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (res.ok) {
          show('ok', '확인 완료! 플래그: <code>' + text(res.flag) + '</code> <button type="button" id="copy-flag">복사</button>');
          var c = document.getElementById('copy-flag');
          c.onclick = function () { navigator.clipboard.writeText(res.flag).then(function () { c.textContent = '복사됨'; }); };
        } else {
          show('bad', text(res.message));
        }
      }).catch(function () {
        show('bad', '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      });
    });
  }

  ['alert', 'confirm', 'prompt'].forEach(function (name) {
    var original = window[name];
    window[name] = function (message) {
      report(String(message === undefined ? '' : message));
      // 새 창에서는 진짜 알림창도 띄운다 (게임 창 안에서는 브라우저가 막음). 서버 봇은 이 알림창으로 판정한다.
      try { return original.apply(window, arguments); } catch (e) { return undefined; }
    };
  });
})();
