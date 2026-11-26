import './hermetic.mjs';
process.env.PRI_EDITION='prithagoras';
const { MARKER_OPS, markerView } = await import('../../platform/markerOps.js');
const { buildAnnotatedWorking } = await import('../../../client/src/components/annotatedWorkingModel.js');
const { buildMarkedPage, } = await import('../../../client/src/components/markedPageModel.js');
const T = await import('../../../client/src/components/markedPageTeacher.js');
const G = await import('../../../client/src/engine/generators/index.js'); await G.loadAllBanks();
const q0 = G.generateQuestion('y12-diff',1,1);
// The two owner pages (26 November 2026) as the reader returned them, with their questions. Synthetic questions: the owner's own prompts are not stored.
export const PAGES = {
 seats: { prompt: 'A theatre has 29 seats in the first row, and each later row has 2 more seats than the row before. The first $n$ rows hold $\\frac{n(58+2(n-1))}{2}$ seats. How many seats are in the first 20 rows?', key: '960',
  lines: ['Number of seats in the first 20 rows','First row has 29 seats, and each later row has 2 more seats.','The first n rows hold n(58+2(n−1))/2 seats.','Method: Substitute n = 20 into the given formula.','= 20(58 + 2(20 − 1))/2','= 20(58 + 2(19))/2','= 20(58 + 38)/2','= 20(96)/2','= 1920/2','= 960','There are [960] seats in the first 20 rows.'] },
 users: { prompt: 'A phone app starts with 815 users and the number is multiplied by 2 every week. How many are there after 4 weeks?', key: '13040',
  lines: ['Solution:','Given: Initial users = 815, and the number of users doubles every week.','Method: Use a geometric sequence with common ratio r = 2.','Working:','Let U_n be the number of users after n weeks.','Then U_n = 815 × 2^n.','After 4 weeks (n = 4),','U_4 = 815 × 2^4','= 815 × 16','= 13 040.','Conclusion: There are [13 040] users after 4 weeks.'] }
};
export function run(name, lines0 = null, key0 = null, prompt0 = null) {
  const P = PAGES[name] || { prompt: prompt0, key: key0, lines: lines0 };
  const lines = lines0 || P.lines, key = key0 ?? P.key;
  const q = markerView({ ...q0, prompt: prompt0 || P.prompt, answerType:'numeric', answer:{ value: Number(key) }, steps: undefined, _marking:'final-answer-only' });
  const r = MARKER_OPS.practice({ q, answer: key, working: lines.join('\n'), evidenceIfWrong:true, policy:{methodMarks:true} }, ()=>{});
  const rep = r?.evidence?.shownReport || r?.evidence?.stepReport;
  const model = buildAnnotatedWorking({ lines, stepReport: rep, page:true });
  const page = buildMarkedPage({ model });
  const marks = T.buildTeacherMarks({ page });
  return { r, rep, page, marks, tally: T.tallyOf(page) };
}
if (process.argv[1].endsWith('teacher-page-run.mjs') && !process.argv.includes('--write')) {
  for (const name of Object.keys(PAGES)) {
    const o = run(name);
    console.log('==', name, o.r.result, o.tally);
    for (const l of o.page.lines) { const m = o.marks.find(x => x.n === l.n); console.log(l.n, l.status, l.card.tickClass||'', '|', l.card.text.slice(0,50), '=>', m ? `${m.phrase}` : ''); }
  }
}

// node server/test/support/teacher-page-run.mjs --write   saves the engine's reports for the two pages where the tour reads them (client/test/support/teacher-page-owner-photos.json)
export function savedPages() {
  const out = { note: 'The server marking path on the two owner pages of 26 November 2026 (reader text, synthetic questions). Regenerate: node server/test/support/teacher-page-run.mjs --write', pages: {} };
  for (const k of Object.keys(PAGES)) { const o = run(k); out.pages[k] = { prompt: PAGES[k].prompt, key: PAGES[k].key, lines: PAGES[k].lines, shownReport: o.rep, correct: o.r.result.correct === true }; }
  return out;
}
if (process.argv[1].endsWith('teacher-page-run.mjs') && process.argv.includes('--write')) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(new URL('../../../client/test/support/teacher-page-owner-photos.json', import.meta.url), JSON.stringify(savedPages(), null, 1) + '\n');
  console.log('wrote client/test/support/teacher-page-owner-photos.json');
}
