from pathlib import Path
import re


def once(path, old, new):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{path}: expected one anchor, found {n}: {old[:100]!r}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


def regex_once(path, pattern, repl):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    out, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'{path}: regex anchor matched {n}: {pattern[:120]!r}')
    p.write_text(out, encoding='utf-8')


# ── Browser side of native photo OCR ─────────────────────────────────────────
photo_js = r'''// Pri Learning · native photo handwriting OCR bridge.
// The image never leaves the iPad. The native wrapper runs Apple Vision and
// returns editable text; the page never auto-submits an OCR guess.
const handler = () =>
  (typeof window !== 'undefined' && window.__PRI_NATIVE_PHOTO__ &&
    window.webkit?.messageHandlers?.priPhoto) || null;

export const nativePhotoAvailable = () => !!handler();

let nextRequestId = 1;
const pending = new Map();

if (typeof window !== 'undefined') {
  window.__priPhotoReceive = payload => {
    if (!payload || typeof payload !== 'object') return;
    const entry = pending.get(payload.reqId);
    if (!entry) return;
    pending.delete(payload.reqId);
    if (payload.ok === false) entry.reject(new Error(payload.error || 'Photo handwriting could not be read.'));
    else entry.resolve(payload);
  };
}

export function recognizePhoto(dataURL, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const target = handler();
    if (!target) {
      reject(new Error('Native photo handwriting OCR is unavailable in this build.'));
      return;
    }
    if (typeof dataURL !== 'string' || !/^data:image\//.test(dataURL)) {
      reject(new Error('The selected photo could not be prepared for handwriting recognition.'));
      return;
    }
    const reqId = nextRequestId++;
    pending.set(reqId, { resolve, reject });
    try {
      target.postMessage({ reqId, dataURL });
    } catch (err) {
      pending.delete(reqId);
      reject(err instanceof Error ? err : new Error('Could not start photo handwriting recognition.'));
      return;
    }
    setTimeout(() => {
      const entry = pending.get(reqId);
      if (!entry) return;
      pending.delete(reqId);
      entry.reject(new Error('Photo handwriting recognition timed out.'));
    }, timeoutMs);
  });
}
'''
Path('client/src/native').mkdir(parents=True, exist_ok=True)
Path('client/src/native/photo.js').write_text(photo_js, encoding='utf-8')

photo_test = r'''import assert from 'node:assert/strict';

let posted = null;
globalThis.window = {
  __PRI_NATIVE_PHOTO__: true,
  webkit: { messageHandlers: { priPhoto: { postMessage(msg) { posted = msg; } } } }
};
const mod = await import(`../src/native/photo.js?test=${Date.now()}`);
assert.equal(mod.nativePhotoAvailable(), true);
const promise = mod.recognizePhoto('data:image/jpeg;base64,AA==', 1000);
assert.ok(posted?.reqId > 0);
assert.equal(posted.dataURL, 'data:image/jpeg;base64,AA==');
window.__priPhotoReceive({ reqId: posted.reqId, ok: true, text: 'x = 15', answer: '15', confidence: 0.91, engine: 'apple-vision-photo-v1' });
const result = await promise;
assert.equal(result.answer, '15');
assert.equal(result.engine, 'apple-vision-photo-v1');
console.log('PHOTO OCR BRIDGE — PASS');
'''
Path('client/test/photo-ocr-bridge-check.mjs').write_text(photo_test, encoding='utf-8')

# ── Question card: image becomes editable markable text ──────────────────────
q = 'client/src/components/QuestionCard.jsx'
once(q,
"import { clearDraft, queueDraft, readDraft } from './drafts.js';\n",
"import { clearDraft, queueDraft, readDraft } from './drafts.js';\nimport { nativePhotoAvailable, recognizePhoto } from '../native/photo.js';\n")

once(q,
"  const [photo, setPhoto] = useState(null);\n  const [elapsed, setElapsed] = useState(0);\n",
"  const [photo, setPhoto] = useState(null);\n  const [photoOCR, setPhotoOCR] = useState({ phase: 'idle', text: '', confidence: 0, error: '', engine: null });\n  const [elapsed, setElapsed] = useState(0);\n")

once(q,
"    setSelfMarks({}); setSelfSaved(false); setPhoto(null); setBookmarked(false); setElapsed(0);\n    setChecking(false); setVouched(null);\n",
"    setSelfMarks({}); setSelfSaved(false); setPhoto(null); setBookmarked(false); setElapsed(0);\n    setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null });\n    setChecking(false); setVouched(null);\n")

anchor = """  const recognitionContext = useMemo(\n    () => recognitionContextForQuestion(question),\n    [question.answerType]\n  );\n"""
addition = anchor + r'''

  const decodePhoto = useCallback(async (dataURL) => {
    if (!dataURL) return;
    if (!nativePhotoAvailable()) {
      setPhotoOCR({ phase: 'unavailable', text: '', confidence: 0, error: 'Native photo OCR is unavailable in this build.', engine: null });
      return;
    }
    setPhotoOCR({ phase: 'reading', text: '', confidence: 0, error: '', engine: null });
    try {
      const result = await recognizePhoto(dataURL);
      const text = String(result?.text || '').trim();
      const finalCandidate = String(result?.answer || '').trim();
      const fallbackFinal = text.split(/\n+/).map(s => s.trim()).filter(Boolean).at(-1) || '';
      const markable = finalCandidate || fallbackFinal;
      if (!text && !markable) throw new Error('No handwriting was detected in that photo.');
      if (isWorking && text) {
        setWorking(text);
        setShowWorking(true);
      }
      if (markable) setAnswer(markable);
      setPhotoOCR({
        phase: 'done', text, confidence: Number(result?.confidence || 0), error: '',
        engine: result?.engine || 'apple-vision-photo-v1'
      });
    } catch (err) {
      setPhotoOCR({ phase: 'failed', text: '', confidence: 0, error: err?.message || 'Photo handwriting could not be read.', engine: null });
    }
  }, [isWorking]);
'''
once(q, anchor, addition)

once(q,
"                      onChange={e => attachPhoto(e, setPhoto)} />\n",
"                      onChange={e => attachPhoto(e, setPhoto, decodePhoto)} />\n")

old_photo = '''                          <div className="photo-thumb"><img src={photo} alt="Paper working" /><button aria-label="Remove photo" onClick={() => setPhoto(null)}>✕</button></div>\n                          <span className="muted">Saved with this attempt. Type your final answer below so it can be marked.</span>\n'''
new_photo = '''                          <div className="photo-thumb"><img src={photo} alt="Paper working" /><button aria-label="Remove photo" onClick={() => { setPhoto(null); setPhotoOCR({ phase: 'idle', text: '', confidence: 0, error: '', engine: null }); }}>✕</button></div>\n                          <div style={{ flex: 1 }}>\n                            {photoOCR.phase === 'reading' && <span className="muted">Reading your handwriting on-device with Apple Vision…</span>}\n                            {photoOCR.phase === 'done' && (\n                              <>\n                                <div style={{ fontSize: 12.5, marginBottom: 6 }}><b>Decoded on-device</b>{photoOCR.confidence ? ` · ${Math.round(photoOCR.confidence * 100)}% OCR confidence` : ''}</div>\n                                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, font: 'inherit', color: 'var(--ink)' }}>{photoOCR.text}</pre>\n                                <div className="muted" style={{ marginTop: 6 }}>Pri filled the answer box from the final recognised line. Check or edit it before marking.</div>\n                              </>\n                            )}\n                            {(photoOCR.phase === 'failed' || photoOCR.phase === 'unavailable') && <span style={{ color: 'var(--warn)' }}>{photoOCR.error}</span>}\n                            {photoOCR.phase === 'idle' && <span className="muted">Photo attached. Native Pri will decode it into editable maths before marking.</span>}\n                          </div>\n'''
once(q, old_photo, new_photo)

old_attach = '''function attachPhoto(e, setPhoto) {\n  const f = e.target.files?.[0];\n  if (!f) return;\n  const img = new Image();\n  const url = URL.createObjectURL(f);\n  img.onload = () => {\n    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));\n    const cv = document.createElement('canvas');\n    cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);\n    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);\n    setPhoto(cv.toDataURL('image/jpeg', 0.82));\n    URL.revokeObjectURL(url);\n  };\n  img.src = url;\n  e.target.value = '';\n}\n'''
new_attach = '''function attachPhoto(e, setPhoto, onReady) {\n  const f = e.target.files?.[0];\n  if (!f) return;\n  const img = new Image();\n  const url = URL.createObjectURL(f);\n  img.onload = () => {\n    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));\n    const cv = document.createElement('canvas');\n    cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);\n    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);\n    const dataURL = cv.toDataURL('image/jpeg', 0.88);\n    setPhoto(dataURL);\n    onReady?.(dataURL);\n    URL.revokeObjectURL(url);\n  };\n  img.onerror = () => URL.revokeObjectURL(url);\n  img.src = url;\n  e.target.value = '';\n}\n'''
once(q, old_attach, new_attach)

# ── Handwriting: answer-blind multi-engine arbitration ───────────────────────
i = 'client/src/ink/InkAnswer.jsx'
insert_marker = '''/**\n * lineVerdicts: optional array aligned with recognised lines, e.g.\n'''
helpers = r'''const normalizedReadingText = r => String(r?.text || '').replace(/\s+/g, '').toLowerCase();
const hasReading = r => !!r?.lines?.some(line => String(line?.text || '').trim());

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

function qualityOfReading(r) {
  if (!hasReading(r)) return -1;
  const sure = readingConfidence(r);
  const conf = Number.isFinite(sure.minConf) ? sure.minConf : 0.45;
  const margin = Number.isFinite(sure.margin) ? sure.margin : 0.10;
  return 0.74 * conf + 0.26 * Math.min(1, margin * 2.5) + (plausibleInkText(r) ? 0.08 : -0.20);
}

function strongReading(r) {
  if (!hasReading(r) || !plausibleInkText(r)) return false;
  const sure = readingConfidence(r);
  return sure.minConf >= 0.68 && sure.margin >= 0.10;
}

function chooseNativeConsensus(candidates) {
  const live = candidates.filter(hasReading);
  if (!live.length) return null;
  const groups = new Map();
  for (const r of live) {
    const key = normalizedReadingText(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const consensus = [...groups.values()].sort((a, b) => b.length - a.length || Math.max(...b.map(qualityOfReading)) - Math.max(...a.map(qualityOfReading)))[0];
  if (consensus.length >= 2) {
    const chosen = [...consensus].sort((a, b) => qualityOfReading(b) - qualityOfReading(a))[0];
    const engines = consensus.map(r => r.engine || 'unknown').join('+');
    return { ...chosen, engine: `pri-consensus:${engines}` };
  }
  return [...live].sort((a, b) => qualityOfReading(b) - qualityOfReading(a))[0];
}

'''
once(i, insert_marker, helpers + insert_marker)

pattern = r'''    // iPad native wrapper: first ask the Pri-owned Core ML foundation model\.\n.*?    \}\);\n  \}, \[publish, recognitionContext\]\);'''
replacement = r'''    // Native iPad: Foundation is one opinion, not an oracle. The current
    // learned checkpoint is still data-limited, so a non-empty reading is not
    // enough to trust it. Compare it with Pri's independent JS stroke engine;
    // disagreement or weak confidence asks the native rescue reader for a third
    // answer-blind vote. Two matching engines win; otherwise the best calibrated
    // reading is shown and the existing confirmation gate still protects marks.
    nativeInk.foundationRecognize(ovr, recognitionContext).then(foundation => {
      if (seq !== readSeqRef.current) return;
      const localRaw = readWithJS();
      const local = localRaw ? { ...localRaw, engine: 'pri-js-v3' } : null;

      if (hasReading(foundation) && hasReading(local) && normalizedReadingText(foundation) === normalizedReadingText(local)) {
        publish({ ...foundation, engine: `pri-consensus:${foundation.engine || 'foundation'}+pri-js-v3` }, strokes);
        return;
      }
      if (hasReading(foundation) && strongReading(foundation) && !hasReading(local)) {
        publish(foundation, strokes);
        return;
      }
      if (!hasReading(foundation) && hasReading(local) && strongReading(local)) {
        publish(local, strokes);
        return;
      }

      nativeInk.recognize(ovr, recognitionContext).then(nativeRaw => {
        if (seq !== readSeqRef.current) return;
        const nativeReading = nativeRaw
          ? readUnreadLines(nativeRaw, strokes, ovr, recognitionContext)
          : null;
        const chosen = chooseNativeConsensus([foundation, local, nativeReading]);
        publish(chosen || { ...EMPTY_READING, engine: 'pri-native-no-reading' }, strokes);
      });
    });
  }, [publish, recognitionContext]);'''
regex_once(i, pattern, replacement)

once(i,
"      : rec.engine === 'pri-js-v3'\n        ? 'Legacy JS V3 fallback · not native PencilKit/Core ML'\n        : null;\n",
"      : rec.engine === 'pri-js-v3'\n        ? 'Legacy JS V3 fallback · not native PencilKit/Core ML'\n        : NATIVE_INK && rec.engine\n          ? `Native recognition path · ${rec.engine}`\n          : null;\n")

# ── Native Apple Vision photo recogniser ─────────────────────────────────────
photo_swift = r'''import Foundation
import UIKit
import Vision
import WebKit

// Native, offline photo handwriting reader. Vision is deliberately treated as
// an OCR candidate generator, not a marker: the web layer exposes/editable text
// and never auto-submits what Vision guessed.
final class PhotoOCRBridge {
    private let queue = DispatchQueue(label: "com.prilearning.photo.ocr", qos: .userInitiated)

    func handle(_ body: Any, webView: WKWebView?) {
        guard let message = body as? [String: Any],
              let req = message["reqId"] as? NSNumber,
              let dataURL = message["dataURL"] as? String else { return }
        let reqId = req.intValue
        queue.async { [weak webView] in
            do {
                let result = try Self.recognize(dataURL: dataURL)
                self.emit([
                    "reqId": reqId, "ok": true, "text": result.text,
                    "answer": result.answer, "confidence": result.confidence,
                    "lines": result.lines, "engine": "apple-vision-photo-v1"
                ], to: webView)
            } catch {
                self.emit([
                    "reqId": reqId, "ok": false,
                    "error": error.localizedDescription,
                    "engine": "apple-vision-photo-v1"
                ], to: webView)
            }
        }
    }

    private struct OCRResult {
        let text: String
        let answer: String
        let confidence: Double
        let lines: [[String: Any]]
    }

    private enum OCRError: LocalizedError {
        case badImage, noText
        var errorDescription: String? {
            switch self {
            case .badImage: return "That photo could not be decoded. Try retaking it closer to the page."
            case .noText: return "No readable handwriting was found. Try brighter light and fill more of the frame with the working."
            }
        }
    }

    private static func recognize(dataURL: String) throws -> OCRResult {
        guard let comma = dataURL.firstIndex(of: ","),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]), options: .ignoreUnknownCharacters),
              let image = UIImage(data: data), let cgImage = image.cgImage else { throw OCRError.badImage }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US"]
        request.customWords = ["sin", "cos", "tan", "theta", "sqrt", "pi", "log", "ln", "dx", "dy"]
        request.minimumTextHeight = 0.010
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        try handler.perform([request])

        let observations = (request.results ?? []).sorted { a, b in
            if abs(a.boundingBox.midY - b.boundingBox.midY) > 0.025 { return a.boundingBox.midY > b.boundingBox.midY }
            return a.boundingBox.minX < b.boundingBox.minX
        }
        var lines: [[String: Any]] = []
        var texts: [String] = []
        var confidences: [Double] = []
        for observation in observations {
            guard let top = observation.topCandidates(3).first else { continue }
            let text = normalizeMath(top.string)
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            let conf = Double(top.confidence)
            texts.append(text)
            confidences.append(conf)
            lines.append([
                "text": text, "confidence": conf,
                "box": ["x": observation.boundingBox.minX, "y": observation.boundingBox.minY,
                        "w": observation.boundingBox.width, "h": observation.boundingBox.height]
            ])
        }
        guard !texts.isEmpty else { throw OCRError.noText }
        let joined = texts.joined(separator: "\n")
        let answer = answerCandidate(from: texts)
        let confidence = confidences.reduce(0, +) / Double(max(confidences.count, 1))
        return OCRResult(text: joined, answer: answer, confidence: confidence, lines: lines)
    }

    private static func normalizeMath(_ raw: String) -> String {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        for (a, b) in [("−", "-"), ("–", "-"), ("—", "-"), ("×", "*"), ("·", "*"), ("÷", "/"), ("＝", "=")] {
            s = s.replacingOccurrences(of: a, with: b)
        }
        s = s.replacingOccurrences(of: #"\s*([=+\-*/<>])\s*"#, with: "$1", options: .regularExpression)
        return s
    }

    private static func answerCandidate(from lines: [String]) -> String {
        guard var last = lines.reversed().first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else { return "" }
        last = last.replacingOccurrences(of: #"^(?i)\s*(ans(?:wer)?\s*[:=]\s*)"#, with: "", options: .regularExpression)
        if let eq = last.lastIndex(of: "=") {
            let rhs = String(last[last.index(after: eq)...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !rhs.isEmpty { return rhs }
        }
        return last.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func emit(_ payload: [String: Any], to webView: WKWebView?) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              var json = String(data: data, encoding: .utf8) else { return }
        json = json.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                   .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        DispatchQueue.main.async { [weak webView] in
            webView?.evaluateJavaScript("window.__priPhotoReceive && window.__priPhotoReceive(\(json));")
        }
    }
}
'''
for base in ['ios/PriLearning.swiftpm', 'ios/PriLearning 2.swiftpm']:
    Path(base, 'PhotoOCR.swift').write_text(photo_swift, encoding='utf-8')

# WebShell registers and routes the bridge. Apply byte-identically to both packages.
for w in ['ios/PriLearning.swiftpm/WebShell.swift', 'ios/PriLearning 2.swiftpm/WebShell.swift']:
    once(w,
    'source: "window.__PRI_NATIVE__ = true; window.__PRI_NATIVE_INK__ = true;",',
    'source: "window.__PRI_NATIVE__ = true; window.__PRI_NATIVE_INK__ = true; window.__PRI_NATIVE_PHOTO__ = true;",')
    once(w,
    '        config.userContentController.add(context.coordinator, name: "priInk")\n',
    '        config.userContentController.add(context.coordinator, name: "priInk")\n        config.userContentController.add(context.coordinator, name: "priPhoto")\n')
    once(w,
    '        private var downloadDestination: URL?\n\n        // ── Native ink ──\n',
    '        private var downloadDestination: URL?\n        private weak var shellWebView: WKWebView?\n        private let photoOCR = PhotoOCRBridge()\n\n        // ── Native ink ──\n')
    once(w,
    '        func attachInk(to webView: WKWebView, in container: UIView) {\n            ink.attach(to: webView, in: container)\n',
    '        func attachInk(to webView: WKWebView, in container: UIView) {\n            shellWebView = webView\n            ink.attach(to: webView, in: container)\n')
    once(w,
    '        func detachInk() {\n            scrollObservation?.invalidate()\n            scrollObservation = nil\n        }\n',
    '        func detachInk() {\n            scrollObservation?.invalidate()\n            scrollObservation = nil\n            shellWebView = nil\n        }\n')
    once(w,
    '            if message.name == "priInk" {\n                ink.handle(message.body)\n                return\n            }\n',
    '            if message.name == "priInk" {\n                ink.handle(message.body)\n                return\n            }\n            if message.name == "priPhoto" {\n                photoOCR.handle(message.body, webView: shellWebView)\n                return\n            }\n')

for p in ['ios/PriLearning.swiftpm/Package.swift', 'ios/PriLearning 2.swiftpm/Package.swift']:
    once(p,
    '.camera(purposeString: "Attach a photo of your paper working to a saved attempt.")',
    '.camera(purposeString: "Photograph handwritten maths so Pri can read it on-device and attach it to your attempt.")')

# Add the web bridge to the normal regression chain.
pkg = 'package.json'
once(pkg,
'&& npm run test:context && npm run test:ink:bridge && npm run test:ink:interaction',
'&& npm run test:context && npm run test:ink:bridge && npm run test:photo:bridge && npm run test:ink:interaction')
once(pkg,
'    "test:ink:bridge": "node client/test/native-ink-check.mjs",\n',
'    "test:ink:bridge": "node client/test/native-ink-check.mjs",\n    "test:photo:bridge": "node client/test/photo-ocr-bridge-check.mjs",\n')

print('PHOTO OCR + HANDWRITING CONSENSUS PATCH APPLIED')
