// History search race (the intermittent 162/163 in tour-instrument).
//
// Turning the search on re-renders History at once, but the list fetch runs in
// a passive effect after paint. In between, the previous query's rows rendered
// under the new query: "N found" counted a stale page, then the effect blanked
// it to the skeleton and refilled it — a count that vanished after it looked
// settled. This replays that render sequence without a browser.
import assert from 'node:assert/strict';
import { historyListKey, historyListRequest, historyRowsFor } from '../src/pages/historyLoadLifecycle.js';

let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log(`  ✓ ${name}`); };
const req = over => historyListRequest({ instrument: true, filter: 'all', sort: 'newest', subtopic: '', searching: false, page: 0, searchPageSize: 5000, ...over });

const newest = historyListKey(req({}));
const loaded = { key: newest, rows: { total: 1, page: 0, pageSize: 20, items: [{ id: 'q1', prompt: 'Find x' }] } };

ok('the newest list renders the rows fetched for it', () => assert.equal(historyRowsFor(loaded, newest), loaded.rows));

// The render right after the first keystroke, before the effect has run.
const search = historyListKey(req({ searching: true }));
ok('a search request differs from the page request', () => assert.notEqual(search, newest));
ok('the first search render shows no stale rows and no count (it is loading)', () => assert.equal(historyRowsFor(loaded, search), null));

// The search response arrives; further keystrokes keep the same request.
const found = { key: search, rows: { total: 1, page: 0, pageSize: 5000, items: loaded.rows.items } };
ok('the search response renders under the search', () => assert.equal(historyRowsFor(found, search), found.rows));
ok('more typing keeps the same request (no refetch, no blank)', () => assert.equal(historyListKey(req({ searching: true })), search));

// A late page response cannot render under the search either.
ok('a late response for another request reads as loading', () => assert.equal(historyRowsFor(loaded, historyListKey(req({ searching: true, sort: 'marks' }))), null));
ok('a search ignores the page number', () => assert.equal(historyListKey(req({ searching: true, page: 3 })), search));
ok('nothing loaded is loading', () => assert.equal(historyRowsFor(null, newest), null));
ok('the classic build asks for filter and page only', () => assert.deepEqual(historyListRequest({ instrument: false, filter: 'wrong', page: 2, sort: 'marks', searching: true }), { filter: 'wrong', page: 2 }));

console.log(`HISTORY SEARCH RACE: PASS — ${pass}/${pass}`);
