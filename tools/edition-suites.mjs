#!/usr/bin/env node
// EDITION SUITES (plan E6) — the one list of edition-sensitive suites that CI
// runs a second time with PRI_EDITION=prithagoras, so a change that breaks
// only the Prithagoras edition turns a required context red.
//
// Every suite here also runs once in the sharded `npm test` chain under the
// default edition (Priyabhata). The engine, marking and platform suites do not
// read the edition and run once (ADR-0002: editions never differ in marking).
//
//   node tools/edition-suites.mjs --list
//   node tools/edition-suites.mjs --run --edition=prithagoras
//   node tools/edition-suites.mjs --verify-coverage
//
// --verify-coverage proves the list is complete: every suite under client/test
// or server/test that imports client/edition.config.mjs or the server's
// platform/edition.js is either listed here or exempted below with a reason.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Run with `node <file>` under the named edition. Order: cheap first. */
export const EDITION_SUITES = [
  // Edition configuration, brand and client wiring.
  'client/test/edition-config-check.mjs',
  'client/test/brand-strings-check.mjs',
  'client/test/brand-usage-check.mjs',
  'client/test/brand-assets-check.mjs',
  'client/test/edition-client-check.mjs',
  'client/test/aurora-skin-check.mjs',
  'client/test/working-indicator-check.mjs',
  'client/test/i18n-coverage-check.mjs',
  // Sign-up scope and paywall honesty, the edition's own limit clock.
  'client/test/signup-consent-check.mjs',
  'client/test/edition-limit-clock-check.mjs',
  'client/test/account-action-guardian-erase-check.mjs',
  // NSW curriculum, practice banks and exams; the library and the Exam Desk.
  'client/test/nsw-curriculum-check.mjs',
  'client/test/nsw-bank-quality-check.mjs',
  'client/test/nsw-exams-check.mjs',
  'client/test/library-ui-check.mjs',
  'client/test/desk-clock-check.mjs',
  'client/test/desk-import-check.mjs',
  'client/test/desk-ui-check.mjs',
  // The server: edition agreement, billing per edition, budgets per region,
  // NSW practice and exams, the desk, the hardened production boundary.
  'server/test/edition-agreement-check.mjs',
  'server/test/billing-edition-check.mjs',
  'server/test/edition-ai-budgets-check.mjs',
  'server/test/nsw-practice-check.mjs',
  'server/test/nsw-exam-check.mjs',
  'server/test/desk-check.mjs',
  'server/test/desk-isolation-check.mjs',
  'server/test/security-hardening-check.mjs',
  'server/test/production-runtime-image-check.mjs'
];

/** Import the edition modules but are proven per edition elsewhere. */
export const EXEMPT = {
  'client/test/a11y-gate.mjs': 'a browser walk that assumes an India profile; not yet edition-aware (open gap, plan E6), runs once on Priyabhata in a11y-boot',
  'client/test/brand-build-check.mjs': 'builds both editions itself (--both) in the "Client build and offline-first boundary" job'
};

// Any reference counts (static import, dynamic import, a path read at runtime).
const EDITION_IMPORT = /edition\.config\.mjs|platform\/edition\.js/;

function suiteFiles() {
  const out = [];
  for (const dir of ['client/test', 'server/test']) {
    for (const name of readdirSync(path.join(ROOT, dir))) {
      if (!/\.(mjs|js)$/.test(name)) continue;
      out.push(`${dir}/${name}`);
    }
  }
  return out.sort();
}

export function coverageProblems() {
  const problems = [];
  const listed = new Set(EDITION_SUITES);
  if (listed.size !== EDITION_SUITES.length) problems.push('a suite is listed twice');
  for (const file of [...EDITION_SUITES, ...Object.keys(EXEMPT)]) {
    if (!existsSync(path.join(ROOT, file))) problems.push(`${file} is named but does not exist`);
  }
  for (const file of Object.keys(EXEMPT)) if (listed.has(file)) problems.push(`${file} is both listed and exempt`);
  let importers = 0;
  for (const file of suiteFiles()) {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    if (!EDITION_IMPORT.test(text)) continue;
    importers += 1;
    if (!listed.has(file) && !EXEMPT[file]) problems.push(`${file} imports the edition configuration but is neither in EDITION_SUITES nor EXEMPT (tools/edition-suites.mjs)`);
  }
  if (importers === 0) problems.push('no suite imports the edition configuration: the import pattern no longer matches anything');
  return { problems, importers };
}

function arg(name) {
  const hit = process.argv.slice(2).find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    for (const f of EDITION_SUITES) console.log(f);
  } else if (argv.includes('--verify-coverage')) {
    const { problems, importers } = coverageProblems();
    if (problems.length) {
      for (const p of problems) console.error(`  ✗ ${p}`);
      console.error(`EDITION SUITES COVERAGE: FAIL — ${problems.length} problem(s)`);
      process.exit(1);
    }
    console.log(`EDITION SUITES COVERAGE: PASS — ${EDITION_SUITES.length} listed, ${Object.keys(EXEMPT).length} exempt, ${importers} importers accounted for`);
  } else if (argv.includes('--run')) {
    const edition = arg('edition');
    if (!edition) { console.error('usage: --run --edition=<id>'); process.exit(2); }
    const { problems } = coverageProblems();
    if (problems.length) { for (const p of problems) console.error(`  ✗ ${p}`); process.exit(1); }
    let passed = 0;
    for (const file of EDITION_SUITES) {
      console.log(`\n── ${file} (PRI_EDITION=${edition})`);
      const r = spawnSync(process.execPath, [file], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PRI_EDITION: edition } });
      if (r.status !== 0) {
        console.error(`EDITION SUITES (${edition}): FAIL — ${file} exited ${r.status ?? r.signal} after ${passed}/${EDITION_SUITES.length} passed`);
        process.exit(1);
      }
      passed += 1;
    }
    console.log(`EDITION SUITES (${edition}): PASS — ${passed}/${EDITION_SUITES.length} suites`);
  } else {
    console.error('usage: --list | --verify-coverage | --run --edition=<id>');
    process.exit(2);
  }
}
