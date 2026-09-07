// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Criteria-guided marking contract
//
// The thing under test is not "does the model mark well" — that needs real
// student pages and a human examiner, and no assertion here claims it. What is
// tested is the boundary around the model: every path by which a model's answer
// could put a mark on a child's progress record that the mark scheme did not
// authorise.
//
// That boundary is the reason this feature is safe to ship before the model is
// proven. A bad marking should cost a wrong comment, never a wrong grade.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import {
  buildMarkingBrief,
  markHandwrittenWorking,
  normalizeCriteria,
  normalizeMarking,
  extractText,
  MAX_CRITERIA,
  MAX_MARKS
} from '../cloud/markWorking.mjs';

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const checkAsync = async (fn) => { await fn(); checks += 1; };

const image = `data:image/png;base64,${Buffer.alloc(128, 3).toString('base64')}`;

const CRITERIA = [
  { mark: 1, text: 'Uses HCF × LCM = a × b' },
  { mark: 1, text: 'Substitutes the given values' },
  { mark: 1, text: 'Reaches b = 24' }
];

const QUESTION = {
  prompt: 'Two numbers have HCF 6 and LCM 72. One of them is 18. Find the other.',
  criteria: CRITERIA,
  officialAnswer: '24',
  workedSteps: [{ h: 'The product rule', d: 'HCF × LCM = a × b' }]
};

function marking(overrides = {}) {
  return {
    lines: [{ index: 1, reads_as: '6 x 72 = 18 x b', verdict: 'correct', comment: '' }],
    awards: [{ criterion_id: 1, earned: true, evidence_line: 1, reason: 'product rule written' }],
    final_answer_seen: '24',
    overall_comment: 'Good.',
    confidence: 0.9,
    legible: true,
    ...overrides
  };
}

// ── normalizeCriteria: a malformed question cannot authorise a bigger award ──

check(() => {
  const out = normalizeCriteria(CRITERIA);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map(c => c.id), [1, 2, 3]);
});

check(() => {
  // No criteria at all still yields a markable scheme rather than throwing.
  const out = normalizeCriteria([]);
  assert.equal(out.length, 1);
  assert.equal(out[0].mark, 1);
});

check(() => {
  // Blank criteria are dropped, and ids stay contiguous over the survivors —
  // otherwise a model naming criterion 2 would award a criterion that is gone.
  const out = normalizeCriteria([{ mark: 1, text: 'kept' }, { mark: 1, text: '   ' }, { mark: 1, text: 'also kept' }]);
  assert.deepEqual(out.map(c => c.text), ['kept', 'also kept']);
  assert.deepEqual(out.map(c => c.id), [1, 2]);
});

check(() => {
  const many = Array.from({ length: 40 }, (_, i) => ({ mark: 1, text: `c${i}` }));
  assert.equal(normalizeCriteria(many).length, MAX_CRITERIA);
});

check(() => {
  // Per-criterion marks are clamped, and the running total cannot pass the cap.
  const huge = Array.from({ length: 8 }, () => ({ mark: 999, text: 'big' }));
  const out = normalizeCriteria(huge);
  assert.ok(out.every(c => c.mark <= 5));
  assert.ok(out.reduce((n, c) => n + c.mark, 0) <= MAX_MARKS);
});

// ── The brief carries what makes this easier than transcription ──────────────

check(() => {
  const brief = buildMarkingBrief(QUESTION);
  assert.match(brief, /HCF 6 and LCM 72/);        // the question
  assert.match(brief, /OFFICIAL ANSWER\n24/);      // the answer the engine knows
  assert.match(brief, /\[1\] \(1 mark\) Uses HCF/); // ids the model must cite
  assert.match(brief, /MARKS AVAILABLE: 3/);
});

check(() => {
  // A question with no worked steps still produces a usable brief.
  const brief = buildMarkingBrief({ prompt: 'x?', criteria: CRITERIA });
  assert.match(brief, /OFFICIAL ANSWER\n\(not supplied\)/);
  assert.doesNotMatch(brief, /OFFICIAL WORKED SOLUTION/);
});

// ── normalizeMarking: the model never sets the total ─────────────────────────

check(() => {
  const out = normalizeMarking(marking(), CRITERIA);
  assert.equal(out.marksAvailable, 3);
  assert.equal(out.marksAwarded, 1);
  assert.equal(out.capped, false);
});

check(() => {
  // Criteria the model never mentioned are reported, unearned. The student
  // sees the whole scheme, not only the parts that went well.
  const out = normalizeMarking(marking(), CRITERIA);
  assert.equal(out.awards.length, 3);
  assert.deepEqual(out.awards.map(a => a.earned), [true, false, false]);
});

check(() => {
  // A criterion listed twice is paid once.
  const out = normalizeMarking(marking({
    awards: [
      { criterion_id: 2, earned: true, evidence_line: 1, reason: 'a' },
      { criterion_id: 2, earned: true, evidence_line: 2, reason: 'b' }
    ]
  }), CRITERIA);
  assert.equal(out.marksAwarded, 1);
  assert.equal(out.awards.filter(a => a.criterionId === 2).length, 1);
});

check(() => {
  // An invented criterion id earns nothing at all.
  const out = normalizeMarking(marking({
    awards: [{ criterion_id: 99, earned: true, evidence_line: 1, reason: 'invented' }]
  }), CRITERIA);
  assert.equal(out.marksAwarded, 0);
  assert.ok(out.awards.every(a => a.criterionId <= 3));
});

check(() => {
  // Every criterion earned is the ceiling, and the ceiling is the scheme's.
  const out = normalizeMarking(marking({
    awards: CRITERIA.map((_, i) => ({ criterion_id: i + 1, earned: true, evidence_line: 1, reason: '' }))
  }), CRITERIA);
  assert.equal(out.marksAwarded, 3);
  assert.equal(out.marksAwarded <= out.marksAvailable, true);
});

check(() => {
  // Illegible: nothing is earned, whatever the model claimed.
  const out = normalizeMarking(marking({
    legible: false,
    awards: CRITERIA.map((_, i) => ({ criterion_id: i + 1, earned: true, evidence_line: 1, reason: '' }))
  }), CRITERIA);
  assert.equal(out.marksAwarded, 0);
  assert.equal(out.needsConfirmation, true);
});

check(() => {
  // Low confidence is surfaced rather than silently graded.
  assert.equal(normalizeMarking(marking({ confidence: 0.2 }), CRITERIA).needsConfirmation, true);
  assert.equal(normalizeMarking(marking({ confidence: 0.9 }), CRITERIA).needsConfirmation, false);
});

check(() => {
  // Garbage in the confidence field is not a high confidence.
  const out = normalizeMarking(marking({ confidence: 'very sure' }), CRITERIA);
  assert.equal(out.confidence, 0);
  assert.equal(out.needsConfirmation, true);
});

check(() => {
  // An unreadable LINE is never reported as a wrong line. This is the single
  // most damaging thing the feature could do to a student who wrote correctly.
  const out = normalizeMarking(marking({
    lines: [{ index: 1, reads_as: '???', verdict: 'unclear', comment: '' }]
  }), CRITERIA);
  assert.equal(out.lines[0].verdict, 'unclear');
});

check(() => {
  // An unknown verdict degrades to unclear, never to incorrect.
  const out = normalizeMarking(marking({
    lines: [{ index: 1, reads_as: 'x', verdict: 'wrong-ish', comment: '' }]
  }), CRITERIA);
  assert.equal(out.lines[0].verdict, 'unclear');
});

check(() => {
  // Runaway output is bounded rather than rendered.
  const out = normalizeMarking(marking({
    lines: Array.from({ length: 500 }, (_, i) => ({ index: i + 1, reads_as: 'x'.repeat(4000), verdict: 'correct', comment: 'y'.repeat(4000) }))
  }), CRITERIA);
  assert.ok(out.lines.length <= 24);
  assert.ok(out.lines[0].readsAs.length <= 160);
  assert.ok(out.lines[0].comment.length <= 180);
});

check(() => {
  // Entirely absent fields do not throw.
  const out = normalizeMarking({}, CRITERIA);
  assert.equal(out.marksAwarded, 0);
  assert.equal(out.lines.length, 0);
  assert.equal(out.awards.length, 3);
});

// ── extractText ──────────────────────────────────────────────────────────────

check(() => {
  assert.equal(extractText({ output: [{ content: [{ type: 'output_text', text: '{"a":1}' }] }] }), '{"a":1}');
  assert.equal(extractText({}), '');
});

// ── The request itself ───────────────────────────────────────────────────────

await checkAsync(async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          id: 'resp_1',
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(marking()) }] }],
          usage: { total_tokens: 900 }
        });
      }
    };
  };

  const result = await markHandwrittenWorking(image, QUESTION, { apiKey: 'k', fetchImpl });

  assert.equal(calls.length, 1);
  const body = calls[0].body;
  // Student work is never retained by the provider.
  assert.equal(body.store, false);
  // Structured output, strictly — a free-text marking cannot be parsed safely.
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  // The image goes as an image, and the brief goes with it.
  const kinds = body.input[0].content.map(c => c.type);
  assert.deepEqual(kinds, ['input_text', 'input_image']);
  assert.match(body.input[0].content[0].text, /MARK SCHEME/);

  assert.equal(result.marksAwarded, 1);
  assert.equal(result.marksAvailable, 3);
  assert.match(result.engine, /^openai-marking:/);
});

await checkAsync(async () => {
  // A question with no prompt is refused before any spend.
  await assert.rejects(
    () => markHandwrittenWorking(image, { criteria: CRITERIA }, {
      apiKey: 'k', fetchImpl: async () => { throw new Error('must not run'); }
    }),
    /question prompt is required/
  );
});

await checkAsync(async () => {
  // A URL is not an image. Nothing is fetched on the model's behalf.
  await assert.rejects(
    () => markHandwrittenWorking('https://example.com/work.png', QUESTION, {
      apiKey: 'k', fetchImpl: async () => { throw new Error('must not run'); }
    }),
    /data URL/
  );
});

await checkAsync(async () => {
  // An upstream failure surfaces its status rather than becoming a zero mark.
  await assert.rejects(
    () => markHandwrittenWorking(image, QUESTION, {
      apiKey: 'k',
      fetchImpl: async () => ({ ok: false, status: 429, async text() { return JSON.stringify({ error: { message: 'slow down' } }); } })
    }),
    /slow down/
  );
});

await checkAsync(async () => {
  // Non-JSON from upstream is an error, never a silently empty marking.
  await assert.rejects(
    () => markHandwrittenWorking(image, QUESTION, {
      apiKey: 'k',
      fetchImpl: async () => ({ ok: true, status: 200, async text() { return '<html>502</html>'; } })
    }),
    /non-JSON/
  );
});

await checkAsync(async () => {
  // No key means no accidental direct API use from a checkout or CI worker.
  const saved = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => markHandwrittenWorking(image, QUESTION, { fetchImpl: async () => { throw new Error('must not run'); } }),
      /OPENAI_API_KEY/
    );
  } finally {
    if (saved === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved;
  }
});

console.log(`✔ MARKING SUITE PASSED — ${checks}/${checks} checks`);
