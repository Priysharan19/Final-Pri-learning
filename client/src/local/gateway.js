// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Production local API gateway
//
// Every UI request passes through this module before it reaches backend.js.
// The backend remains intentionally offline-first; this gateway gives that
// in-process API the same boundary a network service would have: path hygiene,
// request-shape checks, bounded payloads, prototype-pollution rejection,
// structured errors, and payload-free operational diagnostics.
//
// Important: validation is deliberately structural rather than duplicating the
// domain rules in backend.js. The backend remains the authority for questions
// such as whether a subtopic exists or a password is correct. This layer rejects
// malformed/unbounded input before any storage or maths code has to touch it.
// ─────────────────────────────────────────────────────────────────────────────

const METHODS = new Set(['GET', 'POST', 'PATCH']);
const PATH_MAX = 240;
const BODY_DEFAULT_MAX = 8 * 1024 * 1024;
const BODY_IMPORT_MAX = 32 * 1024 * 1024;
const MAX_DEPTH = 18;
const MAX_NODES = 50000;
const MAX_KEYS = 5000;
const MAX_ARRAY = 10000;
const MAX_STRING = 4 * 1024 * 1024;
const MAX_DIAGNOSTICS = 120;
const ID = /^[A-Za-z0-9._-]{1,100}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const RESERVED = new Set(['__proto__', 'prototype', 'constructor']);

const diagnostics = [];
let fallbackSeq = 0;

function requestId() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through */ }
  fallbackSeq = (fallbackSeq + 1) % 1000000;
  return `local-${Date.now().toString(36)}-${fallbackSeq.toString(36)}`;
}

function apiError(message, status = 400, code = 'BAD_REQUEST', detail = undefined) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (detail !== undefined) err.detail = detail;
  return err;
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function requireObject(body, route) {
  if (!plainObject(body)) throw apiError(`${route} expects an object body.`, 400, 'INVALID_BODY');
}

function optionalString(body, key, max = 1000) {
  if (body[key] === undefined || body[key] === null) return;
  if (typeof body[key] !== 'string') throw apiError(`${key} must be text.`, 400, 'INVALID_FIELD');
  if (body[key].length > max) throw apiError(`${key} is too long.`, 413, 'FIELD_TOO_LARGE');
}

function optionalNumber(body, key) {
  if (body[key] === undefined || body[key] === null) return;
  if (typeof body[key] !== 'number' && typeof body[key] !== 'string') {
    throw apiError(`${key} must be a number.`, 400, 'INVALID_FIELD');
  }
  if (!Number.isFinite(Number(body[key]))) throw apiError(`${key} must be finite.`, 400, 'INVALID_FIELD');
}

function optionalBoolean(body, key) {
  if (body[key] === undefined || body[key] === null) return;
  if (typeof body[key] !== 'boolean') throw apiError(`${key} must be true or false.`, 400, 'INVALID_FIELD');
}

function optionalId(body, key) {
  if (body[key] === undefined || body[key] === null || body[key] === '') return;
  if (typeof body[key] !== 'string' || !ID.test(body[key])) throw apiError(`${key} is not a valid id.`, 400, 'INVALID_ID');
}

function optionalIdArray(body, key, max = 200) {
  if (body[key] === undefined || body[key] === null) return;
  if (!Array.isArray(body[key]) || body[key].length > max) throw apiError(`${key} must be an array of at most ${max} ids.`, 400, 'INVALID_FIELD');
  for (const value of body[key]) {
    if (typeof value !== 'string' || !ID.test(value)) throw apiError(`${key} contains an invalid id.`, 400, 'INVALID_ID');
  }
}

function requiredId(body, key = 'id') {
  optionalId(body, key);
  if (!body[key]) throw apiError(`${key} is required.`, 400, 'MISSING_FIELD');
}

function boundedMap(body, key, max = 200) {
  if (body[key] === undefined || body[key] === null) return;
  if (!plainObject(body[key])) throw apiError(`${key} must be an object.`, 400, 'INVALID_FIELD');
  if (Object.keys(body[key]).length > max) throw apiError(`${key} has too many entries.`, 413, 'FIELD_TOO_LARGE');
}

// Only routes where the body is security- or storage-significant need an
// explicit contract here. Routes not listed still receive the universal deep
// validation below, and backend.js remains responsible for their domain rules.
const BODY_RULES = [
  [/^POST \/profiles$/, body => {
    requireObject(body, 'POST /profiles');
    optionalString(body, 'name', 80); optionalNumber(body, 'year');
    optionalString(body, 'course', 30); optionalString(body, 'role', 30);
    optionalString(body, 'avatar', 32); optionalString(body, 'email', 180);
    optionalString(body, 'provider', 30); optionalString(body, 'password', 1024);
    optionalString(body, 'pathway', 30); optionalString(body, 'indiaTrack', 30);
  }],
  [/^POST \/profiles\/select$/, body => {
    requireObject(body, 'POST /profiles/select'); requiredId(body); optionalString(body, 'password', 1024);
  }],
  [/^POST \/profiles\/delete$/, body => {
    requireObject(body, 'POST /profiles/delete'); requiredId(body); optionalString(body, 'password', 1024); optionalBoolean(body, 'confirm');
  }],
  [/^POST \/profiles\/password$/, body => {
    requireObject(body, 'POST /profiles/password'); optionalString(body, 'current', 1024); optionalString(body, 'next', 1024); optionalBoolean(body, 'confirm');
  }],
  [/^PATCH \/me$/, body => {
    requireObject(body, 'PATCH /me'); optionalString(body, 'name', 80); optionalNumber(body, 'year');
    optionalString(body, 'pathway', 30); optionalString(body, 'theme', 20); optionalNumber(body, 'dailyGoal');
    optionalString(body, 'course', 30); optionalString(body, 'indiaTrack', 30); optionalString(body, 'avatar', 32); optionalBoolean(body, 'handwriting'); optionalString(body, 'email', 180);
  }],
  [/^POST \/practice\/next$/, body => {
    requireObject(body, 'POST /practice/next'); optionalString(body, 'mode', 30); optionalId(body, 'subtopic'); optionalString(body, 'track', 30);
    optionalNumber(body, 'difficulty');
    if (typeof body.dotpoint === 'number') optionalNumber(body, 'dotpoint'); else optionalId(body, 'dotpoint');
    optionalId(body, 'taskId');
  }],
  [/^POST \/practice\/[A-Za-z0-9._-]+\/(?:hint|reveal)$/, body => {
    requireObject(body, 'practice action'); optionalNumber(body, 'ms');
  }],
  [/^POST \/practice\/[A-Za-z0-9._-]+\/submit$/, body => {
    requireObject(body, 'practice submit'); optionalNumber(body, 'ms'); optionalBoolean(body, 'viaInk');
    if (body.steps !== undefined && typeof body.steps !== 'string' && !Array.isArray(body.steps)) throw apiError('steps must be text or an array.', 400, 'INVALID_FIELD');
    if (body.ink !== undefined && body.ink !== null && !plainObject(body.ink)) throw apiError('ink must be an object.', 400, 'INVALID_FIELD');
  }],
  [/^POST \/exams$/, body => {
    requireObject(body, 'POST /exams'); optionalNumber(body, 'length'); optionalNumber(body, 'minutes'); optionalNumber(body, 'year');
  }],
  [/^POST \/exams\/[A-Za-z0-9._-]+\/submit$/, body => {
    requireObject(body, 'exam submit'); boundedMap(body, 'answers', 120); boundedMap(body, 'workings', 120); optionalNumber(body, 'ms');
  }],
  [/^POST \/rush\/answer$/, body => {
    requireObject(body, 'POST /rush/answer'); requiredId(body);
  }],
  [/^POST \/rush\/finish$/, body => {
    requireObject(body, 'POST /rush/finish'); optionalNumber(body, 'correct'); optionalNumber(body, 'total'); optionalNumber(body, 'bestCombo');
  }],
  [/^POST \/match\/start$/, body => {
    requireObject(body, 'POST /match/start'); optionalString(body, 'rival', 40); optionalString(body, 'strand', 80);
  }],
  [/^POST \/match\/finish$/, body => {
    requireObject(body, 'POST /match/finish'); optionalBoolean(body, 'won'); optionalNumber(body, 'playerScore'); optionalNumber(body, 'rivalScore'); optionalString(body, 'rival', 80); optionalNumber(body, 'ms');
  }],
  [/^POST \/classes$/, body => {
    requireObject(body, 'POST /classes'); optionalString(body, 'name', 120);
  }],
  [/^POST \/classes\/[A-Za-z0-9._-]+\/students$/, body => {
    requireObject(body, 'class roll'); optionalIdArray(body, 'add', 200); optionalIdArray(body, 'remove', 200);
  }],
  [/^POST \/tasks$/, body => {
    requireObject(body, 'POST /tasks'); optionalId(body, 'classId'); optionalString(body, 'title', 160);
    optionalIdArray(body, 'subtopics', 100); optionalIdArray(body, 'customIds', 100); optionalNumber(body, 'count'); optionalNumber(body, 'dueAt');
  }],
  [/^POST \/history\/list$/, body => {
    requireObject(body, 'POST /history/list'); optionalString(body, 'filter', 30); optionalNumber(body, 'page'); optionalNumber(body, 'pageSize');
  }],
  [/^POST \/history\/[A-Za-z0-9._-]+\/retry$/, body => {
    requireObject(body, 'history retry'); optionalString(body, 'variant', 20);
  }],
  [/^POST \/data\/import$/, body => {
    requireObject(body, 'POST /data/import'); optionalString(body, 'format', 80);
    if (body.profile !== undefined && !plainObject(body.profile)) throw apiError('profile must be an object.', 400, 'INVALID_FIELD');
    if (body.stores !== undefined && !plainObject(body.stores)) throw apiError('stores must be an object.', 400, 'INVALID_FIELD');
  }],
  [/^POST \/tasks\/import-pack$/, body => {
    requireObject(body, 'POST /tasks/import-pack'); optionalString(body, 'format', 80);
    if (body.task !== undefined && !plainObject(body.task)) throw apiError('task must be an object.', 400, 'INVALID_FIELD');
    if (body.customQs !== undefined && !Array.isArray(body.customQs)) throw apiError('customQs must be an array.', 400, 'INVALID_FIELD');
  }],
  [/^POST \/classes\/[A-Za-z0-9._-]+\/import-progress$/, body => {
    requireObject(body, 'progress import'); optionalString(body, 'format', 80);
    if (body.student !== undefined && !plainObject(body.student)) throw apiError('student must be an object.', 400, 'INVALID_FIELD');
  }],
  [/^POST \/custom-questions$/, body => {
    requireObject(body, 'POST /custom-questions'); optionalString(body, 'name', 120); optionalString(body, 'prompt', 8000);
    optionalString(body, 'answerType', 40); optionalNumber(body, 'difficulty'); optionalString(body, 'solutionText', 8000); optionalString(body, 'hint', 1200);
    if (body.answer !== undefined && !plainObject(body.answer)) throw apiError('answer must be an object.', 400, 'INVALID_FIELD');
  }]
];

function validatePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw apiError('API path must start with /.', 400, 'INVALID_PATH');
  if (!path.length || path.length > PATH_MAX) throw apiError('API path is too long.', 414, 'INVALID_PATH');
  if (CONTROL.test(path) || path.includes('\\') || path.includes('?') || path.includes('#')) throw apiError('API path contains unsupported characters.', 400, 'INVALID_PATH');
  let decoded;
  try { decoded = decodeURIComponent(path); } catch { throw apiError('API path has invalid encoding.', 400, 'INVALID_PATH'); }
  if (CONTROL.test(decoded) || decoded.includes('\\') || decoded.split('/').some(x => x === '.' || x === '..')) {
    throw apiError('API path is not canonical.', 400, 'INVALID_PATH');
  }
  if (path.length > 1 && path.endsWith('/')) throw apiError('API path must not end with /.', 400, 'INVALID_PATH');
  return path;
}

function inspect(value, stats, depth = 0, seen = new Set()) {
  if (depth > MAX_DEPTH) throw apiError('Request is nested too deeply.', 413, 'BODY_TOO_COMPLEX');
  stats.nodes++;
  if (stats.nodes > MAX_NODES) throw apiError('Request contains too many values.', 413, 'BODY_TOO_COMPLEX');

  if (value === null || value === undefined) return;
  const kind = typeof value;
  if (kind === 'string') {
    if (value.length > MAX_STRING) throw apiError('A request string is too large.', 413, 'FIELD_TOO_LARGE');
    return;
  }
  if (kind === 'number') {
    if (!Number.isFinite(value)) throw apiError('Request numbers must be finite.', 400, 'INVALID_NUMBER');
    return;
  }
  if (kind === 'boolean') return;
  if (kind !== 'object') throw apiError('Request contains an unsupported value type.', 400, 'INVALID_BODY');
  if (seen.has(value)) throw apiError('Request contains a circular value.', 400, 'INVALID_BODY');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY) throw apiError('Request array is too large.', 413, 'FIELD_TOO_LARGE');
      for (const item of value) inspect(item, stats, depth + 1, seen);
      return;
    }
    if (!plainObject(value)) throw apiError('Request objects must be plain objects.', 400, 'INVALID_BODY');
    const keys = Object.keys(value);
    stats.keys += keys.length;
    if (stats.keys > MAX_KEYS) throw apiError('Request contains too many object keys.', 413, 'BODY_TOO_COMPLEX');
    for (const key of keys) {
      if (RESERVED.has(key)) throw apiError('Request contains a reserved object key.', 400, 'UNSAFE_KEY');
      if (CONTROL.test(key)) throw apiError('Request contains an invalid object key.', 400, 'UNSAFE_KEY');
      inspect(value[key], stats, depth + 1, seen);
    }
  } finally {
    seen.delete(value);
  }
}

function encodedBytes(value) {
  let json;
  try { json = JSON.stringify(value); }
  catch { throw apiError('Request cannot be encoded as JSON.', 400, 'INVALID_BODY'); }
  if (json === undefined) return 0;
  try { return new TextEncoder().encode(json).byteLength; }
  catch { return json.length * 2; }
}

export function validateRequest(method, path, body) {
  const verb = String(method || '').toUpperCase();
  if (!METHODS.has(verb)) throw apiError('Unsupported API method.', 405, 'METHOD_NOT_ALLOWED');
  const cleanPath = validatePath(path);
  if (verb === 'GET' && body !== undefined && body !== null) throw apiError('GET requests cannot carry a body.', 400, 'GET_BODY');
  if (body !== undefined && body !== null) {
    inspect(body, { nodes: 0, keys: 0 });
    const limit = cleanPath === '/data/import' ? BODY_IMPORT_MAX : BODY_DEFAULT_MAX;
    if (encodedBytes(body) > limit) throw apiError('Request body is too large.', 413, 'BODY_TOO_LARGE');
  }
  const key = `${verb} ${cleanPath}`;
  const contract = BODY_RULES.find(([pattern]) => pattern.test(key));
  if (contract) contract[1](body ?? {});
  return { method: verb, path: cleanPath, body };
}

export function beginRequest(method, path) {
  return { id: requestId(), method: String(method || '').toUpperCase(), path: String(path || ''), startedAt: Date.now() };
}

export function finishRequest(request, status, code = null) {
  const row = {
    id: request.id,
    method: request.method,
    path: request.path,
    status: Number(status) || 500,
    code: code || null,
    durationMs: Math.max(0, Date.now() - request.startedAt),
    at: Date.now()
  };
  diagnostics.push(row);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
  return row;
}

export function normalizeApiError(error, reqId = null) {
  const source = error instanceof Error ? error : new Error('Unexpected API failure');
  const status = Number(source.status);
  source.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  if (!source.code) source.code = source.status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  if (reqId && !source.requestId) source.requestId = reqId;
  return source;
}

// Read-only diagnostics for support/debug tooling. Request bodies, answers,
// emails, names and passwords are never recorded here.
export function apiDiagnostics() {
  return diagnostics.map(row => ({ ...row }));
}

export function clearApiDiagnostics() {
  diagnostics.length = 0;
}
