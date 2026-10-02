import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { MathText } from '../lib/latex.jsx';
import { indiaExamBlueprint, indiaExamClaim } from '../engine/indiaExams.js';
import { tLater, useT, useTx } from '../i18n/index.js';

// The India blueprints and their claims are engine data with an English source
// of truth in engine/indiaExams.js; these are their catalogue keys, so the page
// can show them in the student's language. i18n-coverage-check holds the English
// catalogue values equal to the engine's, so the two cannot drift.
const BLUEPRINT_KEYS = {
  'cbse-x-standard-041-2025-26-reference': ['exams.bp.cbseXStandard', 'exams.bp.cbseXStandardNote'],
  'cbse-x-basic-241-2025-26-reference': ['exams.bp.cbseXBasic', 'exams.bp.cbseXBasicNote'],
  'cbse-xii-041-2025-26-reference': ['exams.bp.cbseXII', 'exams.bp.cbseXIINote'],
  'cbse-xi-annual-2025-26-school-pattern': ['exams.bp.cbseXI', 'exams.bp.cbseXINote'],
  'jee-main-paper1-mathematics-2026': ['exams.bp.jeeMain', 'exams.bp.jeeMainNote'],
  'jee-advanced-2026-structure': ['exams.bp.jeeAdvanced', 'exams.bp.jeeAdvancedNote'],
  'jee-advanced-paper1-mathematics-2024-reference': ['exams.bp.jeeAdvanced2024', 'exams.bp.jeeAdvanced2024Note'],
  'ioqm-2024-25-reference': ['exams.bp.ioqm', 'exams.bp.ioqmNote'],
};
const CLAIM_KEYS = {
  'official-mathematics-section': 'exams.claim.officialSection',
  'official-structure-dynamic-marking': 'exams.claim.officialStructure',
};

export default function Exams() {
  const { user } = useApp();
  const t = useT();
  const [exams, setExams] = useState(null);
  const [cfg, setCfg] = useState({ length: 10, minutes: 30, year: user.year });
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState('');
  const nav = useNavigate();
  const indiaBlueprint = useMemo(() => user.course === 'in'
    ? indiaExamBlueprint({ track: user.indiaTrack || 'cbse', grade: user.year })
    : null, [user.course, user.indiaTrack, user.year]);

  async function openPaper(id) {
    setError('');
    try {
      const p = await api.get(`/exams/${id}/paper`);
      setPaper(p);
    } catch (err) { setError(err.message || tLater('exams.openFailed')); }
  }

  useEffect(() => { api.get('/exams').then(r => setExams(r.exams)).catch(() => setExams([])); }, []);

  async function start() {
    setBusy(true);
    setError('');
    try {
      const body = user.course === 'in' ? { year: user.year } : cfg;
      const r = await api.post('/exams', body);
      nav(`/exams/${r.exam.id}`);
    } catch (err) {
      setError(err.message || tLater('exams.formatNotReady'));
    } finally { setBusy(false); }
  }

  if (user.course === 'in') {
    return <IndiaExams
      user={user} exams={exams} blueprint={indiaBlueprint} busy={busy} error={error}
      start={start} openPaper={openPaper} nav={nav} paper={paper} setPaper={setPaper}
    />;
  }

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      {!paper && <h1 className="sr-only">{t('nav.exams')}</h1>}
      <div className="card">
        <div className="card-title">{t('exams.sitPaperTitle')}</div>
        <p className="sub" style={{ marginBottom: 18 }}>
          {t('exams.sitPaperBody')}
        </p>
        <div className="field">
          <label className="label" htmlFor="exam-year">{t('exams.yearLevel')}</label>
          <select className="input" id="exam-year" value={cfg.year} onChange={e => setCfg(c => ({ ...c, year: Number(e.target.value) }))}>
            {[7, 8, 9, 10, 11, 12].map(y => <option key={y} value={y}>{y === user.year ? t('exams.yearOptionYours', { n: y }) : t('common.yearNumber', { n: y })}</option>)}
          </select>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="exam-length">{t('exams.questionsLabel')}</label>
            <select className="input" id="exam-length" value={cfg.length} onChange={e => setCfg(c => ({ ...c, length: Number(e.target.value), minutes: Number(e.target.value) * 3 }))}>
              <option value={10}>{t('exams.lengthQuick')}</option>
              <option value={15}>{t('exams.lengthStandard')}</option>
              <option value={20}>{t('exams.lengthFull')}</option>
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="exam-minutes">{t('exams.timeLimit')}</label>
            <select className="input" id="exam-minutes" value={cfg.minutes} onChange={e => setCfg(c => ({ ...c, minutes: Number(e.target.value) }))}>
              {[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{t('exams.minutesOption', { count: m, n: m })}</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} onClick={start} disabled={busy}>
          {busy ? t('exams.building') : t('exams.startPractice')}
        </button>
      </div>

      <PaperHistory exams={exams} openPaper={openPaper} nav={nav} />
      {error && <div className="card" role="alert" style={{ gridColumn: '1 / -1' }}>{error}</div>}
      {paper && <PrintPaper paper={paper} onClose={() => setPaper(null)} />}
    </div>
  );
}

function IndiaExams({ user, exams, blueprint, busy, error, start, openPaper, nav, paper, setPaper }) {
  const claim = indiaExamClaim(blueprint);
  const track = user.indiaTrack || 'cbse';
  const jeeMainReady = track === 'jee-main' && blueprint?.authenticity === 'official-mathematics-section';
  const t = useT();
  const tx = useTx();

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      {!paper && <h1 className="sr-only">{t('exams.indiaHeading')}</h1>}
      <div className="card">
        <div className="card-title">{blueprint ? (BLUEPRINT_KEYS[blueprint.id] ? t(BLUEPRINT_KEYS[blueprint.id][0]) : blueprint.label) : t('exams.classPractice', { n: user.year })}</div>
        {jeeMainReady ? <>
          <p className="sub" style={{ marginBottom: 16 }}>
            {tx('exams.jeeMainIntro', { section: <b>{t('exams.jeeMainSection')}</b> })}
          </p>
          <div className="grid cols-2" style={{ gap: 10, marginBottom: 14 }}>
            <div className="stat-tile"><div className="sc-label">{t('exams.questionsLabel')}</div><div className="big">25</div><div className="muted">{t('exams.jeeQuestionMix')}</div></div>
            <div className="stat-tile"><div className="sc-label">{t('exams.maximum')}</div><div className="big">100</div><div className="muted">{t('exams.jeeMarking')}</div></div>
          </div>
          <p className="muted" style={{ marginBottom: 14 }}>
            {t('exams.jeeTimerNote')}
          </p>
          <p className="muted" style={{ marginBottom: 16 }}>
            {t('exams.jeeArchiveNote')}
          </p>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={start} disabled={busy}>
            {busy ? t('exams.buildingJee') : t('exams.startJee')}
          </button>
        </> : <>
          <p className="sub" style={{ marginBottom: 14 }}>{!blueprint ? t('exams.claim.none')
            : CLAIM_KEYS[blueprint.authenticity] ? t(CLAIM_KEYS[blueprint.authenticity])
              : BLUEPRINT_KEYS[blueprint.id] ? t(BLUEPRINT_KEYS[blueprint.id][1]) : claim.reason}</p>
          {track === 'cbse' && user.year === 10 && <p className="muted">
            {t('exams.cbseClass10Note')}
          </p>}
          {track === 'jee-advanced' && <p className="muted">
            {t('exams.jeeAdvancedNote')}
          </p>}
          <button className="btn btn-ghost btn-lg" style={{ width: '100%', marginTop: 16 }} disabled>
            {t('exams.notReleased')}
          </button>
        </>}
        {error && <div role="alert" style={{ marginTop: 14, color: 'var(--bad)' }}>{error}</div>}
      </div>

      <PaperHistory exams={exams} openPaper={openPaper} nav={nav} india />
      {paper && <PrintPaper paper={paper} onClose={() => setPaper(null)} />}
    </div>
  );
}

function PaperHistory({ exams, openPaper, nav, india = false }) {
  const t = useT();
  return (
    <div className="card">
      <div className="card-title">{t('exams.yourPapers')}</div>
      {!exams && <div className="skeleton" style={{ height: 160 }} />}
      {exams && !exams.length && <p className="muted">{t('exams.noExams')}</p>}
      {exams && exams.map(e => {
        const pct = e.finished_at && e.total ? Math.round(100 * e.score / e.total) : null;
        return (
          <div className="prio-item" key={e.id}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 640, fontSize: 14 }}>{e.title}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {t(india ? 'exams.paperMetaIndia' : 'exams.paperMeta', { date: new Date(e.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), n: e.duration_min })}
              </div>
            </div>
            {e.finished_at
              ? <span className="tag" style={{ color: pct >= 80 ? 'var(--good)' : pct >= 50 ? 'var(--ink)' : 'var(--bad)' }}>
                {e.score}/{e.total} · {pct}%
              </span>
              : <span className="tag tag-brand">{t('exams.inProgress')}</span>}
            <button className="btn btn-quiet btn-sm" title={t('exams.openPrintable')}
              aria-label={t('exams.openPrintableAria', { title: e.title })} onClick={() => openPaper(e.id)}>{t('exams.print')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => nav(`/exams/${e.id}`)}>{e.finished_at ? t('nav.review') : t('exams.resume')}</button>
          </div>
        );
      })}
      <p className="muted" style={{ marginTop: 10 }}>
        {t('exams.printNote')}
      </p>
    </div>
  );
}

function marksForQuestion(q) {
  if (q.multipart) return q.parts.reduce((t, pt) => t + Number(pt.marks || 0), 0);
  if (Array.isArray(q.criteria)) return q.criteria.reduce((n, c) => n + Number(c.mark || 1), 0);
  return Number(q.marks || 1);
}

export function PrintPaper({ paper, onClose }) {
  const solutionsAvailable = paper.solutionsAvailable !== false;
  const t = useT();
  const tx = useTx();
  return (
    <div className="paper-overlay">
      <div className="row no-print" style={{ padding: 14, justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => window.print()}>{t('exams.printButton')}</button>
        <button className="btn btn-ghost" onClick={onClose}>{t('nav.close')}</button>
      </div>
      <div className="paper-sheet">
        <h1 style={{ fontSize: 22 }}>{paper.title}</h1>
        <p style={{ margin: '4px 0 2px' }}>{t('exams.printMeta', { course: paper.course, minutes: paper.durationMin, marks: paper.questions.reduce((s, q) => s + marksForQuestion(q), 0) })}</p>
        <p style={{ fontSize: 12, color: '#666', margin: '0 0 18px' }}>{t('exams.printFooter')}</p>
        {paper.questions.map((q, i) => q.multipart ? (
          <div key={i} style={{ margin: '0 0 26px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t('exams.questionNumber', { n: i + 1 })} <span style={{ fontWeight: 400, color: '#666' }}>{t('exams.printMarksStructured', { count: q.parts.reduce((sum, pt) => sum + pt.marks, 0), n: q.parts.reduce((sum, pt) => sum + pt.marks, 0) })}</span></div>
            <MathText block text={q.stem} />
            {q.figure && <div className="q-figure print-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.parts.map(pt => (
              <div key={pt.key} style={{ margin: '10px 0 0' }}>
                <div><b>({pt.key})</b> <MathText text={pt.prompt} /> <span style={{ color: '#666' }}>{t('exams.partMarks', { count: pt.marks, n: pt.marks })}</span></div>
                {pt.answerType === 'mcq' && pt.mcqOptions && (
                  <div style={{ marginTop: 4 }}>{pt.mcqOptions.map((o, j) => <div key={j} style={{ margin: '2px 0' }}>({'ABCD'[j]}) <MathText text={o} /></div>)}</div>
                )}
                <div style={{ height: pt.answerType === 'mcq' ? 6 : 48, borderBottom: pt.answerType === 'mcq' ? 'none' : '1px dotted #bbb' }} />
              </div>
            ))}
          </div>
        ) : (
          <div key={i} style={{ margin: '0 0 26px', breakInside: 'avoid' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {t('exams.questionNumber', { n: i + 1 })} <span style={{ fontWeight: 400, color: '#666' }}>{q.section
                ? t('exams.printMarksSection', { count: marksForQuestion(q), n: marksForQuestion(q), section: q.section })
                : q.subtopicName
                  ? t('exams.printMarksTopic', { count: marksForQuestion(q), n: marksForQuestion(q), topic: q.subtopicName })
                  : t('exams.printMarks', { count: marksForQuestion(q), n: marksForQuestion(q) })}</span>
            </div>
            <MathText block text={q.prompt} />
            {q.figure && <div className="q-figure print-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.answerType === 'mcq' && q.mcqOptions && (
              <div style={{ marginTop: 6 }}>{q.mcqOptions.map((o, j) => <div key={j} style={{ margin: '3px 0' }}>({'ABCD'[j]}) <MathText text={o} /></div>)}</div>
            )}
            <div style={{ height: q.answerType === 'mcq' ? 8 : 64, borderBottom: q.answerType === 'mcq' ? 'none' : '1px dotted #bbb' }} />
          </div>
        ))}

        {solutionsAvailable && <>
          <div style={{ pageBreakBefore: 'always' }} />
          <h2 style={{ fontSize: 18, margin: '18px 0 12px' }}>{t('exams.solutionsHeading')}</h2>
          {paper.questions.map((q, i) => q.multipart ? (
            <div key={i} style={{ margin: '0 0 20px', breakInside: 'avoid' }}>
              <div style={{ fontWeight: 700 }}>{t('exams.solutionStructured', { n: i + 1 })}</div>
              {q.parts.map(pt => (
                <div key={pt.key} style={{ margin: '6px 0 8px' }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{tx('exams.partAnswer', { key: pt.key, answer: <MathText text={pt.answerText} /> })} <span style={{ color: '#666', fontWeight: 400 }}>{t('exams.partMarks', { count: pt.marks, n: pt.marks })}</span></div>
                  {(pt.steps || []).map((s, j) => <div key={j} style={{ fontSize: 13, margin: '2px 0' }}><b><MathText text={s.h} />:</b> <MathText text={s.d} /></div>)}
                </div>
              ))}
            </div>
          ) : (
            <div key={i} style={{ margin: '0 0 20px', breakInside: 'avoid' }}>
              <div style={{ fontWeight: 700 }}>{tx('exams.questionAnswer', { n: i + 1, answer: <MathText text={q.answerText || ''} /> })}</div>
              {Array.isArray(q.criteria) && <ul style={{ margin: '4px 0 6px', paddingLeft: 20 }}>
                {q.criteria.map((c, j) => <li key={j} style={{ fontSize: 13 }}>{tx('exams.criterionMarks', { count: Number(c.mark || 1), n: c.mark || 1, text: <MathText text={c.text} /> })}</li>)}
              </ul>}
              {(q.steps || []).map((s, j) => <div key={j} style={{ fontSize: 13, margin: '2px 0' }}><b><MathText text={s.h} />:</b> <MathText text={s.d} /></div>)}
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}
