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
import { ACCOUNT_BLOCKED_KEYS, inkReaderUiState, readerBlock, readerPaused, readinessIdentity, resumeReaderNow, readWithCloud, recordLocalHandwritingDiagnostics, toReading } from './cloudReader.js';
import { retryClock } from './readerFailure.js';
import { Link, useInRouterContext } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { feedbackGeometry } from './feedbackGeometry.js';
import { plausibleLineMatch, segmentInkLines } from './inkLines.js';
import { MathText } from '../lib/latex.jsx';
import { currentReleaseIdentity } from '../platform/releaseIdentity.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import { inkCanvasHeight, useFormFactor } from '../platform/formFactor.js';
import { useLanguage, useT } from '../i18n/index.js';
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
// How long a server read runs before the note changes to "still reading".
export const STILL_READING_MS = 5000;

// The reader's "why this page is waiting" sentences were written with a save
// claim in them ("Saved. It will be read…"). The reader does not know whether
// the page was saved; the card does, from an IndexedDB readback. Until the
// card says so, the same reason is given without the claim.
const WAITING_WITHOUT_SAVE_CLAIM = {
  'ink.waitingOffline': 'ink.waitingOfflinePlain',
  'ink.waitingServiceDown': 'ink.waitingServiceDownPlain',
  'ink.waitingNotOnThisInstall': 'ink.waitingNotOnThisInstallPlain'
};

const EMPTY_READING = { lines: [], text: '' };

/** What this device already knows makes a read impossible, without asking — or null. */
function knownBlockOf(who, isOnline) {
  const paused = readerPaused();
  const block = readerBlock(who, { online: () => isOnline, ...(paused ? { outcome: { failure: paused.failure } } : {}) });
  if (['turned-off', 'not-available', 'offline', 'session'].includes(block.kind)) return block;
  return paused ? block : null;
}
// The content of the page, not only its size: two pages with the same number
// of strokes and points are different pages.
export const strokeSignature = strokes => {
  let h = 0x811c9dc5, points = 0;
  for (const st of strokes) {
    h = Math.imul(h ^ 0x7c, 0x01000193) >>> 0;
    for (const p of st?.points || []) {
      points += 1;
      h = Math.imul(h ^ (Math.round(Number(p?.x) || 0) & 0xffff), 0x01000193) >>> 0;
      h = Math.imul(h ^ (Math.round(Number(p?.y) || 0) & 0xffff), 0x01000193) >>> 0;
    }
  }
  return `${strokes.length}:${points}:${h.toString(36)}`;
};

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

export default function InkAnswer({ onRecognized, onStrokes = null, onReaderState = null, initialStrokes = null, initialReading = null, height = 300, disabled, lineVerdicts = null, focusSymbol = null, recognitionContext = null, draftSaved = true }) {
  const [NATIVE_INK] = useState(nativeInkAvailable);
  const Surface = NATIVE_INK ? NativeInkCanvas : InkCanvas;
  const [diagnostics] = useState(inkDiagnosticsVisible);
  const t = useT();
  const { language } = useLanguage();
  const formFactor = useFormFactor();
  const fittedHeight = inkCanvasHeight(height, formFactor);
  const canvasRef = useRef(null);
  const { user } = useApp();
  const inRouter = useInRouterContext();
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
  // null | { kind: 'reading' } | { kind: 'waiting', key, block, stopped } | { kind: 'empty' } | { kind: 'allowance', key, block }
  const [status, setStatus] = useState(null);
  // Whether there is ink on the page, and whether the reading on screen is of
  // an earlier state of it (the student wrote, erased or undid since).
  const [hasInk, setHasInk] = useState(false);
  const [stale, setStale] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  // What is said about reading: a refusal the reader gave, or — before any
  // read is asked for — a reason this device already knows makes one
  // impossible (signed out, offline, switched off, a limit being waited out).
  // The student is told the reason and its action instead of being shown a
  // "Read my answer" that could not work.
  const known = hasInk && !disabled ? knownBlockOf(user, online) : null;
  const shownStatus = status || (known ? { kind: known.kind === 'allowance' ? 'allowance' : 'waiting', key: known.inkKey, block: known } : null);
  const shownKey = shownStatus ? `${shownStatus.kind}|${shownStatus.key || ''}` : '';
  useEffect(() => {
    if (typeof onReaderState !== 'function') return;
    // A reading of earlier writing is not a reading of this page.
    const state = inkReaderUiState(shownStatus, stale ? null : rec);
    try { onReaderState(stale ? Object.freeze({ ...state, stale: true }) : state); } catch { /* reporting must never break writing */ }
  }, [shownKey, rec, stale, onReaderState]); // eslint-disable-line react-hooks/exhaustive-deps
  const emptyRef = useRef(null);
  const readSeqRef = useRef(0);
  const abortRef = useRef(null);
  // The page being read right now, and the page the reading on screen is of.
  const flyingRef = useRef(null);
  const readRef = useRef(null);
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

  const publish = useCallback((r, strokes, { afterWait = false, stale: isStale = false } = {}) => {
    setRec(r);
    setStale(isStale && r.lines.length > 0);
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
      // The reading is of EARLIER writing: shown, labelled, never submitted.
      stale: isStale && r.lines.length > 0,
      // What the card keeps with the ink so a reload restores the transcript
      // (and the student's corrections) without reading the page again.
      kept: r.lines.length ? { signature: readRef.current, reading: r } : null,
      strokes
    });
  }, [onRecognized]);

  // ── Reading is asked for, never assumed ────────────────────────────────────
  // Owner decision: a read is a paid operation and happens when the student
  // presses "Read my answer" — once. Nothing else sends one: not a pause, a
  // stroke, a focus, a re-render, a reload, coming back online or signing in.
  // (The one other sender is "Try again" after a refusal or an outage, which
  // is the same explicit press.) Reads stay single-flight.

  const knownBlock = who => knownBlockOf(who, typeof navigator === 'undefined' || navigator.onLine !== false);

  /** The page was not read: name the reason and offer its action. Nothing is retried by itself. */
  const waitFor = (who, outcome) => {
    const block = readerBlock(who, { outcome });
    if (block.kind === 'allowance') { setStatus({ kind: 'allowance', key: block.inkKey, block }); return; }
    setStatus({ kind: 'waiting', key: block.inkKey, block });
  };

  /**
   * Send the page to the server reader — ONE recognition operation, because
   * the student asked. Its reading is the only reading.
   */
  const readNow = useCallback(() => {
    const strokes = strokesRef.current;
    if (disabledRef.current || !strokes.length) return;
    const signature = strokeSignature(strokes);
    // Single flight: a page that is being read is not sent again.
    if (flyingRef.current === signature) return;
    const who = userRef.current;
    const blocked = knownBlock(who);
    if (blocked && blocked.kind !== 'capacity' && blocked.kind !== 'rate-limited') {
      setStatus(blocked.kind === 'allowance' ? { kind: 'allowance', key: blocked.inkKey, block: blocked } : { kind: 'waiting', key: blocked.inkKey, block: blocked });
      return;
    }
    const seq = ++readSeqRef.current;
    abortRef.current?.abort?.();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    abortRef.current = controller;
    flyingRef.current = signature;
    const landed = () => { if (flyingRef.current === signature) flyingRef.current = null; };
    setStatus({ kind: 'reading' });
    readWithCloud(strokes, { user: who, signal: controller?.signal, freshReadiness: true }).finally(landed).then(outcome => {
      // The page was submitted or left while the server was reading it (§09:
      // a late reading never rewrites the reading a mark was given for).
      if (seq !== readSeqRef.current || disabledRef.current) return;
      if (outcome?.reason === 'cancelled') { setStatus(null); return; }
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
        readRef.current = signature;
        // The student may have gone on writing while the page was being
        // read: the reading that lands is then already of earlier writing.
        const now = strokesRef.current;
        publish(reading, now, { stale: !now.length || strokeSignature(now) !== signature });
        setStatus(null);
        return;
      }
      if (outcome?.reason === 'empty') { emptyRef.current = signature; setStatus({ kind: 'empty' }); return; }
      waitFor(who, outcome);
    }).catch((error) => {
      if (seq !== readSeqRef.current || disabledRef.current) return;
      // A refusal that escaped still names its reason (401 → sign in, 403
      // EMAIL_UNVERIFIED → verify); only an unknown throw is "not answering".
      waitFor(who, { error: { code: error?.code, status: error?.status, resetAt: error?.resetAt } });
    });
  }, [publish]); // eslint-disable-line react-hooks/exhaustive-deps

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
    publish(next, strokesRef.current, { stale });
  }, [rec, publish, stale]);

  const onStrokesChange = useCallback((strokes) => {
    if (strokes?.length) setCleared(null);
    strokesRef.current = strokes;
    setHasInk(strokes.length > 0);
    setCorrecting(null);
    // Kept the moment the pen lifts, whatever happens to reading: a page
    // written in the second before the app went away is still the student's.
    try { onStrokesRef.current?.(strokes); } catch { /* keeping ink is best-effort */ }
    const signature = strokes.length ? strokeSignature(strokes) : null;
    // A page that could not be read at all is a different page once it changes.
    if (emptyRef.current && emptyRef.current !== signature) { emptyRef.current = null; setStatus(prev => (prev?.kind === 'empty' ? null : prev)); }
    if (!rec.lines.length) return;
    if (!strokes.length) {
      // Nothing is written any more: an old transcript has nothing to be of.
      readRef.current = null;
      publish(EMPTY_READING, strokes);
      return;
    }
    // The writing changed after it was read. The transcript stays on screen,
    // labelled as from earlier writing; it is not sent, and the student is
    // offered "Read again". Undoing back to the page that was read makes the
    // transcript current again — it is the same page.
    const isStale = signature !== readRef.current;
    if (isStale !== stale) publish(rec, strokes, { stale: isStale });
  }, [publish, rec, stale]);

  // The world changed (back online, signed in, another profile): that can
  // clear a reason the page could not be read. It is never a reason to read —
  // the note goes and "Read my answer" is there to be pressed.
  useEffect(() => {
    const clearIf = kinds => setStatus(prev => (prev?.kind === 'waiting' && kinds.includes(prev.block?.kind) ? null : prev));
    const stopSession = onCloudSessionChange(() => clearIf(['session', 'verify-email', 'guardian', 'not-allowed']));
    const onOnline = () => { setOnline(true); clearIf(['offline']); };
    const onOffline = () => setOnline(false);
    if (typeof window !== 'undefined') {
      window.addEventListener?.('online', onOnline);
      window.addEventListener?.('offline', onOffline);
    }
    return () => {
      try { stopSession(); } catch { /* gone */ }
      if (typeof window !== 'undefined') {
        window.removeEventListener?.('online', onOnline);
        window.removeEventListener?.('offline', onOffline);
      }
    };
  }, []);
  const identityRef = useRef(readinessIdentity(user));
  useEffect(() => {
    const identity = readinessIdentity(user);
    const changed = identity !== identityRef.current;
    identityRef.current = identity;
    if (changed) setStatus(prev => (prev?.kind === 'waiting' && ['session', 'verify-email', 'guardian', 'not-allowed', 'turned-off'].includes(prev.block?.kind) ? null : prev));
  }, [user]);

  // Handwriting kept from before a reload comes back onto the page — and so
  // does its transcript, with the student's corrections, exactly as kept. The
  // page is NOT read again: a kept reading of the same strokes is current, and
  // one of other strokes is shown as from earlier writing.
  useEffect(() => {
    if (!Array.isArray(initialStrokes) || !initialStrokes.length) return;
    canvasRef.current?.setStrokes?.(initialStrokes);
    strokesRef.current = initialStrokes;
    setHasInk(true);
    try { onStrokesRef.current?.(initialStrokes); } catch { /* keeping ink is best-effort */ }
    const kept = initialReading?.reading;
    if (kept && Array.isArray(kept.lines) && kept.lines.length && typeof initialReading.signature === 'string') {
      readRef.current = initialReading.signature;
      publish(kept, initialStrokes, { stale: strokeSignature(initialStrokes) !== initialReading.signature });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Locking the page for marking invalidates every reading still in flight.
  useEffect(() => {
    const was = disabledRef.current;
    disabledRef.current = !!disabled;
    if (!disabled || was) return;
    readSeqRef.current += 1;
    abortRef.current?.abort?.();
    setStatus(null);
  }, [disabled]);
  useEffect(() => () => {
    readSeqRef.current += 1;
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
  const statusLine = shownStatus?.kind === 'reading'
    ? t(slowRead ? 'ink.serverStillReading' : 'ink.serverReading')
    : shownStatus?.kind === 'empty'
      ? t('ink.serverEmpty')
      : shownStatus?.kind === 'allowance'
        ? t(shownStatus.key || 'ink.waitingAllowance', { time: retryClock(shownStatus.block?.retryAt, language) })
        : shownStatus?.kind === 'waiting'
          ? t(draftSaved ? shownStatus.key : (WAITING_WITHOUT_SAVE_CLAIM[shownStatus.key] || shownStatus.key), { time: retryClock(shownStatus.block?.retryAt, language) })
          : null;
  // "Read my answer": offered whenever there is ink that has not been read as
  // it now stands and nothing is known to stop a read. One press, one read.
  const canAskToRead = hasInk && !disabled && !shownStatus && (!rec.lines.length || stale);

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
      {/* A blocker the student can clear themselves (sign in, verify their
          email, guardian consent) is one tap from where it is cleared: the
          account section of Settings holds sign-in and "send a fresh
          verification email". Kept beside the notice, not inside it, so the
          notice stays the one sentence it is announced as. */}
      {canAskToRead && (
        <div className="ink-status-action ink-read-action">
          <button type="button" className="btn btn-primary" data-ink-read={stale ? 'again' : 'first'} onClick={readNow}>
            {t(stale ? 'ink.readAgain' : 'ink.readMyAnswer')}
          </button>
          <span className="muted ink-read-hint">{t(stale ? 'ink.readAgainHint' : 'ink.readMyAnswerHint')}</span>
        </div>
      )}
      {/* A refusal the server gave (verify your email, a guardian's
          confirmation, a limit, an outage) has no "Read my answer" beside it,
          so it carries its own way back: one press asks once more. A reason
          the device already knows (signed out, offline, switched off) does
          not — its own action is the way forward. */}
      {status?.kind === 'waiting' && !disabled && status.block?.kind !== 'session' && status.block?.kind !== 'offline' && status.block?.kind !== 'turned-off' && status.block?.kind !== 'not-available' && (
        <div className="ink-status-action">
          <button type="button" className="btn btn-ghost btn-sm" data-ink-retry-reading data-reader-block={shownStatus.block?.kind || undefined}
            onClick={() => {
              if (!strokesRef.current.length) return;
              resumeReaderNow();
              setStatus(null);
              readNow();
            }}>{t('common.tryAgain')}</button>
        </div>
      )}
      {shownStatus?.kind === 'waiting' && !disabled && ACCOUNT_BLOCKED_KEYS.has(shownStatus.key) && (
        <div className="ink-status-action">
          {inRouter
            ? <Link className="ink-status-link" to="/settings" data-ink-blocker={shownStatus.key}>{t('app.accountSettings')}</Link>
            : <a className="ink-status-link" href="/settings" data-ink-blocker={shownStatus.key}>{t('app.accountSettings')}</a>}
        </div>
      )}

      {rec.lines.length > 0 && (
        <div className={`ink-preview${stale ? ' is-stale' : ''}`} data-stale={stale ? 'true' : undefined}>
          <div className="ink-preview-title" id="ink-reading">
            {t('ink.reading')}
            {/* A student always learns when their writing was read on the server. */}
            {shownEngineNote && <span className="ink-status muted">{shownEngineNote}</span>}
            {stale && <span className="ink-status ink-stale" role="status" data-ink-stale>{t('ink.readingStale')}</span>}
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
              {/* Every line of the reading is the student's to correct before
                  Submit, not only the ones the reader doubted: a confident
                  misread is still a misread, and it is their page. */}
              {!disabled && !stale && correcting?.index !== li && (
                <button type="button" className="ink-correct-btn" aria-label={t('ink.iWroteAria', { n: li + 1 })}
                  data-line-doubt={isLowConfidence(line, lineConfidenceFloor) ? 'low' : undefined}
                  onClick={() => setCorrecting({ index: li, text: line.text })}>{isLowConfidence(line, lineConfidenceFloor) ? t('ink.iWrote') : t('ink.editLine')}</button>
              )}
              {!disabled && !stale && correcting?.index === li && (
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
          {!disabled && !stale && lowConfidenceLines(rec).length > 0 && (
            <div className="ink-doubt-note" role="status">{t('ink.lowConfidenceLine', { n: lowConfidenceLines(rec)[0] + 1 })}</div>
          )}
        </div>
      )}
    </div>
  );
}
