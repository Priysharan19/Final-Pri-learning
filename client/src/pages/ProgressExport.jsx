// The progress export's buttons and print sheet (plan F5), under the Progress
// page. It reads through api and shows nothing the page does not.
import React, { useCallback, useEffect, useState } from 'react';
import ExportActions from '../components/ExportActions.jsx';
import { exportProgress } from '../lib/exportProgress.js';
import { useT } from '../i18n/index.js';
import { featureEnabled } from '../platform/features.js';

export default function ProgressExport({ user }) {
  const t = useT();
  const [data, setData] = useState(null);
  const on = featureEnabled('exports');
  const compose = useCallback(async () => { const d = await exportProgress(user); setData(d); return d; }, [user]);
  useEffect(() => { if (on) compose().catch(() => { }); }, [on, compose]);
  if (!on) return null;
  return (
    <ExportActions fileName={`progress-${user?.name || 'me'}`} title={t('export.progressTitle')} compose={compose}>
      <p>{t('export.progressNote')}</p>
      <ul>
        {(data?.chapters || []).map(c => <li key={c.id}>{t('export.chapterRow', { name: c.name, attempts: c.attempts, correct: c.correct })}</li>)}
      </ul>
      {data && !data.exams.length && <p>{t('export.noExams')}</p>}
      <ul>
        {(data?.exams || []).map((e, i) => <li key={i}>{e.score != null && e.total != null ? t('export.examRow', { title: e.title, score: e.score, total: e.total }) : e.title}</li>)}
      </ul>
    </ExportActions>
  );
}
