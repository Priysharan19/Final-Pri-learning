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
import realPages from './teacher-page-real-reports.json';
import ownerPhotos from './teacher-page-owner-photos.json';

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
// The reports are the engine's REAL output (server/test/support/teacher-page-real-reports.mjs runs checkAnswer and stepEvidence on the transcribed lines and
// saves what comes back; server/test/teacher-page-real-reports-check.mjs fails if the saved file drifts). Nothing in them is typed by hand.
const REAL = realPages.pages;
const OWNER19 = REAL.owner19.lines.map(text => ({ text }));
const OWNER19_COL = i => (i >= 8 && i <= 11 ? 1 : 0);   // lines 9 to 12 are the right-hand column
function owner19Page() {
  const W = 900, H = 1010;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d2a55'; g.font = '30px "Bradley Hand","Segoe Print","Comic Sans MS",cursive'; g.textBaseline = 'middle';
  // the right-hand column starts 44 px after line 8's writing ends, a little lower, so a tick at the end of line 8 has to fit in a narrow gap
  const rightX = Math.round(40 + g.measureText(OWNER19[7].text).width + 6 + 52);
  const lines = OWNER19.map((l, i) => {
    const right = OWNER19_COL(i) === 1;
    const x = right ? rightX : 40;
    // lines 8 and 9 are written side by side: line 8 ends where its writing ends and line 9 starts 44 px further right, a little lower
    const y = i < 8 ? 40 + i * 52 : i === 8 ? 40 + 7 * 52 + 26 : 40 + 7 * 52 + 26 + (i - 8) * 52;
    g.fillText(l.text.replace(/\^2/g, '\u00b2').replace(/\^3/g, '\u00b3'), x, y);
    const w = Math.min((right ? W - rightX - 20 : W - 80), g.measureText(l.text).width + 6);
    return { text: l.text, box: { x: x / W, y: (y - 22) / H, w: w / W, h: 44 / H } };
  });
  return { src: canvas.toDataURL('image/png'), lines };
}
const O19 = which === 'owner19' ? owner19Page() : null;

// ?case=seats and ?case=users: SYNTHETIC wide photographs (4:3, lined paper, handwriting-style face) of the two owner pages of 26 November 2026. The reader's boxes
// cluster in the left 60% of the page, as real readings return; the report is the engine's REAL output for those lines (teacher-page-owner-photos.json,
// regenerated by server/test/support/teacher-page-run.mjs --write, and checked against the engine by server/test/step-explain-check.mjs). No photograph of anyone.
const OWNER_PHOTO = ownerPhotos.pages[which] || null;
function widePhoto(lines) {
  const W = 1600, H = 1200, pitch = Math.min(80, Math.floor((H - 160) / lines.length));
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#efe9d8'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(70,100,150,0.32)'; g.lineWidth = 1.5;
  for (let y = 70; y < H; y += pitch) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = 'rgba(190,70,70,0.4)'; g.beginPath(); g.moveTo(90, 0); g.lineTo(90, H); g.stroke();
  g.fillStyle = '#1d2a55'; g.textBaseline = 'middle';
  // the writing is as large as the line pitch allows, but no line runs past 58% of the page width: the reader's boxes cluster in the left 60%, as real readings return
  let px = Math.round(pitch * 0.5);
  const face = size => `${size}px "Bradley Hand","Segoe Print","Comic Sans MS",cursive`;
  g.font = face(px);
  const longest = Math.max(...lines.map(t => g.measureText(t).width));
  if (longest > 0.58 * W - 120) px = Math.max(14, Math.floor(px * ((0.58 * W - 120) / longest)));
  g.font = face(px);
  const boxes = lines.map((t, i) => {
    const y = 90 + i * pitch; const x = 120;
    g.fillText(t, x, y);
    const w = Math.min(W - x - 10, g.measureText(t).width + 40);
    return { x: x / W, y: (y - pitch * 0.4) / H, w: w / W, h: (pitch * 0.8) / H };
  });
  return { src: canvas.toDataURL('image/png'), lines: lines.map((text, i) => ({ text, box: boxes[i] })) };
}
const WIDE = OWNER_PHOTO ? widePhoto(OWNER_PHOTO.lines) : null;

const c = OWNER_PHOTO ? { meta: null, lines: OWNER_PHOTO.lines, report: OWNER_PHOTO.shownReport, receipt: { awarded: 1, possible: 1 } } : which === 'owner19' ? { meta: null, lines: REAL.owner19.lines, report: REAL.owner19.shownReport || REAL.owner19.stepReport, receipt: q.get('criteria') === '3' ? { awarded: 3, possible: 3 } : { awarded: 1, possible: 1 } }
  : which === 'wrong' ? { meta: null, lines: REAL.wrong.lines, report: REAL.wrong.shownReport || REAL.wrong.stepReport, receipt: { awarded: 0, possible: 1 } } : which === 'followed' ? { meta: null, lines: REAL.followed.lines, report: REAL.followed.shownReport || REAL.followed.stepReport, receipt: { awarded: 0, possible: 1 } } : FIXTURE_PAGE ? { ...CASES.buoy, lines: FIXTURE_PAGE.lines.map(l => l.text) } : (CASES[which] || CASES.buoy);
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

const props = WIDE ? { source: { kind: 'photo', src: WIDE.src, lines: WIDE.lines } } : O19 ? { source: { kind: 'photo', src: O19.src, lines: O19.lines } } : source === 'ink'
  ? { source: { kind: 'ink', strokes: inkPage(c.lines) } }
  : FIXTURE_PAGE ? { source: { kind: 'photo', src: FIXTURE_PAGE.src, lines: FIXTURE_PAGE.lines } }
  : (() => { const p = photoPage(c.lines); return { source: { kind: 'photo', src: p.src, lines: c.lines.map((text, i) => ({ text, box: p.boxes[i] })) } }; })();

// A FIXTURE approval, test only: the real build has no approved type. ?criteria=1 shows the table it would draw.
// test-only approval: the criteria text is fixture text; in production it comes from the server's methodCriteria for an author-approved scheme
const O19_ITEMS = q.get('criteria') === '3'
  ? [{ key: 'derivative', text: 'Differentiates correctly', marks: 1, awarded: true, lines: [3], reason: 'Line 3 is the derivative.' },
    { key: 'stationary', text: 'Finds the stationary values', marks: 1, awarded: true, lines: [7], reason: 'Line 7 gives x = 0 or x = 6.' },
    { key: 'points', text: 'Evaluates the stationary point', marks: 1, awarded: true, lines: [16], reason: 'Line 16 gives -432.' }]
  : [{ key: 'stationary', text: 'Finds the stationary values', marks: 1, awarded: true, lines: [7], reason: 'Line 7 gives x = 0 or x = 6.' }];
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
  <div style={{ padding: '16px', maxWidth: Number(q.get('card')) || 1100, margin: '0 auto' }} data-gallery-case={`${which}/${source}/${edition}`}
    data-gallery-boxes={props.source.kind === 'photo' ? JSON.stringify(props.source.lines.map(l => l.box)) : undefined}>
    <MarkedPage teacherMarks={q.get('teacher') === '1'} input={input} texOf={s => exprToLatex(s) || '\\;'} {...props} {...FIXTURE} {...(q.get('score') === '1' ? { scoreShown: true } : {})} {...(q.get('reading') === '1' ? { reading: { lines: c.lines }, onCorrect: () => {} } : {})} />
  </div>
);
