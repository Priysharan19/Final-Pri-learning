// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · Advanced Year 11 (slot adv11-b)
// Extra structural forms for y11-lines, y11-diff and y11-probability. Every key
// is computed in code from the numbers the prompt shows; AI never sets a key.
// Proof-style items ("show that", first-error, first principles, independence,
// collinearity, concurrency) are expressed as machine-keyed final answers.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, Frac, mcq, term, poly, sgn, gcd, r3 } from '../qhelpers.js';

// ── shared builders ──────────────────────────────────────────────────────────
const fact = n => n <= 1 ? 1 : n * fact(n - 1);
const nCr = (n, r) => Math.round(fact(n) / (fact(r) * fact(n - r)));
const nPr = (n, r) => Math.round(fact(n) / fact(n - r));
const fa = f => ({ value: f.value, ...(f.d === 1 ? {} : { simplestFraction: { n: f.n, d: f.d } }) });
const dedupe = (traps, v) => {
  const seen = new Set([v]);
  return traps.filter(t => {
    if (!Number.isFinite(t.value) || Math.abs(t.value - v) < 1e-9) return false;
    const k = Math.round(t.value * 1e6);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const numQ = (prompt, v, o) => ({
  prompt, answerType: 'numeric', answer: { value: v }, inputHint: o.hint,
  traps: dedupe(o.traps || [], v).map(t => ({ ...t, value: t.value })), hints: o.hints, steps: o.steps
});
const fracQ = (prompt, f, o) => ({
  prompt, answerType: 'numeric', answer: fa(f), inputHint: o.hint || (f.d === 1 ? 'e.g. -2' : 'e.g. -3/2'),
  traps: dedupe((o.traps || []).map(t => ({ ...t, value: typeof t.f === 'object' ? t.f.value : t.value })), f.value),
  hints: o.hints, steps: o.steps
});
const mcQ = (rng, prompt, correct, ds, hints, steps) => {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
};
const ptQ = (prompt, x, y, o) => ({
  prompt, answerType: 'point', answer: { x, y }, inputHint: 'e.g. (2, -3)',
  traps: o.traps || [{ why: o.trap }], hints: o.hints, steps: o.steps
});
const coprime = (a, b) => gcd(a, b) === 1;
const mx = M => M.d === 1 ? term(M.n, 'x') : `${M.latex()}x`;     // gradient times x
const gform = (a, b, c) => `${term(a, 'x')} ${b < 0 ? '-' : '+'} ${term(Math.abs(b), 'y')} = ${c}`;
const pg = (y1, g, x1) => `y ${y1 < 0 ? '+' : '-'} ${Math.abs(y1)} = ${g}\\left(x ${x1 < 0 ? '+' : '-'} ${Math.abs(x1)}\\right)`;
const tex = v => String(v);

// ═════════════════════════════════════════════════════════════════════════════
// y11-lines
// ═════════════════════════════════════════════════════════════════════════════
const linesForms = [
  // D1 — gradient of a perpendicular line from two points (multi-step)
  { diffs: [1], make: rng => {
    const x1 = ri(rng, -6, 6), y1 = ri(rng, -6, 6), dx = nz(rng, -5, 5), dy = nz(rng, -6, 6);
    const m = new Frac(dy, dx), perp = new Frac(-dx, dy);
    return fracQ(`Points $A(${x1}, ${y1})$ and $B(${x1 + dx}, ${y1 + dy})$ lie on a line. Find the gradient of a line **perpendicular** to $AB$.`, perp, {
      traps: [{ value: m.value, why: 'That is the gradient of $AB$ itself. A perpendicular line needs the negative reciprocal.' },
        { value: new Frac(dx, dy).value, why: 'The reciprocal is right but the sign is not: $m_1 m_2 = -1$ means the signs must differ.' },
        { value: -m.value, why: 'You negated but did not flip. Perpendicular gradients are negative **reciprocals**.' }],
      hints: ['First find the gradient of $AB$ using rise over run.', `$m_{AB} = \\dfrac{${y1 + dy} - ${y1 < 0 ? `(${y1})` : y1}}{${x1 + dx} - ${x1 < 0 ? `(${x1})` : x1}}$.`, 'Then take the negative reciprocal.'],
      steps: [{ h: 'Gradient of AB', d: `$m_{AB} = \\dfrac{${dy}}{${dx}} = ${m.latex()}$` }, { h: 'Perpendicular gradient', d: `$m_{\\perp} = -\\dfrac{1}{m_{AB}} = ${perp.latex()}$` }]
    });
  } },
  // D1 — missing parameter: perpendicular lines, general form
  { diffs: [1], make: rng => {
    let p, q;
    do { p = nz(rng, -6, 6); q = ri(rng, 2, 6); } while (!coprime(p, q));
    const M = new Frac(p, q), t = nz(rng, -3, 3), b = p * t, k = q * t, c0 = nz(rng, -6, 6), c = nz(rng, -9, 9);
    return numQ(`The lines $y = ${mx(M)} ${sgn(c0)}$ and $kx ${b < 0 ? '-' : '+'} ${term(Math.abs(b), 'y')} = ${c}$ are perpendicular. Find the value of $k$.`, k, {
      hint: 'e.g. -4',
      traps: [{ value: -k, why: 'Check the sign: the second line has gradient $-\\dfrac{k}{' + b + '}$, not $\\dfrac{k}{' + b + '}$.' },
        { value: b, why: 'The coefficient of $y$ is not $k$. Use the gradient condition $m_1 m_2 = -1$ to find $k$.' }],
      hints: ['Write the second line as $y = \\ldots$ to read off its gradient.', `$${term(Math.abs(b), 'y')} = ${-1}\\,kx + \\ldots$ gives gradient $-\\dfrac{k}{${b}}$.`, 'Use $m_1 m_2 = -1$ and solve for $k$.'],
      steps: [{ h: 'Gradients', d: `$m_1 = ${M.latex()}$ and $m_2 = -\\dfrac{k}{${b}}$` }, { h: 'Perpendicular', d: `$${M.latex()} \\times \\left(-\\dfrac{k}{${b}}\\right) = -1$` }, { h: 'Solve', d: `$k = ${k}$` }]
    });
  } },
  // D1 — MCQ: perpendicular gradient with misconception distractors
  { diffs: [1], make: rng => {
    let p, q;
    do { p = nz(rng, -7, 7); q = ri(rng, 2, 7); } while (!coprime(p, q));
    const M = new Frac(p, q), c0 = nz(rng, -6, 6), perp = new Frac(-q, p);
    const opt = (f, why) => ({ text: `$m = ${f.latex()}$`, why, v: f.value });
    const ds = [opt(M, 'That is the gradient of the given line (a parallel line), not a perpendicular one.'),
      opt(new Frac(-p, q), 'Negating alone gives the opposite direction, not the perpendicular. Flip the fraction as well.'),
      opt(new Frac(q, p), 'The reciprocal is right but perpendicular gradients have opposite signs.')].filter(o => Math.abs(o.v - perp.value) > 1e-9);
    return mcQ(rng, `Which could be the gradient of a line **perpendicular** to $y = ${mx(M)} ${sgn(c0)}$?`, `$m = ${perp.latex()}$`, ds,
      ['Perpendicular gradients multiply to $-1$.', 'Take the negative reciprocal of the given gradient.', 'Check: the two gradients should multiply to $-1$.'],
      [{ h: 'Read the gradient', d: `$m_1 = ${M.latex()}$` }, { h: 'Negative reciprocal', d: `$m_2 = -\\dfrac{1}{${M.latex()}} = ${perp.latex()}$` }]);
  } },
  // D1 — representation change: general form
  { diffs: [1], make: rng => {
    const a = nz(rng, -7, 7), b = nz(rng, -7, 7), c = nz(rng, -12, 12);
    const m = new Frac(-a, b), perp = new Frac(b, a);
    return fracQ(`Find the gradient of a line perpendicular to $${gform(a, b, c)}$.`, perp, {
      traps: [{ value: m.value, why: 'That is the gradient of the given line. Perpendicular needs the negative reciprocal.' },
        { value: new Frac(-b, a).value, why: 'Check the sign: the given line has gradient $-\\dfrac{a}{b}$, so its perpendicular is $+\\dfrac{b}{a}$.' },
        { value: new Frac(a, b).value, why: 'You must rearrange to $y = mx + c$: the gradient is $-\\dfrac{a}{b}$, not $\\dfrac{a}{b}$.' }],
      hints: ['Rearrange into $y = mx + c$ to find the gradient.', `$${term(Math.abs(b), 'y')} = ${b < 0 ? '' : '-'}\\ldots$ so $m = -\\dfrac{a}{b}$ with $a = ${a}$, $b = ${b}$.`, 'Then take the negative reciprocal.'],
      steps: [{ h: 'Gradient of the given line', d: `$m = -\\dfrac{${a}}{${b}} = ${m.latex()}$` }, { h: 'Negative reciprocal', d: `$m_{\\perp} = ${perp.latex()}$` }]
    });
  } },
  // D1 — missing parameter: parallel lines (show they are parallel)
  { diffs: [1], make: rng => {
    const a = nz(rng, -6, 6), b = nz(rng, -6, 6), t = rc(rng, [-3, -2, 2, 3]), c1 = nz(rng, -9, 9), c2 = t * c1 + rc(rng, [-4, -3, -2, 2, 3, 4]);
    const k = a * t;
    return numQ(`The lines $${gform(a, b, c1)}$ and $kx ${b * t < 0 ? '-' : '+'} ${term(Math.abs(b * t), 'y')} = ${c2}$ are parallel and distinct. Find the value of $k$.`, k, {
      hint: 'e.g. 6',
      traps: [{ value: a, why: 'Both $x$ and $y$ coefficients must scale by the same factor for the gradients to match.' },
        { value: -k, why: 'Parallel lines have equal gradients, so $-\\dfrac{a}{b}$ and $-\\dfrac{k}{' + b * t + '}$ must match without a sign change.' }],
      hints: ['Parallel lines have equal gradients.', `The first gradient is $-\\dfrac{${a}}{${b}}$; the second is $-\\dfrac{k}{${b * t}}$.`, 'Set them equal and solve for $k$.'],
      steps: [{ h: 'Equal gradients', d: `$-\\dfrac{${a}}{${b}} = -\\dfrac{k}{${b * t}}$` }, { h: 'Solve', d: `$k = ${a} \\times ${t} = ${k}$` }]
    });
  } },
  // D2 — y-intercept of a perpendicular line through a point
  { diffs: [2], make: rng => {
    let p, q;
    do { p = nz(rng, -5, 5); q = ri(rng, 1, 5); } while (!coprime(p, q));
    const M = new Frac(p, q), kk = nz(rng, -3, 3), x1 = p * kk, y1 = ri(rng, -7, 7), perp = new Frac(-q, p);
    const c = new Frac(y1).sub(perp.mul(new Frac(x1)));
    if (c.n === 0 || c.d !== 1) return linesForms[5].make(rng);
    return numQ(`A line has gradient $${M.latex()}$. A second line is perpendicular to it and passes through $(${x1}, ${y1})$. Find the $y$-intercept of the second line.`, c.n, {
      hint: 'e.g. 5',
      traps: [{ value: y1 - M.value * x1, why: 'That uses the original gradient. The second line needs the **perpendicular** gradient.' }, { value: y1, why: 'The $y$-coordinate of the point is not the intercept unless the point lies on the $y$-axis.' }, { value: y1 + perp.value * x1, why: 'Sign slip: $c = y_1 - m x_1$, so subtract $m x_1$.' }],
      hints: ['Find the perpendicular gradient first.', `$m_{\\perp} = ${perp.latex()}$. Substitute $(${x1}, ${y1})$ into $y = m_\\perp x + c$.`, 'Solve for $c$.'],
      steps: [{ h: 'Perpendicular gradient', d: `$m_{\\perp} = ${perp.latex()}$` }, { h: 'Substitute the point', d: `$${y1} = ${perp.latex()}(${x1}) + c$` }, { h: 'Solve', d: `$c = ${c.n}$` }]
    });
  } },
  // D2 — x-intercept from point-gradient form
  { diffs: [2], make: rng => {
    const m = nz(rng, -6, 6) || 2, mm = Math.abs(m) === 1 ? 2 * m : m, x1 = nz(rng, -6, 6), y1 = nz(rng, -7, 7);
    const xi = new Frac(x1).sub(new Frac(y1, mm));
    if (xi.n === 0) return linesForms[6].make(rng);
    return fracQ(`A line has equation $${pg(y1, mm, x1)}$. Find the $x$-coordinate of the point where it crosses the $x$-axis.`, xi, {
      hint: xi.d === 1 ? 'e.g. 3' : 'e.g. 7/2',
      traps: [{ value: x1 + y1 / mm, why: 'Sign slip. Put $y = 0$ and then $x - ' + x1 + ' = \\dfrac{-' + y1 + '}{' + mm + '}$, so subtract $\\dfrac{y_1}{m}$.' }, { value: -y1 / mm, why: 'You solved for the $x$-shift only. Do not forget the $x_1$ in the bracket.' }, { value: y1 + mm * (0 - x1), why: 'That is the $y$-intercept, found by putting $x = 0$.' }],
      hints: ['The line crosses the $x$-axis where $y = 0$.', `Substitute $y = 0$: $${0 - y1} = ${mm}(x ${sgn(-x1)})$.`, 'Divide by the gradient, then add $x_1$.'],
      steps: [{ h: 'Put y = 0', d: `$${-y1} = ${mm}(x ${sgn(-x1)})$` }, { h: 'Divide by the gradient', d: `$x ${sgn(-x1)} = ${new Frac(-y1, mm).latex()}$` }, { h: 'Solve', d: `$x = ${xi.latex()}$` }]
    });
  } },
  // D2 — missing parameter: parallel or perpendicular through two points
  { diffs: [2], make: rng => {
    let p, q;
    do { p = nz(rng, -5, 5); q = ri(rng, 1, 4); } while (!coprime(p, q));
    const M = new Frac(p, q), par = rng() < 0.5, g = par ? M : new Frac(-q, p), t = nz(rng, -3, 3);
    const x1 = ri(rng, -5, 5), y1 = ri(rng, -6, 6), dx = g.d * t, k = y1 + g.n * t, c0 = nz(rng, -6, 6);
    return numQ(`The line through $P(${x1}, ${y1})$ and $Q(${x1 + dx}, k)$ is **${par ? 'parallel' : 'perpendicular'}** to $y = ${mx(M)} ${sgn(c0)}$. Find $k$.`, k, {
      hint: 'e.g. 4',
      traps: [{ value: y1 + (par ? new Frac(-q, p) : M).value * dx, why: `The line must have gradient ${par ? 'equal to' : 'the negative reciprocal of'} the given gradient — you used ${par ? 'the perpendicular one' : 'the same one'}.` }, { value: y1 - g.value * dx, why: 'Sign slip: $k = y_1 + m\\,\\Delta x$.' }],
      hints: [`The line $PQ$ needs gradient ${par ? '$' + M.latex() + '$' : '$' + g.latex() + '$'}.`, `$\\dfrac{k - ${y1 < 0 ? `(${y1})` : y1}}{${dx}} = ${g.latex()}$.`, 'Solve for $k$.'],
      steps: [{ h: 'Required gradient', d: `$m_{PQ} = ${g.latex()}$` }, { h: 'Write the gradient of PQ', d: `$\\dfrac{k ${sgn(-y1)}}{${dx}} = ${g.latex()}$` }, { h: 'Solve', d: `$k = ${k}$` }]
    });
  } },
  // D2 — MCQ: point-gradient form of a perpendicular line
  { diffs: [2], make: rng => {
    const M = nz(rng, -7, 7), mm = Math.abs(M) === 1 ? 2 * M : M, c0 = nz(rng, -6, 6), x1 = nz(rng, -6, 6), y1 = nz(rng, -6, 6), perp = new Frac(-1, mm);
    const ds = [{ text: `$${pg(y1, mm, x1)}$`, why: 'That line has the **same** gradient as the given line, so it is parallel to it.' },
      { text: `$${pg(y1, new Frac(1, mm).latex(), x1)}$`, why: 'The gradient was flipped but its sign was not changed. Perpendicular gradients multiply to $-1$.' },
      { text: `$${pg(-y1, perp.latex(), -x1)}$`, why: 'The perpendicular gradient is right, but the point-gradient form uses $y - y_1 = m(x - x_1)$ — the point has the wrong signs.' }];
    return mcQ(rng, `Which equation gives the line through $(${x1}, ${y1})$ that is **perpendicular** to $y = ${term(mm, 'x')} ${sgn(c0)}$?`, `$${pg(y1, perp.latex(), x1)}$`, ds,
      ['Perpendicular gradient is the negative reciprocal.', 'Use point-gradient form $y - y_1 = m(x - x_1)$.', 'Check the sign of each coordinate in the brackets.'],
      [{ h: 'Perpendicular gradient', d: `$m = -\\dfrac{1}{${mm}} = ${perp.latex()}$` }, { h: 'Point-gradient form', d: `$${pg(y1, perp.latex(), x1)}$` }]);
  } },
  // D2 — context: parallel fence on a site plan
  { diffs: [2], make: rng => {
    const m = nz(rng, -4, 4), c0 = nz(rng, -8, 8), x1 = nz(rng, -6, 6), y1 = ri(rng, -8, 8), c = y1 - m * x1;
    if (c === c0 || c === 0) return linesForms[9].make(rng);
    return numQ(`On a site plan for a Parramatta school (coordinates in metres), an existing fence lies along $y = ${term(m, 'x')} ${sgn(c0)}$. A new fence is to run **parallel** to it through the corner post at $(${x1}, ${y1})$. Find the $y$-intercept of the new fence, in metres.`, c, {
      hint: 'e.g. 7',
      traps: [{ value: c0, why: 'Parallel lines share a gradient but they are different lines, so the intercept changes.' }, { value: y1, why: 'The post is not on the $y$-axis, so its $y$-coordinate is not the intercept.' }, { value: y1 + m * x1, why: 'Sign slip: $c = y_1 - m x_1$.' }],
      hints: ['A parallel line has the same gradient.', `Substitute $(${x1}, ${y1})$ into $y = ${term(m, 'x')} + c$.`, 'Solve for $c$.'],
      steps: [{ h: 'Same gradient', d: `$m = ${m}$` }, { h: 'Substitute the post', d: `$${y1} = ${m}(${x1}) + c$` }, { h: 'Solve', d: `$c = ${c}$` }]
    });
  } },
  // D2 — right angle at B: find k (show that AB ⊥ BC)
  { diffs: [2], make: rng => {
    let ax, ay, dx, dy, t, k, bx, by;
    do { ax = ri(rng, -5, 5); ay = ri(rng, -5, 5); dx = nz(rng, -4, 4); dy = nz(rng, -4, 4); t = nz(rng, -2, 2); bx = ax + dx; by = ay + dy; k = by - dx * t; } while (k === 0);
    const cx = bx + dy * t;
    return numQ(`Points $A(${ax}, ${ay})$, $B(${bx}, ${by})$ and $C(${cx}, k)$ are such that $AB \\perp BC$. Find $k$.`, k, {
      hint: 'e.g. 2',
      traps: [{ value: by + dx * t, why: 'Sign slip: $BC$ must have the negative reciprocal gradient, so $k - ' + by + '$ moves the other way.' }, { value: by + new Frac(dy, dx).value * (cx - bx), why: 'That makes $BC$ parallel to $AB$. For a right angle the gradients must multiply to $-1$.' }],
      hints: [`$m_{AB} = \\dfrac{${dy}}{${dx}}$.`, `So $m_{BC} = ${new Frac(-dx, dy).latex()}$.`, `$\\dfrac{k - ${by < 0 ? `(${by})` : by}}{${dy * t}} = ${new Frac(-dx, dy).latex()}$.`],
      steps: [{ h: 'Gradient of AB', d: `$m_{AB} = ${new Frac(dy, dx).latex()}$` }, { h: 'Gradient of BC', d: `$m_{BC} = ${new Frac(-dx, dy).latex()}$` }, { h: 'Use C', d: `$\\dfrac{k ${sgn(-by)}}{${cx - bx}} = ${new Frac(-dx, dy).latex()} \\Rightarrow k = ${k}$` }]
    });
  } },
  // D3 — y-intercept of a perpendicular bisector
  { diffs: [3], make: rng => {
    let x1, y1, x2, y2, c;
    do {
      x1 = ri(rng, -6, 6); y1 = ri(rng, -6, 6); x2 = x1 + 2 * nz(rng, -4, 4); y2 = y1 + 2 * nz(rng, -4, 4);
      const mid = [(x1 + x2) / 2, (y1 + y2) / 2];
      c = new Frac(mid[1]).sub(new Frac(-(x2 - x1), (y2 - y1)).mul(new Frac(mid[0])));
    } while (c.n === 0);
    const mid = [(x1 + x2) / 2, (y1 + y2) / 2], perp = new Frac(-(x2 - x1), y2 - y1);
    return fracQ(`Find the $y$-intercept of the **perpendicular bisector** of the interval joining $A(${x1}, ${y1})$ and $B(${x2}, ${y2})$.`, c, {
      hint: c.d === 1 ? 'e.g. 5' : 'e.g. 7/3',
      traps: [{ value: mid[1], why: 'That is the $y$-coordinate of the midpoint. The bisector does not cross the $y$-axis there unless $x = 0$.' }, { value: mid[1] + perp.value * mid[0], why: 'Sign slip: $c = y_M - m\\,x_M$, so subtract $m\\,x_M$.' }, { value: new Frac((y2 - y1), (x2 - x1)).value * mid[0] * -1 + mid[1], why: 'You used the gradient of $AB$. The bisector is **perpendicular** to $AB$.' }],
      hints: ['The bisector passes through the midpoint of $AB$ and is perpendicular to it.', `Midpoint: $(${mid[0]}, ${mid[1]})$. Gradient of $AB$: $${new Frac(y2 - y1, x2 - x1).latex()}$.`, 'Find the perpendicular gradient, then solve for $c$ using the midpoint.'],
      steps: [{ h: 'Midpoint', d: `$M = (${mid[0]}, ${mid[1]})$` }, { h: 'Perpendicular gradient', d: `$m = ${perp.latex()}$` }, { h: 'Find c', d: `$${mid[1]} = ${perp.latex()}(${mid[0]}) + c \\Rightarrow c = ${c.latex()}$` }]
    });
  } },
  // D3 — general form: find c
  { diffs: [3], make: rng => {
    let p, q;
    do { p = nz(rng, -7, 7); q = ri(rng, 2, 7); } while (!coprime(p, q));
    const x1 = ri(rng, -6, 6), y1 = ri(rng, -6, 6), M = new Frac(p, q), c = q * y1 - p * x1;
    return numQ(`A line passes through $(${x1}, ${y1})$ with gradient $${M.latex()}$. Written in the form $${term(p, 'x')} - ${q}y + c = 0$, find the value of $c$.`, c, {
      hint: 'e.g. -11',
      traps: [{ value: p * x1 - q * y1, why: 'Sign slip: substitute the point into $px - qy + c = 0$ and make $c$ the subject, so $c = -(px_1 - qy_1)$.' }, { value: q * y1 + p * x1, why: 'Check the signs when expanding $q(y - y_1) = p(x - x_1)$.' }],
      hints: ['Start from $y - y_1 = m(x - x_1)$ and clear the fraction.', `$${q}(y ${sgn(-y1)}) = ${p}(x ${sgn(-x1)})$.`, 'Move everything to one side and read off the constant.'],
      steps: [{ h: 'Point-gradient form', d: `$${q}(y ${sgn(-y1)}) = ${p}(x ${sgn(-x1)})$` }, { h: 'Rearrange to px − qy + c = 0', d: `$${term(p, 'x')} - ${q}y + ${q * y1 - p * x1} = 0$` }, { h: 'Constant', d: `$c = ${c}$` }]
    });
  } },
  // D3 — collinear points (show that): find k
  { diffs: [3], make: rng => {
    let x1, y1, dx, dy, t, k;
    do { x1 = ri(rng, -5, 5); y1 = ri(rng, -5, 5); dx = nz(rng, -4, 4); dy = nz(rng, -5, 5); t = rc(rng, [-2, -1, 2, 3]); k = y1 + dy * t; } while (k === 0);
    return numQ(`The points $A(${x1}, ${y1})$, $B(${x1 + dx}, ${y1 + dy})$ and $C(${x1 + dx * t}, k)$ are collinear. Find $k$.`, k, {
      hint: 'e.g. 8',
      traps: [{ value: y1 + dy, why: 'That is the $y$-coordinate of $B$. $C$ is further along the same line, so its rise is scaled too.' }, { value: y1 - dy * t, why: 'Sign slip: $C$ lies the same way from $A$ as $B$ does, scaled by $' + t + '$.' }],
      hints: ['Collinear points lie on one line, so $m_{AB} = m_{AC}$.', `$m_{AB} = ${new Frac(dy, dx).latex()}$.`, `$\\dfrac{k ${sgn(-y1)}}{${dx * t}} = ${new Frac(dy, dx).latex()}$.`],
      steps: [{ h: 'Gradient of AB', d: `$m_{AB} = ${new Frac(dy, dx).latex()}$` }, { h: 'Set m(AC) equal', d: `$\\dfrac{k ${sgn(-y1)}}{${dx * t}} = ${new Frac(dy, dx).latex()}$` }, { h: 'Solve', d: `$k = ${k}$` }]
    });
  } },
  // D3 — MCQ: first error in a worked solution
  { diffs: [3], make: rng => {
    let p, q, kk, y1, err, G, C, x1;
    for (;;) {
      p = nz(rng, -7, 7); if (Math.abs(p) < 2) continue;
      q = ri(rng, 2, 7); if (!coprime(p, q)) continue;
      kk = nz(rng, -3, 3); y1 = nz(rng, -6, 6); x1 = p * kk;
      err = rc(rng, [2, 3, 4]);
      G = err === 2 ? (rng() < 0.5 ? new Frac(-p, q) : new Frac(q, p)) : new Frac(-q, p);
      C = err === 3 ? new Frac(y1).add(G.mul(new Frac(x1))) : new Frac(y1).sub(G.mul(new Frac(x1)));
      if (C.n !== 0) break;
    }
    const M = new Frac(p, q), c0 = nz(rng, -6, 6), Cs = err === 4 ? new Frac(-C.n, C.d) : C;
    const lines = [
      `$m_1 = ${M.latex()}$`,
      `$m_2 = ${G.latex()}$`,
      `Substituting $(${x1}, ${y1})$ into $y = m_2x + c$ gives $c = ${C.latex()}$`,
      `$y = ${mx(G)} ${Cs.n < 0 ? '-' : '+'} ${new Frac(Math.abs(Cs.n), Cs.d).latex()}$`
    ];
    const ds = [1, 2, 3, 4].filter(i => i !== err).map(i => ({ text: `Line ${i}`, why: `Line ${i} follows correctly from the lines before it.` }));
    return mcQ(rng, `A student finds the equation of the line through $(${x1}, ${y1})$ that is perpendicular to $y = ${mx(M)} ${sgn(c0)}$. Each line of the working follows from the previous lines, so an earlier error carries forward.\n\n**Line 1:** ${lines[0]}\n\n**Line 2:** ${lines[1]}\n\n**Line 3:** ${lines[2]}\n\n**Line 4:** ${lines[3]}\n\nWhich line contains the **first** error?`, `Line ${err}`, ds,
      ['Check each line in order and stop at the first that does not follow.', 'The perpendicular gradient is the negative reciprocal; $c = y_1 - m x_1$; and the equation is $y = mx + c$.', 'Later lines may look wrong only because an earlier error carried forward.'],
      [{ h: 'Correct gradient', d: `$m_2 = ${new Frac(-q, p).latex()}$` }, { h: 'Correct intercept', d: `$c = ${y1} - (${new Frac(-q, p).latex()})(${x1}) = ${y1 + q * kk}$` }, { h: 'First error', d: `Line ${err}` }]);
  } },
  // D3 — altitude gradient (multi-step)
  { diffs: [3], make: rng => {
    const ax = ri(rng, -6, 6), ay = ri(rng, -6, 6), dx = nz(rng, -5, 5), dy = nz(rng, -5, 5);
    const cx = ri(rng, -6, 6), cy = ri(rng, -6, 6), alt = new Frac(-dx, dy);
    return fracQ(`Triangle $ABC$ has vertices $A(${ax}, ${ay})$, $B(${ax + dx}, ${ay + dy})$ and $C(${cx}, ${cy})$. Find the gradient of the **altitude** from $C$ to side $AB$.`, alt, {
      traps: [{ value: new Frac(dy, dx).value, why: 'That is the gradient of $AB$. The altitude is perpendicular to $AB$.' }, { value: new Frac(dx, dy).value, why: 'Flip, but also change the sign: perpendicular gradients multiply to $-1$.' }],
      hints: ['The altitude from $C$ is perpendicular to $AB$.', `$m_{AB} = ${new Frac(dy, dx).latex()}$; the position of $C$ does not change the gradient.`, 'Take the negative reciprocal of $m_{AB}$.'],
      steps: [{ h: 'Gradient of AB', d: `$m_{AB} = ${new Frac(dy, dx).latex()}$` }, { h: 'Altitude is perpendicular to AB', d: `$m = ${alt.latex()}$` }]
    });
  } },
  // D3 — reverse: recover the original gradient
  { diffs: [3], make: rng => {
    let x1, y1, c;
    do { x1 = nz(rng, -6, 6); y1 = ri(rng, -7, 7); c = ri(rng, -7, 7); } while (y1 === c);
    const mp = new Frac(y1 - c, x1), orig = new Frac(-x1, y1 - c);
    return fracQ(`Line $\\ell_2$ passes through $(${x1}, ${y1})$ and has $y$-intercept $${c}$. It is perpendicular to line $\\ell_1$. Find the gradient of $\\ell_1$.`, orig, {
      traps: [{ value: mp.value, why: 'That is the gradient of $\\ell_2$. $\\ell_1$ is perpendicular to it.' }, { value: new Frac(x1, y1 - c).value, why: 'Flip the fraction and change the sign: $m_1 m_2 = -1$.' }],
      hints: ['First find the gradient of $\\ell_2$ from its two known points $(0, ' + c + ')$ and $(' + x1 + ', ' + y1 + ')$.', `$m_2 = \\dfrac{${y1} - ${c < 0 ? `(${c})` : c}}{${x1} - 0}$.`, 'Take the negative reciprocal to get $m_1$.'],
      steps: [{ h: 'Gradient of ℓ₂', d: `$m_2 = ${mp.latex()}$` }, { h: 'Perpendicular', d: `$m_1 = -\\dfrac{1}{m_2} = ${orig.latex()}$` }]
    });
  } },
  // D4 — intersection of two lines in general form
  { diffs: [4], make: rng => {
    let a1, b1, a2, b2, x, y;
    do { a1 = nz(rng, -5, 5); b1 = nz(rng, -5, 5); a2 = nz(rng, -5, 5); b2 = nz(rng, -5, 5); } while (a1 * b2 - a2 * b1 === 0);
    x = ri(rng, -6, 6); y = ri(rng, -6, 6);
    const c1 = a1 * x + b1 * y, c2 = a2 * x + b2 * y;
    return ptQ(`Find the point of intersection of $${gform(a1, b1, c1)}$ and $${gform(a2, b2, c2)}$.`, x, y, {
      trap: 'Eliminate one variable (multiply to match coefficients and add or subtract), solve, then substitute back into **both** equations to check.',
      hints: ['Both equations hold at the intersection, so solve them simultaneously.', 'Multiply to make the $x$ (or $y$) coefficients match, then subtract.', 'Substitute back and check in the other equation.'],
      steps: [{ h: 'Eliminate', d: `Match coefficients of $y$: multiply by ${Math.abs(b2)} and ${Math.abs(b1)} and combine.` }, { h: 'Solve', d: `$x = ${x}$, then $y = ${y}$` }, { h: 'Check', d: `$${a1}(${x}) ${sgn(b1)}(${y}) = ${c1}$ and $${a2}(${x}) ${sgn(b2)}(${y}) = ${c2}$` }]
    });
  } },
  // D4 — missing parameter from a known x-coordinate of intersection
  { diffs: [4], make: rng => {
    let m1, k, X, c1, c2;
    do { m1 = nz(rng, -5, 5); k = nz(rng, -5, 5); X = nz(rng, -5, 5); c1 = nz(rng, -8, 8); c2 = m1 * X + c1 - k * X; } while (k === m1 || c2 === 0);
    return numQ(`The lines $y = ${term(m1, 'x')} ${sgn(c1)}$ and $y = kx ${sgn(c2)}$ intersect at the point where $x = ${X}$. Find $k$.`, k, {
      hint: 'e.g. 3',
      traps: [{ value: m1, why: 'If $k$ equalled $' + m1 + '$ the lines would be parallel (different intercepts) and never meet.' }, { value: (m1 * X + c1 + c2) / X, why: 'Sign slip: subtract $' + c2 + '$ from the $y$-value, not add.' }],
      hints: ['At the intersection both lines give the same $y$.', `Find $y$ from the first line at $x = ${X}$.`, `Then solve $y = k(${X}) ${sgn(c2)}$ for $k$.`],
      steps: [{ h: 'Find y at x = ' + X, d: `$y = ${m1}(${X}) ${sgn(c1)} = ${m1 * X + c1}$` }, { h: 'Substitute into the second line', d: `$${m1 * X + c1} = ${X}k ${sgn(c2)}$` }, { h: 'Solve', d: `$k = ${k}$` }]
    });
  } },
  // D4 — area of the triangle bounded by two lines and the y-axis
  { diffs: [4], make: rng => {
    let m1, m2, X, Y, c1, c2;
    do { m1 = nz(rng, -4, 4); m2 = nz(rng, -4, 4); X = nz(rng, -5, 5); Y = ri(rng, -6, 6); c1 = Y - m1 * X; c2 = Y - m2 * X; } while (m1 === m2 || c1 === 0 || c2 === 0 || c1 === c2);
    const area = Math.abs(c1 - c2) * Math.abs(X) / 2;
    return numQ(`The lines $y = ${term(m1, 'x')} ${sgn(c1)}$ and $y = ${term(m2, 'x')} ${sgn(c2)}$ meet at a point $P$. The two lines and the $y$-axis form a triangle. Find the area of the triangle, in square units.`, area, {
      hint: 'e.g. 7.5',
      traps: [{ value: Math.abs(c1 - c2) * Math.abs(X), why: 'You found base × height but forgot the $\\dfrac{1}{2}$ in the area of a triangle.' }, { value: Math.abs(c1 - c2) / 2, why: 'The height is the horizontal distance from $P$ to the $y$-axis, which is $|x_P|$, so it must be included.' }],
      hints: ['Find where the two lines meet.', `The base lies on the $y$-axis, between the intercepts $${c1}$ and $${c2}$.`, 'The height is the distance from $P$ to the $y$-axis.'],
      steps: [{ h: 'Intersection', d: `$P = (${X}, ${Y})$` }, { h: 'Base on the y-axis', d: `$|${c1} - ${c2 < 0 ? `(${c2})` : c2}| = ${Math.abs(c1 - c2)}$` }, { h: 'Area', d: `$\\dfrac{1}{2} \\times ${Math.abs(c1 - c2)} \\times ${Math.abs(X)} = ${area}$` }]
    });
  } },
  // D4 — context: equal hire costs
  { diffs: [4], make: rng => {
    const rB = ri(rng, 4, 14), rA = rB + ri(rng, 2, 8), h = ri(rng, 2, 12), fA = 5 * ri(rng, 2, 12), fB = fA + (rA - rB) * h;
    return numQ(`A Bondi shop hires surfboards. Shop A charges \\$${fA} plus \\$${rB + (rA - rB)} per hour. Shop B charges \\$${fB} plus \\$${rB} per hour. For how many hours of hire is the total cost the same at both shops?`, h, {
      hint: 'e.g. 4',
      traps: [{ value: (fB - fA) / (rA + rB), why: 'The hourly rates should be **subtracted**: the gap between the two lines closes at $r_A - r_B$ dollars per hour.' }, { value: fA + rA * h, why: 'That is the common **cost** at the break-even point, not the number of hours.' }],
      hints: ['Write each cost as $C = \\text{fee} + \\text{rate} \\times t$.', `Set $${fA} + ${rA}t = ${fB} + ${rB}t$.`, 'Solve for $t$.'],
      steps: [{ h: 'Two cost rules', d: `$C_A = ${fA} + ${rA}t$ and $C_B = ${fB} + ${rB}t$` }, { h: 'Equate', d: `$${rA - rB}t = ${fB - fA}$` }, { h: 'Solve', d: `$t = ${h}$ hours` }]
    });
  } },
  // D4 — MCQ: intersection point with misconception distractors
  { diffs: [4], make: rng => {
    let m1, m2, X, Y, c1, c2;
    do { m1 = nz(rng, -4, 4); m2 = nz(rng, -4, 4); X = nz(rng, -5, 5); Y = nz(rng, -6, 6); c1 = Y - m1 * X; c2 = Y - m2 * X; } while (m1 === m2 || X === Y || c1 === 0 || c2 === 0 || c1 === Y);
    const ds = [{ text: `$(${Y}, ${X})$`, why: 'The coordinates are the wrong way round: a point is written $(x, y)$.' }, { text: `$(0, ${c1})$`, why: 'That is where the first line meets the $y$-axis, not where the two lines meet each other.' }, { text: `$(${-X}, ${-Y})$`, why: 'Check the signs: substitute the point into **both** equations; it must satisfy each.' }];
    return mcQ(rng, `Which point lies on both $y = ${term(m1, 'x')} ${sgn(c1)}$ and $y = ${term(m2, 'x')} ${sgn(c2)}$?`, `$(${X}, ${Y})$`, ds,
      ['A common point satisfies both equations.', 'Equate the two right-hand sides to find $x$.', 'Substitute back to find $y$, and check in the other line.'],
      [{ h: 'Equate', d: `$${term(m1, 'x')} ${sgn(c1)} = ${term(m2, 'x')} ${sgn(c2)}$` }, { h: 'Solve for x then y', d: `$x = ${X}$, $y = ${Y}$` }]);
  } },
  // D4 — three concurrent lines (show that): find k
  { diffs: [4], make: rng => {
    let m1, m2, X, Y, c1, c2, a, b, k;
    do { m1 = nz(rng, -4, 4); m2 = nz(rng, -4, 4); X = nz(rng, -5, 5); Y = ri(rng, -6, 6); c1 = Y - m1 * X; c2 = Y - m2 * X; a = nz(rng, -5, 5); b = nz(rng, 2, 6); k = a * X + b * Y; } while (m1 === m2 || c1 === 0 || c2 === 0 || k === 0);
    return numQ(`The lines $y = ${term(m1, 'x')} ${sgn(c1)}$ and $y = ${term(m2, 'x')} ${sgn(c2)}$ meet at a point $P$. The line $${term(a, 'x')} + ${term(b, 'y')} = k$ also passes through $P$, so the three lines are concurrent. Find $k$.`, k, {
      hint: 'e.g. 11',
      traps: [{ value: a + b, why: 'Substitute the **coordinates** of $P$ for $x$ and $y$, not $1$.' }, { value: a * Y + b * X, why: 'The coordinates were swapped: $P = (x, y)$.' }],
      hints: ['Find $P$ by solving the first two equations.', `$${term(m1, 'x')} ${sgn(c1)} = ${term(m2, 'x')} ${sgn(c2)}$.`, 'Substitute $P$ into the third line to get $k$.'],
      steps: [{ h: 'Find P', d: `$P = (${X}, ${Y})$` }, { h: 'Substitute into the third line', d: `$k = ${a}(${X}) + ${b}(${Y})$` }, { h: 'Evaluate', d: `$k = ${k}$` }]
    });
  } },
  // D4 — no point of intersection (parallel lines)
  { diffs: [4], make: rng => {
    const a = nz(rng, -6, 6), b = nz(rng, -6, 6), t = rc(rng, [-3, -2, 2, 3]), c1 = nz(rng, -8, 8), c2 = t * c1 + rc(rng, [-5, -3, 3, 5]);
    const k = a * t;
    return numQ(`The simultaneous equations $${gform(a, b, c1)}$ and $kx ${b * t < 0 ? '-' : '+'} ${term(Math.abs(b * t), 'y')} = ${c2}$ have **no solution**. Find $k$.`, k, {
      hint: 'e.g. -8',
      traps: [{ value: a, why: 'The coefficients of $y$ differ by a factor of ' + t + ', so the coefficient of $x$ must scale by the same factor.' }, { value: -k, why: 'No solution means parallel lines: equal gradients, so no sign change.' }],
      hints: ['No intersection means the lines are parallel (and distinct).', `Their gradients are $-\\dfrac{${a}}{${b}}$ and $-\\dfrac{k}{${b * t}}$.`, 'Set them equal and solve.'],
      steps: [{ h: 'Parallel lines', d: `$-\\dfrac{${a}}{${b}} = -\\dfrac{k}{${b * t}}$` }, { h: 'Solve', d: `$k = ${a} \\times ${t} = ${k}$` }, { h: 'Check distinct', d: `$${c2} \\ne ${t} \\times ${c1}$, so the lines do not coincide.` }]
    });
  } }
];

// ═════════════════════════════════════════════════════════════════════════════
// y11-diff
// ═════════════════════════════════════════════════════════════════════════════
const sp = (c, e) => term(c, 'x', e);
const diffForms = [
  // D1 — evaluate the derivative of a power at a point
  { diffs: [1], make: rng => {
    const a = nz(rng, -7, 7), n = ri(rng, 2, 7), k = nz(rng, -3, 3), v = a * n * Math.pow(k, n - 1);
    return numQ(`Given $y = ${sp(a, n)}$, find the value of $\\dfrac{dy}{dx}$ when $x = ${k}$.`, v, {
      hint: 'e.g. 24',
      traps: [{ value: a * Math.pow(k, n), why: 'That is $y$ at $x = ' + k + '$. Differentiate before substituting.' }, { value: a * n * Math.pow(k, n), why: 'The power must be reduced by 1 before substituting: $x^{' + (n - 1) + '}$.' }, { value: a * Math.pow(k, n - 1), why: 'Multiply by the old power $' + n + '$ as well as reducing it.' }],
      hints: ['Differentiate first using $\\dfrac{d}{dx}(x^n) = nx^{n-1}$.', `$\\dfrac{dy}{dx} = ${sp(a * n, n - 1)}$.`, `Now substitute $x = ${k}$.`],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${sp(a * n, n - 1)}$` }, { h: 'Substitute', d: `$${a * n} \\times (${k})^{${n - 1}} = ${v}$` }]
    });
  } },
  // D1 — missing coefficient from the derivative
  { diffs: [1], make: rng => {
    const k = nz(rng, -7, 7), m = ri(rng, 1, 7), B = k * (m + 1);
    return numQ(`A curve $y = kx^{${m + 1}}$ has derivative $\\dfrac{dy}{dx} = ${sp(B, m)}$. Find the value of $k$.`, k, {
      hint: 'e.g. 3',
      traps: [{ value: B, why: 'The derivative multiplies $k$ by the old power $' + (m + 1) + '$, so $k$ is $B$ divided by it.' }, { value: B / m, why: 'The old power was $' + (m + 1) + '$ (one more than the new power $' + m + '$).' }],
      hints: ['Differentiate $kx^{' + (m + 1) + '}$ in terms of $k$.', `$\\dfrac{dy}{dx} = ${m + 1}kx^{${m}}$.`, `Equate the coefficients: $${m + 1}k = ${B}$.`],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${m + 1}k\\,x^{${m}}$` }, { h: 'Equate coefficients', d: `$${m + 1}k = ${B}$` }, { h: 'Solve', d: `$k = ${k}$` }]
    });
  } },
  // D1 — reciprocal powers (negative indices) at a point
  { diffs: [1], make: rng => {
    const a = nz(rng, -8, 8), n = ri(rng, 1, 3), k = nz(rng, -3, 3), f = new Frac(-a * n, Math.pow(k, n + 1));
    const den = n === 1 ? 'x' : `x^{${n}}`;
    return fracQ(`Find $\\dfrac{dy}{dx}$ when $x = ${k}$ for $y = \\dfrac{${a}}{${den}}$.`, f, {
      hint: f.d === 1 ? 'e.g. -3' : 'e.g. -3/4',
      traps: [{ value: new Frac(a * n, Math.pow(k, n + 1)).value, why: 'Check the sign. Bringing down $-' + n + '$ makes the coefficient $-' + a * n + '$.' }, { value: new Frac(-a * n, Math.pow(k, n - 1)).value, why: 'The power goes **down** by 1 from $-' + n + '$ to $-' + (n + 1) + '$, so the denominator power is $' + (n + 1) + '$.' }],
      hints: [`Rewrite as $y = ${a}x^{-${n}}$.`, `$\\dfrac{dy}{dx} = ${-a * n}x^{-${n + 1}}$.`, `Substitute $x = ${k}$: $\\dfrac{${-a * n}}{(${k})^{${n + 1}}}$.`],
      steps: [{ h: 'Index form', d: `$y = ${a}x^{-${n}}$` }, { h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${-a * n}x^{-${n + 1}}$` }, { h: 'Substitute', d: `$\\dfrac{${-a * n}}{(${k})^{${n + 1}}} = ${f.latex()}$` }]
    });
  } },
  // D1 — square roots (fractional indices)
  { diffs: [1], make: rng => {
    const a = rc(rng, [-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]), k = ri(rng, 2, 6), f = new Frac(a, 2 * k);
    return fracQ(`Given $f(x) = ${a}\\sqrt{x}$, find $f'(${k * k})$.`, f, {
      hint: f.d === 1 ? 'e.g. 2' : 'e.g. 3/8',
      traps: [{ value: new Frac(a, 2 * k * k).value, why: 'Evaluate $\\sqrt{x}$ at ' + k * k + ' as $' + k + '$, not as $' + k * k + '$.' }, { value: new Frac(a, k).value, why: 'The power $\\tfrac{1}{2}$ comes down in front, so the derivative has a factor $\\tfrac{1}{2}$.' }],
      hints: [`Rewrite $\\sqrt{x}$ as $x^{\\frac{1}{2}}$.`, `$f'(x) = ${a} \\times \\dfrac{1}{2}x^{-\\frac{1}{2}} = \\dfrac{${a}}{2\\sqrt{x}}$.`, `Substitute $x = ${k * k}$, so $\\sqrt{x} = ${k}$.`],
      steps: [{ h: 'Index form', d: `$f(x) = ${a}x^{\\frac{1}{2}}$` }, { h: 'Differentiate', d: `$f'(x) = \\dfrac{${a}}{2\\sqrt{x}}$` }, { h: 'Substitute', d: `$f'(${k * k}) = \\dfrac{${a}}{${2 * k}} = ${f.latex()}$` }]
    });
  } },
  // D1 — MCQ: power rule misconceptions
  { diffs: [1], make: rng => {
    const a = nz(rng, -8, 8), n = ri(rng, 3, 8);
    const ds = [{ text: `$${sp(a, n - 1)}$`, why: 'The power is reduced but the old power $' + n + '$ was not multiplied in front.' }, { text: `$${sp(a * n, n)}$`, why: 'The coefficient was multiplied by $' + n + '$ but the power was not reduced by 1.' }, { text: `$${sp(a * (n - 1), n - 1)}$`, why: 'The coefficient is multiplied by the **old** power $' + n + '$, not by the new power.' }];
    return mcQ(rng, `Which expression is $\\dfrac{dy}{dx}$ for $y = ${sp(a, n)}$?`, `$${sp(a * n, n - 1)}$`, ds,
      ['Bring the power down to multiply the coefficient.', 'Then reduce the power by 1.', `$\\dfrac{d}{dx}(x^n) = nx^{n-1}$.`],
      [{ h: 'Multiply by the power', d: `$${a} \\times ${n} = ${a * n}$` }, { h: 'Reduce the power', d: `$x^{${n}} \\to x^{${n - 1}}$` }]);
  } },
  // D1 — context: rates of change of geometric measures
  { diffs: [1], make: rng => {
    const c = rc(rng, [
      { d: 'the volume $V$ of a cube of side length $x$ centimetres', f: 'V = x^3', der: k => 3 * k * k, u: 'cm³ per cm' },
      { d: 'the surface area $S$ of a cube of side length $x$ centimetres', f: 'S = 6x^2', der: k => 12 * k, u: 'cm² per cm' },
      { d: 'the area $A$ of a square of side length $x$ metres', f: 'A = x^2', der: k => 2 * k, u: 'm² per m' }]);
    const k = ri(rng, 2, 9), v = c.der(k);
    return numQ(`Consider ${c.d}, where $${c.f}$. Find the rate of change of this quantity with respect to $x$ when $x = ${k}$, in ${c.u}.`, v, {
      hint: 'e.g. 27',
      traps: [{ value: c.f === 'V = x^3' ? k * k * k : c.f === 'S = 6x^2' ? 6 * k * k : k * k, why: 'That is the quantity itself at $x = ' + k + '$. The **rate of change** is its derivative.' }],
      hints: ['The rate of change with respect to $x$ is the derivative.', `Differentiate $${c.f}$.`, `Substitute $x = ${k}$.`],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{d}{dx}\\left(${c.f.split('=')[1].trim()}\\right) = ${c.f === 'V = x^3' ? '3x^2' : c.f === 'S = 6x^2' ? '12x' : '2x'}$` }, { h: 'Substitute', d: `$${v}$ ${c.u}` }]
    });
  } },
  // D2 — evaluate f'(k) for a cubic
  { diffs: [2], make: rng => {
    const a = nz(rng, -3, 3), b = nz(rng, -6, 6), c = nz(rng, -8, 8), d = nz(rng, -9, 9), k = nz(rng, -3, 3), v = 3 * a * k * k + 2 * b * k + c;
    return numQ(`Given $f(x) = ${poly([a, b, c, d])}$, find $f'(${k})$.`, v, {
      hint: 'e.g. -7',
      traps: [{ value: a * k ** 3 + b * k * k + c * k + d, why: 'That is $f(' + k + ')$. Differentiate first, then substitute.' }, { value: v + d, why: 'The constant term $' + d + '$ differentiates to $0$.' }],
      hints: ['Differentiate term by term.', `$f'(x) = ${poly([3 * a, 2 * b, c])}$.`, `Substitute $x = ${k}$.`],
      steps: [{ h: 'Differentiate', d: `$f'(x) = ${poly([3 * a, 2 * b, c])}$` }, { h: 'Substitute', d: `$f'(${k}) = ${v}$` }]
    });
  } },
  // D2 — missing coefficient from f'(t)
  { diffs: [2], make: rng => {
    const k = nz(rng, -4, 4), b = nz(rng, -6, 6), c = nz(rng, -8, 8), t = nz(rng, -3, 3), V = 3 * k * t * t + 2 * b * t + c;
    return numQ(`The function $f(x) = kx^3 ${b < 0 ? '-' : '+'} ${term(Math.abs(b), 'x', 2)} ${c < 0 ? '-' : '+'} ${term(Math.abs(c), 'x')}$ satisfies $f'(${t}) = ${V}$. Find $k$.`, k, {
      hint: 'e.g. 2',
      traps: [{ value: (V - c) / (3 * t * t), why: 'The $' + b + 'x^2$ term also contributes: $2(' + b + ')x$.' }, { value: (V + 2 * b * t + c) / (3 * t * t), why: 'Sign slip when isolating $k$.' }],
      hints: ['Differentiate in terms of $k$.', `$f'(x) = 3kx^2 ${sgn(2 * b)}x ${sgn(c)}$.`, `Substitute $x = ${t}$ and set equal to $${V}$.`],
      steps: [{ h: 'Differentiate', d: `$f'(x) = 3kx^2 ${sgn(2 * b)}x ${sgn(c)}$` }, { h: 'Substitute and equate', d: `$${3 * t * t}k ${sgn(2 * b * t + c)} = ${V}$` }, { h: 'Solve', d: `$k = ${k}$` }]
    });
  } },
  // D2 — context: rate of rising depth
  { diffs: [2], make: rng => {
    const a = ri(rng, 1, 3), b = ri(rng, 1, 5), c = ri(rng, 1, 8), t = ri(rng, 1, 4), v = 3 * a * t * t + 2 * b * t + c;
    return numQ(`After heavy rain, the depth $d$ metres of water in a Hunter Valley dam is modelled by $d = ${poly([a, b, c, 0])}$, where $t$ is the time in hours since the rain began. Find how fast the depth is rising when $t = ${t}$, in m/h.`, v, {
      hint: 'e.g. 14',
      traps: [{ value: a * t ** 3 + b * t * t + c * t, why: 'That is the **depth** at $t = ' + t + '$, not the rate at which it is changing.' }, { value: 3 * a * t * t + 2 * b * t, why: 'The term $' + c + 't$ differentiates to $' + c + '$, which must be included.' }],
      hints: ['The rate of change of depth is $\\dfrac{dd}{dt}$.', `$\\dfrac{dd}{dt} = ${poly([3 * a, 2 * b, c])}$.`, `Substitute $t = ${t}$.`],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dd}{dt} = ${poly([3 * a, 2 * b, c])}$` }, { h: 'Substitute', d: `$${v}$ m/h` }]
    });
  } },
  // D2 — expand then differentiate a product of brackets
  { diffs: [2], make: rng => {
    const p = nz(rng, -3, 3), q = nz(rng, -3, 3), a = nz(rng, -6, 6), b = nz(rng, -6, 6), k = nz(rng, -4, 4), v = 2 * p * q * k + p * b + q * a;
    return numQ(`Given $f(x) = (${term(p, 'x')} ${sgn(a)})(${term(q, 'x')} ${sgn(b)})$, expand and differentiate to find $f'(${k})$.`, v, {
      hint: 'e.g. 5',
      traps: [{ value: p * q, why: 'Differentiating each bracket and multiplying does not work: expand first, then differentiate.' }, { value: (p * k + a) * (q * k + b), why: 'That is $f(' + k + ')$, not $f\'(' + k + ')$.' }],
      hints: ['Expand the brackets to get a quadratic.', `$f(x) = ${poly([p * q, p * b + q * a, a * b])}$.`, `$f'(x) = ${poly([2 * p * q, p * b + q * a])}$; substitute $x = ${k}$.`],
      steps: [{ h: 'Expand', d: `$f(x) = ${poly([p * q, p * b + q * a, a * b])}$` }, { h: 'Differentiate', d: `$f'(x) = ${poly([2 * p * q, p * b + q * a])}$` }, { h: 'Substitute', d: `$f'(${k}) = ${v}$` }]
    });
  } },
  // D2 — MCQ: polynomial derivative misconceptions
  { diffs: [2], make: rng => {
    const a = nz(rng, -4, 4), b = nz(rng, -6, 6), c = nz(rng, -8, 8), d = nz(rng, -9, 9);
    const ds = [{ text: `$${poly([3 * a, 2 * b, c, d])}$`, why: 'The constant $' + d + '$ differentiates to $0$; it does not stay.' }, { text: `$${poly([3 * a, 2 * b, c, 0])}$`, why: 'Each power must be reduced by 1 as well as multiplied down.' }, { text: `$${poly([a, b, c])}$`, why: 'You reduced each power but did not multiply by the old power.' }];
    return mcQ(rng, `Which is the derivative of $f(x) = ${poly([a, b, c, d])}$?`, `$${poly([3 * a, 2 * b, c])}$`, ds,
      ['Differentiate each term separately.', 'The derivative of a constant is $0$.', '$\\dfrac{d}{dx}(x) = 1$.'],
      [{ h: 'Term by term', d: `$${a}x^3 \\to ${3 * a}x^2,\\; ${b}x^2 \\to ${2 * b}x,\\; ${c}x \\to ${c},\\; ${d} \\to 0$` }]);
  } },
  // D2 — simplify a quotient first
  { diffs: [2], make: rng => {
    const a = nz(rng, -4, 4), b = nz(rng, -7, 7), c = nz(rng, -8, 8), k = nz(rng, -4, 4), v = 2 * a * k + b;
    return numQ(`For $x \\ne 0$, let $f(x) = \\dfrac{${poly([a, b, c, 0])}}{x}$. Simplify $f(x)$, then find $f'(${k})$.`, v, {
      hint: 'e.g. 6',
      traps: [{ value: 3 * a * k * k + 2 * b * k + c, why: 'The numerator was differentiated without dividing by $x$ first. Simplify, then differentiate.' }, { value: 2 * a * k + b + c, why: 'After dividing by $x$ the term $' + c + '$ is a constant and differentiates to $0$.' }],
      hints: ['Divide every term in the numerator by $x$.', `$f(x) = ${poly([a, b, c])}$.`, `$f'(x) = ${poly([2 * a, b])}$.`],
      steps: [{ h: 'Simplify', d: `$f(x) = ${poly([a, b, c])}$` }, { h: 'Differentiate', d: `$f'(x) = ${poly([2 * a, b])}$` }, { h: 'Substitute', d: `$f'(${k}) = ${v}$` }]
    });
  } },
  // D3 — gradient of the normal
  { diffs: [3], make: rng => {
    let a, b, c, x0, m;
    do { a = nz(rng, -3, 3); b = nz(rng, -6, 6); c = nz(rng, -8, 8); x0 = nz(rng, -3, 3); m = 2 * a * x0 + b; } while (m === 0);
    const f = new Frac(-1, m);
    return fracQ(`Find the gradient of the **normal** to the curve $y = ${poly([a, b, c])}$ at the point where $x = ${x0}$.`, f, {
      traps: [{ value: m, why: 'That is the gradient of the tangent. The normal is **perpendicular** to the tangent.' }, { value: 1 / m, why: 'The reciprocal is right but perpendicular gradients have opposite signs.' }, { value: -m, why: 'You negated but did not take the reciprocal.' }],
      hints: ['First find the gradient of the tangent using the derivative.', `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$, so at $x = ${x0}$ the tangent gradient is $${m}$.`, 'The normal has the negative reciprocal gradient.'],
      steps: [{ h: 'Tangent gradient', d: `$\\dfrac{dy}{dx}\\bigg|_{x=${x0}} = ${m}$` }, { h: 'Normal gradient', d: `$m_n = -\\dfrac{1}{${m}} = ${f.latex()}$` }]
    });
  } },
  // D3 — y-intercept of the tangent to a cubic
  { diffs: [3], make: rng => {
    let a, b, c, d, x0, m, y0, ct;
    do { a = rc(rng, [1, 2, -1]); b = nz(rng, -4, 4); c = nz(rng, -6, 6); d = nz(rng, -8, 8); x0 = nz(rng, -2, 2); m = 3 * a * x0 * x0 + 2 * b * x0 + c; y0 = a * x0 ** 3 + b * x0 * x0 + c * x0 + d; ct = y0 - m * x0; } while (ct === 0);
    return numQ(`Find the $y$-intercept of the tangent to $y = ${poly([a, b, c, d])}$ at the point where $x = ${x0}$.`, ct, {
      hint: 'e.g. -4',
      traps: [{ value: y0, why: 'That is the $y$-coordinate of the point of tangency. The tangent crosses the $y$-axis at a different point.' }, { value: m, why: 'That is the gradient of the tangent, not its intercept.' }, { value: y0 + m * x0, why: 'Sign slip: $c = y_0 - m x_0$.' }],
      hints: ['Find the gradient of the tangent, then the point of tangency.', `$m = ${m}$ and the point is $(${x0}, ${y0})$.`, `Use $y = ${m}x + c$ through the point to find $c$.`],
      steps: [{ h: 'Gradient', d: `$\\dfrac{dy}{dx} = ${poly([3 * a, 2 * b, c])}$, so $m = ${m}$` }, { h: 'Point', d: `$(${x0}, ${y0})$` }, { h: 'Intercept', d: `$${y0} = ${m}(${x0}) + c \\Rightarrow c = ${ct}$` }]
    });
  } },
  // D3 — reverse: find b from a tangent gradient
  { diffs: [3], make: rng => {
    const a = nz(rng, -3, 3), b = nz(rng, -8, 8), c0 = nz(rng, -9, 9), x0 = nz(rng, -3, 3), g = 2 * a * x0 + b;
    return numQ(`The curve $y = ${term(a, 'x', 2)} + bx ${sgn(c0)}$ has a tangent with gradient $${g}$ at the point where $x = ${x0}$. Find $b$.`, b, {
      hint: 'e.g. 5',
      traps: [{ value: g - a * x0, why: 'The derivative of $' + term(a, 'x', 2) + '$ is $' + 2 * a + 'x$, so its contribution at $x = ' + x0 + '$ is $' + 2 * a * x0 + '$.' }, { value: g + 2 * a * x0, why: 'Sign slip: subtract $' + 2 * a * x0 + '$ from the gradient to isolate $b$.' }],
      hints: [`Differentiate: $\\dfrac{dy}{dx} = ${2 * a}x + b$.`, `Substitute $x = ${x0}$ and equate to $${g}$.`, 'Solve for $b$.'],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${2 * a}x + b$` }, { h: 'Gradient at x = ' + x0, d: `$${2 * a * x0} + b = ${g}$` }, { h: 'Solve', d: `$b = ${b}$` }]
    });
  } },
  // D3 — first principles (show that): find the constant in the difference quotient
  { diffs: [3], make: rng => {
    const a = nz(rng, -4, 4), b = nz(rng, -6, 6), x0 = nz(rng, -4, 4), P = 2 * a * x0 + b;
    return numQ(`Let $f(x) = ${poly([a, b, 0])}$. Show that $\\dfrac{f(${x0} + h) - f(${x0})}{h} = P + ${term(a, 'h')}$ for $h \\ne 0$, where $P$ is a constant, and find $P$.`, P, {
      hint: 'e.g. 6',
      traps: [{ value: a * x0 * x0 + b * x0, why: 'That is $f(' + x0 + ')$. $P$ is what remains after dividing $f(' + x0 + ' + h) - f(' + x0 + ')$ by $h$.' }, { value: P - b, why: 'The linear term $' + b + 'x$ contributes $' + b + '$ to $P$.' }],
      hints: [`Expand $f(${x0} + h)$ and subtract $f(${x0})$.`, 'Every remaining term has a factor of $h$; divide by $h$.', 'The constant left over is $P$ (and is also $f\'(' + x0 + ')$ as $h \\to 0$).'],
      steps: [{ h: 'Difference', d: `$f(${x0} + h) - f(${x0}) = ${P}h ${sgn(a)}h^2$` }, { h: 'Divide by h', d: `$${P} ${sgn(a)}h$` }, { h: 'Constant', d: `$P = ${P}$` }]
    });
  } },
  // D3 — gradient of a chord, as a decimal, then compare with the tangent
  { diffs: [3], make: rng => {
    const a = nz(rng, -4, 4), b = nz(rng, -6, 6), c = nz(rng, -8, 8), x0 = nz(rng, -3, 3), h = rc(rng, [0.1, 0.5]);
    const f = x => a * x * x + b * x + c, v = Math.round(((f(x0 + h) - f(x0)) / h) * 1000) / 1000;
    return numQ(`The curve $y = ${poly([a, b, c])}$ passes through the points $P$ and $Q$ where $x = ${x0}$ and $x = ${r3(x0 + h)}$. Find the gradient of the chord $PQ$, as a decimal.`, v, {
      hint: 'e.g. 4.5',
      traps: [{ value: 2 * a * x0 + b, why: 'That is the gradient of the **tangent** at $P$. The chord $PQ$ is slightly different because $Q$ is a finite distance away.' }, { value: Math.round(((f(x0 + h) - f(x0))) * 1000) / 1000, why: 'You found the rise but did not divide by the run $' + h + '$.' }],
      hints: ['The gradient of a chord is rise over run.', `Find $y$ at $x = ${x0}$ and $x = ${r3(x0 + h)}$.`, `Run $= ${h}$.`],
      steps: [{ h: 'y-values', d: `$y(${x0}) = ${Math.round(f(x0) * 1000) / 1000}$, $y(${r3(x0 + h)}) = ${r3(f(x0 + h))}$` }, { h: 'Gradient', d: `$\\dfrac{\\Delta y}{\\Delta x} = ${v}$` }]
    });
  } },
  // D3 — context: gradient of a ramp profile
  { diffs: [3], make: rng => {
    let a, b, c, k, g;
    do { a = ri(rng, 1, 3); b = nz(rng, -6, 6); c = ri(rng, 0, 5); k = ri(rng, 1, 5); g = 2 * a * k + b; } while (g === 0);
    return numQ(`The profile of a skate ramp is modelled by $y = ${poly([a, b, c])}$, where $x$ is the horizontal distance and $y$ the height, both in metres. Find the gradient of the surface where $x = ${k}$.`, g, {
      hint: 'e.g. 4',
      traps: [{ value: a * k * k + b * k + c, why: 'That is the **height** at $x = ' + k + '$. The gradient comes from the derivative.' }, { value: a * k + b, why: 'The derivative of $' + term(a, 'x', 2) + '$ is $' + 2 * a + 'x$, not $' + a + 'x$.' }],
      hints: ['The gradient of the surface is $\\dfrac{dy}{dx}$.', `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$.`, `Substitute $x = ${k}$.`],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$` }, { h: 'Substitute', d: `$${g}$` }]
    });
  } },
  // D3 — MCQ: which value is the tangent gradient
  { diffs: [3], make: rng => {
    let a, b, c, x0, m, y0;
    do { a = nz(rng, -3, 3); b = nz(rng, -6, 6); c = nz(rng, -8, 8); x0 = nz(rng, -3, 3); m = 2 * a * x0 + b; y0 = a * x0 * x0 + b * x0 + c; } while (m === 0);
    const cand = [[y0, 'That is the $y$-value at $x = ' + x0 + '$ (the height of the curve), not its gradient.'], [a * x0 + b, 'The derivative of $' + term(a, 'x', 2) + '$ is $' + 2 * a + 'x$, so the factor $2$ was missed.'], [2 * a * x0 - b, 'The derivative of $' + b + 'x$ is $+' + b + '$ — its sign does not change.'], [m + 1, 'Check the arithmetic when substituting.']].filter(([v]) => v !== m);
    return mcQ(rng, `What is the gradient of the tangent to $y = ${poly([a, b, c])}$ at the point where $x = ${x0}$?`, `$${m}$`, cand.map(([v, why]) => ({ text: `$${v}$`, why })),
      ['The gradient of the tangent is the derivative evaluated at the point.', `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$.`, `Substitute $x = ${x0}$.`],
      [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$` }, { h: 'Substitute', d: `$${m}$` }]);
  } },
  // D4 — horizontal tangent (stationary point)
  { diffs: [4], make: rng => {
    const a = nz(rng, -3, 3), x0 = nz(rng, -4, 4), b = -2 * a * x0, c = nz(rng, -9, 9), y0 = a * x0 * x0 + b * x0 + c;
    return ptQ(`Find the coordinates of the point on $y = ${poly([a, b, c])}$ where the tangent is horizontal.`, x0, y0, {
      trap: 'A horizontal tangent has gradient $0$: set $\\dfrac{dy}{dx} = 0$, solve for $x$, then find $y$ from the original equation.',
      hints: ['A horizontal line has gradient $0$.', `$\\dfrac{dy}{dx} = ${poly([2 * a, b])} = 0$.`, 'Substitute the $x$-value into the original equation for $y$.'],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$` }, { h: 'Set to 0', d: `$x = ${x0}$` }, { h: 'Find y', d: `$y = ${y0}$, so $(${x0}, ${y0})$` }]
    });
  } },
  // D4 — cubic with a given gradient: the greater x-coordinate
  { diffs: [4], make: rng => {
    let r1, r2;
    do { r1 = ri(rng, -4, 4); r2 = ri(rng, -4, 4); } while (r1 === r2 || (r1 + r2) % 2 !== 0 || r1 + r2 === 0);
    const g = nz(rng, -12, 12), b = -3 * (r1 + r2) / 2, c = g + 3 * r1 * r2, d = nz(rng, -9, 9), big = Math.max(r1, r2);
    return numQ(`The gradient of the curve $y = ${poly([1, b, c, d])}$ equals $${g}$ at two points. Find the greater $x$-coordinate of these two points.`, big, {
      hint: 'e.g. 3',
      traps: [{ value: Math.min(r1, r2), why: 'That is the smaller of the two solutions. The question asks for the greater.' }, { value: -big, why: 'Check the signs when factorising or using the quadratic formula.' }],
      hints: [`Differentiate: $\\dfrac{dy}{dx} = ${poly([3, 2 * b, c])}$.`, `Set it equal to $${g}$ and rearrange to $${poly([3, 2 * b, c - g])} = 0$.`, 'Solve the quadratic and take the greater root.'],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${poly([3, 2 * b, c])}$` }, { h: 'Set equal to the gradient', d: `$${poly([3, 2 * b, c - g])} = 0$` }, { h: 'Solve', d: `$x = ${Math.min(r1, r2)}$ or $x = ${big}$; the greater is $${big}$` }]
    });
  } },
  // D4 — tangent parallel to a given line
  { diffs: [4], make: rng => {
    let a, b, x0, m;
    do { a = nz(rng, -3, 3); b = nz(rng, -6, 6); x0 = nz(rng, -4, 4); m = 2 * a * x0 + b; } while (m === 0);
    const c = nz(rng, -8, 8), k = nz(rng, -9, 9), y0 = a * x0 * x0 + b * x0 + c;
    return ptQ(`Find the point on the curve $y = ${poly([a, b, c])}$ at which the tangent is **parallel** to the line $y = ${term(m, 'x')} ${sgn(k)}$.`, x0, y0, {
      trap: 'Parallel lines have equal gradients: set $\\dfrac{dy}{dx}$ equal to the gradient of the given line, solve for $x$, then find $y$ on the **curve** (not the line).',
      hints: [`The line has gradient $${m}$.`, `Solve $${poly([2 * a, b])} = ${m}$.`, 'Substitute $x$ into the curve to find $y$.'],
      steps: [{ h: 'Match gradients', d: `$${poly([2 * a, b])} = ${m}$` }, { h: 'Solve for x', d: `$x = ${x0}$` }, { h: 'Find y on the curve', d: `$y = ${y0}$, so $(${x0}, ${y0})$` }]
    });
  } },
  // D4 — tangent perpendicular to a given line
  { diffs: [4], make: rng => {
    let a, b, x0, g;
    do { a = nz(rng, -3, 3); b = nz(rng, -6, 6); x0 = nz(rng, -4, 4); g = 2 * a * x0 + b; } while (Math.abs(g) < 2);
    const c = nz(rng, -8, 8), k = nz(rng, -9, 9), y0 = a * x0 * x0 + b * x0 + c, L = new Frac(-1, g);
    return ptQ(`Find the point on the curve $y = ${poly([a, b, c])}$ at which the tangent is **perpendicular** to the line $y = ${mx(L)} ${sgn(k)}$.`, x0, y0, {
      trap: 'The tangent gradient must be the negative reciprocal of the line gradient. Solve $\\dfrac{dy}{dx}$ equal to that, then find $y$ on the curve.',
      hints: [`The line has gradient $${L.latex()}$, so the tangent gradient is $${g}$.`, `Solve $${poly([2 * a, b])} = ${g}$.`, 'Substitute $x$ into the curve for $y$.'],
      steps: [{ h: 'Tangent gradient', d: `$m = -\\dfrac{1}{${L.latex()}} = ${g}$` }, { h: 'Solve', d: `$${poly([2 * a, b])} = ${g} \\Rightarrow x = ${x0}$` }, { h: 'Find y', d: `$y = ${y0}$, so $(${x0}, ${y0})$` }]
    });
  } },
  // D4 — reverse: find the coefficient from a horizontal tangent
  { diffs: [4], make: rng => {
    const a = nz(rng, -5, 5), x0 = nz(rng, -4, 4), b = -2 * a * x0, c = nz(rng, -9, 9);
    return numQ(`The tangent to $y = ax^2 ${sgn(b)}x ${sgn(c)}$ is horizontal at $x = ${x0}$. Find $a$.`, a, {
      hint: 'e.g. 2',
      traps: [{ value: -a, why: 'Check the sign: $2a(' + x0 + ') ' + sgn(b) + ' = 0$.' }, { value: b / x0, why: 'The derivative is $2ax + b$, so the coefficient of $x$ in the derivative is $2a$, not $a$.' }],
      hints: [`Differentiate: $\\dfrac{dy}{dx} = 2ax ${sgn(b)}$.`, `A horizontal tangent means $\\dfrac{dy}{dx} = 0$ at $x = ${x0}$.`, `Solve $${2 * x0}a ${sgn(b)} = 0$.`],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = 2ax ${sgn(b)}$` }, { h: 'Horizontal at x = ' + x0, d: `$${2 * x0}a ${sgn(b)} = 0$` }, { h: 'Solve', d: `$a = ${a}$` }]
    });
  } },
  // D4 — MCQ: which equation locates the point with a given gradient
  { diffs: [4], make: rng => {
    const a = nz(rng, -4, 4), b = nz(rng, -7, 7), c = nz(rng, -8, 8), g = nz(rng, -9, 9);
    const ds = [{ text: `$${poly([a, b, c])} = ${g}$`, why: 'That sets the **height** $y$ equal to the gradient. The gradient is $\\dfrac{dy}{dx}$.' }, { text: `$${poly([2 * a, b])} = 0$`, why: 'That finds where the gradient is $0$ (a horizontal tangent), not where it equals $' + g + '$.' }, { text: `$\\dfrac{${poly([a, b, c])}}{x} = ${g}$`, why: 'Gradient is not $y \\div x$ for a curve; it is the derivative.' }];
    return mcQ(rng, `Which equation must be solved to find the $x$-coordinate of the point on $y = ${poly([a, b, c])}$ where the gradient of the curve is $${g}$?`, `$${poly([2 * a, b])} = ${g}$`, ds,
      ['The gradient of the curve at a point is $\\dfrac{dy}{dx}$.', `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$.`, 'Set the derivative equal to the required gradient.'],
      [{ h: 'Differentiate', d: `$\\dfrac{dy}{dx} = ${poly([2 * a, b])}$` }, { h: 'Set equal to the gradient', d: `$${poly([2 * a, b])} = ${g}$` }]);
  } },
  // D4 — context: greatest height of a cricket ball
  { diffs: [4], make: rng => {
    const a = ri(rng, 2, 5), ts = ri(rng, 1, 3), c = ri(rng, 1, 3), b = 2 * a * ts, H = c + a * ts * ts;
    return numQ(`The height $h$ metres of a cricket ball $t$ seconds after it is hit is modelled by $h = ${poly([-a, b, c])}$. Use calculus to find the greatest height the ball reaches, in metres.`, H, {
      hint: 'e.g. 21',
      traps: [{ value: ts, why: 'That is the **time** at which the greatest height occurs. The question asks for the height.' }, { value: c, why: 'That is the height at $t = 0$ (when the ball is hit).' }],
      hints: ['The ball is at its highest where $\\dfrac{dh}{dt} = 0$.', `$\\dfrac{dh}{dt} = ${poly([-2 * a, b])}$.`, 'Find $t$, then substitute into $h$.'],
      steps: [{ h: 'Differentiate', d: `$\\dfrac{dh}{dt} = ${poly([-2 * a, b])}$` }, { h: 'Set to 0', d: `$t = ${ts}$` }, { h: 'Greatest height', d: `$h(${ts}) = ${H}$ metres` }]
    });
  } }
];

// ═════════════════════════════════════════════════════════════════════════════
// y11-probability
// ═════════════════════════════════════════════════════════════════════════════
const wordCounts = w => { const m = {}; for (const ch of w) m[ch] = (m[ch] || 0) + 1; return Object.values(m); };
const WORDS = ['BANANA', 'PARRAMATTA', 'MELBOURNE', 'BRISBANE', 'CANBERRA', 'ADELAIDE', 'TOOWOOMBA', 'COOLANGATTA', 'MISSISSIPPI', 'WOLLONGONG', 'KATOOMBA', 'BALLARAT', 'TASMANIA', 'GEELONG'];
const prob = (n, d) => new Frac(n, d);
const probForms = [
  // D1 — reverse: find n from nCr or nPr
  { diffs: [1], make: rng => {
    const useC = rng() < 0.5, r = rc(rng, [2, 3]), n = ri(rng, 5, 16), V = useC ? nCr(n, r) : nPr(n, r), L = useC ? 'C' : 'P';
    return numQ(`Given that ${'$'}{}^{n}${L}_{${r}} = ${V}${'$'}, find $n$.`, n, {
      hint: 'e.g. 8',
      traps: [{ value: n + 1, why: 'Check your factorised equation: substitute your $n$ back in and compare with $' + V + '$.' }, { value: n - 1, why: 'Substitute your $n$ back into ${}^{n}' + L + '_{' + r + '}$ to check.' }],
      hints: [useC ? `$ {}^{n}C_{${r}} = \\dfrac{n(n-1)${r === 3 ? '(n-2)' : ''}}{${fact(r)}}$.` : `$ {}^{n}P_{${r}} = n(n-1)${r === 3 ? '(n-2)' : ''}$.`, `Set this equal to $${V}$.`, 'Look for consecutive integers whose product matches, or solve the equation.'],
      steps: [{ h: 'Expand', d: useC ? `$\\dfrac{n(n-1)${r === 3 ? '(n-2)' : ''}}{${fact(r)}} = ${V}$` : `$n(n-1)${r === 3 ? '(n-2)' : ''} = ${V}$` }, { h: 'Solve', d: `$n = ${n}$` }, { h: 'Check', d: `$${useC ? nCr(n, r) : nPr(n, r)}$ ✓` }]
    });
  } },
  // D1 — context: choosing a team (order does not matter)
  { diffs: [1], make: rng => {
    const n = ri(rng, 8, 16), r = ri(rng, 3, 6), c = rc(rng, [
      (n, r) => `A netball coach must choose $${r}$ players from a squad of $${n}$ to travel to a carnival. How many different groups of players could be chosen?`,
      (n, r) => `A Year 11 class of $${n}$ students must send $${r}$ of its members to a maths camp in Canberra. How many different groups could go?`,
      (n, r) => `A cricket club has $${n}$ bowlers available and needs a squad of $${r}$ of them. How many different squads are possible?`]);
    const v = nCr(n, r);
    return numQ(c(n, r), v, {
      hint: 'e.g. 462',
      traps: [{ value: nPr(n, r), why: 'Order does not matter in a group, so divide the ordered count by $' + r + '!$.' }, { value: Math.pow(n, r), why: 'A person cannot be chosen twice, so the number of choices shrinks.' }],
      hints: ['Does the order in which people are chosen matter?', `The order does not matter, so use $ {}^{${n}}C_{${r}}$.`, `$\\dfrac{${n}!}{${r}!\\,${n - r}!}$.`],
      steps: [{ h: 'Choose a model', d: 'A group: order does not matter, so combinations.' }, { h: 'Evaluate', d: `$ {}^{${n}}C_{${r}} = ${v}$` }]
    });
  } },
  // D1 — context: ordered selection (order matters)
  { diffs: [1], make: rng => {
    const c = rc(rng, [
      { t: n => `$${n}$ athletes run in a final. In how many different ways can gold, silver and bronze medals be awarded?`, r: 3 },
      { t: n => `A club of $${n}$ members must elect a president and a secretary (different people). In how many ways can this be done?`, r: 2 },
      { t: n => `A surf lifesaving club has $${n}$ patrol members. A captain, a vice-captain and a first-aider are to be named, all different. In how many ways can this be done?`, r: 3 }]);
    const n = ri(rng, 6, 16), v = nPr(n, c.r);
    return numQ(c.t(n), v, {
      hint: 'e.g. 720',
      traps: [{ value: nCr(n, c.r), why: 'The roles are different, so the order of selection matters. Do not divide by $' + c.r + '!$.' }, { value: Math.pow(n, c.r), why: 'One person cannot hold two roles, so the choices shrink each time.' }],
      hints: ['Does it matter who gets which role?', `Yes, so use $ {}^{${n}}P_{${c.r}}$.`, `Multiply ${c.r} descending numbers starting at ${n}.`],
      steps: [{ h: 'Choose a model', d: 'Different roles: order matters, so permutations.' }, { h: 'Evaluate', d: `$ {}^{${n}}P_{${c.r}} = ${Array.from({ length: c.r }, (_, i) => n - i).join(' \\times ')} = ${v}$` }]
    });
  } },
  // D1 — MCQ: which expression counts the situation
  { diffs: [1], make: rng => {
    const ordered = rng() < 0.5, n = ri(rng, 7, 15), r = ri(rng, 3, 5);
    const sit = ordered
      ? rc(rng, [`awards first, second and third prizes to ${r} different people chosen from $${n}$ entrants`.replace(/\$?\d+\$? different/, `${r} different`), `assigns $${r}$ different jobs to $${r}$ people chosen from $${n}$ volunteers`])
      : rc(rng, [`chooses a committee of $${r}$ people from $${n}$ nominees`, `selects $${r}$ players from a squad of $${n}$ to form a team`]);
    const P = `{}^{${n}}P_{${r}}`, C = `{}^{${n}}C_{${r}}`;
    const ds = ordered
      ? [{ text: `$${C}$`, why: 'That counts unordered groups. Here the positions are different, so order matters.' }, { text: `$${n}^{${r}}$`, why: 'That allows the same person to be chosen more than once.' }, { text: `$\\dfrac{${n}!}{${r}!}$`, why: 'The count of ordered selections divides by $(n - r)!$, not $r!$.' }]
      : [{ text: `$${P}$`, why: 'That counts ordered arrangements. Here only who is chosen matters, not the order.' }, { text: `$${n}^{${r}}$`, why: 'That allows the same person to be chosen more than once.' }, { text: `$\\dfrac{${n}!}{${r}!}$`, why: 'The count of unordered selections divides by $r!\\,(n - r)!$.' }];
    return mcQ(rng, `Which expression gives the number of ways a club ${sit}?`.replace('a club', ordered ? 'a school' : 'a club'), `$${ordered ? P : C}$`, ds,
      ['Ask: does the order, or role, matter?', 'If order matters use $ {}^{n}P_{r}$; if not, use $ {}^{n}C_{r}$.', 'Rule out any option that allows repeats.'],
      [{ h: 'Decide', d: ordered ? 'Order (roles) matters: permutations.' : 'Only the group matters: combinations.' }, { h: 'Expression', d: `$${ordered ? P : C}$` }]);
  } },
  // D1 — symmetry of combinations (show that): find the other value
  { diffs: [1], make: rng => {
    const n = ri(rng, 8, 16), r = ri(rng, 2, Math.floor((n - 1) / 2)), k = n - r;
    return numQ(`It is known that ${'$'}{}^{${n}}C_{${r}} = {}^{${n}}C_{k}${'$'} for a value of $k$ different from $${r}$. Find $k$.`, k, {
      hint: 'e.g. 9',
      traps: [{ value: k + 1, why: 'Selecting $' + r + '$ to include is the same as selecting $' + (n - r) + '$ to leave out — exactly $n - r$, with no adjustment.' }, { value: k - 1, why: 'Selecting $' + r + '$ to include is the same as selecting $' + (n - r) + '$ to leave out — exactly $n - r$, with no adjustment.' }, { value: n, why: 'The lower index is $n - r$, not $n$.' }],
      hints: ['Choosing $r$ items to include is the same as choosing the $n - r$ items to leave out.', `So ${'$'}{}^{n}C_{r} = {}^{n}C_{n-r}${'$'}.`, `$k = ${n} - ${r}$.`],
      steps: [{ h: 'Symmetry', d: `${'$'}{}^{n}C_{r} = {}^{n}C_{n-r}${'$'}` }, { h: 'Substitute', d: `$k = ${n} - ${r} = ${k}$` }]
    });
  } },
  // D1 — factorial quotient
  { diffs: [1], make: rng => {
    const pat = rng() < 0.5, n = ri(rng, 5, 14), v = pat ? (n + 1) * n : n * (n - 1);
    return numQ(pat ? `Evaluate $\\dfrac{(n + 1)!}{(n - 1)!}$ when $n = ${n}$.` : `Evaluate $\\dfrac{n!}{(n - 2)!}$ when $n = ${n}$.`, v, {
      hint: 'e.g. 90',
      traps: pat ? [{ value: n + 1, why: 'Expand the larger factorial: $(n + 1)! = (n + 1) \\times n \\times (n - 1)!$.' }, { value: n * n, why: 'The cancelled factors are $(n + 1)$ and $n$.' }] : [{ value: n, why: 'Expand: $n! = n(n - 1)(n - 2)!$, leaving two factors.' }, { value: n - 1, why: 'Expand: $n! = n(n - 1)(n - 2)!$, leaving two factors.' }],
      hints: [pat ? '$(n + 1)! = (n + 1)\\, n\\, (n - 1)!$.' : '$n! = n(n - 1)(n - 2)!$.', 'Cancel the common factorial.', `Substitute $n = ${n}$.`],
      steps: [{ h: 'Expand and cancel', d: pat ? '$\\dfrac{(n + 1)\\,n\\,(n - 1)!}{(n - 1)!} = (n + 1)n$' : '$\\dfrac{n(n - 1)(n - 2)!}{(n - 2)!} = n(n - 1)$' }, { h: 'Substitute', d: `$${v}$` }]
    });
  } },
  // D2 — arrangements of a word with repeated letters
  { diffs: [2], make: rng => {
    const w = rc(rng, WORDS), cs = wordCounts(w), n = w.length, v = cs.reduce((a, c) => a / fact(c), fact(n));
    const rep = cs.filter(c => c > 1).map(c => `${c}!`).join('\\,');
    return numQ(`How many different arrangements are there of all the letters of the word **${w}**?`, Math.round(v), {
      hint: 'e.g. 60',
      traps: [{ value: fact(n), why: 'Some letters repeat, so swapping identical letters gives the same arrangement. Divide by the factorial of each repeat count.' }, { value: Math.round(fact(n) / cs.filter(c => c > 1).reduce((a, c) => a * c, 1)), why: 'Divide by $k!$ for each letter repeated $k$ times, not only by $k$.' }],
      hints: [`There are ${n} letters.`, `Letters that repeat: ${cs.filter(c => c > 1).join(', ')} times.`, `$\\dfrac{${n}!}{${rep}}$.`],
      steps: [{ h: 'Total arrangements if all letters differed', d: `$${n}! = ${fact(n)}$` }, { h: 'Divide for repeats', d: `$\\dfrac{${n}!}{${rep}} = ${Math.round(v)}$` }]
    });
  } },
  // D2 — two particular people must stand together
  { diffs: [2], make: rng => {
    const n = ri(rng, 4, 8), v = 2 * fact(n - 1);
    return numQ(`$${n}$ friends stand in a line for a photo. Two particular friends insist on standing next to each other. In how many ways can the line be arranged?`, v, {
      hint: 'e.g. 240',
      traps: [{ value: fact(n), why: 'That ignores the condition. Treat the pair as one block, then allow for the two orders within the block.' }, { value: fact(n - 1), why: 'The two friends can swap places within the block, so double it.' }],
      hints: ['Treat the two friends as a single block.', `Then there are $${n - 1}$ objects to arrange.`, 'The pair can be ordered in $2$ ways.'],
      steps: [{ h: 'Block arrangements', d: `$${n - 1}! = ${fact(n - 1)}$` }, { h: 'Order within the block', d: '$\\times\\, 2$' }, { h: 'Total', d: `$${v}$` }]
    });
  } },
  // D2 — two particular people must NOT stand together (complement)
  { diffs: [2], make: rng => {
    const n = ri(rng, 4, 8), v = fact(n) - 2 * fact(n - 1);
    return numQ(`$${n}$ players line up for a team photo. Two particular players refuse to stand next to each other. In how many ways can the line be arranged?`, v, {
      hint: 'e.g. 480',
      traps: [{ value: 2 * fact(n - 1), why: 'That counts the arrangements where they **are** together. Subtract it from the total.' }, { value: fact(n) - fact(n - 1), why: 'The pair can be together in two orders, so subtract $2 \\times ' + (n - 1) + '!$.' }],
      hints: ['Count all arrangements, then subtract the unwanted ones.', `Together: $2 \\times ${n - 1}!$.`, `Total: $${n}!$.`],
      steps: [{ h: 'All arrangements', d: `$${n}! = ${fact(n)}$` }, { h: 'Together', d: `$2 \\times ${n - 1}! = ${2 * fact(n - 1)}$` }, { h: 'Not together', d: `$${fact(n)} - ${2 * fact(n - 1)} = ${v}$` }]
    });
  } },
  // D2 — codes with and without repetition (multiplication principle)
  { diffs: [2], make: rng => {
    const l = ri(rng, 2, 3), d = ri(rng, 2, 4), rep = rng() < 0.5;
    let v = 1;
    for (let i = 0; i < l; i++) v *= rep ? 26 : 26 - i;
    for (let i = 0; i < d; i++) v *= rep ? 10 : 10 - i;
    return numQ(`A locker code has $${l}$ letters (from the $26$ in the alphabet) followed by $${d}$ digits (from $0$ to $9$). ${rep ? 'Letters and digits may be repeated.' : 'No letter and no digit may be repeated.'} How many different codes are possible?`, v, {
      hint: 'e.g. 60840',
      traps: [{ value: rep ? Math.pow(26, l) + Math.pow(10, d) : Array.from({ length: l }, (_, i) => 26 - i).reduce((a, b) => a * b, 1) + Array.from({ length: d }, (_, i) => 10 - i).reduce((a, b) => a * b, 1), why: 'The parts are chosen one after the other, so **multiply** the numbers of choices.' }, { value: rep ? (() => { let u = 1; for (let i = 0; i < l; i++) u *= 26 - i; for (let i = 0; i < d; i++) u *= 10 - i; return u; })() : Math.pow(26, l) * Math.pow(10, d), why: rep ? 'Repeats are allowed, so each position still has the full number of choices.' : 'No repeats, so the number of choices drops by one each time.' }],
      hints: ['Use the multiplication principle: choices for each position.', rep ? `Letters: $26^{${l}}$. Digits: $10^{${d}}$.` : `Letters: $${Array.from({ length: l }, (_, i) => 26 - i).join(' \\times ')}$. Digits: $${Array.from({ length: d }, (_, i) => 10 - i).join(' \\times ')}$.`, 'Multiply the letter count by the digit count.'],
      steps: [{ h: 'Letters', d: rep ? `$26^{${l}}$` : `$${Array.from({ length: l }, (_, i) => 26 - i).join(' \\times ')}$` }, { h: 'Digits', d: rep ? `$10^{${d}}$` : `$${Array.from({ length: d }, (_, i) => 10 - i).join(' \\times ')}$` }, { h: 'Multiply', d: `$${v}$` }]
    });
  } },
  // D2 — MCQ: expression for a word with repeated letters
  { diffs: [2], make: rng => {
    const w = rc(rng, WORDS), cs = wordCounts(w), n = w.length, rs = cs.filter(c => c > 1);
    const fix = c => `${c}!`;
    const correct = `$\\dfrac{${n}!}{${rs.map(fix).join('\\,')}}$`;
    const ds = [{ text: `$${n}!$`, why: 'That treats every letter as different, so identical letters swapped are counted as different arrangements.' }, { text: `$\\dfrac{${n}!}{${rs.reduce((a, b) => a + b, 0)}!}$`, why: 'Divide by the factorial of each repeat count **separately** and multiply the denominators; do not add the counts first.' }, { text: `$\\dfrac{${n}!}{${rs.reduce((a, b) => a * b, 1)}}$`, why: 'Divide by $k!$ for each letter repeated $k$ times, not by $k$.' }].filter(o => o.text !== correct);
    return mcQ(rng, `Which expression gives the number of different arrangements of all the letters of **${w}**?`, correct, ds,
      ['Count how many times each letter occurs.', 'Divide $n!$ by the factorial of each repeat count.', 'Identical letters cannot be told apart.'],
      [{ h: 'Letter counts', d: `${rs.join(', ')} repeated` }, { h: 'Expression', d: correct }]);
  } },
  // D2 — reverse: how many letters
  { diffs: [2], make: rng => {
    const n = ri(rng, 4, 9);
    return numQ(`All the letters of a word are different. The number of arrangements of all its letters is $${fact(n)}$. How many letters does the word have?`, n, {
      hint: 'e.g. 6',
      traps: [{ value: fact(n), why: 'That is the number of arrangements, not the number of letters.' }, { value: n + 1, why: 'Check: ' + (n + 1) + '! = ' + fact(n + 1) + ', which is too large.' }],
      hints: ['All different letters means $n!$ arrangements.', `Find $n$ with $n! = ${fact(n)}$.`, 'Try consecutive factorials.'],
      steps: [{ h: 'Model', d: '$n! = ' + fact(n) + '$' }, { h: 'Solve', d: `$${n}! = ${fact(n)}$, so $n = ${n}$` }]
    });
  } },
  // D3 — independent events: find P(A ∩ B)
  { diffs: [3], make: rng => {
    const dA = rc(rng, [5, 6, 8, 10, 12]), dB = rc(rng, [4, 5, 6, 9, 10]), pA = prob(ri(rng, 1, dA - 1), dA), pB = prob(ri(rng, 1, dB - 1), dB), f = pA.mul(pB);
    return fracQ(`Events $A$ and $B$ are **independent**, with $P(A) = ${pA.latex()}$ and $P(B) = ${pB.latex()}$. Find $P(A \\cap B)$ as a fraction in simplest form.`, f, {
      hint: 'e.g. 1/6',
      traps: [{ value: pA.add(pB).value, why: 'Adding is for $P(A \\cup B)$ of mutually exclusive events. For independent events $P(A \\cap B) = P(A)\\,P(B)$.' }, { value: Math.min(pA.value, pB.value), why: 'For independent events the intersection is the **product**, which is smaller than either.' }],
      hints: ['Independent means $P(A \\cap B) = P(A) \\times P(B)$.', `$${pA.latex()} \\times ${pB.latex()}$.`, 'Simplify.'],
      steps: [{ h: 'Independence', d: '$P(A \\cap B) = P(A)\\,P(B)$' }, { h: 'Multiply', d: `$${pA.latex()} \\times ${pB.latex()} = ${f.latex()}$` }]
    });
  } },
  // D3 — independence test: find P(B) from P(A) and P(A ∩ B) (show that)
  { diffs: [3], make: rng => {
    const dA = rc(rng, [5, 6, 8, 10]), dB = rc(rng, [4, 5, 6, 9, 10]), pA = prob(ri(rng, 1, dA - 1), dA), pB = prob(ri(rng, 1, dB - 1), dB), pAB = pA.mul(pB);
    return fracQ(`Events $A$ and $B$ satisfy $P(A) = ${pA.latex()}$ and $P(A \\cap B) = ${pAB.latex()}$. They are known to be independent. Find $P(B)$ as a fraction in simplest form.`, pB, {
      hint: 'e.g. 2/5',
      traps: [{ value: pAB.value / pA.value * pA.value, why: 'That is $P(A \\cap B)$ itself. Divide it by $P(A)$.' }, { value: pAB.value * pA.value, why: 'Multiplying would give a smaller probability. For independent events, $P(B) = \\dfrac{P(A \\cap B)}{P(A)}$.' }],
      hints: ['Independent: $P(A \\cap B) = P(A)\\,P(B)$.', 'Rearrange for $P(B)$.', `$P(B) = ${pAB.latex()} \\div ${pA.latex()}$.`],
      steps: [{ h: 'Independence', d: '$P(A \\cap B) = P(A)\\,P(B)$' }, { h: 'Rearrange', d: '$P(B) = \\dfrac{P(A \\cap B)}{P(A)}$' }, { h: 'Divide', d: `$P(B) = ${pB.latex()}$` }]
    });
  } },
  // D3 — counters: given the second is red, the first was red
  { diffs: [3], make: rng => {
    const r = ri(rng, 3, 9), g = ri(rng, 3, 9), N = r + g;
    const both = prob(r * (r - 1), N * (N - 1)), second = prob(r * (r - 1) + g * r, N * (N - 1)), f = both.div(second);
    return fracQ(`A bag holds $${r}$ red counters and $${g}$ green counters. Two counters are drawn at random **without replacement**. Given that the second counter drawn is red, find the probability that the first was also red. Give a fraction in simplest form.`, f, {
      hint: 'e.g. 3/8',
      traps: [{ value: second.value, why: 'That is $P(\\text{second red})$. The question conditions on the second being red and asks about the first.' }, { value: r / N, why: 'The first draw has probability $\\dfrac{' + r + '}{' + N + '}$ before any information; knowing the second is red changes it.' }, { value: both.value, why: 'That is $P(\\text{both red})$. Divide by $P(\\text{second red})$ to condition on it.' }],
      hints: ['Use $P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$.', `$P(\\text{both red}) = \\dfrac{${r}}{${N}} \\times \\dfrac{${r - 1}}{${N - 1}}$.`, `$P(\\text{second red}) = \\dfrac{${r}}{${N}}$ in total.`],
      steps: [{ h: 'Both red', d: `$\\dfrac{${r}}{${N}} \\times \\dfrac{${r - 1}}{${N - 1}} = ${both.latex()}$` }, { h: 'Second red (either first)', d: `$${second.latex()}$` }, { h: 'Condition', d: `$\\dfrac{${both.latex()}}{${second.latex()}} = ${f.latex()}$` }]
    });
  } },
  // D3 — context: percentages and conditional probability
  { diffs: [3], make: rng => {
    const ctx = rc(rng, [
      { a: 'own a surfboard', b: 'own a wetsuit', who: 'Of the members of a Newcastle surf club' },
      { a: 'play cricket', b: 'play AFL', who: 'Of the students at a regional school' },
      { a: 'catch the train to work', b: 'also ride a bike on weekends', who: 'Of the staff at a Sydney firm' }]);
    const x = 5 * ri(rng, 8, 16), y = 5 * ri(rng, 2, x / 5 - 2), f = prob(y, x);
    return fracQ(`${ctx.who}, $${x}\\%$ ${ctx.a}, and $${y}\\%$ both ${ctx.a} and ${ctx.b}. A person who ${ctx.a.replace(/^own/, 'owns').replace(/^play/, 'plays').replace(/^catch/, 'catches')} is chosen at random. Find the probability that this person ${ctx.b.replace(/^also ride/, 'also rides').replace(/^own/, 'also owns').replace(/^play/, 'also plays')}. Give a fraction in simplest form.`, f, {
      hint: 'e.g. 2/5',
      traps: [{ value: y / 100, why: 'That is the probability for the whole group. The person is already known to be in the first group, so divide by that group.' }, { value: x / 100, why: 'That is $P(A)$ itself, not the conditional probability.' }],
      hints: ['Write $P(A \\mid B)$ with the given group as the condition.', `$P(\\text{both}) = ${y / 100}$ and $P(\\text{first group}) = ${x / 100}$.`, '$\\dfrac{P(\\text{both})}{P(\\text{first group})}$.'],
      steps: [{ h: 'Formula', d: '$P(B \\mid A) = \\dfrac{P(A \\cap B)}{P(A)}$' }, { h: 'Substitute', d: `$\\dfrac{${y}}{${x}} = ${f.latex()}$` }]
    });
  } },
  // D3 — MCQ: which expression is P(A | B)
  { diffs: [3], make: rng => {
    let N, nA, nB, nAB;
    do { N = rc(rng, [30, 36, 40, 48, 50]); nA = ri(rng, 10, 24); nB = ri(rng, 8, 22); nAB = ri(rng, 2, Math.min(nA, nB) - 2); } while (nA === nB || nA + nB - nAB > N - 3 || nAB === nA - 0);
    const ds = [{ text: `$\\dfrac{${nAB}}{${nA}}$`, why: 'That divides by $n(A)$, so it is $P(B \\mid A)$, the other conditional probability.' }, { text: `$\\dfrac{${nAB}}{${N}}$`, why: 'That is $P(A \\cap B)$, the probability of both events, with no conditioning.' }, { text: `$\\dfrac{${nA}}{${nB}}$`, why: 'This compares the sizes of $A$ and $B$ but ignores the overlap.' }];
    return mcQ(rng, `Among $${N}$ students, $${nA}$ study Music ($A$), $${nB}$ study Drama ($B$) and $${nAB}$ study both. One student is chosen at random. Which expression gives $P(A \\mid B)$, the probability of studying Music **given** that the student studies Drama?`, `$\\dfrac{${nAB}}{${nB}}$`, ds,
      ['The condition is the **given** event: it becomes the new sample space.', '$P(A \\mid B) = \\dfrac{n(A \\cap B)}{n(B)}$.', 'The denominator is the size of $B$.'],
      [{ h: 'Restrict to B', d: `$n(B) = ${nB}$` }, { h: 'Overlap', d: `$n(A \\cap B) = ${nAB}$` }, { h: 'Probability', d: `$P(A \\mid B) = \\dfrac{${nAB}}{${nB}}$` }]);
  } },
  // D3 — two suppliers: P(supplier | defective) (tree-diagram reversal)
  { diffs: [3], make: rng => {
    let sx, dx, dy;
    do { sx = 5 * ri(rng, 4, 16); dx = ri(rng, 1, 9); dy = ri(rng, 1, 9); } while (dx === dy);
    const sy = 100 - sx, f = prob(sx * dx, sx * dx + sy * dy), tot = prob(sx * dx + sy * dy, 100 * 100);
    return fracQ(`A Sydney cafe buys pies from two bakeries. Bakery $X$ supplies $${sx}\\%$ of them and Bakery $Y$ supplies the rest. A pie from $X$ is burnt with probability $${dx}\\%$, and a pie from $Y$ with probability $${dy}\\%$. A pie is chosen at random and is burnt. Find the probability that it came from Bakery $X$, as a fraction in simplest form.`, f, {
      hint: 'e.g. 3/7',
      traps: [{ value: sx / 100, why: 'That is the probability a pie comes from $X$ before you know it is burnt. The burnt pie is evidence.' }, { value: dx / 100, why: 'That is $P(\\text{burnt} \\mid X)$, the reverse of what is asked.' }, { value: sx * dx / 10000, why: 'That is $P(X \\cap \\text{burnt})$. Divide by $P(\\text{burnt})$ to condition.' }],
      hints: ['Find $P(X \\cap \\text{burnt})$ and $P(\\text{burnt})$.', `$P(X \\cap \\text{burnt}) = ${sx / 100} \\times ${dx / 100}$; $P(Y \\cap \\text{burnt}) = ${sy / 100} \\times ${dy / 100}$.`, '$P(X \\mid \\text{burnt}) = \\dfrac{P(X \\cap \\text{burnt})}{P(\\text{burnt})}$.'],
      steps: [{ h: 'Joint probabilities', d: `$${sx * dx}/10000$ from $X$ and $${sy * dy}/10000$ from $Y$` }, { h: 'Total burnt', d: `$P(\\text{burnt}) = ${tot.latex()}$` }, { h: 'Condition', d: `$P(X \\mid \\text{burnt}) = ${f.latex()}$` }]
    });
  } },
  // D4 — at least one red, without replacement
  { diffs: [4], make: rng => {
    const r = ri(rng, 3, 9), g = ri(rng, 3, 9), N = r + g, none = prob(g * (g - 1), N * (N - 1)), f = prob(1, 1).sub(none);
    return fracQ(`A bag holds $${r}$ red marbles and $${g}$ blue marbles. Two marbles are drawn at random **without replacement**. Find the probability that **at least one** is red, as a fraction in simplest form.`, f, {
      hint: 'e.g. 11/15',
      traps: [{ value: none.value, why: 'That is the probability that **neither** is red. Subtract it from $1$.' }, { value: 1 - (g / N) * (g / N), why: 'Without replacement, the second draw has only $' + (N - 1) + '$ marbles to choose from.' }, { value: 2 * r / N, why: 'Adding $\\dfrac{' + r + '}{' + N + '}$ twice double-counts the case when both are red.' }],
      hints: ['Use the complement: $P(\\text{at least one red}) = 1 - P(\\text{no red})$.', `$P(\\text{both blue}) = \\dfrac{${g}}{${N}} \\times \\dfrac{${g - 1}}{${N - 1}}$.`, 'Subtract from $1$.'],
      steps: [{ h: 'Both blue', d: `$\\dfrac{${g}}{${N}} \\times \\dfrac{${g - 1}}{${N - 1}} = ${none.latex()}$` }, { h: 'Complement', d: `$1 - ${none.latex()} = ${f.latex()}$` }]
    });
  } },
  // D4 — two different colours, without replacement
  { diffs: [4], make: rng => {
    const r = ri(rng, 3, 9), g = ri(rng, 3, 9), N = r + g, f = prob(2 * r * g, N * (N - 1));
    return fracQ(`A drawer holds $${r}$ red socks and $${g}$ grey socks. Two socks are taken at random without replacement. Find the probability that they are **different colours**, as a fraction in simplest form.`, f, {
      hint: 'e.g. 8/15',
      traps: [{ value: r * g / (N * (N - 1)), why: 'Different colours can happen in two orders: red then grey, **or** grey then red. Add both.' }, { value: 2 * r * g / (N * N), why: 'Without replacement the second sock is chosen from $' + (N - 1) + '$, not $' + N + '$.' }],
      hints: ['There are two ways: red then grey, or grey then red.', `$\\dfrac{${r}}{${N}} \\times \\dfrac{${g}}{${N - 1}}$ and $\\dfrac{${g}}{${N}} \\times \\dfrac{${r}}{${N - 1}}$.`, 'Add the two probabilities.'],
      steps: [{ h: 'Red then grey', d: `$\\dfrac{${r}}{${N}} \\times \\dfrac{${g}}{${N - 1}}$` }, { h: 'Grey then red', d: `$\\dfrac{${g}}{${N}} \\times \\dfrac{${r}}{${N - 1}}$` }, { h: 'Add', d: `$${f.latex()}$` }]
    });
  } },
  // D4 — two dice (sum at least s, or exactly s)
  { diffs: [4], make: rng => {
    const exact = rng() < 0.5, s = exact ? ri(rng, 3, 11) : ri(rng, 5, 10);
    let cnt = 0;
    for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (exact ? i + j === s : i + j >= s) cnt++;
    const f = prob(cnt, 36);
    return fracQ(`Two fair six-sided dice are rolled. Find the probability that the sum of the two numbers is ${exact ? 'exactly' : 'at least'} $${s}$. Give a fraction in simplest form.`, f, {
      hint: 'e.g. 5/18',
      traps: [{ value: 1 / 12, why: 'Count **all** ordered pairs $(a, b)$ with the required sum; $(2, 3)$ and $(3, 2)$ are different outcomes.' }, { value: cnt / 21, why: 'The sample space has $6 \\times 6 = 36$ equally likely outcomes, not $21$.' }, { value: cnt / 11, why: 'The $11$ possible sums are not equally likely.' }],
      hints: ['The sample space has $6 \\times 6 = 36$ equally likely ordered outcomes.', `List the pairs with sum ${exact ? '' : 'at least '}${s}.`, `Probability $= \\dfrac{${cnt}}{36}$.`],
      steps: [{ h: 'Sample space', d: '$36$ equally likely outcomes' }, { h: 'Favourable outcomes', d: `$${cnt}$ ordered pairs` }, { h: 'Probability', d: `$\\dfrac{${cnt}}{36} = ${f.latex()}$` }]
    });
  } },
  // D4 — addition rule from counts: at least one, or neither
  { diffs: [4], make: rng => {
    let N, a, b, c;
    do { N = ri(rng, 30, 40); a = ri(rng, 10, 20); b = ri(rng, 8, 18); c = ri(rng, 2, Math.min(a, b) - 3); } while (a + b - c > N - 3);
    const neither = rng() < 0.5, k = neither ? N - (a + b - c) : a + b - c, f = prob(k, N);
    return fracQ(`In a Year 11 group of $${N}$ students, $${a}$ play netball, $${b}$ play cricket and $${c}$ play both. A student is chosen at random. Find the probability that the student plays ${neither ? '**neither** sport' : '**at least one** of the two sports'}, as a fraction in simplest form.`, f, {
      hint: 'e.g. 7/10',
      traps: [{ value: (a + b) / N, why: 'The $' + c + '$ students who play both are counted twice. Subtract the overlap: $P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$.' }, { value: neither ? (a + b - c) / N : (N - (a + b - c)) / N, why: neither ? 'That is the probability of playing at least one sport. "Neither" is its complement.' : 'That is the probability of playing neither sport, the complement.' }],
      hints: ['Use the addition rule: $P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$.', `$n(A \\cup B) = ${a} + ${b} - ${c} = ${a + b - c}$.`, neither ? 'Neither is the complement of the union.' : 'Divide by the group size.'],
      steps: [{ h: 'Union', d: `$n(A \\cup B) = ${a} + ${b} - ${c} = ${a + b - c}$` }, ...(neither ? [{ h: 'Neither', d: `$${N} - ${a + b - c} = ${k}$` }] : []), { h: 'Probability', d: `$\\dfrac{${k}}{${N}} = ${f.latex()}$` }]
    });
  } },
  // D4 — three independent shots: exactly two scored
  { diffs: [4], make: rng => {
    const k = rc(rng, [3, 4, 6, 7, 8]), p = prob(k, 10), q = prob(10 - k, 10), f = prob(3 * k * k * (10 - k), 1000);
    return fracQ(`A netball goal shooter scores with probability $${p.latex()}$ on each shot, independently of other shots. Find the probability that she scores **exactly two** of her next three shots, as a fraction in simplest form.`, f, {
      hint: 'e.g. 63/250',
      traps: [{ value: k * k * (10 - k) / 1000, why: 'There are three positions for the miss: $SSM$, $SMS$, $MSS$. Multiply by $3$.' }, { value: 3 * k * k / 100 / 1, why: 'The missed shot must be included: multiply by $' + q.latex() + '$.' }],
      hints: ['List the ways: two scores and one miss in any order.', `Each way has probability $${p.latex()} \\times ${p.latex()} \\times ${q.latex()}$.`, 'There are $3$ such orders.'],
      steps: [{ h: 'One order', d: `$${p.latex()}^2 \\times ${q.latex()}$` }, { h: 'Three orders', d: '$\\times\\, 3$' }, { h: 'Probability', d: `$${f.latex()}$` }]
    });
  } },
  // D4 — MCQ: expression for red then green without replacement
  { diffs: [4], make: rng => {
    const r = ri(rng, 3, 9), g = ri(rng, 3, 9), N = r + g;
    const ds = [{ text: `$\\dfrac{${r}}{${N}} \\times \\dfrac{${g}}{${N}}$`, why: 'That assumes the first counter is replaced. Without replacement the second draw is from $' + (N - 1) + '$ counters.' }, { text: `$\\dfrac{${r}}{${N}} + \\dfrac{${g}}{${N - 1}}$`, why: '"Then" means both happen in sequence, so **multiply** the probabilities; adding is for "or".' }, { text: `$\\dfrac{${r}}{${N}} \\times \\dfrac{${g - 1}}{${N - 1}}$`, why: 'The first counter is red, so only red counters have been removed. The number of green is still $' + g + '$.' }];
    return mcQ(rng, `A bag holds $${r}$ red and $${g}$ green counters. Two are drawn without replacement. Which expression gives the probability that the first is red and the second is green?`, `$\\dfrac{${r}}{${N}} \\times \\dfrac{${g}}{${N - 1}}$`, ds,
      ['"And then" means multiply.', 'After one red counter is removed the bag holds one fewer counter.', 'The number of green counters has not changed.'],
      [{ h: 'First draw', d: `$P(\\text{red}) = \\dfrac{${r}}{${N}}$` }, { h: 'Second draw', d: `$P(\\text{green} \\mid \\text{red first}) = \\dfrac{${g}}{${N - 1}}$` }, { h: 'Multiply', d: `$\\dfrac{${r}}{${N}} \\times \\dfrac{${g}}{${N - 1}}$` }]);
  } },
  // D1/D2 — selection from two groups (product of combinations)
  { diffs: [1, 2], make: rng => {
    const m = ri(rng, 5, 14), w = ri(rng, 5, 14), a = ri(rng, 1, 4), b = ri(rng, 1, 4), v = nCr(m, a) * nCr(w, b);
    return numQ(`A Year 11 maths team is chosen from $${m}$ boys and $${w}$ girls. The team must have exactly $${a}$ ${a === 1 ? 'boy' : 'boys'} and $${b}$ ${b === 1 ? 'girl' : 'girls'}. How many different teams are possible?`, v, {
      hint: 'e.g. 1260',
      traps: [{ value: nCr(m, a) + nCr(w, b), why: 'The boys and the girls are chosen **both**, so multiply the two counts; adding is for "or".' }, { value: nCr(m + w, a + b), why: 'That ignores the requirement for an exact number of boys and girls.' }],
      hints: ['Choose the boys and the girls separately.', `$ {}^{${m}}C_{${a}} \\times {}^{${w}}C_{${b}}$.`, 'Multiply the two numbers.'],
      steps: [{ h: 'Boys', d: `$ {}^{${m}}C_{${a}} = ${nCr(m, a)}$` }, { h: 'Girls', d: `$ {}^{${w}}C_{${b}} = ${nCr(w, b)}$` }, { h: 'Multiply', d: `$${v}$` }]
    });
  } },
  // D1/D2 — a particular member is always in, or always out
  { diffs: [1, 2], make: rng => {
    const n = ri(rng, 8, 30), r = ri(rng, 3, 8), inc = rng() < 0.5, v = inc ? nCr(n - 1, r - 1) : nCr(n - 1, r);
    return numQ(`A club has $${n}$ members. A committee of $${r}$ is to be chosen so that one particular member ${inc ? 'is **on** the committee' : 'is **not** on the committee'}. How many committees are possible?`, v, {
      hint: 'e.g. 330',
      traps: [{ value: nCr(n, r), why: 'That ignores the condition about the particular member.' }, { value: inc ? nCr(n - 1, r) : nCr(n - 1, r - 1), why: inc ? 'That is the count when the member is left **out**.' : 'That is the count when the member is **in**.' }],
      hints: [inc ? 'Place the member on the committee, then choose the remaining places.' : 'Remove the member from the pool, then choose.', inc ? `Choose $${r - 1}$ more from $${n - 1}$.` : `Choose $${r}$ from $${n - 1}$.`, 'Evaluate the combination.'],
      steps: [{ h: 'Reduce the problem', d: inc ? `$ {}^{${n - 1}}C_{${r - 1}}$` : `$ {}^{${n - 1}}C_{${r}}$` }, { h: 'Evaluate', d: `$${v}$` }]
    });
  } },
  // D3 — conditional probability from three counts
  { diffs: [3], make: rng => {
    let N, nA, nB, nAB;
    do { N = ri(rng, 30, 80); nA = ri(rng, 10, 40); nB = ri(rng, 10, 40); nAB = ri(rng, 2, Math.min(nA, nB) - 1); } while (nA + nB - nAB > N);
    const f = prob(nAB, nB);
    return fracQ(`In a group of $${N}$ students, $${nA}$ play violin ($A$), $${nB}$ play piano ($B$) and $${nAB}$ play both. One student is chosen at random. Given that the student plays piano, find the probability that the student plays violin, as a fraction in simplest form.`, f, {
      hint: 'e.g. 3/8',
      traps: [{ value: nAB / nA, why: 'That is $P(B \\mid A)$, with the condition reversed.' }, { value: nAB / N, why: 'That is $P(A \\cap B)$, which does not condition on piano.' }],
      hints: ['Given piano, the sample space is the piano players.', `$n(B) = ${nB}$ and $n(A \\cap B) = ${nAB}$.`, '$P(A \\mid B) = \\dfrac{n(A \\cap B)}{n(B)}$.'],
      steps: [{ h: 'Restrict to B', d: `$${nB}$` }, { h: 'Divide', d: `$\\dfrac{${nAB}}{${nB}} = ${f.latex()}$` }]
    });
  } },
  // D3 — independent events (show that): number who do both
  { diffs: [3], make: rng => {
    const N = rc(rng, [40, 50, 60, 80, 100, 120, 150, 200]);
    let a, b;
    for (;;) {
      a = ri(rng, 2, 9) * N / 10; b = ri(rng, 2, 9) * N / 10;
      const k = a * b / N;
      if (Number.isInteger(k) && k >= 2 && k < Math.min(a, b)) break;
    }
    const k = a * b / N;
    return numQ(`Among $${N}$ customers, $${a}$ buy coffee ($A$) and $${b}$ buy a pastry ($B$). The events $A$ and $B$ are independent. How many customers buy both?`, k, {
      hint: 'e.g. 12',
      traps: [{ value: a * b, why: 'Divide by the total $' + N + '$: $P(A \\cap B) = P(A)\\,P(B)$ gives a probability, which then multiplies back by $' + N + '$.' }, { value: Math.min(a, b), why: 'Independent does not mean one event contains the other.' }],
      hints: ['Independent: $P(A \\cap B) = P(A)\\,P(B)$.', `$P(A) = \\dfrac{${a}}{${N}}$ and $P(B) = \\dfrac{${b}}{${N}}$.`, `Multiply the product by $${N}$.`],
      steps: [{ h: 'Independence', d: `$n(A \\cap B) = \\dfrac{${a} \\times ${b}}{${N}}$` }, { h: 'Evaluate', d: `$${k}$` }]
    });
  } },
  // D4 — three colours: all different
  { diffs: [4], make: rng => {
    const r = ri(rng, 2, 9), g = ri(rng, 2, 9), b = ri(rng, 2, 9), N = r + g + b, f = prob(6 * r * g * b, N * (N - 1) * (N - 2));
    return fracQ(`A bag holds $${r}$ red, $${g}$ green and $${b}$ blue counters. Three are drawn at random without replacement. Find the probability that all three are **different colours**, as a fraction in simplest form.`, f, {
      hint: 'e.g. 12/55',
      traps: [{ value: r * g * b / (N * (N - 1) * (N - 2)), why: 'The three colours can be drawn in $3! = 6$ different orders; multiply by $6$.' }, { value: 6 * r * g * b / (N * N * N), why: 'Without replacement the denominator shrinks: $' + N + ' \\times ' + (N - 1) + ' \\times ' + (N - 2) + '$.' }],
      hints: ['One counter of each colour, in any order.', `One order has probability $\\dfrac{${r} \\times ${g} \\times ${b}}{${N} \\times ${N - 1} \\times ${N - 2}}$.`, 'There are $6$ orders.'],
      steps: [{ h: 'One order', d: `$\\dfrac{${r * g * b}}{${N * (N - 1) * (N - 2)}}$` }, { h: 'Times 6', d: `$${f.latex()}$` }]
    });
  } },
  // D4 — with replacement: at least one
  { diffs: [4], make: rng => {
    const r = ri(rng, 2, 15), g = ri(rng, 2, 15), N = r + g, n = ri(rng, 2, 3), f = prob(1, 1).sub(prob(Math.pow(g, n), Math.pow(N, n)));
    return fracQ(`A jar holds $${r}$ red and $${g}$ yellow jellybeans. $${n}$ jellybeans are taken one at a time **with replacement**. Find the probability that **at least one** is red, as a fraction in simplest form.`, f, {
      hint: 'e.g. 19/27',
      traps: [{ value: Math.pow(g / N, n), why: 'That is the probability that **none** is red. Subtract it from $1$.' }, { value: n * r / N, why: 'Adding the probabilities double-counts outcomes with more than one red.' }],
      hints: ['Use the complement.', `$P(\\text{no red}) = \\left(\\dfrac{${g}}{${N}}\\right)^{${n}}$.`, 'Subtract from $1$.'],
      steps: [{ h: 'No red', d: `$\\left(\\dfrac{${g}}{${N}}\\right)^{${n}}$` }, { h: 'Complement', d: `$${f.latex()}$` }]
    });
  } },
  // D2 — at least one woman on a committee (complement)
  { diffs: [2], make: rng => {
    const m = ri(rng, 4, 14), w = ri(rng, 3, 14), r = ri(rng, 2, 5), v = nCr(m + w, r) - nCr(m, r);
    return numQ(`A committee of $${r}$ is chosen from $${m}$ men and $${w}$ women. How many committees contain **at least one woman**?`, v, {
      hint: 'e.g. 1200',
      traps: [{ value: nCr(m + w, r), why: 'That counts every committee, including those with no women.' }, { value: nCr(m, r), why: 'That counts the committees with **no** women. Subtract it from the total.' }],
      hints: ['Count all committees, then subtract those with no women.', `All: $ {}^{${m + w}}C_{${r}}$. No women: $ {}^{${m}}C_{${r}}$.`, 'Subtract.'],
      steps: [{ h: 'All', d: `$${nCr(m + w, r)}$` }, { h: 'No women', d: `$${nCr(m, r)}$` }, { h: 'At least one woman', d: `$${v}$` }]
    });
  } },
  // D2 — k particular students must stand together in a line
  { diffs: [2], make: rng => {
    const n = ri(rng, 5, 10), k = ri(rng, 2, 4), v = fact(k) * fact(n - k + 1);
    return numQ(`$${n}$ students stand in a line. $${k}$ particular students must stand together as a group (in any order within the group). In how many ways can the line be arranged?`, v, {
      hint: 'e.g. 1440',
      traps: [{ value: fact(n - k + 1), why: 'The group members can be ordered among themselves in $' + k + '!$ ways.' }, { value: fact(n), why: 'That ignores the condition that the group stays together.' }],
      hints: ['Treat the group as one block.', `There are $${n - k + 1}$ objects to arrange.`, `Multiply by $${k}!$ for the order inside the block.`],
      steps: [{ h: 'Arrange the objects', d: `$${n - k + 1}! = ${fact(n - k + 1)}$` }, { h: 'Order inside the block', d: `$${k}! = ${fact(k)}$` }, { h: 'Total', d: `$${v}$` }]
    });
  } },
  // D3 — P(A | B) from P(A), P(B), P(A or B) given as percentages
  { diffs: [3], make: rng => {
    let a, b, i;
    do { a = ri(rng, 25, 80); b = ri(rng, 25, 80); i = ri(rng, 5, Math.min(a, b) - 5); } while (a + b - i > 98 || i === b);
    const u = a + b - i, f = prob(i, b);
    return fracQ(`For two events, $P(A) = ${a / 100}$, $P(B) = ${b / 100}$ and $P(A \\cup B) = ${u / 100}$. Find $P(A \\mid B)$ as a fraction in simplest form.`, f, {
      hint: 'e.g. 3/8',
      traps: [{ value: i / a, why: 'That divides by $P(A)$, giving $P(B \\mid A)$.' }, { value: i / 100, why: 'That is $P(A \\cap B)$; divide by $P(B)$ to condition.' }],
      hints: ['Use the addition rule to find $P(A \\cap B)$.', `$P(A \\cap B) = ${a / 100} + ${b / 100} - ${u / 100} = ${i / 100}$.`, '$P(A \\mid B) = \\dfrac{P(A \\cap B)}{P(B)}$.'],
      steps: [{ h: 'Intersection', d: `$P(A \\cap B) = ${i / 100}$` }, { h: 'Condition', d: `$\\dfrac{${i / 100}}{${b / 100}} = ${f.latex()}$` }]
    });
  } },
  // D4 — two independent shooters: at least one scores
  { diffs: [4], make: rng => {
    const i = ri(rng, 2, 18), j = ri(rng, 2, 18), pa = prob(i, 20), pb = prob(j, 20), f = prob(1, 1).sub(prob(20 - i, 20).mul(prob(20 - j, 20)));
    return fracQ(`Two players shoot at goal independently. Player 1 scores with probability $${pa.latex()}$ and Player 2 with probability $${pb.latex()}$. Find the probability that **at least one** scores, as a fraction in simplest form.`, f, {
      hint: 'e.g. 91/100',
      traps: [{ value: i / 20 + j / 20, why: 'Adding double-counts the case when both score (and can exceed $1$). Use $P(A) + P(B) - P(A)P(B)$ or the complement.' }, { value: (20 - i) * (20 - j) / 400, why: 'That is the probability that **neither** scores.' }],
      hints: ['Use the complement: $1 - P(\\text{neither})$.', `$P(\\text{neither}) = ${prob(20 - i, 20).latex()} \\times ${prob(20 - j, 20).latex()}$.`, 'Subtract from $1$.'],
      steps: [{ h: 'Neither', d: `$${prob(20 - i, 20).mul(prob(20 - j, 20)).latex()}$` }, { h: 'At least one', d: `$${f.latex()}$` }]
    });
  } },
  // D4 — three draws: all the same colour
  { diffs: [4], make: rng => {
    const r = ri(rng, 3, 8), g = ri(rng, 2, 8), N = r + g, f = prob(r * (r - 1) * (r - 2), N * (N - 1) * (N - 2));
    return fracQ(`A bag holds $${r}$ red and $${g}$ green counters. Three counters are drawn at random **without replacement**. Find the probability that all three are red, as a fraction in simplest form.`, f, {
      hint: 'e.g. 1/10',
      traps: [{ value: Math.pow(r / N, 3), why: 'Without replacement each draw leaves fewer counters, so the numerator and denominator both drop by $1$.' }, { value: 3 * r / N, why: '"And" means multiply, not add.' }],
      hints: ['Multiply the probabilities for each successive draw.', `$\\dfrac{${r}}{${N}} \\times \\dfrac{${r - 1}}{${N - 1}} \\times \\dfrac{${r - 2}}{${N - 2}}$.`, 'Simplify.'],
      steps: [{ h: 'Three draws', d: `$\\dfrac{${r}}{${N}} \\times \\dfrac{${r - 1}}{${N - 1}} \\times \\dfrac{${r - 2}}{${N - 2}}$` }, { h: 'Simplify', d: `$${f.latex()}$` }]
    });
  } }
];

export const forms = {
  'y11-lines': linesForms,
  'y11-diff': diffForms,
  'y11-probability': probForms
};
