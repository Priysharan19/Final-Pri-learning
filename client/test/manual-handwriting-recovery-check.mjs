// P0 owner-manual handwriting blockage: executable product-source regression.
// A separate Chromium/WebKit real Express test must certify the complete journey;
// this gate exists specifically so the old Settings link cannot count as a fix.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.PRI_MANUAL_INK_SRC_ROOT || process.cwd());
const path = base => readFileSync(resolve(root, base), 'utf8');
const ink = path('client/src/ink/InkAnswer.jsx');
const card = path('client/src/components/QuestionCard.jsx');
let checked = 0;
const requireProduct = (value, explanation) => {
  assert.ok(value, 'OWNER MANUAL P0: ' + explanation);
  checked++;
};

// The owner has ink on the page, but server recognition cannot begin because
// their cloud account is missing. Without a recogniser answerLine, disabled
// Submit cannot open its authRequired error recovery. The blocked-ink component
// itself MUST show a non-navigating sign-in path.
const blocker = ink.match(/ACCOUNT_BLOCKED_KEYS\.has\(status\.key\)[\s\S]*?\}\)\}/)?.[0] || '';
requireProduct(blocker.length > 0, 'account-dependent reader blocker remains explicit');
requireProduct(/<button\b/.test(blocker), 'blocked handwriting must offer a real inline action, not only a Settings link');
requireProduct(/data-ink-auth-recovery/.test(blocker), 'blocked handwriting must expose a stable, accessible inline sign-in selector');
requireProduct(/aria-expanded/.test(blocker), 'blocked handwriting sign-in must expose expanded/collapsed state');
requireProduct(!/to="\/settings"/.test(blocker) || /data-ink-auth-recovery/.test(blocker),
  'navigating away to Settings must never be the sole recovery');
requireProduct(/onCloudSessionChange/.test(ink), 'reader must observe authenticated cloud-session changes to retry recognition');
requireProduct(/onStrokes\?\.\(/.test(ink) || /onStrokes\(/.test(ink),
  'the same handwriting must still reach durable draft capture while recognition is blocked');
requireProduct(/inkResult\?\.answerLine/.test(card),
  'Submit must remain fail-closed until a recognised answer exists');
requireProduct(/readInkDraft\(/.test(card) && /flushInkDrafts\(/.test(card),
  'the card must read back the ink from durable local storage before claiming it saved');
console.log('OWNER HANDWRITING ACCOUNT RECOVERY: PASS '+checked+'/'+checked+' source contracts ('+root+')');
