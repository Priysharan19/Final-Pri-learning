// The exam shell's announcements (F4 §1.1): one polite live region, no toast.
// `announce(text)` says a thing once — a phase change, "5 minutes left" — and
// the same words said twice are still read twice.
//
//   const { announce, region } = useAnnounce();   …   {region}
import { createElement, useCallback, useEffect, useRef, useState } from 'react';

export function useAnnounce() {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const announce = useCallback((text) => {
    clearTimeout(timer.current);
    // Emptied first, so a repeat of the same sentence is a change to read.
    setMessage('');
    timer.current = setTimeout(() => setMessage(String(text || '')), 60);
  }, []);
  const region = createElement('div', { className: 'sr-only', role: 'status', 'aria-live': 'polite', 'data-shell-announce': '' }, message);
  return { announce, region, message };
}
