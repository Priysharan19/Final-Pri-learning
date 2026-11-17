// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay (slot y910-b)
// Extra structural forms for: y10-polynomials, y10-indices-neg, y10-trig,
// y10-probability, y9-volume-solids, y9-surface-solids, y9-pythagoras,
// y9-variation, y9-surface-area. Every key is computed by code from the same
// numbers printed in the prompt; AI never sets a key. en-AU wording and units.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, lcm, Frac, mcq, r1, r2, rad, poly, bin } from '../qhelpers.js';
import { figRightTriangle } from '../figures.js';

const TR = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];

/** Keep only traps that are finite and genuinely different from the key (outside both tolerance windows). */
const wrong = (key, traps, tol) => traps
  .filter(t => Number.isFinite(t.value) && Math.abs(t.value - key) > 2 * (tol ?? 0) + 1e-6)
  .map(t => (tol != null && t.tol == null ? { ...t, tol } : t));

function N(prompt, value, { tol, suffix, prefix, traps = [], hints, steps, figure, hint } = {}) {
  const p = { prompt, answerType: 'numeric', answer: tol != null ? { value, tol } : { value }, traps: wrong(value, traps, tol), hints, steps };
  if (suffix) p.answerSuffix = suffix;
  if (prefix) p.answerPrefix = prefix;
  if (figure) p.figure = figure;
  if (hint) p.inputHint = hint;
  return p;
}
/** Fraction answer in simplest form (0 < value < 1 or any non-integer). */
function F(prompt, f, { traps = [], hints, steps } = {}) {
  if (f.d === 1) throw new Error('au-forms: integer fraction key');
  return {
    prompt, answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } }, inputHint: 'e.g. 3/8',
    traps: wrong(f.value, traps.map(t => ({ ...t, value: t.f ? t.f.value : t.value })), 0).map(({ f: _f, ...t }) => t), hints, steps
  };
}
function M(rng, prompt, correct, distractors, hints, steps) {
  const m = mcq(rng, correct, distractors);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
const E = (prompt, expr, traps, hints, steps) => ({ prompt, answerType: 'expression', answer: { expr }, answerPrefix: '=', traps, hints, steps });
const tm = (v, s = '') => (v === 0 ? '' : ` ${v < 0 ? '-' : '+'} ${Math.abs(v) === 1 && s ? '' : Math.abs(v)}${s}`);
const phi = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,');

// ── presentation tidy: no bare coefficient 1 / exponent 1, singular units ────
const SING = { seconds: 'second', minutes: 'minute', hours: 'hour', days: 'day', weeks: 'week', years: 'year', metres: 'metre', litres: 'litre', kilometres: 'kilometre' };
export function tidyText(s) {
  return s
    .replace(/(\$1\$|(?<![\d.\w{^_\\]))1(\s+)(seconds|minutes|hours|days|weeks|years|metres|litres|kilometres)\b/g, (m, a, sp, u) => `${a}${sp}${SING[u]}`)
    .replace(/\bA open/g, 'An open')
    .replace(/(?<![\d.A-Za-z{^_\\])1([xtkbyn])(?![A-Za-z])/g, '$1')
    .replace(/([A-Za-z)])\^\{1\}(?!\d)/g, '$1')
    .replace(/([A-Za-z])\^1(?![\d{])/g, '$1')
    .replace(/\(([a-z])\)\^\\circ/g, '$1^\\circ');
}
const SKIP = new Set(['answer', 'figure', 'expr', 'inputHint', 'correctIndex']);
function tidyDeep(v) {
  if (typeof v === 'string') return tidyText(v);
  if (Array.isArray(v)) return v.map(tidyDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = SKIP.has(k) ? v[k] : tidyDeep(v[k]);
    return o;
  }
  return v;
}
const tidyForms = list => list.map(f => ({ ...f, make: (rng, ...rest) => tidyDeep(f.make(rng, ...rest)) }));

const rawForms = {
  // ═══ y9-pythagoras ════════════════════════════════════════════════════════
  'y9-pythagoras': [
    { // rectangle diagonal
      make: (rng) => {
        const w = ri(rng, 6, 60), l = ri(rng, 6, 60), tv = rc(rng, [true, false]), u = tv ? 'cm' : 'm';
        const d = Math.hypot(w, l);
        const body = tv ? `A rectangular TV screen is $${l}$ cm wide and $${w}$ cm high. Find the length of its diagonal`
          : `A rectangular paddock near Dubbo is $${l}$ m long and $${w}$ m wide. A new fence runs along one diagonal. Find the length of the fence`;
        return N(`${body}, correct to 1 decimal place.`, r1(d), {
          tol: 0.06, suffix: u, figure: figRightTriangle({ base: `${l} ${u}`, height: `${w} ${u}`, hyp: `? ${u}` }),
          traps: [{ value: w + l, why: 'The diagonal cuts the corner: use $c^2 = a^2 + b^2$, not the sum of the two sides.' }, { value: w * w + l * l, why: `$${w * w + l * l}$ is $c^2$; take the square root.` }],
          hints: ['The diagonal and the two sides form a right-angled triangle; the diagonal is the hypotenuse.', `$c^2 = ${l}^2 + ${w}^2 = ${l * l + w * w}$.`, `$c = \\sqrt{${l * l + w * w}}$.`],
          steps: [{ h: 'Sum of squares', d: `$c^2 = ${l}^2 + ${w}^2 = ${l * l + w * w}$` }, { h: 'Square root and round', d: `$c = \\sqrt{${l * l + w * w}} \\approx ${r1(d)}$ ${u}` }]
        });
      }
    },
    { // classify a triangle from its sides
      make: (rng) => {
        let a, b, c;
        if (rng() < 0.34) { const m = ri(rng, 1, 6); [a, b, c] = rc(rng, TR).map(v => v * m); }
        else { a = ri(rng, 4, 40); b = ri(rng, 4, 40); c = ri(rng, Math.max(a, b) + 1, a + b - 1); }
        const s = a * a + b * b - c * c;
        const right = 'Right-angled', acute = 'Acute-angled', obtuse = 'Obtuse-angled';
        const key = s === 0 ? right : s > 0 ? acute : obtuse;
        const why = { [right]: 'A right angle needs $a^2 + b^2 = c^2$ exactly.', [acute]: 'If $a^2 + b^2 > c^2$ the largest angle is less than $90^\\circ$.', [obtuse]: 'If $a^2 + b^2 < c^2$ the largest angle is more than $90^\\circ$.' };
        const order = rs(rng, [a, b, c]);
        return M(rng, `A triangle has sides $${order[0]}$ cm, $${order[1]}$ cm and $${order[2]}$ cm. Use Pythagoras' theorem to decide what type of triangle it is.`, key,
          [right, acute, obtuse, 'Cannot be decided without an angle measurement'].filter(t => t !== key).map(t => ({ text: t, why: why[t] || 'The side lengths alone are enough: compare $a^2 + b^2$ with $c^2$.' })),
          ['Find the longest side and square it.', `Compare $${a}^2 + ${b}^2 = ${a * a + b * b}$ with $${c}^2 = ${c * c}$.`, 'Equal: right-angled; sum bigger: acute; sum smaller: obtuse.'],
          [{ h: 'Squares', d: `$${a}^2 + ${b}^2 = ${a * a + b * b}$ and $${c}^2 = ${c * c}$` }, { h: 'Compare', d: `$${a * a + b * b} ${s === 0 ? '=' : s > 0 ? '>' : '<'} ${c * c}$, so the triangle is ${key.toLowerCase()}` }]);
      }
    },
    { // distance between two points
      make: (rng) => {
        let x1, y1, dx, dy;
        do { x1 = ri(rng, -10, 10); y1 = ri(rng, -10, 10); dx = nz(rng, -18, 18); dy = nz(rng, -18, 18); } while (Math.abs(x1 + dx) > 25 || Math.abs(y1 + dy) > 25);
        const x2 = x1 + dx, y2 = y1 + dy, d = Math.hypot(dx, dy);
        return N(`On a bushwalking map (1 unit = 1 km) a lookout is at $A(${x1}, ${y1})$ and a campsite is at $B(${x2}, ${y2})$. Find the straight-line distance $AB$, correct to 1 decimal place.`, r1(d), {
          tol: 0.06, suffix: 'km',
          traps: [{ value: Math.abs(dx) + Math.abs(dy), why: 'Walking along the grid is not the straight-line distance: use $\\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$.' }, { value: dx * dx + dy * dy, why: 'That is $d^2$; take the square root.' }],
          hints: ['Draw a right-angled triangle with the horizontal and vertical differences as its legs.', `$\\Delta x = ${Math.abs(dx)}$ and $\\Delta y = ${Math.abs(dy)}$.`, `$d = \\sqrt{${dx * dx} + ${dy * dy}}$.`],
          steps: [{ h: 'Differences', d: `$\\Delta x = ${x2} - (${x1}) = ${dx}$, $\\Delta y = ${y2} - (${y1}) = ${dy}$` }, { h: 'Pythagoras', d: `$d = \\sqrt{${dx * dx} + ${dy * dy}} = \\sqrt{${dx * dx + dy * dy}} \\approx ${r1(d)}$ km` }]
        });
      }
    },
    { // missing shorter side, one-decimal
      make: (rng) => {
        const c = ri(rng, 10, 80), a = ri(rng, 3, c - 4), b = Math.sqrt(c * c - a * a), k = ri(rng, 0, 2);
        const [body, ask, long] = [
          [`A $${c}$ m ladder leans against a wall with its foot $${a}$ m from the wall on level ground.`, 'How high up the wall does it reach', 'ladder'],
          [`A $${c}$ cm TV screen has a diagonal of $${c}$ cm and a width of $${a}$ cm.`, 'Find the height of the screen', 'diagonal'],
          [`A surf-club flagpole is held by a $${c}$ m stay wire pegged $${a}$ m from the base of the pole on level sand.`, 'How tall is the pole (to the wire attachment)', 'wire']
        ][k];
        const u = k === 1 ? 'cm' : 'm';
        return N(`${k === 1 ? `A TV screen has a diagonal of $${c}$ cm and a width of $${a}$ cm.` : body} ${ask}, correct to 1 decimal place?`, r1(b), {
          tol: 0.06, suffix: u, figure: figRightTriangle({ base: `${a} ${u}`, height: `? ${u}`, hyp: `${c} ${u}` }),
          traps: [{ value: r1(Math.sqrt(c * c + a * a)), why: `The ${long} is the hypotenuse, the longest side: subtract the squares.` }, { value: c - a, why: 'Pythagoras works with squares, not the side lengths themselves.' }],
          hints: ['Sketch the right-angled triangle and mark the hypotenuse.', `$b^2 = ${c}^2 - ${a}^2 = ${c * c - a * a}$.`, `$b = \\sqrt{${c * c - a * a}}$.`],
          steps: [{ h: 'Subtract the squares', d: `$b^2 = ${c}^2 - ${a}^2 = ${c * c - a * a}$` }, { h: 'Square root and round', d: `$b = \\sqrt{${c * c - a * a}} \\approx ${r1(b)}$ ${u}` }]
        });
      }
    },
    { // diagonal of a box (3D)
      diffs: [3, 4],
      make: (rng) => {
        const l = ri(rng, 3, 40), w = ri(rng, 3, 40), h = ri(rng, 3, 40), D = Math.sqrt(l * l + w * w + h * h), face = Math.hypot(l, w);
        const thing = rc(rng, ['shipping crate', 'storage tub', 'toolbox']);
        return N(`The inside of a ${thing} is $${l}$ cm long, $${w}$ cm wide and $${h}$ cm high. What is the length of the longest straight rod that fits inside it (corner to opposite corner), correct to 1 decimal place?`, r1(D), {
          tol: 0.06, suffix: 'cm',
          traps: [{ value: r1(face), why: 'That is the diagonal of the floor only. Use it as one leg of a second right-angled triangle with the height.', tol: 0.06 }, { value: l + w + h, why: 'The space diagonal is $\\sqrt{l^2 + w^2 + h^2}$, shorter than the three edges end to end.' }],
          hints: ['Apply Pythagoras twice: floor diagonal first.', `Floor diagonal$^2 = ${l}^2 + ${w}^2 = ${l * l + w * w}$.`, `$D^2 = ${l * l + w * w} + ${h}^2$.`],
          steps: [{ h: 'Floor diagonal', d: `$d^2 = ${l}^2 + ${w}^2 = ${l * l + w * w}$` }, { h: 'Space diagonal', d: `$D^2 = ${l * l + w * w} + ${h * h} = ${l * l + w * w + h * h}$` }, { h: 'Square root', d: `$D \\approx ${r1(D)}$ cm` }]
        });
      }
    },
    { // out-and-back journey
      diffs: [2, 3, 4],
      make: (rng) => {
        let e1, e2;
        do { e1 = ri(rng, 3, 45); e2 = ri(rng, 3, 45); } while (e1 === e2);
        const n = ri(rng, 3, 45), east = e1 - e2, D = Math.hypot(east, n);
        return N(`A rescue boat leaves Bondi, travels $${e1}$ km due east, then $${n}$ km due north, then $${e2}$ km due west. How far is it, in a straight line, from where it started? Give your answer correct to 1 decimal place.`, r1(D), {
          tol: 0.06, suffix: 'km',
          traps: [{ value: r1(Math.hypot(e1 + e2, n)), why: 'The westward leg undoes part of the eastward leg: the net east displacement is the difference.' }, { value: e1 + n + e2, why: 'The straight-line distance is the hypotenuse of a right-angled triangle, not the total distance travelled.' }],
          hints: ['Work out the net east-west displacement first.', `Net: $${e1} - ${e2} = ${east}$ km (${east > 0 ? 'east' : 'west'}).`, `$d^2 = ${east * east} + ${n * n}$.`],
          steps: [{ h: 'Net east-west', d: `$${e1} - ${e2} = ${east}$, so ${Math.abs(east)} km ${east > 0 ? 'east' : 'west'}` }, { h: 'Pythagoras', d: `$d = \\sqrt{${east * east} + ${n * n}} \\approx ${r1(D)}$ km` }]
        });
      }
    }
  ],

  // ═══ y9-surface-area ═══════════════════════════════════════════════════════
  'y9-surface-area': [
    { // open-top tank
      make: (rng) => {
        const l = ri(rng, 20, 120), w = ri(rng, 20, 120), h = ri(rng, 10, 80), A = l * w + 2 * h * (l + w);
        return N(`A glass fish tank has no lid. It is $${l}$ cm long, $${w}$ cm wide and $${h}$ cm high. Find the area of glass needed to make it, in cm².`, A, {
          suffix: 'cm²', traps: [{ value: 2 * (l * w + l * h + w * h), why: 'The tank is open: there is no top face, so only one $l\\times w$ rectangle.' }, { value: l * w * h, why: 'That is the volume. Surface area adds the face areas.' }],
          hints: ['List the faces: one base and four sides.', `Base $${l}\\times ${w} = ${l * w}$; sides $2(${l}\\times ${h}) + 2(${w}\\times ${h})$.`, 'Add them.'],
          steps: [{ h: 'Base', d: `$${l}\\times ${w} = ${l * w}$` }, { h: 'Four sides', d: `$2(${l * h}) + 2(${w * h}) = ${2 * h * (l + w)}$` }, { h: 'Total', d: `$${l * w} + ${2 * h * (l + w)} = ${A}$ cm²` }]
        });
      }
    },
    { // cube reverse
      make: (rng) => {
        const s = ri(rng, 2, 40), SA = 6 * s * s, ask = rc(rng, ['edge', 'volume']);
        const key = ask === 'edge' ? s : s ** 3;
        return N(`A cube has a total surface area of $${phi(SA)}$ cm². Find its ${ask === 'edge' ? 'edge length, in cm' : 'volume, in cm³'}.`, key, {
          suffix: ask === 'edge' ? 'cm' : 'cm³',
          traps: [{ value: SA / 6, why: `$${SA / 6}$ is the area of one face ($s^2$). Take the square root to get the edge.` }, { value: r2(Math.sqrt(SA / 4)), why: 'A cube has six faces, so divide by 6, not 4.', tol: 0.01 }],
          hints: ['A cube has 6 equal square faces.', `One face: $${SA}\\div 6 = ${s * s}$ cm².`, ask === 'edge' ? 'The edge is the square root of one face.' : `Edge $= ${s}$, then cube it.`],
          steps: [{ h: 'One face', d: `$${SA}\\div 6 = ${s * s}$ cm²` }, { h: 'Edge', d: `$s = \\sqrt{${s * s}} = ${s}$ cm` }, ...(ask === 'edge' ? [] : [{ h: 'Volume', d: `$${s}^3 = ${s ** 3}$ cm³` }])]
        });
      }
    },
    { // triangular prism, Pythagoras for the hypotenuse
      make: (rng) => {
        const [x, y, z] = rc(rng, TR.slice(0, 4)), m = ri(rng, 1, 8), L = ri(rng, 5, 40), sw = rc(rng, [true, false]);
        const a = (sw ? y : x) * m, b = (sw ? x : y) * m, c = z * m, A = a * b + L * (a + b + c);
        return N(`A tent is a triangular prism $${L}$ dm long. Its triangular ends are right-angled with perpendicular sides $${a}$ dm and $${b}$ dm. Find the total surface area of the tent, including the floor and both ends, in dm².`, A, {
          suffix: 'dm²', traps: [{ value: a * b + L * (a + b), why: 'The sloping face (the hypotenuse side) is a rectangle too: find the hypotenuse by Pythagoras.' }, { value: a * b / 2 + L * (a + b + c), why: 'There are two triangular ends: together they have area $2\\times\\tfrac12 ab = ab$.' }],
          hints: ['Find the hypotenuse of the end triangle first.', `$c = \\sqrt{${a}^2 + ${b}^2} = ${c}$.`, `Two ends: $${a * b}$; three rectangles: $${L}\\times(${a} + ${b} + ${c})$.`],
          steps: [{ h: 'Hypotenuse', d: `$c = \\sqrt{${a * a} + ${b * b}} = ${c}$` }, { h: 'Two ends', d: `$2\\times\\tfrac12\\times ${a}\\times ${b} = ${a * b}$` }, { h: 'Three rectangles', d: `$${L}\\times(${a} + ${b} + ${c}) = ${L * (a + b + c)}$` }, { h: 'Total', d: `$${a * b} + ${L * (a + b + c)} = ${A}$ dm²` }]
        });
      }
    },
    { // curved label from a diameter
      make: (rng) => {
        const d = ri(rng, 4, 30), h = ri(rng, 5, 40), A = Math.PI * d * h;
        return N(`A can of tomatoes has a diameter of $${d}$ cm and a height of $${h}$ cm. The paper label covers the whole curved surface (no overlap). Find the area of the label, to the nearest cm².`, Math.round(A), {
          tol: 0.51, suffix: 'cm²',
          traps: [{ value: Math.round(2 * Math.PI * d * h), why: 'The measurement given is the diameter, not the radius: $C = \\pi d$ already.', tol: 0.51 }, { value: Math.round(Math.PI * d * d / 4 * 2 + A), why: 'The label covers the curved surface only, not the circular ends.', tol: 0.51 }],
          hints: ['Unrolled, the label is a rectangle: circumference by height.', `Circumference $= \\pi\\times ${d}$.`, `Area $= \\pi\\times ${d}\\times ${h}$.`],
          steps: [{ h: 'Circumference', d: `$C = \\pi d = ${(Math.PI * d).toFixed(2)}$ cm` }, { h: 'Area', d: `$${(Math.PI * d).toFixed(2)}\\times ${h} \\approx ${Math.round(A)}$ cm²` }]
        });
      }
    },
    { // walls of a room to paint
      diffs: [2, 3, 4],
      make: (rng) => {
        const l = ri(rng, 3, 9), w = ri(rng, 3, 8), h = rc(rng, [2.4, 2.5, 2.7, 3]), dw = rc(rng, [0.8, 0.9, 1]), ww = rc(rng, [1, 1.2, 1.5, 1.8]), wh = rc(rng, [1, 1.2]);
        const walls = 2 * h * (l + w), door = 2 * dw, win = ww * wh, A = r2(walls - door - win);
        return N(`A bedroom is $${l}$ m by $${w}$ m with walls $${h}$ m high. It has one door $${dw}$ m wide by $2$ m high and one window $${ww}$ m wide by $${wh}$ m high. The four walls are to be painted (not the ceiling or floor, and not the door or window). Find the area to be painted, in m².`, A, {
          tol: 0.005, suffix: 'm²',
          traps: [{ value: r2(walls), why: 'Subtract the areas of the door and the window.' }, { value: r2(l * w + walls - door - win), why: 'The floor is not being painted: only the four walls.' }],
          hints: ['Four walls make a rectangle of height $h$ and length equal to the perimeter.', `Walls: $2\\times${h}\\times(${l} + ${w}) = ${r2(walls)}$.`, `Take away the door ($${r2(door)}$) and window ($${r2(win)}$).`],
          steps: [{ h: 'Walls', d: `$2\\times ${h}\\times ${l + w} = ${r2(walls)}$ m²` }, { h: 'Openings', d: `$${dw}\\times 2 = ${r2(door)}$ and $${ww}\\times ${wh} = ${r2(win)}$` }, { h: 'Paint area', d: `$${r2(walls)} - ${r2(door)} - ${r2(win)} = ${A}$ m²` }]
        });
      }
    },
    { // which box has greatest surface area
      make: (rng) => {
        const sa = d => 2 * (d[0] * d[1] + d[0] * d[2] + d[1] * d[2]);
        let boxes, areas, best;
        for (let t = 0; t < 400; t++) {
          boxes = Array.from({ length: 4 }, () => [ri(rng, 2, 16), ri(rng, 2, 16), ri(rng, 2, 16)]);
          areas = boxes.map(sa);
          const mx = Math.max(...areas);
          best = areas.indexOf(mx);
          if (areas.filter(v => v === mx).length === 1 && new Set(boxes.map(b => b.slice().sort().join())).size === 4) break;
        }
        const txt = d => `$${d[0]}\\times ${d[1]}\\times ${d[2]}$ cm`;
        const bigV = boxes.map(d => d[0] * d[1] * d[2]);
        const vmax = bigV.indexOf(Math.max(...bigV));
        const why = i => (i === vmax ? 'This has the largest volume, but volume and surface area are different measures.' : 'Work out $2(lw + lh + wh)$ for each box and compare.');
        return M(rng, `Four closed boxes have these dimensions: ${boxes.map(txt).join('; ')}. Which box has the greatest total surface area?`, txt(boxes[best]),
          boxes.map((d, i) => ({ text: txt(d), why: why(i) })).filter((_, i) => i !== best),
          ['Find $2(lw + lh + wh)$ for each box.', `Surface areas (in order): ${areas.join(', ')} cm².`, 'Choose the largest.'],
          [{ h: 'Surface areas', d: boxes.map((d, i) => `${d[0]}×${d[1]}×${d[2]}: ${areas[i]}`).join('; ') }, { h: 'Greatest', d: `${areas[best]} cm² belongs to the box ${boxes[best].join(' × ')}` }]);
      }
    }
  ],

  // ═══ y9-surface-solids (coefficient of π) ═════════════════════════════════
  'y9-surface-solids': [
    { // sphere reverse
      make: (rng) => {
        const r = ri(rng, 2, 60), k = 4 * r * r;
        return N(`A sphere has a surface area of $${phi(k)}\\pi$ cm². Find its radius, in cm.`, r, {
          suffix: 'cm', traps: [{ value: r * r, why: `$${r * r}$ is $r^2$; take the square root.` }, { value: 2 * r, why: 'Divide by 4 before taking the square root: $4\\pi r^2 = k\\pi$ gives $r^2 = k/4$.' }],
          hints: ['Set $4\\pi r^2 = k\\pi$.', `$r^2 = ${k}\\div 4 = ${r * r}$.`, 'Take the positive square root.'],
          steps: [{ h: 'Equate', d: `$4\\pi r^2 = ${k}\\pi \\Rightarrow r^2 = ${r * r}$` }, { h: 'Root', d: `$r = ${r}$ cm` }]
        });
      }
    },
    { // solid hemisphere
      make: (rng) => {
        const r = ri(rng, 2, 90), total = rc(rng, [true, false]), k = total ? 3 * r * r : 2 * r * r;
        return N(`A solid hemisphere has radius $${r}$ cm. Its ${total ? 'total surface area (curved surface and flat circular base)' : 'curved surface area'} is $k\\pi$ cm². Find $k$.`, k, {
          traps: [{ value: total ? 2 * r * r : 4 * r * r, why: total ? 'The flat circular base, $\\pi r^2$, must be added to the curved part, $2\\pi r^2$.' : 'A hemisphere is half a sphere: the curved surface is $2\\pi r^2$, not $4\\pi r^2$.' }, { value: total ? 4 * r * r : r * r, why: total ? 'Half of $4\\pi r^2$ plus the base: $2\\pi r^2 + \\pi r^2$.' : 'Curved surface $=\\tfrac12\\times 4\\pi r^2$.' }],
          hints: ['Half a sphere has half of $4\\pi r^2$ on its curved surface.', `Curved: $2\\pi r^2 = ${2 * r * r}\\pi$.`, total ? `Base: $\\pi r^2 = ${r * r}\\pi$.` : 'That is the whole answer.'],
          steps: [{ h: 'Curved surface', d: `$2\\pi(${r})^2 = ${2 * r * r}\\pi$` }, ...(total ? [{ h: 'Add the base', d: `$${2 * r * r}\\pi + ${r * r}\\pi = ${k}\\pi$` }] : [])]
        });
      }
    },
    { // cylinder, closed or open
      make: (rng) => {
        const r = ri(rng, 2, 45), h = ri(rng, 2, 70), closed = rc(rng, [true, false]), k = (closed ? 2 : 1) * r * r + 2 * r * h;
        return N(`A ${closed ? 'closed' : 'open-topped'} cylinder has radius $${r}$ cm and height $${h}$ cm. Its total surface area is $k\\pi$ cm². Find $k$.`, k, {
          traps: [{ value: 2 * r * h, why: 'That is only the curved surface; add the circular end(s).' }, { value: closed ? r * r + 2 * r * h : 2 * r * r + 2 * r * h, why: closed ? 'A closed cylinder has two circular ends.' : 'An open-topped cylinder has just one circular end (the base).' }],
          hints: [`Curved surface: $2\\pi r h = ${2 * r * h}\\pi$.`, closed ? `Two ends: $2\\pi r^2 = ${2 * r * r}\\pi$.` : `One end: $\\pi r^2 = ${r * r}\\pi$.`, 'Add the parts.'],
          steps: [{ h: 'Curved', d: `$2\\pi(${r})(${h}) = ${2 * r * h}\\pi$` }, { h: 'Ends', d: `$${closed ? 2 * r * r : r * r}\\pi$` }, { h: 'Total', d: `$k = ${k}$` }]
        });
      }
    },
    { // cone from the perpendicular height
      make: (rng) => {
        const [x, y, z] = rc(rng, TR.slice(0, 4)), m = ri(rng, 1, 25), sw = rc(rng, [true, false]), tot = rc(rng, [true, false]);
        const r = (sw ? y : x) * m, h = (sw ? x : y) * m, l = z * m, k = tot ? r * r + r * l : r * l;
        return N(`A cone has base radius $${r}$ cm and perpendicular height $${h}$ cm. Its ${tot ? 'total surface area (including the base)' : 'curved surface area'} is $k\\pi$ cm². Find $k$.`, k, {
          traps: [{ value: r * h, why: 'The curved surface uses the slant height $l$, not the perpendicular height.' }, { value: tot ? r * l : r * r + r * l, why: tot ? 'Add the circular base, $\\pi r^2$.' : 'Only the curved surface is asked: no base.' }],
          hints: ['Find the slant height from the right-angled triangle.', `$l = \\sqrt{${r}^2 + ${h}^2} = ${l}$.`, tot ? '$A = \\pi r^2 + \\pi r l$.' : '$A = \\pi r l$.'],
          steps: [{ h: 'Slant height', d: `$l = \\sqrt{${r * r} + ${h * h}} = ${l}$` }, { h: 'Area', d: tot ? `$${r * r}\\pi + ${r * l}\\pi = ${k}\\pi$` : `$\\pi(${r})(${l}) = ${k}\\pi$` }]
        });
      }
    },
    { // square pyramid from the vertical height
      make: (rng) => {
        const [x, y, z] = rc(rng, TR.slice(0, 4)), m = ri(rng, 1, 25), sw = rc(rng, [true, false]);
        const half = (sw ? y : x) * m, h = (sw ? x : y) * m, l = z * m, s = 2 * half, A = s * s + 2 * s * l;
        return N(`A square pyramid has a base of side $${s}$ cm and a perpendicular height of $${h}$ cm. Find its total surface area, in cm².`, A, {
          suffix: 'cm²', traps: [{ value: s * s + 2 * s * h, why: 'The triangular faces use the slant height, not the perpendicular height.' }, { value: s * s + s * l, why: 'There are four triangular faces: $4\\times\\tfrac12 s l = 2sl$.' }],
          hints: ['The slant height joins the apex to the midpoint of a base edge.', `$l = \\sqrt{${half}^2 + ${h}^2} = ${l}$.`, `Total: $${s}^2 + 2(${s})(${l})$.`],
          steps: [{ h: 'Slant height', d: `$l = \\sqrt{${half * half} + ${h * h}} = ${l}$` }, { h: 'Faces', d: `base $${s * s}$ + four triangles $${2 * s * l}$` }, { h: 'Total', d: `$${A}$ cm²` }]
        });
      }
    },
    { // silo: cylinder + hemispherical dome, outside curved surface
      make: (rng) => {
        const r = ri(rng, 2, 35), h = ri(rng, 3, 60), k = 2 * r * h + 2 * r * r;
        return N(`A grain silo is a cylinder of radius $${r}$ m and wall height $${h}$ m, topped by a hemispherical dome of the same radius. The outside curved surface (not the base on the ground) is $k\\pi$ m². Find $k$.`, k, {
          traps: [{ value: 2 * r * h + r * r, why: 'The dome is a half-sphere with curved area $2\\pi r^2$, not $\\pi r^2$.' }, { value: 2 * r * h + 2 * r * r + r * r, why: 'The base sits on the ground and the join between dome and wall is not a surface: do not add a circle.' }],
          hints: ['Add the curved wall and the curved dome.', `Wall: $2\\pi r h = ${2 * r * h}\\pi$.`, `Dome: $2\\pi r^2 = ${2 * r * r}\\pi$.`],
          steps: [{ h: 'Wall', d: `$2\\pi(${r})(${h}) = ${2 * r * h}\\pi$` }, { h: 'Dome', d: `$2\\pi(${r})^2 = ${2 * r * r}\\pi$` }, { h: 'Total', d: `$k = ${k}$` }]
        });
      }
    },
    { // MCQ: which expression is the closed-cylinder surface area
      make: (rng) => {
        const r = ri(rng, 2, 30), h = ri(rng, 2, 40), kk = (2 * r * r + 2 * r * h);
        const t = v => `$${phi(v)}\\pi$ cm²`;
        return M(rng, `Which is the total surface area of a closed cylinder with radius $${r}$ cm and height $${h}$ cm?`, t(kk), [
          { text: t(r * r + 2 * r * h), why: 'This counts only one circular end; a closed cylinder has two.' },
          { text: t(2 * r * h), why: 'This is only the curved surface.' },
          { text: t(2 * r * r * h), why: 'This multiplies the radius squared by the height, a volume-like expression.' }
        ], ['Two circular ends and one curved rectangle.', `Ends: $2\\pi r^2 = ${2 * r * r}\\pi$.`, `Curved: $2\\pi r h = ${2 * r * h}\\pi$.`], [{ h: 'Add', d: `$${2 * r * r}\\pi + ${2 * r * h}\\pi = ${kk}\\pi$ cm²` }]);
      }
    }
  ],

  // ═══ y9-volume-solids ═════════════════════════════════════════════════════
  'y9-volume-solids': [
    { // cylinder coefficient
      make: (rng) => {
        const r = ri(rng, 2, 30), h = ri(rng, 2, 40);
        return N(`A cylindrical water tank has radius $${r}$ cm and height $${h}$ cm. Its volume is $k\\pi$ cm³. Find $k$.`, r * r * h, {
          traps: [{ value: r * h, why: 'The radius is squared: $V = \\pi r^2 h$.' }, { value: 2 * r * h, why: 'That is part of the curved surface area, not the volume.' }],
          hints: ['$V = \\pi r^2 h$.', `$r^2 = ${r * r}$.`, `$${r * r}\\times ${h}$.`],
          steps: [{ h: 'Formula', d: `$V = \\pi(${r})^2(${h}) = ${r * r * h}\\pi$` }]
        });
      }
    },
    { // cone reverse: find height
      make: (rng) => {
        const r = ri(rng, 2, 15), t = ri(rng, 1, 20), h = 3 * t, k = r * r * t;
        return N(`A cone has base radius $${r}$ cm and volume $${phi(k)}\\pi$ cm³. Find its perpendicular height, in cm.`, h, {
          suffix: 'cm', traps: [{ value: t, why: 'A cone is one third of a cylinder: $V = \\tfrac13\\pi r^2 h$, so $h = 3V/(\\pi r^2)$.' }, { value: 3 * k, why: 'Divide by $r^2$ after multiplying by 3.' }],
          hints: ['$V = \\tfrac13\\pi r^2 h$, so $h = \\dfrac{3V}{\\pi r^2}$.', `$3\\times ${k} = ${3 * k}$.`, `Divide by $r^2 = ${r * r}$.`],
          steps: [{ h: 'Rearrange', d: `$h = \\dfrac{3\\times ${k}}{${r}^2} = \\dfrac{${3 * k}}{${r * r}}$` }, { h: 'Evaluate', d: `$h = ${h}$ cm` }]
        });
      }
    },
    { // sphere / hemisphere reverse
      make: (rng) => {
        const n = ri(rng, 1, 9), r = 3 * n, hemi = rc(rng, [true, false]), k = (hemi ? 2 : 4) * r ** 3 / 3;
        return N(`A solid ${hemi ? 'hemisphere' : 'sphere'} has volume $${phi(k)}\\pi$ cm³. Find its radius, in cm.`, r, {
          suffix: 'cm', traps: [{ value: r ** 3, why: `$${r ** 3}$ is $r^3$; take the cube root.` }, { value: Math.round(Math.cbrt(k)), why: hemi ? 'Multiply by $\\tfrac32$ first: $\\tfrac23 r^3 = k$.' : 'Multiply by $\\tfrac34$ first: $\\tfrac43 r^3 = k$.' }],
          hints: [hemi ? '$V = \\tfrac23\\pi r^3$.' : '$V = \\tfrac43\\pi r^3$.', `$r^3 = ${k}\\times ${hemi ? '\\tfrac32' : '\\tfrac34'} = ${r ** 3}$.`, 'Take the cube root.'],
          steps: [{ h: 'Rearrange', d: `$r^3 = ${r ** 3}$` }, { h: 'Cube root', d: `$r = ${r}$ cm` }]
        });
      }
    },
    { // cylinder with a hemispherical cap
      make: (rng) => {
        const r = 3 * ri(rng, 1, 8), h = ri(rng, 3, 30), k = r * r * h + 2 * r ** 3 / 3;
        return N(`A storage silo is a cylinder of radius $${r}$ m and wall height $${h}$ m with a hemispherical top of the same radius. Its total volume is $k\\pi$ m³. Find $k$.`, k, {
          traps: [{ value: r * r * h + 4 * r ** 3 / 3, why: 'The top is a hemisphere, half a sphere: $\\tfrac23\\pi r^3$.' }, { value: r * r * h, why: 'Add the volume of the hemispherical top.' }],
          hints: ['Add the cylinder and the hemisphere.', `Cylinder: $r^2 h = ${r * r * h}$.`, `Hemisphere: $\\tfrac23 r^3 = ${2 * r ** 3 / 3}$.`],
          steps: [{ h: 'Cylinder', d: `$\\pi(${r})^2(${h}) = ${r * r * h}\\pi$` }, { h: 'Hemisphere', d: `$\\tfrac23\\pi(${r})^3 = ${2 * r ** 3 / 3}\\pi$` }, { h: 'Total', d: `$k = ${k}$` }]
        });
      }
    },
    { // rectangular-based pyramid
      make: (rng) => {
        let l, w, h;
        do { l = ri(rng, 3, 25); w = ri(rng, 3, 25); h = ri(rng, 3, 30); } while ((l * w * h) % 3 !== 0);
        const V = l * w * h / 3;
        return N(`A glass pyramid at a Sydney museum has a rectangular base $${l}$ m by $${w}$ m and a perpendicular height of $${h}$ m. Find its volume, in m³.`, V, {
          suffix: 'm³', traps: [{ value: l * w * h, why: 'A pyramid is one third of the prism with the same base and height.' }, { value: l * w * h / 2, why: 'Pyramids take one third, not one half.' }],
          hints: ['$V = \\tfrac13\\times\\text{base area}\\times\\text{height}$.', `Base area $= ${l}\\times ${w} = ${l * w}$.`, `$${l * w}\\times ${h}\\div 3$.`],
          steps: [{ h: 'Base area', d: `$${l}\\times ${w} = ${l * w}$` }, { h: 'Volume', d: `$\\tfrac13\\times ${l * w}\\times ${h} = ${V}$ m³` }]
        });
      }
    },
    { // capacity in litres from a diameter
      make: (rng) => {
        const d = ri(rng, 10, 120), h = ri(rng, 20, 150), V = Math.PI * (d / 2) ** 2 * h / 1000;
        return N(`A cylindrical rainwater tank has an internal diameter of $${d}$ cm and is filled to a depth of $${h}$ cm. How many litres of water does it hold, correct to 1 decimal place? ($1\\text{ L} = 1000\\text{ cm}^3$)`, r1(V), {
          tol: 0.06, suffix: 'L',
          traps: [{ value: r1(Math.PI * d * d * h / 1000), why: 'The given measure is the diameter: halve it to get the radius before squaring.', tol: 0.06 }, { value: r1(V * 1000), why: 'Convert cm³ to litres by dividing by 1000.', tol: 0.06 }],
          hints: ['Radius is half the diameter.', `$V = \\pi(${d / 2})^2(${h})$ cm³.`, 'Divide by 1000 to convert to litres.'],
          steps: [{ h: 'Volume in cm³', d: `$V = \\pi(${d / 2})^2(${h}) \\approx ${r1(V * 1000)}$ cm³` }, { h: 'Convert', d: `$\\div 1000 \\approx ${r1(V)}$ L` }]
        });
      }
    },
    { // cone vs cylinder comparison
      make: (rng) => {
        const t = ri(rng, 10, 400), cone = rc(rng, [true, false]);
        const given = cone ? t : 3 * t, key = cone ? 3 * t : t;
        return N(cone
          ? `A paper cone cup and a cylindrical tub have the same base and the same height. The cone holds $${given}$ mL. How much does the tub hold, in mL?`
          : `A cylindrical tub and a cone-shaped cup have the same base and the same height. The tub holds $${given}$ mL. How much does the cup hold, in mL?`, key, {
          suffix: 'mL', traps: [{ value: cone ? given / 3 : 3 * given, why: 'A cone is one third of the cylinder with the same base and height.' }, { value: cone ? 2 * given : given / 2, why: 'The ratio is 1 : 3, not 1 : 2.' }],
          hints: ['Cone volume = one third of the cylinder volume.', cone ? 'So the cylinder is three times the cone.' : 'So the cone is one third of the cylinder.', cone ? `$${given}\\times 3$.` : `$${given}\\div 3$.`],
          steps: [{ h: 'Use the 1 : 3 ratio', d: cone ? `$${given}\\times 3 = ${key}$ mL` : `$${given}\\div 3 = ${key}$ mL` }]
        });
      }
    }
  ],

  // ═══ y9-variation ═════════════════════════════════════════════════════════
  'y9-variation': [
    { // direct, cost
      make: (rng) => {
        const x1 = ri(rng, 2, 12); let x2; do { x2 = ri(rng, 3, 40); } while (x2 === x1);
        const k = ri(rng, 2, 45), it = rc(rng, [['mangoes', 'kg'], ['prawns', 'kg'], ['petrol', 'L'], ['fabric', 'm'], ['sand', 'tonnes']]);
        return N(`The cost of ${it[0]} varies directly with the amount bought. ${x1} ${it[1]} cost \\$${k * x1}. Find the cost of ${x2} ${it[1]}, in dollars.`, k * x2, {
          prefix: '$', traps: [{ value: k * x1 + (x2 - x1), why: 'Direct variation is multiplicative: find the cost of one unit, then multiply.' }, { value: r2((k * x1) / x2), why: 'Divide to find the unit cost first, then multiply by the new amount.' }],
          hints: ['Find the cost of one unit first.', `\\$${k * x1} divided by ${x1} gives \\$${k} per ${it[1]}.`, `Multiply by ${x2}.`],
          steps: [{ h: 'Unit cost', d: `$${k * x1}\\div ${x1} = ${k}$ dollars per ${it[1]}` }, { h: 'New cost', d: `$${k}\\times ${x2} = ${k * x2}$ dollars` }]
        });
      }
    },
    { // direct, find the input
      make: (rng) => {
        const x1 = ri(rng, 2, 12), k = ri(rng, 3, 40); let x2; do { x2 = ri(rng, 3, 60); } while (x2 === x1);
        return N(`A casual worker's pay varies directly with the hours worked. For ${x1} hours the pay is \\$${k * x1}. How many hours must be worked to earn \\$${k * x2}?`, x2, {
          suffix: 'hours', traps: [{ value: k * x2 - k * x1 + x1, why: 'Use the hourly rate: hours $=$ pay $\\div$ rate.' }, { value: r2(x1 * x1 / x2), why: 'This is the inverse relationship. Pay and hours grow together here.' }],
          hints: ['Find the hourly rate first.', `Rate $= ${k * x1}\\div ${x1} = ${k}$ dollars per hour.`, `Hours $= ${k * x2}\\div ${k}$.`],
          steps: [{ h: 'Rate', d: `$k = ${k}$` }, { h: 'Hours', d: `$${k * x2}\\div ${k} = ${x2}$` }]
        });
      }
    },
    { // inverse, workers/pumps (constant is a common multiple)
      diffs: [2, 3, 4],
      make: (rng) => {
        let x1, x2; do { x1 = ri(rng, 2, 12); x2 = ri(rng, 2, 12); } while (x1 === x2);
        const c = lcm(x1, x2) * ri(rng, 1, 6), y1 = c / x1, y2 = c / x2, ctx = rc(rng, [0, 1]);
        const q = ctx ? `${x1} identical pumps empty a flooded car park in ${y1} minutes. The time taken varies inversely with the number of pumps. How many minutes would ${x2} pumps take?`
          : `${x1} volunteers can pack a pallet of food parcels in ${y1} hours. The time varies inversely with the number of volunteers. How many hours would ${x2} volunteers take?`;
        return N(q, y2, {
          suffix: ctx ? 'minutes' : 'hours', traps: [{ value: r2(y1 * x2 / x1), why: 'More workers means less time: the product (workers $\\times$ time) stays constant.' }, { value: y1 + x2 - x1, why: 'Inverse variation is not additive: use $xy = k$.' }],
          hints: ['Inverse variation: $xy = k$ is constant.', `$k = ${x1}\\times ${y1} = ${c}$.`, `Time $= ${c}\\div ${x2}$.`],
          steps: [{ h: 'Constant', d: `$k = ${x1}\\times ${y1} = ${c}$` }, { h: 'New time', d: `$${c}\\div ${x2} = ${y2}$` }]
        });
      }
    },
    { // MCQ choose the equation
      make: (rng) => {
        const type = rc(rng, ['direct', 'inverse', 'square']);
        const x = ri(rng, 2, 6), k = ri(rng, 2, 9);
        let y, correct, ds, stmt;
        if (type === 'direct') { y = k * x; stmt = 'varies directly with $x$'; correct = `$y = ${k}x$`; ds = [[`$y = \\dfrac{${y * x}}{x}$`, 'This is inverse variation ($xy$ constant).'], [`$y = ${y}x$`, 'The constant is $y\\div x$, not $y$ itself.'], [`$y = x + ${y - x}$`, 'Variation is multiplicative, not additive.']]; }
        else if (type === 'inverse') { y = k * ri(rng, 1, 8); const c = x * y; correct = `$y = \\dfrac{${c}}{x}$`; stmt = 'varies inversely with $x$'; ds = [[`$y = ${y / x}x$`, 'This is direct variation; here $xy$ is constant.'], [`$y = ${c}x$`, 'The constant $k = xy$ belongs in the numerator: $y = k/x$.'], [`$y = ${x + y} - x$`, 'Inverse variation is a product, not a sum, that stays constant.']]; }
        else { y = k * x * x; correct = `$y = ${k}x^2$`; stmt = 'varies directly with the square of $x$'; ds = [[`$y = ${k * x}x$`, 'That fits the point but is only direct variation, not $y = kx^2$.'], [`$y = ${k}x$`, 'The square of $x$ is missing, and $k$ is wrong for that.'], [`$y = ${y}x^2$`, 'The constant is $y\\div x^2$.']]; }
        const cd = type === 'inverse' ? x * y : k;
        return M(rng, `$y$ ${stmt}. When $x = ${x}$, $y = ${y}$. Which equation connects $x$ and $y$?`, correct, ds.map(([text, why]) => ({ text, why })),
          [type === 'direct' ? 'Direct: $y = kx$ with $k = y\\div x$.' : type === 'inverse' ? 'Inverse: $y = k/x$ with $k = xy$.' : 'Direct square: $y = kx^2$ with $k = y\\div x^2$.', `Substitute $x = ${x}$, $y = ${y}$.`, 'Check the point fits your equation.'],
          [{ h: 'Find the constant', d: type === 'direct' ? `$k = ${y}\\div ${x} = ${k}$` : type === 'inverse' ? `$k = ${x}\\times ${y} = ${cd}$` : `$k = ${y}\\div ${x * x} = ${k}$` }, { h: 'Write the equation', d: correct }]);
      }
    },
    { // y = kx^2 reverse / y = k/x^2
      diffs: [3, 4],
      make: (rng) => {
        if (rng() < 0.5) {
          const x1 = ri(rng, 2, 6), x2 = ri(rng, 2, 9), k = ri(rng, 2, 9);
          if (x1 === x2) return forms['y9-variation'][4].make(rng);
          return N(`$y$ varies directly with the square of $x$. When $x = ${x1}$, $y = ${k * x1 * x1}$. Find the positive value of $x$ when $y = ${k * x2 * x2}$.`, x2, {
            traps: [{ value: r2(k * x2 * x2 * x1 / (k * x1 * x1)), why: 'This treats $y$ as directly proportional to $x$. Here $y = kx^2$, so take a square root at the end.' }],
            hints: ['Write $y = kx^2$ and find $k$.', `$k = ${k * x1 * x1}\\div ${x1 * x1} = ${k}$.`, `$x^2 = ${k * x2 * x2}\\div ${k}$, then take the square root.`],
            steps: [{ h: 'Constant', d: `$k = ${k}$` }, { h: 'Solve', d: `$x^2 = ${x2 * x2} \\Rightarrow x = ${x2}$` }]
          });
        }
        const x2 = ri(rng, 1, 4), t = ri(rng, 2, 4), x1 = x2 * t, y1 = ri(rng, 1, 9), kk = y1 * x1 * x1, y2 = y1 * t * t;
        return N(`$y$ varies inversely with the square of $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`, y2, {
          traps: [{ value: y1 * t, why: 'Inverse square: halving $x$ multiplies $y$ by four, not two. Use $y = k/x^2$.' }, { value: r2(y1 * x2 * x2 / (x1 * x1)), why: 'This is the direct-square relationship. For inverse square, $x^2 y$ is constant.' }],
          hints: ['Write $y = \\dfrac{k}{x^2}$, so $k = x^2 y$.', `$k = ${x1 * x1}\\times ${y1} = ${kk}$.`, `$y = ${kk}\\div ${x2 * x2}$.`],
          steps: [{ h: 'Constant', d: `$k = ${x1}^2\\times ${y1} = ${kk}$` }, { h: 'New y', d: `$y = \\dfrac{${kk}}{${x2 * x2}} = ${y2}$` }]
        });
      }
    },
    { // table of values
      make: (rng) => {
        const direct = rc(rng, [true, false]);
        let xs, k, ys;
        if (direct) {
          xs = rs(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]).slice(0, 3); k = ri(rng, 2, 15);
          ys = xs.map(x => k * x);
        } else {
          xs = rs(rng, [1, 2, 3, 4, 5, 6, 8, 10, 12]).slice(0, 3); k = lcm(lcm(xs[0], xs[1]), xs[2]) * ri(rng, 1, 5);
          ys = xs.map(x => k / x);
        }
        return N(`The table shows pairs of values $(x, y)$ that are related by either direct or inverse variation: $(${xs[0]}, ${ys[0]})$, $(${xs[1]}, ${ys[1]})$ and $(${xs[2]}, ?)$. Find the missing value of $y$.`, ys[2], {
          traps: [{ value: direct ? k / xs[2] : k * xs[2], why: direct ? 'The ratio $y/x$ is constant here, so $y = kx$.' : 'The product $xy$ is constant here, so $y = k/x$.' }, { value: ys[1] + (xs[2] - xs[1]), why: 'Neither type of variation is additive.' }],
          hints: ['Test which is constant: $y\\div x$ or $x\\times y$.', direct ? `$${ys[0]}\\div ${xs[0]} = ${ys[1]}\\div ${xs[1]} = ${k}$.` : `$${xs[0]}\\times ${ys[0]} = ${xs[1]}\\times ${ys[1]} = ${k}$.`, direct ? `$y = ${k}\\times ${xs[2]}$.` : `$y = ${k}\\div ${xs[2]}$.`],
          steps: [{ h: 'Identify the relationship', d: direct ? `$y\\div x = ${k}$ is constant: direct variation` : `$xy = ${k}$ is constant: inverse variation` }, { h: 'Missing value', d: `$y = ${ys[2]}$` }]
        });
      }
    },
    { // line through the origin
      make: (rng) => {
        const c = rc(rng, [['time (hours)', 'distance (km)', 'a cyclist'], ['mass (kg)', 'cost (dollars)', 'a fruit stall'], ['time (minutes)', 'litres of water', 'a tap']]);
        const x1 = ri(rng, 2, 12), k = ri(rng, 2, 30); let x2; do { x2 = ri(rng, 2, 40); } while (x2 === x1);
        return N(`On a graph for ${c[2]}, ${c[1]} is plotted against ${c[0]}. The graph is a straight line through the origin and the point $(${x1}, ${k * x1})$. Use direct variation to find the value of ${c[1].split(' ')[0]} when ${c[0].split(' ')[0]} is $${x2}$.`, k * x2, {
          traps: [{ value: k * x1 + x2 - x1, why: 'A line through the origin means $y = kx$: multiply, do not add.' }, { value: r2(x1 * x2 / (k * x1)), why: 'The gradient is $y\\div x$.' }],
          hints: ['A straight line through the origin is direct variation $y = kx$.', `Gradient $k = ${k * x1}\\div ${x1} = ${k}$.`, `$y = ${k}\\times ${x2}$.`],
          steps: [{ h: 'Gradient', d: `$k = ${k * x1}\\div ${x1} = ${k}$` }, { h: 'Read off', d: `$y = ${k}\\times ${x2} = ${k * x2}$` }]
        });
      }
    }
  ],

  // ═══ y10-indices-neg ══════════════════════════════════════════════════════
  'y10-indices-neg': [
    { // evaluate c x a^-n
      make: (rng) => {
        let a, n, c, f;
        do { a = ri(rng, 2, 12); n = ri(rng, 1, 4); c = rc(rng, [1, 1, 2, 3, 4, 5, 6, 7, 9]); f = new Frac(c, a ** n); } while (f.d === 1 || a ** n > 20000);
        return F(c === 1 ? `Evaluate $${a}^{-${n}}$ as a fraction in simplest form.` : `Evaluate $${c}\\times ${a}^{-${n}}$ as a fraction in simplest form.`, f, {
          traps: [{ value: -(c * a ** n), why: 'A negative index means "reciprocal", it does not make the answer negative.' }, { value: c * a * -n, why: 'A negative index is not multiplication: $a^{-n} = \\dfrac{1}{a^n}$.' }],
          hints: ['$a^{-n} = \\dfrac{1}{a^n}$.', `$${a}^${n} = ${a ** n}$.`, c === 1 ? `So $${a}^{-${n}} = \\dfrac{1}{${a ** n}}$.` : `Multiply by ${c} and simplify.`],
          steps: [{ h: 'Reciprocal', d: `$${a}^{-${n}} = \\dfrac{1}{${a ** n}}$` }, { h: 'Answer', d: `$${c}\\times\\dfrac{1}{${a ** n}} = ${f.latex()}$` }]
        });
      }
    },
    { // convert between fraction and negative-index forms
      make: (rng) => {
        const c = ri(rng, 2, 12), n = ri(rng, 1, 9), toNeg = rc(rng, [true, false]);
        return toNeg
          ? E(`Write $\\dfrac{${c}}{x^{${n}}}$ using a negative index (no fractions).`, `${c}*x^(${-n})`, [{ expr: `${c}*x^(${n})`, why: 'Moving $x^n$ from the denominator to the numerator changes the sign of the index.' }, { expr: `x^(${-n})/${c}`, why: 'Only $x$ moves; the coefficient stays in the numerator.' }],
            ['$\\dfrac{1}{x^n} = x^{-n}$.', 'The coefficient stays where it is.', `$\\dfrac{${c}}{x^{${n}}} = ${c}\\times\\dfrac{1}{x^{${n}}}$.`], [{ h: 'Rewrite', d: `$\\dfrac{${c}}{x^{${n}}} = ${c}x^{-${n}}$` }])
          : E(`Write $${c}x^{-${n}}$ as a fraction with a positive index.`, `${c}/x^(${n})`, [{ expr: `1/(${c}*x^(${n}))`, why: 'Only $x$ has the negative index: the coefficient does not go into the denominator.' }, { expr: `${c}*x^(${n})`, why: 'A negative index means a reciprocal, so $x^n$ goes in the denominator.' }],
            ['$x^{-n} = \\dfrac{1}{x^n}$.', 'The coefficient is not raised to the negative power.', `$${c}x^{-${n}} = ${c}\\times\\dfrac{1}{x^{${n}}}$.`], [{ h: 'Rewrite', d: `$${c}x^{-${n}} = \\dfrac{${c}}{x^{${n}}}$` }]);
      }
    },
    { // solve a^x = 1/a^n
      make: (rng) => {
        const a = rc(rng, [2, 3, 4, 5, 6, 7, 10]), n = ri(rng, 1, a === 10 ? 6 : a >= 5 ? 4 : 6), N_ = a ** n;
        const rhs = a === 10 && rng() < 0.6 ? `0.${'0'.repeat(n - 1)}1` : `\\dfrac{1}{${N_}}`;
        return N(`Solve $${a}^x = ${rhs}$.`, -n, {
          traps: [{ value: n, why: `$${rhs.startsWith('0') ? rhs : '\\frac{1}{' + N_ + '}'}$ is a reciprocal, so the index is negative.` }, { value: N_, why: 'Write the right-hand side as a power of the same base, then equate the indices.' }],
          hints: [`Write the right-hand side as a power of ${a}.`, `$\\dfrac{1}{${N_}} = ${a}^{-${n}}$.`, 'Equate the indices.'],
          steps: [{ h: 'Same base', d: `$${a}^x = ${a}^{-${n}}$` }, { h: 'Equate indices', d: `$x = -${n}$` }]
        });
      }
    },
    { // sum of two negative powers
      make: (rng) => {
        let p, q, m, n, f;
        do { p = ri(rng, 2, 9); q = ri(rng, 2, 9); m = ri(rng, 1, 3); n = ri(rng, 1, 3); f = new Frac(1, p ** m).add(new Frac(1, q ** n)); } while (f.d === 1);
        return F(`Evaluate $${p}^{-${m}} + ${q}^{-${n}}$ as a fraction in simplest form.`, f, {
          traps: [{ f: new Frac(1, p ** m + q ** n), why: 'You cannot add denominators: find a common denominator for $\\dfrac{1}{' + p ** m + '} + \\dfrac{1}{' + q ** n + '}$.' }, { value: -(1 / p ** m) - 1 / q ** n, why: 'Negative indices give reciprocals, not negative numbers.' }],
          hints: ['Convert each term to a fraction.', `$${p}^{-${m}} = \\dfrac{1}{${p ** m}}$ and $${q}^{-${n}} = \\dfrac{1}{${q ** n}}$.`, 'Add with a common denominator.'],
          steps: [{ h: 'Reciprocals', d: `$\\dfrac{1}{${p ** m}} + \\dfrac{1}{${q ** n}}$` }, { h: 'Add', d: `$= ${f.latex()}$` }]
        });
      }
    },
    { // substitute a fraction
      make: (rng) => {
        const c = ri(rng, 2, 9), q = ri(rng, 2, 9), n = ri(rng, 1, 3);
        return N(`If $x = \\dfrac{1}{${q}}$, evaluate $${c}x^{-${n}}$.`, c * q ** n, {
          traps: [{ value: c / q ** n, why: 'A negative index flips the fraction: $\\left(\\dfrac1q\\right)^{-n} = q^n$.' }, { value: -c * q ** n, why: 'A negative index does not make the value negative.' }],
          hints: ['$x^{-n} = \\dfrac{1}{x^n}$.', `$\\left(\\dfrac{1}{${q}}\\right)^{-${n}} = ${q}^{${n}} = ${q ** n}$.`, `Multiply by ${c}.`],
          steps: [{ h: 'Flip', d: `$x^{-${n}} = ${q}^{${n}} = ${q ** n}$` }, { h: 'Multiply', d: `$${c}\\times ${q ** n} = ${c * q ** n}$` }]
        });
      }
    },
    { // MCQ equivalent expressions
      make: (rng) => {
        const c = ri(rng, 2, 9), n = ri(rng, 2, 8); let d; do { d = ri(rng, 2, 9); } while (d === c);
        const useD = rc(rng, [true, false]);
        const front = useD ? `\\dfrac{${d}}{${c}}` : `\\dfrac{1}{${c}}`;
        const num = useD ? d : 1;
        return M(rng, `Which expression is equal to $\\dfrac{${num}}{${c}x^{${n}}}$?`, `$${front}x^{-${n}}$`, [
          { text: `$${useD ? `${d * c}` : c}x^{-${n}}$`, why: 'Only $x$ moves to the numerator; the coefficient $' + c + '$ stays in the denominator.' },
          { text: `$${front}x^{${n}}$`, why: 'Moving $x^n$ from the denominator to the numerator changes the sign of the index.' },
          { text: `$${useD ? `\\dfrac{${c}}{${d}}` : `${c}`}x^{-${n}}$`, why: 'The coefficient is inverted incorrectly: only the power of $x$ is in the denominator with the coefficient $' + c + '$.' }
        ], ['$\\dfrac{1}{x^n} = x^{-n}$.', `Keep the coefficient fraction $${front}$ unchanged.`, 'Only the sign of the index of $x$ changes.'], [{ h: 'Split', d: `$\\dfrac{${num}}{${c}x^{${n}}} = ${front}\\times\\dfrac{1}{x^{${n}}} = ${front}x^{-${n}}$` }]);
      }
    },
    { // (c x^a)^b
      make: (rng) => {
        const c = ri(rng, 2, 5), a = nz(rng, -6, 6), b = ri(rng, 2, 3);
        return E(`Simplify $\\left(${c}x^{${a}}\\right)^{${b}}$.`, `${c ** b}*x^(${a * b})`, [{ expr: `${c * b}*x^(${a * b})`, why: 'The coefficient is also raised to the power: $c^b$, not $c\\times b$.' }, { expr: `${c ** b}*x^(${a + b})`, why: 'A power of a power: multiply the indices.' }],
          ['Raise each factor inside the bracket to the outer power.', `$${c}^{${b}} = ${c ** b}$.`, `$(x^{${a}})^{${b}} = x^{${a * b}}$.`], [{ h: 'Coefficient', d: `$${c}^{${b}} = ${c ** b}$` }, { h: 'Index', d: `$(x^{${a}})^{${b}} = x^{${a * b}}$` }]);
      }
    },
    { // product with mixed signs
      make: (rng) => {
        const c = ri(rng, 2, 9), d = ri(rng, 2, 9), a = ri(rng, 1, 8); let b; do { b = ri(rng, 1, 8); } while (b === a);
        return E(`Simplify $${c}x^{-${a}}\\times ${d}x^{${b}}$.`, `${c * d}*x^(${b - a})`, [{ expr: `${c + d}*x^(${b - a})`, why: 'Multiply the coefficients ($c\\times d$) and add the indices.' }, { expr: `${c * d}*x^(${-a * b})`, why: 'When multiplying powers of the same base, add the indices, do not multiply them.' }],
          ['Multiply the coefficients; add the indices.', `$${c}\\times ${d} = ${c * d}$.`, `$-${a} + ${b} = ${b - a}$.`], [{ h: 'Coefficients', d: `$${c}\\times ${d} = ${c * d}$` }, { h: 'Indices', d: `$x^{-${a}}\\times x^{${b}} = x^{${b - a}}$` }]);
      }
    }
  ],

  // ═══ y10-polynomials ══════════════════════════════════════════════════════
  'y10-polynomials': [
    { // remainder theorem
      diffs: [2, 3, 4],
      make: (rng) => {
        const e = ri(rng, 1, 3), b = ri(rng, -9, 9), c = ri(rng, -9, 9), d = nz(rng, -12, 12), a = nz(rng, -5, 5);
        const P = x => e * x ** 3 + b * x * x + c * x + d, R = P(a);
        return N(`$P(x) = ${poly([e, b, c, d])}$ is divided by $(${bin('x', -a)})$. Find the remainder.`, R, {
          traps: [{ value: P(-a), why: `Divide by $(x - a)$: the remainder is $P(a)$. Here $a = ${a}$.` }, { value: P(0), why: 'The remainder is $P(a)$, where $x - a$ is the divisor, not $P(0)$.' }],
          hints: ['Remainder theorem: dividing by $(x - a)$ leaves $P(a)$.', `Here $a = ${a}$.`, `Substitute $x = ${a}$ into $P(x)$.`],
          steps: [{ h: 'Remainder theorem', d: `remainder $= P(${a})$` }, { h: 'Substitute', d: `$${e}(${a})^3 + ${b}(${a})^2 + ${c}(${a}) + ${d} = ${R}$`.replace(/\+ -/g, '- ') }]
        });
      }
    },
    { // factor theorem: find k
      diffs: [3, 4],
      make: (rng) => {
        const a = nz(rng, -4, 4), k = nz(rng, -6, 6), b = ri(rng, -9, 9), c = -(a ** 3 + k * a * a + b * a);
        return N(`$(${bin('x', -a)})$ is a factor of $P(x) = x^3 + kx^2${tm(b, 'x')}${tm(c)}$. Find the value of $k$.`, k, {
          traps: [{ value: -k, why: `Since $(x - ${a})$ is a factor, $P(${a}) = 0$; check the signs when you substitute.` }, { value: c, why: 'The condition is $P(a) = 0$. Solve it for $k$.' }],
          hints: [`Factor theorem: $P(${a}) = 0$.`, `$${a ** 3} + k(${a * a})${tm(b * a)}${tm(c)} = 0$.`, 'Solve the linear equation for $k$.'],
          steps: [{ h: 'Factor theorem', d: `$P(${a}) = 0$` }, { h: 'Equation', d: `$${a ** 3} + ${a * a}k + ${b * a} + ${c} = 0 \\Rightarrow ${a * a}k = ${-(a ** 3 + b * a + c)}$`.replace(/\+ -/g, '- ') }, { h: 'Solve', d: `$k = ${k}$` }]
        });
      }
    },
    { // zeros from factorised form
      make: (rng) => {
        let r = [0, 0, 0];
        do { r = [ri(rng, -9, 9), ri(rng, -9, 9), ri(rng, -9, 9)]; } while (new Set(r).size < 3);
        const best = Math.max(...r), neg = Math.max(...r.map(v => -v));
        return N(`Find the largest zero of $P(x) = (${bin('x', -r[0])})(${bin('x', -r[1])})(${bin('x', -r[2])})$.`, best, {
          traps: [{ value: neg, why: 'A factor $(x - a)$ gives the zero $x = a$: the sign flips from the number in the bracket.' }, { value: Math.min(...r), why: 'The question asks for the largest zero.' }],
          hints: ['Set each factor equal to zero.', `The zeros are $${r.join(', ')}$.`, 'Choose the largest.'],
          steps: [{ h: 'Zeros', d: `$x = ${r[0]}$, $x = ${r[1]}$, $x = ${r[2]}$` }, { h: 'Largest', d: `$${best}$` }]
        });
      }
    },
    { // coefficients of a product of three linear factors
      make: (rng) => {
        const a = nz(rng, -6, 6), b = nz(rng, -6, 6), c = nz(rng, -6, 6), w = rc(rng, ['x²', 'x', 'constant']);
        const key = w === 'x²' ? a + b + c : w === 'x' ? a * b + b * c + a * c : a * b * c;
        const trap = w === 'x²' ? a * b * c : w === 'x' ? a + b + c : a * b + b * c + a * c;
        const hint = w === 'x²' ? '$x^2$ comes from one number and two $x$ terms.' : w === 'x' ? '$x$ comes from one $x$ and two numbers: choose pairs.' : 'The constant term multiplies the three numbers.';
        return N(`Expand $(${bin('x', a)})(${bin('x', b)})(${bin('x', c)})$. What is the ${w === 'constant' ? 'constant term' : `coefficient of $${w === 'x²' ? 'x^2' : 'x'}$`}?`, key, {
          traps: [{ value: trap, why: 'Check which products of the three numbers give this term.' }],
          hints: [hint, `The numbers are $${a}$, $${b}$ and $${c}$.`, w === 'x²' ? `$${a} + ${b} + ${c}$ (with signs).` : w === 'x' ? `$ab + bc + ac$.` : '$abc$.'],
          steps: [{ h: 'Pick the terms', d: hint }, { h: 'Evaluate', d: `$${key}$` }]
        });
      }
    },
    { // exact division: constant of quotient
      diffs: [3, 4],
      make: (rng) => {
        const a = nz(rng, -6, 6), p = ri(rng, -8, 8), q = nz(rng, -9, 9);
        const co = [1, p - a, q - a * p, -a * q];
        return N(`$P(x) = ${poly(co)}$ is divisible by $(${bin('x', -a)})$ with no remainder. The quotient is a quadratic $x^2 + px + q$. Find $q$.`, q, {
          traps: [{ value: -a * q, why: 'That is the constant term of $P(x)$, which equals $-a q$. Divide by $-a$ to find $q$.' }],
          hints: ['$(x - a)(x^2 + px + q)$ has constant term $-aq$.', `The constant term of $P$ is $${-a * q}$ and $a = ${a}$.`, `$q = ${-a * q}\\div(-${a < 0 ? `(${a})` : a})$.`],
          steps: [{ h: 'Constant terms', d: `$-a q = ${-a * q}$ with $a = ${a}$` }, { h: 'Solve', d: `$q = ${q}$` }]
        });
      }
    },
    { // volume of a crate
      make: (rng) => {
        const a = ri(rng, 1, 9), b = ri(rng, 1, 12), n = ri(rng, 2, 15), V = n * (n + a) * (n + b);
        return N(`The volume of a crate is $V(x) = x(x + ${a})(x + ${b})$ cubic centimetres, where $x$ is the width in centimetres. Find the volume when $x = ${n}$.`, V, {
          suffix: 'cm³', traps: [{ value: 3 * n + a + b, why: 'Volume multiplies the three dimensions; do not add them.' }, { value: n ** 3 + a + b, why: 'Substitute into every factor: $(x + a)$ becomes $(n + a)$.' }],
          hints: ['Substitute $x$ into each factor.', `$${n}\\times ${n + a}\\times ${n + b}$.`, 'Multiply.'],
          steps: [{ h: 'Substitute', d: `$V(${n}) = ${n}(${n + a})(${n + b})$` }, { h: 'Multiply', d: `$${V}$ cm³` }]
        });
      }
    },
    { // number of distinct real zeros
      make: (rng) => {
        const z = [ri(rng, -5, 5), ri(rng, -5, 5), ri(rng, -5, 5)], m = [ri(rng, 1, 3), ri(rng, 1, 3), ri(rng, 1, 3)], c = ri(rng, 1, 9);
        const f = (v, e) => `(${bin('x', -v)})${e > 1 ? `^{${e}}` : ''}`;
        const key = new Set(z).size, mult = m.reduce((s, v) => s + v, 0);
        return N(`How many different real zeros does $P(x) = ${f(z[0], m[0])}${f(z[1], m[1])}${f(z[2], m[2])}(x^2 + ${c})$ have?`, key, {
          traps: [{ value: 3, why: 'Repeated factors give the same zero: count each different value once.' }, { value: mult, why: 'Do not count multiplicity: how many different values of $x$ make $P(x)=0$?' }, { value: key + 2, why: `$x^2 + ${c} = 0$ has no real solution.` }],
          hints: ['Set each factor to zero.', `The zeros from the linear factors are $${z.join(', ')}$.`, `$x^2 + ${c}$ is never zero for real $x$.`],
          steps: [{ h: 'Zeros', d: `$${z.join(', ')}$ and none from $x^2 + ${c}$` }, { h: 'Distinct', d: `${key} different real zeros` }]
        });
      }
    },
    { // degree facts
      make: (rng) => {
        const m = ri(rng, 2, 7), n = ri(rng, 2, 7), k = ri(rng, 2, 5), w = rc(rng, ['comp', 'power', 'sum']);
        if (w === 'comp') return N(`$P(x)$ has degree $${m}$ and $Q(x)$ has degree $${n}$. What is the degree of the composite $P(Q(x))$?`, m * n, { traps: [{ value: m + n, why: 'In $P(Q(x))$ every $x$ in $P$ is replaced by a degree-$n$ expression: the degrees multiply.' }], hints: ['The leading term of $P$ is $x^m$; replace $x$ by something with leading term $x^n$.', `$(x^{${n}})^{${m}} = x^{${m * n}}$.`, 'Multiply the degrees.'], steps: [{ h: 'Leading term', d: `$(x^{${n}})^{${m}} = x^{${m * n}}$` }, { h: 'Degree', d: `${m * n}` }] });
        if (w === 'power') return N(`$P(x)$ has degree $${m}$. What is the degree of $[P(x)]^{${k}}$?`, m * k, { traps: [{ value: m + k, why: 'Raising a polynomial to the power $k$ multiplies its degree by $k$.' }, { value: m ** k, why: 'The leading term $x^m$ becomes $x^{mk}$: multiply, not raise to a power.' }], hints: ['$(x^m)^k = x^{mk}$.', `Here $m = ${m}$ and $k = ${k}$.`, 'Multiply.'], steps: [{ h: 'Leading term', d: `$(x^{${m}})^{${k}} = x^{${m * k}}$` }] });
        const u = m === n ? n + 1 : n;
        return N(`$P(x)$ has degree $${m}$ and $Q(x)$ has degree $${u}$. What is the degree of $P(x) + Q(x)$?`, Math.max(m, u), { traps: [{ value: m + u, why: 'Adding polynomials does not add their degrees: the higher-degree term survives.' }, { value: Math.min(m, u), why: 'The highest power present is the degree.' }], hints: ['The highest power of $x$ cannot cancel when the degrees differ.', `Degrees are ${m} and ${u}.`, 'Take the larger.'], steps: [{ h: 'Compare', d: `$\\max(${m}, ${u}) = ${Math.max(m, u)}$` }] });
      }
    }
  ],

  // ═══ y10-trig ═════════════════════════════════════════════════════════════
  'y10-trig': [
    { // angle of inclination from rise and run
      make: (rng) => {
        let rise, run, deg;
        do { rise = ri(rng, 2, 40); run = ri(rng, 5, 80); deg = Math.atan(rise / run) * 180 / Math.PI; } while (Math.abs(deg - Math.floor(deg) - 0.5) < 0.04);
        const ctx = rc(rng, ['A wheelchair ramp rises', 'A ski run drops', 'A road climbs']);
        const key = Math.round(deg);
        return N(`${ctx} $${rise}$ m over a horizontal distance of $${run}$ m. Find the angle of slope to the horizontal, to the nearest degree.`, key, {
          tol: 0.51, suffix: '°',
          traps: [{ value: Math.round(Math.atan(run / rise) * 180 / Math.PI), why: 'The rise is opposite the angle and the run is adjacent: $\\tan\\theta = \\dfrac{\\text{rise}}{\\text{run}}$.', tol: 0.51 }, { value: Math.round(Math.asin(rise / run > 1 ? 1 : rise / run) * 180 / Math.PI), why: 'The run (horizontal distance) is the adjacent side, not the hypotenuse.', tol: 0.51 }],
          hints: ['Draw the right-angled triangle: rise is opposite, run is adjacent.', `$\\tan\\theta = \\dfrac{${rise}}{${run}}$.`, `$\\theta = \\tan^{-1}(${(rise / run).toFixed(3)})$.`],
          steps: [{ h: 'Choose tan', d: `$\\tan\\theta = \\dfrac{${rise}}{${run}}$` }, { h: 'Inverse tan', d: `$\\theta = \\tan^{-1}(${(rise / run).toFixed(3)}) \\approx ${deg.toFixed(2)}^\\circ \\approx ${key}^\\circ$` }]
        });
      }
    },
    { // ladder length (hypotenuse)
      make: (rng) => {
        const th = ri(rng, 55, 80), h = ri(rng, 2, 12), L = h / Math.sin(rad(th));
        return N(`A ladder makes an angle of $${th}^\\circ$ with level ground and its top rests against a wall at a height of $${h}$ m. Find the length of the ladder, correct to 1 decimal place.`, r1(L), {
          tol: 0.06, suffix: 'm', traps: [{ value: r1(h * Math.sin(rad(th))), why: 'The ladder is the hypotenuse: $\\sin\\theta = \\dfrac{\\text{opp}}{\\text{hyp}}$, so divide the height by $\\sin\\theta$.', tol: 0.06 }, { value: r1(h / Math.cos(rad(th))), why: 'The height is opposite the angle at the ground, so use sine, not cosine.', tol: 0.06 }],
          hints: ['The height is opposite the angle; the ladder is the hypotenuse.', `$\\sin ${th}^\\circ = \\dfrac{${h}}{L}$.`, `$L = \\dfrac{${h}}{\\sin ${th}^\\circ}$.`],
          steps: [{ h: 'Set up', d: `$\\sin ${th}^\\circ = \\dfrac{${h}}{L}$` }, { h: 'Rearrange', d: `$L = \\dfrac{${h}}{${Math.sin(rad(th)).toFixed(4)}} \\approx ${r1(L)}$ m` }]
        });
      }
    },
    { // north/south component of a bearing
      make: (rng) => {
        let b; do { b = ri(rng, 10, 350); } while (b % 90 === 0);
        const d = ri(rng, 8, 90), comp = d * Math.cos(rad(b)), north = comp > 0;
        return N(`A coastal patrol plane flies $${d}$ km on a bearing of $${String(b).padStart(3, '0')}^\\circ$T. How far ${north ? 'north' : 'south'} of its starting point is it, correct to 1 decimal place?`, r1(Math.abs(comp)), {
          tol: 0.06, suffix: 'km', traps: [{ value: r1(Math.abs(d * Math.sin(rad(b)))), why: 'Bearings are measured from north: the north-south displacement uses $\\cos$ of the bearing, the east-west uses $\\sin$.', tol: 0.06 }, { value: r1(d), why: 'Only part of the flight is in the north-south direction.', tol: 0.06 }],
          hints: ['Draw north up; the bearing is measured clockwise from north.', 'North-south component $= d\\cos(\\text{bearing})$ (use the size of the answer).', `$${d}\\times|\\cos ${b}^\\circ|$.`],
          steps: [{ h: 'Resolve', d: `$d\\cos ${b}^\\circ = ${d}\\times ${Math.cos(rad(b)).toFixed(4)} = ${comp.toFixed(3)}$` }, { h: 'Direction', d: `${north ? 'positive: north' : 'negative: south'}, distance $\\approx ${r1(Math.abs(comp))}$ km` }]
        });
      }
    },
    { // observer's eye height
      make: (rng) => {
        const d = ri(rng, 15, 90), th = ri(rng, 15, 65), eye = rc(rng, [1.5, 1.6, 1.7, 1.8]), H = d * Math.tan(rad(th)) + eye;
        return N(`Maya, whose eyes are $${eye}$ m above the ground, stands $${d}$ m from the base of a building. The angle of elevation from her eyes to the top of the building is $${th}^\\circ$. Find the height of the building, correct to 1 decimal place.`, r1(H), {
          tol: 0.06, suffix: 'm', traps: [{ value: r1(d * Math.tan(rad(th))), why: 'The angle is measured from her eyes, so add the eye height to the triangle height.', tol: 0.06 }, { value: r1(d / Math.tan(rad(th)) + eye), why: 'The height is opposite the angle: multiply the distance by $\\tan\\theta$.', tol: 0.06 }],
          hints: ['The right-angled triangle starts at eye level.', `$h = ${d}\\tan ${th}^\\circ$.`, `Then add $${eye}$ m.`],
          steps: [{ h: 'Triangle height', d: `$${d}\\tan ${th}^\\circ = ${(d * Math.tan(rad(th))).toFixed(3)}$ m` }, { h: 'Add eye height', d: `$${(d * Math.tan(rad(th))).toFixed(3)} + ${eye} \\approx ${r1(H)}$ m` }]
        });
      }
    },
    { // MCQ identify a trig ratio from sides
      make: (rng) => {
        const [p, q, z] = rc(rng, TR), m = ri(rng, 1, 9), sw = rc(rng, [true, false]), w = rc(rng, ['sin', 'cos', 'tan']), ang = rc(rng, ['A', 'B']);
        const a = (sw ? q : p) * m, b = (sw ? p : q) * m, c = z * m;     // a = BC, b = AC, c = AB; right angle at C
        const opp = ang === 'A' ? a : b, adj = ang === 'A' ? b : a;
        const fr = (n, d) => { const f = new Frac(n, d); return `$\\dfrac{${f.n}}{${f.d}}$`; };
        const set = { sin: [opp, c], cos: [adj, c], tan: [opp, adj] };
        const [kn, kd] = set[w];
        const others = { sin: [[adj, c], [opp, adj], [c, opp]], cos: [[opp, c], [opp, adj], [c, adj]], tan: [[adj, opp], [opp, c], [adj, c]] }[w];
        const whys = { sin: ['That is cosine: adjacent over hypotenuse.', 'That is tangent: opposite over adjacent.', 'That is the reciprocal of sine.'], cos: ['That is sine: opposite over hypotenuse.', 'That is tangent: opposite over adjacent.', 'That is the reciprocal of cosine.'], tan: ['That is the reciprocal of tangent.', 'That is sine: opposite over hypotenuse.', 'That is cosine: adjacent over hypotenuse.'] }[w];
        return M(rng, `In triangle $ABC$ the right angle is at $C$, with $BC = ${a}$ cm, $AC = ${b}$ cm and $AB = ${c}$ cm. Which fraction is $\\${w}\\,${ang}$, in simplest form?`, fr(kn, kd),
          others.map(([n, d], i) => ({ text: fr(n, d), why: whys[i] })),
          [`Angle $${ang}$: the opposite side is $${ang === 'A' ? 'BC' : 'AC'}$, the adjacent side is $${ang === 'A' ? 'AC' : 'BC'}$.`, `Use SOH-CAH-TOA for ${w}.`, 'Simplify the fraction.'],
          [{ h: 'Label the sides', d: `opposite $${opp}$, adjacent $${adj}$, hypotenuse $${c}$` }, { h: 'Ratio', d: `$\\${w}\\,${ang} = \\dfrac{${kn}}{${kd}} = ${fr(kn, kd).slice(1, -1)}$` }]);
      }
    },
    { // back bearing
      make: (rng) => {
        let b; do { b = ri(rng, 5, 355); } while (b === 180);
        const back = (b + 180) % 360, pad = v => String(v).padStart(3, '0');
        return N(`A lighthouse keeper sees a boat on a bearing of $${pad(b)}^\\circ$T. What is the bearing of the lighthouse from the boat?`, back, {
          suffix: '°T', traps: [{ value: 360 - b, why: 'Reverse a bearing by adding or subtracting $180^\\circ$, not by reflecting it.' }, { value: (b + 90) % 360, why: 'The reverse direction is exactly opposite: $180^\\circ$ apart.' }],
          hints: ['The return direction is opposite: $180^\\circ$ different.', b < 180 ? `Add $180^\\circ$ to $${b}^\\circ$.` : `Subtract $180^\\circ$ from $${b}^\\circ$.`, 'A bearing is between $000^\\circ$ and $360^\\circ$.'],
          steps: [{ h: 'Reverse', d: b < 180 ? `$${b} + 180 = ${back}$` : `$${b} - 180 = ${back}$` }, { h: 'Write as a bearing', d: `$${pad(back)}^\\circ$T` }]
        });
      }
    },
    { // angle of depression from known height and distance
      make: (rng) => {
        let h, d, deg;
        do { h = ri(rng, 8, 120); d = ri(rng, 10, 250); deg = Math.atan(h / d) * 180 / Math.PI; } while (Math.abs(deg - Math.floor(deg) - 0.5) < 0.04);
        const key = Math.round(deg);
        return N(`From the top of a lighthouse $${h}$ m above sea level, a surfer is seen at a horizontal distance of $${d}$ m. Find the angle of depression from the top of the lighthouse to the surfer, to the nearest degree.`, key, {
          tol: 0.51, suffix: '°', traps: [{ value: Math.round(Math.atan(d / h) * 180 / Math.PI), why: 'The height is opposite the angle of depression (alternate with the angle of elevation at the surfer): $\\tan\\theta = \\dfrac{h}{d}$.', tol: 0.51 }, { value: 90 - key, why: 'The angle of depression is measured from the horizontal, not from the vertical.', tol: 0.51 }],
          hints: ['The angle of depression equals the angle of elevation from the surfer (alternate angles).', `$\\tan\\theta = \\dfrac{${h}}{${d}}$.`, `$\\theta = \\tan^{-1}(${(h / d).toFixed(3)})$.`],
          steps: [{ h: 'Tan ratio', d: `$\\tan\\theta = \\dfrac{${h}}{${d}}$` }, { h: 'Inverse tan', d: `$\\theta \\approx ${deg.toFixed(2)}^\\circ \\approx ${key}^\\circ$` }]
        });
      }
    }
  ],

  // ═══ y10-probability ══════════════════════════════════════════════════════
  'y10-probability': [
    { // two draws without replacement
      make: (rng) => {
        const r = ri(rng, 2, 9), b = ri(rng, 2, 9), n = r + b, w = rc(rng, ['same', 'both', 'diff']);
        const den = n * (n - 1), num = w === 'both' ? r * (r - 1) : w === 'same' ? r * (r - 1) + b * (b - 1) : 2 * r * b;
        const ask = w === 'both' ? 'both are red' : w === 'same' ? 'both are the same colour' : 'the two are different colours';
        const things = rc(rng, [['marbles', 'a bag'], ['footy cards', 'a pack'], ['jelly snakes', 'a bowl']]);
        const wrongNum = w === 'both' ? r * r : w === 'same' ? r * r + b * b : 2 * r * b;
        const wrongDen = w === 'diff' ? n * n : n * n;
        return F(`${things[1][0].toUpperCase()}${things[1].slice(1)} holds $${r}$ red and $${b}$ blue ${things[0]}. Two are drawn at random, one after the other, **without** replacement. Find the probability that ${ask}. Give your answer as a fraction in simplest form.`, new Frac(num, den), {
          traps: [{ f: new Frac(wrongNum, wrongDen), why: 'Without replacement the second draw is from one fewer item: the denominator is $n(n - 1)$ and the first item changes the numerators.' }],
          hints: ['Use a tree diagram or count outcomes: total ordered pairs $n(n - 1)$.', `$n = ${n}$, so there are $${n}\\times ${n - 1} = ${den}$ ordered pairs.`, w === 'both' ? `Both red: $${r}\\times ${r - 1}$.` : w === 'same' ? `Both red: $${r}\\times${r - 1}$; both blue: $${b}\\times${b - 1}$.` : `Red then blue: $${r}\\times ${b}$; blue then red: $${b}\\times ${r}$.`],
          steps: [{ h: 'Favourable ordered pairs', d: `$${num}$` }, { h: 'Probability', d: `$\\dfrac{${num}}{${den}} = ${new Frac(num, den).latex()}$` }]
        });
      }
    },
    { // independent events: neither / at least one / exactly one
      make: (rng) => {
        const dd = [2, 3, 4, 5, 6, 8, 10];
        const d1 = rc(rng, dd), d2 = rc(rng, dd), a = new Frac(ri(rng, 1, d1 - 1), d1), b = new Frac(ri(rng, 1, d2 - 1), d2);
        const one = new Frac(1, 1), na = one.sub(a), nb = one.sub(b), w = rc(rng, ['neither', 'least', 'exactly']);
        const key = w === 'neither' ? na.mul(nb) : w === 'least' ? one.sub(na.mul(nb)) : a.mul(nb).add(na.mul(b));
        const trap = w === 'neither' ? one.sub(a.mul(b)) : w === 'least' ? a.add(b) : a.mul(b);
        const ask = w === 'neither' ? 'neither event happens' : w === 'least' ? 'at least one of the events happens' : 'exactly one of the events happens';
        if (key.d === 1) return forms['y10-probability'][1].make(rng);
        return F(`Events $A$ and $B$ are independent, with $P(A) = ${a.latex()}$ and $P(B) = ${b.latex()}$. Find the probability that ${ask}, as a fraction in simplest form.`, key, {
          traps: [{ f: trap, why: w === 'least' ? 'Adding double-counts when both happen (and can exceed 1). Use $1 - P(\\text{neither})$.' : w === 'neither' ? 'For independent events multiply the probabilities of the complements.' : 'Exactly one means A only or B only: add two products.' }],
          hints: ['Independent: $P(A\\cap B) = P(A)P(B)$; complements are $1 - P$.', `$P(A') = ${na.latex()}$ and $P(B') = ${nb.latex()}$.`, w === 'neither' ? "$P(A')\\times P(B')$." : w === 'least' ? "$1 - P(A')P(B')$." : "$P(A)P(B') + P(A')P(B)$."],
          steps: [{ h: 'Complements', d: `$P(A') = ${na.latex()}$, $P(B') = ${nb.latex()}$` }, { h: 'Combine', d: `$${key.latex()}$` }]
        });
      }
    },
    { // conditional from counts
      make: (rng) => {
        const both = ri(rng, 2, 15), oa = ri(rng, 2, 20), ob = ri(rng, 2, 20), nei = ri(rng, 2, 12), T = both + oa + ob + nei;
        const sp = rc(rng, [['play cricket', 'play netball'], ['surf', 'skate'], ['take the train', 'ride a bike']]);
        const w = rc(rng, ['AgB', 'BgA', 'AgnB']);
        const num = w === 'AgnB' ? oa : both, den = w === 'AgB' ? both + ob : w === 'BgA' ? both + oa : oa + nei;
        const ask = w === 'AgB' ? `plays the first activity, given that they ${sp[1]}` : w === 'BgA' ? `${sp[1]}s, given that they ${sp[0]}` : '';
        const txt = w === 'AgnB' ? `a student chosen at random does ${'the first'} activity, given that they do **not** do the second` : '';
        const lbl = `Of $${T}$ students, $${both}$ ${sp[0]} and ${sp[1]}, $${oa}$ only ${sp[0]}, $${ob}$ only ${sp[1]} and $${nei}$ do neither.`;
        const q = w === 'AgB' ? `Given that a randomly chosen student does the second activity (${sp[1]}), find the probability they also do the first (${sp[0]}).`
          : w === 'BgA' ? `Given that a randomly chosen student does the first activity (${sp[0]}), find the probability they also do the second (${sp[1]}).`
            : `Given that a randomly chosen student does **not** do the second activity (${sp[1]}), find the probability they do the first (${sp[0]}).`;
        void ask; void txt;
        return F(`${lbl} ${q} Give your answer as a fraction in simplest form.`, new Frac(num, den), {
          traps: [{ f: new Frac(num, T), why: 'The condition shrinks the sample space: divide by the number in the condition, not by everyone.' }],
          hints: ['The condition tells you which group is the whole sample space.', `That group has ${den} students.`, `Of them, ${num} fit the event.`],
          steps: [{ h: 'Conditional sample space', d: `${den} students` }, { h: 'Probability', d: `$\\dfrac{${num}}{${den}} = ${new Frac(num, den).latex()}$` }]
        });
      }
    },
    { // MCQ: which calculation
      make: (rng) => {
        const r = ri(rng, 2, 9), b = ri(rng, 1, 9), n = r + b, t = (x, y) => `$\\dfrac{${x}}{${y}}$`;
        const correct = `${t(r, n)}$\\times$${t(r - 1, n - 1)}`;
        return M(rng, `A bag holds $${r}$ red and $${b}$ blue counters. Two counters are drawn one after the other without replacement. Which calculation gives the probability that both are red?`, correct, [
          { text: `${t(r, n)}$\\times$${t(r, n)}`, why: 'That is for drawing WITH replacement; the bag changes after the first draw.' },
          { text: `${t(r, n)}$+$${t(r - 1, n - 1)}`, why: '"Both" means multiply along the branches, not add.' },
          { text: `${t(r, n)}$\\times$${t(r - 1, n)}`, why: 'After one red counter is removed, only $n - 1$ counters remain, so the second denominator is $n - 1$.' }
        ], ['Without replacement: the second draw is from one fewer counter.', `After a red is taken: $${r - 1}$ red left among $${n - 1}$.`, 'Multiply along the branch.'], [{ h: 'First draw', d: `$P = \\dfrac{${r}}{${n}}$` }, { h: 'Second draw', d: `$\\dfrac{${r - 1}}{${n - 1}}$, so multiply` }]);
      }
    },
    { // attendance / Bayes style
      make: (rng) => {
        const s = ri(rng, 2, 18) * 5, p1 = ri(rng, 1, 19) * 5, p2 = ri(rng, 1, 19) * 5;
        const a = s * p1, o = (100 - s) * p2, f = new Frac(a, a + o);
        if (f.d === 1) return forms['y10-probability'][4].make(rng);
        return F(`In a regional town, $${s}\\%$ of people support the local footy club. Of its supporters, $${p1}\\%$ go to a given game; of the people who do not support the club, $${p2}\\%$ go to that game. A person at the game is chosen at random. Find the probability that they support the club, as a fraction in simplest form.`, f, {
          traps: [{ f: new Frac(s, 100), why: 'The question is conditional on being at the game, so supporters at the game are compared with all people at the game, not with the town.' }, { f: new Frac(p1, p1 + p2), why: 'The two groups have different sizes: weight each attendance rate by the percentage in its group.' }],
          hints: ['Imagine 10 000 people in the town.', `Supporters at the game: $${s}\\%\\times${p1}\\%$; others at the game: $${100 - s}\\%\\times${p2}\\%$.`, 'Divide supporters at the game by everyone at the game.'],
          steps: [{ h: 'Weights', d: `supporters $${s}\\times ${p1} = ${a}$; others $${100 - s}\\times ${p2} = ${o}$` }, { h: 'Probability', d: `$\\dfrac{${a}}{${a + o}} = ${f.latex()}$` }]
        });
      }
    },
    { // inclusion-exclusion
      make: (rng) => {
        const d = rc(rng, [12, 20, 24, 30, 36, 40]);
        let nA, nB, nAB;
        do { nA = ri(rng, 3, d - 3); nB = ri(rng, 3, d - 3); nAB = ri(rng, 1, Math.min(nA, nB) - 1); } while (nA + nB - nAB >= d - 1);
        const w = rc(rng, ['union', 'neither', 'Aonly']);
        const key = new Frac(w === 'union' ? nA + nB - nAB : w === 'neither' ? d - nA - nB + nAB : nA - nAB, d);
        if (key.d === 1) return forms['y10-probability'][5].make(rng);
        const trap = w === 'union' ? new Frac(nA + nB, d) : w === 'neither' ? new Frac(d - nA - nB, d) : new Frac(nA, d);
        const ask = w === 'union' ? '$P(A \\cup B)$' : w === 'neither' ? 'the probability that neither $A$ nor $B$ happens' : 'the probability that $A$ happens but $B$ does not';
        const pa = new Frac(nA, d), pb = new Frac(nB, d), pab = new Frac(nAB, d);
        return F(`$P(A) = ${pa.latex()}$, $P(B) = ${pb.latex()}$ and $P(A \\cap B) = ${pab.latex()}$. Find ${ask}, as a fraction in simplest form.`, key, {
          traps: [{ f: trap, why: w === 'Aonly' ? 'Remove the overlap: $P(A) - P(A\\cap B)$.' : 'The overlap $A\\cap B$ is counted twice in $P(A) + P(B)$: subtract it once.' }],
          hints: ['$P(A\\cup B) = P(A) + P(B) - P(A\\cap B)$.', `$${nA}/${d} + ${nB}/${d} - ${nAB}/${d}$.`, w === 'neither' ? 'Neither $= 1 - P(A\\cup B)$.' : w === 'Aonly' ? 'A only $= P(A) - P(A\\cap B)$.' : 'Simplify.'],
          steps: [{ h: 'Union', d: `$P(A\\cup B) = \\dfrac{${nA + nB - nAB}}{${d}}$` }, { h: 'Answer', d: `$${key.latex()}$` }]
        });
      }
    },
    { // total probability, two-stage tree
      make: (rng) => {
        const dd = [2, 3, 4, 5, 10];
        const pa = new Frac(ri(rng, 1, 3) , rc(rng, [4, 5, 10])), p1 = new Frac(ri(rng, 1, 4), rc(rng, dd.filter(v => v >= 3 ))), p2 = new Frac(ri(rng, 1, 3), rc(rng, [4, 5, 10]));
        if (pa.value >= 1 || p1.value >= 1 || p2.value >= 1) return forms['y10-probability'][6].make(rng);
        const key = pa.mul(p1).add(new Frac(1, 1).sub(pa).mul(p2));
        if (key.d === 1) return forms['y10-probability'][6].make(rng);
        return F(`The probability that it rains in Sydney on Saturday is $${pa.latex()}$. If it rains on Saturday, the probability it rains on Sunday is $${p1.latex()}$; if it does not rain on Saturday, the probability it rains on Sunday is $${p2.latex()}$. Find the probability that it rains on Sunday, as a fraction in simplest form.`, key, {
          traps: [{ f: pa.mul(p1), why: 'It can rain on Sunday after a dry Saturday as well: add the second branch.' }, { f: p1.add(p2), why: 'Weight each branch by the probability of reaching it before adding.' }],
          hints: ['Draw a two-stage tree: rain/dry on Saturday, then rain on Sunday.', `Wet-wet: $${pa.latex()}\\times ${p1.latex()}$.`, `Dry-wet: $${new Frac(1, 1).sub(pa).latex()}\\times ${p2.latex()}$.`],
          steps: [{ h: 'Two branches', d: `$${pa.mul(p1).latex()} + ${new Frac(1, 1).sub(pa).mul(p2).latex()}$` }, { h: 'Add', d: `$${key.latex()}$` }]
        });
      }
    }
  ]
};

export const forms = Object.fromEntries(Object.entries(rawForms).map(([k, v]) => [k, tidyForms(v)]));
