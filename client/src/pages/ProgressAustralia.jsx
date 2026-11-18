import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { tLater, useT } from '../i18n/index.js';
import EvidenceProgress from '../progress/EvidenceProgress.jsx';
import SyllabusBoard from '../progress/SyllabusBoard.jsx';
import { featureEnabled } from '../platform/features.js';
import { hscCoursesFor } from '../engine/hscCourses.js';
import { offeredChapters } from '../engine/curriculumAvailability.js';

// The HSC 2027 priorities (Prithagoras, Years 11–12): its own on-demand chunk
// with the NESA metadata behind it (vite.config.js 'hsc-priorities').
const HscPriorities = React.lazy(() => import('../hsc/HscPriorities.jsx'));

/**
 * A Prithagoras student's Progress: the same evidence page as Priyabhata's
 * (progress/EvidenceProgress.jsx) over the topics of their year or Stage 6
 * course. It replaces an earlier page that drew figures the standard does not
 * allow.
 */
export default function ProgressAustralia() {
  const { user } = useApp();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/curriculum'), api.get('/progress/evidence')])
      .then(([c, e]) => { setCurriculum(c); setEvidence(e); })
      .catch(err => setError(err.message || tLater('progress.couldNotLoad')));
  }, [t]);

  const scope = useMemo(() => {
    if (!curriculum) return null;
    const key = user.year >= 11 && user.pathway === 'standard' ? `standard-${user.year}` : `y${user.year}`;
    const core = (curriculum.years || []).map(y => ({ key: `y${y.year}`, title: t('common.yearNumber', { n: y.year }), ...y }));
    const streams = (curriculum.streams || []).map(g => ({ key: g.key, title: g.title, ...g }));
    return [...core, ...streams].find(s => s.key === key) || core[0] || null;
  }, [curriculum, user.year, user.pathway, t]);
  const rows = useMemo(() => offeredChapters(scope?.subtopics).map(s => ({ id: s.id, name: s.name, strand: s.strand })), [scope]);

  const hscCourses = hscCoursesFor(user);

  if (error) return <div className="card" role="alert">{error}</div>;
  if (!curriculum || !evidence) return <div className="skeleton" style={{ height: 420 }} />;

  return (
    <EvidenceProgress
      evidence={evidence}
      rows={rows}
      scope={scope?.title || t('common.yearNumber', { n: user.year })}
      practiseTo={row => `/practice?subtopic=${row.id}`}
      teacher={user.role === 'teacher'}
      ownHeading
    >
      {featureEnabled('syllabusBoard') && <SyllabusBoard user={user} india={false} />}
      {hscCourses.length > 0 && (
        <React.Suspense fallback={<div className="skeleton" style={{ height: 400 }} />}>
          <HscPriorities user={user} courses={hscCourses} curriculum={curriculum} />
        </React.Suspense>
      )}
    </EvidenceProgress>
  );
}
