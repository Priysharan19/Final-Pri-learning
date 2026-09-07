#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · why production will not boot, and exactly what to set
//
// The container builds and then exits within seconds. That is not a mystery
// and not a bug: assertPlatformConfig() refuses to start a production server
// that is missing anything it needs to be safe, and dying loudly beats serving
// sessions with no CSRF secret. The message is in the Railway log, but you have
// to go and read it, and it names the variables without saying what to put in
// them.
//
// So: run this, and it tells you what is missing, what each one is for, and
// generates a strong value for the ones that are just secrets. It prints
// values for you to paste. It never sets anything itself and never reads a key
// you already have.
//
//   node tools/production-preflight.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';

const env = process.env;
const has = name => String(env[name] || '').trim().length > 0;
const secret = (bytes = 32) => randomBytes(bytes).toString('base64url');

const REQUIRED = [
  {
    name: 'PRI_PUBLIC_ORIGIN',
    what: 'The HTTPS origin this deployment is served on. Sessions, CSRF and email links are all built from it.',
    example: 'https://your-app.up.railway.app',
    generate: null,
    note: 'Must be a clean HTTPS origin: no path, no query, no trailing slash, no credentials.'
  },
  {
    name: 'PRI_CSRF_SECRET',
    what: 'Signs the double-submit CSRF token. Without it, a cross-site page could act as a signed-in student.',
    example: null,
    generate: () => secret(32),
    note: 'Any long random string. Changing it later signs everyone out, which is safe but visible.'
  },
  {
    name: 'PRI_AUTH_DELIVERY_KEY',
    what: 'Encrypts verification and password-reset emails while they sit in the outbox, so a database copy does not hand over live reset links.',
    example: null,
    generate: () => secret(32),
    note: 'Rotating this makes pending unsent emails undeliverable. Set it once, before real users exist.'
  },
  {
    name: 'PRI_PAID_CALLS_PER_HOUR',
    what: 'A ceiling on paid handwriting/marking calls across the whole deployment, per hour. Required once PRI_HANDWRITING_API_KEY is set. Per-account limits bound one student; only this bounds the bill.',
    example: '600',
    generate: null,
    note: 'Set it to what you are willing to pay, not to what you hope nobody reaches. Over the ceiling, students fall back to reading on their own device.',
    onlyWithKey: true
  },
  {
    name: 'PRI_PAID_CALLS_PER_DAY',
    what: 'The same ceiling over a day. Required once PRI_HANDWRITING_API_KEY is set.',
    example: '5000',
    generate: null,
    note: 'A thousand students at their own hourly limits is 360,000 calls an hour, so this is the number that decides your worst day.',
    onlyWithKey: true
  },
  {
    name: 'PRI_PLATFORM_DB',
    what: 'Absolute path to the SQLite database on the persistent volume.',
    example: '/data/pri-learning-platform.db',
    generate: null,
    note: 'Must be absolute and on a mounted volume. A path inside the image is wiped on every deploy, which silently loses every account.'
  },
  {
    name: 'PRI_TRUSTED_PROXY_HOPS',
    what: 'How many reverse proxies sit in front of this process. It decides which address the rate limiters count against, so a wrong value either lets one client mint a new identity per request or puts every user in one bucket.',
    example: '1',
    generate: null,
    note: '0 when nothing is in front of it, 1 behind a single load balancer/CDN such as Railway or Fly, 2 behind two (Cloudflare in front of a platform router). Re-check it whenever the edge changes.'
  }
];

const OPTIONAL = [
  { name: 'PRI_HANDWRITING_API_KEY', what: 'Turns on server-side handwriting reading and step checking. Without it both routes report themselves unavailable and the settings hide themselves.' },
  { name: 'PRI_AUTH_EMAIL_PROVIDER', what: 'Set to "resend" with PRI_RESEND_API_KEY and PRI_AUTH_EMAIL_FROM to actually send verification email. Without it accounts cannot verify, and verified email gates the reading and marking routes.' },
  { name: 'PRI_RAZORPAY_KEY_ID', what: 'Web subscriptions. Only needed once a plan id is configured; configuring a plan without these fails the boot check on purpose.' },
  { name: 'PRI_DISPLAY_MONTHLY_PRICE', what: 'What the account panel shows, with PRI_DISPLAY_ANNUAL_PRICE. Until both are set the panel tells visitors that pricing has not been configured for this deployment, which is true and is not what a paying visitor should read.' }
];

// The spend ceilings are required only once there is a key to spend against.
const applicable = REQUIRED.filter(item => !item.onlyWithKey || has('PRI_HANDWRITING_API_KEY'));
const missing = applicable.filter(item => !has(item.name));
const present = applicable.filter(item => has(item.name));

console.log('\nPri Learning · production preflight\n' + '─'.repeat(70));

if (!missing.length) {
  console.log(`\nAll ${REQUIRED.length} required variables are set in THIS shell.`);
  console.log('If production still exits on boot, the variables are missing where the');
  console.log('server actually runs, not here. Set them on the Railway service.\n');
} else {
  console.log(`\n${missing.length} of ${REQUIRED.length} required variables are not set here.`);
  console.log('The production server refuses to start without them, which is the');
  console.log('7-second exit after a successful build.\n');

  for (const item of missing) {
    console.log(`  ${item.name}`);
    console.log(`     ${item.what}`);
    if (item.generate) {
      console.log(`     Generated for you:  ${item.generate()}`);
    } else {
      console.log(`     Example:            ${item.example}`);
    }
    console.log(`     ${item.note}\n`);
  }

  console.log('─'.repeat(70));
  console.log('\nSet them on the service, not in this shell. With the Railway CLI:\n');
  console.log('  railway variables \\');
  for (const item of missing) {
    const value = item.generate ? item.generate() : (item.example || 'CHANGE_ME');
    console.log(`    --set ${item.name}='${value}' \\`);
  }
  console.log("    --set NODE_ENV='production'\n");
  console.log('The two generated values above are freshly random each run — take them');
  console.log('from the command block, not from the list, so you paste one pair.\n');
}

if (present.length) {
  console.log(`Already set here: ${present.map(i => i.name).join(', ')}\n`);
}

console.log('─'.repeat(70));
console.log('\nOptional, and what each unlocks:\n');
for (const item of OPTIONAL) {
  console.log(`  ${has(item.name) ? '·' : '○'} ${item.name}`);
  console.log(`     ${item.what}\n`);
}

console.log('Nothing was written and nothing was sent. This only prints.\n');
