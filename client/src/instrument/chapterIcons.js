// Pri Learning · the syllabus map's chapter glyphs.
//
// One family: 24 × 24, a single 1.5 px line in currentColor, round caps and
// joins, no fills, drawn by hand as paths (no icon font, no emoji, no new
// colour). Each is a small mathematical figure for its topic. A glyph is
// decoration: the chapter's name is always the accessible name, so every
// glyph is aria-hidden.
//
// iconFor(id, strand) is total: the first rule that matches the chapter id
// wins (the rules are ordered most specific first); a chapter no rule names
// falls back to its strand's glyph, and then to the function plot, so no
// chapter is ever without one. client/test/map-layout-check.mjs resolves
// every chapter of every course of both editions.

const dot = (x, y, r = 1.1) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const ring = (x, y, r) => dot(x, y, r);
const AX = 'M4 4V20H20';
const MAT = [dot(10, 9, 0.9), dot(14, 9, 0.9), dot(10, 15, 0.9), dot(14, 15, 0.9)];

export const GLYPHS = {
  tangent: ['M4 5Q12 27 20 5', 'M11.5 20L20 8.5', dot(16, 13.25, 1.3)],
  area: ['M3 20H21', 'M4 16C9 4 15 4 20 14', 'M8 20V9.2M12 20V6.8M16 20V8.6'],
  wave: ['M2 12C5 3 8 3 12 12S19 21 22 12'],
  bell: ['M2 20H22', 'M3 20C8 20 9 5 12 5S16 20 21 20'],
  bars: ['M5 20V13H9V20M10 20V6H14V20M15 20V10H19V20'],
  coins: ['M5 8a7 3 0 1 0 14 0a7 3 0 1 0-14 0', 'M5 8V12a7 3 0 0 0 14 0V8', 'M5 12V16a7 3 0 0 0 14 0V12'],
  percent: [ring(6.5, 6.5, 2.5), ring(17.5, 17.5, 2.5), 'M19 5L5 19'],
  dots: [dot(5, 17, 0.9), dot(10, 13.5, 1.3), dot(15, 10, 1.7), dot(20, 6.5, 2.1)],
  triangle: ['M4 20V5L20 20Z', 'M4 15H9V20'],
  fx: ['M11 20V9C11 6 12 5 15 5', 'M8 11H14', 'M15.5 13.5L20.5 19.5M20.5 13.5L15.5 19.5'],
  vector: ['M4 20L19 5', 'M12 5H19V12'],
  pascal: [dot(12, 5, 1.2), dot(9, 11, 1.2), dot(15, 11, 1.2), dot(6, 17, 1.2), dot(12, 17, 1.2), dot(18, 17, 1.2)],
  circle: ['M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 12H20', dot(12, 12, 0.8)],
  numberline: ['M3 12H21', 'M18 9L21 12L18 15', 'M6 9.5V14.5M11 9.5V14.5M16 9.5V14.5'],
  plusminus: ['M12 3V11M8 7H16', 'M8 18H16'],
  fraction: ['M5 12H19', dot(12, 6.5, 1.3), dot(12, 17.5, 1.3)],
  decimal: ['M3.5 12a2.8 5 0 1 0 5.6 0a2.8 5 0 1 0-5.6 0', 'M14.9 12a2.8 5 0 1 0 5.6 0a2.8 5 0 1 0-5.6 0', dot(12, 16.5, 0.9)],
  ratio: ['M3 7H9V17H3Z', 'M15 7H21V17H15Z', dot(12, 10.5, 0.8), dot(12, 13.5, 0.8)],
  algebra: ['M4 6L11 18M11 6L4 18', 'M14.5 9H21M14.5 15H21'],
  angle: ['M4 20H20M4 20L16 7', 'M11 20A7 7 0 0 0 8.8 14.9'],
  rect: ['M4 6H20V18H4Z', 'M4 12H20M12 6V18'],
  cube: ['M12 3L20 7.5V16.5L12 21L4 16.5V7.5Z', 'M4 7.5L12 12L20 7.5M12 12V21'],
  scatter: [AX, dot(8, 15, 0.9), dot(11, 12, 0.9), dot(14, 13, 0.9), dot(17, 8, 0.9), 'M6 17L19 7'],
  dice: ['M5 5H19V19H5Z', dot(9, 9, 0.8), dot(15, 9, 0.8), dot(12, 12, 0.8), dot(9, 15, 0.8), dot(15, 15, 0.8)],
  power: ['M3 10L10 20M10 10L3 20', 'M14 7.5C14 3.5 20 3.5 20 7.5C20 10 14 11 14 12.5H20'],
  surd: ['M3 13L6 12L9 19L13 5H21'],
  parabola: ['M5 4Q12 28 19 4'],
  line: [AX, 'M6 17L19 6'],
  cubic: ['M3 19C10 28 10-4 21 5'],
  log: [AX, 'M6 19C7 10 12 8 19 7'],
  exp: [AX, 'M6 19C12 19 16 15 19 6'],
  matrix: ['M8 4H5V20H8M16 4H19V20H16', ...MAT],
  determinant: ['M7 4V20M17 4V20', ...MAT],
  complex: ['M12 3V21M3 12H21', dot(17, 7, 1.2), 'M12 12L17 7'],
  venn: ['M3 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0', 'M9 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0'],
  swap: [dot(6, 6, 1.1), dot(12, 6, 1.1), dot(18, 6, 1.1), dot(6, 18, 1.1), dot(12, 18, 1.1), dot(18, 18, 1.1), 'M6 7.5L12 16.5M12 7.5L6 16.5M18 7.5V16.5'],
  ellipse: ['M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0', dot(9, 12, 0.8), dot(15, 12, 0.8)],
  axes3: ['M12 12V3M12 12L20 17M12 12L4 17'],
  stairs: ['M3 20H8V15H13V10H18V5H21'],
  proof: ['M5 5H19V19H5Z', 'M8.5 12L11 14.5L16 9'],
  gauge: ['M4 17A8 8 0 0 1 20 17', 'M12 17L16 10', 'M3 17H5M19 17H21'],
  network: [ring(6, 6, 2), ring(18, 7, 2), ring(12, 18, 2), 'M8 6.3L16 6.7M7 8L11 16M17 9L13 16'],
  bolt: ['M13 3L6 13H12L11 21L18 10H12Z'],
  clock: ['M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 7V12L15.5 14'],
  ineq: ['M18 5L7 12L18 19', 'M7 21H18'],
  arc: [AX, 'M6 19A14 14 0 0 1 19 6'],
  unitcircle: ['M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 12L17.7 6.3M17.7 6.3V12'],
  similar: ['M3 20L12 4L21 20Z', 'M7.5 20L12 12L16.5 20'],
  polygon: ['M12 3L21 10L17.5 20H6.5L3 10Z'],
  parallelogram: ['M7 6H21L17 18H3Z'],
  parallel: ['M3 8H21M3 16H21', 'M8 3L16 21'],
  field: ['M4 8L8 6M10 8H14M16 8L20 10', 'M4 15L8 14M10 15L14 17M16 15L20 19'],
  projectile: ['M3 20H21', 'M4 19Q12-3 20 19'],
  incircle: ['M3 20L12 4L21 20Z', 'M8.5 15a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0'],
  hash: ['M10 4L8 20M16 4L14 20M4 9H20M4 15H20']
};

// Most specific first. Matched against the chapter id.
const RULES = [
  [/linear-programming|geo-figures|constructions|polygon/, 'polygon'],
  [/linear-inequalities|inequal/, 'ineq'],
  [/differential-equations/, 'field'],
  [/further-calc|integral|integration/, 'area'],
  [/trigid|trig-ident|trig-any-angle/, 'unitcircle'],
  [/inverse/, 'arc'],
  [/trig-model|trigfunc|trig-functions|trigeq|trigcalc/, 'wave'],
  [/explog|explogcalc/, 'exp'],
  [/logarithm/, 'log'],
  [/diff|derivative|limits|continuity|me12-calc/, 'tangent'],
  [/rate|motion/, 'gauge'],
  [/projectile|mechanics/, 'projectile'],
  [/induction/, 'stairs'],
  [/proof/, 'proof'],
  [/permutations/, 'swap'],
  [/binomial|comb|pascal/, 'pascal'],
  [/sequence|series|progression/, 'dots'],
  [/network|critical|flow/, 'network'],
  [/fin-|financ|loans|annuity|invest|interest|simint|compound|earning|depreciation|managing/, 'coins'],
  [/normal|random-var/, 'bell'],
  [/bivariate/, 'scatter'],
  [/probab/, 'dice'],
  [/stats|statistics|data|relfreq/, 'bars'],
  [/matrices/, 'matrix'],
  [/determinants/, 'determinant'],
  [/complex|demoivre/, 'complex'],
  [/vector/, 'vector'],
  [/3d/, 'axes3'],
  [/conic/, 'ellipse'],
  [/olymp-geometry/, 'incircle'],
  [/number-theory/, 'hash'],
  [/circle/, 'circle'],
  [/similarity|twins/, 'similar'],
  [/quadrilaterals/, 'parallelogram'],
  [/parallel/, 'parallel'],
  [/angles/, 'angle'],
  [/pythagoras|nonright|right-triangle|triangles|-trig$|trigonometry|sine-cosine|trig-nonright|trig-applications/, 'triangle'],
  [/volume|surface|solids/, 'cube'],
  [/area|perimeter|mensuration|measure/, 'rect'],
  [/energy/, 'bolt'],
  [/time-location/, 'clock'],
  [/fractions|rational/, 'fraction'],
  [/decimals-perc|percent|comparing/, 'percent'],
  [/decimal/, 'decimal'],
  [/integer|number-play/, 'plusminus'],
  [/number-systems|real-numbers|large-numbers|arithmetic/, 'numberline'],
  [/ratio|proportion/, 'ratio'],
  [/indices|exponents/, 'power'],
  [/surds|roots/, 'surd'],
  [/quadratic|quadfunc|nonlinear/, 'parabola'],
  [/poly/, 'cubic'],
  [/sets|common-ground/, 'venn'],
  [/simeq|pair-linear|linear|lines|straight|graphs|coordinate|connecting-dots|variation/, 'line'],
  [/relations|functions|func-model|transform/, 'fx'],
  [/algebra|equations|letter-numbers|finding-unknown|factorisation|identities|formulas|algebraic/, 'algebra']
];

const STRAND_FALLBACK = [
  [/number/i, 'numberline'], [/algebra/i, 'algebra'], [/geometry|measurement|mensuration/i, 'polygon'],
  [/statistic|probab|data/i, 'bars'], [/financ/i, 'coins'], [/function/i, 'fx'], [/trig/i, 'triangle'],
  [/calculus/i, 'tangent'], [/coord/i, 'line'], [/vector|3d/i, 'vector'], [/combin/i, 'pascal'], [/reason|proof/i, 'proof']
];

/** { key, via } — the glyph for a chapter: by id, else by strand, else the function plot. */
export function iconFor(id, strand = '') {
  const s = String(id || '');
  for (const [re, key] of RULES) if (re.test(s)) return { key, via: 'id' };
  for (const [re, key] of STRAND_FALLBACK) if (re.test(String(strand))) return { key, via: 'strand' };
  return { key: 'fx', via: 'default' };
}
