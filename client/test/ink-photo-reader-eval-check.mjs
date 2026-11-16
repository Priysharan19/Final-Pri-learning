// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the photo-reader evaluation tool measures honestly or not at all
//
// tools/ink-photo-reader-eval.mjs measures how well the server reader reads
// real photos of working, with NO floor (the owner decides whether it blocks).
// This holds the tool itself, with a FAKE provider and no Chromium:
//   · no set, or no key → NOT MEASURED, nothing written;
//   · a set inside the repository, a measurement without the app's photo
//     preparation, or a dry run writing under handwriting/ → refused;
//   · a malformed manifest → refused, each problem named;
//   · the scorer: per-line exact and character accuracy, unreadable pages,
//     the app's own final-answer proposal against the page's answer.
// Synthetic evidence only.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodePng } from '../../tools/ink-cloud-reader-eval.mjs';
import { ROOT, main, manifestProblems, scorePage, summarise } from '../../tools/ink-photo-reader-eval.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const quiet = () => { const lines = []; return { log: l => lines.push(String(l)), lines }; };

const scratch = mkdtempSync(join(tmpdir(), 'pri-photo-eval-check-'));
try {
  const set = join(scratch, 'set');
  mkdirSync(set);
  const png = encodePng(4, 4, new Uint8Array(4 * 4 * 3).fill(255));
  const PHOTOS = [
    { file: 'p1.png', writer: 'W01', lines: ['2x + 3 = 11', 'x = 4'], answer: '4' },
    { file: 'p2.png', writer: 'W01', lines: ['5 x 7 = 35'], answer: '35' },
    { file: 'p3.png', writer: 'W02', lines: ['y = 12 - 5', 'y = 7'], answer: '7' },
    { file: 'p4.png', writer: 'W02', lines: ['3/4 + 1/4 = 1'] }
  ];
  for (const p of PHOTOS) writeFileSync(join(set, p.file), png);
  const manifest = { format: 'pri-photo-eval-set', version: 1, consent: 'two adult writers, written consent held by the owner, 2026-11-09', photos: PHOTOS };
  writeFileSync(join(set, 'manifest.json'), JSON.stringify(manifest));

  // ── the manifest ───────────────────────────────────────────────────────────
  eq(manifestProblems(manifest, { exists: () => true }), [], 'a complete manifest has no problems');
  const broken = manifestProblems({ format: 'x', photos: [{ file: '../p1.png', writer: 'Asha Rao', lines: [] }, { file: 'notes.txt', writer: 'W1', lines: ['x'] }] }, { exists: () => false });
  ok(broken.some(p => /format must be/.test(p)) && broken.some(p => /consent/.test(p)) && broken.some(p => /plain file name/.test(p)) &&
    broken.some(p => /anonymous code/.test(p)) && broken.some(p => /must list what the page says/.test(p)) && broken.some(p => /is not a photo/.test(p)),
    `every manifest problem is named (${broken.length})`);

  // ── the scorer ─────────────────────────────────────────────────────────────
  const exact = scorePage(PHOTOS[0], { lines: [{ text: '2x+3=11' }, { text: 'x = 4' }], confidence: 0.9 }, { status: 'proposed', answer: '4' });
  ok(exact.pageExact && exact.exactLines === 2 && exact.charErrors === 0 && exact.answerRight === true, 'a page read line for line, with the answer proposed, is exact (spacing does not count)');
  const shifted = scorePage(PHOTOS[0], { lines: [{ text: 'x = 4' }] }, { status: 'none' });
  ok(!shifted.pageExact && shifted.exactLines === 0 && shifted.linesRead === 1 && shifted.answerRight === false, 'a dropped line shifts the page: no line is exact and no answer was proposed');
  const extra = scorePage(PHOTOS[1], { lines: [{ text: '5x7=35' }, { text: 'notes' }] }, { status: 'proposed', answer: '35' });
  ok(!extra.pageExact && extra.exactLines === 1 && extra.charErrors === 5, 'an extra line read is not a perfect page, and its characters count as errors');
  eq(scorePage(PHOTOS[3], { lines: [{ text: '3/4+1/4=1' }] }, null).answerRight, null, 'a page with no final answer is not scored on the answer');

  // ── the tool ───────────────────────────────────────────────────────────────
  const out = join(scratch, 'out');
  const dry = quiet();
  eq(await main(['--set', set, '--dry-run', '--prepare', 'raw', '--out', out, '--date', '2026-11-09'], {}, dry), 0, 'a dry run on a set completes');
  const report = JSON.parse(readFileSync(join(out, '2026-11-09-dry-run.json'), 'utf8'));
  ok(report.evidenceClass === 'synthetic-dry-run' && /FAKE/.test(report.provider.kind) && report.floor === null && /owner/.test(report.floorNote), 'its record is labelled synthetic, names the fake provider and carries no floor');
  ok(report.results.photos === 4 && report.results.writers === 2 && report.results.unreadable === 1 && report.results.providerErrors === 0,
    `it counts photos, writers and the page the app would call unreadable (${JSON.stringify(report.results)})`);
  ok(report.results.lines === 5 && report.results.exactLines === 4 && report.results.answers === 3 && report.results.answersRight === 2 && report.results.pagesExact === 2,
    `lines and answers are scored on the readable pages only, and a misread final line gives a wrong proposal (${JSON.stringify(report.results)})`);
  ok(!JSON.stringify(report).includes('base64') && report.rows.every(r => !('image' in r)), 'no image travels into the record');

  const none = quiet();
  eq(await main(['--set', join(scratch, 'missing')], {}, none), 2, 'no set → NOT MEASURED');
  ok(none.lines.some(l => /NOT MEASURED: no real-photo set/.test(l)), 'and it says so');
  const keyless = quiet();
  eq(await main(['--set', set, '--out', join(scratch, 'real')], { PATH: process.env.PATH }, keyless), 2, 'no provider key → NOT MEASURED');
  ok(keyless.lines.some(l => /NOT MEASURED: no provider key/.test(l)) && !readdirSync(scratch).includes('real'), 'and nothing is written');
  const raw = quiet();
  eq(await main(['--set', set, '--prepare', 'raw'], { PRI_HANDWRITING_API_KEY: 'k' }, raw), 1, 'a measurement that skips the app\'s photo preparation is refused');
  const inRepo = quiet();
  eq(await main(['--set', join(ROOT, 'client/test')], { PRI_HANDWRITING_API_KEY: 'k' }, inRepo), 1, 'a real-photo set inside the repository is refused');
  ok(inRepo.lines.some(l => /kept outside the repository/.test(l)), 'and it says why');
  const underHandwriting = quiet();
  eq(await main(['--set', set, '--dry-run', '--prepare', 'raw', '--out', join(ROOT, 'handwriting/v17/photo-reader-eval')], {}, underHandwriting), 1, 'a dry run may not write under handwriting/');
  const badSet = join(scratch, 'bad');
  mkdirSync(badSet);
  writeFileSync(join(badSet, 'manifest.json'), JSON.stringify({ ...manifest, photos: [{ ...PHOTOS[0], file: 'gone.png' }] }));
  const missing = quiet();
  eq(await main(['--set', badSet, '--dry-run', '--prepare', 'raw', '--out', join(scratch, 'o2')], {}, missing), 1, 'a manifest naming a photo that is not there is refused');
  ok(missing.lines.some(l => /gone\.png is not in the set/.test(l)), 'and the photo is named');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`PHOTO READER EVAL TOOL: FAIL — ${failures.length} of ${pass + failures.length} checks`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PHOTO READER EVAL TOOL: PASS — ${pass}/${pass} checks — real photos prepared as the app does, scored without a floor; no set or key is NOT MEASURED; fake runs never land under handwriting/.`);
