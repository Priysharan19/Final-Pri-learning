// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · dev — the Vite dev server, and the legacy API beside it.
//
// The app the browser runs is local-first: client/src/api.js dispatches every
// call to client/src/local/backend.js and IndexedDB, and there is not one
// fetch() in the client. So Vite is the only process a developer actually needs,
// and the legacy Express server is a bonus rather than a dependency.
//
// It used to be a fatal one. Both children shared a single exit handler that
// killed the other and took this process down with it, so `node server/index.js`
// failing to start — which is what it does on any checkout without
// server/node_modules — killed the dev server 40 ms after it launched and left
// `npm run dev` exiting 1 with nothing but a module-resolution stack. The two
// lifetimes are separate now: the API server is started, its failure is said out
// loud in one line, and Vite carries on without it.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process';

const say = (line) => process.stdout.write(`[dev] ${line}\n`);

// ── The dev server — this is the one that matters ────────────────────────────

const vite = spawn('npm', ['run', 'dev', '--prefix', 'client'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

vite.on('error', (err) => {
  say(`could not start Vite: ${err.message}`);
  process.exit(1);
});
vite.on('exit', (code, signal) => {
  stopApi();
  process.exit(signal ? 1 : code ?? 0);
});

// ── The legacy API server — optional, and never fatal ────────────────────────

const api = spawn('node', ['server/index.js'], {
  stdio: ['ignore', 'inherit', 'pipe'],
  env: { ...process.env, PORT: process.env.PORT || '4000' }
});

let apiErr = '';
api.stderr.on('data', (chunk) => { apiErr += chunk; });
api.on('error', (err) => { apiErr = err.message; });
api.on('exit', (code) => {
  if (code === 0 || code === null) return;
  const reason = /Cannot find package '(.+?)'/.exec(apiErr);
  say(reason
    ? `the legacy API server did not start (${reason[1]} is not installed — run npm install --prefix server). The client does not use it, so Vite is still up.`
    : `the legacy API server exited with code ${code}. The client does not use it, so Vite is still up.`);
});

// ── Shutdown ─────────────────────────────────────────────────────────────────

const stopApi = () => { if (api.exitCode === null && !api.killed) api.kill(); };
const stopAll = () => { stopApi(); if (vite.exitCode === null && !vite.killed) vite.kill(); };

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopAll(); process.exit(0); });
}
