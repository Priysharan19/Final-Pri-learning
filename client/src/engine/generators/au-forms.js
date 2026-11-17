// Overlay files are loaded by course: a bank pulls in only its own course's overlays, so a
// Year 7 student never downloads Extension 2 forms. applyAuForms ignores ids the bank lacks.
export const AU_OVERLAYS = {
  'streams-standard': () => Promise.all([import('./au-forms-std2-a-nsw.js'), import('./au-forms-std2-b-nsw.js')]),
  'streams-ext': () => Promise.all([import('./au-forms-ext1-a-nsw.js'), import('./au-forms-ext1-b-nsw.js'), import('./au-forms-ext2-a-nsw.js')]),
  year7: () => Promise.all([import('./au-forms-y78-a-nsw.js'), import('./au-forms-y78-b-nsw.js')]),
  year8: () => Promise.all([import('./au-forms-y78-a-nsw.js'), import('./au-forms-y78-b-nsw.js')]),
  year9: () => Promise.all([import('./au-forms-y910-a-nsw.js'), import('./au-forms-y910-b-nsw.js'), import('./au-forms-y910-c-nsw.js')]),
  year10: () => Promise.all([import('./au-forms-y910-a-nsw.js'), import('./au-forms-y910-b-nsw.js'), import('./au-forms-y910-c-nsw.js')]),
  year11: () => Promise.all([import('./au-forms-adv11-a-nsw.js'), import('./au-forms-adv11-b-nsw.js')]),
  year12: () => Promise.all([import('./au-forms-adv12-a-nsw.js'), import('./au-forms-adv12-b-nsw.js'), import('./au-forms-adv12-core-nsw.js')])
};

export async function loadAuForms(bank) {
  const load = AU_OVERLAYS[bank];
  if (!load) return null;
  return Object.assign({}, ...(await load()).map(m => m.forms));
}
