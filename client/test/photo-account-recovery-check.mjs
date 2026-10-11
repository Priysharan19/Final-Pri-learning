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
// The in-place sign-in is the one sign-in card (CheckRefusal.jsx SignInChoices),
// fetched only when a student asks to sign in.
const signIn = read('components/CheckRefusal.jsx');
has(photo, /<SignInChoices user=\{user\} refreshUser=\{refreshUser\} onDone=\{\(\) => setPhotoSignInOpen\(false\)\} \/>/, 'Sign-in uses the shared in-place sign-in card');
has(signIn, /const SignInCard = React\.lazy\(\(\) => import\('\.\/SignUpFlow\.jsx'\)\)/, 'which is the existing account implementation, lazy-loaded');
has(photo, /photoSignInOpen && photoOCR\.blockedKey === 'verdict\.photoReadingSignIn'/, 'Only a genuine auth refusal opens account recovery');
has(photo, /onCloudSessionChange\(event =>/, 'Photo must subscribe to verified session updates');
has(photo, /event\?\.detail\?\.connected === true/, 'Retry is triggered by connected event, never mere profile display');
has(photo, /String\(event\.detail\.localProfileId\) === String\(user\?\.id\)/, 'Different-profile login cannot re-read a private photo');
has(photo, /photoAuthEpoch/, 'Session transition triggers a bounded photo retry');
has(photo, /photoOCR\.blockedKey !== 'verdict\.photoReadingSignIn'/, 'Only an authentication blocker triggers auto-retry');
has(photo, /!cloudReadingEnabled\(user\)/, 'A locally stored profile is not assumed to be authorised');
has(photo, /await readOnePage\(dataURL\)/, 'Photo recovery uses real existing cloud reader');
has(photo, /photoReadGeneration\.current/, 'Late recognition responses are generation guarded');
has(readFileSync(new URL('../src/components/PhotoLines.jsx', import.meta.url), 'utf8'), /data-photo-correct-transcript/, 'Recognition transcript is human editable');
// The transcript is edited line by line (PhotoLines.jsx). A corrected line
// reaches the working that is submitted, and the answer field holds the
// proposal from the kept lines — never the last line copied in as a sentence.
has(photo, /onEdit=\{\(i, text\) => changePhotoLines\(editLine\(photoLines, i, text\)\)\}/, 'A corrected photo line reaches the card');
has(photo, /const wk = workingOf\(next\);[\s\S]{0,200}setWorking\(wk\)/, 'Corrected working reaches method marks');
has(photo, /proposeFinalAnswer\(includedLines\(transcript\), publicAnswerShape\)/, 'The answer field is proposed from the kept lines for the public answer type');
assert.doesNotMatch(photo, /setAnswer\(page\.markable\)|editAnswer\(lastLine\)/, 'The last recognised line is never copied into the answer field');
count += 1;
has(photo, /newSubmissionId\(\)/, 'Grading retains idempotent submission keys');
has(photo, /savePendingSubmission\(question\.id/, 'Grading request is protected by existing submission recovery');
has(account, /const needsSignIn = enabled && \(!link\?\.accountId \|\| session\?\.reason === 'signed-out'\);/, 'Expired linked session is offered sign-in');
has(account, /\{needsSignIn && appleStep !== 'consent' && \([\s\S]{0,700}<SignInCard variant="inline"/, 'with an actual sign-in card, in place');
has(account, /allowCreate=\{!link\?\.accountId\}/, 'Linked profile cannot silently start second registration');
has(signIn, /allowCreate=\{user\?\.cloudLinked !== true\}/, 'nor can a linked profile signing in again on a question');
has(read('components/SignUpFlow.jsx'), /result\.status === 'profile-required' && !allowCreate/, 'the card drops an unused sign-up ticket for a linked profile');
has(account, /if \(err\?\.code === 'CLOUD_LINK_CONFLICT'\) await cloud\.logout\(\)/, 'A session for a different account is ended, not kept beside this profile');
// The photo goes to the server reader through the single-flight sender
// (one paid read per picture), which is the only caller of the transport.
has(reader, /await transcribeOnce\(transport, prepared\.dataUrl, \{ signal \}\)/, 'Photo recognition remains server-authoritative');
has(reader, /transport\.transcribeHandwriting\(image, \{ signal: controller\?\.signal \?\? null \}\)/, 'and the request carries the picture and a cancel signal, nothing else');
// Refusals are named in one place (ink/readerFailure.js), which the reader uses.
has(readFileSync(new URL('../src/ink/readerFailure.js', import.meta.url), 'utf8'), /GUARDIAN_CONSENT/, 'Guardian restrictions remain understood by the reader');
has(reader, /classifyReaderFailure\(failure, \{ now \}\)/, 'and the reader names every refusal through that classification');
console.log(`PHOTO ACCOUNT RECOVERY CONTRACT: PASS ${count}/${count} (source-level, not live-provider certification)`);
