// P0 owner-manual handwriting blockage: executable product-source regression.
// A separate Chromium/WebKit real Express test must certify the complete journey;
// this gate exists specifically so the old Settings link cannot count as a fix.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
requireProduct(blocker.length > 0, 'reader keeps authentication blocker explicit');
requireProduct(/data-ink-account-recovery/.test(card), 'Question Card must show recovery alongside the existing ink canvas');
requireProduct(/<button[^>]*data-ink-sign-in/.test(card),
  'blocked handwriting must offer an actionable sign-in button within the question');
requireProduct(/aria-expanded=\{inkSignInOpen\}/.test(card), 'in-context sign-in must expose open state accessibly');
requireProduct(/setInkSignInOpen\(v => !v\)/.test(card), 'sign-in button must actually open the account panel');
requireProduct(/inkSignInOpen && inkSignInReady/.test(card) && /<PhotoAccountRecovery \/>/.test(card),
  'in-context account panel must mount without navigating away or replacing the card');
requireProduct(/!inkSignInReady/.test(card), 'no account/profile switch until local ink is durably verified');
requireProduct(/data-ink-save-retry/.test(card), 'failed ink writes must offer retry instead of falsely claiming Saved');
requireProduct(/latestInk\.current\?\.length && onInkStrokes/.test(card),
  'retry save must use the actual latest strokes from this question, not blank data');
const safety = await import(pathToFileURL(resolve(root, 'client/src/components/signedOutInkRecovery.js')).href);
const signedOut = { kind: 'ACCOUNT_ACTION_REQUIRED', blocker: 'ink.waitingSignIn' };
const ctx = { readerState: signedOut, mode: 'write', inkHasStrokes: true, resolved: false };
requireProduct(safety.blockedInkRecovery(ctx), 'signed-out strokes trigger in-context recovery');
requireProduct(!safety.canOpenInkSignIn({ ...ctx, saveState: 'saving' }),
  'queued but unacknowledged ink is not yet safe to switch accounts');
requireProduct(!safety.canOpenInkSignIn({ ...ctx, saveState: 'failed' }),
  'failed IndexedDB write cannot enable account switch');
requireProduct(safety.canOpenInkSignIn({ ...ctx, saveState: 'saved' }),
  'verified local stroke readback permits in-context sign-in');
requireProduct(!safety.canOpenInkSignIn({
  ...ctx, readerState: {kind: 'ACCOUNT_ACTION_REQUIRED', blocker: 'ink.waitingGuardian'}, saveState: 'saved'
}), 'guardian consent cannot be bypassed through sign-in');
requireProduct(/onCloudSessionChange/.test(ink), 'reader must observe authenticated cloud-session changes to retry recognition');
requireProduct(/onStrokesRef\.current\?\.\(strokes\)/.test(ink),
  'the same handwriting must still reach durable draft capture while recognition is blocked');
requireProduct(/inkResult\?\.answerLine/.test(card),
  'Submit must remain fail-closed until a recognised answer exists');
requireProduct(/readInkDraft\(/.test(card) && /flushInkDrafts\(/.test(card),
  'the card must read back the ink from durable local storage before claiming it saved');
console.log('OWNER HANDWRITING ACCOUNT RECOVERY: PASS '+checked+'/'+checked+' source contracts ('+root+')');
