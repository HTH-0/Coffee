/*
 * 서버 설정. 배포할 때는 환경 변수로 바꾼다.
 *   PORT         서버 포트
 *   ORIGIN       외부에서 접속하는 주소 (검사 봇이 이 주소의 문제 페이지만 열어 본다)
 *   CHROME_PATH  검사 봇이 쓸 크롬/크로미움 실행 파일
 * 플래그는 flags.json 에 둔다 (저장소에 올리지 않음, flags.example.json 참고)
 */
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT) || 3000;
const flagFile = path.join(__dirname, 'flags.json');

module.exports = {
  port,
  origin: (process.env.ORIGIN || 'http://localhost:' + port).replace(/\/$/, ''),
  chromePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  chromeArgs: process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [],
  botTimeoutMs: 5000,
  flags: JSON.parse(fs.readFileSync(fs.existsSync(flagFile) ? flagFile : path.join(__dirname, 'flags.example.json'), 'utf8'))
};
