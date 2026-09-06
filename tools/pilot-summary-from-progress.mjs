import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const PARTICIPANT_RE = /^[A-Za-z0-9_-]{1,32}$/;

function finiteInt(value, label, min = 0, max = 10_000_000) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  return n;
}

function optionalPercent(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error(`${label} must be between 0 and 100.`);
  return Math.round(n * 100) / 100;
}

export function buildPilotSummary(src, { participant, baseline = null, post = null } = {}) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('Progress file must contain a JSON object.');
  if (src.format !== 'pri-progress' || Number(src.version) !== 1) throw new Error('Input is not a supported Pri Learning progress file (pri-progress v1).');
  if (!PARTICIPANT_RE.test(String(participant || ''))) throw new Error('participant must be 1-32 characters using letters, numbers, _ or -.');

  const attempts = finiteInt(src.totals?.attempts ?? 0, 'totals.attempts');
  const correctAttempts = finiteInt(src.totals?.correct ?? 0, 'totals.correct', 0, attempts);
  const taskRows = Array.isArray(src.taskProgress) ? src.taskProgress.slice(0, 10_000) : [];

  let taskDone = 0;
  let taskCorrect = 0;
  let completedTasks = 0;
  for (const row of taskRows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const done = finiteInt(row.done ?? 0, 'taskProgress.done');
    const correct = finiteInt(row.correct ?? 0, 'taskProgress.correct', 0, done);
    taskDone += done;
    taskCorrect += correct;
    if (row.finished === true) completedTasks += 1;
  }

  const exportedAt = Number(src.exportedAt);
  const sourceExportedAt = Number.isFinite(exportedAt) && exportedAt >= 0 ? Math.trunc(exportedAt) : null;
  const baselineValue = optionalPercent(baseline, 'baseline');
  const postValue = optionalPercent(post, 'post');

  return {
    schema: 'pri-pilot-summary-v1',
    participant: String(participant),
    source: { format: 'pri-progress', version: 1, exportedAt: sourceExportedAt },
    attempts,
    correctAttempts,
    accuracy: attempts ? Math.round((correctAttempts / attempts) * 10_000) / 10_000 : null,
    tasks: {
      total: taskRows.length,
      completed: completedTasks,
      questionsDone: taskDone,
      correct: taskCorrect
    },
    baseline: baselineValue,
    post: postValue,
    changePercentagePoints: baselineValue === null || postValue === null
      ? null
      : Math.round((postValue - baselineValue) * 100) / 100,
    limitations: [
      'pri-progress v1 does not contain active-day, practice-time or hint-use aggregates',
      'pre/post values are externally supplied controlled-assessment results and do not establish causation'
    ]
  };
}

async function main(argv) {
  const [file, participant, baseline, post] = argv;
  if (!file || !participant) {
    throw new Error('Usage: node tools/pilot-summary-from-progress.mjs <pri-progress.json> <participant-id> [baseline%] [post%]');
  }
  const path = resolve(file);
  const info = await stat(path);
  if (!info.isFile()) throw new Error('Input path is not a file.');
  if (info.size > MAX_FILE_BYTES) throw new Error('Progress file exceeds the 5 MiB safety limit.');
  const src = JSON.parse(await readFile(path, 'utf8'));
  const summary = buildPilotSummary(src, { participant, baseline, post });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main(process.argv.slice(2)).catch(err => {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  });
}
