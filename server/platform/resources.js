// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the shared resource library (ADR-0002, plan mission F1)
//
//   GET /v1/resources        search and filter the published library
//   GET /v1/resources/:id    one published resource
//
// One library in the platform for both regional editions. A resource is a
// paper, its solutions or study notes, described here and linked to where it
// is published; Pri stores no copy of it (availability 'external', an https
// link). 'hosted' — a document kept in edition-region storage — is reserved
// for plan F3 (publishing) and refused here, by the validator and by the read.
//
// Who sees what is the SERVER's decision, never a request parameter's:
//   · signed-in accounts only (requireSession; children only with guardian
//     consent, as every other student-facing router);
//   · only rows in review state 'published';
//   · only rows offered to the edition this server serves (PRI_EDITION,
//     server/platform/edition.js). A client that sends ?edition=… is ignored:
//     it cannot read the other edition's library through this server.
//
// The resource tables are global (not owned by an account), like
// content_revisions: on Postgres they carry RLS with the fail-closed
// pri_scope_required policy only, and every read here is decided by the
// server authorization above (docs/security/threat-model.md §7).
//
// What a row may claim is bounded by ADR-0002 §7: `certificationState` says how
// far a paper has climbed (uploaded → structured → verified → issued →
// certified). An 'uploaded' paper is to read: nothing here marks it, and the
// client says so in plain words. No resource in this library sets or implies a
// mark.
//
// Out of scope (later missions): bookmarks and command search (F2), staff
// publishing and hosted PDFs (F3), the unmarked Exam Desk (F4).
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireSession } from './security.js';
import { serverEdition } from './edition.js';
import { EDITION_IDS } from '../../client/edition.config.mjs';
import { RESOURCE_COURSES, RESOURCE_TYPES, resourcePublic } from './resourceCatalog.js';

export { RESOURCE_SEED, resourcePublic, resourceProblems } from './resourceCatalog.js';

const ID = /^[a-z0-9][a-z0-9-]{2,119}$/;
const SEARCH_MAX = 120;
const SUBJECT_MAX = 120;
const PAGE = 100;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const bad = (res, code, message) => res.status(400).json({ error: { code, message } });
const likeEscape = s => s.replace(/[\\%_]/g, c => `\\${c}`);

// What every read may return: published, offered to this edition, and linked
// over https (a 'hosted' row from a later mission is never served by F1).
const VISIBLE = `r.review_state='published' AND r.availability='external' AND r.url LIKE 'https://%'
  AND EXISTS (SELECT 1 FROM resource_editions e WHERE e.resource_id=r.id AND e.edition=?)`;

/**
 * The library router. `edition` defaults to the server's own (PRI_EDITION);
 * tests pass one to prove the other edition's rows stay out.
 */
export function createResourceRouter(db, { edition = serverEdition(process.env) } = {}) {
  db = asStore(db);
  if (!EDITION_IDS.includes(edition)) throw new Error(`resource library: unknown edition ${JSON.stringify(edition)}`);
  const router = asyncRouter();
  router.use(requireSession(db));

  router.get('/', rateLimit(db, 'resources-list', { limit: 600, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const q = req.query || {};
    const where = [VISIBLE];
    const params = [edition];
    if (q.type !== undefined) {
      if (!RESOURCE_TYPES.includes(q.type)) return bad(res, 'RESOURCE_FILTER_INVALID', 'Type must be paper, solutions or notes.');
      where.push('r.type=?'); params.push(q.type);
    }
    if (q.course !== undefined) {
      if (!RESOURCE_COURSES.includes(q.course)) return bad(res, 'RESOURCE_FILTER_INVALID', 'Course is not known.');
      where.push('r.course=?'); params.push(q.course);
    }
    if (q.year !== undefined) {
      const year = /^\d{4}$/.test(String(q.year)) ? Number(q.year) : NaN;
      if (!(year >= MIN_YEAR && year <= MAX_YEAR)) return bad(res, 'RESOURCE_FILTER_INVALID', 'Year must be a four-digit year.');
      where.push('r.year=?'); params.push(year);
    }
    if (q.subject !== undefined) {
      if (typeof q.subject !== 'string' || !q.subject.trim() || q.subject.length > SUBJECT_MAX) return bad(res, 'RESOURCE_FILTER_INVALID', 'Subject is not valid.');
      where.push('LOWER(r.subject)=?'); params.push(q.subject.trim().toLowerCase());
    }
    if (q.q !== undefined) {
      if (typeof q.q !== 'string' || q.q.length > SEARCH_MAX) return bad(res, 'RESOURCE_SEARCH_INVALID', `Search must be at most ${SEARCH_MAX} characters.`);
      // Every word must appear somewhere in the resource's own text.
      const words = q.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
      for (const w of words) {
        where.push(`LOWER(r.title || ' ' || COALESCE(r.subtitle,'') || ' ' || r.description || ' ' || r.subject || ' ' || r.tags_json || ' ' || COALESCE(r.grade,'') || ' ' || r.source) LIKE ? ESCAPE '\\'`);
        params.push(`%${likeEscape(w)}%`);
      }
    }
    const rows = await db.all(`SELECT r.* FROM resources r WHERE ${where.join(' AND ')}
      ORDER BY r.year DESC, r.title, r.id LIMIT ?`, [...params, PAGE + 1]);
    // The facets are what this edition's published library offers, whatever
    // the current filters: the client builds its filter menus from them.
    const facets = await db.all(`SELECT DISTINCT r.type, r.subject, r.year, r.course FROM resources r WHERE ${VISIBLE}`, [edition]);
    res.set('Cache-Control', 'private, no-store');
    res.json({
      resources: rows.slice(0, PAGE).map(resourcePublic),
      hasMore: rows.length > PAGE,
      facets: {
        types: RESOURCE_TYPES.filter(t => facets.some(f => f.type === t)),
        subjects: [...new Set(facets.map(f => f.subject))].sort(),
        years: [...new Set(facets.map(f => Number(f.year)))].sort((a, b) => b - a),
        courses: RESOURCE_COURSES.filter(c => facets.some(f => f.course === c))
      }
    });
  });

  router.get('/:id', rateLimit(db, 'resources-read', { limit: 1200, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const id = String(req.params.id || '');
    // An unknown id, a draft, a withdrawn row and another edition's row are the
    // same answer: nothing here says which resources exist elsewhere.
    const row = ID.test(id) ? await db.get(`SELECT r.* FROM resources r WHERE r.id=? AND ${VISIBLE}`, [id, edition]) : null;
    res.set('Cache-Control', 'private, no-store');
    if (!row) return res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'No such resource in this library.' } });
    res.json({ resource: resourcePublic(row) });
  });

  return router;
}
