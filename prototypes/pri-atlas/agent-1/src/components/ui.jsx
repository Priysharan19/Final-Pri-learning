import React from 'react';
import katex from 'katex';
import { ArrowUpRight, ChevronRight, LoaderCircle } from 'lucide-react';

export function Kicker({ children, className = '' }) {
  return <span className={'kicker ' + className}>{children}</span>;
}

export function Button({ children, variant = 'primary', className = '', icon: Icon, ...props }) {
  return (
    <button className={'atlas-btn atlas-btn-' + variant + ' ' + className} type="button" {...props}>
      <span>{children}</span>{Icon && <Icon size={17} strokeWidth={1.7} aria-hidden="true" />}
    </button>
  );
}

export function Panel({ children, className = '', as: Element = 'section', ...props }) {
  return <Element className={'atlas-panel ' + className} {...props}>{children}</Element>;
}

export function SectionHeading({ eyebrow, title, description, action, onAction }) {
  return <div className="section-heading">
    <div><Kicker>{eyebrow}</Kicker><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {action && <button type="button" className="text-action" onClick={onAction}>{action}<ArrowUpRight size={15} aria-hidden="true" /></button>}
  </div>;
}

export function StateLabel({ variant = 'neutral', children }) {
  return <span className={'state-label state-' + variant}><span className="state-dot" />{children}</span>;
}

export function InlineArrow() {
  return <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" />;
}

export function LoadingState({ label = 'Loading preview' }) {
  return <div role="status" className="loading-state"><LoaderCircle className="loading-icon" size={18} aria-hidden="true" />{label}</div>;
}

/** Authored LaTeX only; no student HTML or server-supplied untrusted markup. */
export function MathFrame({ latex, title = 'Mathematical expression', displayMode = true, className = '' }) {
  const html = katex.renderToString(latex, { throwOnError: false, displayMode, trust: false, strict: 'warn' });
  return <div role="img" aria-label={title} className={'math-frame ' + className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function EvidenceNote({ children }) {
  return <p className="evidence-note"><span className="evidence-diamond" aria-hidden="true" />{children}</p>;
}

export function Skeleton({ width = '100%' }) {
  return <span aria-hidden="true" className="atlas-skeleton" style={{ width }} />;
}
