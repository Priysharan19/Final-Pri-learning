// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · real-photo acceptance — shared plumbing
//
// HTTP as a browser sends it, the test account made through the server's own
// routes, and the app's own photo preparation running in Chromium. Nothing
// here holds the provider credential.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');

export function makeHttp(origin) {
  return async function request(path, { method = 'GET', body, jar = null, headers = {} } = {}) {
    const send = { Accept: 'application/json', ...headers };
    if (jar) {
      const cookies = Object.entries(jar).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookies) send.Cookie = cookies;
      if (!['GET', 'HEAD'].includes(method) && jar.pri_csrf) send['x-pri-csrf'] = jar.pri_csrf;
    }
    if (body !== undefined) send['Content-Type'] = 'application/json';
    const started = Date.now();
    let response;
    try {
      response = await fetch(origin + path, { method, headers: send, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    } catch (error) {
      // A dropped connection is an outcome to report, not a crash of the run.
      return { status: 0, data: null, ms: Date.now() - started, code: 'NETWORK_FAILED', networkError: String(error?.cause?.code || error?.name || 'fetch failed') };
    }
    if (jar) {
      for (const raw of response.headers.getSetCookie?.() || []) {
        const first = String(raw).split(';', 1)[0];
        const at = first.indexOf('=');
        if (at > 0) jar[first.slice(0, at)] = first.slice(at + 1);
      }
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data, ms: Date.now() - started, code: data?.error?.code || null };
  };
}

const requireServer = createRequire(join(REPO, 'server', 'package.json'));
const requireClient = createRequire(join(REPO, 'client', 'package.json'));

export async function localSecrets() {
  const Database = requireServer('better-sqlite3');
  const crypto = await import(pathToFileURL(join(REPO, 'server', 'platform', 'deliveryCrypto.js')).href);
  /** The link the local server queued for a mailbox, read from its own outbox (read-only). */
  function queuedToken(dbPath, accountId, kind) {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const row = db.prepare(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox
        WHERE account_id=? AND kind=? AND delivered_at IS NULL ORDER BY created_at DESC`).get(accountId, kind);
      return row ? crypto.decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`) : null;
    } finally { db.close(); }
  }
  return { queuedToken, encryptDeliveryToken: crypto.encryptDeliveryToken };
}

/**
 * A student account made the way the product makes one: registered naming a
 * guardian, the email verified and the guardian's consent given with the links
 * the local server queued. No row is written by this script and no gate skipped.
 */
export async function enrol(http, dbPath, label, secrets) {
  const jar = {};
  const tag = randomBytes(4).toString('hex');
  const register = await http('/v1/account/register', { method: 'POST', jar, body: {
    name: 'Acceptance Student', email: `photo.${label}.${tag}@example.test`,
    password: `Ph-${randomBytes(12).toString('base64url')}`, deviceId: `acceptance-photo-${label}`,
    year: '11', guardianName: 'Acceptance Guardian', guardianEmail: `guardian.${label}.${tag}@example.test`
  } });
  if (register.status !== 201) throw new Error(`register ${label}: ${register.status} ${register.code}`);
  const accountId = register.data.account.id;
  const verify = await http('/v1/account/email/verify', { method: 'POST', body: { token: secrets.queuedToken(dbPath, accountId, 'verify-email') } });
  if (verify.status !== 200) throw new Error(`verify email ${label}: ${verify.status} ${verify.code}`);
  const consentToken = secrets.queuedToken(dbPath, accountId, 'guardian-consent');
  if (consentToken) {
    const consent = await http('/v1/account/guardian/confirm', { method: 'POST', body: { token: consentToken } });
    if (consent.status !== 200 || consent.data?.confirmed !== true) throw new Error(`guardian confirm ${label}: ${consent.status} ${consent.code}`);
  }
  const state = await http('/v1/account/guardian/state', { jar });
  return { jar, accountId, consentState: state.data?.state ?? null, ageBasis: state.data?.ageBasis ?? null };
}

/**
 * The app's own image code, in Chromium: client/src/ink/photoRaster.js turns a
 * camera file into what Photo mode sends. Nothing is fetched from the network.
 */
export async function openStudio({ engine = 'chromium' } = {}) {
  const playwright = requireClient('playwright');
  if (!['chromium', 'webkit', 'firefox'].includes(engine)) throw new Error(`unknown browser engine ${engine}`);
  const browser = await playwright[engine].launch();
  const page = await browser.newPage();
  const ORIGIN = 'http://pri-acceptance.invalid';
  const modules = { '/ink/photoRaster.js': join(REPO, 'client', 'src', 'ink', 'photoRaster.js') };
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>photo studio</title>' });
    const file = modules[url.pathname];
    if (!file) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: 'text/javascript', body: readFileSync(file, 'utf8') });
  });
  await page.goto(ORIGIN + '/');
  return {
    close: () => browser.close(),
    /** The app's own quarter-turn (client rotatePhoto), from the original. */
    rotatePhoto: (dataUrl, turns) => page.evaluate(async ([d, n]) => {
      const { rotatePhoto } = await import('/ink/photoRaster.js');
      const out = await rotatePhoto(d, n);
      return out ? { dataUrl: out.dataUrl, width: out.width, height: out.height } : null;
    }, [dataUrl, turns]),
    /** The size a browser decodes a picture at — after it has applied the file's own orientation. */
    sizeOf: dataUrl => page.evaluate(d => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('undecodable'));
      img.src = d;
    }), dataUrl),
    /**
     * How unlike two pictures are: the mean absolute difference of their grey
     * levels (0–255) after both are drawn into the same small box. A few units
     * is JPEG noise; the same page a quarter turn round is tens of units.
     */
    unlikeness: (a, b) => page.evaluate(async ([x, y]) => {
      const load = d => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('undecodable')); i.src = d; });
      const grey = async d => {
        const img = await load(d);
        const c = document.createElement('canvas'); c.width = 96; c.height = 120;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 96, 120);
        const px = ctx.getImageData(0, 0, 96, 120).data, out = [];
        for (let i = 0; i < px.length; i += 4) out.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
        return out;
      };
      const [p, q] = [await grey(x), await grey(y)];
      return p.reduce((sum, v, i) => sum + Math.abs(v - q[i]), 0) / p.length;
    }, [a, b]),
    /** A camera file → what the app's Photo mode sends (client preparePhoto). */
    preparePhoto: dataUrl => page.evaluate(async d => {
      const { preparePhoto } = await import('/ink/photoRaster.js');
      const out = await preparePhoto(d);
      return out ? { dataUrl: out.dataUrl, width: out.width, height: out.height, bytes: out.bytes, quality: out.quality, scaledFrom: out.scaledFrom } : null;
    }, dataUrl),
    /**
     * SIMULATED handwriting: lines of text set in a hand-like face on ruled
     * paper, turned a little, as a JPEG camera file. `damage` makes the
     * unreadable pages: 'blur' (out of focus) or 'crop' (only a corner kept).
     */
    simulatedPage: ({ lines, seed = 1, degrees = 2, damage = null, quarterTurns = 0 }) => page.evaluate(({ lines, seed, degrees, damage, quarterTurns }) => {
      let a = seed >>> 0;
      const rand = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const W = 1200, H = 1500;
      const sheet = document.createElement('canvas');
      sheet.width = W; sheet.height = H;
      const ctx = sheet.getContext('2d');
      ctx.fillStyle = '#f1ead8';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6000; i += 1) {
        ctx.fillStyle = `rgba(${90 + rand() * 60 | 0},${80 + rand() * 50 | 0},${60 + rand() * 40 | 0},${0.03 + rand() * 0.05})`;
        ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
      }
      ctx.translate(W / 2, H / 2);
      ctx.rotate(degrees * Math.PI / 180);
      ctx.translate(-W / 2, -H / 2);
      ctx.strokeStyle = 'rgba(120,150,190,0.5)';
      ctx.lineWidth = 1.3;
      const pitch = 84;
      for (let y = 120; y < H + 200; y += pitch) { ctx.beginPath(); ctx.moveTo(-200, y); ctx.lineTo(W + 200, y); ctx.stroke(); }
      ctx.fillStyle = '#1c2a66';
      ctx.textBaseline = 'alphabetic';
      let row = 0;
      for (const line of lines) {
        if (line === '') { row += 2; continue; }                 // a blank gap on the page
        let x = 150 + rand() * 30;
        const y = 120 + pitch * (row + 1) - 8;
        for (const ch of line) {
          const size = 52 + rand() * 8;
          ctx.font = `${size}px "Bradley Hand", "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive`;
          ctx.save();
          ctx.translate(x, y + (rand() - 0.5) * 6);
          ctx.rotate((rand() - 0.5) * 0.09);
          ctx.fillText(ch, 0, 0);
          ctx.restore();
          x += ctx.measureText(ch).width + (ch === ' ' ? 6 : 1.5) + rand() * 2;
        }
        row += 1;
      }
      let out = sheet;
      if (damage === 'blur') {
        const soft = document.createElement('canvas');
        soft.width = W; soft.height = H;
        const sctx = soft.getContext('2d');
        sctx.filter = 'blur(22px)';
        sctx.drawImage(sheet, 0, 0);
        out = soft;
      } else if (damage === 'crop') {
        // Only a sliver through the middle of the writing survives the crop.
        const cut = document.createElement('canvas');
        cut.width = 230; cut.height = 190;
        cut.getContext('2d').drawImage(sheet, 330, 250, 230, 190, 0, 0, 230, 190);
        out = cut;
      }
      for (let i = 0; i < quarterTurns; i += 1) {
        const turned = document.createElement('canvas');
        turned.width = out.height; turned.height = out.width;
        const tctx = turned.getContext('2d');
        tctx.translate(turned.width, 0);
        tctx.rotate(Math.PI / 2);
        tctx.drawImage(out, 0, 0);
        out = turned;
      }
      return out.toDataURL('image/jpeg', 0.9);
    }, { lines, seed, degrees, damage, quarterTurns })
  };
}

/**
 * The same JPEG with an EXIF orientation tag (1–8) written into it, the way a
 * phone camera held sideways writes one. The pixels are untouched.
 */
export function withExifOrientation(dataUrl, orientation) {
  const jpeg = bytesOf(dataUrl);
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('not a JPEG');
  const tiff = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,        // little-endian TIFF, first IFD at 8
    0x01, 0x00,                                            // one entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation & 0xff, 0x00, 0x00, 0x00,   // 0x0112 Orientation, SHORT
    0x00, 0x00, 0x00, 0x00                                 // no further IFD
  ]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
  return 'data:image/jpeg;base64,' + Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]).toString('base64');
}

export const bytesOf = dataUrl => Buffer.from(String(dataUrl).slice(String(dataUrl).indexOf(',') + 1), 'base64');
