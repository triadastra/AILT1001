'use strict';
/* Blue / Red mode: the same six-step workflow, run twice.
 * Blue = good use, Red = harmful use. Same tools, same scene, same steps; only the choices differ.
 * Drawn as two parallel 3D tracks (hand-rolled perspective projection into the 360 x 560 SVG used by ar-explain.js).
 * Hypothetical example built from the group's proposal; citations use the numbers in references.html. */
window.PosterCases = ({ el, clamp, ease, lerp }) => {
const COLOR = { blue: '#6cb6ff', red: '#ff6b6b' };
const STEPS = [
  { n: '01', title: 'Write the story', tool: 'Text model',
    blue: { tag: 'Own script', short: 'The team drafts with the text model, then a person rewrites and reviews every line.', text: 'Blue: the text model suggests ideas for “a musician plays guitar in an MTR station”. The team rewrites them and reviews every line before anything is generated. [1]' },
    red: { tag: 'Fake “news”', short: 'Same model, but the prompt asks for a shocking “breaking news” script that should look real.', text: 'Red: same tool, same scene, but the prompt becomes “write it as breaking news so people think it really happened”. Nobody reviews it, because the goal is clicks, not a story. [21]' },
    tip: 'Same tool. The goal changed: telling a story vs. passing fiction off as real.' },
  { n: '02', title: 'Create visual assets', tool: 'Image model',
    blue: { tag: 'Original cast', short: 'An original musician (or an actor who agreed), with the team’s own reference images for a consistent look.', text: 'Blue: the image model draws an original musician, or uses an actor who agreed to it. Reference images the team owns help keep the look consistent, though results still need checking. [1,3]' },
    red: { tag: 'Stolen selfie', short: 'A classmate’s Instagram selfie goes in without asking, so the musician has a real person’s face.', text: 'Red: someone feeds in a classmate’s Instagram selfie without asking. Now the “musician” is a digital replica of a real person who never agreed. [20]' },
    tip: 'Whose face is it? Using a real person’s likeness needs their consent.' },
  { n: '03', title: 'Generate the video', tool: 'Video model',
    blue: { tag: 'World building', short: 'A subway set the team could never afford to build. Bad takes are simply regenerated, not reshot.', text: 'Blue: the video model builds a subway scene the team could never afford to film. A bad take is regenerated instead of recalling a crew for a reshoot. [1]' },
    red: { tag: 'Fake stunt', short: 'The “real” classmate leaps between moving trains, which no human could do. Children may copy it.', text: 'Red: the same model makes the classmate leap between moving trains. It looks real, but no person could do it, and our proposal worries that children may try to copy stunts like this.' },
    tip: 'Fiction is fine. Realistic danger that features a real person is not.' },
  { n: '04', title: 'Add sound & edit', tool: 'Audio model + editor',
    blue: { tag: 'Original music', short: 'Generated guitar music; a human editor lines up picture, sound and captions.', text: 'Blue: an audio model generates gentle guitar music, and a human editor lines up the picture, sound and captions in DaVinci Resolve. [4,13]' },
    red: { tag: 'Cloned voice', short: 'The classmate’s voice is cloned, and an AI news-anchor persona reads the clip out as fact.', text: 'Red: the classmate’s voice is cloned, and an AI “news anchor”, like the AI news shorts on WeChat Channels, presents the clip as something that really happened. [20,21]' },
    tip: 'Cloning a real voice and copying a news format turns an edit into deception.' },
  { n: '05', title: 'Plan monetisation', tool: 'Platform rules',
    blue: { tag: 'Disclose + credit', short: 'Marked as AI-altered, team and tools credited, platform rules followed.', text: 'Blue: the upload is marked as altered or synthetic, the team and tools are credited, and monetisation follows the platform’s rules. [10,16]' },
    red: { tag: 'Mass-produce', short: 'The template is copied 100 times with small changes to farm views: repetitive AI junk.', text: 'Red: the same template is copied a hundred times with tiny changes to farm views. YouTube may refuse to monetise repetitive content like this, and the copies all look alike. [10,5]' },
    tip: 'One honest film vs. a content farm of near-identical clips.' },
  { n: '06', title: 'Distribute online', tool: 'Release',
    blue: { tag: 'Watermarked', short: 'Released with credits, an AI label and an invisible watermark. It could even be used to teach a class.', text: 'Blue: the film is released with credits, an AI label and an invisible watermark, like The Frost’s disclosures. Viewers know it is fiction, and it could even be used to teach a class. [11,26]' },
    red: { tag: 'Unlabelled', short: 'No label, no watermark. It spreads through short-video feeds; viewers can’t tell what’s real.', text: 'Red: there is no label and no watermark. The clip spreads through short-video feeds, harms the classmate’s reputation, and leaves viewers unsure what is real. [19,21]' },
    tip: 'Labels and watermarks let people and platforms tell real from fake.' }
];

// ---------- 3D: two parallel tracks of six stations ----------
const SP = 1.5, X0 = -3.75, Z = { blue: -1.05, red: 1.05 }, F = 360, D = 6.2, PITCH = 0.72, CX = 180, CY = 205;
const stationX = i => X0 + i * SP;
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function wrap(s, max) { const out = []; let line = ''; for (const w of s.split(' ')) { if (line && (line + ' ' + w).length > max) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } if (line) out.push(line); return out; }
function lines(textEl, rows, x, lh) { textEl.textContent = ''; rows.forEach((r, i) => { const t = el('tspan', { x, dy: i ? lh : 0 }, textEl); t.textContent = r; }); }

const T = (x, y, s, o = {}) => { const t = el('text', { x, y, 'text-anchor': o.anchor || 'middle', 'font-size': o.size || 12, 'font-weight': o.weight || 500, fill: o.fill || '#fff' }, o.parent); t.textContent = s; return t; };
const steps = STEPS.map(s => ({ title: `${s.n} · ${s.title}`, blue: s.blue.text, red: s.red.text, dur: 8200, show: ['cs'] }));
return { cases: {
  name: 'Same workflow, two outcomes', input: 'A musician plays guitar in an MTR station', accent: COLOR.blue, modes: COLOR,
  note: 'Hypothetical example built from our proposal · not a real case',
  link: { href: 'references.html', label: 'Check the sources ↗' },
  steps,
  build(k, api) {
    // one world section, drawn in a 360 x 560 layout scaled up to the 640-wide world used by ar-explain.js
    const sec = k.sec('cs'); sec.box.splice(0, 4, 0, 0, 640, 560 * 640 / 360);
    const root = el('g', { transform: `scale(${640 / 360})` }, sec.g), floor = el('g', {}, root), items = el('g', {}, root), flat = el('g', {}, root);
    let cam = { x: stationX(0), z: Z.blue, yaw: -0.42 }, lastNow = 0, swap = api.mode() === 'red' ? 1 : 0;
    // the chosen mode's track glides to the front; the other passes behind it
    const zOf = m => (m === 'blue' ? Z.blue : Z.red) * (1 - 2 * ease(swap));
    const P = (x, y, z) => { const rx = x - cam.x, rz = z - cam.z, c = Math.cos(cam.yaw), s = Math.sin(cam.yaw), x1 = rx * c - rz * s, z1 = rx * s + rz * c, cp = Math.cos(PITCH), sp = Math.sin(PITCH), y2 = y * cp + z1 * sp, d = Math.max(.4, -y * sp + z1 * cp + D); return { x: CX + F * x1 / d, y: CY - F * y2 / d, d }; };
    const pts = arr => arr.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const depthItems = [];
    const item = (cls) => { const g = el('g', { class: cls }, items); const it = { g, d: 0, id: depthItems.length }; depthItems.push(it); return it; };

    // floor: two film-strip ribbons with sprocket holes, plus a rung at each step joining the twin stations
    const tracks = {};
    for (const m of ['blue', 'red']) {
      const g = el('g', { class: 'cs-track' }, floor), ribbon = el('polygon', { class: 'cs-ribbon', fill: COLOR[m] }, g), holes = [];
      for (let j = 0; j < 30; j++) holes.push([el('polygon', { class: 'cs-hole' }, g), el('polygon', { class: 'cs-hole' }, g)]);
      const label = T(0, 0, m === 'blue' ? 'BLUE · good use' : 'RED · harmful use', { size: 10, weight: 800, fill: COLOR[m], parent: g });
      tracks[m] = { g, ribbon, holes, label };
    }
    const rungs = STEPS.map(() => el('polyline', { class: 'cs-rung' }, floor));

    // stations (upright panels) and the badge above each
    const stations = {};
    for (const m of ['blue', 'red']) stations[m] = STEPS.map((s, i) => {
      const it = item('cs-st'); it.m = m; it.i = i;
      it.face = el('polygon', { class: 'cs-face', stroke: COLOR[m] }, it.g);
      it.num = T(0, 0, s.n, { weight: 800, fill: COLOR[m], parent: it.g });
      it.tag = T(0, 0, s[m].tag, { weight: 700, parent: it.g });
      it.badge = el('g', {}, it.g); it.bc = el('circle', { r: 7, fill: COLOR[m] }, it.badge); it.bt = T(0, 0, m === 'blue' ? '✓' : '!', { size: 10, weight: 900, fill: '#0b0f14', parent: it.badge });
      return it;
    });

    // the clip moving through the workflow: a small cube
    const cube = item('cs-cube'), cubeFaces = Array.from({ length: 6 }, () => el('polygon', {}, cube.g));
    const CUBE_F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]], SHADE = [.95, .55, .8, .6, .7, .65];
    // red: copies of the clip (mass production); blue: watermark ring
    const copies = Array.from({ length: 10 }, (_, j) => { const it = item('cs-copy'); it.poly = el('polygon', { fill: COLOR.red }, it.g); it.j = j; return it; });
    const ring = item('cs-ring'); const ringPath = el('polygon', { class: 'cs-ringp', stroke: COLOR.blue }, ring.g); const ringTxt = T(0, 0, 'AI label · watermark', { size: 10, weight: 700, fill: COLOR.blue, parent: ring.g });

    // flat comparison panel (screen space, under the 3D view)
    const head = T(180, 366, '', { size: 13, weight: 800, parent: flat });
    const box = m => { const x = m === 'blue' ? 8 : 184, g = el('g', { class: 'cs-box' }, flat); el('rect', { x, y: 376, width: 168, height: 112, rx: 10, class: 'cs-boxr', stroke: COLOR[m] }, g);
      T(x + 10, 393, m === 'blue' ? 'BLUE · GOOD USE' : 'RED · HARMFUL USE', { anchor: 'start', size: 9.5, weight: 800, fill: COLOR[m], parent: g });
      const t = T(x + 10, 410, '', { anchor: 'start', size: 10.6, weight: 500, parent: g }); return { g, t, x }; };
    const boxes = { blue: box('blue'), red: box('red') };
    const tipG = el('g', { class: 'cs-tip' }, flat); el('rect', { x: 8, y: 496, width: 344, height: 58, rx: 10, class: 'cs-tipr' }, tipG);
    const tipLab = T(18, 512, '⇄ WHAT CHANGED', { anchor: 'start', size: 9.5, weight: 800, parent: tipG }), tipTxt = T(18, 528, '', { anchor: 'start', size: 11, weight: 600, parent: tipG });
    let shownKey = '', order = '';

    return { update(si, p, now) {
      const mode = api.mode(), idx = Math.min(si, STEPS.length - 1), ended = si >= STEPS.length;
      const dt = lastNow ? Math.min(80, now - lastNow) : 1000; lastNow = now; const a = 1 - Math.exp(-dt / 320);
      // camera follows the clip along the active track
      const goalX = stationX(idx) + .35, goalZ = Z.blue * .25, goalYaw = (mode === 'blue' ? -0.42 : -0.5) + (reduce ? 0 : Math.sin(now / 3200) * .05);
      cam = { x: lerp(cam.x, goalX, a), z: lerp(cam.z, goalZ, a), yaw: lerp(cam.yaw, goalYaw, a) };
      swap = reduce ? (mode === 'red' ? 1 : 0) : clamp(swap + (mode === 'red' ? 1 : -1) * dt / 700);

      for (const m of ['blue', 'red']) {
        const z = zOf(m), T = tracks[m], on = m === mode;
        T.g.setAttribute('opacity', on ? 1 : .38);
        T.ribbon.setAttribute('points', pts([P(X0 - .9, 0, z - .34), P(X0 + 5 * SP + .9, 0, z - .34), P(X0 + 5 * SP + .9, 0, z + .34), P(X0 - .9, 0, z + .34)]));
        T.holes.forEach(([h1, h2], j) => { const x = X0 - .8 + j * .3, sq = (zz) => pts([P(x, .001, zz - .04), P(x + .12, .001, zz - .04), P(x + .12, .001, zz + .04), P(x, .001, zz + .04)]); h1.setAttribute('points', sq(z - .26)); h2.setAttribute('points', sq(z + .26)); });
        const lp = P(X0 - .9, 0, z - .62); T.label.setAttribute('x', lp.x.toFixed(1)); T.label.setAttribute('y', lp.y.toFixed(1)); T.label.setAttribute('text-anchor', 'start');
        stations[m].forEach(st => {
          const x = stationX(st.i), q = [P(x - .55, .06, z), P(x + .55, .06, z), P(x + .55, .98, z), P(x - .55, .98, z)], c = P(x, .52, z), act = st.i === idx && !ended;
          st.d = c.d; st.face.setAttribute('points', pts(q));
          st.g.setAttribute('class', 'cs-st' + (on ? ' on' : '') + (act ? ' act' : '') + (st.i < idx || ended ? ' done' : ''));
          const s = F / c.d; st.num.setAttribute('x', c.x.toFixed(1)); st.num.setAttribute('y', (c.y - s * .14).toFixed(1)); st.num.setAttribute('font-size', (s * .2).toFixed(1));
          st.tag.setAttribute('x', c.x.toFixed(1)); st.tag.setAttribute('y', (c.y + s * .12).toFixed(1)); st.tag.setAttribute('font-size', (s * .135).toFixed(1));
          const bp = P(x, 1.18, z), show = st.i < idx || ended || (st.i === idx && p > .55);
          st.badge.setAttribute('opacity', show ? 1 : 0); st.bc.setAttribute('cx', bp.x.toFixed(1)); st.bc.setAttribute('cy', bp.y.toFixed(1)); st.bc.setAttribute('r', (s * .085).toFixed(1));
          st.bt.setAttribute('x', bp.x.toFixed(1)); st.bt.setAttribute('y', (bp.y + s * .04).toFixed(1)); st.bt.setAttribute('font-size', (s * .11).toFixed(1));
        });
      }
      rungs.forEach((r, i) => { const x = stationX(i); const zb = zOf('blue'), zr = zOf('red'), sg = Math.sign(zr - zb) || 1; r.setAttribute('points', pts([P(x, .002, zb + .34 * sg), P(x, .002, zr - .34 * sg)])); r.setAttribute('class', 'cs-rung' + (i === idx && !ended ? ' act' : '')); });

      // clip cube: travels from the previous station, then hovers and spins
      const travel = ended ? 1 : ease(clamp(p / .35)), from = si === 0 ? stationX(0) - 1.2 : stationX(Math.max(0, idx - 1)), cxw = ended ? stationX(5) : lerp(from, stationX(idx), travel), cz = zOf(mode);
      const cy = 1.45 + (reduce ? 0 : Math.sin(now / 420) * .05), r = .2, spin = reduce ? .6 : now / 900;
      const V = [-1, 1].flatMap(y => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const cs = Math.cos(spin), sn = Math.sin(spin); return P(cxw + (u * cs - v * sn) * r, cy + y * r, cz + (u * sn + v * cs) * r); }));
      const faceOrder = CUBE_F.map((f, j) => ({ f, j, d: f.reduce((s, v) => s + V[v].d, 0) / 4 })).sort((x, y) => y.d - x.d);
      faceOrder.forEach(({ f, j }, n) => { const poly = cubeFaces[n]; poly.setAttribute('points', pts(f.map(v => V[v]))); poly.setAttribute('fill', COLOR[mode]); poly.setAttribute('fill-opacity', SHADE[j]); poly.setAttribute('stroke', '#fff'); poly.setAttribute('stroke-opacity', .5); });
      cube.d = P(cxw, cy, cz).d - .01;

      // red, step 5 onwards: the clip is copied over and over; at step 6 the copies scatter into the feed
      const copyOn = mode === 'red' && (idx >= 4 || ended), spread = idx === 4 && !ended ? ease(clamp((p - .25) / .6)) : copyOn ? 1 : 0, fly = idx === 5 || ended ? (ended ? 1 : ease(clamp(p / .8))) : 0;
      copies.forEach(c => { if (!copyOn || spread <= 0) { c.g.setAttribute('opacity', 0); c.d = 99; return; }
        const ang = c.j / copies.length * Math.PI * 2 + (reduce ? 0 : now / 2600), rad = .45 + spread * .55 + fly * 1.2, x = cxw + Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad * .7, y = cy - .2 + Math.sin(c.j * 1.7) * .25 + fly * (.4 + (c.j % 3) * .3), q = .11;
        c.g.setAttribute('opacity', (spread * (1 - fly * .5)).toFixed(2)); c.poly.setAttribute('points', pts([P(x - q, y - q, z), P(x + q, y - q, z), P(x + q, y + q, z), P(x - q, y + q, z)])); c.d = P(x, y, z).d; });
      // blue, step 6: a watermark ring locks around the clip
      const ringOn = mode === 'blue' && (idx === 5 || ended), rp = ended ? 1 : idx === 5 ? ease(clamp((p - .2) / .5)) : 0;
      if (ringOn && rp > 0) { const R = .3 + .2 * rp, rpts = Array.from({ length: 28 }, (_, j) => { const t = j / 28 * Math.PI * 2 * rp; return P(cxw + Math.cos(t) * R, cy, cz + Math.sin(t) * R); }); ringPath.setAttribute('points', pts(rpts)); const tp = P(cxw, cy + .48, cz); ringTxt.setAttribute('x', tp.x.toFixed(1)); ringTxt.setAttribute('y', tp.y.toFixed(1)); ring.g.setAttribute('opacity', 1); ring.d = cube.d - .02; } else { ring.g.setAttribute('opacity', 0); ring.d = 99; }

      // painter's order: far first (only touch the DOM when the order changes)
      depthItems.sort((x, y) => y.d - x.d); const key = depthItems.map(it => it.id).join();
      if (key !== order) { order = key; depthItems.forEach(it => items.appendChild(it.g)); }

      // comparison panel
      const k2 = idx + mode + ended;
      if (k2 !== shownKey) { shownKey = k2; const s = STEPS[idx];
        head.textContent = ended ? 'Same tools. Different choices. Different film.' : `${s.n} · ${s.title} · ${s.tool}`;
        for (const m of ['blue', 'red']) { lines(boxes[m].t, wrap(ended ? (m === 'blue' ? 'A credited, labelled, watermarked short film people can trust.' : 'A fake, unlabelled clip of a real person, copied into every feed.') : s[m].short, 29), boxes[m].x + 10, 14); boxes[m].g.setAttribute('class', 'cs-box' + (m === mode ? ' on' : '')); }
        tipLab.setAttribute('fill', COLOR[mode]); lines(tipTxt, wrap(ended ? 'Every step had the same tool in both tracks. Switch Blue ⇄ Red on any step to compare.' : s.tip, 58), 18, 14);
      }
    } };
  }
} };
};
