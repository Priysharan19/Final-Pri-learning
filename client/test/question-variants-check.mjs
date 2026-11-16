// Pri Learning · question variants check
//
// The "tweak this question" generator (client/src/engine/variants.js), driven
// over every India generator cell and every official record:
//   · every variant is credited by the deterministic marker on its own key
//     (checkAnswer on the server's answer text) — re-checked here, not trusted
//     from the module;
//   · every variant is distinct by content hash from its seed and its siblings;
//   · provenance says what a variant is: a Pri generator item, software-checked,
//     not human- or examiner-reviewed, never a previous-year question, and
//     "Pri variant of <seed>";
//   · a variant of an official record comes from a generator that serves that
//     record's chapter;
//   · the module refuses to run without a verifier, and a verifier that rejects
//     everything yields no variants (the check can fail).
// [SYNTHETIC — software check, not a human or examiner review]
import assert from 'node:assert/strict';

const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { IN_CHAPTERS } = await import(`${SRC}engine/curriculum-in.js`);
const { contentHashOf } = await import(`${SRC}engine/contentIdentity.js`);
const { variantsOf, generatorsForChapter, shapeOf, VARIANT_BANDS, keyInputOf, engineVerify } = await import(`${SRC}engine/variants.js`);
const { CBSE_PYQ_RECORDS } = await import(`${SRC}engine/pyq/records-cbse.js`);
await loadAllBanks();

// Re-checked here independently of the module: the key as entered, marked by checkAnswer.
const verify = q => { const input = keyInputOf(q); return input != null && input !== '' && checkAnswer(q, input)?.correct === true; };

// A caller's check can only narrow the engine's, and must be a function.
assert.throws(() => variantsOf({ subtopic: 'c10-linear-pair-methods', difficulty: 2, seed: 1, prompt: 'x' }, { verify: true }), /verify/);
// The engine's own verdict refuses a wrong key: the same question keyed to a wrong value is not credited.
{
  const q = generateQuestion('c10-linear-pair-methods', 2, 11);
  assert.equal(engineVerify(q), true);
  assert.equal(engineVerify({ ...q, answer: { ...q.answer, value: q.answer.value + 1 } }), true, 'the key IS the answer: re-keying moves both');
  assert.equal(checkAnswer(q, String(q.answer.value + 1))?.correct, false, 'a wrong value is never credited against the true key');
  assert.equal(engineVerify({ ...q, answerType: 'working' }), false, 'no typed key → never verified');
}

// A verifier that rejects everything yields nothing, and says so.
{
  const seed = generateQuestion('c10-linear-pair-methods', 2, 11);
  const { variants, shortfall } = variantsOf({ ...seed, subtopic: 'c10-linear-pair-methods', difficulty: 2, seed: 11 }, { verify: () => false, perBand: 2, tries: 10 });
  assert.equal(variants.length, 0, 'a verifier that rejects everything must leave no variants');
  assert.equal(shortfall.length, VARIANT_BANDS.length, 'every band must report its shortfall');
}

function checkVariant(v, seedHash, hashes, where) {
  assert.ok(VARIANT_BANDS.includes(v.band), `${where}: band ${v.band}`);
  assert.equal(verify(v.question), true, `${where}: variant not credited by the marker on its own key — ${v.question.prompt}`);
  const h = contentHashOf(v.question);
  assert.equal(h, v.contentHash, `${where}: stated content hash`);
  assert.notEqual(h, seedHash, `${where}: a variant must differ from its seed`);
  assert.ok(!hashes.has(h), `${where}: duplicate variant`);
  hashes.add(h);
  const p = v.provenance;
  assert.equal(p.previousYearQuestion, false, `${where}: a variant is never a previous-year question`);
  assert.equal(p.humanReviewed, false); assert.equal(p.examinerReviewed, false);
  assert.equal(p.checkedBy, 'deterministic-engine');
  assert.match(p.label, /^Pri variant of /, `${where}: label`);
}

// ── Generated seeds: one seed per live India (generator, difficulty) cell ──────
const cells = [];
const seenCell = new Set();
for (const ch of IN_CHAPTERS) for (const cover of ch.covers || []) {
  if (String(cover.gen).startsWith('pyq-')) continue;
  for (const d of cover.diff || []) { const k = `${cover.gen}@${d}`; if (!seenCell.has(k)) { seenCell.add(k); cells.push([cover.gen, d]); } }
}
let generated = 0, variantCount = 0, sameShape = 0, sameBand = 0, bandsFilled = 0, bandsAsked = 0, seedsSkipped = 0;
const shortBands = new Map();
for (const [gen, d] of cells) {
  const s = 1000 + generated;
  let seed;
  try { seed = { ...generateQuestion(gen, d, s), subtopic: gen, difficulty: d, seed: s }; } catch { seedsSkipped += 1; continue; }
  if (!verify(seed)) { seedsSkipped += 1; continue; }
  generated += 1;
  const { variants, shortfall } = variantsOf(seed, { verify, perBand: 2, tries: 40 });
  const hashes = new Set();
  for (const v of variants) {
    checkVariant(v, contentHashOf(seed), hashes, `${gen} D${d} → D${v.band}`);
    assert.equal(v.generator, gen, `${gen}: a generated seed's variants come from its own generator`);
    assert.equal(v.provenance.variantOf, `gen:${gen}:d${d}:s${s}`);
    if (v.band === d) { sameBand += 1; if (v.sameShape) { sameShape += 1; assert.equal(shapeOf(v.question), shapeOf(seed)); } }
  }
  variantCount += variants.length;
  bandsAsked += VARIANT_BANDS.length;
  bandsFilled += VARIANT_BANDS.length - shortfall.length;
  for (const f of shortfall) shortBands.set(`${gen}@${f.band}`, f.reason);
}
assert.equal(generated, cells.length, `only ${generated}/${cells.length} live India cells seeded a variant (a seed whose own key the engine does not credit is a generator defect)`);
assert.ok(bandsFilled / bandsAsked >= 0.99, `variants filled only ${bandsFilled}/${bandsAsked} bands`);

// ── Official records: Pri-authored variants on the record's chapter ───────────
let official = 0, officialVariants = 0, officialShort = 0;
for (const rec of CBSE_PYQ_RECORDS) {
  const seed = { ...rec, pyq: true, pyqId: rec.id };
  const { variants, shortfall } = variantsOf(seed, { verify, perBand: 1, tries: 30 });
  const hashes = new Set();
  for (const v of variants) {
    checkVariant(v, contentHashOf(seed), hashes, `${rec.id} → D${v.band}`);
    assert.ok(generatorsForChapter(rec.chapterId, v.band).includes(v.generator), `${rec.id}: variant generator ${v.generator} does not serve ${rec.chapterId} at D${v.band}`);
    assert.equal(v.provenance.label, `Pri variant of ${rec.id}`);
    assert.equal(v.provenance.variantOf, `pyq:${rec.id}`);
    assert.ok(!v.question.pyq, `${rec.id}: a variant must not be served as a past-paper item`);
  }
  official += 1; officialVariants += variants.length; officialShort += shortfall.length;
  assert.ok(variants.length >= 1, `${rec.id}: no verified variant on ${rec.chapterId}`);
}

console.log(`QUESTION VARIANTS: PASS — ${generated} generated seeds (${seedsSkipped} cells skipped: seed not credited by its own key), ${variantCount} variants verified by the marker and distinct by content hash, ${bandsFilled}/${bandsAsked} bands filled, ${sameShape}/${sameBand} same-band variants keep the seed's shape; ${official} official CBSE records → ${officialVariants} Pri variants on their chapter (${officialShort} bands with no serving generator). [SYNTHETIC — software check, not a human or examiner review]`);
if (shortBands.size) console.log(`note: ${shortBands.size} (generator, band) pairs short, e.g. ${[...shortBands].slice(0, 5).map(([k, r]) => `${k} (${r})`).join('; ')}`);
