# AILT1001 · Synthesising Hollywood

Interactive companion to the A0 poster by **Celsia, Sawini, Sophia, Vic and Loren — 52-PG02**.

**Website:** https://ailt1001.standardcas.org/  
**Cloud Run address:** https://hollywood-poster-952161411784.asia-east1.run.app/

Both addresses returned HTTPS 200 on 8 November 2026. Hosting is an independent Google Cloud Run service with Nginx; it does not depend on Cyclone VM.

## Run on your Mac

Install Node.js 22.12+ (Node 24 LTS recommended) and Git. Then:

```sh
git clone https://github.com/triadastra/AILT1001.git
cd AILT1001
npm ci
npm run dev
```

Open **http://localhost:5173**. Stop the server with Control-C. No API key, database or environment file is needed. The storyboard activity creates a prompt, not an AI-generated film.

## Edit the website

The editable source is **`dist/`**; despite its name, it is not generated. Do not edit `build/`, which is replaced when building.

| What you want to change | File |
| --- | --- |
| Homepage wording, sections and buttons | `dist/index.html` |
| Colours, spacing, typography, mobile layout | `dist/experience.css` |
| Model explanations, workflow captions, scenarios and quiz answers | `dist/experience.js` |
| Visible reference list and image credits | `dist/references.html` |
| Reference metadata / caption archives | `dist/references.json`, `dist/assets/*captions.json` |
| Images and demonstration clip | `dist/assets/` |
| Camera controls and overlay | `dist/ar-camera.js` |
| Marker detection and poster geometry | `dist/ar-worker.js`, `dist/planar-tracking.js` |

See **[Editing guide](docs/EDITING.md)** for the important distinctions between live text and reference data.

## Check, save and publish edits

```sh
npm test
npm run build
npm run preview
```

Stop the development server first: preview also uses port 5173. Then save the changes:

```sh
git add dist docs README.md
git commit -m "Update website content"
git push origin main
```

**Pushing to GitHub saves your work; it does not update the live website automatically.** To publish, follow **[Deployment guide](docs/DEPLOYMENT.md)** and run `npm run deploy` from your Mac after signing into Google Cloud.

## AR checks

Use **Enter poster AR → Preview** for a camera-free demonstration. For the phone camera, open the HTTPS website and allow camera access. Keep the printed poster's corner markers visible. At least three correctly identified corners are required to lock the overlay.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r tests/requirements.txt
npm run test:tracking
```

The tracking tests use generated views of the actual poster, including perspective, dim lighting and a marker-free negative control. They are not a guarantee of physical-camera performance. The last user phone test reported unreliable detection; regression fixes passed screenshot tests, but a new physical phone test is still needed. See [AR validation notes](AR-VALIDATION.md).

## Included material

This repository contains the website, source credits, AR code, local tests and deployment setup. The editable print poster and original project documents remain separate. Third-party media, fonts and detector code retain their own rights and licences; see [asset credits](REFERENCES-AND-IMAGE-CREDITS.md) and `dist/vendor/`.

Initial website snapshot: local companion commit `d21f609`. Missing local font assets were included here so a fresh checkout can render the declared fonts. No cloud credentials, account screenshots or obsolete Cyclone/www deployment routes are included.
