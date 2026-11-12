// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the app knows its own edition, and stops at the other's server
// (ADR-0002, plan E2)
//
//   1 · the helper (client/src/platform/edition.js): EDITION, the frozen
//       record, defaultCourse() and offersCourse(), with no network;
//   2 · the build: a Prithagoras build loads its own record in place of the
//       table's one reader, and that module carries nothing of Priyabhata —
//       and the other way round;
//   3 · the comparison: a server of this edition, or one that names none, is
//       no conflict; any other answer is;
//   4 · the transport, driven against a stand-in server: every /v1 request
//       declares the build's edition; a 409 EDITION_MISMATCH becomes a typed
//       error and one remembered conflict; a health reply naming the other
//       edition is found once per start;
//   5 · the blocking screen, drawn in English and Hindi: it says which app
//       this is and whose service it reached, and has no sign-in form, no
//       field and no button;
//   6 · the wiring: main.jsx shows the screen in place of the app, and
//       Login.jsx (plan E3) is not touched by any of this.
//
//   node client/test/edition-client-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} (got ${JSON.stringify(a)})`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const table = await import('../edition.config.mjs');
const helper = await import('../src/platform/edition.js');
const record = await import('../src/platform/edition-record.js');
const vite = await import('../vite.config.js');

// ── 1 · The helper ───────────────────────────────────────────────────────────
{
  const india = table.EDITIONS.priyabhata;
  ok(helper.EDITION === table.DEFAULT_EDITION && helper.EDITION === 'priyabhata', 'outside a build the app is the default edition, Priyabhata');
  const e = helper.edition();
  eq(e, { id: 'priyabhata', brand: 'Priyabhata', region: 'IN', defaultCourse: 'in', courses: ['in'], languages: ['en', 'hi'], currency: 'INR' }, 'edition() is the record: identity and defaults');
  ok(Object.isFrozen(e) && Object.isFrozen(e.courses) && Object.isFrozen(e.languages), 'the record is frozen, with its lists');
  ok(helper.edition() === e, 'and is the same object every time');
  ok(!('capabilities' in e), 'the capability table (planning debt) is not part of what the app knows about itself');
  for (const key of Object.keys(e)) eq(e[key], india[key], `record.${key} is the table's`);
  ok(helper.defaultCourse() === 'in', 'a new Priyabhata profile starts on the India course');
  ok(helper.offersCourse('in') && !helper.offersCourse('nsw') && !helper.offersCourse(undefined) && !helper.offersCourse('IN'), 'Priyabhata offers the India course and no other');
  ok(helper.EDITION_HEADER === 'X-Pri-Edition', 'the header the build declares itself in');
  const source = read('src/platform/edition.js');
  ok(!/fetch\(|cloudRequest|localStorage|indexedDB|navigator\.|import\(/.test(source), 'the helper touches no network, storage or device');
  ok(!/edition\.config/.test(source) && /from '\.\/edition-record\.js'/.test(source), 'and reads the table only through edition-record.js');
  for (const id of table.EDITION_IDS) {
    eq(record.editionRecord(id).defaultCourse, table.EDITIONS[id].defaultCourse, `${id}: the record's default course is the table's`);
    ok(record.editionRecord(id).courses.includes(record.editionRecord(id).defaultCourse), `${id}: and is one of the courses it offers`);
    ok(helper.editionDisplayName(id) === table.EDITIONS[id].brand, `${id}: the brand is the id with a capital letter, so the other edition's name need not be bundled`);
  }
}

// ── 2 · The build ────────────────────────────────────────────────────────────
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const ssr = edition => createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react(), ...(edition ? [vite.editionRecordPlugin(edition)] : [])],
  define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
{
  for (const [own, other] of [['prithagoras', 'priyabhata'], ['priyabhata', 'prithagoras']]) {
    const plugin = vite.editionRecordPlugin(own);
    const built = plugin.load(vite.EDITION_RECORD_MODULE);
    const o = table.EDITIONS[other];
    ok(typeof built === 'string' && built.includes(`id: "${own}"`) && built.includes('export const EDITION_RECORD'), `a ${own} build replaces edition-record.js with its own record`);
    ok(!built.includes(o.brand) && !built.includes(other) && !built.includes(o.currency) && !built.includes(`"${o.region}"`) && !built.includes(`"${o.defaultCourse}"`), `which carries nothing of ${o.brand}: no name, id, currency, region or course`);
    ok(!/edition\.config|capabilities|pending/.test(built), `and neither the table nor its capability list (${own})`);
    ok(plugin.load(`${vite.EDITION_RECORD_MODULE}?v=1`) === built, 'a query on the module id is the same module');
    ok(plugin.load(fileURLToPath(new URL('../src/platform/edition.js', import.meta.url))) === null && plugin.load('/elsewhere/edition-record.js') === null, 'and every other module is left alone');
  }
  const config = read('vite.config.js');
  ok(/plugins: \[[^\]]*editionRecordPlugin\(featureStates\(command\)\.edition\)/.test(config), 'the real build installs the plugin for the edition it resolved from PRI_EDITION');

  const server = await ssr('prithagoras');
  try {
    const au = await server.ssrLoadModule('/src/platform/edition.js');
    ok(au.EDITION === 'prithagoras' && au.edition().brand === 'Prithagoras' && au.edition().currency === 'AUD', 'a Prithagoras build IS Prithagoras');
    ok(au.defaultCourse() === 'nsw' && au.offersCourse('nsw') && !au.offersCourse('in'), 'its new profiles start on the NSW course, and it offers no India course');
    ok(Object.isFrozen(au.edition()) && Object.isFrozen(au.edition().courses) && Object.isFrozen(au.edition().languages), 'the built record is frozen too');
    eq(au.edition(), record.editionRecord('prithagoras'), 'and equals what the table says of Prithagoras');
    eq(au.editionConflict('priyabhata'), { service: 'priyabhata' }, 'to a Prithagoras build, a Priyabhata server is the conflict');
    ok(au.editionConflict('prithagoras') === null, 'and a Prithagoras server is not');
  } finally {
    await server.close();
  }
}

// ── 3 · The comparison ───────────────────────────────────────────────────────
{
  const { editionConflict, editionDisplayName } = helper;
  ok(editionConflict('priyabhata') === null, 'a server of this edition is no conflict');
  ok(editionConflict(undefined) === null && editionConflict(null) === null, 'a server that names no edition (one from before editions) is no conflict');
  eq(editionConflict('prithagoras'), { service: 'prithagoras' }, 'the other edition is the conflict, naming the service reached');
  ok(Object.isFrozen(editionConflict('prithagoras')), 'a conflict is frozen');
  eq(editionConflict('atlantis'), { service: 'atlantis' }, 'an edition id this build has never heard of is still a conflict, named as the server gave it');
  for (const [value, label] of [['', 'an empty string'], ['Priyabhata', 'a brand, not an id'], ['Prithagoras', 'the other brand, not its id'], [' prithagoras', 'a padded id'], [42, 'a number'], [{}, 'an object'], [['prithagoras'], 'an array'], ['x'.repeat(200), 'a long string'], ['<b>', 'markup'], [true, 'true']]) {
    ok(editionConflict(value) === null, `${label} is not a readable statement of edition, so it blocks nothing`);
  }
  ok(editionDisplayName('prithagoras') === 'Prithagoras' && editionDisplayName('atlantis') === 'Atlantis', 'a plain id reads as a name');
  for (const bad of [null, undefined, '', 'ab', 'Prithagoras', 'pri thagoras', 'a'.repeat(25), '<script>', 7]) ok(editionDisplayName(bad) === null, `${JSON.stringify(bad)} is not shown as a name`);
}

// ── 4 · The transport ────────────────────────────────────────────────────────
// A stand-in server behind globalThis.fetch. Each case loads its own copy of
// the transport, because "once per start" is state the module keeps.
const ORIGIN = 'https://pri.example.test';
let loads = 0;
async function transportAgainst(handler) {
  const calls = [];
  globalThis.__PRI_CLOUD_ORIGIN__ = ORIGIN;
  globalThis.fetch = async (url, init = {}) => {
    const path = String(url).replace(ORIGIN, '');
    calls.push({ path, method: init.method || 'GET', headers: { ...(init.headers || {}) } });
    const [status, body] = handler(path, init);
    const text = JSON.stringify(body);
    return { ok: status >= 200 && status < 300, status, headers: new Headers({ 'content-type': 'application/json' }), text: async () => text };
  };
  const transport = await import(`../src/platform/cloudTransport.js?edition-case=${++loads}`);
  return { transport, calls };
}
const HEALTH = edition => ({ ok: true, service: 'pri-learning-platform', ...(edition === undefined ? {} : { edition }) });
const REFUSAL = serverEdition => [409, { error: { code: 'EDITION_MISMATCH', message: 'This app is Priyabhata. It cannot sign in to Prithagoras\'s service.', serverEdition, clientEdition: 'priyabhata' }, requestId: 'r-1' }];
const healthReads = calls => calls.filter(call => call.path === '/v1/health').length;
const savedFetch = globalThis.fetch;
try {
  {
    const { transport, calls } = await transportAgainst(path => (path === '/v1/health' ? [200, HEALTH('priyabhata')] : [200, { account: null }]));
    await transport.cloudRequest('/v1/account/me');
    await transport.cloudRequest('/v1/account/login', { method: 'POST', body: { email: 'a@example.test' } });
    ok(calls.length === 2 && calls.every(call => call.headers['X-Pri-Edition'] === 'priyabhata'), 'every /v1 request declares the build\'s edition in X-Pri-Edition');
    ok(calls.every(call => call.headers['X-Pri-Client'] === 'web-v1' && call.headers.Accept === 'application/json'), 'beside the headers it always sent');
    ok(!JSON.stringify(calls).includes('prithagoras'), 'and never names another edition');
    const seen = [];
    transport.onEditionMismatch(conflict => seen.push(conflict));
    ok((await transport.checkServerEdition()) === null && transport.editionMismatch() === null, 'a server of the same edition: no conflict');
    ok(healthReads(calls) === 1, 'the check reads /v1/health once');
    await transport.checkServerEdition();
    await transport.checkServerEdition();
    ok(healthReads(calls) === 1 && seen.length === 0, 'and only once per start, however often it is asked');
  }
  {
    const { transport, calls } = await transportAgainst(path => (path === '/v1/health' ? [200, HEALTH('prithagoras')] : [200, {}]));
    const seen = [];
    transport.onEditionMismatch(conflict => seen.push(conflict));
    ok(transport.editionMismatch() === null, 'before anything is heard there is no conflict');
    eq(await transport.checkServerEdition(), { service: 'prithagoras' }, 'a health reply naming the other edition is the conflict');
    eq(transport.editionMismatch(), { service: 'prithagoras' }, 'which is remembered');
    eq(seen, [{ service: 'prithagoras' }], 'and announced to the listener, once');
    eq(await transport.checkServerEdition(), { service: 'prithagoras' }, 'asking again gives the same answer');
    ok(seen.length === 1 && healthReads(calls) === 1, 'without re-reading or re-announcing');
  }
  {
    const { transport } = await transportAgainst(path => (path === '/v1/health' ? [200, HEALTH(undefined)] : [200, {}]));
    ok((await transport.checkServerEdition()) === null, 'a server that names no edition is not a conflict');
  }
  {
    const { transport } = await transportAgainst(path => (path === '/v1/health' ? [200, HEALTH('<img src=x>')] : [200, {}]));
    ok((await transport.checkServerEdition()) === null, 'a health reply whose edition is not a plain id blocks nothing');
  }
  {
    const { transport } = await transportAgainst(() => { throw new TypeError('network down'); });
    ok((await transport.checkServerEdition()) === null && transport.editionMismatch() === null, 'an unreachable server is no answer: no conflict, and nothing thrown');
  }
  {
    const { transport } = await transportAgainst(path => (path === '/v1/health' ? [503, { error: { code: 'NOT_READY' } }] : [200, {}]));
    ok((await transport.checkServerEdition()) === null, 'a failing health reply is no answer either');
  }
  {
    const { transport, calls } = await transportAgainst(path => (path === '/v1/health' ? [200, HEALTH('priyabhata')] : REFUSAL('prithagoras')));
    const seen = [];
    transport.onEditionMismatch(conflict => seen.push(conflict));
    let error = null;
    try { await transport.cloudRequest('/v1/account/login', { method: 'POST', body: { email: 'a@example.test' } }); } catch (caught) { error = caught; }
    ok(error && error.status === 409 && error.code === 'EDITION_MISMATCH', 'a 409 EDITION_MISMATCH reaches the caller as a coded error');
    ok(error.serverEdition === 'prithagoras' && error.requestId, 'typed: it carries the server\'s edition and the request id');
    eq(seen, [{ service: 'prithagoras' }], 'and is announced as the conflict');
    try { await transport.cloudRequest('/v1/sync/pull/0'); } catch { /* refused again */ }
    ok(seen.length === 1, 'a second refusal does not announce it again');
    eq(transport.editionMismatch(), { service: 'prithagoras' }, 'the conflict is remembered');
    ok(healthReads(calls) === 0, 'and none of it needed /v1/health');
  }
  {
    const { transport } = await transportAgainst(() => REFUSAL('<img src=x>'));
    let error = null;
    try { await transport.cloudRequest('/v1/account/me'); } catch (caught) { error = caught; }
    ok(error?.code === 'EDITION_MISMATCH' && error.status === 409 && error.serverEdition === null, 'a refusal that does not name a plain edition id still reaches the caller as the coded error');
    ok(transport.editionMismatch() === null, 'but, naming no service, it is not turned into the blocking screen');
  }
  {
    const { transport } = await transportAgainst(() => [409, { error: { code: 'EXAM_ALREADY_OPEN', message: 'An exam is open.', serverEdition: 'prithagoras' } }]);
    let error = null;
    try { await transport.cloudRequest('/v1/exams', { method: 'POST', body: {} }); } catch (caught) { error = caught; }
    ok(error?.code === 'EXAM_ALREADY_OPEN' && !('serverEdition' in error) && transport.editionMismatch() === null, 'another 409 is not an edition conflict, whatever fields it carries');
  }
  {
    const source = read('src/platform/cloudTransport.js');
    ok((source.match(/\[EDITION_HEADER\]: EDITION/g) || []).length === 2, 'the request and the streamed tutor turn both declare the edition');
    ok((source.match(/editionRefusal\(err, data\);/g) || []).length === 3, 'the native, web and streaming paths all read an edition refusal');
    ok(/if \(data\?\.service !== HEALTH_SERVICE\) return null;\s+serverEditionAsked = true;\s+hearServerEdition\(data\.edition\);/.test(source), 'the boot probe hears the serving server\'s edition, so a web start asks nothing extra');
  }
} finally {
  globalThis.fetch = savedFetch;
  delete globalThis.__PRI_CLOUD_ORIGIN__;
}

// ── 5 · The blocking screen ──────────────────────────────────────────────────
{
  const en = (await import('../src/i18n/strings.en.js')).default;
  const hi = (await import('../src/i18n/strings.hi.js')).default;
  for (const [lang, strings] of [['en', en], ['hi', hi]]) {
    const sentence = strings['edition.mismatchBody'];
    ok(typeof sentence === 'string' && sentence.includes('{app}') && sentence.includes('{service}'), `${lang}: the sentence exists and names the app and the service by placeholder`);
    ok(!table.EDITION_IDS.some(id => sentence.toLowerCase().includes(id)), `${lang}: and spells out neither edition's name`);
  }
  ok(en['edition.mismatchBody'] === 'This app is {app}. It cannot sign in to {service}\'s service.', 'the English sentence is the one decided for E2');

  const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  for (const [own, other] of [['priyabhata', 'prithagoras'], ['prithagoras', 'priyabhata']]) {
    const server = await ssr(own);
    try {
      const i18n = await server.ssrLoadModule('/src/i18n/index.js');
      const view = (await server.ssrLoadModule('/src/components/EditionMismatch.jsx')).default;
      const built = await server.ssrLoadModule('/src/platform/edition.js');
      const app = table.EDITIONS[own].brand;
      const service = table.EDITIONS[other].brand;
      for (const lang of ['en', 'hi']) {
        await i18n.setLanguage(lang);
        // What a health reply from the other edition's server leads to.
        const health = { ok: true, service: 'pri-learning-platform', edition: other };
        const conflict = built.editionConflict(health.edition);
        const html = renderToStaticMarkup(React.createElement(view, { conflict }));
        const sentence = i18n.translate('edition.mismatchBody', { app, service });
        ok(html.includes(escapeHtml(sentence)) && sentence.includes(app) && sentence.includes(service), `${own} build, ${lang}: the screen says this app is ${app} and cannot sign in to ${service}'s service`);
        ok(lang !== 'en' || sentence === `This app is ${app}. It cannot sign in to ${service}'s service.`, `${own} build, ${lang}: in exactly the decided words`);
        ok(/<h1[^>]*>/.test(html) && /role="alert"/.test(html) && html.includes(`data-edition-mismatch="${other}"`), `${own} build, ${lang}: as the page's heading, announced as an alert`);
        ok(!/<form|<input|<button|<a |<select|<textarea/.test(html), `${own} build, ${lang}: with no sign-in form, no field, no button and no link: nothing to retry`);
        const never = renderToStaticMarkup(React.createElement(view, { conflict: built.editionConflict('atlantis') }));
        ok(never.includes('Atlantis') && never.includes(app) && !/<form|<input|<button/.test(never), `${own} build, ${lang}: an edition this build never heard of is named from its id`);
      }
      await i18n.setLanguage('en');
    } finally {
      await server.close();
    }
  }
}

// ── 6 · The wiring ───────────────────────────────────────────────────────────
{
  const main = read('src/main.jsx');
  const at = text => main.indexOf(text);
  ok(at('onEditionMismatch(showEditionMismatch);') > 0 && at('if (editionMismatch()) { showEditionMismatch(editionMismatch()); return; }') > 0, 'main.jsx listens for a conflict and checks for one before it draws');
  ok(at('if (editionMismatch()) { showEditionMismatch(editionMismatch()); return; }') < at('<BrowserRouter>'), 'a conflict the boot probe heard is drawn INSTEAD of the app: the sign-in screen is never rendered');
  ok(at('onEditionMismatch(showEditionMismatch);') < at('void checkServerEdition();') && at('void checkServerEdition();') < at('<BrowserRouter>'), 'otherwise the check is started, without being waited for, and its answer replaces the app');
  ok(main.includes('const showEditionMismatch = conflict => root.render(<EditionMismatch conflict={conflict} />);'), 'the screen replaces the whole root');
  ok(!/await checkServerEdition/.test(main), 'the first paint never waits on the edition check');
  const login = read('src/pages/Login.jsx');
  ok(!/platform\/edition|EditionMismatch|X-Pri-Edition/.test(login), 'Login.jsx is not touched by E2 (its course default is plan E3)');
  const view = read('src/components/EditionMismatch.jsx');
  ok(!/onClick|<button|<form|href=|reload|retry/i.test(view.replace(/\/\/.*$/gm, '')), 'the screen component offers no action');
}

if (failures.length) {
  console.error(`\nedition-client-check: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`EDITION CLIENT (E2): PASS — ${pass}/${pass} checks — the app knows its own edition from its build, declares it on every request, and shows a blocking screen, with no sign-in form, at the other edition's server.`);
