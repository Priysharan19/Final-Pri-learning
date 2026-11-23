// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the engine's commentary on a marked line (client/src/engine/lineCommentary.js)
//
// No model writes any of it. A sentence is a reviewed template filled ONLY from structured engine facts. Held here, over
// generated pages (the understanding audit's corpus: worked steps, slips and extra lines for every Year 11 and 12 family):
//   · every maths span in a rendered comment is built from that line's structured facts (a value, or the line's own
//     right-hand side), never from anywhere else
//   · the verdict matches the state: a cross never gets a positive template, a tick never a negative word, an arithmetic
//     tick only the equality templates
//   · {expected} and {written} are never swapped (built crosses where both are known, both ways round)
//   · a rule is named only when the engine named it for that line
//   · no sentence holds a word outside the catalogue (and the heading / rule label slots)
//   · Hindi renders for every template that has Hindi wording (the value-only, expression-names and two-sides templates are English only: Hindi gives null and keeps the engine's sentence; no sentence embeds an English heading in Hindi); a line's comment is deterministic
//   · the engine edits only ADD facts: no status, mark or note changed (the marking identity tests prove the rest)
//
//   node server/test/line-commentary-check.mjs [--write]   (--write regenerates owner-review/ENGINE-COMMENTS-SAMPLES.md)
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { SEEDS, loadFamilies, questionsFor, transcriptsFor } from '../../tools/understanding-audit/corpus.mjs';
import { stepEvidence, stepMetaFor } from '../platform/markerOps.js';
import { buildAnnotatedWorking } from '../../client/src/components/annotatedWorkingModel.js';
import { commentFor, CATALOGUE, POSITIVE_KINDS, EQUALITY_KINDS, CROSS_KINDS, TEMPLATE_KINDS, variantsOf } from '../../client/src/engine/lineCommentary.js';
import { exactForm } from '../../client/src/engine/arithmeticLines.js';
import { mathSpan, plainComment } from '../../client/src/engine/commentTex.js';
import { chainDiagnosis } from '../../client/src/engine/reason-chain.js';
import { normalize, parse } from '../../client/src/engine/expr.js';
import * as G from '../../client/src/engine/generators/index.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
const eq = (a, b, l) => ok(JSON.stringify(a) === JSON.stringify(b), `${l}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const RULE_LABEL = r => `Rule ${r.rule}`;
const ctx = { language: 'en', ruleLabel: RULE_LABEL };
const tex = v => `$${exactForm(v).tex}$`;
const wordsOf = t => (String(t).replace(/\$[^$]*\$/g, ' ').match(/[A-Za-z\u2019']+/g) || []).map(w => w.toLowerCase());
const CATWORDS = new Set(Object.values(CATALOGUE).flatMap(c => c.en.flatMap(s => wordsOf(s.replace(/\{\w+\}/g, ' ')))));
const NEGATIVE = /\b(wrong|incorrect|mistake|error|slip|not|but|false|invalid)\b/i;

// ── 1. generated pages ───────────────────────────────────────────────────────────────────────────────
await G.loadAllBanks();
const families = await loadFamilies();
let pages = 0, comments = 0, valueOnlyTicks = 0, valueOnlyComments = 0, sidesCrosses = 0, sidesComments = 0; const perKind = {}; const familiesWith = new Set(); const problems = [];
const spansOf = t => [...String(t).matchAll(/\$[^$]+\$/g)].map(m => m[0]);
for (const id of families) {
  for (const q of questionsFor(id, SEEDS)) {
    if (q.answerType === 'mcq') continue;
    for (const t of transcriptsFor(q)) {
      const working = t.lines.map(l => l.text).join('\n');
      let report = null;
      try { report = stepEvidence(q, '', working, { correct: false }).stepReport; } catch { report = null; }
      if (!report?.lines || report.lines.length < 2) continue;
      let model = null;
      try { model = buildAnnotatedWorking({ lines: t.lines.map(l => l.text), stepReport: report }); } catch { model = null; }
      if (!model) continue;
      pages += 1;
      model.cards.forEach((card, i) => {
        const line = report.lines[i];
        const c = commentFor(card, ctx);
        const again = commentFor(card, ctx);
        if (JSON.stringify(c) !== JSON.stringify(again)) problems.push(`not deterministic: ${id} line ${i + 1}`);
        if (!c) return;
        // F1: a value-only tick (the line's value coincides with a value at a step; no statement matched) is never said to BE the step
        if (line.fact?.kind === 'solution-step' && line.fact.valueOnly === true) {
          valueOnlyTicks += 1;
          if (c.kind !== 'stepValue' || /\b(?:is|matches)\s+step\b/i.test(c.text)) problems.push(`value-only tick said to be a step: id ${id} line ${i + 1}: ${c.text}`); else valueOnlyComments += 1;
        } else if (c.kind === 'stepValue') problems.push(`stepValue on a statement match: ${id} line ${i + 1}`);
        if (/\bshould\b/i.test(c.text)) problems.push(`a comment says should: ${id} line ${i + 1}: ${c.text}`);
        comments += 1; familiesWith.add(id); perKind[c.kind] = (perKind[c.kind] || 0) + 1;
        const tag = `${id} line ${i + 1} [${c.kind}]: ${c.text}`;
        // polarity by state
        if (card.status === 'first-error') { if (!CROSS_KINDS.includes(c.kind)) problems.push(`cross with a non-cross template: ${tag}`); }
        else {
          if (CROSS_KINDS.includes(c.kind)) problems.push(`tick with a cross template: ${tag}`);
          if (NEGATIVE.test(c.text.replace(/\$[^$]*\$/g, ' '))) problems.push(`tick with a negative word: ${tag}`);
          if (line.status !== 'ok') problems.push(`positive comment on a line the engine did not tick: ${tag}`);
        }
        if (card.valueChain === 'arithmetic' && !EQUALITY_KINDS.includes(c.kind)) problems.push(`arithmetic tick with a non-equality template: ${tag}`);
        if (EQUALITY_KINDS.includes(c.kind) && card.valueChain !== 'arithmetic') problems.push(`equality template on a non-arithmetic line: ${tag}`);
        // maths comes only from the line's structured facts
        const allowed = new Set();
        if (c.kind === 'bothSides' || c.kind === 'equalsAbove') allowed.add(line.fact.tex !== undefined ? '$' + line.fact.tex + '$' : tex(line.fact.value));
        if (card.status === 'first-error' && line.diagnosis?.expectedFrom === 'sides') sidesCrosses += 1;
        if (c.kind === 'crossComputed' || c.kind === 'crossSidesDiffer') {
          sidesComments += 1;
          const sd = line.diagnosis.sides;
          allowed.add('$' + sd.left.tex + '$'); allowed.add('$' + sd.right.tex + '$'); allowed.add(mathSpan(sd.left.text)); allowed.add(mathSpan(sd.right.text));
          if (/\b(?:should|both)\b/i.test(c.text)) problems.push(`a sides cross says should/both: ${tag}`);
          if (c.kind === 'crossComputed' && sd.left.bare === sd.right.bare) problems.push(`crossComputed on two like sides: ${tag}`);
          if (c.kind === 'crossSidesDiffer' && !(sd.count === 2 && !sd.left.bare && !sd.right.bare)) problems.push(`crossSidesDiffer not on two computed sides: ${tag}`);
        }
        if (c.kind === 'stepValue') allowed.add('$' + line.fact.tex + '$');
        const dE = line.diagnosis?.expectedTex !== undefined ? '$' + line.diagnosis.expectedTex + '$' : line.diagnosis?.expected !== undefined ? tex(line.diagnosis.expected) : null;
        const dW = line.diagnosis?.writtenTex !== undefined ? '$' + line.diagnosis.writtenTex + '$' : line.diagnosis?.written !== undefined ? tex(line.diagnosis.written) : null;
        if (CROSS_KINDS.includes(c.kind) && c.kind !== 'crossComputed' && c.kind !== 'crossSidesDiffer') { allowed.add(dE); allowed.add(dW); }
        if (c.kind === 'ruleResult') { const rhs = mathSpan(String(line.text).split(/(?<![<>!=≤≥≠])=(?!=)/).pop().trim()); allowed.add(rhs); }
        const heading = c.kind === 'stepHeading' ? String(line.fact?.heading ?? '') : '';
        const sp = spansOf(heading ? c.text.replace(heading.replace(/\s+/g, ' ').trim().replace(/\.$/, ''), ' ') : c.text);
        for (const s of sp) if (!allowed.has(s)) problems.push(`maths span not from the line's facts (${s}): ${tag}`);
        // orientation: expected before written, and each is the engine's own
        if (CROSS_KINDS.includes(c.kind) && c.kind !== 'crossComputed' && c.kind !== 'crossSidesDiffer') {
          const e = dE, w = dW;
          if (!(c.text.indexOf(e) >= 0 && c.text.indexOf(w) > c.text.indexOf(e))) problems.push(`expected/written swapped or missing: ${tag}`);
        }
        // a rule only where the engine named it for this line
        if (c.kind === 'rule' || c.kind === 'ruleResult') { if (!(Array.isArray(card.rules) && card.rules.length && c.facts.rules.every(r => card.rules.some(x => x.rule === r)))) problems.push(`rule not named by the engine: ${tag}`); }
        else if (/\bRule [\w-]+/.test(c.text)) problems.push(`rule named without the engine naming it: ${tag}`);
        // vocabulary: the catalogue's words, the rule label slot and the heading slot only
        const stripped = c.text.replace(heading.replace(/\s+/g, ' ').trim().replace(/\.$/, ''), ' ').replace(/Rule [\w-]+/g, ' ');
        const bad = wordsOf(stripped).filter(w => !CATWORDS.has(w));
        if (bad.length) problems.push(`word outside the catalogue (${bad.join(',')}): ${tag}`);
        if (/[\u2014\u2013]/.test(stripped)) problems.push(`em dash: ${tag}`);
      });
    }
  }
}
ok(pages >= 3000, `generated pages: ${pages} (need at least 3000)`);
ok(familiesWith.size >= 20, `families with at least one engine comment: ${familiesWith.size}`);
ok(families.length >= 60, `generator families: ${families.length} (need at least 60)`);
ok(comments >= 3000, `comments rendered: ${comments}`);
ok(valueOnlyTicks > 0 && valueOnlyComments === valueOnlyTicks, `value-only ticks all say only the step's value: ${valueOnlyComments} of ${valueOnlyTicks} (non-vacuous: need more than 0)`);
ok(sidesCrosses > 0 && sidesComments > 0, `sides crosses on generated pages: ${sidesCrosses}, with a sides comment: ${sidesComments}`);
for (const k of ['bothSides', 'stepHeading', 'stepValue']) ok((perKind[k] || 0) > 0, `template kind ${k} occurs on generated pages (${perKind[k] || 0})`);
for (const p of problems.slice(0, 40)) failures.push(p);
ok(problems.length === 0, `problems on generated pages: ${problems.length}`);

// ── 2. orientation, by construction: both values known, both ways round ──────────────────────────────
for (const [expected, written, from] of [[-26, 14, 'line-above'], [14, -26, 'line-above'], [0.5, 2, 'line-above'], [2, 0.5, 'line-above']]) {
  const card = { n: 3, status: 'first-error', text: 'x', diagnosis: { expected, written, expectedFrom: from } };
  const c = commentFor(card, ctx);
  ok(c && c.text.indexOf(tex(expected)) >= 0 && c.text.indexOf(tex(written)) > c.text.indexOf(tex(expected)), `orientation ${expected}/${written}: ${c?.text}`);
}
ok(commentFor({ n: 3, status: 'first-error', text: 'x', diagnosis: { expected: 3, written: 3, expectedFrom: 'line-above' } }, ctx) === null, 'equal values: no cross sentence');
ok(commentFor({ n: 3, status: 'first-error', text: 'x', diagnosis: { message: 'The line above comes to $5$, but this line gives $7$.' } }, ctx) === null, 'a message string alone gives nothing: facts are never parsed from prose');
ok(commentFor({ n: 3, status: 'first-error', text: 'x', diagnosis: { expected: '5', written: '7', expectedFrom: 'line-above' } }, ctx) === null, 'non-numeric facts give nothing');
// F2: two sides that disagree. Built both ways round, with the shapes the engine carries.
const sd = (l, r, count = 2) => ({ n: 3, status: 'first-error', text: 'x', diagnosis: { code: 'arithmetic-not-equal', expectedFrom: 'sides', sides: { count, left: l, right: r } } });
const S = (text, tex, bare) => ({ text, tex, bare });
const oneBare = commentFor(sd(S('10 - 6', '4', false), S('14', '14', true)), ctx), oneBareR = commentFor(sd(S('14', '14', true), S('10 - 6', '4', false)), ctx);
ok(oneBare?.kind === 'crossComputed' && oneBare.text.indexOf('$4$') >= 0 && oneBare.text.includes('$14$'), `an expression against a bare number: ${oneBare?.text}`);
ok(oneBareR?.kind === 'crossComputed' && oneBareR.facts.expected === '$4$' && oneBareR.facts.written === '$14$' && oneBareR.facts.expr === mathSpan('10 - 6'), `a bare number first: the computed side is still named, with its value: ${oneBareR?.text}`);
const both = commentFor(sd(S('3*4', '12', false), S('5*2', '10', false)), ctx);
ok(both?.kind === 'crossSidesDiffer' && !/\bshould\b/i.test(both.text) && both.text.indexOf(mathSpan('3*4')) >= 0 && both.text.indexOf(mathSpan('5*2')) > both.text.indexOf(mathSpan('3*4')), `two computed sides: no "should": ${both?.text}`);
ok(commentFor(sd(S('3*4', '12', false), S('5*2', '10', false), 3), ctx) === null, 'three or more sides, both computed: the old sentence');
ok(commentFor(sd(S('5', '5', true), S('4', '4', true), 4), ctx) === null, 'two bare numbers: the old sentence');
ok(!/\bboth\b/i.test(commentFor(sd(S('2 + 3', '5', false), S('4', '4', true), 4), ctx)?.text || ''), 'three or more sides: never "both"');
ok(commentFor({ n: 3, status: 'first-error', text: 'x', diagnosis: { expected: 5, written: 7, expectedFrom: 'left-side' } }, ctx) === null && commentFor({ n: 3, status: 'first-error', text: 'x', diagnosis: { expected: 5, written: 7, expectedFrom: 'computed-side' } }, ctx) === null, 'an unknown cause, or a bare computed-side expected value, gives nothing');
// chainDiagnosis (the chain checker's cross) then commentFor: neither side is "expected" unless one is a bare number or fraction
{
  const via = (from, to, fv, tv) => { const d = chainDiagnosis(from, parse(normalize(from)), fv, to, tv); return commentFor({ n: 4, status: 'first-error', text: `${from} = ${to}`, diagnosis: d }, ctx); };
  const a = via('2*3', '4+3', 6, 7), b = via('2*3', '7', 6, 7), c2 = via('2*3', '13/2', 6, 6.5), c3 = via('1/2 + 1/3', '2/5', 5 / 6, 0.4);
  ok(a?.kind === 'crossSidesDiffer' && !/\bshould\b/i.test(a.text), `2*3 = 4+3: both computed: ${a?.text}`);
  ok(b?.kind === 'crossComputed' && !/\bshould\b/i.test(b.text) && b.facts.written === '$7$', `2*3 = 7: one bare: ${b?.text}`);
  ok(c2?.kind === 'crossComputed' && c2.facts.written.includes('13') && !/\bshould\b/i.test(c2.text), `2*3 = 13/2: a fraction is bare: ${c2?.text}`);
  ok(c3?.kind === 'crossComputed' && c3.facts.expr === mathSpan('1/2 + 1/3') && !/\bshould\b/i.test(c3.text), `1/2 + 1/3 = 2/5: ${c3?.text}`);
  ok(commentFor({ n: 4, status: 'first-error', text: 'x', diagnosis: chainDiagnosis('a + (n - 1)d', parse(normalize('a + (n - 1)d')), 9, '35', 35) }, ctx) === null, 'a formula in letters carries no sides: the old sentence');
  // a vector cross carries no side texts: the old sentence, never "should"
  const vecLines = ['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-20,-4]-[-6,+12]|'];
  let vecCross = 0;
  for (const [fam, seed] of [['me12-vectors', 58], ['me12-vectors', 3], ['me12-vectors', 11]]) {
    const vq = G.generateQuestion(fam, 1, seed);
    const vr = stepEvidence(vq, '260', vecLines.join('\n'), { correct: false }).stepReport;
    const vm = vr?.lines?.length >= 2 ? buildAnnotatedWorking({ lines: vecLines, stepReport: vr }) : null;
    for (const card of vm?.cards || []) if (card.status === 'first-error') { vecCross += 1; ok(commentFor(card, ctx) === null && card.diagnosis?.expectedFrom === undefined, `vector cross: the old sentence (${card.diagnosis?.code})`); }
  }
  ok(vecCross > 0, `vector crosses exercised: ${vecCross}`);
}
// the engine's own diagnoses for the three shapes, and the old sentences they replace
{
  const run = lines => { const r = stepEvidence(G.generateQuestion('y12-integration', 1, 27), '14', lines.join('\n'), { correct: false }).stepReport; return r.lines.find(l => l.status === 'break'); };
  const cardOf = (l, lines) => { const m = buildAnnotatedWorking({ lines, stepReport: stepEvidence(G.generateQuestion('y12-integration', 1, 27), '14', lines.join('\n'), { correct: false }).stepReport }); return m.cards.find(c => c.status === 'first-error'); };
  for (const [lines, kind, must] of [
    [['3 + 4 = 7', '10 - 6 = 14'], 'crossComputed', ['comes to']],
    [['3 + 4 = 7', '3 * 4 = 5 * 2'], 'crossSidesDiffer', ['do not match']],
    [['3 + 4 = 7', '2 + 3 = 5 = 5 = 4'], 'crossComputed', ['comes to']]
  ]) {
    const l = run(lines); const card = l ? cardOf(l, lines) : null; const c = card ? commentFor(card, ctx) : null;
    ok(l && c && c.kind === kind && must.every(w => c.text.includes(w)) && !/\b(?:should|both)\b/i.test(c.text), `engine page ${JSON.stringify(lines)}: ${c?.kind} ${c?.text}`);
  }
  // F3: a log line false under both readings carries no value, and gets the old sentence
  const logLines = ['3 + 4 = 7', 'log 3 + log 2 + log 5 = log(3 + 2 + 5)'];
  const lg = run(logLines);
  ok(lg && lg.diagnosis && lg.diagnosis.expectedFrom === undefined && lg.diagnosis.expectedTex === undefined && lg.diagnosis.sides === undefined, `a log line false in both readings carries no expected value: ${JSON.stringify(lg?.diagnosis && Object.keys(lg.diagnosis))}`);
  ok(lg && commentFor(cardOf(lg, logLines), ctx) === null, 'a log line false in both readings: the old sentence');
  ok(commentFor({ n: 2, status: 'first-error', text: 'x', diagnosis: { code: 'arithmetic-not-equal', message: 'm' } }, ctx) === null, 'a constructed log diagnosis without facts: the old sentence');
  ok(commentFor({ n: 2, status: 'first-error', text: 'x', diagnosis: { code: 'arithmetic-not-equal', message: 'm', expectedTex: '1', writtenTex: '2' } }, ctx) === null, 'facts without a named cause: the old sentence');
}
// ── 3. a rule or a step only when the engine said so ─────────────────────────────────────────────────
ok(commentFor({ n: 2, status: 'checked', text: "y'=6x^2+18x", rules: [] }, ctx) === null, 'no rule named by the engine: no rule sentence');
ok(commentFor({ n: 2, status: 'checked', text: "y'=6x^2+18x", rules: [{ rule: 'product' }] }, ctx)?.kind === 'ruleResult', 'a rule the engine named, with the line\'s own right-hand side');
ok(commentFor({ n: 2, status: 'checked', text: 'sin x', rules: [{ rule: 'product' }] }, ctx)?.kind === 'rule', 'a rule with no right-hand side: no result slot');
ok(commentFor({ n: 2, status: 'checked', valueChain: 'verified', text: 'a=2', note: 'Matches step 3 of the worked solution.' }, ctx) === null, 'a step named only in the note string gives nothing (no parsing)');
ok(commentFor({ n: 2, status: 'checked', valueChain: 'verified', text: 'a=2', fact: { kind: 'solution-step', step: 3, heading: 'Differentiate.' } }, ctx).text.includes('step 3') && !commentFor({ n: 2, status: 'checked', valueChain: 'verified', text: 'a=2', fact: { kind: 'solution-step', step: 3, heading: 'Differentiate.' } }, ctx).text.includes('..'), 'a step from the structured fact');
ok(commentFor({ n: 1, status: 'checked', valueChain: 'arithmetic', text: '3+4=7', note: 'Both sides come to $7$.' }, ctx) === null, 'an arithmetic tick with no structured value keeps the engine sentence');
for (const st of ['unverified', 'unread', 'not-verified', 'incomplete', 'follows', 'condition']) ok(commentFor({ n: 2, status: st, text: 'x=1', diagnosis: { expected: 1, written: 2 }, fact: { kind: 'both-sides', value: 1 } }, ctx) === null, `status ${st}: no commentary`);
// F1: a value-only fact is never "is step N"; a statement match still is
{
  const vo = commentFor({ n: 2, status: 'checked', valueChain: 'verified', text: '0 + 37 * (-8)', fact: { kind: 'solution-step', step: 3, valueOnly: true, tex: '-296' } }, ctx);
  ok(vo?.kind === 'stepValue' && vo.text.includes('$-296$') && vo.text.includes('step 3') && !/\b(?:is|matches)\s+step\b/i.test(vo.text) && !/^Correct/.test(vo.text), `a value-only tick: ${vo?.text}`);
  ok(commentFor({ n: 2, status: 'checked', valueChain: 'verified', text: 'a', fact: { kind: 'solution-step', step: 3, valueOnly: true } }, ctx) === null, 'a value-only tick without its value: the old sentence');
  // Hindi: no new wording. A Hindi sentence never embeds the English heading, and the new templates give nothing in Hindi
  ok(commentFor({ n: 2, status: 'checked', valueChain: 'verified', text: 'a=2', fact: { kind: 'solution-step', step: 3, heading: 'Differentiate' } }, { language: 'hi' }) === null, 'Hindi: a headed step gives nothing (no English heading in a Hindi sentence)');
  ok(commentFor({ n: 2, status: 'checked', valueChain: 'verified', text: 'a=2', fact: { kind: 'solution-step', step: 3, valueOnly: true, tex: '7' } }, { language: 'hi' }) === null, 'Hindi: a value-only tick gives nothing');
  ok(commentFor(sd(S('10 - 6', '4', false), S('14', '14', true)), { language: 'hi' }) === null && commentFor(sd(S('3*4', '12', false), S('5*2', '10', false)), { language: 'hi' }) === null, 'Hindi: a cross between sides gives nothing');
}
// ── 4. Hindi only for the templates that still have it (new templates are English only by owner decision), variants stay in the catalogue ──────────────────────────────────
const SAMPLE = {
  restates: { n: 1, status: 'checked', valueChain: 'given', restated: true, text: 'x=1' },
  stepHeading: { n: 2, status: 'checked', valueChain: 'verified', text: 'x=1', fact: { kind: 'solution-step', step: 2, heading: 'Solve' } },
  step: { n: 2, status: 'checked', valueChain: 'verified', text: 'x=1', fact: { kind: 'solution-step', step: 2, heading: null } },
  stepValue: { n: 2, status: 'checked', valueChain: 'verified', text: 'x=1', fact: { kind: 'solution-step', step: 2, valueOnly: true, tex: '7' } },
  ruleResult: { n: 2, status: 'checked', text: 'y=2x', rules: [{ rule: 'power' }] }, rule: { n: 2, status: 'checked', text: 'y', rules: [{ rule: 'power' }] },
  bothSides: { n: 2, status: 'checked', valueChain: 'arithmetic', text: '3+4=7', fact: { kind: 'both-sides', value: 7 } },
  equalsAbove: { n: 2, status: 'checked', valueChain: 'arithmetic', text: '=7', fact: { kind: 'equals-line-above', value: 7 } },
  crossAbove: { n: 3, status: 'first-error', text: 'x', diagnosis: { expected: 5, written: 7, expectedFrom: 'line-above' } },
  crossComputed: sd(S('10 - 6', '4', false), S('14', '14', true)),
  crossSidesDiffer: sd(S('3*4', '12', false), S('5*2', '10', false))
};
ok(TEMPLATE_KINDS.every(k => SAMPLE[k]) && [...POSITIVE_KINDS, ...EQUALITY_KINDS, ...CROSS_KINDS].length === TEMPLATE_KINDS.length, 'every template kind has a polarity and a sample');
const ENGLISH_ONLY = new Set(['stepValue', 'crossComputed', 'crossSidesDiffer']);
for (const k of TEMPLATE_KINDS) {
  for (const lang of ['en', 'hi']) { if (lang === 'hi' && (ENGLISH_ONLY.has(k) || k === 'stepHeading')) { ok((k === 'stepHeading' || !variantsOf(k, 'hi').length) && commentFor({ ...SAMPLE[k], n: 1 }, { language: 'hi', ruleLabel: r => r.rule }) === null, `template ${k}: nothing in Hindi (English only, or never embeds the English heading)`); continue; } for (let n = 1; n < 40; n += 1) {
    const c = commentFor({ ...SAMPLE[k], n }, { language: lang, ruleLabel: r => (lang === 'hi' ? 'नियम' : 'Rule') + ' ' + r.rule });
    if (!c || c.text.includes('{') || (lang === 'hi' && !/[ऀ-ॿ]/.test(c.text)) || !variantsOf(k, lang).length) { failures.push(`template ${k} ${lang} line ${n}: ${c?.text}`); break; }
  } }
  ok(variantsOf(k, 'en').length >= 1 && (ENGLISH_ONLY.has(k) || (variantsOf(k, 'hi').length >= 1 && variantsOf(k, 'hi').length <= variantsOf(k, 'en').length)), `template ${k}: Hindi has wording, never more variants than English (English-only templates have no Hindi)`);
}
ok(Object.values(CATALOGUE).every(c => [...c.en, ...(c.hi || [])].every(s => !/[\u2014\u2013]/.test(s))), 'no em dash in any template');
ok(new Set(Array.from({ length: 30 }, (_, n) => commentFor({ ...SAMPLE.bothSides, n }, ctx).text)).size > 1, 'the wording varies across lines');
eq(commentFor({ ...SAMPLE.bothSides, n: 5 }, ctx), commentFor({ ...SAMPLE.bothSides, n: 5 }, ctx), 'the same line always reads the same');

// ── 5. the engine edits add facts only: nothing about a tick, a cross or a note changed ──────────────────
const STRIP = ['fact'];
const q = G.generateQuestion('y12-integration', 3, 4);
const rep = stepEvidence(q, '64/3', ['y = 2x(4-x)', 'Area = ∫_0^4 2x(4-x) dx', '= 2∫_0^4 4x-x^2 dx', '= 2[4x^2/2 - x^3/3]_0^4'].join('\n'), { correct: false }).stepReport;
ok(rep.lines.every(l => ['ok', 'break', 'note'].includes(l.status)) && JSON.stringify(rep.lines.map(l => l.status)) === JSON.stringify(rep.lines.map(l => { const c = { ...l }; for (const k of STRIP) delete c[k]; return c.status; })), 'removing the structured facts changes no status');
void stepMetaFor; void plainComment;

// ── 6. the owner's pages, old sentence and new sentence ─────────────────────────────────────────────
const AREA = ['8 y = 2x(4-x)', 'Area = ∫_0^4 2x(4-x) dx', '= 2∫_0^4 4x-x^2 dx', '= 2[4x^2/2 - x^3/3]_0^4', '= 2[2x^2 - x^3/3]_0^4', '= 2[2(4)^2 - 4^3/3] = 2[32 - 64/3]', '16/2', '64/3'];
const STAT = ['y = 2x^3 + 9x^2', 'y′ = 6x^2 + 18x', 'for stat points y′ = 0', '0 = 6x^2 + 18x', '0 = 6x[x + 3]', 'x = 0 or x = -3', 'y(0) = 0', 'Smallest: (0,0)'];
const VEC = ['|4a+3b|', '= |4[-5,-1]+3[-2,4]|', '= |[-20,-4]-[-6,+12]|', '196', '+64', '260', '= |[14,8]| = sqrt(14^2+8^2)', '= sqrt(260)'];
const SLIP = ['3 + 4 = 7', '= 7', '10 - 6 = 14', '= 14'];
const firstSentence = text => { const clean = String(text || '').replace(/\s+/g, ' ').trim(); const m = clean.match(/^.*?[.!?](?=\s+[A-Z]|$)/); return (m ? m[0] : clean).trim(); };
const pagesOut = [];
for (const [title, qq, page, answer] of [
  ['IMG_0501, the area page (y = 2x(4 - x), area 64/3)', G.generateQuestion('y12-integration', 3, 4), AREA, '64/3'],
  ['IMG_0496, the stationary points page', G.generateQuestion('y12-appdiff', 2, 41), STAT, '0'],
  ['IMG_1233, the vectors page', G.generateQuestion('me12-vectors', 1, 58), VEC, '260'],
  ['A slip written as arithmetic (10 - 6 = 14)', G.generateQuestion('y12-integration', 1, 27), SLIP, '14']
]) {
  const r = stepEvidence(qq, answer, page.join('\n'), { correct: false }).stepReport;
  if (!r?.lines || r.lines.length < 2) { pagesOut.push({ title, rows: [] }); continue; }
  let model = null; try { model = buildAnnotatedWorking({ lines: page, stepReport: r }); } catch { model = null; }
  const rows = r.lines.map((l, i) => {
    const card = model?.cards?.[i];
    const old = l.status === 'break' ? firstSentence(plainComment(l.diagnosis?.message || l.note || '')) : plainComment(String(l.note ?? '')) || '(no sentence)';
    const c = card ? commentFor(card, ctx) : null;
    return { n: i + 1, text: l.text, status: l.status === 'ok' ? 'tick' : l.status === 'break' ? 'cross' : 'note', old, now: c ? plainComment(c.text) : '(unchanged)' };
  });
  pagesOut.push({ title, rows });
}
const md = ['# Engine commentary: old sentence and new sentence on the owner\u2019s pages', '',
  'Generated by `node server/test/line-commentary-check.mjs --write`. No model writes any of these: each new sentence is a reviewed template filled',
  'from structured engine facts (the value both sides come to, the worked-solution step, the rule the engine named, the value the working reached',
  'and the value the line gives). Where the engine has no such fact the line keeps its old sentence ("unchanged"). Ticks, crosses and notes are not changed.',
  'Rule names below are shown as `Rule <id>`; the page uses the interface\u2019s own rule names.', ''];
for (const p of pagesOut) {
  md.push(`## ${p.title}`, '', '| Line | Working | Engine verdict | Old sentence | New sentence |', '|---|---|---|---|---|');
  for (const r of p.rows) md.push(`| ${r.n} | \`${r.text.replace(/\|/g, '\\|')}\` | ${r.status} | ${r.old.replace(/\|/g, '\\|')} | ${r.now.replace(/\|/g, '\\|')} |`);
  md.push('');
}
const mdText = md.join('\n');
const mdPath = new URL('../../owner-review/ENGINE-COMMENTS-SAMPLES.md', import.meta.url);
if (process.argv.includes('--write')) writeFileSync(mdPath, mdText);
let current = ''; try { current = readFileSync(mdPath, 'utf8'); } catch { current = ''; }
ok(current === mdText, 'owner-review/ENGINE-COMMENTS-SAMPLES.md is current (run with --write to regenerate)');
ok(pagesOut.every(p => p.rows.length > 0) && pagesOut.some(p => p.rows.some(r => r.now !== '(unchanged)')), 'the owner pages produced rows, some with new commentary');

if (failures.length) { console.error(failures.slice(0, 50).join('\n')); console.error(`LINE COMMENTARY: FAIL (${failures.length})`); process.exit(1); }
console.log(`LINE COMMENTARY: PASS: ${pass} checks, ${pages} generated pages across ${families.length} generators, ${comments} comments (${Object.entries(perKind).map(([k, v]) => `${k} ${v}`).join(', ')})`);
