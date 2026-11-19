// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the answer form for a graph-sketch question
//
// The student states the features of the graph in labelled fields: the
// x-intercepts as a list, the y-intercept, and each turning point with its type.
// A live preview plots exactly those points on axes and nothing else: it never
// draws the true curve and never shows a feature the student has not entered.
//
// The form writes the feature-set JSON the marker reads (sketchAnswerModel.js)
// into the card's ordinary answer, so drafts, recovery and the one submit path
// work as they do for any typed answer. It marks nothing. Once the server has
// resolved the question (`result` is set), the form is read-only and shows the
// true curve with the student's points over it and the marker's verdict on each
// feature; the true features are derived by the same engine the marker uses.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/index.js';
import Icon from './Icon.jsx';
import { deriveFeatures } from '../engine/graphFeatures.js';
import { compileFunction, curvePaths, projector, ticksFor } from '../engine/plot.js';
import {
  MAX_TURNING_ROWS, askedFeatures, buildFeatureSet, emptyRow, fieldsFromAnswer, pointsOfFeatures, pointsOfSet,
  resultRows, sketchAnswerText, windowFor
} from './sketchAnswerModel.js';
import './SketchAnswer.css';

const BOX = { width: 360, height: 250, pad: { left: 38, right: 14, top: 14, bottom: 26 } };
const minus = v => String(Math.round(v * 100) / 100).replace('-', '−');
const pointLabel = p => `(${minus(p.x)}, ${minus(p.y)})`;

/** The axes, and whatever is drawn on them. `curve` is a compiled function, drawn only in the marked view. */
function Axes({ win, points = [], rings = [], curve = null, label, describedBy }) {
  const project = useMemo(() => projector(win, BOX), [win]);
  const xTicks = useMemo(() => ticksFor(win.xMin, win.xMax, 7), [win]);
  const yTicks = useMemo(() => ticksFor(win.yMin, win.yMax, 6), [win]);
  const paths = useMemo(() => (curve ? curvePaths(curve, win, project).paths : []), [curve, win, project]);
  const x0 = project.x(0), y0 = project.y(0);
  const left = BOX.pad.left, right = BOX.width - BOX.pad.right, top = BOX.pad.top, bottom = BOX.height - BOX.pad.bottom;
  return (
    <svg className="sk-plot" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={label} aria-describedby={describedBy} focusable="false">
      <g className="sk-grid">
        {xTicks.map(t => <line key={`gx${t}`} x1={project.x(t)} y1={top} x2={project.x(t)} y2={bottom} />)}
        {yTicks.map(t => <line key={`gy${t}`} x1={left} y1={project.y(t)} x2={right} y2={project.y(t)} />)}
      </g>
      <g className="sk-axes">
        <line x1={left} y1={y0} x2={right} y2={y0} />
        <line x1={x0} y1={top} x2={x0} y2={bottom} />
      </g>
      <g className="sk-ticks" aria-hidden="true">
        {xTicks.filter(t => t !== 0).map(t => <text key={`tx${t}`} x={project.x(t)} y={Math.min(bottom + 14, y0 + 14)} textAnchor="middle">{minus(t)}</text>)}
        {yTicks.filter(t => t !== 0).map(t => <text key={`ty${t}`} x={Math.max(left - 5, x0 - 6)} y={project.y(t) + 4} textAnchor="end">{minus(t)}</text>)}
      </g>
      {paths.map((p, i) => <path key={i} className="sk-curve" d={p.d} />)}
      <g className="sk-rings">
        {rings.map((p, i) => <circle key={i} cx={project.x(p.x)} cy={project.y(p.y)} r="6.5" />)}
      </g>
      <g className="sk-points">
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={project.x(p.x)} cy={project.y(p.y)} r="3.8" />
            <text x={project.x(p.x) + 8} y={project.y(p.y) - 7}>{pointLabel(p)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

const DETAIL_KEY = {
  missing: 'sketch.detail.missing', extra: 'sketch.detail.extra', misplaced: 'sketch.detail.misplaced',
  'wrong-kind': 'sketch.detail.wrongKind', wrong: 'sketch.detail.wrong', unreadable: 'sketch.detail.unreadable'
};
const FEATURE_KEY = { xIntercepts: 'sketch.xIntercepts', yIntercept: 'sketch.yIntercept', turning: 'sketch.turning' };

/** The true features of the asked kinds, written the way the form asks for them. */
function featureLines(features, ask, t) {
  const out = {};
  const wanted = askedFeatures(ask);
  if (wanted.includes('xIntercepts')) out.xIntercepts = features.intercepts.x.length ? features.intercepts.x.map(minus).join(', ') : t('sketch.noneWord');
  if (wanted.includes('yIntercept')) out.yIntercept = features.intercepts.y === null ? t('sketch.noneWord') : minus(features.intercepts.y);
  if (wanted.includes('turning')) {
    out.turning = features.turning.length
      ? features.turning.map(p => t('sketch.turningLine', { kind: t(p.kind === 'max' ? 'sketch.maximum' : 'sketch.minimum'), point: pointLabel(p) })).join('; ')
      : t('sketch.noneWord');
  }
  return out;
}

function MarkedView({ question, sketch, answer }) {
  const t = useT();
  const ask = question.sketchAsk;
  const uid = useId();
  const model = useMemo(() => {
    let features = null;
    try { features = deriveFeatures(sketch.spec); } catch { features = null; }
    if (!features) return null;
    let given = null;
    try { given = JSON.parse(String(answer || '')); } catch { given = null; }
    const truth = pointsOfFeatures(features, ask);
    const yours = pointsOfSet(given);
    const win = windowFor([...truth, ...yours]);
    return { features, truth, yours, win, curve: compileFunction(sketch.spec.expression, sketch.spec.variable || 'x'), lines: featureLines(features, ask, t) };
  }, [sketch, answer, ask, t]);
  const rows = resultRows(sketch, ask);
  if (!model) return null;
  const marked = rows.some(r => r.verdict);
  const right = rows.filter(r => r.verdict === 'ok').length;
  return (
    <div className="sk-marked" data-sketch-result>
      <div className="sc-label sk-subhead">{t(marked ? 'sketch.result.title' : 'sketch.result.truthTitle')}</div>
      {marked && <p className="sk-summary" data-sketch-summary>{t('sketch.result.summary', { right, total: rows.length })}</p>}
      <figure className="sk-figure">
        <Axes win={model.win} points={model.truth} rings={marked ? model.yours : []} curve={model.curve} label={t('sketch.result.plotLabel')} describedBy={`${uid}-legend`} />
        <figcaption id={`${uid}-legend`} className="sk-legend">
          <span className="sk-key sk-key-curve" aria-hidden="true" />{t('sketch.legend.curve')}
          <span className="sk-key sk-key-true" aria-hidden="true" />{t('sketch.legend.true')}
          {marked && <><span className="sk-key sk-key-yours" aria-hidden="true" />{t('sketch.legend.yours')}</>}
        </figcaption>
      </figure>
      <ul className="sk-rows">
        {askedFeatures(ask).map(feature => {
          const row = rows.find(r => r.feature === feature);
          const good = row?.verdict === 'ok';
          return (
            <li key={feature} className={`sk-row ${good ? 'is-ok' : row?.verdict ? 'is-off' : ''}`} data-sketch-feature={feature} data-verdict={row?.verdict || 'shown'}>
              <span className="sk-row-mark" aria-hidden="true">{row?.verdict ? <Icon name={good ? 'check' : 'correction'} size={15} /> : null}</span>
              <span className="sk-row-body">
                <b>{t(FEATURE_KEY[feature])}</b>
                {row?.verdict && <span className="sk-row-state"> {t(good ? 'sketch.result.ok' : row.verdict === 'needs-review' ? 'sketch.result.review' : row.verdict === 'missing' ? 'sketch.result.missing' : DETAIL_KEY[row.detail] || 'sketch.detail.wrong')}</span>}
                <span className="sk-row-value">{good ? model.lines[feature] : t('sketch.result.should', { value: model.lines[feature] })}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function SketchAnswer({ question, value, onChange, onSubmit, disabled = false, result = null, inputRef = null }) {
  const t = useT();
  const uid = useId();
  const ask = useMemo(() => askedFeatures(question.sketchAsk), [question.sketchAsk]);
  const [fields, setFields] = useState(() => fieldsFromAnswer(value));
  // The last text this form wrote: a different `value` came from outside (a restored draft, a cleared card).
  const written = useRef(value);
  useEffect(() => {
    if (value !== written.current) { written.current = value; setFields(fieldsFromAnswer(value)); }
  }, [value]);

  const update = next => {
    setFields(next);
    const text = sketchAnswerText(next, ask);
    written.current = text;
    onChange(text);
  };
  const { set, errors } = useMemo(() => buildFeatureSet(fields, ask), [fields, ask]);
  const points = useMemo(() => pointsOfSet(set), [set]);
  const win = useMemo(() => windowFor(points), [points]);
  const enter = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); onSubmit?.(); } };

  const setRow = (i, patch) => update({ ...fields, noTurning: false, turning: fields.turning.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addRow = () => update({ ...fields, noTurning: false, turning: [...fields.turning, emptyRow()].slice(0, MAX_TURNING_ROWS) });
  const dropRow = i => update({ ...fields, turning: fields.turning.length > 1 ? fields.turning.filter((_, j) => j !== i) : [emptyRow()] });
  const errId = k => `${uid}-err-${k}`;
  const summary = points.length ? points.map(pointLabel).join('; ') : t('sketch.preview.empty');

  return (
    <div className="sk" data-sketch-answer onKeyDown={enter}>
      {!disabled && <p className="sk-lede muted">{t('sketch.lede')}</p>}
      <div className="sk-form">
        {ask.includes('xIntercepts') && (
          <div className="sk-field">
            <label className="sc-label" htmlFor={`${uid}-xs`}>{t('sketch.xIntercepts')}</label>
            <input id={`${uid}-xs`} ref={inputRef} className="answer-input" data-sketch-xs inputMode="text" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={fields.xs} disabled={disabled} placeholder={t('sketch.xIntercepts.placeholder')}
              aria-describedby={`${uid}-xs-help${errors.xIntercepts ? ` ${errId('x')}` : ''}`} aria-invalid={errors.xIntercepts ? 'true' : undefined}
              onChange={e => update({ ...fields, xs: e.target.value })} />
            <div id={`${uid}-xs-help`} className="sk-help muted">{t('sketch.xIntercepts.help')}</div>
            {errors.xIntercepts && <div id={errId('x')} className="sk-error" role="alert">{t('sketch.error.list')}</div>}
          </div>
        )}
        {ask.includes('yIntercept') && (
          <div className="sk-field">
            <label className="sc-label" htmlFor={`${uid}-y`}>{t('sketch.yIntercept')}</label>
            <input id={`${uid}-y`} className="answer-input" data-sketch-y inputMode="text" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={fields.y} disabled={disabled} placeholder={t('sketch.yIntercept.placeholder')}
              aria-describedby={`${uid}-y-help${errors.yIntercept ? ` ${errId('y')}` : ''}`} aria-invalid={errors.yIntercept ? 'true' : undefined}
              onChange={e => update({ ...fields, y: e.target.value })} />
            <div id={`${uid}-y-help`} className="sk-help muted">{t('sketch.yIntercept.help')}</div>
            {errors.yIntercept && <div id={errId('y')} className="sk-error" role="alert">{t('sketch.error.number')}</div>}
          </div>
        )}
        {ask.includes('turning') && (
          <fieldset className="sk-field sk-turning" disabled={disabled}>
            <legend className="sc-label">{t('sketch.turning')}</legend>
            <div className="sk-help muted" id={`${uid}-tp-help`}>{t('sketch.turning.help')}</div>
            {!fields.noTurning && fields.turning.map((r, i) => (
              <div className="sk-tp" key={i} role="group" aria-label={t('sketch.turning.row', { n: i + 1 })}>
                <span className="sk-tp-n" aria-hidden="true">{i + 1}</span>
                <label className="sk-tp-f"><span>{'x'}</span>
                  <input className="answer-input" data-sketch-tx inputMode="text" autoComplete="off" spellCheck={false} value={r.x} onChange={e => setRow(i, { x: e.target.value })} aria-describedby={`${uid}-tp-help`} />
                </label>
                <label className="sk-tp-f"><span>{'y'}</span>
                  <input className="answer-input" data-sketch-ty inputMode="text" autoComplete="off" spellCheck={false} value={r.y} onChange={e => setRow(i, { y: e.target.value })} aria-describedby={`${uid}-tp-help`} />
                </label>
                <label className="sk-tp-f sk-tp-kind"><span>{t('sketch.turning.kind')}</span>
                  <select className="input" data-sketch-tk value={r.kind} onChange={e => setRow(i, { kind: e.target.value })}>
                    <option value="">{t('sketch.turning.choose')}</option>
                    <option value="max">{t('sketch.maximum')}</option>
                    <option value="min">{t('sketch.minimum')}</option>
                  </select>
                </label>
                {!disabled && fields.turning.length > 1 && (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => dropRow(i)} aria-label={t('sketch.turning.remove', { n: i + 1 })}>{t('sketch.turning.removeShort')}</button>
                )}
              </div>
            ))}
            {!disabled && !fields.noTurning && fields.turning.length < MAX_TURNING_ROWS && (
              <button type="button" className="btn btn-ghost btn-sm sk-add" onClick={addRow}>{t('sketch.turning.add')}</button>
            )}
            <label className="sk-none">
              <input type="checkbox" checked={fields.noTurning} onChange={e => update({ ...fields, noTurning: e.target.checked })} />
              <span>{t('sketch.turning.none')}</span>
            </label>
            {errors.turning && <div className="sk-error" role="alert">{t('sketch.error.row')}</div>}
          </fieldset>
        )}
      </div>

      {!result && (
        <figure className="sk-figure sk-preview" data-sketch-preview>
          <div className="sc-label sk-subhead">{t('sketch.preview.title')}</div>
          <Axes win={win} points={points} label={t('sketch.preview.label')} describedBy={`${uid}-sum`} />
          <figcaption id={`${uid}-sum`} className="sk-legend muted">
            <span>{t('sketch.preview.note')}</span>
            <span className="sk-sum" aria-live="polite">{summary}</span>
          </figcaption>
        </figure>
      )}
      {result && <MarkedView question={question} sketch={result} answer={value} />}
    </div>
  );
}
