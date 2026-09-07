// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a limit a client can actually reach, and be told about
//
// The handwriting route advertised a 4 MB image ceiling while /v1 parses at
// most a 1 MB JSON body. Base64 costs a third on top, so everything over about
// 785 kB died in the body parser: HANDWRITING_IMAGE_TOO_LARGE was unreachable
// code, and a student with a dense page of working got a bare 413 with no error
// code at all — indistinguishable, from the iPad's side, from the server
// falling over.
//
// The ceiling was brought down to what the transport carries rather than the
// parser being raised, because the picture that is actually sent is already
// scaled to the resolution the model reads at: the shipped client rasters ink
// to a 700 kB budget (client/src/ink/cloudRaster.js), and a 4 MB read costs
// more and reads no better. So: the stated ceiling must sit inside the
// transport and above the client's own budget, and a body that does overrun
// the parser must still come back with a code.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_HANDWRITING_API_KEY', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-request-size-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '77'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
// Configured, so a refusal below is the size gate and not "no key here".
process.env.PRI_HANDWRITING_API_KEY = 'request-size-contract-key';
// A configured key is a licence to spend, and the boot check refuses one
// without a ceiling — so a fixture that sets a key must set a ceiling too, the
// same as a real deployment.
process.env.PRI_PAID_CALLS_PER_HOUR = '10000';
process.env.PRI_PAID_CALLS_PER_DAY = '100000';

const { startApp, checks } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { JSON_BODY_LIMIT_BYTES } = await import('../app.js');
const { MAX_IMAGE_BYTES, validateImage } = await import('../platform/handwritingProvider.js');

const c = checks();

/** What the client rasters to; the server ceiling must not sit below it. */
const CLIENT_RASTER_BUDGET = 700_000;
/** A data URL whose decoded payload is `bytes` long. */
const image = bytes => `data:image/png;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4)}`;
const bodyBytes = dataUrl => Buffer.byteLength(JSON.stringify({ image: dataUrl }));

// ── 1 · The advertised ceiling is reachable ──────────────────────────────────
c.ok(MAX_IMAGE_BYTES >= CLIENT_RASTER_BUDGET,
  `the ceiling is not below the client's own raster budget (${MAX_IMAGE_BYTES} >= ${CLIENT_RASTER_BUDGET})`);
c.ok(bodyBytes(image(MAX_IMAGE_BYTES)) < JSON_BODY_LIMIT_BYTES,
  `an image at exactly the ceiling still fits the ${JSON_BODY_LIMIT_BYTES}-byte body limit (${bodyBytes(image(MAX_IMAGE_BYTES))})`);
c.eq(validateImage(image(MAX_IMAGE_BYTES)).bytes <= MAX_IMAGE_BYTES, true, 'and is accepted by the validator');
let refusal = null;
try { validateImage(image(MAX_IMAGE_BYTES + 50_000)); } catch (error) { refusal = error; }
c.eq(refusal?.code, 'HANDWRITING_IMAGE_TOO_LARGE', 'one over the ceiling is refused by name');
c.eq(refusal?.status, 413, 'as a 413');
c.match(refusal?.message, /750 kB/, 'and the message states the real limit');

// ── 2 · Both refusals arrive as codes over HTTP ─────────────────────────────
const db = createPlatformDb(':memory:');
const app = await startApp({ db });
try {
  const jar = {};
  const registration = await app.request('/v1/account/register', {
    method: 'POST', jar, body: { email: 'ink.student@example.test', name: 'Ink', password: 'correct-horse-battery', deviceId: 'ipad-ink' }
  });
  c.eq(registration.status, 201, 'a verified student is signed in');
  db.prepare('UPDATE accounts SET email_verified_at=? WHERE id=?').run(Date.now(), registration.data.account.id);

  const transcribe = dataUrl => app.request('/v1/handwriting/transcribe', { method: 'POST', jar, body: { image: dataUrl } });

  // Over the ceiling, under the parser: the route's own refusal.
  const overCeiling = image(MAX_IMAGE_BYTES + 20_000);
  c.ok(bodyBytes(overCeiling) < JSON_BODY_LIMIT_BYTES, 'the oversized image still reaches the route');
  const refused = await transcribe(overCeiling);
  c.eq(refused.status, 413, 'an image over the ceiling is refused');
  c.eq(refused.data?.error?.code, 'HANDWRITING_IMAGE_TOO_LARGE', 'by the code the client understands — this used to be unreachable');

  // Over the parser: the app-level handler, which is the only thing that sees it.
  const overParser = image(1_400_000);
  c.ok(bodyBytes(overParser) > JSON_BODY_LIMIT_BYTES, 'the second body is genuinely past the parser limit');
  const tooBig = await transcribe(overParser);
  c.eq(tooBig.status, 413, 'a body past the parser is a 413');
  c.eq(tooBig.data?.error?.code, 'REQUEST_BODY_TOO_LARGE', 'and carries a code, so "shrink it" is distinguishable from "the server broke"');
  c.ok(!/Something went wrong/.test(tooBig.text), 'rather than a bare server-fault string');
} finally {
  await app.close();
  db.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`REQUEST SIZE — PASS — ${c.count()}/${c.count()} checks — the advertised image ceiling fits the transport and sits above the client's budget, and both refusals arrive as codes.`);
