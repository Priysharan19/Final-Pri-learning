// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one practice attempt, one cloud learning event (§09/§22)
//
// End to end across the device/server boundary: the shipped local backend,
// the browser IndexedDB, the actual verified student session and the real /v1
// question/grading middleware. SQLite by default, disposable Postgres via
// --engine=postgres. No local grade or answer-key substitution is permitted.
//
// The updated server-first contract commits an authoritative receipt and
// exactly-one graded-attempt event BEFORE a device database write. Interruptions
// or crashes during that write must not lose, invent or duplicate the server
// grade. The published question is solved independently in the test fixture.
//   1. server grade committed, device API acknowledgement lost -> same receipt
//   2. client IndexedDB write fails AFTER server COMMIT -> safe replay
//   3. wrong try, resolving try, same-key replays -> one server progress event
//   4. further syncing cannot create another authoritative grade
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-attempt-sync-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '77'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail, absorbCookies, cookieHeader } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const c = checks();
const app = await startApp({ engine: requestedEngine() });
const db = app.db;

// ── The device ───────────────────────────────────────────────────────────────
const { installBrowserEnv, resetStorage } = await import('../../client/test/backend-check.mjs');
installBrowserEnv(); resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = app.origin;

// A browser's cookie jar for the device's own requests (credentials:
// 'include'); the harness's requests carry their own jar and pass untouched.
const deviceJar = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (options.credentials !== 'include') return realFetch(url, options);
  const headers = { ...(options.headers || {}) };
  const cookies = cookieHeader(deviceJar);
  if (cookies) headers.Cookie = cookies;
  const { credentials: _c, cache: _k, redirect: _r, ...rest } = options;
  const response = await realFetch(url, { ...rest, headers, redirect: 'manual' });
  absorbCookies(response, deviceJar);
  return response;
};
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { get cookie() { return Object.entries(deviceJar).map(([k, v]) => `${k}=${v}`).join('; '); } };
}

const { api } = await import('../../client/src/api.js');
const { dispatch } = await import('../../client/src/local/backend.js');
const idb = await import('../../client/src/local/idb.js');
const { loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { loginCloudAccount } = await import('../../client/src/platform/cloudAccount.js');
const { syncNow } = await import('../../client/src/platform/syncWorker.js');
await loadAllBanks();

// The same crash injection the client suite uses: the next transaction that
// writes the attempt and the cloud queue row dies on the queue write.
const database = await new Promise((resolve, reject) => {
  const req = globalThis.indexedDB.open('pri-learning');
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
let crashQueueWrite = false;
const realTransaction = database.transaction.bind(database);
database.transaction = (stores, mode) => {
  const tr = realTransaction(stores, mode);
  const list = Array.isArray(stores) ? stores : [stores];
  if (crashQueueWrite && mode === 'readwrite' && list.includes('device') && list.includes('attempts')) {
    crashQueueWrite = false;
    const objectStore = tr.objectStore.bind(tr);
    tr.objectStore = (name) => {
      const st = objectStore(name);
      if (name !== 'device') return st;
      return new Proxy(st, {
        get(target, prop) {
          if (prop === 'put') return () => { throw new Error('simulated crash while committing'); };
          const v = target[prop];
          return typeof v === 'function' ? v.bind(target) : v;
        }
      });
    };
  }
  return tr;
};

// Solve the PUBLIC one-variable linear equation independently of hidden server
// answers. No solution, grading key or deterministic grader is read by the client.
function solvePublishedLinear(prompt) {
  // An independent elementary algebra oracle from the visible prompt only.
  // Understand the published equation, not its server-secret answer key.
  const equation = String(prompt || '').match(/\$([^$]+)\$/)?.[1];
  if (!equation || equation.split('=').length !== 2) return null;
  function parse(raw) {
    // LaTeX fractions are plain rational factors. These generated equations
    // use constant denominators; a variable denominator is not linear.
    const expression = raw.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))')
      .replace(/\s+/g, '');
    const token = expression.match(/(?:\d+(?:\.\d*)?|\.\d+|[a-z]|[()+*/-])/gi);
    if (!token || token.join('') !== expression) return null;
    let cursor = 0;
    const value = (c, x=0) => ({c,x});
    function plus(a,b){return value(a.c+b.c,a.x+b.x);}
    function multiply(a,b){
      if (Math.abs(a.x*b.x)>1e-10) throw Error('nonlinear term');
      return value(a.c*b.c,a.c*b.x+a.x*b.c);
    }
    function factor() {
      const t=token[cursor++];
      if(t==='-'){const v=factor();return value(-v.c,-v.x);}
      if(t==='+') return factor();
      if(t==='('){const v=sum();if(token[cursor++]!==')')throw Error('brackets');return v;}
      if(t && (/^\d/.test(t) || /^\.\d/.test(t))) return value(Number(t));
      if(t && /^[a-z]$/i.test(t)) return value(0,1);
      throw Error('bad token');
    }
    function product(){
      let v=factor();
      while(cursor<token.length){
        const t=token[cursor];
        if(t==='*' || t==='/'){
          cursor++;
          const b=factor();
          if(t==='*')v=multiply(v,b);
          else{
            if(Math.abs(b.x)>1e-10 || Math.abs(b.c)<1e-10)throw Error('not linear fraction');
            v=value(v.c/b.c,v.x/b.c);
          }
        } else if(t==='(' || /^(?:\d|[a-z]|\.)/i.test(t)){
          v=multiply(v,factor()); // implicit multiplication such as 3x, 2(x+1)
        } else break;
      }
      return v;
    }
    function sum(){
      let v=product();
      while(token[cursor]==='+' || token[cursor]==='-'){
        const sign=token[cursor++]==='+'?1:-1;
        const b=product();
        v=plus(v,value(b.c*sign,b.x*sign));
      }
      return v;
    }
    try{
      const solved=sum();
      return cursor===token.length?solved:null;
    }catch{return null;}
  }
  const [left,right]=equation.split('=').map(parse);
  if(!left || !right || Math.abs(left.x-right.x)<1e-10)return null;
  const answer=(right.c-left.c)/(left.x-right.x);
  return Number.isFinite(answer) ? String(Number(answer.toFixed(9))) : null;
}
async function markable() {
  for (let i = 0; i < 60; i++) {
    const s = await api.post('/practice/next', {
      mode:'topic', subtopic:'c8-linear-equations-both-sides',
      difficulty:2, dotpoint:1, track:'cbse', resume:false
    });
    const local = await idb.get('questions', s.question.id);
    const right = solvePublishedLinear(s.question.prompt);
    const wrong = right === null ? null : String(Number(right)+7);
    if (s.question.answerType === 'numeric' && right !== null && wrong !== null && local.serverQuestionId) {
      return { id:s.question.id, serverId:local.serverQuestionId, right, wrong };
    }
    await api.post('/practice/'+s.question.id+'/discard',{});
  }
  throw new Error('no server-issued markable public linear question was served');
}

try {
  // ── An account on the server, a profile on the device, linked ─────────────
  const email = 'attempt.sync@example.test';
  const password = 'correct-horse-battery';
  const reg = await registerAccount(app, { email, password, name: 'Attempt Sync', deviceId: 'ipad-attempt-sync' });
  c.eq(reg.status, 201, 'a student account exists on the server');
  const accountId = reg.account.id;
  const verified = await verifyEmail(app, accountId);
  c.ok(verified.status === 200, `its email is verified (${verified.status})`);

  const me = (await api.post('/profiles', { name: 'Attempt Sync', year: 8, course: 'in', indiaTrack: 'cbse' })).user;
  await loginCloudAccount(me.id, { email, password });
  const first = await syncNow(me.id);
  c.eq(first.requiresFullRescan, false, 'the first sync reconciles the new profile');

  const serverEvents = async (localId) => {
    const local = await idb.get('questions', localId);
    return db.all(
      "SELECT id, kind FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'",
      [accountId, local.serverQuestionId]
    );
  };

  // ── 1 · server committed, device loses acknowledgement ──────────────────
  const a = await markable();
  const committed = await dispatch('POST', `/practice/${a.id}/submit`, { answer: a.right, ms: 600, submissionId: 'sub_sync_case_one_01' });
  c.eq(committed.resolved, true, 'the attempt committed on the device');
  const replayA = await api.post(`/practice/${a.id}/submit`, { answer: a.right, ms: 600, submissionId: 'sub_sync_case_one_01' });
  c.eq(replayA.replayed, true, 'the relaunch replay returns the recorded verdict');
  await syncNow(me.id);
  const eventsA = await serverEvents(a.id);
  c.eq(eventsA.length, 1, `the server holds exactly one learning event for it (${eventsA.length})`);
  c.eq(eventsA[0]?.kind, 'graded-attempt', 'a server-attested graded-attempt event');

  // ── 2 · client-side IndexedDB crash after the server committed ──────────────────────────────────────────
  const b = await markable();
  crashQueueWrite = true;
  const crashed = await api.post(`/practice/${b.id}/submit`, { answer: b.right, ms: 600, submissionId: 'sub_sync_case_two_02' }).then(() => null, e => e);
  c.ok(crashed && /simulated crash/.test(crashed.message), 'the commit died mid-transaction');
  await syncNow(me.id);
  c.eq((await serverEvents(b.id)).length, 1, 'server grade was committed before the interrupted device write');
  const replayB = await api.post(`/practice/${b.id}/submit`, { answer: b.right, ms: 600, submissionId: 'sub_sync_case_two_02' });
  c.eq(replayB.resolved, true, 'the relaunch marks it now');
  await syncNow(me.id);
  c.eq((await serverEvents(b.id)).length, 1, 'and the server then holds exactly one event for it');

  // ── 3 · a wrong first try, the resolving try, and a replay of each ─────────
  const d = await markable();
  await api.post(`/practice/${d.id}/submit`, { answer: d.wrong, ms: 600, submissionId: 'sub_sync_case_three_1' });
  await api.post(`/practice/${d.id}/submit`, { answer: d.wrong, ms: 600, submissionId: 'sub_sync_case_three_1' });
  await api.post(`/practice/${d.id}/submit`, { answer: d.right, ms: 600, submissionId: 'sub_sync_case_three_2' });
  await api.post(`/practice/${d.id}/submit`, { answer: d.right, ms: 600, submissionId: 'sub_sync_case_three_2' });
  await syncNow(me.id);
  c.eq((await serverEvents(d.id)).length, 1, 'two tries and two replays are one event on the server');

  // ── 4 · syncing again sends nothing twice ──────────────────────────────────
  const again = await syncNow(me.id);
  c.eq(again.pending, 0, 'the device queue is empty');
  const totals = await Promise.all([a.id, b.id, d.id].map(serverEvents));
  c.deq(totals.map(rows => rows.length), [1, 1, 1], 'each question still has exactly one event');
} finally {
  await app.close();
  globalThis.fetch = realFetch;
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`engine: ${app.engine}`);
console.log(`PRACTICE ATTEMPT SYNC — PASS — ${c.count()}/${c.count()} checks — a killed or crashed submission reaches the server as exactly one learning event.`);
