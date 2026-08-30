import React, { useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import {
  NCERT_CLASS8_RATIONAL_CONTENT,
  NCERT_CLASS8_RATIONAL_TOPPER_NOTES,
  NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES,
  NCERT_CLASS8_RATIONAL_SOURCE_CHECKS
} from '../engine/ncert/class8-rational-numbers.js';

const TAB = {
  notes: 'Topper notes',
  examples: 'Worked examples',
  checks: 'NCERT checks',
  coverage: 'Source coverage'
};

function Text({ children }) {
  return <MathText text={String(children ?? '')} />;
}

function PropertyTable({ rows }) {
  if (!rows?.length) return null;
  const [head, ...body] = rows;
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table className="criteria-table" style={{ minWidth: 760 }}>
        <thead><tr>{head.map((cell, i) => <th key={i}>{cell}</th>)}</tr></thead>
        <tbody>{body.map((row, r) => (
          <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function RationalNumbersTopperSection() {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('notes');
  const meta = NCERT_CLASS8_RATIONAL_CONTENT.source;

  return (
    <section className="qpage" aria-label="NCERT Rational Numbers topper learning section" style={{ paddingBottom: 4 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '20px 22px 18px' }}>
          <div className="spread" style={{ gap: 18, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="tag tag-brand">NCERT · Class 8 · Chapter 1</span>
                <span className="tag">Topper Learning Layer</span>
                <span className="tag">{NCERT_CLASS8_RATIONAL_CONTENT.questionBank.authoredCells} authored question cells</span>
              </div>
              <h2 style={{ margin: 0 }}>Rational Numbers · Topper Notes + Complete Chapter Bank</h2>
              <p className="muted" style={{ margin: '7px 0 0', maxWidth: 900 }}>
                Built from {meta.title}, {meta.edition}. The source chapter, its property tables, Try These,
                Examples 1–3, Exercise 1.1 and the final density result are mapped below and connected to
                Pri Learning practice.
              </p>
            </div>
            <button className="btn btn-quiet btn-sm" onClick={() => setOpen(v => !v)} aria-expanded={open}>
              {open ? 'Hide notes' : 'Open topper notes'}
            </button>
          </div>

          <div className="card" style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-2, var(--card))' }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ fontSize: 20 }}>✍️</span>
              <div>
                <b>AI handwriting is live for the calculation bank.</b>
                <div className="muted" style={{ marginTop: 3 }}>
                  Choose <b>Write</b> on a generated numeric question. Pri’s handwriting pipeline reads fractions,
                  negative signs and multi-line working, confidence-checks uncertain recognition before marking,
                  and then shows the same fully worked solution used by the answer engine.
                </div>
              </div>
            </div>
          </div>
        </div>

        {open && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '0 22px 22px' }}>
            <div className="row" role="tablist" aria-label="Rational Numbers learning views"
              style={{ gap: 8, flexWrap: 'wrap', padding: '14px 0 16px' }}>
              {Object.entries(TAB).map(([key, label]) => (
                <button key={key} role="tab" aria-selected={tab === key}
                  className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-quiet'}`}
                  onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>

            {tab === 'notes' && <TopperNotes />}
            {tab === 'examples' && <WorkedExamples />}
            {tab === 'checks' && <SourceChecks />}
            {tab === 'coverage' && <Coverage />}
          </div>
        )}
      </div>
    </section>
  );
}

function TopperNotes() {
  return (
    <div>
      <div className="spread" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>TOPPER-ONLY NOTES</div>
          <div className="muted" style={{ marginTop: 4 }}>Definition precision, proof ideas, counterexamples and fast calculation structure.</div>
        </div>
        <span className="tag tag-brand">Exam traps included</span>
      </div>

      <div className="grid cols-2" style={{ gap: 12 }}>
        {NCERT_CLASS8_RATIONAL_TOPPER_NOTES.map((note, i) => (
          <details className="card" key={note.title} open={i < 2} style={{ padding: '14px 16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 750 }}>
              {note.title}
              <span className="tag" style={{ marginLeft: 8 }}>{note.level}</span>
            </summary>
            <div style={{ marginTop: 12 }}>
              {note.points?.map((point, j) => (
                <div key={j} className="row" style={{ alignItems: 'flex-start', gap: 9, marginBottom: 8 }}>
                  <span aria-hidden="true" className="muted">•</span>
                  <div><Text>{point}</Text></div>
                </div>
              ))}
              {note.formula && (
                <div className="card" style={{ padding: '10px 12px', marginTop: 10 }}>
                  <b>Proof skeleton</b><div style={{ marginTop: 5 }}><Text>{note.formula}</Text></div>
                </div>
              )}
              <PropertyTable rows={note.table} />
              <div style={{ marginTop: 12 }}>
                <span className="tag tag-brand">Topper edge</span>
                <div style={{ marginTop: 6 }}><Text>{note.edge}</Text></div>
              </div>
            </div>
          </details>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <div className="sc-label" style={{ margin: 0 }}>60-second final check</div>
        <div className="grid cols-2" style={{ marginTop: 10, gap: 8 }}>
          {[
            'Denominator can never be 0.',
            'For rationals: +, − and × are closed; ÷ needs a non-zero divisor.',
            '+ and × are commutative and associative; − and ÷ are neither.',
            '0 is additive identity; 1 is multiplicative identity.',
            'Additive inverse changes sign; multiplicative inverse reciprocates a non-zero number.',
            '$a(b+c)=ab+ac$ and $a(b-c)=ab-ac$.',
            'Cancel factors, not terms separated by + or −.',
            'Between two different rationals lie infinitely many rationals.'
          ].map((x, i) => <div key={i}><b>{i + 1}.</b> <Text>{x}</Text></div>)}
        </div>
      </div>
    </div>
  );
}

function WorkedExamples() {
  return (
    <div>
      <div className="sc-label" style={{ margin: '0 0 10px' }}>NCERT WORKED EXAMPLES · FULL PRI-LEVEL SOLUTIONS</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES.map((ex, i) => (
          <details className="card" key={ex.id} open={i === 0} style={{ padding: '14px 16px' }}>
            <summary style={{ cursor: 'pointer' }}>
              <b>{ex.title}</b>
              <div style={{ marginTop: 5, fontSize: 18 }}><Text>{ex.prompt}</Text></div>
            </summary>
            <div className="steps" style={{ marginTop: 14 }}>
              {ex.steps.map((step, j) => (
                <div className="step" key={j}>
                  <span className="step-n">{j + 1}</span>
                  <div><Text>{step}</Text></div>
                </div>
              ))}
            </div>
            <div className="spread" style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
              <div><b>Final answer:</b> <Text>{ex.answer}</Text></div>
              <span className="tag tag-brand">Topper method</span>
            </div>
            <div className="muted" style={{ marginTop: 7 }}><Text>{ex.topper}</Text></div>
          </details>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <b>How Pri marks the same ideas</b>
        <div className="muted" style={{ marginTop: 6 }}>
          The generated bank contains four levels for each chapter skill. Numeric forms are handwriting-ready;
          conceptual property questions use MCQ where handwriting recognition would add friction rather than mathematical value.
          Every form carries progressive hints, misconception-specific feedback and a complete step sequence revealed after marking.
        </div>
      </div>
    </div>
  );
}

function SourceChecks() {
  return (
    <div>
      <div className="spread" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>TRY THESE + EXERCISE 1.1 · SOLVED</div>
          <div className="muted" style={{ marginTop: 4 }}>Use these as a chapter audit after doing generated practice.</div>
        </div>
        <span className="tag">{NCERT_CLASS8_RATIONAL_SOURCE_CHECKS.length} source checks</span>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {NCERT_CLASS8_RATIONAL_SOURCE_CHECKS.map((item, i) => (
          <details className="card" key={`${item.title}-${i}`} style={{ padding: '12px 14px' }}>
            <summary style={{ cursor: 'pointer' }}>
              <b>{item.title}</b>
              <div style={{ marginTop: 4 }}><Text>{item.prompt}</Text></div>
            </summary>
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span className="tag tag-brand">Worked answer</span>
              <div style={{ marginTop: 7 }}><Text>{item.solution}</Text></div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Coverage() {
  const qb = NCERT_CLASS8_RATIONAL_CONTENT.questionBank;
  return (
    <div>
      <div className="grid cols-2" style={{ gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>Question-bank contract</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{qb.authoredCells}</div>
          <div className="muted">8 exact skill generators × 4 Pri difficulty levels</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>Answer experience</div>
          <div style={{ fontWeight: 750, marginTop: 8 }}>Type · AI handwriting · Photo OCR</div>
          <div className="muted" style={{ marginTop: 4 }}>{qb.solutionSupport}</div>
        </div>
      </div>

      <div className="sc-label" style={{ margin: '0 0 10px' }}>PAGE-BY-PAGE SOURCE AUDIT</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {NCERT_CLASS8_RATIONAL_CONTENT.sourceMap.map((row, i) => (
          <div className="card" key={i} style={{ padding: '11px 13px' }}>
            <div className="spread" style={{ gap: 12, alignItems: 'flex-start' }}>
              <div>
                <b>{row.section}</b>
                <div className="muted" style={{ marginTop: 4 }}>{row.coverage}</div>
              </div>
              <span className="tag">p. {row.pages}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        Page 14 is intentionally listed: it is the blank NCERT notes page, so the audit can distinguish “no mathematical content” from “content missed”.
      </p>
    </div>
  );
}
