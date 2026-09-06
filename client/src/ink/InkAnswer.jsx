// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Write-to-answer surface
// Ink canvas + toolbar + live on-device recognition with per-symbol
// tap-to-correct. The recognised lines feed Step Check; the final line is
// submitted as the answer, together with how sure the engine is that it read
// that line right — see "How sure the reading is" below.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import InkCanvas from './InkCanvas.jsx';
import NativeInkCanvas from './NativeInkCanvas.jsx';
import { nativeInk, nativeInkAvailable, inferredNotationContext } from './native.js';
import { chooseNativeConsensus, hasReading, normalizedReadingText } from './nativeConsensus.js';
import { recognizeWithStructuralDev } from '../../dev/devStructural.js';
import { recognize, exprToLatex } from './recognizer.js';
import { cloudReadingEnabled, readWithCloud, shouldSupersede, toReading } from './cloudReader.js';
import { useApp } from '../App.jsx';
import { recognizeWithoutDetachedSideWork } from './runtimeSpatial.js';
import { feedbackGeometry } from './feedbackGeometry.js';
import { ALPHABET } from './templates.js';
import { classOfSymbol } from './classes.js';
import { ensurePersonalLoaded, addPersonal } from './personal.js';
import { MathText } from '../lib/latex.jsx';

const NICE = { pi: 'π', theta: 'θ', sqrt: '√', percent: '%' };
const showSym = s => NICE[s] || s;

// ── Which surface, which engine ──────────────────────────────────────────────
// PencilKit is the native capture surface. Recognition on iPad is an evidence
// problem, not a fallback ladder: Foundation and JS form two independent
// opinions, and any disagreement MUST ask the native Vision/geometry reader
// for a third vote. A legacy JS reading can never become authoritative merely
// because its synthetic confidence is high on real Apple Pencil handwriting.
// Browser/LAN builds normally begin at stage 2. `serve:lan:v4` adds a strictly
// development-only first opinion from the local Structural V4 PyTorch worker on
// the developer Mac, so physical iPad testing can exercise the actual research
// model without pretending it is a production/offline asset.
const NATIVE_INK = nativeInkAvailable();
const Surface = NATIVE_INK ? NativeInkCanvas : InkCanvas;
/** How long the page must be still before it is worth sending. */
const CLOUD_SETTLE_MS = 1800;

const EMPTY_READING = { lines: [], text: '', symbols: [], minConf: 1, margin: 1, weakest: null };
const structuralLanExpected = () => !NATIVE_INK && typeof window !== 'undefined' && window.__PRI_LAN_DEV__ === true;

/**
 * Native rescue reads lines. If it leaves a short line unread (a lone "x", a
 * bare "3"), heal that line with Pri's JS engine so a written step cannot
 * silently disappear.
 */
function readUnreadLines(reading, strokes, overrides, ctx = null) {
  let healed = false;
  const lines = reading.lines.map((line, li) => {
    if (!line.unread || !line.strokeIdxs?.length) return line;
    const own = line.strokeIdxs.map(i => strokes[i]).filter(Boolean);
    if (!own.length) return line;
    let fallback;
    try { fallback = recognize(own, overrides, ctx); } catch { return line; }
    const first = fallback.lines[0];
    if (!first || !first.text) return line;
    healed = true;
    return {
      ...line,
      text: first.text,
      box: first.box,
      symbols: first.symbols.map(sym => ({
        ...sym,
        id: `w${li}_${sym.id}`,
        strokeIdxs: (sym.strokeIdxs || [])
          .map(i => line.strokeIdxs[i])
          .filter(i => i !== undefined)
      }))
    };
  });
  if (!healed) return reading;
  return { ...reading, lines, text: lines.map(l => l.text).join('\n') };
}

// ── How sure the reading is ──────────────────────────────────────────────────
const rivalOf = (s) => {
  const cls = classOfSymbol(s.sym);
  return (s.alts || []).find(a => a.sym !== s.sym && classOfSymbol(a.sym) !== cls) || null;
};

function readingConfidence(result) {
  const syms = result.lines.flatMap(l => l.symbols || []);
  let minConf = 1, margin = 1, weakest = null;
  syms.forEach((s, index) => {
    const conf = typeof s.conf === 'number' ? s.conf : 1;
    const rival = rivalOf(s);
    const gap = Math.max(0, Math.min(1, conf - (rival ? rival.conf : 0)));
    if (conf < minConf) minConf = conf;
    if (gap < margin) margin = gap;
    if (!weakest || conf < weakest.conf) {
      weakest = { id: s.id, index, sym: s.sym, conf, alts: s.alts || [], rival };
    }
  });
  const named = result.weakest ? syms[result.weakest.index] : null;
  return {
    minConf: typeof result.minConf === 'number' ? result.minConf : minConf,
    margin: typeof result.margin === 'number' ? result.margin : margin,
    weakest: result.weakest
      ? { ...result.weakest, id: named?.id ?? weakest?.id ?? null, rival: named ? rivalOf(named) : null }
      : weakest
  };
}

/**
 * lineVerdicts: optional array aligned with recognised lines, e.g.
 * [{status:'ok'}, {status:'break', note:'…'}] — drawn as a teacher-style
 * ✓/✗ overlay on the ink itself and as badges in the reading panel.
 * focusSymbol: id of a glyph the caller wants checked.
 * recognitionContext: optional safe question context consumed by recognize().
 */
export default function InkAnswer({ onRecognized, height = 300, disabled, lineVerdicts = null, focusSymbol = null, recognitionContext = null }) {
  const canvasRef = useRef(null);
  // The signed-in profile carries the server-reading opt-in, which is off
  // unless the student turned it on.
  const { user } = useApp();
  const [tool, setTool] = useState('pen');
  const [finger, setFinger] = useState(false);
  const [rec, setRec] = useState({ lines: [], text: '' });
  const [overrides, setOverrides] = useState({});
  const [picker, setPicker] = useState(null);
  const [extraHeight, setExtraHeight] = useState(0);
  const timerRef = useRef(null);
  const readSeqRef = useRef(0);
  const cloudAbortRef = useRef(null);
  const cloudSettleRef = useRef(null);
  const cloudSentRef = useRef(null);
  const [cloudState, setCloudState] = useState(null);   // null | 'reading' | 'confirm' | 'failed'
  // An unconfident server reading is kept here and offered, never applied. The
  // student decides, because they are the only one who knows what they wrote.
  const [cloudOffer, setCloudOffer] = useState(null);
  // Read inside the async cloud pass, where the `overrides` of the render that
  // started it would be stale by the time the server answers.
  const overridesRef = useRef({});
  const strokesRef = useRef([]);
  const pickerRef = useRef(null);
  const focusedRef = useRef(null);

  useEffect(() => { overridesRef.current = overrides; }, [overrides]);

  const publish = useCallback((r, strokes) => {
    setRec(r);
    // A server reading has no per-glyph symbols, so readingConfidence would
    // find an empty list and report a perfect 1/1 — which walked straight past
    // the confirmation gate that exists to catch an unsure reading. Its own
    // confidence is the number that means something here.
    const sure = r.cloud === true
      ? { minConf: Number(r.confidence ?? 0), margin: Number(r.confidence ?? 0), weakest: null }
      : readingConfidence(r);
    onRecognized?.({
      lines: r.lines.map(l => l.text),
      lineBoxes: r.lines.map(l => l.box),
      text: r.text,
      answerLine: r.lines.length ? r.lines[r.lines.length - 1].text : '',
      minConf: sure.minConf,
      margin: sure.margin,
      weakest: sure.weakest,
      engine: r.engine || null,
      researchOnly: r.researchOnly === true,
      productionReady: r.productionReady === true,
      strokes
    });
  }, [onRecognized]);

  /**
   * Ask the server to read the same strokes, after the local reading is already
   * on screen. Supersedes only a reading the student has not corrected, and only
   * when the server says it is confident; otherwise the local reading stands and
   * the student is offered the alternative.
   */
  const sendCloudPass = useCallback((strokes, seq, localReading) => {
    if (!cloudReadingEnabled(user)) return;
    cloudAbortRef.current?.abort?.();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    cloudAbortRef.current = controller;
    setCloudState('reading');

    readWithCloud(strokes, { user, signal: controller?.signal }).then(outcome => {
      // Newer writing has already replaced this read.
      if (seq !== readSeqRef.current) return;
      if (!outcome || outcome.reason) { setCloudState(null); setCloudOffer(null); return; }
      if (outcome.error) { setCloudState('failed'); setCloudOffer(null); return; }

      const reading = toReading(outcome.transcription, localReading);
      if (!reading) { setCloudState(null); setCloudOffer(null); return; }
      const corrected = Object.keys(overridesRef.current || {}).length > 0;
      if (shouldSupersede(reading, localReading, { hasManualCorrections: corrected })) {
        publish(reading, strokes);
        setCloudState(null);
        setCloudOffer(null);
        return;
      }
      // Not applied. Offer it only when it actually says something different —
      // and never over a correction the student made by hand.
      const differs = reading.text.trim() && reading.text.trim() !== (localReading?.text || '').trim();
      if (differs && !corrected) {
        setCloudOffer({ reading, strokes });
        setCloudState('confirm');
      } else {
        setCloudOffer(null);
        setCloudState(null);
      }
    }).catch(() => { if (seq === readSeqRef.current) { setCloudState('failed'); setCloudOffer(null); } });
  }, [user, publish]);

  const runCloudPass = useCallback((strokes, seq, localReading) => {
    if (!cloudReadingEnabled(user)) return;
    // A student writing five lines of working pauses past the browser's 240 ms
    // quiet window dozens of times, and each pause used to send the whole page
    // again. The previous request was aborted, but usually only after it had
    // gone. Settle properly first, and never send the same strokes twice.
    const signature = `${strokes.length}:${strokes.reduce((n, st) => n + (st?.points?.length || 0), 0)}`;
    if (cloudSentRef.current === signature) return;
    if (cloudSettleRef.current) clearTimeout(cloudSettleRef.current);
    cloudSettleRef.current = setTimeout(() => {
      cloudSentRef.current = signature;
      sendCloudPass(strokes, seq, localReading);
    }, CLOUD_SETTLE_MS);
  }, [user, sendCloudPass]);


  const runRecognition = useCallback((strokes, ovr) => {
    const seq = ++readSeqRef.current;
    const effectiveContext = inferredNotationContext(recognitionContext);

    const readWithJS = () => {
      try { return recognizeWithoutDetachedSideWork(strokes, ovr, effectiveContext, recognize); }
      catch { return null; }
    };

    // Browser/dev: prefer the explicit Structural V4 LAN research bridge when
    // the server exposes it. A normal build answers 404 once, the client caches
    // that absence, and the mature JS recogniser remains the local fallback.
    // On the dedicated V4 LAN origin, however, a V4 miss is now named in the
    // engine label instead of looking like an ordinary V3 result. That prevents
    // a physical-iPad research session from accidentally judging V4 by legacy
    // fallback output.
    if (!NATIVE_INK) {
      recognizeWithStructuralDev(strokes).then(v4 => {
        if (seq !== readSeqRef.current) return;
        if (v4?.lines?.some(line => line.text)) {
          publish(v4, strokes);
          return;
        }
        const local = readWithJS();
        if (seq !== readSeqRef.current) return;
        const engine = structuralLanExpected() ? 'pri-js-v3-v4-unavailable' : 'pri-js-v3';
        const published = local ? { ...local, engine } : { ...EMPTY_READING, engine };
        publish(published, strokes);
        runCloudPass(strokes, seq, published);
      });
      return;
    }

    // Native iPad: Foundation and JS are opinions, not fallbacks. The previous
    // implementation allowed a lone JS V3 reading to short-circuit this path
    // when JS reported high confidence. Real Pencil evidence showed that those
    // confidences are not calibrated outside the synthetic/template domain.
    // Therefore only exact two-engine agreement may finish early. Every other
    // case asks the native Vision/geometry reader for a third answer-blind vote.
    nativeInk.foundationRecognize(ovr, effectiveContext).then(foundation => {
      if (seq !== readSeqRef.current) return;
      const localRaw = readWithJS();
      const local = localRaw ? { ...localRaw, engine: 'pri-js-v3' } : null;

      if (hasReading(foundation) && hasReading(local)
          && normalizedReadingText(foundation) === normalizedReadingText(local)) {
        const agreed = chooseNativeConsensus([foundation, local], effectiveContext);
        const published = agreed || { ...EMPTY_READING, engine: 'pri-native-no-reading' };
        publish(published, strokes);
        runCloudPass(strokes, seq, published);
        return;
      }

      nativeInk.recognize(ovr, effectiveContext).then(nativeRaw => {
        if (seq !== readSeqRef.current) return;
        const nativeReading = nativeRaw
          ? readUnreadLines(nativeRaw, strokes, ovr, effectiveContext)
          : null;
        const chosen = chooseNativeConsensus([foundation, local, nativeReading], effectiveContext);
        const published = chosen || { ...EMPTY_READING, engine: 'pri-native-no-reading' };
        publish(published, strokes);
        // The three on-device readers disagreed often enough to need a fourth
        // opinion; this is where a server read earns its cost.
        runCloudPass(strokes, seq, published);
      });
    });
  }, [publish, recognitionContext, runCloudPass]);

  const onStrokesChange = useCallback((strokes) => {
    strokesRef.current = strokes;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Native whole-page recognition is intentionally a quiet-window operation.
    // A 240 ms debounce caused a recognition job after normal pauses between
    // symbols/lines; those jobs then queued behind Core ML/Vision and the newest
    // page timed out. Browser JS remains cheap enough for the old live cadence.
    const quietMs = NATIVE_INK ? (strokes.length > 24 ? 1600 : 1000) : 240;
    timerRef.current = setTimeout(() => runRecognition(strokes, overrides), quietMs);
  }, [overrides, runRecognition]);

  useEffect(() => { ensurePersonalLoaded(); }, []);
  useEffect(() => () => {
    readSeqRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    // A student who leaves the question mid-read was still uploading their ink.
    if (cloudSettleRef.current) clearTimeout(cloudSettleRef.current);
    cloudAbortRef.current?.abort?.();
  }, []);

  useEffect(() => {
    if (!focusSymbol) { focusedRef.current = null; return; }
    if (focusedRef.current === focusSymbol) return;
    const sym = rec.lines.flatMap(l => l.symbols || []).find(s => s.id === focusSymbol);
    if (!sym) return;
    focusedRef.current = focusSymbol;
    setPicker({ id: sym.id, alts: sym.alts || [] });
  }, [focusSymbol, rec]);

  useEffect(() => {
    if (picker && picker.id === focusSymbol) pickerRef.current?.querySelector('button')?.focus();
  }, [picker, focusSymbol]);

  const applyOverride = (id, sym) => {
    const next = { ...overrides, [id]: sym };
    setOverrides(next);
    setPicker(null);
    // Corrections remain local training evidence regardless of which Pri model
    // produced the original reading. Approximate ownership is never learned.
    const symbol = rec.lines.flatMap(l => l.symbols || []).find(s => s.id === id);
    if (symbol?.strokeIdxs?.length && !symbol.approx) {
      const strokes = symbol.strokeIdxs.map(i => strokesRef.current[i]).filter(Boolean);
      if (strokes.length) addPersonal(sym, strokes, 'correction');
    }
    runRecognition(strokesRef.current, next);
  };

  const act = (fn) => () => {
    setOverrides({});
    setPicker(null);
    canvasRef.current?.[fn]();
  };

  // Which engine actually produced what is on screen. A server reading was
  // previously labelled "Native recognition path" on iPad and given no label at
  // all in the browser — cloudReader tags a reading `cloud` precisely so that
  // History and the student can tell the two apart.
  const engineNote = rec.cloud === true
    ? `Read on the server · ${rec.engine || 'cloud'}`
    : rec.engine === 'pri-structural-v4-dev-lan'
      ? 'Structural V4 research · Mac LAN · not production'
      : rec.engine === 'pri-js-v3-v4-unavailable'
        ? 'Structural V4 returned no reading · showing JS V3 fallback'
        : rec.engine === 'pri-js-v3'
          ? 'Legacy JS V3 fallback · not native PencilKit/Core ML'
          : rec.disagreement
            ? `Native engines disagree · confirmation required · ${rec.engine}`
            : NATIVE_INK && rec.engine
              ? `Native recognition path · ${rec.engine}`
              : null;

  return (
    <div className={`ink-answer ${disabled ? 'ink-disabled' : ''}`}>
      {!NATIVE_INK && (
        <div role="note" style={{ padding: '9px 12px', marginBottom: 8, border: '1px solid var(--warn)', borderRadius: 10, fontSize: 12.5 }}>
          Browser handwriting = legacy JS fallback. For handwriting quality testing, run the native iPad package with PencilKit; this web fallback is not the production acceptance path.
        </div>
      )}
      <div className="ink-toolbar">
        <button type="button" className={`ink-tool ${tool === 'pen' ? 'on' : ''}`} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')} title="Pen">✒️ Pen</button>
        <button type="button" className={`ink-tool ${tool === 'eraser' ? 'on' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser">◻️ Eraser</button>
        <span className="ink-sep" />
        <button type="button" className="ink-tool" onClick={act('undo')} title="Undo" aria-label="Undo last stroke">↩︎</button>
        <button type="button" className="ink-tool" onClick={act('redo')} title="Redo" aria-label="Redo last stroke">↪︎</button>
        <button type="button" className="ink-tool" onClick={act('clear')} title="Clear" aria-label="Clear all handwriting">🗑</button>
        <span className="ink-sep" />
        <button type="button" className="ink-tool" aria-label="Add more writing space"
          onClick={() => setExtraHeight(h => Math.min(400, h + 120))} title="More space">＋ space</button>
        <span className="ink-sep" />
        <button type="button" className={`ink-tool ${finger ? 'on' : ''}`} title="Draw with a finger too (otherwise fingers scroll once a Pencil is seen)"
          aria-label="Draw with a finger as well as a Pencil" aria-pressed={finger}
          onClick={() => setFinger(f => !f)}>☝ Finger</button>
        <span className="ink-hint">
          Write each step on its own line · {NATIVE_INK ? 'Apple Pencil' : 'Pencil or finger'}
        </span>
      </div>

      <div className="ink-stage">
        <Surface
          ref={canvasRef}
          height={height + extraHeight}
          tool={tool}
          fingerMode={finger ? 'finger' : 'auto'}
          disabled={disabled}
          onStrokesChange={onStrokesChange}
          ariaLabel="Handwriting answer space"
        />
        {lineVerdicts && rec.lines.length > 0 && (
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
                      <span
                        key={`box-${gi}`}
                        className={`ink-linebox ${good ? 'good' : 'bad'}`}
                        style={{ left: gb.x - 5, top: gb.y - 5, width: gb.w + 10, height: gb.h + 10 }}
                      />
                    ))}
                    <span
                      className={`ink-verdict ${good ? 'good' : 'bad'}`}
                      style={{ top: b.y + b.h / 2 - 14, left: b.x + b.w + 16 }}
                      title={v.note || (good ? 'This line checks out' : 'The maths breaks on this line')}
                    >{good ? '✓' : '✗'}</span>
                    {bad && boxes.map((gb, gi) => (
                      <span
                        key={`underline-${gi}`}
                        className="ink-underline"
                        style={{ left: gb.x - 3, top: gb.y + gb.h + 4, width: gb.w + 6 }}
                      />
                    ))}
                    {showNote && (
                      <span className="ink-note" style={{ left: Math.max(4, b.x - 2), top: b.y + b.h + 16 }}>
                        <b>✗ the mistake is here</b>{v.note ? <> — {v.note}</> : null}
                      </span>
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}
      </div>

      {rec.lines.length > 0 && (
        <div className="ink-preview">
          <div className="ink-preview-title" id="ink-reading">
            I'm reading:{engineNote && <span className="muted" style={{ marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>{engineNote}</span>}
            {cloudState === 'reading' && (
              <span className="muted" style={{ marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>· checking this reading</span>
            )}
            {cloudState === 'failed' && (
              <span className="muted" style={{ marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>· couldn’t reach the reader — this is the on-device reading</span>
            )}
          </div>
          {cloudOffer && (
            <div className="ink-cloud-offer" style={{ margin: '6px 14px 2px', fontSize: 12.5 }}>
              <div className="muted" style={{ marginBottom: 4 }}>Another reading of the same ink — use it if it is closer to what you wrote:</div>
              <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="ink-line-math"><MathText text={`$${exprToLatex(cloudOffer.reading.text) || '\\;'}$`} /></span>
                <button type="button" className="btn btn-quiet btn-sm"
                  onClick={() => { publish(cloudOffer.reading, cloudOffer.strokes); setCloudOffer(null); setCloudState(null); }}>
                  Use this reading
                </button>
                <button type="button" className="btn btn-quiet btn-sm"
                  onClick={() => { setCloudOffer(null); setCloudState(null); }}>
                  Keep mine
                </button>
              </div>
            </div>
          )}
          {rec.disagreement && Array.isArray(rec.candidateReadings) && rec.candidateReadings.length > 1 && (
            <details style={{ margin: '8px 14px 2px', fontSize: 11.5 }} className="muted">
              <summary style={{ cursor: 'pointer' }}>Recognition evidence</summary>
              {rec.candidateReadings.map((candidate, index) => (
                <div key={`${candidate.engine}-${index}`} style={{ marginTop: 5, overflowWrap: 'anywhere' }}>
                  <b>{candidate.engine}</b> → {candidate.text || candidate.failure || 'no reading'}
                </div>
              ))}
            </details>
          )}
          {rec.lines.map((line, li) => (
            <div className="ink-line" key={li}>
              <span className="ink-line-n" aria-hidden="true">{li + 1}</span>
              {lineVerdicts && lineVerdicts[li] && ['ok', 'break', 'wrong'].includes(lineVerdicts[li].status) && (
                <span className={`ink-line-verdict ${lineVerdicts[li].status === 'ok' ? 'good' : 'bad'}`}>
                  {lineVerdicts[li].status === 'ok' ? '✓' : '✗'}
                  <span className="sr-only">Line {li + 1} {lineVerdicts[li].status === 'ok' ? 'checks out' : 'is where the maths breaks'}. </span>
                </span>
              )}
              <span className="ink-line-math"><MathText text={`$${exprToLatex(line.text) || '\\;'}$`} /></span>
              {lineVerdicts && lineVerdicts[li] && ['break', 'wrong'].includes(lineVerdicts[li].status) && lineVerdicts[li].note && (
                <span className="sc-note" style={{ fontSize: 12.5 }}>— {lineVerdicts[li].note}</span>
              )}
              <span className="ink-syms">
                {(line.symbols || []).map(s => (
                  <button
                    type="button"
                    key={s.id}
                    className={`ink-sym ${s.conf < 0.45 ? 'shaky' : ''}`}
                    style={s.id === focusSymbol
                      ? { outline: '2px solid var(--brand-1)', outlineOffset: 2, borderRadius: 4 }
                      : undefined}
                    title={s.id === focusSymbol ? 'Check this one' : 'Tap to correct'}
                    aria-label={`Line ${li + 1}, symbol read as “${showSym(s.sym)}”${s.conf < 0.45 ? ', a shaky reading' : ''} — change it`}
                    aria-expanded={picker?.id === s.id}
                    onClick={() => setPicker(picker?.id === s.id ? null : { id: s.id, alts: s.alts || [] })}
                  >{showSym(s.sym)}</button>
                ))}
              </span>
            </div>
          ))}
          {picker && (
            <div className="ink-picker" ref={pickerRef} role="group" aria-label="Change this symbol">
              <div className="ink-picker-row">
                {(picker.alts || []).map(a => (
                  <button type="button" key={a.sym} className="ink-pick"
                    aria-label={`Change it to “${showSym(a.sym)}” — ${Math.round(a.conf * 100)}% sure`}
                    onClick={() => applyOverride(picker.id, a.sym)}>
                    {showSym(a.sym)} <small>{Math.round(a.conf * 100)}%</small>
                  </button>
                ))}
              </div>
              <div className="ink-picker-all">
                {ALPHABET.map(s => (
                  <button type="button" key={s} className="ink-pick tiny" aria-label={`Change it to “${showSym(s)}”`}
                    onClick={() => applyOverride(picker.id, s)}>{showSym(s)}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
