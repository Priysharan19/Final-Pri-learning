// ─────────────────────────────────────────────────────────────────────────────
// Native ink bridge contract.
//
// Reads BOTH sides of the JS ↔ Swift boundary. A renamed message, missing op or
// dropped Pencil feature must fail here rather than turn into silent handwriting
// loss in the app.
//
// Usage: node client/test/native-ink-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE_SWIFT = join(HERE, '../../ios/PriLearning.swiftpm/Ink/InkBridge.swift');
const STROKE_SWIFT = join(HERE, '../../ios/PriLearning.swiftpm/Ink/InkStroke.swift');
const SURFACE_SWIFT = join(HERE, '../../ios/PriLearning.swiftpm/Ink/InkSurface.swift');
const NATIVE_CANVAS = join(HERE, '../src/ink/NativeInkCanvas.jsx');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
};

// ── a stub of the shell and just enough DOM ──────────────────────────────────
const posted = [];
const rect = (x, y, w, h) => ({
  left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y
});

const topbar = { getBoundingClientRect: () => rect(0, 0, 1024, 54) };
const sidebar = { getBoundingClientRect: () => rect(0, 54, 47, 714) };
const scroller = {
  parentElement: null,
  getBoundingClientRect: () => rect(47, 54, 977, 714)
};
const inkWrap = {
  parentElement: scroller,
  getBoundingClientRect: () => rect(120, 240, 800, 380)
};

global.window = {
  __PRI_NATIVE_INK__: true,
  webkit: { messageHandlers: { priInk: { postMessage: (m) => posted.push(m) } } },
  innerWidth: 1024,
  innerHeight: 768,
  scrollX: 0,
  scrollY: 130
};
global.document = {
  documentElement: {},
  querySelector: (sel) => (sel === '.topbar' ? topbar : sel === '.sidebar' ? sidebar : null)
};
global.getComputedStyle = (node) => (node === scroller
  ? { overflowY: 'auto', overflowX: 'visible' }
  : { overflowY: 'visible', overflowX: 'visible', getPropertyValue: () => '#efece1' });
global.setTimeout = globalThis.setTimeout;

const { nativeInk, nativeInkAvailable } = await import('../src/ink/native.js');

console.log('Native ink bridge contract\n');

check('shell is detected', nativeInkAvailable() === true);
const savedInkHandler = window.webkit.messageHandlers.priInk;
delete window.webkit.messageHandlers.priInk;
check('missing native bridge fails closed as unavailable', nativeInkAvailable() === false);
window.webkit.messageHandlers.priInk = savedInkHandler;
check('restored native bridge becomes available again', nativeInkAvailable() === true);

// ── geometry ─────────────────────────────────────────────────────────────────
posted.length = 0;
nativeInk.mount(inkWrap);
const mount = posted[0];
check('mount posts a frame in viewport coordinates',
  mount?.op === 'mount' && mount.frame.x === 120 && mount.frame.y === 240
  && mount.frame.w === 800 && mount.frame.h === 380,
  JSON.stringify(mount?.frame));
check('mount clips below the top bar and right of the sidebar',
  mount?.clip.x === 47 && mount.clip.y === 54 && mount.clip.w === 977 && mount.clip.h === 714,
  JSON.stringify(mount?.clip));
check('mount reports the scroll position the frame was measured at',
  mount?.scrollX === 0 && mount?.scrollY === 130);
check('mount carries the pen colour', /^#[0-9a-f]{6}$/i.test(mount?.ink || ''), mount?.ink);
check('every number posted is finite',
  [mount.frame, mount.clip].every(r => Object.values(r).every(Number.isFinite)));

// ── toolbar and history ──────────────────────────────────────────────────────
posted.length = 0;
nativeInk.setTool('eraser', true);
nativeInk.setEnabled(false);
nativeInk.undo(); nativeInk.redo(); nativeInk.clear();
nativeInk.setStrokes([{ points: [{ x: 1, y: 2, w: 3, t: 0.01, p: 0.7, azimuth: 1.1, altitude: 0.9 }] }]);
nativeInk.layout(inkWrap);
nativeInk.setAppearance();
nativeInk.unmount();
check('tool carries both the tool and the finger setting',
  posted[0].op === 'tool' && posted[0].tool === 'eraser' && posted[0].finger === true);
check('enabled is a boolean', posted[1].op === 'enabled' && posted[1].enabled === false);
check('stroke metadata survives the page → native message',
  posted[5].op === 'setStrokes'
  && posted[5].strokes[0].points[0].x === 1
  && posted[5].strokes[0].points[0].p === 0.7
  && posted[5].strokes[0].points[0].azimuth === 1.1);

// ── no read op: the shell captures, the server reads ────────────────────────
posted.length = 0;
check('the page has no native read op (recognition is on the server)',
  nativeInk.recognize === undefined && nativeInk.foundationRecognize === undefined && posted.length === 0);
check('a stray native reading message is ignored, never resolved into anything',
  (() => { try { window.__priInkReceive({ type: 'reading', reqId: 7, text: 'x=3', lines: [] }); return true; } catch { return false; } })());

let heard = null;
const stop = nativeInk.onStrokes(s => { heard = s; });
window.__priInkReceive({ type: 'strokes', strokes: [{ points: [] }, { points: [] }] });
check('stroke updates reach the listener', heard?.length === 2);
stop();
window.__priInkReceive({ type: 'strokes', strokes: [] });
check('a removed listener stops hearing', heard?.length === 2);

// ── Native React lifecycle must never control PencilKit by callback identity ─
const nativeCanvasSource = readFileSync(NATIVE_CANVAS, 'utf8');
check('native canvas keeps the latest parent stroke callback behind a ref',
  nativeCanvasSource.includes('onStrokesChangeRef.current = onStrokesChange')
  && nativeCanvasSource.includes('onStrokesChangeRef.current?.(strokes)'));
check('stroke notifications do not force a redundant React render',
  !nativeCanvasSource.includes('force(x => x + 1)')
  && !nativeCanvasSource.includes('useState(0)'));
check('native mount listener has stable callback identity',
  nativeCanvasSource.includes('const notify = useCallback((strokes) =>')
  && nativeCanvasSource.includes('}, []);'));

// ── full Pencil signal is part of the native data contract ───────────────────
const strokeSwift = readFileSync(STROKE_SWIFT, 'utf8');
for (const field of ['"t"', '"p"', '"azimuth"', '"altitude"']) {
  check(`native strokes export ${field}`, strokeSwift.includes(`${field}:`));
}

// ── Apple Pencil routing must be stateless and Pencil-first ──────────────────
const surfaceSwift = readFileSync(SURFACE_SWIFT, 'utf8');
check('native surface no longer uses a stateful pencilSeen gate',
  !surfaceSwift.includes('pencilSeen'));
check('default native drawing policy is Pencil-only',
  surfaceSwift.includes('canvas.drawingPolicy = fingerDrawingEnabled ? .anyInput : .pencilOnly'));
check('explicit Pencil touches are always routed to PencilKit',
  surfaceSwift.includes("$0.type == .pencil") && surfaceSwift.includes('return hit'));
check('empty hover/hit-test events do not reject the next Pencil contact',
  surfaceSwift.includes('return hit') && surfaceSwift.includes('allTouches'));
check('Pencil-down invalidates any whole-page read immediately',
  surfaceSwift.includes('func canvasViewDidBeginUsingTool')
  && surfaceSwift.includes('delegate?.inkSurfaceDidBeginStroke(self)'));

// ── both sides of the message contract ──────────────────────────────────────
const swift = readFileSync(BRIDGE_SWIFT, 'utf8');
const handled = new Set([...swift.matchAll(/case\s+"([a-zA-Z]+)"/g)].map(m => m[1]));
const sent = new Set([
  'mount', 'layout', 'unmount', 'appearance', 'tool', 'enabled',
  'undo', 'redo', 'clear', 'setStrokes'
]);
for (const op of sent) {
  check(`the shell handles "${op}"`, handled.has(op),
    `InkBridge.swift has no case for it`);
}
check('the shell handles exactly the ops the page may send (no read op on either side)',
  [...handled].every(op => sent.has(op)), `extra cases in InkBridge.swift: ${[...handled].filter(op => !sent.has(op)).join(', ')}`);
const source = readFileSync(join(HERE, '../src/ink/native.js'), 'utf8');
for (const op of sent) {
  check(`the page sends "${op}"`, source.includes(`op: '${op}'`));
}
const platformIndex = readFileSync(join(HERE, '../src/platform/native/index.js'), 'utf8');
check('the answer-blind allowlist names the same ops and no read op',
  [...sent].every(op => platformIndex.includes(`'${op}'`)) && !/foundationRecognize|'recognize'|overrides/.test(platformIndex));
check('external setStrokes input is copied once at the bridge boundary',
  source.includes('latestStrokes = snapshotInkStrokes(strokes);'));
check('the page keeps no recogniser imports',
  !/hybrid\.js|setNotation\.js|trigNotation\.js|requestReading|failedReading/.test(source));

// ── nothing native reads ink: Vision and Core ML are out of the target ──────
const inkDir = join(HERE, '../../ios/PriLearning.swiftpm/Ink');
const inkFiles = readdirSync(inkDir).filter(n => n.endsWith('.swift')).sort();
check('the Ink target holds the surface, the stroke model, the bridge, the self-check and the demo driver only',
  JSON.stringify(inkFiles) === JSON.stringify(['InkBridge.swift', 'InkDemoDriver.swift', 'InkSelfCheck.swift', 'InkStroke.swift', 'InkSurface.swift']),
  inkFiles.join(', '));
for (const name of inkFiles) {
  const text = readFileSync(join(inkDir, name), 'utf8');
  check(`${name} imports neither Vision nor CoreML`, !/^import (Vision|CoreML)$/m.test(text));
}
check('InkBridge.swift has no read op and no recogniser',
  !/case "(recognize|foundationRecognize)"|MathInkRecognizer|InkFoundationPageRecognizer|cancelActiveVision|^import (Vision|CoreML)$/m.test(swift));
check('the self-check scores capture fidelity, not a reader',
  readFileSync(join(inkDir, 'InkSelfCheck.swift'), 'utf8').includes('capture fidelity:')
  && !/MathInkRecognizer|character accuracy/.test(readFileSync(join(inkDir, 'InkSelfCheck.swift'), 'utf8')));
check('the stroke-begin hook stays so a new mark is seen at pen-down',
  swift.includes('func inkSurfaceDidBeginStroke(_ surface: InkSurfaceView)'));

// ── release configuration belongs to the same native trust boundary ─────────
const packageRoot = join(HERE, '../../ios/PriLearning.swiftpm');
const duplicateRoot = join(HERE, '../../ios/PriLearning 2.swiftpm');
const packageSwift = readFileSync(join(packageRoot, 'Package.swift'), 'utf8');
const duplicatePackageSwift = readFileSync(join(duplicateRoot, 'Package.swift'), 'utf8');
const infoPlist = readFileSync(join(packageRoot, 'Info.plist'), 'utf8');
const duplicateInfoPlist = readFileSync(join(duplicateRoot, 'Info.plist'), 'utf8');
const webShell = readFileSync(join(packageRoot, 'WebShell.swift'), 'utf8');
const duplicateWebShell = readFileSync(join(duplicateRoot, 'WebShell.swift'), 'utf8');
const iconManifest = readFileSync(join(packageRoot, 'Assets.xcassets/AppIcon.appiconset/Contents.json'), 'utf8');
const duplicateIconManifest = readFileSync(join(duplicateRoot, 'Assets.xcassets/AppIcon.appiconset/Contents.json'), 'utf8');
const icon = readFileSync(join(packageRoot, 'Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'));
const duplicateIcon = readFileSync(join(duplicateRoot, 'Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'));

check('native packages keep identical release manifests', packageSwift === duplicatePackageSwift);
check('no model asset is bundled (reading is on the server)', !packageSwift.includes('Resources/Models') && !existsSync(join(packageRoot, 'Resources/Models')));
check('release package never falls back to a placeholder app icon',
  !packageSwift.includes('.placeholder(') && packageSwift.includes('appIcon: .asset("AppIcon")'));
check('the AppIcon asset catalog is processed by SwiftPM', packageSwift.includes('.process("Assets.xcassets")'));
check('native packages keep identical release plist configuration', infoPlist === duplicateInfoPlist);
check('native cloud origin remains build-supplied and fail-closed',
  infoPlist.includes('<key>PRICloudOrigin</key>') && infoPlist.includes('$(PRI_CLOUD_ORIGIN)'));
check('export-compliance declaration remains explicit',
  /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(infoPlist));
check('native packages keep identical AppIcon manifests', iconManifest === duplicateIconManifest);
const iconJson = JSON.parse(iconManifest);
check('AppIcon manifest declares the production 1024px iOS source',
  iconJson.images?.some(entry => entry.filename === 'AppIcon-1024.png'
    && entry.idiom === 'universal' && entry.platform === 'ios' && entry.size === '1024x1024'));
check('native packages keep byte-identical AppIcon images', icon.equals(duplicateIcon));
check('AppIcon is a real 1024×1024 PNG',
  icon.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  && icon.readUInt32BE(16) === 1024 && icon.readUInt32BE(20) === 1024);
check('AppIcon source is opaque RGB rather than alpha-dependent artwork', icon[25] === 2, `PNG colour type ${icon[25]}`);
check('duplicate native shell remains byte-identical', webShell === duplicateWebShell);
const debugInspector = /#if DEBUG[\s\S]*?webView\.isInspectable = true[\s\S]*?#endif/.exec(webShell)?.[0] || '';
check('Web Inspector is debug-only', Boolean(debugInspector));
check('release shell has no inspectability assignment outside DEBUG',
  !webShell.replace(debugInspector, '').includes('isInspectable'));

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} problem(s)`}`);
process.exit(failures === 0 ? 0 : 1);
