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
import { nativeInk, nativeInkAvailable } from './native.js';
import { recognizeWithStructuralDev } from '../../dev/devStructural.js';
import { recognize, exprToLatex } from './recognizer.js';
import { recognizeWithoutDetachedSideWork } from './runtimeSpatial.js';
import { feedbackGeometry } from './feedbackGeometry.js';
import { ALPHABET } from './templates.js';
import { classOfSymbol } from './classes.js';
import { ensurePersonalLoaded, addPersonal } from './personal.js';
import { MathText } from '../lib/latex.jsx';

const NICE = { pi: 'π', theta: 'θ', sqrt: '√', percent: '%' };
const showSym = s => NICE[s] || s;

// ── Which surface, which engine ──────────────────────────────────────────────
// PencilKit is the native capture surface. Recognition order on iPad is now:
//   1. Pri's bundled Core ML foundation model, when a validated asset exists;
//   2. Pri's mature JS stroke/CNN/grammar recogniser;
//   3. the native Vision/geometry reader as an emergency no-result rescue.
// Browser/LAN builds normally begin at stage 2. `serve:lan:v4` adds a strictly
// development-only first opinion from the local Structural V4 PyTorch worker on
// the developer Mac, so physical iPad testing can exercise the actual research
// model without pretending it is a production/offline asset.
const NATIVE_INK = nativeInkAvailable();
const Surface = NATIVE_INK ? NativeInkCanvas : InkCanvas;
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
  const [tool, setTool] = useState('pen');
  const [finger, setFinger] = useState(false);
  const [rec, setRec] = useState({ lines: [], text: '' });
  const [overrides, setOverrides] = useState({});
  const [picker, setPicker] = useState(null);
  const [extraHeight, setExtraHeight] = useState(0);
  const timerRef = useRef(null);
  const readSeqRef = useRef(0);
  const strokesRef = useRef([]);
  const pickerRef = useRef(null);
  const focusedRef = useRef(null);

  const publish = useCallback((r, strokes) => {
    setRec(r);
    const sure = readingConfidence(r);
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

  const runRecognition = useCallback((strokes, ovr) => {
    const seq = ++readSeqRef.current;

    const readWithJS = () => {
      try { return recognizeWithoutDetachedSideWork(strokes, ovr, recognitionContext, recognize); }
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
        publish(local ? { ...local, engine } : { ...EMPTY_READING, engine }, strokes);
      });
      return;
    }

    // iPad native wrapper: first ask the Pri-owned Core ML foundation model.
    // Development builds without a promoted model return an empty result and
    // continue. Safe recognition context is forwarded across the bridge too.
    nativeInk.foundationRecognize(ovr, recognitionContext).then(foundation => {
      if (seq !== readSeqRef.current) return;
      if (foundation?.lines?.some(line => line.text)) {
        publish(foundation, strokes);
        return;
      }

      // The existing custom engine remains an independent local opinion and
      // protects the product while the real-writer corpus grows.
      const local = readWithJS();
      if (seq !== readSeqRef.current) return;
      if (local?.lines?.some(line => line.text)) {
        publish({ ...local, engine: 'pri-js-v3' }, strokes);
        return;
      }

      // Last resort only. This path is still fully on-device and exists to make
      // a missing/failed model an accuracy degradation rather than lost work.
      nativeInk.recognize(ovr, recognitionContext).then(reading => {
        if (seq !== readSeqRef.current) return;
        publish(
          reading
            ? readUnreadLines(reading, strokes, ovr, recognitionContext)
            : (local ? { ...local, engine: 'pri-js-v3' } : EMPTY_READING),
          strokes
        );
      });
    });
  }, [publish, recognitionContext]);

  const onStrokesChange = useCallback((strokes) => {
    strokesRef.current = strokes;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runRecognition(strokes, overrides), 240);
  }, [overrides, runRecognition]);

  useEffect(() => { ensurePersonalLoaded(); }, []);
  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

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

  const engineNote = rec.engine === 'pri-structural-v4-dev-lan'
    ? 'Structural V4 research · Mac LAN · not production'
    : rec.engine === 'pri-js-v3-v4-unavailable'
      ? 'Structural V4 returned no reading · showing JS V3 fallback'
      : rec.engine === 'pri-js-v3'
        ? 'JS V3 fallback'
        : null;

  return (
    <div className={`ink-answer ${disabled ? 'ink-disabled' : ''}`}>
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
          </div>
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
