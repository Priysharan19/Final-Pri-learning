// Pri Learning · the reading of a function's bare argument, swept over every generator and the packed author bank (a measurement; it sets nothing).
//
//   node tools/function-argument-sweep.mjs [--root <repo>] [--seeds 30] [--edition prithagoras|priyabhata] [--list]
//
// FUNCTION_ARGUMENT_RULE (client/src/engine/expr.js): `cos2x` is cos(2x), `sin^2 3x` is (sin 3x)^2, and `e^2x`, `sqrt2x`, `log2x` have two readings.
// For every expression key of every generator (all four levels, seeds 1..N) and every packed bank question whose accepted answer holds a
// function of a multiple of the variable (a number and ONE letter), this types that key
//   · bracketed, as authored                          (must be right: nothing the engine accepted is lost),
//   · unbracketed, as a student writes it             (`sin2x`, `sin 2x`, `sin^2 3x`, `sin²3x`, `3sin2x`: right under the rule),
//   · in the forms with two readings                  (`e^2x`, `sqrt2x`, `log2x`: right unless a recorded trap of the question reads the same),
// and types each MISREADING of every key's f(kx) (f(k)·x, f(x)·k, f(k+x), k·f(x)): none may be marked right. The recorded traps of every
// question are typed too, bracketed and unbracketed: none may be marked right.
//
// `--root` points the engine at another checkout, so the same measurement on origin/main gives the "before" column.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FN = 'arcsin|arccos|arctan|asin|acos|atan|cosec|sin|cos|tan|sec|csc|cot|ln|exp';
const K = '(\\d+(?:\\.\\d+)?)';
const V = '(theta|alpha|beta|pi|[a-zθαβφ])';
// what may follow a bare argument and still leave it one reading: the end, a sign, a closing bracket, * or /, or another function name
const AFTER = `(?!\\s*\\^|\\s*\\(|\\s*!|\\s*%|\\s*[0-9.]|\\s*(?!(?:${FN}|sqrt|cbrt|ln|log|exp)\\b)[A-Za-z])`;
const CALL = new RegExp(`(?<![A-Za-z])(${FN})\\(\\s*${K}\\s*\\*?\\s*${V}\\s*\\)${AFTER}`, 'g');
const CALL_POWER = new RegExp(`(?<![A-Za-z])(${FN})\\(\\s*${K}?\\s*\\*?\\s*${V}\\s*\\)\\s*\\^\\s*(\\d)(?![0-9.])`, 'g');
const AMBIGUOUS = [
  ['e-power', new RegExp(`(?<![A-Za-z.])e\\^\\(\\s*(-?)${K}\\s*\\*?\\s*${V}\\s*\\)${AFTER}`, 'g'), (m, neg, k, v) => `e^${neg}${k}${v}`],
  ['sqrt', new RegExp(`(?<![A-Za-z])(sqrt|cbrt)\\(\\s*${K}\\s*\\*?\\s*${V}\\s*\\)${AFTER}`, 'g'), (m, f, k, v) => `${f}${k}${v}`],
  ['log', new RegExp(`(?<![A-Za-z])(log)\\(\\s*${K}\\s*\\*?\\s*${V}\\s*\\)${AFTER}`, 'g'), (m, f, k, v) => `${f}${k}${v}`]
];
const SUPER = { 2: '²', 3: '³' };

/** The key written the way a student types it without brackets: { kind: 'conventional' | 'ambiguous', style, text }. */
export function unbracketedForms(key) {
  const out = [];
  const add = (kind, style, text) => { if (text !== key && !out.some(o => o.text === text)) out.push({ kind, style, text }); };
  add('conventional', 'tight', key.replace(CALL, (m, f, k, v) => `${f}${k}${v}`));
  add('conventional', 'spaced', key.replace(CALL, (m, f, k, v) => `${f} ${k}${v}`));
  add('conventional', 'glued', key.replace(CALL, (m, f, k, v) => `${f}${k}${v}`).replace(/(\d)\*(?=(?:sin|cos|tan|sec|cosec|csc|cot|ln|exp))/g, '$1'));
  add('conventional', 'power-before', key.replace(CALL_POWER, (m, f, k, v, p) => `${f}^${p} ${k ?? ''}${v}`));
  add('conventional', 'power-superscript', key.replace(CALL_POWER, (m, f, k, v, p) => (SUPER[p] ? `${f}${SUPER[p]}${k ?? ''}${v}` : m)));
  for (const [name, re, f] of AMBIGUOUS) add('ambiguous', name, key.replace(re, f));
  return out;
}

/** The ways a student who misreads f(kx) would write it: f(k)·x, f(x)·k, f(k+x), k·f(x). Each is a whole key with one call replaced. */
export function misreadings(key) {
  const out = [];
  for (const m of key.matchAll(new RegExp(`(?<![A-Za-z])(${FN}|ln)\\(\\s*${K}\\s*\\*?\\s*${V}\\s*\\)`, 'g'))) {
    const [whole, f, k, v] = m;
    for (const bad of [`${f}(${k})*${v}`, `${f}(${v})*${k}`, `${f}(${k}+${v})`, `${k}*${f}(${v})`]) out.push(key.slice(0, m.index) + bad + key.slice(m.index + whole.length));
  }
  return out;
}

const NUMBER_ARG = new RegExp(`(?<![A-Za-z])(${FN})\\(\\s*${K}\\s*\\)\\s*\\*?\\s*${V}${AFTER}`, 'g');
/** A key that really is f(k)·x (a function of a plain number, times the letter), and what a student who means f(kx) types for it: a WRONG answer. */
export function numberArgumentKeys(key) {
  const out = [];
  const add = text => { if (text !== key && !out.includes(text)) out.push(text); };
  add(key.replace(NUMBER_ARG, (m, f, k, v) => `${f}${k}${v}`));
  add(key.replace(NUMBER_ARG, (m, f, k, v) => `${f} ${k}${v}`));
  return out;
}

export const hasFunctionOfMultiple = key => new RegExp(CALL.source).test(key) || new RegExp(CALL_POWER.source).test(key) && /\d\s*\*?\s*[a-zθ]\s*\)/.test(key)
  || AMBIGUOUS.some(([, re]) => new RegExp(re.source).test(key));

export async function sweep({ root, seeds = 30, bank = true } = {}) {
  const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
  const G = await imp('client/src/engine/generators/index.js');
  const { checkAnswer } = await imp('client/src/engine/checker.js');
  const { exprEquivalent } = await imp('client/src/engine/expr.js');
  await G.loadAllBanks();
  const stats = { questions: 0, keyed: 0, keyAccepted: 0, conventional: 0, conventionalRefused: 0, ambiguous: 0, ambiguousRefused: 0, misreadings: 0, trapsTyped: 0, numberArgumentKeys: 0, numberArgumentAccepted: 0, trapsEquivalent: 0, bankQuestions: 0, bankKeyed: 0, bankKeyAccepted: 0 };
  const refused = [], wrongAccepted = [], keyLost = [];
  const seen = new Set();
  const distinct = { conventional: new Set(), ambiguous: new Set(), conventionalRefused: new Set(), ambiguousRefused: new Set() };

  const examine = (where, mark, keys, traps) => {
    for (const key of keys) {
      stats.keyed++;
      if (mark(key)) stats.keyAccepted++; else keyLost.push(`${where}: ${key}`);
      const forms = unbracketedForms(key);
      const tag = `${where}|${key}`;
      if (!forms.length && !misreadings(key).length && !numberArgumentKeys(key).length || seen.has(tag)) continue;
      seen.add(tag);
      for (const f of forms) {
        const bucket = f.kind === 'conventional' ? 'conventional' : 'ambiguous';
        stats[bucket]++;
        distinct[bucket].add(`${where.startsWith('bank') ? where : 'generator'}|${key}`);
        if (!mark(f.text)) { stats[`${bucket}Refused`]++; distinct[`${bucket}Refused`].add(`${where.startsWith('bank') ? where : 'generator'}|${key}`); refused.push(`${where}: ${f.kind}/${f.style}: ${f.text}   (key ${key})`); }
      }
      for (const text of numberArgumentKeys(key)) {
        // the key is f(k)·x: `fkx` is f(kx), a different answer, so it must not be marked right (before the rule it was read as f(k)·x and was)
        stats.numberArgumentKeys++;
        if (mark(text)) { stats.numberArgumentAccepted++; wrongAccepted.push(`${where}: ${text} accepted for key ${key} (a student writing f(kx) is marked right)`); }
      }
      for (const bad of misreadings(key)) {
        // a rewrite that is genuinely the key (an identity) is not a misreading
        let same = false; try { same = exprEquivalent(bad, key, {}); } catch { same = false; }
        if (same) continue;
        stats.misreadings++;
        if (mark(bad)) wrongAccepted.push(`${where}: misreading ${bad} accepted for key ${key}`);
      }
    }
    for (const trap of traps) {
      // a trap with a function of a multiple, bracketed and as a student would write it: wrong if it was wrong. (A trap the key accepts
      // as an equivalent form, an unsimplified factorisation for one, was never a wrong answer to this engine and is counted, not held.)
      const forms = unbracketedForms(trap).filter(f => f.kind === 'conventional' || f.kind === 'ambiguous');
      if (!forms.length) continue;
      stats.trapsTyped++;
      const wasWrong = !mark(trap);
      if (!wasWrong) { stats.trapsEquivalent++; continue; }
      for (const f of forms) { stats.trapsTyped++; if (mark(f.text)) wrongAccepted.push(`${where}: trap ${f.text} accepted (bracketed ${trap} is wrong)`); }
    }
  };

  for (const id of Object.keys(G.GENERATORS)) {
    for (const d of [1, 2, 3, 4]) {
      for (let seed = 1; seed <= seeds; seed++) {
        let q; try { q = G.generateQuestion(id, d, seed); } catch { continue; }
        if (!q) continue;
        stats.questions++;
        const a = q.answer || {};
        const keys = [];
        if (q.answerType === 'expression' && typeof a.expr === 'string') keys.push(a.expr, ...(a.anyOf || []).filter(s => typeof s === 'string'));
        const traps = (q.traps || []).map(t => t?.expr).filter(s => typeof s === 'string');
        if (!keys.length && !traps.length) continue;
        examine(`${id} L${d} s${seed}`, text => { try { return checkAnswer(q, text).correct === true; } catch { return false; } }, keys, traps);
      }
    }
  }

  if (bank) {
    process.env.PRI_EDITION = 'prithagoras';
    const qb = await imp('server/platform/qbankPack.js');
    const { checkBankAnswer } = await imp('server/platform/qbankMarking.js');
    const { markerView } = await imp('server/platform/markerOps.js');
    await qb.ensureQbank(process.env, { strict: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, 'manifest.json'), 'utf8'));
    for (const shard of manifest.shards) {
      for (const e of JSON.parse(fs.readFileSync(path.join(qb.DEFAULT_PACK_DIR, shard.name), 'utf8')).questions) {
        stats.bankQuestions++;
        const a = e.answer || {};
        const keys = e.answerType === 'expression' && typeof a.expr === 'string' ? [a.expr, ...(a.anyOf || []).filter(s => typeof s === 'string')] : [];
        const traps = (e.traps || []).map(t => t?.expr).filter(s => typeof s === 'string');
        if (!keys.length && !traps.length) continue;
        const q = markerView(qb.qbankEntryQuestion(e.id, 17));
        const before = stats.keyed, beforeOk = stats.keyAccepted;
        examine(`bank ${e.id}`, text => { try { return checkBankAnswer(q, text).correct === true; } catch { return false; } }, keys, traps);
        stats.bankKeyed += stats.keyed - before; stats.bankKeyAccepted += stats.keyAccepted - beforeOk;
      }
    }
  }
  return { stats, refused, wrongAccepted, keyLost, distinct };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  if (arg('edition', null)) process.env.PRI_EDITION = arg('edition');
  const root = path.resolve(arg('root', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
  const r = await sweep({ root, seeds: Number(arg('seeds', 30)) });
  console.log(JSON.stringify(r.stats));
  console.log(`distinct keys (a generator key counted once, a bank question once): conventional ${r.distinct.conventional.size}, refused ${r.distinct.conventionalRefused.size}; two-reading ${r.distinct.ambiguous.size}, refused ${r.distinct.ambiguousRefused.size}`);
  console.log(`keys no longer accepted bracketed: ${r.keyLost.length}`);
  console.log(`unbracketed forms refused: ${r.refused.length}`);
  console.log(`wrong answers accepted: ${r.wrongAccepted.length}`);
  if (argv.includes('--list')) for (const l of [...r.keyLost, ...r.refused, ...r.wrongAccepted]) console.log(l);
}
