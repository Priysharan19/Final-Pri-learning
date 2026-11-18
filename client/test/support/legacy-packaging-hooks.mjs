// Test-only module hook. Makes client/src/engine/packaging.js export the
// SUPERSEDED 'd19-d20' packaging as the active one, so a suite can keep proving
// the daily-cap MECHANISM (20 practice questions a day) that the active
// 'value-2026-11' packaging no longer switches on. Production never loads this;
// the active packaging is changed only by ACTIVE_PACKAGING_ID in packaging.js.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.endsWith('/client/src/engine/packaging.js')) return result;
  const source = String(result.source);
  const swapped = source.replace("ACTIVE_PACKAGING_ID = 'value-2026-11'", "ACTIVE_PACKAGING_ID = 'd19-d20'");
  if (swapped === source) throw new Error('legacy-packaging hook: ACTIVE_PACKAGING_ID line not found in packaging.js');
  return { ...result, source: swapped };
}
