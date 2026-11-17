import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { normalizeNotebook } from '../notebook/notebookView.js';
import { buildTodaySet } from './todaySet.js';

/** The Today set from the server's own notebook and review queue. null while loading; { available:false } signed out or offline. */
export function useToday(user) {
  const [state, setState] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      api.get('/notebook').then(normalizeNotebook).catch(() => null),
      api.get('/reviews').then(r => r?.dotpoints || null).catch(() => null)
    ]).then(([book, queue]) => {
      if (!live) return;
      if ((!book || book.available === false) && !queue) return setState({ available: false, set: null });
      setState({ available: true, set: buildTodaySet({ notebook: book, reviews: queue, now: Date.now() }) });
    });
    return () => { live = false; };
  }, [user?.id]);
  return state;
}
