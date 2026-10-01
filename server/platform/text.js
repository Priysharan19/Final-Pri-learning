// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · text that can be stored as text
//
// U+0000 is not text a Postgres TEXT column can hold: Postgres refuses it
// outright ("invalid byte sequence for encoding UTF8: 0x00"), so a name, class
// title, device id, report note — or an id in the URL — carrying one turned a
// sign-up, a sign-in or a lookup into a 500 on the production engine while
// SQLite quietly stored it. Requests carrying a NUL anywhere in the URL, query
// or JSON body are refused with a coded 400 before any handler runs. The one
// exemption is sync push: its free-text fields are opaque JSON payloads that
// are stored JSON-escaped (so they are safe), and refusing them would wedge a
// device's outbox on a batch it can never change.
//
// A lone UTF-16 surrogate (half an emoji) is different: it cannot crash either
// engine — both drivers store U+FFFD in its place — and clients that clip
// strings (telemetry does) can produce one innocently, so it is not refused.
// What the server must not do is manufacture one itself: clipText() clips to N
// UTF-16 code units without cutting a surrogate pair in two, and
// storableText() cleans text that never passed through a request body (a
// provider's identity claims).
// ─────────────────────────────────────────────────────────────────────────────

const NUL = /\u0000/;
const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** Whether any key or string value (searched iteratively, any depth) carries a NUL. */
export function findUnsafeText(root) {
  const stack = [root];
  while (stack.length) {
    const value = stack.pop();
    if (typeof value === 'string') {
      if (NUL.test(value)) return true;
    } else if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (NUL.test(key)) return true;
        stack.push(value[key]);
      }
    }
  }
  return false;
}

/** Clip to at most `max` UTF-16 code units without splitting a surrogate pair. */
export function clipText(value, max) {
  let text = String(value ?? '');
  if (text.length <= max) return text;
  text = text.slice(0, max);
  if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
  return text;
}

/**
 * For text that arrives from somewhere other than a request body — a provider's
 * signed identity claims — and so never met rejectUnsafeText(): drop what cannot
 * be stored, then clip safely.
 */
export function storableText(value, max) {
  const cleaned = String(value ?? '').replace(UNSTORABLE, '');
  return clipText(cleaned.trim(), max);
}

function refuse(res) {
  return res.status(400).json({ error: { code: 'INVALID_TEXT', message: 'The request contains characters that cannot be stored as text.' } });
}

/**
 * Refuse a request whose URL, query or JSON body carries a NUL. `exemptBody` lists path patterns (relative to the mount) whose
 * bodies are opaque JSON and are not checked.
 */
export function rejectUnsafeText({ exemptBody = [] } = {}) {
  return (req, res, next) => {
    const url = String(req.originalUrl || req.url || '');
    if (/%00/i.test(url)) return refuse(res);
    let decodedPath;
    try { decodedPath = decodeURIComponent(url.split('?', 1)[0]); } catch { decodedPath = ''; }
    if (NUL.test(decodedPath)) return refuse(res);
    if (findUnsafeText(req.query)) return refuse(res);
    if (req.body && typeof req.body === 'object' && !exemptBody.some(pattern => pattern.test(req.path))) {
      if (findUnsafeText(req.body)) return refuse(res);
    }
    next();
  };
}
