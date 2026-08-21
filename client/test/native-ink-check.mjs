// ─────────────────────────────────────────────────────────────────────────────
// Native ink bridge contract.
//
// The writing surface in the iPad app is native and the page talks to it by
// posting messages. Those two halves are written in different languages, live
// in different directories, and are compiled by different toolchains — so
// nothing but a test will notice the day one of them is changed and the other
// is not, and the symptom would be a student's handwriting silently going
// nowhere.
//
// This reads BOTH sides: it drives client/src/ink/native.js against a stub of
// the shell, and checks every op it sends against the ops InkBridge.swift
// actually handles.
//
// Usage: node client/test/native-ink-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE_SWIFT = join(HERE, '../../ios/PriLearning.swiftpm/Ink/InkBridge.swift');

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
nativeInk.setStrokes([{ points: [{ x: 1, y: 2, w: 3 }] }]);
nativeInk.layout(inkWrap);
nativeInk.setAppearance();
nativeInk.unmount();
check('tool carries both the tool and the finger setting',
  posted[0].op === 'tool' && posted[0].tool === 'eraser' && posted[0].finger === true);
check('enabled is a boolean', posted[1].op === 'enabled' && posted[1].enabled === false);
check('strokes are sent as {points:[{x,y,w}]}',
  posted[5].op === 'setStrokes' && posted[5].strokes[0].points[0].x === 1);

// ── recognition round trip ───────────────────────────────────────────────────
posted.length = 0;
const pending = nativeInk.recognize({ n0_2: 'x' });
const request = posted[0];
check('recognize sends a request id and the corrections so far',
  request.op === 'recognize' && Number.isInteger(request.reqId)
  && request.overrides.n0_2 === 'x');

window.__priInkReceive({ type: 'reading', reqId: request.reqId, text: 'x=3', lines: [] });
const reading = await pending;
check('a reply resolves the matching request', reading?.text === 'x=3');

const stray = nativeInk.recognize({});
window.__priInkReceive({ type: 'reading', reqId: 99999, text: 'wrong', lines: [] });
window.__priInkReceive({ type: 'reading', reqId: posted[1].reqId, text: 'right', lines: [] });
check('a reply for another request is ignored', (await stray)?.text === 'right');

// ── stroke transport ─────────────────────────────────────────────────────────
let heard = null;
const stop = nativeInk.onStrokes(s => { heard = s; });
const first = { points: [{ x: 1, y: 2, w: 3 }] };
const second = { points: [{ x: 4, y: 5, w: 2 }] };
const replacement = { points: [{ x: 9, y: 9, w: 1 }] };
window.__priInkReceive({ type: 'strokes', strokes: [first] });
check('full stroke snapshots reach the listener', heard?.length === 1 && heard[0] === first);
window.__priInkReceive({ type: 'strokeDelta', index: 1, stroke: second });
check('an append delta reconstructs the full page in JS',
  heard?.length === 2 && heard[0] === first && heard[1] === second);
window.__priInkReceive({ type: 'strokeDelta', index: 0, stroke: replacement });
check('a replacement delta updates one stroke without dropping the rest',
  heard?.length === 2 && heard[0] === replacement && heard[1] === second);
window.__priInkReceive({ type: 'strokeDelta', index: 4, stroke: first });
check('a gapped delta is rejected instead of inventing missing ink', heard?.length === 2);
stop();
window.__priInkReceive({ type: 'strokes', strokes: [] });
check('a removed listener stops hearing', heard?.length === 2);

// ── both sides of the contract ───────────────────────────────────────────────
const swift = readFileSync(BRIDGE_SWIFT, 'utf8');
const handled = new Set([...swift.matchAll(/case\s+"([a-zA-Z]+)"/g)].map(m => m[1]));
const sent = new Set([
  'mount', 'layout', 'unmount', 'appearance', 'tool', 'enabled',
  'undo', 'redo', 'clear', 'setStrokes', 'recognize'
]);
for (const op of sent) {
  check(`the shell handles "${op}"`, handled.has(op),
    `InkBridge.swift has no case for it`);
}
// And the page must actually send everything this list claims.
const source = readFileSync(join(HERE, '../src/ink/native.js'), 'utf8');
for (const op of sent) {
  check(`the page sends "${op}"`, source.includes(`op: '${op}'`));
}
check('the page understands incremental native stroke transport', source.includes("payload.type === 'strokeDelta'"));

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} problem(s)`}`);
process.exit(failures === 0 ? 0 : 1);
