// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · /v1/tutor
//
// Grounded, three-level help for a practice question: a nudge, then a Socratic
// question, then a narrated walkthrough of the verified solution. The words
// may come from a model; the mathematics never does, and nothing here marks.
//
// What this route guarantees, in the order the handler enforces it:
//
//   1. Signed in, email verified, guardian consent (mounted in router.js), and
//      a per-account hourly limit.
//   2. Practice only. A body that does not say `context: "practice"` is
//      refused, and one that says "exam" is refused with TUTOR_EXAM_LOCKED.
//      The local backend refuses earlier still (assertPracticeRow), so an exam
//      question never reaches this server; this is the second wall, not the
//      only one.
//   3. A closed, size-bounded body. No names, emails or profile ids: the only
//      student data sent on is the work lines and typed answer.
//   4. Cache before spend. An identical request in the last 24 hours is
//      answered from tutor_cache without a model call.
//   5. One unit of the deployment-wide paid-call ceiling per model call.
//   6. The reply is checked against the verified solution (tutorGuard.js). A
//      leaked answer is regenerated once; a second leak falls back to the
//      question's own authored hint. Captions that carry any mathematics not in
//      the solution are replaced by the deterministic caption.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore, sqliteHandle } from './store.js';
import { rateLimit, requireSession, requireVerifiedEmail } from './security.js';
import { consumePaidCall, refusePaidCall } from './spendCeiling.js';
import { captionMathOk, forbiddenExpressions, leakedExpressions, solutionCorpus } from './tutorGuard.js';
import {
  MAX_CAPTION_CHARS, TUTOR_LEVELS, TUTOR_LOCALES, TutorProviderError, askTutorModel, providerConfig
} from './tutorProvider.js';

export const TUTOR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_TUTOR_BODY_BYTES = 48 * 1024;
export const TUTOR_RATE_LIMIT = Object.freeze({ limit: 60, windowMs: 60 * 60 * 1000 });

const LIMITS = Object.freeze({
  prompt: 2_000, steps: 24, stepHeading: 300, stepDetail: 700, answer: 300,
  hints: 6, hint: 500, lines: 40, line: 400, typed: 300, captions: 24, caption: 700
});

function ensureTable(db) {
  // SQLite builds its schema here; Postgres is migrated (supabase/migrations).
  const raw = sqliteHandle(db);
  if (!raw) return;
  raw.exec(`CREATE TABLE IF NOT EXISTS tutor_cache (
    cache_key TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tutor_cache_expires ON tutor_cache(expires_at);`);
}

const invalid = (message, code = 'TUTOR_BODY_INVALID', status = 400) => ({ ok: false, status, code, message });
const isText = (value, max, { required = false } = {}) =>
  (value === undefined && !required) || (typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0));
const closed = (object, allowed) => Object.keys(object).filter(key => !allowed.includes(key));
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * The whole body, validated and reduced to exactly what the model may see.
 * Returns { ok: true, request } or a refusal with its HTTP status and code.
 */
export function validateTutorRequest(body) {
  if (!plain(body)) return invalid('Send a JSON body describing the question and the help wanted.');

  // Exam context is checked before anything else, so an exam body is refused
  // for being an exam body — never for some other field it happened to carry.
  if (body.context === 'exam' || body.mode === 'exam' || body.examId !== undefined) {
    return invalid('Help is not available during an exam.', 'TUTOR_EXAM_LOCKED', 403);
  }
  const unknown = closed(body, ['context', 'level', 'locale', 'questionId', 'questionVersion', 'question', 'studentWork', 'captions']);
  if (unknown.length) return invalid(`Unexpected field: ${unknown.join(', ')}.`);
  if (body.context !== 'practice') return invalid('The tutor helps with practice questions only; send context "practice".', 'TUTOR_CONTEXT_REQUIRED');
  if (!TUTOR_LEVELS.includes(body.level)) return invalid(`level must be one of ${TUTOR_LEVELS.join(', ')}.`);
  const locale = body.locale === undefined ? 'en' : body.locale;
  if (!TUTOR_LOCALES.includes(locale)) return invalid(`locale must be one of ${TUTOR_LOCALES.join(', ')}.`);
  if (!isText(body.questionId, 120, { required: true })) return invalid('questionId is required.');
  if (!isText(body.questionVersion, 60)) return invalid('questionVersion must be a short string.');

  const q = body.question;
  if (!plain(q)) return invalid('question must describe the question and its verified solution.');
  const qUnknown = closed(q, ['prompt', 'steps', 'answer', 'hints']);
  if (qUnknown.length) return invalid(`Unexpected question field: ${qUnknown.join(', ')}.`);
  if (!isText(q.prompt, LIMITS.prompt, { required: true })) return invalid('question.prompt is required and bounded.');
  if (!Array.isArray(q.steps) || !q.steps.length || q.steps.length > LIMITS.steps) {
    return invalid(`question.steps must hold 1 to ${LIMITS.steps} verified steps — help is only given against a verified solution.`, 'TUTOR_UNGROUNDED');
  }
  for (const step of q.steps) {
    if (!plain(step) || closed(step, ['h', 'd']).length || !isText(step.h, LIMITS.stepHeading) || !isText(step.d, LIMITS.stepDetail)) {
      return invalid('Each step is { h, d } with bounded text.');
    }
  }
  if (!isText(q.answer, LIMITS.answer, { required: true })) return invalid('question.answer is required: the guard checks every reply against it.', 'TUTOR_UNGROUNDED');
  if (q.hints !== undefined && (!Array.isArray(q.hints) || q.hints.length > LIMITS.hints || !q.hints.every(h => isText(h, LIMITS.hint)))) {
    return invalid('question.hints must be a short list of authored hints.');
  }

  const work = body.studentWork === undefined ? {} : body.studentWork;
  if (!plain(work)) return invalid('studentWork must be an object.');
  const wUnknown = closed(work, ['lines', 'typedAnswer', 'firstBreak', 'misconception']);
  if (wUnknown.length) return invalid(`Unexpected studentWork field: ${wUnknown.join(', ')}.`);
  if (work.lines !== undefined && (!Array.isArray(work.lines) || work.lines.length > LIMITS.lines || !work.lines.every(l => isText(l, LIMITS.line)))) {
    return invalid(`studentWork.lines must be at most ${LIMITS.lines} lines of at most ${LIMITS.line} characters.`);
  }
  if (!isText(work.typedAnswer, LIMITS.typed)) return invalid('studentWork.typedAnswer is bounded.');
  if (work.firstBreak !== undefined && (!Number.isInteger(work.firstBreak) || work.firstBreak < -1 || work.firstBreak >= LIMITS.lines)) {
    return invalid('studentWork.firstBreak must be a line index or -1.');
  }
  if (work.misconception !== undefined && !(typeof work.misconception === 'string' && /^[a-z0-9._:-]{1,80}$/i.test(work.misconception))) {
    return invalid('studentWork.misconception must be a stable misconception id, not free text.');
  }

  let captions = [];
  if (body.level === 'walkthrough') {
    if (!Array.isArray(body.captions) || !body.captions.length || body.captions.length > LIMITS.captions) {
      return invalid(`A walkthrough sends 1 to ${LIMITS.captions} deterministic captions to rephrase.`);
    }
    for (const c of body.captions) {
      if (!plain(c) || closed(c, ['id', 'text']).length || !(typeof c.id === 'string' && /^[a-z0-9_-]{1,40}$/i.test(c.id)) || !isText(c.text, LIMITS.caption, { required: true })) {
        return invalid('Each caption is { id, text }.');
      }
    }
    captions = body.captions.map(c => ({ id: c.id, text: c.text.trim() }));
  } else if (body.captions !== undefined) {
    return invalid('captions are only sent with the walkthrough level.');
  }

  const lines = (work.lines || []).map(l => l.trim()).filter(Boolean);
  return {
    ok: true,
    request: {
      level: body.level,
      locale,
      questionId: body.questionId,
      questionVersion: body.questionVersion || '1',
      question: {
        prompt: q.prompt.trim(),
        steps: q.steps.map(s => ({ h: String(s.h || '').trim(), d: String(s.d || '').trim() })),
        answer: q.answer.trim(),
        hints: (q.hints || []).map(h => h.trim()).filter(Boolean)
      },
      studentWork: {
        lines,
        typedAnswer: work.typedAnswer ? work.typedAnswer.trim() : '',
        firstBreak: Number.isInteger(work.firstBreak) ? work.firstBreak : -1,
        misconception: work.misconception || null
      },
      captions
    }
  };
}

/** Identical help asks hash to one key: question id + version + content, work, level, locale. */
export function tutorCacheKey(request) {
  const material = JSON.stringify([
    'pri-tutor-v1', request.level, request.locale, request.questionId, request.questionVersion,
    request.question.prompt, request.question.steps, request.question.answer,
    request.studentWork.lines, request.studentWork.typedAnswer, request.studentWork.firstBreak,
    request.studentWork.misconception, request.captions
  ]);
  return createHash('sha256').update(material).digest('hex');
}

/** The authored, deterministic hint for this level, or null if the question has none. */
function authoredHint(request) {
  const hints = request.question.hints;
  if (!hints.length) return null;
  return hints[Math.min(TUTOR_LEVELS.indexOf(request.level), hints.length - 1)];
}

export function createTutorRouter(db, {
  ask = askTutorModel,
  env = process.env,
  now = () => Date.now()
} = {}) {
  db = asStore(db);
  ensureTable(db);
  const router = asyncRouter();

  router.get('/status', requireSession(db), async (req, res) => {
    const config = providerConfig(env);
    res.json({ available: config.configured, model: config.configured ? config.model : null, levels: TUTOR_LEVELS });
  });

  async function cached(key, at) {
    const row = await db.get('SELECT response_json, expires_at FROM tutor_cache WHERE cache_key = ?', [key]);
    if (!row) return null;
    if (Number(row.expires_at) <= at) {
      await db.run('DELETE FROM tutor_cache WHERE cache_key = ?', [key]);
      return null;
    }
    try { return JSON.parse(row.response_json); } catch { return null; }
  }

  async function remember(key, value, at) {
    await db.run(`INSERT INTO tutor_cache(cache_key, response_json, created_at, expires_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET response_json = excluded.response_json, created_at = excluded.created_at, expires_at = excluded.expires_at`,
    [key, JSON.stringify(value), at, at + TUTOR_CACHE_TTL_MS]);
    // Expired rows are swept on write, bounded by the expiry index.
    await db.run('DELETE FROM tutor_cache WHERE expires_at <= ?', [at]);
  }

  async function help(request) {
    const forbidden = forbiddenExpressions(request.question, {
      studentLines: [...request.studentWork.lines, request.studentWork.typedAnswer]
    });
    let model = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      // Every model call is a paid call, the regeneration included.
      const overBudget = await consumePaidCall(db, { env });
      if (overBudget) {
        if (attempt === 0) return { refusal: overBudget };
        break;
      }
      const reply = await ask(request, { env });
      model = reply.model || model;
      const leaked = leakedExpressions(reply.message, forbidden, { prompt: request.question.prompt });
      if (reply.message && !reply.revealsAnswer && !leaked.length) {
        return {
          tutor: {
            level: request.level, message: reply.message, referencesStepIndex: reply.referencesStepIndex,
            source: 'model', guarded: attempt > 0, model
          }
        };
      }
    }
    // Two strikes: the authored hint, which a person wrote and reviewed.
    return {
      tutor: {
        level: request.level, message: authoredHint(request), referencesStepIndex: -1,
        source: 'fallback', guarded: true, reason: 'TUTOR_ANSWER_GUARD', model
      }
    };
  }

  async function walkthrough(request) {
    const overBudget = await consumePaidCall(db, { env });
    if (overBudget) return { refusal: overBudget };
    const reply = await ask(request, { env });
    const corpus = solutionCorpus(request.question);
    let rejected = 0;
    const captions = request.captions.map((caption, index) => {
      const proposed = reply.captions?.get?.(index);
      if (proposed && proposed.length <= MAX_CAPTION_CHARS && captionMathOk(proposed, corpus)) {
        return { id: caption.id, text: proposed, source: 'model' };
      }
      if (proposed) rejected += 1;
      return { id: caption.id, text: caption.text, source: 'deterministic' };
    });
    return {
      tutor: {
        level: 'walkthrough', captions, rejected,
        source: captions.some(c => c.source === 'model') ? 'model' : 'fallback', model: reply.model || null
      }
    };
  }

  router.post('/help',
    requireSession(db),
    requireVerifiedEmail,
    rateLimit(db, 'tutor-help', TUTOR_RATE_LIMIT),
    async (req, res) => {
      let size = Infinity;
      try { size = Buffer.byteLength(JSON.stringify(req.body ?? null)); } catch { /* refused below */ }
      if (size > MAX_TUTOR_BODY_BYTES) {
        return res.status(413).json({ error: { code: 'TUTOR_REQUEST_TOO_LARGE', message: `A tutor request is at most ${MAX_TUTOR_BODY_BYTES} bytes.` } });
      }
      const checked = validateTutorRequest(req.body);
      if (!checked.ok) return res.status(checked.status).json({ error: { code: checked.code, message: checked.message } });
      const request = checked.request;

      const at = now();
      const key = tutorCacheKey(request);
      const hit = await cached(key, at);
      if (hit) return res.json({ tutor: { ...hit, cached: true } });

      if (!providerConfig(env).configured) {
        return res.status(503).json({ error: { code: 'TUTOR_NOT_CONFIGURED', message: 'The AI tutor is not available on this deployment.' } });
      }

      try {
        const outcome = request.level === 'walkthrough' ? await walkthrough(request) : await help(request);
        if (outcome.refusal) return refusePaidCall(res, outcome.refusal);
        await remember(key, outcome.tutor, at);
        res.json({ tutor: { ...outcome.tutor, cached: false } });
      } catch (error) {
        // Only the code is reported. No question, solution or student work is
        // logged or echoed: diagnostics stay privacy-safe.
        if (error instanceof TutorProviderError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message, retryable: !!error.retryable } });
        }
        res.status(502).json({ error: { code: 'TUTOR_FAILED', message: 'The tutor could not help this time.', retryable: true } });
      }
    });

  return router;
}
