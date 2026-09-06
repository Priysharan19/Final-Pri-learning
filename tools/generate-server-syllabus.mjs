#!/usr/bin/env node
// Pri Learning · server syllabus snapshot generator
//
// The production image ships the /v1 control plane and nothing of the client:
// production-runtime-image-check asserts client/src is absent, because the
// server must not depend on the app's source tree to boot. But the server does
// need to know the India syllabus, to refuse an assignment aimed at a chapter
// that does not exist and a difficulty above a track's ceiling.
//
// So the small part it needs — chapter ids with their names, class and dot-point
// counts, and the four tracks with their ceilings — is generated into
// server/platform/india-syllabus.generated.js from the one source of truth,
// client/src/engine/curriculum-in.js. server/test/india-syllabus-snapshot-check.mjs
// regenerates and compares, so the copy can never drift from the curriculum.
//
//   node tools/generate-server-syllabus.mjs           # write the snapshot
//   node tools/generate-server-syllabus.mjs --print   # print it instead
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { IN_CHAPTER_BY_ID, IN_TRACKS } = await import(join(ROOT, 'client/src/engine/curriculum-in.js'));

export function renderSyllabusSnapshot() {
  const chapters = Object.keys(IN_CHAPTER_BY_ID).sort().map(id => {
    const chapter = IN_CHAPTER_BY_ID[id];
    return {
      id,
      name: chapter.name,
      grade: Number.isFinite(chapter.grade) ? chapter.grade : null,
      dotpoints: Array.isArray(chapter.dotpoints) ? chapter.dotpoints.length : 0
    };
  });
  const tracks = Object.keys(IN_TRACKS).sort().map(id => ({
    id,
    name: IN_TRACKS[id].name,
    difficultyCeiling: IN_TRACKS[id].difficultyCeiling
  }));
  const lines = [
    '// GENERATED FILE — do not edit by hand.',
    '//',
    '// The part of the India syllabus the control plane needs to validate an',
    '// assignment target, generated from client/src/engine/curriculum-in.js by',
    '// tools/generate-server-syllabus.mjs. The production image ships no client',
    '// source, so the server reads this snapshot instead of importing the app.',
    '// server/test/india-syllabus-snapshot-check.mjs fails if the two drift.',
    '',
    `export const IN_TRACKS = Object.freeze({`,
    ...tracks.map(t => `  ${JSON.stringify(t.id)}: Object.freeze(${JSON.stringify(t)}),`),
    '});',
    '',
    'export const IN_CHAPTER_BY_ID = Object.freeze({',
    ...chapters.map(c => `  ${JSON.stringify(c.id)}: Object.freeze(${JSON.stringify(c)}),`),
    '});',
    ''
  ];
  return lines.join('\n');
}

const OUT = join(ROOT, 'server/platform/india-syllabus.generated.js');
if (process.argv.includes('--print')) {
  process.stdout.write(renderSyllabusSnapshot());
} else if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate-server-syllabus.mjs')) {
  const text = renderSyllabusSnapshot();
  writeFileSync(OUT, text);
  const chapters = (text.match(/^  "/gm) || []).length;
  console.log(`server syllabus snapshot written — ${chapters} entries → server/platform/india-syllabus.generated.js`);
}
