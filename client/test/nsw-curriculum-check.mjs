// Plan mission G2 (ADR-0002): the versioned NSW curriculum model.
//
// Proves, deterministically and offline:
//   - every syllabus names jurisdiction, id, version and dated https sources;
//   - every outcome code is well formed for its syllabus, numbered without
//     gaps, unique within its syllabus and across all NSW syllabuses;
//   - the superseded 2017 syllabuses are marked superseded and hold only
//     well-formed topic codes;
//   - the crosswalk has exactly one row per legacy `nsw` subtopic, each row's
//     codes are current outcomes (never a superseded code), its status and
//     placement follow from its dot points, and its historical codes are the
//     2017 topics its curriculum.js label names;
//   - the `new-no-generator` rows are exactly the outcomes no subtopic reaches;
//   - every legacy subtopic still has a generator, and the coverage numbers
//     are the pinned ones;
//   - the model imports nothing outside its directory and nothing imports it;
//   - a branch that changes the model leaves the India curriculum, the legacy
//     NSW course, the generators and the practice server byte-unchanged.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUBTOPICS, SUBTOPIC_BY_ID } from '../src/engine/curriculum.js';
import {
  NSW_CURRENT_SYLLABUSES, NSW_SUPERSEDED_SYLLABUSES, NSW_SYLLABUSES, NSW_SYLLABUS_BY_ID,
  NSW_OUTCOME_BY_CODE, NSW_HISTORICAL_TOPIC_BY_CODE, LEGACY_CROSSWALK, NEW_OUTCOME_GAPS, NSW_CROSSWALK,
  CROSSWALK_STATUSES, CROSSWALK_PLACEMENTS, outcomesOf, derivedStatus, derivedPlacement, legacyTopicCodes
} from '../src/engine/curriculum-nsw/index.js';
import { nswCoverage, formatNswCoverage } from '../src/engine/curriculum-nsw/coverage.js';
import { legacyNswGeneratorIds } from '../src/engine/curriculum-nsw/legacyGenerators.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const modelDir = join(here, '..', 'src', 'engine', 'curriculum-nsw');

let checks = 0;
const failures = [];
function check(ok, message) {
  checks += 1;
  if (!ok) failures.push(message);
}

// ── Syllabus objects ────────────────────────────────────────────────────────
const SOURCE_HOSTS = new Set(['curriculum.nsw.edu.au', 'www.nsw.gov.au', 'education.nsw.gov.au']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACCESS_FLOOR = '2026-11-13'; // G1/G2 research date; an older access date is stale evidence.

function deepFrozen(value, path) {
  if (value === null || typeof value !== 'object') return;
  check(Object.isFrozen(value), `${path} is not frozen`);
  for (const [k, v] of Object.entries(value)) deepFrozen(v, `${path}.${k}`);
}

const ids = new Set();
for (const s of NSW_SYLLABUSES) {
  check(!ids.has(s.id), `duplicate syllabus id ${s.id}`);
  ids.add(s.id);
  check(s.jurisdiction === 'NSW', `${s.id}: jurisdiction must be NSW`);
  check(s.authority === 'NESA', `${s.id}: authority must be NESA`);
  check(/^\d{4}$/.test(s.version), `${s.id}: version must be a year`);
  check(s.id.endsWith(s.version), `${s.id}: id must end with its version ${s.version}`);
  check(typeof s.title === 'string' && s.title.includes(`(${s.version})`), `${s.id}: title must name its version`);
  check(Array.isArray(s.sources) && s.sources.length > 0, `${s.id}: needs at least one source`);
  for (const src of s.sources || []) {
    let url = null;
    try { url = new URL(src.url); } catch { /* reported below */ }
    check(url && url.protocol === 'https:' && SOURCE_HOSTS.has(url.host), `${s.id}: source ${src.url} must be an https NESA/NSW page`);
    check(ISO_DATE.test(src.accessed) && !Number.isNaN(Date.parse(src.accessed)), `${s.id}: source ${src.url} needs an ISO access date`);
    check(src.accessed >= ACCESS_FLOOR, `${s.id}: source ${src.url} access date ${src.accessed} predates ${ACCESS_FLOOR}`);
    check(typeof src.supports === 'string' && src.supports.length > 0, `${s.id}: source ${src.url} must say what it supports`);
  }
  deepFrozen(s, s.id);
}

const CODE_RULES = {
  'nsw-mathematics-k-10-2022': { re: /^MA([45])-([A-Z]{3})-([CP])-(\d{2})$/, count: 57 },
  'nsw-mathematics-standard-11-12-2024': { re: /^MST-(11|12-S[12])-(\d{2})$/, count: 25 },
  'nsw-mathematics-advanced-11-12-2024': { re: /^MAV-(1[12])-(\d{2})$/, count: 18 },
  'nsw-mathematics-extension1-11-12-2024': { re: /^ME1-(1[12])-(\d{2})$/, count: 11 },
  'nsw-mathematics-extension2-11-12-2024': { re: /^ME2-(12)-(\d{2})$/, count: 5 }
};
check(NSW_CURRENT_SYLLABUSES.length === Object.keys(CODE_RULES).length, 'one code rule per current syllabus');

const allCodes = new Map();
for (const s of NSW_CURRENT_SYLLABUSES) {
  const rule = CODE_RULES[s.id];
  check(!!rule, `${s.id}: no code rule`);
  if (!rule) continue;
  check(s.status === 'current', `${s.id}: must be current`);
  check(s.overarchingOutcome === 'MAO-WM-01', `${s.id}: overarching outcome is MAO-WM-01`);
  const outcomes = outcomesOf(s);
  check(outcomes.length === rule.count, `${s.id}: ${outcomes.length} outcomes, expected ${rule.count}`);
  const series = new Map();
  const faKeys = new Set();
  for (const fa of s.focusAreas) {
    check(typeof fa.name === 'string' && fa.name.trim() === fa.name && fa.name.length > 0 && fa.name.length <= 80, `${s.id}: bad focus-area name "${fa.name}"`);
    check(!('code' in fa), `${s.id}/${fa.name}: focus areas carry no NESA code`);
    const key = `${fa.stage ?? fa.year}|${fa.course ?? ''}|${fa.name}`;
    check(!faKeys.has(key), `${s.id}: duplicate focus area ${key}`);
    faKeys.add(key);
    check(fa.outcomes.length > 0, `${s.id}/${fa.name}: no outcomes`);
    if (fa.contentGroups) {
      check(new Set(fa.contentGroups).size === fa.contentGroups.length, `${s.id}/${fa.name}: duplicate content group`);
      for (const g of fa.contentGroups) check(typeof g === 'string' && g.length > 0 && g.length <= 80, `${s.id}/${fa.name}: bad content group "${g}"`);
    }
    for (const code of fa.outcomes) {
      const m = rule.re.exec(code);
      check(!!m, `${s.id}: malformed outcome code ${code}`);
      check(!/^fa[0-9a-f]{8}$/.test(code), `${s.id}: ${code} is a website id, not a code`);
      if (!m) continue;
      if (s.id === 'nsw-mathematics-k-10-2022') {
        const [, stage, focus, kind, nn] = m;
        check(Number(stage) === fa.stage, `${code}: stage ${fa.stage} does not match its code`);
        check((kind === 'P') === (fa.kind === 'path') && ['core', 'path'].includes(fa.kind), `${code}: kind ${fa.kind} does not match its code`);
        check(fa.kind === 'path' ? fa.pathLabels.length > 0 : fa.pathLabels.length === 0, `${code}: path labels belong to Path outcomes only`);
        check(fa.pathLabels.every(l => ['Stn', 'Adv', 'Ext'].includes(l)), `${code}: unknown path label`);
        const k = `${stage}-${focus}-${kind}`;
        series.set(k, [...(series.get(k) || []), Number(nn)]);
      } else {
        const [, yearPart, nn] = m;
        check(Number(yearPart.slice(0, 2)) === fa.year, `${code}: year ${fa.year} does not match its code`);
        if (yearPart.includes('-S')) check(fa.course === `Standard ${yearPart.slice(-1)}`, `${code}: course ${fa.course} does not match its code`);
        else check(fa.course === undefined, `${code}: only Standard Year 12 outcomes name a course`);
        series.set(yearPart, [...(series.get(yearPart) || []), Number(nn)]);
      }
      check(!allCodes.has(code), `outcome ${code} appears twice (${allCodes.get(code)} and ${s.id})`);
      allCodes.set(code, s.id);
    }
  }
  for (const [k, nums] of series) {
    const sorted = [...nums].sort((a, b) => a - b);
    check(sorted.every((n, i) => n === i + 1), `${s.id}: ${k} numbering is not 01..${sorted.length} (${sorted.join(',')})`);
  }
}
check(Object.keys(NSW_OUTCOME_BY_CODE).length === allCodes.size, 'outcome index covers every current code exactly once');

for (const s of NSW_SUPERSEDED_SYLLABUSES) {
  check(s.status === 'superseded' && s.version === '2017', `${s.id}: must be a superseded 2017 syllabus`);
  check(s.implementation.finalHscExam === 2026, `${s.id}: final HSC examination is 2026`);
  check(!s.focusAreas, `${s.id}: superseded syllabuses hold topics, not current focus areas`);
  const codes = s.topics.map(t => t.code);
  check(new Set(codes).size === codes.length, `${s.id}: duplicate topic code`);
  for (const t of s.topics) {
    check(/^(MA|ME|MEX|MS)-[A-Z]\d$/.test(t.code), `${s.id}: malformed topic code ${t.code}`);
    check(typeof t.name === 'string' && t.name.length > 0, `${s.id}: topic ${t.code} needs a name`);
    check(!NSW_OUTCOME_BY_CODE[t.code], `${s.id}: ${t.code} collides with a current code`);
  }
}
for (const s of NSW_CURRENT_SYLLABUSES) {
  if (s.replaces) check(NSW_SYLLABUS_BY_ID[s.replaces]?.status === 'superseded', `${s.id}: replaces ${s.replaces}, which must be a superseded syllabus`);
}

// ── Crosswalk ───────────────────────────────────────────────────────────────
const familySyllabus = id => {
  if (/^y(7|8|9|10)-/.test(id)) return 'nsw-mathematics-k-10-2022';
  if (/^y1[12]-/.test(id)) return 'nsw-mathematics-advanced-11-12-2024';
  if (/^ms1[12]-/.test(id)) return 'nsw-mathematics-standard-11-12-2024';
  if (/^me1[12]-/.test(id)) return 'nsw-mathematics-extension1-11-12-2024';
  if (/^mex-/.test(id)) return 'nsw-mathematics-extension2-11-12-2024';
  return null;
};

const rowsBySubtopic = new Map();
for (const row of LEGACY_CROSSWALK) {
  const st = SUBTOPIC_BY_ID[row.subtopicId];
  check(!!st, `crosswalk row ${row.subtopicId} names no subtopic in curriculum.js`);
  check(!rowsBySubtopic.has(row.subtopicId), `crosswalk has two rows for ${row.subtopicId}`);
  rowsBySubtopic.set(row.subtopicId, row);
  if (!st) continue;
  check(CROSSWALK_STATUSES.includes(row.status) && row.status !== 'new-no-generator', `${row.subtopicId}: bad status ${row.status}`);
  check(CROSSWALK_PLACEMENTS.includes(row.placement), `${row.subtopicId}: bad placement ${row.placement}`);
  check(row.syllabus === familySyllabus(row.subtopicId), `${row.subtopicId}: labelled syllabus should be ${familySyllabus(row.subtopicId)}`);
  check(NSW_SYLLABUS_BY_ID[row.syllabus]?.status === 'current', `${row.subtopicId}: maps to non-current syllabus ${row.syllabus}`);
  check(row.dotpoints.length === st.dotpoints.length, `${row.subtopicId}: ${row.dotpoints.length} dot-point rows for ${st.dotpoints.length} dot points`);
  for (const codes of row.dotpoints) {
    check(new Set(codes).size === codes.length, `${row.subtopicId}: repeated code in one dot point`);
    for (const code of codes) {
      check(!!NSW_OUTCOME_BY_CODE[code], `${row.subtopicId}: ${code} is not a current NSW outcome`);
      check(!NSW_HISTORICAL_TOPIC_BY_CODE[code], `${row.subtopicId}: ${code} is a superseded 2017 code`);
    }
  }
  check(row.status === derivedStatus(row), `${row.subtopicId}: status ${row.status} but its dot points say ${derivedStatus(row)}`);
  check(row.placement === derivedPlacement(row, st.year), `${row.subtopicId}: placement ${row.placement} but its codes say ${derivedPlacement(row, st.year)}`);
  if (row.status === 'mapped') check(row.dotpoints.every(codes => codes.length > 0), `${row.subtopicId}: a mapped row may not leave a dot point unplaced`);
  const expectedHistorical = legacyTopicCodes(st.code);
  check(JSON.stringify(row.historicalCodes) === JSON.stringify(expectedHistorical), `${row.subtopicId}: historicalCodes ${JSON.stringify(row.historicalCodes)} but curriculum.js label "${st.code}" names ${JSON.stringify(expectedHistorical)}`);
  for (const code of row.historicalCodes) check(!!NSW_HISTORICAL_TOPIC_BY_CODE[code], `${row.subtopicId}: ${code} is not a 2017 topic code`);
  if (row.syllabus === 'nsw-mathematics-k-10-2022') check(row.historicalCodes.length === 0, `${row.subtopicId}: Years 7–10 labels are not codes`);
  else check(row.historicalCodes.length > 0, `${row.subtopicId}: a Stage 6 label must name its 2017 topic code(s)`);
}
for (const st of SUBTOPICS) check(rowsBySubtopic.has(st.id), `subtopic ${st.id} has no crosswalk row`);
check(LEGACY_CROSSWALK.length === SUBTOPICS.length, `crosswalk has ${LEGACY_CROSSWALK.length} legacy rows for ${SUBTOPICS.length} subtopics`);

const reached = new Set(LEGACY_CROSSWALK.flatMap(r => r.dotpoints.flat()));
const gapCodes = new Set();
for (const g of NEW_OUTCOME_GAPS) {
  check(g.subtopicId === null && g.status === 'new-no-generator', `gap ${g.outcome}: must be a new-no-generator row with no subtopic`);
  check(!!NSW_OUTCOME_BY_CODE[g.outcome], `gap ${g.outcome}: not a current outcome`);
  check(NSW_OUTCOME_BY_CODE[g.outcome]?.syllabus === g.syllabus, `gap ${g.outcome}: syllabus ${g.syllabus} is wrong`);
  check(!gapCodes.has(g.outcome), `gap ${g.outcome}: listed twice`);
  check(!reached.has(g.outcome), `gap ${g.outcome}: a legacy subtopic reaches it, so it is not a gap`);
  gapCodes.add(g.outcome);
}
for (const code of Object.keys(NSW_OUTCOME_BY_CODE)) {
  check(reached.has(code) || gapCodes.has(code), `outcome ${code} is neither reached by a subtopic nor listed as new-no-generator`);
}
check(NSW_CROSSWALK.length === LEGACY_CROSSWALK.length + NEW_OUTCOME_GAPS.length, 'NSW_CROSSWALK is the legacy rows plus the gap rows');
deepFrozen(NSW_CROSSWALK, 'NSW_CROSSWALK');

// Label parsing (the provenance link): pinned examples.
check(JSON.stringify(legacyTopicCodes('MA-T3/C2')) === '["MA-T3","MA-C2"]', 'legacyTopicCodes splits MA-T3/C2');
check(JSON.stringify(legacyTopicCodes('MS-N2/N3')) === '["MS-N2","MS-N3"]', 'legacyTopicCodes splits MS-N2/N3');
check(legacyTopicCodes('MA4 · Number').length === 0, 'legacyTopicCodes ignores Stage-and-strand labels');

// ── Generators and coverage ─────────────────────────────────────────────────
const generatorIds = await legacyNswGeneratorIds();
check(JSON.stringify(generatorIds) === JSON.stringify(SUBTOPICS.map(s => s.id).sort()), 'legacy NSW generator ids are exactly the legacy subtopic ids');

const report = nswCoverage({ syllabuses: NSW_CURRENT_SYLLABUSES, crosswalk: NSW_CROSSWALK, generatorIds });
const PINNED = {
  'nsw-mathematics-k-10-2022': [57, 41, 0, 16],
  'nsw-mathematics-standard-11-12-2024': [25, 18, 0, 7],
  'nsw-mathematics-advanced-11-12-2024': [18, 14, 0, 4],
  'nsw-mathematics-extension1-11-12-2024': [11, 9, 1, 1],
  'nsw-mathematics-extension2-11-12-2024': [5, 5, 0, 0]
};
for (const s of report) {
  const got = [s.total, s.mapped, s.partial, s.missing];
  check(JSON.stringify(got) === JSON.stringify(PINNED[s.id]), `${s.id}: coverage ${got.join('/')} differs from the pinned ${PINNED[s.id]?.join('/')} — update the pin with the crosswalk change that moved it`);
  check(s.total === s.mapped + s.partial + s.missing, `${s.id}: coverage counts do not add up`);
  check(s.outcomes.filter(o => o.state === 'missing').every(o => gapCodes.has(o.code)), `${s.id}: a missing outcome is not a listed gap`);
}

// The pure function on a synthetic input: generator presence decides reach.
const toy = {
  id: 'toy', title: 'Toy', focusAreas: [{ name: 'A', year: 11, outcomes: ['T-11-01', 'T-11-02', 'T-11-03'] }]
};
const toyReport = nswCoverage({
  syllabuses: [toy],
  crosswalk: [
    { subtopicId: 'a', status: 'mapped', dotpoints: [['T-11-01']] },
    { subtopicId: 'b', status: 'partial', dotpoints: [['T-11-02'], []] },
    { subtopicId: 'c', status: 'mapped', dotpoints: [['T-11-03']] }
  ],
  generatorIds: ['a', 'b']
})[0];
check(toyReport.mapped === 1 && toyReport.partial === 1 && toyReport.missing === 1, 'coverage: mapped/partial/missing, and a row without a generator reaches nothing');

// ── Reviewed-data digests ───────────────────────────────────────────────────
// The structural checks above cannot tell a wrong-but-valid code from a right
// one. These digests pin the NESA data and the crosswalk as reviewed on
// 2026-11-13 (PR #865), so any edit (a code moved between focus areas, a path
// label changed, a crosswalk code swapped) fails until the digest is updated
// in the same reviewed change. Recompute with --print-digests.
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const DIGESTS = {
  syllabuses: digest(NSW_SYLLABUSES.map(s => ({ id: s.id, focusAreas: s.focusAreas, topics: s.topics }))),
  crosswalk: digest(NSW_CROSSWALK.map(r => ({ subtopicId: r.subtopicId, syllabus: r.syllabus, outcome: r.outcome, historicalCodes: r.historicalCodes, dotpoints: r.dotpoints, status: r.status, placement: r.placement })))
};
const PINNED_DIGESTS = { syllabuses: '4baf6b80fe807d58', crosswalk: '734ccaefd08e7091' };
if (process.argv.includes('--print-digests')) console.log(JSON.stringify(DIGESTS));
for (const k of Object.keys(PINNED_DIGESTS)) {
  check(DIGESTS[k] === PINNED_DIGESTS[k], `${k} digest ${DIGESTS[k]} differs from the reviewed ${PINNED_DIGESTS[k]}: re-verify the change against NESA, get it reviewed, then update the pin`);
}

// ── Isolation ───────────────────────────────────────────────────────────────
const IMPORT = /\bimport\s*(?:[^'"()]*?\bfrom\s*)?\(?\s*['"]([^'"]+)['"]/g;
for (const name of readdirSync(modelDir)) {
  if (!name.endsWith('.js') || name === 'legacyGenerators.js') continue;
  const text = readFileSync(join(modelDir, name), 'utf8');
  for (const [, spec] of text.matchAll(IMPORT)) {
    check(spec.startsWith('./') && !spec.includes('..'), `curriculum-nsw/${name} imports ${spec}: the model must stay self-contained`);
  }
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}
const srcDir = join(here, '..', 'src');
for (const file of walk(srcDir)) {
  if (file.startsWith(modelDir)) continue;
  check(!readFileSync(file, 'utf8').includes('curriculum-nsw'), `${relative(repo, file)} references curriculum-nsw: serving NSW content is G3, not G2`);
}

// India curriculum, the legacy NSW course, every generator and the practice
// server must be byte-unchanged on a branch that changes this model. Needs the
// merge base with origin/main; a shallow CI checkout has none and says so.
const PROTECTED = [
  'client/src/engine/curriculum.js',
  'client/src/engine/curriculumAvailability.js',
  'client/src/engine/generators',
  'client/src/engine/ncert',
  'server/platform/practice.js'
];
const protectedGlobs = ['client/src/engine/curriculum-in*.js', 'client/src/engine/india*.js'];
let isolationNote;
try {
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const base = git(['merge-base', 'HEAD', 'origin/main']);
  // Committed, staged and working-tree changes against the merge base, plus untracked files.
  const changedSince = paths => [
    git(['diff', '--name-only', base, '--', ...paths]),
    git(['ls-files', '--others', '--exclude-standard', '--', ...paths])
  ].filter(Boolean).join('\n');
  const touched = changedSince(['client/src/engine/curriculum-nsw']);
  if (touched) {
    const changed = changedSince([...PROTECTED, ...protectedGlobs.map(g => `:(glob)${g}`)]);
    check(changed === '', `this branch changes the NSW model and also: ${changed.split('\n').join(', ')}`);
    isolationNote = `India/legacy files byte-unchanged against merge base ${base.slice(0, 9)}`;
  } else {
    isolationNote = 'branch does not change the NSW model; byte-unchanged check not applicable';
  }
} catch {
  isolationNote = 'byte-unchanged check not run: no origin/main merge base in this checkout';
}

// ── Result ──────────────────────────────────────────────────────────────────
console.log(formatNswCoverage(report));
console.log(`(${isolationNote})`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`NSW CURRICULUM MODEL: FAIL — ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
const summary = report.map(s => `${s.id.replace('nsw-mathematics-', '')} ${s.mapped}/${s.total}`).join(', ');
console.log(`NSW CURRICULUM MODEL: PASS — ${checks}/${checks} checks — ${LEGACY_CROSSWALK.length} subtopics crosswalked, ${NEW_OUTCOME_GAPS.length} outcomes with no generator — outcomes reached (a floor, not syllabus coverage): ${summary}`);
