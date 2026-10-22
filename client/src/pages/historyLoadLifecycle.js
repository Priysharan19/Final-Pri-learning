// A history read can outlive its question filter, selected page or profile.
// Never render a late response in another query (or after the component left).
export function createHistoryLoadGate() {
  let cancelled = false;
  return {
    current() { return !cancelled; },
    cancel() { cancelled = true; }
  };
}

// The list a render shows must be the list fetched for that render's query.
// A state change (the search turning on, the sort, a page) re-renders at once,
// but the fetch effect only runs after paint: in between, the previous query's
// rows used to render under the new query — the search counted a stale page of
// 20 as "N found", then the effect blanked it to the skeleton and refilled it.
// Keying the loaded rows by their request makes a stale list read as loading.
export function historyListRequest({ instrument, filter, sort, subtopic, searching, page, searchPageSize }) {
  return instrument
    ? { filter, sort, ...(subtopic ? { subtopic } : {}), ...(searching ? { page: 0, pageSize: searchPageSize } : { page }) }
    : { filter, page };
}

export function historyListKey(body) {
  return JSON.stringify(body);
}

/** The loaded rows if they answer `key`, else null (still loading). */
export function historyRowsFor(loaded, key) {
  return loaded && loaded.key === key ? loaded.rows : null;
}
