// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AI red-team · promptfoo provider over the REAL server code
//
// Every case runs through the server's own modules, never a copy of them:
//   tutor        validateTutorRequest → askTutorModel (the exact request body
//                the server builds) → the deterministic answer guard
//                (buildGuard + leakedExpressions, and on trees that have them the
//                distress check, the safety output check and the mark-claim
//                check) → what the student would see, as tutor.js help() decides
//                it: a safety reply, the model's message, or the authored hint.
//   handwriting  transcribeHandwriting with a fetch that records the body it is
//                given, so a suite can prove what the reader is (and is not) sent.
//   contract     the static prompt and copy the server and client ship.
//
// Modes (PRI_EVAL_MODE):
//   fixture (default)  no network. The provider's reply is a fixture from
//                      fixtures/, run through the same parse and guard path as a
//                      live reply. Every fixture is marked SYNTHETIC: it is a
//                      hand-written reply used to prove what the guard and the
//                      assertions do with it. It is never a recorded model output.
//   live               the real provider, with the server's own key read from the
//                      environment (PRI_HANDWRITING_API_KEY, as on Railway). The
//                      key is never written anywhere by this file.
//
// Nothing here marks. A model reply is evidence about the model; the
// deterministic engine stays the only authority over a mark.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../../../', import.meta.url);
const HERE = new URL('../', import.meta.url);
const server = path => import(new URL(`server/platform/${path}`, ROOT).href);

const { validateTutorRequest, deterministicHelp } = await server('tutor.js');
const { askTutorModel, providerBody, providerConfig } = await server('tutorProvider.js');
const { buildGuard, leakedExpressions } = await server('tutorGuard.js');
const handwriting = await server('handwritingProvider.js');
const guardModule = await server('tutorGuard.js');
// Present only on branches that carry them (#989 and later); the provider
// mirrors tutor.js help() on whichever tree it runs against.
const safety = await server('tutorSafety.js').catch(() => null);
const replyMarkClaims = guardModule.replyMarkClaimIssues || null;

export const MODE = process.env.PRI_EVAL_MODE === 'live' ? 'live' : 'fixture';
const FIXTURE_ENV = Object.freeze({ PRI_HANDWRITING_API_KEY: 'fixture-mode-not-a-key', NODE_ENV: 'test' });

function fixture(name) {
  const data = JSON.parse(readFileSync(fileURLToPath(new URL(`fixtures/${name}.json`, HERE)), 'utf8'));
  if (data.provenance !== 'SYNTHETIC') throw new Error(`fixture ${name} must declare provenance SYNTHETIC`);
  return data;
}

/** A fetch that answers with a Responses-API payload built from a fixture, recording each body it is sent. */
function fixtureFetch(replies, sent) {
  let i = 0;
  return async (_url, init) => {
    sent.push(JSON.parse(init.body));
    const reply = replies[Math.min(i++, replies.length - 1)];
    const text = typeof reply === 'string' ? reply : JSON.stringify(reply);
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }), {
      status: 200, headers: { 'content-type': 'application/json' }
    });
  };
}

/** The live fetch, recording each body (the body only: headers carry the key). */
function recordingFetch(sent) {
  return async (url, init) => { sent.push(JSON.parse(init.body)); return globalThis.fetch(url, init); };
}

function textsOf(body) {
  return (body?.input || []).flatMap(turn => (turn.content || []).map(part => ({ role: turn.role, type: part.type, text: part.text ?? null })));
}

async function tutorCase(vars) {
  const checked = validateTutorRequest(vars.body);
  if (!checked.ok) return { output: JSON.stringify({ refused: true, code: checked.code || checked.error?.code || null, message: checked.message || checked.error?.message || null }) };
  const request = checked.request;
  if (safety?.distressReply) {
    const distress = safety.distressReply(request, { edition: vars.edition || 'priyabhata' });
    if (distress) return { output: JSON.stringify({ mode: MODE, fixture: null, request: null, attempts: [], source: 'safety', studentSees: distress.message }) };
  }
  const sent = [];
  const env = MODE === 'live' ? process.env : FIXTURE_ENV;
  const replies = MODE === 'live' ? null : fixture(vars.fixture).replies;
  const fetchImpl = MODE === 'live' ? recordingFetch(sent) : fixtureFetch(replies, sent);
  // tutor.js help(): up to two attempts, each guarded; then the authored hint.
  const guard = buildGuard(request.question, { studentLines: request.studentWork.lines, verifiedLines: request.studentWork.verifiedLines });
  const attempts = [];
  let studentSees = null;
  let source = 'fallback';
  for (let attempt = 0; attempt < 2 && !studentSees; attempt++) {
    let reply;
    try { reply = await askTutorModel(request, { env, fetchImpl }); }
    catch (error) { attempts.push({ error: error.code || String(error) }); break; }
    const leaked = leakedExpressions(reply.message, guard, { prompt: request.question.prompt });
    attempts.push({ message: reply.message, revealsAnswer: reply.revealsAnswer, leaked });
    const safetyIssues = safety?.safetyOutputIssues ? safety.safetyOutputIssues(reply.message) : [];
    const markIssues = replyMarkClaims ? replyMarkClaims(reply.message, request.question) : [];
    attempts[attempts.length - 1].guarded = [...safetyIssues, ...markIssues];
    if (reply.message && !reply.revealsAnswer && !leaked.length && !safetyIssues.length && !markIssues.length) { studentSees = reply.message; source = 'model'; }
  }
  if (!studentSees) studentSees = deterministicHelp(request);
  const body = sent[0] || providerBody(request, providerConfig(env));
  const texts = textsOf(body);
  return {
    output: JSON.stringify({
      mode: MODE,
      fixture: MODE === 'fixture' ? vars.fixture : null,
      request: { system: texts.filter(t => t.role === 'system').map(t => t.text).join('\n'), user: texts.filter(t => t.role === 'user').map(t => t.text).join('\n'), store: body.store },
      attempts,
      source,
      studentSees
    })
  };
}

// A 1×1 PNG: the fixture never reads it, and the live red-team images are listed in README as pending.
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

async function handwritingCase(vars) {
  const sent = [];
  const env = MODE === 'live' ? process.env : FIXTURE_ENV;
  const image = vars.image ? `data:image/png;base64,${readFileSync(fileURLToPath(new URL(vars.image, HERE))).toString('base64')}` : TINY_PNG;
  const fetchImpl = MODE === 'live' ? recordingFetch(sent) : fixtureFetch(fixture(vars.fixture).replies, sent);
  let result = null, error = null;
  try { result = await handwriting.transcribeHandwriting(image, { env, fetchImpl }); }
  catch (e) { error = e.code || String(e); }
  const body = sent[0] || null;
  return {
    output: JSON.stringify({
      mode: MODE,
      request: body && {
        keys: Object.keys(body).sort(),
        store: body.store,
        parts: textsOf(body).map(p => ({ role: p.role, type: p.type, text: p.type === 'input_image' ? null : p.text }))
      },
      lines: result?.lines?.map(l => l.text) ?? null,
      error
    })
  };
}

export default class PriServerProvider {
  constructor(options = {}) { this.providerId = options.id || 'pri-server'; }
  id() { return this.providerId; }
  async callApi(_prompt, context) {
    const vars = context?.vars || {};
    if (vars.surface === 'tutor') return tutorCase(vars);
    if (vars.surface === 'handwriting') return handwritingCase(vars);
    if (vars.surface === 'tutor-prompts') {
      const { systemInstructions } = await server('tutorProvider.js');
      const levels = ['nudge', 'socratic', 'walkthrough', 'ask', 'diagnose', 'why'];
      return { output: JSON.stringify(Object.fromEntries(levels.map(l => [l, systemInstructions(l, 'en')]))) };
    }
    if (vars.surface === 'file') return { output: readFileSync(fileURLToPath(new URL(vars.path, ROOT)), 'utf8') };
    return { error: `unknown surface ${vars.surface}` };
  }
}
