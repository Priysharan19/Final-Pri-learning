// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the symbol vocabulary of a PUBLIC question stem
//
// The handwriting reader may be told which symbols can appear on the page
// (handwritingProvider.js, rule 2; owner decision 18 November 2026): the set of
// variable letters, Greek letters and function names printed in the question's
// own wording, e.g. {π, t, h, sin}. This module derives that set from the
// stem's text and returns nothing else — no number, no operator, no word, no
// order. It is given the PROMPT string only; it never sees an answer, a
// solution, marks or options, and its result passes sanitizeSymbolHint again
// before anything is sent.
//
// Only mathematics inside $…$ (or \(…\)) is read, so ordinary words in the
// stem ("a", "the", "cm") never become symbols.
// ─────────────────────────────────────────────────────────────────────────────
import { sanitizeSymbolHint, HINT_FUNCTIONS } from './handwritingProvider.js';

const GREEK = Object.freeze({
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
});
// Commands whose braces hold prose or units, not variables.
const PROSE_COMMANDS = /\\(?:text|mathrm|textbf|textit|mbox|operatorname)\s*\{[^{}]*\}/g;

function mathSegments(prompt) {
  const out = [];
  // An escaped dollar (\$90) is currency, not a math delimiter.
  prompt = prompt.replace(/\\\$/g, ' ');
  for (const m of prompt.matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$|\\\(([\s\S]+?)\\\)/g)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

const BARE_FUNCTION = new RegExp(`(?<![A-Za-z\\\\])(?:${HINT_FUNCTIONS.join('|')})(?![A-Za-z])`, 'g');

/** The sorted, de-duplicated symbol list for a stem; [] when there is none. */
export function stemSymbols(prompt) {
  if (typeof prompt !== 'string' || !prompt) return [];
  const found = [];
  for (let math of mathSegments(prompt)) {
    math = math.replace(PROSE_COMMANDS, ' ');
    // A bare function name (sin, ln) is one symbol, not the letters s, i, n.
    math = math.replace(BARE_FUNCTION, name => { found.push(name); return ' '; });
    for (const m of math.matchAll(/\\([A-Za-z]+)|([A-Za-zα-ωΑ-Ω])/gu)) {
      if (m[1]) {
        if (GREEK[m[1]]) found.push(GREEK[m[1]]);
        else if (HINT_FUNCTIONS.includes(m[1])) found.push(m[1]);
        // every other command (\frac, \left, \times, \circ, \triangle ...) is layout, not a symbol
      } else found.push(m[2]);
    }
  }
  return sanitizeSymbolHint(found);
}
