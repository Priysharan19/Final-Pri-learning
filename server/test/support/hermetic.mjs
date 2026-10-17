// Hermetic test process defaults. Import this FIRST (before any module that
// reaches server/platform/db.js) in every server suite:
//
//   import './support/hermetic.mjs';
//
// 1. Platform database. server/platform/db.js opens PRI_PLATFORM_DB at import
//    and falls back to the shared server/data/pri-learning-platform.db. Two
//    suites (or two checkouts' worth of concurrent sessions) that import it
//    without setting the variable used to share that one file and fail with
//    SQLITE_BUSY "database is locked". Each process now gets its own file in a
//    fresh mkdtemp directory, removed on exit. A suite that sets
//    PRI_PLATFORM_DB itself (before its dynamic import) still wins.
//
// 2. Release identity. In production mode the server refuses a dirty source
//    tree. That check reads the developer's checkout, so an untracked file
//    anywhere made /v1/health answer 500 in every NODE_ENV=production suite.
//    Suites are not a release: this switches off ONLY the working-tree
//    cleanliness/SHA-agreement verification for this in-process test run. The
//    production default is unchanged, and server/test/release-identity-check.mjs
//    proves serverReleaseIdentity still refuses a dirty tree when it is on.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setReleaseSourceVerification } from '../../platform/releaseIdentity.js';

const dir = mkdtempSync(join(tmpdir(), 'pri-server-test-'));
if (!process.env.PRI_PLATFORM_DB && !process.env.PRI_DATABASE_URL) {
  process.env.PRI_PLATFORM_DB = join(dir, 'platform.db');
}
process.on('exit', () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

setReleaseSourceVerification(false);

export const hermeticDir = dir;
