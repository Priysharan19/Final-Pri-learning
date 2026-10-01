import React, { useMemo, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import {
  ncertClass8Chapter,
  NCERT_CLASS8_3_13_RELEASE_AUDIT
} from '../engine/ncert/class8-chapters-3-13-production.js';

// Tab ids with the catalogue keys for their labels.
const TABS = Object.freeze({
  notes: 'ncert.topperNotes',
  examples: 'ncert.workedExamples',
  exercises: 'ncert.ncertExercises',
  coverage: 'ncert.sourceCoverage'
});

// Answer-audit statuses from the content data, as catalogue keys.
const STATUS_KEY = { confirmed: 'ncert.statusConfirmed' };

const Text = ({ children }) => <MathText text={String(children ?? '')} />;

function Verification({ chapter }) {
  const t = useT();
  const confirmed = chapter.answerAudit.filter(item => item.status === 'confirmed');
  const questions = confirmed.reduce((sum, item) => sum + item.sourceQuestionCount, 0);
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="spread" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>{t('ncert.c8Eyebrow')}</div>
          <h3 style={{ margin: '5px 0 3px' }}>
            {t('ncert.chapterTitle', { n: chapter.chapterNumber, title: chapter.title })}
          </h3>
          <div className="muted">
            {t('ncert.c8AuditLine', { sections: chapter.exercises.length, questions })}
          </div>
        </div>
        <span className="tag tag-brand">{t('ncert.c8KeysConfirmed', { confirmed: confirmed.length, total: chapter.answerAudit.length })}</span>
      </div>
      <div className="grid cols-3" style={{ gap: 10, marginTop: 12 }}>
        <div className="stat"><b>{chapter.pages}</b><span>{t('ncert.uploadedPagesAudited')}</span></div>
        <div className="stat"><b>{chapter.questionBank.authoredCells}</b><span>{t('ncert.c8MasteryCells')}</span></div>
        <div className="stat"><b>{t('ncert.writeType')}</b><span>{t('ncert.productionAnswerPath')}</span></div>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        {t('ncert.c8InkNote')}
      </div>
    </div>
  );
}

function Notes({ chapter }) {
  const t = useT();
  return (
    <div className="grid cols-2" style={{ gap: 12 }}>
      {chapter.notes.map(note => (
        <article className="card" key={note.title} style={{ padding: 16 }}>
          <div className="sc-label">{note.level}</div>
          <h3 style={{ margin: '5px 0 10px' }}>{note.title}</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {note.points.map((point, i) => <li key={i} style={{ marginBottom: 7 }}><Text>{point}</Text></li>)}
          </ul>
          {note.formula && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--surface-2)' }}>
              <b>{t('ncert.coreRelation')}</b><div style={{ marginTop: 4 }}><Text>{note.formula}</Text></div>
            </div>
          )}
          <div style={{ marginTop: 10 }}><b>{t('ncert.topperEdgeLabel')}</b> <Text>{note.edge}</Text></div>
        </article>
      ))}
    </div>
  );
}

function Examples({ chapter }) {
  const t = useT();
  return (
    <div className="grid cols-2" style={{ gap: 12 }}>
      {chapter.examples.map((example, i) => (
        <article className="card" key={`${chapter.id}-example-${i}`} style={{ padding: 16 }}>
          <div className="sc-label">{t('ncert.fullyWorkedPriLevel')}</div>
          <h3 style={{ margin: '5px 0 8px' }}>{example.title}</h3>
          <div style={{ padding: 10, borderRadius: 10, background: 'var(--surface-2)', marginBottom: 10 }}>
            <Text>{example.prompt}</Text>
          </div>
          <ol style={{ margin: 0, paddingLeft: 22 }}>
            {example.steps.map((step, j) => <li key={j} style={{ marginBottom: 7 }}><Text>{step}</Text></li>)}
          </ol>
          <div style={{ marginTop: 10 }}><b>{t('ncert.answerLabel')}</b> <Text>{example.answer}</Text></div>
          <div className="muted" style={{ marginTop: 7 }}><b>{t('ncert.topperInsight')}</b> <Text>{example.topper}</Text></div>
        </article>
      ))}
    </div>
  );
}

function Exercises({ chapter }) {
  const t = useT();
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {chapter.answerAudit.map(item => (
        <details className="card" key={item.exercise} style={{ padding: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
            {t('ncert.c8ExerciseSummary', { n: item.exercise, questions: item.sourceQuestionCount, status: STATUS_KEY[item.status] ? t(STATUS_KEY[item.status]) : item.status })}
          </summary>
          <div style={{ marginTop: 12 }}>
            <div className="sc-label">{t('ncert.c8AttachedKey')}</div>
            <div style={{ marginTop: 6, lineHeight: 1.65 }}><Text>{item.attachedAnswers}</Text></div>
            <div style={{ marginTop: 10 }}><b>{t('ncert.priSolutionMethod')}</b> <Text>{chapter.exerciseMethods[item.exercise]}</Text></div>
            <div className="muted" style={{ marginTop: 8 }}><Text>{item.note}</Text></div>
          </div>
        </details>
      ))}
      <div className="card" style={{ padding: 14 }}>
        <b>{t('ncert.c8QuestionModeTitle')}</b>
        <div className="muted" style={{ marginTop: 5 }}>
          {t('ncert.c8QuestionModeBody')}
        </div>
      </div>
    </div>
  );
}

function Coverage({ chapter }) {
  const t = useT();
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="sc-label">{t('ncert.productionContract')}</div>
            <h3 style={{ margin: '5px 0' }}>{t('ncert.c8ContractTitle')}</h3>
          </div>
          <span className="tag tag-brand">{t('ncert.c8AuthoredCells', { n: chapter.questionBank.authoredCells })}</span>
        </div>
        <ol style={{ marginBottom: 0 }}>
          {chapter.dotpoints.map((dp, i) => <li key={i} style={{ marginBottom: 7 }}><Text>{dp}</Text></li>)}
        </ol>
      </div>
      {chapter.sourceMap.map((row, i) => (
        <div className="card" key={i} style={{ padding: 14 }}>
          <div className="spread" style={{ gap: 10, flexWrap: 'wrap' }}>
            <b>{row.section}</b><span className="tag">{t('ncert.pdfPages', { pages: row.pages })}</span>
          </div>
          <div className="muted" style={{ marginTop: 7 }}><Text>{row.coverage}</Text></div>
        </div>
      ))}
      <div className="card" style={{ padding: 14 }}>
        <b>{t('ncert.c8ReleaseTitle')}</b>
        <div className="muted" style={{ marginTop: 6 }}>
          {t('ncert.c8ReleaseLine', {
            chapters: NCERT_CLASS8_3_13_RELEASE_AUDIT.chapterCount,
            pages: NCERT_CLASS8_3_13_RELEASE_AUDIT.sourcePages,
            sections: NCERT_CLASS8_3_13_RELEASE_AUDIT.exerciseCount,
            questions: NCERT_CLASS8_3_13_RELEASE_AUDIT.sourceExerciseQuestions,
            cells: NCERT_CLASS8_3_13_RELEASE_AUDIT.authoredCells
          })}
        </div>
      </div>
    </div>
  );
}

export default function NcertClass8ChapterSection({ chapterId }) {
  const t = useT();
  const chapter = useMemo(() => ncertClass8Chapter(chapterId), [chapterId]);
  const [tab, setTab] = useState('notes');
  if (!chapter) return null;

  return (
    <section style={{ margin: '0 auto 18px', maxWidth: 1180, padding: '14px 18px 0' }}>
      <Verification chapter={chapter} />
      <div className="card" style={{ padding: 10, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(TABS).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={tab === key ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'notes' && <Notes chapter={chapter} />}
      {tab === 'examples' && <Examples chapter={chapter} />}
      {tab === 'exercises' && <Exercises chapter={chapter} />}
      {tab === 'coverage' && <Coverage chapter={chapter} />}
    </section>
  );
}
