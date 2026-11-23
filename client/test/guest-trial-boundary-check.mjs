// Pri Learning · the guest trial's online-only boundary (ADR-0003; ADR-0001 amendment 2026-10-10)
//
// The decided rule: a signed-out visitor may have a bounded number of typed or
// multiple-choice answers marked, by the SERVER. What this suite holds, in
// source, so the rule cannot widen by accident:
//   · nothing under client/src/guest marks, reads a key or imports the engine's
//     marker; it talks to the server only through the audited transport, whose
//     three guest calls are the only new ones;
//   · the guest code has no path to handwriting, photo, the tutor, sync, the
//     account or the local backend, and stores nothing but the last picker choice;
//   · the SIGNED-IN guarantees are unchanged: the local backend's submit
//     handler still awaits a server acknowledgement and never computes a mark
//     (the same assertion online-marking-authority-check.mjs makes), the
//     signed-out local backend still refuses a check (online-check-access-check
//     keeps asserting SIGN_IN_TO_CHECK), and the guest screen is not offered in
//     a native shell;
//   · the limits the ADR states are the limits the server code holds.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(join(root, p), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const dir = join(root, 'client/src/guest');
const files = readdirSync(dir).filter(f => /\.(js|jsx)$/.test(f));
ok(files.length >= 4, `the guest sources exist (${files.join(', ')})`);
for (const f of files) {
  // Comments may name what the code must not do; only code is held to it.
  const src = read(`client/src/guest/${f}`).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  ok(!/engine\/(checker|stepCheck|marker)|checkAnswer|markSubmission|stepCheck|methodMarks/.test(src), `${f}: no marking code`);
  ok(!/local\/(backend|store|idb|gateway)|ink\/|photo|tutor|handwriting|\/v1\/(account|sync|practice|exams|billing)/.test(src), `${f}: no path to the local backend, ink, photo, tutor, sync, account or practice routes`);
  ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon/.test(src), `${f}: no network primitive of its own`);
  ok(!/indexedDB|sessionStorage|document\.cookie/.test(src), `${f}: no store but the picker's remembered choice`);
  const stores = [...src.matchAll(/localStorage\.(set|get|remove)Item\(([^)]*)\)/g)].map(m => m[2]);
  ok(stores.every(s => /STORE|`pri\.picker/.test(s)), `${f}: localStorage holds only the last picker choice (${stores.join(' ; ') || 'none'})`);
}
const transport = read('client/src/platform/cloudTransport.js');
const guestCalls = [...transport.matchAll(/guest(?:Start|Question|Steps|Answer):[^\n]*'(\/v1\/[a-z/]+)'/g)].map(m => m[1]);
ok(JSON.stringify(guestCalls) === JSON.stringify(['/v1/guest/session', '/v1/guest/question', '/v1/guest/steps', '/v1/guest/answer']), `the transport adds exactly the four guest calls (${guestCalls})`);
ok(/typeof guestCsrf === 'string'/.test(transport) && /X-Pri-Guest-CSRF/.test(transport), 'and sends the guest CSRF value only when given one');
const session = read('client/src/guest/guestTrial.js');
ok(/isNativeShell\(\)/.test(session) && /nativeCloudAvailable\(\)/.test(session), 'the guest screen is not offered inside a native shell');
const app = read('client/src/App.jsx');
ok(/guestTrialAvailable\(\) && <Route path="\/" element=\{<FirstScreen \/>\}/.test(app) && /<Route path="\/signin" element=\{<Login \/>\}/.test(app), 'the first screen is the guest picker only where available, and /signin is the sign-in page');
ok(/r\?\.profiles\?\.length \? 'device' : 'visitor'/.test(app) && /first === 'visitor' \? <GuestTry \/> : <Login \/>/.test(app), 'a device that holds a saved profile still opens on its sign-in picker; only a device with none is a visitor');
const guestRoutes = (app.match(/<GuestTry/g) || []).length;
ok(guestRoutes === 1, `GuestTry is mounted once, signed out (${guestRoutes})`);

// The signed-in rule is untouched.
const backend = read('client/src/local/backend.js');
const segment = backend.split("'POST /practice/:id/submit': async (body, params) => {")[1]?.split('\n  },')[0];
ok(segment && !/(?:^|\n)\s*const\s*\{\s*result[^\n]*\}\s*=\s*markSubmission\(/m.test(segment), 'the local submit handler still computes no authoritative result');
ok(/await\s+(?:[\w.]+)?(?:submit|grade|acknowledge|authority|markOnServer)[\w.]*\s*\(/i.test(segment), 'and still awaits a server action');
ok(/SIGN_IN_TO_CHECK/.test(backend), 'the local backend still refuses a signed-out check');
ok(!/guest/i.test(backend), 'the local backend knows nothing of guests');

// The server holds the limits the ADR states.
const adr = read('docs/architecture/adr-0003-guest-trial.md');
const { GUEST_DEFAULTS } = await import('../../server/platform/guestTrial.js');
ok(GUEST_DEFAULTS.limit === 5 && /\*\*5\*\*/.test(adr), 'five questions per token per day');
ok(GUEST_DEFAULTS.ipDayLimit === 15 && /15 per client address/.test(adr), 'fifteen per address across tokens');
ok(GUEST_DEFAULTS.mintDayLimit === 6 && /6 tokens minted/.test(adr), 'six tokens per address');
ok(GUEST_DEFAULTS.globalDayLimit === 5000 && /5,000/.test(adr), 'the process-wide ceiling');
ok(GUEST_DEFAULTS.minAnswerMs === 2000 && GUEST_DEFAULTS.unreadableTries === 3, 'think time and unreadable retries');
for (const doc of ['AGENTS.md', 'docs/architecture/authoritative-architecture.md', 'docs/architecture/adr-0001-online-first-runtime.md']) ok(/ADR-0003/.test(read(doc)), `${doc} cites ADR-0003`);
console.log(`GUEST TRIAL BOUNDARY: PASS - ${n} checks - the guest path marks nothing on a device and reaches nothing of an account; the signed-in rule is unchanged`);
