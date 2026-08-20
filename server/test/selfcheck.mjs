// Self-consistency harness: every generator must produce questions whose own
// canonical answer passes the checker, with well-formed payloads.
// Usage: node server/test/selfcheck.mjs [subtopicFilter] [n]
import { GENERATORS, generateQuestion } from '../engine/generators/index.js';
import { MULTIPART, generateMultipart } from '../engine/generators/multipart.js';
import { checkAnswer } from '../engine/checker.js';

const filter = process.argv[2] || '';
const N = Number(process.argv[3] || 30);

function canonicalInput(q) {
  const a = q.answer;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric':
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k === -1 ? '-' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.requireExact) return null; // must provide canonicalInput
      return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'working': return a.canonicalWorking ?? null;
    default: return null;
  }
}

let fails = 0, total = 0;
const subtopics = Object.keys(GENERATORS).filter(k => k.includes(filter));
for (const st of subtopics) {
  for (let d = 1; d <= 4; d++) {
    for (let i = 0; i < N; i++) {
      total++;
      const seed = (d * 100000 + i * 977 + st.length * 13) >>> 0;
      let q;
      try {
        q = generateQuestion(st, d, seed);
      } catch (err) {
        console.log(`GEN-ERROR  ${st} D${d} seed=${seed}: ${err.message}`);
        fails++; continue;
      }
      // payload shape
      const problems = [];
      if (!q.prompt || typeof q.prompt !== 'string') problems.push('no prompt');
      if (!q.answerType) problems.push('no answerType');
      if (!q.answer) problems.push('no answer');
      if (!Array.isArray(q.steps) || q.steps.length === 0) problems.push('no steps');
      if (!Array.isArray(q.hints) && q.answerType !== 'mcq') problems.push('no hints');
      if (q.answerType === 'mcq' && (!q.mcqOptions || q.mcqOptions.length < 2)) problems.push('mcq without options');
      if (/NaN|undefined|Infinity/.test(q.prompt)) problems.push('bad token in prompt: ' + q.prompt);
      for (const s of q.steps || []) if (/NaN|undefined|Infinity/.test(`${s.h} ${s.d}`)) problems.push('bad token in step: ' + s.d);
      for (const h of q.hints || []) if (/NaN|undefined/.test(h)) problems.push('bad token in hint: ' + h);
      const ci = canonicalInput(q);
      if (ci === null) problems.push('no canonical input (requireExact needs canonicalInput)');
      else {
        const res = checkAnswer(q, ci);
        if (!res.correct) problems.push(`canonical answer "${ci}" rejected${res.feedback ? ` (${res.feedback})` : ''}`);
      }
      if (problems.length) {
        fails++;
        console.log(`FAIL ${st} D${d} seed=${seed}\n  ${problems.join('\n  ')}\n  prompt: ${q?.prompt?.slice(0, 140)}`);
        if (fails > 40) { console.log('...stopping after 40 failures'); process.exit(1); }
      }
    }
  }
}
// ── Multipart exam questions: every part's canonical answer must pass ────────
let mpTotal = 0, mpFails = 0;
const mpIds = Object.keys(MULTIPART).filter(k => k.includes(filter));
for (const id of mpIds) {
  for (let i = 0; i < Math.min(N, 25); i++) {
    const seed = (900000 + i * 1013 + id.length * 7) >>> 0;
    let q;
    try {
      q = generateMultipart(id, seed);
    } catch (err) {
      console.log(`MP-GEN-ERROR ${id} seed=${seed}: ${err.message}`);
      mpFails++; mpTotal++; continue;
    }
    const problems = [];
    if (!q.stem) problems.push('no stem');
    if (!Array.isArray(q.parts) || q.parts.length < 2) problems.push('needs 2+ parts');
    for (const part of q.parts || []) {
      mpTotal++;
      const pb = [];
      if (!part.prompt) pb.push('no prompt');
      if (!part.marks || part.marks < 1) pb.push('no marks');
      if (!Array.isArray(part.steps) || !part.steps.length) pb.push('no steps');
      if (/NaN|undefined|Infinity/.test(`${q.stem} ${part.prompt}`)) pb.push('bad token');
      for (const st of part.steps || []) if (/NaN|undefined|Infinity/.test(`${st.h} ${st.d}`)) pb.push('bad token in step: ' + st.d);
      const synth = { answerType: part.answerType, answer: part.answer, mcqOptions: part.mcqOptions };
      const ci = canonicalInput(synth);
      if (ci === null) pb.push('no canonical input');
      else {
        const res = checkAnswer(synth, ci);
        if (!res.correct) pb.push(`canonical "${ci}" rejected${res.feedback ? ` (${res.feedback})` : ''}`);
      }
      if (pb.length) {
        mpFails++;
        console.log(`MP-FAIL ${id}(${part.key}) seed=${seed}\n  ${pb.join('\n  ')}\n  prompt: ${part.prompt?.slice(0, 120)}`);
        if (mpFails > 30) { console.log('...stopping'); process.exit(1); }
      }
    }
    if (problems.length) { mpFails++; console.log(`MP-FAIL ${id} seed=${seed}: ${problems.join(', ')}`); }
  }
}
if (mpIds.length) console.log(`${mpTotal - mpFails}/${mpTotal} multipart part-checks passed across ${mpIds.length} multipart questions${mpFails ? ` — ${mpFails} FAILURES` : ' ✔'}`);

console.log(`\n${total - fails}/${total} self-checks passed across ${subtopics.length} subtopics${fails ? ` — ${fails} FAILURES` : ' ✔'}`);
process.exit(fails || mpFails ? 1 : 0);
