// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · text that can be stored as text
//
// Two kinds of string are not text a TEXT column can hold faithfully:
//
//   · U+0000. Postgres refuses it outright ("invalid byte sequence for encoding
//     UTF8: 0x00"), so a name, class title, device id or report note carrying
//     one turned a sign-up or a sign-in into a 500 on the production engine
//     while SQLite quietly stored it.
//   · A lone UTF-16 surrogate (half an emoji). It has no UTF-8 encoding; the
//     driver silently replaces it with U+FFFD, so what is stored is not what
//     was sent.
//
// Requests carrying either are refused with a coded 400 before any handler
// runs. The one exemption is sync push: its free-text fields are opaque JSON
// payloads that are stored JSON-escaped (so they are safe), and refusing them
// would wedge a device's outbox on a batch it can never change.
//
// clipText() is the other half: clipping a name to N UTF-16 code units must
// not itself manufacture a lone surrogate by cutting an emoji in two.
// ─────────────────────────────────────────────────────────────────────────────

const UNSAFE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function unsafeText(value) {
  return typeof value === 'string' && UNSAFE.test(value);
}

/** The first key or string value (searched iteratively, any depth) that is not storable text. */
export function findUnsafeText(root) {
  const stack = [root];
  while (stack.length) {
    const value = stack.pop();
    if (typeof value === 'string') {
      if (UNSAFE.test(value)) return true;
    } else if (value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        if (UNSAFE.test(key)) return true;
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
  const cleaned = String(value ?? '').replace(new RegExp(UNSAFE.source, 'g'), '');
  return clipText(cleaned.trim(), max);
}

function refuse(res) {
  return res.status(400).json({ error: { code: 'INVALID_TEXT', message: 'The request contains characters that cannot be stored as text.' } });
}

/**
 * Refuse a request whose URL, query or JSON body carries a NUL or a lone
 * surrogate. `exemptBody` lists path patterns (relative to the mount) whose
 * bodies are opaque JSON and are not checked.
 */
export function rejectUnsafeText({ exemptBody = [] } = {}) {
  return (req, res, next) => {
    const url = String(req.originalUrl || req.url || '');
    if (/%00/i.test(url)) return refuse(res);
    let decodedPath;
    try { decodedPath = decodeURIComponent(url.split('?', 1)[0]); } catch { decodedPath = ''; }
    if (UNSAFE.test(decodedPath)) return refuse(res);
    if (findUnsafeText(req.query)) return refuse(res);
    if (req.body && typeof req.body === 'object' && !exemptBody.some(pattern => pattern.test(req.path))) {
      if (findUnsafeText(req.body)) return refuse(res);
    }
    next();
  };
}
