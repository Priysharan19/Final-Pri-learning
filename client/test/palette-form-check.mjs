// UI8: palette search by form — the pure matcher in instrument/formSearch.js.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseForm, matchTemplates, syllabusIndex } from '../src/instrument/formSearch.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const same = (a, b, m) => { assert.deepEqual(a, b, m); n += 1; };

const quad = ['x^2-2x', 'x²−2x', 'x**2-2*x', 'x^2 - 2*x', '3x^2+5x-2', '2*x^2 + x', 'a^2-b^2'];
const key = q => parseForm(q)?.shape;
for (const q of quad.slice(0, 5)) ok(key(q) === 'poly(2)', `${q} is a quadratic`);
ok(key('x^2-2x') === key('x²−2x'), 'superscript and caret agree');
ok(parseForm('2x+3').tags.includes('linear'), '2x+3 is linear');
ok(parseForm('x^3-x').tags.includes('cubic'), 'cubic');
ok(parseForm('x^2-2x=0').equation === true && parseForm('x^2-2x=0').tags.includes('quadratic'), 'a quadratic equation');
ok(parseForm('sqrt(x)+1').tags.includes('surd'), 'sqrt is a surd');
ok(parseForm('√(x)+1') === null || parseForm('√(x)+1').tags.includes('surd'), 'the radical sign is read or declined, never misread');
ok(parseForm('sin(x)/2').tags.includes('trig'), 'trig');
ok(parseForm('log(x)').tags.includes('log'), 'log');
ok(parseForm('(x+1)/(x-2)').tags.includes('fraction'), 'algebraic fraction');
ok(parseForm('3/4+1/2').tags.includes('arith-fraction'), 'numeric fractions');
ok(parseForm('2^x').tags.includes('exp'), 'exponential');
ok(parseForm('abs(x-1)').tags.includes('abs'), 'modulus');
for (const q of ['Real Numbers', 'area of circle', 'x', '', 'hello world 5', '7']) ok(parseForm(q) === null, `"${q}" is a word or a lone symbol, not a form`);

const rows = syllabusIndex([
  { id: 'c1', name: 'Real Numbers', dotpoints: ['Euclid division lemma', 'Irrational numbers and surds'] },
  { id: 'c2', name: 'Polynomials', dotpoints: ['Factorise quadratic polynomials', 'Zeros of a cubic polynomial', 'Expand brackets'] },
  { id: 'c3', name: 'Quadratic Equations', dotpoints: ['Solve quadratic equations by factorising', 'Completing the square'] },
  { id: 'c4', name: 'Trigonometry', dotpoints: [{ text: 'Sine and cosine ratios' }] }
]);
const hits = matchTemplates(parseForm('x^2-2x'), rows);
ok(hits.length >= 2 && ['c2', 'c3'].includes(hits[0].chapterId), 'a quadratic finds the quadratic chapters first');
ok(matchTemplates(parseForm('x^2-2x=0'), rows)[0].chapterId === 'c3', 'a quadratic equation finds the equations chapter first');
ok(matchTemplates(parseForm('sin(x)'), rows)[0].chapterId === 'c4', 'trig finds trigonometry');
ok(matchTemplates(null, rows).length === 0 && matchTemplates(parseForm('x^2'), null).length === 0, 'no form or no index is empty');
same(Object.keys(hits[0]).sort(), ['chapterId', 'chapterName', 'count', 'point', 'topic'], 'a result carries only a syllabus pointer');

// No answer, seed or solution is reachable: structural scan of the module.
const src = readFileSync(new URL('../src/instrument/formSearch.js', import.meta.url), 'utf8');
const imports = [...src.matchAll(/^import .* from '(.+)';/gm)].map(m => m[1]);
same(imports, ['../engine/expr.js'], 'the matcher imports only the notation parser');
ok(!/\bfetch\b|XMLHttpRequest|sendBeacon|WebSocket/.test(src.replace(/\/\/.*$/gm, '')), 'the matcher makes no network call');
ok(!/generat|solution|answer|seed|mark/i.test(src.replace(/\/\/.*$/gm, '')), 'no generator, solution, answer, seed or marking term in the code');

const t0 = performance.now();
for (let i = 0; i < 200; i += 1) matchTemplates(parseForm(quad[i % quad.length]), rows);
ok((performance.now() - t0) / 200 < 5, 'under 5 ms per query');
console.log(`PALETTE FORM: PASS — ${n}/${n} checks — forms parsed with the bundled notation parser and matched to the syllabus index on the device; no network, no generator, no answer text`);
