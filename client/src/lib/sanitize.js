// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Untrusted input sanitiser
// Task packs, backups and progress files arrive as files — AirDropped between
// people who have never met — and question figures render as raw markup. Every
// value that crosses that boundary is rebuilt here from an allowlist. Nothing
// is passed through: what is not named below does not survive.
// ─────────────────────────────────────────────────────────────────────────────

// The complete vocabulary of ../engine/figures.js, which draws every legitimate
// figure in the app. script / style / foreignObject / iframe / object / embed /
// use are absent, so they are dropped along with everything else unnamed.
const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'text']);

// Likewise every attribute figures.js emits. No href, src or xlink:href appears
// here, so no attribute survives that could carry a URL of any scheme at all.
const ALLOWED_ATTRS = new Set([
  'viewbox', 'role', 'aria-label', 'style',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'width', 'height',
  'd', 'points',
  'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'font-size', 'font-family', 'font-style', 'font-weight', 'text-anchor'
]);

// The HTML parser lower-cases SVG attribute names; these go back out cased.
const CASED_ATTRS = { viewbox: 'viewBox' };

// figures.js only ever inline-styles the outer <svg> box.
const ALLOWED_STYLE_PROPS = new Set(['max-width', 'width', 'height', 'display']);

// Second belt on the values that do survive: no scheme, no protocol-relative
// reference, no markup smuggled back in through an attribute.
const UNSAFE_VALUE = /(?:javascript|vbscript|data|blob|file)\s*:|^\s*\/\/|[<>]/i;

const MAX_FIGURE = 20000;
const MAX_DEPTH = 8;
const MAX_NODES = 600;

const escapeText = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = s => escapeText(s).replace(/"/g, '&quot;');

/** Keep only presentational declarations, and drop the attribute on any doubt. */
function safeStyle(value) {
  const kept = [];
  for (const decl of String(value).split(';')) {
    const text = decl.trim();
    if (!text) continue;
    const split = text.indexOf(':');
    if (split < 1) return '';
    const prop = text.slice(0, split).trim().toLowerCase();
    const val = text.slice(split + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop) || !val || /[(){}\\"'@]/.test(val)) return '';
    kept.push(`${prop}:${val}`);
  }
  return kept.join(';');
}

/** → ` name="value"` for one attribute, or '' when it fails the allowlist. */
function safeAttr(rawName, rawValue) {
  const name = String(rawName).toLowerCase();
  if (name.startsWith('on') || name.includes(':') || !ALLOWED_ATTRS.has(name)) return '';
  let value = String(rawValue);
  if (UNSAFE_VALUE.test(value)) return '';
  if (name === 'style') {
    value = safeStyle(value);
    if (!value) return '';
  }
  return ` ${CASED_ATTRS[name] || name}="${escapeAttr(value)}"`;
}

// ── Browser path: parse into an inert document, then rebuild ─────────────────

function cleanNodes(parent, depth, budget) {
  let out = '';
  for (const node of Array.from(parent.childNodes || [])) {
    if (node.nodeType === 3) { out += escapeText(node.nodeValue); continue; }
    if (node.nodeType !== 1 || depth >= MAX_DEPTH || budget.left-- <= 0) continue;
    const tag = String(node.localName || '').toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    let attrs = '';
    for (const at of Array.from(node.attributes || [])) attrs += safeAttr(at.name, at.value);
    const inner = cleanNodes(node, depth + 1, budget);
    out += inner ? `<${tag}${attrs}>${inner}</${tag}>` : `<${tag}${attrs}/>`;
  }
  return out;
}

// ── Node path: no DOM, so the same allowlist is applied by scanning ──────────

const TAG = /<\/?([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
const ATTR = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function cleanTag(whole, name, rawAttrs) {
  const tag = String(name).toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return '';
  if (whole.startsWith('</')) return `</${tag}>`;
  let attrs = '';
  let m;
  ATTR.lastIndex = 0;
  while ((m = ATTR.exec(rawAttrs))) attrs += safeAttr(m[1], m[2] ?? m[3] ?? m[4] ?? '');
  return `<${tag}${attrs}${/\/\s*$/.test(rawAttrs) ? '/' : ''}>`;
}

function cleanMarkup(src) {
  const stripped = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|foreignobject|iframe|object|embed)\b[\s\S]*?(?:<\s*\/\s*\1\s*>|$)/gi, '');
  let out = '';
  let last = 0;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(stripped))) {
    out += escapeText(stripped.slice(last, m.index)) + cleanTag(m[0], m[1], m[2]);
    last = TAG.lastIndex;
  }
  return out + escapeText(stripped.slice(last));
}

/**
 * Reduce figure markup to the SVG the app itself draws. Returns '' for anything
 * empty, oversized or unparseable — a missing figure is always safe.
 */
export function sanitizeFigure(html) {
  if (typeof html !== 'string') return '';
  const src = html.trim();
  if (!src || src.length > MAX_FIGURE) return '';
  try {
    if (typeof DOMParser === 'function') {
      const doc = new DOMParser().parseFromString(src, 'text/html');
      return doc?.body ? cleanNodes(doc.body, 0, { left: MAX_NODES }) : '';
    }
    return cleanMarkup(src);
  } catch {
    return '';
  }
}

/** Any file-sourced value as a plain, control-free, length-capped string. */
export function sanitizeText(value, maxLen = 200) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, Math.max(0, maxLen));
}
