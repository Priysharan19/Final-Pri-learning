// UI4 · the reading strip stays answer-blind and display-only.
// A static scan of the reading layer, the per-line state words, the strip and
// the "That's it" action: none reads the question's answer, an expected value,
// a solution or a verdict. A reading chip says what was read, never whether it
// is right (the verdict belongs to the marks after Check).
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
let pass = 0; const fail = [];
const check = (name, ok) => { if (ok) pass += 1; else fail.push(name); };
const start = src.indexOf('function readStateOf');
const layer = src.slice(src.indexOf('className="in-read-layer"'), src.indexOf('{statusLine && !disabled'));
const strip = src.slice(src.indexOf('data-read-strip') - 300, src.indexOf('data-read-strip') + 700);
const helper = src.slice(start, src.indexOf('\n}\n', start) + 3);
const FORBIDDEN = /question\.answer|\bexpected\b|\bsolution\b|\bmarkScheme\b|\blineVerdicts\b|\bverdict\b|readSlip|readOk/;
for (const [name, text] of [['helper', helper], ['reading layer', layer], ['strip', strip]]) {
  check(`${name} reads no answer, expected value, solution or verdict`, !FORBIDDEN.test(text));
}
check('the chip carries one of three named states', /is-\$\{state\}/.test(layer) && /READ_STATE_KEY/.test(layer));
check('the "check this" threshold is the server floor, not a new number', /isLowConfidence\(line, floor\)/.test(helper) && !/0\.\d+/.test(helper));
check('the confidence number is never drawn', !/\bconf\b[^;\n]*\*\s*100\s*}\s*%/.test(layer) && /data-read-confidence/.test(layer));
if (fail.length) { console.error(`READING STRIP BLIND: FAIL — ${fail.join('; ')}`); process.exit(1); }
console.log(`READING STRIP BLIND: PASS — ${pass}/${pass} checks — the strip names what was read, never a verdict`);
