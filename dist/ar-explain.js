'use strict';
/* "Play" walkthroughs for the four printed model paths, at full scale.
 * Pressing Play lifts the printed column off the poster into a full-screen view of the real
 * architecture (published layer counts and sizes), and runs one example input through it.
 * A camera follows each step; viewers can pinch, drag or switch to an overview at any time.
 * Weights, attention values and probabilities in the example are illustrative and labelled so. */
(() => {
const NS = 'http://www.w3.org/2000/svg', WW = 640;
const plane = document.getElementById('poster-plane'), stage = document.querySelector('#scanner .ar-stage'), dialog = document.getElementById('scanner');
const net = document.getElementById('ar-net');
if (!plane || !stage || !net || !window.PosterAR) return;
const svg = net.querySelector('svg'), netTitle = net.querySelector('.ar-net-title'), netInput = net.querySelector('.ar-net-input'), netNote = net.querySelector('small'), viewBtn = document.getElementById('ar-net-view');
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const clamp = v => Math.max(0, Math.min(1, v)), ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2, lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const AREA = PosterAR.areas; // printed sections in poster units, shared with the aim-to-focus zoom (ar-camera.js)
const dim = el('svg', { id: 'ar-dim', 'aria-hidden': 'true' }); stage.insertBefore(dim, plane); const dimPath = el('path', { 'fill-rule': 'evenodd' }, dim);
const MUTED = 'rgba(255,255,255,.66)';

// ---------- world kit: sections that light up, boxes, arrows, heat maps, images ----------
function world(root, accent) {
  const secs = {}; let cur = null;
  const grow = (x, y, w, h) => { const b = cur.box; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x + w); b[3] = Math.max(b[3], y + h); };
  const k = {
    secs, accent,
    sec(name) { cur = secs[name] || (secs[name] = { g: el('g', { class: 's fut' }, root), box: [1e9, 1e9, -1e9, -1e9], flows: [], name }); return cur; },
    text(x, y, s, o = {}) { const size = o.size || 15, t = el('text', { x, y, 'text-anchor': o.anchor || 'start', 'font-size': size, 'font-weight': o.weight || 500, fill: o.fill || '#fff' }, o.parent || cur.g); t.textContent = s; const w = String(s).length * size * .56; grow(o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x, y - size, w, size * 1.3); return t; },
    box(x, y, w, h, title, sub, o = {}) {
      grow(x, y, w, h); const g = el('g', { class: o.frame ? 'frame-box' : 'bx' }, cur.g);
      el('rect', { x, y, width: w, height: h, rx: o.rx ?? 14, class: o.frame ? 'fb' : 'nb' }, g);
      if (title) { if (h < 64 && !sub) k.text(x + w / 2, y + h / 2 + 7, title, { anchor: 'middle', size: o.size || 19, weight: 700, parent: g }); else k.text(x + 18, y + 32, title, { size: o.size || 21, weight: 750, parent: g }); }
      if (sub) k.text(x + 18, y + 56, sub, { size: 15.5, fill: MUTED, parent: g });
      return g;
    },
    chip(x, y, w, h, s, o = {}) { grow(x, y, w, h); const g = el('g', { class: 'chip' + (o.cls ? ' ' + o.cls : '') }, cur.g); el('rect', { x, y, width: w, height: h, rx: o.rx ?? 10, class: 'nb' }, g); const t = k.text(x + w / 2, y + h / 2 + (o.size || 16) * .36, s, { anchor: 'middle', size: o.size || 16, weight: o.weight || 700, parent: g, fill: o.fill }); return { g, t }; },
    arrow(pts, o = {}) {
      const g = el('g', { class: 'fl' }, cur.g); if (!o.free) pts.forEach(([x, y]) => grow(x - 2, y - 2, 4, 4));
      el('polyline', { points: pts.map(p => p.join(',')).join(' '), class: o.dashed ? 'lk dash' : 'lk' }, g);
      const [a, b] = pts.slice(-2), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      el('path', { d: `M${b[0]},${b[1]} l${(-11 * Math.cos(ang - .42)).toFixed(1)},${(-11 * Math.sin(ang - .42)).toFixed(1)} M${b[0]},${b[1]} l${(-11 * Math.cos(ang + .42)).toFixed(1)},${(-11 * Math.sin(ang + .42)).toFixed(1)}`, class: 'lk' }, g);
      let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (o.label) { const keep = cur.box.slice(); k.text(o.label[0], o.label[1], o.label[2], { size: 14, fill: MUTED, anchor: o.label[3] || 'start', parent: g }); if (o.free) cur.box.splice(0, 4, ...keep); }
      cur.flows.push({ pts, L, dots: Array.from({ length: o.n || 2 }, () => el('circle', { r: 5.5, class: 'dot' }, g)) });
    },
    heat(x, y, rows, cols, cw, ch, val, o = {}) { grow(x, y, cols * cw, rows * ch); const cells = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(el('rect', { x: x + c * cw, y: y + r * ch, width: cw - (o.gap ?? 2), height: ch - (o.gap ?? 2), rx: o.rx ?? 2, fill: val(r, c) }, cur.g)); return cells; },
    image(x, y, w, h, o = {}) { grow(x, y, w, h); const img = el('image', { x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid slice', style: o.pixelated ? 'image-rendering:pixelated' : '' }, cur.g); el('rect', { x, y, width: w, height: h, rx: 8, class: 'frame' }, cur.g); return img; },
    stack(x, y, w, h, n, label) { grow(x, y, w + n * 5, h + n * 5); for (let i = n - 1; i >= 0; i--) el('rect', { x: x + i * 5, y: y + i * 5, width: w, height: h, rx: 10, class: 'nb', opacity: i ? .5 : 1 }, cur.g); if (label) k.text(x + 18, y + h / 2 + 7, label, { size: 18, weight: 700 }); },
    color(v) { const t = clamp((v + 1) / 2); return `rgb(${Math.round(lerp(80, 255, t))},${Math.round(lerp(150, 135, Math.abs(t - .5) * 2))},${Math.round(lerp(255, 100, t))})`; }
  };
  return k;
}
function pointAt(pts, d) { for (let i = 1; i < pts.length; i++) { const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= s || i === pts.length - 1) { const f = s ? Math.min(1, d / s) : 0; return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; } d -= s; } return pts[0]; }

// ---------- pixels: noise that dissolves into a real picture ----------
const pictures = {};
function loadPicture(key, src, size) {
  if (pictures[key]) return pictures[key];
  const c = document.createElement('canvas'); c.width = size; c.height = size; const p = pictures[key] = { canvas: c, data: null };
  const im = new Image(); im.src = src;
  (im.decode ? im.decode() : Promise.reject()).then(() => { const ctx = c.getContext('2d', { willReadFrequently: true }); if (!ctx || !ctx.getImageData) return; ctx.drawImage(im, 0, 0, size, size); const d = ctx.getImageData(0, 0, size, size); if (d && d.data && d.data.length === size * size * 4) p.data = d.data; }).catch(() => {});
  return p;
}
const noiseCache = {};
function noiseField(n, seed) { const key = n + ':' + seed; if (noiseCache[key]) return noiseCache[key]; const r = rng(seed), g = () => (r() + r() + r() - 1.5) * 1.15, a = new Float32Array(n * n * 3); for (let i = 0; i < n * n; i++) { const lum = g(); for (let c = 0; c < 3; c++) a[i * 3 + c] = lum * .8 + g() * .3; } return noiseCache[key] = a; }
const scratch = document.createElement('canvas');
function mixURL(pic, n, alpha, seed, noiseOnly) {
  scratch.width = n; scratch.height = n; const ctx = scratch.getContext && scratch.getContext('2d'); if (!ctx || !ctx.createImageData || !ctx.putImageData || !scratch.toDataURL) return null;
  const out = ctx.createImageData(n, n), z = noiseField(n, seed), src = pic && pic.data, size = pic ? pic.canvas.width : n, a = clamp(alpha), na = Math.sqrt(1 - a * a);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, s = ((Math.floor(y * size / n)) * size + Math.floor(x * size / n)) * 4;
    for (let c = 0; c < 3; c++) { const nv = z[(y * n + x) * 3 + c] * .5, base = src ? src[s + c] / 255 - .5 : 0; out.data[o + c] = Math.max(0, Math.min(255, 128 + 255 * (noiseOnly ? nv * na : a * base + na * nv))); } out.data[o + 3] = 255; }
  ctx.putImageData(out, 0, 0); try { return scratch.toDataURL(); } catch { return null; }
}
function setHref(img, url) { if (url && img.getAttribute('href') !== url) img.setAttribute('href', url); }
let clipFrames = null;
function loadClipFrames() {
  if (clipFrames) return clipFrames; clipFrames = [0, 1, 2, 3].map(() => ({ canvas: (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; return c; })(), data: null }));
  clipFrames.fallback = loadPicture('wan', 'assets/wan-frame.jpg', 64);
  try {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = 'assets/wan-example.mp4'; let i = 0;
    const grab = () => { const c = clipFrames[i].canvas, ctx = c.getContext('2d', { willReadFrequently: true }); if (ctx && ctx.getImageData) { ctx.drawImage(v, 0, 0, 64, 64); const d = ctx.getImageData(0, 0, 64, 64); if (d && d.data && d.data.length === 64 * 64 * 4) clipFrames[i].data = d.data; } if (++i < 4) v.currentTime = v.duration * (.08 + i * .27); };
    v.addEventListener('loadeddata', () => { v.currentTime = v.duration * .08; }, { once: true }); v.addEventListener('seeked', grab);
  } catch {}
  return clipFrames;
}
const framePic = i => (clipFrames && clipFrames[i].data ? clipFrames[i] : clipFrames && clipFrames.fallback);

// ---------- illustrative sound, synthesised on the device ----------
let audio = null; const voices = [];
const SR = 22050, chord = [[196, 0], [246.9, .32], [293.7, .64], [392, .96], [293.7, 1.28], [246.9, 1.6], [98, 0]];
const soundWave = (() => { const len = Math.floor(SR * 3.2), out = new Float32Array(len), seed = rng(42);
  for (const [f, at] of chord) { const period = Math.round(SR / f), start = Math.floor(at * SR), buf = new Float32Array(Math.floor(SR * 1.6)); for (let i = 0; i < period; i++) buf[i] = seed() * 2 - 1; for (let i = period; i < buf.length; i++) buf[i] = (buf[i - period] + buf[i - period + 1]) * .497; const g = f < 120 ? .45 : .6; for (let i = 0; i < buf.length && start + i < len; i++) out[start + i] += buf[i] * g; }
  let m = 0; for (const v of out) m = Math.max(m, Math.abs(v)); for (let i = 0; i < len; i++) out[i] /= m || 1; return out; })();
function silence() { while (voices.length) { try { voices.pop().stop(); } catch {} } }
function playSound() { if (!audio) return; try { audio.resume?.(); const b = audio.createBuffer(1, soundWave.length, SR); b.getChannelData(0).set(soundWave); const s = audio.createBufferSource(), g = audio.createGain(); g.gain.value = .22; s.buffer = b; s.connect(g).connect(audio.destination); s.start(); voices.push(s); s.onended = () => { const i = voices.indexOf(s); if (i >= 0) voices.splice(i, 1); }; } catch {} }

// ---------- the four networks: real architectures, one example input each ----------
const NETWORKS = {
  text: { name: 'Text model', model: 'GPT-2 small · 124 M weights', input: 'A musician plays', accent: '#d6a6e6', steps: [
    { phase: 'Overview', title: 'The whole network', text: 'GPT-2 small: 12 transformer blocks, 12 attention heads each, 768 numbers per token. Pinch or drag to explore; the camera follows each step.', dur: 5200, show: [], focus: 'all' },
    { phase: 'Preprocess', title: 'Tokenizer', text: '“A musician plays” is split into sub-word tokens from a vocabulary of 50,257. The leading space is part of the token (␣). IDs other than “A” (32) are examples.', dur: 5600, show: ['input', 'tok'] },
    { phase: 'Preprocess', title: 'Token + position embeddings', text: 'Each ID picks one row of 768 numbers from the token table; each position picks a row from the position table. Their sum, x₀, starts the residual stream.', dur: 6200, show: ['emb'] },
    { phase: 'Propagate', title: 'LayerNorm → Query, Key, Value', text: 'Block 1 normalises each token, then one linear layer (768 → 2,304) makes a Query, a Key and a Value for every token.', dur: 5600, show: ['ln1', 'qkv'] },
    { phase: 'Propagate', title: '12 attention heads', text: 'Each head compares Queries with the Keys of earlier tokens only—the causal mask hides the future. In head 5 here, “plays” attends to “musician” (71%).', dur: 7000, show: ['heads'] },
    { phase: 'Propagate', title: 'Combine and add', text: 'The 12 head outputs (64 numbers each) are joined, projected back to 768 and added onto the residual stream.', dur: 5000, show: ['proj'] },
    { phase: 'Propagate', title: 'MLP', text: 'Each token then passes through a 768 → 3,072 → 768 network with a GELU curve, and is added to the stream again. That is one block.', dur: 6000, show: ['mlp'] },
    { phase: 'Propagate', title: '11 more blocks', text: 'Blocks 2–12 repeat the same structure with different weights, refining the vector for “plays” layer by layer.', dur: 6000, show: ['stack'] },
    { phase: 'Result', title: 'A score for every token', text: 'A final LayerNorm and the unembedding (768 → 50,257, sharing weights with the token table) give one score—a logit—for every token in the vocabulary.', dur: 5800, show: ['headout'] },
    { phase: 'Result', title: 'Softmax and pick', text: 'Softmax turns the logits into probabilities: ␣guitar 41%, ␣piano 23%, ␣violin 12%… The model picks ␣guitar.', dur: 6000, show: ['soft'] },
    { phase: 'Result', title: 'Append and repeat', text: '“A musician plays guitar”. The new token is appended; a key–value cache keeps earlier work, and the network runs again for the next token.', dur: 6000, show: ['out'], focus: 'all' }],
    build(k) {
      const R = rng(7);
      k.sec('input'); k.chip(150, 18, 340, 58, '“A musician plays”', { size: 26 }); k.arrow([[320, 76], [320, 112]]);
      k.sec('tok'); k.box(20, 112, 600, 196, 'BPE tokenizer', 'text → sub-word tokens · vocabulary 50,257');
      [['A', 50, 90, '32'], ['␣musician', 160, 220, '15742'], ['␣plays', 400, 170, '5341']].forEach(([s, x, w, id]) => { k.chip(x, 186, w, 52, s, { size: 21 }); k.text(x + w / 2, 268, 'id ' + id, { anchor: 'middle', size: 15, fill: MUTED }); });
      k.text(320, 296, '(IDs except “A” are examples)', { anchor: 'middle', size: 13, fill: 'rgba(255,255,255,.45)' });
      k.sec('emb'); k.arrow([[320, 308], [320, 340]]);
      k.box(20, 340, 290, 210, 'Token embedding', 'wte · 50,257 × 768'); k.box(330, 340, 290, 210, 'Position embedding', 'wpe · 1,024 × 768');
      for (const [x0, hl] of [[40, [3, 7, 10]], [350, [0, 1, 2]]]) for (let r = 0; r < 12; r++) el('rect', { x: x0, y: 412 + r * 10, width: 250, height: 7, rx: 2, fill: hl.includes(r) ? k.accent : 'rgba(255,255,255,.14)' }, k.sec('emb').g);
      k.chip(296, 568, 48, 48, '+', { size: 28, rx: 24 }); k.arrow([[165, 550], [165, 592], [296, 592]]); k.arrow([[475, 550], [475, 592], [344, 592]]);
      const x0vals = [0, 1, 2].map(() => Array.from({ length: 32 }, () => R() * 2 - 1));
      k.text(120, 650, 'x₀ · 3 tokens × 768 (32 shown)', { size: 15, fill: MUTED }); const x0 = k.heat(120, 660, 3, 32, 12.5, 14, (r, c) => k.color(x0vals[r][c])); k.arrow([[320, 616], [320, 658]]);
      // residual stream runs down the left edge through every block
      el('line', { x1: 30, y1: 712, x2: 30, y2: 2196, class: 'stream' }, k.sec('emb').g); k.text(42, 734, 'residual stream', { size: 14, fill: MUTED }); k.arrow([[120, 690], [30, 690], [30, 712]]);
      k.sec('blk'); k.box(52, 752, 576, 1290, 'Transformer block 1 / 12', '', { frame: true });
      k.sec('ln1'); k.box(76, 800, 528, 52, 'LayerNorm'); k.arrow([[30, 826], [76, 826]]);
      k.sec('qkv'); k.arrow([[340, 852], [340, 878]]); k.box(76, 878, 528, 82, 'Linear 768 → 2,304', 'one projection makes Query, Key and Value');
      [['Q', 96], ['K', 266], ['V', 436]].forEach(([s, x]) => { k.chip(x, 980, 150, 50, s + ' · 3 × 768', { size: 17 }); k.arrow([[x + 75, 960], [x + 75, 980]]); });
      k.sec('heads'); k.text(76, 1062, 'split into 12 heads × 64 numbers', { size: 16, weight: 700 }); k.text(76, 1086, 'softmax( Q·Kᵀ / √64 + causal mask ) · V', { size: 15, fill: MUTED });
      const heads = []; for (let h = 0; h < 12; h++) { const c = h % 4, r = Math.floor(h / 4), x = 84 + c * 132, y = 1104 + r * 150;
        let M = [[1, null, null], [null, null, null], [null, null, null]]; const a = .2 + R() * .6; M[1] = [a, 1 - a, null]; const b1 = R(), b2 = R(), b3 = R(), sb = b1 + b2 + b3; M[2] = [b1 / sb, b2 / sb, b3 / sb]; if (h === 4) M[2] = [.08, .71, .21];
        k.text(x + 54, y + 14, 'head ' + (h + 1), { anchor: 'middle', size: 14, weight: 700, fill: h === 4 ? k.accent : '#fff' });
        heads.push(M.map((row, i) => row.map((v, j) => el('rect', { x: x + j * 36, y: y + 22 + i * 36, width: 34, height: 34, rx: 4, fill: v == null ? 'rgba(255,255,255,.05)' : k.accent, 'fill-opacity': v == null ? 1 : (.12 + v * .88).toFixed(2) }, k.sec('heads').g))));
        if (h === 4) [['.08', 0], ['.71', 1], ['.21', 2]].forEach(([s, j]) => k.text(x + j * 36 + 17, y + 22 + 2 * 36 + 23, s, { anchor: 'middle', size: 12, weight: 800 })); }
      k.text(84, 1568, 'rows: A · musician · plays   columns: the tokens they may look at', { size: 13.5, fill: MUTED });
      k.sec('proj'); k.box(76, 1588, 528, 80, 'Concat 12 × 64 → Linear 768 → 768', 'then add to the residual stream'); k.arrow([[76, 1628], [30, 1628]], { label: [40, 1620, '⊕'] });
      k.sec('mlp'); k.box(76, 1690, 528, 52, 'LayerNorm'); k.arrow([[340, 1742], [340, 1766]]);
      k.box(76, 1766, 528, 260, 'MLP', 'Linear 768 → 3,072 · GELU · Linear 3,072 → 768');
      const L1 = [0, 1, 2, 3, 4, 5].map(i => [170, 1840 + i * 30]), L2 = Array.from({ length: 12 }, (_, i) => [340, 1832 + i * 15.5]), L3 = L1.map(([, y]) => [510, y]);
      const mg = k.sec('mlp').g; for (const [a, b] of [[L1, L2], [L2, L3]]) for (const p of a) for (const q of b) el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: 'wire' }, mg);
      [...L1, ...L3].forEach(([x, y]) => el('circle', { cx: x, cy: y, r: 7, class: 'neuron' }, mg)); L2.forEach(([x, y]) => el('circle', { cx: x, cy: y, r: 5, class: 'neuron' }, mg));
      k.text(170, 2014, '768', { anchor: 'middle', size: 14, fill: MUTED }); k.text(340, 2014, '3,072 · GELU', { anchor: 'middle', size: 14, fill: MUTED }); k.text(510, 2014, '768', { anchor: 'middle', size: 14, fill: MUTED });
      k.arrow([[76, 1900], [30, 1900]], { label: [40, 1892, '⊕'] });
      k.sec('stack'); k.stack(52, 2068, 560, 70, 10, 'Blocks 2 – 12'); const layer = k.text(600, 2112, 'block 2', { anchor: 'end', size: 18, weight: 800, fill: k.accent });
      k.text(70, 2176, 'same structure · different weights', { size: 15, fill: MUTED }); const xl = k.heat(120, 2196, 1, 32, 12.5, 16, c => k.color(x0vals[2][c])); k.text(70, 2209, '“plays”', { size: 14, fill: MUTED });
      k.sec('headout'); k.arrow([[320, 2216], [320, 2246]]); k.box(20, 2246, 600, 52, 'Final LayerNorm'); k.arrow([[320, 2298], [320, 2322]]);
      k.box(20, 2322, 600, 84, 'Unembedding · Linear 768 → 50,257', 'shares its weights with the token table');
      k.text(40, 2438, 'logits: one score for each of 50,257 tokens', { size: 15, fill: MUTED }); const logits = k.heat(40, 2450, 1, 56, 10, 26, c => `rgba(255,255,255,${(.1 + R() * .5).toFixed(2)})`, { gap: 1.5 });
      k.sec('soft'); k.arrow([[320, 2480], [320, 2510]]); k.text(320, 2538, 'softmax → probabilities', { anchor: 'middle', size: 18, weight: 750 });
      const probs = [['␣guitar', .41], ['␣piano', .23], ['␣violin', .12], ['␣drums', .08], ['␣music', .05], ['50,252 others', .11]];
      const bars = probs.map(([w, p], i) => { k.text(160, 2578 + i * 38, w, { anchor: 'end', size: 17, weight: i ? 600 : 800, fill: i === 5 ? MUTED : '#fff' }); const b = el('rect', { x: 172, y: 2560 + i * 38, width: 0, height: 24, rx: 5, fill: i ? 'rgba(255,255,255,.4)' : k.accent }, k.sec('soft').g); const t = k.text(180, 2578 + i * 38, Math.round(p * 100) + '%', { size: 15, weight: 800 }); return { b, t, p }; });
      k.chip(170, 2800, 300, 52, 'pick ␣guitar', { size: 20, cls: 'hot' });
      k.sec('out'); k.arrow([[320, 2852], [320, 2880]]); k.text(320, 2918, 'A musician plays guitar', { anchor: 'middle', size: 30, weight: 800 });
      k.arrow([[490, 2900], [632, 2900], [632, 212], [620, 212]], { free: true, dashed: true, n: 4, label: [626, 2880, 'append · repeat', 'end'] });
      return { update(si, p) {
        layer.textContent = `block ${si < 7 ? 2 : si > 7 ? 12 : 2 + Math.floor(ease(p) * 10)}`;
        const mix = si < 7 ? 0 : si > 7 ? 1 : ease(p); xl.forEach((r, c) => r.setAttribute('fill', k.color(lerp(x0vals[2][c], Math.sin(c * 1.7) * .9, mix))));
        bars.forEach(({ b, t, p: pr }) => { const w = (si > 9 ? 1 : si === 9 ? ease(clamp(p * 1.5)) : 0) * pr / .41 * 380; b.setAttribute('width', w.toFixed(1)); t.setAttribute('x', (180 + w).toFixed(1)); t.setAttribute('opacity', w ? 1 : 0); });
      } };
    } },
  image: { name: 'Image model', model: 'Stable Diffusion 1.5 · 1.07 B weights', input: 'Armoured figure in a forest', accent: '#9cc8ff', steps: [
    { phase: 'Overview', title: 'Three networks working together', text: 'A text encoder (CLIP, 123 M weights), a denoising U-Net (860 M) and a VAE decoder. Pinch or drag to explore; the camera follows each step.', dur: 5200, show: [], focus: 'all' },
    { phase: 'Preprocess', title: 'Tokenize the prompt', text: 'The prompt becomes tokens between start and end markers, padded to exactly 77.', dur: 5000, show: ['input', 'cliptok'] },
    { phase: 'Preprocess', title: 'CLIP text encoder', text: '12 transformer layers turn the 77 tokens into 77 × 768 numbers. An empty prompt is encoded too, for guidance later.', dur: 5600, show: ['clipenc'] },
    { phase: 'Preprocess', title: 'Start from noise', text: 'The picture starts as random numbers: a 4 × 64 × 64 latent (one-eighth of 512 pixels per side). A timestep embedding tells the U-Net how noisy it is.', dur: 5800, show: ['noise'] },
    { phase: 'Propagate', title: 'U-Net down path', text: 'Four down blocks halve the size each time—64 → 32 → 16 → 8—while widening from 320 to 1,280 channels.', dur: 6000, show: ['down'] },
    { phase: 'Propagate', title: 'Inside a block: cross-attention', text: 'Each of the 16 transformers lets image positions attend to each other, then to the 77 text tokens (cross-attention), then applies a feed-forward layer.', dur: 6800, show: ['inside'] },
    { phase: 'Propagate', title: 'Mid and up path, skip connections', text: 'The mid block works at 8 × 8; the up blocks grow back to 64 × 64, joining the down path’s features through skip connections. Output: predicted noise ε̂.', dur: 6400, show: ['mid', 'up'], focus: ['down', 'mid', 'up'] },
    { phase: 'Propagate', title: 'Classifier-free guidance', text: 'The U-Net runs with the prompt and with the empty prompt. Their difference is amplified 7.5×, pushing the picture toward the text.', dur: 6000, show: ['cfg'] },
    { phase: 'Propagate', title: 'Scheduler: repeat 30 steps', text: 'The scheduler removes part of the predicted noise and the loop repeats—30 steps here. Watch the latent turn into the figure.', dur: 8400, show: ['sched', 'noise'], focus: ['noise', 'sched'] },
    { phase: 'Result', title: 'VAE decoder', text: 'The clean 4 × 64 × 64 latent is upsampled three times (64 → 128 → 256 → 512) into a 3 × 512 × 512 picture.', dur: 6000, show: ['vae'] }],
    build(k) {
      const pic = loadPicture('wan', 'assets/wan-frame.jpg', 128);
      k.sec('input'); k.chip(80, 18, 480, 58, '“Armoured figure in a forest”', { size: 23 }); k.arrow([[320, 76], [320, 112]]);
      k.sec('cliptok'); k.box(20, 112, 600, 190, 'CLIP tokenizer', 'padded to 77 tokens');
      ['<start>', 'armoured', 'figure', 'in', 'a', 'forest', '<end>', '<pad> ×70'].forEach((s, i) => k.chip(40 + (i % 4) * 146, 186 + Math.floor(i / 4) * 54, 136, 44, s, { size: 16 }));
      k.sec('clipenc'); k.arrow([[320, 302], [320, 330]]); k.box(20, 330, 600, 250, 'CLIP text encoder', '12 transformer layers · width 768'); k.stack(40, 400, 330, 50, 12, '12 layers');
      k.text(40, 506, 'output: 77 × 768', { size: 15, fill: MUTED }); k.heat(40, 516, 4, 48, 11, 9, (r, c) => k.color(Math.sin(r * 3 + c * .7) * .9)); k.text(600, 474, '+ empty prompt', { anchor: 'end', size: 15, fill: MUTED }); k.text(600, 494, '→ 77 × 768', { anchor: 'end', size: 15, fill: MUTED });
      k.sec('noise'); k.arrow([[320, 580], [320, 610]]);
      const lat = k.image(40, 620, 220, 220, { pixelated: true }); k.text(150, 870, 'latent z · 4 × 64 × 64', { anchor: 'middle', size: 16, weight: 700 }); const stepTxt = k.text(150, 894, 'pure noise', { anchor: 'middle', size: 16, weight: 800, fill: k.accent });
      k.box(290, 620, 330, 130, 'Timestep', 'sinusoidal 320 → MLP → 1,280'); const tTxt = k.text(600, 652, 't = 999', { anchor: 'end', size: 19, weight: 800, fill: k.accent });
      k.text(300, 790, 'added inside every ResNet block', { size: 14, fill: MUTED });
      k.sec('unet'); k.box(20, 930, 600, 990, 'U-Net · 860 M weights', '', { frame: true }); k.arrow([[150, 900], [150, 990]]);
      k.sec('down'); const D = [[40, 990, 260, 'Down 1 · 320 ch', '64×64 · Res×2 + Transf.×2'], [40, 1090, 240, 'Down 2 · 640 ch', '32×32 · Res×2 + Transf.×2'], [40, 1190, 220, 'Down 3 · 1,280 ch', '16×16 · Res×2 + Transf.×2'], [40, 1290, 200, 'Down 4 · 1,280', '8×8 · Res×2']];
      D.forEach(([x, y, w, t, s], i) => { k.box(x, y, w, 82, t, s, { size: 18 }); if (i < 3) k.arrow([[x + 60, y + 82], [x + 60, y + 100]]); });
      k.sec('mid'); k.box(170, 1390, 300, 82, 'Mid · 1,280 · 8×8', 'Res · Transformer · Res', { size: 18 }); k.arrow([[100, 1372], [100, 1430], [170, 1430]]);
      k.sec('up'); const U = [[340, 990, 260, 'Up 4 · 320 ch', '64×64 · Res×3 + Transf.×3'], [360, 1090, 240, 'Up 3 · 640 ch', '32×32 · Res×3 + Transf.×3'], [380, 1190, 220, 'Up 2 · 1,280 ch', '16×16 · Res×3 + Transf.×3'], [400, 1290, 200, 'Up 1 · 1,280', '8×8 · Res×3']];
      U.forEach(([x, y, w, t, s], i) => { k.box(x, y, w, 82, t, s, { size: 18 }); if (i < 3) k.arrow([[x + w - 60, y + 100], [x + w - 60, y + 82]]); });
      k.arrow([[470, 1430], [540, 1430], [540, 1372]]); D.forEach(([x, y, w], i) => k.arrow([[x + w, y + 70], [U[i][0], y + 70]], { dashed: true, n: 1 })); k.text(320, 1076, 'skip connections', { anchor: 'middle', size: 13, fill: MUTED });
      k.chip(340, 1490, 260, 44, 'conv_out → ε̂ · 4 × 64 × 64', { size: 15 }); k.arrow([[470, 1072], [470, 1060], [612, 1060], [612, 1512], [600, 1512]], { free: true });
      k.sec('inside'); k.box(40, 1556, 560, 340, 'Inside each of the 16 transformers', ''); const steps4 = [['ResNet block', '+ timestep embedding'], ['Self-attention', 'image positions look at each other'], ['Cross-attention', 'Q from image · K, V from the 77 text tokens'], ['Feed-forward (GEGLU)', '']];
      steps4.forEach(([t, s], i) => { k.box(60, 1610 + i * 70, 520, 58, t, s, { size: 17 }); if (i) k.arrow([[320, 1610 + i * 70 - 12], [320, 1610 + i * 70]]); });
      k.arrow([[30, 560], [10, 560], [10, 1770], [60, 1770]], { free: true, dashed: true, n: 3, label: [16, 1760, 'text'] });
      k.sec('cfg'); k.arrow([[470, 1534], [470, 1556]]); k.box(20, 1940, 600, 300, 'Classifier-free guidance', 'scale 7.5');
      const cfgImgs = [[44, 'ε empty'], [236, 'ε prompt'], [428, 'ε̂ guided']].map(([x, s]) => { const im = k.image(x, 2016, 168, 140, { pixelated: true }); k.text(x + 84, 2180, s, { anchor: 'middle', size: 15, weight: 700 }); return im; });
      k.text(320, 2220, 'ε̂ = ε_empty + 7.5 · (ε_prompt − ε_empty)', { anchor: 'middle', size: 17, weight: 700, fill: k.accent });
      k.sec('sched'); k.arrow([[320, 2240], [320, 2268]]); k.box(20, 2268, 600, 110, 'Scheduler step', 'remove part of ε̂ from z · repeat'); const sTxt = k.text(600, 2300, 'step 0 / 30', { anchor: 'end', size: 19, weight: 800, fill: k.accent });
      k.arrow([[20, 2324], [4, 2324], [4, 730], [40, 730]], { free: true, dashed: true, n: 4 });
      k.sec('vae'); k.arrow([[320, 2378], [320, 2410]]); k.box(20, 2410, 600, 400, 'VAE decoder', '4 × 64 × 64 → 3 × 512 × 512 · upsample ×2 three times');
      [['512 ch · 64²', 130], ['512 ch · 128²', 170], ['256 ch · 256²', 210], ['128 ch · 512²', 250]].forEach(([s, w], i) => { k.chip(40, 2480 + i * 76, w, 54, s, { size: 15 }); if (i) k.arrow([[90, 2480 + i * 76 - 22], [90, 2480 + i * 76]]); });
      const fin = k.image(320, 2480, 280, 280); k.text(460, 2790, '512 × 512 picture', { anchor: 'middle', size: 16, weight: 700 }); k.arrow([[290, 2735], [320, 2700]]);
      let last = '';
      return { update(si, p) {
        const steps = si < 8 ? 0 : si > 8 ? 30 : Math.max(1, Math.round(ease(p) * 30)), a = steps / 30, key = steps + ':' + !!pic.data + si;
        stepTxt.textContent = si < 8 ? 'pure noise' : `step ${steps} / 30`; sTxt.textContent = `step ${steps} / 30`; tTxt.textContent = 't = ' + Math.round(999 * (1 - a));
        if (key !== last) { last = key; setHref(lat, mixURL(pic, 48, Math.sqrt(a) * .97, 3)); cfgImgs.forEach((im, i) => setHref(im, mixURL(null, 32, a * .9, 20 + i, true))); }
        if (si >= 9 && pic.data && !fin.getAttribute('href')) fin.setAttribute('href', 'assets/wan-frame.jpg'); fin.setAttribute('opacity', si >= 9 ? clamp(p * 2) : 0);
      } };
    } },
  video: { name: 'Video model', model: 'Wan 2.2 A14B · two 14 B experts', input: 'Armoured figure turns', accent: '#b9e08c', steps: [
    { phase: 'Overview', title: 'The whole network', text: 'A text encoder, a 40-block diffusion transformer (two expert copies) and a 3-D video VAE. Pinch or drag to explore; the camera follows each step.', dur: 5200, show: [], focus: 'all' },
    { phase: 'Preprocess', title: 'umT5 text encoder', text: '“Armoured figure turns” is encoded by umT5 (24 layers, width 4,096) into text tokens the video model can attend to.', dur: 5400, show: ['input', 'text'] },
    { phase: 'Preprocess', title: 'A noisy video latent', text: 'An 81-frame 480 × 832 clip is represented as a 16 × 21 × 60 × 104 latent: the VAE compresses 4× in time and 8 × 8 in space. It starts as noise.', dur: 6400, show: ['latent'] },
    { phase: 'Preprocess', title: 'Patchify into tokens', text: '1 × 2 × 2 patches turn the latent into 21 × 30 × 52 = 32,760 tokens, each embedded as 5,120 numbers.', dur: 5800, show: ['patch'] },
    { phase: 'Preprocess', title: 'Timestep modulation', text: 'The noise level becomes six modulation vectors (shift, scale, gate) shared by all 40 blocks.', dur: 5000, show: ['time'] },
    { phase: 'Propagate', title: '3-D self-attention', text: 'In each block, every token can attend to all 32,760: in its own frame (space) and across frames (time), located by 3-D rotary positions. 40 heads.', dur: 7200, show: ['sa'] },
    { phase: 'Propagate', title: 'Cross-attention to the text', text: 'Video tokens ask the text tokens what to draw: Queries from the video, Keys and Values from umT5.', dur: 5600, show: ['ca'] },
    { phase: 'Propagate', title: 'Feed-forward, then 39 more blocks', text: 'A 5,120 → 13,824 → 5,120 feed-forward layer finishes the block; 39 more blocks repeat it. A head turns tokens back into a 16 × 21 × 60 × 104 velocity.', dur: 6400, show: ['ffn', 'stack', 'headv'], focus: ['ffn', 'stack', 'headv'] },
    { phase: 'Propagate', title: 'Sampler with two experts', text: 'A flow-matching sampler moves the latent along the predicted velocity—40 steps here. Early, noisy steps use the high-noise expert; later steps switch to the low-noise expert.', dur: 8400, show: ['sampler', 'latent'], focus: ['latent', 'sampler'] },
    { phase: 'Result', title: 'Wan-VAE decodes the clip', text: '3-D causal convolutions expand 21 latent frames to 81 frames at 480 × 832. Shown: frames from the real Wan example clip.', dur: 6400, show: ['vae'] }],
    build(k) {
      loadClipFrames();
      k.sec('input'); k.chip(110, 18, 420, 58, '“Armoured figure turns”', { size: 24 }); k.arrow([[320, 76], [320, 112]]);
      k.sec('text'); k.box(20, 112, 600, 250, 'umT5 text encoder', '24 layers · width 4,096 · up to 512 tokens'); ['armoured', 'figure', 'turns', '</s>'].forEach((s, i) => k.chip(40 + i * 146, 186, 136, 44, s, { size: 16 }));
      k.stack(40, 252, 330, 46, 10, '24 layers'); k.text(600, 300, '→ text tokens × 4,096', { anchor: 'end', size: 15, fill: MUTED });
      k.sec('latent'); k.arrow([[320, 362], [320, 392]]); k.box(20, 392, 600, 300, 'Noisy video latent', '16 × 21 × 60 × 104 · channels × time × height × width');
      const fr = [0, 1, 2, 3].map(i => { const im = k.image(48 + i * 140, 470, 124, 124, { pixelated: true }); k.text(110 + i * 140, 616, ['t 1', 't 7', 't 14', 't 21'][i], { anchor: 'middle', size: 14, fill: MUTED }); return im; });
      k.text(40, 660, '81 frames 480 × 832 ↔ 21 latent frames (4× time, 8 × 8 space)', { size: 14.5, fill: MUTED }); const vStep = k.text(600, 424, 'noise', { anchor: 'end', size: 18, weight: 800, fill: k.accent });
      k.sec('patch'); k.arrow([[320, 692], [320, 722]]); k.box(20, 722, 600, 250, 'Patchify 1 × 2 × 2 + linear', '21 × 30 × 52 = 32,760 tokens × 5,120');
      for (let f = 0; f < 3; f++) k.heat(44 + f * 196, 800, 6, 10, 17, 17, () => 'rgba(185,224,140,.5)', { rx: 3 }); k.text(600, 950, '… 21 time slices', { anchor: 'end', size: 14, fill: MUTED });
      k.sec('time'); k.arrow([[320, 972], [320, 1000]]); k.box(20, 1000, 600, 100, 'Timestep → 6 modulation vectors', 'shift · scale · gate for each sub-layer, shared by all blocks');
      k.sec('blk'); k.box(20, 1130, 600, 930, 'DiT block 1 / 40 · width 5,120', '', { frame: true });
      k.sec('sa'); k.box(40, 1186, 560, 440, '3-D self-attention · 40 heads', 'every token sees all 32,760 · 3-D rotary positions');
      const T = []; for (let f = 0; f < 4; f++) for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const x = 60 + f * 132 + c * 23, y = 1290 + r * 23; T.push({ f, r, c, x: x + 10, y: y + 10, e: el('rect', { x, y, width: 20, height: 20, rx: 4, class: 'tok' }, k.sec('sa').g) }); }
      [0, 1, 2, 3].forEach(f => k.text(118 + f * 132, 1400, 'frame ' + [1, 7, 14, 21][f], { anchor: 'middle', size: 13, fill: MUTED }));
      const q = T.find(t => t.f === 1 && t.r === 1 && t.c === 2); q.e.setAttribute('class', 'tok q');
      const lg = el('g', {}, k.sec('sa').g); T.forEach(t => { if (t === q || (t.f !== q.f && !(t.r === q.r && t.c === q.c))) return; const time = t.f !== q.f; el('path', { d: time ? `M${q.x},${q.y} Q${(q.x + t.x) / 2},${q.y + 120} ${t.x},${t.y}` : `M${q.x},${q.y} L${t.x},${t.y}`, fill: 'none', stroke: time ? '#ffd27a' : k.accent, 'stroke-width': time ? 3.5 : 1.6, opacity: time ? .95 : .7 }, lg); });
      el('circle', { cx: 70, cy: 1540, r: 7, fill: k.accent }, k.sec('sa').g); k.text(84, 1546, 'space: same frame', { size: 15 }); el('circle', { cx: 300, cy: 1540, r: 7, fill: '#ffd27a' }, k.sec('sa').g); k.text(314, 1546, 'time: same spot, other frames', { size: 15 });
      k.text(60, 1590, 'adaLN modulate → attention → gate → add', { size: 14, fill: MUTED });
      k.sec('ca'); k.arrow([[320, 1626], [320, 1650]]); k.box(40, 1650, 560, 130, 'Cross-attention to the text', 'Q from video tokens · K, V from umT5 tokens'); k.arrow([[620, 300], [632, 300], [632, 1716], [600, 1716]], { free: true, dashed: true, n: 3 });
      k.sec('ffn'); k.arrow([[320, 1780], [320, 1806]]); k.box(40, 1806, 560, 120, 'Feed-forward', '5,120 → 13,824 → 5,120 · gate → add'); k.text(60, 1990, 'every sub-layer: modulated norm, then a gated residual add', { size: 14, fill: MUTED });
      k.sec('stack'); k.arrow([[320, 2060], [320, 2088]]); k.stack(20, 2088, 580, 72, 10, 'Blocks 2 – 40'); const blockTxt = k.text(590, 2132, 'block 2', { anchor: 'end', size: 18, weight: 800, fill: k.accent });
      k.sec('headv'); k.arrow([[320, 2212], [320, 2238]]); k.box(20, 2238, 600, 96, 'Head → unpatchify', 'predicts a velocity · 16 × 21 × 60 × 104');
      k.sec('sampler'); k.arrow([[320, 2334], [320, 2362]]); k.box(20, 2362, 600, 250, 'Flow-matching sampler', 'z ← z + Δt · velocity · repeat');
      const hi = k.chip(40, 2440, 270, 64, 'High-noise expert', { size: 17 }), lo = k.chip(330, 2440, 270, 64, 'Low-noise expert', { size: 17 });
      k.text(175, 2530, 'early steps · layout, motion', { anchor: 'middle', size: 14, fill: MUTED }); k.text(465, 2530, 'late steps · detail', { anchor: 'middle', size: 14, fill: MUTED });
      el('rect', { x: 40, y: 2556, width: 560, height: 12, rx: 6, fill: 'rgba(255,255,255,.12)' }, k.sec('sampler').g); const prog = el('rect', { x: 40, y: 2556, width: 0, height: 12, rx: 6, fill: k.accent }, k.sec('sampler').g); const sTxt = k.text(600, 2394, 'step 0 / 40', { anchor: 'end', size: 18, weight: 800, fill: k.accent });
      k.arrow([[20, 2490], [6, 2490], [6, 530], [48, 530]], { free: true, dashed: true, n: 4 });
      k.sec('vae'); k.arrow([[320, 2612], [320, 2640]]); k.box(20, 2640, 600, 420, 'Wan-VAE decoder', '3-D causal convolutions · 21 → 81 frames · 60 × 104 → 480 × 832');
      const outF = [0, 1, 2, 3].map(i => k.image(40 + i * 142, 2720, 132, 100)); const clip = k.image(140, 2846, 360, 190); const clipTxt = k.text(320, 3060, 'clip', { anchor: 'middle', size: 15, weight: 700 });
      let last = '';
      return { update(si, p, now) {
        const total = 40, steps = si < 8 ? 0 : si > 8 ? total : Math.max(1, Math.round(ease(p) * total)), a = steps / total, ready = [0, 1, 2, 3].map(i => !!(framePic(i) && framePic(i).data)).join(''), key = steps + ready + si;
        sTxt.textContent = `step ${steps} / ${total}`; prog.setAttribute('width', (560 * a).toFixed(1)); vStep.textContent = steps ? `step ${steps} / ${total}` : 'noise';
        const highOn = si === 8 && steps <= 20; hi.g.setAttribute('class', 'chip' + (highOn ? ' hot' : '')); lo.g.setAttribute('class', 'chip' + (si === 8 && steps > 20 ? ' hot' : ''));
        blockTxt.textContent = `block ${si < 7 ? 2 : si > 7 ? 40 : 2 + Math.floor(ease(p) * 38)}`;
        if (key !== last) { last = key; fr.forEach((im, i) => setHref(im, mixURL(framePic(i), 32, Math.sqrt(a) * .97, 11 + i))); if (si >= 9) outF.forEach((im, i) => setHref(im, mixURL(framePic(i), 64, 1, 1))); }
        if (si >= 9) { const i = Math.floor(now / 260) % 4; if (clip.cur !== i) { clip.cur = i; setHref(clip, mixURL(framePic(i), 64, 1, 1)); clipTxt.textContent = `clip · frame ${i + 1} / 4 shown`; } }
      } };
    } },
  audio: { name: 'Audio model', model: 'MusicGen-small · 300 M weights', input: 'Gentle guitar music', accent: '#f2d27c', steps: [
    { phase: 'Overview', title: 'The whole network', text: 'A T5 text encoder, a 24-block transformer decoder that writes audio codes, and the EnCodec decoder that turns codes into sound. Pinch or drag to explore.', dur: 5200, show: [], focus: 'all' },
    { phase: 'Preprocess', title: 'T5 text encoder', text: '“Gentle guitar music” is encoded by T5 (12 layers, width 768) and projected to the decoder’s width, 1,024.', dur: 5400, show: ['input', 'text'] },
    { phase: 'Preprocess', title: 'Codes so far, delay pattern', text: 'Sound is stored as 4 streams of codes (2,048 possible values each), 50 per second. Stream k is shifted k steps later so coarse codes come first.', dur: 6400, show: ['codes'] },
    { phase: 'Preprocess', title: 'Sum of 4 embeddings', text: 'At each step, the 4 codes are looked up in 4 tables (2,048 × 1,024) and added into one input vector.', dur: 5000, show: ['embed'] },
    { phase: 'Propagate', title: 'Causal self-attention', text: 'In each block, 16 heads let the current step look back at earlier steps only—never ahead.', dur: 5800, show: ['sa'] },
    { phase: 'Propagate', title: 'Cross-attention to the text', text: 'The audio steps then attend to the T5 text states, so “gentle guitar” shapes every code.', dur: 5400, show: ['ca'] },
    { phase: 'Propagate', title: 'Feed-forward, then 23 more blocks', text: 'A 1,024 → 4,096 → 1,024 feed-forward layer finishes the block; 23 more blocks repeat it.', dur: 5800, show: ['ffn', 'stack'], focus: ['ffn', 'stack'] },
    { phase: 'Result', title: '4 heads pick 4 codes', text: 'Four linear heads (1,024 → 2,048) score every possible code; top-k sampling (k = 250) picks one per stream.', dur: 6000, show: ['heads'] },
    { phase: 'Result', title: 'Repeat 500 times', text: 'The new codes are appended and the decoder runs again: about 500 steps for a 10-second clip.', dur: 6400, show: ['loop', 'codes'], focus: ['codes', 'loop'] },
    { phase: 'Result', title: 'EnCodec decoder → sound', text: 'The 4 codes per step are turned back into vectors and summed; convolutions upsample ×8 ×5 ×4 ×4 = ×640 to 32,000 samples per second. Listen: this sound is synthesised on your phone for illustration, not model output.', dur: 7600, show: ['enc', 'wave'], focus: ['enc', 'wave'], sound: true }],
    build(k) {
      const R = rng(5), codes = [0, 1, 2, 3].map(() => Array.from({ length: 12 }, () => String(Math.floor(R() * 2048))));
      k.sec('input'); k.chip(130, 18, 380, 58, '“Gentle guitar music”', { size: 24 }); k.arrow([[320, 76], [320, 112]]);
      k.sec('text'); k.box(20, 112, 600, 230, 'T5 text encoder', 't5-base · 12 layers · 768 → projected to 1,024'); ['Gentle', 'guitar', 'music', '</s>'].forEach((s, i) => k.chip(40 + i * 146, 186, 136, 44, s, { size: 16 }));
      k.stack(40, 252, 330, 46, 10, '12 layers'); k.text(600, 300, '→ text states × 1,024', { anchor: 'end', size: 15, fill: MUTED });
      k.sec('codes'); k.box(20, 372, 600, 320, 'Audio codes so far', '4 codebooks × 2,048 values · 50 steps per second');
      const cells = []; ['coarse 1', '2', '3', 'fine 4'].forEach((s, r) => { k.text(96, 476 + r * 46, s, { anchor: 'end', size: 14, fill: MUTED });
        for (let c = 0; c < 10; c++) { const x = 104 + c * 50, y = 452 + r * 46, g = el('g', {}, k.sec('codes').g); const rr = el('rect', { x, y, width: 46, height: 40, rx: 6, class: 'code' }, g), t = k.text(x + 23, y + 26, codes[r][c], { anchor: 'middle', size: 13, weight: 800, parent: g }); cells.push({ r, c, rr, t }); } });
      k.text(104, 660, 'stream k starts k steps later (delay pattern)', { size: 14, fill: MUTED }); const stepT = k.text(600, 404, 'step 3', { anchor: 'end', size: 18, weight: 800, fill: k.accent });
      k.sec('embed'); k.arrow([[320, 692], [320, 720]]); k.box(20, 720, 600, 100, 'Sum of 4 code embeddings', '4 tables of 2,048 × 1,024 → one 1,024-d input');
      k.sec('blk'); k.box(20, 850, 600, 640, 'Decoder block 1 / 24 · width 1,024', '', { frame: true });
      k.sec('sa'); k.box(40, 906, 560, 200, 'Causal self-attention · 16 heads', 'looks back at earlier steps only'); k.heat(60, 990, 1, 10, 52, 34, c => c < 7 ? `rgba(242,210,124,${(.15 + Math.abs(Math.sin(c * 2.1)) * .75).toFixed(2)})` : 'rgba(255,255,255,.05)', { rx: 5 }); k.text(60, 1060, 'current step → earlier steps (later ones masked)', { size: 14, fill: MUTED });
      k.sec('ca'); k.arrow([[320, 1106], [320, 1130]]); k.box(40, 1130, 560, 130, 'Cross-attention to the text', 'Q from audio steps · K, V from T5 states'); k.arrow([[620, 300], [632, 300], [632, 1196], [600, 1196]], { free: true, dashed: true, n: 3 });
      k.sec('ffn'); k.arrow([[320, 1260], [320, 1284]]); k.box(40, 1284, 560, 110, 'Feed-forward', '1,024 → 4,096 → 1,024 · residual adds around each part');
      k.sec('stack'); k.arrow([[320, 1490], [320, 1516]]); k.stack(20, 1516, 580, 72, 10, 'Blocks 2 – 24'); const blockTxt = k.text(590, 1560, 'block 2', { anchor: 'end', size: 18, weight: 800, fill: k.accent });
      k.sec('heads'); k.arrow([[320, 1640], [320, 1666]]); k.box(20, 1666, 600, 330, '4 output heads', 'Linear 1,024 → 2,048 each · softmax · top-k 250');
      const pick = [0, 1, 2, 3].map(r => { k.text(40, 1764 + r * 56, 'head ' + (r + 1), { size: 15, weight: 700 }); const bars = k.heat(120, 1744 + r * 56, 1, 24, 15, 30, c => `rgba(242,210,124,${(.12 + Math.pow(R(), 3) * .85).toFixed(2)})`, { gap: 2 }); const ch = k.chip(500, 1742 + r * 56, 100, 36, codes[r][3 - r >= 0 ? 3 - r : 0], { size: 15, cls: 'hot' }); return { bars, ch }; });
      k.sec('loop'); k.arrow([[320, 1996], [320, 2024]]); k.box(20, 2024, 600, 100, 'Append codes · repeat', '≈ 500 steps for a 10-second clip'); const loopT = k.text(600, 2056, '', { anchor: 'end', size: 18, weight: 800, fill: k.accent }); k.arrow([[20, 2074], [6, 2074], [6, 560], [20, 560]], { free: true, dashed: true, n: 4 });
      k.sec('enc'); k.arrow([[320, 2124], [320, 2152]]); k.box(20, 2152, 600, 300, 'EnCodec decoder · 32 kHz', 'codes → 4 × 128-d vectors, summed → convolutions');
      [['×8', 120], ['×5', 220], ['×4', 320], ['×4', 420]].forEach(([s], i) => { k.chip(40 + i * 140, 2250, 120, 60, s, { size: 22 }); if (i) k.arrow([[40 + i * 140 - 20, 2280], [40 + i * 140, 2280]]); }); k.text(40, 2350, '50 steps/s × 640 = 32,000 samples per second', { size: 15, fill: MUTED });
      k.sec('wave'); k.arrow([[320, 2452], [320, 2480]]); k.box(20, 2480, 600, 230, '', ''); const wave = el('path', { d: '', fill: 'none', stroke: k.accent, 'stroke-width': 2.2 }, k.sec('wave').g), head = el('line', { x1: 30, y1: 2490, x2: 30, y2: 2700, stroke: '#fff', 'stroke-width': 2.5 }, k.sec('wave').g);
      k.text(320, 2740, 'the waveform of the sound you hear', { anchor: 'middle', size: 15, fill: MUTED });
      const cols = 290, env = Array.from({ length: cols }, (_, i) => { let lo = 0, hi = 0; const a = Math.floor(i * soundWave.length / cols), b = Math.floor((i + 1) * soundWave.length / cols); for (let j = a; j < b; j++) { lo = Math.min(lo, soundWave[j]); hi = Math.max(hi, soundWave[j]); } return [lo, hi]; });
      return { update(si, p) {
        const filled = si < 2 ? 2 : si < 8 ? 3 : si === 8 ? 3 + Math.floor(ease(p) * 10) : 13;
        cells.forEach(({ r, c, rr, t }) => { const on = c + r <= filled; rr.setAttribute('class', on ? (c + r === filled ? 'code new' : 'code on') : 'code'); t.setAttribute('opacity', on ? 1 : 0); });
        stepT.textContent = 'step ' + Math.min(10, filled + 1); loopT.textContent = si >= 8 ? `step ${Math.min(500, Math.round((si > 8 ? 1 : ease(p)) * 500))} / 500` : '';
        blockTxt.textContent = `block ${si < 6 ? 2 : si > 6 ? 24 : 2 + Math.floor(ease(p) * 22)}`;
        const shown = si < 9 ? 0 : Math.floor(clamp(p * 1.2) * cols);
        let d = ''; for (let i = 0; i < shown; i++) { const x = 30 + i * 2, [lo, hi] = env[i]; d += `M${x},${(2595 - hi * 92).toFixed(1)}V${(2595 - lo * 92).toFixed(1)}`; } wave.setAttribute('d', d); head.setAttribute('x1', 30 + shown * 2); head.setAttribute('x2', 30 + shown * 2); head.setAttribute('opacity', si === 9 && shown < cols ? 1 : 0);
      } };
    } }
};

// Blue / Red mode: the same workflow run as good use and as harmful use (ar-cases.js).
if (window.PosterCases) Object.assign(NETWORKS, window.PosterCases({ el, clamp, ease, lerp, rng }));

// ---------- camera: follows each step; viewers can pinch, drag, or switch to the overview ----------
const cam = { x: 0, y: 0, w: WW, h: 900, tx: 0, ty: 0, tw: WW, th: 900, mode: 'follow', world: [0, 0, WW, 900] };
function syncCardSpace() { const h = card.hidden ? 0 : card.getBoundingClientRect().height; if (h) net.style.setProperty('--card-h', Math.round(h + 8) + 'px'); }
function svgSize() { const r = svg.getBoundingClientRect(); return [r.width || 360, r.height || 560]; }
function fit([x0, y0, x1, y1], pad = 24) { const [sw, sh] = svgSize(), asp = sw / sh; let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; if (w / h > asp) h = w / asp; else w = h * asp; return [cx - w / 2, cy - h / 2, w, h]; }
function focusRect(step) {
  const names = step.focus === 'all' ? Object.keys(k.secs) : (step.focus || step.show); const b = [1e9, 1e9, -1e9, -1e9];
  for (const n of names) { const s = k.secs[n]; if (!s || s.box[0] > s.box[2]) continue; b[0] = Math.min(b[0], s.box[0]); b[1] = Math.min(b[1], s.box[1]); b[2] = Math.max(b[2], s.box[2]); b[3] = Math.max(b[3], s.box[3]); }
  return b[0] > b[2] ? cam.world : b;
}
function aim(rect) { cam.focus = rect; [cam.tx, cam.ty, cam.tw, cam.th] = fit(rect); }
function setMode(m) { cam.mode = m; viewBtn.textContent = m === 'overview' ? 'Follow' : 'Overview'; viewBtn.setAttribute('aria-pressed', String(m === 'overview')); if (m === 'overview') aim(cam.world); else if (m === 'follow' && current) aim(focusRect(current.steps[stepIndex()])); }
function applyCam(dt) { const a = dt == null ? 1 : 1 - Math.exp(-dt / 260); cam.x = lerp(cam.x, cam.tx, a); cam.y = lerp(cam.y, cam.ty, a); cam.w = lerp(cam.w, cam.tw, a); cam.h = lerp(cam.h, cam.th, a); svg.setAttribute('viewBox', `${cam.x.toFixed(1)} ${cam.y.toFixed(1)} ${cam.w.toFixed(1)} ${cam.h.toFixed(1)}`); }
const pointers = new Map(); let pinch = null;
function toWorld(px, py) { const r = svg.getBoundingClientRect(); return [cam.x + (px - r.left) / (r.width || 1) * cam.w, cam.y + (py - r.top) / (r.height || 1) * cam.h]; }
function zoomAt(px, py, f) { const [wx, wy] = toWorld(px, py), nw = Math.max(160, Math.min(cam.world[2] * 2.2, cam.w * f)), nh = nw * cam.h / cam.w; cam.x = wx - (wx - cam.x) * nw / cam.w; cam.y = wy - (wy - cam.y) * nh / cam.h; cam.w = nw; cam.h = nh; [cam.tx, cam.ty, cam.tw, cam.th] = [cam.x, cam.y, cam.w, cam.h]; applyCam(); }
svg.addEventListener('pointerdown', e => { pointers.set(e.pointerId, [e.clientX, e.clientY]); svg.setPointerCapture?.(e.pointerId); if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
svg.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return; const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (cam.mode !== 'free') setMode('free');
  if (pointers.size === 2 && pinch) { const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch / d); pinch = d; return; }
  const r = svg.getBoundingClientRect(); cam.x -= (e.clientX - prev[0]) / (r.width || 1) * cam.w; cam.y -= (e.clientY - prev[1]) / (r.height || 1) * cam.h; [cam.tx, cam.ty] = [cam.x, cam.y]; applyCam();
});
const lift = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; }; svg.addEventListener('pointerup', lift); svg.addEventListener('pointercancel', lift);
svg.addEventListener('wheel', e => { e.preventDefault(); if (cam.mode !== 'free') setMode('free'); zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * .0015)); }, { passive: false });
viewBtn.addEventListener('click', () => setMode(cam.mode === 'overview' ? 'follow' : 'overview'));

// ---------- playback ----------
const card = document.getElementById('ar-explain'), phaseEl = card.querySelector('.ar-xp-phase'), countEl = card.querySelector('.ar-xp-count'), titleEl = card.querySelector('h3'), textEl = card.querySelector('p'),
  dotsEl = card.querySelector('.ar-xp-dots'), toggle = document.getElementById('ar-xp-toggle'), linkEl = card.querySelector('.ar-xp-link'),
  caseBar = card.querySelector('.ar-mode'), tipEl = card.querySelector('.ar-xp-tip');
const LINK = { href: linkEl.getAttribute('href'), label: linkEl.textContent };
let caseMode = 'blue';
const textOf = s => s.text ?? s[caseMode], phaseOf = s => s.phase ?? (caseMode === 'blue' ? 'Blue' : 'Red');
function paintCase() {
  if (!current || !current.modes) { delete dialog.dataset.case; return; }
  dialog.dataset.case = caseMode; svg.style.setProperty('--accent', current.modes[caseMode]);
  caseBar?.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === caseMode)));
  document.querySelectorAll('.ar-play[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.arPlay === key && b.dataset.mode === caseMode)));
}
// Switch Blue <-> Red on the same step.
function setCase(m) { if (!current || !current.modes || !current.modes[m] || m === caseMode) return; caseMode = m; paintCase(); seekStep(stepIndex()); }
let stepShownCard = -1, current = null, key = null, scene = null, k = null, starts = [], total = 0, t = 0, playing = false, last = 0, raf = 0, stepShown = -1, soundDone = false, closing = 0;
function columnRect(which = key) { const [x, y, w, h] = AREA[which], q = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => PosterAR.toScreen(px, py)); if (q.some(p => !p)) return null; const xs = q.map(p => p.x), ys = q.map(p => p.y); return { q, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
function fly(open) {
  const r = columnRect(), box = net.getBoundingClientRect(), from = r && box.width ? `translate(${r.x - box.left}px,${r.y - box.top}px) scale(${r.w / box.width},${r.h / box.height})` : 'scale(.92)';
  net.style.transition = 'none';
  if (open) { net.style.transform = from; net.style.opacity = '.2'; void net.offsetWidth; net.style.transition = ''; net.style.transform = ''; net.style.opacity = ''; }
  else { net.style.transition = ''; net.style.transform = from; net.style.opacity = '0'; }
}
function stopExplain() {
  silence(); cancelAnimationFrame(raf); raf = 0; playing = false; const was = current; try { scene?.dispose?.(); } catch {} current = null; scene = null;
  PosterAR.hold(false); card.hidden = true; delete dialog.dataset.case; if (caseBar) caseBar.hidden = true; if (tipEl) tipEl.hidden = true; dialog.classList.remove('spatial'); dialog.classList.remove('net-open'); stage.classList.remove('explaining'); plane.classList.remove('explaining'); document.querySelectorAll('.ar-play').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (was && !was.spatial && !net.hidden) { fly(false); clearTimeout(closing); closing = setTimeout(() => { if (!current) { net.hidden = true; svg.textContent = ''; dim.classList.remove('on'); } }, 420); } else { net.hidden = true; svg.textContent = ''; dim.classList.remove('on'); }
}
function paintSections(si) {
  const step = current.steps[si] || { show: Object.keys(k.secs) }, done = new Set(); current.steps.slice(0, si).forEach(s => s.show.forEach(n => done.add(n)));
  const active = new Set(step.show); if (si >= current.steps.length) Object.keys(k.secs).forEach(n => done.add(n));
  for (const s of Object.values(k.secs)) { const st = active.has(s.name) ? 'act' : done.has(s.name) || si === 0 ? 'done' : 'fut'; if (s.state !== st) { s.g.setAttribute('class', 's ' + st); s.state = st; } }
  // frames that contain other sections (U-Net, blocks) follow their children
  for (const name of ['blk', 'unet']) { const s = k.secs[name]; if (s) { const kids = { blk: ['ln1', 'qkv', 'heads', 'proj', 'mlp', 'sa', 'ca', 'ffn'], unet: ['down', 'mid', 'up', 'inside'] }[name]; const st = kids.some(n => active.has(n)) ? 'act' : kids.some(n => done.has(n)) || si === 0 ? 'done' : 'fut'; if (s.state !== st) { s.g.setAttribute('class', 's ' + st); s.state = st; } } }
}
function start(which, m) {
  stopExplain(); clearTimeout(closing); key = which; current = NETWORKS[which]; caseMode = m === 'red' ? 'red' : 'blue'; t = 0; stepShown = -1; stepShownCard = -1; soundDone = false;
  starts = []; total = 0; current.steps.forEach(s => { starts.push(total); total += s.dur; });
  if (current.spatial) {
    // Spatial walkthrough: no full-screen diagram; the scene is drawn in 3D over the blurred camera, locked to the poster.
    PosterAR.hold(true); k = null; scene = current.build(null, { mode: () => caseMode, stage, dialog });
    dotsEl.textContent = ''; current.steps.forEach(() => dotsEl.appendChild(document.createElement('i'))); linkEl.hidden = true;
    linkEl.setAttribute('href', current.link ? current.link.href : LINK.href); linkEl.textContent = current.link ? current.link.label : LINK.label; if (caseBar) caseBar.hidden = !current.modes;
    card.hidden = false; dialog.classList.add('spatial'); stage.classList.add('explaining'); plane.classList.add('explaining'); dim.classList.remove('on'); paintCase();
    playing = true; toggle.dataset.state = 'pause'; toggle.setAttribute('aria-label', 'Pause'); last = performance.now(); tick(last); return;
  }
  svg.textContent = ''; svg.style.setProperty('--accent', current.accent); k = world(el('g', {}, svg), current.accent); scene = current.build(k, { mode: () => caseMode });
  const all = Object.values(k.secs).reduce((b, s) => [Math.min(b[0], s.box[0]), Math.min(b[1], s.box[1]), Math.max(b[2], s.box[2]), Math.max(b[3], s.box[3])], [1e9, 1e9, -1e9, -1e9]); cam.world = [Math.min(0, all[0]), Math.min(0, all[1]), Math.max(WW, all[2]), all[3]];
  netTitle.textContent = current.name; netInput.textContent = '“' + current.input + '”'; netNote.textContent = current.note || current.model + ' · real layer sizes · example values illustrative';
  dotsEl.textContent = ''; current.steps.forEach(() => dotsEl.appendChild(document.createElement('i'))); linkEl.hidden = true;
  linkEl.setAttribute('href', current.link ? current.link.href : LINK.href); linkEl.textContent = current.link ? current.link.label : LINK.label; if (caseBar) caseBar.hidden = !current.modes;
  net.hidden = false; card.hidden = false; dialog.classList.add('net-open'); stage.classList.add('explaining'); plane.classList.add('explaining'); updateDim(); fly(true);
  if (current.modes) paintCase(); else document.querySelector(`.ar-play[data-ar-play="${which}"]`)?.setAttribute('aria-pressed', 'true');
  cam.mode = 'follow'; viewBtn.textContent = 'Overview'; [cam.x, cam.y, cam.w, cam.h] = fit(cam.world); aim(cam.world); applyCam();
  playing = true; toggle.dataset.state = 'pause'; toggle.setAttribute('aria-label', 'Pause'); last = performance.now(); tick(last);
}
function setPlaying(on) { if (!on) silence(); playing = on; toggle.setAttribute('aria-label', on ? 'Pause' : 'Play'); toggle.dataset.state = on ? 'pause' : 'play'; last = performance.now(); if (on && !raf) raf = requestAnimationFrame(tick); }
function seekStep(i) { if (!current) return; silence(); i = Math.max(0, Math.min(current.steps.length - 1, i)); t = starts[i] + 1; stepShown = -1; soundDone = false; linkEl.hidden = true; if (cam.mode === 'free') cam.mode = 'follow'; if (!playing) setPlaying(true); tick(performance.now()); }
function stepIndex() { let i = 0; while (i + 1 < starts.length && t >= starts[i + 1]) i++; return i; }
function tick(now) {
  cancelAnimationFrame(raf); raf = 0; if (!current) return;
  const dt = now - last; if (playing) t += Math.min(80, dt); last = now;
  const ended = t >= total; if (ended) { t = total; if (playing) { playing = false; toggle.dataset.state = 'replay'; toggle.setAttribute('aria-label', 'Replay'); linkEl.hidden = false; } }
  const si = stepIndex(), step = current.steps[si], p = clamp((t - starts[si]) / step.dur);
  if (si !== stepShown) { stepShown = si; phaseEl.textContent = phaseOf(step); phaseEl.dataset.phase = step.phase ? step.phase.toLowerCase() : caseMode; countEl.textContent = `${current.name} · ${si + 1}/${current.steps.length}`; titleEl.textContent = step.title; textEl.textContent = textOf(step); if (tipEl) { tipEl.hidden = !step.tip; tipEl.textContent = step.tip ? '⇄ What changed: ' + step.tip : ''; } [...dotsEl.children].forEach((d, i) => d.className = i < si ? 'done' : i === si ? 'now' : ''); if (!k) {} else if (cam.mode === 'follow') aim(focusRect(step)); else if (cam.mode !== 'overview') { cam.mode = 'follow'; viewBtn.textContent = 'Overview'; aim(focusRect(step)); } }
  if (si !== stepShownCard) { stepShownCard = si; syncCardSpace(); if (k && cam.mode === 'follow') aim(focusRect(step)); }
  if (step.sound && playing && !soundDone) { soundDone = true; playSound(); }
  if (k) paintSections(ended ? current.steps.length : si); scene.update(ended ? current.steps.length : si, p, now);
  if (k) for (const s of Object.values(k.secs)) for (const f of s.flows) f.dots.forEach((d, i) => { if (s.state !== 'act') { d.setAttribute('opacity', 0); return; } const ph = (now / 1300 + i / f.dots.length) % 1, [x, y] = pointAt(f.pts, ph * f.L); d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); d.setAttribute('opacity', Math.min(1, ph * 5, (1 - ph) * 5).toFixed(2)); });
  if (k && cam.mode !== 'free') { if (cam.focus) [cam.tx, cam.ty, cam.tw, cam.th] = fit(cam.focus); applyCam(Math.min(80, Math.max(0, dt))); }
  raf = requestAnimationFrame(tick);
}
// Dim everything except one printed section: the one being explained, or else the one the phone is aimed at.
function updateDim() {
  const which = current ? (current.spatial ? null : key) : PosterAR.focus(); if (!which) { dim.classList.remove('on'); return; }
  const r = columnRect(which), box = stage.getBoundingClientRect(); if (!r) { dim.classList.remove('on'); return; }
  dim.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); dimPath.setAttribute('d', `M-10,-10H${box.width + 10}V${box.height + 10}H-10Z M${r.q.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L')}Z`); dim.classList.add('on'); dim.classList.toggle('aim', !current);
}
PosterAR.onRender(updateDim); PosterAR.onStop(stopExplain);
document.querySelectorAll('.ar-play').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.arPlay === 'audio' && !audio) { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); } catch { audio = null; } }
  start(b.dataset.arPlay, b.dataset.mode);
}));
caseBar?.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setCase(b.dataset.mode)));
toggle.addEventListener('click', () => { if (!current) return; if (toggle.dataset.state === 'replay') seekStep(0); else setPlaying(!playing); });
document.getElementById('ar-xp-prev').addEventListener('click', () => seekStep(stepIndex() - 1));
document.getElementById('ar-xp-next').addEventListener('click', () => seekStep(stepIndex() + 1));
document.getElementById('ar-xp-close').addEventListener('click', stopExplain);
linkEl.addEventListener('click', () => PosterAR.close());
// The caption is tucked away: the (?) button shows or hides the written explanation of the current step.
const helpBtn = document.getElementById('ar-xp-help');
helpBtn?.addEventListener('click', () => { const open = card.classList.toggle('ar-open'); helpBtn.setAttribute('aria-expanded', String(open)); syncCardSpace(); if (k && cam.mode === 'follow' && current) aim(focusRect(current.steps[stepIndex()])); });
window.PosterExplain = { networks: NETWORKS, start, stop: stopExplain, camera: () => ({ ...cam }), setView: setMode, setCase, scene: () => scene, state: () => ({ network: current && current.name, step: current ? stepIndex() : -1, mode: current && current.modes ? caseMode : null, t, total, playing }) };
})();
