// The keyboard shortcuts on the question page (Section 7.16). One table,
// read by QuestionCard (which acts on them) and by Settings → Help (which
// lists them), so the list a student reads is the list the page obeys.
// Single letters are ignored while the student is typing in a field; ⌘Z/Ctrl+Z
// is taken everywhere because the page's own undo is the one that matters.
export const PRACTICE_SHORTCUTS = Object.freeze([
  { key: 'N', action: 'next' }, { key: 'H', action: 'hint' }, { key: 'S', action: 'submit' }, { key: 'mod+Z', action: 'undo' }
]);
