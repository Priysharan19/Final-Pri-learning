import React from 'react';
import { useSearchParams } from 'react-router-dom';
import PracticeBase from './PracticeBase.jsx';
import RationalNumbersTopperSectionProduction from '../components/RationalNumbersTopperSectionProduction.jsx';
import LinearEquationsTopperSectionProduction from '../components/LinearEquationsTopperSectionProduction.jsx';
import NcertClass8ChapterSection from '../components/NcertClass8ChapterSection.jsx';
import NcertClass9ChapterSection from '../components/NcertClass9ChapterSection.jsx';

const InkPhysicalEvidenceSession = React.lazy(() => import('../components/InkPhysicalEvidenceSession.jsx'));

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
      <React.Suspense fallback={<p className="muted" role="status">Loading physical Pencil evidence session…</p>}>
        <InkPhysicalEvidenceSession />
      </React.Suspense>
    );
  }

  return (
    <>
      {chapter === 'c8-rational-numbers' && <RationalNumbersTopperSectionProduction />}
      {chapter === 'c8-linear-equations' && <LinearEquationsTopperSectionProduction />}
      <NcertClass8ChapterSection chapterId={chapter} />
      <NcertClass9ChapterSection chapterId={chapter} />
      <PracticeBase />
    </>
  );
}
