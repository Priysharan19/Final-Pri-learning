// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Coverage — what the question bank actually covers (§5.1, §5.6)
//
// A public page, reachable before the profile gate like the legal notices,
// that shows per class and per chapter what tools/build-coverage.mjs measured:
// dot points reached, the generators behind them, distinct questions in a
// fixed sample, the source the chapter list was authored against, the review
// tier and the date the content ledger was last verified under.
//
// Everything on it is read from docs/content/coverage-manifest.json, the file
// CI holds equal to the live generators (coverage-manifest-check.mjs). The page
// never measures anything itself: a page that re-counted on load could show a
// number no test had seen.
//
// Honesty rules the copy keeps to, in both languages:
//   · every tier is "automated review"; no sentence suggests a teacher read it;
//   · the sample count is a sample and says so; it is not the bank's size;
//   · "verified" names the ledger date and digest, not today;
//   · chapter names and strands are the mathematics and stay in English under
//     lang="en", the same rule as every other screen (see i18n-check.mjs).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT, useTx } from '../i18n/index.js';
import { formatNumber } from '../lib/locale.js';
import { shortDigest, verifiedMonthOf } from '../engine/provenance.js';
import manifest from '../../../docs/content/coverage-manifest.json';

const TIER_KEY = {
  'source-mapped-automated': 'coverage.tierSourceMapped',
  'reused-generator-automated': 'coverage.tierReused'
};

export default function Coverage() {
  const t = useT();
  const tx = useTx();
  const classes = manifest.classes || [];
  const [grade, setGrade] = useState(classes[0]?.grade ?? 7);
  const current = classes.find(c => c.grade === grade) || classes[0];
  const verifiedMonth = verifiedMonthOf(manifest.verifiedAt);

  const totals = useMemo(() => {
    const all = classes.flatMap(c => c.chapters);
    return {
      chapters: all.length,
      dotpoints: all.reduce((n, ch) => n + ch.dotpoints, 0),
      covered: all.reduce((n, ch) => n + ch.covered, 0),
      distinct: all.reduce((n, ch) => n + ch.sampleDistinct, 0),
      draws: all.reduce((n, ch) => n + ch.sampleDraws, 0)
    };
  }, [classes]);

  if (!current) return null;
  const classTotals = {
    dotpoints: current.chapters.reduce((n, ch) => n + ch.dotpoints, 0),
    covered: current.chapters.reduce((n, ch) => n + ch.covered, 0),
    distinct: current.chapters.reduce((n, ch) => n + ch.sampleDistinct, 0),
    draws: current.chapters.reduce((n, ch) => n + ch.sampleDraws, 0)
  };

  return (
    <div className="qpage" style={{ maxWidth: 920 }} data-coverage-page>
      <h1>{t('coverage.title')}</h1>
      <p className="muted" style={{ maxWidth: 720, lineHeight: 1.5 }}>{t('coverage.intro')}</p>

      <section className="card" aria-labelledby="coverage-ledger-title" style={{ marginTop: 14 }}>
        <h2 id="coverage-ledger-title" style={{ marginBottom: 6, fontSize: 17 }}>{t('coverage.ledgerTitle')}</h2>
        <dl className="coverage-ledger" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 14px', margin: 0 }}>
          <dt className="muted">{t('coverage.verifiedLabel')}</dt>
          <dd style={{ margin: 0 }} data-coverage-verified>{verifiedMonth ? t('coverage.verifiedValue', { month: verifiedMonth, date: manifest.verifiedAt }) : t('coverage.verifiedUnknown')}</dd>
          <dt className="muted">{t('coverage.releaseDigest')}</dt>
          <dd style={{ margin: 0 }}><code data-coverage-release-digest>{manifest.releaseDigest}</code> <span className="muted">· {t('coverage.contentVersion', { version: manifest.contentVersion })}</span></dd>
          <dt className="muted">{t('coverage.totalsLabel')}</dt>
          <dd style={{ margin: 0 }}>{t('coverage.totals', { chapters: formatNumber(totals.chapters), covered: formatNumber(totals.covered), dotpoints: formatNumber(totals.dotpoints), distinct: formatNumber(totals.distinct), draws: formatNumber(totals.draws) })}</dd>
        </dl>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5 }}>{t('coverage.reviewNote')}</p>
      </section>

      <div className="seg-tabs" role="group" aria-label={t('coverage.classPicker')} style={{ marginTop: 18, marginBottom: 12, flexWrap: 'wrap' }}>
        {classes.map(c => (
          <button key={c.grade} type="button" className={`seg-tab${c.grade === grade ? ' on' : ''}`} aria-pressed={c.grade === grade}
            data-coverage-class={c.grade} onClick={() => setGrade(c.grade)}>
            {t('coverage.classTab', { n: c.grade })}
          </button>
        ))}
      </div>

      <section className="card" aria-labelledby="coverage-class-title" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 6px' }}>
          <h2 id="coverage-class-title" style={{ marginBottom: 4, fontSize: 17 }}>{t('coverage.classHeading', { n: current.grade })}</h2>
          <p className="muted" lang="en" style={{ margin: 0, fontSize: 13 }}>{current.caption}</p>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            {t('coverage.classTotals', { covered: formatNumber(classTotals.covered), dotpoints: formatNumber(classTotals.dotpoints), distinct: formatNumber(classTotals.distinct), draws: formatNumber(classTotals.draws) })}
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="coverage-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <caption className="sr-only">{t('coverage.tableCaption', { n: current.grade })}</caption>
            <thead>
              <tr>
                <th scope="col" style={th}>{t('coverage.colChapter')}</th>
                <th scope="col" style={th}>{t('coverage.colDotpoints')}</th>
                <th scope="col" style={th}>{t('coverage.colSample')}</th>
                <th scope="col" style={th}>{t('coverage.colTier')}</th>
                <th scope="col" style={th}>{t('coverage.colVerified')}</th>
              </tr>
            </thead>
            <tbody>
              {current.chapters.map(ch => (
                <tr key={ch.id} data-coverage-chapter={ch.id}>
                  <th scope="row" style={{ ...td, fontWeight: 600 }}>
                    <span lang="en">{ch.name}</span>
                    <span className="muted" lang="en" style={{ display: 'block', fontSize: 12, fontWeight: 400 }}>{ch.strand}{ch.examMarks != null ? ` · ${t('coverage.boardMarks', { n: ch.examMarks })}` : ''}</span>
                  </th>
                  <td style={td}>{t('coverage.dotpointsCell', { covered: ch.covered, total: ch.dotpoints })}</td>
                  <td style={td}>
                    {t('coverage.sampleCell', { distinct: formatNumber(ch.sampleDistinct), draws: formatNumber(ch.sampleDraws) })}
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>{t('coverage.generatorsCell', { n: ch.generators.length, count: ch.generators.length })}</span>
                  </td>
                  <td style={td}>{t(TIER_KEY[ch.tier] || 'coverage.tierReused')}</td>
                  <td style={td}>
                    {verifiedMonth ? t('coverage.verifiedChip', { month: verifiedMonth }) : t('coverage.verifiedUnknown')}
                    <code className="muted" style={{ display: 'block', fontSize: 11.5 }} title={ch.digest}>{shortDigest(ch.digest)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px 14px' }}>
          <h3 style={{ fontSize: 14, margin: '6px 0 4px' }}>{t('coverage.sourcesHeading')}</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            {current.sources.map((s, i) => (
              <li key={i} lang="en">
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a> : s.title}
                {s.note ? <span className="muted"> — {s.note}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="coverage-tiers-title">
        <h2 id="coverage-tiers-title" style={{ marginBottom: 6, fontSize: 17 }}>{t('coverage.tiersHeading')}</h2>
        <dl style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          <dt style={{ fontWeight: 600 }}>{t('coverage.tierSourceMapped')}</dt>
          <dd style={{ margin: '0 0 8px' }}>{t('coverage.tierSourceMappedBody')}</dd>
          <dt style={{ fontWeight: 600 }}>{t('coverage.tierReused')}</dt>
          <dd style={{ margin: 0 }}>{t('coverage.tierReusedBody')}</dd>
        </dl>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.5 }}>
          {tx('coverage.howVerified', { tool: <code>npm run content:certify</code> })}
        </p>
      </section>

      <p className="muted" style={{ marginTop: 18, fontSize: 13 }}>
        <Link to="/">{t('coverage.backHome')}</Link> · <Link to="/privacy">{t('login.privacy')}</Link> · <Link to="/terms">{t('login.terms')}</Link>
      </p>
    </div>
  );
}

const th = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--hairline-strong)', fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600, whiteSpace: 'nowrap' };
const td = { padding: '9px 12px', borderBottom: '1px solid var(--hairline)', verticalAlign: 'top' };
