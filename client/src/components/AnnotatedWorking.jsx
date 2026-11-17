// Pri Learning · annotated working: numbered comments and the evaluation.
//
// Renders buildAnnotatedWorking()'s data. Two parts:
//   · AnnotatedComments — one numbered card per line, in line order, beside
//     the ink on a wide screen and below it on a phone. The number matches the
//     marker drawn on the student's own ink (InkAnswer lineMarkers). Each card
//     states its status in words and with a shape, never colour alone.
//   · AnnotatedEvaluation — the marks exactly as the server's receipt states
//     them, a summary made of facts, and the evidence rows (no marks of their
//     own while method marks are off).
// The list is the accessible source: the markers on the ink are decoration.
import React, { useEffect, useMemo } from 'react';
import { MathText } from '../lib/latex.jsx';
import Icon from './Icon.jsx';
import { useT } from '../i18n/index.js';
import { buildAnnotatedWorking } from './annotatedWorkingModel.js';
import './AnnotatedWorking.css';

const STATUS_ICON = { checked: 'check', 'first-error': 'correction', follows: 'arrowRight', 'not-verified': 'uncertain', unread: 'uncertain' };
const listOf = ns => ns.join(', ');

function RuleLine({ rule, t }) {
  const where = rule.scope === 'numerator' || rule.scope === 'denominator' || rule.scope === 'both' ? t(`aw.scope.${rule.scope}`) : '';
  return (
    <div className="aw-rule" data-aw-rule={rule.rule}>
      <b>{t(`aw.rule.${rule.rule}`)}</b>{where ? <> {where}</> : null}
      {rule.latex && <div className="aw-tex"><MathText text={`$${rule.latex}$`} /></div>}
    </div>
  );
}

function CardBody({ card, model, t, renderBreakDetail }) {
  if (card.status === 'unread') return <p>{t('aw.body.unread')}</p>;
  if (card.status === 'not-verified') return <p>{t('aw.body.notVerified')}</p>;
  if (card.status === 'first-error') {
    return (
      <>
        <p>{card.n > 1 ? t('aw.body.firstError', { n: card.n - 1 }) : t('aw.body.firstErrorStart')}</p>
        {card.diagnosis?.title && <p className="aw-diag"><b>{card.diagnosis.title}</b>{card.diagnosis.message ? <> — {card.diagnosis.message}</> : null}</p>}
        {!card.diagnosis && card.note && <p className="aw-diag">{card.note}</p>}
        {card.diagnosis?.fix && <p className="aw-fix">{card.diagnosis.fix}</p>}
        {renderBreakDetail && card.previousText ? renderBreakDetail(card.previousText, card.text) : null}
      </>
    );
  }
  if (card.status === 'follows') {
    const first = model.cards.find(c => c.status === 'first-error');
    return (
      <>
        <p>{t('aw.body.follows', { n: card.followsFrom, e: first?.n ?? card.followsFrom })}</p>
        {card.rules.map(r => <RuleLine key={r.rule} rule={r} t={t} />)}
      </>
    );
  }
  if (card.start) return <p>{t(model.proof ? 'aw.body.startProof' : 'aw.body.start')}</p>;
  if (card.same) return <p>{t('aw.body.same', { n: card.n - 1 })}</p>;
  if (!card.rules.length) return <p>{t(card.more ? 'aw.body.jump' : 'aw.body.unnamed', { n: card.n - 1 })}</p>;
  return (
    <>
      {card.rules.map(r => <RuleLine key={r.rule} rule={r} t={t} />)}
      {card.more && <p className="aw-more">{t('aw.body.more')}</p>}
    </>
  );
}

export function AnnotatedComments({ model, renderBreakDetail = null }) {
  const t = useT();
  if (!model) return null;
  return (
    <section className="aw-comments" aria-labelledby="aw-comments-title" data-annotated-working={model.cards.length}>
      <h3 id="aw-comments-title" className="aw-h">{t('aw.title')}</h3>
      <ol className="aw-cards">
        {model.cards.map(card => (
          <li key={card.n} className={`aw-card is-${card.status}`} data-aw-card={card.n} data-aw-status={card.status}>
            <div className="aw-head">
              <span className="aw-num" aria-hidden="true">{card.n}</span>
              <span className="aw-status">
                <Icon name={STATUS_ICON[card.status]} size={14} />
                {card.status === 'follows' ? t('aw.status.follows', { n: card.followsFrom }) : t(`aw.status.${card.status}`)}
              </span>
              <span className="aw-line">{t('aw.line', { n: card.n })}</span>
            </div>
            <div className="aw-body"><CardBody card={card} model={model} t={t} renderBreakDetail={renderBreakDetail} /></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function AnnotatedEvaluation({ model }) {
  const t = useT();
  if (!model) return null;
  const { marks, summary, criteria, jumps, source } = model;
  return (
    <section className="aw-eval" aria-labelledby="aw-eval-title" data-aw-summary={summary.key}>
      <div className="aw-eval-head">
        <h3 id="aw-eval-title" className="aw-h">{t('aw.eval.title')}</h3>
        {marks && <b className="aw-marks" data-aw-marks={`${marks.awarded}/${marks.possible}`}>{t('verdict.marksOutOf', { earned: marks.awarded, total: marks.possible })}</b>}
      </div>
      <p className="aw-provenance">{t(source === 'handwriting' ? 'aw.eval.provenanceInk' : 'aw.eval.provenanceTyped')}</p>
      <p className="aw-summary">{t(summary.key, { ...summary.vars, count: summary.vars.rules ?? summary.vars.checked })}</p>
      {jumps.length > 0 && <p className="aw-jumps">{t('aw.eval.jumps', { list: listOf(jumps), count: jumps.length })}</p>}
      {criteria.length > 0 && (
        <table className="criteria-table aw-criteria">
          <caption>{t('aw.criteria.caption')}</caption>
          <thead><tr><th scope="col">{t('aw.criteria.criterion')}</th><th scope="col">{t('aw.criteria.evidence')}</th></tr></thead>
          <tbody>
            {criteria.map((c, i) => (
              <tr key={i} className={c.lines.length ? 'is-found' : 'is-missing'} data-aw-evidence={c.lines.length ? 'found' : 'missing'}>
                <td>{c.kind === 'reaches-rhs' ? t('aw.criteria.reachesRhs') : <MathText text={c.text} />}</td>
                <td>
                  <Icon name={c.lines.length ? 'check' : 'uncertain'} size={13} />{' '}
                  {c.lines.length ? t('aw.criteria.found', { list: listOf(c.lines), count: c.lines.length }) : t('aw.criteria.notFound')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {criteria.length > 0 && <p className="aw-note">{t('aw.criteria.note')}</p>}
    </section>
  );
}

/**
 * The lazily loaded entry (QuestionCard imports this file on demand): builds
 * the model from the marked attempt and renders one part of it. `onModel`
 * tells the card whether there is a panel, so it can number the ink and
 * stand the comments beside it.
 */
export default function AnnotatedWorkingPart({ part, input, onModel = null, renderBreakDetail = null }) {
  const model = useMemo(() => { try { return input ? buildAnnotatedWorking(input) : null; } catch { return null; } }, [input]);
  useEffect(() => { onModel?.(model); }, [model, onModel]);
  if (!model) return null;
  if (part === 'comments') return <AnnotatedComments model={model} renderBreakDetail={renderBreakDetail} />;
  if (part === 'evaluation') return <AnnotatedEvaluation model={model} />;
  return <><AnnotatedComments model={model} renderBreakDetail={renderBreakDetail} /><AnnotatedEvaluation model={model} /></>;
}
