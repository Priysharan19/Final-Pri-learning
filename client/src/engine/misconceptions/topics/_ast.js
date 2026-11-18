// Small AST helpers shared by the topic slip files (number, sequences, finance).
// Pure. They only read and rebuild trees from engine/expr.js; nothing here
// decides a mark.
export const clone = n => (n && typeof n === 'object' ? JSON.parse(JSON.stringify(n)) : n);
export const bare = n => { let c = n; while (c && c.t === 'group') c = c.v; return c; };
const KIDS = { bin: ['l', 'r'], equation: ['l', 'r'], group: ['v'], neg: ['v'], call: ['arg'] };
export const kids = n => KIDS[n?.t] || [];

export function allPaths(ast, base = [], out = []) {
  if (!ast || typeof ast !== 'object') return out;
  out.push(base);
  for (const k of kids(ast)) allPaths(ast[k], [...base, k], out);
  return out;
}
export const nodeAt = (ast, path) => path.reduce((n, k) => n[k], ast);
export function replaceAt(ast, path, node) {
  if (!path.length) return node;
  const [k, ...rest] = path;
  return { ...ast, [k]: replaceAt(ast[k], rest, node) };
}
export const num = v => ({ t: 'num', v, s: String(v) });
export const bin = (op, l, r) => ({ t: 'bin', op, l, r });
export const grp = v => ({ t: 'group', v });
export const isNum = n => bare(n)?.t === 'num';
export const numVal = n => { const b = bare(n); return b?.t === 'num' ? b.v : b?.t === 'neg' && bare(b.v)?.t === 'num' ? -bare(b.v).v : null; };

/** A number as a student writes it. */
export function fmt(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toPrecision(10)));
}

/** Rewrite every subtree with fn(node, path) returning a replacement node or null: one candidate per match. */
export function eachRewrite(ast, fn) {
  const out = [];
  for (const path of allPaths(ast)) {
    const n = nodeAt(ast, path);
    const rewritten = fn(n, path);
    for (const r of [].concat(rewritten || [])) out.push({ ...r, ast: replaceAt(ast, path, r.node) });
  }
  return out;
}
