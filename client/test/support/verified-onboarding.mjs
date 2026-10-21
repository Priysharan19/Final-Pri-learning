// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the browser suites' first run: a verified account, the way a
// student makes one.
//
// There is no device-only entry into the app any more (owner decision, issue
// #477): the landing screen is the sign-in card, and nothing opens until the
// server has confirmed the account, its age/guardian decision and the first
// sync (client/src/platform/accountActivation.js). So every browser flow that
// needs a student inside the app gets one HERE, through the shipped card:
//
//   email → the six-digit code the real server sent (read from its TEST email
//   adapter's outbox — no code is ever logged or placed in the page) → name,
//   age, the agreement → class and track → the server's statement and the
//   first sync → the shell.
//
// Nothing is injected: no cookie, no IndexedDB row, no local-only profile. The
// platform is the real app server (support/online-session.mjs); the only
// synthetic part is email delivery, and that is labelled as such everywhere.
//
// A teacher profile is a LOCAL role (the server knows only accounts): it is
// made through the picker's device-profile wizard and then passes the same
// gate — the inline card links it to a fresh verified account — so a teacher
// in these suites is a verified account whose device profile is a teacher.
// ─────────────────────────────────────────────────────────────────────────────
let serial = 0;

const JEE_TRACKS = new Set(['jee-main', 'jee-advanced']);

/** The test email adapter's last sign-in code for `address`, or null. */
export function lastEmailCode(platform, address, { purpose = 'sign-in' } = {}) {
  const sent = platform.sms.readTestOutbox({ to: address, channel: 'email' }).filter(m => !purpose || m.purpose === purpose).at(-1);
  return /^\d{6}$/.test(sent?.code || '') ? sent.code : null;
}

/** A fresh address nobody has used on this platform. */
export function freshEmail(prefix = 'browser') {
  return `${prefix}.${process.pid}.${++serial}.${Date.now().toString(36)}@example.test`;
}

/**
 * Only the test desk's OTP cooldown is advanced (production keeps its 30 s and
 * its hourly caps; server/test/otp-lifecycle-check.mjs proves them). Every
 * student of a suite run arrives from one loopback address, so without this
 * the per-address limits would stop the suite, not a student.
 */
export function resetOtpLimits(platform) {
  platform.h.db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'otp-%'").run();
}

/** The card element itself, whether `scope` is it, contains it, or is the page. */
async function cardOf(scope) {
  if (typeof scope.getAttribute === 'function' && typeof scope.page === 'function') {
    const own = await scope.getAttribute('data-signin-card').catch(() => null);
    if (own) return scope;
  }
  return scope.locator('[data-signin-card]').first();
}

/** Wait until the card (its root carries the step) stands on `step`. */
export async function waitForStep(scope, step, { timeout = 20000 } = {}) {
  const card = await cardOf(scope);
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  for (const deadline = Date.now() + timeout; Date.now() < deadline;) {
    if (await card.count() && (await card.getAttribute('data-signup-step')) === step) return;
    await page.waitForTimeout(100);
  }
  const now = await card.count() ? await card.getAttribute('data-signup-step') : 'no card on screen';
  const refused = await scope.locator('[data-testid="signup-error"]').innerText().catch(() => '');
  throw new Error(`the card did not reach the "${step}" step within ${timeout} ms (it is at "${now}"${refused ? `; it says: ${refused.trim()}` : ''})`);
}

/** Type a six-digit code into the card's boxes, digit by digit, from the first box. */
export async function typeCode(scope, code, { idPrefix = 'signup-code' } = {}) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  await scope.locator(`#${idPrefix}-0`).focus();
  await page.keyboard.type(code);
}

/**
 * Drive the one sign-in card from its email step to the point where the
 * server has signed the account in (a returning address) or made it (a new
 * address, after the age and agreement step). Returns once the card has left
 * the age step; the caller decides what the next step must be.
 */
export async function signInOnCard(scope, platform, { email, name = null, age = 18, agree = true } = {}) {
  resetOtpLimits(platform);
  // The step attribute sits on the card's root, so it is read there, not
  // searched for beneath it.
  await scope.locator('#signup-destination').waitFor({ timeout: 20000 });
  await scope.locator('#signup-destination').fill(email);
  await scope.getByTestId('signup-send-code').click();
  // The six boxes are the code step (the step attribute is on the card's root).
  await scope.locator('#signup-code-0').waitFor({ timeout: 20000 });
  const code = lastEmailCode(platform, email);
  if (!code) throw new Error(`the real server did not send a six-digit email code to ${email}`);
  await typeCode(scope, code);
  // A new address is asked who it is; a returning one is signed in at once
  // (and the card may then be gone, replaced by the shell).
  const card = await cardOf(scope);
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  let step = 'code';
  for (const deadline = Date.now() + 30000; Date.now() < deadline;) {
    if (!(await card.count())) { step = null; break; }
    step = await card.getAttribute('data-signup-step');
    if (step !== 'code') break;
    const refused = scope.locator('[data-testid="signup-error"]');
    if (await refused.count()) throw new Error(`the code was refused: ${(await refused.innerText()).trim()}`);
    await page.waitForTimeout(100);
  }
  if (step === 'age') {
    if (name) await scope.locator('#signup-flow-name').fill(name);
    await scope.getByTestId(`signup-age-${age}`).click();
    if (agree) await scope.getByTestId('signup-agree').check();
    await scope.getByTestId('signup-age-next').click();
  }
  return { code, newAccount: step === 'age' };
}

/**
 * A student inside the app: a verified adult account made on the landing
 * card, with this device's profile linked to it, past the gate. Options keep
 * the old helper's names so the flows read as before; a password, an avatar
 * or an Australian syllabus is not something the card asks for and is noted,
 * never silently honoured with a different identity.
 */
export async function createVerifiedProfile(page, platform, {
  name = 'E2E Student', year = 9, email = null, track = null, course = 'nsw', role = 'student',
  language = 'en', fromPicker = false, age = 18, landing = 'home', note = null
} = {}) {
  const say = message => { if (typeof note === 'function') note(message); };
  const classOf = JEE_TRACKS.has(track) ? Math.max(11, Math.min(12, Number(year) || 12)) : Math.max(7, Math.min(12, Number(year) || 9));
  if (role === 'teacher') return createTeacherProfile(page, platform, { name, year: classOf, email, language, note });

  const address = (email || freshEmail()).toLowerCase();
  if (fromPicker) {
    await page.getByTestId('picker-create-account').click();
  }
  const card = page.locator('[data-signin-card="page"]');
  await card.waitFor({ timeout: 30000 });
  // The sign-in language is the device's choice before a profile exists; the
  // profile the card makes is given that language (Login.jsx finishAccount).
  if (language !== 'en') await page.locator(`.auth-col button[lang="${language}"]`).click();

  const signedIn = await signInOnCard(card, platform, { email: address, name, age });
  if (signedIn.newAccount && age < 18) {
    // A child: the parent's approval step is where the card now stands; the
    // caller drives the rest (tour-activation-gate.js).
    await waitForStep(card, 'class');
    await card.getByTestId(`signup-class-${classOf}`).click();
    if (track && track !== 'cbse') await card.getByTestId(`signup-track-${track}`).click();
    await card.getByTestId('signup-class-next').click();
    await waitForStep(card, 'parent');
    return { email: address, accountId: null, year: classOf, name, pending: true };
  }
  // A class is asked once per device profile — here, where the profile is made.
  await waitForStep(card, 'class', { timeout: 30000 });
  await card.getByTestId(`signup-class-${classOf}`).click();
  if (track && track !== 'cbse') await card.getByTestId(`signup-track-${track}`).click();
  await card.getByTestId('signup-class-next').click();

  // Nothing of the shell exists until the gate has let the profile in.
  await page.locator('.shell').waitFor({ timeout: 60000 });
  if (await page.locator('[data-testid="account-activation-gate"]').count()) throw new Error('the shell opened with the activation gate still on screen');
  const me = await page.evaluate(async () => {
    const response = await fetch('/v1/account/me', { credentials: 'include' });
    return { status: response.status, data: response.ok ? await response.json() : null };
  });
  if (me.status !== 200 || !me.data?.account?.id) throw new Error(`the shell opened without a live platform session (/v1/account/me → ${me.status})`);
  // A flow that forwards /v1 to a platform of its own (tour-write-sign-in.js)
  // keeps its accounts there; the shared platform is checked when it holds the address.
  const row = platform.h.db.prepare('SELECT id FROM accounts WHERE email=?').get(address);
  if (row && String(row.id) !== String(me.data.account.id)) throw new Error('the live session is not the account the card made for this address');
  // The card offers Classes 7–12 (CBSE / JEE): a flow that studies an
  // Australian syllabus changes it where a student would — Settings → Profile
  // — after entering, through the shipped form; the account is unchanged.
  if (course !== 'in') {
    await switchSyllabus(page, platform, { course, year: Number(year) || classOf });
    say(`verified onboarding: "${name}" entered as Class ${classOf} and switched to ${course.toUpperCase()} Year ${Number(year) || classOf} in Settings`);
  }
  if (landing === 'home') {
    await page.goto(`${platform.origin}/`, { waitUntil: 'domcontentloaded' });
    // Home is the greeting, or — in a PRI_FEATURE_INSTRUMENT build — the Index.
    await page.locator('.home-greet, [data-instrument-index]').first().waitFor({ timeout: 30000 });
  }
  return { email: address, accountId: String(me.data.account.id), year: course !== 'in' ? Number(year) || classOf : classOf, name, pending: false };
}

/** Change the signed-in profile's syllabus and year through Settings → Profile Information → Edit. */
export async function switchSyllabus(page, platform, { course, year }) {
  await page.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Profile Information' }) });
  await card.waitFor({ timeout: 30000 });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#set-course').waitFor({ timeout: 15000 });
  await page.locator('#set-course').selectOption(course);
  await page.locator('#set-year').selectOption(String(year));
  await card.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('#set-course').waitFor({ state: 'detached', timeout: 15000 });
}

/**
 * A teacher device profile, linked to a fresh verified account at the gate.
 * Needs the picker (a profile already on the device): the device-profile
 * wizard is reachable only from there, by design.
 */
async function createTeacherProfile(page, platform, { name, year, email, language, note }) {
  const address = (email || freshEmail('teacher')).toLowerCase();
  const wizard = page.getByRole('button', { name: /Add another profile/i });
  if (!await wizard.count()) throw new Error('a teacher profile is made from the picker ("Add another profile"); open the picker first');
  await wizard.click();
  await page.waitForSelector('[data-onboarding-step="1"]', { timeout: 15000 });
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]', { timeout: 15000 });
  await page.locator('#signup-track').selectOption(String(year));
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="3"]', { timeout: 15000 });
  await page.locator('#signup-name').fill(name);
  if (language !== 'en') await page.locator(`.auth-card button[lang="${language}"]`).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="4"]', { timeout: 15000 });
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="5"]', { timeout: 15000 });
  await page.locator('.auth-card .btn-primary').click();
  // The device profile exists; the gate asks for its account before anything opens.
  const gate = page.locator('[data-testid="account-activation-gate"]');
  await gate.waitFor({ timeout: 30000 });
  await gate.locator('[data-activation-status="signin"], [data-testid="activation-signin"]').first().waitFor({ timeout: 30000 }).catch(err => {
    throw new Error(`the activation gate did not ask the teacher profile to sign in: ${err.message.split('\n')[0]}`);
  });
  await signInOnCard(gate.locator('[data-signin-card="inline"]'), platform, { email: address, age: 18 });
  await page.locator('.shell').waitFor({ timeout: 60000 });
  await page.waitForURL(/\/teach(?:[#?].*)?$/, { timeout: 30000 }).catch(() => {
    throw new Error(`the teacher profile did not land on /teach after the gate (it is at ${page.url()})`);
  });
  if (typeof note === 'function') note(`teacher "${name}": a device teacher profile linked to the verified account ${address} (the server knows no teacher role for it)`);
  const row = platform.h.db.prepare('SELECT id FROM accounts WHERE email=?').get(address);
  return { email: address, accountId: row ? String(row.id) : null, year, name, pending: false };
}
