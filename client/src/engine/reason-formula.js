// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Step Check for "put the given values into a formula"
//
// Find the 9th term; find the sum of the first 12 terms; find the amount after
// 14 months. The answer is a number, and a page of working for it has no
// unknown in it after the second line:
//
//   a = 9, d = 3            the values the question gives
//   T_n = a + (n - 1)d      the formula
//   T_9 = 9 + 8 × 3         the values put into it
//       = 9 + 24            the arithmetic
//       = 35                the answer
//
// Authored metadata says what the question is made of:
//
//   { kind: 'formula', source: 'a + (n - 1)*d', substitutions: { a: 9, d: 3, n: 9 },
//     expected: 33, labels: ['T_n', 'a_n', …], name: 'the nth term of an AP',
//     confusables: [{ source: 'n/2*(2*a + (n - 1)*d)', name: 'the sum of the first n terms', labels: ['S_n'] }] }
//
// A confusable marked `step: true` is also a legitimate step on the way (the
// last term, on the way to a sum by n/2 × (a + l)): written under its own name
// it is a true line, and it is the mistake only if the working ENDS there.
//
// and each line is then one of a small number of things, each decidable:
//
//   given          `d = 3` — the question's own value for that letter, or not
//   formula        an expression in the question's letters — the authored
//                  formula written any equivalent way, a formula the question
//                  authored as the one it is confused with, or neither
//   substitution   arithmetic that has the formula's value for these numbers
//   arithmetic     each side of a chain against the side before it — the line
//                  audit (lineAudit.js), which needs no key
//
// A line is a mistake only when it is shown to be one. A name the metadata does
// not know, a side that cannot be read, a letter where a digit probably was:
// each is a note. After the first mistake nothing is penalised twice: a line
// that is true of the student's own wrong value is marked as following from it,
// and a second slip that is independent of the first is reported as its own.
//
// Deterministic; the expected value is recomputed from source + substitutions
// and authored `expected` is accepted only when it agrees.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf, numsClose, exprEquivalent } from './expr.js';
import { auditWorking, describeBreak } from './lineAudit.js';

const fmt = v => {
  const n = Number(Number(v).toPrecision(10));
  return Object.is(n, -0) ? '0' : String(n);
};
const squash = text => String(text ?? '').toLowerCase().replace(/[\s{}]/g, '').replace(/[₀-₉]/g, ch => String(ch.charCodeAt(0) - 0x2080));
const close = (a, b) => numsClose(a, b, 1e-9);

function compile(source, env) {
  try {
    const ast = parse(normalize(String(source)));
    if (ast.t === 'equation') return null;
    const value = evaluate(ast, env);
    return Number.isFinite(value) ? { ast, value, text: normalize(String(source)) } : null;
  } catch { return null; }
}

/** Read the authored metadata, or null when it cannot be trusted to mark anything. */
export function formulaPlan(meta) {
  if (meta?.kind !== 'formula' || typeof meta.source !== 'string' || !meta.substitutions || typeof meta.substitutions !== 'object') return null;
  const env = {};
  for (const [name, value] of Object.entries(meta.substitutions)) {
    if (!/^[A-Za-z]$/.test(name) || !Number.isFinite(Number(value))) return null;
    env[name] = Number(value);
  }
  const main = compile(meta.source, env);
  if (!main) return null;
  if (Number.isFinite(Number(meta.expected)) && !close(main.value, Number(meta.expected))) return null;
  const confusables = (Array.isArray(meta.confusables) ? meta.confusables : []).map(c => {
    const compiled = compile(c?.source, env);
    return compiled ? { ...compiled, name: String(c.name || 'a different formula'), labels: (c.labels || []).map(squash), why: c.why ? String(c.why) : null, step: c.step === true } : null;
  }).filter(c => c && !close(c.value, main.value));
  return {
    env, names: new Set(Object.keys(env)), expected: main.value, source: main.text,
    labels: new Set((meta.labels || []).map(squash)),
    name: String(meta.name || 'the formula'), quantity: String(meta.quantity || 'the value asked for'), confusables
  };
}

const diagnosis = (code, title, message, fix, extra = {}) => ({ code, title, message, fix, confidence: 'high', ...extra });

function wrongFormula(plan, other, got) {
  const named = other ? `This is the formula for ${other.name}` : `This is not ${plan.name}`;
  return diagnosis('wrong-formula', 'A different formula was used',
    `${named}; the question asks for ${plan.quantity}.${other?.why ? ' ' + other.why : ''}`,
    'Before substituting, write down what the question asks for and the formula for exactly that.',
    { cls: 'wrong-formula', what: `Formula selection: ${named.charAt(0).toLowerCase()}${named.slice(1)}, not ${plan.name}.`,
      hint: 'Recheck which formula this question needs.', ...(Number.isFinite(got) ? { got } : {}) });
}

function givenMisread(name, read, value) {
  return diagnosis('given-misread', 'A given value was copied wrongly',
    `The question gives ${name} = ${fmt(value)}; this line has ${name} = ${fmt(read)}.`,
    'Copy each given value from the question before you start, and tick it off.',
    { cls: 'given-misread', what: `A value was copied wrongly from the question: ${name}.`, hint: `Recheck the value of ${name} against the question.` });
}

function substitutionWrong(plan, text, got) {
  const values = [...plan.names].map(n => `${n} = ${fmt(plan.env[n])}`).join(', ');
  return diagnosis('substitution-error', 'The substitution evaluates incorrectly',
    `With ${values}, ${plan.name} is ${fmt(plan.expected)}; ${text} is ${fmt(got)}.`,
    'Substitute one value at a time, with each in its own place in the formula.',
    { cls: 'substitution', what: 'The values were not put into the formula correctly.', hint: `Recheck each value you put into the formula on this line.` });
}

function arithmeticDiagnosis(link) {
  const said = describeBreak(link);
  return diagnosis(said.cls === 'sign' ? 'arithmetic-sign' : 'arithmetic-slip',
    said.cls === 'invalid-transformation' ? 'This line is not equal to the one before it' : 'The method is right — the arithmetic is not',
    said.correction, 'Check that one calculation and carry the rest of the working forward.',
    { cls: said.cls, what: said.what, hint: said.hint });
}

const NOTES = Object.freeze({
  carried: 'Follows from the earlier slip — consistent with your own value on the line above.',
  after: 'Follows from the earlier slip.',
  confirm: doubt => (doubt ? `Not checked — is “${doubt.read}” a ${doubt.maybe}? Please confirm this line.` : 'Not checked — this line can be read more than one way. Please confirm it.'),
  approx: 'Not checked exactly — this looks cut short rather than rounded.',
  unread: 'Not checked — this line could not be read as mathematics.',
  unknown: 'Not checked — Pri could not tell which step this is.',
  differs: (name, value) => `The question gives ${name} = ${fmt(value)} — check this line.`
});

/**
 * Check a working against a formula question. Returns the Step Check report
 * shape — { lines: [{ text, status, note?, diagnosis?, role?, carried?, later? }],
 * firstBreak, diagnosis } — over the non-blank lines, plus `final`
 * ({ value, correct } for the last value the working arrives at, or null).
 */
export function stepCheckFormula(meta, workingText) {
  const rawLines = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const plan = formulaPlan(meta);
  if (!plan) {
    return { lines: rawLines.map(text => ({ text, status: 'note', note: 'This question’s formula metadata is not consistent, so Pri will not mark the line.' })), firstBreak: -1, diagnosis: null, final: null };
  }
  const audit = auditWorking(rawLines, { vocabulary: [...plan.names] });
  const out = [];
  const givenLines = [];           // { index, name, read } — a given value written differently from the question
  let chain = { broken: false };   // the chain the next `=` line continues
  let final = null;
  const used = new Set();          // confused formulas already named: using one again is the same mistake
  const steps = [];                // { index, other } — a confusable that may be a step: the mistake only if the working ends on it
  const tries = [];                // each different value the asked quantity is set equal to
  let blameGiven = false;          // a later line is right for the value the student copied, wrong for the question's

  const closedValue = side => {
    if (side.kind === 'num') return side.values;
    if (side.kind !== 'sym' || !side.ast || !side.vars.size || ![...side.vars].every(v => plan.names.has(v))) return null;
    try { const v = evaluate(side.ast, plan.env); return Number.isFinite(v) ? [v] : null; } catch { return null; }
  };
  const nameOf = side => squash(side?.label || side?.text || '');
  const isTargetLabel = side => !!side && plan.labels.has(nameOf(side));
  // `an`, `Sn`: a name the metadata lists is a name, though it also reads as a product of letters.
  const listed = side => isTargetLabel(side) || plan.confusables.some(c => c.labels.includes(nameOf(side)));

  audit.lines.forEach((row, index) => {
    const line = { text: row.text, status: 'note' };
    out.push(line);
    if (row.verdict === 'unread') { line.note = 'Not checked — this is more working than can be checked, or the line is too long.'; line.unread = true; return; }
    const marks = [];               // every decidable thing on this line: { kind: ok|break|confirm|approx|differs|carried, … }

    for (const st of row.statements) {
      if (!st.continues) chain = { broken: false };
      const sides = st.sides;
      // `d = 3`: the question's own value for one of its letters.
      const first = sides[0];
      const lone = first?.kind === 'sym' && first.ast?.t === 'var' && plan.names.has(first.ast.v) ? first.ast.v : null;
      if (!st.continues && sides.length === 2 && lone && sides[1].kind === 'num') {
        if (sides[1].values.some(v => close(v, plan.env[lone]))) marks.push({ kind: 'ok', role: 'given' });
        else { marks.push({ kind: 'differs', name: lone }); givenLines.push({ index, name: lone, read: sides[1].values[0] }); }
        continue;
      }

      let label = !st.continues && sides.length > 1 && first?.kind === 'sym' && (listed(first) || !closedValue(first)) ? first : null;
      sides.forEach((side, k) => {
        const link = st.links[k];
        if (side.kind === 'doubt' || link?.verdict === 'confirm') { marks.push({ kind: 'confirm', doubt: side.doubt || link?.doubt || null }); chain.unsure = true; return; }
        if (side === label) {
          // A name read doubtfully (`T_q`) is confirmed before anything under it is judged.
          if (side.doubt) { marks.push({ kind: 'confirm', doubt: side.doubt }); chain.unsure = true; }
          return;
        }
        if (side.kind === 'bad') { marks.push({ kind: 'unread' }); chain.unsure = true; return; }
        const values = closedValue(side);
        if (!values) { if (side.kind === 'sym') label = label || side; return; }

        // A whole formula, in the question's letters.
        if (side.kind === 'sym') {
          let same = false;
          try { same = exprEquivalent(side.source, plan.source, {}); } catch { same = false; }
          if (same) { marks.push({ kind: 'ok', role: 'formula' }); chain.value = values; chain.target = true; return; }
          const other = plan.confusables.find(c => { try { return exprEquivalent(side.source, c.text, {}); } catch { return false; } });
          if (other && other.step && !isTargetLabel(label)) {
            // True of the quantity it names, and possibly on the way: decided at the end.
            steps.push({ index, other }); marks.push({ kind: 'ok', role: 'value' }); chain.value = values; chain.step = other; return;
          }
          if (other) {
            marks.push(used.has(other) ? { kind: 'carried' } : { kind: 'break', diagnosis: wrongFormula(plan, other) });
            used.add(other); chain.broken = true; chain.value = values; return;
          }
        }

        const previous = k > 0 ? sides[k - 1] : null;
        const before = previous && previous !== label ? closedValue(previous) : (st.continues && k === 0 ? chain.value : null);
        if (chain.unsure) { marks.push({ kind: 'confirm', doubt: null, after: true }); return; }

        if (before) {
          // Against the side before it: the audit's verdict where both are
          // plain arithmetic, the given values where a letter is involved.
          if (link && (link.verdict === 'ok' || link.verdict === 'break' || link.verdict === 'approx')) {
            if (link.verdict === 'ok' && link.how === 'recovered') { chain.broken = false; marks.push({ kind: 'ok', role: 'arithmetic', how: link.how }); }
            else if (link.verdict === 'ok') {
              const answer = side.bare && chain.target && values.some(v => close(v, plan.expected));
              marks.push(chain.broken ? { kind: 'carried' } : { kind: 'ok', role: answer ? 'answer' : side.bare ? 'value' : 'arithmetic', how: link.how });
            }
            else if (link.verdict === 'approx') marks.push({ kind: 'approx' });
            else { marks.push({ kind: 'break', diagnosis: arithmeticDiagnosis(link), later: chain.broken }); chain.broken = true; }
          } else if (before.some(x => values.some(y => close(x, y)))) {
            // Arithmetic not yet worked out that has the formula's value is the
            // substitution; anything else true of the given values is a value.
            const substituted = !side.bare && values.some(v => close(v, plan.expected));
            marks.push(chain.broken ? { kind: 'carried' } : { kind: 'ok', role: substituted ? 'substitution' : 'value' });
          } else if (side.kind === 'num' && previous?.kind === 'sym') {
            const d = diagnosis('substitution-error', 'The substitution evaluates incorrectly',
              `With the given values, ${previous.text} = ${fmt(before[0])}, not ${fmt(values[0])}.`,
              'Substitute one value at a time, then evaluate.',
              { cls: 'substitution', what: 'The values were not put in correctly.', hint: `Recheck the value of ${previous.text}.` });
            marks.push({ kind: 'break', diagnosis: d, later: chain.broken }); chain.broken = true;
          } else {
            marks.push({ kind: 'unknown' });
          }
          chain.value = values;
          if (side.kind === 'num') final = { value: values[0], line: index };
          return;
        }

        // The head of a chain: what a name is set equal to, or a line that
        // starts with arithmetic.
        chain.value = values;
        if (side.kind === 'num') final = { value: values[0], line: index };
        const target = isTargetLabel(label);
        if (target && !tries.some(v => close(v, values[0]))) tries.push(values[0]);
        if (values.some(v => close(v, plan.expected))) {
          chain.target = true;
          marks.push({ kind: 'ok', role: side.kind === 'sym' ? 'substitution' : side.bare ? 'answer' : 'substitution' });
          return;
        }
        const other = !side.bare ? plan.confusables.find(c => values.some(v => close(v, c.value))) : null;
        // By its value alone a line is called the confused formula only under
        // a name that says so: the asked quantity's, or the other formula's own.
        if (other && other.step && !target) {
          steps.push({ index, other }); marks.push({ kind: 'ok', role: 'value' }); chain.step = other; return;
        }
        if (other && (target || (label && other.labels.includes(nameOf(label))))) {
          marks.push(used.has(other) ? { kind: 'carried' } : { kind: 'break', diagnosis: wrongFormula(plan, other, values[0]) });
          used.add(other); chain.broken = true; chain.target = true; return;
        }
        if (givenLines.length && !side.bare) {
          const theirs = { ...plan.env };
          for (const g of givenLines) theirs[g.name] = g.read;
          let v = NaN;
          try { v = evaluate(parse(plan.source), theirs); } catch { v = NaN; }
          if (values.some(x => close(x, v))) { marks.push({ kind: 'carried' }); blameGiven = true; chain.broken = true; chain.target = true; return; }
        }
        if (target) {
          marks.push({ kind: 'break', diagnosis: side.bare
            ? diagnosis('wrong-value', 'This value is not what the formula gives', `With the given values, ${plan.name} is ${fmt(plan.expected)}, not ${fmt(values[0])}.`, 'Show the substitution and each step of the arithmetic, so the slip can be found.', { cls: 'unknown', what: 'The value on this line is wrong, and the working does not show where it came from.', hint: 'Show how you got this value, one step per line.' })
            : substitutionWrong(plan, side.text, values[0]) });
          chain.broken = true; chain.target = true;
          return;
        }
        // Side working (`8 × 3 = 24`, `n - 1 = 8`) and names Pri does not know: judged by their own chain only.
        if (label && label.kind === 'sym' && !label.ast && !label.label) marks.push({ kind: 'unknown' });
      });
    }

    // One status for the line.
    const broke = marks.find(m => m.kind === 'break');
    const confirm = marks.find(m => m.kind === 'confirm');
    const ok = marks.filter(m => m.kind === 'ok');
    if (broke) {
      line.status = 'break'; line.diagnosis = broke.diagnosis; line.note = broke.diagnosis.message; if (broke.later) line.later = true;
    } else if (confirm) {
      line.confirm = true; line.note = confirm.after ? 'Not checked — confirm the line above first.' : NOTES.confirm(confirm.doubt);
    } else if (marks.some(m => m.kind === 'differs')) {
      const m = marks.find(x => x.kind === 'differs');
      line.note = NOTES.differs(m.name, plan.env[m.name]); line.differs = m.name;
    } else if (marks.some(m => m.kind === 'approx')) {
      line.note = NOTES.approx;
    } else if (marks.some(m => m.kind === 'carried')) {
      line.carried = true; line.note = NOTES.carried;
    } else if (ok.length && !marks.some(m => m.kind === 'unread')) {
      line.status = 'ok';
      const order = ['formula', 'substitution', 'arithmetic', 'value', 'answer', 'given'];
      line.role = order.find(r => ok.some(m => m.role === r)) || 'arithmetic';
      if (ok.some(m => m.how === 'rounded')) line.rounded = true;
    } else {
      line.note = marks.some(m => m.kind === 'unread') ? NOTES.unread : NOTES.unknown;
      if (!marks.length) line.unjudged = true;
    }
  });

  // A slip that began with a given value copied wrongly is a mistake on THAT
  // line: what was built on it follows from it.
  if (blameGiven && !out.slice(0, givenLines[0].index).some(l => l.status === 'break')) {
    const g = givenLines[0];
    const d = givenMisread(g.name, g.read, plan.env[g.name]);
    out[g.index] = { text: out[g.index].text, status: 'break', diagnosis: d, note: d.message };
  }

  // A step that was never built on: the working ends at the value of the
  // confused formula, so choosing it was the mistake. What followed it in its
  // own chain follows from it.
  if (steps.length && final && !out.some(l => l.status === 'break')) {
    const ended = steps.find(st => close(final.value, st.other.value));
    if (ended) {
      const d = wrongFormula(plan, ended.other, final.value);
      out[ended.index] = { text: out[ended.index].text, status: 'break', diagnosis: d, note: d.message };
      for (let i = ended.index + 1; i < out.length; i += 1) {
        if (out[i].status === 'ok' && out[i].role !== 'given') out[i] = { text: out[i].text, status: 'note', carried: true, note: NOTES.carried };
      }
    }
  }

  // One first mistake. A later one that is independent of it is kept, as its
  // own note; a line that is true in itself stays verified.
  const firstBreak = out.findIndex(l => l.status === 'break');
  for (let i = firstBreak + 1; firstBreak >= 0 && i < out.length; i += 1) {
    const l = out[i];
    if (l.status === 'break') { l.status = 'note'; l.later = true; l.note = l.diagnosis.message; }
  }
  if (final) final = { value: final.value, line: final.line, correct: close(final.value, plan.expected) };
  return { lines: out, firstBreak, diagnosis: firstBreak >= 0 ? out[firstBreak].diagnosis : null, final, tries: tries.length };
}

/**
 * Method marks for a formula question with a wrong final answer.
 *
 * The rubric of such a question is: the formula, the substitution, the answer.
 * A line earns the criterion it is evidence of, once, and only before the first
 * mistake:
 *   formula        the authored formula, written out in letters
 *   substitution   arithmetic, not yet worked out, that has the formula's value
 * Capped one below the question's marks — the last mark is the answer's.
 * A given value restated, arithmetic on the side, a bare value and anything
 * after the first mistake earn nothing; nor does anything when the working
 * sets the asked quantity equal to three or more different values (a list of
 * tries).
 */
export function formulaMethodMarks({ meta, working, marks, report = null } = {}) {
  const rep = report || stepCheckFormula(meta, working);
  const okLines = rep.lines.filter(l => l.status === 'ok');
  if (!okLines.length) return null;
  const total = Math.max(1, Number(marks) || 1);
  const cap = Math.max(0, total - 1);
  const credited = new Set();
  // Three or more different values for the asked quantity are a list of tries,
  // not a derivation (two are a slip and what followed from it).
  const sweep = Number(rep.tries) >= 3;
  let restated = 0;
  const vector = rep.lines.map((l, index) => {
    const row = { index, text: String(l.text ?? ''), status: l.status, mark: 0, reason: l.status === 'ok' ? 'progress' : l.status };
    if (l.status !== 'ok') return row;
    if (rep.firstBreak >= 0 && index > rep.firstBreak) { row.reason = 'after-mistake'; return row; }
    if (l.role === 'given') { restated += 1; row.reason = 'restated'; return row; }
    if (l.role === 'answer' || l.role === 'value') { row.reason = 'final-answer'; return row; }
    if (l.role !== 'formula' && l.role !== 'substitution') { row.reason = 'unrelated'; return row; }
    if (sweep) { row.reason = 'contradicted'; return row; }
    if (credited.has(l.role)) { row.reason = 'repeat'; return row; }
    if (credited.size >= cap) { row.reason = 'cap'; return row; }
    credited.add(l.role);
    row.mark = 1; row.stage = l.role;
    return row;
  });
  const awarded = Math.min(cap, credited.size);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const note = awarded > 0
    ? `${plural(awarded, 'mark')} for correct working — the final answer was wrong, but ${[...credited].map(r => (r === 'formula' ? 'the formula' : 'the substitution')).join(' and ')} ${credited.size === 1 ? 'was' : 'were'} right.`
    : cap === 0
      ? 'No method marks: this question carries a single mark, for the answer.'
      : restated ? 'No method marks: the lines that check out only restate the question.' : 'No method marks: correct working earns marks only for the formula and the substitution.';
  return { okLines: okLines.length, progressLines: credited.size, restatedLines: restated, awarded, note, lines: vector, report: rep };
}
