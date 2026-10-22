import { validateAtlasData } from './contract.js';

// Every person, question, attempt and metric below is fictional demonstration data.
// No student identifiers, API requests, or real evidence are present.
export const demoData = validateAtlasData({
  version: 1,
  synthetic: true,
  student: { label: 'Demo learner', isDemo: true, cohortLabel: 'CBSE · Class X', defaultSubject: 'mathematics' },
  concepts: [
    { id: 'algebra', title: 'Algebra', chapter: 'Mathematics', subject: 'mathematics', x: 47, y: 49, detail: 'Patterns, structure and unknowns' },
    { id: 'polynomials', title: 'Polynomials', chapter: 'Algebra', subject: 'mathematics', x: 19, y: 26, detail: 'Roots and identities' },
    { id: 'linear-equations', title: 'Linear equations', chapter: 'Algebra', subject: 'mathematics', x: 76, y: 21, detail: 'Relationships between variables' },
    { id: 'quadratics', title: 'Quadratic equations', chapter: 'Algebra', subject: 'mathematics', x: 74, y: 67, detail: 'Factorisation and roots' },
    { id: 'arithmetic-progressions', title: 'Arithmetic progressions', chapter: 'Algebra', subject: 'mathematics', x: 25, y: 81, detail: 'Regular sequences' },
    { id: 'trigonometry', title: 'Trigonometry', chapter: 'Mathematics', subject: 'mathematics', x: 13, y: 55, detail: 'Angles and ratios' },
    { id: 'motion', title: 'Motion', chapter: 'Mechanics', subject: 'physics', x: 40, y: 40, detail: 'Displacement and velocity' },
    { id: 'forces', title: 'Forces', chapter: 'Mechanics', subject: 'physics', x: 70, y: 66, detail: 'Newton’s laws of motion' },
    { id: 'energy', title: 'Energy', chapter: 'Mechanics', subject: 'physics', x: 23, y: 77, detail: 'Conservation and work' },
    { id: 'atoms', title: 'Atoms', chapter: 'Matter', subject: 'chemistry', x: 42, y: 44, detail: 'Atomic structure' },
    { id: 'bonding', title: 'Bonding', chapter: 'Matter', subject: 'chemistry', x: 73, y: 36, detail: 'Connections between atoms' },
    { id: 'reactions', title: 'Reactions', chapter: 'Matter', subject: 'chemistry', x: 58, y: 79, detail: 'Chemical transformation' }
  ],
  edges: [
    { id: 'p1', from: 'algebra', to: 'polynomials', layer: 'prerequisites' },
    { id: 'p2', from: 'algebra', to: 'linear-equations', layer: 'prerequisites' },
    { id: 'p3', from: 'polynomials', to: 'quadratics', layer: 'prerequisites' },
    { id: 'p4', from: 'algebra', to: 'arithmetic-progressions', layer: 'related' },
    { id: 'p5', from: 'quadratics', to: 'trigonometry', layer: 'applications' },
    { id: 'p6', from: 'motion', to: 'forces', layer: 'prerequisites' },
    { id: 'p7', from: 'forces', to: 'energy', layer: 'related' },
    { id: 'p8', from: 'atoms', to: 'bonding', layer: 'prerequisites' },
    { id: 'p9', from: 'bonding', to: 'reactions', layer: 'applications' }
  ],
  questions: [
    { id: 'question-demo-01', conceptId: 'quadratics', kind: 'numeric', prompt: 'Solve x² − 5x + 6 = 0.' },
    { id: 'question-demo-02', conceptId: 'polynomials', kind: 'symbolic', prompt: 'Factorise x² + 7x + 12.' }
  ],
  attempts: [
    { id: 'attempt-demo-01', questionId: 'question-demo-01', status: 'paused', step: 4, totalSteps: 8 },
    { id: 'attempt-demo-02', questionId: 'question-demo-02', status: 'submitted', step: 1, totalSteps: 1 }
  ],
  evidence: [
    { id: 'sample-quad', conceptId: 'quadratics', source: 'synthetic', questionsSeen: 8, correct: 5, minimumForAccuracy: 10 },
    { id: 'sample-poly', conceptId: 'polynomials', source: 'synthetic', questionsSeen: 12, correct: 9, minimumForAccuracy: 10 },
    { id: 'sample-linear', conceptId: 'linear-equations', source: 'synthetic', questionsSeen: 0, correct: 0, minimumForAccuracy: 10 }
  ],
  nextAction: {
    kind: 'sample-resume',
    label: 'Continue quadratic equations',
    eyebrow: 'RESUME SAMPLE SESSION',
    reason: 'A sample practice session is paused after step 4 of 8.',
    attemptId: 'attempt-demo-01',
    conceptId: 'quadratics'
  }
});

export function conceptsFor(subject) {
  return demoData.concepts.filter(item => item.subject === subject);
}

export function evidenceFor(conceptId) {
  return demoData.evidence.find(item => item.conceptId === conceptId) || null;
}

export const SUBJECT_META = {
  mathematics: { title: 'Mathematics', eyebrow: '01 / MATHEMATICS', symbol: '∑', className: 'subject-mathematics' },
  physics: { title: 'Physics', eyebrow: '02 / PHYSICS', symbol: 'λ', className: 'subject-physics' },
  chemistry: { title: 'Chemistry', eyebrow: '03 / CHEMISTRY', symbol: '◈', className: 'subject-chemistry' }
};
