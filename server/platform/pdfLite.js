// Pri Learning — a small, dependency-free PDF writer for printable papers.
//
// Text only (the base-14 Helvetica fonts, WinAnsi): a paper and its marking
// guide are text, and a question that needs a figure is never put on a
// generated paper. Lines are wrapped to the page, pages are added as needed,
// and every string is escaped, so a question can never break the file.
//
//   buildPdf({ title, lines }) → Buffer
//   lines: [{ text, size?: 8–20, bold?: boolean, gap?: points above }]
const PAGE = { w: 595, h: 842, margin: 56 };

// Latin-1 only; anything else becomes a readable stand-in rather than garbage.
const STAND_IN = new Map([['−', '-'], ['–', '-'], ['—', '-'], ['×', 'x'], ['÷', '/'], ['≤', '<='], ['≥', '>='], ['≠', '!='], ['≈', '~'],
  ['√', 'sqrt'], ['π', 'pi'], ['θ', 'theta'], ['∞', 'inf'], ['∫', 'int'], ['Σ', 'sum'], ['∑', 'sum'], ['°', 'deg'], ['’', "'"], ['‘', "'"], ['“', '"'], ['”', '"'], ['·', '-'], ['…', '...']]);
const clean = s => [...String(s ?? '')].map(ch => {
  if (STAND_IN.has(ch)) return STAND_IN.get(ch);
  const code = ch.codePointAt(0);
  return code >= 32 && code <= 126 ? ch : (code === 9 ? ' ' : (code >= 160 && code <= 255 ? ch : (ch === '\n' ? ' ' : '?')));
}).join('');
const esc = s => clean(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

// Helvetica's average advance is about half the point size; wrapping by that is
// close enough for a ragged-right printed paper.
function wrap(text, size, width) {
  const per = Math.max(1, Math.floor(width / (size * 0.5)));
  const out = [];
  for (const para of clean(text).split(/\s*\n\s*/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if ((line + ' ' + word).trim().length > per) { if (line) out.push(line); line = word.slice(0, per); }
      else line = (line + ' ' + word).trim();
    }
    out.push(line);
  }
  return out;
}

export function buildPdf({ title = 'Paper', lines = [] }) {
  const pages = [[]];
  let y = PAGE.h - PAGE.margin;
  for (const l of lines) {
    const size = Math.min(20, Math.max(8, l.size || 11));
    const lead = size * 1.35;
    y -= l.gap || 0;
    for (const text of wrap(l.text ?? '', size, PAGE.w - PAGE.margin * 2)) {
      if (y - lead < PAGE.margin) { pages.push([]); y = PAGE.h - PAGE.margin; }
      y -= lead;
      pages.at(-1).push(`BT /${l.bold ? 'F2' : 'F1'} ${size} Tf ${PAGE.margin} ${y.toFixed(1)} Td (${esc(text)}) Tj ET`);
    }
  }
  // Objects: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then (page, content) pairs.
  const objects = [];
  const add = body => { objects.push(body); return objects.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(null);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add(`<< /Title (${esc(title)}) /Producer (Pri Learning) >>`);
  const kids = [];
  pages.forEach((ops, i) => {
    const total = `Page ${i + 1} of ${pages.length}`;
    const stream = [...ops, `BT /F1 8 Tf ${PAGE.margin} 30 Td (${esc(total)}) Tj ET`].join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R >>`));
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
