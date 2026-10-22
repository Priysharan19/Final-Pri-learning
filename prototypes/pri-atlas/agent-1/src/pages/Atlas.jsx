import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CircleDot, Compass, GitBranch, Layers3, Sparkles } from 'lucide-react';
import { useAtlasNavigation } from '../lib/navigation.jsx';
import { conceptsFor, demoData, evidenceFor, SUBJECT_META } from '../lib/demoData.js';
import { GRAPH_LAYERS, displayAccuracy } from '../lib/contract.js';
import { Button, Kicker, Panel, StateLabel } from '../components/ui.jsx';

const LAYERS = {
  prerequisites: { title: 'Prerequisites', explanation: 'A concept that helps prepare another' },
  related: { title: 'Related ideas', explanation: 'Ideas linked by a shared structure' },
  applications: { title: 'Applications', explanation: 'An idea used in a new setting' }
};

export default function AtlasPage() {
  const { context, go } = useAtlasNavigation();
  const [layer, setLayer] = useState('prerequisites');
  const concepts = useMemo(() => conceptsFor(context.subject), [context.subject]);
  const selected = concepts.find(c => c.id === context.concept) || concepts[0];
  const selectedId = selected?.id || null;
  const paths = demoData.edges.filter(edge => edge.layer === layer &&
    concepts.some(item => item.id === edge.from) && concepts.some(item => item.id === edge.to));
  const meta = SUBJECT_META[context.subject];
  const select = id => go('atlas', { concept: id });
  const evidence = selectedId ? evidenceFor(selectedId) : null;
  const accuracy = displayAccuracy(evidence);

  return <div className="atlas-page page-enter">
    <div className="page-topline"><Kicker><span className="tiny-cross">✳</span> ATLAS / SYLLABUS EXPLORER</Kicker><span>PROTOTYPE GRAPH · SYNTHETIC CONCEPTS</span></div>
    <div className="atlas-heading">
      <div><h1>Knowledge is <em>connected.</em></h1><p>Take a step back. Find the pathway forward.</p></div>
      <Button variant="outline" icon={ArrowLeft} onClick={() => go('command')}>Back to Command</Button>
    </div>
    <div className="atlas-subjectline">
      <div className="atlas-subject-title"><span className="subject-marker" /><strong>{meta.title}</strong><span> / {concepts.length} DEMO CONCEPTS</span></div>
      <div role="group" aria-label="Knowledge graph relationship layer" className="layer-tabs">
        {GRAPH_LAYERS.map(value => <button key={value} type="button" aria-pressed={layer === value} className={layer === value ? 'layer-selected' : ''}
          onClick={() => setLayer(value)}>{LAYERS[value].title}</button>)}
      </div>
    </div>
    <div className="atlas-content">
      <Panel className="graph-panel">
        <div className="graph-watermark">ATLAS <span>001</span></div>
        <div className="graph-top"><span><GitBranch size={14} /> {LAYERS[layer].explanation}</span><span>SELECT ANY CONCEPT</span></div>
        <div className="knowledge-graph" aria-label={meta.title + ' concept network'}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="graph-svg" aria-hidden="true">
            {paths.map(edge => {
              const from = concepts.find(item => item.id === edge.from), to = concepts.find(item => item.id === edge.to);
              return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} key={edge.id} />;
            })}
          </svg>
          {concepts.map(concept => <button key={concept.id} type="button" className={'graph-node ' + (selectedId === concept.id ? 'graph-node-active' : '')}
            style={{ left: concept.x + '%', top: concept.y + '%' }} onClick={() => select(concept.id)}
            aria-pressed={selectedId === concept.id} aria-label={'Select ' + concept.title}>
            <span className="graph-node-center" /><span className="graph-node-label">{concept.title}</span>
          </button>)}
        </div>
        <div className="graph-bottom"><span>CONNECTION TYPE <strong>{LAYERS[layer].title.toUpperCase()}</strong></span><span>NOT A MEASURE OF STUDENT MASTERY</span></div>
      </Panel>
      <Panel className="concept-inspector">
        <Kicker>INSPECTOR <span> / CONCEPT DETAIL</span></Kicker>
        <div className="inspector-symbol" aria-hidden="true">{meta.symbol}<span>✳</span></div>
        <span className="inspector-chapter">{selected?.chapter.toUpperCase()}</span>
        <h2>{selected?.title}</h2><p>{selected?.detail}</p>
        <div className="inspector-line" />
        <span className="inspector-label">LEARNING EVIDENCE</span>
        <div className="inspector-status"><StateLabel variant="neutral">{evidence ? (accuracy === null ? 'BELOW REPORTING FLOOR' : 'ILLUSTRATIVE ONLY') : 'NO DEMO ATTEMPTS'}</StateLabel></div>
        <p className="inspector-explain">{evidence ? 'Sample: ' + evidence.correct + ' correct out of ' + evidence.questionsSeen + ' questions. ' + (accuracy === null ? 'No accuracy shown below the demonstration floor.' : 'Illustrative accuracy: ' + accuracy + '%.') : 'No example attempt data has been provided for this concept.'}</p>
        <Button variant="primary" icon={ArrowRight} onClick={() => go('paper', { concept: selectedId })}>Open sample paper</Button>
        <span className="inspector-disclaimer">Demonstration only · not a recommendation or grade</span>
      </Panel>
    </div>
    <div className="atlas-bottomnote"><CircleDot size={15} /> Connections are illustrative; future Agent 2 work will validate graph semantics against curricular sources.</div>
  </div>;
}
