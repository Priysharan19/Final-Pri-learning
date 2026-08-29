#!/usr/bin/env node
// Pri Learning · robust physical-iPad OpenAI handwriting installer (v2)
//
// This installer is deliberately idempotent and tolerant of EOF/newline
// differences. It patches the canonical native iPad package so the path is:
// PencilKit → Swift raster → Pri gateway → OpenAI → InkAnswer.

import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, text) { writeFileSync(path, text); }
function ok(label) { console.log(`✓ ${label}`); }
function fail(label, path) {
  console.error(`✗ ${label}: expected source anchor not found in ${path}`);
  process.exit(2);
}
function replace(path, oldText, newText, label) {
  let text = read(path);
  if (text.includes(newText)) { ok(`${label} already installed`); return; }
  if (!text.includes(oldText)) fail(label, path);
  text = text.replace(oldText, newText);
  write(path, text);
  ok(label);
}

// 1) PencilKit: emit completed drawing only after the active Pencil settles.
replace(
  'ios/PriLearning.swiftpm/Ink/InkSurface.swift',
`    private var suppressChangeEvents = false
    private let historyLimit = 60`,
`    private var suppressChangeEvents = false
    private let historyLimit = 60

    // Authoritative PencilKit change signal. Debounced so JSON/recognition work
    // never competes with the active low-latency Pencil rendering path.
    private var pendingStrokeNotification: DispatchWorkItem?`,
  'PencilKit reliable stroke delivery'
);

replace(
  'ios/PriLearning.swiftpm/Ink/InkSurface.swift',
`    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        guard !suppressChangeEvents else { return }
        delegate?.inkSurfaceDidChangeStrokes(self)
    }`,
`    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        guard !suppressChangeEvents else { return }
        scheduleStrokeNotification(after: 0.18)
    }

    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        guard !suppressChangeEvents else { return }
        scheduleStrokeNotification(after: 0.06)
    }

    private func scheduleStrokeNotification(after delay: TimeInterval) {
        pendingStrokeNotification?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.suppressChangeEvents else { return }
            self.delegate?.inkSurfaceDidChangeStrokes(self)
        }
        pendingStrokeNotification = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }`,
  'PencilKit quiet-period stroke notification'
);

replace(
  'ios/PriLearning.swiftpm/Ink/InkSurface.swift',
`    private func replaceDrawing(_ drawing: PKDrawing) {
        suppressChangeEvents = true
        canvas.drawing = drawing
        suppressChangeEvents = false
        delegate?.inkSurfaceDidChangeStrokes(self)
    }`,
`    private func replaceDrawing(_ drawing: PKDrawing) {
        pendingStrokeNotification?.cancel()
        suppressChangeEvents = true
        canvas.drawing = drawing
        suppressChangeEvents = false
        delegate?.inkSurfaceDidChangeStrokes(self)
    }`,
  'PencilKit programmatic-change notification'
);

// 2) Swift bridge: native cloud transport.
replace(
  'ios/PriLearning.swiftpm/Ink/InkBridge.swift',
`    private let foundationRecognizer = InkFoundationPageRecognizer()
    private let recognizer = MathInkRecognizer()`,
`    private let foundationRecognizer = InkFoundationPageRecognizer()
    private let recognizer = MathInkRecognizer()
    private let cloudRecognizer = NativeCloudInkClient()`,
  'native cloud recogniser property'
);

replace(
  'ios/PriLearning.swiftpm/Ink/InkBridge.swift',
`        case "recognize":
            let requestId = message["reqId"] as? Int ?? 0
            let overrides = message["overrides"] as? [String: String] ?? [:]
            recognize(requestId: requestId, overrides: overrides)

        default:`,
`        case "recognize":
            let requestId = message["reqId"] as? Int ?? 0
            let overrides = message["overrides"] as? [String: String] ?? [:]
            recognize(requestId: requestId, overrides: overrides)

        case "cloudRecognize":
            let requestId = message["reqId"] as? Int ?? 0
            let endpoint = message["endpoint"] as? String ?? ""
            cloudRecognize(requestId: requestId, endpoint: endpoint)

        default:`,
  'native bridge cloudRecognize operation'
);

replace(
  'ios/PriLearning.swiftpm/Ink/InkBridge.swift',
`    // MARK: - Messages to the page`,
`    private func cloudRecognize(requestId: Int, endpoint: String) {
        let strokes = surface.strokes
        let revision = revisionSnapshot()

        cloudRecognizer.recognise(strokes: strokes, endpoint: endpoint) { [weak self] result in
            guard let self else { return }

            guard self.revisionIsCurrent(revision) else {
                var stale = self.emptyReadingPayload(requestId: requestId, engine: "openai-native-cloud-stale")
                stale["cloud"] = true
                DispatchQueue.main.async { self.emit(stale) }
                return
            }

            switch result {
            case .success(var payload):
                payload["type"] = "reading"
                payload["reqId"] = requestId
                payload["cloud"] = true
                DispatchQueue.main.async { self.emit(payload) }

            case .failure(let error):
                var failed = self.emptyReadingPayload(requestId: requestId, engine: "openai-native-cloud-failed")
                failed["cloud"] = true
                failed["failure"] = error.localizedDescription
                DispatchQueue.main.async { self.emit(failed) }
            }
        }
    }

    // MARK: - Messages to the page`,
  'native Swift cloud request implementation'
);

// 3) JavaScript native bridge. Do not depend on a trailing newline at EOF.
replace(
  'client/src/ink/native.js',
`  const base = op === 'foundationRecognize' ? 'pri-foundation' : 'native-rescue';`,
`  const base = op === 'foundationRecognize'
    ? 'pri-foundation'
    : op === 'cloudRecognize'
      ? 'openai-native-cloud'
      : 'native-rescue';`,
  'native cloud failure identity'
);

replace(
  'client/src/ink/native.js',
`  recognize(overrides = {}, context = null) {
    return requestReading({ op: 'recognize', overrides }, 14000, context);
  }
};`,
`  recognize(overrides = {}, context = null) {
    return requestReading({ op: 'recognize', overrides }, 14000, context);
  },

  /** Physical-iPad cloud OCR. Swift rasterises the PencilKit drawing and sends
   * it to Pri's server-side gateway. The OpenAI API key never enters the app. */
  cloudRecognize(endpoint, context = null) {
    const url = String(endpoint || '').trim();
    if (!url) return Promise.resolve(failedReading('cloudRecognize', 'endpoint-missing'));
    return requestReading({ op: 'cloudRecognize', endpoint: url }, 50000, context);
  }
};`,
  'native.js cloudRecognize API'
);

// 4) InkAnswer: physical iPad asks Swift to do cloud OCR. Local recognition
// remains alive as a fail-safe and OpenAI may supersede it when it succeeds.
replace(
  'client/src/ink/InkAnswer.jsx',
`const structuralLanExpected = () => !NATIVE_INK && typeof window !== 'undefined' && window.__PRI_LAN_DEV__ === true;`,
`const structuralLanExpected = () => !NATIVE_INK && typeof window !== 'undefined' && window.__PRI_LAN_DEV__ === true;
const configuredCloudEndpoint = () => {
  if (typeof window === 'undefined') return '';
  return String(
    window.__PRI_CLOUD_INK_ENDPOINT__ ||
    import.meta.env.VITE_PRI_CLOUD_INK_ENDPOINT ||
    ''
  ).trim();
};`,
  'InkAnswer native cloud endpoint resolver'
);

replace(
  'client/src/ink/InkAnswer.jsx',
`    if (!manualCorrectionActive && cloudInkConfigured()) {
      recognizeWithCloud(strokes).then(cloud => {
        if (seq !== readSeqRef.current || !cloud?.lines?.some(line => line.text)) return;
        if (cloud.needsConfirmation) return;
        cloudAccepted = true;
        publish(cloud, strokes);
      });
    }`,
`    if (!manualCorrectionActive && cloudInkConfigured()) {
      const cloudRead = NATIVE_INK
        ? nativeInk.cloudRecognize(configuredCloudEndpoint(), effectiveContext)
        : recognizeWithCloud(strokes);

      cloudRead.then(cloud => {
        if (seq !== readSeqRef.current || !cloud?.lines?.some(line => line.text)) return;

        // Show the actual OpenAI transcription even when it needs confirmation;
        // QuestionCard already owns the conservative confirmation gate.
        cloudAccepted = true;
        publish({ ...cloud, cloud: true }, strokes);
      });
    }`,
  'InkAnswer native Swift OpenAI authority'
);

// 5) Verification: fail before build if any bridge link is missing.
const checks = [
  ['ios/PriLearning.swiftpm/Ink/InkSurface.swift', 'canvasViewDrawingDidChange'],
  ['ios/PriLearning.swiftpm/Ink/InkBridge.swift', 'cloudRecognize(requestId:'],
  ['client/src/ink/native.js', 'cloudRecognize(endpoint'],
  ['client/src/ink/InkAnswer.jsx', 'nativeInk.cloudRecognize'],
  ['ios/PriLearning.swiftpm/Ink/NativeCloudInkClient.swift', 'final class NativeCloudInkClient']
];
for (const [path, needle] of checks) {
  if (!read(path).includes(needle)) fail(`verification ${needle}`, path);
}

console.log('\n✓ Native cloud handwriting v2 installed and verified.');
console.log('  PencilKit → Swift PNG → Pri gateway → OpenAI → Pri Learning');
