// The marked page (components/MarkedPage.jsx) drawn on its own, with the REAL engine's verdicts on the
// owner's live cases (2026-11-18, and the product-rule page of 2026-11-23) and a SYNTHETIC page: invented strokes for ink, a canvas drawing
// for the photo. Nothing here is a real student, a real photo or a real reader. Test support only.
// ?case=buoy|stationary|mixed&source=ink|photo&edition=prithagoras|priyabhata&theme=light|dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/fonts.css';
import '../../src/theme.css';
import '../../src/theme-state.css';
import '../../src/instrument/instrument.css';
import MarkedPage from '../../src/components/MarkedPage.jsx';
import { stepCheck } from '../../src/engine/checker.js';
import { exprToLatex } from '../../src/ink/inkLatex.js';
import { setLanguage } from '../../src/i18n/index.js';
import realProductRule from './product-rule-real-report.json';

const q = new URLSearchParams(location.search);
const theme = q.get('theme') === 'dark' ? 'dark' : 'light';
const edition = q.get('edition') === 'priyabhata' ? 'priyabhata' : 'prithagoras';
const source = q.get('source') === 'photo' ? 'photo' : 'ink';
const which = q.get('case') || 'buoy';
document.documentElement.setAttribute('data-edition', edition);
document.documentElement.classList.add('ui-instrument');
document.documentElement.setAttribute('data-theme', theme);
document.documentElement.style.colorScheme = theme;
document.documentElement.style.background = 'var(--paper, var(--surface))';
document.body.style.background = 'var(--paper, var(--surface))';
if (edition === 'priyabhata') setLanguage('hi');

const BUOY = { kind: 'value-chain', fn: { name: 'h', variable: 't', expr: '22+5*sin(pi*t/6)' }, quantities: { max: 27, min: 17, amplitude: 5, midline: 22, period: 12 }, fullDomain: true };
const STAT = { kind: 'value-chain', fn: { name: 'y', variable: 'x', expr: '(2)*x^3+(9)*x^2' }, curve: { derivative: '(6)*x^2+(18)*x', stationary: [-3, 0], choose: 'smaller' } };
const OWNER = ['y=2x³+9x²', "y'=6x²+18x", "for stat points y'=0", '0=6x²+18x', '0=6x[x+3]', 'x=0 or x=-3'];
// The product-rule page (y = x^2(x - 1)): the REAL engine report for the owner's nine lines, saved in product-rule-real-report.json
// (server/test/marked-page-real-report-check.mjs fails if it drifts from the engine). Only the page drawn around it is synthetic.
const PRODUCT_REAL = realProductRule;
const CASES = {
  product: { meta: null, lines: PRODUCT_REAL.lines, report: PRODUCT_REAL.stepReport, receipt: { awarded: 0, possible: 3 } },
  buoy: { meta: BUOY, lines: ['22 + 5sin(πt/6)', 'max = 22 + 5', '= 27'], receipt: { awarded: 2, possible: 2 } },
  stationary: { meta: STAT, lines: [...OWNER, 'y(0)=0', 'smallest: (0,0)'], receipt: { awarded: 0, possible: 3 } },
  mixed: { meta: STAT, lines: ['y=2x³+9x²', '@@@', "y'=6x²+18x", 'foo', '0=6x[x+3]', 'x=0 or x=-3'], receipt: { awarded: 0, possible: 3 } },
  // ticks, lines the engine could not check (one unread), a tick, then the cross on the last line
  crossed: { meta: STAT, lines: [...OWNER.slice(0, 4), '0=6x[x+4]', '@@@', 'foo', 'x=0 or x=-3', 'smallest: (0,0)'], receipt: { awarded: 0, possible: 3 } },
  // every line the engine could check is a tick; the final answer is the server's 0 of 3
  wrongfinal: { meta: STAT, lines: [...OWNER, 'y(0)=0'], receipt: { awarded: 0, possible: 3 } }
};
// A test may hand the page its own picture and reader boxes (window.__markedPageFixture = { src, lines: [{ text, box }] }),
// to check where the outlines fall on that picture. Nothing in the real build reads this.
const FIXTURE_PAGE = typeof window !== 'undefined' && window.__markedPageFixture && source === 'photo' ? window.__markedPageFixture : null;
// ?case=owner19: a SYNTHETIC 19-line page of the stationary-points question (fixture lines, report and boxes; no photograph of anyone), with
// two columns in the middle so a tick at the end of line 7 would land on line 8's writing. The report carries the classes the engine emits.
const V = (text, how, fact, extra = {}) => ({ text, status: 'ok', state: 'verified', note: null, ...(how ? { how } : {}), ...(fact ? { fact } : {}), ...extra });
const U = text => ({ text, status: 'note', state: 'unverified' });
const C = text => ({ text, status: 'note', state: 'unverified', context: true });
const OWNER19 = [
  C('Solution:'),
  V('y = 4x^3 - 36x^2', null, null, { state: 'given', solutionMatch: true }),
  V('dy/dx = 12x^2 - 72x', { kind: 'derivative-rule' }),
  C('Stationary points when dy/dx = 0:'),
  V('12x^2 - 72x = 0', null, { kind: 'both-sides' }),
  V('12x(x - 6) = 0', { kind: 'factorised', factors: [] }),
  V('x = 0 or x = 6', null, { kind: 'proved', proof: 'listed' }),
  V('d2y/dx2 = 24x - 72', { kind: 'derivative-rule' }),
  U('At x = 0: d2y/dx2 = -72 < 0'),
  U('(local maximum)'),
  U('At x = 6: d2y/dx2 = 72 > 0'),
  U('(local minimum)'),
  C('The stationary points are:'),
  V('At x = 0: y = 4(0)^3 - 36(0)^2 = 0', null, null, { state: 'arithmetic' }),
  V('At x = 6: y = 4(6)^3 - 36(6)^2 = 4(216) - 36(36)', null, null, { state: 'arithmetic' }),
  V('= 864 - 1296 = -432', null, null, { state: 'arithmetic' }),
  U('(0, 0) and (6, -432)'),
  U('The two stationary points are (0,0) and (6,-432).'),
  V('The larger x-coordinate is 6', null, { kind: 'proved', proof: 'listed' })
];
const OWNER19_COL = i => (i >= 8 && i <= 11 ? 1 : 0);   // lines 9 to 12 are the right-hand column
function owner19Page() {
  const W = 900, H = 1010;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d2a55'; g.font = '30px "Bradley Hand","Segoe Print","Comic Sans MS",cursive'; g.textBaseline = 'middle';
  const lines = OWNER19.map((l, i) => {
    const right = OWNER19_COL(i) === 1;
    const x = right ? 478 : 40;
    // lines 8 and 9 are written side by side: line 8 ends at x = 452 and line 9 starts at 478 a little lower
    const y = i < 8 ? 40 + i * 52 : i === 8 ? 40 + 7 * 52 + 26 : 40 + 7 * 52 + 26 + (i - 8) * 52;
    g.fillText(l.text.replace(/\^2/g, '\u00b2').replace(/\^3/g, '\u00b3'), x, y);
    const w = i === 7 ? 412 : Math.min((right ? W - 478 - 20 : W - 80), g.measureText(l.text).width + 16);
    return { text: l.text, box: { x: x / W, y: (y - 22) / H, w: w / W, h: 44 / H } };
  });
  return { src: canvas.toDataURL('image/png'), lines };
}
const O19 = which === 'owner19' ? owner19Page() : null;

const c = which === 'owner19' ? { meta: null, lines: OWNER19.map(l => l.text), report: { kind: 'value-chain', source: 'value-chain', lines: OWNER19, summary: {} }, receipt: q.get('criteria') === '3' ? { awarded: 3, possible: 3 } : { awarded: 1, possible: 1 } } : FIXTURE_PAGE ? { ...CASES.buoy, lines: FIXTURE_PAGE.lines.map(l => l.text) } : (CASES[which] || CASES.buoy);
const stepReport = c.report || stepCheck(c.meta, c.lines.join('\n'));
// ?facts=1: the optional fields the engine may add (a first-break index, a corrected line on the crossed line). Absent otherwise.
if (q.get('facts') === '1' && !c.report) {
  const at = stepReport.lines.findIndex(l => l.state === 'wrong' || l.status === 'break');
  if (at >= 0) { stepReport.firstBreak = at; stepReport.lines[at] = { ...stepReport.lines[at], corrected: '0=6x[x+3]' }; }
}
const input = { lines: c.lines, stepReport, solution: null, source: source === 'ink' ? 'handwriting' : 'typed', receipt: { ...c.receipt, id: 'synthetic-0000' }, attempt: 1 };

// ── a synthetic page ─────────────────────────────────────────────────────────
// Ink: each line is a run of small wobbling strokes, as wide as its text is long.
function inkPage(lines) {
  const strokes = [];
  lines.forEach((text, i) => {
    const y = 60 + i * 90; let x = 50;
    for (const ch of text.replace(/\s+/g, '')) {
      const w = 14 + (ch.charCodeAt(0) % 5), h = 26 + (ch.charCodeAt(0) % 11);
      strokes.push({ points: [0, 1, 2, 3].map(k => ({ x: x + (k % 2 ? w : 0), y: y + (k < 2 ? 0 : h) - (k === 1 ? 4 : 0), t: i * 100 + k })) });
      x += w + 6;
    }
  });
  return strokes;
}
// Photo: ruled paper with the lines written in a handwriting-style face; the reader's box per line is known.
function photoPage(lines) {
  const W = 900, rowH = 72, H = 80 + lines.length * rowH + 40;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,110,160,0.35)'; g.lineWidth = 1;
  for (let y = 40; y < H; y += 36) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.fillStyle = '#1d2a55'; g.font = '34px "Bradley Hand","Segoe Print","Comic Sans MS",cursive'; g.textBaseline = 'middle';
  const boxes = lines.map((t, i) => {
    const y = 80 + i * rowH; g.fillText(t, 60, y + rowH / 2 - 16);
    const w = Math.min(W - 80, g.measureText(t).width + 20);
    return { x: 50 / W, y: (y + 4) / H, w: w / W, h: (rowH - 24) / H };
  });
  return { src: canvas.toDataURL('image/png'), boxes };
}

const props = O19 ? { source: { kind: 'photo', src: O19.src, lines: O19.lines } } : source === 'ink'
  ? { source: { kind: 'ink', strokes: inkPage(c.lines) } }
  : FIXTURE_PAGE ? { source: { kind: 'photo', src: FIXTURE_PAGE.src, lines: FIXTURE_PAGE.lines } }
  : (() => { const p = photoPage(c.lines); return { source: { kind: 'photo', src: p.src, lines: c.lines.map((text, i) => ({ text, box: p.boxes[i] })) } }; })();

// A FIXTURE approval, test only: the real build has no approved type. ?criteria=1 shows the table it would draw.
const O19_ITEMS = q.get('criteria') === '3'
  ? [{ key: 'derivative', text: 'Differentiates correctly', marks: 1, awarded: true, lines: [3], reason: 'Line 3 is the derivative.' },
    { key: 'stationary', text: 'Finds the stationary values', marks: 1, awarded: true, lines: [7], reason: 'Line 7 gives x = 0 or x = 6.' },
    { key: 'answer', text: 'States the larger x-coordinate', marks: 1, awarded: true, lines: [19], reason: 'Line 19 gives 6.' }]
  : [{ key: 'answer', text: 'States the larger x-coordinate', marks: 1, awarded: true, lines: [19], reason: 'Line 19 gives 6.' }];
const FIXTURE = (q.get('criteria') === '1' || q.get('criteria') === '3') && which === 'owner19' ? {
  approved: [{ typeId: 'fixture-owner19', digest: 'd'.repeat(64), approvedBy: 'Fixture Author', date: '2026-11-26' }],
  criteria: { typeId: 'fixture-owner19', digest: 'd'.repeat(64), items: O19_ITEMS }
} : q.get('criteria') === '1' && which === 'buoy' ? {
  approved: [{ typeId: 'fixture-buoy', digest: 'c'.repeat(64), approvedBy: 'Fixture Author', date: '2026-11-19' }],
  criteria: { typeId: 'fixture-buoy', digest: 'c'.repeat(64), items: [
    { key: 'max', text: 'States the maximum as 22 + 5', marks: 1, awarded: true, lines: [2], reason: 'Line 2 states it.' },
    { key: 'value', text: 'Gives the value 27', marks: 1, awarded: true, lines: [3], reason: 'Line 3 gives it.' }] }
} : {};

createRoot(document.getElementById('root')).render(
  <div style={{ padding: '16px', maxWidth: 1100, margin: '0 auto' }} data-gallery-case={`${which}/${source}/${edition}`}
    data-gallery-boxes={props.source.kind === 'photo' ? JSON.stringify(props.source.lines.map(l => l.box)) : undefined}>
    <MarkedPage teacherMarks={q.get('teacher') === '1'} input={input} texOf={s => exprToLatex(s) || '\\;'} {...props} {...FIXTURE} {...(q.get('score') === '1' ? { scoreShown: true } : {})} {...(q.get('reading') === '1' ? { reading: { lines: c.lines }, onCorrect: () => {} } : {})} />
  </div>
);
