// The teacher-marked page tour draws the engine's REAL reports. This fails if the saved file is not what the server's marking path returns today.
//   node server/test/teacher-page-real-reports-check.mjs
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, [new URL('./support/teacher-page-real-reports.mjs', import.meta.url).pathname, '--check'], { encoding: 'utf8' });
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
