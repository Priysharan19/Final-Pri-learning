import React from 'react';
import { validateLaboratoryHandoff } from './mathHandoff.js';
import './atlas.css';

// Synthetic-only Paper adapter for exact Laboratory coefficient continuity.
export default function LabPaperPreview({handoff, onBack}) {
  const data = validateLaboratoryHandoff(handoff);
  return <main className="pa2-experience pa2-lab-paper" data-lab-paper-synthetic>
    <div className="pa2-overline">PRI ATLAS / PAPER — SYNTHETIC EXPERIMENT</div>
    <h1>From your experiment</h1>
    <p className="pa2-demo" role="note">SYNTHETIC ONLY — NOT AN OFFICIAL EXAM QUESTION; NOTHING IS GRADED OR SENT.</p>
    <section className="pa2-paper-sheet" aria-labelledby="pa2-paper-heading">
      <div className="pa2-overline">YOUR EXACT COEFFICIENTS</div>
      <h2 id="pa2-paper-heading">Question</h2>
      <p>{data.question.text}</p>
      <div className="pa2-rule" />
      <h2>Deterministic worked explanation</h2>
      <ol>{data.workedExplanation.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
      <p><strong>{data.workedExplanation.conclusion}</strong></p>
      <p className="pa2-fineprint">{data.question.provenance}. This worked example does not judge student work or award marks.</p>
    </section>
    {onBack && <button type="button" className="pa2-return" onClick={onBack}>← Return to Laboratory</button>}
  </main>;
}
