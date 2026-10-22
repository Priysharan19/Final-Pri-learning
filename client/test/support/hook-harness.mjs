// A minimal single-component hooks runtime for driving a real component's
// effects in Node, without a DOM. Aliased in place of 'react' for the module
// under test (see question-clock-check.mjs). Renders are flushed explicitly, so
// a test can put time between a state update and the render it causes.
import { createRequire } from 'node:module';
const RealReact = createRequire(import.meta.url)('react');

let current = null;
const deps = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));

export function mount(Component, props) {
  const inst = { Component, props, hooks: [], i: 0, dirty: false, out: null, pending: [] };
  inst.render = () => {
    do {
      inst.dirty = false; inst.i = 0; current = inst;
      inst.out = Component(inst.props); current = null;
      for (const phase of ['layout', 'passive']) {
        for (const h of inst.pending.filter(p => p.phase === phase)) { h.cleanup?.(); const c = h.fn(); h.cleanup = typeof c === 'function' ? c : null; }
      }
      inst.pending = [];
    } while (inst.dirty);
    return inst.out;
  };
  inst.update = next => { inst.props = { ...inst.props, ...next }; return inst.render(); };
  inst.unmount = () => inst.hooks.forEach(h => h?.cleanup?.());
  inst.render();
  return inst;
}

const slot = init => { const inst = current; const k = inst.i++; if (!(k in inst.hooks)) inst.hooks[k] = init(); return [inst, inst.hooks[k]]; };
export function useState(init) {
  const [inst, h] = slot(() => ({ v: typeof init === 'function' ? init() : init }));
  h.set ??= u => { const v = typeof u === 'function' ? u(h.v) : u; if (!Object.is(v, h.v)) { h.v = v; inst.dirty = true; inst.onUpdate?.(); } };
  return [h.v, h.set];
}
const effect = phase => (fn, d) => { const [inst, h] = slot(() => ({})); if (deps(h.d, d)) { h.d = d; h.fn = fn; h.phase = phase; inst.pending.push(h); } };
export const useEffect = effect('passive');
export const useLayoutEffect = effect('layout');
export function useRef(v) { return slot(() => ({ current: v }))[1]; }
export function useMemo(fn, d) { const [, h] = slot(() => ({})); if (deps(h.d, d)) { h.d = d; h.v = fn(); } return h.v; }
export const useCallback = (fn, d) => useMemo(() => fn, d);
export const useSyncExternalStore = (_s, get) => get();
export const useContext = c => c?._currentValue;
export const { createElement, Fragment, createContext, Children, isValidElement, cloneElement } = RealReact;
export default { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useSyncExternalStore, useContext, createElement, Fragment, createContext, Children, isValidElement, cloneElement };
