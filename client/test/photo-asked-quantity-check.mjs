// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a final answer is never guessed from a line that does not
// state the asked quantity (owner test, 18 Nov 2026).
//
// An unfinished handwritten page ended "x = 0 or x = −3" under a question that
// asks for a y-coordinate; the app pre-filled "y = 0" and marked "Not quite".
// Where the question names the quantity it asks for, only lines that state THAT
// quantity are candidates: "y = 5", "y(0) = 0", or the second coordinate of a
// point. Usage: node client/test/photo-asked-quantity-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { proposeFinalAnswer, askedVariable } from '../src/photo/finalAnswer.js';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n += 1; };

const asksY = { answerType: 'numeric', answerPrefix: 'y =', prompt: 'Find the y-coordinate of the stationary point of $y = 2x^3 + 9x^2$ with the smallest y-value.' };
const page = ['y=2x^3+9x^2', "y'=6x^2+18x", "for stat points y'=0", '0=6x^2+18x', '0=6x[x+3]'];

ok(askedVariable(asksY) === 'y', 'the asked letter is read from the answer prefix');
ok(askedVariable({ prompt: 'Find the x-coordinate of the vertex.' }) === 'x', '"x-coordinate" asks for x');
ok(askedVariable({ prompt: 'Find the value of $y$ when x = 2.' }) === 'y', '"value of y" asks for y');
ok(askedVariable({ prompt: 'Simplify 3x + 4x.' }) === null, 'no asked letter, no restriction');

// The owner's unfinished page: nothing states y, so nothing is proposed.
const unfinished = proposeFinalAnswer([...page, 'x=0 or x=-3'], asksY);
ok(unfinished.status === 'none' && unfinished.missing === 'y', 'x = 0 or x = −3 does not become the answer to a y question');
ok(proposeFinalAnswer([...page, 'x = 0'], asksY).status === 'none', 'a single x line is not a y answer either');

// Finished: a function evaluation and a point both state y.
const finished = proposeFinalAnswer([...page, 'x=0 or x=-3', 'y(0)=0', 'smallest: (0,0)'], asksY);
ok(finished.status === 'proposed' && finished.answer === '0', 'y(0) = 0 and the point (0, 0) both give y = 0');
ok(proposeFinalAnswer([...page, 'y(0)=0'], asksY).answer === '0', 'y(0) = 0 alone states y');
ok(proposeFinalAnswer([...page, 'smallest: (0,0)'], asksY).answer === '0', 'a point gives its y-coordinate');
ok(proposeFinalAnswer([...page, 'smallest: (2,5)'], asksY).answer === '5', 'the second coordinate, not the first');
const two = proposeFinalAnswer([...page, 'y(0)=0', 'y(-3)=27'], asksY);
ok(two.status === 'ambiguous' && two.candidates.length === 2, 'two different y values are asked about, not guessed');
ok(proposeFinalAnswer(['x = 2', 'y = 5'], asksY).answer === '5', 'a labelled y line is the answer');

// The restriction never applies when the question names no letter.
const solve = { answerType: 'numeric', prompt: 'Solve for $x$.' };
ok(proposeFinalAnswer(['3x = 6', 'x = 2'], solve).answer === '2', 'solving for x still proposes x = 2');
console.log(`PHOTO ASKED QUANTITY: ${n} checks passed`);
