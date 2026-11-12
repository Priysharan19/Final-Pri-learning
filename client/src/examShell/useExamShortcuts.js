// The exam shell's keyboard shortcuts (F4 §1.1). `map` is { key: handler },
// keyed by KeyboardEvent.key with letters in lower case: { ArrowLeft, ArrowRight,
// d, f, n, t, '?' }.
//
// A shortcut does nothing while the student is typing (focus in an input,
// textarea, select or contenteditable), while Alt, Ctrl or Meta is held, when
// something nearer the key already handled it, or while `enabled` is false
// (a sheet is open: the sheet owns Esc and Tab).
import { useEffect, useRef } from 'react';

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** The handler a key event would run, or null. Pure; exported for client/test/desk-ui-check.mjs. */
export function shortcutFor(event, map) {
  if (!event || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return null;
  const target = event.target;
  if (target && (TYPING.has(String(target.tagName || '').toUpperCase()) || target.isContentEditable === true)) return null;
  const key = String(event.key || '');
  const name = key.length === 1 ? key.toLowerCase() : key;
  return Object.hasOwn(map, name) && typeof map[name] === 'function' ? map[name] : null;
}

export function useExamShortcuts(map, { enabled = true } = {}) {
  const latest = useRef(map);
  latest.current = map;
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event) => {
      const run = shortcutFor(event, latest.current);
      if (!run) return;
      event.preventDefault();
      run(event);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
