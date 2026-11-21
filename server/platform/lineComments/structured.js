// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · validate the model's STRUCTURED output, render the sentence
//
// The model returns { line, template, slots } for a line and nothing else. This module accepts it or rejects it
// whole; a rejected line keeps the engine's own sentence. The sentence is RENDERED here from the reviewed catalogue
// and the validated slots, so its words are always the catalogue's and its length is bounded by construction.
//
//   · exactly the keys line / template / slots (extra fields: rejected), one entry per line (a duplicate drops the line)
//   · the template exists and is allowed for the ENGINE's state of that line (an arithmetic tick: equality templates only)
//   · exactly the slots the template names; every other slot is absent or null
//   · enum slots are ids from the fixed lists; maths slots are ONE `$…$` span that passes texSafe.cleanLatex and whose
//     normalised content equals an expression that is literally in line N, the engine's note for line N or the line
//     directly above (for a cross, `expected` comes from the engine's note or the line above only).
//     The student's line is a source of MATHS EXPRESSIONS only, never of words.
// ─────────────────────────────────────────────────────────────────────────────
import { cleanLatex } from '../../../client/src/engine/texSafe.js';
import { latexToPlain, squash, numbersIn } from './math.js';
import { TEMPLATES, ENUM_SLOTS, MATHS_SLOTS, SLOT_KEYS } from './catalogue.js';

export const MAX_SLOT_CHARS = 120;
const FUNCTION_RUNS = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'log', 'ln', 'exp', 'sqrt', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'max', 'min', 'lim', 'det']);

/** One `$…$` span, or null. Returns { tex, plain, norm }. */
export function parseMathsSlot(value) {
  if (typeof value !== 'string') return null;
  const m = /^\$(.+)\$$/s.exec(value);
  if (!m) return null;
  const tex = m[1].trim();
  if (!tex || [...tex].length > MAX_SLOT_CHARS || tex.includes('$')) return null;
  if (cleanLatex(tex) === null) return null;
  if (/\\(?:text|mathbf|operatorname|mathrm)\b/.test(tex)) return null;
  // no words inside maths
  if ((tex.replace(/\\[A-Za-z]+/g, ' ').match(/[A-Za-z]{3,}/g) || []).some(run => !FUNCTION_RUNS.has(run.toLowerCase()))) return null;
  // a maths slot is maths: a digit, an operator or bracket, a command, or a single letter (never a short word)
  if (!/[0-9=+\-*/^()\\]|^[A-Za-z]$/.test(tex)) return null;
  const plain = latexToPlain(tex);
  if (plain === null) return null;
  const norm = squash(plain);
  return norm ? { tex, plain, norm } : null;
}

const plainOfSpans = text => String(text ?? '').replace(/\$([^$]+)\$/g, (_, t) => ` ${latexToPlain(t) ?? ''} `).replace(/\\\(|\\\)/g, ' ');

const tokensOf = norm => norm.match(/\d+(?:\.\d+)?|[a-z]|./g) || [];

/**
 * What a source text literally contains, as maths: its normalised token stream. A slot is accepted only if its own
 * normalised tokens are a CONTIGUOUS run of that stream (so a whole line, a side, a term or a number of the line,
 * never a value from anywhere else and never half a number).
 */
export function expressionsOf(text) {
  const toks = tokensOf(squash(plainOfSpans(text)));
  return { toks, has(norm) {
    const want = tokensOf(norm);
    if (!want.length) return false;
    for (let i = 0; i + want.length <= toks.length; i += 1) if (want.every((t, k) => toks[i + k] === t)) return true;
    return false;
  } };
}

/**
 * @param {object} entry   one element of the model's `comments` array
 * @param {object} ctx     { line, allTexts }  line: the engine's record (state, text, index, n, note, reason); allTexts: every report line text
 * @returns {{ ok: true, template: string, text: string, kind: string } | { ok: false, code: string }}
 */
export function renderEntry(entry, ctx, language = 'en') {
  const bad = code => ({ ok: false, code });
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return bad('not-an-object');
  const keys = Object.keys(entry);
  if (keys.length !== 3 || !['line', 'template', 'slots'].every(k => keys.includes(k))) return bad('extra-or-missing-field');
  const { line } = ctx;
  if (!Number.isInteger(entry.line) || entry.line !== line.n) return bad('wrong-line');
  const tpl = typeof entry.template === 'string' && Object.hasOwn(TEMPLATES, entry.template) ? TEMPLATES[entry.template] : null;
  if (!tpl) return bad('unknown-template');
  if (!tpl.states.includes(line.state)) return bad('template-not-allowed-for-state');
  const slots = entry.slots;
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return bad('bad-slots');
  for (const k of Object.keys(slots)) if (!SLOT_KEYS.includes(k)) return bad('unknown-slot');
  for (const k of SLOT_KEYS) if (!tpl.slots.includes(k) && slots[k] !== undefined && slots[k] !== null) return bad('unused-slot-filled');

  const note = `${line.reason && typeof line.reason === 'object' ? `${line.reason.message ?? ''} ${line.reason.fix ?? ''}` : String(line.reason ?? '')} ${line.note ?? ''}`;
  const above = line.index > 0 ? String(ctx.allTexts?.[line.index - 1] ?? '') : '';
  const fromLine = expressionsOf(line.text), fromNote = expressionsOf(note), fromAbove = expressionsOf(above);
  const crossed = line.state === 'first-error';
  const allowed = {
    expected: crossed ? [fromNote, fromAbove] : [fromLine, fromNote, fromAbove],
    written: [fromLine, fromNote]
  };
  const values = {};
  for (const k of tpl.slots) {
    const v = slots[k];
    if (ENUM_SLOTS[k]) {
      if (typeof v !== 'string' || !Object.hasOwn(ENUM_SLOTS[k], v)) return bad(`bad-${k}`);
      values[k] = ENUM_SLOTS[k][v][language === 'hi' ? 1 : 0];
    } else if (MATHS_SLOTS.includes(k)) {
      const p = parseMathsSlot(v);
      if (!p) return bad(`bad-${k}`);
      const sources = allowed[k] || [fromLine, fromNote, fromAbove];
      if (!sources.some(s => s.has(p.norm))) return bad(`${k}-not-in-the-line`);
      values[k] = `$${p.tex}$`;
    }
  }
  const text = (language === 'hi' ? tpl.hi : tpl.en).replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
  return { ok: true, template: entry.template, text, kind: tpl.kind };
}
