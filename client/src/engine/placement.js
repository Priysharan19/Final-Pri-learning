// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Placement diagnostic engine.
//
// About ten questions (never more than twelve) that estimate where a student is
// working, strand by strand, and trace a miss back down the prerequisite graph
// (engine/prerequisites.js) to the earliest chapter that also fails — the
// plausible root of the gap. A Class 11 student who misses a limits question and
// then misses Class 8 factorisation, while getting the Class 8 expansion right,
// is shown "Limits ← Algebraic Identities ← Factorisation".
//
// WHAT DECIDES WHAT. This module chooses the next probe — a chapter and a
// difficulty — from the outcomes so far, and summarises the outcomes at the end.
// It never marks anything: every outcome it consumes is the deterministic
// marker's verdict (engine/checker.js), applied by the local backend. No model
// output reaches this module.
//
// DETERMINISM. The probe sequence is a pure function of the configuration and
// the ordered list of outcomes: the process below is a generator that is
// replayed from the start on every call. The same configuration and answers give
// the same probes and the same summary, which is what makes a session resumable
// from storage after a relaunch and testable with scripted learners. The seed is
// carried for the backend, which uses it to choose question variants.
//
// WHAT IT DOES NOT CLAIM. One question per chapter is a small sample, a
// multiple-choice item can be guessed, and the graph is Pri's own hypothesis.
// The summary therefore reports confidence as 'low' or 'moderate' — never
// 'high' — and flags low samples and contradictions instead of hiding them. A
// placement result is diagnostic evidence, not mastery, and it is stored apart
// from the rating rows that mastery is computed from.
// ─────────────────────────────────────────────────────────────────────────────
import {
  PLACEMENT_ANCHORS, PREREQ_GRAPH_VERSION, MAP_STRANDS, prerequisiteNode, primaryChain,
  dependentsOf, dependsOn, mapStrandOf, edgeSkill
} from './prerequisites.js';

export const PLACEMENT_VERSION = 1;
export const PLACEMENT_TARGET = 10;
export const PLACEMENT_MAX = 12;
const OWN_ANCHORS = 4;       // anchors at the chosen class that are always probed
const TRACE_CAP = 4;         // probes a single downward trace may spend
const CLIMB_CAP = 2;         // probes a single upward climb may spend
const CORE_DIFFICULTY = 2;
const DEPTH_DIFFICULTY = 4;  // "JEE depth" probe on a Class 11–12 chapter

const TRACKS = new Set(['cbse', 'jee-main', 'jee-advanced']);

/** A validated configuration. Unknown tracks fall back to CBSE; grades clamp to 7–12. */
export function placementConfig({ grade, track = 'cbse', seed = 1 } = {}) {
  const g = Math.min(12, Math.max(7, Math.round(Number(grade) || 9)));
  const t = TRACKS.has(track) && g >= 11 ? track : 'cbse';
  const s = Number.isSafeInteger(Number(seed)) ? Number(seed) >>> 0 : 1;
  return Object.freeze({ version: PLACEMENT_VERSION, graphVersion: PREREQ_GRAPH_VERSION, grade: g, track: t, seed: s });
}

const gradeOf = id => prerequisiteNode(id)?.grade ?? null;

/**
 * The adaptive process. Yields probes `{ chapterId, grade, difficulty, phase,
 * from }` and receives `true`/`false` back for each. `state` collects what a
 * summary needs: every probe with its outcome and every trace.
 */
function* placementProcess(cfg, state) {
  const anchors = PLACEMENT_ANCHORS[cfg.grade] || [];
  const ownDifficulty = cfg.track === 'cbse' ? CORE_DIFFICULTY : 3;
  const known = new Map();           // chapterId → last core-difficulty outcome

  function* ask(probe) {
    const correct = yield probe;
    const rec = { ...probe, correct: !!correct };
    state.probes.push(rec);
    if (probe.phase !== 'depth') known.set(probe.chapterId, !!correct);
    return !!correct;
  }
  const asked = () => state.probes.length;

  /**
   * Walk a miss downward. Binary search along the primary chain finds the
   * deepest failing chapter whose primary prerequisite holds; that chapter's
   * other prerequisites are then checked in order, and a failing one becomes
   * the start of the next search. The result is one failing path from the
   * missed anchor to the plausible root.
   */
  function* trace(anchorId, reserve) {
    const path = [];
    let current = anchorId;
    let spent = 0;
    let stoppedForBudget = false;
    let belowFloor = false;
    let stoppedBy = null;            // 'trace-cap' | 'budget' when the walk was cut short
    function* outcome(id) {
      if (known.has(id)) return known.get(id);
      if (spent >= TRACE_CAP) { stoppedBy = 'trace-cap'; return null; }
      if (asked() >= PLACEMENT_MAX - reserve) { stoppedBy = 'budget'; return null; }
      spent++;
      return yield* ask({ chapterId: id, grade: gradeOf(id), difficulty: CORE_DIFFICULTY, phase: 'trace', from: anchorId });
    }
    for (;;) {
      const chain = primaryChain(current);
      let lo = 0;                    // index known to fail
      let hi = chain.length;         // sentinel: below the floor is assumed secure
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        const ok = yield* outcome(chain[mid]);
        if (ok === null) { stoppedForBudget = true; break; }
        if (ok) hi = mid; else lo = mid;
      }
      path.push(...chain.slice(0, lo + 1));
      const root = chain[lo];
      if (stoppedForBudget) break;
      if (lo === chain.length - 1) { belowFloor = true; break; }
      // The primary prerequisite of `root` held. Look at the others.
      let deeper = null;
      for (const p of (prerequisiteNode(root)?.prerequisites || []).slice(1)) {
        if (path.includes(p.id)) continue;
        const ok = yield* outcome(p.id);
        if (ok === null) { stoppedForBudget = true; break; }
        if (!ok) { deeper = p.id; break; }
      }
      if (!deeper) break;
      current = deeper;
    }
    state.traces.push({
      from: anchorId,
      chain: path,
      root: path[path.length - 1],
      resolved: !stoppedForBudget,
      stoppedBy: stoppedForBudget ? stoppedBy : null,
      // Nothing below the root in this product to test: the gap may predate
      // Class 7.
      belowFloor: !stoppedForBudget && belowFloor
    });
  }

  function upFrom(id) {
    const g = gradeOf(id);
    const nextAnchors = PLACEMENT_ANCHORS[g + 1] || [];
    const viaAnchor = nextAnchors.find(a => !known.has(a) && dependsOn(a, id));
    if (viaAnchor) return viaAnchor;
    const direct = dependentsOf(id).filter(d => !known.has(d) && gradeOf(d) > g)
      .sort((a, b) => gradeOf(a) - gradeOf(b));
    return direct[0] || null;
  }

  function* climb(anchorId, reserve) {
    let node = anchorId;
    let spent = 0;
    // A fair share of what is left inside the target, so an early clean answer
    // cannot spend the questions a later anchor's downward trace will need.
    const share = Math.floor((PLACEMENT_TARGET - asked() - reserve) / (reserve + 1));
    const cap = Math.min(CLIMB_CAP, Math.max(0, share));
    const room = () => spent < cap && asked() < PLACEMENT_TARGET - reserve;
    while (room()) {
      const g = gradeOf(node);
      const next = g < 12 ? upFrom(node) : null;
      if (!next) {
        // At the top of the spine "up" means depth: the same Class 11–12
        // chapter asked at JEE difficulty.
        if (g >= 11 && !state.probes.some(p => p.phase === 'depth' && p.chapterId === node)) {
          spent++;
          yield* ask({ chapterId: node, grade: g, difficulty: DEPTH_DIFFICULTY, phase: 'depth', from: anchorId });
        }
        return;
      }
      spent++;
      const ok = yield* ask({ chapterId: next, grade: gradeOf(next), difficulty: CORE_DIFFICULTY, phase: 'climb', from: anchorId });
      if (!ok) return;
      node = next;
    }
  }

  for (let i = 0; i < anchors.length; i++) {
    const anchorId = anchors[i];
    const reserve = Math.max(0, Math.min(OWN_ANCHORS, anchors.length) - i - 1);
    // Anchors past the first four are a bonus, asked only inside the target.
    if (i >= OWN_ANCHORS && asked() >= PLACEMENT_TARGET) break;
    if (asked() >= PLACEMENT_MAX - reserve) break;
    let ok;
    if (known.has(anchorId)) ok = known.get(anchorId);
    else ok = yield* ask({ chapterId: anchorId, grade: cfg.grade, difficulty: ownDifficulty, phase: 'anchor', from: null });
    if (ok) yield* climb(anchorId, reserve);
    else yield* trace(anchorId, reserve);
  }
}

/**
 * Replay the process over the outcomes so far.
 *  outcomes: [{ chapterId, correct }] in the order they were asked.
 * Returns { done, probe, state }. Throws when an outcome names a chapter the
 * process did not ask for — a stored session that no longer matches this
 * engine version must be restarted, not silently reinterpreted.
 */
export function replayPlacement(config, outcomes = []) {
  const cfg = placementConfig(config);
  const state = { probes: [], traces: [] };
  const it = placementProcess(cfg, state);
  let step = it.next();
  for (let i = 0; i < outcomes.length; i++) {
    if (step.done) throw Object.assign(new Error('Placement answers run past the end of the diagnostic'), { code: 'PLACEMENT_REPLAY_MISMATCH' });
    const want = step.value;
    if (want.chapterId !== outcomes[i]?.chapterId) {
      throw Object.assign(new Error(`Placement answer ${i + 1} is for ${outcomes[i]?.chapterId}, expected ${want.chapterId}`), { code: 'PLACEMENT_REPLAY_MISMATCH' });
    }
    step = it.next(!!outcomes[i].correct);
  }
  return { done: !!step.done, probe: step.done ? null : step.value, state, config: cfg };
}

/** The next probe for these outcomes, or null when the diagnostic is complete. */
export function nextPlacementProbe(config, outcomes = []) {
  return replayPlacement(config, outcomes).probe;
}

const CONFIDENCE = Object.freeze({ low: 'low', moderate: 'moderate' });

/**
 * Summarise a finished (or abandoned) diagnostic.
 *  items: [{ chapterId, correct, difficulty?, answerType? }] — `difficulty` is
 *         what was actually served, `answerType` lets guessable items count for
 *         less confidence.
 */
export function summarisePlacement(config, items = []) {
  const { state, config: cfg, done } = replayPlacement(config, items);
  const served = items.map((it, i) => ({ ...state.probes[i], served: Number(it.difficulty) || state.probes[i].difficulty, answerType: it.answerType || null }));
  const core = served.filter(p => p.phase !== 'depth');

  // ── Root gaps ──
  const byRoot = new Map();
  for (const tr of state.traces) {
    const entry = byRoot.get(tr.root) || { traces: [] };
    entry.traces.push(tr);
    byRoot.set(tr.root, entry);
  }
  const failedProbesOf = id => core.filter(p => p.chapterId === id && !p.correct).length;
  const rootGaps = [...byRoot.entries()].map(([root, { traces }]) => {
    const first = traces[0];
    const resolved = traces.some(t => t.resolved);
    // Independent support: two traces landing on the same root, or the root
    // itself failing on more than one question.
    const corroborated = traces.length >= 2 || failedProbesOf(root) >= 2;
    // A passed chapter that depends on the root contradicts it.
    const contradicted = core.some(p => p.correct && p.chapterId !== root && dependsOn(p.chapterId, root));
    const guessable = core.some(p => p.chapterId === root && p.answerType === 'mcq');
    const chain = first.chain.map((id, i) => {
      const probes = core.filter(p => p.chapterId === id);
      return {
        chapterId: id,
        grade: gradeOf(id),
        tested: probes.length > 0,
        correct: probes.length ? probes[probes.length - 1].correct : null,
        skill: i > 0 ? edgeSkill(first.chain[i - 1], id) : null
      };
    });
    return {
      chapterId: root,
      grade: gradeOf(root),
      strand: mapStrandOf(root),
      from: traces.map(t => t.from),
      chain,
      resolved,
      // Why an unresolved trace stopped: this trace's own question limit, or
      // the diagnostic's overall budget of twelve.
      stoppedBy: resolved ? null : (traces.find(t => !t.resolved)?.stoppedBy || 'budget'),
      corroborated,
      contradicted,
      belowFloor: traces.some(t => t.belowFloor),
      sameChapter: first.chain.length === 1,
      confidence: resolved && corroborated && !contradicted && !guessable ? CONFIDENCE.moderate : CONFIDENCE.low
    };
  }).sort((a, b) => (a.grade - b.grade) || a.chapterId.localeCompare(b.chapterId));
  const rootIds = new Set(rootGaps.map(r => r.chapterId));

  // ── Per-chapter outcomes for the map ──
  const chapters = {};
  for (const p of core) {
    const c = chapters[p.chapterId] || { probes: 0, correct: 0 };
    c.probes += 1;
    c.correct += p.correct ? 1 : 0;
    c.last = p.correct;
    chapters[p.chapterId] = c;
  }
  for (const [id, c] of Object.entries(chapters)) {
    c.outcome = rootIds.has(id) ? 'root-gap' : c.last ? 'secure' : 'gap';
    delete c.last;
  }
  // Untested chapters on a resolved chain between the miss and its root are
  // inferred gaps — named as inferred, never as tested.
  for (const r of rootGaps) {
    if (!r.resolved) continue;
    for (const link of r.chain) {
      if (!link.tested && !chapters[link.chapterId]) chapters[link.chapterId] = { probes: 0, correct: 0, outcome: 'inferred-gap' };
    }
  }
  const depth = {};
  for (const p of served.filter(p => p.phase === 'depth')) {
    depth[p.chapterId] = { correct: p.correct, difficulty: p.served };
    if (chapters[p.chapterId]) chapters[p.chapterId].jeeDepth = p.correct && p.served >= 3;
  }

  // ── Strand levels ──
  const strands = MAP_STRANDS.map(({ id }) => {
    const probes = core.filter(p => mapStrandOf(p.chapterId) === id);
    const grades = [...new Set(probes.map(p => p.grade))].sort((a, b) => a - b);
    let securedThrough = null;
    for (const g of grades) {
      const atOrBelow = probes.filter(p => p.grade <= g);
      if (atOrBelow.some(p => !p.correct)) break;
      if (probes.some(p => p.grade === g && p.correct)) securedThrough = g;
    }
    const lowestFail = probes.filter(p => !p.correct).reduce((m, p) => Math.min(m, p.grade), Infinity);
    if (securedThrough == null && lowestFail === 7) securedThrough = 6;   // "below Class 7"
    const passed = probes.filter(p => p.correct);
    const highestPassed = passed.length ? Math.max(...passed.map(p => p.grade)) : null;
    const inconsistent = probes.some(p => p.correct && probes.some(q => !q.correct && q.chapterId !== p.chapterId && dependsOn(p.chapterId, q.chapterId)));
    const depthProbes = served.filter(p => p.phase === 'depth' && mapStrandOf(p.chapterId) === id);
    return {
      id,
      probes: probes.length,
      correct: passed.length,
      securedThrough,
      highestPassed,
      jeeDepth: depthProbes.some(p => p.correct && p.served >= 3),
      lowSample: probes.length < 2,
      inconsistent,
      confidence: probes.length >= 2 && !inconsistent ? CONFIDENCE.moderate : CONFIDENCE.low
    };
  });

  // A rough overall estimate: the highest class at which at least two in three
  // of the core questions at or below it were right and one at that class was.
  // 6 means "below Class 7"; null means too little to say.
  let overallLevel = null;
  for (const g of [7, 8, 9, 10, 11, 12]) {
    const upTo = core.filter(p => p.grade <= g);
    if (!upTo.length) continue;
    const rate = upTo.filter(p => p.correct).length / upTo.length;
    if (rate >= 2 / 3 && core.some(p => p.grade === g && p.correct)) overallLevel = g;
  }
  if (overallLevel == null && core.length && core.every(p => !p.correct) && core.some(p => p.grade === 7)) overallLevel = 6;

  // ── Low-weight priors for the adaptive picker ──
  // Diagnostic evidence only nudges which untouched chapter smart practice
  // offers first; it is never written into a rating row.
  const priors = {};
  for (const [id, c] of Object.entries(chapters)) {
    if (c.outcome === 'root-gap') priors[id] = 0.4;
    else if (c.outcome === 'gap' || c.outcome === 'inferred-gap') priors[id] = 0.3;
    else if (c.outcome === 'secure') priors[id] = -0.25;
  }

  return {
    version: PLACEMENT_VERSION,
    graphVersion: PREREQ_GRAPH_VERSION,
    kind: 'diagnostic',
    grade: cfg.grade,
    track: cfg.track,
    complete: done,
    asked: items.length,
    correct: items.filter(i => i.correct).length,
    guessable: served.filter(p => p.answerType === 'mcq').length,
    overallLevel,
    strands,
    rootGaps,
    chapters,
    depth,
    priors
  };
}
