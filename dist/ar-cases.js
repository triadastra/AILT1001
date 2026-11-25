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
    blue: 'Blue: the prompt is the one printed on the poster: a street musician playing guitar in a retro 1970s-style subway station. The team reviews it before anything is generated. [1,3]',
    red: 'Red: same prompt box, same model, but the words change: a real classmate’s face, a fake “breaking news” framing and a dangerous stunt. [21]',
    tip: 'Same tool. The goal changed: telling a story vs. passing fiction off as real.' },
  { title: '02 · Create visual assets',
    blue: 'Blue: the image node loads the armoured figure printed on the poster, a fictional character, as the first frame. No real person is shown, so the consent check passes. [1,3]',
    red: 'Red: the face is a classmate’s selfie, taken without asking. The consent check is unplugged and drops out of the workflow. [20]',
    tip: 'Whose face is it? A real person’s likeness needs their consent.' },
  { title: '03 · Generate the video',
    blue: 'Blue: the safety filter catches the dangerous stunt, so the sampler renders an original, fictional character in a scene the team could never afford to build. [1,3]',
    red: 'Red: the safety filter drops out too. The sampler renders the stunt with the real face, shown blurred here. Our proposal worries children may copy stunts like this. [21]',
    tip: 'Fiction is fine. Realistic danger featuring a real person is not.' },
  { title: '04 · Add sound & edit',
    blue: 'Blue: an audio model writes original guitar music, and a human editor lines up picture, sound and captions in an editor such as DaVinci Resolve, as on the poster. [4,13]',
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
// One line per step, shown in the AR itself on a ComfyUI-style note beside that step's nodes, so the reason is visible
// without opening the caption. Each line restates its step's caption above (same sources).
const WHY = [
  { blue: 'An original, fictional scene. People review it before anything is generated.', red: 'Fiction is presented as real news about a real person.' },
  { blue: 'A fictional character. No real person’s likeness is used.', red: 'A real person’s face is used without their consent.' },
  { blue: 'The filter removes the dangerous stunt. The scene stays fiction.', red: 'A realistic dangerous stunt with a real face. Children may copy it.' },
  { blue: 'Original music. A human editor makes the cut.', red: 'A cloned voice and a fake news anchor make it look real.' },
  { blue: 'Credited, and marked as AI-altered.', red: '100 near-identical clips, made only to farm views.' },
  { blue: 'Labelled and watermarked, so anyone can check.', red: 'No label and no watermark. Viewers cannot tell it is AI.' }
];
const PANELS = [[60, 950, 515, 370], [590, 950, 515, 370], [1120, 950, 515, 370], [1120, 1335, 515, 380], [590, 1335, 515, 380], [60, 1335, 515, 380]];
const steps = STEPS.map(s => ({ title: s.title, blue: s.blue, red: s.red, tip: s.tip, dur: 8600 }));
return { cases: {
  name: 'Same workflow, two outcomes', input: 'A street musician in a 1970s-style subway station', accent: COLOR.blue, modes: COLOR, spatial: true,
  // The printed panels 01-06 in poster units (01-03 run left to right, 04-06 come back right to left). With a live camera,
  // looking at panel N shows step N (ar-explain.js), so the two demos are followed panel by panel on the paper.
  panels: PANELS,
  link: { href: '#citations', label: 'Check the sources ↗' }, steps,
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
  // The other panels' pictures, exactly as cropped on the poster (credits: REFERENCES-AND-IMAGE-CREDITS.md). Each already carries its printed source label, e.g. “Image [17]”.
  const PICS = { armoured: ['assets/cite/armoured.jpg'], davinci: ['assets/cite/davinci.jpg'], toysrus: ['assets/cite/toysrus.jpg'], frost: ['assets/cite/frost.jpg'] }; let picsReady = 0;
  for (const k in PICS) { const im = new Image(), entry = PICS[k]; entry.push(im, false); im.src = entry[0]; (im.decode ? im.decode() : Promise.reject()).then(() => { entry[2] = true; picsReady++; }).catch(() => {}); }
  // Draw a poster picture to fill a box (centre crop).
  function drawPic(g, name, x, y, w, h, alpha = 1) {
    const [, im, ok] = PICS[name]; g.save(); rr(g, x, y, w, h, 6); g.clip(); g.fillStyle = '#2a3038'; g.fillRect(x, y, w, h);
    if (ok) { const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k; g.globalAlpha = alpha; g.drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h); g.globalAlpha = 1; }
    g.restore();
  }
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
  // Blue types the prompt printed in panel 01 (ComfyUI's Wan 2.2 example, source [3]). Red starts the same sentence, deletes the musician and writes the harm in.
  const BLUE_PROMPT = 'Low contrast. In a retro 1970s-style subway station, a street musician plays in dim colors and rough textures. He wears an old jacket, playing guitar with focus.';
  const RED_BASE = 'In a retro 1970s-style subway station, ', RED_FIRST = 'a street musician plays', RED_PROMPT = RED_BASE + 'my classmate (use his real face) jumps onto the tracks. Make it look like REAL breaking news.';
  const BAD = /classmate|real|face|jumps|tracks|breaking|news/i;
  function typed(mode, p) {
    if (mode === 'blue') return BLUE_PROMPT.slice(0, Math.round(clamp(p / .8) * BLUE_PROMPT.length));
    const start = RED_BASE + RED_FIRST;
    if (p < .25) return start.slice(0, Math.round(p / .25 * start.length));
    if (p < .36) return start.slice(0, RED_BASE.length + Math.round((1 - (p - .25) / .11) * RED_FIRST.length));
    return RED_PROMPT.slice(0, RED_BASE.length + Math.round(clamp((p - .36) / .52) * (RED_PROMPT.length - RED_BASE.length)));
  }

  const TYPE = { CLIP: '#FFD500', CONDITIONING: '#FFA931', MODEL: '#B39DDB', IMAGE: '#64B5F6', MASK: '#81C784', AUDIO: '#4EC9B0', STRING: '#A5D6A7' };
  const PAL = { default: ['#353535', '#222222'], green: ['#353f35', '#223322'], red: ['#553333', '#332222'], cyan: ['#335555', '#223333'], purple: ['#553355', '#332233'] };
  // Node layout in poster units; h = height above the paper. Each step's nodes float over that step's printed panel
  // (PANELS), so the active nodes are where the viewer is looking.
  const DEF = {
    prompt: { x: 300, y: 1105, h: 200, w: 400, hh: 240, step: 0, pal: m => m === 'red' ? 'red' : 'green', title: () => 'CLIP Text Encode (Positive Prompt)', ins: [['clip', 'CLIP']], outs: [['CONDITIONING', 'CONDITIONING']] },
    face: { x: 735, y: 1150, h: 200, w: 290, hh: 250, step: 1, pal: () => 'default', title: () => 'Load Image', ins: [], outs: [['IMAGE', 'IMAGE'], ['MASK', 'MASK']] },
    safety: { x: 1225, y: 1040, h: 260, w: 210, hh: 150, step: 2, censor: true, pal: () => 'green', title: () => '🛡 Safety Filter', ins: [['conditioning', 'CONDITIONING']], outs: [['CONDITIONING', 'CONDITIONING']] },
    consent: { x: 1000, y: 1245, h: 260, w: 230, hh: 130, step: 1, censor: true, pal: () => 'green', title: () => '🛡 Consent Check', ins: [['image', 'IMAGE']], outs: [['IMAGE', 'IMAGE']] },
    sampler: { x: 1482, y: 1165, h: 330, w: 300, hh: 360, step: 2, pal: () => 'default', title: () => 'KSampler (Wan 2.2)', ins: [['model', 'MODEL'], ['positive', 'CONDITIONING'], ['start_image', 'IMAGE']], outs: [['IMAGE', 'IMAGE']] },
    audio: { x: 1290, y: 1535, h: 260, w: 310, hh: 240, step: 3, pal: m => m === 'red' ? 'red' : 'cyan', title: m => m === 'red' ? 'Voice Clone + News Overlay' : 'Edit & Mix', ins: [], outs: [['AUDIO', 'AUDIO']] },
    money: { x: 760, y: 1525, h: 280, w: 300, hh: 250, step: 4, pal: m => m === 'red' ? 'red' : 'purple', title: m => m === 'red' ? 'Repeat Batch' : 'Credits + AI Disclosure', ins: [], outs: [['metadata', 'STRING']] },
    water: { x: 168, y: 1450, h: 300, w: 210, hh: 150, step: 5, censor: true, pal: () => 'green', title: () => '🛡 AI Label + Watermark', ins: [['images', 'IMAGE']], outs: [['IMAGE', 'IMAGE']] },
    out: { x: 425, y: 1520, h: 360, w: 290, hh: 280, step: 5, pal: () => 'default', title: () => 'Save & Publish Video', ins: [['images', 'IMAGE'], ['audio', 'AUDIO'], ['metadata', 'STRING']], outs: [] }
  };
  // The "why" notes (WHY above), one per step, in the free corner of that step's panel: x, y, height above the paper, width, height.
  const NOTE_AT = [[317, 1300, 250, 300, 104], [1000, 1055, 300, 226, 150], [1225, 1225, 300, 206, 170], [1545, 1535, 300, 180, 200], [1012, 1525, 310, 180, 200], [168, 1620, 330, 206, 150]];
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

    const nodes = {};
    for (const [id, d] of Object.entries(DEF)) {
      const c = document.createElement('canvas'); c.width = Math.round(d.w * TEX); c.height = Math.round(d.hh * TEX);
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const side = keep(new T.MeshStandardMaterial({ color: 0x1a2230, metalness: .35, roughness: .4, transparent: true })), front = keep(new T.MeshBasicMaterial({ map: tex, transparent: true }));
      const geo = keep(new T.BoxGeometry(d.w, d.hh, 16)), box = new T.Mesh(geo, [side, side, side, side, front, side]);
      const edgeMat = keep(new T.LineBasicMaterial({ color: 0x555555, transparent: true })), edges = new T.LineSegments(keep(new T.EdgesGeometry(geo)), edgeMat);
      const grp = new T.Group(); grp.add(box, edges); grp.position.copy(P(d.x, d.y, d.h)); root.add(grp);
      const shMat = keep(new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .55 })), sh = new T.Mesh(keep(new T.PlaneGeometry(d.w * 1.2, d.hh * 1.1)), shMat); root.add(sh);
      const stemMat = keep(new T.LineDashedMaterial({ color: 0xffffff, dashSize: 10, gapSize: 10, transparent: true, opacity: .35 })), stem = new T.Line(keep(new T.BufferGeometry().setFromPoints([P(d.x, d.y, 0), P(d.x, d.y, d.h - 8)])), stemMat); stem.computeLineDistances(); root.add(stem);
      nodes[id] = { id, d, c, g: c.getContext('2d'), tex, side, front, edgeMat, grp, sh, shMat, stem, stemMat, key: '' };
    }
    const notes = NOTE_AT.map(([x, y, h, w, hh], i) => { const c = document.createElement('canvas'); c.width = Math.round(w * TEX); c.height = Math.round(hh * TEX);
      const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const side = keep(new T.MeshStandardMaterial({ color: 0x1a2230, metalness: .35, roughness: .4, transparent: true })), front = keep(new T.MeshBasicMaterial({ map: tex, transparent: true }));
      const geo = keep(new T.BoxGeometry(w, hh, 10)), edgeMat = keep(new T.LineBasicMaterial({ color: 0xffffff, transparent: true })), grp = new T.Group(); grp.add(new T.Mesh(geo, [side, side, side, side, front, side]), new T.LineSegments(keep(new T.EdgesGeometry(geo)), edgeMat));
      grp.position.copy(P(x, y, h)); grp.visible = false; root.add(grp); return { i, w, hh, c, g: c.getContext('2d'), tex, side, front, edgeMat, grp, key: '' }; });
    // links from output socket to input socket, as tubes with ComfyUI's horizontal bezier tangents,
    // plus red bypass links used when a safety module drops out
    const sock = (id, out, k) => { const d = DEF[id]; return P(d.x + (out ? 1 : -1) * (d.w / 2 - 9), d.y - d.hh / 2 + slotY(k), d.h + 8.5); };
    // A link that runs back to the left (the bottom row of panels reads right to left) arcs up and over the nodes in between.
    function link([a, ai, b, bi], color) { const pa = sock(a, true, ai), pb = sock(b, false, bi), back = pb.x < pa.x, k = back ? 110 : Math.max(70, Math.abs(pb.x - pa.x) * .5), lift = new T.Vector3(0, 0, back ? 110 + (pa.x - pb.x) * .12 : 18);
      const curve = new T.CubicBezierCurve3(pa, pa.clone().add(new T.Vector3(k, 0, 0)).add(lift), pb.clone().add(new T.Vector3(-k, 0, 0)).add(lift), pb);
      const mat = keep(new T.MeshBasicMaterial({ color, transparent: true, opacity: .8 })), mesh = new T.Mesh(keep(new T.TubeGeometry(curve, 48, 3.2, 8, false)), mat); root.add(mesh);
      const dots = Array.from({ length: 3 }, () => { const m = new T.Mesh(keep(new T.SphereGeometry(7, 12, 10)), keep(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true }))); root.add(m); return m; });
      return { a, b, ai, bi, key: a + '>' + b, curve, mesh, mat, dots, color: new T.Color(color) }; }
    const wires = LINKS.map(l => link(l, TYPE[DEF[l[0]].outs[l[1]][1]])), bypass = {}; for (const [c, l] of Object.entries(BYPASS)) bypass[c] = link(l, 0xff6b6b);
    // the mass-produced copies (red) and the single released film (blue)
    const copyGeo = keep(new T.BoxGeometry(150, 96, 6)), copySide = keep(new T.MeshStandardMaterial({ color: 0x2a1418, transparent: true })), copyFronts = HEADLINES.map((_, v) => { const c = document.createElement('canvas'); c.width = 330; c.height = 210; const g = c.getContext('2d'); g.fillStyle = '#10151c'; g.fillRect(0, 0, 330, 210); drawScene(g, 6, 6, 318, 198, 1, true, true, v); const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace; return keep(new T.MeshBasicMaterial({ map: tex, transparent: true })); });
    const rand = (s => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)(7);
    const copies = Array.from({ length: 64 }, (_, j) => { const m = new T.Mesh(copyGeo, [copySide, copySide, copySide, copySide, copyFronts[j % copyFronts.length], copySide]); m.visible = false; root.add(m);
      return { m, j, th: rand() * Math.PI * 2, rad: .35 + rand() * .9, z: .2 + rand() * 1.2, w: (rand() - .5) * .9, spin: [(rand() - .5) * 3, (rand() - .5) * 3, (rand() - .5) * 2] }; });
    const film = (() => { const c = document.createElement('canvas'); c.width = 300; c.height = 190; const g = c.getContext('2d'); const tex = keep(new T.CanvasTexture(c)); tex.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(keep(new T.BoxGeometry(240, 152, 6)), [copySide, copySide, copySide, copySide, keep(new T.MeshBasicMaterial({ map: tex, transparent: true })), copySide]); m.visible = false; root.add(m); return { c, g, tex, m, key: '' }; })();
    // outlines of the printed panels on the paper: the one to look at next pulses
    const panelLines = PANELS.map(([x, y, w, h]) => { const l = new T.LineLoop(keep(new T.BufferGeometry().setFromPoints([P(x, y, 2), P(x + w, y, 2), P(x + w, y + h, 2), P(x, y + h, 2)])), keep(new T.LineBasicMaterial({ color: COLOR.blue, transparent: true, opacity: 0 }))); l.visible = false; root.add(l); return l; });
    return { T, renderer, scene, camera, root, P, nodes, notes, wires, bypass, copies, film, frameLine, panelLines, disposables };
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
      case 'face': return [['image', red ? 'classmate_selfie.jpg' : 'armoured_figure.png', 'combo']];
      case 'safety': return [['block', 'real people, stunts', 'combo'], ['strength', 'strict', 'combo']];
      case 'consent': return [['require_consent', 'true', 'toggle']];
      case 'sampler': return [['seed', '898471028164125', 'num'], ['steps', String(act ? Math.max(1, Math.round(ease(clamp(p / .85)) * 30)) : 30), 'num'], ['cfg', '5.0', 'num'], ['sampler_name', 'uni_pc', 'combo'], ['scheduler', 'simple', 'combo']];
      case 'audio': return red ? [['voice', 'cloned: classmate.wav', 'combo'], ['presenter', 'AI news anchor', 'combo']] : [['music', 'original guitar (MusicGen)', 'text'], ['editor', 'human', 'combo']];
      case 'money': return red ? [['count', String(done ? 100 : act ? Math.round(ease(p) * 100) : 1), 'num'], ['ai_label', 'none', 'combo']] : [['credits', '52-PG02 + tools', 'text'], ['ai_disclosure', 'true', 'toggle'], ['monetise', 'off for this clip', 'combo']];
      case 'water': return [['label', 'AI-generated', 'text'], ['watermark', 'invisible', 'combo']];
      case 'out': return [['format', 'video/h264-mp4', 'combo'], ['filename_prefix', red ? 'viral_news' : '52-PG02', 'text']];
      default: return [];
    }
  }
  function drawNode(n, mode, idx, p, ended, now, fall, conn) {
    const { d, g, c } = n, done = ended || idx > d.step, act = !ended && idx === d.step, red = mode === 'red', removed = fall > .5;
    let key = mode + idx + (ended ? 'e' : '') + (removed ? 'f' : '') + (act && p > .22 ? 'w' : '') + (act ? Math.floor(now / 70) : '') + (ended && n.id === 'audio' ? Math.floor(now / 70) : '') + (frameReady ? 'r' : '') + picsReady + conn;
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
    // Red: the nodes doing the harm get ComfyUI's red error outline and a warning mark in the title bar
    if (red && !d.censor && (done || (act && p > .22))) { g.lineWidth = 3; g.strokeStyle = '#ff4d4d'; rr(g, 2.5, 2.5, W - 5, H - 5, 7); g.stroke(); g.font = `800 13px ${FONT}`; g.fillStyle = '#ff6b6b'; g.textAlign = 'end'; g.fillText('⚠', W - 9, HEAD / 2 + 4.6); g.textAlign = 'start'; }
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
      g.fillStyle = red && /classmate|viral|none|news anchor/.test(value) ? '#ff9c9c' : '#e2e2e2'; if (red && n.id === 'money' && label === 'count') g.fillStyle = '#ff9c9c'; g.textAlign = 'end'; g.fillText(value + (kind === 'combo' ? ' ▾' : ''), W - (kind === 'num' ? 19 : 15), y + 12.4); g.textAlign = 'start';
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
      // Blue: the armoured figure printed in panel 02. Red: a selfie of a real classmate (a drawn stand-in, never a photo).
      const show = done ? 1 : act ? clamp(p / .3) : .25, ih = ch - 16;
      if (red) { g.save(); rr(g, cx, cy, cw, ih, 6); g.clip(); g.fillStyle = '#1c2333'; g.fillRect(cx, cy, cw, ih); g.globalAlpha = show; g.drawImage(face, cx + (cw - ih) / 2, cy, ih, ih); g.restore(); } else drawPic(g, 'armoured', cx, cy, cw, ih, show);
      g.font = `700 10.5px ${FONT}`; g.fillStyle = red ? '#ff8a8a' : '#9fe8b5'; g.textAlign = 'center'; g.fillText(red ? '⚠ a real person · taken without consent' : '✓ fictional character · no real person', W / 2, H - 10); g.textAlign = 'start';
    } else if (d.censor) {
      const msg = removed ? '✕ UNPLUGGED' : red && act && p > .15 ? 'disconnecting…' : mode === 'blue' && act && p < .45 ? 'checking…' : mode === 'blue' && (done || act) ? (n.id === 'safety' ? '✓ stunt removed' : n.id === 'consent' ? '✓ consent given' : '✓ stamped') : 'ready';
      g.font = `800 17px ${FONT}`; g.textAlign = 'center'; g.fillStyle = removed ? '#ff6b6b' : msg.startsWith('✓') ? '#7ff0b0' : '#e6e6e6'; g.fillText(msg, W / 2, cy + ch / 2 + 6); g.textAlign = 'start';
    } else if (n.id === 'sampler') {
      const a = done ? 1 : act ? ease(clamp(p / .85)) : 0;
      drawScene(g, cx, cy, cw, ch, Math.max(.04, a), red, false);
      if (red && a > .5) { g.fillStyle = 'rgba(0,0,0,.7)'; rr(g, cx + cw - 78, cy + 5, 73, 14, 3); g.fill(); g.fillStyle = '#fff'; g.font = `700 9px ${FONT}`; g.fillText('blurred · fake', cx + cw - 73, cy + 15); }
    } else if (n.id === 'out') {
      // Blue: the poster's own example of a disclosed release, The Frost [11], with the label and watermark stamped on.
      // Red: the fake clip (always a mosaic) dressed up as breaking news, with no label.
      const a = done ? 1 : act ? clamp((p - .3) / .4) : 0, ih = ch - 16;
      if (red) drawScene(g, cx, cy, cw, ih, Math.max(.04, a), true, a > .5); else { drawPic(g, 'frost', cx, cy, cw, ih, .25 + .75 * a);
        if (a > 0) { g.fillStyle = 'rgba(16,40,28,.85)'; rr(g, cx + 5, cy + 5, 96, 15, 3); g.fill(); g.fillStyle = '#9fe8b5'; g.font = `800 9.5px ${FONT}`; g.fillText('AI-GENERATED ✓', cx + 10, cy + 16); } }
      g.font = `700 10.5px ${FONT}`; g.fillStyle = red ? '#ff8a8a' : '#9fe8b5'; g.fillText(a <= 0 ? 'waiting' : red ? '⚠ no label · no watermark' : '✓ labelled · credited · watermarked', cx, H - 10);
    } else if (n.id === 'audio') {
      // Panel 04's picture: the edit in DaVinci Resolve [13]. Blue adds original music under it. Red lays a cloned voice and a fake news banner over it.
      const on = done || act, ih = ch - 16, u = ih / 100; drawPic(g, 'davinci', cx, cy, cw, ih, on ? 1 : .3);
      if (on) { g.save(); rr(g, cx, cy, cw, ih, 6); g.clip();
        if (red) { g.fillStyle = '#e01f2d'; g.fillRect(cx, cy + ih * .62, cw, ih * .22); g.fillStyle = '#fff'; g.font = `800 ${(14 * u).toFixed(1)}px ${FONT}`; g.fillText('BREAKING NEWS', cx + 6 * u, cy + ih * .78);
          g.fillStyle = '#e01f2d'; rr(g, cx + 4 * u, cy + 5 * u, 34 * u, 15 * u, 3 * u); g.fill(); g.fillStyle = '#fff'; g.font = `800 ${(10 * u).toFixed(1)}px ${FONT}`; g.fillText('● LIVE', cx + 7 * u, cy + 16 * u); }
        const y0 = cy + ih * .92, amp = ih * .07; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(cx, cy + ih * .84, cw, ih * .16); g.strokeStyle = red ? '#ff8a8a' : TYPE.AUDIO; g.lineWidth = 1.4; g.beginPath();
        for (let i = 0; i <= 120; i++) { const x = cx + 4 + i / 120 * (cw - 8), ph = i / 8 + now / 260, v = red ? Math.sin(ph) * .5 + Math.sin(ph * 3.7) * .35 + ((Math.sin(i * 12.9898 + now / 90) * 43758.5) % 1) * .4 : Math.sin(ph) * Math.sin(i / 20 + 1) * .9; i ? g.lineTo(x, y0 - v * amp) : g.moveTo(x, y0 - v * amp); } g.stroke(); g.restore(); }
      g.font = `700 10.5px ${FONT}`; g.fillStyle = red ? '#ff8a8a' : '#9fe8b5'; g.fillText(!on ? 'waiting' : red ? '⚠ cloned voice · fake news format' : '✓ original music · human edit', cx, H - 10);
    } else if (n.id === 'money') {
      // Panel 05's picture: a company's AI film [17]. Blue credits and discloses one film. Red tiles it into near-identical copies.
      const on = done || act, ih = ch - 16;
      if (red) { const k = done ? 100 : act ? Math.round(ease(p) * 100) : 1, cols = k > 40 ? 8 : k > 12 ? 5 : k > 3 ? 3 : k > 1 ? 2 : 1, rows = Math.max(1, Math.round(cols * ih / cw * 2.4)), tw = cw / cols, th = ih / rows;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (r * cols + c >= k) break; drawPic(g, 'toysrus', cx + c * tw + 1, cy + r * th + 1, tw - 2, th - 2, on ? 1 : .3); const t = TINTS[(r * cols + c) % TINTS.length]; if (t) { g.fillStyle = t; g.fillRect(cx + c * tw + 1, cy + r * th + 1, tw - 2, th - 2); } }
        g.fillStyle = 'rgba(0,0,0,.72)'; rr(g, cx + 5, cy + 5, 62, 24, 4); g.fill(); g.fillStyle = '#fff'; g.font = `800 17px ${FONT}`; g.fillText('× ' + k, cx + 10, cy + 23); }
      else drawPic(g, 'toysrus', cx, cy, cw, ih, on ? 1 : .3);
      g.font = `700 10.5px ${FONT}`; g.fillStyle = red ? '#ff8a8a' : '#9fe8b5'; g.fillText(!on ? 'waiting' : red ? '⚠ near-identical copies to farm views' : '✓ one film · credited · disclosed', cx, H - 10);
    }
    n.tex.needsUpdate = true;
  }
  // A ComfyUI note node in the red or green node colour: the one-line reason this step is harmful, or fine.
  function drawNote(n, mode) {
    if (n.key === mode || !n.g || !n.g.fillText) return; n.key = mode; const g = n.g, W = n.w, H = n.hh, red = mode === 'red', [body, title] = PAL[red ? 'red' : 'green'];
    g.setTransform(TEX, 0, 0, TEX, 0, 0); g.clearRect(0, 0, W, H); rr(g, 1, 1, W - 2, H - 2, 8); g.fillStyle = body; g.fill();
    g.save(); rr(g, 1, 1, W - 2, H - 2, 8); g.clip(); g.fillStyle = title; g.fillRect(0, 0, W, HEAD); g.restore();
    g.fillStyle = red ? '#ff6b6b' : '#7ff0b0'; g.beginPath(); g.arc(13, HEAD / 2, 4.5, 0, Math.PI * 2); g.fill();
    g.font = `700 12.5px ${FONT}`; g.fillStyle = red ? '#ffb3b3' : '#b8f5cf'; g.textAlign = 'start'; g.fillText(red ? '⚠ Why this is harmful' : '✓ Why this is fine', 25, HEAD / 2 + 4.4);
    rr(g, 7, HEAD + 6, W - 14, H - HEAD - 13, 6); g.fillStyle = '#1c1c1c'; g.fill();
    g.font = `600 14px ${FONT}`; wrapText(g, WHY[n.i][mode], 16, HEAD + 26, W - 32, 18, () => '#f2f2f2'); n.tex.needsUpdate = true;
  }
  function update(si, p, now) {
    if (!R || disposed) return;
    const mode = api.mode(), ended = si >= STEPS.length, idx = Math.min(si, STEPS.length - 1), T = R.T, P = R.P, col = new T.Color(COLOR[mode]);
    const fut2 = w => !ended && Math.max(DEF[w.a].step, DEF[w.b].step) > idx;
    const ps = updateCamera(R), dt = lastNow ? Math.min(100, now - lastNow) : 16; lastNow = now; canvas.style.opacity = ps ? '1' : '0'; if (!ps) return; frameView(R, ps, dt);
    R.frameLine.material.color.copy(col);
    const look = api.look ? api.look() : -1; R.panelLines.forEach((l, i) => { const on = i === look || (!ended && i === idx); l.visible = on; if (on) { l.material.color.copy(col); l.material.opacity = i === look ? (reduce ? .9 : .45 + .45 * Math.sin(now / 180)) : .5; } });
    // which links are live: a link into a fallen module is cut; its bypass appears once the module is gone
    const cutOf = l => [l.a, l.b].some(id => fallOf(id, mode, idx, p, ended) > .15), live = R.wires.filter(w => !cutOf(w)).concat(Object.entries(R.bypass).filter(([c]) => fallOf(c, mode, idx, p, ended) > .5).map(([, w]) => w));
    const conn = live.map(w => w.a + 'o' + w.ai + ',' + w.b + 'i' + w.bi).join(',');
    for (const n of Object.values(R.nodes)) {
      const d = n.d, fall = fallOf(n.id, mode, idx, p, ended), act = !ended && ACTIVE[idx].includes(n.id), fut = !ended && d.step > idx;
      drawNode(n, mode, idx, p, ended, now, fall, conn);
      // safety modules shake, unplug and fall onto the paper in Red mode
      const shake = mode === 'red' && d.censor && !ended && idx === d.step && p > .15 && p < .3 && !reduce ? Math.sin(now / 30) * .06 : 0;
      const ff = ease(fall), drop = fall * fall, side = n.id === 'consent' ? -1 : 1;
      n.grp.position.copy(P(d.x + ff * 90 * side, d.y + ff * 120, lerp(d.h, 9, drop)));
      n.grp.rotation.set(Math.sin(fall * Math.PI) * .9, Math.sin(fall * Math.PI) * .5 * side, shake + ff * .5 * side);
      const op = fut ? .35 : fall > .5 ? .55 : 1; n.front.opacity = op; n.side.opacity = op * .95;
      n.edgeMat.color.set(fall > .5 ? COLOR.red : act ? COLOR[mode] : '#6b6b6b'); n.edgeMat.opacity = act ? 1 : .7;
      const z = n.grp.position.z; n.sh.position.copy(P(d.x + ff * 90 * side + z * .1, d.y + ff * 120 + z * .14, .5)); n.shMat.opacity = fut ? .2 : .5 * clamp(1 - z / 900) + .15;
      n.stem.visible = fall === 0; n.stemMat.opacity = fut ? .15 : .35;
    }
    // the step's note appears once its action is under way, and stays for the steps already done
    for (const n of R.notes) { const a = ended || idx > n.i ? 1 : idx === n.i ? clamp((p - .22) / .18) : 0; n.grp.visible = a > 0; if (!a) continue;
      drawNote(n, mode); n.front.opacity = a; n.side.opacity = a * .95; n.edgeMat.color.set(COLOR[mode]); n.edgeMat.opacity = a; n.grp.scale.setScalar(reduce ? 1 : .9 + .1 * ease(a)); }
    // links: type-coloured as in ComfyUI; the step's links carry pulses; red bypass links replace fallen modules
    const flows = new Set(FLOW[idx]);
    for (const w of R.wires) { const cut = cutOf(w), on = flows.has(w.key) && !cut && !ended;
      w.mesh.visible = !cut; w.mat.color.copy(w.color); w.mat.opacity = on ? 1 : fut2(w) ? .35 : .75;
      w.dots.forEach((m, i) => { m.visible = on; if (on) { m.material.color.copy(col); m.position.copy(w.curve.getPointAt((now / 1300 + i / 3) % 1)); } }); }
    for (const [c, w] of Object.entries(R.bypass)) { const on = fallOf(c, mode, idx, p, ended) > .5; w.mesh.visible = on;
      w.dots.forEach((m, i) => { m.visible = on && (ended || idx >= DEF[c].step); if (m.visible) { m.material.color.set(COLOR.red); m.position.copy(w.curve.getPointAt((now / 1000 + i / 3) % 1)); } }); }
    // Red: copies stack up at step 05, then burst out and fly everywhere at step 06.
    const O = DEF.out, M = DEF.money, red = mode === 'red';
    if (ended && !endAt) endAt = now; if (!ended) endAt = 0;
    const burstT = red ? (ended ? 8.6 * .7 + (now - endAt) / 1000 : idx === 5 ? (p - .3) * 8.6 : -1) : -1, stackN = red && idx === 4 && !ended ? Math.floor(ease(p) * 14) : 0, spin = reduce ? 0 : 1;
    R.copies.forEach(c => {
      if (burstT > 0) { const k = 1 - Math.exp(-burstT / 1.6), th = c.th + spin * burstT * c.w * .35, r = 60 + c.rad * 1100 * k;
        c.m.visible = true; c.m.position.copy(P(O.x + Math.cos(th) * r, O.y - 200 * k + Math.sin(th) * r * .8, O.h * (1 - k * .3) + c.z * 650 * k + spin * Math.sin(burstT * 1.3 + c.j) * 30));
        c.m.rotation.set(c.spin[0] * burstT * spin, c.spin[1] * burstT * spin, c.spin[2] * burstT * spin * .5); c.m.scale.setScalar(Math.min(1, burstT * 2));
      } else if (c.j < stackN) { c.m.visible = true; c.m.position.copy(P(M.x - 20 + (c.j % 2) * 14, M.y - 165 - c.j * 6, M.h - 40 + c.j * 9)); c.m.rotation.set(0, 0, .08 * (c.j % 3 - 1)); c.m.scale.setScalar(.8); }
      else c.m.visible = false; });
    // Blue: one credited, watermarked film is released and glides down onto the paper.
    const fp = mode === 'blue' ? (ended ? 1 : idx === 5 ? ease(clamp((p - .55) / .4)) : 0) : 0, fm = R.film;
    fm.m.visible = fp > 0; if (fp > 0) { fm.m.position.copy(P(lerp(O.x, 300, fp), lerp(O.y + 40, 1690, fp), lerp(O.h - 60, 6, fp))); fm.m.rotation.set(0, 0, lerp(0, -.12, fp));
      if (fm.key !== String(frameReady)) { fm.key = String(frameReady); fm.g.fillStyle = '#10151c'; fm.g.fillRect(0, 0, 300, 190); drawScene(fm.g, 8, 8, 284, 140, 1, false, false); fm.g.fillStyle = '#9fe8b5'; fm.g.font = `700 15px ${FONT}`; fm.g.fillText('AI-generated · credited · watermarked', 12, 176); fm.tex.needsUpdate = true; } }
    R.renderer.render(R.scene, R.camera);
  }
  function dispose() {
    disposed = true; canvas.remove(); backdrop.remove(); if (video) video.style.transform = ''; if (savedBg && savedBg !== 'none' && api.stage.style.backgroundImage === 'none') api.stage.style.backgroundImage = savedBg; delete api.dialog.dataset.no3d;
    if (R) { R.disposables.forEach(o => { try { o.dispose(); } catch {} }); try { R.renderer.dispose(); R.renderer.forceContextLoss(); } catch {} R = null; }
  }
  // For checks: where a poster point at a height lands on screen.
  // (without the auto-framing zoom, so it can be compared with the tracker's own mapping)
  function project(x, y, h) { if (!R) return null; const v = R.P(x, y, h).applyMatrix4(R.root.matrixWorld).project(R.camera), b = canvas.getBoundingClientRect(), px = (v.x + 1) / 2 * b.width, py = (1 - v.y) / 2 * b.height; return { x: (px - zoom.tx) / zoom.s, y: (py - zoom.ty) / zoom.s }; }
  return { update, dispose, project, zoom: () => ({ ...zoom }), ready: () => !!R };
}
};
