import React, { useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT, useTx } from '../i18n/index.js';
import {
  NCERT_CLASS8_RATIONAL_CONTENT,
  NCERT_CLASS8_RATIONAL_TOPPER_NOTES,
  NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES,
  NCERT_CLASS8_RATIONAL_SOURCE_CHECKS
} from '../engine/ncert/class8-rational-numbers.js';

// Tab ids with the catalogue keys for their labels.
const TAB = {
  notes: 'ncert.topperNotes',
  examples: 'ncert.workedExamples',
  checks: 'ncert.ncertChecks',
  coverage: 'ncert.sourceCoverage'
};

// i18n-exempt-start: the 60-second final check is a list of rational-number facts — maths content that stays English by design
const FINAL_CHECK = [
  'Denominator can never be 0.',
  'For rationals: +, − and × are closed; ÷ needs a non-zero divisor.',
  '+ and × are commutative and associative; − and ÷ are neither.',
  '0 is additive identity; 1 is multiplicative identity.',
  'Additive inverse changes sign; multiplicative inverse reciprocates a non-zero number.',
  '$a(b+c)=ab+ac$ and $a(b-c)=ab-ac$.',
  'Cancel factors, not terms separated by + or −.',
  'Between two different rationals lie infinitely many rationals.'
];
// i18n-exempt-end

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
  const t = useT();
  const tx = useTx();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('notes');
  const meta = NCERT_CLASS8_RATIONAL_CONTENT.source;

  return (
    <section className="qpage" aria-label={t('ncert.rnSectionAria')} style={{ paddingBottom: 4 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '20px 22px 18px' }}>
          <div className="spread" style={{ gap: 18, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="tag tag-brand">{t('ncert.classChapterTag', { cls: 8, n: 1 })}</span>
                <span className="tag">{t('ncert.topperLearningLayer')}</span>
                <span className="tag">{t('ncert.rnAuthoredCells', { n: NCERT_CLASS8_RATIONAL_CONTENT.questionBank.authoredCells })}</span>
              </div>
              <h2 style={{ margin: 0 }}>{t('ncert.rnTitle')}</h2>
              <p className="muted" style={{ margin: '7px 0 0', maxWidth: 900 }}>
                {t('ncert.rnIntro', { title: meta.title, edition: meta.edition })}
              </p>
            </div>
            <button className="btn btn-quiet btn-sm" onClick={() => setOpen(v => !v)} aria-expanded={open}>
              {open ? t('ncert.rnHideNotes') : t('ncert.openTopperNotes')}
            </button>
          </div>

          <div className="card" style={{ marginTop: 14, padding: '12px 14px', background: 'var(--surface-2, var(--card))' }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ fontSize: 20 }}>✍️</span>
              <div>
                <b>{t('ncert.rnHandwritingLive')}</b>
                <div className="muted" style={{ marginTop: 3 }}>
                  {tx('ncert.rnHandwritingBody', { write: <b>{t('ncert.writeMode')}</b> })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {open && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '0 22px 22px' }}>
            <div className="row" role="tablist" aria-label={t('ncert.rnViewsAria')}
              style={{ gap: 8, flexWrap: 'wrap', padding: '14px 0 16px' }}>
              {Object.entries(TAB).map(([key, label]) => (
                <button key={key} role="tab" aria-selected={tab === key}
                  className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-quiet'}`}
                  onClick={() => setTab(key)}>{t(label)}</button>
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
  const t = useT();
  return (
    <div>
      <div className="spread" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.rnTopperOnly')}</div>
          <div className="muted" style={{ marginTop: 4 }}>{t('ncert.rnTopperOnlyBody')}</div>
        </div>
        <span className="tag tag-brand">{t('ncert.rnExamTraps')}</span>
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
                  <b>{t('ncert.rnProofSkeleton')}</b><div style={{ marginTop: 5 }}><Text>{note.formula}</Text></div>
                </div>
              )}
              <PropertyTable rows={note.table} />
              <div style={{ marginTop: 12 }}>
                <span className="tag tag-brand">{t('ncert.topperEdge')}</span>
                <div style={{ marginTop: 6 }}><Text>{note.edge}</Text></div>
              </div>
            </div>
          </details>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <div className="sc-label" style={{ margin: 0 }}>{t('ncert.rnFinalCheck')}</div>
        <div className="grid cols-2" style={{ marginTop: 10, gap: 8 }}>
          {FINAL_CHECK.map((x, i) => <div key={i}><b>{i + 1}.</b> <Text>{x}</Text></div>)}
        </div>
      </div>
    </div>
  );
}

function WorkedExamples() {
  const t = useT();
  return (
    <div>
      <div className="sc-label" style={{ margin: '0 0 10px' }}>{t('ncert.rnWorkedEyebrow')}</div>
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
              <div><b>{t('ncert.finalAnswer')}</b> <Text>{ex.answer}</Text></div>
              <span className="tag tag-brand">{t('ncert.rnTopperMethod')}</span>
            </div>
            <div className="muted" style={{ marginTop: 7 }}><Text>{ex.topper}</Text></div>
          </details>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <b>{t('ncert.rnHowPriMarks')}</b>
        <div className="muted" style={{ marginTop: 6 }}>
          {t('ncert.rnHowPriMarksBody')}
        </div>
      </div>
    </div>
  );
}

function SourceChecks() {
  const t = useT();
  return (
    <div>
      <div className="spread" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.rnChecksEyebrow')}</div>
          <div className="muted" style={{ marginTop: 4 }}>{t('ncert.rnChecksBody')}</div>
        </div>
        <span className="tag">{t('ncert.rnSourceChecks', { count: NCERT_CLASS8_RATIONAL_SOURCE_CHECKS.length, n: NCERT_CLASS8_RATIONAL_SOURCE_CHECKS.length })}</span>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {NCERT_CLASS8_RATIONAL_SOURCE_CHECKS.map((item, i) => (
          <details className="card" key={`${item.title}-${i}`} style={{ padding: '12px 14px' }}>
            <summary style={{ cursor: 'pointer' }}>
              <b>{item.title}</b>
              <div style={{ marginTop: 4 }}><Text>{item.prompt}</Text></div>
            </summary>
            <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span className="tag tag-brand">{t('ncert.rnWorkedAnswer')}</span>
              <div style={{ marginTop: 7 }}><Text>{item.solution}</Text></div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Coverage() {
  const t = useT();
  const qb = NCERT_CLASS8_RATIONAL_CONTENT.questionBank;
  return (
    <div>
      <div className="grid cols-2" style={{ gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.rnBankContract')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{qb.authoredCells}</div>
          <div className="muted">{t('ncert.rnBankContractBody')}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.rnAnswerExperience')}</div>
          <div style={{ fontWeight: 750, marginTop: 8 }}>{t('ncert.typeHandwritingPhoto')}</div>
          <div className="muted" style={{ marginTop: 4 }}>{qb.solutionSupport}</div>
        </div>
      </div>

      <div className="sc-label" style={{ margin: '0 0 10px' }}>{t('ncert.pageByPageAudit')}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {NCERT_CLASS8_RATIONAL_CONTENT.sourceMap.map((row, i) => (
          <div className="card" key={i} style={{ padding: '11px 13px' }}>
            <div className="spread" style={{ gap: 12, alignItems: 'flex-start' }}>
              <div>
                <b>{row.section}</b>
                <div className="muted" style={{ marginTop: 4 }}>{row.coverage}</div>
              </div>
              <span className="tag">{t('ncert.pageShort', { pages: row.pages })}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        {t('ncert.rnPage14')}
      </p>
    </div>
  );
}
