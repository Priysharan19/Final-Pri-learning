#!/usr/bin/env node
// The author question bank is SERVER-SIDE ONLY (server/platform/qbankPack.js, server/content/qbank/). The answers, worked steps, criteria and
// trap reasons in it must never reach a device before a question is marked, so nothing of the pack may be reachable from the client.
//
//   node tools/qbank-isolation-check.mjs                 static checks, and the built client when client/dist exists
//   node tools/qbank-isolation-check.mjs --require-dist  the same, and fail when client/dist has not been built (CI, after the build)
//
// Static: no client source, client config or public asset names the pack or its module; the server serves static files from client/dist
// only; the pack's own files are not under client/. Built: no file of client/dist (scripts, styles, pages, the service worker and its
// precache list included) is a pack file, names the pack format or version, a pack shard, a question id, or contains ANY of the pack's
// text: an answer (6 characters or more), a prompt, a trap's wrong answer or its reason, a hint, a criterion, or a run of 20 characters
// or more of a worked step (so a truncated step is found as surely as a whole one). tools/qbank-isolation-check.test.mjs plants each
// kind in a copy of a dist and requires this scan to fail on it.
//
// WHAT THIS IS NOT. It is a tripwire for the ways the pack is likely to get into a build by accident or by a careless change, not a proof
// that the pack is absent. It CANNOT detect: a list of small whole-number answers on its own (the numbers 0 to 99 are in every bundle, and
// a shuffled list of them is indistinguishable from a table); text that has been re-encoded beyond gzip, zlib and brotli (base64, hex,
// XOR, a custom compression, splitting a string across files); text that has been paraphrased or translated; or an answer that is a short
// common expression. The protection that matters is the server's: nothing in client/ imports the pack, the server serves static files from
// client/dist only, and the pack's public fields are the only ones ever issued (qbank-real-pack-check.mjs sweeps the routes).
// BOUNDED. A scan has a hard cap (SCAN_CAP_MS, 60 s; the real builds take about 15 s); a scan that has not finished by then FAILS, so
// an input made to be slow cannot pass by being slow.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = path.join(ROOT, 'server', 'content', 'qbank');
const failures = [];
let pass = 0;
const ok = (cond, message) => { if (cond) pass++; else failures.push(message); };

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === '.git') continue;
    const file = path.join(dir, name.name);
    if (name.isDirectory()) walk(file, out); else out.push(file);
  }
  return out;
};
const TEXT = /\.(?:m?js|jsx|css|html|json|webmanifest|map|svg|txt|mjs|cjs)$/i;

const manifest = JSON.parse(fs.readFileSync(path.join(PACK, 'manifest.json'), 'utf8'));
const shards = manifest.shards.map(s => path.join(PACK, s.name));
const questions = shards.flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')).questions);
ok(questions.length > 0, 'the committed pack has questions to protect');

// ── static ───────────────────────────────────────────────────────────────────
const NAMES = /qbankPack|content\/qbank|pri-qbank-pack|qbank\/shards|qb-[ax]1[12]-m[ae]-/;
const clientFiles = [...walk(path.join(ROOT, 'client', 'src')), ...walk(path.join(ROOT, 'client', 'public')), ...['index.html', 'vite.config.js', 'vite.config.mjs', 'package.json', 'edition.config.mjs'].map(f => path.join(ROOT, 'client', f))].filter(f => fs.existsSync(f) && TEXT.test(f));
const named = clientFiles.filter(f => NAMES.test(fs.readFileSync(f, 'utf8')));
ok(named.length === 0, `no client source, config or public asset names the pack (${named.map(f => path.relative(ROOT, f)).join(', ')})`);
ok(!fs.existsSync(path.join(ROOT, 'client', 'public', 'qbank')) && !walk(path.join(ROOT, 'client')).some(f => f.includes(`${path.sep}qbank${path.sep}`) && !f.includes('node_modules')), 'no copy of the pack lies under client/');
const app = fs.readFileSync(path.join(ROOT, 'server', 'app.js'), 'utf8');
const statics = [...app.matchAll(/express\.static\(([^)]*)\)/g)].map(m => m[1]);
ok(statics.length > 0 && statics.every(a => /dist/i.test(a)), `the server serves static files from the built client only (${statics.join(' | ')})`);
const serverText = walk(path.join(ROOT, 'server', 'platform')).filter(f => f.endsWith('.js'));
const serving = serverText.filter(f => /express\.static|sendFile/.test(fs.readFileSync(f, 'utf8')) && /content\/qbank|DEFAULT_PACK_DIR/.test(fs.readFileSync(f, 'utf8')));
ok(serving.length === 0, 'no server module that serves files names the pack');
const importers = serverText.filter(f => /from '\.\/qbankPack\.js'/.test(fs.readFileSync(f, 'utf8'))).map(f => path.basename(f)).sort();
ok(importers.every(n => ['editionBanks.js', 'nswBanks.js', 'practice.js', 'qbankFigures.js', 'qbankPack.js'].includes(n)), `only the issuing path imports the pack module (${importers.join(', ')})`);

const staticPass = pass;
// ── built client ─────────────────────────────────────────────────────────────
const FRAGMENT = 20;
/**
 * Answers that are also a constant or an expression a bundle holds for its own reasons (ln 2 in a PDF library, the generator expression
 * (e-1)/2 in a chapter's chunk). Each was found by running this scan on a real build, read, and listed here by the exact text; an answer
 * not listed is never excused, and a build holding any other pack text fails whatever it also holds.
 */
export const CHANCE_ANSWERS = Object.freeze(['0.6931471805599453', '(e-1)/2']);
// A trap that is a bare comparison any library's code holds (a PDF worker's own `x >= 2`): its text alone proves nothing; the pack's shape, ids and runs still would.
export const CHANCE_TRAPS = Object.freeze(['x >= 2']);
const squash = t => String(t ?? '').replace(/\s+/g, ' ').trim();
/** The answer, written the ways it is stored. */
const answerTexts = q => {
  const a = q.answer || {};
  return [a.expr, a.region, a.lhs !== undefined ? `${a.lhs} = ${a.rhs}` : null, a.rhs, ...(Array.isArray(a.values) ? [a.values.join(', ')] : []),
    a.x !== undefined ? `(${a.x}, ${a.y})` : null, a.value !== undefined ? String(a.value) : null].filter(t => typeof t === 'string');
};
const trapTexts = q => (q.traps || []).flatMap(t => [t.why, t.expr, t.region, t.eq, typeof t.value === 'string' ? t.value : (t.value !== undefined ? String(t.value) : null),
  Array.isArray(t.values) ? t.values.join(', ') : null, Array.isArray(t.point) ? `(${t.point.join(', ')})` : null].filter(x => typeof x === 'string'));

/**
 * What must appear nowhere in a built client: [kind, text] needles, and the set of 20-character runs of worked steps.
 * `answer` needles need 6 characters or more, 12 for a bare number (a short number is in every bundle by chance); the rest need 20, which no chance run of
 * a bundle's own wording reaches (a shorter hint or reason is held by the id and the run checks around it).
 */
export function needlesOf(questions) {
  const needles = [];
  const runs = new Map();
  for (const q of questions) {
    for (const t of answerTexts(q)) if (!CHANCE_ANSWERS.includes(t) && t.length >= (/^-?[\d.]+$/.test(t) ? 12 : 6)) needles.push(['answer', t, q.id]);   // a bare number is in every bundle by chance (1048576), unless it is long
    for (const t of trapTexts(q)) if (!CHANCE_TRAPS.includes(t) && (t.length >= FRAGMENT || (/[=<>(]|\\/.test(t) && t.length >= 6))) needles.push(['trap', t, q.id]);
    if (squash(q.prompt).length >= FRAGMENT) needles.push(['prompt', squash(q.prompt), q.id]);
    for (const h of [...q.hints, ...Object.values(q.ladder || {})]) if (squash(h).length >= FRAGMENT) needles.push(['hint', squash(h), q.id]);
    for (const c of q.criteria) if (squash(c.point).length >= FRAGMENT) needles.push(['criterion', squash(c.point), q.id]);
    for (const st of q.steps) for (const t of [st.d, st.h]) {
      const x = squash(t);
      for (let k = 0; k + FRAGMENT <= x.length; k++) if (!runs.has(x.slice(k, k + FRAGMENT))) runs.set(x.slice(k, k + FRAGMENT), q.id);
    }
  }
  return { needles, runs };
}

/**
 * The client's own source, squashed: wording the client already had (a stock phrase such as "a common denominator" or "Correct
 * substitution") is in it, and a pack text that is only that phrase is not a leak of the pack.
 */
let ambientText = null;
const ambientMemo = new Map();
/** Does the client's own source hold this text (memoised: the source is megabytes and a window is asked about again and again)? */
const inAmbient = t => { let v = ambientMemo.get(t); if (v === undefined) { v = ambient().includes(t); ambientMemo.set(t, v); } return v; };
const ambient = () => (ambientText ??= (() => {
  const raw = [...walk(path.join(ROOT, 'client', 'src')), ...walk(path.join(ROOT, 'client', 'public'))].filter(f => TEXT.test(f)).map(f => fs.readFileSync(f, 'utf8')).join(' ');
  return squash(raw) + ' ' + squash(raw.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\'/g, "'"));
})());

// ── structure: the pack found by its SHAPE, whatever it is named and however it is wrapped ──────────────────────────────────────────────
const PACK_ID = /\b[AX](?:11|12)-[A-Z]\d-\d{3}\b/g;
/** The shapes only the pack's JSON has: a criterion, a trap with its reason, a worked step, a stepcheck, a question's own header. */
const SHAPES = [/"marks"\s*:\s*\d\s*,\s*"point"\s*:\s*"/g, /"why"\s*:\s*"/g, /"h"\s*:\s*"[^"]{0,80}"\s*,\s*"d"\s*:\s*"/g, /"authored"\s*:\s*\d\s*,\s*"level"\s*:/g, /"nudge"\s*:\s*"/g, /"answerPrefix"\s*:\s*"/g, /"stepcheck"\s*:\s*\{/g];
const SHAPE_LIMIT = 25;       // a build holds none of these; more than this many in one file is a pack (or a large part of one)
const ID_RUN_LIMIT = 3;       // distinct pack question ids in one file
/** The hard cap on a scan of a dist, in milliseconds. A scan that has not finished by then FAILS: it is treated as a finding, never as a pass. */
export const SCAN_CAP_MS = Number(process.env.PRI_QBANK_SCAN_CAP_MS) || 60_000;
const WINDOW = 200, WINDOW_DISTINCT = 40, WINDOW_FLAGGED = 120;   // a window of tokens that is mostly pack answers, and many different ones that are not small whole numbers (a bundle's own tables of small numbers, such as a decoder's, hold dozens of those by chance: 87 different ones, 22 of them not small)
const PAIR_RUN = 40, PAIR_RARE = 20;   // consecutive tokens that follow the pack's own order of answers, and how many of them are not a small whole number
const SMALL = /^-?\d{1,2}$/;

const normToken = t => {
  const x = String(t).trim();
  if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(x)) return String(Number(x));
  return squash(x);
};
/** The pack's answers as tokens, in pack order, and as a set. */
export function answerTokensOf(questions) {
  const order = [];
  for (const q of questions) {
    const a = q.answer || {};
    const texts = answerTexts(q).map(normToken);
    if (Array.isArray(a.values)) for (const v of a.values) texts.push(normToken(v));
    if (a.x !== undefined) texts.push(normToken(a.x), normToken(a.y));
    order.push(...[...new Set(texts)].filter(Boolean));
  }
  const set = new Set(order);
  const pairs = new Set();
  for (let i = 0; i + 1 < order.length; i++) pairs.add(order[i] + '\u0000' + order[i + 1]);
  return { order, set, pairs };
}
const TOKEN = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|"([^"\\\n]{1,40})"|'([^'\\\n]{1,40})'/gi;

/** Findings of the structural scan over one decoded text: answers in bulk, pack shapes, pack ids. */
function structural(text, tokens, ids) {
  const out = [];
  const idsHere = new Set(text.match(PACK_ID) || []);
  const known = [...idsHere].filter(id => ids.has(id));
  if (known.length >= ID_RUN_LIMIT) out.push(`${known.length} distinct pack question ids (${known.slice(0, 3).join(', ')})`);
  for (const re of SHAPES) { const n = (text.match(re) || []).length; if (n > SHAPE_LIMIT) { out.push(`${n} of the pack's JSON shape ${re.source.slice(0, 30)}`); break; } }
  // answers in bulk: a window of tokens that is mostly pack answers, and many different ones
  const seq = [];
  for (const m of text.matchAll(TOKEN)) seq.push(normToken(m[1] ?? m[2] ?? m[0]));
  if (seq.length >= WINDOW) {
    const counts = new Map(); let flagged = 0, big = 0, best = 0, bestAt = 0;
    const add = i => { if (tokens.set.has(seq[i])) { flagged++; const c = counts.get(seq[i]) || 0; counts.set(seq[i], c + 1); if (!c && !SMALL.test(seq[i])) big++; } };
    const drop = i => { if (tokens.set.has(seq[i])) { flagged--; const c = counts.get(seq[i]) - 1; if (c) counts.set(seq[i], c); else { counts.delete(seq[i]); if (!SMALL.test(seq[i])) big--; } } };
    for (let i = 0; i < seq.length; i++) {
      add(i);
      if (i >= WINDOW) drop(i - WINDOW);
      if (i >= WINDOW - 1 && flagged >= WINDOW_FLAGGED && big >= WINDOW_DISTINCT && big > best) { best = big; bestAt = i; }
    }
    if (best) out.push(`a run of ${WINDOW} tokens holds ${best} different pack answers that are not small whole numbers (token ${bestAt})`);
    // the pack's own order of answers: a run of tokens each following the last as in the pack, with many that no code would hold by chance
    // (a bundle's own tables of small whole numbers follow the pack's order for a while; they hold few such tokens)
    let run = 0, rare = 0, longest = 0;
    for (let i = 0; i + 1 < seq.length; i++) {
      if (tokens.pairs.has(seq[i] + '\u0000' + seq[i + 1])) {
        run++; if (!SMALL.test(seq[i + 1])) rare++;
        if (run >= PAIR_RUN && rare >= PAIR_RARE && run > longest) longest = run;
      } else { run = 0; rare = 0; }
    }
    if (longest) out.push(`${longest + 1} consecutive tokens follow the pack's own order of answers`);
  }
  return out;
}

const isTextual = buf => { let bad = 0; const n = Math.min(buf.length, 4096); for (let i = 0; i < n; i++) { const c = buf[i]; if (c === 0 || (c < 9) || (c > 13 && c < 32)) bad++; } return bad / Math.max(1, n) < 0.02; };
/** A file's bytes as each reading of it a scan should hold: as it is, and decoded through gzip, zlib and brotli (up to three layers deep). */
export function readingsOf(buf, depth = 0, out = []) {
  out.push(buf);
  if (depth >= 3 || buf.length < 16) return out;
  const tries = [];
  if (buf[0] === 0x1f && buf[1] === 0x8b) tries.push(zlib.gunzipSync);
  if (buf[0] === 0x78) tries.push(zlib.inflateSync);
  if (!isTextual(buf)) tries.push(zlib.brotliDecompressSync, zlib.inflateRawSync);
  for (const fn of tries) { try { const dec = fn(buf, { maxOutputLength: 256 * 1024 * 1024 }); if (dec.length) readingsOf(dec, depth + 1, out); } catch { /* not that encoding */ } }
  return out;
}
/** The strings to read a buffer as: UTF-8, and Latin-1 when it is not text (so a compressed or binary file's ASCII runs are still read). */
const stringsOf = buf => { const u = buf.toString('utf8'); return u.includes('�') ? [u, buf.toString('latin1')] : [u]; };

/** Scan a directory (a built client). EVERY file is read, whatever its extension. Returns the findings, empty when it is clean. */
export function scanDist(dist, questions, version, { capMs = SCAN_CAP_MS } = {}) {
  const files = walk(dist);
  const rel = f => path.relative(dist, f).split(path.sep).join('/');
  const hits = [];
  if (files.some(f => /(^|\/)qbank(\/|$)|qb-[ax]1[12]-m[ae]-/.test(rel(f)))) hits.push('a file of the dist is, or is named for, a pack file');
  const { needles, runs } = needlesOf(questions);
  const ids = new Set(questions.map(q => q.id));
  const tokens = answerTokensOf(questions);
  const prefixes = new Map(), shorts = new Map();
  for (const n of needles) {
    if (n[1].length >= FRAGMENT) { const k = n[1].slice(0, FRAGMENT); prefixes.set(k, [...(prefixes.get(k) || []), n]); }
    else { const k = n[1].slice(0, 6); shorts.set(k, [...(shorts.get(k) || []), n]); }
  }
  const idList = [...ids];
  // A cheap filter for the per-character loop: a window can only match a needle or a step run when its first 6 characters are the first 6 of one.
  const first6 = new Set([...runs.keys(), ...prefixes.keys(), ...shorts.keys()].map(k => k.slice(0, 6)));
  const first2 = new Set([...first6].map(k => k.slice(0, 2)));
  const deadline = Date.now() + capMs;
  let timedOut = false;
  for (const file of files) {
    if (timedOut || Date.now() > deadline) { timedOut = true; break; }
    const fileStart = hits.length;
    const capped = () => hits.length - fileStart >= 6;   // a file that already fails needs no more evidence (and a whole pack would take minutes to list)
    const buf = fs.readFileSync(file);
    const readings = readingsOf(buf);
    readings.forEach((reading, layer) => {
      if (capped()) return;
      const where = layer ? `${rel(file)} (decoded, layer ${layer})` : rel(file);
      for (const text of stringsOf(reading)) {
        if (capped()) break;
        if (NAMES.test(text) || (version && text.includes(version))) hits.push(`${where} names the pack`);
        const idHit = text.length >= 10 ? (text.match(PACK_ID) || []).find(id => ids.has(id)) : null;
        if (idHit) hits.push(`${where} names the question ${idHit}`);
        for (const f of structural(text, tokens, ids)) hits.push(`${where}: ${f}`);
        // A bundle holds a string as JavaScript or JSON writes it: backslashes doubled, quotes and newlines escaped. Each reading is scanned:
        // as written, with the escapes undone, and with a newline escape read as the space it is.
        const undone = text.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\'/g, "'");
        for (const flat of new Set([squash(text), squash(undone), squash(undone.replace(/\\n/g, ' '))])) {
          // Long needles are found by their first 20 characters then confirmed whole; short ones by their own length.
          const found = new Set();
          for (let k = 0; k + FRAGMENT <= flat.length && !capped(); k++) {
            if ((k & 0xffff) === 0 && Date.now() > deadline) { timedOut = true; break; }
            if (!first2.has(flat.slice(k, k + 2)) || !first6.has(flat.slice(k, k + 6))) continue;
            const w = flat.slice(k, k + FRAGMENT);
            const id = runs.get(w);
            if (id && !found.has('run') && !inAmbient(w)) { found.add('run'); hits.push(`${where} holds a run of a worked step of ${id}: "${flat.slice(k, k + 40)}"`); }
            const short = shorts.get(flat.slice(k, k + 6));
            if (short) for (const [kind, t, nid] of short) if (flat.startsWith(t, k) && !found.has(t) && !inAmbient(t)) { found.add(t); hits.push(`${where} holds a ${kind} of ${nid}: "${t}"`); }
            const list = prefixes.get(w);
            if (list) for (const [kind, t, nid] of list) if (flat.startsWith(t, k) && !found.has(t) && !inAmbient(t)) { found.add(t); hits.push(`${where} holds a ${kind} of ${nid}: "${t.slice(0, 40)}"`); }
          }
        }
      }
    });
  }
  if (timedOut) hits.push(`the scan did not finish within its ${capMs / 1000} s cap (fail closed): a file this large or this repetitive is not a build`);
  return hits;
}

const dist = path.join(ROOT, 'client', 'dist');
let scanned = 0;
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!fs.existsSync(dist)) {
    if (process.argv.includes('--require-dist')) failures.push('client/dist has not been built, and --require-dist was given');
    else console.log('  client/dist is not built: the built-client part is NOT MEASURED here (CI runs it after the build with --require-dist)');
  } else {
    const files = walk(dist);
    scanned = files.length;
    ok(files.length > 0, 'client/dist holds files');
    const { needles, runs } = needlesOf(questions);
    ok(needles.length > 5000 && runs.size > 20000, `the check has answers, prompts, traps, hints, criteria and step runs to look for (${needles.length} needles, ${runs.size} step runs)`);
    const hits = scanDist(dist, questions, manifest.packVersion);
    ok(hits.length === 0, `nothing in client/dist names the pack or holds any of its text (${hits.slice(0, 3).join('; ')})`);
  }
  if (failures.length) { console.error(`QBANK ISOLATION: FAIL ${failures.length}\n  ${failures.join('\n  ')}`); process.exit(1); }
  console.log(`QBANK ISOLATION: PASS — ${staticPass}/${staticPass} checks (${questions.length} questions protected)`);
  console.log(scanned ? `  built client: ${pass - staticPass}/${pass - staticPass} checks over ${scanned} files of client/dist` : '  built client: not measured (client/dist is not built)');
}
