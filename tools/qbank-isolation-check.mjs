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
import fs from 'node:fs';
import path from 'node:path';
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
ok(importers.every(n => ['editionBanks.js', 'nswBanks.js', 'practice.js', 'qbankPack.js'].includes(n)), `only the issuing path imports the pack module (${importers.join(', ')})`);

const staticPass = pass;
// ── built client ─────────────────────────────────────────────────────────────
const FRAGMENT = 20;
/**
 * Answers that are also a constant or an expression a bundle holds for its own reasons (ln 2 in a PDF library, the generator expression
 * (e-1)/2 in a chapter's chunk). Each was found by running this scan on a real build, read, and listed here by the exact text; an answer
 * not listed is never excused, and a build holding any other pack text fails whatever it also holds.
 */
export const CHANCE_ANSWERS = Object.freeze(['0.6931471805599453', '(e-1)/2']);
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
    for (const t of trapTexts(q)) if (t.length >= FRAGMENT || (/[=<>(]|\\/.test(t) && t.length >= 6)) needles.push(['trap', t, q.id]);
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
const ambient = () => (ambientText ??= (() => {
  const raw = [...walk(path.join(ROOT, 'client', 'src')), ...walk(path.join(ROOT, 'client', 'public'))].filter(f => TEXT.test(f)).map(f => fs.readFileSync(f, 'utf8')).join(' ');
  return squash(raw) + ' ' + squash(raw.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\'/g, "'"));
})());

/** Scan a directory (a built client). Returns the findings, empty when it is clean. */
export function scanDist(dist, questions, version) {
  const files = walk(dist);
  const rel = f => path.relative(dist, f).split(path.sep).join('/');
  const hits = [];
  if (files.some(f => /(^|\/)qbank(\/|$)|qb-[ax]1[12]-m[ae]-/.test(rel(f)))) hits.push('a file of the dist is, or is named for, a pack file');
  const { needles, runs } = needlesOf(questions);
  const ids = questions.map(q => q.id);
  const prefixes = new Map(), shorts = new Map();
  for (const n of needles) {
    if (n[1].length >= FRAGMENT) { const k = n[1].slice(0, FRAGMENT); prefixes.set(k, [...(prefixes.get(k) || []), n]); }
    else { const k = n[1].slice(0, 6); shorts.set(k, [...(shorts.get(k) || []), n]); }
  }
  for (const file of files.filter(f => TEXT.test(f) || /sw|workbox/i.test(path.basename(f)))) {
    const text = fs.readFileSync(file, 'utf8');
    if (NAMES.test(text) || (version && text.includes(version))) hits.push(`${rel(file)} names the pack`);
    const idHit = ids.find(id => text.includes(id));
    if (idHit) hits.push(`${rel(file)} names the question ${idHit}`);
    // A bundle holds a string as JavaScript or JSON writes it: backslashes doubled, quotes and newlines escaped. Each reading is scanned:
    // as written, with the escapes undone, and with a newline escape read as the space it is.
    const undone = text.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/\\'/g, "'");
    for (const flat of new Set([squash(text), squash(undone), squash(undone.replace(/\\n/g, ' '))])) {
    // Long needles are found by their first 20 characters then confirmed whole; short ones by their own length.
    const found = new Set();
    for (let k = 0; k + FRAGMENT <= flat.length; k++) {
      const w = flat.slice(k, k + FRAGMENT);
      const id = runs.get(w);
      if (id && !found.has('run') && !ambient().includes(w)) { found.add('run'); hits.push(`${rel(file)} holds a run of a worked step of ${id}: "${flat.slice(k, k + 40)}"`); }
      const short = shorts.get(flat.slice(k, k + 6));
      if (short) for (const [kind, t, nid] of short) if (flat.startsWith(t, k) && !found.has(t) && !ambient().includes(t)) { found.add(t); hits.push(`${rel(file)} holds a ${kind} of ${nid}: "${t}"`); }
      const list = prefixes.get(w);
      if (list) for (const [kind, t, nid] of list) if (flat.startsWith(t, k) && !found.has(t) && !ambient().includes(t)) { found.add(t); hits.push(`${rel(file)} holds a ${kind} of ${nid}: "${t.slice(0, 40)}"`); }
    }
    }
  }
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
