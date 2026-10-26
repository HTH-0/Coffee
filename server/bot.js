/*
 * 검사 봇: 참가자가 낸 문제 페이지 주소를 헤드리스 크롬으로 열어 보고,
 * 알림창(alert/confirm/prompt)에 정해진 내용(answer)이 뜨면 성공으로 본다.
 * - 한 번에 하나씩만 연다 (요청이 몰리면 줄을 세움)
 * - 서버 자기 주소 밖으로 나가는 요청은 막는다
 */
const puppeteer = require('puppeteer-core');
const config = require('./config');

const BOT_MARK = 'KLOADBot';
let queue = Promise.resolve();

// opts.answer: 알림창에 떠야 하는 내용 / opts.cookies: 봇이 들고 열 쿠키 [{name,value,httpOnly}] (6·7번용)
function check(url, opts) {
  const run = queue.then(() => visit(url, opts || {}));
  queue = run.catch(() => {});
  return run;
}

async function visit(url, opts) {
  const answer = opts.answer;
  const browser = await puppeteer.launch({ executablePath: config.chromePath, headless: true, args: config.chromeArgs });
  let fired = false;
  try {
    const page = await browser.newPage();
    // 문제 페이지의 감지 스크립트가 봇 접속을 알아보도록 표시를 단다 (서버로 다시 확인 요청을 보내지 않게)
    await page.setUserAgent((await browser.userAgent()) + ' ' + BOT_MARK);
    if (opts.cookies && opts.cookies.length) {
      const host = new URL(config.origin).hostname;
      await page.setCookie(...opts.cookies.map(c => ({ name: c.name, value: c.value, domain: host, path: '/', httpOnly: !!c.httpOnly })));
    }
    page.on('dialog', d => {
      if (answer === undefined || d.message() === answer) fired = true;
      d.dismiss().catch(() => {});
    });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith(config.origin + '/') || u.startsWith('data:') || u === 'about:blank') req.continue();
      else req.abort();
    });
    await page.goto(url, { waitUntil: 'load', timeout: config.botTimeoutMs }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
  } finally {
    await browser.close();
  }
  return fired;
}

module.exports = { check, BOT_MARK };
