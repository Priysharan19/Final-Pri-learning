// The words for a refused problem report. The server answers POST /v1/reports
// (server/platform/reports.js) with one of a few codes; each gets its own plain
// sentence, and anything unrecognised keeps the general one.
//   RATE_LIMITED (429)            thirty reports an hour
//   REPORT_CONTEXT_TOO_LARGE (413) the attached details were too long
//   REPORT_CATEGORY_INVALID (400)  the chosen reason is not one it accepts
//   401                            the session has ended
// No reply at all (no status) is an offline device or an unreachable server.
export function reportFailureKey(error, online = true) {
  const code = String(error?.code || '');
  const status = Number(error?.status) || 0;
  if (code === 'RATE_LIMITED' || status === 429) return 'report.failedRate';
  if (code === 'REPORT_CONTEXT_TOO_LARGE' || status === 413) return 'report.failedTooLong';
  if (code === 'REPORT_CATEGORY_INVALID') return 'report.failedReason';
  if (status === 401 || code === 'AUTH_REQUIRED' || code === 'SESSION_REQUIRED') return 'report.failedSignIn';
  if (!online || code === 'CLOUD_DISABLED' || (!status && !code)) return 'report.failedOffline';
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'report.failedOffline';
  return 'report.failed';
}
