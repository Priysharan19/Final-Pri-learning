// ─────────────────────────────────────────────────────────────────────────────
// REAL-INK suite — the only number here that is not simulated.
//
// Every other inkcheck in this directory scores the engine against ink this
// repo generated itself. That measures the generator as much as the recogniser:
// synthetic strokes carry the same assumptions the recogniser was built on, so
// a high score there is necessary but not sufficient. This file scores against
// handwriting a person actually produced with a Pencil.
//
// It reads every corpus recorded by tools/ink-collect/index.html and dropped
// into client/test/ink-corpus/. With no corpus present it reports that plainly
// and exits clean — it never invents a score, and an empty corpus directory is
// never reported as a pass.
//
// Usage: node client/test/inkcheck-real.mjs [--strict]
//        --strict makes an empty corpus a failure (use once data exists)
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recognize } from '../src/ink/recognizer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(HERE, 'ink-corpus');
const STRICT = process.argv.includes('--strict');

// No target is excluded. If the engine cannot read what a student wrote, that
// counts against it — the headline number owes the student a fair reading.

const editDistance = (a, b) => {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

function loadCorpora() {
  if (!existsSync(CORPUS_DIR)) return [];
  return readdirSync(CORPUS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const raw = JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf8'));
      if (raw.format !== 'pri-ink-corpus') {
        throw new Error(`${f} is not a pri-ink-corpus file (format: ${raw.format})`);
      }
      return { file: f, ...raw };
    });
}

const corpora = loadCorpora();

if (!corpora.length) {
  console.log('\nReal-ink suite — no corpus recorded yet.\n');
  console.log('  client/test/ink-corpus/ is empty, so there is NO real-handwriting');
  console.log('  score for this engine. Every accuracy figure the project reports');
  console.log('  is currently measured on synthetic ink.\n');
  console.log('  To fix that: open tools/ink-collect/index.html on the iPad, write');
  console.log('  the 60 prompts with the Pencil, save the file into');
  console.log('  client/test/ink-corpus/, and run this suite again.\n');
  console.log('REAL-INK SCORE — none (no corpus)');
  process.exit(STRICT ? 1 : 0);
}

let exact = 0, lines = 0, chars = 0, errs = 0;
const perWriter = [];
const misreads = [];
let fingerWriters = 0;

for (const c of corpora) {
  let wExact = 0, wLines = 0, wChars = 0, wErrs = 0;
  if (!c.writer?.pen) fingerWriters++;

  for (const s of c.samples || []) {
    if (!s.strokes?.length) continue;
    const want = String(s.target).replace(/\s+/g, '');
    let got;
    try {
      got = recognize(s.strokes).text.replace(/\s+/g, '');
    } catch (err) {
      got = `<threw: ${err.message}>`;
    }
    lines++; wLines++;
    if (got === want) { exact++; wExact++; }
    else if (misreads.length < 20) misreads.push(`${c.writer.id} want "${want}"  got "${got}"`);
    chars += want.length; wChars += want.length;
    const d = editDistance(want, got);
    errs += d; wErrs += d;
  }

  perWriter.push({
    id: c.writer.id, pen: !!c.writer.pen, wExact, wLines,
    charPct: wChars ? 100 * (1 - wErrs / wChars) : 0
  });
}

if (!lines) {
  console.log('\nReal-ink suite — corpus files found but they contain no strokes.\n');
  console.log('REAL-INK SCORE — none (empty corpus)');
  process.exit(STRICT ? 1 : 0);
}

console.log('\nReal ink: handwriting captured from people, not generated\n');
for (const p of perWriter) {
  console.log(
    `  ${p.id.padEnd(8)} ${String(p.wExact).padStart(3)}/${String(p.wLines).padEnd(3)} exact` +
    `   chars ${p.charPct.toFixed(1)}%   ${p.pen ? 'pencil' : 'FINGER'}`
  );
}

const exactPct = 100 * exact / lines;
const charPct = 100 * (1 - errs / chars);
const worst = Math.min(...perWriter.map(p => p.wExact / p.wLines));

console.log(`\n  REAL INK   exact ${exact}/${lines} (${exactPct.toFixed(1)}%)   chars ${charPct.toFixed(1)}%`);

if (misreads.length) {
  console.log('\nsample misreads:');
  for (const m of misreads) console.log('  ' + m);
}

console.log(`\n  writers: ${perWriter.length}${fingerWriters ? ` (${fingerWriters} finger-written — treat separately)` : ''}`);
console.log(`  worst writer: ${(100 * worst).toFixed(0)}% exact`);
console.log(`\nREAL-INK SCORE — ${exactPct.toFixed(1)}% lines, ${charPct.toFixed(1)}% chars, worst writer ${(100 * worst).toFixed(0)}%`);

// A corpus this small is a signal, not a verdict. Say so rather than letting a
// number from three friends get quoted as a product claim.
if (perWriter.length < 5) {
  console.log(`\n  NOTE: ${perWriter.length} writer(s) is too few to quote as a product figure.`);
  console.log('        Aim for 8+ hands before treating this as the headline number.');
}
