import React from 'react';
import { useSearchParams } from 'react-router-dom';

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
  return (
    <p className="muted" role="status" aria-live="polite">
      {physical ? 'Loading physical Pencil evidence session…' : 'Loading practice workspace…'}
    </p>
  );
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
      {chapter === 'c8-rational-numbers' && <RationalNumbersTopperSectionProduction />}
      {chapter === 'c8-linear-equations' && <LinearEquationsTopperSectionProduction />}
      <NcertClass8ChapterSection chapterId={chapter} />
      <NcertClass9ChapterSection chapterId={chapter} />
      <PracticeBase />
    </React.Suspense>
  );
}
