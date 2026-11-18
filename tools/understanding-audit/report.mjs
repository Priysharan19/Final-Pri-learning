// Turns the runner's per-line rows into the evidence report (markdown).

const pct = (n, d) => (d ? `${(100 * n / d).toFixed(1)}%` : 'n/a');
const SCORED = new Set(['valid', 'break', 'follows']);

export function metrics(rows) {
  const m = { lines: 0, valid: 0, brk: 0, follows: 0, neutral: 0, verdict: 0, ticked: 0, falseCross: 0, caught: 0, falseTick: 0, followsTicked: 0, followsBroken: 0, neutralVerdict: 0 };
  for (const r of rows) {
    m.lines++;
    const v = r.status === 'ok' || r.status === 'break';
    if (r.truth === 'neutral') { m.neutral++; if (v) m.neutralVerdict++; continue; }
    if (SCORED.has(r.truth) && v) m.verdict++;
    if (r.truth === 'valid') { m.valid++; if (r.status === 'ok') m.ticked++; if (r.status === 'break') m.falseCross++; }
    else if (r.truth === 'break') { m.brk++; if (r.status === 'break') m.caught++; if (r.status === 'ok') m.falseTick++; }
    else if (r.truth === 'follows') { m.follows++; if (r.status === 'ok') m.followsTicked++; if (r.status === 'break') m.followsBroken++; }
  }
  m.scored = m.valid + m.brk + m.follows;
  return m;
}

const row = (name, m) => `| ${name} | ${m.scored} | ${pct(m.verdict, m.scored)} | ${pct(m.ticked, m.valid)} | ${m.falseCross} | ${m.brk ? pct(m.caught, m.brk) : 'n/a'} | ${m.falseTick} |`;
const HEAD = '| Group | Scored lines | Any verdict | Correct lines ticked | False crosses | Wrong lines caught at the right line | FALSE TICKS |\n|---|---:|---:|---:|---:|---:|---:|';

// Why a line got no verdict: structural features of the line, first match wins.
const REASONS = [
  ['cascade: an earlier line of the same working was already crossed or slipped', (t, r) => /^(Follows from the earlier slip|This line does not follow from the line above)/.test(r.note || '')],
  ['starts with a "∴" / "so" / "hence" / "therefore" prefix', t => /^(∴|so\b|hence\b|therefore\b|thus\b)/i.test(t)],
  ['continuation line starting with "="', t => /^=/.test(t)],
  ['substitution line ("when …", "let …")', t => /^(when|let|put|sub)\b/i.test(t)],
  ['function / point evaluation ("f(2) = …", "P(-3) = …")', t => /^[A-Za-z]'?\([^)]*\)\s*=/.test(t)],
  ['inequality or chained comparison', t => /[<>≤≥]/.test(t)],
  ['word label before the value ("max = …", "x-int: …", "ans = …")', t => /^[A-Za-z][A-Za-z' ().-]{2,}\s*[:=]/.test(t) && !/^[A-Za-z]\s*[:=]/.test(t)],
  ['units / words after the number ("= 27 m", "72 °", "10 years")', t => /\d\s*[A-Za-z°%²]+\s*$/.test(t) && /[A-Za-z]{2,}\s*$|°\s*$/.test(t)],
  ['line judged to be off the answer path ("this question\u2019s check covers the lines that lead to the answer")', (t, r) => /covers the lines that lead to the answer/.test(r.note || '')],
  ['line is about a letter other than the question\u2019s unknown', (t, r) => /about another letter/.test(r.note || '')],
  ['"couldn\u2019t read the solution list / derivative line safely" (sets, lists, derivatives)', (t, r) => /couldn.t read the (solution list|this derivative line)/.test(r.note || '') || /Skipped/.test(r.note || '')],
  ['prose sentence', t => (t.match(/[A-Za-z]{3,}/g) || []).length >= 3 && !/[=+×÷^]/.test(t)],
  ['bare number (value stated, no derivation)', t => /^-?\d+(\.\d+)?$/.test(t)],
  ['expression only, no "=" (not an equation)', t => !/=/.test(t)],
  ['equation with a symbol the question never introduces (template/formula line)', null],
  ['single-letter variable equation ("x = 35", "a = 10") not matching an expected step', t => /^[A-Za-z]\s*=\s*[^=]+$/.test(t)],
  ['multi-"=" chain (a = b = c)', t => (t.match(/=/g) || []).length >= 2],
  ['equation, other form', t => /=/.test(t)]
];
export function reasonOf(r) {
  for (const [name, test] of REASONS) {
    if (!test) { if (r.template) return name; continue; }
    if (test(r.text, r)) return name;
  }
  return 'other';
}

const norm = s => String(s).replace(/-?\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim();
function topReasons(rows, n = 15) {
  const by = new Map();
  for (const r of rows) {
    const k = reasonOf(r);
    const e = by.get(k) || { n: 0, ex: r.text, style: r.style };
    e.n++; by.set(k, e);
  }
  return [...by.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, n);
}
function topNotes(rows, n = 15) {
  const by = new Map();
  for (const r of rows) {
    const k = norm(r.note || '(no reason given)');
    const e = by.get(k) || { n: 0, ex: r.text };
    e.n++; by.set(k, e);
  }
  return [...by.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, n);
}
const esc = s => String(s).replace(/\|/g, '\\|');
const group = (rows, f) => { const g = new Map(); for (const r of rows) { const k = f(r); (g.get(k) || g.set(k, []).get(k)).push(r); } return g; };

export function buildReport({ rows, transcripts, familyInfo }) {
  const sup = rows.filter(r => r.supported);
  const noTemplate = rows.filter(r => !r.template);
  const supNoT = sup.filter(r => !r.template);
  const fams = Object.keys(familyInfo);
  const supFams = fams.filter(f => familyInfo[f].supported > 0);
  const out = [];
  const w = s => out.push(s);

  w('# Understanding audit, 2026-11-18');
  w('');
  w('**What this measures.** For every question family in both editions, how often the deterministic step checker (`stepCheck`, called the way the server calls it in `server/platform/markerOps.js`: `stepMetaFor(q)` then `stepCheck(meta, lines, { prompt })`) says anything about a line of student working, and whether what it says is right.');
  w('');
  w('**This is a synthetic corpus.** Every transcript is built by fixed rules from the generator\'s own authored solution steps (`q.steps`), with no language model and no real student. It shows how the checker treats well-formed, correct working written in common styles. It is not a measure of how real students write, of handwriting recognition, or of learning. Real student working will be messier. Treat every rate below as an optimistic bound on silence.');
  w('');
  w('Reproduce: `node tools/understanding-audit/run.mjs` (deterministic; fixed seeds; about a minute). Tool: `tools/understanding-audit/`.');
  w('');

  {
    const a = metrics(rows), b = metrics(sup);
    const qT = fams.reduce((n, f) => n + familyInfo[f].questions, 0), qS = fams.reduce((n, f) => n + familyInfo[f].supported, 0);
    w('## Key numbers');
    w('');
    w(`- ${pct(qT - qS, qT)} of generated questions have no step check at all: the server never judges a line of their working.`);
    w(`- Over all working lines in the corpus, ${pct(a.verdict, a.scored)} get any verdict and ${pct(a.ticked, a.valid)} of correct lines are ticked.`);
    w(`- Where the step check does run, ${pct(b.verdict, b.scored)} of lines get a verdict, ${pct(b.ticked, b.valid)} of correct lines are ticked, ${b.falseCross} correct lines are crossed, ${b.caught} of ${b.brk} slipped lines are caught at the right line, and ${b.falseTick} wrong lines are ticked.`);
    w('');
  }
  // ── Layer 1: is there any step check at all
  const qTotal = fams.reduce((n, f) => n + familyInfo[f].questions, 0);
  const qSup = fams.reduce((n, f) => n + familyInfo[f].supported, 0);
  w('## 1. Whether the question offers a step check at all');
  w('');
  w(`The server calls \`stepCheck\` only when \`stepMetaFor(q)\` returns a meta (an authored \`stepcheck\`, or a numeric answer with an \`x =\` prefix, or an expression or set answer). Across ${fams.length} families (${qTotal} generated questions at 3 seeds and 4 difficulties, more seeds where a family offers step checking), **${qSup} questions (${pct(qSup, qTotal)}) have a meta; ${pct(qTotal - qSup, qTotal)} have none, so no line of their working is ever judged.** ${supFams.length} of ${fams.length} families (${pct(supFams.length, fams.length)}) offer step checking on at least one question.`);
  w('');
  w('| Edition | Families | Families with any step check | Questions | Questions with a meta |');
  w('|---|---:|---:|---:|---:|');
  for (const ed of ['NSW', 'India']) {
    const f = fams.filter(x => familyInfo[x].edition === ed);
    w(`| ${ed} | ${f.length} | ${f.filter(x => familyInfo[x].supported > 0).length} | ${f.reduce((n, x) => n + familyInfo[x].questions, 0)} | ${f.reduce((n, x) => n + familyInfo[x].supported, 0)} (${pct(f.reduce((n, x) => n + familyInfo[x].supported, 0), f.reduce((n, x) => n + familyInfo[x].questions, 0))}) |`);
  }
  w('');

  // ── Layer 2: headline
  w('## 2. Headline: per line of working');
  w('');
  w('"Any verdict" is a tick or a cross. A line the engine abstains on (status `note`) is silent. Rates use scored lines (true lines, the slip line, lines after the slip); prose lines are counted separately. "Correct lines ticked" is over true lines. A **false tick** is the engine ticking the line that is wrong.');
  w('');
  w('### 2a. Everything a student would write, including questions with no step check');
  w('');
  w(HEAD);
  w(row('All', metrics(rows)));
  for (const ed of ['NSW', 'India']) w(row(ed, metrics(rows.filter(r => r.edition === ed))));
  w('');
  w('### 2b. Only questions where the server runs the step check');
  w('');
  w(HEAD);
  w(row('All', metrics(sup)));
  for (const ed of ['NSW', 'India']) w(row(ed, metrics(sup.filter(r => r.edition === ed))));
  w(row('All, excluding template lines', metrics(supNoT)));
  w('');
  w('Template lines are authored lines that use a symbol the question never introduces (for example the generic formula `f\'(x) = a(cx + e) + c(ax + b)`). They are true in the generator\'s terms but a student would not write them, so silence on them is arguably right. The last row removes them.');
  const m2 = metrics(sup);
  w('');
  w(`Lines after the slip are judged against the student's own work and are not scored for correctness: of ${m2.follows}, the engine ticked ${m2.followsTicked} and crossed ${m2.followsBroken}. Prose lines: ${m2.neutral}, of which the engine gave a verdict on ${m2.neutralVerdict}.`);
  const sl = transcripts.filter(t => t.supported && t.style === 'slip');
  const found = sl.filter(t => t.firstBreak === t.breakAt).length;
  const early = sl.filter(t => t.firstBreak >= 0 && t.firstBreak < t.breakAt).length;
  const late = sl.filter(t => t.firstBreak > t.breakAt).length;
  const none = sl.filter(t => t.firstBreak < 0).length;
  w('');
  w(`**First break on slip transcripts (step-checked questions only, ${sl.length} transcripts):** found at the slipped line ${found} (${pct(found, sl.length)}); reported at an earlier, correct line ${early}; reported later than the slip ${late}; no break reported ${none}.`);
  w('');

  // ── false ticks
  const ft = sup.filter(r => r.truth === 'break' && r.status === 'ok');
  w('## 3. False ticks (release-blocking)');
  w('');
  if (!ft.length) w('No wrong line was ticked in this corpus. That is not proof there is none: the corpus has one slip per transcript, in three kinds (sign, arithmetic, dropped factor).');
  else {
    w(`**${ft.length} wrong line(s) were ticked.** Each is listed.`);
    w('');
    w('| Family | Seed/difficulty | Style | Question | Wrong line ticked | Lines of the transcript |');
    w('|---|---|---|---|---|---|');
    for (const r of ft) {
      const t = transcripts[r.ti];
      w(`| ${r.family} | ${t.qkey} | ${t.style} (${t.slipKind}) | ${esc(t.prompt.slice(0, 110))} | \`${esc(r.text)}\` | ${esc(t.lines.join(' ⏎ '))} |`);
    }
  }
  w('');
  const fc = sup.filter(r => r.truth === 'valid' && r.status === 'break');
  const fcT = new Set(fc0(sup)); function fc0(rows) { return rows.filter(r => r.truth === 'valid' && r.status === 'break').map(r => r.ti); }
  w(`Transcripts of step-checked questions: ${transcripts.filter(t => t.supported).length}; with at least one true line crossed: ${fcT.size} (${pct(fcT.size, transcripts.filter(t => t.supported).length)}).`);
  w('');
  w('## 4. False crosses (a true line marked wrong)');
  w('');
  if (!fc.length) w('None in this corpus.');
  else {
    w(`${fc.length} true line(s) were crossed. First 25:`);
    w('');
    w('| Family | Style | Line crossed | Engine note |');
    w('|---|---|---|---|');
    for (const r of fc.slice(0, 25)) w(`| ${r.family} | ${r.style} | \`${esc(r.text)}\` | ${esc((r.note || '').slice(0, 100))} |`);
  }
  w('');

  // ── by style
  w('## 5. By working style (questions with a step check)');
  w('');
  w(HEAD);
  const byStyle = [...group(sup, r => r.style)].map(([k, v]) => [k, metrics(v)]).sort((a, b) => (a[1].ticked / (a[1].valid || 1)) - (b[1].ticked / (b[1].valid || 1)));
  for (const [k, m] of byStyle) w(row(k, m));
  w('');
  w('Style names: bare = equation chain with the answer last; labelled = `label = value` or `label: value` answer line; therefore = answer line prefixed `∴`, `so`, `hence` or `therefore`; restate = question\'s expression written first; continuation = lines starting `=`; substitution = `f(2) = …`, `when x = …`, `let …`; units = units or words on the answer line; sentence = a prose line in the middle; slip = one realistic error (sign, arithmetic, dropped factor).');
  w('');
  w('Same, over all questions (including those with no step check):');
  w('');
  w(HEAD);
  for (const [k, v] of [...group(rows, r => r.style)].map(([k, v]) => [k, metrics(v)]).sort((a, b) => (a[1].ticked / (a[1].valid || 1)) - (b[1].ticked / (b[1].valid || 1)))) w(row(k, v));
  w('');

  // ── by family
  w('## 6. By question family');
  w('');
  const fam = [...group(sup, r => r.family)].map(([k, v]) => [k, metrics(v)])
    .sort((a, b) => (a[1].ticked / (a[1].valid || 1)) - (b[1].ticked / (b[1].valid || 1)) || a[1].verdict / a[1].scored - b[1].verdict / b[1].scored || b[1].scored - a[1].scored);
  w(`### 6a. The ${Math.min(15, fam.length)} worst families that offer a step check (lowest share of correct lines ticked)`);
  w('');
  w(HEAD);
  for (const [k, m] of fam.slice(0, 15)) w(row(`${k} (${familyInfo[k].edition})`, m));
  w('');
  w(`### 6b. All ${fam.length} families that offer a step check, worst first`);
  w('');
  w(HEAD);
  for (const [k, m] of fam) w(row(`${k} (${familyInfo[k].edition})`, m));
  w('');
  const none2 = fams.filter(f => familyInfo[f].supported === 0);
  w(`### 6c. The ${none2.length} families with no step check on any generated question`);
  w('');
  w('Their working is never judged by the server, whatever the student writes. By chapter prefix:');
  w('');
  const pre = new Map();
  for (const f of none2) { const p = f.split('-')[0]; (pre.get(p) || pre.set(p, []).get(p)).push(f); }
  w('| Prefix | Families without step check | of which in total |');
  w('|---|---:|---:|');
  for (const [p, v] of [...pre].sort((a, b) => b[1].length - a[1].length)) w(`| ${p} | ${v.length} | ${fams.filter(f => f.split('-')[0] === p).length} |`);
  w('');
  w('Full list: ' + none2.map(f => '`' + f + '`').join(', '));
  w('');

  // ── reasons
  const silent = sup.filter(r => SCORED.has(r.truth) && r.status === 'silent');
  w('## 7. Why the engine is silent (questions with a step check)');
  w('');
  w(`${silent.length} scored lines got no verdict. Reasons are assigned from the shape of the line (first matching rule), so they are this audit's classification, not the engine's own words.`);
  w('');
  w('| # | Reason | Silent lines | Share of silent | Example |');
  w('|---:|---|---:|---:|---|');
  topReasons(silent).forEach(([k, e], i) => w(`| ${i + 1} | ${esc(k)} | ${e.n} | ${pct(e.n, silent.length)} | \`${esc(e.ex)}\` (${e.style}) |`));
  w('');
  w('The engine\'s own stated reason for silence (digits normalised to `#`):');
  w('');
  w('| # | Engine note | Lines | Example |');
  w('|---:|---|---:|---|');
  topNotes(silent).forEach(([k, e], i) => w(`| ${i + 1} | ${esc(k.slice(0, 160))} | ${e.n} | \`${esc(e.ex)}\` |`));
  w('');

  // ── limits
  w('## 8. Limits of the method');
  w('');
  w('- **Synthetic.** Lines are rewritten from the generators\' own authored solutions. Real working has other orders, abbreviations, errors and recognition noise. Silence here is a lower bound on silence in use.');
  w('- **Truth is by construction.** A line is "valid" because the authored solution says it. Authored lines are not always what a student would write (template lines, step labels turned into equations). The report shows the rate with and without template lines, but the flag is a heuristic.');
  w('- **One slip per transcript**, of three kinds (sign, arithmetic, dropped factor), placed on a line that is a closed numeric equality (or the final answer). It does not test slips inside algebra, a wrong method, or two errors.');
  w('- **Truth of numbers uses `calc.mjs`**, a small evaluator separate from the engine, so the engine does not grade itself. It reads only plain arithmetic, so slips are never placed on symbolic lines.');
  w('- **Families are the authored subtopic generators** loaded by `loadAllBanks()` (both editions, with the `au-forms` overlays and the extra structural forms the server draws). Reviewed JEE past-paper generators (`jee-pyq:`), the source-cited archive (`pyq-archive:`), exam items and hand-built questions are not enumerated.');
  w('- **Which meta a question gets is the server\'s rule** (`stepMetaFor`), copied by importing it, so the first section tracks the product. A question reached by another route (an authored `stepcheck` added later, an exam item) would differ.');
  w('- **Printed-solution wording.** Where the authored step is prose ("Multiply first"), only its math spans become lines; the prose becomes a sentence line in one style only.');
  w('- **Marks, not understanding.** A verdict here is a line-level tick or cross, not a mark, and says nothing about whether a student learnt anything.');
  w('');
  return out.join('\n');
}
