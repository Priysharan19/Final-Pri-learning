// Pri Learning · answer-blind set-notation context
// Public question notation may constrain the language of a recognition request,
// but this module never reads the expected answer or mark scheme.

export const isSetContext = ctx =>
  String(ctx?.answerType || '').toLowerCase() === 'set' || ctx?.setNotation === true;

const uniq = values => [...new Set((values || []).filter(Boolean).map(String))];
const SET_TOKENS = ['{', '}', ',', '∪', '∩', '='];

export function inferSetContextFromPrompt(rawPrompt, baseAlphabet = []) {
  const raw = String(rawPrompt || '');
  const hasSetSignal = /[{}∪∩]|\\(?:cup|cap)\b|\bsets?\b|\bunion\b|\bintersection\b/i.test(raw);
  if (!hasSetSignal) return null;

  const ids = [];
  for (const m of raw.matchAll(/(?:^|[^A-Za-z])([A-Z])(?=[^A-Za-z]|$)/g)) ids.push(m[1]);
  const setIdentifiers = uniq(ids);
  const braceBodies = [...raw.matchAll(/\{([^}]*)\}/g)].map(m => m[1]);
  const integerLists = braceBodies.length > 0 && braceBodies.every(body =>
    /^\s*-?\d+(?:\s*,\s*-?\d+)*\s*$/.test(body)
  );

  return {
    answerType: 'set',
    setNotation: true,
    setElementKind: integerLists ? 'integer' : 'mixed',
    setIdentifiers,
    alphabet: uniq([...baseAlphabet, ...setIdentifiers, ...setIdentifiers.map(x => x.toLowerCase()), ...SET_TOKENS])
  };
}

export function mergeRecognitionContext(inferred, explicit) {
  if (!inferred) return explicit || null;
  if (!explicit) return inferred;
  return {
    ...inferred,
    ...explicit,
    setIdentifiers: uniq([...(inferred.setIdentifiers || []), ...(explicit.setIdentifiers || [])]),
    alphabet: uniq([...(inferred.alphabet || []), ...(explicit.alphabet || [])])
  };
}

const readingText = r => String(r?.text || '').replace(/\s+/g, '');

// This is a capability check, not an answer scorer. A calculus sentence with no
// set/list evidence cannot become authoritative on a set question merely because
// two out-of-domain engines agree with one another.
export function setReadingCompatibility(reading, ctx) {
  if (!isSetContext(ctx)) return { eligible: true, bonus: 0, reason: null };
  const text = readingText(reading);
  if (!text) return { eligible: false, bonus: -1, reason: 'empty' };
  const setSyntax = /[{}∪∩,]/.test(text);
  const listEvidence = /-?\d+,-?\d+/.test(text);
  const setEvidence = setSyntax || listEvidence;
  const calculusLeak = /(?:[∫′']|\b(?:sin|cos|tan|sec|csc|cot|ln|log|sqrt|dx|dy)\b|\^[({]?\d)/i.test(text);
  if (calculusLeak && !setEvidence) {
    return { eligible: false, bonus: -0.55, reason: 'set-context-calculus-leak' };
  }
  let bonus = 0;
  if (/[{}]/.test(text)) bonus += 0.10;
  if (/[∪∩]/.test(text)) bonus += 0.10;
  if (listEvidence) bonus += 0.08;
  return { eligible: true, bonus, reason: null };
}

const copyAlt = (alts, sym, conf) => [
  { sym, conf },
  ...(alts || []).filter(a => a.sym !== sym)
].slice(0, 6);

const isIdentifier = (sym, ctx) => {
  const upper = String(sym || '').toUpperCase();
  return (ctx?.setIdentifiers || []).includes(upper);
};

// Recover only syntax implied by the public set language. Digit identity is
// never changed here. Context-repaired symbols are confidence-capped so a
// language prior cannot manufacture certainty.
export function repairSetNotationResult(result, ctx) {
  if (!result || !isSetContext(ctx) || !Array.isArray(result.lines)) return result;
  let changed = false;

  const lines = result.lines.map(line => {
    const source = (line.symbols || []).map(s => ({ ...s, alts: [...(s.alts || [])] }));
    if (!source.length) return line;
    let lineChanged = false;

    for (let i = 0; i < source.length; i++) {
      const s = source[i];
      const upper = String(s.sym || '').toUpperCase();
      const prev = source[i - 1], next = source[i + 1];
      if (isIdentifier(s.sym, ctx) && s.sym !== upper) {
        const labelSlot = i === 0 || ['=', 'u', 'n', '∪', '∩'].includes(next?.sym);
        const relationSlot = ['u', 'n', '∪', '∩'].includes(prev?.sym);
        if (labelSlot || relationSlot) {
          s.sym = upper;
          s.conf = Math.min(Number(s.conf) || 0.72, 0.78);
          s.alts = copyAlt(s.alts, upper, s.conf);
          s._setContextRepair = 'identifier-case';
          changed = lineChanged = true;
        }
      }
    }

    for (let i = 1; i < source.length - 1; i++) {
      const s = source[i], prev = source[i - 1], next = source[i + 1];
      if (s.sym === 'u' && isIdentifier(prev?.sym, ctx) && isIdentifier(next?.sym, ctx)) {
        s.sym = '∪'; s.conf = Math.min(Number(s.conf) || 0.72, 0.78);
        s.alts = copyAlt(s.alts, '∪', s.conf); s._setContextRepair = 'union'; changed = lineChanged = true;
      } else if (s.sym === 'n' && isIdentifier(prev?.sym, ctx) && isIdentifier(next?.sym, ctx)) {
        s.sym = '∩'; s.conf = Math.min(Number(s.conf) || 0.72, 0.78);
        s.alts = copyAlt(s.alts, '∩', s.conf); s._setContextRepair = 'intersection'; changed = lineChanged = true;
      }
    }

    if (ctx?.setElementKind === 'integer') {
      for (let i = 1; i < source.length - 1; i++) {
        const s = source[i], prev = source[i - 1], next = source[i + 1];
        if (s.sym === '.' && /^[0-9]$/.test(prev?.sym || '') && /^[0-9]$/.test(next?.sym || '')) {
          s.sym = ','; s.conf = Math.min(Number(s.conf) || 0.68, 0.72);
          s.alts = copyAlt(s.alts, ',', s.conf); s._setContextRepair = 'integer-list-comma'; changed = lineChanged = true;
        }
      }
    }

    const digitCount = source.filter(s => /^[0-9]$/.test(s.sym)).length;
    const commaCount = source.filter(s => s.sym === ',').length;
    if (digitCount >= 2 && commaCount >= 1) {
      const firstDigit = source.findIndex(s => /^[0-9]$/.test(s.sym));
      let lastDigit = -1;
      for (let i = source.length - 1; i >= 0; i--) {
        if (/^[0-9]$/.test(source[i].sym)) { lastDigit = i; break; }
      }
      const before = firstDigit > 0 ? source[firstDigit - 1] : null;
      const after = lastDigit >= 0 && lastDigit + 1 < source.length ? source[lastDigit + 1] : null;
      if (before && ['(', '['].includes(before.sym)) {
        before.sym = '{'; before.conf = Math.min(Number(before.conf) || 0.68, 0.74);
        before.alts = copyAlt(before.alts, '{', before.conf); before._setContextRepair = 'open-brace'; changed = lineChanged = true;
      }
      if (after && [')', ']'].includes(after.sym)) {
        after.sym = '}'; after.conf = Math.min(Number(after.conf) || 0.68, 0.74);
        after.alts = copyAlt(after.alts, '}', after.conf); after._setContextRepair = 'close-brace'; changed = lineChanged = true;
      }
    }

    return lineChanged ? { ...line, symbols: source, text: source.map(s => s.sym).join('') } : line;
  });

  if (!changed) return result;
  const byId = new Map(lines.flatMap(l => l.symbols || []).map(s => [s.id, s]));
  const symbols = (result.symbols || []).map(s => byId.get(s.id) || s);
  const all = lines.flatMap(l => l.symbols || []);
  let minConf = all.length ? 1 : Number(result.minConf) || 1;
  let margin = all.length ? 1 : Number(result.margin) || 1;
  let weakest = null;
  all.forEach((s, index) => {
    const conf = Number(s.conf) || 0;
    const rival = Math.max(0, ...(s.alts || []).filter(a => a.sym !== s.sym).map(a => Number(a.conf) || 0));
    minConf = Math.min(minConf, conf);
    margin = Math.min(margin, Math.max(0, conf - rival));
    if (!weakest || conf < weakest.conf) weakest = { id: s.id, index, sym: s.sym, conf, alts: s.alts || [] };
  });
  return {
    ...result,
    lines,
    symbols,
    text: lines.map(l => l.text).join('\n'),
    minConf,
    margin,
    weakest,
    setContextRepair: 'answer-blind-set-notation-v1'
  };
}
