// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the journey's code source on staging: L2's test mailbox.
//
// On staging only (RAILWAY_ENVIRONMENT_NAME 'staging'), mail to a reserved
// @e2e.prilearning.test address is captured instead of sent and can be read
// back at GET /v1/test-mailbox/latest?to=<address>; /v1/ready says whether the
// mailbox is on. Codes read this way prove the app and server end to end but
// NOT delivery to a real inbox: every step that relies on one is labelled
//   VERIFIED VIA STAGING TEST MAILBOX: delivery to a real inbox not exercised
// and real delivery is proven once by the owner's acceptance run on their own
// email (tools/acceptance/staging-acceptance.mjs).
//
// The contract this reads (agreed with L2 through the Director; the reader is
// deliberately tolerant of the fields' exact placement):
//   GET /v1/test-mailbox/latest?to=<address>
//     200 { to, subject, text?, receivedAt? }  — newest captured message for that
//         exact address (also accepted: { message: { … } } or { code, purpose })
//     404 when nothing was captured for it, or when the mailbox is off
//   GET /v1/ready → testMailbox: 'on' | 'off'  (or checks.testMailbox.state)
// Same interface as tools/staging-inbox.mjs: waitForCode(to, purpose, since, timeoutMs).
// ─────────────────────────────────────────────────────────────────────────────
import { codeFromSubject } from './staging-inbox.mjs';

export const TEST_MAILBOX_DOMAIN = 'e2e.prilearning.test';
export const TEST_MAILBOX_LABEL = 'VERIFIED VIA STAGING TEST MAILBOX: delivery to a real inbox not exercised';

/** pri-<run>-<n>@e2e.prilearning.test */
export const e2eAddress = (run, n) => `pri-${run}-${n}@${TEST_MAILBOX_DOMAIN}`;

/** 'on' | 'off' | 'unknown' from a /v1/ready reply. */
export function testMailboxState(ready) {
  const v = ready?.testMailbox ?? ready?.checks?.testMailbox?.state ?? ready?.checks?.testMailbox;
  if (v === 'on' || v === true) return 'on';
  if (v === 'off' || v === false) return 'off';
  return 'unknown';
}

/** { code, purpose, at } from one /latest reply, or null. Purpose comes from the subject Pri sends. */
export function parseLatest(body) {
  const m = body?.message && typeof body.message === 'object' ? body.message : body;
  if (!m || typeof m !== 'object') return null;
  const at = Number(m.receivedAt ?? m.capturedAt ?? m.at ?? 0) || (m.receivedAt ? Date.parse(m.receivedAt) : 0);
  const fromSubject = m.subject ? codeFromSubject(String(m.subject)) : null;
  if (fromSubject) return { ...fromSubject, at };
  if (/^\d{6}$/.test(String(m.code || '')) && m.purpose) return { code: String(m.code), purpose: String(m.purpose), at };
  const first = /^(\d{6})\b/.exec(String(m.text || '').trim());
  return first ? { code: first[1], purpose: null, at } : null;
}

/** The live adapter. `fetchImpl` is injectable for tests. */
export function testMailbox(origin, { fetchImpl = globalThis.fetch, pollMs = 3000 } = {}) {
  return {
    label: TEST_MAILBOX_LABEL,
    async waitForCode(to, purpose, since, timeoutMs = 120000) {
      const started = Date.now();
      for (;;) {
        const r = await fetchImpl(`${origin}/v1/test-mailbox/latest?to=${encodeURIComponent(to)}`, { headers: { Accept: 'application/json' } }).catch(() => null);
        if (r && r.status === 200) {
          const got = parseLatest(await r.json().catch(() => null));
          // Older than this request (minus clock slack) is a previous code: keep waiting.
          if (got && (!got.at || got.at >= since - 60000) && (!purpose || !got.purpose || got.purpose === purpose)) {
            return { code: got.code, waitedMs: Date.now() - started };
          }
        }
        if (Date.now() - started > timeoutMs) return { code: null, waitedMs: Date.now() - started };
        await new Promise(res => setTimeout(res, pollMs));
      }
    }
  };
}
