// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · exports (plan F5): making a file out of the student's own work
//
// A file is made on the device, from data a page already holds or one existing
// read. Nothing here calls a server route of its own, and the app keeps no copy
// of what it exports. The legal account export (/v1/account/export) is a
// different thing and is untouched.
//
// Two exports of the same data are byte-identical: keys are written in sorted
// order, and no timestamp is added.
// ─────────────────────────────────────────────────────────────────────────────
import { saveTextFile } from './files.js';

/** The fixed line every unmarked export carries (English: it is data, not UI). */
export const UNMARKED_LINE = 'Unmarked practice. This is not a mark, grade or prediction.';
/** The top-level `grading` field of a desk export. */
export const GRADING_LINE = 'none: unmarked practice; not a result';

/** A value with every object's keys in sorted order (arrays keep their order). */
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}

/** Canonical JSON text, two-space indented, ending in a newline. */
export const canonicalJson = value => `${JSON.stringify(canonical(value), null, 2)}\n`;

/** A file name that is safe on every platform: letters, digits, dot, dash, underscore. */
export function safeFileName(name, extension = 'json') {
  const stem = String(name ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80);
  return `${stem || 'pri-export'}.${extension}`;
}

/** Save (browser download, or the native share sheet) one value as a JSON file. */
export function downloadJson(name, value) {
  return saveTextFile(canonicalJson(value), safeFileName(name, 'json'), 'application/json');
}
