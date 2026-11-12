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

/**
 * The card element itself, whether `scope` is it, contains it, or is the page.
 * Resolve it while the card is still on screen: once a returning address is
 * signed in the card is gone, and there is nothing left to ask.
 */
async function cardOf(scope) {
  if (typeof scope.evaluateAll === 'function' && typeof scope.page === 'function') {
    const own = await scope.evaluateAll(els => els[0]?.getAttribute('data-signin-card') ?? null);
    if (own) return scope;
  }
  return scope.locator('[data-signin-card]').first();
}

/**
 * Where the card stands, read in ONE look that never waits:
 * { present: false } once the card has left the page, else { present: true,
 * step }. Never `count()` and then `getAttribute()`: a returning address is
 * signed in the moment its code is right, the gate replaces the card with the
 * shell between those two calls, and `getAttribute` then waits its full
 * timeout for an element that is never coming back (CI's intermittent
 * "locator.getAttribute: Timeout 30000ms exceeded" on the gate's inline card).
 */
export async function cardStep(card) {
  return card.evaluateAll(els => els.length
    ? { present: true, step: els[0].getAttribute('data-signup-step') }
    : { present: false, step: null });
}

/** The card's refusal, read in one look that never waits; null when none is shown. */
const errorText = scope => scope.locator('[data-testid="signup-error"]').evaluateAll(els => els.length ? els[0].innerText : null);

/** Wait until the card (its root carries the step) stands on `step`. */
export async function waitForStep(scope, step, { timeout = 20000 } = {}) {
  const card = await cardOf(scope);
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  for (const deadline = Date.now() + timeout; Date.now() < deadline;) {
    if ((await cardStep(card)).step === step) return;
    await page.waitForTimeout(100);
  }
  const seen = await cardStep(card);
  const now = seen.present ? seen.step : 'no card on screen';
  const refused = await errorText(scope);
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
  // Resolved before the code goes in: a returning address is signed in at
  // once, and the card may then be gone, replaced by the shell.
  const card = await cardOf(scope);
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  await typeCode(scope, code);
  // A new address is asked who it is; a returning one is signed in at once.
  let step = 'code';
  for (const deadline = Date.now() + 30000; Date.now() < deadline;) {
    const seen = await cardStep(card);
    if (!seen.present) { step = null; break; }
    step = seen.step;
    if (step !== 'code') break;
    const refused = await errorText(scope);
    if (refused !== null) throw new Error(`the code was refused: ${refused.trim()}`);
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
 * the old helper's names so the flows read as before; a password or an avatar
 * is not something the card asks for and is noted, never silently honoured
 * with a different identity.
 *
 * Every student is on the India course, the only one V1 ships (D2): `year` is
 * the CBSE class (7–12, Class 11–12 for a JEE track) and `track` is 'cbse',
 * 'jee-main' or 'jee-advanced'. The server refuses every question bank outside
 * the India covers (D15, server/platform/indiaBanks.js), so a flow that asked
 * for another course would only be refused later, less clearly; it is refused
 * here.
 */
export async function createVerifiedProfile(page, platform, {
  name = 'E2E Student', year = 9, email = null, track = null, course = 'in', role = 'student',
  language = 'en', fromPicker = false, age = 18, landing = 'home', note = null
} = {}) {
  if (course !== 'in') {
    throw new Error(`verified onboarding: course "${course}" — V1 ships only the India course (D2) and the server issues no other bank (D15); make "${name}" a CBSE or JEE student instead`);
  }
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
  // The card's class and track are the profile's course: nothing is switched
  // afterwards in Settings (the NSW detour these suites used to take ended
  // with D15, which refuses the NSW banks at the server).
  if (landing === 'home') {
    await page.goto(`${platform.origin}/`, { waitUntil: 'domcontentloaded' });
    // Home is the greeting, or — in a PRI_FEATURE_INSTRUMENT build — the Index.
    await page.locator('.home-greet, [data-instrument-index]').first().waitFor({ timeout: 30000 });
  }
  return { email: address, accountId: String(me.data.account.id), year: classOf, name, pending: false };
}

/**
 * Change the signed-in profile's syllabus and year through Settings → Profile
 * Information → Edit. No student flow calls it any more: every student is made
 * on the India course (D2), and the server refuses the other courses' banks
 * (D15). It drives the Settings form itself, for a flow that tests that form.
 */
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
