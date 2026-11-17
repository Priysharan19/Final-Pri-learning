// Pri Learning · edition parity truth (audit P0 #37, #38).
//
//   #37  Every way the two editions mark differently is DECLARED, with its reason, in
//        client/edition.config.mjs, and the running server is held to the declaration:
//        the config's marking policy, the policy sealed on issued items
//        (editionBanks.js) and the method-mark switch (editionMarking.js) agree; any
//        facet that differs between editions and is not declared fails, and so does a
//        declaration that no longer differs.
//   #38  Every issued item, in both editions, carries a non-null curriculum identity.
//        Priyabhata's names board, class, NCERT chapter, topic and syllabus year;
//        Prithagoras's names syllabus and outcome codes.
//   Also: the accessibility walk runs on a Prithagoras build in CI.
// SYNTHETIC: generated questions, no student.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const SRC = new URL('../src/', import.meta.url).href;
const { EDITIONS, PARITY_DECLARED, MARKING_POLICIES } = await import('../edition.config.mjs');
const { bankPolicy, sealForEdition, FINAL_ANSWER_MARKING } = await import('../../server/platform/editionBanks.js');
const { UNCERTIFIED_EDITIONS, editionMarkingPolicy } = await import('../../server/platform/editionMarking.js');
const { FINAL_ANSWER_ONLY } = await import('../../server/platform/markingPolicy.js');
const { indiaBank } = await import('../../server/platform/indiaBanks.js');
const { nswBank } = await import('../../server/platform/nswBanks.js');
const { INDIA_SYLLABUS_VERSION } = await import('../../server/platform/indiaIdentity.js');
const { GENERATORS, generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
await loadAllBanks();
let checks = 0; const failures = [];
const ok = (c, t) => { checks++; if (!c) failures.push(t); };
const keys = Object.keys(EDITIONS);

// ── #37 · marking is declared, and the server does what is declared ─────────
for (const k of keys) {
  const m = EDITIONS[k].marking;
  ok(MARKING_POLICIES.includes(m?.policy) && m.reason?.length >= 40, `${k} declares a marking policy and its reason`);
  const sealed = bankPolicy(k).marking;
  ok(sealed === (m.policy === 'final-answer-only' ? FINAL_ANSWER_MARKING : null), `${k}: the marking sealed on issued items (${sealed}) is the declared one (${m.policy})`);
  ok(UNCERTIFIED_EDITIONS.includes(k) === (m.policy === 'final-answer-only'), `${k}: editionMarking.js UNCERTIFIED_EDITIONS agrees with the declaration`);
  if (m.policy === 'final-answer-only') {
    const env = { PRI_EDITION: k, PRI_METHOD_MARKS: 'on', PRI_METHOD_MARKS_EXAMINER_RESULT: 'anything' };
    ok(editionMarkingPolicy(env) === FINAL_ANSWER_ONLY, `${k}: method marks are refused whatever is set`);
  }
}
ok(FINAL_ANSWER_MARKING === 'final-answer-only', 'the sealed marking label is the declared policy name');

// The facets the running server actually differs on, against the declaration.
const facet = {
  marking: k => EDITIONS[k].marking.policy,
  admission: k => (bankPolicy(k).admits ? 'gated' : 'open'),
  identity: k => (bankPolicy(k).identityOf ? 'sealed' : 'none'),
  billingProviders: k => JSON.stringify(EDITIONS[k].billing.providers),
  sealedMarking: k => String(bankPolicy(k).marking),
  methodMarkSwitch: k => String(UNCERTIFIED_EDITIONS.includes(k))
};
const covers = { sealedMarking: 'marking', methodMarkSwitch: 'marking' };   // consequences of the marking policy
const differing = Object.keys(facet).filter(f => new Set(keys.map(facet[f])).size > 1).map(f => covers[f] || f);
for (const f of new Set(differing)) ok(Object.hasOwn(PARITY_DECLARED, f) && PARITY_DECLARED[f].length > 40, `the editions differ in ${f}, so it must be declared with a reason in PARITY_DECLARED`);
for (const f of Object.keys(PARITY_DECLARED)) ok(differing.includes(f), `${f} is declared as a difference but the editions no longer differ`);
ok(!differing.includes('identity') && !Object.hasOwn(PARITY_DECLARED, 'identity'), 'curriculum identity is sealed in both editions and may never be declared as a difference');

// ── #38 · every issued item carries a curriculum identity ───────────────────
const seal = (edition, generator, difficulty, seed) => {
  let q;
  try { q = generateQuestion(generator, difficulty, seed); } catch { return null; }
  if (!q) return null;
  q._generator = generator;
  const banks = bankPolicy(edition);
  const admitted = !banks.admits || banks.admits(q, generator);
  return { q, admitted, sealed: sealForEdition(q, banks, generator) };
};
const stats = { priyabhata: { items: 0, sealed: 0 }, prithagoras: { items: 0, sealed: 0, notAdmitted: 0 } };
const classes = new Set(), chapters = new Set();
for (const g of Object.keys(GENERATORS)) {
  for (let d = 1; d <= 4; d++) for (const seed of [11, 4242]) {
    if (indiaBank(g)) {
      const r = seal('priyabhata', g, d, seed);
      if (r) {
        stats.priyabhata.items++;
        const id = r.q._curriculum;
        if (r.sealed && id && id.jurisdiction === 'IN' && id.chapterId && id.generator === g) stats.priyabhata.sealed++;
        else ok(false, `priyabhata ${g} D${d}: issued with no usable curriculum identity (${JSON.stringify(id)})`);
        if (id?.class) classes.add(id.class); if (id?.chapterId) chapters.add(id.chapterId);
        if (id && !(id.board === 'CBSE' ? id.class && id.syllabusVersion === INDIA_SYLLABUS_VERSION && id.syllabus && id.chapterName : true)) ok(false, `priyabhata ${g}: a CBSE identity names class, syllabus and syllabus year`);
        if (id && JSON.stringify(JSON.parse(JSON.stringify(id))) !== JSON.stringify(id)) ok(false, `priyabhata ${g}: identity is plain JSON`);
      }
    }
    if (nswBank(g)) {
      const r = seal('prithagoras', g, d, seed);
      if (r) {
        if (!r.admitted) { stats.prithagoras.notAdmitted++; continue; }
        stats.prithagoras.items++;
        const id = r.q._curriculum;
        if (r.sealed && id?.outcomes?.length && id.syllabus && id.syllabusVersion) stats.prithagoras.sealed++;
        else ok(false, `prithagoras ${g} D${d}: admitted but sealed with no curriculum identity`);
      }
    }
  }
}
ok(stats.priyabhata.items > 400 && stats.priyabhata.sealed === stats.priyabhata.items, `every issued Priyabhata item has a curriculum identity (${stats.priyabhata.sealed} of ${stats.priyabhata.items})`);
ok(stats.prithagoras.items > 100 && stats.prithagoras.sealed === stats.prithagoras.items, `every issued Prithagoras item has a curriculum identity (${stats.prithagoras.sealed} of ${stats.prithagoras.items}; ${stats.prithagoras.notAdmitted} not issued)`);
ok(classes.size >= 6 && chapters.size >= 60, `Priyabhata identities span ${classes.size} classes and ${chapters.size} chapters`);
// A question the curriculum cannot place is refused, not sealed with an empty identity.
{
  const q = { difficulty: 1, _generator: 'not-a-generator' };
  ok(sealForEdition(q, bankPolicy('priyabhata'), 'not-a-generator') === false && q._curriculum === undefined, 'a question outside the curriculum is not issued and carries no identity');
}

// ── The accessibility walk runs on Prithagoras in CI ────────────────────────
const ci = read('.github/workflows/ci.yml');
const group = ci.slice(ci.indexOf('edition-prithagoras)'), ci.indexOf("unknown browser group"));
ok(/a11y-gate\.mjs/.test(group) && /PRI_EDITION" = prithagoras/.test(group), 'CI: the edition-prithagoras browser group runs the accessibility gate on a Prithagoras build');
ok(/"test:a11y:prithagoras": "PRI_EDITION=prithagoras node client\/test\/a11y-gate\.mjs"/.test(read('package.json')), 'package.json: test:a11y:prithagoras exists');
ok(/resolveEdition\(process\.env\)/.test(read('client/test/a11y-check.mjs')), 'the walk resolves its edition from PRI_EDITION');

console.log(`marking differences declared: ${Object.keys(PARITY_DECLARED).join(', ')}; Priyabhata ${stats.priyabhata.sealed}/${stats.priyabhata.items} items sealed, Prithagoras ${stats.prithagoras.sealed}/${stats.prithagoras.items}`);
console.log(failures.length
  ? `EDITION PARITY: FAIL — ${failures.length} of ${checks} checks failed\n  · ${failures.slice(0, 30).join('\n  · ')}`
  : `EDITION PARITY: PASS — ${checks} checks — marking declared and enforced per edition, every issued item in both editions carries a curriculum identity, the accessibility walk runs on Prithagoras. [SYNTHETIC]`);
process.exit(failures.length ? 1 : 0);
