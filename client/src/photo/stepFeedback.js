// Present only server-authoritative mathematical step evidence on photo lines.
// OCR uncertainty is not evidence of a mathematical mistake.
import { reportForLines, sameLines } from '../components/attemptEvidence.js';
import { includedLines } from './transcript.js';

export function verifiedPhotoStepFeedback({
  response, submitted, transcript, live, resolved = false
} = {}) {
  if (!live || response?.authoritative !== true || response.invalid ||
      response.technical || response.revealed || response.workingNotRead ||
      submitted?.sourceMode !== 'photo' || !submitted.hasWorking) return null;
  const included = includedLines(transcript);
  if (!included.length || !sameLines(included, submitted.lines)) return null;
  const report = reportForLines(response.stepReport, submitted.lines);
  if (!report) return null;
  let cursor = 0;
  let seenBreak = false;
  let any = false;
  const aligned = (transcript?.lines || []).map(line => {
    if (line.excluded || !String(line.text || '').trim()) return null;
    const evidence = report.lines[cursor++];
    if (seenBreak) return null;
    if (evidence?.status === 'ok') {
      any = true;
      return { status: 'ok' };
    }
    if (evidence?.status === 'break') {
      seenBreak = true;
      any = true;
      return { status: 'break', note: resolved ? String(evidence.note || '').trim().slice(0, 240) : '' };
    }
    return null;
  });
  return any ? aligned : null;
}
