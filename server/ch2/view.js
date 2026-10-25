/* 2장 페이지 공통 틀 */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/*
 * 문제 페이지 틀: 위쪽 안내 띠(병사, 공정, 상황, 목표, 결과 표시) + 아래 가공소 화면(body)
 * 감지 스크립트(detect.js)는 <head> 에서 본문보다 먼저 실행되어야 한다.
 */
function page(p, body) {
  const who = p.no === 10 ? '대장' : p.no + '번 병사';
  const banner = '<header class="banner">' +
    '<p class="eyebrow">2장 · ' + who + ' · ' + esc(p.step) + ' 단계 · ' + esc(p.soldier) + '</p>' +
    '<p class="scene">' + esc(p.scene) + '</p>' +
    '<p class="goal"><b>목표</b> ' + esc(p.goal) + ' 성공하면 이 자리에 플래그가 나온다.' +
    ' <a href="" target="_blank" rel="noopener" class="newwin">새 창에서 보기</a></p>' +
    '<div id="xss-status" class="status" aria-live="polite"></div>' +
    '</header>';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(p.feature) + ' · 열매 군단 가공소</title>' +
    '<script src="/ch2/static/detect.js" data-no="' + p.no + '"' + (p.answer !== undefined ? ' data-answer="' + esc(p.answer) + '"' : '') + '></script>' +
    '<link rel="stylesheet" href="/ch2/static/cafe.css"></head>' +
    '<body>' + banner + '<main>' + body + '</main></body></html>';
}

module.exports = { esc, page };
