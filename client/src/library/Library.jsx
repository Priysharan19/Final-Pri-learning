// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the resource library — /library and /library/:id
//
// ADR-0002 plan F1: one library for both editions. Papers, worked solutions and
// study notes published elsewhere, each linked to where it lives and each saying
// in plain words how far Pri has checked it (ADR-0002 §7): an 'uploaded' paper
// is "Paper to read — not marked by Pri". Nothing on this page marks anything.
//
// The server decides what this student may see (signed in; published; this
// deployment's edition); this page searches and filters that list and shows
// one resource with its source, attribution, rights note and disclaimer.
//
// Ships dark: the route and its navigation entry exist only where the build
// flag PRI_FEATURE_LIBRARY is on (client/src/platform/features.js).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { useT } from '../i18n/index.js';
import {
  certificationKey, courseKey, filterResources, isResourceId, libraryApi, safeExternalUrl, typeKey, workingTime
} from './libraryApi.js';
import './library.css';

const ERROR_KEYS = {
  AUTH_REQUIRED: 'library.signedOut',
  CLOUD_DISABLED: 'library.offline',
  RESOURCE_NOT_FOUND: 'library.notFound',
  GUARDIAN_CONSENT_PENDING: 'library.consentRequired',
  GUARDIAN_CONSENT_WITHDRAWN: 'library.consentRequired'
};
const errorKey = (code) => ERROR_KEYS[code] || 'library.loadFailed';

function Certification({ state, t }) {
  return <p className="lib-cert" data-certification={state}>{t(certificationKey(state))}</p>;
}

function Facts({ r, t }) {
  const time = workingTime(r.durationMinutes);
  const course = courseKey(r.course);
  return (
    <dl className="lib-facts">
      <div><dt>{t('library.typeLabel')}</dt><dd>{t(typeKey(r.type))}</dd></div>
      <div><dt>{t('library.subjectLabel')}</dt><dd>{r.subject}</dd></div>
      <div><dt>{t('library.yearLabel')}</dt><dd>{r.year}</dd></div>
      {r.grade && <div><dt>{t('library.levelLabel')}</dt><dd>{r.grade}</dd></div>}
      {course && <div><dt>{t('library.courseLabel')}</dt><dd>{t(course)}</dd></div>}
      {Number.isInteger(r.marks) && <div><dt>{t('library.marksLabel')}</dt><dd>{t('library.marks', { count: r.marks, n: r.marks })}</dd></div>}
      {Number.isInteger(r.questionCount) && <div><dt>{t('library.questionsLabel')}</dt><dd>{t('library.questions', { count: r.questionCount, n: r.questionCount })}</dd></div>}
      {time && <div><dt>{t('library.timeLabel')}</dt><dd>{t(time.key, { count: time.n, n: time.n })}
        {Number.isInteger(r.readingMinutes) && r.readingMinutes > 0 && <span className="in-note lib-sub">{t('library.reading', { count: r.readingMinutes, n: r.readingMinutes })}</span>}
      </dd></div>}
    </dl>
  );
}

function Detail({ id, t }) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let live = true;
    if (!isResourceId(id)) { setState({ status: 'error', code: 'RESOURCE_NOT_FOUND' }); return undefined; }
    libraryApi.read(id)
      .then(data => { if (live) setState({ status: 'ready', resource: data.resource }); })
      .catch(err => { if (live) setState({ status: 'error', code: err?.code || null }); });
    return () => { live = false; };
  }, [id]);

  const back = <PageLink to="/library" className="btn btn-ghost lib-back">{t('library.back')}</PageLink>;
  if (state.status === 'loading') return <div className="lib-page">{back}<p role="status">{t('library.loading')}</p></div>;
  if (state.status === 'error') {
    return <div className="lib-page">{back}<p className="lib-honest" role="alert" data-library-error={state.code || 'unknown'}>{t(errorKey(state.code))}</p></div>;
  }
  return (
    <div className="lib-page" data-library-detail={state.resource.id}>
      {back}
      <ResourceView r={state.resource} t={t} />
    </div>
  );
}

/** One resource, as drawn on its page. Exported for client/test/library-ui-check.mjs. */
export function ResourceView({ r, t }) {
  const url = safeExternalUrl(r.url);
  return (
    <article className="lib-detail" aria-labelledby="lib-detail-title">
      {/* i18n-exempt-start: a resource's own title, subtitle and description, as its publisher wrote them */}
      <h1 id="lib-detail-title">{r.title}</h1>
      {r.subtitle && <p className="lib-subtitle">{r.subtitle}</p>}
      <Certification state={r.certificationState} t={t} />
      <p>{r.description}</p>
      {/* i18n-exempt-end */}
      <Facts r={r} t={t} />
      {url && (
        <p className="lib-open">
          <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer" data-testid="library-open">{t('library.openExternal', { source: r.source })}</a>
          <span className="in-note lib-sub">{t('library.externalNote', { source: r.source })}</span>
        </p>
      )}
      <dl className="lib-provenance">
        <div><dt>{t('library.syllabusLabel')}</dt><dd>{r.syllabusVersion || t('library.syllabusNone')}</dd></div>
        <div><dt>{t('library.sourceLabel')}</dt><dd>{r.source}</dd></div>
        <div><dt>{t('library.attributionLabel')}</dt><dd>{r.attribution}</dd></div>
        <div><dt>{t('library.rightsLabel')}</dt><dd>{r.rightsNote}</dd></div>
      </dl>
      <section className="lib-disclaimer" aria-labelledby="lib-disclaimer-title">
        <h2 id="lib-disclaimer-title">{t('library.disclaimerLabel')}</h2>
        <p>{r.disclaimer}</p>
      </section>
    </article>
  );
}

function Select({ id, label, value, onChange, options, t }) {
  return (
    <div className="lib-filter">
      <label className="label" htmlFor={id}>{label}</label>
      <select className="input" id={id} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{t('library.any')}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const NO_FILTERS = { q: '', type: '', subject: '', year: '', course: '' };

function Browse({ t }) {
  const [state, setState] = useState({ status: 'loading' });
  const [filters, setFilters] = useState(NO_FILTERS);
  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const data = await libraryApi.list();
      setState({ status: 'ready', resources: data.resources || [], facets: data.facets || {}, hasMore: !!data.hasMore });
    } catch (err) {
      setState({ status: 'error', code: err?.code || null });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (state.status === 'ready' ? filterResources(state.resources, filters) : []), [state, filters]);
  const set = key => value => setFilters(f => ({ ...f, [key]: value }));
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="lib-page">
      <h1>{t('library.title')}</h1>
      <p className="in-note">{t('library.lead')}</p>
      {state.status === 'loading' && <p role="status">{t('library.loading')}</p>}
      {state.status === 'error' && (
        <div className="lib-honest" role="alert" data-library-error={state.code || 'unknown'}>
          <p>{t(errorKey(state.code))}</p>
          {state.code !== 'AUTH_REQUIRED' && <button type="button" className="btn btn-ghost" onClick={load}>{t('library.retry')}</button>}
        </div>
      )}
      {state.status === 'ready' && state.resources.length === 0 && (
        <p className="lib-honest" data-library-empty="all">{t('library.emptyAll')}</p>
      )}
      {state.status === 'ready' && state.resources.length > 0 && (
        <>
          <form className="lib-search" role="search" onSubmit={e => e.preventDefault()}>
            <div className="lib-filter lib-filter-q">
              <label className="label" htmlFor="lib-q">{t('library.searchLabel')}</label>
              <input id="lib-q" className="input" type="search" maxLength={120} autoComplete="off"
                placeholder={t('library.searchPlaceholder')} value={filters.q} onChange={e => set('q')(e.target.value)} />
            </div>
            <Select id="lib-type" label={t('library.typeLabel')} value={filters.type} onChange={set('type')} t={t}
              options={(state.facets.types || []).map(v => ({ value: v, label: t(typeKey(v)) }))} />
            <Select id="lib-subject" label={t('library.subjectLabel')} value={filters.subject} onChange={set('subject')} t={t}
              options={(state.facets.subjects || []).map(v => ({ value: v, label: v }))} />
            <Select id="lib-year" label={t('library.yearLabel')} value={filters.year} onChange={set('year')} t={t}
              options={(state.facets.years || []).map(v => ({ value: String(v), label: String(v) }))} />
            {(state.facets.courses || []).length > 1 && (
              <Select id="lib-course" label={t('library.courseLabel')} value={filters.course} onChange={set('course')} t={t}
                options={state.facets.courses.map(v => ({ value: v, label: t(courseKey(v)) }))} />
            )}
            {filtered && <button type="button" className="btn btn-ghost lib-clear" onClick={() => setFilters(NO_FILTERS)}>{t('library.clear')}</button>}
          </form>
          <p className="in-note" role="status" aria-live="polite">{t('library.count', { count: shown.length, n: shown.length })}</p>
          {shown.length === 0
            ? <p className="lib-honest" data-library-empty="match">{t('library.emptyMatch')}</p>
            : (
              <ul className="lib-list">
                {shown.map(r => (
                  <li key={r.id} className="lib-item" data-library-resource={r.id}>
                    <PageLink to={`/library/${r.id}`} className="lib-item-link">
                      {/* i18n-exempt-start: a resource's own title and subtitle, as its publisher wrote them */}
                      <span className="lib-item-title">{r.title}</span>
                      {r.subtitle && <span className="lib-item-sub">{r.subtitle}</span>}
                      {/* i18n-exempt-end */}
                      <span className="lib-item-meta">
                        <span>{t(typeKey(r.type))}</span>
                        <span>{r.year}</span>
                        <span>{r.subject}</span>
                      </span>
                    </PageLink>
                    <Certification state={r.certificationState} t={t} />
                  </li>
                ))}
              </ul>
            )}
          {state.hasMore && <p className="in-note">{t('library.more')}</p>}
        </>
      )}
    </div>
  );
}

export default function Library() {
  const t = useT();
  const { id } = useParams();
  return id ? <Detail id={id} t={t} /> : <Browse t={t} />;
}
