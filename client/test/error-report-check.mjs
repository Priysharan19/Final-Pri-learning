// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · crash reports from the client and the iPad shell (ledger 1.7)
//
// The report is coded: platform, surface slug, code, scope, fingerprint,
// release. Never the message, the stack or the URL. The device preference
// gates it, the boundary calls it, the shell relays its own failures through
// it, and the budget refusal (ledger 1.8) is understood everywhere the
// allowance refusal is.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n++; };

// A minimal localStorage so the preference can be exercised in Node.
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const t = await import('../src/platform/telemetry.js');

// ── The report shape ───────────────────────────────────────────────────────
const error = new Error('Cannot read properties of undefined (reading "answer") for student 42 <secret@example.test>');
error.stack = 'TypeError: Cannot read…\n    at QuestionCard (http://localhost:5173/assets/index-Ab12Cd34.js:10:20)\n    at renderWithHooks (…)';
const report = t.crashReport({ surface: 'guardian consent', code: 'RENDER_ERROR', scope: 'app', error, platform: 'web', at: 1_700_000_000_000 });
assert.deepEqual(Object.keys(report).sort(), ['at', 'code', 'fingerprint', 'platform', 'scope', 'surface'], 'a report carries only the coded fields (no release outside a real build)'); n++;
eq(report.surface, 'guardian-consent', 'the boundary\'s scope name becomes a slug');
eq(report.code, 'RENDER_ERROR', 'the code is kept');
ok(/^[a-f0-9]{8}$/.test(report.fingerprint), 'the fingerprint is 8 hex characters');
const serialized = JSON.stringify(report);
for (const leak of ['secret@example.test', 'Cannot read', 'localhost', 'answer', '42']) ok(!serialized.includes(leak), `the report never carries "${leak}"`);
eq(t.crashFingerprint(error), t.crashFingerprint(Object.assign(new Error('Cannot read properties of undefined (reading "name") for student 7 <other@example.test>'), { stack: error.stack })), 'two instances of the same fault, different data, share a fingerprint');
ok(t.crashFingerprint(error) !== t.crashFingerprint(new RangeError('Maximum call stack')), 'a different fault has a different fingerprint');
eq(t.crashReport({ surface: 'x', code: 'not a code', scope: 'route' }).code, 'CLIENT_ERROR', 'prose where a code belongs is replaced, so the server never sees it');
eq(t.crashReport({ surface: 'x', scope: 'everywhere' }), null, 'an unknown scope is not sent');
eq(t.surfaceSlug('/practice?token=abc'), 'practice-token-abc', 'a path becomes a slug (and the server still refuses anything longer than 40)');
eq(t.surfaceSlug(''), 'unknown', 'nothing becomes unknown');
eq(t.clientPlatform(), 'web', 'outside a shell the platform is web');

// ── The device preference ──────────────────────────────────────────────────
eq(t.errorReportsEnabled(), true, 'on by default');
let seen = null;
const off = t.onErrorReportsChange(v => { seen = v; });
eq(t.setErrorReportsEnabled(false), false, 'one tap turns it off');
eq(store.get(t.ERROR_REPORTS_KEY), 'off', 'remembered on this device');
eq(seen, false, 'listeners hear it');
eq(await t.reportCrash({ surface: 'practice', code: 'RENDER_ERROR', scope: 'route', error }), false, 'with it off nothing is sent');
eq(t.setErrorReportsEnabled(true), true, 'and back on');
ok(!store.has(t.ERROR_REPORTS_KEY), 'the default needs no stored value');
off();
eq(await t.reportCrash({ surface: 'practice', code: 'RENDER_ERROR', scope: 'route', error }), false, 'with no cloud account configured nothing is sent either (and nothing throws)');

// ── Wiring ─────────────────────────────────────────────────────────────────
const boundary = read('../src/components/ErrorBoundary.jsx');
ok(/componentDidCatch\([\s\S]*reportCrash\(\{ surface: this\.props\.scope, code: 'RENDER_ERROR'/.test(boundary), 'ErrorBoundary reports from componentDidCatch with its scope and a fixed code');
ok(!/reportCrash\([^)]*message/.test(boundary), 'and never passes the message');
const transport = read('../src/platform/cloudTransport.js');
ok(/reportError: report => cloudRequest\('\/v1\/telemetry\/error', \{ method: 'POST'/.test(transport), 'the transport posts to /v1/telemetry/error');
const main = read('../src/main.jsx');
ok(/installShellErrorReporting\(\)/.test(main), 'the shell relay is installed at boot');
const native = read('../src/platform/native/index.js');
ok(/bus\.on\('shell\.error'/.test(native) && /shell,/.test(native), 'priNative.shell.onError subscribes to shell.error events');
const shell = read('../../ios/PriLearning.swiftpm/WebShell.swift');
ok(/func webViewWebContentProcessDidTerminate\(_ webView: WKWebView\)[\s\S]*WEBCONTENT_TERMINATED[\s\S]*webView\.reload\(\)/.test(shell), 'the iPad shell reloads after a WebContent kill and remembers the code');
ok(/flushPendingShellError\(\)/.test(shell) && /host\.reportShellError\(code\)/.test(shell), 'and hands the code to the page once it has loaded again');
const bridge = read('../../ios/PriLearning.swiftpm/NativeHostBridge.swift');
ok(/func reportShellError\(_ code: String\)[\s\S]*emit\("shell\.error", \["code": code, "platform": "ios-shell"\]\)/.test(bridge), 'the host bridge emits shell.error with the code and platform only');
const settings = read('../src/pages/SettingsLegacy.jsx');
ok(/setErrorReportsEnabled\(e\.target\.checked\)/.test(settings) && /settings\.crashReportsCopy/.test(settings), 'Settings has the crash-report toggle with its copy');
for (const lang of ['en', 'hi']) {
  const strings = read(`../src/i18n/strings.${lang}.js`);
  for (const key of ['settings.crashReportsTitle', 'settings.crashReportsLabel', 'settings.crashReportsCopy', 'ink.aiBudgetUsed', 'cloudError.aiDailyBudgetExhausted']) {
    ok(strings.includes(`'${key}':`), `${lang} has ${key}`);
  }
}
const en = read('../src/i18n/strings.en.js');
ok(/'settings\.crashReportsCopy': '[^']*Never the question, your answer, your writing, your name/.test(en), 'the copy promises exactly what is not sent');

// ── The budget refusal is understood where the allowance refusal is ────────
const cloudReader = read('../src/ink/cloudReader.js');
ok(/BUDGET_CODE = 'AI_DAILY_BUDGET_EXHAUSTED'/.test(cloudReader) && /reason: allowanceReason/.test(cloudReader), 'the cloud reader backs off on the budget code with its own reason');
const ink = read('../src/ink/InkAnswer.jsx');
ok(/status\?\.kind === 'budget'[\s\S]*t\('ink\.aiBudgetUsed'\)/.test(ink), 'the ink answer shows the budget sentence');
ok(/AI_DAILY_BUDGET_EXHAUSTED/.test(read('../src/lib/questionPhoto.js')), 'the photo reader treats it as the allowance state');
ok(/AI_DAILY_BUDGET_EXHAUSTED/.test(read('../src/tutor/TutorHelp.jsx')), 'the tutor falls back to the authored hints');
ok(/AI_DAILY_BUDGET_EXHAUSTED: 'cloudError\.aiDailyBudgetExhausted'/.test(read('../src/platform/cloudErrorCopy.js')), 'and the error copy table names it');

console.log(`ERROR REPORTS: PASS — ${n}/${n} checks — coded crash reports (no message, stack or URL), device preference, boundary and iPad-shell wiring, budget refusal understood by every paid surface.`);
