from pathlib import Path
import json
import shutil


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing patch anchor in {path}: {old[:120]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"patch anchor not unique in {path}: {text.count(old)} matches")
    p.write_text(text.replace(old, new, 1))


# 1) Real Apple Pencil pages must not enqueue whole-page recognition after every tiny pause.
replace_once(
    "client/src/ink/InkAnswer.jsx",
    """  const onStrokesChange = useCallback((strokes) => {\n    strokesRef.current = strokes;\n    if (timerRef.current) clearTimeout(timerRef.current);\n    timerRef.current = setTimeout(() => runRecognition(strokes, overrides), 240);\n  }, [overrides, runRecognition]);\n""",
    """  const onStrokesChange = useCallback((strokes) => {\n    strokesRef.current = strokes;\n    if (timerRef.current) clearTimeout(timerRef.current);\n    // Native whole-page recognition is intentionally a quiet-window operation.\n    // A 240 ms debounce caused a recognition job after normal pauses between\n    // symbols/lines; those jobs then queued behind Core ML/Vision and the newest\n    // page timed out. Browser JS remains cheap enough for the old live cadence.\n    const quietMs = NATIVE_INK ? (strokes.length > 24 ? 1600 : 1000) : 240;\n    timerRef.current = setTimeout(() => runRecognition(strokes, overrides), quietMs);\n  }, [overrides, runRecognition]);\n"""
)

# 2) Make native bridge failures observable instead of silently disappearing as null.
replace_once(
    "client/src/ink/native.js",
    """function requestReading(message, timeoutMs, context = null) {\n  return new Promise((resolve) => {\n    const reqId = nextRequestId++;\n    pending.set(reqId, { resolve, context, overrides: message.overrides || {} });\n    if (!post({ ...message, reqId })) {\n      pending.delete(reqId);\n      resolve(null);\n      return;\n    }\n    setTimeout(() => {\n      const entry = pending.get(reqId);\n      if (entry) { pending.delete(reqId); entry.resolve(null); }\n    }, timeoutMs);\n  });\n}\n""",
    """function failedReading(op, failure) {\n  const base = op === 'foundationRecognize' ? 'pri-foundation' : 'native-rescue';\n  return {\n    type: 'reading', lines: [], text: '', symbols: [], minConf: 0, margin: 0,\n    weakest: null, engine: `${base}-${failure}`, failure\n  };\n}\n\nfunction requestReading(message, timeoutMs, context = null) {\n  return new Promise((resolve) => {\n    const reqId = nextRequestId++;\n    pending.set(reqId, { resolve, context, overrides: message.overrides || {}, op: message.op });\n    if (!post({ ...message, reqId })) {\n      pending.delete(reqId);\n      resolve(failedReading(message.op, 'bridge-unavailable'));\n      return;\n    }\n    setTimeout(() => {\n      const entry = pending.get(reqId);\n      if (entry) {\n        pending.delete(reqId);\n        entry.resolve(failedReading(entry.op, 'timeout'));\n      }\n    }, timeoutMs);\n  });\n}\n"""
)
replace_once(
    "client/src/ink/native.js",
    "return requestReading({ op: 'foundationRecognize', overrides }, 5000, context);",
    "return requestReading({ op: 'foundationRecognize', overrides }, 8000, context);"
)
replace_once(
    "client/src/ink/native.js",
    "return requestReading({ op: 'recognize', overrides }, 6000, context);",
    "return requestReading({ op: 'recognize', overrides }, 14000, context);"
)

# 3) Preserve evidence from engines that attempted the page but timed out/abstained.
replace_once(
    "client/src/ink/nativeConsensus.js",
    """export function chooseNativeConsensus(candidates) {\n  const live = (candidates || []).filter(hasReading);\n  if (!live.length) return null;\n""",
    """export function chooseNativeConsensus(candidates) {\n  const attempted = (candidates || []).filter(Boolean);\n  const live = attempted.filter(hasReading);\n  if (!live.length) return null;\n"""
)
replace_once(
    "client/src/ink/nativeConsensus.js",
    "candidateReadings: live.map(evidenceOf),",
    "candidateReadings: attempted.map(evidenceOf),"
)
# second occurrence in disagreement branch
replace_once(
    "client/src/ink/nativeConsensus.js",
    "candidateReadings: live.map(evidenceOf),",
    "candidateReadings: attempted.map(evidenceOf),"
)
replace_once(
    "client/src/ink/nativeConsensus.js",
    "const engines = live.map(r => r.engine || 'unknown').join('|');",
    "const engines = attempted.map(r => r.engine || 'unknown').join('|');"
)
replace_once(
    "client/src/ink/nativeConsensus.js",
    """    margin: finiteOr(r?.margin, null)\n  };\n}""",
    """    margin: finiteOr(r?.margin, null),\n    failure: r?.failure || (!hasReading(r) ? 'no-reading' : null)\n  };\n}"""
)
replace_once(
    "client/src/ink/InkAnswer.jsx",
    "{candidate.text || 'no reading'}",
    "{candidate.text || candidate.failure || 'no reading'}"
)

# 4) Compact ink transport. Arrays do not consume two object keys per Pencil sample.
question = Path("client/src/components/QuestionCard.jsx")
qtext = question.read_text()
anchor = """function doubtOf(ink) {\n  const lines = ink?.lines || [];\n  if (!lines.length) return null;\n  const weakest = ink.weakest || null;\n  if (!lines.every(readsAsMaths)) return { why: 'shape', weakest };\n  if (typeof ink.minConf === 'number' && ink.minConf < CONFIRM_CONF) return { why: 'glyph', weakest };\n  if (typeof ink.margin === 'number' && ink.margin < CONFIRM_MARGIN) return { why: 'rival', weakest };\n  return null;\n}\n"""
insert = anchor + """\n// The local gateway counts object keys to reject pathological nested payloads.\n// Pencil points used to be sent as {x,y}, so a normal full working page could\n// exceed that security budget despite being a legitimate answer. Transport each\n// point as [x,y]; backend safeStrokes expands it back to the canonical stored\n// object shape, so History/replay remains unchanged.\nfunction compactInkStrokes(strokes) {\n  return (Array.isArray(strokes) ? strokes : []).map(st => ({\n    points: (Array.isArray(st?.points) ? st.points : []).map(p => [\n      Math.round(Number(p?.x) || 0), Math.round(Number(p?.y) || 0)\n    ])\n  }));\n}\n"""
if qtext.count(anchor) != 1:
    raise SystemExit("QuestionCard doubtOf anchor missing/not unique")
qtext = qtext.replace(anchor, insert, 1)
old_ink = "ink = { strokes: inkResult.strokes.map(s => ({ points: s.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })) })), recognized: inkResult.text };"
if qtext.count(old_ink) != 2:
    raise SystemExit(f"expected 2 ink payload anchors, found {qtext.count(old_ink)}")
qtext = qtext.replace(old_ink, "ink = { strokes: compactInkStrokes(inkResult.strokes), recognized: inkResult.text };", 2)
old_scribble = "? scribbleRef.current.getStrokes().map(st => ({ points: st.points.map(pt => ({ x: Math.round(pt.x), y: Math.round(pt.y) })) }))"
if old_scribble not in qtext:
    raise SystemExit("scribble payload anchor missing")
qtext = qtext.replace(old_scribble, "? compactInkStrokes(scribbleRef.current.getStrokes())", 1)
question.write_text(qtext)

# Backend accepts compact transport but keeps canonical persisted {x,y} points.
replace_once(
    "client/src/local/backend.js",
    """const safeStrokes = (v, max) => (Array.isArray(v) ? v : []).slice(0, max)\n  .map(st => ({ points: (Array.isArray(st?.points) ? st.points : []).slice(0, 4000).map(pt => ({ x: safeNum(pt?.x), y: safeNum(pt?.y) })) }));\n""",
    """const safeStrokes = (v, max) => (Array.isArray(v) ? v : []).slice(0, max)\n  .map(st => ({ points: (Array.isArray(st?.points) ? st.points : []).slice(0, 4000).map(pt => ({\n    x: safeNum(Array.isArray(pt) ? pt[0] : pt?.x),\n    y: safeNum(Array.isArray(pt) ? pt[1] : pt?.y)\n  })) }));\n"""
)

# 5) Native queue: stale jobs must collapse immediately instead of building a backlog.
bridge = Path("ios/PriLearning.swiftpm/Ink/InkBridge.swift")
btext = bridge.read_text()
old_props = """    private let recognitionQueue = DispatchQueue(label: \"com.prilearning.ink.recognize\", qos: .userInitiated)\n    private let encodingQueue = DispatchQueue(label: \"com.prilearning.ink.encode\", qos: .userInitiated)\n\n    private weak var webView: WKWebView?\n"""
new_props = """    private let recognitionQueue = DispatchQueue(label: \"com.prilearning.ink.recognize\", qos: .userInitiated)\n    private let encodingQueue = DispatchQueue(label: \"com.prilearning.ink.encode\", qos: .userInitiated)\n    private let revisionLock = NSLock()\n    private var strokeRevision: UInt64 = 0\n\n    private weak var webView: WKWebView?\n"""
if btext.count(old_props) != 1: raise SystemExit("InkBridge property anchor missing")
btext = btext.replace(old_props, new_props, 1)
old_stroke = """    func inkSurfaceDidChangeStrokes(_ surface: InkSurfaceView) {\n        recognizer.cancelActiveVision()\n        let strokes = surface.strokes\n        emit([\"type\": \"strokes\", \"strokes\": strokes.map(\\.jsonObject)])\n    }\n\n    // MARK: - Recognition\n"""
new_stroke = """    func inkSurfaceDidChangeStrokes(_ surface: InkSurfaceView) {\n        revisionLock.lock()\n        strokeRevision &+= 1\n        revisionLock.unlock()\n        recognizer.cancelActiveVision()\n        let strokes = surface.strokes\n        emit([\"type\": \"strokes\", \"strokes\": strokes.map(\\.jsonObject)])\n    }\n\n    private func revisionSnapshot() -> UInt64 {\n        revisionLock.lock(); defer { revisionLock.unlock() }\n        return strokeRevision\n    }\n\n    private func revisionIsCurrent(_ revision: UInt64) -> Bool {\n        revisionLock.lock(); defer { revisionLock.unlock() }\n        return revision == strokeRevision\n    }\n\n    private func emptyReadingPayload(requestId: Int, engine: String) -> [String: Any] {\n        var payload = Reading(lines: [], text: \"\", minConfidence: 0, margin: 0, weakest: nil).jsonObject\n        payload[\"type\"] = \"reading\"\n        payload[\"reqId\"] = requestId\n        payload[\"engine\"] = engine\n        return payload\n    }\n\n    // MARK: - Recognition\n"""
if btext.count(old_stroke) != 1: raise SystemExit("InkBridge stroke anchor missing")
btext = btext.replace(old_stroke, new_stroke, 1)

old_foundation = """    private func foundationRecognize(requestId: Int, overrides: [String: String]) {\n        let strokes = surface.strokes\n        recognitionQueue.async { [weak self] in\n            guard let self else { return }\n            let foundation = self.foundationRecognizer.read(strokes: strokes, overrides: overrides)\n                ?? Reading(lines: [], text: \"\", minConfidence: 1, margin: 1, weakest: nil)\n\n#if DEBUG\n            // DEBUG is the deliberate Pri Learning model-test path. When a V3\n            // development model is bundled, its result is what the app shows so\n            // a real iPad session tests the Foundation engine end-to-end inside\n            // Pri Learning. If the model is absent or yields no reading, fall\n            // back to the mature native reader. RELEASE behaviour is unchanged.\n            if self.foundationRecognizer.isAvailable && !foundation.text.isEmpty {\n                var payload = foundation.jsonObject\n                payload[\"type\"] = \"reading\"\n                payload[\"reqId\"] = requestId\n                payload[\"engine\"] = \"pri-foundation-debug\"\n                payload[\"foundationAvailable\"] = true\n                payload[\"debugModelTest\"] = true\n                DispatchQueue.main.async { self.emit(payload) }\n            } else {\n                let rescue = self.recognizer.readWithGlyphConsensus(strokes: strokes, overrides: overrides)\n                var payload = rescue.jsonObject\n                payload[\"type\"] = \"reading\"\n                payload[\"reqId\"] = requestId\n                payload[\"engine\"] = \"native-rescue-debug\"\n                payload[\"foundationAvailable\"] = self.foundationRecognizer.isAvailable\n                payload[\"debugModelTest\"] = true\n                DispatchQueue.main.async { self.emit(payload) }\n            }\n#else\n            var payload = foundation.jsonObject\n            payload[\"type\"] = \"reading\"\n            payload[\"reqId\"] = requestId\n            payload[\"engine\"] = \"pri-foundation\"\n            payload[\"available\"] = self.foundationRecognizer.isAvailable\n            DispatchQueue.main.async { self.emit(payload) }\n#endif\n        }\n    }\n"""
new_foundation = """    private func foundationRecognize(requestId: Int, overrides: [String: String]) {\n        let strokes = surface.strokes\n        let revision = revisionSnapshot()\n        recognitionQueue.async { [weak self] in\n            guard let self else { return }\n            guard self.revisionIsCurrent(revision) else {\n                let payload = self.emptyReadingPayload(requestId: requestId, engine: \"pri-foundation-stale\")\n                DispatchQueue.main.async { self.emit(payload) }\n                return\n            }\n            let foundation = self.foundationRecognizer.read(strokes: strokes, overrides: overrides)\n                ?? Reading(lines: [], text: \"\", minConfidence: 0, margin: 0, weakest: nil)\n            guard self.revisionIsCurrent(revision) else {\n                let payload = self.emptyReadingPayload(requestId: requestId, engine: \"pri-foundation-stale\")\n                DispatchQueue.main.async { self.emit(payload) }\n                return\n            }\n\n#if DEBUG\n            // Foundation is one opinion. Do not secretly run the expensive native\n            // rescue here as well: the web arbiter requests that reader exactly\n            // once when independent opinions disagree. This avoids duplicate\n            // whole-page Vision work on physical iPad.\n            var payload = foundation.jsonObject\n            payload[\"type\"] = \"reading\"\n            payload[\"reqId\"] = requestId\n            payload[\"foundationAvailable\"] = self.foundationRecognizer.isAvailable\n            payload[\"debugModelTest\"] = true\n            if self.foundationRecognizer.isAvailable && !foundation.text.isEmpty {\n                payload[\"engine\"] = \"pri-foundation-debug\"\n            } else {\n                payload[\"engine\"] = self.foundationRecognizer.isAvailable\n                    ? \"pri-foundation-no-reading-debug\"\n                    : \"pri-foundation-unavailable-debug\"\n            }\n            DispatchQueue.main.async { self.emit(payload) }\n#else\n            var payload = foundation.jsonObject\n            payload[\"type\"] = \"reading\"\n            payload[\"reqId\"] = requestId\n            payload[\"engine\"] = \"pri-foundation\"\n            payload[\"available\"] = self.foundationRecognizer.isAvailable\n            DispatchQueue.main.async { self.emit(payload) }\n#endif\n        }\n    }\n"""
if btext.count(old_foundation) != 1: raise SystemExit("InkBridge foundation anchor missing")
btext = btext.replace(old_foundation, new_foundation, 1)
old_rescue = """    private func recognize(requestId: Int, overrides: [String: String]) {\n        let strokes = surface.strokes\n        recognitionQueue.async { [weak self] in\n            guard let self else { return }\n            let reading = self.recognizer.readWithGlyphConsensus(strokes: strokes, overrides: overrides)\n            var payload = reading.jsonObject\n            payload[\"type\"] = \"reading\"\n            payload[\"reqId\"] = requestId\n            payload[\"engine\"] = \"native-rescue\"\n            DispatchQueue.main.async { self.emit(payload) }\n        }\n    }\n"""
new_rescue = """    private func recognize(requestId: Int, overrides: [String: String]) {\n        let strokes = surface.strokes\n        let revision = revisionSnapshot()\n        recognitionQueue.async { [weak self] in\n            guard let self else { return }\n            guard self.revisionIsCurrent(revision) else {\n                let payload = self.emptyReadingPayload(requestId: requestId, engine: \"native-rescue-stale\")\n                DispatchQueue.main.async { self.emit(payload) }\n                return\n            }\n            let reading = self.recognizer.readWithGlyphConsensus(strokes: strokes, overrides: overrides)\n            guard self.revisionIsCurrent(revision) else {\n                let payload = self.emptyReadingPayload(requestId: requestId, engine: \"native-rescue-stale\")\n                DispatchQueue.main.async { self.emit(payload) }\n                return\n            }\n            var payload = reading.jsonObject\n            payload[\"type\"] = \"reading\"\n            payload[\"reqId\"] = requestId\n            payload[\"engine\"] = \"native-rescue\"\n            DispatchQueue.main.async { self.emit(payload) }\n        }\n    }\n"""
if btext.count(old_rescue) != 1: raise SystemExit("InkBridge rescue anchor missing")
btext = btext.replace(old_rescue, new_rescue, 1)
bridge.write_text(btext)

second = Path("ios/PriLearning 2.swiftpm/Ink/InkBridge.swift")
if second.exists():
    shutil.copyfile(bridge, second)

# 6) Permanent regression: transport complexity + native queue/timeout evidence + quiet window.
test = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateRequest } from '../src/local/gateway.js';
import { chooseNativeConsensus } from '../src/ink/nativeConsensus.js';

const question = fs.readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
const ink = fs.readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
const native = fs.readFileSync(new URL('../src/ink/native.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../../ios/PriLearning.swiftpm/Ink/InkBridge.swift', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../src/local/backend.js', import.meta.url), 'utf8');

assert.match(question, /compactInkStrokes\(inkResult\.strokes\)/, 'submit must use compact ink transport');
assert.match(question, /points: .*\.map\(p => \[/s, 'transport points must be arrays, not {x,y} objects');
assert.match(backend, /Array\.isArray\(pt\) \? pt\[0\]/, 'backend must decode compact point tuples');
assert.match(ink, /strokes\.length > 24 \? 1600 : 1000/, 'native real pages need a quiet recognition window');
assert.match(native, /pri-foundation.*timeout/s, 'foundation timeout must remain visible evidence');
assert.match(native, /native-rescue.*timeout/s, 'native rescue timeout must remain visible evidence');
assert.match(bridge, /strokeRevision/, 'native queue must invalidate stale page jobs');
assert.match(bridge, /pri-foundation-stale/, 'stale Foundation jobs must answer without doing expensive work');
assert.doesNotMatch(bridge, /let rescue = self\.recognizer\.readWithGlyphConsensus[\s\S]{0,300}native-rescue-debug/, 'Foundation DEBUG path must not secretly run rescue twice');

// Reproduce the gateway failure class from the real iPad page: 3,000 points as
// {x,y} exceeds MAX_KEYS, while the compact tuple transport remains legal.
const objectPoints = Array.from({ length: 3000 }, (_, i) => ({ x: i, y: i % 700 }));
assert.throws(() => validateRequest('POST', '/practice/test/submit', {
  answer: '24/7', viaInk: true, ink: { strokes: [{ points: objectPoints }], recognized: '24/7' }
}), /too many object keys/i);
const tuplePoints = objectPoints.map(p => [p.x, p.y]);
assert.doesNotThrow(() => validateRequest('POST', '/practice/test/submit', {
  answer: '24/7', viaInk: true, ink: { strokes: [{ points: tuplePoints }], recognized: '24/7' }
}));

const js = { engine: 'pri-js-v3', text: 'garbage', lines: [{ text: 'garbage' }], minConf: .99, margin: .9 };
const foundationTimeout = { engine: 'pri-foundation-timeout', failure: 'timeout', text: '', lines: [], minConf: 0, margin: 0 };
const rescueTimeout = { engine: 'native-rescue-timeout', failure: 'timeout', text: '', lines: [], minConf: 0, margin: 0 };
const choice = chooseNativeConsensus([foundationTimeout, js, rescueTimeout]);
assert.equal(choice.disagreement, true);
assert.equal(choice.minConf, .54, 'lone JS must be forced below auto-mark confidence');
assert.equal(choice.candidateReadings.length, 3, 'timed out native engines must remain visible evidence');
assert.match(choice.engine, /pri-foundation-timeout\|pri-js-v3\|native-rescue-timeout/);

console.log('REAL PAGE INK STABILITY: PASS');
'''
Path("client/test/ink-real-page-stability-check.mjs").write_text(test)

# Register the gate in npm test so this failure class cannot regress silently.
pkg = Path("package.json")
data = json.loads(pkg.read_text())
data["scripts"]["test:ink:stability"] = "node client/test/ink-real-page-stability-check.mjs"
needle = " && npm run test:ink:arbitration"
if "test:ink:stability" not in data["scripts"]["test"]:
    if needle not in data["scripts"]["test"]: raise SystemExit("package test anchor missing")
    data["scripts"]["test"] = data["scripts"]["test"].replace(needle, needle + " && npm run test:ink:stability")
pkg.write_text(json.dumps(data, indent=2) + "\n")

print("REAL PAGE INK V3 PATCH APPLIED")
