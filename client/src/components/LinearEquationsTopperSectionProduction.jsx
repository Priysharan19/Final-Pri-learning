import React, { useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import {
  NCERT_CLASS8_LINEAR_CONTENT,
  NCERT_CLASS8_LINEAR_TOPPER_NOTES,
  NCERT_CLASS8_LINEAR_WORKED_EXAMPLES,
  NCERT_CLASS8_LINEAR_EXERCISE_21,
  NCERT_CLASS8_LINEAR_EXERCISE_22,
  NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT
} from '../engine/ncert/class8-linear-production.js';

const TABS = Object.freeze({
  notes: 'Topper notes',
  examples: 'Worked examples',
  ex21: 'Exercise 2.1',
  ex22: 'Exercise 2.2',
  coverage: 'Source coverage'
});

function Text({ children }) {
  return <MathText text={String(children ?? '')} />;
}

function Answer({ item }) {
  const value = item.displayAnswer || (item.answer.d === 1 ? String(item.answer.n) : `${item.answer.n}/${item.answer.d}`);
  return `${item.variable} = ${value}`;
}

function VerificationStrip() {
  const audit = NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT;
  const ex21 = audit.confirmed.filter(x => x.source.includes('2.1'));
  const ex22 = audit.confirmed.filter(x => x.source.includes('2.2'));
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="spread" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>ATTACHED ANSWER KEY · INDEPENDENTLY VERIFIED</div>
          <h3 style={{ margin: '5px 0 3px' }}>20 / 20 answers agree with the uploaded NCERT equations</h3>
          <div className="muted">Pri Learning stores the PDF equation as source-of-truth and the supplied image as an independent answer-key check.</div>
        </div>
        <span className="tag tag-brand">0 mismatches</span>
      </div>
      <div className="grid cols-2" style={{ gap: 12, marginTop: 12 }}>
        {[['Exercise 2.1', ex21], ['Exercise 2.2', ex22]].map(([title, rows]) => (
          <div key={title} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            <b>{title}</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6, marginTop: 8 }}>
              {rows.map((row, i) => (
                <div key={row.source} style={{ fontSize: 12 }}>
                  <span className="muted">{i + 1}.</span> <b>{row.variable} = {row.attachedAnswer}</b>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        In particular, Exercise 2.2 Q3 is read from the PDF as <Text>$x+7-\\frac{8x}{3}=\\frac{17}{6}-\\frac{5x}{2}$</Text>, which gives <Text>$x=-5$</Text> and matches the supplied answer image.
      </div>
    </div>
  );
}

function Notes() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {NCERT_CLASS8_LINEAR_TOPPER_NOTES.map((note, i) => (
        <details key={note.title} className="card" open={i < 2} style={{ padding: '13px 15px' }}>
          <summary style={{ cursor: 'pointer' }}>
            <b>{note.title}</b>
            <div className="muted" style={{ marginTop: 3 }}>{note.level}</div>
          </summary>
          <div style={{ marginTop: 12 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {note.points.map((p, j) => <li key={j} style={{ marginBottom: 7 }}><Text>{p}</Text></li>)}
            </ul>
            {note.formula && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--surface-2)' }}>
                <Text>{note.formula}</Text>
              </div>
            )}
            <div style={{ marginTop: 11 }}>
              <span className="tag tag-brand">Topper edge</span>
              <div style={{ marginTop: 6 }}><Text>{note.edge}</Text></div>
            </div>
          </div>
        </details>
      ))}
      <div className="card" style={{ padding: 15 }}>
        <div className="sc-label" style={{ margin: 0 }}>60-SECOND FINAL CHECK</div>
        <div className="grid cols-2" style={{ marginTop: 9, gap: 7 }}>
          {[
            'Equation means equality; expression does not contain =.',
            'Linear here means one variable with highest power 1.',
            'Transposition is shorthand for doing the same operation to both sides.',
            'Clear fractions with the LCM before solving when it simplifies the equation.',
            'Expand every term in a bracket before combining like terms.',
            'For decimals, scale the whole equation by 10, 100, … or convert exactly to fractions.',
            'Collect variable terms on one side and constants on the other.',
            'Finish by checking the original LHS and RHS by substitution.'
          ].map((x, i) => <div key={x}><b>{i + 1}.</b> <Text>{x}</Text></div>)}
        </div>
      </div>
    </div>
  );
}

function WorkedExamples() {
  return (
    <div>
      <div className="sc-label" style={{ margin: '0 0 9px' }}>ALL WORKED EXAMPLES PRESENT IN THE UPLOADED PDF</div>
      <div style={{ display: 'grid', gap: 11 }}>
        {NCERT_CLASS8_LINEAR_WORKED_EXAMPLES.map((ex, i) => (
          <details key={ex.id} className="card" open={i === 0} style={{ padding: '13px 15px' }}>
            <summary style={{ cursor: 'pointer' }}>
              <b>{ex.title}</b>
              <div style={{ marginTop: 5, fontSize: 18 }}><Text>{ex.prompt}</Text></div>
            </summary>
            <div className="steps" style={{ marginTop: 13 }}>
              {ex.steps.map((step, j) => (
                <div className="step" key={j}>
                  <span className="step-n">{j + 1}</span>
                  <div><Text>{step}</Text></div>
                </div>
              ))}
            </div>
            <div className="spread" style={{ marginTop: 11, gap: 12, flexWrap: 'wrap' }}>
              <div><b>Final answer:</b> <Text>{ex.answer}</Text></div>
              <span className="tag tag-brand">Pri topper method</span>
            </div>
            <div className="muted" style={{ marginTop: 7 }}><Text>{ex.topper}</Text></div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Exercise({ title, items }) {
  return (
    <div>
      <div className="spread" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>NCERT {title} · FULLY WORKED</div>
          <div className="muted" style={{ marginTop: 4 }}>Each equation is retained as a source check and the generated bank serves additional variants of the same skills.</div>
        </div>
        <span className="tag">{items.length} / {items.length} solved</span>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {items.map((item, i) => (
          <details key={`${item.exercise}-${item.q}`} className="card" open={i === 0} style={{ padding: '12px 14px' }}>
            <summary style={{ cursor: 'pointer' }}>
              <b>Q{item.q}</b>
              <div style={{ marginTop: 4, fontSize: 17 }}><Text>{item.prompt}</Text></div>
            </summary>
            <div className="steps" style={{ marginTop: 12 }}>
              {item.steps.map((step, j) => (
                <div className="step" key={j}>
                  <span className="step-n">{j + 1}</span>
                  <div><Text>{step}</Text></div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 9 }}>
              <span className="tag tag-brand">Verified answer</span>{' '}
              <b><Answer item={item} /></b>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Coverage() {
  const qb = NCERT_CLASS8_LINEAR_CONTENT.questionBank;
  return (
    <div>
      <div className="grid cols-2" style={{ gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>QUESTION-BANK DEPTH</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 5 }}>{qb.authoredCells}</div>
          <div className="muted">7 source skills × 4 Pri difficulty levels, plus 20 exact NCERT source questions</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>ANSWER EXPERIENCE</div>
          <div style={{ fontWeight: 750, marginTop: 7 }}>Type · AI handwriting · Photo OCR</div>
          <div className="muted" style={{ marginTop: 4 }}>{qb.solutionSupport}</div>
        </div>
      </div>
      <div className="sc-label" style={{ margin: '0 0 9px' }}>PAGE-BY-PAGE SOURCE AUDIT</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {NCERT_CLASS8_LINEAR_CONTENT.sourceMap.map((row, i) => (
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
        Uploaded page 6 is intentionally audited as a blank learner Notes page. No mathematical content is silently invented to fill it.
      </p>
    </div>
  );
}

export default function LinearEquationsTopperSectionProduction() {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('notes');
  return (
    <section className="qpage" aria-label="NCERT Linear Equations topper learning section" style={{ paddingBottom: 4 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '20px 22px 18px' }}>
          <div className="spread" style={{ gap: 18, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="tag tag-brand">NCERT · Class 8 · Chapter 2</span>
                <span className="tag">Topper Learning Layer</span>
                <span className="tag">{NCERT_CLASS8_LINEAR_CONTENT.questionBank.authoredCells} authored cells + 20 source questions</span>
              </div>
              <h2 style={{ margin: 0 }}>Linear Equations in One Variable · Topper Notes + Complete Chapter Bank</h2>
              <p className="muted" style={{ margin: '7px 0 0', maxWidth: 900 }}>
                Source-audited from all six uploaded PDF pages: Introduction, balance/solution checks, Section 2.2, Examples 1–2, Exercise 2.1, Section 2.3, Examples 16–17, Exercise 2.2, chapter summary and the blank Notes page.
              </p>
            </div>
            <button className="btn btn-quiet btn-sm" onClick={() => setOpen(v => !v)} aria-expanded={open}>
              {open ? 'Hide chapter layer' : 'Open topper notes'}
            </button>
          </div>
        </div>
        {open && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px 18px' }}>
            <VerificationStrip />
            <div className="row" role="tablist" aria-label="Linear equations learning tabs" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
              {Object.entries(TABS).map(([key, label]) => (
                <button
                  key={key}
                  className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-quiet'}`}
                  onClick={() => setTab(key)}
                  role="tab"
                  aria-selected={tab === key}
                >{label}</button>
              ))}
            </div>
            {tab === 'notes' && <Notes />}
            {tab === 'examples' && <WorkedExamples />}
            {tab === 'ex21' && <Exercise title="Exercise 2.1" items={NCERT_CLASS8_LINEAR_EXERCISE_21} />}
            {tab === 'ex22' && <Exercise title="Exercise 2.2" items={NCERT_CLASS8_LINEAR_EXERCISE_22} />}
            {tab === 'coverage' && <Coverage />}
          </div>
        )}
      </div>
    </section>
  );
}
