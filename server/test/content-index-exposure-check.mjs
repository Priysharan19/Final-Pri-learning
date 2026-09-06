// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the published catalogue is a catalogue
//
// /v1/content/published-index is deliberately anonymous: a device refreshes the
// packs it has before anyone signs in, and then works offline. That makes it
// the cheapest thing on this server to point a script at, and it used to
// serialise every published revision in one unbounded, unlimited response,
// `source` included — the reviewed input a revision was built from, and the
// largest field on the row. Sixty packs answered an anonymous request with six
// megabytes.
//
// A catalogue needs the keys, not the contents: one page at a time, no source,
// no body, and a limit per caller.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-content-index-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '88'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');

const c = checks();
const db = createPlatformDb(':memory:');
const app = await startApp({ db });
const PUBLISHED = 120;
const now = Date.now();

try {
  // Seeded directly: this contract is about what the read exposes, and the
  // review lifecycle it went through is content-review-contract-check's job.
  const insert = db.prepare(`INSERT INTO content_revisions
    (id,content_key,curriculum_version,status,author_account_id,reviewer_account_id,source_json,body_json,revision,created_at,published_at)
    VALUES (?,?,?,'published',NULL,NULL,?,?,1,?,?)`);
  const source = JSON.stringify({ reviewerNotes: 'N'.repeat(100_000) });
  const body = JSON.stringify({ questions: ['Q'.repeat(1_000)] });
  db.transaction(() => {
    for (let i = 0; i < PUBLISHED; i += 1) {
      insert.run(`content_${i}`, `pack/${String(i).padStart(3, '0')}`, 'in-2026', source, body, now, now);
    }
  })();

  // ── 1 · One page, keys only ───────────────────────────────────────────────
  const first = await app.request('/v1/content/published-index');
  c.eq(first.status, 200, 'the index stays readable without an account');
  c.eq(first.data.revisions.length, 100, 'a page is bounded rather than the whole catalogue');
  c.eq(first.data.hasMore, true, 'and says there is more');
  c.eq(first.data.nextCursor, 'pack/099', 'handing back the key to continue from');
  c.ok(first.text.length < 200_000, `the page is a catalogue, not a download (${first.text.length} bytes)`);
  c.ok(!('source' in first.data.revisions[0]), 'no revision source is serialised');
  c.ok(!('body' in first.data.revisions[0]), 'and no body, as before');
  c.ok(!/reviewerNotes/.test(first.text), 'nothing of the reviewed input reaches an anonymous caller');
  c.ok(first.data.revisions[0].contentKey === 'pack/000' && first.data.revisions[0].curriculumVersion === 'in-2026',
    'what a client needs to choose a pack is still there');

  // ── 2 · The rest is reachable, once, in order ─────────────────────────────
  const seen = [...first.data.revisions.map(row => row.contentKey)];
  const second = await app.request(`/v1/content/published-index?after=${encodeURIComponent(first.data.nextCursor)}`);
  c.eq(second.status, 200, 'the next page is served');
  c.eq(second.data.revisions.length, PUBLISHED - 100, 'and holds the remainder');
  c.eq(second.data.hasMore, false, 'which is the end');
  c.eq(second.data.nextCursor, null, 'so there is no cursor to follow');
  seen.push(...second.data.revisions.map(row => row.contentKey));
  c.eq(new Set(seen).size, PUBLISHED, 'paging visits every published key exactly once');

  const small = await app.request('/v1/content/published-index?limit=5');
  c.eq(small.data.revisions.length, 5, 'a caller may ask for a smaller page');
  const huge = await app.request('/v1/content/published-index?limit=100000');
  c.ok(huge.data.revisions.length <= 500, 'and may not ask for an unbounded one');
  const filtered = await app.request('/v1/content/published-index?curriculumVersion=in-2027');
  c.eq(filtered.data.revisions.length, 0, 'the curriculum filter still applies');

  // ── 3 · Anonymous does not mean unlimited ────────────────────────────────
  let limited = 0;
  for (let i = 0; i < 70; i += 1) {
    const response = await app.request('/v1/content/published-index?limit=1');
    if (response.status === 429) { limited = i; break; }
  }
  c.ok(limited > 0, `the index is rate limited (refused after ${limited} requests in the window)`);
} finally {
  await app.close();
  db.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`CONTENT INDEX EXPOSURE — PASS — ${c.count()}/${c.count()} checks — the anonymous catalogue is paginated, carries no revision source or body, and is rate limited.`);
