// A small evaluator that is deliberately NOT the product engine's (client/src/engine/expr.js):
// the corpus must not use the system under test to decide what is true. It reads only plain
// arithmetic with + - × ÷ ^ √ π and sin/cos/tan/ln/log/exp/sqrt; anything else returns null.

const FN = { sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan', ln: 'Math.log', log: 'Math.log10', exp: 'Math.exp', sqrt: 'Math.sqrt' };

export function calc(text, env = {}) {
  let s = String(text).replace(/\[/g, '(').replace(/\]/g, ')').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  s = s.replace(/√\s*\(/g, 'sqrt(').replace(/√\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)').replace(/π/g, ' PI ');
  s = s.replace(/%/g, '/100').replace(/°/g, '*(PI/180)');
  for (const [k, v] of Object.entries(env)) s = s.replace(new RegExp(`\\b${k}\\b`, 'g'), `(${v})`);
  s = s.replace(/\^/g, '**');
  // function names -> Math.*
  let bad = false;
  s = s.replace(/[A-Za-z_]+/g, w => (w === 'PI' ? 'Math.PI' : FN[w] ? FN[w] : (bad = true, w)));
  if (bad) return null;
  // implicit multiplication
  s = s.replace(/(\d|\)|Math\.PI)\s*(?=\(|Math\.)/g, '$1*').replace(/\)\s*(?=\d)/g, ')*').replace(/(Math\.PI)\s*(?=\d)/g, '$1*').replace(/(\d)\s*(?=Math\.PI)/g, '$1*');
  s = s.replace(/(Math\.(?:sin|cos|tan|log|log10|exp|sqrt))\*\(/g, '$1(');
  s = s.replace(/(\d)\s+(?=\d)/g, '$1');
  if (!/^[0-9+\-*/().\s,A-Za-z_]*$/.test(s)) return null;
  try {
    const v = Function(`"use strict"; return (${s});`)();
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

export function sameNum(a, b) { return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)); }

export function fmt(v) {
  if (Number.isInteger(v)) return String(v);
  const r = Number(v.toFixed(4));
  return String(r);
}
