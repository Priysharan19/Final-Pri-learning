// Pri Learning · the answer-field placeholder is never the answer.
//
// Reported from the live audit: in 73 generators the "e.g. …" hint in the
// answer field was the keyed answer (every draw of the Class 8 linear-equation
// families, among others). Every generator, at every difficulty, over a fixed
// set of seeds: no hint on a question or a part may be marked correct.
import { loadAllBanks, generateQuestion, GENERATORS } from '../src/engine/generators/index.js';
import { checkAnswer } from '../src/engine/checker.js';
import { MULTIPART, generateMultipart } from '../src/engine/generators/multipart.js';

await loadAllBanks();
const shown = hint => { const body = hint.replace(/^\s*e\.g\.?\s*/i, '').trim(); return [body, ...body.split(/\s+or\s+|\s*;\s*/i)].map(x => x.trim()).filter(Boolean); };
const isAnswer = (part, text) => { try { return checkAnswer(part, text)?.correct === true; } catch { return false; } };
const leaks = [];
let questions = 0, hints = 0;
for (const id of Object.keys(GENERATORS)) {
  for (let difficulty = 1; difficulty <= 4; difficulty++) {
    for (let seed = 1; seed <= 25; seed++) {
      let q;
      try { q = generateQuestion(id, difficulty, seed); } catch { continue; }
      if (!q) continue;
      questions++;
      for (const part of Array.isArray(q.parts) ? [q, ...q.parts] : [q]) {
        if (typeof part.inputHint !== 'string') continue;
        hints++;
        const correct = shown(part.inputHint).some(x => isAnswer(part, x));
        if (correct) leaks.push(`${id} d${difficulty} seed ${seed}: "${part.inputHint}"`);
      }
    }
  }
}
let multipartHints = 0;
for (const id of Object.keys(MULTIPART)) {
  for (let seed = 1; seed <= 100; seed++) {
    let q;
    try { q = generateMultipart(id, seed); } catch { continue; }
    for (const part of q.parts || []) {
      if (typeof part.inputHint !== 'string') continue;
      multipartHints++;
      const correct = shown(part.inputHint).some(x => isAnswer(part, x));
      if (correct) leaks.push(`multipart ${id} seed ${seed} part ${part.key}: "${part.inputHint}"`);
    }
  }
}
if (questions < 10000 || hints < 1000) {
  console.log(`INPUT HINT LEAK: FAIL — the audit did not reach the bank (${questions} questions, ${hints} hints)`);
  process.exit(1);
}
console.log(leaks.length
  ? `INPUT HINT LEAK: FAIL — ${leaks.length} hints are the correct answer\n  · ${leaks.slice(0, 20).join('\n  · ')}`
  : `INPUT HINT LEAK: PASS — ${hints} hints across ${questions} generated questions, none is a correct answer (plus ${multipartHints} multipart part hints).`);
process.exit(leaks.length ? 1 : 0);
