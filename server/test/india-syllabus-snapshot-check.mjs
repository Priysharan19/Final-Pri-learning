// The control plane validates assignment targets against a generated snapshot
// of the India syllabus, because the production image ships no client source.
// A snapshot that drifts from the curriculum would refuse real chapters or
// accept retired ones, so this regenerates it and compares byte for byte.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSyllabusSnapshot } from '../../tools/generate-server-syllabus.mjs';
import { IN_CHAPTER_BY_ID, IN_TRACKS } from '../platform/india-syllabus.generated.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const onDisk = readFileSync(join(ROOT, 'server/platform/india-syllabus.generated.js'), 'utf8');
ok(onDisk === renderSyllabusSnapshot(),
  'the snapshot matches the curriculum — run `node tools/generate-server-syllabus.mjs` after changing curriculum-in.js');

const live = await import(join(ROOT, 'client/src/engine/curriculum-in.js'));
ok(Object.keys(IN_CHAPTER_BY_ID).length === Object.keys(live.IN_CHAPTER_BY_ID).length,
  `every chapter is in the snapshot (${Object.keys(IN_CHAPTER_BY_ID).length} vs ${Object.keys(live.IN_CHAPTER_BY_ID).length})`);
ok(Object.keys(IN_TRACKS).length === Object.keys(live.IN_TRACKS).length, 'every track is in the snapshot');
for (const [id, track] of Object.entries(IN_TRACKS)) {
  ok(track.difficultyCeiling === live.IN_TRACKS[id].difficultyCeiling, `${id} keeps its difficulty ceiling`);
}
const sample = 'c10-quadratic-equations';
ok(IN_CHAPTER_BY_ID[sample]?.dotpoints === live.IN_CHAPTER_BY_ID[sample].dotpoints.length,
  'a chapter keeps its dot-point count');

// The snapshot exists so the server never reaches into the app's source tree.
const validator = readFileSync(join(ROOT, 'server/platform/assignmentTargets.js'), 'utf8');
ok(!/client\/src/.test(validator), 'the validator does not import client source, which the production image omits');

console.log(failures.length
  ? `INDIA SYLLABUS SNAPSHOT: FAIL — ${failures.length} of ${pass + failures.length}\n  · ${failures.join('\n  · ')}`
  : `INDIA SYLLABUS SNAPSHOT: PASS — ${pass}/${pass} checks — the server's syllabus copy matches the curriculum and needs no client source.`);
process.exit(failures.length ? 1 : 0);
