// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · GET /v1/habits — Mistake DNA, from the server's own marks
//
// The profile (client/src/engine/mistakeDna.js) over THIS account's
// server-graded attempts only; a device-written event is never evidence.
// Premium (`advanced-analytics`, from the server's own entitlement row). A
// free account is told how many moves the profile has found, and nothing
// about them.
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireRole, requireSession, requireVerifiedEmail } from './security.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { mistakeDna } from '../../client/src/engine/mistakeDna.js';

export const DNA_CAPABILITY = 'advanced-analytics';
const SCAN = 2000;

export function createMistakeDnaRouter(rawDb) {
  const db = asStore(rawDb);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));

  router.get('/', rateLimit(db, 'habits', { limit: 120, windowMs: 3600000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const attempts = (await db.all(
      "SELECT id,occurred_at,payload_json FROM learning_events WHERE account_id=? AND device_id='server-grader' AND kind='graded-attempt' ORDER BY server_cursor DESC LIMIT ?",
      [accountId, SCAN])).map(row => {
      try { const p = JSON.parse(row.payload_json); return { ...p, attemptId: p.attemptId || row.id, at: Number(row.occurred_at) }; } catch { return null; }
    }).filter(Boolean);
    const dna = mistakeDna(attempts);
    const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    res.set('Cache-Control', 'no-store');
    if (!serverEntitlementCapabilities(snapshot, now).includes(DNA_CAPABILITY)) {
      return res.status(200).json({ premium: false, capability: DNA_CAPABILITY, habitCount: dna.habits.length, answered: dna.answered });
    }
    return res.status(200).json({ premium: true, ...dna });
  });
  return router;
}
