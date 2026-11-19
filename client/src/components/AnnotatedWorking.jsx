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
import { buildAnnotatedWorking, lineRange } from './annotatedWorkingModel.js';
import './AnnotatedWorking.css';

const STATUS_ICON = { incomplete: 'uncertain', condition: 'check', checked: 'check', 'first-error': 'alert', follows: 'arrowRight', 'not-verified': 'uncertain', unread: 'uncertain' };
// Every string key written out, so the catalogue checks can see each one used.
const RULE_KEY = Object.freeze({
  'reciprocal': 'aw.rule.reciprocal',
  'quotient': 'aw.rule.quotient',
  'pythagorean': 'aw.rule.pythagorean',
  'pythagorean-tan': 'aw.rule.pythagoreanTan',
  'pythagorean-cot': 'aw.rule.pythagoreanCot',
  'double-angle-sin': 'aw.rule.doubleAngleSin',
  'double-angle-cos': 'aw.rule.doubleAngleCos',
  'double-angle-cos-cos': 'aw.rule.doubleAngleCosCos',
  'double-angle-cos-sin': 'aw.rule.doubleAngleCosSin',
  'double-angle-tan': 'aw.rule.doubleAngleTan',
  'compound-sin': 'aw.rule.compoundSin',
  'compound-cos': 'aw.rule.compoundCos',
  'compound-tan': 'aw.rule.compoundTan',
  'log-product': 'aw.rule.logProduct',
  'log-quotient': 'aw.rule.logQuotient',
  'log-power': 'aw.rule.logPower',
  'common-denominator': 'aw.rule.commonDenominator',
  'split-fraction': 'aw.rule.splitFraction',
  'divide-fraction': 'aw.rule.divideFraction',
  'multiply-fractions': 'aw.rule.multiplyFractions',
  'cancel-common-factor': 'aw.rule.cancelCommonFactor',
  'index-product': 'aw.rule.indexProduct',
  'index-power': 'aw.rule.indexPower',
  'index-quotient-power': 'aw.rule.indexQuotientPower',
  'expand': 'aw.rule.expand',
  'factorise': 'aw.rule.factorise',
  'difference-of-squares': 'aw.rule.differenceOfSquares',
});
const STATUS_KEY = Object.freeze({ checked: 'aw.status.checked', 'first-error': 'aw.status.firstError', 'not-verified': 'aw.status.notVerified', unread: 'aw.status.unread', condition: 'aw.status.condition', incomplete: 'aw.status.incomplete' });
const SCOPE_KEY = Object.freeze({ numerator: 'aw.scope.numerator', denominator: 'aw.scope.denominator', both: 'aw.scope.both' });
const listOf = ns => ns.join(', ');

export const ruleLabel = (rule, t) => (RULE_KEY[rule.rule] ? t(RULE_KEY[rule.rule]) : rule.rule);

function RuleLine({ rule, t }) {
  const where = SCOPE_KEY[rule.scope] ? t(SCOPE_KEY[rule.scope]) : '';
  return (
    <div className="aw-rule" data-aw-rule={rule.rule}>
      <span className="aw-chip">{RULE_KEY[rule.rule] ? t(RULE_KEY[rule.rule]) : rule.rule}</span>{where ? <span className="aw-where"> {where}</span> : null}
      {rule.latex && <div className="aw-tex"><MathText text={`$${rule.latex}$`} /></div>}
    </div>
  );
}

export function CardBody({ card, model, t, renderBreakDetail }) {
  if (card.status === 'unread') return <p>{t('aw.body.unread')}</p>;
  if (card.valueChain === 'given') return <p>{t('aw.body.given')}</p>;
  if (card.valueChain === 'verified') return <p>{t('aw.body.valueVerified')}</p>;
  if (card.status === 'incomplete') return <p>{card.note}</p>;
  if (card.status === 'condition') return <p>{t('aw.body.condition')}</p>;
  // The lines of a value-chain report that were not verified share one reason, said once below the cards.
  if (card.status === 'not-verified' && model.unverified) return null;
  if (card.status === 'not-verified') return <p>{t('aw.body.notVerified')}</p>;
  if (card.status === 'first-error') {
    return (
      <>
        <p>{card.n > 1 ? t('aw.body.firstError', { n: card.n - 1 }) : t('aw.body.firstErrorStart')}</p>
        {card.diagnosis?.title && <p className="aw-diag"><b>{card.diagnosis.title}</b>{card.diagnosis.message ? <>: {card.diagnosis.message}</> : null}</p>}
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
  if (card.start) return <p>{t(!model.proof ? 'aw.body.start' : card.startSide === 'rhs' ? 'aw.body.startRhs' : 'aw.body.startProof')}</p>;
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
                {card.status === 'follows' ? t('aw.status.follows', { n: card.followsFrom }) : t(STATUS_KEY[card.status])}
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
  const { marks, summary, criteria, jumps, followThrough = [], source, attempt } = model;
  return (
    <section className="aw-eval" aria-labelledby="aw-eval-title" data-aw-summary={summary.key}>
      <div className="aw-eval-head">
        <h3 id="aw-eval-title" className="aw-h">{t('aw.eval.title')}</h3>
        {marks && <b className="aw-marks" data-aw-marks={`${marks.awarded}/${marks.possible}`}>{t('aw.eval.marksConfirmed', { earned: marks.awarded, total: marks.possible })}</b>}
      </div>
      {attempt && <p className="aw-attempt" data-aw-attempt={attempt}>{t('aw.eval.markedAgain', { n: attempt })}</p>}
      {marks?.receiptId && <p className="aw-receipt">{t('aw.eval.receipt', { id: marks.receiptId })}</p>}
      <p className="aw-provenance">{t(model.allChecked === false ? (source === 'handwriting' ? 'aw.eval.provenanceSomeInk' : 'aw.eval.provenanceSome') : (source === 'handwriting' ? 'aw.eval.provenanceInk' : 'aw.eval.provenanceTyped'))}</p>
      {model.unverified && <p className="aw-unverified" data-aw-unverified={model.unverified.lines.join(',')}>{t('aw.eval.unverifiedRun', { list: listOf(model.unverified.lines), count: model.unverified.lines.length })}</p>}
      <p className="aw-summary">{t(summary.key, { ...summary.vars, count: summary.vars.rules ?? summary.vars.checked })}</p>
      {followThrough.length > 0 && <p className="aw-follow" data-aw-follow-through={followThrough.join(',')}>{t('aw.eval.followThrough', { list: lineRange(followThrough), count: followThrough.length })}</p>}
      {jumps.length > 0 && <p className="aw-jumps">{t('aw.eval.jumps', { list: listOf(jumps), count: jumps.length })}</p>}
      {criteria.length > 0 && (
        <table className="criteria-table aw-criteria">
          <caption>{t('aw.criteria.caption')}</caption>
          <thead><tr><th scope="col">{t('aw.criteria.criterion')}</th><th scope="col">{t('aw.criteria.evidence')}</th></tr></thead>
          <tbody>
            {criteria.map((c, i) => (
              <tr key={i} className={c.lines.length ? 'is-found' : c.followThrough ? 'is-pending' : 'is-missing'} data-aw-evidence={c.lines.length ? 'found' : c.followThrough ? 'not-counted' : 'missing'}>
                <td>{c.kind === 'reaches-rhs' ? t('aw.criteria.reachesRhs') : <MathText text={c.text} />}</td>
                <td>
                  {c.lines.length > 0 ? (
                    <><span className="aw-met"><Icon name="check" size={13} /> {t('aw.criteria.met')}</span>
                      <span className="aw-evlines"> · {t('aw.criteria.found', { list: listOf(c.lines), count: c.lines.length })}</span></>
                  ) : c.followThrough ? (
                    <><span className="aw-met"><Icon name="clock" size={13} /> {t('aw.criteria.notCounted')}</span>
                      <span className="aw-evlines"> · {t('aw.criteria.found', { list: listOf(c.followThrough), count: c.followThrough.length })}</span></>
                  ) : (
                    <span className="aw-met"><Icon name="uncertain" size={13} /> {t('aw.criteria.notShown')}</span>
                  )}
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
