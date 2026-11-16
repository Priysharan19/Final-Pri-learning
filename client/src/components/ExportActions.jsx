// "Export as file" and "Print or save as PDF" (plan F5). The printed sheet sits
// in the page, hidden on screen and shown alone when printing; its first line
// is the fixed unmarked line when the export is of unmarked practice, fixed to
// the top of the page so every printed page carries it.
import React, { useState } from 'react';
import { useT } from '../i18n/index.js';
import { downloadJson } from '../lib/exportFile.js';
import { printPage } from '../lib/files.js';
import { featureEnabled } from '../platform/features.js';
import './exportActions.css';

export default function ExportActions({ fileName, compose, title, unmarked = false, children }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  if (!featureEnabled('exports')) return null;
  const run = async work => {
    setFailed(false);
    try { await work(); } catch { setFailed(true); }
  };
  return (
    <div className="ex-actions" data-export-actions>
      <button type="button" className="btn btn-ghost" data-export-json onClick={() => run(async () => downloadJson(fileName, await compose()))}>{t('export.json')}</button>
      <button type="button" className="btn btn-ghost" data-export-print onClick={() => run(() => printPage())}>{t('export.print')}</button>
      {failed && <p className="in-note" role="alert" data-export-failed>{t('export.failed')}</p>}
      <section className="ex-sheet" data-print-sheet aria-hidden="true">
        {unmarked && <p className="ex-line" data-export-unmarked>{t('export.unmarkedLine')}</p>}
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  );
}
