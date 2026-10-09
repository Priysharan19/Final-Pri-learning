// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what "a real answer reached real marking" means in a tour.
//
// Only Pri's server marks (owner decision 2026-10-10). A card that shows
// something after Submit proves nothing by itself: the sign-in refusal and the
// offline-draft notice are drawn in the same place. A tour whose purpose is
// "the answer was marked" therefore reads the server's own reply for the
// question on screen and compares it with what the card drew.
//
// Read-only: nothing here intercepts, stubs or hands anything to the page.
// ─────────────────────────────────────────────────────────────────────────────

/** Rendered result furniture on the question card, counted. */
const cardFacts = page => page.evaluate(() => {
  const seen = sel => [...document.querySelectorAll(sel)].filter(el => el.getClientRects().length > 0);
  return {
    good: seen('.verdict-good').length,
    bad: seen('.verdict-bad').length,
    evaluation: seen('.eval-card').length,
    outcome: seen('.eval-card')[0]?.getAttribute('data-outcome') || null,
    refusal: seen('[data-check-refusal]').map(el => el.getAttribute('data-check-refusal')),
    needsAccount: seen('[data-check-needs-account]').length
  };
});

/**
 * The server's verdict on the question on screen, and whether the card shows
 * that verdict. `ok` is true only when:
 *   · the question was issued by the server to the signed-in account,
 *   · its latest submit was answered 200 with an authoritative receipt
 *     (authoritative === true, an attempt id, a boolean `correct`),
 *   · the card draws a verdict and no refusal, and
 *   · the verdict drawn agrees with the server's `correct`.
 */
export async function serverMarking(online, page) {
  const row = await online.shownRow();
  const serverQuestionId = row?.serverQuestionId || null;
  const submits = serverQuestionId
    ? await online.practiceCalls(new RegExp(`^/v1/practice/${serverQuestionId}/submit$`)) : [];
  const last = submits.at(-1) || null;
  const receipt = last?.json || null;
  const card = await cardFacts(page);
  const sealed = serverQuestionId
    ? online.platform.h.db.prepare("SELECT account_id FROM idempotency_keys WHERE scope='practice-question' AND key=?").get(serverQuestionId)
    : null;
  const owned = !!sealed && !!online.account && String(sealed.account_id) === online.account.id;
  const authoritative = last?.status === 200 && receipt?.authoritative === true &&
    typeof receipt.attemptId === 'string' && receipt.attemptId.length > 0 && typeof receipt.correct === 'boolean';
  const drawn = card.good + card.bad + card.evaluation > 0 && card.refusal.length === 0 && card.needsAccount === 0;
  const agrees = authoritative && drawn && (receipt.correct
    ? card.bad === 0 && (card.good > 0 || card.outcome === 'correct')
    : card.good === 0 && card.outcome !== 'correct');
  return {
    ok: owned && authoritative && drawn && agrees,
    serverQuestionId, owned, authoritative, drawn, agrees, card,
    submits: submits.length,
    receipt: receipt && { status: last.status, authoritative: receipt.authoritative, correct: receipt.correct, resolved: receipt.resolved, triesLeft: receipt.triesLeft, attemptId: typeof receipt.attemptId }
  };
}

/** Nothing on the card is a result: no verdict, no evaluation. */
export async function nothingMarkedOnCard(page) {
  const card = await cardFacts(page);
  return { none: card.good + card.bad + card.evaluation === 0, card };
}
