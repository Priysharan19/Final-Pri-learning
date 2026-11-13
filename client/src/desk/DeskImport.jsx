// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · bringing in practice from the Prithagoras website — /desk/import
//
// A student who practised on the Prithagoras website's desk moves that record
// into their account the only honest way: they press the website's own "Export
// attempt" and choose that file here (F4 spec §4).
//
//   1. The file is read ON THIS DEVICE (never uploaded as a file) and checked
//      with the same reader the server uses (engine/deskImport.js).
//   2. Its parsed contents (statuses and notes) are sent to the server, which
//      reads them again and answers with a preview. Nothing is stored.
//   3. Only the press of "Add to my account" stores it.
//
// NOTHING IS BROUGHT IN WITHOUT THAT PRESS: not on load, not from the address,
// not from a message from another window. The timer is never brought across,
// and nothing brought in is a mark — the file holds statuses and notes only.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { useT } from '../i18n/index.js';
import { MAX_EXPORT_BYTES, exportResourceId, readDeskExport } from '../engine/deskImport.js';
import { libraryApi } from '../library/libraryApi.js';
import { IMPORT_SITE, deskApi, newKey, unreachable } from './deskApi.js';
import { UnmarkedPlate } from './DeskPage.jsx';
import './desk.css';

// The i18n keys, written out so client/test/i18n-check.mjs can see each one.
const REFUSAL_KEYS = Object.freeze({
  DESK_IMPORT_NOT_A_DESK_FILE: 'desk.importNotDesk',
  DESK_IMPORT_VERSION: 'desk.importVersion',
  DESK_IMPORT_UNKNOWN_PAPER: 'desk.importUnknown',
  DESK_IMPORT_PAPER_CHANGED: 'desk.importChanged',
  DESK_IMPORT_MALFORMED: 'desk.importMalformed',
  DESK_IMPORT_EMPTY: 'desk.importEmpty',
  AUTH_REQUIRED: 'desk.signedOut',
  CLOUD_DISABLED: 'desk.needsConnection'
});
export const refusalKey = code => (Object.hasOwn(REFUSAL_KEYS, code) ? REFUSAL_KEYS[code] : 'desk.importFailed');
const dateOf = ms => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Read a chosen file on the device: its text as JSON, checked against the
 * library paper it names. Returns { file, plan } or { refused: code }.
 * `readPaper(id)` looks the paper up in this edition's library.
 */
export async function readChosenFile(text, readPaper) {
  if (typeof text !== 'string' || text.length > MAX_EXPORT_BYTES) return { refused: 'DESK_IMPORT_NOT_A_DESK_FILE' };
  let file;
  try { file = JSON.parse(text); } catch { return { refused: 'DESK_IMPORT_NOT_A_DESK_FILE' }; }
  const id = exportResourceId(file);
  let resource = null;
  if (id) {
    try { resource = (await readPaper(id))?.resource || null; } catch (err) {
      if (err?.code !== 'RESOURCE_NOT_FOUND') return { refused: unreachable(err) ? 'CLOUD_DISABLED' : err?.status === 401 ? 'AUTH_REQUIRED' : 'DESK_IMPORT_FAILED' };
    }
  }
  const read = readDeskExport(file, resource);
  return read.ok ? { file, plan: read.plan } : { refused: read.refused };
}

/** The preview of what would be brought in. Exported for client/test/desk-ui-check.mjs. */
export function ImportPreview({ t, preview, already, earlier }) {
  return (
    <section className="dk-preview" aria-labelledby="dk-preview-title" data-import-preview={preview.resourceId}>
      <h2 id="dk-preview-title">{t('desk.previewTitle')}</h2>
      {/* i18n-exempt-start: the paper's own title, as its publisher wrote it */}
      <p className="dk-preview-paper" data-paper-own>{preview.title}</p>
      {/* i18n-exempt-end */}
      <p>{t('desk.previewQuestions', { count: preview.questionCount, n: preview.questionCount })}{preview.exportedAt ? ` ${t('desk.previewFrom', { date: dateOf(preview.exportedAt) })}` : ''}</p>
      <p data-import-tallies>{t('desk.tallies', { done: preview.tallies.done, flagged: preview.tallies.flagged, notes: preview.tallies.notes })}</p>
      <p>{t('desk.previewTimer')}</p>
      {already && <p className="dk-honest" data-import-already>{t('desk.previewAlready', { date: dateOf(already.at) })}</p>}
      {!already && earlier > 0 && <p className="dk-honest" data-import-earlier>{t('desk.previewEarlier')}</p>}
    </section>
  );
}

export default function DeskImport() {
  const t = useT();
  const navigate = useNavigate();
  const [state, setState] = useState({ step: 'choose' });
  const key = useRef(null);

  const choose = async (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    // Emptied at once, so choosing the same file again after a refusal is still a choice.
    e.target.value = '';
    setState({ step: 'reading' });
    if (chosen.size > MAX_EXPORT_BYTES) { setState({ step: 'choose', refused: 'DESK_IMPORT_NOT_A_DESK_FILE' }); return; }
    const local = await readChosenFile(await chosen.text().catch(() => null), libraryApi.read);
    if (local.refused) { setState({ step: 'choose', refused: local.refused }); return; }
    try {
      // The server reads the same file and decides; this stores nothing.
      const reply = await deskApi.importPreview(local.file);
      key.current = newKey();
      setState({ step: 'preview', file: local.file, preview: reply.preview, already: reply.alreadyImported, earlier: reply.earlierImports });
    } catch (err) {
      setState({ step: 'choose', refused: unreachable(err) ? 'CLOUD_DISABLED' : err?.code || 'DESK_IMPORT_FAILED' });
    }
  };
  const cancel = () => { key.current = null; setState({ step: 'choose' }); };
  const add = async () => {
    setState(s => ({ ...s, adding: true, refused: null }));
    try {
      const reply = await deskApi.importAdd(state.file, key.current);
      navigate(`/desk/${reply.attempt.id}`);
    } catch (err) {
      setState(s => ({ ...s, adding: false, refused: unreachable(err) ? 'CLOUD_DISABLED' : err?.code || 'DESK_IMPORT_FAILED' }));
    }
  };

  return (
    <div className="dk-page dk-import" data-desk-import={state.step}>
      <PageLink to="/library" className="btn btn-ghost dk-back">{t('library.back')}</PageLink>
      <UnmarkedPlate t={t} />
      <h1>{t('desk.importTitle', { site: IMPORT_SITE })}</h1>
      <p className="in-note">{t('desk.importLead')}</p>
      {state.step !== 'preview' && (
        <div className="dk-choose">
          <label className="label" htmlFor="dk-import-file">{t('desk.importChoose')}</label>
          <input id="dk-import-file" className="input" type="file" accept=".json,application/json" onChange={choose} disabled={state.step === 'reading'} />
          <p className="in-note">{t('desk.importHow')}</p>
        </div>
      )}
      {state.step === 'reading' && <p role="status">{t('desk.importReading')}</p>}
      {state.refused && <p className="dk-honest" role="alert" data-import-refused={state.refused}>{t(refusalKey(state.refused))}</p>}
      {state.step === 'preview' && (
        <>
          <ImportPreview t={t} preview={state.preview} already={state.already} earlier={state.earlier} />
          <div className="dk-actions">
            <button type="button" className="btn btn-primary" onClick={add} disabled={state.adding} data-import-add>{t('desk.importAdd')}</button>
            <button type="button" className="btn btn-ghost" onClick={cancel} disabled={state.adding} data-import-cancel>{t('desk.importCancel')}</button>
          </div>
        </>
      )}
    </div>
  );
}
