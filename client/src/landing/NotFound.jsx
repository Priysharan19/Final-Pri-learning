// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "page not found" (Prithagoras only; App.jsx NOT_FOUND_PAGE)
//
// Shown for an address that is no route of the app, signed in or out. One
// heading, one sentence, one button: signed-in students go to their home,
// everyone else to the public start page. It is a lazy chunk that only the
// Prithagoras build emits. That edition offers English only, so the words are
// written here in en-AU rather than in the shared catalogue, which every
// registered language must mirror.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import PageLink from '../components/PageLink.jsx';

export default function NotFound({ to, signedIn }) {
  useEffect(() => {
    const before = document.title;
    document.title = 'Page not found · Prithagoras';
    return () => { document.title = before; };
  }, []);
  return (
    <div className="crash-wrap" data-testid="not-found">
      <section className="card crash-card" aria-labelledby="not-found-title">
        <h1 className="crash-title" id="not-found-title" style={{ marginTop: 18 }}>Page not found</h1>
        <p className="sub crash-copy">There is no page at this address. The link may be old or mistyped.</p>
        <div className="row crash-actions">
          <PageLink to={to} replace className="btn btn-primary" data-testid="not-found-home">
            {signedIn ? 'Back to home' : 'Back to the start page'}
          </PageLink>
        </div>
      </section>
    </div>
  );
}
