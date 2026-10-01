// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one product, thin shells (CP-01 cross-platform architecture)
//
// Pri is meant to reach iPad, iPhone, Android phones and Android tablets as one
// shared React product inside thin native shells, not as a separate app per
// platform. That only holds while a few things stay true, and each of them is
// easy to break without noticing:
//
//   · product code must not grow new direct calls into Apple's WKWebView bridge
//     — every new `window.webkit.messageHandlers` call is one more thing Android
//     has to fake. The set of files allowed to do it may only shrink (CP-02
//     shrinks it to the platform contract module);
//   · layout must not sniff the device;
//   · the bundled web origin is the key to every student's IndexedDB data, so
//     the shell's origin and persistent data store must never change silently;
//   · no shell may carry a server secret;
//   · the cross-platform documents must exist, cover every capability the brief
//     names, and cite only files that actually exist (or are declared planned).
//
// Run on its own:  node client/test/cross-platform-architecture-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const at = rel => join(ROOT, rel);
const read = rel => readFileSync(at(rel), 'utf8');
const posix = p => p.split(sep).join('/');

function walk(dir, keep, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'build' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, keep, out);
    else if (keep(name)) out.push(full);
  }
  return out;
}

const DOCS = 'docs/cross-platform';
const REQUIRED_DOCS = [
  'README.md',
  'CROSS_PLATFORM_ARCHITECTURE.md',
  'CAPABILITY_MATRIX.md',
  'FORM_FACTOR_SPEC.md',
  'IPHONE_GAP_REPORT.md',
  'ANDROID_ARCHITECTURE.md',
  'CROSS_PLATFORM_TEST_MATRIX.md',
  'IMPLEMENTATION_PLAN.md',
];

// ── 1 · The documents exist and are substantive ──────────────────────────────
const docs = {};
for (const name of REQUIRED_DOCS) {
  const rel = `${DOCS}/${name}`;
  const present = existsSync(at(rel));
  ok(present, `${rel} exists`);
  docs[name] = present ? read(rel) : '';
  if (name !== 'README.md') ok(docs[name].length > 3000, `${rel} is substantive, not a stub`);
}

// ── 2 · Every capability the brief names has a row in the matrix ─────────────
const REQUIRED_CAPABILITIES = [
  'Application shell', 'Navigation', 'Authentication', 'Secure credential/session handling',
  'Cloud HTTP transport', 'Local persistence', 'IndexedDB/localStorage', 'Offline queue',
  'Handwriting input', 'Stylus input', 'Finger input', 'Typed maths', 'Camera/photo',
  'Handwriting recognition', 'Working recognition', 'Submission/grading', 'AI feedback',
  'Sharing', 'File import/export', 'Deep links', 'Billing', 'Purchase restore',
  'Subscriptions/entitlements', 'Push notifications', 'Background/foreground lifecycle',
  'Keyboard behaviour', 'Screen rotation', 'Safe areas/notches', 'Accessibility', 'Analytics',
  'Error reporting', 'Release identity', 'App updates/version compatibility',
];
const matrixRows = new Map();
for (const line of docs['CAPABILITY_MATRIX.md'].split('\n')) {
  const cells = line.split('|').map(c => c.trim());
  if (cells.length > 9 && cells[1] && !/^-+$/.test(cells[1])) matrixRows.set(cells[1], cells);
}
for (const cap of REQUIRED_CAPABILITIES) {
  const row = matrixRows.get(cap);
  ok(!!row, `the capability matrix has a row for "${cap}"`);
  // Shared core, Apple, Android, browser, status, risks, owner — none left blank.
  if (row) ok(row.slice(2, 9).every(c => c.length > 0), `the "${cap}" row fills every column`);
}

// ── 3 · The plan covers CP-02 … CP-12 with every required field ──────────────
const plan = docs['IMPLEMENTATION_PLAN.md'];
const FIELDS = ['Goal', 'Files', 'Scope', 'Non-goals', 'Dependencies', 'Acceptance tests',
  'Automated gates', 'Physical-device gates', 'Rollback criteria', 'Done when'];
for (let n = 2; n <= 12; n++) {
  const id = `CP-${String(n).padStart(2, '0')}`;
  const start = plan.indexOf(`## ${id} `);
  ok(start >= 0, `the implementation plan has a ${id} section`);
  if (start < 0) continue;
  const next = plan.indexOf('\n## ', start + 4);
  const section = plan.slice(start, next < 0 ? undefined : next);
  for (const field of FIELDS) {
    ok(new RegExp(`\\*\\*${field.replace('-', '\\-')}[^*]*:\\*\\*`).test(section), `${id} states its ${field.toLowerCase()}`);
  }
}

// ── 4 · Physical evidence is kept apart from synthetic evidence ──────────────
const tm = docs['CROSS_PLATFORM_TEST_MATRIX.md'];
ok(/Physical-device-only gates/.test(tm), 'the test matrix has a separate physical-device-only section');
ok(/never be simulated, inferred/.test(tm), 'and says physical evidence is never inferred from simulators');
for (const id of ['A1', 'A2', 'A3', 'A4', 'A5', 'D1', 'D2', 'D3', 'D4', 'D5']) {
  ok(new RegExp(`^\\| ${id} \\|`, 'm').test(tm), `the device matrix includes row ${id}`);
}
ok(/no physical-iPhone evidence/i.test(docs['IPHONE_GAP_REPORT.md']),
  'the iPhone report does not claim physical-iPhone evidence that does not exist');

// ── 5 · Docs cite only files that exist (or are explicitly planned) ──────────
// Paths a CP task will create. Citing them is a plan, not a claim.
const PLANNED = [
  'client/src/platform/native/', 'android/', 'scripts/sync-android.mjs',
  'client/test/fixtures/native-envelope/', 'client/test/responsive-matrix.mjs',
  'client/test/native-host-contract-check.mjs', 'server/platform/googleBilling.js',
  'server/test/google-billing-check.mjs', '.github/workflows/android-shell.yml', 'scripts/iphone-journey.mjs',
];
// Build outputs that are gitignored, so a fresh CI checkout does not have them.
const GENERATED = ['client/dist'];
const CITABLE = /^(client|ios|server|scripts|tools|release|docs|\.github|\.pri-os)\//;
const cited = new Set();
for (const text of Object.values(docs)) {
  for (const m of text.matchAll(/`([^`\s]+)`/g)) {
    let p = m[1].replace(/:\d+$/, '');
    if (!CITABLE.test(p) || /[*{}<>…]/.test(p)) continue;
    cited.add(p);
  }
}
const missing = [...cited].filter(p => !PLANNED.some(pre => p.startsWith(pre)) &&
  !GENERATED.some(g => p === g || p.startsWith(`${g}/`)) && !existsSync(at(p)));
ok(cited.size > 40, `the docs cite real repository evidence (${cited.size} paths)`);
ok(missing.length === 0, `every cited path exists or is declared planned — missing: ${missing.join(', ')}`);

// ── 6 · Direct WebKit bridge access may only shrink (ratchet) ────────────────
// CP-02 replaces these with client/src/platform/native/ and must shrink this
// list to that module alone. Adding a file here is an architecture regression.
const WEBKIT_BRIDGE_ALLOWED = new Set([
  'client/src/ink/native.js',
  'client/src/native/photo.js',
  'client/src/platform/nativeBilling.js',
  'client/src/platform/cloudTransport.js',
  'client/src/lib/files.js',
  'client/src/components/InkPhysicalEvidenceSession.jsx',
]);
// Readers of the legacy injected `__PRI_NATIVE*__` flags (same ratchet).
const NATIVE_FLAG_ALLOWED = new Set([
  'client/dev/devStructural.js',
  'client/src/components/CloudAccountPanel.jsx',
  'client/src/ink/native.js',
  'client/src/ink/personal.js',
  'client/src/lib/files.js',
  'client/src/local/backend.js',
  'client/src/local/offlineWarm.js',
  'client/src/main.jsx',
  'client/src/native/photo.js',
  'client/src/pages/SettingsLegacy.jsx',
  'client/src/platform/cloudTransport.js',
  'client/src/platform/nativeBilling.js',
  'client/src/platform/releaseIdentity.js',
]);
const isContract = rel => rel.startsWith('client/src/platform/native/');
const sources = [...walk(at('client/src'), n => /\.(jsx?|mjs)$/.test(n)), ...walk(at('client/dev'), n => /\.(jsx?|mjs)$/.test(n))]
  .map(f => [posix(relative(ROOT, f)), readFileSync(f, 'utf8')]);

const webkitUsers = sources.filter(([, s]) => /(?<![-\w])webkit\s*\??\.\s*messageHandlers|\[\s*['"`]webkit['"`]\s*\]|\bmessageHandlers\b/.test(s)).map(([r]) => r);
const strayWebkit = webkitUsers.filter(r => !WEBKIT_BRIDGE_ALLOWED.has(r) && !isContract(r));
ok(strayWebkit.length === 0,
  `no new file calls window.webkit.messageHandlers directly (use the platform contract) — found: ${strayWebkit.join(', ')}`);
const staleWebkit = [...WEBKIT_BRIDGE_ALLOWED].filter(r => !webkitUsers.includes(r));
ok(staleWebkit.length === 0,
  `the WebKit bridge allowlist has no stale entries; tighten it — stale: ${staleWebkit.join(', ')}`);

const flagUsers = sources.filter(([, s]) => /__PRI_NATIVE(?:_[A-Z_]+)?__/.test(s)).map(([r]) => r);
const strayFlags = flagUsers.filter(r => !NATIVE_FLAG_ALLOWED.has(r) && !isContract(r));
ok(strayFlags.length === 0,
  `no new file reads the legacy __PRI_NATIVE*__ flags (use priNative capabilities) — found: ${strayFlags.join(', ')}`);
const staleFlags = [...NATIVE_FLAG_ALLOWED].filter(r => !flagUsers.includes(r));
ok(staleFlags.length === 0,
  `the native-flag allowlist has no stale entries; tighten it — stale: ${staleFlags.join(', ')}`);

// ── 7 · Layout does not sniff the device ─────────────────────────────────────
const sniffers = sources.filter(([, s]) => /navigator\s*\.\s*(userAgent|platform|vendor)\b/.test(s)).map(([r]) => r);
ok(sniffers.length === 0, `no shared client code sniffs navigator.userAgent/platform — found: ${sniffers.join(', ')}`);

// ── 8 · The iPad baseline and its data origin stay put ───────────────────────
const IOS = 'ios/PriLearning.swiftpm';
const pkg = read(`${IOS}/Package.swift`);
ok(/supportedDeviceFamilies:\s*\[[^\]]*\.pad/.test(pkg), 'the Apple package still declares iPad (regression baseline)');
ok(/supportedDeviceFamilies:\s*\[[^\]]*\.phone/.test(pkg), 'and iPhone, which the iPhone plan builds on');
const shell = read(`${IOS}/WebShell.swift`);
ok(/forURLScheme:\s*"prilearning"/.test(shell), 'the shell still serves the app from the prilearning:// scheme');
ok(/prilearning:\/\/app\//.test(shell),
  'at the prilearning://app origin — changing it would orphan every student\'s IndexedDB data');
ok(/WKWebsiteDataStore\.default\(\)/.test(shell), 'with the persistent website data store');
ok(/index\.html/.test(read(`${IOS}/LocalSchemeHandler.swift`)),
  'and the scheme handler keeps its index.html fallback that BrowserRouter routes depend on');
for (const copy of ['ios/PriLearning 2.swiftpm/WebShell.swift', 'ios/PriLearning 2.swiftpm/Package.swift']) {
  if (existsSync(at(copy))) ok(read(copy) === read(copy.replace('PriLearning 2.swiftpm', 'PriLearning.swiftpm')),
    `${copy} matches the canonical package`);
}

// Android, once it exists, must use an origin-scoped bridge and a stable origin.
if (existsSync(at('android'))) {
  const kotlin = walk(at('android'), n => /\.(kt|java)$/.test(n)).map(f => readFileSync(f, 'utf8')).join('\n');
  ok(!/addJavascriptInterface\s*\(/.test(kotlin), 'the Android shell never uses addJavascriptInterface');
  ok(/appassets\.androidplatform\.net/.test(kotlin), 'the Android shell serves the app from appassets.androidplatform.net');
}

// ── 9 · No shell carries a server secret ─────────────────────────────────────
const SECRET = [
  /sk-[A-Za-z0-9_-]{20,}/, /OPENAI_API_KEY/, /PRI_HANDWRITING_API_KEY/, /SUPABASE_SERVICE_ROLE/i,
  /service_role/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /AIza[0-9A-Za-z_-]{35}/, /rzp_live_[A-Za-z0-9]+/,
  /PRI_CSRF_SECRET/, /RAZORPAY_KEY_SECRET/,
];
const shellFiles = [
  ...walk(at('ios'), n => /\.(swift|plist|entitlements|json|xcconfig)$/.test(n))
    .filter(f => !posix(f).includes('/Resources/Web/')),
  ...walk(at('android'), n => /\.(kt|java|xml|gradle|kts|properties|json)$/.test(n)),
];
const leaking = shellFiles.filter(f => { const s = readFileSync(f, 'utf8'); return SECRET.some(re => re.test(s)); })
  .map(f => posix(relative(ROOT, f)));
ok(shellFiles.length > 20, `the secret scan covers the native shells (${shellFiles.length} files)`);
ok(leaking.length === 0, `no native shell file contains a server secret — found in: ${leaking.join(', ')}`);
const clientLeaks = sources.filter(([, s]) => /PRI_HANDWRITING_API_KEY|SUPABASE_SERVICE_ROLE|OPENAI_API_KEY|sk-[A-Za-z0-9_-]{20,}/.test(s)).map(([r]) => r);
ok(clientLeaks.length === 0, `no shared client file names a server-only secret — found: ${clientLeaks.join(', ')}`);

// ── 10 · The server's native-client exemption is a closed list ───────────────
// A new native client id widens the CSRF/origin boundary; CP-07 must add the
// regression test beside server/test/native-origin-csrf-check.mjs first.
const security = read('server/platform/security.js');
const clientIds = [...new Set([...security.matchAll(/'([a-z]+-native-v\d+)'/g)].map(m => m[1]))];
ok(clientIds.includes('ios-native-v1'), 'the server still recognises the iOS native client');
ok(clientIds.every(id => ['ios-native-v1', 'android-native-v1'].includes(id)),
  `the server recognises only planned native client ids — found: ${clientIds.join(', ')}`);
ok(!/["`][a-z]+-native-v\d+["`]|startsWith\(\s*['"`][a-z]*-?native/.test(security),
  'no native client id is matched by a double-quoted literal or a prefix test');
const exemption = security.match(/function nativeNonBrowserRequest\(req\)\s*\{([\s\S]*?)\n\}/);
ok(!!exemption, 'the native-client exemption is still one named predicate');
if (exemption) {
  const body = exemption[1].replace(/\/\/.*$/gm, '');
  ok(/!req\.get\('origin'\)/.test(body) && /!req\.get\('sec-fetch-site'\)/.test(body) && /!req\.get\('sec-fetch-mode'\)/.test(body),
    'and it still refuses any request carrying Origin or Fetch Metadata, so a web page cannot use it as a CSRF bypass');
  ok(!/\|\|/.test(body), 'with no OR branch that could widen it');
}

console.log(failures.length
  ? `CROSS-PLATFORM ARCHITECTURE: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `CROSS-PLATFORM ARCHITECTURE: PASS — ${pass}/${pass} checks — one shared product, WebKit bridge access confined to ${WEBKIT_BRIDGE_ALLOWED.size} files, the iPad data origin unchanged, no secrets in any shell.`);
process.exit(failures.length ? 1 : 0);
