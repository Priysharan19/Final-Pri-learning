// Automatic reading of handwriting (owner decision, 18 November 2026): the static
// rules. The behaviour in a real browser is pinned by tour-auto-read.js; the
// server's per-question cap by server/test/recognize-question-cap-check.mjs.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { autoReadEnabled, setAutoRead } from '../src/lib/autoRead.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// The preference: on by default, device-only, safe when storage is blocked.
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const s = mem();
ok(autoReadEnabled(s) === true, 'automatic reading is on by default');
ok(setAutoRead(false, s) === false && autoReadEnabled(s) === false, 'a student can turn it off');
ok(setAutoRead(true, s) === true, 'and back on');
const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
ok(autoReadEnabled(blocked) === true && setAutoRead(false, blocked) === true, 'blocked storage keeps the default and never throws');

const ink = read('../src/ink/InkAnswer.jsx');
const card = read('../src/components/QuestionCard.jsx');
const exam = read('../src/pages/ExamRoom.jsx');
ok(/autoReadRef\.current = !!autoRead && autoReadEnabled\(\)/.test(ink), 'a read on its own needs both the surface to ask for it and the device preference');
ok(/<InkAnswer feedback autoRead=\{!resolved\}/.test(card), 'practice asks for it, and not once the question is resolved');
ok(!/autoRead/.test(exam), 'the exam room never asks for automatic reading: its reads follow the exam rules (submission, nothing shown before)');
ok(/if \(auto \|\| askingRef\.current\) return;/.test(ink), 'an automatic read never opens the permission prompt');
ok(!/markWith|onSubmit\(|\.submit\(/.test(ink.slice(ink.indexOf('const onStrokesChange'), ink.indexOf('const onStrokesChange') + 3500)), 'the pause path calls no submit or marking');
ok(/the same answer-blind picture/.test(ink) || /answer-blind/.test(ink), 'the read is the same answer-blind request');

// Where the decision is recorded.
ok(existsSync(new URL('../../docs/product/handwriting-auto-read.md', import.meta.url)), 'the decision is recorded in docs/product');
const doc = read('../../docs/product/handwriting-auto-read.md');
ok(/18 November 2026/.test(doc) && /make it automatically read handwriting in the background/.test(doc), 'the record quotes the owner and carries the date');
for (const f of ['cloud-handwriting-client-check.mjs', 'ink-real-page-stability-check.mjs']) ok(/18 November 2026/.test(read(`./${f}`)), `${f} records the owner decision and its date`);

const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
for (const k of ['ink.autoOffline', 'ink.autoRead', 'ink.autoReadCheck', 'ink.autoCant', 'autoRead.title', 'autoRead.label', 'autoRead.note', 'autoRead.on', 'autoRead.off']) ok(en[k] && hi[k], `${k} exists in English and Hindi`);
console.log(`AUTO READ: PASS — ${n}/${n} checks — on by default, device-only, never opens the prompt, never marks, not in the exam room, decision recorded`);
