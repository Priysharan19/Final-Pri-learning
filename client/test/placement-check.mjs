// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Placement diagnostic suite.
//
// What this proves, and how:
//
//   1. The prerequisite graph is sound against the live curriculum: every node
//      is a real Class 7–12 chapter id, the graph is acyclic, every Class 8–12
//      chapter names a prerequisite, only Class 7 may be foundational, every
//      edge names the skill it carries, and its provenance says plainly that it
//      is Pri-authored and not an NCERT/CBSE publication. The validator is
//      itself checked by feeding it a curriculum it must reject.
//
//   2. The adaptive engine, driven by SCRIPTED SYNTHETIC LEARNERS (not real
//      students — nothing here is evidence about real learners): a learner with
//      a set of gap chapters fails every chapter that depends on a gap and
//      passes the rest. The suite asserts the diagnostic never exceeds twelve
//      questions, finds a planted root gap (the headline case: a Class 11
//      student whose limits trouble comes from Class 8 factorisation), is a pure
//      function of configuration and answers, never reports 'high' confidence,
//      and degrades honestly under answer noise. Detection rates over sweeps are
//      printed as measured numbers.
//
//   3. The local backend routes: start, resume at the exact question after a
//      relaunch, deterministic marking through checkAnswer, invalid answers that
//      cost nothing, double submission refused, profile isolation, retake and
//      skip, India-only scope, and — the boundary that matters most — a
//      placement writes nothing to the attempts, ratings, reviews or activity
//      stores that mastery is computed from.
//
// Usage: node client/test/placement-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261002);
Math.random = () => rng();

let pass = 0;
const failures = [];
let group = 'startup';
const section = name => { group = name; };
const show = v => JSON.stringify(v) ?? String(v);
function ok(name, condition, detail = '') {
  if (condition) { pass++; return true; }
  failures.push(`${group} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${show(expected)}, got ${show(actual)}`);
const measured = [];

function canonicalInput(q) {
  const a = q.answer;
  if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric':
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k === -1 ? '-' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.requireExact) return null;
      return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'working': return a.canonicalWorking ?? null;
    default: return null;
  }
}

async function run() {
  const graph = await import(`${SRC}engine/prerequisites.js`);
  const engine = await import(`${SRC}engine/placement.js`);
  const { IN_CHAPTERS } = await import(`${SRC}engine/curriculum-in.js`);
  const { pickNextAmong } = await import(`${SRC}engine/adaptive.js`);

  // ── 1 · the graph ──────────────────────────────────────────────────────────
  section('graph');
  const problems = graph.validatePrerequisiteGraph();
  eq('the graph validates against the live curriculum', problems, []);
  eq('validation is deterministic', graph.validatePrerequisiteGraph(), problems);
  const spine = IN_CHAPTERS.filter(ch => ch.grade >= 7 && ch.grade <= 12);
  eq('every Class 7–12 chapter is a node', spine.filter(ch => !graph.prerequisiteNode(ch.id)).map(ch => ch.id), []);
  eq('every node is a curriculum chapter', graph.PREREQ_NODES.filter(n => !spine.some(ch => ch.id === n.id)).map(n => n.id), []);
  eq('every Class 8–12 chapter has a prerequisite', graph.PREREQ_NODES.filter(n => n.grade >= 8 && !n.prerequisites.length).map(n => n.id), []);
  eq('only Class 7 chapters are foundational', graph.PREREQ_NODES.filter(n => n.foundational && n.grade !== 7).map(n => n.id), []);
  ok('no prerequisite sits in a later class', graph.PREREQ_NODES.every(n => n.prerequisites.every(p => graph.prerequisiteNode(p.id).grade <= n.grade)));
  ok('every edge names its skill', graph.PREREQ_NODES.every(n => n.prerequisites.every(p => typeof p.skill === 'string' && p.skill.length > 3)));
  ok('every primary chain ends on a foundational chapter', graph.PREREQ_NODES.every(n => graph.prerequisiteNode(graph.primaryChain(n.id).at(-1)).foundational));
  ok('no chapter is its own ancestor (acyclic)', graph.PREREQ_NODES.every(n => !graph.ancestorsOf(n.id).includes(n.id)));
  ok('provenance says Pri-authored', /Pri-authored/.test(graph.PREREQ_PROVENANCE.statement));
  ok('provenance says it is not an NCERT or CBSE publication', /Not an NCERT or CBSE publication/.test(graph.PREREQ_PROVENANCE.statement));
  eq('the graph is versioned', graph.PREREQ_GRAPH_VERSION, 1);
  eq('every map row is reachable from a chapter', graph.MAP_STRANDS.filter(g => !spine.some(ch => graph.mapStrandOf(ch.id) === g.id)).map(g => g.id), []);
  for (const g of graph.PLACEMENT_GRADES) ok(`Class ${g} has at least four anchors`, (graph.PLACEMENT_ANCHORS[g] || []).length >= 4);
  // The validator is only worth something if it can fail.
  const fake = [...IN_CHAPTERS, { id: 'c9-made-up-chapter', grade: 9, strand: 'Algebra' }];
  ok('the validator rejects a curriculum chapter with no node', graph.validatePrerequisiteGraph({ chapters: fake }).some(p => p.includes('c9-made-up-chapter')));
  ok('the validator rejects a node missing from the curriculum', graph.validatePrerequisiteGraph({ chapters: IN_CHAPTERS.filter(ch => ch.id !== 'c8-factorisation') }).some(p => p.startsWith('c8-factorisation')));
  {
    const { PREREQ_SKILLS_HI } = await import(`${SRC}engine/prerequisiteSkillsHi.js`);
    const skills = new Set(graph.PREREQ_NODES.flatMap(n => n.prerequisites.map(p => p.skill)));
    eq('every edge skill has a Hindi label', [...skills].filter(k => !PREREQ_SKILLS_HI[k]), []);
    eq('every Hindi label belongs to an edge skill', Object.keys(PREREQ_SKILLS_HI).filter(k => !skills.has(k)), []);
    eq('every Hindi label is written in Devanagari', Object.entries(PREREQ_SKILLS_HI).filter(([, v]) => !/[ऀ-ॿ]/.test(v)).map(([k]) => k), []);
  }
  for (const [from, to] of [['c11-limits-derivatives', 'c11-trig-functions'], ['c12-integrals', 'c11-trig-functions'],
    ['c12-continuity-differentiability', 'c12-inverse-trigonometric'], ['c10-trigonometry', 'c10-triangles']]) {
    ok(`${from} names ${to} as a prerequisite`, graph.prerequisitesOf(from).some(p => p.id === to));
  }
  eq('the limits chain runs through Class 8 factorisation', graph.primaryChain('c11-limits-derivatives').slice(0, 3), ['c11-limits-derivatives', 'c9-algebraic-identities', 'c8-factorisation']);

  // ── 2 · the engine with scripted learners ──────────────────────────────────
  const learnerWithGaps = gaps => p => !(gaps.includes(p.chapterId) || gaps.some(g => graph.dependsOn(p.chapterId, g)));
  function sit(cfg, learner) {
    const items = [];
    for (let guard = 0; guard < 40; guard++) {
      const r = engine.replayPlacement(cfg, items);
      if (r.done) break;
      items.push({ chapterId: r.probe.chapterId, correct: !!learner(r.probe, items.length), difficulty: r.probe.difficulty, answerType: 'expression' });
    }
    return { items, summary: engine.summarisePlacement(cfg, items) };
  }
  const TRACKS_FOR = g => (g >= 11 ? ['cbse', 'jee-main', 'jee-advanced'] : ['cbse']);
  const neverHigh = s => s.rootGaps.every(r => r.confidence !== 'high') && s.strands.every(x => x.confidence !== 'high');

  section('strong everywhere');
  for (const g of graph.PLACEMENT_GRADES) for (const track of TRACKS_FOR(g)) {
    const { items, summary } = sit({ grade: g, track, seed: 7 }, () => true);
    ok(`Class ${g} ${track}: at most twelve questions`, items.length <= engine.PLACEMENT_MAX, `${items.length}`);
    ok(`Class ${g} ${track}: at least six questions`, items.length >= 6, `${items.length}`);
    eq(`Class ${g} ${track}: no root gap is invented`, summary.rootGaps, []);
    ok(`Class ${g} ${track}: placed at or above the chosen class`, summary.overallLevel >= g, `${summary.overallLevel}`);
    ok(`Class ${g} ${track}: never 'high' confidence`, neverHigh(summary));
    ok(`Class ${g} ${track}: the result is marked diagnostic`, summary.kind === 'diagnostic' && summary.complete === true);
  }
  {
    const { summary } = sit({ grade: 12, track: 'jee-main', seed: 3 }, () => true);
    ok('a strong Class 12 JEE learner is shown JEE depth somewhere', summary.strands.some(s => s.jeeDepth), show(summary.strands));
  }

  section('Class 11 with a Class 8 algebra gap');
  for (const track of ['cbse', 'jee-main']) {
    const { items, summary } = sit({ grade: 11, track, seed: 11 }, learnerWithGaps(['c8-factorisation']));
    ok(`${track}: at most twelve questions`, items.length <= engine.PLACEMENT_MAX, `${items.length}`);
    const root = summary.rootGaps.find(r => r.chapterId === 'c8-factorisation');
    ok(`${track}: Class 8 factorisation is found as the root`, !!root, show(summary.rootGaps.map(r => r.chapterId)));
    ok(`${track}: it is the only root`, summary.rootGaps.length === 1, show(summary.rootGaps.map(r => r.chapterId)));
    eq(`${track}: the chain reads Limits ← Algebraic Identities ← Factorisation`, root?.chain.map(c => c.chapterId), ['c11-limits-derivatives', 'c9-algebraic-identities', 'c8-factorisation']);
    ok(`${track}: each link below the miss names the skill it carries`, root?.chain.slice(1).every(c => c.skill));
    ok(`${track}: the root is resolved and corroborated`, root?.resolved && root?.corroborated && root?.stoppedBy === null);
    ok(`${track}: confidence is moderate, never high`, root?.confidence === 'moderate');
    eq(`${track}: the root is outcome 'root-gap' on the map`, summary.chapters['c8-factorisation']?.outcome, 'root-gap');
    ok(`${track}: the expansion skill below the gap is shown secure`, summary.chapters['c8-algebraic-identities']?.outcome === 'secure');
    ok(`${track}: a prior points practice at the root`, summary.priors['c8-factorisation'] > 0);
  }

  section('planted single gaps — sweep');
  {
    let planted = 0, found = 0, exact = 0, overCap = 0, wrongButResolved = 0;
    for (const g of graph.PLACEMENT_GRADES) {
      const probed = graph.PLACEMENT_ANCHORS[g].slice(0, 2);
      const candidates = [...new Set(probed.flatMap(a => graph.ancestorsOf(a)))].filter(id => graph.prerequisiteNode(id).grade < g);
      for (const gap of candidates) {
        const { items, summary } = sit({ grade: g, track: 'cbse', seed: 5 }, learnerWithGaps([gap]));
        planted++;
        if (items.length > engine.PLACEMENT_MAX) overCap++;
        const roots = summary.rootGaps.map(r => r.chapterId);
        if (roots.includes(gap)) found++;
        else if (summary.rootGaps.some(r => r.resolved)) wrongButResolved++;
        if (roots.length === 1 && roots[0] === gap) exact++;
      }
    }
    eq('no sitting in the sweep exceeds twelve questions', overCap, 0);
    // The honesty property: when twelve questions are not enough to reach the
    // planted gap, every root the check reports is flagged unresolved — it never
    // claims a finished trace to the wrong chapter.
    eq('a missed root is never replaced by a wrong root reported as resolved', wrongButResolved, 0);
    const rate = found / planted;
    measured.push(`planted single-gap sweep: ${found}/${planted} roots named (${Math.round(100 * rate)}%), ${exact} as the only root; every miss was reported as an unresolved trace`);
    // Measured on graph v1 at 68% (69/101) after review added the secondary
    // trigonometry and similarity edges; the misses are gaps on secondary
    // branches the twelve-question budget cannot reach. The floor sits just
    // below the measurement so a change that makes tracing worse fails here.
    ok('the planted root is named in at least 65% of single-gap sittings', rate >= 0.65, `${found}/${planted}`);
  }

  section('Class 11 missing combinations');
  for (const track of ['cbse', 'jee-main']) {
    const { items, summary } = sit({ grade: 11, track, seed: 13 }, learnerWithGaps(['c11-permutations-combinations']));
    ok(`${track}: at most twelve questions`, items.length <= engine.PLACEMENT_MAX);
    const roots = summary.rootGaps.map(r => r.chapterId);
    ok(`${track}: the gap is not traced into data handling or earlier probability`,
      !roots.some(id => ['c8-data-handling', 'c9-probability', 'c10-probability', 'c7-connecting-dots-current'].includes(id)), show(roots));
    ok(`${track}: permutations and combinations is named as the root`, roots.includes('c11-permutations-combinations'), show(roots));
    eq(`${track}: Class 10 probability is shown secure, not as a gap`, summary.chapters['c10-probability']?.outcome ?? 'untested', summary.chapters['c10-probability'] ? 'secure' : 'untested');
  }
  ok('counting is a prerequisite of Class 11 probability', graph.prerequisitesOf('c11-probability').some(p => p.id === 'c11-permutations-combinations'));
  ok('probability is not a prerequisite of permutations', !graph.dependsOn('c11-permutations-combinations', 'c10-probability'));

  section('weak everywhere');
  for (const g of graph.PLACEMENT_GRADES) {
    const { items, summary } = sit({ grade: g, track: 'cbse', seed: 9 }, () => false);
    ok(`Class ${g}: at most twelve questions`, items.length <= engine.PLACEMENT_MAX, `${items.length}`);
    ok(`Class ${g}: at least one root gap is reported`, summary.rootGaps.length >= 1);
    ok(`Class ${g}: resolved roots reach the Class 7 floor`, summary.rootGaps.filter(r => r.resolved).every(r => r.belowFloor && r.grade === 7), show(summary.rootGaps));
    ok(`Class ${g}: every unresolved root says why it stopped`, summary.rootGaps.filter(r => !r.resolved).every(r => ['trace-cap', 'budget'].includes(r.stoppedBy)), show(summary.rootGaps.map(r => r.stoppedBy)));
    ok(`Class ${g}: overall level is below Class 7 or unplaced`, summary.overallLevel === 6 || summary.overallLevel === null, `${summary.overallLevel}`);
  }

  section('noisy answers');
  {
    let sittings = 0, found = 0, contradictionsFlagged = 0, overCap = 0;
    for (let s = 1; s <= 120; s++) {
      const noise = mulberry32(s * 977);
      const base = learnerWithGaps(['c8-factorisation']);
      const learner = p => (noise() < 0.15 ? !base(p) : base(p));
      const { items, summary } = sit({ grade: 11, track: 'cbse', seed: s }, learner);
      sittings++;
      if (items.length > engine.PLACEMENT_MAX) overCap++;
      if (summary.rootGaps.some(r => r.chapterId === 'c8-factorisation')) found++;
      if (summary.rootGaps.some(r => r.contradicted) || summary.strands.some(x => x.inconsistent)) contradictionsFlagged++;
      if (!neverHigh(summary)) ok(`seed ${s}: never 'high' confidence`, false);
      const confident = summary.rootGaps.filter(r => r.confidence === 'moderate');
      if (confident.some(r => r.contradicted || !r.resolved || !r.corroborated)) ok(`seed ${s}: moderate confidence only when resolved, corroborated and uncontradicted`, false, show(confident));
    }
    eq('noise never pushes a sitting past twelve questions', overCap, 0);
    measured.push(`15% answer noise, Class 11 with a factorisation gap: root named in ${found}/${sittings} sittings; contradictions flagged in ${contradictionsFlagged}`);
    ok('under 15% noise the root is still named in most sittings', found / sittings >= 0.5, `${found}/${sittings}`);
    ok('noise is surfaced as a contradiction in some sittings rather than hidden', contradictionsFlagged > 0);
  }

  section('determinism');
  {
    const cfg = { grade: 10, track: 'cbse', seed: 424242 };
    const learner = learnerWithGaps(['c8-squares-roots']);
    const a = sit(cfg, learner);
    const b = sit(cfg, learner);
    eq('the same configuration and answers give the same probes', a.items.map(i => i.chapterId), b.items.map(i => i.chapterId));
    eq('and the same summary', a.summary, b.summary);
    const c = sit({ ...cfg, seed: 1 }, learner);
    eq('the seed chooses question variants, not the probe sequence', c.items.map(i => i.chapterId), a.items.map(i => i.chapterId));
    const half = a.items.slice(0, 4);
    eq('replaying a prefix gives the same next probe as the full run did', engine.nextPlacementProbe(cfg, half)?.chapterId, a.items[4].chapterId);
    let threw = null;
    try { engine.replayPlacement(cfg, [{ chapterId: 'c12-integrals', correct: true }]); } catch (err) { threw = err; }
    eq('an answer for a chapter the engine did not ask is refused', threw?.code, 'PLACEMENT_REPLAY_MISMATCH');
    eq('an unknown track falls back to CBSE', engine.placementConfig({ grade: 9, track: 'olympiad' }).track, 'cbse');
    eq('JEE tracks only exist from Class 11', engine.placementConfig({ grade: 10, track: 'jee-main' }).track, 'cbse');
  }

  section('adaptive prior');
  {
    const candidates = [{ id: 'c11-sets', weight: 1, own: true }, { id: 'c11-probability', weight: 1, own: true, prior: 0.4 }];
    const picked = pickNextAmong({ candidates, ratings: {}, reviewsDue: [], rand: () => 0.5, recent: [] });
    eq('an untouched chapter with a diagnostic gap prior is offered first', picked.subtopic, 'c11-probability');
    const practised = { 'c11-probability': { rating: 1150, attempts: 4, correct: 4, last_at: Date.now() } };
    const picked2 = pickNextAmong({ candidates, ratings: practised, reviewsDue: [], rand: () => 0.5, recent: [] });
    eq('the prior stops counting once the chapter has practice evidence', picked2.subtopic, 'c11-sets');
    const huge = pickNextAmong({ candidates: [{ id: 'c11-sets', weight: 1, own: true }, { id: 'c11-probability', weight: 1, own: true, prior: -99 }], ratings: {}, reviewsDue: [], rand: () => 0.5, recent: [] });
    ok('a prior is bounded — it cannot hide a chapter outright', huge.nextUp?.subtopic === 'c11-probability' || huge.subtopic === 'c11-probability');
  }

  // ── 3 · the local backend ──────────────────────────────────────────────────
  installBrowserEnv();
  resetStorage();
  const { dispatch } = await import(`${SRC}local/backend.js`);
  const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
  const { checkAnswer } = await import(`${SRC}engine/checker.js`);
  const { validateRequest } = await import(`${SRC}local/gateway.js`);
  await loadAllBanks();
  const GET = path => dispatch('GET', path);
  const POST = (path, body) => dispatch('POST', path, body);
  const storedProfile = pid => rawRows().profiles.find(r => r.id === pid);
  const { get: idbGet } = await import(`${SRC}local/idb.js`);
  const expectError = async (fn, code) => { try { await fn(); return null; } catch (err) { return err?.code === code ? code : `${err?.code}: ${err?.message}`; } };

  section('backend · start and resume');
  const asha = (await POST('/profiles', { name: 'Asha', year: 11, course: 'in', indiaTrack: 'cbse' })).user;
  let view = await GET('/placement');
  eq('a new India profile has no placement yet', view.status, 'none');
  ok('the view carries practice evidence for every Class 7–12 chapter', view.chapters.length === spine.length, `${view.chapters.length}/${spine.length}`);
  const started = await POST('/placement/start', {});
  const q1 = started.question;
  ok('start serves a question', !!q1?.id && typeof q1.prompt === 'string' && q1.prompt.length > 3);
  ok('the served question carries no answer, steps or solution', !('answer' in q1) && !('steps' in q1) && !('solutionText' in q1), Object.keys(q1).join(','));
  eq('no hints are offered in a diagnostic', q1.hintsAvailable, 0);
  eq('the first question is an anchor at the chosen class', q1.year, 11);
  eq('progress starts at zero of about ten', started.progress, { asked: 0, target: 10, max: 12 });
  const again = await POST('/placement/start', {});
  ok('starting again resumes the same question', again.resumed === true && again.question.id === q1.id && again.question.prompt === q1.prompt);
  const row = storedProfile(asha.id);
  ok('the session is stored on the profile row', row?.placement?.current?.id === q1.id);
  // A relaunch: a fresh copy of the backend module reads only what is stored.
  const relaunched = await import(`${SRC}local/backend.js?relaunch=1`);
  const afterRelaunch = await relaunched.dispatch('GET', '/placement');
  ok('after a relaunch the exact question is resumed', afterRelaunch.status === 'active' && afterRelaunch.question.id === q1.id && afterRelaunch.question.prompt === q1.prompt);

  section('backend · marking');
  const invalid = await POST(`/placement/${q1.id}/answer`, { answer: '', ms: 1000 });
  ok('an unreadable answer is not counted', invalid.resolved === false && (await GET('/placement')).progress.asked === 0, show(invalid));
  ok('the gateway refuses an answer that is not text', (() => { try { validateRequest('POST', `/placement/${q1.id}/answer`, { answer: { x: 1 } }); return false; } catch (e) { return e.code === 'INVALID_FIELD'; } })());

  // Drive the diagnostic as a learner with a Class 8 factorisation gap, using
  // the real marker on the real generated questions.
  const learner = learnerWithGaps(['c8-factorisation']);
  let current = q1;
  let answered = 0;
  let last = null;
  const marks = [];
  for (let guard = 0; guard < 20 && current; guard++) {
    const stored = storedProfile(asha.id).placement.current;
    ok(`question ${answered + 1}: the stored question is the one on screen`, stored.id === current.id);
    const want = learner(stored.probe);
    const right = canonicalInput(stored.payload);
    const canRight = right !== null && checkAnswer(stored.payload, right).correct === true;
    let res;
    if (want && canRight) res = await POST(`/placement/${current.id}/answer`, { answer: right, ms: 20000, viaInk: true });
    else res = await POST(`/placement/${current.id}/answer`, { skip: true, ms: 5000 });
    marks.push({ chapterId: stored.probe.chapterId, want, correct: res.correct });
    if (want && canRight) ok(`question ${answered + 1}: the deterministic marker accepts the canonical answer`, res.correct === true);
    if (!want) ok(`question ${answered + 1}: a skip is marked as not correct`, res.correct === false && res.skipped === true);
    ok(`question ${answered + 1}: a marked answer returns the worked solution`, !!res.solution?.answerText || Array.isArray(res.solution?.steps));
    answered++;
    last = res;
    const replayed = await expectError(() => POST(`/placement/${current.id}/answer`, { skip: true }), res.done ? 'PLACEMENT_NOT_ACTIVE' : 'PLACEMENT_ALREADY_ANSWERED');
    ok(`question ${answered}: answering the same question twice is refused`, replayed === (res.done ? 'PLACEMENT_NOT_ACTIVE' : 'PLACEMENT_ALREADY_ANSWERED'), String(replayed));
    current = res.next;
  }
  ok('the diagnostic finished', last?.done === true);
  ok('it took at most twelve questions', answered <= 12, `${answered}`);
  ok('it took at least six', answered >= 6, `${answered}`);
  const result = last?.result;
  ok('the result is labelled diagnostic evidence', result?.kind === 'diagnostic');
  const canonicalEverywhere = marks.every(m => m.correct === m.want);
  if (canonicalEverywhere) {
    ok('with every answer marked as scripted, the Class 8 factorisation root is found', result.rootGaps.some(r => r.chapterId === 'c8-factorisation'), show(result.rootGaps.map(r => r.chapterId)));
  } else {
    measured.push(`backend sitting: ${marks.filter(m => m.correct !== m.want).length} scripted-correct answers had no canonical input and were skipped`);
    ok('the result still names at least one root gap', result.rootGaps.length >= 1);
  }
  view = await GET('/placement');
  eq('the view reports the placement as finished', view.status, 'finished');
  ok('and carries the result', view.result?.asked === answered);

  section('backend · diagnostic is not mastery');
  const raw = rawRows();
  eq('no attempt rows were written', raw.attempts.filter(r => r.pid === asha.id).length, 0);
  eq('no rating rows were written', raw.ratings.filter(r => r.pid === asha.id).length, 0);
  eq('no review rows were written', raw.reviews.filter(r => r.pid === asha.id).length, 0);
  eq('no activity rows were written', raw.activity.filter(r => r.pid === asha.id).length, 0);
  eq('no question rows were written', raw.questions.filter(r => r.pid === asha.id).length, 0);
  eq('no XP was awarded', storedProfile(asha.id).xp || 0, 0);
  const me = await GET('/me');
  eq('the free-tier allowance was not spent', me.user.usage?.practice?.used, 0);

  section('backend · practice seeding');
  {
    // The prior is deliberately small (bounded at ±0.4 against a coverage term
    // of 0.8 and exam-weighted weakness), so it is asserted as "early", not
    // "always first".
    const flagged = Object.entries(result.priors).filter(([id, v]) => v > 0 && id.startsWith('c11-')).map(([id]) => id);
    const early = [];
    for (let i = 0; i < 3; i++) {
      const smart = await POST('/practice/next', {});
      ok(`smart serve ${i + 1} is still a Class 11 chapter`, smart.question.year === 11, show(smart.question.year));
      early.push({ id: smart.question.subtopic, why: smart.why });
      await POST(`/practice/${smart.question.id}/discard`, {});
    }
    if (flagged.length) ok('a Class 11 chapter the diagnostic flagged is among the first three smart serves', early.some(e => flagged.includes(e.id)), `${show(early.map(e => e.id))} vs ${show(flagged)}`);
    const seeded = early.find(e => flagged.includes(e.id));
    if (seeded) ok('and its why says it was diagnostic evidence, not a mark', /placement check/.test(seeded.why) && /not a mark/.test(seeded.why), seeded.why);
  }

  section('backend · retake');
  const retake = await POST('/placement/start', { restart: true });
  ok('a retake starts a fresh session', retake.resumed === false && retake.question.id !== q1.id);
  view = await GET('/placement');
  ok('the last result stays visible while the retake runs', view.status === 'active' && view.result?.asked === answered);
  let cur = retake.question;
  let fin = null;
  for (let guard = 0; guard < 20 && cur; guard++) { fin = await POST(`/placement/${cur.id}/answer`, { skip: true }); cur = fin.next; }
  ok('the retake finishes', fin?.done === true);
  view = await GET('/placement');
  eq('the earlier result is kept in history', view.previous.length, 1);
  ok('the new result replaced the old one', view.result.correct === 0);

  section('backend · isolation and scope');
  const ravi = (await POST('/profiles', { name: 'Ravi', year: 9, course: 'in', indiaTrack: 'cbse' })).user;
  view = await GET('/placement');
  eq('another profile starts with no placement', view.status, 'none');
  eq('another profile cannot answer the first profile\'s question', await expectError(() => POST(`/placement/${retake.question.id}/answer`, { skip: true }), 'PLACEMENT_NOT_ACTIVE'), 'PLACEMENT_NOT_ACTIVE');
  const r1 = await POST('/placement/start', {});
  eq('a Class 9 profile is placed from Class 9', r1.question.year, 9);
  ok('the first profile\'s stored placement is untouched', storedProfile(asha.id).placement.status === 'finished' && storedProfile(ravi.id).placement.status === 'active');
  await POST('/profiles/select', { id: asha.id });
  eq('switching back shows the first profile\'s own result', (await GET('/placement')).status, 'finished');
  const kai = (await POST('/profiles', { name: 'Kai', year: 9, course: 'nsw' })).user;
  ok('an Australian profile is told the check is India-only', (await GET('/placement')).available === false && !!kai.id);
  eq('and cannot start one', await expectError(() => POST('/placement/start', {}), 'PLACEMENT_UNAVAILABLE'), 'PLACEMENT_UNAVAILABLE');
  await POST('/profiles', { name: 'Meera', year: 8, course: 'in', indiaTrack: 'cbse' });
  await POST('/placement/skip', {});
  eq('skipping is remembered', (await GET('/placement')).status, 'skipped');
  const late = await POST('/placement/start', {});
  ok('a skipped placement can still be started later', !!late.question?.id && (await GET('/placement')).status === 'active');

  section('backend · concurrent profile writes');
  {
    // A placement answer awaits the engine and question generation between
    // reading the profile and writing it. A settings change landing in that
    // gap must survive, and so must the placement progress.
    const meera = (await GET('/me')).user;
    const before = (await GET('/placement')).progress.asked;
    const q = (await GET('/placement')).question;
    const [answeredNow, patched] = await Promise.all([
      POST(`/placement/${q.id}/answer`, { skip: true }),
      dispatch('PATCH', '/me', { name: 'Meera Rao', dailyGoal: 25 })
    ]);
    const row = storedProfile(meera.id);
    ok('the concurrent settings change survived the placement write', row.name === 'Meera Rao' && row.dailyGoal === 25, show({ name: row.name, dailyGoal: row.dailyGoal }));
    ok('and the placement answer was recorded', answeredNow.resolved === true && row.placement.items.length === before + 1 && patched.user.name === 'Meera Rao');
    const xpBefore = row.xp || 0;
    const q2 = (await GET('/placement')).question;
    ok('the check is still running for the XP race', !!q2?.id);
    const smart = await POST('/practice/next', {});
    const right = canonicalInput((await idbGet('questions', smart.question.id)).payload);
    const [placed2, practised] = await Promise.all([
      POST(`/placement/${q2.id}/answer`, { skip: true }),
      POST(`/practice/${smart.question.id}/submit`, { answer: right ?? '0', ms: 5000 })
    ]);
    const after = storedProfile(meera.id);
    const gained = practised.resolved ? (practised.xp || 0) : 0;
    eq('XP from a concurrent practice answer is not lost', after.xp || 0, xpBefore + gained);
    ok('and the second placement answer was recorded too', placed2.resolved === true && after.placement.items.length === before + 2, show({ items: after.placement.items.length, before }));
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  for (const m of measured) console.log(`  measured · ${m}`);
  const total = pass + failures.length;
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
    console.log(`\nPLACEMENT: FAIL — ${pass}/${total} checks`);
    return 1;
  }
  console.log(`PLACEMENT: PASS — ${pass}/${total} checks (scripted synthetic learners; no real-student evidence)`);
  return 0;
}

run().then(code => process.exit(code)).catch(err => {
  console.error(err?.stack || err);
  console.log(`\nPLACEMENT: FAIL — crashed in "${group}" after ${pass} passing checks`);
  process.exit(1);
});
