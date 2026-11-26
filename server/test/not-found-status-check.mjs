// Pri Learning · an address that is no route answers 404 in the Prithagoras edition (launch QA 26 Nov 2026, POLISH 9)
//
// The server used to answer every address with the app shell and status 200, so a mistyped link looked fine to a link checker.
// Prithagoras now answers an address that is no route with the same shell and status 404 (the page still loads and says
// "Page not found"); real routes keep 200. Priyabhata is unchanged: it answers 200 everywhere. /v1 is not touched.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV = 'test';
const { startApp, checks } = await import('./support/app-harness.mjs');
const { isAppPath } = await import('../platform/appPaths.js');
const c = checks();

function makeDist(edition) {
  const dist = join(mkdtempSync(join(tmpdir(), 'pri-not-found-')), 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head><title>Pri</title></head><body><div id="root"></div></body></html>\n');
  writeFileSync(join(dist, 'features.json'), JSON.stringify({ edition }));
  return dist;
}

for (const [path, want] of [['/', true], ['/practice', true], ['/Practice/', true], ['/exams/abc', true], ['/welcome/marking', true],
  ['/index.html', true], ['/no-such-page', false], ['/practice/extra/deep', false], ['/exams', true], ['/exams/a/b', false], ['/assets/missing.js', false]]) {
  c.eq(isAppPath(path), want, `isAppPath(${path}) is ${want}`);
}

async function run(edition, expectations) {
  process.env.PRI_EDITION = edition;
  const h = await startApp({ dist: makeDist(edition) });
  try {
    for (const [path, status] of expectations) {
      const res = await h.request(path, { headers: { Accept: 'text/html' } });
      c.eq(res.status, status, `${edition}: ${path} answers ${status}`);
      c.match(res.headers.get('content-type') || '', /text\/html/, `${edition}: ${path} still carries the app shell`);
      c.match(res.text, /id="root"/, `${edition}: ${path} body is the shell`);
    }
  } finally {
    await h.close();
  }
}

await run('prithagoras', [['/', 200], ['/practice', 200], ['/exams/abc', 200], ['/welcome', 200], ['/no-such-page', 404], ['/practice/extra/deep', 404], ['/assets/missing.js', 404]]);
await run('priyabhata', [['/', 200], ['/practice', 200], ['/no-such-page', 200]]);

console.log(`NOT FOUND STATUS: PASS — ${c.count()}/${c.count()} checks — Prithagoras answers 404 for an address that is no route, 200 for routes; Priyabhata unchanged`);
