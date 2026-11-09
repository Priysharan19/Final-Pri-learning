// Pri Learning · previous-year question figures
//
// A past-paper question may carry the diagram printed with it, redrawn as SVG,
// and a worked step may carry a graph, a region or a conic sketch drawn from
// the mathematics. This check holds the contract:
//
//   1. the archive admits only a single inline <svg>, with no script, event
//      handler, external reference or embedded object, on the question or on
//      a step — and refuses everything else at module load;
//   2. the payload carries both kinds of figure to the card and to Pri Explain;
//   3. Pri Explain shows a step's figure on that step's scene, and a
//      storyboard can name a step figure only where the verified solution has
//      one — it cannot bring a picture of its own;
//   4. the client's step sanitiser keeps a clean figure and drops markup it
//      cannot clean, and the server hands the figure back with the steps.
import assert from 'node:assert/strict';

const { validatePyqRecord, pyqPayload } = await import('../src/engine/pyq/pyqSchema.js');
const { JEE_ADVANCED_PYQ_RECORDS } = await import('../src/engine/pyq/records-jee-advanced.js');
const { buildVisualTimeline, compileStoryboard } = await import('../src/explain/visualEngine.js');
const { sanitizeFigure } = await import('../src/lib/sanitize.js');
const { readFileSync } = await import('node:fs');

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass++; };
const throws = (fn, re, msg) => { assert.throws(fn, re, msg); pass++; };

const SVG = '<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg"><path d="M0 50 Q50 0 100 50" fill="none" stroke="currentColor"/><text x="5" y="55">x</text></svg>';
const base = { ...JEE_ADVANCED_PYQ_RECORDS[0], id: 'figure-check-probe' };
const withStep = (figure) => ({ ...base, steps: [{ ...base.steps[0], figure }, ...base.steps.slice(1)] });

// ── 1. What the archive admits ──────────────────────────────────────────────
ok(validatePyqRecord({ ...base, figure: SVG }).figure === SVG, 'a clean inline SVG question figure is admitted');
ok(validatePyqRecord(withStep(SVG)).steps[0].figure === SVG, 'a clean inline SVG step figure is admitted');
const refused = {
  'a script element': SVG.replace('</svg>', '<script>alert(1)</script></svg>'),
  'an event handler': SVG.replace('<path ', '<path onclick="x()" '),
  'an external image': SVG.replace('</svg>', '<image href="https://example.com/a.png"/></svg>'),
  'a javascript: link': SVG.replace('<text ', '<a href="javascript:x()"><text ').replace('</text>', '</text></a>'),
  'a foreignObject': SVG.replace('</svg>', '<foreignObject><div/></foreignObject></svg>'),
  'a raster data URI': '<svg><image href="data:image/png;base64,AAAA"/></svg>',
  'plain HTML': '<div>figure</div>',
  'an empty string': '',
  'a non-string': 42
};
for (const [what, figure] of Object.entries(refused)) {
  throws(() => validatePyqRecord({ ...base, figure }), /figure/, `a question figure with ${what} is refused`);
  throws(() => validatePyqRecord(withStep(figure)), /figure/, `a step figure with ${what} is refused`);
}
throws(() => validatePyqRecord({ ...base, figure: `<svg>${'x'.repeat(60001)}</svg>` }), /longer/, 'an oversized figure is refused');
ok(validatePyqRecord(base).figure === undefined, 'a record without a figure is unchanged');

// ── 2. The payload carries both ────────────────────────────────────────────
const payload = pyqPayload(validatePyqRecord({ ...withStep(SVG), figure: SVG }));
ok(payload.figure === SVG, 'the payload carries the question figure');
ok(payload.steps[0].figure === SVG, 'the payload carries the step figure');
ok(!('figure' in payload.steps[1]), 'a step without a figure stays {h, d}');
ok(!('figure' in pyqPayload(validatePyqRecord(base))), 'a record without a figure has no figure field');

// ── 3. Pri Explain shows the step figure, and only a verified one ──────────
const solution = { steps: [{ h: 'Sketch the region', d: 'Area $= 1$.', figure: SVG }, { h: 'Integrate', d: '$\\int_0^1 x\\,dx = \\tfrac12$' }], answerText: '$\\tfrac12$' };
const timeline = buildVisualTimeline(solution, { questionPrompt: 'Find the area.' });
const figureScenes = timeline.filter(scene => scene.visuals.some(v => v.kind === 'figure'));
ok(figureScenes.length === 1 && figureScenes[0].id === 'solution-0', 'the step figure appears on that step\'s scene and no other');
ok(figureScenes[0].visuals.find(v => v.kind === 'figure').figure === SVG, 'the scene shows the step\'s own figure');
const forged = { version: 3, source: 'ai', scenes: [{ heading: 'Integrate', lines: [], actions: [{ kind: 'show_figure', step: 1 }] }] };
ok(compileStoryboard(forged, solution, {}).ok === false, 'a storyboard naming a step that has no figure is rejected');
const outOfRange = { version: 3, source: 'ai', scenes: [{ heading: 'Integrate', lines: [], actions: [{ kind: 'show_figure', step: 9 }] }] };
ok(compileStoryboard(outOfRange, solution, {}).ok === false, 'a storyboard naming a step that does not exist is rejected');
const honest = { version: 3, source: 'ai', scenes: [{ heading: 'Sketch', lines: [], actions: [{ kind: 'show_figure', step: 0 }] }] };
const compiled = compileStoryboard(honest, solution, {});
ok(compiled.ok && compiled.timeline[0].visuals[0].figure === SVG, 'a storyboard naming a real step figure shows exactly that figure');
const noFigure = buildVisualTimeline({ steps: [{ h: 'Integrate', d: '$x$' }] }, { questionPrompt: 'q' });
ok(noFigure.every(scene => scene.visuals.every(v => v.kind !== 'figure')), 'no figure is invented when no step has one');

// ── 3b. No figure may reach outside itself ─────────────────────────────────
// A paint or style url() that is not #local makes the browser fetch it (a
// tracking/privacy leak). Only url(#id) and href="#id" are allowed — in the
// archive, in the client sanitiser and on the server.
const { figureHasExternalRef } = await import('../src/lib/figureRefs.js');
const LOCAL = '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"/><marker id="m"/><mask id="k"/><filter id="f"/></defs><path d="M0 0L9 9" fill="url(#g)" stroke="url(\'#g\')" marker-end="url(#m)" mask="url(#k)" filter="url(#f)" style="fill:url(#g)"/></svg>';
ok(validatePyqRecord({ ...base, figure: LOCAL }).figure === LOCAL, 'url(#localId) references are admitted');
ok(!figureHasExternalRef(LOCAL), 'local references are not external');
const external = ['https://t.example/p.gif', '//t.example/p', 'p.svg#g', 'http://t.example/a', ' "https://t.example/q" '];
const carriers = {
  fill: u => `<svg><path d="M0 0" fill="url(${u})"/></svg>`,
  stroke: u => `<svg><path d="M0 0" stroke="url(${u})"/></svg>`,
  filter: u => `<svg><path d="M0 0" filter="url(${u})"/></svg>`,
  mask: u => `<svg><path d="M0 0" mask="url(${u})"/></svg>`,
  'marker-start': u => `<svg><path d="M0 0" marker-start="url(${u})"/></svg>`,
  'marker-mid': u => `<svg><path d="M0 0" marker-mid="url(${u})"/></svg>`,
  'marker-end': u => `<svg><path d="M0 0" marker-end="url(${u})"/></svg>`,
  'style fill': u => `<svg><path d="M0 0" style="fill:url(${u})"/></svg>`,
  'style background': u => `<svg style="background:url(${u})"><path d="M0 0"/></svg>`
};
for (const [carrier, make] of Object.entries(carriers)) {
  for (const u of external) {
    const svg = make(u);
    throws(() => validatePyqRecord({ ...base, figure: svg }), /outside itself|external|figure/, `archive refuses ${carrier} url(${u.trim()})`);
    throws(() => validatePyqRecord(withStep(svg)), /outside itself|external|figure/, `archive refuses a step ${carrier} url(${u.trim()})`);
    ok(figureHasExternalRef(svg), `the shared rule flags ${carrier} url(${u.trim()})`);
    ok(!/url\s*\(/i.test(sanitizeFigure(svg)) || !/t\.example|p\.svg/.test(sanitizeFigure(svg)), `the client sanitiser drops ${carrier} url(${u.trim()})`);
  }
}
for (const sneaky of ['<svg><path d="M0 0" fill="u\\72l(https://t.example/x)"/></svg>', '<svg><path d="M0 0" fill="URL( https://t.example/x )"/></svg>', '<svg><a href="https://t.example"><path d="M0 0"/></a></svg>', '<svg><use href="other.svg#a"/></svg>']) {
  ok(figureHasExternalRef(sneaky), `the shared rule flags ${sneaky.slice(0, 60)}`);
  throws(() => validatePyqRecord({ ...base, figure: sneaky }), /figure/, `archive refuses ${sneaky.slice(0, 60)}`);
  ok(!/t\.example|other\.svg/.test(sanitizeFigure(sneaky)), `the client sanitiser drops ${sneaky.slice(0, 60)}`);
}
ok(/stroke="url\(#a\)"/.test(sanitizeFigure('<svg><path d="M0 0" stroke="url(#a)" fill="url(https://t.example/x)"/></svg>')) && !/t\.example/.test(sanitizeFigure('<svg><path d="M0 0" stroke="url(#a)" fill="url(https://t.example/x)"/></svg>')), 'the client sanitiser keeps a local paint and drops an external one on the same element');

// ── 4. Sanitiser and server ────────────────────────────────────────────────
ok(sanitizeFigure(SVG).includes('<path'), 'the figure sanitiser keeps a clean figure');
ok(!/script/i.test(sanitizeFigure(SVG.replace('</svg>', '<script>alert(1)</script></svg>'))), 'the figure sanitiser strips a script');
const backend = readFileSync(new URL('../src/local/backend.js', import.meta.url), 'utf8');
ok(/const safeSteps[\s\S]{0,400}safeFigure\(s\.figure\)/.test(backend), 'the client step sanitiser passes step figures through safeFigure');
const practice = readFileSync(new URL('../../server/platform/practice.js', import.meta.url), 'utf8');
ok(/steps: \(q\.steps \|\| \[\]\)\.map\(step => \(typeof step\?\.figure === 'string'/.test(practice), 'the server returns a step figure with the solution steps');
ok(/!figureHasExternalRef\(step\.figure\)/.test(practice), 'the server drops a step figure that references anything outside itself');

console.log(`PYQ FIGURES: PASS — ${pass}/${pass} checks — inline SVG only (no script, handler, embedded object, or any url()/href except #local — fill, stroke, filter, mask, marker-*, style) on questions and worked steps; payload, Pri Explain and step sanitiser carry them; a storyboard cannot invent one.`);
