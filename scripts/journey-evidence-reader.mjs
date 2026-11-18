import { readFileSync } from 'node:fs';

// A missing report on a fresh install is normal. A report we cannot read is
// different: without a known pre-launch offset, it must not supply evidence.
export function reportOffset(path, read = readFileSync) {
  if (!path) return null;
  try { return read(path).length; }
  catch (error) { return error?.code === 'ENOENT' ? 0 : null; }
}

// null means the file is unavailable; an empty lines array means it is
// readable but the current launch has not finished writing a line yet.
export function readJourneyReport(path, offset, read = readFileSync) {
  if (!path || offset === null) return null;
  try {
    const bytes = read(path);
    // The app can replace its report if append fails. A replacement must
    // still contain the current phase's own started line before it counts.
    const nextOffset = bytes.length < offset ? 0 : offset;
    const lines = bytes.subarray(nextOffset).toString('utf8').split('\n');
    lines.pop(); // only complete, newline-terminated records
    return { offset: nextOffset, lines: lines.filter(line => line.startsWith('PRIJOURNEY')) };
  } catch { return null; }
}

// A healthy, readable report must never be interrupted by a slow system-log
// query, even if no new line has arrived. A known report path gets a startup
// grace period; unified log remains a fallback for an unavailable file.
export function journeyReportSource({ path, report, launchAgeMs, sinceLogMs, stallMs, logIntervalMs }) {
  if (report !== null) return 'file';
  if ((path && launchAgeMs < stallMs) || sinceLogMs < logIntervalMs) return 'wait';
  return 'unified';
}
