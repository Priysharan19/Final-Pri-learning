// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · line comments · THE ALLOWLIST VALIDATOR
//
// constraints.js holds a comment to the engine's states with phrase rules. This module is the other half: a
// comment is acceptable only if EVERYTHING in it is expected, so a phrase nobody thought to forbid is dropped
// too, and the page keeps the engine's own sentence.
//
//   h  every prose word is in the reviewed vocabulary (vocabulary.js) or in a source the comment may draw on
//      (the question, the engine's note for the line, the line itself, the released solution when it was sent);
//      no URL, address, domain, phone-like run, markup, backtick or foreign script; no marks talk;
//      no word about the verdict machinery (cross, engine, marker, Pri, trust, ignore)
//   a  a TICKED line: no negative-verdict word ("wrong", "mistake", "not" ...)
//   b  a CROSSED line: no positive-verdict word ("valid", "right", "fine", "correct" ...) unless the engine's own
//      note says it
//   g  an ARITHMETIC tick (true as written): the smaller arithmetic vocabulary only and no word about the line's
//      ROLE (start, next, step, method, ...); "right" only in the fixed phrase "the arithmetic is right"
//   j  every `$…$` span passes texSafe.cleanLatex (server side, before anything is stored) and holds no prose
//   k  a maths expression or value may appear only if line N, the engine's note for line N or the line directly
//      above says it: never the final answer or a later step
// ─────────────────────────────────────────────────────────────────────────────
import { cleanLatex } from '../../../client/src/engine/texSafe.js';
import { mathSpans, proseOf, squash, latexToPlain, numbersIn, canonSlices, canonStmt } from './math.js';
import {
  OPENING_WORDS, FUNCTION_WORDS, MARKING_WORDS, POSITIVE_VERDICT, NEGATIVE_VERDICT, MACHINERY, MARKS_TALK, SOURCE_ONLY,
  ROLE_WORDS, ARITHMETIC_VOCAB, HINDI_VOCAB
} from './vocabulary.js';

const STEMS = w => [w, `${w}s`, `${w}es`, ...(w.endsWith('s') ? [w.slice(0, -1)] : []), ...(w.endsWith('es') ? [w.slice(0, -2)] : []), ...(w.endsWith('ed') ? [w.slice(0, -2), w.slice(0, -1)] : []),
  ...(w.endsWith('ing') ? [w.slice(0, -3), `${w.slice(0, -3)}e`] : []), ...(w.endsWith('ly') ? [w.slice(0, -2)] : [])];
class Words extends Set { has(w) { return STEMS(w).some(x => super.has(x)); } }
const BASE = new Words([...OPENING_WORDS, ...FUNCTION_WORDS, ...MARKING_WORDS]);
const ARITH = new Words(ARITHMETIC_VOCAB);
const HINDI = new Set(HINDI_VOCAB);
const sets = { POS: new Words(POSITIVE_VERDICT), NEG: new Words(NEGATIVE_VERDICT), MACH: new Words(MACHINERY), MARKS: new Words(MARKS_TALK), SRC: new Words(SOURCE_ONLY), ROLE: new Words(ROLE_WORDS) };

const wordsOf = text => (String(text ?? '').replace(/\$[^$]*\$/g, ' ').toLowerCase().replace(/[’]/g, "'").match(/[a-z]+(?:'[a-z]+)?|[ऀ-ॿ]+/g) || []).map(x => x.replace(/'/g, ''));
const sourceWords = (...texts) => new Words(texts.flatMap(wordsOf));

const PROSE_OK_EN = /^[A-Za-z0-9\s.,;:'’()\-⟦⟧]*$/;
const PROSE_OK_HI = /^[ऀ-ॿA-Za-z0-9\s.,;:'’()\-⟦⟧]*$/;
const ARITH_RIGHT = /\bthe arithmetic (?:on this line )?is right\b/gi;

/** The text of a line's reason (a string or the engine's {message,title,fix}). */
const reasonText = r => (r && typeof r === 'object' ? `${r.message ?? ''} ${r.title ?? ''} ${r.fix ?? ''}` : String(r ?? ''));

/**
 * @param {{ text: string, kind?: string }} comment
 * @param {object} ctx  line (state, text, reason, note, n), question ({ prompt }), solution (only when it was sent),
 *                      studentLines, states (all commented lines), language, allStudentLines
 * @returns {{ rule: string, code: string }[]}
 */
export function allowlistViolations(comment, ctx) {
  const out = [];
  let cur = null;
  const add = (rule, code) => { const e = out.find(v => v.code === code); if (!e) out.push({ rule, code, ...(cur ? { word: cur } : {}) }); else if (cur && !String(e.word).split(' ').includes(cur)) e.word = `${e.word} ${cur}`; };
  const { line, question = null, solution = null, studentLines = [], language = 'en' } = ctx;
  const en = language !== 'hi';
  const text = String(comment?.text ?? '');
  const state = line?.state;
  const arithmetic = state === 'arithmetic';
  const crossed = state === 'first-error';
  const note = reasonText(line?.reason) + ' ' + String(line?.note ?? '');
  const above = line && line.index > 0 ? String(ctx.allStudentLines?.[line.index - 1] ?? '') : '';

  if (!text.trim()) { add('h', 'empty'); return out; }

  // ── prose characters and shapes ─────────────────────────────────────────
  const spans = mathSpans(text);
  const prose = proseOf(text);
  if (/\$|\\/.test(prose)) add('h', 'unpaired-markup');
  if (!(en ? PROSE_OK_EN : PROSE_OK_HI).test(prose)) add('h', 'forbidden-character');
  if (/(?:https?|ftp):|www\b|\b[a-z0-9-]+\.(?:com|net|org|io|au|in|co|edu|gov|app|dev|ly|me|info|biz|xyz|uk|us)\b|@|\/\/|:\/|\bdot com\b/i.test(prose)) add('h', 'contact-or-url');
  const sourceBlob = `${question?.prompt ?? ''} ${note} ${studentLines.join(' ')} ${solution ? JSON.stringify(solution) : ''}`;
  for (const run of prose.replace(/[\s.,\-()]/g, '').match(/\d{5,}/g) || []) if (!sourceBlob.replace(/[\s.,\-()]/g, '').includes(run)) add('h', 'phone-like-digits');
  if (/[^\u0000-\u007fऀ-ॿ’⟦⟧]/.test(prose)) add('h', 'foreign-script');
  if (en && /[ऀ-ॿ]/.test(prose)) add('h', 'foreign-script');

  // ── the vocabulary ──────────────────────────────────────────────────────
  const noteSrc = sourceWords(note);
  const lineSrc = sourceWords(line?.text);
  const wide = sourceWords(question?.prompt, note, line?.text, studentLines.join(' '), solution ? [...(solution.steps || []).flatMap(s => [s?.h, s?.d]), solution.answerText].join(' ') : '');
  const words = wordsOf(prose.replace(/⟦\d+⟧/g, ' '));
  const checkable = arithmetic ? prose.replace(ARITH_RIGHT, ' ').replace(/\b(?:right|left)[- ](?:hand )?sides?\b/gi, ' left side ') : prose;
  const toks = wordsOf(checkable.replace(/⟦\d+⟧/g, ' '));
  for (const wd of toks) {
    cur = wd;
    const hi = /[ऀ-ॿ]/.test(wd);
    if (sets.MACH.has(wd)) add('h', 'verdict-machinery');
    else if (sets.MARKS.has(wd)) add('h', 'marks-talk');
    else if (sets.SRC.has(wd)) { if (!sourceWords(question?.prompt, note, line?.text).has(wd)) add('h', 'marks-talk'); }
    else if (hi) { if (!HINDI.has(wd) && !wide.has(wd)) add('h', 'word-not-allowed'); }
    else if (arithmetic) { if (!ARITH.has(wd) && !noteSrc.has(wd) && !lineSrc.has(wd)) add('g', 'word-not-allowed-on-arithmetic'); }
    else if (!BASE.has(wd) && !wide.has(wd)) add('h', 'word-not-allowed');
  }

  cur = null;
  // ── verdict consistency ─────────────────────────────────────────────────
  if (crossed) {
    for (const wd of toks) if (sets.POS.has(wd) && !noteSrc.has(wd) && !(wd === 'close')) add('b', 'positive-verdict-on-crossed-line');
  } else {
    for (const wd of toks) if (sets.NEG.has(wd)) add('a', 'negative-verdict-on-ticked-line');
  }

  // ── an arithmetic tick says only that the line is true as written ──────
  if (arithmetic) {
    for (const wd of toks) if (sets.ROLE.has(wd)) add('g', 'claims-role');
    if (/\bright\b/i.test(checkable)) add('g', 'claims-role');
  }

  // ── TeX: every span through the same gate the reader's TeX passes ──────
  const srcLetters = sourceWords(sourceBlob);
  for (const sp of spans) {
    if (cleanLatex(sp.tex) === null || /\\(?:text|mathbf|operatorname)\b/.test(sp.tex)) { add('j', 'unsafe-tex'); continue; }
    const letterRuns = sp.tex.replace(/\\[A-Za-z]+/g, ' ').match(/[A-Za-z]{4,}/g) || [];
    if (letterRuns.some(run => !srcLetters.has(run.toLowerCase()))) add('j', 'prose-in-maths');
  }

  // ── content beyond the line ─────────────────────────────────────────────
  const allowed = `${line?.text ?? ''}\n${note}\n${above}`;
  const allowedSq = squash(plainBlob(allowed));
  const allowedCanon = new Set();
  for (const part of plainBlob(allowed).split(/[\n;,]|\bso\b|\bthen\b|\bor\b|\band\b/)) for (const k of canonSlices(part)) allowedCanon.add(k);
  const allowedNums = new Set(numbersIn(plainBlob(allowed)).map(String));
  for (const sp of spans) {
    const plain = latexToPlain(sp.tex);
    if (plain === null) { add('k', 'content-beyond-line'); continue; }
    const sq = squash(plain);
    const inLine = sq.length > 0 && (allowedSq.includes(sq) || allowedCanon.has(canonStmt(plain)));
    if (!inLine) add('k', 'content-beyond-line');
  }
  const refs = new Set([String(line?.n), String((line?.n ?? 1) - 1)]);
  const proseNoRefs = prose.replace(/⟦\d+⟧/g, ' ').replace(/\bline\s+\d+/gi, ' ');
  for (const n of numbersIn(proseNoRefs)) {
    const s = String(n);
    if (!allowedNums.has(s) && !refs.has(s) && !numbersIn(String(question?.prompt ?? '')).map(String).includes(s)) add('k', 'content-beyond-line');
  }
  void words;
  return out;
}

const plainBlob = t => String(t ?? '').replace(/\$([^$]+)\$/g, (_, m) => ` ${latexToPlain(m) ?? m} `).replace(/\\\(|\\\)/g, ' ').replace(/\$/g, ' ');
