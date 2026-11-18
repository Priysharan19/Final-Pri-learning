// HSC Pass to the exams: the price schedule, the end date and the disclosure (client/src/engine/hscPass.js).
// Pure arithmetic. No payment, no entitlement, no checkout is touched here.
import assert from 'node:assert/strict';
import { HSC_PASS, passEndDate, passOffer, passOfferAt, sydneyDate, wholeMonthsBetween } from '../src/engine/hscPass.js';

let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n += 1; };

eq(HSC_PASS.monthly.amountAud, 9.99, 'monthly is A$9.99');
eq(HSC_PASS.toTheExams.renews, false, 'the pass to the exams never renews');
eq(HSC_PASS.toTheExams.fullPriceAud, 69, 'one payment of A$69');
eq(passEndDate(2027).endsOn, '2027-11-01', 'it ends the day AFTER the last exam (provisional 31 Oct 2027)');
eq(passEndDate(2027).provisional, true, 'and says the 2027 date is provisional until NESA publishes it');
eq(passEndDate(2030), null, 'an exam year with no configured date has no offer');
// months
eq(wholeMonthsBetween('2027-05-01', '2027-11-01'), 6, 'exactly six months');
eq(wholeMonthsBetween('2027-05-02', '2027-11-01'), 5, 'one day short of six months is five whole months');
eq(wholeMonthsBetween('2027-10-31', '2027-11-01'), 0, 'a day before the end is zero months');
// price boundaries
const price = d => passOffer(2027, d)?.priceAud;
eq(price('2026-11-20'), 69, 'full price far out');
eq(price('2027-05-01'), 69, 'full price exactly six months before the end date');
eq(price('2027-05-02'), 58, 'one day inside six months: five whole months, ceil(69*5/6) = 58');
eq(price('2027-07-01'), 46, 'four months: 46');
eq(price('2027-08-01'), 35, 'three months: ceil(34.5) = 35');
eq(price('2027-09-01'), 23, 'two months: 23');
eq(price('2027-10-01'), 19, 'one month: ceil(11.5) = 12, held at the A$19 floor');
eq(price('2027-10-31'), 19, 'the last day: the floor');
eq(passOffer(2027, '2027-11-01'), null, 'on the end date there is nothing left to buy');
eq(passOffer(2027, 'soon'), null, 'a malformed day is no offer');
const offer = passOffer(2027, '2027-05-02');
eq([offer.renews, offer.endsOn, offer.provisionalEndDate], [false, '2027-11-01', true], 'the offer shows no renewal, the end date and that it is provisional');
eq(offer.disclosure, 'One payment of A$58. It does not renew. Your HSC Pass ends on 2027-11-01 (date to be confirmed by NESA).', 'the exact price and end date are stated before purchase');
// The purchase day is the day in Sydney, not in UTC
eq(sydneyDate(Date.UTC(2027, 4, 1, 14, 30)), '2027-05-02', '14:30 UTC on 1 May is already 2 May in Sydney (AEST +10)');
eq(passOfferAt(2027, Date.UTC(2027, 4, 1, 14, 30)).priceAud, 58, 'so the price is the 2 May price (five whole months), not the 1 May full price');
eq(passOfferAt(2027, Date.UTC(2027, 4, 1, 13, 30)).priceAud, 69, 'and 13:30 UTC is still 1 May in Sydney: full price');
eq(passOfferAt(2027, Date.UTC(2027, 9, 31, 13, 30)), null, '13:30 UTC on 31 Oct is 1 Nov in Sydney (AEDT +11): the pass has ended, nothing to buy');
for (let m = 0; m < 400; m += 1) {
  const day = new Date(Date.UTC(2026, 10, 20) + m * 86_400_000).toISOString().slice(0, 10);
  const p = price(day);
  if (p === undefined) continue;
  assert.ok(Number.isInteger(p) && p >= 19 && p <= 69, `${day}: a whole-dollar price between the floor and full price`);
  const next = price(new Date(Date.UTC(2026, 10, 21) + m * 86_400_000).toISOString().slice(0, 10));
  if (next !== undefined) assert.ok(next <= p, `${day}: the price never rises as the date nears`);
}
n += 1;
console.log(`HSC PASS: PASS — ${n}/${n} checks — the price steps down to a floor as the end date nears; one payment, no renewal. [CONFIGURATION ONLY: checkout is off]`);
