/*
 * KLOAD 워게임 서버
 *   /        게임 화면 (저장소 최상위의 index.html, css, js, assets)
 *   /ch2/... 2장 문제 (XSS)
 * 다른 장 문제는 /ch1, /ch3 처럼 폴더를 추가해 붙인다.
 */
const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();
app.disable('x-powered-by');

// 게임 화면: 필요한 파일만 내보낸다 (server 폴더, .git, 플래그 파일 등은 내보내지 않음)
const ROOT = path.join(__dirname, '..');
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
['css', 'js', 'assets'].forEach(d => app.use('/' + d, express.static(path.join(ROOT, d))));

app.use('/ch2', require('./ch2'));

app.listen(config.port, () => console.log('KLOAD 서버: ' + config.origin));
