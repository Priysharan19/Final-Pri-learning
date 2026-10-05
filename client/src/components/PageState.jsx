// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the states every page has (Section 7.15)
//
// Loading, empty, offline, error and "the provider is slow" are five different
// situations and must never look alike or say the same thing. One component
// draws them so a page cannot invent a sixth: a skeleton shaped like content
// while loading; one sentence and one action when empty; amber with a left
// rule when offline, saying what still works; red only for a failure of the
// app, with "your work is still here"; and a calm status line when something
// is taking longer than it should. Nothing here spins over content.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import Icon from './Icon.jsx';
import { useT } from '../i18n/index.js';
import './PageState.css';

const ICON = { offline: 'offline', error: 'alert', slow: 'clock', empty: 'info' };
// The default sentence for each state, by key (a lookup table, so the catalogue gate can see them).
const TITLE_KEY = { empty: 'state.emptyTitle', offline: 'state.offlineTitle', error: 'state.errorTitle', slow: 'state.slowTitle' };

/**
 * @param kind     'loading' | 'empty' | 'offline' | 'error' | 'slow'
 * @param title    the one sentence (empty, offline, error, slow)
 * @param body     an optional second sentence
 * @param action   { label, onClick } — at most one
 * @param height   skeleton height for 'loading'
 */
export default function PageState({ kind = 'loading', title = '', body = '', action = null, height = 220, label = null }) {
  const t = useT();
  if (kind === 'loading') {
    return (
      <div className="page-state page-state-loading" role="status" aria-live="polite" aria-label={label || t('state.loading')} data-page-state="loading">
        <div className="skeleton" style={{ height: 18, width: '40%' }} />
        <div className="skeleton" style={{ height: Math.max(60, height - 60), marginTop: 12 }} />
        <span className="sr-only">{label || t('state.loading')}</span>
      </div>
    );
  }
  const role = kind === 'error' ? 'alert' : 'status';
  return (
    <div className={`page-state notice page-state-${kind}`} role={role} data-page-state={kind}>
      <span className="page-state-ico" aria-hidden="true"><Icon name={ICON[kind] || 'info'} size={18} /></span>
      <div className="page-state-text">
        <div className="page-state-title">{title || t(TITLE_KEY[kind] || 'state.emptyTitle')}</div>
        {(body || kind === 'error') && <div className="page-state-body">{body || t('state.errorBody')}</div>}
        {action && (
          <div className="page-state-action">
            <button type="button" className="btn btn-ghost btn-sm" onClick={action.onClick}>{action.label}</button>
          </div>
        )}
      </div>
    </div>
  );
}
