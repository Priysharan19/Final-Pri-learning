// The exam shell's paper header (F4 §1.1): what the paper is and where it comes
// from. On the desk these are the library resource's own fields — its title,
// source, attribution and disclaimer, shown as recorded and never hidden behind
// "more". In the marked room (plan F4c) it is the server's title.
//
//   title, source, attribution, disclaimer, link, linkLabel, eyebrow, note
import React from 'react';

export default function PaperHeader({ title, eyebrow = null, source = null, attribution = null, disclaimer = null, link = null, linkLabel = null, note = null }) {
  return (
    <div className="xs-paper">
      {eyebrow}
      {/* i18n-exempt-start: the paper's own title, source, attribution and disclaimer, as its publisher wrote them */}
      <h1 className="xs-paper-title" data-paper-own>{title}</h1>
      {(source || attribution) && <p className="xs-paper-source" data-paper-own>{[source, attribution].filter(Boolean).join(' · ')}</p>}
      {disclaimer && <p className="xs-paper-disclaimer" data-paper-own>{disclaimer}</p>}
      {/* i18n-exempt-end */}
      {note && <p className="xs-paper-note">{note}</p>}
      {link && <a className="btn btn-ghost xs-paper-link" href={link} target="_blank" rel="noopener noreferrer" data-testid="paper-open">{linkLabel}</a>}
    </div>
  );
}
