// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staging journey's test inbox (read-only IMAP).
//
// The owner keeps one dedicated test mailbox for staging email codes, and its
// settings in ~/Developer/.pri-fleet/staging-inbox.env (mode 600, outside the
// repository):
//   PRI_STAGING_INBOX_ADDRESS, PRI_STAGING_INBOX_IMAP_HOST, PRI_STAGING_INBOX_IMAP_PORT,
//   PRI_STAGING_INBOX_USER, PRI_STAGING_INBOX_PASSWORD
// Nothing here prints, logs or returns any of those values. Each test account
// gets a plus-address, <local>+pri-<run>-<n>@<domain>, and evidence shows only
// the tag. Codes are read from the Subject line Pri sends ("123456 is your Pri
// Learning code", "… to delete …", "… to approve your child's …"), so only
// headers are fetched, with BODY.PEEK so nothing is marked read.
// TLS only: a plain-text IMAP port is refused.
// ─────────────────────────────────────────────────────────────────────────────
import { connect as tlsConnect } from 'node:tls';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const INBOX_FILE = join(homedir(), 'Developer', '.pri-fleet', 'staging-inbox.env');
const KEYS = ['PRI_STAGING_INBOX_ADDRESS', 'PRI_STAGING_INBOX_IMAP_HOST', 'PRI_STAGING_INBOX_IMAP_PORT', 'PRI_STAGING_INBOX_USER', 'PRI_STAGING_INBOX_PASSWORD'];

/** { ok, reason, config }. `reason` never contains a value from the file. */
export function loadInbox(file = INBOX_FILE) {
  if (!existsSync(file)) return { ok: false, reason: 'the inbox file does not exist' };
  const mode = statSync(file).mode & 0o777;
  if (mode & 0o077) return { ok: false, reason: `the inbox file is mode ${mode.toString(8)}; it must be 600 (owner-only)` };
  const config = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    config[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  const missing = KEYS.filter(k => !config[k]);
  if (missing.length) return { ok: false, reason: `the inbox file lacks ${missing.join(', ')}` };
  if (!/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(config.PRI_STAGING_INBOX_ADDRESS)) return { ok: false, reason: 'PRI_STAGING_INBOX_ADDRESS is not a plain address (no plus tag of its own)' };
  if (!/^\d+$/.test(config.PRI_STAGING_INBOX_IMAP_PORT) || config.PRI_STAGING_INBOX_IMAP_PORT === '143') return { ok: false, reason: 'PRI_STAGING_INBOX_IMAP_PORT must be the IMAPS (TLS) port, e.g. 993' };
  return { ok: true, reason: null, config };
}

/** <local>+pri-<run>-<n>@<domain> */
export function tagAddress(address, run, n) {
  const at = address.lastIndexOf('@');
  return `${address.slice(0, at)}+pri-${run}-${n}@${address.slice(at + 1)}`;
}

/** Every appearance of the inbox address (tagged or not) becomes its tag alone. */
export function redactAddress(text, address) {
  if (!address) return text;
  const at = address.lastIndexOf('@');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const local = esc(address.slice(0, at)); const domain = esc(address.slice(at + 1));
  return String(text)
    .replace(new RegExp(`${local}\\+(pri-[a-z0-9-]+)@${domain}`, 'gi'), '<inbox>+$1')
    .replace(new RegExp(`${local}@${domain}`, 'gi'), '<inbox>');
}

/** RFC 2047 encoded words (=?UTF-8?B?…?= / =?UTF-8?Q?…?=) to text. */
export function decodeHeader(value) {
  return String(value).replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset, enc, data) => {
    const bytes = /b/i.test(enc) ? Buffer.from(data, 'base64')
      : Buffer.from(data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
    try { return new TextDecoder(charset.toLowerCase()).decode(bytes); } catch { return bytes.toString('utf8'); }
  }).replace(/\?=\s+=\?/g, '');
}

/** The six-digit code a Pri subject leads with, and what it is for. */
export function codeFromSubject(subject) {
  const s = decodeHeader(subject).trim();
  const m = /^(\d{6}) is (?:your Pri Learning code|the code to (delete|approve))/.exec(s);
  if (!m) return null;
  return { code: m[1], purpose: m[2] === 'delete' ? 'delete' : m[2] === 'approve' ? 'guardian' : 'sign-in' };
}

const quote = s => {
  if (/[\r\n]/.test(s)) throw new Error('IMAP credential contains a line break');
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

/**
 * A minimal IMAP session: LOGIN, SELECT INBOX, UID SEARCH, UID FETCH headers.
 * `open` returns a connected duplex stream (TLS in use; a plain socket in tests).
 */
export function imapSession(open) {
  let socket, buf = '', waiting = null, seq = 0;
  const pump = () => {
    if (!waiting) return;
    const end = buf.indexOf(`\r\n${waiting.tag} `) >= 0 ? buf.indexOf(`\r\n${waiting.tag} `) + 2 : (buf.startsWith(`${waiting.tag} `) ? 0 : -1);
    if (end < 0) return;
    const lineEnd = buf.indexOf('\r\n', end);
    if (lineEnd < 0) return;
    const body = buf.slice(0, end); const status = buf.slice(end, lineEnd);
    buf = buf.slice(lineEnd + 2);
    const w = waiting; waiting = null;
    if (/^\S+ OK/.test(status)) w.resolve(body); else w.reject(new Error(`IMAP ${status.replace(/^\S+ /, '').slice(0, 80)}`));
  };
  const command = text => new Promise((resolve, reject) => {
    const tag = `P${++seq}`;
    waiting = { tag, resolve, reject };
    socket.write(`${tag} ${text}\r\n`);
    pump();
  });
  return {
    async login(user, password) {
      socket = await open();
      socket.setEncoding?.('utf8');
      await new Promise((resolve, reject) => {
        const greet = d => { buf += d; if (buf.includes('\r\n')) { socket.off('data', greet); buf = buf.slice(buf.indexOf('\r\n') + 2); socket.on('data', more => { buf += more; pump(); }); resolve(); } };
        socket.on('data', greet); socket.once('error', reject);
      });
      socket.on('error', err => { if (waiting) { const w = waiting; waiting = null; w.reject(err); } });
      await command(`LOGIN ${quote(user)} ${quote(password)}`);
      await command('SELECT INBOX');
    },
    /** Subjects of mail to `to` since `sinceDate` (a Date), newest last. */
    async subjectsTo(to, sinceDate) {
      const day = sinceDate.toUTCString().slice(5, 16).replace(/ /g, '-');   // e.g. 09-Nov-2026
      const found = await command(`UID SEARCH SINCE ${day} TO ${quote(to)}`);
      const uids = (/\* SEARCH([\d ]*)/.exec(found)?.[1] || '').trim().split(/\s+/).filter(Boolean);
      if (!uids.length) return [];
      const fetched = await command(`UID FETCH ${uids.join(',')} (BODY.PEEK[HEADER.FIELDS (SUBJECT TO DATE)])`);
      const out = [];
      for (const block of fetched.split(/\r\n(?=\* \d+ FETCH)/)) {
        const subject = /^Subject:\s*((?:.*)(?:\r\n[ \t].*)*)/mi.exec(block)?.[1]?.replace(/\r\n[ \t]/g, ' ');
        const date = /^Date:\s*(.*)$/mi.exec(block)?.[1];
        if (subject) out.push({ subject: decodeHeader(subject), at: date ? Date.parse(date) : 0 });
      }
      return out.sort((a, b) => a.at - b.at);
    },
    async logout() { try { await command('LOGOUT'); } catch { /* closing anyway */ } socket?.end?.(); }
  };
}

/** The live mailbox: TLS to the configured host. */
export function imapMailbox(config) {
  const open = () => new Promise((resolve, reject) => {
    const s = tlsConnect({ host: config.PRI_STAGING_INBOX_IMAP_HOST, port: Number(config.PRI_STAGING_INBOX_IMAP_PORT), servername: config.PRI_STAGING_INBOX_IMAP_HOST, timeout: 20000 }, () => resolve(s));
    s.once('error', reject);
  });
  return mailboxOver(() => imapSession(open), config);
}

/** Poll for the newest code of `purpose` sent to `to` after `since`. Returns { code, waitedMs } or { code: null, waitedMs }. */
export function mailboxOver(session, config, { pollMs = 5000 } = {}) {
  return {
    async waitForCode(to, purpose, since, timeoutMs = 120000) {
      const started = Date.now();
      const s = session();
      await s.login(config.PRI_STAGING_INBOX_USER, config.PRI_STAGING_INBOX_PASSWORD);
      try {
        for (;;) {
          const subjects = await s.subjectsTo(to, new Date(since - 24 * 3600 * 1000));
          const hit = subjects.filter(m => !m.at || m.at >= since - 60000).map(m => codeFromSubject(m.subject)).filter(c => c && c.purpose === purpose).at(-1);
          if (hit) return { code: hit.code, waitedMs: Date.now() - started };
          if (Date.now() - started > timeoutMs) return { code: null, waitedMs: Date.now() - started };
          await new Promise(r => setTimeout(r, pollMs));
        }
      } finally { await s.logout(); }
    }
  };
}
