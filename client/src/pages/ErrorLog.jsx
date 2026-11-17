import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import ErrorNotebook from '../components/ErrorNotebook.jsx';

// The error log: the student's own mistakes by chapter and by the slip the
// marker recognised, each with "try a fresh one". The list is the server's
// notebook (engine/mistakeNotebook.js); this page only gives it a home.
export default function ErrorLog() {
  const t = useT();
  return (
    <div className="error-log-page" data-error-log-page style={{ maxWidth: 820 }}>
      <h1 style={{ marginBottom: 6 }}>{t('errorLog.title')}</h1>
      <p className="muted" style={{ margin: '0 0 14px', lineHeight: 1.5 }}>{t('errorLog.how')}</p>
      <ErrorNotebook />
      <p><Link to="/today">{t('errorLog.todayLink')}</Link></p>
    </div>
  );
}
