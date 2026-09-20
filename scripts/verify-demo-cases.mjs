import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cases } from '../src/data.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const outputDir = path.join(projectRoot, 'public', 'demo-cases');
const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
const failures = [];

function fail(message) {
  failures.push(message);
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function pngDimensions(bytes) {
  if (bytes.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

for (const sourceCase of cases) {
  const manifestCase = manifest.cases.find((item) => item.caseId === sourceCase.id);
  if (!manifestCase) {
    fail(`${sourceCase.id}: missing manifest entry`);
    continue;
  }

  const pngPath = path.join(outputDir, `${sourceCase.id}.png`);
  const png = await readFile(pngPath);
  const dimensions = pngDimensions(png);
  if (dimensions.width !== 1080 || dimensions.height !== 2340) {
    fail(`${sourceCase.id}: expected 1080x2340, got ${dimensions.width}x${dimensions.height}`);
  }
  if (hash(png) !== manifestCase.sha256) fail(`${sourceCase.id}: PNG hash mismatch`);

  if (manifestCase.sourceType !== sourceCase.sourceType) {
    fail(`${sourceCase.id}: source type differs from src/data.mjs`);
  }
  const rowsMatch = manifestCase.rows.length === sourceCase.items.length
    && sourceCase.items.every((row, index) => {
      const registered = manifestCase.rows[index];
      return registered?.speaker === row.speaker
        && registered?.text === row.text
        && registered?.kind === row.kind;
    });
  if (!rowsMatch) {
    fail(`${sourceCase.id}: manifest rows differ from src/data.mjs`);
  }

  const html = await readFile(path.join(outputDir, '.render', `${sourceCase.id}.html`), 'utf8');
  for (const row of sourceCase.items) {
    if (!html.includes(escapeHtml(row.speaker))) fail(`${sourceCase.id}: rendered HTML missing speaker ${row.speaker}`);
    if (!html.includes(escapeHtml(row.text))) fail(`${sourceCase.id}: rendered HTML missing exact text ${row.text}`);
  }
  if (!html.includes('虚构演示案例')) fail(`${sourceCase.id}: missing fictional demo label`);
  if (sourceCase.sourceType === 'wechat_chat' && html.includes('在线')) {
    fail(`${sourceCase.id}: contains disallowed online status`);
  }
}

const p3Asset = await readFile(path.join(outputDir, 'assets', 'moment-p3-dumplings.png'));
const p3Manifest = manifest.assets.momentsPhotos.find((item) => item.caseId === 'P3');
if (!p3Manifest?.independentlyReusable) fail('P3: independent reuse flag missing');
if (hash(p3Asset) !== p3Manifest?.sha256) fail('P3: independent asset hash mismatch');

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${cases.length}/${cases.length} cases`);
  console.log('PASS all screenshots are 1080x2340 PNGs with matching SHA-256');
  console.log('PASS manifest rows exactly match src/data.mjs');
  console.log('PASS rendered HTML contains exact speakers/text and fictional labels');
  console.log('PASS W1/W2/W3 contain no online status');
  console.log('PASS P3 independent asset is registered and hash-matched');
}
