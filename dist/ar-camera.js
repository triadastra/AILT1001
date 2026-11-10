'use strict';
(() => {
const $ = id => document.getElementById(id);
const dialog = $('scanner'), cam = $('camera-video'), plane = $('poster-plane'), status = $('scan-status'), quality = $('ar-quality'),
  stateChip = $('ar-state'), enable = $('enable-camera'), guide = $('ar-guide'), demoVideo = $('ar-demo-video'), sheet = $('ar-sheet'),
  switchCamera = $('switch-camera'), more = $('ar-more'), drawer = $('ar-drawer'), pointsCanvas = $('ar-points'),
  dock = dialog.querySelector('.ar-dock'), stage = dialog.querySelector('.ar-stage');
const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
let facing = 'environment', stream = null, worker = null, timer = null, session = 0, focusReturn = null, busy = false, lastGood = 0,
  pose = null, source = null, mode = 'off', misses = 0, current = null, target = null, raf = 0, quietTimer = 0, flashTimer = 0, wasLocked = false;

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
function hideOverlay() { plane.hidden = true; pose = null; current = null; target = null; lastGood = 0; misses = 0; wasLocked = false; cancelAnimationFrame(raf); raf = 0; demoVideo.pause(); renderHooks.forEach(f => f()); }
function viewport() {
  const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight, box = stage.getBoundingClientRect();
  return PosterTracking.viewport(sw, sh, box.width, box.height, mode === 'camera');
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
  if (worker) worker.terminate(); worker = null; busy = false; source = null; mode = 'off'; cam.hidden = false; hideOverlay();
  enable.disabled = false; enable.hidden = false; switchCamera.hidden = true; guide.hidden = false; setState('off', 'Camera off');
  stage.style.backgroundImage = 'none'; stopHooks.forEach(f => f());
}
function close() { stop(); sheet.hidden = true; setDrawer(false); dialog.close(); if (document.fullscreenElement === dialog) document.exitFullscreen?.().catch(() => {}); focusReturn?.focus(); }
function open(button) { focusReturn = button; sheet.hidden = true; setDrawer(false); hint('Point your camera at the poster. Any part of it works.', { stay: true }); dialog.showModal(); }
document.querySelectorAll('[data-camera]').forEach(b => b.addEventListener('click', () => open(b)));
$('close-camera').addEventListener('click', close); dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
$('camera-fallback').addEventListener('click', () => { close(); document.getElementById('explore').scrollIntoView(); });

function describe(r) {
  if (r.method === 'markers') return r.count + '/4 corner markers';
  return r.count + ' points';
}
function startWorker(s) {
  worker = new Worker('ar-worker.js');
  worker.onmessage = e => {
    if (s !== session || e.data.session !== session) return;
    busy = false; const r = e.data;
    if (r.locked) {
      misses = 0; lastGood = performance.now(); applyPose(r.h, r.corners);
      setState(mode === 'preview' ? 'preview' : 'locked', (mode === 'preview' ? 'Preview · ' : 'Locked · ') + describe(r));
      guide.hidden = true; plane.hidden = false;
      if (!wasLocked) {
        wasLocked = true; flashPoints(r.points);
        hint(mode === 'preview' ? 'Preview only—this uses a poster image, not your camera. Tap a glass button.' : 'Locked. Tap a glass button on the poster.');
      }
      if (demoVideo.paused) demoVideo.play().catch(() => {});
    } else if (r.reason === 'error') {
      hideOverlay(); guide.hidden = false; setState('search', 'Tracking error');
      hint('Tracking could not start. Explore the poster without the camera.', { stay: true });
    } else if (++misses >= 2 || !wasLocked) {
      // One missed frame keeps the last pose; a second hides it.
      const had = wasLocked; hideOverlay(); guide.hidden = false;
      setState('search', mode === 'preview' ? 'Preview · searching' : 'Searching…');
      if (had || status.textContent.startsWith('Locked')) hint('Lost the poster. Hold steady and keep part of it in view.', { stay: true });
    }
    if (mode === 'camera') timer = setTimeout(frame, 30);
  };
  worker.onerror = () => { busy = false; hideOverlay(); stop(); hint('Tracking is unavailable in this browser. Explore without the camera.', { stay: true }); };
}
function frame() {
  if (!source || busy || !dialog.open) return;
  const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight;
  if (!sw || !sh) { timer = setTimeout(frame, 150); return; }
  const scale = Math.min(1, 1920 / Math.max(sw, sh)); canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  busy = true; worker.postMessage({ buffer: pixels.data.buffer, width: canvas.width, height: canvas.height, session }, [pixels.data.buffer]);
}
async function startCamera() {
  stop(); const s = ++session; enable.disabled = true; setDrawer(false); setState('search', 'Waiting for permission');
  hint('Allow camera access in your browser. You can close this at any time.', { stay: true });
  if (dialog.requestFullscreen) dialog.requestFullscreen().catch(() => {});
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Camera API unavailable'), { name: 'CameraUnavailable' });
    const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 2560 }, aspectRatio: { ideal: Math.min(1, window.innerWidth / window.innerHeight) } }, audio: false });
    if (s !== session || !dialog.open) { acquired.getTracks().forEach(t => t.stop()); return; }
    stream = acquired; cam.srcObject = stream; await cam.play(); if (s !== session) return;
    source = cam; mode = 'camera'; enable.hidden = true; switchCamera.hidden = false; setState('search', 'Searching…');
    hint('Point at the poster—up close or from afar. Any part of it works.', { stay: true });
    startWorker(s); frame();
  } catch (e) {
    if (s !== session) return; stop();
    const messages = { NotAllowedError: 'Camera permission was denied. Allow camera access in your browser’s site settings, then try again.', NotFoundError: 'No camera was found. Open this page in Safari or Chrome on your phone.', NotReadableError: 'The camera is busy. Close other camera apps, then try again.', CameraUnavailable: 'Camera access needs HTTPS or localhost. Open the secure website in Safari or Chrome.' };
    hint(messages[e.name] || 'The camera could not start. Try again or use Preview without camera.', { stay: true });
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
  models: { title: 'Four model paths. One film.', text: 'Text predicts tokens, latent diffusion refines images, video models refine clips across space and time, and audio models decode sound. Tap through the model explanations to inspect each path.', href: '?s=models#explore', label: 'Explore the models' },
  workflow: { title: 'A real ComfyUI example', text: 'This is the official Wan 2.2 example clip, rather than a film made by our group. The printed workflow shows separate published examples. Source [3] explains its nodes and settings.', href: 'references.html#ref-3', label: 'Open the original workflow source' },
  impact: { title: 'Possibilities and responsibility', text: 'Read our group’s pros and cons, then try the release decisions about consent, continuity and trust. The reference page provides the evidence and its limits.', href: '?s=impact#explore', label: 'Explore our pros and cons' }
};
document.querySelectorAll('[data-ar-section]').forEach(b => b.addEventListener('click', () => {
  const d = detail[b.dataset.arSection];
  $('ar-sheet-content').innerHTML = '<h2>' + d.title + '</h2><p>' + d.text + '</p><a href="' + d.href + '">' + d.label + ' ↗</a>';
  document.querySelector('#ar-sheet-content a').addEventListener('click', stop);
  sheet.hidden = false; $('close-ar-sheet').focus();
}));
$('close-ar-sheet').addEventListener('click', () => sheet.hidden = true);

// Small API for the model-path explanations (ar-explain.js).
window.PosterAR = {
  onRender: f => renderHooks.push(f), onStop: f => stopHooks.push(f), stop,
  // Raw pose for 3D rendering: homography h (poster 0..1 -> video 0..1), the video's drawn rectangle and the stage size.
  pose3d() { if (!pose || !source || plane.hidden) return null; const v = viewport(), box = stage.getBoundingClientRect(); return { h: pose.slice(0, 8), v, width: box.width, height: box.height }; },
  toScreen(x, y) { if (!pose || !source || plane.hidden) return null; const v = viewport(), p = PosterTracking.project(pose, x / PosterTracking.width, y / PosterTracking.height); return { x: v.left + p.x * v.width, y: v.top + p.y * v.height }; }
};
window.addEventListener('resize', render); cam.addEventListener('resize', () => hideOverlay()); window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden && (mode !== 'off' || enable.disabled)) { stop(); hint('Camera paused. Start it again when you return.', { stay: true }); } });
// Never leave an old pose apparently locked if frame processing stalls.
setInterval(() => { if (mode === 'camera' && lastGood && performance.now() - lastGood > 1200) { hideOverlay(); guide.hidden = false; setState('search', 'Tracking paused'); hint('Tracking paused. Hold the poster in view.', { stay: true }); } }, 250);
})();
