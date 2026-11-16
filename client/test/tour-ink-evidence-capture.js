// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the physical-study capture route records a sample.
//
// /practice?inkEvidence=1 is where the real-writer study collects its
// evidence. On main before this flow existed the route could not record a
// single sample: it timed a native reader InkAnswer no longer calls, so every
// sample's time was NaN and record() refused it (audit-handwriting item 3).
//
// This flow mounts the REAL InkAnswer on the real route with a stand-in for
// the native ink bridge (strokes are injected through it, as PencilKit would
// emit them) and the platform's stand-in SERVER reader (support/online-session),
// and proves:
//   · a stroke on the surface, a press of "Read my answer", a reading from the
//     server with a finite round trip measured by InkAnswer, and a recorded
//     sample carrying those strokes and that time;
//   · a page that changed after its read cannot be recorded, and nothing is
//     recordable before the student presses Read;
//   · the exported evidence file is schema 2, names the server reader, and the
//     physical scorer accepts it (non-strict: schema and leakage), while the
//     corpus export holds strokes and prompts only.
//
// SYNTHETIC evidence only: a browser, a fake ink bridge, programmatic strokes,
// a scripted reader. It is never device, Pencil, real-reader or real-writer
// evidence, and nothing it exports may be committed under handwriting/.
//
// Run on its own:  node client/test/tour-ink-evidence-capture.js
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pressRead, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const SCORER = fileURLToPath(new URL('./ink-physical-release-evidence.mjs', import.meta.url));
const BUILD_SHA = '0123456789abcdef0123456789abcdef01234567';
const READING = '2x+5=17';

/** A few strokes in the surface's CSS-pixel space, with the PencilKit fields. */
const strokesFor = (seed, lines = 1) => Array.from({ length: 3 * lines }, (_, s) => ({
  points: Array.from({ length: 24 }, (_, i) => ({
    x: 40 + (s % 3) * 70 + i * 2.2 + seed,
    y: 60 + Math.floor(s / 3) * 90 + Math.sin(i / 3 + s) * 22,
    w: 4, t: i * 0.012, p: 0.4 + (i % 5) * 0.1, azimuth: 1.2, altitude: 1.1
  }))
}));

export const flow = {
  id: 'ink-evidence-capture',
  name: 'Ink · the physical-study route records a server-read sample with its strokes and round trip',
  online: true,

  async run({ page, ctx, base, check, note, goto, createProfile, online }) {
    note(`${SYNTHETIC_EVIDENCE}: "${flow.name}" runs the real route and the real InkAnswer in a browser with a stand-in native ink bridge and a scripted server reader. It is not device, Pencil, real-reader or real-writer evidence; its exports are deleted and never count.`);
    const reader = online.reader;
    Object.assign(reader, { text: READING, lines: null, confidence: 0.97, down: false, gate: null });
    reader.requests.length = 0;

    // The native ink bridge the route requires, installed before any page of
    // this context loads: the legacy priInk handler and its receiver, nothing
    // else (no __PRI_NATIVE__, so the cloud still goes over fetch and sharing
    // still downloads). `setStrokes` echoes back as PencilKit would; `write`
    // is the pen.
    await ctx.addInitScript(() => {
      const posted = [];
      const stub = {
        posted,
        write(strokes) { window.__priInkReceive?.({ type: 'strokes', strokes }); },
      };
      window.__priInkStub = stub;
      window.__PRI_NATIVE_INK__ = true;
      window.webkit = { messageHandlers: { priInk: { postMessage(message) {
        posted.push(message);
        if (message?.op === 'mount') setTimeout(() => window.__priInkReceive?.({ type: 'mounted' }), 0);
        if (message?.op === 'setStrokes') setTimeout(() => window.__priInkReceive?.({ type: 'strokes', strokes: message.strokes }), 0);
        if (message?.op === 'clear') setTimeout(() => window.__priInkReceive?.({ type: 'strokes', strokes: [] }), 0);
      } } } };
    });

    await goto('/');
    await createProfile({ name: 'Evidence Writer', year: 9 });
    await online.signIn({ name: 'Evidence Writer' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await check('server reading is on for this signed-in profile', await turnOnServerReading(page, base));

    await goto('/practice?inkEvidence=1');
    const setup = page.locator('[data-ink-evidence="setup"]');
    await check('the route opens the study setup (native ink bridge detected)', await setup.waitFor({ timeout: 30000 }).then(() => true, () => false));
    await check('no native-unavailable warning is shown with the bridge present', (await page.locator('[data-ink-evidence="setup"] .callout.warn[role=alert]').count()) === 0);

    await page.getByLabel('Anonymous participant code').fill('P0217');
    await page.getByLabel('Exact build commit').fill(BUILD_SHA);
    await page.getByLabel('App version').fill('1.0 (3)');
    await page.getByLabel('iPad model').fill('iPad Air 11-inch (M2)');
    await page.getByLabel('iPadOS').fill('26.1');
    await page.getByLabel('Pencil model').fill('Apple Pencil Pro');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start production evidence session' }).click();
    const promptCard = page.locator('[data-ink-evidence="prompt"]');
    await check('the session starts on the first prompt', await promptCard.waitFor({ timeout: 30000 }).then(() => true, () => false));
    await check('the first prompt is the protocol\'s first prompt', (await page.locator('[data-ink-evidence-prompt]').getAttribute('data-ink-evidence-prompt')) === 'p001');
    const record = page.locator('[data-ink-evidence-record]');
    await check('nothing is recordable before any ink or read', await record.isDisabled());

    // ── prompt 1: write, press Read, record ─────────────────────────────────
    await page.waitForFunction(() => window.__priInkStub.posted.some(m => m.op === 'mount'), null, { timeout: 30000 });
    await page.evaluate(strokes => window.__priInkStub.write(strokes), strokesFor(0));
    const readButton = page.locator('[data-ink-read]').first();
    await check('"Read my answer" is offered once there is ink', await readButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false));
    await check('ink alone makes nothing recordable: a read must be pressed', await record.isDisabled());
    const requestsBefore = reader.requests.length;
    await check('the press sends the read', await pressRead(page));
    const reading = page.locator('[data-ink-evidence-reading]');
    await check('the server reading lands on the route', await reading.waitFor({ timeout: 30000 }).then(() => true, () => false));
    await check('the reading is what the server returned', (await reading.getAttribute('data-ink-evidence-reading')) === READING);
    await online.settled?.().catch?.(() => {});
    await check('exactly one read reached the reader for the press', reader.requests.length === requestsBefore + 1, `${reader.requests.length - requestsBefore} requests`);
    const ms = Number(await page.locator('[data-ink-evidence-ms]').getAttribute('data-ink-evidence-ms'));
    await check('the sample carries a finite server-read round trip measured by InkAnswer', Number.isFinite(ms) && ms > 0 && ms < 60000, `readMs ${ms}`);
    await check('the sample is recordable (server reading, strokes, finite time, not stale)', await record.isEnabled());
    await record.click();
    await check('one sample is recorded', await page.locator('[data-ink-evidence-count="1"]').waitFor({ timeout: 10000 }).then(() => true, () => false));

    // ── prompt 2: a page that changed after its read is not recordable ──────
    await check('the route moved to the second prompt', (await page.locator('[data-ink-evidence-prompt]').getAttribute('data-ink-evidence-prompt')) === 'p002');
    await page.evaluate(strokes => window.__priInkStub.write(strokes), strokesFor(3));
    await readButton.waitFor({ state: 'visible', timeout: 15000 });
    await pressRead(page);
    await reading.waitFor({ timeout: 30000 });
    await check('the second reading is recordable before the page changes', await record.isEnabled());
    await page.evaluate(strokes => window.__priInkStub.write(strokes), strokesFor(3, 2));
    await page.waitForTimeout(400);
    await check('a page that changed after its read cannot be recorded (stale, no fresh round trip)', await record.isDisabled());

    // ── the rest of the protocol is skipped; the exports are checked ────────
    const skip = page.locator('[data-ink-evidence-skip]');
    for (let i = 0; i < 70 && (await page.locator('[data-ink-evidence="complete"]').count()) === 0; i++) {
      await skip.click();
      await page.waitForTimeout(60);
    }
    await check('the session completes with the one recorded sample', (await page.locator('[data-ink-evidence="complete"]').getAttribute('data-ink-evidence-recorded')) === '1');

    const scratch = mkdtempSync(join(tmpdir(), 'pri-ink-evidence-tour-'));
    try {
      const [evidenceDownload] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.locator('[data-ink-evidence-export="evidence"]').click()
      ]);
      const evidencePath = join(scratch, 'evidence', evidenceDownload.suggestedFilename());
      await evidenceDownload.saveAs(evidencePath);
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
      await check('the evidence file is schema 2 of the server reader', evidence.schemaVersion === 2 && evidence.reader === 'server' && evidence.physicalHardware === true);
      await check('the evidence file names the build, its kind and its server', evidence.build?.commit === BUILD_SHA && evidence.build?.kind === 'development' && evidence.build?.server === 'staging');
      const sample = evidence.samples?.[0];
      await check('the one sample carries the prompt, the server reading and the authority decision', evidence.samples?.length === 1 && sample?.id?.endsWith('-p001') && sample.target === '2x+5=17' && sample.recognized === READING && sample.authority === 'auto' && sample.reader === 'server');
      await check('the sample carries its strokes with the PencilKit fields', Array.isArray(sample?.strokes) && sample.strokes.length === 3 && sample.strokes[0].points.length === 24 && sample.strokes[0].points[0].azimuth === 1.2);
      await check('the sample carries the finite round trip and a server engine label', Number.isFinite(sample?.recognitionMs) && sample.recognitionMs > 0 && String(sample?.engine || '').startsWith('cloud'), `recognitionMs ${sample?.recognitionMs} engine ${sample?.engine}`);
      // The physical scorer accepts the file's shape (non-strict: schema and
      // leakage). Strict mode must still refuse it: one writer, one sample.
      const valid = spawnSync(process.execPath, [SCORER, '--dir', join(scratch, 'evidence')], { encoding: 'utf8' });
      await check('the physical scorer accepts the exported file as well-formed server-reader evidence', valid.status === 0 && /PHYSICAL RELEASE EVIDENCE — VALID/.test(valid.stdout), valid.stdout.slice(-400));
      const strict = spawnSync(process.execPath, [SCORER, '--dir', join(scratch, 'evidence'), '--strict', '--split', String(evidence.writer?.split || 'test')], { encoding: 'utf8' });
      await check('strict mode still refuses one writer and one sample as release evidence', strict.status === 1 && /writers; measured 1\b/.test(strict.stdout) && /scored expressions; measured 1\b/.test(strict.stdout), strict.stdout.slice(-600));
      // A file claiming a retired reader is refused even when everything else matches.
      const forged = { ...evidence, samples: [{ ...sample, engine: 'pri-consensus:pri-foundation+native-rescue' }] };
      writeFileSync(join(scratch, 'evidence', 'forged.json'), JSON.stringify(forged));
      const refused = spawnSync(process.execPath, [SCORER, '--dir', join(scratch, 'evidence')], { encoding: 'utf8' });
      await check('the scorer refuses the same file relabelled as an on-device reader', refused.status === 1 && /retired on-device reader/.test(refused.stdout));

      const [corpusDownload] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.locator('[data-ink-evidence-export="corpus"]').click()
      ]);
      const corpusPath = join(scratch, 'corpus', corpusDownload.suggestedFilename());
      await corpusDownload.saveAs(corpusPath);
      const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
      await check('the corpus export holds prompts and strokes only, never the reading or the decision', corpus.format === 'pri-ink-corpus' && corpus.samples?.length === 1 && corpus.samples[0].target === '2x+5=17' && corpus.samples[0].strokes?.length === 3 && !('recognized' in corpus.samples[0]) && !('authority' in corpus.samples[0]));
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    Object.assign(reader, { lines: null, confidence: null, gate: null });
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
