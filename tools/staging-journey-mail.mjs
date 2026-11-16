// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staging journey's email LINKS (read-only IMAP, bodies).
//
// tools/staging-inbox.mjs reads six-digit codes from subject lines and never
// fetches a body. A guardian's consent and withdrawal links are in the body,
// so this reads exactly those two kinds of mail, by their subject, with
// BODY.PEEK (nothing is marked read), from the same owner-only inbox file.
// The link is returned to the caller and never printed, logged or written to
// evidence: it is a bearer credential for the guardian's consent.
//
//   guardian-consent  "Confirm your child’s Pri Learning account"
//                     → <origin>/guardian/consent#action=guardian-consent&token=…
//   guardian-withdraw "Your child’s Pri Learning account is confirmed — keep this email"
//                     → <origin>/account-action#action=guardian-withdraw&token=…
//
// TLS only, as staging-inbox.mjs: the config it is given has already refused a
// plain-text port (loadInbox).
// ─────────────────────────────────────────────────────────────────────────────
import { connect as tlsConnect } from 'node:tls';
import { decodeHeader } from './staging-inbox.mjs';

export const LINK_SUBJECTS = Object.freeze({
  'guardian-consent': /^Confirm your child.s Pri Learning account$/,
  'guardian-withdraw': /^Your child.s Pri Learning account is confirmed/
});
const LINK_PATH = { 'guardian-consent': '/guardian/consent', 'guardian-withdraw': '/account-action' };

/** Which link mail a subject is, or null. */
export function linkKindOfSubject(subject) {
  const s = decodeHeader(String(subject || '')).trim();
  return Object.keys(LINK_SUBJECTS).find(kind => LINK_SUBJECTS[kind].test(s)) || null;
}

/** Quoted-printable to text (soft line breaks joined, =XX decoded as UTF-8). */
export function decodeQuotedPrintable(text) {
  const joined = String(text).replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < joined.length; i++) {
    const ch = joined[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) { bytes.push(parseInt(joined.slice(i + 1, i + 3), 16)); i += 2; }
    else for (const b of Buffer.from(ch, 'utf8')) bytes.push(b);
  }
  return Buffer.from(bytes).toString('utf8');
}

/**
 * The action link of `kind` for `origin` in a raw message body, whatever the
 * transfer encoding of its parts (plain, quoted-printable or base64), or null.
 * `&amp;` from an HTML part is undone. Only a link to `origin` is accepted.
 */
export function linkFromBody(body, kind, origin) {
  if (!LINK_PATH[kind]) throw new Error(`unknown link kind ${kind}`);
  const raw = String(body || '');
  const candidates = [raw, decodeQuotedPrintable(raw)];
  // Base64 parts: any run of base64 lines long enough to be a part body.
  for (const block of raw.match(/(?:^[A-Za-z0-9+/=]{20,}\r?\n){2,}/gm) || []) {
    try { candidates.push(Buffer.from(block.replace(/\s+/g, ''), 'base64').toString('utf8')); } catch { /* not base64 */ }
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${esc(origin.replace(/\/$/, ''))}${esc(LINK_PATH[kind])}#[^\\s"'<>]+`);
  for (const text of candidates) {
    const m = re.exec(text.replace(/&amp;/g, '&'));
    if (!m) continue;
    const link = m[0];
    const hash = new URLSearchParams(link.slice(link.indexOf('#') + 1));
    if (hash.get('action') === kind && /^[A-Za-z0-9_-]{16,512}$/.test(hash.get('token') || '')) return link;
  }
  return null;
}

const quote = s => {
  if (/[\r\n]/.test(s)) throw new Error('IMAP value contains a line break');
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

/**
 * A minimal IMAP session that can read bodies: LOGIN, SELECT INBOX, UID SEARCH,
 * UID FETCH (BODY.PEEK). `open` returns a connected stream (TLS in use; a plain
 * socket in tests). Literal-aware: a FETCH reply's {n} literal is read whole.
 */
export function imapBodySession(open) {
  let socket, buf = '', waiting = null, seq = 0;
  const pump = () => {
    if (!waiting) return;
    // Skip over literals so a body that contains "L3 OK" cannot end a command.
    let at = 0;
    for (;;) {
      const nl = buf.indexOf('\r\n', at);
      if (nl < 0) return;
      const line = buf.slice(at, nl);
      const lit = /\{(\d+)\}$/.exec(line);
      if (lit) {
        // A literal's length is in bytes; the buffer is text. Consume code
        // points until their UTF-8 size reaches it, or wait for more data.
        const need = Number(lit[1]);
        let bytes = 0, j = nl + 2;
        while (j < buf.length && bytes < need) {
          const cp = buf.codePointAt(j);
          bytes += Buffer.byteLength(String.fromCodePoint(cp));
          j += cp > 0xffff ? 2 : 1;
        }
        if (bytes < need) return;
        at = j;
        continue;
      }
      if (line.startsWith(`${waiting.tag} `)) {
        const body = buf.slice(0, at); const status = line;
        buf = buf.slice(nl + 2);
        const w = waiting; waiting = null;
        if (/^\S+ OK/.test(status)) w.resolve(body); else w.reject(new Error(`IMAP ${status.replace(/^\S+ /, '').slice(0, 80)}`));
        return;
      }
      at = nl + 2;
    }
  };
  const command = text => new Promise((resolve, reject) => {
    const tag = `L${++seq}`;
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
    /** [{ subject, at, body }] of mail to `to` since `sinceDate`, newest last. */
    async messagesTo(to, sinceDate) {
      const day = sinceDate.toUTCString().slice(5, 16).replace(/ /g, '-');
      const found = await command(`UID SEARCH SINCE ${day} TO ${quote(to)}`);
      const uids = (/\* SEARCH([\d ]*)/.exec(found)?.[1] || '').trim().split(/\s+/).filter(Boolean);
      const out = [];
      for (const uid of uids.slice(-10)) {
        const head = await command(`UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (SUBJECT DATE)])`);
        const subject = /^Subject:\s*((?:.*)(?:\r\n[ \t].*)*)/mi.exec(head)?.[1]?.replace(/\r\n[ \t]/g, ' ');
        if (!linkKindOfSubject(subject)) continue;
        const date = /^Date:\s*(.*)$/mi.exec(head)?.[1];
        const body = await command(`UID FETCH ${uid} (BODY.PEEK[TEXT])`);
        out.push({ subject: decodeHeader(subject), at: date ? Date.parse(date) : 0, body });
      }
      return out.sort((a, b) => a.at - b.at);
    },
    async logout() { try { await command('LOGOUT'); } catch { /* closing anyway */ } socket?.end?.(); }
  };
}

/** Poll for the newest link of `kind` to `to` after `since`. { link, waitedMs } or { link: null, waitedMs }. */
export function linkReaderOver(session, config, origin, { pollMs = 5000 } = {}) {
  return {
    async waitForLink(to, kind, since, timeoutMs = 120000) {
      const started = Date.now();
      const s = session();
      await s.login(config.PRI_STAGING_INBOX_USER, config.PRI_STAGING_INBOX_PASSWORD);
      try {
        for (;;) {
          const mail = await s.messagesTo(to, new Date(since - 24 * 3600 * 1000));
          const hit = mail.filter(m => (!m.at || m.at >= since - 60000) && linkKindOfSubject(m.subject) === kind)
            .map(m => linkFromBody(m.body, kind, origin)).filter(Boolean).at(-1);
          if (hit) return { link: hit, waitedMs: Date.now() - started };
          if (Date.now() - started > timeoutMs) return { link: null, waitedMs: Date.now() - started };
          await new Promise(r => setTimeout(r, pollMs));
        }
      } finally { await s.logout(); }
    }
  };
}

/** The live link reader: TLS to the configured host, links only to `origin`. */
export function imapLinkReader(config, origin) {
  const open = () => new Promise((resolve, reject) => {
    const s = tlsConnect({ host: config.PRI_STAGING_INBOX_IMAP_HOST, port: Number(config.PRI_STAGING_INBOX_IMAP_PORT), servername: config.PRI_STAGING_INBOX_IMAP_HOST, timeout: 20000 }, () => resolve(s));
    s.once('error', reject);
  });
  return linkReaderOver(() => imapBodySession(open), config, origin);
}
