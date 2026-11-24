# Poster AR companion

The live entry URL now opens the citations page; the interactive poster and AR moved to `/poster.html`, one tap away via **Interactive poster & AR**. The bibliography remains publicly accessible at `/references.html`, and `/#ref-N` also works on the front page. The old section-QR scanner is removed.

## Tracking contract

- Four printed ArUco targets use ARUCO_MIP_36h12 IDs 0, 7, 2, 3. The geometry is copied from the submission poster's `assets/ar-tracking-layout.json`.
- The camera stays on-device. No video or images are uploaded, recorded, or persisted.
- The detector accepts at most three incorrect marker bits (the library threshold is exclusive, set to 4). It fits a projective transform using the known marker corners; three or four markers are required.
- Four-marker detection is preferred. Tracked regions accelerate subsequent frames. Full-frame and enlarged-region detection reacquire the poster when necessary.
- The video and buttons use the fitted perspective transform. This is planar, marker-based AR rather than a free-standing world-tracked 3D model.
- If the marker geometry is rejected or too few markers are visible, the overlay is hidden. A stalled processing loop also hides old registration.
- Closing the view, hiding the page, or navigating away stops camera tracks. A permission result arriving after closure is immediately stopped.

## Verification

`tests/tracking.test.cjs` uses the actual poster artwork in front-facing, tilted, slanted and rotated synthetic-camera fixtures. All lock successfully. Tests also include reduced-resolution, blurred, JPEG-compressed and dimmed poster images. All six fixtures find four markers, with maximum corner error below 1.1 pixels at their fixture resolutions (800–1600 pixels wide). Tests also cover lost tracking, reacquisition, and the CSS perspective matrix.

`tests/interface.test.cjs` exercises the document controls in a DOM test environment: model and impact panels, camera-permission cancellation race, AR preview, hotspot opening, lost-marker hiding and stream cleanup. It is not a substitute for visual browser or phone-camera testing.

Run fixtures with `uv run --with pillow --with numpy python tests/make-fixtures.py`; then `node tests/tracking.test.cjs`. The interface test uses the repository’s npm jsdom dependency.

## Visitor flow

1. Scan the one main QR on the poster (opens the citations page).
2. Tap **Interactive poster & AR**, then choose **Enter poster AR**, then **Enable camera**.
3. Point the camera at the poster—the whole sheet or any clearly visible part of it. Avoid strong glare and keep the paper flat.
4. Tap a glass hotspot, or **▶ Play** on a model column for a step-by-step walkthrough.
5. **Preview** demonstrates the same detection and registration pipeline on the poster image, clearly labelled as a preview.

## Verification limits

No live phone camera has been tested yet. Performance, glare tolerance and marker visibility on printed A0 paper require a physical-device check. The camera requests a rear-facing stream, but available resolution is controlled by the phone and browser. Native fullscreen is requested where supported; otherwise the AR dialog fills the browser viewport.

## Browser review

The parent agent verified the local candidate in IAB: the preview recognised 4/4 markers, model/workflow/impact overlays aligned, and the impact hotspot opened its correct detail sheet. The image-only preview was then refreshed from submission poster commit5e10b7a. Live phone-camera testing remains outstanding.

The IAB screenshot supplied by the parent is saved at `qa/ar-preview-verified.jpg`. It records the preview-only four-marker registration check, not a live phone-camera test. The final NotebookLM caption and source26 were synced from the submission poster without rewording.

## GCP HTTPS verification — 7 November 2026

The original deployment (subsequently moved to the Cloud Run URL below) recognised all four markers in browser preview. Real camera access was verified on the Mac, but there was no poster in view; this does not verify physical registration. The phone experience now has a camera-switch control and actionable permission/busy-camera/HTTPS errors. Permission-denied recovery is covered by the interface test. The user will test a physical poster on their phone.

## Full-bleed camera revision — 7 November 2026

- Camera video uses cover; the perspective transform uses the identical crop/offset calculation. Static Preview intentionally contains the complete poster.
- Compact single-row controls, safe-area insets and viewport-fit=cover preserve more camera area. The browser may retain its own toolbar when native fullscreen is unavailable.
- Detection uses 80px warps (integer sampling for the 8x8 marker grid), bounded bit correction and geometry checks. Predicted corner crops refine initial acquisition and recover a missing fourth corner. Partial region results are merged rather than thrown away.
- Six synthetic fixtures pass; steady tracked-region processing measured about 48ms on this Mac. This timing is not a phone performance measurement.
- Tests reject fewer than three markers, excessive bit errors, invalid marker placement and blank frames. They check reacquisition and both cover/contain perspective mapping. DOM tests also check a landscape stream filling a portrait viewport.
- User supplied a phone screenshot with no poster in the camera view. Physical tracking performance remains unverified; do not infer that the synthetic tests prove print/glare tolerance.
- Current live service: https://hollywood-poster-952161411784.asia-east1.run.app/

## Real phone screenshot regression — 7 November 2026

The supplied phone screenshot showed all four codes but the app reported one. Replaying the screenshot with the prior detector found zero acceptable markers. The three unobscured marker decodes required 2–3 corrected bits, beyond the previous one-bit limit. The dictionary minimum Hamming distance is 12; the revised detector permits up to 3 errors and still requires at least three correctly positioned IDs with acceptable projective fit.

A low-contrast adaptive-threshold fallback also recovers a softened border after reducing the camera crop to 1080×1920. The full screenshot and camera-only resized crop now lock with IDs 0, 3, 2. The top-right code is covered by a finder graphic in the screenshot; this graphic is not part of the raw camera stream. Neither result proves real-time tracking on the phone.

The six synthetic fixtures still pass. A dense poster with all four marker codes removed does not lock. Blank frames, fewer than three codes, invalid marker geometry and errors above three bits are rejected. Optional real-image regression inputs remain under /tmp, outside the repository and deployment; the user's room/screenshot is not published.

Nginx now sends Cache-Control: no-cache so clients revalidate updated resources.

## Natural-feature tracking and glass interface — 8 November 2026

- **Primary tracker:** 2000 natural feature points extracted from the final print PDF (`Synthesising-Hollywood-52-PG02-A0.pdf`) at six scales (poster heights 960→228 px). Each point has a FAST-9 corner and an oriented 256-bit binary descriptor (`dist/ar-features.js`). Camera frames are matched with a ratio test, then a RANSAC homography is fitted and refined on inliers. At least 20 inliers and a plausible convex poster shape are required.
- **Tracking loop:** once locked, the previous pose guides matching to nearby points only, and the processing resolution adapts so the poster appears at a reference scale (close-ups are shrunk, distant posters keep resolution). The four ArUco markers are now a fallback; a marker lock seeds feature tracking.
- **Synthetic results:** these use generated views of the print artwork, so they are not physical-camera proof. Of the 10 views, every one locks on features, with 28–177 inliers on first acquisition and 74–323 on the next frame. Maximum on-screen error is 0.8–7.8 px at 1200–2000 px frame size (≤0.4%). The views include a close-up with **no corner markers visible**, a steep side angle, 30° rotation in dim/noisy light, and a small distant poster. The marker-free poster now locks by design. An unrelated film still and a noise texture never lock.
- **Browser check:** Chromium with a fake camera video of the moving/tilting poster locked in ~0.26 s and stayed locked on all 52 status updates over 5 s (~10 updates/s). Direct Node timing on this machine: about 55–150 ms acquisition and 40–80 ms tracked frames at ≤800 px processing. A phone may be slower; this is not a phone measurement.
- **Interface:** the camera view is a clear glass layout. A single minimised bar holds a status chip (state dot + point count), Start, Flip, ⋯ (Preview / Explore without camera) and Close. Hints fade after a few seconds; tapping the status chip shows them again. Poster hotspots are frosted-glass buttons registered in perspective. One missed frame keeps the last pose to avoid flicker; two hide it. Poses are smoothed adaptively. Matched points flash briefly when the poster first locks.
- **Still outstanding:** a live test on a phone with the printed A0 poster.

## Model-path “Play” walkthroughs — 8 November 2026

- Each printed model column (Text, Image, Video, Audio) has a glass **▶ Play** button. Playing dims everything except that column. The dimming is a screen-space mask whose hole is the column projected through the live pose, so it follows the poster in perspective.
- Animations are drawn in poster units on the registered plane. They show highlights, moving pulses along the printed arrows, noise that dissolves into the printed image/frames, softmax bars, attention arcs, code streams and a waveform. Each step is labelled **Preprocess → Propagate → Result**, with a caption card (previous / pause / next / stop). In landscape the card becomes a side panel.
- Coordinates were measured on the print PDF rendered at 1682 × 2378. Zoomed browser screenshots confirmed highlights land on the printed boxes in Preview, and the spotlight followed the tilted poster with the fake moving camera.
- The Audio result plays a short, quiet plucked-guitar sound synthesised on the device. The caption labels it illustrative, not model output. Playback pauses while the poster is not tracked.

## Full-screen network walkthroughs — 8 November 2026

- **▶ Play** now lifts the printed column into a full-screen glass view. The view animates out of the column's tracked screen position and shrinks back into it on close. The whole network is always visible; the active part is lit and finished parts stay readable.
- Each network runs one concrete example, labelled on screen as *example input · values simplified for illustration*:
  - **Text:** “A musician plays” → tokens and example IDs → 6-number embeddings + position → masked attention table (plays → musician .71) → layer counter 1–12 → softmax (guitar 41%) → appended output.
  - **Image:** “Armoured figure in a forest” → noise that dissolves over 30 sampler steps into the Wan example frame → VAE decode to the full picture.
  - **Video:** 4 noisy frames × 12 patches = 48 tokens → one patch attending in space and time → frames decoded from the real Wan clip.
  - **Audio:** 4 codebook streams with a delay pattern → waveform drawn from the exact sound that plays (synthesised on the device, labelled illustrative).
- Browser check: portrait and landscape screenshots at every step, the open and close transition with the fake moving camera, and no page errors.

## Blue / Red 3D workflow: walk-around check — 10 November 2026

- ComfyUI-style nodes float above the printed workflow at 200–360 poster units (about 10–18 cm on the A0 print). The camera pose is recovered from the tracker's homography with a lens estimate (median of oblique views, then locked) and a residual correction that keeps the paper exactly on the tracked poster. With a live camera there is no digital zoom, so the nodes stay fixed in the room.
- `npm run test:walkaround` renders the poster from eight known camera positions (front, 35° left, 35° right and above, steep above, below right, close-up, phone tilted 18°, and a wider lens), locks the tracker on each, and compares every node's drawn position with where it physically appears from that camera. Result in a 1080 × 1920 image: paper ≤ 1.9 px; floating nodes ≤ 1.7 px with the default lens guess, 18 px (0.95 %) with the different lens.
- These are synthetic views. A live walk-around with the printed poster on a phone is still outstanding, as is behaviour when the poster leaves the frame (the nodes hide until the tracker reacquires it).

## One page, aim-to-focus and frame-rate tracking: 24 November 2026

- **One page.** The citations page is the whole site. A single **Start AR** button opens the camera view and requests the camera in the same tap. `/poster.html` redirects to `/#ar`. The earlier activity page was removed.
- **Aim to focus.** The section under the middle of the camera view (four model columns, the workflow, the pros and cons) becomes the focus after about 0.4 s. The camera image and everything registered to it are enlarged together (up to 3×) so the section fills the space above the controls, the rest is dimmed, and one large button starts that section's walkthrough. The aim point is measured before the zoom, so zooming cannot change the focus. Blue/Red still runs at true scale with no zoom.
- **Captions.** Walkthrough captions are collapsed to a title and controls; **(?)** shows the written explanation.
- **Tracking speed.** Before, every pose came from the feature detector, which read a 1920 px frame on the main thread each time. Now a second worker follows a grid of points from one 360 px frame to the next (pyramidal Lucas-Kanade, then a RANSAC homography) on every camera frame. The detector runs on a frame captured at its processing size, twice a second while locked, and its result is carried forward through the follower's frames so its delay does not show. The corner-marker fallback runs on every fourth miss rather than every miss.
- **Measured here, not on a phone:** Chromium with a fake 720 × 1280, 30 fps camera clip of a hand-held walk-up (`tests/make-sequence.py`): about 29 pose updates per second (about 10 before), first lock about 0.6 s after pressing Start. In Node the follower takes about 4.5 ms per frame and drifts at most 0.47 % of the frame over 20 frames between corrections (`tests/flow.test.cjs`); it refuses noise, a covered lens and a jump to a different view.
- **iPhone limits.** Safari on iPhone has no fullscreen API for pages and a page cannot rotate the phone. The view fills the visible browser area; landscape hides Safari's toolbars. A hint asks for landscape on the wide sections. The screen is kept awake while the camera runs where the browser allows it.
- **Still outstanding:** a live test on a phone with the printed A0 poster. Frame rate, heat, the 3× digital zoom's sharpness and the follower's behaviour under real motion blur are unmeasured on a device.

## Blue / Red follows the printed panels: 24 November 2026

- The six Blue/Red steps were already the six printed panels (01 Write the story to 06 Distribute online). With a live camera the step is now chosen by the panel under the middle of the view, after about 0.4 s: looking at panel N shows step N of the good or the harmful demo. A step no longer runs on into the next one; it waits, and the card says which panel to look at next. That panel's outline pulses on the paper. Switching Blue/Red keeps the panel. The arrow buttons still work, and a button press is not undone while the view stays on the same panel. Preview has no aim, so it plays through automatically as before.
- The floating nodes were moved so each step's nodes sit over its own panel (prompt over 01, image and consent check over 02, safety filter and sampler over 03, audio over 04, credits or batch over 05, watermark and output over 06). Links that run back to the left along the bottom row arc over the nodes between them.
- In this mode the status bar is hidden and the card is shortened, so the nodes are not covered.
- **Checked here:** Chromium with a fake camera clip that looks at panels 01 to 06 in turn: the step followed every panel in both modes, with no page errors. `tests/interface.test.cjs` covers the aim point, the jump to the looked-at panel, the hint text and the buttons. `npm run test:walkaround` still passes with the new node positions.
- **Not checked:** a phone and the printed poster. How comfortable it is to hold the aim on one panel for a whole step is unknown.
