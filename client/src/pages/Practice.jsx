import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { NCERT_CLASS8_3_13_IDS } from '../engine/ncert/class8-chapters-3-13-syllabus.js';
import { NCERT_CLASS9_SYLLABUS } from '../engine/ncert/class9-syllabus.js';

// Practice is one of the heaviest product surfaces: handwriting, the maths
// workspace and source-audited curriculum shells are irrelevant to Home/Login/
// Progress/etc. Keep those dependencies behind the Practice route boundary so
// opening Pri Learning does not download/parse the entire solving workspace.
const PracticeBase = React.lazy(() => import('./PracticeBase.jsx'));
const RationalNumbersTopperSectionProduction = React.lazy(() => import('../components/RationalNumbersTopperSectionProduction.jsx'));
const LinearEquationsTopperSectionProduction = React.lazy(() => import('../components/LinearEquationsTopperSectionProduction.jsx'));
const NcertClass8ChapterSection = React.lazy(() => import('../components/NcertClass8ChapterSection.jsx'));
const NcertClass9ChapterSection = React.lazy(() => import('../components/NcertClass9ChapterSection.jsx'));
const InkPhysicalEvidenceSession = React.lazy(() => import('../components/InkPhysicalEvidenceSession.jsx'));

function LoadingPractice({ physical = false }) {
  const t = useT();
  return (
    <p className="muted" role="status" aria-live="polite">
      {t(physical ? 'practice.loadingPhysical' : 'practice.loading')}
    </p>
  );
}

// The source-audited chapter shells carry a whole class's notes, worked
// examples and generators, and they are fetched with that class's question
// bank rather than with the app (see the ON_DEMAND rules in vite.config.js).
// Each shell only ever renders for its own chapters, so it is only mounted for
// them: a Class 10 student opening practice never asks for the Class 8 or
// Grade 9 bank. The syllabus layers these ids come from are already on the
// boot path for the curriculum spine, so asking costs nothing.
//
// And because an enrichment layer is optional by nature, a shell that cannot
// be fetched — offline before its bank was ever cached — renders nothing
// rather than taking the practice workspace below it down with it.
const CLASS9_IDS = NCERT_CLASS9_SYLLABUS.map(ch => ch.id);

class OptionalSection extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

// Chapter-specific learning layers sit above the unchanged practice experience.
// Question serving, AI handwriting, marking, retries and Pri Explain stay on the
// same production path; source-audited Class 8 and Grade 9 shells only enrich
// curriculum content, notes, worked examples and source verification.
export default function Practice() {
  const [params] = useSearchParams();
  const chapter = params.get('subtopic');

  // Hidden, explicit physical-device study route. It is intentionally not in
  // navigation and remains inside the real Practice application so the study
  // mounts the same InkAnswer/PencilKit/recognition path students use.
  if (params.get('inkEvidence') === '1') {
    return (
      <React.Suspense fallback={<LoadingPractice physical />}>
        <InkPhysicalEvidenceSession />
      </React.Suspense>
    );
  }

  return (
    <React.Suspense fallback={<LoadingPractice />}>
      {chapter === 'c8-rational-numbers' && <OptionalSection key={chapter}><RationalNumbersTopperSectionProduction /></OptionalSection>}
      {chapter === 'c8-linear-equations' && <OptionalSection key={chapter}><LinearEquationsTopperSectionProduction /></OptionalSection>}
      {NCERT_CLASS8_3_13_IDS.includes(chapter) && (
        <OptionalSection key={chapter}><NcertClass8ChapterSection chapterId={chapter} /></OptionalSection>
      )}
      {CLASS9_IDS.includes(chapter) && (
        <OptionalSection key={chapter}><NcertClass9ChapterSection chapterId={chapter} /></OptionalSection>
      )}
      <PracticeBase />
    </React.Suspense>
  );
}
