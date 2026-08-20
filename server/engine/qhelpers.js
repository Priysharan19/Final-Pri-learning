// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Engine re-export — Seeded RNG, exact fractions, surds, LaTeX formatting, MCQ assembly.
// The engine has ONE source of truth: client/src/engine/. This file carries no
// logic; it exists so server-side import paths keep resolving.
// ─────────────────────────────────────────────────────────────────────────────
export * from '../../client/src/engine/qhelpers.js';
