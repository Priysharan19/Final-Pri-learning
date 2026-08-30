import React from 'react';
import { useSearchParams } from 'react-router-dom';
import PracticeBase from './PracticeBase.jsx';
import RationalNumbersTopperSection from '../components/RationalNumbersTopperSection.jsx';

// Chapter-specific learning layers sit above the unchanged practice experience.
// This keeps question serving, handwriting, marking and Pri Explain on the same
// production path while giving NCERT chapters room for source-backed notes.
export default function Practice() {
  const [params] = useSearchParams();
  const chapter = params.get('subtopic');

  return (
    <>
      {chapter === 'c8-rational-numbers' && <RationalNumbersTopperSection />}
      <PracticeBase />
    </>
  );
}
