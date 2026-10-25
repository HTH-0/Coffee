// 픽셀아트 격자에 맞춰 다시 칠하기
// - 칸마다 격자 크기와 시작 위치를 찾는다
// - 격자 한 칸 = 대표색 하나, 투명 여부도 칸 단위
// - 외톨이 블록 제거, 1칸 구멍 메우기, 외곽의 배경색 번짐 제거

// 경계 에너지: horiz 이면 열 사이 차이, 아니면 행 사이 차이
function energy(img, c, horiz) {
  const { data, W } = img;
  const L = horiz ? c.w : c.h, M = horiz ? c.h : c.w;
  const E = new Float64Array(L);
  for (let a = 1; a < L; a++) {
    let s = 0;
    for (let b = 0; b < M; b += 2) {
      const x = horiz ? c.x + a : c.x + b, y = horiz ? c.y + b : c.y + a;
      const i = (y * W + x) * 3, j = horiz ? i - 3 : i - W * 3;
      s += Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
    }
    E[a] = s;
  }
  return E;
}

// 주기 p, 위상 ph 중 경계 에너지가 가장 큰 조합
function fit(E, pmin, pmax) {
  let best = { s: 0, p: pmin, ph: 0 };
  for (let p = pmin; p <= pmax; p += 0.01) {
    for (let ph = 0; ph < p; ph += 0.25) {
      let s = 0, n = 0;
      for (let t = ph; t < E.length - 1; t += p) { s += E[Math.round(t)]; n++; }
      s /= n;
      if (s > best.s) best = { s, p, ph };
    }
  }
  return best;
}

function median(a) { a.sort((x, y) => x - y); return a[a.length >> 1]; }

function pixelize(img, cell, fg, opt) {
  const { data, W } = img;
  const { x: X, y: Y, w, h } = cell;
  const gx = fit(energy(img, cell, true), opt.min, opt.max);
  const gy = fit(energy(img, cell, false), opt.min, opt.max);
  const px = gx.p, py = gy.p;
  // 블록 경계 목록 (칸 좌표)
  const xs = [], ys = [];
  for (let t = gx.ph - Math.ceil(gx.ph / px) * px; t < w + px; t += px) xs.push(t);
  for (let t = gy.ph - Math.ceil(gy.ph / py) * py; t < h + py; t += py) ys.push(t);
  const BW = xs.length - 1, BH = ys.length - 1;
  const col = new Array(BW * BH), on = new Uint8Array(BW * BH);
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    // 블록 가운데 절반 영역만 본다 (경계의 번진 픽셀 제외)
    const x0 = xs[i] + px * 0.25, x1 = xs[i + 1] - px * 0.25, y0 = ys[j] + py * 0.25, y1 = ys[j + 1] - py * 0.25;
    const R = [], G = [], B = []; let f = 0, n = 0;
    for (let y = Math.max(0, Math.ceil(y0)); y < Math.min(h, y1); y++) for (let x = Math.max(0, Math.ceil(x0)); x < Math.min(w, x1); x++) {
      const k = ((Y + y) * W + X + x) * 3;
      R.push(data[k]); G.push(data[k + 1]); B.push(data[k + 2]);
      f += fg[y * w + x]; n++;
    }
    const b = j * BW + i;
    if (!n) { col[b] = [0, 0, 0]; continue; }
    col[b] = [median(R), median(G), median(B)];
    on[b] = f / n > 0.5 ? 1 : 0;
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= BW || j >= BH) ? 0 : on[j * BW + i];
  // 1칸 구멍 메우기 (상하좌우가 모두 캐릭터)
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++)
    if (!on[j * BW + i] && at(i - 1, j) && at(i + 1, j) && at(i, j - 1) && at(i, j + 1)) on[j * BW + i] = 2;
  // 외곽 번짐 제거: 바깥과 맞닿은 블록 중 이웃 배경 블록과 색이 비슷하고 어둡지 않으면 지운다
  const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  for (let pass = 0; pass < 2; pass++) {
    const drop = [];
    for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
      const b = j * BW + i; if (!on[b]) continue;
      const c = col[b]; if (Math.max(...c) < 70) continue; // 외곽선(검정)은 유지
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= BW || nj >= BH) continue;
        const nb = nj * BW + ni;
        if (!on[nb] && dist(c, col[nb]) < (opt.halo || 45)) { drop.push(b); break; }
      }
    }
    for (const b of drop) on[b] = 0;
  }
  // 작은 구멍 메우기: 테두리에 닿지 않고 사방이 막힌 빈칸 묶음이 작으면 채운다
  const seen = new Uint8Array(BW * BH);
  for (let s = 0; s < BW * BH; s++) {
    if (on[s] || seen[s]) continue;
    const comp = [s], q = [s]; seen[s] = 1; let edge = false;
    while (q.length) {
      const b = q.pop(), i = b % BW, j = (b - i) / BW;
      if (i === 0 || j === 0 || i === BW - 1 || j === BH - 1) edge = true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= BW || nj >= BH) continue;
        const nb = nj * BW + ni; if (!on[nb] && !seen[nb]) { seen[nb] = 1; q.push(nb); comp.push(nb); }
      }
    }
    if (!edge && comp.length <= (opt.hole || 6)) for (const b of comp) on[b] = 1;
  }
  // 외톨이 블록 제거 (8방향 이웃이 하나도 없음)
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    if (!on[j * BW + i]) continue;
    let n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if ((di || dj) && at(i + di, j + dj)) n++;
    if (!n) on[j * BW + i] = 0;
  }
  // 원래 해상도로 다시 그리기 (블록 경계는 반올림)
  const buf = Buffer.alloc(w * h * 4), nfg = new Uint8Array(w * h);
  for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
    const b = j * BW + i; if (!on[b]) continue;
    const c = col[b];
    for (let y = Math.max(0, Math.round(ys[j])); y < Math.min(h, Math.round(ys[j + 1])); y++)
      for (let x = Math.max(0, Math.round(xs[i])); x < Math.min(w, Math.round(xs[i + 1])); x++) {
        const o = (y * w + x) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255; nfg[y * w + x] = 1;
      }
  }
  return { buf, fg: nfg, grid: [px.toFixed(2), py.toFixed(2)] };
}

module.exports = { pixelize };

// 부드러운 그림용 경계 다듬기 (격자가 없는 흐릿한 원본)
// 1) 외곽의 배경색 번짐 깎기  2) 다수결 필터로 경계 매끈하게  3) 경계 1px 반투명
function smooth(img, cell, fg, opt) {
  const { data, W } = img;
  const { x: X, y: Y, w, h } = cell;
  const N = w * h;
  let m = Uint8Array.from(fg);
  const px = k => { const x = k % w, y = (k - x) / w; return ((Y + y) * W + X + x) * 3; };
  const isBg = opt.halo;
  // 1) 번짐 깎기: 바깥과 맞닿은 픽셀 중 배경색이면 지우기를 반복
  for (let it = 0; it < (opt.haloIter || 3); it++) {
    const drop = [];
    for (let k = 0; k < N; k++) {
      if (!m[k]) continue;
      const x = k % w, y = (k - x) / w;
      const edge = (x > 0 && !m[k - 1]) || (x < w - 1 && !m[k + 1]) || (y > 0 && !m[k - w]) || (y < h - 1 && !m[k + w]);
      if (!edge) continue;
      const i = px(k);
      if (isBg(data[i], data[i + 1], data[i + 2], y / h)) drop.push(k);
    }
    for (const k of drop) m[k] = 0;
  }
  // 2) 다수결 필터 (5x5)
  const r = opt.radius || 2;
  for (let it = 0; it < 2; it++) {
    const o = new Uint8Array(N);
    // 누적합으로 빠르게
    const S = new Int32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      S[(y + 1) * (w + 1) + x + 1] = m[y * w + x] + S[y * (w + 1) + x + 1] + S[(y + 1) * (w + 1) + x] - S[y * (w + 1) + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      const s = S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0];
      o[y * w + x] = s * 2 > (x1 - x0) * (y1 - y0) ? 1 : 0;
    }
    m = o;
  }
  // 작은 덩어리 제거
  const lab = new Int32Array(N).fill(-1); const q = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!m[s] || lab[s] >= 0) continue;
    let qh = 0, qt = 1; q[0] = s; lab[s] = s; const comp = [];
    while (qh < qt) {
      const k = q[qh++]; comp.push(k); const x = k % w, y = (k - x) / w;
      for (const n of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1])
        if (n >= 0 && m[n] && lab[n] < 0) { lab[n] = s; q[qt++] = n; }
    }
    if (comp.length < N * 0.0015) for (const k of comp) m[k] = 0;
  }
  // 3) 경계 반투명: 3x3 평균으로 알파
  const buf = Buffer.alloc(N * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      s += m[ny * w + nx]; n++;
    }
    const a = m[k] ? Math.round(255 * Math.min(1, (s / n) * 1.25)) : 0; // 바깥은 투명, 안쪽 경계만 살짝 반투명
    const i = px(k), o = k * 4;
    buf[o] = data[i]; buf[o + 1] = data[i + 1]; buf[o + 2] = data[i + 2]; buf[o + 3] = a;
  }
  return { buf, fg: m, grid: ['smooth', ''] };
}

module.exports.smooth = smooth;
