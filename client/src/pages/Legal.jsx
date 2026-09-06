// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the pages a store and a payment provider require
//
// Apple, Google and Razorpay all need a privacy notice, terms and a refund
// policy at a real URL, and India's DPDP Act requires a published grievance
// contact. Those four documents live in docs/legal/*.md and are rendered here,
// so there is exactly one copy of each and it ships with the app — it works
// offline, and it cannot drift from the version in the repository.
//
// While a document still contains {{PLACEHOLDER}} text it is a template, and
// the page says so at the top. legal-pages-check.mjs fails if that banner is
// removed while placeholders remain, so an unfinished notice can never be
// published as a finished one.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import privacy from '../../../docs/legal/privacy.md?raw';
import terms from '../../../docs/legal/terms.md?raw';
import refund from '../../../docs/legal/refund-policy.md?raw';
import grievance from '../../../docs/legal/grievance.md?raw';

export const LEGAL_PAGES = Object.freeze({
  privacy: { title: 'Privacy notice', source: privacy },
  terms: { title: 'Terms of use', source: terms },
  'refund-policy': { title: 'Cancellation and refunds', source: refund },
  grievance: { title: 'Grievances', source: grievance }
});

const PLACEHOLDER = /\{\{[A-Z_]+\}\}/g;

/** Unfilled placeholders, so the page can say honestly that it is a draft. */
export function placeholdersIn(markdown) {
  return [...new Set(String(markdown || '').match(PLACEHOLDER) || [])];
}

/**
 * A very small Markdown reader — headings, paragraphs, lists, bold, links. The
 * source is four files in this repository, not user input, so this does not
 * need to be a general parser; it needs to be one that cannot render anything
 * the four files do not contain.
 */
function renderInline(text, key) {
  const nodes = [];
  let rest = String(text);
  let i = 0;
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/;
  for (; ;) {
    const match = rest.match(pattern);
    if (!match) { if (rest) nodes.push(rest); break; }
    if (match.index > 0) nodes.push(rest.slice(0, match.index));
    if (match[1]) nodes.push(<b key={`${key}-b${i}`}>{match[1]}</b>);
    else if (match[2]) {
      const href = match[3];
      nodes.push(href.startsWith('/')
        ? <Link key={`${key}-l${i}`} to={href}>{match[2]}</Link>
        : <a key={`${key}-a${i}`} href={href} rel="noreferrer noopener" target="_blank">{match[2]}</a>);
    } else if (match[4]) nodes.push(<code key={`${key}-c${i}`}>{match[4]}</code>);
    rest = rest.slice(match.index + match[0].length);
    i += 1;
  }
  return nodes;
}

function Markdown({ source }) {
  const blocks = useMemo(() => {
    const out = [];
    let list = null;
    for (const raw of String(source).split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (/^\s*[-*]\s+/.test(line)) {
        (list ||= []).push(line.replace(/^\s*[-*]\s+/, ''));
        continue;
      }
      if (list) { out.push({ kind: 'ul', items: list }); list = null; }
      if (!line.trim()) continue;
      const heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) out.push({ kind: `h${heading[1].length}`, text: heading[2] });
      else if (/^\|/.test(line)) out.push({ kind: 'p', text: line.replace(/\|/g, ' ').trim() });
      else out.push({ kind: 'p', text: line });
    }
    if (list) out.push({ kind: 'ul', items: list });
    return out;
  }, [source]);

  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'ul') {
          return <ul key={i}>{block.items.map((item, j) => <li key={j}>{renderInline(item, `${i}-${j}`)}</li>)}</ul>;
        }
        if (block.kind === 'h1') return null;             // the page supplies its own title
        if (block.kind === 'h2') return <h2 key={i} style={{ marginTop: 26 }}>{renderInline(block.text, i)}</h2>;
        if (block.kind === 'h3') return <h3 key={i} style={{ marginTop: 20 }}>{renderInline(block.text, i)}</h3>;
        if (block.kind === 'h4') return <h4 key={i}>{renderInline(block.text, i)}</h4>;
        return <p key={i}>{renderInline(block.text, i)}</p>;
      })}
    </>
  );
}

export default function Legal() {
  // The four routes are declared explicitly rather than as one parameterised
  // path, so the page is read from the location.
  const page = useLocation().pathname.replace(/^\/+|\/+$/g, '');
  const entry = LEGAL_PAGES[page];

  if (!entry) {
    return (
      <div className="qpage">
        <h1>Not found</h1>
        <p className="muted">
          There is no such page. The published ones are{' '}
          {Object.keys(LEGAL_PAGES).map((key, i, all) => (
            <React.Fragment key={key}>
              <Link to={`/${key}`}>{LEGAL_PAGES[key].title.toLowerCase()}</Link>
              {i < all.length - 2 ? ', ' : i === all.length - 2 ? ' and ' : '.'}
            </React.Fragment>
          ))}
        </p>
      </div>
    );
  }

  const unfilled = placeholdersIn(entry.source);

  return (
    <div className="qpage" style={{ maxWidth: 720 }}>
      <h1>{entry.title}</h1>

      {unfilled.length > 0 && (
        <div className="notice error" role="alert" style={{ marginBottom: 18 }} data-legal-draft="true">
          <b>Template — not yet reviewed.</b> This document still has{' '}
          {unfilled.length} placeholder{unfilled.length === 1 ? '' : 's'} to complete, and it has not
          been checked by a lawyer. Do not rely on it, and do not publish the app to a store or a
          payment provider until it has been finished and reviewed.
        </div>
      )}

      <article className="legal-body">
        <Markdown source={entry.source} />
      </article>

      <p className="muted" style={{ marginTop: 28 }}>
        {Object.keys(LEGAL_PAGES).filter(key => key !== page).map((key, i, all) => (
          <React.Fragment key={key}>
            <Link to={`/${key}`}>{LEGAL_PAGES[key].title}</Link>
            {i < all.length - 1 ? ' · ' : ''}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}
