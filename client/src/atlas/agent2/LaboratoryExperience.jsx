import React, { useMemo, useState } from 'react';
import { classifySystem, clipLine, equationText, DEFAULT_LINES, LINE_PRESETS } from './lineMath.js';
import './atlas.css';

const WIDTH = 720;
const HEIGHT = 540;
const SCALE = 29;
const OX = WIDTH / 2;
const OY = HEIGHT / 2;
const BOUND = 8;
const px = x => OX + x * SCALE;
const py = y => OY - y * SCALE;
const NUMBER = new Intl.NumberFormat('en', { maximumFractionDigits: 3 });

const RESULT_TITLES = {
  unique: 'One unique intersection',
  parallel: 'Distinct parallel lines',
  coincident: 'Coincident lines',
  unconstrained: 'One equation imposes no constraint',
  'all-plane': 'Every point satisfies both equations',
  inconsistent: 'The system is inconsistent'
};
const examplePrompt = (a, b) => 'Consider the equations ' + equationText(a) + ' and ' + equationText(b) + '. Classify the pair as having a unique solution, no solution or infinitely many solutions. Justify your answer using the coefficients, and solve when possible.';
const fresh = () => [ { ...DEFAULT_LINES.first }, { ...DEFAULT_LINES.second } ];

function Coefficient({ row, axis, line, onChange }) {
  const value = line[axis];
  return <label className="pa2-control"><span>{axis.toUpperCase()}<small>{value}</small></span>
    <input aria-label={'Line ' + row + ' coefficient ' + axis} type="range" min="-6" max="6" step="1" value={value}
      onChange={event => onChange(axis, Number(event.target.value))} />
  </label>;
}

export default function LaboratoryExperience({ onOpenPaper = null, onBackToAtlas = null }) {
  const [lines, setLines] = useState(fresh);
  const [showQuestion, setShowQuestion] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const verdict = useMemo(() => classifySystem(lines[0], lines[1]), [lines]);
  const segments = lines.map(line => clipLine(line, BOUND));
  const change = (index, axis, value) => setLines(prev => prev.map((line, i) =>
    i === index ? { ...line, [axis]: value } : line));
  const preset = key => { setLines(LINE_PRESETS[key].map(line => ({ ...line }))); setShowQuestion(false); };
  const reset = () => { setLines(fresh()); setShowQuestion(false); };
  const prompt = examplePrompt(...lines);
  const openPaper = () => {
    if (onOpenPaper) {
      onOpenPaper({
        chapterId: 'c10-pair-linear-equations', conceptId: 'c10-pair-linear-equations',
        source: 'atlas-agent2-laboratory', question: { type: 'free-response', text: prompt, provenance: 'Pri Atlas prototype-authored; NOT an official CBSE past-paper question' }
      });
    } else setShowQuestion(true);
  };
  return <section className="pa2-experience pa2-laboratory" data-laboratory-agent2>
    <div className="pa2-overline">PRI ATLAS / 02 — MATHEMATICAL LABORATORY</div>
    <div className="pa2-titleline"><div><h1>When two lines meet</h1><p>Change the coefficients. See the geometry obey the algebra.</p></div>
      <div className="pa2-tag">Class 10 · Pair of linear equations</div></div>
    <div className="pa2-layout">
      <div className="pa2-pane">
        <div className="pa2-lab-preset" role="group" aria-label="Experiment examples">
          <button type="button" onClick={() => preset('unique')}>Intersecting</button>
          <button type="button" onClick={() => preset('parallel')}>Parallel</button>
          <button type="button" onClick={() => preset('coincident')}>Coincident</button>
          <button type="button" onClick={() => preset('degenerate')}>Degenerate</button>
          <button type="button" onClick={reset}>Reset ↺</button>
        </div>
        <div className="pa2-line-controls">
          {lines.map((line, i) => <fieldset className="pa2-line-card" key={i}>
            <legend><i className={'pa2-swatch is-line-' + i} /> Line {i + 1} <strong>{equationText(line)}</strong></legend>
            <div className="pa2-three-sliders">{['a', 'b', 'c'].map(axis => <Coefficient key={axis} row={i + 1} axis={axis}
              line={line} onChange={(key, value) => change(i, key, value)} />)}</div>
          </fieldset>)}
        </div>
        <svg viewBox={'0 0 ' + WIDTH + ' ' + HEIGHT} className="pa2-lab-plot" role="img"
          aria-label={'Cartesian plot of ' + equationText(lines[0]) + ' and ' + equationText(lines[1]) + '. ' + RESULT_TITLES[verdict.kind] + '. ' + verdict.description}>
          <title>Graph of two linear equations</title>
          <desc>Axes from negative eight to positive eight. {equationText(lines[0])}; {equationText(lines[1])}. {verdict.description}</desc>
          {Array.from({ length: 17 }, (_, i) => i - 8).map(v => <g key={v}>
            <line x1={px(v)} x2={px(v)} y1={py(-BOUND)} y2={py(BOUND)} stroke={v === 0 ? '#a9b3bf' : '#343b45'} strokeWidth={v === 0 ? 1.8 : 0.7} />
            <line x1={px(-BOUND)} x2={px(BOUND)} y1={py(v)} y2={py(v)} stroke={v === 0 ? '#a9b3bf' : '#343b45'} strokeWidth={v === 0 ? 1.8 : 0.7} />
            {(v % 2 === 0 && v !== 0) && <><text x={px(v)} y={py(0) + 19} textAnchor="middle" className="pa2-tick">{v}</text>
              <text x={px(0) - 13} y={py(v) + 5} textAnchor="end" className="pa2-tick">{v}</text></>}
          </g>)}
          <text x={px(8) + 14} y={py(0) + 5} className="pa2-axis">x</text><text x={px(0) + 12} y={py(8) - 9} className="pa2-axis">y</text>
          {segments.map((pair, index) => pair && <line key={index}
            x1={px(pair[0].x)} y1={py(pair[0].y)}
            x2={px(pair[1].x)} y2={py(pair[1].y)}
            stroke={index ? '#dea977' : '#90c5ee'} strokeWidth={index ? 3.4 : 4.2}
            strokeDasharray={index && verdict.kind === 'coincident' ? '10 7' : undefined}
            strokeLinecap="round" />)}
          {verdict.point && Math.abs(verdict.point.x) <= BOUND && Math.abs(verdict.point.y) <= BOUND && <g>
            <circle cx={px(verdict.point.x)} cy={py(verdict.point.y)} r="11" fill="#111821" stroke="#fcf2da" strokeWidth="2.8" />
            <circle cx={px(verdict.point.x)} cy={py(verdict.point.y)} r="3.5" fill="#fcf2da" />
            <text x={px(verdict.point.x) + 15} y={py(verdict.point.y) - 16} className="pa2-point-label">
              {'(' + NUMBER.format(verdict.point.x) + ', ' + NUMBER.format(verdict.point.y) + ')'}</text>
          </g>}
        </svg>
        <div className="pa2-plot-caption">Axes: −8 to +8. Lines are clipped to this viewing window. Exact algebra determines classification; drawing does not determine the answer.</div>
      </div>
      <aside className="pa2-inspector">
        <div className="pa2-overline">LIVE MATHEMATICAL RESULT</div><h2 aria-live="polite" data-result-kind={verdict.kind}>{RESULT_TITLES[verdict.kind]}</h2>
        <p aria-live="polite">{verdict.description}</p>
        {verdict.point && <div className="pa2-coordinate" aria-live="polite">x = {NUMBER.format(verdict.point.x)}
          <span>y = {NUMBER.format(verdict.point.y)}</span></div>}
        <div className="pa2-rule" />
        <button type="button" className="pa2-explanation-toggle" onClick={() => setShowExplanation(v => !v)}
          aria-expanded={showExplanation}>Why does this happen? {showExplanation ? '−' : '+'}</button>
        {showExplanation && <div className="pa2-explanation">
          <p>For two proper lines a₁x + b₁y = c₁ and a₂x + b₂y = c₂, compute:</p>
          <div className="pa2-determinant">Δ = a₁b₂ − a₂b₁ = {lines[0].a * lines[1].b - lines[1].a * lines[0].b}</div>
          <p>{verdict.kind === 'unique' ? 'A nonzero determinant means the coefficient directions are independent. Cramer’s rule gives one ordered pair.' :
            verdict.kind === 'parallel' ? 'Δ = 0, but the augmented equations are inconsistent: they are distinct parallel lines.' :
            verdict.kind === 'coincident' ? 'Both equations are proportional, including their constants: every point on either line satisfies both.' :
            verdict.kind === 'unconstrained' ? 'The equation 0 = 0 is true at every point, so the other line determines the solutions.' :
            verdict.kind === 'all-plane' ? 'Each equation reduces to 0 = 0, so the whole coordinate plane is the solution set.' :
            'At least one equation reduces to 0 = a nonzero constant; no ordered pair can satisfy it.'}</p>
          <p>Do not apply the usual determinant classification blindly when a = b = 0.</p>
        </div>}
        <div className="pa2-rule" /><h3>Take it to Paper</h3>
        <p>Use the current coefficients in a prototype-authored examination-style question. It is not an official past-paper item.</p>
        <button type="button" className="pa2-primary" onClick={openPaper}>Open practice question ↗</button>
        {showQuestion && <section className="pa2-question" aria-label="Prototype practice question">
          <h3>Practice · 3 marks (illustrative only)</h3><p>{prompt}</p>
          <small>Standalone preview. No response is stored or graded here.</small>
        </section>}
        {onBackToAtlas && <button type="button" className="pa2-secondary" onClick={onBackToAtlas}>← Back to Atlas</button>}
        <p className="pa2-fineprint">Demonstration runs locally, never reports a mark and never alters the learning engine.</p>
      </aside>
    </div>
  </section>;
}
