// Rich maths text: renders $...$ segments with KaTeX, **bold** and *italic* inline.
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** The one escape used on every path that reaches dangerouslySetInnerHTML.
 *  The output is element content, never an attribute value, so the three
 *  markup-significant characters are the whole job. */
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderMath(tex, displayMode = false) {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode, strict: false });
  } catch {
    // throwOnError only swallows KaTeX's own ParseError. Anything else — a
    // RangeError from deeply nested braces is the reachable one — lands here,
    // and prompts can arrive from an imported task pack, so the fallback must
    // escape rather than hand the source straight to the renderer.
    return escapeHtml(tex);
  }
}

/** Split on $...$ (math), then apply light markdown to the text parts. */
export function MathText({ text, block = false, className }) {
  const html = useMemo(() => {
    if (text == null) return '';
    // Split on unescaped $…$ so literal amounts written as \$4,000 stay text
    const parts = String(text).split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g);
    let out = '';
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        out += renderMath(part, false);
      } else {
        out += escapeHtml(part)
          .replace(/\\\$/g, '$')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      }
    });
    return out;
  }, [text]);
  const Tag = block ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
