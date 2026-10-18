// A chapter-level request resolves to ONE cell — a generator at a difficulty —
// and the server draws inside that cell only (server/platform/practice.js,
// chooseQuestion). A chapter can hold more than a thousand distinct questions
// and still have a cell smaller than the repeat window: Class X Quadratic
// Equations at D2 is three cells of about 1,200, 144 and 12 items, drawn with
// equal probability. Once all twelve of the small cell's items were inside the
// window, a request that landed on it was served a flagged repeat — on a
// chapter with 1,400 fresh questions to offer (issue #540).
//
// The device's own draft path never had this problem: drawDistinct re-resolves
// the target on a collision "so a chapter is not stuck on one small cell". This
// does the same for a served question: when the server flags a repeat and the
// request can be re-resolved to a different cell on the same terms (same
// difficulty, same dot point, same archive status — `retarget`, built with
// sameTerms in local/backend.js), the device asks again on that cell, up to a
// few cells, and keeps the first fresh reply. A dot point with one cell has
// nowhere else to go and is served the flagged repeat, as before: a pool
// genuinely smaller than the window is exhausted, not broken, and the card
// says so.
//
// Pure and deterministic given `serve` and `retarget`, so it is pinned by
// client/test/retarget-on-repeat-check.mjs with crafted replies.

/**
 * @param {(target) => Promise<{ q, fields, trapDelivered, repeat }>} serve
 *   serves one question for `target` (serveQuestion in local/backend.js)
 * @param {object} target   the resolved cell the request landed on
 * @param {(() => object|null)|null} retarget
 *   re-resolves the request on the same terms; null when it cannot be
 * @param {{ maxCells?: number, resolveTries?: number }} [options]
 *   maxCells: how many distinct cells may be asked in all (the first included);
 *   resolveTries: how many re-resolutions to spend looking for a cell not yet asked
 * @returns {Promise<{ out, target }>} the reply kept, and the cell it came from
 */
export async function serveAvoidingRepeat(serve, target, retarget, { maxCells = 4, resolveTries = 8 } = {}) {
  const first = await serve(target);
  // A fresh question, a device draft (its own draw already re-targeted) or a
  // request that cannot be re-resolved: nothing more to do.
  if (!first?.repeat || first.fields?.draftOnly || typeof retarget !== 'function') return { out: first, target };
  const asked = new Set([target.generator]);
  while (asked.size < maxCells) {
    let next = null;
    for (let i = 0; i < resolveTries && !next; i++) {
      const candidate = retarget();
      if (candidate?.generator && !asked.has(candidate.generator)) next = candidate;
    }
    if (!next) break;
    asked.add(next.generator);
    const out = await serve(next);
    if (!out?.repeat || out.fields?.draftOnly) return { out, target: next };
  }
  // Every cell that could be asked repeats too: the request's own cell's
  // reply stands, flagged, so the card can say it is a repeat.
  return { out: first, target };
}
