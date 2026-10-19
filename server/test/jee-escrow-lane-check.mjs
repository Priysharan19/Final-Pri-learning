// #395: the answer-private JEE lane. The public source never carries an answer,
// an escrow inside the repository is refused, every gate fails closed, and only
// a fully cleared escrow entry yields a server question the deterministic
// engine marks. Synthetic escrow only; no real answer is written anywhere here.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, unlinkSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JEE_2026_COMPLEX_ORIGINAL_BLIND as pack } from '../../client/src/engine/ncert/jee-2026-complex-original-blind.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { ESCROW_PUBLIC_FIELDS, contentHash, publicQuestion, loadEscrow, unavailableReason, issuable, serverQuestion } from '../platform/jeeEscrow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// 1. Public payloads carry only the whitelisted fields; no answer-shaped key.
for (const q of pack.questions) {
  const p = publicQuestion(q);
  ok(JSON.stringify(Object.keys(p)) === JSON.stringify(ESCROW_PUBLIC_FIELDS), q.id + ' public field set');
  for (const k of ['answer', 'steps', 'solution', 'workedSolution', 'markScheme', 'rubric', 'mcqOptions']) ok(!(k in p), q.id + ' leaks ' + k);
  ok(/^[0-9a-f]{64}$/.test(p.contentHash), q.id + ' content hash');
}

// 2. With no escrow configured, every question is honestly unavailable.
const none = loadEscrow({});
ok(issuable(pack.questions, none).every(r => r.reason === 'escrow-not-configured'), 'no escrow → all unavailable');

// 3. An escrow file inside the repository is refused outright.
{ const inRepo = path.join(ROOT, 'server/test/support/.escrow-probe.json'); writeFileSync(inRepo, '{"entries":[]}');
  try {
    ok(loadEscrow({ PRI_JEE_ESCROW_PATH: inRepo }).reason === 'escrow-inside-repository', 'in-repo escrow refused');
    const link = path.join(mkdtempSync(path.join(tmpdir(), 'pri-escrow-link-')), 'escrow.json'); symlinkSync(inRepo, link);
    ok(loadEscrow({ PRI_JEE_ESCROW_PATH: link }).reason === 'escrow-inside-repository', 'symlink into the repo refused');
  } finally { unlinkSync(inRepo); } }
ok(loadEscrow({ PRI_JEE_ESCROW_PATH: path.join(tmpdir(), 'pri-no-such-escrow.json') }).reason === 'escrow-unreadable', 'missing file');

// 4. Synthetic question + escrow outside the repo; each gate fails closed.
const q = { id: 'synthetic-escrow-q1', archetypeId: 'synthetic', track: 'JEE-Advanced', syllabusTopic: 'synthetic', question: 'Find the value of 7 × 13.', firstHint: 'Multiply tens, then units.', version: '1' };
const good = {
  questionId: q.id, contentHash: contentHash(q), answerType: 'numeric', answer: { value: 91 },
  rights: { status: 'cleared', evidenceRef: 'synthetic-licence', recordedBy: 'A. Rights Reviewer' },
  review: { tier: 'human', reviewedBy: 'A. Maths Reviewer', reviewedAt: '2026-10-19T00:00:00Z' }
};
const dir = mkdtempSync(path.join(tmpdir(), 'pri-escrow-'));
const write = entries => { const f = path.join(dir, 'escrow-' + checks + '.json'); writeFileSync(f, JSON.stringify({ entries })); return loadEscrow({ PRI_JEE_ESCROW_PATH: f }); };
const variants = [
  [e => ({ ...e, contentHash: '0'.repeat(64) }), 'escrow-not-bound-to-public-text'],
  [e => ({ ...e, rights: { ...e.rights, status: 'owner-confirmed' } }), 'rights-not-cleared'],
  [e => ({ ...e, rights: { ...e.rights, evidenceRef: '' } }), 'rights-not-cleared'],
  [e => ({ ...e, rights: { ...e.rights, recordedBy: 'automated:bot' } }), 'rights-not-cleared'],
  [e => ({ ...e, review: { ...e.review, tier: 'automated' } }), 'no-human-maths-review'],
  [e => ({ ...e, review: { ...e.review, reviewedBy: 'claude-review' } }), 'no-human-maths-review'],
  [e => ({ ...e, answerType: 'selfcheck' }), 'no-keyed-answer'],
  [e => ({ ...e, answer: null }), 'no-keyed-answer']
];
for (const [mutate, reason] of variants) {
  const esc = write([mutate(good)]);
  ok(unavailableReason(q, esc) === reason, 'expected ' + reason);
  ok(serverQuestion(q, esc).ok === false, 'no server question when ' + reason);
}
ok(unavailableReason({ ...q, id: 'other' }, write([good])) === 'no-escrow-entry', 'unknown id');
ok(unavailableReason({ ...q, question: q.question + ' ' }, write([good])) === 'escrow-not-bound-to-public-text', 'edited public text unbinds escrow');

// 5. A cleared entry yields a server question the deterministic engine marks.
const sq = serverQuestion(q, write([good]));
ok(sq.ok && sq.question.answer.value === 91, 'server question built');
ok(checkAnswer(sq.question, '91').correct === true, 'engine marks the keyed answer correct');
for (const wrong of ['92', '90', '9.1', '-91', '910']) ok(checkAnswer(sq.question, wrong).correct === false, 'engine rejects ' + wrong);

// 6. The 20 recovered JEE questions have no escrow today: all unavailable, none issuable.
ok(issuable(pack.questions, write([good])).every(r => r.reason === 'no-escrow-entry'), 'recovered pack stays unissuable');

// 7. No client shard or client source carries a recovered question id next to an answer.
const ids = pack.questions.map(x => x.id);
const walk = d => readdirSync(d).flatMap(n => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk(path.join(ROOT, 'client/src')).filter(f => /\.(js|jsx|mjs)$/.test(f))) {
  const s = readFileSync(f, 'utf8');
  if (!ids.some(id => s.includes(id))) continue;
  ok(f.endsWith(path.join('ncert', 'jee-2026-complex-original-blind.js')) || f.endsWith(path.join('ncert', 'jee-2026-complex-d4-certification.js')), 'recovered id appears in unexpected client file ' + f);
}

console.log(`JEE ESCROW LANE: PASS — ${checks}/${checks} checks — 20 public questions answer-blind, 0 issuable without escrow, in-repo escrow refused`);
