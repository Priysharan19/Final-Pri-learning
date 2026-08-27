from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing patch anchor in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


SET_MODULE = r'''// Pri Learning · answer-blind set-notation context
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
'''
Path('client/src/ink/setNotation.js').write_text(SET_MODULE)

# Native request ownership + request-time stroke snapshots + set context.
replace_once('client/src/ink/native.js',
    "import { fuseNativeStrokeReading } from './hybrid.js';\n",
    "import { fuseNativeStrokeReading } from './hybrid.js';\nimport { inferSetContextFromPrompt, mergeRecognitionContext } from './setNotation.js';\n")
replace_once('client/src/ink/native.js',
    "const pending = new Map();       // reqId → {resolve, context, overrides}\nconst strokeListeners = new Set();\nlet latestStrokes = [];\n",
    "const pending = new Map();       // reqId → {resolve, context, overrides, strokes, surfaceEpoch}\nconst strokeListeners = new Set();\nlet latestStrokes = [];\nlet surfaceEpoch = 0;\n\nexport function snapshotInkStrokes(strokes) {\n  return (Array.isArray(strokes) ? strokes : []).map(stroke => ({\n    ...stroke,\n    points: (Array.isArray(stroke?.points) ? stroke.points : []).map(point => ({ ...point }))\n  }));\n}\n")
replace_once('client/src/ink/native.js',
    "  '+', '-', '*', '/', '=', '(', ')', '[', ']', '<', '>', '<=', '>=', '!=', '±', '.', ',', ':', '%', '°',\n",
    "  '+', '-', '*', '/', '=', '(', ')', '[', ']', '{', '}', '<', '>', '<=', '>=', '!=', '±', '.', ',', ':', '%', '°', '∪', '∩',\n")
replace_once('client/src/ink/native.js',
'''function inferredNotationContext() {
  if (typeof document === 'undefined') return null;
  const prompt = document.querySelector('.q-prompt');
  const raw = String(prompt?.textContent || '');
  const vars = new Set(['u', 'v']);
  const common = new Set('xyzuvnktmabcrfgh'.split(''));
  const re = /(?:^|[^A-Za-z])([A-Za-z])(?=[^A-Za-z]|$)/g;
  for (const match of raw.matchAll(re)) {
    const ch = match[1].toLowerCase();
    if (common.has(ch)) vars.add(ch);
  }
  // TeX/KaTeX accessibility text can duplicate a formula. A set removes all
  // duplication; only membership matters to the recogniser's tie-break prior.
  return { alphabet: [...new Set([...BASE_MATH_ALPHABET, ...vars])] };
}
''',
'''export function inferredNotationContext(explicit = null) {
  if (typeof document === 'undefined') return explicit || null;
  const prompt = document.querySelector('.q-prompt');
  const raw = String(prompt?.textContent || '');
  const vars = new Set(['u', 'v']);
  const common = new Set('xyzuvnktmabcrfgh'.split(''));
  const re = /(?:^|[^A-Za-z])([A-Za-z])(?=[^A-Za-z]|$)/g;
  for (const match of raw.matchAll(re)) {
    const ch = match[1].toLowerCase();
    if (common.has(ch)) vars.add(ch);
  }
  const generic = { alphabet: [...new Set([...BASE_MATH_ALPHABET, ...vars])] };
  const setContext = inferSetContextFromPrompt(raw, generic.alphabet);
  return mergeRecognitionContext(setContext || generic, explicit);
}

function invalidatePending(reason) {
  surfaceEpoch += 1;
  for (const [reqId, entry] of pending) {
    pending.delete(reqId);
    entry.resolve(failedReading(entry.op, reason));
  }
}
''')
replace_once('client/src/ink/native.js',
'''        let reading = payload;
        if (latestStrokes.length &&
            (payload.engine === 'native-primary-debug' || payload.engine === 'native-rescue')) {
          try {
            reading = fuseNativeStrokeReading(
              payload,
              latestStrokes,
              entry.overrides || {},
              entry.context || inferredNotationContext()
            );
            reading.engine = `${payload.engine}+line-stroke-fusion`;
          } catch {
            reading = payload;
          }
        }
        entry.resolve(reading);
''',
'''        if (entry.surfaceEpoch !== surfaceEpoch) {
          entry.resolve(failedReading(entry.op, 'surface-stale'));
          return;
        }
        let reading = payload;
        if (entry.strokes.length &&
            (payload.engine === 'native-primary-debug' || payload.engine === 'native-rescue')) {
          try {
            reading = fuseNativeStrokeReading(
              payload,
              entry.strokes,
              entry.overrides || {},
              entry.context || inferredNotationContext()
            );
            reading.engine = `${payload.engine}+line-stroke-fusion`;
          } catch {
            reading = payload;
          }
        }
        entry.resolve(reading);
''')
replace_once('client/src/ink/native.js',
    "    pending.set(reqId, { resolve, context, overrides: message.overrides || {}, op: message.op });\n",
    "    pending.set(reqId, {\n      resolve, context, overrides: message.overrides || {}, op: message.op,\n      strokes: snapshotInkStrokes(latestStrokes), surfaceEpoch\n    });\n")
replace_once('client/src/ink/native.js',
    "  mount(element) {\n    if (!element) return false;\n    latestStrokes = [];\n",
    "  mount(element) {\n    if (!element) return false;\n    invalidatePending('surface-remounted');\n    latestStrokes = [];\n")
replace_once('client/src/ink/native.js',
    "  unmount() { latestStrokes = []; post({ op: 'unmount' }); },\n",
    "  unmount() { invalidatePending('surface-unmounted'); latestStrokes = []; post({ op: 'unmount' }); },\n")
replace_once('client/src/ink/native.js',
    "  clear() { latestStrokes = []; post({ op: 'clear' }); },\n",
    "  clear() { invalidatePending('surface-cleared'); latestStrokes = []; post({ op: 'clear' }); },\n")

# One safe, request-stable context through all three readers; invalidate late UI callbacks.
replace_once('client/src/ink/InkAnswer.jsx',
    "import { nativeInk, nativeInkAvailable } from './native.js';\n",
    "import { nativeInk, nativeInkAvailable, inferredNotationContext } from './native.js';\n")
replace_once('client/src/ink/InkAnswer.jsx',
    "  const runRecognition = useCallback((strokes, ovr) => {\n    const seq = ++readSeqRef.current;\n\n    const readWithJS = () => {\n      try { return recognizeWithoutDetachedSideWork(strokes, ovr, recognitionContext, recognize); }\n",
    "  const runRecognition = useCallback((strokes, ovr) => {\n    const seq = ++readSeqRef.current;\n    const effectiveContext = inferredNotationContext(recognitionContext);\n\n    const readWithJS = () => {\n      try { return recognizeWithoutDetachedSideWork(strokes, ovr, effectiveContext, recognize); }\n")
replace_once('client/src/ink/InkAnswer.jsx',
    "    nativeInk.foundationRecognize(ovr, recognitionContext).then(foundation => {\n",
    "    nativeInk.foundationRecognize(ovr, effectiveContext).then(foundation => {\n")
replace_once('client/src/ink/InkAnswer.jsx',
    "        const agreed = chooseNativeConsensus([foundation, local]);\n",
    "        const agreed = chooseNativeConsensus([foundation, local], effectiveContext);\n")
replace_once('client/src/ink/InkAnswer.jsx',
    "      nativeInk.recognize(ovr, recognitionContext).then(nativeRaw => {\n",
    "      nativeInk.recognize(ovr, effectiveContext).then(nativeRaw => {\n")
replace_once('client/src/ink/InkAnswer.jsx',
    "          ? readUnreadLines(nativeRaw, strokes, ovr, recognitionContext)\n",
    "          ? readUnreadLines(nativeRaw, strokes, ovr, effectiveContext)\n")
replace_once('client/src/ink/InkAnswer.jsx',
    "        const chosen = chooseNativeConsensus([foundation, local, nativeReading]);\n",
    "        const chosen = chooseNativeConsensus([foundation, local, nativeReading], effectiveContext);\n")
replace_once('client/src/ink/InkAnswer.jsx',
    "  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);\n",
    "  useEffect(() => () => {\n    readSeqRef.current += 1;\n    if (timerRef.current) clearTimeout(timerRef.current);\n  }, []);\n")

# Set-only postprocessing in the JS path.
replace_once('client/src/ink/runtimeSpatial.js',
    "// Pri Learning · runtime spatial guard for the legacy JS fallback\n",
    "// Pri Learning · runtime spatial guard for the legacy JS fallback\nimport { repairSetNotationResult } from './setNotation.js';\n")
replace_once('client/src/ink/runtimeSpatial.js',
    "  const finish = result => repairSingleGlyphQuestionContext(result, ctx);\n",
    "  const finish = result => repairSingleGlyphQuestionContext(repairSetNotationResult(result, ctx), ctx);\n")

# Protect native set punctuation during native/JS glyph fusion.
replace_once('client/src/ink/hybrid.js',
    "import { recognize, classify } from './recognizer.js';\n",
    "import { recognize, classify } from './recognizer.js';\nimport { isSetContext } from './setNotation.js';\n")
replace_once('client/src/ink/hybrid.js',
    "const STRUCTURAL = new Set(['=', '+', '-', '/', 'sqrt', '<', '>', '<=', '>=', '!=', 'div', 'pm', 'deg', 'percent', ':', '∫']);\n",
    "const STRUCTURAL = new Set(['=', '+', '-', '/', 'sqrt', '<', '>', '<=', '>=', '!=', 'div', 'pm', 'deg', 'percent', ':', '∫']);\nconst SET_STRUCTURAL = new Set(['{', '}', ',', '∪', '∩']);\n")
replace_once('client/src/ink/hybrid.js',
    "function strongestNativeStructure(jsSymbol, nativeLine) { let best = null;\n  for (const n of nativeLine?.symbols || []) { const sym = canonical(n.sym || ''); if (!STRUCTURAL.has(sym) || Number(n.conf) < 0.90 || n.approx) continue;\n",
    "function strongestNativeStructure(jsSymbol, nativeLine, ctx) { let best = null;\n  for (const n of nativeLine?.symbols || []) { const sym = canonical(n.sym || ''); const protectedSyntax = STRUCTURAL.has(sym) || (isSetContext(ctx) && SET_STRUCTURAL.has(sym)); if (!protectedSyntax || Number(n.conf) < 0.90 || n.approx) continue;\n")
replace_once('client/src/ink/hybrid.js',
    "function remapJsSymbol(symbol, localToGlobal, lineIndex, ordinal, nativeLine, overrides) {\n",
    "function remapJsSymbol(symbol, localToGlobal, lineIndex, ordinal, nativeLine, overrides, ctx) {\n")
replace_once('client/src/ink/hybrid.js',
    "  const structural = strongestNativeStructure(out, nativeLine);\n",
    "  const structural = strongestNativeStructure(out, nativeLine, ctx);\n")
replace_once('client/src/ink/hybrid.js',
    "  const symbols = raw.map((s, i) => remapJsSymbol(s, indexes, lineIndex, i, line, overrides)).filter(s => s.strokeIdxs.length); if (!symbols.length) return null;\n",
    "  const symbols = raw.map((s, i) => remapJsSymbol(s, indexes, lineIndex, i, line, overrides, ctx)).filter(s => s.strokeIdxs.length); if (!symbols.length) return null;\n")
replace_once('client/src/ink/hybrid.js',
    "function fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex) {\n",
    "function fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex, ctx) {\n")
replace_once('client/src/ink/hybrid.js',
    "    else if (!STRUCTURAL.has(oldSym) && (native.approx || oldConf < 0.58 || (sameFamily(oldSym, jsSym) && jsConf >= 0.65))) { sym = jsSym; conf = Math.min(0.82, Math.max(jsConf, 0.5 * jsConf + 0.25 * oldConf)); alts = mergeAlternatives(sym, [{ sym: oldSym, conf: Math.min(0.70, oldConf) }], native.alts, js.alts); }\n",
    "    else if (!(STRUCTURAL.has(oldSym) || (isSetContext(ctx) && SET_STRUCTURAL.has(oldSym))) && (native.approx || oldConf < 0.58 || (sameFamily(oldSym, jsSym) && jsConf >= 0.65))) { sym = jsSym; conf = Math.min(0.82, Math.max(jsConf, 0.5 * jsConf + 0.25 * oldConf)); alts = mergeAlternatives(sym, [{ sym: oldSym, conf: Math.min(0.70, oldConf) }], native.alts, js.alts); }\n")
replace_once('client/src/ink/hybrid.js',
    "  const lines = reading.lines.map((line, lineIndex) => complexLine(line) ? fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex)\n    : (readWholeNativeLine(line, lineIndex, strokes, overrides, ctx) || fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex)));\n",
    "  const lines = reading.lines.map((line, lineIndex) => complexLine(line) ? fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex, ctx)\n    : (readWholeNativeLine(line, lineIndex, strokes, overrides, ctx) || fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex, ctx)));\n")

# Correction picker vocabulary now includes set syntax.
replace_once('client/src/ink/templates.js',
    "  'div', 'pm', 'deg', 'percent', ':', '∫'\n];\n",
    "  'div', 'pm', 'deg', 'percent', ':', '∫', '{', '}', ',', '∪', '∩', 'A', 'B', 'C', 'S'\n];\n")

# Context-capability filtering in arbitration.
consensus = Path('client/src/ink/nativeConsensus.js')
s = consensus.read_text()
s = "import { isSetContext, setReadingCompatibility } from './setNotation.js';\n" + s
s = s.replace(
'''function choiceScore(r) {
  return intrinsicQuality(r) + engineAdjustment(r);
}

function evidenceOf(r) {
  return {
    engine: r?.engine || 'unknown',
    text: String(r?.text || ''),
    minConf: finiteOr(r?.minConf, null),
    margin: finiteOr(r?.margin, null),
    failure: r?.failure || (!hasReading(r) ? 'no-reading' : null)
  };
}

export function chooseNativeConsensus(candidates) {
  const attempted = (candidates || []).filter(Boolean);
  const live = attempted.filter(hasReading);
  if (!live.length) return null;
''',
'''function choiceScore(r, ctx = null) {
  return intrinsicQuality(r) + engineAdjustment(r) + setReadingCompatibility(r, ctx).bonus;
}

function evidenceOf(r, ctx = null) {
  const compatibility = setReadingCompatibility(r, ctx);
  return {
    engine: r?.engine || 'unknown',
    text: String(r?.text || ''),
    minConf: finiteOr(r?.minConf, null),
    margin: finiteOr(r?.margin, null),
    failure: r?.failure || (!hasReading(r) ? 'no-reading' : null),
    contextCompatible: compatibility.eligible,
    contextReason: compatibility.reason
  };
}

export function chooseNativeConsensus(candidates, ctx = null) {
  const attempted = (candidates || []).filter(Boolean);
  const allLive = attempted.filter(hasReading);
  if (!allLive.length) return null;
  const compatible = allLive.filter(r => setReadingCompatibility(r, ctx).eligible);
  const live = isSetContext(ctx) && compatible.length ? compatible : allLive;
''')
if s == consensus.read_text():
    raise SystemExit('nativeConsensus primary anchor missing')
s = s.replace("return Math.max(...b.map(choiceScore)) - Math.max(...a.map(choiceScore));",
              "return Math.max(...b.map(r => choiceScore(r, ctx))) - Math.max(...a.map(r => choiceScore(r, ctx)));")
s = s.replace("const chosen = [...consensus].sort((a, b) => choiceScore(b) - choiceScore(a))[0];",
              "const chosen = [...consensus].sort((a, b) => choiceScore(b, ctx) - choiceScore(a, ctx))[0];")
s = s.replace("candidateReadings: attempted.map(evidenceOf),",
              "candidateReadings: attempted.map(r => evidenceOf(r, ctx)),", 1)
s = s.replace("const chosen = [...live].sort((a, b) => choiceScore(b) - choiceScore(a))[0];",
              "const chosen = [...live].sort((a, b) => choiceScore(b, ctx) - choiceScore(a, ctx))[0];")
s = s.replace("candidateReadings: attempted.map(evidenceOf),",
              "candidateReadings: attempted.map(r => evidenceOf(r, ctx)),")
consensus.write_text(s)

# Permanent focused regression gate.
Path('client/test/ink-set-notation-check.mjs').write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inferSetContextFromPrompt, repairSetNotationResult, setReadingCompatibility } from '../src/ink/setNotation.js';

const ctx = inferSetContextFromPrompt(
  'Let A = {1, 2, 3, 4, 5, 8} and B = {2, 5, 6, 7, 12}. Write down A ∪ B.',
  ['0','1','2','3','4','5','6','7','8','9','=']
);
assert.equal(ctx.answerType, 'set');
assert.equal(ctx.setNotation, true);
assert.equal(ctx.setElementKind, 'integer');
assert.deepEqual(ctx.setIdentifiers, ['A', 'B']);
for (const token of ['{', '}', ',', '∪', '∩', 'A', 'B']) assert.ok(ctx.alphabet.includes(token));
assert.ok(!Object.hasOwn(ctx, 'expected'));

const sym = (id, value, conf = 0.82) => ({ id, sym: value, conf, alts: [{ sym: value, conf }], strokeIdxs: [] });
const raw = [sym('0','a'), sym('1','u'), sym('2','b'), sym('3','='), sym('4','('), sym('5','1'), sym('6','.'), sym('7','2'), sym('8','.'), sym('9','3'), sym('10',')')];
const repaired = repairSetNotationResult({ lines: [{ text: 'aub=(1.2.3)', symbols: raw }], symbols: raw, text: 'aub=(1.2.3)', minConf: 0.82, margin: 0.2 }, ctx);
assert.equal(repaired.text, 'A∪B={1,2,3}');
assert.equal(repaired.setContextRepair, 'answer-blind-set-notation-v1');
assert.ok(repaired.minConf <= 0.78);

const calculus = { text: "y'=dx=6x^6-180", lines: [{ text: "y'=dx=6x^6-180" }] };
const setReading = { text: 'A∪B={1,2,3}', lines: [{ text: 'A∪B={1,2,3}' }] };
assert.equal(setReadingCompatibility(calculus, ctx).eligible, false);
assert.equal(setReadingCompatibility(setReading, ctx).eligible, true);

const nativeSource = fs.readFileSync(new URL('../src/ink/native.js', import.meta.url), 'utf8');
assert.match(nativeSource, /strokes:\s*snapshotInkStrokes\(latestStrokes\)/);
assert.match(nativeSource, /fuseNativeStrokeReading\(\s*payload,\s*entry\.strokes,/s);
assert.match(nativeSource, /invalidatePending\('surface-remounted'\)/);
assert.match(nativeSource, /entry\.surfaceEpoch !== surfaceEpoch/);
const setSource = fs.readFileSync(new URL('../src/ink/setNotation.js', import.meta.url), 'utf8');
assert.ok(!/ctx\.expected|expectedAnswer|answerText|markScheme/.test(setSource));
console.log('SET NOTATION + REQUEST LIFECYCLE — PASS');
''')

# Add arbitration regression for exact screenshot failure class.
arb = Path('client/test/native-ink-arbitration-check.mjs')
a = arb.read_text()
anchor = "// Arbitration must remain answer-blind.\n"
extra = r'''// Two out-of-domain calculus readers must not outvote one set-capable reader.
{
  const setCtx = { answerType: 'set', setNotation: true, setElementKind: 'integer', setIdentifiers: ['A', 'B'] };
  const foundationLeak = r('pri-foundation-debug', "y'=6x=6x+6x-6x-180", 0.91, 0.25);
  const nativeLeak = r('native-rescue+line-stroke-fusion', "y'=dx=6x^6-6x-180", 0.84, 0.18);
  const setVote = r('pri-js-v3', 'A∪B={1,2,3,4,5,6,7,8,12}', 0.64, 0.10);
  const out = chooseNativeConsensus([foundationLeak, nativeLeak, setVote], setCtx);
  assert.equal(out.text, setVote.text);
  assert.equal(out.disagreement, true);
  assert.ok(out.minConf <= 0.54);
  assert.ok(out.candidateReadings.some(x => x.contextReason === 'set-context-calculus-leak'));
}

'''
if anchor not in a:
    raise SystemExit('native arbitration test anchor missing')
arb.write_text(a.replace(anchor, extra + anchor, 1))

# Register focused gate.
replace_once('package.json',
    '&& npm run test:ink:arbitration && npm run test:ink:stability",',
    '&& npm run test:ink:arbitration && npm run test:ink:sets && npm run test:ink:stability",')
replace_once('package.json',
    '    "test:ink:arbitration": "node client/test/native-ink-arbitration-check.mjs",\n    "test:ink:stability":',
    '    "test:ink:arbitration": "node client/test/native-ink-arbitration-check.mjs",\n    "test:ink:sets": "node client/test/ink-set-notation-check.mjs",\n    "test:ink:stability":')

print('set/lifecycle patch applied')
