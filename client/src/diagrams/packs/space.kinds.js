// Pri Learning · diagram pack "space": kind names and pure spec validators (no React).
// See docs/design/notes-e3-contract.md for every kind's spec. validate(params) returns a
// list of problems (empty when the spec is good); model(params) is the pure geometry the
// component draws, so tests can check the numbers without a browser.
export const STATIC = Object.freeze({});
export const INTERACTIVE = Object.freeze({});
// interactive kind -> static kind a question (or a print) shows instead
export const COUNTERPART = Object.freeze({});
