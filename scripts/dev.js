// Runs the API server and the Vite dev server together.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: '4000' } }),
  spawn('npm', ['run', 'dev', '--prefix', 'client'], { stdio: 'inherit', shell: process.platform === 'win32' })
];

for (const p of procs) {
  p.on('exit', (code) => {
    for (const q of procs) if (!q.killed) q.kill();
    process.exit(code ?? 0);
  });
}
