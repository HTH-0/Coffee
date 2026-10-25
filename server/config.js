/*
 * 서버 설정. 배포할 때는 환경 변수로 바꾼다.
 *   PORT         서버 포트
 *   ORIGIN       외부에서 접속하는 주소 (검사 봇이 이 주소의 문제 페이지만 열어 본다)
 *   CHROME_PATH  검사 봇이 쓸 크롬/크로미움 실행 파일
 * 플래그 (저장소에 올리지 않음, flags.example.json 참고). 아래 순서로 처음 있는 것을 쓴다.
 *   1) 환경 변수 FLAGS_JSON (flags.json 내용 전체를 한 줄로)
 *   2) /etc/secrets/flags.json (Render 의 Secret Files)
 *   3) server/flags.json
 *   4) server/flags.example.json (예시. 배포에서는 쓰면 안 됨)
 */
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT) || 3000;

function loadFlags() {
  if (process.env.FLAGS_JSON) return JSON.parse(process.env.FLAGS_JSON);
  const files = ['/etc/secrets/flags.json', path.join(__dirname, 'flags.json')];
  for (const f of files) if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  if (process.env.NODE_ENV === 'production') throw new Error('flags.json 이 없습니다. FLAGS_JSON 또는 Secret Files 로 플래그를 넣어 주세요.');
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'flags.example.json'), 'utf8'));
}

module.exports = {
  port,
  origin: (process.env.ORIGIN || 'http://localhost:' + port).replace(/\/$/, ''),
  chromePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  chromeArgs: process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [],
  botTimeoutMs: 5000,
  flags: loadFlags()
};
