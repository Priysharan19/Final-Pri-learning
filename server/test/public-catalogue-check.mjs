// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the anonymous public resource catalogue (plan F6a)
//
//   1 · OFF by default: with the switch unset or not "on", /v1/public/... is
//       exactly as unmounted as before (the same answer as an unknown path);
//   2 · ON: published, external https rows of this server's edition only; a
//       draft, withdrawn, hosted, non-https or other-edition row never appears,
//       in the list or by id; the other edition's server shows its own rows;
//   3 · the reply carries only the `resourcePublic` fields, no cookie is set,
//       and a session cookie on the request changes nothing;
//   4 · CORS: the allow-origin header only for a listed origin (exact match,
//       no wildcard, no credentials); a malformed list stops the server;
//   5 · caching (public, max-age=300, an ETag, a 304) and the rate limit;
//   6 · the signed-in library stays signed-in only.
//
//   node server/test/public-catalogue-check.mjs [--engine=postgres]
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { RESOURCE_SEED, resourcePublic, resourceRowValues } from '../platform/resourceCatalog.js';
import { publicCatalogueConfig } from '../platform/publicResources.js';
import { checks, registerAccount, startApp } from './support/app-harness.mjs';
import { requestedEngine } from './support/engine.mjs';
import { asStore } from '../platform/store.js';

const c = checks();
const SEED = RESOURCE_SEED[0];
const engine = requestedEngine();
console.log(`engine: ${engine}`);
const site = 'https://priysharan19.github.io';
delete process.env.PRI_PUBLIC_CATALOGUE;
delete process.env.PRI_PUBLIC_CATALOGUE_ORIGINS;

// ── 1 · off by default ───────────────────────────────────────────────────────
const off = await startApp({ engine, log: () => {}, resources: { edition: 'prithagoras' } });
let au, india;
try {
  const nowhere = await off.request('/v1/public/not-a-route');
  for (const path of ['/v1/public/resources', `/v1/public/resources/${SEED.id}`]) {
    const r = await off.request(path);
    c.deq([r.status, r.data?.error?.code, r.text.includes(SEED.title)], [nowhere.status, nowhere.data?.error?.code, false], `off by default: ${path} answers as an unmounted path (${r.status})`);
  }
} finally { await off.close(); }
process.env.PRI_PUBLIC_CATALOGUE = 'yes';
const notOn = await startApp({ engine, log: () => {}, resources: { edition: 'prithagoras' } });
try { c.eq((await notOn.request('/v1/public/resources')).status, (await notOn.request('/v1/public/not-a-route')).status, 'only "on" turns it on'); } finally { await notOn.close(); }

// ── 4 · configuration ────────────────────────────────────────────────────────
for (const bad of ['*', 'http://example.org', 'https://example.org/path', 'https://user:pw@example.org', 'https://*.example.org', 'example.org', 'https://example.org.']) {
  let threw = false;
  try { publicCatalogueConfig({ PRI_PUBLIC_CATALOGUE: 'on', PRI_PUBLIC_CATALOGUE_ORIGINS: `${site},${bad}` }); } catch { threw = true; }
  c.ok(threw, `a malformed origin list is refused at start-up: ${bad}`);
}
c.deq(publicCatalogueConfig({ PRI_PUBLIC_CATALOGUE: 'on', PRI_PUBLIC_CATALOGUE_ORIGINS: `${site}  https://Example.org:8443` }), { enabled: true, origins: [site, 'https://example.org:8443'] }, 'a clean list is read, lowercased');
c.deq(publicCatalogueConfig({}), { enabled: false, origins: [] }, 'the default is off, no origins');

// ── 2, 3, 5 · on ─────────────────────────────────────────────────────────────
process.env.PRI_PUBLIC_CATALOGUE = 'on';
process.env.PRI_PUBLIC_CATALOGUE_ORIGINS = site;
au = await startApp({ engine, log: () => {}, resources: { edition: 'prithagoras' } });
india = await startApp({ engine, log: () => {}, resources: { edition: 'priyabhata' } });
try {
  const store = asStore(au.db);
  const insert = async (patch, editions) => {
    const r = { ...SEED, editions, description: `Test row ${patch.id}.`, subtitle: null, tags: ['Test'], sections: [], ...patch };
    await store.run(`INSERT INTO resources(id,title,subtitle,description,type,subject,year,grade,marks,duration_minutes,reading_minutes,question_count,sections_json,tags_json,course,syllabus_version,certification_state,availability,url,source,attribution,rights_note,disclaimer,review_state,created_at,updated_at,published_at)
      VALUES (${Array(27).fill('?').join(',')})`, resourceRowValues(r));
    for (const e of editions) await store.run('INSERT INTO resource_editions(resource_id,edition) VALUES (?,?)', [r.id, e]);
  };
  await insert({ id: 'draft-notes', title: 'Draft calculus notes', type: 'notes', reviewState: 'draft', publishedAt: null }, ['prithagoras']);
  await insert({ id: 'withdrawn-paper', title: 'Withdrawn paper', reviewState: 'withdrawn' }, ['prithagoras']);
  await insert({ id: 'india-only-notes', title: 'Quadratics notes', type: 'notes', course: 'in' }, ['priyabhata']);
  await insert({ id: 'hosted-paper', title: 'Hosted paper', availability: 'hosted', url: null }, ['prithagoras']);
  await insert({ id: 'plain-http-paper', title: 'Plain http paper', url: 'http://example.org/p' }, ['prithagoras']);
  await insert({ id: 'shared-solutions', title: 'Shared worked solutions', type: 'solutions', year: 2026 }, ['prithagoras', 'priyabhata']);
  const hidden = ['draft-notes', 'withdrawn-paper', 'india-only-notes', 'hosted-paper', 'plain-http-paper'];

  const list = await au.request('/v1/public/resources');
  const ids = r => (r.data?.resources || []).map(x => x.id);
  c.eq(list.status, 200, 'on: an anonymous caller is answered');
  c.deq(ids(list), [SEED.id, 'shared-solutions'], 'the list holds the published rows of this edition only, newest year first')
  c.ok(!hidden.some(id => list.text.includes(id)) && !/Draft calculus|Withdrawn paper|Quadratics|Hosted paper|Plain http/.test(list.text), 'no draft, withdrawn, hosted, non-https or other-edition row appears anywhere in the list');
  for (const id of hidden) {
    const r = await au.request(`/v1/public/resources/${id}`);
    c.deq([r.status, r.data?.error?.code], [404, 'RESOURCE_NOT_FOUND'], `${id} is the same 404 as an unknown id`);
  }
  c.deq((await au.request('/v1/public/resources/no-such-paper')).data?.error?.code, 'RESOURCE_NOT_FOUND', 'an unknown id is 404');
  const one = await au.request(`/v1/public/resources/${SEED.id}`);
  c.deq([one.status, one.data?.resource?.id], [200, SEED.id], 'one published resource is served by id');
  c.deq(one.data.resource, JSON.parse(JSON.stringify(resourcePublic(await store.get('SELECT * FROM resources WHERE id=?', [SEED.id])))), 'the reply is exactly the resourcePublic shape');
  c.ok(!('editions' in one.data.resource) && !('reviewState' in one.data.resource) && !('review_state' in one.data.resource), 'no edition or review internals are sent');
  c.deq(Object.keys(list.data).sort(), ['hasMore', 'resources'], 'the list carries no field besides resources and hasMore');

  const indiaList = await india.request('/v1/public/resources');
  c.deq(ids(indiaList), [], 'the other edition server does not see the Prithagoras rows (its own library is empty)');
  c.ok(!indiaList.text.includes(SEED.id), 'the Prithagoras paper does not leak into the Priyabhata server');

  // No cookie, and a session changes nothing.
  c.eq(list.headers.get('set-cookie'), null, 'no Set-Cookie on the list');
  c.eq(one.headers.get('set-cookie'), null, 'no Set-Cookie on one resource');
  const { jar } = await registerAccount(au, { email: 'public-catalogue@example.test' });
  const withSession = await au.request('/v1/public/resources', { jar });
  c.deq([withSession.text, withSession.headers.get('set-cookie')], [list.text, null], 'a session cookie on the request changes nothing');
  c.ok(!/account|email|session|csrf/i.test(list.text), 'no account data in the reply');

  // CORS.
  const listed = await au.request('/v1/public/resources', { headers: { Origin: site } });
  c.eq(listed.headers.get('access-control-allow-origin'), site, 'a listed origin gets the allow-origin header');
  c.eq(listed.headers.get('access-control-allow-credentials'), null, 'credentials are never allowed');
  for (const origin of ['https://evil.example', 'http://priysharan19.github.io', 'https://priysharan19.github.io.evil.example', 'null']) {
    const r = await au.request('/v1/public/resources', { headers: { Origin: origin } });
    c.eq(r.headers.get('access-control-allow-origin'), null, `an unlisted origin gets no allow-origin header: ${origin}`);
  }
  c.eq(list.headers.get('access-control-allow-origin'), null, 'no Origin, no allow-origin header');
  c.ok(/Origin/i.test(list.headers.get('vary') || ''), 'the reply varies on Origin');
  c.eq(list.headers.get('x-content-type-options'), 'nosniff', 'the platform hardening headers still apply');

  // Caching.
  c.eq(list.headers.get('cache-control'), 'public, max-age=300', 'cacheable for five minutes');
  const etag = list.headers.get('etag');
  c.ok(/^"[A-Za-z0-9_-]{20,}"$/.test(etag || ''), 'the reply has an ETag');
  const again = await au.request('/v1/public/resources', { headers: { 'If-None-Match': etag } });
  c.eq(again.status, 304, 'a matching If-None-Match is a 304');
  c.eq((await au.request('/v1/public/resources/no-such-paper')).headers.get('cache-control'), 'no-store', 'a 404 is not cached');

  // Writes are not routes here.
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const r = await au.request('/v1/public/resources', { method, headers: { Origin: site } });
    c.ok(r.status >= 400 && r.status !== 200, `${method} is refused (${r.status})`);
  }

  // The signed-in library is still signed in only.
  for (const path of ['/v1/resources', `/v1/resources/${SEED.id}`]) {
    const r = await au.request(path);
    c.deq([r.status, r.data?.error?.code], [401, 'AUTH_REQUIRED'], `signed out: ${path} is still 401`);
  }

  // Rate limit: the list allows 300 an hour per caller.
  let refused = null;
  for (let i = 0; i < 305 && !refused; i++) { const r = await au.request('/v1/public/resources'); if (r.status === 429) refused = r; }
  c.ok(refused && refused.data?.error?.code === 'RATE_LIMITED' && Number(refused.headers.get('retry-after')) >= 1, 'the rate limit holds, with Retry-After');
} finally {
  await au.close();
  await india.close();
}
delete process.env.PRI_PUBLIC_CATALOGUE;
delete process.env.PRI_PUBLIC_CATALOGUE_ORIGINS;
console.log(`public-catalogue-check (${engine}): ${c.count()} checks passed`);
