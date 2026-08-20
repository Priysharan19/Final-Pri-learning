// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Error boundary — the app's only safety net.
// There is no server to reload from and no cloud copy of anything: a thrown
// render that reaches the document root leaves a white screen whose only
// obvious cure is deleting the app, which deletes months of work with it.
// A class is not a style choice here — hooks cannot catch render errors.
// The copy below promises exactly what the device can prove: IndexedDB is
// untouched by a render crash, React state is not, and unsubmitted work
// survives only where a screen wrote it to the draft store.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { listDrafts, flushDrafts } from './drafts.js';

let uid = 0;

function agoLabel(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'} ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: '', attempts: 0, drafts: [], mountKey: 0 };
    this.cardRef = React.createRef();
    this.titleId = `crash-title-${++uid}`;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    let drafts = [];
    try { flushDrafts(); drafts = listDrafts(); } catch { drafts = []; }
    this.setState(s => ({ stack: info?.componentStack || '', drafts, attempts: s.attempts + 1 }));
  }

  // A route crash is a first mount (<main> is keyed on the path), so the card
  // has to claim focus from didMount as well as from didUpdate.
  componentDidMount() {
    if (this.state.error) this.cardRef.current?.focus();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.error && !prevState.error) this.cardRef.current?.focus();
    // Navigating away from a broken route is a legitimate recovery — take it.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, stack: '', drafts: [] });
    }
  }

  /**
   * Remount the subtree under a fresh key. This clears component state, but it
   * cannot clear a module-level failure: React caches a rejected lazy() import
   * for the lifetime of the document, so a chunk that failed to load fails
   * identically forever. One soft attempt, then the escape below.
   */
  retry = () => {
    if (this.state.attempts >= 2) { this.reload(); return; }
    this.setState(s => ({ error: null, stack: '', drafts: [], mountKey: s.mountKey + 1 }));
  };

  reload = () => {
    try { flushDrafts(); } catch { }
    window.location.reload();
  };

  home = () => {
    try { flushDrafts(); } catch { }
    if (this.props.onHome) { this.props.onHome(); this.setState({ error: null, stack: '', drafts: [] }); return; }
    window.location.assign('/');
  };

  reopen = (path) => {
    try { flushDrafts(); } catch { }
    window.location.assign(path);
  };

  render() {
    const { error, stack, attempts, drafts, mountKey } = this.state;
    if (!error) return <React.Fragment key={mountKey}>{this.props.children}</React.Fragment>;

    const root = this.props.scope !== 'route';
    const stuck = attempts >= 2;
    const message = (error && (error.message || String(error))) || 'Unknown error';

    return (
      <div className={root ? 'crash-wrap' : 'crash-wrap crash-inline'}>
        <section className="card crash-card" role="alert" tabIndex={-1} ref={this.cardRef}
          aria-labelledby={this.titleId}>
          <div className="card-title">Something went wrong</div>
          <h1 className="crash-title" id={this.titleId}>
            {root ? 'Pri Learning stopped mid-render.' : 'This page stopped mid-render.'}
          </h1>

          <p className="sub crash-copy">
            Your saved work is on this iPad and a render crash cannot touch it: profiles, submitted
            answers, marks, ratings, exam results, bookmarks and your handwriting model all live in
            this device's database, which was never opened for writing here.
          </p>
          <p className="sub crash-copy">
            What a crash <b>does</b> lose is whatever a screen was still holding in memory. Unsubmitted
            answers survive only where the screen saved a draft:
          </p>

          {drafts.length ? (
            <div className="crash-drafts">
              <div className="sc-label">Drafts found on this device</div>
              {drafts.map(d => (
                <div className="crash-draft" key={`${d.scope}:${d.id}`}>
                  <span className="crash-draft-main">
                    <span className="crash-draft-name">{d.label || `${d.scope} · ${d.id}`}</span>
                    <span className="crash-draft-sub">
                      {d.note ? `${d.note} · ` : ''}saved {agoLabel(d.savedAt)}
                    </span>
                  </span>
                  {d.path && (
                    <button className="btn btn-ghost btn-sm" onClick={() => this.reopen(d.path)}>
                      Reopen
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="crash-drafts">
              <div className="sc-label">Drafts found on this device</div>
              <p className="muted crash-copy">
                None. Nothing had been written to the draft store, so anything typed on this screen
                since your last submit is gone. Everything you had already submitted is unaffected.
              </p>
            </div>
          )}

          <div className="row crash-actions">
            {stuck ? (
              <button className="btn btn-primary" onClick={this.reload}>Reload Pri Learning</button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={this.retry}>
                  {root ? 'Try again' : 'Try this page again'}
                </button>
                <button className="btn btn-ghost" onClick={this.reload}>Reload Pri Learning</button>
              </>
            )}
            <button className="btn btn-quiet" onClick={this.home}>Back to Home</button>
          </div>

          <p className="muted crash-copy">
            {stuck
              ? 'Trying again did not clear it, so the fault is in code that is already loaded — a reload is the only reset left. Reloading keeps every profile and everything saved.'
              : 'Reloading is safe: it re-reads the app from this device and keeps every profile and everything saved. It works with no internet connection.'}
          </p>

          <details className="crash-tech">
            <summary>Technical details</summary>
            <pre className="crash-pre">{message}{stack ? `\n${stack}` : ''}</pre>
          </details>
        </section>
      </div>
    );
  }
}
