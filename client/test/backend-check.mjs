// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Local backend suite — proof for the layer a student touches.
//
// client/src/local/backend.js IS the platform: every route the UI calls lives
// there, over IndexedDB, with no server behind it. The maths engine underneath
// it carries 672,000 self-checks; this applies the same standard to the layer
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
  constructor(store, mode, transaction = null) { this.store = store; this.mode = mode; this.transaction = transaction; }
  req(work) { return this.transaction ? this.transaction.request(work) : request(work); }
  writable() { if (this.mode !== 'readwrite') throw new Error(`${this.store.name}: read-only transaction`); }
  get(key) { return this.req(() => clone(this.store.rows.get(key))); }
  getAll() { return this.req(() => this.store.ordered().map(k => clone(this.store.rows.get(k)))); }
  delete(key) {
    return this.req(() => {
      this.writable();
      this.transaction?.captureKey(this.store, key);
      this.store.rows.delete(key);
    });
  }
  clear() {
    return this.req(() => {
      this.writable();
      this.transaction?.captureStore(this.store);
      this.store.rows.clear();
    });
  }
  save(value, exclusive) {
    return this.req(() => {
      this.writable();
      this.transaction?.touchStore(this.store);
      const row = clone(value);
      let key = this.store.keyPath ? row[this.store.keyPath] : undefined;
      if (key === undefined || key === null) {
        if (!this.store.autoIncrement) throw new Error(`${this.store.name}: value carries no key`);
        key = ++this.store.seq;
        if (this.store.keyPath) row[this.store.keyPath] = key;
      } else if (typeof key === 'number' && key > this.store.seq) {
        this.store.seq = Math.floor(key);
      }
      this.transaction?.captureKey(this.store, key);
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

class FakeTransaction {
  constructor(db, names, mode = 'readonly') {
    this.db = db;
    this.names = Array.isArray(names) ? names : [names];
    this.mode = mode;
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this.pending = 0;
    this.done = false;
    this.aborted = false;
    // Real IndexedDB provides transactional rollback without copying every row
    // up front. Journal only keys this fake transaction actually mutates so a
    // multi-store answer commit does not deep-clone the whole question bank.
    this.journal = new Map();
    for (const name of this.names) {
      const store = db.stores.get(name);
      if (!store) throw new Error(`No object store "${name}"`);
    }
  }
  touchStore(store) {
    if (this.mode !== 'readwrite') return null;
    let entry = this.journal.get(store.name);
    if (!entry) {
      entry = { seq: store.seq, keys: new Map(), full: null };
      this.journal.set(store.name, entry);
    }
    return entry;
  }
  captureKey(store, key) {
    const entry = this.touchStore(store);
    if (!entry || entry.full || entry.keys.has(key)) return;
    entry.keys.set(key, store.rows.has(key)
      ? { existed: true, value: clone(store.rows.get(key)) }
      : { existed: false, value: undefined });
  }
  captureStore(store) {
    const entry = this.touchStore(store);
    if (!entry || entry.full) return;
    // clear() is the one operation that can touch every key. If earlier writes
    // happened in this transaction, rebuild the transaction-start view rather
    // than snapshotting those already-mutated rows. Ordinary put/add/delete
    // stay key-journaled and never clone an unrelated question bank.
    const full = new Map([...store.rows].map(([k, v]) => [k, clone(v)]));
    for (const [key, before] of entry.keys) {
      if (before.existed) full.set(key, clone(before.value));
      else full.delete(key);
    }
    entry.full = full;
    entry.keys.clear();
  }
  objectStore(name) {
    if (!this.names.includes(name)) throw new Error(`Store "${name}" is not in this transaction`);
    return new FakeHandle(this.db.stores.get(name), this.mode, this);
  }
  rollback() {
    if (this.mode !== 'readwrite') return;
    for (const [name, entry] of this.journal) {
      const store = this.db.stores.get(name);
      if (entry.full) {
        store.rows = new Map([...entry.full].map(([k, v]) => [k, clone(v)]));
      } else {
        for (const [key, before] of entry.keys) {
          if (before.existed) store.rows.set(key, clone(before.value));
          else store.rows.delete(key);
        }
      }
      store.seq = entry.seq;
    }
  }
  fail(err, req = null) {
    if (this.aborted || this.done) return;
    this.error = err;
    this.aborted = true;
    this.rollback();
    if (req) { req.error = err; req.onerror?.({ target: req }); }
    this.onerror?.({ target: this });
    this.onabort?.({ target: this });
  }
  request(work) {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    if (this.aborted) {
      queueMicrotask(() => this.fail(this.error || new Error('transaction aborted'), req));
      return req;
    }
    this.pending++;
    queueMicrotask(() => {
      if (this.aborted) { this.pending--; return; }
      try {
        req.result = work();
        req.onsuccess?.({ target: req });
      } catch (err) {
        this.pending--;
        this.fail(err, req);
        return;
      }
      this.pending--;
      queueMicrotask(() => {
        if (!this.aborted && !this.done && this.pending === 0) {
          this.done = true;
          this.oncomplete?.({ target: this });
        }
      });
    });
    return req;
  }
  abort() {
    this.fail(new Error('transaction aborted'));
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
    return new FakeTransaction(this, name, mode);
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

    const resumeView = await GET('/practice/resume');
    eq('Home continuity reports the exact unfinished Practice row', resumeView.resume?.questionId, first.question.id);
    eq('Home continuity labels ordinary Practice honestly', resumeView.resume?.kind, 'practice');
    eq('Home continuity points ordinary Practice back to its real route', resumeView.resume?.destination, '/practice');

    const hinted = await POST(`/practice/${first.question.id}/hint`, {});
    ok('a hint comes back as text', typeof hinted.hint === 'string' && hinted.hint.length > 0, show(hinted.hint));
    // The hint ladder (§6.5): rung 1 is the nudge whenever the payload has
    // anything authored to put on a rung (hints, or solution steps).
    eq('the first hint is rung 1 of the ladder', hinted.level, (first.payload.hints?.length || first.payload.steps?.length) ? 1 : 0);
    eq('the hint is recorded on the question', (await idb.get('questions', first.question.id)).hintsUsed, hinted.level);
    eq('the first rung leaves 90 % of the marks', hinted.markWeight, hinted.level ? 0.9 : 1);

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

    const discardTarget = await nextQuestion({ mode: 'topic', subtopic: topicId });
    const discarded = await POST(`/practice/${discardTarget.question.id}/discard`, {});
    eq('explicit Next can safely discard unfinished work', discarded.discarded, true);
    eq('discarding unfinished work writes no attempt',
      (await idb.byIndex('attempts', 'pid', ada.id)).filter(a => a.questionId === discardTarget.question.id).length, 0);
    await rejects('a discarded question cannot later be submitted',
      POST(`/practice/${discardTarget.question.id}/submit`, { answer: '1' }), { status: 409 });

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

  // ── Misconception repair is opportunity-specific (issue #232) ──────────────
  // A clean correct answer is evidence against a misconception only when the
  // question carried that misconception's designed trap or distractor. Before
  // the fix every clean answer credited every trap in the subtopic, so four
  // unrelated correct answers deleted an active misconception outright.
  section('misconception repair');
  try {
    const { getRating, putRating } = await import(`${SRC}local/store.js`);
    const { misconceptionKey, START_RATING, TRAP_ACTIVE_AT } = await import(`${SRC}engine/adaptive.js`);
    const { misconceptionIdForTrap, mappedIdForTrap, AUTHORED_TRAP_SHAPES } = await import(`${SRC}engine/misconceptions.js`);
    const { cloudLinkRowId } = await import(`${SRC}platform/cloudAccount.js`);

    const noether = (await POST('/profiles', { name: 'Emmy Noether', year: 10 })).user;
    eq('a fresh learner is selected for this group', (await GET('/me')).user.id, noether.id);
    // This group serves dozens of questions; the free daily cap is the subject
    // of entitlement-enforcement-check.mjs, so it is lifted here.
    {
      const nowMs = Date.now();
      await idb.put('device', {
        id: cloudLinkRowId(noether.id), accountId: `acct-${noether.id}`, role: 'student',
        emailVerified: true, linkedAt: nowMs, lastVerifiedAt: nowMs, lastSyncAt: null,
        entitlement: {
          plan: 'premium', status: 'active', provider: 'web',
          currentPeriodEnd: nowMs + 30 * 86400000, offlineUntil: nowMs + 7 * 86400000,
          issuedAt: nowMs, sourceVersion: 1
        }
      });
    }

    const probeKeys = (q, owner) => new Set([
      ...(Array.isArray(q.traps) ? q.traps : []),
      ...Object.values(q.answer?.optionTraps || {}).map(why => ({ why }))
    ].filter(t => t && t.why).map(t => misconceptionIdForTrap(owner, t.why)).filter(Boolean));

    /** A served, correctly answerable question that does (or does not) carry a designed slip. */
    async function servedWhere(subtopics, accept, perTopic = 6) {
      for (const sub of subtopics) {
        for (let i = 0; i < perTopic; i++) {
          const s = await nextQuestion({ mode: 'topic', subtopic: sub });
          const right = canonicalInput(s.payload);
          if (right !== null && checkAnswer(s.payload, right).correct && accept(s, sub)) return { ...s, right, sub };
          await POST(`/practice/${s.question.id}/discard`, {});
        }
      }
      return null;
    }

    /** Write an active misconception onto a subtopic's ledger, as recordTrap would leave it. */
    async function seedTrap(sub, key, label) {
      const st = (await getRating(noether.id, sub)) || { rating: START_RATING, attempts: 0, correct: 0, last_at: null };
      const now = Date.now();
      await putRating(noether.id, sub, {
        ...st, traps: { ...(st.traps || {}), [key]: { n: 3, credit: 0, firstAt: now, lastAt: now, label, dotpoint: null } }
      });
    }
    const ledger = async (sub) => (await getRating(noether.id, sub))?.traps || {};

    const year10 = subtopicsForYear(10).map(s => s.id);
    const targeted = await servedWhere(year10, (s, sub) => probeKeys(s.payload, sub).size > 0);
    if (!ok('a Year 10 question carrying a designed slip was served', !!targeted)) throw new Error('no trap-carrying question');
    const S = targeted.sub;
    const K = [...probeKeys(targeted.payload, S)][0];
    // A misconception no question in this subtopic can spring: the evidence
    // the student produces below is unrelated to it by construction.
    const A = misconceptionKey(S, 'Regression probe for issue 232: a slip that no authored question describes.');
    ok('the unrelated misconception is not an opportunity on the targeted question', !probeKeys(targeted.payload, S).has(A));
    await seedTrap(S, A, 'Unrelated slip');
    await seedTrap(S, K, 'Targeted slip');

    // A targeted, clean, unaided correct answer banks repair credit — for the
    // slip it could have shown, and for nothing else.
    const r1 = await POST(`/practice/${targeted.question.id}/submit`, { answer: targeted.right, ms: 9000 });
    eq('the targeted question was answered cleanly', [r1.correct, r1.resolved], [true, true]);
    let book = await ledger(S);
    eq('a clean targeted answer banks one repair credit on its own slip', book[K]?.credit, 1);
    eq('…and none on an unrelated slip in the same subtopic', book[A]?.credit, 0);

    // Four unrelated clean answers in the same subtopic cannot erase A.
    let unrelated = 0;
    for (let i = 0; i < 4; i++) {
      const s = await servedWhere([S], (q, sub) => !probeKeys(q.payload, sub).has(A), 10);
      if (!s) break;
      const r = await POST(`/practice/${s.question.id}/submit`, { answer: s.right, ms: 9000 });
      if (r.correct && r.resolved) unrelated++;
    }
    eq('four unrelated questions were answered cleanly', unrelated, 4);
    book = await ledger(S);
    ok('four unrelated clean answers do not delete the misconception', !!book[A], show(Object.keys(book)));
    eq('…bank it no repair credit', book[A]?.credit, 0);
    eq('…and leave its count untouched', book[A]?.n, 3);
    const named = (await GET('/stats')).misconceptions.find(m => m.key === A);
    ok('the misconception is still named on /stats', !!named && named.count >= TRAP_ACTIVE_AT, show((await GET('/stats')).misconceptions));

    // A hinted correct answer on a targeted question is support, not
    // independent repair: it banks nothing.
    const hintable = await servedWhere(year10,
      (s, sub) => probeKeys(s.payload, sub).size > 0 && Array.isArray(s.payload.hints) && s.payload.hints.length > 0);
    if (ok('a trap-carrying question with a hint was served', !!hintable)) {
      const H = [...probeKeys(hintable.payload, hintable.sub)][0];
      await seedTrap(hintable.sub, H, 'Hinted slip');
      const before = (await ledger(hintable.sub))[H]?.credit;
      await POST(`/practice/${hintable.question.id}/hint`, {});
      const r = await POST(`/practice/${hintable.question.id}/submit`, { answer: hintable.right, ms: 9000 });
      eq('the hinted targeted question was answered correctly', r.correct, true);
      eq('a hinted targeted answer banks no repair credit', (await ledger(hintable.sub))[H]?.credit, before);
    }

    // ── The same guarantees, keyed by misconception ontology ID ────────────
    // An ontology ID is shared across subtopics and detectors, so it is the
    // case most at risk of being "repaired" by evidence that never offered
    // the student the slip. It must not be.
    const mappedProbes = (q) => new Set([
      ...(Array.isArray(q.traps) ? q.traps : []),
      ...Object.values(q.answer?.optionTraps || {}).map(why => ({ why }))
    ].filter(t => t && t.why).map(t => mappedIdForTrap(t.why)).filter(Boolean));
    // An active misconception steers topic practice towards questions that
    // carry it, so seeding the ID first also proves that targeting reads IDs.
    const MS = 'y10-quadratics';
    const M = 'root-sign-from-factor';
    await seedTrap(MS, M, 'Targeted named slip');
    const mapped = await servedWhere([MS], (s) => mappedProbes(s.payload).has(M), 40);
    if (ok('an active ontology-ID misconception steers practice to a question carrying it', !!mapped)) {
      ok('its repair opportunity is the ontology ID itself, not a text hash', probeKeys(mapped.payload, MS).has(M), show([...probeKeys(mapped.payload, MS)]));
      // An ontology ID no question in this subtopic carries.
      const U = ['lost-root', 'divided-by-variable', 'negative-squared', 'function-of-sum']
        .find(id => !probeKeys(mapped.payload, MS).has(id));
      await seedTrap(MS, U, 'Unrelated named slip');
      const rm = await POST(`/practice/${mapped.question.id}/submit`, { answer: mapped.right, ms: 9000 });
      eq('the mapped question was answered cleanly', [rm.correct, rm.resolved], [true, true]);
      let named = await ledger(MS);
      eq('a clean answer carrying the mapped trap banks one credit on that ontology ID', named[M]?.credit, 1);
      eq('…and none on an unrelated ontology ID', named[U]?.credit, 0);
      let cleanUnrelated = 0;
      for (let i = 0; i < 4; i++) {
        const s = await servedWhere([MS], (q, sub) => !probeKeys(q.payload, sub).has(U), 10);
        if (!s) break;
        const r = await POST(`/practice/${s.question.id}/submit`, { answer: s.right, ms: 9000 });
        if (r.correct && r.resolved) cleanUnrelated++;
      }
      eq('four unrelated questions were answered cleanly', cleanUnrelated, 4);
      named = await ledger(MS);
      ok('an unrelated correct answer cannot erase an ontology-ID misconception', !!named[U], show(Object.keys(named)));
      eq('…banks it no credit', named[U]?.credit, 0);
      eq('…and leaves its count untouched', named[U]?.n, 3);
      const listed = (await GET('/stats')).misconceptions.find(m => m.key === U);
      eq('/stats names it by its ontology ID', listed?.id, U);
    }

    // ── The ledger migration: text-derived keys become ontology IDs ─────────
    // A device that recorded slips before the ontology holds `<owner>.t<hash>`
    // and `<owner>.step-<code>` keys. Reading the row converts them, merging
    // two records of one misconception without losing an occurrence and
    // without making it look more repaired than either record said.
    {
      const MIG = 'y10-quadratics';
      const shape = AUTHORED_TRAP_SHAPES.find(r => r.id === 'sign-on-transfer').shape;
      const legacyText = misconceptionKey(MIG, shape.replace(/#/g, '4'));
      ok('the legacy text key is the old hash form', /\.t[0-9a-z]+$/.test(legacyText), show(legacyText));
      eq('and its sentence maps to the ontology', mappedIdForTrap(shape.replace(/#/g, '4')), 'sign-on-transfer');
      const unmapped = misconceptionKey(MIG, 'A designed slip with no ontology entry, kept under its derived id.');
      const st0 = (await getRating(noether.id, MIG)) || { rating: START_RATING, attempts: 0, correct: 0, last_at: null };
      await idb.put('ratings', {
        ...st0, key: `${noether.id}:${MIG}`, pid: noether.id, subtopic: MIG,
        traps: {
          [`${MIG}.step-sign-on-transfer`]: { n: 2, credit: 1, firstAt: 1000, lastAt: 5000, label: 'step title', dotpoint: null },
          [legacyText]: { n: 3, credit: 0, firstAt: 2000, lastAt: 9000, label: 'authored sentence', dotpoint: null },
          [unmapped]: { n: 2, credit: 1, firstAt: 3000, lastAt: 4000, label: 'unmapped', dotpoint: null }
        }
      });
      const migrated = await ledger(MIG);
      eq('both legacy keys of one misconception land on one ontology ID', Object.keys(migrated).sort(), [unmapped, 'sign-on-transfer'].sort());
      eq('occurrences are summed', migrated['sign-on-transfer']?.n, 5);
      eq('the lower repair credit is kept', migrated['sign-on-transfer']?.credit, 0);
      eq('the latest sighting is kept', migrated['sign-on-transfer']?.lastAt, 9000);
      eq('the earliest first sighting is kept', migrated['sign-on-transfer']?.firstAt, 1000);
      eq('the label is the most recent display text', migrated['sign-on-transfer']?.label, 'authored sentence');
      eq('an unmapped trap keeps its derived ID and its record', migrated[unmapped], { n: 2, credit: 1, firstAt: 3000, lastAt: 4000, label: 'unmapped', dotpoint: null });
      const stM = await getRating(noether.id, MIG);
      await putRating(noether.id, MIG, stM);
      eq('the migration is idempotent once written back', await ledger(MIG), migrated);
    }

    // ── A cloud-proposed misconception: AI proposes, the engine decides ──────
    // Lines a student might write; the deterministic diagnoser names line 2 as
    // `distribute-partial` with high confidence. The question is chosen with no
    // Step Check meta of its own, so the diagnosis rests on the lines alone.
    {
      const noMeta = (q) => !q.stepcheck && !q.multipart && ['numeric', 'mcq'].includes(q.answerType)
        && !(q.answerType === 'numeric' && /^([a-z])\s*=$/i.test(q.answerPrefix || ''));
      let target = null;
      for (let i = 0; i < 40 && !target; i++) {
        const s = await nextQuestion({ mode: 'topic', subtopic: year10[i % year10.length] });
        const wrong = wrongInput(s.payload);
        if (!noMeta(s.payload) || wrong === null || checkAnswer(s.payload, wrong).correct
          || (s.payload.answerType === 'mcq' && s.payload.answer.optionTraps?.[Number(wrong)])) {
          await POST(`/practice/${s.question.id}/discard`, {});
          continue;
        }
        target = { ...s, wrong };
      }
      if (ok('a question without Step Check meta was served for the cloud-proposal check', !!target)) {
        const { diagnoseStep } = await import(`${SRC}engine/diagnose.js`);
        const lines = ['2(x + 3) = 10', '2x + 3 = 10', 'x = 3.5'];
        eq('the fixture is a high-confidence diagnosis', diagnoseStep({ prevText: lines[0], brokenText: lines[1] })?.confidence, 'high');
        const ID = 'distribute-partial';
        const propose = (extra) => POST(`/practice/${target.question.id}/misconception`, { lines, firstBreak: 1, misconceptionId: ID, confident: true, ...extra });
        await rejects('a proposal before the question is answered is refused', propose({}), { status: 409 });
        await POST(`/practice/${target.question.id}/submit`, { answer: target.wrong, ms: 4000 });
        const finalWrong = await POST(`/practice/${target.question.id}/submit`, { answer: target.wrong, ms: 4000 });
        eq('the question resolved wrong', [finalWrong.correct, finalWrong.resolved], [false, true]);
        const stored = await idb.get('questions', target.question.id);
        ok('no designed trap already claimed this question', !stored.trapKey, show(stored.trapKey));
        const owner = stored.india?.chapterId || stored.payload.subtopic;
        const before = (await ledger(owner))[ID]?.n || 0;
        const beforeMedium = (await ledger(owner))['sign-on-transfer']?.n || 0;

        const unsure = await propose({ confident: false });
        eq('an unconfident proposal is only possible', [unsure.status, unsure.recorded], ['possible', false]);
        const disagree = await propose({ misconceptionId: 'fraction-across' });
        eq('a proposal the diagnoser does not reproduce is only possible', [disagree.status, disagree.recorded], ['possible', false]);
        const wrongLine = await propose({ firstBreak: 2 });
        eq('a proposal on a line the diagnoser does not name is only possible', [wrongLine.status, wrongLine.recorded], ['possible', false]);
        const other = await propose({ misconceptionId: 'other' });
        eq('"other" names nothing', [other.status, other.recorded], [null, false]);
        // -(x + 3) = 5 → -x + 3 = 5: several slips reproduce it, so the engine
        // is only 'medium' sure; a model agreeing with its top guess must not
        // turn that guess into a record.
        const medium = await propose({ lines: ['-(x + 3) = 5', '-x + 3 = 5'], misconceptionId: 'sign-on-transfer' });
        eq('a proposal agreeing with a medium-confidence diagnosis is only possible', [medium.status, medium.recorded], ['possible', false]);
        eq('none of those moved the learner state', [(await ledger(owner))[ID]?.n || 0, (await ledger(owner))['sign-on-transfer']?.n || 0], [before, beforeMedium]);

        // Two deliveries of the same confirmed proposal at once count once.
        const [agreed, doubled] = await Promise.all([propose({}), propose({})]);
        eq('an agreed, confident, high-confidence proposal is confirmed', [agreed.status, agreed.id, agreed.line], ['confirmed', ID, 1]);
        eq('a doubled delivery records it exactly once', [agreed.recorded, doubled.recorded].filter(Boolean).length, 1);
        eq('it lands under the ontology ID', (await ledger(owner))[ID]?.n, before + 1);
        eq('and the question is marked as counted in the same write', (await idb.get('questions', target.question.id)).trapKey, ID);
        const again = await propose({});
        eq('a question records one misconception at most', [again.status, again.recorded], ['confirmed', false]);
        eq('…so a retried proposal does not double count', (await ledger(owner))[ID]?.n, before + 1);
      }
    }

    await POST('/profiles/select', { id: ada.id });
  } catch (err) { crashed(err); }

  // ── AI tutor (vision item 3) ───────────────────────────────────────────────
  // Three levels, strictly in order, each charged like a hint; the server is
  // asked only for words and only about a practice row; every failure falls
  // back to the question's own authored hint; a tutored success is supported
  // evidence, never independent.
  section('ai tutor');
  const { setTutorTransportForTests, requestTutorHelp } = await import(`${SRC}local/tutorBridge.js`);
  const tutorCalls = [];
  try {
    await POST('/profiles/select', { id: ada.id });

    // Dark by default (src/tutor/flag.js): with the feature off the routes
    // refuse before anything else and nothing reaches the transport.
    globalThis.__PRI_TUTOR_OVERRIDE__ = false;
    setTutorTransportForTests(async (body) => { tutorCalls.push(body); return { tutor: { source: 'model', message: 'should not be asked' } }; });
    const dark = await nextQuestion({});
    const darkErr = await rejects('with the tutor off, a help request is refused', POST(`/practice/${dark.question.id}/tutor`, { level: 1 }), { status: 404 });
    eq('— as disabled', darkErr?.code, 'TUTOR_DISABLED');
    await rejects('and so are captions', POST(`/practice/${dark.question.id}/tutor/captions`, { captions: [{ id: 'solution-0', text: 'x' }] }), { status: 404 });
    eq('the bridge itself refuses to call out', (await requestTutorHelp({ level: 'nudge' })).error?.code, 'TUTOR_DISABLED');
    eq('nothing reached /v1/tutor', tutorCalls.length, 0);
    eq('and nothing was charged to the question', (await idb.get('questions', dark.question.id)).tutorLevel || 0, 0);
    // On, as in development, staging and the suites that exercise it.
    globalThis.__PRI_TUTOR_OVERRIDE__ = true;
    let reply = () => ({ tutor: { source: 'model', message: 'Look at the operation in the first step.', referencesStepIndex: 0 } });
    setTutorTransportForTests(async (body) => { tutorCalls.push(body); return reply(body); });

    let target = null;
    for (let i = 0; i < 40 && !target; i += 1) {
      const q = await answerableQuestion({ mode: 'topic', subtopic: topicId });
      if (q && q.payload.steps?.length && (q.payload.hints || []).length >= 2) target = q;
    }
    if (!ok('a practice question with a worked solution and two authored hints was served', !!target)) throw new Error('ai tutor group cannot continue');
    const id = target.question.id;
    eq('a served question starts with no tutor help used', target.question.tutorLevel, 0);

    const skip = await rejects('level 2 cannot be asked for before level 1', POST(`/practice/${id}/tutor`, { level: 2 }), { status: 409 });
    eq('— with the ordering code', skip?.code, 'TUTOR_LEVEL_ORDER');
    await rejects('level 3 cannot be asked for first either', POST(`/practice/${id}/tutor`, { level: 3 }), { status: 409 });
    await rejects('captions cannot be asked for before the walkthrough', POST(`/practice/${id}/tutor/captions`, { captions: [{ id: 'solution-0', text: 'x' }] }), { status: 409 });
    await rejects('an unknown level is refused', POST(`/practice/${id}/tutor`, { level: 4 }), { status: 400 });
    eq('no refused request reached the tutor', tutorCalls.length, 0);

    const l1 = await POST(`/practice/${id}/tutor`, { level: 1, work: { lines: ['first line of working'], typed: '' }, locale: 'en' });
    eq('level 1 is a nudge from the tutor', [l1.level, l1.source, l1.message], [1, 'tutor', 'Look at the operation in the first step.']);
    eq('and is recorded on the question', (await idb.get('questions', id)).tutorLevel, 1);
    const sent = tutorCalls[0] || {};
    eq('the tutor is asked as practice, at the nudge level', [sent.context, sent.level, sent.locale], ['practice', 'nudge', 'en']);
    ok('grounded in the verified solution and its answer', sent.question?.steps?.length === target.payload.steps.length && typeof sent.question?.answer === 'string' && sent.question.answer.length > 0, show(sent.question));
    eq('with the student’s own lines', sent.studentWork?.lines, ['first line of working']);
    ok('and how many of them the deterministic checker verified', Number.isInteger(sent.studentWork?.verifiedLines), show(sent.studentWork));
    ok('and nothing that identifies the student', !/Ada|Lovelace|ada\.lovelace|"pid"|"email"|"name"/.test(JSON.stringify(sent)), JSON.stringify(sent).slice(0, 200));

    reply = () => ({ error: { code: 'TUTOR_UNAVAILABLE', status: 503 } });
    const l2 = await POST(`/practice/${id}/tutor`, { level: 2 });
    eq('a tutor outage falls back to the authored hint for that level', [l2.level, l2.source, l2.message], [2, 'deterministic', target.payload.hints[1]]);
    eq('and says why with a code', l2.code, 'TUTOR_UNAVAILABLE');
    eq('the level is still recorded — the help was shown', (await idb.get('questions', id)).tutorLevel, 2);

    reply = () => ({ tutor: { source: 'fallback', message: target.payload.hints[1], reason: 'TUTOR_ANSWER_GUARD' } });
    const again2 = await POST(`/practice/${id}/tutor`, { level: 2 });
    eq('a server-guarded fallback is shown as deterministic help', [again2.source, again2.code], ['deterministic', 'TUTOR_ANSWER_GUARD']);
    eq('asking for a used level again costs nothing more', (await idb.get('questions', id)).tutorLevel, 2);

    // Levels 1–2 leave the question open: a correct answer still counts, as
    // supported evidence with the credit of two hints.
    const right = await POST(`/practice/${id}/submit`, { answer: target.right, ms: 9000 });
    eq('a nudged question can still be answered correctly', right.correct, true);
    const attempt = (await idb.byIndex('attempts', 'pid', ada.id)).find(a => a.questionId === id);
    eq('the attempt records how much tutor help was used', attempt?.tutorLevel, 2);
    eq('and counts the success as supported, not independent', attempt?.support, 'supported');
    const { xpFor } = await import(`${SRC}engine/adaptive.js`);
    eq('the nudged success is charged like two hints', right.xp, xpFor(target.payload.difficulty, true, 0, 2));
    await rejects('an answered question takes no more help', POST(`/practice/${id}/tutor`, { level: 3 }), { status: 409 });

    // Level 3 shows the whole solution, so it resolves the question exactly as
    // Reveal does — and an assignment counts it as not correct.
    let walk = null;
    for (let i = 0; i < 40 && !walk; i += 1) {
      const q = await answerableQuestion({ mode: 'topic', subtopic: topicId });
      if (q && q.payload.steps?.length) walk = q;
    }
    if (!ok('a second question with a worked solution was served', !!walk)) throw new Error('ai tutor group cannot continue');
    const wid = walk.question.id;
    const TASK = 'task-tutor-walkthrough';
    await idb.put('tasks', { id: TASK, pid: ada.id, title: 'Tutor walkthrough task', count: 5, createdAt: Date.now() });
    await idb.put('questions', { ...(await idb.get('questions', wid)), taskId: TASK });
    const ratingBefore = (await idb.get('ratings', `${ada.id}:${topicId}`))?.rating;
    await POST(`/practice/${wid}/tutor`, { level: 1 });
    await POST(`/practice/${wid}/tutor`, { level: 2 });
    const callsBefore3 = tutorCalls.length;
    const l3 = await POST(`/practice/${wid}/tutor`, { level: 3, ms: 4000 });
    eq('level 3 is the deterministic walkthrough', [l3.tutorLevel, l3.source], [3, 'deterministic']);
    eq('of the verified solution', l3.walkthrough?.solution?.steps?.length, walk.payload.steps.length);
    eq('without asking the model for any maths', tutorCalls.length, callsBefore3);
    eq('and it resolves the question like Reveal: not correct', [l3.resolved, l3.revealed, l3.correct], [true, true, false]);
    const resolvedRow = await idb.get('questions', wid);
    eq('the row is answered and its resolution is not correct', [resolvedRow.answered, resolvedRow.resolution?.correct], [1, false]);
    const submitted = await rejects('the answer cannot be submitted after watching it', POST(`/practice/${wid}/submit`, { answer: walk.right, ms: 1000 }), { status: 409 });
    ok('— refused as already answered', /already answered/i.test(String(submitted?.message)), show(submitted?.message));
    const walkAttempts = (await idb.byIndex('attempts', 'pid', ada.id)).filter(a => a.questionId === wid);
    eq('exactly one attempt is recorded for it', walkAttempts.length, 1);
    eq('and it is not correct, with all three levels recorded', [walkAttempts[0]?.correct, walkAttempts[0]?.answerGiven, walkAttempts[0]?.tutorLevel, walkAttempts[0]?.support],
      [0, 'revealed', 3, 'supported']);
    const progress = await idb.get('taskProgress', `${TASK}:${ada.id}`);
    eq('the assignment counts it as done and not correct', [progress?.done, progress?.correct], [1, 0]);
    const ratingAfter = (await idb.get('ratings', `${ada.id}:${topicId}`))?.rating;
    ok('the rating does not rise from watching the answer', ratingAfter <= ratingBefore, `${ratingBefore} → ${ratingAfter}`);

    reply = body => ({ tutor: { source: 'model', captions: body.captions.map((c, i) => ({ id: c.id, text: i === 0 ? 'Rephrased.' : c.text, source: i === 0 ? 'model' : 'deterministic' })) } });
    const caps = await POST(`/practice/${wid}/tutor/captions`, { captions: [{ id: 'solution-0', text: 'Step one' }, { id: 'solution-1', text: 'Step two' }] });
    eq('rephrased captions come back by id, the rest deterministic', caps.captions.map(c => [c.id, c.source]), [['solution-0', 'tutor'], ['solution-1', 'deterministic']]);
    eq('the walkthrough request carries the captions', tutorCalls.at(-1)?.level, 'walkthrough');

    // Offline: the real bridge with no cloud configured.
    setTutorTransportForTests(null);
    const hintOnly = await answerableQuestion({ mode: 'topic', subtopic: topicId });
    const offline = await POST(`/practice/${hintOnly.question.id}/tutor`, { level: 1 });
    eq('offline, level 1 is the first authored hint', [offline.source, offline.code], ['deterministic', 'TUTOR_OFFLINE']);
    eq('with its text', offline.message, (hintOnly.payload.hints || [])[0] ?? null);
    setTutorTransportForTests(async (body) => { tutorCalls.push(body); return reply(body); });

    const clean = await answerableQuestion({ mode: 'topic', subtopic: topicId });
    await POST(`/practice/${clean.question.id}/submit`, { answer: clean.right, ms: 9000 });
    const cleanAttempt = (await idb.byIndex('attempts', 'pid', ada.id)).find(a => a.questionId === clean.question.id);
    eq('an unaided first-try success is independent evidence', [cleanAttempt?.tutorLevel, cleanAttempt?.support], [0, 'independent']);
  } catch (err) { crashed(err); }
  finally { setTutorTransportForTests(null); }

  // ── AI tutor · conversation ────────────────────────────────────────────────
  // The student's own question (POST /practice/:id/tutor/ask, built in
  // src/tutor/askRoute.js): refused on an exam row and before level 1, grounded
  // here with the verified solution the panel never sees, streamed sentence by
  // sentence as pri:tutor-delta events, costing no further credit, and every
  // failure falls back to the authored hint for that turn of the exchange.
  section('ai tutor · conversation');
  const { setConversationTransportForTests } = await import(`${SRC}tutor/conversation.js`);
  const askCalls = [];
  const deltas = [];
  const hadDispatch = 'dispatchEvent' in globalThis;
  const priorDispatch = globalThis.dispatchEvent;
  try {
    await POST('/profiles/select', { id: ada.id });
    globalThis.__PRI_TUTOR_OVERRIDE__ = true;
    // Deltas reach the panel as window events; here the window is this test.
    globalThis.dispatchEvent = event => { deltas.push(event?.detail); return true; };
    let askReply = async (body, { onEvent }) => {
      for (const [event, data] of [['meta', { level: 'ask' }], ['delta', { text: 'Think about what is attached to the unknown. ' }], ['delta', { text: 'What would undo it?' }],
        ['done', { level: 'ask', message: 'Think about what is attached to the unknown. What would undo it?', source: 'model', cached: false }]]) onEvent({ event, data });
    };
    setConversationTransportForTests({
      tutorStream: async (body, options) => { askCalls.push(body); return askReply(body, options); },
      tutorHelp: async body => { askCalls.push({ ...body, via: 'help' }); return { tutor: { level: 'ask', message: 'Plain words.', source: 'model' } }; }
    });

    let target = null;
    for (let i = 0; i < 40 && !target; i += 1) {
      const q = await answerableQuestion({ mode: 'topic', subtopic: topicId });
      if (q && q.payload.steps?.length && (q.payload.hints || []).length >= 2) target = q;
    }
    if (!ok('a practice question with a worked solution and two authored hints was served', !!target)) throw new Error('conversation group cannot continue');
    const id = target.question.id;

    const early = await rejects('a question cannot be asked before level 1 is open', POST(`/practice/${id}/tutor/ask`, { message: 'why?' }), { status: 409 });
    eq('— with the level-order code, pointing at level 1', [early?.code, early?.next], ['TUTOR_LEVEL_ORDER', 1]);
    await POST(`/practice/${id}/tutor`, { level: 1 });
    await rejects('an empty question is refused', POST(`/practice/${id}/tutor/ask`, { message: '\u0000  ' }), { status: 400 });
    eq('no refused question reached the server', askCalls.length, 0);

    const turnId = 'turn-backend-1';
    const r1 = await POST(`/practice/${id}/tutor/ask`, { message: 'Why\u0000 do we undo the last operation first?', history: [{ role: 'tutor', text: 'Look at the operation.' }], locale: 'en', work: { lines: ['first line'], typed: '' }, turnId });
    eq('a model reply is the tutor\'s, streamed', [r1.source, r1.streamed, r1.code, r1.message], ['tutor', true, null, 'Think about what is attached to the unknown. What would undo it?']);
    eq('each released sentence was published to the panel under the turn id', deltas, [{ turnId, text: 'Think about what is attached to the unknown. ' }, { turnId, text: 'What would undo it?' }]);
    eq('the panel gets the exchange back, trimmed, to send next time', r1.history.map(t => t.role), ['tutor', 'student', 'tutor']);
    eq('with the student\'s question cleaned of control characters', r1.history[1].text, 'Why do we undo the last operation first?');
    const sent = askCalls[0] || {};
    eq('the server is asked as practice, at the conversational level, with the cleaned message', [sent.context, sent.level, sent.message], ['practice', 'ask', 'Why do we undo the last operation first?']);
    eq('and the history the panel sent', sent.history, [{ role: 'tutor', text: 'Look at the operation.' }]);
    ok('grounded here in the verified solution and answer', Array.isArray(sent.question?.steps) && sent.question.steps.length > 0 && !!sent.question?.answer, show(sent.question));
    ok('with the student\'s own working', Array.isArray(sent.studentWork?.lines) && sent.studentWork.lines[0] === 'first line', show(sent.studentWork));
    ok('and nothing that identifies the student', !/Ada|Lovelace|ada\.lovelace|"pid"|"email"|"name"/.test(JSON.stringify(sent)), JSON.stringify(sent).slice(0, 200));
    eq('a conversation costs no further credit: the row still shows level 1', (await idb.get('questions', id)).tutorLevel, 1);

    askReply = async () => { throw Object.assign(new Error('offline'), { code: 'TUTOR_OFFLINE' }); };
    const r2 = await POST(`/practice/${id}/tutor/ask`, { message: 'and then?', history: r1.history });
    // Two tutor turns are already in the history, so this is the third hint — or the last one the question has.
    eq('a failed turn falls back to the authored hint for this turn of the exchange', [r2.source, r2.code, r2.message],
      ['deterministic', 'TUTOR_OFFLINE', target.payload.hints[Math.min(2, target.payload.hints.length - 1)]]);
    askReply = async (body, { onEvent }) => { onEvent({ event: 'meta', data: {} }); onEvent({ event: 'fallback', data: { level: 'ask', message: target.payload.hints[0], source: 'fallback', reason: 'TUTOR_ANSWER_GUARD' } }); };
    const r3 = await POST(`/practice/${id}/tutor/ask`, { message: 'just tell me' });
    eq('a server-guarded fallback is shown as deterministic help with the guard reason', [r3.source, r3.code, r3.message], ['deterministic', 'TUTOR_ANSWER_GUARD', target.payload.hints[0]]);
    askReply = async () => { throw Object.assign(new Error('old server'), { code: 'TUTOR_STREAM_UNSUPPORTED', status: 404 }); };
    const r4 = await POST(`/practice/${id}/tutor/ask`, { message: 'does the old route still work?' });
    eq('a server without the stream route is asked through /v1/tutor/help instead', [r4.source, r4.streamed, r4.message, askCalls.at(-1)?.via, askCalls.at(-1)?.level], ['tutor', false, 'Plain words.', 'help', 'ask']);

    await POST(`/practice/${id}/submit`, { answer: target.right, ms: 9000 });
    await rejects('an answered question takes no more questions', POST(`/practice/${id}/tutor/ask`, { message: 'now?' }), { status: 409 });

    globalThis.__PRI_TUTOR_OVERRIDE__ = false;
    const dark = await answerableQuestion({ mode: 'topic', subtopic: topicId });
    const darkErr = await rejects('with the tutor off, a question is refused', POST(`/practice/${dark.question.id}/tutor/ask`, { message: 'x' }), { status: 404 });
    eq('— with the tutor-disabled code', darkErr?.code, 'TUTOR_DISABLED');
    globalThis.__PRI_TUTOR_OVERRIDE__ = true;
  } catch (err) { crashed(err); }
  finally {
    setConversationTransportForTests(null);
    if (hadDispatch) globalThis.dispatchEvent = priorDispatch; else delete globalThis.dispatchEvent;
  }

  // ── Exams ──────────────────────────────────────────────────────────────────
  section('exams');
  try {
    // This group exercises the paper builder and its marking, not the free
    // tier, which allows one simulation every 30 days and is covered by
    // entitlement-enforcement-check.mjs. Give this profile a server-issued
    // Premium snapshot so the cap is not what is under test here.
    {
      const { cloudLinkRowId } = await import(`${SRC}platform/cloudAccount.js`);
      const nowMs = Date.now();
      const examinee = (await GET('/me')).user.id;
      await idb.put('device', {
        id: cloudLinkRowId(examinee), accountId: `acct-${examinee}`, role: 'student',
        emailVerified: true, linkedAt: nowMs, lastVerifiedAt: nowMs, lastSyncAt: null,
        entitlement: {
          plan: 'premium', status: 'active', provider: 'web',
          currentPeriodEnd: nowMs + 30 * 86400000,
          offlineUntil: nowMs + 7 * 86400000,
          issuedAt: nowMs, sourceVersion: 1
        }
      });
    }
    created = (await POST('/exams', { length: 10, minutes: 30 })).exam;
    ok('an exam is built with at least the length asked for', created.questions.length >= 10, `${created.questions.length} questions`);
    eq('the exam keeps its duration', created.durationMin, 30);
    ok('the exam is titled', /Practice Paper/.test(created.title), show(created.title));
    eq('a fresh exam has no score', created.score, null);
    eq('no exam question leaks its answer', created.questions.filter(q => q.answer !== undefined).length, 0);

    const paper = await GET(`/exams/${created.id}/paper`);
    eq('the printable paper has every question', paper.questions.length, created.questions.length);
    eq('the paper of an unsubmitted exam withholds model answers (#230)', paper.questions.filter(q => q.answerText !== undefined).length, 0);
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
    const markedPaper = await GET(`/exams/${created.id}/paper`);
    eq('once submitted, the paper carries a model answer for each', markedPaper.questions.filter(q => q.answerText === undefined && !q.multipart).length, 0);
    // What the printed sheet tells a student is the answer must be what the
    // marker accepts: each printed single answer, typed back in the way a
    // student would (without the prefix/unit the answer row already shows),
    // is marked correct against its own stored question.
    {
      const { checkAnswer } = await import(new URL('engine/checker.js', SRC).href);
      const payloads = [];
      for (const qid of (await idb.get('exams', created.id)).questionIds) {
        const row = await idb.get('questions', qid);
        if (row?.payload) payloads.push(row.payload);
      }
      const refused = [];
      markedPaper.questions.forEach((pq, i) => {
        const q = payloads[i];
        if (pq.multipart || !q || q.multipart) return;
        let typed = String(pq.answerText ?? '');
        if (q.answerType === 'mcq') typed = String((q.mcqOptions || []).indexOf(typed));
        else {
          if (q.answerPrefix && typed.startsWith(q.answerPrefix)) typed = typed.slice(q.answerPrefix.length).trim();
          if (q.answerSuffix && typed.endsWith(q.answerSuffix)) typed = typed.slice(0, -q.answerSuffix.length).trim();
        }
        if (!checkAnswer(q, typed)?.correct) refused.push(`Q${i + 1} ${q.answerType} ${JSON.stringify(pq.answerText)}`);
      });
      eq('every printed single answer is accepted by the marker for its own question', refused, []);
    }
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
    // The exam room's autosave is refused once a paper is finalised: nothing
    // written after the submit can reach the marked paper (exam-session-check
    // drives the whole clock; this proves the legacy route shares the rule).
    await rejects('a finalised paper refuses an autosave',
      POST(`/exams/${blankExam.id}/responses`, { answers: { [blankExam.questions[0].id]: '1' } }), { status: 409 });

    const examList = (await GET('/exams')).exams;
    eq('both exams are listed', examList.length, 2);
    eq('the list carries the scores', examList.filter(e => e.finished_at && e.total > 0).length, 2);
    await rejects('an unknown exam is a 404', GET('/exams/not-a-real-id'), { status: 404 });
  } catch (err) { crashed(err); }

  // ── Exam boundary (issue #230) ─────────────────────────────────────────────
  // Exam questions share the `questions` store with practice. The ExamRoom UI
  // never offers hints or solutions mid-paper, but that is not the authority:
  // these checks call the practice and history routes directly with the ids of
  // an active paper's questions, and every one must fail closed without
  // touching the row, the student's attempts or their review schedule.
  section('exam boundary');
  try {
    const me = (await GET('/me')).user.id;
    const active = (await POST('/exams', { length: 10, minutes: 30 })).exam;
    const stored = await idb.get('exams', active.id);
    const rows = [];
    for (const qid of stored.questionIds) rows.push(await idb.get('questions', qid));
    const single = rows.find(r => r && !r.payload.multipart);
    const multi = rows.find(r => r && r.payload.multipart);
    ok('the active paper has a single-answer question to probe', !!single);
    ok('the active paper has a multipart question to probe', !!multi);

    // Home continuity must never offer an active exam's question as practice to
    // resume — even when it is the newest unanswered row, and even a row that
    // is marked exam only by mode (KALP-04 × #230).
    const paperIds = new Set(stored.questionIds);
    const resumeDuringExam = await GET('/practice/resume');
    ok('Home continuity never offers an active exam question as practice to resume',
      !paperIds.has(resumeDuringExam.resume?.questionId), show(resumeDuringExam.resume));
    if (single) {
      const modeOnly = { ...single, id: `${single.id}-modeonly`, examId: null, mode: 'exam', createdAt: Date.now() + 60000 };
      await idb.put('questions', modeOnly);
      const resumeModeOnly = await GET('/practice/resume');
      ok('a row marked exam only by its mode is not offered for resume either',
        resumeModeOnly.resume?.questionId !== modeOnly.id, show(resumeModeOnly.resume));
      await idb.del('questions', modeOnly.id);
    }

    const attemptsBefore = (await idb.byIndex('attempts', 'pid', me)).length;
    const reviewsBefore = JSON.stringify(await idb.byIndex('reviews', 'pid', me));

    const locked = async (name, promise) => {
      const err = await rejects(name, promise, { status: 403 });
      eq(`${name} — with the exam-lock code`, err?.code, 'EXAM_QUESTION_LOCKED');
      const leaked = err && ['solution', 'hint', 'answerText', 'steps'].filter(k => k in err);
      eq(`${name} — and nothing of the solution rides on the error`, leaked || [], []);
    };

    const { setTutorTransportForTests: setExamTutor } = await import(`${SRC}local/tutorBridge.js`);
    const { setConversationTransportForTests: setExamAsk } = await import(`${SRC}tutor/conversation.js`);
    const examTutorCalls = [];
    setExamTutor(async body => { examTutorCalls.push(body); return { tutor: { source: 'model', message: 'leak' } }; });
    setExamAsk({ tutorHelp: async body => { examTutorCalls.push(body); return { tutor: { source: 'model', message: 'leak' } }; } });
    for (const [label, row] of [['single', single], ['multipart', multi]]) {
      if (!row) continue;
      const id = row.id;
      await locked(`a ${label} active exam question cannot take a practice hint`, POST(`/practice/${id}/hint`, {}));
      await locked(`a ${label} active exam question cannot take AI tutor help`, POST(`/practice/${id}/tutor`, { level: 1 }));
      await locked(`a ${label} active exam question cannot take a tutor walkthrough caption`, POST(`/practice/${id}/tutor/captions`, { captions: [{ id: 'solution-0', text: 'x' }] }));
      await locked(`a ${label} active exam question cannot be asked about in the tutor conversation`, POST(`/practice/${id}/tutor/ask`, { message: 'what is the answer?' }));
      await locked(`a ${label} active exam question cannot be revealed through practice`, POST(`/practice/${id}/reveal`, { ms: 1000 }));
      await locked(`a ${label} active exam question cannot be marked through practice`,
        POST(`/practice/${id}/submit`, { answer: row.payload.multipart ? '0' : (canonicalInput(row.payload) ?? '0'), ms: 1000 }));
      await locked(`a ${label} active exam question cannot be skipped through practice`, POST(`/practice/${id}/discard`, {}));
      await locked(`a ${label} active exam question has no history detail yet`, GET(`/history/${id}/detail`));
      await locked(`a ${label} active exam question cannot be retried as practice`, POST(`/history/${id}/retry`, { variant: 'same' }));
      const after = await idb.get('questions', id);
      eq(`the ${label} exam row is untouched by every refused call`,
        { hintsUsed: after.hintsUsed, tutorLevel: after.tutorLevel || 0, answered: after.answered, tries: after.tries, discardedAt: after.discardedAt ?? null, mode: after.mode },
        { hintsUsed: 0, tutorLevel: 0, answered: 0, tries: 0, discardedAt: null, mode: 'exam' });
    }
    setExamTutor(null);
    setExamAsk(null);
    eq('the AI tutor was never called for an active exam question — refused locally, before any network', examTutorCalls.length, 0);
    eq('no attempt was recorded from an active exam question', (await idb.byIndex('attempts', 'pid', me)).length, attemptsBefore);
    eq('no review schedule moved from an active exam question', JSON.stringify(await idb.byIndex('reviews', 'pid', me)), reviewsBefore);

    // A row that says it is an exam question but whose paper cannot be found is
    // not "finished": review stays shut rather than defaulting open.
    if (single) {
      const orphan = { ...single, id: `${single.id}-orphan`, examId: 'no-such-exam' };
      await idb.put('questions', orphan);
      await locked('an exam question whose paper is missing stays locked', GET(`/history/${orphan.id}/detail`));
      await locked('an orphaned exam question still refuses practice hints', POST(`/practice/${orphan.id}/hint`, {}));
      await idb.del('questions', orphan.id);
    }

    // The printable paper of a paper still being sat is a question paper only:
    // no answers, worked steps or marking criteria for any question or part.
    const solutionKeys = o => ['answerText', 'steps', 'criteria'].filter(k => o && o[k] !== undefined);
    const openPaper = await GET(`/exams/${active.id}/paper`);
    eq('the printable paper of an active exam says solutions are not available', openPaper.solutionsAvailable, false);
    eq('the printable paper of an active exam carries no answers, steps or criteria',
      openPaper.questions.flatMap((q, i) => [...solutionKeys(q).map(k => `Q${i + 1}.${k}`),
        ...(q.parts || []).flatMap(pt => solutionKeys(pt).map(k => `Q${i + 1}(${pt.key}).${k}`))]), []);
    ok('the printable paper of an active exam still shows every question with its marks',
      openPaper.questions.length === stored.questionIds.length && openPaper.questions.every(q => q.multipart ? q.parts.every(pt => pt.marks > 0) : q.marks > 0));

    // The exam's own contract still works, and finishing it is what opens review.
    const done = await POST(`/exams/${active.id}/submit`, { answers: {}, ms: 60000 });
    ok('the paper is still marked through the exam route', done.total > 0, `total ${done.total}`);
    if (single) {
      const detail = await GET(`/history/${single.id}/detail`);
      ok('after submission the worked solution opens in review', !!detail.solution?.answerText, show(detail.solution));
      await locked('after submission the practice hint route still refuses an exam question', POST(`/practice/${single.id}/hint`, {}));
      await locked('after submission the practice marker still refuses an exam question',
        POST(`/practice/${single.id}/submit`, { answer: canonicalInput(single.payload) ?? '0', ms: 1000 }));
    }
    const donePaper = await GET(`/exams/${active.id}/paper`);
    eq('after submission the printable paper offers solutions', donePaper.solutionsAvailable, true);
    ok('after submission the printable paper carries the worked answers',
      donePaper.questions.every(q => q.multipart ? q.parts.every(pt => pt.answerText !== undefined && Array.isArray(q.criteria)) : (q.answerText !== undefined && Array.isArray(q.criteria))));
    if (multi) {
      const detail = await GET(`/history/${multi.id}/detail`);
      ok('after submission a multipart solution opens in review', Array.isArray(detail.solution?.parts) && detail.solution.parts.length > 0, show(detail.solution));
    }
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
    // §6.7 the error notebook: every wrong practice answer, filed, with a twin.
    const notebook = await GET('/notebook');
    ok('the notebook files the wrong answers History shows', Array.isArray(notebook.entries) && notebook.entries.reduce((a, g) => a + g.count, 0) >= 1, show(notebook.entries?.length));
    const filed = notebook.entries.flatMap(g => g.items).find(i => i.canTwin);
    if (ok('a filed answer offers a twin', !!filed)) {
      const twin = await POST(`/notebook/${filed.id}/twin`, {});
      ok('the twin is a new question row', twin.question.id && twin.question.id !== filed.id);
      eq('the twin keeps the difficulty', twin.question.difficulty, filed.difficulty);
      ok('the twin is a different question', twin.question.prompt !== filed.prompt || twin.twin.distinct === true);
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

  // ── Bulk roster import ─────────────────────────────────────────────────────
  // A pasted or CSV roster: names already on this device join, unknown names
  // become password-free student profiles, and the teacher never signs out.
  section('roster');
  try {
    const rosterClass = (await POST('/classes', { name: 'Class 9 B' })).class;
    const roster = await POST(`/classes/${rosterClass.id}/roster`, {
      rows: ['Ada Lovelace', { name: 'Srinivasa Ramanujan', class: 9, track: 'cbse' }, '', { name: 'ada lovelace' }]
    });
    eq('a roster name matching a profile on this device joins the class', roster.matched, 1);
    eq('an unknown roster name becomes a new student profile', roster.created, 1);
    eq('a blank row is skipped', roster.skipped, 1);
    eq('the class roll holds each student once', roster.class.studentPids.length, 2);
    const made = (await idb.all('profiles')).find(x => x.name === 'Srinivasa Ramanujan');
    eq('the new profile is a student on the India syllabus in the class the row named',
      [made?.role, made?.course, made?.year, made?.indiaTrack, made?.rosteredBy], ['student', 'in', 9, 'cbse', teacher.id]);
    eq('the teacher stays signed in', (await GET('/me')).user.id, teacher.id);
    eq('the roll the teacher sees carries the new student', (await GET('/classes')).classes.find(c => c.id === rosterClass.id).students.length, 2);
    await rejects('a roster for a class the teacher does not run is a 404', POST('/classes/not-real/roster', { rows: ['X'] }), { status: 404 });
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
    // A restored paper is a second copy, so it is found by what identifies the
    // paper rather than by the id: the id belongs to the ORIGINAL profile's row
    // and reusing it is what used to take that row — and the questions and
    // handwriting hanging off it — away from the profile that owns it.
    const restoredExam = reexport.stores.exams.find(e => e.title === created.title);
    ok('the marked exam survived with its score', restoredExam && restoredExam.score === marked.score, show(restoredExam?.score));
    eq('the blank exam survived too', reexport.stores.exams.find(e => e.title === blankExam.title)?.score, 0);
    ok('the exam kept its marking detail', Array.isArray(restoredExam?.detail) && restoredExam.detail.length === marked.detail.length, show(restoredExam?.detail?.length));
    ok('no restored exam reuses an id the source profile still holds',
      reexport.stores.exams.every(e => e.id !== created.id && e.id !== blankExam.id),
      show(reexport.stores.exams.map(e => e.id)));
    ok('the restored exam lists question ids the source profile does not hold',
      Array.isArray(restoredExam?.questionIds) && restoredExam.questionIds.length > 0 &&
      restoredExam.questionIds.every(qid => !backup.stores.questions.some(q => q.id === qid)),
      show(restoredExam?.questionIds?.length));
    ok('the restored exam still names its own questions',
      restoredExam.questionIds.every(qid => reexport.stores.questions.some(q => q.id === qid)),
      'a restored exam pointed at a question the restored profile does not have');
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

  // ── Placement check ────────────────────────────────────────────────────────
  // The full behaviour is client/test/placement-check.mjs; here every route is
  // driven once so the coverage figure stays whole, and the boundary that
  // matters most is re-asserted: a diagnostic writes no attempt or rating.
  section('placement');
  try {
    const before = await idb.get('profiles', ada.id);
    const placed = (await POST('/profiles', { name: 'Placement Student', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
    eq('a new India profile has no placement yet', (await GET('/placement')).status, 'none');
    const s = await POST('/placement/start', {});
    ok('start serves a question without its answer', !!s.question?.id && !('answer' in s.question));
    const a = await POST(`/placement/${s.question.id}/answer`, { skip: true });
    ok('an answer is marked and the next question served', a.resolved === true && a.correct === false && (a.done || !!a.next?.id));
    await POST('/placement/skip', {});
    eq('no attempt rows were written by the diagnostic', (await idb.byIndex('attempts', 'pid', placed.id)).length, 0);
    eq('no rating rows were written by the diagnostic', (await idb.byIndex('ratings', 'pid', placed.id)).length, 0);
    await POST('/profiles/select', { id: ada.id });
    eq('the other profile is untouched', (await idb.get('profiles', ada.id)).placement ?? null, before.placement ?? null);
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
