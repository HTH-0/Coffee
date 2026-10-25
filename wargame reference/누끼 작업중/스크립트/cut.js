// 격자 시트 → 칸별 배경 제거 PNG
// 사용: node cut.js <chapter> [outDir] [previewDir]
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const R = 'C:/Users/taehyeong/Downloads/wargame/';
const C = R + 'wargame reference/캐릭터 디자인/';

// 장별 설정
// ink: 외곽선으로 보는 최대 채널 값 상한
// protect(r,g,b): 외곽선이 없어도 캐릭터/이펙트로 남길 색
const CH = {
  1: { base: C + '나무몬스터/KakaoTalk_20261023_172818355.png', grid: 'ch1', ink: 70, close: 4, groundY: 0.76, pocket: 2, protect: (r, g, b, fy) => fy < 0.55 && g - r > 45 && g < 160 && g - b > 20, numberBox: [0.3, 0.2], lowGreenY: 0.55, cutY: 0.86, smooth: { halo: (r, g, b, fy) => g > r + 12 && g > 105 && g >= b, haloIter: 3, radius: 2 } },
  2: {
    base: C + '커피 군단/Gemini_Generated_Image_s49jsxs49jsxs49j.png',
    hit: C + '커피 군단/Gemini_Generated_Image_mz62yzmz62yzmz62.png',
    grid: 'big', ink: 55, close: 6, hitDiff: false, pixel: { min: 11.3, max: 11.7 },
    protect: (r, g, b) => r > 200 && g > 110 && b < 100 && r - b > 120 // 노란/주황 충격 표시
  },
  3: {
    base: C + '생두에서 원두/Gemini_Generated_Image_ve7zcjve7zcjve7z.png',
    hit: C + '생두에서 원두/Gemini_Generated_Image_72lwj972lwj972lw.png',
    grid: 'big', ink: 40, close: 6, hitDiff: true, navyEdge: [50, 100], pocketMax: 0.01, numberBox: [0.32, 0.15], pixel: { min: 11.3, max: 11.7 }
  },
  4: {
    base: C + '원두에서 커피/Gemini_Generated_Image_xep9g9xep9g9xep9.png',
    hit: C + '원두에서 커피/Gemini_Generated_Image_sjuro2sjuro2sjur.png',
    grid: 'big', ink: 30, close: 6, hitDiff: true
  }
};

async function raw(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

// 칸 사각형 목록 (번진 테두리 제외한 안쪽)
function cells(img, grid) {
  if (grid === 'ch1') {
    const XS = [9, 344, 678, 1012, 1346], YS = [4, 474], w = 323, h = 460;
    const out = [];
    for (const y of YS) for (const x of XS) out.push({ x, y, w, h });
    return out;
  }
  const { data, W, H } = img;
  const lum = (x, y) => { const i = (y * W + x) * 3; return data[i] * .3 + data[i + 1] * .59 + data[i + 2] * .11; };
  // 칸 사이 검은 틈의 중심 찾기
  function gutter(lo, hi, vertical) {
    const vals = [];
    for (let p = lo; p < hi; p++) {
      let s = 0, n = 0;
      if (vertical) for (let y = 100; y < 700; y += 3) { s += lum(p, y); n++; }
      else for (let x = 100; x < 500; x += 3) { s += lum(x, p); n++; }
      vals.push(s / n);
    }
    const m = Math.min(...vals);
    const idx = vals.map((v, i) => v < m + 12 ? i : -1).filter(i => i >= 0);
    return lo + (idx[0] + idx[idx.length - 1]) / 2;
  }
  const gx = [0]; for (let k = 1; k < 5; k++) { const e = W * k / 5; gx.push(gutter(Math.round(e - 45), Math.round(e + 45), true)); } gx.push(W);
  const gy = [0, gutter(H / 2 - 45, H / 2 + 45, false), H];
  const IN = 32, OUT = 32;
  const out = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const x0 = Math.round(c === 0 ? OUT : gx[c] + IN), x1 = Math.round(c === 4 ? W - OUT : gx[c + 1] - IN);
    const y0 = Math.round(r === 0 ? OUT : gy[1] + IN), y1 = Math.round(r === 1 ? H - OUT : gy[1] - IN);
    out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return out;
}

// 칸 하나의 전경 마스크 (1 = 캐릭터)
function mask(img, cell, cfg, extra) {
  const { data, W } = img;
  const { x: X, y: Y, w, h } = cell;
  const N = w * h;
  const at = (x, y) => ((Y + y) * W + (X + x)) * 3;
  const ink = new Uint8Array(N), keep = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y), r = data[i], g = data[i + 1], b = data[i + 2];
    const k = y * w + x;
    if (Math.max(r, g, b) < cfg.ink) ink[k] = 1;
    if ((cfg.protect && cfg.protect(r, g, b, y / h)) || (extra && extra[k])) keep[k] = 1;
  }
  // 1) 외곽선의 틈을 막기 위해 r 만큼 두껍게 한 뒤,
  //    칸 가장자리에서 외곽선을 넘지 않고 퍼지는 영역 = 배경
  const r = cfg.close || 0;
  const wall = dilate(ink, w, h, r);
  const bg0 = new Uint8Array(N);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  const push = k => { if (!bg0[k] && !wall[k] && !keep[k]) { bg0[k] = 1; q[qt++] = k; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (qh < qt) {
    const k = q[qh++], x = k % w, y = (k - x) / w;
    if (x > 0) push(k - 1); if (x < w - 1) push(k + 1);
    if (y > 0) push(k - w); if (y < h - 1) push(k + w);
  }
  // 두껍게 한 만큼 배경을 다시 넓혀 원래 외곽선 위치로 돌린다 (외곽선 픽셀은 유지)
  const bg = dilate(bg0, w, h, r);
  const fg = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (keep[k] && !bg0[k]) bg[k] = 0;
    fg[k] = (!bg[k] || (ink[k] && !bg0[k])) ? 1 : 0;
  }

  // 2) 외곽선에 갇힌 배경 조각(팔과 몸 사이 등): 배경 색 분포와 비슷하면 배경으로
  const hist = new Uint32Array(4096); let bgN = 0;
  const qz = i => ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (bg[k]) { hist[qz(at(x, y))]++; bgN++; } }
  // 조각은 두껍게 한 외곽선(wall)으로 나눈다 (틈으로 몸통과 이어지지 않게)
  const seen = new Uint8Array(N), pocket = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (!fg[s] || wall[s] || keep[s] || seen[s]) continue;
    const comp = []; q[0] = s; qh = 0; qt = 1; seen[s] = 1;
    while (qh < qt) {
      const k = q[qh++]; comp.push(k); const x = k % w, y = (k - x) / w;
      const nb = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const n of nb) if (n >= 0 && fg[n] && !wall[n] && !keep[n] && !seen[n]) { seen[n] = 1; q[qt++] = n; }
    }
    let like = 0;
    for (const k of comp) { const x = k % w, y = (k - x) / w; if (hist[qz(at(x, y))] > bgN * 0.002) like++; }
    // 큰 조각은 캐릭터 몸통일 수 있으니 작은 조각만 배경으로 본다
    if (comp.length < N * (cfg.pocketMax || 0.04) && like / comp.length > (cfg.pocket || 0.75)) for (const k of comp) pocket[k] = 1;
  }
  const pk = dilate(pocket, w, h, r);
  for (let k = 0; k < N; k++) if (pk[k] && !ink[k] && !keep[k]) fg[k] = 0;

  // 아래쪽의 밝은 연두(덤불, 다리 사이로 보이는 배경)는 배경
  if (cfg.lowGreenY) for (let y = Math.floor(h * cfg.lowGreenY); y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y); if (data[i + 1] > data[i] + 25 && data[i + 1] > 120 && data[i + 1] > data[i + 2]) fg[y * w + x] = 0;
  }

  // 땅선 아래는 흰 깃발 천만 남긴다
  if (cfg.cutY) for (let y = Math.floor(h * cfg.cutY); y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y); if (Math.min(data[i], data[i + 1], data[i + 2]) < 150) fg[y * w + x] = 0;
  }

  // 땅 높이 아래의 짙은 초록(풀 외곽선)은 배경
  if (cfg.groundY) for (let y = Math.floor(h * cfg.groundY); y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y); if (data[i + 1] >= data[i] && data[i + 1] < 150) fg[y * w + x] = 0;
  }

  // 좌상단 번호 자리: 순수한 노란 글자와 검은 테두리만 지운다 (불꽃 같은 이펙트는 남김)
  if (cfg.numberBox) {
    const [bw, bh] = cfg.numberBox;
    for (let y = 0; y < h * bh; y++) for (let x = 0; x < w * bw; x++) {
      const i = at(x, y), r0 = data[i], g0 = data[i + 1], b0 = data[i + 2];
      const yellow = r0 > 200 && g0 > 180 && b0 < 90 && Math.abs(r0 - g0) < 55;
      if (yellow || Math.max(r0, g0, b0) < 45) fg[y * w + x] = 0;
    }
  }

  // 칸 가장자리에서 남색 기운의 어두운 픽셀(나무 기둥)을 따라 지운다. 순수 검정 외곽선(b≈r)은 건너지 않는다.
  if (cfg.navyEdge) {
    const navy = k => {
      const x = k % w, y = (k - x) / w, i = at(x, y), mx = Math.max(data[i], data[i + 1], data[i + 2]);
      return fg[k] && (mx < cfg.navyEdge[0] || (mx < cfg.navyEdge[1] && data[i + 2] > data[i] + 15));
    };
    const gone = new Uint8Array(N); qh = 0; qt = 0;
    const add = k => { if (!gone[k] && navy(k)) { gone[k] = 1; q[qt++] = k; } };
    for (let x = 0; x < w; x++) { add(x); add((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { add(y * w); add(y * w + w - 1); }
    while (qh < qt) {
      const k = q[qh++], x = k % w, y = (k - x) / w;
      if (x > 0) add(k - 1); if (x < w - 1) add(k + 1); if (y > 0) add(k - w); if (y < h - 1) add(k + w);
    }
    for (let k = 0; k < N; k++) if (gone[k]) fg[k] = 0;
  }

  // 3) 전경 덩어리 정리: 작은 잡티, 좌상단 번호 제거
  const lab = new Int32Array(N).fill(-1); const comps = [];
  for (let s = 0; s < N; s++) {
    if (!fg[s] || lab[s] >= 0) continue;
    const id = comps.length; let n = 0, minx = w, miny = h, maxx = 0, maxy = 0, yellow = 0, bright = 0;
    q[0] = s; qh = 0; qt = 1; lab[s] = id;
    while (qh < qt) {
      const k = q[qh++]; n++; const x = k % w, y = (k - x) / w;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const i = at(x, y); if (data[i] > 200 && data[i + 1] > 170 && data[i + 2] < 90) yellow++;
      bright += Math.max(data[i], data[i + 1], data[i + 2]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx; if (fg[nk] && lab[nk] < 0) { lab[nk] = id; q[qt++] = nk; }
      }
    }
    comps.push({ n, minx, miny, maxx, maxy, yellow, bright: bright / n });
  }
  const drop = comps.map(c =>
    (cfg.numberBox && c.maxx < w * cfg.numberBox[0] && c.maxy < h * cfg.numberBox[1]) ||          // 번호 자리에 남은 흔적
    c.n < N * 0.001 ||                                                      // 잡티
    (c.maxy < h * 0.06) ||                                                   // 카드 위쪽 덩굴 장식
    ((c.minx <= 2 || c.maxx >= w - 3) && c.n < N * 0.02) ||                  // 칸 가장자리에 붙은 조각
    ((c.maxx < w * 0.2 || c.minx > w * 0.8) && c.n < N * 0.01) ||           // 양옆 끝의 작은 조각(덤불)
    (cfg.groundY && c.miny > h * cfg.groundY) ||                             // 땅 아래 흙 조각
    (c.maxx - c.minx > w * 0.92 && c.maxy - c.miny < h * 0.15) ||           // 땅 줄
    (c.miny > h * 0.85) ||                                                   // 바닥 흙 무늬
    (c.maxx < w * 0.36 && c.maxy < h * 0.2 && c.yellow > c.n * 0.15)        // 좌상단 번호
  );
  for (let k = 0; k < N; k++) if (fg[k] && drop[lab[k]]) fg[k] = 0;
  return fg;
}

// 정사각형 팽창 (가로·세로 분리)
function dilate(m, w, h, r) {
  if (!r) return Uint8Array.from(m);
  const t = new Uint8Array(w * h), o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) { if (m[y * w + x]) last = x; if (x - last <= r) t[y * w + x] = 1; }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) { if (m[y * w + x]) last = x; if (last - x <= r) t[y * w + x] = 1; }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) { if (t[y * w + x]) last = y; if (y - last <= r) o[y * w + x] = 1; }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) { if (t[y * w + x]) last = y; if (last - y <= r) o[y * w + x] = 1; }
  }
  return o;
}

// 기본/맞음 시트 차이 → 이펙트 마스크 (칸 좌표 기준)
function diffMask(A, B, cell) {
  const { x: X, y: Y, w, h } = cell, W = A.W;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((Y + y) * W + X + x) * 3;
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d > 90) m[y * w + x] = 1;
  }
  // 작은 점 제거 (3x3 안에 5개 이상일 때만)
  const o = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += m[(y + dy) * w + x + dx];
    if (s >= 5) o[y * w + x] = 1;
  }
  return o;
}

function rgba(img, cell, fg) {
  const { x: X, y: Y, w, h } = cell, W = img.W;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((Y + y) * W + X + x) * 3, o = (y * w + x) * 4;
    out[o] = img.data[i]; out[o + 1] = img.data[i + 1]; out[o + 2] = img.data[i + 2]; out[o + 3] = fg[y * w + x] ? 255 : 0;
  }
  return out;
}

module.exports = { raw, cells, CH };
if (require.main === module) (async () => {
  const ch = +process.argv[2];
  const outDir = process.argv[3];
  const prevDir = process.argv[4];
  const cfg = CH[ch];
  const A = await raw(cfg.base);
  const B = cfg.hit ? await raw(cfg.hit) : null;
  const cs = cells(A, cfg.grid);
  // 모든 칸을 같은 크기로 (가장 작은 칸 기준, 가운데 정렬)
  const w = Math.min(...cs.map(c => c.w)), h = Math.min(...cs.map(c => c.h));
  const cl = cs.map(c => ({ x: c.x + Math.floor((c.w - w) / 2), y: c.y, w, h }));

  const sets = [['base', A]]; if (B) sets.push(['hit', B]);
  const frames = [];
  for (const [kind, img] of sets) for (let i = 0; i < 10; i++) {
    const extra = kind === 'hit' && cfg.hitDiff ? diffMask(A, B, cl[i]) : null;
    let fg = mask(img, cl[i], cfg, extra);
    // 맞았을 때 시트: 기본과 같은 픽셀은 기본 시트의 분리 결과를, 바뀐 픽셀(이펙트, 자세)만 새 결과를 쓴다
    if (extra) {
      const base = frames[i].fg, changed = dilate(extra, w, h, 2);
      const X = cl[i].x, Y = cl[i].y;
      for (let k = 0; k < w * h; k++) {
        if (!changed[k]) { fg[k] = base[k]; continue; }
        // 바뀐 영역 안에서도 드러난 남색 배경과 짙은 풀은 지운다
        const x = k % w, y = (k - x) / w, j = ((Y + y) * B.W + X + x) * 3;
        const r0 = B.data[j], g0 = B.data[j + 1], b0 = B.data[j + 2];
        if ((b0 > r0 + 15 && Math.max(r0, g0, b0) < 100 && Math.max(r0, g0, b0) >= 45) || (y > h * 0.62 && g0 > r0 + 20 && g0 > b0 + 20 && g0 < 150 && r0 < 110)) fg[k] = 0;
      }
    }
    let buf = rgba(img, cl[i], fg);
    if ((cfg.pixel || cfg.smooth) && !process.env.NOPIXEL) { const P = require('./pixel.js'); const r = cfg.smooth ? P.smooth(img, cl[i], fg, cfg.smooth) : P.pixelize(img, cl[i], fg, cfg.pixel); buf = r.buf; fg = r.fg; console.log(' ', kind, i + 1, 'grid', r.grid.join('x')); }
    frames.push({ kind, i, buf, fg });
  }
  // 장 전체 공통 영역 (모든 그림을 같은 사각형으로 잘라 위치 유지)
  let minx = w, miny = h, maxx = 0, maxy = 0;
  for (const f of frames) for (let k = 0; k < w * h; k++) if (f.fg[k]) {
    const x = k % w, y = (k - x) / w;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  const PAD = 4;
  minx = Math.max(0, minx - PAD); miny = Math.max(0, miny - PAD); maxx = Math.min(w - 1, maxx + PAD); maxy = Math.min(h - 1, maxy + PAD);
  const ew = maxx - minx + 1, eh = maxy - miny + 1;
  const files = [];
  for (const f of frames) {
    const dir = path.join(outDir, f.kind); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'f' + String(f.i + 1).padStart(2, '0') + '.png');
    await sharp(f.buf, { raw: { width: w, height: h, channels: 4 } }).extract({ left: minx, top: miny, width: ew, height: eh }).png().toFile(file);
    files.push({ file, kind: f.kind, i: f.i });
  }
  console.log('ch' + ch, 'cell', w + 'x' + h, '→ out', ew + 'x' + eh, 'frames', files.length);
  // 확인용: 분홍 배경 위에 배치
  if (prevDir) {
    const G = 12, rows = sets.length * 2;
    const comp = files.map(f => {
      const row = (f.kind === 'hit' ? 2 : 0) + Math.floor(f.i / 5);
      return { input: f.file, left: G + (f.i % 5) * (ew + G), top: G + row * (eh + G) };
    });
    await sharp({ create: { width: 5 * ew + 6 * G, height: rows * eh + (rows + 1) * G, channels: 4, background: '#ff00ff' } })
      .composite(comp).png().toFile(path.join(prevDir, 'preview_ch' + ch + '.png'));
  }
})();
