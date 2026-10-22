// Pri Learning · the Report's "Where marks were lost" panel never contradicts
// the period's certified figures. Usage: node client/test/report-lost-check.mjs
import { lostPanel } from '../src/instrument/reportLost.js';

const names = { 'in-real': 'Real Numbers', 'in-poly': 'Polynomials', 'in-tri': 'Triangles' };
const nameOf = id => names[id] || null;
let failed = 0; let total = 0;
const check = (name, ok, detail = '') => { total++; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${detail}`}`); };

// 41/62 earned this period, but no chapter row on this syllabus: never "none lost".
let p = lostPanel({}, nameOf, { marksEarned: 41, marksPossible: 62 });
check('41/62 with no chapter rows is not "none lost"', p.state !== 'none', p.state);
check('— it states the 21 unplaced marks out of 62', p.state === 'unplaced' && p.unplaced === 21 && p.possible === 62, JSON.stringify(p));
p = lostPanel({ 'out-of-scope': { earned: 41, possible: 62 } }, nameOf, { marksEarned: 41, marksPossible: 62 });
check('41/62 lost only in an out-of-syllabus chapter is unplaced, not "none"', p.state === 'unplaced' && p.unplaced === 21);
// 41/62 with chapter rows: the rows, most lost first.
p = lostPanel({ 'in-real': { earned: 10, possible: 12 }, 'in-poly': { earned: 20, possible: 30 }, 'in-tri': { earned: 11, possible: 20 } }, nameOf, { marksEarned: 41, marksPossible: 62 });
check('41/62 with chapter rows lists them, most lost first', p.state === 'rows' && p.rows.map(r => r.id).join() === 'in-poly,in-tri,in-real', p.rows.map(r => r.id).join());
check('— each row carries its certified earned/possible', p.rows[0].earned === 20 && p.rows[0].possible === 30 && p.rows[0].lost === 10);
// Nothing lost anywhere: "none".
p = lostPanel({ 'in-real': { earned: 12, possible: 12 } }, nameOf, { marksEarned: 12, marksPossible: 12 });
check('full marks everywhere says none lost', p.state === 'none');
// No certified figures for the period at all: "none" only if no rows.
p = lostPanel({}, nameOf, null);
check('no figures and no rows says none lost', p.state === 'none');
p = lostPanel({}, nameOf, { marksEarned: 0, marksPossible: 0 });
check('a period with no marks possible says none lost', p.state === 'none');
// Top three only, ties by name.
p = lostPanel({ a: { earned: 0, possible: 2 }, b: { earned: 0, possible: 2 }, c: { earned: 0, possible: 2 }, d: { earned: 0, possible: 2 } }, id => id.toUpperCase(), null);
check('at most three rows, ties broken by name', p.rows.map(r => r.id).join() === 'a,b,c');

console.log(failed ? `REPORT LOST: FAIL — ${failed} of ${total}` : `REPORT LOST: PASS — ${total}/${total} checks`);
process.exit(failed ? 1 : 0);
