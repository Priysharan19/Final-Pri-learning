#!/usr/bin/env node
// Pri Learning · deterministic native cloud handwriting patch installer
//
// Run only after restoring the four patched files from the current branch.
// This keeps the physical-iPad path auditable and avoids asking developers to
// hand-edit Swift/React during device testing.

import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, oldText, newText, label) {
  let text = readFileSync(path, 'utf8');
  if (text.includes(newText)) {
    console.log(`✓ ${label} already installed`);
    return;
  }
  if (!text.includes(oldText)) {
    console.error(`✗ ${label}: expected source anchor not found in ${path}`);
    process.exit(2);
  }
  text = text.replace(oldText, newText);
  writeFileSync(path, text);
  console.log(`✓ ${label}`);
}

// ── 1. PencilKit reliably emits a completed drawing without doing work while
// the Pencil is actively moving.
patch(
  'ios/PriLearning.swiftpm/Ink/InkSurface.swift',
`    private var suppressChangeEvents = false
    private let historyLimit = 60
`,
`    private var suppressChangeEvents = false
    private let historyLimit = 60

    // drawingDidChange is the authoritative PencilKit change signal. Debounce
    // delivery so encoding/recognition never competes with an active Pencil.
    private var pendingStrokeNotification: DispatchWorkItem?
`,
  'PencilKit reliable stroke delivery'
);

patch(
  'ios/PriLearning.swiftpm/Ink/InkSurface.swift',
`    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        guard !suppressChangeEvents else { return }
        delegate?.inkSurfaceDidChangeStrokes(self)
    }

    private func pushHistory() {
`,
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
    }

    private func pushHistory() {
`,
  'PencilKit quiet-period stroke notification'
);

patch(
  'ios/PriLearning.swiftpm/Ink/InkSurface.swift',
`    private func replaceDrawing(_ drawing: PKDrawing) {
        suppressChangeEvents = true
        canvas.drawing = drawing
        suppressChangeEvents = false
        delegate?.inkSurfaceDidChangeStrokes(self)
    }
`,
`    private func replaceDrawing(_ drawing: PKDrawing) {
        pendingStrokeNotification?.cancel()
        suppressChangeEvents = true
        canvas.drawing = drawing
        suppressChangeEvents = false
        delegate?.inkSurfaceDidChangeStrokes(self)
    }
`,
  'PencilKit programmatic-change notification'
);

// ── 2. Native Swift bridge owns the cloud transport. No WKWebView CORS/TLS or
// JavaScript rasterisation is involved on physical iPad.
patch(
  'ios/PriLearning.swiftpm/Ink/InkBridge.swift',
`    private let foundationRecognizer = InkFoundationPageRecognizer()
    private let recognizer = MathInkRecognizer()
    private let recognitionQueue = DispatchQueue(label: "com.prilearning.ink.recognize", qos: .userInitiated)
`,
`    private let foundationRecognizer = InkFoundationPageRecognizer()
    private let recognizer = MathInkRecognizer()
    private let cloudRecognizer = NativeCloudInkClient()
    private let recognitionQueue = DispatchQueue(label: "com.prilearning.ink.recognize", qos: .userInitiated)
`,
  'native cloud recogniser bridge property'
);

patch(
  'ios/PriLearning.swiftpm/Ink/InkBridge.swift',
`        case "recognize":
            let requestId = message["reqId"] as? Int ?? 0
            let overrides = message["overrides"] as? [String: String] ?? [:]
            recognize(requestId: requestId, overrides: overrides)

        default:
`,
`        case "recognize":
            let requestId = message["reqId"] as? Int ?? 0
            let overrides = message["overrides"] as? [String: String] ?? [:]
            recognize(requestId: requestId, overrides: overrides)

        case "cloudRecognize":
            let requestId = message["reqId"] as? Int ?? 0
            let endpoint = message["endpoint"] as? String ?? ""
            cloudRecognize(requestId: requestId, endpoint: endpoint)

        default:
`,
  'native bridge cloudRecognize operation'
);

patch(
  'ios/PriLearning.swiftpm/Ink/InkBridge.swift',
`    // MARK: - Messages to the page

    private func emit(_ payload: [String: Any]) {
`,
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

    // MARK: - Messages to the page

    private func emit(_ payload: [String: Any]) {
`,
  'native Swift cloud request implementation'
);

// ── 3. Web/native bridge exposes the new operation.
patch(
  'client/src/ink/native.js',
`function failedReading(op, failure) {
  const base = op === 'foundationRecognize' ? 'pri-foundation' : 'native-rescue';
`,
`function failedReading(op, failure) {
  const base = op === 'foundationRecognize'
    ? 'pri-foundation'
    : op === 'cloudRecognize'
      ? 'openai-native-cloud'
      : 'native-rescue';
`,
  'native bridge cloud failure identity'
);

patch(
  'client/src/ink/native.js',
`  recognize(overrides = {}, context = null) {
    return requestReading({ op: 'recognize', overrides }, 14000, context);
  }
};
`,
`  recognize(overrides = {}, context = null) {
    return requestReading({ op: 'recognize', overrides }, 14000, context);
  },

  /** Physical iPad cloud OCR. Swift rasterises the PencilKit drawing and sends
   * it to Pri's server-side gateway; the API key never enters this bundle. */
  cloudRecognize(endpoint, context = null) {
    const url = String(endpoint || '').trim();
    if (!url) return Promise.resolve(failedReading('cloudRecognize', 'endpoint-missing'));
    return requestReading({ op: 'cloudRecognize', endpoint: url }, 50000, context);
  }
};
`,
  'native.js cloudRecognize API'
);

// ── 4. InkAnswer uses native cloud transport on native iPad, but keeps local
// recognition alive as the fail-safe. A cloud result may supersede it later.
patch(
  'client/src/ink/InkAnswer.jsx',
`const EMPTY_READING = { lines: [], text: '', symbols: [], minConf: 1, margin: 1, weakest: null };
const structuralLanExpected = () => !NATIVE_INK && typeof window !== 'undefined' && window.__PRI_LAN_DEV__ === true;
`,
`const EMPTY_READING = { lines: [], text: '', symbols: [], minConf: 1, margin: 1, weakest: null };
const structuralLanExpected = () => !NATIVE_INK && typeof window !== 'undefined' && window.__PRI_LAN_DEV__ === true;
const configuredCloudEndpoint = () => {
  if (typeof window === 'undefined') return '';
  return String(
    window.__PRI_CLOUD_INK_ENDPOINT__ ||
    import.meta.env.VITE_PRI_CLOUD_INK_ENDPOINT ||
    ''
  ).trim();
};
`,
  'InkAnswer native cloud endpoint resolver'
);

patch(
  'client/src/ink/InkAnswer.jsx',
`    const manualCorrectionActive = Object.keys(ovr || {}).length > 0;
    if (!manualCorrectionActive && cloudInkConfigured()) {
      recognizeWithCloud(strokes).then(cloud => {
        if (seq !== readSeqRef.current || !cloud?.lines?.some(line => line.text)) return;
        if (cloud.needsConfirmation) return;
        cloudAccepted = true;
        publish(cloud, strokes);
      });
    }
`,
`    const manualCorrectionActive = Object.keys(ovr || {}).length > 0;
    if (!manualCorrectionActive && cloudInkConfigured()) {
      const cloudRead = NATIVE_INK
        ? nativeInk.cloudRecognize(configuredCloudEndpoint(), effectiveContext)
        : recognizeWithCloud(strokes);

      cloudRead.then(cloud => {
        if (seq !== readSeqRef.current || !cloud?.lines?.some(line => line.text)) return;

        // A real OpenAI reading is always more useful than hiding it behind a
        // garbage local fallback. Uncertainty remains encoded in minConf/margin
        // and QuestionCard asks the student to confirm before marking.
        cloudAccepted = true;
        publish({ ...cloud, cloud: true }, strokes);
      });
    }
`,
  'InkAnswer native Swift OpenAI authority'
);

console.log('\nNative cloud handwriting patch installed successfully.');
console.log('Physical iPad path: PencilKit → Swift PNG → Pri gateway → OpenAI → web result.');
