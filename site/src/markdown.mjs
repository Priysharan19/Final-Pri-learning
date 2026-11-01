// Pri Learning public site · Markdown → HTML for the notices in docs/legal.
//
// The notices use a small, fixed subset of Markdown: an H1, H2 sections, hard-
// wrapped paragraphs, bold, links, bullet lists whose items can run to several
// paragraphs (continuation lines indented by two spaces) and numbered lists.
// This converter handles exactly that subset and nothing more, so a notice
// that starts using a construct it does not know renders visibly wrong rather
// than silently losing text: unknown inline syntax is left as the characters
// the author typed.
//
// It is dependency-free on purpose. The site is generated in CI and by the
// freshness check in tools/site-check.mjs, and a Markdown library would be a
// supply-chain dependency on the one part of the site that is legal text.

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** A URL-safe id from an English heading; '' when nothing survives (Hindi). */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Inline Markdown: **bold**, [text](url), `code`. Everything else is text. */
export function renderInline(text, { mapLink = (u) => u } = {}) {
  let out = '';
  let rest = String(text);
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`/s;
  while (rest.length) {
    const m = pattern.exec(rest);
    if (!m) { out += escapeHtml(rest); break; }
    out += escapeHtml(rest.slice(0, m.index));
    if (m[1] !== undefined) {
      out += `<strong>${renderInline(m[1], { mapLink })}</strong>`;
    } else if (m[2] !== undefined) {
      const href = mapLink(m[3]);
      out += `<a href="${escapeHtml(href)}">${renderInline(m[2], { mapLink })}</a>`;
    } else {
      out += `<code>${escapeHtml(m[4])}</code>`;
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const LIST_ITEM = /^([-*]|\d{1,9}\.)[ \t]+(.*)$/;
const HEADING = /^(#{1,3})[ \t]+(.+?)[ \t]*#*$/;

// CommonMark: a bullet or "1." may interrupt a paragraph; any other number may
// not, so a paragraph line that happens to begin "2023. The Act applies." stays
// text and the number is kept. Any number may start a list at the beginning of
// a block, and the list then starts at that number.
const INTERRUPTS_PARAGRAPH = /^([-*]|1\.)[ \t]+\S/;

/**
 * Parse Markdown into blocks:
 *   { type: 'heading', level, text }
 *   { type: 'paragraph', text }
 *   { type: 'list', ordered, start, items: [ [paragraphText, ...], ... ] }
 */
export function parseBlocks(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  const joinWrapped = (parts) => parts.map(p => p.trim()).filter(Boolean).join(' ');

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const h = HEADING.exec(line);
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() }); i++; continue; }

    const li = LIST_ITEM.exec(line);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const start = ordered ? parseInt(li[1], 10) : 1;
      const items = [];
      // A later line starts a new item of this list when it carries a marker of
      // the same kind; a marker of the other kind ends the list only if it may
      // interrupt a paragraph (a bullet or "1."), otherwise it is lazy text.
      const startsItem = (text) => {
        const m = LIST_ITEM.exec(text);
        return Boolean(m) && (/\d/.test(m[1]) === ordered || INTERRUPTS_PARAGRAPH.test(text));
      };
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        const paragraphs = [];
        let current = [m[2]];
        i++;
        // Continuation: indented lines belong to this item; a blank line followed
        // by an indented line starts a new paragraph inside the item; a blank
        // line followed by anything else ends the list.
        while (i < lines.length) {
          const next = lines[i];
          if (!next.trim()) {
            let j = i + 1;
            while (j < lines.length && !lines[j].trim()) j++;
            if (j < lines.length && /^[ \t]{2,}\S/.test(lines[j]) && !LIST_ITEM.test(lines[j].trim()) ) {
              paragraphs.push(joinWrapped(current));
              current = [];
              i = j;
              continue;
            }
            break;
          }
          if (startsItem(next)) break;
          if (/^[ \t]+\S/.test(next) || current.length) {
            // An indented line, or a lazy continuation of the current paragraph.
            if (!/^[ \t]+\S/.test(next) && paragraphs.length) break;
            current.push(next);
            i++;
            continue;
          }
          break;
        }
        if (current.length) paragraphs.push(joinWrapped(current));
        items.push(paragraphs);
      }
      blocks.push({ type: 'list', ordered, start, items });
      continue;
    }

    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !INTERRUPTS_PARAGRAPH.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: joinWrapped(para) });
  }
  return blocks;
}

/**
 * Render a notice.
 *   mapLink(url)              rewrites a link target (app route → site route)
 *   idFor(index, level, text) the id of the n-th heading (lets a Hindi page share
 *                             the English anchors)
 *   demote                    0 keeps H1/H2; 1 renders H1 as h2 and H2 as h3
 *   dropTitle                 leave the H1 out (the page supplies its own)
 *   only                      render only the H2 sections whose index is listed
 */
export function renderMarkdown(markdown, options = {}) {
  const { mapLink = (u) => u, idFor, demote = 0, dropTitle = false, only = null } = options;
  const blocks = parseBlocks(markdown);
  const headings = [];
  let headingIndex = 0;
  let sectionIndex = -1;           // index among H2s, -1 before the first
  const parts = [];
  const title = blocks.find(b => b.type === 'heading' && b.level === 1)?.text || '';

  const include = () => only === null || only.includes(sectionIndex);

  for (const block of blocks) {
    if (block.type === 'heading') {
      if (block.level === 2) sectionIndex++;
      const id = idFor ? idFor(headingIndex, block.level, block.text) : (slugify(block.text) || `section-${headingIndex + 1}`);
      headingIndex++;
      if (block.level === 1 && dropTitle) continue;
      if (block.level !== 1 && !include()) continue;
      const level = Math.min(6, block.level + demote);
      headings.push({ level: block.level, text: block.text, id });
      parts.push(`<h${level} id="${escapeHtml(id)}">${renderInline(block.text, { mapLink })}</h${level}>`);
      continue;
    }
    if (!include()) continue;
    if (block.type === 'paragraph') {
      parts.push(`<p>${renderInline(block.text, { mapLink })}</p>`);
      continue;
    }
    if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul';
      const open = block.ordered && block.start !== 1 ? `<ol start="${block.start}">` : `<${tag}>`;
      const items = block.items.map(paragraphs => (
        paragraphs.length === 1
          ? `<li>${renderInline(paragraphs[0], { mapLink })}</li>`
          : `<li>${paragraphs.map(p => `<p>${renderInline(p, { mapLink })}</p>`).join('')}</li>`
      ));
      parts.push(`${open}${items.join('')}</${tag}>`);
    }
  }
  return { html: parts.join('\n'), title, headings };
}

/** The H2 texts of a document, in order; used to pair Hindi anchors with English. */
export function sectionTitles(markdown) {
  return parseBlocks(markdown).filter(b => b.type === 'heading' && b.level === 2).map(b => b.text);
}

/** The first bold line that looks like a "Last updated" stamp, as plain text. */
export function lastUpdated(markdown) {
  const m = /^\*\*(.+?)\*\*\s*$/m.exec(String(markdown));
  return m ? m[1].trim() : '';
}
