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

// The shape check still names a doubtful span (the tutor's help plan and the exam room use it); 19 Nov 2026: practice no longer
// shows the reading or a confirmation panel, so the chips, list and panel assertions are retired with them.
const ink = read('../src/ink/InkAnswer.jsx');
const card = read('../src/components/QuestionCard.jsx');
ok(/function readStateOf\(line, floor, index = 0\)/.test(ink) && /doubtfulSpan\(line\.text/.test(ink), 'a surface that shows its reading (the exam room) shares one well-formedness-aware state');
ok(!/in-read-cf/.test(ink) && /in-read-ok/.test(ink), 'no confidence dashes on the chips: a dot, and a word only where a line needs a look');
ok(!/data-confirm-span|confirmFocusRef|ws-confirm/.test(card), 'the practice card draws no confirmation panel before marking');
ok(/replace\(\/\^\\s\*\[=/.test(card), 'a leading relation sign is stripped when stating the final answer');

const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
for (const k of ['verdict.markMyWorking', 'mark.finalUnreadable', 'mp.seeLine', 'mp.seePage', 'mp.unread', 'mp.unreadHow']) ok(en[k] && hi[k], `${k} exists in English and Hindi`);
ok(/^Pri couldn’t read your final answer\. Rewrite that line or type it here\.$/.test(en['mark.finalUnreadable']), 'the final-answer sentence is the decided one, in plain words');
const css = read('../src/workspace.css');
ok(!/\.ws-confirm/.test(css), 'the confirmation panel\'s styles are gone with it');
console.log(`READING SHAPE: PASS - ${n}/${n} checks - the doubtful span named, upright operators, no reading panel before marking`);
