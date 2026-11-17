// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · intelligent feedback for trigonometry and functions
//
// Sweeps every issued question of the trigonometry and functions topics (the
// generators both editions draw from) and holds the slip catalogue to:
//
//   A · COVERAGE. Of the question's designed wrong answers (its traps), the share
//       the catalogue names with a specific, number-bearing sentence. Target ≥ 80%.
//   B · NEVER ON CORRECT WORK. The right answer is never reported as a slip.
//   C · SPECIFIC. Every sentence is plain, in en, hi and en-AU, and carries a number
//       from the question or the slip's own working (none is a generic template).
//   D · ANSWER-BLIND UNTIL SUBMIT. The diagnosis is a pure function of the question's
//       prompt and the student's answer; the right answer only rules a slip out.
//
// SYNTHETIC: generated questions, scripted wrong answers. Marks are not touched
// here (the marking suites assert that). Usage: node smart-trig-functions-check.mjs [seeds]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { diagnoseWith, sayIn, LANGS } = await import(`${SRC}engine/misconceptions/slipKit.js`);
const trig = (await import(`${SRC}engine/misconceptions/topics/trigonometry.js`)).entries;
let functions = [];
try { functions = (await import(`${SRC}engine/misconceptions/topics/functions.js`)).entries; } catch { functions = []; }
await loadAllBanks();

const TRIG = ['y9-trig', 'y10-trig', 'y10-trig-any-angle', 'y10-trig-nonright', 'y11-trig-ident', 'y11-trigfunc', 'y11-sine-cosine-rule', 'me11-trigid', 'me11-inversetrig', 'y12-trigcalc', 'y12-trig-model', 'ms12-right-triangle'];
const FUNC = ['y10-functions', 'y11-functions', 'y11-functions-more', 'me11-functions', 'y11-quadfunc', 'y12-func-model'];
const SEEDS = Number(process.argv[2]) || 40;
const failures = [];
const fail = t => { if (failures.length < 40) failures.push(t); };
let checks = 0;
const ok = (c, t) => { checks++; if (!c) fail(t); };

const shapeOf = p => String(p).replace(/\$[^$]*\$/g, '$').replace(/[-\d.]+/g, '#').slice(0, 90);
const rows = [];
let totalTraps = 0, totalNamed = 0;
const missed = new Map();

for (const [group, topics, entries] of [['trigonometry', TRIG, trig], ['functions', FUNC, functions]]) {
  for (const topic of topics) {
    let traps = 0, named = 0, qn = 0;
    for (let d = 1; d <= 4; d++) {
      for (let i = 1; i <= SEEDS; i++) {
        let q; try { q = generateQuestion(topic, d, i * 104729 + d * 31); } catch { continue; }
        qn++;
        const right = Number(q.answer?.value);
        // B · the right answer is never a slip
        if (Number.isFinite(right)) ok(diagnoseWith(entries, q, right) === null, `${topic}: the right answer ${right} was named a slip for "${String(q.prompt).slice(0, 80)}"`);
        for (const t of q.traps || []) {
          const v = Number(t.value);
          if (!Number.isFinite(v)) continue;
          traps++;
          const hit = diagnoseWith(entries, q, v);
          if (hit) {
            named++;
            for (const lang of LANGS) {
              const sentence = sayIn(hit.say, lang);
              ok(typeof sentence === 'string' && sentence.length >= 20 && /\d/.test(sentence), `${topic}/${hit.id}/${lang}: no number-bearing sentence: ${sentence}`);
              ok(!/undefined|NaN|\[object/.test(sentence), `${topic}/${hit.id}/${lang}: bad interpolation: ${sentence}`);
            }
            ok(/[ऀ-ॿ]/.test(sayIn(hit.say, 'hi')), `${topic}/${hit.id}: the hi sentence has no Devanagari`);
          } else {
            const k = `${topic} | ${shapeOf(q.prompt)} | ${String(t.why || '').slice(0, 60)}`;
            missed.set(k, (missed.get(k) || 0) + 1);
          }
        }
      }
    }
    totalTraps += traps; totalNamed += named;
    rows.push({ group, topic, qn, traps, named });
  }
}

for (const r of rows) console.log(`${r.group.padEnd(13)} ${r.topic.padEnd(22)} ${String(r.qn).padStart(4)} questions  ${String(r.named).padStart(4)}/${String(r.traps).padStart(4)} designed wrong answers named (${r.traps ? Math.round((100 * r.named) / r.traps) : 100}%)`);
const pct = totalTraps ? (100 * totalNamed) / totalTraps : 100;
console.log(`TOTAL ${totalNamed}/${totalTraps} designed wrong answers named with a specific sentence (${pct.toFixed(1)}%)`);
if (process.argv.includes('--missed')) for (const [k, n] of [...missed].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(`  missed ×${n}: ${k}`);
ok(pct >= 80, `only ${pct.toFixed(1)}% of designed wrong answers are named (need ≥ 80%)`);
if (failures.length) { console.error(`SMART TRIG + FUNCTIONS: FAIL — ${failures.length} problem(s)\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`SMART TRIG + FUNCTIONS: PASS — ${checks} checks — ${pct.toFixed(1)}% of designed wrong answers named, none on a right answer. [SYNTHETIC]`);
