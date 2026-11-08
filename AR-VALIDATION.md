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
3. Move back until the complete poster and its corner markers fit in view. Avoid glare and keep the paper flat.
4. Tap a highlighted model, workflow or impact hotspot.
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
