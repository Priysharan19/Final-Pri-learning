// Pri Learning · which living formulas sit in which NSW topic's notes (topic id → spec ids).
// Imported by the NSW notes page only; it names no India chapter.
export const LIVING_NSW = Object.freeze({
  'ma4-lin-c-01': ['line'],
  'ma5-lin-c-01': ['line'],
  'ma5-nli-c-01': ['quadratic', 'vertex'],
  'ma5-nli-c-02': ['exponential', 'circle'],
  'ma5-nli-p-01': ['circle', 'exponential'],
  'ma5-fnc-p-01': ['circle', 'exponential'],
  'ma5-log-p-01': ['logarithm'],
  'mst-11-02': ['line'],
  'mst-12-s2-10': ['normal'],
  'mav-11-01': ['quadratic'],
  'mav-11-03': ['vertex', 'absolute', 'sine'],
  'mav-11-04': ['sine'],
  'mav-11-07': ['exponential', 'logarithm'],
  'mav-12-07': ['normal']
});
export const livingIdsNsw = topicId => LIVING_NSW[topicId] || [];
