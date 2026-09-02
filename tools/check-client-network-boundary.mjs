import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SRC = join(ROOT, 'client', 'src');
const ALLOWED = new Set([
  'client/src/platform/cloudTransport.js'
]);
const NETWORK = /\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\s*\(|\bWebSocket\s*\(|\bEventSource\s*\(/g;

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...files(path));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const violations = [];
let scanned = 0;
let networkFiles = 0;
for (const path of files(SRC)) {
  scanned++;
  const rel = relative(ROOT, path).replaceAll('\\', '/');
  const text = readFileSync(path, 'utf8');
  const hits = [...text.matchAll(NETWORK)];
  if (!hits.length) continue;
  networkFiles++;
  if (!ALLOWED.has(rel)) {
    violations.push(`${rel}: ${hits.length} network primitive(s) outside the audited transport boundary`);
  }
}

for (const allowed of ALLOWED) {
  const path = join(ROOT, allowed);
  const text = readFileSync(path, 'utf8');
  if (!/\bfetch\s*\(/.test(text)) violations.push(`${allowed}: allowed transport no longer contains its explicit fetch boundary`);
  if (!/credentials:\s*['"]include['"]/.test(text)) violations.push(`${allowed}: cloud requests must keep cookie/session credentials explicit`);
  if (!/redirect:\s*['"]error['"]/.test(text)) violations.push(`${allowed}: redirects must fail closed`);
  if (!/cache:\s*['"]no-store['"]/.test(text)) violations.push(`${allowed}: production account/sync responses must not be cached`);
}

if (violations.length) {
  console.error('CLIENT NETWORK BOUNDARY — FAIL');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(`CLIENT NETWORK BOUNDARY — PASS — ${scanned} source files scanned; ${networkFiles} file opens network connections; audited allow-list size ${ALLOWED.size}.`);
