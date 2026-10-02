// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Handwriting calibration
// A two-minute guided flow: write each symbol once in your own hand and the
// recogniser stores it as a personal template that outranks the stock shapes.
// Corrections made while practising keep teaching it forever after.
//
// In the native iPad app calibration uses the SAME PencilKit surface as real
// answers. That matters: a personal template should be learned from the input
// path it is intended to help, not from a parallel browser-only canvas.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useState } from 'react';
import InkCanvas from './InkCanvas.jsx';
import NativeInkCanvas from './NativeInkCanvas.jsx';
import { nativeInkAvailable } from './native.js';
import { addPersonal, personalStats, clearPersonal, ensurePersonalLoaded } from './personal.js';
import { useT } from '../i18n/index.js';

const PROMPTS = [
  ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'],
  ['5', '5'], ['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'],
  ['x', 'x'], ['y', 'y'], ['+', '+'], ['-', '−'], ['=', '='],
  ['(', '('], [')', ')'], ['/', '/'], ['.', null], ['sqrt', '√'],
  ['pi', 'π'], ['theta', 'θ'], ['<', '<'], ['>', '>'],
  ['s', 's'], ['i', 'i'], ['n', 'n'], ['c', 'c'], ['o', 'o'],
  ['t', 't'], ['a', 'a'], ['e', 'e'], ['l', 'l'], ['g', 'g'],
];
// A null label is a symbol that needs words to name it; those come from the
// catalogue so they follow the interface language.
const WORDED = { '.': 'calibrate.decimalPoint' };

export default function Calibrate({ onDone, toast }) {
  const [Surface] = useState(() => (nativeInkAvailable() ? NativeInkCanvas : InkCanvas));
  const canvasRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [saved, setSaved] = useState(0);
  const [finished, setFinished] = useState(false);
  const t = useT();
  ensurePersonalLoaded();

  const [sym, glyph] = PROMPTS[Math.min(idx, PROMPTS.length - 1)];
  const label = glyph ?? t(WORDED[sym]);

  const advance = () => {
    canvasRef.current?.clear();
    if (idx + 1 >= PROMPTS.length) setFinished(true);
    else setIdx(idx + 1);
  };

  const save = async () => {
    const strokes = canvasRef.current?.getStrokes() || [];
    if (!strokes.length) { advance(); return; }
    await addPersonal(sym, strokes, 'calibration');
    setSaved(s => s + 1);
    advance();
  };

  if (finished) {
    const stats = personalStats();
    return (
      <div className="card" style={{ textAlign: 'center', padding: 28 }}>
        <h3>{t('calibrate.doneTitle')}</h3>
        <p className="sub" style={{ margin: '10px auto 16px', maxWidth: 420 }}>
          {t('calibrate.doneSummary', {
            saved: t('calibrate.samplesSaved', { count: saved, n: saved }),
            total: t('calibrate.templatesTotal', { count: stats.total, n: stats.total })
          })}
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onDone}>{t('calibrate.done')}</button>
          <button className="btn btn-ghost" onClick={() => { setIdx(0); setFinished(false); }}>{t('calibrate.anotherRound')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="card-head">
        <span className="sc-label" style={{ margin: 0 }}>{t('calibrate.title')}</span>
        <span style={{ flex: 1 }} />
        <span className="muted">{idx + 1} / {PROMPTS.length}</span>
      </div>
      <div style={{ padding: '16px 18px 6px', textAlign: 'center' }} role="status">
        <div className="muted" style={{ fontSize: 13 }}>{t('calibrate.instruction')}</div>
        <div style={{ fontSize: 54, lineHeight: 1.3, fontFamily: 'var(--font)' }}>
          {label}<span className="sr-only">{' '}{t('calibrate.symbolOf', { n: idx + 1, total: PROMPTS.length })}</span>
        </div>
      </div>
      <Surface
        ref={canvasRef}
        height={190}
        guides={false}
        tool="pen"
        fingerMode="auto"
        ariaLabel={t('calibrate.writeAria', { symbol: label })}
      />
      <div className="row" style={{ padding: '10px 14px', borderTop: '1px solid var(--hairline)' }}>
        <button className="btn btn-quiet btn-sm" onClick={() => canvasRef.current?.clear()}>{t('ink.clear')}</button>
        <button className="btn btn-quiet btn-sm" onClick={advance}>{t('calibrate.skip')}</button>
        <span className="sr-only" role="status">{t('calibrate.savedSoFar', { count: saved, n: saved })}</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-quiet btn-sm" onClick={onDone}>{t('calibrate.stop')}</button>
        <button className="btn btn-primary btn-sm" onClick={save}>{t('calibrate.saveNext')}</button>
      </div>
    </div>
  );
}

export { personalStats, clearPersonal };
