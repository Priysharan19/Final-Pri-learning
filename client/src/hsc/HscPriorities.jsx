// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC 2027 priorities (Prithagoras, Years 11–12)
//
// Which topics and question styles to put first for the 2027 HSC Mathematics
// Advanced and Extension 1 examinations, ranked by the priorities engine
// (engine/hsc/hscPriorities.js), joined to the student's own practice, with a
// practice paper weighted by the ranking. It says plainly what it is: based on
// the new syllabus, NESA's sample materials and past papers; not a prediction
// of the questions, a mark or a band. No NESA question text is shown; the one
// link to NESA is to its own exam-pack page.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import { hscPriorities, topicWeightRanges } from '../engine/hsc/hscPriorities.js';
import { hscPractiseNext, curriculumRows } from '../engine/hsc/hscPractice.js';
import { HSC_UNTAGGED } from '../engine/hsc/hscSources.js';

const COURSE_KEY = { advanced: 'hsc.courseAdvanced', extension1: 'hsc.courseExtension1' };
const NESA_PAPERS = {
  advanced: 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-advanced',
  extension1: 'https://www.nsw.gov.au/education-and-training/nesa/curriculum/hsc-exam-papers/mathematics-extension-1'
};
const PRACTISE_NEXT = 3;
const STYLE_KEY = {
  mcq: 'hsc.style.mcq', short: 'hsc.style.short', extended: 'hsc.style.extended',
  proof: 'hsc.style.proof', sketch: 'hsc.style.sketch', explain: 'hsc.style.explain'
};

const pct = x => Math.round(x * 100);

function Reasons({ p, paperMarks }) {
  const t = useT();
  return (
    <ul className="hsc-reasons" style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
      {p.reasons.map((r, i) => {
        if (r.kind === 'history') return <li key={i}>{t('hsc.reasonHistory', { from: r.years[0], to: r.years[r.years.length - 1], n: pct(r.share) })}</li>;
        if (r.kind === 'sample') return <li key={i}>{t('hsc.reasonSample', { n: Math.round(r.marks), total: paperMarks })}</li>;
        if (r.kind === 'sample-absent') return <li key={i}>{t('hsc.reasonSampleAbsent')}</li>;
        if (r.kind === 'syllabus') return <li key={i}>{t('hsc.reasonSyllabus', { count: r.groups, n: r.groups })}</li>;
        if (r.kind === 'new') return <li key={i}>{t('hsc.reasonNew', { groups: r.groups.join(', ') })}</li>;
        if (r.kind === 'moved') return <li key={i}>{t('hsc.reasonMoved')}</li>;
        return null;
      })}
    </ul>
  );
}

function Evidence({ row }) {
  const t = useT();
  const e = row.evidence;
  if (row.status === 'no-practice') return <span className="muted">{t('hsc.evidenceNoPractice')}</span>;
  if (row.status === 'not-started') return <span className="muted">{t('hsc.evidenceNotStarted')}</span>;
  if (e.independent === null) return <span>{t('hsc.evidenceRight', { right: e.right, n: e.answers })}</span>;
  return <span>{t('hsc.evidenceIndependent', { right: e.independent, n: e.answers })}</span>;
}

function styleText(t, p) {
  return p.styles.filter(s => STYLE_KEY[s.type]).map(s => t(STYLE_KEY[s.type])).join(' · ');
}

export default function HscPriorities({ user, courses, curriculum }) {
  const t = useT();
  const nav = useNavigate();
  const [course, setCourse] = useState(courses[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const result = useMemo(() => hscPriorities(course), [course]);
  // Marks at stake are shown only as a range (topicWeightRanges), never as a point share.
  const ranges = useMemo(() => topicWeightRanges(course), [course]);
  const rows = useMemo(() => curriculumRows(curriculum), [curriculum]);
  const joined = useMemo(() => hscPractiseNext(result.priorities, rows), [result, rows]);
  const byCode = useMemo(() => Object.fromEntries(joined.map(r => [r.code, r])), [joined]);
  const next = joined.filter(r => r.links.length && r.status !== 'secure').slice(0, PRACTISE_NEXT);
  const untagged = HSC_UNTAGGED.filter(u => u.course === course && u.year > 2019);
  const years = result.history.years;

  async function buildPaper() {
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/exams', { year: 12, length: 20, minutes: 60, hscPriorities: course });
      nav(`/exams/${r.exam.id}`);
    } catch (err) {
      setError(err?.message || t('hsc.paperFailed'));
    } finally { setBusy(false); }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }} data-hsc-priorities={course}>
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 6 }}>{t('hsc.title')}</h2>
        <p className="sub" style={{ margin: 0 }} data-hsc-disclaimer>{t('hsc.whatThisIs')}</p>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{t('hsc.notAMark')}</p>
        {courses.length > 1 && (
          <div className="page-tabs" role="group" aria-label={t('hsc.courseGroup')} style={{ marginTop: 14 }}>
            {courses.map(c => (
              <button key={c} className={`page-tab ${course === c ? 'on' : ''}`} aria-pressed={course === c} onClick={() => setCourse(c)}>{t(COURSE_KEY[c])}</button>
            ))}
          </div>
        )}
      </div>

      <div className="card" data-hsc-next>
        <h3 className="card-title" style={{ marginBottom: 6 }}>{t('hsc.practiseNextTitle')}</h3>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{t('hsc.practiseNextHow')}</p>
        {next.length ? next.map((r, i) => (
          <div className="prio-item" key={r.code}>
            <span className="prio-rank">{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15 }}>{r.focusArea} <span className="muted">· {r.code}</span></div>
              <div className="muted" style={{ fontSize: 12.5 }}><Evidence row={r} /></div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav(`/practice?subtopic=${encodeURIComponent(r.links[0].id)}`)}>
              {t('hsc.practise')}<span className="sr-only"> {r.focusArea}</span>
            </button>
          </div>
        )) : <p className="muted" style={{ margin: 0 }}>{t('hsc.practiseNextNone')}</p>}
        {Number(user?.year) === 12 && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={buildPaper} disabled={busy} data-hsc-paper>
              {busy ? t('hsc.paperBuilding') : t('hsc.paperBuild')}
            </button>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 12.5 }}>{t('hsc.paperHow')}</p>
            {error && <p role="alert" style={{ margin: '6px 0 0' }}>{error}</p>}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 6 }}>{t('hsc.rankedTitle', { course: t(COURSE_KEY[course]) })}</h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>{t('hsc.rankedHow', { total: result.paperMarks })}</p>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {result.priorities.map(p => {
            const row = byCode[p.code];
            return (
              <li key={p.code} className="prio-item" style={{ alignItems: 'flex-start' }} data-hsc-outcome={p.code}>
                <span className="prio-rank">{p.rank}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15 }}>
                    {p.focusArea} <span className="muted">· {p.code} · {t('common.yearNumber', { n: p.year })}</span>
                    {p.novelty > 0 && <span className="tag" style={{ marginLeft: 8 }}>{t('hsc.newContent')}</span>}
                  </div>
                  <div style={{ fontSize: 13 }}>{t('hsc.marksBand', { lo: Math.floor(ranges[p.code].low * result.paperMarks), hi: Math.ceil(ranges[p.code].high * result.paperMarks), total: result.paperMarks })}</div>
                  {p.styles.length > 0 && <div className="muted" style={{ fontSize: 12.5 }}>{t('hsc.likelyStyles', { styles: styleText(t, p) })}</div>}
                  <div className="muted" style={{ fontSize: 12.5 }}>{t('hsc.yourPractice')} <Evidence row={row} /></div>
                  <details style={{ marginTop: 4 }}>
                    <summary className="tap-row" style={{ cursor: 'pointer', fontSize: 12.5 }}>{t('hsc.why')}<span className="sr-only"> {p.focusArea}</span></summary>
                    <Reasons p={p} paperMarks={result.paperMarks} />
                  </details>
                </div>
                {row.links.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => nav(`/practice?subtopic=${encodeURIComponent(row.links[0].id)}`)}>
                    {t('hsc.practise')}<span className="sr-only"> {p.focusArea}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="card">
        <details>
          <summary className="tap-row" style={{ cursor: 'pointer' }}><span className="card-title" style={{ margin: 0 }}>{t('hsc.methodTitle')}</span></summary>
          <p style={{ fontSize: 13.5 }}>{t('hsc.method1', { from: years[0], to: years[years.length - 1] })}</p>
          <p style={{ fontSize: 13.5 }}>{t('hsc.method2', { history: pct(result.weights.history), sample: pct(result.weights.sample), syllabus: pct(result.weights.syllabus) })}</p>
          <p style={{ fontSize: 13.5 }}>{result.history.beatsBaselines ? t('hsc.method3Beats') : t('hsc.method3Baseline')}</p>
          <p style={{ fontSize: 13.5 }}>{t('hsc.method4')}</p>
          {untagged.map(u => <p key={u.year} className="muted" style={{ fontSize: 13 }}>{t('hsc.untagged', { year: u.year })}</p>)}
          <p className="tap-row" style={{ fontSize: 13.5 }}>
            <a href={NESA_PAPERS[course]} target="_blank" rel="noopener noreferrer">{t('hsc.nesaPapers')}</a>
          </p>
        </details>
      </div>
    </div>
  );
}
