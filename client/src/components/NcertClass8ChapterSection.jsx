import React, { useMemo, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import {
  ncertClass8Chapter,
  NCERT_CLASS8_3_13_RELEASE_AUDIT
} from '../engine/ncert/class8-chapters-3-13-production.js';

const TABS = Object.freeze({
  notes: 'Topper notes',
  examples: 'Worked examples',
  exercises: 'NCERT exercises',
  coverage: 'Source coverage'
});

const Text = ({ children }) => <MathText text={String(children ?? '')} />;

function Verification({ chapter }) {
  const confirmed = chapter.answerAudit.filter(item => item.status === 'confirmed');
  const questions = confirmed.reduce((sum, item) => sum + item.sourceQuestionCount, 0);
  return (
    <div className="card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="spread" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="sc-label" style={{ margin: 0 }}>NCERT SOURCE + ATTACHED ANSWERS · VERIFIED</div>
          <h3 style={{ margin: '5px 0 3px' }}>
            Chapter {chapter.chapterNumber} · {chapter.title}
          </h3>
          <div className="muted">
            All {chapter.exercises.length} exercise sections are source-audited; {questions} top-level source questions are represented in the answer audit.
          </div>
        </div>
        <span className="tag tag-brand">{confirmed.length}/{chapter.answerAudit.length} exercise keys confirmed</span>
      </div>
      <div className="grid cols-3" style={{ gap: 10, marginTop: 12 }}>
        <div className="stat"><b>{chapter.pages}</b><span>uploaded pages audited</span></div>
        <div className="stat"><b>{chapter.questionBank.authoredCells}</b><span>Pri mastery cells</span></div>
        <div className="stat"><b>Write · Type</b><span>production answer path</span></div>
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        Numeric practice stays on Pri Learning's existing InkAnswer handwriting-recognition, confidence, marking, retry and Pri Explain pipeline. No parallel or weaker marker is used.
      </div>
    </div>
  );
}

function Notes({ chapter }) {
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
              <b>Core relation</b><div style={{ marginTop: 4 }}><Text>{note.formula}</Text></div>
            </div>
          )}
          <div style={{ marginTop: 10 }}><b>Topper edge:</b> <Text>{note.edge}</Text></div>
        </article>
      ))}
    </div>
  );
}

function Examples({ chapter }) {
  return (
    <div className="grid cols-2" style={{ gap: 12 }}>
      {chapter.examples.map((example, i) => (
        <article className="card" key={`${chapter.id}-example-${i}`} style={{ padding: 16 }}>
          <div className="sc-label">FULLY WORKED · PRI LEVEL</div>
          <h3 style={{ margin: '5px 0 8px' }}>{example.title}</h3>
          <div style={{ padding: 10, borderRadius: 10, background: 'var(--surface-2)', marginBottom: 10 }}>
            <Text>{example.prompt}</Text>
          </div>
          <ol style={{ margin: 0, paddingLeft: 22 }}>
            {example.steps.map((step, j) => <li key={j} style={{ marginBottom: 7 }}><Text>{step}</Text></li>)}
          </ol>
          <div style={{ marginTop: 10 }}><b>Answer:</b> <Text>{example.answer}</Text></div>
          <div className="muted" style={{ marginTop: 7 }}><b>Topper insight:</b> <Text>{example.topper}</Text></div>
        </article>
      ))}
    </div>
  );
}

function Exercises({ chapter }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {chapter.answerAudit.map(item => (
        <details className="card" key={item.exercise} style={{ padding: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
            Exercise {item.exercise} · {item.sourceQuestionCount} top-level source questions · {item.status}
          </summary>
          <div style={{ marginTop: 12 }}>
            <div className="sc-label">ATTACHED ANSWER KEY · CHECKED AGAINST SOURCE</div>
            <div style={{ marginTop: 6, lineHeight: 1.65 }}><Text>{item.attachedAnswers}</Text></div>
            <div style={{ marginTop: 10 }}><b>Pri solution method:</b> <Text>{chapter.exerciseMethods[item.exercise]}</Text></div>
            <div className="muted" style={{ marginTop: 8 }}><Text>{item.note}</Text></div>
          </div>
        </details>
      ))}
      <div className="card" style={{ padding: 14 }}>
        <b>Question-mode solutions</b>
        <div className="muted" style={{ marginTop: 5 }}>
          Every four-level NCERT mastery generator returns at least three progressive hints and at least three worked-solution stages. Numeric forms inherit AI handwriting input; conceptual classification forms use MCQ only where handwriting adds no mathematical value.
        </div>
      </div>
    </div>
  );
}

function Coverage({ chapter }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card" style={{ padding: 16 }}>
        <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="sc-label">PRODUCTION CONTRACT</div>
            <h3 style={{ margin: '5px 0' }}>3 product outcomes · 4 mastery levels · complete source map</h3>
          </div>
          <span className="tag tag-brand">{chapter.questionBank.authoredCells} authored cells</span>
        </div>
        <ol style={{ marginBottom: 0 }}>
          {chapter.dotpoints.map((dp, i) => <li key={i} style={{ marginBottom: 7 }}><Text>{dp}</Text></li>)}
        </ol>
      </div>
      {chapter.sourceMap.map((row, i) => (
        <div className="card" key={i} style={{ padding: 14 }}>
          <div className="spread" style={{ gap: 10, flexWrap: 'wrap' }}>
            <b>{row.section}</b><span className="tag">PDF pages {row.pages}</span>
          </div>
          <div className="muted" style={{ marginTop: 7 }}><Text>{row.coverage}</Text></div>
        </div>
      ))}
      <div className="card" style={{ padding: 14 }}>
        <b>Class 8 Chapters 3–13 release audit</b>
        <div className="muted" style={{ marginTop: 6 }}>
          {NCERT_CLASS8_3_13_RELEASE_AUDIT.chapterCount} chapters · {NCERT_CLASS8_3_13_RELEASE_AUDIT.sourcePages} source pages · {NCERT_CLASS8_3_13_RELEASE_AUDIT.exerciseCount} exercise sections · {NCERT_CLASS8_3_13_RELEASE_AUDIT.sourceExerciseQuestions} top-level source questions · {NCERT_CLASS8_3_13_RELEASE_AUDIT.authoredCells} dedicated NCERT mastery cells.
        </div>
      </div>
    </div>
  );
}

export default function NcertClass8ChapterSection({ chapterId }) {
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
            {label}
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
