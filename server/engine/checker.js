// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Engine re-export — Equivalence marking, Step Check and the working marker.
// The engine has ONE source of truth: client/src/engine/. This file carries no
// logic; it exists so server-side import paths keep resolving.
// ─────────────────────────────────────────────────────────────────────────────
export * from '../../client/src/engine/checker.js';
