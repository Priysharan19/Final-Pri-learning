// Pri Learning · step-mark PAY of generated pages, dumped so two trees can be compared (a measurement; it sets and changes nothing).
//
//   node tools/pay-pages-dump.mjs --out base.json [--seeds 12] [--root <repo>]
//   node tools/pay-pages-dump.mjs --compare base.json [--seeds 12]
//
// Over every issued, payable Years 11-12 Advanced / Extension 1 question and seeds 1..N, and for each question both the generic rule
// (server/platform/genericSteps.js) and, where the question has one, its approved per-type scheme (server/platform/schemeAward.js),
// approved IN THIS PROCESS ONLY (a plain env object and an allow-list passed to schemePay; nothing in the repository is approved):
//   full         the authored working with the right final answer
//   wrong-typed  the authored working with a wrong typed answer
//   falsified-k  the authored working with one line falsified, at each authored line, a wrong typed answer
// For each page: marks earned, and the status of every line. The comparison lists every page whose marks differ, every line crossed that was
// not, and every tick lost.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const root = path.resolve(arg('root', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const seeds = Number(arg('seeds', 12));
// --real-lists: the approvals as the repository records them (server/platform/authorApproved.generated.js), not every scheme approved in this process
const realLists = argv.includes('--real-lists');
// --unbracketed conventional|ambiguous: every authored line is first written the way a student types it without brackets
// (tools/function-argument-sweep.mjs: sin(2*x) as sin2x, or e^(2*x) as e^2x), so the same pages measure what that reading does to a LINE
const unbracketed = arg('unbracketed', null);
const { unbracketedForms } = await import('./function-argument-sweep.mjs');
const unbracket = text => { const f = unbracketedForms(text).find(x => x.kind === unbracketed && x.style !== 'spaced' && x.style !== 'glued'); return f ? f.text : text; };

export async function dump() {
  const G = await imp('client/src/engine/generators/index.js');
  const { NSW_BANK_LEDGER, nswIssuable } = await imp('server/platform/nswBanks.js');
  const { inScope } = await imp('tools/scheme-coverage-y1112.mjs');
  const GS = await imp('server/platform/genericSteps.js');
  const SA = await imp('server/platform/schemeAward.js');
  const MO = await imp('server/platform/markerOps.js');
  const { checkAnswer } = await imp('client/src/engine/checker.js');
  const SW = await imp('tools/generic-steps-sweep.mjs');
  await G.loadAllBanks();
  const ENV = { PRI_METHOD_MARKS: 'on', PRI_EDITION: 'prithagoras' };
  const LIST = [{ typeId: GS.GENERIC_ID, digest: GS.genericDigest() }, ...SA.SCHEMES.map(s => ({ typeId: s.id, digest: SA.schemeDigest(s) }))];
  const out = {};
  const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };
  for (const entry of NSW_BANK_LEDGER) {
    if (!inScope(entry.generator)) continue;
    for (const cell of entry.cells) {
      if (!cell.issued) continue;
      for (let seed = 1; seed <= seeds; seed++) {
        let q0; try { q0 = G.generateQuestion(entry.generator, cell.difficulty, seed); } catch { continue; }
        if (!q0) continue;
        q0._generator = entry.generator;
        let issuable = false; try { issuable = nswIssuable(q0, entry.generator); } catch { issuable = false; }
        if (!issuable) continue;
        const typeId = (() => { try { return SA.schemeTypeOf(q0, entry.generator); } catch { return null; } })();
        for (const rule of ['generic', 'scheme']) {
          const id = rule === 'generic' ? GS.GENERIC_ID : typeId;
          if (!id) continue;
          if (rule === 'generic' && !GS.genericEligible(q0)) continue;
          const q = { ...q0, _methodScheme: id };
          let texts; try { texts = GS.authoredLines(q).map(l => l.text); } catch { continue; }
          if (unbracketed) texts = texts.map(unbracket);
          if (texts.length < 2) continue;
          const pages = [['full', texts, finalOf(texts)], ['wrong', texts, '99991']];
          texts.forEach((t, k) => { const bad = SW.falsify(t); if (bad && bad !== t) pages.push([`f${k}`, texts.map((x, i) => (i === k ? bad : x)), '99991']); });
          // the natural pages of an equation solved by a step that is not reversible (tools/qbank-variants.mjs): candidates listed, then rejected
          try {
            const V = await imp('tools/qbank-variants.mjs');
            const meta = MO.stepMetaFor(q);
            const facts = V.equationFacts(meta, texts, q);
            if (facts && facts.E.length) for (const pg of V.variantPages(facts)) { pages.push([`v-${pg.name}`, pg.lines, '99991']); pages.push([`vr-${pg.name}`, pg.lines, finalOf(pg.lines)]); }
          } catch { /* no variants */ }
          for (const [label, lines, answer] of pages) {
            let rec;
            try {
              const N = MO.marksPossibleFor(q);
              const result = checkAnswer(q, answer);
              const ev = MO.stepEvidence(q, answer, lines.join('\n'), result, { slipWarnings: true });
              const correct = result.correct === true;
              const pay = SA.schemePay({ q, report: ev.stepReport || null, topic: ev.topicTicks ?? null, correct, marksPossible: N, env: ENV, ...(realLists ? {} : { list: LIST }) });
              const marks = pay.paid ? MO.practiceMarksEarned(q, result, { ...ev, partial: !correct ? pay.partial : null }, N) : 0;
              rec = { marks, paid: !!pay.paid, st: (ev.stepReport?.lines || []).map(l => ({ ok: 'o', break: 'b', note: 'n' }[l?.status] || '?')).join(''), lines };
            } catch (e) { rec = { err: String(e).slice(0, 80) }; }
            out[`${rule}|${entry.generator}|${cell.difficulty}|${seed}|${label}`] = rec;
          }
        }
      }
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const res = await dump();
  if (arg("keep", null)) fs.writeFileSync(arg("keep"), JSON.stringify(res));
  console.log('pages', Object.keys(res).length);
  if (arg('out', null)) fs.writeFileSync(arg('out'), JSON.stringify(res));
  if (arg('compare', null)) {
    const base = JSON.parse(fs.readFileSync(arg('compare'), 'utf8'));
    let same = 0, marksDiff = 0, newCross = 0, lostTick = 0, gainedTick = 0, missing = 0;
    const lines = [];
    for (const [k, r] of Object.entries(res)) {
      const b = base[k]; if (!b) { missing++; continue; }
      if (r.err || b.err) continue;
      let diff = false;
      if (r.marks !== b.marks) { marksDiff++; diff = true; lines.push(`MARKS ${k}: ${b.marks} -> ${r.marks}  base ${b.st} now ${r.st}`); }
      for (let i = 0; i < Math.min(r.st.length, b.st.length); i++) {
        if (r.st[i] === 'b' && b.st[i] !== 'b') newCross++;
        if (b.st[i] === 'o' && r.st[i] !== 'o') { lostTick++; diff = true; lines.push(`LOST TICK ${k} L${i + 1}`); }
        if (b.st[i] !== 'o' && r.st[i] === 'o') gainedTick++;
      }
      if (!diff) same++;
    }
    console.log(JSON.stringify({ same, marksDiff, newCross, lostTick, gainedTick, missing }));
    for (const l of lines.slice(0, 80)) console.log(l);
  }
}
