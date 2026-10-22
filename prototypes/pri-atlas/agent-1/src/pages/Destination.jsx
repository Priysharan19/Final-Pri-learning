import React, { useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, BrainCircuit, CircleHelp, FlaskConical, RotateCcw } from 'lucide-react';
import { useAtlasNavigation } from '../lib/navigation.jsx';
import { demoData, SUBJECT_META } from '../lib/demoData.js';
import { Button, EvidenceNote, Kicker, MathFrame, Panel, StateLabel } from '../components/ui.jsx';

const SETTINGS = {
  laboratory: { index: '03', name: 'Laboratory', eyebrow: 'THINK BY DOING', lead: 'Ideas you can touch.', description: 'A reserved interactive science-and-mathematics simulation surface for Agent 2.', Icon: FlaskConical },
  paper: { index: '04', name: 'Paper', eyebrow: 'WORK IT THROUGH', lead: 'The page is yours.', description: 'A safe demonstration workspace; no real grading, autosave or submissions.', Icon: BookOpen },
  insight: { index: '05', name: 'Insight', eyebrow: 'TRUTH BEFORE NUMBERS', lead: 'See what the evidence says.', description: 'A reserved learning-evidence destination for Agent 3. No mastery score is inferred.', Icon: BrainCircuit }
};

export default function DestinationPage({ kind }) {
  const { context, go } = useAtlasNavigation();
  const [draft, setDraft] = useState('');
  const meta = SETTINGS[kind];
  const Icon = meta.Icon;
  const concept = demoData.concepts.find(c => c.id === context.concept && c.subject === context.subject);
  const question = demoData.questions.find(q => q.conceptId === context.concept);
  return <div className="destination-page page-enter">
    <div className="page-topline"><Kicker>PRI ATLAS / {meta.index} {meta.name.toUpperCase()}</Kicker><span>AGENT INTEGRATION SURFACE</span></div>
    <div className="destination-hero"><div><span className="destination-eyebrow">{meta.eyebrow}</span><h1>{meta.lead}</h1><p>{meta.description}</p></div><span className="destination-bigicon"><Icon size={64} strokeWidth={0.9} aria-hidden="true" /></span></div>
    <div className="destination-grid">
      <Panel className="destination-workspace">
        <div className="workspace-head"><Kicker>01 / EXPERIMENTAL SPACE</Kicker><span>SANDBOX / NO CLOUD CONNECTION</span></div>
        {kind === 'paper' ? <>
          <span className="inspector-label">SAMPLE QUESTION {question ? '· ' + (concept?.title || '') : '· EXAMPLE'}</span>
          <MathFrame latex={question ? 'x^2 - 5x + 6 = 0' : 'x^2 + 2x + 1 = 0'} title="Sample quadratic equation" />
          <label htmlFor="sample-draft" className="draft-label">Your working <span>LOCAL UNSAVED TEXT ONLY</span></label>
          <textarea id="sample-draft" className="draft-textarea" placeholder="Start with what you know…" value={draft} onChange={e => setDraft(e.target.value)} />
          <div className="draft-actions"><span>No answer checking is implemented in this prototype.</span><Button variant="outline" icon={RotateCcw} onClick={() => setDraft('')}>Clear draft</Button></div>
        </> : kind === 'laboratory' ? <>
          <MathFrame latex="y = mx + c" title="Equation of a straight line" />
          <div className="preview-scale" role="img" aria-label="Decorative coordinate-plane placeholder for an upcoming interactive lab"><span>Y</span><i /><b /><span>X</span></div>
          <EvidenceNote>Illustrative coordinate plane only. Simulation controls will be implemented and tested by Agent 2.</EvidenceNote>
        </> : <>
          <div className="insight-empty"><BrainCircuit size={38} strokeWidth={1.2} /><strong>Evidence without invention.</strong><p>This sample includes a paused attempt and limited question counts. It is not enough to establish long-term mastery.</p><StateLabel variant="neutral">NO VERIFIED LEARNER EVIDENCE</StateLabel></div>
        </>}
      </Panel>
      <Panel className="destination-about">
        <Kicker>CONTEXT / PRESERVED</Kicker>
        <strong>{SUBJECT_META[context.subject].title}</strong>
        <span>{concept ? concept.title : 'Select a concept from Atlas'}</span>
        <div className="inspector-line" />
        <Kicker>OWNERSHIP</Kicker>
        <p>{kind === 'insight' ? 'Agent 3 owns this destination’s eventual intelligence and evidence visualisation.' : kind === 'laboratory' ? 'Agent 2 owns this destination’s interactive mathematical laboratories.' : 'The prototype shell provides a sample text input. Practice and marking remain production-authoritative and out of scope.'}</p>
        <Button variant="outline" icon={ArrowUpRight} onClick={() => go('atlas', { concept: context.concept })}>Return to Atlas</Button>
      </Panel>
    </div>
  </div>;
}
