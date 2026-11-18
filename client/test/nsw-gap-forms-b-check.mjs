// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms B: independent answer check
//   y12-financial D1 (annuities)   me11-comb D4 (harder counting)
// Every generated key is RE-DERIVED by a different method, from the numbers in the
// prompt text only: annuities by a period-by-period balance simulation (not the
// closed form), counting problems by brute-force enumeration of the actual
// arrangements / selections / assignments. The key must then be accepted by the
// deterministic marker, no listed trap may equal (or be accepted as) the key, and no
// hint may state the final answer.
// SYNTHETIC: in-process generated questions; no evidence about real students.
// Usage: node client/test/nsw-gap-forms-b-check.mjs [seeds]
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
await loadAllBanks();

const SEEDS = Number(process.argv.find(a => /^\d+$/.test(a))) || 1200;
let failures = 0;
const fails = [];
const fail = (cell, seed, msg, q) => { failures++; if (fails.length < 40) fails.push(`${cell} seed ${seed}: ${msg}${q ? `\n    ${String(q.prompt).slice(0, 200)}` : ''}`); };
const hasBad = o => /undefined|NaN|\[object|Infinity/.test(JSON.stringify(o));
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));
const mathSegments = p => [...String(p).matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
const money = p => Number((String(p).match(/\\\$([\d,]+\.\d\d)/) || [])[1]?.replace(/,/g, ''));
const skeleton = p => String(p).replace(/-?\d+(\.\d+)?/g, '#').replace(/\b[A-Z]{4,}\b/g, 'W').replace(/\s+/g, ' ');

function keyText(q) {
  const a = q.answer;
  if (q.answerType === 'mcq') return String(a.correctIndex);
  return a.canonicalInput || String(a.value);
}
function commonChecks(cell, seed, q, finals) {
  if (hasBad(q)) fail(cell, seed, 'undefined/NaN in question', q);
  if (!q.hints || q.hints.length < 3) fail(cell, seed, 'fewer than 3 hints', q);
  if (!q.steps || q.steps.length < 2) fail(cell, seed, 'fewer than 2 steps', q);
  let v;
  try { v = checkAnswer(q, keyText(q)); } catch (e) { v = { correct: false, feedback: `threw ${e.message}` }; }
  if (!v.correct) fail(cell, seed, `marker refused its own key "${keyText(q)}": ${v.feedback || ''}`, q);
  for (const t of q.traps || []) {
    if (q.answer?.value !== undefined && near(t.value, q.answer.value, 1e-9)) fail(cell, seed, `trap equals key (${t.value})`, q);
    let tv; try { tv = checkAnswer(q, String(t.value)); } catch { tv = { correct: false }; }
    if (tv.correct) fail(cell, seed, `marker accepts trap value ${t.value}`, q);
  }
  if (q.answerType === 'mcq') {
    if (new Set(q.mcqOptions).size !== q.mcqOptions.length) fail(cell, seed, 'duplicate options', q);
    if (q.mcqOptions.length < 3) fail(cell, seed, 'fewer than 3 options', q);
  }
  // hints never state the final answer
  for (const f of new Set(finals)) {
    if (f.length < 3) continue;
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\d.,])${esc}(?![\\d.]|,\\d)`);
    for (const h of q.hints || []) if (re.test(h)) fail(cell, seed, `hint contains the final answer "${f}": ${h}`, q);
  }
}
const fmtVariants = v => { const s = String(v); const withCommas = Number.isInteger(v) ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s; return [s, withCommas, Number(v).toFixed(2)]; };

const cells = {};
function sweep(id, diff, classify, check) {
  const cell = `${id} D${diff}`;
  const forms = new Map(), skels = new Set();
  let n = 0, foreign = 0;
  const dps = new Set();
  for (let seed = 1; seed <= SEEDS; seed++) {
    let q;
    try { q = generateQuestion(id, diff, seed * 7919 + 13); } catch (e) { fail(cell, seed, `generator threw ${e.message}`); continue; }
    if (q.dotpointSource !== 'payload') { foreign++; continue; }
    n++;
    dps.add(q.dotpoint);
    skels.add(skeleton(q.prompt));
    let form;
    try { form = classify(q.prompt); } catch { form = null; }
    if (!form) { fail(cell, seed, 'unrecognised prompt form', q); continue; }
    forms.set(form, (forms.get(form) || 0) + 1);
    try { check(cell, seed, q, form); } catch (e) { fail(cell, seed, `check threw ${e.stack || e.message}`, q); }
  }
  cells[cell] = { n, forms: forms.size, skels: skels.size, foreign, dps: [...dps].sort(), detail: [...forms].map(([k, v]) => `${k}:${v}`).join(' ') };
  if (forms.size < 4) fail(cell, 0, `only ${forms.size} distinct forms (need >= 4)`);
  if (n < SEEDS * 0.2) fail(cell, 0, `only ${n} payload draws of ${SEEDS}`);
}

// ═════════════ y12-financial D1: period-by-period balance simulation
/** Balance after `deposits` end-of-period deposits of `a`, rate `r` per period, simulated step by step. */
function simulate(a, r, deposits) {
  let bal = 0;
  for (let p = 1; p <= deposits; p++) { bal = bal * (1 + r); bal += a; }   // interest on what is there, then the deposit
  return bal;
}
const cent = v => Math.round(v * 100 + 1e-7) / 100;
const finClass = p => {
  if (/first deposit is made at the end of year 1/.test(p)) return 'first-deposit';
  if (/immediately after the third deposit/.test(p)) return 'three-deposit-sum';
  if (/immediately after the second deposit/.test(p)) return 'monthly-two';
  if (/common ratio/.test(p)) return 'ratio';
  if (/How many terms/.test(p)) return 'terms';
  if (/interest rate per/.test(p)) return 'rate-per-period';
  if (/How many deposits are made/.test(p)) return 'n-deposits';
  if (/annuity factors/.test(p)) return 'factor-table';
  if (/Which expression/.test(p)) return 'mcq-series';
  return null;
};
sweep('y12-financial', 1, finClass, (cell, seed, q, form) => {
  const p = q.prompt;
  if (q.dotpointSource !== 'payload' || !['y12-financial.1', 'y12-financial.2'].includes(q.dotpoint)) fail(cell, seed, `dot point ${q.dotpoint}, want ordinal 0 or 1`, q);
  const a = money(p);
  const pct = Number((p.match(/\$(\d+(?:\.\d+)?)\\%\$/) || [])[1]);
  const finals = [];
  let want;
  if (form === 'first-deposit') {
    const n = Number(p.match(/end of year \$(\d+)\$/)[1]);
    // one deposit at the end of year 1, then n−1 years of interest, year by year
    let bal = a; for (let y = 2; y <= n; y++) bal *= 1 + pct / 100;
    want = cent(bal);
  } else if (form === 'three-deposit-sum') {
    want = cent(simulate(a, pct / 100, 3));
  } else if (form === 'monthly-two') {
    want = cent(simulate(a, pct / 1200, 2));
  } else if (form === 'ratio' || form === 'terms') {
    const seg = mathSegments(p)[0];
    const terms = seg.replace(/\\cdots/, '@').split(' + ');
    const parse = t => { const m = t.match(/^(\d+)(?:\((\d+\.\d+)\))?(?:\^\{?(\d+)\}?)?$/); return m ? { a: Number(m[1]), g: m[2] ? Number(m[2]) : null, e: m[3] ? Number(m[3]) : (m[2] ? 1 : 0) } : null; };
    const first = parse(terms[0]), second = parse(terms[1]), last = parse(terms[terms.length - 1]);
    if (form === 'ratio') want = Math.round((second.a * second.g / first.a) * 1e6) / 1e6;
    else { let c = 0; for (let e = 0; e <= last.e; e++) c++; want = c; }
  } else if (form === 'rate-per-period' || form === 'n-deposits') {
    const monthly = /month/.test(p.split('?')[0]) && /compounded monthly/.test(p);
    const yrs = Number(p.match(/for (\d+) years/)[1]);
    if (form === 'rate-per-period') {
      let periodsInYear = 0; for (let k = 0; k < 12; k++) if (monthly || k % 3 === 0) periodsInYear++;
      want = Math.round(pct / periodsInYear * 1e6) / 1e6;
    } else {
      let c = 0; for (let m = 1; m <= yrs * 12; m++) if (monthly || m % 3 === 0) c++;
      want = c;
    }
  } else if (form === 'factor-table') {
    const F = Number(p.match(/= (\d+\.\d+)\$ for/)[1]);
    const r = Number(p.match(/r = (0\.\d+)\$/)[1]), n = Number(p.match(/n = (\d+)\$/)[1]);
    const Fsim = simulate(1, r, n);
    if (Math.abs(Fsim - F) > 5.1e-5) fail(cell, seed, `table factor ${F} ≠ simulated ${Fsim}`, q);
    want = Math.round(a * F);
    if (!near(r * 100, pct, 1e-9)) fail(cell, seed, 'rate in table text ≠ rate in question', q);
  } else if (form === 'mcq-series') {
    const n = Number(p.match(/for \$(\d+)\$ years/)[1]);
    const truth = simulate(a, pct / 100, n);
    const ev = t => new Function(`return (${t.replace(/\$/g, '').replace(/\^/g, '**').replace(/(\d)\(/g, '$1*(')});`)();
    const vals = q.mcqOptions.map(ev);
    vals.forEach((v, i) => { if (i === q.answer.correctIndex ? !near(v, truth, 1e-9) : near(v, truth, 1e-9)) fail(cell, seed, `option ${i} value ${v} vs simulated ${truth}`, q); });
    if (q.mcqOptions.length < 4) fail(cell, seed, 'expected 4 options', q);
    commonChecks(cell, seed, q, []);
    return;
  }
  if (q.answerType !== 'numeric') return fail(cell, seed, 'expected numeric', q);
  if (!near(q.answer.value, want, 1e-9)) fail(cell, seed, `key ${q.answer.value} ≠ re-derived ${want} (${form})`, q);
  if (/nearest cent/.test(p) && !(q.answer.tol < 0.005 + 0.002 && q.answer.tol >= 0.005)) fail(cell, seed, `cent tolerance ${q.answer.tol}`, q);
  if (/nearest dollar/.test(p) && !(q.answer.tol < 0.5 + 0.02 && q.answer.tol >= 0.5)) fail(cell, seed, `dollar tolerance ${q.answer.tol}`, q);
  if (q.answerPrefix === undefined && /nearest/.test(p)) fail(cell, seed, 'money answer without $ prefix', q);
  if (/%/.test(String(q.answerSuffix || '')) && /% p\.a/.test(q.answerSuffix)) fail(cell, seed, 'bad suffix', q);
  // the printed key rounds to the unit named in the prompt: the exact value must not sit near a rounding boundary
  if (/nearest cent/.test(p)) { /* checked in-generator via nearHalfCent */ }
  // marker: a value one cent / one dollar out must be refused
  const off = checkAnswer(q, String(want + (/nearest dollar/.test(p) ? 1 : 0.01)));
  if (q.answer.tol != null && off.correct) fail(cell, seed, 'marker accepted an answer one unit off', q);
  for (const v of [want]) finals.push(...fmtVariants(v));
  commonChecks(cell, seed, q, finals);
});

// ═════════════ me11-comb D4: brute-force enumeration
const permsOf = (items, k, cb, used = [], cur = []) => {
  if (cur.length === k) return cb(cur);
  for (let i = 0; i < items.length; i++) { if (used[i]) continue; used[i] = true; cur.push(items[i]); permsOf(items, k, cb, used, cur); cur.pop(); used[i] = false; }
};
const combosOf = (n, k, cb, start = 0, cur = []) => {
  if (cur.length === k) return cb(cur);
  for (let i = start; i < n; i++) { cur.push(i); combosOf(n, k, cb, i + 1, cur); cur.pop(); }
};
const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

const combClass = p => {
  if (/no two vowels are next to each other/.test(p)) return 'letters-gaps';
  if (/numbers greater than/.test(p) && /even/.test(p)) return 'digits-even-greater';
  if (/-digit numbers that are (even|odd|divisible by 5)/.test(p)) return 'digits-parity';
  if (/refuse to serve on the same committee/.test(p)) return 'committee-pair';
  if (/Mr Rao is one of the men/.test(p)) return 'committee-named-atleast';
  if (/different triangles/.test(p)) return 'points-triangles';
  if (/different straight lines/.test(p)) return 'points-lines';
  if (/labelled teams/.test(p) && /Anna and Ben/.test(p)) return 'teams-together';
  if (/labelled teams/.test(p)) return 'teams-sizes';
  if (/two married couples/.test(p)) return 'circle-couples';
  if (/circular table/.test(p) && /next to one another/.test(p)) return 'circle-block';
  return null;
};
sweep('me11-comb', 4, combClass, (cell, seed, q, form) => {
  const p = q.prompt;
  const want = { value: null };
  const ints = [...p.replace(/\$/g, ' ').matchAll(/\b(\d+)\b/g)].map(m => Number(m[1]));
  const dpWant = { 'letters-gaps': 'me11-comb.1', 'digits-even-greater': 'me11-comb.1', 'digits-parity': 'me11-comb.1', 'circle-couples': 'me11-comb.1', 'circle-block': 'me11-comb.1' };
  if (q.dotpoint !== (dpWant[form] || 'me11-comb.2')) fail(cell, seed, `dot point ${q.dotpoint} unexpected for ${form}`, q);
  if (form === 'letters-gaps') {
    const w = p.match(/word ([A-Z]+)/)[1];
    want.value = memo(`w${w}`, () => { let c = 0; if (new Set(w).size !== w.length) throw new Error('repeated letters'); permsOf([...w], w.length, s => { for (let i = 0; i + 1 < s.length; i++) if ('AEIOU'.includes(s[i]) && 'AEIOU'.includes(s[i + 1])) return; c++; }); return c; });
  } else if (form === 'digits-parity' || form === 'digits-even-greater') {
    const k = Number(p.match(/(\d+)-digit/)[1]);
    const ds = mathSegments(p).find(s => /^\d(, \d)+$/.test(s)).split(', ').map(Number);
    const T = form === 'digits-even-greater' ? Number(mathSegments(p).find(s => /^\d{4}$/.test(s))) : 0;
    const kind = /divisible by 5/.test(p) ? 5 : /odd/.test(p) ? 1 : 2;
    let c = 0;
    permsOf(ds, k, s => {
      if (s[0] === 0) return;
      const v = Number(s.join(''));
      if (kind === 2 ? v % 2 !== 0 : kind === 1 ? v % 2 !== 1 : v % 5 !== 0) return;
      if (v <= T) return;
      c++;
    });
    want.value = c;
  } else if (form === 'committee-pair') {
    const [k, m, w, , g] = [ints[0], ints[1], ints[2], 0, ints[3]];
    // men 0..m−1 (Mr Ngo = 0), women m..m+w−1 (Ms Lee = m)
    let c = 0;
    combosOf(m + w, k, s => { const women = s.filter(x => x >= m).length; if (women !== g) return; if (s.includes(0) && s.includes(m)) return; c++; });
    want.value = c;
  } else if (form === 'committee-named-atleast') {
    const [k, m, w] = ints;
    let c = 0;
    combosOf(m + w, k, s => { if (!s.includes(0)) return; if (s.filter(x => x >= m).length < 2) return; c++; });
    want.value = c;
  } else if (form === 'points-triangles' || form === 'points-lines') {
    const [n, k] = ints;
    if (form === 'points-triangles') { let c = 0; combosOf(n, 3, s => { if (s.every(x => x < k)) return; c++; }); want.value = c; }
    else { const lines = new Set(); combosOf(n, 2, s => lines.add(s[0] < k && s[1] < k ? 'L' : s.join('-'))); want.value = lines.size; }
  } else if (form === 'teams-sizes' || form === 'teams-together') {
    const [m, s1, s2, s3] = ints;
    if (s1 + s2 + s3 !== m) throw new Error('team sizes do not sum');
    const sizes = [s1, s2, s3];
    let c = 0;
    const asg = new Array(m).fill(0);
    const rec = i => {
      if (i === m) { const cnt = [0, 0, 0]; for (const t of asg) cnt[t]++; if (cnt.every((x, j) => x === sizes[j]) && (form === 'teams-sizes' || asg[0] === asg[1])) c++; return; }
      for (let t = 0; t < 3; t++) { asg[i] = t; rec(i + 1); }
    };
    rec(0);
    want.value = c;
  } else if (form === 'circle-block' || form === 'circle-couples') {
    const n = ints[0];
    const k = form === 'circle-block' ? ints[1] : 0;
    want.value = memo(`c${form}${n}${k}`, () => {
      let c = 0;
      const others = [...Array(n).keys()].slice(1);
      permsOf(others, n - 1, s => {
        const seat = [0, ...s];                                   // guest 0 fixed at seat 0 removes rotations
        const pos = new Array(n); seat.forEach((g, i) => { pos[g] = i; });
        const adj = (a, b) => { const d = Math.abs(pos[a] - pos[b]); return d === 1 || d === n - 1; };
        if (form === 'circle-couples') { if (adj(0, 1) && adj(2, 3)) c++; return; }
        // block of k particular guests (0..k−1) occupying k consecutive seats around the circle
        const occupied = [...Array(k).keys()].map(g => pos[g]).sort((x, y) => x - y);
        let run = false;
        for (let start = 0; start < n && !run; start++) {
          const set = new Set(); for (let j = 0; j < k; j++) set.add((start + j) % n);
          if (occupied.every(x => set.has(x))) run = true;
        }
        if (run) c++;
      });
      return c;
    });
  }
  if (q.answerType !== 'numeric') return fail(cell, seed, 'expected numeric', q);
  if (q.answer.value !== want.value) fail(cell, seed, `key ${q.answer.value} ≠ enumerated ${want.value} (${form})`, q);
  if (!Number.isInteger(q.answer.value) || q.answer.value <= 0) fail(cell, seed, 'key not a positive whole number', q);
  if (/pigeon/i.test(p)) fail(cell, seed, 'pigeonhole wording', q);
  commonChecks(cell, seed, q, fmtVariants(q.answer.value));
});

// ── summary ─────────────────────────────────────────────────────────────────
for (const [cell, v] of Object.entries(cells)) {
  const ok = v.forms >= 4;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${cell.padEnd(16)} ${v.n} questions, ${v.forms} forms (${v.skels} prompt skeletons), ordinals ${v.dps.join('/')}${v.foreign ? `, +${v.foreign} draws of other pre-existing forms (not checked)` : ''}\n        ${v.detail}`);
}
if (failures) { console.log(`\n${failures} failure(s):`); for (const f of fails) console.log(' - ' + f); console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS: all keys re-derived independently (simulation / brute force), marker accepts every key, no trap equals the key, no hint leaks the answer.');
