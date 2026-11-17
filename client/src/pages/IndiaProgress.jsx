import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { tLater, useT } from '../i18n/index.js';
import PageLink from '../components/PageLink.jsx';
import EvidenceProgress from '../progress/EvidenceProgress.jsx';
import SyllabusBoard from '../progress/SyllabusBoard.jsx';
import { indiaProgressPracticeHref } from '../lib/practiceLinks.js';
import { featureEnabled } from '../platform/features.js';

function scopeFor(curriculum, user) {
  if (!curriculum) return null;
  const track = user.indiaTrack || 'cbse';
  if (track === 'cbse') return (curriculum.years || []).find(s => Number(s.year) === Number(user.year)) || null;
  return (curriculum.streams || []).find(s => s.track === track && (s.year == null || Number(s.year) === Number(user.year)))
    || (curriculum.streams || []).find(s => s.track === track)
    || null;
}

const rowsFor = scope => scope?.chapters || scope?.subtopics || [];

/**
 * A Priyabhata student's Progress: the shared evidence page over their own
 * track's chapters (progress/EvidenceProgress.jsx). Nothing on it stands in for
 * a mark; chapters name themselves and Practise opens that chapter.
 */
export default function IndiaProgress() {
  const { user } = useApp();
  const nav = useNavigate();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/curriculum'), api.get('/progress/evidence')])
      .then(([c, e]) => { setCurriculum(c); setEvidence(e); })
      .catch(err => setError(err.message || tLater('progress.couldNotLoad')));
  }, [t]);

  const scope = useMemo(() => scopeFor(curriculum, user), [curriculum, user]);
  const rows = useMemo(() => rowsFor(scope).map(r => ({ id: r.id, name: r.name || r.title, strand: r.strand })), [scope]);
  // "JEE Main" and "JEE Advanced" are the examining bodies' own names and stay untranslated.
  const trackName = user.indiaTrack === 'jee-main' ? 'JEE Main'
    : user.indiaTrack === 'jee-advanced' ? 'JEE Advanced'
      : `${t('common.classNumber', { n: user.year })} CBSE / NCERT`;

  if (error) return <div className="card" role="alert">{error}</div>;
  if (!curriculum || !evidence) return <div className="skeleton" style={{ height: 420 }} />;

  return (
    <>
      {featureEnabled('placement') && <div className="card" data-placement-entry>
        <div className="spread" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 640 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>{t('placement.progressTitle')}</div>
            <p className="muted" style={{ margin: 0 }}>{t('placement.progressBody')}</p>
          </div>
          <button className="btn btn-ghost" onClick={() => nav('/placement')}>{t('placement.seeResult')}</button>
        </div>
      </div>}
      <EvidenceProgress
        evidence={evidence}
        rows={rows}
        scope={scope?.title || trackName}
        practiseTo={row => indiaProgressPracticeHref(row, user.indiaTrack)}
        teacher={user.role === 'teacher'}
      >
        {featureEnabled('syllabusBoard') && <SyllabusBoard user={user} india trackName={scope?.title || trackName} />}
      </EvidenceProgress>
      <p className="pg-coverage-note"><PageLink to="/insights" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }} data-insights-link>{t('insights.open')} →</PageLink></p>
    </>
  );
}
