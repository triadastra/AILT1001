'use strict';
/* "Play" explanations for the four printed model paths.
 * Everything is drawn in poster units (1682 x 2378) inside #poster-plane, so it stays
 * registered to the printed diagram. The rest of the view is dimmed in screen space. */
(() => {
const NS = 'http://www.w3.org/2000/svg', W = 1682, H = 2378;
const plane = document.getElementById('poster-plane'), stage = document.querySelector('#scanner .ar-stage'), dock = document.querySelector('#scanner .ar-dock');
if (!plane || !stage || !window.PosterAR) return;
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const layer = el('svg', { class: 'ar-explain', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, plane);
const dim = el('svg', { id: 'ar-dim', 'aria-hidden': 'true' }); stage.insertBefore(dim, plane); const dimPath = el('path', { 'fill-rule': 'evenodd' }, dim);
const R = (x, y, w, h) => [x, y, w, h];

// ---------- the four printed columns (poster units, measured on the print PDF) ----------
const SECTIONS = {
  text: { name: 'Text', color: '#d6a6e6', ink: '#7b3a9c', area: R(100, 316, 322, 492), link: '?s=models#explore', steps: [
    { phase: 'Preprocess', title: 'Split text into tokens', text: 'The prompt is cut into small pieces called tokens: “A” · “musician” · “plays”.', dur: 3600,
      items: [{ seq: [R(145, 400, 39, 27), R(191, 400, 122, 27), R(320, 400, 81, 27)] }] },
    { phase: 'Preprocess', title: 'Embeddings', text: 'Each token becomes a list of numbers, plus a signal for its position in the sentence.', dur: 3600,
      items: [{ flow: [[165, 427], [190, 441]] }, { flow: [[252, 427], [205, 441]] }, { flow: [[360, 427], [228, 441]] }, { noise: R(162, 442, 76, 31), grid: [4, 3], tint: true }, { box: R(158, 435, 250, 45), at: [.35, 1] }] },
    { phase: 'Propagate', title: 'Masked attention', text: 'Each attention head looks back at earlier words only, and weighs which ones matter for the next word.', dur: 4600,
      items: [{ flow: [[273, 478], [273, 496]], at: [0, .3] }, { box: R(148, 496, 262, 24), at: [.05, 1] }, { seq: [R(175, 520, 50, 60), R(250, 520, 44, 60), R(324, 520, 44, 60)], at: [.2, .9] }, { flow: [[200, 580], [272, 598], [272, 610]], at: [.75, 1] }, { flow: [[346, 580], [272, 598], [272, 610]], at: [.75, 1] }] },
    { phase: 'Propagate', title: 'Combine, refine — repeat ×N', text: 'Heads are combined, a feed-forward layer refines every token, and residual paths keep the original signal. The whole layer repeats N times.', dur: 5200,
      items: [{ seq: [R(166, 609, 216, 26), R(175, 637, 215, 19), R(175, 657, 222, 36), R(175, 694, 215, 19)], at: [0, .55] }, { flow: [[272, 633], [272, 712]], at: [0, .55] },
        { flow: [[405, 494], [405, 647], [372, 647]], at: [.15, .55] }, { flow: [[405, 650], [405, 703], [372, 703]], at: [.3, .6] }, { flow: [[272, 712], [132, 712], [132, 505], [272, 505]], at: [.55, 1], n: 4 }, { box: R(104, 612, 28, 26), at: [.55, 1] }] },
    { phase: 'Result', title: 'Choose the next token', text: 'A final linear layer and softmax score every possible token. “guitar” scores higher than “piano”, so it is chosen.', dur: 4200,
      items: [{ box: R(150, 714, 252, 23) }, { bar: R(207, 741, 91, 9), at: [.15, .7] }, { bar: R(207, 755, 33, 9), at: [.15, .5] }, { flow: [[300, 746], [323, 752]], at: [.6, 1] }, { box: R(323, 737, 84, 31), at: [.65, 1], strong: true }] },
    { phase: 'Result', title: 'Append and repeat', text: '“guitar” is added to the text, and the whole network runs again to choose the following word.', dur: 4000,
      items: [{ flow: [[364, 768], [364, 777], [121, 777], [121, 413], [145, 413]], n: 4 }, { seq: [R(145, 400, 39, 27), R(191, 400, 122, 27), R(320, 400, 81, 27), R(323, 737, 84, 31)], at: [.45, 1] }] }
  ] },
  image: { name: 'Image', color: '#9cc8ff', ink: '#1f5fb8', area: R(494, 316, 334, 500), link: '?s=models#explore', cover: [{ noise: R(695, 754, 97, 54), grid: [9, 5], clear: [4, .2, 1] }], steps: [
    { phase: 'Preprocess', title: 'Encode the prompt', text: '“Armoured figure in a forest” is turned into numbers by a text encoder. These numbers guide every later step.', dur: 4000,
      items: [{ box: R(509, 441, 267, 29), at: [0, .45] }, { flow: [[642, 470], [642, 482]], at: [.3, .6] }, { box: R(514, 482, 257, 39), at: [.45, 1] }, { box: R(681, 492, 62, 19), at: [.6, 1], strong: true }] },
    { phase: 'Preprocess', title: 'Start with noise', text: 'The picture starts as pure random noise in a small, compressed “latent” space—not as pixels.', dur: 3600,
      items: [{ noise: R(520, 534, 46, 37), grid: [5, 4], keep: true, clear: [3, 0, 1] }, { box: R(518, 532, 50, 41) }] },
    { phase: 'Propagate', title: 'The U-Net predicts the noise', text: 'The U-Net shrinks the latent to see the big picture, expands it again, and uses skip connections to keep details. The text steers it.', dur: 5400,
      items: [{ flow: [[543, 571], [543, 597]], at: [0, .2] }, { seq: [R(522, 597, 48, 44), R(566, 645, 42, 31), R(624, 680, 54, 19), R(694, 645, 42, 31), R(744, 597, 47, 44)], at: [.1, .8] },
        { flow: [[546, 619], [546, 660], [587, 660], [587, 690], [651, 690], [715, 690], [715, 660], [767, 660], [767, 619]], at: [.1, .85] }, { flow: [[570, 620], [744, 620]], at: [.5, .95] }, { flow: [[608, 661], [694, 661]], at: [.45, .9] },
        { flow: [[642, 521], [817, 521], [817, 690], [692, 690]], at: [.2, .8], color: '#ffffff' }, { box: R(555, 701, 180, 20), at: [.75, 1] }] },
    { phase: 'Propagate', title: 'Remove a little noise, repeat', text: 'The sampler subtracts some of the predicted noise and loops back to the U-Net. After many steps, a clean latent remains.', dur: 5200,
      items: [{ flow: [[791, 620], [801, 620], [801, 731], [765, 731]], at: [0, .25] }, { box: R(524, 723, 240, 26), at: [.1, 1] }, { flow: [[524, 736], [499, 736], [499, 562], [517, 562]], at: [.2, 1], n: 4 }, { flow: [[543, 571], [543, 597]], at: [.3, 1] }] },
    { phase: 'Result', title: 'Decode the pixels', text: 'The VAE decoder turns the clean latent into a full-resolution image. Here, that image then guides the video.', dur: 4400,
      items: [{ flow: [[592, 749], [592, 761]], at: [0, .25] }, { box: R(518, 761, 148, 31), at: [.1, .7] }, { flow: [[667, 777], [695, 777]], at: [.4, .7] }, { box: R(695, 754, 97, 54), at: [.6, 1], strong: true }] }
  ] },
  video: { name: 'Video', color: '#b9e08c', ink: '#3f7d16', area: R(858, 316, 344, 500), link: '?s=models#explore', cover: [{ noise: R(884, 727, 77, 50), grid: [7, 5], clear: [4, .1, .45] }, { noise: R(976, 727, 78, 50), grid: [7, 5], clear: [4, .35, .7] }, { noise: R(1070, 727, 77, 50), grid: [7, 5], clear: [4, .6, .95] }], steps: [
    { phase: 'Preprocess', title: 'Encode the prompt', text: '“Armoured figure turns” becomes text numbers that steer the whole clip.', dur: 3600,
      items: [{ box: R(877, 441, 268, 29), at: [0, .5] }, { flow: [[1011, 470], [1011, 482]], at: [.3, .6] }, { box: R(882, 482, 258, 39), at: [.45, 1] }, { box: R(1050, 492, 61, 19), at: [.6, 1], strong: true }] },
    { phase: 'Preprocess', title: 'Noisy frames → patch tokens', text: 'Every frame of the clip starts as noise, then is split into small patches that act like tokens.', dur: 4200,
      items: [{ noise: R(892, 536, 78, 43), grid: [6, 4], keep: true, clear: [3, 0, 1] }, { box: R(890, 515, 101, 66) }, { box: R(1013, 533, 184, 36), at: [.4, 1] }] },
    { phase: 'Propagate', title: 'Attend across space AND time', text: 'The diffusion transformer lets each patch look at patches in the same frame and in other frames, so motion stays consistent.', dur: 5400,
      items: [{ flow: [[933, 579], [933, 592]], at: [0, .2] }, { box: R(891, 592, 249, 80), at: [.05, 1] }, { seq: [R(905, 625, 17, 12), R(932, 625, 17, 12), R(960, 625, 17, 12), R(985, 625, 17, 12), R(1030, 647, 17, 12), R(1057, 647, 17, 12), R(1085, 647, 17, 12), R(1111, 647, 17, 12)], at: [.15, .6] },
        { arcs: [[[913, 631], [1038, 653]], [[940, 631], [1093, 653]], [[968, 631], [1065, 653]], [[993, 631], [1119, 653]], [[913, 631], [968, 631]], [[1038, 653], [1119, 653]]], at: [.45, 1] },
        { flow: [[1145, 521], [1155, 521], [1155, 632], [1140, 632]], at: [.2, .7], color: '#ffffff' }] },
    { phase: 'Propagate', title: 'Clean the clip, repeat', text: 'The sampler removes a little noise from the whole clip latent each step, then feeds it back in.', dur: 4600,
      items: [{ flow: [[1015, 672], [1015, 683]], at: [0, .25] }, { box: R(883, 683, 265, 25), at: [.1, 1] }, { flow: [[883, 695], [865, 695], [865, 551], [890, 551]], at: [.2, 1], n: 4 }] },
    { phase: 'Result', title: 'Decode frames in time order', text: 'The video VAE decodes the clean latent into real frames, one after another in time order.', dur: 4800,
      items: [{ flow: [[1015, 708], [1015, 727]], at: [0, .2] }, { seq: [R(884, 727, 77, 50), R(976, 727, 78, 50), R(1070, 727, 77, 50)], at: [.1, .95], strong: true }, { flow: [[961, 752], [976, 752]], at: [.35, .55] }, { flow: [[1054, 752], [1070, 752]], at: [.6, .8] }] }
  ] },
  audio: { name: 'Audio', color: '#f2d27c', ink: '#9a6c00', area: R(1238, 316, 314, 492), link: '?s=models#explore', steps: [
    { phase: 'Preprocess', title: 'Encode the prompt', text: '“Gentle guitar music” becomes text numbers for the decoder to follow.', dur: 3600,
      items: [{ box: R(1245, 441, 268, 29), at: [0, .5] }, { flow: [[1380, 470], [1380, 482]], at: [.3, .6] }, { box: R(1250, 482, 258, 39), at: [.45, 1] }, { flow: [[1380, 521], [1380, 536]], at: [.8, 1] }] },
    { phase: 'Propagate', title: 'Predict the next sound token', text: 'Like the text model, a transformer decoder predicts what comes next—but its tokens are compact sound codes.', dur: 4400,
      items: [{ box: R(1252, 536, 255, 80) }, { seq: [R(1282, 570, 27, 18), R(1329, 570, 26, 18), R(1375, 570, 26, 18), R(1431, 568, 45, 33)], at: [.1, .9] }, { flow: [[1295, 592], [1430, 592]], at: [.55, .95] }] },
    { phase: 'Propagate', title: 'Fill four code streams', text: 'Each step adds codes to 4 parallel streams, from coarse to fine detail. New codes are fed back to predict the next ones.', dur: 5200,
      items: [{ flow: [[1380, 616], [1380, 646]], at: [0, .2] }, { box: R(1255, 621, 250, 21), at: [0, .4] }, { fill: [1425, 1457], rows: [648, 666, 683, 701], colors: ['#c9a0c0', '#a9c0dc', '#b9cfa3', '#e5cf8c'], at: [.15, .85] }, { flow: [[1492, 692], [1523, 692], [1523, 576], [1508, 576]], at: [.3, 1], n: 3 }] },
    { phase: 'Result', title: 'Decode an audible waveform', text: 'The audio codec decoder turns the codes into a sound wave you can hear. (The sound played here is illustrative, not model output.)', dur: 5200,
      items: [{ flow: [[1486, 705], [1543, 705], [1543, 756], [1507, 756]], at: [0, .3] }, { box: R(1252, 743, 254, 26), at: [.2, .7] }, { flow: [[1380, 769], [1380, 777]], at: [.45, .6] }, { wave: R(1257, 777, 248, 23), at: [.5, 1] }, { sound: true, at: [.5, 1] }] }
  ] }
};

// ---------- drawing primitives ----------
const clamp = v => Math.max(0, Math.min(1, v)), ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function pointAt(pts, d) { for (let i = 1; i < pts.length; i++) { const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= s || i === pts.length - 1) { const f = s ? Math.min(1, d / s) : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; } d -= s; } return pts[0]; }
let rand = 1; const random = () => (rand = (Math.imul(rand, 1664525) + 1013904223) >>> 0) / 4294967296;
function build(item, color, g, ink = '#172a27') {
  const o = { item };
  if (item.box || item.seq) {
    o.rects = (item.box ? [item.box] : item.seq).map(([x, y, w, h]) => ({ halo: el('rect', { x: x - 5, y: y - 5, width: w + 10, height: h + 10, rx: 9, fill: 'none', stroke: color, 'stroke-width': 12, opacity: 0 }, g), core: el('rect', { x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 7, fill: color, 'fill-opacity': 0, stroke: ink, 'stroke-width': 4, opacity: 0 }, g) }));
  } else if (item.flow) {
    o.len = polyLength(item.flow); o.track = el('polyline', { points: item.flow.map(p => p.join(',')).join(' '), fill: 'none', stroke: ink, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': '2 9', opacity: 0 }, g);
    o.dots = Array.from({ length: item.n || 3 }, () => ({ halo: el('circle', { r: 14, fill: color, opacity: 0 }, g), core: el('circle', { r: 7, fill: '#fff', stroke: ink, 'stroke-width': 3.5, opacity: 0 }, g) }));
  } else if (item.noise) {
    const [x, y, w, h] = item.noise, [c, r] = item.grid, cw = w / c, ch = h / r; o.cells = [];
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) o.cells.push({ e: el('rect', { x: x + i * cw, y: y + j * ch, width: cw + .6, height: ch + .6, fill: '#888', opacity: 0 }, g), order: random() }); o.tint = item.tint ? ink : null;
  } else if (item.bar) { const [x, y, w, h] = item.bar; o.e = el('rect', { x, y, width: 0, height: h, rx: 3, fill: ink, stroke: '#fff', 'stroke-width': 2, opacity: 0 }, g); o.w = w; }
  else if (item.fill) { o.cells = []; item.rows.forEach((y, ri) => item.fill.forEach((x, ci) => o.cells.push({ e: el('rect', { x, y, width: 26, height: 12, rx: 3, fill: item.colors[ri], stroke: '#fff', 'stroke-width': 1.5, opacity: 0 }, g), k: ci * item.rows.length + ri }))); }
  else if (item.wave) { const [x, y, w, h] = item.wave, pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, env = Math.sin(Math.PI * t) ** .6; pts.push((x + t * w).toFixed(1) + ',' + (y + h / 2 + Math.sin(t * 58) * Math.cos(t * 13) * env * h * .48).toFixed(1)); } o.e = el('polyline', { points: pts.join(' '), fill: 'none', stroke: ink, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, g); o.len = w * 3.2; o.e.setAttribute('stroke-dasharray', o.len); }
  else if (item.arcs) { o.paths = item.arcs.map(([a, b]) => { const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - 30 - Math.abs(b[0] - a[0]) * .15, d = `M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`, L = Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.4 + 40; const p = el('path', { d, fill: 'none', stroke: ink, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': L, 'stroke-dashoffset': L, opacity: 0 }, g); p.L = L; return p; }); }
  return o;
}
// local = progress inside this item's window (<0 before, >1 after); now = ms clock for pulsing
function draw(o, local, now) {
  const it = o.item, active = local >= 0 && local <= 1, done = local > 1, pulse = .75 + .25 * Math.sin(now / 160);
  if (o.rects) {
    const n = o.rects.length;
    o.rects.forEach((r, i) => { const s = it.seq ? i / n : 0, on = local >= s, current = active && (!it.seq || local < (i + 1) / n || i === n - 1);
      const op = !on && !done ? 0 : current ? 1 : .5; r.halo.setAttribute('opacity', op * (current ? .75 * pulse : .15)); r.core.setAttribute('opacity', current ? 1 : op * .45); r.core.setAttribute('fill-opacity', current ? (it.strong ? .35 : .18) * pulse : 0); });
  } else if (o.dots) {
    o.track.setAttribute('opacity', active ? .9 : 0);
    o.dots.forEach((d, i) => { if (!active) { d.halo.setAttribute('opacity', 0); d.core.setAttribute('opacity', 0); return; } const ph = ((now / 1300) + i / o.dots.length) % 1, [x, y] = pointAt(it.flow, ph * o.len), fade = Math.min(1, ph * 6, (1 - ph) * 6);
      for (const c of [d.halo, d.core]) { c.setAttribute('cx', x); c.setAttribute('cy', y); } d.halo.setAttribute('opacity', .45 * fade); d.core.setAttribute('opacity', fade); });
  } else if (o.cells && it.noise) {
    const visible = it.cover || local >= 0, cleared = it.clearProgress || 0;
    o.cells.forEach(c => { if (!visible || c.order < cleared) { c.e.setAttribute('opacity', 0); return; } if (random() < .25) { if (o.tint) { c.e.setAttribute('fill', o.tint); c.e.setAttribute('fill-opacity', (.25 + random() * .75).toFixed(2)); } else { const v = 70 + (random() * 150 | 0); c.e.setAttribute('fill', `rgb(${v},${v},${v + 8})`); } } c.e.setAttribute('opacity', .95); });
  } else if (it.bar) { const p = done ? 1 : active ? ease(local) : 0; o.e.setAttribute('width', o.w * p); o.e.setAttribute('opacity', p ? 1 : 0); }
  else if (it.fill) { const total = o.cells.length; o.cells.forEach(c => c.e.setAttribute('opacity', done || (active && local * total > c.k) ? 1 : 0)); }
  else if (it.wave) { const p = done ? 1 : active ? ease(local) : 0; o.e.setAttribute('opacity', p ? 1 : 0); o.e.setAttribute('stroke-dashoffset', o.len * (1 - p)); }
  else if (o.paths) { o.paths.forEach((p, i) => { const s = i / o.paths.length * .6, q = done ? 1 : active ? clamp((local - s) / .4) : 0; p.setAttribute('opacity', q ? .95 : 0); p.setAttribute('stroke-dashoffset', p.L * (1 - ease(q))); }); }
}

// ---------- illustrative sound (soft plucked guitar notes, synthesised locally) ----------
let audio = null;
function pluck(freq, when, gain = .12) {
  if (!audio) return; const sr = audio.sampleRate, len = Math.floor(sr * 1.6), buf = audio.createBuffer(1, len, sr), d = buf.getChannelData(0), period = Math.round(sr / freq);
  for (let i = 0; i < period; i++) d[i] = Math.random() * 2 - 1; for (let i = period; i < len; i++) d[i] = (d[i - period] + d[i - period + 1]) * .497;
  const src = audio.createBufferSource(), g = audio.createGain(); g.gain.value = gain; src.buffer = buf; src.connect(g).connect(audio.destination); src.start(when);
}
function playChord() { if (!audio) return; try { audio.resume?.(); } catch {} const t = audio.currentTime + .05; [196, 246.9, 293.7, 392, 293.7, 246.9].forEach((f, i) => pluck(f, t + i * .32)); pluck(98, t, .08); }

// ---------- playback engine ----------
const card = document.getElementById('ar-explain'), phaseEl = card.querySelector('.ar-xp-phase'), countEl = card.querySelector('.ar-xp-count'), titleEl = card.querySelector('h3'), textEl = card.querySelector('p'),
  dotsEl = card.querySelector('.ar-xp-dots'), toggle = document.getElementById('ar-xp-toggle'), linkEl = card.querySelector('.ar-xp-link');
let current = null, objs = [], covers = [], starts = [], total = 0, t = 0, playing = false, last = 0, raf = 0, stepShown = -1, soundDone = false;
function stopExplain() {
  cancelAnimationFrame(raf); raf = 0; current = null; playing = false; layer.textContent = ''; objs = []; covers = []; plane.classList.remove('explaining'); stage.classList.remove('explaining');
  card.hidden = true; dim.classList.remove('on'); document.querySelectorAll('.ar-play').forEach(b => b.setAttribute('aria-pressed', 'false'));
}
function start(key) {
  stopExplain(); const s = SECTIONS[key]; current = s; rand = 7; soundDone = false; t = 0; stepShown = -1;
  const g = el('g', {}, layer); starts = []; total = 0; s.steps.forEach(step => { starts.push(total); total += step.dur; });
  objs = s.steps.flatMap((step, si) => step.items.map(item => ({ ...build(item, s.color, g, s.ink), si, at: item.at || [0, 1] })));
  covers = (s.cover || []).map(item => ({ ...build({ ...item, cover: true }, s.color, g, s.ink), at: [0, 1] }));
  dotsEl.textContent = ''; s.steps.forEach(() => dotsEl.appendChild(document.createElement('i')));
  plane.classList.add('explaining'); stage.classList.add('explaining'); card.hidden = false; dock.classList.add('quiet'); linkEl.hidden = true;
  document.querySelector(`.ar-play[data-ar-play="${key}"]`)?.setAttribute('aria-pressed', 'true');
  setPlaying(true); updateDim(); tick(performance.now());
}
function setPlaying(on) { playing = on; toggle.setAttribute('aria-label', on ? 'Pause' : 'Play'); toggle.dataset.state = on ? 'pause' : 'play'; last = performance.now(); if (on && !raf) raf = requestAnimationFrame(tick); }
function seekStep(i) { if (!current) return; i = Math.max(0, Math.min(current.steps.length - 1, i)); t = starts[i] + 1; stepShown = -1; soundDone = false; if (!playing) setPlaying(true); }
// clear = [step index, start fraction, end fraction] of the step during which noise dissolves
function clearAt(clear) { if (!clear) return 0; const [n, cs, ce] = clear, st = starts[n], dur = current.steps[n].dur; return clamp((t - (st + cs * dur)) / Math.max(1, (ce - cs) * dur)); }
function stepIndex() { let i = 0; while (i + 1 < starts.length && t >= starts[i + 1]) i++; return i; }
function tick(now) {
  raf = 0; if (!current) return;
  if (playing && !plane.hidden) t += Math.min(80, now - last); last = now;
  const ended = t >= total; if (ended) { t = total; if (playing) { playing = false; toggle.dataset.state = 'replay'; toggle.setAttribute('aria-label', 'Replay'); linkEl.hidden = false; linkEl.href = current.link; } }
  const si = stepIndex(), step = current.steps[si];
  if (si !== stepShown) { stepShown = si; phaseEl.textContent = step.phase; phaseEl.dataset.phase = step.phase.toLowerCase(); countEl.textContent = `${current.name} · ${si + 1}/${current.steps.length}`; titleEl.textContent = step.title; textEl.textContent = step.text; [...dotsEl.children].forEach((d, i) => d.className = i < si ? 'done' : i === si ? 'now' : ''); }
  for (const o of objs) { const st = starts[o.si], dur = current.steps[o.si].dur, a = st + o.at[0] * dur, b = st + o.at[1] * dur; let local = (t - a) / Math.max(1, b - a);
    if (o.si !== si && t < starts[o.si]) local = -1; // future steps hidden
    if (o.item.noise) o.item.clearProgress = clearAt(o.item.clear);
    if (o.item.sound && local >= 0 && local <= 1 && !soundDone && playing) { soundDone = true; playChord(); }
    draw(o, ended && !o.item.noise ? 2 : local, now);
  }
  for (const o of covers) { o.item.clearProgress = clearAt(o.item.clear); draw(o, .5, now); }
  if (playing || !ended) raf = requestAnimationFrame(tick);
}
// Screen-space dimming with a hole that follows the projected column.
function updateDim() {
  if (!current) { dim.classList.remove('on'); return; }
  const box = stage.getBoundingClientRect(), [x, y, w, h] = current.area, q = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => PosterAR.toScreen(px, py));
  if (q.some(p => !p)) { dim.classList.remove('on'); return; }
  dim.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); dimPath.setAttribute('d', `M-10,-10H${box.width + 10}V${box.height + 10}H-10Z M${q.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' L')}Z`); dim.classList.add('on');
}
PosterAR.onRender(updateDim); PosterAR.onStop(stopExplain);
document.querySelectorAll('.ar-play').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.arPlay === 'audio' && !audio) { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); } catch { audio = null; } }
  start(b.dataset.arPlay);
}));
toggle.addEventListener('click', () => { if (!current) return; if (toggle.dataset.state === 'replay') { seekStep(0); linkEl.hidden = true; } else setPlaying(!playing); });
document.getElementById('ar-xp-prev').addEventListener('click', () => seekStep(stepIndex() - 1));
document.getElementById('ar-xp-next').addEventListener('click', () => seekStep(stepIndex() + 1));
document.getElementById('ar-xp-close').addEventListener('click', stopExplain);
linkEl.addEventListener('click', () => PosterAR.stop());
window.PosterExplain = { sections: SECTIONS, start, stop: stopExplain, state: () => ({ section: current && current.name, step: current ? stepIndex() : -1, t, total, playing }) };
})();
