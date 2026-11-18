// Pri Learning · everything the guest picker lists is something the server issues (ADR-0003).
//
// The picker (client/src/guest/guestMenu.js) offers a chapter and level only
// from the availability helpers the existing pickers use. This holds it to the
// server's own banks: for BOTH editions, every year, course, chapter and level
// it lists must resolve to a request the edition's server will issue, generate
// a real question there, seal for the edition, and never be premium or archive
// content; and nothing the other edition teaches may appear.
import './support/hermetic.mjs';
import { checks } from './support/app-harness.mjs';
import { bankPolicy, sealForEdition } from '../platform/editionBanks.js';
import { premiumCapabilityForGenerator } from '../../client/src/engine/practiceAllowance.js';
import { generateQuestion, loadAllBanks } from '../../client/src/engine/generators/index.js';
import { coursesFor, chaptersFor, guestTarget, guestYears, settleChoice, PICKER_FORMS } from '../../client/src/guest/guestMenu.js';

await loadAllBanks();
const c = checks();
const SEEDS = [11, 12345, 987654];

for (const edition of ['priyabhata', 'prithagoras']) {
  const banks = bankPolicy(edition);
  let cells = 0, chapters = 0;
  c.deq(guestYears(), [7, 8, 9, 10, 11, 12], `${edition}: Years/Classes 7 to 12`);
  for (const year of guestYears()) {
    const courses = coursesFor(edition, year);
    c.ok(courses.length >= 1, `${edition} ${year}: at least one course`);
    for (const course of courses) {
      for (const ch of chaptersFor(edition, year, course.key)) {
        chapters++;
        c.ok(ch.levels.length > 0 && ch.levels.every(d => d >= 1 && d <= 4), `${edition} ${year} ${course.key} ${ch.id}: levels ${ch.levels}`);
        for (const d of ch.levels) {
          cells++;
          const target = guestTarget(edition, { year, course: course.key, chapter: ch.id, difficulty: d }, () => 0);
          c.ok(target && target.difficulty === d, `${edition} ${ch.id} D${d} resolves`);
          c.ok(banks.issues(target.generator), `${edition} ${target.generator} is a bank this edition issues`);
          c.ok(!premiumCapabilityForGenerator(target.generator) && !/^pyq-|^jee-(main|advanced)-/.test(target.generator), `${target.generator} is free, non-archive content`);
          let made = 0;
          for (const seed of SEEDS) {
            const q = generateQuestion(target.generator, d, seed, undefined, null);
            if (q && typeof q.prompt === 'string' && (!banks.admits || banks.admits(q, target.generator)) && sealForEdition(q, banks, target.generator)) made++;
          }
          c.ok(made > 0, `${edition} ${target.generator} D${d}: a question is generated and sealed for the edition`);
        }
      }
    }
  }
  c.ok(chapters >= 40 && cells >= 100, `${edition}: ${chapters} chapters, ${cells} chapter-and-level cells listed`);
  // A level a chapter lacks is never resolved.
  const any = chaptersFor(edition, 9, coursesFor(edition, 9)[0].key)[0];
  c.eq(guestTarget(edition, { year: 9, course: coursesFor(edition, 9)[0].key, chapter: any.id, difficulty: 9 }), null, `${edition}: an unlisted level resolves to nothing`);
  c.eq(guestTarget(edition, { year: 9, course: 'nope', chapter: any.id, difficulty: 1 }), null, `${edition}: an unlisted course resolves to nothing`);
  const settled = settleChoice(edition, { year: 99, course: 'x', chapter: 'y', difficulty: 7, form: 'z' });
  c.ok(settled.year >= 7 && settled.course && settled.chapter && settled.difficulty && PICKER_FORMS.includes(settled.form), `${edition}: a stale saved choice settles to one on offer`);
}
// One edition lists nothing of the other's.
const names = ed => new Set(guestYears().flatMap(y => coursesFor(ed, y).flatMap(co => chaptersFor(ed, y, co.key).map(ch => ch.id))));
const india = names('priyabhata'), nsw = names('prithagoras');
c.ok([...india].every(id => !nsw.has(id)) && !([...india].some(id => /^y\d/.test(id))), 'Priyabhata lists no NSW chapter');
c.ok([...nsw].every(id => /^(y|ms|ext|e)\d*/.test(id) || id.length > 0) && ![...nsw].some(id => /^c\d+-/.test(id)), 'Prithagoras lists no India chapter');
c.ok(!coursesFor('priyabhata', 12).some(x => /advanced/i.test(x.key)) && !coursesFor('prithagoras', 12).some(x => x.key.startsWith('jee')), 'no premium JEE Advanced anywhere; no JEE in Prithagoras');
console.log(`✓ guest-menu-issuable-check.mjs (${c.count()} checks)`);
