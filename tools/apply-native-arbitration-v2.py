from pathlib import Path
import json

root = Path('.')
ink_path = root / 'client/src/ink/InkAnswer.jsx'
text = ink_path.read_text()

old_import = "import { nativeInk, nativeInkAvailable } from './native.js';\n"
new_import = old_import + "import { chooseNativeConsensus, hasReading, normalizedReadingText } from './nativeConsensus.js';\n"
if "./nativeConsensus.js" not in text:
    if old_import not in text:
        raise SystemExit('native import anchor missing')
    text = text.replace(old_import, new_import, 1)

old_comment = """// PencilKit is the native capture surface. Recognition order on iPad is now:\n//   1. Pri's bundled Core ML foundation model, when a validated asset exists;\n//   2. Pri's mature JS stroke/CNN/grammar recogniser;\n//   3. the native Vision/geometry reader as an emergency no-result rescue.\n"""
new_comment = """// PencilKit is the native capture surface. Recognition on iPad is an evidence\n// problem, not a fallback ladder: Foundation and JS form two independent\n// opinions, and any disagreement MUST ask the native Vision/geometry reader\n// for a third vote. A legacy JS reading can never become authoritative merely\n// because its synthetic confidence is high on real Apple Pencil handwriting.\n"""
if old_comment in text:
    text = text.replace(old_comment, new_comment, 1)

start = text.find("const normalizedReadingText = r =>")
end = text.find("\n/**\n * lineVerdicts:", start)
if start == -1 or end == -1:
    raise SystemExit('old local consensus helper block not found')
text = text[:start] + text[end + 1:]

old_native = """    // Native iPad: Foundation is one opinion, not an oracle. The current\n    // learned checkpoint is still data-limited, so a non-empty reading is not\n    // enough to trust it. Compare it with Pri's independent JS stroke engine;\n    // disagreement or weak confidence asks the native rescue reader for a third\n    // answer-blind vote. Two matching engines win; otherwise the best calibrated\n    // reading is shown and the existing confirmation gate still protects marks.\n    nativeInk.foundationRecognize(ovr, recognitionContext).then(foundation => {\n      if (seq !== readSeqRef.current) return;\n      const localRaw = readWithJS();\n      const local = localRaw ? { ...localRaw, engine: 'pri-js-v3' } : null;\n\n      if (hasReading(foundation) && hasReading(local) && normalizedReadingText(foundation) === normalizedReadingText(local)) {\n        publish({ ...foundation, engine: `pri-consensus:${foundation.engine || 'foundation'}+pri-js-v3` }, strokes);\n        return;\n      }\n      if (hasReading(foundation) && strongReading(foundation) && !hasReading(local)) {\n        publish(foundation, strokes);\n        return;\n      }\n      if (!hasReading(foundation) && hasReading(local) && strongReading(local)) {\n        publish(local, strokes);\n        return;\n      }\n\n      nativeInk.recognize(ovr, recognitionContext).then(nativeRaw => {\n        if (seq !== readSeqRef.current) return;\n        const nativeReading = nativeRaw\n          ? readUnreadLines(nativeRaw, strokes, ovr, recognitionContext)\n          : null;\n        const chosen = chooseNativeConsensus([foundation, local, nativeReading]);\n        publish(chosen || { ...EMPTY_READING, engine: 'pri-native-no-reading' }, strokes);\n      });\n    });\n"""
new_native = """    // Native iPad: Foundation and JS are opinions, not fallbacks. The previous\n    // implementation allowed a lone JS V3 reading to short-circuit this path\n    // when JS reported high confidence. Real Pencil evidence showed that those\n    // confidences are not calibrated outside the synthetic/template domain.\n    // Therefore only exact two-engine agreement may finish early. Every other\n    // case asks the native Vision/geometry reader for a third answer-blind vote.\n    nativeInk.foundationRecognize(ovr, recognitionContext).then(foundation => {\n      if (seq !== readSeqRef.current) return;\n      const localRaw = readWithJS();\n      const local = localRaw ? { ...localRaw, engine: 'pri-js-v3' } : null;\n\n      if (hasReading(foundation) && hasReading(local)\n          && normalizedReadingText(foundation) === normalizedReadingText(local)) {\n        const agreed = chooseNativeConsensus([foundation, local]);\n        publish(agreed || { ...EMPTY_READING, engine: 'pri-native-no-reading' }, strokes);\n        return;\n      }\n\n      nativeInk.recognize(ovr, recognitionContext).then(nativeRaw => {\n        if (seq !== readSeqRef.current) return;\n        const nativeReading = nativeRaw\n          ? readUnreadLines(nativeRaw, strokes, ovr, recognitionContext)\n          : null;\n        const chosen = chooseNativeConsensus([foundation, local, nativeReading]);\n        publish(chosen || { ...EMPTY_READING, engine: 'pri-native-no-reading' }, strokes);\n      });\n    });\n"""
if old_native not in text:
    raise SystemExit('native recognition block anchor missing')
text = text.replace(old_native, new_native, 1)

old_note = """  const engineNote = rec.engine === 'pri-structural-v4-dev-lan'\n    ? 'Structural V4 research · Mac LAN · not production'\n    : rec.engine === 'pri-js-v3-v4-unavailable'\n      ? 'Structural V4 returned no reading · showing JS V3 fallback'\n      : rec.engine === 'pri-js-v3'\n        ? 'Legacy JS V3 fallback · not native PencilKit/Core ML'\n        : NATIVE_INK && rec.engine\n          ? `Native recognition path · ${rec.engine}`\n          : null;\n"""
new_note = """  const engineNote = rec.engine === 'pri-structural-v4-dev-lan'\n    ? 'Structural V4 research · Mac LAN · not production'\n    : rec.engine === 'pri-js-v3-v4-unavailable'\n      ? 'Structural V4 returned no reading · showing JS V3 fallback'\n      : rec.engine === 'pri-js-v3'\n        ? 'Legacy JS V3 fallback · not native PencilKit/Core ML'\n        : rec.disagreement\n          ? `Native engines disagree · confirmation required · ${rec.engine}`\n          : NATIVE_INK && rec.engine\n            ? `Native recognition path · ${rec.engine}`\n            : null;\n"""
if old_note not in text:
    raise SystemExit('engine note anchor missing')
text = text.replace(old_note, new_note, 1)

old_title = """          <div className=\"ink-preview-title\" id=\"ink-reading\">\n            I'm reading:{engineNote && <span className=\"muted\" style={{ marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>{engineNote}</span>}\n"""
new_title = """          <div className=\"ink-preview-title\" id=\"ink-reading\">\n            I'm reading:{engineNote && <span className=\"muted\" style={{ marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>{engineNote}</span>}\n          </div>\n          {rec.disagreement && Array.isArray(rec.candidateReadings) && rec.candidateReadings.length > 1 && (\n            <details style={{ margin: '8px 14px 2px', fontSize: 11.5 }} className=\"muted\">\n              <summary style={{ cursor: 'pointer' }}>Recognition evidence</summary>\n              {rec.candidateReadings.map((candidate, index) => (\n                <div key={`${candidate.engine}-${index}`} style={{ marginTop: 5, overflowWrap: 'anywhere' }}>\n                  <b>{candidate.engine}</b> → {candidate.text || 'no reading'}\n                </div>\n              ))}\n            </details>\n          )}\n"""
if old_title not in text:
    raise SystemExit('preview title anchor missing')
text = text.replace(old_title, new_title, 1)
# The replacement closes the title div. Remove the original immediately-following closing div.
text = text.replace(new_title + "          </div>\n", new_title, 1)

ink_path.write_text(text)

helper = r'''// Pri Learning · native handwriting arbitration
// Pure, answer-blind evidence fusion. This module intentionally knows nothing
// about the expected answer or mark scheme, so it can be regression-tested in
// Node without mounting React or the native shell.

export const normalizedReadingText = r => String(r?.text || '').replace(/\s+/g, '').toLowerCase();
export const hasReading = r => !!r?.lines?.some(line => String(line?.text || '').trim());

function plausibleInkText(r) {
  const t = normalizedReadingText(r);
  if (!t || t.includes('?')) return false;
  let depth = 0;
  for (const ch of t) {
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth < 0) return false; }
  }
  return depth === 0 && !/[+*/=<>^]$/.test(t);
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function intrinsicQuality(r) {
  if (!hasReading(r)) return -1;
  const conf = finiteOr(r.minConf, 0.45);
  const margin = finiteOr(r.margin, 0.10);
  return 0.74 * conf
    + 0.26 * Math.min(1, margin * 2.5)
    + (plausibleInkText(r) ? 0.08 : -0.20);
}

// Internal confidence scales are not interchangeable. JS V3 is useful as an
// independent vote, but its confidence was calibrated on templates/synthetic
// writers and must not dominate real Apple Pencil evidence. Native rescue uses
// the real line raster + Pencil geometry; Foundation remains data-limited.
function engineAdjustment(r) {
  const engine = String(r?.engine || '');
  const lines = Array.isArray(r?.lines) ? r.lines.length : 0;
  const chars = normalizedReadingText(r).length;
  if (engine.includes('native-rescue')) return 0.14;
  if (engine.includes('foundation')) return chars > 12 || lines > 1 ? 0.00 : 0.04;
  if (engine.includes('pri-js-v3')) return (chars > 12 || lines > 1) ? -0.32 : -0.20;
  return 0;
}

function choiceScore(r) {
  return intrinsicQuality(r) + engineAdjustment(r);
}

function evidenceOf(r) {
  return {
    engine: r?.engine || 'unknown',
    text: String(r?.text || ''),
    minConf: finiteOr(r?.minConf, null),
    margin: finiteOr(r?.margin, null)
  };
}

export function chooseNativeConsensus(candidates) {
  const live = (candidates || []).filter(hasReading);
  if (!live.length) return null;

  const groups = new Map();
  for (const reading of live) {
    const key = normalizedReadingText(reading);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(reading);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return Math.max(...b.map(choiceScore)) - Math.max(...a.map(choiceScore));
  });
  const consensus = orderedGroups[0];

  if (consensus.length >= 2) {
    const chosen = [...consensus].sort((a, b) => choiceScore(b) - choiceScore(a))[0];
    const engines = consensus.map(r => r.engine || 'unknown').join('+');
    return {
      ...chosen,
      disagreement: false,
      candidateReadings: live.map(evidenceOf),
      engine: `pri-consensus:${engines}`
    };
  }

  // No two independent readers agree. We may still display the best evidence,
  // but we deliberately destroy auto-mark certainty. QuestionCard's existing
  // doubt gate will require the student to confirm/correct the reading first.
  const chosen = [...live].sort((a, b) => choiceScore(b) - choiceScore(a))[0];
  const engines = live.map(r => r.engine || 'unknown').join('|');
  return {
    ...chosen,
    minConf: Math.min(finiteOr(chosen.minConf, 0.54), 0.54),
    margin: Math.min(finiteOr(chosen.margin, 0.08), 0.08),
    disagreement: true,
    candidateReadings: live.map(evidenceOf),
    engine: `pri-disagreement:${engines}->${chosen.engine || 'unknown'}`
  };
}
'''
(root / 'client/src/ink/nativeConsensus.js').write_text(helper)

test = r'''import assert from 'node:assert/strict';
import { chooseNativeConsensus } from '../src/ink/nativeConsensus.js';

const line = text => [{ text, symbols: [] }];
const r = (engine, text, minConf, margin) => ({ engine, text, lines: line(text), minConf, margin });

// Two independent engines agreeing is the only fast native acceptance path.
{
  const out = chooseNativeConsensus([
    r('pri-foundation-debug', 'x=3', 0.72, 0.18),
    r('pri-js-v3', 'x=3', 0.91, 0.24)
  ]);
  assert.equal(out.disagreement, false);
  assert.match(out.engine, /^pri-consensus:/);
  assert.equal(out.text, 'x=3');
}

// Real-Pencil regression: high self-confidence from JS V3 must not beat a
// reasonable native rescue reading on a complex multi-line page.
{
  const jsGarbage = r('pri-js-v3', '05theta=63/65\n1--c(cos(6)3^2)/(65)', 0.97, 0.32);
  const native = r('native-rescue+line-stroke-fusion', 'cos(theta)=63/65\nsin(theta)=16/65', 0.73, 0.16);
  const out = chooseNativeConsensus([jsGarbage, native]);
  assert.match(out.engine, /->native-rescue\+line-stroke-fusion$/);
  assert.equal(out.text, native.text);
  assert.equal(out.disagreement, true);
  assert.ok(out.minConf <= 0.54);
  assert.ok(out.margin <= 0.08);
}

// A lone JS reading on native may be displayed for correction, never trusted.
{
  const out = chooseNativeConsensus([r('pri-js-v3', 'garbage=22%', 0.99, 0.40)]);
  assert.equal(out.disagreement, true);
  assert.ok(out.minConf <= 0.54);
  assert.ok(out.margin <= 0.08);
}

// If Foundation and native independently agree, their consensus beats JS.
{
  const out = chooseNativeConsensus([
    r('pri-foundation-debug', 'sin(theta)=16/65', 0.66, 0.12),
    r('native-rescue+line-stroke-fusion', 'sin(theta)=16/65', 0.70, 0.14),
    r('pri-js-v3', '7ln(theta)=16b95', 0.98, 0.30)
  ]);
  assert.equal(out.disagreement, false);
  assert.equal(out.text, 'sin(theta)=16/65');
  assert.match(out.engine, /^pri-consensus:/);
}

// Arbitration must remain answer-blind.
{
  const source = await import('node:fs').then(fs => fs.readFileSync(new URL('../src/ink/nativeConsensus.js', import.meta.url), 'utf8'));
  assert.ok(!/expected|answerText|markScheme/.test(source), 'native arbitration must not inspect expected-answer data');
}

console.log('NATIVE INK ARBITRATION — PASS');
'''
(root / 'client/test/native-ink-arbitration-check.mjs').write_text(test)

pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text())
scripts = pkg['scripts']
scripts['test:ink:arbitration'] = 'node client/test/native-ink-arbitration-check.mjs'
needle = 'npm run test:ink:hybrid'
if 'npm run test:ink:arbitration' not in scripts['test']:
    scripts['test'] = scripts['test'].replace(needle, needle + ' && npm run test:ink:arbitration')
pkg_path.write_text(json.dumps(pkg, indent=2, ensure_ascii=False) + '\n')

print('NATIVE ARBITRATION V2 PATCH APPLIED')
