// 배경 포함으로 칸만 자르고, 좌상단 번호와 10번의 별 마크를 지워 주변색으로 메운다
// 사용: node ch4.js <chapter> <outDir> <previewFile>
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { raw, cells, CH } = require('./cut.js');

// 마스크 영역을 바깥 픽셀에서 안쪽으로 번지듯 채운다 (확산 채우기)
// skipDark: 검은 외곽선 색은 밝은 이웃이 하나도 없을 때만 쓴다 (외곽선 색이 번지지 않게)
function inpaint(buf, w, h, m, skipDark) {
  const todo = Uint8Array.from(m);
  let left = todo.reduce((a, b) => a + b, 0);
  while (left > 0) {
    const fill = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x; if (!todo[k]) continue;
      let s = [0, 0, 0], n = 0, sd = [0, 0, 0], nd = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx; if (todo[nk]) continue;
        const dark = skipDark && Math.max(buf[nk * 3], buf[nk * 3 + 1], buf[nk * 3 + 2]) < 60;
        if (dark) { sd[0] += buf[nk * 3]; sd[1] += buf[nk * 3 + 1]; sd[2] += buf[nk * 3 + 2]; nd++; }
        else { s[0] += buf[nk * 3]; s[1] += buf[nk * 3 + 1]; s[2] += buf[nk * 3 + 2]; n++; }
      }
      if (n >= 2) fill.push([k, s.map(v => Math.round(v / n))]);
      else if (n + nd >= 2 && !skipDark) fill.push([k, s.map((v, j) => Math.round((v + sd[j]) / (n + nd)))]);
    }
    // 밝은 이웃만으로 더 채울 수 없으면 검은 이웃도 허용
    if (!fill.length && skipDark) { skipDark = false; continue; }
    if (!fill.length) break;
    for (const [k, c] of fill) { buf[k * 3] = c[0]; buf[k * 3 + 1] = c[1]; buf[k * 3 + 2] = c[2]; todo[k] = 0; left--; }
  }
}

// 가로줄 구조(테이블, 머신 아래 단)를 살리도록 같은 줄 오른쪽의 가장 가까운 픽셀 색으로 채운다
function rowFill(buf, w, h, m) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; if (!m[k]) continue;
    let sx = x; while (sx < w && m[y * w + sx]) sx++;
    if (sx >= w) { sx = x; while (sx >= 0 && m[y * w + sx]) sx--; }
    if (sx < 0) continue;
    const s = y * w + sx;
    buf[k * 3] = buf[s * 3]; buf[k * 3 + 1] = buf[s * 3 + 1]; buf[k * 3 + 2] = buf[s * 3 + 2];
  }
}

function dilate(m, w, h, r) {
  const o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x])
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h) o[ny * w + nx] = 1;
    }
  return o;
}

// 좌상단 번호: 노란 글자 + 검은 테두리
function numberMask(buf, w, h) {
  const m = new Uint8Array(w * h);
  let minx = w, miny = h, maxx = -1, maxy = -1;
  for (let y = 0; y < h * 0.2; y++) for (let x = 0; x < w * 0.4; x++) {
    const k = y * w + x, r = buf[k * 3], g = buf[k * 3 + 1], b = buf[k * 3 + 2];
    if (r > 190 && g > 150 && b < 110 && r - b > 100) {
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  if (maxx < 0) return null;
  // 글자 사각형 + 테두리 여유
  const P = 12;
  return [Math.max(0, minx - P), Math.max(0, miny - P), Math.min(w - 1, maxx + P), Math.min(h - 1, maxy + P)];
}

// 사각형 영역을 바로 아래 배경을 위아래로 뒤집어 비춰 채운다 (배경 무늬가 이어지고 대각선 이음매가 없다)
// 오른쪽 경계는 8px 동안 원래 오른쪽 픽셀과 섞어 이음매를 숨긴다
function mirrorFill(buf, w, h, r) {
  const [x0, y0, x1, y1] = r;
  const F = 8;
  for (let y = y0; y <= y1; y++) {
    const sy = Math.min(h - 1, y1 + (y1 - y) + 1);
    for (let x = x0; x <= x1; x++) {
      const d = (y * w + x) * 3, s = (sy * w + x) * 3;
      let c = [buf[s], buf[s + 1], buf[s + 2]];
      const toRight = x1 - x;
      if (x1 < w - 1 && toRight < F) {
        const e = (y * w + x1 + 1) * 3, t = (F - toRight) / (F + 1);
        c = c.map((v, j) => Math.round(v * (1 - t) + buf[e + j] * t));
      }
      buf[d] = c[0]; buf[d + 1] = c[1]; buf[d + 2] = c[2];
    }
  }
}

// 별 마크: 오른쪽 아래의 밝은 회색 4각 별 (검은 외곽선을 넘지 않는 밝은 영역)
function starMask(buf, w, h) {
  const light = k => { const r = buf[k * 3], g = buf[k * 3 + 1], b = buf[k * 3 + 2]; return Math.min(r, g, b) > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 40; };
  // 별 중심(칸의 약 84%, 89% 지점)에서 가장 가까운 밝은 점을 시작점으로
  const cx = w * 0.848, cy = h * 0.888;
  let seed = -1, best = Infinity;
  for (let y = Math.floor(h * 0.84); y < Math.floor(h * 0.94); y++) for (let x = Math.floor(w * 0.79); x < Math.floor(w * 0.9); x++) {
    const k = y * w + x, d = (x - cx) ** 2 + (y - cy) ** 2;
    if (light(k) && d < best) { best = d; seed = k; }
  }
  const m = new Uint8Array(w * h);
  // 시작점이 없어도(반투명 별) 아래 별 모양 영역으로 지운다
  const q = [seed]; m[seed] = 1;
  while (q.length) {
    const k = q.pop(), x = k % w, y = (k - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx; if (!m[nk] && light(nk) && nx > w * 0.72 && ny > h * 0.8) { m[nk] = 1; q.push(nk); }
    }
  }
  // 반투명 별도 지우도록 4각 별 모양(아스트로이드) 영역을 더한다. 검은 외곽선은 남긴다.
  const R = 56, sx = seed >= 0 ? seed % w : Math.round(cx), sy = seed >= 0 ? (seed - sx) / w : Math.round(cy);
  const ccx = seed >= 0 ? cx : sx, ccy = seed >= 0 ? cy : sy;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ax = Math.abs(x - ccx) / R, ay = Math.abs(y - ccy) / R;
    const k = y * w + x;
    if (Math.pow(ax, 0.8) + Math.pow(ay, 0.8) <= 1 && Math.max(buf[k * 3], buf[k * 3 + 1], buf[k * 3 + 2]) > 60) m[k] = 1;
  }
  return dilate(m, w, h, 3);
}

(async () => {
  const [chArg, outDir, prev] = process.argv.slice(2);
  const ch = +chArg, cfg = CH[ch];
  const A = await raw(cfg.base), B = cfg.hit ? await raw(cfg.hit) : null;
  const cs = cells(A, cfg.grid);
  const w = Math.min(...cs.map(c => c.w)), h = Math.min(...cs.map(c => c.h));
  const files = [];
  const rects = [];
  const sets = [['base', A]]; if (B) sets.push(['hit', B]);
  for (const [kind, img] of sets) {
    const dir = path.join(outDir, kind); fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 10; i++) {
      const c = cs[i], X = c.x + Math.floor((c.w - w) / 2), Y = c.y;
      const buf = Buffer.alloc(w * h * 3);
      for (let y = 0; y < h; y++) img.data.copy(buf, y * w * 3, ((Y + y) * img.W + X) * 3, ((Y + y) * img.W + X + w) * 3);
      // 번호 위치는 기본 시트에서 찾고(맞았을 때 시트는 불꽃 등이 겹칠 수 있음) 같은 위치를 쓴다
      if (kind === 'base') rects[i] = numberMask(buf, w, h);
      if (rects[i]) mirrorFill(buf, w, h, rects[i]);
      if (i === 9 && ch > 1) rowFill(buf, w, h, starMask(buf, w, h));
      const name = path.join(dir, 'f' + String(i + 1).padStart(2, '0'));
      const file = name + '.png';
      await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toFile(file);
      await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).webp({ quality: 90 }).toFile(name + '.webp');
      files.push({ file, kind, i });
    }
  }
  console.log('ch' + ch, w + 'x' + h, files.length);
  const G = 12;
  await sharp({ create: { width: 5 * w + 6 * G, height: sets.length * 2 * h + (sets.length * 2 + 1) * G, channels: 3, background: '#ffffff' } })
    .composite(files.map(f => ({ input: f.file, left: G + (f.i % 5) * (w + G), top: G + ((f.kind === 'hit' ? 2 : 0) + Math.floor(f.i / 5)) * (h + G) })))
    .png().toFile(prev);
})();
