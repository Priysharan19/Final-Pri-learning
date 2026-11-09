// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the server's readiness estimate stays the device's estimate
//
// The server may not import the device's mark predictor (mark-predictor-check:
// the server decides every mark). It keeps its own copy instead
// (server/platform/readinessEstimate.js), and this check holds the two equal
// on a fixture set, so they cannot drift. It also pins that the estimate can
// never reach a mark: only the read-only forecast route imports it, and only
// the router imports that route.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as device from '../src/engine/markPredictor.js';
import * as server from '../../server/platform/readinessEstimate.js';
import { INDIA_EXAM_PAPER_SPECS, indiaExamBlueprint } from '../src/engine/indiaExams.js';

let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (v, m) => { assert.ok(v, m); n++; };

// Every paper the product estimates, at many evidence shapes.
const papers = [...new Map([...INDIA_EXAM_PAPER_SPECS,
  indiaExamBlueprint({ track: 'jee-main', grade: 12 }), indiaExamBlueprint({ track: 'jee-advanced', grade: 12 })]
  .filter(b => b?.units?.length).map(b => [b.id, b])).values()];
ok(papers.length >= 4, `fixture papers: ${papers.length}`);

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const NOW = Date.parse('2026-11-10T06:00:00Z');
const DAY = 86_400_000;
for (const bp of papers) {
  const chapters = bp.units.flatMap(u => u.chapters);
  for (let k = 0; k < 12; k++) {
    const ratings = {};
    const share = k / 11; // from nothing practised to everything
    for (const ch of chapters) {
      if (rand() > share) continue;
      const attempts = 1 + Math.floor(rand() * 60);
      ratings[ch] = { attempts, correct: Math.floor(rand() * (attempts + 1)), rating: 700 + Math.floor(rand() * 1100), last_at: NOW - Math.floor(rand() * 200) * DAY };
    }
    if (k === 3) ratings[chapters[0]] = { attempts: 'x', correct: null, rating: undefined, last_at: 0 }; // malformed row
    eq(server.estimateExamMarks(bp, ratings, { nowMs: NOW }), device.predictExamMark(bp, ratings, { nowMs: NOW }), `${bp.id} fixture ${k}: server and device agree exactly`);
  }
  eq(server.paperDifficultyRating(bp), device.paperDifficultyRating(bp), `${bp.id}: same paper difficulty`);
}
eq(server.COVERAGE_FLOOR, device.COVERAGE_FLOOR, 'the same coverage floor');
eq(server.estimateExamMarks({ units: [] }), device.predictExamMark({ units: [] }), 'the same refusal for an empty blueprint');
for (const d of [0, 1, 30, 400]) eq(server.freshness(NOW - d * DAY, NOW), device.freshness(NOW - d * DAY, NOW), `the same freshness at ${d} days`);

// The estimate can never feed a mark.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(m?js|jsx)$/.test(name)) out.push(p);
  }
  return out;
};
const rel = p => relative(ROOT, p).split('\\').join('/');
const importers = re => walk(join(ROOT, 'server')).concat(walk(join(ROOT, 'client/src'))).filter(p => re.test(readFileSync(p, 'utf8'))).map(rel).sort();
const names = mod => new RegExp(`(?:from\\s*|import\\s*\\(\\s*|import\\s+)['"][^'"]*${mod}(?:\\.js)?['"]`);
eq(importers(names('readinessEstimate')).filter(p => !p.startsWith('server/test/')), ['server/platform/forecast.js'], 'only the read-only forecast route imports the server estimate');
eq(importers(names('/forecast')).filter(p => !p.startsWith('server/test/')), ['server/platform/router.js'], 'and only the router mounts that route: no marker, grader, sync or billing module imports it');
const own = readFileSync(join(ROOT, 'server/platform/readinessEstimate.js'), 'utf8');
eq([...own.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]), ['../../client/src/engine/adaptive.js'], 'the server estimate imports only the rating maths');
const route = readFileSync(join(ROOT, 'server/platform/forecast.js'), 'utf8');
ok(!/\b(INSERT|UPDATE|DELETE)\b/.test(route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'the forecast route writes nothing: no estimate is ever stored where a mark could read it');

console.log(`FORECAST PARITY: PASS — ${n}/${n} checks`);
