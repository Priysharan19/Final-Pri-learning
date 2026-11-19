// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · graph-sketch question forms (Year 11 and Year 12 Advanced)
//
// A sketch question is answered by stating the features of a graph; the engine
// derives the true features from the function and compares
// (engine/graphFeatures.js). This suite holds the five forms that issue such a
// question (generators/au-forms-sketch-nsw.js) to four things, over 200 seeds
// each:
//
//   1 · RENDERS    the prompt, steps and hints are real text: balanced $, no
//                  undefined / NaN, no em dash.
//   2 · MARKED     the feature set the engine derives from the function, entered
//                  the way the answer form writes it (components/
//                  sketchAnswerModel.js) and marked by the practice path the
//                  server runs (markerOps MARKER_OPS.practice), is fully correct.
//   3 · MISTAKES   every single-feature mistake (an intercept off by one, a
//                  wrong turning-point type, a missing or extra feature, swapped
//                  coordinates) is not fully correct, and the marker says which
//                  feature it was and only that feature.
//   4 · TWO ROUTES an INDEPENDENT computation from the numbers parsed out of the
//                  prompt (quadratic formula, -b/2a, the derivative's roots,
//                  the second derivative) agrees with the engine's derivation.
//   5 · NO LEAK    the public question carries which features are asked for and
//                  nothing about their values.
//
// SYNTHETIC: deterministic code on generated questions. No student, examiner or
// NESA evidence, and no model.
// ─────────────────────────────────────────────────────────────────────────────
const SRC = new URL('../src/', import.meta.url).href;
const { forms } = await import(`${SRC}engine/generators/au-forms-sketch-nsw.js`);
const { makeRng } = await import(`${SRC}engine/qhelpers.js`);
const { generateQuestion, loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const { deriveFeatures } = await import(`${SRC}engine/graphFeatures.js`);
const { PUBLIC_QUESTION_FIELDS } = await import(`${SRC}engine/publicQuestion.js`);
const model = await import(`${SRC}components/sketchAnswerModel.js`);
const { MARKER_OPS, markResponse } = await import('../../server/platform/markerOps.js');
const { safeQuestion, answerTextFor } = await import('../../server/platform/practice.js');
const { nswIssuable } = await import('../../server/platform/nswBanks.js');
await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const SEEDS = 200;

/** The forms, in file order, with a short name each. */
const FORMS = [
  { id: 'quad-factorised', generator: 'y11-quadfunc', index: 0, difficulties: [2] },
  { id: 'quad-vertex', generator: 'y11-quadfunc', index: 1, difficulties: [2] },
  { id: 'quad-scaled', generator: 'y11-quadfunc', index: 2, difficulties: [2] },
  { id: 'cubic-touching', generator: 'y12-appdiff', index: 0, difficulties: [2, 3] },
  { id: 'cubic-expanded', generator: 'y12-appdiff', index: 1, difficulties: [3] }
];
ok(forms['y11-quadfunc'].length === 3 && forms['y12-appdiff'].length === 2, 'the overlay holds three quadratic forms and two cubic forms');

// ── Independent computation from the prompt ─────────────────────────────────
const num = s => Number(String(s).replace(/\s+/g, ''));
const signed = (sign, n) => (sign === '-' ? -num(n) : num(n));
/** Multiply two polynomials (coefficients, lowest power first). */
const mul = (p, q) => { const r = new Array(p.length + q.length - 1).fill(0); p.forEach((a, i) => q.forEach((b, j) => { r[i + j] += a * b; })); return r; };
const scale = (p, k) => p.map(c => c * k);
/** The polynomial a prompt states, lowest power first, read from its TeX. */
function polyOfPrompt(prompt) {
  const tex = (/\$y = ([^$]+)\$/.exec(prompt) || [])[1];
  if (!tex) return null;
  let m;
  // y = a(x + h)^2 + k
  if ((m = /^(-?\d*)\(x ([+-]) (\d+)\)\^2 ([+-]) (\d+)$/.exec(tex))) {
    const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : num(m[1]);
    const h = signed(m[2], m[3]);   // (x + h)
    return { poly: [a * h * h + signed(m[4], m[5]), 2 * a * h, a], shape: 'vertex' };
  }
  // y = s(x + a)^2(x + b)   (a repeated factor)
  if ((m = /^(-?)\(x ([+-]) (\d+)\)\^2\(x ([+-]) (\d+)\)$/.exec(tex))) {
    const s = m[1] === '-' ? -1 : 1;
    return { poly: scale(mul(mul([signed(m[2], m[3]), 1], [signed(m[2], m[3]), 1]), [signed(m[4], m[5]), 1]), s), shape: 'touching' };
  }
  // y = a(x + p)(x + q)
  if ((m = /^(-?\d*)\(x ([+-]) (\d+)\)\(x ([+-]) (\d+)\)$/.exec(tex))) {
    const a = m[1] === '' ? 1 : m[1] === '-' ? -1 : num(m[1]);
    return { poly: scale(mul([signed(m[2], m[3]), 1], [signed(m[4], m[5]), 1]), a), shape: 'factorised' };
  }
  // y = a polynomial written term by term
  const terms = tex.replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
  if (terms) {
    const poly = [0, 0, 0, 0];
    for (const t of terms) {
      const t2 = /^([+-]?)(\d*)(x?)(?:\^(\d))?$/.exec(t);
      if (!t2) return null;
      const c = (t2[1] === '-' ? -1 : 1) * (t2[2] === '' ? 1 : num(t2[2]));
      const pw = t2[3] ? (t2[4] ? Number(t2[4]) : 1) : 0;
      poly[pw] += c;
    }
    return { poly, shape: 'expanded' };
  }
  return null;
}
const evalPoly = (poly, x) => poly.reduceRight((acc, c) => acc * x + c, 0);
const derivative = poly => poly.slice(1).map((c, i) => c * (i + 1));
/** Real roots of a polynomial of degree <= 2 by the quadratic formula, and of a cubic given as a rational-root search. */
function realRoots(poly) {
  const p = [...poly]; while (p.length && p[p.length - 1] === 0) p.pop();
  if (p.length === 3) {
    const [c, b, a] = p, D = b * b - 4 * a * c;
    if (D < 0) return [];
    if (D === 0) return [-b / (2 * a)];
    return [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)].sort((u, v) => u - v);
  }
  if (p.length === 2) return [-p[0] / p[1]];
  // A cubic: integer roots by trial, which is how its form is built (b - a = 3 and a repeated factor).
  const found = [];
  for (let r = -12; r <= 12; r++) if (Math.abs(evalPoly(p, r)) < 1e-9) found.push(r);
  return found;
}
/** Intercepts, y-intercept and turning points of a polynomial of degree 2 or 3, from formulas only. */
function featuresByFormula(poly) {
  const d1 = derivative(poly), d2 = derivative(d1);
  const stationary = realRoots(d1);
  const turning = stationary.map(x => ({ x, y: evalPoly(poly, x), kind: evalPoly(d2, x) < 0 ? 'max' : 'min' })).filter(t => evalPoly(d2, t.x) !== 0);
  return { x: realRoots(poly), y: poly[0], turning };
}

// ── Helpers for the marker path ─────────────────────────────────────────────
const close = (a, b) => Math.abs(a - b) < 1e-6;
const sameList = (a, b) => a.length === b.length && [...a].sort((u, v) => u - v).every((v, i) => close(v, [...b].sort((u, w) => u - w)[i]));
const sameTurning = (a, b) => a.length === b.length && [...a].sort((u, v) => u.x - v.x).every((t, i) => { const w = [...b].sort((u, v) => u.x - v.x)[i]; return close(t.x, w.x) && close(t.y, w.y) && t.kind === w.kind; });
const BROKEN = /\bundefined\b|\bNaN\b|\[object |\bInfinity\b/;
const dollarsBalanced = text => ((String(text).replace(/\\\$/g, '').match(/\$/g) || []).length % 2) === 0;
const numbersIn = text => new Set((String(text).replace(/\\[a-z]+/gi, ' ').replace(/\^\{?\d+\}?/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number));
const FINAL_ONLY = { policy: { methodMarks: false } };
/** What the server's practice marking returns for an answer text. */
const mark = (q, text) => MARKER_OPS.practice({ q, answer: text, working: '', evidenceIfWrong: true, ...FINAL_ONLY }, () => {});

/** The fields a student fills in for a feature set, written as a student would type them. */
function fieldsFor(f, ask) {
  const show = v => String(Math.round(v * 1e6) / 1e6);
  const fields = model.emptyFields();
  if (ask.includes('xIntercepts')) fields.xs = f.intercepts.x.length ? f.intercepts.x.map(show).join(', ') : 'none';
  if (ask.includes('yIntercept')) fields.y = f.intercepts.y === null ? 'none' : show(f.intercepts.y);
  if (ask.includes('turning')) {
    if (f.turning.length) fields.turning = f.turning.map(t => ({ x: show(t.x), y: show(t.y), kind: t.kind }));
    else fields.noTurning = true;
  }
  return fields;
}
const toleranceY = v => 0.1 + 0.05 * Math.abs(v);

let sweepCount = 0, mistakesCount = 0, shapesSeen = new Set();
const drawn = {};
for (const form of FORMS) {
  const list = forms[form.generator][form.index];
  ok(JSON.stringify(list.diffs) === JSON.stringify(form.difficulties), `${form.id}: offered at difficulty ${form.difficulties.join(', ')} only`);
  drawn[form.id] = 0;
  const distinct = new Set();
  for (let i = 1; i <= SEEDS; i++) {
    const seed = (i * 2654435761 + form.index * 977) % 2147483647;
    const diff = form.difficulties[i % form.difficulties.length];
    const q = list.make(makeRng(seed), diff);
    drawn[form.id]++;
    sweepCount++;
    const where = `${form.id} seed ${seed}`;
    distinct.add(q.prompt);

    // 1 · renders
    const texts = [q.prompt, ...q.steps.flatMap(s => [s.h, s.d]), ...q.hints];
    ok(q.answerType === 'graph-sketch' && Array.isArray(q.sketchAsk) && q.sketchAsk.length >= 2, `${where}: a graph-sketch question that names the features asked`);
    ok(texts.every(t => typeof t === 'string' && t.trim() && dollarsBalanced(t)), `${where}: every text has balanced $`);
    ok(texts.every(t => !BROKEN.test(t)), `${where}: no undefined / NaN in any text`);
    ok(texts.every(t => !/—/.test(t)), `${where}: no em dash`);
    ok(texts.every(t => !/[+-] 0\)|\(x [+-] 0\b/.test(t)), `${where}: a zero shift is printed as x, never (x + 0)`);
    ok(q.steps.length >= 3 && q.hints.length === 3, `${where}: three or more worked steps and three hints`);
    const printed = answerTextFor(q);
    ok(typeof printed === 'string' && printed.length > 8 && !BROKEN.test(printed) && !/\d\.\d{7,}/.test(printed), `${where}: the printed answer is a real sentence`);

    // The engine's derivation, and that it is trustworthy for every feature asked
    const spec = q.answer.graph.spec;
    const engine = deriveFeatures(spec);
    ok(!q.sketchAsk.some(k => engine.review.includes(k === 'yIntercept' ? 'yIntercept' : k)), `${where}: the engine derives every asked feature without sending it to review`);
    const key = q.answer.key;
    if (key.intercepts?.x) ok(sameList(engine.intercepts.x, key.intercepts.x), `${where}: engine x-intercepts ${JSON.stringify(engine.intercepts.x)} match the key ${JSON.stringify(key.intercepts.x)}`);
    if (key.intercepts && 'y' in key.intercepts) ok(close(engine.intercepts.y, key.intercepts.y), `${where}: engine y-intercept matches the key`);
    if (key.turning) ok(sameTurning(engine.turning, key.turning), `${where}: engine turning points ${JSON.stringify(engine.turning)} match the key ${JSON.stringify(key.turning)}`);

    // 4 · the second route: numbers from the prompt, formulas only
    const read = polyOfPrompt(q.prompt);
    ok(!!read, `${where}: the prompt's function can be read back (${q.prompt.slice(0, 60)})`);
    if (read) {
      shapesSeen.add(read.shape);
      const byFormula = featuresByFormula(read.poly);
      if (key.intercepts?.x) ok(sameList(byFormula.x, engine.intercepts.x), `${where}: x-intercepts by formula ${JSON.stringify(byFormula.x)} = engine ${JSON.stringify(engine.intercepts.x)}`);
      if (key.intercepts && 'y' in key.intercepts) ok(close(byFormula.y, engine.intercepts.y), `${where}: y-intercept by formula ${byFormula.y} = engine ${engine.intercepts.y}`);
      if (key.turning) ok(sameTurning(byFormula.turning, engine.turning), `${where}: turning points by formula ${JSON.stringify(byFormula.turning)} = engine ${JSON.stringify(engine.turning)}`);
      if (key.turning) ok(sameTurning(byFormula.turning, key.turning), `${where}: turning points by formula agree with the key`);
    }

    // 2 · the true features, entered as a student would, are fully correct through the server's marker
    const fields = fieldsFor(engine, q.sketchAsk);
    const text = model.sketchAnswerText(fields, q.sketchAsk);
    ok(text !== '' && text.length < 8000, `${where}: the answer form writes a feature set`);
    const right = mark(q, text).result;
    ok(right.correct === true, `${where}: the engine's own features, entered as a student would, are marked right`);
    ok(right.sketch && right.sketch.verdicts.length === q.sketchAsk.length && right.sketch.verdicts.every(v => v.verdict === 'ok'), `${where}: every feature verdict is ok`);
    ok(checkAnswer(q, text).correct === true, `${where}: checkAnswer agrees`);
    ok(markResponse(q, text, '', { correct: 2, incorrect: 0, unanswered: 0 }).correct === true, `${where}: the examination path agrees`);
    ok(checkAnswer(q, JSON.stringify(key)).correct === true, `${where}: the authored key is marked right too`);
    // the form reads back what it wrote
    ok(JSON.stringify(model.buildFeatureSet(model.fieldsFromAnswer(text), q.sketchAsk).set) === JSON.stringify(JSON.parse(text)), `${where}: the form restores a draft to the same feature set`);

    // 3 · single-feature mistakes
    const set = JSON.parse(text);
    const clone = () => JSON.parse(text);
    const mistakes = [];
    const wrongOnly = (feature, mutate, why) => { const c = clone(); mutate(c); mistakes.push({ feature, why, text: JSON.stringify(c) }); };
    if (set.intercepts?.x !== undefined) {
      set.intercepts.x.forEach((v, j) => wrongOnly('xIntercepts', c => { c.intercepts.x[j] = v + 1; }, `x-intercept ${j + 1} off by one`));
      if (set.intercepts.x.length) wrongOnly('xIntercepts', c => { c.intercepts.x.pop(); }, 'an x-intercept missing');
      wrongOnly('xIntercepts', c => { c.intercepts.x.push(11); }, 'an x-intercept too many');
    }
    if (typeof set.intercepts?.y === 'number') {
      ok(toleranceY(set.intercepts.y) < 1 && (set.turning || []).every(t => toleranceY(t.y) < 1), `${where}: every y value is small enough that a unit error is outside the marker's band`);
      wrongOnly('yIntercept', c => { c.intercepts.y += 1; }, 'y-intercept off by one');
      if (set.intercepts.y !== 0) wrongOnly('yIntercept', c => { c.intercepts.y = -c.intercepts.y; }, 'y-intercept negated');
    }
    if (set.turning?.length) {
      set.turning.forEach((t, j) => {
        wrongOnly('turning', c => { c.turning[j].kind = t.kind === 'max' ? 'min' : 'max'; }, `turning point ${j + 1} the wrong type`);
        wrongOnly('turning', c => { c.turning[j].x += 1; }, `turning point ${j + 1} x off by one`);
        wrongOnly('turning', c => { c.turning[j].y += 1; }, `turning point ${j + 1} y off by one`);
        if (Math.abs(t.x - t.y) > 0.5) wrongOnly('turning', c => { c.turning[j].x = t.y; c.turning[j].y = t.x; }, `turning point ${j + 1} coordinates swapped`);
      });
      wrongOnly('turning', c => { c.turning.pop(); }, 'a turning point missing');
      wrongOnly('turning', c => { c.turning.push({ x: 9, y: 9, kind: 'min' }); }, 'a turning point too many');
    }
    ok(mistakes.length >= 5, `${where}: at least five distinct mistakes are probed`);
    for (const m of mistakes) {
      mistakesCount++;
      const r = mark(q, m.text).result;
      ok(r.correct === false, `${where}: ${m.why} is not marked fully correct`);
      const verdicts = Object.fromEntries((r.sketch?.verdicts || []).map(v => [v.feature, v.verdict]));
      ok(verdicts[m.feature] && verdicts[m.feature] !== 'ok', `${where}: ${m.why}: the marker names ${m.feature}`);
      ok(Object.entries(verdicts).every(([f, v]) => f === m.feature || v === 'ok'), `${where}: ${m.why}: no other feature is blamed`);
    }
    // not stated at all, and the same feature set unreadable
    ok(mark(q, '').result.correct !== true && mark(q, '{"intercepts": ').result.correct !== true, `${where}: an empty or unreadable answer is not right`);

    // 5 · nothing about the features reaches the public question
    const pub = safeQuestion(null, { ...q, contentId: 'c', contentHash: 'h' });
    const publicKeys = Object.keys(pub);
    const allowed = new Set([...PUBLIC_QUESTION_FIELDS, 'id', 'supportsSteps', 'criteriaCount']);
    ok(publicKeys.every(k => allowed.has(k)), `${where}: the public question holds only public fields (${publicKeys.filter(k => !allowed.has(k)).join(', ')})`);
    const wire = JSON.stringify(pub);
    ok(!/"(?:answer|steps|graph|spec|key|text|scheme|solution|traps)"\s*:/.test(wire), `${where}: no private field name on the wire`);
    ok(!wire.includes(q.answer.text) && !wire.includes(JSON.stringify(key)) && !wire.includes(spec.expression), `${where}: neither the answer sentence, the key nor the marker's expression is on the wire`);
    ok(pub.sketchAsk.every(k => ['xIntercepts', 'yIntercept', 'turning'].includes(k)), `${where}: sketchAsk names features only`);
    const promptNumbers = numbersIn(q.prompt);
    const publicText = [q.prompt, ...(pub.hints || []), pub.inputHint || ''].join(' ');
    const leaked = [...numbersIn(publicText)].filter(n => n !== 0 && !promptNumbers.has(n));
    ok(leaked.length === 0, `${where}: no number in a public text that the prompt does not already state (${leaked.join(', ')})`);
    // a feature value that the prompt does not state is nowhere in the public question's numbers
    const values = [...(key.intercepts?.x || []), ...('y' in (key.intercepts || {}) ? [key.intercepts.y] : []), ...(key.turning || []).flatMap(t => [t.x, t.y])].map(Math.abs);
    const wireNumbers = numbersIn(JSON.stringify({ prompt: pub.prompt, hints: pub.hints, inputHint: pub.inputHint, mcqOptions: pub.mcqOptions, figure: pub.figure, sketchAsk: pub.sketchAsk }));
    ok(values.filter(v => v !== 0 && !promptNumbers.has(v)).every(v => !wireNumbers.has(v)), `${where}: a feature value the prompt does not state is not on the wire`);
  }
  ok(distinct.size >= 12, `${form.id}: at least twelve distinct questions in ${SEEDS} seeds (${distinct.size})`);
}
ok(['vertex', 'touching', 'factorised', 'expanded'].every(s => shapesSeen.has(s)), 'every shape of function was read back from its prompt');

// ── The forms are reachable through the generators the NSW ledger issues ────
const reached = {};
for (const [generator, difficulty] of [['y11-quadfunc', 2], ['y12-appdiff', 2], ['y12-appdiff', 3]]) {
  for (let i = 1; i <= 400; i++) {
    const q = generateQuestion(generator, difficulty, (i * 2654435761 + 12345) % 2147483647);
    if (q.answerType !== 'graph-sketch') continue;
    reached[`${generator}|${difficulty}`] = (reached[`${generator}|${difficulty}`] || 0) + 1;
    if (i % 40 === 0) ok(nswIssuable(q, generator), `${generator} D${difficulty}: a sketch question is issuable and carries its curriculum identity`);
    ok(Array.isArray(q.sketchAsk) && typeof q.contentHash === 'string', `${generator} D${difficulty}: a generated sketch question carries sketchAsk and its content identity`);
  }
}
ok(reached['y11-quadfunc|2'] > 20 && reached['y12-appdiff|2'] > 10 && reached['y12-appdiff|3'] > 20, `the forms are drawn by their generators (${JSON.stringify(reached)})`);
for (const [generator, difficulty] of [['y11-quadfunc', 1], ['y11-quadfunc', 3], ['y11-quadfunc', 4], ['y12-appdiff', 1], ['y12-appdiff', 4]]) {
  let n = 0;
  for (let i = 1; i <= 150; i++) if (generateQuestion(generator, difficulty, (i * 2654435761 + 777) % 2147483647).answerType === 'graph-sketch') n++;
  ok(n === 0, `${generator} D${difficulty}: no sketch question outside the difficulties that assess the dot point`);
}

// ── The answer form's own reading of what a student types ───────────────────
const L = model.parseList;
ok(JSON.stringify(L('1, 5').values) === '[1,5]' && JSON.stringify(L('1 and 5').values) === '[1,5]' && JSON.stringify(L('-2; 3.5').values) === '[-2,3.5]', 'the list reader takes commas, "and" and semicolons');
ok(L('none').status === 'none' && L('').status === 'empty' && L('1, x').status === 'error', 'the list reader tells none, empty and unreadable apart');
ok(model.parseNumber('−2.5') === -2.5 && model.parseNumber('3/2') === 1.5 && model.parseNumber('1/0') === null && model.parseNumber('abc') === null, 'the number reader takes a true minus, a fraction, and refuses what is not a number');
const half = model.buildFeatureSet({ ...model.emptyFields(), xs: '1, five', y: '5' }, ['xIntercepts', 'yIntercept']);
ok(half.errors.xIntercepts === 'list' && half.set.intercepts?.x === undefined && half.set.intercepts?.y === 5, 'an unreadable field is reported and left out; the rest is still stated');
const askedOnly = model.sketchAnswerText({ ...model.emptyFields(), xs: '1', y: '2', turning: [{ x: '1', y: '2', kind: 'min' }] }, ['yIntercept']);
ok(JSON.stringify(JSON.parse(askedOnly)) === '{"intercepts":{"y":2}}', 'only the features the question asks for are written');
ok(model.sketchAnswerText(model.emptyFields(), ['xIntercepts', 'yIntercept', 'turning']) === '', 'nothing is sent while nothing is stated');
ok(JSON.stringify(model.buildFeatureSet({ ...model.emptyFields(), noTurning: true }, ['turning']).set) === '{"turning":[]}', '"no turning points" is stated as an empty list');
ok(model.askedFeatures(['turning', 'bogus', 'xIntercepts']).join() === 'xIntercepts,turning', 'the asked features are read from a closed list, in a fixed order');
const win = model.windowFor([]);
ok(win.xMin < 0 && win.xMax > 0 && win.yMin < 0 && win.yMax > 0, 'the empty preview shows the origin with room around it');
const winPts = model.windowFor([{ x: 4, y: -9 }, { x: -3, y: 2 }]);
ok(winPts.xMin < -3 && winPts.xMax > 4 && winPts.yMin < -9 && winPts.yMax > 2, 'the preview window holds every entered point');

const total = pass + failures.length;
console.log(`${sweepCount} questions over ${FORMS.length} forms x ${SEEDS} seeds; ${mistakesCount} single-feature mistakes probed; drawn ${JSON.stringify(drawn)}`);
if (failures.length) {
  console.log(`GRAPH SKETCH: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`);
  process.exit(1);
}
console.log(`GRAPH SKETCH: PASS — ${pass}/${total} checks — ${FORMS.length} forms x ${SEEDS} seeds, ${mistakesCount} single-feature mistakes refused, engine and formula routes agree, nothing about the features on the wire`);
