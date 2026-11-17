// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · trigonometry slips (both editions)
//
// Right-triangle ratios, bearings, the sine and cosine rules, area, exact values
// and the quadrants. Each entry reads the issued question's prompt, works out
// the wrong answers a NAMED slip gives, and — when the student's answer is one
// of them — says which slip in a sentence made of the question's own numbers.
// Deterministic; marks are never read or changed (see slipKit.js).
// ─────────────────────────────────────────────────────────────────────────────
import { n4, rad, deg, SIN, COS, TAN } from '../slipKit.js';

const s = (en, hi) => ({ en, hi, 'en-AU': en });
const FN = { sin: SIN, cos: COS, tan: TAN };
const FN_RAD = { sin: x => Math.sin(x), cos: x => Math.cos(x), tan: x => Math.tan(x) };
const SIDE_WORD = { hyp: 'hypotenuse', opp: 'opposite', adj: 'adjacent' };
const SIDE_HI = { hyp: 'कर्ण', opp: 'सम्मुख भुजा', adj: 'संलग्न भुजा' };
const num = m => Number(m);

// ── A · A right triangle: one side and an angle given, another side wanted ──
// opp = hyp·sin, adj = hyp·cos, opp = adj·tan; the unknown on the bottom divides.
const RT = {
  'hyp>opp': { f: 'sin', op: '*' }, 'hyp>adj': { f: 'cos', op: '*' },
  'opp>hyp': { f: 'sin', op: '/' }, 'opp>adj': { f: 'tan', op: '/' },
  'adj>hyp': { f: 'cos', op: '/' }, 'adj>opp': { f: 'tan', op: '*' }
};
const apply = (L, f, op, ang) => (op === '*' ? L * FN[f](ang) : L / FN[f](ang));

function rightTriangleSlips(p) {
  const { known, want, theta, L } = p;
  const { f, op } = RT[`${known}>${want}`];
  const out = [];
  const other = op === '*' ? '/' : '*';
  // the right ratio, the wrong way up: multiplied where the unknown is on the bottom, or the reverse
  out.push({ id: 'trig-ratio-inverted', value: apply(L, f, other, theta), say: s(
    op === '/'
      ? `The ${SIDE_WORD[want]} is on the bottom of ${f} ${theta}° = ${SIDE_WORD[f === 'cos' && known === 'adj' ? 'adj' : f === 'sin' ? 'opp' : f === 'cos' ? 'adj' : 'opp']} ÷ ${SIDE_WORD[f === 'tan' ? 'adj' : 'hyp']}, so divide ${n4(L)} by ${f} ${theta}° (${n4(FN[f](theta))}); you multiplied and got ${n4(apply(L, f, other, theta))}.`
      : `${f} ${theta}° = ${SIDE_WORD[f === 'sin' ? 'opp' : f === 'cos' ? 'adj' : 'opp']} ÷ ${SIDE_WORD[f === 'tan' ? 'adj' : 'hyp']}, and the ${SIDE_WORD[want]} is on top, so multiply ${n4(L)} by ${f} ${theta}° (${n4(FN[f](theta))}); you divided and got ${n4(apply(L, f, other, theta))}.`,
    op === '/'
      ? `${SIDE_HI[want]} ${f} ${theta}° के हर में है, इसलिए ${n4(L)} को ${f} ${theta}° (${n4(FN[f](theta))}) से भाग दें; आपने गुणा करके ${n4(apply(L, f, other, theta))} पाया।`
      : `${SIDE_HI[want]} ${f} ${theta}° के अंश में है, इसलिए ${n4(L)} को ${f} ${theta}° (${n4(FN[f](theta))}) से गुणा करें; आपने भाग देकर ${n4(apply(L, f, other, theta))} पाया।`) });
  // the wrong ratio (sin, cos or tan) on the same side, either way up
  for (const g of ['sin', 'cos', 'tan']) {
    if (g === f) continue;
    for (const o of ['*', '/']) {
      out.push({ id: 'trig-wrong-ratio', value: apply(L, g, o, theta), say: s(
        `${g} ${theta}° is not the ratio that joins the ${SIDE_WORD[known]} and the ${SIDE_WORD[want]}: that is ${f} ${theta}°. Using ${g} ${theta}° (${n4(FN[g](theta))}) gives ${n4(apply(L, g, o, theta))}.`,
        `${SIDE_HI[known]} और ${SIDE_HI[want]} को ${g} ${theta}° नहीं, ${f} ${theta}° जोड़ता है। ${g} ${theta}° (${n4(FN[g](theta))}) से ${n4(apply(L, g, o, theta))} मिलता है।`) });
    }
  }
  // the calculator left in radians
  out.push({ id: 'trig-calculator-radians', value: op === '*' ? L * FN_RAD[f](theta) : L / FN_RAD[f](theta), say: s(
    `${f} ${theta} was worked out in radians: the angle is ${theta} degrees, so switch the calculator to degrees (${f} ${theta}° = ${n4(FN[f](theta))}, not ${n4(FN_RAD[f](theta))}).`,
    `${f} ${theta} रेडियन में निकाला गया: कोण ${theta} डिग्री है, इसलिए कैलकुलेटर को डिग्री पर रखें (${f} ${theta}° = ${n4(FN[f](theta))}, ${n4(FN_RAD[f](theta))} नहीं)।`) });
  // the other acute angle
  const co = 90 - theta;
  out.push({ id: 'trig-complement-angle', value: apply(L, f, op, co), say: s(
    `${co}° is the other acute angle; the marked angle is ${theta}°, so use ${f} ${theta}° (${n4(FN[f](theta))}), not ${f} ${co}°.`,
    `${co}° दूसरा न्यून कोण है; चिह्नित कोण ${theta}° है, इसलिए ${f} ${co}° नहीं, ${f} ${theta}° लें।`) });
  return out;
}

const readRightTriangle = q => {
  const t = String(q.prompt);
  let m;
  if ((m = t.match(/hypotenuse is \$(\d+(?:\.\d+)?)\$ \w+ and the marked angle is \$(\d+)°\$.*?\*\*(adjacent|opposite)\*\*/))) {
    return { known: 'hyp', want: m[3] === 'adjacent' ? 'adj' : 'opp', theta: num(m[2]), L: num(m[1]) };
  }
  if ((m = t.match(/side opposite the \$(\d+)°\$ angle is \$(\d+(?:\.\d+)?)\$ \w+\. Find the \*\*hypotenuse\*\*/))) return { known: 'opp', want: 'hyp', theta: num(m[1]), L: num(m[2]) };
  if ((m = t.match(/side adjacent to the \$(\d+)°\$ angle is \$(\d+(?:\.\d+)?)\$ \w+\. Find the opposite side/))) return { known: 'adj', want: 'opp', theta: num(m[1]), L: num(m[2]) };
  if ((m = t.match(/angle of elevation to the top of a \$(\d+(?:\.\d+)?)\$ m tower is \$(\d+)°\$.*?base/))) return { known: 'opp', want: 'adj', theta: num(m[2]), L: num(m[1]) };
  if ((m = t.match(/From a point \$(\d+(?:\.\d+)?)\$ m from the base of a building, the angle of elevation to the roof is \$(\d+)°\$.*?height/))) return { known: 'adj', want: 'opp', theta: num(m[2]), L: num(m[1]) };
  if ((m = t.match(/From the top of a \$(\d+(?:\.\d+)?)\$ m cliff, the angle of \*\*depression\*\* to a boat is \$(\d+)°\$/))) return { known: 'opp', want: 'adj', theta: num(m[2]), L: num(m[1]) };
  return null;
};

// ── Bearings: east displacement and the bearing of a hiker ──
const bearingEast = {
  id: 'trig-bearing-east',
  read(q) {
    const m = String(q.prompt).match(/A yacht sails \$(\d+(?:\.\d+)?)\$ km on a bearing of \$(\d+)°\$T.*?\*\*east\*\*/);
    return m ? { d: num(m[1]), b: num(m[2]) } : null;
  },
  slips({ d, b }) {
    return [
      { id: 'trig-bearing-from-east', value: d * COS(b), say: s(
        `Bearings are measured from north, so the east displacement uses sin ${b}°, not cos ${b}°: ${n4(d)} × cos ${b}° (= ${n4(d * COS(b))}, your value) is the north–south part.`,
        `दिशा-कोण उत्तर से नापे जाते हैं, इसलिए पूर्व की ओर दूरी में sin ${b}° आता है, cos ${b}° नहीं: ${n4(d)} × cos ${b}° (= ${n4(d * COS(b))}, आपका मान) उत्तर–दक्षिण वाला भाग है।`) },
      { id: 'trig-calculator-radians', value: d * Math.sin(b), say: s(
        `sin ${b} was worked out in radians: the bearing is ${b} degrees, so put the calculator in degree mode.`,
        `sin ${b} रेडियन में निकाला गया: दिशा-कोण ${b} डिग्री है, इसलिए कैलकुलेटर को डिग्री मोड में रखें।`) },
      { id: 'trig-wrong-ratio', value: d * TAN(b), say: s(
        `The east displacement is ${n4(d)} × sin ${b}°, not ${n4(d)} × tan ${b}°: the hypotenuse ${n4(d)} km is the distance sailed.`,
        `पूर्व की दूरी ${n4(d)} × sin ${b}° है, ${n4(d)} × tan ${b}° नहीं: कर्ण ${n4(d)} km चली हुई दूरी है।`) }
    ];
  }
};

const bearingHiker = {
  id: 'trig-bearing-hiker',
  read(q) {
    const m = String(q.prompt).match(/A hiker walks \$(\d+)\$ km due north, then \$(\d+)\$ km due east.*?\*\*bearing\*\*/);
    return m ? { N: num(m[1]), E: num(m[2]) } : null;
  },
  slips({ N, E }) {
    return [
      { id: 'trig-bearing-from-east-axis', value: deg(Math.atan2(N, E)), say: s(
        `A bearing is the angle from north, so tan θ = east ÷ north = ${n4(E)} ÷ ${n4(N)}. Your ${n4(deg(Math.atan2(N, E)))}° is the angle from the east line.`,
        `दिशा-कोण उत्तर से नापा जाता है, इसलिए tan θ = पूर्व ÷ उत्तर = ${n4(E)} ÷ ${n4(N)}। आपका ${n4(deg(Math.atan2(N, E)))}° पूर्व रेखा से बना कोण है।`) },
      { id: 'trig-ratio-flipped-angle', value: deg(Math.atan(N / E)), say: s(
        `tan θ = opposite ÷ adjacent = ${n4(E)} ÷ ${n4(N)} (east over north), not ${n4(N)} ÷ ${n4(E)}.`,
        `tan θ = सम्मुख ÷ संलग्न = ${n4(E)} ÷ ${n4(N)} (पूर्व ÷ उत्तर) है, ${n4(N)} ÷ ${n4(E)} नहीं।`) }
    ];
  }
};

// ── Pythagoras (right-triangle problems without an angle) ──
const pythagoras = {
  id: 'trig-pythagoras',
  read(q) {
    const t = String(q.prompt);
    let m;
    if ((m = t.match(/perpendicular sides of \$(\d+)\$ cm and \$(\d+)\$ cm.*hypotenuse/))) return { kind: 'hyp', a: num(m[1]), b: num(m[2]) };
    if ((m = t.match(/\$(\d+)\$ m long.*?(?:ladder|wire|support wire).*?|(?:ladder|wire) \$(\d+)\$ m long/))) { /* fallthrough below */ }
    if ((m = t.match(/\$(\d+)\$ m long (?:runs|leans).*?(?:lower end is|top is) \$(\d+)\$ m (?:from the base|above the ground)\. (How high|How far)/))) {
      return { kind: 'leg', h: num(m[1]), a: num(m[2]) };
    }
    if ((m = t.match(/A (?:ladder|support wire) \$?(\d+)\$? m long[^$]*(?:lower end|top)[^$]*\$(\d+)\$ m/))) return { kind: 'leg', h: num(m[1]), a: num(m[2]) };
    return null;
  },
  slips(p) {
    if (p.kind === 'hyp') {
      return [
        { id: 'pythag-added-sides', value: p.a + p.b, say: s(
          `The hypotenuse is √(${n4(p.a)}² + ${n4(p.b)}²), not ${n4(p.a)} + ${n4(p.b)}: add the squares, then take the square root.`,
          `कर्ण √(${n4(p.a)}² + ${n4(p.b)}²) है, ${n4(p.a)} + ${n4(p.b)} नहीं: वर्गों का योग करके वर्गमूल लें।`) },
        { id: 'pythag-no-root', value: p.a * p.a + p.b * p.b, say: s(
          `${n4(p.a)}² + ${n4(p.b)}² = ${n4(p.a * p.a + p.b * p.b)} is the hypotenuse squared; take the square root to get the length.`,
          `${n4(p.a)}² + ${n4(p.b)}² = ${n4(p.a * p.a + p.b * p.b)} कर्ण का वर्ग है; लंबाई के लिए वर्गमूल लें।`) }
      ];
    }
    const { h, a } = p;
    return [
      { id: 'pythag-subtracted-sides', value: h - a, say: s(
        `The other side is √(${n4(h)}² − ${n4(a)}²), not ${n4(h)} − ${n4(a)}: square both, subtract, then take the square root.`,
        `दूसरी भुजा √(${n4(h)}² − ${n4(a)}²) है, ${n4(h)} − ${n4(a)} नहीं: दोनों का वर्ग करके घटाएँ, फिर वर्गमूल लें।`) },
      { id: 'pythag-leg-as-hyp', value: Math.sqrt(h * h + a * a), say: s(
        `${n4(h)} is the hypotenuse (the longest side), so the missing side is √(${n4(h)}² − ${n4(a)}²); you added the squares.`,
        `${n4(h)} कर्ण (सबसे लंबी भुजा) है, इसलिए छूटी भुजा √(${n4(h)}² − ${n4(a)}²) है; आपने वर्ग जोड़ दिए।`) },
      { id: 'pythag-no-root', value: h * h - a * a, say: s(
        `${n4(h)}² − ${n4(a)}² = ${n4(h * h - a * a)} is the square of the missing side; take the square root.`,
        `${n4(h)}² − ${n4(a)}² = ${n4(h * h - a * a)} छूटी भुजा का वर्ग है; वर्गमूल लें।`) }
    ];
  }
};

// ── The cosine rule: a side from two sides and the angle between them ──
const cosineRuleSide = {
  id: 'trig-cosine-rule-side',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/\$a = (\d+(?:\.\d+)?)\$ cm, \$b = (\d+(?:\.\d+)?)\$ cm and the (?:included|angle between them).*?\$C = (\d+)\^\\circ\$.*?length of \$c\$/);
    if (m) return { a: num(m[1]), b: num(m[2]), C: num(m[3]) };
    m = t.match(/sides \$b = (\d+(?:\.\d+)?)\$ cm and \$c = (\d+(?:\.\d+)?)\$ cm enclose the angle \$\\angle A = (\d+)°\$\. Find side \$a\$/);
    if (m) return { a: num(m[1]), b: num(m[2]), C: num(m[3]) };
    return null;
  },
  slips({ a, b, C }) {
    const c2 = a * a + b * b - 2 * a * b * COS(C);
    return [
      { id: 'cosine-rule-plus', value: Math.sqrt(a * a + b * b + 2 * a * b * COS(C)), say: s(
        `The cosine rule is c² = a² + b² − 2ab cos C: the 2ab cos C term is subtracted, but here it was added (which gives ${n4(Math.sqrt(a * a + b * b + 2 * a * b * COS(C)))}).`,
        `कोज्या नियम c² = a² + b² − 2ab cos C है: 2ab cos C घटाया जाता है, पर यहाँ जोड़ दिया गया (जिससे ${n4(Math.sqrt(a * a + b * b + 2 * a * b * COS(C)))} मिलता है)।`) },
      { id: 'cosine-rule-no-root', value: c2, say: s(
        `${n4(c2)} is c², the square of the side; take the square root to get the length.`,
        `${n4(c2)} भुजा का वर्ग c² है; लंबाई के लिए वर्गमूल लें।`) },
      { id: 'cosine-rule-pythagoras', value: Math.sqrt(a * a + b * b), say: s(
        `√(${n4(a)}² + ${n4(b)}²) is Pythagoras, which needs a right angle; this angle is ${C}°, so use c² = a² + b² − 2ab cos C.`,
        `√(${n4(a)}² + ${n4(b)}²) पाइथागोरस है जिसके लिए समकोण चाहिए; यह कोण ${C}° है, इसलिए c² = a² + b² − 2ab cos C लें।`) },
      { id: 'cosine-rule-factor-two', value: Math.sqrt(a * a + b * b - a * b * COS(C)), say: s(
        `The cosine rule has 2ab cos C, not ab cos C: the 2 was dropped.`,
        `कोज्या नियम में 2ab cos C है, ab cos C नहीं: 2 छूट गया।`) },
      { id: 'cosine-rule-order', value: Math.sqrt((a + b) * (a + b) - 2 * a * b * COS(C)), say: s(
        `(a + b)² is not a² + b²: the cosine rule starts from a² + b² − 2ab cos C.`,
        `(a + b)² और a² + b² एक नहीं हैं: कोज्या नियम a² + b² − 2ab cos C से शुरू होता है।`) },
      { id: 'trig-calculator-radians', value: Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C)), say: s(
        `cos ${C} was worked out in radians: the angle is ${C} degrees, so use degree mode.`,
        `cos ${C} रेडियन में निकाला गया: कोण ${C} डिग्री है, इसलिए डिग्री मोड रखें।`) }
    ];
  }
};

// ── Area of a triangle: ½ab sin C ──
const areaRule = {
  id: 'trig-area',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/\$a = (\d+(?:\.\d+)?)\$ cm, \$b = (\d+(?:\.\d+)?)\$ cm and the included angle \$C = (\d+)\^\\circ\$\. Find the area/);
    if (m) return { a: num(m[1]), b: num(m[2]), C: num(m[3]) };
    m = t.match(/Two sides of a triangle measure \$(\d+(?:\.\d+)?)\$ m and \$(\d+(?:\.\d+)?)\$ m, with an included angle of \$(\d+)°\$\. Find the area/);
    return m ? { a: num(m[1]), b: num(m[2]), C: num(m[3]) } : null;
  },
  slips({ a, b, C }) {
    return [
      { id: 'area-half-forgotten', value: a * b * SIN(C), say: s(
        `The area is ½ × ${n4(a)} × ${n4(b)} × sin ${C}°; your ${n4(a * b * SIN(C))} is double that: the ½ was left out.`,
        `क्षेत्रफल ½ × ${n4(a)} × ${n4(b)} × sin ${C}° है; आपका ${n4(a * b * SIN(C))} उसका दुगुना है: ½ छूट गया।`) },
      { id: 'area-right-angle-formula', value: 0.5 * a * b, say: s(
        `½ab is the area only for a right angle (sin 90° = 1); here the angle is ${C}°, so multiply by sin ${C}° = ${n4(SIN(C))}.`,
        `½ab केवल समकोण (sin 90° = 1) के लिए क्षेत्रफल है; यहाँ कोण ${C}° है, इसलिए sin ${C}° = ${n4(SIN(C))} से गुणा करें।`) },
      { id: 'area-cos-for-sin', value: 0.5 * a * b * COS(C), say: s(
        `The area formula uses sin C, not cos C: ½ × ${n4(a)} × ${n4(b)} × sin ${C}°.`,
        `क्षेत्रफल के सूत्र में sin C आता है, cos C नहीं: ½ × ${n4(a)} × ${n4(b)} × sin ${C}°।`) },
      { id: 'trig-calculator-radians', value: 0.5 * a * b * Math.sin(C), say: s(
        `sin ${C} was worked out in radians: the angle is ${C} degrees, so use degree mode.`,
        `sin ${C} रेडियन में निकाला गया: कोण ${C} डिग्री है, इसलिए डिग्री मोड रखें।`) }
    ];
  }
};

// ── The sine rule: a side, or an angle ──
const sineRuleSide = {
  id: 'trig-sine-rule-side',
  read(q) {
    const m = String(q.prompt).match(/\$\\angle A = (\d+)°\$, \$\\angle B = (\d+)°\$ and side \$a = (\d+(?:\.\d+)?)\$ cm \(opposite \$\\angle A\$\)\. Find side \$b\$/);
    return m ? { A: num(m[1]), B: num(m[2]), a: num(m[3]) } : null;
  },
  slips({ A, B, a }) {
    return [
      { id: 'sine-rule-inverted', value: a * SIN(A) / SIN(B), say: s(
        `Each side goes over the sine of its OWN opposite angle: b ÷ sin ${B}° = ${n4(a)} ÷ sin ${A}°. You had sin ${A}° on top.`,
        `हर भुजा अपने सम्मुख कोण की ज्या के साथ आती है: b ÷ sin ${B}° = ${n4(a)} ÷ sin ${A}°। आपने sin ${A}° ऊपर रखा।`) },
      { id: 'sine-rule-cosine', value: a * COS(B) / COS(A), say: s(
        `The sine rule uses sines: a ÷ sin A = b ÷ sin B, not cosines.`,
        `ज्या नियम में ज्या (sin) आती है: a ÷ sin A = b ÷ sin B, कोज्या नहीं।`) },
      { id: 'trig-calculator-radians', value: a * Math.sin(B) / Math.sin(A), say: s(
        `The angles ${A}° and ${B}° were put into the calculator in radians; switch it to degrees.`,
        `कोण ${A}° और ${B}° कैलकुलेटर में रेडियन में डाले गए; इसे डिग्री पर रखें।`) }
    ];
  }
};

const sineRuleAngle = {
  id: 'trig-sine-rule-angle',
  read(q) {
    const m = String(q.prompt).match(/\$\\angle A = (\d+)°\$, side \$a = (\d+(?:\.\d+)?)\$ m and side \$b = (\d+(?:\.\d+)?)\$ m\. Find the acute angle \$B\$/);
    return m ? { A: num(m[1]), a: num(m[2]), b: num(m[3]) } : null;
  },
  slips({ A, a, b }) {
    const sB = (b * SIN(A)) / a;
    const right = sB <= 1 ? deg(Math.asin(sB)) : NaN;
    return [
      { id: 'sine-rule-inverted', value: deg(Math.asin(Math.min(1, (a * SIN(A)) / b))), say: s(
        `sin B = b × sin A ÷ a = ${n4(b)} × sin ${A}° ÷ ${n4(a)}. You had the two sides the wrong way round.`,
        `sin B = b × sin A ÷ a = ${n4(b)} × sin ${A}° ÷ ${n4(a)}। आपने दोनों भुजाएँ उलटी रखीं।`) },
      { id: 'sine-rule-no-inverse', value: sB, say: s(
        `${n4(sB)} is sin B; take sin⁻¹ of it to get the angle.`,
        `${n4(sB)} sin B है; कोण के लिए इसका sin⁻¹ लें।`) },
      { id: 'sine-rule-obtuse-angle', value: 180 - right, say: s(
        `The question asks for the ACUTE angle B; ${n4(180 - right)}° is its obtuse partner (180° minus the acute angle).`,
        `प्रश्न न्यून कोण B माँगता है; ${n4(180 - right)}° उसका अधिक कोण साथी है (180° में से न्यून कोण घटाने पर)।`) }
    ];
  }
};

// ── Exact values: k sin θ + m cos φ ──
const EXACT = { sin: { 30: 0.5, 45: Math.SQRT1_2, 60: Math.sqrt(3) / 2, 0: 0, 90: 1 }, cos: { 30: Math.sqrt(3) / 2, 45: Math.SQRT1_2, 60: 0.5, 0: 1, 90: 0 } };
const exactSum = {
  id: 'trig-exact-sum',
  read(q) {
    const m = String(q.prompt).match(/Evaluate \$(\d+)\\(sin|cos) (\d+)\^\\circ \+ (\d+)\\(sin|cos) (\d+)\^\\circ\$ exactly/);
    if (!m) return null;
    return { k: num(m[1]), f1: m[2], t1: num(m[3]), m: num(m[4]), f2: m[5], t2: num(m[6]) };
  },
  slips({ k, f1, t1, m, f2, t2 }) {
    const v1 = EXACT[f1][t1], v2 = EXACT[f2][t2];
    const sw = (f, t) => EXACT[f === 'sin' ? 'cos' : 'sin'][t];
    return [
      { id: 'trig-exact-value-ratio-as-one', value: k + m, say: s(
        `${f1} ${t1}° = ${n4(v1)} and ${f2} ${t2}° = ${n4(v2)}, not 1: use ${n4(k)} × ${n4(v1)} + ${n4(m)} × ${n4(v2)}.`,
        `${f1} ${t1}° = ${n4(v1)} और ${f2} ${t2}° = ${n4(v2)}, 1 नहीं: ${n4(k)} × ${n4(v1)} + ${n4(m)} × ${n4(v2)} लें।`) },
      { id: 'trig-exact-value-swapped', value: k * sw(f1, t1) + m * sw(f2, t2), say: s(
        `sin and cos swap at 30° and 60°: sin 30° = cos 60° = ½ and sin 60° = cos 30° = √3⁄2. Check which function each term is.`,
        `30° और 60° पर sin और cos आपस में बदल जाते हैं: sin 30° = cos 60° = ½ और sin 60° = cos 30° = √3⁄2। देखें हर पद में कौन सा फलन है।`) }
    ];
  }
};

// ── Solving sin/cos/tan θ = c for 0° ≤ θ ≤ 360°: which quadrant ──
const QUAD = {
  // reference angle r (degrees) → the four candidate angles
  cands: r => ({ q1: r, q2: 180 - r, q3: 180 + r, q4: 360 - r })
};
const trigEquation = {
  id: 'trig-equation',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/Solve \$\\(sin|cos|tan)\\theta = (-?)(\\tfrac\{\\sqrt3\}\{2\}|\\tfrac12|\\tfrac\{\\sqrt3\}\{3\}|1|\\sqrt3|\\tfrac\{1\}\{\\sqrt2\})\$ for \$0\^\\circ \\le \\theta \\le 360\^\\circ\$\. Give the (smaller|larger)/);
    if (!m) return null;
    const refMap = { sin: { '\\tfrac12': 30, '\\tfrac{\\sqrt3}{2}': 60, '1': 90 }, cos: { '\\tfrac12': 30, '\\tfrac{\\sqrt3}{2}': 30, '1': 0 }, tan: { '1': 45, '\\sqrt3': 60, '\\tfrac{\\sqrt3}{3}': 30 } };
    let r = refMap[m[1]][m[3]];
    if (m[1] === 'cos' && m[3] === '\\tfrac{\\sqrt3}{2}') r = 30;
    if (m[1] === 'cos' && m[3] === '\\tfrac12') r = 60;
    if (r === undefined) return null;
    return { fn: m[1], neg: m[2] === '-', r, which: m[4] };
  },
  slips({ fn, neg, r, which }) {
    const c = QUAD.cands(r);
    const quadsRight = { sin: neg ? ['q3', 'q4'] : ['q1', 'q2'], cos: neg ? ['q2', 'q3'] : ['q1', 'q4'], tan: neg ? ['q2', 'q4'] : ['q1', 'q3'] }[fn];
    const right = quadsRight.map(k => c[k]).sort((a, b) => a - b);
    const wanted = which === 'smaller' ? right[0] : right[1];
    const other = which === 'smaller' ? right[1] : right[0];
    const out = [
      { id: 'trig-other-solution', value: other, say: s(
        `There are two solutions in 0°–360°, one in each of two quadrants. Your ${n4(other)}° is the ${which === 'smaller' ? 'larger' : 'smaller'} one; the question asks for the ${which} one.`,
        `0°–360° में दो हल होते हैं, दो चतुर्थांशों में एक-एक। ${n4(other)}° ${which === 'smaller' ? 'बड़ा' : 'छोटा'} हल है; प्रश्न ${which === 'smaller' ? 'छोटा' : 'बड़ा'} हल माँगता है।`) },
      { id: 'trig-reference-angle-only', value: r, say: s(
        `${r}° is only the reference angle (the first-quadrant angle). The sign tells you which quadrants: ${fn} is ${neg ? 'negative' : 'positive'} in quadrants ${quadsRight.map(k => k[1]).join(' and ')}.`,
        `${r}° केवल संदर्भ कोण (प्रथम चतुर्थांश का कोण) है। चिह्न बताता है कौन से चतुर्थांश: ${fn} ${neg ? 'ऋणात्मक' : 'धनात्मक'} है चतुर्थांश ${quadsRight.map(k => k[1]).join(' और ')} में।`) }
    ];
    for (const k of ['q1', 'q2', 'q3', 'q4']) {
      const v = c[k];
      if (k === 'q1' && !quadsRight.includes('q1')) continue; // handled by reference-angle
      if (right.includes(v) || v === r) continue;
      out.push({ id: 'trig-wrong-quadrant', value: v, say: s(
        `${v}° is in the wrong quadrant: ${fn} ${neg ? 'negative' : 'positive'} puts the solutions in quadrants ${quadsRight.map(k => k[1]).join(' and ')} (use ASTC: All, Sin, Tan, Cos).`,
        `${v}° गलत चतुर्थांश में है: ${fn} ${neg ? 'ऋणात्मक' : 'धनात्मक'} के हल चतुर्थांश ${quadsRight.map(k => k[1]).join(' और ')} में हैं (ASTC नियम देखें)।`) });
    }
    return out;
  }
};

// ── sin²θ + cos²θ = 1 ──
const pythagoreanIdentity = {
  id: 'trig-identity-one',
  read(q) {
    const m = String(q.prompt).match(/Simplify \$(\d+)\\sin\^2\\theta \+ (\d+)\\cos\^2\\theta \+ (\d+)\$ to a single number/);
    return m ? { k: num(m[1]), j: num(m[2]), c: num(m[3]) } : null;
  },
  slips({ k, j, c }) {
    return [
      { id: 'identity-forgot-one', value: c, say: s(
        `sin²θ + cos²θ = 1, so ${n4(k)}sin²θ + ${n4(k)}cos²θ collapses to ${n4(k)}, and then the ${n4(c)} is added. The ${n4(k)} was dropped.`,
        `sin²θ + cos²θ = 1, इसलिए ${n4(k)}sin²θ + ${n4(k)}cos²θ का मान ${n4(k)} रह जाता है, फिर ${n4(c)} जोड़ें। ${n4(k)} छूट गया।`) },
      { id: 'identity-sum-of-coefficients', value: k + j + c, say: s(
        `Factor first: ${n4(k)}(sin²θ + cos²θ) = ${n4(k)} × 1. Adding the coefficients as if sin² and cos² were each 1 gives ${n4(k + j + c)}.`,
        `पहले गुणनखंड लें: ${n4(k)}(sin²θ + cos²θ) = ${n4(k)} × 1। sin² और cos² को अलग-अलग 1 मानकर गुणांक जोड़ने से ${n4(k + j + c)} मिलता है।`) }
    ];
  }
};


// ── Reading helpers for exact-value arguments ──
const ARG = { '0': 0, '1': 1, '\\frac{1}{2}': 0.5, '\\frac{\\sqrt{2}}{2}': Math.SQRT1_2, '\\frac{\\sqrt{3}}{2}': Math.sqrt(3) / 2, '\\frac{\\sqrt{3}}{3}': Math.sqrt(3) / 3, '\\sqrt{3}': Math.sqrt(3) };
const argValue = text => {
  const t = String(text).replace(/\s+/g, '').replace(/\\dfrac/g, '\\frac');
  const neg = t.startsWith('-');
  const body = neg ? t.slice(1) : t;
  return body in ARG ? (neg ? -1 : 1) * ARG[body] : null;
};
const INV = { sin: Math.asin, cos: Math.acos, tan: Math.atan };

// ── Single-angle exact values: sin/cos/tan of θ° ──
const exactAngle = {
  id: 'trig-exact-angle',
  read(q) {
    const m = String(q.prompt).match(/(?:Find|Write down) the \*\*exact value\*\* of \$\\(sin|cos|tan)\((-?\d+)°\)\$/);
    return m ? { fn: m[1], t: num(m[2]) } : null;
  },
  slips({ fn, t }) {
    const val = FN[fn](t);
    const other = { sin: 'cos', cos: 'sin', tan: 'tan' }[fn];
    const out = [
      { id: 'trig-sign-by-quadrant', value: -val, say: s(
        `Use the reference angle for the size, but the sign comes from the quadrant ${t}° lies in (ASTC): check whether ${fn} is positive or negative there.`,
        `आकार संदर्भ कोण से मिलता है, पर चिह्न उस चतुर्थांश से तय होता है जिसमें ${t}° है (ASTC): देखें वहाँ ${fn} धनात्मक है या ऋणात्मक।`) }
    ];
    if (other !== fn) out.push({ id: 'trig-exact-value-swapped', value: FN[other](t), say: s(
      `That is ${other} ${t}°; the question asks for ${fn} ${t}°. (sin and cos swap at 30° and 60°.)`,
      `यह ${other} ${t}° है; प्रश्न ${fn} ${t}° माँगता है। (30° और 60° पर sin और cos आपस में बदल जाते हैं।)`) });
    return out;
  }
};

// ── cos θ = c (or sin, tan) for 0° ≤ θ ≤ 90°: the complement trap ──
const acuteAngleFromRatio = {
  id: 'trig-acute-angle',
  read(q) {
    const m = String(q.prompt).match(/For which angle \$\\theta\$ with \$0° \\le \\theta \\le 90°\$ does \$\\(sin|cos|tan)\(\\theta\) = ([^$]+)\$\?/);
    if (!m) return null;
    const v = argValue(m[2]);
    return v === null ? null : { fn: m[1], v, right: deg(INV[m[1]](v)) };
  },
  slips({ fn, v, right }) {
    const co = 90 - right;
    return [{ id: 'trig-complement-angle', value: co, say: s(
      `${n4(co)}° is the complement: ${fn} ${n4(co)}° = ${n4(FN[fn](co))}, not ${n4(v)}. The angle whose ${fn} is ${n4(v)} is the one from ${fn}⁻¹; ${fn === 'sin' ? 'sin' : fn === 'cos' ? 'cos' : 'tan'} and the complementary function swap at ${n4(co)}°.`,
      `${n4(co)}° पूरक कोण है: ${fn} ${n4(co)}° = ${n4(FN[fn](co))}, ${n4(v)} नहीं। जिस कोण का ${fn} ${n4(v)} हो वह ${fn}⁻¹ से मिलता है।`) }];
  }
};

// ── A triangle with the exact value of a ratio given ──
const exactTriangleLength = {
  id: 'trig-exact-triangle',
  read(q) {
    const m = String(q.prompt).match(/hypotenuse \$(\d+)\$ cm and an acute angle of \$(\d+)°\$\. Using the \*\*exact value\*\* of \$\\(sin|cos)\(\d+°\)\$, find the exact length of the side (opposite|adjacent)/);
    return m ? { L: num(m[1]), t: num(m[2]), fn: m[3] } : null;
  },
  slips({ L, t, fn }) {
    const r = FN[fn](t);
    return [
      { id: 'trig-ratio-ignored', value: L, say: s(
        `The side is ${n4(L)} × ${fn} ${t}° = ${n4(L)} × ${n4(r)}: the hypotenuse is multiplied by the ratio, not left as it is.`,
        `भुजा ${n4(L)} × ${fn} ${t}° = ${n4(L)} × ${n4(r)} है: कर्ण को अनुपात से गुणा करना है, वैसा ही नहीं छोड़ना।`) },
      { id: 'trig-ratio-inverted', value: L / r, say: s(
        `The side is hypotenuse × ${fn} ${t}°, so multiply, not divide: dividing by ${n4(r)} gives ${n4(L / r)}, which is longer than the hypotenuse.`,
        `भुजा कर्ण × ${fn} ${t}° है, इसलिए गुणा करें, भाग नहीं: ${n4(r)} से भाग देने पर ${n4(L / r)} आता है, जो कर्ण से लंबा है।`) }
    ];
  }
};

// ── The number of solutions of sin θ = c on [0°, 360°] ──
const solutionCount = {
  id: 'trig-solution-count',
  read(q) {
    const m = String(q.prompt).match(/How many solutions does \$\\(sin|cos)\\theta = (-?)(\\tfrac12|\\tfrac\{\\sqrt3\}\{2\}|1|2)\$ have for \$0\^\\circ \\le \\theta \\le 360\^\\circ\$\?/);
    if (!m) return null;
    const mag = { '\\tfrac12': 0.5, '\\tfrac{\\sqrt3}{2}': Math.sqrt(3) / 2, '1': 1, '2': 2 }[m[3]];
    const c = (m[2] === '-' ? -1 : 1) * mag;
    const count = Math.abs(c) > 1 ? 0 : Math.abs(c) === 1 ? 1 : 2;
    return { fn: m[1], c, count };
  },
  slips({ fn, c, count }) {
    const out = [];
    if (count !== 1) out.push({ id: 'trig-count-one-solution', value: 1, say: s(
      count === 2
        ? `${fn} θ = ${n4(c)}: check the quadrants where ${fn} has that sign; the first-quadrant angle is not the only one in 0°–360°.`
        : `${fn} θ = ${n4(c)}: check how large ${fn} θ can get; its values stay between −1 and 1.`,
      count === 2
        ? `${fn} θ = ${n4(c)}: देखें किन चतुर्थांशों में ${fn} का यही चिह्न है; 0°–360° में प्रथम चतुर्थांश का कोण अकेला नहीं होता।`
        : `${fn} θ = ${n4(c)}: देखें ${fn} θ कितना बड़ा हो सकता है; इसके मान −1 और 1 के बीच रहते हैं।`) });
    if (count !== 2) out.push({ id: 'trig-count-two-solutions', value: 2, say: s(
      count === 0
        ? `Check whether ${fn} θ can ever equal ${n4(c)}: its values stay between −1 and 1.`
        : `Check where ${fn} θ reaches ${n4(c)}: does the graph cross that height twice, or touch it once?`,
      count === 0
        ? `देखें क्या ${fn} θ कभी ${n4(c)} के बराबर हो सकता है: इसके मान −1 और 1 के बीच रहते हैं।`
        : `देखें ${fn} θ कहाँ ${n4(c)} तक पहुँचता है: क्या ग्राफ़ उस ऊँचाई को दो बार काटता है या एक बार छूता है?`) });
    if (count !== 0) out.push({ id: 'trig-count-zero', value: 0, say: s(
      `${n4(c)} is between −1 and 1, so ${fn} θ = ${n4(c)} does have solutions in 0°–360°: find them.`,
      `${n4(c)} −1 और 1 के बीच है, इसलिए ${fn} θ = ${n4(c)} के 0°–360° में हल हैं: उन्हें खोजें।`) });
    return out;
  }
};

// ── Right triangle with an angle to a wall or the ground; and the angle from two sides ──
const ladderRamp = {
  id: 'trig-ladder-ramp',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/ladder \$(\d+)\$ m long leans against a vertical wall and makes an angle of \$(\d+)\^\\circ\$ with the wall\. How far up/);
    if (m) return { L: num(m[1]), t: num(m[2]), fn: 'cos' };
    m = t.match(/ramp \$(\d+)\$ m long makes an angle of \$(\d+)\^\\circ\$ with the horizontal ground\. How high/);
    return m ? { L: num(m[1]), t: num(m[2]), fn: 'sin' } : null;
  },
  slips({ L, t, fn }) {
    const r = FN[fn](t);
    const other = fn === 'sin' ? 'cos' : 'sin';
    return [
      { id: 'trig-ratio-inverted', value: L / r, say: s(
        `The ${fn === 'sin' ? 'height' : 'reach'} is L × ${fn} ${t}° = ${n4(L)} × ${n4(r)}; it cannot be longer than the ${n4(L)} m itself, so do not divide.`,
        `${fn === 'sin' ? 'ऊँचाई' : 'दीवार पर पहुँच'} L × ${fn} ${t}° = ${n4(L)} × ${n4(r)} है; यह ${n4(L)} m से लंबी नहीं हो सकती, इसलिए भाग न दें।`) },
      { id: 'trig-wrong-ratio', value: L * FN[other](t), say: s(
        `Check which side is opposite the ${t}° angle: here the answer uses ${fn} ${t}° = ${n4(r)}, not ${other} ${t}° = ${n4(FN[other](t))}.`,
        `देखें ${t}° कोण के सम्मुख कौन सी भुजा है: यहाँ ${fn} ${t}° = ${n4(r)} लगेगा, ${other} ${t}° = ${n4(FN[other](t))} नहीं।`) }
    ];
  }
};

const angleFromSides = {
  id: 'trig-angle-from-sides',
  read(q) {
    const m = String(q.prompt).match(/the side (adjacent|opposite) to the acute angle \$\\theta\$ is \$(\d+)\$ cm and the (hypotenuse|side adjacent to \$\\theta\$) is \$(\d+)\$ cm\. Find \$\\theta\$/);
    if (!m) return null;
    const a = num(m[2]), b = num(m[4]);
    const fn = m[3] === 'hypotenuse' ? (m[1] === 'adjacent' ? 'cos' : 'sin') : 'tan';
    const ratio = fn === 'tan' ? a / b : a / b;
    const right = deg(INV[fn](Math.min(1, ratio)));
    return { fn, a, b, right };
  },
  slips({ fn, a, b, right }) {
    return [
      { id: 'trig-complement-angle', value: 90 - right, say: s(
        `${n4(90 - right)}° is the other acute angle of the triangle. ${fn} θ = ${n4(a)} ÷ ${n4(b)} gives the angle at the marked corner, which is not ${n4(90 - right)}°.`,
        `${n4(90 - right)}° त्रिभुज का दूसरा न्यून कोण है। ${fn} θ = ${n4(a)} ÷ ${n4(b)} चिह्नित कोने का कोण देता है, जो ${n4(90 - right)}° नहीं है।`) },
      { id: 'trig-ratio-flipped-angle', value: deg(INV[fn](Math.min(1, b / a))), say: s(
        `${fn} θ is ${n4(a)} ÷ ${n4(b)}, with the given side on top (the first side named, over the second).`,
        `${fn} θ = ${n4(a)} ÷ ${n4(b)} है, दी गई भुजा ऊपर (पहली भुजा दूसरी पर)।`) }
    ];
  }
};

// ── Amplitude, shift and period: y = A sin(πx/T) + k ──
const waveModel = {
  id: 'trig-wave-model',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/Find the (maximum|minimum) value of \$y = (\d+)\\sin\\left\(\\dfrac\{\\pi x\}\{(\d+)\}\\right\) \+ (\d+)\$/);
    if (m) return { kind: m[1], A: num(m[2]), T: num(m[3]), k: num(m[4]) };
    m = t.match(/Find the period of \$y = (\d+)\\cos\\left\(\\dfrac\{\\pi x\}\{(\d+)\}\\right\) ([+-]) (\d+)\$/);
    if (m) return { kind: 'period', A: num(m[1]), D: num(m[2]), k: (m[3] === '-' ? -1 : 1) * num(m[4]) };
    m = t.match(/h\(t\) = (\d+) \+ (\d+)\\sin\\left\(\\dfrac\{\\pi t\}\{(\d+)\}\\right\)\$ metres.*Find the depth at \$t = (\d+)\$/);
    if (m) return { kind: 'depth', k: num(m[1]), A: num(m[2]), D: num(m[3]), t: num(m[4]) };
    return null;
  },
  slips(p) {
    if (p.kind === 'maximum' || p.kind === 'minimum') {
      const { A, k, kind } = p;
      return [
        { id: 'wave-forgot-shift', value: kind === 'maximum' ? A : -A, say: s(
          `The ${kind} of A sin(…) alone is ${kind === 'maximum' ? '' : '−'}${n4(A)}; the vertical shift of ${n4(k)} moves the whole graph, so add it on.`,
          `केवल A sin(…) का ${kind === 'maximum' ? 'अधिकतम' : 'न्यूनतम'} ${kind === 'maximum' ? '' : '−'}${n4(A)} है; ${n4(k)} का ऊर्ध्वाधर विस्थापन पूरे ग्राफ़ को खिसकाता है, इसलिए उसे जोड़ें।`) },
        { id: 'wave-wrong-extreme', value: kind === 'maximum' ? k - A : k + A, say: s(
          `That is the ${kind === 'maximum' ? 'minimum' : 'maximum'}: the ${kind} is the midline ${n4(k)} ${kind === 'maximum' ? 'plus' : 'minus'} the amplitude ${n4(A)}.`,
          `यह ${kind === 'maximum' ? 'न्यूनतम' : 'अधिकतम'} है: ${kind === 'maximum' ? 'अधिकतम' : 'न्यूनतम'} मध्य रेखा ${n4(k)} ${kind === 'maximum' ? 'में' : 'से'} आयाम ${n4(A)} ${kind === 'maximum' ? 'जोड़ने' : 'घटाने'} पर मिलता है।`) },
        { id: 'wave-shift-only', value: k, say: s(
          `${n4(k)} is the midline; the ${kind} is the midline ${kind === 'maximum' ? 'plus' : 'minus'} the amplitude ${n4(A)}.`,
          `${n4(k)} मध्य रेखा है; ${kind === 'maximum' ? 'अधिकतम' : 'न्यूनतम'} मध्य रेखा ${kind === 'maximum' ? 'में' : 'से'} आयाम ${n4(A)} ${kind === 'maximum' ? 'जोड़ने' : 'घटाने'} पर मिलता है।`) }
      ];
    }
    if (p.kind === 'period') {
      const { D } = p;
      return [
        { id: 'wave-period-denominator', value: D, say: s(
          `The period is 2π ÷ b where b = π/${n4(D)}, so work out 2π ÷ (π/${n4(D)}). ${n4(D)} is only the denominator.`,
          `आवर्त 2π ÷ b है जहाँ b = π/${n4(D)}, इसलिए 2π ÷ (π/${n4(D)}) निकालें। ${n4(D)} केवल हर है।`) },
        { id: 'wave-half-period', value: D * 1, say: s(
          `The full period is 2π ÷ b, not π ÷ b (that is only half a cycle).`,
          `पूरा आवर्त 2π ÷ b है, π ÷ b नहीं (वह केवल आधा चक्र है)।`) },
        { id: 'wave-period-from-b', value: (2 * Math.PI) / (Math.PI / D) * 2, say: s(
          `The period is 2π ÷ b, and no more: it is not doubled again.`,
          `आवर्त 2π ÷ b है, उससे दुगुना नहीं।`) }
      ];
    }
    const { k, A, D, t } = p;
    return [
      { id: 'wave-sine-as-one', value: k + A, say: s(
        `At t = ${n4(t)} the angle is π × ${n4(t)} ÷ ${n4(D)} = ${n4((180 * t) / D)}°: work out sin of that angle, not sin = 1 (using sin = 1 gives ${n4(k + A)}).`,
        `t = ${n4(t)} पर कोण π × ${n4(t)} ÷ ${n4(D)} = ${n4((180 * t) / D)}° है: उस कोण का sin निकालें, sin = 1 नहीं (sin = 1 लेने पर ${n4(k + A)} आता है)।`) },
      { id: 'trig-calculator-degrees', value: k + A * SIN(t / D * 1), say: s(
        `The angle πt/${n4(D)} is in radians: at t = ${n4(t)} it is π/${n4(D)} (${n4(180 / D * t)}°), not ${n4(t / D)}°.`,
        `कोण πt/${n4(D)} रेडियन में है: t = ${n4(t)} पर यह π/${n4(D)} (${n4(180 / D * t)}°) है, ${n4(t / D)}° नहीं।`) }
    ];
  }
};

// ── Compound and double angles ──
const compoundFraction = {
  id: 'trig-compound-fraction',
  read(q) {
    const m = String(q.prompt).match(/\$A\$ and \$B\$ are acute angles with \$\\(sin|cos) A = \\dfrac\{(\d+)\}\{(\d+)\}\$ and \$\\(sin|cos) B = \\dfrac\{(\d+)\}\{(\d+)\}\$\. Find \$\\(sin|cos)\(A ([+-]) B\)\$/);
    if (!m) return null;
    const get = (fn, p, qq) => { const v = num(p) / num(qq); return fn === 'sin' ? { s: v, c: Math.sqrt(1 - v * v) } : { c: v, s: Math.sqrt(1 - v * v) }; };
    return { A: get(m[1], m[2], m[3]), B: get(m[4], m[5], m[6]), fn: m[7], op: m[8] };
  },
  slips({ A, B, fn, op }) {
    const sg = op === '+' ? 1 : -1;
    const sinF = sg => A.s * B.c + sg * A.c * B.s;
    const cosF = sg => A.c * B.c - sg * A.s * B.s;
    const right = fn === 'sin' ? sinF(sg) : cosF(sg);
    const wrongSign = fn === 'sin' ? sinF(-sg) : cosF(-sg);
    const mixed = fn === 'sin' ? cosF(sg) : sinF(sg);
    return [
      { id: 'compound-sign-flipped', value: wrongSign, say: s(
        `The ${fn} formula's middle sign is ${fn === 'sin' ? (op === '+' ? '+' : '−') : (op === '+' ? '−' : '+')} for ${fn}(A ${op} B): ${fn === 'sin' ? 'sin A cos B ' + op + ' cos A sin B' : 'cos A cos B ' + (op === '+' ? '−' : '+') + ' sin A sin B'}. Here the other sign was used (${n4(wrongSign)}).`,
        `${fn}(A ${op} B) के सूत्र का बीच का चिह्न ${fn === 'sin' ? (op === '+' ? '+' : '−') : (op === '+' ? '−' : '+')} है। यहाँ दूसरा चिह्न लिया गया (${n4(wrongSign)})।`) },
      { id: 'compound-formula-mixed', value: mixed, say: s(
        `${fn}(A ${op} B) uses ${fn === 'sin' ? 'sin A cos B and cos A sin B (one sin and one cos in each product)' : 'cos A cos B and sin A sin B (two cos, then two sin)'}; the other formula was used (your ${n4(mixed)}), with sin A = ${n4(A.s)}, cos A = ${n4(A.c)}, sin B = ${n4(B.s)}, cos B = ${n4(B.c)}.`,
        `${fn}(A ${op} B) में ${fn === 'sin' ? 'sin A cos B और cos A sin B (हर गुणनफल में एक sin, एक cos)' : 'cos A cos B और sin A sin B (दो cos, फिर दो sin)'} आते हैं; दूसरा सूत्र लिया गया (आपका ${n4(mixed)}), जहाँ sin A = ${n4(A.s)}, cos A = ${n4(A.c)}, sin B = ${n4(B.s)}, cos B = ${n4(B.c)}।`) }
    ];
  }
};

const compoundExpression = {
  id: 'trig-compound-expression',
  read(q) {
    const m = String(q.prompt).match(/Collapse \$\\(sin|cos) (\d+)°\\(sin|cos) (\d+)° ([+-]) \\(sin|cos) (\d+)°\\(sin|cos) (\d+)°\$/);
    if (!m) return null;
    const A = num(m[2]), B = num(m[4]);
    const form = m[1] === 'cos' ? 'cos' : 'sin';
    const op = m[5];
    return { form, A, B, op };
  },
  slips({ form, A, B, op }) {
    const total = A + B, diff = Math.abs(A - B);
    const f = form === 'cos' ? COS : SIN;
    const ang = form === 'cos' ? (op === '-' ? A + B : A - B) : (op === '+' ? A + B : A - B);
    const wrongAng = form === 'cos' ? (op === '-' ? A - B : A + B) : (op === '+' ? A - B : A + B);
    return [{ id: 'compound-angle-sign', value: f(wrongAng), say: s(
      `The middle sign decides the angle: ${form === 'cos' ? 'cos A cos B − sin A sin B = cos(A + B)' : 'sin A cos B − cos A sin B = sin(A − B)'}. Here that is ${form}(${ang}°), not ${form}(${wrongAng}°).`,
      `बीच का चिह्न कोण तय करता है: ${form === 'cos' ? 'cos A cos B − sin A sin B = cos(A + B)' : 'sin A cos B − cos A sin B = sin(A − B)'}। यहाँ यह ${form}(${ang}°) है, ${form}(${wrongAng}°) नहीं।`) }];
  }
};

const doubleAngle = {
  id: 'trig-double-angle',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/Given \$\\tan\\theta = \\dfrac\{(\d+)\}\{(\d+)\}\$ with \$\\theta\$ acute, use a double-angle formula to find \$\\(sin|cos) 2\\theta\$/);
    if (m) { const o = num(m[1]), a = num(m[2]), h = Math.hypot(o, a); return { s: o / h, c: a / h, which: m[3] }; }
    m = t.match(/\$\\theta\$ lies in the \*\*(first|second|third|fourth) quadrant\*\* and \$\\(sin|cos)\\theta = (-?)\\?(?:d?frac)\{(\d+)\}\{(\d+)\}\$\. Find \$\\(sin|cos) 2\\theta\$/);
    if (m) {
      const v = (m[3] === '-' ? -1 : 1) * num(m[4]) / num(m[5]);
      const other = Math.sqrt(1 - v * v);
      const quad = m[1];
      const sinSign = quad === 'first' || quad === 'second' ? 1 : -1;
      const cosSign = quad === 'first' || quad === 'fourth' ? 1 : -1;
      const sv = m[2] === 'sin' ? v : sinSign * other;
      const cv = m[2] === 'cos' ? v : cosSign * other;
      return { s: sv, c: cv, which: m[6], quad };
    }
    return null;
  },
  slips({ s: sn, c, which }) {
    const sinPos = Math.abs(sn), cosPos = Math.abs(c);
    const right = which === 'sin' ? 2 * sn * c : c * c - sn * sn;
    const out = [];
    if (which === 'sin') {
      out.push({ id: 'double-angle-doubled-ratio', value: 2 * sn, say: s(
        `sin 2θ = 2 sin θ cos θ, not 2 sin θ: the cos θ factor was left out (2 × ${n4(sn)} = ${n4(2 * sn)}).`,
        `sin 2θ = 2 sin θ cos θ है, 2 sin θ नहीं: cos θ का गुणक छूट गया (2 × ${n4(sn)} = ${n4(2 * sn)})।`) });
      out.push({ id: 'double-angle-sign-by-quadrant', value: -right, say: s(
        `The sign of 2 sin θ cos θ follows the quadrant: sin θ = ${n4(sn)} and cos θ = ${n4(c)}, so check whether their product is positive or negative.`,
        `2 sin θ cos θ का चिह्न चतुर्थांश से तय होता है: sin θ = ${n4(sn)} और cos θ = ${n4(c)}, इसलिए देखें उनका गुणनफल धनात्मक है या ऋणात्मक।`) });
    } else {
      out.push({ id: 'double-angle-doubled-ratio', value: 2 * c, say: s(
        `cos 2θ = cos²θ − sin²θ, not 2 cos θ: doubling the angle does not double the ratio (2 × ${n4(c)} = ${n4(2 * c)}).`,
        `cos 2θ = cos²θ − sin²θ है, 2 cos θ नहीं: कोण दुगुना करने से अनुपात दुगुना नहीं होता (2 × ${n4(c)} = ${n4(2 * c)})।`) });
      out.push({ id: 'double-angle-sign-by-quadrant', value: -right, say: s(
        `cos²θ − sin²θ = ${n4(c * c)} − ${n4(sn * sn)}: the sign comes from the two squares, not from the quadrant.`,
        `cos²θ − sin²θ = ${n4(c * c)} − ${n4(sn * sn)}: चिह्न दोनों वर्गों से आता है, चतुर्थांश से नहीं।`) });
      out.push({ id: 'double-angle-sum-of-squares', value: c * c + sn * sn, say: s(
        `cos 2θ = cos²θ MINUS sin²θ; cos²θ + sin²θ is always 1.`,
        `cos 2θ = cos²θ घटा sin²θ है; cos²θ + sin²θ हमेशा 1 होता है।`) });
    }
    return out;
  }
};

const compoundSpecial = {
  id: 'trig-compound-special',
  read(q) {
    const m = String(q.prompt).match(/Using \$(\d+)° = (\d+)° \+ (\d+)°\$, find the \*\*exact value\*\* of \$\\(sin|cos)\((\d+)°\)\$/);
    return m ? { A: num(m[2]), B: num(m[3]), fn: m[4], t: num(m[5]) } : null;
  },
  slips({ A, B, fn, t }) {
    const right = fn === 'sin' ? SIN(t) : COS(t);
    const f = fn === 'sin' ? SIN : COS;
    return [
      { id: 'compound-sign-flipped', value: -right, say: s(
        `${fn}(${A}° + ${B}°) = ${fn === 'sin' ? `sin ${A}° cos ${B}° + cos ${A}° sin ${B}°` : `cos ${A}° cos ${B}° − sin ${A}° sin ${B}°`}: keep the formula's own signs.`,
        `${fn}(${A}° + ${B}°) = ${fn === 'sin' ? `sin ${A}° cos ${B}° + cos ${A}° sin ${B}°` : `cos ${A}° cos ${B}° − sin ${A}° sin ${B}°`}: सूत्र के अपने चिह्न रखें।`) },
      { id: 'compound-distributed', value: f(A) + f(B), say: s(
        `${fn}(${A}° + ${B}°) is not ${fn} ${A}° + ${fn} ${B}°: expand with the compound-angle formula instead.`,
        `${fn}(${A}° + ${B}°) और ${fn} ${A}° + ${fn} ${B}° एक नहीं: संयुक्त-कोण सूत्र से फैलाएँ।`) }
    ];
  }
};

// ── Inverse trigonometric functions: principal values, units, sums ──
const inverseTrig = {
  id: 'trig-inverse-principal',
  read(q) {
    const t = String(q.prompt);
    if (!/^(?:Find|Evaluate)/.test(t) || /Evaluate \$\\cos\^\{-1\}\\left\(\\cos/.test(t)) return null;
    const terms = [];
    const re = /(?:^|\s)([+-])?\s*\$?\\(sin|cos|tan)\^\{-1\}\\left\(([^$]*?)\\right\)/g;
    let m;
    const body = t.replace(/\$/g, ' ');
    const re2 = /([+-]\s)?\\(sin|cos|tan)\^\{-1\}\\left\((.*?)\\right\)/g;
    while ((m = re2.exec(body))) {
      const v = argValue(m[3]);
      if (v === null) return null;
      terms.push({ sign: m[1] && m[1].trim() === '-' ? -1 : 1, fn: m[2], x: v });
    }
    if (!terms.length || /\\sin\\left\(\\tan|\\cos\\left\(\\tan|\\tan\\left\(\\sin|\\tan\\left\(\\cos|\\cos\\left\(\\sin|\\sin\\left\(\\cos/.test(t)) return null;
    const unit = /in degrees/.test(t) ? 'deg' : /in radians/.test(t) ? 'rad' : null;
    return unit ? { terms, unit } : null;
  },
  slips({ terms, unit }) {
    const principal = tm => INV[tm.fn](tm.x);
    const total = list => list.reduce((acc, tm) => acc + tm.sign * principal(tm), 0);
    const conv = v => (unit === 'deg' ? deg(v) : v);
    const right = conv(total(terms));
    const out = [];
    terms.forEach((tm, i) => {
      if (tm.x >= 0) return;
      const wrongBranch = tm.fn === 'cos' ? -INV.cos(Math.abs(tm.x)) : tm.fn === 'sin' ? -INV.sin(tm.x) : -INV.tan(tm.x);
      const wrong = terms.reduce((acc, t2, j) => acc + t2.sign * (j === i ? wrongBranch : principal(t2)), 0);
      out.push({ id: tm.fn === 'cos' ? 'inverse-trig-cos-range' : 'inverse-trig-odd-sign', value: conv(wrong), say: s(
        tm.fn === 'cos'
          ? `cos⁻¹ only gives angles from 0 to π (0° to 180°), so cos⁻¹(${n4(tm.x)}) cannot be negative (not ${n4(conv(wrongBranch))}).`
          : `${tm.fn}⁻¹(${n4(tm.x)}) = −${tm.fn}⁻¹(${n4(Math.abs(tm.x))}): a negative input gives a negative principal value, so the sign is not lost.`,
        tm.fn === 'cos'
          ? `cos⁻¹ केवल 0 से π (0° से 180°) तक के कोण देता है, इसलिए cos⁻¹(${n4(tm.x)}) ऋणात्मक नहीं हो सकता (${n4(conv(wrongBranch))} नहीं)।`
          : `${tm.fn}⁻¹(${n4(tm.x)}) = −${tm.fn}⁻¹(${n4(Math.abs(tm.x))}): ऋणात्मक इनपुट का मुख्य मान ऋणात्मक आता है, चिह्न छूटना नहीं चाहिए।`) });
    });
    if (terms.length > 1) {
      const swapped = terms.reduce((acc, tm, i) => acc + (i === 0 ? tm.sign : (tm.sign === 1 ? -1 : 1)) * principal(tm), 0);
      out.push({ id: 'inverse-trig-operation-sign', value: conv(swapped), say: s(
        `Evaluate each inverse to its principal value first, then combine them using the sign written between them: your ${n4(conv(swapped))} combined them the wrong way.`,
        `पहले हर प्रतिलोम का मुख्य मान निकालें, फिर बीच में लिखे चिह्न से जोड़ें: आपका ${n4(conv(swapped))} उन्हें गलत तरह से जोड़ता है।`) });
    }
    out.push({ id: 'trig-units-swapped', value: unit === 'deg' ? total(terms) : deg(total(terms)), say: s(
      unit === 'deg'
        ? `The answer is asked in DEGREES: your ${n4(total(terms))} is a radian value, so convert it.`
        : `The answer is asked in RADIANS: your ${n4(deg(total(terms)))} is a degree value, so convert it.`,
      unit === 'deg'
        ? `उत्तर डिग्री में माँगा गया है: आपका ${n4(total(terms))} रेडियन मान है, इसे बदलें।`
        : `उत्तर रेडियन में माँगा गया है: आपका ${n4(deg(total(terms)))} डिग्री मान है, इसे बदलें।`) });
    return out;
  }
};

const inverseNested = {
  id: 'trig-inverse-nested',
  read(q) {
    const m = String(q.prompt).match(/Evaluate \$\\cos\^\{-1\}\\left\(\\cos\\left\((.*?)\\right\)\\right\)\$ exactly/);
    if (!m) return null;
    const t = m[1].replace(/\s/g, '');
    let ang = null;
    let r;
    if ((r = t.match(/^(-?)(\d*)\\pi$/))) ang = (r[1] === '-' ? -1 : 1) * (r[2] === '' ? 1 : num(r[2])) * Math.PI;
    else if ((r = t.match(/^\\frac\{(-?\d*)\\pi\}\{(\d+)\}$/))) ang = (r[1] === '-' ? -1 : r[1] === '' ? 1 : num(r[1])) * Math.PI / num(r[2]);
    return ang === null ? null : { ang };
  },
  slips({ ang }) {
    return [{ id: 'inverse-trig-undo-without-range', value: ang, say: s(
      `cos⁻¹(cos x) = x only when x is between 0 and π. Your ${n4(ang)} is outside that range, so first find the angle in [0, π] with the same cosine.`,
      `cos⁻¹(cos x) = x केवल तब जब x, 0 और π के बीच हो। आपका ${n4(ang)} इस सीमा के बाहर है, इसलिए पहले [0, π] में वही कोज्या वाला कोण खोजें।`) }];
  }
};

const inverseOfRatio = {
  id: 'trig-inverse-ratio',
  read(q) {
    const m = String(q.prompt).match(/Find the exact value of \$\\(sin|cos|tan)\\left\(\\(sin|cos|tan)\^\{-1\}\\left\(\\dfrac\{(\d+)\}\{(\d+)\}\\right\)\\right\)\$ as a fraction/);
    return m ? { outer: m[1], inner: m[2], p: num(m[3]), r: num(m[4]) } : null;
  },
  slips({ outer, inner, p, r }) {
    const x = p / r;
    const th = INV[inner](x);
    const vals = { sin: Math.sin(th), cos: Math.cos(th), tan: Math.tan(th) };
    const out = [{ id: 'inverse-trig-ratio-as-given', value: x, say: s(
      `${n4(x)} is the ratio given for ${inner} θ, not ${outer} θ: draw the right triangle with ${inner} θ = ${n4(p)}/${n4(r)} and read the ${outer} from it.`,
      `${n4(x)} ${inner} θ का दिया गया अनुपात है, ${outer} θ का नहीं: ${inner} θ = ${n4(p)}/${n4(r)} वाला समकोण त्रिभुज बनाकर उसमें से ${outer} पढ़ें।`) }];
    for (const g of ['sin', 'cos', 'tan']) {
      if (g === outer || g === inner) continue;
      out.push({ id: 'trig-wrong-ratio', value: vals[g], say: s(
        `That is ${g} θ; the question asks for ${outer} θ in the triangle with ${inner} θ = ${n4(p)}/${n4(r)}.`,
        `यह ${g} θ है; प्रश्न ${inner} θ = ${n4(p)}/${n4(r)} वाले त्रिभुज में ${outer} θ माँगता है।`) });
    }
    return out;
  }
};

// ── Calculus of trigonometric functions ──
const trigGradient = {
  id: 'trig-calculus-gradient',
  read(q) {
    const m = String(q.prompt).match(/If \$y = \\(sin|cos)\((\d+)x\)\$, find the \*\*exact\*\* gradient of the curve at \$x = (0|\\dfrac\{\\pi\}\{(\d+)\})\$/);
    if (!m) return null;
    return { fn: m[1], b: num(m[2]), x0: m[3] === '0' ? 0 : Math.PI / num(m[4]) };
  },
  slips({ fn, b, x0 }) {
    const d = fn === 'sin' ? b * Math.cos(b * x0) : -b * Math.sin(b * x0);
    const yv = fn === 'sin' ? Math.sin(b * x0) : Math.cos(b * x0);
    return [
      { id: 'trig-calculus-no-chain', value: fn === 'sin' ? Math.cos(b * x0) : -Math.sin(b * x0), say: s(
        `The chain rule brings out the inner derivative ${n4(b)}: y′ = ${fn === 'sin' ? '' : '−'}${n4(b)}${fn === 'sin' ? 'cos' : 'sin'}(${n4(b)}x), then substitute x.`,
        `शृंखला नियम से भीतरी अवकलज ${n4(b)} बाहर आता है: y′ = ${fn === 'sin' ? '' : '−'}${n4(b)}${fn === 'sin' ? 'cos' : 'sin'}(${n4(b)}x), फिर x रखें।`) },
      { id: 'trig-calculus-sign', value: -d, say: s(
        `The derivative of ${fn} is ${fn === 'sin' ? 'cos (positive)' : '−sin (note the minus)'}: check the sign of the derivative.`,
        `${fn} का अवकलज ${fn === 'sin' ? 'cos (धनात्मक)' : '−sin (ऋण चिह्न पर ध्यान दें)'} है: अवकलज का चिह्न जाँचें।`) },
      { id: 'trig-calculus-value-not-gradient', value: yv, say: s(
        `${n4(yv)} is the height y of the curve at that x. The gradient comes from the derivative y′ evaluated there.`,
        `${n4(yv)} उस x पर वक्र की ऊँचाई y है। ढाल वहाँ मूल्यांकित अवकलज y′ से आता है।`) }
    ];
  }
};

const trigStationary = {
  id: 'trig-calculus-stationary',
  read(q) {
    const t = String(q.prompt);
    let m = t.match(/\*\*smallest positive\*\* value of \$x\$ at which the curve \$y = (\d+)\\sin\((\d+)x\)\$ has a stationary point/);
    if (m) return { kind: 'first', b: num(m[2]) };
    m = t.match(/How many stationary points does \$y = (\d+)\\sin\((\d+)x\)\$ have in the domain \$0 \\le x \\le 2\\pi\$/);
    return m ? { kind: 'count', b: num(m[2]) } : null;
  },
  slips({ kind, b }) {
    if (kind === 'first') return [
      { id: 'trig-calculus-no-chain', value: Math.PI / 2, say: s(
        `The stationary points are where the derivative ${n4(b)}·cos(${n4(b)}x) = 0, so ${n4(b)}x = π/2, not x = π/2.`,
        `स्थिर बिंदु वहाँ हैं जहाँ अवकलज ${n4(b)}·cos(${n4(b)}x) = 0, इसलिए ${n4(b)}x = π/2, x = π/2 नहीं।`) },
      { id: 'trig-calculus-zero-not-stationary', value: Math.PI / b, say: s(
        `${n4(Math.PI / b)} is where y = 0, not where the gradient is 0: set ${n4(b)}cos(${n4(b)}x) = 0, giving ${n4(b)}x = π/2.`,
        `${n4(Math.PI / b)} वह है जहाँ y = 0, जहाँ ढाल 0 हो वह नहीं: ${n4(b)}cos(${n4(b)}x) = 0 रखें, ${n4(b)}x = π/2 मिलता है।`) }
    ];
    return [
      { id: 'trig-calculus-count-endpoints', value: 2 * b + 1, say: s(
        `cos(${n4(b)}x) = 0 has no solution at x = 0 or x = 2π (cos 0 = 1), so the endpoints are not stationary points.`,
        `cos(${n4(b)}x) = 0 का x = 0 या x = 2π पर कोई हल नहीं (cos 0 = 1), इसलिए सिरे स्थिर बिंदु नहीं हैं।`) },
      { id: 'trig-calculus-no-chain', value: 2, say: s(
        `The inner ${n4(b)}x matters: over 0 to 2π the angle ${n4(b)}x sweeps ${n4(b)} full turns, with 2 stationary points in each turn.`,
        `भीतरी ${n4(b)}x मायने रखता है: 0 से 2π में कोण ${n4(b)}x ${n4(b)} पूरे चक्र घूमता है, हर चक्र में 2 स्थिर बिंदु।`) },
      { id: 'trig-calculus-one-per-turn', value: b, say: s(
        `Each full turn of ${n4(b)}x has a maximum AND a minimum, so 2 stationary points per turn.`,
        `${n4(b)}x के हर पूरे चक्र में एक अधिकतम और एक न्यूनतम होता है, यानी हर चक्र में 2 स्थिर बिंदु।`) }
    ];
  }
};

export const entries = Object.freeze([
  { id: 'trig-right-triangle', read: readRightTriangle, slips: rightTriangleSlips },
  bearingEast, bearingHiker, pythagoras, cosineRuleSide, areaRule, sineRuleSide, sineRuleAngle, exactSum, trigEquation, pythagoreanIdentity,
  exactAngle, acuteAngleFromRatio, exactTriangleLength, solutionCount, ladderRamp, angleFromSides, waveModel,
  compoundFraction, compoundExpression, doubleAngle, compoundSpecial, inverseTrig, inverseNested, inverseOfRatio, trigGradient, trigStationary
]);
export default entries;

// ── Registration (topics/registry.js): one slip per code, each asking the one catalogue ──
import { registerTopic } from './registry.js';
import { diagnoseWith, sayIn } from '../slipKit.js';

/** Every slip id this catalogue can name; the registry code is the id, prefixed `trig-` unless it already is. */
export const SLIP_IDS = Object.freeze([
  'area-cos-for-sin',
  'area-half-forgotten',
  'area-right-angle-formula',
  'compound-angle-sign',
  'compound-distributed',
  'compound-formula-mixed',
  'compound-sign-flipped',
  'cosine-rule-factor-two',
  'cosine-rule-no-root',
  'cosine-rule-order',
  'cosine-rule-plus',
  'cosine-rule-pythagoras',
  'double-angle-doubled-ratio',
  'double-angle-sign-by-quadrant',
  'double-angle-sum-of-squares',
  'identity-forgot-one',
  'identity-sum-of-coefficients',
  'inverse-trig-cos-range',
  'inverse-trig-odd-sign',
  'inverse-trig-operation-sign',
  'inverse-trig-ratio-as-given',
  'inverse-trig-undo-without-range',
  'pythag-added-sides',
  'pythag-leg-as-hyp',
  'pythag-no-root',
  'pythag-subtracted-sides',
  'sine-rule-cosine',
  'sine-rule-inverted',
  'sine-rule-no-inverse',
  'sine-rule-obtuse-angle',
  'trig-bearing-from-east',
  'trig-bearing-from-east-axis',
  'trig-calculator-degrees',
  'trig-calculator-radians',
  'trig-calculus-count-endpoints',
  'trig-calculus-no-chain',
  'trig-calculus-one-per-turn',
  'trig-calculus-sign',
  'trig-calculus-value-not-gradient',
  'trig-calculus-zero-not-stationary',
  'trig-complement-angle',
  'trig-count-one-solution',
  'trig-count-two-solutions',
  'trig-count-zero',
  'trig-exact-value-ratio-as-one',
  'trig-exact-value-swapped',
  'trig-other-solution',
  'trig-ratio-flipped-angle',
  'trig-ratio-ignored',
  'trig-ratio-inverted',
  'trig-reference-angle-only',
  'trig-sign-by-quadrant',
  'trig-units-swapped',
  'trig-wrong-quadrant',
  'trig-wrong-ratio',
  'wave-forgot-shift',
  'wave-half-period',
  'wave-period-denominator',
  'wave-period-from-b',
  'wave-shift-only',
  'wave-sine-as-one',
  'wave-wrong-extreme'
]);
export const registryCode = id => (/^trig-/.test(id) ? id : `trig-${id}`);
const asked = new WeakMap();
const hitFor = ctx => {
  if (asked.has(ctx)) return asked.get(ctx);
  const q = ctx?.meta?.question;
  const hit = q && ctx.meta.kind === 'answer' ? diagnoseWith(entries, q, ctx.meta.value) : null;
  asked.set(ctx, hit);
  return hit;
};
registerTopic({
  topic: 'trigonometry',
  appliesTo: meta => meta?.kind === 'answer' && !!meta.question && typeof meta.question.prompt === 'string',
  slips: SLIP_IDS.map(id => ({
    code: registryCode(id),
    detect: ctx => {
      const hit = hitFor(ctx);
      if (!hit || hit.id !== id) return null;
      return { message: sayIn(hit.say, 'en'), messages: { hi: sayIn(hit.say, 'hi'), 'en-AU': sayIn(hit.say, 'en-AU') }, notesSectionId: null };
    }
  }))
});
