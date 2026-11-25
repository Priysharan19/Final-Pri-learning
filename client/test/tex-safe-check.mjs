// Pri Learning · the safe-TeX gate for the reader's `latex` (engine/texSafe.js).
// A TeX that is not plausibly plain maths is dropped (null) and the line keeps its text; nothing is repaired.
import { cleanLatex, safeLatexLines, MAX_LATEX_CHARS } from '../src/engine/texSafe.js';
import { buildTranscript, includedLatex, editLine, reviveTranscript } from '../src/photo/transcript.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };

for (const good of ['x^{2}+1', 'e^{x}(2x-4)', '\\frac{a}{b}', '\\sqrt[3]{x}', '\\left(x+1\\right)^{2}', '\\int_{0}^{2} 3x^{2}\\,dx', '\\sin\\theta=\\frac{1}{2}', '\\pi r^{2}', 'x \\le 3', '\\text{ cm}', '2\\cdot 3']) {
  ok(cleanLatex(good) === good, `plain maths is kept: ${good}`);
}
// the constructs of the extended reading (engine/texToPlain.js) pass the gate; a hostile command inside any of them does not
for (const good of ['\\binom{5}{2}=10', '{}^{7}P_{2}', '30^\\circ=\\frac{\\pi}{6}', '\\sin^{-1}\\frac12', '\\sin^{2}x+\\cos^{2}x=1', '\\log_{2}(x+1)', '\\int_{0}^{\\pi}\\sin x\\,dx=2', '\\dot A=2\\pi r\\dot r', '\\ddot{x}=\\dot{x}', "y''=2", 'x=\\pm4', '\\left|x-3\\right|', '\\alpha\\beta=3', '\\sqrt[4]{16}=2']) ok(cleanLatex(good) === good, `extended maths is kept: ${good}`);
for (const bad of ['\\binom{\\href{x}{y}}{2}', '\\dot{\\input{a}}', '\\dotfoo x', '\\sin^{\\write18{ls}}x', '\\int_{\\url{x}}^{1}x\\,dx', '\\left|\\htmlClass{a}{x}\\right|', '\\log_{\\def\\x{1}}2', '\\sqrt[\\includegraphics{a}]{x}']) ok(cleanLatex(bad) === null, `hostile inside an extended construct is dropped: ${bad}`);
ok(cleanLatex('16\\%') === null, 'an escaped percent is still dropped (a % can start a TeX comment)');
ok(cleanLatex('  x+1  ') === 'x+1', 'trimmed');
const hostile = [
  '\\href{https://evil.example}{x}', '\\url{https://evil.example}', '\\includegraphics{a.png}', '\\input{/etc/passwd}', '\\write18{ls}',
  '\\def\\x{1}', '\\newcommand{\\x}{1}', '\\catcode`\\%=12', '\\htmlClass{a}{x}', '\\htmlStyle{color:red}{x}', '\\htmlId{a}{x}', '\\htmlData{a=b}{x}',
  'javascript:alert(1)', 'x<script>alert(1)</script>', 'x > 3', 'a < b', '$x$', '50% of x', 'x # y', 'a & b', 'a \\\\ b', '\\begin{aligned}x\\end{aligned}',
  '\\unknowncommand{x}', '{x', 'x}', '{{{{{{{{{x}}}}}}}}}', 'x\\', 'x\u0000y', 'x\ny', '\\verb|x|', '\\mathrm{javascript:alert(1)}', '\\textcolor{red}{x}'
];
for (const bad of hostile) ok(cleanLatex(bad) === null, `dropped: ${JSON.stringify(bad)}`);
for (const nonString of [null, undefined, 3, {}, ['x'], true, '', '   ']) ok(cleanLatex(nonString) === null, `not a string / empty: ${JSON.stringify(nonString)}`);
ok(cleanLatex('x'.repeat(MAX_LATEX_CHARS)) !== null && cleanLatex('x'.repeat(MAX_LATEX_CHARS + 1)) === null, 'capped at the same length as the schema');
ok(cleanLatex('x'.repeat(10), 5) === null, 'a smaller cap is honoured');

// The route's gate on the reader's lines: a hostile latex is dropped, the text and everything else about the line are untouched.
const reply = latex => safeLatexLines([{ text: 'e^x(2x-4)', latex, confidence: 0.95, uncertain: false, box: null }])[0];
ok(reply('e^{x}(2x-4)').latex === 'e^{x}(2x-4)', 'a good latex rides on the line');
for (const bad of ['\\href{http://e}{x}', 'x<b>', '\\input{a}', '']) { const l = reply(bad); ok(l.latex === null && l.text === 'e^x(2x-4)' && l.confidence === 0.95, `a bad latex is dropped and the text kept: ${JSON.stringify(bad)}`); }
ok(reply(undefined).latex === null && reply(7).latex === null, 'no latex, or not a string: null');
ok(safeLatexLines(undefined) === undefined && JSON.stringify(safeLatexLines([{ text: 'a' }])) === '[{"text":"a"}]', 'a line with no latex key is not touched');

// The transcript: optional extra field; nothing existing changes shape.
const tr = buildTranscript({ lines: [{ text: 'e^x(2x-4)', latex: 'e^{x}(2x-4)', confidence: 0.9 }, { text: 'y = 2', latex: '\\href{x}{y}=2', confidence: 0.9 }, { text: 'z = 3', confidence: 0.9 }], confidenceFloor: 0.5 }, { prompt: '' });
ok(tr.lines[0].latex === 'e^{x}(2x-4)' && !('latex' in tr.lines[1]) && !('latex' in tr.lines[2]), 'the transcript carries a valid latex and drops others');
ok(tr.lines[1].text === 'y = 2' && tr.lines[2].text === 'z = 3', 'text is untouched');
const without = buildTranscript({ lines: [{ text: 'a = 1', confidence: 0.9 }] }, {});
ok(!('latex' in without.lines[0]) && 'segments' in without.lines[0] === false, 'a line without latex has no latex key and no new keys');
ok(includedLatex(tr).join('|') === 'e^{x}(2x-4)||', 'includedLatex runs parallel to the included lines');
ok(includedLatex(editLine(tr, 0, 'e^x(2x-5)')).every(x => x === null), 'an edited line has no latex');
ok(reviveTranscript(JSON.parse(JSON.stringify(tr))).lines[0].latex === 'e^{x}(2x-4)', 'a stored transcript keeps it');
ok(!('latex' in reviveTranscript({ lines: [{ text: 'x', latex: '\\input{a}' }] }).lines[0]), 'a stored hostile latex is dropped on revival');
const words = buildTranscript({ lines: [{ text: 'x = 3 cm', latex: 'x=3\\text{ cm}', confidence: 0.9 }] }, {});
ok(includedLatex(words)[0] === null, 'TeX with words in it is not set as maths alone');

console.log(`TEX SAFE: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — hostile TeX dropped, the line keeps its text`);
if (fail) process.exit(1);
