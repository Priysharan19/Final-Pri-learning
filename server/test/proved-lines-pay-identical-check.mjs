// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the display-only ticks never change what is paid, on the real approved lists (R4)
//
// Boots the shipped /v1 app as Prithagoras with PRI_METHOD_MARKS=on and the REAL author-approved lists (nothing approved in this process), and submits
// authored transcripts (solution lists, rounded values, labelled substitutions, restated equations, ...) of the generic-eligible and the scheme
// questions. For every resolved reply:
//   · the mark and the criteria are exactly what the deterministic report pays (the proved-line pass switched off, in process)
//   · the scheme table (methodCriteria) is the server's marks: what it awards adds up to what the reply earned
//   · every line a criterion says it was earned by is ticked in the report the page displays, and was ticked by the deterministic report itself:
//     a line only the display pass ticked never earns a criterion
// The same pages replayed on origin/main and on this branch pay identically (checked once at merge time; see the PR).
//
//   node server/test/proved-lines-pay-identical-check.mjs
// SYNTHETIC: generated questions and rule-built transcripts. Not evidence about real students.
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_OFFERING', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION', 'PRI_METHOD_MARKS', 'PRI_METHOD_MARKS_EXAMINER_RESULT', 'PRI_QBANK_DIR'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-pay-ident-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c5'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
process.env.PRI_EDITION = 'prithagoras';
process.env.PRI_OFFERING = 'catalogue';
process.env.PRI_METHOD_MARKS = 'on';
process.env.PRI_QBANK_DIR = 'off';
delete process.env.PRI_METHOD_MARKS_EXAMINER_RESULT;
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const G = await import('../../client/src/engine/generators/index.js');
const C = await import('../../tools/understanding-audit/corpus.mjs');
const { SCHEMES, schemePay } = await import('../platform/schemeAward.js');
const { genericEligible } = await import('../platform/genericSteps.js');
const { sealForEdition, bankPolicy } = await import('../platform/editionBanks.js');
const { stepEvidence, marksPossibleFor, practiceMarksEarned } = await import('../platform/markerOps.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
await G.loadAllBanks();
const c = checks();

const schemeFams = new Set(SCHEMES.flatMap(s => s.families));
const fin = lines => { const l = lines[lines.length - 1]?.text ?? ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };
const pages = [];
for (const f of (await C.loadFamilies()).filter(x => C.editionOf(x) === 'NSW')) {
  if (!/^(y11|y12|me11|me12)-/.test(f)) continue;
  for (const q of C.questionsFor(f, [11, 23])) {
    if (!schemeFams.has(f) && !genericEligible(q)) continue;
    for (const t of C.transcriptsFor(q)) pages.push({ f, d: q.difficulty, seed: q.seed, style: t.style, text: t.lines.map(l => l.text).join('\n'), final: fin(t.lines) });
  }
}
// every 6th page keeps the run short while covering every style and both scheme and generic questions
const sample = pages.filter((_, i) => i % 6 === 0);

const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'pay.ident@example.test', deviceId: 'ipad-pay-ident' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student');
  let resolved = 0, paid = 0, extraTicks = 0, n = 0;
  const styles = new Set();
  for (const p of sample) {
    if (n++ % 80 === 0) await h.db.run('DELETE FROM rate_limits');
    for (const answer of ['99991', p.final]) {
      const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { curriculum: 'nsw', generator: p.f, difficulty: p.d, seed: p.seed } });
      if (r.status !== 201) continue;
      const qid = r.data.question.id;
      const sub = id => h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed', steps: p.text } });
      let s = await sub(`pay-ident-${n}-${answer.length}-a`); if (!s.data?.resolved) s = await sub(`pay-ident-${n}-${answer.length}-b`);
      const d = s.data;
      if (!d?.resolved) continue;
      resolved++; styles.add(p.style);
      // the deterministic report for the same page (proved lines off), paid by the same scheme
      const q = G.generateQuestion(p.f, p.d, p.seed);
      sealForEdition(q, bankPolicy('prithagoras'), p.f);   // the stamp the issue route puts on it
      const result = checkAnswer(q, answer);
      const ev = stepEvidence(q, answer, p.text, result, { slipWarnings: true, proved: false });
      const N = marksPossibleFor(q);
      const pay = q._methodScheme ? schemePay({ q, report: ev.stepReport || null, topic: ev.topicTicks ?? null, correct: result.correct === true, marksPossible: N, env: process.env }) : { paid: false };
      if (pay.paid) {
        paid++;
        c.eq(d.marksEarned, practiceMarksEarned(q, result, { ...ev, partial: pay.partial }, N), `${p.f} d${p.d} s${p.seed} ${p.style}: the mark is what the deterministic report pays`);
        c.eq(JSON.stringify(d.methodCriteria?.items), JSON.stringify(pay.items), `${p.f} d${p.d} s${p.seed} ${p.style}: the table is the deterministic table`);
        const got = (d.methodCriteria?.items ?? []).filter(i => i.awarded).reduce((m, i) => m + i.marks, 0);
        c.eq(d.marksEarned, d.correct === true ? d.marksPossible : Math.min(got, d.marksPossible - 1), `${p.f}: the table's awarded marks (${got}) are the reply's mark (${d.marksEarned})`);
        for (const i of d.methodCriteria?.items ?? []) {
          if (!i.awarded || !Array.isArray(i.lines)) continue;
          for (const ln of i.lines) {
            c.ok(d.stepReport?.lines?.[ln - 1]?.status === 'ok', `${p.f} d${p.d} s${p.seed} ${p.style}: earning line ${ln} is ticked on the page`);
            c.ok(ev.stepReport?.lines?.[ln - 1]?.status === 'ok', `${p.f} d${p.d} s${p.seed} ${p.style}: earning line ${ln} is ticked by the deterministic report`);
          }
        }
      } else {
        c.ok(!d.methodScheme?.paid, `${p.f} d${p.d} s${p.seed} ${p.style}: nothing paid where the deterministic report pays nothing`);
      }
      const det = ev.stepReport?.lines ?? [];
      (d.stepReport?.lines ?? []).forEach((l, i) => { if (l.status === 'ok' && det[i] && det[i].status !== 'ok') extraTicks++; });
    }
  }
  c.ok(resolved >= 100, `enough resolved pages (${resolved})`);
  c.ok(paid >= 20, `enough paid pages (${paid})`);
  c.ok(extraTicks >= 1, `the page shows ticks beyond the deterministic report (${extraTicks}), none of them paid`);
  c.ok(styles.size >= 5, `many transcript styles covered (${[...styles].join(',')})`);
} finally {
  await h.close();
}
rmSync(scratch, { recursive: true, force: true });
for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
console.log(`PROVED LINES PAY IDENTICAL: PASS: ${c.count()}/${c.count()} checks`);
