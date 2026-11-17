// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · spoken mathematics: a deterministic LaTeX-to-speech (en, en-AU, hi)
//
// Pure functions, no DOM and no clock, so the same formula is the same sentence on every device and
// the corpus test (client/test/math-speech-check.mjs) can pin it. The result is the accessible NAME of
// a formula (aria-label on role="math"): "x squared minus 2 x minus 3", "64 over 3".
//
// Rules, in short:
//   · symbols are words: + plus, − minus, × times, = equals, ≤ is less than or equal to …
//   · x^2 "squared", x^3 "cubed", ^\circ "degrees", other powers "to the power n";
//     an ambiguous power or root is closed ("end power", "end root") when more follows it;
//   · \frac{a}{b} is "a over b"; a fraction with a multi-word part is "fraction … over … end fraction";
//   · \sqrt "square root of", \sum, \int, \lim read their limits ("integral from 1 to 3 of …");
//   · matrices and aligned working are read row by row and line by line;
//   · layout commands (\, \; \quad \left \right \displaystyle …) say nothing.
// en-AU differs from en only where Australian usage does ("per cent"); hi has its own lexicon.
// ─────────────────────────────────────────────────────────────────────────────

const EN = {
  plus: 'plus', minus: 'minus', times: 'times', divided: 'divided by', plusMinus: 'plus or minus', minusPlus: 'minus or plus',
  equals: 'equals', notEquals: 'does not equal', less: 'is less than', greater: 'is greater than', lessEq: 'is less than or equal to', greaterEq: 'is greater than or equal to',
  approx: 'is approximately', equiv: 'is equivalent to', similar: 'is similar to', proportional: 'is proportional to', tendsTo: 'tends to', implies: 'implies', iff: 'if and only if',
  isIn: 'is in', notIn: 'is not in', subset: 'is a subset of', union: 'union', intersection: 'intersection', infinity: 'infinity', forall: 'for all', exists: 'there exists', therefore: 'therefore',
  angle: 'angle', perp: 'is perpendicular to', parallel: 'is parallel to', triangle: 'triangle', degrees: 'degrees', percent: 'percent', dollar: 'dollar sign',
  squared: 'squared', cubed: 'cubed', power: 'to the power', endPower: 'end power', sub: 'sub', over: 'over', fraction: 'fraction', endFraction: 'end fraction',
  sqrt: 'square root of', cbrt: 'cube root of', nthRoot: 'th root of', endRoot: 'end root', choose: 'choose', factorial: 'factorial', prime: 'prime',
  open: 'open bracket', close: 'close bracket', openSq: 'open square bracket', closeSq: 'close square bracket', openBrace: 'open brace', closeBrace: 'close brace', openAngle: 'open angle bracket', closeAngle: 'close angle bracket',
  abs: 'absolute value of', endAbs: 'end absolute value', evaluated: 'evaluated', given: 'given', ifWord: 'if', floor: 'floor of', endFloor: 'end floor', ceiling: 'ceiling of', endCeiling: 'end ceiling', inverse: 'inverse', fromAbove: 'from above', fromBelow: 'from below', and: 'and', not: 'not', or: 'or', divides: 'divides', suchThat: 'such that', emptySet: 'empty set', leftArrow: 'left arrow', positive: 'the positive', negative: 'the negative', congruent: 'is congruent to', because: 'because', partial: 'partial', del: 'del', realPart: 'real part of', imagPart: 'imaginary part of', norm: 'magnitude of', endNorm: 'end magnitude',
  sum: 'sum', prod: 'product', integral: 'integral', from: 'from', to: 'to', of: 'of', limit: 'limit', as: 'as', base: 'base', dots: 'dot dot dot', comma: 'comma', semicolon: 'semicolon', colon: 'colon', point: 'point',
  vector: 'vector', bar: 'bar', hat: 'hat', dot: 'dot', tilde: 'tilde', bold: 'bold', boxed: 'boxed',
  matrix: 'matrix', rows: 'rows', row: 'row', columns: 'columns', column: 'column', endMatrix: 'end matrix', aligned: 'working', lines: 'lines', line: 'line', endAligned: 'end working', cases: 'cases', endCases: 'end cases',
  real: 'the real numbers', natural: 'the natural numbers', integers: 'the integers', rationals: 'the rational numbers', complex: 'the complex numbers',
  fn: { sin: 'sine', cos: 'cosine', tan: 'tangent', sec: 'secant', csc: 'cosecant', cot: 'cotangent', arcsin: 'inverse sine', arccos: 'inverse cosine', arctan: 'inverse tangent', sinh: 'hyperbolic sine', cosh: 'hyperbolic cosine', tanh: 'hyperbolic tangent', log: 'log', ln: 'natural log', exp: 'exp', max: 'max', min: 'min', det: 'determinant', gcd: 'G C D', lim: 'limit', mod: 'mod', Pr: 'probability' },
  greek: { alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', epsilon: 'epsilon', varepsilon: 'epsilon', zeta: 'zeta', eta: 'eta', theta: 'theta', vartheta: 'theta', iota: 'iota', kappa: 'kappa', lambda: 'lambda', mu: 'mu', nu: 'nu', xi: 'xi', pi: 'pi', rho: 'rho', sigma: 'sigma', tau: 'tau', upsilon: 'upsilon', phi: 'phi', varphi: 'phi', chi: 'chi', psi: 'psi', omega: 'omega', Gamma: 'capital gamma', Delta: 'capital delta', Theta: 'capital theta', Lambda: 'capital lambda', Pi: 'capital pi', Sigma: 'capital sigma', Phi: 'capital phi', Psi: 'capital psi', Omega: 'capital omega' }
};
const LEXICON = {
  en: EN,
  'en-AU': { ...EN, percent: 'per cent' },
  hi: {
    ...EN,
    plus: 'जमा', minus: 'घटा', times: 'गुणा', divided: 'भाग', plusMinus: 'जमा या घटा', minusPlus: 'घटा या जमा', equals: 'बराबर', notEquals: 'बराबर नहीं', less: 'से कम', greater: 'से अधिक',
    lessEq: 'से कम या बराबर', greaterEq: 'से अधिक या बराबर', approx: 'लगभग बराबर', tendsTo: 'की ओर जाता है', implies: 'इसलिए', infinity: 'अनंत', degrees: 'डिग्री', percent: 'प्रतिशत', dollar: 'डॉलर',
    squared: 'का वर्ग', cubed: 'का घन', power: 'की घात', endPower: 'घात समाप्त', sub: 'सब', over: 'बटा', fraction: 'भिन्न', endFraction: 'भिन्न समाप्त',
    sqrt: 'वर्गमूल', cbrt: 'घनमूल', nthRoot: 'वाँ मूल', endRoot: 'मूल समाप्त', choose: 'चुनें', factorial: 'फैक्टोरियल', prime: 'प्राइम', open: 'कोष्ठक खुला', close: 'कोष्ठक बंद',
    abs: 'निरपेक्ष मान', endAbs: 'निरपेक्ष मान समाप्त', evaluated: 'मान निकालें', sum: 'योग', integral: 'समाकल', from: 'से', to: 'तक', of: 'का', limit: 'सीमा', as: 'जब', base: 'आधार', comma: 'अल्पविराम', point: 'दशमलव',
    vector: 'सदिश', bar: 'बार', hat: 'हैट', matrix: 'आव्यूह', rows: 'पंक्तियाँ', row: 'पंक्ति', columns: 'स्तंभ', column: 'स्तंभ', endMatrix: 'आव्यूह समाप्त', aligned: 'हल', lines: 'पंक्तियाँ', line: 'पंक्ति', endAligned: 'हल समाप्त',
    less: 'छोटा है', greater: 'बड़ा है', lessEq: 'छोटा या बराबर है', greaterEq: 'बड़ा या बराबर है', given: 'दिया गया', ifWord: 'यदि', floor: 'फ़र्श', endFloor: 'फ़र्श समाप्त', ceiling: 'छत', endCeiling: 'छत समाप्त',
    inverse: 'प्रतिलोम', fromAbove: 'ऊपर से', fromBelow: 'नीचे से', and: 'और', not: 'नहीं', or: 'या', divides: 'विभाजित करता है', suchThat: 'ऐसा कि', emptySet: 'रिक्त समुच्चय', leftArrow: 'बायाँ तीर', positive: 'धनात्मक', negative: 'ऋणात्मक', congruent: 'सर्वांगसम है', because: 'क्योंकि', partial: 'आंशिक', del: 'डेल', realPart: 'वास्तविक भाग', imagPart: 'काल्पनिक भाग',
    openSq: 'वर्ग कोष्ठक खुला', closeSq: 'वर्ग कोष्ठक बंद', openBrace: 'ब्रेस खुला', closeBrace: 'ब्रेस बंद', openAngle: 'कोण कोष्ठक खुला', closeAngle: 'कोण कोष्ठक बंद', angle: 'कोण', triangle: 'त्रिभुज',
    union: 'संघ', intersection: 'सर्वनिष्ठ', isIn: 'में है', notIn: 'में नहीं है', subset: 'का उपसमुच्चय है', prod: 'गुणनफल', real: 'वास्तविक संख्याएँ', natural: 'प्राकृत संख्याएँ', integers: 'पूर्णांक', rationals: 'परिमेय संख्याएँ', complex: 'सम्मिश्र संख्याएँ',
    perp: 'लंबवत है', parallel: 'समांतर है', forall: 'सभी के लिए', exists: 'अस्तित्व है', therefore: 'इसलिए', equiv: 'समतुल्य है', similar: 'समरूप है', proportional: 'समानुपाती है', iff: 'यदि और केवल यदि', semicolon: 'अर्धविराम', colon: 'द्विबिंदु',
    dots: 'और इसी प्रकार', tilde: 'टिल्डा', dot: 'बिंदु', bold: 'गाढ़ा', boxed: 'चौखट में', cases: 'स्थितियाँ', endCases: 'स्थितियाँ समाप्त', norm: 'परिमाण', endNorm: 'परिमाण समाप्त', column: 'स्तंभ', abs: 'निरपेक्ष मान', unaryMinus: 'ऋण', unaryPlus: 'धन',
    fn: { sin: 'साइन', cos: 'कोज्या', tan: 'स्पर्शज्या', sec: 'सेकेंट', csc: 'कोसेकेंट', cot: 'कोटैंजेंट', arcsin: 'प्रतिलोम साइन', arccos: 'प्रतिलोम कोज्या', arctan: 'प्रतिलोम स्पर्शज्या', sinh: 'हाइपरबोलिक साइन', cosh: 'हाइपरबोलिक कोज्या', tanh: 'हाइपरबोलिक स्पर्शज्या', log: 'लॉग', ln: 'प्राकृतिक लॉग', exp: 'एक्सपोनेंशियल', max: 'अधिकतम', min: 'न्यूनतम', det: 'सारणिक', gcd: 'म स प', lim: 'सीमा', mod: 'मॉड', Pr: 'प्रायिकता' },
    greek: { alpha: 'अल्फ़ा', beta: 'बीटा', gamma: 'गामा', delta: 'डेल्टा', epsilon: 'एप्सिलॉन', varepsilon: 'एप्सिलॉन', zeta: 'ज़ीटा', eta: 'ईटा', theta: 'थीटा', vartheta: 'थीटा', iota: 'आयोटा', kappa: 'कप्पा', lambda: 'लैम्ब्डा', mu: 'म्यू', nu: 'न्यू', xi: 'ज़ाई', pi: 'पाई', rho: 'रो', sigma: 'सिग्मा', tau: 'टाउ', upsilon: 'अप्सिलॉन', phi: 'फ़ाई', varphi: 'फ़ाई', chi: 'काई', psi: 'साई', omega: 'ओमेगा', Gamma: 'बड़ा गामा', Delta: 'बड़ा डेल्टा', Theta: 'बड़ा थीटा', Lambda: 'बड़ा लैम्ब्डा', Pi: 'बड़ा पाई', Sigma: 'बड़ा सिग्मा', Phi: 'बड़ा फ़ाई', Psi: 'बड़ा साई', Omega: 'बड़ा ओमेगा' }
  }
};

const SYMBOLS = {
  '+': 'plus', '-': 'minus', '−': 'minus', '=': 'equals', '<': 'less', '>': 'greater', '/': 'divided', '!': 'factorial', "'": 'prime',
  ',': 'comma', ';': 'semicolon', ':': 'colon',
  '(': 'open', ')': 'close', '[': 'openSq', ']': 'closeSq'
};
const COMMAND_WORD = {
  times: 'times', cdot: 'times', ast: 'times', div: 'divided', pm: 'plusMinus', mp: 'minusPlus', neq: 'notEquals', ne: 'notEquals', le: 'lessEq', leq: 'lessEq', ge: 'greaterEq', geq: 'greaterEq',
  approx: 'approx', equiv: 'equiv', sim: 'similar', propto: 'proportional', to: 'tendsTo', rightarrow: 'tendsTo', Rightarrow: 'implies', implies: 'implies', Leftrightarrow: 'iff', iff: 'iff',
  in: 'isIn', notin: 'notIn', subset: 'subset', subseteq: 'subset', cup: 'union', cap: 'intersection', infty: 'infinity', forall: 'forall', exists: 'exists', therefore: 'therefore',
  angle: 'angle', perp: 'perp', parallel: 'parallel', triangle: 'triangle', ldots: 'dots', dots: 'dots', cdots: 'dots', vdots: 'dots', ddots: 'dots',
  langle: 'openAngle', rangle: 'closeAngle', lbrace: 'openBrace', rbrace: 'closeBrace', '{': 'openBrace', '}': 'closeBrace', prime: 'prime', circ: 'degrees', degree: 'degrees'
};
const SPACING = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'displaystyle', 'textstyle', 'scriptstyle', 'limits', 'nolimits', 'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'middle', 'hline', 'phantom', 'hspace', 'mathrm', 'operatorname', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathrm', 'not', 'nonumber', 'tag']);
const ENV_ROWS = new Set(['pmatrix', 'bmatrix', 'vmatrix', 'matrix', 'Bmatrix', 'array']);
const ENV_LINES = new Set(['aligned', 'align', 'align*', 'gathered', 'split', 'eqnarray']);

function tokenize(tex) {
  const tokens = []; const re = /\\([a-zA-Z]+|.)|(\d+(?:\.\d+)?)|([a-zA-Z])|(\s+)|(.)/gs;
  let m;
  while ((m = re.exec(tex))) {
    if (m[1] !== undefined) tokens.push({ t: 'cmd', v: m[1] });
    else if (m[2] !== undefined) tokens.push({ t: 'num', v: m[2] });
    else if (m[3] !== undefined) tokens.push({ t: 'let', v: m[3] });
    else if (m[4] !== undefined) continue;
    else tokens.push({ t: 'sym', v: m[5] });
  }
  return tokens;
}

/** The spoken form of a LaTeX formula. `locale` is 'en', 'en-AU' or 'hi'. Never throws: unknown input is read as written. */
export function speakMath(tex, locale = 'en') {
  const L = LEXICON[locale] || LEXICON.en;
  const hi = locale === 'hi';
  const toks = tokenize(String(tex ?? '').replace(/(\d)\{,\}(?=\d{3}(?!\d))/g, '$1').replace(/(\d)\\[,;](?=\d{3}(?!\d))/g, '$1'));
  let noScripts = 0;
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const isSym = (v) => peek() && peek().t === 'sym' && peek().v === v;
  const join = parts => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  let prevOperand = false; // whether the atom just read ends an operand (for unary signs in Hindi)
  const TERM_CMDS = new Set(['frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'binom', 'vec', 'mathbf', 'bar', 'hat', 'left', 'overline', 'overrightarrow', 'pi']);
  const startsTerm = () => {
    const t = peek();
    if (!t) return false;
    if (t.t === 'let' || t.t === 'num') return true;
    if (t.t === 'sym') return t.v === '(' || t.v === '[';
    return TERM_CMDS.has(t.v) || Object.hasOwn(L.greek, t.v) || Object.hasOwn(L.fn, t.v);
  };
  const startsScript = () => !!peek() && peek().t === 'sym' && (peek().v === '^' || peek().v === '_');
  let fracDepth = 0;
  const evalPhrase = lim => (hi ? join([lim.lo !== null ? `${lim.lo} ${L.from}` : '', lim.hi !== null ? `${lim.hi} ${L.to}` : '', L.evaluated]) : join([L.evaluated, lim.lo !== null ? `${L.from} ${lim.lo}` : '', lim.hi !== null ? `${L.to} ${lim.hi}` : '']));
  const numberSay = v => (v.includes('.') ? v.replace(/^(\d+)\.(\d+)$/, (_, a, b) => `${a} ${L.point} ${b.split('').join(' ')}`) : v);

  // One argument: a {group}, a single token, or a command with its own arguments.
  function parseArg() {
    const t = peek();
    if (!t) return { say: '', multi: false };
    if (t.t === 'sym' && t.v === '{') { next(); const r = parseSeq('}'); if (isSym('}')) next(); return r; }
    // Unbraced, a number gives one digit to its operator: \frac12 is 1 over 2, x^23 is x^2 then 3.
    if (t.t === 'num' && t.v.length > 1) { const rest = t.v.slice(1); toks.splice(pos, 1, { t: 'num', v: t.v[0] }, ...tokenize(rest)); }
    noScripts += 1;
    const a = parseAtom();
    noScripts -= 1;
    return { say: a.say, multi: /\s/.test(a.say) && !a.number };
  }
  // A bracketed optional argument [n] (for \sqrt[n]).
  function optionalArg() {
    if (!isSym('[')) return null;
    next(); const parts = [];
    while (peek() && !isSym(']')) parts.push(parseAtom().say);
    if (isSym(']')) next();
    return join(parts);
  }

  function scriptSay(kind, arg) {
    if (kind === '^') {
      if (arg.say === '2') return { say: L.squared, end: false };
      if (arg.say === '3') return { say: L.cubed, end: false };
      if (arg.raw === 'circ' || arg.say === L.degrees) return { say: L.degrees, end: false };
      if (arg.say === L.prime || arg.say === 'prime') return { say: L.prime, end: false };
      return { say: hi ? `${L.power} ${arg.say}` : `${L.power} ${arg.say}`, end: arg.multi };
    }
    return { say: `${L.sub} ${arg.say}`, end: false };
  }

  function readScripts(baseSay, base = {}) {
    let say = baseSay; let end = false;
    while (peek() && peek().t === 'sym' && (peek().v === '^' || peek().v === '_')) {
      const kind = next().v;
      const first = peek();
      const arg = parseArg();
      if (first && first.t === 'cmd') arg.raw = first.v;
      if (first && first.t === 'sym' && (first.v === '+' || first.v === '-')) arg.sym = first.v;
      if (kind === '^' && arg.sym === '+') { say = join([say, L.fromAbove]); continue; }
      if (kind === '^' && arg.sym === '-') { say = join([say, L.fromBelow]); continue; }
      if (base.fn && kind === '^' && (arg.say === `${L.minus} 1` || arg.say === `${L.unaryMinus} 1`)) { say = join([L.inverse, say]); continue; }
      if (base.fn === 'log' && kind === '_') { say = `${say} ${L.base} ${arg.say}`; base.logBase = true; continue; }
      const s = scriptSay(kind, arg);
      say = join([say, s.say]); end = end || s.end;
    }
    return { say, end };
  }

  function limits() { // _{...}^{...} after \sum, \prod, \int, \lim
    let lo = null; let hi2 = null;
    while (peek() && peek().t === 'sym' && (peek().v === '^' || peek().v === '_')) {
      const kind = next().v; const a = parseArg();
      if (kind === '_') lo = a.say; else hi2 = a.say;
    }
    return { lo, hi: hi2 };
  }

  function parseEnv(name) {
    const rows = []; let row = []; let cell = [];
    const flushCell = () => { row.push(join(cell)); cell = []; };
    const flushRow = () => { flushCell(); rows.push(row); row = []; };
    while (peek()) {
      const t = peek();
      if (t.t === 'cmd' && t.v === 'end') { next(); const g = parseArg(); void g; break; }
      if (t.t === 'cmd' && t.v === '\\') { next(); flushRow(); continue; }
      if (t.t === 'sym' && t.v === '&') { next(); flushCell(); continue; }
      cell.push(parseAtom().say);
    }
    if (cell.length || row.length) flushRow();
    const filled = rows.filter(r => r.some(Boolean));
    if (ENV_LINES.has(name)) {
      const lines = filled.map((r, i) => `${L.line} ${i + 1}: ${join(r)}.`);
      return join([`${L.aligned}, ${filled.length} ${filled.length === 1 ? L.line : L.lines}.`, ...lines, `${L.endAligned}.`]);
    }
    if (name === 'cases') {
      return join([`${L.cases}.`, ...filled.map((r, i) => `${L.line} ${i + 1}: ${r.length > 1 ? r.filter(Boolean).join(` ${L.ifWord} `) : join(r)}.`), `${L.endCases}.`]);
    }
    const cols = Math.max(0, ...filled.map(r => r.length));
    const rowSay = filled.map((r, i) => `${L.row} ${i + 1}: ${r.join(', ')}.`);
    return join([`${L.matrix}, ${filled.length} ${filled.length === 1 ? L.row : L.rows}, ${cols} ${cols === 1 ? L.column : L.columns}.`, ...rowSay, `${L.endMatrix}.`]);
  }

  function parseAtom() {
    const t = next();
    if (!t) return { say: '' };
    if (t.t === 'num') {
      const r = withScripts(numberSay(t.v), {});
      const mixed = peek() && peek().t === 'cmd' && ['frac', 'dfrac', 'tfrac'].includes(peek().v) && !t.v.includes('.');
      return { ...r, say: mixed ? `${r.say} ${L.and}` : r.say, number: r.say === numberSay(t.v) && !mixed };
    }
    if (t.t === 'let') return withScripts(t.v, {});
    if (t.t === 'sym') {
      if (t.v === '{') { const r = parseSeq('}'); if (isSym('}')) next(); return withScripts(r.say, {}); }
      if (t.v === '|') { // |x| is an absolute value when a closing bar follows at the same depth; a lone bar is "given"
        let depth = 0; let closes = false;
        for (let k = pos; k < toks.length; k++) {
          const q = toks[k];
          if (q.t === 'sym' && q.v === '{') depth += 1;
          else if (q.t === 'sym' && q.v === '}') { if (depth === 0) break; depth -= 1; } else if (q.t === 'sym' && q.v === '|' && depth === 0) { closes = true; break; }
        }
        if (!closes) return { say: L.given };
        const inner = []; while (peek() && !isSym('|')) inner.push(parseAtom());
        if (isSym('|')) next();
        return withScripts(join([L.abs, join(inner.map(a => a.say)), L.endAbs]), {});
      }
      if (t.v === '^' || t.v === '_') { const a = parseArg(); return { say: scriptSay(t.v, a).say }; }
      if (t.v === '&' || t.v === '}') return { say: '' };
      if (t.v === '%') return { say: L.percent };
      if (t.v === '.') return { say: '' };
      if (t.v === ']' && startsScript() && toks[pos] && toks[pos].v === '_') {
        const lim = limits();
        return { say: join([L.closeSq, evalPhrase(lim)]) };
      }
      if ((t.v === '-' || t.v === '+') && hi && !prevOperand) return { say: t.v === '-' ? L.unaryMinus : L.unaryPlus, op: true };
      const word = SYMBOLS[t.v];
      if (word) return { ...withScripts(L[word], {}), op: ['plus', 'minus', 'equals', 'less', 'greater', 'divided', 'comma', 'semicolon', 'colon', 'open', 'openSq'].includes(word) };
      return withScripts(t.v, {});
    }
    return command(t.v);
  }

  function withScripts(say, base) {
    if (noScripts > 0) return { say, end: false };
    const r = readScripts(say, base);
    return { say: r.say, end: r.end };
  }

  function command(name) {
    if (SPACING.has(name)) {
      if (name === 'left' || name === 'right' || name === 'middle' || name.startsWith('big') || name.startsWith('Big')) return delimiter(name);
      if (name === 'mathrm' || name === 'operatorname' || name === 'mathit' || name === 'mathsf' || name === 'mathtt' || name === 'mathcal') { const a = parseArg(); return withScripts(a.say, {}); }
      if (name === 'phantom' || name === 'hspace' || name === 'tag') { parseArg(); return { say: '' }; }
      return { say: '' };
    }
    if (name === '\\') return { say: '' };
    if (name === '|' || name === 'Vert' || name === 'lVert' || name === 'rVert') { // \|v\| : a norm
      let closes = false; for (let k = pos; k < toks.length; k++) { const q = toks[k]; if (q.t === 'cmd' && (q.v === '|' || q.v === 'Vert' || q.v === 'rVert')) { closes = true; break; } }
      if (!closes) return { say: L.endNorm };
      const inner = []; while (peek() && !(peek().t === 'cmd' && (peek().v === '|' || peek().v === 'Vert' || peek().v === 'rVert'))) inner.push(parseAtom().say);
      if (peek()) next();
      return withScripts(join([L.norm, join(inner), L.endNorm]), {});
    }
    if (name === 'lfloor') return { say: L.floor };
    if (name === 'rfloor') return withScripts(L.endFloor, {});
    if (name === 'lceil') return { say: L.ceiling };
    if (name === 'rceil') return withScripts(L.endCeiling, {});
    if (name === 'neg' || name === 'lnot') return { say: L.not };
    if (name === 'land' || name === 'wedge') return { say: L.and };
    if (name === 'lor' || name === 'vee') return { say: L.or };
    if (name === 'mid') { // "such that" inside a set \\{ x \\mid ... \\}, else divisibility
      let open = 0; for (let k = 0; k < pos; k++) { const q = toks[k]; if (q.t === 'cmd' && q.v === '{') open += 1; else if (q.t === 'cmd' && q.v === '}') open -= 1; }
      return { say: open > 0 ? L.suchThat : L.divides };
    }
    if (name === 'emptyset' || name === 'varnothing') return { say: L.emptySet };
    if (name === 'leftarrow' || name === 'Leftarrow') return { say: L.leftArrow };
    if (name === 'cong') return { say: L.congruent, op: true };
    if (name === 'because') return { say: L.because };
    if (name === 'partial') return { say: L.partial };
    if (name === 'nabla') return { say: L.del };
    if (name === 'Re') return { say: L.realPart };
    if (name === 'Im') return { say: L.imagPart };
    if (name === 'ell') return { say: 'l' };
    if (name === 'text' || name === 'textbf' || name === 'textit' || name === 'mbox') {
      // \text{...}: read as written, including the spaces inside it.
      const g = rawGroup(); return withScripts(g, {});
    }
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
      const nested = fracDepth > 0;
      fracDepth += 1;
      const a = parseArg(); const b = parseArg();
      fracDepth -= 1;
      const simple = !a.multi && !b.multi && !nested && !startsScript() && !startsTerm();
      return withScripts(simple ? `${a.say} ${L.over} ${b.say}` : join([L.fraction, a.say, L.over, b.say, L.endFraction]), {});
    }
    if (name === 'binom' || name === 'dbinom') { const a = parseArg(); const b = parseArg(); return withScripts(`${a.say} ${L.choose} ${b.say}`, {}); }
    if (name === 'sqrt') {
      const n = optionalArg(); const a = parseArg();
      const head = n === null ? L.sqrt : n === '3' ? L.cbrt : n === '2' ? L.sqrt : `${n} ${L.nthRoot}`;
      const closeNow = a.multi || startsScript() || startsTerm();
      if (startsScript()) { const r = withScripts(join([head, a.say, L.endRoot]), {}); return { say: r.say, end: r.end }; }
      return { say: join([head, a.say]), endRoot: closeNow };
    }
    if (name === 'sum' || name === 'prod' || name === 'int' || name === 'iint' || name === 'oint' || name === 'lim' || name === 'limsup' || name === 'liminf') {
      const lim = limits();
      if (name === 'lim') return { say: join([L.limit, lim.lo ? `${L.as} ${lim.lo}` : '']) };
      const word = name === 'sum' ? L.sum : name === 'prod' ? L.prod : L.integral;
      const range = lim.lo !== null || lim.hi !== null
        ? (hi ? join([lim.lo !== null ? `${lim.lo} ${L.from}` : '', lim.hi !== null ? `${lim.hi} ${L.to}` : '']) : join([lim.lo !== null ? `${L.from} ${lim.lo}` : '', lim.hi !== null ? `${L.to} ${lim.hi}` : '']))
        : '';
      return { say: hi ? join([range, word, L.of]) : join([word, range, L.of]) };
    }
    if (name === 'begin') {
      const g = rawGroup(); const env = g.trim();
      const body = parseEnv(env);
      return { say: body };
    }
    if (name === 'end') { parseArg(); return { say: '' }; }
    if (name === 'vec' || name === 'overrightarrow') { const a = parseArg(); return withScripts(`${L.vector} ${a.say}`, {}); }
    if (name === 'mathbf' || name === 'boldsymbol' || name === 'bm') { const a = parseArg(); return withScripts(`${L.vector} ${a.say}`, {}); }
    if (name === 'bar' || name === 'overline') { const a = parseArg(); return withScripts(`${a.say} ${L.bar}`, {}); }
    if (name === 'hat' || name === 'widehat') { const a = parseArg(); return withScripts(`${a.say} ${L.hat}`, {}); }
    if (name === 'tilde' || name === 'widetilde') { const a = parseArg(); return withScripts(`${a.say} ${L.tilde}`, {}); }
    if (name === 'dot' || name === 'ddot') { const a = parseArg(); return withScripts(`${a.say} ${L.dot}`, {}); }
    if (name === 'underline' || name === 'underbrace' || name === 'overbrace' || name === 'cancel' || name === 'mathop') { const a = parseArg(); return withScripts(a.say, {}); }
    if (name === 'boxed') { const a = parseArg(); return { say: join([L.boxed, a.say]) }; }
    if (name === 'overset' || name === 'underset' || name === 'stackrel') { parseArg(); const b = parseArg(); return { say: b.say }; }
    if (name === 'mathbb') {
      const a = parseArg(); const m = { R: L.real, N: L.natural, Z: L.integers, Q: L.rationals, C: L.complex }[a.say];
      const braced = toks[pos + 1] && toks[pos + 1].t === 'sym' && toks[pos + 1].v === '{' && toks[pos + 2] && toks[pos + 2].t === 'sym' && (toks[pos + 2].v === '+' || toks[pos + 2].v === '-') && toks[pos + 3] && toks[pos + 3].t === 'sym' && toks[pos + 3].v === '}';
      const bare = toks[pos + 1] && toks[pos + 1].t === 'sym' && (toks[pos + 1].v === '+' || toks[pos + 1].v === '-');
      if (m && a.say !== 'C' && startsScript() && toks[pos].v === '^' && (bare || braced)) {
        const sign = braced ? toks[pos + 2].v : toks[pos + 1].v; pos += braced ? 4 : 2;
        const sets = { [L.real]: hi ? 'वास्तविक संख्याएँ' : 'real numbers', [L.integers]: hi ? 'पूर्णांक' : 'integers', [L.rationals]: hi ? 'परिमेय संख्याएँ' : 'rational numbers', [L.natural]: hi ? 'प्राकृत संख्याएँ' : 'natural numbers' };
        const noun = sets[m] || m;
        return { say: hi ? join([sign === '+' ? L.positive : L.negative, noun]) : `${sign === '+' ? L.positive : L.negative} ${noun}` };
      }
      return { say: m || a.say };
    }
    if (name === '%') return { say: L.percent };
    if (name === '$') return { say: L.dollar };
    if (name === '#' || name === '&' || name === '_') return { say: name };
    if (name === 'pmod' || name === 'bmod') { const a = parseArg(); return { say: join(['mod', a.say]) }; }
    if (Object.hasOwn(L.greek, name)) return withScripts(L.greek[name], {});
    if (Object.hasOwn(L.fn, name)) {
      const base = { fn: name };
      const say = L.fn[name];
      const r = readScripts(say, base);
      return { say: base.logBase ? `${r.say} ${L.of}` : r.say, end: r.end };
    }
    if (name === 'circ' || name === 'degree') return { say: L.degrees, raw: 'circ' };
    if (Object.hasOwn(COMMAND_WORD, name)) return withScripts(L[COMMAND_WORD[name]], {});
    if (name === 'sin' || name === 'cos') return { say: name };
    return { say: name }; // an unknown command is read as its name
  }

  // Left/right and sized delimiters: read the bracket they carry.
  function delimiter(name) {
    if (name === 'middle') { const d = next(); return { say: d && d.t === 'sym' && d.v === '|' ? '' : '' }; }
    const d = next();
    if (!d) return { say: '' };
    const open = name === 'left' || /l$/.test(name) || name === 'big' || name === 'Big' || name === 'bigg' || name === 'Bigg';
    if (d.t === 'sym') {
      if (d.v === '.') return { say: '' };
      if (d.v === '|') {
        // A bar followed by limits is an evaluation bar ([F]_a^b), not an absolute value.
        if (peek() && peek().t === 'sym' && peek().v === '_' && name !== 'left') { const lim = limits(); return { say: evalPhrase(lim) }; }
        if (name === 'right' && peek() && peek().t === 'sym' && peek().v === '_') { const lim = limits(); return { say: evalPhrase(lim) }; }
        return { say: open ? L.abs : L.endAbs, absDelim: open ? 'open' : 'close' };
      }
      const word = SYMBOLS[d.v];
      if (word) {
        if ((d.v === ']' || d.v === ')') && !open && peek() && peek().t === 'sym' && peek().v === '_') { const lim = limits(); return { say: join([L[word], evalPhrase(lim)]) }; }
        return { say: L[word] };
      }
    }
    if (d.t === 'cmd') {
      if (d.v === '|' || d.v === 'Vert' || d.v === 'lVert' || d.v === 'rVert') return { say: open ? L.abs : L.endAbs };
      if (d.v === '{') return { say: L.openBrace };
      if (d.v === '}') return { say: L.closeBrace };
      if (d.v === 'langle') return { say: L.openAngle };
      if (d.v === 'rangle') return { say: L.closeAngle };
      if (d.v === 'lfloor' || d.v === 'lceil') return { say: d.v === 'lfloor' ? 'floor of' : 'ceiling of' };
      if (d.v === 'rfloor' || d.v === 'rceil') return { say: 'end' };
    }
    return { say: '' };
  }

  // Read a {…} group as raw text (for \text and environment names).
  function rawGroup() {
    if (!isSym('{')) return '';
    next(); let depth = 1; let out = '';
    while (peek() && depth > 0) {
      const t = next();
      if (t.t === 'sym' && t.v === '{') { depth += 1; out += '{'; } else if (t.t === 'sym' && t.v === '}') { depth -= 1; if (depth) out += '}'; } else if (t.t === 'cmd') out += t.v === ',' || t.v === ';' || t.v === ' ' ? ' ' : t.v;
      else out += t.v;
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  function parseSeq(stop) {
    const atoms = [];
    while (peek() && !(stop && peek().t === 'sym' && peek().v === stop)) {
      if (peek().t === 'cmd' && peek().v === 'end' && stop !== 'end') break;
      const atom = parseAtom();
      atoms.push(atom);
      prevOperand = !atom.op && !!atom.say && !/^(?:equals|plus|minus|times|divided by|open bracket|comma)$/.test(atom.say);
    }
    const parts = atoms.map((a, i) => {
      let s = a.say;
      const more = atoms.slice(i + 1).some(b => b.say);
      if (more && a.end) s = `${s} ${L.endPower}`;
      if (more && a.endRoot) s = `${s} ${L.endRoot}`;
      return s;
    });
    const say = join(parts);
    return { say, multi: /\s/.test(say) && !(atoms.length === 1 && atoms[0].number) };
  }

  try {
    const r = parseSeq(null);
    return r.say.replace(/\s+([.,])/g, '$1');
  } catch {
    return String(tex ?? '').replace(/\\[a-zA-Z]+|[{}^_&]/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

/** The locale speech should use: Hindi when the interface is Hindi, else Australian English in the Prithagoras edition, else English. */
export function speechLocale(language, edition) {
  if (language === 'hi') return 'hi';
  return edition === 'prithagoras' ? 'en-AU' : 'en';
}
