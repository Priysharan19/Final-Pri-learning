// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the pages a store, a payment provider and the DPDP Act require
//
// Apple and Google need a privacy notice, terms and a refund policy at a real
// URL, and India's DPDP Act requires a published grievance contact. Those four
// documents live in docs/legal/*.md and are rendered here, so there is exactly
// one copy of each and it ships with the app — it works offline, and it cannot
// drift from the version in the repository. A fifth page, the third-party
// licence notices, is generated from the dependency licences and rendered by
// the same reader.
//
// TWO LANGUAGES. The DPDP Act's section 5(3) gives a data principal the right
// to read the notice in English or in any language of the Eighth Schedule, and
// this app has shipped a Hindi interface with English-only notices — a student
// who told us they read Hindi met the one document that decides what happens to
// their data in the language they had already said they do not read. Each
// notice now has a sibling in Hindi, and the page opens in the language the
// profile is already being read in.
//
// English is the operative text and every Hindi document says so in its own
// first paragraph. That is not a formality: nobody has had either version
// reviewed, and a reader must never be able to close the page believing they
// have read the version that governs when they have read a translation of it.
// So the English is a static import and is always present; the Hindi is fetched
// (i18n/legalHindi.js) and, if it cannot be, the page shows the English and
// says why. Failing back to the governing text is the safe direction to fail.
//
// THE REVIEW BANNER. Every notice says at the top that no lawyer has reviewed
// it until one has. That sentence used to depend on {{PLACEHOLDER}} text being
// left in the documents, so filling the placeholders on 19 October 2026 made
// the banner disappear although nobody had reviewed anything. It now depends
// on one explicit switch, docs/legal/review-status.json, which only a person
// sets after a lawyer qualified in Indian law has reviewed the English and
// checked the Hindi against it. legal-pages-check.mjs refuses the switch
// without the reviewer's name, qualification, date and evidence, and refuses
// it again if a notice is edited after the review date. A document that still
// contains a placeholder is a template, and the page says that too.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { LANGUAGES, useLanguage, useTx } from '../i18n/index.js';
import privacy from '../../../docs/legal/privacy.md?raw';
import terms from '../../../docs/legal/terms.md?raw';
import refund from '../../../docs/legal/refund-policy.md?raw';
import grievance from '../../../docs/legal/grievance.md?raw';
import review from '../../../docs/legal/review-status.json';

// The English of each notice, keyed by its own route. There is no `title` here
// any more: a notice names itself in its first heading, in whichever language
// it is written in, and titleOf() reads it back. One name per document, in the
// document, is the only arrangement that cannot leave the two languages
// disagreeing about what the page is called.
//
// The licence page is different in kind: it is generated, English by nature
// (licence texts are reproduced as published), carries no placeholders and is
// not a notice a lawyer reviews, so it is named by the catalogue, reached by
// import() and shows neither banner.
export const LEGAL_PAGES = Object.freeze({
  privacy: { kind: 'notice', source: privacy },
  terms: { kind: 'notice', source: terms },
  'refund-policy': { kind: 'notice', source: refund },
  grievance: { kind: 'notice', source: grievance },
  'third-party-notices': { kind: 'licences', source: null, titleKey: 'legal.thirdPartyTitle' }
});

/** True only when a human has recorded a lawyer's review in review-status.json. */
export const LEGAL_REVIEWED = review.reviewed === true;

// The three exported helpers below close over nothing. That is deliberate:
// legal-pages-check.mjs cannot import this file — it is JSX and its documents
// arrive through Vite's `?raw` — so it lifts these out of the parsed source and
// runs them against the real notices. A free variable here would turn that into
// a copy of the reader instead of the reader.

/** Unfilled placeholders, so the page can say honestly that it is a draft. */
export function placeholdersIn(markdown) {
  return [...new Set(String(markdown || '').match(/\{\{[A-Z_]+\}\}/g) || [])];
}

/** A document's own H1 — the one place each notice is named. */
export function titleOf(markdown) {
  return String(markdown || '').match(/^#[ \t]+(.+)$/m)?.[1].trim() || '';
}

// ── The Hindi documents, and the licence notices ─────────────────────────────
// Module scope rather than component state, so the four pages share one fetch
// and following a link from the privacy notice to the grievance page does not
// ask for the chunk again. The in-flight promise is cleared on failure, so a
// second ask is a second attempt rather than a cached refusal.

let hindiDocuments = null;
let hindiRequest = null;

function loadHindi() {
  if (hindiDocuments) return Promise.resolve(hindiDocuments);
  hindiRequest ||= import('../i18n/legalHindi.js')
    .then(module => { hindiDocuments = module.default; return hindiDocuments; })
    .catch(() => { hindiRequest = null; return null; });
  return hindiRequest;
}

let noticesDocument = null;
let noticesRequest = null;

function loadNotices() {
  if (noticesDocument) return Promise.resolve(noticesDocument);
  noticesRequest ||= import('../legal/thirdPartyNotices.js')
    .then(module => { noticesDocument = module.default; return noticesDocument; })
    .catch(() => { noticesRequest = null; return null; });
  return noticesRequest;
}

// ── Markdown ─────────────────────────────────────────────────────────────────

/**
 * A very small Markdown reader — headings, paragraphs, lists, bold, links. The
 * source is a handful of files in this repository, not user input, so this does
 * not need to be a general parser; it needs to be one that cannot render
 * anything those files do not contain.
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
      // /account/… pages (delete-request) render outside the router, so they
      // are reached by a full navigation rather than a client-side Link.
      nodes.push(href.startsWith('/') && !href.startsWith('/account/')
        ? <PageLink key={`${key}-l${i}`} to={href}>{match[2]}</PageLink>
        : <a key={`${key}-a${i}`} href={href} rel="noreferrer noopener" target="_blank">{match[2]}</a>);
    } else if (match[4]) nodes.push(<code key={`${key}-c${i}`}>{match[4]}</code>);
    rest = rest.slice(match.index + match[0].length);
    i += 1;
  }
  return nodes;
}

/**
 * Markdown source to blocks.
 *
 * A line that is not blank, not a heading and not the start of a list item
 * CONTINUES whatever came before it. That is what markdown means by a wrapped
 * paragraph, and reading it any other way turned every one of these documents
 * into a column of one-line paragraphs with a blank line between each — the
 * source files are hard-wrapped at 79 characters, so a four-line sentence
 * rendered as four separate paragraphs. It read badly in English and it would
 * read worse in Devanagari, where the wrap points fall in different places
 * again. Blocks are separated by blank lines, as markdown says they are.
 */
export function blocksOf(source) {
  const out = [];
  let list = null;                                  // the list being collected
  let ordered = false;                              // …and whether it is numbered
  let para = null;                                  // the paragraph being collected

  const flushList = () => { if (list) { out.push({ kind: ordered ? 'ol' : 'ul', items: list }); list = null; } };
  const flushPara = () => { if (para) { out.push({ kind: 'p', text: para }); para = null; } };
  const flush = () => { flushList(); flushPara(); };

  for (const raw of String(source).split('\n')) {
    const line = raw.replace(/\s+$/, '');

    if (!line.trim()) { flush(); continue; }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      // A numbered list following a bulleted one, or the reverse, is two lists.
      if (list && ordered !== Boolean(numbered)) flushList();
      ordered = Boolean(numbered);
      (list ||= []).push((bullet || numbered)[1]);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { flush(); out.push({ kind: `h${heading[1].length}`, text: heading[2] }); continue; }

    // A table row is its own block: no document rendered here has one, but the
    // README beside them does, and flattening beats printing pipes.
    if (/^\|/.test(line)) { flush(); out.push({ kind: 'p', text: line.replace(/\|/g, ' ').trim() }); continue; }

    // Continuation: of the open list item if there is one, else of the paragraph.
    const text = line.trim();
    if (list) list[list.length - 1] += ` ${text}`;
    else para = para ? `${para} ${text}` : text;
  }

  flush();
  return out;
}

function Markdown({ source }) {
  const blocks = useMemo(() => blocksOf(source), [source]);

  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === 'ul' || block.kind === 'ol') {
          const items = block.items.map((item, j) => <li key={j}>{renderInline(item, `${i}-${j}`)}</li>);
          return block.kind === 'ol' ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
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

// ── The page ─────────────────────────────────────────────────────────────────

export default function Legal() {
  // The routes are declared explicitly rather than as one parameterised path,
  // so the page is read from the location.
  const page = useLocation().pathname.replace(/^\/+|\/+$/g, '');
  const entry = LEGAL_PAGES[page];
  const { language, t } = useLanguage();
  const tx = useTx();

  // `asked` is null while the page simply follows the profile's language, which
  // is the case that matters: a student reading the app in Hindi opens the
  // privacy notice in Hindi without doing anything. Pressing a language button
  // sets it, and it deliberately survives a move to another notice — a reader
  // who switched to English on the privacy page is followed to the grievance
  // page they were sent to from inside it.
  //
  // It does NOT switch the app. "Read this one in the other language" and "the
  // app is in Hindi now" are different requests, and the second is the settings
  // switch's job. The visible consequence is that a reader on an English app
  // who asks for the Hindi notice gets Hindi prose under an English banner:
  // that banner is app chrome and follows the app. It is the right trade,
  // because the sentence in the banner that actually matters — that nobody has
  // had this checked by a lawyer — is in the second paragraph of every Hindi
  // document as well, in Hindi. Nobody reads only the chrome.
  const [asked, setAsked] = useState(null);
  const wanted = asked ?? language;

  const [hindi, setHindi] = useState(hindiDocuments);
  const [hindiFailed, setHindiFailed] = useState(false);
  const [notices, setNotices] = useState(noticesDocument);
  const [noticesFailed, setNoticesFailed] = useState(false);

  // One attempt per ask. `hindiFailed` closes the loop after a failure so the
  // page does not retry on every render, and pressing the button again clears
  // it — which is the retry, and the only one worth having: the reader who was
  // on a train and is now not is the reader who asks a second time.
  useEffect(() => {
    if (wanted !== 'hi' || hindi || hindiFailed) return undefined;
    let live = true;
    loadHindi().then(documents => {
      if (!live) return;
      if (documents) setHindi(documents); else setHindiFailed(true);
    });
    return () => { live = false; };
  }, [wanted, hindi, hindiFailed]);

  // The licence notices arrive the same way, only when their page is opened.
  useEffect(() => {
    if (entry?.kind !== 'licences' || notices || noticesFailed) return undefined;
    let live = true;
    loadNotices().then(document => {
      if (!live) return;
      if (document) setNotices(document); else setNoticesFailed(true);
    });
    return () => { live = false; };
  }, [entry, notices, noticesFailed]);

  // Every notice names itself in whichever language it is being read in, so a
  // link to another one is labelled in the language the reader will land in —
  // and falls back to the English name when the Hindi has not arrived, because
  // that is the page they will actually get. The licence page is named by the
  // catalogue, in the app's language.
  const nameOf = (key) => {
    const target = LEGAL_PAGES[key];
    if (target.titleKey) return t(target.titleKey);
    return titleOf((wanted === 'hi' && hindi?.[key]) || target.source);
  };

  if (!entry) {
    const published = Object.keys(LEGAL_PAGES).map((key, i, all) => (
      <React.Fragment key={key}>
        <PageLink to={`/${key}`}>{nameOf(key)}</PageLink>
        {i < all.length - 1 ? ' · ' : ''}
      </React.Fragment>
    ));
    // The list is joined with a separator rather than "a, b and c": Hindi puts
    // its conjunction in a different place, and a sentence assembled from three
    // English fragments has nowhere to put it.
    return (
      <div className="qpage">
        <h1>{t('legal.notFoundTitle')}</h1>
        <p className="muted">{tx('legal.notFoundBody', { pages: published })}</p>
      </div>
    );
  }

  const others = Object.keys(LEGAL_PAGES).filter(key => key !== page).map((key, i, all) => (
    <React.Fragment key={key}>
      <PageLink to={`/${key}`}>{nameOf(key)}</PageLink>
      {i < all.length - 1 ? ' · ' : ''}
    </React.Fragment>
  ));

  if (entry.kind === 'licences') {
    return (
      <div className="qpage" style={{ maxWidth: 720 }}>
        <h1>{t(entry.titleKey)}</h1>
        <p className="muted">{t('legal.thirdPartyLead')}</p>
        {notices && (
          <article className="legal-body" lang="en">
            <Markdown source={notices} />
          </article>
        )}
        {!notices && noticesFailed && (
          <div className="notice" role="status" style={{ marginTop: 18 }} data-legal-notices-unavailable="true">
            {t('legal.thirdPartyUnavailable')}
          </div>
        )}
        {!notices && !noticesFailed && (
          <p className="muted" role="status">{t('legal.thirdPartyLoading')}</p>
        )}
        <p className="muted" style={{ marginTop: 28 }}>{others}</p>
      </div>
    );
  }

  // What is actually on screen, which is not always what was asked for: the
  // Hindi chunk has to arrive first, and it may not. Until it does the English
  // stands — it is already rendered, it is the version that governs, and
  // swapping it for a spinner would take the readable document away to promise
  // a better one.
  const translated = wanted === 'hi' ? hindi?.[page] : null;
  const source = translated || entry.source;
  const unfilled = placeholdersIn(source);

  return (
    <div className="qpage" style={{ maxWidth: 720 }}>
      <h1>{titleOf(source)}</h1>

      <div className="seg-tabs" role="group" aria-label={t('legal.languageLabel')} style={{ marginTop: 0, marginBottom: 18 }}>
        {LANGUAGES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`seg-tab${wanted === id ? ' on' : ''}`}
            aria-pressed={wanted === id}
            onClick={() => { setAsked(id); setHindiFailed(false); }}
          >
            {label}
          </button>
        ))}
      </div>

      {wanted === 'hi' && !translated && hindiFailed && (
        <div className="notice" role="status" style={{ marginBottom: 18 }} data-legal-fallback="true">
          {t('legal.translationUnavailable')}
        </div>
      )}

      {/* The review banner depends on the explicit switch alone — never on how
          many placeholders are left, which is a different fact with a banner
          of its own below. */}
      {!LEGAL_REVIEWED && (
        <div className="notice error" role="alert" style={{ marginBottom: 18 }} data-legal-unreviewed="true">
          <b>{t('legal.unreviewedTitle')}</b> {t('legal.unreviewedBody')}
        </div>
      )}

      {unfilled.length > 0 && (
        <div className="notice error" role="alert" style={{ marginBottom: 18 }} data-legal-draft="true">
          <b>{t('legal.draftTitle')}</b> {t('legal.draftBody', { count: unfilled.length, n: unfilled.length })}
        </div>
      )}

      <article className="legal-body" lang={translated ? 'hi' : 'en'}>
        <Markdown source={source} />
      </article>

      <p className="muted" style={{ marginTop: 28 }}>{others}</p>
    </div>
  );
}
