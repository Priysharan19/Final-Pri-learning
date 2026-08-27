// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Write-to-answer surface
// Ink canvas + toolbar + live recognition with per-symbol correction on local
// readings. When the optional cloud handwriting gateway is configured, a clean
// raster of the ink is read in parallel and a confident cloud result becomes
// authoritative. Local/native Pri Ink remains the offline fallback.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import InkCanvas from './InkCanvas.jsx';
import NativeInkCanvas from './NativeInkCanvas.jsx';
import { nativeInk, nativeInkAvailable, inferredNotationContext } from './native.js';
import { chooseNativeConsensus, hasReading, normalizedReadingText } from './nativeConsensus.js';
import { recognizeWithStructuralDev } from '../../dev/devStructural.js';
import { recognize, exprToLatex } from './recognizer.js';
import { recognizeWithoutDetachedSideWork } from './runtimeSpatial.js';
import { recognizeWithCloud, cloudInkConfigured } from './cloud.js';
import { feedbackGeometry } from './feedbackGeometry.js';
import { ALPHABET } from './templates.js';
import { classOfSymbol } from './classes.js';
import { ensurePersonalLoaded, addPersonal } from './personal.js';
import { MathText } from '../lib/latex.jsx';

const NICE = { pi: 'π', theta: 'θ', sqrt: '√', percent: '%' };
const showSym = s => NICE[s] || s;

// ── Which surface, which engine ──────────────────────────────────────────────
// PencilKit remains the native capture surface. Cloud OCR is deliberately an
// optional recognition authority, never a capture surface and never a place for
// the OpenAI API key: client/src/ink/cloud.js can only call a Pri gateway URL.
// If that gateway is absent, offline Pri Ink behaves exactly as before.
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
      cloud: r.cloud === true,
      strokes
    });
  }, [onRecognized]);

  const runRecognition = useCallback((strokes, ovr) => {
    const seq = ++readSeqRef.current;
    const effectiveContext = inferredNotationContext(recognitionContext);
    let cloudAccepted = false;

    const publishLocal = (reading) => {
      if (seq !== readSeqRef.current || cloudAccepted) return;
      publish(reading, strokes);
    };

    // Cloud OCR is answer-blind and receives only a raster made from `strokes`.
    // It runs beside Pri Ink, not after it, so the local result can appear with
    // no network latency. Only a server-approved confident result is allowed to
    // supersede local recognition. If Terra/Sol remain uncertain, the existing
    // local correction/confirmation path stays visible instead.
    const manualCorrectionActive = Object.keys(ovr || {}).length > 0;
    if (!manualCorrectionActive && cloudInkConfigured()) {
      recognizeWithCloud(strokes).then(cloud => {
        if (seq !== readSeqRef.current || !cloud?.lines?.some(line => line.text)) return;
        if (cloud.needsConfirmation) return;
        cloudAccepted = true;
        publish(cloud, strokes);
      });
    }

    const readWithJS = () => {
      try { return recognizeWithoutDetachedSideWork(strokes, ovr, effectiveContext, recognize); }
      catch { return null; }
    };

    // Browser/dev: prefer the explicit Structural V4 LAN research bridge when
    // the server exposes it. Cloud OCR, when configured, may later supersede
    // this local preview; otherwise behaviour is unchanged.
    if (!NATIVE_INK) {
      recognizeWithStructuralDev(strokes).then(v4 => {
        if (seq !== readSeqRef.current || cloudAccepted) return;
        if (v4?.lines?.some(line => line.text)) {
          publishLocal(v4);
          return;
        }
        const local = readWithJS();
        if (seq !== readSeqRef.current || cloudAccepted) return;
        const engine = structuralLanExpected() ? 'pri-js-v3-v4-unavailable' : 'pri-js-v3';
        publishLocal(local ? { ...local, engine } : { ...EMPTY_READING, engine });
      });
      return;
    }

    // Native iPad: Foundation and JS remain independent local opinions. Cloud
    // OCR does not get inserted as a fake extra vote in this consensus system;
    // it has its own explicit authority gate above. That preserves the evidence
    // semantics of Pri Ink whenever cloud is unavailable or uncertain.
    nativeInk.foundationRecognize(ovr, effectiveContext).then(foundation => {
      if (seq !== readSeqRef.current || cloudAccepted) return;
      const localRaw = readWithJS();
      const local = localRaw ? { ...localRaw, engine: 'pri-js-v3' } : null;

      if (hasReading(foundation) && hasReading(local)
          && normalizedReadingText(foundation) === normalizedReadingText(local)) {
        const agreed = chooseNativeConsensus([foundation, local], effectiveContext);
        publishLocal(agreed || { ...EMPTY_READING, engine: 'pri-native-no-reading' });
        return;
      }

      nativeInk.recognize(ovr, effectiveContext).then(nativeRaw => {
        if (seq !== readSeqRef.current || cloudAccepted) return;
        const nativeReading = nativeRaw
          ? readUnreadLines(nativeRaw, strokes, ovr, effectiveContext)
          : null;
        const chosen = chooseNativeConsensus([foundation, local, nativeReading], effectiveContext);
        publishLocal(chosen || { ...EMPTY_READING, engine: 'pri-native-no-reading' });
      });
    });
  }, [publish, recognitionContext]);

  const onStrokesChange = useCallback((strokes) => {
    strokesRef.current = strokes;
    if (timerRef.current) clearTimeout(timerRef.current);
    // One cloud request is made only after the same quiet window used by native
    // whole-page recognition — never on every Pencil stroke.
    const quietMs = NATIVE_INK ? (strokes.length > 24 ? 1600 : 1000) : 240;
    timerRef.current = setTimeout(() => runRecognition(strokes, overrides), quietMs);
  }, [overrides, runRecognition]);

  useEffect(() => { ensurePersonalLoaded(); }, []);
  useEffect(() => () => {
    readSeqRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
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

  const cloudModel = String(rec.engine || '').replace(/^openai-gpt-5\.6-/, 'GPT-5.6 ');
  const engineNote = String(rec.engine || '').startsWith('openai-gpt-5.6-')
    ? `Cloud handwriting · OpenAI ${cloudModel.replace(/^GPT-5\.6 ([a-z])/, (_, c) => `GPT-5.6 ${c.toUpperCase()}`)}`
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
      {!NATIVE_INK && !cloudInkConfigured() && (
        <div role="note" style={{ padding: '9px 12px', marginBottom: 8, border: '1px solid var(--warn)', borderRadius: 10, fontSize: 12.5 }}>
          Browser handwriting = legacy JS fallback. Configure the optional cloud handwriting gateway or use the native iPad package for production-quality testing.
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
          </div>
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
