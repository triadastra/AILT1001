// Walk-around check for the Blue/Red 3D workflow: renders the poster from known camera positions (left, right,
// above, below, close-up, tilted phone, different lens), lets the tracker lock on, and measures how far each
// floating node is drawn from where it physically appears from that camera. Needs Chromium (Playwright) with WebGL,
// and uv (for Pillow/NumPy). Run: npm run test:walkaround
const { chromium } = require('playwright'), fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { execFileSync, spawn } = require('child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walkaround-')), PORT = 5179;
// node positions from dist/ar-cases.js (x, y, height above the paper, width, height), in poster units
const D = { prompt: [317, 1135, 200, 300, 230], face: [715, 1160, 200, 260, 300], safety: [1200, 1010, 260, 280, 170], consent: [980, 1215, 260, 280, 170], sampler: [1490, 1200, 330, 320, 380], audio: [1300, 1570, 260, 270, 180], money: [848, 1540, 280, 270, 190], water: [205, 1565, 300, 270, 170], out: [455, 1525, 360, 240, 330] };
const pts = [[48, 900, 0], [1640, 900, 0], [1640, 1745, 0], [48, 1745, 0]];
for (const [x, y, h, w, hh] of Object.values(D)) pts.push([x, y, h + 8], [x - w / 2, y - hh / 2, h + 8], [x + w / 2, y + hh / 2, h + 8]);
execFileSync('uv', ['run', '-q', '--with', 'pillow', '--with', 'numpy', 'python', '-I', 'tests/make-walkaround.py', 'dist/assets/poster-tracking-preview.jpg', dir, JSON.stringify(pts)], { stdio: 'inherit' });
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'orbit.json'), 'utf8'));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'dist', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
(async () => {
  let b;
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${PORT}/`); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
    b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = []; p.on('pageerror', e => errs.push(e.message));
    let current = null; await p.route('**/assets/poster-tracking-preview.jpg', r => r.fulfill({ path: current, contentType: 'image/jpeg' }));
    const rows = [];
    for (const v of meta.views) {
      current = path.join(dir, `orbit-${v.name}.jpg`);
      // a fresh page per view, so the browser cannot reuse the previous view's image
      await p.goto(`http://127.0.0.1:${PORT}/?v=${v.name}`); await p.click('[data-camera]'); await p.click('#ar-more'); await p.click('#preview-ar');
      await p.waitForFunction(() => !document.getElementById('poster-plane').hidden, null, { timeout: 25000 });
      await p.evaluate(() => document.querySelector('.ar-case[data-mode="blue"]').click());
      await p.waitForFunction(() => PosterExplain.scene()?.ready?.(), null, { timeout: 20000 }); await p.waitForTimeout(1200);
      const res = await p.evaluate(pts => { const s = PosterExplain.scene(), ps = PosterAR.pose3d(); return pts.map(([x, y, h]) => { const q = s.project(x, y, h); return [(q.x - ps.v.left) / ps.v.width * 1080, (q.y - ps.v.top) / ps.v.height * 1920]; }); }, meta.pts);
      const e = res.map((q, i) => Math.hypot(q[0] - v.gt[i][0], q[1] - v.gt[i][1]));
      rows.push({ view: v.name, lens: v.focalRatio, paperMaxPx: +Math.max(...e.slice(0, 4)).toFixed(1), airMaxPx: +Math.max(...e.slice(4)).toFixed(1) });
    }
    console.table(rows);
    for (const r of rows) {
      assert(r.paperMaxPx < 4, `${r.view}: paper registration off by ${r.paperMaxPx}px`);
      // with the default lens guess: within 4 px of a 1920 px image; with a different lens (estimated from the view): within 2%
      assert(r.airMaxPx < (r.lens === .78 ? 4 : 1920 * .02), `${r.view}: floating nodes off by ${r.airMaxPx}px`);
    }
    assert.deepEqual(errs, [], 'no page errors');
    console.log(`PASS: floating nodes stay fixed in mid-air across ${rows.length} walk-around views.`);
  } finally { if (b) await b.close(); server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
