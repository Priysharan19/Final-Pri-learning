// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Write-to-answer surface
// Ink canvas + toolbar + live on-device recognition with per-symbol
// tap-to-correct. The recognised lines feed Step Check; the final line is
// submitted together with both confidence evidence and an explicit selective
// trust decision. A non-authoritative reading may be shown for correction, but
// callers can no longer mistake it for safe marking input.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import InkCanvas from './InkCanvas.jsx';
import NativeInkCanvas from './NativeInkCanvas.jsx';
import { nativeInk, nativeInkAvailable } from './native.js';
import { recognize, exprToLatex } from './recognizer.js';
import { ALPHABET } from './templates.js';
import { classOfSymbol } from './classes.js';
import { ensurePersonalLoaded, addPersonal } from './personal.js';
import { MathText } from '../lib/latex.jsx';

const NICE = { pi: 'π', theta: 'θ', sqrt: '√', percent: '%' };
const showSym = s => NICE[s] || s;

// ── Which surface, which engine ──────────────────────────────────────────────
// In the iPad app the ink is a PencilKit canvas and the reading comes from the
// on-device Vision handwriting model. Anywhere else — a browser, the dev
// server — it is the web canvas and the web engine. The decision is made once,
// at module load, and nothing below this line depends on the answer.
const NATIVE_INK = nativeInkAvailable();
const Surface = NATIVE_INK ? NativeInkCanvas : InkCanvas;

/**
 * Vision reads lines. A line too short to be text — a lone "x", a bare "3" —
 * can come back with nothing at all, and a step the student wrote must never
 * vanish because of it. Those lines, and only those, are read by the web
 * engine instead, on that line's own strokes.
 *
 * A secondary-engine rescue is useful evidence, but until that cross-engine
 * confidence is calibrated on writer-separated real ink it is NOT silently
 * auto-authoritative. The student sees it and can confirm/correct it.
 */
function readUnreadLines(reading, strokes, overrides) {
  let healed = false;
  const lines = reading.lines.map((line, li) => {
    if (!line.unread || !line.strokeIdxs?.length) return line;
    const own = line.strokeIdxs.map(i => strokes[i]).filter(Boolean);
    if (!own.length) return line;
    let fallback;
    try { fallback = recognize(own, overrides); } catch { return line; }
    const first = fallback.lines[0];
    if (!first || !first.text) return line;
    healed = true;
    return {
      ...line,
      text: first.text,
      box: first.box,
      // Ids are namespaced so a correction on a web-read line cannot collide
      // with one on a Vision-read line, and stroke indexes are mapped back to
      // the page so "learn from this correction" trains on the right ink.
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
  // The native confidence summary described the reading before the secondary
  // rescue. Drop it and mark the fused result non-authoritative until a future
  // calibrated ensemble has actually measured this path.
  return {
    lines,
    text: lines.map(l => l.text).join('\n'),
    decision: {
      status: 'review',
      autoAccept: false,
      policy: 'secondary-rescue-uncalibrated',
      reasons: ['native-unread-line-healed-by-secondary-engine'],
      focusSymbol: null
    },
    safeToAutoAccept: false
  };
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
      : weakest,
    decision: result.decision || null,
    safeToAutoAccept: result.safeToAutoAccept === true || result.decision?.autoAccept === true
  };
}

/**
 * lineVerdicts: optional array aligned with recognised lines, e.g.
 * [{status:'ok'}, {status:'break', note:'…'}] — drawn as a teacher-style
 * ✓/✗ overlay on the ink itself and as badges in the reading panel.
 * focusSymbol: id of a glyph the caller wants checked. Its picker opens on the
 * student's behalf with the first alternative focused, so a correction is one
 * tap rather than a hunt.
 */
export default function InkAnswer({ onRecognized, height = 300, disabled, lineVerdicts = null, focusSymbol = null }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [finger, setFinger] = useState(false);
  const [rec, setRec] = useState({ lines: [], text: '' });
  const [overrides, setOverrides] = useState({});
  const [picker, setPicker] = useState(null); // {id, alts}
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
      decision: sure.decision,
      safeToAutoAccept: sure.safeToAutoAccept,
      strokes
    });
  }, [onRecognized]);

  const runRecognition = useCallback((strokes, ovr) => {
    if (!NATIVE_INK) {
      // Browser recognition has no calibrated selective policy yet. Preserve
      // existing functionality, but never advertise it as auto-authoritative.
      const web = recognize(strokes, ovr);
      publish({
        ...web,
        decision: {
          status: 'review', autoAccept: false, policy: 'web-uncalibrated',
          reasons: ['web-recognizer-has-no-real-ink-calibration'], focusSymbol: web.weakest?.id ?? null
        },
        safeToAutoAccept: false
      }, strokes);
      return;
    }
    // The shell reads on its own thread, so replies can land out of order —
    // only the newest request is allowed to reach the panel.
    const seq = ++readSeqRef.current;
    nativeInk.recognize(ovr).then(reading => {
      if (seq !== readSeqRef.current) return;
      if (reading) {
        publish(readUnreadLines(reading, strokes, ovr), strokes);
      } else {
        const fallback = recognize(strokes, ovr);
        publish({
          ...fallback,
          decision: {
            status: 'review', autoAccept: false, policy: 'native-timeout-web-rescue',
            reasons: ['native-recognizer-unavailable'], focusSymbol: fallback.weakest?.id ?? null
          },
          safeToAutoAccept: false
        }, strokes);
      }
    });
  }, [publish]);

  const onStrokesChange = useCallback((strokes) => {
    strokesRef.current = strokes;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runRecognition(strokes, overrides), 240);
  }, [overrides, runRecognition]);

  useEffect(() => { ensurePersonalLoaded(); }, []);
  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const requestedFocus = focusSymbol || rec.decision?.focusSymbol || null;

  // Open on a newly-named glyph only. A trust-policy clarification uses the
  // same picker as teacher-requested focus, so ambiguity remains a one-tap fix.
  useEffect(() => {
    if (!requestedFocus) { focusedRef.current = null; return; }
    if (focusedRef.current === requestedFocus) return;
    const sym = rec.lines.flatMap(l => l.symbols || []).find(s => s.id === requestedFocus);
    if (!sym) return;
    focusedRef.current = requestedFocus;
    setPicker({ id: sym.id, alts: sym.alts || [] });
  }, [requestedFocus, rec]);

  useEffect(() => {
    if (picker && picker.id === requestedFocus) pickerRef.current?.querySelector('button')?.focus();
  }, [picker, requestedFocus]);

  const applyOverride = (id, sym) => {
    const next = { ...overrides, [id]: sym };
    setOverrides(next);
    setPicker(null);
    // Learn from the correction: this exact ink now belongs to that symbol.
    // Unless the reading could not tie the symbol to one mark exactly (`approx`)
    // — then the strokes under it are a fair guess, and training on a guess
    // teaches the engine the wrong shape.
    const symbol = rec.lines.flatMap(l => l.symbols).find(s => s.id === id);
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

  const needsCheck = rec.decision && rec.decision.autoAccept === false && rec.lines.length > 0;

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
                const b = line.box;
                return (
                  <React.Fragment key={li}>
                    <span className={`ink-linebox ${good ? 'good' : 'bad'}`}
                      style={{ left: b.x - 9, top: b.y - 7, width: b.w + 18, height: b.h + 14 }} />
                    <span className={`ink-verdict ${good ? 'good' : 'bad'}`}
                      style={{ top: b.y + b.h / 2 - 14, left: b.x + b.w + 16 }}
                      title={v.note || (good ? 'This line checks out' : 'The maths breaks on this line')}>
                      {good ? '✓' : '✗'}
                    </span>
                    {bad && <span className="ink-underline" style={{ left: b.x - 5, top: b.y + b.h + 5, width: b.w + 14 }} />}
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
          <div className="ink-preview-title" id="ink-reading">I'm reading:</div>
          {needsCheck && (
            <div role="status" aria-live="polite" style={{
              margin: '6px 0 10px', padding: '9px 11px', border: '1px solid var(--brand-1)', borderRadius: 6
            }}>
              <b>Check this reading before it is marked.</b>{' '}
              {rec.decision?.status === 'clarify'
                ? 'The handwriting evidence is genuinely ambiguous; the highlighted symbol needs confirmation.'
                : 'I do not have enough independent evidence to auto-accept this interpretation yet.'}
            </div>
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
                {line.symbols.map(s => (
                  <button
                    type="button"
                    key={s.id}
                    className={`ink-sym ${s.conf < 0.45 ? 'shaky' : ''}`}
                    style={s.id === requestedFocus
                      ? { outline: '2px solid var(--brand-1)', outlineOffset: 2, borderRadius: 4 }
                      : undefined}
                    title={s.id === requestedFocus ? 'Check this one' : 'Tap to correct'}
                    aria-label={`Line ${li + 1}, symbol read as “${showSym(s.sym)}”${s.conf < 0.45 ? ', a shaky reading' : ''} — change it`}
                    aria-expanded={picker?.id === s.id}
                    onClick={() => setPicker(picker?.id === s.id ? null : { id: s.id, alts: s.alts })}
                  >{showSym(s.sym)}</button>
                ))}
              </span>
            </div>
          ))}
          {picker && (
            <div className="ink-picker" ref={pickerRef} role="group" aria-label="Change this symbol">
              <div className="ink-picker-row">
                {picker.alts.map(a => (
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
