// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · POST /v1/practice/:id/line-comments
//
// Runs AFTER the answer was marked, from the server's own stored reply for that
// attempt: the engine's states, the reading's per-line states and the question
// are read from the server's records, never from the request. The request names
// only the attempt (and the language). The marks are already committed and are
// not touched here.
//
//   · one comment call per marked answer: the result is stored with the attempt
//     (idempotency_keys scope 'practice-line-comments'); asking again returns
//     the stored comments free, and the same lines under another attempt reuse them
//   · a per-account allowance kind 'comments' (one unit per answer) in front of
//     the deployment's paid-call ceiling; a refusal of either is not an error:
//     the page keeps the engine's own sentences
//   · feature flag PRI_FEATURE_LINE_COMMENTS (a SERVER variable, off by default): off means
//     the route answers `enabled: false` with no comments before it reads anything, no model,
//     no allowance, no spend, nothing stored; the page keeps the engine's own sentences
//   · only AI-written comments that passed the engine's rules are ever returned; a line with no
//     comment shows the engine's own sentence
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { asStore } from '../store.js';
import { consumeAiAllowance, refundAiAllowance } from '../aiAllowance.js';
import { reservePaidCall, refundPaidCall } from '../spendCeiling.js';
import { generateLineComments, questionView, lineCommentsEnabled, lineCommentsConfig, COMMENTS_VERSION } from './index.js';

export const COMMENTS_SCOPE = 'practice-line-comments';
const PENDING_MS = 60_000;
const sha = s => createHash('sha256').update(s).digest('hex');
const editionName = id => (id === 'prithagoras' ? 'NSW' : 'India');

/** What a stored/served body looks like to the device: no internals, no stats beyond what is honest. */
export function publicBody(stored, { questionId, attemptId }) {
  const comments = (stored.comments || []).map(c => ({
    index: c.index, n: c.n, state: c.state, lineText: c.lineText, text: c.text, kind: c.kind, source: c.source, at: c.at, model: c.model
  }));
  return {
    authoritative: true, enabled: true, questionId, attemptId, version: stored.version, language: stored.language, generatedAt: stored.generatedAt,
    comments, aiWritten: comments.length > 0, ...(stored.note ? { note: stored.note } : {})
  };
}

/** The reply when the feature is off: the same shape, no comments, and it says so. */
export const notEnabledBody = () => ({ authoritative: true, enabled: false, comments: [], aiWritten: false });

export function createLineCommentsHandler({ db, env = process.env, deps }) {
  const { UUID, reject, MAX_AGE, solutionFor, marksPossibleFor, serverEdition } = deps;
  db = asStore(db);
  return async function lineComments(req, res) {
    // Off (the default): nothing is read, asked, reserved or stored.
    if (!lineCommentsEnabled(env)) return res.status(200).json(notEnabledBody());
    const qid = String(req.params.id || '');
    const body = req.body ?? {};
    const attemptId = String(body.attemptId || '');
    const language = body.language === 'hi' ? 'hi' : 'en';
    if (!UUID.test(qid) || !UUID.test(attemptId)) return reject(res, 404, 'ATTEMPT_NOT_FOUND', 'This attempt does not belong to this account.');
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const escrow = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, qid, now]);
    const completion = escrow ? await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]) : null;
    let completed = null; try { completed = completion ? JSON.parse(completion.response_json) : null; } catch { completed = null; }
    if (!escrow || !completed || completed.attemptId !== attemptId) return reject(res, 404, 'ATTEMPT_NOT_FOUND', 'This attempt does not belong to this account.');
    const gradeRow = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-grade' AND response_json LIKE ?", [accountId, `%"attemptId":"${attemptId}"%`]);
    let grade = null; try { grade = gradeRow ? JSON.parse(gradeRow.response_json) : null; } catch { grade = null; }
    if (!grade || grade.questionId !== qid || grade.attemptId !== attemptId || grade.invalid === true || grade.resolved !== true || !grade.stepReport?.lines?.length) {
      return res.status(200).json({ authoritative: true, questionId: qid, attemptId, comments: [], aiWritten: false });
    }
    let q; try { q = JSON.parse(escrow.response_json); } catch { return reject(res, 404, 'ATTEMPT_NOT_FOUND', 'This attempt does not belong to this account.'); }

    const linesDigest = sha(JSON.stringify([grade.stepReport.lines.map(l => [l.text, l.status, l.state || null, l.note || null]), grade.reading?.lineStates || null, language, COMMENTS_VERSION]));
    const key = sha(`${qid}:${linesDigest}`).slice(0, 40);
    const existing = await db.get('SELECT response_json, created_at FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, COMMENTS_SCOPE, key]);
    if (existing) {
      let stored = null; try { stored = JSON.parse(existing.response_json); } catch { stored = null; }
      if (stored && !stored.pending) return res.status(200).json(publicBody(stored, { questionId: qid, attemptId }));
      if (stored?.pending && now - Number(existing.created_at) < PENDING_MS) {
        return res.status(202).json({ authoritative: true, questionId: qid, attemptId, pending: true, comments: [], aiWritten: false });
      }
    }

    const rs = grade.reading?.lineStates;
    const readStates = Array.isArray(rs) && rs.length === grade.stepReport.lines.length ? rs : null;
    const view = questionView(q, { marks: marksPossibleFor(q) });
    const solution = solutionFor(q);
    const edition = editionName(serverEdition(env));
    const wantModel = lineCommentsEnabled(env) && lineCommentsConfig(env).usable;
    let allowance = null; let reservation = null; let note = null; let spent = false;
    if (wantModel) {
      allowance = await consumeAiAllowance(db, { accountId, kind: 'comments', env, now });
      if (!allowance.allowed) { note = 'allowance'; }
    }
    const authorize = async () => {
      const r = await reservePaidCall(db, { env, now: Date.now() });
      if (r.verdict) { note = 'ceiling'; return r.verdict; }
      reservation = r; spent = true; return null;
    };
    // The claim: only one request per answer spends anything.
    const pending = JSON.stringify({ pending: true });
    const claim = await db.run('INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json, created_at=excluded.created_at WHERE idempotency_keys.response_json LIKE \'%"pending":true%\' AND idempotency_keys.created_at < ?',
      [accountId, COMMENTS_SCOPE, key, pending, linesDigest, now, now + MAX_AGE, now - PENDING_MS]);
    if (claim.changes !== 1) {
      if (allowance?.allowed) await refundAiAllowance(db, allowance);
      return res.status(202).json({ authoritative: true, questionId: qid, attemptId, pending: true, comments: [], aiWritten: false });
    }
    let out;
    try {
      out = await generateLineComments({
        stepReport: grade.stepReport, readStates,
        question: view, solution, edition, language, resolved: grade.resolved === true, env,
        authorize, useModel: wantModel && allowance?.allowed === true, now
      });
    } catch (error) {
      await db.run('DELETE FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [accountId, COMMENTS_SCOPE, key]);
      if (allowance?.allowed) await refundAiAllowance(db, allowance);
      if (reservation) await refundPaidCall(db, reservation);
      return reject(res, 500, 'LINE_COMMENTS_FAILED', 'Comments could not be prepared.');
    }
    // Nothing was sent to the provider: give the unit back.
    if (allowance?.allowed && !out.stats.calls) await refundAiAllowance(db, allowance);
    if (reservation && !out.stats.calls) await refundPaidCall(db, reservation);
    const stored = {
      version: out.version, attemptId, questionId: qid, language, edition, generatedAt: out.generatedAt, comments: out.comments,
      ...(note ? { note } : {}),
      // Kept for the account's own export and for operations; never the key or the prompt.
      provenance: { model: out.stats.model, calls: out.stats.calls, status: out.stats.status, accepted: out.stats.accepted, rejected: out.stats.rejected, spent }
    };
    await db.run('UPDATE idempotency_keys SET response_json=?, request_digest=?, created_at=? WHERE account_id=? AND scope=? AND key=?',
      [JSON.stringify(stored), linesDigest, now, accountId, COMMENTS_SCOPE, key]);
    return res.status(200).json(publicBody(stored, { questionId: qid, attemptId }));
  };
}
