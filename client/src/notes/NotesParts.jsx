// Pri Learning · Notes — the presentational parts shared by every edition's
// notes pages (the India notes in pages/Notes.jsx and the NSW notes in
// pages/NswNotes.jsx). Pure presentation: no curriculum data is imported here,
// so the NSW page can use these without any India code reaching its bundle.
//
// The Experience 3 parts (objective, builds on, intuition, teaching diagrams, the
// checkpoint, the next step into Practice) are here too, so both editions draw them
// the same way, in CMU Serif (notesFonts.css) with the maths in KaTeX.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { ReadableFormula } from '../lib/ReadableFormula.jsx';
import PageLink from '../components/PageLink.jsx';
import StudyDiagram from './StudyDiagram.jsx';
import DiagramFromSpec from '../diagrams/DiagramFromSpec.jsx';
import { useT } from '../i18n/index.js';
import './notesFonts.css';
import './notesSheet.css';

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Adds `is-in` to every `.nt-reveal` under `root` as it scrolls into view. */
export function useReveal(rootRef, deps) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const items = [...root.querySelectorAll('.nt-reveal:not(.is-in)')];
    if (reducedMotion() || typeof IntersectionObserver !== 'function') {
      for (const el of items) el.classList.add('is-in');
      return undefined;
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (const el of items) io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function Section({ id, title, children }) {
  return (
    <section className="nt-section" id={id} aria-labelledby={`nt-s-${id}`} data-nn-section={id}>
      <h2 className="nt-section-h nt-reveal" id={`nt-s-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

// ── Experience 3 parts, shared by both editions ───────────────────────────────

/** What the student can do at the end: one sentence. */
export function Objective({ text }) {
  return <MathText block className="nn-read nn-objective" text={text} />;
}

/** The chapters this one builds on, each a link to its notes. `links`: [{ to, label, sub? }]. */
export function BuildsOn({ links }) {
  return (
    <ul className="nn-builds">
      {links.map(l => (
        <li key={l.to}><PageLink to={l.to}>{l.label}{l.sub ? <small>{l.sub}</small> : null}</PageLink></li>
      ))}
    </ul>
  );
}

/** The picture or the reason before the formalism. A blank line starts a new paragraph. */
export function Intuition({ text }) {
  const paras = String(text).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return (
    <div className="nn-intuition">
      {paras.map((p, i) => <MathText key={i} block className="nn-read" text={p} />)}
    </div>
  );
}

/** A diagram title is set quietly: inline-size maths, no stretched brackets (\dfrac -> \tfrac, \left( -> plain). */
export const quietTitle = t => String(t).replace(/\\dfrac/g, '\\tfrac').replace(/\\left\s*([([|])/g, '$1').replace(/\\right\s*([)\]|])/g, '$1');

/** Teaching diagrams from the kit, each with the note that says what to look at. Interactive kinds stay interactive here. */
export function TeachingDiagrams({ items }) {
  return (
    <div className="nn-diagrams">
      {items.map((d, i) => (
        <div key={i} className="nn-diagram">
          {d.title && <h3 className="nn-diagram-t"><MathText text={quietTitle(d.title)} /></h3>}
          <DiagramFromSpec spec={d.spec} interactive />
          {d.note && <MathText block className="nn-diagram-note" text={d.note} />}
        </div>
      ))}
    </div>
  );
}

/** The checkpoint: each question first, its answer only when the student asks (a real button, aria-expanded). */
export function SelfCheck({ items }) {
  const t = useT();
  const [open, setOpen] = useState(() => new Set());
  const toggle = i => setOpen(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <ol className="nn-check">
      {items.map((c, i) => {
        const isOpen = open.has(i);
        return (
          <li key={i}>
            <MathText block className="nn-read nn-q" text={c.question} />
            <button type="button" className="nt-link-btn" aria-expanded={isOpen} aria-controls={`nn-a-${i}`} onClick={() => toggle(i)}>
              {isOpen ? t('notes.hideAnswer') : t('notes.showAnswer')}
            </button>
            <div id={`nn-a-${i}`} hidden={!isOpen} className="nn-check-a"><MathText block className="nn-read" text={c.answer} /></div>
          </li>
        );
      })}
    </ol>
  );
}

/** The next step into Practice: what it will practise (the chapter and the course or year), an optional note, and the action. */
export function NextPractice({ what, note = null, children }) {
  return (
    <div className="nn-next">
      <p className="nn-read nn-next-what">{what}</p>
      {note && <p className="nn-next-note">{note}</p>}
      {children}
    </div>
  );
}

export function Concepts({ concepts }) {
  const t = useT();
  const [open, setOpen] = useState(() => new Set([0]));
  const allOpen = open.size === concepts.length;
  const toggle = (i) => setOpen(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <>
      <button type="button" className="nt-link-btn" onClick={() => setOpen(allOpen ? new Set() : new Set(concepts.map((_, i) => i)))}>
        {allOpen ? t('notes.foldAll') : t('notes.unfoldAll')}
      </button>
      <div className="nt-concepts">
        {concepts.map((c, i) => {
          const isOpen = open.has(i);
          return (
            <div key={i} className={`nt-concept nt-reveal${isOpen ? ' is-open' : ''}`} style={{ '--i': i }}>
              <h3>
                <button type="button" aria-expanded={isOpen} aria-controls={`nt-c-${i}`} onClick={() => toggle(i)}>
                  <span className="nt-concept-n">{i + 1}</span>
                  <MathText text={c.title} />
                  <span className="nt-fold" aria-hidden="true" />
                </button>
              </h3>
              <div id={`nt-c-${i}`} className="nt-concept-body" hidden={!isOpen}>
                <MathText block text={c.body} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Formula({ f, i }) {
  // Rendered through the one escaped KaTeX sink, in display style, with a "Read formula" button.
  const t = useT();
  const tex = useMemo(() => `\\displaystyle ${f.tex}`, [f.tex]);
  return (
    <figure className="nt-formula nt-reveal" style={{ '--i': i }}>
      <figcaption><MathText text={f.label} /></figcaption>
      <div className="nt-ink">
        <ReadableFormula className="nt-ink-tex" tex={tex} label={t('math.formula')} readLabel={t('math.readFormula')} hideLabel={t('math.hideReading')} />
        <span className="nt-ink-veil" aria-hidden="true" />
      </div>
      <svg className="nt-ink-stroke" viewBox="0 0 300 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 6.5 C 60 3, 120 8.5, 190 5 S 270 3.5, 298 5.5" pathLength="1" />
      </svg>
      {f.note && <MathText block className="nt-formula-note" text={f.note} />}
    </figure>
  );
}

export function Example({ ex, n }) {
  const t = useT();
  // The student first sees only the problem, never an unsolicited solution.
  const [shown, setShown] = useState(0);
  const done = shown >= ex.steps.length;
  return (
    <div className="nt-example nt-reveal">
      <p className="nt-example-n">{t('notes.exampleNumber', { n })}</p>
      <MathText block className="nt-example-q" text={ex.question} />
      {ex.figure && <StudyDiagram figure={ex.figure} />}
      <ol className="nt-steps">
        {ex.steps.slice(0, shown).map((s, i) => <li key={i} className="nt-step">
          <MathText text={s} />
          {ex.reasons?.[i] && <p className="nt-step-reason"><MathText text={ex.reasons[i]} /></p>}
        </li>)}
      </ol>
      {!done ? (
        <div className="nt-example-more">
          <button type="button" className="btn btn-secondary" onClick={() => setShown(s => s + 1)}>{t('notes.nextStep')}</button>
          <button type="button" className="nt-link-btn" onClick={() => setShown(ex.steps.length)}>{t('notes.allSteps')}</button>
        </div>
      ) : (
        <div className="nt-answer nt-step">
          <span className="nt-tag">{t('notes.answer')}</span>
          {/^\$[^$]+\$$/.test(ex.answer) ? <ReadableFormula tex={ex.answer.slice(1, -1)} label={t('notes.answer')} readLabel={t('math.readFormula')} hideLabel={t('math.hideReading')} /> : <MathText text={ex.answer} />}
          <span className="nt-checked">{t('notes.engineChecked')}</span>
          {ex.alternative && (
            <details className="nt-alternative">
              <summary>{t('study.alternative')}</summary>
              <MathText block text={ex.alternative} />
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── Revise in five minutes ───────────────────────────────────────────────────
export function Flashcards({ chapter, points, onClose }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const dialog = useRef(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const finished = i >= points.length;

  const go = useCallback((d) => { setFlipped(false); setI(x => Math.max(0, Math.min(points.length, x + d))); }, [points.length]);

  useEffect(() => {
    dialog.current?.querySelector('.nt-card, .nt-cards-done button')?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; opener.current?.focus?.(); };
  }, []);
  // The card is re-keyed per index (so it slides in), which drops focus with the
  // old node; put it back so arrow keys keep working inside the dialog.
  useEffect(() => {
    const el = dialog.current;
    if (el && (!el.contains(document.activeElement) || document.activeElement === document.body || finished)) {
      el.querySelector('.nt-card, .nt-cards-done button')?.focus();
    }
  }, [i, finished]);

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key === 'Tab') {
      const f = [...dialog.current.querySelectorAll('button:not([disabled])')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const card = points[i];

  return (
    <div className="nt-cards-scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nt-cards" role="dialog" aria-modal="true" aria-labelledby="nt-cards-h" ref={dialog} onKeyDown={onKey}>
        <div className="nt-cards-top">
          <h2 id="nt-cards-h">{t('notes.cardsTitle', { chapter: chapter.name })}</h2>
          <button type="button" className="nt-close" onClick={onClose} aria-label={t('notes.close')}>×</button>
        </div>
        <div className="nt-cards-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(i, points.length) / points.length})` }} />
        </div>
        {!finished ? (
          <>
            <p className="nt-sr" aria-live="polite">{t('notes.cardProgress', { n: i + 1, total: points.length })}</p>
            <button type="button" key={i} className={`nt-card${flipped ? ' is-flipped' : ''}`} data-testid="notes-card"
              aria-label={`${t('notes.flip')} — ${t('notes.cardProgress', { n: i + 1, total: points.length })}`}
              onClick={() => setFlipped(f => !f)}>
              <span className="nt-card-inner">
                <span className="nt-card-face nt-card-front" aria-hidden={flipped}>
                  <MathText text={card.front} />
                </span>
                <span className="nt-card-face nt-card-back" aria-hidden={!flipped}>
                  <MathText text={card.back} />
                </span>
              </span>
            </button>
            <p className="nt-quiet nt-cards-hint">{t('notes.flipHint')}</p>
            <div className="nt-cards-nav">
              <button type="button" className="btn btn-secondary" onClick={() => go(-1)} disabled={i === 0}>{t('notes.prev')}</button>
              <span className="nt-cards-count">{t('notes.cardProgress', { n: i + 1, total: points.length })}</span>
              <button type="button" className="btn btn-primary" onClick={() => go(1)} data-testid="notes-card-next">{t('notes.next')}</button>
            </div>
          </>
        ) : (
          <div className="nt-cards-done">
            <p>{t('notes.cardsDone')}</p>
            <button type="button" className="btn btn-secondary" onClick={() => { setI(0); setFlipped(false); }}>{t('notes.again')}</button>
            <button type="button" className="btn btn-primary" onClick={onClose}>{t('notes.close')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
