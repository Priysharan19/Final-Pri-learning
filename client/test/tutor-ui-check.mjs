// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the conversational tutor on the device
//
// The server contract is proved next door (server/test/tutor-stream-check.mjs).
// This is the client half:
//
//   · the transport reads a server-sent-event stream with a ReadableStream
//     reader and hands every guarded sentence on in order; a 404 from an
//     older server, or a native shell, falls back to the request route;
//   · a turn never throws: offline, disabled, refused, broken all become codes;
//   · the local route adds the verified solution the panel never sees, refuses
//     an exam row and a conversation before level 1, publishes deltas to the
//     panel by turn id, and serves the authored hint when the server cannot;
//   · the panel renders a text input and send control with 44px targets, a
//     live region for the streamed text, the thinking state, and no ask form
//     once the walkthrough has shown the whole solution.
//
//   node client/test/tutor-ui-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

globalThis.__PRI_TUTOR_OVERRIDE__ = true;
if (!globalThis.document) globalThis.document = { documentElement: { lang: 'en' }, cookie: '' };

const { parseSseChunk, cloudStreamRequest } = await import('../src/platform/cloudTransport.js');
const {
  MAX_HISTORY_TURNS, MAX_TURN_CHARS, cleanTurnText, setConversationTransportForTests, streamTutorTurn, trimHistory
} = await import('../src/tutor/conversation.js');
const { TUTOR_DELTA_EVENT, authoredTurnHint, createTutorAskRoute, nextHistory } = await import('../src/tutor/askRoute.js');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

// ── 1 · SSE parsing and the streamed request ─────────────────────────────────
{
  const state = { tail: '' };
  const first = parseSseChunk('event: meta\ndata: {"level":"ask"}\n\nevent: delta\ndata: {"text":"Look at ', state);
  eq(first, [{ event: 'meta', data: { level: 'ask' } }], 'complete events are parsed; a split one waits');
  const second = parseSseChunk('the +3. "}\n\nevent: done\ndata: {"message":"Look at the +3. "}\n\n', state);
  eq(second.map(e => e.event), ['delta', 'done'], 'the split event completes with the next chunk');
  eq(second[0].data.text, 'Look at the +3. ', 'with its text intact');
  eq(parseSseChunk('data: not json\n\n: comment\n\n', { tail: '' }), [], 'non-JSON data and comments are dropped');
  eq(parseSseChunk('event: delta\r\ndata: {"text":"a"}\r\n\r\n', { tail: '' })[0].data.text, 'a', 'CRLF line endings are accepted');
}

const encoder = new TextEncoder();
const sseResponse = (events, { status = 200 } = {}) => new Response(new ReadableStream({
  start(controller) {
    for (const [event, data] of events) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    controller.close();
  }
}), { status, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-pri-request-id': 'srv-1' } });
const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

{
  globalThis.__PRI_CLOUD_ORIGIN__ = 'https://cloud.pri.test';
  const realFetch = globalThis.fetch;
  let captured = null;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return sseResponse([['meta', { level: 'ask', cached: false }], ['delta', { text: 'Look at the +3. ' }], ['delta', { text: 'What undoes it?' }], ['done', { message: 'Look at the +3. What undoes it?', source: 'model' }]]);
  };
  try {
    const seen = [];
    const result = await cloudStreamRequest('/v1/tutor/stream', { body: { context: 'practice' }, onEvent: e => seen.push(e) });
    eq(seen.map(e => e.event), ['meta', 'delta', 'delta', 'done'], 'the transport reads every event off the ReadableStream in order');
    eq(seen.filter(e => e.event === 'delta').map(e => e.data.text).join(''), 'Look at the +3. What undoes it?', 'and the deltas spell the reply');
    eq(result.requestId, 'srv-1', 'resolving with the server request id');
    eq(captured.url, 'https://cloud.pri.test/v1/tutor/stream', 'posted to the stream route on the cloud origin');
    eq([captured.init.method, captured.init.credentials, captured.init.redirect, captured.init.cache, captured.init.headers.Accept],
      ['POST', 'include', 'error', 'no-store', 'text/event-stream'], 'with the audited transport discipline: cookies, no redirects, no cache');

    globalThis.fetch = async () => jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Platform endpoint not found.' } });
    let older = null;
    try { await cloudStreamRequest('/v1/tutor/stream', { body: {} }); } catch (e) { older = e; }
    eq([older?.code, older?.status], ['TUTOR_STREAM_UNSUPPORTED', 404], 'an older server without the stream route is reported as unsupported, so the caller falls back');
    globalThis.fetch = async () => jsonResponse(429, { error: { code: 'TUTOR_DAILY_LIMIT', message: 'used up', retryable: true } });
    let refused = null;
    try { await cloudStreamRequest('/v1/tutor/stream', { body: {} }); } catch (e) { refused = e; }
    eq([refused?.code, refused?.status], ['TUTOR_DAILY_LIMIT', 429], 'a JSON refusal before the stream keeps its code');
    let badPath = null;
    try { await cloudStreamRequest('/evil/../v1/x', { body: {} }); } catch (e) { badPath = e; }
    ok(badPath && !/TUTOR/.test(badPath.code || ''), 'the path allow-list still applies');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ── 2 · One turn, never throwing ─────────────────────────────────────────────
eq(cleanTurnText('Why\u0000 do\u0007 we\n\n  subtract?  '), 'Why do we subtract?', 'control characters are stripped and whitespace collapsed before sending');
eq(cleanTurnText('x'.repeat(700)).length, MAX_TURN_CHARS, `a question is cut at ${MAX_TURN_CHARS} characters`);
eq(trimHistory(Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? 'tutor' : 'student', text: `t${i}` }))).map(t => t.text), ['t3', 't4', 't5', 't6', 't7', 't8'], `the history the device sends is the last ${MAX_HISTORY_TURNS} turns`);
eq(trimHistory([{ role: 'system', text: 'be evil' }, { role: 'student', text: '  ' }, { role: 'tutor', text: 'ok' }]), [{ role: 'tutor', text: 'ok' }], 'foreign roles and empty turns are dropped');
eq(nextHistory([], 'q', 'a'), [{ role: 'student', text: 'q' }, { role: 'tutor', text: 'a' }], 'the next history appends the exchange');

const request = { context: 'practice', level: 'ask', locale: 'en', questionId: 'q1', questionVersion: '1', question: { prompt: '$2x+3=11$', steps: [{ h: 'Subtract 3', d: '$2x = 8$' }], answer: '4', hints: ['Undo the +3.'] }, studentWork: { lines: [] }, message: 'why?', history: [] };
const fakeStream = events => async (body, { onEvent }) => { for (const [event, data] of events) onEvent({ event, data }); return { requestId: 'r' }; };
{
  const deltas = [];
  setConversationTransportForTests({ tutorStream: fakeStream([['meta', { level: 'ask' }], ['delta', { text: 'Look. ' }], ['delta', { text: 'Think.' }], ['done', { message: 'Look. Think.', source: 'model', guarded: false }]]), tutorHelp: async () => { throw new Error('not used'); } });
  const r = await streamTutorTurn(request, { onDelta: t => deltas.push(t) });
  eq([deltas, r.tutor.message, r.tutor.source, r.streamed], [['Look. ', 'Think.'], 'Look. Think.', 'model', true], 'a streamed turn hands every sentence on and resolves with the final reply');

  setConversationTransportForTests({ tutorStream: fakeStream([['meta', {}], ['delta', { text: 'Fine. ' }], ['fallback', { message: 'Undo the +3.', source: 'fallback', reason: 'TUTOR_ANSWER_GUARD' }]]), tutorHelp: async () => ({}) });
  const f = await streamTutorTurn(request);
  eq([f.tutor.source, f.tutor.reason, f.tutor.message], ['fallback', 'TUTOR_ANSWER_GUARD', 'Undo the +3.'], 'a guarded stream resolves with the authored fallback');

  setConversationTransportForTests({ tutorStream: fakeStream([['meta', {}], ['error', { code: 'TUTOR_UNAVAILABLE', retryable: true }]]), tutorHelp: async () => ({}) });
  eq((await streamTutorTurn(request)).error.code, 'TUTOR_UNAVAILABLE', 'an error event is a code, not a throw');
  setConversationTransportForTests({ tutorStream: fakeStream([['meta', {}], ['delta', { text: 'Half a ' }]]), tutorHelp: async () => ({}) });
  eq((await streamTutorTurn(request)).error.code, 'TUTOR_STREAM_INCOMPLETE', 'a stream that ends without a verdict is not shown as a whole reply');

  let helped = null;
  setConversationTransportForTests({
    tutorStream: async () => { throw Object.assign(new Error('old server'), { code: 'TUTOR_STREAM_UNSUPPORTED', status: 404 }); },
    tutorHelp: async body => { helped = body; return { tutor: { level: 'ask', message: 'Plain reply.', source: 'model', cached: false } }; }
  });
  const h = await streamTutorTurn(request);
  eq([h.tutor.message, h.streamed, helped?.level], ['Plain reply.', false, 'ask'], 'an older server (404) or a native shell falls back to /v1/tutor/help with the same body');
  setConversationTransportForTests({ tutorHelp: async () => ({ tutor: { message: 'No stream here.', source: 'model' } }) });
  eq((await streamTutorTurn(request)).tutor.message, 'No stream here.', 'a transport without streaming goes straight to the request route');
  setConversationTransportForTests({ tutorStream: async () => { throw Object.assign(new Error('x'), { code: 'TUTOR_DAILY_LIMIT', status: 429 }); }, tutorHelp: async () => ({}) });
  eq((await streamTutorTurn(request)).error.code, 'TUTOR_DAILY_LIMIT', 'a refusal is a code and is not retried on the other route');
  setConversationTransportForTests({ tutorStream: async () => { throw new DOMException('t', 'TimeoutError'); }, tutorHelp: async () => ({}) });
  eq((await streamTutorTurn(request)).error.code, 'TUTOR_TIMEOUT', 'a timeout is coded');
  setConversationTransportForTests(null);
  delete globalThis.__PRI_CLOUD_ORIGIN__;
  eq((await streamTutorTurn(request)).error.code, 'TUTOR_OFFLINE', 'with no cloud configured the turn is offline, not an exception');
  globalThis.__PRI_TUTOR_OVERRIDE__ = false;
  eq((await streamTutorTurn(request)).error.code, 'TUTOR_DISABLED', 'with the feature off nothing is sent');
  globalThis.__PRI_TUTOR_OVERRIDE__ = true;
}

// ── 3 · The local route: the backend decides, the panel never sees the answer ─
{
  const rows = {
    'q-practice': { id: 'q-practice', pid: 'p1', tutorLevel: 1, payload: { prompt: 'Solve $2x + 3 = 11$.', steps: [{ h: 'Subtract 3', d: '$2x = 8$' }], answer: { value: 4 }, answerType: 'numeric', hints: ['Undo the +3 first.', 'Then undo the ×2.'] } },
    'q-fresh': { id: 'q-fresh', pid: 'p1', tutorLevel: 0, payload: { prompt: 'p', steps: [], answer: {}, hints: [] } },
    'q-exam': { id: 'q-exam', pid: 'p1', tutorLevel: 1, examId: 'e1', payload: { prompt: 'p', steps: [], answer: {} } },
    'q-other': { id: 'q-other', pid: 'p2', tutorLevel: 1, payload: {} },
    'q-walked': { id: 'q-walked', pid: 'p1', tutorLevel: 3, payload: {} }
  };
  let sent = null;
  let outcome = { tutor: { level: 'ask', message: 'Think about what is attached to $2x$.', source: 'model' }, streamed: true };
  const emitted = [];
  const route = createTutorAskRoute({
    requireProfile: async () => ({ id: 'p1', name: 'Asha', language: 'en' }),
    get: async (store, id) => rows[id] || null,
    assertPracticeRow: row => { if (row.examId) throw Object.assign(new Error('exam'), { status: 403, code: 'EXAM_QUESTION_LOCKED' }); },
    tutorRequest: (p, row, q, solution, { level, locale, work }) => (solution.steps.length ? { context: 'practice', level, locale: locale || 'en', questionId: row.id, questionVersion: '1', question: { prompt: q.prompt, steps: solution.steps, answer: solution.answerText, hints: q.hints || [] }, studentWork: work } : null),
    tutorWork: (q, raw) => ({ lines: raw?.lines || [], typedAnswer: raw?.typed || '', firstBreak: -1, verifiedLines: 0 }),
    displayAnswer: q => String(q.answer?.value ?? ''),
    sanitizeText: (v, max) => String(v ?? '').slice(0, max),
    streamTurn: async (body, { onDelta }) => { sent = body; onDelta('Think about '); onDelta('what is attached to $2x$.'); return outcome; },
    emit: (turnId, text) => emitted.push([turnId, text]),
    enabled: () => true
  });
  const codeOf = async (body, id) => { try { const r = await route(body, { id }); return ['ok', r.source]; } catch (e) { return [e.status, e.code]; } };

  eq(await codeOf({ message: 'why?' }, 'q-exam'), [403, 'EXAM_QUESTION_LOCKED'], 'an exam row is refused before anything is sent');
  eq(await codeOf({ message: 'why?' }, 'q-fresh'), [409, 'TUTOR_LEVEL_ORDER'], 'a conversation waits for level 1, where help is charged');
  eq(await codeOf({ message: 'why?' }, 'q-walked'), [409, 'ALREADY_RESOLVED'], 'and ends when the walkthrough has shown the solution');
  eq((await codeOf({ message: 'why?' }, 'q-other'))[0], 404, 'another profile\'s question is not found');
  eq(await codeOf({ message: '\u0000  ' }, 'q-practice'), [400, 'TUTOR_MESSAGE_INVALID'], 'an empty question is refused');
  eq(sent, null, 'none of those reached the network');

  const r = await route({ message: 'Why\u0000 subtract first?', history: [{ role: 'tutor', text: 'Look at the +3.' }], locale: 'en', work: { lines: ['2x + 3 = 11'] }, turnId: 'turn-1' }, { id: 'q-practice' });
  eq([r.source, r.message, r.streamed, r.code], ['tutor', 'Think about what is attached to $2x$.', true, null], 'a model reply is returned as the tutor\'s');
  eq(emitted, [['turn-1', 'Think about '], ['turn-1', 'what is attached to $2x$.']], 'each released sentence is published to the panel under the caller\'s turn id');
  eq([sent.level, sent.message, sent.history, sent.question.answer, sent.question.steps.length], ['ask', 'Why subtract first?', [{ role: 'tutor', text: 'Look at the +3.' }], '4', 1], 'the server request is grounded here, with the cleaned message and the history');
  ok(!/Asha|"pid"|p1/.test(JSON.stringify(sent)), 'and carries no name or profile id');
  eq(r.history, [{ role: 'tutor', text: 'Look at the +3.' }, { role: 'student', text: 'Why subtract first?' }, { role: 'tutor', text: 'Think about what is attached to $2x$.' }], 'the panel gets the history to send next time');

  outcome = { error: { code: 'TUTOR_OFFLINE' } };
  const off = await route({ message: 'and then?', history: r.history }, { id: 'q-practice' });
  eq([off.source, off.message, off.code], ['deterministic', 'Then undo the ×2.', 'TUTOR_OFFLINE'], 'offline, the authored hint for this turn of the exchange is served with the reason');
  outcome = { tutor: { level: 'ask', message: 'Undo the +3 first.', source: 'fallback', reason: 'TUTOR_ANSWER_GUARD' }, streamed: true };
  const guarded = await route({ message: 'answer?' }, { id: 'q-practice' });
  eq([guarded.source, guarded.code], ['deterministic', 'TUTOR_ANSWER_GUARD'], 'a guarded reply is labelled deterministic with the guard reason');
  eq(authoredTurnHint({ hints: ['a', 'b'] }, [{ role: 'tutor', text: 'x' }, { role: 'tutor', text: 'y' }, { role: 'tutor', text: 'z' }]), 'b', 'the hints walk with the turns and hold on the last');
  eq(authoredTurnHint({ hints: [] }, []), null, 'no hints, no hint');
  ok(TUTOR_DELTA_EVENT.startsWith('pri:'), 'the delta event is namespaced like the other panel events');
  const disabled = createTutorAskRoute({ requireProfile: async () => ({ id: 'p1' }), get: async () => rows['q-practice'], assertPracticeRow: () => {}, tutorRequest: () => null, tutorWork: () => ({}), displayAnswer: () => '', sanitizeText: v => v, streamTurn: async () => ({}), emit: () => {}, enabled: () => false });
  eq(await (async () => { try { await disabled({ message: 'x' }, { id: 'q-practice' }); return 'ok'; } catch (e) { return e.code; } })(), 'TUTOR_DISABLED', 'with the feature off the local route refuses too');
}

// ── 4 · The panel, rendered ──────────────────────────────────────────────────
{
  const { createServer } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const server = await createServer({
    root, configFile: false, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
    plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'true', __PRI_PRODUCTION_BUILD__: 'false' }
  });
  try {
    const i18n = await server.ssrLoadModule('/src/i18n/index.js');
    await i18n.setLanguage('en');
    const { default: TutorHelp } = await server.ssrLoadModule('/src/tutor/TutorHelp.jsx');
    const render = level => renderToStaticMarkup(React.createElement(TutorHelp, { question: { id: 'q1', tutorLevel: level, prompt: 'Solve $2x + 3 = 11$.' }, work: { lines: [], typed: '' }, locale: 'en' }));
    const fresh = render(0);
    ok(/data-tutor-level="1"/.test(fresh) && /data-tutor-level="3"/.test(fresh), 'the three-level ladder is still there');
    const freshBox = /<textarea[^>]*data-tutor-ask-input[^>]*>/.exec(fresh)?.[0] || '';
    ok(/data-tutor-ask/.test(fresh) && /\sdisabled(=""|\s|>)/.test(freshBox), 'before level 1 the question box is shown but disabled');
    ok(fresh.includes(en['tutor.askLocked']), 'and says to open level 1 first');
    const open = render(1);
    const textarea = /<textarea[^>]*data-tutor-ask-input[^>]*>/.exec(open)?.[0] || '';
    ok(textarea && !/disabled/.test(textarea), 'after level 1 the question box is enabled');
    ok(new RegExp(`maxlength="${MAX_TURN_CHARS}"`, 'i').test(textarea), `bounded to ${MAX_TURN_CHARS} characters in the input itself`);
    ok(/<label for="[^"]+" class="sr-only">/.test(open) && /aria-label="Send"/.test(open), 'the input is labelled and the send control named');
    ok(/role="log"[^>]*aria-live="polite"/.test(open) || /aria-live="polite"[^>]*role="log"/.test(open), 'the transcript is a polite live region, so streamed text is announced');
    ok(open.includes(en['tutor.askTitle']) && open.includes(en['tutor.askHint'].replace('{n}', String(MAX_TURN_CHARS))), 'the section is titled and explains that the tutor never gives the answer');
    ok(!/Pri is thinking/.test(open), 'the thinking state is not shown before a question is sent');
    const walked = render(3);
    ok(!/data-tutor-ask/.test(walked), 'once the walkthrough has shown the solution there is nothing left to ask');
    await i18n.setLanguage('hi');
    const hindi = render(1);
    ok(hindi.includes(hi['tutor.askTitle']) && hindi.includes(hi['tutor.send']), 'the conversation renders in Hindi for a Hindi reader');
    await i18n.setLanguage('en');
  } finally {
    await server.close();
  }
}

// ── 5 · Source contracts: touch targets, catalogues, no raw answer in the panel ─
{
  const css = read('src/tutor/TutorHelp.css');
  ok(/\.tutor-ask-input\s*\{[^}]*min-height:\s*44px/.test(css) && /\.tutor-ask-send\s*\{[^}]*min-height:\s*44px[^}]*min-width:\s*44px/.test(css), 'the input and send control are 44px touch targets');
  const jsx = read('src/tutor/TutorHelp.jsx');
  ok(/role="status"/.test(jsx) && /t\('tutor\.thinking'\)/.test(jsx), 'the "Pri is thinking" state is a status for assistive technology');
  ok(/\/practice\/\$\{question\.id\}\/tutor\/ask/.test(jsx) && !/question\.steps|question\.answer/.test(jsx), 'the panel asks through the local backend and never handles the solution itself');
  for (const key of ['tutor.askTitle', 'tutor.transcript', 'tutor.you', 'tutor.thinking', 'tutor.askLabel', 'tutor.askPlaceholder', 'tutor.askLocked', 'tutor.send', 'tutor.askHint', 'tutor.askUnavailable', 'tutor.fallbackGuarded']) {
    ok(typeof en[key] === 'string' && typeof hi[key] === 'string' && en[key] !== hi[key], `${key} is in both catalogues`);
  }
  const transport = read('src/platform/cloudTransport.js');
  ok(/tutorStream: \(body, \{ onEvent, signal = null, timeoutMs = 45000 \} = \{\}\) =>\s*cloudStreamRequest\('\/v1\/tutor\/stream'/.test(transport), 'the stream goes through the audited transport boundary');
}

console.log(failures.length
  ? `TUTOR UI: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `TUTOR UI: PASS — ${pass}/${pass} checks — streamed through the audited transport, falls back to the request route, grounded by the local backend, 44px targets and a live transcript.`);
process.exit(failures.length ? 1 : 0);
