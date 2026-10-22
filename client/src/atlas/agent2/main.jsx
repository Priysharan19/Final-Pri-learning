import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AtlasExperience from './AtlasExperience.jsx';
import LaboratoryExperience from './LaboratoryExperience.jsx';
import LabPaperPreview from './LabPaperPreview.jsx';
import { buildAtlasGraph } from './graphModel.js';
import { IN_CHAPTERS } from '../../engine/curriculum-in.js';
import '@fontsource-variable/instrument-sans';
import '@fontsource/ibm-plex-mono/400.css';

function PrototypeApp() {
  const [page, setPage] = useState('atlas');
  const [paper, setPaper] = useState(null);
  const [lastConcept, setLastConcept] = useState('c10-pair-linear-equations');
  const density = Number(new URLSearchParams(window.location.search).get('graphNodes'));
  const probeGraph = [10,40,84].includes(density) ? buildAtlasGraph({
    ids: IN_CHAPTERS.map(ch => ch.id).slice(0, density), demo: true
  }) : null;
  const openPaper = request => { setPaper(request); setPage('paper'); };
  return <div className="pa2-demo-root">
    <nav className="pa2-demo-nav" aria-label="Prototype destinations">
      <span className="pa2-demo-brand">PRI ATLAS / PROTOTYPE</span>
      <div><button type="button" aria-current={page === 'atlas' ? 'page' : undefined}
        onClick={() => setPage('atlas')}>Atlas</button>
        <button type="button" aria-current={page === 'lab' ? 'page' : undefined}
          onClick={() => {setLastConcept('c10-pair-linear-equations'); setPage('lab');}}>Laboratory</button>
        <button type="button" aria-current={page === 'paper' ? 'page' : undefined} onClick={() => setPage('paper')}>Paper</button>
      </div>
    </nav>
    {page === 'atlas' && <AtlasExperience initialConceptId={probeGraph?.selectionDefault || lastConcept}
      graph={probeGraph}
      onSelectConcept={({ chapterId }) => setLastConcept(chapterId)}
      onOpenLaboratory={({ chapterId }) => {setLastConcept(chapterId); setPage('lab');}} onOpenPaper={openPaper} />}
    {page === 'lab' && <LaboratoryExperience onOpenPaper={openPaper} onBackToAtlas={() => setPage('atlas')} />}
    {page === 'paper' && paper?.kind === 'generated-experiment'
      ? <LabPaperPreview handoff={paper} onBack={() => setPage('lab')} />
      : page === 'paper' && <main className="pa2-experience">
      <div className="pa2-overline">PRI ATLAS / 03 — PAPER HANDOFF</div><h1>Paper transition contract</h1>
      <p>Prototype preview only. No marking or question generation engine has been activated.</p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(paper || { chapterId: lastConcept, pending: true }, null, 2)}</pre>
      <button type="button" onClick={() => setPage('atlas')}>← Return to Atlas</button>
    </main>}
  </div>;
}
createRoot(document.getElementById('root')).render(<PrototypeApp />);
