// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Engine re-export — Elo ratings, mastery, scheduler, mark predictor and priorities.
// The engine has ONE source of truth: client/src/engine/. This file carries no
// logic; it exists so server-side import paths keep resolving.
// ─────────────────────────────────────────────────────────────────────────────
export * from '../../client/src/engine/adaptive.js';
