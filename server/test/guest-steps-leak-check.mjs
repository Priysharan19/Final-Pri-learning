// Pri Learning · worked steps never leak the answer before the question closes (ADR-0003).
//
// For EVERY chapter and level either edition's guest picker lists, 20 seeds each: find, with a
// deliberately crude oracle that shares no code with the server's heuristic, the first worked step
// whose heading or working contains the final answer (as the display text, the canonical input,
// the leading number or a solution of a set, as a whole token). The server must close the question
// (release the answer) at or before releasing that step, or give no steps and no retry at all.
import './support/hermetic.mjs';
import { checks } from './support/app-harness.mjs';
import { bankPolicy, sealForEdition } from '../platform/editionBanks.js';
import { generateQuestion, loadAllBanks } from '../../client/src/engine/generators/index.js';
import { coursesFor, chaptersFor, guestTarget, guestYears } from '../../client/src/guest/guestMenu.js';
import { answerTextFor } from '../platform/practice.js';
import { guestSteps, closingStepOf } from '../platform/guestTrial.js';

await loadAllBanks();
const c = checks();
const crude = s => String(s ?? '').replace(/\\(?:d?frac|left|right|Rightarrow|rightarrow|times|cdot|text|quad)/g, ' ').replace(/\\sqrt/g, '√').replace(/[−–]/g, '-').replace(/\+\s*-/g, '-').replace(/[^0-9a-zA-Z.\-√π/=]+/g, ' ').toLowerCase();
const flat = s => crude(s).replace(/\s+/g, '');
const tokensOf = q => {
  const shown = flat(answerTextFor(q));
  const set = new Set([shown, flat(q.answer?.canonicalInput), shown.replace(/^[a-z]'?(\([a-z0-9]\))?=/, ''), shown.replace(/^[a-z]=/, '').replace(/^[×*]/, '')]);
  const lead = shown.replace(/^[a-z]=/, '').match(/^-?\d+(?:\.\d+)?(?![\d.a-z])/)?.[0];
  if (lead && q.answerType === 'numeric') set.add(lead);
  for (const part of String(answerTextFor(q)).replace(/\\[,;! ]/g, ' ').split(/[,;]|\bor\b|\band\b/)) set.add(flat(part).replace(/^[a-z]=/, ''));
  return [...set].filter(t => t.length > 0);
};
const holds = (text, token) => { const t = ' ' + crude(text).replace(/=/g, ' = ').replace(/,/g, ' ') + ' '; for (let at = t.indexOf(token); at !== -1; at = t.indexOf(token, at + 1)) { if (!/[0-9a-z.]/.test(t[at - 1] ?? ' ') && !/[0-9a-z.]/.test(t[at + token.length] ?? ' ')) return true; } return false; };

let questions = 0, withSteps = 0, bad = [];
for (const edition of ['priyabhata', 'prithagoras']) {
  const banks = bankPolicy(edition);
  for (const year of guestYears()) for (const course of coursesFor(edition, year)) for (const ch of chaptersFor(edition, year, course.key)) for (const d of ch.levels) {
    const target = guestTarget(edition, { year, course: course.key, chapter: ch.id, difficulty: d }, () => 0);
    for (let i = 1; i <= 20; i++) {
      let q; try { q = generateQuestion(target.generator, d, i * 7919 + d, undefined, null); } catch { continue; }
      if (!q || typeof q.prompt !== 'string' || q.multipart || q.answerType === 'working') continue;
      q._generator = target.generator; q._practiceMode = 'practice';
      if (!sealForEdition(q, banks)) continue;
      questions++;
      const steps = guestSteps(q);
      if (!steps.length) continue;
      withSteps++;
      const tokens = tokensOf(q);
      const first = steps.findIndex(s => tokens.some(t => holds(s.d, t) || holds(s.h, t)));
      const closes = closingStepOf(q, steps);
      if (first !== -1 && closes > first + 1) bad.push(`${edition} ${target.generator} d${d} seed${q.seed}: step ${first + 1} states the answer, closes at ${closes}`);
    }
  }
}
c.ok(questions > 3000, `${questions} guest-issuable questions examined`);
c.ok(withSteps > questions * 0.2, `${withSteps} of them keep a retry (the rest resolve as they always did)`);
console.log(`examined ${questions}, retry kept for ${withSteps}`);
if (bad.length) console.error(bad.slice(0, 15).join('\n'), `\n${bad.length} leaks`);
c.eq(bad.length, 0, 'no worked step that states the answer is released while the retry is open');
console.log(`✓ guest-steps-leak-check.mjs (${c.count()} checks)`);
