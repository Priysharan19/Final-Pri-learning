// A history read can outlive its question filter, selected page or profile.
// Never render a late response in another query (or after the component left).
export function createHistoryLoadGate() {
  let cancelled = false;
  return {
    current() { return !cancelled; },
    cancel() { cancelled = true; }
  };
}
