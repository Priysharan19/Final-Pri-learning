// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the regional editions, held in source (ADR-0002, plan E1)
//
// One platform, two editions — Priyabhata (India) and Prithagoras (Australia).
// This suite proves that:
//
//   1. the table is well formed and keeps FULL PARITY BOTH WAYS: both editions
//      declare exactly the same capabilities, and every capability an edition
//      does not offer yet is a written gap naming the plan mission that closes
//      it (a broken table is shown to fail, not just a good one to pass);
//   2. a deployment picks its edition only by PRI_EDITION, unset is
//      Priyabhata, and a typo throws instead of shipping the other edition;
//   3. the locale and timezone in the table equal client/src/lib/locale.js;
//   4. the build records the edition (features.json, __PRI_EDITION__), the
//      Dockerfile forwards PRI_EDITION to the client build and ships the table
//      to the runtime image, and /v1/health reports the server's edition;
//   5. E1 changes no student behaviour: nothing under client/src reads it yet.
//
// It ends by printing each edition's open gaps — the parity debt still owed.
//
// Usage: node client/test/edition-config-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const throws = fn => { try { fn(); return false; } catch { return true; } };

const ed = await import('../edition.config.mjs');
const locale = await import('../src/lib/locale.js');

// 1. Shape and parity.
ok(JSON.stringify(ed.EDITION_IDS) === JSON.stringify(['priyabhata', 'prithagoras']), 'exactly two editions: priyabhata, prithagoras');
ok(ed.editionProblems().length === 0, `the edition table has no problems: ${ed.editionProblems().join('; ')}`);
for (const id of ed.EDITION_IDS) {
  const caps = Object.keys(ed.EDITIONS[id].capabilities).sort();
  ok(JSON.stringify(caps) === JSON.stringify([...ed.CAPABILITIES].sort()), `${id} declares every capability, and only those`);
}
ok(new Set(ed.CAPABILITIES).size === ed.CAPABILITIES.length && ed.CAPABILITIES.length >= 12, 'twelve distinct capabilities (the management table, Exam Desk and publishing included)');
ok(ed.EDITIONS.priyabhata.brand === 'Priyabhata' && ed.EDITIONS.prithagoras.brand === 'Prithagoras', 'each edition carries its own brand');
ok(ed.COMPANY === 'Pri Learning' && ed.EDITION_IDS.every(id => ed.EDITIONS[id].brand !== ed.COMPANY), 'Pri Learning is the company, never an edition brand');
ok(ed.EDITIONS.priyabhata.defaultCourse === 'in' && ed.EDITIONS.prithagoras.defaultCourse === 'nsw', 'default courses: in (India), nsw (Australia)');
ok(ed.EDITIONS.priyabhata.currency === 'INR' && ed.EDITIONS.prithagoras.currency === 'AUD', 'currencies: INR, AUD');
ok(ed.EDITIONS.priyabhata.languages.includes('hi'), 'Priyabhata offers Hindi');
// Parity runs both ways: Prithagoras's own features are owed to Priyabhata too.
for (const cap of ['examDesk', 'resourceLibrary', 'resourcePublishing']) {
  for (const id of ed.EDITION_IDS) ok(ed.EDITIONS[id].capabilities[cap] !== undefined, `${id} declares ${cap} (a Prithagoras feature)`);
}
// The rule fails a broken table.
{
  const clone = JSON.parse(JSON.stringify(ed.EDITIONS));
  delete clone.prithagoras.capabilities.aiTutor;
  ok(ed.editionProblems(clone).some(p => p.includes('aiTutor')), 'a capability missing from one edition is a problem');
  const noMission = JSON.parse(JSON.stringify(ed.EDITIONS));
  noMission.prithagoras.capabilities.aiTutor = { pending: 'Maybe later, when we get to it.' };
  ok(ed.editionProblems(noMission).some(p => p.includes('aiTutor')), 'a gap that names no plan mission is a problem');
  const bare = JSON.parse(JSON.stringify(ed.EDITIONS));
  bare.priyabhata.capabilities.verifiedMarking = false;
  ok(ed.editionProblems(bare).some(p => p.includes('verifiedMarking')), 'a capability switched off with no reason is a problem');
  const extra = JSON.parse(JSON.stringify(ed.EDITIONS));
  extra.priyabhata.capabilities.indiaOnlyBonus = true;
  ok(ed.editionProblems(extra).some(p => p.includes('indiaOnlyBonus')), 'a capability only one edition declares is a problem');
  const companyBrand = JSON.parse(JSON.stringify(ed.EDITIONS));
  companyBrand.prithagoras.brand = 'Pri Learning';
  ok(ed.editionProblems(companyBrand).length > 0, 'an edition branded as the company is a problem');
}
ok(Object.isFrozen(ed.EDITIONS) && Object.isFrozen(ed.EDITIONS.prithagoras.capabilities), 'the table is frozen');

// 2. Selection.
ok(ed.resolveEdition({}) === 'priyabhata', 'PRI_EDITION unset → priyabhata');
ok(ed.resolveEdition({ PRI_EDITION: '' }) === 'priyabhata' && ed.resolveEdition({ PRI_EDITION: '  ' }) === 'priyabhata', 'PRI_EDITION blank (the Dockerfile ENV of an unset ARG) → priyabhata');
ok(ed.resolveEdition({ PRI_EDITION: 'prithagoras' }) === 'prithagoras', 'PRI_EDITION=prithagoras selects Prithagoras');
for (const bad of ['Prithagoras', 'pythagoras', 'au', 'constructor', '__proto__', 'toString']) {
  ok(throws(() => ed.resolveEdition({ PRI_EDITION: bad })), `PRI_EDITION=${bad} throws`);
}
ok(ed.capabilityOffered('priyabhata', 'verifiedMarking') === true, 'capabilityOffered reads true');
ok(ed.capabilityOffered('prithagoras', 'resourceLibrary') === false, 'capabilityOffered reads a pending gap as not offered');

// 3. Locale agreement.
ok(ed.EDITIONS.priyabhata.locale === locale.INDIA_LOCALE && ed.EDITIONS.priyabhata.timezone === locale.INDIA_TIMEZONE, 'Priyabhata locale/timezone equal lib/locale.js');
ok(ed.EDITIONS.prithagoras.locale === locale.AUSTRALIA_LOCALE && ed.EDITIONS.prithagoras.timezone === locale.AUSTRALIA_TIMEZONE, 'Prithagoras locale/timezone equal lib/locale.js');
ok(locale.currencyOf('in') === ed.EDITIONS.priyabhata.currency && locale.currencyOf('nsw') === ed.EDITIONS.prithagoras.currency, 'default-course currencies equal lib/locale.js');
{
  const src = read('client/edition.config.mjs');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1]);
  ok(JSON.stringify(imports) === JSON.stringify(['./src/i18n/languages.js']), 'the table imports only the language table already in the runtime image');
}

// 4. Wiring.
const vite = await import('../vite.config.js');
ok(vite.featureStates('build', {}).edition === 'priyabhata', 'a build with no PRI_EDITION records priyabhata in features.json');
ok(vite.featureStates('build', { PRI_EDITION: 'prithagoras' }).edition === 'prithagoras', 'a Prithagoras build records prithagoras');
ok(vite.featureDefines('build', { PRI_EDITION: 'prithagoras' }).__PRI_EDITION__ === '"prithagoras"', 'the build defines __PRI_EDITION__');
ok(throws(() => vite.featureStates('build', { PRI_EDITION: 'typo' })), 'a build with an unknown edition stops');
{
  const docker = read('Dockerfile');
  const clientStage = docker.split(/^FROM /m)[1];
  ok(/^ARG PRI_EDITION$/m.test(clientStage) && /PRI_EDITION=\$\{PRI_EDITION\}/.test(clientStage), 'the client-build stage declares and forwards PRI_EDITION');
  ok(/^COPY client\/edition\.config\.mjs \.\/client\/edition\.config\.mjs$/m.test(docker), 'the runtime image ships the edition table');
}
{
  const { serverEdition } = await import('../../server/platform/edition.js');
  ok(serverEdition({}) === 'priyabhata' && serverEdition({ PRI_EDITION: 'prithagoras' }) === 'prithagoras', 'the server resolves the edition the same way');
  ok(throws(() => serverEdition({ PRI_EDITION: 'typo' })), 'the server refuses an unknown edition');
  const router = read('server/platform/router.js');
  ok(/const edition = serverEdition\(\);/.test(router) && /^\s+edition,$/m.test(router), '/v1/health reports the edition');
}

// 5. No behaviour change in the student app yet.
{
  let readers = '';
  try {
    readers = execFileSync('git', ['-C', ROOT, 'grep', '-l', '-e', 'edition.config', '-e', '__PRI_EDITION__', '--', 'client/src'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    if (e.status !== 1) throw e; // git grep exits 1 when nothing matches
  }
  ok(readers === '', `E1: nothing under client/src reads the edition yet (${readers})`);
}

const gaps = ed.parityGaps();
console.log('Parity debt (capability → what closes it):');
for (const id of ed.EDITION_IDS) {
  console.log(`  ${ed.EDITIONS[id].brand}: ${gaps[id].length} open`);
  for (const g of gaps[id]) console.log(`    - ${g.capability}: ${g.pending}`);
}

if (failures.length) {
  console.error(`\nedition-config-check: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nedition-config-check: ${pass} passed`);
