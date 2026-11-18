// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 practice papers (Prithagoras)
//
//   GET /v1/papers              the papers on offer, for a signed-in student
//   GET /v1/papers/:id/:kind    one PDF (kind = paper | guidelines), attached
//
// Original practice papers written for Prithagoras by its owner: not NESA
// examinations. The PDFs live in server/content/papers/nsw-ext1/ — a directory
// the server reads and never serves as static files — described by
// manifest.json (id, title, marks, pages, sha256 of each file).
//
// WHO MAY DOWNLOAD IS THE SERVER'S DECISION, from its own entitlement row:
//   · signed-in verified student (guardian consent for a child), as every
//     student-facing router;
//   · Premium (capability 'premium-exams', serverEntitlementCapabilities: an
//     active subscription or active trial) for every paper and every
//     marking guideline, EXCEPT
//   · a paper whose manifest entry says `sample: true` (paper and marking
//     guidelines) is free for every signed-in account. None is, today: Practice
//     Paper 13 is Premium;
//   · a free account still READS the list (titles, marks, pages).
// Nothing the device sends (a header, a body, a query) is consulted.
//
// EDITION. Only a Prithagoras server offers these papers; any other edition
// answers 404 PAPERS_NOT_AVAILABLE to both routes.
//
// PATHS. `:id` and `:kind` are looked up in the manifest; the file name that is
// opened comes from the manifest, never from the request, so no request value
// reaches the file system.
// ─────────────────────────────────────────────────────────────────────────────
import { createReadStream, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireRole, requireSession, requireVerifiedEmail } from './security.js';
import { serverEdition } from './edition.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { EDITION_IDS } from '../../client/edition.config.mjs';
import { mountPaperAttempts } from './paperAttempts.js';
import { loadApprovals, loadStructuredPapers } from './paperContent.js';

export const PAPERS_CAPABILITY = 'premium-exams';
export const PAPERS_EDITION = 'prithagoras';
export const PAPERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'papers', 'nsw-ext1');
const KINDS = Object.freeze({ paper: 'paper', guidelines: 'guidelines' });

export function loadManifest(dir = PAPERS_DIR) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  if (manifest?.version !== 1 || !Array.isArray(manifest.papers)) throw new Error('practice papers: unreadable manifest');
  return manifest;
}

const notAvailable = res => res.status(404).json({ error: { code: 'PAPERS_NOT_AVAILABLE', message: 'No practice papers are offered here.' } });
const notFound = res => res.status(404).json({ error: { code: 'PAPER_NOT_FOUND', message: 'No such practice paper.' } });

export function createPapersRouter(rawDb, { edition = serverEdition(process.env), dir = PAPERS_DIR, now: clock = () => Date.now(), transcribe, env = process.env, approvals = null } = {}) {
  const db = asStore(rawDb);
  if (!EDITION_IDS.includes(edition)) throw new Error(`practice papers: unknown edition ${JSON.stringify(edition)}`);
  const offered = edition === PAPERS_EDITION;
  const manifest = offered ? loadManifest(dir) : { papers: [] };
  const byId = new Map(manifest.papers.map(p => [p.id, p]));
  // The structured papers to sit in the app (paperContent.js): loaded now, so one the server cannot read exactly is never offered.
  const docs = offered ? loadStructuredPapers(dir) : new Map();
  const approvalList = approvals ?? (offered ? loadApprovals(dir) : []);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));

  const isPremium = async accountId => {
    const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    return serverEntitlementCapabilities(snapshot, clock()).includes(PAPERS_CAPABILITY);
  };

  // Sitting a paper in the app (paperAttempts.js). Mounted before /:id/:kind so 'attempts' is never read as a paper id.
  mountPaperAttempts(router, db, { offered, byId, docs, dir, capability: PAPERS_CAPABILITY, isPremium, now: clock, env, transcribe, approvals: approvalList });

  router.get('/', rateLimit(db, 'papers-list', { limit: 600, windowMs: 3600000 }), async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!offered) return notAvailable(res);
    const premium = await isPremium(req.platformSession.account_id);
    res.status(200).json({
      available: true,
      premium,
      capability: PAPERS_CAPABILITY,
      papers: manifest.papers.map(p => ({
        id: p.id, title: p.title, course: p.course, yearLevel: p.yearLevel, marks: p.marks, workingTime: p.workingTime,
        pages: p.paper.pages, hasGuidelines: p.hasGuidelines === true, guidelinesPages: p.guidelines?.pages ?? null,
        sample: p.sample === true, locked: !(premium || p.sample === true), inApp: docs.has(p.id)
      }))
    });
  });

  router.get('/:id/:kind', rateLimit(db, 'papers-download', { limit: 120, windowMs: 3600000 }), async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!offered) return notAvailable(res);
    const id = String(req.params.id || '');
    const kind = Object.hasOwn(KINDS, req.params.kind) ? KINDS[req.params.kind] : null;
    const entry = byId.get(id);
    const file = entry && kind ? entry[kind === 'paper' ? 'paper' : 'guidelines'] : null;
    if (!file) return notFound(res);
    if (entry.sample !== true && !(await isPremium(req.platformSession.account_id))) {
      return res.status(402).json({
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'The Extension 1 practice papers are part of Pri Learning Premium. Practice papers marked as a sample are free.',
          capability: PAPERS_CAPABILITY, plan: 'free', retryable: false
        }
      });
    }
    const downloadName = `Prithagoras-Ext1-${entry.title.replace(/[^A-Za-z0-9]+/g, '-')}${kind === 'guidelines' ? '-Marking-Guidelines' : ''}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'Content-Length': String(file.bytes),
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = createReadStream(join(dir, file.file));
    stream.on('error', err => { if (!res.headersSent) { res.removeHeader('Content-Length'); res.status(500).json({ error: { code: 'INTERNAL', message: 'The paper could not be read.' } }); } else res.destroy(err); });
    stream.pipe(res);
  });

  return router;
}
