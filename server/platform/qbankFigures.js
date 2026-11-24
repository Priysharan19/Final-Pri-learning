// Pri Learning: the diagrams of the author question bank (server/content/qbank/figures/<question id>.svg).
//
// Each figure is the owner's TikZ compiled once, at authoring time, to a plain SVG (tools/qbank-diagrams.mjs). The pack entry of a question
// that has one carries `diagram: { alt, w, h, sha256, bytes }`; the file is read from the same directory as the pack (PRI_QBANK_DIR or the
// committed one), its length and sha256 are checked against the entry before a byte is sent, and a file that does not match is never served.
// SERVER-SIDE ONLY, like the pack: the figure of a question is released only to the account it was issued to (practice.js, GET /:id/figure),
// never from client/dist, and it shows no answer (the importer leaves out any figure that does).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { packDirFor, qbankEntries, qbankManualEntries, qbankVersion } from './qbankPack.js';

const FIGURE_ID = /^[AX][0-9]{2}-[A-Z][0-9]-[A-Z0-9]{3}$/;
let byBank = null;
let byBankVersion = null;

const entryOf = bankId => {
  if (byBank === null || byBankVersion !== qbankVersion()) {
    // A worked-solution question's figure is one of the same directory's files, checked the same way.
    byBank = new Map([...qbankEntries(), ...qbankManualEntries()].filter(e => e.entry.diagram).map(e => [e.entry.id, e.entry]));
    byBankVersion = qbankVersion();
  }
  return byBank.get(bankId) ?? null;
};

/** The figure of a pack entry (`_bank` of an issued question) as { question, sha256, bytes, alt }, or null when it has none. */
export function figureOfBankEntry(bankId) {
  const e = typeof bankId === 'string' ? entryOf(bankId) : null;
  if (!e || !FIGURE_ID.test(e.group ?? '')) return null;
  return { question: e.group, sha256: e.diagram.sha256, bytes: e.diagram.bytes, alt: e.diagram.alt };
}

/** The bytes of that figure, checked against the pack entry, or null (no figure, file missing, or a file that is not the one the pack names). */
export async function readBankFigure(bankId, env = process.env) {
  const f = figureOfBankEntry(bankId);
  const dir = packDirFor(env);
  if (!f || !dir) return null;
  const root = path.resolve(dir, 'figures');
  const file = path.join(root, `${f.question}.svg`);
  if (!file.startsWith(root + path.sep)) return null;
  let buf;
  try { buf = await fs.promises.readFile(file); } catch { return null; }
  if (buf.length !== f.bytes || createHash('sha256').update(buf).digest('hex') !== f.sha256) return null;
  return { bytes: buf, sha256: f.sha256 };
}

/** What a figure response carries: an SVG that can run nothing, may not be framed or sniffed, and is private to the account. */
export const FIGURE_HEADERS = Object.freeze({
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Cache-Control': 'private, max-age=3600'
});
