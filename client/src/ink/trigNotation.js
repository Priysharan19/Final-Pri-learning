// Pri Learning · answer-blind trigonometry notation context
//
// Real Apple Pencil evidence shows that generic glyph readers often decode
// ordinary trig words as digit/letter twins (c05 -> cos, 5iu -> sin) even when
// the mathematical structure around those glyphs is clear. This module may use
// ONLY public question language and the recogniser's own alternatives. It never
// reads the expected answer or mark scheme and never changes numeric identity.

const uniq = values => [...new Set((values || []).filter(Boolean).map(String))];
const TRIG_WORDS = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
const TRIG_TOKENS = ['theta', '^', '=', '+', '-', '*', '/', '(', ')', '°'];

export const isTrigContext = ctx =>
  ctx?.trigNotation === true || /trig/i.test(String(ctx?.topic || ''));

export function inferTrigContextFromPrompt(rawPrompt, baseAlphabet = []) {
  const raw = String(rawPrompt || '');
  const hasTrigSignal = /(?:\b(?:sin|cos|tan|sec|csc|cot)\b|\btrigonometric\b|\bdouble[- ]angle\b|θ|\\theta\b)/i.test(raw);
  if (!hasTrigSignal) return null;
  return {
    trigNotation: true,
    trigFunctions: [...TRIG_WORDS],
    alphabet: uniq([...baseAlphabet, ...TRIG_WORDS, ...TRIG_TOKENS])
  };
}

const readingText = reading => String(reading?.text || '').replace(/\s+/g, '');
const canonical = sym => ({ theta: 'theta', 'θ': 'theta', percent: '%', deg: '°', div: '/' }[sym] || String(sym || ''));

// Only families with strong visual overlap are licensed here. The repair is
// further gated by a trig-function slot followed by a real argument, so this
// cannot globally turn arbitrary digits into letters.
const FAMILY = {
  c: new Set(['c', 'C', '(']),
  o: new Set(['o', 'O', '0', 'Q']),
  s: new Set(['s', 'S', '5']),
  i: new Set(['i', 'I', '1', 'l', '|']),
  n: new Set(['n', 'N', 'u', 'U', 'h', 'v']),
  t: new Set(['t', 'T']),
  a: new Set(['a', 'A', 'd'])
};

function targetCost(symbol, wanted) {
  const raw = canonical(symbol?.sym);
  const lower = raw.toLowerCase();
  if (lower === wanted) return 0;
  if (FAMILY[wanted]?.has(raw) || FAMILY[wanted]?.has(lower)) return 0.22;
  for (const alt of symbol?.alts || []) {
    const altRaw = canonical(alt?.sym);
    const altLower = altRaw.toLowerCase();
    if (altLower === wanted && Number(alt?.conf) >= 0.22) return 0.28;
    if ((FAMILY[wanted]?.has(altRaw) || FAMILY[wanted]?.has(altLower)) && Number(alt?.conf) >= 0.34) return 0.34;
  }
  return 1.25;
}

function argumentStartsAt(symbols, index) {
  const first = canonical(symbols[index]?.sym).toLowerCase();
  const second = canonical(symbols[index + 1]?.sym).toLowerCase();
  if (!first) return false;
  if (first === 'theta' || first === '(') return true;
  if (/^[a-z]$/.test(first)) return true;
  // cos2θ / sin2θ is common double-angle working. The digit is not repaired;
  // this only licenses the three glyphs immediately before it as a word slot.
  return /^[0-9]$/.test(first) && second === 'theta';
}

function bestWordForWindow(symbols, start, ctx) {
  if (!argumentStartsAt(symbols, start + 3)) return null;
  const allowed = new Set((ctx?.trigFunctions || TRIG_WORDS).map(x => String(x).toLowerCase()));
  let best = null;
  for (const word of TRIG_WORDS) {
    if (!allowed.has(word) || word.length !== 3) continue;
    const costs = [...word].map((ch, i) => targetCost(symbols[start + i], ch));
    const total = costs.reduce((sum, value) => sum + value, 0);
    const exact = costs.filter(value => value === 0).length;
    // At least one glyph must already agree exactly. Context may settle twins,
    // not invent an entire word from an unrelated three-glyph sequence.
    if (exact < 1 || total > 0.78) continue;
    if (!best || total < best.total) best = { word, total };
  }
  return best;
}

function copyAlt(alts, sym, conf) {
  const out = [{ sym, conf }];
  for (const alt of alts || []) {
    if (String(alt?.sym) === sym) continue;
    out.push(alt);
    if (out.length >= 6) break;
  }
  return out;
}

function repairSymbolWords(symbols, ctx) {
  const source = (symbols || []).map(s => ({ ...s, alts: [...(s.alts || [])] }));
  let changed = false;
  for (let i = 0; i <= source.length - 4; i++) {
    const best = bestWordForWindow(source, i, ctx);
    if (!best) continue;
    [...best.word].forEach((wanted, offset) => {
      const s = source[i + offset];
      if (canonical(s.sym).toLowerCase() === wanted) return;
      const previous = s.sym;
      const capped = Math.min(Number(s.conf) || 0.72, 0.82);
      s.sym = wanted;
      s.conf = capped;
      s.alts = copyAlt(s.alts, previous, Math.min(0.62, Number(s.conf) || 0.5));
      s._trigContextRepair = `function:${best.word}`;
      changed = true;
    });
    i += 2;
  }
  return { symbols: source, changed };
}

function textTwinCost(raw, wanted) {
  if (String(raw || '').toLowerCase() === wanted) return 0;
  return FAMILY[wanted]?.has(raw) || FAMILY[wanted]?.has(String(raw || '').toLowerCase()) ? 0.22 : 1.25;
}

function repairTextWords(text, ctx) {
  const raw = String(text || '');
  const allowed = new Set((ctx?.trigFunctions || TRIG_WORDS).map(x => String(x).toLowerCase()));
  return raw.replace(/([A-Za-z0-9]{3})(?=(?:theta|θ|\(|[A-Za-z]|[0-9](?:theta|θ)))/g, token => {
    let best = null;
    for (const word of TRIG_WORDS) {
      if (!allowed.has(word)) continue;
      const costs = [...word].map((ch, i) => textTwinCost(token[i], ch));
      const total = costs.reduce((sum, value) => sum + value, 0);
      const exact = costs.filter(value => value === 0).length;
      if (exact < 1 || total > 0.78) continue;
      if (!best || total < best.total) best = { word, total };
    }
    return best?.word || token;
  });
}

function recomputeConfidence(result, lines) {
  const all = lines.flatMap(line => line.symbols || []);
  if (!all.length) return result;
  let minConf = 1;
  let margin = 1;
  let weakest = null;
  all.forEach((s, index) => {
    const conf = Number(s.conf) || 0;
    const rival = Math.max(0, ...(s.alts || []).filter(a => a.sym !== s.sym).map(a => Number(a.conf) || 0));
    minConf = Math.min(minConf, conf);
    margin = Math.min(margin, Math.max(0, conf - rival));
    if (!weakest || conf < weakest.conf) weakest = { id: s.id, index, sym: s.sym, conf, alts: s.alts || [] };
  });
  return { ...result, minConf, margin, weakest };
}

export function repairTrigNotationResult(result, ctx) {
  if (!result || !isTrigContext(ctx) || !Array.isArray(result.lines)) return result;
  let changed = false;
  const lines = result.lines.map(line => {
    const repaired = repairSymbolWords(line.symbols || [], ctx);
    const repairedText = repairTextWords(line.text, ctx);
    const textChanged = repairedText !== String(line.text || '');
    changed = changed || repaired.changed || textChanged;
    return (repaired.changed || textChanged)
      ? { ...line, symbols: repaired.symbols, text: repairedText }
      : line;
  });
  if (!changed) return result;
  const withSummary = recomputeConfidence(result, lines);
  return {
    ...withSummary,
    lines,
    symbols: lines.flatMap(line => line.symbols || []),
    text: lines.map(line => line.text).join('\n'),
    trigContextRepair: 'answer-blind-trig-notation-v1'
  };
}

function knownWordRuns(text) {
  let clean = String(text || '').toLowerCase();
  for (const word of [...TRIG_WORDS, 'theta', 'sqrt', 'pi', 'ln', 'log', 'dx', 'dy']) {
    clean = clean.split(word).join(' ');
  }
  return clean.match(/[a-z]{2,}/g) || [];
}

export function trigLineCompatibility(text, ctx) {
  if (!isTrigContext(ctx)) return 0;
  const compact = String(text || '').replace(/\s+/g, '').toLowerCase();
  if (!compact) return -0.4;
  let bonus = 0;
  if (/(?:sin|cos|tan|sec|csc|cot)(?:theta|θ|\(|[a-z]|[0-9])/.test(compact)) bonus += 0.16;
  if (/(?:theta|θ)/.test(compact)) bonus += 0.07;
  if (/\^\(/.test(compact)) bonus += 0.04;
  if (/=/.test(compact)) bonus += 0.03;
  if (/%/.test(compact)) bonus -= 0.20;
  bonus -= Math.min(0.30, knownWordRuns(compact).length * 0.10);
  return bonus;
}

export function trigReadingCompatibility(reading, ctx) {
  if (!isTrigContext(ctx)) return { eligible: true, bonus: 0, reason: null };
  const text = readingText(reading);
  if (!text) return { eligible: false, bonus: -1, reason: 'empty' };
  const lines = Array.isArray(reading?.lines) ? reading.lines : [];
  const lineBonus = lines.length
    ? lines.reduce((sum, line) => sum + trigLineCompatibility(line?.text, ctx), 0) / lines.length
    : trigLineCompatibility(text, ctx);
  const trigEvidence = /(?:sin|cos|tan|sec|csc|cot|theta|θ)/i.test(text);
  const obviousForeignLeak = /(?:\b(?:percent|mod|gcd|lcm)\b|[{}∪∩])/i.test(text);
  if (obviousForeignLeak && !trigEvidence) {
    return { eligible: false, bonus: -0.45, reason: 'trig-context-foreign-language' };
  }
  return { eligible: true, bonus: lineBonus, reason: null };
}
