// A reading is shown once and consistently (owner follow-up, 18 November 2026,
// after a live Year 12 Extension 1 attempt): which line is doubtful and why, one
// state per line, upright function names, no leading "=" in "Your answer".
// Static and pure; the browser behaviour is pinned by tour-auto-read.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readsAsMaths, doubtfulSpan } from '../src/ink/readingShape.js';
import { exprToLatex } from '../src/ink/inkLatex.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// The owner's page: three lines, one misread (pi t came out as "n+").
ok(readsAsMaths('22 + 5sin(πt/6)') && readsAsMaths('max = 22 + 5') && readsAsMaths('= 27', { continuation: true }), 'the three lines as written are well-formed');
const bad = doubtfulSpan('22 + 5sin((n+)/6)');
ok(bad && bad.text === '(n+)', `a dangling operator before a bracket is named, with its bracket group (got ${bad?.text})`);
ok(doubtfulSpan('22+5sin(n+)/6')?.text === '(n+)', 'the same without spaces');
ok(!readsAsMaths('= 27') && readsAsMaths('= 27', { continuation: true }), 'a leading relation sign is ordinary working on a later line, not on the first');
ok(doubtfulSpan('x +')?.text === 'x +'.replace(/\s/g, '') || !!doubtfulSpan('x +'), 'a trailing operator is flagged');
ok(doubtfulSpan('(x+1')?.text === '(x+1', 'an unclosed bracket is named from its opening');
ok(doubtfulSpan('2x ? 3')?.text === '?', 'a question mark is named');
ok(doubtfulSpan('x ++ 1') !== null && doubtfulSpan('x = -1') === null && doubtfulSpan('x >= 2') === null, 'doubled operators are flagged; a sign and a relation are not');
ok(doubtfulSpan('') === null, 'an empty line is not a shape problem');

// Function names are operators in every reading display (one converter).
ok(/\\sin /.test(exprToLatex('22 + 5sin(pi t/6)')), 'sin runs into a digit and is still \\sin');
ok(/\\operatorname\{max\}/.test(exprToLatex('max = 22 + 5')) && /\\operatorname\{min\}/.test(exprToLatex('min(x)')), 'max and min are upright operators');
ok(/\\ln /.test(exprToLatex('2ln(x)')) && /\\cos /.test(exprToLatex('cos(x)')), 'ln and cos too');
ok(!/\\operatorname\{max\}imum/.test(exprToLatex('maximum')), 'a longer word is not split');

// One state per line, one panel.
const ink = read('../src/ink/InkAnswer.jsx');
const card = read('../src/components/QuestionCard.jsx');
ok(/function readStateOf\(line, floor, index = 0\)/.test(ink) && /doubtfulSpan\(line\.text/.test(ink), 'the chips, the list and the strip share one well-formedness-aware state');
ok(!/in-read-cf/.test(ink) && /in-read-ok/.test(ink), 'no confidence dashes on the chips: a dot, and a word only where a line needs a look');
ok(/filter\(r => unsureLines\.includes\(r\.idx\)\)/.test(card), 'the confirmation panel lists only the lines to check, not the whole reading again');
ok(/data-confirm-span=\{i\}/.test(card) && /edit\?\.\(i\)/.test(card), 'the doubtful span is a control that opens the editor for that line');
ok(/confirmFocusRef\.current\?\.focus/.test(card), 'focus goes to the first line to check');
ok(/replace\(\/\^\\s\*\[=/.test(card), 'a leading relation sign is stripped when stating the final answer');

const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
for (const k of ['verdict.confirmCheckOne', 'verdict.confirmCheckMany', 'verdict.confirmCheckLead', 'verdict.confirmSpanAria', 'verdict.checkShapeLine']) ok(en[k] && hi[k], `${k} exists in English and Hindi`);
ok(/^Check line \{n\}, then confirm$/.test(en['verdict.confirmCheckOne']), 'the count says what to do in plain words');
const css = read('../src/workspace.css');
ok(!/\.ws-confirm-unsure \{[^}]*uppercase/.test(css) && !/\.ws-confirm-line\.is-unsure \{[^}]*dashed/.test(css), 'the warning is a plain sentence in the body face, not capitals in a dashed box');
console.log(`READING SHAPE: PASS - ${n}/${n} checks - one state per line, the doubtful span named, upright operators, one panel`);
