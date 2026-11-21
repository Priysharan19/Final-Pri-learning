// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · THE ENGINE CONSTRAINS THE MODEL
//
// A model writes the words. The deterministic engine decided the states and
// the mark, and this module holds every generated comment to them AFTER
// generation. A comment that breaks a rule is never shown: the caller replaces
// it with the engine's own template for that line.
//
//   a  a comment on an engine-VERIFIED line (verified, from the question, a
//      stated condition) may not say or imply the line is wrong
//   b  a comment on the engine's FIRST ERROR must agree with the engine's
//      reason and may not move the error to another line
//   c  a line the engine could NOT check is labelled as Pri's comment, may say
//      it looks right or point out a likely problem, never sets a state, and
//      never states a different final answer than the solution's
//   d  every mathematical expression is extracted and checked: equalities hold
//      (the product's expression engine), a value attributed to the question's
//      answer equals the key, an expression quoted as "your line" is the
//      student's line
//   e  while a question is unresolved no comment reveals the answer or a later step
//   g  a line the engine ticked only as TRUE AS WRITTEN (state 'arithmetic') is never called the right step, the
//      right method or the right move for the question: the engine did not check that, so the comment may not say it
//   f  no praise inflation, no neatness or notation-style remarks (unless the
//      engine flagged the line), no hedging filler, no em dashes, no emoji,
//      12 to 45 words, no marks talk, no echoed instructions
//
// None of this can change a state or a mark: the states and marks are inputs
// here, never outputs.
// ─────────────────────────────────────────────────────────────────────────────
import { mathSpans, proseOf, checkSpan, latexToPlain, squash, valueClaim, numbersIn, sameNumber, canonStmt, canonSlices, lineTex } from './math.js';

export const COMMENT_KINDS = Object.freeze(['explains-correct', 'explains-error', 'next-step', 'could-not-check']);
export const MIN_WORDS = 12;
export const MAX_WORDS = 45;
/** The status word a comment opens with (English). A tutor's register: the first word says where the line stands. */
export const OPENERS = Object.freeze({
  arithmetic: ['Correct'], verified: ['Correct'], 'from-question': ['Correct'], condition: ['Correct'], incomplete: ['Correct', 'Close'],
  'first-error': ['Close', 'Not yet', 'Check this'], follows: ['Close', 'Not yet', 'Check this'],
  'not-checked': ['Check this', 'Looks right', 'Close'], 'not-read': ['Check this']
});
export const RULES = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

/** The kinds a state may carry. */
export const KINDS_FOR_STATE = Object.freeze({
  arithmetic: ['explains-correct'],
  verified: ['explains-correct', 'next-step'],
  'from-question': ['explains-correct', 'next-step'],
  condition: ['explains-correct', 'next-step'],
  'first-error': ['explains-error'],
  follows: ['explains-error', 'next-step'],
  incomplete: ['next-step', 'could-not-check'],
  'not-checked': ['could-not-check'],
  'not-read': ['could-not-check']
});

const PRAISE = /\b(great|excellent|amazing|fantastic|perfect(?:ly)?|brilliant|awesome|well done|superb|wonderful|outstanding|impressive|genius|fabulous|terrific|flawless|stellar|bravo|congratulations|nailed it|spot on|good job|nice work|nice job|good work|beautiful(?:ly)?|lovely|phenomenal|exceptional|magnificent)\b/i;
const HEDGE = /\b(perhaps|maybe|possibly|it seems|seems to|appears to|i think|i believe|i feel|you might want|might want to|you may want|may want to|sort of|kind of|a bit|a little|somewhat|just|simply|basically|actually|really|honestly|obviously|of course|very|quite|fairly|arguably)\b/i;
const NEATNESS = /\b(neat(?:ly|ness)?|messy|untidy|tidy|scrawl\w*|illegible|legible|legibility|handwriting|handwritten|sloppy|cramped|smudge\w*|squiggl\w*|penmanship|fraction bars?|vinculum|spacing|more clearly|clearer|write (?:it )?bigger|bigger|larger writing)\b/i;
const NOTATION = /\b(notation|notational|brackets? style|formatting|presentation|layout|convention)\b/i;
const NOTATION_COMPLAINT = /\b(unconventional|non-?standard|improper|poor(?:ly)?|better|should (?:write|use|be written)|unclear|awkward|confusing|tidy|clean(?:er)?|inconsistent|sloppy|conventional|prefer(?:red)?|incorrect|wrong|clumsy|messy)\b/i;
// Claims that a line is the right step, method, approach or move for the question (what an arithmetic tick does NOT establish).
const RIGHT_STEP = /\b(?:(?:right|correct|proper|appropriate|valid|sound|good|ideal|suitable|natural|sensible|expected|required|necessary|standard)\s+(?:step|method|approach|technique|strategy|move|way|rule|formula|substitution|operation|choice|process)|(?:step|method|approach|technique|strategy|move|rule|formula|operation|choice)\s+(?:is|was|that|which)?\s*(?:the\s+)?(?:right|correct|appropriate|needed|required|expected)|(?:is|was)\s+(?:exactly\s+)?what\s+the\s+question\s+(?:asks|wants|needs|requires)|answers?\s+the\s+question|solves?\s+the\s+(?:question|problem)|leads?\s+(?:you\s+)?to\s+the\s+(?:answer|solution)|correctly\s+(?:applies|uses|applied|used|follows|identifies|chooses|chose|solves|solved)|follows?\s+the\s+(?:correct|right)\s+method|method\s+works|on\s+the\s+right\s+track|right\s+idea)\b/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const MARKS = /\b(marks?|points? (?:lost|deducted|awarded)|deduct\w*|award\w*|full credit|half credit|partial credit|credit)\b/i;
const INJECTION = /\b(ignore (?:the|all|any|previous|prior|your|these)|system prompt|my instructions|the instructions|as an ai|language model|openai|chatgpt|gpt|developer message|jailbreak|override|disregard)\b/i;
const EM_DASH = /[—–]/;
const EMOJI = /\p{Extended_Pictographic}|[✓✔✗✘✅❌]/u;
const NEGATIVE = /\b(wrong(?:ly)?|incorrect(?:ly)?|errors?|mistakes?|mistaken|slips?|not (?:right|correct|quite|valid|true)|isn'?t (?:right|correct|valid|true)|aren'?t (?:right|correct)|doesn'?t (?:follow|hold|work|match|add up)|does not (?:follow|hold|work|match|add up)|should (?:be|have|instead)|ought to|needs? (?:to be )?(?:fix|chang|correct|redo|rework)\w*|fix(?:ing|ed)?|re-?check|check again|double-?check|careful|false|oops|mislead\w*|confus\w*|problems?|issues?|flawed|invalid|fails?|failed|unsound|off by|miscalculat\w*|misread|mixed? up|but|however|although|though|unfortunately|yet|incomplete|unfinished|not finished|missing|wasn'?t|isn'?t)\b/i;
const NEGATIVE_STRICT = /\b(wrong(?:ly)?|incorrect(?:ly)?|errors?|mistakes?|slips?|not (?:right|correct|valid|true)|isn'?t (?:right|correct)|false|invalid|flawed|oops|miscalculat\w*)\b/i;
const SELF_RIGHT = /\b(?:this|that|it|the line|line \d+)\s+(?:is|looks|seems|was|reads)\s+(?:correct|right|fine|good|valid|true|accurate|sound)\b/i;
const CHECKED_CLAIM = /\b(verified|confirmed|proved|proven|ticked|the engine (?:checked|confirmed|verified|marked|proved)|marked (?:right|correct|wrong)|is (?:definitely )?(?:correct|right|wrong|incorrect))\b/i;
const NEGATED_CHECK = /\b(?:not|never|cannot|can'?t|could not|couldn'?t|unable to|wasn'?t|isn'?t)\b[^.;,]{0,30}\b(?:verified|verify|confirmed|confirm|checked|check|proved|prove)\b/gi;
const SENTENCE = /[^.!?]+[.!?]?/g;
const STOP = new Set(['this', 'that', 'line', 'value', 'with', 'from', 'which', 'then', 'step', 'your', 'have', 'been', 'here', 'only', 'into', 'than', 'same', 'does', 'make', 'made', 'will', 'what', 'when', 'were', 'they', 'them', 'also', 'each', 'such', 'both', 'because', 'would', 'could', 'should', 'there', 'their', 'about', 'after', 'before', 'again', 'using', 'used', 'uses', 'like', 'next', 'now', 'recompute', 'function', 'question', 'expression', 'equation', 'result', 'answer', 'working']);

/** Words in a comment: prose words, and each typeset expression counts as two (it takes the room of two). */
export function wordCount(comment) {
  const prose = proseOf(comment).split(/\s+/).filter(Boolean);
  return prose.length + prose.filter(w => /^⟦\d+⟧$/.test(w)).length;
}

function contentTokens(text) {
  const plain = String(text ?? '').replace(/\$[^$]*\$/g, m => ` ${latexToPlain(m.slice(1, -1)) || ''} `);
  const words = (plain.toLowerCase().match(/[a-zऀ-ॿ]{4,}/g) || []).filter(w => !STOP.has(w));
  const nums = numbersIn(plain).map(n => `#${n}`);
  return new Set([...words, ...nums]);
}

function sentencesOf(comment) {
  return (String(comment ?? '').match(SENTENCE) || []).map(s => s.trim()).filter(Boolean);
}

/** The text a comment may legitimately draw its statements from, squashed. */
export function buildCorpus({ studentLines = [], solution = null, question = null, states = [] } = {}) {
  const lineText = studentLines.map(String).join('\n');
  const solutionBits = [];
  for (const st of solution?.steps || []) solutionBits.push(String(st?.d ?? ''), String(st?.h ?? ''));
  solutionBits.push(String(solution?.answerText ?? ''));
  const reasonBits = [];
  for (const s of states) {
    if (s?.reason && typeof s.reason === 'object') reasonBits.push(s.reason.message, s.reason.title, s.reason.fix);
    else if (typeof s?.reason === 'string') reasonBits.push(s.reason);
  }
  const prompt = String(question?.prompt ?? '');
  const strip = t => String(t).replace(/\\\(|\\\)/g, ' ').replace(/\$/g, ' ');
  const plainOf = t => String(t).replace(/\$([^$]+)\$/g, (_, m) => ` ${latexToPlain(m) ?? m} `);
  const all = [lineText, ...solutionBits, ...reasonBits, prompt].map(t => `${strip(plainOf(t))}\n`).join('\n');
  const lineCanon = new Set();
  for (const l of studentLines) {
    for (const k of canonSlices(l)) lineCanon.add(k);
    // and the line as a comment would typeset it (what a quotation of it looks like after the round trip)
    const rt = latexToPlain(lineTex(l).replace(/^\$|\$$/g, ''));
    if (rt) for (const part of rt.split(/\bor\b|\band\b/)) for (const k of canonSlices(part)) lineCanon.add(k);
  }
  const allCanon = new Set(lineCanon);
  const addPlain = t => { for (const part of String(t).split(/[\n;,:]|\bso\b|\bthen\b|\bor\b|\band\b/)) if (part.includes('=')) for (const k of canonSlices(part)) allCanon.add(k); };
  for (const bit of [...solutionBits, ...reasonBits, prompt]) {
    for (const m of String(bit ?? '').matchAll(/\$([^$]+)\$/g)) { const p = latexToPlain(m[1]); if (p) for (const part of p.split(/\bor\b|\band\b|,/)) for (const k of canonSlices(part)) allCanon.add(k); }
    addPlain(String(bit ?? '').replace(/\$[^$]*\$/g, ' '));
  }
  return {
    lineCanon, allCanon,
    lineSquash: squash(lineText),
    allSquash: squash(all),
    studentNumbers: numbersIn(lineText),
    promptNumbers: numbersIn(plainOf(prompt)),
    allNumbers: numbersIn(all)
  };
}

function sourced(plain, corpus, canonKey = 'allCanon', squashKey = 'allSquash') {
  const s = squash(plain);
  return (s.length > 0 && corpus[squashKey].includes(s)) || canonSlices(plain).has(canonStmt(plain)) && corpus[canonKey].has(canonStmt(plain));
}

/** Check one comment against its line, the engine and the key. Returns [{ rule, code }] (empty = acceptable). */
export function violationsOf(comment, ctx) {
  const out = [];
  const add = (rule, code) => { if (!out.some(v => v.code === code)) out.push({ rule, code }); };
  const { line, resolved = true, question = null, solution = null, studentLines = [], language = 'en' } = ctx;
  const text = String(comment?.text ?? '');
  const kind = comment?.kind;
  const state = line?.state;
  const prose = proseOf(text);
  const en = language !== 'hi';

  // ── f · style ────────────────────────────────────────────────────────────
  if (!COMMENT_KINDS.includes(kind)) add('f', 'kind-unknown');
  const words = wordCount(text);
  if (words < MIN_WORDS) add('f', 'too-short');
  if (words > MAX_WORDS) add('f', 'too-long');
  if (EM_DASH.test(text)) add('f', 'em-dash');
  if (/!/.test(text)) add('f', 'exclamation');
  if (en && OPENERS[state]) {
    const opens = OPENERS[state].some(o => new RegExp(`^${o}\\b`).test(text.trim()));
    if (!opens) add(state === 'first-error' ? 'b' : state === 'not-checked' ? 'c' : 'a', 'wrong-opening-status');
  }
  if (CONTROL.test(text)) add('f', 'control-character');
  if (EMOJI.test(text)) add('f', 'emoji');
  if (en) {
    const prompt = String(question?.prompt ?? '');
    const inQuestion = re => { const m = re.exec(prose); return !!m && new RegExp(`\\b${m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(prompt.replace(/\$[^$]*\$/g, ' ')); };
    if (PRAISE.test(prose)) add('f', 'praise-inflation');
    if (HEDGE.test(prose)) add('f', 'hedging');
    if (NEATNESS.test(prose) && !inQuestion(NEATNESS)) add('f', 'neatness-remark');
    const reasonText = typeof line?.reason === 'object' && line.reason ? `${line.reason.message} ${line.reason.title} ${line.reason.fix}` : String(line?.reason ?? '');
    if (sentencesOf(prose).some(x => NOTATION.test(x) && NOTATION_COMPLAINT.test(x)) && !/notation|bracket|format|unit|convention/i.test(reasonText)) add('f', 'notation-remark');
    if (MARKS.test(prose) && !inQuestion(MARKS)) add('f', 'marks-talk');
    if (INJECTION.test(prose)) add('f', 'echoed-instruction');
  } else {
    if (/(शानदार|बेहतरीन|उत्कृष्ट|कमाल|बहुत बढ़िया|वाह|शाबाश|लाजवाब)/.test(prose)) add('f', 'praise-inflation');
    if (/(अंक|नंबर पाए|मार्क)/.test(prose)) add('f', 'marks-talk');
    if (/(लिखावट|सुंदर|साफ़ नहीं|गंदा)/.test(prose)) add('f', 'neatness-remark');
  }

  // ── the kind must belong to the engine's state ───────────────────────────
  const allowed = KINDS_FOR_STATE[state] || [];
  if (COMMENT_KINDS.includes(kind) && !allowed.includes(kind)) add(state === 'first-error' ? 'b' : state === 'not-checked' ? 'c' : 'a', 'kind-contradicts-state');

  const n = line?.n;
  const refs = [...prose.matchAll(/\bline\s+(\d+)\b/gi)].map(m => Number(m[1]));

  // ── a · verified lines ───────────────────────────────────────────────────
  if (state === 'verified' || state === 'from-question' || state === 'condition' || state === 'arithmetic') {
    if (en && NEGATIVE.test(prose)) add('a', 'implies-wrong');
    if (!en && /(गलत|त्रुटि|ग़लत|भूल|सही नहीं|लेकिन|परंतु)/.test(prose)) add('a', 'implies-wrong');
    if (refs.some(r => r !== n && r !== n - 1)) add('a', 'names-other-line');
  }
  // ── g · an arithmetic tick says the line is true as written, never that it is the right step ─────────────
  if (state === 'arithmetic') {
    if (en && RIGHT_STEP.test(prose)) add('g', 'claims-right-step');
    if (!en && /(सही (?:कदम|विधि|तरीका|चरण)|उचित (?:कदम|विधि))/.test(prose)) add('g', 'claims-right-step');
  }
  if (state === 'incomplete' && en && NEGATIVE_STRICT.test(prose)) add('a', 'calls-incomplete-wrong');

  // ── b · the first error ──────────────────────────────────────────────────
  if (state === 'first-error') {
    if (refs.some(r => r !== n && r !== n - 1)) add('b', 'moves-error');
    if (en && SELF_RIGHT.test(prose)) add('b', 'says-line-right');
    if (!en && /(सही है|ठीक है)/.test(prose)) add('b', 'says-line-right');
    const r = line.reason || {};
    const reasonSet = contentTokens(`${r.message || ''} ${r.title || ''} ${r.fix || ''}`);
    const mine = contentTokens(text);
    let shared = 0;
    for (const t of reasonSet) if (mine.has(t)) shared += 1;
    if (reasonSet.size && shared < Math.min(2, reasonSet.size)) add('b', 'disagrees-with-engine-reason');
  }
  if (state === 'follows') {
    if (en && /\b(another|second|new|further|additional) (error|mistake|slip)\b|\bthis line is (wrong|incorrect)\b/i.test(prose)) add('a', 'invents-second-error');
    if (en && SELF_RIGHT.test(prose) === false && /\b(wrong|incorrect)\b/i.test(prose) && !/\b(earlier|above|before|first|line \d+)\b/i.test(prose)) add('a', 'blames-follow-on-line');
  }

  // ── c · lines the engine could not check ─────────────────────────────────
  if (state === 'not-checked' || state === 'not-read') {
    if (en && CHECKED_CLAIM.test(prose.replace(NEGATED_CHECK, ' '))) add('c', 'claims-checked');
    if (!en && /(सत्यापित|पुष्टि)/.test(prose)) add('c', 'claims-checked');
  }

  // ── d · every mathematical statement ─────────────────────────────────────
  const corpus = buildCorpus({ studentLines, solution, question, states: ctx.states || [line] });
  const key = question?.answerKey;
  const fns = question?.fns || null;
  for (const span of mathSpans(text)) {
    const res = checkSpan(span.tex, { fns, solutions: question?.solutions || null });
    // A statement copied from the student's own line is a quotation (their wrong line is still their line), never a claim.
    const quoted = res.plain && sourced(res.plain, corpus, 'lineCanon', 'lineSquash');
    // An equality the comment itself calls false ("this would give the false statement 20 = 10") is not an assertion of it.
    const sentence = sentencesOf(text).find(x => x.includes(span.tex)) || '';
    const disclaimed = /\b(false|untrue|not true|not equal|isn'?t equal|does not equal|doesn'?t equal|cannot equal|can'?t equal)\b/i.test(sentence);
    if (res.status === 'false' && !quoted && !disclaimed) add('d', 'false-equality');
    else if (res.status === 'conditional') {
      const claim = valueClaim(res.plain);
      const grounded = sourced(res.plain, corpus);
      if (claim && !grounded && !corpus.allNumbers.some(v => sameNumber(v, claim.value))) add('d', 'ungrounded-value');
      else if (!grounded && !claim) add('d', 'unsupported-equation');
    }
    const claim2 = res.plain ? valueClaim(res.plain) : null;
    if (claim2 && key?.numeric != null && /^(ans|answer|max|min|maximum|minimum|maxvalue|minvalue)$/i.test(claim2.name.replace(/[\s_]/g, '')) && !sameNumber(claim2.value, key.numeric)) add('d', 'wrong-answer-attributed');
  }
  const lineKeys = new Set(studentLines.map(l => squash(l)));
  for (const m of text.matchAll(/(?:your (?:line|working|step|answer|expression|result|value|equation)|you (?:wrote|have written|had|put|got|found|said)|line \d+(?: (?:says|reads|gives|has|shows|is))?)[^$.]{0,30}\$([^$]+)\$/gi)) {
    const plain = latexToPlain(m[1]);
    if (plain === null) { add('d', 'misquoted-line'); continue; }
    const sq = squash(plain);
    const matched = [...lineKeys].some(k => k && (k.includes(sq) || sq.includes(k))) || corpus.lineCanon.has(canonStmt(plain));
    if (!matched) add('d', 'misquoted-line');
  }
  if (key?.numeric != null && en) {
    for (const s of sentencesOf(prose.replace(/⟦\d+⟧/g, m => {
      const sp = mathSpans(text)[Number(m.replace(/\D/g, ''))];
      const p = sp ? latexToPlain(sp.tex) : '';
      return p || '';
    }))) {
      if (/\b(you|your|yours)\b/i.test(s)) continue;
      const pat1 = /\b(answer|result|maximum(?: value)?|minimum(?: value)?|solution)\b[^.]{0,30}?(?:\bis\b|\bare\b|\bequals\b|\bgives\b|\bshould be\b|\bcomes to\b)\s*(-?\d+(?:\.\d+)?)/i.exec(s);
      const pat2 = /(-?\d+(?:\.\d+)?)\s*(?:\w+\s*){0,2}(?:is|as) the (?:final |correct |required )?(?:answer|maximum|minimum|result)/i.exec(s);
      for (const mm of [pat1 && Number(pat1[2]), pat2 && Number(pat2[1])]) {
        if (mm !== null && mm !== undefined && mm !== false && Number.isFinite(mm) && !sameNumber(mm, key.numeric)) add('d', 'wrong-answer-attributed');
      }
    }
  }

  // ── e · nothing is revealed before the question is resolved ──────────────
  if (!resolved) {
    const sq = squash(prose.replace(/⟦\d+⟧/g, '') + ' ' + mathSpans(text).map(s => latexToPlain(s.tex) || '').join(' '));
    const answer = squash(solution?.answerText || '');
    if (answer.length >= 2 && sq.includes(answer) && !corpus.lineSquash.includes(answer)) add('e', 'reveals-answer');
    if (key?.numeric != null) {
      const nums = [...numbersIn(text)];
      if (nums.some(v => sameNumber(v, key.numeric)) && !corpus.studentNumbers.some(v => sameNumber(v, key.numeric)) && !corpus.promptNumbers.some(v => sameNumber(v, key.numeric))) add('e', 'reveals-answer');
    }
    const mine = new Set(mathSpans(text).map(sp => { const p = latexToPlain(sp.tex); return p ? canonStmt(p) : null; }).filter(Boolean));
    for (const st of solution?.steps || []) {
      for (const sp of mathSpans(String(st?.d ?? ''))) {
        const p = latexToPlain(sp.tex);
        if (!p || squash(p).length < 6) continue;
        const k = canonStmt(p);
        if (mine.has(k) && !corpus.lineCanon.has(k)) add('e', 'reveals-later-step');
      }
    }
  }
  return out;
}

export function isAcceptable(comment, ctx) {
  return violationsOf(comment, ctx).length === 0;
}
