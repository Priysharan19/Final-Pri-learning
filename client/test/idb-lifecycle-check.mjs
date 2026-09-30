// PRI-02 · IndexedDB lifecycle regression.
// Proves transient open failures are retried and versionchange releases the
// cached connection so a later operation can reopen the current schema.

import assert from 'node:assert/strict';

let opens = 0;
let closes = 0;
let mode = 'fail';
let lastDb = null;

function makeDb() {
  const stores = new Map();
  const db = {
    objectStoreNames: { contains: name => stores.has(name) },
    createObjectStore(name) {
      const store = {
        indexNames: { contains: () => false },
        createIndex() {},
        deleteIndex() {}
      };
      stores.set(name, store);
      return store;
    },
    transaction() {
      throw new Error('transactions are not needed by this lifecycle regression');
    },
    close() { closes++; this.onclose?.(); },
    onversionchange: null,
    onclose: null
  };
  return db;
}

globalThis.indexedDB = {
  open() {
    opens++;
    const req = {
      result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null,
      transaction: { objectStore: () => null }
    };
    queueMicrotask(() => {
      if (mode === 'fail') {
        req.error = new Error('synthetic transient open failure');
        req.onerror?.();
        return;
      }
      const db = makeDb();
      req.result = db;
      lastDb = db;
      req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  }
};

const { openDB } = await import('../src/local/idb.js');

await assert.rejects(openDB(), /synthetic transient open failure/);
assert.equal(opens, 1, 'first open should fail exactly once');

mode = 'ok';
const first = await openDB();
assert.ok(first, 'second open should recover');
assert.equal(opens, 2, 'rejected open promise must not be cached');

assert.equal(typeof lastDb.onversionchange, 'function', 'successful handle must install versionchange release');
lastDb.onversionchange();
assert.equal(closes, 1, 'versionchange must close the stale handle');

const reopened = await openDB();
assert.ok(reopened, 'a request after versionchange should reopen');
assert.equal(opens, 3, 'versionchange must clear the cached open promise');

console.log('PASS — IndexedDB transient opens recover and versionchange releases the cached handle.');
