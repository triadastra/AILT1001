// Builds the AR natural-feature reference from the final print PDF.
//   node scripts/build-ar-features.mjs path/to/poster.pdf
// Needs `pdftoppm` (Poppler: `brew install poppler` on a Mac).
// Writes dist/assets/poster-features.bin (~2000 points) and refreshes the
// camera-free AR preview image dist/assets/poster-tracking-preview.jpg.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Features = require('../dist/ar-features.js');
const pdf = process.argv[2];
if (!pdf) { console.error('Usage: node scripts/build-ar-features.mjs poster.pdf'); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'poster-features-'));
try {
  execFileSync('pdftoppm', ['-gray', '-scale-to-y', '1920', '-scale-to-x', '-1', '-singlefile', pdf, join(dir, 'poster')]);
  const pgm = readFileSync(join(dir, 'poster.pgm'));
  // Parse binary PGM header: P5 <w> <h> <max>
  let pos = 0; const tokens = [];
  while (tokens.length < 4) {
    while (/\s/.test(String.fromCharCode(pgm[pos]))) pos++;
    if (pgm[pos] === 35) { while (pgm[pos] !== 10) pos++; continue; }
    let t = ''; while (!/\s/.test(String.fromCharCode(pgm[pos]))) t += String.fromCharCode(pgm[pos++]);
    tokens.push(t);
  }
  pos++;
  const [magic, w, h] = [tokens[0], Number(tokens[1]), Number(tokens[2])];
  if (magic !== 'P5') throw new Error('Unexpected PGM format ' + magic);
  const gray = new Uint8Array(pgm.buffer, pgm.byteOffset + pos, w * h);
  const started = Date.now();
  const ref = Features.buildReference(gray, w, h, 2000);
  writeFileSync('dist/assets/poster-features.bin', Buffer.from(Features.serialize(ref)));
  const perLevel = Features.LEVELS.map((l, i) => ref.level.filter(v => v === i).length);
  console.log(`Wrote ${ref.count} poster feature points (${perLevel.join(' / ')} per scale) in ${Date.now() - started} ms`);

  execFileSync('pdftoppm', ['-jpeg', '-jpegopt', 'quality=86', '-scale-to-x', '2000', '-scale-to-y', '-1', '-singlefile', pdf, join(dir, 'preview')]);
  writeFileSync('dist/assets/poster-tracking-preview.jpg', readFileSync(join(dir, 'preview.jpg')));
  console.log('Refreshed dist/assets/poster-tracking-preview.jpg from the print PDF');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
