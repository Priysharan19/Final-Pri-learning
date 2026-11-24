// The isolation scan must FAIL when pack text is in a built client, whatever kind of text it is. This plants each kind in a small dist
// (stock wording of a bundle around it) and requires tools/qbank-isolation-check.mjs's scan to report it; the clean dist must report nothing.
// The planted text is taken from the committed pack, so a change to the pack keeps the plants real.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { scanDist, needlesOf, CHANCE_ANSWERS } from './qbank-isolation-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'server', 'content', 'qbank');
const manifest = JSON.parse(fs.readFileSync(path.join(PACK, 'manifest.json'), 'utf8'));
const questions = manifest.shards.flatMap(s => JSON.parse(fs.readFileSync(path.join(PACK, s.name), 'utf8')).questions);

let pass = 0; const failures = [];
const ok = (cond, message) => { if (cond) pass++; else failures.push(message); };

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-isolation-'));
const stock = 'var a=function(){return"Pri Learning";};export{a as default};\n/* nothing of the question bank */\n'.repeat(5);
const dist = name => {
  const dir = path.join(scratch, name);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Pri Learning</title><script type="module" src="/assets/app.js"></script>');
  return dir;
};
const plant = (name, text) => { const dir = dist(name); fs.writeFileSync(path.join(dir, 'assets', 'app.js'), `${stock}var x=${JSON.stringify(text)};\n`); return dir; };

// the clean dist: nothing
const clean = dist('clean'); fs.writeFileSync(path.join(clean, 'assets', 'app.js'), stock);
ok(scanDist(clean, questions, manifest.packVersion).length === 0, 'a clean dist reports nothing');

// pick questions whose texts are long enough to be needles
const pick = f => questions.find(q => f(q));
const withExprAnswer = pick(q => q.answerType === 'expression' && q.answer.expr.length >= 8 && !CHANCE_ANSWERS.includes(q.answer.expr));
const withTrapWhy = pick(q => q.traps.some(t => t.why.length >= 22));
const withTrapExpr = pick(q => q.traps.some(t => typeof t.expr === 'string' && t.expr.length >= 8));
const withLongStep = pick(q => q.steps.some(s => s.d.length >= 60 && !q.hints.some(h => h.includes(s.d))));
const withHint = pick(q => (q.ladder?.nudge || '').length >= 24);
const withCriterion = pick(q => q.criteria.some(c => c.point.length >= 30));
const withNumeric = pick(q => q.answerType === 'numeric' && String(q.answer.value).length >= 14);

const cases = [
  ['an answer', withExprAnswer.answer.expr],
  ['a long numeric answer', String(withNumeric.answer.value)],
  ['a prompt', withExprAnswer.prompt],
  ['a trap reason', withTrapWhy.traps.find(t => t.why.length >= 22).why],
  ['a trap answer', withTrapExpr.traps.find(t => typeof t.expr === 'string' && t.expr.length >= 8).expr],
  ['a hint', withHint.ladder.nudge],
  ['a criterion', withCriterion.criteria.find(c => c.point.length >= 30).point],
  ['a whole worked step', withLongStep.steps.find(s => s.d.length >= 60).d],
  ['a worked step cut to 39 characters', withLongStep.steps.find(s => s.d.length >= 60).d.slice(0, 39)],
  ['a worked step cut to 20 characters', withLongStep.steps.find(s => s.d.length >= 60).d.slice(10, 30)],
  ['a question id', `x ${withHint.id} y`],
  ['the pack format', 'pri-qbank-pack-v1']
];
for (const [kind, text] of cases) ok(scanDist(plant(kind.replace(/\W+/g, '-'), text), questions, manifest.packVersion).length > 0, `a dist holding ${kind} fails the scan`);

// every answer, trap reason, prompt and truncated step in one file, as the reviewer's counter-example had them
const everything = questions.flatMap(q => [q.prompt, ...(q.traps || []).map(t => t.why), ...q.steps.map(s => s.d.slice(0, 39)), JSON.stringify(q.answer)]).join('\n');
ok(scanDist(plant('everything', everything), questions, manifest.packVersion).length > 0, 'a dist holding every prompt, trap reason, answer and a worked step cut to 39 characters fails the scan');

// The reviewer's two bypasses, and the shapes of them: the whole pack in a file whose extension is not text, the pack compressed, and a script
// that holds nothing but the pack's short answers (no id, no prompt, no key). Each is the real pack's own content, so a change to the pack keeps them real.
const plantFile = (name, file, data) => { const dir = dist(name); fs.writeFileSync(path.join(dir, 'assets', file), data); return dir; };
const packJson = JSON.stringify(questions);
ok(scanDist(plantFile('dat', 'k.dat', packJson), questions, manifest.packVersion).length > 0, 'the whole pack JSON in assets/k.dat (an extension that is not text) fails the scan');
ok(scanDist(plantFile('gz', 'k.bin', zlib.gzipSync(packJson)), questions, manifest.packVersion).length > 0, 'the pack gzipped in assets/k.bin fails the scan');
ok(scanDist(plantFile('br', 'k.br', zlib.brotliCompressSync(packJson)), questions, manifest.packVersion).length > 0, 'the pack brotli-compressed in assets/k.br fails the scan');
ok(scanDist(plantFile('nokeys', 'k.dat', JSON.stringify(questions.map(q => ({ answer: q.answer })))), questions, manifest.packVersion).length > 0, 'the pack answers alone, with no id, prompt or text, in a .dat file fail the scan');
const shortNumeric = questions.filter(q => q.answerType === 'numeric' && String(q.answer.value).length <= 6).map(q => q.answer.value);
ok(shortNumeric.length > 500, `the pack has ${shortNumeric.length} short numeric answers for the bypass below`);
ok(scanDist(plantFile('shortjs', 'a.js', `${stock}var n=[${shortNumeric.join(',')}];\n`), questions, manifest.packVersion).length > 0, `a script holding ${shortNumeric.length} short numeric answers, in the pack's order, fails the scan`);
const shuffled = [...shortNumeric].map((v, i) => [(i * 7919) % shortNumeric.length, v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
ok(scanDist(plantFile('shuffled', 'a.js', `${stock}var n=[${shuffled.map(v => JSON.stringify(String(v))).join(',')}];\n`), questions, manifest.packVersion).length > 0, 'and the same answers quoted and shuffled fail it too');
// false positives: ordinary code that holds numbers is not the pack
ok(scanDist(plantFile('tables', 'tables.js', `${stock}var w=[${Array.from({ length: 400 }, (_, i) => (i * 37) % 1000).join(',')}];var f=[${Array.from({ length: 300 }, (_, i) => i).join(',')}];\n`), questions, manifest.packVersion).length === 0, 'tables of whole numbers in a script are not reported');

const { needles, runs } = needlesOf(questions);
ok(needles.length > 5000 && runs.size > 20000, `the scan has needles for every kind (${needles.length}, ${runs.size} step runs)`);
fs.rmSync(scratch, { recursive: true, force: true });

if (failures.length) { console.error(`QBANK ISOLATION TEST: FAIL ${failures.length}\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`QBANK ISOLATION TEST: PASS ${pass}/${pass} checks`);
