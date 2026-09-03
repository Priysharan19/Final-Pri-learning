import assert from 'node:assert/strict';
import { independentReviewAllowed } from '../platform/content.js';

const revision = { author_account_id: 'acct-author' };
assert.equal(independentReviewAllowed(revision, 'acct-author'), false, 'an author must never approve their own revision through the normal pipeline');
assert.equal(independentReviewAllowed(revision, 'acct-reviewer'), true, 'a different authorised reviewer may approve');
assert.equal(independentReviewAllowed({ author_account_id: null }, 'acct-reviewer'), false, 'content without provenance cannot be approved');
assert.equal(independentReviewAllowed(revision, null), false, 'approval requires an identified reviewer');

console.log('PASS — CMS normal publishing requires an identified reviewer different from the author, including administrators.');
