// Pri Learning · NSW Notes — the parts of one chapter, in the order of Experience 3 of
// the Learning Experience Standard: objective, builds on, intuition, ideas, definitions,
// formulas (boxed), diagrams, worked examples, what examiners look for, traps,
// self-check, and the next step into Practice. A section whose content the chapter does
// not have is left out, never stubbed. Presentation only; no curriculum data.
// The parts both editions share (objective, intuition, diagrams, self-check, next step)
// are in ../NotesParts.jsx.
//
// All mathematics goes through KaTeX (lib/latex.jsx for running text, DisplayMath
// below for display and aligned working). Nothing here builds maths from HTML or
// Unicode super/subscripts. Icons are the app's stroke icons, never emoji or glyph ticks.
import React, { useState } from 'react';
import { MathText } from '../../lib/latex.jsx';
import Icon from '../../components/Icon.jsx';
import DiagramFromSpec from '../../diagrams/DiagramFromSpec.jsx';
import { useT } from '../../i18n/index.js';
import { workingRows, normaliseWorkingTex } from '../workingRows.js';
import { Objective, BuildsOn, Intuition, TeachingDiagrams, SelfCheck } from '../NotesParts.jsx';
import '../notesFonts.css';
import '../notesSheet.css';
import './nswNotes.css';

/** One display equation (or an aligned block). A render error is drawn as KaTeX's own .katex-error span, which the notes checks fail on. */
export function DisplayMath({ tex, className = '' }) {
  // The one escaped sink (lib/latex.jsx), in display style: it also names the formula for a screen reader.
  return <MathText block display className={`nn-display ${className}`.trim()} text={tex} />;
}

export function SectionBlock({ id, title, children }) {
  return (
    <section className="nn-section" id={id} aria-labelledby={`nn-h-${id}`} data-nn-section={id}>
      <h2 className="nn-h" id={`nn-h-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

export function Ideas({ concepts }) {
  return (
    <ol className="nn-ideas">
      {concepts.map((c, i) => (
        <li key={i}>
          <h3 className="nn-idea-t"><span className="nn-idea-n" aria-hidden="true">{i + 1}</span><MathText text={c.title} /></h3>
          <MathText block className="nn-read" text={c.body} />
        </li>
      ))}
    </ol>
  );
}

export function Definitions({ items }) {
  return (
    <dl className="nn-defs">
      {items.map((d, i) => (
        <div key={i}>
          <dt><MathText text={d.term} /></dt>
          <dd><MathText className="nn-read" text={d.meaning} /></dd>
        </div>
      ))}
    </dl>
  );
}

/** Every formula is boxed the same way: a caption, the equation, an optional note. */
export function FormulaBox({ f }) {
  return (
    <figure className="nn-formula">
      <figcaption><MathText text={f.label} /></figcaption>
      <DisplayMath tex={f.tex} />
      {f.note && <MathText block className="nn-formula-note" text={f.note} />}
    </figure>
  );
}

export function Examiners({ items }) {
  return (
    <ul className="nn-examiners">
      {items.map((s, i) => (
        <li key={i}><Icon name="check" size={18} className="nn-ico" /><MathText className="nn-read" text={s} /></li>
      ))}
    </ul>
  );
}

export function Traps({ items }) {
  const t = useT();
  return (
    <ul className="nn-traps">
      {items.map((m, i) => (
        <li key={i}>
          <div className="nn-wrong"><span className="nn-tag"><Icon name="close" size={14} className="nn-ico" />{t('notes.mistakeWrong')}</span><MathText className="nn-read" text={m.wrong} /></div>
          <div className="nn-right"><span className="nn-tag"><Icon name="check" size={14} className="nn-ico" />{t('notes.mistakeRight')}</span><MathText className="nn-read" text={m.right} /></div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The working of an example, set the way a marking guideline sets it: each step's reason in words,
 * then its line of maths, every line aligned on its relation sign in one column and in one maths style
 * (notes/workingRows.js). A row without an `&` is a statement and runs across both columns.
 */
export function Working({ rows }) {
  return (
    <div className="nn-wk" role="group">
      {rows.map((r, i) => (
        <React.Fragment key={i}>
          {r.say && <MathText block className="nn-wk-say" text={r.say} />}
          {r.lhs == null
            ? <div className="nn-wk-line"><DisplayMath tex={normaliseWorkingTex(r.rest)} className="nn-wk-m" /></div>
            : <>
                <div className="nn-wk-l">{r.lhs && <DisplayMath tex={normaliseWorkingTex(r.lhs)} className="nn-wk-m" />}</div>
                <div className="nn-wk-r"><DisplayMath tex={normaliseWorkingTex(r.rest)} className="nn-wk-m" /></div>
              </>}
        </React.Fragment>
      ))}
    </div>
  );
}

/** A worked example. The student sees the problem first and asks for the working one step at a time. */
export function WorkedExample({ ex, n }) {
  const t = useT();
  const [shown, setShown] = useState(0);
  const done = shown >= ex.steps.length;
  const rows = workingRows(ex.working);
  return (
    <div className="nn-example">
      <p className="nn-label">{t('notes.exampleNumber', { n })}</p>
      <MathText block className="nn-read nn-q" text={ex.question} />
      {ex.diagram && <DiagramFromSpec spec={ex.diagram} interactive />}
      {/* Once every step has been asked for, the set-out working replaces the list so the solution is written once. */}
      {!(done && rows.length > 0) && (
        <ol className="nn-steps">
          {ex.steps.slice(0, shown).map((s, i) => <li key={i}><MathText className="nn-read" text={s} /></li>)}
        </ol>
      )}
      {!done ? (
        <div className="nn-more">
          <button type="button" className="btn btn-secondary" onClick={() => setShown(s => s + 1)}>{t('notes.nextStep')}</button>
          <button type="button" className="nt-link-btn" onClick={() => setShown(ex.steps.length)}>{t('notes.allSteps')}</button>
        </div>
      ) : (
        <div className="nn-answer">
          {rows.length > 0 && <><p className="nn-label">{t('notes.nsw.working')}</p><Working rows={rows} /></>}
          <p className="nn-label">{t('notes.answer')}{ex.verify && ' '}{ex.verify && <span className="nn-checked">{t('notes.engineChecked')}</span>}</p>
          <MathText block className="nn-read nn-final" text={ex.answer} />
        </div>
      )}
    </div>
  );
}

/**
 * The body of a chapter, in the order every chapter uses. `buildsOn`: [{ to, label }] for
 * the topics it builds on; `next`: the next step into Practice (NextPractice), always last.
 */
export function ChapterSheet({ notes, topicId, buildsOn = [], next = null }) {
  const t = useT();
  return (
    <div className="nt-sheet" data-chapter-sheet>
      {notes.objective && <SectionBlock id="objective" title={t('notes.sectionObjective')}><Objective text={notes.objective} /></SectionBlock>}
      {buildsOn.length > 0 && <SectionBlock id="prerequisites" title={t('notes.buildsOn')}><BuildsOn links={buildsOn} /></SectionBlock>}
      {notes.intuition && <SectionBlock id="intuition" title={t('notes.sectionIntuition')}><Intuition text={notes.intuition} /></SectionBlock>}
      <SectionBlock id="ideas" title={t('notes.sectionIdeas')}><Ideas concepts={notes.concepts} /></SectionBlock>
      <SectionBlock id="definitions" title={t('notes.sectionDefinitions')}><Definitions items={notes.definitions} /></SectionBlock>
      <SectionBlock id="formulas" title={t('notes.sectionFormulas')}>
        <div className="nn-formulas">{notes.formulas.map((f, i) => <FormulaBox key={i} f={f} />)}</div>
      </SectionBlock>
      {notes.diagrams?.length > 0 && <SectionBlock id="diagram" title={t('notes.sectionDiagrams')}><TeachingDiagrams items={notes.diagrams} /></SectionBlock>}
      <SectionBlock id="examples" title={t('notes.sectionExamples')}>
        {notes.examples.map((ex, i) => <WorkedExample key={topicId + ':' + ex.question} ex={ex} n={i + 1} />)}
      </SectionBlock>
      {notes.examiners?.length > 0 && <SectionBlock id="examiners" title={t('notes.nsw.sectionExaminers')}><Examiners items={notes.examiners} /></SectionBlock>}
      <SectionBlock id="mistakes" title={t('notes.nsw.sectionTraps')}><Traps items={notes.mistakes} /></SectionBlock>
      {notes.check?.length > 0 && <SectionBlock id="check" title={t('notes.sectionCheck')}><SelfCheck items={notes.check} /></SectionBlock>}
      {next && <SectionBlock id="practice" title={t('notes.sectionNext')}>{next}</SectionBlock>}
    </div>
  );
}
