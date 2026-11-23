// The marked page (components/MarkedPage.jsx) drawn on its own, with the REAL engine's verdicts on the
// owner's two live cases (2026-11-18) and a SYNTHETIC page: invented strokes for ink, a canvas drawing
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
// SYNTHETIC report for the product-rule page (y = x^2(x - 1)): the shape the engine's value-chain report takes, carrying the optional
// per-line `comment` and, on the wrong line, whatChanged, whyWrong, corrected, fromLine, check and kept. Not an engine verdict.
const PRODUCT_LINES = ['y = x^2(x - 1)', 'u = x^2', 'v = x - 1', "u' = 2x", "v' = 1", "y' = u'v + uv'", "y' = 2x(x - 1) + x^2(1)", "y' = 2x^2 - 2x + x^2", '= 3x^2 - x'];
const PRODUCT_COMMENTS = ['Restates the function from the question.', 'Correct choice: $u = x^2$ is the first factor.', 'Correct choice: $v = x - 1$ is the second factor.', "Correct: $\\frac{d}{dx}x^2 = 2x$, so $u' = 2x$.", "Correct: the derivative of $x - 1$ is $1$.", "Correct statement of the product rule: $y' = u'v + uv'$.", "Correct substitution: $2x(x - 1) + x^2 \\cdot 1$.", 'Correct expansion: $2x(x - 1) = 2x^2 - 2x$.'];
const PRODUCT_REPORT = {
  source: 'value-chain', firstBreak: 8, summary: { total: 9, checked: 8, given: [1], verified: [2, 3, 4, 5, 6, 7, 8], conditions: [], wrong: [9], unverified: [], unread: [], reason: null },
  lines: PRODUCT_LINES.map((text, i) => (i < 8
    ? { text, status: 'ok', state: i === 0 ? 'given' : 'verified', comment: PRODUCT_COMMENTS[i], ...(i === 0 ? { restates: true, note: PRODUCT_COMMENTS[0] } : {}) }
    : { text, status: 'break', state: 'wrong', note: 'The $x^2$ terms were combined wrongly.', diagnosis: { code: 'combine-like-terms', title: 'Like terms combined wrongly', message: 'The $x^2$ terms were combined wrongly.', fix: 'Add the two $x^2$ terms.', confidence: 'high' },
        comment: 'This line does not equal line 8.', whatChanged: 'The $-2x$ became $-x$ when the terms were collected.', whyWrong: 'Collecting $2x^2 + x^2$ gives $3x^2$, but the $-2x$ is untouched, so it stays $-2x$.',
        corrected: '= 3x^2 - 2x', fromLine: 8, check: 'Put $x = 1$ in the question: $y\' = 3 - 2 = 1$, not $3 - 1 = 2$.', kept: 'Your product rule and your substitution were right; only the last collecting step needs fixing.' }))
};
const CASES = {
  product: { meta: null, lines: PRODUCT_LINES, report: PRODUCT_REPORT, receipt: { awarded: 0, possible: 3 } },
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
const c = FIXTURE_PAGE ? { ...CASES.buoy, lines: FIXTURE_PAGE.lines.map(l => l.text) } : (CASES[which] || CASES.buoy);
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

const props = source === 'ink'
  ? { source: { kind: 'ink', strokes: inkPage(c.lines) } }
  : FIXTURE_PAGE ? { source: { kind: 'photo', src: FIXTURE_PAGE.src, lines: FIXTURE_PAGE.lines } }
  : (() => { const p = photoPage(c.lines); return { source: { kind: 'photo', src: p.src, lines: c.lines.map((text, i) => ({ text, box: p.boxes[i] })) } }; })();

// A FIXTURE approval, test only: the real build has no approved type. ?criteria=1 shows the table it would draw.
const FIXTURE = q.get('criteria') === '1' && which === 'buoy' ? {
  approved: [{ typeId: 'fixture-buoy', digest: 'c'.repeat(64), approvedBy: 'Fixture Author', date: '2026-11-19' }],
  criteria: { typeId: 'fixture-buoy', digest: 'c'.repeat(64), items: [
    { key: 'max', text: 'States the maximum as 22 + 5', marks: 1, awarded: true, lines: [2], reason: 'Line 2 states it.' },
    { key: 'value', text: 'Gives the value 27', marks: 1, awarded: true, lines: [3], reason: 'Line 3 gives it.' }] }
} : {};

createRoot(document.getElementById('root')).render(
  <div style={{ padding: '16px', maxWidth: 1100, margin: '0 auto' }} data-gallery-case={`${which}/${source}/${edition}`}
    data-gallery-boxes={props.source.kind === 'photo' ? JSON.stringify(props.source.lines.map(l => l.box)) : undefined}>
    <MarkedPage input={input} texOf={s => exprToLatex(s) || '\\;'} {...props} {...FIXTURE} {...(q.get('score') === '1' ? { scoreShown: true } : {})} {...(q.get('reading') === '1' ? { reading: { lines: c.lines }, onCorrect: () => {} } : {})} />
  </div>
);
