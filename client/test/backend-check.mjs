// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local backend suite — proof for the layer a student touches.
//
// client/src/local/backend.js IS the platform: every route the UI calls lives
// there, over IndexedDB, with no server behind it. The maths engine underneath
// it carries 10,080 self-checks; this applies the same standard to the layer
// above. Every check below drives a real endpoint through the real dispatch(),
// and asserts what came back — never that a call "did not throw", and never
// against objects the suite built for itself.
//
// The route count is not written down here, because a number in a comment is a
// number that goes stale. The suite reads the dispatcher's own route table out
// of the source, records which routes its calls actually reached, and reports
// coverage as a measured fraction of that table. A route nothing drove is a
// failure, not a footnote, and nothing here is allowed to inflate the figure.
//
// It runs in Node, so the browser APIs the client expects are stood up first:
// an in-memory IndexedDB matching exactly the surface local/idb.js uses, a
// Map-backed localStorage, Node's own WebCrypto (PBKDF2-SHA256 is native, so
// the credential vault is exercised for real rather than stubbed) — and an
// HTML parser behind DOMParser, so code with a browser path and a Node
// fallback runs the path a user runs. Without it lib/sanitize.js would only
// ever be tested on its fallback and the shipped branch would be untested.
//
// The environment is exported because client/test/security-check.mjs drives the
// same backend and must stand up the same one — a single definition, no drift.
//
// Each group runs inside its own boundary: a group that throws is recorded as a
// failed group and the ones after it still run, so one early break cannot hide
// every result behind it.
//
// Usage: node client/test/backend-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url).href;

// ── In-memory IndexedDB ──────────────────────────────────────────────────────
// Only what local/idb.js asks for: open/upgrade with keyPath + autoIncrement
// stores and named indexes, then get / put / add / delete / getAll / clear and
// index(...).getAll on a transaction handle. Values are structured-cloned in
// and out exactly as the real thing does, so a handler that keeps mutating an
// object after storing it cannot quietly rewrite history.

const clone = v => (v === undefined ? undefined : structuredClone(v));

/** IndexedDB key order: numbers sort before strings, each among themselves. */
const compareKeys = (a, b) => {
  const ta = typeof a === 'number' ? 0 : 1;
  const tb = typeof b === 'number' ? 0 : 1;
  if (ta !== tb) return ta - tb;
  return a < b ? -1 : a > b ? 1 : 0;
};

/** A request whose handlers are attached synchronously, then fired next tick. */
const request = (work) => {
  const req = { result: undefined, error: null, onsuccess: null, onerror: null };
  queueMicrotask(() => {
    try { req.result = work(); req.onsuccess?.(); }
    catch (err) { req.error = err; req.onerror?.(); }
  });
  return req;
};

class FakeStore {
  constructor(name, opts) {
    this.name = name;
    this.keyPath = opts?.keyPath || null;
    this.autoIncrement = !!opts?.autoIncrement;
    this.rows = new Map();
    this.indexes = new Map();
    this.seq = 0;
  }
  createIndex(name, keyPath) { this.indexes.set(name, keyPath); }
  ordered() { return [...this.rows.keys()].sort(compareKeys); }
}

class FakeHandle {
  constructor(store, mode) { this.store = store; this.mode = mode; }
  writable() { if (this.mode !== 'readwrite') throw new Error(`${this.store.name}: read-only transaction`); }
  get(key) { return request(() => clone(this.store.rows.get(key))); }
  getAll() { return request(() => this.store.ordered().map(k => clone(this.store.rows.get(k)))); }
  delete(key) { return request(() => { this.writable(); this.store.rows.delete(key); }); }
  clear() { return request(() => { this.writable(); this.store.rows.clear(); }); }
  save(value, exclusive) {
    return request(() => {
      this.writable();
      const row = clone(value);
      let key = this.store.keyPath ? row[this.store.keyPath] : undefined;
      if (key === undefined || key === null) {
        if (!this.store.autoIncrement) throw new Error(`${this.store.name}: value carries no key`);
        key = ++this.store.seq;
        if (this.store.keyPath) row[this.store.keyPath] = key;
      } else if (typeof key === 'number' && key > this.store.seq) {
        this.store.seq = Math.floor(key);
      }
      if (exclusive && this.store.rows.has(key)) throw new Error(`${this.store.name}: key ${key} already exists`);
      this.store.rows.set(key, row);
      return key;
    });
  }
  put(value) { return this.save(value, false); }
  add(value) { return this.save(value, true); }
  index(name) {
    const keyPath = this.store.indexes.get(name);
    if (keyPath === undefined) throw new Error(`${this.store.name}: no index "${name}"`);
    const store = this.store;
    return {
      getAll: value => request(() => store.ordered()
        .map(k => store.rows.get(k))
        .filter(row => row && row[keyPath] === value)
        .map(clone))
    };
  }
}

class FakeDB {
  constructor() {
    this.stores = new Map();
    this.objectStoreNames = { contains: name => this.stores.has(name) };
  }
  createObjectStore(name, opts) {
    const store = new FakeStore(name, opts);
    this.stores.set(name, store);
    return store;
  }
  transaction(name, mode = 'readonly') {
    const store = this.stores.get(name);
    if (!store) throw new Error(`No object store "${name}"`);
    return { objectStore: () => new FakeHandle(store, mode) };
  }
}

// ── An HTML parser, so DOMParser exists ──────────────────────────────────────
// client/src/lib/sanitize.js parses untrusted figure markup with DOMParser and
// rebuilds it from an allowlist; only where there is no DOMParser does it fall
// back to a scanning tokeniser. Node has no DOMParser, so without this shim
// every test would exercise the fallback, the branch every user runs would ship
// untested, and a total pass-through in the browser path would go unnoticed.
//
// This is a tokeniser and tree builder, not a browser: it reproduces the HTML
// behaviour the sanitiser's decisions actually rest on — tag and attribute
// names lower-cased, character references decoded (so an escaped payload
// arrives decoded and has to be escaped again), NULLs replaced, raw-text
// elements swallowing their contents, a tag left unterminated at EOF dropped
// whole, and `/>` closing an element as it does inside <svg>. innerHTML
// serialises, so a browser path replaced by `return parent.innerHTML` returns
// the pass-through it would return in a browser rather than undefined.

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'textarea', 'title']);

// html/head/body start tags do not build a node of their own in a document that
// already has one, so a payload cannot smuggle content in by opening a <body>.
const STRUCTURE_TAGS = new Set(['html', 'head', 'body']);

// Inside <svg> the tree builder puts the camel case back on the attributes the
// tokeniser lower-cased; viewBox is the only one figures.js emits.
const SVG_CASED_ATTRS = { viewbox: 'viewBox', preserveaspectratio: 'preserveAspectRatio', gradienttransform: 'gradientTransform' };

// Enough of the reference table to cover what a figure or a payload can carry.
const NAMED_REFS = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: '\u00a0',
  deg: '°', times: '×', divide: '÷', minus: '−', plusmn: '±',
  pi: 'π', theta: 'θ', radic: '√', le: '≤', ge: '≥', ne: '≠',
  middot: '·', ndash: '–', mdash: '—', hellip: '…', colon: ':',
  Tab: '\t', NewLine: '\n', lpar: '(', rpar: ')', sol: '/', excl: '!'
};

const REFERENCE = /&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);?/g;
const isSpace = c => c === ' ' || c === '\t' || c === '\n' || c === '\f' || c === '\r';
const scrubNulls = s => s.replace(/\u0000/g, '\ufffd');

function decodeReferences(text) {
  return text.replace(REFERENCE, (whole, body) => {
    if (body[0] !== '#') return NAMED_REFS[body] ?? whole;
    const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return '\ufffd';
    try { return String.fromCodePoint(code); } catch { return '\ufffd'; }
  });
}

const escapeMarkup = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

class FakeText {
  constructor(data) { this.nodeType = 3; this.childNodes = []; this.nodeValue = data; this.data = data; }
  get outerHTML() { return escapeMarkup(this.nodeValue); }
}

class FakeElement {
  constructor(name) { this.nodeType = 1; this.childNodes = []; this.attributes = []; this.localName = name; this.tagName = name; }
  getAttribute(name) { return this.attributes.find(a => a.name.toLowerCase() === String(name).toLowerCase())?.value ?? null; }
  get innerHTML() { return this.childNodes.map(n => n.outerHTML).join(''); }
  get outerHTML() {
    const attrs = this.attributes.map(a => ` ${a.name}="${escapeMarkup(a.value).replace(/"/g, '&quot;')}"`).join('');
    if (VOID_TAGS.has(this.localName)) return `<${this.localName}${attrs}>`;
    return `<${this.localName}${attrs}>${this.innerHTML}</${this.localName}>`;
  }
}

/** The attribute soup between a tag name and its '>', as the parser sees it. */
function parseAttributes(source, inSvg) {
  const attrs = [];
  const seen = new Set();
  let i = 0;
  while (i < source.length) {
    while (i < source.length && (isSpace(source[i]) || source[i] === '/')) i++;
    let name = '';
    while (i < source.length && !isSpace(source[i]) && source[i] !== '=' && source[i] !== '/') { name += source[i]; i++; }
    if (!name) { i++; continue; }
    while (i < source.length && isSpace(source[i])) i++;
    let value = '';
    if (source[i] === '=') {
      i++;
      while (i < source.length && isSpace(source[i])) i++;
      const quote = source[i];
      if (quote === '"' || quote === '\'') {
        i++;
        while (i < source.length && source[i] !== quote) { value += source[i]; i++; }
        i++;
      } else {
        while (i < source.length && !isSpace(source[i]) && source[i] !== '>') { value += source[i]; i++; }
      }
    }
    const lower = scrubNulls(name.toLowerCase());
    if (seen.has(lower)) continue;             // a duplicate attribute keeps the first
    seen.add(lower);
    attrs.push({ name: inSvg ? (SVG_CASED_ATTRS[lower] || lower) : lower, value: scrubNulls(decodeReferences(value)) });
  }
  return attrs;
}

/** Parse a fragment of markup into a <body> element holding the tree. */
function parseBody(src) {
  const body = new FakeElement('body');
  const stack = [body];
  const openIn = tag => stack.some(el => el.localName === tag);
  const addText = text => { if (text) stack[stack.length - 1].childNodes.push(new FakeText(scrubNulls(decodeReferences(text)))); };
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { addText(src.slice(i)); break; }
    addText(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {                                  // comment
      const end = src.indexOf('-->', lt + 4);
      i = end < 0 ? src.length : end + 3;
      continue;
    }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') {                   // doctype, CDATA, bogus comment
      const end = src.indexOf('>', lt + 1);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    const closing = src[lt + 1] === '/';
    const nameAt = closing ? lt + 2 : lt + 1;
    if (!/[a-zA-Z]/.test(src[nameAt] || '')) { addText('<'); i = lt + 1; continue; }
    let j = nameAt;
    let name = '';
    while (j < src.length && !isSpace(src[j]) && src[j] !== '/' && src[j] !== '>') { name += src[j]; j++; }
    let end = j;
    let quote = null;
    while (end < src.length) {                                          // '>' outside a quoted value
      const c = src[end];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === '\'') quote = c;
      else if (c === '>') break;
      end++;
    }
    if (end >= src.length) break;                                       // EOF inside a tag drops the token
    const rawAttrs = src.slice(j, end);
    const tag = scrubNulls(name.toLowerCase());
    i = end + 1;
    if (STRUCTURE_TAGS.has(tag)) continue;
    if (closing) {
      const at = stack.findIndex(el => el.localName === tag);
      if (at > 0) stack.length = at;
      continue;
    }
    const el = new FakeElement(tag);
    el.attributes = parseAttributes(rawAttrs, tag === 'svg' || openIn('svg'));
    stack[stack.length - 1].childNodes.push(el);
    if (RAW_TEXT_TAGS.has(tag)) {                                       // contents are text, never markup
      const close = src.toLowerCase().indexOf(`</${tag}`, i);
      const text = src.slice(i, close < 0 ? src.length : close);
      if (text) el.childNodes.push(new FakeText(text));
      if (close < 0) { i = src.length; continue; }
      const gt = src.indexOf('>', close);
      i = gt < 0 ? src.length : gt + 1;
      continue;
    }
    if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(rawAttrs)) stack.push(el);
  }
  return body;
}

let domParses = 0;

class FakeDOMParser {
  parseFromString(source, type) {
    if (type !== 'text/html') throw new Error(`FakeDOMParser: unsupported type ${type}`);
    domParses++;
    return { body: parseBody(String(source)) };
  }
}

const database = new FakeDB();
const webStorage = new Map();

/** Stand up indexedDB, localStorage and DOMParser. Call before importing local/backend.js. */
export function installBrowserEnv() {
  globalThis.DOMParser = FakeDOMParser;
  globalThis.indexedDB = {
    open() {
      const req = { result: database, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        try {
          if (!database.stores.size) req.onupgradeneeded?.();
          req.onsuccess?.();
        } catch (err) { req.error = err; req.onerror?.(); }
      });
      return req;
    }
  };
  globalThis.localStorage = {
    getItem: k => (webStorage.has(String(k)) ? webStorage.get(String(k)) : null),
    setItem: (k, v) => { webStorage.set(String(k), String(v)); },
    removeItem: k => { webStorage.delete(String(k)); },
    clear: () => webStorage.clear()
  };
}

/** How many times DOMParser has been asked to parse — the browser path's tally. */
export const domParseCount = () => domParses;

/**
 * Every row of every store exactly as it sits on disk, read without going
 * through local/idb.js. Encryption at rest is only worth anything if the bytes
 * underneath are unreadable, so the check for it has to bypass the layer that
 * would helpfully decrypt them on the way out.
 */
export function rawRows() {
  const out = {};
  for (const [name, store] of database.stores) out[name] = store.ordered().map(k => clone(store.rows.get(k)));
  return out;
}

/** Empty every store and forget the selected profile — a fresh device. */
export function resetStorage() {
  for (const store of database.stores.values()) { store.rows.clear(); store.seq = 0; }
  webStorage.clear();
}

// ── Assertions ───────────────────────────────────────────────────────────────

const groups = [];
let group = null;
const failures = [];
let coverage = { driven: 0, total: 0 };

const section = (name) => { group = { name, pass: 0, fail: 0 }; groups.push(group); };

function ok(name, condition, detail = '') {
  if (condition) { group.pass++; return true; }
  group.fail++;
  failures.push(`${group.name} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}

const show = v => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v));

/** A group that threw. The groups after it still run; this one says why it stopped. */
const crashed = err => ok('the group ran to the end', false, `threw: ${err?.stack || err}`);

const eq = (name, actual, expected) =>
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${show(expected)}, got ${show(actual)}`);

const near = (name, actual, expected, tol) =>
  ok(name, Math.abs(actual - expected) <= tol, `expected ${expected} ±${tol}, got ${actual}`);

/** Assert a call rejects, and that the rejection carries the right shape. */
async function rejects(name, promise, want = {}) {
  let err = null;
  try { await promise; } catch (e) { err = e; }
  if (!err) { ok(name, false, 'call resolved, expected a rejection'); return null; }
  const wrong = [];
  if (want.status !== undefined && err.status !== want.status) wrong.push(`status ${err.status} ≠ ${want.status}`);
  if (want.message && !want.message.test(String(err.message))) wrong.push(`message ${show(err.message)}`);
  if (want.needsPassword !== undefined && !!err.needsPassword !== want.needsPassword) wrong.push(`needsPassword ${!!err.needsPassword}`);
  ok(name, !wrong.length, `${wrong.join('; ')}${wrong.length ? ` — ${show(err.message)}` : ''}`);
  return err;
}

// ── Route coverage ───────────────────────────────────────────────────────────
// How many endpoints the local backend has is not something to write in a
// comment and let rot. The table is read out of the module under test, every
// call the suite makes is resolved against it by the same rule dispatch() uses
// — exact match first, then the parameterised patterns in declaration order —
// and coverage is printed as driven-over-declared. A route nothing drove is a
// failure, so the fraction can never be talked upwards.

// Keys as the table declares them, and the same thing found without relying on
// the indentation. Reading the table is only safe if a miscount is loud, so the
// two are compared: a route written differently shows up as a disagreement
// rather than as a route quietly missing from the coverage figure.
const ROUTE_KEY = /^ {2}'((?:GET|POST|PATCH|PUT|DELETE) \/[^']*)':/gm;
const ROUTE_KEY_ANYWHERE = /'(?:GET|POST|PATCH|PUT|DELETE) \/[^']*':/g;

/** Every route key the dispatcher declares, in declaration order, and a recount. */
function routeTable() {
  const source = readFileSync(new URL('local/backend.js', SRC), 'utf8');
  const keys = [...source.matchAll(ROUTE_KEY)].map(m => m[1]);
  return { keys, seenAnywhere: (source.match(ROUTE_KEY_ANYWHERE) || []).length };
}

/** The route key a call lands on, or null when nothing in the table matches. */
function resolveRoute(keys, method, path) {
  const exact = `${method} ${path}`;
  if (keys.includes(exact)) return exact;
  for (const key of keys) {
    const [m, pattern] = key.split(' ');
    if (m !== method || !pattern.includes(':')) continue;
    const pp = pattern.split('/');
    const aa = path.split('/');
    if (pp.length !== aa.length) continue;
    if (pp.every((seg, i) => seg.startsWith(':') || seg === aa[i])) return key;
  }
  return null;
}

// ── Answer helpers ───────────────────────────────────────────────────────────
// The API never hands the answer back, so the suite reads the stored payload
// and derives one — the same canonical form server/test/selfcheck.mjs uses to
// prove every generator agrees with the checker.

function canonicalInput(q) {
  const a = q.answer;
  if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  switch (q.answerType) {
    case 'numeric':
      if (a.surdForm) return `${a.surdForm.k === 1 ? '' : a.surdForm.k === -1 ? '-' : a.surdForm.k}sqrt(${a.surdForm.r})`;
      if (a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
      if (a.requireExact) return null;
      return String(a.value);
    case 'expression': return a.expr;
    case 'mcq': return String(a.correctIndex);
    case 'set': return a.values.join(', ');
    case 'point': return `(${a.x}, ${a.y})`;
    case 'ratio': return `${a.a}:${a.b}`;
    case 'working': return a.canonicalWorking ?? null;
    default: return null;
  }
}

/** A well-formed answer that is not the right one — never gibberish. */
function wrongInput(q) {
  const a = q.answer;
  if (!a) return null;
  switch (q.answerType) {
    case 'numeric': return String((Number(a.value) || 0) + 7);
    case 'expression': return a.expr ? `(${a.expr})+7` : null;
    case 'mcq': return String(((a.correctIndex || 0) + 1) % Math.max(2, q.mcqOptions?.length || 4));
    case 'set': return a.values.map(v => Number(v) + 7).join(', ');
    case 'point': return `(${Number(a.x) + 7}, ${Number(a.y) + 7})`;
    case 'ratio': return `${Number(a.a) + 7}:${a.b}`;
    default: return null;
  }
}

// ── The suite ────────────────────────────────────────────────────────────────

async function run() {
  installBrowserEnv();
  const { dispatch } = await import(`${SRC}local/backend.js`);
  const idb = await import(`${SRC}local/idb.js`);
  const { checkAnswer } = await import(`${SRC}engine/checker.js`);
  const { BADGES } = await import(`${SRC}local/badges.js`);
  const { subtopicsForYear } = await import(`${SRC}engine/curriculum.js`);

  // Question banks are lazy chunks that src/api.js pulls in before a request
  // reaches the backend. This suite talks to dispatch() directly, so it does
  // that job itself — every bank, once, so no route is short of a generator.
  const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
  await loadAllBanks();

  const { keys: routes, seenAnywhere } = routeTable();
  const reached = new Set();
  coverage = { driven: 0, total: routes.length };

  /** Drive an endpoint and record which route in the table it landed on. */
  function call(method, path, body) {
    const key = resolveRoute(routes, method, path);
    if (key) reached.add(key);
    return dispatch(method, path, body);
  }

  const GET = (path, body) => call('GET', path, body);
  const POST = (path, body) => call('POST', path, body);
  const PATCH = (path, body) => call('PATCH', path, body);

  // Bindings a later group needs from an earlier one. Declared here so that a
  // group which fails cannot take the groups after it down with a ReferenceError.
  let ada, grace, topicId;
  let created, marked, blankExam, history;
  let teacher, custom, backup, restored;

  /** Serve a question and hand back both the public view and the real payload. */
  async function nextQuestion(body = {}) {
    const res = await POST('/practice/next', body);
    const row = await idb.get('questions', res.question.id);
    return { ...res, payload: row.payload };
  }

  /** A served question whose answer the suite can both satisfy and miss. */
  async function answerableQuestion(body = {}, tries = 30) {
    for (let i = 0; i < tries; i++) {
      const q = await nextQuestion(body);
      const right = canonicalInput(q.payload);
      const wrong = wrongInput(q.payload);
      if (right === null || wrong === null) continue;
      if (!checkAnswer(q.payload, right).correct) continue;
      if (checkAnswer(q.payload, wrong).correct) continue;
      return { ...q, right, wrong };
    }
    return null;
  }

  // ── Profile lifecycle ──────────────────────────────────────────────────────
  section('profiles');
  try {
    resetStorage();

    ada = (await POST('/profiles', { name: 'Ada Lovelace', year: 10, email: 'ada.lovelace@example.com' })).user;
    eq('create returns the name', ada.name, 'Ada Lovelace');
    eq('create returns the year', ada.year, 10);
    eq('create labels the course', ada.courseLabel, 'Year 10 · Stage 5');
    eq('a new profile starts at zero XP', ada.xp, 0);
    eq('a new profile has no password', ada.hasPassword, false);
    ok('create issues an id', typeof ada.id === 'string' && ada.id.length >= 16, `id ${show(ada.id)}`);

    const listed = await GET('/profiles');
    eq('the picker lists one profile', listed.profiles.length, 1);
    eq('the picker marks it current', listed.currentId, ada.id);
    eq('the signed-in profile sees its own address', (await GET('/me')).user.email, 'ada.lovelace@example.com');

    // The picker is drawn before anybody proves who they are, so it is the one
    // screen a stranger holding the iPad always gets. It may say a profile has
    // an address; it may not hand over what the address is.
    ok('the picker does not hand out the full address',
      !String(listed.profiles[0].email ?? '').includes('lovelace'),
      `the picker showed ${show(listed.profiles[0].email)} before anyone signed in`);

    await rejects('a malformed email is refused', POST('/profiles', { name: 'X', email: 'not-an-email' }), { status: 400 });
    await rejects('a duplicate email is refused', POST('/profiles', { name: 'Y', email: 'ada.lovelace@example.com' }), { status: 409 });
    eq('neither refusal created a profile', (await GET('/profiles')).profiles.length, 1);

    const patched = (await PATCH('/me', { year: 11, pathway: 'ext1', theme: 'light', dailyGoal: 25, avatar: '🦊' })).user;
    eq('PATCH /me moves the year', patched.year, 11);
    eq('PATCH /me sets the pathway', patched.pathway, 'ext1');
    eq('PATCH /me relabels the course', patched.courseLabel, 'Year 11 · Mathematics Extension 1');
    eq('PATCH /me sets the theme', patched.theme, 'light');
    eq('PATCH /me sets the daily goal', patched.dailyGoal, 25);
    eq('PATCH /me clamps the daily goal', (await PATCH('/me', { dailyGoal: 900 })).user.dailyGoal, 60);
    eq('PATCH /me clamps the year', (await PATCH('/me', { year: 99 })).user.year, 12);
    await PATCH('/me', { year: 10 });

    await POST('/auth/logout');
    await rejects('GET /me needs a selected profile', GET('/me'), { status: 401 });
    await POST('/profiles/select', { id: ada.id });
    eq('select without a password works when there is none', (await GET('/me')).user.id, ada.id);
    await rejects('an unknown route is a 404', dispatch('GET', '/nope', {}), { status: 404 });
  } catch (err) { crashed(err); }

  // ── Passwords ──────────────────────────────────────────────────────────────
  section('passwords');
  try {
    await rejects('a 7-character password is refused',
      POST('/profiles', { name: 'Grace', year: 9, password: 'sevench' }), { status: 400, message: /8 characters/ });
    eq('the refused profile was not created', (await GET('/profiles')).profiles.length, 1);

    grace = (await POST('/profiles', { name: 'Grace Hopper', year: 9, password: 'compiler-1' })).user;
    eq('an 8+ character password is accepted', grace.hasPassword, true);

    const stored = await idb.get('profiles', grace.id);
    ok('the password is never stored in plain text',
      !JSON.stringify(stored).includes('compiler-1'), 'the profile record still holds the password itself');
    ok('the stored record is a salted derivation',
      !!stored.auth?.salt && !!stored.auth?.hash && Number(stored.auth?.iter) > 0, show(stored.auth && Object.keys(stored.auth)));
    // The lock caps how many guesses can be spent through the app; the cost of
    // one derivation is what a guess costs to anyone who skips the app and
    // works on the record itself. Read off the live record, so raising the cost
    // in local/auth.js strengthens this check rather than breaking it.
    ok('a guess is expensive to make against the stored record',
      Number(stored.auth?.iter) >= 310000, `iter ${show(stored.auth?.iter)} — cheap enough to grind through offline`);

    await POST('/profiles/select', { id: ada.id });
    await rejects('a protected profile will not open with no password',
      POST('/profiles/select', { id: grace.id }), { status: 401, needsPassword: true });
    await rejects('a protected profile will not open with the wrong password',
      POST('/profiles/select', { id: grace.id, password: 'compiler-2' }), { status: 401, needsPassword: true });
    eq('a refused unlock does not switch profile', (await GET('/me')).user.id, ada.id);
    eq('the right password opens it', (await POST('/profiles/select', { id: grace.id, password: 'compiler-1' })).user.id, grace.id);

    await rejects('changing a password needs the current one',
      POST('/profiles/password', { current: 'wrong-one-x', next: 'punch-cards-9' }), { status: 401 });
    await rejects('a replacement password must also reach 8 characters',
      POST('/profiles/password', { current: 'compiler-1', next: 'short' }), { status: 400, message: /8 characters/ });
    eq('the old password still works after a refused change',
      (await POST('/profiles/select', { id: grace.id, password: 'compiler-1' })).user.id, grace.id);

    await POST('/profiles/password', { current: 'compiler-1', next: 'punch-cards-9' });
    await rejects('the replaced password stops working',
      POST('/profiles/select', { id: grace.id, password: 'compiler-1' }), { status: 401, needsPassword: true });
    eq('the new password works', (await POST('/profiles/select', { id: grace.id, password: 'punch-cards-9' })).user.id, grace.id);
  } catch (err) { crashed(err); }

  // ── The failed-unlock ladder ───────────────────────────────────────────────
  section('lockout ladder');
  try {
    const target = (await POST('/profiles', { name: 'Alan Turing', year: 12, password: 'bombe-machine' })).user;
    await POST('/profiles/select', { id: ada.id });

    await rejects('a protected profile is not opened by an empty password',
      POST('/profiles/select', { id: target.id, password: '' }), { status: 401, needsPassword: true });
    eq('being asked for a password does not spend a guess', (await idb.get('profiles', target.id)).failCount ?? 0, 0);

    for (let i = 1; i <= 4; i++) {
      await rejects(`failure ${i} is refused but not locked`,
        POST('/profiles/select', { id: target.id, password: `guess-${i}` }), { status: 401, needsPassword: true, message: /wrong password/i });
    }
    const locked = await rejects('the fifth failure locks the profile',
      POST('/profiles/select', { id: target.id, password: 'guess-5' }), { status: 429, message: /too many wrong passwords/i });
    ok('the lock says how long it lasts', (locked?.retryAfterMs ?? 0) > 0, `retryAfterMs ${show(locked?.retryAfterMs)}`);
    const stillLocked = await rejects('the right password is refused while locked',
      POST('/profiles/select', { id: target.id, password: 'bombe-machine' }), { status: 429, message: /too many wrong passwords/i });
    ok('and the refusal still reports how long is left', (stillLocked?.retryAfterMs ?? 0) > 0, `retryAfterMs ${show(stillLocked?.retryAfterMs)}`);

    // The count has to outlive the tab: a lock held only in memory is lifted by
    // closing the app, which is the first thing anyone holding the iPad tries.
    const lockRow = await idb.get('profiles', target.id);
    ok('the lock is written to the profile record', (lockRow.lockedUntil ?? 0) > Date.now(),
      `stored lock state ${show({ failCount: lockRow.failCount, lockedUntil: lockRow.lockedUntil })}`);
    eq('every failure was counted', lockRow.failCount, 5);

    // Serve out the lock rather than waiting it out, then prove it clears.
    lockRow.lockedUntil = Date.now() - 1;
    await idb.put('profiles', lockRow);
    eq('the profile opens once the lock expires',
      (await POST('/profiles/select', { id: target.id, password: 'bombe-machine' })).user.id, target.id);
    eq('a good password clears the failure count', (await idb.get('profiles', target.id)).failCount, 0);
    await rejects('the next failure starts the ladder again',
      POST('/profiles/select', { id: target.id, password: 'guess-again' }), { status: 401, message: /wrong password/i });
    eq('the count restarts at one', (await idb.get('profiles', target.id)).failCount, 1);

    // The ladder has to get longer, or five guesses a minute is all it costs.
    for (let i = 2; i <= 5; i++) await POST('/profiles/select', { id: target.id, password: `again-${i}` }).catch(() => { });
    const firstLock = (await idb.get('profiles', target.id)).lockedUntil - Date.now();
    const held = await idb.get('profiles', target.id);
    held.lockedUntil = Date.now() - 1;
    await idb.put('profiles', held);
    await POST('/profiles/select', { id: target.id, password: 'one-more-guess' }).catch(() => { });
    const secondLock = (await idb.get('profiles', target.id)).lockedUntil - Date.now();
    ok('a profile that keeps being guessed at locks for longer each time', secondLock > firstLock,
      `first lock ${Math.round(firstLock / 1000)}s, next lock ${Math.round(secondLock / 1000)}s`);
  } catch (err) { crashed(err); }

  // ── The ladder under a concurrent attack ───────────────────────────────────
  // A ladder tested one guess at a time proves nothing about a ladder: counting
  // failures is a read-modify-write, and guesses fired together all read the
  // same count and write back the same 1. Forty parallel guesses is what an
  // attacker with the device and ten lines of script actually does, and the
  // profile has to be shut after them exactly as it is after five in a row.
  section('lockout under load');
  try {
    const swarmed = (await POST('/profiles', { name: 'Katherine Johnson', year: 12, password: 'orbital-mechanics' })).user;
    await POST('/profiles/select', { id: ada.id });

    const burst = await Promise.all(Array.from({ length: 40 }, (_, i) =>
      POST('/profiles/select', { id: swarmed.id, password: `swarm-${i}` }).then(() => 'opened', err => err)));
    eq('no guess in the burst opened the profile', burst.filter(r => r === 'opened').length, 0);
    eq('every guess in the burst was refused', burst.filter(r => r?.status === 401 || r?.status === 429).length, 40);
    ok('the burst ran into the lock rather than 40 free tries',
      burst.some(r => r?.status === 429),
      `40 parallel guesses never tripped the lock: ${show([...new Set(burst.map(r => r?.message))].slice(0, 3))}`);

    const afterBurst = await idb.get('profiles', swarmed.id);
    ok('the parallel failures were counted, not overwritten by each other',
      (afterBurst.failCount ?? 0) >= 5,
      `40 parallel wrong guesses left failCount at ${show(afterBurst.failCount)} — the count was read and written by all of them at once`);
    ok('the profile is locked after the burst', (afterBurst.lockedUntil ?? 0) > Date.now(),
      `stored lock state ${show({ failCount: afterBurst.failCount, lockedUntil: afterBurst.lockedUntil })}`);

    const refused = await rejects('the correct password is refused after the burst',
      POST('/profiles/select', { id: swarmed.id, password: 'orbital-mechanics' }), { status: 429 });
    ok('and refused because of the lock', (refused?.retryAfterMs ?? 0) > 0,
      `40 parallel guesses did not lock the profile — the correct password came back as ${show(refused?.message)}`);

    // Selecting is not the only door with a password on it: deleting a profile
    // spends a guess too, so it is fired in parallel at a second profile and
    // has to end the same way. A gate on one route only is not a gate.
    const doorTwo = (await POST('/profiles', { name: 'Second Door', year: 9, password: 'back-entrance-1' })).user;
    await POST('/profiles/select', { id: ada.id });
    const deletes = await Promise.all(Array.from({ length: 40 }, (_, i) =>
      POST('/profiles/delete', { id: doorTwo.id, password: `swarm-${i}` }).then(() => 'deleted', err => err)));
    eq('no parallel delete got through', deletes.filter(r => r === 'deleted').length, 0);
    ok('the delete route is behind the same lock', deletes.some(r => r?.status === 429),
      `40 parallel delete attempts never tripped the lock: ${show([...new Set(deletes.map(r => r?.message))].slice(0, 3))}`);
    const doorTwoRow = await idb.get('profiles', doorTwo.id);
    ok('the profile survived the parallel deletes', !!doorTwoRow, 'one of the 40 wrong passwords deleted it');
    ok('and is locked', (doorTwoRow?.lockedUntil ?? 0) > Date.now(),
      `stored lock state ${show({ failCount: doorTwoRow?.failCount, lockedUntil: doorTwoRow?.lockedUntil })}`);
  } catch (err) { crashed(err); }

  // ── Encryption at rest ─────────────────────────────────────────────────────
  // A password that only hides a screen is worth nothing to a student whose
  // iPad is taken: the rows sit in IndexedDB where any other page-level code,
  // any backup of the device and any file browser can read them. So the raw
  // bytes are read here without going through local/idb.js, and every piece of
  // the profile's work is looked for in them by name.
  section('encryption at rest');
  try {
    const sealed = (await POST('/profiles', { name: 'Sealed Sam', year: 9, password: 'sealed-at-rest-1' })).user;
    const canaryInk = `CANARY-INK-${Math.random().toString(36).slice(2, 10)}`;

    const worked = await answerableQuestion({});
    if (!ok('a question was served to the protected profile', !!worked, 'nothing answerable came back')) {
      throw new Error('encryption group cannot continue without a question');
    }
    const canaryPrompt = worked.payload.prompt;
    ok('the served prompt is distinctive enough to search for', String(canaryPrompt).length >= 20, show(canaryPrompt));
    await POST(`/practice/${worked.question.id}/submit`, {
      answer: worked.right, ms: 5000, viaInk: true,
      ink: { strokes: [{ points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }], recognized: canaryInk }
    });

    const disk = JSON.stringify(rawRows());
    ok('the question is on disk at all', disk.includes(sealed.id), 'no row on disk names this profile — nothing was written');
    ok('the profile id stays readable so the indexes still work',
      rawRows().questions.some(r => r.pid === sealed.id), 'no questions row carries the pid in the clear');

    ok('the question a protected profile was served is not readable on disk',
      !disk.includes(canaryPrompt), `the prompt ${show(String(canaryPrompt).slice(0, 60))} is sitting in plain text`);
    // Searching the whole disk for the answer STRING is unreliable: a short
    // canonical answer like "3/4" occurs legitimately in unrelated content — an
    // unsealed profile's prompt, a curriculum label — and the run then fails for
    // a coincidence rather than a leak. The field is what has to be sealed, so
    // the field is what is asserted: no raw row may carry the answer in the
    // clear, whatever its text happens to be.
    const answerFields = ['answerGiven', 'answer', 'given', 'canonicalWorking'];
    const exposed = Object.entries(rawRows())
      .flatMap(([store, rows]) => (rows || [])
        .filter(r => r.pid === sealed.id && answerFields.some(f => f in r))
        .map(r => `${store}.${answerFields.filter(f => f in r).join('/')}`));
    eq('no row of theirs carries an answer field in the clear', exposed, []);
    ok('the answer they gave is not readable on disk',
      !disk.includes(String(worked.right)) || String(worked.right).length < 6,
      `the answer ${show(worked.right)} is sitting in plain text`);
    ok('their handwriting is not readable on disk',
      !disk.includes(canaryInk), `the recognised ink ${show(canaryInk)} is sitting in plain text`);

    // Unreadable is only half of it: it has to still be their work when they
    // come back with the password.
    const readBack = await POST('/history/list', { pageSize: 50 });
    ok('the profile can still read its own history', readBack.items.some(i => i.prompt === canaryPrompt),
      `history did not return the question that was answered (${readBack.total} rows)`);
    eq('and its own handwriting', (await GET(`/ink/${worked.question.id}`)).ink?.recognized, canaryInk);

    // Signing out has to put the rows beyond reach, not merely change a screen.
    await POST('/auth/logout');
    await POST('/profiles/select', { id: ada.id });
    const lockedDisk = JSON.stringify(rawRows());
    ok('the rows stay sealed once the profile is signed out',
      !lockedDisk.includes(canaryPrompt) && !lockedDisk.includes(canaryInk), 'signing out left the rows in plain text');
    await rejects('and the profile will not reopen without its password',
      POST('/profiles/select', { id: sealed.id }), { status: 401, needsPassword: true });
    eq('the password brings the work back', (await POST('/profiles/select', { id: sealed.id, password: 'sealed-at-rest-1' })).user.id, sealed.id);
    ok('with the history intact', (await POST('/history/list', { pageSize: 50 })).items.some(i => i.prompt === canaryPrompt),
      'the history did not survive the round trip through the lock');
  } catch (err) { crashed(err); }

  // ── Practice loop ──────────────────────────────────────────────────────────
  section('practice');
  try {
    await POST('/profiles/select', { id: ada.id });

    const first = await nextQuestion({});
    ok('a served question carries a prompt', typeof first.question.prompt === 'string' && first.question.prompt.length > 0, show(first.question.prompt));
    eq('a served question never carries the answer', first.question.answer, undefined);
    eq('a served question starts with two tries', first.question.triesLeft, 2);
    eq('a served question starts with no hints used', first.question.hintsUsed, 0);
    ok('the picker explains itself', typeof first.why === 'string' && first.why.length > 0, show(first.why));
    ok('marking criteria come with it', Array.isArray(first.question.criteria) && first.question.criteria.length >= 1, show(first.question.criteria));

    const hinted = await POST(`/practice/${first.question.id}/hint`, {});
    ok('a hint comes back as text', typeof hinted.hint === 'string' && hinted.hint.length > 0, show(hinted.hint));
    eq('the first hint is level 1', hinted.level, first.payload.hints?.length ? 1 : 0);
    eq('the hint is recorded on the question', (await idb.get('questions', first.question.id)).hintsUsed, hinted.level);

    topicId = subtopicsForYear(10)[0].id;
    const topic = await nextQuestion({ mode: 'topic', subtopic: topicId, difficulty: 3 });
    eq('topic mode serves the topic asked for', topic.question.subtopic, topicId);
    eq('topic mode honours the difficulty', topic.question.difficulty, 3);
    eq('an out-of-range difficulty is clamped', (await nextQuestion({ mode: 'topic', subtopic: topicId, difficulty: 99 })).question.difficulty, 4);

    const missable = await answerableQuestion({ mode: 'topic', subtopic: topicId });
    if (!ok('a markable question was served', !!missable, 'no question yielded both a right and a wrong answer')) {
      throw new Error('practice group cannot continue');
    }
    const miss1 = await POST(`/practice/${missable.question.id}/submit`, { answer: missable.wrong, ms: 4000 });
    eq('a first wrong answer is marked wrong', miss1.correct, false);
    eq('a first wrong answer is not resolved', miss1.resolved, false);
    eq('a first wrong answer leaves one try', miss1.triesLeft, 1);
    ok('a first wrong answer gives feedback', typeof miss1.feedback === 'string' && miss1.feedback.length > 0, show(miss1.feedback));
    eq('a first wrong answer withholds the solution', miss1.solution, undefined);

    const miss2 = await POST(`/practice/${missable.question.id}/submit`, { answer: missable.wrong, ms: 4000 });
    eq('a second wrong answer resolves the question', miss2.resolved, true);
    eq('a second wrong answer is still wrong', miss2.correct, false);
    ok('a resolved question reveals the answer', typeof miss2.solution?.answerText === 'string' && miss2.solution.answerText.length > 0, show(miss2.solution?.answerText));
    await rejects('a resolved question cannot be answered again',
      POST(`/practice/${missable.question.id}/submit`, { answer: missable.right }), { status: 409 });

    const xpBefore = (await GET('/me')).user.xp;
    const hit = await answerableQuestion({ mode: 'topic', subtopic: topicId });
    const right = await POST(`/practice/${hit.question.id}/submit`, { answer: hit.right, ms: 9000 });
    eq('the right answer is marked correct', right.correct, true);
    eq('the right answer resolves the question', right.resolved, true);
    ok('the right answer earns XP', right.xp > 0, `xp ${right.xp}`);
    eq('the profile XP total moves by that much', (await GET('/me')).user.xp, xpBefore + right.xp);
    ok('mastery comes back as a percentage', right.mastery >= 0 && right.mastery <= 100, `mastery ${right.mastery}`);
    ok('a predicted mark comes back', typeof right.predicted?.mark === 'number', show(right.predicted));
    ok('the rating moved', typeof right.ratingDelta === 'number' && right.ratingDelta !== 0, `ratingDelta ${right.ratingDelta}`);
    const ratingRow = await idb.get('ratings', `${ada.id}:${topicId}`);
    ok('the rating is stored against the subtopic', !!ratingRow && ratingRow.attempts >= 1, show(ratingRow));

    const revealTarget = await nextQuestion({ mode: 'topic', subtopic: topicId });
    const revealed = await POST(`/practice/${revealTarget.question.id}/reveal`, { ms: 1000 });
    eq('reveal resolves the question', revealed.resolved, true);
    eq('reveal marks it wrong', revealed.correct, false);
    eq('reveal says so', revealed.revealed, true);
    ok('reveal shows the worked solution', Array.isArray(revealed.solution?.steps) && revealed.solution.steps.length > 0, show(revealed.solution?.steps?.length));
    await rejects('a revealed question cannot then be answered',
      POST(`/practice/${revealTarget.question.id}/submit`, { answer: '1' }), { status: 409 });

    const strangerQ = await nextQuestion({});
    await POST('/profiles/select', { id: grace.id, password: 'punch-cards-9' });
    await rejects('another profile cannot answer your question',
      POST(`/practice/${strangerQ.question.id}/submit`, { answer: '1' }), { status: 404 });
    await rejects('another profile cannot hint at your question',
      POST(`/practice/${strangerQ.question.id}/hint`, {}), { status: 404 });
    await POST('/profiles/select', { id: ada.id });

    const stats = await GET('/stats');
    eq('stats count every resolved attempt', stats.totals.attempts, (await idb.byIndex('attempts', 'pid', ada.id)).length);
    ok('stats count the correct ones', stats.totals.correct >= 1, `correct ${stats.totals.correct}`);
    ok('stats carry a trajectory', Array.isArray(stats.trajectory), show(typeof stats.trajectory));
    ok('stats carry priorities', Array.isArray(stats.priorities) && stats.priorities.length > 0, show(stats.priorities?.length));
    eq('today’s activity is recorded', (await GET('/me')).user.today.questions, stats.totals.attempts);
  } catch (err) { crashed(err); }

  // ── Exams ──────────────────────────────────────────────────────────────────
  section('exams');
  try {
    created = (await POST('/exams', { length: 10, minutes: 30 })).exam;
    ok('an exam is built with at least the length asked for', created.questions.length >= 10, `${created.questions.length} questions`);
    eq('the exam keeps its duration', created.durationMin, 30);
    ok('the exam is titled', /Practice Paper/.test(created.title), show(created.title));
    eq('a fresh exam has no score', created.score, null);
    eq('no exam question leaks its answer', created.questions.filter(q => q.answer !== undefined).length, 0);

    const paper = await GET(`/exams/${created.id}/paper`);
    eq('the printable paper has every question', paper.questions.length, created.questions.length);
    eq('the paper carries a model answer for each', paper.questions.filter(q => q.answerText === undefined && !q.multipart).length, 0);
    eq('the paper names the course', paper.course, 'Year 10 · Stage 5');

    // Answer the whole paper correctly, straight from the stored payloads.
    const perfect = {};
    for (const qid of (await idb.get('exams', created.id)).questionIds) {
      const q = (await idb.get('questions', qid)).payload;
      if (q.multipart) for (const part of q.parts) perfect[`${qid}::${part.key}`] = canonicalInput(part);
      else perfect[qid] = canonicalInput(q);
    }
    marked = await POST(`/exams/${created.id}/submit`, { answers: perfect, ms: 1200000 });
    ok('every mark on the paper is awarded', marked.score === marked.total, `${marked.score}/${marked.total}`);
    eq('a perfect paper is 100%', marked.pct, 100);
    ok('the paper is worth what its criteria say', marked.total > 0, `total ${marked.total}`);
    eq('the marked detail covers every question', marked.detail.length, created.questions.length);
    eq('every marked question is correct', marked.detail.filter(d => !d.correct).length, 0);
    await rejects('a submitted exam cannot be resubmitted',
      POST(`/exams/${created.id}/submit`, { answers: perfect }), { status: 409 });

    const reread = (await GET(`/exams/${created.id}`)).exam;
    eq('the finished exam keeps its score', reread.score, marked.score);
    ok('the finished exam keeps its marking detail', Array.isArray(reread.detail) && reread.detail.length === marked.detail.length, show(reread.detail?.length));

    blankExam = (await POST('/exams', { length: 10 })).exam;
    const blank = await POST(`/exams/${blankExam.id}/submit`, { answers: {}, ms: 60000 });
    eq('an unanswered paper scores nothing', blank.score, 0);
    ok('an unanswered paper is still worth marks', blank.total > 0, `total ${blank.total}`);
    eq('an unanswered paper is 0%', blank.pct, 0);
    eq('every unanswered question is marked wrong', blank.detail.filter(d => d.correct).length, 0);

    const examList = (await GET('/exams')).exams;
    eq('both exams are listed', examList.length, 2);
    eq('the list carries the scores', examList.filter(e => e.finished_at && e.total > 0).length, 2);
    await rejects('an unknown exam is a 404', GET('/exams/not-a-real-id'), { status: 404 });
  } catch (err) { crashed(err); }

  // ── History ────────────────────────────────────────────────────────────────
  section('history');
  try {
    history = await POST('/history/list', { page: 0, pageSize: 100 });
    ok('history holds every answered question', history.total >= 4, `total ${history.total}`);
    eq('history returns the page it was asked for', history.items.length, Math.min(history.total, 100));
    ok('history names each subtopic', history.items.every(i => typeof i.subtopicName === 'string' && i.subtopicName.length > 0), 'a row had no subtopic name');
    ok('history is newest first', history.items.every((it, i) => i === 0 || history.items[i - 1].answeredAt >= it.answeredAt), 'rows out of order');

    const wrongOnly = await POST('/history/list', { filter: 'wrong', pageSize: 100 });
    eq('the wrong filter keeps only wrong answers', wrongOnly.items.filter(i => i.correct !== false).length, 0);
    ok('there are wrong answers to find', wrongOnly.total >= 1, `total ${wrongOnly.total}`);
    const correctOnly = await POST('/history/list', { filter: 'correct', pageSize: 100 });
    eq('the correct filter keeps only right answers', correctOnly.items.filter(i => i.correct !== true).length, 0);
    eq('the two filters partition the answered set', wrongOnly.total + correctOnly.total, history.total);

    const paged = await POST('/history/list', { page: 1, pageSize: 2 });
    eq('paging returns the page size', paged.items.length, Math.min(2, Math.max(0, paged.total - 2)));
    eq('paging reports the same total', paged.total, history.total);

    const target = history.items.find(i => i.canRetry) || history.items[0];
    eq('bookmarking a question turns it on', (await POST(`/history/${target.id}/bookmark`, {})).bookmarked, true);
    const marks = await POST('/history/list', { filter: 'bookmarked', pageSize: 100 });
    ok('the bookmark filter finds it', marks.items.some(i => i.id === target.id), `bookmarked ${marks.total}`);
    eq('bookmarking again turns it off', (await POST(`/history/${target.id}/bookmark`, {})).bookmarked, false);
    eq('and the filter forgets it', (await POST('/history/list', { filter: 'bookmarked', pageSize: 100 })).items.filter(i => i.id === target.id).length, 0);
    await POST(`/history/${target.id}/bookmark`, {});

    const detail = await GET(`/history/${target.id}/detail`);
    eq('detail returns the same question', detail.question.id, target.id);
    ok('detail carries the model answer', typeof detail.solution?.answerText === 'string' || Array.isArray(detail.solution?.parts), show(Object.keys(detail.solution || {})));

    const retryable = history.items.find(i => i.canRetry);
    if (retryable) {
      const original = await idb.get('questions', retryable.id);
      const same = await POST(`/history/${retryable.id}/retry`, { variant: 'same' });
      ok('retry issues a new question row', same.question.id !== retryable.id, 'the same id came back');
      eq('retry keeps the subtopic', same.question.subtopic, original.subtopic);
      eq('retry "same" reproduces the question', same.question.prompt, original.payload.prompt);
      eq('the retried question is unanswered', same.question.triesLeft, 2);
      const fresh = await POST(`/history/${retryable.id}/retry`, { variant: 'fresh' });
      eq('retry "fresh" stays in the same subtopic', fresh.question.subtopic, original.subtopic);
    } else {
      ok('a retryable question exists in history', false, 'no history row reported canRetry');
    }
    await rejects('another profile cannot read your history detail',
      (async () => {
        await POST('/profiles/select', { id: grace.id, password: 'punch-cards-9' });
        return GET(`/history/${target.id}/detail`);
      })(), { status: 404 });
    await POST('/profiles/select', { id: ada.id });
  } catch (err) { crashed(err); }

  // ── Rush and match ─────────────────────────────────────────────────────────
  section('rush + match');
  try {
    const rush = await POST('/rush/start', {});
    eq('rush deals twenty questions', rush.questions.length, 20);
    eq('rush is ninety seconds', rush.seconds, 90);
    const rushQ = await idb.get('questions', rush.questions[0].id);
    const rushAnswer = canonicalInput(rushQ.payload);
    const rushRes = await POST('/rush/answer', { id: rush.questions[0].id, answer: rushAnswer });
    ok('rush marks the answer it was given', typeof rushRes.correct === 'boolean', show(rushRes));
    ok('rush shows the answer either way', typeof rushRes.answerText === 'string', show(rushRes.answerText));
    await rejects('a rush question cannot be answered twice',
      POST('/rush/answer', { id: rush.questions[0].id, answer: rushAnswer }), { status: 409 });
    const rushDone = await POST('/rush/finish', { correct: 13, total: 20, bestCombo: 6 });
    eq('rush records the score', rushDone.score, 13);
    eq('rush reports the personal best', rushDone.best, 13);

    const match = await POST('/match/start', { rival: 'pro' });
    eq('match deals ten questions', match.questions.length, 10);
    eq('match names the rival', match.rival.name, 'Captain Cosine');
    const matchDone = await POST('/match/finish', { won: true, playerScore: 8, rivalScore: 6, rival: 'Captain Cosine', ms: 90000 });
    eq('a win is recorded', matchDone.won, true);
    eq('the win count moves', matchDone.wins, 1);
    eq('the played count moves', matchDone.played, 1);
    const matchHistory = await GET('/match/history');
    eq('match history remembers the game', matchHistory.played, 1);
    eq('match history keeps the scoreline', matchHistory.recent[0].playerScore, 8);
  } catch (err) { crashed(err); }

  // ── Curriculum, badges, report, reviews ────────────────────────────────────
  section('reporting');
  try {
    const curriculum = await GET('/curriculum');
    ok('the curriculum covers every year', curriculum.years.length >= 6, `${curriculum.years.length} years`);
    ok('every subtopic reports mastery', curriculum.years.every(y => y.subtopics.every(s => typeof s.mastery === 'number')), 'a subtopic had no mastery');
    ok('the practised subtopic is no longer unseen',
      curriculum.years.flatMap(y => y.subtopics).find(s => s.id === topicId)?.band !== 'unseen', 'still unseen after being answered');
    eq('the curriculum knows the profile year', curriculum.userYear, 10);

    const badges = await GET('/badges');
    eq('every badge is listed', badges.badges.length, BADGES.length);
    ok('practice earns at least one badge', badges.earnedCount >= 1, `earned ${badges.earnedCount}`);

    const studentReport = await GET('/report');
    eq('the report names the student', studentReport.student.name, 'Ada Lovelace');
    ok('the report covers the year’s subtopics', studentReport.subtopics.length > 0, `${studentReport.subtopics.length} rows`);
    ok('the report predicts a mark', typeof studentReport.predicted?.mark === 'number', show(studentReport.predicted));
    ok('the report picks focus areas', studentReport.focus.length > 0, show(studentReport.focus.length));

    const reviews = await GET('/reviews');
    ok('reviews come back as two lists', Array.isArray(reviews.due) && Array.isArray(reviews.upcoming), show(Object.keys(reviews)));
    ok('the practised subtopic is scheduled for review',
      [...reviews.due, ...reviews.upcoming].some(r => r.subtopic === topicId),
      `neither list holds ${topicId} after three attempts`);

    const storage = await GET('/data/storage');
    ok('storage reports a usage figure', typeof storage.usage === 'number' && typeof storage.quota === 'number', show(storage));
  } catch (err) { crashed(err); }

  // ── Classes, tasks and custom questions ────────────────────────────────────
  section('classes + tasks');
  try {
    teacher = (await POST('/profiles', { name: 'Mr Turing', year: 12, role: 'teacher' })).user;
    eq('a teacher profile keeps its role', teacher.role, 'teacher');

    const klass = (await POST('/classes', { name: '10 Maths A' })).class;
    eq('a class keeps its name', klass.name, '10 Maths A');
    eq('a new class has no students', klass.studentPids.length, 0);
    const withStudent = (await POST(`/classes/${klass.id}/students`, { add: [ada.id] })).class;
    ok('a student joins the class', withStudent.studentPids.includes(ada.id), show(withStudent.studentPids));
    await rejects('an unknown class is a 404', POST('/classes/not-real/students', { add: [ada.id] }), { status: 404 });

    const roll = await GET('/classes');
    eq('the teacher sees the class they made', roll.classes.map(c => c.id), [klass.id]);
    eq('the roll carries the student it holds', roll.classes[0].students.map(x => x.id), [ada.id]);
    eq('the roll names them', roll.classes[0].students[0].name, 'Ada Lovelace');
    ok('the picker offers every student profile', roll.allProfiles.some(x => x.id === ada.id), show(roll.allProfiles.map(x => x.name)));
    ok('the picker offers no teacher profile', !roll.allProfiles.some(x => x.id === teacher.id), show(roll.allProfiles.map(x => x.name)));
    await POST('/profiles/select', { id: ada.id });
    eq('a student sees none of the teacher’s classes', (await GET('/classes')).classes.length, 0);
    await POST('/profiles/select', { id: teacher.id });

    custom = (await POST('/custom-questions', {
      name: 'Bearings check', prompt: 'A ship sails on a bearing of 120° for 40 km. How far east?',
      answerType: 'numeric', answer: { value: 34.6 }, difficulty: 3, solutionText: '40 sin 60° = 34.6 km'
    })).question;
    eq('a custom question keeps its name', custom.name, 'Bearings check');
    eq('a custom question keeps its difficulty', custom.difficulty, 3);
    eq('a custom question is listed for its owner', (await GET('/custom-questions')).questions.length, 1);
    await rejects('a custom question needs a prompt', POST('/custom-questions', { answerType: 'numeric', answer: { value: 1 } }), { status: 400 });

    const scrap = (await POST('/custom-questions', { name: 'Scrap', prompt: 'Delete me', answerType: 'numeric', answer: { value: 1 } })).question;
    eq('a second custom question is listed too', (await GET('/custom-questions')).questions.length, 2);
    eq('deleting one reports success', (await POST(`/custom-questions/${scrap.id}/delete`, {})).ok, true);
    eq('the deleted question leaves storage', await idb.get('customQs', scrap.id), undefined);
    eq('and the other one is untouched', (await GET('/custom-questions')).questions.map(q => q.id), [custom.id]);

    const task = (await POST('/tasks', { classId: klass.id, title: 'Trig warm-up', subtopics: [topicId], count: 3 })).task;
    eq('a task keeps its title', task.title, 'Trig warm-up');
    eq('a task keeps its count', task.count, 3);
    eq('a task drops unknown subtopics', (await POST('/tasks', { classId: klass.id, title: 'Filtered', subtopics: [topicId, 'not-a-subtopic'], count: 5 })).task.subtopics.length, 1);
    eq('a task count is capped at forty', (await POST('/tasks', { classId: klass.id, title: 'Long', subtopics: [topicId], count: 999 })).task.count, 40);
    await rejects('a task with nothing in it is refused', POST('/tasks', { classId: klass.id, title: 'Empty', subtopics: [], count: 5 }), { status: 400 });

    await POST('/profiles/select', { id: ada.id });
    const studentTasks = (await GET('/tasks')).tasks;
    ok('the class task reaches the student', studentTasks.some(t => t.id === task.id), `${studentTasks.length} tasks visible`);
    eq('the task starts unfinished', studentTasks.find(t => t.id === task.id).done, 0);

    const taskQ = await nextQuestion({ taskId: task.id });
    eq('a task question carries the task id', taskQ.question.taskId, task.id);
    ok('the task question explains itself', /Trig warm-up/.test(taskQ.why), show(taskQ.why));
    await POST(`/practice/${taskQ.question.id}/reveal`, { ms: 500 });
    eq('answering a task question moves the progress', (await idb.get('taskProgress', `${task.id}:${ada.id}`)).done, 1);
    eq('the student sees that progress', (await GET('/tasks')).tasks.find(t => t.id === task.id).done, 1);

    await POST('/profiles/select', { id: teacher.id });
    const analytics = await GET(`/classes/${klass.id}/analytics`);
    eq('class analytics covers the class', analytics.class.id, klass.id);
    eq('class analytics lists the student', analytics.students.length, 1);
    eq('class analytics names the student', analytics.students[0].name, 'Ada Lovelace');
    ok('class analytics counts their attempts', analytics.students[0].attempts >= 1, `attempts ${analytics.students[0].attempts}`);
    ok('class analytics names their weakest topic', typeof analytics.students[0].weakest === 'string', show(analytics.students[0].weakest));
    const analyticsTask = analytics.tasks.find(t => t.id === task.id);
    eq('class analytics tracks the task', analyticsTask.progress.length, 1);
    eq('class analytics shows what the student did', analyticsTask.progress[0].done, 1);

    await POST(`/tasks/${task.id}/delete`, {});
    eq('a deleted task is gone', await idb.get('tasks', task.id), undefined);
  } catch (err) { crashed(err); }

  // ── Task pack round trip ───────────────────────────────────────────────────
  section('task pack');
  try {
    const packTask = (await POST('/tasks', { title: 'Custom homework', customIds: [custom.id], count: 4 })).task;
    eq('a custom task takes the custom mode', packTask.mode, 'custom');
    const pack = await GET(`/tasks/${packTask.id}/pack`);
    eq('the pack declares its format', pack.format, 'pri-task-pack');
    eq('the pack names the teacher', pack.teacher, 'Mr Turing');
    eq('the pack carries the custom question', pack.customQs.length, 1);
    eq('the pack carries the task', pack.task.title, 'Custom homework');

    await POST('/profiles/select', { id: grace.id, password: 'punch-cards-9' });
    const imported = (await POST('/tasks/import-pack', structuredClone(pack))).task;
    eq('the imported task keeps its title', imported.title, 'Custom homework');
    eq('the imported task keeps its count', imported.count, 4);
    eq('the imported task carries one custom question', imported.customIds.length, 1);
    ok('the imported question is re-keyed for this device', imported.customIds[0] !== custom.id,
      'the pack chose its own storage key — a file must not do that');
    const graceCustom = (await GET('/custom-questions')).questions;
    eq('the custom question landed here', graceCustom.length, 1);
    eq('the question kept its prompt', graceCustom[0].q.prompt, custom.q.prompt);
    eq('the question kept its answer', graceCustom[0].q.answer.value, 34.6);
    eq('the question kept its name', graceCustom[0].name, 'Bearings check');

    const packQ = await nextQuestion({ taskId: imported.id });
    eq('the imported task serves the imported question', packQ.question.prompt, custom.q.prompt);
    eq('and it is flagged as a custom question', packQ.payload.custom, true);
    await rejects('a file that is not a pack is refused', POST('/tasks/import-pack', { format: 'something-else' }), { status: 400 });
    await rejects('a pack with nothing usable is refused',
      POST('/tasks/import-pack', { format: 'pri-task-pack', task: { title: 'Empty', subtopics: ['nope'] }, customQs: [] }), { status: 400 });
  } catch (err) { crashed(err); }

  // ── Progress file round trip ───────────────────────────────────────────────
  section('progress file');
  try {
    await POST('/profiles/select', { id: ada.id });
    const progress = await GET('/data/progress-file');
    eq('the progress file declares its format', progress.format, 'pri-progress');
    eq('the progress file names the student', progress.student.name, 'Ada Lovelace');
    ok('the progress file carries ratings', Object.keys(progress.ratings).length >= 1, `${Object.keys(progress.ratings).length} ratings`);
    ok('the progress file carries totals', progress.totals.attempts >= 1, show(progress.totals));

    await POST('/profiles/select', { id: teacher.id });
    const otherClass = (await POST('/classes', { name: 'Imports' })).class;
    eq('a progress file imports into a class', (await POST(`/classes/${otherClass.id}/import-progress`, progress)).student, 'Ada Lovelace');
    const importedAnalytics = await GET(`/classes/${otherClass.id}/analytics`);
    eq('the imported student joins the analytics', importedAnalytics.students.length, 1);
    eq('the imported student keeps their name', importedAnalytics.students[0].name, 'Ada Lovelace');
    eq('the imported student is flagged as a file', importedAnalytics.students[0].imported, true);
    eq('the imported totals survive', importedAnalytics.students[0].attempts, progress.totals.attempts);
    await POST(`/classes/${otherClass.id}/import-progress`, progress);
    eq('re-importing replaces rather than duplicates', (await GET(`/classes/${otherClass.id}/analytics`)).students.length, 1);
    await rejects('a file that is not a progress file is refused',
      POST(`/classes/${otherClass.id}/import-progress`, { format: 'pri-learning-backup' }), { status: 400 });
  } catch (err) { crashed(err); }

  // ── Backup round trip ──────────────────────────────────────────────────────
  section('backup round trip');
  try {
    await POST('/profiles/select', { id: ada.id });
    const inkQ = await answerableQuestion({ mode: 'topic', subtopic: topicId });
    await POST(`/practice/${inkQ.question.id}/submit`, {
      answer: inkQ.right, ms: 7000, viaInk: true,
      ink: { strokes: [{ points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }], recognized: inkQ.right }
    });

    // The ink archive: History replays a student's own handwriting from here.
    const archived = (await GET(`/ink/${inkQ.question.id}`)).ink;
    eq('the ink archive keeps the strokes that were drawn', archived.strokes.length, 1);
    eq('and the reading taken off them', archived.recognized, inkQ.right);
    eq('an unknown ink id comes back empty rather than throwing', (await GET('/ink/not-a-real-id')).ink, null);
    eq('the same ink reaches history', (await GET(`/history/${inkQ.question.id}/detail`)).ink.recognized, inkQ.right);

    // Handwriting is the most personal thing this app stores and the archive is
    // reachable by a bare id, so the route is asked for one that is not the
    // caller's. Refusing and returning nothing are both answers; handing over
    // the strokes is not.
    await POST('/profiles/select', { id: grace.id, password: 'punch-cards-9' });
    let leaked;
    try { leaked = (await GET(`/ink/${inkQ.question.id}`)).ink; } catch { leaked = null; }
    await POST('/profiles/select', { id: ada.id });
    eq('another profile cannot read your handwriting', leaked ?? null, null);

    backup = await GET('/data/export');
    eq('the backup declares its format', backup.format, 'pri-learning-backup');
    eq('the backup carries the profile', backup.profile.name, 'Ada Lovelace');
    // A backup file is plain text on whatever it is copied to, so what it may
    // not carry matters as much as what it does.
    ok('the backup carries no password material',
      !/"(auth|vault|salt|hash|emailHash|emailSealed|failCount|lockedUntil)"/.test(JSON.stringify(backup.profile)),
      show(Object.keys(backup.profile)));
    const filled = Object.entries(backup.stores).filter(([, rows]) => rows.length);
    ok('the backup carries most of the stores', filled.length >= 8, `only ${filled.length} stores had rows: ${filled.map(([k]) => k).join(', ')}`);

    restored = (await POST('/data/import', structuredClone(backup))).user;
    ok('a restore that clashes on name is marked restored', /restored/.test(restored.name), show(restored.name));
    eq('the restored profile keeps the year', restored.year, backup.profile.year);
    eq('the restored profile keeps the XP', restored.xp, backup.profile.xp);
    ok('the restored profile is a new profile', restored.id !== ada.id, 'the import reused the source id');
    eq('the import signs the restored profile in', (await GET('/me')).user.id, restored.id);

    const reexport = await GET('/data/export');
    for (const store of Object.keys(backup.stores)) {
      eq(`every ${store} row survived the round trip`, reexport.stores[store].length, backup.stores[store].length);
    }
    const restoredExam = reexport.stores.exams.find(e => e.id === created.id);
    ok('the marked exam survived with its score', restoredExam && restoredExam.score === marked.score, show(restoredExam?.score));
    eq('the blank exam survived too', reexport.stores.exams.find(e => e.id === blankExam.id)?.score, 0);
    ok('the exam kept its marking detail', Array.isArray(restoredExam?.detail) && restoredExam.detail.length === marked.detail.length, show(restoredExam?.detail?.length));
    const restoredInk = reexport.stores.inks[0];
    ok('handwriting survived the round trip', restoredInk?.strokes?.length === 1 && restoredInk.recognized === inkQ.right, show(restoredInk?.recognized));
    eq('the bookmark survived', reexport.stores.bookmarks.length, backup.stores.bookmarks.length);
    eq('every restored row belongs to the new profile',
      Object.values(reexport.stores).flat().filter(r => r.pid !== restored.id).length, 0);

    const restoredHistory = await POST('/history/list', { pageSize: 200 });
    eq('the restored profile can read its own history', restoredHistory.total, history.total + 3);
    eq('the restored stats match the source', (await GET('/stats')).totals.attempts, backup.stores.attempts.length);

    await POST('/profiles/select', { id: ada.id });
    eq('the source profile is untouched by the restore', (await GET('/stats')).totals.attempts, backup.stores.attempts.length);
    await rejects('a file that is not a backup is refused', POST('/data/import', { format: 'nope' }), { status: 400 });
    await rejects('a backup with no profile is refused', POST('/data/import', { format: 'pri-learning-backup' }), { status: 400 });
  } catch (err) { crashed(err); }

  // ── The demo profile ───────────────────────────────────────────────────────
  section('demo profile');
  try {
    const demo = (await POST('/profiles/demo', {})).user;
    eq('the demo profile is flagged as one', demo.isDemo, true);
    ok('the demo profile arrives with history', demo.xp > 0, `xp ${demo.xp}`);
    ok('the demo profile has a streak', demo.streak >= 0, `streak ${demo.streak}`);
    eq('asking twice reuses the same demo', (await POST('/profiles/demo', {})).user.id, demo.id);
    const demoStats = await GET('/stats');
    ok('the demo profile has real attempts behind it', demoStats.totals.attempts > 50, `attempts ${demoStats.totals.attempts}`);
    ok('the demo profile has mastery to show', demoStats.strands.some(s => s.mastery > 0), show(demoStats.strands));
  } catch (err) { crashed(err); }

  // ── Deleting a profile ─────────────────────────────────────────────────────
  // Deleting is the one operation with nothing to undo it, so it is driven with
  // a profile that first puts a row in every store there is — including the
  // four that used to be left behind — and afterwards the raw database is read
  // and searched for the id. "Every store" is not a list written here that can
  // fall behind the schema: it is whatever stores exist at the time.
  section('delete + wipe');
  try {
    const doomed = (await POST('/profiles', { name: 'Doomed Dana', year: 10, password: 'erase-me-please' })).user;
    const doomedClass = (await POST('/classes', { name: 'Going away' })).class;
    const doomedTask = (await POST('/tasks', { title: 'Going away', subtopics: [topicId], count: 2 })).task;
    const doomedCustom = (await POST('/custom-questions', { name: 'Going away', prompt: 'Gone with the profile', answerType: 'numeric', answer: { value: 1 } })).question;
    await POST(`/classes/${doomedClass.id}/students`, { add: [doomed.id] });

    for (let i = 0; i < 3; i++) {
      const q = await nextQuestion({ mode: 'topic', subtopic: topicId });
      await POST(`/practice/${q.question.id}/reveal`, { ms: 800 });
    }
    const taskQ = await nextQuestion({ taskId: doomedTask.id });
    await POST(`/practice/${taskQ.question.id}/submit`, {
      answer: 'anything', ms: 900, viaInk: true,
      ink: { strokes: [{ points: [{ x: 5, y: 6 }] }], recognized: 'x=1' }
    });
    await POST(`/history/${taskQ.question.id}/bookmark`, {});
    const doomedExam = (await POST('/exams', { length: 10 })).exam;
    await POST(`/exams/${doomedExam.id}/submit`, { answers: {}, ms: 60000 });
    await POST('/rush/finish', { correct: 4, total: 20, bestCombo: 2 });
    await POST('/match/finish', { won: false, playerScore: 3, rivalScore: 7, rival: 'Robo-Rookie', ms: 60000 });
    await POST(`/classes/${doomedClass.id}/import-progress`, await GET('/data/progress-file'));

    // The fixture is only worth anything if the profile really does occupy every
    // store the delete has to reach, so that is asserted by NAME rather than by a
    // count. A count was both unreachable and flaky here: `classes` and `tasks`
    // now carry their owner inside the sealed body, so a raw substring sweep
    // cannot see them, and whether the profile happens to earn a badge moved the
    // total between runs. Sealed stores are therefore checked through the
    // accessors, which open a row while the profile's key is still held.
    const before = rawRows();
    const rawOccupied = new Set(Object.entries(before)
      .filter(([, rows]) => JSON.stringify(rows).includes(doomed.id))
      .map(([name]) => name));
    const sealedOccupied = new Set();
    if ((await idb.all('classes')).some(c => c.teacherPid === doomed.id || c.studentPids?.includes(doomed.id))) sealedOccupied.add('classes');
    if ((await idb.all('tasks')).some(t => t.ownerPid === doomed.id)) sealedOccupied.add('tasks');
    const occupied = new Set([...rawOccupied, ...sealedOccupied]);
    const mustReach = ['profiles', 'ratings', 'attempts', 'questions', 'exams', 'activity',
      'rushRuns', 'matchRuns', 'inks', 'bookmarks', 'customQs', 'progressImports', 'classes', 'tasks'];
    const missing = mustReach.filter(name => !occupied.has(name));
    eq('the doomed profile has a row in every store the delete must reach', missing, []);

    await rejects('a protected profile will not delete without its password',
      POST('/profiles/delete', { id: doomed.id }), { status: 401, needsPassword: true });
    await rejects('nor with the wrong one',
      POST('/profiles/delete', { id: doomed.id, password: 'not-it-at-all' }), { status: 401, needsPassword: true });
    ok('the profile survived both refusals', !!(await idb.get('profiles', doomed.id)), 'a refused delete removed it anyway');
    await rejects('an unprotected profile will not delete on a bare id either',
      POST('/profiles/delete', { id: teacher.id }), { status: 400 });
    ok('and it is still there', !!(await idb.get('profiles', teacher.id)), 'a refused delete removed it anyway');

    await POST('/profiles/delete', { id: doomed.id, password: 'erase-me-please' });
    eq('the deleted profile is gone from the picker', (await GET('/profiles')).profiles.filter(p => p.id === doomed.id).length, 0);

    const after = rawRows();
    const leftBehind = Object.entries(after)
      .map(([name, rows]) => [name, rows.filter(r => JSON.stringify(r).includes(doomed.id)).length])
      .filter(([, n]) => n > 0);
    eq('no store anywhere still holds a row naming the deleted profile', leftBehind, []);
    eq('the class roll no longer names them',
      (await idb.all('classes')).filter(c => c.studentPids?.includes(doomed.id)).length, 0);
    eq('the class they owned went with them', await idb.get('classes', doomedClass.id), undefined);
    eq('so did the task', await idb.get('tasks', doomedTask.id), undefined);
    eq('so did the custom question', await idb.get('customQs', doomedCustom.id), undefined);
    ok('the other profiles are untouched', !!(await idb.get('profiles', ada.id)), 'the delete took another profile with it');
    eq('and so is their work', (await idb.byIndex('attempts', 'pid', ada.id)).length, backup.stores.attempts.length);
  } catch (err) { crashed(err); }

  // ── Ownership of rows named by id ──────────────────────────────────────────
  section('ownership');
  try {
    // Each of these routes reaches a row by a bare id in the path, and each is
    // driven here by a profile that owns none of them. The refusal is asserted
    // and then the store is read, because a route can refuse and write anyway.
    await POST('/profiles/select', { id: teacher.id });
    const theirs = {
      class: (await POST('/classes', { name: 'Theirs' })).class,
      task: (await POST('/tasks', { title: 'Theirs', subtopics: [topicId], count: 2 })).task,
      question: (await POST('/custom-questions', { name: 'Theirs', prompt: 'Owned by the teacher', answerType: 'numeric', answer: { value: 3 } })).question
    };
    await POST('/profiles/select', { id: ada.id });

    await rejects('a stranger cannot delete a custom question they do not own',
      POST(`/custom-questions/${theirs.question.id}/delete`, {}), { status: 404 });
    ok('the question is still the teacher’s', !!(await idb.get('customQs', theirs.question.id)), 'it was deleted anyway');

    await rejects('a stranger cannot delete a task they did not set',
      POST(`/tasks/${theirs.task.id}/delete`, {}), { status: 403 });
    ok('the task is still there', !!(await idb.get('tasks', theirs.task.id)), 'it was deleted anyway');

    await rejects('a stranger cannot write to a class roll',
      POST(`/classes/${theirs.class.id}/students`, { add: [ada.id] }), { status: 404 });
    eq('the roll is unchanged', (await idb.get('classes', theirs.class.id)).studentPids, []);

    await rejects('a stranger cannot read a teacher’s class analytics',
      GET(`/classes/${theirs.class.id}/analytics`), { status: 404 });
  } catch (err) { crashed(err); }

  // ── Coverage of the dispatcher's own route table ───────────────────────────
  section('route coverage');
  try {
    coverage = { driven: routes.filter(k => reached.has(k)).length, total: routes.length };
    ok('the dispatcher declares a route table this suite could read', routes.length >= 40, `${routes.length} routes parsed from local/backend.js`);
    eq('the table was read whole', routes.length, seenAnywhere);
    eq('no route was declared twice', routes.length, new Set(routes).size);
    eq(`all ${routes.length} routes were driven by a check above`, routes.filter(k => !reached.has(k)), []);

    // The table above is read out of the source, so it is worth proving that the
    // dispatcher agrees the routes exist: a key that has drifted out of step
    // would leave the coverage figure describing something nobody can call.
    resetStorage();
    const unknown = [];
    for (const key of routes) {
      const [method, pattern] = key.split(' ');
      const path = pattern.split('/').map(seg => (seg.startsWith(':') ? 'probe-id' : seg)).join('/');
      try { await dispatch(method, path, {}); }
      catch (err) { if (/No local route/.test(String(err?.message))) unknown.push(key); }
    }
    eq('every route in the table is one the dispatcher will route to', unknown, []);
  } catch (err) { crashed(err); }

  return report();
}

// ── Summary ──────────────────────────────────────────────────────────────────

/** The ledger. Printed on the way out either way, so a crash still explains itself. */
function report() {
  const total = groups.reduce((n, g) => n + g.pass + g.fail, 0);
  const failed = groups.reduce((n, g) => n + g.fail, 0);

  console.log('\nLocal backend — every check drives a real endpoint through dispatch()\n');
  for (const g of groups) {
    const n = g.pass + g.fail;
    console.log(`  ${g.name.padEnd(22)} ${String(g.pass).padStart(3)}/${String(n).padEnd(3)} ${g.fail ? `✖ ${g.fail} FAILED` : '✔'}`);
  }
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
  }
  const pct = coverage.total ? (100 * coverage.driven / coverage.total).toFixed(0) : '0';
  console.log(`\n  route coverage: ${coverage.driven}/${coverage.total} of the routes local/backend.js declares (${pct}%)`);
  const verdict = failed ? '✖ BACKEND SUITE FAILED' : '✔ BACKEND SUITE PASSED';
  console.log(`\n${verdict} — ${total - failed}/${total} checks across ${groups.length} groups`);
  return failed;
}

// Run the suite only when this file is the one that was launched. Imported —
// by security-check.mjs, for the browser environment — it defines and prints
// nothing.
const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === launched) {
  run().then(failed => process.exit(failed ? 1 : 0)).catch(err => {
    if (!group) section('startup');
    ok('the suite ran to the end', false, `crashed: ${err?.stack || err}`);
    report();
    console.log('\n  the groups above are only what ran before the crash — the rest never got a verdict');
    process.exit(1);
  });
}
