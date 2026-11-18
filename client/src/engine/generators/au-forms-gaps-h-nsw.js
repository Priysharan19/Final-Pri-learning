// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms E
//   y12-appdiff D3 (tangents, normals, stationary points, models)
//   me11-comb   D3 (selections and committees with conditions)
// Variants are chosen by au-forms-apply.js. Every key is computed in code from the
// numbers the prompt shows (the AI never sets a mark). All forms are original.
// SYNTHETIC: no student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, mcq, poly } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
const R = fn => (rng, diff) => {
  for (let i = 0; i < 300; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-e variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });

const fin = v => typeof v === 'number' && Number.isFinite(v);
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const choose = (n, k) => (k < 0 || k > n ? 0 : fact(n) / (fact(k) * fact(n - k)));
const fr = (n, d = 1) => { const g = gcd(n, d) || 1; const s = d < 0 ? -1 : 1; return [s * n / g, s * d / g]; };
const fmul = (a, b) => fr(a[0] * b[0], a[1] * b[1]);
const fsub = (a, b) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const ftxt = ([n, d]) => (d === 1 ? `${n}` : `${n}/${d}`);
const ftex = ([n, d]) => (d === 1 ? `${n}` : `${n < 0 ? '-' : ''}\\dfrac{${Math.abs(n)}}{${d}}`);
/** key text (engine expression) and LaTeX of the line y = s x + c, through (x0, y0) with slope s. */
function line(s, x0, y0) {
  const c = fsub(fr(y0), fmul(s, fr(x0)));
  const [sn, sd] = s;
  const sx = sd === 1 ? (sn === 1 ? 'x' : sn === -1 ? '-x' : `${sn}x`) : `${sn < 0 ? '-' : ''}${Math.abs(sn) === 1 ? '' : Math.abs(sn)}x/${sd}`;
  const stex = sd === 1 ? (sn === 1 ? 'x' : sn === -1 ? '-x' : `${sn}x`) : `${sn < 0 ? '-' : ''}\\dfrac{${Math.abs(sn)}}{${sd}}x`;
  const neg = c[0] < 0;
  const ct = c[0] === 0 ? '' : ` ${neg ? '-' : '+'} ${ftxt([Math.abs(c[0]), c[1]])}`;
  const ctex = c[0] === 0 ? '' : ` ${neg ? '-' : '+'} ${ftex([Math.abs(c[0]), c[1]])}`;
  return { expr: `${sx}${ct}`, tex: `${stex}${ctex}`, c };
}

function numeric(prompt, value, { prefix, suffix, traps = [], hints, steps, dotpoint, hint } = {}) {
  rej(!fin(value) || !Number.isInteger(value));
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) { if (!fin(t.value) || seen.has(t.value)) continue; seen.add(t.value); tr.push(t); }
  const q = { dotpoint, prompt, answerType: 'numeric', answer: { value }, traps: tr, hints, steps };
  if (prefix) q.answerPrefix = prefix;
  if (suffix) q.answerSuffix = suffix;
  if (hint) q.inputHint = hint;
  return q;
}

// ═════════════════════ me11-comb · D3 · selections with conditions ═════════════════════
const GROUPS = ['students', 'members of a robotics club', 'volunteers', 'teachers', 'players', 'council members'];
const PAIRS = [['Asha', 'Ben'], ['Chloe', 'Tom'], ['Mei', 'Jack'], ['Zara', 'Leo'], ['Nina', 'Omar']];
const cnt = (prompt, value, o) => {
  rej(!Number.isInteger(value) || value <= 0);
  const q = { dotpoint: 1, prompt, answerType: 'numeric', answer: { value }, traps: [], hints: o.hints, steps: o.steps };
  const seen = new Set([value]);
  for (const t of o.traps) if (Number.isInteger(t.value) && t.value > 0 && !seen.has(t.value)) { seen.add(t.value); q.traps.push(t); }
  return q;
};
const comb = [
  // two named people must both serve
  V([3], rng => {
    const n = ri(rng, 8, 14), k = ri(rng, 3, 5), [p, q] = rc(rng, PAIRS), who = rc(rng, GROUPS);
    const val = choose(n - 2, k - 2);
    return cnt(`A committee of $${k}$ is to be chosen from $${n}$ ${who}, including ${p} and ${q}. ${p} and ${q} have both agreed to serve, and must **both** be on the committee. How many committees are possible?`, val, {
      traps: [{ value: choose(n, k), why: `That ignores the condition. Once ${p} and ${q} are in, only the remaining places are chosen freely.` }, { value: choose(n - 2, k), why: `${p} and ${q} are already on the committee, so they fill two of the $${k}$ places; do not choose $${k}$ from the others.` }],
      hints: [`Put ${p} and ${q} on the committee first. How many places are left, and how many people can fill them?`, `There are $${k} - 2 = ${k - 2}$ places left and $${n} - 2 = ${n - 2}$ people to choose from.`, `Count the ways to choose $${k - 2}$ people from $${n - 2}$.`],
      steps: [{ h: 'Fix the two named people', d: `${p} and ${q} are in: $${k - 2}$ places remain, $${n - 2}$ people available` }, { h: 'Choose the rest', d: `$\\binom{${n - 2}}{${k - 2}} = ${val}$` }]
    });
  }),
  // two named people cannot both serve
  V([3], rng => {
    const n = ri(rng, 8, 14), k = ri(rng, 3, 5), [p, q] = rc(rng, PAIRS), who = rc(rng, GROUPS);
    const both = choose(n - 2, k - 2), val = choose(n, k) - both;
    return cnt(`A committee of $${k}$ is to be chosen from $${n}$ ${who}, including ${p} and ${q}. Because of a disagreement, ${p} and ${q} must **not both** be on the committee (either one alone is acceptable). How many committees are possible?`, val, {
      traps: [{ value: both, why: `$${both}$ counts the committees that contain both of them: the forbidden ones. Subtract these from the total.` }, { value: choose(n, k) - 2 * choose(n - 1, k - 1), why: 'Do not remove the committees that contain only one of them: these are allowed.' }, { value: choose(n, k), why: 'That counts every committee, including those with both people. Remove the ones that break the condition.' }],
      hints: ['Count all committees, then subtract the ones that break the rule.', `All committees: $\\binom{${n}}{${k}}$. Committees with both ${p} and ${q}: choose the other $${k - 2}$ from $${n - 2}$.`, 'Subtract the second count from the first.'],
      steps: [{ h: 'All committees', d: `$\\binom{${n}}{${k}} = ${choose(n, k)}$` }, { h: 'Both named people included', d: `$\\binom{${n - 2}}{${k - 2}} = ${both}$` }, { h: 'Subtract', d: `$${choose(n, k)} - ${both} = ${val}$` }]
    });
  }),
  // hand of cards with at least one ace
  V([3], rng => {
    const k = ri(rng, 2, 4);
    const val = choose(52, k) - choose(48, k);
    return cnt(`A hand of $${k}$ cards is dealt from a standard pack of $52$ cards, which contains $4$ aces. How many different hands contain **at least one ace**?`, val, {
      traps: [{ value: choose(48, k), why: `$\\binom{48}{${k}}$ counts hands with no ace at all: these are the ones to remove.` }, { value: 4 * choose(51, k - 1), why: 'This counts a hand with several aces more than once (once for each ace you could have called the chosen one).' }, { value: choose(52, k), why: 'That counts every hand, including hands with no ace.' }],
      hints: ['"At least one" is easiest by complement: all hands minus hands with no ace.', `Hands with no ace are chosen from the $52 - 4 = 48$ other cards.`, `Compute $\\binom{52}{${k}} - \\binom{48}{${k}}$.`],
      steps: [{ h: 'All hands', d: `$\\binom{52}{${k}} = ${choose(52, k)}$` }, { h: 'No ace', d: `$\\binom{48}{${k}} = ${choose(48, k)}$` }, { h: 'Complement', d: `$${choose(52, k)} - ${choose(48, k)} = ${val}$` }]
    });
  }),
  // team then a captain from the team
  V([3], rng => {
    const n = ri(rng, 7, 14), k = ri(rng, 3, 6), who = rc(rng, GROUPS);
    const val = choose(n, k) * k;
    return cnt(`A team of $${k}$ is chosen from $${n}$ ${who}, and then one member of the team is appointed captain. How many different outcomes (team together with its captain) are possible?`, val, {
      traps: [{ value: choose(n, k), why: 'That only chooses the team. Each team can have any of its members as captain.' }, { value: choose(n, k) * n, why: 'The captain must come from the team that was chosen, so there are $' + k + '$ choices, not $' + n + '$.' }, { value: choose(n, k) + k, why: 'The team and the captain are chosen one after the other, so the counts multiply; they are not added.' }],
      hints: ['Choose the team first, then the captain.', `The number of teams is $\\binom{${n}}{${k}}$.`, `Each team has $${k}$ possible captains: multiply.`],
      steps: [{ h: 'Choose the team', d: `$\\binom{${n}}{${k}} = ${choose(n, k)}$` }, { h: 'Choose the captain from the team', d: `$${k}$ ways each` }, { h: 'Multiply', d: `$${choose(n, k)} \\times ${k} = ${val}$` }]
    });
  }),
  // polygons from points on a circle through a fixed point
  V([3], rng => {
    const n = ri(rng, 7, 14), k = rc(rng, [3, 4, 4]);
    const val = choose(n - 1, k - 1);
    const shape = k === 3 ? 'triangles' : 'quadrilaterals';
    return cnt(`$${n}$ points lie on a circle, and one of them is labelled $P$. How many different ${shape} can be formed using these points as vertices, if $P$ must be one of the vertices?`, val, {
      traps: [{ value: choose(n, k), why: 'That counts every such shape, whether or not it uses $P$.' }, { value: choose(n - 1, k), why: 'That chooses all $' + k + '$ vertices from the other points, so $P$ is never used.' }, { value: choose(n, k) - choose(n - 1, k - 1), why: 'That counts the shapes that do NOT use $P$.' }],
      hints: [`Because $P$ is a vertex, it takes care of one of the $${k}$ vertices.`, `The other $${k - 1}$ vertices come from the remaining $${n} - 1 = ${n - 1}$ points.`, `Any $${k}$ points on a circle form a ${k === 3 ? 'triangle' : 'quadrilateral'}, so just count the selections.`],
      steps: [{ h: 'Fix $P$', d: `$P$ is one vertex; $${k - 1}$ more are needed from $${n - 1}$ points` }, { h: 'Choose', d: `$\\binom{${n - 1}}{${k - 1}} = ${val}$` }]
    });
  }),
  // selections avoiding a set of excluded items
  V([3], rng => {
    const n = ri(rng, 9, 16), m = ri(rng, 2, 4), k = ri(rng, 3, 5);
    rej(n - m < k);
    const item = rc(rng, ['books', 'photographs', 'songs', 'paintings']);
    const val = choose(n - m, k);
    return cnt(`A teacher has $${n}$ ${item}, of which $${m}$ are known to be unsuitable. In how many ways can a selection of $${k}$ ${item} be made that contains **none** of the unsuitable ones?`, val, {
      traps: [{ value: choose(n, k), why: 'That allows the unsuitable ones to be chosen. Remove them from the pool first.' }, { value: choose(n, k) - choose(n - m, k), why: `That counts the selections containing at least one unsuitable item: the opposite of what is asked.` }],
      hints: ['The unsuitable items can never be chosen, so take them out of the pool.', `$${n} - ${m} = ${n - m}$ items remain to choose from.`, `Choose $${k}$ of these.`],
      steps: [{ h: 'Remove the unsuitable items', d: `$${n} - ${m} = ${n - m}$ items available` }, { h: 'Choose', d: `$\\binom{${n - m}}{${k}} = ${val}$` }]
    });
  }),
  // a president, then a committee from the remaining people
  V([3], rng => {
    const n = ri(rng, 7, 13), k = ri(rng, 2, 4), who = rc(rng, GROUPS);
    const val = n * choose(n - 1, k);
    return cnt(`From $${n}$ ${who}, a president is chosen, and then a committee of $${k}$ is chosen from the **remaining** people. How many different outcomes are possible?`, val, {
      traps: [{ value: choose(n, k + 1), why: 'That chooses a group of ' + (k + 1) + ' with no distinct president. The president is a different role from the committee members, so choose the president first.' }, { value: n * choose(n, k), why: 'The president cannot also sit on the committee, so the committee comes from the other $' + (n - 1) + '$ people.' }, { value: n + choose(n - 1, k), why: 'The president and the committee are chosen one after the other, so the counts multiply; they are not added.' }],
      hints: ['Count the choices for the president, then the choices for the committee.', `After the president is chosen, $${n - 1}$ people remain.`, `Multiply $${n}$ by the number of ways to choose $${k}$ from $${n - 1}$.`],
      steps: [{ h: 'President', d: `$${n}$ ways` }, { h: 'Committee from the rest', d: `$\\binom{${n - 1}}{${k}} = ${choose(n - 1, k)}$` }, { h: 'Multiply', d: `$${n} \\times ${choose(n - 1, k)} = ${val}$` }]
    });
  })
];


export const forms = { 'me11-comb': comb };
