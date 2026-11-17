// Rich maths text: renders $...$ segments with KaTeX, **bold** and *italic* inline.
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './latex.css';
import { useLanguage } from '../i18n/index.js';
import { EDITION_ID } from '../brand/edition.js';
import { speakMath, speechLocale } from './mathSpeech.js';

/** The one escape used on every path that reaches dangerouslySetInnerHTML.
 *  The output is element content, never an attribute value, so the three
 *  markup-significant characters are the whole job. */
const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** An attribute value: the element-content escape plus the quote. */
// The double quote is written as an escape: a bare quote in a regex literal would confuse the security suite's JSX reader.
const Q = '\u0022';
const attr = (s) => escapeHtml(s).split(Q).join('&quot;');

/** The language speech is read in: Hindi in the Hindi interface, else the edition's English. */
export function useMathLocale() {
  const { language } = useLanguage();
  return speechLocale(language, EDITION_ID);
}

/**
 * One formula as markup: a role="math" wrapper whose accessible NAME is the spoken maths, around the
 * KaTeX output (its MathML stays in the DOM for copy, search and tools, but is hidden from the
 * accessibility tree so a formula is announced once, as its spoken name).
 */
export function renderMath(tex, displayMode = false, locale = 'en', focusable = false) {
  const spoken = speakMath(tex, locale);
  const open = ['<span class=', Q, 'pri-math', displayMode ? ' is-display' : '', Q, ' role=', Q, 'math', Q, ' aria-label=', Q, attr(spoken), Q, focusable ? ' tabindex=' + Q + '0' + Q : '', '><span aria-hidden=', Q, 'true', Q, '>'].join('');
  const close = '</span></span>';
  try {
    return open + katex.renderToString(tex, { throwOnError: false, displayMode, strict: false }) + close;
  } catch {
    // throwOnError only swallows KaTeX's own ParseError. Anything else — a
    // RangeError from deeply nested braces is the reachable one — lands here,
    // and prompts can arrive from an imported task pack, so the fallback must
    // escape rather than hand the source straight to the renderer.
    return open + escapeHtml(tex) + close;
  }
}

/** Split on $...$ (math), then apply light markdown to the text parts. */
export function MathText({ text, block = false, className, focusable = false }) {
  const locale = useMathLocale();
  const html = useMemo(() => {
    if (text == null) return '';
    // Split on unescaped $…$ so literal amounts written as \$4,000 stay text
    const parts = String(text).split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g);
    let out = '';
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        out += renderMath(part, false, locale, focusable);
      } else {
        out += escapeHtml(part)
          .replace(/\\\$/g, '$')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      }
    });
    return out;
  }, [text, locale, focusable]);
  const Tag = block ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
