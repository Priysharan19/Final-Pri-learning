import React, { useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT, useTx } from '../i18n/index.js';
import {
  NCERT_CLASS8_LINEAR_CONTENT,
  NCERT_CLASS8_LINEAR_TOPPER_NOTES,
  NCERT_CLASS8_LINEAR_WORKED_EXAMPLES,
  NCERT_CLASS8_LINEAR_EXERCISE_21,
  NCERT_CLASS8_LINEAR_EXERCISE_22,
  NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT
} from '../engine/ncert/class8-linear-production.js';

// Tab ids with the catalogue key (and its values) for each label.
const TABS = Object.freeze({
  notes: ['ncert.topperNotes'],
  examples: ['ncert.workedExamples'],
  ex21: ['ncert.exercise', { n: '2.1' }],
  ex22: ['ncert.exercise', { n: '2.2' }],
  coverage: ['ncert.sourceCoverage']
});

// i18n-exempt-start: the 60-second final check is a list of linear-equation solving rules — maths content that stays English by design
const FINAL_CHECK = [
  'Equation means equality; expression does not contain =.',
  'Linear here means one variable with highest power 1.',
  'Transposition is shorthand for doing the same operation to both sides.',
  'Clear fractions with the LCM before solving when it simplifies the equation.',
  'Expand every term in a bracket before combining like terms.',
  'For decimals, scale the whole equation by 10, 100, … or convert exactly to fractions.',
  'Collect variable terms on one side and constants on the other.',
  'Finish by checking the original LHS and RHS by substitution.'
];
// i18n-exempt-end

function Text({ children }) {
  return <MathText text={String(children ?? '')} />;
}

function Answer({ item }) {
  const value = item.displayAnswer || (item.answer.d === 1 ? String(item.answer.n) : `${item.answer.n}/${item.answer.d}`);
  return `${item.variable} = ${value}`;
}

function VerificationStrip() {
  const t = useT();
  const tx = useTx();
  const audit = NCERT_CLASS8_LINEAR_EXERCISE_ANSWER_AUDIT;
  const ex21 = audit.confirmed.filter(x => x.source.includes('2.1'));
  const ex22 = audit.confirmed.filter(x => x.source.includes('2.2'));
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="spread" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.leKeyEyebrow')}</div>
          <h3 style={{ margin: '5px 0 3px' }}>{t('ncert.leKeyTitle')}</h3>
          <div className="muted">{t('ncert.leKeyBody')}</div>
        </div>
        <span className="tag tag-brand">{t('ncert.leMismatches')}</span>
      </div>
      <div className="grid cols-2" style={{ gap: 12, marginTop: 12 }}>
        {[['2.1', ex21], ['2.2', ex22]].map(([title, rows]) => (
          <div key={title} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            <b>{t('ncert.exercise', { n: title })}</b>
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
        {tx('ncert.leQ3Note', {
          equation: <Text>{'$x+7-\\frac{8x}{3}=\\frac{17}{6}-\\frac{5x}{2}$'}</Text>,
          solution: <Text>{'$x=-5$'}</Text>
        })}
      </div>
    </div>
  );
}

function Notes() {
  const t = useT();
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
              <span className="tag tag-brand">{t('ncert.topperEdge')}</span>
              <div style={{ marginTop: 6 }}><Text>{note.edge}</Text></div>
            </div>
          </div>
        </details>
      ))}
      <div className="card" style={{ padding: 15 }}>
        <div className="sc-label" style={{ margin: 0 }}>{t('ncert.leFinalCheck')}</div>
        <div className="grid cols-2" style={{ marginTop: 9, gap: 7 }}>
          {FINAL_CHECK.map((x, i) => <div key={x}><b>{i + 1}.</b> <Text>{x}</Text></div>)}
        </div>
      </div>
    </div>
  );
}

function WorkedExamples() {
  const t = useT();
  return (
    <div>
      <div className="sc-label" style={{ margin: '0 0 9px' }}>{t('ncert.leWorkedEyebrow')}</div>
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
              <div><b>{t('ncert.finalAnswer')}</b> <Text>{ex.answer}</Text></div>
              <span className="tag tag-brand">{t('ncert.lePriTopperMethod')}</span>
            </div>
            <div className="muted" style={{ marginTop: 7 }}><Text>{ex.topper}</Text></div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Exercise({ title, items }) {
  const t = useT();
  return (
    <div>
      <div className="spread" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.leExerciseEyebrow', { title })}</div>
          <div className="muted" style={{ marginTop: 4 }}>{t('ncert.leExerciseBody')}</div>
        </div>
        <span className="tag">{t('ncert.leSolved', { solved: items.length, total: items.length })}</span>
      </div>
      <div style={{ display: 'grid', gap: 9 }}>
        {items.map((item, i) => (
          <details key={`${item.exercise}-${item.q}`} className="card" open={i === 0} style={{ padding: '12px 14px' }}>
            <summary style={{ cursor: 'pointer' }}>
              <b>{t('ncert.questionShort', { n: item.q })}</b>
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
              <span className="tag tag-brand">{t('ncert.leVerifiedAnswer')}</span>{' '}
              <b><Answer item={item} /></b>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Coverage() {
  const t = useT();
  const qb = NCERT_CLASS8_LINEAR_CONTENT.questionBank;
  return (
    <div>
      <div className="grid cols-2" style={{ gap: 12, marginBottom: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.leBankDepth')}</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 5 }}>{qb.authoredCells}</div>
          <div className="muted">{t('ncert.leBankDepthBody')}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.leAnswerExperience')}</div>
          <div style={{ fontWeight: 750, marginTop: 7 }}>{t('ncert.typeHandwritingPhoto')}</div>
          <div className="muted" style={{ marginTop: 4 }}>{qb.solutionSupport}</div>
        </div>
      </div>
      <div className="sc-label" style={{ margin: '0 0 9px' }}>{t('ncert.pageByPageAudit')}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {NCERT_CLASS8_LINEAR_CONTENT.sourceMap.map((row, i) => (
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
        {t('ncert.lePage6')}
      </p>
    </div>
  );
}

export default function LinearEquationsTopperSectionProduction() {
  const t = useT();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('notes');
  return (
    <section className="qpage" aria-label={t('ncert.leSectionAria')} style={{ paddingBottom: 4 }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '20px 22px 18px' }}>
          <div className="spread" style={{ gap: 18, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <span className="tag tag-brand">{t('ncert.classChapterTag', { cls: 8, n: 2 })}</span>
                <span className="tag">{t('ncert.topperLearningLayer')}</span>
                <span className="tag">{t('ncert.leAuthoredCells', { n: NCERT_CLASS8_LINEAR_CONTENT.questionBank.authoredCells })}</span>
              </div>
              <h2 style={{ margin: 0 }}>{t('ncert.leTitle')}</h2>
              <p className="muted" style={{ margin: '7px 0 0', maxWidth: 900 }}>
                {t('ncert.leIntro')}
              </p>
            </div>
            <button className="btn btn-quiet btn-sm" onClick={() => setOpen(v => !v)} aria-expanded={open}>
              {open ? t('ncert.leHideLayer') : t('ncert.openTopperNotes')}
            </button>
          </div>
        </div>
        {open && (
          <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px 18px' }}>
            <VerificationStrip />
            <div className="row" role="tablist" aria-label={t('ncert.leTabsAria')} style={{ gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
              {Object.entries(TABS).map(([key, [labelKey, vars]]) => (
                <button
                  key={key}
                  className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-quiet'}`}
                  onClick={() => setTab(key)}
                  role="tab"
                  aria-selected={tab === key}
                >{t(labelKey, vars)}</button>
              ))}
            </div>
            {tab === 'notes' && <Notes />}
            {tab === 'examples' && <WorkedExamples />}
            {tab === 'ex21' && <Exercise title={t('ncert.exercise', { n: '2.1' })} items={NCERT_CLASS8_LINEAR_EXERCISE_21} />}
            {tab === 'ex22' && <Exercise title={t('ncert.exercise', { n: '2.2' })} items={NCERT_CLASS8_LINEAR_EXERCISE_22} />}
            {tab === 'coverage' && <Coverage />}
          </div>
        )}
      </div>
    </section>
  );
}
