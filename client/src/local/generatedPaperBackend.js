// Pri Learning · the Paper Generator on the device (both editions)
//
// The counterpart of nswExamBackend.js. A generated paper is assembled
// entirely by the server (server/platform/exams.js, kind 'generated', from
// server/platform/paperGenerator.js): from the edition's approved, issued banks
// only, deterministically from a seed that never leaves the server. The device
// asks for the choices (topics for the year), asks whether the banks can fill a
// request, asks for a printable paper, and starts the paper — sending a request
// of year, topics, length, mix and the weak-topic switch, never a question, a
// mark or a seed. Sitting, autosave, finishing and marking are the one
// server-paper path every paper uses.
//
// NOTHING HERE MARKS AN ANSWER. The marking guide is the server's, and it
// refuses (GUIDE_LOCKED) until the paper has been submitted.
import { cloud } from '../platform/cloudTransport.js';
import { checkUnavailable } from './backend.js';
import { requireExamAccount, unavailableKind } from './serverExam.js';

const GENERATOR_PATH = /^\/exams\/generator\/(options|check|pdf)(\?.*)?$/;
const GUIDE_PATH = /^\/exams\/([A-Za-z0-9._-]{8,100})\/guide$/;

/** Does this profile get generated papers? Both editions do; the server is the authority. */
export const generatedPapersFor = profile => profile?.course === 'nsw' || profile?.course === 'in';

/** The routes this module answers for a profile. */
export function generatedRoute(method, path, body) {
  if (method === 'GET' && (/^\/exams\/generator\/options(\?.*)?$/.test(path) || GUIDE_PATH.test(path))) return true;
  if (method === 'POST' && /^\/exams\/generator\/(check|pdf)$/.test(path)) return true;
  return method === 'POST' && path === '/exams' && body?.generated !== undefined;
}

/** The request a student's choices become: only the fields the server reads. */
export function generatedRequest(choice, profile) {
  const out = { year: Number(choice.year || profile?.year), topics: [...(choice.topics || [])].map(String), mix: String(choice.mix || 'standard') };
  if (choice.minutes) out.minutes = Number(choice.minutes); else out.marks = Number(choice.marks);
  if (profile?.course === 'nsw' && out.year >= 11 && profile.pathway) out.pathway = String(profile.pathway);
  if (profile?.course === 'in' && profile.indiaTrack === 'jee-main') out.track = 'jee-main';
  if (choice.weak === true) out.weak = true;
  return out;
}

/** The query the options are read with. */
export function optionsQuery(profile, year) {
  const parts = [`year=${Number(year || profile?.year)}`];
  if (profile?.course === 'nsw' && Number(year || profile?.year) >= 11 && profile.pathway) parts.push(`pathway=${encodeURIComponent(profile.pathway)}`);
  if (profile?.course === 'in' && profile.indiaTrack === 'jee-main') parts.push('track=jee-main');
  return parts.join('&');
}

const refusal = (cause, fallback) => {
  const kind = unavailableKind(cause);
  if (kind) return checkUnavailable(kind, cause);
  if (cause?.status === 402) {
    return Object.assign(new Error(cause.message), { status: 402, code: cause.code || 'PREMIUM_REQUIRED', capability: cause.capability || 'premium-exams', reason: 'server-refused', refreshRequired: true });
  }
  return Object.assign(new Error(cause?.message || fallback), { status: cause?.status || 502, code: cause?.code || 'EXAM_GENERATOR_FAILED', nearest: cause?.nearest ?? cause?.details?.nearest ?? null });
};

/** Answer the generator routes: the server's reply, as it stands. */
export async function dispatchGeneratedPaper(profile, method, path, body) {
  if (!generatedPapersFor(profile)) throw Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' });
  const linked = await requireExamAccount(profile.id);
  let out;
  try {
    if (method === 'GET' && GENERATOR_PATH.test(path)) out = await cloud.examGeneratorOptions(path.split('?')[1] || '');
    else if (method === 'POST' && path === '/exams/generator/check') out = await cloud.examGeneratorCheck({ generated: body?.generated });
    else if (method === 'POST' && path === '/exams/generator/pdf') out = await cloud.examGeneratorPdf({ generated: body?.generated });
    else if (method === 'GET' && GUIDE_PATH.test(path)) out = await cloud.examGuide(path.match(GUIDE_PATH)[1]);
    else throw Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' });
  } catch (cause) { throw refusal(cause, 'The paper could not be prepared.'); }
  if (out?.accountId !== undefined && String(out.accountId) !== linked) throw checkUnavailable('sign-in');
  return out;
}
