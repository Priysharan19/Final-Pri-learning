// Pri Learning · NSW HSC-style papers on the device (Prithagoras, plan G4)
//
// The counterpart of indiaExamBackend.js, and much smaller: an NSW paper is
// composed entirely by the server (server/platform/exams.js, kind 'nsw'). The
// device lists the server's blueprints — which are released, and what each one
// lacks — and asks for a paper by the blueprint's id. It sends no slots, no
// seed and no layout. Everything after the start (answers, autosave, finish,
// the result) is the same server-paper path every paper uses (backend.js,
// serverExam.js, examSession.js).
//
// NOTHING HERE MARKS AN ANSWER, AND NOTHING HERE DECIDES A RELEASE. A paper the
// server does not list as released cannot be started from here, and the
// server refuses one anyway (EXAM_BLUEPRINT_NOT_RELEASED).
//
// Behind PRI_FEATURE_NSW_EXAMS (src/platform/features.js), for an NSW profile
// only; the server has its own switch (PRI_NSW_EXAMS).
import { cloud } from '../platform/cloudTransport.js';
import { featureEnabled } from '../platform/features.js';
import { checkUnavailable } from './backend.js';
import { requireExamAccount, unavailableKind } from './serverExam.js';

const BLUEPRINT_ID = /^[a-z0-9-]{1,64}$/;

/** Outcomes as the server names them: `{ code, name }`, text only. */
export const namedOutcomes = list => (Array.isArray(list) ? list : [])
  .filter(o => o && typeof o.code === 'string').map(o => ({ code: String(o.code).slice(0, 24), name: String(o.name || o.code).slice(0, 120) }));

/** "Further calculus skills; The binomial theorem": each focus area once, in order. */
export const omittedNames = list => [...new Set(namedOutcomes(list).map(o => o.name))].join('; ');

/** Does this profile see NSW papers in this build? */
export const nswExamsFor = profile => profile?.course === 'nsw' && featureEnabled('nswExams');

/** The routes this module answers for an NSW profile. */
export const nswExamRoute = (method, path) => method === 'GET' && path === '/exams/nsw';

/** The spec an NSW paper is started with: its blueprint's id, nothing else. */
export function nswExamSpec(id) {
  if (typeof id !== 'string' || !BLUEPRINT_ID.test(id)) throw Object.assign(new Error('Choose a paper.'), { status: 400, code: 'EXAM_SPEC_INVALID' });
  return { kind: 'nsw', blueprint: { id } };
}

/** GET /exams/nsw: the server's list, as it stands. */
export async function dispatchNswExam(profile, method, path) {
  if (!nswExamRoute(method, path) || !nswExamsFor(profile)) throw Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' });
  const linked = await requireExamAccount(profile.id);
  let out;
  try { out = await cloud.nswExams(); }
  catch (cause) {
    const kind = unavailableKind(cause);
    if (kind) throw checkUnavailable(kind, cause);
    // Switched off on this server: there is simply nothing to list.
    if (cause?.status === 404) return { available: false, papers: [] };
    throw Object.assign(new Error(cause?.message || 'The papers could not be listed.'), { status: cause?.status || 502, code: cause?.code || 'EXAM_LIST_FAILED' });
  }
  if (out?.accountId !== undefined && String(out.accountId) !== linked) throw checkUnavailable('sign-in');
  const papers = Array.isArray(out?.papers) ? out.papers.filter(p => p && BLUEPRINT_ID.test(String(p.id))).map(p => ({
    id: p.id, label: String(p.label || ''), title: String(p.title || p.label || ''), course: String(p.course || ''), released: p.released === true, partial: p.partial === true, test: p.test === true,
    year12: { covered: Number(p.year12?.covered) || 0, total: Number(p.year12?.total) || 0 },
    omittedOutcomes: namedOutcomes(p.omittedOutcomes),
    readingMin: Number(p.readingMin) || 0, workingMin: Number(p.workingMin) || 0, totalMarks: Number(p.totalMarks) || 0, questions: Number(p.questions) || 0,
    missingOutcomes: Array.isArray(p.missingOutcomes) ? p.missingOutcomes.map(String) : [],
    thinOutcomes: Array.isArray(p.thinOutcomes) ? p.thinOutcomes.map(String) : [],
    source: p.source && typeof p.source === 'object' ? { document: String(p.source.document || ''), url: typeof p.source.url === 'string' ? p.source.url : null } : null
  })) : [];
  return { available: true, label: String(out?.label || ''), markingNote: String(out?.markingNote || ''), papers };
}
