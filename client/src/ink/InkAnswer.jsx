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
import { cloudReadingEnabled, inkReadingBlockedKey, readWithCloud, recordLocalHandwritingDiagnostics, toReading } from './cloudReader.js';
import { useApp } from '../App.jsx';
import { feedbackGeometry } from './feedbackGeometry.js';
import { MathText } from '../lib/latex.jsx';
import { currentReleaseIdentity } from '../platform/releaseIdentity.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { inkCanvasHeight, useFormFactor } from '../platform/formFactor.js';
import { useT } from '../i18n/index.js';
import { priNative } from '../platform/native/index.js';

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
/** A reader that did not answer is tried again on its own, a few times. */
const RETRY_MS = 20_000;
const MAX_RETRIES = 3;

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
  const [extraHeight, setExtraHeight] = useState(0);
  // null | { kind: 'reading' } | { kind: 'waiting', key } | { kind: 'empty' } | { kind: 'allowance' }
  const [status, setStatus] = useState(null);
  const settleRef = useRef(null);
  const retryRef = useRef(null);
  const retriesRef = useRef(0);
  const readSeqRef = useRef(0);
  const abortRef = useRef(null);
  const sentRef = useRef(null);
  const strokesRef = useRef([]);
  const disabledRef = useRef(!!disabled);
  const onStrokesRef = useRef(onStrokes);
  useEffect(() => { onStrokesRef.current = onStrokes; }, [onStrokes]);
  useEffect(() => {
    recordLocalHandwritingDiagnostics({
      nativeAvailable: NATIVE_INK,
      releaseSha: currentReleaseIdentity()?.releaseSha || null
    });
  }, []);

  const publish = useCallback((r, strokes) => {
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
      strokes
    });
  }, [onRecognized]);

  const clearRetry = () => { if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; } };

  /** Send the page to the server reader. Its reading is the only reading. */
  const sendToReader = useCallback((strokes, seq) => {
    if (disabledRef.current) return;
    const who = userRef.current;
    // Offline is known before anything is sent: no doomed request, just the
    // honest note, and the 'online' listener below reads the page later.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline || !cloudReadingEnabled(who)) {
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
      const reading = outcome?.transcription ? toReading(outcome.transcription, null) : null;
      if (reading) {
        retriesRef.current = 0;
        publish(reading, strokes);
        setStatus(null);
        return;
      }
      if (outcome?.reason === 'empty') { setStatus({ kind: 'empty' }); return; }
      // Not read: say why, keep the ink, and try again by itself.
      sentRef.current = null;
      setStatus({ kind: 'waiting', key: inkReadingBlockedKey(who, { outcome }) });
      clearRetry();
      if (retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1;
        retryRef.current = setTimeout(() => {
          if (seq === readSeqRef.current && !disabledRef.current) sendToReader(strokesRef.current, seq);
        }, RETRY_MS);
      }
    }).catch(() => {
      if (seq !== readSeqRef.current || disabledRef.current) return;
      sentRef.current = null;
      setStatus({ kind: 'waiting', key: inkReadingBlockedKey(who) });
    });
  }, [publish]);

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

  const onStrokesChange = useCallback((strokes) => {
    strokesRef.current = strokes;
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
    if (typeof window !== 'undefined') window.addEventListener?.('online', onOnline);
    return () => {
      try { stopSession(); } catch { /* gone */ }
      if (typeof window !== 'undefined') window.removeEventListener?.('online', onOnline);
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

  const act = (fn) => () => { canvasRef.current?.[fn](); };

  // i18n-exempt-start: engine identifier for developers and evaluators, drawn only when inkDiagnosticsVisible(); students see t('verdict.readOnServer')
  const engineNote = rec.cloud === true ? `Read on the server · ${rec.engine || 'cloud'}` : null;
  // i18n-exempt-end
  const shownEngineNote = diagnostics ? engineNote : (rec.cloud === true ? t('verdict.readOnServer') : null);
  const statusLine = status?.kind === 'reading'
    ? t('ink.serverReading')
    : status?.kind === 'empty'
      ? t('ink.serverEmpty')
      : status?.kind === 'allowance'
        ? t('ink.cloudAllowanceUsed')
        : status?.kind === 'waiting'
          ? t(status.key)
          : null;

  return (
    <div className={`ink-answer ${disabled ? 'ink-disabled' : ''}`}>
      <div className="ink-toolbar">
        <button type="button" className={`ink-tool ${tool === 'pen' ? 'on' : ''}`} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} title={t('ink.pen')}>✒️ {t('ink.pen')}</button>
        <button type="button" className={`ink-tool ${tool === 'eraser' ? 'on' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} title={t('ink.eraser')}>◻️ {t('ink.eraser')}</button>
        <span className="ink-sep" />
        <button type="button" className="ink-tool" onClick={act('undo')} title={t('ink.undo')} aria-label={t('ink.undoAria')}>↩︎</button>
        <button type="button" className="ink-tool" onClick={act('redo')} title={t('ink.redo')} aria-label={t('ink.redoAria')}>↪︎</button>
        <button type="button" className="ink-tool" onClick={act('clear')} title={t('ink.clear')} aria-label={t('ink.clearAria')}>🗑</button>
        <span className="ink-sep" />
        <button type="button" className="ink-tool" aria-label={t('ink.moreSpaceAria')}
          onClick={() => setExtraHeight(h => Math.min(400, h + 120))} title={t('ink.moreSpace')}>＋ {t('ink.spaceShort')}</button>
        <span className="ink-sep" />
        <button type="button" className={`ink-tool ${finger ? 'on' : ''}`} title={t('ink.fingerToggleTitle')}
          aria-label={t('ink.fingerToggleAria')} aria-pressed={finger}
          onClick={() => setFinger(f => !f)}>☝ {t('ink.finger')}</button>
        <span className="ink-hint">
          {t('ink.hintEachLine')}
        </span>
      </div>

      <div className="ink-stage">
        <Surface
          ref={canvasRef}
          height={fittedHeight + extraHeight}
          tool={tool}
          fingerMode={finger ? 'finger' : 'auto'}
          disabled={disabled}
          onStrokesChange={onStrokesChange}
          ariaLabel={t('ink.answerSpaceAria')}
        />
        {lineVerdicts && rec.lines.some(l => l.box) && (
          <div className="ink-verdict-layer" aria-hidden="true">
            {rec.lines.map((line, li) => {
              const v = lineVerdicts[li];
              if (!v || !line.box) return null;
              const good = v.status === 'ok';
              const bad = v.status === 'break' || v.status === 'wrong';
              if (!good && !bad) return null;
              const geometry = feedbackGeometry(line);
              const b = geometry.anchor || line.box;
              return (
                <span key={li} className={`ink-verdict ${good ? 'good' : 'bad'}`}
                  style={{ top: b.y + b.h / 2 - 14, left: b.x + b.w + 16 }}
                  title={v.note || (good ? t('ink.lineChecksOut') : t('ink.lineBreaks'))}>{good ? '✓' : '✗'}</span>
              );
            })}
          </div>
        )}
      </div>

      {statusLine && !disabled && (
        <div className="ink-status muted" role="status" aria-live="polite" style={{ margin: '8px 2px 0', fontSize: 12.5 }}>
          {statusLine}
        </div>
      )}

      {rec.lines.length > 0 && (
        <div className="ink-preview">
          <div className="ink-preview-title" id="ink-reading">
            {t('ink.reading')}{shownEngineNote && <span className="muted" style={{ marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>{shownEngineNote}</span>}
          </div>
          {rec.lines.map((line, li) => (
            <div className="ink-line" key={li} data-text={line.text}>
              <span className="ink-line-n" aria-hidden="true">{li + 1}</span>
              {lineVerdicts && lineVerdicts[li] && ['ok', 'break', 'wrong'].includes(lineVerdicts[li].status) && (
                <span className={`ink-line-verdict ${lineVerdicts[li].status === 'ok' ? 'good' : 'bad'}`}>
                  {lineVerdicts[li].status === 'ok' ? '✓' : '✗'}
                  <span className="sr-only">{t(lineVerdicts[li].status === 'ok' ? 'ink.lineOkSr' : 'ink.lineBreakSr', { n: li + 1 })}{' '}</span>
                </span>
              )}
              <span className="ink-line-math"><MathText text={`$${exprToLatex(line.text) || '\\;'}$`} /></span>
              {lineVerdicts && lineVerdicts[li] && ['break', 'wrong'].includes(lineVerdicts[li].status) && lineVerdicts[li].note && (
                <span className="sc-note" style={{ fontSize: 12.5 }}>— {lineVerdicts[li].note}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
