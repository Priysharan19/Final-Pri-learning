// Pri Learning · handwriting input metrics (CP-09). Opt-in, coordinate-free
// stroke measurement for the shared canvas. Run: node client/test/ink-input-metrics-check.mjs
import { strokeStarted, strokeMoved, strokeEnded, touchRejected } from '../src/ink/inputMetrics.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
const ev = (t, extra = {}) => ({ timeStamp: t, pointerType: 'pen', pressure: 0.7, clientX: 10, clientY: 20, ...extra });

// Off by default: nothing is recorded.
strokeStarted(ev(0)); strokeMoved(ev(8), [ev(4), ev(8)]); strokeEnded(ev(9), { kept: 3 }); touchRejected();
ok(globalThis.__PRI_INK_METRICS__ === undefined, 'metrics are off unless a host or test turns them on');

globalThis.__PRI_INK_METRICS_ENABLED__ = true;
strokeStarted(ev(100));
strokeMoved(ev(116), [ev(104), ev(108), ev(112), ev(116)]);
strokeMoved(ev(150), [ev(150)]); // a 34 ms gap
strokeEnded(ev(151), { kept: 5 });
const m = globalThis.__PRI_INK_METRICS__;
const s = m.strokes[0];
ok(s && s.pointerType === 'pen' && s.events === 3 && s.samples === 6 && s.keptPoints === 5, 'a stroke counts events, coalesced samples and kept points');
ok(s.maxGapMs === 34, `the largest gap between samples is measured (${s.maxGapMs})`);
ok(s.pressureVaried === false && typeof s.latencyP50Ms === 'number' && typeof s.latencyP95Ms === 'number', 'constant pressure is not "varied"; input-to-handler delay is recorded');
ok(!JSON.stringify(m).match(/"(x|y|clientX|clientY|points|text)"/), 'no coordinates, points or text are ever recorded');
strokeStarted(ev(200, { pointerType: 'touch', pressure: 0.5 })); strokeEnded(ev(210, { type: 'pointercancel' }), { cancelled: true, kept: 1 });
ok(m.strokes[1].pointerType === 'touch' && m.strokes[1].pressureVaried === false && m.cancels === 1, 'finger strokes and cancels are told apart');
touchRejected(); touchRejected();
ok(m.rejected.touchAfterPen === 2, 'palm/finger touches rejected after a pen are counted');
for (let i = 0; i < 260; i++) { strokeStarted(ev(i)); strokeEnded(ev(i + 1), { kept: 1 }); }
ok(m.strokes.length === 200, 'the record is bounded');
strokeMoved(ev(1), [ev(1)]); strokeEnded(ev(2));
ok(m.strokes.length === 200, 'moves without a started stroke are ignored');

// Varying pressure is detected.
strokeStarted(ev(300, { pressure: 0.2 })); strokeMoved(ev(310, { pressure: 0.8 }), [ev(305, { pressure: 0.5 }), ev(310, { pressure: 0.8 })]); strokeEnded(ev(311), { kept: 3 });
ok(m.strokes.at(-1).pressureVaried === true, 'pressure that varies is flagged as varied');
// A malformed global never makes the canvas lose a stroke: nothing throws.
globalThis.__PRI_INK_METRICS__ = {};
let threw = false;
try { strokeStarted(ev(400)); strokeMoved(ev(410), [ev(410)]); strokeEnded(ev(411), { kept: 2 }); touchRejected(); } catch { threw = true; }
ok(!threw && Array.isArray(globalThis.__PRI_INK_METRICS__.strokes) && globalThis.__PRI_INK_METRICS__.strokes.length === 1, 'a malformed metrics global is replaced, never thrown on');
globalThis.__PRI_INK_METRICS__ = { strokes: 'oops', rejected: null };
threw = false;
try { touchRejected(); strokeStarted(ev(1)); strokeEnded(ev(2)); } catch { threw = true; }
ok(!threw, 'every entry point swallows its own errors');

console.log(failures.length ? `INK INPUT METRICS: FAIL — ${failures.join('; ')}` : `INK INPUT METRICS: PASS — ${pass}/${pass} checks — opt-in, bounded, coordinate-free stroke metrics.`);
process.exit(failures.length ? 1 : 0);
