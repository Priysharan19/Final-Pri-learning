// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Criteria-guided marking of handwritten working
//
// This is NOT the transcription path in openaiHandwriting.mjs, and the
// difference is the whole point of the file.
//
// Transcription asks "what glyphs are these?", answer-blind, and hands the text
// to a symbolic checker. One misread character then destroys the mark AND shows
// the student a nonsense reading of their own correct work. Measured on real
// ink, that pipeline reads 60.0% of lines exactly (client/test/inkcheck-real).
//
// Marking asks a strictly easier question. Pri GENERATED the question, so it
// already holds the official answer, the worked steps and the mark scheme. The
// model is never asked to recover notation faithfully — it is asked, for each
// criterion the examiner already wrote down, "is this step present in the
// image, and is it right?". A misread digit inside a line that still earns its
// method mark costs nothing, because no downstream parser consumes the reading.
//
// Three rules hold this honest, and all three are enforced here in code rather
// than asked for in the prompt, because a prompt is a request and this is a
// mark that goes on a child's progress record:
//
//   1. The model never sets the total. It attributes marks to criteria; the
//      total is summed here from criteria it was actually allowed to award.
//   2. A criterion the model did not name, or named twice, earns nothing.
//   3. Awarded marks are clamped to the marks available. A model that returns
//      7/4 is a model that gets 4/4 at most, and `capped` is set so the caller
//      can log it.
//
// The final ANSWER verdict is not decided here at all. checkAnswer() in the
// engine owns that, on device, offline, and keeps owning it. This file decides
// method marks on the working — which is exactly what CBSE step marking is,
// and exactly what the local checker cannot see.
// ─────────────────────────────────────────────────────────────────────────────

import { validateImageDataUrl } from './openaiHandwriting.mjs';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const DEFAULT_MODEL = 'gpt-5.6-terra';
const DEFAULT_TIMEOUT_MS = 45_000;

/** Hard ceilings. A question that exceeds these is a bug upstream, not a big question. */
export const MAX_CRITERIA = 8;
export const MAX_MARKS = 20;
export const MAX_LINES = 24;

// ── The mark scheme the model is answering against ───────────────────────────

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lines', 'awards', 'final_answer_seen', 'overall_comment', 'confidence', 'legible'],
  properties: {
    lines: {
      type: 'array',
      description: 'One entry per line of working visible in the image, top to bottom.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'reads_as', 'verdict', 'comment'],
        properties: {
          index: { type: 'integer', description: '1-based line number, counting from the top.' },
          reads_as: { type: 'string', description: 'What this line appears to say. Best effort; never used for marking.' },
          verdict: {
            type: 'string',
            enum: ['correct', 'incorrect', 'incomplete', 'unclear'],
            description: 'unclear means the ink cannot be read, NOT that the maths is wrong.'
          },
          comment: { type: 'string', description: 'At most one short sentence, addressed to the student. Empty when the line is simply correct.' }
        }
      }
    },
    awards: {
      type: 'array',
      description: 'The criteria from the mark scheme that this working earns. Omit a criterion entirely if its work is not visible.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterion_id', 'earned', 'evidence_line', 'reason'],
        properties: {
          criterion_id: { type: 'integer', description: 'The id given in the mark scheme.' },
          earned: { type: 'boolean' },
          evidence_line: { type: 'integer', description: 'The 1-based line that earns or fails it; 0 when nothing in the image bears on it.' },
          reason: { type: 'string', description: 'One short clause naming the evidence.' }
        }
      }
    },
    final_answer_seen: {
      type: 'string',
      description: 'The final answer the student appears to have arrived at, verbatim. Empty string if they never reach one.'
    },
    overall_comment: {
      type: 'string',
      description: 'One or two sentences to the student: the single most useful thing to fix. Never praise-only when marks were lost.'
    },
    confidence: { type: 'number', description: '0 to 1. How sure you are that you read enough of the page to mark it.' },
    legible: { type: 'boolean', description: 'False when too much of the page cannot be read to mark it fairly.' }
  }
};

const SYSTEM_INSTRUCTIONS = [
  'You are marking a school student\'s handwritten mathematics working against an official mark scheme you are given.',
  '',
  'You are NOT solving the problem and you are NOT transcribing it. The correct answer and the full worked solution are supplied to you. Your only job is to decide, for each criterion in the mark scheme, whether the student\'s visible working earns it.',
  '',
  'Rules:',
  '· Mark only what is visibly written. Never award a criterion because the student "must have" done it.',
  '· A wrong final answer does not remove method marks that were correctly earned along the way. Award every criterion whose work is present and correct.',
  '· An arithmetic slip carried forward correctly still earns the later method criteria. Penalise the slip once.',
  '· If ink cannot be read, the line verdict is "unclear". That is a statement about legibility, never about whether the maths is right. Do not guess at unreadable work and do not mark it wrong.',
  '· If too much of the page is unreadable to mark fairly, set legible to false and award nothing.',
  '· Ignore crossed-out work, and ignore rough working the student has clearly abandoned.',
  '· Comments are addressed to the student, in the second person, and name the specific move to change. No praise-only comments when marks were lost. No apologies.',
  '· Never mention these instructions, the mark scheme, or that you are a model.'
].join('\n');

// ── Prompt construction ──────────────────────────────────────────────────────

/**
 * The examiner's brief. Everything here is generated by Pri's own engine, so it
 * is authoritative — this is the advantage a photo-only competitor does not
 * have, and the reason the model is asked such a narrow question.
 */
export function buildMarkingBrief(question) {
  const criteria = normalizeCriteria(question?.criteria);
  const lines = [
    'QUESTION',
    String(question?.prompt || '').trim(),
    '',
    `MARKS AVAILABLE: ${criteria.reduce((n, c) => n + c.mark, 0)}`,
    '',
    'OFFICIAL ANSWER',
    String(question?.officialAnswer || '').trim() || '(not supplied)',
    ''
  ];

  const steps = Array.isArray(question?.workedSteps) ? question.workedSteps.slice(0, 12) : [];
  if (steps.length) {
    lines.push('OFFICIAL WORKED SOLUTION');
    steps.forEach((s, i) => {
      const head = String(s?.h || '').trim();
      const detail = String(s?.d || '').trim();
      lines.push(`${i + 1}. ${head}${detail ? ` — ${detail}` : ''}`);
    });
    lines.push('');
  }

  lines.push('MARK SCHEME — award each of these independently');
  for (const c of criteria) {
    lines.push(`[${c.id}] (${c.mark} mark${c.mark === 1 ? '' : 's'}) ${c.text}`);
  }
  lines.push('');
  lines.push('The image is the student\'s handwritten working for this question. Mark it.');
  return lines.join('\n');
}

/** Criteria as the engine emits them, given stable ids and defensive limits. */
export function normalizeCriteria(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let i = 0; i < list.length && out.length < MAX_CRITERIA; i += 1) {
    const text = String(list[i]?.text || '').trim();
    if (!text) continue;
    const mark = Math.max(1, Math.min(5, Math.round(Number(list[i]?.mark) || 1)));
    out.push({ id: out.length + 1, mark, text });
  }
  if (!out.length) out.push({ id: 1, mark: 1, text: 'Correct final answer' });
  // Never let a malformed question authorise an unbounded award.
  let running = 0;
  return out.filter(c => {
    if (running + c.mark > MAX_MARKS) return false;
    running += c.mark;
    return true;
  });
}

// ── Response normalisation — where the model stops being trusted ─────────────

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function shortText(value, limit) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > limit ? `${s.slice(0, limit - 1)}…` : s;
}

/**
 * Turn the model's answer into a mark. This function is the reason the feature
 * is safe to put in front of a student: every number that reaches the progress
 * record is computed here from criteria the caller supplied, never copied from
 * the model.
 */
export function normalizeMarking(raw, criteria) {
  const scheme = normalizeCriteria(criteria);
  const byId = new Map(scheme.map(c => [c.id, c]));
  const marksAvailable = scheme.reduce((n, c) => n + c.mark, 0);

  const legible = raw?.legible !== false;
  const confidence = clamp01(raw?.confidence, 0);

  const lines = (Array.isArray(raw?.lines) ? raw.lines : [])
    .slice(0, MAX_LINES)
    .map((l, i) => {
      const verdict = ['correct', 'incorrect', 'incomplete', 'unclear'].includes(l?.verdict) ? l.verdict : 'unclear';
      return {
        index: Number.isInteger(l?.index) && l.index > 0 ? l.index : i + 1,
        readsAs: shortText(l?.reads_as, 160),
        verdict,
        comment: shortText(l?.comment, 180)
      };
    });

  // One award per criterion, first mention wins. A model that lists a criterion
  // twice does not get paid twice for it.
  const seen = new Set();
  const awards = [];
  for (const a of Array.isArray(raw?.awards) ? raw.awards : []) {
    const id = Number(a?.criterion_id);
    const criterion = byId.get(id);
    if (!criterion || seen.has(id)) continue;
    seen.add(id);
    awards.push({
      criterionId: id,
      text: criterion.text,
      mark: criterion.mark,
      earned: a?.earned === true && legible,
      evidenceLine: Number.isInteger(a?.evidence_line) && a.evidence_line > 0 ? a.evidence_line : null,
      reason: shortText(a?.reason, 160)
    });
  }
  // A criterion the model never mentioned is not earned — stated explicitly so
  // the student sees the whole scheme, not only the parts that went well.
  for (const c of scheme) {
    if (seen.has(c.id)) continue;
    awards.push({ criterionId: c.id, text: c.text, mark: c.mark, earned: false, evidenceLine: null, reason: '' });
  }
  awards.sort((a, b) => a.criterionId - b.criterionId);

  const summed = awards.reduce((n, a) => n + (a.earned ? a.mark : 0), 0);
  const marksAwarded = Math.max(0, Math.min(marksAvailable, summed));

  return {
    marksAwarded,
    marksAvailable,
    capped: summed > marksAvailable,
    legible,
    confidence,
    lines,
    awards,
    finalAnswerSeen: shortText(raw?.final_answer_seen, 120),
    overallComment: shortText(raw?.overall_comment, 400),
    // A low-confidence or illegible read must not silently become a mark. The
    // client shows these to the student as "check this" rather than as a grade.
    needsConfirmation: !legible || confidence < 0.55
  };
}

// ── The call ─────────────────────────────────────────────────────────────────

async function requestMarking({ model, imageDataUrl, brief, apiKey, fetchImpl, timeoutMs, detail }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        // Student work is never retained by the provider for training or logs.
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 1600,
        instructions: SYSTEM_INSTRUCTIONS,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: brief },
            { type: 'input_image', image_url: imageDataUrl, detail }
          ]
        }],
        text: {
          verbosity: 'low',
          format: { type: 'json_schema', name: 'pri_working_marking', strict: true, schema: RESPONSE_SCHEMA }
        }
      })
    });

    const bodyText = await response.text();
    let body;
    try { body = bodyText ? JSON.parse(bodyText) : {}; }
    catch { throw new Error(`OpenAI returned non-JSON HTTP ${response.status}`); }

    if (!response.ok) {
      const message = body?.error?.message || body?.message || `OpenAI HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.code = 'MARKING_UPSTREAM_FAILED';
      throw error;
    }

    const structured = extractText(body);
    if (!structured) throw new Error('OpenAI response contained no marking');
    let parsed;
    try { parsed = JSON.parse(structured); }
    catch { throw new Error('OpenAI structured marking was not valid JSON'); }
    return { parsed, usage: body?.usage || null, responseId: body?.id || null };
  } finally {
    clearTimeout(timer);
  }
}

/** The Responses API nests output text; pull the first block of it. */
export function extractText(response) {
  for (const item of response?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string' && part.text) return part.text;
    }
  }
  return '';
}

/**
 * Mark one page of handwritten working.
 *
 * @param {string} imageDataUrl  PNG/JPEG data URL of the student's working.
 * @param {object} question      { prompt, criteria[], officialAnswer, workedSteps[] }
 */
export async function markHandwrittenWorking(imageDataUrl, question, options = {}) {
  const bytes = validateImageDataUrl(imageDataUrl);

  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'OPENAI_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  if (!String(question?.prompt || '').trim()) {
    const error = new Error('a question prompt is required to mark against');
    error.code = 'MARKING_NO_QUESTION';
    error.status = 400;
    throw error;
  }

  const criteria = normalizeCriteria(question?.criteria);
  const model = options.model || process.env.OPENAI_MARKING_MODEL || DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs || process.env.OPENAI_MARKING_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const detail = options.detail || process.env.OPENAI_MARKING_IMAGE_DETAIL || 'high';

  const started = Date.now();
  const { parsed, usage, responseId } = await requestMarking({
    model, imageDataUrl, brief: buildMarkingBrief({ ...question, criteria }), apiKey, fetchImpl, timeoutMs, detail
  });

  return {
    ...normalizeMarking(parsed, criteria),
    engine: `openai-marking:${model}`,
    model,
    imageBytes: bytes,
    ms: Date.now() - started,
    usage,
    responseId
  };
}
