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
import { translate } from '../i18n/index.js';
import { reportCrash } from '../platform/telemetry.js';

let uid = 0;

// This is a class (hooks cannot catch render errors), so it reads strings with
// translate() at render time. translate() never throws for a missing catalogue:
// a Hindi chunk that failed to arrive leaves the English in force, so the crash
// card still renders in English when i18n itself is what went wrong.
function agoLabel(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return translate('errorScreen.secondsAgo', { count: s, n: s });
  const m = Math.round(s / 60);
  if (m < 60) return translate('errorScreen.minutesAgo', { count: m, n: m });
  const h = Math.round(m / 60);
  if (h < 24) return translate('errorScreen.hoursAgo', { count: h, n: h });
  const d = Math.round(h / 24);
  return translate('errorScreen.daysAgo', { count: d, n: d });
}

/**
 * translate() for a sentence with one emphasised word inside it. The word is a
 * placeholder in the catalogue, so a translation can put it wherever its own
 * word order needs it.
 */
function withEmphasis(key, slot, word) {
  const MARK = '\u0000';
  const [before = '', after = ''] = translate(key, { [slot]: MARK }).split(MARK);
  return <>{before}<b>{word}</b>{after}</>;
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
    // A coded, fingerprinted report through the server (platform/telemetry.js):
    // the scope name and a hash of the error, never the message or the stack
    // shown below. Gated by the account session and the device preference;
    // never awaited, never allowed to throw into the boundary.
    try { reportCrash({ surface: this.props.scope, code: 'RENDER_ERROR', scope: this.props.scope === 'route' ? 'route' : 'app', error }); } catch { /* reporting is best effort */ }
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
    const message = (error && (error.message || String(error))) || translate('errorScreen.unknownError');

    return (
      <div className={root ? 'crash-wrap' : 'crash-wrap crash-inline'}>
        <section className="card crash-card" role="alert" tabIndex={-1} ref={this.cardRef}
          aria-labelledby={this.titleId}>
          <div className="card-title">{translate('errorScreen.title')}</div>
          <h1 className="crash-title" id={this.titleId}>
            {root ? translate('errorScreen.appStopped') : translate('errorScreen.pageStopped')}
          </h1>

          <p className="sub crash-copy">
            {translate('errorScreen.savedWorkSafe')}
          </p>
          <p className="sub crash-copy">
            {withEmphasis('errorScreen.crashLoses', 'does', translate('errorScreen.crashLosesEmphasis'))}
          </p>

          {drafts.length ? (
            <div className="crash-drafts">
              <div className="sc-label">{translate('errorScreen.draftsFound')}</div>
              {drafts.map(d => (
                <div className="crash-draft" key={`${d.scope}:${d.id}`}>
                  <span className="crash-draft-main">
                    <span className="crash-draft-name">{d.label || `${d.scope} · ${d.id}`}</span>
                    <span className="crash-draft-sub">
                      {d.note
                        ? translate('errorScreen.noteSavedAgo', { note: d.note, ago: agoLabel(d.savedAt) })
                        : translate('errorScreen.savedAgo', { ago: agoLabel(d.savedAt) })}
                    </span>
                  </span>
                  {d.path && (
                    <button className="btn btn-ghost btn-sm" onClick={() => this.reopen(d.path)}>
                      {translate('errorScreen.reopen')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="crash-drafts">
              <div className="sc-label">{translate('errorScreen.draftsFound')}</div>
              <p className="muted crash-copy">
                {translate('errorScreen.noDrafts')}
              </p>
            </div>
          )}

          <div className="row crash-actions">
            {stuck ? (
              <button className="btn btn-primary" onClick={this.reload}>{translate('errorScreen.reload')}</button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={this.retry}>
                  {root ? translate('common.tryAgain') : translate('errorScreen.tryPageAgain')}
                </button>
                <button className="btn btn-ghost" onClick={this.reload}>{translate('errorScreen.reload')}</button>
              </>
            )}
            <button className="btn btn-quiet" onClick={this.home}>{translate('errorScreen.backHome')}</button>
          </div>

          <p className="muted crash-copy">
            {stuck
              ? translate('errorScreen.stuckNote')
              : translate('errorScreen.reloadSafe')}
          </p>

          <details className="crash-tech">
            <summary>{translate('errorScreen.technicalDetails')}</summary>
            <pre className="crash-pre">{message}{stack ? `\n${stack}` : ''}</pre>
          </details>
        </section>
      </div>
    );
  }
}
