// Saved library resources (plan F2): which resources this profile has saved,
// and whether each has reached the account yet. The ids are the public
// catalogue's; they are kept per profile on the device and follow the account
// through sync as `resource-bookmark` entities (platform/syncWorker.js).
// Nothing here marks or grades anything.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { isResourceId } from './libraryApi.js';

/** Saved ids, newest first, ahead of the rest, order otherwise kept. Pure. */
export function savedFirst(resources, saved) {
  const list = Array.isArray(resources) ? resources : [];
  const mine = (r) => saved.has(r.id);
  return [...list.filter(mine), ...list.filter(r => !mine(r))];
}

/** The saved set as a Map(id → { pending }). `null` until read, and when it cannot be read. */
export function useSavedResources() {
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/library/saved');
      setSaved(new Map((data?.items || []).filter(i => isResourceId(i.id)).map(i => [i.id, { pending: !!i.pending }])));
    } catch { setSaved(prev => prev); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const toggle = useCallback(async (id) => {
    if (!isResourceId(id)) return;
    setError(null);
    try {
      await api.post(`/library/${id}/bookmark`, {});
      await refresh();
    } catch (err) {
      setError(err?.code === 'RESOURCE_BOOKMARK_LIMIT' ? 'library.saveLimit' : 'library.saveFailed');
    }
  }, [refresh]);
  return { saved, toggle, error };
}
