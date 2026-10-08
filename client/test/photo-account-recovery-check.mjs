// P0 photo-auth recovery: source-level invariants. This is deliberately NOT a
// provider/live-recognition proof; run the browser and cloud contract suites
// separately and require a live-provider test before release certification.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = path => readFileSync(resolve(root, path), 'utf8');
const photo = read('components/QuestionCard.jsx');
const account = read('components/CloudAccountPanel.jsx');
const reader = read('ink/cloudReader.js');
let count = 0;
function has(text, pattern, description) {
  assert.match(text, pattern, description);
  count += 1;
}

has(photo, /data-photo-sign-in/, 'Photo must show a real sign-in action');
has(photo, /aria-expanded=\{photoSignInOpen\}/, 'Sign-in action must expose expansion state');
has(photo, /React\.lazy\(\(\) => import\('\.\/CloudAccountPanel\.jsx'\)\)/, 'Sign-in uses existing account implementation, lazy-loaded');
has(photo, /photoSignInOpen && photoOCR\.blockedKey === 'verdict\.photoReadingSignIn'/, 'Only a genuine auth refusal opens account recovery');
has(photo, /onCloudSessionChange\(event =>/, 'Photo must subscribe to verified session updates');
has(photo, /event\?\.detail\?\.connected === true/, 'Retry is triggered by connected event, never mere profile display');
has(photo, /String\(event\.detail\.localProfileId\) === String\(user\?\.id\)/, 'Different-profile login cannot re-read a private photo');
has(photo, /photoAuthEpoch/, 'Session transition triggers a bounded photo retry');
has(photo, /photoOCR\.blockedKey !== 'verdict\.photoReadingSignIn'/, 'Only an authentication blocker triggers auto-retry');
has(photo, /!cloudReadingEnabled\(user\)/, 'A locally stored profile is not assumed to be authorised');
has(photo, /await readOnePage\(dataURL\)/, 'Photo recovery uses real existing cloud reader');
has(photo, /photoReadGeneration\.current/, 'Late recognition responses are generation guarded');
has(photo, /data-photo-correct-transcript/, 'Recognition transcript is human editable');
has(photo, /editAnswer\(lastLine\)/, 'Corrected photo answer reaches the answer submission value');
has(photo, /editWorking\(corrected\)/, 'Corrected working reaches method marks');
has(photo, /newSubmissionId\(\)/, 'Grading retains idempotent submission keys');
has(photo, /savePendingSubmission\(question\.id/, 'Grading request is protected by existing submission recovery');
has(account, /session\?\.reason === 'signed-out'\) && <form/, 'Expired linked session has an actual login form');
has(account, /mode === 'register' && !link\?\.accountId/, 'Linked profile cannot silently start second registration');
has(reader, /transport\.transcribeHandwriting\(prepared\.dataUrl/, 'Photo recognition remains server-authoritative');
has(reader, /GUARDIAN_CONSENT/, 'Guardian restrictions remain understood by the reader');
console.log(`PHOTO ACCOUNT RECOVERY CONTRACT: PASS ${count}/${count} (source-level, not live-provider certification)`);
