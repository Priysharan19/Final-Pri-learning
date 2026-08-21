// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Write-to-answer surface
// Ink canvas + toolbar + live on-device recognition with per-symbol
// tap-to-correct. The recognised lines feed Step Check; the final line is
// submitted as the answer, together with how sure the engine is that it read
// that line right — see "How sure the reading is" below.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import InkCanvas from './InkCanvas.jsx';
import { recognize, exprToLatex } from './recognizer.js';
import { ALPHABET } from './templates.js';
import { classOfSymbol } from './classes.js';
import { ensurePersonalLoaded, addPersonal } from './personal.js';
import { MathText } from '../lib/latex.jsx';

const NICE = { pi: 'π', theta: 'θ', sqrt: '√', percent: '%' };
const showSym = s => NICE[s] || s;

// ── How sure the reading is ──────────────────────────────────────────────────
// The line a mark is awarded or withheld on travels with the engine's own
// account of how much of a guess it was — minConf, margin and the glyph
// responsible — so a caller can stop and ask before a wrong reading is marked.
// Two things are added on the way through: the id of the glyph the engine
// named, which is what the tap-to-correct picker opens on, and the runner-up
// worth showing beside it. A runner-up inside the glyph's own CNN class is the
// same ink under another name (1/l, 0/o) and is no use as a question, so it is
// skipped here exactly as the engine skips it when measuring the margin.
// Older builds returned none of this; the same three are then derived from the
// per-symbol confidences that have always been there, so a caller sees one
// shape either way.
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
  const strokesRef = useRef([]);
  const pickerRef = useRef(null);
  const focusedRef = useRef(null);

  const runRecognition = useCallback((strokes, ovr) => {
    const r = recognize(strokes, ovr);
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
      strokes
    });
  }, [onRecognized]);

  const onStrokesChange = useCallback((strokes) => {
    strokesRef.current = strokes;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runRecognition(strokes, overrides), 240);
  }, [overrides, runRecognition]);

  useEffect(() => { ensurePersonalLoaded(); }, []);
  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  // Open on a newly-named glyph only. Re-running on every recognition would
  // reopen the picker the moment a correction closed it.
  useEffect(() => {
    if (!focusSymbol) { focusedRef.current = null; return; }
    if (focusedRef.current === focusSymbol) return;
    const sym = rec.lines.flatMap(l => l.symbols).find(s => s.id === focusSymbol);
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
    // learn from the correction: this exact ink now belongs to that symbol
    const symbol = rec.lines.flatMap(l => l.symbols).find(s => s.id === id);
    if (symbol?.strokeIdxs?.length) {
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
        <span className="ink-hint">Write each step on its own line · Apple Pencil ready</span>
      </div>

      <div className="ink-stage">
        <InkCanvas
          ref={canvasRef}
          height={height + extraHeight}
          tool={tool}
          fingerMode={finger ? 'finger' : 'auto'}
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
                    {/* teacher-style box drawn around the whole step */}
                    <span
                      className={`ink-linebox ${good ? 'good' : 'bad'}`}
                      style={{ left: b.x - 9, top: b.y - 7, width: b.w + 18, height: b.h + 14 }}
                    />
                    <span
                      className={`ink-verdict ${good ? 'good' : 'bad'}`}
                      style={{ top: b.y + b.h / 2 - 14, left: b.x + b.w + 16 }}
                      title={v.note || (good ? 'This line checks out' : 'The maths breaks on this line')}
                    >{good ? '✓' : '✗'}</span>
                    {bad && (
                      <span className="ink-underline" style={{ left: b.x - 5, top: b.y + b.h + 5, width: b.w + 14 }} />
                    )}
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
                    style={s.id === focusSymbol
                      ? { outline: '2px solid var(--brand-1)', outlineOffset: 2, borderRadius: 4 }
                      : undefined}
                    title={s.id === focusSymbol ? 'Check this one' : 'Tap to correct'}
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
