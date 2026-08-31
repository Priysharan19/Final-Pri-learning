import React from 'react';
import { useSearchParams } from 'react-router-dom';
import PracticeBase from './PracticeBase.jsx';
import RationalNumbersTopperSectionProduction from '../components/RationalNumbersTopperSectionProduction.jsx';
import LinearEquationsTopperSectionProduction from '../components/LinearEquationsTopperSectionProduction.jsx';
import NcertClass8ChapterSection from '../components/NcertClass8ChapterSection.jsx';
import NcertClass9ChapterSection from '../components/NcertClass9ChapterSection.jsx';

// Chapter-specific learning layers sit above the unchanged practice experience.
// Question serving, AI handwriting, marking, retries and Pri Explain stay on the
// same production path; source-audited Class 8 and Grade 9 shells only enrich
// curriculum content, notes, worked examples and source verification.
export default function Practice() {
  const [params] = useSearchParams();
  const chapter = params.get('subtopic');

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
