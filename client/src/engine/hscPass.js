// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "HSC Pass to the exams" (Prithagoras): the offer, its end date and its price
//
// Owner decisions, 19 November 2026: two ways to buy in Prithagoras copy,
//   "HSC Pass, monthly"         A$9.99 a month
//   "HSC Pass to the exams"     one payment, NO renewal, ending the day after the
//                               last HSC Mathematics exam of its exam year.
// The price steps down as the end date nears. The internal capability ids
// (premium-exams, ...) are unchanged. THIS MODULE IS CONFIGURATION AND ARITHMETIC
// ONLY: it takes no payment, grants nothing and is not wired to checkout. Payments in
// Australia stay OFF behind the existing switch; docs/release/au-payments-switch-on.md
// lists what turning them on takes.
//
// THE END DATE, PER EXAM YEAR. The last HSC Mathematics written exam of the year.
//   2027: NOT PUBLISHED when this was written (19 Nov 2026). NESA's written exam timetable page
//   (https://educationstandards.nsw.edu.au/wps/portal/nesa/about/key-dates/hsc-key-dates/written-exam-timetable)
//   showed the 2026 timetable only. The date below is a PROVISIONAL stand-in, 31 October 2027, the
//   last day of the HSC written period the 2026 timetable implies (it began 13 October 2026, four
//   weeks). OWNER ACTION: confirm it when NESA publishes the 2027 timetable and set `provisional: false`.
//   The pass ends the day AFTER that exam, so `endsOn` is the day after `lastExam`.
//
// THE PRICE SCHEDULE. Full price (A$69) until six months before the end date; after that, pro rata by
// the WHOLE MONTHS remaining (the part-month is not charged for), never below the floor. All amounts
// are whole Australian dollars, so the price shown is the price charged.
//   months remaining = whole calendar months from the purchase day to the end date
//   price = months >= 6 ? 69 : max(FLOOR, ceil(69 * months / 6))
// ─────────────────────────────────────────────────────────────────────────────

export const HSC_PASS = Object.freeze({
  monthly: Object.freeze({ id: 'hsc-pass-monthly', name: 'HSC Pass, monthly', amountAud: 9.99, interval: 'month', renews: true }),
  toTheExams: Object.freeze({ id: 'hsc-pass-to-the-exams', name: 'HSC Pass to the exams', fullPriceAud: 69, floorAud: 19, fullPriceMonths: 6, renews: false }),
  // exam year -> the last HSC Mathematics written exam (a date, YYYY-MM-DD) and whether it is confirmed
  examYears: Object.freeze({
    2027: Object.freeze({ lastExam: '2027-10-31', provisional: true, source: 'https://educationstandards.nsw.edu.au/wps/portal/nesa/about/key-dates/hsc-key-dates/written-exam-timetable' })
  })
});

const DAY = 86_400_000;
const utc = iso => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const iso = ms => new Date(ms).toISOString().slice(0, 10);

/** The day the pass ends: the day after the last exam of its exam year. */
export function passEndDate(examYear) {
  const y = HSC_PASS.examYears[examYear];
  if (!y) return null;
  return { endsOn: iso(utc(y.lastExam) + DAY), lastExam: y.lastExam, provisional: y.provisional === true };
}

/** Whole calendar months from `from` to `to` (both YYYY-MM-DD), never negative. */
export function wholeMonthsBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return Math.max(0, months);
}

/**
 * The offer on a given day: exact price (whole A$), end date, months it covers, and whether the end date is provisional.
 * `null` once the pass would have ended (nothing left to buy).
 */
export function passOffer(examYear, today) {
  const end = passEndDate(examYear);
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(String(today))) return null;
  if (utc(today) >= utc(end.endsOn)) return null;
  const cfg = HSC_PASS.toTheExams;
  const months = wholeMonthsBetween(today, end.endsOn);
  const price = months >= cfg.fullPriceMonths ? cfg.fullPriceAud : Math.max(cfg.floorAud, Math.ceil((cfg.fullPriceAud * months) / cfg.fullPriceMonths));
  return { name: cfg.name, priceAud: price, endsOn: end.endsOn, lastExam: end.lastExam, provisionalEndDate: end.provisional, months, renews: false,
    disclosure: `One payment of A$${price}. It does not renew. Your HSC Pass ends on ${end.endsOn}${end.provisional ? ' (date to be confirmed by NESA)' : ''}.` };
}
