#!/usr/bin/env node
// The author question bank is SERVER-SIDE ONLY (server/platform/qbankPack.js, server/content/qbank/). The answers, worked steps, criteria and
// trap reasons in it must never reach a device before a question is marked, so nothing of the pack may be reachable from the client.
//
//   node tools/qbank-isolation-check.mjs                 static checks, and the built client when client/dist exists
//   node tools/qbank-isolation-check.mjs --require-dist  the same, and fail when client/dist has not been built (CI, after the build)
//
// Static: no client source, client config or public asset names the pack or its module; the server serves static files from client/dist
// only; the pack's own files are not under client/. Built: no file of client/dist (scripts, styles, pages, the service worker and its
// precache list included) is a pack file, names the pack format or version, a pack shard, or contains the worked steps, criteria or trap
// reasons of any packed question (the prompt and the authored hints are public by design and are not searched for).
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
const dist = path.join(ROOT, 'client', 'dist');
let scanned = 0;
if (!fs.existsSync(dist)) {
  if (process.argv.includes('--require-dist')) failures.push('client/dist has not been built, and --require-dist was given');
  else console.log('  client/dist is not built: the built-client part is NOT MEASURED here (CI runs it after the build with --require-dist)');
} else {
  const files = walk(dist);
  scanned = files.length;
  ok(files.length > 0, 'client/dist holds files');
  const rel = f => path.relative(dist, f).split(path.sep).join('/');
  ok(!files.some(f => /(^|\/)qbank(\/|$)|qb-[ax]1[12]-m[ae]-/.test(rel(f))), 'no file of client/dist is, or is named for, a pack file');
  const secrets = [...new Set(questions.flatMap(q => [...q.steps.map(s => s.d), ...q.criteria.map(c => c.point), ...q.traps.map(t => t.why)]
    .filter(t => t.length >= 40 && !q.hints.some(h => h.includes(t) || t.includes(h)) && !q.prompt.includes(t))))];
  ok(secrets.length > 500, `the check has worked-step, criterion and trap texts to look for (${secrets.length})`);
  // Question ids are the author's own (A11-C1-089) and appear nowhere in the client; a long text can coincide with a generator's wording, an id cannot.
  const ids = questions.map(q => q.id);
  const hits = [];
  for (const file of files.filter(f => TEXT.test(f) || /sw|workbox/i.test(path.basename(f)))) {
    const text = fs.readFileSync(file, 'utf8');
    if (NAMES.test(text) || text.includes(manifest.packVersion)) hits.push(`${rel(file)} names the pack`);
    const idHit = ids.find(id => text.includes(id));
    if (idHit) hits.push(`${rel(file)} names the question ${idHit}`);
    const found = secrets.find(s => text.includes(s));
    if (found) hits.push(`${rel(file)} contains pack text "${found.slice(0, 40)}"`);
  }
  ok(hits.length === 0, `nothing in client/dist names the pack or holds its answers, steps, criteria or trap reasons (${hits.slice(0, 3).join('; ')})`);
}

if (failures.length) { console.error(`QBANK ISOLATION: FAIL ${failures.length}\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`QBANK ISOLATION: PASS — ${staticPass}/${staticPass} checks (${questions.length} questions protected)`);
console.log(scanned ? `  built client: ${pass - staticPass}/${pass - staticPass} checks over ${scanned} files of client/dist` : '  built client: not measured (client/dist is not built)');
