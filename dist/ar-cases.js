'use strict';
/* Blue / Red mode: the same workflow, used well or harmfully, as 3D nodes floating over the printed poster.
 * The camera view is blurred; the nodes stay locked to the poster in 3D (the camera pose is recovered
 * from the tracker's homography). Blue keeps the safety modules plugged in and releases one labelled,
 * watermarked film. Red types a harmful prompt, feeds in a face, lets the safety modules drop out, and
 * mass-produces copies that fly everywhere as blurred cards. Nothing explicit is drawn: the "censored"
 * cards are a mosaic of a stunt scene drawn in code, with fake news graphics on top. The face is a synthetic face drawn in code, not a real person.
 * three.js is loaded only when this mode starts (dist/vendor/three.module.min.js, MIT). */
window.PosterCases = ({ clamp, ease, lerp }) => {
const COLOR = { blue: '#6cb6ff', red: '#ff6b6b' };
const STEPS = [
  { title: '01 · Write the story',
    blue: 'Blue: the prompt describes an original scene, “a musician plays guitar in an MTR station”. The team reviews it before anything is generated. [1]',
    red: 'Red: same prompt box, same model, but the words change: a real classmate’s face, a fake “breaking news” framing and a dangerous stunt. [21]',
    tip: 'Same tool. The goal changed: telling a story vs. passing fiction off as real.' },
  { title: '02 · Create visual assets',
    blue: 'Blue: the image node loads a synthetic face (or an actor who agreed). The consent check stays plugged in and passes. [1,3]',
    red: 'Red: the face is a classmate’s selfie, taken without asking. The consent check is unplugged and drops out of the workflow. [20]',
    tip: 'Whose face is it? A real person’s likeness needs their consent.' },
  { title: '03 · Generate the video',
    blue: 'Blue: the safety filter catches the dangerous stunt, so the sampler renders an original, fictional character in a scene the team could never afford to build. [1,3]',
    red: 'Red: the safety filter drops out too. The sampler renders the stunt with the real face, shown blurred here. Our proposal worries children may copy stunts like this. [21]',
    tip: 'Fiction is fine. Realistic danger featuring a real person is not.' },
  { title: '04 · Add sound & edit',
    blue: 'Blue: an audio model writes original guitar music, and a human editor lines up picture, sound and captions. [4,13]',
    red: 'Red: the audio node clones the classmate’s voice, and an AI “news anchor” presents the clip as if it really happened. [20,21]',
    tip: 'Cloning a real voice and faking a news format turns an edit into deception.' },
  { title: '05 · Plan monetisation',
    blue: 'Blue: the release node credits the team and tools and marks the upload as AI-altered, following platform rules. [10,16]',
    red: 'Red: a batch node copies the template a hundred times with tiny changes to farm views. YouTube may refuse to monetise repetitive content like this. [10,5]',
    tip: 'One honest film vs. a content farm of near-identical clips.' },
  { title: '06 · Distribute online',
    blue: 'Blue: the watermark module stamps an AI label and an invisible watermark, and one credited film is released, like The Frost’s disclosures. [11,26]',
    red: 'Red: the watermark module drops out. Unlabelled copies fly out into every feed, harming the classmate and leaving viewers unsure what is real. [19,21]',
    tip: 'Labels and watermarks let people and platforms tell real from fake.' }
];
const steps = STEPS.map(s => ({ title: s.title, blue: s.blue, red: s.red, tip: s.tip, dur: 8600 }));
return { cases: {
  name: 'Same workflow, two outcomes', input: 'A musician plays guitar in an MTR station', accent: COLOR.blue, modes: COLOR, spatial: true,
  link: { href: 'references.html', label: 'Check the sources ↗' }, steps,
  build(_, api) { return createScene(api); }
} };

function createScene(api) {
  const PW = 1682, PH = 2378, reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas'); canvas.id = 'ar-3d'; canvas.setAttribute('aria-hidden', 'true'); api.stage.appendChild(canvas);
  let THREE = null, R = null, disposed = false, focal = 0, endAt = 0, lastNow = 0; const fEst = [];
  // Auto-framing: a digital zoom applied to the blurred camera image and the 3D scene together, so the
  // workflow fills the space above the caption card and everything stays registered to the poster.
  const zoom = { s: 1, tx: 0, ty: 0 }, video = document.getElementById('camera-video'), card = document.getElementById('ar-explain');
  const savedBg = api.stage.style.backgroundImage, backdrop = document.createElement('div'); backdrop.id = 'ar-backdrop';
  if (savedBg && savedBg !== 'none') { for (const k of ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat']) backdrop.style[k] = api.stage.style[k]; api.stage.style.backgroundImage = 'none'; }
  api.stage.insertBefore(backdrop, api.stage.firstChild);
  try { import('./vendor/three.module.min.js').then(m => { if (disposed) return; THREE = m; try { R = setup(); } catch { api.dialog.dataset.no3d = ''; } }).catch(() => { api.dialog.dataset.no3d = ''; }); } catch { api.dialog.dataset.no3d = ''; }

  // ---------- 2D drawing for node faces ----------
  const FONT = '"DM Sans", system-ui, -apple-system, sans-serif';
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrapText(g, text, x, y, maxW, lh, colorOf) {
    let line = [], yy = y; const words = text.split(' ');
    const flush = () => { let xx = x; for (const w of line) { g.fillStyle = colorOf ? colorOf(w) : '#fff'; g.fillText(w + ' ', xx, yy); xx += g.measureText(w + ' ').width; } line = []; yy += lh; };
    for (const w of words) { if (line.length && g.measureText([...line, w].join(' ')).width > maxW) flush(); line.push(w); } if (line.length) flush(); return yy;
  }
  // A synthetic face, drawn in code (not a photo of anyone).
  const face = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext && c.getContext('2d'); if (!g || !g.createRadialGradient) return c;
    let gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3a4a66'); gr.addColorStop(1, '#1c2333'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#c99a7b'; g.fillRect(104, 170, 48, 50); g.fillStyle = '#2e3f5c'; g.beginPath(); g.ellipse(128, 262, 100, 56, 0, 0, Math.PI * 2); g.fill();
    gr = g.createRadialGradient(112, 112, 10, 128, 128, 90); gr.addColorStop(0, '#f1c9a8'); gr.addColorStop(1, '#c8936f'); g.fillStyle = gr; g.beginPath(); g.ellipse(128, 124, 62, 78, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a1d17'; g.beginPath(); g.ellipse(128, 70, 70, 40, 0, Math.PI, 0); g.fill(); g.beginPath(); g.ellipse(128, 66, 66, 30, 0, 0, Math.PI * 2); g.fill();
    for (const ex of [104, 152]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, 120, 13, 7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#4b3527'; g.beginPath(); g.arc(ex, 120, 5.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(ex, 120, 2.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a2a20'; g.lineWidth = 4; g.beginPath(); g.moveTo(ex - 15, 103); g.quadraticCurveTo(ex, 96, ex + 15, 103); g.stroke(); }
    g.strokeStyle = 'rgba(120,70,50,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(128, 128); g.lineTo(122, 150); g.lineTo(132, 152); g.stroke();
    g.fillStyle = '#b5605a'; g.beginPath(); g.ellipse(128, 170, 18, 6, 0, 0, Math.PI * 2); g.fill(); return c; })();
  // Blue's picture: the subway guitarist from the poster's own KSampler screenshot (official Wan 2.2 example, source [3]).
  const frame = new Image(); frame.src = 'assets/cite/ksampler.jpg'; let frameReady = false; (frame.decode ? frame.decode() : Promise.reject()).then(() => { frameReady = true; }).catch(() => {});
  const CROP = [279, 70, 255, 146];
  const noise = (() => { const c = document.createElement('canvas'); c.width = 96; c.height = 54; const g = c.getContext && c.getContext('2d'); if (!g || !g.createImageData) return c; const d = g.createImageData(96, 54); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = v; d.data[i + 1] = v * .9 + Math.random() * 25; d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return c; })();
  // Red's picture is deliberately a different image: a fake "breaking news" stunt, drawn in code
  // (a figure with the loaded face leaping between two moving trains). It is only ever shown as a mosaic.
  const fake = (() => { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext && c.getContext('2d'); if (!g || !g.createLinearGradient) return c;
    const sky = g.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#f2a65a'); sky.addColorStop(.6, '#d9584a'); sky.addColorStop(1, '#40222e'); g.fillStyle = sky; g.fillRect(0, 0, 320, 200);
    g.fillStyle = '#2a1a22'; g.fillRect(0, 168, 320, 32); g.strokeStyle = '#8a6f6a'; g.lineWidth = 3; for (const y of [176, 190]) { g.beginPath(); g.moveTo(0, y); g.lineTo(320, y); g.stroke(); }
    const train = (x, w, col) => { g.fillStyle = col; rr(g, x, 104, w, 62, 8); g.fill(); g.fillStyle = '#ffe9a8'; for (let k = 0; k < 4; k++) g.fillRect(x + 12 + k * (w - 24) / 4, 116, (w - 24) / 4 - 8, 18); g.fillStyle = 'rgba(255,255,255,.5)'; for (let k = 0; k < 4; k++) g.fillRect(x - 30 + k * 6, 112 + k * 13, 26, 3); };
    train(-20, 130, '#2f6fd0'); train(214, 130, '#e8c21f');
    // the leaping figure
    g.strokeStyle = '#111'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(160, 74); g.lineTo(166, 108); g.moveTo(166, 108); g.lineTo(140, 128); g.moveTo(166, 108); g.lineTo(196, 120); g.moveTo(162, 84); g.lineTo(132, 70); g.moveTo(162, 84); g.lineTo(194, 66); g.stroke();
    g.save(); g.beginPath(); g.arc(158, 52, 24, 0, Math.PI * 2); g.clip(); g.drawImage(face, 122, 14, 72, 72); g.restore();
    return c; })();
  const tiny = document.createElement('canvas');
  const HEADLINES = ['BREAKING NEWS', 'PART 2 !!', 'IS THIS REAL??', 'GONE WRONG', 'SHOCKING VIDEO', 'YOU WON’T BELIEVE'], TINTS = [null, 'rgba(80,120,255,.3)', 'rgba(60,220,120,.26)', 'rgba(255,220,60,.3)', 'rgba(220,80,255,.28)', 'rgba(60,230,230,.26)'];
  // red = false: the guitarist. red = true: the fake stunt as a mosaic; `banner` adds the fake news graphics, `variant` picks a recoloured copy.
  function drawScene(g, x, y, w, h, a, red, banner, variant = 0) {
    g.save(); rr(g, x, y, w, h, 8); g.clip();
    if (!red) { g.globalAlpha = 1; g.drawImage(noise, x, y, w, h); g.globalAlpha = a; if (frameReady) g.drawImage(frame, ...CROP, x, y, w, h); else { g.fillStyle = '#3b4652'; g.fillRect(x, y, w, h); } g.globalAlpha = 1; }
    else {
      tiny.width = 32; tiny.height = 20; const tg = tiny.getContext('2d'); tg.globalAlpha = 1; tg.drawImage(noise, 0, 0, 32, 20); tg.globalAlpha = a; tg.drawImage(fake, 0, 0, 32, 20); tg.globalAlpha = 1;
      g.imageSmoothingEnabled = false; g.drawImage(tiny, x, y, w, h); g.imageSmoothingEnabled = true;
      if (TINTS[variant]) { g.fillStyle = TINTS[variant]; g.fillRect(x, y, w, h); }
      if (banner) { const u = h / 100; g.fillStyle = '#e01f2d'; g.fillRect(x, y + h * .72, w, h * .2); g.fillStyle = '#fff'; g.font = `800 ${(13 * u).toFixed(1)}px ${FONT}`; g.fillText(HEADLINES[variant], x + 5 * u, y + h * .865);
        g.fillStyle = '#e01f2d'; rr(g, x + 4 * u, y + 5 * u, 30 * u, 14 * u, 3 * u); g.fill(); g.fillStyle = '#fff'; g.font = `800 ${(9.5 * u).toFixed(1)}px ${FONT}`; g.fillText('● LIVE', x + 7 * u, y + 15.5 * u);
        g.fillStyle = 'rgba(0,0,0,.7)'; g.font = `700 ${(8 * u).toFixed(1)}px ${FONT}`; const t = 'blurred · fake', tw = g.measureText(t).width; rr(g, x + w - tw - 12 * u, y + 5 * u, tw + 8 * u, 13 * u, 3 * u); g.fill(); g.fillStyle = '#fff'; g.fillText(t, x + w - tw - 8 * u, y + 14.5 * u); }
    }
    g.restore();
  }

  // Text in the prompt node, typed over time.
  const BLUE_PROMPT = 'A musician plays guitar in an MTR station. Original character, warm 1970s film look.';
  const RED_PROMPT = 'Use this face: my classmate. Make it look like REAL breaking news. He jumps between moving trains.';
  const BAD = /face|classmate|real|breaking|news|jumps|trains/i;
  function typed(mode, p) {
    if (mode === 'blue') return BLUE_PROMPT.slice(0, Math.round(clamp(p / .8) * BLUE_PROMPT.length));
    const start = 'A musician plays guitar';
    if (p < .25) return start.slice(0, Math.round(p / .25 * start.length));
    if (p < .36) return start.slice(0, Math.round((1 - (p - .25) / .11) * start.length));
    return RED_PROMPT.slice(0, Math.round(clamp((p - .36) / .52) * RED_PROMPT.length));
  }

  // ---------- 3D scene: ComfyUI-style nodes ----------
  // Socket and link colours follow ComfyUI's defaults by data type; node colours use ComfyUI's colour presets.
  const TYPE = { CLIP: '#FFD500', CONDITIONING: '#FFA931', MODEL: '#B39DDB', IMAGE: '#64B5F6', MASK: '#81C784', AUDIO: '#4EC9B0', STRING: '#A5D6A7' };
  const PAL = { default: ['#353535', '#222222'], green: ['#353f35', '#223322'], red: ['#553333', '#332222'], cyan: ['#335555', '#223333'], purple: ['#553355', '#332233'] };
  // Node layout in poster units over the printed workflow (x 48-1640, y 900-1740); h = height above the paper.
  const DEF = {
    prompt: { x: 210, y: 1030, h: 200, w: 300, hh: 230, step: 0, pal: m => m === 'red' ? 'red' : 'green', title: () => 'CLIP Text Encode (Prompt)', ins: [['clip', 'CLIP']], outs: [['CONDITIONING', 'CONDITIONING']] },
    face: { x: 210, y: 1500, h: 200, w: 260, hh: 300, step: 1, pal: () => 'default', title: () => 'Load Image', ins: [], outs: [['IMAGE', 'IMAGE'], ['MASK', 'MASK']] },
    safety: { x: 565, y: 1030, h: 260, w: 280, hh: 170, step: 2, censor: true, pal: () => 'green', title: () => '🛡 Safety Filter', ins: [['conditioning', 'CONDITIONING']], outs: [['CONDITIONING', 'CONDITIONING']] },
    consent: { x: 565, y: 1500, h: 260, w: 280, hh: 170, step: 1, censor: true, pal: () => 'green', title: () => '🛡 Consent Check', ins: [['image', 'IMAGE']], outs: [['IMAGE', 'IMAGE']] },
    sampler: { x: 915, y: 1265, h: 330, w: 320, hh: 380, step: 2, pal: () => 'default', title: () => 'KSampler (Wan 2.2)', ins: [['model', 'MODEL'], ['positive', 'CONDITIONING'], ['start_image', 'IMAGE']], outs: [['IMAGE', 'IMAGE']] },
    audio: { x: 1235, y: 965, h: 260, w: 270, hh: 180, step: 3, pal: m => m === 'red' ? 'red' : 'cyan', title: m => m === 'red' ? 'Voice Clone' : 'MusicGen', ins: [], outs: [['AUDIO', 'AUDIO']] },
    money: { x: 1235, y: 1255, h: 280, w: 270, hh: 190, step: 4, pal: m => m === 'red' ? 'red' : 'purple', title: m => m === 'red' ? 'Repeat Batch' : 'Credits + AI Disclosure', ins: [], outs: [['metadata', 'STRING']] },
    water: { x: 1235, y: 1545, h: 300, w: 270, hh: 170, step: 5, censor: true, pal: () => 'green', title: () => '🛡 AI Label + Watermark', ins: [['images', 'IMAGE']], outs: [['IMAGE', 'IMAGE']] },
    out: { x: 1530, y: 1265, h: 360, w: 240, hh: 330, step: 5, pal: () => 'default', title: () => 'Save Video', ins: [['images', 'IMAGE'], ['audio', 'AUDIO'], ['metadata', 'STRING']], outs: [] }
  };
  // [from node, output slot, to node, input slot]
  const LINKS = [['prompt', 0, 'safety', 0], ['safety', 0, 'sampler', 1], ['face', 0, 'consent', 0], ['consent', 0, 'sampler', 2], ['sampler', 0, 'water', 0], ['water', 0, 'out', 0], ['audio', 0, 'out', 1], ['money', 0, 'out', 2]];
  const BYPASS = { safety: ['prompt', 0, 'sampler', 1], consent: ['face', 0, 'sampler', 2], water: ['sampler', 0, 'out', 0] };
  const ACTIVE = [['prompt'], ['face', 'consent'], ['safety', 'sampler'], ['audio'], ['money'], ['water', 'out']];
  const FLOW = [['prompt>safety'], ['face>consent', 'consent>sampler'], ['safety>sampler'], ['audio>out'], ['money>out'], ['sampler>water', 'water>out']];
  const HEAD = 26, ROW = 20, WROW = 22, TEX = 2.2; // node units; texture pixels per unit (sharp when walking up close)
  const slotY = i => HEAD + 13 + i * ROW;

  function setup() {
    const T = THREE, renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(); camera.matrixAutoUpdate = false;
    // Authored frame: X = poster x, Y = -poster y, Z = height above the paper (towards the viewer).
    const root = new T.Group(); root.rotation.x = Math.PI; scene.add(root); root.updateMatrixWorld(true);
    const P = (x, y, h) => new T.Vector3(x, -y, h);
    scene.add(new T.AmbientLight(0xffffff, 1.5)); const sun = new T.DirectionalLight(0xffffff, 2.4); sun.position.copy(P(300, 700, 2400)); const aim = new T.Object3D(); aim.position.copy(P(845, 1320, 0)); root.add(sun, aim); sun.target = aim;
    const disposables = [], keep = o => (disposables.push(o), o);
    const shadowTex = keep(new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })()));

    // glowing outline of the printed workflow, on the paper
    const frameLine = new T.LineLoop(keep(new T.BufferGeometry().setFromPoints([P(48, 900, 1), P(1640, 900, 1), P(1640, 1745, 1), P(48, 1745, 1)])), keep(new T.LineBasicMaterial({ color: COLOR.blue, transparent: true, opacity: .7 }))); root.add(frameLine);
    // a dark ComfyUI-style canvas with a dot grid, just above the paper, so the nodes read clearly
    const gridTex = keep(new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 544; const g = c.getContext('2d'); g.fillStyle = 'rgba(16,18,22,.9)'; g.fillRect(0, 0, 1024, 544); g.fillStyle = 'rgba(255,255,255,.16)'; for (let y = 16; y < 544; y += 32) for (let x = 16; x < 1024; x += 32) g.fillRect(x - 1, y - 1, 2.4, 2.4); return c; })()));
    const grid = new T.Mesh(keep(new T.PlaneGeometry(1592, 845)), keep(new T.MeshBasicMaterial({ map: gridTex, transparent: true, opacity: 0, depthWrite: false }))); grid.position.copy(P(844, 1322.5, 1.5)); root.add(grid);
    const glowTex = keep(new T.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.45, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; })()));

    const nodes = {};
    for (const [id, d] of Object.entries(DEF)) {
      const c = document.createElement('canvas'); c.width = Math.round(d.w * TEX); c.height = Math.round(d.hh * TEX);
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const side = keep(new T.MeshStandardMaterial({ color: 0x1a2230, metalness: .35, roughness: .4, transparent: true })), front = keep(new T.MeshBasicMaterial({ map: tex, transparent: true }));
      const geo = keep(new T.BoxGeometry(d.w, d.hh, 16)), box = new T.Mesh(geo, [side, side, side, side, front, side]);
      const edgeMat = keep(new T.LineBasicMaterial({ color: 0x555555, transparent: true })), edges = new T.LineSegments(keep(new T.EdgesGeometry(geo)), edgeMat);
      const haloMat = keep(new T.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })), halo = new T.Mesh(keep(new T.PlaneGeometry(d.w * 1.9, d.hh * 1.9)), haloMat); halo.position.z = -12;
      const grp = new T.Group(); grp.add(halo, box, edges); grp.position.copy(P(d.x, d.y, d.h)); root.add(grp);
      const shMat = keep(new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .55 })), sh = new T.Mesh(keep(new T.PlaneGeometry(d.w * 1.2, d.hh * 1.1)), shMat); root.add(sh);
      const stemMat = keep(new T.LineDashedMaterial({ color: 0xffffff, dashSize: 10, gapSize: 10, transparent: true, opacity: .35 })), stem = new T.Line(keep(new T.BufferGeometry().setFromPoints([P(d.x, d.y, 0), P(d.x, d.y, d.h - 8)])), stemMat); stem.computeLineDistances(); root.add(stem);
      nodes[id] = { id, d, c, g: c.getContext('2d'), tex, side, front, edgeMat, haloMat, grp, sh, shMat, stem, stemMat, key: '', i: Object.keys(nodes).length, prevFall: 0, passKey: '' };
    }
    // links from output socket to input socket, as tubes with ComfyUI's horizontal bezier tangents,
    // plus red bypass links used when a safety module drops out
    const sock = (id, out, k) => { const d = DEF[id]; return P(d.x + (out ? 1 : -1) * (d.w / 2 - 9), d.y - d.hh / 2 + slotY(k), d.h + 8.5); };
    function link([a, ai, b, bi], color) { const pa = sock(a, true, ai), pb = sock(b, false, bi), k = Math.max(70, Math.abs(pb.x - pa.x) * .5), lift = new T.Vector3(0, 0, 18);
      const curve = new T.CubicBezierCurve3(pa, pa.clone().add(new T.Vector3(k, 0, 0)).add(lift), pb.clone().add(new T.Vector3(-k, 0, 0)).add(lift), pb);
      const mat = keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: .8 })), mesh = new T.Mesh(keep(new T.TubeGeometry(curve, SEG, 3.2, 8, false)), mat); root.add(mesh);
      // a brighter, wider tube of which only a moving window is drawn: energy running along the link
      const flowMat = keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending })), flow = new T.Mesh(keep(new T.TubeGeometry(curve, SEG, 7.5, 8, false)), flowMat); flow.visible = false; root.add(flow);
      return { a, b, ai, bi, key: a + '>' + b, curve, mesh, mat, flow, flowMat, color: new T.Color(color), i: linkCount++ }; }
    const SEG = 48, IDX = 48; let linkCount = 0; // indices per tube segment (8 radial quads x 6)
    const wires = LINKS.map(l => link(l, TYPE[DEF[l[0]].outs[l[1]][1]])), bypass = {}; for (const [c, l] of Object.entries(BYPASS)) bypass[c] = link(l, 0xff6b6b);
    // the mass-produced copies (red) and the single released film (blue)
    const copyGeo = keep(new T.BoxGeometry(150, 96, 6)), copySide = keep(new T.MeshStandardMaterial({ color: 0x2a1418, transparent: true })), copyFronts = HEADLINES.map((_, v) => { const c = document.createElement('canvas'); c.width = 330; c.height = 210; const g = c.getContext('2d'); g.fillStyle = '#10151c'; g.fillRect(0, 0, 330, 210); drawScene(g, 6, 6, 318, 198, 1, true, true, v); const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; return keep(new T.MeshBasicMaterial({ map: tex, transparent: true })); });
    const rand = (s => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)(7);
    const copies = Array.from({ length: 64 }, (_, j) => { const m = new T.Mesh(copyGeo, [copySide, copySide, copySide, copySide, copyFronts[j % copyFronts.length], copySide]); m.visible = false; root.add(m);
      return { m, j, th: rand() * Math.PI * 2, rad: .35 + rand() * .9, z: .2 + rand() * 1.2, w: (rand() - .5) * .9, spin: [(rand() - .5) * 3, (rand() - .5) * 3, (rand() - .5) * 2] }; });
    const film = (() => { const c = document.createElement('canvas'); c.width = 300; c.height = 190; const g = c.getContext('2d'); const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(keep(new T.BoxGeometry(240, 152, 6)), [copySide, copySide, copySide, copySide, keep(new T.MeshBasicMaterial({ map: tex, transparent: true })), copySide]); m.visible = false; root.add(m); return { c, g, tex, m, key: '' }; })();
    // sparks (when a module is unplugged, when the copies burst out) and expanding rings (impacts, passed checks)
    const SP = 140, spPos = new Float32Array(SP * 3).fill(1e6), spCol = new Float32Array(SP * 3), spGeo = keep(new T.BufferGeometry()); spGeo.setAttribute('position', new T.BufferAttribute(spPos, 3)); spGeo.setAttribute('color', new T.BufferAttribute(spCol, 3));
    const sparks = new T.Points(spGeo, keep(new T.PointsMaterial({ size: 26, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }))); sparks.frustumCulled = false; root.add(sparks);
    const parts = Array.from({ length: SP }, () => ({ life: 0, v: new T.Vector3(), p: new T.Vector3() })); let spNext = 0;
    const emit = (pos, n, color, speed = 420) => { const c = new T.Color(color); for (let k = 0; k < n; k++) { const q = parts[spNext = (spNext + 1) % SP], a = Math.random() * Math.PI * 2, e = Math.random(); q.p.copy(pos); q.v.set(Math.cos(a) * speed * (.3 + e), Math.sin(a) * speed * (.3 + e), speed * (.2 + Math.random())); q.life = q.max = .5 + Math.random() * .6; q.c = c; } };
    const ringGeo = keep(new T.RingGeometry(.9, 1, 56)), rings = Array.from({ length: 6 }, () => { const m = new T.Mesh(ringGeo, keep(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }))); m.visible = false; root.add(m); return { m, t: 9 }; }); let ringNext = 0;
    const ring = (pos, color, size, dur = .7) => { const r = rings[ringNext = (ringNext + 1) % rings.length]; r.m.position.copy(pos); r.m.material.color.set(color); r.t = 0; r.size = size; r.dur = dur; r.m.visible = true; };
    // floating labels: a callout over the step's node, a safeguards scoreboard, and a result card at the end
    const label = (w, h, pos, order) => { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; const m = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }))); m.renderOrder = order; m.position.copy(pos); m.visible = false; root.add(m); return { c, g: c.getContext('2d'), tex, m, w, h, key: '', pop: 0 }; };
    const callout = label(340, 64, P(0, 0, 0), 20), score = label(560, 58, P(844, 838, 150), 19), result = label(760, 250, P(844, 1300, 470), 21);
    return { T, renderer, scene, camera, root, P, nodes, wires, bypass, copies, film, frameLine, disposables, grid, emit, ring, parts, spPos, spCol, spGeo, rings, callout, score, result, t0: 0, lastMode: null, switchAt: -1e9, burstKey: '' };
  }

  // ---------- pose: homography -> camera ----------
  function updateCamera(rt) {
    const ps = window.PosterAR && PosterAR.pose3d && PosterAR.pose3d(); if (!ps || !ps.width) return false;
    const { h, v, width, height } = ps, T = rt.T;
    const S = [[v.width, 0, v.left], [0, v.height, v.top], [0, 0, 1]], Hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
    const G = S.map(r => [0, 1, 2].map(j => r[0] * Hn[0][j] + r[1] * Hn[1][j] + r[2] * Hn[2][j])); for (const r of G) { r[0] /= PW; r[1] /= PH; }
    const cx = v.left + v.width / 2, cy = v.top + v.height / 2, f0 = .78 * Math.max(v.width, v.height);
    // Estimate the lens focal length from the poster's right angle when the view is oblique enough; otherwise keep a typical phone lens.
    const g1 = [G[0][0] - cx * G[2][0], G[1][0] - cy * G[2][0], G[2][0]], g2 = [G[0][1] - cx * G[2][1], G[1][1] - cy * G[2][1], G[2][1]];
    const oblique = Math.abs(g1[2] * g2[2]) * f0 * f0 / (Math.hypot(g1[0], g1[1]) * Math.hypot(g2[0], g2[1]) || 1), est = oblique > .02 ? Math.sqrt(Math.max(0, -(g1[0] * g2[0] + g1[1] * g2[1]) / (g1[2] * g2[2]))) : 0;
    // Once enough oblique views agree, the lens estimate is locked (median), so the nodes don't 'breathe' as people walk.
    if (est > f0 * .6 && est < f0 * 1.6) { fEst.push(est / f0); if (fEst.length > 120) fEst.shift(); }
    const ratio = fEst.length >= 12 ? fEst.slice().sort((a, b) => a - b)[fEst.length >> 1] : 1; focal = focal ? lerp(focal, f0 * ratio, .08) : f0 * ratio;
    const f = focal, col = j => [(G[0][j] - cx * G[2][j]) / f, (G[1][j] - cy * G[2][j]) / f, G[2][j]];
    const m1 = col(0), m2 = col(1), m3 = col(2), n = a => Math.hypot(...a);
    let lam = 2 / (n(m1) + n(m2)); if (m3[2] * lam < 0) lam = -lam;
    const r1 = m1.map(x => x * Math.sign(lam) / n(m1)), r2a = m2.map(x => x * lam), dt = r1[0] * r2a[0] + r1[1] * r2a[1] + r1[2] * r2a[2], r2b = r2a.map((x, i) => x - dt * r1[i]), r2 = r2b.map(x => x / n(r2b));
    const r3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]], t = m3.map(x => x * lam);
    const V = new T.Matrix4().set(r1[0], r2[0], r3[0], t[0], -r1[1], -r2[1], -r3[1], -t[1], -r1[2], -r2[2], -r3[2], -t[2], 0, 0, 0, 1);
    rt.camera.matrix.copy(V).invert(); rt.camera.matrixWorldNeedsUpdate = true;
    const near = 20, far = 400000;
    rt.camera.projectionMatrix.set(2 * f / width, 0, 1 - 2 * cx / width, 0, 0, 2 * f / height, 2 * cy / height - 1, 0, 0, 0, -(far + near) / (far - near), -2 * far * near / (far - near), 0, 0, -1, 0);
    rt.camera.projectionMatrixInverse.copy(rt.camera.projectionMatrix).invert();
    // The lens is only estimated, so the camera alone can leave the paper a few pixels off. Measure the
    // leftover mapping at the four poster corners and fold it into the projection: the paper then matches
    // the tracker exactly, and heights above it keep the camera's perspective.
    rt.camera.updateMatrixWorld(); rt.root.updateMatrixWorld();
    const ndcOf = (x, y) => { const q = G.map(r => r[0] * x + r[1] * y + r[2]); return { x: q[0] / q[2] / width * 2 - 1, y: 1 - q[1] / q[2] / height * 2 }; };
    const corners = [[0, 0], [PW, 0], [PW, PH], [0, PH]], have = corners.map(([x, y]) => { const v = rt.P(x, y, 0).applyMatrix4(rt.root.matrixWorld).project(rt.camera); return { x: v.x, y: v.y }; }), want = corners.map(([x, y]) => ndcOf(x, y));
    const A = PosterTracking.fromCorners(have), B = PosterTracking.fromCorners(want);
    if (A && B) { const m3 = h => new T.Matrix3().set(h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1), E = m3(B).multiply(m3(A).invert()), e = E.elements, k = 1 / e[8];
      // Matrix3.elements is column-major: e[0] e[3] e[6] / e[1] e[4] e[7] / e[2] e[5] e[8]
      rt.camera.projectionMatrix.premultiply(new T.Matrix4().set(e[0] * k, e[3] * k, 0, e[6] * k, e[1] * k, e[4] * k, 0, e[7] * k, 0, 0, 1, 0, e[2] * k, e[5] * k, 0, 1));
      rt.camera.projectionMatrixInverse.copy(rt.camera.projectionMatrix).invert(); }
    const pr = rt.renderer.getPixelRatio(); if (canvas.width !== Math.round(width * pr) || canvas.height !== Math.round(height * pr)) rt.renderer.setSize(width, height, false);
    return ps;
  }
  function frameView(rt, ps, dt) {
    const cam = rt.camera, W = ps.width, H = ps.height; cam.updateMatrixWorld();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const pts = [[48, 900, 0], [1640, 900, 0], [1640, 1745, 0], [48, 1745, 0]]; for (const d of Object.values(DEF)) for (const sx of [-1, 1]) for (const sy of [-1, 1]) pts.push([d.x + sx * d.w / 2, d.y + sy * d.hh / 2, d.h]);
    for (const [x, y, h] of pts) { const v = rt.P(x, y, h).applyMatrix4(rt.root.matrixWorld).project(cam); if (!(v.z > -1 && v.z < 1)) continue; const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const sr = api.stage.getBoundingClientRect(), cr = card && !card.hidden ? card.getBoundingClientRect() : null, landscape = cr && cr.width < W * .5 && cr.left < W * .3;
    const ax0 = landscape ? cr.right - sr.left + 10 : 10, ax1 = W - 10, ay0 = 12, ay1 = cr && !landscape ? Math.max(H * .3, cr.top - sr.top - 10) : H - 80;
    let s = 1, tx = 0, ty = 0;
    // Live camera: true scale, so the nodes stay fixed in the room as people walk around. Preview: auto-frame.
    const live = window.PosterAR && PosterAR.mode && PosterAR.mode() === 'camera';
    if (!live && x1 > x0 && y1 > y0) { s = Math.max(.8, Math.min(3, (ax1 - ax0) / (x1 - x0), (ay1 - ay0) / (y1 - y0))); tx = (ax0 + ax1) / 2 - s * (x0 + x1) / 2; ty = (ay0 + ay1) / 2 - s * (y0 + y1) / 2; }
    const a = reduce ? 1 : 1 - Math.exp(-dt / 450); zoom.s = lerp(zoom.s, s, a); zoom.tx = lerp(zoom.tx, tx, a); zoom.ty = lerp(zoom.ty, ty, a);
    const Z = new rt.T.Matrix4().set(zoom.s, 0, 0, 2 * zoom.tx / W + zoom.s - 1, 0, zoom.s, 0, 1 - zoom.s - 2 * zoom.ty / H, 0, 0, 1, 0, 0, 0, 0, 1);
    cam.projectionMatrix.premultiply(Z); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const css = `translate(${zoom.tx.toFixed(1)}px,${zoom.ty.toFixed(1)}px) scale(${zoom.s.toFixed(4)})`; if (video) video.style.transform = css; backdrop.style.transform = css;
  }

  // ---------- per-frame state ----------
  function fallOf(id, mode, idx, p, ended) { const d = DEF[id]; if (mode !== 'red' || !d.censor) return 0; if (ended || idx > d.step) return 1; if (idx < d.step) return 0; return clamp((p - .3) / .45); }
  function widgetsOf(id, mode, idx, p, ended) {
    const red = mode === 'red', done = ended || idx > DEF[id].step, act = !ended && idx === DEF[id].step;
    switch (id) {
      case 'face': return [['image', red ? 'classmate_selfie.jpg' : 'synthetic_face.png', 'combo']];
      case 'safety': return [['block', 'real people, stunts', 'combo'], ['strength', 'strict', 'combo']];
      case 'consent': return [['require_consent', 'true', 'toggle']];
      case 'sampler': return [['seed', '898471028164125', 'num'], ['control_after_generate', 'randomize', 'combo'], ['steps', String(act ? Math.max(1, Math.round(ease(clamp(p / .85)) * 30)) : 30), 'num'], ['cfg', '5.0', 'num'], ['sampler_name', 'uni_pc', 'combo'], ['scheduler', 'simple', 'combo'], ['denoise', '1.00', 'num']];
      case 'audio': return red ? [['speaker', 'classmate.wav', 'combo'], ['style', 'news anchor', 'combo']] : [['prompt', 'gentle guitar music', 'text'], ['duration', '10.0', 'num']];
      case 'money': return red ? [['count', String(done ? 100 : act ? Math.round(ease(p) * 100) : 1), 'num'], ['ai_label', 'none', 'combo']] : [['credits', '52-PG02 + tools', 'text'], ['ai_disclosure', 'true', 'toggle']];
      case 'water': return [['label', 'AI-generated', 'text'], ['watermark', 'invisible', 'combo']];
      case 'out': return [['format', 'video/h264-mp4', 'combo'], ['filename_prefix', red ? 'viral_news' : '52-PG02', 'text']];
      default: return [];
    }
  }
  function drawNode(n, mode, idx, p, ended, now, fall, conn) {
    const { d, g, c } = n, done = ended || idx > d.step, act = !ended && idx === d.step, red = mode === 'red', removed = fall > .5;
    let key = mode + idx + (ended ? 'e' : '') + (removed ? 'f' : '') + (act ? Math.floor(now / 70) : '') + (ended && n.id === 'audio' ? Math.floor(now / 70) : '') + (frameReady ? 'r' : '') + conn;
    if (n.id === 'prompt') key = mode + typed(mode, done ? 1 : act ? p : 0).length + (act ? Math.floor(now / 450) % 2 : '') + conn + idx;
    if (key === n.key || !g || !g.fillText) return; n.key = key;
    const W = d.w, H = d.hh; g.setTransform(TEX, 0, 0, TEX, 0, 0); g.clearRect(0, 0, W, H);
    const [body, title] = PAL[removed ? 'red' : d.pal(mode)];
    // body, title bar, collapse dot and title (ComfyUI / LiteGraph look)
    rr(g, 1, 1, W - 2, H - 2, 8); g.fillStyle = body; g.fill();
    g.save(); rr(g, 1, 1, W - 2, H - 2, 8); g.clip(); g.fillStyle = title; g.fillRect(0, 0, W, HEAD); g.restore();
    g.fillStyle = removed ? '#ff6b6b' : '#8a8a8a'; g.beginPath(); g.arc(13, HEAD / 2, 4.5, 0, Math.PI * 2); g.fill();
    g.font = `600 12.5px ${FONT}`; g.fillStyle = '#e6e6e6'; g.fillText(d.title(mode), 25, HEAD / 2 + 4.4);
    if (act) { g.fillStyle = '#7ff0b0'; g.fillRect(3, HEAD - 2.5, (W - 6) * clamp(p), 2.5); } // executing progress, as ComfyUI shows it
    // input sockets on the left, outputs on the right; filled when linked, hollow when not
    const dot = (x, y, col, on) => { g.beginPath(); g.arc(x, y, 4.6, 0, Math.PI * 2); if (on) { g.fillStyle = col; g.fill(); } else { g.lineWidth = 1.6; g.strokeStyle = col; g.stroke(); } };
    g.font = `500 10.5px ${FONT}`;
    d.ins.forEach(([name, type], k) => { const y = slotY(k); dot(9, y, TYPE[type], conn.includes(n.id + 'i' + k)); g.fillStyle = '#b5b5b5'; g.textAlign = 'start'; g.fillText(name, 19, y + 3.6); });
    d.outs.forEach(([name, type], k) => { const y = slotY(k); dot(W - 9, y, TYPE[type], conn.includes(n.id + 'o' + k)); g.fillStyle = '#b5b5b5'; g.textAlign = 'end'; g.fillText(name, W - 19, y + 3.6); });
    g.textAlign = 'start';
    let y = HEAD + 6 + Math.max(d.ins.length, d.outs.length) * ROW;
    for (const [label, value, kind] of widgetsOf(n.id, mode, idx, p, ended)) {
      rr(g, 7, y, W - 14, 18, 9); g.fillStyle = '#222'; g.fill();
      g.font = `500 10px ${FONT}`; g.fillStyle = '#9a9a9a'; g.fillText(label, kind === 'num' ? 19 : 15, y + 12.4);
      g.fillStyle = red && /classmate|viral|none|news anchor/.test(value) ? '#ff9c9c' : '#e2e2e2'; g.textAlign = 'end'; g.fillText(value + (kind === 'combo' ? ' ▾' : ''), W - (kind === 'num' ? 19 : 15), y + 12.4); g.textAlign = 'start';
      if (kind === 'num') { g.fillStyle = '#777'; g.fillText('◂', 10, y + 12.4); g.textAlign = 'end'; g.fillText('▸', W - 10, y + 12.4); g.textAlign = 'start'; }
      y += WROW;
    }
    const cx = 8, cy = y + 2, cw = W - 16, ch = H - cy - 8;
    if (n.id === 'prompt') {
      rr(g, cx, cy, cw, ch, 6); g.fillStyle = '#222'; g.fill();
      const s = typed(mode, done ? 1 : act ? p : 0); g.font = `500 11.5px ${FONT}`;
      const end = wrapText(g, s + (act && Math.floor(now / 450) % 2 ? '▍' : ''), cx + 8, cy + 17, cw - 16, 15, w => red && BAD.test(w) ? '#ff8a8a' : '#e6e6e6');
      if (red && s.length > 30) { g.fillStyle = '#ff6b6b'; g.font = `800 10.5px ${FONT}`; g.fillText('⚠ harmful words', cx + 8, Math.min(cy + ch - 7, end + 3)); }
    } else if (n.id === 'face') {
      const sz = Math.min(cw, ch - 16), show = done ? 1 : act ? clamp(p / .3) : .25; g.save(); g.globalAlpha = show; g.drawImage(face, (W - sz) / 2, cy, sz, sz); g.restore();
      g.font = `700 10.5px ${FONT}`; g.fillStyle = red ? '#ff8a8a' : '#9fe8b5'; g.textAlign = 'center'; g.fillText(red ? '⚠ taken without consent' : 'synthetic, not a real person', W / 2, H - 10); g.textAlign = 'start';
    } else if (d.censor) {
      const msg = removed ? '✕ UNPLUGGED' : red && act && p > .15 ? 'disconnecting…' : mode === 'blue' && act && p < .45 ? 'checking…' : mode === 'blue' && (done || act) ? (n.id === 'safety' ? '✓ stunt removed' : n.id === 'consent' ? '✓ consent given' : '✓ stamped') : 'ready';
      if (msg === 'checking…') { const sx = cx + ((now / 6) % (cw + 40)) - 40, gr = g.createLinearGradient(sx, 0, sx + 40, 0); gr.addColorStop(0, 'rgba(127,240,176,0)'); gr.addColorStop(.5, 'rgba(127,240,176,.55)'); gr.addColorStop(1, 'rgba(127,240,176,0)'); g.fillStyle = gr; g.fillRect(cx, cy, cw, ch); }
      g.font = `800 17px ${FONT}`; g.textAlign = 'center'; g.fillStyle = removed ? '#ff6b6b' : msg.startsWith('✓') ? '#7ff0b0' : '#e6e6e6'; g.fillText(msg, W / 2, cy + ch / 2 + 6); g.textAlign = 'start';
    } else if (n.id === 'sampler' || n.id === 'out') {
      const a = n.id === 'sampler' ? (done ? 1 : act ? ease(clamp(p / .85)) : 0) : (done ? 1 : act ? clamp((p - .3) / .4) : 0), foot = n.id === 'out' ? 16 : 0;
      drawScene(g, cx, cy, cw, ch - foot, Math.max(.04, a), red, red && n.id === 'out' && a > .5);
      if (red && n.id === 'sampler' && a > .5) { g.fillStyle = 'rgba(0,0,0,.7)'; rr(g, cx + cw - 78, cy + 5, 73, 14, 3); g.fill(); g.fillStyle = '#fff'; g.font = `700 9px ${FONT}`; g.fillText('blurred · fake', cx + cw - 73, cy + 15); }
      if (n.id === 'out') { g.font = `700 10.5px ${FONT}`; g.fillStyle = red ? '#ff8a8a' : '#9fe8b5'; g.fillText(a <= 0 ? 'waiting' : red ? 'no label · no watermark' : 'AI-generated · watermarked', cx, H - 10);
        if (!red && a > 0) { g.fillStyle = 'rgba(255,255,255,.88)'; g.font = `800 10px ${FONT}`; g.fillText('AI · 52-PG02', cx + 6, cy + 14); } }
    } else if (n.id === 'audio') {
      const on = done || act, y0 = cy + ch / 2, amp = ch * .38; rr(g, cx, cy, cw, ch, 6); g.fillStyle = '#222'; g.fill(); g.strokeStyle = red ? '#ff8a8a' : TYPE.AUDIO; g.lineWidth = 1.6; g.beginPath();
      for (let i = 0; i <= 120; i++) { const x = cx + 6 + i / 120 * (cw - 12), ph = i / 8 + now / 260, v = on ? (red ? Math.sin(ph) * .5 + Math.sin(ph * 3.7) * .35 + ((Math.sin(i * 12.9898 + now / 90) * 43758.5) % 1) * .4 : Math.sin(ph) * Math.sin(i / 20 + 1) * .9) : 0; i ? g.lineTo(x, y0 - v * amp) : g.moveTo(x, y0 - v * amp); } g.stroke();
    } else if (n.id === 'money') {
      if (red) { const k = done ? 100 : act ? Math.round(ease(p) * 100) : 1; g.fillStyle = '#fff'; g.font = `800 28px ${FONT}`; g.fillText('× ' + k, cx + 4, cy + ch / 2 + 8); g.font = `700 10.5px ${FONT}`; g.fillStyle = '#ff8a8a'; g.fillText('copies to farm views', cx + 4, H - 10); }
      else { g.font = `700 10.5px ${FONT}`; ['credits: team + tools', 'marked as AI-altered', 'platform rules followed'].forEach((s, i) => { const on = done || (act && p > .15 + i * .25); g.fillStyle = on ? '#9fe8b5' : 'rgba(255,255,255,.35)'; g.fillText((on ? '✓ ' : '○ ') + s, cx + 4, cy + 13 + i * 15); }); }
    }
    n.tex.needsUpdate = true;
  }
  function update(si, p, now) {
    if (!R || disposed) return;
    const mode = api.mode(), ended = si >= STEPS.length, idx = Math.min(si, STEPS.length - 1), T = R.T, P = R.P, col = new T.Color(COLOR[mode]);
    const fut2 = w => !ended && Math.max(DEF[w.a].step, DEF[w.b].step) > idx;
    const ps = updateCamera(R), dt = lastNow ? Math.min(100, now - lastNow) : 16; lastNow = now; canvas.style.opacity = ps ? '1' : '0'; if (!ps) return; frameView(R, ps, dt);
    R.frameLine.material.color.copy(col);
    // which links are live: a link into a fallen module is cut; its bypass appears once the module is gone
    const cutOf = l => [l.a, l.b].some(id => fallOf(id, mode, idx, p, ended) > .15), live = R.wires.filter(w => !cutOf(w)).concat(Object.entries(R.bypass).filter(([c]) => fallOf(c, mode, idx, p, ended) > .5).map(([, w]) => w));
    const conn = live.map(w => w.a + 'o' + w.ai + ',' + w.b + 'i' + w.bi).join(',');
    const sec = dt / 1000, back = t => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
    const bounce = t => { const n = 7.5625, d = 2.75; return t < 1 / d ? n * t * t : t < 2 / d ? n * (t -= 1.5 / d) * t + .75 : t < 2.5 / d ? n * (t -= 2.25 / d) * t + .9375 : n * (t -= 2.625 / d) * t + .984375; };
    if (!R.t0) R.t0 = now; const intro = reduce ? 9 : (now - R.t0) / 1000;
    if (R.lastMode !== mode) { if (R.lastMode) R.switchAt = now; R.lastMode = mode; }
    R.grid.material.opacity = lerp(R.grid.material.opacity, .62, 1 - Math.exp(-dt / 400));
    for (const n of Object.values(R.nodes)) {
      const d = n.d, fall = fallOf(n.id, mode, idx, p, ended), act = !ended && ACTIVE[idx].includes(n.id), fut = !ended && d.step > idx;
      drawNode(n, mode, idx, p, ended, now, fall, conn);
      // entrance: each node rises out of the paper in turn; then it hovers gently
      const rise = clamp((intro - n.i * .09) / .55), up = rise <= 0 ? 0 : back(rise), bob = reduce || fall ? 0 : Math.sin(now / 1400 + n.i * 1.7) * 5;
      // switching Blue <-> Red sends a ripple across the graph
      const sw = clamp((now - R.switchAt - d.x / 1640 * 260) / 380), pop = reduce ? 0 : Math.sin(sw * Math.PI) * .09;
      // Red: a safety module shakes, is pulled out of its sockets, drops, bounces on the paper and settles
      const side = n.id === 'consent' ? -1 : 1, shake = mode === 'red' && d.censor && !ended && idx === d.step && p > .12 && p < .3 && !reduce ? Math.sin(now / 28) * .07 : 0;
      const u = clamp(fall / .2), b = fall <= .2 ? 0 : bounce(clamp((fall - .2) / .8)), tum = fall <= .2 ? 0 : Math.sin(clamp((fall - .2) / .55) * Math.PI);
      const px = d.x + side * (22 * ease(u) + 95 * b), py = d.y + 135 * b, pz = lerp((d.h + 28 * ease(u)) * up + bob, 9, b);
      n.grp.position.copy(P(px, py, pz)); n.grp.rotation.set(tum * 1.15, tum * .6 * side, shake + b * .5 * side);
      n.grp.scale.setScalar(Math.max(.001, (rise <= 0 ? 0 : .35 + .65 * up) * (1 + pop) * (act && !fall ? 1.035 : 1)));
      if (fall > 0 && n.prevFall === 0 && fall < .2) R.emit(P(d.x - d.w / 2, d.y - d.hh / 2 + slotY(0), d.h + 10), 16, '#ffd28a'), R.emit(P(d.x + d.w / 2, d.y - d.hh / 2 + slotY(0), d.h + 10), 16, '#ff6b6b');
      if (fall >= .49 && n.prevFall < .49 && fall - n.prevFall < .2) { R.ring(P(px, py, 3), COLOR.red, 260); R.emit(P(px, py, 12), 22, '#ff8a6b', 300); }
      n.prevFall = fall;
      // Blue: when a check passes, a green ring pulses out from the module
      const pk = mode + idx; if (mode === 'blue' && d.censor && !ended && idx === d.step && p >= .45 && n.passKey !== pk) { if (p < .6) { R.ring(P(d.x, d.y, d.h + 12), '#7ff0b0', 300, .9); R.emit(P(d.x, d.y, d.h + 14), 14, '#7ff0b0', 240); } n.passKey = pk; }
      const op = (fut ? .4 : fall > .5 ? .6 : 1) * clamp(rise * 2); n.front.opacity = op; n.side.opacity = op * .95;
      n.edgeMat.color.set(fall > .5 ? COLOR.red : act ? COLOR[mode] : '#6b6b6b'); n.edgeMat.opacity = (act ? 1 : .7) * clamp(rise * 2);
      n.haloMat.color.set(fall > 0 ? COLOR.red : COLOR[mode]); n.haloMat.opacity = lerp(n.haloMat.opacity, act ? (fall > .5 ? .25 : .5 + (reduce ? 0 : Math.sin(now / 320) * .14)) : 0, 1 - Math.exp(-dt / 220));
      n.sh.position.copy(P(px + pz * .1, py + pz * .14, 2.5)); n.shMat.opacity = (fut ? .25 : .5 * clamp(1 - pz / 900) + .2) * clamp(rise);
      n.stem.visible = fall === 0 && rise >= 1; n.stemMat.opacity = fut ? .15 : .35;
    }
    // links: type-coloured as in ComfyUI. They draw themselves in, the step's links carry a pulse of energy,
    // links into an unplugged module whip back, and red bypass links grow across the gap.
    const flows = new Set(FLOW[idx]), N = 48, IDX = 48, range = (mesh, a, b) => { const s0 = Math.round(clamp(a) * N), s1 = Math.round(clamp(b) * N); mesh.visible = s1 > s0; mesh.geometry.setDrawRange(s0 * IDX, (s1 - s0) * IDX); };
    const pulse = (w, a, b, speed, on) => { if (!on || reduce && false) { w.flow.visible = false; return; } const c = ((now / speed + w.i * .17) % 1.3) - .15; range(w.flow, Math.max(a, c - .13), Math.min(b, c + .13)); };
    for (const w of R.wires) {
      const drawn = clamp((intro - 1 - w.i * .07) / .5), fa = fallOf(w.a, mode, idx, p, ended), fb = fallOf(w.b, mode, idx, p, ended), ra = clamp(fa / .18), rb = clamp(fb / .18);
      const a = ra, b = Math.min(drawn, 1 - rb), on = (flows.has(w.key) || ended) && fa === 0 && fb === 0 && drawn >= 1;
      range(w.mesh, a, b); w.mat.color.copy(w.color); w.mat.opacity = on ? 1 : fut2(w) ? .4 : .8; w.flowMat.color.copy(w.color); pulse(w, a, b, ended ? 1700 : 1000, on);
    }
    for (const [c, w] of Object.entries(R.bypass)) { const f = fallOf(c, mode, idx, p, ended), grow = clamp((f - .5) / .3); range(w.mesh, 0, grow); w.flowMat.color.set(COLOR.red); pulse(w, 0, grow, 800, grow >= 1 && (ended || idx >= DEF[c].step)); }
    // sparks and rings
    for (let k = 0; k < R.parts.length; k++) { const q = R.parts[k]; if (q.life > 0) { q.life -= sec; q.v.z -= 900 * sec; q.p.addScaledVector(q.v, sec); if (q.p.z < 2) { q.p.z = 2; q.v.z *= -.35; q.v.x *= .6; q.v.y *= .6; } const f = clamp(q.life / q.max); R.spPos[k * 3] = q.p.x; R.spPos[k * 3 + 1] = q.p.y; R.spPos[k * 3 + 2] = q.p.z; R.spCol[k * 3] = q.c.r * f; R.spCol[k * 3 + 1] = q.c.g * f; R.spCol[k * 3 + 2] = q.c.b * f; } else R.spPos[k * 3 + 2] = 1e6; }
    R.spGeo.attributes.position.needsUpdate = true; R.spGeo.attributes.color.needsUpdate = true;
    for (const r of R.rings) { if (!r.m.visible) continue; r.t += sec / r.dur; if (r.t >= 1) { r.m.visible = false; continue; } const e = 1 - (1 - r.t) ** 3; r.m.scale.setScalar(20 + r.size * e); r.m.material.opacity = (1 - r.t) * .9; }

    // floating labels
    const MAIN = ['prompt', 'face', 'sampler', 'audio', 'money', 'out'], SAY = { blue: ['✓ Reviewed by people', '✓ Consent given', '✓ Dangerous stunt blocked', '✓ Original music', '✓ Credited + disclosed', '✓ Labelled + watermarked'], red: ['⚠ Written to deceive', '⚠ No consent', '⚠ Safety filter removed', '⚠ Voice cloned', '⚠ ×100 content farm', '⚠ No label · goes viral'] };
    const paint = (L, key, draw) => { if (L.key === key || !L.g || !L.g.fillText) return; L.key = key; L.g.setTransform(2, 0, 0, 2, 0, 0); L.g.clearRect(0, 0, L.w, L.h); draw(L.g, L.w, L.h); L.tex.needsUpdate = true; };
    const co = R.callout, showCo = !ended && p > .5 && intro > 1.6, cd = DEF[MAIN[idx]];
    paint(co, mode + idx, (g, w, h) => { rr(g, 2, 2, w - 4, h - 4, h / 2 - 2); g.fillStyle = COLOR[mode]; g.fill(); g.fillStyle = mode === 'blue' ? '#08203a' : '#3a0808'; g.font = `800 25px ${FONT}`; g.textAlign = 'center'; g.fillText(SAY[mode][idx], w / 2, h / 2 + 9); g.textAlign = 'start'; });
    co.pop = lerp(co.pop, showCo ? 1 : 0, 1 - Math.exp(-dt / (showCo ? 140 : 90))); co.m.visible = co.pop > .02; co.m.scale.setScalar(Math.max(.001, showCo ? back(clamp(co.pop)) : co.pop)); co.m.material.opacity = clamp(co.pop * 1.5);
    co.m.position.copy(P(clamp((cd.x - 230) / 1140) * 1140 + 230, cd.y - cd.hh / 2 - 52, cd.h + 70 + (reduce ? 0 : Math.sin(now / 500) * 6)));
    const guards = ['consent', 'safety', 'water'].map(id => fallOf(id, mode, idx, p, ended) > .5), kept = guards.filter(x => !x).length, sc = R.score;
    paint(sc, mode + guards.join(), (g, w, h) => { rr(g, 2, 2, w - 4, h - 4, 14); g.fillStyle = 'rgba(12,15,19,.92)'; g.fill(); g.lineWidth = 2; g.strokeStyle = COLOR[mode]; g.stroke(); g.font = `800 17px ${FONT}`; g.fillStyle = '#fff'; g.fillText(`SAFEGUARDS ${kept}/3`, 18, h / 2 + 6);
      ['Consent', 'Safety filter', 'AI label'].forEach((t, k) => { const x = 190 + k * 122, lost = guards[k]; rr(g, x, 13, 114, h - 26, 9); g.fillStyle = lost ? '#5a2026' : '#1f4a34'; g.fill(); g.font = `700 14px ${FONT}`; g.fillStyle = lost ? '#ff9c9c' : '#9fe8b5'; g.fillText((lost ? '✕ ' : '✓ ') + t, x + 9, h / 2 + 5); }); });
    sc.pop = lerp(sc.pop, intro > 1.4 ? 1 : 0, 1 - Math.exp(-dt / 200)); sc.m.visible = sc.pop > .02; sc.m.material.opacity = sc.pop; sc.m.scale.setScalar(.6 + .4 * sc.pop);
    const rs = R.result;
    paint(rs, mode, (g, w, h) => { const red = mode === 'red'; rr(g, 3, 3, w - 6, h - 6, 26); g.fillStyle = 'rgba(10,13,17,.94)'; g.fill(); g.lineWidth = 4; g.strokeStyle = COLOR[mode]; g.stroke();
      g.fillStyle = COLOR[mode]; g.font = `800 20px ${FONT}`; g.fillText(red ? 'RED · HARMFUL USE' : 'BLUE · GOOD USE', 34, 46); g.fillStyle = '#fff'; g.font = `800 62px ${FONT}`; g.fillText(red ? '100 fake copies' : '1 honest film', 32, 118);
      g.font = `700 23px ${FONT}`; g.fillStyle = red ? '#ff9c9c' : '#9fe8b5'; (red ? ['✕ 0 of 3 safeguards left', '✕ a real face, no consent', '✕ no label, no watermark'] : ['✓ 3 of 3 safeguards kept', '✓ consent, credits, disclosure', '✓ AI label + watermark']).forEach((t, k) => g.fillText(t, 34 + (k % 2) * 360, 164 + Math.floor(k / 2) * 34));
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `600 19px ${FONT}`; g.textAlign = 'end'; g.fillText('Same tools. Different choices.', w - 30, h - 24); g.textAlign = 'start'; });
    rs.pop = lerp(rs.pop, ended ? 1 : 0, 1 - Math.exp(-dt / (ended ? 260 : 100))); rs.m.visible = rs.pop > .02; rs.m.material.opacity = clamp(rs.pop * 1.4); rs.m.scale.setScalar(Math.max(.001, ended ? back(clamp(rs.pop)) : rs.pop));

    // Red: copies pile up beside the output at step 05, then are fired out one after another and drift everywhere.
    const O = DEF.out, red = mode === 'red';
    if (ended && !endAt) endAt = now; if (!ended) endAt = 0;
    const burstT = red ? (ended ? 8.6 * .7 + (now - endAt) / 1000 : idx === 5 ? (p - .3) * 8.6 : -1) : -1, stackN = red && idx === 4 && !ended ? Math.floor(ease(p) * 14) : 0, spin = reduce ? 0 : 1;
    const bk = red && burstT > 0 ? mode + idx + ended : ''; if (bk && !R.burstKey && burstT < .5) { R.emit(P(O.x, O.y, O.h + 20), 50, '#ff6b6b', 620); R.ring(P(O.x, O.y, O.h), COLOR.red, 520, 1); api.dialog.classList.remove('ar-burst'); void api.dialog.offsetWidth; api.dialog.classList.add('ar-burst'); } R.burstKey = bk;
    R.copies.forEach(c => {
      const t = burstT - c.j * .045;
      if (burstT > 0 && t > 0) { const k = 1 - Math.exp(-t / 1.3), th = c.th + spin * t * c.w * .3, r = 40 + c.rad * 1150 * k;
        c.m.visible = true; c.m.position.copy(P(O.x - 260 * k + Math.cos(th) * r, O.y + Math.sin(th) * r * .8, O.h + 30 + c.z * 620 * k + spin * Math.sin(t * 1.3 + c.j) * 34));
        c.m.rotation.set(c.spin[0] * t * spin * .8, c.spin[1] * t * spin * .8, c.spin[2] * t * spin * .4); c.m.scale.setScalar(Math.min(1, t * 5) * (1 + Math.max(0, .35 - t) * 1.2));
      } else if (c.j < stackN) { const born = clamp(ease(p) * 14 - c.j); c.m.visible = true; c.m.position.copy(P(O.x - 20 + (c.j % 2) * 14, O.y - 215 - c.j * 6, O.h - 40 + c.j * 9 + (1 - born) * 60)); c.m.rotation.set(0, 0, .08 * (c.j % 3 - 1)); c.m.scale.setScalar(.8 * Math.max(.05, back(born))); }
      else c.m.visible = false; });
    // Blue: the watermark is stamped (a ring), and one credited film glides down onto the paper.
    const fp = mode === 'blue' ? (ended ? 1 : idx === 5 ? ease(clamp((p - .55) / .4)) : 0) : 0, fm = R.film;
    if (fp > 0 && !fm.was && fp < .3) { R.ring(P(O.x, O.y, O.h + 12), COLOR.blue, 380, .9); R.emit(P(O.x, O.y, O.h + 14), 18, '#bfe0ff', 260); } fm.was = fp > 0;
    fm.m.visible = fp > 0; if (fp > 0) { fm.m.position.copy(P(lerp(O.x, 1420, fp), lerp(O.y + 40, 1690, fp), lerp(O.h - 60, 6, fp) + Math.sin(fp * Math.PI) * 120)); fm.m.rotation.set(Math.sin(fp * Math.PI) * .5, 0, lerp(0, -.12, fp)); fm.m.scale.setScalar(Math.min(1, fp * 4));
      if (fm.key !== String(frameReady)) { fm.key = String(frameReady); fm.g.fillStyle = '#10151c'; fm.g.fillRect(0, 0, 300, 190); drawScene(fm.g, 8, 8, 284, 140, 1, false, false); fm.g.fillStyle = '#9fe8b5'; fm.g.font = `700 15px ${FONT}`; fm.g.fillText('AI-generated · credited · watermarked', 12, 176); fm.tex.needsUpdate = true; } }
    R.renderer.render(R.scene, R.camera);
  }
  function dispose() {
    disposed = true; api.dialog.classList.remove('ar-burst'); canvas.remove(); backdrop.remove(); if (video) video.style.transform = ''; if (savedBg && savedBg !== 'none' && api.stage.style.backgroundImage === 'none') api.stage.style.backgroundImage = savedBg; delete api.dialog.dataset.no3d;
    if (R) { R.disposables.forEach(o => { try { o.dispose(); } catch {} }); try { R.renderer.dispose(); R.renderer.forceContextLoss(); } catch {} R = null; }
  }
  // For checks: where a poster point at a height lands on screen.
  // (without the auto-framing zoom, so it can be compared with the tracker's own mapping)
  function project(x, y, h) { if (!R) return null; const v = R.P(x, y, h).applyMatrix4(R.root.matrixWorld).project(R.camera), b = canvas.getBoundingClientRect(), px = (v.x + 1) / 2 * b.width, py = (1 - v.y) / 2 * b.height; return { x: (px - zoom.tx) / zoom.s, y: (py - zoom.ty) / zoom.s }; }
  return { update, dispose, project, zoom: () => ({ ...zoom }), ready: () => !!R };
}
};
