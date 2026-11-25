// Pri Learning · the approved GENERIC step-mark rule, scoped to the author's own question bank (DRAFT: pays nothing until he files his own record)
//
// R4 (marking authority). genericSteps.js is the rule the author approved on 24 November 2026 for generator questions (Years 11 and 12). This module
// does NOT change it and does not copy it: it imports genericEligible, genericPlan and awardGeneric as they are and applies them to a bank part, with
// HIS worked steps [{h, d}] as the authored solution and HIS marks as N. A wrong or missing final answer earns at most N - 1: one mark per key step
// (the last N - 1 distinct readable steps before the answer step) that a ticked line of the deterministic report reaches, before the first crossed
// line or unverified claim, exactly as genericSteps.js defines. The reply table shows the key steps by his own step headings.
//
// This is a separate approval id, `generic-solution-steps-bank`, with its own digest over THIS small scoping module, the wording it adds, and the
// digest of the generic rule (so the generic rule changing would withdraw it too). The existing generic id and its digest are untouched.
//
// Scope: a bank part (qbankPack.js) that is a marked auto-type question (never a worked-solution question) worth 2 or more marks, in a practice,
// review or task mode (schemeAward.SCHEME_MODES), with at least one key step. Nothing here pays until the author's record at the current digest
// exists, PRI_METHOD_MARKS=on, Prithagoras, and the part was stamped at issue (editionBanks.sealForEdition).
//
// Pure and deterministic: no model, no network, no clock.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { genericDigest, genericEligible, genericPlan, awardGeneric } from './genericSteps.js';
import { marksPossibleFor } from './markerOps.js';

export const BANK_GENERIC_ID = 'generic-solution-steps-bank';
export const BANK_GENERIC_TITLE = 'Step marks drawn from the author\'s worked solution of his own bank question (the approved generic rule, applied to the bank)';
export const BANK_GENERIC_WORDING = Object.freeze({
  scope: 'The generic solution-step rule you approved, applied unchanged to a question of your own bank, with your worked steps as the authored solution and your marks as N.',
  table: 'Each row is a step of your worked solution, shown by your own step heading.'
});
export const BANK_GENERIC_PARAMETERS = Object.freeze({ MIN_MARKS: 2, AUTO_TYPES: ['numeric', 'expression', 'set', 'interval', 'equation', 'point'] });

const canonText = v => (Array.isArray(v) ? `[${v.map(canonText).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonText(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
let memo = null;
/** The digest the author signs: id, title, wording, parameters, the source of this module and the digest of the generic rule it applies. */
export function bankGenericDigest() {
  if (memo) return memo;
  const source = fs.readFileSync(new URL(import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  memo = crypto.createHash('sha256').update(canonText({ id: BANK_GENERIC_ID, title: BANK_GENERIC_TITLE, wording: BANK_GENERIC_WORDING, parameters: BANK_GENERIC_PARAMETERS, generic: genericDigest(), source })).digest('hex');
  return memo;
}

/** A marked bank part worth 2+ marks that the generic rule can pay at least one key step of. */
export function bankGenericEligible(q) {
  try {
    if (!q || typeof q._bank !== 'string' || q._worked !== undefined || !BANK_GENERIC_PARAMETERS.AUTO_TYPES.includes(q.answerType)) return false;
    if (marksPossibleFor(q) < BANK_GENERIC_PARAMETERS.MIN_MARKS || !genericEligible(q)) return false;
    return genericPlan(q).keySteps.length >= 1;
  } catch { return false; }
}

/** The generic award for a bank part, unchanged ({ items, total, possible, cross, plan } or null). */
export const awardBankGeneric = (q, report, correct) => (bankGenericEligible(q) ? awardGeneric(q, report, correct === true) : null);
