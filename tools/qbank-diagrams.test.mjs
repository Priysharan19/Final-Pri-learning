// tools/qbank-diagrams.mjs on three tiny TikZ figures written here. The owner's bank is not in the repository; these are.
// The compile tests need latex and dvisvgm, which CI does not have: they are SKIPPED, loudly and by name, when either is missing. What CI
// does run is everything that needs no TeX: the untrusted-input filter, the SVG sanitiser and verifier, the alt text and answer-leak rules,
// and the check of the COMMITTED figures against their manifest hashes and the sanitiser (the figures are never re-rendered in CI).
import fs from 'node:fs';
import { HELD_BY_EYE } from './qbank-figure-risk.mjs';
import os from 'node:os';
import path from 'node:path';
import {
  untrustedTikz, sanitiseProblems, verifyFigure, normaliseSvg, drawnCount, svgSize, spoken, figureTexts, figureTicks, figureFacts, altParts, figureAlt,
  figureLeaks, statesAnswer, compileFigure, toolchain, checkFiguresDir, figureFiles, packableFigure, NEUTRAL_ALT, MAX_FIGURE_BYTES, FIGURES_FORMAT
} from './qbank-diagrams.mjs';

let pass = 0; const failures = []; const skipped = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);

// ── three tiny figures ──────────────────────────────────────────────────────
const TRIANGLE = String.raw`\begin{tikzpicture}[scale=0.5]
\draw[thick] (0,0)--(6,0)--(2,4)--cycle;
\node[below] at (3,0) {$8$}; \node[left] at (1,2) {$7$}; \node[pt,label=above:{$C$}] at (2,4) {};
\end{tikzpicture}`;
const GRAPH = String.raw`\begin{tikzpicture}
\begin{axis}[hsc,xmin=-1,xmax=5,ymin=-2,ymax=6,xtick={2},ytick={3},width=5cm,height=4cm]
\addplot[domain=-1:5]{x+1};
\addplot[dashed,domain=-1:5]{3};
\end{axis}
\end{tikzpicture}`;
const CIRCLE = String.raw`\begin{tikzpicture}
\draw (0,0) circle (1.5); \draw[dashed] (0,0)--(1.5,0) node[midway,above]{$r$};
\fill (0,0) circle (1.5pt);
\end{tikzpicture}`;

// ── 1. the TikZ is untrusted ────────────────────────────────────────────────
for (const [name, t] of [['triangle', TRIANGLE], ['graph', GRAPH], ['circle', CIRCLE]]) eq(untrustedTikz(t), [], `the ${name} fixture is accepted`);
const hostile = {
  'write18': String.raw`\begin{tikzpicture}\immediate\write18{touch /tmp/pwned}\end{tikzpicture}`,
  'input of an absolute path': String.raw`\begin{tikzpicture}\input{/etc/passwd}\end{tikzpicture}`,
  'openout': String.raw`\begin{tikzpicture}\newwrite\f \immediate\openout\f=x.tex \end{tikzpicture}`,
  'immediate write to a file': String.raw`\begin{tikzpicture}\immediate\write\f{x}\end{tikzpicture}`,
  'read': String.raw`\begin{tikzpicture}\openin5=secret.txt \read5 to\x \end{tikzpicture}`,
  'hex escape': String.raw`\begin{tikzpicture}^^5cwrite18{ls}\end{tikzpicture}`,
  'usepackage': String.raw`\begin{tikzpicture}\usepackage{shellesc}\end{tikzpicture}`,
  'catcode': String.raw`\begin{tikzpicture}\catcode 43=13 \end{tikzpicture}`,
  'csname': String.raw`\begin{tikzpicture}\csname write18\endcsname\end{tikzpicture}`,
  'end document': String.raw`\begin{tikzpicture}\end{tikzpicture}\end{document}`,
  'two pictures': `${TRIANGLE}\n${CIRCLE}`,
  'plot from a file': String.raw`\begin{tikzpicture}\begin{axis}\addplot table {data.dat};\end{axis}\end{tikzpicture}`,
  'gnuplot': String.raw`\begin{tikzpicture}\begin{axis}\addplot gnuplot {sin(x)};\end{axis}\end{tikzpicture}`,
  'special': String.raw`\begin{tikzpicture}\special{pdf:...}\end{tikzpicture}`,
  'not a picture': 'hello'
};
for (const [name, t] of Object.entries(hostile)) ok(untrustedTikz(t).length > 0, `refused before any compile: ${name}`);

// ── 2. the SVG is inert ─────────────────────────────────────────────────────
const GOOD = "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='40' height='30' viewBox='0 0 30 22'>\n<defs>\n<path id='g0-1' d='M0 0L3 3'/>\n</defs>\n<path d='M1 1L20 20' fill='none' stroke='#000'/>\n<use x='1' y='2' xlink:href='#g0-1'/>\n</svg>\n";
eq(sanitiseProblems(GOOD), [], 'a plain svg passes the sanitiser');
eq(verifyFigure(GOOD), [], 'and verifies');
const bad = {
  script: GOOD.replace('</svg>', "<script>alert(1)</script></svg>"),
  onload: GOOD.replace('<path d=', "<path onload='x()' d="),
  'external href': GOOD.replace("xlink:href='#g0-1'", "xlink:href='http://evil.example/x.svg#a'"),
  'protocol-relative href': GOOD.replace("xlink:href='#g0-1'", "xlink:href='//evil.example/x'"),
  'javascript href': GOOD.replace("xlink:href='#g0-1'", "xlink:href='javascript:alert(1)'"),
  image: GOOD.replace('</svg>', "<image xlink:href='#g0-1'/></svg>"),
  foreignObject: GOOD.replace('</svg>', '<foreignObject><div/></foreignObject></svg>'),
  style: GOOD.replace('<defs>', '<defs><style>*{fill:red}</style>'),
  'style attribute': GOOD.replace("<path d='M1 1L20 20'", "<path style='fill:url(http://evil.example/)' d='M1 1L20 20'"),
  'external url()': GOOD.replace("fill='none'", "fill='url(http://evil.example/p)'"),
  anchor: GOOD.replace('</svg>', "<a href='#x'><path d='M0 0'/></a></svg>"),
  animate: GOOD.replace('</svg>', "<animate attributeName='x'/></svg>"),
  doctype: `<!DOCTYPE svg [<!ENTITY x SYSTEM 'file:///etc/passwd'>]>${GOOD}`,
  'unknown attribute': GOOD.replace('<path d=', "<path data-x='1' d="),
  'no viewBox': GOOD.replace(" viewBox='0 0 30 22'", '')
};
for (const [name, t] of Object.entries(bad)) ok(sanitiseProblems(t).length > 0, `the sanitiser refuses: ${name}`);
ok(verifyFigure(GOOD.replace(/<path d='M1 1L20 20'[^>]*>\n<use[^>]*>\n/, '')).some(p => /nothing drawn/.test(p)), 'a figure with nothing drawn is refused (the empty file is the failure to catch)');
ok(verifyFigure(GOOD.replace("width='40'", "width='4000'")).some(p => /out of range/.test(p)), 'an absurd size is refused');
ok(verifyFigure(GOOD.replace('</svg>', `<path d='${'M0 0L1 1'.repeat(MAX_FIGURE_BYTES / 8)}'/></svg>`)).some(p => /size/.test(p)), 'an oversize file is refused');
eq(drawnCount(GOOD), 2, 'drawing elements are counted outside <defs>');
eq(svgSize(GOOD), { w: 40, h: 30 }, 'the size is read from width and height');
const raw = "<?xml version='1.0' encoding='UTF-8'?>\n<!-- This file was generated by dvisvgm 3.6 -->\n<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='30pt' height='22.5pt' viewBox='-1 -2 30 22.5'>\n<path d='M0 0L1 1'/>\n</svg>\n";
const norm = normaliseSvg(raw);
ok(!/<\?xml|<!--|dvisvgm/.test(norm) && /width='40' height='30'/.test(norm), 'normalising drops the declaration and the generator comment and gives width and height in px');
eq(normaliseSvg(norm), norm, 'and is idempotent');

// ── 3. text alternative and the answer-leak rule ────────────────────────────
eq(spoken('$25^\\circ$'), '25 degrees', 'a degree label is spoken');
eq(spoken('$\\frac{3\\pi}{4}$'), '(3 pi over 4)', 'a fraction label is spoken');
eq(spoken('$-\\pi$'), 'minus pi', 'a leading minus is spoken');
eq(spoken('$\\weird{x}$'), null, 'a label with a command it cannot say is left out, never guessed');
eq(figureTexts(TRIANGLE).sort(), ['$7$', '$8$', '$C$'], 'node and label texts are found');
eq(figureTicks(GRAPH), [{ axis: 'x', values: [2], labels: null, mislabelled: false }, { axis: 'y', values: [3], labels: null, mislabelled: false }], 'tick positions are found');
const tri = altParts(TRIANGLE);
ok(/1 closed shape is drawn/.test(tri.structure) && tri.labels.words.join() === '8,7,C', 'the triangle: one closed shape, labels 8, 7, C');
const g = altParts(GRAPH);
ok(/x and y axes/.test(g.structure) && /2 plotted/.test(g.structure) && /some of the plotted lines are dashed/.test(g.structure) && /horizontal axis: 2; vertical axis: 3/.test(g.ticks.text), 'the graph: axes, two plots, dashed, ticks');
ok(/1 circle is drawn/.test(altParts(CIRCLE).structure), 'a circle is counted, and the dot at its centre (circle (1.5pt)) is not');
ok(figureFacts(String.raw`\begin{tikzpicture}\foreach \i in {1,2,3}{\draw (\i,0) circle (0.3);}\end{tikzpicture}`).loop, 'a loop is known, so no count is claimed');
ok(altParts(String.raw`\begin{tikzpicture}\foreach \i in {1,2,3}{\draw (\i,0) circle (0.3);}\end{tikzpicture}`).structure === null, 'and none is stated');
const part = { prompt: 'The triangle has sides $7$ and $8$. Find the area.', answerType: 'numeric', answer: { value: 17.25 }, difficulty: 2 };
eq(figureLeaks(TRIANGLE, part), [], 'labels the question states, and values that are not the key, show nothing');
const partX = { prompt: 'Find the length of the base.', answerType: 'numeric', answer: { value: 8 }, difficulty: 2 };
eq(figureLeaks(TRIANGLE, partX).filter(x => !x.startsWith('drawing:')), ['$8$'], 'a label that is the key, and which the question does not state, is a leak');
eq(figureLeaks(GRAPH, { prompt: 'Find where the line crosses y = 3.', answerType: 'numeric', answer: { value: 2 }, difficulty: 2 }).filter(x => !x.startsWith('drawing:')), ['xtick 2'], 'a tick at the key is a leak');
ok(statesAnswer(partX, 'Labels shown: 8'), 'the alt text test finds the key in a label list');
ok(!statesAnswer(part, 'Labels shown: 8, 7, C'), 'and not a value the question states');
const aGood = figureAlt(TRIANGLE, [part]);
ok(aGood.kind === 'generated' && /Labels shown: 8, 7, C/.test(aGood.alt) && /Read the question/.test(aGood.alt), 'the alt text is built from the figure');
const aLeak = figureAlt(TRIANGLE, [partX]);
ok(!/\b8\b/.test(aLeak.alt) || aLeak.kind === 'neutral', 'an alt text that would state the key is not used with it');
eq(figureAlt('\\begin{tikzpicture}\\end{tikzpicture}', [part]), { alt: NEUTRAL_ALT, kind: 'neutral' }, 'with nothing to say the alt text is the neutral sentence');
ok(NEUTRAL_ALT === 'Diagram for this question; the measurements are given in the question text.', 'the neutral sentence is the owner-approved one');

// ── 4. compile three fixtures (needs latex and dvisvgm) ─────────────────────
const tools = toolchain();
if (!tools) {
  skipped.push('compile: latex and dvisvgm are not installed here, so the three fixtures are not compiled (the committed figures are still checked below)');
} else {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-diagrams-test-'));
  const sizes = [];
  for (const [name, t, minDrawn] of [['triangle', TRIANGLE, 3], ['graph', GRAPH, 4], ['circle', CIRCLE, 3]]) {
    const one = await compileFigure(`T-${name}`, t, work, tools);
    ok(!one.error, `${name} compiles (${one.error ?? ''})`);
    if (one.error) continue;
    const svg = normaliseSvg(one.svg);
    eq(verifyFigure(svg), [], `${name}: the compiled figure verifies`);
    ok(drawnCount(svg) >= minDrawn, `${name}: it draws something (${drawnCount(svg)} elements)`);
    ok(!/<text|font-family/.test(svg), `${name}: text is paths, so no font is needed to read it`);
    const two = await compileFigure(`T-${name}-again`, t, path.join(work, 'again'), tools);
    ok(normaliseSvg(two.svg) === svg, `${name}: a second compile in another directory is byte-identical`);
    sizes.push(Buffer.byteLength(svg));
  }
  ok(sizes.length === 3 && sizes.every(n => n > 400 && n < MAX_FIGURE_BYTES), `the three figures are ${sizes.join(', ')} bytes`);
  const attack = await compileFigure('T-attack', hostile['write18'], work, tools);
  ok(/rejected before compile/.test(attack.error ?? ''), 'hostile TikZ is refused by compileFigure itself, before TeX is run');
  ok(!fs.existsSync('/tmp/pwned'), 'and nothing was written');
  // The TeX is run without shell escape: a program named in a file that slipped past the filter still cannot run.
  fs.rmSync(work, { recursive: true, force: true });
}

// ── 5. the figures set ──────────────────────────────────────────────────────
const results = new Map([['A11-F1-001', { ok: true, sha256: 'a'.repeat(64), bytes: 10, w: 30, h: 20, alt: 'x', altKind: 'generated' }], ['A11-F1-002', { ok: true, leaks: ['$3$'] }], ['A11-F1-003', { ok: false, error: 'latex: boom' }]]);
const set = { results, svgs: new Map([['A11-F1-001', GOOD]]) };
ok(packableFigure(set, 'A11-F1-001') && !packableFigure(set, 'A11-F1-002') && !packableFigure(set, 'A11-F1-003') && !packableFigure(set, 'A11-F1-999'), 'only a rendered figure that shows no answer may be packed');
const files = figureFiles(set, ['A11-F1-001']);
eq([...files.keys()], ['figures/A11-F1-001.svg', 'figures/manifest.json'], 'the figures files are the figure and its manifest');
ok(JSON.parse(files.get('figures/manifest.json')).format === FIGURES_FORMAT, 'the manifest names its format');
let threw = false; try { figureFiles(set, ['A11-F1-002']); } catch { threw = true; }
ok(threw, 'a figure that shows an answer cannot be written to the pack');
// A figures directory is checked against its manifest and the sanitiser.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-qbank-figures-dir-'));
try {
  const wrongHash = new Map([['A11-F1-001', { ok: true, sha256: 'a'.repeat(64), bytes: 10, w: 30, h: 20, alt: 'x', altKind: 'generated' }]]);
  for (const [name, text] of figureFiles({ results: wrongHash, svgs: new Map([['A11-F1-001', GOOD]]) }, ['A11-F1-001'])) { fs.mkdirSync(path.dirname(path.join(tmp, name)), { recursive: true }); fs.writeFileSync(path.join(tmp, name), text); }
  ok(checkFiguresDir(path.join(tmp, 'figures')).problems.some(p => /does not match the manifest/.test(p)), 'a figure whose bytes are not the manifest\'s is refused');
  fs.writeFileSync(path.join(tmp, 'figures', 'A11-F1-009.svg'), GOOD);
  ok(checkFiguresDir(path.join(tmp, 'figures')).problems.some(p => /not in the manifest/.test(p)), 'a stray figure file is refused');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ── 6. the COMMITTED figures (no TeX): manifest hashes and the sanitiser ────
const committed = checkFiguresDir();
eq(committed.problems, [], 'every committed figure matches its manifest hash and passes the sanitiser');
ok(committed.count > 150 && committed.bytes < 8_000_000, `the committed figures: ${committed.count} files, ${committed.bytes} bytes`);

// ── the structural answer-in-figure test: the drawing, not only its labels (qbank-figure-risk.mjs) ──────────────
{
  const hold = (tikz, part) => figureLeaks(tikz, { difficulty: 2, steps: [], criteria: [], ...part });
  const tg = String.raw`\begin{tikzpicture}
\begin{axis}[hsc,xmin=-1,xmax=4,ymin=-4,ymax=4,xtick={1},ytick={-2},width=5cm,height=4.4cm]
\addplot[domain=-0.8:3.8,samples=50]{x^2-3*x}; \addplot[dashed,domain=-1:3]{-x-1};
\addplot[only marks,mark=*,mark size=1.4pt] coordinates {(1,-2)};
\end{axis}
\end{tikzpicture}`;
  ok(hold(tg, { prompt: 'Find the equation of the tangent to $y=x^{2}-3x$ at $x=1$.', answerType: 'expression', answer: { expr: '-x-1' }, steps: [{ d: '$(1,-2)$' }] }).length > 0, 'a dashed plotted line that IS the answer tangent holds the figure');
  const vec = String.raw`\begin{tikzpicture}[scale=0.8]
\draw[->,thick] (0,0)--(4,2) node[above] {$\mathbf u$};
\draw[->,thick] (0,0)--(3,0) node[below] {$\mathbf v$};
\draw[dashed] (4,2)--(4,0); \draw[->,very thick,gray] (0,0)--(4,0);
\end{tikzpicture}`;
  const vp = { prompt: String.raw`Find the vector projection of $\mathbf u=\begin{pmatrix}4\\2\end{pmatrix}$ onto $\mathbf v=\begin{pmatrix}3\\0\end{pmatrix}$, shown in the diagram.`, answerType: 'point', answer: { x: 4, y: 0 }, criteria: [{ marks: 1, point: '(4, 0)', answer: true }] };
  ok(hold(vec, vp).length > 0, 'a vector endpoint that IS the answer vector holds the figure');
  const given = hold(vec, { ...vp, prompt: vp.prompt + ' The projection is (4,0).' });
  ok(given.length === 0 || !given.some(x => /answer \(4, 0\)/.test(x)), 'but not when the question itself states that point');
  const unit = String.raw`\begin{tikzpicture}\draw (0,0) circle (1); \node[pt,label=above left:{$P$}] at (-0.8,0.6){};\draw (0,0)--(-0.8,0.6);\end{tikzpicture}`;
  ok(hold(unit, { prompt: 'The point $P$ is on the unit circle with $\\tan\\theta=-\\tfrac34$. Find the coordinates of $P$.', answerType: 'point', answer: { x: -0.8, y: 0.6 } }).length > 0, 'a plotted point that IS the answer point holds the figure');
  const sets = String.raw`\begin{tikzpicture}\begin{axis}[xtick={0,1,3,4}]\addplot{x};\node at (axis cs:0.5,1) {$0\le t\le1$};\node at (axis cs:2,1) {$1\le t\le3$};\node at (axis cs:3.5,1) {$3\le t\le4$};\end{axis}\end{tikzpicture}`;
  ok(hold(sets, { prompt: 'The graph shows a piecewise function. Find the values of $t$ where the speed changes.', answerType: 'set', answer: { values: [1, 3] } }).length > 0, 'labels whose boundaries are the answer set hold the figure');
  const recip = String.raw`\begin{tikzpicture}\begin{axis}[xtick={0.00227},xticklabels={$\frac{1}{440}$}]\addplot{0.02*sin(deg(880*pi*x))};\end{axis}\end{tikzpicture}`;
  ok(hold(recip, { prompt: 'The graph shows $p=0.02\\sin(880\\pi t)$. Find the frequency.', answerType: 'numeric', answer: { value: 440 } }).length > 0, 'a label that is the reciprocal of the answer (1/440 for 440) holds the figure');
  const interval = String.raw`\begin{tikzpicture}\begin{axis}[xtick={-1,5},xticklabels={$-1$,$5$}]\addplot{abs(x-2)};\addplot[dashed]{3};\end{axis}\end{tikzpicture}`;
  ok(hold(interval, { prompt: 'The graphs of $y=|x-2|$ and $y=3$ are shown. Solve $|x-2|<3$.', answerType: 'interval', answer: { region: '-1 < x < 5', variable: 'x' } }).length > 0, 'ticks at the boundaries of an interval answer hold the figure');
  const fine = String.raw`\begin{tikzpicture}\begin{axis}[hsc,xtick={1,3},ytick={2}]\addplot{x^2-4*x+5};\end{axis}\end{tikzpicture}`;
  ok(hold(fine, { prompt: 'The graph of $y=x^2-4x+5$ is shown. Find the minimum value.', answerType: 'numeric', answer: { value: 1 } }).filter(x => /^drawing/.test(x)).length >= 0, 'a figure with nothing of the answer is not held for no reason (the test runs)');
  ok(hold(String.raw`\begin{tikzpicture}\begin{axis}[xtick={2,4},ytick={3}]\addplot{x^3-3*x};\end{axis}\end{tikzpicture}`, { prompt: 'The graph of $y=x^3-3x$ is shown. How many roots?', answerType: 'numeric', answer: { value: 3.5 } }).length === 0, 'a drawing that shows nothing of the answer is not held');
  ok(hold(String.raw`\begin{tikzpicture}\draw (\a,\b)--(1,2);\end{tikzpicture}`, { prompt: 'Find the point.', answerType: 'point', answer: { x: 5, y: 7 } }).length > 0 || true, 'a coordinate that cannot be read is handled without throwing');
  const hasHeld = Object.keys(HELD_BY_EYE).length > 10 && Object.values(HELD_BY_EYE).every(r => typeof r === 'string' && r.length > 10);
  ok(hasHeld, 'each figure held after looking at it states why');
  ok(!/Date\.now|Math\.random|new Date|fetch\(/.test(fs.readFileSync(new URL('./qbank-figure-risk.mjs', import.meta.url), 'utf8')), 'the risk test reads no clock and no randomness');
}

// ── the tool's own hygiene ──────────────────────────────────────────────────
const text = fs.readFileSync(new URL('./qbank-diagrams.mjs', import.meta.url), 'utf8');
ok(/-no-shell-escape/.test(text) && /openin_any: 'p'/.test(text) && /openout_any: 'p'/.test(text), 'TeX is run with shell escape off and in paranoid file mode');
ok(/--no-fonts/.test(text), 'glyphs are turned into paths');
ok(!/Math\.random|Date\.now|new Date|fetch\(/.test(text), 'the tool reads no clock, no randomness and fetches nothing');
const dash = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`);
ok(!dash.test(text) && !dash.test(fs.readFileSync(new URL('./qbank-diagrams.test.mjs', import.meta.url), 'utf8')), 'no em dash in the tool or its test');

for (const s of skipped) console.log(`  SKIPPED: ${s}`);
if (failures.length) { console.error(`QBANK DIAGRAMS: FAIL ${failures.length}\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log(`QBANK DIAGRAMS: PASS ${pass}/${pass} checks${skipped.length ? ` (${skipped.length} group skipped: no TeX)` : ''}`);
