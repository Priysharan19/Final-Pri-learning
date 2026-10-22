import React from 'react';
import MistakeNotebook from './MistakeNotebook.jsx';

// The mistake notebook on its own page: where a review reminder lands
// (reminders/schedule.js REMINDER_COPY.notebook). It is also shown on Review.
export default function NotebookPage() {
  return (
    <div className="qpage" data-notebook-page style={{ maxWidth: 760 }}>
      <MistakeNotebook />
    </div>
  );
}
