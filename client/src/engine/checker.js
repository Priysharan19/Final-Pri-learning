// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Answer checker + Pri Reason safety layer
//
// The mature answer-format checker remains in checker-core.js. This facade keeps
// that API stable while routing mathematical working through Pri Reason.
// ─────────────────────────────────────────────────────────────────────────────

import { normalize, parse, evaluate, exprEquivalent, numsClose } from './expr.js';
import { diagnoseStep } from './diagnose.js';
import {
  assessEquationLine, sameEquationClaim, sameExpressionClaim,
  assessRelationLine, assessDerivativeLine, parseRelation
} from './reason-v2-safe.js';
import { assessEvaluationLine, assessPointLine } from './reason-v3.js';
import { assessRelationChainLine, assessModulusInequalityLine } from './reason-v4.js';
import { cleanInput, parseNumericInput, checkAnswer as coreCheckAnswer } from './checker-core.js';

export { cleanInput, parseNumericInput };

function malformedRatioInput(rawInput) {
  const s = cleanInput(rawInput).replace(/\bto\b/gi, ':').replace(/\s+/g, '');
  const hasColon = s.includes(':');
  const hasSlash = s.includes('/');
  if (hasColon && hasSlash) return true;
  if (!hasColon && !hasSlash) return false;
  const parts = s.split(hasColon ? ':' : '/');
  return parts.length !== 2 || parts.some(part => part === '');
}

export function checkAnswer(question, rawInput) {
  if (question?.answerType === 'working') return checkWorking(question, String(rawInput ?? ''));
  if (question?.answerType === 'ratio' && malformedRatioInput(rawInput)) {
    return { correct: false, feedback: 'Write the ratio with exactly two parts, like 2 : 3.' };
  }
  return coreCheckAnswer(question, rawInput);
}

function uniqueNumeric(values) {
  const out = [];
  for (const v of values || []) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (!out.some(x => numsClose(x, n, 1e-7))) out.push(n);
  }
  return out;
}

function lostRootDiagnosis(variable, kept, total) {
  return {
    code: 'lost-root',
    title: 'A solution was dropped',
    message: `${variable} = ${kept} is one valid solution, but the original equation has ${total} solutions. This line has thrown at least one away.`,
    fix: 'When an equation branches, keep every branch until each solution has been checked.',
    confidence: 'high'
  };
}

function extraListedRootDiagnosis(variable, value) {
  return {
    code: 'extraneous-solution',
    title: 'An extra solution was introduced',
    message: `${variable} = ${value} is listed here, but it does not solve the original equation.`,
    fix: 'Check every proposed solution in the original equation before keeping it.',
    confidence: 'high'
  };
}

// ── Diagnosis confidence ─────────────────────────────────────────────────────
// Every diagnosis that leaves Step Check says how sure the engine is. `high`
// means exactly one authored move reproduces the student's line, or the line
// was disproved outright against the authored solution; `medium` means more
// than one move fits, or the verdict rests on a counterexample alone. The copy
// a student reads hedges medium ("This looks like …") and states high.
export const DIAGNOSIS_CONFIDENCE = ['high', 'medium'];

function withConfidence(diagnosis) {
  if (!diagnosis || typeof diagnosis !== 'object') return diagnosis;
  const confidence = DIAGNOSIS_CONFIDENCE.includes(diagnosis.confidence) ? diagnosis.confidence : 'medium';
  return diagnosis.confidence === confidence ? diagnosis : { ...diagnosis, confidence };
}

/** The one-line verdict for a broken line, hedged when the diagnosis is not certain. */
export function diagnosisVerdict(diagnosis, lineNumber) {
  const d = withConfidence(diagnosis);
  if (!d || d.code === 'counterexample') return 'There’s a slip in your working — Step Check has marked the line where it breaks.';
  const where = lineNumber ? ` — line ${lineNumber} is marked below.` : '.';
  return d.confidence === 'high' ? `${d.title}${where}` : `This looks like: ${d.title}${where}`;
}

// ── Pairs of linear equations (and any system with one authored solution) ───
// A system pins its solution, so every equation a student writes on the way is
// a consequence of it exactly when it holds at that solution — the line can be
// proved or disproved by substitution alone, whichever variable it is in. A
// pair "x = 2, y = 3" and a point "(2, 3)" are read the same way.
function systemDiagnosis(vars, sol, L, R) {
  const fmt = v => Number(Number(v).toPrecision(10));
  return {
    code: 'system-line-false',
    title: 'This line is not true for the solution of the system',
    message: `With ${vars.map(v => `${v} = ${fmt(sol[v])}`).join(' and ')} — the solution of the pair — this line reads ${fmt(L)} = ${fmt(R)}, which is false.`,
    fix: 'Compare it term by term with the line above: a term or a sign changed on the way, or the substitution was made into the wrong equation.',
    confidence: 'high'
  };
}

export function assessSystemLine({ text, meta = null } = {}) {
  const vars = Array.isArray(meta?.variables) && meta.variables.length ? meta.variables : Object.keys(meta?.solution || {});
  const sol = meta?.solution || {};
  if (!vars.length || vars.some(v => !Number.isFinite(Number(sol[v])))) {
    return { status: 'note', trusted: false, note: 'Pri needs the authored solution of the system before it can verify this line.' };
  }
  const env = {};
  for (const v of vars) env[v] = Number(sol[v]);
  const src = String(text || '').trim().replace(/[−–—]/g, '-').replace(/^∴\s*/, '').replace(/^(so|hence|then|therefore)\s+/i, '');
  if (!src) return { status: 'note', trusted: false, note: 'Skipped — an empty line.' };

  const holds = ast => {
    const L = evaluate(ast.l, env), R = evaluate(ast.r, env);
    if (!Number.isFinite(L) || !Number.isFinite(R)) return null;
    return { same: Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6, L, R };
  };

  // "(2, 3)" — the solution as a point, in the order the variables were named
  if (vars.length === 2 && !src.includes('=')) {
    const assessed = assessPointLine({ text: src, meta: { kind: 'point', x: env[vars[0]], y: env[vars[1]] } });
    if (assessed.status !== 'note') return assessed;
  }
  if (!src.includes('=')) return { status: 'note', trusted: false, note: 'Skipped — this line makes no claim Pri can test against the solution.' };

  // "x = 2, y = 3" / "x = 2 and y = 3" — every part must hold
  const parts = src.split(/,|;|\band\b/i).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read this line safely.' };
  for (const part of parts) {
    let ast;
    try { ast = parse(normalize(part)); } catch { return { status: 'note', trusted: false, note: 'Skipped — I couldn’t parse this line as maths.' }; }
    if (ast.t !== 'equation') return { status: 'note', trusted: false, note: 'Skipped — this is not an equation.' };
    const h = holds(ast);
    if (!h) return { status: 'note', trusted: false, note: 'Skipped — this line could not be evaluated at the solution.' };
    if (!h.same) {
      const diagnosis = systemDiagnosis(vars, sol, h.L, h.R);
      return { status: 'break', trusted: false, note: diagnosis.message, diagnosis };
    }
  }
  return { status: 'ok', trusted: true };
}

/**
 * Read a natural final solution list before normalize() removes commas.
 * Accepted forms include:
 *   x = 3 or x = -3
 *   x = 3, -3
 *   x = 3; x = -3
 * A single equation is deliberately not handled here.
 */
function readSolutionList(raw, meta) {
  if (meta?.kind !== 'equation' || !meta.variable || !Array.isArray(meta.solutions)) return null;
  let src = String(raw || '').trim()
    .replace(/[−–—]/g, '-')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '');
  if (!/(\bor\b|,|;)/i.test(src)) return null;
  const variable = String(meta.variable).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lead = new RegExp(`^${variable}\\s*=\\s*`, 'i');
  const parts = src.split(/\bor\b|,|;/i).map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  // "x + 3 = 0 or x + 6 = 0" is how NCERT writes the two branches of a factorised
  // quadratic on one line. Each part names its root as directly as "x = -3".
  const branch = new RegExp(`^${variable}\\s*([+-])\\s*(.+?)\\s*=\\s*0$`, 'i');
  const values = [];
  for (let part of parts) {
    part = part.replace(lead, '').trim();
    if (!part) return { values: [], invalid: true };
    if (part.includes('=')) {
      const m = part.match(branch);
      if (!m) return { values: [], invalid: true };
      try { values.push((m[1] === '+' ? -1 : 1) * parseNumericInput(m[2]).value); }
      catch { return { values: [], invalid: true }; }
      continue;
    }
    try { values.push(parseNumericInput(part).value); }
    catch { return { values: [], invalid: true }; }
  }
  return { values: uniqueNumeric(values), invalid: false };
}

export function checkWorking(q, workingText) {
  const ans = q.answer;
  const meta = ans.stepMeta;
  let report;
  try { report = stepCheck(meta, workingText); }
  catch { return { correct: false, feedback: 'I couldn’t read that working — write one step per line.', stepReport: null, validLines: 0 }; }

  const okLines = report.lines.filter(l => l.status === 'ok');
  const parsed = report.lines.filter(l => l.status !== 'note');
  const minLines = ans.minLines || 2;
  if (parsed.length < minLines) {
    return { correct: false, feedback: `Show at least ${minLines} lines of mathematical working — I could only verify ${parsed.length}.`, stepReport: report, validLines: okLines.length };
  }
  if (report.firstBreak !== -1) {
    return { correct: false, feedback: diagnosisVerdict(report.diagnosis, report.firstBreak + 1), stepReport: report, validLines: okLines.length };
  }

  // A student who finishes by substituting their answer back has still finished
  // at the line before it: the check states no new result.
  const lastLine = [...report.lines].reverse().find(l => l.status === 'ok' && !l.check);
  if (!lastLine) return { correct: false, feedback: 'Finish with a line Pri can verify as the final result.', stepReport: report, validLines: 0 };

  let reached = false;
  try {
    const naturalList = readSolutionList(lastLine.text, meta);
    if (naturalList && !naturalList.invalid) {
      const wanted = uniqueNumeric(meta.solutions);
      reached = naturalList.values.length === wanted.length
        && naturalList.values.every(v => wanted.some(s => numsClose(v, s)));
    } else {
      const cleaned = normalize(lastLine.text).replace(/^∴\s*/, '');
      if (ans.final?.kind === 'expr') {
        const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
        reached = exprEquivalent(cand, ans.final.expr, { positiveOnly: ans.final.positiveOnly, isolatedDomain: true, strictDomain: ans.final.strictDomain === true });
      } else if (meta.kind === 'equation') {
        const re = new RegExp(`${meta.variable}\\s*=`);
        if (re.test(cleaned)) {
          const rhs = cleaned.split('=').pop();
          const vals = uniqueNumeric([parseNumericInput(rhs).value]);
          const wanted = uniqueNumeric(meta.solutions);
          reached = vals.length === wanted.length && vals.every(v => wanted.some(s => numsClose(v, s)));
        }
      } else {
        const cand = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
        reached = exprEquivalent(cand, meta.canonical, {});
      }
    }
  } catch { reached = false; }

  if (!reached) {
    return { correct: false, feedback: 'Your verified steps do not yet end with the complete result — state every solution or the requested simplified expression on the final line.', stepReport: report, validLines: okLines.length };
  }
  return { correct: true, stepReport: report, validLines: okLines.length };
}

// ── The zero-product branch ──────────────────────────────────────────────────
// "(x + 3)(x + 6) = 0 → x + 3 = 0, x + 6 = 0" is the method NCERT prints. Each
// branch is true of exactly one root by construction, so a checker that
// demands every authored solution satisfy every line calls the taught method a
// mistake and greys out everything after it. A line whose solutions are a
// non-empty proper subset of the authored ones is read as a branch once a
// trusted product-equals-zero line has been shown above it. Nothing is
// forgiven: if the working ends without the branches between them covering
// every root, the first branch becomes the lost-root break it always was.

/** Is this line a product (or a power) set equal to zero? */
function productEqualsZero(ast) {
  if (!ast || ast.t !== 'equation') return false;
  const isZero = (side) => {
    const n = unwrapGroup(side);
    return n && n.t === 'num' && Math.abs(n.v) < 1e-12;
  };
  const isProduct = (side) => {
    const n = unwrapGroup(side);
    if (!n) return false;
    if (n.t === 'neg') return isProduct(n.v);
    return n.t === 'bin' && (n.op === '*' || n.op === '^');
  };
  return (isZero(ast.r) && isProduct(ast.l)) || (isZero(ast.l) && isProduct(ast.r));
}

/** Which of the authored solutions satisfy this line. */
function solutionsSatisfying(ast, meta) {
  const wanted = uniqueNumeric(meta?.solutions);
  if (!ast || ast.t !== 'equation' || !meta?.variable || !wanted.length) return [];
  const held = [];
  for (const sol of wanted) {
    try {
      const env = { [meta.variable]: sol };
      const L = evaluate(ast.l, env);
      const R = evaluate(ast.r, env);
      if (Number.isFinite(L) && Number.isFinite(R)
          && Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6) held.push(sol);
    } catch { /* a branch Pri cannot evaluate is not a branch */ }
  }
  return held;
}

function stepCheckSingle(meta, workingText) {
  const rawLines = String(workingText || '').split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  let firstBreak = -1;
  let previousEquation = null;
  let previousEquationTrusted = false;
  let previousRelation = null;
  let previousRelationTrusted = false;
  let branchesOpen = false;
  const branchLines = [];

  rawLines.forEach((line, i) => {
    let status = 'note';
    let note;
    let lineDiagnosis = null;
    try {
      const listed = readSolutionList(line, meta);
      if (listed) {
        const wanted = uniqueNumeric(meta.solutions);
        if (listed.invalid || !listed.values.length) {
          status = 'note';
          note = 'Skipped — I couldn’t read the solution list safely.';
        } else {
          const extra = listed.values.find(v => !wanted.some(sol => numsClose(v, sol)));
          const missing = wanted.filter(sol => !listed.values.some(v => numsClose(v, sol)));
          if (extra !== undefined) {
            status = 'break';
            lineDiagnosis = extraListedRootDiagnosis(meta.variable, extra);
            note = lineDiagnosis.message;
          } else if (missing.length || listed.values.length !== wanted.length) {
            status = 'break';
            lineDiagnosis = lostRootDiagnosis(meta.variable, listed.values.join(' or '), wanted.length);
            note = lineDiagnosis.message;
          } else {
            status = 'ok';
          }
        }
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(status === 'ok' ? { coversAll: true } : {}), ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      const proseClean = String(line).trim()
        .replace(/^∴\s*/, '')
        .replace(/^(so|hence|then|therefore)\s+/i, '');

      // V2 inequalities are parsed before normalize(), because <, >, ≤ and ≥
      // are relations rather than arithmetic tokens in the expression engine.
      if (meta?.kind === 'inequality') {
        const assessed = assessRelationLine({
          text: proseClean,
          previous: previousRelation,
          previousTrusted: previousRelationTrusted,
          meta
        });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status !== 'break' && assessed.relation) {
          previousRelation = assessed.relation;
          previousRelationTrusted = !!assessed.trusted;
        }
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      if (meta?.kind === 'chained-inequality') {
        const assessed = assessRelationChainLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      if (meta?.kind === 'modulus-inequality') {
        const assessed = assessModulusInequalityLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      // A pair of linear equations (or any system with one authored solution):
      // every line is proved or disproved at the solution point.
      if (meta?.kind === 'system') {
        const assessed = assessSystemLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      // Authored derivative metadata lets Pri verify the mathematical operation,
      // not merely whether the student's final expression happens to match.
      if (meta?.kind === 'derivative') {
        const assessed = assessDerivativeLine({ text: proseClean, meta });
        status = assessed.status;
        note = assessed.note;
        lineDiagnosis = assessed.diagnosis || null;
        if (status === 'break' && firstBreak === -1) firstBreak = i;
        out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
        return;
      }

      const cleaned = normalize(proseClean);

      if (cleaned.includes('±') && meta.kind === 'equation' && cleaned.includes('=')) {
        const branchSols = (variant) => {
          try {
            const ast = parse(variant);
            if (ast.t !== 'equation') return null;
            return uniqueNumeric(meta.solutions).filter(sol => {
              const env = { [meta.variable]: sol };
              const L = evaluate(ast.l, env);
              const R = evaluate(ast.r, env);
              return Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= Math.max(1e-6, Math.abs(L), Math.abs(R)) * 1e-6;
            });
          } catch { return null; }
        };
        const sp = branchSols(cleaned.replace(/±/g, '+'));
        const sm = branchSols(cleaned.replace(/±/g, '-'));
        if (sp !== null && sm !== null) {
          const wanted = uniqueNumeric(meta.solutions);
          const covered = uniqueNumeric([...sp, ...sm]);
          const ok = sp.length > 0 && sm.length > 0 && covered.length === wanted.length && wanted.every(sol => covered.some(v => numsClose(v, sol)));
          status = ok ? 'ok' : 'break';
          note = ok ? undefined : 'The ± branches do not reproduce the complete solution set — check the signs or the missing branch.';
          if (!ok) lineDiagnosis = lostRootDiagnosis(meta.variable, covered.join(' or ') || 'this branch', wanted.length);
          if (status === 'break' && firstBreak === -1) firstBreak = i;
          // An accepted ± line has already been proved to reproduce every root.
          out.push({ text: line, status, note, ...(ok ? { coversAll: true } : {}), ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
          return;
        }
      }

      if (meta.kind === 'equation') {
        if (cleaned.includes('=')) {
          const ast = parse(cleaned);
          if (ast.t === 'equation') {
            const wantedRoots = uniqueNumeric(meta.solutions);
            const held = branchesOpen && wantedRoots.length > 1 ? solutionsSatisfying(ast, meta) : [];
            if (held.length && held.length < wantedRoots.length) {
              // One branch of a factorisation already shown. It is true of the
              // roots it names; whether the working keeps the rest is settled
              // once every line has been read.
              status = 'ok';
              branchLines.push({ index: i, covered: held });
              out.push({ text: line, status, branch: true });
              return;
            }
            // The common case is a reversible rearrangement of a line already
            // proved correct. Verify that cheaply before invoking counterevidence.
            if (previousEquationTrusted && previousEquation && sameEquationClaim(previousEquation, ast, meta.variable)) {
              status = 'ok';
              previousEquation = ast;
              previousEquationTrusted = true;
              if (productEqualsZero(ast)) branchesOpen = true;
            } else {
              const assessed = assessEquationLine({ ast, previousAst: previousEquation, previousTrusted: previousEquationTrusted, meta });
              status = assessed.status;
              note = assessed.note;
              lineDiagnosis = assessed.diagnosis || null;
              if (assessed.check) {
                // A check of the answer makes no claim to reason from.
                out.push({ text: line, status, note, check: true, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
                if (status === 'break' && firstBreak === -1) firstBreak = i;
                return;
              }
              if (status !== 'break') {
                previousEquation = ast;
                previousEquationTrusted = !!assessed.trusted;
                if (assessed.trusted && productEqualsZero(ast)) branchesOpen = true;
              }
            }
          }
        } else {
          const v = parseNumericInput(cleaned).value;
          const wanted = uniqueNumeric(meta.solutions);
          const near = wanted.some(sol => numsClose(v, sol));
          if (!near) {
            status = 'break';
            note = 'This value doesn’t satisfy the original equation.';
          } else if (wanted.length > 1) {
            status = 'break';
            lineDiagnosis = lostRootDiagnosis(meta.variable, v, wanted.length);
            note = lineDiagnosis.message;
          } else status = 'ok';
        }
      } else if (meta.kind === 'expression') {
        const candidate = cleaned.includes('=') ? cleaned.split('=').pop() : cleaned;
        const same = exprEquivalent(candidate, meta.canonical, { positiveOnly: meta.positiveOnly });
        status = same ? 'ok' : 'break';
        if (!same) note = 'This line is no longer equivalent to the expression you started with — the slip is here.';
      }
    } catch {
      status = 'note';
      note = 'Skipped — I couldn’t parse this line as maths.';
    }

    if (status === 'break' && firstBreak === -1) firstBreak = i;
    out.push({ text: line, status, note, ...(lineDiagnosis ? { diagnosis: lineDiagnosis } : {}) });
  });

  // Branches were allowed on the promise that the working keeps every root.
  // If it does not, the first branch is the line where the root was lost.
  if (branchLines.length) {
    const wanted = uniqueNumeric(meta.solutions);
    const covered = uniqueNumeric(branchLines.flatMap(b => b.covered));
    const listedInFull = out.some(l => l.status === 'ok' && l.coversAll);
    const complete = covered.length === wanted.length && wanted.every(sol => covered.some(v => numsClose(v, sol)));
    if (!listedInFull && !complete) {
      const { index } = branchLines[0];
      const diagnosis = lostRootDiagnosis(meta.variable, covered.join(' or ') || 'this branch', wanted.length);
      out[index] = { text: out[index].text, status: 'break', note: diagnosis.message, diagnosis };
      firstBreak = firstBreak === -1 ? index : Math.min(firstBreak, index);
    }
  }

  if (firstBreak === -1) return { lines: out, firstBreak, diagnosis: null };
  for (let i = firstBreak + 1; i < out.length; i++) {
    if (out[i].status === 'break' || out[i].branch) {
      out[i].status = 'note';
      out[i].note = 'Follows from the earlier slip.';
      delete out[i].diagnosis;
    }
  }

  let prevText = null;
  for (let i = firstBreak - 1; i >= 0; i--) {
    if (out[i].status === 'ok') { prevText = out[i].text; break; }
  }

  let diagnosis = out[firstBreak]?.diagnosis || null;
  if (!diagnosis || diagnosis.code === 'lost-solution' || diagnosis.code === 'system-line-false') {
    try {
      const specific = diagnoseStep({ prevText, brokenText: out[firstBreak].text, meta });
      if (specific) diagnosis = specific;
    } catch { /* remain conservative */ }
  }
  if (diagnosis) {
    diagnosis = withConfidence(diagnosis);
    out[firstBreak].diagnosis = diagnosis;
    out[firstBreak].note = diagnosis.message;
  }
  return { lines: out, firstBreak, diagnosis };
}


// ── Pri Reason V3: authored multi-operation proof plans ─────────────────────
// A plan is a list of already-safe verifiers with prerequisites between them.
// A stage cannot be credited before its prerequisites: a later-stage truth
// shown before them is recognised only as a note. This preserves the V1/V2
// prove/disprove/abstain contract while allowing a real solution to move from
// differentiation into solving and substitution.
//
// Stage order (marking-10). By default every stage requires the one before it,
// which is the authored order. A plan may declare that stages are independent
// so any valid order of working is accepted:
//
//   { kind: 'plan', anyOrder: true, stages: [...] }   every stage independent
//   { kind: 'evaluation', ..., independent: true }     this stage needs nothing
//   { kind: 'equation', ..., requires: [0, 2] }        explicit prerequisites
//
// The rule: a line earns credit for a stage only when every stage that stage
// requires has already been verified in the working above it. Stages with no
// requirement between them may appear in either order (solve for x before y or
// y before x; compute the three minors of a determinant in any order). A stage
// that names a prerequisite still cannot be skipped — a substitution stage
// that requires the derivative stage is a note, never credit, until the
// derivative has been shown. Nothing here makes a wrong line right: a line
// that disproves an available stage is a break wherever it appears.

function planClause(line) {
  return String(line || '').split(/(?:=>|⇒|→)/).pop().trim();
}

function derivativeSourceLine(stage, line) {
  if (stage?.kind !== 'derivative' || !stage.source) return false;
  const raw = String(line || '').trim().replace(/[−–—]/g, '-').replace(/^∴\s*/, '');
  let candidate = raw;
  const eq = raw.indexOf('=');
  if (eq >= 0) {
    const lhs = raw.slice(0, eq).trim();
    if (!/^(?:y|f\s*\(\s*x\s*\))$/i.test(lhs)) return false;
    candidate = raw.slice(eq + 1).trim();
  }
  try {
    const a = parse(normalize(candidate));
    const b = parse(normalize(stage.source));
    return a.t !== 'equation' && b.t !== 'equation' && sameExpressionClaim(a, b);
  } catch { return false; }
}

function assessPlanStage(stage, line) {
  if (!stage || typeof stage !== 'object') {
    return { status: 'note', note: 'This proof stage is not configured safely.', trusted: false };
  }
  if (stage.kind === 'evaluation') return assessEvaluationLine({ text: line, meta: stage });
  if (stage.kind === 'point') return assessPointLine({ text: line, meta: stage });
  if (stage.kind === 'chained-inequality') return assessRelationChainLine({ text: line, meta: stage });
  if (stage.kind === 'modulus-inequality') return assessModulusInequalityLine({ text: line, meta: stage });
  if (derivativeSourceLine(stage, line)) {
    return { status: 'note', trusted: false, note: 'Starting function recognised — differentiate it on the next line.' };
  }

  // For an explicit equation inside a proof plan, prefer the direct exact
  // equation proof before the legacy single-line facade. The facade may replace
  // a mathematically certified lost-solution diagnosis with a lower-confidence
  // pedagogical heuristic; the plan must retain the proof-grade diagnosis.
  if (stage.kind === 'equation') {
    const clause = planClause(line)
      .replace(/^∴\s*/, '')
      .replace(/^(so|hence|then|therefore)\s+/i, '');
    try {
      const ast = parse(normalize(clause));
      if (ast.t === 'equation') {
        const exact = assessEquationLine({ ast, meta: stage });
        if (exact.status === 'ok' || exact.status === 'break') return exact;
      }
    } catch { /* fall back to the stable facade */ }
  }

  const checked = stepCheckSingle(stage, stage.kind === 'equation' ? planClause(line) : line);
  const item = checked.lines?.[0];
  if (!item) return { status: 'note', trusted: false, note: 'Pri could not verify this proof stage safely.' };
  return {
    status: item.status,
    note: item.note,
    diagnosis: item.diagnosis || checked.diagnosis || null,
    trusted: item.status === 'ok'
  };
}

/** The prerequisite stages of each stage — the authored order unless the plan says otherwise. */
export function planRequirements(meta) {
  const stages = Array.isArray(meta?.stages) ? meta.stages.filter(Boolean) : [];
  return stages.map((stage, i) => {
    if (Array.isArray(stage?.requires)) {
      return [...new Set(stage.requires.filter(r => Number.isInteger(r) && r >= 0 && r < stages.length && r !== i))];
    }
    if (stage?.independent === true || meta?.anyOrder === true) return [];
    return i === 0 ? [] : [i - 1];
  });
}

function stepCheckPlan(meta, workingText) {
  const rawLines = String(workingText || '').split('\n').map(line => line.trim()).filter(Boolean);
  const stages = Array.isArray(meta?.stages) ? meta.stages.filter(Boolean) : [];
  if (!stages.length) {
    return {
      lines: rawLines.map(text => ({ text, status: 'note', note: 'This proof plan has no authored stages.' })),
      firstBreak: -1, diagnosis: null, completedStages: 0, totalStages: 0
    };
  }

  const requires = planRequirements(meta);
  const out = [];
  const completed = new Set();
  let active = 0;
  let firstBreak = -1;
  let diagnosis = null;

  const ready = idx => requires[idx].every(r => completed.has(r));

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (firstBreak !== -1) {
      out.push({ text: line, status: 'note', note: 'Follows from the earlier slip.', stage: active });
      continue;
    }

    // Every verdict on this line is drawn once and kept.
    const verdicts = new Map();
    const assess = idx => {
      if (!verdicts.has(idx)) verdicts.set(idx, assessPlanStage(stages[idx], line));
      return verdicts.get(idx);
    };
    const open = [];        // not yet verified, prerequisites verified
    const blocked = [];     // not yet verified, a prerequisite still missing
    for (let idx = 0; idx < stages.length; idx++) {
      if (completed.has(idx)) continue;
      (ready(idx) ? open : blocked).push(idx);
    }
    const done = [...completed].sort((a, b) => b - a);   // most recent first

    // 1. A line that proves an available stage completes it.
    const proved = open.find(idx => assess(idx).status === 'ok');
    if (proved !== undefined) {
      completed.add(proved);
      active = proved;
      out.push({ text: line, status: 'ok', stage: proved });
      continue;
    }

    // 2. Do not falsely call a correct later-stage result an error merely
    //    because its prerequisite working was omitted. It still cannot earn
    //    credit, so it receives a note.
    const later = blocked.find(idx => assess(idx).status === 'ok');
    if (later !== undefined) {
      out.push({
        text: line, status: 'note', stage: active,
        note: 'This matches a later result, but Pri has not yet verified the prerequisite stage, so it cannot receive step credit.'
      });
      continue;
    }

    // 3. A line that disproves an available stage is the break.
    const broken = open.find(idx => assess(idx).status === 'break');
    if (broken !== undefined) {
      const verdict = assess(broken);
      active = broken;
      firstBreak = i;
      diagnosis = verdict.diagnosis || null;
      out.push({ text: line, status: 'break', stage: broken, note: verdict.note, ...(diagnosis ? { diagnosis } : {}) });
      continue;
    }

    // 4. Another equivalent form within a stage already verified (for
    //    example the source equation and then x = 2) keeps that stage's credit.
    const again = done.find(idx => assess(idx).status === 'ok');
    if (again !== undefined) {
      out.push({ text: line, status: 'ok', stage: again });
      continue;
    }

    // 5. Equation solvers have strong exact solution-set diagnostics. A wrong
    //    root written after the equation stage was verified is a real break,
    //    not an unsupported next operation.
    const wrongRoot = done.find(idx => stages[idx].kind === 'equation' && assess(idx).status === 'break');
    if (wrongRoot !== undefined) {
      const verdict = assess(wrongRoot);
      firstBreak = i;
      diagnosis = verdict.diagnosis || null;
      out.push({ text: line, status: 'break', stage: wrongRoot, note: verdict.note, ...(diagnosis ? { diagnosis } : {}) });
      continue;
    }

    // 6. Abstain, saying why the nearest stage could not use the line.
    const reason = [...open, ...done].map(idx => assess(idx).note).find(Boolean);
    out.push({
      text: line, status: 'note', stage: active,
      note: reason || 'Pri could not prove which authored operation this line belongs to.'
    });
  }

  if (diagnosis) {
    diagnosis = withConfidence(diagnosis);
    out[firstBreak].diagnosis = diagnosis;
  }
  return {
    lines: out,
    firstBreak,
    diagnosis,
    completedStages: completed.size,
    totalStages: stages.length
  };
}

export function stepCheck(meta, workingText) {
  if (meta?.kind === 'plan') return stepCheckPlan(meta, workingText);
  return stepCheckSingle(meta, workingText);
}

// ── Method marks (marking-11) ────────────────────────────────────────────────
// One rule for Practice and for exams: a mark for each verified line that
// moves the solution on, capped one below the question's marks (the final mark
// is for the answer). A line that restates the question — the equation or
// expression the prompt gave — earns nothing, and a step written twice is
// counted once.

const TEX_MATH = /\$([^$]+)\$/g;

/** A KaTeX span reduced to what the expression engine reads; null when it cannot be. */
function plainTex(tex) {
  let s = String(tex || '');
  for (let guard = 0; guard < 6 && /\\d?frac/.test(s); guard++) {
    s = s.replace(/\\d?frac\s*(\{[^{}]*\}|[0-9a-zA-Z])\s*(\{[^{}]*\}|[0-9a-zA-Z])/g, (_, a, b) =>
      `((${a.replace(/^\{|\}$/g, '')})/(${b.replace(/^\{|\}$/g, '')}))`);
  }
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)')
    .replace(/\\(times|cdot)/g, '*').replace(/\\div/g, '/')
    .replace(/\\le(q|qslant)?\b/g, '<=').replace(/\\ge(q|qslant)?\b/g, '>=')
    .replace(/\\(left|right|,|;|!|quad|qquad|displaystyle)/g, '')
    .replace(/\\pi/g, 'pi')
    .replace(/[{}]/g, '');
  if (/\\[a-zA-Z]+/.test(s)) return null;   // a command the engine has no reading of
  return s.trim();
}

function readClaim(text) {
  const src = String(text ?? '').trim()
    .replace(/[−–—]/g, '-')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore)\s+/i, '');
  if (!src) return null;
  const relation = parseRelation(src);
  if (relation) return { kind: 'relation', relation };
  try {
    const ast = parse(normalize(src));
    return ast.t === 'equation' ? { kind: 'equation', ast } : { kind: 'expression', ast };
  } catch { return null; }
}

// ── What counts as restating the question ────────────────────────────────────
// A line restates the question when it is that line written again: the same
// symbols, allowing spacing, unicode notation, an explicit ×, the order of a
// sum or a product, and the two sides of an equation swapped.
//
// It is NOT enough for the line to be logically equivalent to the question.
// Every valid rearrangement of an equation is equivalent to it, so defining
// restatement as equivalence made every correct step a copy of the question:
// "Solve 2x − 7 = −11" with working 2x − 7 = −11 / 2x = −4 / x = −2 earned no
// method marks at all, while the exam path — which counts verified lines —
// awarded two. Restatement is a syntactic test, and only a syntactic one.

function unwrapGroup(node) {
  let out = node;
  while (out && out.t === 'group') out = out.v;
  return out;
}

/** Flatten one commutative operator's chain, rewriting a − b as a + (−b). */
function commutativeParts(node, op, acc = []) {
  const n = unwrapGroup(node);
  if (n && n.t === 'bin' && (n.op === op || (op === '+' && n.op === '-'))) {
    commutativeParts(n.l, op, acc);
    if (n.op === '-') acc.push({ t: 'neg', v: n.r });
    else commutativeParts(n.r, op, acc);
    return acc;
  }
  acc.push(n);
  return acc;
}

/** A canonical rendering of what was written, not of what it means. */
function writtenKey(node) {
  const n = unwrapGroup(node);
  if (!n || typeof n !== 'object') return '?';
  switch (n.t) {
    case 'num': return `#${Number(n.v)}`;
    case 'var': return `v${n.v}`;
    case 'const': return `k${n.v}`;
    case 'neg': {
      const inner = unwrapGroup(n.v);
      if (inner && inner.t === 'num') return `#${-Number(inner.v)}`;
      return `-(${writtenKey(n.v)})`;
    }
    case 'fact': return `!(${writtenKey(n.v)})`;
    case 'call': return `${n.fn}(${(Array.isArray(n.args) ? n.args : [n.arg]).map(writtenKey).join(',')})`;
    case 'bin': {
      if (n.op === '+' || n.op === '-' || n.op === '*') {
        const op = n.op === '-' ? '+' : n.op;
        return `${op}(${commutativeParts(n, op).map(writtenKey).sort().join(',')})`;
      }
      return `${n.op}(${writtenKey(n.l)},${writtenKey(n.r)})`;
    }
    default: return '?';
  }
}

const MIRRORED_RELATION = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

/** Is this line the same line, written again? */
function sameWrittenClaim(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  try {
    if (a.kind === 'relation') {
      const [al, ar] = [writtenKey(a.relation.l), writtenKey(a.relation.r)];
      const [bl, br] = [writtenKey(b.relation.l), writtenKey(b.relation.r)];
      if (a.relation.op === b.relation.op) return al === bl && ar === br;
      return MIRRORED_RELATION[a.relation.op] === b.relation.op && al === br && ar === bl;
    }
    if (a.kind === 'equation') {
      const [al, ar] = [writtenKey(a.ast.l), writtenKey(a.ast.r)];
      const [bl, br] = [writtenKey(b.ast.l), writtenKey(b.ast.r)];
      return (al === bl && ar === br) || (al === br && ar === bl);
    }
    if (a.kind === 'text') return String(a.text).trim() === String(b.text).trim();
    return writtenKey(a.ast) === writtenKey(b.ast);
  } catch { return false; }
}

/** The claims a question hands the student: authored sources and the maths spans of the prompt. */
export function questionClaims(meta, prompt = '') {
  const texts = [];
  if (meta && typeof meta === 'object') {
    if (typeof meta.source === 'string') texts.push(meta.source);
    if (Array.isArray(meta.sources)) texts.push(...meta.sources.filter(s => typeof s === 'string'));
    if (Array.isArray(meta.stages)) {
      for (const stage of meta.stages) {
        if (stage && typeof stage.source === 'string' && stage.kind !== 'derivative' && stage.kind !== 'evaluation') texts.push(stage.source);
      }
    }
  }
  for (const m of String(prompt || '').matchAll(TEX_MATH)) {
    const plain = plainTex(m[1]);
    if (plain && /[=<>≤≥]/.test(plain)) texts.push(plain);
  }
  return texts.map(readClaim).filter(Boolean);
}

/** Does this line of working merely restate the question? */
export function restatesQuestion(line, meta, prompt = '') {
  const claim = readClaim(line);
  if (!claim) return false;
  return questionClaims(meta, prompt).some(c => sameWrittenClaim(claim, c));
}

/**
 * Normalise ONLY arithmetic identities, not full algebraic equivalence.
 *
 * Solving an equation normally preserves its solution set. Treating every
 * equivalent equation as a duplicate would erase legitimate method marks for
 * subtraction, distribution, fraction clearing and alternate solution paths.
 * These four identities do not change the written mathematical state at all:
 * +0, -0, *1 and /1. Keep all other transformations visible to the rubric.
 */
function withoutNeutralArithmetic(node) {
  const n = unwrapGroup(node);
  if (!n || typeof n !== 'object') return n;
  if (n.t === 'neg') return { ...n, v: withoutNeutralArithmetic(n.v) };
  if (n.t !== 'bin') return n;
  const l = withoutNeutralArithmetic(n.l);
  const r = withoutNeutralArithmetic(n.r);
  const isNumber = (part, value) => {
    const p = unwrapGroup(part);
    if (p?.t === 'num') return Number(p.v) === value;
    if (p?.t === 'neg') {
      const v = unwrapGroup(p.v);
      return v?.t === 'num' && -Number(v.v) === value;
    }
    return false;
  };
  if (n.op === '+' && isNumber(r, 0)) return l;
  if (n.op === '+' && isNumber(l, 0)) return r;
  if (n.op === '-' && isNumber(r, 0)) return l;
  if (n.op === '*' && isNumber(r, 1)) return l;
  if (n.op === '*' && isNumber(l, 1)) return r;
  if (n.op === '/' && isNumber(r, 1)) return l;
  return cancelInsertedPairs({ ...n, l, r });
}

const literalValue = node => {
  const p = unwrapGroup(node);
  if (p?.t === 'num') return Number(p.v);
  if (p?.t === 'neg') {
    const v = unwrapGroup(p.v);
    if (v?.t === 'num') return -Number(v.v);
  }
  return null;
};

/**
 * `+1-1` and `*2/2` are the same non-step as `+0` and `*1`, spelt with two
 * literals instead of one. Remove a numeric literal only together with its own
 * exact inverse inside the same sum or the same product; every other term and
 * factor stays exactly as written, so collecting, expanding and evaluating
 * remain visible to the rubric.
 */
function cancelInsertedPairs(node) {
  if (node.op === '+' || node.op === '-') {
    const terms = [];
    const walk = (part, sign) => {
      const p = unwrapGroup(part);
      if (p?.t === 'bin' && (p.op === '+' || p.op === '-')) {
        walk(p.l, sign); walk(p.r, p.op === '-' ? -sign : sign);
      } else terms.push({ sign, node: p });
    };
    walk(node, 1);
    let cancelled = false;
    for (let i = 0; i < terms.length; i++) {
      const a = terms[i] && literalValue(terms[i].node);
      if (a === null || a === undefined || a === 0) continue;
      for (let j = i + 1; j < terms.length; j++) {
        const b = terms[j] && literalValue(terms[j].node);
        if (b === null || b === undefined) continue;
        if (terms[i].sign * a + terms[j].sign * b === 0) {
          terms[i] = terms[j] = null; cancelled = true; break;
        }
      }
    }
    if (!cancelled) return node;
    const kept = terms.filter(Boolean);
    if (!kept.length) return { t: 'num', v: 0 };
    let acc = kept[0].sign < 0 ? { t: 'neg', v: kept[0].node } : kept[0].node;
    for (const term of kept.slice(1)) acc = { t: 'bin', op: term.sign < 0 ? '-' : '+', l: acc, r: term.node };
    return acc;
  }
  if (node.op === '*' || node.op === '/') {
    const factors = [];
    const walk = (part, power) => {
      const p = unwrapGroup(part);
      if (p?.t === 'bin' && (p.op === '*' || p.op === '/')) {
        walk(p.l, power); walk(p.r, p.op === '/' ? -power : power);
      } else factors.push({ power, node: p });
    };
    walk(node, 1);
    let cancelled = false;
    for (let i = 0; i < factors.length; i++) {
      const a = factors[i] && literalValue(factors[i].node);
      if (a === null || a === undefined || a === 0 || a === 1) continue;
      for (let j = i + 1; j < factors.length; j++) {
        const b = factors[j] && literalValue(factors[j].node);
        if (b === a && factors[j].power === -factors[i].power) {
          factors[i] = factors[j] = null; cancelled = true; break;
        }
      }
    }
    if (!cancelled) return node;
    const top = factors.filter(f => f && f.power > 0), bottom = factors.filter(f => f && f.power < 0);
    let acc = top.length ? top[0].node : { t: 'num', v: 1 };
    for (const f of top.slice(1)) acc = { t: 'bin', op: '*', l: acc, r: f.node };
    for (const f of bottom) acc = { t: 'bin', op: '/', l: acc, r: f.node };
    return acc;
  }
  return node;
}

function methodProgressDuplicate(a, b) {
  if (a?.kind === 'equation' && b?.kind === 'equation') {
    const identityFree = c => ({
      ...c, ast: { ...c.ast,
        l: withoutNeutralArithmetic(c.ast.l),
        r: withoutNeutralArithmetic(c.ast.r) }
    });
    return sameWrittenClaim(identityFree(a), identityFree(b));
  }
  return sameWrittenClaim(a, b);
}

/** An isolated final value is an answer claim, not a new method step. */
function isolatedFinalAnswer(claim, meta) {
  if (meta?.kind !== 'equation' || claim?.kind !== 'equation') return false;
  const solutions = uniqueNumeric(meta.solutions);
  if (solutions.length !== 1) return false;
  const l = withoutNeutralArithmetic(claim.ast.l);
  const r = withoutNeutralArithmetic(claim.ast.r);
  const isVariable = node => unwrapGroup(node)?.t === 'var'
    && unwrapGroup(node).v === meta.variable;
  const other = isVariable(l) ? r : isVariable(r) ? l : null;
  if (!other) return false;
  try {
    const value = evaluate(other, {});
    return Number.isFinite(value) && numsClose(value, solutions[0]);
  } catch { return false; }
}

/**
 * A single straightforward linear operation can transform a *shown* authored
 * equation directly into its root, without an intermediate line:
 *   2t = t - 3 -> t = -3          (subtract t)
 *   x + 2 = 4 -> x = 2           (subtract 2)
 *   3x = 6 -> x = 2              (divide by 3)
 * This is ONE verified method step, not an extra award for saying the answer.
 * Arbitrary solutions, e.g. 6m+15=7m+29 -> m=-14, demand more than one
 * operation and must show genuine intermediate progress for method credit.
 *
 * The calculation only recognises exact affine arithmetic from a single
 * variable; unsupported/nonlinear/domain-sensitive equations fail closed.
 */
function oneStepLinearRoot(meta, originals) {
  if (meta?.kind !== 'equation' || !meta.variable || uniqueNumeric(meta.solutions).length !== 1) return false;
  const linear = node => affineSide(node, meta.variable);
  for (const source of originals) {
    if (source?.kind !== 'equation') continue;
    const l = linear(source.ast.l), r = linear(source.ast.r);
    if (!l || !r || ![l.a,l.b,r.a,r.b].every(Number.isFinite)) continue;
    const a = l.a - r.a, b = r.b - l.b;
    if (!a || !numsClose(b / a, Number(meta.solutions[0]))) continue;
    // One step: remove a variable term when the other side's coefficient
    // becomes 1 and one side has no constant to also collect.
    const subtractVariable = Math.abs(a) === 1 && (l.b === 0 || r.b === 0);
    // Or operate once on an already isolated single variable: subtract a
    // constant, or divide a single coefficient (not BOTH).
    const singleSide = (l.a === 0) !== (r.a === 0);
    const singleOperation = singleSide &&
      (Math.abs(a) === 1 || (l.b === 0 && r.b === 0));
    if (subtractVariable || singleOperation) return true;
  }
  return false;
}

/** `a·v + b` for one side of an equation, or null when the side is not affine in v. */
function affineSide(node, variable) {
  const n = unwrapGroup(node);
  if (!n) return null;
  if (n.t === 'num') return { a: 0, b: Number(n.v) };
  if (n.t === 'var') return n.v === variable ? { a: 1, b: 0 } : null;
  if (n.t === 'neg') {
    const v = affineSide(n.v, variable);
    return v ? { a: -v.a, b: -v.b } : null;
  }
  if (n.t !== 'bin') return null;
  const l = affineSide(n.l, variable), r = affineSide(n.r, variable);
  if (!l || !r) return null;
  if (n.op === '+') return { a: l.a + r.a, b: l.b + r.b };
  if (n.op === '-') return { a: l.a - r.a, b: l.b - r.b };
  if (n.op === '*') {
    if (l.a && r.a) return null;
    return { a: l.a * r.b + l.b * r.a, b: l.b * r.b };
  }
  if (n.op === '/' && r.a === 0 && r.b !== 0) return { a: l.a / r.b, b: l.b / r.b };
  return null;
}

/**
 * Where a written linear equation stands on the way to `v = root`.
 *
 * Every equivalent equation has the same solution set, so equivalence cannot
 * tell a step from a restatement. What a step changes is how much isolating
 * is still to do. Each side is read as written (a·v + b, never moved across
 * the equals sign), and the state is ordered by:
 *   left  — isolating moves still owed: the variable's coefficient is not 1,
 *           a constant still sits beside the variable, the variable still
 *           appears on the other side;
 *   fractional — coefficients that are not whole numbers (clearing them is a step);
 *   written — undistributed brackets, then additive terms, then symbols, which
 *           orders two lines whose sides are already the same (expanding,
 *           collecting and evaluating are steps; padding is not).
 * Adding the same number to both sides, doubling both sides, or inserting
 * `+1-1` / `*2/2` leaves all of these where they were.
 */
function linearState(claim, variable) {
  if (claim?.kind !== 'equation' || !variable) return null;
  const l = affineSide(claim.ast.l, variable), r = affineSide(claim.ast.r, variable);
  if (!l || !r || ![l.a, l.b, r.a, r.b].every(Number.isFinite)) return null;
  if (numsClose(l.a, r.a)) return null;
  const owed = (own, other) => (numsClose(own.a, 1) ? 0 : 1) + (numsClose(own.b, 0) ? 0 : 1) + (numsClose(other.a, 0) ? 0 : 1);
  const whole = x => numsClose(x, Math.round(x));
  let brackets = 0, terms = 0, symbols = 0;
  const walk = node => {
    const n = unwrapGroup(node);
    if (!n || typeof n !== 'object') return;
    symbols++;
    if (n.t === 'neg') return walk(n.v);
    if (n.t !== 'bin') return;
    if (n.op === '+' || n.op === '-') terms++;
    if (n.op === '*' || n.op === '/') {
      for (const side of [n.l, n.r]) {
        const inner = unwrapGroup(side);
        if (inner?.t === 'bin' && (inner.op === '+' || inner.op === '-')) brackets++;
      }
    }
    walk(n.l); walk(n.r);
  };
  walk(claim.ast.l); walk(claim.ast.r);
  return {
    sides: [l.a, l.b, r.a, r.b],
    left: Math.min(owed(l, r), owed(r, l)),
    fractional: [l.a, l.b, r.a, r.b].filter(x => !whole(x)).length,
    written: [brackets, terms, symbols]
  };
}

/** Is linear state `f` strictly further on than `g`? */
function linearStateAdvances(f, g) {
  if (f.left < g.left) return true;
  if (f.left > g.left) return false;
  if (f.fractional < g.fractional) return true;
  const same = (x, y) => x.every((v, i) => numsClose(v, y[i]));
  const [a, b, c, d] = g.sides;
  if (!same(f.sides, g.sides) && !same(f.sides, [c, d, a, b])) return false;
  for (let i = 0; i < f.written.length; i++) {
    if (f.written[i] !== g.written[i]) return f.written[i] < g.written[i];
  }
  return false;
}

/**
 * Method marks for a wrong final answer, from the student's working.
 * Returns null when nothing in the working could be verified; otherwise
 * { okLines, progressLines, awarded, note, report }.
 */
export function methodMarks({ meta, working, marks, prompt = '', report = null } = {}) {
  if (!meta || working == null || !String(working).trim()) return null;
  let rep = report;
  if (!rep) {
    try { rep = stepCheck(meta, String(working)); } catch { return null; }
  }
  const allLines = rep?.lines || [];
  const okLines = allLines.filter(l => l.status === 'ok');
  if (!okLines.length) return null;
  const given = questionClaims(meta, prompt);
  const counted = [];
  let restated = 0;
  let shownAuthoredEquation = false;
  const total = Math.max(1, Number(marks) || 1);
  const cap = Math.max(0, total - 1);
  // The per-line mark vector: one entry per written line, in order, saying
  // what that line earned and why. Its marks always sum to `awarded`, so a
  // multi-line answer can show the examiner's tick (or its absence) per line.
  const vector = allLines.map((l, index) => {
    const row = { index, text: String(l.text ?? ''), status: l.status, mark: 0, reason: l.status === 'ok' ? 'progress' : l.status };
    if (l.status !== 'ok') return row;
    const claim = readClaim(l.text);
    if (claim && given.some(c => methodProgressDuplicate(claim, c))) {
      restated++;
      if (claim.kind === 'equation') shownAuthoredEquation = true;
      row.reason = 'restated'; return row;
    }
    // A final answer in a different spelling is still the same final answer,
    // not two independently demonstrated method criteria. This applies only
    // to single-root equations; branch and multi-root work retain their
    // separately authored verification.
    if (claim && isolatedFinalAnswer(claim, meta)) {
      // An unsupported statement of the final answer is not a derivation.
      // After a genuine preceding method step, however, the first isolated
      // root can complete an authored step criterion exactly once. Retelling
      // that same root as +0, *1 or another arithmetic spelling earns nothing.
      if (!counted.length && !(shownAuthoredEquation && oneStepLinearRoot(meta, given))) {
        row.reason = 'final-answer'; return row;
      }
      if (counted.length >= cap) { row.reason = 'cap'; return row; }
      if (counted.some(c => isolatedFinalAnswer(c, meta))) { row.reason = 'repeat'; return row; }
    }
    if (claim && counted.some(c => methodProgressDuplicate(claim, c))) { row.reason = 'repeat'; return row; }
    // A linear equation line earns a mark only when it stands further on than
    // the question and every line already credited. Equations that are not
    // linear in the unknown keep the written-duplicate rule above.
    const state = meta.kind === 'equation' ? linearState(claim, meta.variable) : null;
    if (state) {
      const before = [...given, ...counted].map(c => linearState(c, meta.variable)).filter(Boolean);
      if (before.some(g => !linearStateAdvances(state, g))) { row.reason = 'repeat'; return row; }
    }
    counted.push(claim || { kind: 'text', text: String(l.text).trim() });
    if (counted.length <= cap) row.mark = 1; else row.reason = 'cap';
    return row;
  });
  const progress = counted.length;
  const awarded = Math.min(cap, progress);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const note = awarded > 0
    ? `${plural(awarded, 'mark')} for correct working — the final answer was wrong, but ${plural(progress, 'line')} of your working moved the solution on.`
    : restated
      ? 'No method marks: the lines that check out only restate the question. Marks come from steps that move the solution on.'
      : 'No method marks: correct working earns marks only when it moves the solution on, and this question carries a single mark for the answer.';
  return { okLines: okLines.length, progressLines: progress, restatedLines: restated, awarded, note, lines: vector, report: rep };
}
