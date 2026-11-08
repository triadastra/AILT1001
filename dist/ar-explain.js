'use strict';
/* "Play" walkthroughs for the four printed model paths.
 * Pressing Play lifts the printed column off the poster into a full-screen view of the whole
 * network, then runs one concrete example input through it step by step.
 * Values are illustrative teaching examples, labelled as such in the view. */
(() => {
const NS = 'http://www.w3.org/2000/svg', VW = 360, VH = 560;
const plane = document.getElementById('poster-plane'), stage = document.querySelector('#scanner .ar-stage'), dialog = document.getElementById('scanner');
const net = document.getElementById('ar-net');
if (!plane || !stage || !net || !window.PosterAR) return;
const svg = net.querySelector('svg'), netTitle = net.querySelector('.ar-net-title'), netInput = net.querySelector('.ar-net-input');
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const clamp = v => Math.max(0, Math.min(1, v)), ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2, lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

// Printed column areas (poster units) — the full-screen view grows out of these.
const AREA = { text: [100, 316, 322, 492], image: [494, 316, 334, 500], video: [858, 316, 344, 500], audio: [1238, 316, 314, 492] };
const dim = el('svg', { id: 'ar-dim', 'aria-hidden': 'true' }); stage.insertBefore(dim, plane); const dimPath = el('path', { 'fill-rule': 'evenodd' }, dim);

// ---------- drawing kit (screen-space SVG, viewBox 360 x 560) ----------
function kit(g, accent) {
  const parts = [];
  const add = (node, from, to = from) => { node.from = from; node.to = to; parts.push(node); return node; };
  const k = {
    accent, parts,
    text(x, y, s, o = {}) { const t = el('text', { x, y, 'text-anchor': o.anchor || 'middle', 'font-size': o.size || 12, 'font-weight': o.weight || 500, fill: o.fill || '#fff', class: o.cls || '' }, o.parent || g); t.textContent = s; return t; },
    node(x, y, w, h, label, from, to, o = {}) {
      const gg = el('g', { class: 'n fut' }, g);
      el('rect', { x, y, width: w, height: h, rx: o.rx ?? 10, class: 'nb' }, gg);
      if (label) k.text(x + w / 2, y + h / 2 + 4.5, label, { size: o.size || 12.5, weight: 600, parent: gg });
      return add({ g: gg, x, y, w, h }, from, to);
    },
    group(from, to, o = {}) { return add({ g: el('g', { class: 'n fut' }, g), only: o.onlyActive }, from, to); },
    link(pts, from, to = from, o = {}) {
      const gg = el('g', { class: 'l fut' }, g);
      el('polyline', { points: pts.map(p => p.join(',')).join(' '), class: o.dashed ? 'lk dash' : 'lk' }, gg);
      const [a, b] = pts.slice(-2), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      el('path', { d: `M${b[0]},${b[1]} l${(-7 * Math.cos(ang - .45)).toFixed(2)},${(-7 * Math.sin(ang - .45)).toFixed(2)} M${b[0]},${b[1]} l${(-7 * Math.cos(ang + .45)).toFixed(2)},${(-7 * Math.sin(ang + .45)).toFixed(2)}`, class: 'lk' }, gg);
      let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const dots = Array.from({ length: o.n || 2 }, () => el('circle', { r: 3.6, class: 'dot' }, gg));
      return add({ g: gg, pts, L, dots, flow: true }, from, to);
    },
    image(x, y, w, h, from, to, o = {}) {
      const gg = el('g', { class: 'n fut' }, g);
      const img = el('image', { x, y, width: w, height: h, preserveAspectRatio: 'xMidYMid slice', style: o.pixelated ? 'image-rendering:pixelated' : '' }, gg);
      el('rect', { x, y, width: w, height: h, rx: 6, class: 'frame' }, gg);
      return add({ g: gg, img, x, y, w, h }, from, to);
    },
    // diverging colour for a value in [-1, 1]
    valueColor(v) { const t = clamp((v + 1) / 2); const r = Math.round(lerp(90, 255, t)), gr = Math.round(lerp(150, 140, Math.abs(t - .5) * 2)), b = Math.round(lerp(255, 110, t)); return `rgb(${r},${gr},${b})`; }
  };
  return k;
}
function pointAt(pts, d) { for (let i = 1; i < pts.length; i++) { const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= s || i === pts.length - 1) { const f = s ? Math.min(1, d / s) : 0; return [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]; } d -= s; } return pts[0]; }
// State of every part: future (faint, but the whole network stays visible), active, or done.
function paint(k, si, now) {
  for (const p of k.parts) {
    let st = si < p.from ? 'fut' : si > p.to ? 'done' : 'act'; if (p.only && st !== 'act') st = 'off';
    if (p.state !== st) { p.g.setAttribute('class', (p.flow ? 'l ' : 'n ') + st); p.state = st; }
    if (p.flow) p.dots.forEach((d, i) => { if (st !== 'act') { d.setAttribute('opacity', 0); return; } const ph = (now / 1100 + i / p.dots.length) % 1, [x, y] = pointAt(p.pts, ph * p.L); d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); d.setAttribute('opacity', Math.min(1, ph * 5, (1 - ph) * 5).toFixed(2)); });
  }
}

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
// alpha 0 = pure noise, 1 = clean picture. Returns a data URL (or null where canvas is unavailable, e.g. tests).
function mixURL(pic, n, alpha, seed, noiseOnly) {
  scratch.width = n; scratch.height = n; const ctx = scratch.getContext && scratch.getContext('2d'); if (!ctx || !ctx.createImageData || !ctx.putImageData || !scratch.toDataURL) return null;
  const out = ctx.createImageData(n, n), z = noiseField(n, seed), src = pic && pic.data, size = pic ? pic.canvas.width : n, a = clamp(alpha), na = Math.sqrt(1 - a * a);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, s = ((Math.floor(y * size / n)) * size + Math.floor(x * size / n)) * 4;
    for (let c = 0; c < 3; c++) { const nv = z[(y * n + x) * 3 + c] * 0.5, base = src ? src[s + c] / 255 - .5 : 0; out.data[o + c] = Math.max(0, Math.min(255, 128 + 255 * (noiseOnly ? nv * na : a * base + na * nv))); } out.data[o + 3] = 255; }
  ctx.putImageData(out, 0, 0); try { return scratch.toDataURL(); } catch { return null; }
}
function setHref(img, url) { if (url && img.getAttribute('href') !== url) img.setAttribute('href', url); }
// Video frames for the video example, sampled from the real Wan clip.
let clipFrames = null;
function loadClipFrames() {
  if (clipFrames) return clipFrames; clipFrames = [0, 1, 2, 3].map(() => ({ canvas: (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; return c; })(), data: null }));
  const fallback = loadPicture('wan', 'assets/wan-frame.jpg', 64);
  try {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = 'assets/wan-example.mp4'; let i = 0;
    const grab = () => { const c = clipFrames[i].canvas, ctx = c.getContext('2d', { willReadFrequently: true }); if (ctx && ctx.getImageData) { ctx.drawImage(v, 0, 0, 64, 64); const d = ctx.getImageData(0, 0, 64, 64); if (d && d.data && d.data.length === 64 * 64 * 4) clipFrames[i].data = d.data; } if (++i < 4) v.currentTime = v.duration * (.08 + i * .27); };
    v.addEventListener('loadeddata', () => { v.currentTime = v.duration * .08; }, { once: true }); v.addEventListener('seeked', grab);
  } catch {}
  clipFrames.fallback = fallback; return clipFrames;
}
const framePic = i => (clipFrames && clipFrames[i].data ? clipFrames[i] : clipFrames && clipFrames.fallback);

// ---------- illustrative sound: plucked notes synthesised on the device ----------
let audio = null; const voices = [];
const SR = 22050, chord = [[196, 0], [246.9, .32], [293.7, .64], [392, .96], [293.7, 1.28], [246.9, 1.6], [98, 0]];
const soundWave = (() => { const len = Math.floor(SR * 3.2), out = new Float32Array(len); let seed = rng(42);
  for (const [f, at] of chord) { const period = Math.round(SR / f), start = Math.floor(at * SR), buf = new Float32Array(Math.floor(SR * 1.6)); for (let i = 0; i < period; i++) buf[i] = seed() * 2 - 1; for (let i = period; i < buf.length; i++) buf[i] = (buf[i - period] + buf[i - period + 1]) * .497; const g = f < 120 ? .45 : .6; for (let i = 0; i < buf.length && start + i < len; i++) out[start + i] += buf[i] * g; }
  let m = 0; for (const v of out) m = Math.max(m, Math.abs(v)); for (let i = 0; i < len; i++) out[i] /= m || 1; return out; })();
function silence() { while (voices.length) { try { voices.pop().stop(); } catch {} } }
function playSound() { if (!audio) return; try { audio.resume?.(); const b = audio.createBuffer(1, soundWave.length, SR); b.getChannelData(0).set(soundWave); const s = audio.createBufferSource(), g = audio.createGain(); g.gain.value = .22; s.buffer = b; s.connect(g).connect(audio.destination); s.start(); voices.push(s); s.onended = () => { const i = voices.indexOf(s); if (i >= 0) voices.splice(i, 1); }; } catch {} }

// ---------- the four networks with a concrete example each ----------
const NETWORKS = {
  text: { name: 'Text model', input: 'A musician plays', accent: '#d6a6e6', steps: [
    { phase: 'Preprocess', title: 'Split into tokens', text: '“A musician plays” becomes 3 tokens. Each token has an ID in the model’s vocabulary (the IDs here are examples).', dur: 4200 },
    { phase: 'Preprocess', title: 'Embed + position', text: 'Each ID is looked up as a vector of numbers—real models use hundreds or thousands; 6 are shown. A position signal 1, 2, 3 is added.', dur: 4600 },
    { phase: 'Propagate', title: 'Masked attention', text: 'To predict what follows “plays”, attention weighs the earlier words: musician 71%, plays 21%, A 8%. Future words are masked (—).', dur: 5600 },
    { phase: 'Propagate', title: 'Feed-forward, repeat ×N', text: 'Each vector is refined by a feed-forward network, with add & norm. The whole layer repeats N times (12 here), sharpening the meaning.', dur: 5200 },
    { phase: 'Result', title: 'Softmax picks the next token', text: 'The final vector is scored against every word: guitar 41%, piano 23%, violin 12%… “guitar” is chosen.', dur: 5000 },
    { phase: 'Result', title: 'Append and repeat', text: '“A musician plays guitar”. The new token joins the input and the whole network runs again for the next word.', dur: 4400 }],
    build(k) {
      const toks = [['A', 80, 44, '#32'], ['musician', 168, 96, '#15276'], ['plays', 266, 76, '#11335']];
      k.node(60, 8, 240, 30, '“A musician plays”', 0, 0, { size: 14 });
      const tok = toks.map(([s, cx, w, id], i) => { const n = k.node(cx - w / 2, 62, w, 28, s, 0, 2, { size: 13 }); k.text(cx, 103, id, { size: 10, fill: 'rgba(255,255,255,.65)', parent: n.g }); k.link([[180, 38], [cx, 62]], 0); return n; });
      const vecs = [[.12, -.4, .88, .05, -.63, .31], [.71, .22, -.15, .9, -.34, -.08], [-.27, .64, .43, -.52, .18, .77]], after = [.55, .12, .81, -.2, .66, .4];
      const cells = toks.map(([, cx], i) => { const g = k.group(1, 3); const list = vecs[i].map((v, j) => el('rect', { x: cx - 30 + j * 10, y: 118, width: 9, height: 22, rx: 2, fill: k.valueColor(v) }, g.g)); k.text(cx, 155, `+ position ${i + 1}`, { size: 10, fill: 'rgba(255,255,255,.7)', parent: g.g }); k.link([[cx, 106], [cx, 116]], 1); return list; });
      k.text(180, 176, 'each token → a vector of numbers', { size: 10, fill: 'rgba(255,255,255,.55)' });
      const block = k.node(14, 188, 332, 186, '', 2, 3, { rx: 14 }); k.text(26, 206, 'Transformer layer', { anchor: 'start', size: 12, weight: 700, parent: block.g });
      const layerTxt = k.text(334, 206, 'layer 1 / 12', { anchor: 'end', size: 11, weight: 700, fill: k.accent, parent: block.g });
      // attention matrix: rows = token asking, columns = earlier tokens it can see
      const att = k.group(2, 2), M = [[1, null, null], [.35, .65, null], [.08, .71, .21]], labels = ['A', 'mus.', 'plays'];
      k.text(98, 226, 'masked attention', { size: 11, weight: 700, parent: att.g });
      labels.forEach((s, j) => k.text(66 + j * 34, 242, s, { size: 9.5, fill: 'rgba(255,255,255,.7)', parent: att.g }));
      const mcells = M.map((row, i) => { k.text(44, 266 + i * 34, labels[i], { anchor: 'end', size: 9.5, fill: 'rgba(255,255,255,.7)', parent: att.g }); return row.map((v, j) => { const r = el('rect', { x: 50 + j * 34, y: 248 + i * 34, width: 32, height: 32, rx: 5, fill: v == null ? 'rgba(255,255,255,.06)' : k.accent, 'fill-opacity': v == null ? 1 : .15 + v * .85 }, att.g); k.text(66 + j * 34, 268 + i * 34, v == null ? '—' : String(v).replace(/^0/, ''), { size: 10.5, weight: 700, fill: v == null ? 'rgba(255,255,255,.35)' : '#fff', parent: att.g }); return r; }); });
      const ff = k.node(198, 232, 136, 46, 'Feed-forward', 3, 3), an = k.node(198, 300, 136, 40, 'Add & norm', 3, 3);
      k.link([[154, 300], [198, 255]], 3); k.link([[266, 278], [266, 300]], 3); k.link([[266, 340], [266, 356], [26, 356], [26, 230], [48, 230]], 3, 3, { n: 3, dashed: true });
      k.text(28, 368, '×N', { anchor: 'start', size: 11, weight: 700, fill: k.accent, parent: block.g });
      // attention arcs from "plays" back to earlier tokens (weights)
      const arcs = k.group(2, 2, { onlyActive: true }); [[80, .08], [168, .71], [266, .21]].forEach(([x, w]) => el('path', { d: x === 266 ? 'M258,62 C246,40 286,40 274,62' : `M266,62 Q${(266 + x) / 2},${18 - (266 - x) * .12} ${x},62`, fill: 'none', stroke: k.accent, 'stroke-width': 1.5 + w * 9, 'stroke-linecap': 'round', opacity: .9 }, arcs.g));
      const sm = k.group(4, 4), probs = [['guitar', .41], ['piano', .23], ['violin', .12], ['drums', .08], ['song', .05]];
      k.text(180, 398, 'softmax over the vocabulary', { size: 11, weight: 700, parent: sm.g }); k.link([[180, 374], [180, 386]], 4);
      const bars = probs.map(([w, p], i) => { k.text(82, 418 + i * 19, w, { anchor: 'end', size: 11, weight: i ? 500 : 700, parent: sm.g }); const b = el('rect', { x: 90, y: 407 + i * 19, width: 0, height: 13, rx: 3, fill: i ? 'rgba(255,255,255,.45)' : k.accent }, sm.g); const t = k.text(96, 418 + i * 19, Math.round(p * 100) + '%', { anchor: 'start', size: 10.5, weight: 700, parent: sm.g }); return { b, t, p }; });
      const out = k.group(5, 5); const o1 = k.text(180, 524, 'A musician plays ', { size: 15, weight: 600, parent: out.g, anchor: 'end' }); o1.setAttribute('x', 214); const o2 = k.text(216, 524, 'guitar', { size: 15, weight: 800, fill: k.accent, parent: out.g, anchor: 'start' });
      k.link([[300, 516], [350, 516], [350, 76], [306, 76]], 5, 5, { n: 3, dashed: true });
      const ghost = k.node(306, 64, 44, 24, 'guitar', 5, 5, { size: 10 });
      return { update(si, p) {
        layerTxt.textContent = `layer ${si < 3 ? 1 : si > 3 ? 12 : 1 + Math.floor(ease(p) * 11)} / 12`;
        if (si === 3) cells[2].forEach((r, j) => r.setAttribute('fill', k.valueColor(lerp(vecs[2][j], after[j], ease(p)))));
        else if (si > 3) cells[2].forEach((r, j) => r.setAttribute('fill', k.valueColor(after[j]))); else cells[2].forEach((r, j) => r.setAttribute('fill', k.valueColor(vecs[2][j])));
        bars.forEach(({ b, t, p: pr }) => { const w = (si > 4 ? 1 : si === 4 ? ease(clamp(p * 1.6)) : 0) * pr * 200 / .41 * .9; b.setAttribute('width', w.toFixed(1)); t.setAttribute('x', (96 + w).toFixed(1)); t.setAttribute('opacity', w ? 1 : 0); });
      } };
    } },
  image: { name: 'Image model', input: 'Armoured figure in a forest', accent: '#9cc8ff', steps: [
    { phase: 'Preprocess', title: 'Encode the prompt', text: '“Armoured figure in a forest” becomes a text vector. It will steer every denoising step.', dur: 4200 },
    { phase: 'Preprocess', title: 'Start from noise', text: 'Generation starts from pure random noise in a compressed latent—for example 64×64×4 numbers for a 512×512 image.', dur: 4200 },
    { phase: 'Propagate', title: 'The U-Net predicts the noise', text: 'The U-Net shrinks the latent (64→32→16), expands it back, and passes details across skip connections. Guided by the text, it predicts which part is noise.', dur: 6000 },
    { phase: 'Propagate', title: 'Remove a little noise, repeat', text: 'The sampler subtracts some predicted noise and loops back. Over about 20–50 steps (30 here), the figure emerges.', dur: 7600 },
    { phase: 'Result', title: 'Decode to pixels', text: 'The VAE decoder turns the clean 64×64 latent into a full 512×512 picture.', dur: 5000 }],
    build(k) {
      const pic = loadPicture('wan', 'assets/wan-frame.jpg', 96);
      k.node(50, 8, 260, 30, '“Armoured figure in a forest”', 0, 0, { size: 13 });
      k.link([[110, 38], [110, 58]], 0); k.node(36, 58, 150, 30, 'Text encoder', 0, 0);
      const vec = k.group(0, 3); [.6, -.3, .1, .8, -.7, .4, -.1, .5].forEach((v, i) => el('rect', { x: 210 + i * 15, y: 64, width: 13, height: 18, rx: 2, fill: k.valueColor(v) }, vec.g)); k.text(270, 100, 'text vector', { size: 10, fill: 'rgba(255,255,255,.65)', parent: vec.g }); k.link([[186, 73], [208, 73]], 0);
      const lat = k.image(16, 128, 100, 100, 1, 3, { pixelated: true }); k.text(66, 244, 'latent 64×64×4', { size: 10.5, weight: 600, parent: lat.g }); const stepTxt = k.text(66, 260, 'pure noise', { size: 11, weight: 700, fill: k.accent, parent: lat.g });
      const un = k.group(2, 3); k.text(244, 124, 'U-Net', { size: 12, weight: 700, parent: un.g });
      [[146, 140, 30, 84, '64'], [184, 156, 24, 52, '32'], [218, 172, 52, 20, '16'], [280, 156, 24, 52, '32'], [312, 140, 30, 84, '64']].forEach(([x, y, w, h, s]) => { el('rect', { x, y, width: w, height: h, rx: 5, class: 'nb' }, un.g); k.text(x + w / 2, y + h + 13, s, { size: 9.5, fill: 'rgba(255,255,255,.65)', parent: un.g }); });
      el('path', { d: 'M176,150 L312,150 M208,166 L280,166', class: 'lk dash' }, un.g); k.text(244, 146, 'skip connections', { size: 9, fill: 'rgba(255,255,255,.7)', parent: un.g });
      k.link([[116, 178], [146, 182]], 2); k.link([[300, 88], [300, 112], [244, 112], [244, 172]], 2, 2, { dashed: true }); k.text(296, 116, 'text guides', { size: 9, anchor: 'start', fill: 'rgba(255,255,255,.7)' });
      const pred = k.image(262, 262, 80, 80, 2, 3, { pixelated: true }); k.text(302, 356, 'predicted noise', { size: 10, parent: pred.g }); k.link([[327, 238], [327, 262]], 2);
      const smp = k.node(16, 372, 328, 40, '', 3, 3); k.text(180, 390, 'Sampler', { size: 12.5, weight: 700, parent: smp.g }); k.text(180, 404, 'new latent = latent − predicted noise × step', { size: 10, fill: 'rgba(255,255,255,.75)', parent: smp.g });
      k.link([[300, 342], [300, 372]], 3); k.link([[16, 392], [6, 392], [6, 178], [16, 178]], 3, 3, { n: 3, dashed: true });
      k.link([[90, 412], [90, 436]], 4); k.node(16, 436, 148, 34, 'VAE decoder', 4, 4); k.text(90, 486, 'latent → pixels', { size: 10, fill: 'rgba(255,255,255,.65)' });
      const fin = k.image(186, 424, 136, 120, 4, 4); k.text(254, 556, '512×512 picture', { size: 10, parent: fin.g }); k.link([[164, 453], [186, 470]], 4);
      let last = '';
      return { update(si, p) {
        const steps = si < 3 ? 0 : si > 3 ? 30 : Math.max(1, Math.round(ease(p) * 30)), a = steps / 30, key = steps + ':' + !!pic.data;
        stepTxt.textContent = si < 3 ? 'pure noise' : `step ${steps} / 30`;
        if (key !== last) { last = key; setHref(lat.img, mixURL(pic, 32, Math.sqrt(a) * .97, 3)); setHref(pred.img, mixURL(null, 24, a, 9, true)); }
        if (si >= 4 && !fin.done && pic.data) { fin.done = true; fin.img.setAttribute('href', 'assets/wan-frame.jpg'); }
        fin.img.setAttribute('opacity', si >= 4 ? clamp(p * 2.5) : 0);
      } };
    } },
  video: { name: 'Video model', input: 'Armoured figure turns', accent: '#b9e08c', steps: [
    { phase: 'Preprocess', title: 'Encode the prompt', text: '“Armoured figure turns” becomes a text vector that steers the whole clip.', dur: 4000 },
    { phase: 'Preprocess', title: 'Noisy frames → patch tokens', text: 'Every frame starts as noise. Each frame is cut into patches: here 4 frames × 12 patches = 48 tokens.', dur: 5000 },
    { phase: 'Propagate', title: 'Attend across space AND time', text: 'One patch looks at patches in its own frame (space) and at the same spot in the other frames (time), so the figure moves consistently.', dur: 6400 },
    { phase: 'Propagate', title: 'Denoise the whole clip', text: 'The sampler removes a little noise from all frames together, step after step (30 here).', dur: 6600 },
    { phase: 'Result', title: 'Decode frames in time order', text: 'The video VAE turns the clean latent into real frames, played in order as the clip.', dur: 6000 }],
    build(k) {
      loadClipFrames();
      k.node(70, 8, 220, 30, '“Armoured figure turns”', 0, 0, { size: 13 });
      k.link([[110, 38], [110, 58]], 0); k.node(36, 58, 150, 30, 'Text encoder', 0, 0);
      const vec = k.group(0, 3); [.4, .7, -.5, .2, -.8, .6, .1, -.3].forEach((v, i) => el('rect', { x: 210 + i * 15, y: 64, width: 13, height: 18, rx: 2, fill: k.valueColor(v) }, vec.g)); k.link([[186, 73], [208, 73]], 0);
      const frames = [0, 1, 2, 3].map(i => { const f = k.image(14 + i * 84, 112, 78, 58, 1, 3, { pixelated: true }); const grid = el('path', { d: [1, 2, 3].map(c => `M${14 + i * 84 + c * 19.5},112 v58`).join(' ') + [1, 2].map(r => ` M${14 + i * 84},${112 + r * 19.33} h78`).join(''), class: 'grid' }, f.g); k.text(53 + i * 84, 184, `frame ${i + 1}`, { size: 10, fill: 'rgba(255,255,255,.7)', parent: f.g }); return f; });
      const dit = k.node(14, 200, 332, 170, '', 2, 3, { rx: 14 }); k.text(26, 218, 'Diffusion transformer', { anchor: 'start', size: 12, weight: 700, parent: dit.g }); k.link([[180, 188], [180, 200]], 1);
      k.link([[330, 82], [340, 82], [340, 210]], 2, 2, { dashed: true });
      const T = [], tg = k.group(1, 3);
      for (let f = 0; f < 4; f++) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = 28 + f * 80 + c * 16, y = 238 + r * 16; T.push({ f, r, c, x: x + 7, y: y + 7, e: el('rect', { x, y, width: 14, height: 14, rx: 3, class: 'tok' }, tg.g) }); }
      k.text(180, 302, '48 patch tokens (4 frames × 12)', { size: 10, fill: 'rgba(255,255,255,.7)', parent: tg.g });
      const q = T.find(t => t.f === 1 && t.r === 1 && t.c === 1), lines = k.group(2, 2, { onlyActive: true });
      T.forEach(t => { if (t === q || (t.f !== q.f && !(t.r === q.r && t.c === q.c))) return; const time = t.f !== q.f; el('path', { d: time ? `M${q.x},${q.y} Q${(q.x + t.x) / 2},${q.y + 48} ${t.x},${t.y}` : `M${q.x},${q.y} L${t.x},${t.y}`, fill: 'none', stroke: time ? '#ffd27a' : k.accent, 'stroke-width': time ? 2.4 : 1.4, opacity: time ? .95 : .75, class: time ? 'time' : 'space' }, lines.g); });
      el('circle', { cx: 60, cy: 334, r: 4, fill: k.accent }, lines.g); k.text(68, 338, 'space: same frame', { anchor: 'start', size: 10, parent: lines.g }); el('circle', { cx: 190, cy: 334, r: 4, fill: '#ffd27a' }, lines.g); k.text(198, 338, 'time: same spot, other frames', { anchor: 'start', size: 10, parent: lines.g });
      const smp = k.node(14, 386, 332, 34, '', 3, 3); const stepTxt = k.text(180, 408, 'Sampler', { size: 12, weight: 700, parent: smp.g }); k.link([[180, 370], [180, 386]], 3); k.link([[14, 403], [5, 403], [5, 140], [14, 140]], 3, 3, { n: 3, dashed: true });
      k.link([[180, 420], [180, 436]], 4); k.node(100, 436, 160, 30, 'Video VAE decoder', 4, 4);
      const clip = k.image(116, 474, 128, 76, 4, 4); const clipTxt = k.text(180, 558, 'clip', { size: 10, parent: clip.g });
      let last = '';
      return { update(si, p, now) {
        const steps = si < 3 ? 0 : si > 3 ? 30 : Math.max(1, Math.round(ease(p) * 30)), a = steps / 30, ready = [0, 1, 2, 3].map(i => !!(framePic(i) && framePic(i).data)).join(''), key = steps + ready;
        stepTxt.textContent = si === 3 ? `Sampler · step ${steps} / 30` : 'Sampler';
        if (key !== last) { last = key; frames.forEach((f, i) => setHref(f.img, mixURL(framePic(i), 24, Math.sqrt(a) * .97, 11 + i))); }
        q.e.setAttribute('class', si === 2 ? 'tok q' : 'tok');
        if (si >= 4) { const i = Math.floor(now / 260) % 4; if (clip.cur !== i) { clip.cur = i; setHref(clip.img, mixURL(framePic(i), 64, 1, 1)); clipTxt.textContent = `clip · frame ${i + 1} / 4`; } }
      } };
    } },
  audio: { name: 'Audio model', input: 'Gentle guitar music', accent: '#f2d27c', steps: [
    { phase: 'Preprocess', title: 'Encode the prompt', text: '“Gentle guitar music” becomes a text vector that the decoder pays attention to.', dur: 4000 },
    { phase: 'Propagate', title: 'Predict the next codes', text: 'The transformer decoder reads the codes so far and predicts the next ones, one time step at a time.', dur: 5200 },
    { phase: 'Propagate', title: 'Fill 4 codebook streams', text: 'Each time step adds one code to each of 4 streams, from coarse to fine detail. In MusicGen-style models about 50 steps make one second.', dur: 6600 },
    { phase: 'Result', title: 'Decode an audible waveform', text: 'The audio codec decoder turns the codes into a sound wave. Listen: this sound is synthesised on your phone for illustration, not real model output.', dur: 6400, sound: true }],
    build(k) {
      k.node(80, 8, 200, 30, '“Gentle guitar music”', 0, 0, { size: 13 });
      k.link([[110, 38], [110, 58]], 0); k.node(36, 58, 150, 30, 'Text encoder', 0, 0);
      const vec = k.group(0, 2); [.3, -.6, .8, .1, -.2, .7, -.5, .4].forEach((v, i) => el('rect', { x: 210 + i * 15, y: 64, width: 13, height: 18, rx: 2, fill: k.valueColor(v) }, vec.g)); k.link([[186, 73], [208, 73]], 0);
      const dec = k.node(14, 112, 332, 74, '', 1, 2, { rx: 14 }); k.text(26, 130, 'Transformer decoder', { anchor: 'start', size: 12, weight: 700, parent: dec.g }); k.link([[270, 82], [270, 112]], 1, 2, { dashed: true }); k.link([[110, 88], [110, 112]], 1);
      const R = rng(5), codes = [0, 1, 2, 3].map(() => Array.from({ length: 10 }, () => String(Math.floor(R() * 1024)).padStart(3, '0')));
      const ctxT = [0, 1, 2].map(i => k.node(30 + i * 62, 142, 54, 28, '', 1, 2, { rx: 6, size: 10 })), nextN = k.node(232, 140, 96, 32, 'next ?', 1, 2, { size: 12 });
      const ctxTxt = ctxT.map(n => k.text(n.x + n.w / 2, n.y + 18, '', { size: 10.5, weight: 700, parent: n.g }));
      const grid = k.group(1, 2), cells = [];
      ['coarse 1', '2', '3', 'fine 4'].forEach((s, r) => { k.text(64, 224 + r * 27, s, { anchor: 'end', size: 10, fill: 'rgba(255,255,255,.75)', parent: grid.g });
        for (let c = 0; c < 10; c++) { const x = 70 + c * 27, y = 208 + r * 27, rr = el('rect', { x, y, width: 25, height: 23, rx: 4, class: 'code' }, grid.g), t = k.text(x + 12.5, y + 15.5, codes[r][c], { size: 8.5, weight: 700, parent: grid.g }); cells.push({ r, c, rr, t }); } });
      k.text(180, 326, 'one column = one time step (≈ 1/50 second)', { size: 10, fill: 'rgba(255,255,255,.7)', parent: grid.g });
      k.link([[180, 186], [180, 204]], 1, 2); k.link([[342, 260], [352, 260], [352, 156], [328, 156]], 2, 2, { n: 3, dashed: true });
      k.link([[180, 334], [180, 352]], 3); k.node(90, 352, 180, 32, 'Audio codec decoder', 3, 3);
      const wv = k.group(3, 3); el('rect', { x: 14, y: 400, width: 332, height: 120, rx: 12, class: 'nb' }, wv.g); const wave = el('path', { d: '', fill: 'none', stroke: k.accent, 'stroke-width': 1.4 }, wv.g), head = el('line', { x1: 14, y1: 404, x2: 14, y2: 516, stroke: '#fff', 'stroke-width': 1.5 }, wv.g);
      k.text(180, 540, 'the waveform of the sound you hear', { size: 10, fill: 'rgba(255,255,255,.7)', parent: wv.g }); k.link([[180, 384], [180, 400]], 3);
      // min/max envelope of the real synthesised buffer, 2 px per column
      const cols = 166, env = Array.from({ length: cols }, (_, i) => { let lo = 0, hi = 0; const a = Math.floor(i * soundWave.length / cols), b = Math.floor((i + 1) * soundWave.length / cols); for (let j = a; j < b; j++) { lo = Math.min(lo, soundWave[j]); hi = Math.max(hi, soundWave[j]); } return [lo, hi]; });
      return { update(si, p) {
        // delay pattern: stream r starts r steps later
        const filled = si < 1 ? -1 : si === 1 ? Math.floor(p * 3) : si === 2 ? 3 + Math.floor(ease(p) * 10) : 13;
        cells.forEach(({ r, c, rr, t }) => { const on = c + r <= filled; rr.setAttribute('class', on ? (c + r === filled && si <= 2 ? 'code new' : 'code on') : 'code'); t.setAttribute('opacity', on ? 1 : 0); });
        const col = Math.max(0, Math.min(9, filled)); ctxTxt.forEach((t, i) => { const c = col - 3 + i; t.textContent = c >= 0 ? codes[0][c] : '…'; });
        const shown = si < 3 ? 0 : si > 3 ? cols : Math.floor(clamp(p * 1.25) * cols);
        let d = ''; for (let i = 0; i < shown; i++) { const x = 18 + i * 2, [lo, hi] = env[i]; d += `M${x},${(460 - hi * 52).toFixed(1)}V${(460 - lo * 52).toFixed(1)}`; } wave.setAttribute('d', d); head.setAttribute('x1', 18 + shown * 2); head.setAttribute('x2', 18 + shown * 2); head.setAttribute('opacity', si === 3 && shown < cols ? 1 : 0);
      } };
    } }
};

// ---------- playback ----------
const card = document.getElementById('ar-explain'), phaseEl = card.querySelector('.ar-xp-phase'), countEl = card.querySelector('.ar-xp-count'), titleEl = card.querySelector('h3'), textEl = card.querySelector('p'),
  dotsEl = card.querySelector('.ar-xp-dots'), toggle = document.getElementById('ar-xp-toggle'), linkEl = card.querySelector('.ar-xp-link');
let current = null, key = null, scene = null, k = null, starts = [], total = 0, t = 0, playing = false, last = 0, raf = 0, stepShown = -1, soundDone = false, closing = 0;
function columnRect() { const [x, y, w, h] = AREA[key], q = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => PosterAR.toScreen(px, py)); if (q.some(p => !p)) return null; const xs = q.map(p => p.x), ys = q.map(p => p.y); return { q, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
// The full-screen view grows out of (and shrinks back into) the printed column.
function fly(open) {
  const r = columnRect(), box = net.getBoundingClientRect(), from = r && box.width ? `translate(${r.x - box.left}px,${r.y - box.top}px) scale(${r.w / box.width},${r.h / box.height})` : 'scale(.92)';
  net.style.transition = 'none';
  if (open) { net.style.transform = from; net.style.opacity = '.2'; void net.offsetWidth; net.style.transition = ''; net.style.transform = ''; net.style.opacity = ''; }
  else { net.style.transition = ''; net.style.transform = from; net.style.opacity = '0'; }
}
function stopExplain() {
  silence(); cancelAnimationFrame(raf); raf = 0; playing = false; const was = current; current = null; scene = null;
  card.hidden = true; dialog.classList.remove('net-open'); stage.classList.remove('explaining'); plane.classList.remove('explaining'); document.querySelectorAll('.ar-play').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (was && !net.hidden) { fly(false); clearTimeout(closing); closing = setTimeout(() => { if (!current) { net.hidden = true; svg.textContent = ''; dim.classList.remove('on'); } }, 420); } else { net.hidden = true; svg.textContent = ''; dim.classList.remove('on'); }
}
function start(which) {
  stopExplain(); clearTimeout(closing); key = which; current = NETWORKS[which]; t = 0; stepShown = -1; soundDone = false;
  starts = []; total = 0; current.steps.forEach(s => { starts.push(total); total += s.dur; });
  svg.textContent = ''; svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`); svg.style.setProperty('--accent', current.accent); k = kit(el('g', {}, svg), current.accent); scene = current.build(k);
  netTitle.textContent = current.name; netInput.textContent = '“' + current.input + '”';
  dotsEl.textContent = ''; current.steps.forEach(() => dotsEl.appendChild(document.createElement('i'))); linkEl.hidden = true;
  net.hidden = false; card.hidden = false; dialog.classList.add('net-open'); stage.classList.add('explaining'); plane.classList.add('explaining'); updateDim(); fly(true);
  document.querySelector(`.ar-play[data-ar-play="${which}"]`)?.setAttribute('aria-pressed', 'true');
  playing = true; toggle.dataset.state = 'pause'; toggle.setAttribute('aria-label', 'Pause'); last = performance.now(); tick(last);
}
function setPlaying(on) { if (!on) silence(); playing = on; toggle.setAttribute('aria-label', on ? 'Pause' : 'Play'); toggle.dataset.state = on ? 'pause' : 'play'; last = performance.now(); if (on && !raf) raf = requestAnimationFrame(tick); }
function seekStep(i) { if (!current) return; silence(); i = Math.max(0, Math.min(current.steps.length - 1, i)); t = starts[i] + 1; stepShown = -1; soundDone = false; linkEl.hidden = true; if (!playing) setPlaying(true); tick(performance.now()); }
function stepIndex() { let i = 0; while (i + 1 < starts.length && t >= starts[i + 1]) i++; return i; }
function tick(now) {
  cancelAnimationFrame(raf); raf = 0; if (!current) return;
  if (playing) t += Math.min(80, now - last); last = now;
  const ended = t >= total; if (ended) { t = total; if (playing) { playing = false; toggle.dataset.state = 'replay'; toggle.setAttribute('aria-label', 'Replay'); linkEl.hidden = false; } }
  const si = stepIndex(), step = current.steps[si], p = clamp((t - starts[si]) / step.dur);
  if (si !== stepShown) { stepShown = si; phaseEl.textContent = step.phase; phaseEl.dataset.phase = step.phase.toLowerCase(); countEl.textContent = `${current.name} · ${si + 1}/${current.steps.length}`; titleEl.textContent = step.title; textEl.textContent = step.text; [...dotsEl.children].forEach((d, i) => d.className = i < si ? 'done' : i === si ? 'now' : ''); }
  if (step.sound && playing && !soundDone) { soundDone = true; playSound(); }
  paint(k, ended ? current.steps.length : si, now); scene.update(ended ? current.steps.length : si, p, now);
  raf = requestAnimationFrame(tick);
}
// Behind the full-screen view, the rest of the camera image is dimmed around the printed column.
function updateDim() {
  if (!current) { dim.classList.remove('on'); return; }
  const r = columnRect(), box = stage.getBoundingClientRect(); if (!r) { dim.classList.remove('on'); return; }
  dim.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); dimPath.setAttribute('d', `M-10,-10H${box.width + 10}V${box.height + 10}H-10Z M${r.q.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L')}Z`); dim.classList.add('on');
}
PosterAR.onRender(updateDim); PosterAR.onStop(stopExplain);
document.querySelectorAll('.ar-play').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.arPlay === 'audio' && !audio) { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); } catch { audio = null; } }
  start(b.dataset.arPlay);
}));
toggle.addEventListener('click', () => { if (!current) return; if (toggle.dataset.state === 'replay') seekStep(0); else setPlaying(!playing); });
document.getElementById('ar-xp-prev').addEventListener('click', () => seekStep(stepIndex() - 1));
document.getElementById('ar-xp-next').addEventListener('click', () => seekStep(stepIndex() + 1));
document.getElementById('ar-xp-close').addEventListener('click', stopExplain);
linkEl.addEventListener('click', () => PosterAR.stop());
window.PosterExplain = { networks: NETWORKS, start, stop: stopExplain, state: () => ({ network: current && current.name, step: current ? stepIndex() : -1, t, total, playing }) };
})();
