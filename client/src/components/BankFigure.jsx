// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the diagram of an author-bank question
//
// The figure is a plain SVG the server holds (server/platform/qbankFigures.js) and releases only to the account the question was issued
// to. It is fetched with the session (an <img> cannot carry one), shown in an <img> (inert: nothing inside it can run) on a white sheet
// like a paper's diagrams, which are drawn black on white and so read the same in the light and the dark theme, and it has the text
// alternative the server sent. Without an issued question (a prepared or offline draft) there is no file to fetch: the text alternative
// is shown instead.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { cloudDownload, cloudRequest, nativeCloudAvailable } from '../platform/cloudTransport.js';
import { useT } from '../i18n/index.js';

const UUID = /^[0-9a-f-]{36}$/i;
const cache = new Map();

/** The diagram as an object URL. A browser streams the SVG; the native app's bridge carries JSON only, so it asks for the same bytes as JSON. */
export function bankFigureUrl(id) {
  if (!UUID.test(String(id))) return Promise.reject(new Error('bank figure: bad id'));
  if (!cache.has(id)) {
    const load = nativeCloudAvailable()
      ? cloudRequest(`/v1/practice/${id}/figure/data`).then(r => new Blob([String(r?.svg ?? '')], { type: 'image/svg+xml' }))
      : cloudDownload(`/v1/practice/${id}/figure`, { type: 'image/svg+xml' }).then(bytes => new Blob([bytes], { type: 'image/svg+xml' }));
    cache.set(id, load.then(blob => URL.createObjectURL(blob)).catch(error => { cache.delete(id); throw error; }));
  }
  return cache.get(id);
}

export default function BankFigure({ serverQuestionId, diagram }) {
  const t = useT();
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const fetchable = typeof serverQuestionId === 'string' && UUID.test(serverQuestionId);
  useEffect(() => {
    if (!fetchable) return undefined;
    let live = true;
    setSrc(null); setFailed(false);
    bankFigureUrl(serverQuestionId).then(url => { if (live) setSrc(url); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [serverQuestionId, fetchable]);
  if (!diagram || typeof diagram.alt !== 'string') return null;
  // A figure only a few dozen pixels wide (a row of matchsticks) is drawn larger; none is ever wider than its column.
  const scale = diagram.w < 140 ? 2 : 1;
  return (
    <figure className="q-figure q-figure--sheet" data-bank-figure lang="en">
      {src
        ? <img src={src} alt={diagram.alt} width={Math.round(diagram.w * scale)} height={Math.round(diagram.h * scale)} decoding="async" />
        : failed
          ? <p className="muted q-figure-note" role="status">{t('paper.figureFailed')}</p>
          : fetchable
            ? <span className="muted q-figure-note" role="status">{t('paper.figureLoading')}</span>
            : <p className="muted q-figure-note">{diagram.alt}</p>}
    </figure>
  );
}
