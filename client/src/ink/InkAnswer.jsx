// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Write-to-answer surface
//
// Ink canvas + toolbar. Handwriting is read ONLY by Pri's server reader — the
// owner's product decision: "Pri Learning does not have the feature to mark
// handwriting or photo when not online, since the local engine is just not
// good enough." The on-device recogniser is therefore not in this path at all:
// nothing it produces is shown under "I'm reading:" and nothing it produces is
// ever marked.
//
// What still holds:
//   · The model reads; it never marks. The transcription goes back to the
//     caller, and the deterministic engine decides the mark from it.
//   · Answer-blind: the request is a picture of the student's own strokes and
//     nothing else (cloudReader.js / cloudRaster.js).
//   · The ink is the student's and survives everything: it is handed to the
//     caller the moment the pen lifts (onStrokes) whatever happens to reading.
//   · When the server cannot be reached the student is told why in plain words,
//     the working stays on the page, and it is read automatically as soon as
//     the reason goes away (back online, signed in). Typing still works offline.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import InkCanvas from './InkCanvas.jsx';
import NativeInkCanvas from './NativeInkCanvas.jsx';
import { nativeInkAvailable } from './native.js';
import { exprToLatex } from './inkLatex.js';
import { cloudReadingEnabled, inkReadingBlockedKey, retryDelayMs, readWithCloud, recordLocalHandwritingDiagnostics, toReading } from './cloudReader.js';
import { useApp } from '../App.jsx';
import { feedbackGeometry } from './feedbackGeometry.js';
import { plausibleLineMatch, segmentInkLines } from './inkLines.js';
import { MathText } from '../lib/latex.jsx';
import { currentReleaseIdentity } from '../platform/releaseIdentity.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { inkCanvasHeight, useFormFactor } from '../platform/formFactor.js';
import { useT } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import './InkAnswer.css';
import { priNative } from '../platform/native/index.js';
import { applyLineCorrection, confidenceFloorOf, isLowConfidence, lowConfidenceLines } from './readingCorrection.js';

// Engine names are for developers and evaluators, not students: shown in dev
// builds, LAN research mode, or with ?inkdiag=1.
const inkDiagnosticsVisible = () => {
  if (import.meta.env?.DEV) return true;
  if (typeof window === 'undefined') return false;
  if (window.__PRI_LAN_DEV__ === true) return true;
  try { return new URLSearchParams(window.location.search).has('inkdiag'); } catch { return false; }
};
/** How long the page must be still before it is worth sending. */
const SETTLE_MS = 1100;
// How long a server read runs before the note changes to "still reading".
export const STILL_READING_MS = 5000;
/** A reader that did not answer is tried again on its own, a few times. */
// A focus or a return to the tab also tries again at once (see below).

const EMPTY_READING = { lines: [], text: '' };
const strokeSignature = strokes => `${strokes.length}:${strokes.reduce((n, st) => n + (st?.points?.length || 0), 0)}`;

/**
 * lineVerdicts: optional array aligned with the read lines, e.g.
 * [{status:'ok'}, {status:'break', note:'…'}] — drawn as ✓/✗ badges in the
 * reading panel (and on the ink where line geometry is known).
 * focusSymbol and recognitionContext are accepted for API compatibility; the
 * server reader is answer-blind and receives no question context.
 */
// eslint-disable-next-line no-unused-vars
/** One page of paper. More pages extend the same sheet, so reading, the stored
 *  strokes and History replay all keep one coordinate space. */
const MAX_PAGES = 4;

export default function InkAnswer({ onRecognized, onStrokes = null, initialStrokes = null, height = 300, disabled, lineVerdicts = null, focusSymbol = null, recognitionContext = null }) {
  const [NATIVE_INK] = useState(nativeInkAvailable);
  const Surface = NATIVE_INK ? NativeInkCanvas : InkCanvas;
  const [diagnostics] = useState(inkDiagnosticsVisible);
  const t = useT();
  const formFactor = useFormFactor();
  const fittedHeight = inkCanvasHeight(height, formFactor);
  const canvasRef = useRef(null);
  const { user } = useApp();
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const [tool, setTool] = useState('pen');
  const [finger, setFinger] = useState(() => priNative.ink.facts()?.fingerDefault === true);
  const [rec, setRec] = useState(EMPTY_READING);
  // { index, text } while the student is saying what they wrote on a doubtful line.
  const [correcting, setCorrecting] = useState(null);
  // Restored work arrives with its own extent: a page that already reaches past
  // the first sheet opens with enough sheets to show all of it.
  const [pages, setPages] = useState(() => {
    const bottom = Math.max(0, ...(initialStrokes || []).flatMap(st => (st?.points || []).map(p => Number(p?.y) || 0)));
    return Math.min(MAX_PAGES, Math.max(1, Math.ceil((bottom + 24) / fittedHeight)));
  });
  // A cleared page that can still be taken back for a few seconds (Clear sits
  // beside Undo, where a Pencil slips).
  const [cleared, setCleared] = useState(null);
  // null | { kind: 'reading' } | { kind: 'waiting', key } | { kind: 'empty' } | { kind: 'allowance' }
  const [status, setStatus] = useState(null);
  const settleRef = useRef(null);
  const retryRef = useRef(null);
  const retriesRef = useRef(0);
  const readSeqRef = useRef(0);
  const abortRef = useRef(null);
  const sentRef = useRef(null);
  const strokesRef = useRef([]);
  // The page waited for the reader (offline, signed out, reader down). The
  // reading that eventually arrives is handed on as such, so the card can mark
  // it without a second tap — once.
  const queuedRef = useRef(false);
  const disabledRef = useRef(!!disabled);
  const onStrokesRef = useRef(onStrokes);
  useEffect(() => { onStrokesRef.current = onStrokes; }, [onStrokes]);
  useEffect(() => {
    recordLocalHandwritingDiagnostics({
      nativeAvailable: NATIVE_INK,
      releaseSha: currentReleaseIdentity()?.releaseSha || null
    });
  }, []);

  const publish = useCallback((r, strokes, { afterWait = false } = {}) => {
    setRec(r);
    if (r.engine) recordLocalHandwritingDiagnostics({ engine: r.engine });
    // The server's own confidence is the number that means something here; it
    // feeds the caller's confirmation gate exactly as before.
    const sure = Number(r.confidence ?? (r.lines.length ? 0 : 1));
    onRecognized?.({
      lines: r.lines.map(l => l.text),
      lineBoxes: r.lines.map(l => l.box),
      text: r.text,
      answerLine: r.lines.length ? r.lines[r.lines.length - 1].text : '',
      minConf: sure,
      margin: sure,
      weakest: null,
      engine: r.engine || null,
      researchOnly: false,
      productionReady: r.cloud === true,
      // The reader's own doubt and the student's own corrections travel with
      // the reading: the card's confirmation gate honours the first, and the
      // second is what the engine marks.
      needsConfirmation: r.needsConfirmation === true,
      confidenceFloor: confidenceFloorOf(r),
      corrected: r.corrected === true,
      afterWait: afterWait && r.lines.length > 0,
      readKey: r.lines.length ? `${strokeSignature(strokes)}|${r.text}` : null,
      strokes
    });
  }, [onRecognized]);

  const clearRetry = () => { if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; } };

  const scheduleRetry = (seq) => {
    clearRetry();
    const delay = retryDelayMs(retriesRef.current);
    retriesRef.current += 1;
    retryRef.current = setTimeout(() => {
      if (seq === readSeqRef.current && !disabledRef.current) sendToReaderRef.current?.(strokesRef.current, seq);
    }, delay);
  };
  const sendToReaderRef = useRef(null);

  /** Send the page to the server reader. Its reading is the only reading. */
  const sendToReader = useCallback((strokes, seq) => {
    if (disabledRef.current) return;
    const who = userRef.current;
    // Offline is known before anything is sent: no doomed request, just the
    // honest note, and the 'online' listener below reads the page later.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline || !cloudReadingEnabled(who)) {
      queuedRef.current = true;
      setStatus({ kind: 'waiting', key: inkReadingBlockedKey(who) });
      return;
    }
    abortRef.current?.abort?.();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    abortRef.current = controller;
    sentRef.current = strokeSignature(strokes);
    setStatus({ kind: 'reading' });
    readWithCloud(strokes, { user: who, signal: controller?.signal }).then(outcome => {
      // Newer writing replaced this read, or the page was submitted while the
      // server was reading it (§09: a late reading never rewrites the reading
      // a mark was given for).
      if (seq !== readSeqRef.current || disabledRef.current) return;
      if (outcome?.reason === 'cancelled') return;
      if (outcome?.reason === 'allowance') { sentRef.current = null; setStatus({ kind: 'allowance' }); return; }
      // Line geometry comes from the strokes themselves (no recognition), so
      // the ✓/✗ can be drawn on the student's own lines when the counts agree.
      let geometry = null;
      try { geometry = { lines: segmentInkLines(strokes) }; } catch { geometry = null; }
      // Only placed on the ink when each read line plausibly IS that written
      // line; otherwise the ✓/✗ stay in the panel, never on a guessed line.
      if (geometry && !plausibleLineMatch(outcome?.transcription?.lines, geometry.lines)) geometry = null;
      const reading = outcome?.transcription
        ? toReading(outcome.transcription, geometry, { confidenceFloor: outcome?.readiness?.confidenceFloor })
        : null;
      if (reading) {
        retriesRef.current = 0;
        const afterWait = queuedRef.current;
        queuedRef.current = false;
        publish(reading, strokes, { afterWait });
        setStatus(null);
        return;
      }
      if (outcome?.reason === 'empty') { setStatus({ kind: 'empty' }); return; }
      // Not read: say why, keep the ink, and try again by itself.
      sentRef.current = null;
      queuedRef.current = true;
      setStatus({ kind: 'waiting', key: inkReadingBlockedKey(who, { outcome }) });
      scheduleRetry(seq);
    }).catch(() => {
      if (seq !== readSeqRef.current || disabledRef.current) return;
      sentRef.current = null;
      queuedRef.current = true;
      setStatus({ kind: 'waiting', key: inkReadingBlockedKey(who) });
      scheduleRetry(seq);
    });
  }, [publish]);
  sendToReaderRef.current = sendToReader;

  const scheduleRead = useCallback((strokes, { immediate = false } = {}) => {
    const seq = ++readSeqRef.current;
    clearRetry();
    if (settleRef.current) { clearTimeout(settleRef.current); settleRef.current = null; }
    abortRef.current?.abort?.();
    // Writing changed: whatever was read before is no longer this page.
    if (rec.lines.length) publish(EMPTY_READING, strokes);
    if (!strokes.length) { sentRef.current = null; setStatus(null); return; }
    const go = () => sendToReader(strokes, seq);
    if (immediate) go(); else settleRef.current = setTimeout(go, SETTLE_MS);
  }, [publish, rec.lines.length, sendToReader]);

  /**
   * One tap: the student says what they wrote on a line the reader was unsure
   * of. Applied to the reading on screen and handed on — the reader is NOT
   * asked again (no second provider call, nothing new leaves the device), and
   * the deterministic engine marks the line as written.
   */
  const correctLine = useCallback((index, text) => {
    setCorrecting(null);
    const next = applyLineCorrection(rec, index, text);
    if (next === rec) return;
    publish(next, strokesRef.current);
  }, [rec, publish]);

  const onStrokesChange = useCallback((strokes) => {
    if (strokes?.length) setCleared(null);
    strokesRef.current = strokes;
    setCorrecting(null);
    // Kept the moment the pen lifts, before any reading: a page written in the
    // second before the app went away is still the student's page.
    try { onStrokesRef.current?.(strokes); } catch { /* keeping ink is best-effort */ }
    if (sentRef.current && sentRef.current === strokeSignature(strokes)) return;
    retriesRef.current = 0;
    scheduleRead(strokes);
  }, [scheduleRead]);

  // The working waits on the page; the moment the reason goes away it is read.
  useEffect(() => {
    const retry = () => {
      if (disabledRef.current || !strokesRef.current.length) return;
      if (status?.kind !== 'waiting' && status?.kind !== 'allowance') return;
      retriesRef.current = 0;
      scheduleRead(strokesRef.current, { immediate: true });
    };
    const stopSession = onCloudSessionChange(retry);
    const onOnline = () => retry();
    const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') retry(); };
    if (typeof window !== 'undefined') {
      window.addEventListener?.('online', onOnline);
      window.addEventListener?.('focus', onVisible);
    }
    if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', onVisible);
    return () => {
      try { stopSession(); } catch { /* gone */ }
      if (typeof window !== 'undefined') {
        window.removeEventListener?.('online', onOnline);
        window.removeEventListener?.('focus', onVisible);
      }
      if (typeof document !== 'undefined') document.removeEventListener?.('visibilitychange', onVisible);
    };
  }, [status, scheduleRead]);

  // A profile that just became able to read (signed in elsewhere) re-reads.
  useEffect(() => {
    if (status?.kind === 'waiting' && strokesRef.current.length && cloudReadingEnabled(user)) {
      scheduleRead(strokesRef.current, { immediate: true });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handwriting kept from before a reload comes back onto the page and is read.
  useEffect(() => {
    if (!Array.isArray(initialStrokes) || !initialStrokes.length) return;
    canvasRef.current?.setStrokes?.(initialStrokes);
    onStrokesChange(initialStrokes);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Locking the page for marking invalidates every reading still in flight.
  useEffect(() => {
    const was = disabledRef.current;
    disabledRef.current = !!disabled;
    if (!disabled || was) return;
    readSeqRef.current += 1;
    if (settleRef.current) { clearTimeout(settleRef.current); settleRef.current = null; }
    clearRetry();
    abortRef.current?.abort?.();
    setStatus(null);
  }, [disabled]);
  useEffect(() => () => {
    readSeqRef.current += 1;
    if (settleRef.current) clearTimeout(settleRef.current);
    clearRetry();
    abortRef.current?.abort?.();
  }, []);

  // A server read can take a while. Past STILL_READING_MS the note says so
  // calmly instead of looking stuck; nothing about the read itself changes.
  const [slowRead, setSlowRead] = useState(false);
  useEffect(() => {
    setSlowRead(false);
    if (status?.kind !== 'reading') return undefined;
    const timer = setTimeout(() => setSlowRead(true), STILL_READING_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!cleared) return;
    const gone = setTimeout(() => setCleared(null), 6000);
    return () => clearTimeout(gone);
  }, [cleared]);
  const act = (fn) => () => {
    if (fn === 'clear') {
      const before = strokesRef.current;
      if (!before.length) return;
      setCleared({ strokes: before });
    }
    canvasRef.current?.[fn]();
  };
  const undoClear = () => {
    if (!cleared) return;
    canvasRef.current?.setStrokes?.(cleared.strokes);
    onStrokesChange(cleared.strokes);
    setCleared(null);
  };
  const pageHeight = fittedHeight;

  // i18n-exempt-start: engine identifier for developers and evaluators, drawn only when inkDiagnosticsVisible(); students see t('verdict.readOnServer')
  const engineNote = rec.cloud === true ? `Read on the server · ${rec.engine || 'cloud'}` : null;
  // i18n-exempt-end
  const shownEngineNote = diagnostics ? engineNote : (rec.cloud === true ? t('verdict.readOnServer') : null);
  const lineConfidenceFloor = confidenceFloorOf(rec);
  const statusLine = status?.kind === 'reading'
    ? t(slowRead ? 'ink.serverStillReading' : 'ink.serverReading')
    : status?.kind === 'empty'
      ? t('ink.serverEmpty')
      : status?.kind === 'allowance'
        ? t('ink.cloudAllowanceUsed')
        : status?.kind === 'waiting'
          ? t(status.key)
          : null;

  return (
    <div className={`ink-answer ${disabled ? 'ink-disabled' : ''}`} data-engine={rec.engine || undefined}>
      <div className="ink-toolbar" role="toolbar" aria-label={t('ink.toolbar')}>
        <button type="button" className={`ink-tool ${tool === 'pen' ? 'on' : ''}`} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} title={t('ink.pen')}>
          <Icon name="pen" /><span className="ink-tool-label">{t('ink.pen')}</span>
        </button>
        <button type="button" className={`ink-tool ${tool === 'eraser' ? 'on' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} title={t('ink.eraser')}>
          <Icon name="eraser" /><span className="ink-tool-label">{t('ink.eraser')}</span>
        </button>
        <span className="ink-sep" aria-hidden="true" />
        <button type="button" className="ink-tool" onClick={act('undo')} title={t('ink.undo')} aria-label={t('ink.undoLabel')}><Icon name="undo" /></button>
        <button type="button" className="ink-tool" onClick={act('redo')} title={t('ink.redo')} aria-label={t('ink.redoLabel')}><Icon name="redo" /></button>
        <button type="button" className="ink-tool" onClick={act('clear')} title={t('ink.clear')} aria-label={t('ink.clearLabel')}><Icon name="clear" /></button>
        <span className="ink-sep" aria-hidden="true" />
        <button type="button" className="ink-tool" disabled={pages >= MAX_PAGES}
          aria-label={t('ink.addPageLabel', { n: pages + 1 })} title={t('ink.addPage')}
          onClick={() => setPages(n => Math.min(MAX_PAGES, n + 1))}>
          <Icon name="pageAdd" /><span className="ink-tool-label">{t('ink.addPage')}</span>
        </button>
        <span className="ink-pages" aria-live="polite">{t('ink.pageCount', { count: pages, n: pages })}</span>
        {/* Always offered: an iPad without a Pencil can only write through this (CP-04). */}
        <button type="button" className={`ink-tool ${finger ? 'on' : ''}`} title={t('ink.fingerTitle')}
          aria-label={t('ink.fingerLabel')} aria-pressed={finger}
          onClick={() => setFinger(f => !f)}>
          <Icon name="finger" /><span className="ink-tool-label">{t('ink.finger')}</span>
        </button>
        {cleared
          ? <button type="button" className="ink-tool on" onClick={undoClear} aria-live="polite">{t('ink.undoClear')}</button>
          : <span className="ink-hint">{t('ink.hint')}</span>}
      </div>

      <div className="ink-stage">
        <Surface
          ref={canvasRef}
          height={pageHeight * pages}
          tool={tool}
          fingerMode={finger ? 'finger' : 'auto'}
          disabled={disabled}
          onStrokesChange={onStrokesChange}
          ariaLabel={t('ink.surfaceLabel')}
        />
        {Array.from({ length: pages - 1 }, (_, i) => (
          <div key={i} className="ink-page-break" style={{ top: pageHeight * (i + 1) }} aria-hidden="true">
            <span>{t('ink.pageLabel', { n: i + 2 })}</span>
          </div>
        ))}
        {lineVerdicts && rec.lines.some(l => l.box) && (
          <div className="ink-verdict-layer" aria-hidden="true">
            {(() => {
              let noted = false;
              return rec.lines.map((line, li) => {
                const v = lineVerdicts[li];
                if (!v || !line.box) return null;
                const good = v.status === 'ok';
                const bad = v.status === 'break' || v.status === 'wrong';
                if (!good && !bad) return null;
                const showNote = bad && !noted;
                if (showNote) noted = true;
                const geometry = feedbackGeometry(line);
                const b = geometry.anchor || line.box;
                const boxes = geometry.boxes.length ? geometry.boxes : [b];
                return (
                  <React.Fragment key={li}>
                    {boxes.map((gb, gi) => (
                      <span key={`box-${gi}`} className={`ink-linebox ${good ? 'good' : 'bad'}`}
                        style={{ left: gb.x - 5, top: gb.y - 5, width: gb.w + 10, height: gb.h + 10 }} />
                    ))}
                    <span className={`ink-verdict ${good ? 'good' : 'bad'}`}
                      style={{ top: b.y + b.h / 2 - 14, left: b.x + b.w + 16 }}
                      title={v.note || (good ? t('ink.lineOk') : t('ink.lineBreaks'))}>{good ? <Icon name="check" size={18} /> : <Icon name="correction" size={18} />}</span>
                    {bad && boxes.map((gb, gi) => (
                      <span key={`underline-${gi}`} className="ink-underline"
                        style={{ left: gb.x - 3, top: gb.y + gb.h + 4, width: gb.w + 6 }} />
                    ))}
                    {showNote && (
                      <span className="ink-note" style={{ left: Math.max(4, b.x - 2), top: b.y + b.h + 16 }}>
                        <b>{t('ink.mistakeHere')}</b>{v.note ? <> — {v.note}</> : null}
                      </span>
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}
      </div>

      {statusLine && !disabled && (
        <div className="ink-status ink-status-line muted" role="status" aria-live="polite">
          {statusLine}
        </div>
      )}

      {rec.lines.length > 0 && (
        <div className="ink-preview">
          <div className="ink-preview-title" id="ink-reading">
            {t('ink.reading')}
            {/* A student always learns when their writing was read on the server. */}
            {shownEngineNote && <span className="ink-status muted">{shownEngineNote}</span>}
          </div>
          {rec.lines.map((line, li) => (
            <div className={`ink-line${isLowConfidence(line, lineConfidenceFloor) ? ' ink-line-low' : ''}`} key={li} data-text={line.text}
              data-confidence={Number.isFinite(Number(line.conf)) ? String(Math.round(Number(line.conf) * 100) / 100) : undefined}
              data-corrected={line.corrected === true ? 'true' : undefined}>
              <span className="ink-line-n" aria-hidden="true">{li + 1}</span>
              {isLowConfidence(line, lineConfidenceFloor) && (
                <span className="ink-line-doubt" title={t('ink.lowConfidenceLine', { n: li + 1 })}>?<span className="sr-only">{t('ink.lowConfidenceSr', { n: li + 1 })}{' '}</span></span>
              )}
              {lineVerdicts && lineVerdicts[li] && ['ok', 'break', 'wrong'].includes(lineVerdicts[li].status) && (
                <span className={`ink-line-verdict ${lineVerdicts[li].status === 'ok' ? 'good' : 'bad'}`}>
                  {lineVerdicts[li].status === 'ok' ? <Icon name="check" size={15} /> : <Icon name="correction" size={15} />}
                  <span className="sr-only">{lineVerdicts[li].status === 'ok' ? t('ink.lineOkSpoken', { n: li + 1 }) : t('ink.lineBreaksSpoken', { n: li + 1 })} </span>
                </span>
              )}
              <span className="ink-line-math"><MathText text={`$${exprToLatex(line.text) || '\\;'}$`} /></span>
              {lineVerdicts && lineVerdicts[li] && ['break', 'wrong'].includes(lineVerdicts[li].status) && lineVerdicts[li].note && (
                <span className="sc-note" style={{ fontSize: 12.5 }}>— {lineVerdicts[li].note}</span>
              )}
              {line.corrected === true && (
                <span className="ink-line-corrected" role="status"><Icon name="check" size={13} /> {t('ink.correctedSr', { n: li + 1 })}</span>
              )}
              {!disabled && isLowConfidence(line, lineConfidenceFloor) && correcting?.index !== li && (
                <button type="button" className="ink-correct-btn" aria-label={t('ink.iWroteAria', { n: li + 1 })}
                  onClick={() => setCorrecting({ index: li, text: line.text })}>{t('ink.iWrote')}</button>
              )}
              {!disabled && correcting?.index === li && (
                <form className="ink-correct" onSubmit={e => { e.preventDefault(); correctLine(li, correcting.text); }}>
                  <input autoFocus value={correcting.text} aria-label={t('ink.correctionAria', { n: li + 1 })}
                    inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={400}
                    onChange={e => setCorrecting({ index: li, text: e.target.value })} />
                  <button type="submit" className="btn btn-primary btn-sm">{t('ink.correctionUse')}</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setCorrecting(null)}>{t('common.cancel')}</button>
                </form>
              )}
            </div>
          ))}
          {!disabled && lowConfidenceLines(rec).length > 0 && (
            <div className="ink-doubt-note" role="status">{t('ink.lowConfidenceLine', { n: lowConfidenceLines(rec)[0] + 1 })}</div>
          )}
        </div>
      )}
    </div>
  );
}
