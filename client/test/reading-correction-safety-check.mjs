// Pri Learning · uncertainty must survive line correction safely.
// Focused regression for PR #367: server/provider doubt, configured confidence
// floors, answer-blind correction, deterministic grading, and after-wait gating.

import { readFileSync } from 'node:fs';
import {
  LOW_CONFIDENCE,
  applyLineCorrection,
  confidenceFloorOf,
  lowConfidenceLines
} from '../src/ink/readingCorrection.js';
import {
  clearCloudAllowanceExhausted,
  readWithCloud,
  toReading
} from '../src/ink/cloudReader.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass += 1; else failures.push(label); };
const eq = (a, b, label) => ok(
  JSON.stringify(a) === JSON.stringify(b),
  `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`
);

const line = (text, confidence) => ({ text, confidence });
const reading = ({
  lines,
  confidenceFloor = 0.82,
  needsConfirmation = true,
  providerNeedsConfirmation = false
}) => toReading({
  engine: 'cloud-test',
  lines,
  confidence: Math.min(...lines.map(l => l.confidence)),
  confidenceFloor,
  needsConfirmation,
  providerNeedsConfirmation
}, null);

// CASE 1: fixing one low-confidence line cannot clear a separate page-level
// provider ambiguity whose location the provider did not identify.
{
  const original = reading({
    lines: [line('2x = 3', 0.5), line('x = 4?', 0.96)],
    confidenceFloor: 0.82,
    needsConfirmation: true,
    providerNeedsConfirmation: true
  });
  const corrected = applyLineCorrection(original, 0, '2x = 8');
  ok(corrected.needsConfirmation === true,
    'CASE 1: correcting line 1 preserves provider-level doubt while untouched line 2 may still be ambiguous');
  eq(lowConfidenceLines(corrected), [],
    'CASE 1: the surviving doubt is page-level provider ambiguity, not a fabricated low-confidence line');
}

// CASE 2: the configured server floor is authoritative, not the 0.82 fallback.
{
  const original = reading({
    lines: [line('2x = 8', 0.95), line('x = 4', 0.85)],
    confidenceFloor: 0.90,
    needsConfirmation: true,
    providerNeedsConfirmation: false
  });
  const corrected = applyLineCorrection(original, 0, '2x = 8');
  eq([corrected.confidenceFloor, corrected.needsConfirmation, lowConfidenceLines(corrected)], [0.9, true, [1]],
    'CASE 2: a 0.90 server floor keeps an untouched 0.85 line uncertain after another line is corrected');
}

// CASE 3a: when the only doubt was the configured floor, correcting every
// below-floor line may clear confirmation without touching confident lines.
{
  const original = reading({
    lines: [line('2x = 3', 0.5), line('x = 4', 0.96)],
    confidenceFloor: 0.90,
    needsConfirmation: true,
    providerNeedsConfirmation: false
  });
  const corrected = applyLineCorrection(original, 0, '2x = 8');
  eq([corrected.needsConfirmation, lowConfidenceLines(corrected)], [false, []],
    'CASE 3: pure floor-based doubt clears once all ambiguity-producing low-confidence lines are corrected');
}

// CASE 3b: an explicit provider ambiguity is page-level. Because the provider
// does not identify which line caused it, every still-uncorrected line remains
// potentially responsible; only correcting them all can clear it automatically.
{
  const original = reading({
    lines: [line('2x = 8?', 0.95), line('x = 4?', 0.95)],
    confidenceFloor: 0.90,
    needsConfirmation: true,
    providerNeedsConfirmation: true
  });
  const first = applyLineCorrection(original, 0, '2x = 8');
  const second = applyLineCorrection(first, 1, 'x = 4');
  ok(first.needsConfirmation === true && second.needsConfirmation === false,
    'CASE 3: provider ambiguity survives partial correction and clears only after no potentially ambiguous line remains');
}

// The server/provider floor travels with the reading. Status is a compatibility
// source for older transcribe responses; a transcribe-returned floor wins.
{
  eq(confidenceFloorOf({}), LOW_CONFIDENCE, 'missing floor deliberately falls back to 0.82');
  const fromStatus = toReading({
    engine: 'cloud-old', lines: [line('x = 4', 0.85)], confidence: 0.85,
    needsConfirmation: true
  }, null, { confidenceFloor: 0.90 });
  eq(fromStatus.confidenceFloor, 0.9, 'older transcribe response inherits the authoritative floor from readiness status');
  const fromTranscribe = toReading({
    engine: 'cloud-new', lines: [line('x = 4', 0.91)], confidence: 0.91,
    confidenceFloor: 0.92, providerNeedsConfirmation: false, needsConfirmation: true
  }, null, { confidenceFloor: 0.90 });
  eq(fromTranscribe.confidenceFloor, 0.92, 'transcribe-returned provider floor wins over the earlier status snapshot');
}

// CASE 4: a correction is local. It never spends another provider call.
{
  clearCloudAllowanceExhausted();
  let providerCalls = 0;
  const transcription = {
    engine: 'cloud-test',
    lines: [line('2x = 3', 0.5), line('x = 4', 0.96)],
    text: '2x = 3\nx = 4',
    confidence: 0.5,
    confidenceFloor: 0.9,
    providerNeedsConfirmation: false,
    needsConfirmation: true
  };
  const outcome = await readWithCloud([{ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }], {
    user: { cloudHandwriting: true },
    available: () => true,
    readiness: async () => ({ usable: true, available: true, state: 'ready', confidenceFloor: 0.9 }),
    rasterize: () => ({ dataUrl: 'data:image/png;base64,AAAA', width: 10, height: 10, bytes: 3 }),
    transport: {
      transcribeHandwriting: async () => {
        providerCalls += 1;
        return { transcription };
      }
    }
  });
  const onScreen = toReading(outcome.transcription, null, { confidenceFloor: outcome.readiness.confidenceFloor });
  applyLineCorrection(onScreen, 0, '2x = 8');
  eq(providerCalls, 1, 'CASE 4: correcting a line does not cause another provider read');
}

// CASES 5 and 6: structural wiring. Correction only republishes student text;
// marking still goes through QuestionCard's deterministic submit endpoint, and
// the after-wait path calls the same submit gate rather than bypassing doubt.
{
  const inkAnswer = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');

  const correctionStart = inkAnswer.indexOf('const correctLine = useCallback(');
  const correctionEnd = inkAnswer.indexOf('}, [rec, publish]);', correctionStart);
  const correctionHandler = inkAnswer.slice(correctionStart, correctionEnd);
  ok(/applyLineCorrection\(rec, index, text\)/.test(correctionHandler)
      && /publish\(next, strokesRef\.current\)/.test(correctionHandler)
      && !/readWithCloud|sendToReader|api\.post|mark|grade/.test(correctionHandler),
    'CASE 5: correction only republishes student-authored text; it neither calls AI again nor decides a mark');

  const submitStart = card.indexOf('async function submit(');
  const deliverStart = card.indexOf('async function deliver(', submitStart);
  const submitBody = card.slice(submitStart, deliverStart);
  const deliverBody = card.slice(deliverStart, card.indexOf('// ── Relaunch recovery', deliverStart));
  ok(/given = inkResult\.lines\.join\('\\n'\)|given = inkResult\.answerLine/.test(submitBody)
      && /await deliver\(/.test(submitBody)
      && /api\.post\(\`\/practice\/\$\{question\.id\}\/submit\`, body\)/.test(deliverBody),
    'CASE 5: corrected ink text flows to the same deterministic practice submit endpoint as any other answer');

  const gateAt = submitBody.indexOf('if (needsCheck && vouchedNow !== reading)');
  const deliveryAt = submitBody.indexOf('await deliver(');
  const autoStart = card.indexOf('const autoMarkedRef = useRef(');
  const autoEnd = card.indexOf('async function getHint()', autoStart);
  const autoBody = card.slice(autoStart, autoEnd);
  ok(gateAt >= 0 && deliveryAt > gateAt && /submit\(\);/.test(autoBody),
    'CASE 6: afterWait auto-mark calls submit, whose surviving-uncertainty gate runs before any delivery/mark');
  ok(/if \(ink\.needsConfirmation === true\)/.test(card)
      && /ink\.minConf < confidenceGate/.test(card)
      && /Number\(ink\.confidenceFloor\)/.test(card),
    'CASE 6: QuestionCard honours both surviving server doubt and the propagated server confidence floor');
}

console.log(failures.length
  ? `READING CORRECTION SAFETY: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `READING CORRECTION SAFETY: PASS — ${pass}/${pass} checks — line correction cannot erase unrelated server uncertainty or bypass deterministic grading.`);
process.exit(failures.length ? 1 : 0);
