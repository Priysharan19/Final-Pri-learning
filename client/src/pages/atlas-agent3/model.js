// Standalone, synthetic-only Atlas demonstration fixtures.
// No production attempts, grading API, transcripts, or student identities.
export const DEMO_KEY = 'pri-atlas-agent3-paper-v1';
export const QUESTIONS = Object.freeze([
  Object.freeze({
    id: 'atlas-linear-01',
    conceptId: 'linear-equations',
    chapter: 'Algebra / Linear equations',
    title: 'Balance the equation',
    prompt: 'Solve $3(2x-1)=15$ for $x$. Show how each operation preserves equality.',
    marks: 3,
    instructions: 'Write your method first, then give your final value of x.',
    hints: [
      'First expand the bracket without changing the right-hand side.',
      'You should reach $6x-3=15$. What must be added to both sides?'
    ],
    steps: [
      { label: 'Expand', math: '$3(2x-1)=15$', nextMath: '$6x-3=15$', why: 'Distribute 3 to both terms.' },
      { label: 'Isolate', math: '$6x=18$', why: 'Add 3 to each side.' },
      { label: 'Conclude', math: '$x=3$', why: 'Divide both sides by 6.' }
    ],
    // An intentionally incorrect authored example. Never diagnose arbitrary student work.
    errorExample: Object.freeze({
      working: '6x - 3 = 15\n6x = 12\nx = 2',
      answer: 'x = 2',
      line: '6x = 12',
      explanation: 'Adding 3 to both sides gives 6x = 18, not 12.',
      sampleMarks: '1 / 3'
    }),
    nextId: 'atlas-linear-02'
  }),
  Object.freeze({
    id: 'atlas-linear-02',
    conceptId: 'linear-equations',
    chapter: 'Algebra / Linear equations',
    title: 'Transfer the method',
    prompt: 'Solve $5(x-2)=20$ and explain your first step.',
    marks: 3,
    instructions: 'Try a different equation using the same balancing idea.',
    hints: [
      'You can distribute first, or divide by 5 first. Both are valid starts.',
      'If you divide both sides by 5, what does $x-2$ equal?'
    ],
    steps: [
      { label: 'Simplify', math: '$5(x-2)=20$', nextMath: '$x-2=4$', why: 'Divide both sides by 5.' },
      { label: 'Balance', math: '$x=6$', why: 'Add 2 to both sides.' },
      { label: 'Check', math: '$5(6-2)=20$', why: 'Substitute to verify the equality.' }
    ],
    errorExample: null,
    nextId: 'atlas-linear-01'
  }),
  Object.freeze({
    id: 'atlas-pair-01',
    conceptId: 'c10-pair-linear-equations',
    chapter: 'Class X / Pairs of linear equations',
    title: 'Where two lines meet',
    prompt: 'Transfer from the laboratory to a **new illustrative pair**: solve $2x+y=7$ and $x-y=2$. Explain how you know the solution satisfies both equations.',
    marks: 4,
    instructions: 'This is a separate authored practice example, not the exact equations from your laboratory controls.',
    hints: [
      'Use $x-y=2$ to express one variable in terms of the other.',
      'Rearrange to $y=x-2$, then substitute into $2x+y=7$.'
    ],
    steps: [
      { label: 'Rearrange', math: '$x-y=2$', nextMath: '$y=x-2$', why: 'Move the y term and then isolate y.' },
      { label: 'Substitute', math: '$2x+(x-2)=7$', nextMath: '$3x=9$', why: 'Replace y and add 2 to both sides.' },
      { label: 'Solve and verify', math: '$x=3,\\;y=1$', nextMath: '$2(3)+1=7,\\quad 3-1=2$', why: 'The pair satisfies both original equations.' }
    ],
    errorExample: null,
    nextId: 'atlas-linear-01'
  })
]);

export function emptyDraft() {
  return { working: '', answer: '', strokes: [] };
}

export function initialDemoState(profile = 'new') {
  return {
    profile: profile === 'returning' ? 'returning' : 'new',
    view: 'paper',
    questionIndex: 0,
    drafts: {},
    inputMode: 'type',
    outcome: 'result',
    status: 'unsubmitted',
    transcript: '',
    hintLevel: 0,
    helpOpen: false,
    focus: false,
    // Written work only gets a sample mark when it exactly matches the authored sample.
    confirmedRevision: 0,
    revision: 0
  };
}

const cap = (value, limit = 1800) => typeof value === 'string' ? value.slice(0, limit) : '';
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const pick = (v, allowed, fallback) => allowed.includes(v) ? v : fallback;

export function sanitizeDraft(draft) {
  if (!draft || typeof draft !== 'object') return emptyDraft();
  return {
    working: cap(draft.working),
    answer: cap(draft.answer, 180),
    strokes: Array.isArray(draft.strokes) ? draft.strokes.slice(0, 48)
      .filter(s => Array.isArray(s) && s.length >= 2)
      .map(s => s.slice(0, 250).filter(p => Array.isArray(p) && p.length === 2 &&
        Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map(p => [clamp(p[0], 0, 800), clamp(p[1], 0, 280)]))
      .filter(s => s.length >= 2) : []
  };
}

export function restoreDemo(raw) {
  const base = initialDemoState();
  if (!raw) return base;
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || s.version !== 1) return base;
    const drafts = {};
    for (const question of QUESTIONS) {
      if (s.drafts && Object.prototype.hasOwnProperty.call(s.drafts, question.id)) {
        drafts[question.id] = sanitizeDraft(s.drafts[question.id]);
      }
    }
    // A pending request cannot honestly resume after reload; simulated work is never a receipt.
    const status = pick(s.status,
      ['unsubmitted', 'simulated-result', 'uncertain-transcription', 'technical-error'],
      'unsubmitted');
    return {
      ...base,
      profile: pick(s.profile, ['new', 'returning'], 'new'),
      view: status === 'simulated-result' ? pick(s.view, ['paper', 'insight'], 'paper') : 'paper',
      questionIndex: Math.trunc(clamp(s.questionIndex, 0, QUESTIONS.length - 1)),
      drafts,
      inputMode: pick(s.inputMode, ['type', 'write'], 'type'),
      outcome: pick(s.outcome, ['result', 'uncertain', 'error'], 'result'),
      status,
      transcript: cap(s.transcript, 180),
      hintLevel: Math.trunc(clamp(s.hintLevel, 0, 2)),
      helpOpen: Boolean(s.helpOpen),
      focus: Boolean(s.focus),
      confirmedRevision: Math.trunc(clamp(s.confirmedRevision, 0, 1000000)),
      revision: Math.trunc(clamp(s.revision, 0, 1000000))
    };
  } catch {
    return base;
  }
}

export function currentQuestion(state) {
  return QUESTIONS[state.questionIndex] || QUESTIONS[0];
}

export function currentDraft(state) {
  return sanitizeDraft(state.drafts[currentQuestion(state).id]);
}

export function hasAnswer(draft) {
  return Boolean(draft.answer.trim() || draft.working.trim() || draft.strokes.length);
}

export function authoredErrorMatches(question, draft) {
  return Boolean(question.errorExample &&
    draft.working.trim() === question.errorExample.working &&
    draft.answer.trim() === question.errorExample.answer);
}

export function storageEnvelope(state) {
  return JSON.stringify({ ...state, version: 1 });
}
