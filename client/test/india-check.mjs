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
  IN_CHAPTER_BY_ID, coverage, mappedGenerators, allGenerators, generatorFor
} from '../src/engine/curriculum-in.js';
import { SUBTOPIC_BY_ID } from '../src/engine/curriculum.js';
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
const mapped = IN_CHAPTERS.filter(c => generatorFor(c));
for (const ch of mapped) {
  const gid = generatorFor(ch);
  if (ch.native) {
    same(`${ch.id} is native, so it does not also claim an NSW subtopic`, ch.maps, null);
    ok(`${ch.id} has a generator of its own`, !!GENERATORS[gid]);
    // Every India bank authors ids beginning c11-/c12-, so the prefix table
    // cannot choose between them and each chapter is named individually. A
    // chapter added to a bank but not to that table resolves to no bank, and
    // then loads nothing on a device that has not already loaded everything.
    ok(`${ch.id} resolves to a bank that can be lazily loaded`, !!bankOf(gid));
  } else {
    ok(`${ch.id} maps to a real subtopic (${gid})`, !!SUBTOPIC_BY_ID[gid]);
    ok(`${ch.id} maps to a subtopic that has generators (${gid})`, !!GENERATORS[gid]);
  }
}
for (const ch of IN_CHAPTERS) {
  if (ch.partial) ok(`${ch.id} says which part is covered`, !!generatorFor(ch) && ch.partial.trim().length > 20);
  if (!generatorFor(ch)) same(`${ch.id} claims no partial cover when it has no generator`, ch.partial, null);
}
console.log(`  ${mapped.length} chapters reach ${allGenerators().length} generators — ${mappedGenerators().length} reused from the NSW banks, ${coverage().native.length} written for this curriculum`);

// ── The mapping has to actually produce a markable question ────────────────
console.log('\nQUESTIONS — every mapped chapter, every difficulty, marked by its own marker');
const DRAWS = 12;
let made = 0, marked = 0, wellFormed = 0, broken = [];
for (const ch of mapped) {
  const gid = generatorFor(ch);
  for (let d = 1; d <= 4; d++) {
    for (let i = 0; i < DRAWS; i++) {
      let q;
      try { q = generateQuestion(gid, d, `in-${ch.id}-${d}-${i}`); }
      catch (e) { broken.push(`${ch.id} → ${gid} d${d}: threw ${e.message}`); continue; }
      if (!q || !q.prompt) { broken.push(`${ch.id} → ${gid} d${d}: produced no question`); continue; }
      made++;
      // The same well-formedness inspection selfcheck.mjs runs over the NSW
      // bank: no NaN or undefined leaking into prose, no floating-point
      // artefact in a keyed value, an integer where the question asks for a
      // count, hints and steps present.
      const problems = inspect(q);
      if (!problems.length) wellFormed++;
      else if (broken.length < 12) broken.push(`${ch.id} → ${gid} d${d}: ${problems[0]}`);
      if (q.multipart) { marked++; continue; }
      // The keyed answer is read exactly as selfcheck.mjs reads it. A question
      // that demands a simplest fraction or a surd is right to reject the
      // decimal, so feeding it one would test the opposite of what it asks.
      const forms = answerForms(q);
      if (!forms.length) { marked++; continue; }
      let allOk = true;
      for (const form of forms) {
        let res;
        try { res = checkAnswer(q, form.input); }
        catch (e) { res = { correct: false, feedback: `threw ${e.message}` }; }
        if (!res.correct) {
          allOk = false;
          if (broken.length < 12) broken.push(`${ch.id} → ${gid} d${d}: keyed ${form.label} "${form.input}" is marked wrong by its own marker`);
        }
      }
      if (allOk) marked++;
    }
  }
}
ok(`every mapped chapter produced questions — ${broken.length} problem(s)`, broken.length === 0);
same('every generated question passed its own marker', marked, made);
same('every generated question is well formed', wellFormed, made);
console.log(`  ${made} questions generated across ${mapped.length} chapters × 4 difficulties × ${DRAWS} draws — ${marked} marked correct by their own marker, ${wellFormed} well formed`);
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
ok('nothing is counted as both full and partial', c.full.every(x => !c.partial.includes(x)));
const reach = c.full.length + c.partial.length;
console.log(`  ${c.total} chapters — ${c.full.length} full, ${c.partial.length} partial, ${c.none.length} none`);
console.log(`  ${reach}/${c.total} (${(reach / c.total * 100).toFixed(1)}%) can be practised today; ${c.none.length} cannot and are listed by tools/india-coverage.mjs`);
console.log(`  Read that with the line above it: ${c.full.length} chapters are covered whole and ${c.partial.length} only in part, so "can be practised" means the chapter sets questions, not that every dot point in it does.`);
console.log('  This is a count of chapters with a generator behind them, not a claim that the questions are pitched at NCERT level — no Indian teacher has read one.');

if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures.slice(0, 30)) console.log(`  ${line}`);
  if (failures.length > 30) console.log(`  … and ${failures.length - 30} more`);
}
console.log(`\n${fail ? '✖ INDIA SUITE FAILED' : '✔ INDIA SUITE PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
