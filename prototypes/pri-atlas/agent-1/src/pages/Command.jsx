import React from 'react';
import { ArrowRight, ArrowUpRight, BookOpenText, Compass, CornerDownRight,
  Hexagon, Layers3, MoveUpRight, Sparkles } from 'lucide-react';
import { demoData, SUBJECT_META, evidenceFor } from '../lib/demoData.js';
import { displayAccuracy } from '../lib/contract.js';
import { useAtlasNavigation } from '../lib/navigation.jsx';
import { Button, EvidenceNote, Kicker, Panel, SectionHeading, StateLabel } from '../components/ui.jsx';

function Constellation({ onExplore, subject }) {
  const math = subject === 'mathematics';
  return <div className="constellation" aria-label="Interactive preview of a subject knowledge network">
    <div className="constellation-top"><span>01 — LIVE PREVIEW</span><span>KNOWLEDGE SPACE</span></div>
    <div className="constellation-orbit constellation-orbit-one" aria-hidden="true" />
    <div className="constellation-orbit constellation-orbit-two" aria-hidden="true" />
    <svg className="constellation-lines" viewBox="0 0 580 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M130 195 L280 115 L417 205 L320 335 L130 195 L320 335 M280 115 L320 335 M417 205 L480 110" />
      <path className="constellation-dash" d="M150 96 L280 115 L480 110 M130 195 L98 344 L320 335" />
      <circle cx="280" cy="115" r="3" /><circle cx="130" cy="195" r="3" /><circle cx="417" cy="205" r="3" />
    </svg>
    <div className="constellation-halo" aria-hidden="true" />
    <button type="button" className="constellation-core" onClick={onExplore} aria-label={'Explore ' + (math ? 'algebra' : SUBJECT_META[subject].title) + ' in Atlas'}>
      <span className="core-bracket core-bracket-top" />
      <span className="core-name">{math ? 'ALGEBRA' : subject.toUpperCase()}</span>
      <span className="core-symbol" aria-hidden="true">{SUBJECT_META[subject].symbol}</span>
      <span className="core-hint">EXPLORE NETWORK ↗</span>
      <span className="core-bracket core-bracket-bottom" />
    </button>
    <span className="constellation-node constellation-node-a"><span />{math ? 'POLYNOMIALS' : 'FOUNDATIONS'}</span>
    <span className="constellation-node constellation-node-b"><span />{math ? 'EQUATIONS' : 'APPLICATIONS'}</span>
    <span className="constellation-node constellation-node-c"><span />{math ? 'SEQUENCES' : 'CONNECTIONS'}</span>
    <span className="constellation-axis constellation-axis-y">RELATIONSHIPS / 03</span>
    <div className="constellation-bottom"><span>DIAGRAM 001 / NOT TO SCALE</span><span className="constellation-coordinate">X: 042.86 / Y: 018.04</span></div>
  </div>;
}

function StudyPath({ onOpen }) {
  const tracks = [
    { index: '01', title: 'The building blocks', detail: 'Polynomials and identities', signal: 'EXPLORE', id: 'polynomials' },
    { index: '02', title: 'Solving for the unknown', detail: 'Linear and quadratic equations', signal: 'CONTINUE', id: 'quadratics' },
    { index: '03', title: 'Patterns that repeat', detail: 'Arithmetic progressions', signal: 'EXPLORE', id: 'arithmetic-progressions' }
  ];
  return <Panel className="learning-path">
    <div className="panel-intro"><Kicker>YOUR LEARNING TERRAIN</Kicker><span>DEMO / MATHEMATICS</span></div>
    <div className="path-list">
      {tracks.map((item, index) => <button className="path-row" type="button" key={item.id} onClick={() => onOpen(item.id)}>
        <span className={'path-index ' + (index === 1 ? 'path-index-active' : '')}>{item.index}</span>
        <span className="path-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
        <span className="path-right"><span>{item.signal}</span><ArrowUpRight size={16} aria-hidden="true" /></span>
      </button>)}
    </div>
    <div className="path-foot"><span>Three suggested entry points · synthetic catalogue</span><Compass size={16} aria-hidden="true" /></div>
  </Panel>;
}

export default function CommandPage() {
  const { context, go } = useAtlasNavigation();
  const metadata = SUBJECT_META[context.subject];
  const isMath = context.subject === 'mathematics';
  const exampleEvidence = evidenceFor('quadratics');
  const accuracy = displayAccuracy(exampleEvidence);
  const explore = concept => go('atlas', { concept: context.subject === 'mathematics' ? concept : null });
  const next = demoData.nextAction;

  return <div className="command-page page-enter">
    <div className="intro-row">
      <div><Kicker>YOUR LEARNING UNIVERSE</Kicker><span className="intro-separator" /> <span className="intro-class">{demoData.student.cohortLabel}</span></div>
      <span className="command-status"><span className="pulse-dot" /> SANDBOX ACTIVE <span>·</span> V 0.1</span>
    </div>
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-overline"><span className="tiny-cross">✳</span> HELLO, CURIOUS MIND <span className="overline-rule" /></span>
        <h1>See the whole.<br /><span>Master the</span><br /><em>next step.</em></h1>
        <p className="hero-description">A place where the syllabus opens up, every idea connects, and your next move feels clear.</p>
        <div className="hero-actions">
          <Button variant="outline" icon={ArrowUpRight} onClick={() => explore(isMath ? 'algebra' : null)}>Explore {isMath ? 'algebra' : metadata.title}</Button>
          <span className="hero-microcopy">A whole syllabus, one connected view.</span>
        </div>
      </div>
      <Constellation subject={context.subject} onExplore={() => explore(isMath ? 'algebra' : null)} />
    </section>
    <div className="content-layout">
      <div className="content-main">
        <SectionHeading eyebrow="THE NEXT MOVE" title="Less deciding. More discovering." description="One clear place to begin — based on the sample session below." />
        <Panel className="next-card">
          <div className="next-card-glint" />
          <div className="next-copy">
            <div className="next-eyebrow"><StateLabel variant="subject">SAMPLE ACTION</StateLabel><Kicker>01 / CONTINUE LEARNING</Kicker></div>
            <h3>{isMath ? next.label : 'Explore ' + metadata.title}</h3>
            <p>{isMath ? next.reason : 'Open the demonstration concept network for this subject. No learning history is available.'}</p>
            <Button icon={ArrowRight} onClick={() => isMath ? go('paper', { concept: next.conceptId }) : explore(null)}>{isMath ? 'Resume sample practice' : 'Explore sample concepts'}</Button>
            <EvidenceNote>{isMath ? 'Derived only from a fictional paused attempt, not a prediction of learner ability.' : 'No subject-specific learner evidence. This is a catalogue entry point.'}</EvidenceNote>
          </div>
          <div className="next-graphic" aria-hidden="true">
            <div className="next-ring ring-outer" /><div className="next-ring ring-inner" />
            <span className="next-graphic-symbol">x<span>²</span></span>
            <span className="next-graphic-caption">FOCUS / 001</span>
            <span className="next-graphic-corner">↗</span>
          </div>
        </Panel>
        <div className="feature-grid">
          <button className="feature-card" type="button" onClick={() => go('atlas', { concept: isMath ? 'algebra' : null })}>
            <span className="feature-icon feature-icon-atlas"><Layers3 size={22} strokeWidth={1.5} /></span>
            <span className="feature-index">02 / EXPLORE</span>
            <strong>Follow the connections.</strong>
            <span className="feature-description">See how one concept unlocks the next.</span>
            <ArrowUpRight size={17} className="feature-arrow" aria-hidden="true" />
          </button>
          <button className="feature-card" type="button" onClick={() => go('laboratory')}>
            <span className="feature-icon feature-icon-lab"><Hexagon size={22} strokeWidth={1.5} /></span>
            <span className="feature-index">03 / EXPERIMENT</span>
            <strong>Think beyond the page.</strong>
            <span className="feature-description">Make abstract ideas tangible.</span>
            <ArrowUpRight size={17} className="feature-arrow" aria-hidden="true" />
          </button>
        </div>
      </div>
      <aside className="content-aside" aria-label="Learning context">
        <div className="aside-heading"><Kicker>IN FOCUS</Kicker><span>01 / 03</span></div>
        <div className="aside-subject">
          <span className="aside-subject-symbol">{metadata.symbol}</span>
          <span><small>CURRENT SUBJECT</small><strong>{metadata.title}</strong></span>
          <button type="button" aria-label={'Explore ' + metadata.title} onClick={() => explore(isMath ? 'algebra' : null)}><ArrowUpRight size={17} /></button>
        </div>
        <div className="aside-divider" />
        <div className="aside-figure"><span>SAMPLE EVIDENCE</span><strong>{isMath ? '08' : '—'}</strong><small>{isMath ? 'questions seen in fictional sample' : 'no subject evidence provided'}</small></div>
        <div className="aside-evidence">{isMath
          ? <><StateLabel variant="neutral">INSUFFICIENT FOR ACCURACY</StateLabel><p>{accuracy === null ? '8 sample questions is below the illustrative reporting floor of 10. No accuracy is claimed.' : 'Illustrative accuracy: ' + accuracy + '%.'}</p></>
          : <><StateLabel variant="neutral">NOT YET MEASURED</StateLabel><p>Explore without an invented performance score.</p></>}
        </div>
        <StudyPath onOpen={explore} />
        <div className="aside-footer"><CornerDownRight size={15} /><span>Curiosity looks good on you.</span></div>
      </aside>
    </div>
    <footer className="command-footer"><span>PRI ATLAS <span>©</span> DESIGN EXPLORATION</span><span>Built to make thinking visible.</span><span>ALL CONTENT / SYNTHETIC</span></footer>
  </div>;
}
