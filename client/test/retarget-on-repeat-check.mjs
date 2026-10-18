// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · re-targeting a served question when the server flags a repeat
//
// local/retargetOnRepeat.js is what stops a chapter-level request from being
// stuck on one cell smaller than the repeat window (issue #540). It is pure,
// so every path is pinned here with crafted replies and a scripted resolver:
//
//   1. a fresh first reply is kept as it is — one request, no re-resolution
//   2. a flagged repeat is asked again on a different cell with the same terms,
//      and the first fresh reply (with the cell it came from) is what is kept
//   3. re-resolutions that name the cell already asked, or nothing, are skipped
//   4. when every cell that can be asked repeats, the request's own reply
//      stands, flagged, and no more than `maxCells` cells are asked
//   5. a resolver that never names another cell spends `resolveTries` and stops
//   6. a device draft is never re-asked (its own draw already re-targeted),
//      nor is a request that cannot be re-resolved
//   7. a retry that comes back as a draft is kept with the cell it was asked on
//
// Usage: node client/test/retarget-on-repeat-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { serveAvoidingRepeat } from '../src/local/retargetOnRepeat.js';

let n = 0;
const ok = (condition, message) => { assert.ok(condition, message); n++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); n++; };

const cell = (generator, difficulty = 2, dotpointIndex = null) => ({ generator, difficulty, dotpointIndex, pyq: false, windowed: true });
/** A server that answers each cell from a script of replies, and remembers what it was asked. */
function server(script) {
  const asked = [];
  const serve = async target => {
    asked.push(target.generator);
    const reply = script[target.generator];
    assert.ok(reply, `the script has no reply for ${target.generator}`);
    return { q: { contentHash: `${target.generator}#${asked.length}` }, fields: {}, trapDelivered: false, ...reply };
  };
  return { serve, asked };
}
/** A resolver that returns the given cells in order, then null forever. */
function resolver(sequence) {
  let calls = 0;
  const retarget = () => { calls++; return sequence.length ? sequence.shift() : null; };
  return { retarget, get calls() { return calls; } };
}

// ── 1. A fresh reply is kept ────────────────────────────────────────────────
{
  const s = server({ roots: { repeat: false } });
  const r = resolver([cell('discriminant')]);
  const got = await serveAvoidingRepeat(s.serve, cell('roots'), r.retarget);
  eq(s.asked, ['roots'], 'a fresh reply costs one request');
  eq(r.calls, 0, 'and no re-resolution');
  eq([got.out.repeat, got.target.generator], [false, 'roots'], 'the reply and its own cell are kept');
}

// ── 2. A repeat is asked again on another cell; the fresh reply is kept ─────
{
  const s = server({ context: { repeat: true }, discriminant: { repeat: false } });
  const r = resolver([cell('discriminant')]);
  const got = await serveAvoidingRepeat(s.serve, cell('context'), r.retarget);
  eq(s.asked, ['context', 'discriminant'], 'the repeat is followed by one request on the other cell');
  eq([got.out.repeat, got.target.generator, got.out.q.contentHash], [false, 'discriminant', 'discriminant#2'], 'the fresh reply is kept, with the cell it came from');
}

// ── 3. Re-resolutions naming the same cell, or nothing, are skipped ─────────
{
  const s = server({ context: { repeat: true }, roots: { repeat: false } });
  const r = resolver([cell('context'), null, cell('context'), undefined, cell('roots')]);
  const got = await serveAvoidingRepeat(s.serve, cell('context'), r.retarget);
  eq(s.asked, ['context', 'roots'], 'the cell already asked is never asked twice');
  eq(r.calls, 5, 'the resolver was tried until it named a new cell');
  eq(got.target.generator, 'roots', 'and that cell is the one kept');
}

// ── 4. Every cell repeats: the request's own reply stands, flagged ──────────
{
  const s = server({ a: { repeat: true }, b: { repeat: true }, c: { repeat: true }, d: { repeat: true }, e: { repeat: false } });
  const r = resolver([cell('b'), cell('c'), cell('d'), cell('e')]);
  const got = await serveAvoidingRepeat(s.serve, cell('a'), r.retarget);
  eq(s.asked, ['a', 'b', 'c', 'd'], 'no more than maxCells (4) cells are asked, the first included');
  eq([got.out.repeat, got.target.generator, got.out.q.contentHash], [true, 'a', 'a#1'], 'the request\'s own reply is kept, still flagged as the repeat it is');
  // A smaller cap is honoured.
  const s2 = server({ a: { repeat: true }, b: { repeat: true }, c: { repeat: false } });
  const got2 = await serveAvoidingRepeat(s2.serve, cell('a'), resolver([cell('b'), cell('c')]).retarget, { maxCells: 2 });
  eq(s2.asked, ['a', 'b'], 'maxCells bounds the round trips');
  eq(got2.target.generator, 'a', 'and the own reply stands when the cells allowed all repeat');
}

// ── 5. A resolver that never names another cell stops after resolveTries ────
{
  const s = server({ context: { repeat: true } });
  const r = resolver(Array.from({ length: 50 }, () => cell('context')));
  const got = await serveAvoidingRepeat(s.serve, cell('context'), r.retarget);
  eq(s.asked, ['context'], 'a dot point with one cell is asked once');
  eq(r.calls, 8, 'the resolver is tried resolveTries (8) times and no more');
  eq(got.out.repeat, true, 'the flagged repeat is what the student is told about');
  const r2 = resolver(Array.from({ length: 50 }, () => cell('context')));
  await serveAvoidingRepeat(server({ context: { repeat: true } }).serve, cell('context'), r2.retarget, { resolveTries: 3 });
  eq(r2.calls, 3, 'resolveTries is honoured');
}

// ── 6. A draft, or a request that cannot be re-resolved, is never re-asked ──
{
  const s = server({ context: { repeat: true, fields: { draftOnly: true } } });
  const r = resolver([cell('roots')]);
  const got = await serveAvoidingRepeat(s.serve, cell('context'), r.retarget);
  eq([s.asked, r.calls, got.out.fields.draftOnly], [['context'], 0, true], 'a device draft is kept: its own draw already re-targeted');
  const s2 = server({ context: { repeat: true } });
  const got2 = await serveAvoidingRepeat(s2.serve, cell('context'), null);
  eq([s2.asked, got2.out.repeat], [['context'], true], 'with no resolver the flagged repeat is kept as it is');
}

// ── 7. A retry that comes back as a draft is kept with its cell ─────────────
{
  const s = server({ context: { repeat: true }, roots: { repeat: true, fields: { draftOnly: true } } });
  const got = await serveAvoidingRepeat(s.serve, cell('context'), resolver([cell('roots'), cell('discriminant')]).retarget);
  eq(s.asked, ['context', 'roots'], 'the connection went away mid-way: the draft ends the retries');
  eq([got.out.fields.draftOnly, got.target.generator], [true, 'roots'], 'and is kept with the cell it was asked on, so the row names the draft\'s own cell');
}

console.log(`RETARGET ON REPEAT: PASS — ${n} checks`);
