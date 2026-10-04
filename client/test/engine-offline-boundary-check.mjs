// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · The marking engine never reaches the network
//
// Ledger 3.1 (node half). The deterministic engine is bundled in the client and
// is the instant, connection-loss fallback; a model only ever proposes. For
// that to stay true, no module under client/src/engine may import the audited
// network transport, the API module, the cloud bridges, or use a network
// primitive directly — transitively, through anything it imports.
//
// This walks every file under client/src/engine, follows every relative import
// to a fixpoint, and fails on the first path that leaves the engine for a
// network-bearing module or that contains fetch/XMLHttpRequest/WebSocket/
// sendBeacon/EventSource/navigator.onLine. It also pins that the local backend
// that marks practice answers imports the checker from the engine, so the
// in-browser marking path and the engine are one thing.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const SRC = join(ROOT, 'client', 'src');
const ENGINE = join(SRC, 'engine');

// Modules that are, or lead to, the network. Anything the engine reaches that
// matches is a failure, whatever the import chain.
const NETWORK_MODULES = [
  /\/client\/src\/platform\/cloudTransport\.js$/,
  /\/client\/src\/api\.js$/,
  /\/client\/src\/platform\//,
  /\/client\/src\/ink\/cloud/,
  /\/client\/src\/local\//,
  /\/client\/src\/cloud/,
  /\/client\/src\/auth/
];
const NETWORK_PRIMITIVES = /\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\s*\(|\bWebSocket\s*\(|\bEventSource\s*\(|navigator\.onLine|\bimport\s*\(\s*['"]https?:/g;
const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.(?:js|jsx|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null;             // a bare package: not a client module
  const base = resolve(dirname(from), spec);
  for (const cand of [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, join(base, 'index.js')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return base;                                         // unresolved: reported below
}

// ── Walk the engine's import closure ─────────────────────────────────────────
const engineFiles = files(ENGINE);
ok(engineFiles.length > 20, `the engine has source files to check (${engineFiles.length})`);

const seen = new Map();   // file → { importedBy }
const queue = engineFiles.map(f => [f, null]);
const unresolved = [];
while (queue.length) {
  const [file, by] = queue.shift();
  if (seen.has(file)) continue;
  seen.set(file, by);
  if (!existsSync(file)) { unresolved.push(`${relative(ROOT, by || '')} → ${relative(ROOT, file)}`); continue; }
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(IMPORT)) {
    const spec = m[1] || m[2];
    const target = resolveImport(file, spec);
    if (target) queue.push([target, file]);
  }
}
ok(unresolved.length === 0, `every relative import in the engine closure resolves: ${unresolved.slice(0, 5).join('; ')}`);

const chain = file => {
  const parts = [];
  let cur = file;
  while (cur) { parts.unshift(relative(ROOT, cur)); cur = seen.get(cur); }
  return parts.join(' → ');
};

let reached = 0, outside = 0;
for (const [file] of seen) {
  if (!existsSync(file)) continue;
  reached++;
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  if (!file.startsWith(ENGINE)) outside++;
  const isNetwork = NETWORK_MODULES.some(re => re.test(`/${rel}`));
  ok(!isNetwork, `engine closure reaches a network-bearing module: ${chain(file)}`);
  const text = readFileSync(file, 'utf8');
  const hits = [...text.matchAll(NETWORK_PRIMITIVES)].map(h => h[0]);
  ok(hits.length === 0, `${rel} uses a network primitive (${[...new Set(hits)].join(', ')}) — reached via ${chain(file)}`);
}
ok(reached > 0, `walked ${reached} modules (${outside} outside engine/, all non-network)`);

// What the engine may legitimately reach outside its own folder: the string
// catalogue (board-style wording and lost-mark keys) and the language table.
// Anything new here is a reviewable change to the offline contract.
const ALLOWED_OUTSIDE = new Set(['client/src/i18n/strings.en.js', 'client/src/i18n/strings.hi.js', 'client/src/i18n/languages.js']);
for (const [file] of seen) {
  if (!existsSync(file) || file.startsWith(ENGINE)) continue;
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  ok(ALLOWED_OUTSIDE.has(rel), `engine closure leaves engine/ for an unlisted module: ${chain(file)}`);
}

// ── The in-browser marking path IS the engine ────────────────────────────────
const backend = readFileSync(join(SRC, 'local', 'backend.js'), 'utf8');
ok(/import\s*\{[^}]*\bcheckAnswer\b[^}]*\}\s*from\s*'\.\.\/engine\/checker\.js'/.test(backend), 'local/backend.js imports checkAnswer from engine/checker.js');
ok(/import\s*\{[^}]*\bmethodMarks\b[^}]*\}\s*from\s*'\.\.\/engine\/checker\.js'/.test(backend), 'local/backend.js imports methodMarks from engine/checker.js');
const checker = readFileSync(join(ENGINE, 'checker.js'), 'utf8');
ok(!/cloud|fetch\(/i.test(checker.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'engine/checker.js has no cloud or fetch code path');

// The audited transport is the only file allowed network primitives (the
// release gate tools/check-client-network-boundary.mjs holds that); here we
// pin the complementary direction: the transport never imports the engine, so
// a network failure cannot take the marker down with it.
const transport = readFileSync(join(SRC, 'platform', 'cloudTransport.js'), 'utf8');
ok(!/from\s*'\.\.\/engine\//.test(transport), 'platform/cloudTransport.js does not import the engine');

console.log(failures.length
  ? `ENGINE OFFLINE BOUNDARY: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `ENGINE OFFLINE BOUNDARY: PASS — ${pass}/${pass} checks — ${reached} modules in the engine's import closure, none reaching the network transport, the API module, a cloud bridge or a network primitive; the local marking path imports the engine's checker.`);
process.exit(failures.length ? 1 : 0);
