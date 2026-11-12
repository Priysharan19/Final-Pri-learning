// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the shared resource library (ADR-0002 plan F1)
//
// What this suite holds (deterministic; nothing leaves the process):
//
//   1 · the catalogue contract: an external resource needs an https link;
//       'hosted' (plan F3) is refused; editions are known ids; source,
//       attribution, rights note and disclaimer are required;
//   2 · the seed is the one real Prithagoras resource, copied unchanged
//       (its disclaimer exactly), offered to Prithagoras only, 'uploaded';
//       the Postgres migration inserts exactly the same values;
//   3 · access: signed out is 401; only published rows; only rows of the
//       SERVER's edition — a client ?edition= is ignored; an unknown id, a
//       draft, a withdrawn row and another edition's row are the same 404;
//       a 'hosted' or non-https row that reached the table is never served;
//   4 · search and filters (type, subject, year, course; every word of q),
//       with invalid filters refused, and facets from visible rows only;
//   5 · Priyabhata serves an honest empty library: no India resource is
//       invented, and the Prithagoras paper does not leak into it;
//   6 · the migration: SQLite builds both tables at schema 15 with the seed;
//       on Postgres, forward from a populated schema-14 database (no other row
//       changed, RLS on both tables), the documented rollback, and a re-apply.
//
//   node server/test/resources-check.mjs [--engine=postgres]
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RESOURCE_SEED, resourceProblems, resourceRowValues, sectionProblems } from '../platform/resourceCatalog.js';
import { createResourceRouter } from '../platform/resources.js';
import { createPlatformDb } from '../platform/db.js';
import { SCHEMA_VERSION } from '../platform/schemaVersions.js';
import { checks, registerAccount, startApp } from './support/app-harness.mjs';
import { requestedEngine } from './support/engine.mjs';
import { asStore } from '../platform/store.js';

const c = checks();
const SEED = RESOURCE_SEED[0];
const MIGRATION_NAME = '20261113000000_resource_library.sql';
const MIGRATION = readFileSync(new URL(`../../supabase/migrations/${MIGRATION_NAME}`, import.meta.url), 'utf8');
const ROLLBACK = readFileSync(new URL('../../docs/release/rollback/20261113000000_resource_library.rollback.sql', import.meta.url), 'utf8');

// ── 1 · The catalogue contract ───────────────────────────────────────────────
c.deq(resourceProblems(SEED), [], 'the seed meets the catalogue contract');
const variant = patch => ({ ...SEED, ...patch });
const refused = (patch, pattern, label) => c.ok(resourceProblems(variant(patch)).some(p => pattern.test(p)), label);
refused({ availability: 'hosted' }, /hosted is reserved for plan F3/, 'a hosted resource is refused (reserved for F3)');
refused({ url: 'http://example.org/paper' }, /https url/, 'an http link is refused');
refused({ url: 'https://user:pw@example.org/' }, /https url/, 'a link carrying credentials is refused');
refused({ url: 'javascript:alert(1)' }, /https url/, 'a script link is refused');
refused({ url: null }, /https url/, 'an external resource with no link is refused');
refused({ editions: [] }, /editions/, 'a resource offered to no edition is refused');
refused({ editions: ['australia'] }, /editions/, 'an unknown edition is refused');
refused({ editions: ['prithagoras', 'prithagoras'] }, /editions/, 'a repeated edition is refused');
refused({ type: 'exam' }, /type must be/, 'the library type is paper, solutions or notes');
refused({ course: 'au' }, /course must be/, 'an unknown course is refused');
refused({ certificationState: 'marked' }, /certificationState/, 'only ADR-0002 §7 certification states');
refused({ reviewState: 'live' }, /reviewState/, 'only draft, published or withdrawn');
for (const field of ['source', 'attribution', 'rightsNote', 'disclaimer']) refused({ [field]: '  ' }, new RegExp(field), `${field} is required`);
refused({ id: '../etc' }, /id must be/, 'an id is a lowercase slug');
refused({ publishedAt: null }, /publishedAt/, 'a published resource records when');

// Sections (plan F4 reads them): optional; contiguous; within the question count.
const sec = (label, firstQuestion, lastQuestion, kind = 'extended-response', extra = {}) => ({ label, firstQuestion, lastQuestion, kind, ...extra });
c.deq(sectionProblems([], { questionCount: 27 }), [], 'sections: an empty list is allowed');
c.deq(sectionProblems(undefined), [], 'sections: none recorded is allowed');
c.deq(resourceProblems(variant({ sections: [] })), [], 'a resource with empty sections meets the contract');
c.deq(sectionProblems([sec('A', 1, 10, 'multiple-choice'), sec('B', 11, 27)], { questionCount: 27 }), [], 'sections: contiguous and within the count');
c.deq(sectionProblems([sec('B', 11, 27)], { questionCount: 27 }), [], 'sections: one section within the count');
const secRefused = (sections, pattern, label, opts = { questionCount: 27 }) => c.ok(sectionProblems(sections, opts).some(p => pattern.test(p)), label);
secRefused([sec('A', 1, 10), sec('B', 12, 27)], /contiguous/, 'sections: a gap between sections is refused');
secRefused([sec('A', 1, 10), sec('B', 10, 27)], /contiguous/, 'sections: overlapping sections are refused');
secRefused([sec('A', 11, 27), sec('B', 1, 10)], /contiguous/, 'sections: out-of-order sections are refused');
secRefused([sec('A', 1, 10), sec('B', 11, 28)], /beyond the 27 questions/, 'sections: a bound past the question count is refused');
secRefused([sec('A', 0, 10)], /whole question numbers/, 'sections: question 0 is refused');
secRefused([sec('A', 10, 9)], /firstQuestion ≤ lastQuestion/, 'sections: first after last is refused');
secRefused([sec('A', 1.5, 9)], /whole question numbers/, 'sections: fractional bounds are refused');
secRefused([sec('A', 1, 10)], /question count/, 'sections: a resource without a question count cannot have sections', { questionCount: null });
secRefused([sec('A', 1, 10, 'essay')], /kind must be/, 'sections: an unknown kind is refused');
secRefused([sec('', 1, 10)], /label/, 'sections: a section needs a label');
secRefused([{ ...sec('A', 1, 10), answer: 'C' }], /unknown fields/, 'sections: no other fields (nothing answer-shaped) are accepted');
secRefused([sec('A', 1, 10, 'multiple-choice', { marks: 10 }), sec('B', 11, 27, 'extended-response', { marks: 80 })], /add up to 90, not the resource's 100/,
  'sections: marks that do not add up to the total are refused', { questionCount: 27, marks: 100 });
secRefused('Section I', /list/, 'sections: must be a list');
c.ok(resourceProblems(variant({ sections: [sec('A', 1, 30)] })).some(p => /beyond the 27/.test(p)), 'the resource contract applies the section rules');

// ── 2 · The seed: one real resource, copied, no fabrication ─────────────────
c.eq(RESOURCE_SEED.length, 1, 'exactly one resource is seeded');
c.deq([SEED.id, SEED.editions, SEED.course, SEED.certificationState, SEED.availability, SEED.reviewState],
  ['2027-mathematics-advanced-assessment-1', ['prithagoras'], 'nsw', 'uploaded', 'external', 'published'],
  'it is the Prithagoras paper, for Prithagoras only, at the lowest certification state');
// Pinned to prithagoras-web resources.json (schema v1, updated 2026-11-12), character for character.
c.eq(SEED.disclaimer, 'Independent practice paper; not affiliated with NESA or any school. The first uploaded version used the Pri Learning name. It is not an official examination. Access to solutions depends on the attachments currently available on Bored of Studies.',
  'its disclaimer is the source disclaimer, exactly');
c.deq([SEED.title, SEED.marks, SEED.questionCount, SEED.durationMinutes, SEED.readingMinutes, SEED.year, SEED.source, SEED.url],
  ['2027 HSC Mathematics Advanced — 100-Mark Practice Examination', 100, 27, 180, 10, 2027, 'Bored of Studies',
    'https://boredofstudies.org/resources/2027-hsc-mathematics-advanced-ultimate-100-mark-assessment-1-practice-paper.21171/'],
  'its title, marks, questions, times, year, source and link are the source values');
c.eq(SEED.syllabusVersion, null, 'the source states no syllabus version, so none is claimed');
// Pinned to resources.json "sections" (label, start, end, format, marks).
c.deq(SEED.sections.map(x => ({ ...x })), [
  { label: 'Section I', firstQuestion: 1, lastQuestion: 10, kind: 'multiple-choice', marks: 10 },
  { label: 'Section II', firstQuestion: 11, lastQuestion: 27, kind: 'extended-response', marks: 90 }
], 'its two sections are the source sections exactly: 1–10 multiple choice (10 marks), 11–27 extended response (90 marks)');
c.ok(!RESOURCE_SEED.some(r => r.editions.includes('priyabhata')), 'no India resource is invented');
const sqlLiteral = v => (v === null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
c.ok(MIGRATION.includes(`values (\n  ${resourceRowValues(SEED).map(sqlLiteral).join(',\n  ')}\n);`), 'the Postgres migration inserts exactly the seed values');
c.ok(MIGRATION.includes("insert into pri.resource_editions (resource_id, edition) values ('2027-mathematics-advanced-assessment-1', 'prithagoras');")
  && (MIGRATION.match(/insert into pri\.resource_editions/g) || []).length === 1, 'and offers it to Prithagoras only');
c.ok(/update pri\.platform_meta set value = '15' where key = 'schema_version';/.test(MIGRATION) && SCHEMA_VERSION === 15, 'the migration and the build agree on schema 15');
try { createResourceRouter(createPlatformDb(':memory:'), { edition: 'australia' }); c.ok(false, 'an unknown edition must stop the router'); }
catch (e) { c.ok(/unknown edition/.test(e.message), 'an unknown server edition stops the router instead of serving a library'); }

// ── 3–5 · Access, search, filters, editions over HTTP ────────────────────────
const engine = requestedEngine();
const au = await startApp({ engine, log: () => {}, resources: { edition: 'prithagoras' } });
const india = await startApp({ engine, log: () => {}, resources: { edition: 'priyabhata' } });
try {
  const store = asStore(au.db);
  const insert = async (patch, editions) => {
    const r = variant({ editions, description: `Test row ${patch.id}.`, subtitle: null, tags: ['Test'], sections: [], ...patch });
    await store.run(`INSERT INTO resources(id,title,subtitle,description,type,subject,year,grade,marks,duration_minutes,reading_minutes,question_count,sections_json,tags_json,course,syllabus_version,certification_state,availability,url,source,attribution,rights_note,disclaimer,review_state,created_at,updated_at,published_at)
      VALUES (${Array(27).fill('?').join(',')})`, resourceRowValues(r));
    for (const e of editions) await store.run('INSERT INTO resource_editions(resource_id,edition) VALUES (?,?)', [r.id, e]);
  };
  await insert({ id: 'draft-notes', title: 'Draft calculus notes', type: 'notes', reviewState: 'draft', publishedAt: null }, ['prithagoras']);
  await insert({ id: 'withdrawn-paper', title: 'Withdrawn paper', reviewState: 'withdrawn' }, ['prithagoras']);
  await insert({ id: 'india-only-notes', title: 'Quadratics notes', type: 'notes', course: 'in', subject: 'Mathematics', year: 2025 }, ['priyabhata']);
  // Rows that reached the table without the validator (a later mission, a hand
  // edit): the read itself still refuses to serve them.
  await insert({ id: 'hosted-paper', title: 'Hosted paper', availability: 'hosted', url: null }, ['prithagoras']);
  await insert({ id: 'plain-http-paper', title: 'Plain http paper', url: 'http://example.org/p' }, ['prithagoras']);
  await insert({ id: 'shared-solutions', title: 'Shared worked solutions 50% off', type: 'solutions', subject: 'Mathematics Extension 1', year: 2026, tags: ['Solutions'] }, ['prithagoras', 'priyabhata']);

  // Signed out.
  for (const path of ['/v1/resources', '/v1/resources/', `/v1/resources/${SEED.id}`]) {
    const r = await au.request(path);
    c.deq([r.status, r.data?.error?.code], [401, 'AUTH_REQUIRED'], `signed out: ${path} is 401`);
  }

  // A child account with no guardian consent on record is refused by the gate
  // every student router carries, before the library is read.
  const child = await registerAccount(au, { email: 'library-child@example.test' });
  await store.run("UPDATE accounts SET age_basis='child' WHERE id=?", [child.account.id]);
  for (const path of ['/v1/resources', `/v1/resources/${SEED.id}`]) {
    const r = await au.request(path, { jar: child.jar });
    c.ok(r.status === 403 && /^GUARDIAN_CONSENT_|^AGE_DECLARATION_/.test(r.data?.error?.code || '') && !r.text.includes(SEED.title),
      `a child without guardian consent is refused: ${path} (${r.status} ${r.data?.error?.code})`);
  }

  const { jar } = await registerAccount(au, { email: 'library-au@example.test' });
  const get = (path, h = au, j = jar) => h.request(path, { jar: j });
  const ids = r => (r.data?.resources || []).map(x => x.id);

  const list = await get('/v1/resources');
  c.eq(list.status, 200, 'signed in: the library answers');
  c.deq(ids(list), [SEED.id, 'shared-solutions'], 'only published, external https rows of this edition, newest year first');
  c.ok(!/draft|withdrawn|hosted|plain-http|india-only/.test(JSON.stringify(list.data)), 'no draft, withdrawn, hosted, non-https or other-edition row appears anywhere in the answer');
  c.eq(list.headers.get('cache-control'), 'private, no-store', 'the answer is not cached by shared caches');
  const first = list.data.resources[0];
  c.deq([first.title, first.disclaimer, first.certificationState, first.url, first.course, first.type], [SEED.title, SEED.disclaimer, 'uploaded', SEED.url, 'nsw', 'paper'], 'the seeded paper is served as recorded');
  c.ok(!('editions' in first) && !('reviewState' in first) && !('review_state' in first), 'edition and review internals are not sent');
  c.deq(first.sections, [
    { label: 'Section I', firstQuestion: 1, lastQuestion: 10, kind: 'multiple-choice', marks: 10 },
    { label: 'Section II', firstQuestion: 11, lastQuestion: 27, kind: 'extended-response', marks: 90 }
  ], 'the API sends the paper\'s sections');
  c.deq(list.data.resources.find(r => r.id === 'shared-solutions')?.sections, [], 'a resource with no sections is sent an empty list');
  c.deq(list.data.facets, { types: ['paper', 'solutions'], subjects: ['Mathematics Advanced', 'Mathematics Extension 1'], years: [2027, 2026], courses: ['nsw'] }, 'facets come from visible rows only');

  c.deq(ids(await get('/v1/resources?edition=priyabhata')), [SEED.id, 'shared-solutions'], 'a client ?edition= is ignored: the server decides the edition');

  const detail = await get(`/v1/resources/${SEED.id}`);
  c.deq([detail.status, detail.data?.resource?.id, detail.data?.resource?.rightsNote], [200, SEED.id, SEED.rightsNote], 'one resource by id');
  for (const id of ['no-such-resource', 'draft-notes', 'withdrawn-paper', 'india-only-notes', 'hosted-paper', 'plain-http-paper', 'BAD%20ID', 'UPPER-case']) {
    const r = await get(`/v1/resources/${id}`);
    c.deq([r.status, r.data?.error?.code], [404, 'RESOURCE_NOT_FOUND'], `${id}: the same 404 as an unknown id`);
  }

  // Filters and search.
  c.deq(ids(await get('/v1/resources?type=paper')), [SEED.id], 'type=paper');
  c.deq(ids(await get('/v1/resources?type=solutions')), ['shared-solutions'], 'type=solutions');
  c.deq(ids(await get('/v1/resources?type=notes')), [], 'type=notes: the draft notes stay hidden');
  c.deq(ids(await get('/v1/resources?year=2027')), [SEED.id], 'year=2027');
  c.deq(ids(await get('/v1/resources?course=nsw&subject=mathematics%20advanced')), [SEED.id], 'course and subject (case-insensitive)');
  c.deq(ids(await get('/v1/resources?course=in')), [], 'course=in in the Prithagoras library: none');
  c.deq(ids(await get('/v1/resources?q=HSC%20100%20marks')), [SEED.id], 'search: every word must match (title, tags)');
  c.deq(ids(await get('/v1/resources?q=extended-response')), [SEED.id], 'search reads the description');
  c.deq(ids(await get('/v1/resources?q=hsc%20solutions')), [], 'search: a word that does not match excludes the row');
  c.deq(ids(await get('/v1/resources?q=50%25')), ['shared-solutions'], 'search: % is a literal character, not a wildcard');
  c.deq(ids(await get('/v1/resources?q=%25')), ['shared-solutions'], 'search: a lone % matches only text that contains one');
  c.deq(ids(await get('/v1/resources?q=quadratics')), [], 'search never reaches another edition\'s rows');
  for (const [query, code] of [['type=exam', 'RESOURCE_FILTER_INVALID'], ['type=paper&type=notes', 'RESOURCE_FILTER_INVALID'], ['year=27', 'RESOURCE_FILTER_INVALID'],
    ['year=abcd', 'RESOURCE_FILTER_INVALID'], ['course=au', 'RESOURCE_FILTER_INVALID'], ['subject=', 'RESOURCE_FILTER_INVALID'],
    [`q=${'x'.repeat(121)}`, 'RESOURCE_SEARCH_INVALID'], ['q=a&q=b', 'RESOURCE_SEARCH_INVALID']]) {
    const r = await get(`/v1/resources?${query}`);
    c.deq([r.status, r.data?.error?.code], [400, code], `refused: ${query.slice(0, 30)}`);
  }

  // Priyabhata: its own database, seeded by the same build; only shared and
  // India rows would show, and none is seeded — the honest empty library.
  const { jar: inJar } = await registerAccount(india, { email: 'library-in@example.test' });
  const inList = await get('/v1/resources', india, inJar);
  c.deq([inList.status, ids(inList), inList.data?.facets], [200, [], { types: [], subjects: [], years: [], courses: [] }], 'Priyabhata: an honest empty library, no invented resource');
  const leak = await get(`/v1/resources/${SEED.id}`, india, inJar);
  c.eq(leak.status, 404, 'Priyabhata cannot read the Prithagoras paper by id');
  c.eq((await get(`/v1/resources/${SEED.id}?edition=prithagoras`, india, inJar)).status, 404, 'nor by naming the other edition');

  // ── 6 · Migration ──────────────────────────────────────────────────────────
  c.ok(/^begin;$/m.test(ROLLBACK) && /^commit;$/m.test(ROLLBACK) && /update pri\.platform_meta set value = '14' where key = 'schema_version';/.test(ROLLBACK)
    && (ROLLBACK.match(/^drop table /gm) || []).length === 2, 'the documented rollback is one transaction: two tables dropped, schema_version back to 14');

  if (au.engine === 'postgres') {
    const row = await asStore(au.db).get('SELECT * FROM resources WHERE id=?', [SEED.id]);
    const cols = ['id', 'title', 'subtitle', 'description', 'type', 'subject', 'year', 'grade', 'marks', 'duration_minutes', 'reading_minutes', 'question_count', 'sections_json', 'tags_json', 'course', 'syllabus_version', 'certification_state', 'availability', 'url', 'source', 'attribution', 'rights_note', 'disclaimer', 'review_state', 'created_at', 'updated_at', 'published_at'];
    c.deq(cols.map(k => (row[k] === null ? null : typeof resourceRowValues(SEED)[cols.indexOf(k)] === 'number' ? Number(row[k]) : row[k])), resourceRowValues(SEED), 'Postgres: the migrated seed row equals RESOURCE_SEED');

    const { scratchDatabase, migrationFiles } = await import('./support/postgres.mjs');
    const all = migrationFiles();
    const scratch = await scratchDatabase('resource_library_upgrade', { migrations: all.filter(m => m.name < MIGRATION_NAME) });
    const su = scratch.client;
    const version = async () => (await su.query("SELECT value FROM pri.platform_meta WHERE key='schema_version'")).rows[0].value;
    const tables = async () => (await su.query("SELECT tablename FROM pg_tables WHERE schemaname='pri' ORDER BY tablename")).rows.map(r => r.tablename);
    const counts = async names => {
      const out = {};
      for (const t of names) out[t] = Number((await su.query(`SELECT count(*) AS n FROM pri.${t}`)).rows[0].n);
      return out;
    };
    try {
      c.eq(await version(), '14', 'the upgrade starts from a schema-14 database');
      await su.query("INSERT INTO pri.accounts(id,email,name,role,created_at,updated_at) VALUES ('mig-a','mig-a@example.test','A','student',1,1)");
      const before = await tables();
      const rowsBefore = await counts(before.filter(t => t !== 'platform_meta'));
      await su.query(MIGRATION);
      c.eq(await version(), '15', 'forward: schema_version is 15');
      c.deq((await tables()).filter(t => !before.includes(t)), ['resource_editions', 'resources'], 'forward: exactly the two library tables are added');
      c.deq(await counts(before.filter(t => t !== 'platform_meta')), rowsBefore, 'forward: no other row changed');
      const rls = (await su.query("SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='pri'::regnamespace AND relname IN ('resources','resource_editions') ORDER BY relname")).rows;
      c.deq(rls.map(r => [r.relname, r.relrowsecurity]), [['resource_editions', true], ['resources', true]], 'forward: RLS is on for both tables');
      const policies = (await su.query("SELECT tablename, policyname, permissive FROM pg_policies WHERE schemaname='pri' AND tablename IN ('resources','resource_editions') ORDER BY tablename, policyname")).rows;
      c.deq(policies.map(p => `${p.tablename}:${p.policyname}:${p.permissive}`), [
        'resource_editions:pri_scope_required:RESTRICTIVE', 'resource_editions:pri_server_all:PERMISSIVE',
        'resources:pri_scope_required:RESTRICTIVE', 'resources:pri_server_all:PERMISSIVE'], 'forward: the global-table policies, fail closed');
      await su.query(ROLLBACK);
      c.eq(await version(), '14', 'rollback: schema_version is 14');
      c.deq(await tables(), before, 'rollback: exactly the two tables are gone');
      c.deq(await counts(before.filter(t => t !== 'platform_meta')), rowsBefore, 'rollback: no other row changed');
      await su.query(MIGRATION);
      c.deq([await version(), Number((await su.query('SELECT count(*) AS n FROM pri.resources')).rows[0].n)], ['15', 1], 're-apply after rollback: schema 15 with the seed again');
    } finally { await scratch.drop(); }
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'pri-resources-'));
    try {
      const file = join(dir, 'platform.db');
      const first = createPlatformDb(file);
      const names = () => first.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'resource%' ORDER BY name").all().map(r => r.name);
      c.deq([names(), first.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get().value], [['resource_editions', 'resources'], '15'], 'SQLite: the build creates both tables at schema 15');
      const row = first.prepare('SELECT * FROM resources WHERE id=?').get(SEED.id);
      c.deq(Object.values(row), resourceRowValues(SEED), 'SQLite: the seeded row equals RESOURCE_SEED');
      first.prepare("UPDATE resources SET title='kept' WHERE id=?").run(SEED.id);
      first.close();
      const again = createPlatformDb(file);
      c.deq([again.prepare('SELECT title FROM resources WHERE id=?').get(SEED.id).title, again.prepare('SELECT count(*) AS n FROM resource_editions').get().n], ['kept', 1],
        'SQLite: a later boot leaves an existing row as it is and adds no duplicate');
      again.exec('DROP TABLE resource_editions; DROP TABLE resources;');
      again.close();
      const third = createPlatformDb(file);
      c.eq(third.prepare('SELECT count(*) AS n FROM resources').get().n, 1, 'SQLite rollback is dropping the two tables; the next boot re-creates them with the seed');
      third.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  console.log(`engine: ${au.engine}`);
  console.log(`resources-check (${au.engine}): ${c.count()} checks passed`);
} finally {
  await au.close();
  await india.close();
}
