// Pri Learning · figure reference rule
//
// A figure (inline SVG) may point at something only inside itself:
// url(#localId) in a paint or style value, href="#localId" on a reference.
// Any other url(...) — https:, a relative path, a protocol-relative or
// CSS-escaped reference — would make the browser fetch it when the figure is
// shown: an outbound request from a figure is a tracking and privacy leak.
// One rule, used by the archive validator, the client sanitiser and the server.

const URL_REF = /url\s*\(/gi;
const LOCAL_URL_REF = /url\(\s*(['"]?)#[A-Za-z_][\w.-]*\1\s*\)/gi;
const HREF_ATTR = /\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** Does this attribute/style value reference anything outside the figure? */
export function hasNonLocalUrlRef(value) {
  const text = String(value);
  // A CSS escape can spell url( without its letters (u\72l); a figure never
  // needs a backslash in a value, so any backslash is refused outright.
  if (text.includes('\\')) return true;
  const all = (text.match(URL_REF) || []).length;
  const local = (text.match(LOCAL_URL_REF) || []).length;
  return local !== all;
}

/** Does a whole SVG document reference anything outside itself? */
export function figureHasExternalRef(svg) {
  const text = String(svg);
  if (hasNonLocalUrlRef(text)) return true;
  HREF_ATTR.lastIndex = 0;
  let m;
  while ((m = HREF_ATTR.exec(text))) {
    const target = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!/^#[A-Za-z_][\w.-]*$/.test(target)) return true;
  }
  return false;
}
