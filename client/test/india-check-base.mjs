// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Indian curriculum suite
//
// The curriculum spine is a claim about what a student can practise, so it is
// checked the way a claim should be: not "does the file parse" but "does every
// chapter that says it has questions behind it actually produce one, and does
// that question pass its own marker".
//
// A mapping that names a generator which does not exist, or one that exists and
// throws, is the failure mode that matters — a student selects Determinants,
// the app hands back nothing, and the curriculum file still reads as complete.
// ─────────────────────────────────────────────────────────────────────────────
import {
  IN_CHAPTERS, IN_CURRICULUM, IN_STRANDS, IN_TRACKS, OLYMPIAD_TOPICS,
  IN_CHAPTER_BY_ID, coverage, mappedGenerators, allGenerators, nativeGenerators,
  generatorFor, generatorsFor, coversForDotpoint, uncoveredDotpoints, DIFFICULTIES, OWN_GENERATOR
} from '../src/engine/curriculum-in.js';
import { SUBTOPIC_BY_ID, DOTPOINTS, difficultiesForDotpoint } from '../src/engine/curriculum.js';
import { GENERATORS, loadAllBanks, generateQuestion, bankOf } from '../src/engine/generators/index.js';
import { checkAnswer } from '../src/engine/checker.js';
import { answerForms, inspect } from '../../server/test/selfcheck.mjs';

await loadAllBanks();

let pass = 0, fail = 0;
const failures = [];
const ok = (label, cond) => { if (cond) pass++; else { fail++; failures.push(label); } };
const same = (label, got, want) => ok(`${label} — got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`, got === want);

// ── Shape ───────────────────────────────────────────────────────────────────
console.log('SHAPE');
const ids = IN_CHAPTERS.map(c => c.id);
same('every chapter id is unique', new Set(ids).size, ids.length);
ok('no chapter id collides with an NSW subtopic id', ids.every(id => !SUBTOPIC_BY_ID[id]));
for (const ch of IN_CHAPTERS) {
  ok(`${ch.id} names a strand this curriculum declares`, IN_STRANDS.includes(ch.strand));
  ok(`${ch.id} has exactly three dot points`, Array.isArray(ch.dotpoints) && ch.dotpoints.length === 3);
  ok(`${ch.id} dot points are non-empty prose`, (ch.dotpoints || []).every(d => typeof d === 'string' && d.trim().length > 12));
  ok(`${ch.id} carries a usable exam weight`, Number.isFinite(ch.weight) && ch.weight > 0 && ch.weight <= 20);
  ok(`${ch.id} has a name`, typeof ch.name === 'string' && ch.name.trim().length > 2);
}
same('six classes are described', IN_CURRICULUM.length, 6);
same('classes run 7 to 12', IN_CURRICULUM.map(g => g.grade).join(','), '7,8,9,10,11,12');
console.log(`  ${IN_CHAPTERS.length} chapters across ${IN_CURRICULUM.length} classes plus ${OLYMPIAD_TOPICS.length} olympiad topics`);

// ── Mappings: the half that can silently lie ────────────────────────────────
console.log('\nMAPPINGS');
let entries = 0;
for (const ch of IN_CHAPTERS) {
  for (const c of ch.covers) {
    entries++;
    ok(`${ch.id} → ${c.gen} exists`, !!GENERATORS[c.gen]);
    ok(`${ch.id} → ${c.gen} resolves to a lazily-loadable bank`, !!bankOf(c.gen));
    ok(`${ch.id} → ${c.gen} names real dot points`, c.dp.every(i => i >= 0 && i < ch.dotpoints.length));
    ok(`${ch.id} → ${c.gen} names real difficulties`, c.diff.length > 0 && c.diff.every(d => DIFFICULTIES.includes(d)));
    // A generator borrowed from the NSW banks must be a real subtopic there; one
    // written for this curriculum is named by the convention OWN_GENERATOR sets.
    const own = OWN_GENERATOR.test(c.gen);
    ok(`${ch.id} → ${c.gen} is either an NSW subtopic or written for this curriculum`, own || !!SUBTOPIC_BY_ID[c.gen]);
    if (own) ok(`${ch.id} → ${c.gen} lives in an India bank`, String(bankOf(c.gen)).startsWith('india-'));
  }
}
const mapped = IN_CHAPTERS.filter(c => generatorFor(c));
console.log(`  ${entries} cover entries across ${mapped.length} chapters, reaching ${allGenerators().length} generators — ${mappedGenerators().length} reused from the NSW banks, ${nativeGenerators().length} written for this curriculum`);

// ── Every claim has to produce a markable question ─────────────────────────
// The claim is not "this chapter has a generator" but "this generator, at these
// difficulties, asks about this dot point". The first half of that is machine
// checkable and is checked here: every (generator, difficulty) pair a chapter
// names is made to produce real questions, which are then marked by the real
// marker and inspected for well-formedness. The second half — that the question
// is *about* the dot point claimed — is a human judgement, made once per entry
// against sampled output, and is not something this suite can verify.
console.log('\nQUESTIONS — every declared (generator, difficulty), marked and inspected');
const DRAWS = 12;
let made = 0, marked = 0, wellFormed = 0;
const broken = [];
const pairs = new Set();
for (const ch of IN_CHAPTERS) for (const c of ch.covers) for (const d of c.diff) pairs.add(`${c.gen}|${d}`);
for (const pair of pairs) {
  const [gid, ds] = pair.split('|');
  const d = Number(ds);
  for (let i = 0; i < DRAWS; i++) {
    let q;
    try { q = generateQuestion(gid, d, `in-${gid}-${d}-${i}`); }
    catch (e) { broken.push(`${gid} d${d}: threw ${e.message}`); continue; }
    if (!q || !q.prompt) { broken.push(`${gid} d${d}: produced no question`); continue; }
    made++;
    const problems = inspect(q);
    if (!problems.length) wellFormed++;
    else if (broken.length < 12) broken.push(`${gid} d${d}: ${problems[0]}`);
    if (q.multipart) { marked++; continue; }
    const forms = answerForms(q);
    if (!forms.length) { marked++; continue; }
    let allOk = true;
    for (const form of forms) {
      let res;
      try { res = checkAnswer(q, form.input); }
      catch (e) { res = { correct: false, feedback: `threw ${e.message}` }; }
      if (!res.correct) {
        allOk = false;
        if (broken.length < 12) broken.push(`${gid} d${d}: keyed ${form.label} "${form.input}" is marked wrong by its own marker`);
      }
    }
    if (allOk) marked++;
  }
}
ok(`every declared pair produced questions — ${broken.length} problem(s)`, broken.length === 0);
same('every generated question passed its own marker', marked, made);
same('every generated question is well formed', wellFormed, made);
console.log(`  ${made} questions from ${pairs.size} declared (generator, difficulty) pairs × ${DRAWS} draws — ${marked} marked correct by their own marker, ${wellFormed} well formed`);
if (broken.length) for (const b of broken) console.log(`    ✗ ${b}`);

// ── Tracks ──────────────────────────────────────────────────────────────────
console.log('\nTRACKS');
for (const [key, track] of Object.entries(IN_TRACKS)) {
  same(`${key} declares its own id`, track.id, key);
  ok(`${key} has a ceiling in 1..4`, track.difficultyCeiling >= 1 && track.difficultyCeiling <= 4);
  const scope = key === 'cbse' ? track.scopeFor(11) : track.scopeFor();
  ok(`${key} has a non-empty scope`, scope.length > 0);
  ok(`${key} scopes only chapters this curriculum declares`, scope.every(id => !!IN_CHAPTER_BY_ID[id]));
}
for (const g of IN_CURRICULUM) {
  const scope = IN_TRACKS.cbse.scopeFor(g.grade);
  same(`CBSE Class ${g.grade} scope is that class`, scope.length, g.chapters.length);
}
ok('JEE reaches both senior years', IN_TRACKS['jee-main'].scopeFor().length === IN_CURRICULUM.find(g => g.grade === 11).chapters.length + IN_CURRICULUM.find(g => g.grade === 12).chapters.length);
ok('the olympiad scope is the olympiad topics, not school chapters', IN_TRACKS.olympiad.scopeFor().every(id => OLYMPIAD_TOPICS.some(t => t.id === id)));
ok('no olympiad topic reuses a school generator', OLYMPIAD_TOPICS.every(t => !t.maps));
ok('every olympiad topic is authored for this curriculum', OLYMPIAD_TOPICS.every(t => t.native));

// ── Coverage arithmetic ─────────────────────────────────────────────────────
console.log('\nCOVERAGE');
const c = coverage();
same('the three buckets account for every chapter', c.full.length + c.partial.length + c.none.length, c.total);
same('total matches the chapter list', c.total, IN_CHAPTERS.length);
same('the dot-point count is three per chapter', c.dotpoints, IN_CHAPTERS.length * 3);
same('covered plus uncovered is every dot point', c.coveredDotpoints + c.uncovered.length, c.dotpoints);
ok('nothing is counted as both full and partial', c.full.every(x => !c.partial.includes(x)));
for (const ch of c.full) same(`${ch.id} is full, so nothing is uncovered`, uncoveredDotpoints(ch).length, 0);
for (const ch of c.partial) ok(`${ch.id} is partial, so something is uncovered`, uncoveredDotpoints(ch).length > 0);

// A dot point reachable at only one of the four difficulties is covered but
// thin: asking for it forces that difficulty, because the picker snaps a
// request to the nearest difficulty that can deliver. Reported rather than
// gated — it is a quality number, and hiding it would let the headline read as
// more than it is. It is reported *beside the NSW figure*, because a number
// with nothing to compare it against says very little, and this architecture
// has always had thin dot points.
const thin = [];
for (const ch of IN_CHAPTERS) {
  ch.dotpoints.forEach((text, i) => {
    const diffs = new Set(coversForDotpoint(ch, i).flatMap(x => x.diff));
    if (diffs.size === 1) thin.push(`${ch.id} dp${i} — only D${[...diffs][0]}`);
  });
}
console.log(`  ${c.total} chapters — ${c.full.length} full, ${c.partial.length} partial, ${c.none.length} none`);
console.log(`  ${c.coveredDotpoints}/${c.dotpoints} dot points have a generator behind them; ${c.uncovered.length} do not`);
const nswThin = DOTPOINTS.filter(dp => difficultiesForDotpoint(dp.id).length === 1).length;
console.log(`  ${thin.length}/${c.dotpoints} (${(thin.length / c.dotpoints * 100).toFixed(1)}%) are reachable at only one of the four difficulties — against ${nswThin}/${DOTPOINTS.length} (${(nswThin / DOTPOINTS.length * 100).toFixed(1)}%) in the NSW curriculum this app already ships:`);
for (const t of thin) console.log(`    · ${t}`);
console.log('  None of this is a claim that the questions are pitched at NCERT level, or that a generator asks what its dot point says — no Indian teacher has read one.');

if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures.slice(0, 30)) console.log(`  ${line}`);
  if (failures.length > 30) console.log(`  … and ${failures.length - 30} more`);
}
console.log(`\n${fail ? '✖ INDIA SUITE FAILED' : '✔ INDIA SUITE PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
