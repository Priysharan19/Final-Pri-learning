// Initial India release: the owner expressly deferred Premium sales.
// This is source-bound, not a request or local-storage setting.
// Isolated paid-mode tests explicitly opt into the deferred behavior; the
// same environment variable has no effect in a production process.
export function indiaFreeLaunch(edition, env = {}) {
  return edition === 'priyabhata' &&
    !(env.NODE_ENV === 'test' && env.PRI_TEST_PAID_MODE === '1');
}
