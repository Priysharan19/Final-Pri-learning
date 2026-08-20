// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Engine re-export — Expression normaliser, parser, evaluator and equivalence test.
// The engine has ONE source of truth: client/src/engine/. This file carries no
// logic; it exists so server-side import paths keep resolving.
// ─────────────────────────────────────────────────────────────────────────────
export * from '../../client/src/engine/expr.js';
