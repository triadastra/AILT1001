# Editing the site

Run `npm run dev` and keep http://localhost:5173 open while editing. Vite refreshes the page when source files change.

## Citations front page

The front page, `dist/index.html`, is deliberately plain: a heading, one **Open the AR poster** button, then the numbered citations in printed order. There are no animations, images or scripts. Each entry is one `<li class="cite" id="ref-N">` with the citation, a "Used for" line and an **Open source** link.

Keep each entry's title, authors and link the same as `dist/references.json`; `npm test` checks this, and that the page has exactly one AR button and stays script-free. The button links to `poster.html?ar=1`, which opens the AR view straight away.

## Wording and activities

- `dist/poster.html` (formerly the homepage) contains the hero, navigation, controls, scene inputs and the AR overlay shell. It is linked from the top of the citations page.
- `dist/experience.js` contains the `models`, `posterWorkflow`, `steps` and `cases` objects/arrays. These drive the model cards, six-step workflow and ethics activities. Change the text strings, preserving their keys and array structure.
- `dist/ar-camera.js` also contains the AR detail-sheet text. When changing an explanation, check both normal browsing and the AR detail sheet.
- `dist/assets/group-captions.json` and `workflow-captions.json` are caption records. The website does **not** fetch these automatically. Editing only those JSON files will not change the visible activity wording. Keep them consistent with the corresponding visible text where applicable.

Preserve the group's own wording unless a change is intended. Keep technical claims and citations matched.

## References and images

The visible bibliography is `dist/references.html`; `dist/references.json` records its source metadata. Update both when adding or replacing a source, plus `REFERENCES-AND-IMAGE-CREDITS.md` for asset provenance. Citation links use `references.html#ref-N`, so keep each referenced `id="ref-N"` present. Do not renumber a source without updating every link and printed-poster citation that uses it.

To replace the demonstration clip, change `dist/assets/wan-example.mp4`, its `wan-frame.jpg` preview and its source credit. This published demo must not be described as a film made by the group. Keep any new video small enough for mobile loading. The site currently uses the same clip in the hero and AR overlay.

## Layout and AR

Edit `dist/experience.css` for visual changes; the AR camera view has its own glass styles in `dist/ar.css`. The AR **Play** walkthroughs live in `dist/ar-explain.js`. Pressing Play lifts a printed column into a full-screen diagram of the whole network and runs one example input through it (“A musician plays”, “Armoured figure in a forest”, “Armoured figure turns”, “Gentle guitar music”). Each network has `steps` (phase, title, caption text, duration) and a `build` function that draws the diagram in a 360 × 560 layout. Edit the `title`/`text` strings to change captions. The example numbers (token IDs, attention weights, probabilities, codes) are illustrative and labelled as such on screen; keep that label if you change them. Check narrow portrait and landscape screens, keyboard navigation, and the camera close button. Font declarations are in `dist/fonts.css`.

AR tracking primarily uses ~2000 natural feature points extracted from the final print PDF (`dist/assets/poster-features.bin`). If the printed artwork changes, run `node scripts/build-ar-features.mjs poster.pdf` and `npm run test:tracking`. The marker layout (fallback) corresponds to the existing printed A0 poster. `dist/planar-tracking.js` is the runtime geometry; `dist/assets/ar-tracking-layout.json` documents the layout. Moving the printed markers requires coordinated detector/geometry changes and fresh tracking tests. Changing only the JSON record does not alter the runtime tracker. Do not replace the marker pattern with decorative corner brackets.

Camera frames are processed on the device. Preserve that behaviour when adding features. HTTPS is needed for normal phone-camera use; localhost works for local testing. A phone opening your Mac's ordinary LAN HTTP address will not get the same camera permissions.

## Before publishing

1. Run `npm test` and `npm run build`.
2. Preview the build with `npm run preview` after stopping the dev server.
3. Check the reference links, clip playback, phone layout and AR Preview.
4. If tracking changed, run `npm run test:tracking` and test a real phone against the printed poster.
5. Commit and push; then use the deployment guide to publish.

There is no web-based admin editor. You can edit files with GitHub's pencil button, but then pull those changes on your Mac before testing and deploying.

## Blue / Red workflow mode (AR)

`dist/ar-cases.js` holds the **Blue · good use** and **Red · harmful use** mode. Pressing either button on the printed workflow blurs the camera and floats a 3D ComfyUI-style workflow above the poster, locked to it (the camera pose is recovered from the tracker; the paper is matched exactly to the tracked poster). Blue keeps the safety modules (consent check, safety filter, AI label + watermark) plugged in and releases one labelled film. Red types a harmful prompt, loads a face, lets those modules drop out onto the paper, and mass-produces copies that fly everywhere as blurred cards. The face is drawn in code (not a real person). Blue shows the poster's subway guitarist; Red shows a different, code-drawn fake "breaking news" stunt as a mosaic, and its copies are recoloured variants with different headlines (`HEADLINES`), so nothing explicit is drawn.

- Wording: the `STEPS` list (`blue`, `red`, shared `tip`) and the prompt strings `BLUE_PROMPT` / `RED_PROMPT`. Keep citation numbers matched to `references.html`.
- Nodes are drawn in ComfyUI's style (title bar, typed input/output sockets, widget rows; socket and link colours follow ComfyUI's defaults). `DEF` gives each node's poster position (`x`, `y`), height above the paper (`h`), size, sockets (`ins`, `outs`) and colour preset; `LINKS` connects output slots to input slots; `widgetsOf` lists each node's widget rows. If you move a node, update the copy of the positions in `tests/walkaround.test.cjs`.
- With a live camera the nodes stay at true scale, fixed in mid-air above the poster, so people can walk around them. Preview mode auto-frames the workflow instead.
- 3D uses three.js (`dist/vendor/three.module.min.js`, MIT, `three-LICENSE.txt`), loaded only when Blue or Red is pressed. Without WebGL the step captions still work.
- The Blue ⇄ Red switch on the caption card keeps the current step.
- Animation and labels (all in `update` in `dist/ar-cases.js`): nodes rise out of the paper in turn and hover; links draw themselves in and carry a pulse of energy; unplugged modules spark, drop and bounce while their links whip back; passed checks send out a green ring. Three floating labels carry the message: the callout over each step's node (`SAY`), the **Safeguards n/3** scoreboard, and the result card at the end ("1 honest film" / "100 fake copies"). Visitors who ask for reduced motion get the same content without the movement.
