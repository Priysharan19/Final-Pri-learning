// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a page whose own file has not arrived.
//
// The public landing and its plain pages are fetched only when visited and are
// never warmed into the offline copy (client/vite.config.js, ON_DEMAND): a
// signed-out visitor has installed nothing worth keeping offline. Opening one
// with the network gone therefore fails to import its chunk, and that failure
// used to travel to the root boundary and be shown as "stopped mid-render" —
// a crash screen for a page that simply was not downloaded.
//
// This boundary sits around those signed-out routes. A failed download of a
// page's own file is told plainly, with a button that tries again; any other
// error is rethrown to the root boundary untouched, so a real render fault is
// still reported as one. Nothing is marked, checked or revealed here.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { translate } from '../i18n/index.js';
import { isChunkLoadFailure } from './chunkFailure.js';

export default class ChunkBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(error) {
    // Anything else is not this boundary's to hide: rethrow it from render.
    return isChunkLoadFailure(error) ? { failed: true, error: null } : { failed: false, error };
  }

  render() {
    if (this.state.error) throw this.state.error;
    if (!this.state.failed) return this.props.children;
    return (
      <div className="auth-wrap">
        <div className="auth-col" role="status" data-testid="page-not-downloaded" style={{ textAlign: 'center' }}>
          <h1 className="h2">{translate('boot.loadFailedTitle')}</h1>
          <p className="muted">{translate('boot.loadFailedBody')}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{translate('common.tryAgain')}</button>
        </div>
      </div>
    );
  }
}
