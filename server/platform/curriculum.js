// Pri Learning — GET /v1/curriculum: the curriculum this server's edition
// teaches, with honest availability (ADR-0002, plan G3).
//
// Curriculum truth and generator availability are different facts
// (client/src/engine/curriculumAvailability.js). On a Prithagoras server the
// reply lists every outcome of the current NSW syllabuses — Mathematics K–10
// (2022) and the Stage 6 (2024) syllabuses — and says, per outcome, whether an
// issued question stands behind it (`generated`) and what may be asked for
// (`practice`: generator, dot point, difficulties). An outcome with no issued
// question is listed with `generated: false`; nothing is hidden to look
// complete. Outcome codes and Pri's own focus-area names only: no NESA wording.
//
// The reply is the same for every account: it reads no account data and writes
// nothing. It still requires a signed-in account (and guardian consent for a
// child), like the resource library beside it.
//
// Priyabhata's curriculum is built on the device from the bundled India
// syllabus, as it always has been; the server has none to add. The route is
// the same route there, behind the same guards (one platform: every reviewed
// /v1 route exists, guarded alike, on both editions), and a signed-in account
// is told 404 NOT_FOUND. No India client calls it.
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireSession } from './security.js';
import { requireGuardianConsent } from './guardianConsent.js';
import { serverEdition } from './edition.js';
import { EDITION_IDS } from '../../client/edition.config.mjs';
import { nswCurriculumResponse } from './nswBanks.js';

const RESPONSES = Object.freeze({ prithagoras: nswCurriculumResponse });

export function createCurriculumRouter(db, { edition = serverEdition(process.env) } = {}) {
  db = asStore(db);
  if (!EDITION_IDS.includes(edition)) throw new Error(`curriculum: unknown edition ${JSON.stringify(edition)}`);
  const build = RESPONSES[edition] || null;
  const router = asyncRouter();
  router.get('/', requireSession(db), requireGuardianConsent(db),
    rateLimit(db, 'curriculum-read', { limit: 600, windowMs: 60 * 60 * 1000 }), async (req, res) => {
      res.set('Cache-Control', 'private, no-store');
      if (!build) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } });
      return res.status(200).json(build());
    });
  return router;
}
