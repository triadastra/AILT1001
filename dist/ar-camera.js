'use strict';
(() => {
const $ = id => document.getElementById(id);
const dialog = $('scanner'), cam = $('camera-video'), plane = $('poster-plane'), status = $('scan-status'), quality = $('ar-quality'),
  stateChip = $('ar-state'), enable = $('enable-camera'), guide = $('ar-guide'), demoVideo = $('ar-demo-video'), sheet = $('ar-sheet'),
  switchCamera = $('switch-camera'), more = $('ar-more'), drawer = $('ar-drawer'), pointsCanvas = $('ar-points'),
  focusBar = $('ar-focus'), focusName = $('ar-focus-name'), focusActs = $('ar-focus-actions'),
  dock = dialog.querySelector('.ar-dock'), stage = dialog.querySelector('.ar-stage');
const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
let facing = 'environment', stream = null, worker = null, timer = null, session = 0, focusReturn = null, busy = false, lastGood = 0,
  pose = null, source = null, mode = 'off', misses = 0, current = null, target = null, raf = 0, quietTimer = 0, flashTimer = 0, wasLocked = false,
  flow = null, flowBusy = false, flowOk = false, gen = 0, frameId = 0, detAt = 0, detMisses = 0, searching = 0, wake = null;

// ---------- minimised dock ----------
function setState(state, text) { stateChip.dataset.state = state; quality.textContent = text; quality.classList.toggle('locked', state === 'locked'); }
function hint(text, { stay = false } = {}) {
  status.textContent = text; dock.classList.remove('quiet'); clearTimeout(quietTimer);
  if (!stay) quietTimer = setTimeout(() => dock.classList.add('quiet'), 2800);
}
function setDrawer(open) { drawer.hidden = !open; more.setAttribute('aria-expanded', String(open)); }
more.addEventListener('click', () => setDrawer(drawer.hidden));
stateChip.addEventListener('click', () => { dock.classList.toggle('quiet'); clearTimeout(quietTimer); });

// ---------- overlay ----------
function hideOverlay() { plane.hidden = true; pose = null; current = null; target = null; lastGood = 0; misses = 0; wasLocked = false; cancelAnimationFrame(raf); raf = 0; cancelAnimationFrame(aimRaf); aimRaf = 0; demoVideo.pause(); pending = null; zoom.s = 1; zoom.tx = zoom.ty = 0; paintZoom(); setFocus(null); renderHooks.forEach(f => f()); }
function baseViewport() {
  const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight, box = stage.getBoundingClientRect();
  return PosterTracking.viewport(sw, sh, box.width, box.height, mode === 'camera');
}
// Where the camera image is drawn, including the aim-to-focus zoom. Everything registered to the poster uses this.
function viewport() { const b = baseViewport(); return { width: b.width * zoom.s, height: b.height * zoom.s, left: b.left * zoom.s + zoom.tx, top: b.top * zoom.s + zoom.ty }; }

// ---------- aim to focus ----------
// Point the phone at a section of the poster: that section is enlarged to fill the screen (still locked to the paper),
// the rest is dimmed (ar-explain.js draws the dimming), and one large button starts its AR walkthrough.
const PW = PosterTracking.width, PH = PosterTracking.height, MAX_ZOOM = 3;
const AREAS = { text: [100, 316, 322, 492], image: [494, 316, 334, 500], video: [858, 316, 344, 500], audio: [1238, 316, 314, 492], cases: [48, 890, 1594, 840], impact: [30, 1740, 1622, 560] };
const FOCUS = {
  text: ['Text model', [['Play', '.ar-play[data-ar-play="text"]']]], image: ['Image model', [['Play', '.ar-play[data-ar-play="image"]']]],
  video: ['Video model', [['Play', '.ar-play[data-ar-play="video"]']]], audio: ['Audio model', [['Play', '.ar-play[data-ar-play="audio"]']]],
  cases: ['From idea to release', [['Blue · good use', '.ar-case[data-mode="blue"]', 'blue'], ['Red · harmful use', '.ar-case[data-mode="red"]', 'red']]],
  impact: ['Pros & cons', [['Open', '[data-ar-section="impact"]']]]
};
const zoom = { s: 1, tx: 0, ty: 0 }; let focus = null, pending = null, pendingAt = 0, held = false, aimRaf = 0, aimLast = 0;
const between = (lo, hi, v) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
function invert(h) { const [a, b, c, d, e, f, g, k] = h, m = [e - f * k, c * k - b, b * f - c * e, f * g - d, a - c * g, c * d - a * f, d * k - e * g, b * g - a * k, a * e - b * d]; return Math.abs(m[8]) > 1e-12 ? m.slice(0, 8).map(v => v / m[8]) : null; }
// The poster point (in poster units) under the middle of the camera view. Measured before any zoom, so zooming cannot change it.
function aimPoint() {
  if (!pose || !source) return null; const inv = invert(pose); if (!inv) return null;
  const b = baseViewport(), box = stage.getBoundingClientRect(), u = (box.width / 2 - b.left) / b.width, v = (box.height * .46 - b.top) / b.height, d = inv[6] * u + inv[7] * v + 1;
  return d > 0 ? { x: (inv[0] * u + inv[1] * v + inv[2]) / d * PW, y: (inv[3] * u + inv[4] * v + inv[5]) / d * PH } : null;
}
function setFocus(k) {
  if (k === focus) return; focus = k; if (k) dialog.dataset.focus = k; else delete dialog.dataset.focus;
  if (focusBar) { focusBar.hidden = !k; focusActs.textContent = '';
    if (k) { focusName.textContent = FOCUS[k][0];
      for (const [label, selector, tone] of FOCUS[k][1]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (tone) b.dataset.mode = tone; b.addEventListener('click', () => plane.querySelector(selector)?.click()); focusActs.appendChild(b); } } }
}
function paintZoom() {
  if (held) return;
  if (mode === 'preview' && source) { const v = viewport(); stage.style.backgroundSize = v.width.toFixed(1) + 'px ' + v.height.toFixed(1) + 'px'; stage.style.backgroundPosition = v.left.toFixed(1) + 'px ' + v.top.toFixed(1) + 'px'; }
  else cam.style.transform = zoom.s === 1 && !zoom.tx && !zoom.ty ? '' : 'translate(' + zoom.tx.toFixed(1) + 'px,' + zoom.ty.toFixed(1) + 'px) scale(' + zoom.s.toFixed(4) + ')';
}
function aimTick(now) {
  aimRaf = 0; if (!pose || !source || held) return;
  const dt = Math.max(0, Math.min(100, now - aimLast)); aimLast = now;
  const b = baseViewport(), box = stage.getBoundingClientRect(), W = box.width, H = box.height;
  let hit = null; const at = aimPoint(); // the section under the middle of the camera view
  if (at) for (const k in AREAS) { const [ax, ay, aw, ah] = AREAS[k], m = k === focus ? 45 : -12; if (at.x > ax - m && at.x < ax + aw + m && at.y > ay - m && at.y < ay + ah + m) { hit = k; break; } }
  if (!plane.classList.contains('explaining')) { if (hit !== pending) { pending = hit; pendingAt = now; } if (pending !== focus && now - pendingAt > (pending ? 380 : 700)) setFocus(pending); }
  let s = 1, tx = 0, ty = 0;
  if (focus) {
    const [ax, ay, aw, ah] = AREAS[focus]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [px, py] of [[ax, ay], [ax + aw, ay], [ax + aw, ay + ah], [ax, ay + ah]]) { const q = PosterTracking.project(pose, px / PW, py / PH), sx = b.left + q.x * b.width, sy = b.top + q.y * b.height; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
    const dockH = dock.getBoundingClientRect().height, fx0 = 10, fx1 = W - 10, fy0 = 10, fy1 = Math.max(H * .45, H - Math.min(dockH, H * .4) - 10);
    s = Math.max(1, Math.min(MAX_ZOOM, (fx1 - fx0) / Math.max(1, x1 - x0), (fy1 - fy0) / Math.max(1, y1 - y0)));
    tx = (fx0 + fx1) / 2 - s * (x0 + x1) / 2; ty = (fy0 + fy1) / 2 - s * (y0 + y1) / 2;
    if (mode === 'camera') { tx = between(W - (b.left + b.width) * s, -b.left * s, tx); ty = between(H - (b.top + b.height) * s, -b.top * s, ty); } // never show past the edge of the camera image
  }
  const a = dt ? 1 - Math.exp(-dt / 170) : 0; zoom.s += (s - zoom.s) * a; zoom.tx += (tx - zoom.tx) * a; zoom.ty += (ty - zoom.ty) * a;
  if (Math.abs(s - zoom.s) < .002 && Math.abs(tx - zoom.tx) < .3 && Math.abs(ty - zoom.ty) < .3) { zoom.s = s; zoom.tx = tx; zoom.ty = ty; }
  paintZoom(); render();
  aimRaf = requestAnimationFrame(aimTick);
}
// Blue / Red draws its own 3D scene at true scale: the focus zoom steps aside while it runs.
function hold(on) {
  held = !!on; if (held) { zoom.s = 1; zoom.tx = zoom.ty = 0; cam.style.transform = ''; if (mode === 'preview') { stage.style.backgroundSize = 'contain'; stage.style.backgroundPosition = 'center'; } render(); }
  else if (pose && !aimRaf) { aimLast = performance.now(); aimRaf = requestAnimationFrame(aimTick); }
}
const renderHooks = [], stopHooks = [];
function render() {
  if (!pose || !source) return;
  const v = viewport(), m = PosterTracking.cssMatrix(pose, v.width, v.height, v.left, v.top);
  plane.style.transform = 'matrix3d(' + m.join(',') + ')';
  renderHooks.forEach(f => f());
}
const cornersOf = h => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => PosterTracking.project(h, x, y));
// Adaptive smoothing: small jitter is damped, real movement follows immediately.
function step() {
  raf = 0; if (!current || !target) return;
  let moving = false;
  current = current.map((c, i) => {
    const t = target[i], d = Math.hypot(t.x - c.x, t.y - c.y), a = Math.min(1, .35 + d * 25);
    if (d > 1e-4) moving = true;
    return { x: c.x + (t.x - c.x) * a, y: c.y + (t.y - c.y) * a };
  });
  pose = PosterTracking.fromCorners(current) || pose; render();
  if (moving) raf = requestAnimationFrame(step);
}
function applyPose(h, corners) {
  const next = corners && corners.length === 4 ? corners : cornersOf(h);
  if (!aimRaf && !held) { aimLast = performance.now(); aimRaf = requestAnimationFrame(aimTick); }
  if (!current) { current = next; target = next; pose = h; render(); return; }
  target = next; if (!raf) raf = requestAnimationFrame(step);
}
function flashPoints(points) {
  if (!points || !points.length || !source) return;
  const box = stage.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), v = viewport();
  pointsCanvas.width = Math.round(box.width * dpr); pointsCanvas.height = Math.round(box.height * dpr);
  const g = pointsCanvas.getContext && pointsCanvas.getContext('2d'); if (!g || !g.arc) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, box.width, box.height); g.fillStyle = 'rgba(255,255,255,.95)'; g.shadowColor = 'rgba(127,240,176,.9)'; g.shadowBlur = 6;
  for (let i = 0; i < points.length; i += 2) { g.beginPath(); g.arc(v.left + points[i] * v.width, v.top + points[i + 1] * v.height, 2.2, 0, Math.PI * 2); g.fill(); }
  pointsCanvas.classList.add('show'); clearTimeout(flashTimer); flashTimer = setTimeout(() => pointsCanvas.classList.remove('show'), 700);
}

// ---------- session lifecycle ----------
function stop() {
  session++; clearTimeout(timer); if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; cam.srcObject = null;
  if (worker) worker.terminate(); worker = null; busy = false; if (flow) flow.terminate(); flow = null; flowBusy = false; flowOk = false; detMisses = 0; searching = 0;
  try { wake?.release?.(); } catch {} wake = null; held = false; source = null; mode = 'off'; cam.hidden = false; hideOverlay();
  enable.disabled = false; enable.hidden = false; switchCamera.hidden = true; guide.hidden = false; setState('off', 'Camera off');
  stage.style.backgroundImage = 'none'; stopHooks.forEach(f => f());
}
function close() { stop(); sheet.hidden = true; setDrawer(false); dialog.close(); if (document.fullscreenElement === dialog) document.exitFullscreen?.().catch(() => {}); focusReturn?.focus(); }
function open(button) { focusReturn = button; sheet.hidden = true; setDrawer(false); hint('Point your camera at the poster. Any part of it works.', { stay: true }); dialog.showModal(); }
// The one button on the page: open the AR view and start the camera in the same tap.
document.querySelectorAll('[data-camera]').forEach(b => b.addEventListener('click', () => { open(b); startCamera(); }));
$('close-camera').addEventListener('click', close); dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
$('camera-fallback').addEventListener('click', close);

function describe(r) {
  if (r.method === 'markers') return r.count + '/4 corner markers';
  return r.count + ' points';
}
// ---------- tracking ----------
// Two workers. The detector (ar-worker.js) finds the poster from nothing, but takes a while per frame. The follower
// (ar-flow-worker.js) tracks the poster from one small frame to the next in a few milliseconds, so the overlay moves at the
// camera's frame rate; the detector then only has to check and correct it twice a second.
const SEARCH = [800, 1200, 440], MARKER_SIZE = 1600, FLOW_SIZE = 360, CHECK_EVERY = 500;
const flowCanvas = document.createElement('canvas'), flowCtx = flowCanvas.getContext('2d', { willReadFrequently: true });
function grab(c, g, long) {
  const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight, k = Math.min(1, long / Math.max(sw, sh));
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k)); g.drawImage(source, 0, 0, c.width, c.height);
  return { buffer: g.getImageData(0, 0, c.width, c.height).data.buffer, width: c.width, height: c.height };
}
function dropFollower() { flowOk = false; detMisses = 0; detAt = 0; gen++; flow?.postMessage({ type: 'reset' }); }
function startWorker(s) {
  if (mode === 'camera') {
    try {
      flow = new Worker('ar-flow-worker.js');
      flow.onmessage = e => {
        const m = e.data; if (s !== session || m.session !== session) return; if (!m.rebased) flowBusy = false; if (m.gen !== gen) return;
        if (m.ok) { flowOk = true; lastGood = performance.now(); if (wasLocked) applyPose(m.h); }
        else if (flowOk) { flowOk = false; detAt = 0; } // followed it off the frame or into blur: ask the detector straight away
      };
      flow.onerror = () => { try { flow?.terminate(); } catch {} flow = null; flowBusy = false; flowOk = false; };
    } catch { flow = null; }
  }
  worker = new Worker('ar-worker.js');
  worker.onmessage = e => {
    if (s !== session || e.data.session !== session) return;
    busy = false; const r = e.data;
    if (r.locked) {
      misses = 0; detMisses = 0; searching = 0; lastGood = performance.now();
      if (flow && r.id) flow.postMessage({ type: 'pose', session, gen, id: r.id, h: r.h }); // the follower carries this fix forward to the newest frame
      if (!flowOk) applyPose(r.h, r.corners);
      setState(mode === 'preview' ? 'preview' : 'locked', (mode === 'preview' ? 'Preview · ' : 'Locked · ') + describe(r));
      guide.hidden = true; plane.hidden = false;
      if (!wasLocked) {
        wasLocked = true; flashPoints(r.points);
        if (!plane.classList.contains('explaining')) hint(mode === 'preview' ? 'Preview only—this uses a poster image, not your camera. Aim at a section.' : 'Locked. Aim at a section of the poster.'); else dock.classList.add('quiet');
      }
      if (demoVideo.paused) demoVideo.play().catch(() => {});
    } else if (r.reason === 'error') {
      dropFollower(); hideOverlay(); guide.hidden = false; setState('search', 'Tracking error');
      hint('Tracking could not start. Read the citations without the camera.', { stay: true });
    } else {
      searching++;
      if (flowOk && ++detMisses < 4) { /* the follower still has the poster; a blurred or very close frame can miss */ }
      else if (++misses >= 2 || !wasLocked) {
        // One missed frame keeps the last pose; a second hides it.
        const had = wasLocked; dropFollower(); hideOverlay(); guide.hidden = false;
        setState('search', mode === 'preview' ? 'Preview · searching' : 'Searching…');
        if (had || status.textContent.startsWith('Locked')) hint('Lost the poster. Hold steady and keep part of it in view.', { stay: true });
      }
    }
  };
  worker.onerror = () => { busy = false; hideOverlay(); stop(); hint('Tracking is unavailable in this browser. Read the citations without the camera.', { stay: true }); };
}
// Preview: one full-size still image.
function frame() {
  if (!source || busy || !dialog.open) return;
  const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight;
  if (!sw || !sh) { timer = setTimeout(frame, 150); return; }
  const p = grab(canvas, ctx, 1920); busy = true; worker.postMessage({ ...p, session }, [p.buffer]);
}
// Camera: runs once per camera frame.
function pump(s) {
  if (s !== session || mode !== 'camera' || !source || !dialog.open) return;
  if (source.requestVideoFrameCallback) source.requestVideoFrameCallback(() => pump(s)); else timer = setTimeout(() => pump(s), 33);
  const sw = source.videoWidth, sh = source.videoHeight; if (!sw || !sh || !worker) return;
  const now = performance.now(); let id = 0;
  if (flow && !flowBusy) { id = ++frameId; const p = grab(flowCanvas, flowCtx, FLOW_SIZE); flowBusy = true; flow.postMessage({ type: 'frame', session, gen, id, ...p }, [p.buffer]); }
  // The detector needs the follower to hold the very same frame, so its answer can be carried forward.
  if (busy || (flow && !id) || (flowOk && now - detAt < CHECK_EVERY)) return;
  const markers = !flowOk && searching % 4 === 3; let size = markers ? MARKER_SIZE : SEARCH[searching % SEARCH.length];
  if (flowOk && pose) { const a = PosterTracking.project(pose, .5, 0), b = PosterTracking.project(pose, .5, 1), tall = Math.hypot((b.x - a.x) * sw, (b.y - a.y) * sh); size = Math.max(360, Math.min(1280, Math.round(Math.max(sw, sh) * 620 / Math.max(1, tall)))); }
  const p = grab(canvas, ctx, size); detAt = now; busy = true;
  worker.postMessage({ ...p, session, id, sized: true, markers, prior: flowOk && pose ? pose.slice(0, 8) : null }, [p.buffer]);
}
async function startCamera() {
  stop(); const s = ++session; enable.disabled = true; setDrawer(false); setState('search', 'Waiting for permission');
  hint('Allow camera access in your browser. You can close this at any time.', { stay: true });
  if (dialog.requestFullscreen) dialog.requestFullscreen().catch(() => {});
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Camera API unavailable'), { name: 'CameraUnavailable' });
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 2560 }, frameRate: { ideal: 30 }, aspectRatio: { ideal: Math.min(1, window.innerWidth / window.innerHeight) } }, audio: false });
    if (s !== session || !dialog.open) { acquired.getTracks().forEach(t => t.stop()); return; }
    stream = acquired; cam.srcObject = stream; await cam.play(); if (s !== session) return;
    source = cam; mode = 'camera'; enable.hidden = true; switchCamera.hidden = false; setState('search', 'Searching…');
    hint('Point at the poster—up close or from afar. Any part of it works.', { stay: true });
    try { navigator.wakeLock?.request('screen').then(w => { if (s !== session) w.release(); else wake = w; }).catch(() => {}); } catch {} // keep the screen on while tracking
    startWorker(s); pump(s);
  } catch (e) {
    if (s !== session) return; stop();
    const messages = { NotAllowedError: 'Camera permission was denied. Allow camera access in your browser’s site settings, then try again.', NotFoundError: 'No camera was found. Open this page in Safari or Chrome on your phone.', NotReadableError: 'The camera is busy. Close other camera apps, then try again.', CameraUnavailable: 'Camera access needs HTTPS or localhost. Open the secure website in Safari or Chrome.' };
    hint(messages[e.name] || 'The camera could not start. Tap Start to try again, or use Preview without camera under ⋯.', { stay: true });
  }
}
enable.addEventListener('click', startCamera);
switchCamera.addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; startCamera(); });
$('preview-ar').addEventListener('click', async () => {
  stop(); const s = ++session; mode = 'preview'; cam.hidden = true; setDrawer(false); setState('preview', 'Loading preview');
  hint('Loading a poster image—no camera is used.', { stay: true });
  const image = new Image(); image.src = 'assets/poster-tracking-preview.jpg';
  try {
    await image.decode(); if (s !== session) return; source = image;
    Object.assign(stage.style, { backgroundImage: 'url("assets/poster-tracking-preview.jpg")', backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' });
    startWorker(s); frame();
  } catch { stop(); hint('Preview could not load. The interactive sections still work without a camera.', { stay: true }); }
});

const detail = {
  workflow: { title: 'A real ComfyUI example', text: 'The official Wan 2.2 example clip, not a film made by our group. Source [3] explains its nodes and settings.', href: '#ref-3', label: 'Open source [3]' },
  impact: { title: 'Possibilities and responsibility', text: 'Our group’s pros and cons, each with its numbered source.', href: '#citations', label: 'Read the citations' }
};
document.querySelectorAll('[data-ar-section]').forEach(b => b.addEventListener('click', () => {
  const d = detail[b.dataset.arSection];
  $('ar-sheet-content').innerHTML = '<h2>' + d.title + '</h2><p>' + d.text + '</p><a href="' + d.href + '">' + d.label + ' ↗</a>';
  document.querySelector('#ar-sheet-content a').addEventListener('click', close);
  sheet.hidden = false; $('close-ar-sheet').focus();
}));
$('close-ar-sheet').addEventListener('click', () => sheet.hidden = true);

// Small API for the model-path explanations (ar-explain.js).
window.PosterAR = {
  onRender: f => renderHooks.push(f), onStop: f => stopHooks.push(f), stop, close, hold, areas: AREAS, focus: () => focus, aim: aimPoint,
  // Raw pose for 3D rendering: homography h (poster 0..1 -> video 0..1), the video's drawn rectangle and the stage size.
  // 'camera' for a live camera, 'preview' for the poster image.
  mode: () => mode,
  pose3d() { if (!pose || !source || plane.hidden) return null; const v = viewport(), box = stage.getBoundingClientRect(); return { h: pose.slice(0, 8), v, width: box.width, height: box.height }; },
  toScreen(x, y) { if (!pose || !source || plane.hidden) return null; const v = viewport(), p = PosterTracking.project(pose, x / PosterTracking.width, y / PosterTracking.height); return { x: v.left + p.x * v.width, y: v.top + p.y * v.height }; }
};
window.addEventListener('resize', render); cam.addEventListener('resize', () => { dropFollower(); hideOverlay(); }); window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode !== 'off' || enable.disabled)) { stop(); hint('Camera paused. Start it again when you return.', { stay: true }); } });
// Never leave an old pose apparently locked if frame processing stalls.
setInterval(() => { if (mode === 'camera' && lastGood && performance.now() - lastGood > 1200) { dropFollower(); hideOverlay(); guide.hidden = false; setState('search', 'Tracking paused'); hint('Tracking paused. Hold the poster in view.', { stay: true }); } }, 250);
// A link to ./#ar opens the AR view directly (the camera still needs one tap on Start).
if (location.hash === '#ar') { try { open(document.querySelector('[data-camera]')); } catch {} }
})();
